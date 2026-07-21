(() => {
  "use strict";

  const STORAGE_KEY = "hh.auth.motion-mode";
  const UNIVERSE_KEY = "hh.auth.selected-universe";
  const PENDING_ROUTE_KEY = "hh.auth.pending-route";
  const MODES = Object.freeze(["static", "balanced", "vivid"]);
  const DEFAULT_DURATION = Object.freeze({ balanced: 820, vivid: 980 });
  const ROUTES = Object.freeze({
    ai: "#/create/ai-center",
    music: "#/music-ai/studio",
    design: "#/graphic-design",
    learning: "#/learn/home",
    community: "#/communication/community"
  });

  const immediateResult = (reason = "unavailable") => Promise.resolve({
    completed: true,
    skipped: true,
    reason,
    duration: 0,
    route: ""
  });

  const installUnavailableApi = () => {
    const api = Object.freeze({
      available: false,
      play: () => immediateResult(),
      waitForCompletion: () => immediateResult(),
      getMode: () => "static",
      setMode: () => "static",
      destroy: () => undefined
    });
    window.HHAuthTransitionRuntime = api;
    window.HHAuthTransition = api;
  };

  const init = () => {
    const gate = document.querySelector("#authGate");
    if (!gate) {
      installUnavailableApi();
      return;
    }

    const body = document.body;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 720px), (pointer: coarse)");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const removers = [];
    let destroyed = false;
    let realtimeConnected = Boolean(window.HHRealtimeSocket?.connected);
    let preferredMode = "balanced";
    let effectiveMode = "balanced";
    let currentRun = null;
    let runSequence = 0;
    let overlay = null;
    let control = null;

    const addListener = (target, type, listener, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener, options);
      removers.push(() => target.removeEventListener(type, listener, options));
    };

    const safeStorageGet = (storage, key) => {
      try { return storage.getItem(key); }
      catch { return null; }
    };

    const safeStorageSet = (storage, key, value) => {
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    };

    const validMode = (value) => MODES.includes(value) ? value : "";

    const isConstrainedConnection = () => {
      if (connection?.saveData) return true;
      return ["slow-2g", "2g"].includes(String(connection?.effectiveType || "").toLowerCase());
    };

    const detectAutomaticMode = () => {
      if (reducedMotion.matches || isConstrainedConnection()) return "static";
      const memory = Number(navigator.deviceMemory || 0);
      if ((memory && memory <= 2) || mobileViewport.matches) return "balanced";
      if (memory && memory <= 4) return "balanced";
      return "vivid";
    };

    const hasSavedPreference = () => Boolean(validMode(safeStorageGet(localStorage, STORAGE_KEY)));

    const applyMode = (requestedMode, { persist = false, source = "auto" } = {}) => {
      preferredMode = validMode(requestedMode) || detectAutomaticMode();
      if (persist) safeStorageSet(localStorage, STORAGE_KEY, preferredMode);

      // Reduced motion is a hard accessibility boundary; the saved preference remains intact.
      effectiveMode = reducedMotion.matches ? "static" : preferredMode;
      gate.dataset.authMotionMode = effectiveMode;
      body.dataset.authMotionMode = effectiveMode;
      gate.dataset.authMotionPreference = preferredMode;
      body.dataset.authMotionPreference = preferredMode;

      control?.querySelectorAll("[data-auth-motion-value]").forEach((button) => {
        const selected = button.dataset.authMotionValue === preferredMode;
        button.setAttribute("aria-pressed", String(selected));
      });
      const modeLabel = control?.querySelector("[data-auth-motion-label]");
      if (modeLabel) {
        const labels = { static: "Tĩnh", balanced: "Cân bằng", vivid: "Sống động" };
        modeLabel.textContent = reducedMotion.matches && preferredMode !== "static"
          ? `${labels.static} · theo thiết bị`
          : labels[effectiveMode];
      }

      window.dispatchEvent(new CustomEvent("hh:auth-motion-mode-change", {
        detail: { mode: effectiveMode, preference: preferredMode, source }
      }));
      return effectiveMode;
    };

    const updateNetwork = (requestedState = "") => {
      let state = requestedState;
      if (!navigator.onLine) state = "offline";
      else if (realtimeConnected) state = "realtime";
      else if (!state || state === "offline") state = "online";
      if (!['online', 'offline', 'realtime'].includes(state)) state = "online";
      gate.dataset.authNetwork = state;
      body.dataset.authNetwork = state;
      const networkLabel = control?.querySelector("[data-auth-network-label]");
      if (networkLabel) {
        networkLabel.textContent = state === "realtime" ? "Realtime" : state === "offline" ? "Ngoại tuyến" : "Trực tuyến";
      }
      return state;
    };

    const injectControl = () => {
      const host = gate.querySelector(".auth-gate-card");
      if (!host || host.querySelector("[data-auth-motion-control]")) return host?.querySelector("[data-auth-motion-control]") || null;
      const node = document.createElement("div");
      node.className = "auth-motion-control";
      node.dataset.authMotionControl = "";
      node.setAttribute("role", "group");
      node.setAttribute("aria-label", "Mức chuyển động của trang đăng nhập");
      node.innerHTML = `
        <span class="auth-motion-control__label"><span data-auth-network-label>Trực tuyến</span> · <b data-auth-motion-label>Cân bằng</b></span>
        <span class="auth-motion-control__options">
          <button type="button" data-auth-motion-value="static" aria-pressed="false" title="Tắt hầu hết chuyển động">Tĩnh</button>
          <button type="button" data-auth-motion-value="balanced" aria-pressed="false" title="Hiệu ứng nhẹ, tiết kiệm tài nguyên">Cân bằng</button>
          <button type="button" data-auth-motion-value="vivid" aria-pressed="false" title="Hiệu ứng đầy đủ trên thiết bị phù hợp">Sống động</button>
        </span>`;
      const privacy = host.querySelector("[data-auth-privacy]");
      if (privacy) host.insertBefore(node, privacy);
      else host.append(node);
      addListener(node, "click", (event) => {
        const button = event.target.closest("[data-auth-motion-value]");
        if (!button) return;
        applyMode(button.dataset.authMotionValue, { persist: true, source: "user" });
      });
      return node;
    };

    const createOverlay = () => {
      if (overlay?.isConnected) return overlay;
      const node = document.createElement("section");
      node.className = "auth-transition-runtime";
      node.dataset.authTransitionRuntime = "";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = `
        <div class="auth-transition-runtime__stage">
          <div class="auth-transition-runtime__portal" aria-hidden="true">
            <span class="auth-transition-runtime__avatar" data-auth-transition-avatar><b>HH</b></span>
          </div>
          <div class="auth-transition-runtime__copy">
            <small>HH ID · Đã xác thực</small>
            <strong data-auth-transition-title>Chào mừng trở lại</strong>
            <span data-auth-transition-status>Đang chuẩn bị workspace của bạn...</span>
          </div>
          <div class="auth-transition-runtime__progress" role="progressbar" aria-label="Đang mở HH Platform" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
          <button class="auth-transition-runtime__skip" type="button" data-auth-transition-skip>Bỏ qua chuyển cảnh</button>
        </div>`;
      body.append(node);
      addListener(node, "click", (event) => {
        if (event.target.closest("[data-auth-transition-skip]")) currentRun?.finish?.("skipped");
      });
      return node;
    };

    const readSelectedUniverse = () => {
      const raw = safeStorageGet(sessionStorage, UNIVERSE_KEY);
      if (!raw) return { id: "", route: "" };
      let value = raw;
      try { value = JSON.parse(raw); } catch {}
      if (value && typeof value === "object") {
        return { id: String(value.id || value.module || "").toLowerCase(), route: String(value.route || "") };
      }
      return { id: String(value).trim().toLowerCase(), route: "" };
    };

    const normalizeRoute = (route) => {
      const value = String(route || "").trim();
      if (/^#\/[a-z0-9/_-]+(?:\?[a-z0-9_=&%.-]+)?$/i.test(value)) return value;
      if (/^\/[a-z0-9/_-]+(?:\?[a-z0-9_=&%.-]+)?$/i.test(value)) return `#${value}`;
      return "";
    };

    const selectPendingRoute = (detail = {}) => {
      const selected = readSelectedUniverse();
      const selectedId = selected.id.replace(/\s+(center|studio|lab)$/i, "").replace(/[^a-z]/g, "");
      const explicit = normalizeRoute(detail.route || detail.pendingRoute);
      const existing = normalizeRoute(safeStorageGet(sessionStorage, PENDING_ROUTE_KEY));
      const universe = normalizeRoute(selected.route) || ROUTES[selectedId] || "";
      const route = explicit || existing || universe || "#/home";
      safeStorageSet(sessionStorage, PENDING_ROUTE_KEY, route);
      return route;
    };

    const readPublicUser = (detail = {}) => {
      if (detail?.user && typeof detail.user === "object") return detail.user;
      try {
        const stored = JSON.parse(safeStorageGet(localStorage, "hh-auth-user") || "null");
        return stored && typeof stored === "object" ? stored : null;
      } catch {
        return null;
      }
    };

    const initialsFor = (user) => String(user?.name || user?.nickname || user?.email || "HH")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "HH";

    const renderUser = (user) => {
      const avatar = overlay?.querySelector("[data-auth-transition-avatar]");
      const title = overlay?.querySelector("[data-auth-transition-title]");
      if (!avatar) return;
      avatar.replaceChildren();
      if (user?.avatar && /^(https?:|data:image\/|blob:)/i.test(String(user.avatar))) {
        const image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.src = String(user.avatar);
        image.addEventListener("error", () => {
          avatar.replaceChildren();
          const fallback = document.createElement("b");
          fallback.textContent = initialsFor(user);
          avatar.append(fallback);
        }, { once: true });
        avatar.append(image);
      } else {
        const fallback = document.createElement("b");
        fallback.textContent = initialsFor(user);
        avatar.append(fallback);
      }
      if (title) title.textContent = `Chào mừng ${user?.name || user?.nickname || "bạn"}`;
    };

    const dispatchComplete = (result) => {
      window.dispatchEvent(new CustomEvent("hh:auth-transition-complete", { detail: result }));
      gate.dispatchEvent(new CustomEvent("hh:auth-transition-complete", { detail: result }));
    };

    const finishImmediately = (detail, reason) => {
      const route = selectPendingRoute(detail);
      const result = { completed: true, skipped: true, reason, duration: 0, route, mode: effectiveMode };
      dispatchComplete(result);
      return Promise.resolve(result);
    };

    const play = (detail = {}) => {
      try {
        if (destroyed) return immediateResult("destroyed");
        const user = readPublicUser(detail);
        if (!user) return immediateResult("missing-user");
        if (currentRun) return currentRun.promise;
        if (reducedMotion.matches || effectiveMode === "static") return finishImmediately(detail, "reduced-motion");

        overlay = createOverlay();
        if (!overlay) return finishImmediately(detail, "missing-overlay");
        const route = selectPendingRoute(detail);
        const requestedDuration = Number(detail.duration);
        const fallbackDuration = DEFAULT_DURATION[effectiveMode] || DEFAULT_DURATION.balanced;
        const duration = Math.min(1100, Math.max(700, Number.isFinite(requestedDuration) ? requestedDuration : fallbackDuration));
        const runId = ++runSequence;
        let settled = false;
        let timer = 0;
        let resolveRun;
        const promise = new Promise((resolve) => { resolveRun = resolve; });

        const finish = (reason = "completed") => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          const result = {
            completed: true,
            skipped: reason !== "completed",
            reason,
            duration: reason === "completed" ? duration : 0,
            route,
            mode: effectiveMode,
            runId
          };
          overlay?.classList.remove("is-playing", "is-active");
          overlay?.setAttribute("aria-hidden", "true");
          overlay?.querySelector("[role=progressbar]")?.setAttribute("aria-valuenow", "100");
          currentRun = null;
          dispatchComplete(result);
          resolveRun(result);
        };

        currentRun = { promise, finish, runId, route };
        renderUser(user);
        const status = overlay.querySelector("[data-auth-transition-status]");
        if (status) status.textContent = route === "#/home" ? "Đang chuẩn bị workspace của bạn..." : "Đang mở không gian bạn vừa chọn...";
        overlay.style.setProperty("--auth-transition-duration", `${duration}ms`);
        overlay.querySelector("[role=progressbar]")?.setAttribute("aria-valuenow", "1");
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.add("is-active");
        requestAnimationFrame(() => {
          if (!settled && currentRun?.runId === runId) overlay.classList.add("is-playing");
        });
        timer = window.setTimeout(() => finish("completed"), duration);
        return promise;
      } catch {
        return finishImmediately(detail, "runtime-error");
      }
    };

    const waitForCompletion = (maxMs = 1200) => {
      if (!currentRun) return Promise.resolve({ completed: true, skipped: false, reason: "idle", duration: 0, route: "", mode: effectiveMode });
      const timeout = Math.max(0, Number(maxMs) || 0);
      if (!timeout) return currentRun.promise;
      return Promise.race([
        currentRun.promise,
        new Promise((resolve) => window.setTimeout(() => resolve({
          completed: false,
          skipped: true,
          reason: "wait-timeout",
          duration: timeout,
          route: currentRun?.route || "",
          mode: effectiveMode
        }), timeout))
      ]);
    };

    const handleAuthEvent = (event) => {
      if (!body.classList.contains("auth-locked")) return;
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      const user = readPublicUser(detail);
      if (user) void play({ ...detail, user });
    };

    const handleVisibility = () => {
      const paused = document.hidden;
      gate.dataset.authMotionPaused = String(paused);
      body.dataset.authMotionPaused = String(paused);
    };

    const handleAdaptiveChange = () => {
      if (hasSavedPreference()) applyMode(safeStorageGet(localStorage, STORAGE_KEY), { source: "system" });
      else applyMode(detectAutomaticMode(), { source: "auto" });
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      currentRun?.finish?.("destroyed");
      removers.splice(0).forEach((remove) => {
        try { remove(); } catch {}
      });
      control?.remove();
      overlay?.remove();
      delete gate.dataset.authMotionMode;
      delete gate.dataset.authMotionPreference;
      delete gate.dataset.authMotionPaused;
      delete gate.dataset.authNetwork;
    };

    control = injectControl();
    overlay = createOverlay();
    preferredMode = validMode(safeStorageGet(localStorage, STORAGE_KEY)) || detectAutomaticMode();
    applyMode(preferredMode, { source: hasSavedPreference() ? "storage" : "auto" });
    updateNetwork();
    handleVisibility();

    addListener(window, "online", () => updateNetwork(realtimeConnected ? "realtime" : "online"));
    addListener(window, "offline", () => updateNetwork("offline"));
    addListener(window, "hh:realtime-ready", () => {
      realtimeConnected = true;
      updateNetwork("realtime");
    });
    addListener(window, "hh:realtime-offline", () => {
      realtimeConnected = false;
      updateNetwork(navigator.onLine ? "online" : "offline");
    });
    addListener(window, "hh:auth-change", handleAuthEvent);
    addListener(gate, "hh:auth-success", handleAuthEvent);
    addListener(window, "hh:auth-success", handleAuthEvent);
    addListener(document, "visibilitychange", handleVisibility);
    addListener(reducedMotion, "change", handleAdaptiveChange);
    addListener(mobileViewport, "change", handleAdaptiveChange);
    if (connection?.addEventListener) addListener(connection, "change", handleAdaptiveChange);
    addListener(window, "pagehide", destroy, { once: true });

    const api = Object.freeze({
      available: true,
      play,
      waitForCompletion,
      getMode: () => effectiveMode,
      getPreference: () => preferredMode,
      setMode: (mode) => applyMode(mode, { persist: true, source: "api" }),
      getNetwork: () => gate.dataset.authNetwork || "offline",
      destroy
    });
    window.HHAuthTransitionRuntime = api;
    window.HHAuthTransition = api;
    window.dispatchEvent(new CustomEvent("hh:auth-transition-ready", { detail: { api, mode: effectiveMode } }));
    gate.dispatchEvent(new CustomEvent("hh:auth-transition-ready", { detail: { api, mode: effectiveMode } }));
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
