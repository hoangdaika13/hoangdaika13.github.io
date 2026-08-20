(function (globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHMemeHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createMemeHub(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_KEY = "hh.meme.projects.v1";
  const MAX_PROJECTS = 18;
  const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
  const SAFE_MEDIA_HOSTS = new Set(["upload.wikimedia.org", "commons.wikimedia.org"]);
  const TABS = new Set(["images", "gif", "upload", "projects", "rights"]);
  const STICKERS = Object.freeze([
    { id: "laugh", glyph: "😂", label: "Cười" },
    { id: "fire", glyph: "🔥", label: "Lửa" },
    { id: "spark", glyph: "💫", label: "Lấp lánh" },
    { id: "heart", glyph: "❤️", label: "Tim" },
    { id: "eyes", glyph: "👀", label: "Đôi mắt" },
    { id: "hundred", glyph: "💯", label: "Một trăm" },
    { id: "star", glyph: "★", label: "Ngôi sao", shape: true },
    { id: "arrow", glyph: "➜", label: "Mũi tên", shape: true },
    { id: "bubble", glyph: "●", label: "Bong bóng", shape: true }
  ]);

  let runtime = null;

  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  const cleanText = (value = "") => String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  const escapeHtml = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const safeUrl = (value, allowedHosts = SAFE_MEDIA_HOSTS) => {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:" || (allowedHosts && !allowedHosts.has(url.hostname))) return "";
      return url.href;
    } catch {
      return "";
    }
  };

  function licenseFamily(shortName = "") {
    const name = cleanText(shortName).toUpperCase().replace(/[_–—]/g, "-");
    if (/PUBLIC DOMAIN|PDM|NO KNOWN COPYRIGHT/.test(name)) return "public-domain";
    if (/\bCC0\b/.test(name)) return "cc0";
    if (/\bCC BY-SA\b/.test(name) && !/\bNC\b|\bND\b/.test(name)) return "cc-by-sa";
    if (/\bCC BY\b/.test(name) && !/\bNC\b|\bND\b|BY-SA/.test(name)) return "cc-by";
    return "unsupported";
  }

  function licenseAllowed(shortName = "") {
    return licenseFamily(shortName) !== "unsupported";
  }

  const metaValue = (metadata, key) => cleanText(metadata?.[key]?.value || "");

  function parseWikimediaPage(page) {
    const info = page?.imageinfo?.[0];
    if (!info) return null;
    const metadata = info.extmetadata || {};
    const license = metaValue(metadata, "LicenseShortName") || metaValue(metadata, "UsageTerms");
    const family = licenseFamily(license);
    if (family === "unsupported") return null;
    const originalUrl = safeUrl(info.url);
    const thumbUrl = safeUrl(info.thumburl || info.url);
    const sourceUrl = safeUrl(info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`);
    if (!originalUrl || !thumbUrl || !sourceUrl) return null;
    const author = metaValue(metadata, "Artist") || metaValue(metadata, "Credit") || "Tác giả trên Wikimedia Commons";
    const title = metaValue(metadata, "ObjectName") || cleanText(page.title || "").replace(/^File:/i, "") || "Tài nguyên Commons";
    const licenseUrl = safeUrl(metaValue(metadata, "LicenseUrl"), null) || sourceUrl;
    const attributionRequired = family === "cc-by" || family === "cc-by-sa" || /true|yes|required/i.test(metaValue(metadata, "AttributionRequired"));
    const mime = String(info.mime || "image/unknown").toLowerCase();
    return {
      id: String(page.pageid || page.title || originalUrl),
      provider: "Wikimedia Commons",
      title,
      author,
      license,
      licenseFamily: family,
      licenseUrl,
      sourceUrl,
      url: originalUrl,
      thumbUrl,
      mime,
      width: Number(info.width) || 0,
      height: Number(info.height) || 0,
      animated: mime === "image/gif",
      attributionRequired,
      shareAlike: family === "cc-by-sa",
      restrictions: metaValue(metadata, "Restrictions"),
      attribution: `${title} — ${author} — ${license} — Wikimedia Commons (${sourceUrl})`
    };
  }

  async function searchCommons(query, options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Trình duyệt không hỗ trợ kết nối thư viện.");
    const normalized = cleanText(query).slice(0, 120);
    if (normalized.length < 2) throw new Error("Hãy nhập ít nhất 2 ký tự để tìm kiếm.");
    const kind = options.kind === "gif" ? "gif" : "image";
    const limit = Math.round(clamp(options.limit, 8, 48, 24));
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: kind === "gif" ? `${normalized} filemime:image/gif` : normalized,
      gsrlimit: kind === "gif" ? "48" : String(Math.max(limit, 30)),
      prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata",
      iiurlwidth: "760",
      format: "json",
      formatversion: "2",
      origin: "*"
    });
    const response = await fetchImpl(`${COMMONS_API}?${params}`, { signal: options.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Wikimedia Commons phản hồi lỗi ${response.status}.`);
    const payload = await response.json();
    const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
    return pages
      .map(parseWikimediaPage)
      .filter(Boolean)
      .filter((item) => kind === "gif" ? item.animated : !item.animated)
      .filter((item) => !options.license || options.license === "all" || item.licenseFamily === options.license)
      .slice(0, limit);
  }

  function defaultProject() {
    return {
      id: `meme-${Date.now().toString(36)}`,
      name: "Meme chưa đặt tên",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      width: 1200,
      height: 1200,
      fit: "contain",
      focusX: 50,
      focusY: 50,
      background: "#080b20",
      source: null,
      includeCredit: true,
      captions: {
        top: { text: "KHI BẠN ĐÃ SẴN SÀNG", x: 50, y: 11, size: 68, color: "#ffffff", stroke: "#080816", strokeWidth: 8, font: "Impact", align: "center", shadow: true, uppercase: true },
        bottom: { text: "NHƯNG DEADLINE CHƯA SẴN SÀNG", x: 50, y: 87, size: 68, color: "#ffffff", stroke: "#080816", strokeWidth: 8, font: "Impact", align: "center", shadow: true, uppercase: true },
        free: { text: "", x: 50, y: 50, size: 52, color: "#ffe46b", stroke: "#241044", strokeWidth: 6, font: "Arial", align: "center", shadow: true, uppercase: false }
      },
      overlays: []
    };
  }

  function normalizeCaption(value, fallback) {
    const source = value && typeof value === "object" ? value : {};
    return {
      text: String(source.text ?? fallback.text).slice(0, 280),
      x: clamp(source.x, 0, 100, fallback.x),
      y: clamp(source.y, 0, 100, fallback.y),
      size: clamp(source.size, 16, 160, fallback.size),
      color: /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : fallback.color,
      stroke: /^#[0-9a-f]{6}$/i.test(source.stroke) ? source.stroke : fallback.stroke,
      strokeWidth: clamp(source.strokeWidth, 0, 18, fallback.strokeWidth),
      font: ["Impact", "Arial", "Be Vietnam Pro", "Georgia", "Courier New"].includes(source.font) ? source.font : fallback.font,
      align: ["left", "center", "right"].includes(source.align) ? source.align : fallback.align,
      shadow: source.shadow !== false,
      uppercase: Boolean(source.uppercase)
    };
  }

  function normalizeSource(value) {
    if (!value || typeof value !== "object") return null;
    const isLocal = Boolean(value.local);
    const url = isLocal && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value.url || "") ? value.url : safeUrl(value.url);
    const thumbUrl = isLocal ? url : safeUrl(value.thumbUrl || value.url);
    if (!url || !thumbUrl) return null;
    return {
      id: String(value.id || url).slice(0, 500),
      provider: cleanText(value.provider || (isLocal ? "Tệp của bạn" : "Wikimedia Commons")).slice(0, 80),
      title: cleanText(value.title || "Ảnh nền").slice(0, 220),
      author: cleanText(value.author || (isLocal ? "Bạn" : "Không rõ")).slice(0, 220),
      license: cleanText(value.license || (isLocal ? "Quyền do người dùng xác nhận" : "")).slice(0, 120),
      licenseFamily: cleanText(value.licenseFamily || (isLocal ? "user-owned" : "unsupported")),
      licenseUrl: isLocal ? "" : safeUrl(value.licenseUrl, null),
      sourceUrl: isLocal ? "" : safeUrl(value.sourceUrl),
      url,
      thumbUrl,
      mime: String(value.mime || "image/unknown").slice(0, 80),
      animated: Boolean(value.animated),
      attributionRequired: Boolean(value.attributionRequired),
      shareAlike: Boolean(value.shareAlike),
      restrictions: cleanText(value.restrictions || "").slice(0, 220),
      attribution: cleanText(value.attribution || "").slice(0, 1000),
      local: isLocal,
      rightsConfirmed: Boolean(value.rightsConfirmed)
    };
  }

  function normalizeProject(value) {
    const fallback = defaultProject();
    const source = value && typeof value === "object" ? value : {};
    const overlays = Array.isArray(source.overlays) ? source.overlays.slice(0, 40).map((item, index) => ({
      id: String(item?.id || `overlay-${index}-${Date.now().toString(36)}`),
      glyph: String(item?.glyph || "★").slice(0, 8),
      label: cleanText(item?.label || "Nhãn dán").slice(0, 60),
      shape: Boolean(item?.shape),
      x: clamp(item?.x, 0, 100, 50),
      y: clamp(item?.y, 0, 100, 50),
      size: clamp(item?.size, 18, 240, 90),
      rotation: clamp(item?.rotation, -180, 180, 0),
      color: /^#[0-9a-f]{6}$/i.test(item?.color) ? item.color : "#ffe96b"
    })) : [];
    return {
      id: String(source.id || fallback.id).slice(0, 100),
      name: cleanText(source.name || fallback.name).slice(0, 100),
      createdAt: source.createdAt || fallback.createdAt,
      updatedAt: source.updatedAt || fallback.updatedAt,
      width: Math.round(clamp(source.width, 320, 2400, fallback.width)),
      height: Math.round(clamp(source.height, 320, 2400, fallback.height)),
      fit: ["contain", "cover", "stretch"].includes(source.fit) ? source.fit : fallback.fit,
      focusX: clamp(source.focusX, 0, 100, fallback.focusX),
      focusY: clamp(source.focusY, 0, 100, fallback.focusY),
      background: /^#[0-9a-f]{6}$/i.test(source.background) ? source.background : fallback.background,
      source: normalizeSource(source.source),
      includeCredit: source.includeCredit !== false,
      captions: {
        top: normalizeCaption(source.captions?.top, fallback.captions.top),
        bottom: normalizeCaption(source.captions?.bottom, fallback.captions.bottom),
        free: normalizeCaption(source.captions?.free, fallback.captions.free)
      },
      overlays
    };
  }

  const cloneProject = (project) => normalizeProject(JSON.parse(JSON.stringify(project)));

  function readProjects(storage = globalScope.localStorage) {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, MAX_PROJECTS).map(normalizeProject) : [];
    } catch {
      return [];
    }
  }

  function writeProjects(projects, storage = globalScope.localStorage) {
    const safe = projects.slice(0, MAX_PROJECTS).map(normalizeProject);
    storage?.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  function fileName(value, extension) {
    const base = cleanText(value || "hh-meme").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "hh-meme";
    return `${base}.${extension}`;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (!String(url).startsWith("data:")) image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Không thể tải ảnh. Hãy thử một tài nguyên khác hoặc tải ảnh từ máy."));
      image.src = url;
    });
  }

  function fitCanvasToImage(project, image) {
    if (!image?.naturalWidth || !image?.naturalHeight) return;
    const maxSide = 1600;
    const maxPixels = 2_600_000;
    const scale = Math.min(1.5, maxSide / Math.max(image.naturalWidth, image.naturalHeight), Math.sqrt(maxPixels / (image.naturalWidth * image.naturalHeight)));
    project.width = Math.max(420, Math.round(image.naturalWidth * scale));
    project.height = Math.max(420, Math.round(image.naturalHeight * scale));
  }

  function wrapLines(context, text, maxWidth) {
    const paragraphs = String(text || "").split(/\n/);
    const lines = [];
    paragraphs.forEach((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(""); return; }
      let line = words.shift();
      words.forEach((word) => {
        const next = `${line} ${word}`;
        if (context.measureText(next).width <= maxWidth) line = next;
        else { lines.push(line); line = word; }
      });
      lines.push(line);
    });
    return lines.slice(0, 8);
  }

  function drawCaption(context, caption, width, height) {
    const rawText = caption.uppercase ? caption.text.toUpperCase() : caption.text;
    if (!rawText.trim()) return;
    const scale = width / 1200;
    const fontSize = Math.max(14, caption.size * scale);
    context.save();
    context.font = `900 ${fontSize}px "${caption.font}", Arial, sans-serif`;
    context.textAlign = caption.align;
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.fillStyle = caption.color;
    context.strokeStyle = caption.stroke;
    context.lineWidth = caption.strokeWidth * scale;
    if (caption.shadow) {
      context.shadowColor = "rgba(0,0,0,.78)";
      context.shadowBlur = 14 * scale;
      context.shadowOffsetY = 5 * scale;
    }
    const lines = wrapLines(context, rawText, width * 0.88);
    const lineHeight = fontSize * 1.08;
    const totalHeight = (lines.length - 1) * lineHeight;
    const x = width * caption.x / 100;
    const startY = height * caption.y / 100 - totalHeight / 2;
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      if (context.lineWidth > 0) context.strokeText(line, x, y, width * 0.92);
      context.fillText(line, x, y, width * 0.92);
    });
    context.restore();
  }

  function drawSource(context, image, project) {
    const width = project.width;
    const height = project.height;
    context.fillStyle = project.background;
    context.fillRect(0, 0, width, height);
    if (!image) {
      const gradient = context.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.5, width * 0.72);
      gradient.addColorStop(0, "#6547ba");
      gradient.addColorStop(0.42, "#122b65");
      gradient.addColorStop(1, "#080b20");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      return;
    }
    if (project.fit === "stretch") {
      context.drawImage(image, 0, 0, width, height);
      return;
    }
    const contain = project.fit === "contain";
    const scale = contain ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) * project.focusX / 100;
    const y = (height - drawHeight) * project.focusY / 100;
    context.drawImage(image, x, y, drawWidth, drawHeight);
  }

  function drawOverlay(context, overlay, width, height, selected) {
    context.save();
    context.translate(width * overlay.x / 100, height * overlay.y / 100);
    context.rotate(overlay.rotation * Math.PI / 180);
    const fontSize = overlay.size * width / 1200;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${overlay.shape ? "900" : "400"} ${fontSize}px Arial, sans-serif`;
    context.fillStyle = overlay.color;
    context.shadowColor = overlay.color;
    context.shadowBlur = 16 * width / 1200;
    context.fillText(overlay.glyph, 0, 0);
    if (selected) {
      context.shadowBlur = 0;
      context.strokeStyle = "#65f1ff";
      context.lineWidth = Math.max(2, width / 600);
      context.setLineDash([10, 7]);
      const side = fontSize * 1.3;
      context.strokeRect(-side / 2, -side / 2, side, side);
    }
    context.restore();
  }

  function creditLine(source) {
    if (!source) return "";
    if (source.local) return "Ảnh do người dùng cung cấp và xác nhận quyền sử dụng";
    return `${source.title} · ${source.author} · ${source.license} · Wikimedia Commons`;
  }

  function drawProject(targetRuntime = runtime) {
    if (!targetRuntime?.context || !targetRuntime?.canvas) return;
    const { project } = targetRuntime;
    const { canvas, context } = targetRuntime;
    if (canvas.width !== project.width) canvas.width = project.width;
    if (canvas.height !== project.height) canvas.height = project.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawSource(context, targetRuntime.image, project);
    project.overlays.forEach((overlay) => drawOverlay(context, overlay, canvas.width, canvas.height, targetRuntime.selectedOverlayId === overlay.id));
    drawCaption(context, project.captions.top, canvas.width, canvas.height);
    drawCaption(context, project.captions.bottom, canvas.width, canvas.height);
    drawCaption(context, project.captions.free, canvas.width, canvas.height);
    const shouldCredit = project.source && (project.includeCredit || project.source.attributionRequired);
    if (shouldCredit) {
      const text = creditLine(project.source);
      const fontSize = Math.max(12, canvas.width / 78);
      context.save();
      context.font = `600 ${fontSize}px Arial, sans-serif`;
      context.textAlign = "left";
      context.textBaseline = "bottom";
      const barHeight = fontSize * 2.25;
      context.fillStyle = "rgba(3,6,20,.76)";
      context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
      context.fillStyle = "rgba(255,255,255,.9)";
      context.fillText(text.slice(0, 150), fontSize, canvas.height - fontSize * .55, canvas.width - fontSize * 2);
      context.restore();
    }
    updateCanvasMeta(targetRuntime);
  }

  function updateCanvasMeta(targetRuntime) {
    const source = targetRuntime.project.source;
    const node = targetRuntime.root.querySelector("[data-meme-canvas-meta]");
    if (node) node.textContent = source ? `${targetRuntime.project.width} × ${targetRuntime.project.height} · ${source.animated ? "GIF · xuất khung tĩnh" : source.mime.replace("image/", "").toUpperCase()}` : `${targetRuntime.project.width} × ${targetRuntime.project.height} · Chọn ảnh để bắt đầu`;
    targetRuntime.root.querySelector("[data-meme-gif-note]")?.toggleAttribute("hidden", !source?.animated);
    const empty = targetRuntime.root.querySelector("[data-meme-empty]");
    if (empty) empty.hidden = Boolean(source);
  }

  function toast(message, tone = "info") {
    if (!runtime) return;
    const node = runtime.root.querySelector("[data-meme-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    clearTimeout(runtime.toastTimer);
    runtime.toastTimer = setTimeout(() => { if (node) node.hidden = true; }, 3600);
  }

  function setStatus(message, tone = "ready") {
    if (!runtime) return;
    const node = runtime.root.querySelector("[data-meme-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function commitHistory() {
    if (!runtime || runtime.applyingHistory) return;
    runtime.history = runtime.history.slice(0, runtime.historyIndex + 1);
    runtime.history.push(cloneProject(runtime.project));
    if (runtime.history.length > 40) runtime.history.shift();
    runtime.historyIndex = runtime.history.length - 1;
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (!runtime) return;
    runtime.root.querySelectorAll("[data-meme-undo]").forEach((button) => { button.disabled = runtime.historyIndex <= 0; });
    runtime.root.querySelectorAll("[data-meme-redo]").forEach((button) => { button.disabled = runtime.historyIndex >= runtime.history.length - 1; });
  }

  async function applyHistory(index) {
    if (!runtime || index < 0 || index >= runtime.history.length) return;
    runtime.applyingHistory = true;
    runtime.historyIndex = index;
    runtime.project = cloneProject(runtime.history[index]);
    runtime.selectedOverlayId = "";
    await loadProjectImage(false);
    syncControls();
    drawProject();
    runtime.applyingHistory = false;
    updateHistoryButtons();
  }

  function sourceRightsHtml(source) {
    if (!source) return `<div class="meme-source-card is-empty"><span>◌</span><div><strong>Chưa chọn ảnh</strong><small>Tìm trên Commons hoặc tải ảnh bạn có quyền sử dụng.</small></div></div>`;
    const licenseTone = source.local ? "user" : source.licenseFamily;
    const detail = source.local ? "Bạn đã xác nhận có quyền sử dụng tệp này." : `${source.author} · ${source.license}`;
    return `<div class="meme-source-card" data-license="${escapeHtml(licenseTone)}"><span>${source.animated ? "GIF" : "©"}</span><div><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(detail)}</small></div>${source.sourceUrl ? `<a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">Nguồn ↗</a>` : ""}</div>`;
  }

  function syncSourceCard() {
    if (!runtime) return;
    const host = runtime.root.querySelector("[data-meme-source-card]");
    if (host) host.innerHTML = sourceRightsHtml(runtime.project.source);
    const credit = runtime.root.querySelector("[data-meme-credit]");
    if (credit) {
      credit.checked = runtime.project.source?.attributionRequired ? true : runtime.project.includeCredit;
      credit.disabled = Boolean(runtime.project.source?.attributionRequired);
    }
    const creditHelp = runtime.root.querySelector("[data-meme-credit-help]");
    if (creditHelp) creditHelp.textContent = runtime.project.source?.attributionRequired ? "Bắt buộc cho giấy phép này và được khóa khi xuất." : "Có thể bật để lưu dấu nguồn ngay trên ảnh.";
  }

  function syncControls() {
    if (!runtime) return;
    const { root, project } = runtime;
    const active = project.captions[runtime.activeCaption] || project.captions.top;
    const setValue = (selector, value) => { const node = root.querySelector(selector); if (node && document.activeElement !== node) node.value = value; };
    setValue("[data-meme-project-name]", project.name);
    setValue("[data-meme-fit]", project.fit);
    setValue("[data-meme-focus-x]", project.focusX);
    setValue("[data-meme-focus-y]", project.focusY);
    setValue("[data-meme-caption-text]", active.text);
    setValue("[data-meme-font]", active.font);
    setValue("[data-meme-font-size]", active.size);
    setValue("[data-meme-text-x]", active.x);
    setValue("[data-meme-text-y]", active.y);
    setValue("[data-meme-text-color]", active.color);
    setValue("[data-meme-stroke-color]", active.stroke);
    setValue("[data-meme-stroke-width]", active.strokeWidth);
    root.querySelectorAll("[data-meme-caption]").forEach((button) => button.classList.toggle("is-active", button.dataset.memeCaption === runtime.activeCaption));
    root.querySelectorAll("[data-meme-align]").forEach((button) => button.classList.toggle("is-active", button.dataset.memeAlign === active.align));
    const uppercase = root.querySelector("[data-meme-uppercase]"); if (uppercase) uppercase.checked = active.uppercase;
    const shadow = root.querySelector("[data-meme-shadow]"); if (shadow) shadow.checked = active.shadow;
    renderOverlayControls();
    syncSourceCard();
  }

  function renderOverlayControls() {
    if (!runtime) return;
    const list = runtime.root.querySelector("[data-meme-overlay-list]");
    const panel = runtime.root.querySelector("[data-meme-overlay-controls]");
    const selected = runtime.project.overlays.find((item) => item.id === runtime.selectedOverlayId);
    if (list) {
      list.innerHTML = runtime.project.overlays.length
        ? runtime.project.overlays.map((item) => `<button type="button" class="${item.id === runtime.selectedOverlayId ? "is-active" : ""}" data-meme-select-overlay="${escapeHtml(item.id)}"><span>${escapeHtml(item.glyph)}</span>${escapeHtml(item.label)}</button>`).join("")
        : `<small>Chưa có sticker hoặc hình.</small>`;
    }
    if (panel) panel.hidden = !selected;
    if (!selected) return;
    const set = (selector, value) => { const node = runtime.root.querySelector(selector); if (node) node.value = value; };
    set("[data-meme-overlay-x]", selected.x);
    set("[data-meme-overlay-y]", selected.y);
    set("[data-meme-overlay-size]", selected.size);
    set("[data-meme-overlay-rotation]", selected.rotation);
    set("[data-meme-overlay-color]", selected.color);
  }

  function setTab(tab) {
    if (!runtime) return;
    const next = TABS.has(tab) ? tab : "images";
    runtime.tab = next;
    runtime.root.querySelectorAll("[data-meme-tab]").forEach((button) => {
      const active = button.dataset.memeTab === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    runtime.root.querySelectorAll("[data-meme-panel]").forEach((panel) => { panel.hidden = panel.dataset.memePanel !== next; });
    const searching = next === "images" || next === "gif";
    runtime.root.querySelector("[data-meme-search-shell]")?.toggleAttribute("hidden", !searching);
    const searchInput = runtime.root.querySelector("[data-meme-search]");
    if (next === "gif" && /internet meme template/i.test(searchInput?.value || "")) searchInput.value = "funny";
    if (next === "projects") renderProjects();
    if (searching && !runtime.resultsByTab[next]?.length) runSearch();
  }

  function renderResults(items, tab = runtime?.tab) {
    if (!runtime) return;
    runtime.resultsByTab[tab] = items;
    runtime.resultMap = new Map([...runtime.resultsByTab.images, ...runtime.resultsByTab.gif].map((item) => [item.id, item]));
    const grid = runtime.root.querySelector(`[data-meme-results="${tab}"]`);
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div class="meme-zero"><span>✦</span><strong>Chưa tìm thấy tài nguyên phù hợp</strong><p>Thử từ khóa rộng hơn. Kết quả không có giấy phép rõ ràng đã được tự động loại bỏ.</p></div>`;
      return;
    }
    grid.innerHTML = items.map((item) => `<article class="meme-result-card ${runtime.project.source?.id === item.id ? "is-selected" : ""}" data-meme-result-card="${escapeHtml(item.id)}">
      <button type="button" data-meme-use-result="${escapeHtml(item.id)}" aria-label="Dùng ${escapeHtml(item.title)}">
        <img src="${escapeHtml(item.thumbUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
        ${item.animated ? `<b>GIF</b>` : ""}
      </button>
      <div><strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><span data-license="${escapeHtml(item.licenseFamily)}">${escapeHtml(item.license)}</span><small>${escapeHtml(item.author)}</small></div>
      <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Mở trang nguồn">↗</a>
    </article>`).join("");
  }

  async function runSearch() {
    if (!runtime || !["images", "gif"].includes(runtime.tab)) return;
    const query = cleanText(runtime.root.querySelector("[data-meme-search]")?.value || "");
    const license = runtime.root.querySelector("[data-meme-license]")?.value || "all";
    if (query.length < 2) { toast("Hãy nhập ít nhất 2 ký tự.", "warn"); return; }
    runtime.searchController?.abort();
    const controller = new AbortController();
    runtime.searchController = controller;
    const tab = runtime.tab;
    const grid = runtime.root.querySelector(`[data-meme-results="${tab}"]`);
    if (grid) grid.innerHTML = `<div class="meme-searching"><i></i><strong>Đang tìm tài nguyên có giấy phép rõ ràng…</strong><small>HH đang kiểm tra nguồn, tác giả và điều kiện sử dụng.</small></div>`;
    setStatus("Đang kết nối Wikimedia Commons…", "loading");
    try {
      const items = await searchCommons(query, { kind: tab, license, limit: 24, signal: controller.signal });
      if (controller.signal.aborted || runtime.tab !== tab) return;
      renderResults(items, tab);
      setStatus(`${items.length} tài nguyên đã xác minh giấy phép`, "ready");
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (grid) grid.innerHTML = `<div class="meme-zero is-error"><span>!</span><strong>Chưa thể tải thư viện</strong><p>${escapeHtml(error?.message || "Lỗi kết nối")}</p><button type="button" data-meme-retry>Tải lại</button></div>`;
      setStatus("Commons tạm thời không khả dụng", "error");
    }
  }

  async function setSource(source, { addHistory = true, fit = true } = {}) {
    if (!runtime) return;
    setStatus("Đang tải ảnh vào studio…", "loading");
    try {
      const normalized = normalizeSource(source);
      if (!normalized) throw new Error("Nguồn ảnh không hợp lệ hoặc không có giấy phép được chấp nhận.");
      const image = await loadImage(normalized.thumbUrl || normalized.url);
      runtime.project.source = normalized;
      runtime.image = image;
      if (fit) fitCanvasToImage(runtime.project, image);
      if (normalized.attributionRequired) runtime.project.includeCredit = true;
      if (addHistory) commitHistory();
      syncControls();
      drawProject();
      renderResults(runtime.resultsByTab.images, "images");
      renderResults(runtime.resultsByTab.gif, "gif");
      setStatus(normalized.animated ? "GIF đã mở · xuất khung tĩnh" : "Ảnh đã sẵn sàng để chỉnh sửa", "ready");
      toast(normalized.animated ? "GIF đang hiển thị; bản xuất hiện tại là một khung ảnh tĩnh." : "Đã đưa ảnh vào Meme Studio.", normalized.animated ? "warn" : "success");
    } catch (error) {
      setStatus("Không thể mở ảnh", "error");
      toast(error?.message || "Không thể mở ảnh.", "error");
    }
  }

  async function loadProjectImage(showError = true) {
    if (!runtime) return;
    runtime.image = null;
    if (!runtime.project.source) return;
    try {
      runtime.image = await loadImage(runtime.project.source.thumbUrl || runtime.project.source.url);
    } catch (error) {
      runtime.project.source = null;
      if (showError) toast(error?.message || "Ảnh nền của dự án không còn khả dụng.", "error");
    }
  }

  async function handleUpload(file) {
    if (!runtime || !file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast("Chỉ hỗ trợ PNG, JPEG, WebP hoặc GIF.", "error"); return; }
    if (file.size > 15 * 1024 * 1024) { toast("Tệp vượt quá giới hạn 15 MB.", "error"); return; }
    const confirmed = runtime.root.querySelector("[data-meme-rights-confirm]")?.checked;
    if (!confirmed) { toast("Bạn cần xác nhận có quyền sử dụng tệp trước khi mở.", "warn"); return; }
    const reader = new FileReader();
    reader.onerror = () => toast("Không thể đọc tệp.", "error");
    reader.onload = () => setSource({
      id: `local-${Date.now().toString(36)}`,
      provider: "Tệp của bạn",
      title: file.name,
      author: "Bạn",
      license: "Quyền do người dùng xác nhận",
      licenseFamily: "user-owned",
      url: reader.result,
      thumbUrl: reader.result,
      mime: file.type,
      animated: file.type === "image/gif",
      attributionRequired: false,
      attribution: `Tệp ${file.name} do người dùng cung cấp`,
      local: true,
      rightsConfirmed: true
    });
    reader.readAsDataURL(file);
  }

  function addSticker(stickerId) {
    if (!runtime) return;
    const sticker = STICKERS.find((item) => item.id === stickerId);
    if (!sticker) return;
    const overlay = { ...sticker, id: `${sticker.id}-${Date.now().toString(36)}`, x: 50, y: 50, size: sticker.shape ? 100 : 92, rotation: 0, color: sticker.shape ? "#ffe96b" : "#ffffff" };
    runtime.project.overlays.push(overlay);
    runtime.selectedOverlayId = overlay.id;
    commitHistory();
    renderOverlayControls();
    drawProject();
  }

  function deleteOverlay() {
    if (!runtime?.selectedOverlayId) return;
    runtime.project.overlays = runtime.project.overlays.filter((item) => item.id !== runtime.selectedOverlayId);
    runtime.selectedOverlayId = "";
    commitHistory();
    renderOverlayControls();
    drawProject();
  }

  function renderProjects() {
    if (!runtime) return;
    const projects = readProjects();
    const host = runtime.root.querySelector("[data-meme-projects]");
    if (!host) return;
    if (!projects.length) {
      host.innerHTML = `<div class="meme-zero"><span>▣</span><strong>Chưa có dự án đã lưu</strong><p>Dự án được lưu cục bộ trên thiết bị này. Bạn cũng có thể xuất JSON để sao lưu.</p></div>`;
      return;
    }
    host.innerHTML = projects.map((project) => `<article class="meme-project-card">
      <div><span>${project.source?.animated ? "GIF" : "ME"}</span><strong>${escapeHtml(project.name)}</strong><small>${new Date(project.updatedAt).toLocaleString("vi-VN")}</small></div>
      <nav><button type="button" data-meme-open-project="${escapeHtml(project.id)}">Mở</button><button type="button" data-meme-export-project="${escapeHtml(project.id)}">JSON</button><button type="button" data-meme-delete-project="${escapeHtml(project.id)}" aria-label="Xóa dự án">×</button></nav>
    </article>`).join("");
  }

  function saveProject() {
    if (!runtime) return;
    runtime.project.name = cleanText(runtime.root.querySelector("[data-meme-project-name]")?.value || runtime.project.name).slice(0, 100) || "Meme chưa đặt tên";
    runtime.project.updatedAt = new Date().toISOString();
    const projects = readProjects().filter((item) => item.id !== runtime.project.id);
    projects.unshift(cloneProject(runtime.project));
    try {
      writeProjects(projects);
      renderProjects();
      toast("Đã lưu dự án trên thiết bị này.", "success");
    } catch {
      toast("Bộ nhớ trình duyệt không đủ. Hãy xuất JSON để lưu dự án.", "error");
    }
  }

  function exportProject(project = runtime?.project) {
    if (!project) return;
    const blob = new Blob([JSON.stringify({ schema: STORAGE_KEY, version: VERSION, project: cloneProject(project) }, null, 2)], { type: "application/json" });
    downloadBlob(blob, fileName(project.name, "json"));
  }

  async function importProject(file) {
    if (!runtime || !file) return;
    if (file.size > 8 * 1024 * 1024) { toast("Tệp dự án vượt quá 8 MB.", "error"); return; }
    try {
      const parsed = JSON.parse(await file.text());
      runtime.project = normalizeProject(parsed?.project || parsed);
      runtime.activeCaption = "top";
      runtime.selectedOverlayId = "";
      await loadProjectImage();
      runtime.history = [cloneProject(runtime.project)];
      runtime.historyIndex = 0;
      syncControls();
      drawProject();
      updateHistoryButtons();
      toast("Đã nhập dự án Meme.", "success");
    } catch {
      toast("Tệp JSON không đúng định dạng dự án HH Meme.", "error");
    }
  }

  async function exportImage(format = "png") {
    if (!runtime?.project.source) { toast("Hãy chọn ảnh trước khi xuất.", "warn"); return; }
    drawProject();
    const mime = format === "webp" ? "image/webp" : "image/png";
    try {
      const blob = await new Promise((resolve, reject) => runtime.canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Không thể mã hóa ảnh.")), mime, .94));
      downloadBlob(blob, fileName(runtime.project.name, format === "webp" ? "webp" : "png"));
      toast(runtime.project.source.animated ? "Đã xuất một khung tĩnh từ GIF." : "Đã xuất ảnh chất lượng cao.", "success");
    } catch {
      toast("Không thể xuất vì nguồn ảnh chặn Canvas. Hãy tải ảnh về rồi dùng tab Tải ảnh.", "error");
    }
  }

  async function copyAttribution() {
    const source = runtime?.project.source;
    if (!source) { toast("Chưa có nguồn để sao chép ghi công.", "warn"); return; }
    const text = source.attribution || creditLine(source);
    try {
      await navigator.clipboard.writeText(text);
      toast("Đã sao chép dòng ghi công.", "success");
    } catch {
      toast("Trình duyệt chưa cho phép sao chép tự động.", "warn");
    }
  }

  function updateCaptionFromControls(commit = false) {
    if (!runtime) return;
    const caption = runtime.project.captions[runtime.activeCaption];
    const root = runtime.root;
    caption.text = String(root.querySelector("[data-meme-caption-text]")?.value || "").slice(0, 280);
    caption.font = root.querySelector("[data-meme-font]")?.value || caption.font;
    caption.size = clamp(root.querySelector("[data-meme-font-size]")?.value, 16, 160, caption.size);
    caption.x = clamp(root.querySelector("[data-meme-text-x]")?.value, 0, 100, caption.x);
    caption.y = clamp(root.querySelector("[data-meme-text-y]")?.value, 0, 100, caption.y);
    caption.color = root.querySelector("[data-meme-text-color]")?.value || caption.color;
    caption.stroke = root.querySelector("[data-meme-stroke-color]")?.value || caption.stroke;
    caption.strokeWidth = clamp(root.querySelector("[data-meme-stroke-width]")?.value, 0, 18, caption.strokeWidth);
    caption.uppercase = Boolean(root.querySelector("[data-meme-uppercase]")?.checked);
    caption.shadow = Boolean(root.querySelector("[data-meme-shadow]")?.checked);
    drawProject();
    if (commit) commitHistory();
  }

  function updateOverlayFromControls(commit = false) {
    if (!runtime) return;
    const overlay = runtime.project.overlays.find((item) => item.id === runtime.selectedOverlayId);
    if (!overlay) return;
    const root = runtime.root;
    overlay.x = clamp(root.querySelector("[data-meme-overlay-x]")?.value, 0, 100, overlay.x);
    overlay.y = clamp(root.querySelector("[data-meme-overlay-y]")?.value, 0, 100, overlay.y);
    overlay.size = clamp(root.querySelector("[data-meme-overlay-size]")?.value, 18, 240, overlay.size);
    overlay.rotation = clamp(root.querySelector("[data-meme-overlay-rotation]")?.value, -180, 180, overlay.rotation);
    overlay.color = root.querySelector("[data-meme-overlay-color]")?.value || overlay.color;
    drawProject();
    if (commit) commitHistory();
  }

  function bindCanvasDrag() {
    if (!runtime) return;
    const { canvas } = runtime;
    const start = (event) => {
      if (!runtime.selectedOverlayId && runtime.activeCaption !== "free") return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      runtime.dragging = true;
      move(event);
    };
    const move = (event) => {
      if (!runtime.dragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100, 50);
      const y = clamp((event.clientY - rect.top) / rect.height * 100, 0, 100, 50);
      const overlay = runtime.project.overlays.find((item) => item.id === runtime.selectedOverlayId);
      if (overlay) { overlay.x = x; overlay.y = y; }
      else { runtime.project.captions.free.x = x; runtime.project.captions.free.y = y; }
      syncControls();
      drawProject();
    };
    const end = () => { if (!runtime.dragging) return; runtime.dragging = false; commitHistory(); };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  function bindEvents() {
    if (!runtime) return;
    const { root } = runtime;
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button, a");
      if (!button || !root.contains(button)) return;
      if (button.dataset.memeTab) { setTab(button.dataset.memeTab); return; }
      if (button.matches("[data-meme-search-button], [data-meme-retry]")) { runSearch(); return; }
      if (button.dataset.memePreset) {
        root.querySelector("[data-meme-search]").value = button.dataset.memePreset;
        if (button.dataset.memeKind) setTab(button.dataset.memeKind);
        runSearch(); return;
      }
      if (button.dataset.memeUseResult) { const item = runtime.resultMap.get(button.dataset.memeUseResult); if (item) setSource(item); return; }
      if (button.dataset.memeCaption) { runtime.activeCaption = button.dataset.memeCaption; runtime.selectedOverlayId = ""; syncControls(); drawProject(); return; }
      if (button.dataset.memeAlign) { runtime.project.captions[runtime.activeCaption].align = button.dataset.memeAlign; syncControls(); drawProject(); commitHistory(); return; }
      if (button.dataset.memeSticker) { addSticker(button.dataset.memeSticker); return; }
      if (button.dataset.memeSelectOverlay) { runtime.selectedOverlayId = button.dataset.memeSelectOverlay; renderOverlayControls(); drawProject(); return; }
      if (button.hasAttribute("data-meme-delete-overlay")) { deleteOverlay(); return; }
      if (button.hasAttribute("data-meme-undo")) { applyHistory(runtime.historyIndex - 1); return; }
      if (button.hasAttribute("data-meme-redo")) { applyHistory(runtime.historyIndex + 1); return; }
      if (button.hasAttribute("data-meme-save")) { saveProject(); return; }
      if (button.dataset.memeExportImage) { exportImage(button.dataset.memeExportImage); return; }
      if (button.hasAttribute("data-meme-export-current")) { exportProject(); return; }
      if (button.hasAttribute("data-meme-copy-attribution")) { copyAttribution(); return; }
      if (button.hasAttribute("data-meme-upload-trigger")) { root.querySelector("[data-meme-upload-input]")?.click(); return; }
      if (button.hasAttribute("data-meme-import-trigger")) { root.querySelector("[data-meme-import-input]")?.click(); return; }
      if (button.dataset.memeOpenProject) {
        const project = readProjects().find((item) => item.id === button.dataset.memeOpenProject);
        if (project) {
          runtime.project = cloneProject(project); runtime.history = [cloneProject(project)]; runtime.historyIndex = 0; runtime.activeCaption = "top"; runtime.selectedOverlayId = "";
          await loadProjectImage(); syncControls(); drawProject(); updateHistoryButtons(); toast("Đã mở dự án.", "success");
        }
        return;
      }
      if (button.dataset.memeExportProject) { const project = readProjects().find((item) => item.id === button.dataset.memeExportProject); if (project) exportProject(project); return; }
      if (button.dataset.memeDeleteProject) {
        const projects = readProjects().filter((item) => item.id !== button.dataset.memeDeleteProject);
        writeProjects(projects); renderProjects(); toast("Đã xóa dự án khỏi thiết bị.", "success"); return;
      }
      if (button.hasAttribute("data-meme-new")) {
        runtime.project = defaultProject(); runtime.image = null; runtime.history = [cloneProject(runtime.project)]; runtime.historyIndex = 0; runtime.activeCaption = "top"; runtime.selectedOverlayId = ""; syncControls(); drawProject(); updateHistoryButtons(); return;
      }
    });

    root.querySelector("[data-meme-search]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } });
    root.querySelector("[data-meme-license]")?.addEventListener("change", runSearch);
    root.querySelector("[data-meme-upload-input]")?.addEventListener("change", (event) => { const file = event.target.files?.[0]; if (file) handleUpload(file); event.target.value = ""; });
    root.querySelector("[data-meme-import-input]")?.addEventListener("change", (event) => { const file = event.target.files?.[0]; if (file) importProject(file); event.target.value = ""; });
    root.querySelector("[data-meme-project-name]")?.addEventListener("change", (event) => { runtime.project.name = cleanText(event.target.value).slice(0, 100) || "Meme chưa đặt tên"; commitHistory(); });
    root.querySelector("[data-meme-fit]")?.addEventListener("change", (event) => { runtime.project.fit = event.target.value; drawProject(); commitHistory(); });
    ["[data-meme-focus-x]", "[data-meme-focus-y]"].forEach((selector) => root.querySelector(selector)?.addEventListener("input", () => { runtime.project.focusX = clamp(root.querySelector("[data-meme-focus-x]").value, 0, 100, 50); runtime.project.focusY = clamp(root.querySelector("[data-meme-focus-y]").value, 0, 100, 50); drawProject(); }));
    ["[data-meme-focus-x]", "[data-meme-focus-y]"].forEach((selector) => root.querySelector(selector)?.addEventListener("change", commitHistory));
    ["[data-meme-caption-text]", "[data-meme-font]", "[data-meme-font-size]", "[data-meme-text-x]", "[data-meme-text-y]", "[data-meme-text-color]", "[data-meme-stroke-color]", "[data-meme-stroke-width]", "[data-meme-uppercase]", "[data-meme-shadow]"].forEach((selector) => {
      root.querySelector(selector)?.addEventListener("input", () => updateCaptionFromControls(false));
      root.querySelector(selector)?.addEventListener("change", () => updateCaptionFromControls(true));
    });
    ["[data-meme-overlay-x]", "[data-meme-overlay-y]", "[data-meme-overlay-size]", "[data-meme-overlay-rotation]", "[data-meme-overlay-color]"].forEach((selector) => {
      root.querySelector(selector)?.addEventListener("input", () => updateOverlayFromControls(false));
      root.querySelector(selector)?.addEventListener("change", () => updateOverlayFromControls(true));
    });
    root.querySelector("[data-meme-credit]")?.addEventListener("change", (event) => { runtime.project.includeCredit = Boolean(event.target.checked); drawProject(); commitHistory(); });
    bindCanvasDrag();
  }

  function renderShell(root) {
    root.innerHTML = `<section class="meme-hub" aria-label="HH Meme Studio">
      <div class="meme-cosmos" aria-hidden="true"><i></i><i></i><i></i><span></span><span></span></div>
      <header class="meme-topbar">
        <div class="meme-brand"><span><b>ME</b><i></i></span><div><small>HH CREATIVE GALAXY</small><h2>Meme Studio</h2><p>Tìm tài nguyên có giấy phép rõ ràng · sáng tạo cục bộ · xuất ảnh thật</p></div></div>
        <div class="meme-status"><i></i><span data-meme-status>Wikimedia Commons sẵn sàng</span></div>
        <nav class="meme-top-actions"><button type="button" data-meme-new>＋ Mới</button><button type="button" data-meme-undo aria-label="Hoàn tác">↶</button><button type="button" data-meme-redo aria-label="Làm lại">↷</button></nav>
      </header>
      <nav class="meme-tabs" role="tablist" aria-label="Chức năng Meme">
        <button type="button" class="is-active" role="tab" aria-selected="true" data-meme-tab="images"><span>▦</span>Commons Images</button>
        <button type="button" role="tab" aria-selected="false" data-meme-tab="gif"><span>GIF</span>Commons GIF</button>
        <button type="button" role="tab" aria-selected="false" data-meme-tab="upload"><span>↑</span>Tải ảnh của bạn</button>
        <button type="button" role="tab" aria-selected="false" data-meme-tab="projects"><span>▣</span>Dự án đã lưu</button>
        <button type="button" role="tab" aria-selected="false" data-meme-tab="rights"><span>©</span>Quyền & ghi công</button>
      </nav>
      <div class="meme-workspace">
        <aside class="meme-library">
          <div class="meme-search-shell" data-meme-search-shell>
            <form onsubmit="return false"><label for="memeCommonsSearch">Tìm ảnh/GIF được phép tái sử dụng</label><div><input id="memeCommonsSearch" data-meme-search value="internet meme template" maxlength="120" autocomplete="off"><button type="button" data-meme-search-button aria-label="Tìm kiếm">⌕</button></div></form>
            <select data-meme-license aria-label="Lọc giấy phép"><option value="all">Mọi giấy phép được hỗ trợ</option><option value="public-domain">Public Domain</option><option value="cc0">CC0</option><option value="cc-by">CC BY</option><option value="cc-by-sa">CC BY-SA</option></select>
            <div class="meme-preset-row"><button type="button" data-meme-preset="funny cat">Mèo</button><button type="button" data-meme-preset="funny dog">Chó</button><button type="button" data-meme-preset="reaction face">Reaction</button><button type="button" data-meme-preset="computer programming humor">Công nghệ</button><button type="button" data-meme-preset="funny" data-meme-kind="gif">GIF</button></div>
          </div>
          <section data-meme-panel="images"><header><div><strong>Ảnh trên Commons</strong><small>Chỉ hiện Public Domain, CC0, CC BY và CC BY-SA</small></div><a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Commons ↗</a></header><div class="meme-results" data-meme-results="images"></div></section>
          <section data-meme-panel="gif" hidden><header><div><strong>GIF trên Commons</strong><small>Xem GIF động; editor hiện xuất khung tĩnh có ghi nhãn rõ</small></div><a href="https://commons.wikimedia.org/wiki/Category:Animated_GIF_files" target="_blank" rel="noopener noreferrer">Kho GIF ↗</a></header><div class="meme-results" data-meme-results="gif"></div></section>
          <section class="meme-upload-panel" data-meme-panel="upload" hidden>
            <div class="meme-dropzone"><span>↑</span><h3>Tải ảnh của bạn</h3><p>PNG, JPEG, WebP hoặc GIF · tối đa 15 MB · ảnh chỉ được xử lý trên thiết bị.</p><label><input type="checkbox" data-meme-rights-confirm><span>Tôi xác nhận mình sở hữu hoặc có quyền sử dụng và chỉnh sửa tệp này.</span></label><button type="button" data-meme-upload-trigger>Chọn tệp ảnh</button><input type="file" hidden data-meme-upload-input accept="image/png,image/jpeg,image/webp,image/gif"></div>
            <article><strong>Riêng tư local-first</strong><p>Tệp không được tự động tải lên máy chủ. Nếu ảnh lớn làm đầy localStorage, hãy xuất dự án JSON thay vì chỉ bấm lưu.</p></article>
          </section>
          <section class="meme-projects-panel" data-meme-panel="projects" hidden><header><div><strong>Dự án trên thiết bị</strong><small>Tối đa ${MAX_PROJECTS} dự án · có thể xuất/nhập JSON</small></div><button type="button" data-meme-import-trigger>Nhập JSON</button><input type="file" hidden data-meme-import-input accept="application/json,.json"></header><div data-meme-projects></div></section>
          <section class="meme-rights-panel" data-meme-panel="rights" hidden>
            <div class="meme-rights-hero"><span>©</span><div><small>RIGHTS-FIRST MEME LAB</small><h3>Miễn phí không có nghĩa là vô chủ</h3><p>HH kiểm tra metadata giấy phép trước khi đưa ảnh vào thư viện. Bạn vẫn nên mở trang nguồn nếu dùng cho mục đích thương mại.</p></div></div>
            <article><b>01</b><div><strong>Tìm trên Google đúng cách</strong><p>Dùng bộ lọc Creative Commons rồi mở “Chi tiết giấy phép” tại trang gốc. Google là công cụ tìm kiếm, không phải bên cấp quyền.</p><a href="https://support.google.com/websearch/answer/29508" target="_blank" rel="noopener noreferrer">Hướng dẫn chính thức của Google ↗</a></div></article>
            <article><b>02</b><div><strong>Wikimedia Commons API</strong><p>HH đọc tác giả, URL nguồn, tên giấy phép và yêu cầu ghi công bằng metadata máy đọc được.</p><a href="https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia" target="_blank" rel="noopener noreferrer">Hướng dẫn tái sử dụng Commons ↗</a></div></article>
            <article><b>03</b><div><strong>Engine mã nguồn mở trên GitHub</strong><p>Giấy phép của phần mềm không tự động cấp quyền cho mọi ảnh template đi kèm. Chỉ dùng engine và nội dung có quyền riêng đã xác minh.</p><nav><a href="https://github.com/jacebrowning/memegen" target="_blank" rel="noopener noreferrer">memegen · MIT ↗</a><a href="https://github.com/gsantner/memetastic" target="_blank" rel="noopener noreferrer">MemeTastic · GPL-3.0 ↗</a></nav></div></article>
            <div class="meme-license-legend"><span data-license="public-domain">Public Domain</span><span data-license="cc0">CC0</span><span data-license="cc-by">CC BY · ghi công</span><span data-license="cc-by-sa">CC BY-SA · ghi công + chia sẻ tương tự</span></div>
          </section>
        </aside>
        <main class="meme-editor">
          <header><input data-meme-project-name value="Meme chưa đặt tên" maxlength="100" aria-label="Tên dự án"><div><span data-meme-canvas-meta>1200 × 1200 · Chọn ảnh để bắt đầu</span><button type="button" data-meme-undo>↶</button><button type="button" data-meme-redo>↷</button></div></header>
          <div class="meme-stage"><div class="meme-stage-glow"></div><canvas data-meme-canvas width="1200" height="1200" aria-label="Khung chỉnh sửa meme"></canvas><div class="meme-empty" data-meme-empty><span>ME</span><strong>Chọn một ảnh để bắt đầu</strong><p>Thư viện bên trái chỉ hiển thị nguồn có giấy phép rõ ràng.</p></div><div class="meme-gif-note" data-meme-gif-note hidden><b>GIF</b><span>Đang xem ảnh động · xuất hiện tại là khung tĩnh</span></div></div>
          <div class="meme-source-host" data-meme-source-card>${sourceRightsHtml(null)}</div>
        </main>
        <aside class="meme-inspector">
          <section><header><strong>Bố cục ảnh</strong><span>CANVAS</span></header><label>Chế độ khung<select data-meme-fit><option value="contain">Vừa khung</option><option value="cover">Lấp đầy</option><option value="stretch">Kéo giãn</option></select></label><div class="meme-dual-range"><label>Tâm ngang<input type="range" min="0" max="100" value="50" data-meme-focus-x></label><label>Tâm dọc<input type="range" min="0" max="100" value="50" data-meme-focus-y></label></div></section>
          <section><header><strong>Chữ Meme</strong><span>TEXT</span></header><div class="meme-segmented"><button type="button" class="is-active" data-meme-caption="top">Trên</button><button type="button" data-meme-caption="bottom">Dưới</button><button type="button" data-meme-caption="free">Tự do</button></div><textarea data-meme-caption-text maxlength="280" rows="3" aria-label="Nội dung chữ"></textarea><div class="meme-control-grid"><label>Font<select data-meme-font><option>Impact</option><option>Arial</option><option>Be Vietnam Pro</option><option>Georgia</option><option>Courier New</option></select></label><label>Cỡ chữ<input type="range" min="16" max="160" value="68" data-meme-font-size></label><label>Vị trí X<input type="range" min="0" max="100" value="50" data-meme-text-x></label><label>Vị trí Y<input type="range" min="0" max="100" value="11" data-meme-text-y></label><label>Màu chữ<input type="color" value="#ffffff" data-meme-text-color></label><label>Màu viền<input type="color" value="#080816" data-meme-stroke-color></label><label>Độ dày viền<input type="range" min="0" max="18" value="8" data-meme-stroke-width></label></div><div class="meme-text-row"><div><button type="button" data-meme-align="left">≡←</button><button type="button" class="is-active" data-meme-align="center">≡</button><button type="button" data-meme-align="right">→≡</button></div><label><input type="checkbox" checked data-meme-uppercase> HOA</label><label><input type="checkbox" checked data-meme-shadow> Bóng</label></div></section>
          <section><header><strong>Sticker & hình</strong><span>LAYERS</span></header><div class="meme-stickers">${STICKERS.map((item) => `<button type="button" data-meme-sticker="${item.id}" title="${escapeHtml(item.label)}">${escapeHtml(item.glyph)}</button>`).join("")}</div><div class="meme-overlay-list" data-meme-overlay-list><small>Chưa có sticker hoặc hình.</small></div><div class="meme-overlay-controls" data-meme-overlay-controls hidden><label>X<input type="range" min="0" max="100" data-meme-overlay-x></label><label>Y<input type="range" min="0" max="100" data-meme-overlay-y></label><label>Cỡ<input type="range" min="18" max="240" data-meme-overlay-size></label><label>Xoay<input type="range" min="-180" max="180" data-meme-overlay-rotation></label><label>Màu<input type="color" data-meme-overlay-color></label><button type="button" data-meme-delete-overlay>Xóa lớp</button></div></section>
          <section class="meme-credit-control"><header><strong>Ghi công</strong><span>RIGHTS</span></header><label><input type="checkbox" checked data-meme-credit><span>Đặt dòng nguồn trên ảnh xuất</span></label><small data-meme-credit-help>Có thể bật để lưu dấu nguồn ngay trên ảnh.</small><button type="button" data-meme-copy-attribution>Sao chép ghi công</button></section>
        </aside>
      </div>
      <footer class="meme-actionbar"><div><button type="button" data-meme-save>▣ Lưu dự án</button><button type="button" data-meme-export-current>JSON</button></div><p><i></i><span>Mọi chỉnh sửa diễn ra trên thiết bị · nguồn và giấy phép đi cùng dự án</span></p><div><button type="button" data-meme-export-image="webp">Xuất WebP</button><button type="button" class="is-primary" data-meme-export-image="png">Xuất PNG</button></div></footer>
      <div class="meme-toast" data-meme-toast hidden role="status" aria-live="polite"></div>
    </section>`;
  }

  function mount(root, options = {}) {
    if (!root) return false;
    unmount();
    const project = defaultProject();
    renderShell(root);
    const canvas = root.querySelector("[data-meme-canvas]");
    runtime = {
      root,
      options,
      canvas,
      context: canvas.getContext("2d", { alpha: false }),
      project,
      image: null,
      tab: "images",
      activeCaption: "top",
      selectedOverlayId: "",
      resultsByTab: { images: [], gif: [] },
      resultMap: new Map(),
      history: [cloneProject(project)],
      historyIndex: 0,
      searchController: null,
      applyingHistory: false,
      dragging: false,
      toastTimer: 0
    };
    bindEvents();
    syncControls();
    drawProject();
    updateHistoryButtons();
    const viewMap = { gif: "gif", upload: "upload", projects: "projects", rights: "rights", images: "images", library: "images" };
    setTab(viewMap[options.view] || "images");
    return true;
  }

  function unmount() {
    if (!runtime) return;
    runtime.searchController?.abort();
    clearTimeout(runtime.toastTimer);
    runtime.root?.replaceChildren();
    runtime = null;
  }

  function inspect() {
    return runtime ? { version: VERSION, mounted: true, tab: runtime.tab, source: runtime.project.source?.title || "", overlays: runtime.project.overlays.length, history: runtime.history.length } : { version: VERSION, mounted: false };
  }

  return { VERSION, STORAGE_KEY, COMMONS_API, licenseFamily, licenseAllowed, parseWikimediaPage, searchCommons, normalizeProject, readProjects, writeProjects, mount, unmount, inspect };
});
