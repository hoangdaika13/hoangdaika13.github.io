(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-dev-ai";
  const STORAGE_KEY = "hh.graphic-dev-ai.workspace.v1";
  const STYLE_ID = "hh-graphic-dev-ai-styles-v1";
  const MAX_DRAFTS = 40;
  const MAX_FEED = 30;
  const instances = new WeakMap();
  const CONTROLLED_AI_ACTIONS = Object.freeze([
    "background-remove", "generative-expand", "remove-object", "subtitle", "transcript", "chapter",
    "auto-reframe", "silence-detect", "cut-suggest", "thumbnail", "palette", "caption"
  ]);

  const HANDOFF_ITEMS = Object.freeze([
    { id: "layout", label: "Bố cục và constraint đã kiểm tra" },
    { id: "tokens", label: "Màu, font và spacing dùng design token" },
    { id: "contrast", label: "Độ tương phản đạt WCAG AA" },
    { id: "assets", label: "Asset có tên, định dạng và dung lượng rõ ràng" },
    { id: "states", label: "Hover, focus, loading và error đã mô tả" },
    { id: "responsive", label: "Đã kiểm tra desktop, tablet và mobile" }
  ]);

  const DEFAULT_TOKENS = Object.freeze({
    light: {
      background: "#F7F8FC", surface: "#FFFFFF", text: "#151826",
      muted: "#62697A", primary: "#B9368D", secondary: "#167E8A",
      border: "#D7DAE4", success: "#19764C", warning: "#9A5A00"
    },
    dark: {
      background: "#090C14", surface: "#111723", text: "#F4F5FB",
      muted: "#9BA4B7", primary: "#F05CAF", secondary: "#62D7E3",
      border: "#2A3342", success: "#67DBA1", warning: "#F1C75B"
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radius: { sm: 4, md: 8, lg: 16 },
    typography: { family: "Inter, system-ui, sans-serif", base: 16, scale: 1.25 }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeText(value, maxLength) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maxLength || 1000);
  }

  function sanitizeSvg(value) {
    return String(value == null ? "" : value)
      .replace(/<\/?(?:script|foreignObject|iframe|object|embed|audio|video)\b[^>]*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(?:href|xlink:href)\s*=\s*(?:"(?:https?:|data:|javascript:)[^"]*"|'(?:https?:|data:|javascript:)[^']*')/gi, "");
  }

  function sanitizePayload(value, depth) {
    const level = Number(depth) || 0;
    if (level > 6) return null;
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return safeText(value, 12000);
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizePayload(item, level + 1));
    if (typeof value !== "object") return null;
    const result = {};
    Object.keys(value).slice(0, 120).forEach((key) => {
      if (/^(?:api[_-]?key|secret|token|password|authorization)$/i.test(key)) return;
      result[safeText(key, 80)] = key === "svg" ? sanitizeSvg(value[key]) : sanitizePayload(value[key], level + 1);
    });
    return result;
  }

  function assertServerAdapter(adapter) {
    if (typeof adapter === "function") return true;
    if (!adapter || typeof adapter.generateDraft !== "function") throw new Error("Provider adapter server-side chưa được cấu hình.");
    for (const key of Object.keys(adapter)) {
      if (/api[_-]?key|secret|token|password|authorization/i.test(key)) throw new Error("Không được truyền API key hoặc secret xuống frontend.");
    }
    return true;
  }

  function normalizeHex(value, fallback) {
    const text = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) return `#${text.slice(1).split("").map((part) => part + part).join("")}`.toUpperCase();
    return fallback || "#000000";
  }

  function hexToRgb(value) {
    const color = normalizeHex(value, "#000000");
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16)
    };
  }

  function rgbToHex(red, green, blue) {
    const channel = (value) => Math.round(clamp(value, 0, 255, 0)).toString(16).padStart(2, "0");
    return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
  }

  function relativeLuminance(color) {
    const rgb = hexToRgb(color);
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
  }

  function contrastRatio(foreground, background) {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  function evaluateContrast(foreground, background, fontSize, bold) {
    const ratio = contrastRatio(foreground, background);
    const large = Number(fontSize) >= 24 || (Boolean(bold) && Number(fontSize) >= 18.66);
    return {
      ratio: Math.round(ratio * 100) / 100,
      largeText: large,
      aa: ratio >= (large ? 3 : 4.5),
      aaa: ratio >= (large ? 4.5 : 7),
      label: ratio >= (large ? 4.5 : 7) ? "AAA" : ratio >= (large ? 3 : 4.5) ? "AA" : "Chưa đạt"
    };
  }

  function defaultLayer() {
    return {
      id: "hero-card", name: "Hero Card", type: "frame",
      x: 96, y: 72, width: 640, height: 360,
      fill: "#111723", textColor: "#F4F5FB", borderColor: "#2A3342",
      borderWidth: 1, radius: 16, opacity: 1,
      fontFamily: "Inter, system-ui, sans-serif", fontSize: 32, fontWeight: 700,
      lineHeight: 1.15, letterSpacing: 0, padding: 24, gap: 16,
      text: "Không gian sáng tạo HH"
    };
  }

  function normalizeLayer(input) {
    const source = input && typeof input === "object" ? input : {};
    const fallback = defaultLayer();
    return {
      id: safeText(source.id || fallback.id, 80),
      name: safeText(source.name || fallback.name, 120),
      type: ["frame", "text", "shape", "component"].includes(source.type) ? source.type : fallback.type,
      x: clamp(source.x, -100000, 100000, fallback.x), y: clamp(source.y, -100000, 100000, fallback.y),
      width: clamp(source.width, 1, 100000, fallback.width), height: clamp(source.height, 1, 100000, fallback.height),
      fill: normalizeHex(source.fill, fallback.fill), textColor: normalizeHex(source.textColor, fallback.textColor),
      borderColor: normalizeHex(source.borderColor, fallback.borderColor),
      borderWidth: clamp(source.borderWidth, 0, 100, fallback.borderWidth), radius: clamp(source.radius, 0, 1000, fallback.radius),
      opacity: clamp(source.opacity, 0, 1, fallback.opacity), fontFamily: safeText(source.fontFamily || fallback.fontFamily, 160),
      fontSize: clamp(source.fontSize, 1, 1000, fallback.fontSize), fontWeight: clamp(source.fontWeight, 100, 900, fallback.fontWeight),
      lineHeight: clamp(source.lineHeight, 0.5, 5, fallback.lineHeight), letterSpacing: clamp(source.letterSpacing, -20, 100, fallback.letterSpacing),
      padding: clamp(source.padding, 0, 1000, fallback.padding), gap: clamp(source.gap, 0, 1000, fallback.gap),
      text: safeText(source.text || fallback.text, 1000)
    };
  }

  function inspectLayer(input) {
    const layer = normalizeLayer(input);
    return {
      layer,
      bounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, right: layer.x + layer.width, bottom: layer.y + layer.height },
      colors: { fill: layer.fill, text: layer.textColor, border: layer.borderColor, opacity: layer.opacity },
      typography: { family: layer.fontFamily, size: layer.fontSize, weight: layer.fontWeight, lineHeight: layer.lineHeight, letterSpacing: layer.letterSpacing },
      spacing: { padding: layer.padding, gap: layer.gap },
      border: { width: layer.borderWidth, color: layer.borderColor, radius: layer.radius },
      contrast: evaluateContrast(layer.textColor, layer.fill, layer.fontSize, layer.fontWeight >= 700)
    };
  }

  function normalizeTokens(input) {
    const source = input && typeof input === "object" ? input : {};
    const result = clone(DEFAULT_TOKENS);
    ["light", "dark"].forEach((theme) => {
      Object.keys(result[theme]).forEach((key) => {
        result[theme][key] = normalizeHex(source[theme] && source[theme][key], result[theme][key]);
      });
    });
    ["spacing", "radius"].forEach((group) => {
      Object.keys(result[group]).forEach((key) => {
        result[group][key] = clamp(source[group] && source[group][key], 0, 1000, result[group][key]);
      });
    });
    result.typography.family = safeText(source.typography && source.typography.family || result.typography.family, 160);
    result.typography.base = clamp(source.typography && source.typography.base, 8, 96, result.typography.base);
    result.typography.scale = clamp(source.typography && source.typography.scale, 1, 2, result.typography.scale);
    return result;
  }

  function kebab(value) {
    return String(value).replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  function tokensToCss(tokensInput) {
    const tokens = normalizeTokens(tokensInput);
    const themeLines = (theme) => Object.entries(tokens[theme]).map(([key, value]) => `  --hh-${kebab(key)}: ${value};`).join("\n");
    const spacing = Object.entries(tokens.spacing).map(([key, value]) => `  --hh-space-${key}: ${value}px;`).join("\n");
    const radius = Object.entries(tokens.radius).map(([key, value]) => `  --hh-radius-${key}: ${value}px;`).join("\n");
    return `:root {\n${themeLines("light")}\n${spacing}\n${radius}\n  --hh-font-family: ${tokens.typography.family};\n  --hh-font-base: ${tokens.typography.base}px;\n}\n[data-theme="dark"] {\n${themeLines("dark")}\n}`;
  }

  function tokensToTailwind(tokensInput) {
    const tokens = normalizeTokens(tokensInput);
    return `/** Generated by HH Dev Mode */\nmodule.exports = ${JSON.stringify({
      theme: { extend: { colors: { light: tokens.light, dark: tokens.dark }, spacing: tokens.spacing, borderRadius: tokens.radius, fontFamily: { brand: [tokens.typography.family] } } }
    }, null, 2)};`;
  }

  function tokensToJson(tokensInput) {
    return JSON.stringify({ format: "hh-design-tokens", version: 1, tokens: normalizeTokens(tokensInput) }, null, 2);
  }

  function componentSnippets(layerInput) {
    const layer = normalizeLayer(layerInput);
    const className = `hh-${kebab(layer.name) || "component"}`;
    const svgText = escapeHtml(layer.text);
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(layer.width)} ${Math.round(layer.height)}" role="img" aria-label="${escapeHtml(layer.name)}"><rect width="100%" height="100%" rx="${layer.radius}" fill="${layer.fill}" stroke="${layer.borderColor}" stroke-width="${layer.borderWidth}"/><text x="${layer.padding}" y="${layer.padding + layer.fontSize}" fill="${layer.textColor}" font-family="${escapeHtml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}">${svgText}</text></svg>`,
      css: `.${className} {\n  width: ${layer.width}px;\n  min-height: ${layer.height}px;\n  padding: ${layer.padding}px;\n  display: grid;\n  gap: ${layer.gap}px;\n  color: ${layer.textColor};\n  background: ${layer.fill};\n  border: ${layer.borderWidth}px solid ${layer.borderColor};\n  border-radius: ${layer.radius}px;\n  font: ${layer.fontWeight} ${layer.fontSize}px/${layer.lineHeight} ${layer.fontFamily};\n  opacity: ${layer.opacity};\n}`,
      html: `<section class="${className}" aria-labelledby="${layer.id}-title"><h2 id="${layer.id}-title">${escapeHtml(layer.text)}</h2></section>`
    };
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seed >>> 0 || 1;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function createVectorDraft(promptInput, kindInput) {
    const prompt = safeText(promptInput || "HH Creative", 300);
    const kind = kindInput === "icon" ? "icon" : "vector";
    const random = seededRandom(hashString(`${kind}:${prompt}`));
    const hue = Math.round(random() * 359);
    const secondHue = (hue + 72 + Math.round(random() * 90)) % 360;
    const points = Array.from({ length: kind === "icon" ? 6 : 8 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / (kind === "icon" ? 6 : 8) - Math.PI / 2;
      const radius = (index % 2 ? 62 : 100) * (0.82 + random() * 0.18);
      return `${128 + Math.cos(angle) * radius},${128 + Math.sin(angle) * radius}`;
    }).join(" ");
    const label = escapeHtml(prompt.slice(0, 36));
    return {
      kind,
      prompt,
      palette: [`hsl(${hue} 82% 62%)`, `hsl(${secondHue} 78% 58%)`, "#0B1020"],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${label}"><defs><linearGradient id="hhDraft" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 82% 62%)"/><stop offset="1" stop-color="hsl(${secondHue} 78% 58%)"/></linearGradient></defs><rect width="256" height="256" rx="48" fill="#0B1020"/><polygon points="${points}" fill="url(#hhDraft)" opacity=".92"/><circle cx="128" cy="128" r="${kind === "icon" ? 42 : 30}" fill="#FFFFFF" opacity=".9"/><text x="128" y="238" text-anchor="middle" fill="#FFFFFF" font-family="system-ui" font-size="12">${label}</text></svg>`
    };
  }

  function extractPaletteFromPixels(pixelsInput, countInput) {
    const pixels = pixelsInput || [];
    const count = Math.round(clamp(countInput, 1, 12, 6));
    const buckets = new Map();
    for (let index = 0; index + 2 < pixels.length; index += 4) {
      if (pixels[index + 3] != null && pixels[index + 3] < 128) continue;
      const red = Math.round(pixels[index] / 32) * 32;
      const green = Math.round(pixels[index + 1] / 32) * 32;
      const blue = Math.round(pixels[index + 2] / 32) * 32;
      const color = rgbToHex(Math.min(255, red), Math.min(255, green), Math.min(255, blue));
      buckets.set(color, (buckets.get(color) || 0) + 1);
    }
    const sorted = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
    const result = [];
    for (const [color] of sorted) {
      const rgb = hexToRgb(color);
      const distinct = result.every((existing) => {
        const other = hexToRgb(existing);
        return Math.hypot(rgb.r - other.r, rgb.g - other.g, rgb.b - other.b) > 42;
      });
      if (distinct) result.push(color);
      if (result.length >= count) break;
    }
    return result.length ? result : ["#F05CAF", "#62D7E3", "#0B1020"];
  }

  function suggestKeyframes(promptInput) {
    const prompt = safeText(promptInput, 500).toLowerCase();
    const duration = /chậm|slow|êm/.test(prompt) ? 2.4 : /nhanh|fast|nảy/.test(prompt) ? 0.6 : 1.2;
    const property = /xoay|rotate/.test(prompt) ? "rotation" : /mờ|fade|opacity/.test(prompt) ? "opacity" : /màu|color/.test(prompt) ? "fill" : /scale|phóng|zoom/.test(prompt) ? "scale" : "positionY";
    const values = property === "opacity" ? [0, 1, 1] : property === "rotation" ? [0, 180, 360] : property === "fill" ? ["#F05CAF", "#62D7E3", "#C8EF73"] : property === "scale" ? [0.72, 1.08, 1] : [24, -8, 0];
    return {
      duration,
      easing: /nảy|bounce/.test(prompt) ? "cubic-bezier(.34,1.56,.64,1)" : /linear|đều/.test(prompt) ? "linear" : "cubic-bezier(.22,1,.36,1)",
      property,
      keyframes: [0, 0.62, 1].map((offset, index) => ({ offset, value: values[index] })),
      rationale: `Gợi ý cục bộ từ từ khóa “${safeText(promptInput || "chuyển động", 80)}”.`
    };
  }

  function suggestRig(modelInput) {
    const model = modelInput && typeof modelInput === "object" ? modelInput : {};
    const width = clamp(model.width, 64, 8192, 800);
    const height = clamp(model.height, 64, 8192, 1200);
    const center = width / 2;
    const point = (id, x, y, parent) => ({ id, x: Math.round(x), y: Math.round(y), parent: parent || null, confidence: 0.62 });
    const joints = [
      point("head", center, height * 0.12), point("neck", center, height * 0.22, "head"),
      point("chest", center, height * 0.34, "neck"), point("hips", center, height * 0.52, "chest"),
      point("leftShoulder", width * 0.36, height * 0.29, "chest"), point("leftElbow", width * 0.25, height * 0.42, "leftShoulder"), point("leftHand", width * 0.18, height * 0.56, "leftElbow"),
      point("rightShoulder", width * 0.64, height * 0.29, "chest"), point("rightElbow", width * 0.75, height * 0.42, "rightShoulder"), point("rightHand", width * 0.82, height * 0.56, "rightElbow"),
      point("leftHip", width * 0.44, height * 0.53, "hips"), point("leftKnee", width * 0.42, height * 0.73, "leftHip"), point("leftFoot", width * 0.39, height * 0.94, "leftKnee"),
      point("rightHip", width * 0.56, height * 0.53, "hips"), point("rightKnee", width * 0.58, height * 0.73, "rightHip"), point("rightFoot", width * 0.61, height * 0.94, "rightKnee")
    ];
    return { width, height, joints, ikChains: [["leftShoulder", "leftElbow", "leftHand"], ["rightShoulder", "rightElbow", "rightHand"], ["leftHip", "leftKnee", "leftFoot"], ["rightHip", "rightKnee", "rightFoot"]], note: "Rig heuristic là bản nháp cần người dùng kiểm tra lại vị trí khớp." };
  }

  function suggestExpressionPose(promptInput) {
    const prompt = safeText(promptInput, 400).toLowerCase();
    const expression = /vui|happy|cười/.test(prompt) ? "happy" : /buồn|sad/.test(prompt) ? "sad" : /giận|angry/.test(prompt) ? "angry" : /ngạc nhiên|surprise/.test(prompt) ? "surprised" : "neutral";
    const pose = /chạy|run/.test(prompt) ? "run" : /nhảy|jump|dance/.test(prompt) ? "jump" : /ngồi|sit/.test(prompt) ? "sit" : /chiến|fight/.test(prompt) ? "fight" : /vẫy|wave/.test(prompt) ? "wave" : "idle";
    return { expression, pose, strength: /mạnh|rất|dramatic/.test(prompt) ? 0.9 : 0.65, editable: true };
  }

  function storyboardToScenes(textInput) {
    const text = safeText(textInput, 5000).trim();
    const segments = text.split(/(?:\r?\n)+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
    return (segments.length ? segments : ["Mở đầu giới thiệu ý tưởng"]).map((description, index) => ({
      id: `scene-${index + 1}`, order: index + 1,
      shot: /cận|close/.test(description.toLowerCase()) ? "Cận cảnh" : /toàn|wide/.test(description.toLowerCase()) ? "Toàn cảnh" : index === 0 ? "Toàn cảnh" : "Trung cảnh",
      duration: Math.max(2, Math.min(8, Math.round(description.split(/\s+/).length / 2))),
      description: safeText(description, 400), transition: index === 0 ? "Mở" : "Dissolve", draft: true
    }));
  }

  function auditLayout(input) {
    const source = input && typeof input === "object" ? input : {};
    const frame = { width: clamp(source.frame && source.frame.width, 1, 100000, 1440), height: clamp(source.frame && source.frame.height, 1, 100000, 900) };
    const layers = Array.isArray(source.layers) ? source.layers : [source.layer || defaultLayer()];
    const issues = [];
    layers.map(normalizeLayer).forEach((layer) => {
      if (layer.x < 0 || layer.y < 0 || layer.x + layer.width > frame.width || layer.y + layer.height > frame.height) issues.push({ severity: "error", layerId: layer.id, code: "overflow", message: `${layer.name} nằm ngoài frame.` });
      const contrast = evaluateContrast(layer.textColor, layer.fill, layer.fontSize, layer.fontWeight >= 700);
      if (!contrast.aa) issues.push({ severity: "error", layerId: layer.id, code: "contrast", message: `${layer.name} chỉ đạt ${contrast.ratio}:1, chưa đạt WCAG AA.` });
      const estimatedCharacters = Math.max(1, Math.floor((layer.width - layer.padding * 2) / Math.max(1, layer.fontSize * 0.54))) * Math.max(1, Math.floor((layer.height - layer.padding * 2) / Math.max(1, layer.fontSize * layer.lineHeight)));
      if (layer.text.length > estimatedCharacters) issues.push({ severity: "warning", layerId: layer.id, code: "text-overflow", message: `${layer.name} có nguy cơ tràn chữ.` });
      if (layer.width < 44 || layer.height < 44) issues.push({ severity: "warning", layerId: layer.id, code: "touch-target", message: `${layer.name} nhỏ hơn vùng chạm 44 × 44.` });
    });
    return { frame, issues, score: Math.max(0, 100 - issues.filter((item) => item.severity === "error").length * 24 - issues.filter((item) => item.severity === "warning").length * 9), checkedAt: new Date().toISOString() };
  }

  function controlledDraftPayload(action, promptInput, contextInput) {
    const prompt = safeText(promptInput, 2000).trim();
    const context = contextInput && typeof contextInput === "object" ? contextInput : {};
    const media = sanitizePayload(context.media || {}, 0);
    const common = { operation: action, editable: true, overwrite: false, media, note: "Bản nháp đề xuất. Chỉ áp dụng sau khi người dùng duyệt." };
    if (["background-remove", "generative-expand", "remove-object"].includes(action)) {
      return { ...common, requiresProvider: true, mask: { mode: action === "background-remove" ? "subject" : "manual", feather: 8, refineEdge: true }, prompt };
    }
    if (action === "transcript") return { ...common, language: safeText(context.language || "vi", 12), segments: storyboardToScenes(prompt).map((scene) => ({ startMs: (scene.order - 1) * 4000, endMs: scene.order * 4000, text: scene.description, confidence: null })) };
    if (action === "subtitle") return { ...common, format: "srt", language: safeText(context.language || "vi", 12), cues: storyboardToScenes(prompt).map((scene) => ({ index: scene.order, startMs: (scene.order - 1) * 4000, endMs: scene.order * 4000, text: scene.description })) };
    if (action === "chapter") return { ...common, chapters: storyboardToScenes(prompt).map((scene) => ({ timeMs: (scene.order - 1) * 15000, title: scene.description.slice(0, 80) })) };
    if (action === "auto-reframe") return { ...common, targets: ["9:16", "1:1", "4:5", "16:9"], subjectTracking: true, safeZone: true, keyframes: [] };
    if (action === "silence-detect") return { ...common, thresholdDb: clamp(context.thresholdDb, -80, -10, -42), minimumMs: clamp(context.minimumMs, 100, 10000, 700), ranges: [], analysisRequired: true };
    if (action === "cut-suggest") return { ...common, strategy: "speaker-and-silence", suggestions: [], analysisRequired: true, keepSource: true };
    if (action === "thumbnail") return { ...common, canvas: { width: 1280, height: 720 }, variants: ["subject-left", "subject-center", "subject-right"], headline: prompt.slice(0, 80), safeZone: true };
    if (action === "palette") return { ...common, colors: (Array.isArray(context.colors) ? context.colors : ["#F05CAF", "#62D7E3", "#0B1020"]).slice(0, 12).map((color) => normalizeHex(color, "#000000")) };
    if (action === "caption") return { ...common, variants: [prompt || "Nội dung mới từ HH Creative", `${prompt || "Khám phá nội dung"} #HHCreative`], language: safeText(context.language || "vi", 12) };
    return common;
  }

  async function requestProviderDraft(adapter, actionInput, promptInput, contextInput) {
    assertServerAdapter(adapter);
    const action = CONTROLLED_AI_ACTIONS.includes(actionInput) ? actionInput : "caption";
    const sourceSnapshot = sanitizePayload(contextInput || {}, 0);
    const request = { action: "controlled-media-draft", operation: action, prompt: safeText(promptInput, 2000), context: sourceSnapshot, policy: { draftOnly: true, overwrite: false } };
    const response = typeof adapter === "function" ? await adapter(request) : await adapter.generateDraft(request);
    const payload = sanitizePayload(response && response.payload !== undefined ? response.payload : response, 0);
    return { id: uid("draft"), action, prompt: request.prompt, createdAt: new Date().toISOString(), status: "draft", source: "provider-adapter", overwrite: false, sourceSnapshot, payload };
  }

  function draftPayload(action, prompt, context) {
    if (CONTROLLED_AI_ACTIONS.includes(action)) return controlledDraftPayload(action, prompt, context);
    if (action === "vector" || action === "icon") return createVectorDraft(prompt, action);
    if (action === "keyframes") return suggestKeyframes(prompt);
    if (action === "rig") return suggestRig(context && context.model);
    if (action === "expression") return suggestExpressionPose(prompt);
    if (action === "storyboard") return { scenes: storyboardToScenes(prompt) };
    if (action === "audit") return auditLayout(context || {});
    return { text: safeText(prompt || "Bản nháp mới", 1000) };
  }

  function createDraft(actionInput, promptInput, context) {
    const action = ["vector", "icon", "keyframes", "rig", "expression", "storyboard", "audit", "remote", ...CONTROLLED_AI_ACTIONS].includes(actionInput) ? actionInput : "vector";
    return {
      id: uid("draft"), action, prompt: safeText(promptInput || "", 2000),
      createdAt: new Date().toISOString(), status: "draft", source: action === "remote" ? "adapter" : "local-deterministic",
      overwrite: false, sourceSnapshot: sanitizePayload(context || {}, 0), payload: draftPayload(action, promptInput, context)
    };
  }

  function normalizeDraft(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      id: safeText(source.id || uid("draft"), 100), action: safeText(source.action || "remote", 40),
      prompt: safeText(source.prompt || "", 2000), createdAt: source.createdAt || new Date().toISOString(),
      status: "draft", source: ["adapter", "provider-adapter"].includes(source.source) ? source.source : "local-deterministic",
      overwrite: false, sourceSnapshot: sanitizePayload(source.sourceSnapshot || {}, 0),
      payload: source.payload && typeof source.payload === "object" ? sanitizePayload(source.payload, 0) : { text: safeText(source.payload, 4000) }
    };
  }

  function createDefaultWorkspace() {
    return {
      format: FORMAT, version: VERSION, activeTab: "inspect", layer: defaultLayer(), tokens: clone(DEFAULT_TOKENS),
      handoff: { status: "working", checklist: HANDOFF_ITEMS.map((item) => ({ id: item.id, done: false })), note: "", owner: "HH Creative" },
      drafts: [], feed: [{ id: uid("feed"), at: new Date().toISOString(), text: "Đã tạo workspace Dev Mode." }]
    };
  }

  function normalizeWorkspace(input) {
    const fallback = createDefaultWorkspace();
    const source = input && typeof input === "object" ? input : {};
    return {
      format: FORMAT, version: VERSION,
      activeTab: ["inspect", "tokens", "handoff", "ai", "drafts"].includes(source.activeTab) ? source.activeTab : "inspect",
      layer: normalizeLayer(source.layer), tokens: normalizeTokens(source.tokens),
      handoff: {
        status: ["working", "review", "ready"].includes(source.handoff && source.handoff.status) ? source.handoff.status : "working",
        checklist: HANDOFF_ITEMS.map((item) => ({ id: item.id, done: Boolean(source.handoff && Array.isArray(source.handoff.checklist) && source.handoff.checklist.find((entry) => entry.id === item.id && entry.done)) })),
        note: safeText(source.handoff && source.handoff.note || "", 2000), owner: safeText(source.handoff && source.handoff.owner || fallback.handoff.owner, 120)
      },
      drafts: (Array.isArray(source.drafts) ? source.drafts : []).slice(0, MAX_DRAFTS).map(normalizeDraft),
      feed: (Array.isArray(source.feed) ? source.feed : fallback.feed).slice(0, MAX_FEED).map((entry) => ({ id: safeText(entry.id || uid("feed"), 100), at: entry.at || new Date().toISOString(), text: safeText(entry.text, 240) }))
    };
  }

  function serializeWorkspace(workspace) {
    return JSON.stringify(normalizeWorkspace(workspace), null, 2);
  }

  function addStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hda{--hda-bg:#090d15;--hda-panel:#111722;--hda-panel-2:#0d131d;--hda-border:#293444;--hda-text:#f4f6fb;--hda-muted:#9ca8ba;--hda-cyan:#62d7e3;--hda-pink:#f05caf;--hda-lime:#c8ef73;color:var(--hda-text);background:var(--hda-bg);font-family:Inter,system-ui,sans-serif;min-height:720px;letter-spacing:0}.hda *{box-sizing:border-box}.hda button,.hda input,.hda select,.hda textarea{font:inherit;letter-spacing:0}.hda button{cursor:pointer}.hda-shell{min-height:720px;border:1px solid var(--hda-border);background:radial-gradient(circle at 12% 0%,rgba(240,92,175,.13),transparent 30%),radial-gradient(circle at 90% 5%,rgba(98,215,227,.12),transparent 30%),var(--hda-bg)}.hda-head{display:flex;align-items:center;gap:14px;padding:16px 18px;border-bottom:1px solid var(--hda-border);background:rgba(13,19,29,.92)}.hda-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--hda-cyan);border-radius:8px;background:linear-gradient(135deg,rgba(240,92,175,.3),rgba(98,215,227,.22));font-weight:900}.hda-title{min-width:0;flex:1}.hda-title h2{margin:0;font-size:18px}.hda-title p{margin:4px 0 0;color:var(--hda-muted);font-size:12px}.hda-actions,.hda-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hda button,.hda-file-label{min-height:36px;padding:0 12px;border:1px solid var(--hda-border);border-radius:6px;color:var(--hda-text);background:#151d29;display:inline-flex;align-items:center;justify-content:center}.hda button:hover,.hda button:focus-visible,.hda-file-label:hover{border-color:var(--hda-cyan);box-shadow:0 0 0 2px rgba(98,215,227,.13)}.hda button.is-primary{color:#071018;background:linear-gradient(90deg,var(--hda-lime),var(--hda-cyan));border-color:transparent;font-weight:800}.hda button:disabled{cursor:not-allowed;opacity:.45}.hda-tabs{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:1px;background:var(--hda-border);border-bottom:1px solid var(--hda-border)}.hda-tab{border:0!important;border-radius:0!important;background:var(--hda-panel-2)!important;color:var(--hda-muted)!important;min-height:48px!important}.hda-tab[aria-selected="true"]{color:var(--hda-text)!important;background:linear-gradient(180deg,rgba(98,215,227,.16),var(--hda-panel))!important;box-shadow:inset 0 -2px var(--hda-cyan)!important}.hda-view{padding:16px}.hda-grid{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:14px}.hda-card{border:1px solid var(--hda-border);border-radius:8px;background:linear-gradient(145deg,rgba(20,28,40,.98),rgba(11,16,25,.98));padding:14px;min-width:0}.hda-card h3{font-size:14px;margin:0 0 12px}.hda-card h4{font-size:12px;color:var(--hda-cyan);margin:16px 0 8px}.hda-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hda label{display:grid;gap:5px;color:var(--hda-muted);font-size:11px}.hda input,.hda select,.hda textarea{width:100%;min-height:38px;border:1px solid var(--hda-border);border-radius:5px;background:#090f17;color:var(--hda-text);padding:8px 10px}.hda textarea{min-height:92px;resize:vertical}.hda input[type="color"]{padding:3px}.hda-preview{min-height:360px;display:grid;place-items:center;padding:32px;overflow:auto;background-color:#080c13;background-image:linear-gradient(45deg,#121925 25%,transparent 25%),linear-gradient(-45deg,#121925 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#121925 75%),linear-gradient(-45deg,transparent 75%,#121925 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.hda-preview-layer{display:grid;align-content:center;overflow:hidden;transition:transform .2s ease;box-shadow:0 24px 60px rgba(0,0,0,.38)}.hda-preview-layer strong{overflow-wrap:anywhere}.hda-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.hda-metric{padding:10px;border:1px solid var(--hda-border);border-radius:6px;background:#0a1019}.hda-metric span{display:block;color:var(--hda-muted);font-size:10px}.hda-metric strong{font-size:13px}.hda-pass{color:var(--hda-lime)}.hda-fail{color:#ff7f9f}.hda-token-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.hda-swatches{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.hda-swatch{min-width:0}.hda-swatch input{height:52px}.hda-code{margin:0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border:1px solid var(--hda-border);border-radius:6px;background:#070b12;color:#b9eaf0;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.hda-checklist{display:grid;gap:8px}.hda-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:10px;padding:10px;border:1px solid var(--hda-border);border-radius:6px;background:#0b111a;color:var(--hda-text)!important}.hda-check input{width:18px;height:18px;min-height:0}.hda-progress{height:7px;border-radius:4px;background:#070b12;overflow:hidden}.hda-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--hda-pink),var(--hda-cyan));transition:width .2s ease}.hda-feed{display:grid;gap:0;max-height:360px;overflow:auto}.hda-feed-item{display:grid;grid-template-columns:12px 1fr auto;gap:9px;align-items:start;padding:10px 0;border-bottom:1px solid var(--hda-border)}.hda-feed-dot{width:8px;height:8px;margin-top:5px;border-radius:50%;background:var(--hda-cyan);box-shadow:0 0 10px var(--hda-cyan)}.hda-feed time{color:var(--hda-muted);font-size:10px}.hda-ai-grid{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.2fr);gap:14px}.hda-ai-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hda-ai-action{justify-content:flex-start!important;min-height:48px!important}.hda-ai-action span{display:grid;text-align:left}.hda-ai-action small{color:var(--hda-muted);font-size:9px}.hda-note{padding:10px;border:1px solid rgba(200,239,115,.28);border-radius:6px;color:#d8e8c0;background:rgba(200,239,115,.06);font-size:11px;line-height:1.55}.hda-drafts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hda-draft{border:1px solid var(--hda-border);border-radius:8px;background:#0b111b;overflow:hidden}.hda-draft-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--hda-border)}.hda-draft-head span{color:var(--hda-cyan);font-size:10px;text-transform:uppercase}.hda-draft-body{padding:12px}.hda-draft-body svg{display:block;width:100%;max-height:240px}.hda-draft-body pre{max-height:220px}.hda-palette{display:flex;gap:8px;flex-wrap:wrap}.hda-color{width:48px;height:48px;border:1px solid rgba(255,255,255,.22);border-radius:6px}.hda-empty{display:grid;place-items:center;min-height:220px;color:var(--hda-muted);text-align:center;border:1px dashed var(--hda-border);border-radius:8px}.hda-status{padding:9px 16px;border-top:1px solid var(--hda-border);color:var(--hda-muted);font-size:11px;background:#090e16}.hda-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:900px){.hda-grid,.hda-ai-grid,.hda-token-grid{grid-template-columns:1fr}.hda-tabs{grid-template-columns:repeat(5,minmax(120px,1fr));overflow-x:auto}.hda-head{align-items:flex-start;flex-wrap:wrap}.hda-actions{width:100%}.hda-drafts{grid-template-columns:1fr}}@media(max-width:600px){.hda-view{padding:10px}.hda-fields,.hda-swatches,.hda-ai-actions,.hda-metrics{grid-template-columns:1fr 1fr}.hda-title p{display:none}.hda button,.hda-file-label{min-height:42px}.hda-preview{min-height:280px;padding:16px}}@media(prefers-reduced-motion:reduce){.hda *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    doc.head.appendChild(style);
  }

  function downloadBlob(doc, blob, filename) {
    if (!doc || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") return false;
    const link = doc.createElement("a");
    link.href = globalScope.URL.createObjectURL(blob); link.download = filename; link.hidden = true;
    doc.body.appendChild(link); link.click(); link.remove();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(link.href), 500);
    return true;
  }

  async function copyText(doc, text) {
    if (globalScope.navigator && globalScope.navigator.clipboard && globalScope.navigator.clipboard.writeText) {
      await globalScope.navigator.clipboard.writeText(text); return true;
    }
    if (!doc) return false;
    const area = doc.createElement("textarea"); area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
    doc.body.appendChild(area); area.select(); const copied = doc.execCommand && doc.execCommand("copy"); area.remove(); return Boolean(copied);
  }

  function draftPreview(draft) {
    if (draft.payload && draft.payload.svg) return `<div>${sanitizeSvg(draft.payload.svg)}</div>`;
    if (draft.action === "palette") return `<div class="hda-palette">${(draft.payload.colors || []).map((color) => `<span class="hda-color" style="background:${normalizeHex(color, "#000000")}" title="${normalizeHex(color, "#000000")}"></span>`).join("")}</div>`;
    return `<pre class="hda-code">${escapeHtml(JSON.stringify(draft.payload, null, 2))}</pre>`;
  }

  function template(workspace, adapterAvailable) {
    const layer = workspace.layer;
    const inspection = inspectLayer(layer);
    const snippets = componentSnippets(layer);
    const completed = workspace.handoff.checklist.filter((item) => item.done).length;
    const progress = Math.round(completed / HANDOFF_ITEMS.length * 100);
    const tab = workspace.activeTab;
    const field = (label, key, type, extra) => `<label>${label}<input type="${type || "text"}" data-hda-layer="${key}" value="${escapeHtml(layer[key])}" ${extra || ""}></label>`;
    const tabs = [
      ["inspect", "Inspect"], ["tokens", "Design Token"], ["handoff", "Handoff"], ["ai", "Controlled AI"], ["drafts", `Bản nháp (${workspace.drafts.length})`]
    ].map(([id, label]) => `<button type="button" class="hda-tab" role="tab" aria-selected="${tab === id}" data-hda-tab="${id}">${label}</button>`).join("");
    let content = "";
    if (tab === "inspect") content = `<div class="hda-grid"><section class="hda-card"><h3>Thuộc tính layer</h3><div class="hda-fields">${field("Tên layer", "name")}${field("Nội dung", "text")}${field("X", "x", "number")}${field("Y", "y", "number")}${field("Rộng", "width", "number", "min=1")}${field("Cao", "height", "number", "min=1")}${field("Màu nền", "fill", "color")}${field("Màu chữ", "textColor", "color")}${field("Màu viền", "borderColor", "color")}${field("Độ dày viền", "borderWidth", "number", "min=0")}${field("Bo góc", "radius", "number", "min=0")}${field("Padding", "padding", "number", "min=0")}${field("Gap", "gap", "number", "min=0")}${field("Cỡ chữ", "fontSize", "number", "min=1")}${field("Độ đậm", "fontWeight", "number", "min=100 max=900 step=100")}${field("Line height", "lineHeight", "number", "min=.5 max=5 step=.05")}</div><h4>WCAG Contrast</h4><div class="hda-metrics"><div class="hda-metric"><span>Tỉ lệ</span><strong>${inspection.contrast.ratio}:1</strong></div><div class="hda-metric"><span>AA</span><strong class="${inspection.contrast.aa ? "hda-pass" : "hda-fail"}">${inspection.contrast.aa ? "Đạt" : "Chưa đạt"}</strong></div><div class="hda-metric"><span>AAA</span><strong class="${inspection.contrast.aaa ? "hda-pass" : "hda-fail"}">${inspection.contrast.aaa ? "Đạt" : "Chưa đạt"}</strong></div><div class="hda-metric"><span>Kích thước</span><strong>${layer.width} × ${layer.height}</strong></div></div></section><section class="hda-card"><div class="hda-preview"><article class="hda-preview-layer" style="width:min(100%,${layer.width}px);min-height:min(360px,${layer.height}px);padding:${layer.padding}px;gap:${layer.gap}px;color:${layer.textColor};background:${layer.fill};border:${layer.borderWidth}px solid ${layer.borderColor};border-radius:${layer.radius}px;opacity:${layer.opacity};font-family:${escapeHtml(layer.fontFamily)}"><strong style="font-size:min(8vw,${layer.fontSize}px);font-weight:${layer.fontWeight};line-height:${layer.lineHeight}">${escapeHtml(layer.text)}</strong></article></div><div class="hda-row" style="margin-top:12px"><button type="button" data-hda-copy="svg">Copy SVG</button><button type="button" data-hda-copy="css">Copy CSS</button><button type="button" data-hda-copy="html">Copy HTML</button><button type="button" data-hda-action="audit">Kiểm tra layout</button></div><h4>CSS component</h4><pre class="hda-code">${escapeHtml(snippets.css)}</pre></section></div>`;
    if (tab === "tokens") content = `<div class="hda-token-grid"><section class="hda-card"><h3>Token Light / Dark</h3>${["light", "dark"].map((theme) => `<h4>${theme === "light" ? "Light" : "Dark"}</h4><div class="hda-swatches">${Object.entries(workspace.tokens[theme]).map(([key, value]) => `<label class="hda-swatch">${escapeHtml(key)}<input type="color" value="${value}" data-hda-token="${theme}.${key}"></label>`).join("")}</div>`).join("")}<h4>Xuất token</h4><div class="hda-row"><button type="button" data-hda-token-export="css">CSS variables</button><button type="button" data-hda-token-export="tailwind">Tailwind config</button><button type="button" data-hda-token-export="json">JSON token</button></div></section><section class="hda-card"><h3>CSS variables</h3><pre class="hda-code">${escapeHtml(tokensToCss(workspace.tokens))}</pre></section></div>`;
    if (tab === "handoff") content = `<div class="hda-grid"><section class="hda-card"><div class="hda-row" style="justify-content:space-between"><div><h3>Checklist bàn giao</h3><small>${completed}/${HANDOFF_ITEMS.length} mục hoàn tất</small></div><button type="button" class="is-primary" data-hda-action="ready" ${completed !== HANDOFF_ITEMS.length ? "disabled" : ""}>Sẵn sàng bàn giao</button></div><div class="hda-progress" aria-label="Tiến độ bàn giao ${progress}%"><span style="width:${progress}%"></span></div><div class="hda-checklist" style="margin-top:12px">${HANDOFF_ITEMS.map((item) => { const checked = workspace.handoff.checklist.find((entry) => entry.id === item.id)?.done; return `<label class="hda-check"><input type="checkbox" data-hda-check="${item.id}" ${checked ? "checked" : ""}><span>${item.label}</span></label>`; }).join("")}</div><label style="margin-top:12px">Ghi chú cho developer<textarea data-hda-handoff="note">${escapeHtml(workspace.handoff.note)}</textarea></label></section><section class="hda-card"><h3>Change feed</h3><div class="hda-feed">${workspace.feed.map((entry) => `<div class="hda-feed-item"><span class="hda-feed-dot"></span><span>${escapeHtml(entry.text)}</span><time>${new Date(entry.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time></div>`).join("")}</div></section></div>`;
    if (tab === "ai") content = `<div class="hda-ai-grid"><section class="hda-card"><h3>Controlled AI Lab</h3><label>Mô tả kết quả mong muốn<textarea data-hda-prompt placeholder="Ví dụ: tách chủ thể, tạo phụ đề và thumbnail 16:9"></textarea></label><p class="hda-note">Mọi tác vụ tạo một bản nháp mới, không ghi đè media gốc. Provider chỉ chạy qua apiAdapter server-side; API key không được phép xuất hiện ở frontend.</p><div class="hda-ai-actions"><button type="button" class="hda-ai-action" data-hda-ai="vector"><span>Vector draft<small>SVG deterministic cục bộ</small></span></button><button type="button" class="hda-ai-action" data-hda-ai="audit"><span>Design audit<small>Overflow và WCAG</small></span></button>${CONTROLLED_AI_ACTIONS.map((action) => `<button type="button" class="hda-ai-action" data-hda-provider-ai="${action}" ${adapterAvailable ? "" : "disabled"}><span>${escapeHtml(action)}<small>${adapterAvailable ? "Draft qua backend" : "Cần provider server-side"}</small></span></button>`).join("")}</div><label class="hda-file-label" style="margin-top:10px">Lấy palette từ ảnh<input class="hda-sr" type="file" accept="image/png,image/jpeg,image/webp" data-hda-palette-file></label></section><section class="hda-card"><h3>Bản nháp mới nhất</h3>${workspace.drafts.length ? `<article class="hda-draft">${draftPreview(workspace.drafts[0])}</article>` : `<div class="hda-empty"><div><strong>Chưa có bản nháp</strong><p>Chọn một tác vụ để bắt đầu.</p></div></div>`}</section></div>`;
    if (tab === "drafts") content = workspace.drafts.length ? `<div class="hda-drafts">${workspace.drafts.map((draft) => `<article class="hda-draft"><header class="hda-draft-head"><div><span>${escapeHtml(draft.action)}</span><div>${escapeHtml(draft.prompt || "Bản nháp không tiêu đề")}</div></div><button type="button" data-hda-copy-draft="${draft.id}">Copy JSON</button></header><div class="hda-draft-body">${draftPreview(draft)}</div></article>`).join("")}</div>` : `<div class="hda-empty"><div><strong>Kho bản nháp đang trống</strong><p>Controlled AI luôn thêm kết quả vào đây và không sửa layer gốc.</p></div></div>`;
    return `<div class="hda-shell"><header class="hda-head"><div class="hda-mark" aria-hidden="true">DV</div><div class="hda-title"><h2>Dev Mode & Controlled AI</h2><p>Inspect · WCAG · Token · Handoff · Draft-first AI</p></div><div class="hda-actions"><button type="button" data-hda-action="import">Nhập workspace</button><button type="button" class="is-primary" data-hda-action="export">Xuất workspace</button></div></header><nav class="hda-tabs" role="tablist" aria-label="Khu vực Dev Mode">${tabs}</nav><main class="hda-view" role="tabpanel">${content}</main><footer class="hda-status" role="status" aria-live="polite" data-hda-status>Đã tự lưu trên thiết bị.</footer><input hidden type="file" accept="application/json,.json" data-hda-import></div>`;
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const settings = options || {};
    const doc = root.ownerDocument || globalScope.document;
    addStyles(doc);
    let workspace;
    try {
      const stored = globalScope.localStorage && globalScope.localStorage.getItem(STORAGE_KEY);
      workspace = normalizeWorkspace(settings.workspace || (stored ? JSON.parse(stored) : null));
    } catch (_) { workspace = createDefaultWorkspace(); }
    const apiAdapter = settings.apiAdapter;
    let adapterAvailable = false;
    try { adapterAvailable = assertServerAdapter(apiAdapter); } catch (_) { adapterAvailable = false; }
    let destroyed = false;

    function persist() {
      try { if (globalScope.localStorage) globalScope.localStorage.setItem(STORAGE_KEY, serializeWorkspace(workspace)); } catch (_) { /* Private mode can reject storage. */ }
    }

    function feed(text) {
      workspace.feed.unshift({ id: uid("feed"), at: new Date().toISOString(), text: safeText(text, 240) });
      workspace.feed = workspace.feed.slice(0, MAX_FEED);
    }

    function setStatus(message) {
      const status = root.querySelector("[data-hda-status]");
      if (status) status.textContent = message;
    }

    function render(message) {
      if (destroyed) return;
      root.innerHTML = template(workspace, adapterAvailable);
      if (message) setStatus(message);
    }

    function saveAndRender(message) {
      workspace = normalizeWorkspace(workspace); persist(); render(message);
    }

    function addDraft(draft, message) {
      workspace.drafts.unshift(normalizeDraft(draft));
      workspace.drafts = workspace.drafts.slice(0, MAX_DRAFTS);
      feed(message || `Đã tạo bản nháp ${draft.action}.`);
      saveAndRender(message || "Đã thêm bản nháp mới, thiết kế gốc không thay đổi.");
    }

    async function runRemote(prompt, operation) {
      if (!adapterAvailable) return setStatus("Ứng dụng chưa truyền apiAdapter an toàn.");
      setStatus("Đang yêu cầu adapter tạo bản nháp…");
      try {
        if (operation && CONTROLLED_AI_ACTIONS.includes(operation)) {
          const draft = await requestProviderDraft(apiAdapter, operation, prompt, { layer: clone(workspace.layer), tokens: clone(workspace.tokens) });
          return addDraft(draft, `Provider đã tạo bản nháp ${operation}; media gốc được giữ nguyên.`);
        }
        const request = { action: "design-draft", prompt: safeText(prompt, 2000), context: { layer: clone(workspace.layer), tokens: clone(workspace.tokens) } };
        const result = typeof apiAdapter === "function" ? await apiAdapter(request) : await apiAdapter.generateDraft(request);
        const payload = result && typeof result === "object" ? clone(result) : { text: safeText(result, 6000) };
        addDraft({ id: uid("draft"), action: "remote", prompt, createdAt: new Date().toISOString(), status: "draft", source: "adapter", payload }, "Gemini adapter đã trả về một bản nháp mới.");
      } catch (error) { setStatus(`Adapter không thể tạo draft: ${safeText(error && error.message || "Lỗi không xác định", 160)}`); }
    }

    async function paletteFromFile(file) {
      if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return setStatus("Chỉ nhận PNG, JPG hoặc WebP.");
      const url = globalScope.URL && globalScope.URL.createObjectURL ? globalScope.URL.createObjectURL(file) : null;
      if (!url || typeof globalScope.Image !== "function") return setStatus("Trình duyệt không hỗ trợ phân tích ảnh cục bộ.");
      const image = new globalScope.Image();
      image.onload = () => {
        const canvas = doc.createElement("canvas"); const context = canvas.getContext("2d", { willReadFrequently: true });
        const scale = Math.min(1, 96 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const colors = extractPaletteFromPixels(context.getImageData(0, 0, canvas.width, canvas.height).data, 6);
        globalScope.URL.revokeObjectURL(url);
        addDraft(createDraft("palette", file.name, { colors }), "Đã lấy palette từ pixel ảnh trên thiết bị.");
      };
      image.onerror = () => { globalScope.URL.revokeObjectURL(url); setStatus("Không thể đọc ảnh này."); };
      image.src = url;
    }

    async function onClick(event) {
      const target = event.target.closest("button,[data-hda-tab]");
      if (!target || !root.contains(target)) return;
      if (target.dataset.hdaTab) { workspace.activeTab = target.dataset.hdaTab; persist(); return render(); }
      const action = target.dataset.hdaAction;
      if (action === "import") return root.querySelector("[data-hda-import]").click();
      if (action === "export") { const blob = new Blob([serializeWorkspace(workspace)], { type: "application/json" }); downloadBlob(doc, blob, "hh-dev-ai-workspace.json"); return setStatus("Đã xuất workspace JSON."); }
      if (action === "ready") { workspace.handoff.status = "ready"; feed("Đã đánh dấu sẵn sàng bàn giao."); return saveAndRender("Workspace đã sẵn sàng bàn giao."); }
      if (action === "audit") { const draft = createDraft("audit", "Kiểm tra layer đang chọn", { frame: { width: 1440, height: 900 }, layer: workspace.layer }); addDraft(draft, "Đã tạo báo cáo layout mới."); workspace.activeTab = "drafts"; return render("Đã kiểm tra overflow, vùng chạm và WCAG."); }
      if (target.dataset.hdaCopy) { const snippets = componentSnippets(workspace.layer); await copyText(doc, snippets[target.dataset.hdaCopy]); return setStatus(`Đã sao chép ${target.dataset.hdaCopy.toUpperCase()}.`); }
      if (target.dataset.hdaTokenExport) {
        const type = target.dataset.hdaTokenExport; const text = type === "css" ? tokensToCss(workspace.tokens) : type === "tailwind" ? tokensToTailwind(workspace.tokens) : tokensToJson(workspace.tokens);
        await copyText(doc, text); return setStatus(`Đã sao chép ${type === "tailwind" ? "Tailwind config" : type.toUpperCase()}.`);
      }
      if (target.dataset.hdaCopyDraft) { const draft = workspace.drafts.find((item) => item.id === target.dataset.hdaCopyDraft); if (draft) await copyText(doc, JSON.stringify(draft, null, 2)); return setStatus("Đã sao chép JSON của bản nháp."); }
      if (target.dataset.hdaProviderAi) {
        const prompt = root.querySelector("[data-hda-prompt]")?.value.trim() || "";
        return runRemote(prompt, target.dataset.hdaProviderAi);
      }
      if (target.dataset.hdaAi) {
        const promptNode = root.querySelector("[data-hda-prompt]"); const prompt = promptNode ? promptNode.value.trim() : ""; const aiAction = target.dataset.hdaAi;
        if (aiAction === "remote") return runRemote(prompt);
        const context = aiAction === "rig" ? { model: { width: workspace.layer.width, height: workspace.layer.height } } : aiAction === "audit" ? { frame: { width: 1440, height: 900 }, layer: workspace.layer } : {};
        addDraft(createDraft(aiAction, prompt || `Bản nháp ${aiAction}`, context)); workspace.activeTab = "drafts"; return render("Đã tạo bản nháp mới, layer gốc được giữ nguyên.");
      }
    }

    function onInput(event) {
      const layerKey = event.target.dataset.hdaLayer;
      if (layerKey) {
        workspace.layer[layerKey] = event.target.type === "number" ? Number(event.target.value) : event.target.value;
        workspace.layer = normalizeLayer(workspace.layer); persist(); return render("Đã cập nhật inspect và tự lưu.");
      }
      const tokenPath = event.target.dataset.hdaToken;
      if (tokenPath) { const [theme, key] = tokenPath.split("."); workspace.tokens[theme][key] = normalizeHex(event.target.value, workspace.tokens[theme][key]); persist(); return render("Đã cập nhật design token."); }
      if (event.target.dataset.hdaHandoff) { workspace.handoff[event.target.dataset.hdaHandoff] = safeText(event.target.value, 2000); persist(); }
    }

    function onChange(event) {
      if (event.target.dataset.hdaCheck) {
        const item = workspace.handoff.checklist.find((entry) => entry.id === event.target.dataset.hdaCheck);
        if (item) item.done = event.target.checked;
        workspace.handoff.status = workspace.handoff.checklist.every((entry) => entry.done) ? "review" : "working";
        feed(`${event.target.checked ? "Hoàn tất" : "Mở lại"}: ${HANDOFF_ITEMS.find((entry) => entry.id === event.target.dataset.hdaCheck)?.label || "Checklist"}.`);
        return saveAndRender("Đã cập nhật checklist bàn giao.");
      }
      if (event.target.matches("[data-hda-import]") && event.target.files[0]) {
        const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (parsed.format !== FORMAT) throw new Error("Sai định dạng"); workspace = normalizeWorkspace(parsed); persist(); render("Đã nhập workspace Dev Mode."); } catch (_) { setStatus("Workspace JSON không hợp lệ."); } }; reader.readAsText(event.target.files[0]);
      }
      if (event.target.matches("[data-hda-palette-file]") && event.target.files[0]) paletteFromFile(event.target.files[0]);
    }

    root.classList.add("hda");
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange);
    render(); persist();
    const controller = {
      getWorkspace: () => clone(workspace),
      setWorkspace(next) { workspace = normalizeWorkspace(next); persist(); render("Đã nạp workspace mới."); },
      createDraft(action, prompt, context) { const draft = createDraft(action, prompt, context); addDraft(draft); return clone(draft); },
      inspect: () => inspectLayer(workspace.layer),
      destroy() {
        if (destroyed) return; destroyed = true;
        root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange);
        root.replaceChildren(); root.classList.remove("hda"); instances.delete(root);
      }
    };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.destroy(); return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, HANDOFF_ITEMS, DEFAULT_TOKENS,
    normalizeHex, hexToRgb, relativeLuminance, contrastRatio, evaluateContrast,
    defaultLayer, normalizeLayer, inspectLayer, normalizeTokens, tokensToCss, tokensToTailwind, tokensToJson, componentSnippets,
    hashString, createVectorDraft, extractPaletteFromPixels, suggestKeyframes, suggestRig, suggestExpressionPose, storyboardToScenes, auditLayout,
    CONTROLLED_AI_ACTIONS, sanitizeSvg, sanitizePayload, assertServerAdapter, controlledDraftPayload, requestProviderDraft,
    createDraft, createDefaultWorkspace, normalizeWorkspace, serializeWorkspace, mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicDevAI = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
