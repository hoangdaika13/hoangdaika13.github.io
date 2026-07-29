(() => {
  "use strict";

  const STORAGE_KEY = "hh.video-batch-factory.v1";
  const DB_NAME = "hh-video-editor-media";
  const DB_STORE = "assets";
  const MAX_ROWS = 100;
  const MAX_INPUT_SIZE = 2 * 1024 * 1024 * 1024;
  const PRESETS = Object.freeze([
    { id: "youtube", name: "YouTube Landscape", width: 1920, height: 1080, duration: 8, fps: 30, accent: "#6be8ff", background: "#071020", layout: "left", motion: "cinematic" },
    { id: "short", name: "Short 9:16", width: 1080, height: 1920, duration: 7, fps: 30, accent: "#ff65c8", background: "#130923", layout: "center", motion: "pulse" },
    { id: "square", name: "Social Square", width: 1080, height: 1080, duration: 6, fps: 30, accent: "#9d7cff", background: "#090d1c", layout: "center", motion: "orbit" },
    { id: "quote", name: "Cosmic Quote", width: 1920, height: 1080, duration: 10, fps: 30, accent: "#ffd56a", background: "#110b20", layout: "center", motion: "drift" },
    { id: "promo", name: "Product Promo", width: 1920, height: 1080, duration: 8, fps: 30, accent: "#56e6b1", background: "#061612", layout: "left", motion: "cinematic" },
    { id: "news", name: "News & Lower Third", width: 1920, height: 1080, duration: 12, fps: 30, accent: "#ff765f", background: "#150a0a", layout: "left", motion: "slide" }
  ]);
  const DEFAULT_STATE = Object.freeze({
    presetId: "youtube",
    template: { ...PRESETS[0], titleSize: 88, subtitleSize: 34, ctaSize: 28, overlay: 58, logo: "H", watermark: "HH PLATFORM", format: "mp4", bitrate: 8_000_000 },
    rows: [],
    jobs: [],
    autoDownload: false,
    saveToMediaPool: true
  });

  let root = null;
  let controller = null;
  let state = null;
  let assets = [];
  let outputUrls = new Map();
  let running = false;
  let cancelRequested = false;
  let recorder = null;
  let frameId = 0;

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const formatBytes = (value) => {
    let size = Math.max(0, Number(value) || 0);
    for (const unit of ["B", "KB", "MB", "GB"]) {
      if (size < 1024 || unit === "GB") return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      size /= 1024;
    }
    return "0 B";
  };
  const ownerId = () => {
    const runtime = window.HHAuthz?.currentUser?.();
    let user = runtime;
    if (!user) {
      try { user = JSON.parse(localStorage.getItem("hh-auth-user") || "null"); } catch { user = null; }
    }
    return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
  };
  const privateKey = () => `${STORAGE_KEY}:${ownerId()}`;

  state = loadState();

  function normalizeTemplate(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || "custom").slice(0, 40),
      name: String(source.name || "Sườn tùy chỉnh").slice(0, 100),
      width: clamp(source.width, 320, 3840) || 1920,
      height: clamp(source.height, 320, 3840) || 1080,
      duration: clamp(source.duration, 1, 60) || 8,
      fps: [24, 25, 30, 50, 60].includes(Number(source.fps)) ? Number(source.fps) : 30,
      accent: /^#[\da-f]{6}$/i.test(source.accent) ? source.accent : "#6be8ff",
      background: /^#[\da-f]{6}$/i.test(source.background) ? source.background : "#071020",
      layout: ["left", "center"].includes(source.layout) ? source.layout : "left",
      motion: ["cinematic", "pulse", "orbit", "drift", "slide", "none"].includes(source.motion) ? source.motion : "cinematic",
      titleSize: clamp(source.titleSize, 30, 180) || 88,
      subtitleSize: clamp(source.subtitleSize, 18, 90) || 34,
      ctaSize: clamp(source.ctaSize, 14, 70) || 28,
      overlay: source.overlay === undefined ? 58 : clamp(source.overlay, 0, 90),
      logo: String(source.logo || "H").slice(0, 4),
      watermark: String(source.watermark || "HH PLATFORM").slice(0, 60),
      format: source.format === "webm" ? "webm" : "mp4",
      bitrate: clamp(source.bitrate, 1_000_000, 30_000_000) || 8_000_000
    };
  }

  function normalizeRow(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || uid("row")).slice(0, 100),
      order: Math.max(0, Number(source.order ?? index)),
      title: String(source.title || `Video ${index + 1}`).slice(0, 180),
      subtitle: String(source.subtitle || "").slice(0, 300),
      cta: String(source.cta || "").slice(0, 120),
      accent: /^#[\da-f]{6}$/i.test(source.accent) ? source.accent : "",
      sourceId: String(source.sourceId || "").slice(0, 120),
      sourceName: String(source.sourceName || "").slice(0, 240)
    };
  }

  function normalizeJob(value) {
    const source = value && typeof value === "object" ? value : {};
    const status = ["queued", "processing", "completed", "failed", "cancelled"].includes(source.status) ? source.status : "queued";
    return {
      id: String(source.id || uid("job")).slice(0, 100),
      rowId: String(source.rowId || "").slice(0, 100),
      title: String(source.title || "Video").slice(0, 180),
      status: status === "processing" ? "queued" : status,
      progress: status === "completed" ? 100 : clamp(source.progress, 0, 100),
      outputAssetId: String(source.outputAssetId || "").slice(0, 120),
      outputName: String(source.outputName || "").slice(0, 240),
      outputSize: Math.max(0, Number(source.outputSize || 0)),
      outputMime: String(source.outputMime || "").slice(0, 120),
      error: String(source.error || "").slice(0, 300),
      createdAt: source.createdAt || new Date().toISOString(),
      completedAt: source.completedAt || null
    };
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...DEFAULT_STATE,
      ...source,
      template: normalizeTemplate(source.template || DEFAULT_STATE.template),
      rows: Array.isArray(source.rows) ? source.rows.slice(0, MAX_ROWS).map(normalizeRow) : [],
      jobs: Array.isArray(source.jobs) ? source.jobs.slice(0, MAX_ROWS * 2).map(normalizeJob) : []
    };
  }

  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(privateKey()) || "null")); }
    catch { return normalizeState(null); }
  }

  function saveState() {
    try { localStorage.setItem(privateKey(), JSON.stringify(state)); } catch {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được Media Pool."));
    });
  }

  async function dbAll() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }

  async function dbPut(item) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(item);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  async function refreshAssets() {
    const all = await dbAll().catch(() => []);
    assets = all.filter((item) => item.ownerId === ownerId() && (
      item.source === "batch-video-input" || item.source === "batch-video-output"
    ));
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
    assets.filter((item) => item.source === "batch-video-output" && item.file instanceof Blob).forEach((item) => {
      outputUrls.set(item.id, URL.createObjectURL(item.file));
    });
  }

  function capabilities() {
    const capture = Boolean(window.HTMLCanvasElement?.prototype?.captureStream);
    const recorderReady = Boolean(window.MediaRecorder && capture);
    const mp4Mime = window.HHVideoExport?.resolveRecorderMime?.('video/mp4;codecs="avc1.424028,mp4a.40.2"')
      || (window.MediaRecorder?.isTypeSupported?.("video/mp4") ? "video/mp4" : "");
    const webmMime = window.HHVideoExport?.resolveRecorderMime?.("video/webm;codecs=vp9,opus")
      || (window.MediaRecorder?.isTypeSupported?.("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm");
    return { capture, recorderReady, mp4Mime, webmMime, indexedDb: Boolean(window.indexedDB) };
  }

  function status(message, kind = "info") {
    const node = root?.querySelector("[data-bvf-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  function sourceAssets() {
    return assets.filter((item) => item.source === "batch-video-input");
  }

  function inputOptions(selected = "") {
    return `<option value="">Nền vũ trụ của sườn</option>${sourceAssets().map((item) => (
      `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)} · ${formatBytes(item.size)}</option>`
    )).join("")}`;
  }

  function templateMarkup() {
    const template = state.template;
    return `<section class="bvf-panel bvf-template">
      <header><div><small>MASTER TEMPLATE</small><h3>Sườn video dùng chung</h3></div><span>${template.width}×${template.height} · ${template.fps} FPS</span></header>
      <div class="bvf-preset-grid">${PRESETS.map((preset) => `<button type="button" data-bvf-preset="${preset.id}" class="${state.presetId === preset.id ? "is-active" : ""}"><i style="--preset:${preset.accent}"></i><strong>${esc(preset.name)}</strong><small>${preset.width}×${preset.height}</small></button>`).join("")}</div>
      <div class="bvf-fields">
        <label>Tên sườn<input data-bvf-template="name" value="${esc(template.name)}" maxlength="100"></label>
        <label>Độ phân giải<select data-bvf-resolution><option value="1920x1080" ${template.width === 1920 && template.height === 1080 ? "selected" : ""}>1920×1080</option><option value="1280x720" ${template.width === 1280 ? "selected" : ""}>1280×720</option><option value="1080x1920" ${template.height === 1920 ? "selected" : ""}>1080×1920</option><option value="1080x1080" ${template.width === 1080 && template.height === 1080 ? "selected" : ""}>1080×1080</option></select></label>
        <label>Thời lượng mỗi video<input type="number" min="1" max="60" step="1" data-bvf-template="duration" value="${template.duration}"></label>
        <label>FPS<select data-bvf-template="fps">${[24,25,30,50,60].map((fps) => `<option ${template.fps === fps ? "selected" : ""}>${fps}</option>`).join("")}</select></label>
        <label>Định dạng<select data-bvf-template="format"><option value="mp4" ${template.format === "mp4" ? "selected" : ""}>MP4 H.264</option><option value="webm" ${template.format === "webm" ? "selected" : ""}>WebM VP9</option></select></label>
        <label>Bitrate<select data-bvf-template="bitrate">${[[4_000_000,"4 Mbps"],[8_000_000,"8 Mbps"],[12_000_000,"12 Mbps"],[20_000_000,"20 Mbps"]].map(([value,label]) => `<option value="${value}" ${template.bitrate === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Màu nền<input type="color" data-bvf-template="background" value="${template.background}"></label>
        <label>Màu tín hiệu<input type="color" data-bvf-template="accent" value="${template.accent}"></label>
        <label>Kiểu chuyển động<select data-bvf-template="motion">${["cinematic","pulse","orbit","drift","slide","none"].map((value) => `<option value="${value}" ${template.motion === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        <label>Bố cục<select data-bvf-template="layout"><option value="left" ${template.layout === "left" ? "selected" : ""}>Căn trái</option><option value="center" ${template.layout === "center" ? "selected" : ""}>Căn giữa</option></select></label>
        <label>Logo<input data-bvf-template="logo" value="${esc(template.logo)}" maxlength="4"></label>
        <label>Watermark<input data-bvf-template="watermark" value="${esc(template.watermark)}" maxlength="60"></label>
      </div>
      <div class="bvf-action-row"><button data-bvf-action="export-template">Xuất sườn JSON</button><label class="bvf-file">Nhập sườn JSON<input type="file" accept=".json,application/json" data-bvf-template-file></label><button data-bvf-action="preview">Cập nhật preview</button></div>
      <div class="bvf-output-options">
        <label><input type="checkbox" data-bvf-option="saveToMediaPool" ${state.saveToMediaPool ? "checked" : ""}> Lưu file xuất vào Media Pool</label>
        <label><input type="checkbox" data-bvf-option="autoDownload" ${state.autoDownload ? "checked" : ""}> Tự tải từng file sau khi render</label>
      </div>
    </section>`;
  }

  function dataMarkup() {
    return `<section class="bvf-panel bvf-data">
      <header><div><small>DATA MERGE · ${state.rows.length}/${MAX_ROWS}</small><h3>Danh sách video cần tạo</h3></div><span>Mỗi dòng → một video</span></header>
      <div class="bvf-import-bar">
        <label class="bvf-file">Nhập ảnh/video<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" data-bvf-assets></label>
        <label class="bvf-file">Nhập CSV/JSON<input type="file" accept=".csv,.json,text/csv,application/json" data-bvf-data-file></label>
        <button data-bvf-action="sample-csv">Tải CSV mẫu</button>
        <button data-bvf-action="add-row">+ Thêm dòng</button>
      </div>
      <div class="bvf-table-wrap"><table><thead><tr><th>#</th><th>Tiêu đề</th><th>Dòng phụ</th><th>CTA</th><th>Media</th><th></th></tr></thead><tbody>${state.rows.length ? state.rows.map((row, index) => `<tr data-bvf-row="${esc(row.id)}">
        <td>${index + 1}</td>
        <td><input data-bvf-row-field="title" value="${esc(row.title)}" maxlength="180"></td>
        <td><input data-bvf-row-field="subtitle" value="${esc(row.subtitle)}" maxlength="300"></td>
        <td><input data-bvf-row-field="cta" value="${esc(row.cta)}" maxlength="120"></td>
        <td><select data-bvf-row-field="sourceId">${inputOptions(row.sourceId)}</select></td>
        <td><button data-bvf-remove-row="${esc(row.id)}" aria-label="Xóa dòng">×</button></td>
      </tr>`).join("") : `<tr><td colspan="6"><p>Chưa có dữ liệu. Nhập CSV/JSON, chọn nhiều media hoặc thêm dòng thủ công.</p></td></tr>`}</tbody></table></div>
      <p class="bvf-honesty">CSV dùng các cột: <code>title, subtitle, cta, accent, sourceName</code>. Tool ghép dữ liệu vào sườn; không tự tạo nội dung mẫu hoặc dùng asset ngoài Media Pool.</p>
    </section>`;
  }

  function queueMarkup() {
    const completed = state.jobs.filter((item) => item.status === "completed").length;
    const failed = state.jobs.filter((item) => item.status === "failed").length;
    return `<section class="bvf-panel bvf-queue">
      <header><div><small>RENDER QUEUE · ${completed} XONG · ${failed} LỖI</small><h3>Hàng đợi kết xuất</h3></div><span>${running ? "Đang chạy" : "Sẵn sàng"}</span></header>
      <div class="bvf-preflight" data-bvf-preflight></div>
      <div class="bvf-queue-actions"><button data-bvf-action="build-queue">Tạo lại hàng đợi</button><button class="is-primary" data-bvf-action="render-all" ${running ? "disabled" : ""}>Render tất cả</button><button data-bvf-action="cancel" ${running ? "" : "disabled"}>Dừng sau job hiện tại</button><button data-bvf-action="download-all" ${completed ? "" : "disabled"}>Tải tất cả file xong</button></div>
      <div class="bvf-job-list">${state.jobs.length ? state.jobs.map((job) => {
        const url = outputUrls.get(job.outputAssetId);
        return `<article class="is-${job.status}" data-bvf-job="${esc(job.id)}"><i>${job.status === "completed" ? "✓" : job.status === "failed" ? "!" : job.status === "processing" ? "●" : "○"}</i><div><strong>${esc(job.title)}</strong><small>${esc(job.error || job.outputName || job.status)}${job.outputSize ? ` · ${formatBytes(job.outputSize)}` : ""}</small><span><b style="width:${job.progress}%"></b></span></div><em>${Math.round(job.progress)}%</em>${url ? `<a href="${esc(url)}" download="${esc(job.outputName)}">Tải</a>` : job.status === "failed" || job.status === "cancelled" ? `<button data-bvf-retry="${esc(job.id)}">Thử lại</button>` : ""}</article>`;
      }).join("") : "<p>Chưa có hàng đợi. Mỗi dòng dữ liệu sẽ trở thành một job.</p>"}</div>
    </section>`;
  }

  function render() {
    if (!root) return;
    const caps = capabilities();
    root.innerHTML = `<section class="bvf-shell">
      <header class="bvf-hero"><div class="bvf-core"><b>H</b><i></i></div><div><small>TOOL · BATCH VIDEO FACTORY</small><h2>Một sườn, hàng loạt video thật</h2><p>Trộn dữ liệu và media vào một template, kiểm tra từng biến thể rồi kết xuất tuần tự ngay trên thiết bị.</p></div><aside><span class="is-${caps.recorderReady ? "ready" : "unsupported"}">${caps.recorderReady ? "Renderer sẵn sàng" : "Thiết bị không hỗ trợ render"}</span><small>${caps.mp4Mime ? "MP4 H.264 khả dụng" : "MP4 không có · dùng WebM fallback"} · IndexedDB ${caps.indexedDb ? "sẵn sàng" : "không hỗ trợ"}</small></aside></header>
      <section class="bvf-live"><article><span>SƯỜN</span><strong>${esc(state.template.name)}</strong></article><article><span>BIẾN THỂ</span><strong>${state.rows.length}</strong></article><article><span>JOB</span><strong>${state.jobs.length}</strong></article><article><span>THỜI LƯỢNG ƯỚC TÍNH</span><strong>${Math.ceil(state.rows.length * state.template.duration / 60)} phút</strong></article><article><span>RENDER</span><strong>${running ? "Đang chạy" : "Local-first"}</strong></article></section>
      <div class="bvf-layout"><main>${templateMarkup()}${dataMarkup()}</main><aside><section class="bvf-panel bvf-preview"><header><div><small>LIVE PREVIEW</small><h3>Khung đầu ra</h3></div><span>Canvas thật</span></header><canvas data-bvf-canvas width="${state.template.width}" height="${state.template.height}"></canvas><p>Preview dùng dòng đầu tiên. Hiệu ứng render giữ cùng sườn, màu và safe zone.</p></section>${queueMarkup()}</aside></div>
      <footer><span data-bvf-status role="status" aria-live="polite">Sẵn sàng · file nguồn và kết quả nằm trong Media Pool của thiết bị này.</span><span>Render trình duyệt chạy theo thời lượng thật; tab cần được giữ hoạt động.</span></footer>
    </section>`;
    drawPreview();
    renderPreflight();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, align) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, index) => {
      const clipped = index === maxLines - 1 && lines.length > maxLines ? `${value.slice(0, -1)}…` : value;
      ctx.textAlign = align;
      ctx.fillText(clipped, x, y + index * lineHeight);
    });
  }

  function drawCover(ctx, media, width, height, scale = 1) {
    const sourceWidth = media.videoWidth || media.naturalWidth || width;
    const sourceHeight = media.videoHeight || media.naturalHeight || height;
    const ratio = Math.max(width / sourceWidth, height / sourceHeight) * scale;
    const drawWidth = sourceWidth * ratio;
    const drawHeight = sourceHeight * ratio;
    ctx.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawFrame(canvas, row, progress = 0, media = null) {
    const ctx = canvas.getContext("2d");
    const template = state.template;
    const width = canvas.width;
    const height = canvas.height;
    const accent = row?.accent || template.accent;
    const motion = template.motion;
    const ease = 1 - Math.pow(1 - Math.min(1, progress * 2.4), 3);
    const drift = motion === "drift" || motion === "cinematic" ? 1 + progress * .035 : 1;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, template.background);
    gradient.addColorStop(.58, "#10152f");
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    if (media) {
      ctx.save();
      ctx.globalAlpha = .86;
      drawCover(ctx, media, width, height, drift);
      ctx.restore();
    }
    const overlay = ctx.createLinearGradient(template.layout === "left" ? 0 : width / 2, 0, width, 0);
    overlay.addColorStop(0, `rgba(2,5,14,${template.overlay / 100})`);
    overlay.addColorStop(1, `rgba(2,5,14,${Math.max(.2, template.overlay / 260)})`);
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);
    for (let index = 0; index < 70; index += 1) {
      const x = (index * 193 + progress * width * (index % 3 + 1) * .08) % width;
      const y = (index * 97 + Math.sin(index * 3.2) * 120 + height) % height;
      ctx.globalAlpha = .18 + (index % 5) * .08;
      ctx.fillStyle = index % 4 ? "#ffffff" : accent;
      ctx.beginPath();
      ctx.arc(x, y, 1 + index % 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const pad = width * .075;
    const center = template.layout === "center";
    const textX = center ? width / 2 : pad;
    const maxText = center ? width * .78 : width * .64;
    const entrance = motion === "slide" || motion === "cinematic" ? (1 - ease) * -width * .08 : 0;
    ctx.save();
    ctx.translate(entrance, 0);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 28;
    ctx.fillRect(center ? width * .25 : pad, height * .245, center ? width * .5 : width * .12, Math.max(5, height * .007));
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${template.titleSize / 1920 * width}px "Segoe UI",sans-serif`;
    ctx.textBaseline = "top";
    wrapText(ctx, row?.title || "VIDEO TITLE", textX, height * .29, maxText, template.titleSize / 1920 * width * 1.08, 3, center ? "center" : "left");
    ctx.fillStyle = "#c9d7eb";
    ctx.font = `650 ${template.subtitleSize / 1920 * width}px "Segoe UI",sans-serif`;
    wrapText(ctx, row?.subtitle || "Dòng phụ từ dữ liệu hàng loạt", textX, height * .61, maxText, template.subtitleSize / 1920 * width * 1.25, 3, center ? "center" : "left");
    if (row?.cta) {
      const ctaY = height * .76;
      ctx.font = `800 ${template.ctaSize / 1920 * width}px "Segoe UI",sans-serif`;
      const ctaWidth = Math.min(maxText, ctx.measureText(row.cta).width + width * .045);
      const ctaX = center ? width / 2 - ctaWidth / 2 : pad;
      ctx.fillStyle = accent;
      ctx.fillRect(ctaX, ctaY, ctaWidth, height * .072);
      ctx.fillStyle = "#07101d";
      ctx.textAlign = center ? "center" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(row.cta, center ? width / 2 : ctaX + width * .02, ctaY + height * .036);
    }
    ctx.restore();
    const logoRadius = width * .033;
    ctx.beginPath();
    ctx.arc(width - pad, pad, logoRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#07101d";
    ctx.font = `950 ${logoRadius}px "Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(template.logo, width - pad, pad);
    ctx.fillStyle = "#ffffffa8";
    ctx.font = `750 ${Math.max(14, width * .012)}px "Segoe UI",sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(template.watermark, width - pad, height - pad * .55);
    if (motion === "pulse" || motion === "orbit") {
      ctx.strokeStyle = `${accent}99`;
      ctx.lineWidth = Math.max(2, width * .002);
      ctx.beginPath();
      ctx.arc(width - pad, pad, logoRadius * (1.35 + Math.sin(progress * Math.PI * 4) * .08), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  async function mediaForRow(row) {
    const asset = assets.find((item) => item.id === row.sourceId && item.file instanceof Blob);
    if (!asset) return null;
    const url = URL.createObjectURL(asset.file);
    if (asset.type?.startsWith("image/")) {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Không đọc được ảnh ${asset.name}.`));
        image.src = url;
      });
      return { element: image, url, type: "image" };
    }
    const video = document.createElement("video");
    video.src = url;
    video.preload = "auto";
    video.playsInline = true;
    video.loop = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error(`Không đọc được video ${asset.name}.`));
      video.load();
    });
    return { element: video, url, type: "video" };
  }

  function drawPreview() {
    const canvas = root?.querySelector("[data-bvf-canvas]");
    if (!canvas) return;
    canvas.width = state.template.width;
    canvas.height = state.template.height;
    const row = state.rows[0] || normalizeRow({ title: "MỘT SƯỜN · NHIỀU VIDEO", subtitle: "CSV, media, transition và render queue", cta: "BẮT ĐẦU" });
    drawFrame(canvas, row, .25);
    if (row.sourceId) {
      mediaForRow(row).then((media) => {
        if (!root?.isConnected || !media) return;
        drawFrame(canvas, row, .25, media.element);
        URL.revokeObjectURL(media.url);
      }).catch(() => {});
    }
  }

  function preflight() {
    const caps = capabilities();
    const template = state.template;
    const requestedMp4 = template.format === "mp4";
    const actualMime = requestedMp4 ? caps.mp4Mime || caps.webmMime : caps.webmMime;
    const checks = [
      { label: "Canvas captureStream", pass: caps.capture, detail: caps.capture ? "Sẵn sàng" : "Thiết bị không hỗ trợ" },
      { label: "MediaRecorder", pass: caps.recorderReady, detail: caps.recorderReady ? "Sẵn sàng" : "Thiết bị không hỗ trợ" },
      { label: requestedMp4 ? "MP4 H.264" : "WebM VP9", pass: Boolean(actualMime), detail: requestedMp4 && !caps.mp4Mime ? "Sẽ dùng WebM fallback" : actualMime || "Không có codec" },
      { label: "Dữ liệu đầu vào", pass: state.rows.length > 0, detail: `${state.rows.length} biến thể` },
      { label: "Media liên kết", pass: state.rows.every((row) => !row.sourceId || assets.some((asset) => asset.id === row.sourceId)), detail: "Asset thiếu sẽ chặn job tương ứng" },
      { label: "Media Pool", pass: caps.indexedDb || !state.saveToMediaPool, detail: caps.indexedDb ? "Lưu file thật" : "Không hỗ trợ" }
    ];
    return { checks, ready: checks.every((item) => item.pass), mime: actualMime };
  }

  function renderPreflight() {
    const host = root?.querySelector("[data-bvf-preflight]");
    if (!host) return;
    const result = preflight();
    host.innerHTML = result.checks.map((item) => `<span class="${item.pass ? "is-ready" : "is-blocked"}"><i>${item.pass ? "✓" : "!"}</i><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></span>`).join("");
  }

  function updateJob(job, patch) {
    Object.assign(job, patch);
    saveState();
    const row = root?.querySelector(`[data-bvf-job="${job.id}"]`);
    if (!row) return;
    row.className = `is-${job.status}`;
    row.querySelector("i").textContent = job.status === "completed" ? "✓" : job.status === "failed" ? "!" : job.status === "processing" ? "●" : "○";
    row.querySelector("em").textContent = `${Math.round(job.progress)}%`;
    row.querySelector("span b").style.width = `${job.progress}%`;
    const detail = row.querySelector("small");
    if (detail) detail.textContent = job.error || job.outputName || job.status;
  }

  async function storeOutput(job, blob, mime) {
    const extension = /^video\/mp4/i.test(mime) ? "mp4" : "webm";
    const safeName = job.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "batch-video";
    const outputName = `${safeName}-${job.id.slice(-5)}.${extension}`;
    const file = new File([blob], outputName, { type: mime });
    const assetId = uid("batch-output");
    if (state.saveToMediaPool) {
      await dbPut({
        id: assetId,
        ownerId: ownerId(),
        name: outputName,
        type: mime,
        size: file.size,
        duration: state.template.duration,
        width: state.template.width,
        height: state.template.height,
        source: "batch-video-output",
        batchJobId: job.id,
        createdAt: new Date().toISOString(),
        file
      });
    }
    const url = URL.createObjectURL(file);
    outputUrls.set(assetId, url);
    window.dispatchEvent(new CustomEvent("hh:media-asset-created", { detail: { id: assetId, name: outputName, source: "batch-video-factory" } }));
    return { assetId, outputName, size: file.size, mime, url };
  }

  async function renderJob(job) {
    const row = state.rows.find((item) => item.id === job.rowId);
    if (!row) throw new Error("Dòng dữ liệu của job không còn tồn tại.");
    if (row.sourceId && !assets.some((asset) => asset.id === row.sourceId)) throw new Error("Asset nguồn bị thiếu hoặc đã bị xóa.");
    const caps = capabilities();
    const mime = state.template.format === "mp4" ? caps.mp4Mime || caps.webmMime : caps.webmMime;
    if (!caps.recorderReady || !mime) throw new Error("Thiết bị không có bộ render video tương thích.");
    const canvas = document.createElement("canvas");
    canvas.width = state.template.width;
    canvas.height = state.template.height;
    const stream = canvas.captureStream(state.template.fps);
    const media = await mediaForRow(row);
    let audioContext = null;
    if (media?.type === "video" && (window.AudioContext || window.webkitAudioContext)) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        const source = audioContext.createMediaElementSource(media.element);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch {}
    }
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: state.template.bitrate });
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (event) => reject(event.error || new Error("MediaRecorder gặp lỗi."));
    });
    updateJob(job, { status: "processing", progress: 0, error: "" });
    cancelRequested = false;
    const startedAt = performance.now();
    recorder.start(500);
    if (media?.type === "video") {
      media.element.currentTime = 0;
      await media.element.play().catch(() => {});
    }
    await new Promise((resolve) => {
      const frame = (now) => {
        const elapsed = (now - startedAt) / 1000;
        const progress = Math.min(1, elapsed / state.template.duration);
        drawFrame(canvas, row, progress, media?.element || null);
        updateJob(job, { progress: progress * 100 });
        if (progress >= 1 || cancelRequested) return resolve();
        frameId = requestAnimationFrame(frame);
      };
      frameId = requestAnimationFrame(frame);
    });
    if (media?.type === "video") media.element.pause();
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext) await audioContext.close().catch(() => {});
    if (media?.url) URL.revokeObjectURL(media.url);
    recorder = null;
    if (cancelRequested) throw Object.assign(new Error("Đã hủy theo yêu cầu."), { cancelled: true });
    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    if (!blob.size) throw new Error("File kết quả rỗng.");
    const output = await storeOutput(job, blob, blob.type);
    updateJob(job, {
      status: "completed",
      progress: 100,
      outputAssetId: output.assetId,
      outputName: output.outputName,
      outputSize: output.size,
      outputMime: output.mime,
      completedAt: new Date().toISOString()
    });
    if (state.autoDownload) downloadUrl(output.url, output.outputName);
    window.dispatchEvent(new CustomEvent("hh:video-batch-status", { detail: { jobId: job.id, status: "completed", outputAssetId: output.assetId } }));
  }

  async function runQueue() {
    if (running) return;
    const check = preflight();
    if (!check.ready) return status("Preflight chưa đạt. Hãy xử lý các mục màu đỏ trước khi render.", "error");
    running = true;
    cancelRequested = false;
    render();
    status("Đang bắt đầu hàng đợi render tuần tự…", "success");
    for (const job of state.jobs.filter((item) => ["queued", "failed", "cancelled"].includes(item.status))) {
      if (cancelRequested) break;
      try {
        await renderJob(job);
      } catch (error) {
        updateJob(job, {
          status: error.cancelled ? "cancelled" : "failed",
          error: error.message,
          progress: error.cancelled ? job.progress : 0
        });
        window.dispatchEvent(new CustomEvent("hh:video-batch-status", { detail: { jobId: job.id, status: error.cancelled ? "cancelled" : "failed", message: error.message } }));
      }
    }
    running = false;
    cancelRequested = false;
    await refreshAssets();
    render();
    status(`Hàng đợi hoàn tất: ${state.jobs.filter((item) => item.status === "completed").length}/${state.jobs.length} video.`, "success");
  }

  function buildQueue() {
    state.jobs = state.rows.map((row) => normalizeJob({
      id: uid("job"),
      rowId: row.id,
      title: row.title,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString()
    }));
    saveState();
    render();
    status(`Đã tạo ${state.jobs.length} job từ sườn ${state.template.name}.`, "success");
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let quoted = false;
    let record = [];
    const records = [];
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') {
        if (quoted && input[index + 1] === '"') { current += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { record.push(current); current = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && input[index + 1] === "\n") index += 1;
        record.push(current); current = "";
        if (record.some((value) => value.trim())) records.push(record);
        record = [];
      } else current += char;
    }
    record.push(current);
    if (record.some((value) => value.trim())) records.push(record);
    if (!records.length) return [];
    const headers = records.shift().map((value) => value.trim().toLowerCase());
    records.slice(0, MAX_ROWS).forEach((values, index) => {
      const item = Object.fromEntries(headers.map((header, cell) => [header, values[cell]?.trim() || ""]));
      rows.push(normalizeRow({
        title: item.title || item.tieu_de,
        subtitle: item.subtitle || item.dong_phu,
        cta: item.cta,
        accent: item.accent || item.color,
        sourceName: item.sourcename || item.media || item.file
      }, index));
    });
    return rows;
  }

  function resolveSourceNames(rows) {
    return rows.map((row) => {
      const match = sourceAssets().find((asset) => asset.name.toLowerCase() === row.sourceName.toLowerCase());
      return match ? { ...row, sourceId: match.id, sourceName: match.name } : row;
    });
  }

  function downloadUrl(url, name) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function importAssets(files) {
    const accepted = [...files].filter((file) => (
      (file.type.startsWith("image/") || file.type.startsWith("video/")) && file.size <= MAX_INPUT_SIZE
    )).slice(0, MAX_ROWS);
    for (const file of accepted) {
      const id = uid("batch-input");
      await dbPut({
        id,
        ownerId: ownerId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        source: "batch-video-input",
        createdAt: new Date().toISOString(),
        file
      });
    }
    await refreshAssets();
    const unassigned = state.rows.filter((row) => !row.sourceId);
    accepted.forEach((file, index) => {
      const asset = sourceAssets().find((item) => item.name === file.name);
      if (asset && unassigned[index]) {
        unassigned[index].sourceId = asset.id;
        unassigned[index].sourceName = asset.name;
      } else if (asset && state.rows.length < MAX_ROWS) {
        state.rows.push(normalizeRow({ title: file.name.replace(/\.[^.]+$/, ""), sourceId: asset.id, sourceName: asset.name }, state.rows.length));
      }
    });
    saveState();
    render();
    status(`Đã nhập ${accepted.length} asset thật vào Media Pool.`, accepted.length ? "success" : "error");
  }

  async function handleFileChange(event) {
    const target = event.target;
    if (target.matches("[data-bvf-assets]")) return importAssets(target.files || []);
    if (target.matches("[data-bvf-template-file]")) {
      const file = target.files?.[0];
      if (!file || file.size > 512 * 1024) throw new Error("Sườn JSON phải nhỏ hơn 512 KB.");
      state.template = normalizeTemplate(JSON.parse(await file.text()));
      state.presetId = "custom";
      saveState(); render(); status("Đã nhập sườn JSON.", "success"); return;
    }
    if (target.matches("[data-bvf-data-file]")) {
      const file = target.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) throw new Error("File dữ liệu phải nhỏ hơn 2 MB.");
      const text = await file.text();
      let rows;
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(text);
        rows = (Array.isArray(parsed) ? parsed : parsed.rows || []).slice(0, MAX_ROWS).map(normalizeRow);
      } else rows = parseCsv(text);
      state.rows = resolveSourceNames(rows);
      state.jobs = [];
      saveState(); render(); status(`Đã nhập ${state.rows.length} dòng dữ liệu.`, "success");
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("[data-bvf-template]")) {
      const key = target.dataset.bvfTemplate;
      const numeric = ["duration", "fps", "bitrate"].includes(key);
      state.template[key] = numeric ? Number(target.value) : target.value;
      state.template = normalizeTemplate(state.template);
      state.presetId = "custom";
      saveState();
      drawPreview();
      renderPreflight();
      return;
    }
    if (target.matches("[data-bvf-resolution]")) {
      [state.template.width, state.template.height] = target.value.split("x").map(Number);
      state.presetId = "custom";
      saveState(); drawPreview(); return;
    }
    if (target.matches("[data-bvf-option]")) {
      state[target.dataset.bvfOption] = target.checked;
      saveState();
      return;
    }
    const rowElement = target.closest("[data-bvf-row]");
    if (rowElement && target.matches("[data-bvf-row-field]")) {
      const row = state.rows.find((item) => item.id === rowElement.dataset.bvfRow);
      if (!row) return;
      row[target.dataset.bvfRowField] = target.value;
      if (target.dataset.bvfRowField === "sourceId") row.sourceName = assets.find((item) => item.id === target.value)?.name || "";
      saveState();
      if (state.rows[0]?.id === row.id) drawPreview();
      renderPreflight();
    }
  }

  async function handleClick(event) {
    const preset = event.target.closest("[data-bvf-preset]");
    if (preset) {
      const value = PRESETS.find((item) => item.id === preset.dataset.bvfPreset);
      if (!value) return;
      state.presetId = value.id;
      state.template = normalizeTemplate({ ...state.template, ...value });
      saveState(); render(); return status(`Đã áp dụng sườn ${value.name}.`, "success");
    }
    const remove = event.target.closest("[data-bvf-remove-row]");
    if (remove) {
      state.rows = state.rows.filter((item) => item.id !== remove.dataset.bvfRemoveRow);
      state.jobs = state.jobs.filter((job) => state.rows.some((row) => row.id === job.rowId));
      saveState(); render(); return;
    }
    const retry = event.target.closest("[data-bvf-retry]");
    if (retry) {
      const job = state.jobs.find((item) => item.id === retry.dataset.bvfRetry);
      if (job) updateJob(job, { status: "queued", progress: 0, error: "" });
      return runQueue();
    }
    const action = event.target.closest("[data-bvf-action]")?.dataset.bvfAction;
    if (!action) return;
    if (action === "add-row") {
      if (state.rows.length >= MAX_ROWS) return status(`Giới hạn ${MAX_ROWS} video mỗi batch.`, "error");
      state.rows.push(normalizeRow({}, state.rows.length)); saveState(); render(); return;
    }
    if (action === "build-queue") return buildQueue();
    if (action === "render-all") {
      if (!state.jobs.length) buildQueue();
      return runQueue();
    }
    if (action === "cancel") {
      cancelRequested = true;
      if (recorder?.state === "recording") status("Đang dừng an toàn sau frame hiện tại…", "error");
      return;
    }
    if (action === "preview") { drawPreview(); return status("Đã cập nhật preview từ sườn và dòng đầu tiên.", "success"); }
    if (action === "export-template") {
      return downloadBlob(new Blob([JSON.stringify({ version: 1, template: state.template }, null, 2)], { type: "application/json" }), "hh-video-template.json");
    }
    if (action === "sample-csv") {
      return downloadBlob(new Blob(["title,subtitle,cta,accent,sourceName\nVideo 1,Dòng phụ 1,Xem ngay,#6be8ff,background-1.jpg\nVideo 2,Dòng phụ 2,Đăng ký,#ff65c8,background-2.mp4\n"], { type: "text/csv;charset=utf-8" }), "hh-batch-video-sample.csv");
    }
    if (action === "download-all") {
      state.jobs.filter((job) => job.status === "completed").forEach((job, index) => {
        const url = outputUrls.get(job.outputAssetId);
        if (url) setTimeout(() => downloadUrl(url, job.outputName), index * 350);
      });
    }
  }

  async function mount(host) {
    unmount();
    root = host;
    state = loadState();
    controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener("click", (event) => handleClick(event).catch((error) => status(error.message, "error")), options);
    root.addEventListener("input", handleInput, options);
    root.addEventListener("change", (event) => handleFileChange(event).catch((error) => status(error.message, "error")), options);
    window.addEventListener("hh:auth-change", async () => {
      cancelRequested = true;
      state = loadState();
      await refreshAssets();
      render();
    }, options);
    render();
    await refreshAssets();
    render();
  }

  function unmount() {
    cancelRequested = true;
    cancelAnimationFrame(frameId);
    if (recorder?.state === "recording") recorder.stop();
    recorder = null;
    running = false;
    controller?.abort();
    controller = null;
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
    if (root) root.innerHTML = "";
    root = null;
  }

  window.HHVideoBatchFactory = Object.freeze({
    mount,
    unmount,
    presets: PRESETS,
    normalizeTemplate,
    normalizeRow,
    parseCsv,
    capabilities
  });
  window.dispatchEvent(new CustomEvent("hh:video-batch-ready"));
})();
