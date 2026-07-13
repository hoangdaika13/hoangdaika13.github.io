(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const toolInfo = {
    "Image Compressor": { code: "IMG-01", label: "Tối ưu dung lượng", caps: ["Batch 20 ảnh", "Target size", "WebP / JPG / PNG"] },
    "Image Converter": { code: "IMG-02", label: "Chuyển đổi định dạng", caps: ["Batch convert", "Resize", "Transparent safe"] },
    "Image Toolkit": { code: "IMG-03", label: "Chỉnh sửa nhanh", caps: ["Transform", "Color filters", "Undo presets"] },
    "PDF Toolkit": { code: "DOC-01", label: "Xử lý tài liệu", caps: ["Merge / Split", "Rotate", "Watermark"] },
    "QR Toolkit": { code: "QR-01", label: "Tạo và quét QR", caps: ["Live preview", "QR scanner", "PNG / JPG"] },
    "Color Studio": { code: "CLR-01", label: "Hệ màu thương hiệu", caps: ["Image palette", "Color harmony", "WCAG"] },
    "Typography Studio": { code: "TYP-01", label: "Hệ chữ giao diện", caps: ["Type scale", "Live preview", "CSS export"] },
    "Icon Browser": { code: "ICO-01", label: "Thư viện biểu tượng", caps: ["500+ Lucide", "SVG / PNG", "Favorites"] },
    "SVG Editor": { code: "SVG-01", label: "Vector workspace", caps: ["Safe preview", "Minify", "SVG / PNG"] },
    "Gradient Generator": { code: "GRD-01", label: "Gradient studio", caps: ["4 color stops", "3 gradient types", "Custom export"] },
    "Color Picker": { code: "PCK-01", label: "Phân tích màu", caps: ["Pixel picker", "EyeDropper", "Contrast check"] }
  };

  const pro = {
    active: "",
    files: [],
    pdfFiles: [],
    results: [],
    urls: [],
    resultBlob: null,
    resultName: "",
    imageUndo: [],
    liveQrTimer: 0
  };

  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const bytes = value => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(2)} MB`;
  const baseName = name => String(name || "hh-design").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-");
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const canvasBlob = (canvas, type = "image/png", quality = 1) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không thể tạo tệp đầu ra.")), type, quality));
  const objectUrl = blob => { const url = URL.createObjectURL(blob); pro.urls.push(url); return url; };
  const status = (work, message, kind = "info") => { const node = $(work, "[data-md-status]"); if (node) { node.textContent = message; node.dataset.state = kind; } };
  const download = (blob, name) => { const link = document.createElement("a"); link.href = objectUrl(blob); link.download = name; document.body.append(link); link.click(); link.remove(); };
  const copy = async (work, value, message = "Đã sao chép vào clipboard.") => { await navigator.clipboard.writeText(value); status(work, message, "success"); };
  const readImage = file => new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Không thể đọc ${file.name}.`)); }; image.src = url; });
  const waitFor = async (test, timeout = 8000) => { const start = Date.now(); while (!test()) { if (Date.now() - start > timeout) throw new Error("Engine chuyên dụng tải quá lâu. Hãy thử lại."); await delay(80); } };

  function resetProState() {
    pro.urls.splice(0).forEach(URL.revokeObjectURL);
    pro.files = [];
    pro.pdfFiles = [];
    pro.results = [];
    pro.resultBlob = null;
    pro.resultName = "";
    pro.imageUndo = [];
    clearTimeout(pro.liveQrTimer);
  }

  function historyRead() {
    try { return JSON.parse(localStorage.getItem("hh-media-design-history") || "[]"); }
    catch { return []; }
  }

  function historyAdd(tool, title, detail) {
    const history = [{ id: crypto.randomUUID?.() || `${Date.now()}`, tool, title, detail, at: new Date().toISOString() }, ...historyRead()].slice(0, 40);
    localStorage.setItem("hh-media-design-history", JSON.stringify(history));
  }

  function historyMarkup() {
    const rows = historyRead();
    return rows.length ? rows.map(item => `<article><span>${esc(toolInfo[item.tool]?.code || "JOB")}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)} · ${new Date(item.at).toLocaleString("vi-VN")}</small></div></article>`).join("") : `<div class="md-pro-empty"><b>Chưa có lịch sử</b><span>Các tác vụ hoàn tất sẽ xuất hiện tại đây.</span></div>`;
  }

  function decorate(outer, name) {
    const work = $(outer, "[data-md-tool]");
    if (!work) return;
    const info = toolInfo[name];
    const head = $(work, ".md-head");
    head?.classList.add("md-head--pro");
    const privateBadge = $(work, ".md-private");
    if (privateBadge) privateBadge.innerHTML = `<i></i> Xử lý riêng tư trên thiết bị`;
    $(work, "[data-md-status]")?.insertAdjacentHTML("afterend", `
      <div class="md-pro-commandbar">
        <div class="md-pro-identity"><span>${esc(info.code)}</span><div><b>${esc(info.label)}</b><small>HH Creative Suite</small></div></div>
        <div class="md-pro-caps">${info.caps.map(cap => `<span>${esc(cap)}</span>`).join("")}</div>
        <div class="md-pro-tools">
          <button type="button" data-pro-action="history" title="Lịch sử xử lý">Lịch sử</button>
          <button type="button" data-pro-action="help" title="Hướng dẫn nhanh">Hướng dẫn</button>
        </div>
      </div>`);
    work.insertAdjacentHTML("beforeend", `
      <aside class="md-pro-drawer" data-pro-drawer hidden>
        <header><div><small data-pro-drawer-kicker>NHẬT KÝ CỤC BỘ</small><h4 data-pro-drawer-title>Lịch sử xử lý</h4></div><button type="button" data-pro-action="drawer-close" aria-label="Đóng">×</button></header>
        <div class="md-pro-drawer-body" data-pro-drawer-body></div>
        <footer><button type="button" class="md-button subtle" data-pro-action="history-clear">Xóa lịch sử</button></footer>
      </aside>`);
    $$(work, "[data-md-action='reset']").forEach(button => { delete button.dataset.mdAction; button.dataset.proAction = "reset"; });
    addDropSupport(work);
    if (["Image Compressor", "Image Converter", "Image Toolkit"].includes(name)) enhanceImages(work, name);
    if (name === "PDF Toolkit") enhancePdf(work);
    if (name === "QR Toolkit") enhanceQr(work);
    if (name === "Color Studio") enhanceColor(work);
    if (name === "Typography Studio") enhanceTypography(work);
    if (name === "Icon Browser") enhanceIcons(work);
    if (name === "SVG Editor") enhanceSvg(work);
    if (name === "Gradient Generator") enhanceGradient(work);
    if (name === "Color Picker") enhancePicker(work);
  }

  function addDropSupport(work) {
    $$(work, ".md-upload").forEach(zone => {
      const input = $(zone, "input[type=file]");
      zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("is-dragging"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("is-dragging"));
      zone.addEventListener("drop", event => {
        event.preventDefault();
        zone.classList.remove("is-dragging");
        if (!event.dataTransfer?.files?.length) return;
        const transfer = new DataTransfer();
        [...event.dataTransfer.files].forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function enhanceImages(work, name) {
    const input = $(work, "[data-md-file]");
    if (name !== "Image Toolkit") input.multiple = true;
    const upload = $(work, ".md-upload");
    upload?.insertAdjacentHTML("afterend", `<div class="md-pro-file-summary" data-pro-image-summary><span>Hàng đợi</span><b>Chưa có ảnh</b></div><div class="md-pro-image-queue" data-pro-image-queue></div>`);
    const controls = $(work, ".md-control-grid");
    if (name === "Image Compressor") controls?.insertAdjacentHTML("beforeend", `
      <label>Dung lượng mục tiêu<input type="number" min="0" max="5000" value="0" data-pro-target-kb><small>0 = dùng chất lượng đã chọn</small></label>
      <label>Preset<select data-pro-image-preset><option value="custom">Tùy chỉnh</option><option value="website">Website nhanh</option><option value="social">Mạng xã hội</option><option value="archive">Lưu trữ nét</option></select></label>`);
    if (name === "Image Converter") controls?.insertAdjacentHTML("beforeend", `
      <label>Cạnh tối đa<input type="number" min="0" max="12000" value="0" data-pro-convert-max><small>0 = giữ nguyên</small></label>
      <label class="md-check"><input type="checkbox" data-pro-strip-alpha> Nền trắng khi mất alpha</label>`);
    if (name === "Image Toolkit") controls?.insertAdjacentHTML("beforeend", `
      <label>Độ bão hòa <b data-pro-saturation-value>100%</b><input type="range" min="0" max="200" value="100" data-pro-saturation></label>
      <label>Độ mờ <b data-pro-blur-value>0px</b><input type="range" min="0" max="20" value="0" data-pro-blur></label>
      <label>Preset<select data-pro-filter-preset><option value="custom">Tùy chỉnh</option><option value="vivid">Rực rỡ</option><option value="cinema">Điện ảnh</option><option value="mono">Đơn sắc</option><option value="soft">Mềm sáng</option></select></label>`);
    const processButton = $(work, "[data-md-action='image-process']");
    if (processButton) { delete processButton.dataset.mdAction; processButton.dataset.proAction = "image-process"; processButton.textContent = name === "Image Toolkit" ? "Áp dụng & xem trước" : "Xử lý hàng đợi"; }
    const downloadButton = $(work, "[data-md-action='download']");
    if (downloadButton) { delete downloadButton.dataset.mdAction; downloadButton.dataset.proAction = "download-latest"; }
    if (name !== "Image Toolkit") $(work, ".md-actions")?.insertAdjacentHTML("beforeend", `<button class="md-button" type="button" data-pro-action="download-all" disabled>Tải tất cả</button>`);
  }

  function imageQueueMarkup() {
    if (!pro.files.length) return "";
    return pro.files.map((file, index) => {
      const result = pro.results[index];
      return `<article><span>${index + 1}</span><div><strong>${esc(file.name)}</strong><small>${bytes(file.size)}${result ? ` → ${bytes(result.blob.size)} · ${result.width}×${result.height}` : " · Đang chờ"}</small></div>${result ? `<button type="button" data-pro-result-download="${index}" title="Tải tệp này">Tải</button>` : ""}</article>`;
    }).join("");
  }

  function renderImageQueue(work) {
    const queue = $(work, "[data-pro-image-queue]");
    if (queue) queue.innerHTML = imageQueueMarkup();
    const summary = $(work, "[data-pro-image-summary] b");
    if (summary) summary.textContent = pro.files.length ? `${pro.files.length} ảnh · ${bytes(pro.files.reduce((sum, file) => sum + file.size, 0))}` : "Chưa có ảnh";
  }

  function imageSettings(work, name, image) {
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    if (name === "Image Compressor") {
      const max = clamp($(work, "[data-md-max]")?.value || 1920, 64, 8000);
      const ratio = Math.min(1, max / Math.max(width, height));
      width = Math.round(width * ratio); height = Math.round(height * ratio);
    } else if (name === "Image Converter") {
      const max = Number($(work, "[data-pro-convert-max]")?.value || 0);
      if (max > 0) { const ratio = Math.min(1, max / Math.max(width, height)); width = Math.round(width * ratio); height = Math.round(height * ratio); }
    } else {
      width = clamp($(work, "[data-md-width]")?.value || width, 1, 12000);
      height = clamp($(work, "[data-md-height]")?.value || height, 1, 12000);
    }
    return { width, height };
  }

  async function processOneImage(file, work, name) {
    const image = await readImage(file);
    const dimensions = imageSettings(work, name, image);
    const rotation = Number($(work, "[data-md-rotate]")?.value || 0);
    const swapped = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swapped ? dimensions.height : dimensions.width;
    canvas.height = swapped ? dimensions.width : dimensions.height;
    const context = canvas.getContext("2d");
    const format = $(work, "[data-md-format]")?.value || "image/png";
    const background = $(work, "[data-md-background]")?.value || ($(work, "[data-pro-strip-alpha]")?.checked ? "#ffffff" : "");
    if (format === "image/jpeg" || background) { context.fillStyle = background || "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.scale($(work, "[data-md-flip-x]")?.checked ? -1 : 1, $(work, "[data-md-flip-y]")?.checked ? -1 : 1);
    const brightness = $(work, "[data-md-brightness]")?.value || 100;
    const contrast = $(work, "[data-md-contrast]")?.value || 100;
    const grayscale = $(work, "[data-md-grayscale]")?.checked ? 100 : 0;
    const saturation = $(work, "[data-pro-saturation]")?.value || 100;
    const blur = $(work, "[data-pro-blur]")?.value || 0;
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) saturate(${saturation}%) blur(${blur}px)`;
    context.drawImage(image, -dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
    context.restore();
    let quality = Number($(work, "[data-md-quality]")?.value || 92) / 100;
    let blob = await canvasBlob(canvas, format, quality);
    const targetKb = name === "Image Compressor" ? Number($(work, "[data-pro-target-kb]")?.value || 0) : 0;
    if (targetKb > 0 && format !== "image/png") {
      for (let pass = 0; pass < 7 && blob.size > targetKb * 1024 && quality > .14; pass++) { quality = Math.max(.12, quality - .11); blob = await canvasBlob(canvas, format, quality); }
    }
    return { file, blob, canvas, width: canvas.width, height: canvas.height, quality };
  }

  async function processImages(work, name) {
    if (!pro.files.length) throw new Error("Hãy chọn ít nhất một ảnh nguồn.");
    status(work, `Đang xử lý 0/${pro.files.length} ảnh...`);
    pro.results = [];
    for (let index = 0; index < pro.files.length; index++) {
      const result = await processOneImage(pro.files[index], work, name);
      pro.results.push(result);
      status(work, `Đang xử lý ${index + 1}/${pro.files.length} ảnh...`);
      renderImageQueue(work);
    }
    const first = pro.results[0];
    const preview = $(work, "[data-md-canvas]");
    preview.width = first.canvas.width; preview.height = first.canvas.height;
    preview.getContext("2d").drawImage(first.canvas, 0, 0);
    preview.parentElement.querySelector("[data-md-placeholder]")?.remove();
    pro.resultBlob = first.blob;
    pro.resultName = outputImageName(first, name);
    const originalSize = pro.files.reduce((sum, file) => sum + file.size, 0);
    const outputSize = pro.results.reduce((sum, result) => sum + result.blob.size, 0);
    const saving = Math.round((1 - outputSize / originalSize) * 100);
    const stats = $(work, "[data-md-result-stats]");
    if (stats) stats.innerHTML = `<span><b>${pro.results.length}</b>Tệp hoàn tất</span><span><b>${bytes(outputSize)}</b>Tổng đầu ra</span><span><b>${saving >= 0 ? `-${saving}%` : `+${Math.abs(saving)}%`}</b>Thay đổi</span>`;
    const one = $(work, "[data-pro-action='download-latest']"); if (one) one.disabled = false;
    const all = $(work, "[data-pro-action='download-all']"); if (all) all.disabled = false;
    status(work, `Hoàn tất ${pro.results.length} ảnh · tiết kiệm ${saving}% dung lượng.`, "success");
    historyAdd(name, `Xử lý ${pro.results.length} ảnh`, `${bytes(originalSize)} → ${bytes(outputSize)}`);
  }

  function outputImageName(result, name) {
    const ext = result.blob.type === "image/jpeg" ? "jpg" : result.blob.type === "image/webp" ? "webp" : "png";
    const suffix = name === "Image Compressor" ? "compressed" : name === "Image Converter" ? "converted" : "edited";
    return `${baseName(result.file.name)}-${suffix}.${ext}`;
  }

  function enhancePdf(work) {
    $(work, ".md-file-list")?.classList.add("md-file-list--pro");
    const select = $(work, "[data-md-pdf-mode]");
    select?.insertAdjacentHTML("beforeend", `<option value="watermark">Đóng watermark</option><option value="metadata">Gắn metadata</option>`);
    $(work, "[data-md-rotation-wrap]")?.insertAdjacentHTML("afterend", `
      <div class="md-pro-pdf-extra" data-pro-pdf-watermark hidden>
        <label>Nội dung watermark<input value="HOANGDAIKA13" maxlength="80" data-pro-watermark-text></label>
        <div class="md-control-grid"><label>Cỡ chữ<input type="number" min="10" max="160" value="42" data-pro-watermark-size></label><label>Độ mờ<input type="range" min="5" max="80" value="18" data-pro-watermark-opacity></label></div>
      </div>
      <div class="md-pro-pdf-extra" data-pro-pdf-metadata hidden>
        <label>Tiêu đề<input data-pro-pdf-title placeholder="Tên tài liệu"></label><label>Tác giả<input data-pro-pdf-author value="Hoangdaika13"></label><label>Từ khóa<input data-pro-pdf-keywords placeholder="design, media, hh"></label>
      </div>`);
    const processButton = $(work, "[data-md-action='pdf-process']");
    if (processButton) { delete processButton.dataset.mdAction; processButton.dataset.proAction = "pdf-process"; }
    const downloadButton = $(work, "[data-md-action='download']");
    if (downloadButton) { delete downloadButton.dataset.mdAction; downloadButton.dataset.proAction = "download-latest"; }
  }

  function renderPdfQueue(work) {
    const list = $(work, "[data-md-file-list]");
    if (!list) return;
    list.innerHTML = pro.pdfFiles.length ? pro.pdfFiles.map((file, index) => `<article><span>${index + 1}</span><div><strong>${esc(file.name)}</strong><small>${bytes(file.size)}</small></div><div class="md-pro-row-actions"><button type="button" data-pro-pdf-move="up" data-index="${index}" title="Đưa lên">↑</button><button type="button" data-pro-pdf-move="down" data-index="${index}" title="Đưa xuống">↓</button><button type="button" data-pro-pdf-remove data-index="${index}" title="Xóa">×</button></div></article>`).join("") : `<p>Chưa có tài liệu.</p>`;
    const summary = $(work, "[data-md-pdf-summary]");
    if (summary) summary.textContent = pro.pdfFiles.length ? `${pro.pdfFiles.length} tệp · ${bytes(pro.pdfFiles.reduce((sum, file) => sum + file.size, 0))} · Có thể đổi thứ tự trước khi gộp` : "Chọn file để bắt đầu.";
  }

  async function processPdf(work) {
    if (!pro.pdfFiles.length) throw new Error("Hãy chọn ít nhất một file PDF.");
    await waitFor(() => window.PDFLib);
    const { PDFDocument, StandardFonts, degrees, rgb } = window.PDFLib;
    const mode = $(work, "[data-md-pdf-mode]").value;
    let output = await PDFDocument.create();
    status(work, "Đang phân tích và xử lý PDF...");
    if (mode === "merge") {
      for (const file of pro.pdfFiles) { const source = await PDFDocument.load(await file.arrayBuffer()); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach(page => output.addPage(page)); }
    } else {
      const source = await PDFDocument.load(await pro.pdfFiles[0].arrayBuffer());
      if (mode === "split") {
        const indexes = parsePages($(work, "[data-md-pages]").value, source.getPageCount());
        if (!indexes.length) throw new Error("Danh sách trang không hợp lệ.");
        const pages = await output.copyPages(source, indexes); pages.forEach(page => output.addPage(page));
      } else if (mode === "rotate") {
        output = source; const angle = Number($(work, "[data-md-pdf-rotation]").value); output.getPages().forEach(page => page.setRotation(degrees((page.getRotation().angle + angle) % 360)));
      } else if (mode === "watermark") {
        output = source; const font = await output.embedFont(StandardFonts.HelveticaBold); const text = $(work, "[data-pro-watermark-text]").value.trim() || "HOANGDAIKA13"; const size = clamp($(work, "[data-pro-watermark-size]").value, 10, 160); const opacity = clamp($(work, "[data-pro-watermark-opacity]").value, 5, 80) / 100;
        output.getPages().forEach(page => { const width = font.widthOfTextAtSize(text, size); page.drawText(text, { x: Math.max(18, (page.getWidth() - width) / 2), y: page.getHeight() / 2, size, font, color: rgb(.25, .12, .32), opacity, rotate: degrees(28) }); });
      } else {
        output = source; output.setTitle($(work, "[data-pro-pdf-title]").value || baseName(pro.pdfFiles[0].name)); output.setAuthor($(work, "[data-pro-pdf-author]").value || "Hoangdaika13"); output.setKeywords($(work, "[data-pro-pdf-keywords]").value.split(",").map(value => value.trim()).filter(Boolean)); output.setModificationDate(new Date());
      }
    }
    pro.resultBlob = new Blob([await output.save()], { type: "application/pdf" });
    pro.resultName = `${baseName(pro.pdfFiles[0].name)}-${mode}.pdf`;
    const button = $(work, "[data-pro-action='download-latest']"); if (button) button.disabled = false;
    status(work, `PDF sẵn sàng · ${output.getPageCount()} trang · ${bytes(pro.resultBlob.size)}`, "success");
    historyAdd("PDF Toolkit", `PDF ${mode}`, `${output.getPageCount()} trang · ${bytes(pro.resultBlob.size)}`);
  }

  function parsePages(value, total) {
    const pages = new Set();
    (value || `1-${total}`).split(",").forEach(part => { const [from, to = from] = part.trim().split("-").map(Number); if (!from || !to) return; for (let page = Math.min(from, to); page <= Math.max(from, to); page++) if (page >= 1 && page <= total) pages.add(page - 1); });
    return [...pages];
  }

  function enhanceQr(work) {
    const pane = $(work, "[data-md-qr-pane='generate']");
    pane?.insertAdjacentHTML("afterbegin", `<div class="md-pro-preset-row"><button type="button" data-pro-qr-preset="url">URL</button><button type="button" data-pro-qr-preset="wifi">Wi-Fi</button><button type="button" data-pro-qr-preset="email">Email</button><button type="button" data-pro-qr-preset="vcard">Danh thiếp</button><button type="button" data-pro-qr-preset="sms">SMS</button></div>`);
    $(work, "[data-md-action='qr-download']")?.insertAdjacentHTML("afterend", `<button class="md-button" type="button" data-pro-action="qr-jpg">Tải JPG</button><button class="md-button subtle" type="button" data-pro-action="qr-copy">Sao chép nội dung</button>`);
    pane?.insertAdjacentHTML("beforeend", `<label class="md-check"><input type="checkbox" checked data-pro-qr-live> Tự cập nhật khi nhập</label>`);
    $(work, "[data-md-qr-result]")?.insertAdjacentHTML("afterend", `<button class="md-button" type="button" data-pro-action="qr-copy-result">Sao chép kết quả quét</button>`);
  }

  function enhanceColor(work) {
    const settings = $(work, ".md-settings-card");
    settings?.insertAdjacentHTML("afterbegin", `<div class="md-pro-preset-row"><button type="button" data-pro-harmony="mono">Đơn sắc</button><button type="button" data-pro-harmony="analogous">Tương đồng</button><button type="button" data-pro-harmony="complement">Bổ túc</button><button type="button" data-pro-harmony="triad">Bộ ba</button></div><label class="md-pro-inline-upload">Trích màu từ ảnh<input type="file" accept="image/*" data-pro-color-image><span>Chọn ảnh</span></label>`);
    $(work, "[data-md-action='color-copy']")?.insertAdjacentHTML("afterend", `<button class="md-button" type="button" data-pro-action="color-json">Xuất JSON</button>`);
  }

  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min); if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
    return [h, s * 100, l * 100];
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return `#${rgb.map(value => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }

  function harmonyColors(baseColor, mode) {
    const [h, s, l] = rgbToHsl(hexRgb(baseColor));
    const shifts = mode === "complement" ? [0, 180, 0, 180, 0, 180, 0] : mode === "triad" ? [0, 120, 240, 0, 120, 240, 0] : mode === "analogous" ? [-45, -25, 0, 25, 45, 65, 85] : [0, 0, 0, 0, 0, 0, 0];
    return shifts.map((shift, index) => hslToHex((h + shift + 360) % 360, mode === "mono" ? Math.max(18, s - index * 2) : s, mode === "mono" ? 92 - index * 12 : clamp(l + (index - 3) * 7, 18, 88)));
  }

  function setPalette(work, colors, label = "Custom") {
    work.dataset.palette = JSON.stringify(colors);
    $(work, "[data-md-palette]").innerHTML = colors.map((color, index) => `<button type="button" data-md-color-copy-value="${color}" style="--swatch:${color}"><span>${label} ${index + 1}</span><strong>${color}</strong></button>`).join("");
    status(work, `Đã tạo palette ${label.toLowerCase()} gồm ${colors.length} màu.`, "success");
  }

  async function extractPalette(work, file) {
    const image = await readImage(file); const canvas = document.createElement("canvas"); canvas.width = 72; canvas.height = 72; const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0, 72, 72); const data = context.getImageData(0, 0, 72, 72).data; const bins = new Map();
    for (let index = 0; index < data.length; index += 16) { if (data[index + 3] < 180) continue; const rgb = [data[index] >> 4 << 4, data[index + 1] >> 4 << 4, data[index + 2] >> 4 << 4]; const key = rgb.join(","); bins.set(key, (bins.get(key) || 0) + 1); }
    const picked = [...bins.entries()].sort((a, b) => b[1] - a[1]).reduce((list, [key]) => { const color = key.split(",").map(Number); if (!list.some(hex => { const old = hexRgb(hex); return Math.hypot(old[0] - color[0], old[1] - color[1], old[2] - color[2]) < 55; })) list.push(rgbHex(color)); return list; }, []).slice(0, 7);
    setPalette(work, picked, "Ảnh"); historyAdd("Color Studio", "Trích palette từ ảnh", `${file.name} · ${picked.length} màu`);
  }

  function enhanceTypography(work) {
    const settings = $(work, ".md-settings-card");
    settings?.insertAdjacentHTML("afterbegin", `<div class="md-pro-preset-row"><button type="button" data-pro-type-preset="display">Display</button><button type="button" data-pro-type-preset="title">Tiêu đề</button><button type="button" data-pro-type-preset="body">Nội dung</button><button type="button" data-pro-type-preset="caption">Chú thích</button></div>`);
    settings?.insertAdjacentHTML("beforeend", `<div class="md-control-grid"><label>Màu chữ<input type="color" value="#111827" data-pro-type-color></label><label>Màu nền<input type="color" value="#f8fafc" data-pro-type-bg></label><label>Căn chữ<select data-pro-type-align><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label><label>Biến đổi<select data-pro-type-transform><option value="none">Bình thường</option><option value="uppercase">IN HOA</option><option value="capitalize">Viết Hoa</option></select></label></div>`);
    $(work, "[data-md-action='type-download']")?.insertAdjacentHTML("afterend", `<button class="md-button" type="button" data-pro-action="type-html">Sao chép HTML</button>`);
    updateTypographyPro(work);
  }

  function updateTypographyPro(work) {
    const preview = $(work, "[data-md-type-preview]"); if (!preview) return;
    preview.style.color = $(work, "[data-pro-type-color]")?.value || "#111827";
    preview.style.backgroundColor = $(work, "[data-pro-type-bg]")?.value || "#f8fafc";
    preview.style.textAlign = $(work, "[data-pro-type-align]")?.value || "left";
    preview.style.textTransform = $(work, "[data-pro-type-transform]")?.value || "none";
  }

  function enhanceIcons(work) {
    $(work, ".md-search")?.insertAdjacentHTML("afterend", `<div class="md-pro-preset-row"><button type="button" data-pro-icon-query="arrow">Mũi tên</button><button type="button" data-pro-icon-query="user">Người dùng</button><button type="button" data-pro-icon-query="media">Media</button><button type="button" data-pro-icon-query="favorite">Đã lưu</button><span data-pro-icon-count>Lucide library</span></div>`);
    $(work, "[data-md-action='icon-download']")?.insertAdjacentHTML("afterend", `<button class="md-button" type="button" data-pro-action="icon-png">Tải PNG</button><button class="md-button" type="button" data-pro-action="icon-jsx">Copy JSX</button><button class="md-button subtle" type="button" data-pro-action="icon-favorite">Lưu icon</button>`);
  }

  function enhanceSvg(work) {
    const actions = $(work, ".md-svg-layout .md-actions");
    actions?.insertAdjacentHTML("afterbegin", `<label class="md-button md-pro-file-button">Mở SVG<input type="file" accept="image/svg+xml,.svg" data-pro-svg-file></label>`);
    actions?.insertAdjacentHTML("beforeend", `<button class="md-button" type="button" data-pro-action="svg-copy">Sao chép</button><button class="md-button" type="button" data-pro-action="svg-minify">Minify</button>`);
    const png = $(work, "[data-md-action='svg-png']");
    if (png) { delete png.dataset.mdAction; png.dataset.proAction = "svg-png"; }
    $(work, ".md-preview-panel header")?.insertAdjacentHTML("afterend", `<div class="md-pro-svg-options"><label>Nền<select data-pro-svg-bg><option value="checker">Ô caro</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label><label>PNG scale<select data-pro-svg-scale><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option></select></label></div>`);
  }

  function enhanceGradient(work) {
    const type = $(work, "[data-md-gradient-type]");
    type?.insertAdjacentHTML("beforeend", `<option value="conic">Conic</option>`);
    const colors = $(work, ".md-gradient-colors");
    colors?.insertAdjacentHTML("beforeend", `<label>Màu 4<input type="color" value="#f8e85c" data-md-gradient-color><input type="range" min="0" max="100" value="100" data-pro-gradient-stop><small>100%</small></label>`);
    $$(colors, "label").slice(0, 3).forEach((label, index) => label.insertAdjacentHTML("beforeend", `<input type="range" min="0" max="100" value="${index * 33}" data-pro-gradient-stop><small>${index * 33}%</small>`));
    $(work, ".md-gradient-layout .md-settings-card")?.insertAdjacentHTML("beforeend", `<div class="md-control-grid"><label>Rộng PNG<input type="number" min="320" max="4000" value="1920" data-pro-gradient-width></label><label>Cao PNG<input type="number" min="180" max="4000" value="1080" data-pro-gradient-height></label></div><div class="md-pro-preset-row"><button type="button" data-pro-gradient-preset="sunset">Sunset</button><button type="button" data-pro-gradient-preset="ocean">Ocean</button><button type="button" data-pro-gradient-preset="neon">Neon</button><button type="button" data-pro-gradient-preset="mono">Mono</button></div>`);
    ["gradient-random", "gradient-copy", "gradient-download"].forEach(action => { const button = $(work, `[data-md-action='${action}']`); if (button) { delete button.dataset.mdAction; button.dataset.proAction = action; } });
    updateGradientPro(work);
  }

  function gradientValue(work) {
    const colors = $$(work, "[data-md-gradient-color]");
    const stops = $$(work, "[data-pro-gradient-stop]");
    const parts = colors.map((input, index) => `${input.value} ${stops[index]?.value ?? index * 33}%`);
    const type = $(work, "[data-md-gradient-type]").value;
    if (type === "radial") return `radial-gradient(circle at center, ${parts.join(", ")})`;
    if (type === "conic") return `conic-gradient(from ${$(work, "[data-md-angle]").value}deg, ${parts.join(", ")})`;
    return `linear-gradient(${$(work, "[data-md-angle]").value}deg, ${parts.join(", ")})`;
  }

  function updateGradientPro(work) {
    const value = gradientValue(work); const preview = $(work, "[data-md-gradient-preview]"); if (!preview) return;
    preview.style.background = value; $(work, "[data-md-gradient-css]").textContent = `background: ${value};`;
    $$(work, "[data-pro-gradient-stop]").forEach(input => { const small = input.nextElementSibling; if (small) small.textContent = `${input.value}%`; });
    const angleWrap = $(work, "[data-md-angle-wrap]"); if (angleWrap) angleWrap.hidden = $(work, "[data-md-gradient-type]").value === "radial";
  }

  function enhancePicker(work) {
    const aside = $(work, ".md-picker-layout>aside");
    aside?.insertAdjacentHTML("beforeend", `<div class="md-pro-color-data"><div><span>HSL</span><b data-pro-picked-hsl>--</b></div><div><span>CMYK</span><b data-pro-picked-cmyk>--</b></div><div><span>Độ sáng</span><b data-pro-picked-luma>--</b></div></div><label>Màu so sánh<input type="color" value="#ffffff" data-pro-contrast-color></label><div class="md-pro-contrast-result" data-pro-picker-contrast>Contrast: --</div><label>Định dạng sao chép<select data-pro-picker-format><option value="hex">HEX</option><option value="rgb">RGB</option><option value="hsl">HSL</option></select></label>`);
    const eye = $(work, "[data-md-action='eyedropper']"); if (eye) { delete eye.dataset.mdAction; eye.dataset.proAction = "eyedropper"; }
    const copyButton = $(work, "[data-md-action='picker-copy']"); if (copyButton) { delete copyButton.dataset.mdAction; copyButton.dataset.proAction = "picker-copy"; }
    updatePickerData(work);
  }

  function hexRgb(hex) { const value = String(hex).replace("#", "").padEnd(6, "0"); return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]; }
  function rgbHex(rgb) { return `#${rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase(); }
  function relativeLuma(hex) { const rgb = hexRgb(hex).map(value => { const part = value / 255; return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; }

  function updatePickerData(work) {
    const hex = work.dataset.picked || "#EC4899"; const rgb = hexRgb(hex); const hsl = rgbToHsl(rgb); const max = Math.max(...rgb) / 255, k = 1 - max; const cmyk = k === 1 ? [0, 0, 0, 100] : [((1 - rgb[0] / 255 - k) / (1 - k)) * 100, ((1 - rgb[1] / 255 - k) / (1 - k)) * 100, ((1 - rgb[2] / 255 - k) / (1 - k)) * 100, k * 100];
    const hslText = `hsl(${Math.round(hsl[0])} ${Math.round(hsl[1])}% ${Math.round(hsl[2])}%)`;
    const hslNode = $(work, "[data-pro-picked-hsl]"); if (hslNode) hslNode.textContent = hslText;
    const cmykNode = $(work, "[data-pro-picked-cmyk]"); if (cmykNode) cmykNode.textContent = cmyk.map(value => Math.round(value)).join(" / ");
    const lumaNode = $(work, "[data-pro-picked-luma]"); if (lumaNode) lumaNode.textContent = `${Math.round(relativeLuma(hex) * 100)}%`;
    const against = $(work, "[data-pro-contrast-color]")?.value || "#ffffff"; const ratio = (Math.max(relativeLuma(hex), relativeLuma(against)) + .05) / (Math.min(relativeLuma(hex), relativeLuma(against)) + .05); const result = $(work, "[data-pro-picker-contrast]"); if (result) result.innerHTML = `<b>${ratio.toFixed(2)}:1</b><span>${ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Không đạt WCAG"}</span>`;
    work.dataset.proHsl = hslText;
  }

  function showDrawer(work, mode) {
    const drawer = $(work, "[data-pro-drawer]"); const body = $(drawer, "[data-pro-drawer-body]"); const title = $(drawer, "[data-pro-drawer-title]"); const kicker = $(drawer, "[data-pro-drawer-kicker]");
    drawer.hidden = false;
    if (mode === "help") { kicker.textContent = toolInfo[pro.active].code; title.textContent = `Hướng dẫn ${pro.active}`; body.innerHTML = `<div class="md-pro-help"><strong>Quy trình đề xuất</strong><ol><li>Chọn tệp hoặc nhập dữ liệu nguồn.</li><li>Chọn preset, sau đó tinh chỉnh thông số nếu cần.</li><li>Xem trước và kiểm tra trạng thái chất lượng.</li><li>Xuất kết quả. Dữ liệu được xử lý cục bộ trên thiết bị.</li></ol><div class="md-pro-help-caps">${toolInfo[pro.active].caps.map(cap => `<span>${esc(cap)}</span>`).join("")}</div></div>`; }
    else { kicker.textContent = "NHẬT KÝ CỤC BỘ"; title.textContent = "Lịch sử xử lý"; body.innerHTML = `<div class="md-pro-history">${historyMarkup()}</div>`; }
  }

  async function handleProAction(action, work, name, target) {
    try {
      if (action === "reset") return render(work.parentElement, name);
      if (action === "history" || action === "help") return showDrawer(work, action);
      if (action === "drawer-close") return $(work, "[data-pro-drawer]").hidden = true;
      if (action === "history-clear") { localStorage.removeItem("hh-media-design-history"); showDrawer(work, "history"); return; }
      if (action === "image-process") return await processImages(work, name);
      if (action === "download-latest") { if (!pro.resultBlob) throw new Error("Chưa có kết quả để tải."); download(pro.resultBlob, pro.resultName || "hh-design-output"); return; }
      if (action === "download-all") { if (!pro.results.length) throw new Error("Chưa có kết quả để tải."); pro.results.forEach((result, index) => setTimeout(() => download(result.blob, outputImageName(result, name)), index * 180)); status(work, `Đang tải ${pro.results.length} tệp.`, "success"); return; }
      if (action === "pdf-process") return await processPdf(work);
      if (action === "qr-jpg") { const source = $(work, "[data-md-qr-canvas]"); if (!source.width) throw new Error("Hãy tạo QR trước."); const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height; const context = canvas.getContext("2d"); context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0); download(await canvasBlob(canvas, "image/jpeg", .94), "hh-qr-code.jpg"); return; }
      if (action === "qr-copy") return await copy(work, $(work, "[data-md-qr-text]").value, "Đã sao chép nội dung QR.");
      if (action === "qr-copy-result") { const value = $(work, "[data-md-qr-result]").textContent.replace(/^Nội dung:\s*/i, "").split("\n\n")[0]; return await copy(work, value, "Đã sao chép kết quả quét."); }
      if (action === "color-json") { const colors = JSON.parse(work.dataset.palette || "[]"); download(new Blob([JSON.stringify({ name: "HH Palette", colors }, null, 2)], { type: "application/json" }), "hh-color-palette.json"); return; }
      if (action === "type-html") { const html = `<div style="${typeCss(work)}">${esc($(work, "[data-md-type-text]").value)}</div>`; return await copy(work, html, "Đã sao chép HTML typography."); }
      if (action === "icon-png") return await exportIconPng(work);
      if (action === "icon-jsx") { const svg = $(work, "[data-md-icon-preview] svg")?.outerHTML; if (!svg) throw new Error("Chưa có icon."); return await copy(work, `export const HHIcon = (props) => (${svg.replace("<svg", "<svg {...props}").replace(/class=/g, "className=")});`, "Đã sao chép JSX component."); }
      if (action === "icon-favorite") return toggleIconFavorite(work);
      if (action === "svg-copy") return await copy(work, work.dataset.safeSvg || $(work, "[data-md-svg-code]").value, "Đã sao chép SVG sạch.");
      if (action === "svg-minify") { const safe = sanitizeSvg($(work, "[data-md-svg-code]").value).replace(/>\s+</g, "><").replace(/\s{2,}/g, " "); $(work, "[data-md-svg-code]").value = safe; $(work, "[data-md-svg-code]").dispatchEvent(new Event("input", { bubbles: true })); status(work, `Đã minify còn ${bytes(new Blob([safe]).size)}.`, "success"); return; }
      if (action === "svg-png") return await exportSvgPng(work);
      if (action === "gradient-random") { $$(work, "[data-md-gradient-color]").forEach(input => input.value = `#${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0, 6).padStart(6, "0")}`); updateGradientPro(work); return; }
      if (action === "gradient-copy") return await copy(work, `background: ${gradientValue(work)};`, "Đã sao chép CSS gradient.");
      if (action === "gradient-download") return await exportGradient(work);
      if (action === "eyedropper") { if (!window.EyeDropper) throw new Error("Trình duyệt chưa hỗ trợ EyeDropper API."); const result = await new EyeDropper().open(); setPickerColor(work, result.sRGBHex); return; }
      if (action === "picker-copy") { const format = $(work, "[data-pro-picker-format]")?.value || "hex"; const value = format === "rgb" ? $(work, "[data-md-picked-rgb]").textContent : format === "hsl" ? work.dataset.proHsl : work.dataset.picked; return await copy(work, value, `Đã sao chép ${value}.`); }
    } catch (error) { status(work, error.message, "error"); }
  }

  function typeCss(work) {
    return `font-family:${$(work, "[data-md-font]").value};font-size:${$(work, "[data-md-font-size]").value}px;font-weight:${$(work, "[data-md-font-weight]").value};line-height:${($(work, "[data-md-line]").value / 10).toFixed(1)};letter-spacing:${$(work, "[data-md-spacing]").value}px;color:${$(work, "[data-pro-type-color]").value};background:${$(work, "[data-pro-type-bg]").value};text-align:${$(work, "[data-pro-type-align]").value};text-transform:${$(work, "[data-pro-type-transform]").value}`;
  }

  async function exportIconPng(work) {
    const svg = $(work, "[data-md-icon-preview] svg")?.outerHTML; if (!svg) throw new Error("Chưa có icon."); const image = await readImage(new Blob([svg], { type: "image/svg+xml" })); const size = clamp($(work, "[data-md-icon-size]").value, 16, 512); const canvas = document.createElement("canvas"); canvas.width = size * 2; canvas.height = size * 2; canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); download(await canvasBlob(canvas), `${baseName($(work, "[data-md-icon-name]").textContent)}-${canvas.width}.png`); status(work, "Đã xuất PNG nền trong suốt.", "success");
  }

  function iconFavorites() { try { return JSON.parse(localStorage.getItem("hh-icon-favorites") || "[]"); } catch { return []; } }
  function toggleIconFavorite(work) { const name = $(work, "[data-md-icon-name]").textContent; const current = iconFavorites(); const next = current.includes(name) ? current.filter(item => item !== name) : [name, ...current].slice(0, 50); localStorage.setItem("hh-icon-favorites", JSON.stringify(next)); status(work, current.includes(name) ? `Đã bỏ lưu ${name}.` : `Đã lưu ${name}.`, "success"); }

  function sanitizeSvg(source) {
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    if (doc.querySelector("parsererror") || doc.documentElement.nodeName.toLowerCase() !== "svg") throw new Error("Mã SVG không hợp lệ.");
    doc.querySelectorAll("script,foreignObject,iframe,object,embed").forEach(node => node.remove());
    doc.querySelectorAll("*").forEach(node => [...node.attributes].forEach(attribute => { if (/^on/i.test(attribute.name) || /^(href|xlink:href)$/i.test(attribute.name) && !attribute.value.startsWith("#")) node.removeAttribute(attribute.name); }));
    if (!doc.documentElement.getAttribute("xmlns")) doc.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  async function exportSvgPng(work) {
    const safe = sanitizeSvg($(work, "[data-md-svg-code]").value); const scale = Number($(work, "[data-pro-svg-scale]").value || 2); const image = await readImage(new Blob([safe], { type: "image/svg+xml" })); const canvas = document.createElement("canvas"); canvas.width = (image.naturalWidth || 1200) * scale; canvas.height = (image.naturalHeight || 720) * scale; canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); download(await canvasBlob(canvas), `hh-vector-${canvas.width}x${canvas.height}.png`); status(work, `Đã xuất PNG ${canvas.width}×${canvas.height}.`, "success");
  }

  async function exportGradient(work) {
    const width = clamp($(work, "[data-pro-gradient-width]").value, 320, 4000); const height = clamp($(work, "[data-pro-gradient-height]").value, 180, 4000); const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const context = canvas.getContext("2d"); const colors = $$(work, "[data-md-gradient-color]").map(input => input.value); const stops = $$(work, "[data-pro-gradient-stop]").map(input => Number(input.value) / 100); const type = $(work, "[data-md-gradient-type]").value; let gradient;
    if (type === "radial") gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * .7);
    else if (type === "conic" && context.createConicGradient) gradient = context.createConicGradient(Number($(work, "[data-md-angle]").value) * Math.PI / 180, width / 2, height / 2);
    else { const angle = Number($(work, "[data-md-angle]").value) * Math.PI / 180; const x = Math.cos(angle) * width / 2, y = Math.sin(angle) * height / 2; gradient = context.createLinearGradient(width / 2 - x, height / 2 - y, width / 2 + x, height / 2 + y); }
    colors.forEach((color, index) => gradient.addColorStop(clamp(stops[index] ?? index / (colors.length - 1), 0, 1), color)); context.fillStyle = gradient; context.fillRect(0, 0, width, height); download(await canvasBlob(canvas), `hh-gradient-${width}x${height}.png`); historyAdd("Gradient Generator", "Xuất gradient", `${width}×${height} · ${type}`); status(work, `Đã xuất PNG ${width}×${height}.`, "success");
  }

  function setPickerColor(work, hex) {
    work.dataset.picked = hex.toUpperCase(); const rgb = hexRgb(hex); $(work, "[data-md-picked-color]").style.background = hex; $(work, "[data-md-picked-hex]").textContent = hex.toUpperCase(); $(work, "[data-md-picked-rgb]").textContent = `rgb(${rgb.join(", ")})`; updatePickerData(work);
  }

  function handleClick(event, outer, name) {
    if (!toolInfo[name]) return base.handleClick?.(event, outer, name) || false;
    const work = $(outer, "[data-md-tool]"); if (!work) return false;
    const proAction = event.target.closest("[data-pro-action]"); if (proAction) { handleProAction(proAction.dataset.proAction, work, name, proAction); return true; }
    const result = event.target.closest("[data-pro-result-download]"); if (result) { const item = pro.results[Number(result.dataset.proResultDownload)]; if (item) download(item.blob, outputImageName(item, name)); return true; }
    const pdfRemove = event.target.closest("[data-pro-pdf-remove]"); if (pdfRemove) { pro.pdfFiles.splice(Number(pdfRemove.dataset.index), 1); renderPdfQueue(work); return true; }
    const pdfMove = event.target.closest("[data-pro-pdf-move]"); if (pdfMove) { const index = Number(pdfMove.dataset.index), next = pdfMove.dataset.proPdfMove === "up" ? index - 1 : index + 1; if (next >= 0 && next < pro.pdfFiles.length) [pro.pdfFiles[index], pro.pdfFiles[next]] = [pro.pdfFiles[next], pro.pdfFiles[index]]; renderPdfQueue(work); return true; }
    const qrPreset = event.target.closest("[data-pro-qr-preset]"); if (qrPreset) { const samples = { url: location.href, wifi: "WIFI:T:WPA;S:Ten_WiFi;P:Mat_khau;;", email: "mailto:nhhoang130803@gmail.com?subject=Lien he tu website", vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:Hoang Dai Ka 13\nTEL:0923459496\nEMAIL:nhhoang130803@gmail.com\nEND:VCARD", sms: "SMSTO:0923459496:Xin chao Hoang Dai Ka 13" }; const input = $(work, "[data-md-qr-text]"); input.value = samples[qrPreset.dataset.proQrPreset]; input.dispatchEvent(new Event("input", { bubbles: true })); return true; }
    const harmony = event.target.closest("[data-pro-harmony]"); if (harmony) { const baseColor = $(work, "[data-md-base-color]").value; setPalette(work, harmonyColors(baseColor, harmony.dataset.proHarmony), harmony.textContent); return true; }
    const typePreset = event.target.closest("[data-pro-type-preset]"); if (typePreset) { applyTypePreset(work, typePreset.dataset.proTypePreset); return true; }
    const iconQuery = event.target.closest("[data-pro-icon-query]"); if (iconQuery) { const query = iconQuery.dataset.proIconQuery === "favorite" ? iconFavorites()[0] || "star" : iconQuery.dataset.proIconQuery === "media" ? "image" : iconQuery.dataset.proIconQuery; const input = $(work, "[data-md-icon-search]"); input.value = query; input.dispatchEvent(new Event("input", { bubbles: true })); return true; }
    const gradientPreset = event.target.closest("[data-pro-gradient-preset]"); if (gradientPreset) { applyGradientPreset(work, gradientPreset.dataset.proGradientPreset); return true; }
    const wasPicker = event.target.closest("[data-md-picker-canvas],[data-md-history-color]");
    const handled = base.handleClick?.(event, outer, name) || false;
    if (wasPicker) setTimeout(() => updatePickerData(work), 0);
    return handled;
  }

  function applyTypePreset(work, preset) {
    const values = { display: [72, 800, 11, 0], title: [44, 700, 12, 0], body: [18, 400, 16, 0], caption: [13, 600, 14, 1] }[preset];
    $(work, "[data-md-font-size]").value = values[0]; $(work, "[data-md-font-weight]").value = values[1]; $(work, "[data-md-line]").value = values[2]; $(work, "[data-md-spacing]").value = values[3]; $(work, "[data-md-font-size]").dispatchEvent(new Event("input", { bubbles: true })); status(work, `Đã áp dụng preset ${preset}.`, "success");
  }

  function applyGradientPreset(work, preset) {
    const values = { sunset: ["#FF5F6D", "#FFC371", "#FF8A5C", "#6A11CB"], ocean: ["#001B48", "#02457A", "#018ABE", "#97CADB"], neon: ["#FF2BD6", "#7C3AED", "#00E5FF", "#F8E85C"], mono: ["#09090B", "#27272A", "#71717A", "#FAFAFA"] }[preset];
    $$(work, "[data-md-gradient-color]").forEach((input, index) => input.value = values[index]); updateGradientPro(work); status(work, `Đã áp dụng preset ${preset}.`, "success");
  }

  function handleInput(event, outer, name) {
    base.handleInput?.(event, outer, name);
    if (!toolInfo[name]) return;
    const work = $(outer, "[data-md-tool]"); if (!work) return;
    if (event.target.matches("[data-pro-saturation]")) $(work, "[data-pro-saturation-value]").textContent = `${event.target.value}%`;
    if (event.target.matches("[data-pro-blur]")) $(work, "[data-pro-blur-value]").textContent = `${event.target.value}px`;
    if (event.target.matches("[data-md-type-text],[data-md-font-size],[data-md-line],[data-md-spacing],[data-pro-type-color],[data-pro-type-bg],[data-pro-type-align],[data-pro-type-transform]")) updateTypographyPro(work);
    if (event.target.matches("[data-md-gradient-color],[data-md-angle],[data-pro-gradient-stop]")) updateGradientPro(work);
    if (event.target.matches("[data-pro-contrast-color]")) updatePickerData(work);
    if (event.target.matches("[data-md-qr-text],[data-md-qr-size],[data-md-qr-dark],[data-md-qr-light]")) { clearTimeout(pro.liveQrTimer); if ($(work, "[data-pro-qr-live]")?.checked) pro.liveQrTimer = setTimeout(() => $(work, "[data-md-action='qr-generate']")?.click(), 260); }
  }

  function handleChange(event, outer, name) {
    base.handleChange?.(event, outer, name);
    if (!toolInfo[name]) return;
    const work = $(outer, "[data-md-tool]"); if (!work) return;
    if (event.target.matches("[data-md-file]") && ["Image Compressor", "Image Converter", "Image Toolkit"].includes(name)) { pro.files = [...event.target.files].slice(0, name === "Image Toolkit" ? 1 : 20); pro.results = []; renderImageQueue(work); status(work, `Đã thêm ${pro.files.length} ảnh vào hàng đợi.`, "success"); }
    if (event.target.matches("[data-md-file]") && name === "PDF Toolkit") { pro.pdfFiles = [...event.target.files]; renderPdfQueue(work); }
    if (event.target.matches("[data-md-pdf-mode]")) { const mode = event.target.value; $(work, "[data-pro-pdf-watermark]").hidden = mode !== "watermark"; $(work, "[data-pro-pdf-metadata]").hidden = mode !== "metadata"; }
    if (event.target.matches("[data-pro-image-preset]")) { const preset = event.target.value; const values = { website: [72, 1600], social: [82, 2048], archive: [94, 4000] }[preset]; if (values) { $(work, "[data-md-quality]").value = values[0]; $(work, "[data-md-max]").value = values[1]; $(work, "[data-md-quality]").dispatchEvent(new Event("input", { bubbles: true })); } }
    if (event.target.matches("[data-pro-filter-preset]")) applyFilterPreset(work, event.target.value);
    if (event.target.matches("[data-pro-color-image]")) { const file = event.target.files[0]; if (file) extractPalette(work, file).catch(error => status(work, error.message, "error")); }
    if (event.target.matches("[data-pro-svg-file]")) { const file = event.target.files[0]; if (file) file.text().then(text => { $(work, "[data-md-svg-code]").value = text; $(work, "[data-md-svg-code]").dispatchEvent(new Event("input", { bubbles: true })); status(work, `Đã mở ${file.name}.`, "success"); }); }
    if (event.target.matches("[data-pro-svg-bg]")) { const preview = $(work, "[data-md-svg-preview]"); preview.dataset.background = event.target.value; }
    if (event.target.matches("[data-md-gradient-type]")) updateGradientPro(work);
    if (event.target.matches("[data-md-font],[data-md-font-weight]")) updateTypographyPro(work);
  }

  function applyFilterPreset(work, preset) {
    const values = { vivid: [108, 112, 145, 0, false], cinema: [92, 122, 82, 0, false], mono: [100, 115, 0, 0, true], soft: [112, 88, 90, 1, false] }[preset]; if (!values) return;
    $(work, "[data-md-brightness]").value = values[0]; $(work, "[data-md-contrast]").value = values[1]; $(work, "[data-pro-saturation]").value = values[2]; $(work, "[data-pro-blur]").value = values[3]; $(work, "[data-md-grayscale]").checked = values[4]; ["[data-md-brightness]", "[data-md-contrast]", "[data-pro-saturation]", "[data-pro-blur]"].forEach(selector => $(work, selector).dispatchEvent(new Event("input", { bubbles: true }))); status(work, `Đã áp dụng preset ${preset}.`, "success");
  }

  function render(outer, name) {
    resetProState(); pro.active = name; base.render(outer, name); decorate(outer, name);
  }

  window.HHMediaDesign = {
    supports: base.supports,
    render,
    cleanup() { resetProState(); base.cleanup?.(); },
    handleClick,
    handleInput,
    handleChange
  };
})();
