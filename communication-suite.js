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
  let mountedEngine = null;
  let currentHost = null;
  let suiteListeners = [];

  const safe = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[character]));

  function normalize(view) {
    const candidate = String(view || "command-center").toLowerCase();
    return VIEW_META[candidate] ? candidate : "command-center";
  }

  function supports(view) {
    return Boolean(VIEW_META[String(view || "command-center").toLowerCase()]);
  }

  function capability(engine) {
    if (engine?.supports || engine?.mount) return "Sẵn sàng";
    return "Đang nạp";
  }

  function realtimeConnected(socket = window.HHRealtimeSocket) {
    return socket?.connected === true;
  }

  function updateRealtimeStatus(socket = window.HHRealtimeSocket) {
    const target = currentHost?.querySelector?.("[data-comms-realtime]");
    if (!target) return;
    const connected = realtimeConnected(socket);
    target.classList.toggle("is-connected", connected);
    target.querySelector("span").textContent = connected ? "Realtime đã được socket xác nhận" : "Realtime chưa được xác nhận";
  }

  function fallback(host, view) {
    const meta = VIEW_META[view];
    host.innerHTML = `<section class="comms-fallback" role="status">
      <span>${safe(meta.icon)}</span><div><small>COMMUNICATION ENGINE</small><h3>${safe(meta.title)}</h3>
      <p>Workspace đang được nạp. Hãy thử lại sau vài giây; dữ liệu hiện tại không bị mất.</p></div>
      <button type="button" data-comms-retry>Thử lại</button>
    </section>`;
    host.querySelector("[data-comms-retry]")?.addEventListener("click", () => location.reload());
  }

  function rememberPending(action, payload = {}) {
    try { sessionStorage.setItem("hh.communication.pending-action.v1", JSON.stringify({ action, payload, createdAt: Date.now() })); } catch {}
  }

  function navigate(view, action = "", payload = {}) {
    if (action) rememberPending(action, payload);
    location.hash = view === "community" ? "#/communication/community" : `#/communication/${view}`;
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
      if (route.startsWith("/")) location.hash = `#${route}`;
      else if (supports(view)) navigate(view, "jump", event.detail || {});
    };
    const onRealtimeReady = (event) => updateRealtimeStatus(event.detail?.socket);
    const onRealtimeOffline = () => updateRealtimeStatus(null);
    [["hh:communication:navigate", onNavigate], ["hh:communication:action", onAction], ["hh:communication:jump", onJump], ["hh:realtime-ready", onRealtimeReady], ["hh:realtime-offline", onRealtimeOffline]].forEach(([name, handler]) => {
      window.addEventListener(name, handler);
      suiteListeners.push([name, handler]);
    });
  }

  function applyPendingAction(engineHost, view) {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("hh.communication.pending-action.v1") || "null"); } catch {}
    if (!pending || Date.now() - Number(pending.createdAt || 0) > 15_000) return;
    const selectors = view === "messenger" ? {
      group: "[data-hmn-new-group]",
      poll: '[data-hmn-tool="poll"]',
      message: "[data-hmn-input]",
      conversation: "[data-hmn-input]"
    } : {};
    const selector = selectors[pending.action];
    if (!selector) return;
    try { sessionStorage.removeItem("hh.communication.pending-action.v1"); } catch {}
    requestAnimationFrame(() => {
      const control = engineHost.querySelector(selector);
      if (control?.matches("button")) control.click();
      else control?.focus?.({ preventScroll: false });
    });
  }

  function mount(host, options = {}) {
    if (!host) return;
    unmount();
    currentHost = host;
    bindSuiteEvents();
    const view = normalize(options.view);
    const meta = VIEW_META[view];
    const engine = window[meta.engine];
    host.innerHTML = `<section class="communication-suite" data-communication-suite data-view="${safe(view)}">
      <header class="comms-suite-head">
        <div class="comms-suite-brand"><i>HH</i><div><small>HH COMMUNICATION OS</small><strong>${safe(meta.title)}</strong></div></div>
        <nav aria-label="Workspace giao tiếp chính">${PRIMARY_VIEWS.map((id) => {
          const item = VIEW_META[id];
          return `<button type="button" data-app-route="/communication/${id}" ${id === view ? 'aria-current="page"' : ""}><i>${safe(item.icon)}</i><span>${safe(item.label)}</span><small>${safe(capability(window[item.engine]))}</small></button>`;
        }).join("")}</nav>
        <div class="comms-suite-actions">
          <button type="button" data-app-route="/communication/smart-catch-up"><span>↻</span>Bắt kịp</button>
          <button type="button" data-app-route="/communication/moderation"><span>◇</span>An toàn</button>
          <span class="comms-live-state" data-comms-realtime><i></i><span>Realtime chưa được xác nhận</span></span>
        </div>
      </header>
      <div class="comms-engine-host" data-comms-engine-host></div>
    </section>`;
    const engineHost = host.querySelector("[data-comms-engine-host]");
    updateRealtimeStatus();
    if (engine?.mount && (!engine.supports || engine.supports(view))) {
      const controller = engine.mount(engineHost, {
        ...options,
        view,
        onNavigate: (nextView) => { if (supports(nextView)) location.hash = `#/communication/${nextView}`; }
      });
      mountedEngine = { api: engine, host: engineHost, controller };
      applyPendingAction(engineHost, view);
    } else fallback(engineHost, view);
    host.dispatchEvent(new CustomEvent("hh:communication:view", { bubbles: true, detail: { view } }));
  }

  function unmount() {
    if (mountedEngine) {
      const handled = typeof mountedEngine.controller?.unmount === "function"
        ? (mountedEngine.controller.unmount(), true)
        : typeof mountedEngine.controller?.destroy === "function"
          ? (mountedEngine.controller.destroy(), true)
          : false;
      if (!handled) mountedEngine.api?.unmount?.(mountedEngine.host);
    }
    mountedEngine = null;
    if (currentHost) currentHost.replaceChildren();
    suiteListeners.forEach(([name, handler]) => window.removeEventListener(name, handler));
    suiteListeners = [];
    currentHost = null;
  }

  window.HHCommunicationSuite = Object.freeze({ mount, unmount, supports, realtimeConnected, views: VIEW_META });
})();
