(() => {
  "use strict";

  const TOOL = "Photo Editor";
  const STORAGE_KEY = "hh.photo.pro.v2";
  const HISTORY_LIMIT = 36;
  const rootWindow = typeof window === "undefined" ? globalThis : window;
  const base = rootWindow.HHMediaDesign;
  const state = { root: null, project: null, past: [], future: [], autosaveTimer: 0, observer: null, view: "edit" };
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function defaultLayer(kind = "raster", name) {
    return {
      id: uid("layer"), kind, name: name || ({ raster: "Layer pixel", group: "Nhóm layer", adjustment: "Điều chỉnh", smart: "Smart Object" }[kind] || "Layer"),
      visible: true, locked: false, opacity: 100, blend: "source-over", parentId: null, clipTo: null,
      mask: null, smartFilters: [], adjustment: kind === "adjustment" ? { type: "curves", amount: 0 } : null,
      source: null, createdAt: new Date().toISOString()
    };
  }

  function createProject(seed = {}) {
    const background = defaultLayer("raster", "Nền");
    return {
      format: "HH Media Project", version: 2, id: seed.id || uid("hhmedia"), name: seed.name || "Photo project", updatedAt: new Date().toISOString(),
      artboards: seed.artboards?.length ? seed.artboards : [{ id: uid("artboard"), name: "Artboard 01", width: 1920, height: 1080, background: "#ffffff" }],
      activeArtboardId: seed.activeArtboardId || null, layers: seed.layers?.length ? seed.layers : [background], selectedLayerId: seed.selectedLayerId || background.id,
      brushes: seed.brushes?.length ? seed.brushes : [{ id: "soft-round", name: "Tròn mềm", size: 36, hardness: 72, spacing: 18, opacity: 100 }],
      presets: seed.presets?.length ? seed.presets : [], batch: seed.batch || [], snapshots: seed.snapshots || [], capabilities: { localSubjectSelection: true, cloudAI: false, ...seed.capabilities }
    };
  }

  function normalizeProject(value) {
    const project = createProject(value || {});
    project.activeArtboardId ||= project.artboards[0]?.id || null;
    if (!project.layers.some((layer) => layer.id === project.selectedLayerId)) project.selectedLayerId = project.layers.at(-1)?.id || null;
    project.layers = project.layers.slice(0, 200).map((layer) => ({ ...defaultLayer(layer.kind || "raster", layer.name), ...layer, smartFilters: Array.isArray(layer.smartFilters) ? layer.smartFilters.slice(0, 30) : [] }));
    project.batch = project.batch.slice(0, 100).map((job) => ({ id: job.id || uid("batch"), status: job.status || "waiting", ...job }));
    return project;
  }

  function readProject() {
    try { return normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch { return createProject(); }
  }

  function projectForStorage(project) {
    const safe = clone(project);
    safe.layers.forEach((layer) => { if (layer.source && !/^https?:\/\//i.test(layer.source)) layer.source = null; });
    return safe;
  }

  function persist() {
    if (!state.project || typeof localStorage === "undefined") return;
    state.project.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectForStorage(state.project)));
  }

  function snapshot(label) {
    if (!state.project) return;
    state.past.push({ label, project: clone(state.project) });
    if (state.past.length > HISTORY_LIMIT) state.past.shift();
    state.future = [];
  }

  function mutate(label, operation) {
    if (!state.project) return false;
    snapshot(label);
    operation(state.project);
    state.project = normalizeProject(state.project);
    scheduleSave();
    renderWorkspace();
    return true;
  }

  function undo() {
    const previous = state.past.pop();
    if (!previous) return false;
    state.future.push({ label: "Redo", project: clone(state.project) });
    state.project = normalizeProject(previous.project); persist(); renderWorkspace(); return true;
  }

  function redo() {
    const next = state.future.pop();
    if (!next) return false;
    state.past.push({ label: "Undo", project: clone(state.project) });
    state.project = normalizeProject(next.project); persist(); renderWorkspace(); return true;
  }

  function scheduleSave() {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(persist, 500);
  }

  function selectedLayer() { return state.project?.layers.find((layer) => layer.id === state.project.selectedLayerId) || null; }
  function layerTree(layers, parentId = null) { return layers.filter((layer) => layer.parentId === parentId); }

  function toolbarMarkup() {
    return `<section class="photo-pro-header" aria-label="Photo Editor Pro">
      <div><span class="photo-pro-mark">PS</span><div><strong>Photo Editor Pro</strong><small data-photo-project-name>${escapeHtml(state.project.name)}</small></div></div>
      <nav aria-label="Không gian làm việc"><button data-photo-view="edit" class="is-active">${icon("layers-3")}Biên tập</button><button data-photo-view="adjust">${icon("sliders-horizontal")}Điều chỉnh</button><button data-photo-view="batch">${icon("list-video")}Batch</button><button data-photo-view="export">${icon("share-2")}Xuất</button></nav>
      <div class="photo-pro-header-actions"><span><i></i>Tự động lưu cục bộ</span><button data-photo-action="undo" title="Hoàn tác Ctrl+Z">${icon("undo-2")}</button><button data-photo-action="redo" title="Làm lại Ctrl+Y">${icon("redo-2")}</button><button data-photo-action="snapshot">${icon("history")}Snapshot</button></div>
    </section>`;
  }

  function toolRailMarkup() {
    return `<aside class="photo-pro-rail" aria-label="Công cụ ảnh">
      <button data-photo-action="select-subject" title="Chọn chủ thể cục bộ">${icon("scan-face")}</button><button data-photo-action="refine-edge" title="Tinh chỉnh biên mask">${icon("lasso-select")}</button><button data-photo-action="remove-background" title="Xóa nền bằng mask cục bộ">${icon("scissors")}</button><span></span>
      <button data-photo-action="healing" title="Healing Brush">${icon("bandage")}</button><button data-photo-action="clone-stamp" title="Clone Stamp">${icon("stamp")}</button><button data-photo-action="dodge-burn" title="Dodge and Burn">${icon("sun-medium")}</button><button data-photo-action="liquify" title="Liquify non-destructive">${icon("waves")}</button><span></span>
      <button data-photo-action="new-layer" title="Layer mới">${icon("plus")}</button><button data-photo-action="new-group" title="Nhóm layer">${icon("folder-plus")}</button><button data-photo-action="new-adjustment" title="Adjustment Layer">${icon("circle")}</button><button data-photo-action="smart-object" title="Chuyển Smart Object">${icon("box")}</button>
    </aside>`;
  }

  function layerMarkup(layer, depth = 0) {
    const children = layerTree(state.project.layers, layer.id);
    const hasChildren = children.length > 0;
    return `<li class="photo-pro-layer ${layer.id === state.project.selectedLayerId ? "is-selected" : ""}" style="--depth:${depth}" data-photo-layer-id="${layer.id}">
      <button data-photo-action="toggle-layer" data-id="${layer.id}" title="Hiện hoặc ẩn">${icon(layer.visible ? "eye" : "eye-off")}</button>
      <button class="photo-pro-layer-name" data-photo-action="select-layer" data-id="${layer.id}">${icon(layer.kind === "group" ? "folder" : layer.kind === "adjustment" ? "sliders-horizontal" : layer.kind === "smart" ? "box" : "image")}${escapeHtml(layer.name)}${layer.mask ? `<em>M</em>` : ""}${layer.clipTo ? `<em>C</em>` : ""}</button>
      <button data-photo-action="lock-layer" data-id="${layer.id}" title="Khóa layer">${icon(layer.locked ? "lock" : "unlock")}</button>
      ${hasChildren ? `<ul>${children.map((child) => layerMarkup(child, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  }

  function layersMarkup() {
    const roots = layerTree(state.project.layers);
    const active = selectedLayer();
    return `<section class="photo-pro-panel" data-photo-panel="layers"><header><strong>Layers</strong><div><button data-photo-action="new-layer" title="Layer mới">${icon("plus")}</button><button data-photo-action="delete-layer" title="Xóa layer">${icon("trash-2")}</button></div></header>
      <div class="photo-pro-mix"><label>Blend<select data-photo-field="blend"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="soft-light">Soft Light</option><option value="color-dodge">Color Dodge</option><option value="color-burn">Color Burn</option><option value="difference">Difference</option></select></label><label>Opacity<input type="range" min="0" max="100" data-photo-field="opacity" value="${active?.opacity ?? 100}"></label></div>
      <label class="photo-pro-search">${icon("search")}<input type="search" data-photo-search placeholder="Tìm layer, smart filter..."></label><ul class="photo-pro-layer-list">${roots.map((layer) => layerMarkup(layer)).join("") || "<li class=\"photo-pro-empty\">Chưa có layer</li>"}</ul>
    </section>`;
  }

  function inspectorMarkup() {
    const layer = selectedLayer();
    const filters = layer?.smartFilters || [];
    return `<section class="photo-pro-panel photo-pro-inspector" data-photo-panel="inspector"><header><strong>Thuộc tính</strong><button data-photo-action="add-smart-filter">${icon("wand-sparkles")}</button></header>
      ${layer ? `<div class="photo-pro-inspector-title">${icon(layer.kind === "smart" ? "box" : "image")}<div><b>${escapeHtml(layer.name)}</b><small>${escapeHtml(layer.kind)}${layer.mask ? " · Mask" : ""}</small></div></div>
      <label>Tên layer<input data-photo-name value="${escapeHtml(layer.name)}"></label><div class="photo-pro-grid"><label>X<input data-photo-transform="x" type="number" value="0"></label><label>Y<input data-photo-transform="y" type="number" value="0"></label><label>Rộng<input data-photo-transform="width" type="number" value="1920"></label><label>Cao<input data-photo-transform="height" type="number" value="1080"></label></div>
      <section class="photo-pro-mask"><div><b>Mask & Clipping</b><button data-photo-action="toggle-mask">${layer.mask ? "Xóa mask" : "Tạo mask"}</button></div><div><button data-photo-action="clip-layer">${layer.clipTo ? "Bỏ clipping" : "Clipping mask"}</button><button data-photo-action="refine-edge">Refine edge</button></div></section>
      <section class="photo-pro-filters"><div><b>Smart Filters</b><button data-photo-action="add-smart-filter">${icon("plus")}</button></div>${filters.map((filter) => `<div data-photo-filter-id="${filter.id}"><span>${icon("sparkles")}${escapeHtml(filter.type)}</span><button data-photo-action="toggle-filter" data-id="${filter.id}">${filter.enabled ? "Bật" : "Tắt"}</button><button data-photo-action="remove-filter" data-id="${filter.id}" title="Xóa">${icon("x")}</button></div>`).join("") || "<p>Chưa có Smart Filter.</p>"}</section>` : "<p class=\"photo-pro-empty\">Chọn một layer để chỉnh sửa.</p>"}
    </section>`;
  }

  function workspaceMarkup() {
    const artboard = state.project.artboards.find((item) => item.id === state.project.activeArtboardId) || state.project.artboards[0];
    return `<section class="photo-pro-workspace"><div class="photo-pro-canvas-top"><label>Artboard<select data-photo-artboard>${state.project.artboards.map((item) => `<option value="${item.id}" ${item.id === artboard.id ? "selected" : ""}>${escapeHtml(item.name)} · ${item.width}×${item.height}</option>`).join("")}</select></label><button data-photo-action="new-artboard">${icon("frame")}Artboard</button><span>${state.past.length} bước hoàn tác</span></div><div class="photo-pro-canvas-stage"><div class="photo-pro-canvas-card" style="aspect-ratio:${artboard.width}/${artboard.height};background:${artboard.background}"><div class="photo-pro-canvas-grid"></div><div class="photo-pro-canvas-empty">${icon("image-plus")}<b>Kéo ảnh vào canvas hoặc dùng File → Open</b><small>Layer được giữ nguyên không phá hủy. Media lớn nên dùng proxy.</small></div></div></div><div class="photo-pro-status"><span><i></i>${artboard.width} × ${artboard.height}px</span><span>${state.project.layers.length} layer</span><span>Local engine</span></div></section>`;
  }

  function actionsMarkup() {
    return `<section class="photo-pro-drawer" data-photo-drawer hidden><header><strong data-photo-drawer-title>Công cụ</strong><button data-photo-action="close-drawer">${icon("x")}</button></header><div data-photo-drawer-body></div></section>`;
  }

  function renderWorkspace() {
    if (!state.root?.isConnected || !state.project) return;
    const host = $(state.root, "[data-photo-pro-shell]");
    if (!host) return;
    host.innerHTML = `${toolbarMarkup()}<main class="photo-pro-main">${toolRailMarkup()}${layersMarkup()}${workspaceMarkup()}${inspectorMarkup()}</main>${actionsMarkup()}<div class="photo-pro-toast" data-photo-toast hidden></div>`;
    syncLegacyFields();
    rootWindow.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.75 } });
  }

  function toast(message, kind = "info") { const node = $(state.root, "[data-photo-toast]"); if (!node) return; node.textContent = message; node.dataset.kind = kind; node.hidden = false; clearTimeout(node._timer); node._timer = setTimeout(() => { node.hidden = true; }, 2600); }
  function invokeLegacy(action) { $(state.root, `[data-adv-action="${action}"]`)?.click(); }
  function syncLegacyFields() { const layer = selectedLayer(); const blend = $(state.root, "[data-photo-field=blend]"); if (blend && layer) blend.value = layer.blend; }

  function openDrawer(title, body) { const drawer = $(state.root, "[data-photo-drawer]"); if (!drawer) return; $(drawer, "[data-photo-drawer-title]").textContent = title; $(drawer, "[data-photo-drawer-body]").innerHTML = body; drawer.hidden = false; drawer.querySelector("button,input,select,textarea")?.focus(); rootWindow.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } }); }
  function closeDrawer() { const drawer = $(state.root, "[data-photo-drawer]"); if (drawer) drawer.hidden = true; }

  function localTool(kind) {
    const layer = selectedLayer();
    if (!layer) return toast("Hãy chọn một layer trước.", "error");
    const names = { healing: "Healing Brush", "clone-stamp": "Clone Stamp", "dodge-burn": "Dodge & Burn", liquify: "Liquify" };
    mutate(names[kind], (project) => {
      const target = project.layers.find((item) => item.id === project.selectedLayerId);
      target.smartFilters.push({ id: uid("filter"), type: names[kind], enabled: true, settings: kind === "liquify" ? { strength: 18, radius: 120 } : { opacity: 65, brush: project.brushes[0]?.id } });
    });
    if (kind === "clone-stamp" || kind === "healing") invokeLegacy("editor-tool-clone");
    toast(`${names[kind]} đã được thêm như Smart Filter có thể tắt hoặc xóa.`, "success");
  }

  function runAction(action, target) {
    const id = target?.dataset?.id;
    if (action === "undo") return undo() || toast("Không còn thao tác để hoàn tác.");
    if (action === "redo") return redo() || toast("Không còn thao tác để làm lại.");
    if (action === "snapshot") return mutate("Snapshot", (project) => project.snapshots.unshift({ id: uid("snapshot"), name: `Snapshot ${new Date().toLocaleTimeString("vi-VN")}`, savedAt: new Date().toISOString(), project: projectForStorage(project) })) && toast("Đã lưu snapshot cục bộ.", "success");
    if (action === "new-layer") { mutate("Layer mới", (project) => { const layer = defaultLayer(); project.layers.push(layer); project.selectedLayerId = layer.id; }); invokeLegacy("editor-add-raster"); return; }
    if (action === "new-group") return mutate("Nhóm layer", (project) => { const group = defaultLayer("group"); project.layers.push(group); project.selectedLayerId = group.id; });
    if (action === "new-adjustment") return mutate("Adjustment Layer", (project) => { const layer = defaultLayer("adjustment", "Curves Adjustment"); project.layers.push(layer); project.selectedLayerId = layer.id; });
    if (action === "smart-object") return mutate("Smart Object", (project) => { const layer = project.layers.find((item) => item.id === project.selectedLayerId); if (layer) { layer.kind = "smart"; layer.name = `${layer.name} (Smart)`; } });
    if (action === "delete-layer") return mutate("Xóa layer", (project) => { project.layers = project.layers.filter((layer) => layer.id !== project.selectedLayerId); project.selectedLayerId = project.layers.at(-1)?.id || null; }) && invokeLegacy("editor-delete");
    if (action === "select-layer") return mutate("Chọn layer", (project) => { project.selectedLayerId = id; });
    if (action === "toggle-layer") return mutate("Ẩn hiện layer", (project) => { const layer = project.layers.find((item) => item.id === id); if (layer) layer.visible = !layer.visible; });
    if (action === "lock-layer") return mutate("Khóa layer", (project) => { const layer = project.layers.find((item) => item.id === id); if (layer) layer.locked = !layer.locked; });
    if (action === "toggle-mask") return mutate("Mask layer", (project) => { const layer = project.layers.find((item) => item.id === project.selectedLayerId); if (layer) layer.mask = layer.mask ? null : { id: uid("mask"), mode: "reveal", feather: 0, source: "manual" }; });
    if (action === "clip-layer") return mutate("Clipping mask", (project) => { const index = project.layers.findIndex((item) => item.id === project.selectedLayerId); const layer = project.layers[index]; if (layer) layer.clipTo = layer.clipTo ? null : project.layers[index - 1]?.id || null; });
    if (action === "add-smart-filter") return openDrawer("Thêm Smart Filter", `<div class="photo-pro-drawer-grid">${["Gaussian Blur", "High Pass", "Color Lookup", "Sharpen", "Vignette", "Noise Reduction"].map((name) => `<button data-photo-add-filter="${name}">${escapeHtml(name)}</button>`).join("")}</div>`);
    if (action === "toggle-filter") return mutate("Bật tắt Smart Filter", (project) => { const filter = project.layers.find((item) => item.id === project.selectedLayerId)?.smartFilters.find((item) => item.id === id); if (filter) filter.enabled = !filter.enabled; });
    if (action === "remove-filter") return mutate("Xóa Smart Filter", (project) => { const layer = project.layers.find((item) => item.id === project.selectedLayerId); if (layer) layer.smartFilters = layer.smartFilters.filter((filter) => filter.id !== id); });
    if (["healing", "clone-stamp", "dodge-burn", "liquify"].includes(action)) return localTool(action);
    if (action === "select-subject") return mutate("Chọn chủ thể cục bộ", (project) => { const layer = project.layers.find((item) => item.id === project.selectedLayerId); if (layer) layer.mask = { id: uid("mask"), mode: "estimated-subject", feather: 3, source: "local-estimate" }; }) && toast("Đã tạo mask ước lượng cục bộ. Hãy dùng Refine edge để chỉnh chính xác.", "success");
    if (action === "refine-edge") return openDrawer("Refine edge", `<label>Feather <input type="range" min="0" max="100" value="${selectedLayer()?.mask?.feather || 3}" data-photo-refine></label><p>Thiết lập này chỉ chỉnh mask cục bộ, không gọi dịch vụ AI.</p>`);
    if (action === "remove-background") return mutate("Xóa nền cục bộ", (project) => { const layer = project.layers.find((item) => item.id === project.selectedLayerId); if (layer) layer.mask = { id: uid("mask"), mode: "hide-background", feather: 4, source: "local-estimate" }; }) && toast("Đã tạo mask xóa nền dạng bản nháp cục bộ. Không có AI cloud được sử dụng.");
    if (action === "new-artboard") return mutate("Artboard mới", (project) => { const artboard = { id: uid("artboard"), name: `Artboard ${String(project.artboards.length + 1).padStart(2, "0")}`, width: 1080, height: 1080, background: "#ffffff" }; project.artboards.push(artboard); project.activeArtboardId = artboard.id; });
    if (action === "batch") return openDrawer("Batch processing", `<label>Chọn preset<select data-photo-batch-preset><option value="web">WebP tối ưu web</option><option value="social">Mạng xã hội 1080px</option><option value="archive">PNG lưu trữ</option></select></label><button data-photo-action="add-batch">Thêm job hiện tại</button><div class="photo-pro-batch-list">${state.project.batch.map((job) => `<p>${escapeHtml(job.name)}<b>${escapeHtml(job.status)}</b></p>`).join("") || "<p>Chưa có job.</p>"}</div>`);
    if (action === "add-batch") return mutate("Thêm Batch job", (project) => project.batch.push({ id: uid("batch"), name: project.name, preset: $(state.root, "[data-photo-batch-preset]")?.value || "web", status: "waiting", createdAt: new Date().toISOString() })) && toast("Đã thêm job vào hàng đợi cục bộ.", "success");
    if (action === "export-project") return exportProject();
    if (action === "import-project") return $(state.root, "[data-photo-import]")?.click();
    if (action === "close-drawer") return closeDrawer();
  }

  function exportProject() {
    const payload = JSON.stringify({ format: "HH Media Project", version: 2, exportedAt: new Date().toISOString(), project: projectForStorage(state.project) }, null, 2);
    if (typeof Blob === "undefined" || typeof document === "undefined") return payload;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([payload], { type: "application/json" })); link.download = `${state.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "project"}.hhmedia`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 500); toast("Đã đóng gói .hhmedia an toàn, không kèm đường dẫn tệp cục bộ.", "success");
  }

  async function importProject(file) {
    if (!file || file.size > 5 * 1024 * 1024) throw new Error("Tệp project phải nhỏ hơn 5 MB.");
    const payload = JSON.parse(await file.text());
    if (payload?.format !== "HH Media Project" || !payload.project) throw new Error("Tệp .hhmedia không hợp lệ.");
    snapshot("Trước khi nhập project"); state.project = normalizeProject(payload.project); persist(); renderWorkspace(); toast("Đã mở project .hhmedia.", "success");
  }

  function onClick(event) {
    const view = event.target.closest("[data-photo-view]")?.dataset.photoView;
    if (view) {
      state.view = view;
      $$(state.root, "[data-photo-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.photoView === view));
      if (view === "adjust") openDrawer("Adjustment layers", `<div class="photo-pro-drawer-grid"><button data-photo-action="new-adjustment">Curves</button><button data-photo-action="new-adjustment">Levels</button><button data-photo-action="new-adjustment">Hue / Saturation</button><button data-photo-action="new-adjustment">Color Balance</button></div>`);
      if (view === "batch") runAction("batch");
      if (view === "export") openDrawer("Export Center", `<p>Project sẽ được xuất dưới dạng .hhmedia. Bản đóng gói chỉ chứa cấu trúc project và URL HTTPS đã được phép.</p><button data-photo-action="export-project">Xuất .hhmedia</button><button data-photo-action="import-project">Mở .hhmedia</button>`);
      if (view === "edit") closeDrawer();
      return true;
    }
    const addFilter = event.target.closest("[data-photo-add-filter]");
    if (addFilter) { const type = addFilter.dataset.photoAddFilter; mutate("Thêm Smart Filter", (project) => project.layers.find((item) => item.id === project.selectedLayerId)?.smartFilters.push({ id: uid("filter"), type, enabled: true, settings: {} })); closeDrawer(); return true; }
    const action = event.target.closest("[data-photo-action]")?.dataset.photoAction;
    if (!action) return false;
    runAction(action, event.target.closest("[data-id]")); return true;
  }

  function onInput(event) {
    if (event.target.matches("[data-photo-search]")) { const query = event.target.value.toLowerCase(); $$(state.root, "[data-photo-layer]").forEach((row) => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query); }); return true; }
    if (event.target.matches("[data-photo-name]")) { const layer = selectedLayer(); if (layer) { layer.name = event.target.value.slice(0, 100); scheduleSave(); renderWorkspace(); } return true; }
    if (event.target.matches("[data-photo-field]")) { const layer = selectedLayer(); if (layer) { layer[event.target.dataset.photoField] = event.target.dataset.photoField === "opacity" ? clamp(event.target.value, 0, 100) : event.target.value; scheduleSave(); } return true; }
    if (event.target.matches("[data-photo-refine]")) { const layer = selectedLayer(); if (layer?.mask) { layer.mask.feather = clamp(event.target.value, 0, 100); scheduleSave(); } return true; }
    return false;
  }

  function onChange(event) {
    if (event.target.matches("[data-photo-artboard]")) return mutate("Chuyển artboard", (project) => { project.activeArtboardId = event.target.value; });
    if (event.target.matches("[data-photo-import]")) { importProject(event.target.files?.[0]).catch((error) => toast(error.message, "error")); return true; }
    return false;
  }

  function decorate(outer) {
    cleanup(); state.root = $(outer, "[data-adv-editor]"); if (!state.root) return;
    state.project = readProject(); state.root.classList.add("photo-pro");
    const shell = document.createElement("section"); shell.className = "photo-pro-shell"; shell.dataset.photoProShell = "";
    const body = $(state.root, ".mdx-editor-body");
    (body || state.root).prepend(shell);
    body?.classList.add("photo-pro-legacy-body");
    const input = document.createElement("input"); input.type = "file"; input.accept = ".hhmedia,application/json"; input.hidden = true; input.dataset.photoImport = ""; state.root.append(input);
    renderWorkspace();
    state.observer = new MutationObserver(() => { if (state.root?.isConnected) syncLegacyFields(); });
    state.observer.observe(state.root, { childList: true, subtree: true });
  }

  function cleanup() { clearTimeout(state.autosaveTimer); state.observer?.disconnect(); state.observer = null; state.root = null; state.project = null; state.past = []; state.future = []; state.view = "edit"; }

  rootWindow.HHPhotoEditorPro = { createProject, normalizeProject, projectForStorage, defaultLayer, HISTORY_LIMIT };
  if (!base) return;
  rootWindow.HHMediaDesign = {
    supports: (name) => name === TOOL || base.supports(name),
    render(outer, name) { base.render(outer, name); if (name === TOOL) decorate(outer); },
    cleanup() { cleanup(); base.cleanup?.(); },
    handleClick(event, outer, name) { if (name === TOOL && onClick(event)) return; return base.handleClick?.(event, outer, name); },
    handleInput(event, outer, name) { if (name === TOOL && onInput(event)) return; return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) { if (name === TOOL && onChange(event)) return; return base.handleChange?.(event, outer, name); }
  };

  addEventListener("keydown", (event) => {
    if (!state.root?.isConnected || !location.hash.includes("/media-design/photo-editor") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
    if (command && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    if (command && event.key.toLowerCase() === "s") { event.preventDefault(); exportProject(); }
  });
})();
