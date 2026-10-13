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
    themePresetId: "",
    historyRows: [],
    historyFiltered: [],
    shortcutEditing: "",
    shortcutRecording: false,
    shortcutImport: null,
    shortcutImportVersion: 0,
    favoriteLinks: [],
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
    ["keyboard-shortcuts", "Keyboard Shortcut System", "browser", ["keyboard", "local-file", "download"], ["record", "add", "edit", "toggle", "test", "delete", "reset", "import", "export"], true, true, "keyboard"],
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
    link.href = new URL("/platform-tools.css?v=5", location.href).href;
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

  const COSMIC_PRESETS = Object.freeze([
    { id: "nebula", name: "Nebula", description: "Tím tinh vân · hồng sáng", accent: "#c4a5ff", highlight: "#ff92d0", fontScale: 100, contrast: "normal" },
    { id: "aurora", name: "Aurora", description: "Ngọc cực quang · xanh trời", accent: "#6ef2c4", highlight: "#83c9ff", fontScale: 100, contrast: "normal" },
    { id: "solar", name: "Solar", description: "Vàng mặt trời · san hô", accent: "#ffd075", highlight: "#ff9ea7", fontScale: 100, contrast: "normal" },
    { id: "ocean", name: "Ocean", description: "Cyan đại dương · xanh lam", accent: "#78e5ed", highlight: "#92adff", fontScale: 100, contrast: "normal" },
    { id: "minimal", name: "Minimal", description: "Bạc dịu · ít phân tâm", accent: "#c9d5e8", highlight: "#abbcd6", fontScale: 100, contrast: "high" }
  ].map(preset => Object.freeze(preset)));
  function themeConfig(values) {
    if (!values || !(typeof values.fontScale === "number" || typeof values.fontScale === "string" && /^\d{2,3}(?:\.\d+)?$/.test(values.fontScale))) throw new Error("Cài đặt cỡ chữ preset không hợp lệ.");
    return Object.fromEntries(["accent", "highlight", "fontScale", "contrast"].map(key => [key, validateSetting(key, values[key])]));
  }
  function themePresetStore(value = { version: 1, items: [] }) {
    if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length > 12 || Object.keys(value).some(key => !["version", "items"].includes(key))) throw new Error("Kho preset không hợp lệ; tối đa 12 preset cá nhân.");
    const ids = new Set(), names = new Set();
    const items = value.items.map(item => {
      if (!item || Object.keys(item).some(key => !["id", "name", "accent", "highlight", "fontScale", "contrast", "createdAt", "updatedAt"].includes(key)) || typeof item.id !== "string" || !/^preset-[a-z0-9-]{1,100}$/i.test(item.id) || ids.has(item.id)) throw new Error("ID preset không hợp lệ hoặc bị trùng.");
      const name = presetName(item.name), key = normalizeSearch(name);
      if (names.has(key)) throw new Error("Tên preset cá nhân bị trùng."); ids.add(item.id); names.add(key);
      if (![item.createdAt, item.updatedAt].every(time => Number.isFinite(time) && time >= 0 && time <= Date.now() + 86400000)) throw new Error("Thời gian preset không hợp lệ.");
      return { id: item.id, name, ...themeConfig(item), createdAt: item.createdAt, updatedAt: item.updatedAt };
    });
    return { version: 1, items };
  }
  function presetName(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 60 || /[\u0000-\u001f]/.test(value)) throw new Error("Tên preset cần 1–60 ký tự, không chứa ký tự điều khiển.");
    return value.trim();
  }
  function presetCards(settings) {
    let personal, warning = "";
    try { personal = themePresetStore(settings.themePresets).items; }
    catch (error) { personal = []; warning = `<p class="pt-help" role="status">${esc(error.message)} Xuất bản sao thiết lập trước khi khôi phục kho preset.</p>${button("theme-presets-clear", "Khôi phục riêng kho preset")}`; }
    const card = (preset, custom) => `<article class="pt-theme-preset" data-pt-theme-card="${esc(preset.id)}"><span class="pt-preset-swatch" aria-hidden="true" style="--pt-swatch-a:${esc(preset.accent)};--pt-swatch-b:${esc(preset.highlight)}"></span><div><strong>${esc(preset.name)}</strong><small>${custom ? `${preset.fontScale}% · ${preset.contrast === "high" ? "Tương phản cao" : "Tiêu chuẩn"}` : esc(preset.description)}</small></div><div class="pt-actions">${button(`theme-preset-preview:${preset.id}`, "Xem trước", false, `aria-pressed="false" aria-label="Xem trước ${esc(preset.name)}" data-pt-preset-preview="${esc(preset.id)}"`)}${button(`theme-preset-apply:${preset.id}`, "Áp dụng", false, `aria-label="Áp dụng ${esc(preset.name)} cho All Tools"`)}</div>${custom ? `<label class="pt-field"><span>Đổi tên ${esc(preset.name)}</span><input name="renamePreset-${esc(preset.id)}" data-pt-preset-name="${esc(preset.id)}" value="${esc(preset.name)}" maxlength="60"></label><div class="pt-actions">${button(`theme-preset-rename:${preset.id}`, "Lưu tên mới")}${button(`theme-preset-delete:${preset.id}`, "Xóa preset")}</div>` : ""}</article>`;
    return `<section class="pt-card"><header><strong>Bảng màu Cosmic</strong><span>5 preset có sẵn</span></header><p class="pt-help">Tên và màu giúp phân biệt, không dựa riêng vào màu sắc. Xem trước không đổi giao diện; Áp dụng chỉ thay All Tools.</p><div class="pt-theme-presets">${COSMIC_PRESETS.map(preset => card(preset, false)).join("")}</div><header><strong>Preset cá nhân</strong><span>${personal.length}/12 · tài khoản hiện tại</span></header>${field("Tên preset mới", '<input name="presetName" maxlength="60" placeholder="Ví dụ: Không gian học của tôi">')}${button("theme-preset-save", "Lưu màu đang chỉnh thành preset", true)}${warning}<div class="pt-theme-presets" data-pt-personal-presets>${personal.length ? personal.map(preset => card(preset, true)).join("") : '<div class="pt-empty">Chưa có preset cá nhân. Chỉnh màu/cỡ chữ ở bên cạnh rồi đặt tên và lưu.</div>'}</div><p class="pt-help">Lưu trên thiết bị theo tài khoản, không đồng bộ đám mây. Preset được đưa vào phạm vi Thiết lập All Tools khi sao lưu.</p></section>`;
  }
  const themeMarkup = (settings) => `<div class="pt-layout pt-layout--themes"><section class="pt-card"><div class="pt-grid-2">
    ${field("Màu chủ đạo", `<input type="color" name="accent" value="${esc(settings.accent || "#55d9e2")}">`)}${field("Màu nhấn", `<input type="color" name="highlight" value="${esc(settings.highlight || "#ff63bf")}">`)}
    ${field("Cỡ chữ", `<input type="range" name="fontScale" min="85" max="125" value="${esc(settings.fontScale || 100)}"><output data-pt-font-value>${esc(settings.fontScale || 100)}%</output>`)}${field("Độ tương phản", select("contrast", [["normal", "Tiêu chuẩn"], ["high", "Tương phản cao"]], settings.contrast || "normal"))}
  </div><div class="pt-theme-preview"><span></span><h4>All Tools Studio</h4><p>Xem trước bảng màu và khả năng đọc trước khi áp dụng.</p><span class="pt-preview-action">Mẫu nút hành động</span></div><p class="pt-help" data-pt-preset-state role="status">Màu tùy chỉnh.</p><div class="pt-actions">${button("theme-preview", "Xem trước")}${button("theme-apply", "Áp dụng cho All Tools", true)}${button("theme-undo", "Hoàn tác", false, "disabled")}</div></section>${presetCards(settings)}</div>`;

  const notificationsMarkup = async () => {
    const rows = (await dbAll("notifications")).sort((a, b) => b.createdAt - a.createdAt);
    return `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Tiêu đề", '<input name="title" maxlength="80" value="HH Platform">')}${field("Mức ưu tiên", select("priority", [["normal", "Bình thường"], ["high", "Cao"], ["silent", "Im lặng"]]))}</div>${field("Nội dung", '<textarea name="message" maxlength="240" placeholder="Nội dung thông báo trên thiết bị..."></textarea>')}<label class="pt-choice"><input type="checkbox" name="listenLocal" checked><span><b>Cập nhật giữa các tab cùng tài khoản</b><small>Chỉ đọc kho All Tools trên thiết bị này, không gửi ra ngoài.</small></span></label><div class="pt-actions">${button("notification-permission", "Cấp quyền trình duyệt")}${button("notification-send", "Tạo thông báo", true)}${button("notification-read", "Đánh dấu đã đọc")}${button("notification-clear", "Xóa thông báo")}</div><p class="pt-help">Thông báo cục bộ cập nhật qua sự kiện storage giữa các tab. Không có nguồn realtime máy chủ; không gửi push khi website đã đóng. Thông báo hệ thống chỉ gửi khi đã được cấp quyền.</p></section><section class="pt-card"><header><strong>Thông báo của bạn</strong><span>${rows.filter((row) => !row.read).length} chưa đọc</span></header><div class="pt-timeline" data-pt-notifications>${rows.length ? rows.map((row) => `<article class="${row.read ? "" : "is-unread"}"><div><b>${esc(row.title)}</b><p>${esc(row.message)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-pt-delete-notification="${esc(row.id)}" aria-label="Xóa">×</button></article>`).join("") : '<div class="pt-empty">Chưa có thông báo.</div>'}</div></section></div>`;
  };

  const skeletonMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Mẫu skeleton", select("pattern", [["cards", "Danh sách thẻ"], ["article", "Bài viết"], ["dashboard", "Dashboard"]]))}${field("Thời gian kiểm thử", '<input type="number" name="duration" min="500" max="10000" step="250" value="1800">', "500–10.000 ms")}</div>${field("Số phần tử", '<input type="range" name="count" min="1" max="12" value="6"><output data-pt-count>6</output>')}<div class="pt-actions">${button("skeleton-start", "Chạy kiểm thử", true)}${button("skeleton-stop", "Dừng")}${button("skeleton-code", "Xem mã HTML/CSS")}${button("skeleton-export", "Tải mẫu .html")}</div><p class="pt-help">Mã mẫu độc lập, có aria-busy, reduced motion và responsive. Thay skeleton bằng nội dung của ứng dụng khi tác vụ thực hoàn tất; không dùng timeout mô phỏng trong production.</p><pre class="pt-code" data-pt-output>Mẫu HTML/CSS chưa tạo.</pre></section><section class="pt-card"><header><strong>Preview có phạm vi</strong><span data-pt-skeleton-state>Chưa chạy</span></header><div class="pt-skeleton-stage" data-pt-skeleton-stage aria-live="polite"><div class="pt-demo-content"><h4>Nội dung thật</h4><p>Skeleton chỉ phủ khu vực thử nghiệm này và không khóa toàn website.</p></div></div></section></div>`;

  const progressMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-grid-2">${field("Nguồn tiến trình", select("progressType", [["page", "Vị trí cuộn trang All Tools"], ["scroll", "Cuộn nội dung thử nghiệm"], ["events", "Tác vụ phát sự kiện hh:progress"], ["demo", "Sandbox mô phỏng"]]))}${field("Thời lượng mô phỏng", '<input type="number" name="duration" min="500" max="15000" step="500" value="4000">')}</div><div class="pt-actions">${button("progress-start", "Bắt đầu / tiếp tục", true)}${button("progress-pause", "Tạm dừng")}${button("progress-reset", "Đặt lại")}</div><p class="pt-help">Nguồn trang đọc scrollTop thật; nguồn sự kiện chỉ cập nhật khi ứng dụng cung cấp tiến trình thật. Mô phỏng chỉ nằm trong công cụ này, không báo trạng thái tải trang hoặc API thật.</p></section><section class="pt-card pt-progress-card"><header><strong>Tiến trình</strong><span data-pt-progress-label>0%</span></header><progress data-pt-progress max="100" value="0">0%</progress><p data-pt-progress-detail>Chưa có nguồn theo dõi.</p><div class="pt-scroll-sample" tabindex="0" aria-label="Nội dung cuộn thử nghiệm" data-pt-scroll-sample>${Array.from({ length: 12 }, (_, index) => `<article><b>Phần ${index + 1}</b><p>Cuộn vùng nội dung này để đo vị trí thực tế. Dùng phím Page Down hoặc mũi tên khi vùng được focus.</p></article>`).join("")}</div></section></div>`;

  const fpsMarkup = () => `<div class="pt-layout"><section class="pt-card"><div class="pt-metrics"><article><span>FPS hiện tại</span><strong data-pt-fps>—</strong></article><article><span>Frame time</span><strong data-pt-frame>—</strong></article><article><span>P95</span><strong data-pt-p95>—</strong></article><article><span>Long tasks</span><strong data-pt-long>0</strong></article></div><canvas class="pt-chart" data-pt-fps-chart width="900" height="260" aria-label="Biểu đồ FPS 60 giây"></canvas><div class="pt-actions">${button("fps-start", "Bắt đầu đo", true)}${button("fps-pause", "Tạm dừng")}${button("fps-reset", "Đặt lại")}${button("fps-export", "Xuất JSON")}</div></section><aside class="pt-card"><strong>Khả năng đo</strong><ul class="pt-capabilities">${capability("requestAnimationFrame", true, "Đo FPS và frame time thực")}${capability("Long Tasks API", "PerformanceObserver" in window, "Ghi nhận tác vụ chặn main thread")}${capability("GPU telemetry", false, "Trình duyệt không cung cấp nhiệt độ/GPU load")}</ul></aside></div>`;

  const historyMarkup = async () => {
    const root = state.root, owner = state.owner, rows = historyMetadata(await allHistory(owner));
    if (root === state.root && owner === accountOwner()) { state.historyRows = rows; state.historyFiltered = rows; }
    const recent = catalogPreferences().recent.map(id => toolCatalog().find(tool => tool.id === id)).filter(Boolean);
    const tools = [...new Set(rows.map(row => row.tool))].map(id => [id, toolCatalog().find(tool => tool.id === id)?.name || id]);
    const actions = [...new Set(rows.map(row => row.action))].sort();
    return `<div class="pt-layout"><section class="pt-card"><header><strong>Hoạt động thật của All Tools</strong><span data-pt-history-count>${rows.length}/${rows.length} mục · tối đa 500</span></header><div class="pt-history-filters">${field("Tìm metadata", '<input name="query" maxlength="200" placeholder="Tên tool hoặc hành động...">')}${field("Công cụ", select("historyTool", [["all", "Tất cả công cụ"], ...tools]))}${field("Hành động", select("historyAction", [["all", "Tất cả hành động"], ...actions.map(action => [action, action])]))}${field("Nguồn", select("historySource", [["all", "Toàn bộ All Tools"], ["platform", "Platform"], ["workspace", "Workspace"], ["utility", "Tiện ích"]]))}${field("Từ ngày", '<input name="historyFrom" type="date">')}${field("Đến hết ngày", '<input name="historyTo" type="date">')}</div><div class="pt-actions">${button("history-filter", "Lọc", true)}${button("history-filter-reset", "Bỏ bộ lọc")}${button("history-refresh", "Đọc hoạt động mới")}</div><p class="pt-help" data-pt-history-summary role="status">Ngày theo múi giờ thiết bị. Không có dữ liệu hoạt động giả.</p><div class="pt-actions">${button("history-export", "Xuất JSON đang lọc", false, !rows.length ? "disabled" : "")}${button("history-export-csv", "Xuất CSV đang lọc", false, !rows.length ? "disabled" : "")}</div><p class="pt-help">Xuất chỉ metadata đang khớp bộ lọc, không có nội dung công cụ. CSV có bảo vệ công thức khi mở lần đầu; không bật công thức và không coi CSV đã lưu lại trong bảng tính là tệp tin cậy. JSON giữ giá trị gốc.</p><div class="pt-timeline" data-pt-history>${historyRows(rows)}</div></section><aside class="pt-card pt-card--compact"><header><strong>Công cụ mở gần đây</strong><span>${recent.length} mục</span></header><div class="pt-results">${recent.length ? recent.map(tool => `<button type="button" class="pt-result" data-pt-catalog-open="${esc(tool.id)}"><span>↗</span><div><b>${esc(tool.name)}</b><small>${esc(tool.description || "Tiếp tục workspace đã mở")}</small></div></button>`).join("") : '<div class="pt-empty">Chưa mở công cụ nào.</div>'}</div><div class="pt-actions">${button("history-clear-recent", "Xóa danh sách gần đây")}</div><p class="pt-help">Lịch sử chỉ tổng hợp metadata từ các kho All Tools của tài khoản hiện tại. Nút xóa chỉ xóa lịch sử Platform; hoạt động bộ khác được quản lý trong công cụ gốc.</p>${button("history-clear", "Xóa lịch sử Platform")}</aside></div>`;
  };

  function historyMetadata(rows) {
    return rows.filter(row => row && Number.isFinite(row.createdAt) && row.createdAt >= 0 && row.createdAt <= 8640000000000000).map(row => ({ id: String(row.id || "").slice(0, 180), source: ["platform", "workspace", "utility"].includes(row.source) ? row.source : "platform", tool: String(row.tool || "").slice(0, 80), name: String(row.name || row.tool || "").slice(0, 160), action: String(row.action || "").slice(0, 100), createdAt: row.createdAt }));
  }
  function filterHistory(rows, filters = {}) {
    const dateBoundary = (value, end) => {
      if (!value) return null;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ngày lọc cần định dạng YYYY-MM-DD.");
      const [year, month, day] = value.split("-").map(Number), date = new Date(`${value}T00:00:00`);
      if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Ngày lọc không tồn tại.");
      if (end) date.setDate(date.getDate() + 1); return date.getTime();
    };
    const from = dateBoundary(filters.historyFrom, false), to = dateBoundary(filters.historyTo, true);
    if (from !== null && to !== null && from >= to) throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
    const query = normalizeSearch(filters.query).slice(0, 200);
    return historyMetadata(rows).filter(row => (!query || normalizeSearch(`${row.name} ${row.tool} ${row.action} ${row.source}`).includes(query)) && (!filters.historyTool || filters.historyTool === "all" || row.tool === filters.historyTool) && (!filters.historyAction || filters.historyAction === "all" || row.action === filters.historyAction) && (!filters.historySource || filters.historySource === "all" || row.source === filters.historySource) && (from === null || row.createdAt >= from) && (to === null || row.createdAt < to));
  }
  function refreshHistoryView() {
    try {
      for (const name of ["historyFrom", "historyTo"]) {
        const input = state.root.querySelector(`[name="${name}"]`);
        if (input?.validity?.badInput) throw new Error("Ngày lọc chưa hoàn chỉnh hoặc không hợp lệ.");
        input?.setAttribute?.("aria-invalid", "false");
      }
      state.historyFiltered = filterHistory(state.historyRows, values());
      state.root.querySelector("[data-pt-history]").innerHTML = state.historyFiltered.length ? historyRows(state.historyFiltered) : '<div class="pt-empty" role="status">Không có hoạt động khớp bộ lọc. Bỏ bộ lọc hoặc chọn khoảng ngày khác.</div>';
      state.root.querySelector("[data-pt-history-count]").textContent = `${state.historyFiltered.length}/${state.historyRows.length} mục · tối đa 500`;
      state.root.querySelector("[data-pt-history-summary]").textContent = `Đang hiển thị ${state.historyFiltered.length} hoạt động thật. Ngày theo múi giờ thiết bị; chưa xuất dữ liệu.`;
      for (const action of ["history-export", "history-export-csv"]) state.root.querySelector(`[data-pt-action="${action}"]`).disabled = !state.historyFiltered.length;
      status(`Đang hiển thị ${state.historyFiltered.length}/${state.historyRows.length} hoạt động thật.${state.storageTemporary ? " Kho Platform chỉ có trong bộ nhớ tạm ở trình duyệt này." : ""}`, state.storageTemporary ? "warning" : "ready");
      return state.historyFiltered;
    } catch (error) {
      state.historyFiltered = [];
      for (const action of ["history-export", "history-export-csv"]) state.root.querySelector(`[data-pt-action="${action}"]`).disabled = true;
      for (const name of ["historyFrom", "historyTo"]) state.root.querySelector(`[name="${name}"]`)?.setAttribute?.("aria-invalid", "true");
      state.root.querySelector("[data-pt-history]").innerHTML = `<div class="pt-empty" role="status">${esc(error.message)} Sửa bộ lọc để xem và xuất hoạt động.</div>`;
      state.root.querySelector("[data-pt-history-count]").textContent = `Bộ lọc không hợp lệ · ${state.historyRows.length} mục được giữ nguyên`;
      state.root.querySelector("[data-pt-history-summary]").textContent = error.message; status(error.message, "error");
      throw error;
    }
  }
  function refreshHistoryOptions() {
    const tools = [...new Map([...toolCatalog().map(tool => [tool.id, tool.name]), ...state.historyRows.map(row => [row.tool, row.name])]).entries()], actions = [...new Set(state.historyRows.map(row => row.action))].sort();
    for (const [name, options, label] of [["historyTool", tools, "Tất cả công cụ"], ["historyAction", actions.map(action => [action, action]), "Tất cả hành động"]]) {
      const node = state.root.querySelector(`[name="${name}"]`), selected = String(node?.value || "all"); if (!node) continue;
      const items = [["all", label], ...options]; if (!items.some(([id]) => id === selected)) items.push([selected, `${selected} (không có hoạt động mới)`]);
      node.innerHTML = items.map(([id, title]) => `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(title)}</option>`).join(""); node.value = selected;
    }
  }
  function csvCell(value) {
    const text = String(value ?? ""), unsafe = /^[\s\u0000-\u001f]*[=+@\-＝＋＠－]/.test(text) || /^[\t\r\n]/.test(text);
    return `"${(unsafe ? "'" : "") + text.replace(/"/g, '""')}"`;
  }
  function historyExport(rows, format, owner = activeOwner()) {
    const metadata = historyMetadata(rows);
    if (format === "csv") return "\ufeff" + [["id", "source", "tool", "name", "action", "createdAt"], ...metadata.map(row => [row.id, row.source, row.tool, row.name, row.action, new Date(row.createdAt).toISOString()])].map(row => row.map(csvCell).join(",")).join("\r\n");
    return JSON.stringify({ format: "HH All Tool Activity", version: 1, owner, exportedAt: new Date().toISOString(), count: metadata.length, rows: metadata }, null, 2);
  }

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
    return `<header><strong>Yêu thích & ghim của danh mục</strong><span data-pt-catalog-favorite-count></span></header><div class="pt-grid-3">${field("Tìm tool / nhóm", '<input name="favoriteQuery" type="search" maxlength="200" placeholder="Tên công cụ hoặc nhóm...">')}${field("Danh mục", select("favoriteGroup", [["all", "Tất cả nhóm"], ...[...new Set(catalog.map(tool => tool.group || "Platform"))].map(group => [group, group])]))}${field("Bộ sưu tập", select("favoriteCollection", [["all", "Yêu thích & ghim"], ["favorites", "Chỉ yêu thích"], ["pinned", "Chỉ ghim"]]))}</div><p class="pt-help">Thứ tự lấy từ cùng dữ liệu với catalog. ↑/↓ hoán đổi hai mục đang hiển thị; các mục bị lọc ẩn được giữ nguyên.</p>${field("Thêm từ danh mục", select("catalogTool", catalog.map(tool => [tool.id, tool.name])))}<div class="pt-actions">${button("favorite-catalog-add", "Thêm tool yêu thích", true)}${button("favorite-catalog-pin", "Ghim tool đã chọn")}${button("favorite-filter-reset", "Bỏ bộ lọc")}</div><div class="pt-catalog-favorites" data-pt-catalog-favorites>${catalogFavoriteItems(preferences, catalog, {})}</div>`;
  }

  function favoriteTools(preferences, catalog, filters = {}) {
    const ids = filters.favoriteCollection === "favorites" ? preferences.favorites : filters.favoriteCollection === "pinned" ? preferences.pinned : [...new Set([...preferences.favorites, ...preferences.pinned])], query = normalizeSearch(filters.favoriteQuery).slice(0, 200);
    return ids.map(id => catalog.find(tool => tool.id === id)).filter(tool => tool && (!filters.favoriteGroup || filters.favoriteGroup === "all" || (tool.group || "Platform") === filters.favoriteGroup) && (!query || normalizeSearch(`${tool.name} ${tool.group || "Platform"} ${tool.description || ""}`).includes(query)));
  }
  function reorderCollection(ids, id, direction, visibleIds = ids) {
    if (!Array.isArray(ids) || !Array.isArray(visibleIds) || ![-1, 1].includes(direction)) throw new Error("Thứ tự bộ sưu tập không hợp lệ.");
    const visible = ids.filter(value => visibleIds.includes(value)), index = visible.indexOf(id), targetId = visible[index + direction];
    if (index < 0 || !targetId) return [...ids];
    const result = [...ids], from = result.indexOf(id), to = result.indexOf(targetId); [result[from], result[to]] = [result[to], result[from]]; return result;
  }
  function catalogFavoriteItems(preferences, catalog, filters) {
    const selected = favoriteTools(preferences, catalog, filters);
    return selected.length ? selected.map(tool => `<article data-pt-catalog-favorite="${esc(tool.id)}"><div><b>${esc(tool.name)}</b><small>${esc(tool.group || "Platform")} · ${preferences.pinned.includes(tool.id) ? "Đã ghim" : "Chưa ghim"}</small></div><button type="button" data-pt-catalog-open="${esc(tool.id)}">Mở</button><button type="button" data-pt-catalog-toggle="pinned" data-pt-catalog-id="${esc(tool.id)}" aria-pressed="${preferences.pinned.includes(tool.id)}">◇ Ghim</button><button type="button" data-pt-catalog-toggle="favorites" data-pt-catalog-id="${esc(tool.id)}" aria-pressed="${preferences.favorites.includes(tool.id)}">★ Yêu thích</button><div class="pt-favorite-order">${["favorites", "pinned"].filter(collection => preferences[collection].includes(tool.id) && (!filters.favoriteCollection || filters.favoriteCollection === "all" || filters.favoriteCollection === collection)).map(collection => {
      const visible = preferences[collection].filter(id => selected.some(tool => tool.id === id)), index = visible.indexOf(tool.id), label = collection === "favorites" ? "Yêu thích" : "Ghim";
      return `<span>${label}: ${preferences[collection].indexOf(tool.id) + 1}/${preferences[collection].length}</span><button type="button" data-pt-catalog-move="${collection}" data-pt-catalog-id="${esc(tool.id)}" data-pt-direction="-1" ${index <= 0 ? "disabled" : ""} aria-label="Đưa ${esc(tool.name)} lên trong ${label}">↑</button><button type="button" data-pt-catalog-move="${collection}" data-pt-catalog-id="${esc(tool.id)}" data-pt-direction="1" ${index < 0 || index >= visible.length - 1 ? "disabled" : ""} aria-label="Đưa ${esc(tool.name)} xuống trong ${label}">↓</button>`;
    }).join("")}</div></article>`).join("") : '<div class="pt-empty" role="status">Không có công cụ khớp bộ sưu tập và bộ lọc. Bỏ bộ lọc hoặc thêm tool từ danh mục.</div>';
  }
  function refreshCatalogFavorites() {
    const preferences = catalogPreferences(), catalog = toolCatalog(), filters = values(), selected = favoriteTools(preferences, catalog, filters);
    state.root.querySelector("[data-pt-catalog-favorites]").innerHTML = catalogFavoriteItems(preferences, catalog, filters);
    state.root.querySelector("[data-pt-catalog-favorite-count]").textContent = `${selected.length} đang hiển thị · ${preferences.favorites.length} yêu thích · ${preferences.pinned.length} ghim`;
  }
  function moveCatalogFavorite(collection, id, direction, filters = values(), owner = activeOwner()) {
    if (!["favorites", "pinned"].includes(collection)) throw new Error("Bộ sưu tập không hợp lệ."); assertAccount(owner);
    const preferences = catalogPreferences(), visible = favoriteTools(preferences, toolCatalog(), filters).map(tool => tool.id);
    const next = reorderCollection(preferences[collection], id, direction, visible); updateCatalogPreferences({ [collection]: next }, owner); return next;
  }

  const historyRows = (rows) => rows.length ? rows.map((row) => `<article data-pt-history-row data-search="${esc(`${row.name} ${row.action} ${row.source || "platform"}`.toLowerCase())}"><div><b>${esc(row.name)}</b><p>${esc(row.action)}</p><small>${new Date(row.createdAt).toLocaleString("vi-VN")} · ${esc(row.source || "platform")}</small></div><button type="button" data-pt-catalog-open="${esc(row.tool)}" ${toolCatalog().some(tool => tool.id === row.tool) ? "" : "disabled"}>Mở</button>${!row.source || row.source === "platform" ? `<button type="button" data-pt-history-delete="${esc(row.id)}" aria-label="Xóa hoạt động Platform">×</button>` : ""}</article>`).join("") : '<div class="pt-empty">Chưa có hoạt động.</div>';

  const favoritesMarkup = async () => {
    const root = state.root, owner = state.owner, rows = (await dbAll("favorites", owner)).sort((a, b) => a.order - b.order);
    if (root === state.root && owner === accountOwner()) state.favoriteLinks = rows;
    return `<div class="pt-layout"><section class="pt-card">${catalogFavoriteRows()}</section><section class="pt-card"><header><strong>Liên kết nội bộ cá nhân</strong><span data-pt-link-count>${rows.length} mục</span></header><div class="pt-grid-3">${field("Tên", '<input name="title" maxlength="160" placeholder="Ví dụ: Bộ đổi màu">')}${field("Route", '<input name="route" maxlength="240" placeholder="/tools/platform/theme-switcher">')}${field("Thư mục / tag", '<input name="folder" maxlength="80" placeholder="Công việc">')}</div><div class="pt-actions">${button("favorite-add", "Thêm liên kết", true)}${button("favorite-current", "Thêm công cụ hiện tại")}</div><div class="pt-grid-2">${field("Tìm liên kết", '<input name="linkQuery" type="search" maxlength="200" placeholder="Tên, route hoặc tag...">')}${field("Thư mục / tag", select("linkFolder", [["all", "Tất cả tag"], ...[...new Set(rows.map(row => row.folder || "Chưa phân loại"))].map(folder => [folder, folder])]))}</div><p class="pt-help">Liên kết cá nhân giữ nguyên dữ liệu cũ. Chỉ chấp nhận đường dẫn nội bộ. Kéo thả hoặc dùng nút lên/xuống để sắp xếp theo toàn bộ thư viện.</p><div class="pt-favorites" data-pt-favorites>${favoriteLinkItems(rows, {})}</div></section></div>`;
  };
  function filterFavoriteLinks(rows, filters = {}) {
    const query = normalizeSearch(filters.linkQuery).slice(0, 200);
    return rows.filter(row => (!filters.linkFolder || filters.linkFolder === "all" || (row.folder || "Chưa phân loại") === filters.linkFolder) && (!query || normalizeSearch(`${row.title} ${row.route} ${row.folder || "Chưa phân loại"}`).includes(query)));
  }
  function favoriteLinkItems(rows, filters) {
    const selected = filterFavoriteLinks(rows, filters);
    return selected.length ? selected.map(row => {
      const index = rows.indexOf(row);
      return `<article draggable="true" data-pt-favorite="${esc(row.id)}"><span>★</span><div><b>${esc(row.title)}</b><small>${esc(row.folder || "Chưa phân loại")} · ${esc(row.route)}</small></div><button type="button" data-pt-favorite-up="${esc(row.id)}" aria-label="Đưa lên" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-pt-favorite-down="${esc(row.id)}" aria-label="Đưa xuống" ${index === rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-pt-favorite-open="${esc(row.id)}">Mở</button><button type="button" data-pt-favorite-delete="${esc(row.id)}" aria-label="Xóa">×</button></article>`;
    }).join("") : '<div class="pt-empty" role="status">Không có liên kết khớp từ khóa hoặc tag.</div>';
  }
  function refreshFavoriteLinks() {
    const filters = values(), selected = filterFavoriteLinks(state.favoriteLinks, filters);
    state.root.querySelector("[data-pt-favorites]").innerHTML = favoriteLinkItems(state.favoriteLinks, filters);
    state.root.querySelector("[data-pt-link-count]").textContent = `${selected.length}/${state.favoriteLinks.length} mục`;
  }

  const exportMarkup = () => `<div class="pt-layout"><section class="pt-card"><fieldset><legend>Phạm vi dữ liệu riêng All Tools</legend><div class="pt-check-grid">${["Thiết lập All Tools", "Lịch sử thao tác", "Liên kết yêu thích", "Thông báo", "Bản nháp Platform Tools", "Workspace, tiện ích & danh mục", "Nội dung tệp workspace (cần chọn workspace)"].map((label, index) => `<label><input type="checkbox" name="scope" value="${index}" ${index < 4 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset>${field("Định dạng", select("format", [["json", "JSON (sao lưu)"], ["csv", "CSV (chỉ lịch sử Platform)"]]))}<p class="pt-help">Chỉ xuất tài khoản hiện tại, tổng tối đa 5 MB. Các phạm vi nội dung do bạn chọn có thể chứa ghi chú, chat hoặc tài liệu riêng; giữ tệp sao lưu an toàn. Không đọc khóa đăng nhập/token; không xuất nội dung công cụ Password/API/Clipboard. Tệp workspace tùy chọn, tối đa 1 MB/tệp và 2 MB tổng.</p><div class="pt-actions">${button("export-preview", "Tạo bản xem trước", true)}${button("export-download", "Tải xuống", false, "disabled")}</div></section><section class="pt-card"><header><strong>Bản xem trước</strong><span data-pt-export-size>0 B</span></header><pre class="pt-code" data-pt-output>Chọn phạm vi rồi tạo bản xem trước.</pre></section></div>`;

  const importMarkup = () => `<div class="pt-layout"><section class="pt-card"><label class="pt-dropzone"><input type="file" name="importFile" accept="application/json,.json"><span>Chọn hoặc kéo tệp JSON vào đây</span><small>Tệp được phân tích cục bộ, chưa ghi dữ liệu cho tới khi bạn xác nhận.</small></label><div class="pt-grid-2">${field("Xử lý trùng", select("strategy", [["merge", "Gộp, ưu tiên dữ liệu mới"], ["skip", "Bỏ qua mục đã có"], ["replace", "Thay thế phạm vi có trong tệp"]]))}${field("Giới hạn kích thước", '<output>5 MB · v1 tương thích / v2 đúng tài khoản</output>')}</div><p class="pt-help">Kiểm tra toàn bộ schema trước khi lưu. Nhập nhiều kho không phải transaction duy nhất: công cụ tạo bản chụp để hoàn tác nếu có lỗi và báo rõ nếu hoàn tác không đầy đủ. Tệp v2 của tài khoản khác sẽ bị từ chối.</p><div class="pt-actions">${button("import-validate", "Kiểm tra tệp", true)}${button("import-commit", "Xác nhận nhập", false, "disabled")}${button("import-cancel", "Hủy")}</div></section><section class="pt-card"><header><strong>Kiểm tra schema</strong><span data-pt-import-status>Chưa có tệp</span></header><pre class="pt-code" data-pt-output>Chưa có dữ liệu xem trước.</pre></section></div>`;

  const pwaMarkup = (kind) => `<div class="pt-layout"><section class="pt-card"><div class="pt-actions">${kind === "PWA" ? `${button("pwa-inspect", "Kiểm tra PWA", true)}${button("pwa-update", "Tìm bản cập nhật")}` : kind === "Offline Mode" ? `${button("offline-inspect", "Kiểm tra offline", true)}${button("offline-retry", "Kiểm tra truy cập tệp")}` : `${button("install-run", "Cài ứng dụng", true, state.installPrompt ? "" : "disabled")}${button("install-inspect", "Kiểm tra khả năng cài")}${button("install-help", "Xem hướng dẫn")}`}</div>${kind === "Offline Mode" ? `<fieldset><legend>Tải riêng bộ công cụ để dùng offline</legend><div class="pt-check-grid">${[["platform", "Platform & danh mục"], ["workspace", "Ghi chú, Kanban & tệp"], ["utility", "Chuyển đổi & xử lý dữ liệu"]].map(([value, label]) => `<label><input type="checkbox" name="offlineSuite" value="${value}" checked><span>${label}</span></label>`).join("")}</div><p class="pt-help">Chỉ tải JS/CSS công khai của bộ đã chọn, tối đa 15 MB. Không lưu API, tài khoản, tệp người dùng hoặc nội dung AI. Khả năng offline phụ thuộc Service Worker hiện có; các tính năng cần mạng vẫn không chạy offline.</p><div class="pt-actions">${button("offline-prepare", "Tải tài nguyên đã chọn")}${button("offline-cancel", "Dừng tải")}</div><progress data-pt-offline-progress value="0" max="100" aria-label="Tiến trình lưu tài nguyên"></progress></fieldset>` : ""}<div class="pt-pwa-report" data-pt-pwa-report><div class="pt-empty">Nhấn kiểm tra để đọc trạng thái thật của trình duyệt.</div></div></section><aside class="pt-card"><strong>Khả năng trình duyệt</strong><ul class="pt-capabilities">${capability("Service Worker", "serviceWorker" in navigator, "Cache và cập nhật ứng dụng")}${capability("Cache Storage", "caches" in window, "Chỉ thêm cache riêng All Tools; không xóa cache của website")}${capability("Install Prompt", Boolean(state.installPrompt), state.installPrompt ? "Có thể hiển thị ngay" : "Phụ thuộc trình duyệt và tiêu chí PWA")}</ul></aside></div>`;

  const shortcutsMarkup = async () => {
    const settings = await readSettings();
    let rows, warning = "";
    try { rows = normalizeShortcuts(settings.shortcuts || defaultShortcuts()); } catch (error) { rows = []; warning = `<p class="pt-help" role="status">${esc(error.message)} Dữ liệu cũ chưa bị xóa; dùng Xuất dữ liệu để giữ bản sao hoặc khôi phục mặc định.</p>`; }
    return `<div class="pt-layout"><section class="pt-card"><header><strong data-pt-shortcut-editor>Thêm phím tắt</strong><span>${rows.length}/30</span></header>${warning}<div class="pt-grid-2">${field("Tên phím tắt", '<input name="label" maxlength="80" placeholder="Mở Notes">')}${field("Tổ hợp", '<input name="combo" maxlength="80" placeholder="Alt+Shift+N">', "Không chiếm phím trình duyệt, soạn thảo hoặc Ctrl/Meta+K của HH Platform")}${field("Hành động / tool thật", select("shortcutAction", [["home", "Mở Trang chủ"], ["palette", "Mở Command Palette All Tools"], ["tools", "Mở catalog All Tools"], ["theme", "Mở thiết lập sáng/tối"], ...toolCatalog().map(tool => [`tool:${tool.id}`, `Tool · ${tool.name}`])]))}</div><div class="pt-actions">${button("shortcut-record", "Ghi tổ hợp phím", false, 'aria-pressed="false"')}${button("shortcut-add", "Lưu phím tắt", true)}${button("shortcut-cancel-edit", "Hủy sửa")}</div><div class="pt-shortcut-recorder" data-pt-recorder tabindex="0" role="group" aria-label="Vùng ghi tổ hợp phím"><p data-pt-recorder-status role="status">Nhấn Ghi tổ hợp phím rồi bấm tổ hợp ở vùng này. Escape hủy.</p></div><p class="pt-help">Chỉ chạy khi All Tools đang mở, không chạy trong input, contenteditable hoặc editor. Phím hệ thống Ctrl+K/Ctrl+Alt+K vẫn do website xử lý; xóa bản ghi không vô hiệu phím hệ thống. Không gọi API hay chạy mã.</p><div class="pt-actions">${button("shortcut-reset", "Khôi phục mặc định")}${button("shortcut-export", "Xuất JSON đúng tài khoản")}</div><div class="pt-shortcuts pt-shortcuts--editable" data-pt-shortcuts>${rows.length ? rows.map(row => `<article data-pt-shortcut-row="${esc(row.id)}"><div><b>${esc(row.label)}</b><small>${esc(shortcutActionLabel(row.action))} · ${isSystemCombo(row.combo) ? "Phím hệ thống" : row.enabled ? "Đang bật" : "Đang tắt"}</small></div><kbd>${esc(row.combo)}</kbd><div class="pt-actions"><button type="button" data-pt-shortcut-test="${esc(row.id)}">Thử</button><button type="button" data-pt-action="shortcut-edit:${esc(row.id)}">Sửa</button><button type="button" data-pt-action="shortcut-toggle:${esc(row.id)}" ${isSystemCombo(row.combo) ? "disabled" : ""} aria-pressed="${row.enabled}">${row.enabled ? "Tắt" : "Bật"}</button><button type="button" data-pt-action="shortcut-delete:${esc(row.id)}">Xóa</button></div></article>`).join("") : '<div class="pt-empty">Chưa có phím tắt tùy chỉnh hợp lệ. Thêm một tổ hợp an toàn ở trên.</div>'}</div></section><aside class="pt-card"><strong>Nhập phím tắt đã lưu</strong>${field("Tệp JSON", '<input type="file" name="shortcutFile" accept="application/json,.json">')}${field("Cách nhập", select("shortcutImportMode", [["merge", "Gộp, không ghi đè phím trùng"], ["replace", "Thay thế danh sách"]]))}<div class="pt-actions">${button("shortcut-import-check", "Kiểm tra tệp")}${button("shortcut-import-apply", "Xác nhận nhập", false, "disabled")}</div><pre class="pt-code" data-pt-shortcut-import>Chỉ phân tích cục bộ, chưa ghi dữ liệu. Tối đa 256 KB / 30 tổ hợp; chỉ cho phép lệnh và tool trong danh mục.</pre></aside></div>`;
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
    await getShortcuts(owner).catch(() => { if (root === state.root && owner === accountOwner()) { state.shortcutCache = []; shortcutRuntime.rows = []; } });
    if (version !== state.renderVersion || owner !== accountOwner() || state.root !== root) return false;
    if (name === "Theme Color Switcher") { previewTheme(values()); refreshPresetSelection(values()); root.querySelector('[data-pt-action="theme-undo"]').disabled = !settings.themeUndo; }
    if (["Global Search", "Command Palette++"].includes(name)) await runSearch(name === "Command Palette++");
    if (!window.indexedDB) status("IndexedDB không hỗ trợ: dữ liệu chỉ nằm trong bộ nhớ tạm, sẽ mất khi tải lại.", "warning");
    else if (!["Global Search", "Command Palette++"].includes(name)) status("Sẵn sàng. Dữ liệu riêng cho tài khoản trên thiết bị này.");
    if (name === "History Manager") try { refreshHistoryView(); } catch { /* Filter error is shown in its own status and export stays disabled. */ }
    if (name === "Favorite Manager") { refreshCatalogFavorites(); refreshFavoriteLinks(); }
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
    state.themePresetId = ""; state.historyRows = []; state.historyFiltered = [];
    state.shortcutEditing = ""; state.shortcutRecording = false; state.shortcutImport = null; state.shortcutImportVersion++; state.favoriteLinks = [];
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

  async function getThemePresets(owner = activeOwner()) { return themePresetStore((await readSettings(owner)).themePresets).items; }
  async function saveThemePreset(name, config, owner = activeOwner()) {
    name = presetName(name); config = themeConfig(config);
    const items = await getThemePresets(owner);
    if (items.length >= 12) throw new Error("Đã có 12 preset cá nhân. Xóa một preset trước khi thêm.");
    if (items.some(item => normalizeSearch(item.name) === normalizeSearch(name))) throw new Error("Tên preset đã tồn tại. Chọn tên khác hoặc đổi tên preset cũ.");
    const now = Date.now(), item = { id: `preset-${uid()}`, name, ...config, createdAt: now, updatedAt: now };
    assertAccount(owner); await saveSetting("themePresets", themePresetStore({ version: 1, items: [...items, item] }), owner); return item;
  }
  async function renameThemePreset(id, name, owner = activeOwner()) {
    name = presetName(name); const items = await getThemePresets(owner), item = items.find(item => item.id === id);
    if (!item) throw new Error("Preset không còn tồn tại. Mở lại công cụ để đọc danh sách mới.");
    if (items.some(other => other.id !== id && normalizeSearch(other.name) === normalizeSearch(name))) throw new Error("Tên preset đã tồn tại.");
    const next = { ...item, name, updatedAt: Date.now() }; assertAccount(owner);
    await saveSetting("themePresets", themePresetStore({ version: 1, items: items.map(other => other.id === id ? next : other) }), owner); return next;
  }
  async function deleteThemePreset(id, owner = activeOwner()) {
    const items = await getThemePresets(owner);
    if (!items.some(item => item.id === id)) throw new Error("Preset không còn tồn tại.");
    assertAccount(owner); await saveSetting("themePresets", { version: 1, items: items.filter(item => item.id !== id) }, owner);
  }
  async function useThemePreset(id, owner = activeOwner()) {
    const root = state.root, builtin = COSMIC_PRESETS.find(item => item.id === id), presets = builtin ? [...COSMIC_PRESETS] : [...COSMIC_PRESETS, ...await getThemePresets(owner)], preset = presets.find(item => item.id === id);
    if (!preset) throw new Error("Preset không tồn tại."); assertAccount(owner); if (root !== state.root) return null;
    const config = themeConfig(preset);
    for (const [key, value] of Object.entries(config)) root.querySelector(`[name="${key}"]`).value = String(value);
    root.querySelector("[data-pt-font-value]").textContent = `${config.fontScale}%`;
    state.themePresetId = id; previewTheme(config); refreshPresetSelection(config, presets); saveDraft(); return preset;
  }
  function refreshPresetSelection(config, presets) {
    if (!state.root) return;
    try { presets ||= [...COSMIC_PRESETS, ...themePresetStore(state.settings.themePresets).items]; } catch { presets = [...COSMIC_PRESETS]; }
    const matches = item => ["accent", "highlight", "fontScale", "contrast"].every(key => String(item[key]).toLowerCase() === String(config[key]).toLowerCase());
    let preset = presets.find(item => item.id === state.themePresetId && matches(item));
    if (!preset) preset = [...presets].reverse().find(matches);
    state.themePresetId = preset?.id || "";
    state.root.querySelectorAll("[data-pt-preset-preview]").forEach(button => button.setAttribute?.("aria-pressed", String(button.dataset?.ptPresetPreview === state.themePresetId)));
    const message = state.root.querySelector("[data-pt-preset-state]"); if (message) message.textContent = preset ? `Đang chọn ${preset.name}. Xem trước không đổi giao diện; dùng Áp dụng để lưu.` : "Màu tùy chỉnh. Bạn có thể đặt tên để lưu preset.";
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
    assertAccount(owner); if (root !== state.root) return;
    const next = targetId ? rows.findIndex((row) => row.id === targetId) : index + direction;
    if (index < 0 || next < 0 || next >= rows.length || index === next) return;
    const [row] = rows.splice(index, 1); rows.splice(next, 0, row);
    const ordered = rows.map((item, order) => ({ ...item, order }));
    await Promise.all(ordered.map(item => dbPut("favorites", item, owner)));
    if (root !== state.root || owner !== accountOwner()) return;
    state.favoriteLinks = ordered; refreshFavoriteLinks();
    root.querySelector(`[data-pt-favorite-open="${CSS.escape(id)}"]`)?.focus();
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
      state.generatedExport = ["id,tool,action,createdAt", ...rows.map((row) => [row.id, row.name, row.action, new Date(row.createdAt).toISOString()].map(csvCell).join(","))].join("\n");
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
    if (key === "themePresets") return themePresetStore(value);
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
      return normalizeShortcuts(value);
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
        publishAppearance(importedSettings, owner); state.shortcutCache = importedSettings.shortcuts || null; await refreshShortcutRuntime();
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

  const normalizeCombo = (event) => [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", event.key === " " ? "Space" : event.key?.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join("+");
  const shortcutRuntime = { owner: "", rows: [], generation: 0 };
  const defaultShortcuts = () => [{ id: "palette", label: "Mở Command Palette", combo: "Ctrl+K", action: "palette", enabled: true }, { id: "tools", label: "Mở All Tools", combo: "Ctrl+Alt+K", action: "tools", enabled: true }];
  const isSystemCombo = combo => /(?:^|\+)(?:Ctrl|Meta)\+/.test(combo) && combo.endsWith("+K");
  function shortcutAction(action) {
    if (["home", "palette", "tools", "theme"].includes(action)) return action;
    if (typeof action === "string" && /^tool:[a-z0-9][a-z0-9-]{0,79}$/.test(action) && toolCatalog().some(tool => tool.id === action.slice(5))) return action;
    throw new Error("Phím tắt chỉ được mở lệnh hoặc tool thật trong danh mục All Tools.");
  }
  function shortcutActionLabel(action) { return action.startsWith("tool:") ? toolCatalog().find(tool => tool.id === action.slice(5))?.name || action : ({ home: "Trang chủ", palette: "Command Palette All Tools", tools: "Catalog All Tools", theme: "Thiết lập sáng/tối" })[action] || action; }
  function shortcutConflict(combo, action) {
    if (isSystemCombo(combo) && !((combo === "Ctrl+K" || combo === "Meta+K") && action === "palette" || combo === "Ctrl+Alt+K" && action === "tools")) return "Tổ hợp K này được dành cho HH Platform; chọn phím khác.";
    if (["Alt+H", "Alt+M"].includes(combo) && !(combo === "Alt+H" && action === "home")) return "Alt+H/Alt+M được dành cho điều hướng website; chọn thêm Ctrl/Shift hoặc phím khác.";
    if (/^(?:Ctrl|Meta)(?:\+Shift)?\+(?:W|R|L|T|N|P|S|O|F|A|C|V|X|Z|Y|I|J|B|D|E|G|H|Q|U|[0-9])$/.test(combo) || /^(?:Meta\+Space|Alt\+Space|Alt\+(?:D|E|F)|Ctrl\+Escape|Meta\+Escape|Shift\+(?:Enter|Escape|Space|[A-Z0-9]))$/.test(combo)) return "Tổ hợp dành cho trình duyệt, hệ điều hành hoặc chỉnh sửa văn bản.";
    return "";
  }
  function normalizeShortcuts(rows) {
    if (!Array.isArray(rows) || rows.length > 30) throw new Error("Tối đa 30 phím tắt dạng danh sách.");
    const combos = new Set(), ids = new Set();
    return rows.map((row, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["id", "label", "combo", "action", "enabled"].includes(key)) || typeof row.label !== "string" || !row.label.trim() || row.label.length > 80 || /[\u0000-\u001f]/.test(row.label) || row.enabled !== undefined && typeof row.enabled !== "boolean") throw new Error("Phím tắt nhập không hợp lệ.");
      const id = row.id === undefined ? `import-${index}` : row.id;
      if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,179}$/i.test(id) || ids.has(id)) throw new Error("ID phím tắt không hợp lệ hoặc bị trùng.");
      const combo = canonicalCombo(row.combo), action = shortcutAction(row.action), conflict = shortcutConflict(combo, action);
      if (conflict) throw new Error(conflict);
      if (combos.has(combo)) throw new Error("Phím tắt bị trùng."); combos.add(combo); ids.add(id);
      return { id, label: row.label.trim(), combo, action, enabled: row.enabled !== false };
    });
  }
  function normalizeShortcutImport(payload, owner = activeOwner()) {
    assertAccount(owner);
    if (Array.isArray(payload)) return { format: "HH All Tool Shortcuts", version: 1, owner, shortcuts: normalizeShortcuts(payload), legacy: true };
    if (!payload || payload.format !== "HH All Tool Shortcuts" || payload.version !== 1 || payload.owner !== owner || Object.keys(payload).some(key => !["format", "version", "owner", "exportedAt", "shortcuts"].includes(key))) throw new Error("Tệp phím tắt sai định dạng hoặc thuộc tài khoản khác.");
    return { format: payload.format, version: 1, owner, shortcuts: normalizeShortcuts(payload.shortcuts), legacy: false };
  }
  async function saveShortcuts(rows, owner = activeOwner()) {
    const normalized = normalizeShortcuts(rows); assertAccount(owner); ++shortcutRuntime.generation; await saveSetting("shortcuts", normalized, owner); assertAccount(owner);
    shortcutRuntime.owner = owner; shortcutRuntime.rows = normalized; if (state.owner === owner) state.shortcutCache = normalized;
    try { localStorage.setItem(`hh.all-tools.shortcut-signal.v1.${owner}`, JSON.stringify({ at: Date.now(), id: uid() })); } catch {}
    dispatchEvent(new CustomEvent("hh:alltools-shortcuts-change", { detail: { owner } })); return normalized;
  }
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
  async function getShortcuts(owner = activeOwner()) {
    const root = state.root, generation = ++shortcutRuntime.generation;
    const settings = await readSettings(owner);
    const rows = normalizeShortcuts(settings.shortcuts || defaultShortcuts());
    if (generation === shortcutRuntime.generation && owner === accountOwner() && root === state.root) state.shortcutCache = rows;
    if (generation === shortcutRuntime.generation && owner === accountOwner()) { shortcutRuntime.owner = owner; shortcutRuntime.rows = rows; }
    return rows;
  }
  async function refreshShortcutRuntime() {
    const generation = ++shortcutRuntime.generation, owner = accountOwner();
    shortcutRuntime.owner = ""; shortcutRuntime.rows = [];
    if (!/^#\/tools(?:\/|$)/.test(location.hash) || window.HHAllToolState?.isAccountChanging?.()) { shortcutRuntime.owner = ""; shortcutRuntime.rows = []; return; }
    try { const rows = normalizeShortcuts((await readSettings(owner)).shortcuts || defaultShortcuts()); if (generation === shortcutRuntime.generation && owner === accountOwner() && /^#\/tools(?:\/|$)/.test(location.hash) && !window.HHAllToolState?.isAccountChanging?.()) { shortcutRuntime.owner = owner; shortcutRuntime.rows = rows; } }
    catch { if (generation === shortcutRuntime.generation) { shortcutRuntime.owner = ""; shortcutRuntime.rows = []; } }
  }
  function recordShortcutKey(event) {
    if (!state.shortcutRecording || !event.target?.closest?.("[data-pt-recorder]")) return false;
    if (event.defaultPrevented || event.repeat || event.isComposing || event.getModifierState?.("AltGraph") || state.owner !== accountOwner() || window.HHAllToolState?.isAccountChanging?.()) return true;
    if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return true;
    event.preventDefault(); event.stopPropagation?.();
    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) { state.shortcutRecording = false; state.root.querySelector('[data-pt-action="shortcut-record"]').setAttribute("aria-pressed", "false"); state.root.querySelector("[data-pt-recorder-status]").textContent = "Đã hủy ghi phím. Chưa thay đổi dữ liệu."; return true; }
    try {
      const combo = canonicalCombo(normalizeCombo(event)), action = shortcutAction(values().shortcutAction), conflict = shortcutConflict(combo, action);
      if (conflict) throw new Error(conflict);
      if ((state.shortcutCache || []).some(row => row.id !== state.shortcutEditing && row.combo === combo)) throw new Error("Tổ hợp đã được sử dụng. Chọn phím khác.");
      state.root.querySelector('[name="combo"]').value = combo; state.shortcutRecording = false;
      state.root.querySelector('[data-pt-action="shortcut-record"]').setAttribute("aria-pressed", "false"); state.root.querySelector("[data-pt-recorder-status]").textContent = `Đã ghi ${combo}. Nhấn Lưu phím tắt để áp dụng.`; saveDraft();
    } catch (error) { state.root.querySelector("[data-pt-recorder-status]").textContent = error.message; status(error.message, "error"); }
    return true;
  }

  function executeShortcut(action) {
    action = shortcutAction(action);
    if (action.startsWith("tool:")) { const id = action.slice(5), tool = toolCatalog().find(item => item.id === id); if (window.HHFeatureLab?.select) window.HHFeatureLab.select(id); else navigate(tool.route || `/tools/${id}`); return; }
    if (action === "home") navigate("/platform");
    if (action === "palette") { if (window.HHFeatureLab?.select) window.HHFeatureLab.select("Command Palette++"); else navigate(byId.get("command-palette").route); }
    if (action === "tools") { const catalog = document.querySelector("[data-all-tools-catalog]") || document.querySelector(".feature-lab [data-lab-search]"); if (catalog) { catalog.focus?.(); catalog.scrollIntoView?.({ block: "nearest" }); } else navigate("/tools"); }
    if (action === "theme") { if (window.HHFeatureLab?.select) window.HHFeatureLab.select("Dark Light Auto Mode"); else navigate(byId.get("dark-light-auto").route); }
  }
  function clearShortcutEditor() {
    state.shortcutEditing = ""; state.shortcutRecording = false;
    for (const [name, value] of [["label", ""], ["combo", ""], ["shortcutAction", "home"]]) { const input = state.root?.querySelector(`[name="${name}"]`); if (input) input.value = value; }
    state.root?.querySelector('[data-pt-action="shortcut-record"]')?.setAttribute?.("aria-pressed", "false"); saveDraft();
  }
  async function upsertShortcut(data, editing = "", owner = activeOwner()) {
    const root = state.root, rows = await getShortcuts(owner); assertAccount(owner);
    if (root !== state.root) throw new Error("Công cụ đã đóng. Bản nháp phím tắt chưa được lưu.");
    const previous = editing ? rows.find(row => row.id === editing) : null;
    if (editing && !previous) throw new Error("Phím tắt đang sửa đã bị xóa ở nơi khác. Bản nháp chưa được lưu.");
    const next = { id: editing || uid(), label: data.label, combo: data.combo, action: data.shortcutAction, enabled: previous?.enabled !== false };
    const result = normalizeShortcuts(editing ? rows.map(row => row.id === editing ? next : row) : [...rows, next]);
    await saveShortcuts(result, owner); return result.find(row => row.id === next.id);
  }
  function mergeShortcuts(existing, incoming, strategy) {
    existing = normalizeShortcuts(existing); incoming = normalizeShortcuts(incoming);
    if (strategy === "replace") return incoming;
    if (strategy !== "merge") throw new Error("Cách nhập phím tắt không hợp lệ.");
    const result = [...existing]; for (const row of incoming) if (!result.some(item => item.id === row.id || item.combo === row.combo)) result.push(row);
    return normalizeShortcuts(result);
  }
  async function checkShortcutFile() {
    const root = state.root, owner = state.owner, version = ++state.shortcutImportVersion, file = root.querySelector('[name="shortcutFile"]')?.files?.[0], strategy = values().shortcutImportMode;
    state.shortcutImport = null; root.querySelector('[data-pt-action="shortcut-import-apply"]').disabled = true;
    if (!file) throw new Error("Chọn một tệp JSON phím tắt."); if (file.size > 256 * 1024) throw new Error("Tệp phím tắt vượt 256 KB.");
    const text = await file.text(); assertAccount(owner); if (root !== state.root || version !== state.shortcutImportVersion) return;
    if (new Blob([text]).size > 256 * 1024) throw new Error("Tệp phím tắt vượt 256 KB.");
    const payload = normalizeShortcutImport(JSON.parse(text), owner), existing = await getShortcuts(owner); assertAccount(owner); if (root !== state.root || version !== state.shortcutImportVersion) return;
    const planned = mergeShortcuts(existing, payload.shortcuts, strategy);
    state.shortcutImport = payload; root.querySelector('[data-pt-action="shortcut-import-apply"]').disabled = false;
    root.querySelector("[data-pt-shortcut-import]").textContent = JSON.stringify({ valid: true, legacy: payload.legacy, incoming: payload.shortcuts.length, result: planned.length, owner, actions: payload.shortcuts.map(row => ({ label: row.label, combo: row.combo, action: row.action })) }, null, 2);
    status("Tệp phím tắt hợp lệ. Chưa ghi dữ liệu; kiểm tra lệnh rồi xác nhận.", "ready");
  }

  async function handleAction(action, target) {
    const owner = state.owner, root = state.root, tool = state.active;
    assertAccount(owner);
    if (action.startsWith("theme-preset-delete:") && state.confirmedAction !== action) return askConfirmation(action, "Xóa preset cá nhân này? Giao diện đang dùng và các preset khác được giữ nguyên.");
    if (action.startsWith("shortcut-delete:") && state.confirmedAction !== action) return askConfirmation(action, "Xóa bản ghi phím tắt này? Các phím hệ thống của website không bị vô hiệu.");
    if (action === "shortcut-import-apply" && values().shortcutImportMode === "replace" && state.confirmedAction !== action) return askConfirmation(action, "Thay thế danh sách phím tắt bằng tệp đã kiểm tra? Thiết lập khác không thay đổi.");
    if (["history-clear", "history-clear-recent", "notification-clear", "settings-reset", "theme-presets-clear", "shortcut-reset"].includes(action) && state.confirmedAction !== action) return askConfirmation(action, "Thao tác này chỉ xóa phạm vi đã chọn trong All Tools của tài khoản hiện tại. Bạn muốn tiếp tục?");
    state.confirmedAction = null;
    if (action === "search") return runSearch(false);
    if (action === "theme-preset-save") {
      const item = await saveThemePreset(values().presetName, values(), owner); assertAccount(owner); if (root !== state.root) return;
      root.querySelector('[name="presetName"]').value = ""; await record("theme.preset.save", { preset: item.id }, tool, owner);
      if (root !== state.root || owner !== accountOwner()) return;
      await render(root.parentElement, tool); if (state.owner !== owner || state.active !== tool) return;
      state.root?.querySelector(`[data-pt-preset-preview="${CSS.escape(item.id)}"]`)?.focus(); status("Đã lưu preset cá nhân; chưa áp dụng giao diện.", "success"); return;
    }
    if (action === "theme-presets-clear") { await dbDelete("settings", settingId("themePresets"), owner); if (root === state.root) await render(root.parentElement, tool); return; }
    if (/^theme-preset-(preview|apply|rename|delete):/.test(action)) {
      const [command, id] = action.split(":");
      if (command === "theme-preset-preview" || command === "theme-preset-apply") {
        const preset = await useThemePreset(id, owner); if (!preset || root !== state.root) return;
        if (command === "theme-preset-apply") { await handleAction("theme-apply"); if (root === state.root) status(`Đã áp dụng và lưu ${preset.name} cho All Tools. Giao diện website bên ngoài không thay đổi.`, "success"); }
        else status(`Đang xem trước ${preset.name}; chưa áp dụng hoặc lưu giao diện.`, "ready"); return;
      }
      if (command === "theme-preset-rename") await renameThemePreset(id, root.querySelector(`[data-pt-preset-name="${CSS.escape(id)}"]`)?.value, owner);
      else await deleteThemePreset(id, owner);
      assertAccount(owner); if (root !== state.root) return;
      await record(command === "theme-preset-rename" ? "theme.preset.rename" : "theme.preset.delete", { preset: id }, tool, owner);
      if (root !== state.root || owner !== accountOwner()) return;
      await render(root.parentElement, tool); if (state.owner !== owner || state.active !== tool) return;
      state.root?.querySelector(command === "theme-preset-rename" ? `[data-pt-preset-preview="${CSS.escape(id)}"]` : '[name="presetName"]')?.focus();
      status(command === "theme-preset-rename" ? "Đã lưu tên preset mới." : "Đã xóa preset cá nhân; giao diện đang dùng không thay đổi.", "success"); return;
    }
    if (action === "appearance-preview" || action === "appearance-apply") {
      const data = values(); validateSetting("colorMode", data.mode);
      if (data.mode === "schedule") { validateSetting("lightStart", data.lightStart); validateSetting("darkStart", data.darkStart); if (data.lightStart === data.darkStart) throw new Error("Giờ bắt đầu sáng và tối phải khác nhau."); }
      const mode = applyColorMode(data, action.endsWith("apply") ? state.root : state.root.querySelector("[data-pt-mode-preview]"));
      if (action.endsWith("apply")) { await Promise.all(Object.entries({ colorMode: data.mode, lightStart: data.lightStart, darkStart: data.darkStart }).map(([key, value]) => saveSetting(key, value, owner))); const previous = await readSettings(owner); publishAppearance({ ...previous, ...data }, owner); if (root !== state.root) return; keepColorModeSynced(data); await record("appearance.apply", { mode }, tool, owner); }
      return status(`${action.endsWith("apply") ? "Đã lưu" : "Đang xem trước"} chế độ ${mode}.`, "success");
    }
    if (action === "appearance-reset") { await saveSetting("colorMode", "system", owner); publishAppearance({ ...await readSettings(owner), mode: "system" }, owner); if (root !== state.root) return; keepColorModeSynced({ mode: "system" }); return render(root.parentElement, tool); }
    if (action === "theme-preview") { previewTheme(values()); refreshPresetSelection(values()); return status("Đang xem trước, website chưa thay đổi.", "running"); }
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
    if (action === "history-filter") return refreshHistoryView();
    if (action === "history-filter-reset") {
      for (const name of ["query", "historyTool", "historyAction", "historySource", "historyFrom", "historyTo"]) root.querySelector(`[name="${name}"]`).value = ["historyTool", "historyAction", "historySource"].includes(name) ? "all" : "";
      saveDraft(); return refreshHistoryView();
    }
    if (action === "history-refresh") {
      const rows = historyMetadata(await allHistory(owner)); assertAccount(owner); if (root !== state.root) return;
      state.historyRows = rows; refreshHistoryOptions(); return refreshHistoryView();
    }
    if (action === "history-clear-recent") { updateCatalogPreferences({ recent: [] }, owner); return render(root.parentElement, tool); }
    if (["favorite-catalog-add", "favorite-catalog-pin"].includes(action)) {
      const id = values().catalogTool;
      if (!toolCatalog().some(tool => tool.id === id)) throw new Error("Công cụ không tồn tại trong danh mục.");
      const collection = action.endsWith("pin") ? "pinned" : "favorites", prefs = catalogPreferences();
      updateCatalogPreferences({ [collection]: [...new Set([...prefs[collection], id])] }, owner);
      refreshCatalogFavorites(); return status("Đã lưu bộ sưu tập trong cùng danh mục All Tools.", "success");
    }
    if (action === "favorite-filter-reset") {
      for (const [name, value] of [["favoriteQuery", ""], ["favoriteGroup", "all"], ["favoriteCollection", "all"]]) root.querySelector(`[name="${name}"]`).value = value;
      saveDraft(); return refreshCatalogFavorites();
    }
    if (action === "history-export" || action === "history-export-csv") {
      const rows = historyMetadata(await allHistory(owner)); assertAccount(owner); if (root !== state.root) return;
      state.historyRows = rows; refreshHistoryOptions(); const filtered = refreshHistoryView(); if (!filtered.length) throw new Error("Không có hoạt động khớp bộ lọc để xuất.");
      const format = action === "history-export-csv" ? "csv" : "json";
      download(historyExport(filtered, format, owner), `hh-all-tools-history-filtered.${format}`, format === "csv" ? "text/csv;charset=utf-8" : "application/json");
      status(`Đã tạo tệp ${format.toUpperCase()} gồm ${filtered.length} hoạt động đang lọc, chỉ chứa metadata.`, "success"); return;
    }
    if (action === "history-clear") { await dbClear("history", owner); if (root === state.root) return render(root.parentElement, tool); return; }
    if (action === "favorite-add" || action === "favorite-current") { const data = values(), rows = await dbAll("favorites", owner); assertAccount(owner); if (root !== state.root) return; const route = validRoute(action.endsWith("current") ? byName.get(tool).route : data.route), title = action.endsWith("current") ? tool : data.title.trim(); if (!title || title.length > 160) throw new Error("Hãy nhập tên tối đa 160 ký tự."); if (rows.some((row) => row.route === route)) throw new Error("Đường dẫn đã có trong danh sách yêu thích."); await dbPut("favorites", { id: uid(), title, route, folder: data.folder?.trim().slice(0, 80) || "Chưa phân loại", order: rows.length, createdAt: Date.now() }, owner); await record("favorite.add", { route }, tool, owner); if (root === state.root) return render(root.parentElement, tool); return; }
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
    if (action === "shortcut-add") { const row = await upsertShortcut(values(), state.shortcutEditing, owner); assertAccount(owner); if (root !== state.root) return; clearShortcutEditor(); await render(root.parentElement, tool); if (state.owner === owner && state.active === tool) { state.root.querySelector(`[data-pt-action="shortcut-edit:${CSS.escape(row.id)}"]`)?.focus(); status("Đã lưu phím tắt trên thiết bị, chỉ có hiệu lực trong All Tools.", "success"); } return; }
    if (action === "shortcut-record") { state.shortcutRecording = !state.shortcutRecording; root.querySelector('[data-pt-action="shortcut-record"]').setAttribute("aria-pressed", String(state.shortcutRecording)); root.querySelector("[data-pt-recorder-status]").textContent = state.shortcutRecording ? "Đang ghi: bấm một tổ hợp an toàn. Escape hủy." : "Đã dừng ghi, chưa lưu dữ liệu."; if (state.shortcutRecording) root.querySelector("[data-pt-recorder]").focus(); return; }
    if (action === "shortcut-cancel-edit") { clearShortcutEditor(); root.querySelector("[data-pt-shortcut-editor]").textContent = "Thêm phím tắt"; root.querySelector('[name="label"]').focus(); return; }
    if (/^shortcut-(edit|toggle|delete):/.test(action)) {
      const [command, id] = action.split(":"), rows = await getShortcuts(owner); assertAccount(owner); if (root !== state.root) return;
      const row = rows.find(item => item.id === id); if (!row) throw new Error("Phím tắt không còn tồn tại.");
      if (command === "shortcut-edit") { state.shortcutEditing = id; for (const [name, value] of [["label", row.label], ["combo", row.combo], ["shortcutAction", row.action]]) root.querySelector(`[name="${name}"]`).value = value; root.querySelector("[data-pt-shortcut-editor]").textContent = `Sửa ${row.label}`; root.querySelector('[name="label"]').focus(); return; }
      if (command === "shortcut-toggle" && isSystemCombo(row.combo)) throw new Error("Phím hệ thống do website quản lý, không tắt từ All Tools.");
      await saveShortcuts(command === "shortcut-delete" ? rows.filter(item => item.id !== id) : rows.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item), owner);
      if (root !== state.root || owner !== accountOwner()) return; await render(root.parentElement, tool); if (state.owner === owner && state.active === tool) state.root.querySelector(command === "shortcut-delete" ? '[name="label"]' : `[data-pt-action="shortcut-toggle:${CSS.escape(id)}"]`)?.focus(); return;
    }
    if (action === "shortcut-reset") { await saveShortcuts(defaultShortcuts(), owner); if (root === state.root) { clearShortcutEditor(); return render(root.parentElement, tool); } return; }
    if (action === "shortcut-export") { const rows = await getShortcuts(owner); assertAccount(owner); if (root !== state.root) return; download(JSON.stringify({ format: "HH All Tool Shortcuts", version: 1, owner, exportedAt: new Date().toISOString(), shortcuts: rows }, null, 2), "hh-shortcuts.json"); return; }
    if (action === "shortcut-import-check") return checkShortcutFile();
    if (action === "shortcut-import-apply") {
      if (!state.shortcutImport) throw new Error("Chưa có tệp phím tắt đã kiểm tra.");
      const payload = state.shortcutImport, incoming = normalizeShortcuts(payload.shortcuts); if (payload.owner !== owner) throw new Error("Tệp thuộc tài khoản khác.");
      const version = state.shortcutImportVersion, strategy = values().shortcutImportMode, existing = await getShortcuts(owner); assertAccount(owner);
      if (root !== state.root || version !== state.shortcutImportVersion || payload !== state.shortcutImport) return;
      const result = mergeShortcuts(existing, incoming, strategy);
      await saveShortcuts(result, owner); if (root !== state.root || owner !== accountOwner()) return; await render(root.parentElement, tool);
      if (state.owner === owner && state.active === tool) status(`Đã lưu ${result.length} phím tắt. Bản ghi trùng không được ghi đè khi gộp.`, "success"); return;
    }
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
    const root = state.root, tool = state.active, owner = state.owner;
    const onClick = async (event) => {
      const target = event.target.closest("button");
      if (target?.dataset.ptBusy) return;
      try {
        assertAccount(owner); if (root !== state.root) return;
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
          refreshCatalogFavorites();
          root.querySelector(`[data-pt-catalog-toggle="${collection}"][data-pt-catalog-id="${CSS.escape(id)}"]`)?.focus(); return;
        }
        const catalogMove = event.target.closest("[data-pt-catalog-move]");
        if (catalogMove) {
          const collection = catalogMove.dataset.ptCatalogMove, id = catalogMove.dataset.ptCatalogId, direction = Number(catalogMove.dataset.ptDirection);
          moveCatalogFavorite(collection, id, direction, values(), owner); refreshCatalogFavorites();
          const moved = root.querySelector(`[data-pt-catalog-move="${collection}"][data-pt-catalog-id="${CSS.escape(id)}"][data-pt-direction="${direction}"]`);
          (moved && !moved.disabled ? moved : root.querySelector(`[data-pt-catalog-open="${CSS.escape(id)}"]`))?.focus(); return;
        }
        const notificationId = event.target.closest("[data-pt-delete-notification]")?.dataset.ptDeleteNotification;
        if (notificationId) { await dbDelete("notifications", notificationId, owner); publishNotificationSignal(owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const historyDelete = event.target.closest("[data-pt-history-delete]")?.dataset.ptHistoryDelete;
        if (historyDelete) { await dbDelete("history", historyDelete, owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const historyOpen = event.target.closest("[data-pt-history-open]")?.dataset.ptHistoryOpen;
        if (historyOpen) { const manifest = byId.get(historyOpen); if (manifest) window.HHFeatureLab?.select?.(manifest.name); return; }
        const favoriteOpen = event.target.closest("[data-pt-favorite-open]")?.dataset.ptFavoriteOpen;
        if (favoriteOpen) { const row = (await dbAll("favorites", owner)).find((item) => item.id === favoriteOpen); assertAccount(owner); if (root === state.root && row) navigate(row.route); return; }
        const favoriteDelete = event.target.closest("[data-pt-favorite-delete]")?.dataset.ptFavoriteDelete;
        if (favoriteDelete) { await dbDelete("favorites", favoriteDelete, owner); if (root === state.root) await render(root.parentElement, tool); return; }
        const favoriteUp = event.target.closest("[data-pt-favorite-up]")?.dataset.ptFavoriteUp;
        if (favoriteUp) return await moveFavorite(favoriteUp);
        const favoriteDown = event.target.closest("[data-pt-favorite-down]")?.dataset.ptFavoriteDown;
        if (favoriteDown) return await moveFavorite(favoriteDown, 1);
        const shortcutTest = event.target.closest("[data-pt-shortcut-test]")?.dataset.ptShortcutTest;
        if (shortcutTest) { const row = (await getShortcuts(owner)).find((item) => item.id === shortcutTest); assertAccount(owner); if (root === state.root && row) executeShortcut(row.action); return; }
      } catch (error) { if (root === state.root && owner === accountOwner()) status(error.message || "Không thể hoàn thành thao tác.", "error"); }
      finally { if (target) { delete target.dataset.ptBusy; target.removeAttribute("aria-busy"); } }
    };
    const onInput = (event) => {
      if (root !== state.root || owner !== accountOwner()) return;
      if (event.target.name === "query" && ["Global Search", "Command Palette++"].includes(state.active)) runSearch(state.active === "Command Palette++").catch((error) => { if (root === state.root) status(error.message, "error"); });
      if (event.target.name === "fontScale") { root.querySelector("[data-pt-font-value]").textContent = `${event.target.value}%`; previewTheme(values()); refreshPresetSelection(values()); }
      if (["accent", "highlight", "contrast"].includes(event.target.name)) { previewTheme(values()); refreshPresetSelection(values()); }
      if (tool === "History Manager" && ["query", "historyTool", "historyAction", "historySource", "historyFrom", "historyTo"].includes(event.target.name)) try { refreshHistoryView(); } catch { /* Preserve inputs and show the filter error. */ }
      if (tool === "Favorite Manager" && ["favoriteQuery", "favoriteGroup", "favoriteCollection"].includes(event.target.name)) refreshCatalogFavorites();
      if (tool === "Favorite Manager" && ["linkQuery", "linkFolder"].includes(event.target.name)) refreshFavoriteLinks();
      if (["shortcutFile", "shortcutImportMode"].includes(event.target.name)) { state.shortcutImport = null; state.shortcutImportVersion++; root.querySelector('[data-pt-action="shortcut-import-apply"]').disabled = true; root.querySelector("[data-pt-shortcut-import]").textContent = "Tệp hoặc cách nhập đã đổi. Nhấn Kiểm tra tệp lại trước khi áp dụng."; }
      if (event.target.name === "count") root.querySelector("[data-pt-count]").textContent = event.target.value;
      if (event.target.name === "settingSearch") { const query = event.target.value.toLowerCase(); root.querySelectorAll("[data-pt-settings] > label").forEach((row) => { row.hidden = !row.dataset.search.includes(query); }); }
      if (event.target.name === "importFile") { state.importFile = event.target.files?.[0] || null; state.importPayload = null; root.querySelector('[data-pt-action="import-commit"]').disabled = true; }
      if (["scope", "format"].includes(event.target.name) && state.active === "Export Data") { state.generatedExport = ""; root.querySelector('[data-pt-action="export-download"]').disabled = true; }
      saveDraft();
    };
    const onKey = (event) => {
      if (root !== state.root || owner !== accountOwner() || event.defaultPrevented || event.repeat || event.isComposing || event.getModifierState?.("AltGraph")) return;
      if (recordShortcutKey(event)) return;
      if (event.key === "Escape") { root.querySelector("[data-pt-confirm]")?.remove(); state.confirmedAction = null; state.confirmedImport = null; if (state.active === "Command Palette++") root.querySelector('input[name="query"]')?.focus(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && event.target.name === "query") { event.preventDefault(); const rows = [...root.querySelectorAll("[data-pt-results] .pt-result")]; rows[event.key === "ArrowUp" ? rows.length - 1 : 0]?.focus(); }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && event.target.matches("[data-pt-results] .pt-result")) { event.preventDefault(); const rows = [...root.querySelectorAll("[data-pt-results] .pt-result")], index = rows.indexOf(event.target), next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length; rows[next]?.focus(); }
      if (event.key === "Enter" && event.target.name === "query") { event.preventDefault(); const result = root.querySelector("[data-pt-results] .pt-result"); if (result) result.click(); else if (state.active === "History Manager") handleAction("history-filter").catch((error) => status(error.message, "error")); }
    };
    const onChange = event => { if (tool === "History Manager" && ["historyTool", "historyAction", "historySource", "historyFrom", "historyTo"].includes(event.target.name) || tool === "Favorite Manager" && ["favoriteGroup", "favoriteCollection", "linkFolder"].includes(event.target.name) || ["shortcutFile", "shortcutImportMode"].includes(event.target.name)) onInput(event); };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("keydown", onKey);
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
    state.cleanup.push(() => { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKey); dropzone?.removeEventListener("dragover", onDragOver); dropzone?.removeEventListener("dragleave", onDragLeave); dropzone?.removeEventListener("drop", onDrop); });
  }

  function globalShortcut(event) {
    const host = window.HHFeatureLab?.activeHost?.() || state.root;
    if (event.defaultPrevented || event.repeat || event.isComposing || event.getModifierState?.("AltGraph") || document.hidden || !/^#\/tools(?:\/|$)/.test(location.hash) || !host?.isConnected || host.closest?.("[hidden],[aria-hidden=true]") || shortcutRuntime.owner !== accountOwner() || window.HHAllToolState?.isAccountChanging?.() || state.shortcutRecording || event.target?.closest?.("input,textarea,select,[contenteditable],[role=textbox],.monaco-editor,.cm-editor,.CodeMirror")) return;
    const combo = normalizeCombo(event);
    // Shared shell handlers own these existing navigation chords.
    if (isSystemCombo(combo) || ["Alt+H", "Alt+M"].includes(combo)) return;
    const shortcut = shortcutRuntime.rows.find(row => row.enabled && row.combo === combo);
    if (!shortcut) return;
    try { shortcutAction(shortcut.action); } catch { return; }
    event.preventDefault(); executeShortcut(shortcut.action);
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
    refreshShortcutRuntime();
    if (state.owner === accountOwner()) return;
    const root = state.root, host = root?.parentElement, name = state.active;
    state.appearanceCleanup?.(); state.appearanceCleanup = null;
    cleanupRuntime();
    if (root?.isConnected && host) render(host, name).catch(() => {});
  };
  addEventListener("hh:auth-change", accountChanged);
  addEventListener("hh:alltools-account-change", () => { ++shortcutRuntime.generation; shortcutRuntime.owner = ""; shortcutRuntime.rows = []; cleanupRuntime(); });
  addEventListener("keydown", globalShortcut);
  addEventListener("hashchange", refreshShortcutRuntime);
  addEventListener("hh:assets-ready", refreshShortcutRuntime);
  addEventListener("hh:route-rendered", refreshShortcutRuntime);
  addEventListener("hh:alltools-shortcuts-change", event => { if (event.detail?.owner === accountOwner()) refreshShortcutRuntime(); });
  addEventListener("storage", (event) => { if (event.key === "hh-auth-user") accountChanged(); else if (event.key === null || event.key === `hh.all-tools.shortcut-signal.v1.${accountOwner()}`) refreshShortcutRuntime(); });
  const integrationTimer = setInterval(() => { if (integrateFeatureLab()) clearInterval(integrationTimer); }, 120);
  setTimeout(() => clearInterval(integrationTimer), 15000);
  ensureStyle();
  refreshShortcutRuntime();

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
