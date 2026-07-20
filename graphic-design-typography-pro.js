(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-typography-pro-project";
  const STORAGE_KEY = "hh.graphic-typography-pro.project.v1";
  const STYLE_ID = "hh-graphic-typography-pro-style-v1";
  const MAX_HISTORY = 50;
  const mounted = new WeakMap();

  const STYLE_ROLES = Object.freeze([
    { id: "heading", label: "Heading", className: "hh-type-heading", sample: "Typography tạo nên nhịp điệu" },
    { id: "body", label: "Body", className: "hh-type-body", sample: "Một hệ chữ tốt giúp nội dung rõ ràng, có thứ bậc và dễ đọc trên mọi kích thước." },
    { id: "caption", label: "Caption", className: "hh-type-caption", sample: "CHÚ THÍCH 01 · TYPOGRAPHY SYSTEM" }
  ]);

  const OPENTYPE_FEATURES = Object.freeze([
    { tag: "dlig", label: "Discretionary ligatures" },
    { tag: "calt", label: "Contextual alternates" },
    { tag: "smcp", label: "Small caps" },
    { tag: "onum", label: "Oldstyle numerals" },
    { tag: "tnum", label: "Tabular numerals" },
    { tag: "frac", label: "Fractions" },
    { tag: "zero", label: "Slashed zero" }
  ]);

  const AXIS_LABELS = Object.freeze({
    wght: "Weight",
    wdth: "Width",
    opsz: "Optical size",
    slnt: "Slant",
    ital: "Italic",
    GRAD: "Grade"
  });

  const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace"]);

  function uid(prefix) {
    const random = globalScope.crypto && typeof globalScope.crypto.randomUUID === "function"
      ? globalScope.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    return `${prefix || "item"}-${random}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function round(value, precision) {
    const factor = Math.pow(10, precision == null ? 3 : precision);
    return Math.round(Number(value) * factor) / factor;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function safeText(value, fallback, maxLength) {
    const text = value == null ? String(fallback == null ? "" : fallback) : String(value);
    return text.slice(0, maxLength || 1000);
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : fallback;
  }

  function safeFontFamily(value, fallback) {
    const cleaned = String(value == null ? "" : value)
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF _.-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    if (cleaned) return cleaned;
    return fallback === undefined ? "Arial" : fallback;
  }

  function safeFallbackStack(value) {
    const entries = String(value == null ? "" : value).split(",").slice(0, 6)
      .map((entry) => safeFontFamily(entry, ""))
      .filter(Boolean);
    return entries.length ? entries.join(", ") : "sans-serif";
  }

  function safeId(value, fallback) {
    const cleaned = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    return cleaned || fallback;
  }

  function safeAxisTag(value) {
    const tag = String(value || "").slice(0, 4);
    return /^[A-Za-z0-9]{4}$/.test(tag) ? tag : "";
  }

  function quoteCss(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
  }

  function defaultFonts() {
    return [
      {
        id: "font-inter",
        family: "Inter",
        fallback: "Arial, sans-serif",
        source: "local",
        axes: [
          { tag: "wght", name: "Weight", min: 100, max: 900, default: 600 },
          { tag: "slnt", name: "Slant", min: -10, max: 0, default: 0 }
        ]
      },
      { id: "font-arial", family: "Arial", fallback: "sans-serif", source: "system", axes: [] },
      { id: "font-georgia", family: "Georgia", fallback: "serif", source: "system", axes: [] }
    ];
  }

  function defaultFeatures() {
    return OPENTYPE_FEATURES.reduce((features, item) => {
      features[item.tag] = item.tag === "calt";
      return features;
    }, {});
  }

  function createStylePreset(role, overrides) {
    const base = {
      id: role,
      name: role === "heading" ? "Display Heading" : role === "body" ? "Editorial Body" : "Utility Caption",
      text: STYLE_ROLES.find((item) => item.id === role)?.sample || "Typography sample",
      fontId: role === "heading" ? "font-inter" : role === "body" ? "font-arial" : "font-georgia",
      fontSize: role === "heading" ? 78 : role === "body" ? 24 : 16,
      minFontSize: role === "heading" ? 28 : 14,
      maxFontSize: role === "heading" ? 124 : role === "body" ? 48 : 28,
      lineHeight: role === "heading" ? 1.02 : role === "body" ? 1.5 : 1.25,
      fontWeight: role === "heading" ? 680 : role === "body" ? 400 : 600,
      fontStyle: "normal",
      color: role === "caption" ? "#C8EF73" : "#F4F7F8",
      align: role === "caption" ? "center" : "left",
      tracking: role === "heading" ? -0.02 : role === "caption" ? 0.12 : 0,
      kerning: true,
      ligatures: true,
      features: defaultFeatures(),
      axes: role === "heading" ? { wght: 680, slnt: 0 } : {},
      autoSize: role === "heading",
      box: {
        width: role === "heading" ? 780 : role === "body" ? 680 : 720,
        height: role === "heading" ? 210 : role === "body" ? 230 : 70
      },
      path: { enabled: false, type: "arc", bend: 24, offset: 50, reverse: false }
    };
    return Object.assign(base, clone(overrides || {}));
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        id: uid("type-project"),
        name: "Typography System 01",
        updatedAt: new Date().toISOString()
      },
      canvas: { width: 960, height: 560, background: "#10151C", showBounds: true },
      activeStyle: "heading",
      fonts: defaultFonts(),
      styles: {
        heading: createStylePreset("heading"),
        body: createStylePreset("body"),
        caption: createStylePreset("caption")
      }
    };
  }

  function normalizeAxis(raw, index) {
    const tag = safeAxisTag(raw && raw.tag);
    if (!tag) return null;
    const min = clamp(raw.min, -1000, 2000, 0);
    const max = clamp(raw.max, min, 4000, Math.max(min, 1000));
    const defaultValue = clamp(raw.default, min, max, min);
    return {
      tag,
      name: safeText(raw.name, AXIS_LABELS[tag] || `Axis ${index + 1}`, 60),
      min: round(min),
      max: round(max),
      default: round(defaultValue)
    };
  }

  function normalizeFonts(rawFonts) {
    const fallback = defaultFonts();
    const source = Array.isArray(rawFonts) && rawFonts.length ? rawFonts.slice(0, 16) : fallback;
    const usedIds = new Set();
    const normalized = source.map((raw, index) => {
      const family = safeFontFamily(raw && raw.family, fallback[index]?.family || `Project Font ${index + 1}`);
      let id = safeId(raw && raw.id, `font-${index + 1}`);
      while (usedIds.has(id)) id = `${id}-${index + 1}`;
      usedIds.add(id);
      const axes = Array.isArray(raw && raw.axes) ? raw.axes.slice(0, 8).map(normalizeAxis).filter(Boolean) : [];
      return {
        id,
        family,
        fallback: safeFallbackStack(raw && raw.fallback),
        source: ["system", "local", "project"].includes(raw && raw.source) ? raw.source : "local",
        axes
      };
    });
    return normalized.length ? normalized : fallback;
  }

  function normalizeFeatures(raw) {
    return OPENTYPE_FEATURES.reduce((features, item) => {
      features[item.tag] = raw && Object.prototype.hasOwnProperty.call(raw, item.tag)
        ? raw[item.tag] === true
        : item.tag === "calt";
      return features;
    }, {});
  }

  function normalizeStyle(raw, role, fonts) {
    const fallback = createStylePreset(role);
    const source = raw && typeof raw === "object" ? raw : {};
    const fontId = fonts.some((font) => font.id === source.fontId) ? source.fontId : (fonts.some((font) => font.id === fallback.fontId) ? fallback.fontId : fonts[0].id);
    const font = fonts.find((item) => item.id === fontId) || fonts[0];
    const axes = {};
    font.axes.forEach((axis) => {
      axes[axis.tag] = round(clamp(source.axes && source.axes[axis.tag], axis.min, axis.max, axis.default));
    });
    return {
      id: role,
      name: safeText(source.name, fallback.name, 80),
      text: safeText(source.text, fallback.text, 4000),
      fontId,
      fontSize: round(clamp(source.fontSize, 6, 400, fallback.fontSize)),
      minFontSize: round(clamp(source.minFontSize, 6, 200, fallback.minFontSize)),
      maxFontSize: round(clamp(source.maxFontSize, 8, 400, fallback.maxFontSize)),
      lineHeight: round(clamp(source.lineHeight, 0.7, 3, fallback.lineHeight)),
      fontWeight: Math.round(clamp(source.fontWeight, 1, 1000, fallback.fontWeight)),
      fontStyle: source.fontStyle === "italic" ? "italic" : "normal",
      color: safeColor(source.color, fallback.color),
      align: ["left", "center", "right"].includes(source.align) ? source.align : fallback.align,
      tracking: round(clamp(source.tracking, -0.2, 1, fallback.tracking)),
      kerning: source.kerning !== false,
      ligatures: source.ligatures !== false,
      features: normalizeFeatures(source.features),
      axes,
      autoSize: source.autoSize === true || (source.autoSize == null && fallback.autoSize),
      box: {
        width: Math.round(clamp(source.box && source.box.width, 120, 1800, fallback.box.width)),
        height: Math.round(clamp(source.box && source.box.height, 40, 1200, fallback.box.height))
      },
      path: {
        enabled: source.path && source.path.enabled === true,
        type: ["arc", "wave", "circle"].includes(source.path && source.path.type) ? source.path.type : "arc",
        bend: round(clamp(source.path && source.path.bend, -100, 100, fallback.path.bend)),
        offset: round(clamp(source.path && source.path.offset, 0, 100, fallback.path.offset)),
        reverse: source.path && source.path.reverse === true
      }
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : {};
    const fonts = normalizeFonts(source.fonts);
    const styles = {};
    STYLE_ROLES.forEach((role) => { styles[role.id] = normalizeStyle(source.styles && source.styles[role.id], role.id, fonts); });
    const activeStyle = STYLE_ROLES.some((role) => role.id === source.activeStyle) ? source.activeStyle : "heading";
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        id: safeId(source.meta && source.meta.id, fallback.meta.id),
        name: safeText(source.meta && source.meta.name, fallback.meta.name, 120),
        updatedAt: typeof (source.meta && source.meta.updatedAt) === "string" ? source.meta.updatedAt.slice(0, 40) : fallback.meta.updatedAt
      },
      canvas: {
        width: Math.round(clamp(source.canvas && source.canvas.width, 320, 1920, fallback.canvas.width)),
        height: Math.round(clamp(source.canvas && source.canvas.height, 240, 1200, fallback.canvas.height)),
        background: safeColor(source.canvas && source.canvas.background, fallback.canvas.background),
        showBounds: !(source.canvas && source.canvas.showBounds === false)
      },
      activeStyle,
      fonts,
      styles
    };
  }

  function fontForStyle(project, style) {
    return project.fonts.find((font) => font.id === style.fontId) || project.fonts[0];
  }

  function cssFontStack(font) {
    const fallback = safeFallbackStack(font && font.fallback).split(",").map((entry) => {
      const family = entry.trim();
      return GENERIC_FAMILIES.has(family.toLowerCase()) ? family.toLowerCase() : quoteCss(family);
    }).join(", ");
    return `${quoteCss(safeFontFamily(font && font.family, "Arial"))}, ${fallback}`;
  }

  function featureSettings(style) {
    const settings = [`"liga" ${style.ligatures ? 1 : 0}`, `"kern" ${style.kerning ? 1 : 0}`];
    OPENTYPE_FEATURES.forEach((feature) => settings.push(`"${feature.tag}" ${style.features[feature.tag] ? 1 : 0}`));
    return settings.join(", ");
  }

  function variationSettings(style, font) {
    if (!font || !font.axes.length) return "normal";
    return font.axes.map((axis) => `"${axis.tag}" ${round(style.axes[axis.tag] == null ? axis.default : style.axes[axis.tag])}`).join(", ");
  }

  function styleToCss(projectInput, role) {
    const project = normalizeProject(projectInput);
    const style = project.styles[role] || project.styles.heading;
    const font = fontForStyle(project, style);
    return [
      `font-family: ${cssFontStack(font)};`,
      `font-size: ${round(style.fontSize)}px;`,
      `line-height: ${round(style.lineHeight)};`,
      `font-weight: ${style.fontWeight};`,
      `font-style: ${style.fontStyle};`,
      `letter-spacing: ${round(style.tracking)}em;`,
      `font-kerning: ${style.kerning ? "normal" : "none"};`,
      `font-variant-ligatures: ${style.ligatures ? "common-ligatures contextual" : "none"};`,
      `font-feature-settings: ${featureSettings(style)};`,
      `font-variation-settings: ${variationSettings(style, font)};`,
      `color: ${style.color};`,
      `text-align: ${style.align};`
    ].join("\n  ");
  }

  function exportCss(projectInput) {
    const project = normalizeProject(projectInput);
    const header = `/* ${FORMAT} v${VERSION}. Fonts are referenced locally; no remote font files are embedded. */`;
    const classes = STYLE_ROLES.map((role) => `.${role.className} {\n  ${styleToCss(project, role.id)}\n}`).join("\n\n");
    return `${header}\n\n${classes}\n`;
  }

  function exportProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function buildFontManifest(projectInput, audit) {
    const project = normalizeProject(projectInput);
    const statuses = new Map((Array.isArray(audit) ? audit : []).map((item) => [item.id, item]));
    return {
      format: "hh-typography-font-manifest",
      version: VERSION,
      projectId: project.meta.id,
      fonts: project.fonts.map((font) => ({
        id: font.id,
        family: font.family,
        fallback: font.fallback,
        source: font.source,
        axes: clone(font.axes),
        usedBy: STYLE_ROLES.filter((role) => project.styles[role.id].fontId === font.id).map((role) => role.id),
        audit: statuses.get(font.id)?.status || "not-audited"
      }))
    };
  }

  function exportFontManifest(projectInput, audit) {
    return JSON.stringify(buildFontManifest(projectInput, audit), null, 2);
  }

  function approximateMeasure(text, fontSize, tracking) {
    const content = String(text || "");
    let units = 0;
    for (const character of content) {
      if (/\s/.test(character)) units += 0.32;
      else if (/[MW@#%]/.test(character)) units += 0.9;
      else if (/[ilI.,:;'|!]/.test(character)) units += 0.3;
      else units += 0.56;
    }
    return units * fontSize + Math.max(0, content.length - 1) * tracking * fontSize;
  }

  function wrapParagraph(paragraph, fontSize, maxWidth, tracking, measure) {
    if (!paragraph) return [""];
    const words = paragraph.trim().split(/\s+/);
    const lines = [];
    let line = "";

    function pushLongWord(word) {
      let part = "";
      for (const character of word) {
        const candidate = part + character;
        if (part && measure(candidate, fontSize, tracking) > maxWidth) {
          lines.push(part);
          part = character;
        } else part = candidate;
      }
      return part;
    }

    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate, fontSize, tracking) <= maxWidth) {
        if (!line && measure(word, fontSize, tracking) > maxWidth) line = pushLongWord(word);
        else line = candidate;
      } else {
        lines.push(line);
        line = measure(word, fontSize, tracking) > maxWidth ? pushLongWord(word) : word;
      }
    });
    if (line || !lines.length) lines.push(line);
    return lines;
  }

  function layoutText(text, options, fontSize, measureText) {
    const measure = typeof measureText === "function" ? measureText : approximateMeasure;
    const tracking = clamp(options.tracking, -0.2, 1, 0);
    const maxWidth = clamp(options.width, 20, 5000, 600);
    const paragraphs = String(text == null ? "" : text).split(/\r?\n/);
    const lines = paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, fontSize, maxWidth, tracking, measure));
    const width = lines.reduce((largest, line) => Math.max(largest, measure(line, fontSize, tracking)), 0);
    const height = lines.length * fontSize * clamp(options.lineHeight, 0.7, 3, 1.2);
    return { lines, width: round(width), height: round(height), fontSize: round(fontSize) };
  }

  function fitTextBox(text, options, measureText) {
    const config = options && typeof options === "object" ? options : {};
    const min = clamp(config.minFontSize, 6, 400, 12);
    const max = clamp(config.maxFontSize, min, 400, Math.max(min, 96));
    const requested = clamp(config.fontSize, min, max, max);
    const width = clamp(config.width, 20, 5000, 600);
    const height = clamp(config.height, 20, 5000, 200);
    const evaluate = (size) => layoutText(text, { ...config, width }, size, measureText);
    if (config.autoSize === false) {
      const fixed = evaluate(requested);
      fixed.overflow = fixed.width > width + 0.01 || fixed.height > height + 0.01;
      return fixed;
    }
    let low = min;
    let high = max;
    let best = evaluate(min);
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const candidateSize = (low + high) / 2;
      const candidate = evaluate(candidateSize);
      if (candidate.width <= width + 0.01 && candidate.height <= height + 0.01) {
        best = candidate;
        low = candidateSize;
      } else high = candidateSize;
    }
    best.fontSize = round(Math.max(min, Math.min(max, best.fontSize)), 2);
    best.overflow = best.width > width + 0.01 || best.height > height + 0.01;
    return best;
  }

  function createTextPathD(pathInput, widthInput, heightInput) {
    const path = pathInput || {};
    const width = clamp(widthInput, 120, 4000, 960);
    const height = clamp(heightInput, 80, 3000, 300);
    const margin = Math.min(70, width * 0.08);
    const centerY = height / 2;
    const bend = clamp(path.bend, -100, 100, 24) / 100;
    if (path.type === "circle") {
      const radiusX = Math.max(40, width / 2 - margin);
      const radiusY = Math.max(30, height / 2 - margin * 0.45);
      return `M ${round(width / 2 - radiusX)} ${round(centerY)} A ${round(radiusX)} ${round(radiusY)} 0 1 ${path.reverse ? 0 : 1} ${round(width / 2 + radiusX)} ${round(centerY)} A ${round(radiusX)} ${round(radiusY)} 0 1 ${path.reverse ? 0 : 1} ${round(width / 2 - radiusX)} ${round(centerY)}`;
    }
    if (path.type === "wave") {
      const amplitude = bend * height * 0.35;
      return path.reverse
        ? `M ${round(width - margin)} ${round(centerY)} C ${round(width * 0.72)} ${round(centerY - amplitude)} ${round(width * 0.62)} ${round(centerY + amplitude)} ${round(width / 2)} ${round(centerY)} S ${round(width * 0.28)} ${round(centerY - amplitude)} ${round(margin)} ${round(centerY)}`
        : `M ${round(margin)} ${round(centerY)} C ${round(width * 0.28)} ${round(centerY - amplitude)} ${round(width * 0.38)} ${round(centerY + amplitude)} ${round(width / 2)} ${round(centerY)} S ${round(width * 0.72)} ${round(centerY - amplitude)} ${round(width - margin)} ${round(centerY)}`;
    }
    return path.reverse
      ? `M ${round(width - margin)} ${round(centerY)} Q ${round(width / 2)} ${round(centerY - bend * height * 0.75)} ${round(margin)} ${round(centerY)}`
      : `M ${round(margin)} ${round(centerY)} Q ${round(width / 2)} ${round(centerY - bend * height * 0.75)} ${round(width - margin)} ${round(centerY)}`;
  }

  function svgTextAttributes(style, font, fontSize) {
    const align = style.align === "center" ? "middle" : style.align === "right" ? "end" : "start";
    return `fill="${style.color}" font-family="${escapeHtml(cssFontStack(font))}" font-size="${round(fontSize)}" font-weight="${style.fontWeight}" font-style="${style.fontStyle}" letter-spacing="${round(style.tracking)}em" text-anchor="${align}" style="font-kerning:${style.kerning ? "normal" : "none"};font-feature-settings:${featureSettings(style)};font-variation-settings:${variationSettings(style, font)}"`;
  }

  function renderTextSvg(projectInput, role, measureText) {
    const project = normalizeProject(projectInput);
    const selectedRole = STYLE_ROLES.some((item) => item.id === role) ? role : project.activeStyle;
    const style = project.styles[selectedRole];
    const font = fontForStyle(project, style);
    const width = project.canvas.width;
    const height = project.canvas.height;
    const boxWidth = Math.min(style.box.width, width - 40);
    const boxHeight = Math.min(style.box.height, height - 40);
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;
    const layout = fitTextBox(style.text, {
      width: boxWidth,
      height: boxHeight,
      fontSize: style.fontSize,
      minFontSize: Math.min(style.minFontSize, style.maxFontSize),
      maxFontSize: Math.max(style.minFontSize, style.maxFontSize),
      lineHeight: style.lineHeight,
      tracking: style.tracking,
      autoSize: style.autoSize && !style.path.enabled
    }, measureText);
    const bounds = project.canvas.showBounds ? `<rect x="${round(boxX)}" y="${round(boxY)}" width="${round(boxWidth)}" height="${round(boxHeight)}" rx="4" fill="none" stroke="#62D9E6" stroke-opacity=".46" stroke-dasharray="7 7"/>` : "";
    let content = "";
    if (style.path.enabled) {
      const pathId = `hhtp-path-${selectedRole}`;
      const d = createTextPathD(style.path, width, height);
      content = `<defs><path id="${pathId}" d="${d}"/></defs>${project.canvas.showBounds ? `<path d="${d}" fill="none" stroke="#F25CB4" stroke-opacity=".45" stroke-dasharray="7 7"/>` : ""}<text ${svgTextAttributes(style, font, style.fontSize)}><textPath href="#${pathId}" startOffset="${style.path.offset}%">${escapeHtml(style.text)}</textPath></text>`;
    } else {
      const anchorX = style.align === "center" ? boxX + boxWidth / 2 : style.align === "right" ? boxX + boxWidth : boxX;
      const blockHeight = layout.lines.length * layout.fontSize * style.lineHeight;
      const startY = boxY + Math.max(layout.fontSize, (boxHeight - blockHeight) / 2 + layout.fontSize);
      const spans = layout.lines.map((line, index) => `<tspan x="${round(anchorX)}" y="${round(startY + index * layout.fontSize * style.lineHeight)}">${escapeHtml(line)}</tspan>`).join("");
      content = `<text ${svgTextAttributes(style, font, layout.fontSize)}>${spans}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Xem trước ${escapeHtml(style.name)}"><rect width="100%" height="100%" fill="${project.canvas.background}"/>${bounds}${content}</svg>`;
  }

  function detectCapabilities(scope) {
    const host = scope || {};
    const supports = (property, value) => {
      try { return Boolean(host.CSS && typeof host.CSS.supports === "function" && host.CSS.supports(property, value)); }
      catch (_) { return false; }
    };
    const documentRef = host.document;
    let textPath = false;
    let fontAudit = false;
    try { textPath = Boolean(documentRef && typeof documentRef.createElementNS === "function" && documentRef.createElementNS("http://www.w3.org/2000/svg", "textPath")); }
    catch (_) { textPath = false; }
    try {
      const canvas = documentRef && typeof documentRef.createElement === "function" ? documentRef.createElement("canvas") : null;
      const context = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
      fontAudit = Boolean(context && typeof context.measureText === "function");
    } catch (_) { fontAudit = false; }
    return {
      variableFonts: supports("font-variation-settings", '"wght" 500'),
      openType: supports("font-feature-settings", '"liga" 1'),
      kerning: supports("font-kerning", "normal"),
      textPath,
      fontAudit,
      autoSize: true
    };
  }

  function createBrowserFontChecker(scope) {
    const documentRef = scope && scope.document;
    if (!documentRef || typeof documentRef.createElement !== "function") return null;
    try {
      const canvas = documentRef.createElement("canvas");
      const context = canvas && canvas.getContext && canvas.getContext("2d");
      if (!context || typeof context.measureText !== "function") return null;
      const sample = "mmmmmmmmmWWWWW@#0123456789";
      return (familyInput) => {
        const family = safeFontFamily(familyInput, "");
        if (!family) return null;
        if (GENERIC_FAMILIES.has(family.toLowerCase())) return true;
        return ["monospace", "serif", "sans-serif"].some((generic) => {
          context.font = `72px ${generic}`;
          const baseline = context.measureText(sample).width;
          context.font = `72px ${quoteCss(family)}, ${generic}`;
          return Math.abs(context.measureText(sample).width - baseline) > 0.1;
        });
      };
    } catch (_) {
      return null;
    }
  }

  function auditFonts(projectInput, checker, capabilityInput) {
    const project = normalizeProject(projectInput);
    const capabilities = capabilityInput || detectCapabilities(globalScope);
    const check = typeof checker === "function" ? checker : createBrowserFontChecker(globalScope);
    return project.fonts.map((font) => {
      let result = null;
      try { result = check ? check(font.family) : null; } catch (_) { result = null; }
      const status = result === true ? "available" : result === false ? "missing" : "unknown";
      let variableStatus = "static";
      if (font.axes.length && !capabilities.variableFonts) variableStatus = "unsupported-browser";
      else if (font.axes.length && status === "missing") variableStatus = "unavailable-font";
      else if (font.axes.length && status === "available") variableStatus = "manifest-axes";
      else if (font.axes.length) variableStatus = "unverified";
      return {
        id: font.id,
        family: font.family,
        status,
        variableStatus,
        axes: font.axes.map((axis) => axis.tag),
        usedBy: STYLE_ROLES.filter((role) => project.styles[role.id].fontId === font.id).map((role) => role.id)
      };
    });
  }

  function ensureStyles() {
    const documentRef = globalScope.document;
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhtp{--tp-bg:#080d12;--tp-panel:#0d151d;--tp-panel-2:#111d27;--tp-line:#293b47;--tp-text:#f1f5f6;--tp-muted:#91a4ad;--tp-cyan:#62d9e6;--tp-pink:#f25cb4;--tp-lime:#c8ef73;--tp-yellow:#ffd166;color:var(--tp-text);background:var(--tp-bg);border:1px solid var(--tp-line);border-radius:8px;overflow:hidden;min-width:0;font:500 12px/1.45 Inter,Segoe UI,system-ui,sans-serif;letter-spacing:0}.hhtp *{box-sizing:border-box}.hhtp button,.hhtp input,.hhtp select,.hhtp textarea{font:inherit;letter-spacing:0}.hhtp button{cursor:pointer}.hhtp :focus-visible{outline:2px solid var(--tp-cyan);outline-offset:2px}.hhtp-topbar{min-height:58px;display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--tp-line);background:#0a1118}.hhtp-brand{display:flex;align-items:center;gap:9px;margin-right:auto;min-width:190px}.hhtp-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--tp-pink);border-radius:6px;color:var(--tp-pink);font-weight:900}.hhtp-brand strong,.hhtp-brand small{display:block}.hhtp-brand small,.hhtp-muted{color:var(--tp-muted);font-size:10px}.hhtp-project-name{width:min(250px,24vw);min-height:34px;padding:6px 8px;border:1px solid var(--tp-line);border-radius:5px;background:#081019;color:var(--tp-text)}.hhtp-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:6px 9px;border:1px solid var(--tp-line);border-radius:6px;background:#13202a;color:var(--tp-text)}.hhtp-btn:hover{border-color:var(--tp-cyan);background:#172a35}.hhtp-btn:disabled{cursor:not-allowed;opacity:.42}.hhtp-btn-primary{border-color:transparent;background:var(--tp-cyan);color:#071116;font-weight:850}.hhtp-body{display:grid;grid-template-columns:220px minmax(340px,1fr) 300px;min-height:650px}.hhtp-library,.hhtp-inspector{min-width:0;background:var(--tp-panel);overflow:auto}.hhtp-library{border-right:1px solid var(--tp-line)}.hhtp-inspector{border-left:1px solid var(--tp-line)}.hhtp-section{padding:12px;border-bottom:1px solid var(--tp-line)}.hhtp-section h2,.hhtp-section h3{margin:0 0 9px;font-size:12px}.hhtp-eyebrow{display:block;margin-bottom:8px;color:var(--tp-cyan);font-size:9px;font-weight:900;text-transform:uppercase}.hhtp-role-list{display:grid;gap:6px}.hhtp-role{width:100%;min-height:48px;padding:7px 9px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--tp-text);text-align:left}.hhtp-role span,.hhtp-role small{display:block}.hhtp-role small{color:var(--tp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hhtp-role[aria-selected=true]{border-color:var(--tp-pink);background:#211627;box-shadow:inset 3px 0 var(--tp-pink)}.hhtp-font-form{display:grid;gap:6px}.hhtp-field{display:grid;gap:5px;margin-bottom:9px}.hhtp-field>span,.hhtp-field>legend{color:#b8c6cc;font-size:10px;font-weight:750}.hhtp-field input,.hhtp-field select,.hhtp-field textarea{width:100%;min-height:34px;padding:6px 8px;border:1px solid var(--tp-line);border-radius:5px;background:#081019;color:var(--tp-text)}.hhtp-field textarea{min-height:82px;resize:vertical}.hhtp-row{display:flex;align-items:center;gap:6px}.hhtp-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hhtp-font-list{display:grid;gap:6px;margin-top:10px}.hhtp-font{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:8px;border:1px solid var(--tp-line);border-radius:6px;background:#0a1219}.hhtp-font strong,.hhtp-font small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hhtp-font small{color:var(--tp-muted)}.hhtp-font-state{align-self:start;padding:2px 5px;border-radius:4px;background:#17242c;color:var(--tp-muted);font-size:8px;text-transform:uppercase}.hhtp-font-state[data-state=available]{color:var(--tp-lime)}.hhtp-font-state[data-state=missing]{color:#ff8a8a}.hhtp-font-remove{grid-column:2;width:26px;height:26px;padding:0;border:0;background:transparent;color:var(--tp-muted)}.hhtp-workspace{min-width:0;display:grid;grid-template-rows:auto minmax(390px,1fr) auto;background:#070b0f}.hhtp-canvasbar{display:flex;align-items:center;gap:8px;min-height:44px;padding:7px 11px;border-bottom:1px solid var(--tp-line);background:#0b131a}.hhtp-canvasbar strong{margin-right:auto}.hhtp-stage-wrap{display:grid;place-items:center;min-width:0;padding:22px;background-color:#091017;background-image:linear-gradient(#111c24 1px,transparent 1px),linear-gradient(90deg,#111c24 1px,transparent 1px);background-size:24px 24px;overflow:hidden}.hhtp-stage{width:min(100%,900px);aspect-ratio:12/7;border:1px solid #39515e;border-radius:6px;background:#10151c;box-shadow:0 18px 48px #0008;overflow:hidden}.hhtp-stage svg{display:block;width:100%;height:100%}.hhtp-editor{padding:10px 12px;border-top:1px solid var(--tp-line);background:#0a1118}.hhtp-editor textarea{width:100%;min-height:72px;padding:9px;border:1px solid var(--tp-line);border-radius:5px;background:#070d12;color:var(--tp-text);resize:vertical}.hhtp-editor-meta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;color:var(--tp-muted);font-size:9px}.hhtp-toggle{display:flex;align-items:center;gap:7px;min-height:30px;color:#c0ccd1}.hhtp-toggle input{accent-color:var(--tp-pink)}.hhtp-axis{display:grid;grid-template-columns:minmax(0,1fr) 62px;gap:6px;align-items:center;margin-bottom:8px}.hhtp-axis label{grid-column:1/-1;display:flex;justify-content:space-between;color:#b8c6cc;font-size:10px}.hhtp-axis input[type=range]{width:100%;accent-color:var(--tp-cyan)}.hhtp-axis input[type=number]{width:62px;min-height:30px;padding:4px;border:1px solid var(--tp-line);border-radius:4px;background:#081019;color:var(--tp-text)}.hhtp-features{display:grid;grid-template-columns:1fr 1fr;gap:4px 7px}.hhtp-features .hhtp-toggle{font-size:10px}.hhtp-note{margin:7px 0 0;padding:8px;border-left:3px solid var(--tp-yellow);background:#18170f;color:#cbd1c2;font-size:10px}.hhtp-capabilities{display:grid;grid-template-columns:1fr auto;gap:6px;margin:0}.hhtp-capabilities dt{color:var(--tp-muted)}.hhtp-capabilities dd{margin:0;color:#ffb6d8}.hhtp-capabilities dd[data-supported=true]{color:var(--tp-lime)}.hhtp-status{min-height:30px;padding:7px 11px;border-top:1px solid var(--tp-line);background:#081017;color:var(--tp-muted)}.hhtp-file{display:none}.hhtp-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1050px){.hhtp-body{grid-template-columns:205px minmax(320px,1fr)}.hhtp-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--tp-line);display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.hhtp-inspector .hhtp-section{border-right:1px solid var(--tp-line)}}@media(max-width:720px){.hhtp-topbar{flex-wrap:wrap}.hhtp-brand{width:100%}.hhtp-project-name{width:100%;order:2}.hhtp-topbar .hhtp-btn{flex:1}.hhtp-body{display:block}.hhtp-library{border-right:0;border-bottom:1px solid var(--tp-line)}.hhtp-role-list{grid-template-columns:repeat(3,minmax(0,1fr))}.hhtp-workspace{grid-template-rows:auto minmax(280px,1fr) auto}.hhtp-stage-wrap{padding:10px;min-height:280px}.hhtp-inspector{display:block}.hhtp-inspector .hhtp-section{border-right:0}.hhtp-font-form{grid-template-columns:1fr 1fr}.hhtp-font-form .hhtp-btn{grid-column:1/-1}.hhtp-font-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){.hhtp{border-left:0;border-right:0}.hhtp-role-list,.hhtp-font-list,.hhtp-font-form,.hhtp-grid-2,.hhtp-features{grid-template-columns:1fr}.hhtp-topbar .hhtp-btn{min-width:calc(50% - 5px)}.hhtp-stage-wrap{min-height:230px}.hhtp-editor-meta{display:block}.hhtp-canvasbar .hhtp-muted{display:none}}@media(prefers-reduced-motion:reduce){.hhtp *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    documentRef.head.appendChild(style);
  }

  function downloadText(filename, content, mime) {
    const documentRef = globalScope.document;
    if (!documentRef || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function" || typeof globalScope.Blob !== "function") return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([content], { type: mime || "text/plain" }));
    const anchor = documentRef.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function mount(root) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root).api;
    ensureStyles();

    const storage = (() => {
      try { return globalScope.localStorage || null; } catch (_) { return null; }
    })();
    let project = createDefaultProject();
    try {
      const saved = storage && storage.getItem(STORAGE_KEY);
      if (saved) project = normalizeProject(JSON.parse(saved));
    } catch (_) { /* A valid local default remains available. */ }
    const capabilities = detectCapabilities(globalScope);
    let audit = auditFonts(project, null, capabilities);
    let history = [];
    let future = [];
    let statusTimer = 0;
    let disposed = false;
    const listeners = [];

    root.classList.add("hhtp");
    root.setAttribute("data-graphic-typography-pro", "");
    root.innerHTML = `<header class="hhtp-topbar"><div class="hhtp-brand"><span class="hhtp-mark" aria-hidden="true">Tt</span><div><strong>Typography Studio Pro</strong><small>Type systems · local-first</small></div></div><label class="hhtp-sr" for="hhtp-project-name">Tên dự án</label><input id="hhtp-project-name" class="hhtp-project-name" maxlength="120" data-htp-project-name><button class="hhtp-btn" type="button" data-htp-action="undo" aria-label="Hoàn tác">Undo</button><button class="hhtp-btn" type="button" data-htp-action="redo" aria-label="Làm lại">Redo</button><button class="hhtp-btn" type="button" data-htp-action="import">Nhập project</button><button class="hhtp-btn" type="button" data-htp-action="export-css">Xuất CSS</button><button class="hhtp-btn hhtp-btn-primary" type="button" data-htp-action="export-project">Xuất project</button><input class="hhtp-file" type="file" accept="application/json,.json" data-htp-file aria-label="Chọn project Typography JSON"></header><div class="hhtp-body"><aside class="hhtp-library" aria-label="Thư viện style và font"><section class="hhtp-section"><span class="hhtp-eyebrow">Reusable styles</span><div class="hhtp-role-list" role="tablist" aria-label="Style chữ" data-htp-roles></div></section><section class="hhtp-section"><div class="hhtp-row"><h2 style="margin-right:auto">Project font manifest</h2><button class="hhtp-btn" type="button" data-htp-action="audit">Audit</button></div><form class="hhtp-font-form" data-htp-font-form><label class="hhtp-field"><span>Font family</span><input name="family" maxlength="100" placeholder="Ví dụ: Inter"></label><label class="hhtp-field"><span>Fallback stack</span><input name="fallback" maxlength="160" value="Arial, sans-serif"></label><label class="hhtp-field"><span>Variable axes</span><select name="axes"><option value="static">Static / chưa khai báo</option><option value="weight">Weight wght</option><option value="full">wght · wdth · opsz · slnt</option></select></label><button class="hhtp-btn" type="submit">Thêm vào manifest</button></form><p class="hhtp-note">Studio không tải font từ mạng. Trục biến thiên do manifest khai báo; Font Audit kiểm tra font đang có trên thiết bị.</p><div class="hhtp-font-list" data-htp-font-list></div><button class="hhtp-btn" type="button" style="margin-top:9px;width:100%" data-htp-action="export-manifest">Xuất font manifest</button></section></aside><main class="hhtp-workspace"><div class="hhtp-canvasbar"><strong data-htp-active-label>Heading</strong><span class="hhtp-muted" data-htp-font-label></span><button class="hhtp-btn" type="button" data-htp-action="toggle-bounds" aria-pressed="true">Bounds</button></div><div class="hhtp-stage-wrap"><div class="hhtp-stage" data-htp-stage tabindex="0" aria-label="Canvas xem trước typography"></div></div><section class="hhtp-editor" aria-label="Nội dung style đang chọn"><label class="hhtp-sr" for="hhtp-text">Nội dung xem trước</label><textarea id="hhtp-text" maxlength="4000" data-htp-text></textarea><div class="hhtp-editor-meta"><span data-htp-fit-status></span><span>Ctrl/Cmd + Z để hoàn tác · Ctrl/Cmd + S để lưu local</span></div></section></main><aside class="hhtp-inspector" aria-label="Thuộc tính typography"><section class="hhtp-section"><span class="hhtp-eyebrow">Typography</span><label class="hhtp-field"><span>Tên style</span><input maxlength="80" data-htp-style-name></label><label class="hhtp-field"><span>Font</span><select data-htp-font></select></label><div class="hhtp-grid-2"><label class="hhtp-field"><span>Cỡ chữ</span><input type="number" min="6" max="400" step="1" data-htp-number="fontSize"></label><label class="hhtp-field"><span>Weight</span><input type="number" min="1" max="1000" step="1" data-htp-number="fontWeight"></label><label class="hhtp-field"><span>Line height</span><input type="number" min="0.7" max="3" step="0.01" data-htp-number="lineHeight"></label><label class="hhtp-field"><span>Tracking (em)</span><input type="number" min="-0.2" max="1" step="0.005" data-htp-number="tracking"></label></div><div class="hhtp-grid-2"><label class="hhtp-field"><span>Canh chữ</span><select data-htp-select="align"><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label><label class="hhtp-field"><span>Màu chữ</span><input type="color" data-htp-color></label></div><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="italic"> Italic</label></section><section class="hhtp-section"><span class="hhtp-eyebrow">Variable font axes</span><div data-htp-axes></div></section><section class="hhtp-section"><span class="hhtp-eyebrow">OpenType</span><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="kerning"> Kerning</label><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="ligatures"> Standard ligatures</label><div class="hhtp-features" data-htp-features></div></section><section class="hhtp-section"><span class="hhtp-eyebrow">Text box</span><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="autoSize"> Auto-size text box</label><div class="hhtp-grid-2"><label class="hhtp-field"><span>Box width</span><input type="number" min="120" max="1800" data-htp-box="width"></label><label class="hhtp-field"><span>Box height</span><input type="number" min="40" max="1200" data-htp-box="height"></label><label class="hhtp-field"><span>Min size</span><input type="number" min="6" max="200" data-htp-number="minFontSize"></label><label class="hhtp-field"><span>Max size</span><input type="number" min="8" max="400" data-htp-number="maxFontSize"></label></div><span class="hhtp-eyebrow" style="margin-top:12px">Text on path</span><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="path"> Bật text path</label><label class="hhtp-field"><span>Đường dẫn</span><select data-htp-path="type"><option value="arc">Arc</option><option value="wave">Wave</option><option value="circle">Circle</option></select></label><div class="hhtp-grid-2"><label class="hhtp-field"><span>Bend</span><input type="number" min="-100" max="100" data-htp-path="bend"></label><label class="hhtp-field"><span>Offset %</span><input type="number" min="0" max="100" data-htp-path="offset"></label></div><label class="hhtp-toggle"><input type="checkbox" data-htp-toggle="reversePath"> Đảo hướng path</label><p class="hhtp-note" data-htp-path-note></p></section><section class="hhtp-section"><span class="hhtp-eyebrow">Capability status</span><dl class="hhtp-capabilities" data-htp-capabilities></dl></section></aside></div><footer class="hhtp-status" role="status" aria-live="polite" data-htp-status>Sẵn sàng. Project được lưu cục bộ trên thiết bị.</footer>`;

    function on(node, eventName, handler) {
      if (!node) return;
      node.addEventListener(eventName, handler);
      listeners.push(() => node.removeEventListener(eventName, handler));
    }

    function currentStyle() {
      return project.styles[project.activeStyle];
    }

    function currentFont() {
      return fontForStyle(project, currentStyle());
    }

    function announce(message, persistent) {
      const status = root.querySelector("[data-htp-status]");
      if (status) status.textContent = message;
      globalScope.clearTimeout(statusTimer);
      if (!persistent) statusTimer = globalScope.setTimeout(() => {
        if (status && !disposed) status.textContent = "Đã tự lưu cục bộ trên thiết bị.";
      }, 2600);
    }

    function persist() {
      project.meta.updatedAt = new Date().toISOString();
      try {
        if (!storage) throw new Error("storage unavailable");
        storage.setItem(STORAGE_KEY, JSON.stringify(project));
        return true;
      } catch (_) {
        announce("Không thể lưu local trong trình duyệt này; thay đổi chỉ còn trong phiên hiện tại.", true);
        return false;
      }
    }

    function snapshot() {
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      future = [];
    }

    function refreshHistoryButtons() {
      const undo = root.querySelector('[data-htp-action="undo"]');
      const redo = root.querySelector('[data-htp-action="redo"]');
      if (undo) undo.disabled = history.length === 0;
      if (redo) redo.disabled = future.length === 0;
    }

    function canvasMeasure(text, fontSize, tracking) {
      try {
        const canvas = canvasMeasure.canvas || (canvasMeasure.canvas = globalScope.document.createElement("canvas"));
        const context = canvas.getContext("2d");
        const style = currentStyle();
        context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${cssFontStack(currentFont())}`;
        return context.measureText(String(text)).width + Math.max(0, String(text).length - 1) * tracking * fontSize;
      } catch (_) {
        return approximateMeasure(text, fontSize, tracking);
      }
    }

    function renderRoles() {
      root.querySelector("[data-htp-roles]").innerHTML = STYLE_ROLES.map((role) => {
        const style = project.styles[role.id];
        const selected = project.activeStyle === role.id;
        return `<button class="hhtp-role" type="button" role="tab" id="hhtp-tab-${role.id}" aria-controls="hhtp-text" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-htp-role="${role.id}"><span>${escapeHtml(role.label)}</span><small>${escapeHtml(style.name)}</small></button>`;
      }).join("");
    }

    function renderFonts() {
      const auditMap = new Map(audit.map((item) => [item.id, item]));
      root.querySelector("[data-htp-font-list]").innerHTML = project.fonts.map((font) => {
        const result = auditMap.get(font.id) || { status: "unknown", variableStatus: "unverified" };
        const stateLabel = result.status === "available" ? "Có sẵn" : result.status === "missing" ? "Thiếu" : "Chưa rõ";
        const axes = font.axes.length ? font.axes.map((axis) => axis.tag).join(" · ") : "Static";
        return `<article class="hhtp-font"><div><strong>${escapeHtml(font.family)}</strong><small>${escapeHtml(font.source)} · ${escapeHtml(axes)}</small></div><span class="hhtp-font-state" data-state="${result.status}" title="Variable: ${escapeHtml(result.variableStatus)}">${stateLabel}</span><button class="hhtp-font-remove" type="button" data-htp-font-remove="${escapeHtml(font.id)}" aria-label="Xóa ${escapeHtml(font.family)} khỏi manifest" title="Xóa font">×</button></article>`;
      }).join("");
      const select = root.querySelector("[data-htp-font]");
      select.innerHTML = project.fonts.map((font) => `<option value="${escapeHtml(font.id)}">${escapeHtml(font.family)}</option>`).join("");
      select.value = currentStyle().fontId;
    }

    function renderFeatures() {
      const style = currentStyle();
      root.querySelector("[data-htp-features]").innerHTML = OPENTYPE_FEATURES.map((feature) => `<label class="hhtp-toggle"><input type="checkbox" data-htp-feature="${feature.tag}" ${style.features[feature.tag] ? "checked" : ""} ${capabilities.openType ? "" : "disabled"}> ${escapeHtml(feature.label)}</label>`).join("");
    }

    function renderAxes() {
      const container = root.querySelector("[data-htp-axes]");
      const font = currentFont();
      if (!capabilities.variableFonts) {
        container.innerHTML = '<p class="hhtp-note" role="status">Trình duyệt không hỗ trợ font-variation-settings. CSS export vẫn giữ khai báo trục.</p>';
        return;
      }
      if (!font.axes.length) {
        container.innerHTML = '<p class="hhtp-note" role="status">Font này không có trục trong project manifest.</p>';
        return;
      }
      const style = currentStyle();
      container.innerHTML = `${font.axes.map((axis) => `<div class="hhtp-axis"><label for="hhtp-axis-${axis.tag}"><span>${escapeHtml(axis.name)} · ${axis.tag}</span><span>${axis.min}–${axis.max}</span></label><input id="hhtp-axis-${axis.tag}" type="range" min="${axis.min}" max="${axis.max}" step="${axis.tag === "ital" ? 1 : 0.1}" value="${style.axes[axis.tag]}" data-htp-axis="${axis.tag}"><input type="number" min="${axis.min}" max="${axis.max}" step="${axis.tag === "ital" ? 1 : 0.1}" value="${style.axes[axis.tag]}" data-htp-axis="${axis.tag}" aria-label="Giá trị ${escapeHtml(axis.name)}"></div>`).join("")}<p class="hhtp-note">Trục lấy từ project manifest. Font Audit không thể phân biệt file variable với static có cùng family.</p>`;
    }

    function renderCapabilities() {
      const labels = [
        ["Variable axes", capabilities.variableFonts],
        ["OpenType features", capabilities.openType],
        ["Kerning", capabilities.kerning],
        ["SVG textPath", capabilities.textPath],
        ["Missing-font audit", capabilities.fontAudit],
        ["Auto-size engine", capabilities.autoSize]
      ];
      root.querySelector("[data-htp-capabilities]").innerHTML = labels.map(([label, supported]) => `<dt>${label}</dt><dd data-supported="${supported}">${supported ? "Sẵn sàng" : "Không hỗ trợ"}</dd>`).join("");
      const pathNote = root.querySelector("[data-htp-path-note]");
      pathNote.textContent = capabilities.textPath
        ? "SVG textPath đang khả dụng. Nội dung path được giữ trong project và CSS export chỉ chứa style chữ."
        : "Trình duyệt không hỗ trợ SVG textPath; control bị vô hiệu và preview dùng text thẳng.";
      root.querySelector('[data-htp-toggle="path"]').disabled = !capabilities.textPath;
    }

    function renderPreview() {
      const style = currentStyle();
      const previewProject = clone(project);
      if (!capabilities.textPath) previewProject.styles[project.activeStyle].path.enabled = false;
      root.querySelector("[data-htp-stage]").innerHTML = renderTextSvg(previewProject, project.activeStyle, canvasMeasure);
      root.querySelector("[data-htp-active-label]").textContent = STYLE_ROLES.find((role) => role.id === project.activeStyle).label;
      root.querySelector("[data-htp-font-label]").textContent = `${currentFont().family} · ${style.fontWeight} · ${round(style.tracking)}em`;
      const fitted = fitTextBox(style.text, {
        ...style.box,
        fontSize: style.fontSize,
        minFontSize: Math.min(style.minFontSize, style.maxFontSize),
        maxFontSize: Math.max(style.minFontSize, style.maxFontSize),
        lineHeight: style.lineHeight,
        tracking: style.tracking,
        autoSize: style.autoSize && !style.path.enabled
      }, canvasMeasure);
      root.querySelector("[data-htp-fit-status]").textContent = style.path.enabled
        ? `Text path · ${style.fontSize}px`
        : `${style.autoSize ? "Auto-fit" : "Fixed"} · ${fitted.fontSize}px · ${fitted.lines.length} dòng${fitted.overflow ? " · tràn box" : ""}`;
      const bounds = root.querySelector('[data-htp-action="toggle-bounds"]');
      bounds.setAttribute("aria-pressed", String(project.canvas.showBounds));
    }

    function renderControls() {
      const style = currentStyle();
      root.querySelector("[data-htp-project-name]").value = project.meta.name;
      root.querySelector("[data-htp-text]").value = style.text;
      root.querySelector("[data-htp-style-name]").value = style.name;
      root.querySelectorAll("[data-htp-number]").forEach((input) => { input.value = style[input.dataset.htpNumber]; });
      root.querySelectorAll("[data-htp-box]").forEach((input) => { input.value = style.box[input.dataset.htpBox]; });
      root.querySelectorAll("[data-htp-path]").forEach((input) => { input.value = style.path[input.dataset.htpPath]; });
      root.querySelectorAll("[data-htp-select]").forEach((input) => { input.value = style[input.dataset.htpSelect]; });
      root.querySelector("[data-htp-color]").value = style.color;
      root.querySelector('[data-htp-toggle="italic"]').checked = style.fontStyle === "italic";
      root.querySelector('[data-htp-toggle="kerning"]').checked = style.kerning;
      root.querySelector('[data-htp-toggle="ligatures"]').checked = style.ligatures;
      root.querySelector('[data-htp-toggle="autoSize"]').checked = style.autoSize;
      root.querySelector('[data-htp-toggle="path"]').checked = style.path.enabled;
      root.querySelector('[data-htp-toggle="reversePath"]').checked = style.path.reverse;
      root.querySelector('[data-htp-toggle="kerning"]').disabled = !capabilities.kerning;
      root.querySelector('[data-htp-toggle="ligatures"]').disabled = !capabilities.openType;
    }

    function renderAll() {
      renderRoles();
      renderFonts();
      renderFeatures();
      renderAxes();
      renderControls();
      renderCapabilities();
      renderPreview();
      refreshHistoryButtons();
    }

    function mutate(mutator, options) {
      snapshot();
      mutator(project);
      project = normalizeProject(project);
      audit = auditFonts(project, null, capabilities);
      persist();
      if (options && options.full) renderAll();
      else {
        renderPreview();
        refreshHistoryButtons();
      }
      if (options && options.message) announce(options.message);
    }

    function undo() {
      if (!history.length) return;
      future.push(clone(project));
      project = normalizeProject(history.pop());
      audit = auditFonts(project, null, capabilities);
      persist();
      renderAll();
      announce("Đã hoàn tác.");
    }

    function redo() {
      if (!future.length) return;
      history.push(clone(project));
      project = normalizeProject(future.pop());
      audit = auditFonts(project, null, capabilities);
      persist();
      renderAll();
      announce("Đã làm lại.");
    }

    function saveDownload(filename, content, mime, success) {
      if (downloadText(filename, content, mime)) announce(success);
      else announce("Trình duyệt không hỗ trợ tải tệp ở môi trường này.", true);
    }

    on(root, "click", (event) => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.htpRole) {
        project.activeStyle = button.dataset.htpRole;
        persist();
        renderAll();
        root.querySelector(`[data-htp-role="${project.activeStyle}"]`)?.focus();
        return;
      }
      const action = button.dataset.htpAction;
      if (action === "undo") undo();
      if (action === "redo") redo();
      if (action === "audit") {
        audit = auditFonts(project, null, capabilities);
        renderFonts();
        const missing = audit.filter((font) => font.status === "missing").length;
        const unknown = audit.filter((font) => font.status === "unknown").length;
        announce(missing ? `Font Audit: thiếu ${missing} font.` : unknown ? `Font Audit: ${unknown} font chưa thể xác minh.` : "Font Audit: mọi font trong manifest đều có sẵn.");
      }
      if (action === "toggle-bounds") mutate((draft) => { draft.canvas.showBounds = !draft.canvas.showBounds; }, { message: "Đã đổi hiển thị text bounds." });
      if (action === "import") root.querySelector("[data-htp-file]").click();
      if (action === "export-css") saveDownload("hh-typography-system.css", exportCss(project), "text/css", "Đã xuất CSS typography.");
      if (action === "export-project") saveDownload("hh-typography-project.json", exportProject(project), "application/json", "Đã xuất project JSON.");
      if (action === "export-manifest") saveDownload("hh-font-manifest.json", exportFontManifest(project, audit), "application/json", "Đã xuất font manifest.");
      if (button.dataset.htpFontRemove) {
        const fontId = button.dataset.htpFontRemove;
        if (project.fonts.length === 1) { announce("Project cần giữ ít nhất một font."); return; }
        mutate((draft) => {
          const replacement = draft.fonts.find((font) => font.id !== fontId);
          draft.fonts = draft.fonts.filter((font) => font.id !== fontId);
          STYLE_ROLES.forEach((role) => { if (draft.styles[role.id].fontId === fontId) draft.styles[role.id].fontId = replacement.id; });
        }, { full: true, message: "Đã xóa font khỏi manifest và cập nhật style liên quan." });
      }
    });

    on(root.querySelector("[data-htp-font-form]"), "submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const family = safeFontFamily(form.elements.family.value, "");
      if (!family) { announce("Hãy nhập tên font family."); form.elements.family.focus(); return; }
      if (project.fonts.some((font) => font.family.toLowerCase() === family.toLowerCase())) { announce("Font này đã có trong manifest."); return; }
      const axesPreset = form.elements.axes.value;
      const axes = axesPreset === "weight"
        ? [{ tag: "wght", name: "Weight", min: 100, max: 900, default: 400 }]
        : axesPreset === "full" ? [
          { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
          { tag: "wdth", name: "Width", min: 75, max: 125, default: 100 },
          { tag: "opsz", name: "Optical size", min: 8, max: 144, default: 16 },
          { tag: "slnt", name: "Slant", min: -12, max: 0, default: 0 }
        ] : [];
      mutate((draft) => {
        const id = safeId(`font-${family.toLowerCase().replace(/\s+/g, "-")}`, uid("font"));
        draft.fonts.push({ id, family, fallback: form.elements.fallback.value, source: "local", axes });
        draft.styles[draft.activeStyle].fontId = id;
      }, { full: true, message: "Đã thêm font vào project manifest." });
      form.reset();
      form.elements.fallback.value = "Arial, sans-serif";
    });

    on(root, "input", (event) => {
      const target = event.target;
      if (target.hasAttribute("data-htp-project-name")) mutate((draft) => { draft.meta.name = target.value; });
      if (target.hasAttribute("data-htp-text")) mutate((draft) => { draft.styles[draft.activeStyle].text = target.value; });
      if (target.hasAttribute("data-htp-style-name")) mutate((draft) => { draft.styles[draft.activeStyle].name = target.value; });
      if (target.dataset.htpNumber) mutate((draft) => {
        const style = draft.styles[draft.activeStyle];
        style[target.dataset.htpNumber] = Number(target.value);
        if (target.dataset.htpNumber === "fontWeight" && Object.prototype.hasOwnProperty.call(style.axes, "wght")) style.axes.wght = Number(target.value);
      });
      if (target.dataset.htpBox) mutate((draft) => { draft.styles[draft.activeStyle].box[target.dataset.htpBox] = Number(target.value); });
      if (target.dataset.htpPath && target.type !== "select-one") mutate((draft) => { draft.styles[draft.activeStyle].path[target.dataset.htpPath] = Number(target.value); });
      if (target.hasAttribute("data-htp-color")) mutate((draft) => { draft.styles[draft.activeStyle].color = target.value; });
      if (target.dataset.htpAxis) {
        mutate((draft) => {
          const style = draft.styles[draft.activeStyle];
          style.axes[target.dataset.htpAxis] = Number(target.value);
          if (target.dataset.htpAxis === "wght") style.fontWeight = Number(target.value);
        });
        root.querySelectorAll(`[data-htp-axis="${target.dataset.htpAxis}"]`).forEach((input) => { if (input !== target) input.value = target.value; });
      }
    });

    on(root, "change", (event) => {
      const target = event.target;
      if (target.hasAttribute("data-htp-font")) mutate((draft) => { draft.styles[draft.activeStyle].fontId = target.value; }, { full: true, message: "Đã áp dụng font cho reusable style." });
      if (target.dataset.htpSelect) mutate((draft) => { draft.styles[draft.activeStyle][target.dataset.htpSelect] = target.value; }, { full: true });
      if (target.dataset.htpPath && target.type === "select-one") mutate((draft) => { draft.styles[draft.activeStyle].path[target.dataset.htpPath] = target.value; }, { full: true });
      if (target.dataset.htpFeature) mutate((draft) => { draft.styles[draft.activeStyle].features[target.dataset.htpFeature] = target.checked; }, { message: "Đã cập nhật OpenType feature." });
      if (target.dataset.htpToggle) mutate((draft) => {
        const style = draft.styles[draft.activeStyle];
        if (target.dataset.htpToggle === "italic") style.fontStyle = target.checked ? "italic" : "normal";
        if (target.dataset.htpToggle === "kerning") style.kerning = target.checked;
        if (target.dataset.htpToggle === "ligatures") style.ligatures = target.checked;
        if (target.dataset.htpToggle === "autoSize") style.autoSize = target.checked;
        if (target.dataset.htpToggle === "path") style.path.enabled = target.checked;
        if (target.dataset.htpToggle === "reversePath") style.path.reverse = target.checked;
      }, { full: target.dataset.htpToggle === "path" });
    });

    on(root.querySelector("[data-htp-file]"), "change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { announce("Project vượt giới hạn nhập 2 MB."); event.target.value = ""; return; }
      if (typeof globalScope.FileReader !== "function") { announce("Trình duyệt không hỗ trợ đọc tệp local.", true); return; }
      const reader = new globalScope.FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result || ""));
          if (imported.format !== FORMAT) throw new Error("unsupported format");
          snapshot();
          project = normalizeProject(imported);
          audit = auditFonts(project, null, capabilities);
          persist();
          renderAll();
          announce("Đã nhập Typography project.");
        } catch (_) {
          announce("Tệp không phải Typography Pro project hợp lệ.");
        }
      };
      reader.onerror = () => announce("Không thể đọc tệp project.");
      reader.readAsText(file);
      event.target.value = "";
    });

    on(root, "keydown", (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if (modifier && event.key.toLowerCase() === "s") { event.preventDefault(); persist(); announce("Đã lưu project cục bộ."); return; }
      const tab = event.target.closest('[role="tab"][data-htp-role]');
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const roles = STYLE_ROLES.map((role) => role.id);
      const current = roles.indexOf(tab.dataset.htpRole);
      const next = event.key === "Home" ? 0 : event.key === "End" ? roles.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + roles.length) % roles.length;
      project.activeStyle = roles[next];
      persist();
      renderAll();
      root.querySelector(`[data-htp-role="${roles[next]}"]`)?.focus();
    });

    renderAll();
    persist();

    const fontsReady = globalScope.document && globalScope.document.fonts && globalScope.document.fonts.ready;
    if (fontsReady && typeof fontsReady.then === "function") fontsReady.then(() => {
      if (disposed) return;
      audit = auditFonts(project, null, capabilities);
      renderFonts();
    }).catch(() => {});

    const instanceApi = {
      getProject: () => clone(project),
      setProject: (next) => { snapshot(); project = normalizeProject(next); audit = auditFonts(project, null, capabilities); persist(); renderAll(); return clone(project); },
      getCapabilities: () => ({ ...capabilities }),
      auditFonts: () => { audit = auditFonts(project, null, capabilities); renderFonts(); return clone(audit); },
      exportCss: () => exportCss(project),
      exportProject: () => exportProject(project),
      exportFontManifest: () => exportFontManifest(project, audit)
    };
    mounted.set(root, {
      api: instanceApi,
      cleanup: () => {
        disposed = true;
        globalScope.clearTimeout(statusTimer);
        listeners.splice(0).forEach((remove) => remove());
      }
    });
    return instanceApi;
  }

  function unmount(root) {
    const instance = mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.classList.remove("hhtp");
    root.removeAttribute("data-graphic-typography-pro");
    root.innerHTML = "";
    return true;
  }

  const api = {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    STYLE_ROLES,
    OPENTYPE_FEATURES,
    createDefaultProject,
    createStylePreset,
    normalizeProject,
    fitTextBox,
    createTextPathD,
    renderTextSvg,
    styleToCss,
    exportCss,
    exportProject,
    buildFontManifest,
    exportFontManifest,
    detectCapabilities,
    auditFonts,
    escapeHtml,
    mount,
    unmount
  };

  globalScope.HHGraphicTypographyPro = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
