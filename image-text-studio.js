(function initHHImageTextStudio(global) {
  "use strict";

  const STORAGE_KEY = "hh-image-text-studio-v1";
  const MAX_HISTORY = 40;
  const PAGE_SIZE = 60;
  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]);
  const FONT_GROUPS = Object.freeze([
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
    italic: false,
    uppercase: false,
    autoContrast: true,
    background: false
  });

  const DEFAULT_IMAGE_STYLE = Object.freeze({
    enabled: false,
    tint: "#ffffff",
    tintOpacity: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1
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
    aiSubtitle: false,
    aiRename: true,
    aiColor: false
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
    template: clone(DEFAULT_TEMPLATE),
    settings: initialSettings(),
    exporting: false,
    cancelExport: false,
    history: [],
    future: [],
    pendingProject: null,
    notices: [],
    ai: { running: false, cancel: false, done: 0, total: 0 }
  };

  const activeItem = () => state.items.find((item) => item.id === state.activeId) || null;
  const itemIndex = (item) => state.items.indexOf(item);
  const outputPreset = () => OUTPUT_PRESETS[state.settings.output] || OUTPUT_PRESETS.fast;
  const layerFor = (item, slot) => ({ ...state.template[slot], ...(item?.overrides?.[slot] || {}) });
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

  function persistSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: state.template, settings: state.settings }));
    } catch {}
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.template) state.template = { ...clone(DEFAULT_TEMPLATE), ...saved.template };
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

  function snapshotState() {
    return JSON.stringify({
      template: state.template,
      settings: state.settings,
      overrides: state.items.map((item) => [item.name, item.overrides, item.focusX, item.focusY, item.outputBaseName || ""])
    });
  }

  function restoreSnapshot(serialized) {
    try {
      const data = JSON.parse(serialized);
      state.template = data.template || clone(DEFAULT_TEMPLATE);
      state.settings = { ...initialSettings(), ...(data.settings || {}) };
      const overrideMap = new Map(data.overrides || []);
      state.items.forEach((item) => {
        const row = overrideMap.get(item.name);
        if (!row) return;
        item.overrides = row[0] || {};
        item.focusX = row[1] ?? 0.5;
        item.focusY = row[2] ?? 0.5;
        item.outputBaseName = row[3] || "";
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
        <aside class="its-library">
          <div class="its-panel-head"><div><strong>Kho ảnh</strong><small data-library-summary>Chưa có ảnh</small></div><button type="button" data-action="add-images">＋ Ảnh</button></div>
          <label class="its-dropzone" data-dropzone tabindex="0"><span>＋</span><strong>Thả ảnh hoặc thư mục vào đây</strong><small>JPG · PNG · WebP · AVIF · tối ưu cho 1.000+ ảnh</small></label>
          <div class="its-library-tools">
            <label><span>⌕</span><input type="search" placeholder="Tìm tên ảnh..." data-search></label>
            <button type="button" data-action="sort" title="Đổi thứ tự">A→Z</button>
            <button type="button" data-action="select-visible" title="Chọn/bỏ chọn trang này">✓</button>
          </div>
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
            <label class="its-safe-toggle"><input type="checkbox" data-setting="safeZone"${state.settings.safeZone ? " checked" : ""}><span>Vùng an toàn</span></label>
          </div>
          <div class="its-canvas-wrap" data-canvas-wrap>
            <div class="its-empty-stage" data-empty-stage><span>TX</span><strong>Thumbnail đẹp trong vài giây</strong><small>Chọn thư mục ảnh → nhập chữ → áp dụng toàn bộ → xuất.</small><button type="button" data-action="add-folder">Chọn thư mục ảnh</button></div>
            <canvas width="1280" height="720" data-preview-canvas aria-label="Preview thumbnail"></canvas>
            <div class="its-rendering" data-rendering hidden><i></i><span>Đang dựng preview…</span></div>
          </div>
          <div class="its-image-nav">
            <button type="button" data-action="prev-image">←</button>
            <div><strong data-active-name>Chưa chọn ảnh</strong><small data-active-meta>0 × 0</small></div>
            <button type="button" data-action="next-image">→</button>
          </div>
        </main>
        <aside class="its-inspector" data-inspector></aside>
      </div>
      <footer class="its-exportbar">
        <div class="its-export-settings">
          <label><span>Kích thước</span><select data-setting="output">${Object.entries(OUTPUT_PRESETS).map(([key, preset]) => `<option value="${key}"${key === state.settings.output ? " selected" : ""}>${preset.label}</option>`).join("")}</select></label>
          <label><span>Định dạng</span><select data-setting="format"><option value="image/jpeg"${state.settings.format === "image/jpeg" ? " selected" : ""}>JPG</option><option value="image/png"${state.settings.format === "image/png" ? " selected" : ""}>PNG</option><option value="image/webp"${state.settings.format === "image/webp" ? " selected" : ""}>WebP</option></select></label>
          <label><span>Giới hạn</span><select data-setting="maxMB"><option value="1.9"${Number(state.settings.maxMB) === 1.9 ? " selected" : ""}>≤ 2 MB</option><option value="5"${Number(state.settings.maxMB) === 5 ? " selected" : ""}>≤ 5 MB</option><option value="48"${Number(state.settings.maxMB) === 48 ? " selected" : ""}>≤ 50 MB</option></select></label>
        </div>
        <div class="its-export-progress" data-export-progress hidden><div><i data-progress-bar></i></div><span data-progress-label>0 / 0</span><button type="button" data-action="cancel-export">Hủy</button></div>
        <div class="its-export-actions">
          <button type="button" data-action="export-current">Tải ảnh đang xem</button>
          <div class="its-export-more"><button type="button" data-action="toggle-export-more" aria-expanded="false">Xuất nâng cao</button><div data-export-more-menu hidden><p>Ghi thẳng vào thư mục cần quyền của Chrome. ZIP không cần cấp quyền.</p><button type="button" data-action="export-folder">Ghi thẳng vào thư mục</button></div></div>
          <button type="button" class="is-primary" data-action="export-zip">Tải toàn bộ ZIP</button>
        </div>
      </footer>
      <div class="its-toast-tray" data-toast-tray></div>
      <div class="its-dialog-backdrop" data-folder-dialog hidden><section role="dialog" aria-modal="true" aria-labelledby="its-folder-title"><span>▣</span><div><h3 id="its-folder-title">Cho phép ghi vào thư mục?</h3><p>Đây là chế độ nâng cao. Sau khi tiếp tục, Chrome bắt buộc hiện hộp thoại quyền của trình duyệt. Bạn có thể dùng <b>Tải toàn bộ ZIP</b> để không thấy hộp thoại đó.</p><footer><button type="button" data-action="folder-dialog-close">Dùng ZIP</button><button type="button" class="is-primary" data-action="export-folder-confirm">Tiếp tục chọn thư mục</button></footer></div></section></div>`;
    host.replaceChildren(root);
    previewCanvas = root.querySelector("[data-preview-canvas]");
    previewContext = previewCanvas.getContext("2d", { alpha: false, desynchronized: true });
    const zipButton = root.querySelector('[data-action="export-zip"]');
    const folderButton = root.querySelector('[data-action="export-folder"]');
    if (zipButton) { zipButton.textContent = "Tải toàn bộ ZIP"; zipButton.classList.add("is-primary"); }
    if (folderButton) { folderButton.textContent = "Ghi thư mục (nâng cao)"; folderButton.classList.remove("is-primary"); folderButton.title = "Chrome sẽ yêu cầu quyền ghi file bằng hộp thoại hệ thống"; }
  }

  function renderInspector() {
    const inspector = root?.querySelector("[data-inspector]");
    if (!inspector) return;
    const item = activeItem();
    const layer = layerFor(item, state.activeSlot);
    const imageStyle = imageStyleFor(item);
    const settings = state.settings;
    inspector.innerHTML = `
      <div class="its-panel-head its-inspector-head"><div><strong>Chỉnh chữ nhanh</strong><small>${settings.editMode === "all" ? "Đang áp dụng cho toàn bộ ảnh" : "Chỉ ảnh đang xem"}</small></div><button type="button" data-action="add-font">＋ Font</button></div>
      <div class="its-mode-switch" role="group" aria-label="Phạm vi chỉnh sửa">
        <button type="button" data-action="edit-mode" data-mode="all"${settings.editMode === "all" ? ' class="is-active"' : ""}>Toàn bộ ảnh</button>
        <button type="button" data-action="edit-mode" data-mode="current"${settings.editMode === "current" ? ' class="is-active"' : ""}${item ? "" : " disabled"}>Ảnh này</button>
      </div>
      <section class="its-ai-panel">
        <div class="its-ai-head"><div><b>✦ AI đặt chữ theo từng ảnh</b><small>OpenAI / Gemini qua backend bảo mật</small></div><span>${state.ai.running ? `${state.ai.done}/${state.ai.total}` : "Sẵn sàng"}</span></div>
        <textarea rows="2" data-setting="aiPrompt" placeholder="Ví dụ: chữ tiếng Anh 2–4 từ, phong cách đồng quê…">${escapeHtml(settings.aiPrompt)}</textarea>
        <div class="its-ai-row">
          <select data-setting="aiProvider"><option value="auto">AI tự chọn</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select>
          <select data-setting="aiScope"><option value="current">Ảnh này</option><option value="selected">Ảnh đã chọn</option><option value="page">Trang hiện tại</option><option value="all">Toàn bộ ảnh</option></select>
          <button type="button" class="is-primary" data-action="ai-generate" ${state.ai.running ? "disabled" : ""}>${state.ai.running ? "Đang tạo…" : "✦ Tự viết chữ"}</button>
        </div>
        <div class="its-ai-options"><label><input type="checkbox" data-setting="aiSubtitle"${settings.aiSubtitle ? " checked" : ""}> Phụ đề</label><label><input type="checkbox" data-setting="aiRename"${settings.aiRename ? " checked" : ""}> Đổi tên file</label><label><input type="checkbox" data-setting="aiColor"${settings.aiColor ? " checked" : ""}> Màu chữ AI</label>${state.ai.running ? '<button type="button" data-action="ai-cancel">Dừng</button>' : ""}</div>
      </section>
      <div class="its-slot-tabs" role="tablist">
        ${[["title", "Tiêu đề"], ["subtitle", "Phụ đề"], ["footer", "Chân ảnh"]].map(([id, label]) => `<button type="button" role="tab" data-action="slot" data-slot="${id}"${state.activeSlot === id ? ' class="is-active" aria-selected="true"' : ""}>${label}</button>`).join("")}
      </div>
      <label class="its-field its-text-field"><span>Nội dung <small>{filename} · {index} · {date}</small></span><textarea rows="3" data-layer-prop="text" placeholder="Nhập chữ trên ảnh…">${escapeHtml(layer.text)}</textarea></label>
      <div class="its-field-grid">
        <label class="its-field its-font-field"><span>Font quốc tế</span><select data-layer-prop="font">${fontOptions(layer.font)}</select></label>
        <label class="its-field its-weight-field"><span>Độ đậm</span><select data-layer-prop="weight"><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option></select></label>
      </div>
      <label class="its-range"><span>Cỡ chữ <b data-value-for="size">${layer.size.toFixed(1)}%</b></span><input type="range" min="0.6" max="12" step="0.1" value="${layer.size}" data-layer-prop="size"></label>
      <div class="its-quick-style">
        <label title="Màu chữ"><input type="color" value="${layer.color}" data-layer-prop="color"><span>Màu chữ</span></label>
        <label title="Viền chữ"><input type="color" value="${layer.stroke}" data-layer-prop="stroke"><span>Màu viền</span></label>
        <button type="button" data-action="toggle-layer" data-prop="italic" class="${layer.italic ? "is-active" : ""}"><i>I</i> Nghiêng</button>
        <button type="button" data-action="toggle-layer" data-prop="uppercase" class="${layer.uppercase ? "is-active" : ""}">AA Viết hoa</button>
      </div>
      <div class="its-position-grid" aria-label="Vị trí chữ">
        ${[[0.12, 0.16, "↖"], [0.5, 0.16, "↑"], [0.88, 0.16, "↗"], [0.12, 0.5, "←"], [0.5, 0.5, "•"], [0.88, 0.5, "→"], [0.12, 0.84, "↙"], [0.5, 0.84, "↓"], [0.88, 0.84, "↘"]].map(([x, y, icon]) => `<button type="button" data-action="position" data-x="${x}" data-y="${y}">${icon}</button>`).join("")}
      </div>
      <details class="its-advanced">
        <summary>Chỉnh nâng cao</summary>
        <div class="its-advanced-body">
          <div class="its-image-color"><div><b>Màu & ánh sáng ảnh</b><label><input type="checkbox" data-image-prop="enabled"${imageStyle.enabled ? " checked" : ""}> Bật chỉnh ảnh</label></div>
            <label class="its-range"><span>Độ sáng <b>${Math.round(imageStyle.brightness * 100)}%</b></span><input type="range" min="0.5" max="1.5" step="0.01" value="${imageStyle.brightness}" data-image-prop="brightness"></label>
            <label class="its-range"><span>Tương phản <b>${Math.round(imageStyle.contrast * 100)}%</b></span><input type="range" min="0.5" max="1.6" step="0.01" value="${imageStyle.contrast}" data-image-prop="contrast"></label>
            <label class="its-range"><span>Bão hòa <b>${Math.round(imageStyle.saturation * 100)}%</b></span><input type="range" min="0" max="1.8" step="0.01" value="${imageStyle.saturation}" data-image-prop="saturation"></label>
            <div class="its-tint-row"><label><input type="color" value="${imageStyle.tint}" data-image-prop="tint"> Màu phủ</label><label class="its-range"><span>Cường độ <b>${Math.round(imageStyle.tintOpacity * 100)}%</b></span><input type="range" min="0" max="0.65" step="0.01" value="${imageStyle.tintOpacity}" data-image-prop="tintOpacity"></label></div>
          </div>
          <label class="its-range"><span>Độ rộng dòng <b data-value-for="maxWidth">${Math.round(layer.maxWidth * 100)}%</b></span><input type="range" min="0.2" max="0.94" step="0.01" value="${layer.maxWidth}" data-layer-prop="maxWidth"></label>
          <label class="its-range"><span>Độ dày viền <b data-value-for="strokeWidth">${layer.strokeWidth.toFixed(2)}%</b></span><input type="range" min="0" max="0.5" step="0.01" value="${layer.strokeWidth}" data-layer-prop="strokeWidth"></label>
          <label class="its-range"><span>Bóng chữ <b data-value-for="shadow">${Math.round(layer.shadow * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value="${layer.shadow}" data-layer-prop="shadow"></label>
          <label class="its-range"><span>Độ trong <b data-value-for="opacity">${Math.round(layer.opacity * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.01" value="${layer.opacity}" data-layer-prop="opacity"></label>
          <div class="its-checks"><label><input type="checkbox" data-layer-prop="autoContrast"${layer.autoContrast ? " checked" : ""}>Tự tương phản</label><label><input type="checkbox" data-layer-prop="background"${layer.background ? " checked" : ""}>Nền mờ sau chữ</label></div>
          <label class="its-range"><span>Lớp tối toàn ảnh <b data-value-setting="overlay">${Math.round(settings.overlay * 100)}%</b></span><input type="range" min="0" max="0.6" step="0.01" value="${settings.overlay}" data-setting="overlay"></label>
          <label class="its-field"><span>Hậu tố tên file</span><input type="text" value="${escapeHtml(settings.suffix)}" data-setting="suffix"></label>
        </div>
      </details>
      <div class="its-inspector-actions">
        ${settings.editMode === "current" ? '<button type="button" data-action="copy-current-to-all">Áp dụng kiểu này cho tất cả</button><button type="button" data-action="reset-current">Bỏ chỉnh riêng</button>' : '<button type="button" data-action="filename-title">Lấy tên file làm tiêu đề</button>'}
      </div>
      <div class="its-shortcuts"><span>← → đổi ảnh</span><span>Kéo chữ trực tiếp</span><span>Ctrl+Z hoàn tác</span></div>`;
    const weight = inspector.querySelector('[data-layer-prop="weight"]');
    if (weight) weight.value = String(layer.weight);
    const aiProvider = inspector.querySelector('[data-setting="aiProvider"]');
    const aiScope = inspector.querySelector('[data-setting="aiScope"]');
    if (aiProvider) aiProvider.value = settings.aiProvider;
    if (aiScope) aiScope.value = settings.aiScope;
  }

  function renderLibrary() {
    if (!root) return;
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
          <div><strong>${escapeHtml(item.name.replace(/\.[^.]+$/, ""))}</strong><small>${item.width ? `${item.width}×${item.height}` : "Đang đọc…"}</small></div>
        </article>`;
      }).join("");
    }
    if (empty) empty.hidden = state.items.length > 0;
    root.querySelector("[data-page-label]").textContent = state.items.length ? `${state.page + 1} / ${pages}` : "0 / 0";
    root.querySelector("[data-library-summary]").textContent = state.items.length ? `${filtered.length.toLocaleString("vi-VN")} / ${state.items.length.toLocaleString("vi-VN")} ảnh` : "Chưa có ảnh";
    root.querySelector("[data-stat-images]").textContent = state.items.length.toLocaleString("vi-VN");
    root.querySelector("[data-stat-selected]").textContent = state.selectedIds.size.toLocaleString("vi-VN");
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
    if (imageCache.has(item.id)) return imageCache.get(item.id);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        item.width = image.naturalWidth;
        item.height = image.naturalHeight;
        resolve(image);
      };
      image.onerror = () => reject(new Error(`Không đọc được ${item.name}`));
      image.src = ensureObjectUrl(item);
    });
    imageCache.set(item.id, promise);
    if (imageCache.size > 4) {
      const oldest = imageCache.keys().next().value;
      if (oldest !== item.id) imageCache.delete(oldest);
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
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sx = clamp((image.naturalWidth - sourceWidth) * focusX, 0, Math.max(0, image.naturalWidth - sourceWidth));
    const sy = clamp((image.naturalHeight - sourceHeight) * focusY, 0, Math.max(0, image.naturalHeight - sourceHeight));
    ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, width, height);
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
    if (!text) {
      if (collectHit) hitBoxes.delete(slot);
      return;
    }
    if (layer.uppercase) text = text.toLocaleUpperCase();
    const size = Math.max(8, width * (Number(layer.size) / 100));
    const family = String(layer.font || "Inter").replace(/["']/g, "");
    ctx.save();
    ctx.globalAlpha = clamp(layer.opacity, 0.05, 1);
    ctx.font = `${layer.italic ? "italic " : ""}${Number(layer.weight) || 600} ${size}px "${family}", sans-serif`;
    ctx.textAlign = layer.align || "center";
    ctx.textBaseline = "middle";
    const maxWidth = width * clamp(layer.maxWidth, 0.16, 0.98);
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = size * 1.16;
    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    const x = width * clamp(layer.x, 0.02, 0.98);
    const y = height * clamp(layer.y, 0.04, 0.96);
    const widest = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line || " ").width)));
    const brightness = layer.autoContrast ? sampleBrightness(ctx, x, y, width, height) : 0;
    const fill = layer.autoContrast ? (brightness > 172 ? "#111716" : "#ffffff") : layer.color;
    const stroke = layer.autoContrast ? (brightness > 172 ? "rgba(255,255,255,.78)" : "rgba(8,14,18,.82)") : layer.stroke;
    const boxLeft = layer.align === "left" ? x : layer.align === "right" ? x - widest : x - widest / 2;
    if (layer.background) {
      const padX = size * 0.45;
      const padY = size * 0.24;
      ctx.fillStyle = brightness > 172 ? "rgba(255,255,255,.62)" : "rgba(4,9,13,.5)";
      ctx.beginPath();
      ctx.roundRect(boxLeft - padX, y - totalHeight / 2 - padY, widest + padX * 2, totalHeight + padY * 2, size * 0.18);
      ctx.fill();
    }
    ctx.shadowColor = `rgba(0,0,0,${clamp(layer.shadow, 0, 1) * 0.72})`;
    ctx.shadowBlur = size * clamp(layer.shadow, 0, 1) * 0.28;
    ctx.shadowOffsetY = size * clamp(layer.shadow, 0, 1) * 0.08;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.lineWidth = width * clamp(layer.strokeWidth, 0, 1) / 100;
    lines.forEach((line, index) => {
      const lineY = y - totalHeight / 2 + lineHeight * (index + 0.5);
      if (ctx.lineWidth > 0) ctx.strokeText(line, x, lineY, maxWidth);
      ctx.fillText(line, x, lineY, maxWidth);
    });
    if (collectHit) hitBoxes.set(slot, { left: boxLeft - size * 0.4, top: y - totalHeight / 2 - size * 0.3, right: boxLeft + widest + size * 0.4, bottom: y + totalHeight / 2 + size * 0.3 });
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
    if (imageStyle.enabled) ctx.filter = `brightness(${clamp(imageStyle.brightness, 0.5, 1.5)}) contrast(${clamp(imageStyle.contrast, 0.5, 1.6)}) saturate(${clamp(imageStyle.saturation, 0, 1.8)})`;
    drawCover(ctx, image, width, height, item.focusX, item.focusY);
    ctx.filter = "none";
    if (imageStyle.enabled && imageStyle.tintOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(imageStyle.tintOpacity, 0, 0.65);
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = imageStyle.tint;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (state.settings.overlay > 0) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgba(3,8,12,${state.settings.overlay * 0.35})`);
      gradient.addColorStop(0.5, `rgba(3,8,12,${state.settings.overlay * 0.12})`);
      gradient.addColorStop(1, `rgba(3,8,12,${state.settings.overlay * 0.72})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    for (const slot of ["title", "subtitle", "footer"]) {
      const layer = layerFor(item, slot);
      await ensureFont(layer.font, layer.weight);
      drawTextLayer(ctx, width, height, item, slot, layer, preview);
    }
    if (preview && state.settings.safeZone) {
      ctx.save();
      ctx.strokeStyle = "rgba(102,238,255,.58)";
      ctx.lineWidth = Math.max(1, width * 0.0012);
      ctx.setLineDash([width * 0.008, width * 0.006]);
      ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
      ctx.restore();
    }
    ctx.restore();
  }

  function schedulePreview() {
    if (!root || !previewCanvas || !previewContext) return;
    const item = activeItem();
    updateStageMeta();
    if (!item) return;
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => {
    const token = ++renderToken;
    const preset = outputPreset();
    const width = Math.min(1280, preset.width);
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
        width: 0,
        height: 0,
        focusX: 0.5,
        focusY: 0.5,
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
    if (data.template) state.template = { ...clone(DEFAULT_TEMPLATE), ...data.template };
    if (data.settings) state.settings = { ...initialSettings(), ...data.settings };
    const map = new Map((data.images || []).map((entry) => [entry.name, entry]));
    state.items.forEach((item) => {
      const saved = map.get(item.name) || map.get(item.name.split(/[\\/]/).pop());
      if (!saved) return;
      item.overrides = saved.overrides || {};
      item.outputBaseName = saved.outputBaseName || "";
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

  function setLayerProperty(property, rawValue, element) {
    const item = activeItem();
    const target = editableLayer(item, state.activeSlot);
    let value = rawValue;
    if (["size", "weight", "maxWidth", "strokeWidth", "shadow", "opacity", "x", "y"].includes(property)) value = Number(rawValue);
    if (["autoContrast", "background", "italic", "uppercase"].includes(property)) value = Boolean(rawValue);
    target[property] = value;
    if (property === "font") ensureFont(value, layerFor(item, state.activeSlot).weight).then(schedulePreview);
    const label = root.querySelector(`[data-value-for="${property}"]`);
    if (label) {
      if (property === "size" || property === "strokeWidth") label.textContent = `${Number(value).toFixed(property === "size" ? 1 : 2)}%`;
      else if (property === "maxWidth" || property === "shadow" || property === "opacity") label.textContent = `${Math.round(Number(value) * 100)}%`;
    }
    if (element?.matches("textarea") && state.settings.editMode === "current") item.overrides[state.activeSlot] ||= {};
    schedulePreview();
    persistSettings();
  }

  function setImageStyleProperty(property, rawValue) {
    const target = editableImageStyle(activeItem());
    target[property] = property === "enabled" ? Boolean(rawValue) : (property === "tint" ? rawValue : Number(rawValue));
    schedulePreview();
    persistSettings();
  }

  function setSetting(property, rawValue) {
    let value = rawValue;
    if (["quality", "maxMB", "overlay", "zipChunk"].includes(property)) value = Number(rawValue);
    if (["safeZone", "aiSubtitle", "aiRename", "aiColor"].includes(property)) value = Boolean(rawValue);
    state.settings[property] = value;
    const label = root.querySelector(`[data-value-setting="${property}"]`);
    if (label && property === "overlay") label.textContent = `${Math.round(Number(value) * 100)}%`;
    if (property === "output") schedulePreview();
    else if (property === "overlay" || property === "safeZone") schedulePreview();
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
      version: 1,
      savedAt: new Date().toISOString(),
      template: state.template,
      settings: state.settings,
      images: state.items.map((item) => ({ name: item.name, outputBaseName: item.outputBaseName || "", overrides: item.overrides, focusX: item.focusX, focusY: item.focusY }))
    };
  }

  function exportProject() {
    downloadBlob(new Blob([JSON.stringify(projectData(), null, 2)], { type: "application/json" }), `HH-Text-Image-${new Date().toISOString().slice(0, 10)}.json`);
    notify("Đã lưu project. File ảnh gốc vẫn nằm trên máy của bạn.", "success");
  }

  async function importProject(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== "hh-image-text-project") throw new Error("Không đúng định dạng project");
      pushHistory();
      state.pendingProject = data;
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
    if (dialog) dialog.hidden = !show;
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

  async function runAiTextBatch() {
    const targets = aiTargetItems();
    if (!targets.length) return notify("Hãy thêm hoặc chọn ảnh trước khi dùng AI.", "error");
    if (state.ai.running) return;
    pushHistory();
    state.ai = { running: true, cancel: false, done: 0, total: targets.length };
    renderInspector();
    notify(`AI bắt đầu phân tích ${targets.length.toLocaleString("vi-VN")} ảnh theo từng nhóm.`, "info");
    try {
      for (let offset = 0; offset < targets.length; offset += 20) {
        if (state.ai.cancel) break;
        const chunk = targets.slice(offset, offset + 20);
        const attachment = await contactSheet(chunk);
        const context = chunk.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
        const response = await fetch("/api/modules/image-text/actions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            actionType: "image-text-batch",
            input: state.settings.aiPrompt,
            meta: {
              provider: state.settings.aiProvider,
              requireProvider: true,
              allowProviderFallback: state.settings.aiProvider === "auto",
              context,
              attachments: [{ mimeType: "image/jpeg", data: attachment }]
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `AI backend phản hồi HTTP ${response.status}`);
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
      notify(state.ai.cancel ? `Đã dừng sau ${state.ai.done}/${state.ai.total} ảnh.` : `AI đã viết chữ riêng cho ${state.ai.done.toLocaleString("vi-VN")} ảnh. Bạn vẫn có thể chỉnh từng ảnh.`, state.ai.cancel ? "info" : "success");
    } catch (error) {
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
      pushHistory();
      state.activeSlot = slot;
      dragState = { pointerId: event.pointerId, slot };
      previewCanvas.setPointerCapture(event.pointerId);
      renderInspector();
    });
    previewCanvas.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const rect = previewCanvas.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0.02, 0.98);
      const y = clamp((event.clientY - rect.top) / rect.height, 0.04, 0.96);
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
    const fileInput = root.querySelector("[data-file-input]");
    const folderInput = root.querySelector("[data-folder-input]");
    const fontInput = root.querySelector("[data-font-input]");
    const projectInput = root.querySelector("[data-project-input]");
    fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
    folderInput.addEventListener("change", () => { addFiles(folderInput.files); folderInput.value = ""; });
    fontInput.addEventListener("change", () => { addLocalFonts(fontInput.files); fontInput.value = ""; });
    projectInput.addEventListener("change", () => { if (projectInput.files[0]) importProject(projectInput.files[0]); projectInput.value = ""; });

    const dropzone = root.querySelector("[data-dropzone]");
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
    dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
    dropzone.addEventListener("click", () => folderInput.click());
    dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") folderInput.click(); });

    root.addEventListener("focusin", (event) => {
      if (event.target.matches("[data-layer-prop],[data-image-prop],[data-setting]")) beforeEditSnapshot = snapshotState();
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
      else if (name === "sort") { state.sort = state.sort === "asc" ? "desc" : "asc"; renderLibrary(); }
      else if (name === "prev-page" || name === "next-page") { state.page += name === "prev-page" ? -1 : 1; renderLibrary(); }
      else if (name === "prev-image" || name === "next-image") navigateImage(name === "prev-image" ? -1 : 1);
      else if (name === "select-visible") {
        const visible = pagedItems().items;
        const allSelected = visible.every((item) => state.selectedIds.has(item.id));
        visible.forEach((item) => allSelected ? state.selectedIds.delete(item.id) : state.selectedIds.add(item.id));
        renderLibrary();
      }
      else if (name === "preset") applyPreset(action.dataset.preset);
      else if (name === "slot") { state.activeSlot = action.dataset.slot; renderInspector(); }
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
        pushHistory(); state.template[state.activeSlot] = layerFor(item, state.activeSlot); delete item.overrides[state.activeSlot]; state.settings.editMode = "all";
        renderInspector(); schedulePreview(); notify("Đã áp dụng kiểu chữ này cho toàn bộ ảnh.", "success");
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
      else if (name === "cancel-export") state.cancelExport = true;
    });
    bindCanvas();

    keyHandler = (event) => {
      if (!root?.isConnected || event.target.matches("input,textarea,select,[contenteditable]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); exportProject(); }
      else if (event.key === "ArrowLeft") navigateImage(-1);
      else if (event.key === "ArrowRight") navigateImage(1);
    };
    global.addEventListener("keydown", keyHandler);
  }

  function mount(target) {
    if (!target) return;
    unmount();
    host = target;
    restoreSettings();
    buildShell();
    bindEvents();
    renderAll({ keepPage: true });
    global.dispatchEvent(new CustomEvent("hh:image-text-ready"));
  }

  function unmount() {
    if (keyHandler) global.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    state.items.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url); });
    state.items = [];
    state.selectedIds.clear();
    state.activeId = "";
    state.history = [];
    state.future = [];
    imageCache.clear();
    hitBoxes.clear();
    renderToken += 1;
    if (host) host.replaceChildren();
    host = null;
    root = null;
    previewCanvas = null;
    previewContext = null;
  }

  global.HHImageTextStudio = Object.freeze({ mount, unmount, version: "1.0.0" });
})(window);
