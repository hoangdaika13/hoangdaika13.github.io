(function initSocialMediaPipeline(root) {
  "use strict";

  const SCHEMA_VERSION = 6;
  const DB_NAME = "hh-social-media-pipeline-v1";
  const STORE = "checkpoints";
  const DB_VERSION = 2;
  const MEBIBYTE = 1024 * 1024;
  const DEFAULT_LIMITS = Object.freeze({
    imageBytes: 50 * MEBIBYTE,
    videoBytes: 2 * 1024 * MEBIBYTE,
    localVideoBytes: 64 * MEBIBYTE,
    localVideoSeconds: 120,
    maxDimension: 8192
  });

  const IMAGE_MIME_TYPES = Object.freeze([
    "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"
  ]);
  const VIDEO_MIME_TYPES = Object.freeze([
    "video/mp4", "video/webm", "video/quicktime", "video/x-m4v"
  ]);
  const DOCUMENT_MIME_TYPES = Object.freeze([
    "text/plain", "text/csv", "application/json"
  ]);

  const TARGETS = deepFreeze([
    { id: "instagram-post", platform: "instagram", label: "Instagram dọc", width: 1080, height: 1350, ratio: "4:5", safeArea: { top: 0.04, right: 0.04, bottom: 0.045, left: 0.04 } },
    { id: "instagram-square", platform: "instagram", label: "Instagram vuông", width: 1080, height: 1080, ratio: "1:1", safeArea: { top: 0.04, right: 0.04, bottom: 0.04, left: 0.04 } },
    { id: "instagram-story", platform: "instagram", label: "Instagram Story", width: 1080, height: 1920, ratio: "9:16", safeArea: { top: 0.0625, right: 0.0741, bottom: 0.1354, left: 0.0741 } },
    { id: "tiktok", platform: "tiktok", label: "TikTok", width: 1080, height: 1920, ratio: "9:16", safeArea: { top: 0.0625, right: 0.0741, bottom: 0.1354, left: 0.0741 } },
    { id: "youtube-thumbnail", platform: "youtube", label: "YouTube thumbnail", width: 1280, height: 720, ratio: "16:9", safeArea: { top: 0.0556, right: 0.03125, bottom: 0.0834, left: 0.03125 } },
    { id: "youtube-short", platform: "youtube", label: "YouTube Short", width: 1080, height: 1920, ratio: "9:16", safeArea: { top: 0.0625, right: 0.0741, bottom: 0.1354, left: 0.0741 } },
    { id: "facebook", platform: "facebook", label: "Facebook link", width: 1200, height: 630, ratio: "1.91:1", safeArea: { top: 0.0635, right: 0.0334, bottom: 0.0953, left: 0.0334 } },
    { id: "x-landscape", platform: "x", label: "X landscape", width: 1600, height: 900, ratio: "16:9", safeArea: { top: 0.0445, right: 0.025, bottom: 0.0667, left: 0.025 } },
    { id: "linkedin", platform: "linkedin", label: "LinkedIn post", width: 1200, height: 627, ratio: "1.91:1", safeArea: { top: 0.0638, right: 0.0334, bottom: 0.0957, left: 0.0334 } },
    { id: "pinterest", platform: "pinterest", label: "Pinterest Pin", width: 1000, height: 1500, ratio: "2:3", safeArea: { top: 0.04, right: 0.04, bottom: 0.04, left: 0.04 } },
    { id: "threads", platform: "threads", label: "Threads", width: 1440, height: 1920, ratio: "3:4", safeArea: { top: 0.04, right: 0.035, bottom: 0.045, left: 0.035 } }
  ]);

  const JOB_STATUS = Object.freeze({
    QUEUED: "queued",
    HANDOFF_READY: "handoff-ready",
    UPLOADING: "uploading",
    PROCESSING: "processing",
    PAUSED: "paused",
    RETRYING: "retrying",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled"
  });

  const TERMINAL_JOB_STATES = new Set([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED]);
  const JOB_TRANSITIONS = Object.freeze({
    handoff: { from: [JOB_STATUS.QUEUED], to: JOB_STATUS.HANDOFF_READY },
    upload: { from: [JOB_STATUS.QUEUED, JOB_STATUS.HANDOFF_READY, JOB_STATUS.RETRYING], to: JOB_STATUS.UPLOADING },
    start: { from: [JOB_STATUS.QUEUED, JOB_STATUS.HANDOFF_READY, JOB_STATUS.UPLOADING, JOB_STATUS.RETRYING], to: JOB_STATUS.PROCESSING },
    pause: { from: [JOB_STATUS.QUEUED, JOB_STATUS.HANDOFF_READY, JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING, JOB_STATUS.RETRYING], to: JOB_STATUS.PAUSED },
    fail: { from: [JOB_STATUS.QUEUED, JOB_STATUS.HANDOFF_READY, JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING, JOB_STATUS.RETRYING], to: JOB_STATUS.FAILED },
    retry: { from: [JOB_STATUS.FAILED], to: JOB_STATUS.RETRYING },
    complete: { from: [JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING], to: JOB_STATUS.COMPLETED },
    cancel: { from: [JOB_STATUS.QUEUED, JOB_STATUS.HANDOFF_READY, JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING, JOB_STATUS.PAUSED, JOB_STATUS.RETRYING, JOB_STATUS.FAILED], to: JOB_STATUS.CANCELLED }
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, finite(value, min)));
  }

  function round(value, precision = 4) {
    const factor = 10 ** precision;
    return Math.round(finite(value) * factor) / factor;
  }

  function isoNow(clock) {
    const value = typeof clock === "function" ? clock() : new Date();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  }

  function capabilityError(feature) {
    const error = new Error(`${feature} không được trình duyệt hiện tại hỗ trợ.`);
    error.code = "UNSUPPORTED_BROWSER_CAPABILITY";
    error.feature = feature;
    return error;
  }

  function parseMimeType(value) {
    const raw = String(value || "").trim().toLowerCase();
    const mimeType = raw.split(";")[0].trim();
    const codecMatch = raw.match(/codecs?\s*=\s*["']?([^;"']+)/i);
    return { mimeType, codecs: codecMatch ? codecMatch[1].split(",").map((codec) => codec.trim()).filter(Boolean) : [] };
  }

  function mediaKind(mimeType) {
    const parsed = parseMimeType(mimeType).mimeType;
    if (parsed.startsWith("image/")) return "image";
    if (parsed.startsWith("video/")) return "video";
    return "document";
  }

  function validateMediaFile(file, limits = {}) {
    const settings = { ...DEFAULT_LIMITS, ...limits };
    const name = String(file?.name || "asset");
    const size = Math.max(0, finite(file?.size));
    const { mimeType, codecs } = parseMimeType(file?.type || file?.mimeType);
    const kind = mediaKind(mimeType);
    const errors = [];
    const warnings = [];
    const supported = kind === "image" ? IMAGE_MIME_TYPES.includes(mimeType) : kind === "video" ? VIDEO_MIME_TYPES.includes(mimeType) : DOCUMENT_MIME_TYPES.includes(mimeType);
    if (!mimeType) errors.push({ code: "mime-required", message: "Tệp chưa có MIME type." });
    else if (!supported) errors.push({ code: "mime-unsupported", message: `MIME ${mimeType} chưa được pipeline hỗ trợ.` });
    if (!size) errors.push({ code: "empty-file", message: "Tệp rỗng." });
    const hardLimit = kind === "video" ? settings.videoBytes : settings.imageBytes;
    if (size > hardLimit) errors.push({ code: "file-too-large", message: `${name} vượt giới hạn ${hardLimit} byte.`, actual: size, limit: hardLimit });
    if (kind === "video" && size > settings.localVideoBytes) warnings.push({ code: "worker-required", message: "Video lớn phải chuyển tới dedicated media worker." });
    if (kind === "image" && mimeType === "image/gif") warnings.push({ code: "animation-flattened", message: "Xuất canvas chỉ giữ một frame của GIF." });
    return { valid: errors.length === 0, name, size, mimeType, codecs, kind, supported, errors, warnings, offloadRequired: kind === "video" && size > settings.localVideoBytes };
  }

  function normalizeMediaMetadata(raw = {}) {
    const parsed = parseMimeType(raw.mimeType || raw.type);
    const kind = raw.kind || mediaKind(parsed.mimeType);
    const width = Math.max(0, Math.round(finite(raw.width)));
    const height = Math.max(0, Math.round(finite(raw.height)));
    const duration = kind === "video" ? Math.max(0, round(raw.duration, 3)) : null;
    const fps = kind === "video" && finite(raw.fps) > 0 ? round(raw.fps, 3) : null;
    const ratio = width && height ? round(width / height) : null;
    const orientation = !width || !height ? "unknown" : width === height ? "square" : width > height ? "landscape" : "portrait";
    const codecs = [...new Set([...(Array.isArray(raw.codecs) ? raw.codecs : []), ...parsed.codecs].map(String).filter(Boolean))];
    return {
      schemaVersion: SCHEMA_VERSION,
      kind,
      width,
      height,
      ratio,
      orientation,
      megapixels: width && height ? round((width * height) / 1000000, 2) : null,
      duration,
      fps,
      frameCountEstimate: duration && fps ? Math.round(duration * fps) : null,
      mimeType: parsed.mimeType,
      size: Math.max(0, finite(raw.size)),
      codecs,
      hasAudio: typeof raw.hasAudio === "boolean" ? raw.hasAudio : null,
      colorSpace: raw.colorSpace || null,
      rotation: [0, 90, 180, 270].includes(Number(raw.rotation)) ? Number(raw.rotation) : 0,
      probeRequired: kind === "video" && (!codecs.length || !fps)
    };
  }

  function metadataIssues(metadata, limits = {}) {
    const meta = normalizeMediaMetadata(metadata);
    const settings = { ...DEFAULT_LIMITS, ...limits };
    const issues = [];
    if (!meta.width || !meta.height) issues.push({ code: "dimensions-missing", level: "error", message: "Không đọc được kích thước media." });
    if (meta.width > settings.maxDimension || meta.height > settings.maxDimension) issues.push({ code: "dimension-too-large", level: "warning", message: "Kích thước lớn; cần worker để tránh quá tải bộ nhớ." });
    if (meta.kind === "video" && !meta.duration) issues.push({ code: "duration-missing", level: "error", message: "Không đọc được thời lượng video." });
    if (meta.kind === "video" && !meta.fps) issues.push({ code: "fps-probe-required", level: "info", message: "Trình duyệt không công bố FPS; worker cần probe chính xác." });
    if (meta.kind === "video" && !meta.codecs.length) issues.push({ code: "codec-probe-required", level: "info", message: "Worker cần probe codec chính xác." });
    return issues;
  }

  function normalizeTarget(target) {
    const source = typeof target === "string" ? TARGETS.find((item) => item.id === target) : target;
    if (!source) throw new TypeError("Target không tồn tại.");
    const width = Math.round(finite(source.width));
    const height = Math.round(finite(source.height));
    if (width < 1 || height < 1 || width > DEFAULT_LIMITS.maxDimension || height > DEFAULT_LIMITS.maxDimension) throw new RangeError("Target có kích thước không hợp lệ.");
    return { ...source, width, height, ratio: source.ratio || `${width}:${height}` };
  }

  function safeZone(target, customInsets) {
    const output = normalizeTarget(target);
    const fallback = output.width / output.height < 0.7
      ? { top: 120 / 1920, right: 80 / 1080, bottom: 260 / 1920, left: 80 / 1080 }
      : { top: 40 / output.height, right: 40 / output.width, bottom: 60 / output.height, left: 40 / output.width };
    const insets = customInsets || output.safeArea || fallback;
    const pixels = {};
    for (const edge of ["top", "right", "bottom", "left"]) {
      const basis = edge === "top" || edge === "bottom" ? output.height : output.width;
      const value = finite(insets[edge]);
      pixels[edge] = Math.round(value >= 0 && value <= 1 ? value * basis : clamp(value, 0, basis));
    }
    pixels.x = pixels.left;
    pixels.y = pixels.top;
    pixels.width = Math.max(0, output.width - pixels.left - pixels.right);
    pixels.height = Math.max(0, output.height - pixels.top - pixels.bottom);
    return pixels;
  }

  function validateSafeZone(bounds, target, customInsets) {
    const output = normalizeTarget(target);
    const zone = safeZone(output, customInsets);
    const unit = bounds?.unit === "normalized" ? "normalized" : "pixel";
    const x = finite(bounds?.x) * (unit === "normalized" ? output.width : 1);
    const y = finite(bounds?.y) * (unit === "normalized" ? output.height : 1);
    const width = Math.max(0, finite(bounds?.width) * (unit === "normalized" ? output.width : 1));
    const height = Math.max(0, finite(bounds?.height) * (unit === "normalized" ? output.height : 1));
    const violations = [];
    if (x < zone.x) violations.push("left");
    if (y < zone.y) violations.push("top");
    if (x + width > zone.x + zone.width) violations.push("right");
    if (y + height > zone.y + zone.height) violations.push("bottom");
    return { valid: violations.length === 0, violations, bounds: { x: round(x, 2), y: round(y, 2), width: round(width, 2), height: round(height, 2) }, safeZone: zone, targetId: output.id };
  }

  function normalizeCrop(crop, sourceWidth, sourceHeight) {
    const width = Math.max(1, finite(sourceWidth));
    const height = Math.max(1, finite(sourceHeight));
    if (!crop) return { x: 0, y: 0, width, height, unit: "pixel" };
    const normalized = crop.unit === "normalized";
    let x = finite(crop.x) * (normalized ? width : 1);
    let y = finite(crop.y) * (normalized ? height : 1);
    let cropWidth = finite(crop.width, normalized ? 1 : width) * (normalized ? width : 1);
    let cropHeight = finite(crop.height, normalized ? 1 : height) * (normalized ? height : 1);
    x = clamp(x, 0, width - 1);
    y = clamp(y, 0, height - 1);
    cropWidth = clamp(cropWidth, 1, width - x);
    cropHeight = clamp(cropHeight, 1, height - y);
    return { x: round(x, 3), y: round(y, 3), width: round(cropWidth, 3), height: round(cropHeight, 3), unit: "pixel" };
  }

  function calculateDrawPlan(source, target, options = {}) {
    const sourceWidth = Math.max(1, finite(source?.width));
    const sourceHeight = Math.max(1, finite(source?.height));
    const output = normalizeTarget(target);
    const base = normalizeCrop(options.crop, sourceWidth, sourceHeight);
    const fit = ["cover", "contain", "fill"].includes(options.fit) ? options.fit : "cover";
    const focalX = clamp(options.focalX ?? 0.5, 0, 1);
    const focalY = clamp(options.focalY ?? 0.5, 0, 1);
    let sx = base.x;
    let sy = base.y;
    let sw = base.width;
    let sh = base.height;
    let dx = finite(options.offsetX);
    let dy = finite(options.offsetY);
    let dw = output.width;
    let dh = output.height;
    if (fit === "cover") {
      const sourceRatio = base.width / base.height;
      const targetRatio = output.width / output.height;
      if (sourceRatio > targetRatio) {
        sw = base.height * targetRatio;
        sx = base.x + (base.width - sw) * focalX;
      } else {
        sh = base.width / targetRatio;
        sy = base.y + (base.height - sh) * focalY;
      }
    } else if (fit === "contain") {
      const scale = Math.min(output.width / base.width, output.height / base.height);
      dw = base.width * scale;
      dh = base.height * scale;
      dx += (output.width - dw) / 2;
      dy += (output.height - dh) / 2;
    }
    return { fit, source: { x: round(sx, 3), y: round(sy, 3), width: round(sw, 3), height: round(sh, 3) }, destination: { x: round(dx, 3), y: round(dy, 3), width: round(dw, 3), height: round(dh, 3) }, target: output };
  }

  function normalizeVariantOptions(options = {}) {
    const type = ["image/webp", "image/jpeg", "image/png"].includes(options.type) ? options.type : "image/webp";
    return {
      fit: ["cover", "contain", "fill"].includes(options.fit) ? options.fit : "cover",
      type,
      quality: type === "image/png" ? 1 : clamp(options.quality ?? 0.86, 0.35, 1),
      background: /^#[0-9a-f]{3,8}$/i.test(String(options.background || "")) ? options.background : "#07131f",
      focalX: clamp(options.focalX ?? 0.5, 0, 1),
      focalY: clamp(options.focalY ?? 0.5, 0, 1),
      offsetX: finite(options.offsetX),
      offsetY: finite(options.offsetY),
      crop: options.crop || null
    };
  }

  function buildBatchVariantPlan(metadata, targets = TARGETS, options = {}) {
    const meta = normalizeMediaMetadata(metadata);
    if (meta.kind !== "image" || !meta.width || !meta.height) throw new TypeError("Batch variant cần metadata ảnh hợp lệ.");
    const variantOptions = normalizeVariantOptions(options);
    const seen = new Set();
    const variants = targets.map(normalizeTarget).filter((target) => {
      if (seen.has(target.id)) return false;
      seen.add(target.id);
      return true;
    }).map((target) => ({
      id: `${target.id}-${target.width}x${target.height}`,
      target,
      draw: calculateDrawPlan(meta, target, variantOptions),
      safeZone: safeZone(target),
      output: { type: variantOptions.type, quality: variantOptions.quality, extension: variantOptions.type === "image/png" ? "png" : variantOptions.type === "image/jpeg" ? "jpg" : "webp" }
    }));
    return { schemaVersion: SCHEMA_VERSION, source: meta, options: variantOptions, variants, totalPixels: variants.reduce((sum, item) => sum + item.target.width * item.target.height, 0) };
  }

  function estimateCompression(inputBytes, outputBytes) {
    const input = Math.max(0, finite(inputBytes));
    const output = Math.max(0, finite(outputBytes));
    return { inputBytes: input, outputBytes: output, savedBytes: Math.max(0, input - output), ratio: input ? round(output / input, 4) : null, savingPercent: input ? round(Math.max(0, (1 - output / input) * 100), 2) : null };
  }

  function requireCanvas() {
    if (!root.document?.createElement || typeof root.createImageBitmap !== "function") throw capabilityError("Canvas/CreateImageBitmap");
  }

  async function inspectImage(file) {
    if (typeof root.createImageBitmap !== "function") throw capabilityError("CreateImageBitmap");
    const bitmap = await root.createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return normalizeMediaMetadata({ kind: "image", width: bitmap.width, height: bitmap.height, mimeType: file.type, size: file.size, colorSpace: bitmap.colorSpace || null });
    } finally {
      bitmap.close?.();
    }
  }

  async function inspectVideo(file, options = {}) {
    if (!root.document?.createElement || !root.URL?.createObjectURL) throw capabilityError("HTMLVideoElement/ObjectURL");
    const url = root.URL.createObjectURL(file);
    const video = root.document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const timeoutMs = clamp(options.timeoutMs ?? 15000, 1000, 60000);
    return new Promise((resolve, reject) => {
      let timeout;
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeAttribute?.("src");
        video.load?.();
        root.URL.revokeObjectURL(url);
      };
      video.onloadedmetadata = () => {
        const parsed = parseMimeType(file.type);
        const result = normalizeMediaMetadata({ kind: "video", width: video.videoWidth, height: video.videoHeight, duration: video.duration, mimeType: file.type, size: file.size, codecs: parsed.codecs });
        cleanup();
        resolve(result);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("Không đọc được metadata video."));
      };
      timeout = setTimeout(() => {
        cleanup();
        const error = new Error("Đọc metadata video quá thời gian cho phép.");
        error.code = "MEDIA_METADATA_TIMEOUT";
        reject(error);
      }, timeoutMs);
    });
  }

  async function inspectFile(file, options) {
    const validation = validateMediaFile(file, options?.limits);
    if (!validation.valid) {
      const error = new Error(validation.errors.map((item) => item.message).join(" "));
      error.code = "INVALID_MEDIA_FILE";
      error.validation = validation;
      throw error;
    }
    const metadata = validation.kind === "image"
      ? await inspectImage(file)
      : validation.kind === "video"
        ? await inspectVideo(file, options)
        : normalizeMediaMetadata({ kind: "document", mimeType: validation.mimeType, size: validation.size });
    return { ...metadata, validationWarnings: validation.warnings, issues: metadataIssues(metadata, options?.limits) };
  }

  async function imageVariant(file, target, options = {}) {
    requireCanvas();
    const bitmap = await root.createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const output = normalizeTarget(target);
      const normalized = normalizeVariantOptions(options);
      const draw = calculateDrawPlan({ width: bitmap.width, height: bitmap.height }, output, normalized);
      const canvas = root.document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d", { alpha: normalized.type === "image/png" });
      if (!context) throw capabilityError("CanvasRenderingContext2D");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = normalized.background;
      context.fillRect(0, 0, output.width, output.height);
      const source = draw.source;
      const destination = draw.destination;
      context.drawImage(bitmap, source.x, source.y, source.width, source.height, destination.x, destination.y, destination.width, destination.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Trình duyệt không thể mã hóa biến thể ảnh.")), normalized.type, normalized.quality));
      return { blob, target: output, draw, safeZone: safeZone(output), size: blob.size, type: blob.type, compression: estimateCompression(file.size, blob.size) };
    } finally {
      bitmap.close?.();
    }
  }

  async function batchImageVariants(file, targets = TARGETS, options = {}) {
    const metadata = await inspectImage(file);
    const plan = buildBatchVariantPlan(metadata, targets, options);
    const results = [];
    for (const variant of plan.variants) {
      results.push({ id: variant.id, ...(await imageVariant(file, variant.target, plan.options)) });
    }
    return { plan, results, totalBytes: results.reduce((sum, item) => sum + item.size, 0) };
  }

  async function compressImageWebP(file, options = {}) {
    const meta = await inspectImage(file);
    const maxWidth = Math.max(1, Math.round(finite(options.maxWidth, meta.width)));
    const maxHeight = Math.max(1, Math.round(finite(options.maxHeight, meta.height)));
    const scale = Math.min(1, maxWidth / meta.width, maxHeight / meta.height);
    const target = { id: options.id || "webp-compressed", width: Math.max(1, Math.round(meta.width * scale)), height: Math.max(1, Math.round(meta.height * scale)), ratio: `${meta.width}:${meta.height}`, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } };
    return imageVariant(file, target, { ...options, type: "image/webp", fit: "contain", background: options.background || "#00000000" });
  }

  async function posterFrame(file, time = 0, options = {}) {
    if (!root.document?.createElement || !root.URL?.createObjectURL) throw capabilityError("HTMLVideoElement/ObjectURL");
    const url = root.URL.createObjectURL(file);
    const video = root.document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const timeoutMs = clamp(options.timeoutMs ?? 30000, 1000, 60000);
    return new Promise((resolve, reject) => {
      let timeout;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeAttribute?.("src");
        video.load?.();
        root.URL.revokeObjectURL(url);
      };
      const fail = (message, code = "POSTER_FRAME_FAILED") => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(message);
        error.code = code;
        reject(error);
      };
      video.onloadedmetadata = () => {
        const requested = clamp(time, 0, Math.max(0, finite(video.duration) - 0.05));
        if (!video.videoWidth || !video.videoHeight) return fail("Video không có frame hình ảnh.");
        video.currentTime = requested;
      };
      video.onseeked = () => {
        if (settled) return;
        const canvas = root.document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) return fail("Không tạo được canvas poster frame.");
        context.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return fail("Không mã hóa được poster frame.");
          settled = true;
          const result = { blob, width: canvas.width, height: canvas.height, time: round(video.currentTime, 3), type: blob.type };
          cleanup();
          resolve(result);
        }, options.type || "image/jpeg", clamp(options.quality ?? 0.88, 0.35, 1));
      };
      video.onerror = () => fail("Không tạo được poster frame.");
      timeout = setTimeout(() => fail("Tạo poster frame quá thời gian cho phép.", "POSTER_FRAME_TIMEOUT"), timeoutMs);
    });
  }

  async function capturePosterFrames(file, times = [0], options = {}) {
    const uniqueTimes = [...new Set(times.map((time) => Math.max(0, round(time, 3))))].slice(0, 20);
    const frames = [];
    for (const time of uniqueTimes) frames.push(await posterFrame(file, time, options));
    return frames;
  }

  function getCrypto() {
    if (root.crypto?.subtle) return root.crypto;
    if (typeof require === "function") {
      try { return require("node:crypto").webcrypto; } catch (_) { /* Browser build: no Node fallback. */ }
    }
    throw capabilityError("Web Crypto SHA-256");
  }

  async function checksumSha256(input) {
    let buffer;
    if (input instanceof ArrayBuffer) buffer = input;
    else if (ArrayBuffer.isView(input)) buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    else if (input?.arrayBuffer) buffer = await input.arrayBuffer();
    else if (typeof input === "string") buffer = new TextEncoder().encode(input).buffer;
    else throw new TypeError("SHA-256 cần Blob, ArrayBuffer, TypedArray hoặc chuỗi.");
    const digest = await getCrypto().subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function assetFingerprint(asset = {}) {
    return [String(asset.name || "").trim().toLowerCase(), Math.max(0, finite(asset.size)), String(asset.mimeType || asset.type || "").toLowerCase(), Math.max(0, finite(asset.lastModified))].join(":");
  }

  function findDuplicateAsset(assets = [], candidate = {}) {
    const sha256 = String(candidate.sha256 || "").toLowerCase();
    const fingerprint = assetFingerprint(candidate);
    return assets.find((asset) => sha256 && String(asset.sha256 || "").toLowerCase() === sha256) || assets.find((asset) => !sha256 && assetFingerprint(asset) === fingerprint) || null;
  }

  function deduplicateAssets(assets = []) {
    const unique = [];
    const duplicates = [];
    for (const asset of assets) {
      const duplicateOf = findDuplicateAsset(unique, asset);
      if (duplicateOf) duplicates.push({ asset, duplicateOf });
      else unique.push(asset);
    }
    return { unique, duplicates };
  }

  function rightsManifest(asset = {}, meta = {}, ownerId, workspaceId, options = {}) {
    const confirmed = asset.rightsConfirmed === true;
    return {
      schemaVersion: SCHEMA_VERSION,
      policyVersion: options.policyVersion || "hh-media-rights-2026-01",
      assetId: asset.id || null,
      name: asset.name || null,
      sha256: asset.sha256 || null,
      sourceType: asset.sourceType || "user-upload",
      sourceUrl: asset.sourceUrl || null,
      creator: asset.creator || ownerId || null,
      ownerId: ownerId || asset.ownerId || null,
      workspaceId: workspaceId || asset.workspaceId || null,
      license: asset.license || "user-attested",
      attribution: asset.attribution || null,
      territories: Array.isArray(asset.territories) && asset.territories.length ? [...asset.territories] : ["worldwide"],
      expiresAt: asset.rightsExpiresAt || null,
      rightsConfirmed: confirmed,
      commercialUseConfirmed: asset.commercialUseConfirmed === true,
      thirdPartyElementsReviewed: asset.thirdPartyElementsReviewed === true,
      aiGenerated: asset.aiGenerated === true,
      evidence: Array.isArray(asset.rightsEvidence) ? asset.rightsEvidence.map((item) => ({ type: item.type || "reference", url: item.url || null, note: item.note || null })) : [],
      metadata: normalizeMediaMetadata(meta),
      confirmedAt: confirmed ? (asset.rightsConfirmedAt || options.confirmedAt || isoNow(options.clock)) : null
    };
  }

  function validateRightsManifest(manifest, options = {}) {
    const strictCommercial = options.strictCommercial !== false;
    const errors = [];
    const warnings = [];
    if (!manifest || typeof manifest !== "object") return { valid: false, errors: [{ code: "manifest-required", message: "Rights manifest là bắt buộc." }], warnings };
    for (const field of ["assetId", "sha256", "ownerId", "workspaceId", "sourceType", "license"]) if (!manifest[field]) errors.push({ code: `${field}-required`, field, message: `Thiếu ${field}.` });
    if (manifest.sha256 && !/^[a-f0-9]{64}$/i.test(manifest.sha256)) errors.push({ code: "sha256-invalid", field: "sha256", message: "SHA-256 không hợp lệ." });
    if (manifest.rightsConfirmed !== true) errors.push({ code: "rights-unconfirmed", field: "rightsConfirmed", message: "Chưa xác nhận quyền sử dụng." });
    if (strictCommercial && manifest.commercialUseConfirmed !== true) errors.push({ code: "commercial-use-unconfirmed", field: "commercialUseConfirmed", message: "Chưa xác nhận quyền thương mại." });
    if (manifest.thirdPartyElementsReviewed !== true) errors.push({ code: "third-party-review-required", field: "thirdPartyElementsReviewed", message: "Chưa rà soát thành phần bên thứ ba." });
    if (manifest.expiresAt && Number.isNaN(Date.parse(manifest.expiresAt))) errors.push({ code: "expiry-invalid", field: "expiresAt", message: "Ngày hết hạn quyền không hợp lệ." });
    if (manifest.expiresAt && !Number.isNaN(Date.parse(manifest.expiresAt)) && Date.parse(manifest.expiresAt) <= finite(options.now, Date.now())) errors.push({ code: "rights-expired", field: "expiresAt", message: "Quyền sử dụng đã hết hạn." });
    if (manifest.license === "attribution" && !manifest.attribution) errors.push({ code: "attribution-required", field: "attribution", message: "License yêu cầu attribution." });
    if (!manifest.evidence?.length) warnings.push({ code: "evidence-missing", message: "Nên đính kèm bằng chứng quyền sử dụng." });
    return { valid: errors.length === 0, errors, warnings };
  }

  function assertRightsManifest(manifest, options) {
    const validation = validateRightsManifest(manifest, options);
    if (!validation.valid) {
      const error = new Error(validation.errors.map((item) => item.message).join(" "));
      error.code = "RIGHTS_MANIFEST_INVALID";
      error.validation = validation;
      throw error;
    }
    return manifest;
  }

  function offloadDecision(asset = {}, meta = {}, options = {}) {
    const metadata = normalizeMediaMetadata({ ...meta, mimeType: meta.mimeType || asset.mimeType, size: meta.size || asset.size });
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    const reasons = [];
    if (metadata.kind === "video" && metadata.size > limits.localVideoBytes) reasons.push("video-size");
    if (metadata.kind === "video" && metadata.duration && metadata.duration > limits.localVideoSeconds) reasons.push("video-duration");
    if (metadata.kind === "video" && metadata.width * metadata.height > 1920 * 1080) reasons.push("video-resolution");
    if (metadata.kind === "video" && (options.transcode === true || options.operation === "transcode")) reasons.push("transcode");
    if (metadata.kind === "image" && metadata.width * metadata.height > 40_000_000) reasons.push("image-memory");
    return { required: reasons.length > 0, reasons: [...new Set(reasons)], mode: reasons.length ? "dedicated-media-worker" : "browser-local", allowVercel: reasons.length === 0 && metadata.kind !== "video" };
  }

  function shouldOffload(asset, meta, options) {
    return offloadDecision(asset, meta, options).required;
  }

  function stableJobId(asset, operation = "transcode") {
    const identity = asset.sha256 || asset.id || assetFingerprint(asset);
    return `media-${operation}-${String(identity).replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "asset"}`;
  }

  function createMediaJob({ asset = {}, metadata = {}, targets = TARGETS, operation = "transcode", maxAttempts = 3, id, clock } = {}) {
    const meta = normalizeMediaMetadata({ ...metadata, mimeType: metadata.mimeType || asset.mimeType, size: metadata.size || asset.size });
    const decision = offloadDecision(asset, meta, { operation, transcode: operation === "transcode" });
    const timestamp = isoNow(clock);
    return {
      schemaVersion: SCHEMA_VERSION,
      id: id || stableJobId(asset, operation),
      idempotencyKey: `${operation}:${asset.sha256 || asset.id || assetFingerprint(asset)}`,
      assetId: asset.id || null,
      sha256: asset.sha256 || null,
      operation,
      status: JOB_STATUS.QUEUED,
      resumeFrom: null,
      progress: 0,
      attempt: 0,
      maxAttempts: Math.max(1, Math.round(finite(maxAttempts, 3))),
      error: null,
      metadata: meta,
      targets: targets.map(normalizeTarget),
      execution: { mode: decision.mode, allowVercel: false, reasons: decision.reasons, workerRequired: meta.kind === "video" || decision.required },
      history: [{ status: JOB_STATUS.QUEUED, at: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function transitionMediaJob(job, action, details = {}) {
    if (!job || typeof job !== "object") throw new TypeError("Media job không hợp lệ.");
    const command = String(action || "").toLowerCase();
    const timestamp = isoNow(details.clock);
    if (command === "progress") {
      if (![JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING].includes(job.status)) throw new Error(`Không thể cập nhật tiến trình khi job ở trạng thái ${job.status}.`);
      const progress = clamp(details.progress, job.progress || 0, 99.99);
      return { ...job, progress, updatedAt: timestamp, history: [...(job.history || []), { status: job.status, progress, at: timestamp }] };
    }
    if (command === "resume") {
      if (job.status !== JOB_STATUS.PAUSED) throw new Error(`Không thể resume job ở trạng thái ${job.status}.`);
      const status = [JOB_STATUS.UPLOADING, JOB_STATUS.PROCESSING, JOB_STATUS.RETRYING].includes(job.resumeFrom) ? job.resumeFrom : JOB_STATUS.HANDOFF_READY;
      return { ...job, status, resumeFrom: null, updatedAt: timestamp, history: [...(job.history || []), { status, action: "resume", at: timestamp }] };
    }
    const transition = JOB_TRANSITIONS[command];
    if (!transition || !transition.from.includes(job.status)) throw new Error(`Chuyển trạng thái ${command} không hợp lệ từ ${job.status}.`);
    if (command === "retry" && finite(job.attempt) >= finite(job.maxAttempts, 3)) {
      const error = new Error("Media job đã vượt số lần retry tối đa.");
      error.code = "MEDIA_JOB_RETRY_EXHAUSTED";
      throw error;
    }
    const next = {
      ...job,
      status: transition.to,
      resumeFrom: command === "pause" ? job.status : null,
      progress: command === "complete" ? 100 : job.progress,
      attempt: command === "retry" ? finite(job.attempt) + 1 : job.attempt,
      error: command === "fail" ? { code: details.code || "WORKER_FAILED", message: details.message || "Media worker thất bại.", retryable: details.retryable !== false } : command === "retry" ? null : job.error,
      updatedAt: timestamp
    };
    next.history = [...(job.history || []), { status: next.status, action: command, progress: next.progress, error: next.error, at: timestamp }];
    return next;
  }

  function pauseMediaJob(job, details) { return transitionMediaJob(job, "pause", details); }
  function resumeMediaJob(job, details) { return transitionMediaJob(job, "resume", details); }
  function retryMediaJob(job, details) { return transitionMediaJob(job, "retry", details); }

  function createWorkerHandoff(job, options = {}) {
    if (!job || !job.id) throw new TypeError("Cần media job để tạo handoff.");
    const updated = job.status === JOB_STATUS.QUEUED ? transitionMediaJob(job, "handoff", options) : job;
    return {
      schemaVersion: SCHEMA_VERSION,
      mode: "dedicated-media-worker",
      status: "checkpoint-ready",
      job: updated,
      transport: {
        uploadStrategy: options.uploadStrategy || "resumable-object-storage",
        sourceUrl: options.sourceUrl || null,
        callbackUrl: options.callbackUrl || null,
        chunkBytes: Math.max(MEBIBYTE, Math.round(finite(options.chunkBytes, 8 * MEBIBYTE)))
      },
      security: { signedUrlsRequired: true, secretsInPayload: false },
      constraints: { allowVercelExecution: false, heartbeatSeconds: 15, checkpointEveryPercent: 5 },
      note: "Video được upload resumable vào object storage; dedicated worker probe/transcode và ghi tiến trình. Không truyền video lớn xuyên request Vercel."
    };
  }

  function transcodeHandoff(asset, meta, targets = TARGETS, options = {}) {
    const job = createMediaJob({ asset, metadata: meta, targets, operation: "transcode", maxAttempts: options.maxAttempts, id: options.id, clock: options.clock });
    const handoff = createWorkerHandoff(job, options);
    return { ...handoff, assetId: asset.id || null, input: { name: asset.name || null, sha256: asset.sha256 || null, mimeType: asset.mimeType || meta.mimeType || null, size: asset.size || meta.size || 0, metadata: normalizeMediaMetadata(meta) }, operations: handoff.job.targets.map((target) => ({ operation: "transcode", target, videoCodec: options.videoCodec || "h264", audioCodec: options.audioCodec || "aac", safeZone: safeZone(target) })) };
  }

  function isVercelEnvironment(environment = {}) {
    if (typeof environment === "string") return /vercel|serverless/i.test(environment);
    return environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV) || /vercel/i.test(String(environment.runtime || environment.provider || ""));
  }

  function assertWorkerEnvironment(jobOrHandoff, environment = {}) {
    const job = jobOrHandoff?.job || jobOrHandoff;
    if (isVercelEnvironment(environment) && (job?.metadata?.kind === "video" || job?.execution?.workerRequired)) {
      const error = new Error("Video transform bị chặn trên Vercel; hãy gửi job tới dedicated media worker.");
      error.code = "VERCEL_MEDIA_PROCESSING_BLOCKED";
      throw error;
    }
    return true;
  }

  function buildMediaPipelinePlan({ asset = {}, metadata = {}, targets = TARGETS, options = {}, ownerId, workspaceId } = {}) {
    const meta = normalizeMediaMetadata({ ...metadata, mimeType: metadata.mimeType || asset.mimeType, size: metadata.size || asset.size });
    const rights = rightsManifest(asset, meta, ownerId, workspaceId, options.rights || {});
    const rightsValidation = validateRightsManifest(rights, { strictCommercial: options.strictCommercial });
    const execution = offloadDecision(asset, meta, { ...options, operation: meta.kind === "video" ? "transcode" : "resize" });
    const phases = ["validate-mime", "read-metadata", "checksum-dedup", "crop-resize", "generate-variants", "check-safe-zones"];
    if (meta.kind === "video") phases.push("poster-frame", "worker-transcode");
    else phases.push("webp-compression");
    phases.push("rights-review", rightsValidation.valid ? "export-or-queue" : "await-rights-confirmation");
    return { schemaVersion: SCHEMA_VERSION, assetId: asset.id || null, metadata: meta, targets: targets.map(normalizeTarget), phases, execution, rights, rightsValidation, ready: rightsValidation.valid && !metadataIssues(meta).some((issue) => issue.level === "error") };
  }

  function openDb() {
    if (!root.indexedDB) return Promise.reject(capabilityError("IndexedDB"));
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE) ? request.transaction.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: "id" });
        if (!store.indexNames.contains("workspace")) store.createIndex("workspace", ["ownerId", "workspaceId"], { unique: false });
        if (!store.indexNames.contains("updatedAt")) store.createIndex("updatedAt", "updatedAt", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB."));
      request.onblocked = () => reject(new Error("Nâng cấp IndexedDB đang bị tab khác chặn."));
    });
  }

  async function withStore(mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      let result;
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Giao dịch IndexedDB thất bại.")); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Giao dịch IndexedDB bị hủy.")); };
      try { result = operation(transaction.objectStore(STORE), transaction); } catch (error) { transaction.abort(); reject(error); }
    });
  }

  async function checkpointPut(value) {
    if (!value?.id) throw new TypeError("Checkpoint cần id.");
    await withStore("readwrite", (store) => store.put({ ...value, schemaVersion: SCHEMA_VERSION }));
    return { ...value, schemaVersion: SCHEMA_VERSION };
  }

  async function checkpointGet(id) {
    if (!id) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error || new Error("Không đọc được checkpoint.")); };
    });
  }

  async function checkpointDelete(id) {
    await withStore("readwrite", (store) => store.delete(id));
    return true;
  }

  async function checkpointList({ ownerId, workspaceId } = {}) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const store = transaction.objectStore(STORE);
      const request = ownerId && workspaceId && store.indexNames.contains("workspace") ? store.index("workspace").getAll([ownerId, workspaceId]) : store.getAll();
      request.onsuccess = () => { db.close(); resolve((request.result || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))); };
      request.onerror = () => { db.close(); reject(request.error || new Error("Không liệt kê được checkpoint.")); };
    });
  }

  function createMemoryCheckpointStore(initial = []) {
    const records = new Map(initial.map((item) => [item.id, structuredCloneSafe(item)]));
    return {
      async put(value) { records.set(value.id, structuredCloneSafe(value)); return structuredCloneSafe(value); },
      async get(id) { return records.has(id) ? structuredCloneSafe(records.get(id)) : null; },
      async delete(id) { return records.delete(id); },
      async list({ ownerId, workspaceId } = {}) { return [...records.values()].filter((item) => (!ownerId || item.ownerId === ownerId) && (!workspaceId || item.workspaceId === workspaceId)).map(structuredCloneSafe); }
    };
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function checkpointAdapter(storage) {
    return storage || { put: checkpointPut, get: checkpointGet, delete: checkpointDelete, list: checkpointList };
  }

  async function createCheckpoint({ asset = {}, meta = {}, ownerId, workspaceId, targets = TARGETS, storage, clock } = {}) {
    if (!ownerId || !workspaceId) throw new TypeError("Checkpoint cần ownerId và workspaceId để cách ly dữ liệu.");
    if (!asset.sha256) throw new TypeError("Checkpoint cần SHA-256 của asset.");
    const id = `${ownerId}:${workspaceId}:${asset.sha256}`;
    const rights = rightsManifest(asset, meta, ownerId, workspaceId, { clock });
    const normalizedMeta = normalizeMediaMetadata(meta);
    const timestamp = isoNow(clock);
    const checkpoint = {
      id,
      schemaVersion: SCHEMA_VERSION,
      ownerId,
      workspaceId,
      assetId: asset.id || null,
      sha256: asset.sha256,
      state: validateRightsManifest(rights).valid ? "ready" : "rights-review",
      progress: 15,
      meta: normalizedMeta,
      targets: targets.map(normalizeTarget),
      rights,
      workerHandoff: normalizedMeta.kind === "video" ? transcodeHandoff(asset, normalizedMeta, targets, { clock }) : null,
      resumeCount: 0,
      lastCompletedStep: "read-metadata",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return checkpointAdapter(storage).put(checkpoint);
  }

  async function updateCheckpoint(id, changes = {}, options = {}) {
    const storage = checkpointAdapter(options.storage);
    const current = await storage.get(id);
    if (!current) throw new Error("Không tìm thấy checkpoint.");
    if (options.ownerId && current.ownerId !== options.ownerId) throw new Error("Checkpoint không thuộc owner hiện tại.");
    if (options.workspaceId && current.workspaceId !== options.workspaceId) throw new Error("Checkpoint không thuộc workspace hiện tại.");
    const progress = clamp(changes.progress ?? current.progress, current.progress || 0, 100);
    const next = { ...current, ...changes, id: current.id, ownerId: current.ownerId, workspaceId: current.workspaceId, progress, schemaVersion: SCHEMA_VERSION, updatedAt: isoNow(options.clock) };
    return storage.put(next);
  }

  async function resumeCheckpoint(id, options = {}) {
    const storage = checkpointAdapter(options.storage);
    const current = await storage.get(id);
    if (!current) return null;
    if (options.ownerId && current.ownerId !== options.ownerId) throw new Error("Checkpoint không thuộc owner hiện tại.");
    if (options.workspaceId && current.workspaceId !== options.workspaceId) throw new Error("Checkpoint không thuộc workspace hiện tại.");
    const next = { ...current, schemaVersion: SCHEMA_VERSION, state: current.state === "paused" ? (current.resumeState || "ready") : current.state, resumeState: null, resumeCount: finite(current.resumeCount) + 1, updatedAt: isoNow(options.clock) };
    return storage.put(next);
  }

  const api = {
    SCHEMA_VERSION,
    DEFAULT_LIMITS,
    IMAGE_MIME_TYPES,
    VIDEO_MIME_TYPES,
    DOCUMENT_MIME_TYPES,
    TARGETS,
    JOB_STATUS,
    parseMimeType,
    mediaKind,
    validateMediaFile,
    normalizeMediaMetadata,
    metadataIssues,
    normalizeTarget,
    safeZone,
    validateSafeZone,
    normalizeCrop,
    calculateDrawPlan,
    normalizeVariantOptions,
    buildBatchVariantPlan,
    estimateCompression,
    inspectImage,
    inspectVideo,
    inspectFile,
    imageVariant,
    batchImageVariants,
    compressImageWebP,
    posterFrame,
    capturePosterFrames,
    checksumSha256,
    assetFingerprint,
    findDuplicateAsset,
    deduplicateAssets,
    rightsManifest,
    validateRightsManifest,
    assertRightsManifest,
    offloadDecision,
    shouldOffload,
    createMediaJob,
    transitionMediaJob,
    pauseMediaJob,
    resumeMediaJob,
    retryMediaJob,
    createWorkerHandoff,
    transcodeHandoff,
    isVercelEnvironment,
    assertWorkerEnvironment,
    buildMediaPipelinePlan,
    createMemoryCheckpointStore,
    createCheckpoint,
    updateCheckpoint,
    resumeCheckpoint,
    checkpointGet,
    checkpointPut,
    checkpointDelete,
    checkpointList
  };

  root.HHSocialMediaPipeline = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialMediaPipeline;
})(typeof window !== "undefined" ? window : globalThis);
