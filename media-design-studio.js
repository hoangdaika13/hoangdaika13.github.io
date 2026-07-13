(() => {
  "use strict";

  const tools = new Set(["Image Compressor", "Image Converter", "Image Toolkit", "PDF Toolkit", "QR Toolkit", "Color Studio", "Typography Studio", "Icon Browser", "SVG Editor", "Gradient Generator", "Color Picker"]);
  const state = { urls: [], image: null, imageFile: null, resultBlob: null, pdfFiles: [], selectedIcon: "sparkles", pickerImage: null };
  const libraryJobs = new Map();
  const loadLibrary = (key, src, ready) => {
    if (ready()) return Promise.resolve();
    if (libraryJobs.has(key)) return libraryJobs.get(key);
    const job = new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = src; script.onload = () => ready() ? resolve() : reject(new Error(`Không thể khởi tạo ${key}.`)); script.onerror = () => reject(new Error(`Không thể tải ${key}.`)); document.head.append(script); });
    libraryJobs.set(key, job); return job;
  };
  const ensureToolLibraries = name => Promise.all([
    ...(name === "PDF Toolkit" ? [loadLibrary("PDF engine", "vendor/pdf-lib.min.js?v=1.17.1", () => Boolean(window.PDFLib))] : []),
    ...(name === "QR Toolkit" ? [loadLibrary("QR generator", "vendor/qrcode.js?v=2.0.4", () => Boolean(window.qrcode)), loadLibrary("QR scanner", "vendor/jsqr.js?v=1.4.0", () => Boolean(window.jsQR))] : []),
    ...(name === "Icon Browser" ? [loadLibrary("Lucide icons", "vendor/lucide.min.js?v=1.24.0", () => Boolean(window.lucide))] : [])
  ]);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
  const status = (work, message, type = "info") => { const node = work.querySelector("[data-md-status]"); if (node) { node.textContent = message; node.dataset.state = type; } };
  const rememberUrl = blob => { const url = URL.createObjectURL(blob); state.urls.push(url); return url; };
  const cleanup = () => { state.urls.splice(0).forEach(url => URL.revokeObjectURL(url)); state.image = null; state.imageFile = null; state.resultBlob = null; state.pdfFiles = []; };
  const downloadBlob = (blob, name) => { const anchor = document.createElement("a"); anchor.href = rememberUrl(blob); anchor.download = name; anchor.click(); };
  const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Trình duyệt không thể tạo file đầu ra.")), type, quality));
  const loadImage = file => new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không thể đọc ảnh này.")); }; image.src = url; });
  const fileBase = name => name.replace(/\.[^.]+$/, "") || "hh-design";
  const commonHeader = (name, description) => `<header class="md-head"><div><small>MEDIA & DESIGN</small><h3>${esc(name)}</h3><p>${esc(description)}</p></div><span class="md-private">Xử lý cục bộ · Không tải lên server</span></header><div class="md-status" data-md-status>Sẵn sàng.</div>`;
  const uploadBox = (accept, multiple = false, label = "Chọn file") => `<label class="md-upload"><input type="file" data-md-file accept="${esc(accept)}" ${multiple ? "multiple" : ""}><span>＋</span><strong>${esc(label)}</strong><small>Kéo thả hoặc bấm để chọn</small></label>`;
  const actionBar = (primaryAction, primaryLabel, downloadLabel = "Tải kết quả") => `<div class="md-actions"><button class="md-button primary" type="button" data-md-action="${primaryAction}">${primaryLabel}</button><button class="md-button" type="button" data-md-action="download" disabled>${downloadLabel}</button><button class="md-button subtle" type="button" data-md-action="reset">Làm lại</button></div>`;

  function imageWorkspace(name) {
    const compressor = name === "Image Compressor";
    const converter = name === "Image Converter";
    const description = compressor ? "Giảm dung lượng ảnh, thay đổi kích thước và so sánh trước/sau." : converter ? "Chuyển PNG, JPEG, WebP với nền và chất lượng tùy chỉnh." : "Resize, xoay, lật, chỉnh sáng, tương phản và grayscale.";
    const controls = compressor ? `<label>Định dạng<select data-md-format><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label><label>Chất lượng <b data-md-quality-value>82%</b><input type="range" min="10" max="100" value="82" data-md-quality></label><label>Cạnh tối đa<input type="number" min="64" max="8000" value="1920" data-md-max></label>` : converter ? `<label>Định dạng<select data-md-format><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label><label>Chất lượng <b data-md-quality-value>92%</b><input type="range" min="10" max="100" value="92" data-md-quality></label><label>Màu nền JPEG<input type="color" value="#ffffff" data-md-background></label>` : `<label>Rộng<input type="number" min="1" max="12000" data-md-width></label><label>Cao<input type="number" min="1" max="12000" data-md-height></label><label>Góc xoay<select data-md-rotate><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label>Độ sáng <b data-md-brightness-value>100%</b><input type="range" min="20" max="180" value="100" data-md-brightness></label><label>Tương phản <b data-md-contrast-value>100%</b><input type="range" min="20" max="180" value="100" data-md-contrast></label><label class="md-check"><input type="checkbox" data-md-grayscale> Đen trắng</label><label class="md-check"><input type="checkbox" data-md-flip-x> Lật ngang</label><label class="md-check"><input type="checkbox" data-md-flip-y> Lật dọc</label><label>Định dạng<select data-md-format><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>`;
    return `${commonHeader(name, description)}<div class="md-image-layout"><section>${uploadBox("image/*", false, "Chọn ảnh nguồn")}<div class="md-control-grid">${controls}</div>${actionBar("image-process", compressor ? "Nén ảnh" : converter ? "Chuyển đổi" : "Áp dụng chỉnh sửa")}</section><section class="md-preview-panel"><header><strong>Xem trước</strong><span data-md-image-meta>Chưa có ảnh</span></header><div class="md-canvas-stage"><canvas data-md-canvas></canvas><div data-md-placeholder>Ảnh sẽ hiển thị tại đây</div></div><div class="md-result-stats" data-md-result-stats></div></section></div>`;
  }

  function pdfWorkspace() {
    return `${commonHeader("PDF Toolkit", "Gộp nhiều PDF, trích xuất trang hoặc xoay toàn bộ tài liệu.")}<div class="md-pdf-layout"><section>${uploadBox("application/pdf,.pdf", true, "Chọn một hoặc nhiều PDF")}<div class="md-file-list" data-md-file-list><p>Chưa có tài liệu.</p></div></section><section class="md-settings-card"><label>Thao tác<select data-md-pdf-mode><option value="merge">Gộp PDF</option><option value="split">Trích xuất trang</option><option value="rotate">Xoay tất cả trang</option></select></label><label data-md-pages-wrap hidden>Trang cần lấy<input data-md-pages placeholder="Ví dụ: 1-3, 5, 8"></label><label data-md-rotation-wrap hidden>Góc xoay<select data-md-pdf-rotation><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><div class="md-pdf-summary" data-md-pdf-summary>Chọn file để bắt đầu.</div>${actionBar("pdf-process", "Xử lý PDF", "Tải PDF")}</section></div>`;
  }

  function qrWorkspace() {
    return `${commonHeader("QR Toolkit", "Tạo mã QR tùy màu và đọc QR trực tiếp từ ảnh.")}<div class="md-qr-layout"><section class="md-settings-card"><div class="md-segment"><button class="active" type="button" data-md-qr-tab="generate">Tạo QR</button><button type="button" data-md-qr-tab="scan">Quét ảnh QR</button></div><div data-md-qr-pane="generate"><label>Nội dung<textarea rows="5" data-md-qr-text placeholder="URL, văn bản, Wi-Fi, số điện thoại...">${esc(location.href)}</textarea></label><div class="md-control-grid"><label>Kích thước<input type="number" min="128" max="1200" value="420" data-md-qr-size></label><label>Mức sửa lỗi<select data-md-qr-level><option>L</option><option selected>M</option><option>Q</option><option>H</option></select></label><label>Màu mã<input type="color" value="#111827" data-md-qr-dark></label><label>Màu nền<input type="color" value="#ffffff" data-md-qr-light></label></div><div class="md-actions"><button class="md-button primary" type="button" data-md-action="qr-generate">Tạo mã QR</button><button class="md-button" type="button" data-md-action="qr-download" disabled>Tải PNG</button></div></div><div data-md-qr-pane="scan" hidden>${uploadBox("image/*", false, "Chọn ảnh chứa QR")}<pre data-md-qr-result>Chưa quét.</pre></div></section><section class="md-preview-panel"><header><strong>QR Preview</strong><span>PNG sắc nét</span></header><div class="md-qr-preview"><canvas data-md-qr-canvas></canvas><div data-md-placeholder>Mã QR sẽ xuất hiện tại đây</div></div></section></div>`;
  }

  function colorStudioWorkspace() {
    return `${commonHeader("Color Studio", "Tạo palette, kiểm tra tương phản WCAG và xuất biến CSS.")}<div class="md-color-layout"><section class="md-settings-card"><label>Màu chủ đạo<div class="md-color-input"><input type="color" value="#ec4899" data-md-base-color><input value="#EC4899" data-md-base-hex maxlength="7"></div></label><label>Màu chữ<input type="color" value="#ffffff" data-md-text-color></label><div class="md-actions"><button class="md-button primary" type="button" data-md-action="color-generate">Tạo palette</button><button class="md-button" type="button" data-md-action="color-copy">Sao chép CSS</button></div><div class="md-contrast-card" data-md-contrast-card>Contrast: --</div></section><section class="md-palette" data-md-palette></section></div>`;
  }

  function typographyWorkspace() {
    return `${commonHeader("Typography Studio", "Thử kiểu chữ, nhịp dòng và xuất CSS typography hoàn chỉnh.")}<div class="md-type-layout"><section class="md-settings-card"><label>Font<select data-md-font><option>Inter</option><option>Segoe UI</option><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option><option>Verdana</option></select></label><label>Cỡ chữ <b data-md-font-size-value>42px</b><input type="range" min="12" max="96" value="42" data-md-font-size></label><label>Độ đậm<select data-md-font-weight><option>300</option><option selected>600</option><option>700</option><option>800</option><option>900</option></select></label><label>Chiều cao dòng <b data-md-line-value>1.35</b><input type="range" min="10" max="24" value="14" data-md-line></label><label>Khoảng cách chữ <b data-md-spacing-value>0px</b><input type="range" min="0" max="12" value="0" data-md-spacing></label><div class="md-actions"><button class="md-button" type="button" data-md-action="type-copy">Sao chép CSS</button><button class="md-button" type="button" data-md-action="type-download">Xuất CSS</button></div></section><section class="md-type-preview"><textarea data-md-type-text>Thiết kế tốt giúp nội dung trở nên rõ ràng, dễ đọc và đáng nhớ.</textarea><article data-md-type-preview>Thiết kế tốt giúp nội dung trở nên rõ ràng, dễ đọc và đáng nhớ.</article><pre data-md-type-css></pre></section></div>`;
  }

  function iconWorkspace() {
    return `${commonHeader("Icon Browser", "Tìm kiếm Lucide icon, đổi màu/kích thước và tải SVG.")}<div class="md-icon-layout"><section><label class="md-search"><span>⌕</span><input data-md-icon-search placeholder="Tìm icon: home, user, music..."></label><div class="md-icon-grid" data-md-icon-grid></div></section><aside class="md-settings-card md-icon-detail"><div data-md-icon-preview></div><strong data-md-icon-name>Sparkles</strong><label>Kích thước<input type="range" min="16" max="160" value="96" data-md-icon-size></label><label>Màu<input type="color" value="#50e6e6" data-md-icon-color></label><label>Độ dày nét<input type="range" min="1" max="4" step="0.25" value="2" data-md-icon-stroke></label><div class="md-actions"><button class="md-button" type="button" data-md-action="icon-copy">Sao chép SVG</button><button class="md-button primary" type="button" data-md-action="icon-download">Tải SVG</button></div></aside></div>`;
  }

  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><rect width="600" height="360" rx="24" fill="#111827"/><circle cx="180" cy="180" r="88" fill="#ec4899"/><path d="M275 110h210v28H275zm0 58h160v24H275zm0 54h190v24H275z" fill="#50e6e6"/><text x="275" y="292" fill="white" font-family="Arial" font-size="32" font-weight="700">HH DESIGN</text></svg>`;
  function svgWorkspace() {
    return `${commonHeader("SVG Editor", "Chỉnh mã SVG an toàn, xem trước và xuất SVG hoặc PNG.")}<div class="md-svg-layout"><section><div class="md-actions"><button class="md-button" type="button" data-md-action="svg-format">Định dạng</button><button class="md-button" type="button" data-md-action="svg-sample">Mẫu mới</button><button class="md-button primary" type="button" data-md-action="svg-download">Tải SVG</button><button class="md-button" type="button" data-md-action="svg-png">Tải PNG</button></div><textarea class="md-code" rows="20" spellcheck="false" data-md-svg-code>${esc(defaultSvg)}</textarea></section><section class="md-preview-panel"><header><strong>Live preview</strong><span>Đã lọc script và external URL</span></header><div class="md-svg-preview" data-md-svg-preview></div></section></div>`;
  }

  function gradientWorkspace() {
    return `${commonHeader("Gradient Generator", "Tạo linear/radial gradient nhiều điểm màu và xuất CSS hoặc PNG.")}<div class="md-gradient-layout"><section class="md-settings-card"><label>Kiểu<select data-md-gradient-type><option value="linear">Linear</option><option value="radial">Radial</option></select></label><label data-md-angle-wrap>Góc <b data-md-angle-value>135°</b><input type="range" min="0" max="360" value="135" data-md-angle></label><div class="md-gradient-colors">${["#ec4899", "#8b5cf6", "#50e6e6"].map((color, index) => `<label>Màu ${index + 1}<input type="color" value="${color}" data-md-gradient-color></label>`).join("")}</div><div class="md-actions"><button class="md-button" type="button" data-md-action="gradient-random">Ngẫu nhiên</button><button class="md-button" type="button" data-md-action="gradient-copy">Sao chép CSS</button><button class="md-button primary" type="button" data-md-action="gradient-download">Tải PNG</button></div></section><section><div class="md-gradient-preview" data-md-gradient-preview></div><pre data-md-gradient-css></pre></section></div>`;
  }

  function pickerWorkspace() {
    return `${commonHeader("Color Picker", "Lấy màu từ ảnh theo pixel, dùng EyeDropper và lưu lịch sử màu.")}<div class="md-picker-layout"><section>${uploadBox("image/*", false, "Chọn ảnh để lấy màu")}<div class="md-picker-stage"><canvas data-md-picker-canvas></canvas><div data-md-placeholder>Chọn ảnh, sau đó bấm vào pixel cần lấy</div></div></section><aside class="md-settings-card"><div class="md-picked-color" data-md-picked-color></div><strong data-md-picked-hex>#EC4899</strong><span data-md-picked-rgb>rgb(236, 72, 153)</span><div class="md-actions"><button class="md-button primary" type="button" data-md-action="eyedropper">EyeDropper</button><button class="md-button" type="button" data-md-action="picker-copy">Sao chép</button></div><div class="md-color-history" data-md-color-history></div></aside></div>`;
  }

  const renderers = { "Image Compressor": imageWorkspace, "Image Converter": imageWorkspace, "Image Toolkit": imageWorkspace, "PDF Toolkit": pdfWorkspace, "QR Toolkit": qrWorkspace, "Color Studio": colorStudioWorkspace, "Typography Studio": typographyWorkspace, "Icon Browser": iconWorkspace, "SVG Editor": svgWorkspace, "Gradient Generator": gradientWorkspace, "Color Picker": pickerWorkspace };

  function render(work, name) {
    cleanup();
    work.innerHTML = `<div class="media-design-workspace" data-md-tool="${esc(name)}">${renderers[name](name)}</div>`;
    if (name === "Color Studio") updatePalette(work);
    if (name === "Typography Studio") updateTypography(work);
    if (name === "Icon Browser") renderIcons(work);
    if (name === "SVG Editor") updateSvg(work);
    if (name === "Gradient Generator") updateGradient(work);
    if (name === "Color Picker") setPickedColor(work, "#ec4899");
    if (["PDF Toolkit", "QR Toolkit", "Icon Browser"].includes(name)) { status(work, "Đang nạp engine chuyên dụng..."); ensureToolLibraries(name).then(() => { if (name === "Icon Browser") renderIcons(work); status(work, "Engine chuyên dụng đã sẵn sàng.", "success"); }).catch(error => status(work, error.message, "error")); }
  }

  async function readImageFile(work, file, picker = false) {
    const image = await loadImage(file);
    state.imageFile = file; state.image = image;
    const canvas = work.querySelector(picker ? "[data-md-picker-canvas]" : "[data-md-canvas]");
    const max = picker ? 1000 : 1200;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d", { willReadFrequently: picker }).drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.parentElement.querySelector("[data-md-placeholder]")?.remove();
    if (!picker) {
      const meta = work.querySelector("[data-md-image-meta]");
      if (meta) meta.textContent = `${image.width}×${image.height} · ${formatBytes(file.size)}`;
      const width = work.querySelector("[data-md-width]"), height = work.querySelector("[data-md-height]");
      if (width) width.value = image.width; if (height) height.value = image.height;
    }
  }

  async function processImage(work, name) {
    if (!state.image || !state.imageFile) throw new Error("Hãy chọn ảnh nguồn trước.");
    const source = state.image;
    let width = source.width, height = source.height;
    if (name === "Image Compressor") { const max = clamp(work.querySelector("[data-md-max]").value, 64, 8000); const scale = Math.min(1, max / Math.max(width, height)); width = Math.round(width * scale); height = Math.round(height * scale); }
    if (name === "Image Toolkit") { width = clamp(work.querySelector("[data-md-width]").value, 1, 12000); height = clamp(work.querySelector("[data-md-height]").value, 1, 12000); }
    const rotation = Number(work.querySelector("[data-md-rotate]")?.value || 0), swap = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas"); canvas.width = swap ? height : width; canvas.height = swap ? width : height;
    const context = canvas.getContext("2d");
    if (work.querySelector("[data-md-background]") && work.querySelector("[data-md-format]").value === "image/jpeg") { context.fillStyle = work.querySelector("[data-md-background]").value; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180); context.scale(work.querySelector("[data-md-flip-x]")?.checked ? -1 : 1, work.querySelector("[data-md-flip-y]")?.checked ? -1 : 1);
    const brightness = work.querySelector("[data-md-brightness]")?.value || 100, contrast = work.querySelector("[data-md-contrast]")?.value || 100, grayscale = work.querySelector("[data-md-grayscale]")?.checked ? 100 : 0;
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`; context.drawImage(source, -width / 2, -height / 2, width, height); context.restore();
    const type = work.querySelector("[data-md-format]").value, quality = Number(work.querySelector("[data-md-quality]")?.value || 92) / 100;
    state.resultBlob = await canvasBlob(canvas, type, quality);
    const preview = work.querySelector("[data-md-canvas]"); preview.width = canvas.width; preview.height = canvas.height; preview.getContext("2d").drawImage(canvas, 0, 0);
    const saved = Math.round((1 - state.resultBlob.size / state.imageFile.size) * 100);
    work.querySelector("[data-md-result-stats]").innerHTML = `<span><b>${canvas.width}×${canvas.height}</b>Kích thước</span><span><b>${formatBytes(state.resultBlob.size)}</b>Đầu ra</span><span><b>${saved > 0 ? `-${saved}%` : `+${Math.abs(saved)}%`}</b>Thay đổi</span>`;
    work.querySelector('[data-md-action="download"]').disabled = false;
    status(work, "Đã xử lý ảnh thành công.", "success");
  }

  const parsePages = (value, total) => { const pages = new Set(); (value || `1-${total}`).split(",").forEach(part => { const [a, b = a] = part.trim().split("-").map(Number); if (!a || !b) return; for (let page = Math.min(a, b); page <= Math.max(a, b); page++) if (page >= 1 && page <= total) pages.add(page - 1); }); return [...pages]; };
  async function processPdf(work) {
    if (!state.pdfFiles.length) throw new Error("Hãy chọn ít nhất một file PDF.");
    if (!window.PDFLib) throw new Error("Thư viện PDF chưa tải xong.");
    const { PDFDocument, degrees } = PDFLib, mode = work.querySelector("[data-md-pdf-mode]").value;
    let output = await PDFDocument.create();
    if (mode === "merge") {
      for (const file of state.pdfFiles) { const source = await PDFDocument.load(await file.arrayBuffer()); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach(page => output.addPage(page)); }
    } else {
      const source = await PDFDocument.load(await state.pdfFiles[0].arrayBuffer());
      if (mode === "split") { const indexes = parsePages(work.querySelector("[data-md-pages]").value, source.getPageCount()); if (!indexes.length) throw new Error("Danh sách trang không hợp lệ."); const pages = await output.copyPages(source, indexes); pages.forEach(page => output.addPage(page)); }
      else { output = source; const angle = Number(work.querySelector("[data-md-pdf-rotation]").value); output.getPages().forEach(page => page.setRotation(degrees((page.getRotation().angle + angle) % 360))); }
    }
    state.resultBlob = new Blob([await output.save()], { type: "application/pdf" });
    work.querySelector('[data-md-action="download"]').disabled = false;
    status(work, `PDF đã sẵn sàng · ${output.getPageCount()} trang · ${formatBytes(state.resultBlob.size)}`, "success");
  }

  function drawQr(work) {
    if (!window.qrcode) throw new Error("Thư viện QR chưa tải xong.");
    const text = work.querySelector("[data-md-qr-text]").value.trim(); if (!text) throw new Error("Nội dung QR đang trống.");
    const qr = qrcode(0, work.querySelector("[data-md-qr-level]").value); qr.addData(text); qr.make();
    const canvas = work.querySelector("[data-md-qr-canvas]"), size = clamp(work.querySelector("[data-md-qr-size]").value, 128, 1200), count = qr.getModuleCount(), margin = Math.max(4, Math.round(size * .04)), cell = (size - margin * 2) / count;
    canvas.width = size; canvas.height = size; const context = canvas.getContext("2d"); context.fillStyle = work.querySelector("[data-md-qr-light]").value; context.fillRect(0, 0, size, size); context.fillStyle = work.querySelector("[data-md-qr-dark]").value;
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) context.fillRect(Math.floor(margin + col * cell), Math.floor(margin + row * cell), Math.ceil(cell), Math.ceil(cell));
    canvas.parentElement.querySelector("[data-md-placeholder]")?.remove(); work.querySelector('[data-md-action="qr-download"]').disabled = false; status(work, `Đã tạo QR ${size}×${size}px.`, "success");
  }

  const hexToRgb = hex => { const value = hex.replace("#", ""); return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]; };
  const rgbToHex = rgb => `#${rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  const mix = (hex, target, amount) => rgbToHex(hexToRgb(hex).map((value, index) => value + (target[index] - value) * amount));
  const luminance = hex => { const rgb = hexToRgb(hex).map(value => { const channel = value / 255; return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
  function updatePalette(work) {
    const base = work.querySelector("[data-md-base-color]").value.toUpperCase(), text = work.querySelector("[data-md-text-color]").value.toUpperCase(); work.querySelector("[data-md-base-hex]").value = base;
    const colors = [mix(base, [255, 255, 255], .82), mix(base, [255, 255, 255], .58), mix(base, [255, 255, 255], .3), base, mix(base, [0, 0, 0], .22), mix(base, [0, 0, 0], .45), mix(base, [0, 0, 0], .68)];
    work.dataset.palette = JSON.stringify(colors); work.querySelector("[data-md-palette]").innerHTML = colors.map((color, index) => `<button type="button" data-md-color-copy-value="${color}" style="--swatch:${color}"><span>${index + 1}00</span><strong>${color}</strong></button>`).join("");
    const ratio = (Math.max(luminance(base), luminance(text)) + .05) / (Math.min(luminance(base), luminance(text)) + .05); const grade = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Không đạt";
    const card = work.querySelector("[data-md-contrast-card]"); card.style.background = base; card.style.color = text; card.innerHTML = `<strong>Văn bản mẫu</strong><span>Contrast ${ratio.toFixed(2)}:1 · ${grade}</span>`;
  }

  function typographyCss(work) { return `font-family: "${work.querySelector("[data-md-font]").value}", sans-serif;\nfont-size: ${work.querySelector("[data-md-font-size]").value}px;\nfont-weight: ${work.querySelector("[data-md-font-weight]").value};\nline-height: ${(work.querySelector("[data-md-line]").value / 10).toFixed(1)};\nletter-spacing: ${work.querySelector("[data-md-spacing]").value}px;`; }
  function updateTypography(work) { const preview = work.querySelector("[data-md-type-preview]"), text = work.querySelector("[data-md-type-text]").value; preview.textContent = text; preview.style.cssText = typographyCss(work); work.querySelector("[data-md-type-css]").textContent = typographyCss(work); work.querySelector("[data-md-font-size-value]").textContent = `${work.querySelector("[data-md-font-size]").value}px`; work.querySelector("[data-md-line-value]").textContent = (work.querySelector("[data-md-line]").value / 10).toFixed(1); work.querySelector("[data-md-spacing-value]").textContent = `${work.querySelector("[data-md-spacing]").value}px`; }

  function iconNames() { return window.lucide?.icons ? Object.keys(window.lucide.icons).filter(name => !name.endsWith("Icon")).slice(0, 500) : ["activity", "airplay", "bell", "camera", "download", "heart", "home", "image", "mail", "menu", "music", "search", "settings", "sparkles", "star", "user", "video", "zap"]; }
  function renderIcons(work, query = "") { const names = iconNames().filter(name => name.toLowerCase().includes(query.toLowerCase())).slice(0, 120); work.querySelector("[data-md-icon-grid]").innerHTML = names.map(name => `<button type="button" data-md-icon="${esc(name)}" title="${esc(name)}"><i data-lucide="${esc(name)}"></i><span>${esc(name)}</span></button>`).join("") || "<p>Không tìm thấy icon.</p>"; window.lucide?.createIcons?.({ attrs: { width: 22, height: 22 } }); updateIconPreview(work); }
  function updateIconPreview(work) { const box = work.querySelector("[data-md-icon-preview]"); if (!box) return; const size = work.querySelector("[data-md-icon-size]").value, color = work.querySelector("[data-md-icon-color]").value, stroke = work.querySelector("[data-md-icon-stroke]").value; box.innerHTML = `<i data-lucide="${esc(state.selectedIcon)}"></i>`; window.lucide?.createIcons?.({ attrs: { width: size, height: size, stroke: color, "stroke-width": stroke } }); work.querySelector("[data-md-icon-name]").textContent = state.selectedIcon; }

  function sanitizeSvg(source) { const doc = new DOMParser().parseFromString(source, "image/svg+xml"); if (doc.querySelector("parsererror") || doc.documentElement.nodeName.toLowerCase() !== "svg") throw new Error("Mã SVG không hợp lệ."); doc.querySelectorAll("script,foreignObject,iframe,object,embed").forEach(node => node.remove()); doc.querySelectorAll("*").forEach(node => [...node.attributes].forEach(attribute => { if (/^on/i.test(attribute.name) || /^(href|xlink:href)$/i.test(attribute.name) && !attribute.value.startsWith("#")) node.removeAttribute(attribute.name); })); if (!doc.documentElement.getAttribute("xmlns")) doc.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg"); return new XMLSerializer().serializeToString(doc.documentElement); }
  function updateSvg(work) { try { const safe = sanitizeSvg(work.querySelector("[data-md-svg-code]").value); work.dataset.safeSvg = safe; work.querySelector("[data-md-svg-preview]").innerHTML = safe; status(work, "SVG hợp lệ.", "success"); } catch (error) { work.querySelector("[data-md-svg-preview]").textContent = error.message; status(work, error.message, "error"); } }

  function gradientCss(work) { const colors = [...work.querySelectorAll("[data-md-gradient-color]")].map(input => input.value), type = work.querySelector("[data-md-gradient-type]").value; return type === "radial" ? `radial-gradient(circle at center, ${colors.join(", ")})` : `linear-gradient(${work.querySelector("[data-md-angle]").value}deg, ${colors.join(", ")})`; }
  function updateGradient(work) { const css = gradientCss(work); work.querySelector("[data-md-gradient-preview]").style.background = css; work.querySelector("[data-md-gradient-css]").textContent = `background: ${css};`; work.querySelector("[data-md-angle-wrap]").hidden = work.querySelector("[data-md-gradient-type]").value === "radial"; work.querySelector("[data-md-angle-value]").textContent = `${work.querySelector("[data-md-angle]").value}°`; }

  function setPickedColor(work, hex) { const rgb = hexToRgb(hex); work.dataset.picked = hex.toUpperCase(); work.querySelector("[data-md-picked-color]").style.background = hex; work.querySelector("[data-md-picked-hex]").textContent = hex.toUpperCase(); work.querySelector("[data-md-picked-rgb]").textContent = `rgb(${rgb.join(", ")})`; const history = JSON.parse(localStorage.getItem("hh-color-picker-history") || "[]"); const next = [hex.toUpperCase(), ...history.filter(item => item !== hex.toUpperCase())].slice(0, 12); localStorage.setItem("hh-color-picker-history", JSON.stringify(next)); work.querySelector("[data-md-color-history]").innerHTML = next.map(color => `<button type="button" data-md-history-color="${color}" style="--history:${color}" title="${color}"></button>`).join(""); }

  async function handleFile(event, work, name) {
    const files = [...(event.target.files || [])]; if (!files.length) return;
    try {
      await ensureToolLibraries(name);
      if (["Image Compressor", "Image Converter", "Image Toolkit"].includes(name)) await readImageFile(work, files[0]);
      else if (name === "Color Picker") await readImageFile(work, files[0], true);
      else if (name === "PDF Toolkit") { state.pdfFiles = files; work.querySelector("[data-md-file-list]").innerHTML = files.map((file, index) => `<article><span>${index + 1}</span><div><strong>${esc(file.name)}</strong><small>${formatBytes(file.size)}</small></div></article>`).join(""); work.querySelector("[data-md-pdf-summary]").textContent = `${files.length} file · ${formatBytes(files.reduce((sum, file) => sum + file.size, 0))}`; }
      else if (name === "QR Toolkit") { const image = await loadImage(files[0]), canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0); const result = window.jsQR?.(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height); work.querySelector("[data-md-qr-result]").textContent = result ? `Nội dung:\n${result.data}\n\nVị trí QR đã được xác định thành công.` : "Không tìm thấy mã QR rõ ràng trong ảnh."; status(work, result ? "Đã đọc mã QR." : "Không nhận diện được QR.", result ? "success" : "error"); }
      status(work, `Đã nạp ${files.length} file.`, "success");
    } catch (error) { status(work, error.message, "error"); }
  }

  async function handleAction(action, work, name, target) {
    try {
      await ensureToolLibraries(name);
      if (action === "image-process") await processImage(work, name);
      else if (action === "download") { if (!state.resultBlob) throw new Error("Chưa có kết quả để tải."); const type = state.resultBlob.type, ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp"; downloadBlob(state.resultBlob, `${fileBase(state.imageFile?.name || state.pdfFiles[0]?.name || "hh-design")}-${name.toLowerCase().replace(/\s+/g, "-")}.${ext}`); }
      else if (action === "reset") render(work.parentElement, name);
      else if (action === "pdf-process") await processPdf(work);
      else if (action === "qr-generate") drawQr(work);
      else if (action === "qr-download") { const canvas = work.querySelector("[data-md-qr-canvas]"); downloadBlob(await canvasBlob(canvas, "image/png", 1), "hh-qr-code.png"); }
      else if (action === "color-generate") updatePalette(work);
      else if (action === "color-copy") { const colors = JSON.parse(work.dataset.palette || "[]"); await navigator.clipboard.writeText(`:root {\n${colors.map((color, index) => `  --color-${(index + 1) * 100}: ${color};`).join("\n")}\n}`); status(work, "Đã sao chép biến CSS.", "success"); }
      else if (action === "type-copy") { await navigator.clipboard.writeText(typographyCss(work)); status(work, "Đã sao chép CSS typography.", "success"); }
      else if (action === "type-download") downloadBlob(new Blob([`.hh-typography {\n  ${typographyCss(work).replace(/\n/g, "\n  ")}\n}`], { type: "text/css" }), "hh-typography.css");
      else if (action === "icon-copy" || action === "icon-download") { const svg = work.querySelector("[data-md-icon-preview] svg")?.outerHTML; if (!svg) throw new Error("Chưa chọn icon."); if (action === "icon-copy") await navigator.clipboard.writeText(svg); else downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${state.selectedIcon}.svg`); status(work, action === "icon-copy" ? "Đã sao chép SVG." : "Đã tạo file SVG.", "success"); }
      else if (action === "svg-format") { const safe = sanitizeSvg(work.querySelector("[data-md-svg-code]").value); work.querySelector("[data-md-svg-code]").value = safe.replace(/></g, ">\n<"); updateSvg(work); }
      else if (action === "svg-sample") { work.querySelector("[data-md-svg-code]").value = defaultSvg; updateSvg(work); }
      else if (action === "svg-download") downloadBlob(new Blob([sanitizeSvg(work.querySelector("[data-md-svg-code]").value)], { type: "image/svg+xml" }), "hh-design.svg");
      else if (action === "svg-png") { const safe = sanitizeSvg(work.querySelector("[data-md-svg-code]").value), image = await loadImage(new Blob([safe], { type: "image/svg+xml" })), canvas = document.createElement("canvas"); canvas.width = image.naturalWidth || 1200; canvas.height = image.naturalHeight || 720; canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); downloadBlob(await canvasBlob(canvas, "image/png", 1), "hh-design.png"); }
      else if (action === "gradient-random") { work.querySelectorAll("[data-md-gradient-color]").forEach(input => { input.value = `#${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0, 6).padStart(6, "0")}`; }); updateGradient(work); }
      else if (action === "gradient-copy") { await navigator.clipboard.writeText(`background: ${gradientCss(work)};`); status(work, "Đã sao chép gradient CSS.", "success"); }
      else if (action === "gradient-download") { const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 900; const context = canvas.getContext("2d"), colors = [...work.querySelectorAll("[data-md-gradient-color]")].map(input => input.value); let gradient; if (work.querySelector("[data-md-gradient-type]").value === "radial") gradient = context.createRadialGradient(800, 450, 0, 800, 450, 900); else { const angle = Number(work.querySelector("[data-md-angle]").value) * Math.PI / 180, x = Math.cos(angle) * 800, y = Math.sin(angle) * 450; gradient = context.createLinearGradient(800 - x, 450 - y, 800 + x, 450 + y); } colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color)); context.fillStyle = gradient; context.fillRect(0, 0, 1600, 900); downloadBlob(await canvasBlob(canvas, "image/png", 1), "hh-gradient-1600x900.png"); }
      else if (action === "eyedropper") { if (!window.EyeDropper) throw new Error("Trình duyệt chưa hỗ trợ EyeDropper API."); const result = await new EyeDropper().open(); setPickedColor(work, result.sRGBHex); }
      else if (action === "picker-copy") { await navigator.clipboard.writeText(work.dataset.picked); status(work, `Đã sao chép ${work.dataset.picked}.`, "success"); }
    } catch (error) { status(work, error.message, "error"); }
  }

  function handleClick(event, outer, name) {
    if (!tools.has(name)) return false;
    const work = outer.querySelector("[data-md-tool]"); if (!work) return false;
    const actionNode = event.target.closest("[data-md-action]"); if (actionNode) { handleAction(actionNode.dataset.mdAction, work, name, actionNode); return true; }
    const qrTab = event.target.closest("[data-md-qr-tab]"); if (qrTab) { work.querySelectorAll("[data-md-qr-tab]").forEach(item => item.classList.toggle("active", item === qrTab)); work.querySelectorAll("[data-md-qr-pane]").forEach(pane => { pane.hidden = pane.dataset.mdQrPane !== qrTab.dataset.mdQrTab; }); return true; }
    const icon = event.target.closest("[data-md-icon]"); if (icon) { state.selectedIcon = icon.dataset.mdIcon; work.querySelectorAll("[data-md-icon]").forEach(item => item.classList.toggle("active", item === icon)); updateIconPreview(work); return true; }
    const swatch = event.target.closest("[data-md-color-copy-value]"); if (swatch) { navigator.clipboard.writeText(swatch.dataset.mdColorCopyValue); status(work, `Đã sao chép ${swatch.dataset.mdColorCopyValue}.`, "success"); return true; }
    const history = event.target.closest("[data-md-history-color]"); if (history) { setPickedColor(work, history.dataset.mdHistoryColor); return true; }
    const pickerCanvas = event.target.closest("[data-md-picker-canvas]"); if (pickerCanvas) { const rect = pickerCanvas.getBoundingClientRect(), x = Math.floor((event.clientX - rect.left) * pickerCanvas.width / rect.width), y = Math.floor((event.clientY - rect.top) * pickerCanvas.height / rect.height), pixel = pickerCanvas.getContext("2d").getImageData(x, y, 1, 1).data; setPickedColor(work, rgbToHex([pixel[0], pixel[1], pixel[2]])); return true; }
    return false;
  }

  function handleInput(event, outer, name) {
    if (!tools.has(name)) return;
    const work = outer.querySelector("[data-md-tool]"); if (!work) return;
    if (event.target.matches("[data-md-quality]")) work.querySelector("[data-md-quality-value]").textContent = `${event.target.value}%`;
    if (event.target.matches("[data-md-brightness]")) work.querySelector("[data-md-brightness-value]").textContent = `${event.target.value}%`;
    if (event.target.matches("[data-md-contrast]")) work.querySelector("[data-md-contrast-value]").textContent = `${event.target.value}%`;
    if (event.target.matches("[data-md-base-hex]") && /^#[0-9a-f]{6}$/i.test(event.target.value)) { work.querySelector("[data-md-base-color]").value = event.target.value; updatePalette(work); }
    if (event.target.matches("[data-md-base-color],[data-md-text-color]")) updatePalette(work);
    if (event.target.matches("[data-md-type-text],[data-md-font-size],[data-md-line],[data-md-spacing]")) updateTypography(work);
    if (event.target.matches("[data-md-icon-search]")) renderIcons(work, event.target.value);
    if (event.target.matches("[data-md-icon-size],[data-md-icon-color],[data-md-icon-stroke]")) updateIconPreview(work);
    if (event.target.matches("[data-md-svg-code]")) { clearTimeout(state.svgTimer); state.svgTimer = setTimeout(() => updateSvg(work), 220); }
    if (event.target.matches("[data-md-angle],[data-md-gradient-color]")) updateGradient(work);
  }

  function handleChange(event, outer, name) {
    if (!tools.has(name)) return;
    const work = outer.querySelector("[data-md-tool]"); if (!work) return;
    if (event.target.matches("[data-md-file]")) handleFile(event, work, name);
    if (event.target.matches("[data-md-pdf-mode]")) { work.querySelector("[data-md-pages-wrap]").hidden = event.target.value !== "split"; work.querySelector("[data-md-rotation-wrap]").hidden = event.target.value !== "rotate"; }
    if (event.target.matches("[data-md-font],[data-md-font-weight]")) updateTypography(work);
    if (event.target.matches("[data-md-gradient-type]")) updateGradient(work);
  }

  window.HHMediaDesign = { supports: name => tools.has(name), render, cleanup, handleClick, handleInput, handleChange };
})();
