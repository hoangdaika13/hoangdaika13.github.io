(function initHHImageTextStudio(global) {
  "use strict";

  const STORAGE_KEY = "hh-image-text-studio-v1";
  const PROJECT_DB = "hh-image-text-studio-projects";
  const PROJECT_STORE = "autosaves";
  const PROJECT_SCHEMA_VERSION = 2;
  const DESIGN_WIDTH = 1280;
  const DESIGN_HEIGHT = 720;
  const MAX_HISTORY = 40;
  const PAGE_SIZE = 60;
  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]);
  const FONT_GROUPS = Object.freeze([
    ["Nhẹ nhàng", ["EB Garamond", "Cormorant Infant", "Spectral", "Fraunces", "Prata", "Marcellus", "Italiana", "Forum", "Bellefair", "Poiret One", "Josefin Sans", "Quicksand", "Manrope"]],
    ["Thanh lịch", ["Playfair Display", "Cormorant Garamond", "DM Serif Display", "Bodoni Moda", "Libre Baskerville", "Lora", "Merriweather", "Cinzel"]],
    ["Hiện đại", ["Be Vietnam Pro", "Montserrat", "Poppins", "Raleway", "Oswald", "Bebas Neue", "Roboto Slab", "Inter"]],
    ["Viết tay", ["Great Vibes", "Dancing Script", "Pacifico", "Allura", "Parisienne", "Sacramento"]],
    ["Hàn Quốc", ["Noto Serif KR", "Noto Sans KR", "Nanum Myeongjo", "Gowun Batang", "Song Myung", "Black Han Sans", "Do Hyeon"]],
    ["Nhật Bản", ["Noto Serif JP", "Noto Sans JP", "Zen Old Mincho", "Shippori Mincho", "Kaisei Decol", "M PLUS Rounded 1c"]],
    ["Trung Quốc", ["Noto Serif SC", "Noto Sans SC", "Ma Shan Zheng", "ZCOOL XiaoWei"]],
    ["Thái & Ả Rập", ["Noto Serif Thai", "Noto Sans Thai", "Pridi", "Noto Kufi Arabic", "Noto Naskh Arabic"]]
  ]);
  const OUTPUT_PRESETS = Object.freeze({
    fast: { label: "YouTube nhanh · 1280×720", width: 1280, height: 720 },
    hd: { label: "YouTube Full HD · 1920×1080", width: 1920, height: 1080 },
    ultra: { label: "YouTube 4K · 3840×2160", width: 3840, height: 2160 },
    banner: { label: "YouTube banner · 2560×1440", width: 2560, height: 1440 },
    shorts: { label: "Shorts cover · 1080×1920", width: 1080, height: 1920 },
    square: { label: "Vuông · 1080×1080", width: 1080, height: 1080 },
    vertical: { label: "Dọc · 1080×1920", width: 1080, height: 1920 }
  });

  const DEFAULT_LAYER = Object.freeze({
    text: "",
    font: "Playfair Display",
    size: 5.4,
    weight: 600,
    color: "#ffffff",
    stroke: "#15221d",
    strokeWidth: 0.12,
    shadow: 0.72,
    opacity: 1,
    x: 0.5,
    y: 0.5,
    maxWidth: 0.74,
    align: "center",
    lineHeight: 1.16,
    letterSpacing: 0,
    rotation: 0,
    italic: false,
    uppercase: false,
    autoContrast: true,
    background: false,
    visible: true,
    locked: false,
    glow: 0,
    gradient: false,
    gradientStart: "#ffffff",
    gradientEnd: "#7de9ff"
  });

  const DEFAULT_IMAGE_STYLE = Object.freeze({
    enabled: false,
    tint: "#ffffff",
    tintOpacity: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    blur: 0,
    vignette: 0,
    fit: "cover",
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false
  });

  const DEFAULT_TEMPLATE = Object.freeze({
    image: { ...DEFAULT_IMAGE_STYLE },
    title: { ...DEFAULT_LAYER, text: "Mellow Season", size: 5.5, y: 0.49, weight: 600 },
    subtitle: { ...DEFAULT_LAYER, text: "In the Space Between", font: "Cormorant Garamond", size: 1.55, y: 0.565, weight: 500, opacity: 0.92, maxWidth: 0.62 },
    footer: { ...DEFAULT_LAYER, text: "© {date} Your Channel · All Rights Reserved", font: "Montserrat", size: 0.9, y: 0.93, weight: 500, opacity: 0.88, maxWidth: 0.82 }
  });

  const PRESETS = Object.freeze({
    mellow: {
      label: "Mellow giữa ảnh",
      title: { ...DEFAULT_TEMPLATE.title },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle },
      footer: { ...DEFAULT_TEMPLATE.footer }
    },
    editorial: {
      label: "Editorial sáng",
      title: { ...DEFAULT_TEMPLATE.title, font: "Bodoni Moda", size: 6.3, y: 0.44, weight: 700 },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, font: "Montserrat", size: 1.35, y: 0.54, weight: 500 },
      footer: { ...DEFAULT_TEMPLATE.footer, y: 0.91 }
    },
    bold: {
      label: "Tiêu đề nổi bật",
      title: { ...DEFAULT_TEMPLATE.title, font: "Bebas Neue", size: 8.3, y: 0.5, weight: 700, strokeWidth: 0.22, uppercase: true },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, font: "Montserrat", size: 1.8, y: 0.61, weight: 700 },
      footer: { ...DEFAULT_TEMPLATE.footer }
    },
    lower: {
      label: "Góc trái điện ảnh",
      title: { ...DEFAULT_TEMPLATE.title, font: "Playfair Display", size: 6.3, x: 0.08, y: 0.72, align: "left", maxWidth: 0.65 },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, font: "Montserrat", size: 1.5, x: 0.08, y: 0.82, align: "left", maxWidth: 0.65 },
      footer: { ...DEFAULT_TEMPLATE.footer, x: 0.08, y: 0.92, align: "left", maxWidth: 0.7 }
    },
    korean: {
      label: "Hàn Quốc tối giản",
      title: { ...DEFAULT_TEMPLATE.title, text: "여름의 순간", font: "Noto Serif KR", size: 5.6, y: 0.47, weight: 600 },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, text: "마음이 쉬어가는 음악", font: "Noto Sans KR", size: 1.5, y: 0.56 },
      footer: { ...DEFAULT_TEMPLATE.footer }
    },
    titleOnly: {
      label: "Chỉ tiêu đề",
      title: { ...DEFAULT_TEMPLATE.title, size: 6.5 },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, text: "" },
      footer: { ...DEFAULT_TEMPLATE.footer, text: "" }
    }
  });

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const naturalCompare = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  const sanitizeName = (value) => String(value || "thumbnail").replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 150) || "thumbnail";
  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  let uid = 0;
  let host = null;
  let root = null;
  let previewCanvas = null;
  let previewContext = null;
  let previewFrame = 0;
  let previewTimer = 0;
  let renderToken = 0;
  let keyHandler = null;
  let dragState = null;
  let beforeEditSnapshot = null;
  let eventController = null;
  let autosaveTimer = 0;
  let autosaveDbPromise = null;
  let lastPreviewBuffer = null;
  let activeDialogTrigger = null;
  let lifecycleToken = 0;
  const loadedFontFamilies = new Set(["Inter"]);
  const localFonts = [];
  const hitBoxes = new Map();
  const imageCache = new Map();

  const initialSettings = () => ({
    output: "fast",
    format: "image/jpeg",
    quality: 0.9,
    maxMB: 1.9,
    overlay: 0.1,
    safeZone: true,
    zipChunk: 100,
    suffix: "-thumbnail",
    editMode: "all",
    aiProvider: "auto",
    aiScope: "page",
    aiPrompt: "Mỗi ảnh một cụm 2–4 từ tiếng Anh, phong cách yên bình và tự nhiên",
    youtubeTopic: "soft piano, slow living, peaceful countryside",
    trendPeriod: "month",
    trendRegion: "US",
    titleLanguage: "en",
    aiSubtitle: false,
    aiRename: true,
    aiColor: false,
    structuredNames: true,
    zoom: "fit",
    grid: false,
    guides: true,
    miniPreview: true,
    activeTool: "select"
  });

  const state = {
    items: [],
    selectedIds: new Set(),
    activeId: "",
    page: 0,
    pageSize: PAGE_SIZE,
    query: "",
    sort: "asc",
    activeSlot: "title",
    layerOrder: ["title", "subtitle", "footer"],
    layerClipboard: null,
    variants: [],
    variantBase: null,
    activeVariant: "original",
    template: clone(DEFAULT_TEMPLATE),
    settings: initialSettings(),
    exporting: false,
    cancelExport: false,
    history: [],
    future: [],
    pendingProject: null,
    notices: [],
    ai: { running: false, cancel: false, done: 0, total: 0, trendLabel: "", trendContext: "", providerStatus: null, providerStatusLoading: false, fallbackNotice: "" }
  };

  const activeItem = () => state.items.find((item) => item.id === state.activeId) || null;
  const itemIndex = (item) => state.items.indexOf(item);
  const outputPreset = () => OUTPUT_PRESETS[state.settings.output] || OUTPUT_PRESETS.fast;
  const layerFor = (item, slot) => ({ ...DEFAULT_LAYER, ...(state.template[slot] || {}), ...(item?.overrides?.[slot] || {}) });
  const imageStyleFor = (item) => ({ ...DEFAULT_IMAGE_STYLE, ...(state.template.image || {}), ...(item?.overrides?.image || {}) });
  const editableLayer = (item, slot) => {
    if (state.settings.editMode === "all" || !item) return state.template[slot];
    item.overrides[slot] ||= {};
    return item.overrides[slot];
  };
  const editableImageStyle = (item) => {
    if (state.settings.editMode === "all" || !item) return (state.template.image ||= { ...DEFAULT_IMAGE_STYLE });
    return (item.overrides.image ||= {});
  };

  const isPlainRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
  const safeRecord = (value, allowed) => {
    if (!isPlainRecord(value)) return {};
    const output = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key) && key !== "__proto__" && key !== "constructor" && key !== "prototype") output[key] = value[key];
    });
    return output;
  };

  function openAutosaveDb() {
    if (!global.indexedDB) return Promise.resolve(null);
    if (autosaveDbPromise) return autosaveDbPromise;
    autosaveDbPromise = new Promise((resolve) => {
      const request = global.indexedDB.open(PROJECT_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return autosaveDbPromise;
  }

  async function saveAutosave() {
    const db = await openAutosaveDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(PROJECT_STORE, "readwrite");
        transaction.objectStore(PROJECT_STORE).put(projectData(), "current");
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function restoreAutosave(token) {
    const db = await openAutosaveDb();
    if (!db || token !== lifecycleToken || !root) return false;
    const data = await new Promise((resolve) => {
      try {
        const request = db.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).get("current");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (!data || token !== lifecycleToken || !root || state.history.length || state.items.length) return false;
    try {
      const validated = validateProjectData(data);
      state.template = validated.template;
      state.settings = { ...validated.settings, editMode: "all" };
      state.layerOrder = validated.layerOrder;
      state.variants = validated.variants;
      state.variantBase = validated.variantBase;
      state.pendingProject = validated;
      renderAll({ keepPage: true });
      applyZoom();
      return true;
    } catch {
      return false;
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = global.setTimeout(() => { autosaveTimer = 0; saveAutosave(); }, 480);
  }

  function persistSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: state.template, settings: state.settings }));
    } catch {}
    scheduleAutosave();
  }

  function restoreSettings() {
    state.template = clone(DEFAULT_TEMPLATE);
    state.settings = initialSettings();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.template) state.template = {
        image: { ...DEFAULT_IMAGE_STYLE, ...(saved.template.image || {}) },
        title: { ...DEFAULT_TEMPLATE.title, ...(saved.template.title || {}) },
        subtitle: { ...DEFAULT_TEMPLATE.subtitle, ...(saved.template.subtitle || {}) },
        footer: { ...DEFAULT_TEMPLATE.footer, ...(saved.template.footer || {}) }
      };
      if (saved?.settings) state.settings = { ...initialSettings(), ...saved.settings, editMode: "all" };
    } catch {}
  }

  function notify(message, tone = "info") {
    if (!root) return;
    const tray = root.querySelector("[data-toast-tray]");
    if (!tray) return;
    const toast = document.createElement("div");
    toast.className = `its-toast is-${tone}`;
    const labels = { success: ["✓", "Hoàn tất"], error: ["!", "Cần kiểm tra"], info: ["i", "Thông báo"] };
    const [icon, title] = labels[tone] || labels.info;
    toast.innerHTML = `<span class="its-toast-icon">${icon}</span><div><strong>${title}</strong><p>${escapeHtml(message)}</p></div><i class="its-toast-life"></i>`;
    tray.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function aiProviderSummary() {
    const gemini = state.ai.providerStatus?.providers?.gemini;
    if (state.ai.fallbackNotice) return state.ai.fallbackNotice;
    if (state.ai.providerStatusLoading) return "Đang kiểm tra kết nối AI…";
    if (!state.ai.providerStatus) return "Tự chuyển dự phòng nếu Gemini tạm hết quota.";
    if (!gemini?.configured) return "Gemini chưa được cấu hình trên server; Tool vẫn dùng chế độ dự phòng.";
    if (Number(gemini.availableKeyCount || 0) < 1) return "Gemini đang tạm nghỉ do quota; Tool vẫn tạo title bằng chế độ dự phòng.";
    return `Gemini sẵn sàng · ${gemini.defaultModel || "default model"} · tự dự phòng khi cần.`;
  }

  async function refreshAiProviderStatus({ quiet = false } = {}) {
    if (state.ai.providerStatusLoading) return;
    state.ai.providerStatusLoading = true;
    if (root) renderInspector();
    try {
      const response = await fetch("/api/modules/image-text/actions", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal: eventController?.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `AI status HTTP ${response.status}`);
      state.ai.providerStatus = { providers: payload.providers || {}, configured: Boolean(payload.configured) };
    } catch (error) {
      if (error?.name === "AbortError") return;
      state.ai.providerStatus = null;
      if (!quiet) notify("Không đọc được trạng thái AI. Tool vẫn có thể tạo title dự phòng.", "info");
    } finally {
      state.ai.providerStatusLoading = false;
      if (root) renderInspector();
    }
  }

  function snapshotState() {
    return JSON.stringify({
      template: state.template,
      settings: state.settings,
      layerOrder: state.layerOrder,
      variants: state.variants,
      overrides: state.items.map((item) => [item.name, item.overrides, item.focusX, item.focusY, item.outputBaseName || "", item.youtubeTitle || ""])
    });
  }

  function restoreSnapshot(serialized) {
    try {
      const data = JSON.parse(serialized);
      state.template = data.template || clone(DEFAULT_TEMPLATE);
      state.settings = { ...initialSettings(), ...(data.settings || {}) };
      state.layerOrder = Array.isArray(data.layerOrder) ? data.layerOrder : ["title", "subtitle", "footer"];
      state.variants = Array.isArray(data.variants) ? data.variants : [];
      const overrideMap = new Map((data.overrides || []).map(([name, ...values]) => [name, values]));
      state.items.forEach((item) => {
        const row = overrideMap.get(item.name);
        if (!row) return;
        item.overrides = row[0] || {};
        item.focusX = row[1] ?? 0.5;
        item.focusY = row[2] ?? 0.5;
        item.outputBaseName = row[3] || "";
        item.youtubeTitle = row[4] || "";
      });
      renderAll({ keepPage: true });
    } catch {}
  }

  function pushHistory(serialized = snapshotState()) {
    if (state.history.at(-1) === serialized) return;
    state.history.push(serialized);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.future = [];
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return notify("Không còn thao tác để hoàn tác.");
    state.future.push(snapshotState());
    restoreSnapshot(previous);
    notify("Đã hoàn tác.", "success");
  }

  function redo() {
    const next = state.future.pop();
    if (!next) return notify("Không còn thao tác để làm lại.");
    state.history.push(snapshotState());
    restoreSnapshot(next);
    notify("Đã làm lại.", "success");
  }

  function ensureObjectUrl(item) {
    if (!item?.url) item.url = URL.createObjectURL(item.file);
    return item.url;
  }

  function pruneObjectUrls(visibleItems = []) {
    const keep = new Set(visibleItems.map((item) => item.id));
    if (state.activeId) keep.add(state.activeId);
    state.items.forEach((item) => {
      if (item.url && !keep.has(item.id)) {
        URL.revokeObjectURL(item.url);
        item.url = "";
      }
    });
  }

  function filteredItems() {
    const query = state.query.trim().toLocaleLowerCase();
    const items = query ? state.items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : [...state.items];
    items.sort((a, b) => naturalCompare(a.name, b.name) * (state.sort === "asc" ? 1 : -1));
    return items;
  }

  function pagedItems() {
    const filtered = filteredItems();
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = clamp(state.page, 0, pages - 1);
    return { filtered, pages, items: filtered.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize) };
  }

  function fontOptions(selected) {
    const groups = FONT_GROUPS.map(([label, fonts]) => `<optgroup label="${escapeHtml(label)}">${fonts.map((font) => `<option value="${escapeHtml(font)}"${font === selected ? " selected" : ""}>${escapeHtml(font)}</option>`).join("")}</optgroup>`);
    if (localFonts.length) groups.push(`<optgroup label="Font từ máy">${localFonts.map((font) => `<option value="${escapeHtml(font)}"${font === selected ? " selected" : ""}>${escapeHtml(font)}</option>`).join("")}</optgroup>`);
    return groups.join("");
  }

  function buildShell() {
    root = document.createElement("section");
    root.className = "its-app";
    root.innerHTML = `
      <header class="its-topbar">
        <div class="its-brand"><span>TX</span><div><strong>Text on Image Studio</strong><small>Batch thumbnail · xử lý cục bộ</small></div></div>
        <div class="its-project-stats"><b data-stat-images>0</b><span>ảnh</span><i></i><b data-stat-selected>0</b><span>đã chọn</span></div>
        <div class="its-top-actions">
          <button type="button" data-action="undo" title="Hoàn tác (Ctrl+Z)">↶</button>
          <button type="button" data-action="redo" title="Làm lại (Ctrl+Shift+Z)">↷</button>
          <button type="button" data-action="import-project">Nạp project</button>
          <button type="button" data-action="export-project">Lưu project</button>
          <button type="button" class="is-primary" data-action="add-folder">＋ Chọn thư mục ảnh</button>
          <input hidden type="file" accept="image/*" multiple data-file-input>
          <input hidden type="file" accept="image/*" multiple webkitdirectory directory data-folder-input>
          <input hidden type="file" accept=".ttf,.otf,.woff,.woff2" multiple data-font-input>
          <input hidden type="file" accept="application/json,.json" data-project-input>
        </div>
      </header>
      <div class="its-workspace">
        <nav class="its-toolrail" aria-label="Công cụ thiết kế thumbnail">
          ${[
            ["select", "↖", "Chọn"], ["text", "T", "Text"], ["image", "▧", "Ảnh"],
            ["shape", "◇", "Hình khối"], ["background", "◐", "Nền"], ["icon", "☆", "Icon"],
            ["effects", "✦", "Hiệu ứng"], ["template", "▦", "Template"], ["upload", "↑", "Upload"]
          ].map(([id, icon, label], index) => {
            const unavailable = id === "shape" || id === "icon";
            return `<button type="button" data-action="tool-panel" data-tool="${id}"${index === 0 ? ' class="is-active" aria-current="true"' : ""}${unavailable ? ' aria-disabled="true" title="Chưa cấu hình engine tài nguyên"' : ""}><b aria-hidden="true">${icon}</b><span>${label}${unavailable ? '<small>Chưa cấu hình</small>' : ""}</span></button>`;
          }).join("")}
        </nav>
        <aside class="its-library">
          <div class="its-panel-head"><div><strong>Kho ảnh</strong><small data-library-summary>Chưa có ảnh</small></div><button type="button" data-action="add-images">＋ Ảnh</button><button class="its-library-close" type="button" data-action="close-panels" aria-label="Đóng kho ảnh">×</button></div>
          <label class="its-dropzone" data-dropzone tabindex="0"><span>＋</span><strong>Thả ảnh hoặc thư mục vào đây</strong><small>JPG · PNG · WebP · AVIF · tối ưu cho 1.000+ ảnh</small></label>
          <div class="its-library-tools">
            <label><span>⌕</span><input type="search" placeholder="Tìm tên ảnh..." data-search></label>
            <button type="button" data-action="sort" title="Đổi thứ tự">A→Z</button>
          </div>
          <section class="its-selection-box" aria-label="Chọn nhanh số lượng ảnh">
            <div><strong data-selection-summary>Đã chọn 0 / 0</strong><button type="button" data-action="select-none">Bỏ chọn</button></div>
            <div class="its-selection-presets">
              ${[10, 25, 50, 100].map((count) => `<button type="button" data-action="select-count-preset" data-count="${count}">${count}</button>`).join("")}
              <button type="button" data-action="select-page">Trang này</button>
              <button type="button" data-action="select-all">Tất cả</button>
            </div>
            <div class="its-selection-custom"><label><span>Số ảnh</span><input type="number" min="1" step="1" value="50" data-select-count></label><button type="button" data-action="select-count">Chọn N ảnh đầu</button><button type="button" data-action="invert-selection">Đảo chọn</button></div>
          </section>
          <div class="its-thumb-grid" data-thumb-grid></div>
          <div class="its-library-empty" data-library-empty>
            <span>▧</span><strong>Chưa có ảnh</strong><small>Chọn cả thư mục; tool chỉ preview từng trang để không giật.</small>
          </div>
          <footer class="its-pager">
            <button type="button" data-action="prev-page">‹</button><span data-page-label>0 / 0</span><button type="button" data-action="next-page">›</button>
          </footer>
        </aside>
        <main class="its-stage">
          <div class="its-stagebar">
            <div class="its-preset-row" data-preset-row>
              ${Object.entries(PRESETS).map(([id, preset], index) => `<button type="button" data-action="preset" data-preset="${id}"${index === 0 ? ' class="is-active"' : ""}>${escapeHtml(preset.label)}</button>`).join("")}
            </div>
            <div class="its-view-controls" aria-label="Điều khiển canvas">
              <button type="button" data-action="zoom-out" aria-label="Thu nhỏ canvas">−</button>
              <button type="button" data-action="zoom-fit">Fit</button>
              <button type="button" data-action="zoom-100">100%</button>
              <button type="button" data-action="zoom-in" aria-label="Phóng to canvas">＋</button>
              <button type="button" data-action="toggle-grid" aria-pressed="${state.settings.grid}">Lưới</button>
              <label class="its-safe-toggle"><input type="checkbox" data-setting="safeZone"${state.settings.safeZone ? " checked" : ""}><span>Safe area</span></label>
            </div>
          </div>
          <div class="its-canvas-wrap" data-canvas-wrap>
            <div class="its-empty-stage" data-empty-stage><span>TX</span><strong>Thumbnail đẹp trong vài giây</strong><small>Chọn thư mục ảnh → nhập chữ → áp dụng toàn bộ → xuất.</small><button type="button" data-action="add-folder">Chọn thư mục ảnh</button></div>
            <canvas width="1280" height="720" data-preview-canvas aria-label="Preview thumbnail"></canvas>
            <div class="its-rendering" data-rendering hidden><i></i><span>Đang dựng preview…</span></div>
            <div class="its-canvas-status" aria-live="polite"><span data-zoom-label>Fit</span><i></i><span>${DESIGN_WIDTH} × ${DESIGN_HEIGHT}</span></div>
          </div>
          <div class="its-image-nav">
            <button type="button" data-action="prev-image">←</button>
            <div><strong data-active-name>Chưa chọn ảnh</strong><small data-active-meta>0 × 0</small></div>
            <button type="button" data-action="next-image">→</button>
          </div>
        </main>
        <aside class="its-inspector" data-inspector></aside>
      </div>
      <nav class="its-mobile-tools" aria-label="Công cụ thiết kế trên di động">
        <button type="button" data-action="tool-panel" data-tool="upload"><b>＋</b><span>Ảnh</span></button>
        <button type="button" data-action="tool-panel" data-tool="text"><b>T</b><span>Chữ</span></button>
        <button type="button" data-action="tool-panel" data-tool="effects"><b>✦</b><span>Hiệu ứng</span></button>
        <button type="button" data-action="tool-panel" data-tool="template"><b>▦</b><span>Mẫu</span></button>
        <button type="button" data-action="close-panels"><b>◎</b><span>Canvas</span></button>
      </nav>
      <footer class="its-exportbar">
        <div class="its-export-settings">
          <label><span>Kích thước</span><select data-setting="output">${Object.entries(OUTPUT_PRESETS).map(([key, preset]) => `<option value="${key}"${key === state.settings.output ? " selected" : ""}>${preset.label}</option>`).join("")}</select></label>
          <label><span>Định dạng</span><select data-setting="format"><option value="image/jpeg"${state.settings.format === "image/jpeg" ? " selected" : ""}>JPG</option><option value="image/png"${state.settings.format === "image/png" ? " selected" : ""}>PNG</option><option value="image/webp"${state.settings.format === "image/webp" ? " selected" : ""}>WebP</option></select></label>
          <label><span>Chất lượng</span><select data-setting="quality">${[0.72, 0.82, 0.9, 0.96].map((quality) => `<option value="${quality}"${Number(state.settings.quality) === quality ? " selected" : ""}>${Math.round(quality * 100)}%</option>`).join("")}</select></label>
          <label><span>Giới hạn</span><select data-setting="maxMB"><option value="1.9"${Number(state.settings.maxMB) === 1.9 ? " selected" : ""}>≤ 2 MB</option><option value="5"${Number(state.settings.maxMB) === 5 ? " selected" : ""}>≤ 5 MB</option><option value="48"${Number(state.settings.maxMB) === 48 ? " selected" : ""}>≤ 50 MB</option></select></label>
          <output class="its-size-estimate" data-export-estimate>Ước tính sau khi có ảnh</output>
        </div>
        <div class="its-export-progress" data-export-progress hidden><div><i data-progress-bar></i></div><span data-progress-label>0 / 0</span><button type="button" data-action="cancel-export">Hủy</button></div>
        <div class="its-export-actions">
          <button type="button" data-action="export-current">Tải ảnh đang xem</button>
          <div class="its-export-more"><button type="button" data-action="toggle-export-more" aria-expanded="false">Xuất nâng cao</button><div data-export-more-menu hidden><p>Ghi thẳng vào thư mục cần quyền của Chrome. ZIP không cần cấp quyền.</p><button type="button" data-action="export-folder">Ghi thẳng vào thư mục</button></div></div>
          <button type="button" class="is-primary" data-action="export-zip">Tải toàn bộ ZIP</button>
        </div>
      </footer>
      <div class="its-toast-tray" data-toast-tray></div>
      <button type="button" class="its-sheet-backdrop" data-action="close-panels" aria-label="Đóng bảng công cụ" hidden></button>
      <div class="its-dialog-backdrop" data-folder-dialog hidden><section role="dialog" aria-modal="true" aria-labelledby="its-folder-title"><span>▣</span><div><h3 id="its-folder-title">Cho phép ghi vào thư mục?</h3><p>Đây là chế độ nâng cao. Sau khi tiếp tục, Chrome bắt buộc hiện hộp thoại quyền của trình duyệt. Bạn có thể dùng <b>Tải toàn bộ ZIP</b> để không thấy hộp thoại đó.</p><footer><button type="button" data-action="folder-dialog-close">Dùng ZIP</button><button type="button" class="is-primary" data-action="export-folder-confirm">Tiếp tục chọn thư mục</button></footer></div></section></div>`;
    host.replaceChildren(root);
    previewCanvas = root.querySelector("[data-preview-canvas]");
    previewContext = previewCanvas.getContext("2d", { alpha: false, desynchronized: true });
    const zipButton = root.querySelector('[data-action="export-zip"]');
    const folderButton = root.querySelector('[data-action="export-folder"]');
    if (zipButton) { zipButton.textContent = "Tải toàn bộ ZIP"; zipButton.classList.add("is-primary"); }
    if (folderButton) { folderButton.textContent = "Ghi thư mục (nâng cao)"; folderButton.classList.remove("is-primary"); folderButton.title = "Chrome sẽ yêu cầu quyền ghi file bằng hộp thoại hệ thống"; }
    root.dataset.activeTool = state.settings.activeTool || "select";
    applyZoom();
  }

  const LAYER_LABELS = Object.freeze({ title: "Tiêu đề", subtitle: "Phụ đề", footer: "Chân ảnh" });

  function activeLayerOrder() {
    const valid = state.layerOrder.filter((slot) => Object.prototype.hasOwnProperty.call(LAYER_LABELS, slot));
    return valid.length === 3 ? valid : ["title", "subtitle", "footer"];
  }

  function analysisFor(item) {
    if (!item) return { score: 0, tone: "empty", messages: ["Thêm ảnh để bắt đầu phân tích cục bộ."] };
    const messages = [];
    let penalty = 0;
    activeLayerOrder().forEach((slot) => {
      const layer = layerFor(item, slot);
      const text = resolveText(layer.text, item).trim();
      if (!text || layer.visible === false) return;
      const words = text.split(/\s+/).filter(Boolean).length;
      if (slot === "title" && words > 8) { penalty += 18; messages.push("Tiêu đề có nhiều hơn 8 từ; nên rút gọn để đọc rõ ở kích thước nhỏ."); }
      if (layer.x < 0.07 || layer.x > 0.93 || layer.y < 0.08 || layer.y > 0.92) { penalty += 16; messages.push(`${LAYER_LABELS[slot]} đang quá sát mép thumbnail.`); }
      if (Number(layer.size) < 2 && slot !== "footer") { penalty += 12; messages.push(`${LAYER_LABELS[slot]} có thể quá nhỏ trên danh sách video.`); }
      if (!layer.autoContrast && String(layer.color).toLowerCase() === String(layer.stroke).toLowerCase()) { penalty += 20; messages.push(`${LAYER_LABELS[slot]} có màu chữ và viền giống nhau, độ tách nền thấp.`); }
    });
    if (!messages.length) messages.push("Bố cục nằm trong safe area và lượng chữ phù hợp cho thumbnail.");
    const score = clamp(100 - penalty, 0, 100);
    return { score, tone: score >= 82 ? "good" : score >= 62 ? "warn" : "bad", messages: [...new Set(messages)].slice(0, 4) };
  }

  function analysisMarkup(item) {
    const analysis = analysisFor(item);
    return `<section class="its-analysis is-${analysis.tone}" data-analysis-panel><header><div><b>Kiểm tra khả năng đọc</b><small>Phân tích cục bộ · không gửi ảnh</small></div><strong>${analysis.score || "—"}<i>${analysis.score ? "/100" : ""}</i></strong></header><ul>${analysis.messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul><div class="its-mini-preview"><canvas width="320" height="180" data-mini-preview aria-label="Preview thumbnail ở kích thước nhỏ"></canvas><span>Mô phỏng danh sách YouTube</span></div></section>`;
  }

  function layerListMarkup(item) {
    return `<section class="its-layer-panel"><header><b>Layers</b><span>${activeLayerOrder().length} lớp chữ</span></header><div>${[...activeLayerOrder()].reverse().map((slot) => {
      const layer = layerFor(item, slot);
      const active = slot === state.activeSlot;
      return `<article class="${active ? "is-active" : ""}"><button type="button" data-action="slot" data-slot="${slot}"><i>${slot === "title" ? "T" : slot === "subtitle" ? "S" : "F"}</i><span><strong>${LAYER_LABELS[slot]}</strong><small>${escapeHtml(resolveText(layer.text, item) || "Trống")}</small></span></button><button type="button" data-action="layer-visible" data-slot="${slot}" aria-label="${layer.visible === false ? "Hiện" : "Ẩn"} ${LAYER_LABELS[slot]}" aria-pressed="${layer.visible !== false}">${layer.visible === false ? "○" : "◉"}</button><button type="button" data-action="layer-lock" data-slot="${slot}" aria-label="${layer.locked ? "Mở khóa" : "Khóa"} ${LAYER_LABELS[slot]}" aria-pressed="${Boolean(layer.locked)}">${layer.locked ? "▣" : "□"}</button></article>`;
    }).join("")}</div><footer><button type="button" data-action="layer-down">↓ Xuống</button><button type="button" data-action="layer-up">↑ Lên</button><button type="button" data-action="duplicate-layer">⧉ Nhân bản</button></footer></section>`;
  }

  function variantsMarkup() {
    const hasVariants = state.variants.length > 0;
    return `<section class="its-variants"><header><div><b>Biến thể A/B/C</b><small>Không ghi đè thiết kế gốc</small></div><button type="button" data-action="create-variants">${hasVariants ? "Tạo lại" : "Tạo 3 bản"}</button></header>${hasVariants ? `<div>${state.variants.map((variant) => `<button type="button" data-action="select-variant" data-variant="${variant.id}" class="${state.activeVariant === variant.id ? "is-active" : ""}"><b>${variant.id}</b><span>${escapeHtml(variant.label)}</span></button>`).join("")}</div><button type="button" data-action="select-variant" data-variant="original" class="its-original-variant${state.activeVariant === "original" ? " is-active" : ""}">Khôi phục bản gốc</button>` : '<p>Tạo ba phương án vị trí và màu chữ để so sánh nhanh.</p>'}</section>`;
  }

  function renderInspector() {
    const inspector = root?.querySelector("[data-inspector]");
    if (!inspector) return;
    const item = activeItem();
    const layer = layerFor(item, state.activeSlot);
    const imageStyle = imageStyleFor(item);
    const settings = state.settings;
    inspector.innerHTML = `
      <div class="its-panel-head its-inspector-head"><div><strong>Chỉnh chữ nhanh</strong><small>${settings.editMode === "all" ? "Đang áp dụng cho toàn bộ ảnh" : "Chỉ ảnh đang xem"}</small></div><button type="button" data-action="add-font">＋ Font</button><button class="its-sheet-close" type="button" data-action="close-panels" aria-label="Đóng bảng chỉnh chữ">×</button></div>
      <div class="its-mode-switch" role="group" aria-label="Phạm vi chỉnh sửa">
        <button type="button" data-action="edit-mode" data-mode="all"${settings.editMode === "all" ? ' class="is-active"' : ""}>Toàn bộ ảnh</button>
        <button type="button" data-action="edit-mode" data-mode="current"${settings.editMode === "current" ? ' class="is-active"' : ""}${item ? "" : " disabled"}>Ảnh này</button>
      </div>
      <p class="its-scope-hint">${settings.editMode === "all" ? "Mọi chỉnh sửa bên dưới áp dụng cho tất cả ảnh. Nội dung riêng khác vẫn được giữ." : "Chỉnh riêng ảnh này; các ảnh khác không thay đổi."}</p>
      <div class="its-slot-tabs" role="tablist">
        ${[["title", "Tiêu đề"], ["subtitle", "Phụ đề"], ["footer", "Chân ảnh"]].map(([id, label]) => `<button type="button" role="tab" data-action="slot" data-slot="${id}"${state.activeSlot === id ? ' class="is-active" aria-selected="true"' : ""}>${label}</button>`).join("")}
      </div>
      <label class="its-field its-text-field"><span>Nội dung <small>{filename} · {index} · {date}</small></span><textarea rows="3" data-layer-prop="text" placeholder="Nhập chữ trên ảnh…">${escapeHtml(layer.text)}</textarea></label>
      <div class="its-field-grid">
        <label class="its-field its-font-field"><span>Font quốc tế</span><select data-layer-prop="font">${fontOptions(layer.font)}</select></label>
        <label class="its-field its-weight-field"><span>Độ đậm</span><select data-layer-prop="weight"><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option></select></label>
      </div>
      <label class="its-range"><span>Cỡ chữ <b data-value-for="size">${layer.size.toFixed(1)}%</b></span><input type="range" min="0.6" max="12" step="0.1" value="${layer.size}" data-layer-prop="size"></label>
      <section class="its-color-panel" aria-label="Màu và kiểu chữ">
        <header><strong>Màu chữ</strong><select aria-label="Chế độ màu chữ" data-layer-prop="colorMode"><option value="solid">Màu cố định</option><option value="auto">Tự tương phản</option><option value="gradient">Gradient 2 màu</option></select></header>
        <div class="its-color-fields">
          <label class="its-color-picker"><span>Màu chữ</span><input aria-label="Chọn màu chữ" type="color" value="${layer.color}" data-layer-prop="color"></label>
          <label class="its-color-hex"><span>Mã HEX</span><input aria-label="Mã HEX màu chữ" type="text" value="${layer.color}" data-layer-prop="color" pattern="#[0-9a-fA-F]{6}" maxlength="7" placeholder="#ffffff" spellcheck="false"></label>
          <label class="its-color-picker"><span>Màu viền</span><input aria-label="Chọn màu viền chữ" type="color" value="${layer.stroke}" data-layer-prop="stroke"></label>
        </div>
        <div class="its-color-swatches" role="group" aria-label="Bảng màu chữ nhanh">${["#ffffff", "#111716", "#ff5378", "#ffd36a", "#65e9ef", "#a994ff", "#69edb5", "#ff984a"].map((hex) => `<button type="button" data-action="color-swatch" data-color-swatch="${hex}" aria-label="Màu chữ ${hex}" aria-pressed="false" style="--its-swatch:${hex}"></button>`).join("")}</div>
        <p class="its-color-hint" data-color-mode-hint aria-live="polite"></p>
        <div class="its-gradient-row" data-color-gradient hidden><label><input aria-label="Màu gradient đầu" type="color" value="${layer.gradientStart}" data-layer-prop="gradientStart"><span>Màu đầu</span></label><label><input aria-label="Màu gradient cuối" type="color" value="${layer.gradientEnd}" data-layer-prop="gradientEnd"><span>Màu cuối</span></label></div>
      </section>
      <div class="its-quick-style its-text-toggles">
        <button type="button" data-action="toggle-layer" data-prop="italic" aria-pressed="${!!layer.italic}" class="${layer.italic ? "is-active" : ""}"><i>I</i> Nghiêng</button>
        <button type="button" data-action="toggle-layer" data-prop="uppercase" aria-pressed="${!!layer.uppercase}" class="${layer.uppercase ? "is-active" : ""}">AA Viết hoa</button>
      </div>
      <details class="its-layers-disclosure"><summary>Sắp xếp & khóa lớp chữ <small>3 lớp</small></summary>${layerListMarkup(item)}</details>
      <div class="its-position-grid" aria-label="Vị trí chữ">
        ${[[0.12, 0.16, "↖"], [0.5, 0.16, "↑"], [0.88, 0.16, "↗"], [0.12, 0.5, "←"], [0.5, 0.5, "•"], [0.88, 0.5, "→"], [0.12, 0.84, "↙"], [0.5, 0.84, "↓"], [0.88, 0.84, "↘"]].map(([x, y, icon]) => `<button type="button" data-action="position" data-x="${x}" data-y="${y}">${icon}</button>`).join("")}
      </div>
      <details class="its-advanced">
        <summary>Chỉnh nâng cao</summary>
        <div class="its-advanced-body">
          <div class="its-image-color"><div><b>Màu & ánh sáng ảnh</b><label><input type="checkbox" data-image-prop="enabled"${imageStyle.enabled ? " checked" : ""}> Bật chỉnh ảnh</label></div>
            <p class="its-engine-status"><i></i><span><b>Tách nền</b><small>Chưa cấu hình · ảnh không rời thiết bị</small></span></p>
            <div class="its-field-grid"><label class="its-field"><span>Khung ảnh</span><select data-image-prop="fit"><option value="cover"${imageStyle.fit === "cover" ? " selected" : ""}>Cover</option><option value="contain"${imageStyle.fit === "contain" ? " selected" : ""}>Contain</option></select></label><label class="its-field"><span>Phóng ảnh</span><input type="number" min="0.5" max="3" step="0.05" value="${imageStyle.scale}" data-image-prop="scale"></label></div>
            <label class="its-range"><span>Độ sáng <b>${Math.round(imageStyle.brightness * 100)}%</b></span><input type="range" min="0.5" max="1.5" step="0.01" value="${imageStyle.brightness}" data-image-prop="brightness"></label>
            <label class="its-range"><span>Tương phản <b>${Math.round(imageStyle.contrast * 100)}%</b></span><input type="range" min="0.5" max="1.6" step="0.01" value="${imageStyle.contrast}" data-image-prop="contrast"></label>
            <label class="its-range"><span>Bão hòa <b>${Math.round(imageStyle.saturation * 100)}%</b></span><input type="range" min="0" max="1.8" step="0.01" value="${imageStyle.saturation}" data-image-prop="saturation"></label>
            <label class="its-range"><span>Nhiệt độ màu <b>${Math.round(imageStyle.temperature)}</b></span><input type="range" min="-100" max="100" step="1" value="${imageStyle.temperature}" data-image-prop="temperature"></label>
            <label class="its-range"><span>Làm mờ <b>${Number(imageStyle.blur).toFixed(1)}px</b></span><input type="range" min="0" max="16" step="0.5" value="${imageStyle.blur}" data-image-prop="blur"></label>
            <label class="its-range"><span>Vignette <b>${Math.round(imageStyle.vignette * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value="${imageStyle.vignette}" data-image-prop="vignette"></label>
            <div class="its-checks"><label><input type="checkbox" data-image-prop="flipX"${imageStyle.flipX ? " checked" : ""}>Lật ngang</label><label><input type="checkbox" data-image-prop="flipY"${imageStyle.flipY ? " checked" : ""}>Lật dọc</label></div>
            <div class="its-tint-row"><label><input type="color" value="${imageStyle.tint}" data-image-prop="tint"> Màu phủ</label><label class="its-range"><span>Cường độ <b>${Math.round(imageStyle.tintOpacity * 100)}%</b></span><input type="range" min="0" max="0.65" step="0.01" value="${imageStyle.tintOpacity}" data-image-prop="tintOpacity"></label></div>
          </div>
          <label class="its-range"><span>Độ rộng dòng <b data-value-for="maxWidth">${Math.round(layer.maxWidth * 100)}%</b></span><input type="range" min="0.2" max="0.94" step="0.01" value="${layer.maxWidth}" data-layer-prop="maxWidth"></label>
          <label class="its-range"><span>Giãn dòng <b data-value-for="lineHeight">${Number(layer.lineHeight).toFixed(2)}</b></span><input type="range" min="0.85" max="1.8" step="0.01" value="${layer.lineHeight}" data-layer-prop="lineHeight"></label>
          <label class="its-range"><span>Giãn chữ <b data-value-for="letterSpacing">${Number(layer.letterSpacing).toFixed(1)}%</b></span><input type="range" min="-0.08" max="0.3" step="0.01" value="${layer.letterSpacing}" data-layer-prop="letterSpacing"></label>
          <label class="its-range"><span>Xoay chữ <b data-value-for="rotation">${Math.round(layer.rotation)}°</b></span><input type="range" min="-30" max="30" step="1" value="${layer.rotation}" data-layer-prop="rotation"></label>
          <label class="its-range"><span>Độ dày viền <b data-value-for="strokeWidth">${layer.strokeWidth.toFixed(2)}%</b></span><input type="range" min="0" max="0.5" step="0.01" value="${layer.strokeWidth}" data-layer-prop="strokeWidth"></label>
          <label class="its-range"><span>Bóng chữ <b data-value-for="shadow">${Math.round(layer.shadow * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value="${layer.shadow}" data-layer-prop="shadow"></label>
          <label class="its-range"><span>Hào quang <b data-value-for="glow">${Math.round(layer.glow * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value="${layer.glow}" data-layer-prop="glow"></label>
          <label class="its-range"><span>Độ trong <b data-value-for="opacity">${Math.round(layer.opacity * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.01" value="${layer.opacity}" data-layer-prop="opacity"></label>
          <div class="its-checks"><label><input type="checkbox" data-layer-prop="background"${layer.background ? " checked" : ""}>Nền mờ sau chữ</label></div>
          <label class="its-range"><span>Lớp tối toàn ảnh <b data-value-setting="overlay">${Math.round(settings.overlay * 100)}%</b></span><input type="range" min="0" max="0.6" step="0.01" value="${settings.overlay}" data-setting="overlay"></label>
          <label class="its-field"><span>Hậu tố tên file</span><input type="text" value="${escapeHtml(settings.suffix)}" data-setting="suffix"></label>
        </div>
      </details>
      <div class="its-inspector-actions">
        ${settings.editMode === "current" ? '<button type="button" data-action="copy-current-to-all">Áp dụng kiểu này cho tất cả</button><button type="button" data-action="reset-current">Bỏ chỉnh riêng</button>' : '<button type="button" data-action="filename-title">Lấy tên file làm tiêu đề</button>'}
      </div>
      <details class="its-ai-disclosure"><summary>✦ Trợ lý AI <small>Title YouTube & chữ từng ảnh</small></summary><section class="its-ai-panel">
        <div class="its-ai-head"><div><b>✦ YouTube Trend Title AI</b><small>Title video + chữ thumbnail riêng từng ảnh</small></div><span>${state.ai.running ? `${state.ai.done}/${state.ai.total}` : (state.ai.trendLabel || "Theo provider")}</span></div>
        <label class="its-trend-topic"><span>Chủ đề / từ khóa kênh</span><input type="text" data-setting="youtubeTopic" value="${escapeHtml(settings.youtubeTopic)}" placeholder="soft piano, slow living…"></label>
        <div class="its-trend-controls">
          <label><span>Xu hướng</span><select data-setting="trendPeriod"><option value="week">7 ngày gần đây</option><option value="month">30 ngày gần đây</option></select></label>
          <label><span>Thị trường</span><select data-setting="trendRegion"><option value="US">Quốc tế · US</option><option value="VN">Việt Nam</option><option value="GB">Anh</option><option value="JP">Nhật Bản</option><option value="KR">Hàn Quốc</option></select></label>
          <label><span>Ngôn ngữ title</span><select data-setting="titleLanguage"><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="ja">日本語</option><option value="ko">한국어</option></select></label>
        </div>
        <textarea rows="2" data-setting="aiPrompt" placeholder="Ví dụ: chữ tiếng Anh 2–4 từ, phong cách đồng quê…">${escapeHtml(settings.aiPrompt)}</textarea>
        <div class="its-ai-row">
          <select data-setting="aiProvider"><option value="auto">AI tự chọn</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select>
          <select data-setting="aiScope"><option value="current">Ảnh này</option><option value="selected">Ảnh đã chọn</option><option value="page">Trang hiện tại</option><option value="all">Toàn bộ ảnh</option></select>
          <button type="button" class="is-primary" data-action="ai-generate" ${state.ai.running ? "disabled" : ""}>${state.ai.running ? "Đang tạo…" : "✦ Tạo title + chữ"}</button>
        </div>
        <div class="its-ai-options"><label><input type="checkbox" data-setting="aiSubtitle"${settings.aiSubtitle ? " checked" : ""}> Phụ đề</label><label><input type="checkbox" data-setting="structuredNames"${settings.structuredNames ? " checked" : ""}> Tên file 3 phần</label><label><input type="checkbox" data-setting="aiColor"${settings.aiColor ? " checked" : ""}> Màu chữ AI</label>${state.ai.running ? '<button type="button" data-action="ai-cancel">Dừng</button>' : ""}</div>
        <div class="its-ai-status"><small>${escapeHtml(aiProviderSummary())}</small><button type="button" data-action="ai-refresh-status"${state.ai.providerStatusLoading ? " disabled" : ""}>Kiểm tra</button></div>
        <label class="its-youtube-title-field"><span>Title YouTube · ảnh đang xem</span><textarea rows="2" data-item-prop="youtubeTitle" placeholder="AI sẽ tạo title video tại đây…"${item ? "" : " disabled"}>${escapeHtml(item?.youtubeTitle || "")}</textarea></label>
        ${item ? `<code class="its-output-name-preview" title="Tên file khi xuất ZIP">${escapeHtml(outputName(item))}</code>` : ""}
      </section></details>
      ${analysisMarkup(item)}
      ${variantsMarkup()}
      <div class="its-shortcuts"><span>← → đổi ảnh</span><span>Kéo chữ trực tiếp</span><span>Ctrl+Z hoàn tác</span></div>`;
    const weight = inspector.querySelector('[data-layer-prop="weight"]');
    if (weight) weight.value = String(layer.weight);
    const aiProvider = inspector.querySelector('[data-setting="aiProvider"]');
    const aiScope = inspector.querySelector('[data-setting="aiScope"]');
    const trendPeriod = inspector.querySelector('[data-setting="trendPeriod"]');
    const trendRegion = inspector.querySelector('[data-setting="trendRegion"]');
    const titleLanguage = inspector.querySelector('[data-setting="titleLanguage"]');
    if (aiProvider) aiProvider.value = settings.aiProvider;
    if (aiScope) aiScope.value = settings.aiScope;
    if (trendPeriod) trendPeriod.value = settings.trendPeriod;
    if (trendRegion) trendRegion.value = settings.trendRegion;
    if (titleLanguage) titleLanguage.value = settings.titleLanguage;
    syncColorControls();
  }

  function renderLibrary() {
    if (!root) return;
    root.classList.toggle("has-images", state.items.length > 0);
    const { filtered, pages, items } = pagedItems();
    const grid = root.querySelector("[data-thumb-grid]");
    const empty = root.querySelector("[data-library-empty]");
    pruneObjectUrls(items);
    if (grid) {
      grid.innerHTML = items.map((item) => {
        const url = ensureObjectUrl(item);
        return `<article class="its-thumb${item.id === state.activeId ? " is-active" : ""}${item.overrides?.title?.text ? " has-custom-text" : ""}" data-image-id="${item.id}" title="${escapeHtml(item.name)}">
          <img src="${url}" alt="" loading="lazy" decoding="async">
          <label><input type="checkbox" data-select-id="${item.id}"${state.selectedIds.has(item.id) ? " checked" : ""}><span></span></label>
          <div><strong>${escapeHtml(item.name.replace(/\.[^.]+$/, ""))}</strong><small>${escapeHtml(item.youtubeTitle || (item.width ? `${item.width}×${item.height}` : "Đang đọc…"))}</small></div>
        </article>`;
      }).join("");
    }
    if (empty) empty.hidden = state.items.length > 0;
    root.querySelector("[data-page-label]").textContent = state.items.length ? `${state.page + 1} / ${pages}` : "0 / 0";
    root.querySelector("[data-library-summary]").textContent = state.items.length ? `${filtered.length.toLocaleString("vi-VN")} / ${state.items.length.toLocaleString("vi-VN")} ảnh` : "Chưa có ảnh";
    root.querySelector("[data-stat-images]").textContent = state.items.length.toLocaleString("vi-VN");
    root.querySelector("[data-stat-selected]").textContent = state.selectedIds.size.toLocaleString("vi-VN");
    const selectionSummary = root.querySelector("[data-selection-summary]");
    const countInput = root.querySelector("[data-select-count]");
    if (selectionSummary) selectionSummary.textContent = `Đã chọn ${state.selectedIds.size.toLocaleString("vi-VN")} / ${state.items.length.toLocaleString("vi-VN")}`;
    if (countInput) countInput.max = String(Math.max(1, state.items.length));
    const sortButton = root.querySelector('[data-action="sort"]');
    if (sortButton) sortButton.textContent = state.sort === "asc" ? "A→Z" : "Z→A";
  }

  function updateStageMeta() {
    const item = activeItem();
    root.querySelector("[data-active-name]").textContent = item?.name || "Chưa chọn ảnh";
    root.querySelector("[data-active-meta]").textContent = item ? `${item.width || "…"} × ${item.height || "…"} · ${(item.size / 1048576).toFixed(1)} MB` : "0 × 0";
    root.querySelector("[data-empty-stage]").hidden = Boolean(item);
    previewCanvas.hidden = !item;
  }

  function renderAll({ keepPage = false } = {}) {
    if (!keepPage) state.page = 0;
    renderLibrary();
    renderInspector();
    updateStageMeta();
    schedulePreview();
    persistSettings();
  }

  async function loadImage(item) {
    if (!item) throw new Error("Chưa chọn ảnh");
    if (imageCache.has(item.id)) {
      const cached = imageCache.get(item.id);
      imageCache.delete(item.id);
      imageCache.set(item.id, cached);
      return cached.promise;
    }
    if (!item.renderUrl) item.renderUrl = URL.createObjectURL(item.file);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        item.width = image.naturalWidth;
        item.height = image.naturalHeight;
        resolve(image);
      };
      image.onerror = () => reject(new Error(`Không đọc được ${item.name}`));
      image.src = item.renderUrl;
    });
    imageCache.set(item.id, { promise, item });
    if (imageCache.size > 12) {
      const oldest = imageCache.keys().next().value;
      if (oldest !== item.id) {
        const stale = imageCache.get(oldest);
        imageCache.delete(oldest);
        Promise.resolve(stale?.promise).then((image) => { if (image) image.src = ""; }).catch(() => {});
        if (stale?.item?.renderUrl) URL.revokeObjectURL(stale.item.renderUrl);
        if (stale?.item) stale.item.renderUrl = "";
      }
    }
    return promise;
  }

  function resolveText(text, item) {
    const index = itemIndex(item) + 1;
    return String(text || "")
      .replaceAll("{filename}", item?.name?.replace(/\.[^.]+$/, "") || "")
      .replaceAll("{name}", item?.name?.replace(/\.[^.]+$/, "") || "")
      .replaceAll("{index}", String(index).padStart(2, "0"))
      .replaceAll("{total}", String(state.items.length))
      .replaceAll("{date}", String(new Date().getFullYear()));
  }

  function drawCover(ctx, image, width, height, focusX = 0.5, focusY = 0.5) {
    const imageWidth = Number(image.naturalWidth || image.width);
    const imageHeight = Number(image.naturalHeight || image.height);
    if (!imageWidth || !imageHeight) throw new Error("Ảnh chưa giải mã xong");
    const scale = Math.max(width / imageWidth, height / imageHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sx = clamp((imageWidth - sourceWidth) * focusX, 0, Math.max(0, imageWidth - sourceWidth));
    const sy = clamp((imageHeight - sourceHeight) * focusY, 0, Math.max(0, imageHeight - sourceHeight));
    ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, width, height);
  }

  function drawImageLayer(ctx, image, width, height, item, style) {
    const imageWidth = Number(image.naturalWidth || image.width);
    const imageHeight = Number(image.naturalHeight || image.height);
    if (!imageWidth || !imageHeight) throw new Error("Ảnh chưa giải mã xong");
    const fit = style.fit === "contain" ? "contain" : "cover";
    const baseScale = fit === "contain" ? Math.min(width / imageWidth, height / imageHeight) : Math.max(width / imageWidth, height / imageHeight);
    const scale = baseScale * clamp(style.scale, 0.5, 3);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const focusX = clamp(item.focusX, 0, 1);
    const focusY = clamp(item.focusY, 0, 1);
    const offsetX = (width - drawWidth) * focusX;
    const offsetY = (height - drawHeight) * focusY;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(clamp(style.rotation, -180, 180) * Math.PI / 180);
    ctx.scale(style.flipX ? -1 : 1, style.flipY ? -1 : 1);
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();
  }

  function sampleBrightness(ctx, x, y, width, height) {
    try {
      const radius = Math.max(4, Math.round(Math.min(width, height) * 0.018));
      const data = ctx.getImageData(clamp(x - radius, 0, width - 1), clamp(y - radius, 0, height - 1), Math.min(radius * 2, width), Math.min(radius * 2, height)).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 16) total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      return total / Math.max(1, data.length / 16);
    } catch {
      return 80;
    }
  }

  function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text).split(/\r?\n/);
    const lines = [];
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) return lines.push("");
      let line = words.shift();
      words.forEach((word) => {
        const test = `${line} ${word}`;
        if (ctx.measureText(test).width <= maxWidth) line = test;
        else {
          lines.push(line);
          line = word;
        }
      });
      lines.push(line);
    });
    return lines.slice(0, 6);
  }

  function drawTextLayer(ctx, width, height, item, slot, layer, collectHit = false) {
    let text = resolveText(layer.text, item);
    if (!text || layer.visible === false) {
      if (collectHit) hitBoxes.delete(slot);
      return;
    }
    if (layer.uppercase) text = text.toLocaleUpperCase();
    const size = Math.max(8, width * (Number(layer.size) / 100));
    const family = String(layer.font || "Inter").replace(/["']/g, "");
    ctx.save();
    ctx.globalAlpha = clamp(layer.opacity, 0.05, 1);
    ctx.font = `${layer.italic ? "italic " : ""}${Number(layer.weight) || 600} ${size}px "${family}", sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${size * clamp(layer.letterSpacing, -0.08, 0.3)}px`;
    ctx.textAlign = layer.align || "center";
    ctx.textBaseline = "middle";
    const maxWidth = width * clamp(layer.maxWidth, 0.16, 0.98);
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = size * clamp(layer.lineHeight, 0.85, 1.8);
    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    const x = width * clamp(layer.x, 0.02, 0.98);
    const y = height * clamp(layer.y, 0.04, 0.96);
    const widest = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line || " ").width)));
    const brightness = layer.autoContrast ? sampleBrightness(ctx, x, y, width, height) : 0;
    const fill = layer.autoContrast ? (brightness > 172 ? "#111716" : "#ffffff") : layer.color;
    const stroke = layer.autoContrast ? (brightness > 172 ? "rgba(255,255,255,.78)" : "rgba(8,14,18,.82)") : layer.stroke;
    const boxLeft = layer.align === "left" ? x : layer.align === "right" ? x - widest : x - widest / 2;
    const localLeft = layer.align === "left" ? 0 : layer.align === "right" ? -widest : -widest / 2;
    ctx.translate(x, y);
    ctx.rotate(clamp(layer.rotation, -30, 30) * Math.PI / 180);
    if (layer.background) {
      const padX = size * 0.45;
      const padY = size * 0.24;
      ctx.fillStyle = brightness > 172 ? "rgba(255,255,255,.62)" : "rgba(4,9,13,.5)";
      ctx.beginPath();
      ctx.roundRect(localLeft - padX, -totalHeight / 2 - padY, widest + padX * 2, totalHeight + padY * 2, size * 0.18);
      ctx.fill();
    }
    ctx.shadowColor = Number(layer.glow) > 0 ? (layer.gradientEnd || layer.color || "#ffffff") : `rgba(0,0,0,${clamp(layer.shadow, 0, 1) * 0.72})`;
    ctx.shadowBlur = size * Math.max(clamp(layer.shadow, 0, 1) * 0.28, clamp(layer.glow, 0, 1) * 0.48);
    ctx.shadowOffsetY = size * clamp(layer.shadow, 0, 1) * 0.08;
    if (layer.gradient && !layer.autoContrast) {
      const gradient = ctx.createLinearGradient(localLeft, 0, localLeft + widest, 0);
      gradient.addColorStop(0, layer.gradientStart || layer.color || "#ffffff");
      gradient.addColorStop(1, layer.gradientEnd || layer.color || "#7de9ff");
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.lineWidth = width * clamp(layer.strokeWidth, 0, 1) / 100;
    lines.forEach((line, index) => {
      const lineY = -totalHeight / 2 + lineHeight * (index + 0.5);
      if (ctx.lineWidth > 0) ctx.strokeText(line, 0, lineY, maxWidth);
      ctx.fillText(line, 0, lineY, maxWidth);
    });
    if (collectHit) {
      const angle = clamp(layer.rotation, -30, 30) * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const boxWidth = widest + size * 0.8;
      const boxHeight = totalHeight + size * 0.6;
      const localCenterX = localLeft + widest / 2;
      const centerX = x + localCenterX * cos;
      const centerY = y + localCenterX * sin;
      const halfWidth = Math.abs(cos) * boxWidth / 2 + Math.abs(sin) * boxHeight / 2;
      const halfHeight = Math.abs(sin) * boxWidth / 2 + Math.abs(cos) * boxHeight / 2;
      hitBoxes.set(slot, { left: centerX - halfWidth, top: centerY - halfHeight, right: centerX + halfWidth, bottom: centerY + halfHeight });
    }
    ctx.restore();
  }

  async function ensureFont(family, weight = 600) {
    if (!family || loadedFontFamilies.has(family) || localFonts.includes(family)) return;
    const encoded = encodeURIComponent(family).replaceAll("%20", "+");
    const id = `hh-image-font-${family.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
      const ready = new Promise((resolve) => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 5000);
      });
      document.head.appendChild(link);
      await ready;
    }
    try {
      await document.fonts.load(`400 32px "${family}"`);
      await document.fonts.load(`${weight} 32px "${family}"`);
    } catch {}
    loadedFontFamilies.add(family);
  }

  async function drawComposite(ctx, width, height, item, { preview = false } = {}) {
    const image = await loadImage(item);
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#071019";
    ctx.fillRect(0, 0, width, height);
    const imageStyle = imageStyleFor(item);
    if (imageStyle.enabled) {
      const warmth = clamp(imageStyle.temperature, -100, 100);
      const sepia = Math.max(0, warmth) * 0.0018;
      const hue = warmth * -0.06;
      ctx.filter = `brightness(${clamp(imageStyle.brightness, 0.5, 1.5)}) contrast(${clamp(imageStyle.contrast, 0.5, 1.6)}) saturate(${clamp(imageStyle.saturation, 0, 1.8)}) sepia(${sepia}) hue-rotate(${hue}deg) blur(${clamp(imageStyle.blur, 0, 16)}px)`;
    }
    drawImageLayer(ctx, image, width, height, item, imageStyle);
    ctx.filter = "none";
    if (imageStyle.enabled && imageStyle.tintOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(imageStyle.tintOpacity, 0, 0.65);
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = imageStyle.tint;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (imageStyle.enabled && imageStyle.vignette > 0) {
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.72);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, `rgba(0,0,0,${clamp(imageStyle.vignette, 0, 1) * 0.78})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }
    if (state.settings.overlay > 0) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgba(3,8,12,${state.settings.overlay * 0.35})`);
      gradient.addColorStop(0.5, `rgba(3,8,12,${state.settings.overlay * 0.12})`);
      gradient.addColorStop(1, `rgba(3,8,12,${state.settings.overlay * 0.72})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    const layers = activeLayerOrder().map((slot) => [slot, layerFor(item, slot)]);
    await Promise.all(layers.map(([, layer]) => ensureFont(layer.font, layer.weight)));
    try { await document.fonts?.ready; } catch {}
    for (const [slot, layer] of layers) {
      drawTextLayer(ctx, width, height, item, slot, layer, preview);
    }
    if (preview && (state.settings.safeZone || state.settings.grid || state.settings.guides)) {
      ctx.save();
      ctx.lineWidth = Math.max(1, width * 0.0012);
      if (state.settings.grid) {
        ctx.strokeStyle = "rgba(255,255,255,.18)";
        ctx.setLineDash([]);
        for (let column = 1; column < 12; column += 1) { ctx.beginPath(); ctx.moveTo(width * column / 12, 0); ctx.lineTo(width * column / 12, height); ctx.stroke(); }
        for (let row = 1; row < 8; row += 1) { ctx.beginPath(); ctx.moveTo(0, height * row / 8); ctx.lineTo(width, height * row / 8); ctx.stroke(); }
      }
      if (state.settings.guides) {
        ctx.strokeStyle = "rgba(255,211,106,.38)";
        ctx.setLineDash([width * 0.004, width * 0.006]);
        ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      }
      if (state.settings.safeZone) {
        ctx.strokeStyle = "rgba(102,238,255,.68)";
        ctx.setLineDash([width * 0.008, width * 0.006]);
        ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function applyZoom() {
    if (!root) return;
    const raw = state.settings.zoom;
    const scale = raw === "fit" ? 1 : clamp(raw, 0.35, 2.5);
    root.style.setProperty("--its-canvas-zoom", String(scale));
    root.classList.toggle("is-canvas-zoomed", raw !== "fit" && scale !== 1);
    const label = root.querySelector("[data-zoom-label]");
    if (label) label.textContent = raw === "fit" ? "Fit" : `${Math.round(scale * 100)}%`;
  }

  function refreshAnalysisPanel(item) {
    const panel = root?.querySelector("[data-analysis-panel]");
    if (panel) panel.outerHTML = analysisMarkup(item);
    const mini = root?.querySelector("[data-mini-preview]");
    if (mini && lastPreviewBuffer && state.settings.miniPreview) {
      const miniContext = mini.getContext("2d", { alpha: false });
      miniContext.clearRect(0, 0, mini.width, mini.height);
      miniContext.drawImage(lastPreviewBuffer, 0, 0, mini.width, mini.height);
    }
  }

  function updateExportEstimate() {
    const output = root?.querySelector("[data-export-estimate]");
    if (!output || !lastPreviewBuffer) return;
    const token = renderToken;
    const preset = outputPreset();
    canvasToBlob(lastPreviewBuffer, state.settings.format, clamp(state.settings.quality, 0.45, 1)).then((blob) => {
      if (!root || token !== renderToken) return;
      const ratio = preset.width * preset.height / Math.max(1, lastPreviewBuffer.width * lastPreviewBuffer.height);
      const estimate = blob.size * Math.max(1, ratio * 0.72);
      output.textContent = `Ước tính ${estimate >= 1048576 ? `${(estimate / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(estimate / 1024))} KB`}`;
    }).catch(() => { output.textContent = "Chưa thể ước tính"; });
  }

  function schedulePreview() {
    if (!root || !previewCanvas || !previewContext) return;
    const item = activeItem();
    updateStageMeta();
    if (!item) return;
    if (global.document.hidden) return;
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => {
    const token = ++renderToken;
    const preset = outputPreset();
    const width = Math.min(DESIGN_WIDTH, preset.width);
    const height = Math.round(width * preset.height / preset.width);
    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;
    const bufferContext = buffer.getContext("2d", { alpha: false });
    root.querySelector("[data-rendering]").hidden = false;
    Promise.resolve(drawComposite(bufferContext, width, height, item, { preview: true }))
      .then(() => {
        if (token !== renderToken) return;
        if (previewCanvas.width !== width) previewCanvas.width = width;
        if (previewCanvas.height !== height) previewCanvas.height = height;
        previewContext.drawImage(buffer, 0, 0);
        lastPreviewBuffer = buffer;
        refreshAnalysisPanel(item);
        updateExportEstimate();
        root.querySelector("[data-rendering]").hidden = true;
        updateStageMeta();
      })
      .catch((error) => {
        if (token !== renderToken) return;
        root.querySelector("[data-rendering]").hidden = true;
        notify(error.message || "Không thể dựng ảnh.", "error");
      });
    });
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name));
    if (!files.length) return notify("Không tìm thấy file ảnh phù hợp.", "error");
    const known = new Set(state.items.map((item) => `${item.name}:${item.size}:${item.lastModified}`));
    let added = 0;
    files.sort((a, b) => naturalCompare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name)).forEach((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (known.has(key)) return;
      known.add(key);
      const item = {
        id: `img-${Date.now().toString(36)}-${++uid}`,
        file,
        name: file.webkitRelativePath || file.name,
        size: file.size,
        lastModified: file.lastModified,
        url: "",
        renderUrl: "",
        width: 0,
        height: 0,
        focusX: 0.5,
        focusY: 0.5,
        youtubeTitle: "",
        outputBaseName: "",
        overrides: {}
      };
      state.items.push(item);
      state.selectedIds.add(item.id);
      added += 1;
    });
    if (!state.activeId && state.items[0]) state.activeId = state.items[0].id;
    applyPendingProject();
    renderAll();
    notify(`Đã thêm ${added.toLocaleString("vi-VN")} ảnh.`, "success");
  }

  function applyPendingProject() {
    const data = state.pendingProject;
    if (!data) return;
    if (data.template) state.template = {
      image: { ...DEFAULT_IMAGE_STYLE, ...(data.template.image || {}) },
      title: { ...DEFAULT_TEMPLATE.title, ...(data.template.title || {}) },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, ...(data.template.subtitle || {}) },
      footer: { ...DEFAULT_TEMPLATE.footer, ...(data.template.footer || {}) }
    };
    if (data.settings) state.settings = { ...initialSettings(), ...data.settings };
    if (Array.isArray(data.layerOrder)) state.layerOrder = data.layerOrder;
    if (Array.isArray(data.variants)) state.variants = data.variants;
    state.variantBase = data.variantBase || null;
    const map = new Map((data.images || []).map((entry) => [entry.name, entry]));
    state.items.forEach((item) => {
      const saved = map.get(item.name) || map.get(item.name.split(/[\\/]/).pop());
      if (!saved) return;
      item.overrides = saved.overrides || {};
      item.outputBaseName = saved.outputBaseName || "";
      item.youtubeTitle = saved.youtubeTitle || "";
      item.focusX = saved.focusX ?? 0.5;
      item.focusY = saved.focusY ?? 0.5;
    });
    state.pendingProject = null;
  }

  function selectItem(id) {
    if (!state.items.some((item) => item.id === id)) return;
    state.activeId = id;
    renderLibrary();
    renderInspector();
    updateStageMeta();
    schedulePreview();
  }

  function selectFirstImages(count) {
    const list = filteredItems();
    const amount = clamp(Math.floor(Number(count) || 0), 0, list.length);
    state.selectedIds.clear();
    list.slice(0, amount).forEach((item) => state.selectedIds.add(item.id));
    renderLibrary();
    notify(`Đã chọn ${amount.toLocaleString("vi-VN")} ảnh đầu tiên.`, "success");
  }

  function setSelection(mode) {
    const list = [...state.items];
    if (mode === "none") state.selectedIds.clear();
    else if (mode === "all") list.forEach((item) => state.selectedIds.add(item.id));
    else if (mode === "page") { state.selectedIds.clear(); pagedItems().items.forEach((item) => state.selectedIds.add(item.id)); }
    else if (mode === "invert") list.forEach((item) => state.selectedIds.has(item.id) ? state.selectedIds.delete(item.id) : state.selectedIds.add(item.id));
    renderLibrary();
  }

  function navigateImage(direction) {
    const list = filteredItems();
    if (!list.length) return;
    const current = Math.max(0, list.findIndex((item) => item.id === state.activeId));
    const next = list[(current + direction + list.length) % list.length];
    state.page = Math.floor(list.indexOf(next) / state.pageSize);
    selectItem(next.id);
  }

  function applyPreset(id) {
    const preset = PRESETS[id];
    if (!preset) return;
    pushHistory();
    state.template = clone({ image: state.template.image || DEFAULT_IMAGE_STYLE, title: preset.title, subtitle: preset.subtitle, footer: preset.footer });
    root.querySelectorAll("[data-preset]").forEach((button) => button.classList.toggle("is-active", button.dataset.preset === id));
    renderInspector();
    schedulePreview();
    persistSettings();
  }

  function moveActiveLayer(direction) {
    const order = activeLayerOrder();
    const index = order.indexOf(state.activeSlot);
    const next = clamp(index + direction, 0, order.length - 1);
    if (next === index) return;
    pushHistory();
    [order[index], order[next]] = [order[next], order[index]];
    state.layerOrder = order;
    renderInspector();
    schedulePreview();
    persistSettings();
  }

  function duplicateActiveLayer() {
    const source = layerFor(activeItem(), state.activeSlot);
    const targetSlot = ["title", "subtitle", "footer"].find((slot) => slot !== state.activeSlot && !resolveText(layerFor(activeItem(), slot).text, activeItem()).trim())
      || (state.activeSlot === "title" ? "subtitle" : "footer");
    pushHistory();
    state.template[targetSlot] = { ...source, x: clamp(source.x + 0.03, 0.02, 0.98), y: clamp(source.y + 0.08, 0.04, 0.96), text: source.text || LAYER_LABELS[state.activeSlot] };
    state.activeSlot = targetSlot;
    renderInspector();
    schedulePreview();
    persistSettings();
    notify(`Đã nhân bản sang ${LAYER_LABELS[targetSlot]}.`, "success");
  }

  function createVariants() {
    const base = clone(state.template);
    state.variantBase = base;
    state.variants = [
      { id: "A", label: "Trái điện ảnh", template: { ...clone(base), title: { ...base.title, x: 0.08, y: 0.32, align: "left", gradient: false }, subtitle: { ...base.subtitle, x: 0.08, y: 0.46, align: "left" } } },
      { id: "B", label: "Giữa nổi bật", template: { ...clone(base), title: { ...base.title, x: 0.5, y: 0.48, align: "center", uppercase: true, glow: 0.28 }, subtitle: { ...base.subtitle, x: 0.5, y: 0.61, align: "center" } } },
      { id: "C", label: "Gradient hiện đại", template: { ...clone(base), title: { ...base.title, x: 0.9, y: 0.68, align: "right", gradient: true, gradientStart: "#ffffff", gradientEnd: "#65e9ef" }, subtitle: { ...base.subtitle, x: 0.9, y: 0.79, align: "right" } } }
    ];
    state.activeVariant = "original";
    renderInspector();
    persistSettings();
    notify("Đã tạo ba biến thể A/B/C từ thiết kế hiện tại.", "success");
  }

  function selectVariant(id) {
    pushHistory();
    if (id === "original" && state.variantBase) state.template = clone(state.variantBase);
    else {
      const variant = state.variants.find((entry) => entry.id === id);
      if (!variant) return;
      state.template = clone(variant.template);
    }
    state.activeVariant = id;
    renderInspector();
    schedulePreview();
    persistSettings();
  }

  function setToolPanel(tool) {
    if (["shape", "icon"].includes(tool)) return notify("Engine tài nguyên này chưa được cấu hình; không có dữ liệu giả được chèn vào dự án.", "info");
    state.settings.activeTool = tool;
    root.dataset.activeTool = tool;
    root.querySelectorAll("[data-action=tool-panel]").forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
    });
    root.classList.remove("show-library-sheet", "show-inspector-sheet");
    if (["image", "upload"].includes(tool)) root.classList.add("show-library-sheet");
    else if (["text", "effects", "background"].includes(tool)) root.classList.add("show-inspector-sheet");
    else if (tool === "template") root.querySelector("[data-preset-row]")?.scrollIntoView?.({ block: "nearest", inline: "start" });
    const backdrop = root.querySelector(".its-sheet-backdrop");
    if (backdrop) backdrop.hidden = !root.matches(".show-library-sheet,.show-inspector-sheet");
    if (tool === "upload") root.querySelector("[data-file-input]")?.click();
  }

  function closeToolPanels() {
    root?.classList.remove("show-library-sheet", "show-inspector-sheet");
    const backdrop = root?.querySelector(".its-sheet-backdrop");
    if (backdrop) backdrop.hidden = true;
  }

  function setZoom(value) {
    state.settings.zoom = value === "fit" ? "fit" : clamp(value, 0.35, 2.5);
    applyZoom();
    persistSettings();
  }

  function setLayerProperty(property, rawValue, element) {
    const item = activeItem();
    const patch = layerEditPatch(property, rawValue);
    if (!patch) return;
    applyLayerEdit(state, item, state.activeSlot, patch);
    const value = patch[property];
    syncColorControls(element);
    if (property === "font") ensureFont(value, layerFor(item, state.activeSlot).weight).then(schedulePreview);
    const label = root.querySelector(`[data-value-for="${property}"]`);
    if (label) {
      if (property === "size" || property === "strokeWidth") label.textContent = `${Number(value).toFixed(property === "size" ? 1 : 2)}%`;
      else if (property === "maxWidth" || property === "shadow" || property === "opacity" || property === "glow") label.textContent = `${Math.round(Number(value) * 100)}%`;
      else if (property === "lineHeight") label.textContent = Number(value).toFixed(2);
      else if (property === "letterSpacing") label.textContent = `${Number(value).toFixed(2)}em`;
      else if (property === "rotation") label.textContent = `${Math.round(Number(value))}°`;
    }
    const outputPreview = root.querySelector(".its-output-name-preview");
    if (outputPreview && item) outputPreview.textContent = outputName(item);
    schedulePreview();
    persistSettings();
  }

  // A deliberate color edit selects its own paint mode. Legacy projects keep
  // their existing flags until the user changes a color or explicitly a mode.
  function layerEditPatch(property, rawValue) {
    if (property === "colorMode") {
      if (!["solid", "auto", "gradient"].includes(rawValue)) return null;
      return { autoContrast: rawValue === "auto", gradient: rawValue === "gradient" };
    }
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_LAYER, property)) return null;
    let value = rawValue;
    if (["size", "weight", "maxWidth", "strokeWidth", "shadow", "opacity", "x", "y", "lineHeight", "letterSpacing", "rotation", "glow"].includes(property)) value = Number(rawValue);
    if (["autoContrast", "background", "italic", "uppercase", "gradient", "visible", "locked"].includes(property)) value = Boolean(rawValue);
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    if (["color", "stroke", "gradientStart", "gradientEnd"].includes(property)) {
      if (!validHex(value)) return null;
      value = value.toLowerCase();
    }
    const patch = { [property]: value };
    if (property === "color") Object.assign(patch, { autoContrast: false, gradient: false });
    if (property === "stroke") patch.autoContrast = false;
    if (property === "gradientStart" || property === "gradientEnd") Object.assign(patch, { autoContrast: false, gradient: true });
    if (property === "gradient" && value) patch.autoContrast = false;
    if (property === "autoContrast" && value) patch.gradient = false;
    return patch;
  }

  function applyLayerEdit(model, item, slot, patch) {
    if (!model.template[slot] || !patch) return;
    if (model.settings.editMode === "all" || !item) {
      Object.assign(model.template[slot], patch);
      // Clear only the properties just edited. Per-image AI titles, geometry
      // and other overrides survive a global color change.
      model.items.forEach((image) => {
        const overrides = image.overrides?.[slot];
        if (overrides) Object.keys(patch).forEach((key) => { delete overrides[key]; });
      });
    } else {
      item.overrides ||= {};
      Object.assign(item.overrides[slot] ||= {}, patch);
    }
  }

  function syncColorControls(source) {
    if (!root) return;
    const layer = layerFor(activeItem(), state.activeSlot);
    const mode = layer.autoContrast ? "auto" : layer.gradient ? "gradient" : "solid";
    root.querySelectorAll('[data-layer-prop="colorMode"]').forEach((node) => { node.value = mode; });
    root.querySelectorAll('[data-layer-prop="autoContrast"],[data-layer-prop="gradient"]').forEach((node) => { node.checked = !!layer[node.dataset.layerProp]; });
    root.querySelectorAll('[data-layer-prop="color"],[data-layer-prop="stroke"],[data-layer-prop="gradientStart"],[data-layer-prop="gradientEnd"]').forEach((node) => {
      if (node !== source) node.value = layer[node.dataset.layerProp];
    });
    root.querySelectorAll("[data-color-swatch]").forEach((button) => button.setAttribute("aria-pressed", String(mode === "solid" && button.dataset.colorSwatch === String(layer.color).toLowerCase())));
    const hint = root.querySelector("[data-color-mode-hint]");
    if (hint) hint.textContent = mode === "auto" ? "Tự chọn trắng/đen theo ảnh. Chọn một màu bên dưới để chuyển sang màu cố định." : mode === "gradient" ? "Đang pha hai màu. Chọn màu chữ cố định để tắt gradient." : `Dùng đúng màu ${layer.color.toUpperCase()} trên preview và ảnh xuất; không tự đổi theo nền.`;
    const gradients = root.querySelector("[data-color-gradient]");
    if (gradients) gradients.hidden = mode !== "gradient";
  }

  function setImageStyleProperty(property, rawValue) {
    const target = editableImageStyle(activeItem());
    target[property] = ["enabled", "flipX", "flipY"].includes(property)
      ? Boolean(rawValue)
      : ["tint", "fit"].includes(property) ? rawValue : Number(rawValue);
    schedulePreview();
    persistSettings();
  }

  function setItemProperty(property, rawValue) {
    const item = activeItem();
    if (!item || property !== "youtubeTitle") return;
    item.youtubeTitle = String(rawValue || "").replace(/\s+/g, " ").trimStart().slice(0, 100);
    const preview = root?.querySelector(".its-output-name-preview");
    if (preview) preview.textContent = outputName(item);
    persistSettings();
  }

  function setSetting(property, rawValue) {
    let value = rawValue;
    if (["quality", "maxMB", "overlay", "zipChunk"].includes(property)) value = Number(rawValue);
    if (["safeZone", "aiSubtitle", "aiRename", "aiColor", "structuredNames"].includes(property)) value = Boolean(rawValue);
    state.settings[property] = value;
    const label = root.querySelector(`[data-value-setting="${property}"]`);
    if (label && property === "overlay") label.textContent = `${Math.round(Number(value) * 100)}%`;
    if (["output", "overlay", "safeZone"].includes(property)) schedulePreview();
    else if (["format", "quality", "maxMB"].includes(property)) updateExportEstimate();
    persistSettings();
  }

  async function addLocalFonts(files) {
    for (const file of Array.from(files || [])) {
      try {
        const family = sanitizeName(file.name).replace(/[-_]+/g, " ");
        const face = new FontFace(family, await file.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        if (!localFonts.includes(family)) localFonts.push(family);
      } catch {
        notify(`Không đọc được font ${file.name}.`, "error");
      }
    }
    renderInspector();
    notify(`Đã nạp ${localFonts.length} font từ máy.`, "success");
  }

  function projectData() {
    return {
      format: "hh-image-text-project",
      version: PROJECT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      template: state.template,
      settings: state.settings,
      layerOrder: activeLayerOrder(),
      variants: state.variants,
      variantBase: state.variantBase,
      images: state.items.map((item) => ({ name: item.name, youtubeTitle: item.youtubeTitle || "", outputBaseName: item.outputBaseName || "", overrides: item.overrides, focusX: item.focusX, focusY: item.focusY }))
    };
  }

  function validateProjectData(data) {
    if (!isPlainRecord(data) || data.format !== "hh-image-text-project") throw new Error("Không đúng định dạng project");
    if (![1, PROJECT_SCHEMA_VERSION].includes(Number(data.version || 1))) throw new Error("Phiên bản project chưa được hỗ trợ");
    if (data.images != null && (!Array.isArray(data.images) || data.images.length > 5000)) throw new Error("Danh sách ảnh trong project không hợp lệ");
    const layerKeys = Object.keys(DEFAULT_LAYER);
    const imageKeys = Object.keys(DEFAULT_IMAGE_STYLE);
    const settingKeys = Object.keys(initialSettings());
    const template = isPlainRecord(data.template) ? {
      image: { ...DEFAULT_IMAGE_STYLE, ...safeRecord(data.template.image, imageKeys) },
      title: { ...DEFAULT_TEMPLATE.title, ...safeRecord(data.template.title, layerKeys) },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, ...safeRecord(data.template.subtitle, layerKeys) },
      footer: { ...DEFAULT_TEMPLATE.footer, ...safeRecord(data.template.footer, layerKeys) }
    } : clone(DEFAULT_TEMPLATE);
    const settings = { ...initialSettings(), ...safeRecord(data.settings, settingKeys) };
    const images = (data.images || []).map((entry) => {
      if (!isPlainRecord(entry) || typeof entry.name !== "string" || entry.name.length > 500) throw new Error("Metadata ảnh trong project không hợp lệ");
      const overrides = {};
      if (isPlainRecord(entry.overrides)) {
        ["title", "subtitle", "footer"].forEach((slot) => { if (entry.overrides[slot]) overrides[slot] = safeRecord(entry.overrides[slot], layerKeys); });
        if (entry.overrides.image) overrides.image = safeRecord(entry.overrides.image, imageKeys);
      }
      return { name: entry.name, youtubeTitle: String(entry.youtubeTitle || "").slice(0, 100), outputBaseName: String(entry.outputBaseName || "").slice(0, 180), overrides, focusX: clamp(entry.focusX ?? 0.5, 0, 1), focusY: clamp(entry.focusY ?? 0.5, 0, 1) };
    });
    const layerOrder = Array.isArray(data.layerOrder) ? data.layerOrder.filter((slot) => Object.prototype.hasOwnProperty.call(LAYER_LABELS, slot)) : ["title", "subtitle", "footer"];
    const validatedOrder = layerOrder.length === 3 && new Set(layerOrder).size === 3 ? layerOrder : ["title", "subtitle", "footer"];
    const sanitizeTemplate = (candidate) => isPlainRecord(candidate) ? {
      image: { ...DEFAULT_IMAGE_STYLE, ...safeRecord(candidate.image, imageKeys) },
      title: { ...DEFAULT_TEMPLATE.title, ...safeRecord(candidate.title, layerKeys) },
      subtitle: { ...DEFAULT_TEMPLATE.subtitle, ...safeRecord(candidate.subtitle, layerKeys) },
      footer: { ...DEFAULT_TEMPLATE.footer, ...safeRecord(candidate.footer, layerKeys) }
    } : null;
    const variants = Array.isArray(data.variants) ? data.variants.slice(0, 3).map((variant, index) => {
      if (!isPlainRecord(variant)) return null;
      const variantTemplate = sanitizeTemplate(variant.template);
      if (!variantTemplate) return null;
      return { id: String(variant.id || String.fromCharCode(65 + index)).slice(0, 4), label: String(variant.label || `Biến thể ${index + 1}`).slice(0, 80), template: variantTemplate };
    }).filter(Boolean) : [];
    const variantBase = sanitizeTemplate(data.variantBase);
    return { format: "hh-image-text-project", version: PROJECT_SCHEMA_VERSION, template, settings, images, layerOrder: validatedOrder, variants, variantBase };
  }

  function exportProject() {
    downloadBlob(new Blob([JSON.stringify(projectData(), null, 2)], { type: "application/json" }), `HH-Text-Image-${new Date().toISOString().slice(0, 10)}.json`);
    notify("Đã lưu project. File ảnh gốc vẫn nằm trên máy của bạn.", "success");
  }

  async function importProject(file) {
    try {
      const data = JSON.parse(await file.text());
      const validated = validateProjectData(data);
      pushHistory();
      state.pendingProject = validated;
      state.layerOrder = validated.layerOrder;
      state.variants = validated.variants;
      applyPendingProject();
      renderAll({ keepPage: true });
      notify("Đã nạp cấu hình project.", "success");
    } catch (error) {
      notify(error.message || "Không thể nạp project.", "error");
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể mã hóa ảnh")), type, quality));
  }

  async function encodeWithinLimit(canvas) {
    const type = state.settings.format;
    const limit = Math.max(0.1, Number(state.settings.maxMB) || 1.9) * 1024 * 1024;
    if (type === "image/png") return canvasToBlob(canvas, type);
    let quality = clamp(state.settings.quality, 0.45, 1);
    let blob = await canvasToBlob(canvas, type, quality);
    while (blob.size > limit && quality > 0.46) {
      quality = Math.max(0.45, quality - 0.07);
      blob = await canvasToBlob(canvas, type, quality);
    }
    return blob;
  }

  async function renderOutput(item) {
    const preset = outputPreset();
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const context = canvas.getContext("2d", { alpha: false });
    await drawComposite(context, preset.width, preset.height, item, { preview: false });
    return encodeWithinLimit(canvas);
  }

  function outputExtension() {
    return state.settings.format === "image/png" ? "png" : state.settings.format === "image/webp" ? "webp" : "jpg";
  }

  function outputName(item) {
    if (state.settings.structuredNames && item?.youtubeTitle) {
      const original = sanitizeName(String(item.name || "image").split(/[\\/]/).pop()).slice(0, 52);
      const youtube = sanitizeName(item.youtubeTitle).slice(0, 100);
      const imageText = sanitizeName(resolveText(layerFor(item, "title").text, item) || "thumbnail").slice(0, 52);
      return `${original}_${youtube}_${imageText}.${outputExtension()}`;
    }
    return `${sanitizeName(item.outputBaseName || item.name)}${sanitizeName(state.settings.suffix || "-thumbnail")}.${outputExtension()}`;
  }

  function setExportProgress(done, total, message = "") {
    const box = root.querySelector("[data-export-progress]");
    if (!box) return;
    box.hidden = total <= 0;
    root.querySelector("[data-progress-bar]").style.width = `${total ? Math.round(done / total * 100) : 0}%`;
    root.querySelector("[data-progress-label]").textContent = message || `${done.toLocaleString("vi-VN")} / ${total.toLocaleString("vi-VN")}`;
  }

  function exportItems() {
    const selected = state.items.filter((item) => state.selectedIds.has(item.id));
    return selected.length ? selected : [...state.items];
  }

  async function runExport(items, writer) {
    if (!items.length) return notify("Hãy thêm ảnh trước khi xuất.", "error");
    if (state.exporting) return;
    state.exporting = true;
    state.cancelExport = false;
    root.classList.add("is-exporting");
    setExportProgress(0, items.length);
    let completed = 0;
    try {
      for (const item of items) {
        if (state.cancelExport) break;
        const blob = await renderOutput(item);
        await writer(item, blob, completed);
        completed += 1;
        setExportProgress(completed, items.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      notify(state.cancelExport ? `Đã dừng tại ${completed}/${items.length} ảnh.` : `Đã xuất ${completed.toLocaleString("vi-VN")} ảnh.`, state.cancelExport ? "info" : "success");
    } catch (error) {
      notify(error.message || "Xuất ảnh thất bại.", "error");
    } finally {
      state.exporting = false;
      state.cancelExport = false;
      root.classList.remove("is-exporting");
      setTimeout(() => setExportProgress(0, 0), 1200);
    }
  }

  async function exportCurrent() {
    const item = activeItem();
    if (!item) return notify("Hãy chọn một ảnh.", "error");
    await runExport([item], async (entry, blob) => downloadBlob(blob, outputName(entry)));
  }

  function showFolderPermissionDialog(show = true) {
    const dialog = root?.querySelector("[data-folder-dialog]");
    if (!dialog) return;
    if (show) {
      activeDialogTrigger = global.document.activeElement instanceof HTMLElement ? global.document.activeElement : null;
      dialog.hidden = false;
      requestAnimationFrame(() => dialog.querySelector("button")?.focus());
      return;
    }
    dialog.hidden = true;
    if (activeDialogTrigger?.isConnected) activeDialogTrigger.focus();
    activeDialogTrigger = null;
  }

  async function exportFolder() {
    if (!("showDirectoryPicker" in global)) {
      notify("Trình duyệt chưa hỗ trợ ghi thẳng thư mục; đang chuyển sang ZIP.", "info");
      return exportZip();
    }
    let directory;
    try { directory = await global.showDirectoryPicker({ mode: "readwrite", id: "hh-image-text-output" }); }
    catch (error) { if (error?.name !== "AbortError") notify("Không thể mở thư mục xuất.", "error"); return; }
    await runExport(exportItems(), async (item, blob) => {
      const handle = await directory.getFileHandle(outputName(item), { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    });
  }

  async function exportZip() {
    const items = exportItems();
    if (!items.length) return notify("Hãy thêm hoặc chọn ảnh.", "error");
    if (!global.JSZip) return notify("Engine ZIP chưa sẵn sàng. Hãy tải lại trang.", "error");
    const chunkSize = clamp(state.settings.zipChunk || 100, 20, 200);
    let zip = new global.JSZip();
    let chunk = 1;
    await runExport(items, async (item, blob, index) => {
      zip.file(outputName(item), blob);
      const isChunkEnd = (index + 1) % chunkSize === 0 || index === items.length - 1;
      if (!isChunkEnd) return;
      setExportProgress(index + 1, items.length, `Đang đóng gói ZIP ${chunk}…`);
      const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
      downloadBlob(archive, `HH-YouTube-Thumbnails-${String(chunk).padStart(2, "0")}.zip`);
      zip = new global.JSZip();
      chunk += 1;
    });
  }

  function aiTargetItems() {
    if (state.settings.aiScope === "current") return activeItem() ? [activeItem()] : [];
    if (state.settings.aiScope === "selected") return state.items.filter((item) => state.selectedIds.has(item.id));
    if (state.settings.aiScope === "all") return [...state.items];
    return pagedItems().items;
  }

  async function contactSheet(items) {
    const columns = Math.min(5, Math.max(1, items.length));
    const rows = Math.ceil(items.length / columns);
    const cellWidth = 256;
    const cellHeight = 160;
    const canvas = document.createElement("canvas");
    canvas.width = columns * cellWidth;
    canvas.height = rows * cellHeight;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#071019";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < items.length; index += 1) {
      const image = await loadImage(items[index]);
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;
      context.save();
      context.translate(x, y);
      drawCover(context, image, cellWidth, cellHeight, 0.5, 0.5);
      context.fillStyle = "rgba(3,8,12,.78)";
      context.fillRect(0, 0, 42, 30);
      context.fillStyle = "#7ff4f2";
      context.font = "800 18px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), 21, 15);
      context.strokeStyle = "rgba(127,244,242,.8)";
      context.strokeRect(0.5, 0.5, cellWidth - 1, cellHeight - 1);
      context.restore();
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    return dataUrl.split(",")[1];
  }

  function validHex(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  async function fetchYoutubeTrendContext() {
    const topic = String(state.settings.youtubeTopic || "").trim();
    if (!topic) return { label: "Không có từ khóa", context: "" };
    const published = state.settings.trendPeriod === "week" ? "w1" : "m1";
    const params = new URLSearchParams({
      q: topic,
      order: "viewCount",
      published,
      duration: "long",
      definition: "high",
      region: state.settings.trendRegion || "US",
      language: state.settings.titleLanguage || "en",
      safe: "moderate"
    });
    try {
      const response = await fetch(`/api/search/youtube?${params}`, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal: eventController?.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `YouTube Trends HTTP ${response.status}`);
      const items = Array.isArray(payload.items) ? payload.items.slice(0, 12) : [];
      if (!items.length) return { label: "Không có video mới", context: "" };
      const periodLabel = published === "w1" ? "7 ngày" : "30 ngày";
      return {
        label: `${items.length} video · ${periodLabel}`,
        context: [
          `TÍN HIỆU YOUTUBE ${periodLabel.toUpperCase()} · ${topic}`,
          "Chỉ học cấu trúc và ý định tìm kiếm; không sao chép nguyên văn:",
          ...items.map((entry, index) => `${index + 1}. ${entry.title} | ${entry.channel} | ${Number(entry.views || 0).toLocaleString("en-US")} views | ${String(entry.publishedAt || "").slice(0, 10)}`)
        ].join("\n")
      };
    } catch (error) {
      notify(`${error.message || "Không tải được YouTube Trends"}. AI sẽ dùng tìm kiếm web dự phòng.`, "info");
      return { label: "Web trend dự phòng", context: "" };
    }
  }

  async function runAiTextBatch() {
    const targets = aiTargetItems();
    if (!targets.length) return notify("Hãy thêm hoặc chọn ảnh trước khi dùng AI.", "error");
    if (state.ai.running) return;
    pushHistory();
    state.ai = { ...state.ai, running: true, cancel: false, done: 0, total: targets.length, trendLabel: "Đang lấy xu hướng…", trendContext: "", fallbackNotice: "" };
    renderInspector();
    notify(`Đang lấy title YouTube nổi bật trong ${state.settings.trendPeriod === "week" ? "7" : "30"} ngày gần đây.`, "info");
    try {
      const trend = await fetchYoutubeTrendContext();
      state.ai.trendLabel = trend.label;
      state.ai.trendContext = trend.context;
      renderInspector();
      for (let offset = 0; offset < targets.length; offset += 20) {
        if (state.ai.cancel) break;
        const chunk = targets.slice(offset, offset + 20);
        const attachment = await contactSheet(chunk);
        const imageList = chunk.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
        const context = [state.ai.trendContext, `DANH SÁCH ẢNH\n${imageList}`].filter(Boolean).join("\n\n");
        const response = await fetch("/api/modules/image-text/actions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          signal: eventController?.signal,
          body: JSON.stringify({
            actionType: "image-text-youtube-batch",
            input: [`Chủ đề: ${state.settings.youtubeTopic}`, `Khoảng xu hướng: ${state.settings.trendPeriod === "week" ? "7 ngày" : "30 ngày"}`, `Ngôn ngữ title: ${state.settings.titleLanguage}`, `Phong cách chữ: ${state.settings.aiPrompt}`].join("\n"),
            meta: {
              provider: state.settings.aiProvider,
              requireProvider: false,
              allowProviderFallback: true,
              useGoogleSearch: !state.ai.trendContext && offset === 0,
              context,
              titleLanguage: state.settings.titleLanguage,
              youtubeTopic: state.settings.youtubeTopic,
              images: chunk.map((item, index) => ({ index: index + 1, filename: item.name })),
              attachments: [{ mimeType: "image/jpeg", data: attachment }]
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `AI backend phản hồi HTTP ${response.status}`);
        if (payload.action?.provider === "local-image-text") {
          state.ai.fallbackNotice = "Gemini đang hết quota; Tool đã tạo title dự phòng và vẫn tiếp tục batch.";
        }
        let structured = payload.action?.structured;
        if (!structured && payload.action?.output) {
          try { structured = JSON.parse(payload.action.output); } catch {}
        }
        const rows = Array.isArray(structured?.items) ? structured.items : [];
        rows.forEach((row) => {
          const index = Number(row.index) - 1;
          const item = chunk[index];
          if (!item) return;
          item.overrides.title = { ...(item.overrides.title || {}), text: String(row.title || "").trim() };
          item.youtubeTitle = String(row.youtubeTitle || "").replace(/\s+/g, " ").trim().slice(0, 100);
          if (state.settings.aiSubtitle) item.overrides.subtitle = { ...(item.overrides.subtitle || {}), text: String(row.subtitle || "").trim() };
          if (state.settings.aiRename && row.outputName) item.outputBaseName = sanitizeName(row.outputName);
          if (state.settings.aiColor && validHex(row.textColor)) {
            item.overrides.title.color = row.textColor;
            item.overrides.title.autoContrast = false;
          }
        });
        state.ai.done = Math.min(targets.length, offset + chunk.length);
        renderInspector();
        renderLibrary();
        schedulePreview();
      }
      const usedFallback = Boolean(state.ai.fallbackNotice);
      notify(state.ai.cancel ? `Đã dừng sau ${state.ai.done}/${state.ai.total} ảnh.` : usedFallback ? `Đã tạo title cho ${state.ai.done.toLocaleString("vi-VN")} ảnh bằng chế độ dự phòng. Bạn vẫn có thể xuất ZIP ngay.` : `Đã tạo Title YouTube và chữ thumbnail riêng cho ${state.ai.done.toLocaleString("vi-VN")} ảnh.`, state.ai.cancel || usedFallback ? "info" : "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      notify(error.message || "Không thể tạo chữ bằng AI.", "error");
    } finally {
      state.ai.running = false;
      state.ai.cancel = false;
      renderInspector();
      schedulePreview();
      persistSettings();
    }
  }

  function bindCanvas() {
    previewCanvas.addEventListener("pointerdown", (event) => {
      const rect = previewCanvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * previewCanvas.width / rect.width;
      const y = (event.clientY - rect.top) * previewCanvas.height / rect.height;
      const slot = [...hitBoxes.entries()].reverse().find(([, box]) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)?.[0];
      if (!slot) return;
      if (layerFor(activeItem(), slot).locked) return notify(`${LAYER_LABELS[slot]} đang bị khóa.`, "info");
      pushHistory();
      state.activeSlot = slot;
      dragState = { pointerId: event.pointerId, slot };
      previewCanvas.setPointerCapture(event.pointerId);
      renderInspector();
    });
    previewCanvas.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const rect = previewCanvas.getBoundingClientRect();
      let x = clamp((event.clientX - rect.left) / rect.width, 0.02, 0.98);
      let y = clamp((event.clientY - rect.top) / rect.height, 0.04, 0.96);
      if (state.settings.grid) { x = Math.round(x * 24) / 24; y = Math.round(y * 16) / 16; }
      if (Math.abs(x - 0.5) < 0.012) x = 0.5;
      if (Math.abs(y - 0.5) < 0.012) y = 0.5;
      const layer = editableLayer(activeItem(), dragState.slot);
      layer.x = x;
      layer.y = y;
      schedulePreview();
    });
    const finish = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      dragState = null;
      renderInspector();
      persistSettings();
    };
    previewCanvas.addEventListener("pointerup", finish);
    previewCanvas.addEventListener("pointercancel", finish);
  }

  function bindEvents() {
    eventController?.abort?.();
    eventController = new AbortController();
    const signal = eventController.signal;
    const fileInput = root.querySelector("[data-file-input]");
    const folderInput = root.querySelector("[data-folder-input]");
    const fontInput = root.querySelector("[data-font-input]");
    const projectInput = root.querySelector("[data-project-input]");
    fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
    folderInput.addEventListener("change", () => { addFiles(folderInput.files); folderInput.value = ""; });
    fontInput.addEventListener("change", () => { addLocalFonts(fontInput.files); fontInput.value = ""; });
    projectInput.addEventListener("change", () => { if (projectInput.files[0]) importProject(projectInput.files[0]); projectInput.value = ""; });
    root.addEventListener("error", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest(".its-thumb")) return;
      const item = state.items.find((entry) => entry.id === image.closest("[data-image-id]")?.dataset.imageId);
      if (!item || image.dataset.retried === "1") {
        image.closest(".its-thumb")?.classList.add("is-image-error");
        return;
      }
      image.dataset.retried = "1";
      if (item.url) URL.revokeObjectURL(item.url);
      item.url = "";
      image.src = ensureObjectUrl(item);
    }, true);

    const dropzone = root.querySelector("[data-dropzone]");
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
    dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
    dropzone.addEventListener("click", () => folderInput.click());
    dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") folderInput.click(); });

    root.addEventListener("focusin", (event) => {
      if (event.target.matches("[data-layer-prop],[data-image-prop],[data-item-prop],[data-setting]")) beforeEditSnapshot = snapshotState();
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-layer-prop]")) {
        if (beforeEditSnapshot) pushHistory(beforeEditSnapshot);
        beforeEditSnapshot = null;
        setLayerProperty(target.dataset.layerProp, target.type === "checkbox" ? target.checked : target.value, target);
      } else if (target.matches("[data-image-prop]")) {
        if (beforeEditSnapshot) pushHistory(beforeEditSnapshot);
        beforeEditSnapshot = null;
        setImageStyleProperty(target.dataset.imageProp, target.type === "checkbox" ? target.checked : target.value);
      } else if (target.matches("[data-item-prop]")) {
        if (beforeEditSnapshot) pushHistory(beforeEditSnapshot);
        beforeEditSnapshot = null;
        setItemProperty(target.dataset.itemProp, target.value);
      } else if (target.matches("[data-setting]")) {
        if (beforeEditSnapshot) pushHistory(beforeEditSnapshot);
        beforeEditSnapshot = null;
        setSetting(target.dataset.setting, target.type === "checkbox" ? target.checked : target.value);
      } else if (target.matches("[data-select-id]")) {
        if (target.checked) state.selectedIds.add(target.dataset.selectId);
        else state.selectedIds.delete(target.dataset.selectId);
        renderLibrary();
      }
    });
    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target.matches("[data-layer-prop]")) setLayerProperty(target.dataset.layerProp, target.type === "checkbox" ? target.checked : target.value, target);
      else if (target.matches("[data-image-prop]")) setImageStyleProperty(target.dataset.imageProp, target.type === "checkbox" ? target.checked : target.value);
      else if (target.matches("[data-item-prop]")) setItemProperty(target.dataset.itemProp, target.value);
      else if (target.matches("[data-setting]")) setSetting(target.dataset.setting, target.type === "checkbox" ? target.checked : target.value);
      else if (target.matches("[data-search]")) {
        state.query = target.value;
        state.page = 0;
        renderLibrary();
      }
    });
    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      const thumb = event.target.closest("[data-image-id]");
      if (thumb && !event.target.closest("label")) selectItem(thumb.dataset.imageId);
      if (!action) return;
      const name = action.dataset.action;
      if (name === "add-images") fileInput.click();
      else if (name === "add-folder") folderInput.click();
      else if (name === "add-font") fontInput.click();
      else if (name === "import-project") projectInput.click();
      else if (name === "export-project") exportProject();
      else if (name === "undo") undo();
      else if (name === "redo") redo();
      else if (name === "color-swatch") { pushHistory(); setLayerProperty("color", action.dataset.colorSwatch); }
      else if (name === "sort") { state.sort = state.sort === "asc" ? "desc" : "asc"; renderLibrary(); }
      else if (name === "prev-page" || name === "next-page") { state.page += name === "prev-page" ? -1 : 1; renderLibrary(); }
      else if (name === "prev-image" || name === "next-image") navigateImage(name === "prev-image" ? -1 : 1);
      else if (name === "select-count-preset") selectFirstImages(action.dataset.count);
      else if (name === "select-count") selectFirstImages(root.querySelector("[data-select-count]")?.value);
      else if (name === "select-page") setSelection("page");
      else if (name === "select-all") setSelection("all");
      else if (name === "select-none") setSelection("none");
      else if (name === "invert-selection") setSelection("invert");
      else if (name === "preset") applyPreset(action.dataset.preset);
      else if (name === "slot") { state.activeSlot = action.dataset.slot; renderInspector(); }
      else if (name === "tool-panel") setToolPanel(action.dataset.tool);
      else if (name === "close-panels") closeToolPanels();
      else if (name === "zoom-fit") setZoom("fit");
      else if (name === "zoom-100") setZoom(1);
      else if (name === "zoom-in") setZoom(state.settings.zoom === "fit" ? 1.15 : Number(state.settings.zoom) + 0.15);
      else if (name === "zoom-out") setZoom(state.settings.zoom === "fit" ? 0.85 : Number(state.settings.zoom) - 0.15);
      else if (name === "toggle-grid") { state.settings.grid = !state.settings.grid; action.setAttribute("aria-pressed", String(state.settings.grid)); schedulePreview(); persistSettings(); }
      else if (name === "layer-visible" || name === "layer-lock") {
        pushHistory();
        const slot = action.dataset.slot;
        const targetLayer = editableLayer(activeItem(), slot);
        const property = name === "layer-visible" ? "visible" : "locked";
        targetLayer[property] = !(layerFor(activeItem(), slot)[property] ?? (property === "visible"));
        renderInspector(); schedulePreview(); persistSettings();
      }
      else if (name === "layer-up" || name === "layer-down") moveActiveLayer(name === "layer-up" ? 1 : -1);
      else if (name === "duplicate-layer") duplicateActiveLayer();
      else if (name === "create-variants") createVariants();
      else if (name === "select-variant") selectVariant(action.dataset.variant);
      else if (name === "edit-mode") { state.settings.editMode = action.dataset.mode; renderInspector(); schedulePreview(); }
      else if (name === "toggle-layer") {
        pushHistory();
        const layer = editableLayer(activeItem(), state.activeSlot);
        const current = layer[action.dataset.prop] ?? layerFor(activeItem(), state.activeSlot)[action.dataset.prop];
        layer[action.dataset.prop] = !current;
        renderInspector(); schedulePreview(); persistSettings();
      }
      else if (name === "position") {
        pushHistory();
        const layer = editableLayer(activeItem(), state.activeSlot);
        layer.x = Number(action.dataset.x); layer.y = Number(action.dataset.y);
        if (layer.x < 0.3) layer.align = "left"; else if (layer.x > 0.7) layer.align = "right"; else layer.align = "center";
        renderInspector(); schedulePreview(); persistSettings();
      }
      else if (name === "copy-current-to-all") {
        const item = activeItem(); if (!item) return;
        pushHistory();
        const style = layerFor(item, state.activeSlot);
        delete style.text;
        state.settings.editMode = "all";
        applyLayerEdit(state, item, state.activeSlot, style);
        renderInspector(); schedulePreview(); persistSettings(); notify("Đã áp dụng kiểu chữ cho toàn bộ ảnh, giữ nguyên nội dung riêng.", "success");
      }
      else if (name === "reset-current") {
        const item = activeItem(); if (!item) return;
        pushHistory(); delete item.overrides[state.activeSlot]; renderInspector(); schedulePreview();
      }
      else if (name === "filename-title") {
        pushHistory(); state.template[state.activeSlot].text = "{filename}"; renderInspector(); schedulePreview();
      }
      else if (name === "export-current") exportCurrent();
      else if (name === "toggle-export-more") { const menu = action.parentElement?.querySelector("[data-export-more-menu]"); if (menu) { menu.hidden = !menu.hidden; action.setAttribute("aria-expanded", String(!menu.hidden)); } }
      else if (name === "export-folder") showFolderPermissionDialog(true);
      else if (name === "folder-dialog-close") { showFolderPermissionDialog(false); exportZip(); }
      else if (name === "export-folder-confirm") { showFolderPermissionDialog(false); exportFolder(); }
      else if (name === "export-zip") exportZip();
      else if (name === "ai-generate") runAiTextBatch();
      else if (name === "ai-cancel") state.ai.cancel = true;
      else if (name === "ai-refresh-status") refreshAiProviderStatus();
      else if (name === "cancel-export") state.cancelExport = true;
    });
    bindCanvas();

    keyHandler = (event) => {
      if (!root?.isConnected) return;
      const permissionDialog = root.querySelector("[data-folder-dialog]");
      if (permissionDialog && !permissionDialog.hidden) {
        if (event.key === "Escape") { event.preventDefault(); showFolderPermissionDialog(false); return; }
        if (event.key === "Tab") {
          const focusable = Array.from(permissionDialog.querySelectorAll("button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"));
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && global.document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && global.document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      if (event.target.matches("input,textarea,select,[contenteditable]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); exportProject(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") { event.preventDefault(); state.layerClipboard = clone(layerFor(activeItem(), state.activeSlot)); notify(`Đã sao chép ${LAYER_LABELS[state.activeSlot]}.`, "success"); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && state.layerClipboard) { event.preventDefault(); pushHistory(); Object.assign(editableLayer(activeItem(), state.activeSlot), clone(state.layerClipboard)); renderInspector(); schedulePreview(); persistSettings(); }
      else if ((event.key === "Delete" || event.key === "Backspace") && !layerFor(activeItem(), state.activeSlot).locked) { event.preventDefault(); pushHistory(); editableLayer(activeItem(), state.activeSlot).text = ""; renderInspector(); schedulePreview(); persistSettings(); }
      else if (event.key === "ArrowLeft") navigateImage(-1);
      else if (event.key === "ArrowRight") navigateImage(1);
      else if (event.key === "Escape") closeToolPanels();
    };
    global.addEventListener("keydown", keyHandler);
    global.document.addEventListener("paste", (event) => {
      if (!root?.isConnected || event.target.matches("input,textarea,[contenteditable]")) return;
      const files = Array.from(event.clipboardData?.files || []).filter((file) => IMAGE_TYPES.has(file.type));
      if (files.length) { event.preventDefault(); addFiles(files); }
    }, { signal });
    global.document.addEventListener("visibilitychange", () => {
      if (global.document.hidden) cancelAnimationFrame(previewFrame);
      else schedulePreview();
    }, { signal });
  }

  function mount(target) {
    if (!target) return;
    unmount();
    host = target;
    const token = lifecycleToken;
    restoreSettings();
    buildShell();
    bindEvents();
    renderAll({ keepPage: true });
    restoreAutosave(token);
    refreshAiProviderStatus({ quiet: true });
    global.dispatchEvent(new CustomEvent("hh:image-text-ready"));
  }

  function unmount() {
    lifecycleToken += 1;
    eventController?.abort?.();
    eventController = null;
    if (keyHandler) global.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    clearTimeout(previewTimer);
    previewTimer = 0;
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    const closingDb = autosaveDbPromise;
    autosaveDbPromise = null;
    Promise.resolve(closingDb).then((db) => db?.close?.()).catch(() => {});
    state.ai.cancel = true;
    state.exporting = false;
    state.cancelExport = true;
    state.items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
      if (item.renderUrl) URL.revokeObjectURL(item.renderUrl);
    });
    state.items = [];
    state.selectedIds.clear();
    state.activeId = "";
    state.history = [];
    state.future = [];
    state.pendingProject = null;
    state.layerOrder = ["title", "subtitle", "footer"];
    state.layerClipboard = null;
    state.variants = [];
    state.variantBase = null;
    state.activeVariant = "original";
    state.activeSlot = "title";
    imageCache.forEach((entry) => Promise.resolve(entry?.promise).then((image) => { if (image) image.src = ""; }).catch(() => {}));
    imageCache.clear();
    hitBoxes.clear();
    lastPreviewBuffer = null;
    activeDialogTrigger = null;
    beforeEditSnapshot = null;
    dragState = null;
    renderToken += 1;
    if (host) host.replaceChildren();
    host = null;
    root = null;
    previewCanvas = null;
    previewContext = null;
  }

    global.HHImageTextStudio = Object.freeze({ mount, unmount, version: "1.1.0" });
})(window);
