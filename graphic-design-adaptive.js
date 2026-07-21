(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-adaptive-design";
  const STORAGE_KEY = "hh.graphic-adaptive.project.v1";
  const STYLE_ID = "hh-graphic-adaptive-style-v1";
  const MAX_HISTORY = 50;
  const MAX_BULK_BYTES = 1024 * 1024;
  const MAX_BULK_ROWS = 250;
  const MAX_BULK_COLUMNS = 64;
  const instances = new WeakMap();

  const PRESETS = Object.freeze({
    instagram: { id: "instagram", label: "Instagram Post", short: "IG", width: 1080, height: 1080, safe: { top: 64, right: 64, bottom: 64, left: 64 } },
    story: { id: "story", label: "Instagram Story", short: "ST", width: 1080, height: 1920, safe: { top: 250, right: 72, bottom: 310, left: 72 } },
    reel: { id: "reel", label: "Reel / Short", short: "RL", width: 1080, height: 1920, safe: { top: 220, right: 92, bottom: 360, left: 92 } },
    youtube: { id: "youtube", label: "YouTube Thumbnail", short: "YT", width: 1280, height: 720, safe: { top: 48, right: 80, bottom: 76, left: 80 } },
    banner: { id: "banner", label: "Web Banner", short: "WB", width: 1500, height: 500, safe: { top: 44, right: 96, bottom: 44, left: 96 } },
    ads: { id: "ads", label: "Display Ads", short: "AD", width: 1200, height: 628, safe: { top: 48, right: 64, bottom: 48, left: 64 } }
  });

  const BRAND_FONTS = Object.freeze(["Inter", "Arial", "Georgia", "Trebuchet MS", "Verdana"]);
  const BRAND_FIELDS = Object.freeze(["name", "logo", "primary", "secondary", "accent", "background", "text", "fontHeading", "fontBody"]);

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : fallback;
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, limit || 2000);
  }

  function normalizeBrandLocks(input) {
    const source = input === true ? Object.fromEntries(BRAND_FIELDS.map((field) => [field, true])) : (input && typeof input === "object" ? input : {});
    return Object.freeze(Object.fromEntries(BRAND_FIELDS.map((field) => [field, Boolean(source[field])])));
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("adaptive"),
      name: "Chiến dịch sáng tạo mới",
      updatedAt: new Date().toISOString(),
      master: {
        title: "Một thiết kế, mọi định dạng",
        subtitle: "Thay đổi một lần và đồng bộ toàn bộ chiến dịch.",
        callToAction: "Khám phá ngay",
        image: null,
        focalPoint: { x: 0.5, y: 0.45 },
        overlay: 0.38,
        titleScale: 1,
        align: "left"
      },
      brand: {
        name: "HH Creative",
        logo: "HH",
        primary: "#F25CB4",
        secondary: "#62D9E6",
        accent: "#C8EF73",
        background: "#101528",
        text: "#FFFFFF",
        fontHeading: "Inter",
        fontBody: "Inter",
        locks: normalizeBrandLocks(false)
      },
      variants: Object.keys(PRESETS).map((presetId) => ({ presetId, enabled: true, overrides: {} }))
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : {};
    const master = source.master && typeof source.master === "object" ? source.master : {};
    const brand = source.brand && typeof source.brand === "object" ? source.brand : {};
    const variants = Array.isArray(source.variants) ? source.variants : fallback.variants;
    return {
      format: FORMAT,
      version: VERSION,
      id: String(source.id || fallback.id).slice(0, 120),
      name: String(source.name || fallback.name).slice(0, 160),
      updatedAt: new Date().toISOString(),
      master: {
        title: String(master.title || fallback.master.title).slice(0, 180),
        subtitle: String(master.subtitle || fallback.master.subtitle).slice(0, 320),
        callToAction: String(master.callToAction || fallback.master.callToAction).slice(0, 80),
        image: master.image && /^data:image\/(png|jpeg|webp);base64,/i.test(master.image.dataUrl || "") ? {
          name: String(master.image.name || "Ảnh chiến dịch").slice(0, 160),
          type: String(master.image.type || "image/png").slice(0, 80),
          width: Math.round(clamp(master.image.width, 1, 16384, 1)),
          height: Math.round(clamp(master.image.height, 1, 16384, 1)),
          dataUrl: master.image.dataUrl
        } : null,
        focalPoint: { x: clamp(master.focalPoint?.x, 0, 1, 0.5), y: clamp(master.focalPoint?.y, 0, 1, 0.45) },
        overlay: clamp(master.overlay, 0, 0.9, fallback.master.overlay),
        titleScale: clamp(master.titleScale, 0.6, 1.8, 1),
        align: ["left", "center", "right"].includes(master.align) ? master.align : "left"
      },
      brand: {
        name: String(brand.name || fallback.brand.name).slice(0, 100),
        logo: String(brand.logo || fallback.brand.logo).slice(0, 16),
        primary: safeColor(brand.primary, fallback.brand.primary),
        secondary: safeColor(brand.secondary, fallback.brand.secondary),
        accent: safeColor(brand.accent, fallback.brand.accent),
        background: safeColor(brand.background, fallback.brand.background),
        text: safeColor(brand.text, fallback.brand.text),
        fontHeading: BRAND_FONTS.includes(brand.fontHeading) ? brand.fontHeading : fallback.brand.fontHeading,
        fontBody: BRAND_FONTS.includes(brand.fontBody) ? brand.fontBody : fallback.brand.fontBody,
        locks: normalizeBrandLocks(brand.locks ?? source.brandLocks)
      },
      variants: Object.keys(PRESETS).map((presetId) => {
        const variant = variants.find((item) => item?.presetId === presetId) || {};
        return { presetId, enabled: variant.enabled !== false, overrides: variant.overrides && typeof variant.overrides === "object" ? clone(variant.overrides) : {} };
      })
    };
  }

  function applyBrandPatch(projectInput, patchInput, options) {
    const project = normalizeProject(projectInput);
    const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
    const respectLocks = options?.respectLocks !== false;
    const next = clone(project);
    BRAND_FIELDS.forEach((field) => {
      if (!(field in patch) || (respectLocks && project.brand.locks[field])) return;
      if (["primary", "secondary", "accent", "background", "text"].includes(field)) next.brand[field] = safeColor(patch[field], next.brand[field]);
      else if (["fontHeading", "fontBody"].includes(field)) next.brand[field] = BRAND_FONTS.includes(patch[field]) ? patch[field] : next.brand[field];
      else next.brand[field] = cleanText(patch[field], field === "logo" ? 16 : 100) || next.brand[field];
    });
    return normalizeProject(next);
  }

  function setBrandLocks(projectInput, fields, locked) {
    const project = normalizeProject(projectInput);
    const selected = fields === "all" ? BRAND_FIELDS : (Array.isArray(fields) ? fields : [fields]);
    const next = clone(project);
    const locks = { ...project.brand.locks };
    selected.filter((field) => BRAND_FIELDS.includes(field)).forEach((field) => { locks[field] = locked !== false; });
    next.brand.locks = locks;
    return normalizeProject(next);
  }

  function parseCsv(text, options) {
    const maxRows = Math.round(clamp(options?.maxRows, 1, MAX_BULK_ROWS, MAX_BULK_ROWS));
    const maxColumns = Math.round(clamp(options?.maxColumns, 1, MAX_BULK_COLUMNS, MAX_BULK_COLUMNS));
    const source = cleanText(text, MAX_BULK_BYTES + 1);
    if (source.length > MAX_BULK_BYTES) throw new RangeError(`Bulk CSV exceeds ${MAX_BULK_BYTES} bytes.`);
    const rows = [];
    let truncated = false;
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index <= source.length; index += 1) {
      const character = source[index] ?? "\n";
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"' && !field) quoted = true;
      else if (character === ",") { if (row.length < maxColumns) row.push(cleanText(field.trim(), 2000)); field = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        if (row.length < maxColumns) row.push(cleanText(field.trim(), 2000));
        field = "";
        if (row.some(Boolean)) rows.push(row.slice(0, maxColumns));
        row = [];
        if (rows.length > maxRows + 1) { truncated = true; break; }
      } else field += character;
    }
    if (!rows.length) return { records: [], errors: ["CSV has no records."], truncated: false, source: "csv" };
    const headers = rows.shift().map((header, index) => cleanText(header || `column${index + 1}`, 80));
    const duplicates = new Set();
    headers.forEach((header, index) => { if (headers.indexOf(header) !== index) duplicates.add(header); });
    const records = rows.slice(0, maxRows).map((values) => Object.fromEntries(headers.map((header, index) => [header, cleanText(values[index], 2000)])));
    return { records, errors: duplicates.size ? [`Duplicate columns: ${[...duplicates].join(", ")}`] : [], truncated: truncated || rows.length > maxRows, source: "csv" };
  }

  function normalizeBulkRecord(input, index) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const pick = (...keys) => keys.map((key) => source[key]).find((value) => value != null && value !== "");
    return {
      id: cleanText(pick("id", "slug") || `row-${index + 1}`, 120),
      name: cleanText(pick("name", "campaign", "project") || `Variant ${index + 1}`, 160),
      title: cleanText(pick("title", "headline", "heading"), 180),
      subtitle: cleanText(pick("subtitle", "description", "body"), 320),
      callToAction: cleanText(pick("callToAction", "cta", "button"), 80),
      brand: Object.fromEntries(BRAND_FIELDS.map((field) => [field, source.brand?.[field] ?? pick(`brand.${field}`, `brand_${field}`, field)]).filter(([, value]) => value != null && value !== "")),
      meta: Object.fromEntries(Object.entries(source).slice(0, MAX_BULK_COLUMNS).map(([key, value]) => [cleanText(key, 80), cleanText(value, 500)]))
    };
  }

  function parseBulkData(input, options) {
    try {
      if (Array.isArray(input)) {
        const limit = Math.round(clamp(options?.maxRows, 1, MAX_BULK_ROWS, MAX_BULK_ROWS));
        return { records: input.slice(0, limit).map(normalizeBulkRecord), errors: [], truncated: input.length > limit, source: "json" };
      }
      if (input && typeof input === "object") {
        const values = Array.isArray(input.records) ? input.records : Array.isArray(input.items) ? input.items : [input];
        return parseBulkData(values, options);
      }
      const text = cleanText(input, MAX_BULK_BYTES + 1);
      if (text.length > MAX_BULK_BYTES) return { records: [], errors: [`Input exceeds ${MAX_BULK_BYTES} bytes.`], truncated: true, source: "unknown" };
      const trimmed = text.trim();
      if (!trimmed) return { records: [], errors: ["Bulk input is empty."], truncated: false, source: "unknown" };
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseBulkData(JSON.parse(trimmed), options);
      const parsed = parseCsv(trimmed, options);
      parsed.records = parsed.records.map(normalizeBulkRecord);
      return parsed;
    } catch (error) {
      return { records: [], errors: [cleanText(error?.message || "Bulk data is invalid.", 300)], truncated: false, source: "unknown" };
    }
  }

  function applyBulkRecord(projectInput, recordInput) {
    const project = normalizeProject(projectInput);
    const record = normalizeBulkRecord(recordInput, 0);
    const next = clone(project);
    next.id = `${project.id}-${record.id}`.slice(0, 120);
    next.name = record.name || project.name;
    if (record.title) next.master.title = record.title;
    if (record.subtitle) next.master.subtitle = record.subtitle;
    if (record.callToAction) next.master.callToAction = record.callToAction;
    return applyBrandPatch(next, record.brand, { respectLocks: true });
  }

  function createBulkCampaigns(projectInput, input, options) {
    const parsed = parseBulkData(input, options);
    return {
      ...parsed,
      campaigns: parsed.records.map((record) => {
        const project = applyBulkRecord(projectInput, record);
        return { record, project, variants: createVariants(project) };
      })
    };
  }

  function calculateCoverCrop(imageWidth, imageHeight, outputWidth, outputHeight, focalPoint) {
    const iw = Math.max(1, Number(imageWidth) || 1);
    const ih = Math.max(1, Number(imageHeight) || 1);
    const ow = Math.max(1, Number(outputWidth) || 1);
    const oh = Math.max(1, Number(outputHeight) || 1);
    const scale = Math.max(ow / iw, oh / ih);
    const sourceWidth = ow / scale;
    const sourceHeight = oh / scale;
    const focalX = clamp(focalPoint?.x, 0, 1, 0.5) * iw;
    const focalY = clamp(focalPoint?.y, 0, 1, 0.5) * ih;
    return {
      sx: clamp(focalX - sourceWidth / 2, 0, iw - sourceWidth, 0),
      sy: clamp(focalY - sourceHeight / 2, 0, ih - sourceHeight, 0),
      sw: sourceWidth,
      sh: sourceHeight,
      dx: 0,
      dy: 0,
      dw: ow,
      dh: oh,
      scale
    };
  }

  function calculateSmartCrop(imageWidth, imageHeight, outputWidth, outputHeight, options) {
    const subjects = (Array.isArray(options?.subjects) ? options.subjects : []).slice(0, 20).filter((subject) => subject && Number.isFinite(Number(subject.x)) && Number.isFinite(Number(subject.y)));
    let focalPoint = options?.focalPoint || options;
    if (subjects.length) {
      let totalWeight = 0;
      let x = 0;
      let y = 0;
      subjects.forEach((subject) => {
        const weight = clamp(subject.weight ?? subject.confidence, 0.01, 10, 1);
        x += clamp(subject.x + (subject.width || 0) / 2, 0, 1, 0.5) * weight;
        y += clamp(subject.y + (subject.height || 0) / 2, 0, 1, 0.5) * weight;
        totalWeight += weight;
      });
      focalPoint = { x: x / totalWeight, y: y / totalWeight };
    }
    return { ...calculateCoverCrop(imageWidth, imageHeight, outputWidth, outputHeight, focalPoint), focalPoint: { x: clamp(focalPoint?.x, 0, 1, 0.5), y: clamp(focalPoint?.y, 0, 1, 0.5) }, strategy: subjects.length ? "subjects" : "focal-point" };
  }

  function fitTypography(text, initialSize, width, height, maxLines, options) {
    const minSize = clamp(options?.minSize, 8, initialSize, Math.min(16, initialSize));
    const lineHeight = clamp(options?.lineHeight, 0.8, 3, 1.05);
    let size = Math.max(minSize, initialSize);
    const characterUnits = [...cleanText(text, 5000)].reduce((sum, character) => sum + (/\s/.test(character) ? 0.3 : /[MW@#%]/.test(character) ? 0.9 : 0.58), 0);
    while (size > minSize) {
      const estimatedLines = Math.max(1, Math.ceil(characterUnits * size / Math.max(1, width)));
      if (estimatedLines <= maxLines && estimatedLines * size * lineHeight <= height) return { size: Math.round(size), lines: estimatedLines, overflow: false };
      size -= Math.max(1, initialSize * 0.04);
    }
    const lines = Math.max(1, Math.ceil(characterUnits * minSize / Math.max(1, width)));
    return { size: Math.round(minSize), lines, overflow: lines > maxLines || lines * minSize * lineHeight > height };
  }

  function safeZone(presetId) {
    const preset = PRESETS[presetId] || PRESETS.instagram;
    return clone(preset.safe);
  }

  function reflowLayout(projectInput, presetId) {
    const project = normalizeProject(projectInput);
    const preset = PRESETS[presetId] || PRESETS.instagram;
    const safe = preset.safe;
    const portrait = preset.height / preset.width > 1.3;
    const wide = preset.width / preset.height > 2;
    const contentWidth = preset.width - safe.left - safe.right;
    const align = project.master.align;
    const x = align === "left" ? safe.left : align === "right" ? preset.width - safe.right : preset.width / 2;
    const anchor = align === "left" ? "left" : align === "right" ? "right" : "center";
    const initialTitleSize = Math.round(Math.min(preset.width * (wide ? 0.054 : portrait ? 0.086 : 0.072), preset.height * 0.16) * project.master.titleScale);
    const maxTitleLines = wide ? 2 : 3;
    const titleFit = fitTypography(project.master.title, initialTitleSize, contentWidth, preset.height * (portrait ? 0.22 : 0.25), maxTitleLines, { minSize: Math.max(24, initialTitleSize * 0.58), lineHeight: 1.02 });
    const titleSize = titleFit.size;
    const initialSubtitleSize = Math.round(initialTitleSize * 0.38);
    const subtitleFit = fitTypography(project.master.subtitle, initialSubtitleSize, contentWidth, preset.height * (portrait ? 0.13 : 0.12), portrait ? 3 : 2, { minSize: Math.max(14, initialSubtitleSize * 0.68), lineHeight: 1.35 });
    const subtitleSize = subtitleFit.size;
    const top = portrait ? preset.height * 0.57 : wide ? preset.height * 0.27 : preset.height * 0.47;
    return {
      presetId,
      width: preset.width,
      height: preset.height,
      safe,
      content: { x, y: clamp(top, safe.top, preset.height - safe.bottom - titleSize * 3, safe.top), width: contentWidth, anchor },
      logo: { x: align === "right" ? preset.width - safe.right : safe.left, y: safe.top, size: Math.round(Math.min(preset.width, preset.height) * 0.075) },
      title: { size: Math.max(24, titleSize), lineHeight: 1.02, maxLines: maxTitleLines, overflow: titleFit.overflow },
      subtitle: { size: Math.max(14, subtitleSize), lineHeight: 1.35, maxLines: portrait ? 3 : 2, overflow: subtitleFit.overflow },
      cta: { height: Math.max(44, Math.round(titleSize * 0.72)), padding: Math.max(18, Math.round(titleSize * 0.35)) }
    };
  }

  function createVariants(projectInput) {
    const project = normalizeProject(projectInput);
    return project.variants.filter((variant) => variant.enabled).map((variant) => {
      const content = { ...clone(project.master), ...clone(variant.overrides.content || {}) };
      const variantProject = applyBrandPatch({ ...project, master: content }, variant.overrides.brand, { respectLocks: true });
      return {
        ...variant,
        preset: clone(PRESETS[variant.presetId]),
        layout: reflowLayout(variantProject, variant.presetId),
        content: clone(variantProject.master),
        brand: clone(variantProject.brand)
      };
    });
  }

  function wrapText(context, text, maxWidth, maxLines) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines) {
      const joined = lines.join(" ");
      if (joined.length < String(text).length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, "")}…`;
    }
    return lines;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath(); context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r); context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height); context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r); context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
  }

  function drawSafeZone(context, layout) {
    const safe = layout.safe;
    context.save(); context.strokeStyle = "rgba(200,239,115,.72)"; context.lineWidth = Math.max(2, layout.width / 600); context.setLineDash([12, 9]);
    context.strokeRect(safe.left, safe.top, layout.width - safe.left - safe.right, layout.height - safe.top - safe.bottom);
    context.restore();
  }

  function renderArtboard(canvas, projectInput, presetId, options) {
    if (!canvas || typeof canvas.getContext !== "function") return false;
    const baseProject = normalizeProject(projectInput);
    const variant = baseProject.variants.find((item) => item.presetId === presetId);
    const project = variant ? applyBrandPatch({ ...baseProject, master: { ...baseProject.master, ...clone(variant.overrides.content || {}) } }, variant.overrides.brand, { respectLocks: true }) : baseProject;
    const layout = reflowLayout(project, presetId);
    const context = canvas.getContext("2d");
    if (!context) return false;
    const ratio = options?.pixelRatio || 1;
    canvas.width = Math.max(1, Math.round(layout.width * ratio));
    canvas.height = Math.max(1, Math.round(layout.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = context.createLinearGradient(0, 0, layout.width, layout.height);
    gradient.addColorStop(0, project.brand.background); gradient.addColorStop(0.55, project.brand.primary); gradient.addColorStop(1, project.brand.secondary);
    context.fillStyle = gradient; context.fillRect(0, 0, layout.width, layout.height);
    const image = options?.image;
    if (image && image.naturalWidth && image.naturalHeight) {
      const crop = calculateSmartCrop(image.naturalWidth, image.naturalHeight, layout.width, layout.height, { focalPoint: project.master.focalPoint, subjects: options?.subjects });
      context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, layout.width, layout.height);
    }
    context.fillStyle = `rgba(4,8,18,${project.master.overlay})`; context.fillRect(0, 0, layout.width, layout.height);
    const align = layout.content.anchor;
    context.textAlign = align;
    context.textBaseline = "top";
    context.fillStyle = project.brand.text;
    context.font = `900 ${layout.title.size}px ${project.brand.fontHeading},sans-serif`;
    const titleLines = wrapText(context, project.master.title, layout.content.width, layout.title.maxLines);
    let y = layout.content.y;
    titleLines.forEach((line) => { context.fillText(line, layout.content.x, y, layout.content.width); y += layout.title.size * layout.title.lineHeight; });
    y += layout.title.size * 0.24;
    context.font = `500 ${layout.subtitle.size}px ${project.brand.fontBody},sans-serif`; context.globalAlpha = 0.9;
    wrapText(context, project.master.subtitle, layout.content.width, layout.subtitle.maxLines).forEach((line) => { context.fillText(line, layout.content.x, y, layout.content.width); y += layout.subtitle.size * layout.subtitle.lineHeight; });
    context.globalAlpha = 1;
    y += layout.subtitle.size * 0.65;
    context.font = `800 ${Math.round(layout.cta.height * 0.36)}px ${project.brand.fontBody},sans-serif`;
    const ctaWidth = Math.min(layout.content.width, context.measureText(project.master.callToAction).width + layout.cta.padding * 2);
    const ctaX = align === "left" ? layout.content.x : align === "right" ? layout.content.x - ctaWidth : layout.content.x - ctaWidth / 2;
    roundedRect(context, ctaX, y, ctaWidth, layout.cta.height, layout.cta.height / 2); context.fillStyle = project.brand.accent; context.fill();
    context.fillStyle = project.brand.background; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(project.master.callToAction, ctaX + ctaWidth / 2, y + layout.cta.height / 2);
    context.textAlign = "left"; context.textBaseline = "top"; context.fillStyle = project.brand.text; context.font = `900 ${Math.round(layout.logo.size * 0.44)}px ${project.brand.fontHeading},sans-serif`;
    roundedRect(context, layout.logo.x, layout.logo.y, layout.logo.size, layout.logo.size, layout.logo.size * 0.22); context.fillStyle = project.brand.primary; context.fill();
    context.fillStyle = project.brand.text; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(project.brand.logo, layout.logo.x + layout.logo.size / 2, layout.logo.y + layout.logo.size / 2);
    if (options?.showSafeZone) drawSafeZone(context, layout);
    return true;
  }

  function serializeProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function brandTokens(projectInput) {
    const brand = normalizeProject(projectInput).brand;
    return `:root {\n  --brand-primary: ${brand.primary};\n  --brand-secondary: ${brand.secondary};\n  --brand-accent: ${brand.accent};\n  --brand-background: ${brand.background};\n  --brand-text: ${brand.text};\n  --brand-font-heading: "${brand.fontHeading}";\n  --brand-font-body: "${brand.fontBody}";\n}`;
  }

  function addStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style"); style.id = STYLE_ID;
    style.textContent = `
      .gad{--cyan:#61dce8;--pink:#f25cb4;--lime:#c8ef73;--bg:#080d16;--panel:#111a26;--line:#2b3a4c;--muted:#91a2b5;color:#edf7ff;background:var(--bg);border:1px solid var(--line);border-radius:12px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif}.gad *{box-sizing:border-box}.gad button,.gad input,.gad select,.gad textarea{font:inherit}.gad button{min-height:34px;padding:7px 11px;border:1px solid #3b5063;border-radius:7px;background:#142130;color:#eaf8ff;cursor:pointer}.gad button:hover,.gad button:focus-visible{outline:0;border-color:var(--cyan);box-shadow:0 0 0 2px rgba(97,220,232,.16)}.gad-primary{border:0!important;background:linear-gradient(135deg,var(--cyan),#9ce8ac)!important;color:#071018!important;font-weight:800}.gad-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(97,220,232,.1),transparent 48%,rgba(242,92,180,.12))}.gad-logo{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#08101a;font-weight:900}.gad-head h2{margin:0;font-size:18px}.gad-head p{margin:2px 0 0;color:var(--muted);font-size:11px}.gad-head-actions{display:flex;gap:7px;margin-left:auto}.gad-main{display:grid;grid-template-columns:280px minmax(400px,1fr);min-height:680px}.gad-inspector{padding:14px;border-right:1px solid var(--line);background:#0b121c;overflow:auto}.gad-panel{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);margin-bottom:10px}.gad-panel h3{margin:0 0 10px;color:var(--cyan);font-size:11px;text-transform:uppercase}.gad-stack{display:grid;gap:8px}.gad-row{display:flex;align-items:center;gap:7px}.gad input,.gad select,.gad textarea{width:100%;min-height:35px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:#090f18;color:#edf7ff}.gad textarea{min-height:66px;resize:vertical}.gad-color-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.gad-color-grid input{height:38px;padding:3px}.gad-workspace{display:grid;grid-template-rows:auto 1fr auto;min-width:0;background:#080d15}.gad-toolbar{display:flex;align-items:center;gap:7px;padding:10px 12px;border-bottom:1px solid var(--line);overflow:auto}.gad-toolbar .gad-status{margin-left:auto}.gad-artboards{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));align-content:start;gap:14px;padding:16px;overflow:auto}.gad-artboard{position:relative;padding:10px;border:1px solid var(--line);border-radius:10px;background:#101925}.gad-artboard.is-active{border-color:var(--pink);box-shadow:0 0 0 2px rgba(242,92,180,.12)}.gad-artboard-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.gad-artboard-head span{color:var(--muted);font-size:10px}.gad-artboard-head button{margin-left:auto;min-height:27px;padding:4px 7px;font-size:10px}.gad-canvas-wrap{display:grid;place-items:center;min-height:220px;padding:9px;overflow:hidden;border-radius:7px;background:linear-gradient(45deg,#0a111a 25%,#101925 25%,#101925 75%,#0a111a 75%);background-size:20px 20px}.gad canvas{display:block;max-width:100%;max-height:330px;border:1px solid #3d5367;box-shadow:0 14px 34px rgba(0,0,0,.38)}.gad-footer{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.gad-badge{padding:3px 7px;border:1px solid #3a5367;border-radius:999px;color:var(--cyan)}.gad-drop{display:grid;place-items:center;min-height:82px;border:1px dashed #49647a;border-radius:8px;text-align:center;color:var(--muted)}.gad-drop.is-over{border-color:var(--cyan);background:rgba(97,220,232,.08)}.gad-focal{position:relative;min-height:92px;overflow:hidden;border-radius:8px;background:linear-gradient(135deg,var(--pink),#20294f,var(--cyan));cursor:crosshair}.gad-focal::after{content:"";position:absolute;left:calc(var(--fx)*100%);top:calc(var(--fy)*100%);width:14px;height:14px;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(0,0,0,.35)}.gad-focal img{width:100%;height:110px;object-fit:cover}.gad-status{color:var(--muted);font-size:11px}.gad-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
      @media(max-width:920px){.gad-main{grid-template-columns:240px 1fr}.gad-artboards{grid-template-columns:1fr}}@media(max-width:680px){.gad-head{align-items:flex-start;flex-wrap:wrap}.gad-head-actions{width:100%;margin-left:0;overflow:auto}.gad-main{display:block}.gad-inspector{border-right:0;border-bottom:1px solid var(--line)}.gad-artboards{padding:10px}.gad-toolbar{position:sticky;top:0;z-index:3;background:#0b121c}.gad canvas{max-height:430px}}@media(prefers-reduced-motion:reduce){.gad *{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    addStyles();
    let project;
    try { project = normalizeProject(options?.project || JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); } catch (_) { project = createDefaultProject(); }
    let history = [clone(project)]; let historyIndex = 0; let showSafeZone = true; let activePreset = "instagram"; let image = null;
    root.classList.add("gad");
    root.innerHTML = `<header class="gad-head"><div class="gad-logo" aria-hidden="true">AD</div><div><h2>Adaptive Design Studio</h2><p>Edit once · synced artboards · smart crop · Brand Kit · safe zones</p></div><div class="gad-head-actions"><button type="button" data-gad-action="undo" aria-label="Hoàn tác" title="Ctrl Z">Hoàn tác</button><button type="button" data-gad-action="redo" aria-label="Làm lại" title="Ctrl Y">Làm lại</button><button type="button" data-gad-action="import">Nhập JSON</button><button type="button" data-gad-action="bulk">Bulk CSV/JSON</button><button type="button" class="gad-primary" data-gad-action="export-all">Xuất tất cả</button></div></header><div class="gad-main"><aside class="gad-inspector"><section class="gad-panel"><h3>Nội dung master</h3><div class="gad-stack"><label>Tiêu đề<textarea data-gad-field="title" maxlength="180"></textarea></label><label>Mô tả<textarea data-gad-field="subtitle" maxlength="320"></textarea></label><label>Nút hành động<input data-gad-field="callToAction" maxlength="80"></label><div class="gad-row"><label>Căn<select data-gad-field="align"><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label><label>Cỡ tiêu đề<input type="range" min="0.6" max="1.8" step="0.05" data-gad-field="titleScale"></label></div></div></section><section class="gad-panel"><h3>Ảnh & Smart Crop</h3><button type="button" class="gad-drop" data-gad-drop><span>Thả hoặc chọn ảnh<br><small>PNG, JPG, WebP · xử lý trên thiết bị</small></span></button><div class="gad-focal" data-gad-focal tabindex="0" role="slider" aria-label="Điểm tập trung của ảnh" aria-valuemin="0" aria-valuemax="100"><span class="gad-sr">Bấm vào ảnh để đặt focal point</span></div><label>Lớp phủ<input type="range" min="0" max="0.9" step="0.02" data-gad-field="overlay"></label></section><section class="gad-panel"><h3>Brand Kit</h3><div class="gad-stack"><label>Tên thương hiệu<input data-gad-brand="name"></label><label>Logo chữ<input data-gad-brand="logo" maxlength="16"></label><div class="gad-color-grid"><label>Chính<input type="color" data-gad-brand="primary"></label><label>Phụ<input type="color" data-gad-brand="secondary"></label><label>Nhấn<input type="color" data-gad-brand="accent"></label></div><label>Font tiêu đề<select data-gad-brand="fontHeading">${BRAND_FONTS.map((font) => `<option>${font}</option>`).join("")}</select></label><button type="button" data-gad-action="toggle-brand-lock">Khóa Brand Kit</button><button type="button" data-gad-action="copy-tokens">Sao chép design token</button></div></section></aside><section class="gad-workspace"><div class="gad-toolbar"><button type="button" data-gad-action="toggle-safe">Safe zone: Bật</button><span class="gad-badge">${Object.keys(PRESETS).length} định dạng đồng bộ</span><span class="gad-status" role="status" aria-live="polite" data-gad-status>Sẵn sàng.</span></div><div class="gad-artboards" data-gad-artboards></div><footer class="gad-footer"><span>Smart crop theo focal point</span><span>Reflow theo constraint</span><span data-gad-save>Tự lưu cục bộ</span></footer></section></div><input hidden type="file" accept="image/png,image/jpeg,image/webp" data-gad-image-file><input hidden type="file" accept="application/json,.json" data-gad-import-file><input hidden type="file" accept="text/csv,application/json,.csv,.json" data-gad-bulk-file>`;
    const qs = (selector) => root.querySelector(selector);
    const status = (message) => { qs("[data-gad-status]").textContent = message; };

    function persist() {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); qs("[data-gad-save]").textContent = `Đã lưu ${new Date().toLocaleTimeString("vi-VN")}`; } catch (_) { qs("[data-gad-save]").textContent = "Không thể lưu cục bộ"; }
    }
    function remember() { history.splice(historyIndex + 1); history.push(clone(project)); if (history.length > MAX_HISTORY) history.shift(); historyIndex = history.length - 1; persist(); }
    function loadImage() {
      image = null;
      if (!project.master.image?.dataUrl || typeof Image === "undefined") return renderCanvases();
      image = new Image(); image.onload = renderCanvases; image.src = project.master.image.dataUrl;
    }
    function renderInspector() {
      ["title", "subtitle", "callToAction", "align", "titleScale", "overlay"].forEach((key) => { const node = qs(`[data-gad-field="${key}"]`); if (node) node.value = project.master[key]; });
      Object.keys(project.brand).forEach((key) => { const node = qs(`[data-gad-brand="${key}"]`); if (node) node.value = project.brand[key]; });
      root.querySelectorAll("[data-gad-brand]").forEach((node) => { node.disabled = Boolean(project.brand.locks[node.dataset.gadBrand]); });
      const lockButton = qs('[data-gad-action="toggle-brand-lock"]');
      if (lockButton) lockButton.textContent = BRAND_FIELDS.every((field) => project.brand.locks[field]) ? "Mở khóa Brand Kit" : "Khóa Brand Kit";
      const focal = qs("[data-gad-focal]"); focal.style.setProperty("--fx", project.master.focalPoint.x); focal.style.setProperty("--fy", project.master.focalPoint.y);
      focal.innerHTML = project.master.image ? `<img alt="Ảnh gốc để chọn focal point" src="${project.master.image.dataUrl}">` : `<span>Chưa có ảnh · dùng nền Brand Kit</span>`;
    }
    function renderArtboards() {
      qs("[data-gad-artboards]").innerHTML = createVariants(project).map((variant) => `<article class="gad-artboard ${variant.presetId === activePreset ? "is-active" : ""}" data-gad-card="${variant.presetId}"><div class="gad-artboard-head"><strong>${escapeHtml(variant.preset.label)}</strong><span>${variant.preset.width} × ${variant.preset.height}</span><button type="button" data-gad-export="${variant.presetId}">PNG</button></div><div class="gad-canvas-wrap"><canvas data-gad-canvas="${variant.presetId}" aria-label="Xem trước ${escapeHtml(variant.preset.label)}"></canvas></div></article>`).join("");
    }
    function renderCanvases() {
      root.querySelectorAll("[data-gad-canvas]").forEach((canvas) => renderArtboard(canvas, project, canvas.dataset.gadCanvas, { image, showSafeZone, pixelRatio: 0.38 }));
    }
    function render() { renderInspector(); renderArtboards(); renderCanvases(); }
    function change(mutator, final) { mutator(project); project = normalizeProject(project); render(); if (final) remember(); else persist(); }
    function undo() { if (historyIndex <= 0) return status("Không còn bước để hoàn tác."); historyIndex -= 1; project = normalizeProject(history[historyIndex]); loadImage(); render(); persist(); }
    function redo() { if (historyIndex >= history.length - 1) return status("Không còn bước để làm lại."); historyIndex += 1; project = normalizeProject(history[historyIndex]); loadImage(); render(); persist(); }
    async function exportPng(presetId) {
      const canvas = document.createElement("canvas"); renderArtboard(canvas, project, presetId, { image, showSafeZone: false, pixelRatio: 1 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return status("Trình duyệt không thể tạo PNG.");
      downloadBlob(blob, `${project.name.replace(/[^a-z0-9]+/gi, "-") || "adaptive"}-${presetId}.png`); status(`Đã xuất ${PRESETS[presetId].label}.`);
    }
    function importImage(file) {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) return status("Chỉ nhận PNG, JPG hoặc WebP.");
      const reader = new FileReader(); reader.onload = () => { const nextImage = new Image(); nextImage.onload = () => { change((draft) => { draft.master.image = { name: file.name, type: file.type, width: nextImage.naturalWidth, height: nextImage.naturalHeight, dataUrl: reader.result }; }, true); image = nextImage; render(); status("Đã đồng bộ ảnh sang 5 artboard."); }; nextImage.src = reader.result; }; reader.readAsDataURL(file);
    }
    function setFocal(clientX, clientY) {
      const focal = qs("[data-gad-focal]"); const rect = focal.getBoundingClientRect();
      change((draft) => { draft.master.focalPoint = { x: clamp((clientX - rect.left) / rect.width, 0, 1, 0.5), y: clamp((clientY - rect.top) / rect.height, 0, 1, 0.5) }; }, true);
      status("Đã cập nhật Smart Crop theo focal point.");
    }
    const onClick = async (event) => {
      const target = event.target.closest("button,[data-gad-focal],[data-gad-card]"); if (!target || !root.contains(target)) return;
      if (target.dataset.gadCard && !event.target.closest("button")) { activePreset = target.dataset.gadCard; return renderArtboards(), renderCanvases(); }
      if (target.matches("[data-gad-focal]")) return setFocal(event.clientX, event.clientY);
      if (target.dataset.gadExport) return exportPng(target.dataset.gadExport);
      const action = target.dataset.gadAction;
      if (action === "undo") return undo(); if (action === "redo") return redo();
      if (action === "import") return qs("[data-gad-import-file]").click();
      if (action === "bulk") return qs("[data-gad-bulk-file]").click();
      if (action === "export-all") { downloadBlob(new Blob([serializeProject(project)], { type: "application/json" }), `${project.name.replace(/[^a-z0-9]+/gi, "-") || "adaptive"}.json`); return status("Đã xuất project JSON. Có thể xuất PNG riêng trên từng artboard."); }
      if (action === "toggle-safe") { showSafeZone = !showSafeZone; target.textContent = `Safe zone: ${showSafeZone ? "Bật" : "Tắt"}`; return renderCanvases(); }
      if (action === "toggle-brand-lock") { const lock = !BRAND_FIELDS.every((field) => project.brand.locks[field]); project = setBrandLocks(project, "all", lock); remember(); render(); return status(lock ? "Brand Kit đã khóa." : "Brand Kit đã mở khóa."); }
      if (action === "copy-tokens") { await navigator.clipboard?.writeText(brandTokens(project)); return status("Đã sao chép design token CSS."); }
      if (target.matches("[data-gad-drop]")) return qs("[data-gad-image-file]").click();
    };
    const onInput = (event) => {
      if (event.target.dataset.gadField) return change((draft) => { draft.master[event.target.dataset.gadField] = event.target.type === "range" ? Number(event.target.value) : event.target.value; }, false);
      if (event.target.dataset.gadBrand) { const field = event.target.dataset.gadBrand; if (project.brand.locks[field]) return status("Trường Brand Kit này đang bị khóa."); return change((draft) => { draft.brand[field] = event.target.value; }, false); }
    };
    const onChange = (event) => {
      if (event.target.matches("[data-gad-field],[data-gad-brand]")) { remember(); status("Đã đồng bộ thay đổi sang mọi artboard."); }
      if (event.target.matches("[data-gad-image-file]") && event.target.files[0]) importImage(event.target.files[0]);
      if (event.target.matches("[data-gad-import-file]") && event.target.files[0]) { const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (parsed.format !== FORMAT) throw new Error(); project = normalizeProject(parsed); history = [clone(project)]; historyIndex = 0; loadImage(); render(); persist(); status("Đã nhập project Adaptive Design."); } catch (_) { status("Project JSON không hợp lệ."); } }; reader.readAsText(event.target.files[0]); }
      if (event.target.matches("[data-gad-bulk-file]") && event.target.files[0]) { const reader = new FileReader(); reader.onload = () => { const batch = createBulkCampaigns(project, reader.result); if (!batch.campaigns.length) return status(batch.errors[0] || "Bulk data không có bản ghi."); const bundle = { format: `${FORMAT}-bulk`, version: VERSION, generatedAt: new Date().toISOString(), campaigns: batch.campaigns.map((item) => item.project), errors: batch.errors, truncated: batch.truncated }; downloadBlob(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }), `${project.name.replace(/[^a-z0-9]+/gi, "-") || "adaptive"}-bulk.json`); status(`Đã tạo ${batch.campaigns.length} campaign từ bulk data.`); }; reader.readAsText(event.target.files[0]); }
    };
    const drop = qs("[data-gad-drop]");
    const onDragOver = (event) => { event.preventDefault(); drop.classList.add("is-over"); };
    const onDragLeave = () => drop.classList.remove("is-over");
    const onDrop = (event) => { event.preventDefault(); drop.classList.remove("is-over"); if (event.dataTransfer.files[0]) importImage(event.dataTransfer.files[0]); };
    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
      if (event.target.matches("[data-gad-focal]") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const point = project.master.focalPoint; const x = point.x + (event.key === "ArrowRight" ? 0.02 : event.key === "ArrowLeft" ? -0.02 : 0); const y = point.y + (event.key === "ArrowDown" ? 0.02 : event.key === "ArrowUp" ? -0.02 : 0); change((draft) => { draft.master.focalPoint = { x: clamp(x, 0, 1, 0.5), y: clamp(y, 0, 1, 0.5) }; }, true); }
    };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("keydown", onKeydown);
    drop.addEventListener("dragover", onDragOver); drop.addEventListener("dragleave", onDragLeave); drop.addEventListener("drop", onDrop);
    loadImage(); render();
    const controller = { getProject: () => clone(project), setProject(next) { project = normalizeProject(next); history = [clone(project)]; historyIndex = 0; loadImage(); render(); persist(); }, exportPng, undo, redo, unmount() { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKeydown); drop.removeEventListener("dragover", onDragOver); drop.removeEventListener("dragleave", onDragLeave); drop.removeEventListener("drop", onDrop); root.replaceChildren(); root.classList.remove("gad"); instances.delete(root); } };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root); if (!controller) return false; controller.unmount(); return true;
  }

  const api = Object.freeze({ VERSION, FORMAT, STORAGE_KEY, MAX_BULK_BYTES, MAX_BULK_ROWS, MAX_BULK_COLUMNS, PRESETS, BRAND_FONTS, BRAND_FIELDS, createDefaultProject, normalizeProject, normalizeBrandLocks, applyBrandPatch, setBrandLocks, parseCsv, parseBulkData, normalizeBulkRecord, applyBulkRecord, createBulkCampaigns, calculateCoverCrop, calculateSmartCrop, safeZone, fitTypography, reflowLayout, createVariants, wrapText, renderArtboard, serializeProject, brandTokens, mount, unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicAdaptive = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
