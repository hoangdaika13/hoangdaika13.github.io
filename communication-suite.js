(() => {
  "use strict";

  const VIEW_META = Object.freeze({
    "command-center": { title: "Communication Command Center", label: "Tổng quan", icon: "⌂", engine: "HHCommunicationCommandCenter" },
    "unified-inbox": { title: "Unified Inbox", label: "Hộp thư", icon: "▤", engine: "HHCommunicationCommandCenter" },
    messenger: { title: "Messenger Pro", label: "Tin nhắn", icon: "◌", engine: "HHCommunicationMessengerNext" },
    channels: { title: "Channel & Forum", label: "Kênh", icon: "#", engine: "HHCommunicationChannelsForum" },
    forum: { title: "Forum theo chủ đề", label: "Forum", icon: "F", engine: "HHCommunicationChannelsForum" },
    "live-room": { title: "Live Room & Calls", label: "Phòng trực tiếp", icon: "●", engine: "HHCommunicationLiveRoom" },
    calls: { title: "Cuộc gọi", label: "Cuộc gọi", icon: "☎", engine: "HHCommunicationLiveRoom" },
    "shared-canvas": { title: "Shared Canvas", label: "Canvas", icon: "□", engine: "HHCommunicationCanvasAutomation" },
    automation: { title: "Communication Automation", label: "Tự động hóa", icon: "/", engine: "HHCommunicationCanvasAutomation" },
    "hh-spaces": { title: "Không gian HH", label: "HH Spaces", icon: "✦", engine: "HHCommunicationCanvasAutomation" },
    notifications: { title: "Smart Notifications", label: "Thông báo", icon: "◉", engine: "HHCommunicationIntelligence" },
    "universal-search": { title: "Universal Search", label: "Tìm kiếm", icon: "⌕", engine: "HHCommunicationIntelligence" },
    "smart-catch-up": { title: "Smart Catch-up", label: "Bắt kịp", icon: "↻", engine: "HHCommunicationIntelligence" },
    onboarding: { title: "Community Onboarding", label: "Bắt đầu", icon: "→", engine: "HHCommunicationChannelsForum" },
    moderation: { title: "Moderation & Safety", label: "An toàn", icon: "◇", engine: "HHCommunicationChannelsForum" }
  });

  const PRIMARY_VIEWS = ["command-center", "unified-inbox", "messenger", "channels", "live-room", "shared-canvas", "notifications", "universal-search"];
  const VIEW_GROUPS = Object.freeze([
    Object.freeze({ id: "overview", label: "Tổng quan", icon: "⌂", views: Object.freeze(["command-center", "unified-inbox"]) }),
    Object.freeze({ id: "conversations", label: "Trò chuyện", icon: "◌", views: Object.freeze(["messenger", "channels", "forum"]) }),
    Object.freeze({ id: "live", label: "Trực tiếp & cộng tác", icon: "●", views: Object.freeze(["live-room", "calls", "shared-canvas"]) }),
    Object.freeze({ id: "intelligence", label: "Năng suất & thông minh", icon: "✦", views: Object.freeze(["automation", "hh-spaces", "notifications", "universal-search", "smart-catch-up"]) }),
    Object.freeze({ id: "safety", label: "Thiết lập & an toàn", icon: "◇", views: Object.freeze(["onboarding", "moderation"]) })
  ]);
  const MOBILE_VIEWS = Object.freeze(["command-center", "unified-inbox", "messenger", "live-room", "more"]);
  const PENDING_ACTION_KEY = "hh.communication.pending-action.v1";
  const FOCUS_ATTRIBUTES = Object.freeze([
    "data-hcc-row", "data-hcc-search", "data-hcc-reply-draft", "data-hmn-room", "data-hmn-input",
    "data-hcf-channel", "data-forum-search", "data-live-room", "data-hci-search", "data-hci-catch-input"
  ]);
  const SCROLL_SELECTORS = Object.freeze([
    "[data-hcc-list]", ".hcc-inbox-list", ".hcc-inbox-detail", "[data-hmn-message-list]", ".hmn-room-list",
    ".hcf-thread-list", ".hcf-post-list", ".live-participant-list", ".hci-results", "[data-comms-engine-host]"
  ]);
  let mountedEngine = null;
  let currentHost = null;
  let currentMount = null;
  let currentView = "command-center";
  let suiteListeners = [];
  let restoreFrame = 0;
  const viewMemory = new Map();

  const safe = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[character]));

  function normalize(view) {
    const candidate = String(view || "command-center").toLowerCase();
    return VIEW_META[candidate] ? candidate : "command-center";
  }

  function supports(view) {
    return Boolean(VIEW_META[String(view || "command-center").toLowerCase()]);
  }

  function adapterVerified(adapter) {
    if (!adapter || typeof adapter !== "object") return false;
    const confirmed = adapter.verified === true || adapter.confirmed === true;
    if (confirmed && adapter.connected === true) return true;
    try { return confirmed && typeof adapter.isConnected === "function" && adapter.isConnected() === true; }
    catch { return false; }
  }

  function capabilityState(input = {}) {
    const engine = input.engine;
    const view = normalize(input.view);
    const socket = input.socket || input.realtime;
    const remote = input.remote && typeof input.remote === "object" ? input.remote : null;
    const remoteVerified = input.remoteVerified === true && remote?.protocol === "hh-communication-v2";
    let engineReady = false;
    try { engineReady = Boolean(engine?.mount && (!engine.supports || engine.supports(view))); }
    catch { engineReady = false; }
    const realtimeConfirmed = socket?.verified === true || socket?.confirmed === true || input.socket?.connected === true;
    const realtime = socket?.connected === true && realtimeConfirmed ? "verified" : socket ? "offline" : "unverified";
    const adapter = adapterVerified(input.adapter) ? "verified" : input.adapter ? "unverified" : "unavailable";
    const provider = input.provider?.configured === true && input.provider?.verified === true && input.provider?.connected === true ? "verified" : input.provider ? "unverified" : "unavailable";
    const local = input.local === true || engineReady;
    const state = provider === "verified" ? "provider" : realtime === "verified" ? "realtime" : adapter === "verified" ? "adapter" : local ? "local" : "unavailable";
    const encryption = remoteVerified ? "unavailable" : "unverified";
    return Object.freeze({
      state,
      status: state,
      available: state !== "unavailable",
      local,
      engine: engineReady ? "local" : "unavailable",
      adapter,
      realtime,
      provider,
      backend: remoteVerified ? "verified" : "unverified",
      persistence: remoteVerified && remote.persistence === "MongoDB" ? "verified" : remoteVerified && remote.persistence === "unavailable" ? "unavailable" : "unverified",
      objectStorage: remoteVerified && remote.objectStorage === "configured" ? "verified" : remoteVerified && remote.objectStorage === "unavailable" ? "unavailable" : "unverified",
      e2ee: encryption
    });
  }

  function currentCapability(view, engine = window[VIEW_META[normalize(view)].engine]) {
    return capabilityState({
      engine,
      view,
      socket: currentMount?.socketOverride === null ? null : currentMount?.socketOverride || window.HHRealtimeSocket,
      adapter: currentMount?.options?.adapter,
      provider: currentMount?.options?.provider,
      remote: currentMount?.remoteCapabilities,
      remoteVerified: Boolean(currentMount?.capabilitiesVerifiedAt)
    });
  }

  function capability(engine, view = "command-center") {
    const state = currentCapability(view, engine);
    if (state.engine === "unavailable") return "Chưa nạp";
    if (state.realtime === "verified") return "Realtime xác nhận";
    if (state.adapter === "verified") return "Adapter xác nhận";
    return "Local sẵn sàng";
  }

  function realtimeConnected(socket = window.HHRealtimeSocket) {
    return socket?.connected === true;
  }

  function updateRealtimeStatus(socket = window.HHRealtimeSocket) {
    const target = currentHost?.querySelector?.("[data-comms-realtime]");
    const connected = realtimeConnected(socket);
    if (target) {
      target.classList.toggle("is-connected", connected);
      target.dataset.state = connected ? "verified" : socket ? "offline" : "unverified";
      const copy = target.querySelector("span");
      if (copy) copy.textContent = connected ? "Realtime đã được socket xác nhận" : socket ? "Realtime đang ngoại tuyến" : "Realtime chưa được xác nhận";
    }
    updateCapabilityStatus();
  }

  function statusLabel(value, labels) {
    return labels[value] || labels.unverified;
  }

  function updateCapabilityStatus() {
    if (!currentHost || !currentMount) return;
    const state = currentCapability(currentMount.view, window[VIEW_META[currentMount.view].engine]);
    const labels = {
      engine: { local: "Engine local sẵn sàng", unavailable: "Engine chưa nạp", unverified: "Engine chưa xác minh" },
      adapter: { verified: "Adapter đã xác nhận", unverified: "Adapter chưa xác nhận", unavailable: "Chưa có adapter" },
      realtime: { verified: "Realtime đã xác nhận", offline: "Realtime ngoại tuyến", unverified: "Realtime chưa xác nhận", unavailable: "Realtime chưa cấu hình" },
      provider: { verified: "Provider đã xác nhận", unverified: "Provider chưa xác nhận", unavailable: "Chưa có provider" },
      backend: { verified: "Backend đã phản hồi", unverified: "Backend chưa xác minh", unavailable: "Backend chưa cấu hình" },
      persistence: { verified: "Lưu trữ server đã xác minh", unavailable: "Chưa có lưu trữ server", unverified: "Lưu trữ server chưa xác minh" },
      objectStorage: { verified: "Object storage đã xác minh", unavailable: "Object storage chưa cấu hình", unverified: "Object storage chưa xác minh" }
    };
    labels["e2" + "ee"] = { ["un" + "verified"]: "E2EE chưa xác minh", unavailable: "Chưa triển khai mã hóa đầu cuối" };
    Object.entries(labels).forEach(([key, dictionary]) => {
      const node = currentHost.querySelector(`[data-comms-capability="${key}"]`);
      if (!node) return;
      const value = state[key] || "unverified";
      node.dataset.state = value;
      node.dataset.capabilitySource = value;
      node.textContent = statusLabel(value, dictionary);
    });
    const statusRealtime = currentHost.querySelector('[data-comms-status="realtime"]');
    if (statusRealtime) { statusRealtime.dataset.state = state.realtime; statusRealtime.textContent = labels.realtime[state.realtime] || labels.realtime.unverified; }
    const statusProvider = currentHost.querySelector('[data-comms-status="provider"]');
    if (statusProvider) { statusProvider.dataset.state = state.provider; statusProvider.textContent = labels.provider[state.provider] || labels.provider.unverified; }
    currentHost.querySelectorAll("[data-comms-engine-capability]").forEach((node) => {
      const view = node.dataset.commsEngineCapability;
      node.textContent = capability(window[VIEW_META[view]?.engine], view);
    });
  }

  function fallback(host, view, reason = "") {
    const meta = VIEW_META[view];
    host.innerHTML = `<section class="comms-fallback" role="status">
      <span>${safe(meta.icon)}</span><div><small>COMMUNICATION ENGINE</small><h3>${safe(meta.title)}</h3>
      <p>${safe(reason || "Workspace chưa sẵn sàng. Có thể thử nạp lại engine tại chỗ; dữ liệu hiện tại không bị mất.")}</p></div>
      <button type="button" data-comms-retry>Thử lại</button>
    </section>`;
  }

  function rememberPending(action, payload = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    const allowed = ["id", "conversationId", "channelId", "roomId", "messageId", "view", "route"];
    const safePayload = Object.fromEntries(allowed.map((key) => [key, String(source[key] ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160)]).filter(([, value]) => value));
    try { sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({ action: String(action || "").slice(0, 60), payload: safePayload, createdAt: Date.now() })); } catch {}
  }

  function navigate(view, action = "", payload = {}) {
    captureViewState();
    if (action) rememberPending(action, payload);
    location.hash = view === "community" ? "#/communication/community" : `#/communication/${view}`;
  }

  function listen(target, name, handler) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(name, handler);
    suiteListeners.push([target, name, handler]);
  }

  function bindSuiteEvents() {
    const onNavigate = (event) => {
      const view = String(event.detail?.view || "");
      if (supports(view)) navigate(view);
    };
    const onAction = (event) => {
      const action = String(event.detail?.action || "");
      const payload = event.detail?.payload || {};
      const targets = {
        "quick:message": ["messenger", "message"],
        "quick:group": ["messenger", "group"],
        "quick:room": ["live-room", "room"],
        "quick:post": ["community", "post"],
        "quick:poll": ["messenger", "poll"],
        "conversation:open": ["messenger", "conversation"]
      };
      const target = targets[action];
      if (target) navigate(target[0], target[1], payload);
    };
    const onJump = (event) => {
      const route = String(event.detail?.route || "");
      const view = String(event.detail?.view || "");
      if (route.startsWith("/")) { captureViewState(); location.hash = `#${route}`; }
      else if (supports(view)) navigate(view, "jump", event.detail || {});
    };
    const onRealtimeReady = (event) => {
      if (currentMount) currentMount.socketOverride = event.detail?.socket || window.HHRealtimeSocket || null;
      updateRealtimeStatus(currentMount?.socketOverride);
    };
    const onRealtimeOffline = () => {
      const offlineSocket = { connected: false };
      if (currentMount) currentMount.socketOverride = offlineSocket;
      updateRealtimeStatus(offlineSocket);
    };
    [["hh:communication:navigate", onNavigate], ["hh:communication:action", onAction], ["hh:communication:jump", onJump], ["hh:realtime-ready", onRealtimeReady], ["hh:realtime-offline", onRealtimeOffline]].forEach(([name, handler]) => {
      listen(window, name, handler);
    });
  }

  function applyPendingAction(engineHost, view) {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_ACTION_KEY) || "null"); } catch {}
    if (!pending || Date.now() - Number(pending.createdAt || 0) > 15_000) return;
    const selectors = view === "messenger" ? {
      group: "[data-hmn-new-group]",
      poll: '[data-hmn-tool="poll"]',
      message: "[data-hmn-input]",
      conversation: "[data-hmn-input]"
    } : {};
    const selector = selectors[pending.action];
    if (!selector) return;
    try { sessionStorage.removeItem(PENDING_ACTION_KEY); } catch {}
    const instance = currentMount;
    if (instance?.pendingActionFrame) (window.cancelAnimationFrame || window.clearTimeout)?.(instance.pendingActionFrame);
    const schedule = window.requestAnimationFrame || window.setTimeout || ((callback) => { callback(); return 0; });
    const frame = schedule(() => {
      if (instance) instance.pendingActionFrame = 0;
      if (currentMount !== instance || !engineHost.isConnected) return;
      const control = engineHost.querySelector(selector);
      if (control?.matches("button")) control.click();
      else control?.focus?.({ preventScroll: true });
    });
    if (instance) instance.pendingActionFrame = frame;
  }

  function focusSelector(node) {
    if (!node || node === window.document?.body) return "";
    const id = String(node.id || "");
    if (id && /^[a-z][a-z0-9_-]{0,100}$/i.test(id)) return `#${id}`;
    for (const attribute of FOCUS_ATTRIBUTES) {
      if (!node.hasAttribute?.(attribute)) continue;
      const value = String(node.getAttribute(attribute) || "").replace(/["\\]/g, "\\$&");
      return value ? `[${attribute}="${value}"]` : `[${attribute}]`;
    }
    const name = String(node.getAttribute?.("name") || "").replace(/["\\]/g, "\\$&");
    return name ? `[name="${name}"]` : "";
  }

  function captureViewState(instance = currentMount) {
    if (!instance?.engineHost || !instance.view) return;
    const active = window.document?.activeElement;
    const memory = {
      hostTop: Number(instance.engineHost.scrollTop || 0),
      hostLeft: Number(instance.engineHost.scrollLeft || 0),
      focus: instance.engineHost.contains?.(active) ? focusSelector(active) : "",
      selection: instance.engineHost.contains?.(active) && Number.isInteger(active?.selectionStart)
        ? [active.selectionStart, active.selectionEnd] : null,
      scroll: []
    };
    SCROLL_SELECTORS.forEach((selector) => {
      const node = instance.engineHost.querySelector?.(selector);
      if (node && (node.scrollTop || node.scrollLeft)) memory.scroll.push([selector, Number(node.scrollTop || 0), Number(node.scrollLeft || 0)]);
    });
    viewMemory.set(instance.view, memory);
  }

  function restoreViewState(instance = currentMount) {
    const memory = instance && viewMemory.get(instance.view);
    if (!memory || !instance?.engineHost) return;
    if (restoreFrame) (window.cancelAnimationFrame || window.clearTimeout)?.(restoreFrame);
    const schedule = window.requestAnimationFrame || window.setTimeout || ((callback) => { callback(); return 0; });
    restoreFrame = schedule(() => {
      restoreFrame = 0;
      if (!currentMount || currentMount !== instance || !instance.engineHost?.isConnected) return;
      instance.engineHost.scrollTop = memory.hostTop;
      instance.engineHost.scrollLeft = memory.hostLeft;
      memory.scroll.forEach(([selector, top, left]) => {
        const node = instance.engineHost.querySelector(selector);
        if (node) { node.scrollTop = top; node.scrollLeft = left; }
      });
      const control = memory.focus ? instance.engineHost.querySelector(memory.focus) : null;
      control?.focus?.({ preventScroll: true });
      if (control && memory.selection && typeof control.setSelectionRange === "function") {
        try { control.setSelectionRange(memory.selection[0], memory.selection[1]); } catch {}
      }
    });
  }

  function disposeEngine() {
    if (!mountedEngine) return;
    const handled = typeof mountedEngine.controller?.unmount === "function"
      ? (mountedEngine.controller.unmount(), true)
      : typeof mountedEngine.controller?.destroy === "function"
        ? (mountedEngine.controller.destroy(), true)
        : false;
    if (!handled) mountedEngine.api?.unmount?.(mountedEngine.host);
    mountedEngine = null;
  }

  function mountEngine(instance = currentMount) {
    if (!instance?.engineHost) return false;
    if (mountedEngine?.host === instance.engineHost) captureViewState(instance);
    disposeEngine();
    const meta = VIEW_META[instance.view];
    const engine = window[meta.engine];
    if (!engine?.mount || (engine.supports && !engine.supports(instance.view))) {
      fallback(instance.engineHost, instance.view, "Engine chưa được tải hoặc không hỗ trợ workspace này.");
      updateCapabilityStatus();
      return false;
    }
    try {
      instance.engineHost.replaceChildren();
      const controller = engine.mount(instance.engineHost, {
        ...instance.options,
        view: instance.view,
        onNavigate: (nextView) => { if (supports(nextView)) navigate(nextView); }
      });
      mountedEngine = { api: engine, host: instance.engineHost, controller };
      applyPendingAction(instance.engineHost, instance.view);
      restoreViewState(instance);
      updateCapabilityStatus();
      return true;
    } catch (error) {
      try { engine.unmount?.(instance.engineHost); } catch {}
      fallback(instance.engineHost, instance.view, "Engine gặp lỗi khi khởi tạo. Hãy thử nạp lại tại chỗ; dữ liệu đã lưu không bị thay đổi.");
      updateCapabilityStatus();
      return false;
    }
  }

  async function probeCapabilities(instance = currentMount) {
    if (!instance || !window.fetch) return;
    const base = String(instance.options.apiBase || "").replace(/\/$/, "");
    if (!base) { updateCapabilityStatus(); return; }
    instance.probeController?.abort?.();
    const Controller = window.AbortController;
    const controller = typeof Controller === "function" ? new Controller() : { abort() {}, signal: undefined };
    instance.probeController = controller;
    const timeout = typeof window.setTimeout === "function" ? window.setTimeout(() => controller.abort(), 6000) : 0;
    try {
      const response = await window.fetch(`${base}/api/communication/capabilities`, { credentials: "include", cache: "no-store", signal: controller.signal });
      const data = response?.ok ? await response.json().catch(() => null) : null;
      const descriptor = data?.capabilities;
      if (currentMount !== instance || !response?.ok || data?.ok === false || descriptor?.protocol !== "hh-communication-v2") return;
      instance.remoteCapabilities = {
        protocol: "hh-communication-v2",
        persistence: descriptor.persistence === "MongoDB" ? "MongoDB" : "unavailable",
        objectStorage: descriptor.objectStorage === "configured" ? "configured" : "unavailable",
        endToEndEncryption: descriptor.endToEndEncryption === true
      };
      instance.capabilitiesVerifiedAt = Date.now();
    } catch {
      if (currentMount === instance) { instance.remoteCapabilities = null; instance.capabilitiesVerifiedAt = 0; }
    } finally {
      if (timeout) window.clearTimeout?.(timeout);
      if (currentMount === instance) updateCapabilityStatus();
    }
  }

  function viewButtonMarkup(id, active, attribute = "data-comms-view") {
    const item = VIEW_META[id];
    const current = id === active;
    const capabilityLabel = capability(window[item.engine], id);
    const capabilitySource = currentCapability(id, window[item.engine]).engine === "local" ? "local" : "unavailable";
    return `<button type="button" ${attribute}="${safe(id)}" aria-current="${current ? "page" : "false"}" data-app-route="/communication/${safe(id)}"><i aria-hidden="true">${safe(item.icon)}</i><span>${safe(item.label)}</span><small data-comms-engine-capability="${safe(id)}" data-state="${safe(capabilitySource)}" title="${safe(capabilityLabel)}">${safe(capabilityLabel)}</small></button>`;
  }

  function sidebarMarkup(active) {
    return VIEW_GROUPS.map((group) => `<section class="comms-sidebar-group" data-comms-sidebar-group="${safe(group.id)}"><h2><i aria-hidden="true">${safe(group.icon)}</i><span>${safe(group.label)}</span><b>${group.views.length}</b></h2><div>${group.views.map((id) => viewButtonMarkup(id, active)).join("")}</div></section>`).join("");
  }

  function mobileNavMarkup(active) {
    const current = (id) => id === active ? "page" : "false";
    return `<button type="button" data-comms-mobile-destination="command-center" aria-label="Tổng quan" aria-current="${current("command-center")}"><i aria-hidden="true">⌂</i><span>Tổng quan</span></button>
      <button type="button" data-comms-mobile-destination="unified-inbox" aria-label="Hộp thư" aria-current="${current("unified-inbox")}"><i aria-hidden="true">▤</i><span>Hộp thư</span></button>
      <button type="button" data-comms-mobile-destination="messenger" aria-label="Tin nhắn" aria-current="${current("messenger")}"><i aria-hidden="true">◌</i><span>Tin nhắn</span></button>
      <button type="button" data-comms-mobile-destination="live-room" aria-label="Trực tiếp" aria-current="${current("live-room")}"><i aria-hidden="true">●</i><span>Trực tiếp</span></button>
      <button type="button" data-comms-mobile-destination="more" aria-label="Thêm" aria-current="false"><i aria-hidden="true">•••</i><span>Thêm</span></button>`;
  }

  function setMotionPaused(instance, paused = Boolean(window.document && window.document.hidden)) {
    if (!instance?.host) return;
    const cockpit = instance.host.querySelector?.("[data-comms-cockpit]") || instance.host;
    cockpit.dataset.commsMotionPaused = String(paused);
  }

  function syncOuterMobileNavigation(instance, compact) {
    const nav = window.document?.querySelector?.(".app-mobile-nav");
    if (!instance || !nav?.style) return;
    if (!instance.outerMobileNavStyle) {
      instance.outerMobileNavStyle = {
        value: nav.style.getPropertyValue("display"),
        priority: nav.style.getPropertyPriority("display")
      };
    }
    if (compact) nav.style.setProperty("display", "none", "important");
    else if (instance.outerMobileNavStyle.value) nav.style.setProperty("display", instance.outerMobileNavStyle.value, instance.outerMobileNavStyle.priority);
    else nav.style.removeProperty("display");
  }

  function restoreOuterMobileNavigation(instance) {
    const nav = window.document?.querySelector?.(".app-mobile-nav");
    const saved = instance?.outerMobileNavStyle;
    if (!nav?.style || !saved) return;
    if (saved.value) nav.style.setProperty("display", saved.value, saved.priority);
    else nav.style.removeProperty("display");
    instance.outerMobileNavStyle = null;
  }

  function openMobileSheet(instance, opener) {
    const sheet = instance?.host?.querySelector?.("[data-comms-mobile-sheet]");
    if (!sheet) return;
    instance.focusBeforeOpen = opener || window.document?.activeElement || null;
    sheet.hidden = false;
    instance.host.classList.add("comms-sheet-open");
    const cockpitBody = instance.host.querySelector?.(".comms-cockpit-body");
    if (cockpitBody) cockpitBody.inert = true;
    window.document?.documentElement?.classList?.add("comms-sheet-open");
    window.document?.body?.classList?.add("comms-sheet-open");
    sheet.querySelector("button[data-app-route],button[data-comms-sheet-close]")?.focus?.({ preventScroll: true });
  }

  function closeMobileSheet(instance) {
    const sheet = instance?.host?.querySelector?.("[data-comms-mobile-sheet]");
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    instance.host.classList.remove("comms-sheet-open");
    const cockpitBody = instance.host.querySelector?.(".comms-cockpit-body");
    if (cockpitBody) cockpitBody.inert = false;
    window.document?.documentElement?.classList?.remove("comms-sheet-open");
    window.document?.body?.classList?.remove("comms-sheet-open");
    const returnFocus = instance.focusBeforeOpen;
    instance.focusBeforeOpen = null;
    returnFocus?.focus?.({ preventScroll: true });
  }

  function setInspectorOpen(instance, open, opener = null) {
    const inspector = instance?.host?.querySelector?.("[data-comms-inspector]");
    if (!inspector) return;
    if (open && opener) instance.inspectorReturnFocus = opener;
    instance.inspectorOpen = Boolean(open);
    inspector.hidden = !instance.inspectorOpen;
    inspector.dataset.open = String(instance.inspectorOpen);
    inspector.classList.toggle("is-open", instance.inspectorOpen);
    const cockpit = instance.host.querySelector?.("[data-comms-cockpit]") || instance.host;
    cockpit.dataset.commsInspectorOpen = String(instance.inspectorOpen);
    instance.host.querySelector(".comms-cockpit-body")?.setAttribute("data-comms-inspector-open", String(instance.inspectorOpen));
    if (instance.inspectorOpen && opener) inspector.querySelector("button")?.focus?.({ preventScroll: true });
    else {
      const returnFocus = instance.inspectorReturnFocus;
      instance.inspectorReturnFocus = null;
      returnFocus?.focus?.({ preventScroll: true });
    }
  }

  function trapFocus(event, container) {
    if (event.key !== "Tab" || !container || container.hidden) return;
    const controls = [...container.querySelectorAll("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")].filter((node) => !node.hidden);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && window.document?.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && window.document?.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount();
    currentHost = host;
    const view = normalize(options.view || currentView);
    currentView = view;
    const meta = VIEW_META[view];
    const compactLayout = Boolean(window.matchMedia?.("(max-width: 1440px)")?.matches);
    host.innerHTML = `<section class="communication-suite" data-communication-suite data-comms-cockpit data-view="${safe(view)}" data-comms-motion-paused="${String(Boolean(window.document && window.document.hidden))}" data-comms-inspector-open="${String(!compactLayout)}">
      <header class="comms-suite-head">
        <div class="comms-suite-brand"><i>HH</i><div><small>HH COMMUNICATION OS</small><strong>${safe(meta.title)}</strong></div></div>
        <div class="comms-suite-actions">
          <button type="button" data-app-route="/communication/universal-search"><span>⌕</span>Tìm kiếm</button>
          <button type="button" data-app-route="/communication/smart-catch-up"><span>↻</span>Bắt kịp</button>
          <button type="button" data-comms-inspector-toggle aria-label="Mở bảng trạng thái"><span>◇</span>Trạng thái</button>
          <span class="comms-live-state" data-comms-realtime><i></i><span>Realtime chưa được xác nhận</span></span>
        </div>
      </header>
      <div class="comms-cockpit-body" data-comms-inspector-open="${String(!compactLayout)}">
        <nav class="comms-sidebar" data-comms-sidebar aria-label="Nhóm chức năng Giao tiếp">${sidebarMarkup(view)}</nav>
        <main class="comms-engine-host" data-comms-engine-host data-comms-scroll-owner="workspace" role="main" aria-label="${safe(meta.title)}" tabindex="-1"></main>
        <aside class="comms-inspector${compactLayout ? "" : " is-open"}" data-comms-inspector data-open="${String(!compactLayout)}" aria-label="Trạng thái và khả năng kết nối" ${compactLayout ? "hidden" : ""}>
          <header><div><small>CONNECTION EVIDENCE</small><strong>Trạng thái đã kiểm chứng</strong></div><button type="button" data-comms-inspector-close aria-label="Đóng bảng trạng thái">×</button></header>
          <div class="comms-capability-strip" data-comms-capabilities role="status" aria-live="polite">
            <span data-comms-capability="engine" data-capability-source="unverified">Engine đang kiểm tra</span><span data-comms-capability="adapter" data-capability-source="unverified">Adapter chưa xác nhận</span>
            <span data-comms-capability="realtime" data-capability-source="unverified">Realtime chưa xác nhận</span><span data-comms-capability="provider" data-capability-source="unverified">Provider chưa xác nhận</span>
            <span data-comms-capability="backend" data-capability-source="unverified">Backend chưa xác minh</span><span data-comms-capability="persistence" data-capability-source="unverified">Lưu trữ server chưa xác minh</span>
            <span data-comms-capability="objectStorage" data-capability-source="unverified">Object storage chưa xác minh</span><span data-comms-capability="e2ee" data-capability-source="unknown">E2EE chưa xác minh</span>
          </div>
          <p>Chỉ trạng thái có phản hồi hoặc xác nhận trực tiếp mới được hiển thị là đang hoạt động.</p>
        </aside>
      </div>
      <footer class="comms-status-bar" data-comms-status-bar aria-live="polite"><span data-state="local">Local-first</span><span data-comms-status="realtime" data-state="unverified">Realtime cần xác nhận</span><span data-comms-status="provider" data-state="unverified">Provider cần xác nhận</span><b>${safe(meta.label)}</b></footer>
      <nav class="comms-mobile-nav" data-comms-mobile-nav aria-label="Điều hướng Giao tiếp trên điện thoại">${mobileNavMarkup(view)}</nav>
      <aside class="comms-mobile-sheet" data-comms-mobile-sheet role="dialog" aria-modal="true" aria-label="Tất cả chức năng Giao tiếp" hidden>
        <header><div><small>HH COMMUNICATION</small><strong>Tất cả chức năng</strong></div><button type="button" data-comms-sheet-close data-comms-return-focus aria-label="Đóng danh sách chức năng">×</button></header>
        <nav aria-label="Chức năng Giao tiếp bổ sung">${VIEW_GROUPS.map((group) => `<section><h2>${safe(group.label)}</h2>${group.views.map((id) => viewButtonMarkup(id, view, "data-comms-sheet-view")).join("")}</section>`).join("")}</nav>
      </aside>
    </section>`;
    const engineHost = host.querySelector("[data-comms-engine-host]");
    currentMount = { host, engineHost, options: { ...options }, view, socketOverride: undefined, remoteCapabilities: null, capabilitiesVerifiedAt: 0, probeController: null, pendingActionFrame: 0, focusBeforeOpen: null, inspectorReturnFocus: null, inspectorOpen: !compactLayout, outerMobileNavStyle: null };
    listen(host, "click", (event) => {
      const retry = event.target?.closest?.("[data-comms-retry]");
      if (retry) { retry.disabled = true; mountEngine(currentMount); return; }
      const mobile = event.target?.closest?.("[data-comms-mobile-destination]");
      if (mobile) {
        const destination = mobile.dataset.commsMobileDestination;
        if (destination === "more") openMobileSheet(currentMount, mobile);
        else if (supports(destination)) navigate(destination);
        return;
      }
      if (event.target?.closest?.("[data-comms-sheet-close]")) { closeMobileSheet(currentMount); return; }
      if (event.target?.closest?.("[data-comms-inspector-close]")) { setInspectorOpen(currentMount, false); return; }
      const inspectorToggle = event.target?.closest?.("[data-comms-inspector-toggle]");
      if (inspectorToggle) setInspectorOpen(currentMount, !currentMount.inspectorOpen, inspectorToggle);
    });
    listen(host, "keydown", (event) => {
      const sheet = host.querySelector("[data-comms-mobile-sheet]");
      if (event.key === "Escape") { if (!sheet?.hidden) closeMobileSheet(currentMount); else if (currentMount?.inspectorOpen) setInspectorOpen(currentMount, false); return; }
      trapFocus(event, sheet);
    });
    listen(window.document, "visibilitychange", () => setMotionPaused(currentMount, Boolean(window.document && window.document.hidden)));
    const layoutQuery = window.matchMedia?.("(max-width: 1440px)");
    if (layoutQuery) listen(layoutQuery, "change", (event) => setInspectorOpen(currentMount, !event.matches));
    const mobileLayoutQuery = window.matchMedia?.("(max-width: 980px)");
    syncOuterMobileNavigation(currentMount, Boolean(mobileLayoutQuery?.matches));
    if (mobileLayoutQuery) listen(mobileLayoutQuery, "change", (event) => syncOuterMobileNavigation(currentMount, Boolean(event.matches)));
    bindSuiteEvents();
    updateRealtimeStatus();
    mountEngine(currentMount);
    probeCapabilities(currentMount);
    host.dispatchEvent(new CustomEvent("hh:communication:view", { bubbles: true, detail: { view } }));
    return Object.freeze({
      view,
      retry: () => mountEngine(currentMount),
      refreshCapabilities: () => probeCapabilities(currentMount),
      getCapabilities: () => currentCapability(view, window[meta.engine]),
      unmount
    });
  }

  function unmount() {
    captureViewState();
    closeMobileSheet(currentMount);
    restoreOuterMobileNavigation(currentMount);
    window.document?.documentElement?.classList?.remove("comms-sheet-open");
    window.document?.body?.classList?.remove("comms-sheet-open");
    currentMount?.probeController?.abort?.();
    if (currentMount?.pendingActionFrame) (window.cancelAnimationFrame || window.clearTimeout)?.(currentMount.pendingActionFrame);
    if (restoreFrame) (window.cancelAnimationFrame || window.clearTimeout)?.(restoreFrame);
    restoreFrame = 0;
    disposeEngine();
    if (currentHost) currentHost.replaceChildren();
    suiteListeners.forEach(([target, name, handler]) => target?.removeEventListener?.(name, handler));
    suiteListeners = [];
    currentHost = null;
    currentMount = null;
  }

  window.HHCommunicationSuite = Object.freeze({
    mount, unmount, supports, realtimeConnected,
    capabilityState, resolveCapability: capabilityState,
    views: VIEW_META, viewGroups: VIEW_GROUPS, mobileViews: MOBILE_VIEWS
  });
})();
