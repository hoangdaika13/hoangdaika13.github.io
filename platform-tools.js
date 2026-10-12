(() => {
  "use strict";

  const DB_NAME = "hh-platform-tools";
  const DB_VERSION = 1;
  const STORE_NAMES = ["history", "favorites", "settings", "notifications", "imports"];
  // The old unscoped database is retained, never automatically attributed to an account.
  const memory = new Map();
  const descriptions = {
    "global-search": "Tìm trang, công cụ và lịch sử của riêng bạn; không đọc nội dung biểu mẫu.",
    "command-palette": "Bộ lệnh có thể tìm bằng bàn phím, điều hướng rõ ràng trong HH Platform.",
    "dark-light-auto": "Xem trước sáng/tối độc lập; chỉ thay đổi website khi bạn chọn Áp dụng.",
    "theme-switcher": "Phối màu, cỡ chữ và tương phản trong vùng xem trước trước khi lưu.",
    "realtime-notifications": "Thông báo cục bộ cập nhật giữa các tab cùng tài khoản; không giả lập thông báo máy chủ.",
    "loading-skeleton": "Thử các mẫu tải nội dung trong sandbox, không che hoặc khóa website.",
    "page-progress": "Đọc phần trăm cuộn thật hoặc thử mẫu tiến trình, không giả báo tải API.",
    "fps-monitor": "Đo tốc độ khung hình thực, frame time và tác vụ dài trên thiết bị này.",
    "history-manager": "Tìm, mở lại, xuất hoặc xóa lịch sử thao tác All Tools của tài khoản hiện tại.",
    "favorite-manager": "Quản lý yêu thích, ghim trong toàn bộ danh mục All Tools và liên kết riêng.",
    "export-data": "Xuất dữ liệu All Tools của tài khoản hiện tại, không xuất dữ liệu workspace khác.",
    "import-data": "Kiểm tra từng bản ghi trước khi nhập dữ liệu vào kho All Tools riêng.",
    "pwa": "Đọc Service Worker, dung lượng cache và yêu cầu kiểm tra cập nhật thật.",
    "offline-mode": "Kiểm tra tệp đã lưu trong cache và kết nối; không tạo hàng đợi đồng bộ giả.",
    "install-app": "Cài PWA khi trình duyệt cho phép hoặc xem hướng dẫn phù hợp.",
    "keyboard-shortcuts": "Tạo, thử và xóa phím tắt trong All Tools; không chiếm phím khi nhập liệu.",
    "settings-center": "Cài đặt riêng All Tools: mật độ, chuyển động, bản nháp và lịch sử."
  };
  const state = {
    root: null,
    active: "Global Search",
    cleanup: [],
    progressFrame: 0,
    progressDetach: null,
    fpsFrame: 0,
    fps: { running: false, samples: [], last: 0, longTasks: 0 },
    generatedExport: "",
    importPayload: null,
    themeUndo: null,
    installPrompt: null,
    appearanceCleanup: null,
    owner: "",
    renderVersion: 0,
    settings: {},
    drafts: new Map(),
    skeletonTimer: 0,
    longTaskObserver: null,
    importFile: null,
    searchVersion: 0,
    shortcutCache: null,
    offlineController: null,
    progress: { value: 0, elapsed: 0, duration: 4000, running: false, mode: "demo" }
  };

  const manifests = [
    ["global-search", "Global Search", "browser", [], ["search", "open"], true, true, "search"],
    ["command-palette", "Command Palette++", "browser", ["navigation"], ["search", "run"], true, true, "terminal"],
    ["dark-light-auto", "Dark Light Auto Mode", "browser", ["appearance"], ["preview", "apply", "reset"], true, true, "sun-moon"],
    ["theme-switcher", "Theme Color Switcher", "browser", ["appearance"], ["preview", "apply", "undo"], true, true, "palette"],
    ["realtime-notifications", "Realtime Notification", "browser", ["notifications"], ["request", "send", "read", "clear"], true, true, "bell-ring"],
    ["loading-skeleton", "Loading Skeleton", "browser", ["dom-preview"], ["preview", "stop", "inspect"], true, true, "panels-top-left"],
    ["page-progress", "Page Progress Bar", "browser", ["performance"], ["start", "pause", "reset"], true, true, "gauge"],
    ["fps-monitor", "FPS Monitor", "browser", ["performance"], ["start", "pause", "reset", "export"], true, true, "activity"],
    ["history-manager", "History Manager", "browser", ["local-data"], ["search", "restore", "delete", "export"], false, true, "history"],
    ["favorite-manager", "Favorite Manager", "browser", ["local-data"], ["add", "open", "reorder", "delete"], true, true, "star"],
    ["export-data", "Export Data", "browser", ["local-data", "download"], ["preview", "export"], true, true, "download"],
    ["import-data", "Import Data", "browser", ["local-file", "local-data"], ["validate", "preview", "import", "cancel"], true, true, "upload"],
    ["pwa", "PWA", "browser", ["service-worker"], ["inspect", "update"], true, true, "app-window"],
    ["offline-mode", "Offline Mode", "browser", ["service-worker", "cache"], ["inspect", "retry"], true, true, "wifi-off"],
    ["install-app", "Install App", "browser", ["install-prompt"], ["install", "instructions"], true, true, "monitor-down"],
    ["keyboard-shortcuts", "Keyboard Shortcut System", "browser", ["keyboard"], ["add", "test", "reset", "export"], true, true, "keyboard"],
    ["settings-center", "Settings Center", "browser", ["appearance", "local-data"], ["search", "apply", "reset"], true, true, "settings"]
  ].map(([id, name, runtime, permissions, actions, history, offline, icon]) => ({
    id, name, runtime, permissions, actions, history, offline, icon,
    route: `/tools/platform/${id}`,
    status: "ready"
  }));

  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]));
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const supports = (name) => byName.has(name) || name === "FPS Monitor";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const formatBytes = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  const download = (content, filename, type = "application/json") => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1200);
  };

  function ensureStyle() {
    if (document.querySelector('link[data-platform-tools-style]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("/platform-tools.css?v=3", location.href).href;
    link.dataset.platformToolsStyle = "true";
    document.head.append(link);
  }

  function accountOwner() {
    try {
      if (window.HHAllToolState?.accountScope) return window.HHAllToolState.accountScope();
      const user = window.HHAuthz?.currentUser?.() || JSON.parse(localStorage.getItem("hh-auth-user") || "null");
      return user && !user.guest && (user.id || user._id || user.email) ? `account:${user.id || user._id || String(user.email).toLowerCase()}` : "guest";
    } catch { return "guest"; }
  }

  const localPrefix = (owner = accountOwner()) => `hh.all-tools.v1:${encodeURIComponent(owner)}:`;
  function activeOwner() { return state.owner || accountOwner(); }
  function assertAccount(owner = activeOwner()) {
    if (owner !== accountOwner()) throw new Error("Tài khoản đã thay đổi. Mở lại công cụ trước khi tiếp tục.");
  }

  function openDb(owner) {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(`${DB_NAME}:${encodeURIComponent(owner)}`, DB_VERSION);
      request.onupgradeneeded = () => STORE_NAMES.forEach((name) => {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  async function storeAction(storeName, mode, value, owner = activeOwner()) {
    assertAccount(owner);
    const db = await openDb(owner);
    if (owner !== accountOwner()) { db?.close(); assertAccount(owner); }
    if (!db) {
      state.storageTemporary = true;
      if (!memory.has(owner)) memory.set(owner, Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()])));
      const store = memory.get(owner)[storeName];
      if (mode === "all") return [...store.values()].map((row) => structuredClone(row));
      if (mode === "put") { store.set(value.id, structuredClone(value)); return value; }
      if (mode === "delete") return store.delete(value);
      if (mode === "clear") return store.clear();
      return null;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode === "all" ? "readonly" : "readwrite");
      const store = transaction.objectStore(storeName);
      const request = mode === "all" ? store.getAll() : mode === "put" ? store.put(value) : mode === "delete" ? store.delete(value) : store.clear();
      request.onerror = () => reject(request.error);
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Không thể lưu dữ liệu.")); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Lưu trữ thất bại.")); };
      transaction.oncomplete = () => { db.close(); if (owner !== accountOwner()) reject(new Error("Tài khoản đã thay đổi; không hiển thị dữ liệu phiên cũ.")); else resolve(request.result); };
    });
  }

  const dbAll = (name, owner = activeOwner()) => storeAction(name, "all", null, owner);
  const dbPut = (name, value, owner = activeOwner()) => storeAction(name, "put", value, owner);
  const dbDelete = (name, id, owner = activeOwner()) => storeAction(name, "delete", id, owner);
  const dbClear = (name, owner = activeOwner()) => storeAction(name, "clear", null, owner);
  const settingId = (id) => `setting:${id}`;
  const saveSetting = (id, value, owner = activeOwner()) => dbPut("settings", { id: settingId(id), value, updatedAt: Date.now() }, owner);
  const readSettings = async (owner = activeOwner()) => {
    const settings = Object.fromEntries((await storeAction("settings", "all", null, owner)).map((row) => [row.id.replace(/^setting:/, ""), row.value]));
    const appearance = window.HHAllToolState?.readJSON?.("hh.all-tools.appearance.v1", null, owner);
    return appearance ? { ...settings, ...appearance, colorMode: appearance.mode || settings.colorMode } : settings;
  };
  function publishAppearance(settings, owner = activeOwner()) {
    const fields = ["lightStart", "darkStart", "accent", "highlight", "fontScale", "contrast"];
    const appearance = { mode: settings.mode || settings.colorMode || "system" };
    fields.forEach((key) => { if (settings[key] !== undefined) appearance[key] = key === "fontScale" ? validateSetting(key, settings[key]) : settings[key]; });
    assertAccount(owner);
    window.HHAllToolState?.writeJSON?.("hh.all-tools.appearance.v1", appearance, owner);
    dispatchEvent(new CustomEvent("hh:alltools-appearance-change", { detail: appearance }));
  }

  async function record(action, detail = {}, tool = state.active, owner = activeOwner()) {
    const manifest = byName.get(tool);
    if (!manifest?.history) return;
    if ((await readSettings(owner)).historyEnabled === false) return;
    await dbPut("history", { id: uid(), tool: manifest.id, name: manifest.name, action, detail, createdAt: Date.now() }, owner);
    const rows = (await dbAll("history", owner)).sort((a, b) => b.createdAt - a.createdAt);
    await Promise.all(rows.slice(500).map((row) => dbDelete("history", row.id, owner)));
  }

  function capability(name, supported, detail) {
    return `<li class="pt-capability ${supported ? "is-ready" : "is-unavailable"}"><i aria-hidden="true"></i><span><b>${esc(name)}</b><small>${esc(detail)}</small></span></li>`;
  }

  function button(action, label, primary = false, extra = "") {
    return `<button type="button" class="pt-button ${primary ? "is-primary" : ""}" data-pt-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
  }

  function field(label, input, hint = "") {
    return `<label class="pt-field"><span>${esc(label)}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
  }

  function select(name, options, selected = "") {
    return `<select name="${esc(name)}">${options.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
  }

  function status(message = "Sẵn sàng.", kind = "ready") {
    const node = state.root?.querySelector("[data-pt-status]");
    if (!node) return;
    if (kind === "success" && state.storageTemporary && /lưu|nhập|thêm|xóa|cài đặt/i.test(message)) { message += " Chỉ lưu trong bộ nhớ tạm; tải lại sẽ mất dữ liệu."; kind = "warning"; }
    node.textContent = message;
    node.dataset.state = kind;
  }

  function output(value, html = false) {
    const node = state.root?.querySelector("[data-pt-output]");
    if (!node) return;
    if (html) node.innerHTML = value;
    else node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  const searchMarkup = () => `<div class="pt-layout pt-layout--search"><section class="pt-card">
    ${field("Tìm trang và công cụ", '<div class="pt-searchbox"><input name="query" autocomplete="off" placeholder="Nhập tên trang, công cụ hoặc hành động..."><kbd>Enter</kbd></div>')}
    <div class="pt-filter-row">${select("kind", [["all", "Tất cả"], ["route", "Trang & module"], ["heading", "Nội dung"], ["history", "Lịch sử"]])}${select("limit", [["20", "20 kết quả"], ["50", "50 kết quả"], ["100", "100 kết quả"]])}${button("search", "Tìm kiếm", true)}</div>
    <p class="pt-help">Chỉ lập chỉ mục nhãn điều hướng và tiêu đề công khai trong trang; không đọc nội dung biểu mẫu.</p>
  </section><section class="pt-card"><header><strong>Kết quả</strong><span data-pt-result-count>0 mục</span></header><div class="pt-results" data-pt-results><div class="pt-empty">Nhập từ khóa để tìm.</div></div></section></div>`;

  const commandMarkup = () => `<div class="pt-layout"><section class="pt-card">
    ${field("Command Palette", '<div class="pt-searchbox"><input name="query" autocomplete="off" placeholder="Tìm lệnh hoặc trang..."><kbd>Ctrl K</kbd></div>')}
    <p class="pt-help">↑ ↓ chọn lệnh · Home/End đến đầu/cuối · Enter mở · Escape trở lại tìm kiếm. Chỉ xử lý khi All Tools đang mở.</p><div class="pt-results" data-pt-results aria-label="Lệnh và công cụ"></div>
  </section><aside class="pt-card pt-card--compact"><strong>Lệnh nhanh</strong><div class="pt-command-grid">
    ${button("command-theme", "Mở thiết lập sáng/tối")}${button("command-home", "Mở Trang chủ")}${button("command-tools", "Mở All Tools")}${button("command-notify", "Mở thông báo cục bộ")}
  </div><p class="pt-help">Lệnh điều hướng dùng router hiện tại và giữ nguyên phiên làm việc.</p></aside></div>`;

  const darkMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-choice-grid">
    ${[["system", "Theo hệ điều hành", "Đồng bộ prefers-color-scheme"], ["light", "Luôn sáng", "Áp dụng trên thiết bị này"], ["dark", "Luôn tối", "Áp dụng trên thiết bị này"], ["schedule", "Theo giờ", "Tự đổi theo lịch"]].map(([value, title, desc]) => `<label class="pt-choice"><input type="radio" name="mode" value="${value}" ${(settings.colorMode || "system") === value ? "checked" : ""}><span><b>${title}</b><small>${desc}</small></span></label>`).join("")}
  </div><div class="pt-grid-2">${field("Bắt đầu chế độ sáng", '<input type="time" name="lightStart" value="' + esc(settings.lightStart || "06:00") + '">')}${field("Bắt đầu chế độ tối", '<input type="time" name="darkStart" value="' + esc(settings.darkStart || "18:00") + '">')}</div><div class="pt-theme-preview" data-pt-mode-preview><h4>Xem trước độc lập</h4><p>Giao diện chính chưa thay đổi.</p></div><div class="pt-actions">${button("appearance-preview", "Xem trước")}${button("appearance-apply", "Áp dụng cho All Tools", true)}${button("appearance-reset", "Theo hệ thống")}</div></section><aside class="pt-card"><strong>Trạng thái</strong><ul class="pt-capabilities">${capability("Media query", typeof matchMedia === "function", "Theo dõi thay đổi giao diện hệ điều hành")}${capability("Lịch theo thiết bị", true, "Tính toán cục bộ, không cần API")}${capability("Đồng bộ tài khoản", false, "Chỉ lưu cho tài khoản trên thiết bị này")}</ul></aside></div>`;

  const themeMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">
    ${field("Màu chủ đạo", `<input type="color" name="accent" value="${esc(settings.accent || "#55d9e2")}">`)}${field("Màu nhấn", `<input type="color" name="highlight" value="${esc(settings.highlight || "#ff63bf")}">`)}
    ${field("Cỡ chữ", `<input type="range" name="fontScale" min="85" max="125" value="${esc(settings.fontScale || 100)}"><output data-pt-font-value>${esc(settings.fontScale || 100)}%</output>`)}${field("Độ tương phản", select("contrast", [["normal", "Tiêu chuẩn"], ["high", "Tương phản cao"]], settings.contrast || "normal"))}
  </div><div class="pt-theme-preview"><span></span><h4>All Tools Studio</h4><p>Xem trước bảng màu và khả năng đọc trước khi áp dụng.</p><span class="pt-preview-action">Mẫu nút hành động</span></div><div class="pt-actions">${button("theme-preview", "Xem trước")}${button("theme-apply", "Áp dụng cho All Tools", true)}${button("theme-undo", "Hoàn tác", false, "disabled")}</div></section></div>`;

  const notificationsMarkup = async () => {
    const rows = (await dbAll("notifications")).sort((a, b) => b.createdAt - a.createdAt);
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Tiêu đề", '<input name="title" maxlength="80" value="HH Platform">')}${field("Mức ưu tiên", select("priority", [["normal", "Bình thường"], ["high", "Cao"], ["silent", "Im lặng"]]))}</div>${field("Nội dung", '<textarea name="message" maxlength="240" placeholder="Nội dung thông báo trên thiết bị..."></textarea>')}<label class="pt-choice"><input type="checkbox" name="listenLocal" checked><span><b>Cập nhật giữa các tab cùng tài khoản</b><small>Chỉ đọc kho All Tools trên thiết bị này, không gửi ra ngoài.</small></span></label><div class="pt-actions">${button("notification-permission", "Cấp quyền trình duyệt")}${button("notification-send", "Tạo thông báo", true)}${button("notification-read", "Đánh dấu đã đọc")}${button("notification-clear", "Xóa thông báo")}</div><p class="pt-help">Thông báo cục bộ cập nhật qua sự kiện storage giữa các tab. Không có nguồn realtime máy chủ; không gửi push khi website đã đóng. Thông báo hệ thống chỉ gửi khi đã được cấp quyền.</p></section><section class="pt-card"><header><strong>Thông báo của bạn</strong><span>${rows.filter((row) => !row.read).length} chưa đọc</span></header><div class="pt-timeline" data-pt-notifications>${rows.length ? rows.map((row) => `<article class="${row.read ? "" : "is-unread"}"><div><b>${esc(row.title)}</b><p>${esc(row.message)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-pt-delete-notification="${esc(row.id)}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có thông báo.</div>'}</div></section></div>`;
  };

  const skeletonMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Mẫu skeleton", select("pattern", [["cards", "Danh sách thẻ"], ["article", "Bài viết"], ["dashboard", "Dashboard"]]))}${field("Thời gian kiểm thử", '<input type="number" name="duration" min="500" max="10000" step="250" value="1800">', "500–10.000 ms")}</div>${field("Số phần tử", '<input type="range" name="count" min="1" max="12" value="6"><output data-pt-count>6</output>')}<div class="pt-actions">${button("skeleton-start", "Chạy kiểm thử", true)}${button("skeleton-stop", "Dừng")}${button("skeleton-code", "Xem mã HTML/CSS")}${button("skeleton-export", "Tải mẫu .html")}</div><p class="pt-help">Mã mẫu độc lập, có aria-busy, reduced motion và responsive. Thay skeleton bằng nội dung của ứng dụng khi tác vụ thực hoàn tất; không dùng timeout mô phỏng trong production.</p><pre class="pt-code" data-pt-output>Mẫu HTML/CSS chưa tạo.</pre></section><section class="pt-card"><header><strong>Preview có phạm vi</strong><span data-pt-skeleton-state>Chưa chạy</span></header><div class="pt-skeleton-stage" data-pt-skeleton-stage aria-live="polite"><div class="pt-demo-content"><h4>Nội dung thật</h4><p>Skeleton chỉ phủ khu vực thử nghiệm này và không khóa toàn website.</p></div></div></section></div>`;

  const progressMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Nguồn tiến trình", select("progressType", [["page", "Vị trí cuộn trang All Tools"], ["scroll", "Cuộn nội dung thử nghiệm"], ["events", "Tác vụ phát sự kiện hh:progress"], ["demo", "Sandbox mô phỏng"]]))}${field("Thời lượng mô phỏng", '<input type="number" name="duration" min="500" max="15000" step="500" value="4000">')}</div><div class="pt-actions">${button("progress-start", "Bắt đầu / tiếp tục", true)}${button("progress-pause", "Tạm dừng")}${button("progress-reset", "Đặt lại")}</div><p class="pt-help">Nguồn trang đọc scrollTop thật; nguồn sự kiện chỉ cập nhật khi ứng dụng cung cấp tiến trình thật. Mô phỏng chỉ nằm trong công cụ này, không báo trạng thái tải trang hoặc API thật.</p></section><section class="pt-card pt-progress-card"><header><strong>Tiến trình</strong><span data-pt-progress-label>0%</span></header><progress data-pt-progress max="100" value="0">0%</progress><p data-pt-progress-detail>Chưa có nguồn theo dõi.</p><div class="pt-scroll-sample" tabindex="0" aria-label="Nội dung cuộn thử nghiệm" data-pt-scroll-sample>${Array.from({ length: 12 }, (_, index) => `<article><b>Phần ${index + 1}</b><p>Cuộn vùng nội dung này để đo vị trí thực tế. Dùng phím Page Down hoặc mũi tên khi vùng được focus.</p></article>`).join("")}</div></section></div>`;

  const fpsMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-metrics"><article><span>FPS hiện tại</span><strong data-pt-fps>—</strong></article><article><span>Frame time</span><strong data-pt-frame>—</strong></article><article><span>P95</span><strong data-pt-p95>—</strong></article><article><span>Long tasks</span><strong data-pt-long>0</strong></article></div><canvas class="pt-chart" data-pt-fps-chart width="900" height="260" aria-label="Biểu đồ FPS 60 giây"></canvas><div class="pt-actions">${button("fps-start", "Bắt đầu đo", true)}${button("fps-pause", "Tạm dừng")}${button("fps-reset", "Đặt lại")}${button("fps-export", "Xuất JSON")}</div></section><aside class="pt-card"><strong>Khả năng đo</strong><ul class="pt-capabilities">${capability("requestAnimationFrame", true, "Đo FPS và frame time thực")}${capability("Long Tasks API", "PerformanceObserver" in window, "Ghi nhận tác vụ chặn main thread")}${capability("GPU telemetry", false, "Trình duyệt không cung cấp nhiệt độ/GPU load")}</ul></aside></div>`;

  const historyMarkup = async () => {
    const rows = await allHistory();
    const recent = catalogPreferences().recent.map(id => toolCatalog().find(tool => tool.id === id)).filter(Boolean);
    return `<div class="pt-layout"><section class="pt-card"><header><strong>Công cụ mở gần đây</strong><span>${recent.length} mục</span></header><div class="pt-results">${recent.length ? recent.map(tool => `<button type="button" class="pt-result" data-pt-catalog-open="${esc(tool.id)}"><span>↗</span><div><b>${esc(tool.name)}</b><small>${esc(tool.description || "Tiếp tục workspace đã mở")}</small></div></button>`).join("") : '<div class="pt-empty">Chưa mở công cụ nào.</div>'}</div><div class="pt-actions">${button("history-clear-recent", "Xóa danh sách gần đây")}</div><header><strong>Hoạt động thật của All Tools</strong><span>${rows.length} mục gần nhất · tối đa 500</span></header><div class="pt-filter-row"><input name="query" aria-label="Lọc lịch sử" placeholder="Tìm tool hoặc hành động...">${button("history-filter", "Lọc", true)}${button("history-export", "Xuất JSON")}</div><div class="pt-timeline" data-pt-history>${historyRows(rows)}</div></section><aside class="pt-card pt-card--compact"><p class="pt-help">Gần đây dùng cùng danh sách với All Tools. Lịch sử tổng hợp metadata thực từ Platform, workspace và tiện ích; không đọc nội dung ghi chú, mật khẩu, token hoặc nội dung công cụ khác. Xóa bên dưới chỉ xóa lịch sử Platform; hoạt động bộ khác được quản lý trong công cụ gốc.</p>${button("history-clear", "Xóa lịch sử Platform")}</aside></div>`;
  };

  async function allHistory(owner = activeOwner()) {
    const platform = (await dbAll("history", owner)).map(row => ({ ...row, source: "platform" }));
    const workspace = window.HHAllToolState?.workspaceHistory ? await window.HHAllToolState.workspaceHistory(owner, 500) : [];
    const catalog = toolCatalog();
    const extra = workspace.map(row => {
      const tool = catalog.find(item => item.id === row.tool || item.name === row.tool);
      return { id: row.id, source: row.source, tool: tool?.id || row.tool, name: tool?.name || row.tool, action: row.action, createdAt: Date.parse(row.at) };
    });
    assertAccount(owner);
    return [...platform, ...extra].sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
  }

  const toolCatalog = () => window.HHFeatureLab?.catalog?.() || manifests;
  function catalogPreferences() {
    const saved = window.HHAllToolState?.readCatalogPreferences?.(activeOwner()) || window.HHAllToolState?.readJSON?.("hh.all-tools.catalog.v1", {}, activeOwner()) || {};
    const ids = new Set(toolCatalog().map(tool => tool.id));
    return Object.fromEntries(["favorites", "pinned", "recent"].map(key => [key, Array.isArray(saved[key]) ? [...new Set(saved[key].filter(id => ids.has(id)))].slice(0, key === "recent" ? 12 : 86) : []]));
  }
  function updateCatalogPreferences(patch, owner = activeOwner()) {
    assertAccount(owner);
    const data = { ...catalogPreferences(), ...patch };
    if (window.HHAllToolState?.updateCatalogPreferences) return window.HHAllToolState.updateCatalogPreferences(data, owner);
    else if (window.HHAllToolState?.writeJSON) window.HHAllToolState.writeJSON("hh.all-tools.catalog.v1", data, owner);
    else throw new Error("Kho danh mục All Tools chưa sẵn sàng; không thể lưu yêu thích.");
    dispatchEvent(new CustomEvent("hh:alltools-catalog-change", { detail: { owner } }));
    return data;
  }

  function catalogFavoriteRows() {
    const preferences = catalogPreferences(), catalog = toolCatalog();
    const selected = catalog.filter(tool => preferences.favorites.includes(tool.id) || preferences.pinned.includes(tool.id));
    return `<header><strong>Yêu thích & ghim của danh mục</strong><span>${selected.length} công cụ</span></header>${field("Thêm từ danh mục", select("catalogTool", catalog.map(tool => [tool.id, tool.name])))}<div class="pt-actions">${button("favorite-catalog-add", "Thêm tool yêu thích", true)}${button("favorite-catalog-pin", "Ghim tool đã chọn")}</div><div class="pt-catalog-favorites">${selected.length ? selected.map(tool => `<article><div><b>${esc(tool.name)}</b><small>${esc(tool.group || "Platform")} · ${preferences.pinned.includes(tool.id) ? "Đã ghim" : "Chưa ghim"}</small></div><button type="button" data-pt-catalog-open="${esc(tool.id)}">Mở</button><button type="button" data-pt-catalog-toggle="pinned" data-pt-catalog-id="${esc(tool.id)}" aria-pressed="${preferences.pinned.includes(tool.id)}">◇ Ghim</button><button type="button" data-pt-catalog-toggle="favorites" data-pt-catalog-id="${esc(tool.id)}" aria-pressed="${preferences.favorites.includes(tool.id)}">★ Yêu thích</button></article>`).join("") : '<div class="pt-empty">Dùng nút Yêu thích/Ghim trong catalog hoặc chọn một tool ở trên.</div>'}</div>`;
  }

  const historyRows = (rows) => rows.length ? rows.map((row) => `<article data-pt-history-row data-search="${esc(`${row.name} ${row.action} ${row.source || "platform"}`.toLowerCase())}"><div><b>${esc(row.name)}</b><p>${esc(row.action)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")} · ${esc(row.source || "platform")}</small></div><button type="button" data-pt-catalog-open="${esc(row.tool)}" ${toolCatalog().some(tool => tool.id === row.tool) ? "" : "disabled"}>Mở</button>${!row.source || row.source === "platform" ? `<button type="button" data-pt-history-delete="${esc(row.id)}" aria-label="Xóa hoạt động Platform">×</button>` : ""}</article>`).join("") : '<div class="pt-empty">Chưa có hoạt động.</div>';

  const favoritesMarkup = async () => {
    const rows = (await dbAll("favorites")).sort((a, b) => a.order - b.order);
    return `<div class="pt-layout"><section class="pt-card">${catalogFavoriteRows()}</section><section class="pt-card"><strong>Liên kết nội bộ cá nhân</strong><div class="pt-grid-3">${field("Tên", '<input name="title" maxlength="160" placeholder="Ví dụ: Bộ đổi màu">')}${field("Route", '<input name="route" maxlength="240" placeholder="/tools/platform/theme-switcher">')}${field("Thư mục / tag", '<input name="folder" maxlength="80" placeholder="Công việc">')}</div><div class="pt-actions">${button("favorite-add", "Thêm liên kết", true)}${button("favorite-current", "Thêm công cụ hiện tại")}</div><p class="pt-help">Liên kết cá nhân giữ nguyên dữ liệu cũ. Chỉ chấp nhận đường dẫn nội bộ. Kéo thả hoặc dùng nút lên/xuống để sắp xếp.</p><div class="pt-favorites" data-pt-favorites>${rows.length ? rows.map((row, index) => `<article draggable="true" data-pt-favorite="${esc(row.id)}"><span>★</span><div><b>${esc(row.title)}</b><small>${esc(row.folder || "Chưa phân loại")} · ${esc(row.route)}</small></div><button type="button" data-pt-favorite-up="${esc(row.id)}" aria-label="Đưa lên" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-pt-favorite-down="${esc(row.id)}" aria-label="Đưa xuống" ${index === rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-pt-favorite-open="${esc(row.id)}">Mở</button><button type="button" data-pt-favorite-delete="${esc(row.id)}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có liên kết cá nhân.</div>'}</div></section></div>`;
  };

  const exportMarkup = () => `<div class="pt-layout"><section class="pt-card"><fieldset><legend>Phạm vi dữ liệu riêng All Tools</legend><div class="pt-check-grid">${["Thiết lập All Tools", "Lịch sử thao tác", "Liên kết yêu thích", "Thông báo", "Bản nháp Platform Tools", "Workspace, tiện ích & danh mục", "Nội dung tệp workspace (cần chọn workspace)"].map((label, index) => `<label><input type="checkbox" name="scope" value="${index}" ${index < 4 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset>${field("Định dạng", select("format", [["json", "JSON (sao lưu)"], ["csv", "CSV (chỉ lịch sử Platform)"]]))}<p class="pt-help">Chỉ xuất tài khoản hiện tại, tổng tối đa 5 MB. Các phạm vi nội dung do bạn chọn có thể chứa ghi chú, chat hoặc tài liệu riêng; giữ tệp sao lưu an toàn. Không đọc khóa đăng nhập/token; không xuất nội dung công cụ Password/API/Clipboard. Tệp workspace tùy chọn, tối đa 1 MB/tệp và 2 MB tổng.</p><div class="pt-actions">${button("export-preview", "Tạo bản xem trước", true)}${button("export-download", "Tải xuống", false, "disabled")}</div></section><section class="pt-card"><header><strong>Bản xem trước</strong><span data-pt-export-size>0 B</span></header><pre class="pt-code" data-pt-output>Chọn phạm vi rồi tạo bản xem trước.</pre></section></div>`;

  const importMarkup = () => `<div class="pt-layout"><section class="pt-card"><label class="pt-dropzone"><input type="file" name="importFile" accept="application/json,.json"><span>Chọn hoặc kéo tệp JSON vào đây</span><small>Tệp được phân tích cục bộ, chưa ghi dữ liệu cho tới khi bạn xác nhận.</small></label><div class="pt-grid-2">${field("Xử lý trùng", select("strategy", [["merge", "Gộp, ưu tiên dữ liệu mới"], ["skip", "Bỏ qua mục đã có"], ["replace", "Thay thế phạm vi có trong tệp"]]))}${field("Giới hạn kích thước", '<output>5 MB · v1 tương thích / v2 đúng tài khoản</output>')}</div><p class="pt-help">Kiểm tra toàn bộ schema trước khi lưu. Nhập nhiều kho không phải transaction duy nhất: công cụ tạo bản chụp để hoàn tác nếu có lỗi và báo rõ nếu hoàn tác không đầy đủ. Tệp v2 của tài khoản khác sẽ bị từ chối.</p><div class="pt-actions">${button("import-validate", "Kiểm tra tệp", true)}${button("import-commit", "Xác nhận nhập", false, "disabled")}${button("import-cancel", "Hủy")}</div></section><section class="pt-card"><header><strong>Kiểm tra schema</strong><span data-pt-import-status>Chưa có tệp</span></header><pre class="pt-code" data-pt-output>Chưa có dữ liệu xem trước.</pre></section></div>`;

  const pwaMarkup = (kind) => `<div class="pt-layout"><section class="pt-card"><div class="pt-actions">${kind === "PWA" ? `${button("pwa-inspect", "Kiểm tra PWA", true)}${button("pwa-update", "Tìm bản cập nhật")}` : kind === "Offline Mode" ? `${button("offline-inspect", "Kiểm tra offline", true)}${button("offline-retry", "Kiểm tra truy cập tệp")}` : `${button("install-run", "Cài ứng dụng", true, state.installPrompt ? "" : "disabled")}${button("install-inspect", "Kiểm tra khả năng cài")}${button("install-help", "Xem hướng dẫn")}`}</div>${kind === "Offline Mode" ? `<fieldset><legend>Tải riêng bộ công cụ để dùng offline</legend><div class="pt-check-grid">${[["platform", "Platform & danh mục"], ["workspace", "Ghi chú, Kanban & tệp"], ["utility", "Chuyển đổi & xử lý dữ liệu"]].map(([value, label]) => `<label><input type="checkbox" name="offlineSuite" value="${value}" checked><span>${label}</span></label>`).join("")}</div><p class="pt-help">Chỉ tải JS/CSS công khai của bộ đã chọn, tối đa 15 MB. Không lưu API, tài khoản, tệp người dùng hoặc nội dung AI. Khả năng offline phụ thuộc Service Worker hiện có; các tính năng cần mạng vẫn không chạy offline.</p><div class="pt-actions">${button("offline-prepare", "Tải tài nguyên đã chọn")}${button("offline-cancel", "Dừng tải")}</div><progress data-pt-offline-progress value="0" max="100" aria-label="Tiến trình lưu tài nguyên"></progress></fieldset>` : ""}<div class="pt-pwa-report" data-pt-pwa-report><div class="pt-empty">Nhấn kiểm tra để đọc trạng thái thật của trình duyệt.</div></div></section><aside class="pt-card"><strong>Khả năng trình duyệt</strong><ul class="pt-capabilities">${capability("Service Worker", "serviceWorker" in navigator, "Cache và cập nhật ứng dụng")}${capability("Cache Storage", "caches" in window, "Chỉ thêm cache riêng All Tools; không xóa cache của website")}${capability("Install Prompt", Boolean(state.installPrompt), state.installPrompt ? "Có thể hiển thị ngay" : "Phụ thuộc trình duyệt và tiêu chí PWA")}</ul></aside></div>`;

  const shortcutsMarkup = async () => {
    const settings = await readSettings();
    const rows = settings.shortcuts || [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }];
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-3">${field("Tên phím tắt", '<input name="label" placeholder="Mở Trang chủ">')}${field("Tổ hợp", '<input name="combo" placeholder="Ctrl+Shift+H">', "Ctrl/Alt/Shift + phím")}${field("Hành động", select("shortcutAction", [["home", "Mở Trang chủ"], ["palette", "Mở Command Palette"], ["tools", "Mở All Tools"], ["theme", "Đổi sáng/tối"]]))}</div><div class="pt-actions">${button("shortcut-add", "Thêm phím tắt", true)}${button("shortcut-reset", "Khôi phục mặc định")}${button("shortcut-export", "Xuất")}</div><div class="pt-shortcuts" data-pt-shortcuts>${rows.map((row) => `<article><div><b>${esc(row.label)}</b><small>${esc(row.action)}</small></div><kbd>${esc(row.combo)}</kbd><button type="button" data-pt-shortcut-test="${row.id}">Thử</button><button type="button" data-pt-shortcut-delete="${row.id}" aria-label="Xóa">×</button></article>`).join("")}</div></section></div>`;
  };

  const settingsMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-filter-row"><input name="settingSearch" placeholder="Tìm cài đặt..."></div><div class="pt-settings" data-pt-settings>
    <label data-search="mật độ giao diện density"><span><b>Mật độ giao diện</b><small>Khoảng cách giữa các điều khiển</small></span>${select("density", [["comfortable", "Thoải mái"], ["compact", "Gọn"]], settings.density || "comfortable")}</label>
    <label data-search="giảm chuyển động motion"><span><b>Giảm chuyển động</b><small>Tắt hiệu ứng không thiết yếu</small></span><input type="checkbox" name="reducedMotion" ${settings.reducedMotion ? "checked" : ""}></label>
    <label data-search="tự động lưu autosave"><span><b>Giữ bản nháp công cụ</b><small>Khôi phục bộ lọc và trường nhập khi quay lại All Tools; không lưu tệp nhập</small></span><input type="checkbox" name="autosave" ${settings.autosave !== false ? "checked" : ""}></label>
    <label data-search="quyền riêng tư history"><span><b>Lưu lịch sử thao tác</b><small>Không lưu nội dung nhạy cảm</small></span><input type="checkbox" name="historyEnabled" ${settings.historyEnabled !== false ? "checked" : ""}></label>
  </div><div class="pt-actions">${button("settings-apply", "Lưu cài đặt", true)}${button("settings-reset", "Khôi phục mặc định")}${button("settings-storage", "Xem dung lượng")}</div></section><aside class="pt-card"><strong>Kho dữ liệu</strong><div data-pt-storage-report class="pt-pwa-report"><div class="pt-empty">IndexedDB: ${window.indexedDB ? "sẵn sàng" : "không hỗ trợ, dùng bộ nhớ tạm"}</div></div></aside></div>`;

  async function bodyMarkup(name) {
    const settings = await readSettings();
    if (name === "Global Search") return searchMarkup();
    if (name === "Command Palette++") return commandMarkup();
    if (name === "Dark Light Auto Mode") return darkMarkup(settings);
    if (name === "Theme Color Switcher") return themeMarkup(settings);
    if (name === "Realtime Notification") return notificationsMarkup();
    if (name === "Loading Skeleton") return skeletonMarkup();
    if (name === "Page Progress Bar") return progressMarkup();
    if (name === "FPS Monitor") return fpsMarkup();
    if (name === "History Manager") return historyMarkup();
    if (name === "Favorite Manager") return favoritesMarkup();
    if (name === "Export Data") return exportMarkup();
    if (name === "Import Data") return importMarkup();
    if (["PWA", "Offline Mode", "Install App"].includes(name)) return pwaMarkup(name);
    if (name === "Keyboard Shortcut System") return shortcutsMarkup();
    if (name === "Settings Center") return settingsMarkup(settings);
    return `<div class="pt-card"><div class="pt-empty">Tool này chưa thuộc Platform runtime.</div></div>`;
  }

  async function render(host, name) {
    if (!host || !supports(name)) return false;
    cleanupRuntime();
    const version = ++state.renderVersion;
    ensureStyle();
    state.active = name;
    state.owner = accountOwner();
    state.storageTemporary = false;
    const manifest = byName.get(name) || byId.get("fps-monitor");
    host.innerHTML = `<div class="pt-workspace" data-platform-tool="${esc(manifest.id)}"><header class="pt-head"><div><small>ALL TOOLS · ${esc(manifest.runtime.toUpperCase())}</small><h3>${esc(manifest.name)}</h3><p>${esc(descriptions[manifest.id])}</p></div><div class="pt-badges"><span class="is-ready">Công cụ riêng</span><span>${manifest.offline ? "Dùng cục bộ" : "Cần kết nối"}</span></div></header><div class="pt-status" data-pt-status data-state="ready" role="status" aria-live="polite">Đang mở công cụ…</div><main data-pt-body><div class="pt-loading" aria-label="Đang tải"></div></main></div>`;
    state.root = host.querySelector("[data-platform-tool]");
    const root = state.root, owner = state.owner;
    const settings = await readSettings();
    if (version !== state.renderVersion || owner !== accountOwner() || state.root !== root) return false;
    state.settings = settings;
    root.dataset.density = settings.density || "comfortable";
    root.dataset.reducedMotion = settings.reducedMotion ? "true" : "false";
    root.dataset.colorMode = settings.colorMode || "system";
    const markup = await bodyMarkup(name);
    if (version !== state.renderVersion || owner !== accountOwner() || state.root !== root) return false;
    root.querySelector("[data-pt-body]").innerHTML = markup;
    restoreDraft();
    bind();
    applyToolAppearance(settings);
    await getShortcuts();
    if (version !== state.renderVersion || owner !== accountOwner() || state.root !== root) return false;
    if (name === "Theme Color Switcher") { previewTheme(values()); root.querySelector('[data-pt-action="theme-undo"]').disabled = !settings.themeUndo; }
    if (["Global Search", "Command Palette++"].includes(name)) await runSearch(name === "Command Palette++");
    if (!window.indexedDB) status("IndexedDB không hỗ trợ: dữ liệu chỉ nằm trong bộ nhớ tạm, sẽ mất khi tải lại.", "warning");
    else if (!["Global Search", "Command Palette++"].includes(name)) status("Sẵn sàng. Dữ liệu riêng cho tài khoản trên thiết bị này.");
    dispatchEvent(new CustomEvent("hh:platform-tool-mounted", { detail: { manifest: { ...manifest } } }));
    return true;
  }

  function cleanupRuntime() {
    saveDraft();
    state.renderVersion++;
    state.searchVersion++;
    cancelAnimationFrame(state.progressFrame);
    state.progressDetach?.(); state.progressDetach = null;
    cancelAnimationFrame(state.fpsFrame);
    clearTimeout(state.skeletonTimer);
    state.longTaskObserver?.disconnect();
    state.longTaskObserver = null;
    state.appearanceCleanup?.();
    state.appearanceCleanup = null;
    state.fps.running = false;
    state.progress.running = false;
    state.generatedExport = "";
    state.offlineController?.abort(); state.offlineController = null;
    state.importPayload = null;
    state.confirmedImport = null;
    state.importFile = null;
    state.themeUndo = null;
    state.cleanup.splice(0).forEach((fn) => { try { fn(); } catch {} });
    state.root = null;
    state.owner = "";
    state.shortcutCache = null;
  }

  function values() {
    return Object.fromEntries([...state.root.querySelectorAll("input[name],select[name],textarea[name]")].filter((node) => node.type !== "radio" || node.checked).map((node) => [node.name, node.type === "checkbox" ? node.checked : node.value]));
  }

  function saveDraft() {
    if (!state.root || !state.owner || state.owner !== accountOwner() || state.settings.autosave === false) return;
    const fields = [...state.root.querySelectorAll("input[name],select[name],textarea[name]")].filter((node) => !["file", "password"].includes(node.type) && node.name !== "scope");
    const data = fields.map((node) => ({ name: node.name, value: node.value, checked: node.checked, type: node.type }));
    state.drafts.set(`${state.owner}:${state.active}`, data);
    try { localStorage.setItem(`${localPrefix(state.owner)}draft:${byName.get(state.active)?.id}`, JSON.stringify(data)); } catch {}
  }

  function restoreDraft() {
    if (state.settings.autosave === false) return;
    let data = state.drafts.get(`${state.owner}:${state.active}`);
    if (!data) try { data = JSON.parse(localStorage.getItem(`${localPrefix(state.owner)}draft:${byName.get(state.active)?.id}`) || "null"); } catch {}
    if (!Array.isArray(data)) return;
    const nodes = [...state.root.querySelectorAll("input[name],select[name],textarea[name]")];
    data.slice(0, 50).forEach((saved) => nodes.filter((node) => node.name === saved.name && node.type === saved.type && !["file", "password"].includes(node.type)).forEach((node) => {
      if (["radio", "checkbox"].includes(node.type)) { if (node.value === saved.value) node.checked = saved.checked === true; }
      else node.value = String(saved.value || "").slice(0, 10000);
    }));
  }

  function scanWorkspace(query = "", kind = "all", limit = 50) {
    const normalized = normalizeSearch(query);
    const map = new Map();
    const add = (entry) => {
      const key = `${entry.kind}:${entry.route || entry.label}`;
      if (!map.has(key) && (!normalized || normalizeSearch(`${entry.label} ${entry.description || ""}`).includes(normalized))) map.set(key, entry);
    };
    if (["all", "route"].includes(kind)) {
      document.querySelectorAll("[data-app-route]").forEach((node) => add({ kind: "route", label: node.textContent.trim().replace(/\s+/g, " ") || node.dataset.appRoute, route: node.dataset.appRoute, description: "Điều hướng trong HH Platform" }));
      toolCatalog().forEach((manifest) => add({ kind: "route", label: manifest.name, route: manifest.route || `/tools/${manifest.id}`, description: manifest.description || `${manifest.group || "Platform"} · All Tool` }));
    }
    if (["all", "heading"].includes(kind)) document.querySelectorAll("main h1,main h2,main h3,[data-module-id]").forEach((node) => {
      if (node.closest(".feature-lab") || node.closest(".pt-workspace")) return;
      add({ kind: "heading", label: node.textContent.trim().replace(/\s+/g, " "), route: node.closest("[data-app-route]")?.dataset.appRoute || location.hash, description: node.dataset.moduleId || "Nội dung đang hiển thị" });
    });
    return [...map.values()].slice(0, Number(limit) || 50);
  }

  async function runSearch(command = false) {
    const root = state.root, owner = state.owner, version = ++state.searchVersion;
    const data = values();
    const kind = command ? "route" : data.kind || "all";
    const rows = scanWorkspace(data.query || "", kind, command ? 150 : data.limit || 30);
    if (command) {
      const query = normalizeSearch(data.query || "");
      const commands = [["command-theme", "Thiết lập sáng/tối", "Xem trước và áp dụng riêng All Tools"], ["command-home", "Mở Trang chủ", "HH Platform"], ["command-tools", "Mở danh mục All Tools", "Danh mục công cụ"], ["command-notify", "Thông báo cục bộ", "Quản lý thông báo trên thiết bị"]];
      rows.unshift(...commands.filter(([, label, description]) => !query || normalizeSearch(`${label} ${description}`).includes(query)).map(([action, label, description]) => ({ kind: "command", action, label, description })));
      rows.sort((a, b) => searchScore(b.label, query) - searchScore(a.label, query));
    }
    if (["all", "history"].includes(kind)) {
      const normalized = normalizeSearch(data.query || "");
      const history = (await allHistory(owner))
        .sort((a, b) => b.createdAt - a.createdAt)
        .filter((row) => !normalized || normalizeSearch(`${row.name} ${row.action}`).includes(normalized))
        .slice(0, Number(data.limit) || 30)
        .map((row) => ({ kind: "history", label: row.name, route: toolCatalog().some(tool => tool.id === row.tool) ? `/tools/${row.tool}` : "", description: `${row.action} · ${new Date(row.createdAt).toLocaleString("vi-VN")}` }));
      rows.push(...history.slice(0, Math.max(0, (Number(data.limit) || 30) - rows.length)));
    }
    if (version !== state.searchVersion || root !== state.root || owner !== accountOwner()) return;
    const target = root.querySelector("[data-pt-results]");
    if (!target) return;
    target.innerHTML = rows.length ? rows.map((row) => `<button type="button" class="pt-result" ${row.action ? `data-pt-action="${esc(row.action)}"` : `data-pt-open-route="${esc(row.route || "")}"`}><span>${row.kind === "command" ? "⌘" : row.kind === "route" ? "↗" : "⌕"}</span><div><b>${esc(row.label)}</b><small>${esc(row.description || row.route || "")}</small></div><kbd>Enter</kbd></button>`).join("") : '<div class="pt-empty">Không tìm thấy kết quả phù hợp.</div>';
    const count = state.root.querySelector("[data-pt-result-count]");
    if (count) count.textContent = `${rows.length} mục`;
    status(`Tìm thấy ${rows.length} kết quả.`, "success");
  }

  function searchScore(label, query) {
    const normalized = normalizeSearch(label);
    if (!query) return 0;
    return normalized === query ? 3 : normalized.startsWith(query) ? 2 : normalized.includes(query) ? 1 : 0;
  }
  const normalizeSearch = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").trim().toLowerCase();

  function navigate(route) {
    if (!route) return;
    route = validRoute(route);
    if (route.startsWith("/tools/") && window.HHFeatureLab?.getTool?.(route)) { window.HHFeatureLab.select(route); return; }
    if (route.startsWith("/tools/platform/")) {
      const manifest = byId.get(route.split("/").pop());
      if (!manifest) throw new Error("Công cụ không tồn tại.");
      if (window.HHFeatureLab?.select) { window.HHFeatureLab.select(manifest.name); return; }
    }
    const target = document.querySelector(`[data-app-route="${CSS.escape(route)}"]`);
    if (target) target.click();
    else location.hash = `#${route}`;
  }

  function validRoute(value) {
    const route = String(value || "").trim().replace(/^#/, "");
    if (!/^\/[a-z0-9][a-z0-9/_-]*(?:\?[a-z0-9_.~!$&'()*+,;=:%/?-]*)?$/i.test(route) || route.length > 240 || route.includes("..")) throw new Error("Chỉ chấp nhận đường dẫn nội bộ như /tools/platform/theme-switcher.");
    return route === "/home" ? "/platform" : route;
  }

  function applyColorMode(config, target = state.root) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = (value) => { const [hour, minute] = String(value).split(":").map(Number); return hour * 60 + minute; };
    let mode = config.mode;
    if (mode === "system") mode = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (mode === "schedule") {
      const light = toMinutes(config.lightStart || "06:00"), dark = toMinutes(config.darkStart || "18:00");
      mode = light < dark ? (minutes >= light && minutes < dark ? "light" : "dark") : (minutes >= light || minutes < dark ? "light" : "dark");
    }
    if (!["light", "dark"].includes(mode)) throw new Error("Chế độ màu không hợp lệ.");
    target.dataset.colorMode = mode;
    target.style.colorScheme = mode;
    return mode;
  }

  function keepColorModeSynced(config) {
    state.appearanceCleanup?.();
    const owner = state.owner, root = state.root;
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const refresh = () => { if (root === state.root && owner === accountOwner() && !document.hidden) applyColorMode(config, root); };
    const timer = config.mode === "schedule" ? setInterval(refresh, 30000) : 0;
    if (config.mode === "system") media?.addEventListener?.("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    state.appearanceCleanup = () => {
      if (timer) clearInterval(timer);
      media?.removeEventListener?.("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    refresh();
  }

  function applyToolAppearance(config) {
    if (config.accent) state.root.style.setProperty("--pt-cyan", config.accent);
    if (config.highlight) state.root.style.setProperty("--pt-pink", config.highlight);
    if (config.fontScale) state.root.style.fontSize = `${Number(config.fontScale) / 100}rem`;
    state.root.dataset.contrast = config.contrast || "normal";
    keepColorModeSynced({ mode: config.mode || config.colorMode || "system", lightStart: config.lightStart, darkStart: config.darkStart });
  }

  function previewTheme(config) {
    const preview = state.root.querySelector(".pt-theme-preview");
    if (!preview) return;
    preview.style.setProperty("--pt-preview-accent", config.accent);
    preview.style.setProperty("--pt-preview-highlight", config.highlight);
    preview.style.fontSize = `${Number(config.fontScale) / 100}rem`;
    preview.classList.toggle("is-high-contrast", config.contrast === "high");
  }

  async function addNotification() {
    const data = values(), owner = state.owner, root = state.root;
    const title = data.title.trim(), message = data.message.trim();
    if (!title || !message) throw new Error("Hãy nhập tiêu đề và nội dung thông báo.");
    const row = { id: uid(), title, message, priority: data.priority, read: false, createdAt: Date.now() };
    await dbPut("notifications", row, owner);
    publishNotificationSignal(owner);
    assertAccount(owner);
    let systemWarning = "";
    if (data.priority !== "silent" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body: message, tag: row.id, silent: true }); }
      catch { systemWarning = "Thông báo đã lưu cục bộ; trình duyệt không cho tạo thông báo hệ thống."; }
    }
    await record("notification.send", { priority: data.priority }, "Realtime Notification", owner);
    if (root !== state.root) return;
    await render(state.root.parentElement, state.active);
    if (systemWarning) status(systemWarning, "warning");
  }

  function publishNotificationSignal(owner = activeOwner()) {
    assertAccount(owner);
    try { localStorage.setItem(`hh.all-tools.notification-signal.v1.${owner}`, JSON.stringify({ changedAt: Date.now(), id: uid() })); }
    catch { /* Primary IndexedDB write remains valid even if optional cross-tab signalling is unavailable. */ }
  }

  function startSkeleton() {
    clearTimeout(state.skeletonTimer);
    const data = values(), stage = state.root.querySelector("[data-pt-skeleton-stage]"), count = Math.max(1, Math.min(12, Number(data.count) || 6));
    stage.setAttribute("aria-busy", "true");
    stage.className = `pt-skeleton-stage is-loading pattern-${data.pattern}`;
    stage.innerHTML = `<div class="pt-skeleton-grid">${Array.from({ length: count }, () => '<div class="pt-skeleton-item"><i></i><b></b><span></span><span></span></div>').join("")}</div>`;
    state.root.querySelector("[data-pt-skeleton-state]").textContent = "Đang kiểm thử";
    state.skeletonTimer = setTimeout(stopSkeleton, Math.max(500, Math.min(10000, Number(data.duration) || 1800)));
    status("Skeleton đang chạy trong preview.", "running");
  }

  function skeletonDocument(config) {
    const pattern = ["cards", "article", "dashboard"].includes(config.pattern) ? config.pattern : "cards", count = Math.max(1, Math.min(12, Number(config.count) || 6));
    return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skeleton ${pattern}</title><style>body{margin:24px;background:#0b1020;color:#eaf4ff;font-family:system-ui,sans-serif}.skeleton{display:grid;grid-template-columns:repeat(${pattern === "article" ? 1 : pattern === "dashboard" ? 3 : 2},minmax(0,1fr));gap:16px}.skeleton article{padding:16px;border:1px solid #425674;border-radius:14px;background:#111b2e}.skeleton span{display:block;height:14px;margin:10px 0;border-radius:6px;background:linear-gradient(90deg,#263753,#456284,#263753);background-size:200% 100%;animation:shimmer 1.6s ease-in-out infinite}.skeleton .media{height:110px}.skeleton .short{width:60%}@keyframes shimmer{to{background-position:-200% 0}}@media(max-width:600px){.skeleton{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.skeleton span{animation:none}}@media(forced-colors:active){.skeleton article{border:1px solid CanvasText}.skeleton span{background:GrayText}}</style><h1>Đang tải nội dung</h1><p role="status">Vui lòng chờ tác vụ hoàn tất.</p><section class="skeleton" aria-busy="true" aria-label="Nội dung đang tải">${Array.from({ length: count }, () => '<article aria-hidden="true"><span class="media"></span><span class="short"></span><span></span><span class="short"></span></article>').join("")}</section><!-- Replace this section with your real content and set aria-busy=false once the real task finishes. --></html>`;
  }

  function stopSkeleton() {
    clearTimeout(state.skeletonTimer);
    const stage = state.root?.querySelector("[data-pt-skeleton-stage]");
    if (!stage) return;
    stage.removeAttribute("aria-busy");
    stage.className = "pt-skeleton-stage";
    stage.innerHTML = '<div class="pt-demo-content"><h4>Nội dung đã tải xong</h4><p>Skeleton được gỡ đúng thời điểm, không ảnh hưởng phần còn lại.</p></div>';
    state.root.querySelector("[data-pt-skeleton-state]").textContent = "Hoàn thành";
    status("Kiểm thử skeleton hoàn thành.", "success");
  }

  function startProgress() {
    cancelAnimationFrame(state.progressFrame);
    state.progressDetach?.(); state.progressDetach = null;
    const data = values(), root = state.root;
    const progress = root.querySelector("[data-pt-progress]"), model = state.progress;
    model.mode = data.progressType; model.running = true;
    const paint = (value, detail) => {
      if (root !== state.root || !model.running) return;
      model.value = Math.max(0, Math.min(100, value));
      progress.value = model.value;
      root.querySelector("[data-pt-progress-label]").textContent = `${Math.round(model.value)}%`;
      root.querySelector("[data-pt-progress-detail]").textContent = detail;
    };
    if (model.mode === "page") {
      let container = root.parentElement;
      while (container && container !== document.body && container.scrollHeight <= container.clientHeight + 1) container = container.parentElement;
      const page = container && container !== document.body ? container : document.scrollingElement;
      if (!page) throw new Error("Chưa có vùng cuộn trang để đo.");
      const onScroll = () => { if (model.mode === "page") paint(page.scrollTop / Math.max(1, page.scrollHeight - page.clientHeight) * 100, "Vị trí cuộn thực của vùng chứa trang All Tools."); };
      const eventTarget = page === document.scrollingElement ? document : page;
      eventTarget.addEventListener("scroll", onScroll, { passive: true }); state.progressDetach = () => eventTarget.removeEventListener("scroll", onScroll);
      onScroll(); return status("Đang theo dõi vị trí cuộn trang thực.", "running");
    }
    if (model.mode === "events") {
      const onProgress = event => {
        if (model.mode !== "events" || !Number.isFinite(Number(event.detail?.value))) return;
        paint(Number(event.detail.value), `${String(event.detail.label || "Tác vụ đang phát sự kiện").slice(0, 160)} · ${String(event.detail.state || "running").slice(0, 30)}`);
      };
      addEventListener("hh:progress", onProgress); state.progressDetach = () => removeEventListener("hh:progress", onProgress);
      return status("Đang chờ sự kiện tiến trình; chưa có tác vụ nào được giả lập.", "running");
    }
    if (model.mode === "scroll") {
      const sample = root.querySelector("[data-pt-scroll-sample]");
      const onScroll = () => { if (model.mode === "scroll") paint(sample.scrollTop / Math.max(1, sample.scrollHeight - sample.clientHeight) * 100, "Vị trí cuộn thực trong sandbox."); };
      sample.addEventListener("scroll", onScroll, { passive: true }); state.progressDetach = () => sample.removeEventListener("scroll", onScroll);
      paint(sample.scrollTop / Math.max(1, sample.scrollHeight - sample.clientHeight) * 100, "Cuộn vùng nội dung để theo dõi tiến trình thật.");
      return status("Đang đo vị trí cuộn, không mô phỏng tải trang.", "running");
    }
    if (model.value >= 100) model.elapsed = 0;
    model.duration = Math.max(500, Math.min(15000, Number(data.duration) || 4000));
    const start = performance.now() - model.elapsed;
    const tick = (now) => {
      if (!model.running || root !== state.root) return;
      model.elapsed = now - start;
      const ratio = Math.min(1, model.elapsed / model.duration);
      paint(ratio * 100, `Mô phỏng sandbox · ${Math.round(model.elapsed)} ms`);
      if (ratio < 1) state.progressFrame = requestAnimationFrame(tick);
      else { model.running = false; status("Mô phỏng đã hoàn thành; không có API/tệp nào được tải.", "success"); }
    };
    state.progressFrame = requestAnimationFrame(tick);
    status("Đang chạy mô phỏng riêng trong sandbox.", "running");
  }

  function setupLongTasks() {
    if (state.longTaskObserver) return;
    if (!("PerformanceObserver" in window) || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
    const observer = new PerformanceObserver((list) => {
      state.fps.longTasks += list.getEntries().length;
      const node = state.root?.querySelector("[data-pt-long]");
      if (node) node.textContent = state.fps.longTasks;
    });
    observer.observe({ type: "longtask" });
    state.longTaskObserver = observer;
  }

  function startFps() {
    if (state.fps.running) return;
    state.fps.running = true;
    state.fps.last = performance.now();
    setupLongTasks();
    const tick = (now) => {
      if (!state.fps.running) return;
      const frame = now - state.fps.last;
      state.fps.last = now;
      if (frame > 0 && frame < 1000) state.fps.samples.push({ at: Date.now(), frame, fps: Math.min(240, 1000 / frame) });
      const cutoff = Date.now() - 60000;
      state.fps.samples = state.fps.samples.filter((sample) => sample.at >= cutoff).slice(-3600);
      if (state.fps.samples.length % 8 === 0) paintFps();
      state.fpsFrame = requestAnimationFrame(tick);
    };
    state.fpsFrame = requestAnimationFrame(tick);
    status("Đang đo FPS thực bằng requestAnimationFrame.", "running");
  }

  function paintFps() {
    const samples = state.fps.samples, recent = samples.slice(-120), last = recent.at(-1);
    if (!last || !state.root) return;
    const frames = samples.map((item) => item.frame).sort((a, b) => a - b), p95 = frames[Math.floor(frames.length * .95)] || last.frame;
    state.root.querySelector("[data-pt-fps]").textContent = Math.round(last.fps);
    state.root.querySelector("[data-pt-frame]").textContent = `${last.frame.toFixed(1)} ms`;
    state.root.querySelector("[data-pt-p95]").textContent = `${p95.toFixed(1)} ms`;
    const canvas = state.root.querySelector("[data-pt-fps-chart]");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(320, rect.width * ratio); canvas.height = 260 * ratio;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.scale(ratio, ratio); const width = canvas.width / ratio, height = canvas.height / ratio;
    ctx.clearRect(0, 0, width, height); ctx.strokeStyle = "#293847"; ctx.lineWidth = 1;
    [30, 60, 90].forEach((fps) => { const y = height - fps / 120 * height; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); });
    const gradient = ctx.createLinearGradient(0, 0, width, 0); gradient.addColorStop(0, "#52d9e2"); gradient.addColorStop(1, "#ff63bf"); ctx.strokeStyle = gradient; ctx.lineWidth = 2; ctx.beginPath();
    recent.forEach((item, index) => { const x = index / Math.max(1, recent.length - 1) * width, y = height - Math.min(120, item.fps) / 120 * height; if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  }

  async function moveFavorite(id, direction = -1, targetId = null) {
    const owner = state.owner, root = state.root;
    const rows = (await dbAll("favorites", owner)).sort((a, b) => a.order - b.order), index = rows.findIndex((row) => row.id === id);
    const next = targetId ? rows.findIndex((row) => row.id === targetId) : index + direction;
    if (index < 0 || next < 0 || next >= rows.length || index === next) return;
    const [row] = rows.splice(index, 1); rows.splice(next, 0, row);
    await Promise.all(rows.map((item, order) => dbPut("favorites", { ...item, order }, owner)));
    if (root !== state.root) return;
    await render(state.root.parentElement, state.active);
    state.root?.querySelector(`[data-pt-favorite-open="${CSS.escape(id)}"]`)?.focus();
  }

  const safeKey = (key) => key.startsWith(`${localPrefix(activeOwner())}draft:`) && !/(token|secret|password|credential|session)/i.test(key);
  async function buildExport() {
    const owner = state.owner, root = state.root;
    const data = values(), scopes = Object.fromEntries([...root.querySelectorAll('input[name="scope"]')].filter(node => node.name === "scope").map(node => [node.value, node.checked])), payload = { format: "HH Platform Tools Export", version: 2, owner, exportedAt: new Date().toISOString(), data: {} };
    if (!Object.values(scopes).some(Boolean)) throw new Error("Chọn ít nhất một phạm vi để xuất.");
    if (scopes[6] && !scopes[5]) throw new Error("Chọn phạm vi workspace trước khi xuất nội dung tệp.");
    if (scopes[0]) payload.data.settings = await dbAll("settings", owner);
    if (scopes[1]) payload.data.history = await dbAll("history", owner);
    if (scopes[2]) payload.data.favorites = await dbAll("favorites", owner);
    if (scopes[3]) payload.data.notifications = await dbAll("notifications", owner);
    assertAccount(owner); if (root !== state.root) return;
    if (scopes[4]) payload.data.local = Object.fromEntries(Object.keys(localStorage).filter(safeKey).map((key) => [key, localStorage.getItem(key)]));
    if (scopes[5] && data.format !== "csv") {
      if (!window.HHAllToolState?.exportWorkspaceBackup) throw new Error("Bộ sao lưu workspace chưa sẵn sàng; hãy mở lại All Tools.");
      payload.data.workspace = await window.HHAllToolState.exportWorkspaceBackup(owner, { includeFiles: Boolean(scopes[6]), maxBytes: 4 * 1024 * 1024 });
      assertAccount(owner); if (root !== state.root) return;
    }
    if (data.format === "csv") {
      const rows = payload.data.history || [];
      state.generatedExport = ["id,tool,action,createdAt", ...rows.map((row) => [row.id, row.name, row.action, new Date(row.createdAt).toISOString()].map((value) => {
        const text = String(value); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
      }).join(","))].join("\n");
    } else state.generatedExport = JSON.stringify(payload, null, 2);
    if (new Blob([state.generatedExport]).size > 5 * 1024 * 1024) { state.generatedExport = ""; throw new Error("Tệp sao lưu vượt 5 MB; giảm phạm vi hoặc bỏ nội dung tệp."); }
    output(state.generatedExport);
    state.exportFormat = data.format;
    state.root.querySelector("[data-pt-export-size]").textContent = formatBytes(new Blob([state.generatedExport]).size);
    state.root.querySelector('[data-pt-action="export-download"]').disabled = false;
    status("Bản xuất đã sẵn sàng; chưa có dữ liệu nào rời thiết bị.", "success");
  }

  async function validateImport() {
    const root = state.root, owner = state.owner;
    state.importPayload = null;
    state.root.querySelector('[data-pt-action="import-commit"]').disabled = true;
    const file = state.importFile || state.root.querySelector('input[name="importFile"]').files?.[0];
    if (!file) throw new Error("Hãy chọn một tệp JSON.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Tệp vượt quá giới hạn 5 MB.");
    const text = await file.text(); assertAccount(owner);
    if (root !== state.root) return;
    const payload = normalizeImport(JSON.parse(text));
    state.importPayload = payload;
    output({ valid: true, exportedAt: payload.exportedAt, scopes: Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, Array.isArray(value) ? value.length : Object.keys(value || {}).length])) });
    state.root.querySelector("[data-pt-import-status]").textContent = "Schema và từng bản ghi hợp lệ";
    state.root.querySelector('[data-pt-action="import-commit"]').disabled = false;
    status("Tệp hợp lệ. Kiểm tra xem trước rồi xác nhận nhập vào tài khoản hiện tại.", "success");
  }

  function normalizeImport(payload) {
    if (!payload || payload.format !== "HH Platform Tools Export" || ![1, 2].includes(payload.version) || !payload.data || typeof payload.data !== "object") throw new Error("Schema không đúng định dạng HH Platform Tools Export v1/v2.");
    if (payload.version === 2 && payload.owner !== activeOwner()) throw new Error("Tệp sao lưu thuộc tài khoản khác; không nhập hoặc trộn dữ liệu.");
    if (Array.isArray(payload.data)) throw new Error("Phạm vi dữ liệu phải là một object.");
    const allowed = ["settings", "history", "favorites", "notifications", "local", "workspace"], unknown = Object.keys(payload.data).filter((key) => !allowed.includes(key));
    if (unknown.length) throw new Error(`Phạm vi không được hỗ trợ: ${unknown.join(", ")}`);
    const text = (value, max, label) => { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} không hợp lệ.`); return value; };
    const timestamp = (value) => { if (!Number.isFinite(value) || value < 0 || value > 8640000000000000) throw new Error("Thời gian bản ghi không hợp lệ."); return value; };
    const normalized = { format: payload.format, version: payload.version, owner: payload.owner, exportedAt: payload.exportedAt, data: {} };
    Object.entries(payload.data).forEach(([name, rows]) => {
      if (name === "workspace") {
        if (payload.version !== 2 || !window.HHAllToolState?.normalizeWorkspaceBackup) throw new Error("Bản sao workspace cần định dạng v2 và bộ kiểm tra đã tải.");
        normalized.data.workspace = window.HHAllToolState.normalizeWorkspaceBackup(rows, activeOwner());
        return;
      }
      if (name === "local") {
        if (!rows || typeof rows !== "object" || Array.isArray(rows)) throw new Error("Bản nháp local không hợp lệ.");
        normalized.data.local = Object.fromEntries(Object.entries(rows).map(([key, value]) => {
          if (!safeKey(key) || !key.startsWith(`${localPrefix(activeOwner())}draft:`) || typeof value !== "string" || value.length > 100000) throw new Error("Bản nháp không thuộc kho All Tools của tài khoản này; dữ liệu workspace khác không được nhập.");
          const draft = JSON.parse(value);
          if (!Array.isArray(draft) || draft.length > 50 || draft.some((item) => !item || typeof item.name !== "string" || typeof item.value !== "string" || item.value.length > 10000 || ["file", "password"].includes(item.type))) throw new Error("Schema bản nháp không hợp lệ.");
          return [key, value];
        }));
        return;
      }
      if (!Array.isArray(rows) || rows.length > 1000) throw new Error(`${name}: tối đa 1.000 bản ghi dạng mảng.`);
      const ids = new Set();
      normalized.data[name] = rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Bản ghi không hợp lệ.");
        const id = text(row.id, 180, "ID");
        if (/[<>"'\x00-\x1f]/.test(id) || ids.has(id)) throw new Error("ID không an toàn hoặc bị trùng trong tệp.");
        ids.add(id);
        if (name === "settings") return { id, value: validateSetting(id.replace(/^setting:/, ""), row.value), updatedAt: timestamp(row.updatedAt || Date.now()) };
        if (name === "favorites") return { id, title: text(row.title, 160, "Tên"), route: validRoute(row.route), folder: typeof row.folder === "string" ? row.folder.slice(0, 80) : "", order: Number.isFinite(row.order) ? row.order : 0, createdAt: timestamp(row.createdAt) };
        if (name === "notifications") return { id, title: text(row.title, 80, "Tiêu đề"), message: text(row.message, 240, "Nội dung"), priority: ["normal", "high", "silent"].includes(row.priority) ? row.priority : "silent", read: row.read === true, createdAt: timestamp(row.createdAt) };
        const manifest = byId.get(row.tool); if (!manifest) throw new Error("Lịch sử chứa công cụ không tồn tại.");
        // Legacy detail can contain unrelated imported secrets. Retain only safe action metadata.
        return { id, tool: manifest.id, name: manifest.name, action: text(row.action, 100, "Hành động"), detail: {}, createdAt: timestamp(row.createdAt) };
      });
    });
    return normalized;
  }

  function validateSetting(key, value) {
    if (key === "themeUndo" && value && typeof value === "object" && !Array.isArray(value)) {
      const allowed = ["colorMode", "mode", "lightStart", "darkStart", "accent", "highlight", "fontScale", "contrast", "density", "historyEnabled", "autosave", "reducedMotion"];
      return Object.fromEntries(Object.entries(value).filter(([name]) => allowed.includes(name)).map(([name, entry]) => [name, validateSetting(name === "mode" ? "colorMode" : name, entry)]));
    }
    if (["historyEnabled", "autosave", "reducedMotion"].includes(key) && typeof value === "boolean") return value;
    const enums = { colorMode: ["system", "light", "dark", "schedule"], density: ["comfortable", "compact"], contrast: ["normal", "high"] };
    if (enums[key]?.includes(value)) return value;
    if (["accent", "highlight"].includes(key) && /^#[a-f0-9]{6}$/i.test(value)) return value;
    if (key === "fontScale" && Number.isFinite(Number(value)) && Number(value) >= 85 && Number(value) <= 125) return Number(value);
    if (["lightStart", "darkStart"].includes(key) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    if (key === "shortcuts" && Array.isArray(value) && value.length <= 30) {
      const combos = new Set();
      return value.map((row, index) => {
        if (!row || typeof row.label !== "string" || !row.label.trim() || row.label.length > 80 || !["home", "palette", "tools", "theme"].includes(row.action)) throw new Error("Phím tắt nhập không hợp lệ.");
        const combo = canonicalCombo(row.combo);
        if (combos.has(combo)) throw new Error("Phím tắt bị trùng."); combos.add(combo);
        return { id: `import-${index}`, label: row.label, action: row.action, combo };
      });
    }
    throw new Error(`Cài đặt không hợp lệ hoặc chưa được hỗ trợ: ${key}`);
  }

  async function commitImport() {
    if (!state.importPayload) throw new Error("Chưa có tệp đã được kiểm tra.");
    const root = state.root, owner = state.owner, strategy = values().strategy, data = normalizeImport(state.importPayload).data;
    if (!["merge", "skip", "replace"].includes(strategy)) throw new Error("Chiến lược nhập không hợp lệ.");
    if (strategy === "replace" && state.confirmedImport !== state.importPayload) {
      state.confirmedImport = state.importPayload;
      return askConfirmation("import-commit", "Thay thế các phạm vi có trong tệp sẽ ghi đè dữ liệu hiện tại. Dữ liệu các phạm vi khác không thay đổi. Tiếp tục?");
    }
    assertAccount(owner);
    const names = ["settings", "history", "favorites", "notifications"].filter(name => Array.isArray(data[name]));
    const snapshots = Object.fromEntries(await Promise.all(names.map(async name => [name, await dbAll(name, owner)])));
    const appearanceKey = window.HHAllToolState?.key?.("hh.all-tools.appearance.v1", owner);
    const localKeys = new Set([...Object.keys(localStorage).filter(safeKey), ...Object.keys(data.local || {}), ...(appearanceKey ? [appearanceKey] : [])]);
    const localSnapshot = Object.fromEntries([...localKeys].map(key => [key, localStorage.getItem(key)]));
    const workspacePlan = data.workspace ? await window.HHAllToolState.prepareWorkspaceImport(data.workspace, { owner, strategy }) : null;
    let ownAttempted = false, workspaceAttempted = false;
    try {
      assertAccount(owner);
      if (data.local) {
        if (strategy === "replace") Object.keys(localStorage).filter(safeKey).forEach(key => localStorage.removeItem(key));
        for (const [key, value] of Object.entries(data.local)) if (strategy !== "skip" || localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      ownAttempted = true;
      await applyStoreBatch(data, strategy, owner);
      assertAccount(owner);
      if (workspacePlan) { workspaceAttempted = true; await workspacePlan.apply(); }
      if (names.includes("settings")) {
        const importedSettings = Object.fromEntries((await dbAll("settings", owner)).map(row => [row.id.replace(/^setting:/, ""), row.value]));
        publishAppearance(importedSettings, owner); state.shortcutCache = importedSettings.shortcuts || null;
      }
    } catch (error) {
      const rollbackErrors = [];
      if (workspaceAttempted) try { await workspacePlan.rollback(); } catch (rollbackError) { rollbackErrors.push(`workspace: ${rollbackError.message}`); }
      if (ownAttempted) try { await applyStoreBatch(snapshots, "replace", owner); } catch (rollbackError) { rollbackErrors.push(`Platform: ${rollbackError.message}`); }
      for (const [key, value] of Object.entries(localSnapshot)) try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (rollbackError) { rollbackErrors.push(`local: ${rollbackError.message}`); }
      if (rollbackErrors.length) throw new Error(`Nhập thất bại (${error.message}). Hoàn tác CHƯA đầy đủ: ${rollbackErrors.join("; ")}. Giữ tệp sao lưu và kiểm tra lại dữ liệu.`);
      throw new Error(`Nhập thất bại (${error.message}). Đã hoàn tác các phạm vi vừa thay đổi.`);
    }
    let auditWarning = "";
    try { await dbPut("imports", { id: uid(), strategy, scopes: Object.keys(data), createdAt: Date.now() }, owner); await record("import.commit", { strategy, scopes: Object.keys(data) }, "Import Data", owner); }
    catch { auditWarning = " Dữ liệu đã nhập nhưng chưa ghi được lịch sử nhập."; }
    if (root !== state.root || owner !== accountOwner()) return;
    state.importPayload = null;
    state.confirmedImport = null; state.drafts.clear();
    state.root.querySelector('[data-pt-action="import-commit"]').disabled = true;
    output({ imported: Object.keys(data), strategy, workspace: workspacePlan?.report || null });
    status(`${state.storageTemporary ? "Đã nhập; kho IndexedDB không khả dụng nên phần Platform chỉ ở bộ nhớ tạm." : "Đã nhập và lưu các phạm vi All Tools đã chọn."} Các chức năng ngoài All Tools không thay đổi.${auditWarning}`, state.storageTemporary || auditWarning ? "warning" : "success");
  }

  async function applyStoreBatch(data, strategy, owner) {
    const names = ["settings", "history", "favorites", "notifications"].filter(name => Array.isArray(data[name]));
    if (!names.length) return;
    const existing = Object.fromEntries(await Promise.all(names.map(async name => [name, new Set((await dbAll(name, owner)).map(row => row.id))])));
    assertAccount(owner); const db = await openDb(owner);
    try { assertAccount(owner); } catch (error) { db?.close(); throw error; }
    if (!db) {
      if (!memory.has(owner)) memory.set(owner, Object.fromEntries(STORE_NAMES.map(name => [name, new Map()])));
      const staged = Object.fromEntries(names.map(name => [name, strategy === "replace" ? new Map() : new Map(memory.get(owner)[name])]));
      names.forEach(name => data[name].forEach(row => { if (strategy !== "skip" || !existing[name].has(row.id)) staged[name].set(row.id, structuredClone(row)); }));
      names.forEach(name => { memory.get(owner)[name] = staged[name]; }); state.storageTemporary = true; return;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(names, "readwrite");
      names.forEach(name => { const store = transaction.objectStore(name); if (strategy === "replace") store.clear(); data[name].forEach(row => { if (strategy !== "skip" || !existing[name].has(row.id)) store.put(row); }); });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Transaction IndexedDB đã hoàn tác.")); };
      transaction.onerror = () => { /* onabort handles transaction-level rollback and closes the database. */ };
    });
  }

  async function inspectPwa(kind) {
    const root = state.root, owner = state.owner;
    const registration = await navigator.serviceWorker?.getRegistration?.();
    const cacheNames = "caches" in window ? await caches.keys() : [];
    const estimate = await navigator.storage?.estimate?.();
    const report = [
      ["Kết nối", navigator.onLine ? "Online" : "Offline"],
      ["Ngữ cảnh an toàn", window.isSecureContext ? "HTTPS hoặc localhost an toàn" : "Không an toàn; PWA có thể bị chặn"],
      ["Service Worker", registration?.active ? `Active · ${registration.scope}` : registration ? "Đã đăng ký, chưa active" : "Chưa đăng ký"],
      ["Cache", `${cacheNames.length} kho`],
      ["Lưu trữ", estimate ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}` : "Không hỗ trợ"],
      ["Cài đặt", typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches ? "Đang chạy standalone" : state.installPrompt ? "Có thể cài" : "Chưa đủ tiêu chí / không hỗ trợ"]
    ];
    if (kind === "Offline Mode" && "caches" in window) {
      const assetPaths = Object.values(OFFLINE_SUITES).flat();
      const currentUrls = new Map(assetPaths.map(asset => [asset, new URL(offlineAssetUrl(asset), location.href).href]));
      const cached = new Set();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const url = new URL(request.url, location.href);
          assetPaths.forEach((asset) => { if (url.origin === location.origin && url.href === currentUrls.get(asset)) cached.add(asset); });
        }
      }
      assetPaths.forEach((asset) => report.push([asset, cached.has(asset) ? "Đã có bản đang dùng trong cache" : "Chưa lưu bản đang dùng offline"]));
      report.push(["Giới hạn", "API/máy chủ không hoạt động khi offline. Không có hàng đợi đồng bộ trong công cụ này."]);
    }
    if (root !== state.root || owner !== accountOwner()) return;
    state.root.querySelector("[data-pt-pwa-report]").innerHTML = report.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join("");
    status(`Đã kiểm tra ${kind} bằng API trình duyệt.`, "success");
  }

  const OFFLINE_SUITES = Object.freeze({
    platform: ["all-tool-state.js", "tool-manifests.js", "tool-runtime.js", "feature-lab.js", "feature-lab.css", "platform-tools.js", "platform-tools.css"],
    workspace: ["tool-workspace-pro.js", "tool-workspace-pro.css"],
    utility: ["utility-lab-tools.js", "utility-lab-tools.css"]
  });
  function offlineAssetUrl(asset) {
    if (!Object.values(OFFLINE_SUITES).flat().includes(asset)) throw new Error("Tài nguyên không thuộc danh sách public All Tools.");
    const source = [...document.querySelectorAll("script[src],link[href]")].map(node => node.src || node.href).find(value => {
      const url = new URL(value, location.href); return url.origin === location.origin && url.pathname === `/${asset}`;
    });
    return source || new URL(`/${asset}`, location.href).href;
  }
  async function readBoundedAsset(response, limit = 8 * 1024 * 1024) {
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Tệp vượt giới hạn 8 MB.");
    if (!response.body?.getReader) { const bytes = await response.arrayBuffer(); if (bytes.byteLength > limit) throw new Error("Tệp vượt giới hạn 8 MB."); return bytes; }
    const reader = response.body.getReader(), chunks = []; let length = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) { await reader.cancel(); throw new Error("Tệp vượt giới hạn 8 MB."); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; }); return bytes;
  }
  async function prepareOffline() {
    const root = state.root, owner = state.owner;
    if (!("caches" in window) || !window.isSecureContext) throw new Error("Cần HTTPS/localhost và Cache Storage để lưu offline.");
    if (!navigator.onLine) throw new Error("Cần kết nối mạng để tải lần đầu.");
    const suites = [...root.querySelectorAll('input[name="offlineSuite"]:checked')].map(node => node.value);
    const assets = [...new Set(suites.flatMap(suite => OFFLINE_SUITES[suite] || []))];
    if (!assets.length) throw new Error("Chọn ít nhất một bộ công cụ.");
    state.offlineController?.abort(); const controller = new AbortController(); state.offlineController = controller;
    const cache = await caches.open("hh-alltools-offline-v2"), saved = [], failed = []; let bytes = 0;
    for (let index = 0; index < assets.length; index++) {
      assertAccount(owner); if (root !== state.root) return; if (controller.signal.aborted) break;
      const asset = assets[index], url = offlineAssetUrl(asset), timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, { cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal });
        if (!response.ok || new URL(response.url || url).origin !== location.origin) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get("content-type") || "";
        if (!/(?:javascript|css)/i.test(type)) throw new Error("Không phải JS/CSS public hợp lệ.");
        const content = await readBoundedAsset(response); bytes += content.byteLength;
        if (bytes > 15 * 1024 * 1024) throw new Error("Tổng tài nguyên vượt giới hạn 15 MB.");
        assertAccount(owner); if (root !== state.root || controller.signal.aborted) throw new Error("Đã dừng tải tài nguyên.");
        await cache.put(url, new Response(content, { status: 200, headers: { "Content-Type": type } })); saved.push(asset);
      } catch (error) { failed.push(`${asset}: ${error.message}`); if (controller.signal.aborted || bytes > 15 * 1024 * 1024) break; }
      finally { clearTimeout(timeout); }
      if (root === state.root) root.querySelector("[data-pt-offline-progress]").value = Math.round((index + 1) / assets.length * 100);
    }
    if (state.offlineController === controller) state.offlineController = null;
    if (root !== state.root || owner !== accountOwner()) return;
    root.querySelector("[data-pt-pwa-report]").innerHTML = `<article><span>Đã lưu</span><b>${saved.length}/${assets.length} tệp · ${formatBytes(bytes)}</b></article>${saved.map(asset => `<article><span>${esc(asset)}</span><b>Đã lưu cache riêng</b></article>`).join("")}${failed.map(message => `<article><span>Lỗi tải</span><b>${esc(message)}</b></article>`).join("")}`;
    status(`Đã lưu ${saved.length}/${assets.length} tài nguyên. Đây không phải bản sao toàn website; backend/AI vẫn cần mạng.`, saved.length === assets.length ? "success" : "warning");
  }

  const normalizeCombo = (event) => [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join("+");
  function canonicalCombo(value) {
    const parts = String(value || "").replace(/\s/g, "").split("+");
    const modifierNames = { ctrl: "Ctrl", control: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta", cmd: "Meta" };
    const key = parts.pop(), modifiers = parts.map((part) => modifierNames[part.toLowerCase()]);
    if (!modifiers.length || modifiers.some((part) => !part) || new Set(modifiers).size !== modifiers.length || !/^(?:[a-z0-9]|enter|escape|space)$/i.test(key)) throw new Error("Tổ hợp không hợp lệ. Ví dụ: Ctrl+Shift+H.");
    const normalizedKey = key.length === 1 ? key.toUpperCase() : { enter: "Enter", escape: "Escape", space: "Space" }[key.toLowerCase()];
    const combo = ["Ctrl", "Alt", "Shift", "Meta"].filter((modifier) => modifiers.includes(modifier)).concat(normalizedKey).join("+");
    if (/^(?:Ctrl|Meta)\+(?:W|R|L|T|N|P|S|O|F|A|C|V|X|Z|Y)$/.test(combo)) throw new Error("Tổ hợp dành cho trình duyệt hoặc chỉnh sửa văn bản; hãy chọn thêm Alt/Shift.");
    return combo;
  }
  async function getShortcuts() {
    const owner = activeOwner(), root = state.root;
    const settings = await readSettings(owner);
    const rows = settings.shortcuts || [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }];
    if (owner === accountOwner() && root === state.root) state.shortcutCache = rows;
    return rows;
  }

  function executeShortcut(action) {
    if (action === "home") navigate("/platform");
    if (action === "palette") { if (window.HHFeatureLab?.select) window.HHFeatureLab.select("Command Palette++"); else render(state.root.parentElement, "Command Palette++"); }
    if (action === "tools") { const catalog = document.querySelector("[data-all-tools-catalog]") || state.root?.closest(".feature-lab")?.querySelector("[data-lab-nav]"); if (catalog) { catalog.focus?.(); catalog.scrollIntoView?.({ block: "nearest" }); } else navigate("/tools"); }
    if (action === "theme") { if (window.HHFeatureLab?.select) window.HHFeatureLab.select("Dark Light Auto Mode"); else render(state.root.parentElement, "Dark Light Auto Mode"); }
  }

  async function handleAction(action, target) {
    const owner = state.owner, root = state.root, tool = state.active;
    assertAccount(owner);
    if (["history-clear", "history-clear-recent", "notification-clear", "settings-reset"].includes(action) && state.confirmedAction !== action) return askConfirmation(action, "Thao tác này chỉ xóa dữ liệu All Tools của tài khoản hiện tại. Bạn muốn tiếp tục?");
    state.confirmedAction = null;
    if (action === "search") return runSearch(false);
    if (action === "appearance-preview" || action === "appearance-apply") {
      const data = values(); validateSetting("colorMode", data.mode);
      if (data.mode === "schedule") { validateSetting("lightStart", data.lightStart); validateSetting("darkStart", data.darkStart); if (data.lightStart === data.darkStart) throw new Error("Giờ bắt đầu sáng và tối phải khác nhau."); }
      const mode = applyColorMode(data, action.endsWith("apply") ? state.root : state.root.querySelector("[data-pt-mode-preview]"));
      if (action.endsWith("apply")) { await Promise.all(Object.entries({ colorMode: data.mode, lightStart: data.lightStart, darkStart: data.darkStart }).map(([key, value]) => saveSetting(key, value, owner))); const previous = await readSettings(owner); publishAppearance({ ...previous, ...data }, owner); if (root !== state.root) return; keepColorModeSynced(data); await record("appearance.apply", { mode }, tool, owner); }
      return status(`${action.endsWith("apply") ? "Đã lưu" : "Đang xem trước"} chế độ ${mode}.`, "success");
    }
    if (action === "appearance-reset") { await saveSetting("colorMode", "system", owner); publishAppearance({ ...await readSettings(owner), mode: "system" }, owner); if (root !== state.root) return; keepColorModeSynced({ mode: "system" }); return render(root.parentElement, tool); }
    if (action === "theme-preview") { previewTheme(values()); return status("Đang xem trước, website chưa thay đổi.", "running"); }
    if (action === "theme-apply") {
      const data = values(); ["accent", "highlight", "fontScale", "contrast"].forEach((key) => { data[key] = validateSetting(key, data[key]); });
      const previous = await readSettings(owner); assertAccount(owner); if (root !== state.root) return;
      state.themeUndo = { settings: previous };
      await saveSetting("themeUndo", { ...previous, themeUndo: undefined }, owner);
      const appearance = { ...state.themeUndo.settings, ...data };
      await Promise.all(["accent", "highlight", "fontScale", "contrast"].map((key) => saveSetting(key, data[key], owner))); publishAppearance(appearance, owner); if (root !== state.root) return; applyToolAppearance(appearance); root.querySelector('[data-pt-action="theme-undo"]').disabled = false; await record("theme.apply", { contrast: data.contrast }, tool, owner); return status("Đã áp dụng và lưu giao diện riêng All Tools.", "success");
    }
    if (action === "theme-undo") {
      const savedUndo = (await readSettings(owner)).themeUndo;
      const undo = state.themeUndo || (savedUndo ? { settings: savedUndo } : null);
      if (!undo) throw new Error("Chưa có giao diện trước đó để hoàn tác.");
      state.root.style.removeProperty("--pt-cyan"); state.root.style.removeProperty("--pt-pink"); state.root.style.fontSize = "";
      await Promise.all(["accent", "highlight", "fontScale", "contrast"].map((key) => undo.settings[key] === undefined ? dbDelete("settings", settingId(key), owner) : saveSetting(key, undo.settings[key], owner)));
      publishAppearance(undo.settings, owner); if (root !== state.root) return; applyToolAppearance(undo.settings);
      state.themeUndo = null; state.root.querySelector('[data-pt-action="theme-undo"]').disabled = true;
      await dbDelete("settings", settingId("themeUndo"), owner);
      return status("Đã hoàn tác giao diện và dữ liệu đã lưu.", "success");
    }
    if (action === "notification-permission") { if (!("Notification" in window)) throw new Error("Trình duyệt không hỗ trợ Notification API."); const permission = await Notification.requestPermission(); return status(`Quyền thông báo: ${permission}.`, permission === "granted" ? "success" : "warning"); }
    if (action === "notification-send") return addNotification();
    if (action === "notification-read") { for (const row of await dbAll("notifications", owner)) await dbPut("notifications", { ...row, read: true }, owner); publishNotificationSignal(owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "notification-clear") { await dbClear("notifications", owner); publishNotificationSignal(owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "skeleton-start") return startSkeleton();
    if (action === "skeleton-stop") return stopSkeleton();
    if (action === "skeleton-code") { output(skeletonDocument(values())); return status("Đã tạo HTML/CSS mẫu độc lập.", "success"); }
    if (action === "skeleton-export") { download(skeletonDocument(values()), "hh-loading-skeleton.html", "text/html;charset=utf-8"); return; }
    if (action === "progress-start") return startProgress();
    if (action === "progress-pause") { state.progress.running = false; cancelAnimationFrame(state.progressFrame); state.progressDetach?.(); state.progressDetach = null; return status("Đã tạm dừng tiến trình.", "warning"); }
    if (action === "progress-reset") { state.progress.running = false; state.progress.elapsed = 0; state.progress.value = 0; cancelAnimationFrame(state.progressFrame); state.progressDetach?.(); state.progressDetach = null; state.root.querySelector("[data-pt-progress]").value = 0; state.root.querySelector("[data-pt-progress-label]").textContent = "0%"; return status("Đã đặt lại."); }
    if (action === "fps-start") return startFps();
    if (action === "fps-pause") { state.fps.running = false; cancelAnimationFrame(state.fpsFrame); state.longTaskObserver?.disconnect(); state.longTaskObserver = null; paintFps(); return status("Đã tạm dừng đo FPS.", "warning"); }
    if (action === "fps-reset") { state.fps.samples = []; state.fps.longTasks = 0; state.fps.last = performance.now(); ["fps", "frame", "p95"].forEach((key) => { const node = state.root.querySelector(`[data-pt-${key}]`); if (node) node.textContent = "—"; }); state.root.querySelector("[data-pt-long]").textContent = "0"; const canvas = state.root.querySelector("[data-pt-fps-chart]"); canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); return status("Đã đặt lại số liệu."); }
    if (action === "fps-export") { const report = JSON.stringify({ format: "HH FPS Report", exportedAt: new Date().toISOString(), longTasks: state.fps.longTasks, samples: state.fps.samples }, null, 2); download(report, `hh-fps-${Date.now()}.json`); return record("fps.export", { samples: state.fps.samples.length }); }
    if (action === "history-filter") { const query = values().query.toLowerCase(); state.root.querySelectorAll("[data-pt-history-row]").forEach((row) => { row.hidden = !row.dataset.search.includes(query); }); return; }
    if (action === "history-clear-recent") { updateCatalogPreferences({ recent: [] }, owner); return render(root.parentElement, tool); }
    if (["favorite-catalog-add", "favorite-catalog-pin"].includes(action)) {
      const id = values().catalogTool;
      if (!toolCatalog().some(tool => tool.id === id)) throw new Error("Công cụ không tồn tại trong danh mục.");
      const collection = action.endsWith("pin") ? "pinned" : "favorites", prefs = catalogPreferences();
      updateCatalogPreferences({ [collection]: [...new Set([...prefs[collection], id])] }, owner);
      return render(root.parentElement, tool);
    }
    if (action === "history-export") { const rows = await allHistory(owner); assertAccount(owner); download(JSON.stringify({ format: "HH All Tool Activity", version: 1, owner, exportedAt: new Date().toISOString(), rows }, null, 2), "hh-all-tools-history.json"); return; }
    if (action === "history-clear") { await dbClear("history", owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "favorite-add" || action === "favorite-current") { const data = values(), rows = await dbAll("favorites", owner), route = validRoute(action.endsWith("current") ? byName.get(tool).route : data.route), title = action.endsWith("current") ? tool : data.title.trim(); if (!title || title.length > 160) throw new Error("Hãy nhập tên tối đa 160 ký tự."); if (rows.some((row) => row.route === route)) throw new Error("Đường dẫn đã có trong danh sách yêu thích."); await dbPut("favorites", { id: uid(), title, route, folder: data.folder?.trim().slice(0, 80) || "Chưa phân loại", order: rows.length, createdAt: Date.now() }, owner); await record("favorite.add", { route }, tool, owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "export-preview") return buildExport();
    if (action === "export-download") { if (!state.generatedExport) throw new Error("Hãy tạo bản xem trước trước."); const format = state.exportFormat; return download(state.generatedExport, `hh-platform-tools.${format}`, format === "csv" ? "text/csv" : "application/json"); }
    if (action === "import-validate") return validateImport();
    if (action === "import-commit") return commitImport();
    if (action === "import-cancel") { state.importPayload = null; return render(state.root.parentElement, state.active); }
    if (action === "pwa-inspect" || action === "offline-inspect") return inspectPwa(state.active);
    if (action === "install-inspect") return inspectPwa("Install App");
    if (action === "offline-prepare") return prepareOffline();
    if (action === "offline-cancel") { state.offlineController?.abort(); return status("Đã yêu cầu dừng tải; những tệp đã lưu vẫn còn trong cache riêng.", "warning"); }
    if (action === "pwa-update") { const registration = await navigator.serviceWorker?.getRegistration?.(); if (!registration) throw new Error("Chưa có Service Worker để cập nhật."); await registration.update(); return status("Đã yêu cầu kiểm tra bản cập nhật.", "success"); }
    if (action === "offline-retry") {
      if (!navigator.onLine) return status("Thiết bị báo offline. Chưa có kết nối mạng để kiểm tra.", "warning");
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
      state.cleanup.push(() => { clearTimeout(timer); controller.abort(); });
      try { const response = await fetch(`platform-tools.js?hh-check=${Date.now()}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return status("Tệp công cụ truy cập được. Service Worker có thể trả cache; kết quả này không xác minh backend hoặc internet.", "success"); }
      finally { clearTimeout(timer); }
    }
    if (action === "install-run") { if (!state.installPrompt) throw new Error("Install Prompt chưa sẵn sàng. Hãy dùng menu trình duyệt › Cài đặt ứng dụng hoặc kiểm tra manifest/HTTPS."); state.installPrompt.prompt(); const choice = await state.installPrompt.userChoice; state.installPrompt = null; return status(`Kết quả cài đặt: ${choice.outcome}.`, choice.outcome === "accepted" ? "success" : "warning"); }
    if (action === "install-help") { const report = state.root.querySelector("[data-pt-pwa-report]"); report.innerHTML = '<article><span>Chrome / Edge</span><b>Menu ⋮ › Cài đặt HH Platform</b></article><article><span>Safari iOS</span><b>Chia sẻ › Thêm vào Màn hình chính</b></article><article><span>Yêu cầu</span><b>HTTPS + manifest + Service Worker</b></article>'; return status("Đã mở hướng dẫn cài đặt theo trình duyệt.", "success"); }
    if (action === "shortcut-add") { const data = values(), combo = canonicalCombo(data.combo); if (!data.label.trim() || data.label.length > 80) throw new Error("Tên phím tắt tối đa 80 ký tự."); const rows = await getShortcuts(); if (rows.some((row) => row.combo.toLowerCase() === combo.toLowerCase())) throw new Error("Tổ hợp này đang được sử dụng."); rows.push({ id: uid(), label: data.label.trim(), combo, action: data.shortcutAction }); await saveSetting("shortcuts", rows, owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "shortcut-reset") { await saveSetting("shortcuts", [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }], owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "shortcut-export") { download(JSON.stringify(await getShortcuts(), null, 2), "hh-shortcuts.json"); return; }
    if (action === "settings-apply") { const data = values(); await Promise.all(["density", "reducedMotion", "autosave", "historyEnabled"].map((key) => saveSetting(key, data[key], owner))); assertAccount(owner); if (root !== state.root) return; state.settings = { ...state.settings, ...data }; root.dataset.density = data.density; root.dataset.reducedMotion = data.reducedMotion ? "true" : "false"; if (!data.autosave) { Object.keys(localStorage).filter((key) => key.startsWith(`${localPrefix(owner)}draft:`)).forEach((key) => localStorage.removeItem(key)); state.drafts.clear(); } return status("Đã lưu cài đặt trên thiết bị. Chỉ áp dụng bên trong All Tools.", "success"); }
    if (action === "settings-reset") { await dbClear("settings", owner); publishAppearance({ mode: "system" }, owner); if (root !== state.root) return; state.settings = { autosave: false }; Object.keys(localStorage).filter((key) => key.startsWith(`${localPrefix(owner)}draft:`)).forEach((key) => localStorage.removeItem(key)); state.drafts.clear(); state.appearanceCleanup?.(); state.appearanceCleanup = null; return render(root.parentElement, tool); }
    if (action === "settings-storage") { const estimate = await navigator.storage?.estimate?.(); state.root.querySelector("[data-pt-storage-report]").innerHTML = estimate ? `<article><span>Đã dùng</span><b>${formatBytes(estimate.usage)}</b></article><article><span>Hạn mức</span><b>${formatBytes(estimate.quota)}</b></article><article><span>Tỷ lệ</span><b>${((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(2)}%</b></article>` : '<div class="pt-empty">StorageManager API không được hỗ trợ.</div>'; return; }
    if (action.startsWith("command-")) { const command = action.slice(8); if (command === "theme") executeShortcut("theme"); if (command === "home") executeShortcut("home"); if (command === "tools") executeShortcut("tools"); if (command === "notify") { if (window.HHFeatureLab?.select) window.HHFeatureLab.select("Realtime Notification"); else render(state.root.parentElement, "Realtime Notification"); } return; }
    throw new Error("Hành động chưa được hỗ trợ trong công cụ này.");
  }

  function askConfirmation(action, message) {
    state.root.querySelector("[data-pt-confirm]")?.remove();
    const panel = document.createElement("div"); panel.className = "pt-confirm"; panel.dataset.ptConfirm = action;
    panel.innerHTML = `<p>${esc(message)}</p><button type="button" data-pt-confirm-accept="${esc(action)}">Xác nhận</button><button type="button" data-pt-confirm-cancel>Hủy</button>`;
    state.root.querySelector("[data-pt-status]").after(panel);
    panel.querySelector("[data-pt-confirm-cancel]").focus();
  }

  function bind() {
    const root = state.root, tool = state.active;
    const onClick = async (event) => {
      const target = event.target.closest("button"), owner = state.owner;
      if (target?.dataset.ptBusy) return;
      try {
        assertAccount(owner);
        const confirmation = event.target.closest("[data-pt-confirm-accept]");
        if (confirmation) { const action = confirmation.dataset.ptConfirmAccept; confirmation.closest("[data-pt-confirm]").remove(); state.confirmedAction = action; await handleAction(action); return; }
        const cancel = event.target.closest("[data-pt-confirm-cancel]");
        if (cancel) { cancel.closest("[data-pt-confirm]").remove(); state.confirmedAction = null; state.confirmedImport = null; return; }
        if (target) { target.dataset.ptBusy = "true"; target.setAttribute("aria-busy", "true"); }
        const action = event.target.closest("[data-pt-action]")?.dataset.ptAction;
        if (action) { event.preventDefault(); await handleAction(action, event.target); return; }
        const route = event.target.closest("[data-pt-open-route]")?.dataset.ptOpenRoute;
        if (route !== undefined) { navigate(route); await record("route.open", { route }, tool, owner); return; }
        const catalogOpen = event.target.closest("[data-pt-catalog-open]")?.dataset.ptCatalogOpen;
        if (catalogOpen) { window.HHFeatureLab?.select?.(catalogOpen); return; }
        const catalogToggle = event.target.closest("[data-pt-catalog-toggle]");
        if (catalogToggle) {
          const collection = catalogToggle.dataset.ptCatalogToggle, id = catalogToggle.dataset.ptCatalogId;
          if (!["favorites", "pinned"].includes(collection) || !toolCatalog().some(tool => tool.id === id)) throw new Error("Mục danh mục không hợp lệ.");
          const prefs = catalogPreferences(); updateCatalogPreferences({ [collection]: prefs[collection].includes(id) ? prefs[collection].filter(value => value !== id) : [...prefs[collection], id] }, owner);
          if (root === state.root) await render(root.parentElement, tool); return;
        }
        const notificationId = event.target.closest("[data-pt-delete-notification]")?.dataset.ptDeleteNotification;
        if (notificationId) { await dbDelete("notifications", notificationId, owner); publishNotificationSignal(owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const historyDelete = event.target.closest("[data-pt-history-delete]")?.dataset.ptHistoryDelete;
        if (historyDelete) { await dbDelete("history", historyDelete, owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const historyOpen = event.target.closest("[data-pt-history-open]")?.dataset.ptHistoryOpen;
        if (historyOpen) { const manifest = byId.get(historyOpen); if (manifest) window.HHFeatureLab?.select?.(manifest.name); return; }
        const favoriteOpen = event.target.closest("[data-pt-favorite-open]")?.dataset.ptFavoriteOpen;
        if (favoriteOpen) { const row = (await dbAll("favorites")).find((item) => item.id === favoriteOpen); if (row) navigate(row.route); return; }
        const favoriteDelete = event.target.closest("[data-pt-favorite-delete]")?.dataset.ptFavoriteDelete;
        if (favoriteDelete) { await dbDelete("favorites", favoriteDelete, owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const favoriteUp = event.target.closest("[data-pt-favorite-up]")?.dataset.ptFavoriteUp;
        if (favoriteUp) return await moveFavorite(favoriteUp);
        const favoriteDown = event.target.closest("[data-pt-favorite-down]")?.dataset.ptFavoriteDown;
        if (favoriteDown) return await moveFavorite(favoriteDown, 1);
        const shortcutTest = event.target.closest("[data-pt-shortcut-test]")?.dataset.ptShortcutTest;
        if (shortcutTest) { const row = (await getShortcuts()).find((item) => item.id === shortcutTest); if (row) executeShortcut(row.action); return; }
        const shortcutDelete = event.target.closest("[data-pt-shortcut-delete]")?.dataset.ptShortcutDelete;
        if (shortcutDelete) { await saveSetting("shortcuts", (await getShortcuts()).filter((item) => item.id !== shortcutDelete), owner); if (root === state.root) await render(root.parentElement, tool); }
      } catch (error) { if (root === state.root && owner === accountOwner()) status(error.message || "Không thể hoàn thành thao tác.", "error"); }
      finally { if (target) { delete target.dataset.ptBusy; target.removeAttribute("aria-busy"); } }
    };
    const onInput = (event) => {
      if (event.target.name === "query" && ["Global Search", "Command Palette++"].includes(state.active)) runSearch(state.active === "Command Palette++").catch((error) => { if (root === state.root) status(error.message, "error"); });
      if (event.target.name === "fontScale") { root.querySelector("[data-pt-font-value]").textContent = `${event.target.value}%`; previewTheme(values()); }
      if (["accent", "highlight", "contrast"].includes(event.target.name)) previewTheme(values());
      if (event.target.name === "count") root.querySelector("[data-pt-count]").textContent = event.target.value;
      if (event.target.name === "settingSearch") { const query = event.target.value.toLowerCase(); root.querySelectorAll("[data-pt-settings] > label").forEach((row) => { row.hidden = !row.dataset.search.includes(query); }); }
      if (event.target.name === "importFile") { state.importFile = event.target.files?.[0] || null; state.importPayload = null; root.querySelector('[data-pt-action="import-commit"]').disabled = true; }
      if (["scope", "format"].includes(event.target.name) && state.active === "Export Data") { state.generatedExport = ""; root.querySelector('[data-pt-action="export-download"]').disabled = true; }
      saveDraft();
    };
    const onKey = (event) => {
      if (event.key === "Escape") { root.querySelector("[data-pt-confirm]")?.remove(); state.confirmedAction = null; state.confirmedImport = null; if (state.active === "Command Palette++") root.querySelector('input[name="query"]')?.focus(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && event.target.name === "query") { event.preventDefault(); const rows = [...root.querySelectorAll("[data-pt-results] .pt-result")]; rows[event.key === "ArrowUp" ? rows.length - 1 : 0]?.focus(); }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && event.target.matches("[data-pt-results] .pt-result")) { event.preventDefault(); const rows = [...root.querySelectorAll("[data-pt-results] .pt-result")], index = rows.indexOf(event.target), next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length; rows[next]?.focus(); }
      if (event.key === "Enter" && event.target.name === "query") { event.preventDefault(); const result = root.querySelector("[data-pt-results] .pt-result"); if (result) result.click(); else if (state.active === "History Manager") handleAction("history-filter").catch((error) => status(error.message, "error")); }
      globalShortcut(event);
    };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("keydown", onKey);
    const dropzone = root.querySelector(".pt-dropzone");
    const onDragOver = (event) => { event.preventDefault(); dropzone?.classList.add("is-dragging"); };
    const onDragLeave = () => dropzone?.classList.remove("is-dragging");
    const onDrop = (event) => {
      event.preventDefault();
      dropzone?.classList.remove("is-dragging");
      const input = root.querySelector('input[name="importFile"]'), file = event.dataTransfer?.files?.[0];
      if (!input || !file) return;
      state.importFile = file;
      state.importPayload = null;
      root.querySelector('[data-pt-action="import-commit"]').disabled = true;
      status(`Đã chọn ${file.name}. Nhấn Kiểm tra tệp để tiếp tục.`, "running");
    };
    dropzone?.addEventListener("dragover", onDragOver); dropzone?.addEventListener("dragleave", onDragLeave); dropzone?.addEventListener("drop", onDrop);
    let draggedFavorite = "";
    const favoriteList = root.querySelector("[data-pt-favorites]");
    const favoriteStart = (event) => { draggedFavorite = event.target.closest("[data-pt-favorite]")?.dataset.ptFavorite || ""; if (draggedFavorite) event.dataTransfer?.setData("text/plain", draggedFavorite); };
    const favoriteOver = (event) => { if (draggedFavorite) event.preventDefault(); };
    const favoriteDrop = (event) => { if (!draggedFavorite) return; event.preventDefault(); const to = event.target.closest("[data-pt-favorite]")?.dataset.ptFavorite; if (to) moveFavorite(draggedFavorite, 0, to).catch((error) => status(error.message, "error")); draggedFavorite = ""; };
    const favoriteEnd = () => { draggedFavorite = ""; };
    favoriteList?.addEventListener("dragstart", favoriteStart); favoriteList?.addEventListener("dragover", favoriteOver); favoriteList?.addEventListener("drop", favoriteDrop); favoriteList?.addEventListener("dragend", favoriteEnd);
    const visibility = () => { if (!document.hidden) return; cancelAnimationFrame(state.progressFrame); state.progress.running = false; state.progressDetach?.(); state.progressDetach = null; cancelAnimationFrame(state.fpsFrame); state.fps.running = false; state.longTaskObserver?.disconnect(); state.longTaskObserver = null; stopSkeleton(); status("Tab bị ẩn: đã tạm dừng đo/hiệu ứng. Nhấn bắt đầu để tiếp tục.", "warning"); };
    document.addEventListener("visibilitychange", visibility);
    const notificationSync = event => {
      if (tool !== "Realtime Notification" || root !== state.root || document.hidden || state.owner !== accountOwner() || !root.querySelector('input[name="listenLocal"]')?.checked || event.key !== `hh.all-tools.notification-signal.v1.${state.owner}`) return;
      render(root.parentElement, tool).catch(error => { if (root === state.root) status(error.message, "error"); });
    };
    addEventListener("storage", notificationSync); state.cleanup.push(() => removeEventListener("storage", notificationSync));
    state.cleanup.push(() => { document.removeEventListener("visibilitychange", visibility); favoriteList?.removeEventListener("dragstart", favoriteStart); favoriteList?.removeEventListener("dragover", favoriteOver); favoriteList?.removeEventListener("drop", favoriteDrop); favoriteList?.removeEventListener("dragend", favoriteEnd); });
    state.cleanup.push(() => { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("keydown", onKey); dropzone?.removeEventListener("dragover", onDragOver); dropzone?.removeEventListener("dragleave", onDragLeave); dropzone?.removeEventListener("drop", onDrop); });
  }

  function globalShortcut(event) {
    // hotkeys-js inspired scope/filter lifecycle, implemented locally without a dependency.
    if (event.defaultPrevented || event.repeat || event.isComposing || !state.root?.isConnected || state.owner !== accountOwner() || event.target.closest("input,textarea,select,[contenteditable]") || state.root.closest("[hidden]")) return;
    const combo = normalizeCombo(event), shortcut = (state.shortcutCache || []).find((row) => row.combo.toLowerCase() === combo.toLowerCase());
    if (shortcut) { event.preventDefault(); executeShortcut(shortcut.action); }
  }

  function integrateFeatureLab() {
    const lab = window.HHFeatureLab;
    if (!lab?.root || lab.root.dataset.platformToolsIntegrated) return false;
    lab.root.dataset.platformToolsIntegrated = "true";
    const work = lab.root.querySelector("[data-lab-work]");
    lab.root.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-lab-feature]");
      if (trigger && supports(trigger.dataset.labFeature)) queueMicrotask(() => render(work, trigger.dataset.labFeature));
    });
    const original = lab.select.bind(lab);
    lab.select = (name) => {
      original(name);
      if (supports(name)) render(work, name);
    };
    return true;
  }

  addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; const button = state.root?.querySelector('[data-pt-action="install-run"]'); if (button) button.disabled = false; });
  const accountChanged = () => {
    if (state.owner === accountOwner()) return;
    const root = state.root, host = root?.parentElement, name = state.active;
    state.appearanceCleanup?.(); state.appearanceCleanup = null;
    cleanupRuntime();
    if (root?.isConnected && host) render(host, name).catch(() => {});
  };
  addEventListener("hh:auth-change", accountChanged);
  addEventListener("storage", (event) => { if (event.key === "hh-auth-user") accountChanged(); });
  const integrationTimer = setInterval(() => { if (integrateFeatureLab()) clearInterval(integrationTimer); }, 120);
  setTimeout(() => clearInterval(integrationTimer), 15000);
  ensureStyle();

  window.HHPlatformTools = {
    manifests: () => manifests.map((manifest) => ({ ...manifest, permissions: [...manifest.permissions], actions: [...manifest.actions] })),
    supports,
    render,
    mountById: (host, id) => render(host, byId.get(id)?.name),
    cleanup: cleanupRuntime,
    inspectStorage: async () => Object.fromEntries(await Promise.all(STORE_NAMES.map(async (name) => [name, (await dbAll(name)).length]))),
    beginProgress: (detail = {}) => dispatchEvent(new CustomEvent("hh:progress", { detail: { ...detail, value: 0, state: "running" } })),
    updateProgress: (value, detail = {}) => dispatchEvent(new CustomEvent("hh:progress", { detail: { ...detail, value: Math.max(0, Math.min(100, Number(value) || 0)), state: "running" } })),
    endProgress: (detail = {}) => dispatchEvent(new CustomEvent("hh:progress", { detail: { ...detail, value: 100, state: "complete" } }))
  };
  dispatchEvent(new CustomEvent("hh:platform-tools-ready", { detail: { count: manifests.length } }));
})();
