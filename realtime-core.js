(function initHHRealtimeCore(globalScope, factory) {
  "use strict";

  const exports = factory(globalScope || {});
  if (typeof module === "object" && module.exports) module.exports = exports;
  if (globalScope && globalScope.document) globalScope.HHRealtime = exports.createRealtimeCore(globalScope);
})(typeof window !== "undefined" ? window : globalThis, function realtimeCoreFactory(defaultScope) {
  "use strict";

  const VERSION = 1;
  const DEFAULT_ACK_TIMEOUT = 8000;
  const SAFE_LOCAL = /^(?:http:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

  function normalizeUrl(value, locationLike) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, locationLike?.origin || "http://localhost");
      if (parsed.protocol === "https:") return parsed.origin;
      if (parsed.protocol === "http:" && SAFE_LOCAL.test(parsed.host)) return parsed.origin;
    } catch (_) { /* invalid URLs stay disabled */ }
    return "";
  }

  function createRealtimeCore(scope = defaultScope, initial = {}) {
    let url = normalizeUrl(initial.url, scope.location);
    let socket = null;
    let loadPromise = null;
    let connectPromise = null;
    let disposed = false;
    let authProvider = typeof initial.auth === "function" ? initial.auth : () => ({ ...(initial.auth || {}) });
    let authFingerprint = "";
    let status = Object.freeze({ state: url ? "idle" : "unconfigured", connected: false, confirmed: false, recovered: false, reason: "", updatedAt: new Date().toISOString(), capabilities: {} });
    const subscriptions = new Map();
    const lifecycleBindings = [];

    const dispatch = (name, detail) => {
      if (typeof scope.dispatchEvent !== "function" || typeof scope.CustomEvent !== "function") return;
      scope.dispatchEvent(new scope.CustomEvent(name, { detail }));
    };
    const publish = (state, detail = {}) => {
      status = Object.freeze({
        ...status,
        state,
        connected: Boolean(socket?.connected),
        confirmed: Boolean(socket?.realtimeConfirmed),
        recovered: Boolean(socket?.recovered),
        reason: String(detail.reason || "").slice(0, 240),
        capabilities: detail.capabilities || status.capabilities || {},
        updatedAt: new Date().toISOString()
      });
      dispatch("hh:realtime-status", { ...status, socket });
      return status;
    };
    const bindLifecycle = (target, event, handler) => {
      target?.on?.(event, handler);
      lifecycleBindings.push([target, event, handler]);
    };
    const clearLifecycle = () => {
      lifecycleBindings.splice(0).forEach(([target, event, handler]) => target?.off?.(event, handler));
    };
    const bindSubscriptions = (target) => {
      subscriptions.forEach((entries) => entries.forEach((entry) => target?.on?.(entry.event, entry.handler)));
    };
    const unbindSubscriptions = (target) => {
      subscriptions.forEach((entries) => entries.forEach((entry) => target?.off?.(entry.event, entry.handler)));
    };
    const currentAuth = () => {
      const provided = authProvider?.();
      return provided && typeof provided === "object" && !Array.isArray(provided) ? { ...provided } : {};
    };
    const fingerprint = (value) => {
      try { return JSON.stringify(value, Object.keys(value).sort()); }
      catch (_) { return String(Date.now()); }
    };

    function ensureClient() {
      if (typeof scope.io === "function") return Promise.resolve(scope.io);
      if (!url || !scope.document) return Promise.reject(new Error("Socket.IO client chưa được cấu hình."));
      if (loadPromise) return loadPromise;
      loadPromise = new Promise((resolve, reject) => {
        const selector = "script[data-hh-realtime-client]";
        const existing = scope.document.querySelector(selector);
        const finish = () => typeof scope.io === "function" ? resolve(scope.io) : reject(new Error("Socket.IO client không hợp lệ."));
        if (existing) {
          if (typeof scope.io === "function") return finish();
          existing.addEventListener("load", finish, { once: true });
          existing.addEventListener("error", () => reject(new Error("Không tải được Socket.IO client.")), { once: true });
          return;
        }
        const script = scope.document.createElement("script");
        script.dataset.hhRealtimeClient = "true";
        script.async = true;
        script.src = `${url}/socket.io/socket.io.js`;
        script.onload = finish;
        script.onerror = () => reject(new Error("Không tải được Socket.IO client."));
        scope.document.head.appendChild(script);
      }).finally(() => { loadPromise = null; });
      return loadPromise;
    }

    function installSocket(nextSocket) {
      if (!nextSocket || typeof nextSocket.on !== "function" || typeof nextSocket.emit !== "function") throw new Error("Socket.IO client không hợp lệ.");
      if (socket && socket !== nextSocket) {
        unbindSubscriptions(socket);
        clearLifecycle();
        socket.disconnect?.();
      }
      socket = nextSocket;
      socket.realtimeConfirmed = false;
      scope.HHRealtimeSocket = socket;
      bindLifecycle(socket, "connect", () => {
        publish(socket.recovered ? "recovered" : "connected");
        dispatch("hh:realtime-ready", { socket, recovered: Boolean(socket.recovered), confirmed: Boolean(socket.realtimeConfirmed) });
      });
      bindLifecycle(socket, "realtime:hello", (hello = {}) => {
        socket.realtimeConfirmed = hello.authenticated === true || hello.authenticated === false;
        socket.confirmed = socket.realtimeConfirmed;
        publish(socket.recovered ? "recovered" : "connected", { capabilities: hello.capabilities || {} });
        dispatch("hh:realtime-capabilities", { socket, ...hello });
      });
      bindLifecycle(socket, "disconnect", (reason) => {
        const recovering = reason !== "io client disconnect" && reason !== "io server disconnect";
        publish(recovering ? "recovering" : "offline", { reason });
        dispatch("hh:realtime-offline", { socket, reason, recovering });
      });
      bindLifecycle(socket, "connect_error", (error) => {
        publish("offline", { reason: error?.message || "Không thể kết nối realtime." });
        dispatch("hh:realtime-offline", { socket, reason: error?.message || "connect_error", recovering: true });
      });
      bindLifecycle(socket.io, "reconnect_attempt", () => publish("recovering", { reason: "reconnect_attempt" }));
      bindSubscriptions(socket);
      return socket;
    }

    const api = {
      VERSION,
      configure(options = {}) {
        const nextUrl = normalizeUrl(options.url == null ? url : options.url, scope.location);
        const changedUrl = nextUrl !== url;
        url = nextUrl;
        if (typeof options.auth === "function") authProvider = options.auth;
        else if (options.auth && typeof options.auth === "object") authProvider = () => ({ ...options.auth });
        if (changedUrl && socket) {
          unbindSubscriptions(socket);
          clearLifecycle();
          socket.disconnect?.();
          socket = null;
          scope.HHRealtimeSocket = null;
        }
        if (!url) publish("unconfigured", { reason: "Realtime URL chưa được cấu hình." });
        return api;
      },
      async connect(options = {}) {
        if (disposed) throw new Error("Realtime core đã được dọn khỏi trang.");
        if (!url) { publish("unconfigured", { reason: "Realtime URL chưa được cấu hình." }); return null; }
        const auth = currentAuth();
        const nextFingerprint = fingerprint(auth);
        const shouldReconnect = Boolean(options.force || (socket && authFingerprint && authFingerprint !== nextFingerprint));
        authFingerprint = nextFingerprint;
        if (socket) {
          socket.auth = auth;
          if (shouldReconnect && socket.connected) socket.disconnect?.();
          if (!socket.connected) socket.connect?.();
          else publish("connected");
          return socket;
        }
        if (connectPromise) return connectPromise;
        publish("connecting");
        connectPromise = ensureClient().then((factory) => {
          const created = factory(url, {
            autoConnect: false,
            transports: ["websocket", "polling"],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.35,
            timeout: 12000,
            auth
          });
          installSocket(created);
          created.connect?.();
          return created;
        }).catch((error) => {
          publish("offline", { reason: error?.message || "Không thể khởi tạo realtime." });
          dispatch("hh:realtime-offline", { socket: null, reason: error?.message || "connect_error", recovering: false });
          return null;
        }).finally(() => { connectPromise = null; });
        return connectPromise;
      },
      disconnect(options = {}) {
        if (!socket) return;
        socket.disconnect?.();
        if (options.clear === true) {
          unbindSubscriptions(socket);
          clearLifecycle();
          socket = null;
          scope.HHRealtimeSocket = null;
        }
        publish("offline", { reason: "io client disconnect" });
      },
      socket() { return socket; },
      status() { return { ...status }; },
      subscribe(scopeName, event, handler) {
        const name = String(scopeName || "global").slice(0, 120);
        if (!event || typeof handler !== "function") return () => {};
        const entry = { event: String(event).slice(0, 120), handler };
        if (!subscriptions.has(name)) subscriptions.set(name, new Set());
        subscriptions.get(name).add(entry);
        socket?.on?.(entry.event, handler);
        return () => {
          socket?.off?.(entry.event, handler);
          subscriptions.get(name)?.delete(entry);
          if (!subscriptions.get(name)?.size) subscriptions.delete(name);
        };
      },
      unsubscribeScope(scopeName) {
        const name = String(scopeName || "global").slice(0, 120);
        const entries = subscriptions.get(name);
        if (!entries) return;
        entries.forEach((entry) => socket?.off?.(entry.event, entry.handler));
        subscriptions.delete(name);
      },
      emit(event, payload = {}, options = {}) {
        const target = socket;
        if (!target?.connected) return Promise.reject(Object.assign(new Error("Realtime đang ngoại tuyến."), { code: "REALTIME_OFFLINE" }));
        if (options.ack === false) {
          const emitter = options.volatile && target.volatile ? target.volatile : target;
          emitter.emit(event, payload);
          return Promise.resolve({ ok: true, acknowledged: false });
        }
        const timeout = Math.max(500, Math.min(30000, Number(options.timeout) || DEFAULT_ACK_TIMEOUT));
        return new Promise((resolve, reject) => {
          let settled = false;
          const timer = scope.setTimeout?.(() => {
            if (settled) return;
            settled = true;
            reject(Object.assign(new Error("Máy chủ realtime không phản hồi đúng hạn."), { code: "ACK_TIMEOUT" }));
          }, timeout);
          const done = (error, response) => {
            if (settled) return;
            settled = true;
            scope.clearTimeout?.(timer);
            if (error) return reject(Object.assign(new Error(error.message || "Realtime acknowledgement failed."), { code: "ACK_ERROR" }));
            if (response?.ok === false) return reject(Object.assign(new Error(response.error || "Máy chủ từ chối sự kiện realtime."), { code: response.code || "REALTIME_REJECTED", response }));
            resolve(response == null ? { ok: true } : response);
          };
          try {
            const emitter = options.volatile && target.volatile ? target.volatile : target;
            if (typeof emitter.timeout === "function") emitter.timeout(timeout).emit(event, payload, done);
            else emitter.emit(event, payload, (response) => done(null, response));
          } catch (error) { done(error); }
        });
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (socket) {
          unbindSubscriptions(socket);
          clearLifecycle();
          socket.disconnect?.();
        }
        subscriptions.clear();
        socket = null;
        scope.HHRealtimeSocket = null;
      }
    };
    return Object.freeze(api);
  }

  return Object.freeze({ VERSION, normalizeUrl, createRealtimeCore });
});
