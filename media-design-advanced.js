(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const advanced = new Set(["Photo Editor", "Background Remover", "Collage Maker", "Image Inspector"]);
  const state = { urls: [], editor: null, remover: null, collage: null, inspector: null, timer: 0 };
  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = () => crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const bytes = (value) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(2)} MB`;
  const objectUrl = (blob) => { const url = URL.createObjectURL(blob); state.urls.push(url); return url; };
  const loadImage = (file) => new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Không thể đọc ${file.name}.`)); }; image.src = url; });
  const canvasBlob = (canvas, type = "image/png", quality = 0.92) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể tạo ảnh đầu ra.")), type, quality));
  const download = (blob, name) => { const anchor = document.createElement("a"); anchor.href = objectUrl(blob); anchor.download = name; anchor.click(); };
  const status = (work, message, kind = "info") => { const node = $(work, "[data-md-status]"); if (node) { node.textContent = message; node.dataset.state = kind; } };
  const historyAdd = (tool, title, detail) => { let rows = []; try { rows = JSON.parse(localStorage.getItem("hh-media-design-history") || "[]"); } catch {} rows.unshift({ id: uid(), tool, title, detail, at: new Date().toISOString() }); localStorage.setItem("hh-media-design-history", JSON.stringify(rows.slice(0, 40))); };
  const header = (name, description, code, caps) => `<header class="md-head md-head--advanced"><div><small>MEDIA & DESIGN · ADVANCED</small><h3>${esc(name)}</h3><p>${esc(description)}</p></div><span class="md-private"><i></i> Xử lý riêng tư trên thiết bị</span></header><div class="md-status" data-md-status>Sẵn sàng.</div><div class="mdx-commandbar"><div><span>${code}</span><strong>HH Creative Engine</strong></div><div>${caps.map((cap) => `<span>${esc(cap)}</span>`).join("")}</div><b>LOCAL</b></div>`;

  function cleanupAdvanced() {
    clearTimeout(state.timer);
    state.urls.splice(0).forEach(URL.revokeObjectURL);
    state.editor = null;
    state.remover = null;
    state.collage = null;
    state.inspector = null;
  }

  function editorMarkup() {
    return `${header("Photo Editor", "Trình chỉnh sửa nhiều lớp với chữ, hình khối, blend mode, bộ lọc và lịch sử thao tác.", "PHOTO-01", ["Layers", "Undo / Redo", "Blend & Filters", "PNG · JPG · WebP"])}
      <div class="mdx-editor" data-adv-editor>
        <div class="mdx-editor-toolbar">
          <button type="button" data-adv-action="editor-new" title="Tạo tài liệu mới">Mới</button>
          <label class="mdx-file-button">Mở ảnh<input type="file" accept="image/*" multiple data-adv-file="editor"></label>
          <label class="mdx-file-button">Mở project<input type="file" accept="application/json,.hhphoto" data-adv-project></label>
          <button type="button" data-adv-action="editor-save-project">Lưu project</button>
          <span></span>
          <button type="button" data-adv-action="editor-undo" title="Hoàn tác (Ctrl+Z)">↶</button>
          <button type="button" data-adv-action="editor-redo" title="Làm lại (Ctrl+Y)">↷</button>
          <span></span>
          <button type="button" data-adv-action="editor-text">+ Chữ</button>
          <button type="button" data-adv-action="editor-rect">+ Chữ nhật</button>
          <button type="button" data-adv-action="editor-circle">+ Tròn</button>
          <button type="button" data-adv-action="editor-flatten" title="Gộp toàn bộ layer thành một layer ảnh">Gộp layer</button>
          <span class="mdx-toolbar-spacer"></span>
          <label>Khổ<select data-adv-editor-preset><option value="custom">Tùy chỉnh</option><option value="1280x720">HD 16:9</option><option value="1920x1080">Full HD</option><option value="1080x1080">Bài vuông</option><option value="1080x1350">Instagram 4:5</option><option value="1080x1920">Story 9:16</option><option value="2480x3508">A4 300dpi</option></select></label>
          <label>Zoom<select data-adv-editor-zoom><option value="0.35">35%</option><option value="0.5">50%</option><option value="0.75" selected>75%</option><option value="1">100%</option><option value="1.5">150%</option></select></label>
          <button class="is-primary" type="button" data-adv-action="editor-export">Xuất ảnh</button>
        </div>
        <div class="mdx-editor-body">
          <aside class="mdx-editor-tools" aria-label="Công cụ nhanh">
            <button class="is-active" type="button" data-adv-action="editor-tool" data-editor-tool="select" title="Chọn và di chuyển (V)">↖<span>Chọn</span></button>
            <button type="button" data-adv-action="editor-tool" data-editor-tool="brush" title="Brush (B)">●<span>Brush</span></button>
            <button type="button" data-adv-action="editor-tool" data-editor-tool="eraser" title="Eraser (E)">◒<span>Eraser</span></button>
            <button type="button" data-adv-action="editor-tool" data-editor-tool="eyedropper" title="Eyedropper (I)">⌾<span>Lấy màu</span></button>
            <button type="button" data-adv-action="editor-tool" data-editor-tool="pan" title="Hand / Pan (H)">✋<span>Pan</span></button>
            <button type="button" data-adv-action="editor-add-raster" title="Raster layer mới">▦<span>Raster</span></button>
            <button type="button" data-adv-action="editor-gradient" title="Gradient layer">◩<span>Gradient</span></button>
            <button type="button" data-adv-action="editor-center" title="Căn giữa layer">⊙<span>Căn giữa</span></button>
            <button type="button" data-adv-action="editor-crop" title="Cắt tài liệu theo layer">⌗<span>Crop</span></button>
            <button type="button" data-adv-action="editor-flip-x" title="Lật ngang ảnh">↔<span>Lật X</span></button>
            <button type="button" data-adv-action="editor-flip-y" title="Lật dọc ảnh">↕<span>Lật Y</span></button>
            <button type="button" data-adv-action="editor-duplicate" title="Nhân đôi layer">⧉<span>Nhân đôi</span></button>
            <button type="button" data-adv-action="editor-delete" title="Xóa layer">⌫<span>Xóa</span></button>
          </aside>
          <section class="mdx-editor-stage-wrap">
            <div class="mdx-editor-options">
              <span>Công cụ: <b data-adv-active-tool>Chọn</b></span>
              <label>Màu<input type="color" value="#ec4899" data-adv-brush="color"></label>
              <label>Size <b data-adv-brush-value="size">36px</b><input type="range" min="1" max="300" value="36" data-adv-brush="size"></label>
              <label>Opacity <b data-adv-brush-value="opacity">100%</b><input type="range" min="1" max="100" value="100" data-adv-brush="opacity"></label>
              <label>Hardness <b data-adv-brush-value="hardness">85%</b><input type="range" min="1" max="100" value="85" data-adv-brush="hardness"></label>
              <label class="mdx-option-check"><input type="checkbox" data-adv-grid> Grid</label>
              <label class="mdx-option-check"><input type="checkbox" data-adv-snap> Snap</label>
              <span data-adv-pointer-info>X 0 · Y 0</span>
            </div>
            <div class="mdx-editor-stage" data-adv-editor-stage><canvas data-adv-editor-canvas width="1280" height="720"></canvas></div>
            <div class="mdx-editor-foot"><span data-adv-doc-info>1280 × 720 px</span><span>Kéo layer trực tiếp trên canvas · Delete để xóa</span></div>
          </section>
          <aside class="mdx-editor-panel">
            <div class="mdx-panel-tabs"><button class="is-active" type="button">Layer</button><button type="button">Thuộc tính</button></div>
            <section class="mdx-layers"><header><strong>Layers</strong><div><button type="button" data-adv-action="editor-layer-up" title="Đưa lên">↑</button><button type="button" data-adv-action="editor-layer-down" title="Đưa xuống">↓</button></div></header><div data-adv-layer-list></div></section>
            <section class="mdx-inspector" data-adv-inspector>
              <header><strong>Thuộc tính</strong><small data-adv-selected-kind>Chưa chọn layer</small></header>
              <label>Tên layer<input type="text" data-adv-prop="name"></label>
              <div class="mdx-inspector-grid">
                <label>X<input type="number" data-adv-prop="x"></label><label>Y<input type="number" data-adv-prop="y"></label>
                <label>Rộng<input type="number" min="1" data-adv-prop="width"></label><label>Cao<input type="number" min="1" data-adv-prop="height"></label>
                <label>Xoay<input type="number" min="-360" max="360" data-adv-prop="rotation"></label><label>Opacity<input type="range" min="0" max="100" value="100" data-adv-prop="opacity"></label>
              </div>
              <label>Blend mode<select data-adv-prop="blend"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="darken">Darken</option><option value="lighten">Lighten</option><option value="color-dodge">Color Dodge</option><option value="difference">Difference</option></select></label>
              <div class="mdx-effect-controls" data-adv-image-controls>
                <label>Preset<select data-adv-filter-preset><option value="custom">Tùy chỉnh</option><option value="vivid">Vivid</option><option value="cinema">Cinema</option><option value="mono">Monochrome</option><option value="sepia">Vintage Sepia</option><option value="invert">Invert</option></select></label>
                <label>Độ sáng <b data-adv-value="brightness">100%</b><input type="range" min="0" max="200" value="100" data-adv-prop="brightness"></label>
                <label>Tương phản <b data-adv-value="contrast">100%</b><input type="range" min="0" max="200" value="100" data-adv-prop="contrast"></label>
                <label>Bão hòa <b data-adv-value="saturation">100%</b><input type="range" min="0" max="200" value="100" data-adv-prop="saturation"></label>
                <label>Hue <b data-adv-value="hue">0°</b><input type="range" min="-180" max="180" value="0" data-adv-prop="hue"></label>
                <label>Grayscale <b data-adv-value="grayscale">0%</b><input type="range" min="0" max="100" value="0" data-adv-prop="grayscale"></label>
                <label>Sepia <b data-adv-value="sepia">0%</b><input type="range" min="0" max="100" value="0" data-adv-prop="sepia"></label>
                <label>Invert <b data-adv-value="invert">0%</b><input type="range" min="0" max="100" value="0" data-adv-prop="invert"></label>
                <label>Blur <b data-adv-value="blur">0px</b><input type="range" min="0" max="30" value="0" data-adv-prop="blur"></label>
                <fieldset><legend>Drop shadow</legend><label>Màu<input type="color" value="#000000" data-adv-prop="shadowColor"></label><label>Blur<input type="range" min="0" max="80" value="0" data-adv-prop="shadowBlur"></label><div class="mdx-inspector-grid"><label>X<input type="number" value="0" data-adv-prop="shadowX"></label><label>Y<input type="number" value="0" data-adv-prop="shadowY"></label></div></fieldset>
              </div>
              <div class="mdx-text-controls" data-adv-text-controls hidden><label>Nội dung<textarea rows="3" data-adv-prop="text"></textarea></label><div class="mdx-inspector-grid"><label>Cỡ chữ<input type="number" min="8" max="400" data-adv-prop="fontSize"></label><label>Màu<input type="color" data-adv-prop="color"></label><label>Độ đậm<select data-adv-prop="fontWeight"><option value="300">Light</option><option value="400">Regular</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option></select></label><label>Căn chữ<select data-adv-prop="textAlign"><option value="center">Giữa</option><option value="left">Trái</option><option value="right">Phải</option></select></label><label>Màu viền<input type="color" data-adv-prop="textStroke"></label><label>Độ dày viền<input type="range" min="0" max="20" data-adv-prop="textStrokeWidth"></label></div><label>Font<select data-adv-prop="fontFamily"><option>Be Vietnam Pro</option><option>Arial</option><option>Georgia</option><option>Courier New</option><option>Verdana</option></select></label></div>
              <div class="mdx-shape-controls" data-adv-shape-controls hidden><div class="mdx-inspector-grid"><label>Màu nền<input type="color" data-adv-prop="fill"></label><label>Màu viền<input type="color" data-adv-prop="stroke"></label></div><label>Độ dày viền<input type="range" min="0" max="40" data-adv-prop="strokeWidth"></label></div>
              <div class="mdx-gradient-controls" data-adv-gradient-controls hidden><div class="mdx-inspector-grid"><label>Màu đầu<input type="color" data-adv-prop="colorA"></label><label>Màu cuối<input type="color" data-adv-prop="colorB"></label></div><label>Kiểu<select data-adv-prop="gradientType"><option value="linear">Linear</option><option value="radial">Radial</option></select></label><label>Góc<input type="range" min="0" max="360" data-adv-prop="gradientAngle"></label></div>
              <button type="button" data-adv-action="editor-reset-effects">Đặt lại hiệu ứng</button>
            </section>
            <section class="mdx-document-settings"><header><strong>Tài liệu</strong></header><div class="mdx-inspector-grid"><label>Rộng<input type="number" min="64" max="6000" value="1280" data-adv-doc="width"></label><label>Cao<input type="number" min="64" max="6000" value="720" data-adv-doc="height"></label></div><label>Nền<input type="color" value="#ffffff" data-adv-doc="background"></label><label class="mdx-check"><input type="checkbox" data-adv-doc-transparent> Nền trong suốt</label><label>Định dạng<select data-adv-export-type><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label><label>Chất lượng <b data-adv-export-quality-value>92%</b><input type="range" min="20" max="100" value="92" data-adv-export-quality></label></section>
          </aside>
        </div>
      </div>`;
  }

  function makeLayer(type, extra = {}) {
    const names = { image: "Ảnh", raster: "Raster layer", text: "Văn bản", shape: "Hình khối", gradient: "Gradient" };
    const common = { id: uid(), type, name: names[type] || "Layer", x: 640, y: 360, width: 320, height: 220, rotation: 0, opacity: 1, visible: true, blend: "source-over" };
    return { ...common, locked: false, ...extra };
  }
  const selectedLayer = () => state.editor?.layers.find((layer) => layer.id === state.editor.selected);
  const cloneRaster = (source) => { if (!source) return null; const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height; canvas.getContext("2d").drawImage(source, 0, 0); return canvas; };
  const snapshotLayers = (layers) => layers.map((layer) => layer.type === "raster" ? { ...layer, raster: cloneRaster(layer.raster) } : { ...layer });
  function pushHistory() {
    const editor = state.editor; if (!editor) return;
    editor.history.splice(editor.historyIndex + 1);
    editor.history.push({ layers: snapshotLayers(editor.layers), selected: editor.selected, width: editor.width, height: editor.height, background: editor.background, transparent: editor.transparent });
    const limit = editor.layers.some((layer) => layer.type === "raster") ? 24 : 40;
    if (editor.history.length > limit) editor.history.shift();
    editor.historyIndex = editor.history.length - 1;
  }
  function restoreHistory(index) {
    const editor = state.editor; const entry = editor?.history[index]; if (!entry) return;
    editor.layers = snapshotLayers(entry.layers); editor.selected = entry.selected; editor.width = entry.width; editor.height = entry.height; editor.background = entry.background; editor.transparent = Boolean(entry.transparent); editor.historyIndex = index;
    editor.canvas.width = editor.width; editor.canvas.height = editor.height;
    syncEditorUi(); drawEditor();
  }
  function drawLayer(ctx, layer, selected = false) {
    if (!layer.visible) return;
    ctx.save(); ctx.translate(layer.x, layer.y); ctx.rotate(layer.rotation * Math.PI / 180); ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend || "source-over";
    ctx.shadowColor = layer.shadowColor || "transparent"; ctx.shadowBlur = layer.shadowBlur || 0; ctx.shadowOffsetX = layer.shadowX || 0; ctx.shadowOffsetY = layer.shadowY || 0;
    if (layer.type === "image" || layer.type === "raster") {
      ctx.filter = `brightness(${layer.brightness ?? 100}%) contrast(${layer.contrast ?? 100}%) saturate(${layer.saturation ?? 100}%) hue-rotate(${layer.hue || 0}deg) grayscale(${layer.grayscale || 0}%) sepia(${layer.sepia || 0}%) invert(${layer.invert || 0}%) blur(${layer.blur || 0}px)`;
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1); ctx.drawImage(layer.type === "raster" ? layer.raster : layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height); ctx.filter = "none";
    } else if (layer.type === "text") {
      ctx.fillStyle = layer.color; ctx.strokeStyle = layer.textStroke || "transparent"; ctx.lineWidth = layer.textStrokeWidth || 0; ctx.font = `${layer.fontWeight || 700} ${layer.fontSize}px "${layer.fontFamily}",sans-serif`; ctx.textAlign = layer.textAlign || "center"; ctx.textBaseline = "middle";
      const lines = String(layer.text || "Văn bản").split("\n"), lineHeight = layer.fontSize * 1.22, anchor = layer.textAlign === "left" ? -layer.width / 2 : layer.textAlign === "right" ? layer.width / 2 : 0; lines.forEach((line, index) => { const y = (index - (lines.length - 1) / 2) * lineHeight; if (layer.textStrokeWidth) ctx.strokeText(line, anchor, y, layer.width); ctx.fillText(line, anchor, y, layer.width); });
    } else if (layer.type === "gradient") {
      let gradient; if (layer.gradientType === "radial") gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(layer.width, layer.height) / 2); else { const angle = (layer.gradientAngle || 0) * Math.PI / 180, dx = Math.cos(angle) * layer.width / 2, dy = Math.sin(angle) * layer.height / 2; gradient = ctx.createLinearGradient(-dx, -dy, dx, dy); } gradient.addColorStop(0, layer.colorA); gradient.addColorStop(1, layer.colorB); ctx.fillStyle = gradient; ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
    } else {
      ctx.fillStyle = layer.fill; ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.strokeWidth || 0;
      ctx.beginPath(); if (layer.shape === "circle") ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2); else ctx.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height); ctx.fill(); if (layer.strokeWidth) ctx.stroke();
    }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    if (selected) { const handle = 12 / Math.max(state.editor.zoom, .25); ctx.setLineDash([10, 7]); ctx.lineWidth = 2 / Math.max(state.editor.zoom, .25); ctx.strokeStyle = "#55e5eb"; ctx.strokeRect(-layer.width / 2 - 5, -layer.height / 2 - 5, layer.width + 10, layer.height + 10); ctx.setLineDash([]); ctx.fillStyle = "#f8ffff"; ctx.strokeStyle = "#1698a5"; [[-layer.width / 2, -layer.height / 2], [layer.width / 2, -layer.height / 2], [-layer.width / 2, layer.height / 2], [layer.width / 2, layer.height / 2]].forEach(([x, y]) => { ctx.fillRect(x - handle / 2, y - handle / 2, handle, handle); ctx.strokeRect(x - handle / 2, y - handle / 2, handle, handle); }); }
    ctx.restore();
  }
  function drawEditor() {
    const editor = state.editor; if (!editor) return;
    const { canvas, ctx } = editor; ctx.clearRect(0, 0, canvas.width, canvas.height); if (!editor.transparent) { ctx.fillStyle = editor.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (editor.grid && !editor.exporting) { ctx.save(); ctx.strokeStyle = "rgba(80,210,220,.22)"; ctx.lineWidth = 1; for (let x = 0; x <= canvas.width; x += editor.gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y <= canvas.height; y += editor.gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); } ctx.restore(); }
    editor.layers.forEach((layer) => drawLayer(ctx, layer, !editor.exporting && layer.id === editor.selected));
    canvas.style.width = `${Math.max(120, editor.width * editor.zoom)}px`; canvas.style.height = `${Math.max(80, editor.height * editor.zoom)}px`;
    const info = $(editor.work, "[data-adv-doc-info]"); if (info) info.textContent = `${editor.width} × ${editor.height} px · ${editor.layers.length} layer`;
  }
  function layerListMarkup() {
    const editor = state.editor;
    const codes = { image: "IMG", raster: "PXL", text: "TXT", shape: "SHP", gradient: "GRD" };
    return [...editor.layers].reverse().map((layer) => `<article class="${layer.id === editor.selected ? "is-active" : ""}" data-adv-layer="${layer.id}"><button type="button" data-adv-action="editor-visible" data-layer-id="${layer.id}" title="Ẩn/hiện">${layer.visible ? "◉" : "○"}</button><button type="button" data-adv-action="editor-lock" data-layer-id="${layer.id}" title="Khóa layer">${layer.locked ? "▣" : "□"}</button><span>${codes[layer.type] || "LYR"}</span><button type="button" data-adv-action="editor-select-layer" data-layer-id="${layer.id}"><strong>${esc(layer.name)}</strong><small>${layer.type} · ${Math.round(layer.opacity * 100)}%${layer.locked ? " · khóa" : ""}</small></button></article>`).join("") || '<div class="mdx-layer-empty">Mở ảnh hoặc thêm layer để bắt đầu.</div>';
  }
  function renderLayerList() { const node = state.editor && $(state.editor.work, "[data-adv-layer-list]"); if (node) node.innerHTML = layerListMarkup(); }
  function syncEditorUi() {
    const editor = state.editor; if (!editor) return; const layer = selectedLayer();
    renderLayerList();
    $$ (editor.work, "[data-adv-prop]").forEach((input) => { const key = input.dataset.advProp; input.disabled = !layer; if (layer && key in layer) input.value = key === "opacity" ? Math.round(layer[key] * 100) : layer[key]; });
    const kind = $(editor.work, "[data-adv-selected-kind]"); if (kind) kind.textContent = layer ? `${layer.name} · ${layer.type}` : "Chưa chọn layer";
    $(editor.work, "[data-adv-image-controls]").hidden = !["image", "raster"].includes(layer?.type);
    $(editor.work, "[data-adv-text-controls]").hidden = layer?.type !== "text";
    $(editor.work, "[data-adv-shape-controls]").hidden = layer?.type !== "shape";
    $(editor.work, "[data-adv-gradient-controls]").hidden = layer?.type !== "gradient";
    const preset = $(editor.work, "[data-adv-filter-preset]"); if (preset) preset.value = "custom";
    $$ (editor.work, "[data-adv-doc]").forEach((input) => { input.value = editor[input.dataset.advDoc]; });
    const transparent = $(editor.work, "[data-adv-doc-transparent]"); if (transparent) transparent.checked = editor.transparent;
  }
  function selectEditorLayer(id) { if (!state.editor?.layers.some((layer) => layer.id === id)) return; state.editor.selected = id; syncEditorUi(); drawEditor(); }
  function addEditorLayer(layer) { state.editor.layers.push(layer); state.editor.selected = layer.id; pushHistory(); syncEditorUi(); drawEditor(); }
  function duplicateEditorLayer(layer) { if (!layer) return; addEditorLayer({ ...layer, id: uid(), raster: layer.type === "raster" ? cloneRaster(layer.raster) : layer.raster, name: `${layer.name} copy`, x: layer.x + 24, y: layer.y + 24 }); }
  const editorPoint = (event) => { const editor = state.editor, rect = editor.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * editor.canvas.width / rect.width, y: (event.clientY - rect.top) * editor.canvas.height / rect.height }; };
  const layerPoint = (layer, point) => { const angle = -layer.rotation * Math.PI / 180, dx = point.x - layer.x, dy = point.y - layer.y; return { x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / layer.width * (layer.raster?.width || layer.width) + (layer.raster?.width || layer.width) / 2, y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / layer.height * (layer.raster?.height || layer.height) + (layer.raster?.height || layer.height) / 2 }; };
  const hitLayer = (point) => [...state.editor.layers].reverse().find((layer) => { if (!layer.visible) return false; const local = layerPoint(layer, point), width = layer.raster?.width || layer.width, height = layer.raster?.height || layer.height; return local.x >= 0 && local.x <= width && local.y >= 0 && local.y <= height; });
  function setEditorTool(tool) { const editor = state.editor; if (!editor) return; editor.tool = tool; $$(editor.work, "[data-editor-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.editorTool === tool)); const names = { select: "Chọn / Transform", brush: "Brush", eraser: "Eraser", eyedropper: "Eyedropper", pan: "Hand / Pan" }; $(editor.work, "[data-adv-active-tool]").textContent = names[tool] || tool; editor.canvas.dataset.tool = tool; }
  function newRasterLayer(name = "Raster layer") { const editor = state.editor, raster = document.createElement("canvas"); raster.width = editor.width; raster.height = editor.height; return makeLayer("raster", { name, raster, x: editor.width / 2, y: editor.height / 2, width: editor.width, height: editor.height, brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0, blur: 0, shadowColor: "#000000", shadowBlur: 0, shadowX: 0, shadowY: 0, flipX: false, flipY: false }); }
  function ensureRasterLayer() { const current = selectedLayer(); if (current?.type === "raster" && !current.locked) return current; const layer = newRasterLayer(state.editor.tool === "eraser" ? "Eraser layer" : "Brush layer"); addEditorLayer(layer); return layer; }
  function paintRaster(layer, from, to, erase = false) { const editor = state.editor, ctx = layer.raster.getContext("2d"), size = editor.brush.size * layer.raster.width / layer.width; ctx.save(); ctx.globalCompositeOperation = erase ? "destination-out" : "source-over"; ctx.globalAlpha = editor.brush.opacity; ctx.strokeStyle = editor.brush.color; ctx.fillStyle = editor.brush.color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = size; ctx.filter = `blur(${Math.max(0, (1 - editor.brush.hardness) * size * .22)}px)`; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.restore(); }
  function sampleEditorColor(point) { const editor = state.editor, selected = editor.selected; editor.exporting = true; editor.selected = null; drawEditor(); const pixel = editor.ctx.getImageData(clamp(Math.round(point.x), 0, editor.width - 1), clamp(Math.round(point.y), 0, editor.height - 1), 1, 1).data, color = `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, "0")).join("")}`; editor.exporting = false; editor.selected = selected; editor.brush.color = color; $(editor.work, "[data-adv-brush='color']").value = color; drawEditor(); status(editor.work, `Đã lấy màu ${color}.`, "success"); }
  function setupEditor(work) {
    const canvas = $(work, "[data-adv-editor-canvas]");
    state.editor = { work, canvas, stage: $(work, "[data-adv-editor-stage]"), ctx: canvas.getContext("2d", { willReadFrequently: true }), width: 1280, height: 720, background: "#ffffff", transparent: false, zoom: .75, tool: "select", brush: { color: "#ec4899", size: 36, opacity: 1, hardness: .85 }, grid: false, snap: false, gridSize: 50, exporting: false, layers: [], selected: null, history: [], historyIndex: -1, drag: null };
    pushHistory(); syncEditorUi(); setEditorTool("select"); drawEditor();
    canvas.addEventListener("pointerdown", (event) => {
      const editor = state.editor, point = editorPoint(event);
      if (["brush", "eraser"].includes(editor.tool)) { const layer = ensureRasterLayer(), local = layerPoint(layer, point); paintRaster(layer, local, local, editor.tool === "eraser"); editor.drag = { type: "paint", layer, last: local, moved: true }; canvas.setPointerCapture(event.pointerId); drawEditor(); return; }
      if (editor.tool === "eyedropper") { sampleEditorColor(point); return; }
      if (editor.tool === "pan") { editor.drag = { type: "pan", clientX: event.clientX, clientY: event.clientY, left: editor.stage.scrollLeft, top: editor.stage.scrollTop }; canvas.setPointerCapture(event.pointerId); return; }
      const current = selectedLayer(); if (current && !current.locked) { const local = layerPoint(current, point), sourceWidth = current.raster?.width || current.width, sourceHeight = current.raster?.height || current.height, margin = 22 / editor.zoom * sourceWidth / current.width; if (Math.abs(local.x - sourceWidth) < margin && Math.abs(local.y - sourceHeight) < margin) { editor.drag = { type: "resize", id: current.id, start: point, width: current.width, height: current.height, ratio: current.width / current.height, moved: false }; canvas.setPointerCapture(event.pointerId); return; } }
      const hit = hitLayer(point);
      if (!hit) { editor.selected = null; syncEditorUi(); drawEditor(); return; }
      selectEditorLayer(hit.id); if (hit.locked) return; editor.drag = { type: "move", id: hit.id, offsetX: point.x - hit.x, offsetY: point.y - hit.y, moved: false }; canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => { const editor = state.editor, point = editorPoint(event), info = $(work, "[data-adv-pointer-info]"); if (info) info.textContent = `X ${Math.round(point.x)} · Y ${Math.round(point.y)}`; if (!editor?.drag) return; if (editor.drag.type === "paint") { const next = layerPoint(editor.drag.layer, point); paintRaster(editor.drag.layer, editor.drag.last, next, editor.tool === "eraser"); editor.drag.last = next; drawEditor(); return; } if (editor.drag.type === "pan") { editor.stage.scrollLeft = editor.drag.left - (event.clientX - editor.drag.clientX); editor.stage.scrollTop = editor.drag.top - (event.clientY - editor.drag.clientY); return; } const layer = editor.layers.find((item) => item.id === editor.drag.id); if (!layer) return; if (editor.drag.type === "resize") { const dx = point.x - editor.drag.start.x, nextWidth = Math.max(10, editor.drag.width + dx * 2); layer.width = editor.snap ? Math.round(nextWidth / editor.gridSize) * editor.gridSize : Math.round(nextWidth); layer.height = Math.round(layer.width / editor.drag.ratio); } else { const nextX = point.x - editor.drag.offsetX, nextY = point.y - editor.drag.offsetY; layer.x = editor.snap ? Math.round(nextX / editor.gridSize) * editor.gridSize : Math.round(nextX); layer.y = editor.snap ? Math.round(nextY / editor.gridSize) * editor.gridSize : Math.round(nextY); } editor.drag.moved = true; syncEditorUi(); drawEditor(); });
    const finishPointer = () => { if (state.editor?.drag?.moved) pushHistory(); if (state.editor) state.editor.drag = null; };
    canvas.addEventListener("pointerup", finishPointer); canvas.addEventListener("pointercancel", finishPointer);
    canvas.addEventListener("wheel", (event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); const editor = state.editor; editor.zoom = clamp(editor.zoom + (event.deltaY < 0 ? .1 : -.1), .1, 3); const select = $(work, "[data-adv-editor-zoom]"); if ([...select.options].some((option) => Number(option.value) === editor.zoom)) select.value = editor.zoom; drawEditor(); }, { passive: false });
  }
  async function addEditorImages(files) {
    const editor = state.editor; if (!editor) return;
    status(editor.work, `Đang mở ${files.length} ảnh...`);
    for (const file of files.slice(0, 12)) {
      const image = await loadImage(file); const ratio = Math.min(1, editor.width * .72 / image.naturalWidth, editor.height * .72 / image.naturalHeight);
      addEditorLayer(makeLayer("image", { name: file.name.replace(/\.[^.]+$/, ""), image, width: Math.round(image.naturalWidth * ratio), height: Math.round(image.naturalHeight * ratio), brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0, blur: 0, shadowColor: "#000000", shadowBlur: 0, shadowX: 0, shadowY: 0, flipX: false, flipY: false }));
    }
    status(editor.work, `Đã thêm ${files.length} ảnh vào layer.`, "success");
  }
  const imageFromSource = (source) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Project chứa nguồn ảnh không hợp lệ.")); image.src = source; });
  function drawableDataUrl(layer) { if (layer.type === "raster") return layer.raster.toDataURL("image/png"); if (layer.type !== "image") return ""; const canvas = document.createElement("canvas"), image = layer.image; canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height; canvas.getContext("2d").drawImage(image, 0, 0); return canvas.toDataURL("image/png"); }
  async function saveEditorProject() {
    const editor = state.editor; if (!editor) return;
    status(editor.work, "Đang đóng gói project...");
    const layers = editor.layers.map((layer) => { const clean = { ...layer }; delete clean.image; delete clean.raster; const source = drawableDataUrl(layer); return { ...clean, source }; });
    const project = { format: "HH Photo Project", version: 2, savedAt: new Date().toISOString(), document: { width: editor.width, height: editor.height, background: editor.background, transparent: editor.transparent }, layers };
    const blob = new Blob([JSON.stringify(project)], { type: "application/json;charset=utf-8" }); download(blob, `hh-photo-${Date.now()}.hhphoto`); historyAdd("Photo Editor", "Lưu project", `${layers.length} layer · ${bytes(blob.size)}`); status(editor.work, `Đã lưu project ${bytes(blob.size)}.`, "success");
  }
  async function openEditorProject(file) {
    const editor = state.editor, project = JSON.parse(await file.text()); if (project.format !== "HH Photo Project" || !Array.isArray(project.layers)) throw new Error("Đây không phải project HH Photo hợp lệ.");
    status(editor.work, "Đang khôi phục project..."); const layers = [];
    for (const saved of project.layers.slice(0, 40)) { const layer = { ...saved }; delete layer.source; if (saved.source && saved.type === "image") layer.image = await imageFromSource(saved.source); if (saved.source && saved.type === "raster") { const image = await imageFromSource(saved.source), raster = document.createElement("canvas"); raster.width = image.naturalWidth || image.width; raster.height = image.naturalHeight || image.height; raster.getContext("2d").drawImage(image, 0, 0); layer.raster = raster; } layers.push(layer); }
    editor.width = clamp(project.document?.width, 64, 6000); editor.height = clamp(project.document?.height, 64, 6000); editor.background = project.document?.background || "#ffffff"; editor.transparent = Boolean(project.document?.transparent); editor.canvas.width = editor.width; editor.canvas.height = editor.height; editor.layers = layers; editor.selected = layers.at(-1)?.id || null; editor.history = []; editor.historyIndex = -1; pushHistory(); syncEditorUi(); drawEditor(); status(editor.work, `Đã mở ${file.name} · ${layers.length} layer.`, "success");
  }
  async function flattenEditor() {
    const editor = state.editor; if (!editor || !editor.layers.length) return;
    editor.exporting = true; drawEditor();
    const raster = cloneRaster(editor.canvas); editor.exporting = false;
    const layer = newRasterLayer("Merged artwork"); layer.raster = raster; editor.layers = [layer]; editor.selected = layer.id; pushHistory(); syncEditorUi(); drawEditor(); status(editor.work, "Đã gộp toàn bộ layer. Bạn vẫn có thể hoàn tác bằng Ctrl+Z.", "success");
  }
  async function exportEditor() {
    const editor = state.editor; if (!editor) return; editor.exporting = true; drawEditor();
    const type = $(editor.work, "[data-adv-export-type]").value, quality = Number($(editor.work, "[data-adv-export-quality]").value) / 100; let source = editor.canvas; if (type === "image/jpeg" && editor.transparent) { source = document.createElement("canvas"); source.width = editor.width; source.height = editor.height; const ctx = source.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, source.width, source.height); ctx.drawImage(editor.canvas, 0, 0); } const blob = await canvasBlob(source, type, quality); editor.exporting = false; drawEditor();
    download(blob, `hh-photo-editor.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`); historyAdd("Photo Editor", "Xuất tác phẩm", `${editor.width}×${editor.height} · ${editor.layers.length} layer · ${bytes(blob.size)}`); status(editor.work, `Đã xuất ${bytes(blob.size)}.`, "success");
  }

  function removerMarkup() {
    return `${header("Background Remover", "Xóa nền theo màu, lấy mẫu trực tiếp từ ảnh và làm mềm viền trước khi xuất PNG.", "CUT-01", ["Color key", "Edge feather", "Pixel picker", "PNG alpha"])}<div class="mdx-remover"><section class="mdx-settings"><label class="md-upload"><input type="file" accept="image/*" data-adv-file="remover"><span>＋</span><strong>Chọn ảnh cần xóa nền</strong><small>PNG, JPEG, WebP</small></label><div class="mdx-control-grid"><label>Màu nền<input type="color" value="#ffffff" data-adv-remove="color"></label><label>Ngưỡng <b data-adv-remove-value="threshold">55</b><input type="range" min="0" max="255" value="55" data-adv-remove="threshold"></label><label>Làm mềm viền <b data-adv-remove-value="feather">28</b><input type="range" min="1" max="120" value="28" data-adv-remove="feather"></label><label>Nền xem trước<select data-adv-remove="preview"><option value="checker">Trong suốt</option><option value="white">Trắng</option><option value="black">Đen</option><option value="pink">Hồng</option></select></label></div><div class="md-actions"><button class="md-button" type="button" data-adv-action="remove-auto">Lấy màu bốn góc</button><button class="md-button primary" type="button" data-adv-action="remove-process">Xóa nền</button><button class="md-button" type="button" data-adv-action="remove-export" disabled>Tải PNG</button></div><p class="mdx-tip">Mẹo: bấm vào vùng nền trên ảnh gốc để lấy đúng màu cần xóa.</p></section><section class="mdx-remove-preview"><article><header><strong>Ảnh gốc</strong><small>Chọn màu bằng cách bấm ảnh</small></header><div><canvas data-adv-remove-source></canvas><span data-adv-remove-empty>Chưa có ảnh</span></div></article><article><header><strong>Kết quả</strong><small data-adv-remove-stats>Chờ xử lý</small></header><div data-adv-remove-result-wrap><canvas data-adv-remove-result></canvas><span data-adv-remove-empty>Chưa có kết quả</span></div></article></section></div>`;
  }
  function setupRemover(work) { state.remover = { work, imageData: null, result: null, width: 0, height: 0 }; const canvas = $(work, "[data-adv-remove-source]"); canvas.addEventListener("click", (event) => { if (!state.remover?.imageData) return; const rect = canvas.getBoundingClientRect(), x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width), y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height), pixel = state.remover.imageData.data, index = (y * canvas.width + x) * 4, color = `#${[pixel[index], pixel[index + 1], pixel[index + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`; $(work, "[data-adv-remove='color']").value = color; processRemoval(); }); }
  async function loadRemover(file) { const remover = state.remover, image = await loadImage(file), max = 1600, ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight)), width = Math.round(image.naturalWidth * ratio), height = Math.round(image.naturalHeight * ratio), canvas = $(remover.work, "[data-adv-remove-source]"); canvas.width = width; canvas.height = height; canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, width, height); remover.imageData = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height); remover.width = width; remover.height = height; canvas.parentElement.querySelector("[data-adv-remove-empty]")?.remove(); autoRemoveColor(); processRemoval(); status(remover.work, `${file.name} · ${width}×${height}`, "success"); }
  function autoRemoveColor() { const remover = state.remover; if (!remover?.imageData) return; const { data, width, height } = remover.imageData, points = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]], rgb = [0, 0, 0]; points.forEach(([x, y]) => { const i = (y * width + x) * 4; rgb[0] += data[i]; rgb[1] += data[i + 1]; rgb[2] += data[i + 2]; }); const color = `#${rgb.map((v) => Math.round(v / 4).toString(16).padStart(2, "0")).join("")}`; $(remover.work, "[data-adv-remove='color']").value = color; }
  function processRemoval() { const remover = state.remover; if (!remover?.imageData) return; const work = remover.work, hex = $(work, "[data-adv-remove='color']").value, target = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)), threshold = Number($(work, "[data-adv-remove='threshold']").value), feather = Number($(work, "[data-adv-remove='feather']").value), output = new ImageData(new Uint8ClampedArray(remover.imageData.data), remover.width, remover.height); let removed = 0; for (let i = 0; i < output.data.length; i += 4) { const distance = Math.hypot(output.data[i] - target[0], output.data[i + 1] - target[1], output.data[i + 2] - target[2]); const alpha = clamp((distance - threshold) / Math.max(1, feather), 0, 1); output.data[i + 3] = Math.round(output.data[i + 3] * alpha); if (alpha < .08) removed++; } const canvas = $(work, "[data-adv-remove-result]"); canvas.width = remover.width; canvas.height = remover.height; canvas.getContext("2d").putImageData(output, 0, 0); remover.result = output; canvas.parentElement.querySelector("[data-adv-remove-empty]")?.remove(); $(work, "[data-adv-action='remove-export']").disabled = false; $(work, "[data-adv-remove-stats]").textContent = `${Math.round(removed / (remover.width * remover.height) * 100)}% nền đã xóa`; updateRemovePreview(); }
  function updateRemovePreview() { const remover = state.remover; if (!remover) return; const wrap = $(remover.work, "[data-adv-remove-result-wrap]"), value = $(remover.work, "[data-adv-remove='preview']").value; wrap.dataset.preview = value; }

  function collageMarkup() {
    return `${header("Collage Maker", "Ghép tối đa 12 ảnh theo lưới, ảnh nổi bật hoặc dải ngang và xuất ảnh độ phân giải cao.", "COL-01", ["12 images", "Smart cover", "Custom gap", "High-res export"])}<div class="mdx-collage"><section class="mdx-settings"><label class="md-upload"><input type="file" accept="image/*" multiple data-adv-file="collage"><span>＋</span><strong>Chọn nhiều ảnh để ghép</strong><small>Tối đa 12 ảnh</small></label><div class="mdx-collage-files" data-adv-collage-list><p>Chưa có ảnh.</p></div><div class="mdx-control-grid"><label>Bố cục<select data-adv-collage="layout"><option value="grid">Lưới đều</option><option value="feature">Ảnh nổi bật</option><option value="strip">Dải ngang</option></select></label><label>Số cột<input type="number" min="1" max="6" value="3" data-adv-collage="columns"></label><label>Khoảng cách<input type="range" min="0" max="80" value="16" data-adv-collage="gap"></label><label>Bo góc<input type="range" min="0" max="80" value="16" data-adv-collage="radius"></label><label>Rộng<input type="number" min="320" max="5000" value="1800" data-adv-collage="width"></label><label>Cao<input type="number" min="320" max="5000" value="1200" data-adv-collage="height"></label><label>Màu nền<input type="color" value="#111827" data-adv-collage="background"></label><label>Định dạng<select data-adv-collage="type"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label></div><div class="md-actions"><button class="md-button" type="button" data-adv-action="collage-shuffle">Trộn ảnh</button><button class="md-button primary" type="button" data-adv-action="collage-render">Tạo collage</button><button class="md-button" type="button" data-adv-action="collage-export" disabled>Tải ảnh</button></div></section><section class="mdx-collage-preview"><header><strong>Canvas thành phẩm</strong><span data-adv-collage-info>1800 × 1200</span></header><div><canvas width="1800" height="1200" data-adv-collage-canvas></canvas><span data-adv-collage-empty>Thêm ảnh để xem trước</span></div></section></div>`;
  }
  function setupCollage(work) { state.collage = { work, files: [], images: [] }; drawCollage(); }
  async function loadCollage(files) { const collage = state.collage; collage.files = files.slice(0, 12); collage.images = []; status(collage.work, `Đang đọc ${collage.files.length} ảnh...`); for (const file of collage.files) collage.images.push(await loadImage(file)); renderCollageList(); drawCollage(); status(collage.work, `Đã thêm ${collage.files.length} ảnh.`, "success"); }
  function renderCollageList() { const collage = state.collage, node = $(collage.work, "[data-adv-collage-list]"); node.innerHTML = collage.files.length ? collage.files.map((file, index) => `<article><span>${index + 1}</span><div><strong>${esc(file.name)}</strong><small>${bytes(file.size)}</small></div><button type="button" data-adv-action="collage-remove" data-index="${index}" title="Bỏ ảnh">×</button></article>`).join("") : "<p>Chưa có ảnh.</p>"; }
  function roundedRect(ctx, x, y, width, height, radius) { const r = Math.min(radius, width / 2, height / 2); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, width, height, r) : ctx.rect(x, y, width, height); }
  function coverImage(ctx, image, x, y, width, height, radius) { const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight), sw = width / scale, sh = height / scale, sx = (image.naturalWidth - sw) / 2, sy = (image.naturalHeight - sh) / 2; ctx.save(); roundedRect(ctx, x, y, width, height, radius); ctx.clip(); ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height); ctx.restore(); }
  function collageCells(count, layout, width, height, columns, gap) { if (!count) return []; if (layout === "feature" && count > 1) { const mainWidth = width * .64 - gap / 2, sideWidth = width - mainWidth - gap, sideHeight = (height - gap * (count - 2)) / (count - 1); return [{ x: 0, y: 0, w: mainWidth, h: height }, ...Array.from({ length: count - 1 }, (_, index) => ({ x: mainWidth + gap, y: index * (sideHeight + gap), w: sideWidth, h: sideHeight }))]; } if (layout === "strip") { const cellWidth = (width - gap * (count - 1)) / count; return Array.from({ length: count }, (_, index) => ({ x: index * (cellWidth + gap), y: 0, w: cellWidth, h: height })); } const cols = Math.min(columns, count), rows = Math.ceil(count / cols), cellWidth = (width - gap * (cols - 1)) / cols, cellHeight = (height - gap * (rows - 1)) / rows; return Array.from({ length: count }, (_, index) => ({ x: index % cols * (cellWidth + gap), y: Math.floor(index / cols) * (cellHeight + gap), w: cellWidth, h: cellHeight })); }
  function drawCollage() { const collage = state.collage; if (!collage) return; const work = collage.work, canvas = $(work, "[data-adv-collage-canvas]"), width = clamp($(work, "[data-adv-collage='width']").value, 320, 5000), height = clamp($(work, "[data-adv-collage='height']").value, 320, 5000), gap = clamp($(work, "[data-adv-collage='gap']").value, 0, 80), radius = clamp($(work, "[data-adv-collage='radius']").value, 0, 80), columns = clamp($(work, "[data-adv-collage='columns']").value, 1, 6), layout = $(work, "[data-adv-collage='layout']").value; canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d"); ctx.fillStyle = $(work, "[data-adv-collage='background']").value; ctx.fillRect(0, 0, width, height); collageCells(collage.images.length, layout, width, height, columns, gap).forEach((cell, index) => coverImage(ctx, collage.images[index], cell.x, cell.y, cell.w, cell.h, radius)); $(work, "[data-adv-collage-info]").textContent = `${width} × ${height} · ${collage.images.length} ảnh`; if (collage.images.length) { $(work, "[data-adv-collage-empty]")?.remove(); $(work, "[data-adv-action='collage-export']").disabled = false; } }

  function inspectorMarkup() {
    return `${header("Image Inspector", "Đọc thông số ảnh, EXIF phổ biến, SHA-256, màu đại diện và xuất bản sao đã xóa metadata.", "META-01", ["EXIF", "SHA-256", "Color analysis", "Strip metadata"])}<div class="mdx-inspector-tool"><section class="mdx-settings"><label class="md-upload"><input type="file" accept="image/*" data-adv-file="inspector"><span>＋</span><strong>Chọn ảnh để phân tích</strong><small>JPEG, PNG, WebP, GIF</small></label><div class="mdx-inspector-preview"><canvas data-adv-inspector-canvas></canvas><span data-adv-inspector-empty>Chưa có ảnh</span></div><div class="md-actions"><button class="md-button" type="button" data-adv-action="inspector-copy" disabled>Sao chép báo cáo</button><button class="md-button primary" type="button" data-adv-action="inspector-strip" disabled>Xóa metadata & tải</button></div></section><section><div class="mdx-meta-grid" data-adv-meta-grid><article><span>Trạng thái</span><strong>Chờ chọn ảnh</strong><small>Thông tin sẽ xuất hiện tại đây.</small></article></div><div class="mdx-hash"><span>SHA-256</span><code data-adv-hash>—</code></div></section></div>`;
  }
  function setupInspector(work) { state.inspector = { work, file: null, image: null, report: null }; }
  function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  function readExif(buffer) {
    try {
      const view = new DataView(buffer); if (view.getUint16(0) !== 0xffd8) return {};
      let offset = 2, tiff = -1; while (offset + 4 < view.byteLength) { const marker = view.getUint16(offset); const size = view.getUint16(offset + 2); if (marker === 0xffe1 && String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4)) === "Exif") { tiff = offset + 10; break; } offset += 2 + size; }
      if (tiff < 0) return {}; const little = view.getUint16(tiff) === 0x4949, u16 = (at) => view.getUint16(at, little), u32 = (at) => view.getUint32(at, little), first = tiff + u32(tiff + 4), result = {}, tags = { 0x010f: "Máy ảnh", 0x0110: "Model", 0x0112: "Hướng ảnh", 0x0132: "Ngày sửa", 0x013b: "Tác giả", 0x8298: "Bản quyền" };
      const count = u16(first); for (let index = 0; index < Math.min(count, 80); index++) { const entry = first + 2 + index * 12, tag = u16(entry), type = u16(entry + 2), length = u32(entry + 4); if (!tags[tag]) continue; let value = ""; if (type === 2) { const start = length <= 4 ? entry + 8 : tiff + u32(entry + 8); value = String.fromCharCode(...new Uint8Array(buffer, start, Math.max(0, length - 1))).trim(); } else if (type === 3) value = u16(entry + 8); else if (type === 4) value = u32(entry + 8); if (value !== "") result[tags[tag]] = value; }
      return result;
    } catch { return {}; }
  }
  async function inspectImage(file) { const inspector = state.inspector, image = await loadImage(file), canvas = $(inspector.work, "[data-adv-inspector-canvas]"), max = 900, ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio); const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); canvas.parentElement.querySelector("[data-adv-inspector-empty]")?.remove(); const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data, totals = [0, 0, 0]; let samples = 0; for (let index = 0; index < sample.length; index += Math.max(4, Math.floor(sample.length / 8000 / 4) * 4)) { totals[0] += sample[index]; totals[1] += sample[index + 1]; totals[2] += sample[index + 2]; samples++; } const dominant = `#${totals.map((value) => Math.round(value / samples).toString(16).padStart(2, "0")).join("")}`, buffer = await file.arrayBuffer(), hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map((value) => value.toString(16).padStart(2, "0")).join(""), divisor = gcd(image.naturalWidth, image.naturalHeight), exif = readExif(buffer); inspector.file = file; inspector.image = image; inspector.report = { "Tên tệp": file.name, "Định dạng": file.type || "Không xác định", "Dung lượng": bytes(file.size), "Kích thước": `${image.naturalWidth} × ${image.naturalHeight}px`, "Megapixel": `${(image.naturalWidth * image.naturalHeight / 1e6).toFixed(2)} MP`, "Tỷ lệ": `${image.naturalWidth / divisor}:${image.naturalHeight / divisor}`, "Màu đại diện": dominant, "Sửa lần cuối": new Date(file.lastModified).toLocaleString("vi-VN"), ...exif }; $(inspector.work, "[data-adv-meta-grid]").innerHTML = Object.entries(inspector.report).map(([key, value]) => `<article><span>${esc(key)}</span><strong>${esc(value)}</strong>${key === "Màu đại diện" ? `<i style="background:${dominant}"></i>` : ""}</article>`).join(""); $(inspector.work, "[data-adv-hash]").textContent = hash; $(inspector.work, "[data-adv-action='inspector-copy']").disabled = false; $(inspector.work, "[data-adv-action='inspector-strip']").disabled = false; status(inspector.work, `Đã phân tích ${file.name}.`, "success"); }

  function render(outer, name) {
    cleanupAdvanced();
    if (!advanced.has(name)) return base.render(outer, name);
    outer.innerHTML = `<div class="media-design-workspace media-design-workspace--advanced" data-md-tool="${esc(name)}">${name === "Photo Editor" ? editorMarkup() : name === "Background Remover" ? removerMarkup() : name === "Collage Maker" ? collageMarkup() : inspectorMarkup()}</div>`;
    const work = $(outer, "[data-md-tool]");
    if (name === "Photo Editor") setupEditor(work); else if (name === "Background Remover") setupRemover(work); else if (name === "Collage Maker") setupCollage(work); else setupInspector(work);
  }

  function handleClick(event, outer, name) {
    if (!advanced.has(name)) return base.handleClick?.(event, outer, name);
    const work = $(outer, "[data-md-tool]"); if (!work) return false; const action = event.target.closest("[data-adv-action]")?.dataset.advAction;
    if (!action) return false;
    if (name === "Photo Editor") {
      const editor = state.editor, layer = selectedLayer();
      if (action === "editor-new") { editor.layers = []; editor.selected = null; editor.width = clamp($(work, "[data-adv-doc='width']").value, 64, 6000); editor.height = clamp($(work, "[data-adv-doc='height']").value, 64, 6000); editor.canvas.width = editor.width; editor.canvas.height = editor.height; pushHistory(); syncEditorUi(); drawEditor(); }
      if (action === "editor-tool") setEditorTool(event.target.closest("[data-editor-tool]").dataset.editorTool);
      if (action === "editor-add-raster") { addEditorLayer(newRasterLayer()); setEditorTool("brush"); }
      if (action === "editor-gradient") addEditorLayer(makeLayer("gradient", { name: "Gradient", x: editor.width / 2, y: editor.height / 2, width: editor.width, height: editor.height, colorA: "#ec4899", colorB: "#50e6e6", gradientType: "linear", gradientAngle: 135 }));
      if (action === "editor-save-project") saveEditorProject().catch((error) => status(work, error.message, "error"));
      if (action === "editor-flatten") flattenEditor().catch((error) => status(work, error.message, "error"));
      if (action === "editor-text") addEditorLayer(makeLayer("text", { name: "Văn bản", text: "HH Creative Studio", width: 520, height: 100, fontSize: 64, fontFamily: "Be Vietnam Pro", fontWeight: 800, textAlign: "center", color: "#111827", textStroke: "#ffffff", textStrokeWidth: 0 }));
      if (action === "editor-rect") addEditorLayer(makeLayer("shape", { name: "Chữ nhật", shape: "rect", fill: "#ec4899", stroke: "#ffffff", strokeWidth: 0 }));
      if (action === "editor-circle") addEditorLayer(makeLayer("shape", { name: "Hình tròn", shape: "circle", width: 240, height: 240, fill: "#50e6e6", stroke: "#ffffff", strokeWidth: 0 }));
      if (["editor-select-layer", "editor-visible", "editor-lock"].includes(action)) { const id = event.target.closest("[data-layer-id]")?.dataset.layerId, target = editor.layers.find((item) => item.id === id); if (action === "editor-visible" && target) { target.visible = !target.visible; pushHistory(); } if (action === "editor-lock" && target) { target.locked = !target.locked; pushHistory(); } selectEditorLayer(id); }
      if (action === "editor-delete" && layer && !layer.locked) { editor.layers = editor.layers.filter((item) => item.id !== layer.id); editor.selected = editor.layers.at(-1)?.id || null; pushHistory(); syncEditorUi(); drawEditor(); }
      if (action === "editor-duplicate" && layer) duplicateEditorLayer(layer);
      if (action === "editor-center" && layer) { layer.x = editor.width / 2; layer.y = editor.height / 2; pushHistory(); syncEditorUi(); drawEditor(); }
      if (action === "editor-flip-x" && ["image", "raster"].includes(layer?.type)) { layer.flipX = !layer.flipX; pushHistory(); drawEditor(); }
      if (action === "editor-flip-y" && ["image", "raster"].includes(layer?.type)) { layer.flipY = !layer.flipY; pushHistory(); drawEditor(); }
      if (action === "editor-crop" && layer) { const left = Math.round(layer.x - layer.width / 2), top = Math.round(layer.y - layer.height / 2); editor.layers.forEach((item) => { item.x -= left; item.y -= top; }); editor.width = Math.max(64, Math.round(layer.width)); editor.height = Math.max(64, Math.round(layer.height)); editor.canvas.width = editor.width; editor.canvas.height = editor.height; pushHistory(); syncEditorUi(); drawEditor(); }
      if (["editor-layer-up", "editor-layer-down"].includes(action) && layer) { const index = editor.layers.indexOf(layer), next = action === "editor-layer-up" ? Math.min(editor.layers.length - 1, index + 1) : Math.max(0, index - 1); [editor.layers[index], editor.layers[next]] = [editor.layers[next], editor.layers[index]]; pushHistory(); syncEditorUi(); drawEditor(); }
      if (action === "editor-undo") restoreHistory(editor.historyIndex - 1);
      if (action === "editor-redo") restoreHistory(editor.historyIndex + 1);
      if (action === "editor-export") exportEditor().catch((error) => status(work, error.message, "error"));
      if (action === "editor-reset-effects" && layer) { Object.assign(layer, { opacity: 1, blend: "source-over", brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0, blur: 0, shadowBlur: 0, shadowX: 0, shadowY: 0, rotation: 0 }); pushHistory(); syncEditorUi(); drawEditor(); }
      return true;
    }
    if (name === "Background Remover") {
      if (action === "remove-auto") { autoRemoveColor(); processRemoval(); }
      if (action === "remove-process") processRemoval();
      if (action === "remove-export" && state.remover?.result) canvasBlob($(work, "[data-adv-remove-result]"), "image/png").then((blob) => { download(blob, "hh-background-removed.png"); historyAdd("Background Remover", "Xuất ảnh xóa nền", `${state.remover.width}×${state.remover.height} · ${bytes(blob.size)}`); status(work, `Đã xuất PNG ${bytes(blob.size)}.`, "success"); });
      return true;
    }
    if (name === "Collage Maker") {
      if (action === "collage-render") drawCollage();
      if (action === "collage-shuffle") { for (let index = state.collage.images.length - 1; index > 0; index--) { const next = Math.floor(Math.random() * (index + 1)); [state.collage.images[index], state.collage.images[next]] = [state.collage.images[next], state.collage.images[index]]; [state.collage.files[index], state.collage.files[next]] = [state.collage.files[next], state.collage.files[index]]; } renderCollageList(); drawCollage(); }
      if (action === "collage-remove") { const index = Number(event.target.closest("[data-index]")?.dataset.index); state.collage.files.splice(index, 1); state.collage.images.splice(index, 1); renderCollageList(); drawCollage(); }
      if (action === "collage-export" && state.collage.images.length) { const type = $(work, "[data-adv-collage='type']").value; canvasBlob($(work, "[data-adv-collage-canvas]"), type, .92).then((blob) => { download(blob, `hh-collage.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`); historyAdd("Collage Maker", "Xuất collage", `${state.collage.images.length} ảnh · ${bytes(blob.size)}`); status(work, `Đã xuất ${bytes(blob.size)}.`, "success"); }); }
      return true;
    }
    if (name === "Image Inspector") {
      if (action === "inspector-copy" && state.inspector?.report) { const report = `${Object.entries(state.inspector.report).map(([key, value]) => `${key}: ${value}`).join("\n")}\nSHA-256: ${$(work, "[data-adv-hash]").textContent}`; navigator.clipboard.writeText(report).then(() => status(work, "Đã sao chép báo cáo.", "success")); }
      if (action === "inspector-strip" && state.inspector?.image) { const image = state.inspector.image, canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d").drawImage(image, 0, 0); const type = state.inspector.file.type === "image/png" ? "image/png" : "image/jpeg"; canvasBlob(canvas, type, .94).then((blob) => { download(blob, `clean-${state.inspector.file.name.replace(/\.[^.]+$/, type === "image/png" ? ".png" : ".jpg")}`); historyAdd("Image Inspector", "Xóa metadata", `${state.inspector.file.name} · ${bytes(blob.size)}`); status(work, "Đã tạo bản sao không chứa metadata.", "success"); }); }
      return true;
    }
    return false;
  }

  function handleInput(event, outer, name) {
    if (!advanced.has(name)) return base.handleInput?.(event, outer, name);
    const work = $(outer, "[data-md-tool]"); if (!work) return;
    if (name === "Photo Editor" && event.target.matches("[data-adv-prop]")) { const layer = selectedLayer(); if (!layer) return; const key = event.target.dataset.advProp, numeric = ["x", "y", "width", "height", "rotation", "opacity", "brightness", "contrast", "saturation", "hue", "grayscale", "sepia", "invert", "blur", "fontSize", "fontWeight", "textStrokeWidth", "strokeWidth", "gradientAngle", "shadowBlur", "shadowX", "shadowY"].includes(key); layer[key] = numeric ? Number(event.target.value) : event.target.value; if (key === "opacity") layer[key] /= 100; const value = $(work, `[data-adv-value='${key}']`); if (value) value.textContent = key === "blur" ? `${layer[key]}px` : key === "hue" ? `${layer[key]}°` : `${layer[key]}%`; renderLayerList(); drawEditor(); }
    if (name === "Photo Editor" && event.target.matches("[data-adv-brush]")) { const key = event.target.dataset.advBrush, numeric = key !== "color", raw = numeric ? Number(event.target.value) : event.target.value; state.editor.brush[key] = key === "opacity" || key === "hardness" ? raw / 100 : raw; const value = $(work, `[data-adv-brush-value='${key}']`); if (value) value.textContent = key === "size" ? `${raw}px` : `${raw}%`; }
    if (name === "Photo Editor" && event.target.matches("[data-adv-doc]")) { const key = event.target.dataset.advDoc; if (key === "background") { state.editor.background = event.target.value; drawEditor(); } }
    if (name === "Photo Editor" && event.target.matches("[data-adv-export-quality]")) $(work, "[data-adv-export-quality-value]").textContent = `${event.target.value}%`;
    if (name === "Background Remover" && event.target.matches("[data-adv-remove]")) { const key = event.target.dataset.advRemove, value = $(work, `[data-adv-remove-value='${key}']`); if (value) value.textContent = event.target.value; clearTimeout(state.timer); state.timer = setTimeout(() => key === "preview" ? updateRemovePreview() : processRemoval(), 70); }
    if (name === "Collage Maker" && event.target.matches("[data-adv-collage]")) { clearTimeout(state.timer); state.timer = setTimeout(drawCollage, 80); }
  }

  function applyEditorFilterPreset(value) {
    const layer = selectedLayer(); if (!layer || !["image", "raster"].includes(layer.type)) return;
    const presets = { vivid: { brightness: 106, contrast: 114, saturation: 145, hue: 0, grayscale: 0, sepia: 0, invert: 0 }, cinema: { brightness: 94, contrast: 122, saturation: 82, hue: -8, grayscale: 0, sepia: 10, invert: 0 }, mono: { brightness: 102, contrast: 118, saturation: 0, hue: 0, grayscale: 100, sepia: 0, invert: 0 }, sepia: { brightness: 104, contrast: 108, saturation: 72, hue: -12, grayscale: 0, sepia: 78, invert: 0 }, invert: { brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 100 } };
    if (presets[value]) Object.assign(layer, presets[value]); else return; pushHistory(); syncEditorUi(); drawEditor();
  }

  function handleChange(event, outer, name) {
    if (!advanced.has(name)) return base.handleChange?.(event, outer, name);
    const work = $(outer, "[data-md-tool]"); if (!work) return;
    if (event.target.matches("[data-adv-file='editor']")) addEditorImages([...event.target.files]).catch((error) => status(work, error.message, "error"));
    if (event.target.matches("[data-adv-project]")) { const file = event.target.files[0]; if (file) openEditorProject(file).catch((error) => status(work, error.message, "error")); }
    if (event.target.matches("[data-adv-file='remover']")) { const file = event.target.files[0]; if (file) loadRemover(file).catch((error) => status(work, error.message, "error")); }
    if (event.target.matches("[data-adv-file='collage']")) loadCollage([...event.target.files]).catch((error) => status(work, error.message, "error"));
    if (event.target.matches("[data-adv-file='inspector']")) { const file = event.target.files[0]; if (file) inspectImage(file).catch((error) => status(work, error.message, "error")); }
    if (name === "Photo Editor" && event.target.matches("[data-adv-prop]")) pushHistory();
    if (name === "Photo Editor" && event.target.matches("[data-adv-filter-preset]")) applyEditorFilterPreset(event.target.value);
    if (name === "Photo Editor" && event.target.matches("[data-adv-editor-zoom]")) { state.editor.zoom = Number(event.target.value); drawEditor(); }
    if (name === "Photo Editor" && event.target.matches("[data-adv-editor-preset]")) { const [width, height] = event.target.value.split("x").map(Number); if (width && height) { state.editor.width = width; state.editor.height = height; state.editor.canvas.width = width; state.editor.canvas.height = height; pushHistory(); syncEditorUi(); drawEditor(); } }
    if (name === "Photo Editor" && event.target.matches("[data-adv-doc-transparent]")) { state.editor.transparent = event.target.checked; pushHistory(); drawEditor(); }
    if (name === "Photo Editor" && event.target.matches("[data-adv-grid]")) { state.editor.grid = event.target.checked; drawEditor(); }
    if (name === "Photo Editor" && event.target.matches("[data-adv-snap]")) state.editor.snap = event.target.checked;
    if (name === "Photo Editor" && event.target.matches("[data-adv-doc]")) { const key = event.target.dataset.advDoc; if (["width", "height"].includes(key)) { state.editor[key] = clamp(event.target.value, 64, 6000); state.editor.canvas[key] = state.editor[key]; } else state.editor.background = event.target.value; pushHistory(); drawEditor(); }
    if (name === "Background Remover" && event.target.matches("[data-adv-remove='preview']")) updateRemovePreview();
  }

  addEventListener("keydown", (event) => {
    const editor = state.editor;
    if (!editor?.work?.isConnected || !location.hash.includes("/media-design") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const layer = selectedLayer(), key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
    if (command && key === "z") { event.preventDefault(); restoreHistory(editor.historyIndex - 1); return; }
    if (command && key === "y") { event.preventDefault(); restoreHistory(editor.historyIndex + 1); return; }
    if (command && key === "d" && layer) { event.preventDefault(); duplicateEditorLayer(layer); return; }
    if (command && key === "s") { event.preventDefault(); (event.shiftKey ? exportEditor() : saveEditorProject()).catch((error) => status(editor.work, error.message, "error")); return; }
    if (!command && { v: "select", b: "brush", e: "eraser", i: "eyedropper", h: "pan" }[key]) { setEditorTool({ v: "select", b: "brush", e: "eraser", i: "eyedropper", h: "pan" }[key]); return; }
    if (!command && ["[", "]"].includes(event.key)) { editor.brush.size = clamp(editor.brush.size + (event.key === "]" ? 5 : -5), 1, 300); const input = $(editor.work, "[data-adv-brush='size']"), value = $(editor.work, "[data-adv-brush-value='size']"); input.value = editor.brush.size; value.textContent = `${editor.brush.size}px`; return; }
    if (!command && layer && !layer.locked && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const amount = event.shiftKey ? 10 : 1; if (event.key === "ArrowLeft") layer.x -= amount; if (event.key === "ArrowRight") layer.x += amount; if (event.key === "ArrowUp") layer.y -= amount; if (event.key === "ArrowDown") layer.y += amount; pushHistory(); syncEditorUi(); drawEditor(); return; }
    if (event.key === "Delete" && layer && !layer.locked) { event.preventDefault(); editor.layers = editor.layers.filter((item) => item.id !== layer.id); editor.selected = editor.layers.at(-1)?.id || null; pushHistory(); syncEditorUi(); drawEditor(); }
    if (event.key === "Escape") { editor.selected = null; setEditorTool("select"); syncEditorUi(); drawEditor(); }
  });

  window.HHMediaDesign = {
    supports: (name) => advanced.has(name) || base.supports(name),
    render,
    cleanup() { cleanupAdvanced(); base.cleanup?.(); },
    handleClick,
    handleInput,
    handleChange
  };
})();
