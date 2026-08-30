(function galaxyWebDesktopBootstrap(global, factory) {
  "use strict";

  var api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHGalaxyWebDesktop = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function galaxyWebDesktopFactory(global) {
  "use strict";

  var VERSION = "1.0.0";
  var ROUTE = "/system/desktop";
  var STORAGE_KEY = "hh.galaxy.web-desktop.v1";
  var NOTE_KEY = "hh.galaxy.web-desktop.note.v1";
  var MAX_WINDOWS = 3;
  var instances = new WeakMap();
  var mountedRoots = new Set();
  var APPS = Object.freeze([
    { id: "ai", icon: "AI", title: "HH AI Copilot", subtitle: "Trợ lý và lịch sử hội thoại", route: "/chat-ai", accent: "#b35dff" },
    { id: "code", icon: "</>", title: "Code Nebula", subtitle: "Code, preview và kiểm thử", route: "/dev-tools/code-nebula", accent: "#35d7ff" },
    { id: "music", icon: "♫", title: "Music Planet", subtitle: "Thư viện và xưởng âm thanh", route: "/music-ai", accent: "#e55dff" },
    { id: "projects", icon: "▣", title: "Project Manager", subtitle: "Dự án, task và milestone", route: "/work/projects-tasks", accent: "#ffad48" },
    { id: "notes", icon: "▤", title: "Sticky Notes", subtitle: "Ghi chú cục bộ trên thiết bị", route: "/home/dashboard", accent: "#5e9cff" },
    { id: "system", icon: "⌁", title: "System Monitor", subtitle: "Số liệu trình duyệt có thể đo", route: "/system", accent: "#54e1a6" }
  ]);

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; } }

  function cleanRoute(value) {
    var route = String(value || "").replace(/^#/, "").split("?")[0].split(";")[0].trim();
    if (!route) return ROUTE;
    route = route.charAt(0) === "/" ? route : "/" + route;
    return route.length > 1 ? route.replace(/\/+$/, "") : route;
  }

  function canHandle(route) { return cleanRoute(route) === ROUTE; }

  function safeRead() {
    try {
      var value = JSON.parse(global.localStorage && global.localStorage.getItem(STORAGE_KEY) || "{}");
      var windows = Array.isArray(value.windows) ? value.windows.filter(function (id) { return APPS.some(function (app) { return app.id === id; }); }).slice(0, MAX_WINDOWS) : [];
      var positions = value.positions && typeof value.positions === "object" ? value.positions : {};
      return { enabled: value.enabled === true, windows: windows, activeId: windows.includes(value.activeId) ? value.activeId : windows.at(-1) || "", minimized: Array.isArray(value.minimized) ? value.minimized.filter(function (id) { return windows.includes(id); }) : [], positions: positions };
    } catch (error) { return { enabled: false, windows: [], activeId: "", minimized: [], positions: {} }; }
  }

  function save(runtime) {
    try { global.localStorage && global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, enabled: runtime.enabled, windows: runtime.windows, activeId: runtime.activeId, minimized: runtime.minimized, positions: runtime.positions, updatedAt: new Date().toISOString() })); }
    catch (error) { runtime.notice = "Trình duyệt không cho phép lưu bố cục."; }
  }

  function readNote() { try { return String(global.localStorage && global.localStorage.getItem(NOTE_KEY) || "").slice(0, 5000); } catch (error) { return ""; } }
  function writeNote(value) { try { global.localStorage && global.localStorage.setItem(NOTE_KEY, String(value || "").slice(0, 5000)); return true; } catch (error) { return false; } }

  function appOf(id) { return APPS.find(function (app) { return app.id === id; }); }

  function navigate(runtime, route) {
    route = cleanRoute(route);
    if (!route || route.indexOf("//") === 0) return;
    if (typeof runtime.options.navigate === "function") runtime.options.navigate(route);
    else if (global.location) global.location.hash = "#" + route;
  }

  function timeMarkup() {
    var now = new Date();
    return '<time data-gwd-clock datetime="' + now.toISOString() + '"><strong>' + new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(now) + '</strong><small>' + new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(now) + "</small></time>";
  }

  function statusPill(runtime) {
    return '<span class="gwd-governor" data-state="' + (runtime.paused ? "paused" : "ready") + '"><i></i>' + (runtime.paused ? "Tab nền · preview tạm dừng" : "Resource Governor hoạt động") + "</span>";
  }

  function consentMarkup() {
    return '<section class="gwd-consent"><div class="gwd-consent-planet" aria-hidden="true"><i></i><i></i></div><article><small>OPT-IN · RESOURCE GOVERNED</small><h1>Bật HH Web Desktop?</h1><p>Không gian đa cửa sổ này chỉ tạo launcher nhẹ. Engine đầy đủ chỉ chạy sau khi bạn chọn “Đi tới ứng dụng”.</p><ul><li>Tối đa 3 cửa sổ launcher cùng lúc</li><li>Không tự phát âm thanh, video hoặc mở AudioContext</li><li>Không hiển thị CPU, RAM hay trạng thái online giả</li><li>Bố cục chỉ lưu trên thiết bị này</li></ul><button type="button" data-gwd-action="enable">Bật Web Desktop</button></article></section>';
  }

  function systemRows(runtime) {
    var evidence = runtime.evidence || {};
    var rows = [];
    if (evidence.heap) rows.push(["JS Heap của tab", evidence.heap]);
    if (evidence.storage) rows.push(["Origin Storage", evidence.storage]);
    if (evidence.connection) rows.push(["Kết nối trình duyệt", evidence.connection]);
    if (evidence.battery) rows.push(["Pin", evidence.battery]);
    rows.push(["Service Worker", evidence.serviceWorker || "Đang kiểm tra"]);
    return '<div class="gwd-system-list">' + rows.map(function (row) { return '<p><span>' + escapeHtml(row[0]) + '</span><strong>' + escapeHtml(row[1]) + '</strong></p>'; }).join("") + '</div><small class="gwd-evidence-note">Chỉ số thuộc tab/origin này, không phải CPU hoặc RAM toàn máy.</small>';
  }

  function windowBody(runtime, app) {
    if (app.id === "notes") return '<textarea data-gwd-note maxlength="5000" placeholder="Viết ghi chú cục bộ…">' + escapeHtml(readNote()) + '</textarea><small data-gwd-note-state>Tự lưu trên thiết bị</small>';
    if (app.id === "system") return systemRows(runtime);
    if (app.id === "ai") return '<div class="gwd-orb" aria-hidden="true"><i></i></div><h3>HH AI Copilot</h3><p>Launcher không khởi tạo provider hay phiên chat cho tới khi bạn mở ứng dụng.</p>';
    if (app.id === "code") return '<pre aria-label="Preview launcher"><code>HH Web Desktop\n→ Code Nebula\n→ Engine chạy tại route riêng</code></pre><p>Preview không thực thi mã.</p>';
    if (app.id === "music") return '<div class="gwd-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><h3>Music Planet</h3><p>Không phát âm thanh trước tương tác.</p>';
    if (app.id === "projects") {
      var count = Array.isArray(runtime.options.projects) ? runtime.options.projects.length : null;
      return '<div class="gwd-project-state"><span>▣</span><strong>' + (count == null ? "Chưa có adapter Project" : count + " dự án được adapter cung cấp") + '</strong><p>' + (count == null ? "Mở Project Manager để tải dữ liệu dự án thật." : "Danh sách đầy đủ nằm trong Projects & Tasks.") + "</p></div>";
    }
    return '<p>Launcher sẵn sàng.</p>';
  }

  function windowMarkup(runtime, id, index) {
    var app = appOf(id);
    if (!app) return "";
    var minimized = runtime.minimized.includes(id);
    var active = runtime.activeId === id;
    var stored = runtime.positions[id] || {};
    var defaults = [[3, 4], [36, 3], [68, 47]];
    var position = defaults[index] || [10 + index * 12, 9 + index * 9];
    var x = Number.isFinite(Number(stored.x)) ? Math.max(0, Math.min(72, Number(stored.x))) : position[0];
    var y = Number.isFinite(Number(stored.y)) ? Math.max(0, Math.min(62, Number(stored.y))) : position[1];
    return '<article class="gwd-window' + (active ? " is-active" : "") + (minimized ? " is-minimized" : "") + '" data-gwd-window="' + app.id + '" style="--app:' + app.accent + ";--x:" + x + ";--y:" + y + ';--z:' + (active ? 8 : index + 2) + '" tabindex="0"><header data-gwd-drag-handle><div><i>' + escapeHtml(app.icon) + '</i><span><strong>' + escapeHtml(app.title) + '</strong><small>Launcher nhẹ</small></span></div><nav><button type="button" data-gwd-action="minimize" data-gwd-id="' + app.id + '" aria-label="' + (minimized ? "Khôi phục" : "Thu nhỏ") + '">−</button><button type="button" data-gwd-action="close" data-gwd-id="' + app.id + '" aria-label="Đóng">×</button></nav></header><section class="gwd-window-body">' + windowBody(runtime, app) + '</section><footer><span>' + escapeHtml(app.subtitle) + '</span><button type="button" data-gwd-route="' + app.route + '">Đi tới ứng dụng →</button></footer></article>';
  }

  function dockMarkup(runtime) {
    return '<nav class="gwd-dock" aria-label="Ứng dụng Web Desktop"><button class="gwd-launcher" type="button" data-gwd-action="launcher" aria-label="Mở danh sách ứng dụng"><i></i><i></i><i></i><i></i></button>' + APPS.map(function (app) {
      return '<button type="button" data-gwd-app="' + app.id + '" style="--app:' + app.accent + '" aria-pressed="' + String(runtime.windows.includes(app.id)) + '"><span>' + escapeHtml(app.icon) + '</span><small>' + escapeHtml(app.title) + "</small></button>";
    }).join("") + '<i></i>' + timeMarkup() + "</nav>";
  }

  function launcherMarkup(runtime) {
    if (!runtime.launcherOpen) return "";
    return '<aside class="gwd-launcher-panel" data-gwd-launcher-panel><header><div><small>HH APPLICATIONS</small><strong>Mở launcher nhẹ</strong></div><button type="button" data-gwd-action="launcher-close" aria-label="Đóng danh sách ứng dụng">×</button></header><div>' + APPS.map(function (app) {
      return '<button type="button" data-gwd-app="' + app.id + '" style="--app:' + app.accent + '"><i>' + escapeHtml(app.icon) + '</i><span><strong>' + escapeHtml(app.title) + '</strong><small>' + escapeHtml(app.subtitle) + '</small></span>' + (runtime.windows.includes(app.id) ? '<b>Đang mở</b>' : '<b>Mở</b>') + '</button>';
    }).join("") + '</div><footer><span>' + runtime.windows.length + ' / ' + MAX_WINDOWS + ' cửa sổ</span><small>Engine đầy đủ chỉ chạy tại route ứng dụng.</small></footer></aside>';
  }

  function workspaceMarkup(runtime) {
    var windows = runtime.windows.map(function (id, index) { return windowMarkup(runtime, id, index); }).join("");
    return '<section class="gwd-desktop" data-gwd-desktop data-gwd-paused="' + String(runtime.paused) + '"><div class="gwd-wallpaper" aria-hidden="true"><i></i><i></i><i></i></div><header class="gwd-topbar"><a href="#/home"><span>HH</span><strong>HOANG8.COM</strong><small>WEB DESKTOP</small></a><label><span>⌕</span><input type="search" data-gwd-search placeholder="Tìm ứng dụng trong dock…" aria-label="Tìm ứng dụng"></label><div>' + statusPill(runtime) + '<button type="button" data-gwd-action="disable">Tắt Desktop</button></div></header><main class="gwd-stage" data-gwd-stage>' + (windows || '<section class="gwd-empty"><div class="gwd-orb"><i></i></div><strong>Chọn ứng dụng từ dock</strong><p>Launcher nhẹ giúp sắp xếp công việc mà không chạy nhiều engine cùng lúc.</p><small>0 / ' + MAX_WINDOWS + " cửa sổ đang mở</small></section>") + '</main>' + launcherMarkup(runtime) + dockMarkup(runtime) + '<p class="gwd-notice" data-gwd-notice aria-live="polite">' + escapeHtml(runtime.notice || "") + "</p></section>";
  }

  function rootMarkup(runtime) {
    return '<section class="gwd-root" data-gwd-root data-gwd-enabled="' + String(runtime.enabled) + '">' + (runtime.enabled ? workspaceMarkup(runtime) : consentMarkup()) + "</section>";
  }

  function render(runtime, focusSelector) {
    if (!runtime.mounted) return;
    runtime.root.innerHTML = rootMarkup(runtime);
    if (focusSelector) global.requestAnimationFrame?.(function () { runtime.root.querySelector(focusSelector)?.focus({ preventScroll: true }); });
  }

  function announce(runtime, message) {
    runtime.notice = String(message || "");
    var node = runtime.root.querySelector("[data-gwd-notice]");
    if (node) node.textContent = runtime.notice;
  }

  function updateSystemEvidence(runtime) {
    if (!runtime.mounted || !runtime.windows.includes("system")) return;
    var body = runtime.root.querySelector('[data-gwd-window="system"] .gwd-window-body');
    if (!body) return;
    var scrollTop = body.scrollTop;
    body.innerHTML = systemRows(runtime);
    body.scrollTop = scrollTop;
  }

  function updateVisibilityState(runtime) {
    if (!runtime.mounted || !runtime.enabled) return;
    var desktop = runtime.root.querySelector("[data-gwd-desktop]");
    if (desktop) desktop.dataset.gwdPaused = String(runtime.paused);
    var governor = runtime.root.querySelector(".gwd-governor");
    if (governor) governor.outerHTML = statusPill(runtime);
  }

  function openApp(runtime, id) {
    if (!appOf(id)) return;
    if (runtime.windows.includes(id)) {
      runtime.activeId = id;
      runtime.minimized = runtime.minimized.filter(function (entry) { return entry !== id; });
      runtime.launcherOpen = false; save(runtime); render(runtime, '[data-gwd-window="' + id + '"]'); return;
    }
    if (runtime.windows.length >= MAX_WINDOWS) { announce(runtime, "Đã đạt giới hạn 3 launcher. Hãy đóng một cửa sổ trước khi mở ứng dụng khác."); return; }
    runtime.windows.push(id); runtime.activeId = id; runtime.minimized = runtime.minimized.filter(function (entry) { return entry !== id; }); runtime.launcherOpen = false;
    save(runtime); render(runtime, '[data-gwd-window="' + id + '"]');
  }

  function closeApp(runtime, id) {
    runtime.windows = runtime.windows.filter(function (entry) { return entry !== id; });
    runtime.minimized = runtime.minimized.filter(function (entry) { return entry !== id; });
    delete runtime.positions[id];
    runtime.activeId = runtime.windows.at(-1) || "";
    save(runtime); render(runtime, "[data-gwd-app]");
  }

  function formatBytes(value) {
    var bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Không khả dụng";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var unit = 0;
    while (bytes >= 1024 && unit < units.length - 1) { bytes /= 1024; unit += 1; }
    return bytes.toFixed(bytes >= 10 || unit === 0 ? 0 : 1) + " " + units[unit];
  }

  async function collectEvidence(runtime) {
    var evidence = {};
    var memory = global.performance && global.performance.memory;
    if (memory && Number.isFinite(memory.usedJSHeapSize)) evidence.heap = formatBytes(memory.usedJSHeapSize) + (Number.isFinite(memory.jsHeapSizeLimit) ? " / " + formatBytes(memory.jsHeapSizeLimit) : "");
    try {
      var estimate = await global.navigator?.storage?.estimate?.();
      if (estimate) evidence.storage = formatBytes(estimate.usage) + (estimate.quota ? " / " + formatBytes(estimate.quota) : "");
    } catch (error) { /* unsupported */ }
    var connection = global.navigator?.connection || global.navigator?.mozConnection || global.navigator?.webkitConnection;
    if (connection) evidence.connection = [connection.effectiveType, Number.isFinite(connection.downlink) ? connection.downlink + " Mbps do trình duyệt ước lượng" : ""].filter(Boolean).join(" · ");
    try {
      var battery = await global.navigator?.getBattery?.();
      if (battery) evidence.battery = Math.round(battery.level * 100) + "%" + (battery.charging ? " · đang sạc" : "");
    } catch (error) { /* unsupported */ }
    evidence.serviceWorker = global.navigator?.serviceWorker?.controller ? "Đang điều khiển trang" : ("serviceWorker" in (global.navigator || {}) ? "Chưa điều khiển trang" : "Không hỗ trợ");
    runtime.evidence = evidence;
    updateSystemEvidence(runtime);
  }

  function startDrag(runtime, event, windowNode) {
    if (event.button != null && event.button !== 0) return;
    if (global.matchMedia && global.matchMedia("(max-width: 900px)").matches) return;
    var stage = runtime.root.querySelector("[data-gwd-stage]");
    if (!stage || !windowNode) return;
    var id = windowNode.dataset.gwdWindow;
    var stageRect = stage.getBoundingClientRect();
    var rect = windowNode.getBoundingClientRect();
    var startX = event.clientX; var startY = event.clientY;
    var originX = rect.left - stageRect.left; var originY = rect.top - stageRect.top;
    windowNode.setPointerCapture?.(event.pointerId);
    function move(moveEvent) {
      var x = Math.max(0, Math.min(stageRect.width - rect.width, originX + moveEvent.clientX - startX));
      var y = Math.max(0, Math.min(stageRect.height - rect.height, originY + moveEvent.clientY - startY));
      runtime.positions[id] = { x: stageRect.width ? x / stageRect.width * 100 : 0, y: stageRect.height ? y / stageRect.height * 100 : 0 };
      windowNode.style.setProperty("--x", runtime.positions[id].x); windowNode.style.setProperty("--y", runtime.positions[id].y);
    }
    function up(upEvent) { windowNode.releasePointerCapture?.(upEvent.pointerId); windowNode.removeEventListener("pointermove", move); windowNode.removeEventListener("pointerup", up); windowNode.removeEventListener("pointercancel", up); save(runtime); }
    windowNode.addEventListener("pointermove", move); windowNode.addEventListener("pointerup", up); windowNode.addEventListener("pointercancel", up);
  }

  function bind(runtime) {
    var signal = runtime.controller && runtime.controller.signal;
    var options = signal ? { signal: signal } : undefined;
    runtime.root.addEventListener("click", function (event) {
      var route = event.target.closest("[data-gwd-route]"); if (route) { navigate(runtime, route.dataset.gwdRoute); return; }
      var app = event.target.closest("[data-gwd-app]"); if (app) { openApp(runtime, app.dataset.gwdApp); return; }
      var action = event.target.closest("[data-gwd-action]"); if (!action) return;
      var id = action.dataset.gwdId;
      if (action.dataset.gwdAction === "enable") { runtime.enabled = true; save(runtime); render(runtime, "[data-gwd-app]"); collectEvidence(runtime); return; }
      if (action.dataset.gwdAction === "launcher") { runtime.launcherOpen = !runtime.launcherOpen; render(runtime, runtime.launcherOpen ? "[data-gwd-launcher-panel] button" : ".gwd-launcher"); return; }
      if (action.dataset.gwdAction === "launcher-close") { runtime.launcherOpen = false; render(runtime, ".gwd-launcher"); return; }
      if (action.dataset.gwdAction === "disable") {
        var approved = typeof global.confirm !== "function" || global.confirm("Tắt Web Desktop? Bố cục launcher sẽ được giữ lại để bạn có thể bật lại sau.");
        if (!approved) return;
        runtime.enabled = false; save(runtime); render(runtime, '[data-gwd-action="enable"]'); return;
      }
      if (action.dataset.gwdAction === "close") { closeApp(runtime, id); return; }
      if (action.dataset.gwdAction === "minimize") {
        runtime.minimized = runtime.minimized.includes(id) ? runtime.minimized.filter(function (entry) { return entry !== id; }) : runtime.minimized.concat(id);
        runtime.activeId = id; save(runtime); render(runtime, '[data-gwd-window="' + id + '"]'); return;
      }
    }, options);
    runtime.root.addEventListener("pointerdown", function (event) {
      var node = event.target.closest("[data-gwd-window]");
      if (!node) return;
      var id = node.dataset.gwdWindow;
      if (runtime.activeId !== id) { runtime.activeId = id; save(runtime); runtime.root.querySelectorAll("[data-gwd-window]").forEach(function (entry) { entry.classList.toggle("is-active", entry === node); entry.style.setProperty("--z", entry === node ? 8 : 2); }); }
      if (event.target.closest("[data-gwd-drag-handle]") && !event.target.closest("button")) startDrag(runtime, event, node);
    }, options);
    runtime.root.addEventListener("input", function (event) {
      if (event.target.matches("[data-gwd-note]")) { var saved = writeNote(event.target.value); var state = runtime.root.querySelector("[data-gwd-note-state]"); if (state) state.textContent = saved ? "Đã lưu trên thiết bị" : "Không thể lưu trên thiết bị"; return; }
      if (event.target.matches("[data-gwd-search]")) {
        var query = event.target.value.trim().toLocaleLowerCase("vi-VN");
        var matches = 0;
        runtime.root.querySelectorAll("[data-gwd-app]").forEach(function (button) {
          button.hidden = Boolean(query) && !button.textContent.toLocaleLowerCase("vi-VN").includes(query);
          if (!button.hidden) matches += 1;
        });
        announce(runtime, query ? (matches ? "Tìm thấy " + matches + " lối mở ứng dụng phù hợp." : "Không tìm thấy ứng dụng phù hợp.") : "");
      }
    }, options);
    runtime.root.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && runtime.launcherOpen) { runtime.launcherOpen = false; render(runtime, ".gwd-launcher"); }
    }, options);
    global.document?.addEventListener("visibilitychange", function () {
      runtime.paused = Boolean(global.document.hidden);
      updateVisibilityState(runtime);
    }, options);
  }

  function tickClock(runtime) {
    var old = runtime.root.querySelector("[data-gwd-clock]");
    if (!old) return;
    var holder = global.document?.createElement?.("div");
    if (!holder) return;
    holder.innerHTML = timeMarkup(); old.replaceWith(holder.firstElementChild);
  }

  function mount(root, options) {
    options = options || {};
    if (!root || typeof root.querySelector !== "function" || !canHandle(options.route || ROUTE)) return false;
    unmount(root);
    var stored = safeRead();
    var runtime = { root: root, options: options, route: ROUTE, enabled: stored.enabled, windows: stored.windows, activeId: stored.activeId, minimized: stored.minimized, positions: stored.positions, launcherOpen: false, paused: Boolean(global.document && global.document.hidden), evidence: {}, notice: "", mounted: true, mountedAt: new Date().toISOString(), controller: typeof AbortController === "function" ? new AbortController() : null, clockTimer: 0 };
    instances.set(root, runtime); mountedRoots.add(root); root.dataset.gwdMounted = "true";
    root.innerHTML = rootMarkup(runtime); bind(runtime);
    runtime.clockTimer = global.setInterval ? global.setInterval(function () { if (runtime.mounted && !runtime.paused) tickClock(runtime); }, 30000) : 0;
    if (runtime.enabled) collectEvidence(runtime);
    return true;
  }

  function unmount(root) {
    Array.from(mountedRoots).forEach(function (entry) {
      if (root && root !== entry) return;
      var runtime = instances.get(entry); if (!runtime) return;
      runtime.mounted = false; runtime.controller?.abort(); if (runtime.clockTimer) global.clearInterval?.(runtime.clockTimer);
      delete entry.dataset.gwdMounted; entry.replaceChildren(); instances.delete(entry); mountedRoots.delete(entry);
    });
  }

  function stateOf(runtime) { return { version: VERSION, route: ROUTE, mounted: runtime.mounted, enabled: runtime.enabled, windowCount: runtime.windows.length, windows: runtime.windows.slice(), activeId: runtime.activeId, launcherOpen: runtime.launcherOpen, paused: runtime.paused, evidence: clone(runtime.evidence), mountedAt: runtime.mountedAt }; }
  function getState(root) { if (root) { var runtime = instances.get(root); return runtime ? stateOf(runtime) : null; } return Array.from(mountedRoots).map(function (entry) { return stateOf(instances.get(entry)); }); }

  return Object.freeze({ VERSION: VERSION, route: ROUTE, MAX_WINDOWS: MAX_WINDOWS, apps: APPS, canHandle: canHandle, mount: mount, unmount: unmount, getState: getState });
});
