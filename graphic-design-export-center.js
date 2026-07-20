(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-export-center";
  const MANIFEST_FORMAT = "hh-graphic-export-manifest";
  const STORAGE_KEY = "hh.graphic-export-center.workspace.v1";
  const MAX_ASSET_BYTES = 20 * 1024 * 1024;
  const MAX_CANVAS_EDGE = 16384;
  const SYSTEM_FONTS = Object.freeze(["Arial", "Helvetica", "Inter", "Georgia", "Times New Roman", "Verdana", "system-ui", "sans-serif", "serif", "monospace"]);
  const instances = new WeakMap();

  const SOCIAL_PRESETS = Object.freeze({
    "instagram-post": Object.freeze({ id: "instagram-post", label: "Instagram Post", width: 1080, height: 1080 }),
    "instagram-story": Object.freeze({ id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920 }),
    "facebook-cover": Object.freeze({ id: "facebook-cover", label: "Facebook Cover", width: 1640, height: 624 }),
    "x-post": Object.freeze({ id: "x-post", label: "X Post", width: 1600, height: 900 }),
    "linkedin-post": Object.freeze({ id: "linkedin-post", label: "LinkedIn Post", width: 1200, height: 627 }),
    "youtube-thumbnail": Object.freeze({ id: "youtube-thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720 })
  });

  const FORMATS = Object.freeze({
    png: Object.freeze({ id: "png", label: "PNG", mime: "image/png", extension: "png", kind: "raster" }),
    jpeg: Object.freeze({ id: "jpeg", label: "JPEG", mime: "image/jpeg", extension: "jpg", kind: "raster" }),
    webp: Object.freeze({ id: "webp", label: "WebP", mime: "image/webp", extension: "webp", kind: "raster" }),
    avif: Object.freeze({ id: "avif", label: "AVIF", mime: "image/avif", extension: "avif", kind: "raster" }),
    svg: Object.freeze({ id: "svg", label: "SVG", mime: "image/svg+xml", extension: "svg", kind: "vector" }),
    "project-json": Object.freeze({ id: "project-json", label: "Project JSON", mime: "application/json", extension: "json", kind: "data" }),
    pdf: Object.freeze({ id: "pdf", label: "PDF", mime: "application/pdf", extension: "pdf", kind: "document" }),
    webm: Object.freeze({ id: "webm", label: "WebM", mime: "video/webm", extension: "webm", kind: "video", aggregate: true }),
    "sprite-sheet": Object.freeze({ id: "sprite-sheet", label: "Sprite sheet PNG", mime: "image/png", extension: "png", kind: "sprite", aggregate: true })
  });

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit || 2000);
  }

  function escapeHtml(value) {
    return cleanText(value, 10000)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  function safeColor(value, fallback) {
    const text = String(value || "").trim();
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
    if (/^(?:rgb|hsl)a?\([\d\s.,%+-]+\)$/i.test(text)) return text;
    if (/^(?:transparent|black|white)$/i.test(text)) return text.toLowerCase();
    return fallback || "#101722";
  }

  function safeDataImage(value) {
    const text = String(value || "");
    return /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z0-9+/=\s]+$/i.test(text) ? text : "";
  }

  function cloneSerializable(value) {
    if (value == null || typeof value !== "object") return value;
    if (typeof Blob !== "undefined" && value instanceof Blob) return value;
    if (Array.isArray(value)) return value.map(cloneSerializable);
    const output = {};
    Object.keys(value).forEach((key) => {
      if (typeof value[key] !== "function" && key !== "image" && key !== "bitmap") output[key] = cloneSerializable(value[key]);
    });
    return output;
  }

  function slug(value, fallback) {
    const text = cleanText(value, 180)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 140);
    return text || fallback || "export";
  }

  function normalizeFormat(value) {
    const aliases = { jpg: "jpeg", json: "project-json", project: "project-json", sprite: "sprite-sheet" };
    const format = aliases[value] || value;
    return FORMATS[format] ? format : "png";
  }

  function normalizeAsset(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const dataUrl = safeDataImage(source.dataUrl || source.src);
    return {
      id: slug(source.id, `asset-${index + 1}`),
      name: cleanText(source.name || `Asset ${index + 1}`, 180),
      type: cleanText(source.type || (dataUrl.match(/^data:([^;,]+)/i)?.[1] || "application/octet-stream"), 120),
      size: clamp(source.size ?? source.blob?.size, 0, Number.MAX_SAFE_INTEGER, 0),
      width: clamp(source.width ?? source.naturalWidth, 0, 100000, 0),
      height: clamp(source.height ?? source.naturalHeight, 0, 100000, 0),
      dataUrl,
      blob: typeof Blob !== "undefined" && source.blob instanceof Blob ? source.blob : null,
      loaded: source.loaded !== false,
      fontFamily: cleanText(source.fontFamily || "", 120)
    };
  }

  function normalizeElement(input, index, artboard) {
    const source = input && typeof input === "object" ? input : {};
    const type = ["rect", "text", "image", "ellipse"].includes(source.type) ? source.type : "rect";
    const base = {
      id: slug(source.id, `element-${index + 1}`),
      type,
      x: clamp(source.x, -artboard.width * 2, artboard.width * 3, 0),
      y: clamp(source.y, -artboard.height * 2, artboard.height * 3, 0),
      width: clamp(source.width, 0, artboard.width * 4, Math.min(320, artboard.width)),
      height: clamp(source.height, 0, artboard.height * 4, Math.min(120, artboard.height)),
      opacity: clamp(source.opacity, 0, 1, 1),
      rotation: clamp(source.rotation, -360, 360, 0),
      fill: safeColor(source.fill || source.color, type === "text" ? "#ffffff" : "#4c72ff")
    };
    if (type === "text") {
      return {
        ...base,
        text: cleanText(source.text, 5000),
        fontFamily: cleanText(source.fontFamily || "Inter", 120).replace(/["'<>]/g, "") || "Inter",
        fontSize: clamp(source.fontSize, 6, 800, 48),
        fontWeight: /^(?:normal|bold|[1-9]00)$/.test(String(source.fontWeight || "")) ? String(source.fontWeight) : "700",
        lineHeight: clamp(source.lineHeight, 0.8, 3, 1.15),
        maxLines: Math.round(clamp(source.maxLines, 1, 100, 3)),
        align: ["left", "center", "right"].includes(source.align) ? source.align : "left"
      };
    }
    if (type === "image") {
      return { ...base, assetId: slug(source.assetId, ""), fit: ["cover", "contain", "fill"].includes(source.fit) ? source.fit : "cover" };
    }
    return { ...base, radius: clamp(source.radius, 0, Math.min(base.width, base.height) / 2, 0) };
  }

  function normalizeArtboard(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const preset = SOCIAL_PRESETS[source.presetId] || null;
    const artboard = {
      id: slug(source.id, `artboard-${index + 1}`),
      name: cleanText(source.name || preset?.label || `Artboard ${index + 1}`, 180),
      presetId: preset?.id || cleanText(source.presetId || "custom", 80),
      width: Math.round(clamp(source.width ?? preset?.width, 16, MAX_CANVAS_EDGE, 1080)),
      height: Math.round(clamp(source.height ?? preset?.height, 16, MAX_CANVAS_EDGE, 1080)),
      background: safeColor(source.background, "#101722")
    };
    artboard.assets = (Array.isArray(source.assets) ? source.assets : []).slice(0, 500).map(normalizeAsset);
    artboard.elements = (Array.isArray(source.elements) ? source.elements : []).slice(0, 2000).map((element, elementIndex) => normalizeElement(element, elementIndex, artboard));
    return artboard;
  }

  function normalizeWatermark(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      enabled: Boolean(source.enabled),
      text: cleanText(source.text || "HH Studio", 180),
      opacity: clamp(source.opacity, 0.02, 1, 0.32),
      position: ["top-left", "top-right", "bottom-left", "bottom-right", "center"].includes(source.position) ? source.position : "bottom-right",
      fontSize: clamp(source.fontSize, 8, 240, 24),
      color: safeColor(source.color, "#ffffff")
    };
  }

  function normalizeSettings(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      format: normalizeFormat(source.format),
      scale: [1, 2, 3].includes(Number(source.scale)) ? Number(source.scale) : 1,
      quality: clamp(source.quality, 0.1, 1, 0.92),
      namingRule: cleanText(source.namingRule || "{project}-{artboard}-{scale}x", 240),
      projectName: cleanText(source.projectName || "HH Design", 180),
      presetId: SOCIAL_PRESETS[source.presetId] ? source.presetId : "instagram-post",
      watermark: normalizeWatermark(source.watermark),
      spriteColumns: Math.round(clamp(source.spriteColumns, 1, 24, 3)),
      spritePadding: Math.round(clamp(source.spritePadding, 0, 256, 16)),
      frameDuration: clamp(source.frameDuration, 0.1, 10, 1)
    };
  }

  function createSocialArtboard(presetId, options) {
    const preset = SOCIAL_PRESETS[presetId] || SOCIAL_PRESETS["instagram-post"];
    const input = options && typeof options === "object" ? options : {};
    const compact = Math.min(preset.width, preset.height);
    return normalizeArtboard({
      id: input.id || preset.id,
      name: input.name || preset.label,
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      background: input.background || "#0c1320",
      assets: input.assets || [],
      elements: input.elements || [
        { id: "accent", type: "rect", x: preset.width * 0.07, y: preset.height * 0.08, width: compact * 0.11, height: compact * 0.11, fill: "#62d7e7", radius: compact * 0.018 },
        { id: "eyebrow", type: "text", text: "HH CREATIVE", x: preset.width * 0.07, y: preset.height * 0.27, width: preset.width * 0.82, height: compact * 0.09, fontFamily: "Inter", fontSize: compact * 0.036, fontWeight: "700", fill: "#b8ef72", maxLines: 1 },
        { id: "title", type: "text", text: "Export once. Publish everywhere.", x: preset.width * 0.07, y: preset.height * 0.35, width: preset.width * 0.82, height: compact * 0.32, fontFamily: "Inter", fontSize: compact * 0.085, fontWeight: "700", fill: "#ffffff", lineHeight: 1.02, maxLines: 3 },
        { id: "footer", type: "text", text: `${preset.width} x ${preset.height}`, x: preset.width * 0.07, y: preset.height * 0.86, width: preset.width * 0.82, height: compact * 0.07, fontFamily: "Inter", fontSize: compact * 0.028, fontWeight: "400", fill: "#9daec0", maxLines: 1 }
      ]
    }, 0);
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      name: "Social launch",
      artboards: ["instagram-post", "instagram-story", "youtube-thumbnail"].map((id) => createSocialArtboard(id)),
      settings: normalizeSettings({ projectName: "Social launch" })
    };
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const artboards = (Array.isArray(source.artboards) ? source.artboards : []).slice(0, 100).map(normalizeArtboard);
    return {
      format: FORMAT,
      version: VERSION,
      name: cleanText(source.name || source.settings?.projectName || "HH Design", 180),
      artboards: artboards.length ? artboards : createDefaultProject().artboards,
      settings: normalizeSettings({ ...source.settings, projectName: source.name || source.settings?.projectName })
    };
  }

  function createCapability(supported, reason) {
    return Object.freeze({ supported: Boolean(supported), state: supported ? "supported" : "unsupported", reason: supported ? "" : reason });
  }

  function canEncodeMime(canvas, mime, strict) {
    if (!canvas || typeof canvas.getContext !== "function" || typeof canvas.toBlob !== "function") return false;
    if (!strict || typeof canvas.toDataURL !== "function") return !strict;
    try { return String(canvas.toDataURL(mime)).startsWith(`data:${mime}`); } catch (_) { return false; }
  }

  function detectCapabilities(runtime, canvasOverride) {
    const scope = runtime || globalScope || {};
    let canvas = canvasOverride || null;
    try { if (!canvas) canvas = scope.document?.createElement?.("canvas") || null; } catch (_) { canvas = null; }
    const canvas2d = Boolean(canvas?.getContext?.("2d"));
    const rasterReason = "Trình duyệt không có Canvas 2D và canvas.toBlob.";
    const png = canvas2d && canEncodeMime(canvas, "image/png", false);
    const jpeg = canvas2d && canEncodeMime(canvas, "image/jpeg", false);
    const webp = canvas2d && canEncodeMime(canvas, "image/webp", false);
    const avif = canvas2d && canEncodeMime(canvas, "image/avif", true);
    const BlobCtor = scope.Blob || (typeof Blob !== "undefined" ? Blob : null);
    const Recorder = scope.MediaRecorder;
    const prototype = scope.HTMLCanvasElement?.prototype || canvas;
    const webmMime = "video/webm;codecs=vp9";
    const webm = Boolean(canvas2d && Recorder && typeof prototype?.captureStream === "function" && (typeof Recorder.isTypeSupported !== "function" || Recorder.isTypeSupported(webmMime) || Recorder.isTypeSupported("video/webm")));
    return Object.freeze({
      png: createCapability(png, rasterReason),
      jpeg: createCapability(jpeg, rasterReason),
      webp: createCapability(webp, rasterReason),
      avif: createCapability(avif, "AVIF chỉ khả dụng khi Canvas của trình duyệt mã hóa đúng image/avif."),
      svg: createCapability(Boolean(BlobCtor), "Trình duyệt không có Blob để tạo SVG cục bộ."),
      "project-json": createCapability(Boolean(BlobCtor), "Trình duyệt không có Blob để tạo project JSON."),
      pdf: createCapability(false, "Không có bộ mã hóa PDF cục bộ. Export Center không thay PDF bằng ảnh giả."),
      webm: createCapability(webm, "WebM cần MediaRecorder, Canvas captureStream và codec WebM được trình duyệt hỗ trợ."),
      "sprite-sheet": createCapability(canvas2d && png, "Sprite sheet cần Canvas 2D có khả năng tạo PNG."),
      download: createCapability(Boolean(scope.document && scope.URL?.createObjectURL), "Trình duyệt không có luồng tải Blob cục bộ.")
    });
  }

  function getFormatCapability(format, capabilities) {
    const id = normalizeFormat(format);
    return capabilities?.[id] || createCapability(false, "Không xác định được capability của định dạng.");
  }

  function approximateMeasure(text, fontSize) {
    return [...String(text)].reduce((width, character) => width + (/[\s.,:;!|ilI1]/.test(character) ? 0.32 : /[MW@#%]/.test(character) ? 0.9 : 0.58) * fontSize, 0);
  }

  function wrapText(text, maxWidth, measure, maxLines) {
    const paragraphs = cleanText(text, 10000).split(/\r?\n/);
    const lines = [];
    let overflow = false;
    const widthOf = typeof measure === "function" ? measure : (value) => approximateMeasure(value, 16);
    paragraphs.forEach((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(""); return; }
      let current = "";
      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (current && widthOf(candidate) > maxWidth) {
          lines.push(current);
          current = word;
        } else if (!current && widthOf(word) > maxWidth) {
          let piece = "";
          [...word].forEach((character) => {
            if (piece && widthOf(piece + character) > maxWidth) { lines.push(piece); piece = character; } else piece += character;
          });
          current = piece;
        } else current = candidate;
      });
      if (current) lines.push(current);
    });
    const limit = Math.max(1, Number(maxLines) || 1000);
    if (lines.length > limit) overflow = true;
    return { lines: lines.slice(0, limit), overflow, totalLines: lines.length };
  }

  function checkFont(fontFamily, fontSize, options) {
    const family = cleanText(fontFamily, 120);
    const available = options?.availableFonts;
    if (Array.isArray(available)) return available.some((font) => String(font).toLowerCase() === family.toLowerCase());
    const fonts = options?.document?.fonts || globalScope.document?.fonts;
    if (fonts?.check) {
      try { return fonts.check(`${Math.max(12, fontSize || 16)}px "${family.replace(/["\\]/g, "")}"`); } catch (_) { return false; }
    }
    return SYSTEM_FONTS.some((font) => font.toLowerCase() === family.toLowerCase());
  }

  function runPreflight(input, options) {
    const artboards = (Array.isArray(input) ? input : input?.artboards || [input]).filter(Boolean).map(normalizeArtboard);
    const settings = normalizeSettings(options?.settings || options);
    const maxAssetBytes = clamp(options?.maxAssetBytes, 1, Number.MAX_SAFE_INTEGER, MAX_ASSET_BYTES);
    const issues = [];
    const push = (level, code, artboard, source, message) => issues.push({
      level, code, artboardId: artboard.id, elementId: source?.id || null,
      assetId: source?.assetId || (source?.type ? null : source?.id) || null, message
    });

    artboards.forEach((artboard) => {
      if (artboard.width * settings.scale > MAX_CANVAS_EDGE || artboard.height * settings.scale > MAX_CANVAS_EDGE) {
        push("error", "canvas-too-large", artboard, null, `${artboard.name}: kích thước ${settings.scale}x vượt giới hạn Canvas ${MAX_CANVAS_EDGE}px.`);
      }
      const assets = new Map(artboard.assets.map((asset) => [asset.id, asset]));
      artboard.assets.forEach((asset) => {
        if (asset.size > maxAssetBytes) push("warning", "asset-oversize", artboard, asset, `${asset.name} lớn hơn ${(maxAssetBytes / 1048576).toFixed(0)} MB.`);
        if (asset.type.startsWith("font/") && asset.loaded === false) push("warning", "font-missing", artboard, asset, `Font ${asset.fontFamily || asset.name} chưa được nạp.`);
      });
      artboard.elements.forEach((element) => {
        if (element.type === "text") {
          if (!checkFont(element.fontFamily, element.fontSize, options)) push("warning", "font-missing", artboard, element, `Font ${element.fontFamily} chưa sẵn sàng; bản xuất có thể dùng font thay thế.`);
          const measured = wrapText(element.text, element.width, (text) => approximateMeasure(text, element.fontSize), element.maxLines);
          const requiredHeight = measured.totalLines * element.fontSize * element.lineHeight;
          if (measured.overflow || requiredHeight > element.height) push("warning", "text-overflow", artboard, element, `Text ${element.id} vượt khung hoặc quá ${element.maxLines} dòng.`);
        }
        if (element.type === "image") {
          const asset = assets.get(element.assetId);
          if (!asset) return push("error", "asset-missing", artboard, element, `Thiếu asset cho image ${element.id}.`);
          const requiredWidth = element.width * settings.scale;
          const requiredHeight = element.height * settings.scale;
          if (asset.width && asset.height && (asset.width < requiredWidth || asset.height < requiredHeight)) {
            push("warning", "low-resolution", artboard, element, `${asset.name} có độ phân giải ${asset.width} x ${asset.height}, thấp hơn vùng xuất ${Math.round(requiredWidth)} x ${Math.round(requiredHeight)}.`);
          }
        }
      });
    });
    const errors = issues.filter((issue) => issue.level === "error");
    const warnings = issues.filter((issue) => issue.level === "warning");
    return { valid: errors.length === 0, errors, warnings, issues, summary: { artboards: artboards.length, errors: errors.length, warnings: warnings.length } };
  }

  function watermarkPosition(artboard, watermark) {
    const pad = Math.max(12, watermark.fontSize * 0.7);
    const positions = {
      "top-left": { x: pad, y: pad, align: "left", baseline: "top" },
      "top-right": { x: artboard.width - pad, y: pad, align: "right", baseline: "top" },
      "bottom-left": { x: pad, y: artboard.height - pad, align: "left", baseline: "bottom" },
      "bottom-right": { x: artboard.width - pad, y: artboard.height - pad, align: "right", baseline: "bottom" },
      center: { x: artboard.width / 2, y: artboard.height / 2, align: "center", baseline: "middle" }
    };
    return positions[watermark.position] || positions["bottom-right"];
  }

  function drawFittedImage(context, image, element) {
    const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height;
    if (!sourceWidth || !sourceHeight) return false;
    if (element.fit === "fill") { context.drawImage(image, element.x, element.y, element.width, element.height); return true; }
    const scale = element.fit === "contain" ? Math.min(element.width / sourceWidth, element.height / sourceHeight) : Math.max(element.width / sourceWidth, element.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = element.x + (element.width - width) / 2;
    const y = element.y + (element.height - height) / 2;
    context.save?.();
    context.beginPath?.();
    context.rect?.(element.x, element.y, element.width, element.height);
    context.clip?.();
    context.drawImage(image, x, y, width, height);
    context.restore?.();
    return true;
  }

  function paintArtboard(context, input, options) {
    if (!context) return false;
    const artboard = normalizeArtboard(input, 0);
    const settings = normalizeSettings(options?.settings || options);
    const images = options?.images || new Map();
    context.save?.();
    context.fillStyle = artboard.background;
    context.fillRect(0, 0, artboard.width, artboard.height);
    artboard.elements.forEach((element) => {
      context.save?.();
      context.globalAlpha = element.opacity;
      if (element.rotation && context.translate && context.rotate) {
        context.translate(element.x + element.width / 2, element.y + element.height / 2);
        context.rotate(element.rotation * Math.PI / 180);
        context.translate(-(element.x + element.width / 2), -(element.y + element.height / 2));
      }
      if (element.type === "rect") {
        context.fillStyle = element.fill;
        if (element.radius && context.roundRect) { context.beginPath(); context.roundRect(element.x, element.y, element.width, element.height, element.radius); context.fill(); }
        else context.fillRect(element.x, element.y, element.width, element.height);
      } else if (element.type === "ellipse") {
        context.fillStyle = element.fill;
        context.beginPath?.();
        context.ellipse?.(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
        context.fill?.();
      } else if (element.type === "image") {
        const image = images instanceof Map ? images.get(element.assetId) : images[element.assetId];
        if (image) drawFittedImage(context, image, element);
      } else if (element.type === "text") {
        context.fillStyle = element.fill;
        context.font = `${element.fontWeight} ${element.fontSize}px "${element.fontFamily}", sans-serif`;
        context.textAlign = element.align;
        context.textBaseline = "top";
        const measure = (text) => context.measureText?.(text)?.width ?? approximateMeasure(text, element.fontSize);
        const wrapped = wrapText(element.text, element.width, measure, element.maxLines);
        const x = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
        wrapped.lines.forEach((line, lineIndex) => context.fillText(line, x, element.y + lineIndex * element.fontSize * element.lineHeight, element.width));
      }
      context.restore?.();
    });
    if (settings.watermark.enabled && settings.watermark.text) {
      const position = watermarkPosition(artboard, settings.watermark);
      context.save?.();
      context.globalAlpha = settings.watermark.opacity;
      context.fillStyle = settings.watermark.color;
      context.font = `700 ${settings.watermark.fontSize}px system-ui, sans-serif`;
      context.textAlign = position.align;
      context.textBaseline = position.baseline;
      context.fillText(settings.watermark.text, position.x, position.y, artboard.width * 0.8);
      context.restore?.();
    }
    context.restore?.();
    return true;
  }

  function renderArtboard(canvas, input, options) {
    const artboard = normalizeArtboard(input, 0);
    const settings = normalizeSettings(options?.settings || options);
    const scale = clamp(options?.scale ?? settings.scale, 0.05, 3, 1);
    if (!canvas?.getContext) return false;
    canvas.width = Math.max(1, Math.round(artboard.width * scale));
    canvas.height = Math.max(1, Math.round(artboard.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.setTransform?.(scale, 0, 0, scale, 0, 0);
    return paintArtboard(context, artboard, { ...options, settings });
  }

  function svgText(element) {
    const wrapped = wrapText(element.text, element.width, (text) => approximateMeasure(text, element.fontSize), element.maxLines);
    const x = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
    const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
    const tspans = wrapped.lines.map((line, index) => `<tspan x="${x}" dy="${index ? element.fontSize * element.lineHeight : 0}">${escapeXml(line)}</tspan>`).join("");
    return `<text x="${x}" y="${element.y}" fill="${escapeXml(element.fill)}" opacity="${element.opacity}" font-family="${escapeXml(element.fontFamily)}, sans-serif" font-size="${element.fontSize}" font-weight="${element.fontWeight}" text-anchor="${anchor}" dominant-baseline="hanging" transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})">${tspans}</text>`;
  }

  function serializeSvg(input, settingsInput) {
    const artboard = normalizeArtboard(input, 0);
    const settings = normalizeSettings(settingsInput);
    const assets = new Map(artboard.assets.map((asset) => [asset.id, asset]));
    const body = artboard.elements.map((element) => {
      const transform = `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`;
      if (element.type === "text") return svgText(element);
      if (element.type === "ellipse") return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${escapeXml(element.fill)}" opacity="${element.opacity}" transform="${transform}"/>`;
      if (element.type === "image") {
        const asset = assets.get(element.assetId);
        const href = safeDataImage(asset?.dataUrl);
        return href ? `<image x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" opacity="${element.opacity}" preserveAspectRatio="xMidYMid ${element.fit === "contain" ? "meet" : "slice"}" href="${href}" transform="${transform}"/>` : "";
      }
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.radius}" fill="${escapeXml(element.fill)}" opacity="${element.opacity}" transform="${transform}"/>`;
    }).join("");
    let watermark = "";
    if (settings.watermark.enabled && settings.watermark.text) {
      const position = watermarkPosition(artboard, settings.watermark);
      const anchor = position.align === "center" ? "middle" : position.align === "right" ? "end" : "start";
      watermark = `<text x="${position.x}" y="${position.y}" fill="${escapeXml(settings.watermark.color)}" opacity="${settings.watermark.opacity}" font-family="system-ui, sans-serif" font-size="${settings.watermark.fontSize}" font-weight="700" text-anchor="${anchor}" dominant-baseline="${position.baseline === "middle" ? "middle" : position.baseline === "bottom" ? "auto" : "hanging"}">${escapeXml(settings.watermark.text)}</text>`;
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${artboard.width}" height="${artboard.height}" viewBox="0 0 ${artboard.width} ${artboard.height}" role="img" aria-label="${escapeXml(artboard.name)}"><rect width="100%" height="100%" fill="${escapeXml(artboard.background)}"/>${body}${watermark}</svg>`;
  }

  function serializeProject(input) {
    const project = normalizeProject(input);
    return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), project: cloneSerializable(project) }, null, 2);
  }

  function renderFileName(rule, context, formatInput) {
    const format = FORMATS[normalizeFormat(formatInput || context?.format)];
    const values = {
      project: context?.project || "project",
      artboard: context?.artboard || "artboard",
      preset: context?.preset || "custom",
      scale: context?.scale || 1,
      index: context?.index || 1,
      format: format.id,
      date: context?.date || new Date().toISOString().slice(0, 10)
    };
    const template = cleanText(rule || "{project}-{artboard}-{scale}x", 240);
    const rendered = template.replace(/\{(project|artboard|preset|scale|index|format|date)\}/g, (_, key) => String(values[key]));
    const base = slug(rendered.replace(/\.[a-z0-9]{2,5}$/i, ""), "export");
    return `${base}.${format.extension}`;
  }

  function makeBlob(parts, type, runtime) {
    const BlobCtor = runtime?.Blob || (typeof Blob !== "undefined" ? Blob : null);
    if (!BlobCtor) throw new ExportCapabilityError("Blob không được hỗ trợ.", "unsupported");
    return new BlobCtor(parts, { type });
  }

  class ExportCapabilityError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "ExportCapabilityError";
      this.code = code || "unsupported";
    }
  }

  function assertNotAborted(signal) {
    if (signal?.aborted) {
      const error = new Error("Export đã bị hủy.");
      error.name = "AbortError";
      throw error;
    }
  }

  function createCanvas(environment) {
    const canvas = environment?.canvasFactory?.() || environment?.document?.createElement?.("canvas") || globalScope.document?.createElement?.("canvas");
    if (!canvas?.getContext?.("2d")) throw new ExportCapabilityError("Canvas 2D không được hỗ trợ.", "unsupported");
    return canvas;
  }

  async function canvasToBlob(canvas, mime, quality, signal) {
    assertNotAborted(signal);
    if (typeof canvas.toBlob !== "function") throw new ExportCapabilityError("canvas.toBlob không được hỗ trợ.", "unsupported");
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    assertNotAborted(signal);
    if (!blob) throw new ExportCapabilityError(`Trình duyệt không tạo được ${mime}.`, "encode-failed");
    if (mime !== "image/png" && blob.type && blob.type !== mime) throw new ExportCapabilityError(`Trình duyệt trả ${blob.type} thay vì ${mime}.`, "unsupported");
    return blob;
  }

  function loadImage(source, environment, signal) {
    const ImageCtor = environment?.Image || globalScope.Image;
    if (!ImageCtor || !source) return Promise.resolve(null);
    return new Promise((resolve) => {
      assertNotAborted(signal);
      const image = new ImageCtor();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = source;
    });
  }

  async function loadArtboardImages(artboard, environment, signal) {
    const images = new Map();
    for (const asset of artboard.assets) {
      assertNotAborted(signal);
      const injected = environment?.images instanceof Map ? environment.images.get(asset.id) : environment?.images?.[asset.id];
      if (injected) { images.set(asset.id, injected); continue; }
      let objectUrl = "";
      let source = asset.dataUrl;
      if (!source && asset.blob && environment?.URL?.createObjectURL) { objectUrl = environment.URL.createObjectURL(asset.blob); source = objectUrl; }
      const image = await loadImage(source, environment, signal);
      if (image) images.set(asset.id, image);
      if (objectUrl) environment.URL.revokeObjectURL?.(objectUrl);
    }
    return images;
  }

  async function exportRaster(artboardInput, settingsInput, environment) {
    const artboard = normalizeArtboard(artboardInput, 0);
    const settings = normalizeSettings(settingsInput);
    const format = FORMATS[settings.format];
    const signal = environment?.signal;
    assertNotAborted(signal);
    const canvas = createCanvas(environment);
    if (format.kind !== "raster") throw new ExportCapabilityError(`${format.label} không phải định dạng raster Canvas.`, "invalid-format");
    const capabilities = environment?.capabilities || detectCapabilities(environment || globalScope, environment?.capabilityCanvas || canvas);
    const capability = getFormatCapability(format.id, capabilities);
    if (!capability.supported) throw new ExportCapabilityError(capability.reason, "unsupported");
    const images = await loadArtboardImages(artboard, environment || {}, signal);
    renderArtboard(canvas, artboard, { settings, scale: settings.scale, images });
    const blob = await canvasToBlob(canvas, format.mime, settings.quality, signal);
    return { blob, width: canvas.width, height: canvas.height, mimeType: format.mime };
  }

  function projectForArtboard(artboard, settings) {
    return { format: FORMAT, version: VERSION, name: settings.projectName, artboards: [artboard], settings };
  }

  async function exportArtboard(artboardInput, settingsInput, environment) {
    const artboard = normalizeArtboard(artboardInput, 0);
    const settings = normalizeSettings(settingsInput);
    const format = FORMATS[settings.format];
    const capabilities = environment?.capabilities || detectCapabilities(environment || globalScope, environment?.capabilityCanvas);
    const capability = getFormatCapability(format.id, capabilities);
    if (!capability.supported) throw new ExportCapabilityError(capability.reason, "unsupported");
    assertNotAborted(environment?.signal);
    let result;
    if (format.kind === "raster") result = await exportRaster(artboard, settings, environment || {});
    else if (format.id === "svg") result = { blob: makeBlob([serializeSvg(artboard, settings)], format.mime, environment), width: artboard.width, height: artboard.height, mimeType: format.mime };
    else if (format.id === "project-json") result = { blob: makeBlob([serializeProject(projectForArtboard(artboard, settings))], format.mime, environment), width: artboard.width, height: artboard.height, mimeType: format.mime };
    else throw new ExportCapabilityError(`${format.label} cần export theo batch.`, "aggregate-required");
    result.format = format.id;
    result.filename = renderFileName(settings.namingRule, { project: settings.projectName, artboard: artboard.name, preset: artboard.presetId, scale: settings.scale, format: format.id }, format.id);
    result.artboardId = artboard.id;
    return result;
  }

  async function exportSpriteSheet(artboardInputs, settingsInput, environment) {
    const settings = normalizeSettings({ ...settingsInput, format: "sprite-sheet" });
    const artboards = artboardInputs.map(normalizeArtboard);
    if (!artboards.length) throw new Error("Sprite sheet cần ít nhất một artboard.");
    const capabilities = environment?.capabilities || detectCapabilities(environment || globalScope, environment?.capabilityCanvas);
    if (!capabilities["sprite-sheet"].supported) throw new ExportCapabilityError(capabilities["sprite-sheet"].reason, "unsupported");
    const columns = Math.min(settings.spriteColumns, artboards.length);
    const rows = Math.ceil(artboards.length / columns);
    const padding = settings.spritePadding * settings.scale;
    const cellWidth = Math.max(...artboards.map((item) => item.width * settings.scale));
    const cellHeight = Math.max(...artboards.map((item) => item.height * settings.scale));
    const outputWidth = Math.ceil(columns * cellWidth + (columns + 1) * padding);
    const outputHeight = Math.ceil(rows * cellHeight + (rows + 1) * padding);
    if (outputWidth > MAX_CANVAS_EDGE || outputHeight > MAX_CANVAS_EDGE) throw new ExportCapabilityError(`Sprite sheet ${outputWidth} x ${outputHeight} vượt giới hạn Canvas ${MAX_CANVAS_EDGE}px.`, "canvas-too-large");
    const canvas = createCanvas(environment);
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    context.fillStyle = "#00000000";
    context.clearRect?.(0, 0, outputWidth, outputHeight);
    for (let index = 0; index < artboards.length; index += 1) {
      assertNotAborted(environment?.signal);
      const artboard = artboards[index];
      const tile = createCanvas(environment);
      const images = await loadArtboardImages(artboard, environment || {}, environment?.signal);
      renderArtboard(tile, artboard, { settings, scale: settings.scale, images });
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = padding + column * (cellWidth + padding) + (cellWidth - tile.width) / 2;
      const y = padding + row * (cellHeight + padding) + (cellHeight - tile.height) / 2;
      context.drawImage(tile, x, y);
    }
    const blob = await canvasToBlob(canvas, "image/png", 1, environment?.signal);
    return {
      blob, width: outputWidth, height: outputHeight, mimeType: "image/png", format: "sprite-sheet",
      filename: renderFileName(settings.namingRule, { project: settings.projectName, artboard: "sprite-sheet", preset: "batch", scale: settings.scale, format: "sprite-sheet" }, "sprite-sheet"),
      artboardIds: artboards.map((item) => item.id)
    };
  }

  function wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(Object.assign(new Error("Export đã bị hủy."), { name: "AbortError" }));
      const timer = setTimeout(resolve, milliseconds);
      signal?.addEventListener?.("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("Export đã bị hủy."), { name: "AbortError" })); }, { once: true });
    });
  }

  async function exportWebM(artboardInputs, settingsInput, environment) {
    const settings = normalizeSettings({ ...settingsInput, format: "webm" });
    const artboards = artboardInputs.map(normalizeArtboard);
    const capabilities = environment?.capabilities || detectCapabilities(environment || globalScope, environment?.capabilityCanvas);
    if (!capabilities.webm.supported) throw new ExportCapabilityError(capabilities.webm.reason, "unsupported");
    if (!artboards.length) throw new Error("WebM cần ít nhất một artboard.");
    const runtime = environment || globalScope;
    const canvas = createCanvas(environment);
    const width = Math.max(...artboards.map((item) => item.width));
    const height = Math.max(...artboards.map((item) => item.height));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(12);
    const Recorder = runtime.MediaRecorder || globalScope.MediaRecorder;
    const mimeType = Recorder.isTypeSupported?.("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new Recorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    const chunks = [];
    const stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => reject(recorder.error || new Error("MediaRecorder không thể tạo WebM."));
      recorder.onstop = resolve;
    });
    recorder.start();
    try {
      for (const artboard of artboards) {
        assertNotAborted(environment?.signal);
        context.setTransform?.(1, 0, 0, 1, 0, 0);
        context.clearRect?.(0, 0, width, height);
        const scale = Math.min(width / artboard.width, height / artboard.height);
        const offsetX = (width - artboard.width * scale) / 2;
        const offsetY = (height - artboard.height * scale) / 2;
        const images = await loadArtboardImages(artboard, environment || {}, environment?.signal);
        context.save?.();
        context.translate?.(offsetX, offsetY);
        context.scale?.(scale, scale);
        paintArtboard(context, artboard, { settings, images });
        context.restore?.();
        stream.getVideoTracks?.()[0]?.requestFrame?.();
        await wait(settings.frameDuration * 1000, environment?.signal);
      }
    } finally {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      stream.getTracks?.().forEach((track) => track.stop());
    }
    assertNotAborted(environment?.signal);
    const blob = makeBlob(chunks, "video/webm", runtime);
    return {
      blob, width, height, mimeType: "video/webm", format: "webm",
      filename: renderFileName(settings.namingRule, { project: settings.projectName, artboard: "artboards", preset: "batch", scale: 1, format: "webm" }, "webm"),
      artboardIds: artboards.map((item) => item.id)
    };
  }

  async function exportBatch(artboards, settingsInput, environment) {
    const settings = normalizeSettings(settingsInput);
    if (settings.format === "sprite-sheet") return [await exportSpriteSheet(artboards, settings, environment || {})];
    if (settings.format === "webm") return [await exportWebM(artboards, settings, environment || {})];
    if (settings.format === "pdf") throw new ExportCapabilityError(detectCapabilities(environment || globalScope).pdf.reason, "unsupported");
    const results = [];
    for (let index = 0; index < artboards.length; index += 1) {
      assertNotAborted(environment?.signal);
      const result = await exportArtboard(artboards[index], settings, environment || {});
      result.filename = renderFileName(settings.namingRule, { project: settings.projectName, artboard: artboards[index].name, preset: artboards[index].presetId, scale: settings.scale, index: index + 1, format: settings.format }, settings.format);
      results.push(result);
    }
    return results;
  }

  function serializableJob(job) {
    return {
      id: cleanText(job.id, 120),
      label: cleanText(job.label, 180),
      status: ["queued", "running", "completed", "failed", "canceled"].includes(job.status) ? job.status : "queued",
      progress: clamp(job.progress, 0, 100, 0),
      attempts: Math.round(clamp(job.attempts, 0, 100, 0)),
      createdAt: job.createdAt || new Date().toISOString(),
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null,
      error: job.error ? { code: cleanText(job.error.code, 80), message: cleanText(job.error.message, 500) } : null,
      settings: normalizeSettings(job.settings),
      artboards: (job.artboards || (job.artboard ? [job.artboard] : [])).map(normalizeArtboard),
      preflight: job.preflight ? cloneSerializable(job.preflight) : null,
      result: job.result ? {
        filename: cleanText(job.result.filename, 240), format: cleanText(job.result.format, 40),
        mimeType: cleanText(job.result.mimeType, 120), width: job.result.width || 0,
        height: job.result.height || 0, size: job.result.blob?.size || job.result.size || 0
      } : null
    };
  }

  function createExportQueue(options) {
    const config = options && typeof options === "object" ? options : {};
    const listeners = new Set();
    const activeControllers = new Map();
    const jobs = [];
    let processing = null;
    let disposed = false;

    (Array.isArray(config.jobs) ? config.jobs : []).forEach((source) => {
      const job = serializableJob(source);
      if (!job.artboards.length) return;
      if (job.status === "running") job.status = "queued";
      job.progress = job.status === "completed" ? 100 : 0;
      jobs.push(job);
    });

    function snapshot() {
      return jobs.map(serializableJob);
    }

    function notify() {
      const value = snapshot();
      listeners.forEach((listener) => { try { listener(value); } catch (_) { /* subscriber errors do not stop exports */ } });
      config.onChange?.(value);
    }

    function enqueue(artboardInputs, settingsInput) {
      if (disposed) return [];
      const artboards = (Array.isArray(artboardInputs) ? artboardInputs : [artboardInputs]).filter(Boolean).map(normalizeArtboard);
      if (!artboards.length) return [];
      const settings = normalizeSettings(settingsInput);
      const format = FORMATS[settings.format];
      const batches = format.aggregate ? [artboards] : artboards.map((artboard) => [artboard]);
      const created = batches.map((batch, index) => {
        const label = format.aggregate ? format.label : batch[0].name;
        const job = {
          id: uid("export"), label, status: "queued", progress: 0, attempts: 0,
          createdAt: new Date().toISOString(), startedAt: null, completedAt: null,
          error: null, settings: normalizeSettings(settings), artboards: batch,
          preflight: runPreflight(batch, { ...config.preflightOptions, settings }), result: null,
          order: jobs.length + index
        };
        jobs.push(job);
        return serializableJob(job);
      });
      notify();
      return created;
    }

    async function defaultExporter(job, environment) {
      if (job.settings.format === "sprite-sheet") return exportSpriteSheet(job.artboards, job.settings, environment);
      if (job.settings.format === "webm") return exportWebM(job.artboards, job.settings, environment);
      if (job.settings.format === "pdf") throw new ExportCapabilityError(detectCapabilities(environment).pdf.reason, "unsupported");
      return exportArtboard(job.artboards[0], job.settings, environment);
    }

    async function runJob(job) {
      const Controller = config.AbortController || globalScope.AbortController;
      const controller = Controller ? new Controller() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
      activeControllers.set(job.id, controller);
      job.status = "running";
      job.progress = 8;
      job.attempts += 1;
      job.startedAt = new Date().toISOString();
      job.completedAt = null;
      job.error = null;
      notify();
      try {
        const capabilities = config.capabilities || detectCapabilities(config.environment || globalScope, config.capabilityCanvas);
        const capability = getFormatCapability(job.settings.format, capabilities);
        if (!capability.supported) throw new ExportCapabilityError(capability.reason, "unsupported");
        if (!job.preflight.valid) throw new ExportCapabilityError("Preflight có lỗi chặn export.", "preflight-failed");
        job.progress = 24;
        notify();
        const environment = { ...(config.environment || {}), capabilities, signal: controller.signal };
        const exporter = config.exporter || defaultExporter;
        const result = await exporter(job, environment);
        assertNotAborted(controller.signal);
        job.result = result;
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        await config.onResult?.(result, serializableJob(job));
      } catch (error) {
        const canceled = controller.signal.aborted || error?.name === "AbortError";
        job.status = canceled ? "canceled" : "failed";
        job.progress = 0;
        job.error = canceled ? null : { code: error?.code || "export-failed", message: cleanText(error?.message || "Export thất bại.", 500) };
        job.completedAt = new Date().toISOString();
      } finally {
        activeControllers.delete(job.id);
        notify();
      }
      return serializableJob(job);
    }

    async function start() {
      if (disposed) return snapshot();
      if (processing) return processing;
      processing = (async () => {
        while (!disposed) {
          const next = jobs.find((job) => job.status === "queued");
          if (!next) break;
          await runJob(next);
        }
        return snapshot();
      })();
      try { return await processing; } finally { processing = null; }
    }

    function cancel(id) {
      const job = jobs.find((item) => item.id === id);
      if (!job || !["queued", "running"].includes(job.status)) return false;
      activeControllers.get(id)?.abort();
      job.status = "canceled";
      job.progress = 0;
      job.completedAt = new Date().toISOString();
      notify();
      return true;
    }

    function retry(id) {
      const job = jobs.find((item) => item.id === id);
      if (!job || !["failed", "canceled"].includes(job.status)) return false;
      job.status = "queued";
      job.progress = 0;
      job.error = null;
      job.result = null;
      job.startedAt = null;
      job.completedAt = null;
      notify();
      return true;
    }

    function remove(id) {
      const index = jobs.findIndex((item) => item.id === id);
      if (index < 0 || jobs[index].status === "running") return false;
      jobs.splice(index, 1);
      notify();
      return true;
    }

    function clearCompleted() {
      let removed = 0;
      for (let index = jobs.length - 1; index >= 0; index -= 1) {
        if (["completed", "canceled"].includes(jobs[index].status)) { jobs.splice(index, 1); removed += 1; }
      }
      if (removed) notify();
      return removed;
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    }

    function dispose() {
      disposed = true;
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
      listeners.clear();
    }

    return Object.freeze({ enqueue, addBatch: enqueue, start, process: start, cancel, retry, remove, clearCompleted, subscribe, snapshot, getJobs: snapshot, dispose });
  }

  function createExportManifest(input, options) {
    const source = input && typeof input === "object" ? input : {};
    const project = normalizeProject(source.project || (source.artboards ? source : { artboards: Array.isArray(input) ? input : [] }));
    const settings = normalizeSettings(source.settings || options?.settings || project.settings);
    const jobs = (source.jobs || options?.jobs || []).map(serializableJob);
    const preflight = source.preflight || options?.preflight || runPreflight(project.artboards, { ...(options?.preflightOptions || {}), settings });
    const rawCapabilities = source.capabilities || options?.capabilities || detectCapabilities(options?.runtime || globalScope, options?.capabilityCanvas);
    const capabilities = Object.fromEntries(Object.entries(rawCapabilities).map(([id, state]) => [id, { supported: Boolean(state.supported), state: state.state, reason: state.reason || "" }]));
    const items = jobs.length ? jobs.map((job) => ({
      id: job.id, artboardIds: job.artboards.map((item) => item.id), label: job.label,
      format: job.settings.format, scale: job.settings.scale, status: job.status,
      filename: job.result?.filename || renderFileName(job.settings.namingRule, {
        project: job.settings.projectName, artboard: job.artboards.length === 1 ? job.artboards[0].name : FORMATS[job.settings.format].label,
        preset: job.artboards.length === 1 ? job.artboards[0].presetId : "batch", scale: job.settings.scale, format: job.settings.format
      }, job.settings.format),
      width: job.result?.width || (job.artboards.length === 1 ? job.artboards[0].width * job.settings.scale : null),
      height: job.result?.height || (job.artboards.length === 1 ? job.artboards[0].height * job.settings.scale : null),
      bytes: job.result?.size || 0,
      error: job.error
    })) : project.artboards.map((artboard, index) => ({
      id: `manifest-${index + 1}`, artboardIds: [artboard.id], label: artboard.name,
      format: settings.format, scale: settings.scale, status: "planned",
      filename: renderFileName(settings.namingRule, { project: project.name, artboard: artboard.name, preset: artboard.presetId, scale: settings.scale, index: index + 1, format: settings.format }, settings.format),
      width: artboard.width * settings.scale, height: artboard.height * settings.scale, bytes: 0, error: null
    }));
    return {
      format: MANIFEST_FORMAT,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      project: { name: project.name, artboardCount: project.artboards.length },
      settings,
      capabilities,
      preflight: cloneSerializable(preflight),
      items
    };
  }

  function exportManifest(input, options) {
    return JSON.stringify(createExportManifest(input, options), null, 2);
  }

  function normalizeWorkspace(input) {
    const source = input && typeof input === "object" ? input : {};
    const project = normalizeProject(source.project || source);
    const ids = new Set(project.artboards.map((artboard) => artboard.id));
    const selectedIds = (Array.isArray(source.selectedIds) ? source.selectedIds.map(String).filter((id) => ids.has(id)) : project.artboards.map((item) => item.id));
    return {
      format: FORMAT,
      version: VERSION,
      project,
      settings: normalizeSettings(source.settings || project.settings),
      selectedIds: selectedIds.length ? [...new Set(selectedIds)] : [project.artboards[0].id],
      jobs: (Array.isArray(source.jobs) ? source.jobs : []).slice(0, 300).map(serializableJob)
    };
  }

  function saveWorkspace(input, storage) {
    if (!storage || typeof storage.setItem !== "function") return { ok: false, reason: "unsupported" };
    try {
      const workspace = normalizeWorkspace(input);
      storage.setItem(STORAGE_KEY, JSON.stringify({ format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), workspace }));
      return { ok: true, workspace };
    } catch (error) {
      return { ok: false, reason: "write-failed", message: cleanText(error?.message, 240) };
    }
  }

  function loadWorkspace(storage, fallback) {
    if (!storage || typeof storage.getItem !== "function") return normalizeWorkspace(fallback || createDefaultProject());
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION || !parsed.workspace) return normalizeWorkspace(fallback || createDefaultProject());
      return normalizeWorkspace(parsed.workspace);
    } catch (_) {
      return normalizeWorkspace(fallback || createDefaultProject());
    }
  }

  function downloadBlob(blob, filename, runtime) {
    const scope = runtime || globalScope;
    if (!blob || !scope.document || !scope.URL?.createObjectURL) return { ok: false, reason: "unsupported" };
    const url = scope.URL.createObjectURL(blob);
    const anchor = scope.document.createElement("a");
    anchor.href = url;
    anchor.download = slug(String(filename || "export").replace(/\.[a-z0-9]{2,5}$/i, ""), "export") + (String(filename || "").match(/\.[a-z0-9]{2,5}$/i)?.[0] || "");
    anchor.hidden = true;
    scope.document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => scope.URL.revokeObjectURL(url), 0);
    return { ok: true, filename: anchor.download };
  }

  function addStyles(documentRef) {
    const documentObject = documentRef || globalScope.document;
    if (!documentObject || documentObject.getElementById("hh-export-center-style")) return;
    const style = documentObject.createElement("style");
    style.id = "hh-export-center-style";
    style.textContent = `
      .hec{--hec-bg:#080d14;--hec-panel:#0e1721;--hec-panel-2:#121d29;--hec-line:#2a3b49;--hec-text:#edf7fb;--hec-muted:#93a5b2;--hec-cyan:#61dce8;--hec-pink:#f26bb5;--hec-lime:#b8ea6d;--hec-warn:#f2c45e;--hec-danger:#ff7272;display:block;min-width:0;overflow:hidden;border:1px solid var(--hec-line);border-radius:8px;background:var(--hec-bg);color:var(--hec-text);font:500 13px/1.45 Inter,system-ui,sans-serif}.hec *{box-sizing:border-box;letter-spacing:0}.hec button,.hec input,.hec select{font:inherit}.hec button{min-height:34px;border:1px solid var(--hec-line);border-radius:6px;background:#14212d;color:var(--hec-text);cursor:pointer}.hec button:hover:not(:disabled){border-color:var(--hec-cyan);background:#182a37}.hec button:disabled,.hec select:disabled{cursor:not-allowed;opacity:.48}.hec :focus-visible{outline:2px solid var(--hec-cyan);outline-offset:2px}.hec-top{display:flex;align-items:center;gap:12px;min-height:62px;padding:10px 14px;border-bottom:1px solid var(--hec-line);background:#0b121a}.hec-mark{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border:1px solid var(--hec-pink);border-radius:7px;color:var(--hec-cyan);font-weight:900}.hec-brand{min-width:0;margin-right:auto}.hec-brand strong{display:block;font-size:15px}.hec-brand small{display:block;overflow:hidden;color:var(--hec-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.hec-top-actions{display:flex;gap:7px}.hec-btn{padding:7px 10px}.hec-primary{border-color:transparent!important;background:var(--hec-lime)!important;color:#0b1319!important;font-weight:850}.hec-layout{display:grid;grid-template-columns:240px minmax(340px,1fr) 290px;min-height:650px}.hec-panel{min-width:0;padding:12px;background:var(--hec-panel)}.hec-panel:first-child{border-right:1px solid var(--hec-line)}.hec-panel:last-child{border-left:1px solid var(--hec-line)}.hec-section+.hec-section{margin-top:18px;padding-top:14px;border-top:1px solid var(--hec-line)}.hec-heading{display:flex;align-items:center;gap:8px;margin-bottom:9px}.hec-heading h2,.hec-heading h3{margin:0;font-size:11px;text-transform:uppercase}.hec-heading h2{color:var(--hec-cyan)}.hec-heading h3{color:var(--hec-pink)}.hec-heading span{margin-left:auto;color:var(--hec-muted);font-size:10px}.hec-stack{display:grid;gap:8px}.hec-field{display:grid;gap:4px;color:var(--hec-muted);font-size:11px}.hec-field input,.hec-field select{width:100%;min-width:0;height:36px;padding:7px 9px;border:1px solid var(--hec-line);border-radius:6px;background:#090f16;color:var(--hec-text)}.hec-field input[type=range]{padding:0;accent-color:var(--hec-cyan)}.hec-check{display:flex;align-items:flex-start;gap:8px;color:var(--hec-text)}.hec-check input{width:16px;height:16px;margin-top:2px;accent-color:var(--hec-pink)}.hec-artboards{display:grid;gap:6px}.hec-artboard{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid transparent;border-radius:6px}.hec-artboard:hover,.hec-artboard:focus-within{border-color:var(--hec-line);background:var(--hec-panel-2)}.hec-artboard input{width:16px;height:16px;accent-color:var(--hec-cyan)}.hec-artboard strong{display:block;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.hec-artboard small{display:block;color:var(--hec-muted);font-size:10px}.hec-artboard code{color:var(--hec-lime);font:600 9px/1.2 ui-monospace,monospace}.hec-preset-row{display:grid;grid-template-columns:1fr auto;gap:6px}.hec-preset-row select{min-width:0;height:35px;border:1px solid var(--hec-line);border-radius:6px;background:#090f16;color:var(--hec-text)}.hec-scale{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.hec-scale label{position:relative}.hec-scale input{position:absolute;opacity:0;pointer-events:none}.hec-scale span{display:grid;place-items:center;height:34px;border:1px solid var(--hec-line);border-radius:6px;background:#0a1119;color:var(--hec-muted);cursor:pointer}.hec-scale input:checked+span{border-color:var(--hec-pink);background:#2b1929;color:#fff}.hec-scale input:focus-visible+span{outline:2px solid var(--hec-cyan);outline-offset:2px}.hec-work{display:grid;grid-template-rows:auto minmax(260px,1fr) auto;min-width:0;background:#090f16}.hec-workbar{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--hec-line);overflow:auto}.hec-badge{flex:0 0 auto;padding:3px 7px;border:1px solid var(--hec-line);border-radius:999px;color:var(--hec-cyan);font-size:10px}.hec-queue{min-height:0;padding:12px;overflow:auto}.hec-empty{display:grid;place-items:center;min-height:180px;padding:20px;color:var(--hec-muted);text-align:center}.hec-job{display:grid;grid-template-columns:minmax(120px,1fr) 90px 96px;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #1d2a35}.hec-job-main{min-width:0}.hec-job-main strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hec-job-main small{display:block;color:var(--hec-muted);font-size:10px}.hec-job-state{font-size:10px;font-weight:800;text-transform:uppercase}.hec-job-state[data-state=completed]{color:var(--hec-lime)}.hec-job-state[data-state=failed]{color:var(--hec-danger)}.hec-job-state[data-state=running]{color:var(--hec-cyan)}.hec-job-state[data-state=canceled]{color:var(--hec-muted)}.hec-progress{width:100%;height:5px;margin-top:5px;accent-color:var(--hec-cyan)}.hec-job-actions{display:flex;justify-content:flex-end;gap:5px}.hec-job-actions button{width:30px;height:30px;min-height:30px;padding:0}.hec-preview{display:grid;grid-template-columns:minmax(180px,270px) 1fr;gap:12px;align-items:center;padding:12px;border-top:1px solid var(--hec-line);background:#0b121a}.hec-canvas-wrap{display:grid;place-items:center;min-height:126px;max-height:190px;overflow:hidden;border:1px solid var(--hec-line);border-radius:6px;background-color:#111b25;background-image:linear-gradient(45deg,#0b121a 25%,transparent 25%),linear-gradient(-45deg,#0b121a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0b121a 75%),linear-gradient(-45deg,transparent 75%,#0b121a 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}.hec-preview canvas{display:block;max-width:100%;max-height:190px}.hec-preview-copy strong{display:block}.hec-preview-copy span{display:block;margin-top:4px;color:var(--hec-muted);font-size:11px}.hec-quality{display:flex;align-items:center;gap:8px}.hec-quality output{width:36px;color:var(--hec-cyan);font-variant-numeric:tabular-nums}.hec-watermark-fields[hidden]{display:none}.hec-capabilities{display:grid;gap:5px;margin:0;padding:0;list-style:none}.hec-capabilities li{display:grid;grid-template-columns:1fr auto;gap:8px;padding:5px 0;border-bottom:1px solid #1d2934;font-size:10px}.hec-capabilities b[data-state=supported]{color:var(--hec-lime)}.hec-capabilities b[data-state=unsupported]{color:var(--hec-muted)}.hec-issues{display:grid;gap:6px;max-height:190px;overflow:auto}.hec-issue{padding:7px 8px;border-left:2px solid var(--hec-warn);background:#1c1a16;color:#d8dfe4;font-size:10px}.hec-issue[data-level=error]{border-color:var(--hec-danger);background:#201416}.hec-ok{padding:9px;border-left:2px solid var(--hec-lime);background:#142018;color:#cde5cf;font-size:10px}.hec-footer{display:flex;gap:12px;padding:8px 12px;border-top:1px solid var(--hec-line);color:var(--hec-muted);font-size:10px}.hec-footer [role=status]{margin-left:auto}.hec-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:980px){.hec-layout{grid-template-columns:220px 1fr}.hec-panel:last-child{grid-column:1/-1;border-top:1px solid var(--hec-line);border-left:0;display:grid;grid-template-columns:1fr 1fr;gap:16px}.hec-panel:last-child .hec-section{margin:0;padding:0;border:0}}
      @media(max-width:680px){.hec-top{align-items:flex-start;flex-wrap:wrap}.hec-top-actions{width:100%;overflow:auto}.hec-layout{display:block}.hec-panel:first-child{border-right:0;border-bottom:1px solid var(--hec-line)}.hec-panel:last-child{display:block}.hec-panel:last-child .hec-section+.hec-section{margin-top:16px;padding-top:14px;border-top:1px solid var(--hec-line)}.hec-preview{grid-template-columns:1fr}.hec-preview-copy{display:none}}
      @media(max-width:420px){.hec{width:100%;max-width:100%;border-radius:0}.hec-top{padding:9px 10px}.hec-brand small{max-width:250px}.hec-top-actions button{flex:0 0 auto}.hec-panel,.hec-queue{padding:10px}.hec-job{grid-template-columns:minmax(0,1fr) auto}.hec-job-state{grid-row:2}.hec-job-actions{grid-row:1/3;grid-column:2}.hec-workbar{padding:8px 10px}.hec-footer{flex-wrap:wrap}.hec-footer [role=status]{width:100%;margin-left:0}.hec-preset-row{grid-template-columns:minmax(0,1fr) 36px}.hec-canvas-wrap{min-height:150px}.hec input,.hec select,.hec button{max-width:100%}}
      @media(max-width:375px){.hec-brand strong{font-size:13px}.hec-mark{width:34px;height:34px;flex-basis:34px}.hec-artboard{grid-template-columns:18px minmax(0,1fr)}.hec-artboard code{grid-column:2}.hec-scale span{height:38px}.hec-job{gap:6px}.hec-job-actions{flex-direction:column}}
      @media(prefers-reduced-motion:reduce){.hec *,.hec *::before,.hec *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    documentObject.head.appendChild(style);
  }

  function capabilityMarkup(capabilities) {
    return Object.keys(FORMATS).map((id) => {
      const capability = capabilities[id];
      return `<li title="${escapeHtml(capability.reason || `${FORMATS[id].label} khả dụng`)}"><span>${escapeHtml(FORMATS[id].label)}</span><b data-state="${capability.state}">${capability.supported ? "Sẵn sàng" : "Không hỗ trợ"}</b></li>`;
    }).join("");
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const config = options && typeof options === "object" ? options : {};
    const runtime = config.runtime || globalScope;
    const documentRef = runtime.document || globalScope.document;
    addStyles(documentRef);
    let storage = config.storage;
    if (storage === undefined) { try { storage = runtime.localStorage || null; } catch (_) { storage = null; } }
    const supplied = config.project || config.artboards ? {
      project: config.project || { name: config.projectName || "HH Design", artboards: config.artboards },
      settings: config.settings,
      selectedIds: config.selectedIds
    } : null;
    let workspace = supplied && config.preferStored === false ? normalizeWorkspace(supplied) : loadWorkspace(storage, supplied || createDefaultProject());
    let project = workspace.project;
    let settings = normalizeSettings({ ...workspace.settings, projectName: workspace.settings.projectName || project.name });
    let selectedIds = new Set(workspace.selectedIds);
    let activeArtboardId = project.artboards.find((item) => selectedIds.has(item.id))?.id || project.artboards[0].id;
    let preflight = runPreflight(project.artboards.filter((item) => selectedIds.has(item.id)), { settings, document: documentRef });
    const capabilityRuntime = {
      document: documentRef,
      Blob: runtime.Blob || globalScope.Blob,
      Image: runtime.Image || globalScope.Image,
      URL: runtime.URL || globalScope.URL,
      MediaRecorder: runtime.MediaRecorder || globalScope.MediaRecorder,
      HTMLCanvasElement: runtime.HTMLCanvasElement || globalScope.HTMLCanvasElement
    };
    const capabilities = config.capabilities || detectCapabilities(capabilityRuntime, config.capabilityCanvas);
    const mountId = uid("hec");

    root.classList.add("hec");
    root.setAttribute("data-hh-graphic-export-center", "");
    root.innerHTML = `<header class="hec-top"><span class="hec-mark" aria-hidden="true">EX</span><div class="hec-brand"><strong>Export Center Pro</strong><small>Canvas raster · SVG · Project JSON · batch queue · preflight</small></div><div class="hec-top-actions"><button type="button" class="hec-btn" data-hec-action="manifest">Manifest</button><button type="button" class="hec-btn" data-hec-action="preflight">Preflight</button><button type="button" class="hec-btn hec-primary" data-hec-action="start">Xuất queue</button></div></header><main class="hec-layout"><aside class="hec-panel" aria-label="Artboard để xuất"><section class="hec-section"><div class="hec-heading"><h2>Artboard</h2><span data-hec-selection-count></span></div><label class="hec-check"><input type="checkbox" data-hec-select-all><span>Chọn tất cả</span></label><div class="hec-artboards" data-hec-artboards></div></section><section class="hec-section"><div class="hec-heading"><h3>Social preset</h3></div><div class="hec-preset-row"><label class="hec-sr" for="hec-preset-${mountId}">Preset mới</label><select id="hec-preset-${mountId}" data-hec-preset>${Object.values(SOCIAL_PRESETS).map((preset) => `<option value="${preset.id}">${escapeHtml(preset.label)} · ${preset.width} x ${preset.height}</option>`).join("")}</select><button type="button" data-hec-action="add-preset" aria-label="Thêm artboard từ preset" title="Thêm artboard">+</button></div></section><section class="hec-section"><div class="hec-heading"><h3>Capability</h3></div><ul class="hec-capabilities" data-hec-capabilities>${capabilityMarkup(capabilities)}</ul></section></aside><section class="hec-work" aria-label="Batch export queue"><div class="hec-workbar"><button type="button" class="hec-btn" data-hec-action="enqueue">Thêm vào queue</button><button type="button" class="hec-btn" data-hec-action="clear">Dọn đã xong</button><span class="hec-badge" data-hec-queue-count>0 job</span></div><div class="hec-queue" data-hec-queue></div><div class="hec-preview"><div class="hec-canvas-wrap"><canvas data-hec-preview aria-label="Xem trước artboard xuất"></canvas></div><div class="hec-preview-copy"><strong data-hec-preview-name></strong><span data-hec-preview-meta></span><span>Preview dùng cùng Canvas renderer với bản raster.</span></div></div></section><aside class="hec-panel" aria-label="Thiết lập và preflight"><section class="hec-section"><div class="hec-heading"><h2>Thiết lập</h2></div><div class="hec-stack"><label class="hec-field">Tên project<input data-hec-setting="projectName" maxlength="180"></label><label class="hec-field">Định dạng<select data-hec-setting="format">${Object.values(FORMATS).map((format) => `<option value="${format.id}" ${capabilities[format.id].supported ? "" : "disabled"}>${escapeHtml(format.label)}${capabilities[format.id].supported ? "" : " · không hỗ trợ"}</option>`).join("")}</select></label><fieldset class="hec-field"><legend>Tỉ lệ</legend><div class="hec-scale" role="radiogroup" aria-label="Tỉ lệ xuất">${[1, 2, 3].map((scale) => `<label><input type="radio" name="hec-scale-${mountId}" value="${scale}" data-hec-scale><span>${scale}x</span></label>`).join("")}</div></fieldset><label class="hec-field">Chất lượng<div class="hec-quality"><input type="range" min="0.1" max="1" step="0.01" data-hec-setting="quality"><output data-hec-quality></output></div></label><label class="hec-field">Quy tắc đặt tên<input data-hec-setting="namingRule" maxlength="240" spellcheck="false"></label></div></section><section class="hec-section"><div class="hec-heading"><h3>Watermark</h3></div><label class="hec-check"><input type="checkbox" data-hec-watermark="enabled"><span>Bật watermark</span></label><div class="hec-stack hec-watermark-fields" data-hec-watermark-fields><label class="hec-field">Nội dung<input data-hec-watermark="text" maxlength="180"></label><label class="hec-field">Vị trí<select data-hec-watermark="position"><option value="top-left">Trên trái</option><option value="top-right">Trên phải</option><option value="bottom-left">Dưới trái</option><option value="bottom-right">Dưới phải</option><option value="center">Giữa</option></select></label><label class="hec-field">Độ mờ<input type="range" min="0.02" max="1" step="0.01" data-hec-watermark="opacity"></label></div></section><section class="hec-section"><div class="hec-heading"><h3>Preflight</h3><span data-hec-preflight-count></span></div><div class="hec-issues" data-hec-issues></div></section></aside></main><footer class="hec-footer"><span>Local-first · ${escapeHtml(STORAGE_KEY)}</span><span>${escapeHtml(MANIFEST_FORMAT)} v${VERSION}</span><span role="status" aria-live="polite" data-hec-status>Sẵn sàng.</span></footer>`;

    const qs = (selector) => root.querySelector(selector);
    const statusLabels = { queued: "Đang chờ", running: "Đang xuất", completed: "Hoàn tất", failed: "Thất bại", canceled: "Đã hủy" };
    let queue;
    let unsubscribe = () => {};

    function announce(message) {
      const status = qs("[data-hec-status]");
      if (status) status.textContent = message;
    }

    function persist(jobs) {
      const saved = saveWorkspace({ project, settings, selectedIds: [...selectedIds], jobs: jobs || queue?.snapshot?.() || [] }, storage);
      if (!saved.ok && saved.reason !== "unsupported") announce("Không thể lưu workspace cục bộ.");
      return saved;
    }

    function renderArtboards() {
      qs("[data-hec-artboards]").innerHTML = project.artboards.map((artboard) => `<label class="hec-artboard"><input type="checkbox" value="${escapeHtml(artboard.id)}" data-hec-artboard ${selectedIds.has(artboard.id) ? "checked" : ""}><span><strong>${escapeHtml(artboard.name)}</strong><small>${artboard.width} x ${artboard.height}</small></span><code>${escapeHtml(artboard.presetId)}</code></label>`).join("");
      qs("[data-hec-selection-count]").textContent = `${selectedIds.size}/${project.artboards.length}`;
      const all = qs("[data-hec-select-all]");
      all.checked = selectedIds.size === project.artboards.length;
      all.indeterminate = selectedIds.size > 0 && selectedIds.size < project.artboards.length;
    }

    function renderPreview() {
      const artboard = project.artboards.find((item) => item.id === activeArtboardId) || project.artboards.find((item) => selectedIds.has(item.id)) || project.artboards[0];
      if (!artboard) return;
      activeArtboardId = artboard.id;
      const previewScale = Math.min(0.34, 360 / artboard.width, 190 / artboard.height);
      renderArtboard(qs("[data-hec-preview]"), artboard, { settings, scale: previewScale });
      qs("[data-hec-preview-name]").textContent = artboard.name;
      qs("[data-hec-preview-meta]").textContent = `${artboard.width} x ${artboard.height} · ${settings.format.toUpperCase()} · ${settings.scale}x`;
    }

    function renderPreflight() {
      const container = qs("[data-hec-issues]");
      qs("[data-hec-preflight-count]").textContent = `${preflight.errors.length} lỗi · ${preflight.warnings.length} cảnh báo`;
      container.innerHTML = preflight.issues.length ? preflight.issues.map((issue) => `<div class="hec-issue" data-level="${issue.level}"><strong>${issue.level === "error" ? "Lỗi" : "Cảnh báo"} · ${escapeHtml(issue.code)}</strong><br>${escapeHtml(issue.message)}</div>`).join("") : `<div class="hec-ok">Không phát hiện vấn đề trước khi xuất.</div>`;
    }

    function renderQueue(jobs) {
      const list = qs("[data-hec-queue]");
      qs("[data-hec-queue-count]").textContent = `${jobs.length} job`;
      if (!jobs.length) {
        list.innerHTML = `<div class="hec-empty"><span>Queue đang trống.<br>Chọn nhiều artboard rồi thêm một batch.</span></div>`;
        return;
      }
      list.innerHTML = jobs.map((job) => {
        const canCancel = ["queued", "running"].includes(job.status);
        const canRetry = ["failed", "canceled"].includes(job.status);
        const error = job.error ? ` · ${job.error.message}` : "";
        return `<article class="hec-job" data-hec-job="${escapeHtml(job.id)}"><div class="hec-job-main"><strong>${escapeHtml(job.label)}</strong><small>${escapeHtml(FORMATS[job.settings.format].label)} · ${job.settings.scale}x · lần ${job.attempts}${escapeHtml(error)}</small><progress class="hec-progress" max="100" value="${job.progress}" aria-label="Tiến độ ${escapeHtml(job.label)}">${job.progress}%</progress></div><span class="hec-job-state" data-state="${job.status}">${statusLabels[job.status]}</span><div class="hec-job-actions">${canCancel ? `<button type="button" data-hec-cancel="${escapeHtml(job.id)}" aria-label="Hủy ${escapeHtml(job.label)}" title="Hủy">×</button>` : ""}${canRetry ? `<button type="button" data-hec-retry="${escapeHtml(job.id)}" aria-label="Thử lại ${escapeHtml(job.label)}" title="Thử lại">↻</button>` : ""}${job.status !== "running" ? `<button type="button" data-hec-remove="${escapeHtml(job.id)}" aria-label="Xóa ${escapeHtml(job.label)} khỏi queue" title="Xóa">−</button>` : ""}</div></article>`;
      }).join("");
    }

    function syncControls() {
      root.querySelectorAll("[data-hec-setting]").forEach((control) => { control.value = settings[control.dataset.hecSetting]; });
      root.querySelectorAll("[data-hec-scale]").forEach((radio) => { radio.checked = Number(radio.value) === settings.scale; });
      root.querySelectorAll("[data-hec-watermark]").forEach((control) => { const value = settings.watermark[control.dataset.hecWatermark]; if (control.type === "checkbox") control.checked = value; else control.value = value; });
      qs("[data-hec-watermark-fields]").hidden = !settings.watermark.enabled;
      qs("[data-hec-quality]").textContent = `${Math.round(settings.quality * 100)}%`;
    }

    function refreshPreflight() {
      const selected = project.artboards.filter((item) => selectedIds.has(item.id));
      preflight = runPreflight(selected, { settings, document: documentRef, ...(config.preflightOptions || {}) });
      renderPreflight();
      return preflight;
    }

    queue = createExportQueue({
      jobs: workspace.jobs,
      capabilities,
      capabilityCanvas: config.capabilityCanvas,
      preflightOptions: { document: documentRef, ...(config.preflightOptions || {}) },
      environment: { ...capabilityRuntime, canvasFactory: config.canvasFactory, images: config.images },
      exporter: config.exporter,
      onResult: async (result, job) => {
        if (config.autoDownload !== false) {
          const downloaded = downloadBlob(result.blob, result.filename, capabilityRuntime);
          if (!downloaded.ok) throw new ExportCapabilityError(capabilities.download.reason, "download-unsupported");
        }
        await config.onExport?.(result, job);
      }
    });
    unsubscribe = queue.subscribe((jobs) => { renderQueue(jobs); persist(jobs); });

    function updateSettings(key, value) {
      if (key === "scale") settings.scale = Number(value);
      else if (["quality", "spriteColumns", "spritePadding", "frameDuration"].includes(key)) settings[key] = Number(value);
      else settings[key] = value;
      settings = normalizeSettings(settings);
      project = normalizeProject({ ...project, name: settings.projectName, settings });
      syncControls();
      refreshPreflight();
      renderPreview();
      persist();
    }

    function updateWatermark(key, value) {
      settings.watermark[key] = value;
      settings = normalizeSettings(settings);
      syncControls();
      refreshPreflight();
      renderPreview();
      persist();
    }

    async function startQueue() {
      const waiting = queue.snapshot().filter((job) => job.status === "queued").length;
      if (!waiting) return announce("Queue không có job đang chờ.");
      announce(`Đang xử lý ${waiting} job cục bộ...`);
      const jobs = await queue.start();
      const completed = jobs.filter((job) => job.status === "completed").length;
      const failed = jobs.filter((job) => job.status === "failed").length;
      announce(`Queue hoàn tất: ${completed} thành công, ${failed} thất bại.`);
    }

    function enqueueSelected() {
      const selected = project.artboards.filter((item) => selectedIds.has(item.id));
      if (!selected.length) return announce("Hãy chọn ít nhất một artboard.");
      const capability = capabilities[settings.format];
      if (!capability.supported) return announce(capability.reason);
      const report = refreshPreflight();
      if (!report.valid) return announce("Preflight có lỗi chặn. Hãy xử lý trước khi thêm queue.");
      const jobs = queue.enqueue(selected, { ...settings, projectName: project.name });
      announce(`Đã thêm ${jobs.length} job vào queue.`);
    }

    function downloadManifest() {
      const text = exportManifest({ project, settings, jobs: queue.snapshot(), capabilities, preflight });
      const blob = makeBlob([text], "application/json", capabilityRuntime);
      const result = downloadBlob(blob, `${slug(project.name, "project")}-export-manifest.json`, capabilityRuntime);
      announce(result.ok ? "Đã tạo export manifest." : capabilities.download.reason);
      return text;
    }

    const onClick = (event) => {
      const target = event.target.closest("button,[data-hec-artboard]");
      if (!target || !root.contains(target)) return;
      if (target.matches("[data-hec-artboard]")) activeArtboardId = target.value;
      if (target.dataset.hecCancel) { queue.cancel(target.dataset.hecCancel); return announce("Đã hủy job."); }
      if (target.dataset.hecRetry) { queue.retry(target.dataset.hecRetry); return announce("Đã đưa job trở lại queue."); }
      if (target.dataset.hecRemove) { queue.remove(target.dataset.hecRemove); return announce("Đã xóa job khỏi queue."); }
      const action = target.dataset.hecAction;
      if (action === "enqueue") return enqueueSelected();
      if (action === "start") return void startQueue();
      if (action === "clear") { const count = queue.clearCompleted(); return announce(`Đã dọn ${count} job.`); }
      if (action === "preflight") { const report = refreshPreflight(); return announce(`Preflight: ${report.errors.length} lỗi, ${report.warnings.length} cảnh báo.`); }
      if (action === "manifest") return downloadManifest();
      if (action === "add-preset") {
        const presetId = qs("[data-hec-preset]").value;
        const artboard = createSocialArtboard(presetId, { id: uid(presetId) });
        project = normalizeProject({ ...project, artboards: [...project.artboards, artboard] });
        selectedIds.add(artboard.id);
        activeArtboardId = artboard.id;
        renderArtboards(); refreshPreflight(); renderPreview(); persist();
        return announce(`Đã thêm ${SOCIAL_PRESETS[presetId].label}.`);
      }
    };

    const onChange = (event) => {
      const target = event.target;
      if (target.matches("[data-hec-artboard]")) {
        if (target.checked) selectedIds.add(target.value); else selectedIds.delete(target.value);
        if (target.checked) activeArtboardId = target.value;
        renderArtboards(); refreshPreflight(); renderPreview(); persist();
        return;
      }
      if (target.matches("[data-hec-select-all]")) {
        selectedIds = new Set(target.checked ? project.artboards.map((item) => item.id) : []);
        renderArtboards(); refreshPreflight(); renderPreview(); persist();
        return;
      }
      if (target.matches("[data-hec-scale]")) return updateSettings("scale", target.value);
      if (target.dataset.hecSetting) return updateSettings(target.dataset.hecSetting, target.value);
      if (target.dataset.hecWatermark) return updateWatermark(target.dataset.hecWatermark, target.type === "checkbox" ? target.checked : target.value);
    };

    const onInput = (event) => {
      const target = event.target;
      if (target.dataset.hecSetting && target.type !== "select-one") updateSettings(target.dataset.hecSetting, target.value);
      if (target.dataset.hecWatermark && target.type !== "checkbox" && target.type !== "select-one") updateWatermark(target.dataset.hecWatermark, target.value);
    };

    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void startQueue(); }
      if (event.key === "Escape") {
        const running = queue.snapshot().find((job) => job.status === "running");
        if (running) { event.preventDefault(); queue.cancel(running.id); announce("Đã hủy job đang chạy."); }
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeydown);
    renderArtboards();
    syncControls();
    renderPreflight();
    renderPreview();
    if (!capabilities[settings.format].supported) {
      settings.format = Object.keys(FORMATS).find((id) => capabilities[id].supported) || "png";
      syncControls();
      announce("Định dạng đã lưu không còn được trình duyệt hỗ trợ; đã chọn capability khả dụng.");
    }

    const controller = {
      getProject: () => cloneSerializable(project),
      setProject(next) {
        project = normalizeProject(next);
        settings = normalizeSettings({ ...project.settings, projectName: project.name });
        selectedIds = new Set(project.artboards.map((item) => item.id));
        activeArtboardId = project.artboards[0].id;
        renderArtboards(); syncControls(); refreshPreflight(); renderPreview(); persist();
      },
      getSettings: () => cloneSerializable(settings),
      setSettings(next) { settings = normalizeSettings({ ...settings, ...next }); syncControls(); refreshPreflight(); renderPreview(); persist(); },
      getQueue: () => queue.snapshot(),
      enqueue: (artboards, nextSettings) => queue.enqueue(artboards || project.artboards.filter((item) => selectedIds.has(item.id)), nextSettings || settings),
      start: startQueue,
      cancel: queue.cancel,
      retry: queue.retry,
      preflight: refreshPreflight,
      exportManifest: downloadManifest,
      unmount() {
        persist();
        unsubscribe();
        queue.dispose();
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("input", onInput);
        root.removeEventListener("keydown", onKeydown);
        root.replaceChildren();
        root.classList.remove("hec");
        root.removeAttribute("data-hh-graphic-export-center");
        instances.delete(root);
      }
    };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, MANIFEST_FORMAT, STORAGE_KEY, MAX_ASSET_BYTES, MAX_CANVAS_EDGE,
    SOCIAL_PRESETS, PRESETS: SOCIAL_PRESETS, FORMATS, ExportCapabilityError,
    escapeHtml, safeColor, normalizeFormat, normalizeArtboard, normalizeSettings, normalizeProject,
    createSocialArtboard, createDefaultProject, detectCapabilities, getFormatCapability,
    wrapText, runPreflight, preflight: runPreflight, paintArtboard, renderArtboard,
    serializeSvg, exportSVG: serializeSvg, serializeProject, renderFileName,
    exportArtboard, exportRaster, exportSpriteSheet, exportWebM, exportBatch,
    createExportQueue, createQueue: createExportQueue,
    createExportManifest, exportManifest,
    normalizeWorkspace, saveWorkspace, loadWorkspace, saveState: saveWorkspace, loadState: loadWorkspace,
    downloadBlob, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicExportCenter = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
