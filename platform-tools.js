(() => {
  "use strict";

  const DB_NAME = "hh-platform-tools";
  const DB_VERSION = 1;
  const STORE_NAMES = ["history", "favorites", "settings", "notifications", "imports"];
  const memory = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]));
  const state = {
    root: null,
    active: "Global Search",
    cleanup: [],
    progressFrame: 0,
    fpsFrame: 0,
    fps: { running: false, samples: [], last: 0, longTasks: 0 },
    generatedExport: "",
    importPayload: null,
    themeUndo: null,
    installPrompt: null,
    appearanceCleanup: null
  };

  const manifests = [
    ["global-search", "Global Search", "browser", [], ["search", "open"], true, true, "search"],
    ["command-palette", "Command Palette++", "browser", ["navigation"], ["search", "run"], true, true, "terminal"],
    ["dark-light-auto", "Dark Light Auto Mode", "browser", ["appearance"], ["preview", "apply", "reset"], true, true, "sun-moon"],
    ["theme-switcher", "Theme Color Switcher", "browser", ["appearance"], ["preview", "apply", "undo"], true, true, "palette"],
    ["realtime-notifications", "Realtime Notification", "browser", ["notifications"], ["request", "send", "read", "clear"], true, false, "bell-ring"],
    ["loading-skeleton", "Loading Skeleton", "browser", ["dom-preview"], ["preview", "stop", "inspect"], true, true, "panels-top-left"],
    ["page-progress", "Page Progress Bar", "browser", ["performance"], ["start", "pause", "reset"], true, true, "gauge"],
    ["fps-monitor", "FPS Monitor", "browser", ["performance"], ["start", "pause", "reset", "export"], true, true, "activity"],
    ["history-manager", "History Manager", "browser", ["local-data"], ["search", "restore", "delete", "export"], false, true, "history"],
    ["favorite-manager", "Favorite Manager", "browser", ["local-data"], ["add", "open", "reorder", "delete"], true, true, "star"],
    ["export-data", "Export Data", "browser", ["local-data", "download"], ["preview", "export"], true, true, "download"],
    ["import-data", "Import Data", "browser", ["local-file", "local-data"], ["validate", "preview", "import", "cancel"], true, true, "upload"],
    ["pwa", "PWA", "browser", ["service-worker"], ["inspect", "update"], true, true, "app-window"],
    ["offline-mode", "Offline Mode", "browser", ["service-worker", "cache"], ["inspect", "retry", "clear-completed"], true, true, "wifi-off"],
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
    link.href = "platform-tools.css?v=1";
    link.dataset.platformToolsStyle = "true";
    document.head.append(link);
  }

  function openDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => STORE_NAMES.forEach((name) => {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async function storeAction(storeName, mode, value) {
    const db = await openDb();
    if (!db) {
      const store = memory[storeName];
      if (mode === "all") return [...store.values()];
      if (mode === "put") { store.set(value.id, structuredClone(value)); return value; }
      if (mode === "delete") return store.delete(value);
      if (mode === "clear") return store.clear();
      return null;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode === "all" ? "readonly" : "readwrite");
      const store = transaction.objectStore(storeName);
      const request = mode === "all" ? store.getAll() : mode === "put" ? store.put(value) : mode === "delete" ? store.delete(value) : store.clear();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  const dbAll = (name) => storeAction(name, "all");
  const dbPut = (name, value) => storeAction(name, "put", value);
  const dbDelete = (name, id) => storeAction(name, "delete", id);
  const dbClear = (name) => storeAction(name, "clear");
  const settingId = (id) => `setting:${id}`;
  const saveSetting = (id, value) => dbPut("settings", { id: settingId(id), value, updatedAt: Date.now() });
  const readSettings = async () => Object.fromEntries((await dbAll("settings")).map((row) => [row.id.replace(/^setting:/, ""), row.value]));

  async function record(action, detail = {}, tool = state.active) {
    const manifest = byName.get(tool);
    if (!manifest?.history) return;
    await dbPut("history", { id: uid(), tool: manifest.id, name: manifest.name, action, detail, createdAt: Date.now() });
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
    ${field("Tìm trong workspace", '<div class="pt-searchbox"><input name="query" autocomplete="off" placeholder="Nhập module, dự án, tệp hoặc lệnh..."><kbd>Enter</kbd></div>')}
    <div class="pt-filter-row">${select("kind", [["all", "Tất cả"], ["route", "Trang & module"], ["heading", "Nội dung"], ["history", "Lịch sử"]])}${select("limit", [["20", "20 kết quả"], ["50", "50 kết quả"], ["100", "100 kết quả"]])}${button("search", "Tìm kiếm", true)}</div>
    <p class="pt-help">Chỉ lập chỉ mục nhãn điều hướng và tiêu đề công khai trong trang; không đọc nội dung biểu mẫu.</p>
  </section><section class="pt-card"><header><strong>Kết quả</strong><span data-pt-result-count>0 mục</span></header><div class="pt-results" data-pt-results><div class="pt-empty">Nhập từ khóa để tìm.</div></div></section></div>`;

  const commandMarkup = () => `<div class="pt-layout"><section class="pt-card">
    ${field("Command Palette", '<div class="pt-searchbox"><input name="query" autocomplete="off" placeholder="Tìm lệnh hoặc trang..."><kbd>Ctrl K</kbd></div>')}
    <div class="pt-results" data-pt-results></div>
  </section><aside class="pt-card pt-card--compact"><strong>Lệnh nhanh</strong><div class="pt-command-grid">
    ${button("command-theme", "Đổi sáng/tối")}${button("command-home", "Mở Trang chủ")}${button("command-tools", "Mở Tool Lab")}${button("command-notify", "Thông báo mới")}
  </div><p class="pt-help">Lệnh điều hướng dùng router hiện tại và giữ nguyên phiên làm việc.</p></aside></div>`;

  const darkMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-choice-grid">
    ${[["system", "Theo hệ điều hành", "Đồng bộ prefers-color-scheme"], ["light", "Luôn sáng", "Áp dụng trên thiết bị này"], ["dark", "Luôn tối", "Áp dụng trên thiết bị này"], ["schedule", "Theo giờ", "Tự đổi theo lịch"]].map(([value, title, desc]) => `<label class="pt-choice"><input type="radio" name="mode" value="${value}" ${(settings.colorMode || "system") === value ? "checked" : ""}><span><b>${title}</b><small>${desc}</small></span></label>`).join("")}
  </div><div class="pt-grid-2">${field("Bắt đầu chế độ sáng", '<input type="time" name="lightStart" value="' + esc(settings.lightStart || "06:00") + '">')}${field("Bắt đầu chế độ tối", '<input type="time" name="darkStart" value="' + esc(settings.darkStart || "18:00") + '">')}</div><div class="pt-actions">${button("appearance-preview", "Xem trước")}${button("appearance-apply", "Áp dụng", true)}${button("appearance-reset", "Theo hệ thống")}</div></section><aside class="pt-card"><strong>Trạng thái</strong><ul class="pt-capabilities">${capability("Media query", Boolean(matchMedia), "Theo dõi thay đổi giao diện hệ điều hành")}${capability("Lịch theo thiết bị", true, "Tính toán cục bộ, không cần API")}${capability("Đồng bộ tài khoản", false, "Cần backend hồ sơ người dùng")}</ul></aside></div>`;

  const themeMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">
    ${field("Màu chủ đạo", `<input type="color" name="accent" value="${esc(settings.accent || "#55d9e2")}">`)}${field("Màu nhấn", `<input type="color" name="highlight" value="${esc(settings.highlight || "#ff63bf")}">`)}
    ${field("Cỡ chữ", `<input type="range" name="fontScale" min="85" max="125" value="${esc(settings.fontScale || 100)}"><output data-pt-font-value>${esc(settings.fontScale || 100)}%</output>`)}${field("Độ tương phản", select("contrast", [["normal", "Tiêu chuẩn"], ["high", "Tương phản cao"]], settings.contrast || "normal"))}
  </div><div class="pt-theme-preview"><span></span><h4>HH Platform</h4><p>Xem trước bảng màu và khả năng đọc trước khi áp dụng.</p><button type="button">Hành động chính</button></div><div class="pt-actions">${button("theme-preview", "Xem trước")}${button("theme-apply", "Lưu giao diện", true)}${button("theme-undo", "Hoàn tác", false, "disabled")}</div></section></div>`;

  const notificationsMarkup = async () => {
    const rows = (await dbAll("notifications")).sort((a, b) => b.createdAt - a.createdAt);
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Tiêu đề", '<input name="title" maxlength="80" value="HH Platform">')}${field("Mức ưu tiên", select("priority", [["normal", "Bình thường"], ["high", "Cao"], ["silent", "Im lặng"]]))}</div>${field("Nội dung", '<textarea name="message" maxlength="240" placeholder="Nội dung thông báo trên thiết bị..."></textarea>')}<div class="pt-actions">${button("notification-permission", "Cấp quyền trình duyệt")}${button("notification-send", "Gửi thông báo", true)}${button("notification-read", "Đánh dấu đã đọc")}</div><p class="pt-help">Thông báo trong ứng dụng hoạt động ngay. Thông báo hệ thống phụ thuộc quyền của trình duyệt.</p></section><section class="pt-card"><header><strong>Notification Center</strong><span>${rows.filter((row) => !row.read).length} chưa đọc</span></header><div class="pt-timeline" data-pt-notifications>${rows.length ? rows.map((row) => `<article class="${row.read ? "" : "is-unread"}"><div><b>${esc(row.title)}</b><p>${esc(row.message)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-pt-delete-notification="${row.id}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có thông báo.</div>'}</div></section></div>`;
  };

  const skeletonMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Mẫu skeleton", select("pattern", [["cards", "Danh sách thẻ"], ["article", "Bài viết"], ["dashboard", "Dashboard"]]))}${field("Thời gian kiểm thử", '<input type="number" name="duration" min="500" max="10000" step="250" value="1800">', "500–10.000 ms")}</div>${field("Số phần tử", '<input type="range" name="count" min="1" max="12" value="6"><output data-pt-count>6</output>')}<div class="pt-actions">${button("skeleton-start", "Chạy kiểm thử", true)}${button("skeleton-stop", "Dừng")}</div></section><section class="pt-card"><header><strong>Preview có phạm vi</strong><span data-pt-skeleton-state>Chưa chạy</span></header><div class="pt-skeleton-stage" data-pt-skeleton-stage aria-live="polite"><div class="pt-demo-content"><h4>Nội dung thật</h4><p>Skeleton chỉ phủ khu vực thử nghiệm này và không khóa toàn website.</p></div></div></section></div>`;

  const progressMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Loại tác vụ", select("progressType", [["route", "Tải trang"], ["upload", "Tải tệp lên"], ["render", "Render"], ["api", "API"]]))}${field("Thời lượng mô phỏng", '<input type="number" name="duration" min="500" max="15000" step="500" value="4000">')}</div><div class="pt-actions">${button("progress-start", "Bắt đầu", true)}${button("progress-pause", "Tạm dừng")}${button("progress-reset", "Đặt lại")}</div></section><section class="pt-card pt-progress-card"><header><strong>Tiến trình tác vụ</strong><span data-pt-progress-label>0%</span></header><progress data-pt-progress max="100" value="0">0%</progress><p data-pt-progress-detail>Chưa có tác vụ.</p></section></div>`;

  const fpsMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-metrics"><article><span>FPS hiện tại</span><strong data-pt-fps>—</strong></article><article><span>Frame time</span><strong data-pt-frame>—</strong></article><article><span>P95</span><strong data-pt-p95>—</strong></article><article><span>Long tasks</span><strong data-pt-long>0</strong></article></div><canvas class="pt-chart" data-pt-fps-chart width="900" height="260" aria-label="Biểu đồ FPS 60 giây"></canvas><div class="pt-actions">${button("fps-start", "Bắt đầu đo", true)}${button("fps-pause", "Tạm dừng")}${button("fps-reset", "Đặt lại")}${button("fps-export", "Xuất JSON")}</div></section><aside class="pt-card"><strong>Khả năng đo</strong><ul class="pt-capabilities">${capability("requestAnimationFrame", true, "Đo FPS và frame time thực")}${capability("Long Tasks API", "PerformanceObserver" in window, "Ghi nhận tác vụ chặn main thread")}${capability("GPU telemetry", false, "Trình duyệt không cung cấp nhiệt độ/GPU load")}</ul></aside></div>`;

  const historyMarkup = async () => {
    const rows = (await dbAll("history")).sort((a, b) => b.createdAt - a.createdAt);
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-filter-row"><input name="query" placeholder="Tìm tool hoặc hành động...">${button("history-filter", "Lọc", true)}${button("history-export", "Xuất JSON")}</div><div class="pt-timeline" data-pt-history>${historyRows(rows)}</div></section><aside class="pt-card pt-card--compact"><strong>${rows.length} hoạt động</strong><p class="pt-help">Lịch sử chỉ lưu tên thao tác và metadata an toàn trong IndexedDB; không lưu mật khẩu, token hoặc nội dung biểu mẫu.</p>${button("history-clear", "Xóa toàn bộ")}</aside></div>`;
  };

  const historyRows = (rows) => rows.length ? rows.map((row) => `<article data-pt-history-row data-search="${esc(`${row.name} ${row.action}`.toLowerCase())}"><div><b>${esc(row.name)}</b><p>${esc(row.action)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-pt-history-open="${esc(row.tool)}">Mở</button><button type="button" data-pt-history-delete="${row.id}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có hoạt động.</div>';

  const favoritesMarkup = async () => {
    const rows = (await dbAll("favorites")).sort((a, b) => a.order - b.order);
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-3">${field("Tên", '<input name="title" placeholder="Ví dụ: Admin Panel">')}${field("Route", '<input name="route" placeholder="#/settings/admin-panel">')}${field("Thư mục / tag", '<input name="folder" placeholder="Công việc">')}</div><div class="pt-actions">${button("favorite-add", "Thêm yêu thích", true)}${button("favorite-current", "Thêm trang hiện tại")}</div><div class="pt-favorites" data-pt-favorites>${rows.length ? rows.map((row, index) => `<article draggable="true" data-pt-favorite="${row.id}"><span>★</span><div><b>${esc(row.title)}</b><small>${esc(row.folder || "Chưa phân loại")} · ${esc(row.route)}</small></div><button type="button" data-pt-favorite-up="${row.id}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-pt-favorite-open="${row.id}">Mở</button><button type="button" data-pt-favorite-delete="${row.id}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có mục yêu thích.</div>'}</div></section></div>`;
  };

  const exportMarkup = () => `<div class="pt-layout"><section class="pt-card"><fieldset><legend>Phạm vi dữ liệu</legend><div class="pt-check-grid">${["Thiết lập Platform Tool", "Lịch sử thao tác", "Yêu thích", "Thông báo", "Dữ liệu HH công khai"].map((label, index) => `<label><input type="checkbox" name="scope" value="${index}" ${index < 4 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset><div class="pt-grid-2">${field("Định dạng", select("format", [["json", "JSON"], ["csv", "CSV (lịch sử)"]]))}${field("Bảo vệ", select("privacy", [["safe", "Ẩn khóa nhạy cảm"], ["all-hh", "Tất cả khóa hh.* không nhạy cảm"]]))}</div><div class="pt-actions">${button("export-preview", "Tạo bản xem trước", true)}${button("export-download", "Tải xuống", false, "disabled")}</div></section><section class="pt-card"><header><strong>Bản xem trước</strong><span data-pt-export-size>0 B</span></header><pre class="pt-code" data-pt-output>Chọn phạm vi rồi tạo bản xem trước.</pre></section></div>`;

  const importMarkup = () => `<div class="pt-layout"><section class="pt-card"><label class="pt-dropzone"><input type="file" name="importFile" accept="application/json,.json"><span>Chọn hoặc kéo tệp JSON vào đây</span><small>Tệp được phân tích cục bộ, chưa ghi dữ liệu cho tới khi bạn xác nhận.</small></label><div class="pt-grid-2">${field("Xử lý trùng", select("strategy", [["merge", "Gộp, ưu tiên dữ liệu mới"], ["skip", "Bỏ qua mục đã có"], ["replace", "Thay thế phạm vi đã chọn"]]))}${field("Giới hạn kích thước", '<output>5 MB</output>')}</div><div class="pt-actions">${button("import-validate", "Kiểm tra tệp", true)}${button("import-commit", "Xác nhận nhập", false, "disabled")}${button("import-cancel", "Hủy")}</div></section><section class="pt-card"><header><strong>Kiểm tra schema</strong><span data-pt-import-status>Chưa có tệp</span></header><pre class="pt-code" data-pt-output>Chưa có dữ liệu xem trước.</pre></section></div>`;

  const pwaMarkup = (kind) => `<div class="pt-layout"><section class="pt-card"><div class="pt-actions">${kind === "PWA" ? `${button("pwa-inspect", "Kiểm tra PWA", true)}${button("pwa-update", "Tìm bản cập nhật")}` : kind === "Offline Mode" ? `${button("offline-inspect", "Kiểm tra offline", true)}${button("offline-retry", "Thử đồng bộ lại")}` : `${button("install-run", "Cài ứng dụng", true)}${button("install-help", "Xem hướng dẫn")}`}</div><div class="pt-pwa-report" data-pt-pwa-report><div class="pt-empty">Nhấn kiểm tra để đọc trạng thái thật của trình duyệt.</div></div></section><aside class="pt-card"><strong>Capability</strong><ul class="pt-capabilities">${capability("Service Worker", "serviceWorker" in navigator, "Cache và cập nhật ứng dụng")}${capability("Cache Storage", "caches" in window, "Dữ liệu offline")}${capability("Install Prompt", Boolean(state.installPrompt), state.installPrompt ? "Có thể hiển thị ngay" : "Phụ thuộc trình duyệt và tiêu chí PWA")}</ul></aside></div>`;

  const shortcutsMarkup = async () => {
    const settings = await readSettings();
    const rows = settings.shortcuts || [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }];
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-3">${field("Tên phím tắt", '<input name="label" placeholder="Mở Trang chủ">')}${field("Tổ hợp", '<input name="combo" placeholder="Ctrl+Shift+H">', "Ctrl/Alt/Shift + phím")}${field("Hành động", select("shortcutAction", [["home", "Mở Trang chủ"], ["palette", "Mở Command Palette"], ["tools", "Mở All Tools"], ["theme", "Đổi sáng/tối"]]))}</div><div class="pt-actions">${button("shortcut-add", "Thêm phím tắt", true)}${button("shortcut-reset", "Khôi phục mặc định")}${button("shortcut-export", "Xuất")}</div><div class="pt-shortcuts" data-pt-shortcuts>${rows.map((row) => `<article><div><b>${esc(row.label)}</b><small>${esc(row.action)}</small></div><kbd>${esc(row.combo)}</kbd><button type="button" data-pt-shortcut-test="${row.id}">Thử</button><button type="button" data-pt-shortcut-delete="${row.id}" aria-label="Xóa">×</button></article>`).join("")}</div></section></div>`;
  };

  const settingsMarkup = (settings) => `<div class="pt-layout"><section class="pt-card"><div class="pt-filter-row"><input name="settingSearch" placeholder="Tìm cài đặt..."></div><div class="pt-settings" data-pt-settings>
    <label data-search="mật độ giao diện density"><span><b>Mật độ giao diện</b><small>Khoảng cách giữa các điều khiển</small></span>${select("density", [["comfortable", "Thoải mái"], ["compact", "Gọn"]], settings.density || "comfortable")}</label>
    <label data-search="giảm chuyển động motion"><span><b>Giảm chuyển động</b><small>Tắt hiệu ứng không thiết yếu</small></span><input type="checkbox" name="reducedMotion" ${settings.reducedMotion ? "checked" : ""}></label>
    <label data-search="tự động lưu autosave"><span><b>Tự động lưu cấu hình</b><small>Lưu thay đổi Tool trong IndexedDB</small></span><input type="checkbox" name="autosave" ${settings.autosave !== false ? "checked" : ""}></label>
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
    ensureStyle();
    state.active = name;
    const manifest = byName.get(name) || byId.get("fps-monitor");
    host.innerHTML = `<div class="pt-workspace" data-platform-tool="${esc(manifest.id)}"><header class="pt-head"><div><small>PLATFORM TOOL · ${esc(manifest.runtime.toUpperCase())}</small><h3>${esc(manifest.name)}</h3><p>Mỗi hành động dùng engine riêng, có kiểm tra capability và trạng thái rõ ràng.</p></div><div class="pt-badges"><span class="is-ready">Sẵn sàng</span><span>${manifest.offline ? "Offline" : "Online"}</span><span>${esc(manifest.route)}</span></div></header><div class="pt-status" data-pt-status data-state="ready" role="status" aria-live="polite">Sẵn sàng.</div><main data-pt-body><div class="pt-loading" aria-label="Đang tải"></div></main></div>`;
    state.root = host.querySelector("[data-platform-tool]");
    state.root.querySelector("[data-pt-body]").innerHTML = await bodyMarkup(name);
    bind();
    if (["Global Search", "Command Palette++"].includes(name)) runSearch(name === "Command Palette++");
    dispatchEvent(new CustomEvent("hh:platform-tool-mounted", { detail: { manifest: { ...manifest } } }));
    return true;
  }

  function cleanupRuntime() {
    cancelAnimationFrame(state.progressFrame);
    cancelAnimationFrame(state.fpsFrame);
    state.fps.running = false;
    state.cleanup.splice(0).forEach((fn) => { try { fn(); } catch {} });
  }

  function values() {
    return Object.fromEntries([...state.root.querySelectorAll("input[name],select[name],textarea[name]")].map((node) => [node.name, node.type === "checkbox" ? node.checked : node.value]));
  }

  function scanWorkspace(query = "", kind = "all", limit = 50) {
    const normalized = query.trim().toLowerCase();
    const map = new Map();
    const add = (entry) => {
      const key = `${entry.kind}:${entry.route || entry.label}`;
      if (!map.has(key) && (!normalized || `${entry.label} ${entry.description || ""}`.toLowerCase().includes(normalized))) map.set(key, entry);
    };
    if (["all", "route"].includes(kind)) {
      document.querySelectorAll("[data-app-route]").forEach((node) => add({ kind: "route", label: node.textContent.trim().replace(/\s+/g, " ") || node.dataset.appRoute, route: node.dataset.appRoute, description: "Điều hướng trong HH Platform" }));
      manifests.forEach((manifest) => add({ kind: "route", label: manifest.name, route: manifest.route, description: "Platform Tool" }));
    }
    if (["all", "heading"].includes(kind)) document.querySelectorAll("main h1,main h2,main h3,[data-module-id]").forEach((node) => {
      if (node.closest(".feature-lab") || node.closest(".pt-workspace")) return;
      add({ kind: "heading", label: node.textContent.trim().replace(/\s+/g, " "), route: node.closest("[data-app-route]")?.dataset.appRoute || location.hash, description: node.dataset.moduleId || "Nội dung đang hiển thị" });
    });
    return [...map.values()].slice(0, Number(limit) || 50);
  }

  async function runSearch(command = false) {
    const data = values();
    const kind = command ? "route" : data.kind || "all";
    const rows = scanWorkspace(data.query || "", kind, data.limit || 30);
    if (["all", "history"].includes(kind)) {
      const normalized = (data.query || "").trim().toLowerCase();
      const history = (await dbAll("history"))
        .filter((row) => !normalized || `${row.name} ${row.action}`.toLowerCase().includes(normalized))
        .slice(0, Number(data.limit) || 30)
        .map((row) => ({ kind: "history", label: row.name, route: byId.get(row.tool)?.route || "", description: `${row.action} · ${new Date(row.createdAt).toLocaleString("vi-VN")}` }));
      rows.push(...history.slice(0, Math.max(0, (Number(data.limit) || 30) - rows.length)));
    }
    const target = state.root.querySelector("[data-pt-results]");
    if (!target) return;
    target.innerHTML = rows.length ? rows.map((row) => `<button type="button" class="pt-result" data-pt-open-route="${esc(row.route || "")}"><span>${row.kind === "route" ? "↗" : "⌕"}</span><div><b>${esc(row.label)}</b><small>${esc(row.description || row.route || "")}</small></div><kbd>Enter</kbd></button>`).join("") : '<div class="pt-empty">Không tìm thấy kết quả phù hợp.</div>';
    const count = state.root.querySelector("[data-pt-result-count]");
    if (count) count.textContent = `${rows.length} mục`;
    status(`Tìm thấy ${rows.length} kết quả.`, "success");
  }

  function navigate(route) {
    if (!route) return;
    if (route.startsWith("/tools/platform/")) {
      const manifest = byId.get(route.split("/").pop());
      const buttonNode = document.querySelector(`[data-lab-feature="${CSS.escape(manifest?.name || "")}"]`);
      if (buttonNode) buttonNode.click();
      return;
    }
    const target = document.querySelector(`[data-app-route="${CSS.escape(route)}"]`);
    if (target) target.click();
    else location.hash = route.startsWith("#") ? route : `#${route}`;
  }

  function applyColorMode(config) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = (value) => { const [hour, minute] = String(value).split(":").map(Number); return hour * 60 + minute; };
    let mode = config.mode;
    if (mode === "system") mode = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (mode === "schedule") {
      const light = toMinutes(config.lightStart || "06:00"), dark = toMinutes(config.darkStart || "18:00");
      mode = light < dark ? (minutes >= light && minutes < dark ? "light" : "dark") : (minutes >= light || minutes < dark ? "light" : "dark");
    }
    document.documentElement.dataset.colorMode = mode;
    document.documentElement.style.colorScheme = mode;
    return mode;
  }

  function keepColorModeSynced(config) {
    state.appearanceCleanup?.();
    const media = matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => applyColorMode(config);
    const timer = config.mode === "schedule" ? setInterval(refresh, 30000) : 0;
    if (config.mode === "system") media.addEventListener?.("change", refresh);
    state.appearanceCleanup = () => {
      if (timer) clearInterval(timer);
      media.removeEventListener?.("change", refresh);
    };
    refresh();
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
    const data = values();
    const title = data.title.trim(), message = data.message.trim();
    if (!title || !message) throw new Error("Hãy nhập tiêu đề và nội dung thông báo.");
    const row = { id: uid(), title, message, priority: data.priority, read: false, createdAt: Date.now() };
    await dbPut("notifications", row);
    dispatchEvent(new CustomEvent("hh:notification", { detail: { ...row, source: "platform-tools" } }));
    if (data.priority !== "silent" && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: message, tag: row.id });
    await record("notification.send", { priority: data.priority });
    await render(state.root.parentElement, state.active);
  }

  function startSkeleton() {
    const data = values(), stage = state.root.querySelector("[data-pt-skeleton-stage]"), count = Math.max(1, Math.min(12, Number(data.count) || 6));
    stage.setAttribute("aria-busy", "true");
    stage.className = `pt-skeleton-stage is-loading pattern-${data.pattern}`;
    stage.innerHTML = `<div class="pt-skeleton-grid">${Array.from({ length: count }, () => '<div class="pt-skeleton-item"><i></i><b></b><span></span><span></span></div>').join("")}</div>`;
    state.root.querySelector("[data-pt-skeleton-state]").textContent = "Đang kiểm thử";
    const timer = setTimeout(stopSkeleton, Math.max(500, Math.min(10000, Number(data.duration) || 1800)));
    state.cleanup.push(() => clearTimeout(timer));
    status("Skeleton đang chạy trong preview.", "running");
  }

  function stopSkeleton() {
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
    const data = values(), start = performance.now(), duration = Math.max(500, Math.min(15000, Number(data.duration) || 4000));
    const progress = state.root.querySelector("[data-pt-progress]");
    const tick = (now) => {
      const ratio = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - ratio, 2.4), value = Math.round(eased * 100);
      progress.value = value;
      state.root.querySelector("[data-pt-progress-label]").textContent = `${value}%`;
      state.root.querySelector("[data-pt-progress-detail]").textContent = `${data.progressType} · ${Math.round(now - start)} ms`;
      dispatchEvent(new CustomEvent("hh:progress", { detail: { id: "platform-demo", type: data.progressType, value } }));
      if (ratio < 1) state.progressFrame = requestAnimationFrame(tick);
      else { status("Tác vụ đã hoàn thành.", "success"); record("progress.complete", { type: data.progressType, duration }); }
    };
    state.progressFrame = requestAnimationFrame(tick);
    status("Đang theo dõi tiến trình.", "running");
  }

  function setupLongTasks() {
    if (!("PerformanceObserver" in window) || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
    const observer = new PerformanceObserver((list) => {
      state.fps.longTasks += list.getEntries().length;
      const node = state.root?.querySelector("[data-pt-long]");
      if (node) node.textContent = state.fps.longTasks;
    });
    observer.observe({ type: "longtask", buffered: true });
    state.cleanup.push(() => observer.disconnect());
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
    const canvas = state.root.querySelector("[data-pt-fps-chart]"), rect = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
    canvas.width = Math.max(320, rect.width * ratio); canvas.height = 260 * ratio;
    const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio); const width = canvas.width / ratio, height = canvas.height / ratio;
    ctx.clearRect(0, 0, width, height); ctx.strokeStyle = "#293847"; ctx.lineWidth = 1;
    [30, 60, 90].forEach((fps) => { const y = height - fps / 120 * height; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); });
    const gradient = ctx.createLinearGradient(0, 0, width, 0); gradient.addColorStop(0, "#52d9e2"); gradient.addColorStop(1, "#ff63bf"); ctx.strokeStyle = gradient; ctx.lineWidth = 2; ctx.beginPath();
    recent.forEach((item, index) => { const x = index / Math.max(1, recent.length - 1) * width, y = height - Math.min(120, item.fps) / 120 * height; if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  }

  async function moveFavorite(id) {
    const rows = (await dbAll("favorites")).sort((a, b) => a.order - b.order), index = rows.findIndex((row) => row.id === id);
    if (index <= 0) return;
    [rows[index - 1].order, rows[index].order] = [rows[index].order, rows[index - 1].order];
    await Promise.all([dbPut("favorites", rows[index - 1]), dbPut("favorites", rows[index])]);
    await render(state.root.parentElement, state.active);
  }

  const safeKey = (key) => /^hh[.:_-]/i.test(key) && !/(token|secret|password|credential|session)/i.test(key);
  async function buildExport() {
    const data = values(), scopes = [...state.root.querySelectorAll('input[name="scope"]')].map((node) => node.checked), payload = { format: "HH Platform Tools Export", version: 1, exportedAt: new Date().toISOString(), data: {} };
    if (scopes[0]) payload.data.settings = await dbAll("settings");
    if (scopes[1]) payload.data.history = await dbAll("history");
    if (scopes[2]) payload.data.favorites = await dbAll("favorites");
    if (scopes[3]) payload.data.notifications = await dbAll("notifications");
    if (scopes[4]) payload.data.local = Object.fromEntries(Object.keys(localStorage).filter(safeKey).map((key) => [key, localStorage.getItem(key)]));
    if (data.format === "csv") {
      const rows = payload.data.history || [];
      state.generatedExport = ["id,tool,action,createdAt", ...rows.map((row) => [row.id, row.name, row.action, new Date(row.createdAt).toISOString()].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n");
    } else state.generatedExport = JSON.stringify(payload, null, 2);
    output(state.generatedExport);
    state.root.querySelector("[data-pt-export-size]").textContent = formatBytes(new Blob([state.generatedExport]).size);
    state.root.querySelector('[data-pt-action="export-download"]').disabled = false;
    status("Bản xuất đã sẵn sàng; chưa có dữ liệu nào rời thiết bị.", "success");
  }

  async function validateImport() {
    const file = state.root.querySelector('input[name="importFile"]').files?.[0];
    if (!file) throw new Error("Hãy chọn một tệp JSON.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Tệp vượt quá giới hạn 5 MB.");
    const payload = JSON.parse(await file.text());
    if (payload.format !== "HH Platform Tools Export" || payload.version !== 1 || !payload.data || typeof payload.data !== "object") throw new Error("Schema không đúng định dạng HH Platform Tools Export v1.");
    const allowed = ["settings", "history", "favorites", "notifications", "local"], unknown = Object.keys(payload.data).filter((key) => !allowed.includes(key));
    if (unknown.length) throw new Error(`Phạm vi không được hỗ trợ: ${unknown.join(", ")}`);
    state.importPayload = payload;
    output({ valid: true, exportedAt: payload.exportedAt, scopes: Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, Array.isArray(value) ? value.length : Object.keys(value || {}).length])) });
    state.root.querySelector("[data-pt-import-status]").textContent = "Schema hợp lệ";
    state.root.querySelector('[data-pt-action="import-commit"]').disabled = false;
    status("Tệp hợp lệ. Kiểm tra xem trước rồi xác nhận nhập.", "success");
  }

  async function commitImport() {
    if (!state.importPayload) throw new Error("Chưa có tệp đã được kiểm tra.");
    const strategy = values().strategy, data = state.importPayload.data;
    for (const storeName of ["settings", "history", "favorites", "notifications"]) {
      const rows = data[storeName]; if (!Array.isArray(rows)) continue;
      if (strategy === "replace") await dbClear(storeName);
      const existing = new Set((await dbAll(storeName)).map((row) => row.id));
      for (const row of rows) if (row?.id && (strategy !== "skip" || !existing.has(row.id))) await dbPut(storeName, row);
    }
    if (data.local && typeof data.local === "object") Object.entries(data.local).filter(([key]) => safeKey(key)).forEach(([key, value]) => {
      if (strategy !== "skip" || localStorage.getItem(key) === null) localStorage.setItem(key, String(value));
    });
    await dbPut("imports", { id: uid(), strategy, scopes: Object.keys(data), createdAt: Date.now() });
    await record("import.commit", { strategy, scopes: Object.keys(data) });
    status("Đã nhập dữ liệu hợp lệ.", "success");
  }

  async function inspectPwa(kind) {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    const cacheNames = "caches" in window ? await caches.keys() : [];
    const estimate = await navigator.storage?.estimate?.();
    const report = [
      ["Kết nối", navigator.onLine ? "Online" : "Offline"],
      ["Service Worker", registration ? `Active · ${registration.scope}` : "Chưa đăng ký"],
      ["Cache", `${cacheNames.length} kho`],
      ["Lưu trữ", estimate ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}` : "Không hỗ trợ"],
      ["Cài đặt", matchMedia("(display-mode: standalone)").matches ? "Đang chạy standalone" : state.installPrompt ? "Có thể cài" : "Chưa đủ tiêu chí / không hỗ trợ"]
    ];
    state.root.querySelector("[data-pt-pwa-report]").innerHTML = report.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join("");
    status(`Đã kiểm tra ${kind} bằng API trình duyệt.`, "success");
  }

  const normalizeCombo = (event) => [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join("+");
  async function getShortcuts() {
    const settings = await readSettings();
    return settings.shortcuts || [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }];
  }

  function executeShortcut(action) {
    if (action === "home") navigate("/home");
    if (action === "palette") { window.HHFeatureLab?.open?.("Command Palette++"); }
    if (action === "tools") document.querySelector(".feature-lab-open")?.click();
    if (action === "theme") document.documentElement.dataset.colorMode = document.documentElement.dataset.colorMode === "light" ? "dark" : "light";
  }

  async function handleAction(action, target) {
    if (action === "search") return runSearch(false);
    if (action === "appearance-preview" || action === "appearance-apply") {
      const data = values(), mode = applyColorMode(data);
      if (action.endsWith("apply")) { await Promise.all(Object.entries({ colorMode: data.mode, lightStart: data.lightStart, darkStart: data.darkStart }).map(([key, value]) => saveSetting(key, value))); keepColorModeSynced(data); await record("appearance.apply", { mode }); }
      return status(`${action.endsWith("apply") ? "Đã lưu" : "Đang xem trước"} chế độ ${mode}.`, "success");
    }
    if (action === "appearance-reset") { await saveSetting("colorMode", "system"); applyColorMode({ mode: "system" }); return render(state.root.parentElement, state.active); }
    if (action === "theme-preview") { previewTheme(values()); return status("Đang xem trước, website chưa thay đổi.", "running"); }
    if (action === "theme-apply") {
      const data = values(); state.themeUndo = { accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), highlight: getComputedStyle(document.documentElement).getPropertyValue("--highlight").trim(), fontSize: document.documentElement.style.fontSize };
      document.documentElement.style.setProperty("--accent", data.accent); document.documentElement.style.setProperty("--highlight", data.highlight); document.documentElement.style.fontSize = `${data.fontScale}%`; document.documentElement.dataset.contrast = data.contrast;
      await Promise.all(["accent", "highlight", "fontScale", "contrast"].map((key) => saveSetting(key, data[key]))); state.root.querySelector('[data-pt-action="theme-undo"]').disabled = false; await record("theme.apply", { contrast: data.contrast }); return status("Đã áp dụng và lưu giao diện.", "success");
    }
    if (action === "theme-undo" && state.themeUndo) { document.documentElement.style.setProperty("--accent", state.themeUndo.accent); document.documentElement.style.setProperty("--highlight", state.themeUndo.highlight); document.documentElement.style.fontSize = state.themeUndo.fontSize; return status("Đã hoàn tác giao diện.", "success"); }
    if (action === "notification-permission") { if (!("Notification" in window)) throw new Error("Trình duyệt không hỗ trợ Notification API."); const permission = await Notification.requestPermission(); return status(`Quyền thông báo: ${permission}.`, permission === "granted" ? "success" : "warning"); }
    if (action === "notification-send") return addNotification();
    if (action === "notification-read") { for (const row of await dbAll("notifications")) await dbPut("notifications", { ...row, read: true }); return render(state.root.parentElement, state.active); }
    if (action === "skeleton-start") return startSkeleton();
    if (action === "skeleton-stop") return stopSkeleton();
    if (action === "progress-start") return startProgress();
    if (action === "progress-pause") { cancelAnimationFrame(state.progressFrame); return status("Đã tạm dừng tiến trình.", "warning"); }
    if (action === "progress-reset") { cancelAnimationFrame(state.progressFrame); state.root.querySelector("[data-pt-progress]").value = 0; state.root.querySelector("[data-pt-progress-label]").textContent = "0%"; return status("Đã đặt lại."); }
    if (action === "fps-start") return startFps();
    if (action === "fps-pause") { state.fps.running = false; cancelAnimationFrame(state.fpsFrame); paintFps(); return status("Đã tạm dừng đo FPS.", "warning"); }
    if (action === "fps-reset") { state.fps.samples = []; state.fps.longTasks = 0; ["fps", "frame", "p95"].forEach((key) => { const node = state.root.querySelector(`[data-pt-${key}]`); if (node) node.textContent = "—"; }); state.root.querySelector("[data-pt-long]").textContent = "0"; const canvas = state.root.querySelector("[data-pt-fps-chart]"); canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); return status("Đã đặt lại số liệu."); }
    if (action === "fps-export") { const report = JSON.stringify({ format: "HH FPS Report", exportedAt: new Date().toISOString(), longTasks: state.fps.longTasks, samples: state.fps.samples }, null, 2); download(report, `hh-fps-${Date.now()}.json`); return record("fps.export", { samples: state.fps.samples.length }); }
    if (action === "history-filter") { const query = values().query.toLowerCase(); state.root.querySelectorAll("[data-pt-history-row]").forEach((row) => { row.hidden = !row.dataset.search.includes(query); }); return; }
    if (action === "history-export") { const rows = await dbAll("history"); download(JSON.stringify(rows, null, 2), "hh-platform-history.json"); return; }
    if (action === "history-clear") { if (!confirm("Xóa toàn bộ lịch sử Platform Tool?")) return; await dbClear("history"); return render(state.root.parentElement, state.active); }
    if (action === "favorite-add" || action === "favorite-current") { const data = values(), rows = await dbAll("favorites"), route = action.endsWith("current") ? location.hash || "/home" : data.route.trim(), title = action.endsWith("current") ? document.title : data.title.trim(); if (!title || !route) throw new Error("Hãy nhập tên và route."); await dbPut("favorites", { id: uid(), title, route, folder: data.folder?.trim() || "Chưa phân loại", order: rows.length, createdAt: Date.now() }); await record("favorite.add", { route }); return render(state.root.parentElement, state.active); }
    if (action === "export-preview") return buildExport();
    if (action === "export-download") { if (!state.generatedExport) throw new Error("Hãy tạo bản xem trước trước."); const format = values().format; return download(state.generatedExport, `hh-platform-tools.${format}`, format === "csv" ? "text/csv" : "application/json"); }
    if (action === "import-validate") return validateImport();
    if (action === "import-commit") return commitImport();
    if (action === "import-cancel") { state.importPayload = null; return render(state.root.parentElement, state.active); }
    if (action === "pwa-inspect" || action === "offline-inspect") return inspectPwa(state.active);
    if (action === "pwa-update") { const registration = await navigator.serviceWorker?.getRegistration?.(); if (!registration) throw new Error("Chưa có Service Worker để cập nhật."); await registration.update(); return status("Đã yêu cầu kiểm tra bản cập nhật.", "success"); }
    if (action === "offline-retry") { dispatchEvent(new CustomEvent("hh:offline-retry")); return status(navigator.onLine ? "Đã phát yêu cầu đồng bộ hàng đợi." : "Thiết bị vẫn offline; yêu cầu được giữ trong hàng đợi.", navigator.onLine ? "success" : "warning"); }
    if (action === "install-run") { if (!state.installPrompt) throw new Error("Install Prompt chưa sẵn sàng. Hãy dùng menu trình duyệt › Cài đặt ứng dụng hoặc kiểm tra manifest/HTTPS."); state.installPrompt.prompt(); const choice = await state.installPrompt.userChoice; state.installPrompt = null; return status(`Kết quả cài đặt: ${choice.outcome}.`, choice.outcome === "accepted" ? "success" : "warning"); }
    if (action === "install-help") { const report = state.root.querySelector("[data-pt-pwa-report]"); report.innerHTML = '<article><span>Chrome / Edge</span><b>Menu ⋮ › Cài đặt HH Platform</b></article><article><span>Safari iOS</span><b>Chia sẻ › Thêm vào Màn hình chính</b></article><article><span>Yêu cầu</span><b>HTTPS + manifest + Service Worker</b></article>'; return status("Đã mở hướng dẫn cài đặt theo trình duyệt.", "success"); }
    if (action === "shortcut-add") { const data = values(), combo = data.combo.replace(/\s/g, ""); if (!data.label.trim() || !/^(?:(?:Ctrl|Alt|Shift|Meta)\+)+(?:[A-Za-z0-9]|Enter|Escape|Space)$/i.test(combo)) throw new Error("Tổ hợp không hợp lệ. Ví dụ: Ctrl+Shift+H."); const rows = await getShortcuts(); if (rows.some((row) => row.combo.toLowerCase() === combo.toLowerCase())) throw new Error("Tổ hợp này đang được sử dụng."); rows.push({ id: uid(), label: data.label.trim(), combo, action: data.shortcutAction }); await saveSetting("shortcuts", rows); return render(state.root.parentElement, state.active); }
    if (action === "shortcut-reset") { await saveSetting("shortcuts", [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette" }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools" }]); return render(state.root.parentElement, state.active); }
    if (action === "shortcut-export") { download(JSON.stringify(await getShortcuts(), null, 2), "hh-shortcuts.json"); return; }
    if (action === "settings-apply") { const data = values(); await Promise.all(["density", "reducedMotion", "autosave", "historyEnabled"].map((key) => saveSetting(key, data[key]))); document.documentElement.dataset.density = data.density; document.documentElement.dataset.reducedMotion = data.reducedMotion ? "true" : "false"; return status("Đã lưu cài đặt trên thiết bị.", "success"); }
    if (action === "settings-reset") { if (!confirm("Khôi phục cài đặt Platform Tool?")) return; await dbClear("settings"); return render(state.root.parentElement, state.active); }
    if (action === "settings-storage") { const estimate = await navigator.storage?.estimate?.(); state.root.querySelector("[data-pt-storage-report]").innerHTML = estimate ? `<article><span>Đã dùng</span><b>${formatBytes(estimate.usage)}</b></article><article><span>Hạn mức</span><b>${formatBytes(estimate.quota)}</b></article><article><span>Tỷ lệ</span><b>${((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(2)}%</b></article>` : '<div class="pt-empty">StorageManager API không được hỗ trợ.</div>'; return; }
    if (action.startsWith("command-")) { const command = action.slice(8); if (command === "theme") executeShortcut("theme"); if (command === "home") executeShortcut("home"); if (command === "tools") executeShortcut("tools"); if (command === "notify") window.HHFeatureLab?.select?.("Realtime Notification"); }
  }

  function bind() {
    const root = state.root;
    const onClick = async (event) => {
      try {
        const action = event.target.closest("[data-pt-action]")?.dataset.ptAction;
        if (action) { event.preventDefault(); await handleAction(action, event.target); return; }
        const route = event.target.closest("[data-pt-open-route]")?.dataset.ptOpenRoute;
        if (route !== undefined) { navigate(route); await record("route.open", { route }); return; }
        const notificationId = event.target.closest("[data-pt-delete-notification]")?.dataset.ptDeleteNotification;
        if (notificationId) { await dbDelete("notifications", notificationId); await render(root.parentElement, state.active); return; }
        const historyDelete = event.target.closest("[data-pt-history-delete]")?.dataset.ptHistoryDelete;
        if (historyDelete) { await dbDelete("history", historyDelete); await render(root.parentElement, state.active); return; }
        const historyOpen = event.target.closest("[data-pt-history-open]")?.dataset.ptHistoryOpen;
        if (historyOpen) { const manifest = byId.get(historyOpen); if (manifest) window.HHFeatureLab?.select?.(manifest.name); return; }
        const favoriteOpen = event.target.closest("[data-pt-favorite-open]")?.dataset.ptFavoriteOpen;
        if (favoriteOpen) { const row = (await dbAll("favorites")).find((item) => item.id === favoriteOpen); if (row) navigate(row.route); return; }
        const favoriteDelete = event.target.closest("[data-pt-favorite-delete]")?.dataset.ptFavoriteDelete;
        if (favoriteDelete) { await dbDelete("favorites", favoriteDelete); await render(root.parentElement, state.active); return; }
        const favoriteUp = event.target.closest("[data-pt-favorite-up]")?.dataset.ptFavoriteUp;
        if (favoriteUp) return moveFavorite(favoriteUp);
        const shortcutTest = event.target.closest("[data-pt-shortcut-test]")?.dataset.ptShortcutTest;
        if (shortcutTest) { const row = (await getShortcuts()).find((item) => item.id === shortcutTest); if (row) executeShortcut(row.action); return; }
        const shortcutDelete = event.target.closest("[data-pt-shortcut-delete]")?.dataset.ptShortcutDelete;
        if (shortcutDelete) { await saveSetting("shortcuts", (await getShortcuts()).filter((item) => item.id !== shortcutDelete)); await render(root.parentElement, state.active); }
      } catch (error) { status(error.message || "Không thể hoàn thành thao tác.", "error"); }
    };
    const onInput = (event) => {
      if (event.target.name === "query" && ["Global Search", "Command Palette++"].includes(state.active)) runSearch(state.active === "Command Palette++");
      if (event.target.name === "fontScale") { root.querySelector("[data-pt-font-value]").textContent = `${event.target.value}%`; previewTheme(values()); }
      if (["accent", "highlight", "contrast"].includes(event.target.name)) previewTheme(values());
      if (event.target.name === "count") root.querySelector("[data-pt-count]").textContent = event.target.value;
      if (event.target.name === "settingSearch") { const query = event.target.value.toLowerCase(); root.querySelectorAll("[data-pt-settings] > label").forEach((row) => { row.hidden = !row.dataset.search.includes(query); }); }
    };
    const onKey = (event) => { if (event.key === "Enter" && event.target.name === "query") { event.preventDefault(); root.querySelector("[data-pt-results] [data-pt-open-route]")?.click(); } };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("keydown", onKey);
    const dropzone = root.querySelector(".pt-dropzone");
    const onDragOver = (event) => { event.preventDefault(); dropzone?.classList.add("is-dragging"); };
    const onDragLeave = () => dropzone?.classList.remove("is-dragging");
    const onDrop = (event) => {
      event.preventDefault();
      dropzone?.classList.remove("is-dragging");
      const input = root.querySelector('input[name="importFile"]'), file = event.dataTransfer?.files?.[0];
      if (!input || !file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      status(`Đã chọn ${file.name}. Nhấn Kiểm tra tệp để tiếp tục.`, "running");
    };
    dropzone?.addEventListener("dragover", onDragOver); dropzone?.addEventListener("dragleave", onDragLeave); dropzone?.addEventListener("drop", onDrop);
    state.cleanup.push(() => { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("keydown", onKey); dropzone?.removeEventListener("dragover", onDragOver); dropzone?.removeEventListener("dragleave", onDragLeave); dropzone?.removeEventListener("drop", onDrop); });
  }

  async function globalShortcut(event) {
    if (event.target.matches("input,textarea,select,[contenteditable=true]") && !event.ctrlKey && !event.metaKey) return;
    const combo = normalizeCombo(event), shortcut = (await getShortcuts()).find((row) => row.combo.toLowerCase() === combo.toLowerCase());
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

  addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; });
  addEventListener("keydown", globalShortcut);
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
