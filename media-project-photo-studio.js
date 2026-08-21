((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaProjectPhotoStudio = api;
})((globalScope) => {
  "use strict";

  const SCHEMA = "hh.media.project-photo.v1";
  const STORAGE_KEY = SCHEMA;
  const active = new Map();
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const formatBytes = (value) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : value < 1073741824 ? `${(value / 1048576).toFixed(2)} MB` : `${(value / 1073741824).toFixed(2)} GB`;
  const safeName = (value, fallback = "hh-media") => String(value || fallback).normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;

  function defaultRecipe() {
    return { exposure: 0, contrast: 100, saturation: 100, temperature: 0, blur: 0, grayscale: 0, rotation: 0, flipX: false, flipY: false, quality: 92, format: "image/webp" };
  }

  function normalizeRecipe(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      exposure: clamp(source.exposure, -3, 3), contrast: clamp(source.contrast || 100, 20, 220),
      saturation: clamp(source.saturation || 100, 0, 240), temperature: clamp(source.temperature, -100, 100),
      blur: clamp(source.blur, 0, 12), grayscale: clamp(source.grayscale, 0, 100),
      rotation: [0, 90, 180, 270].includes(Number(source.rotation)) ? Number(source.rotation) : 0,
      flipX: Boolean(source.flipX), flipY: Boolean(source.flipY), quality: clamp(source.quality || 92, 30, 100),
      format: ["image/png", "image/jpeg", "image/webp"].includes(source.format) ? source.format : "image/webp"
    };
  }

  function defaultState() {
    return {
      schema: SCHEMA, version: 1, projectTab: "overview", graphFilter: "all", selectedNode: "",
      photoTab: "develop", photoView: "fit", recipe: defaultRecipe(), selectedPhotoId: "",
      snapshots: [], recentProjects: [], lastSavedAt: "", updatedAt: now()
    };
  }

  function normalizeState(input) {
    const base = defaultState(), source = input && typeof input === "object" ? input : {};
    return {
      ...base, ...source, schema: SCHEMA, version: 1,
      projectTab: ["overview", "graph", "versions", "activity"].includes(source.projectTab) ? source.projectTab : "overview",
      photoTab: ["develop", "lighttable", "history", "export"].includes(source.photoTab) ? source.photoTab : "develop",
      recipe: normalizeRecipe(source.recipe), snapshots: Array.isArray(source.snapshots) ? source.snapshots.slice(-60) : [],
      recentProjects: Array.isArray(source.recentProjects) ? source.recentProjects.slice(-12) : [], updatedAt: now()
    };
  }

  function createStore(storage) {
    const target = storage || globalScope.localStorage;
    return {
      load() { try { return normalizeState(JSON.parse(target?.getItem?.(STORAGE_KEY) || "{}")); } catch (_) { return defaultState(); } },
      save(value) { const next = normalizeState(value); try { target?.setItem?.(STORAGE_KEY, JSON.stringify(next)); } catch (_) {} return next; }
    };
  }

  function recipeFilter(recipeInput) {
    const recipe = normalizeRecipe(recipeInput);
    const brightness = Math.round(100 * (2 ** recipe.exposure));
    const hue = Math.round(recipe.temperature * -0.16);
    return `brightness(${brightness}%) contrast(${recipe.contrast}%) saturate(${recipe.saturation}%) hue-rotate(${hue}deg) blur(${recipe.blur}px) grayscale(${recipe.grayscale}%)`;
  }

  function calculateHistogram(pixels, bins = 32) {
    const result = { red: Array(bins).fill(0), green: Array(bins).fill(0), blue: Array(bins).fill(0), luminance: Array(bins).fill(0), samples: 0 };
    if (!pixels?.length) return result;
    const step = Math.max(4, Math.ceil(pixels.length / 200000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += step) {
      const r = pixels[index] || 0, g = pixels[index + 1] || 0, b = pixels[index + 2] || 0;
      result.red[Math.min(bins - 1, Math.floor(r / 256 * bins))] += 1;
      result.green[Math.min(bins - 1, Math.floor(g / 256 * bins))] += 1;
      result.blue[Math.min(bins - 1, Math.floor(b / 256 * bins))] += 1;
      result.luminance[Math.min(bins - 1, Math.floor((.2126 * r + .7152 * g + .0722 * b) / 256 * bins))] += 1;
      result.samples += 1;
    }
    return result;
  }

  function histogramPath(values, width = 300, height = 86) {
    const max = Math.max(1, ...values);
    return values.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(1, values.length - 1) * width).toFixed(1)},${(height - value / max * height).toFixed(1)}`).join(" ");
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function checksum(file) {
    if (globalScope.crypto?.subtle && file?.arrayBuffer) {
      const digest = await globalScope.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    return `${file?.name || "asset"}-${file?.size || 0}-${file?.lastModified || 0}`;
  }

  function projectHealth(projectState, api) {
    return api?.calculateHealth?.(projectState) || { score: 100, status: "healthy", blockers: [], warnings: [], splitTotal: 100 };
  }

  function projectTabs(state) {
    return `<nav class="mpp-tabs" aria-label="Chế độ Project Core">${[["overview", "Tổng quan"], ["graph", "Media Graph"], ["versions", "Phiên bản"], ["activity", "Hoạt động"]].map(([id, label]) => `<button type="button" data-mpp-project-tab="${id}" class="${state.projectTab === id ? "is-active" : ""}">${label}</button>`).join("")}</nav>`;
  }

  function graphMarkup(projectState, state) {
    const nodes = (projectState.project.graph.nodes || []).slice(-28), edges = projectState.project.graph.edges || [];
    const filtered = state.graphFilter === "all" ? nodes : nodes.filter((node) => node.type === state.graphFilter || node.type === "project");
    return `<section class="mpp-graph-deck"><header><div><small>IDENTITY-BASED LINEAGE</small><h3>Media Graph · ${filtered.length} node</h3></div><label>Lọc<select data-mpp-graph-filter><option value="all">Tất cả</option><option value="project" ${state.graphFilter === "project" ? "selected" : ""}>Project</option><option value="asset" ${state.graphFilter === "asset" ? "selected" : ""}>Asset</option></select></label></header><div class="mpp-graph-stage">${filtered.map((node, index) => `<button type="button" data-mpp-node="${escapeHtml(node.id)}" class="${state.selectedNode === node.id ? "is-active" : ""}" data-kind="${escapeHtml(node.type || "asset")}" style="--x:${12 + (index % 5) * 19}%;--y:${16 + Math.floor(index / 5) * 22}%"><i>${node.type === "project" ? "UP" : "A"}</i><span>${escapeHtml(node.label || node.name || node.id)}</span></button>`).join("") || "<p>Graph đang trống.</p>"}<div class="mpp-graph-flow" aria-hidden="true"></div></div><footer><span>${edges.length} quan hệ</span><span>ID ổn định · relink không đổi lineage</span><button type="button" data-mpp-import-assets>＋ Ingest asset</button></footer></section>`;
  }

  function projectPanel(projectState, state, api, storageInfo) {
    const health = projectHealth(projectState, api), audit = (projectState.review.audit || []).slice(-18).reverse();
    if (state.projectTab === "graph") return graphMarkup(projectState, state);
    if (state.projectTab === "versions") return `<section class="mpp-version-grid"><article><header><small>BRANCHES</small><h3>${projectState.project.branches.length} nhánh</h3></header><form data-mpp-branch-form><input name="name" maxlength="80" placeholder="Tên nhánh thử nghiệm" required><button>Tạo nhánh</button></form><div>${projectState.project.branches.slice().reverse().map((branch) => `<button type="button" data-mpp-branch="${escapeHtml(branch.id)}" class="${branch.id === projectState.project.activeBranchId ? "is-active" : ""}"><i>⌘</i><span><strong>${escapeHtml(branch.name)}</strong><small>${escapeHtml(branch.head || "Chưa checkpoint")}</small></span></button>`).join("")}</div></article><article><header><small>CHECKPOINTS</small><h3>${projectState.project.checkpoints.length} phiên bản</h3></header><button type="button" class="is-primary" data-mpp-checkpoint>Tạo checkpoint an toàn</button><div>${projectState.project.checkpoints.slice().reverse().map((point) => `<button type="button" data-mpp-checkpoint-id="${escapeHtml(point.id)}"><i>◇</i><span><strong>${escapeHtml(point.label)}</strong><small>${new Date(point.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(point.graphHash)}</small></span></button>`).join("") || "<p>Chưa có checkpoint.</p>"}</div></article></section>`;
    if (state.projectTab === "activity") return `<section class="mpp-activity"><header><div><small>IMMUTABLE ACTIVITY</small><h3>Audit log trên thiết bị</h3></div><button type="button" data-mpp-export-manifest>Xuất manifest</button></header><div>${audit.map((item) => `<article><i></i><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail || "Thay đổi dữ liệu dự án")}</p><small>${escapeHtml(item.actor || "local-owner")} · ${new Date(item.createdAt).toLocaleString("vi-VN")}</small></div></article>`).join("")}</div></section>`;
    const issues = [...health.blockers, ...health.warnings];
    return `<section class="mpp-overview-grid"><article class="mpp-command-card"><header><small>NEXT BEST ACTION</small><b data-status="${health.status}">${health.status === "healthy" ? "READY" : "ATTENTION"}</b></header><h3>${health.status === "healthy" ? "Tạo checkpoint trước phiên chỉnh sửa mới" : "Xử lý cảnh báo trước khi xuất bản"}</h3><p>${issues[0]?.message || "Project đang nhất quán. Checkpoint giúp bảo toàn graph và nhánh hiện tại."}</p><div><button type="button" class="is-primary" data-mpp-checkpoint>◇ Checkpoint</button><button type="button" data-mpp-project-tab="graph">Mở graph</button></div></article><article class="mpp-health-card"><div class="mpp-health-ring" style="--score:${health.score}"><strong>${health.score}</strong><span>/100</span></div><div><small>PROJECT HEALTH</small><h3>${issues.length ? `${issues.length} mục cần xem` : "Không có blocker"}</h3><p>${health.blockers.length} blocker · ${health.warnings.length} cảnh báo</p></div></article><article class="mpp-storage-card"><small>LOCAL STORAGE</small><h3>${storageInfo.usageLabel}</h3><p>${storageInfo.quotaLabel} khả dụng · ${storageInfo.persistent}</p><i style="--used:${storageInfo.percent}%"></i></article><article class="mpp-pipeline-card"><header><small>PRODUCTION PIPELINE</small><span>${projectState.assets.items.length} asset</span></header><div><b>INGEST</b><i></i><b>ORGANIZE</b><i></i><b>EDIT</b><i></i><b>REVIEW</b><i></i><b>DELIVER</b></div><footer><button type="button" data-mpp-import-assets>＋ Import</button><button type="button" data-mpp-route="/media-design/review-studio">Review</button><button type="button" data-mpp-route="/media-design/export-workspace">Delivery</button></footer></article><article class="mpp-recent-card"><header><small>RECENT ACTIVITY</small><button type="button" data-mpp-project-tab="activity">Xem tất cả</button></header>${audit.slice(0, 5).map((item) => `<p><i></i><span><strong>${escapeHtml(item.action)}</strong><small>${new Date(item.createdAt).toLocaleTimeString("vi-VN")}</small></span></p>`).join("")}</article></section>`;
  }

  function projectMarkup(projectState, state, api, storageInfo) {
    const health = projectHealth(projectState, api);
    return `<section class="media-project-photo-studio is-project" data-mpp data-workspace="media-core"><header class="mpp-toolbar"><div><span>UP</span><label><small>PROJECT NAME</small><input data-mpp-project-name maxlength="140" value="${escapeHtml(projectState.project.name)}"></label></div><div class="mpp-toolbar-status"><span><i></i> Autosave ${state.lastSavedAt ? new Date(state.lastSavedAt).toLocaleTimeString("vi-VN") : "sẵn sàng"}</span><b data-status="${health.status}">${health.score}/100</b><button type="button" data-mpp-export-manifest>⇩ Manifest</button><button type="button" data-mpp-checkpoint>◇ Checkpoint</button></div></header>${projectTabs(state)}<main>${projectPanel(projectState, state, api, storageInfo)}</main><input type="file" data-mpp-project-files multiple hidden accept="image/*,video/*,audio/*,.pdf,.svg,.json"></section>`;
  }

  function photoTabs(state, photos) {
    return `<nav class="mpp-photo-tabs">${[["develop", "Develop"], ["lighttable", `Lighttable · ${photos.length}`], ["history", "History"], ["export", "Export"]].map(([id, label]) => `<button type="button" data-mpp-photo-tab="${id}" class="${state.photoTab === id ? "is-active" : ""}">${label}</button>`).join("")}<button type="button" data-mpp-route="/media-design/photo-editor">Mở Layer Editor ↗</button></nav>`;
  }

  function recipeControls(recipe) {
    const range = (name, label, min, max, value, unit = "") => `<label><span>${label}<b data-mpp-value="${name}">${value}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${name === "exposure" ? ".1" : "1"}" value="${value}" data-mpp-recipe="${name}"></label>`;
    return `<div class="mpp-adjustments"><header><small>NON-DESTRUCTIVE RECIPE</small><button type="button" data-mpp-reset-recipe>Đặt lại</button></header>${range("exposure", "Exposure", -3, 3, recipe.exposure, " EV")}${range("contrast", "Contrast", 20, 220, recipe.contrast, "%")}${range("saturation", "Saturation", 0, 240, recipe.saturation, "%")}${range("temperature", "Temperature", -100, 100, recipe.temperature)}${range("blur", "Blur", 0, 12, recipe.blur, "px")}${range("grayscale", "Grayscale", 0, 100, recipe.grayscale, "%")}<div class="mpp-transform-row"><button type="button" data-mpp-transform="rotate">↻ Xoay</button><button type="button" data-mpp-transform="flipX">↔ Lật ngang</button><button type="button" data-mpp-transform="flipY">↕ Lật dọc</button></div></div>`;
  }

  function filmstrip(photos, selectedId) {
    return `<div class="mpp-filmstrip">${photos.map((photo) => `<button type="button" data-mpp-photo="${photo.id}" class="${photo.id === selectedId ? "is-active" : ""}"><img src="${photo.url}" alt=""><span><strong>${escapeHtml(photo.name)}</strong><small>${photo.width || "…"}×${photo.height || "…"}</small></span></button>`).join("") || "<p>Thả ảnh vào để bắt đầu.</p>"}</div>`;
  }

  function photoPanel(state, photos, histogram) {
    const selected = photos.find((item) => item.id === state.selectedPhotoId);
    if (state.photoTab === "lighttable") return `<section class="mpp-lighttable"><header><div><small>LOCAL LIGHTTABLE</small><h3>${photos.length} ảnh trong phiên</h3></div><label>Thêm ảnh<input type="file" accept="image/*" multiple data-mpp-photo-files></label></header><div>${photos.map((photo) => `<button type="button" data-mpp-photo="${photo.id}" class="${photo.id === state.selectedPhotoId ? "is-active" : ""}"><img src="${photo.url}" alt="${escapeHtml(photo.name)}"><span><strong>${escapeHtml(photo.name)}</strong><small>${formatBytes(photo.file.size)} · ${photo.width || "…"}×${photo.height || "…"}</small></span></button>`).join("") || "<p>Chưa có ảnh. File chỉ được giải mã trên thiết bị.</p>"}</div></section>`;
    if (state.photoTab === "history") return `<section class="mpp-photo-history"><header><div><small>EDIT HISTORY</small><h3>${state.snapshots.length} snapshot</h3></div><button type="button" data-mpp-photo-snapshot ${selected ? "" : "disabled"}>＋ Snapshot</button></header><div>${state.snapshots.slice().reverse().map((item) => `<button type="button" data-mpp-restore-snapshot="${item.id}"><i>◇</i><span><strong>${escapeHtml(item.name)}</strong><small>${new Date(item.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(item.photoName || "Ảnh")}</small></span><b>Khôi phục</b></button>`).join("") || "<p>Chưa có snapshot công thức chỉnh sửa.</p>"}</div></section>`;
    if (state.photoTab === "export") return `<section class="mpp-photo-export"><article><small>OUTPUT RECIPE</small><h3>Xuất ảnh toàn kích thước</h3><p>Preview được giới hạn để tương tác mượt; khi xuất, công thức sẽ render lại từ ảnh nguồn với giới hạn an toàn 8192px.</p><label>Định dạng<select data-mpp-export-format><option value="image/webp" ${state.recipe.format === "image/webp" ? "selected" : ""}>WebP</option><option value="image/jpeg" ${state.recipe.format === "image/jpeg" ? "selected" : ""}>JPEG</option><option value="image/png" ${state.recipe.format === "image/png" ? "selected" : ""}>PNG</option></select></label><label>Chất lượng <span data-mpp-value="quality">${state.recipe.quality}%</span><input type="range" min="30" max="100" value="${state.recipe.quality}" data-mpp-recipe="quality"></label><button type="button" class="is-primary" data-mpp-export-photo ${selected ? "" : "disabled"}>Xuất ${selected ? escapeHtml(selected.name) : "ảnh"}</button></article><article><small>PERFORMANCE PATH</small><div class="mpp-engine-status"><p><i class="${globalScope.createImageBitmap ? "is-ready" : ""}"></i><span><strong>ImageBitmap decode</strong><small>${globalScope.createImageBitmap ? "Sẵn sàng" : "Fallback HTMLImage"}</small></span></p><p><i class="${globalScope.OffscreenCanvas ? "is-ready" : ""}"></i><span><strong>Offscreen render</strong><small>${globalScope.OffscreenCanvas ? "Sẵn sàng" : "Canvas fallback"}</small></span></p><p><i class="is-ready"></i><span><strong>Non-destructive recipe</strong><small>Ảnh nguồn không bị ghi đè</small></span></p></div></article></section>`;
    const paths = histogram ? [["#ff668c", histogram.red], ["#67efb0", histogram.green], ["#5d9dff", histogram.blue], ["#e8f0ff", histogram.luminance]] : [];
    return `<section class="mpp-photo-develop">${recipeControls(state.recipe)}<main class="mpp-photo-canvas"><header><div><button type="button" data-mpp-view="fit" class="${state.photoView === "fit" ? "is-active" : ""}">Fit</button><button type="button" data-mpp-view="100" class="${state.photoView === "100" ? "is-active" : ""}">100%</button></div><span>${selected ? `${escapeHtml(selected.name)} · ${selected.width || "…"}×${selected.height || "…"}` : "Chưa có ảnh"}</span><button type="button" data-mpp-compare ${selected ? "" : "disabled"}>Giữ để xem gốc</button></header><div class="mpp-canvas-stage" data-mpp-drop><canvas data-mpp-photo-canvas></canvas><div class="mpp-empty-photo" ${selected ? "hidden" : ""}><i>PI</i><h3>Thả ảnh vào Photo Lab</h3><p>JPEG, PNG, WebP, GIF và định dạng ảnh trình duyệt hỗ trợ.</p><label>Chọn ảnh<input type="file" accept="image/*" multiple data-mpp-photo-files></label></div></div>${filmstrip(photos, state.selectedPhotoId)}</main><aside class="mpp-photo-inspector"><header><small>LIVE SCOPES</small><button type="button" data-mpp-photo-snapshot ${selected ? "" : "disabled"}>◇ Snapshot</button></header><svg viewBox="0 0 300 86" preserveAspectRatio="none">${paths.map(([color, values]) => `<path d="${histogramPath(values)}" stroke="${color}"/>`).join("")}</svg><dl><div><dt>Không gian màu</dt><dd>sRGB preview</dd></div><div><dt>Recipe</dt><dd>${Object.values(state.recipe).filter((value) => value !== 0 && value !== false).length} tham số</dd></div><div><dt>Preview cap</dt><dd>1600px</dd></div><div><dt>Ảnh nguồn</dt><dd>${selected ? formatBytes(selected.file.size) : "—"}</dd></div></dl><button type="button" data-mpp-photo-tab="export" ${selected ? "" : "disabled"}>Tiếp tục xuất ảnh →</button></aside></section>`;
  }

  function photoMarkup(state, photos, histogram) {
    return `<section class="media-project-photo-studio is-photo" data-mpp data-workspace="photo-workspace"><header class="mpp-photo-toolbar"><div><span>PI</span><div><small>PHOTO & IMAGE LAB</small><strong>Lighttable → Develop → Review → Export</strong></div></div><label>＋ Nhập ảnh<input type="file" accept="image/*" multiple data-mpp-photo-files></label><button type="button" data-mpp-route="/media-design/background-remover">Xóa nền</button><button type="button" data-mpp-route="/media-design/collage">Collage</button><button type="button" data-mpp-route="/media-design/photo-editor">Layer Editor</button></header>${photoTabs(state, photos)}<main>${photoPanel(state, photos, histogram)}</main><div class="mpp-photo-status" data-mpp-status role="status" aria-live="polite">Sẵn sàng xử lý cục bộ.</div></section>`;
  }

  function sourceDimensions(source) { return { width: source.naturalWidth || source.videoWidth || source.width || 1, height: source.naturalHeight || source.videoHeight || source.height || 1 }; }

  function drawSource(surface, source, recipeInput, maxEdge = 1600) {
    const recipe = normalizeRecipe(recipeInput), dimensions = sourceDimensions(source), scale = Math.min(1, maxEdge / Math.max(dimensions.width, dimensions.height));
    const sourceWidth = Math.max(1, Math.round(dimensions.width * scale)), sourceHeight = Math.max(1, Math.round(dimensions.height * scale));
    const rotated = recipe.rotation === 90 || recipe.rotation === 270;
    surface.width = rotated ? sourceHeight : sourceWidth; surface.height = rotated ? sourceWidth : sourceHeight;
    const context = surface.getContext("2d", { alpha: true, willReadFrequently: maxEdge <= 1600 });
    context.clearRect(0, 0, surface.width, surface.height); context.save(); context.filter = recipeFilter(recipe);
    context.translate(surface.width / 2, surface.height / 2); context.rotate(recipe.rotation * Math.PI / 180); context.scale(recipe.flipX ? -1 : 1, recipe.flipY ? -1 : 1);
    context.drawImage(source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight); context.restore();
    return { context, width: surface.width, height: surface.height, sourceWidth: dimensions.width, sourceHeight: dimensions.height };
  }

  async function decodePhoto(file) {
    if (globalScope.createImageBitmap) return globalScope.createImageBitmap(file);
    return new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Không thể đọc ${file.name}.`)); }; image.src = url; });
  }

  async function storageEstimate() {
    try {
      const result = await globalScope.navigator?.storage?.estimate?.();
      const usage = Number(result?.usage || 0), quota = Number(result?.quota || 0), persistent = await globalScope.navigator?.storage?.persisted?.();
      return { usage, quota, percent: quota ? Math.min(100, usage / quota * 100) : 0, usageLabel: formatBytes(usage), quotaLabel: quota ? formatBytes(quota) : "Chưa kiểm tra", persistent: persistent ? "Lưu bền vững" : "Có thể bị dọn bởi trình duyệt" };
    } catch (_) { return { usage: 0, quota: 0, percent: 0, usageLabel: "Chưa kiểm tra", quotaLabel: "Không khả dụng", persistent: "Không thể kiểm tra" }; }
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount(host);
    const workspace = options.workspace || options.toolId;
    if (!["media-core", "photo-workspace"].includes(workspace)) return null;
    const controller = new AbortController(), store = createStore(options.storage), projectApi = options.professionalApi || globalScope.HHMediaProfessionalSuite;
    const projectStore = projectApi?.createStateStore?.(options.storage), mediaApi = options.mediaApi || globalScope.HHUniversalMediaProject;
    let state = store.load(), projectState = projectStore?.load?.(), photos = [], selectedSource = null, histogram = null, storageInfo = { usageLabel: "Đang kiểm tra…", quotaLabel: "—", percent: 0, persistent: "—" }, frame = 0, compare = false;
    const objectUrls = new Set();
    const navigate = (route) => typeof options.onNavigate === "function" ? options.onNavigate(route) : (globalScope.location.hash = `#${route}`);
    const save = () => { state.lastSavedAt = now(); state = store.save(state); if (projectState) projectState = projectStore?.save?.(projectState) || projectState; };
    const status = (message, tone = "success") => { const node = host.querySelector("[data-mpp-status]"); if (node) { node.textContent = message; node.dataset.tone = tone; } };
    const render = () => { host.innerHTML = workspace === "media-core" ? projectMarkup(projectState, state, projectApi, storageInfo) : photoMarkup(state, photos, histogram); if (workspace === "photo-workspace" && selectedSource) scheduleDraw(); };
    const refreshProjectStorage = async () => { storageInfo = await storageEstimate(); if (workspace === "media-core" && host.isConnected) render(); };
    const selectedPhoto = () => photos.find((item) => item.id === state.selectedPhotoId);
    const scheduleDraw = (original = compare) => {
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
        const canvas = host.querySelector("[data-mpp-photo-canvas]"); if (!canvas || !selectedSource) return;
        const output = drawSource(canvas, selectedSource, original ? defaultRecipe() : state.recipe, 1600);
        canvas.style.width = state.photoView === "100" ? `${output.width}px` : ""; canvas.style.height = state.photoView === "100" ? `${output.height}px` : "";
        if (!original) {
          const imageData = output.context.getImageData(0, 0, output.width, output.height);
          histogram = calculateHistogram(imageData.data); const svg = host.querySelector(".mpp-photo-inspector svg");
          if (svg) svg.innerHTML = [["#ff668c", histogram.red], ["#67efb0", histogram.green], ["#5d9dff", histogram.blue], ["#e8f0ff", histogram.luminance]].map(([color, values]) => `<path d="${histogramPath(values)}" stroke="${color}"/>`).join("");
        }
      });
    };
    const selectPhoto = async (id) => {
      const photo = photos.find((item) => item.id === id); if (!photo) return;
      selectedSource?.close?.(); selectedSource = await decodePhoto(photo.file); const dimensions = sourceDimensions(selectedSource); photo.width = dimensions.width; photo.height = dimensions.height;
      state.selectedPhotoId = photo.id; save(); render(); status(`Đã mở ${photo.name} · ${photo.width}×${photo.height}.`);
    };
    const ingestProjectFiles = async (files) => {
      if (!projectState || !projectApi?.addAssetRecord) return;
      const list = [...files].filter((file) => file.size > 0).slice(0, 60);
      for (const file of list) {
        const result = projectApi.addAssetRecord(projectState, { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, checksum: await checksum(file), source: "project-core" });
        projectState = result.state;
      }
      save(); render();
      if (mediaApi?.createStore) {
        const db = mediaApi.createStore();
        try { await db.ready(); const project = (await db.listProjects())[0] || await db.saveProject({ name: projectState.project.name }); for (const file of list) await db.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, blob: file }); } catch (_) {} finally { await db.close?.().catch?.(() => {}); }
      }
    };
    const ingestPhotos = async (files) => {
      const list = [...files].filter((file) => file.type.startsWith("image/") && file.size > 0).slice(0, 30);
      for (const file of list) { const url = URL.createObjectURL(file); objectUrls.add(url); photos.push({ id: uid("photo"), file, url, name: file.name, width: 0, height: 0 }); }
      if (list.length && mediaApi?.createStore) {
        const db = mediaApi.createStore();
        try { await db.ready(); const project = (await db.listProjects())[0] || await db.saveProject({ name: projectState?.project?.name || "Universal Media Project" }); for (const file of list) await db.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, blob: file, metadata: { source: "photo-lighttable" } }); } catch (_) {} finally { await db.close?.().catch?.(() => {}); }
      }
      if (photos.length && !photos.some((item) => item.id === state.selectedPhotoId)) state.selectedPhotoId = photos[0].id;
      save(); render(); if (state.selectedPhotoId) await selectPhoto(state.selectedPhotoId);
      if (list.length) status(`Đã nhập ${list.length} ảnh vào Lighttable.`, "success");
    };
    const exportPhoto = async () => {
      const photo = selectedPhoto(); if (!photo || !selectedSource) return;
      status("Đang render ảnh nguồn…", "working");
      const dimensions = sourceDimensions(selectedSource), maxEdge = Math.min(8192, Math.max(dimensions.width, dimensions.height)), rotated = [90, 270].includes(state.recipe.rotation);
      const surface = globalScope.OffscreenCanvas ? new globalScope.OffscreenCanvas(rotated ? dimensions.height : dimensions.width, rotated ? dimensions.width : dimensions.height) : document.createElement("canvas");
      drawSource(surface, selectedSource, state.recipe, maxEdge);
      const type = state.recipe.format, quality = state.recipe.quality / 100;
      const blob = surface.convertToBlob ? await surface.convertToBlob({ type, quality }) : await new Promise((resolve, reject) => surface.toBlob((value) => value ? resolve(value) : reject(new Error("Không thể tạo file.")), type, quality));
      const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1]; download(`${safeName(photo.name.replace(/\.[^.]+$/, ""))}-hh-edit.${extension}`, blob, type); status(`Đã xuất ${formatBytes(blob.size)} từ ảnh nguồn.`, "success");
    };

    host.addEventListener("click", async (event) => {
      const route = event.target.closest("[data-mpp-route]"); if (route) { navigate(route.dataset.mppRoute); return; }
      const projectTab = event.target.closest("[data-mpp-project-tab]"); if (projectTab) { state.projectTab = projectTab.dataset.mppProjectTab; save(); render(); return; }
      const photoTab = event.target.closest("[data-mpp-photo-tab]"); if (photoTab) { state.photoTab = photoTab.dataset.mppPhotoTab; save(); render(); return; }
      if (event.target.closest("[data-mpp-import-assets]")) { host.querySelector("[data-mpp-project-files]")?.click(); return; }
      if (event.target.closest("[data-mpp-checkpoint]") && projectState) { projectState = projectApi.createCheckpoint(projectState, `Checkpoint ${new Date().toLocaleString("vi-VN")}`); save(); render(); return; }
      if (event.target.closest("[data-mpp-export-manifest]") && projectState) { download(`${safeName(projectState.project.name)}.hhcore.json`, JSON.stringify({ schema: "hh.project-core.v1", exportedAt: now(), project: projectState }, null, 2), "application/json"); return; }
      const node = event.target.closest("[data-mpp-node]"); if (node) { state.selectedNode = node.dataset.mppNode; save(); render(); return; }
      const branch = event.target.closest("[data-mpp-branch]"); if (branch && projectState.project.branches.some((item) => item.id === branch.dataset.mppBranch)) { projectState.project.activeBranchId = branch.dataset.mppBranch; save(); render(); return; }
      const photoButton = event.target.closest("[data-mpp-photo]"); if (photoButton) { await selectPhoto(photoButton.dataset.mppPhoto); return; }
      const view = event.target.closest("[data-mpp-view]"); if (view) { state.photoView = view.dataset.mppView; save(); host.querySelectorAll("[data-mpp-view]").forEach((button) => button.classList.toggle("is-active", button === view)); scheduleDraw(); return; }
      if (event.target.closest("[data-mpp-reset-recipe]")) { state.recipe = defaultRecipe(); save(); render(); return; }
      const transform = event.target.closest("[data-mpp-transform]"); if (transform) { const action = transform.dataset.mppTransform; if (action === "rotate") state.recipe.rotation = (state.recipe.rotation + 90) % 360; else state.recipe[action] = !state.recipe[action]; save(); scheduleDraw(); return; }
      if (event.target.closest("[data-mpp-photo-snapshot]")) { const photo = selectedPhoto(); if (!photo) return; state.snapshots.push({ id: uid("snapshot"), name: `Snapshot ${state.snapshots.length + 1}`, photoId: photo.id, photoName: photo.name, recipe: clone(state.recipe), createdAt: now() }); save(); if (state.photoTab === "history") render(); else status("Đã lưu snapshot công thức."); return; }
      const restore = event.target.closest("[data-mpp-restore-snapshot]"); if (restore) { const item = state.snapshots.find((row) => row.id === restore.dataset.mppRestoreSnapshot); if (item) { state.recipe = normalizeRecipe(item.recipe); state.photoTab = "develop"; save(); render(); } return; }
      if (event.target.closest("[data-mpp-export-photo]")) { await exportPhoto().catch((error) => status(error.message, "error")); return; }
    }, { signal: controller.signal });
    host.addEventListener("submit", (event) => { if (!event.target.matches("[data-mpp-branch-form]")) return; event.preventDefault(); const name = new FormData(event.target).get("name"); projectState = projectApi.createBranch(projectState, name); save(); render(); }, { signal: controller.signal });
    host.addEventListener("input", (event) => {
      const recipe = event.target.dataset.mppRecipe; if (!recipe) return;
      state.recipe[recipe] = Number(event.target.value); state.recipe = normalizeRecipe(state.recipe); const value = host.querySelector(`[data-mpp-value="${recipe}"]`); if (value) value.textContent = `${event.target.value}${recipe === "exposure" ? " EV" : ["contrast", "saturation", "grayscale", "quality"].includes(recipe) ? "%" : recipe === "blur" ? "px" : ""}`; save(); scheduleDraw();
    }, { signal: controller.signal });
    host.addEventListener("change", async (event) => {
      if (event.target.matches("[data-mpp-project-name]") && projectState) { projectState.project.name = String(event.target.value || "Universal Media Project").slice(0, 140); const node = projectState.project.graph.nodes.find((item) => item.id === projectState.project.id); if (node) node.label = projectState.project.name; save(); render(); return; }
      if (event.target.matches("[data-mpp-graph-filter]")) { state.graphFilter = event.target.value; save(); render(); return; }
      if (event.target.matches("[data-mpp-project-files]")) { await ingestProjectFiles(event.target.files || []); return; }
      if (event.target.matches("[data-mpp-photo-files]")) { await ingestPhotos(event.target.files || []); return; }
      if (event.target.matches("[data-mpp-export-format]")) { state.recipe.format = event.target.value; save(); }
    }, { signal: controller.signal });
    host.addEventListener("pointerdown", (event) => { if (event.target.closest("[data-mpp-compare]")) { compare = true; scheduleDraw(true); } }, { signal: controller.signal });
    globalScope.addEventListener?.("pointerup", () => { if (compare) { compare = false; scheduleDraw(false); } }, { signal: controller.signal });
    host.addEventListener("dragover", (event) => { if (workspace === "photo-workspace" && event.dataTransfer?.types?.includes("Files")) event.preventDefault(); }, { signal: controller.signal });
    host.addEventListener("drop", (event) => { if (workspace !== "photo-workspace" || !event.dataTransfer?.files?.length) return; event.preventDefault(); ingestPhotos(event.dataTransfer.files); }, { signal: controller.signal });
    render(); refreshProjectStorage();
    const instance = { controller, objectUrls, dispose: () => { cancelAnimationFrame(frame); selectedSource?.close?.(); selectedSource = null; }, getState: () => ({ ui: clone(state), project: clone(projectState), photos: photos.map(({ file, url, ...item }) => ({ ...item, size: file.size })) }) };
    active.set(host, instance); return instance;
  }

  function unmount(host) {
    const rows = host ? [[host, active.get(host)]] : [...active.entries()];
    rows.forEach(([node, instance]) => { if (!instance) return; instance.controller.abort(); instance.dispose?.(); instance.objectUrls.forEach((url) => URL.revokeObjectURL(url)); node.innerHTML = ""; active.delete(node); });
  }

  return Object.freeze({ SCHEMA, STORAGE_KEY, defaultRecipe, normalizeRecipe, normalizeState, createStore, recipeFilter, calculateHistogram, histogramPath, drawSource, mount, unmount });
});
