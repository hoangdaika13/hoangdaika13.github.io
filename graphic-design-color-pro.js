(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-color-pro-project";
  const STORAGE_KEY = "hh.graphic-color-pro.project.v1";
  const STYLE_ID = "hh-graphic-color-pro-style-v1";
  const MAX_CUBE_SIZE = 33;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const SOFT_PROOF_NOTICE = "Mô phỏng RGB/CMYK xấp xỉ, không thay thế ICC profile, RIP hoặc bản in thử.";
  const CMYK_NOTICE = "CMYK xấp xỉ theo công thức thiết bị độc lập; kết quả thực tế phụ thuộc profile mực, giấy và máy in.";
  const mounted = new WeakMap();

  const HARMONY_MODES = Object.freeze([
    { id: "complementary", label: "Bổ túc" },
    { id: "analogous", label: "Tương đồng" },
    { id: "triadic", label: "Bộ ba" },
    { id: "split-complementary", label: "Bổ túc xen kẽ" },
    { id: "tetradic", label: "Bộ bốn" },
    { id: "square", label: "Hình vuông" },
    { id: "monochromatic", label: "Đơn sắc" }
  ]);

  const BRAND_ROLES = Object.freeze([
    { id: "primary", label: "Primary" },
    { id: "secondary", label: "Secondary" },
    { id: "accent", label: "Accent" },
    { id: "neutral", label: "Neutral" },
    { id: "background", label: "Background" },
    { id: "text", label: "Text" }
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function round(value, precision) {
    const factor = Math.pow(10, precision == null ? 4 : precision);
    return Math.round(Number(value) * factor) / factor;
  }

  function safeText(value, fallback, maxLength) {
    const text = value == null ? String(fallback == null ? "" : fallback) : String(value);
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength || 500);
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

  function uid(prefix) {
    const cryptoRef = globalScope && globalScope.crypto;
    const random = cryptoRef && typeof cryptoRef.randomUUID === "function"
      ? cryptoRef.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    return `${prefix || "color"}-${random}`;
  }

  function normalizeHex(value, fallback) {
    const text = String(value == null ? "" : value).trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return `#${text.slice(1).split("").map((part) => part + part).join("")}`.toUpperCase();
    }
    return fallback === undefined ? "#000000" : normalizeHex(fallback, "#000000");
  }

  function rgbInput(red, green, blue) {
    if (typeof red === "string") {
      const hex = normalizeHex(red);
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
      };
    }
    if (Array.isArray(red) || ArrayBuffer.isView(red)) {
      return { r: Number(red[0]), g: Number(red[1]), b: Number(red[2]) };
    }
    if (red && typeof red === "object") {
      return {
        r: Number(red.r == null ? red.red : red.r),
        g: Number(red.g == null ? red.green : red.g),
        b: Number(red.b == null ? red.blue : red.b)
      };
    }
    return { r: Number(red), g: Number(green), b: Number(blue) };
  }

  function normalizeRgb(red, green, blue) {
    const rgb = rgbInput(red, green, blue);
    return {
      r: clamp(rgb.r, 0, 255, 0),
      g: clamp(rgb.g, 0, 255, 0),
      b: clamp(rgb.b, 0, 255, 0)
    };
  }

  function hexToRgb(value) {
    return normalizeRgb(normalizeHex(value));
  }

  function rgbToHex(red, green, blue) {
    const rgb = normalizeRgb(red, green, blue);
    const channel = (value) => Math.round(value).toString(16).padStart(2, "0");
    return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`.toUpperCase();
  }

  function normalizeHue(value) {
    const hue = Number(value);
    return Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : 0;
  }

  function rgbToHsl(red, green, blue) {
    const rgb = normalizeRgb(red, green, blue);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    const lightness = (max + min) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    return { h: round(normalizeHue(hue), 4), s: round(saturation * 100, 4), l: round(lightness * 100, 4) };
  }

  function hslToRgb(hueInput, saturationInput, lightnessInput) {
    const source = hueInput && typeof hueInput === "object"
      ? hueInput
      : { h: hueInput, s: saturationInput, l: lightnessInput };
    const h = normalizeHue(source.h);
    const s = clamp(source.s, 0, 100, 0) / 100;
    const l = clamp(source.l, 0, 100, 0) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const offset = l - chroma / 2;
    let parts;
    if (h < 60) parts = [chroma, x, 0];
    else if (h < 120) parts = [x, chroma, 0];
    else if (h < 180) parts = [0, chroma, x];
    else if (h < 240) parts = [0, x, chroma];
    else if (h < 300) parts = [x, 0, chroma];
    else parts = [chroma, 0, x];
    return { r: round((parts[0] + offset) * 255, 4), g: round((parts[1] + offset) * 255, 4), b: round((parts[2] + offset) * 255, 4) };
  }

  function srgbChannelToLinear(channel) {
    const value = Number(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function linearChannelToSrgb(channel) {
    const value = Number(channel);
    return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);
  }

  function rgbToXyz(red, green, blue) {
    const rgb = normalizeRgb(red, green, blue);
    const r = srgbChannelToLinear(rgb.r);
    const g = srgbChannelToLinear(rgb.g);
    const b = srgbChannelToLinear(rgb.b);
    return {
      x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
      y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
      z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b
    };
  }

  function xyzToRgbReport(xyzInput) {
    const xyz = xyzInput || {};
    const x = Number(xyz.x) || 0;
    const y = Number(xyz.y) || 0;
    const z = Number(xyz.z) || 0;
    const linear = {
      r: 3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
      g: -0.969266 * x + 1.8760108 * y + 0.041556 * z,
      b: 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    };
    const raw = {
      r: linearChannelToSrgb(linear.r),
      g: linearChannelToSrgb(linear.g),
      b: linearChannelToSrgb(linear.b)
    };
    const inGamut = Object.values(raw).every((value) => Number.isFinite(value) && value >= -0.001 && value <= 255.001);
    const rgb = normalizeRgb(raw);
    return {
      rgb: { r: round(rgb.r, 4), g: round(rgb.g, 4), b: round(rgb.b, 4) },
      raw: { r: round(raw.r, 4), g: round(raw.g, 4), b: round(raw.b, 4) },
      inGamut,
      clipped: !inGamut
    };
  }

  function xyzToRgb(xyzInput) {
    return xyzToRgbReport(xyzInput).rgb;
  }

  const LAB_EPSILON = 216 / 24389;
  const LAB_KAPPA = 24389 / 27;
  const D65 = Object.freeze({ x: 0.95047, y: 1, z: 1.08883 });

  function xyzToLab(xyzInput) {
    const xyz = xyzInput || {};
    const transform = (value) => value > LAB_EPSILON ? Math.cbrt(value) : (LAB_KAPPA * value + 16) / 116;
    const fx = transform((Number(xyz.x) || 0) / D65.x);
    const fy = transform((Number(xyz.y) || 0) / D65.y);
    const fz = transform((Number(xyz.z) || 0) / D65.z);
    return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function labToXyz(labInput) {
    const lab = labInput || {};
    const l = clamp(lab.l == null ? lab.L : lab.l, -1000, 1000, 0);
    const a = clamp(lab.a, -1000, 1000, 0);
    const b = clamp(lab.b, -1000, 1000, 0);
    const fy = (l + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const inverse = (value) => Math.pow(value, 3) > LAB_EPSILON ? Math.pow(value, 3) : (116 * value - 16) / LAB_KAPPA;
    return { x: D65.x * inverse(fx), y: D65.y * inverse(fy), z: D65.z * inverse(fz) };
  }

  function rgbToLab(red, green, blue) {
    const lab = xyzToLab(rgbToXyz(red, green, blue));
    return { l: round(lab.l, 5), a: round(lab.a, 5), b: round(lab.b, 5) };
  }

  function labToRgbReport(labInput) {
    return xyzToRgbReport(labToXyz(labInput));
  }

  function labToRgb(labInput) {
    return labToRgbReport(labInput).rgb;
  }

  function linearRgbToOklab(linearInput) {
    const linear = linearInput || {};
    const r = Number(linear.r) || 0;
    const g = Number(linear.g) || 0;
    const b = Number(linear.b) || 0;
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
      l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
  }

  function oklabToLinearRgb(oklabInput) {
    const color = oklabInput || {};
    const l = Number(color.l == null ? color.L : color.l) || 0;
    const a = Number(color.a) || 0;
    const b = Number(color.b) || 0;
    const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
    const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
    const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
    const lc = lRoot * lRoot * lRoot;
    const mc = mRoot * mRoot * mRoot;
    const sc = sRoot * sRoot * sRoot;
    return {
      r: 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
      g: -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
      b: -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc
    };
  }

  function rgbToOklab(red, green, blue) {
    const rgb = normalizeRgb(red, green, blue);
    const result = linearRgbToOklab({
      r: srgbChannelToLinear(rgb.r),
      g: srgbChannelToLinear(rgb.g),
      b: srgbChannelToLinear(rgb.b)
    });
    return { l: round(result.l, 6), a: round(result.a, 6), b: round(result.b, 6) };
  }

  function oklabToRgbReport(oklabInput) {
    const linear = oklabToLinearRgb(oklabInput);
    const raw = {
      r: linearChannelToSrgb(linear.r),
      g: linearChannelToSrgb(linear.g),
      b: linearChannelToSrgb(linear.b)
    };
    const inGamut = Object.values(raw).every((value) => Number.isFinite(value) && value >= -0.001 && value <= 255.001);
    const rgb = normalizeRgb(raw);
    return {
      rgb: { r: round(rgb.r, 4), g: round(rgb.g, 4), b: round(rgb.b, 4) },
      raw: { r: round(raw.r, 4), g: round(raw.g, 4), b: round(raw.b, 4) },
      inGamut,
      clipped: !inGamut
    };
  }

  function oklabToRgb(oklabInput) {
    return oklabToRgbReport(oklabInput).rgb;
  }

  function oklabToOklch(oklabInput) {
    const color = oklabInput || {};
    const a = Number(color.a) || 0;
    const b = Number(color.b) || 0;
    return {
      l: round(Number(color.l == null ? color.L : color.l) || 0, 6),
      c: round(Math.hypot(a, b), 6),
      h: round(Math.hypot(a, b) < 0.0000001 ? 0 : normalizeHue(Math.atan2(b, a) * 180 / Math.PI), 5)
    };
  }

  function oklchToOklab(oklchInput) {
    const color = oklchInput || {};
    const hue = normalizeHue(color.h) * Math.PI / 180;
    const chroma = Math.max(0, Number(color.c) || 0);
    return {
      l: Number(color.l == null ? color.L : color.l) || 0,
      a: chroma * Math.cos(hue),
      b: chroma * Math.sin(hue)
    };
  }

  function rgbToOklch(red, green, blue) {
    return oklabToOklch(rgbToOklab(red, green, blue));
  }

  function oklchToRgbReport(oklchInput) {
    return oklabToRgbReport(oklchToOklab(oklchInput));
  }

  function oklchToRgb(oklchInput) {
    return oklchToRgbReport(oklchInput).rgb;
  }

  function mapOklchToSrgb(oklchInput) {
    const source = {
      l: clamp(oklchInput && (oklchInput.l == null ? oklchInput.L : oklchInput.l), 0, 1, 0),
      c: Math.max(0, Number(oklchInput && oklchInput.c) || 0),
      h: normalizeHue(oklchInput && oklchInput.h)
    };
    const initial = oklchToRgbReport(source);
    if (initial.inGamut) return { ...initial, mapped: source, original: source, chromaReduced: false };
    let low = 0;
    let high = source.c;
    for (let index = 0; index < 24; index += 1) {
      const middle = (low + high) / 2;
      if (oklchToRgbReport({ ...source, c: middle }).inGamut) low = middle;
      else high = middle;
    }
    const mapped = { ...source, c: round(low, 6) };
    const result = oklchToRgbReport(mapped);
    return { ...result, mapped, original: source, chromaReduced: true };
  }

  function deltaE76(firstInput, secondInput) {
    const first = firstInput || {};
    const second = secondInput || {};
    return Math.hypot(
      (Number(first.l == null ? first.L : first.l) || 0) - (Number(second.l == null ? second.L : second.l) || 0),
      (Number(first.a) || 0) - (Number(second.a) || 0),
      (Number(first.b) || 0) - (Number(second.b) || 0)
    );
  }

  function colorReport(value) {
    const hex = normalizeHex(value, "#FF5F87");
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);
    const lab = rgbToLab(rgb);
    const oklch = rgbToOklch(rgb);
    const gamut = oklchToRgbReport(oklch);
    return { hex, rgb, hsl, lab, oklch, inSrgbGamut: gamut.inGamut };
  }

  function generateHarmony(baseColor, modeInput) {
    const mode = HARMONY_MODES.some((item) => item.id === modeInput) ? modeInput : "complementary";
    const base = rgbToOklch(hexToRgb(normalizeHex(baseColor, "#FF5F87")));
    let colors;
    if (mode === "monochromatic") {
      colors = [0.24, 0.4, 0.56, 0.72, 0.86].map((lightness) => ({ l: lightness, c: Math.min(base.c, lightness < 0.3 || lightness > 0.8 ? 0.14 : base.c), h: base.h }));
    } else {
      const offsets = {
        complementary: [0, 180],
        analogous: [-30, 0, 30],
        triadic: [0, 120, 240],
        "split-complementary": [0, 150, 210],
        tetradic: [0, 60, 180, 240],
        square: [0, 90, 180, 270]
      }[mode];
      colors = offsets.map((offset) => ({ l: base.l, c: base.c, h: normalizeHue(base.h + offset) }));
    }
    return colors.map((oklch, index) => {
      const direct = oklchToRgbReport(oklch);
      const mapped = direct.inGamut ? { ...direct, mapped: oklch, chromaReduced: false } : mapOklchToSrgb(oklch);
      return {
        index,
        hex: rgbToHex(mapped.rgb),
        rgb: mapped.rgb,
        oklch: { l: round(oklch.l, 5), c: round(oklch.c, 5), h: round(oklch.h, 3) },
        inGamut: direct.inGamut,
        gamutWarning: !direct.inGamut,
        mappedOklch: mapped.mapped
      };
    });
  }

  function generateHarmonyHex(baseColor, modeInput) {
    return generateHarmony(baseColor, modeInput).map((color) => color.hex);
  }

  function defaultMeshPoints() {
    return [
      { id: "mesh-1", x: 0.05, y: 0.08, color: "#FF5F87", strength: 1.15 },
      { id: "mesh-2", x: 0.5, y: 0.02, color: "#54D7E4", strength: 1 },
      { id: "mesh-3", x: 0.95, y: 0.12, color: "#F5C451", strength: 1.1 },
      { id: "mesh-4", x: 0.08, y: 0.92, color: "#52C98B", strength: 1 },
      { id: "mesh-5", x: 0.55, y: 0.82, color: "#7957D5", strength: 0.92 },
      { id: "mesh-6", x: 0.96, y: 0.94, color: "#111821", strength: 1.2 }
    ];
  }

  function normalizeGradientMesh(input) {
    const source = input && typeof input === "object" ? input : {};
    const fallback = defaultMeshPoints();
    const rawPoints = Array.isArray(source.points) ? source.points.slice(0, 12) : fallback;
    const points = rawPoints.map((point, index) => ({
      id: safeText(point && point.id, `mesh-${index + 1}`, 60).replace(/[^a-zA-Z0-9_-]/g, "") || `mesh-${index + 1}`,
      x: clamp(point && point.x, 0, 1, fallback[index % fallback.length].x),
      y: clamp(point && point.y, 0, 1, fallback[index % fallback.length].y),
      color: normalizeHex(point && point.color, fallback[index % fallback.length].color),
      strength: clamp(point && point.strength, 0.1, 3, 1)
    }));
    return {
      width: Math.round(clamp(source.width, 64, 4096, 960)),
      height: Math.round(clamp(source.height, 64, 4096, 560)),
      background: normalizeHex(source.background, "#101820"),
      points: points.length >= 2 ? points : fallback
    };
  }

  function createGradientMesh(colorsInput) {
    const mesh = normalizeGradientMesh({});
    const colors = Array.isArray(colorsInput) ? colorsInput.map((color) => normalizeHex(color, "#FF5F87")).slice(0, 12) : [];
    if (colors.length >= 2) mesh.points.forEach((point, index) => { point.color = colors[index % colors.length]; });
    return mesh;
  }

  function sampleGradientMesh(meshInput, xInput, yInput) {
    const mesh = normalizeGradientMesh(meshInput);
    const x = clamp(xInput, 0, 1, 0.5);
    const y = clamp(yInput, 0, 1, 0.5);
    let totalWeight = 0;
    const sum = { l: 0, a: 0, b: 0 };
    mesh.points.forEach((point) => {
      const distanceSquared = Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2);
      const weight = point.strength / Math.pow(distanceSquared + 0.012, 1.2);
      const color = rgbToOklab(hexToRgb(point.color));
      totalWeight += weight;
      sum.l += color.l * weight;
      sum.a += color.a * weight;
      sum.b += color.b * weight;
    });
    const result = oklabToRgbReport({ l: sum.l / totalWeight, a: sum.a / totalWeight, b: sum.b / totalWeight });
    return { ...result, hex: rgbToHex(result.rgb) };
  }

  function drawGradientMesh(canvas, meshInput, optionsInput) {
    if (!canvas || typeof canvas.getContext !== "function") return { supported: false, reason: "Canvas 2D không khả dụng." };
    const context = canvas.getContext("2d");
    if (!context || typeof context.createImageData !== "function" || typeof context.putImageData !== "function") {
      return { supported: false, reason: "Trình duyệt không cung cấp Canvas 2D pixel API." };
    }
    const options = optionsInput || {};
    const width = Math.round(clamp(options.width, 80, 640, 360));
    const height = Math.round(clamp(options.height, 60, 420, 210));
    const mesh = normalizeGradientMesh(meshInput);
    const prepared = mesh.points.map((point) => ({ ...point, oklab: rgbToOklab(hexToRgb(point.color)) }));
    const image = context.createImageData(width, height);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const x = column / Math.max(1, width - 1);
        const y = row / Math.max(1, height - 1);
        let totalWeight = 0;
        const sum = { l: 0, a: 0, b: 0 };
        prepared.forEach((point) => {
          const weight = point.strength / Math.pow(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2) + 0.012, 1.2);
          totalWeight += weight;
          sum.l += point.oklab.l * weight;
          sum.a += point.oklab.a * weight;
          sum.b += point.oklab.b * weight;
        });
        const rgb = oklabToRgb({ l: sum.l / totalWeight, a: sum.a / totalWeight, b: sum.b / totalWeight });
        const offset = (row * width + column) * 4;
        image.data[offset] = Math.round(rgb.r);
        image.data[offset + 1] = Math.round(rgb.g);
        image.data[offset + 2] = Math.round(rgb.b);
        image.data[offset + 3] = 255;
      }
    }
    canvas.width = width;
    canvas.height = height;
    context.putImageData(image, 0, 0);
    return { supported: true, width, height, pointCount: mesh.points.length };
  }

  function extractPaletteFromPixels(pixelsInput, countInput) {
    const pixels = pixelsInput && pixelsInput.data ? pixelsInput.data : pixelsInput;
    if (!pixels || typeof pixels.length !== "number") return [];
    const count = Math.round(clamp(countInput, 1, 12, 6));
    const buckets = new Map();
    const pixelCount = Math.floor(pixels.length / 4);
    const stepPixels = Math.max(1, Math.ceil(pixelCount / 50000));
    for (let pixel = 0; pixel < pixelCount; pixel += stepPixels) {
      const offset = pixel * 4;
      if (pixels[offset + 3] != null && pixels[offset + 3] < 128) continue;
      const red = Math.min(255, Math.round(pixels[offset] / 24) * 24);
      const green = Math.min(255, Math.round(pixels[offset + 1] / 24) * 24);
      const blue = Math.min(255, Math.round(pixels[offset + 2] / 24) * 24);
      const key = `${red},${green},${blue}`;
      const entry = buckets.get(key) || { r: red, g: green, b: blue, count: 0 };
      entry.count += 1;
      buckets.set(key, entry);
    }
    const sorted = Array.from(buckets.values()).sort((first, second) => second.count - first.count);
    const selected = [];
    for (const candidate of sorted) {
      const lab = rgbToLab(candidate);
      if (selected.every((item) => deltaE76(lab, item.lab) >= 11)) selected.push({ ...candidate, lab });
      if (selected.length >= count) break;
    }
    if (!selected.length) return [];
    return selected.map((color) => rgbToHex(color));
  }

  function relativeLuminance(colorInput) {
    const rgb = normalizeRgb(colorInput);
    return 0.2126 * srgbChannelToLinear(rgb.r) + 0.7152 * srgbChannelToLinear(rgb.g) + 0.0722 * srgbChannelToLinear(rgb.b);
  }

  function contrastRatio(foreground, background) {
    const first = relativeLuminance(typeof foreground === "string" ? hexToRgb(foreground) : foreground);
    const second = relativeLuminance(typeof background === "string" ? hexToRgb(background) : background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  function evaluateContrast(foreground, background, fontSizeInput, boldInput) {
    const ratio = contrastRatio(foreground, background);
    const fontSize = clamp(fontSizeInput, 1, 1000, 16);
    const bold = Boolean(boldInput);
    const largeText = fontSize >= 24 || (bold && fontSize >= 18.66);
    const aaThreshold = largeText ? 3 : 4.5;
    const aaaThreshold = largeText ? 4.5 : 7;
    return {
      ratio: round(ratio, 2),
      largeText,
      aa: ratio >= aaThreshold,
      aaa: ratio >= aaaThreshold,
      aaThreshold,
      aaaThreshold,
      label: ratio >= aaaThreshold ? "AAA" : ratio >= aaThreshold ? "AA" : "Không đạt"
    };
  }

  function rgbToCmykApproximation(red, green, blue) {
    const rgb = normalizeRgb(red, green, blue);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const key = 1 - Math.max(r, g, b);
    const c = key >= 0.999999 ? 0 : (1 - r - key) / (1 - key);
    const m = key >= 0.999999 ? 0 : (1 - g - key) / (1 - key);
    const y = key >= 0.999999 ? 0 : (1 - b - key) / (1 - key);
    return {
      c: round(c * 100, 3),
      m: round(m * 100, 3),
      y: round(y * 100, 3),
      k: round(key * 100, 3),
      approximate: true,
      profile: "generic-device-independent",
      notice: CMYK_NOTICE
    };
  }

  function cmykToRgbApproximation(cmykInput) {
    const color = cmykInput || {};
    const c = clamp(color.c, 0, 100, 0) / 100;
    const m = clamp(color.m, 0, 100, 0) / 100;
    const y = clamp(color.y, 0, 100, 0) / 100;
    const k = clamp(color.k, 0, 100, 0) / 100;
    return {
      r: round(255 * (1 - c) * (1 - k), 4),
      g: round(255 * (1 - m) * (1 - k), 4),
      b: round(255 * (1 - y) * (1 - k), 4),
      approximate: true,
      notice: CMYK_NOTICE
    };
  }

  function softProofRgb(colorInput, optionsInput) {
    const options = optionsInput || {};
    const source = normalizeRgb(colorInput);
    const cmyk = rgbToCmykApproximation(source);
    const dotGain = clamp(options.dotGain, 0, 0.4, 0.14);
    const inkLimit = clamp(options.inkLimit, 100, 400, 300);
    const paper = hexToRgb(normalizeHex(options.paper, "#F4F0E6"));
    let channels = [cmyk.c, cmyk.m, cmyk.y, cmyk.k];
    const total = channels.reduce((sum, value) => sum + value, 0);
    if (total > inkLimit) {
      const scale = inkLimit / total;
      channels = channels.map((value) => value * scale);
    }
    channels = channels.map((value, index) => clamp(value + (100 - value) * dotGain * (index === 3 ? 0.22 : 0.12), 0, 100, value));
    const converted = cmykToRgbApproximation({ c: channels[0], m: channels[1], y: channels[2], k: channels[3] });
    const paperMix = 0.08;
    const rgb = {
      r: round(converted.r * (1 - paperMix) + paper.r * paperMix, 4),
      g: round(converted.g * (1 - paperMix) + paper.g * paperMix, 4),
      b: round(converted.b * (1 - paperMix) + paper.b * paperMix, 4)
    };
    return {
      source,
      rgb,
      hex: rgbToHex(rgb),
      cmyk: { c: round(channels[0], 2), m: round(channels[1], 2), y: round(channels[2], 2), k: round(channels[3], 2) },
      approximate: true,
      profile: "generic-cmyk-soft-proof",
      notice: SOFT_PROOF_NOTICE
    };
  }

  function softProofPixels(pixelsInput, optionsInput) {
    const source = pixelsInput && pixelsInput.data ? pixelsInput.data : pixelsInput;
    if (!source || typeof source.length !== "number") return new Uint8ClampedArray(0);
    const output = new Uint8ClampedArray(source.length);
    for (let index = 0; index + 2 < source.length; index += 4) {
      const proof = softProofRgb({ r: source[index], g: source[index + 1], b: source[index + 2] }, optionsInput);
      output[index] = Math.round(proof.rgb.r);
      output[index + 1] = Math.round(proof.rgb.g);
      output[index + 2] = Math.round(proof.rgb.b);
      output[index + 3] = source[index + 3] == null ? 255 : source[index + 3];
    }
    return output;
  }

  function parseCubeNumber(parts, label) {
    const values = parts.map(Number);
    if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) throw new Error(`${label} phải có đúng 3 số hữu hạn.`);
    return values;
  }

  function normalizeCubeLut(lutInput) {
    const lut = lutInput && typeof lutInput === "object" ? lutInput : {};
    const type = lut.type === "1D" ? "1D" : "3D";
    const size = Math.round(clamp(lut.size, 2, MAX_CUBE_SIZE, 2));
    const expected = type === "1D" ? size : size * size * size;
    if (!Array.isArray(lut.data) || lut.data.length !== expected) throw new Error(`LUT ${type} cần đúng ${expected} mẫu.`);
    const data = lut.data.map((row, index) => {
      if (!Array.isArray(row) || row.length < 3) throw new Error(`Mẫu LUT ${index + 1} không hợp lệ.`);
      const values = row.slice(0, 3).map(Number);
      if (values.some((value) => !Number.isFinite(value))) throw new Error(`Mẫu LUT ${index + 1} không phải số hữu hạn.`);
      return values;
    });
    const domainMin = Array.isArray(lut.domainMin) ? parseCubeNumber(lut.domainMin.slice(0, 3), "DOMAIN_MIN") : [0, 0, 0];
    const domainMax = Array.isArray(lut.domainMax) ? parseCubeNumber(lut.domainMax.slice(0, 3), "DOMAIN_MAX") : [1, 1, 1];
    domainMin.forEach((value, index) => {
      if (domainMax[index] <= value) throw new Error("DOMAIN_MAX phải lớn hơn DOMAIN_MIN trên mọi kênh.");
    });
    return {
      format: "cube-lut",
      title: safeText(lut.title, "HH Color LUT", 120).replace(/[\r\n"]/g, " "),
      type,
      size,
      domainMin,
      domainMax,
      data
    };
  }

  function parseCubeLut(textInput) {
    const text = String(textInput == null ? "" : textInput);
    if (!text.trim()) throw new Error("Tệp .cube trống.");
    if (text.length > 6 * 1024 * 1024) throw new Error("Tệp .cube vượt giới hạn 6 MB.");
    let title = "Imported LUT";
    let type = null;
    let size = 0;
    let domainMin = [0, 0, 0];
    let domainMax = [1, 1, 1];
    const data = [];
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) return;
      const titleMatch = line.match(/^TITLE\s+"([^"]*)"\s*$/i);
      if (titleMatch) {
        title = safeText(titleMatch[1], "Imported LUT", 120);
        return;
      }
      const parts = line.split(/\s+/);
      const keyword = parts[0].toUpperCase();
      if (keyword === "LUT_1D_SIZE" || keyword === "LUT_3D_SIZE") {
        const nextType = keyword === "LUT_1D_SIZE" ? "1D" : "3D";
        if (type && type !== nextType) throw new Error("Một tệp không thể đồng thời chứa LUT 1D và 3D.");
        type = nextType;
        size = Number(parts[1]);
        if (!Number.isInteger(size) || size < 2 || size > MAX_CUBE_SIZE) throw new Error(`Kích thước LUT phải từ 2 đến ${MAX_CUBE_SIZE}.`);
        return;
      }
      if (keyword === "DOMAIN_MIN" || keyword === "LUT_1D_INPUT_RANGE" || keyword === "LUT_3D_INPUT_RANGE") {
        if (keyword === "DOMAIN_MIN") domainMin = parseCubeNumber(parts.slice(1), "DOMAIN_MIN");
        else {
          const range = parts.slice(1).map(Number);
          if (range.length !== 2 || range.some((value) => !Number.isFinite(value))) throw new Error(`Input range không hợp lệ ở dòng ${lineIndex + 1}.`);
          domainMin = [range[0], range[0], range[0]];
          domainMax = [range[1], range[1], range[1]];
        }
        return;
      }
      if (keyword === "DOMAIN_MAX") {
        domainMax = parseCubeNumber(parts.slice(1), "DOMAIN_MAX");
        return;
      }
      if (/^[A-Z_]/i.test(parts[0]) && !/^[+-]?(?:\d|\.\d)/.test(parts[0])) throw new Error(`Directive .cube không được hỗ trợ ở dòng ${lineIndex + 1}: ${parts[0]}`);
      data.push(parseCubeNumber(parts, `Dòng ${lineIndex + 1}`));
    });
    if (!type || !size) throw new Error("Thiếu LUT_1D_SIZE hoặc LUT_3D_SIZE.");
    return normalizeCubeLut({ title, type, size, domainMin, domainMax, data });
  }

  function createIdentityLut(sizeInput, typeInput) {
    const type = typeInput === "1D" ? "1D" : "3D";
    const size = Math.round(clamp(sizeInput, 2, MAX_CUBE_SIZE, 2));
    const data = [];
    if (type === "1D") {
      for (let index = 0; index < size; index += 1) {
        const value = index / (size - 1);
        data.push([value, value, value]);
      }
    } else {
      for (let blue = 0; blue < size; blue += 1) {
        for (let green = 0; green < size; green += 1) {
          for (let red = 0; red < size; red += 1) data.push([red / (size - 1), green / (size - 1), blue / (size - 1)]);
        }
      }
    }
    return normalizeCubeLut({ title: "HH Identity", type, size, domainMin: [0, 0, 0], domainMax: [1, 1, 1], data });
  }

  function exportCubeLut(lutInput, titleInput) {
    const lut = normalizeCubeLut(lutInput);
    const title = safeText(titleInput, lut.title || "HH Color LUT", 120).replace(/[\r\n"]/g, " ");
    const lines = [
      `# Exported locally by HH Graphic Color Pro v${VERSION}`,
      `TITLE "${title}"`,
      `LUT_${lut.type}_SIZE ${lut.size}`,
      `DOMAIN_MIN ${lut.domainMin.map((value) => Number(value).toFixed(6)).join(" ")}`,
      `DOMAIN_MAX ${lut.domainMax.map((value) => Number(value).toFixed(6)).join(" ")}`
    ];
    lut.data.forEach((row) => lines.push(row.map((value) => Number(value).toFixed(6)).join(" ")));
    return `${lines.join("\n")}\n`;
  }

  function interpolate(first, second, amount) {
    return first + (second - first) * amount;
  }

  function applyNormalizedCubeLut(colorInput, lut) {
    const source = normalizeRgb(colorInput);
    const normalized = [source.r, source.g, source.b].map((value, index) => {
      const input = value / 255;
      return clamp((input - lut.domainMin[index]) / (lut.domainMax[index] - lut.domainMin[index]), 0, 1, 0);
    });
    let output;
    if (lut.type === "1D") {
      output = [0, 1, 2].map((channel) => {
        const position = normalized[channel] * (lut.size - 1);
        const low = Math.floor(position);
        const high = Math.min(lut.size - 1, low + 1);
        return interpolate(lut.data[low][channel], lut.data[high][channel], position - low);
      });
    } else {
      const positions = normalized.map((value) => value * (lut.size - 1));
      const low = positions.map(Math.floor);
      const high = low.map((value) => Math.min(lut.size - 1, value + 1));
      const fraction = positions.map((value, index) => value - low[index]);
      const sample = (red, green, blue) => lut.data[red + lut.size * (green + lut.size * blue)];
      output = [0, 1, 2].map((channel) => {
        const c000 = sample(low[0], low[1], low[2])[channel];
        const c100 = sample(high[0], low[1], low[2])[channel];
        const c010 = sample(low[0], high[1], low[2])[channel];
        const c110 = sample(high[0], high[1], low[2])[channel];
        const c001 = sample(low[0], low[1], high[2])[channel];
        const c101 = sample(high[0], low[1], high[2])[channel];
        const c011 = sample(low[0], high[1], high[2])[channel];
        const c111 = sample(high[0], high[1], high[2])[channel];
        const c00 = interpolate(c000, c100, fraction[0]);
        const c10 = interpolate(c010, c110, fraction[0]);
        const c01 = interpolate(c001, c101, fraction[0]);
        const c11 = interpolate(c011, c111, fraction[0]);
        return interpolate(interpolate(c00, c10, fraction[1]), interpolate(c01, c11, fraction[1]), fraction[2]);
      });
    }
    return { r: round(clamp(output[0] * 255, 0, 255, 0), 4), g: round(clamp(output[1] * 255, 0, 255, 0), 4), b: round(clamp(output[2] * 255, 0, 255, 0), 4) };
  }

  function applyCubeLut(colorInput, lutInput) {
    return applyNormalizedCubeLut(colorInput, normalizeCubeLut(lutInput));
  }

  function applyLutToPixels(pixelsInput, lutInput) {
    const source = pixelsInput && pixelsInput.data ? pixelsInput.data : pixelsInput;
    if (!source || typeof source.length !== "number") return new Uint8ClampedArray(0);
    const lut = normalizeCubeLut(lutInput);
    const output = new Uint8ClampedArray(source.length);
    for (let index = 0; index + 2 < source.length; index += 4) {
      const rgb = applyNormalizedCubeLut({ r: source[index], g: source[index + 1], b: source[index + 2] }, lut);
      output[index] = Math.round(rgb.r);
      output[index + 1] = Math.round(rgb.g);
      output[index + 2] = Math.round(rgb.b);
      output[index + 3] = source[index + 3] == null ? 255 : source[index + 3];
    }
    return output;
  }

  function buildBrandTokens(brandInput) {
    const fallback = {
      name: "HH Color System",
      primary: "#FF5F87",
      secondary: "#54D7E4",
      accent: "#F5C451",
      neutral: "#74808A",
      background: "#0D141A",
      text: "#F4F7F8"
    };
    const brand = brandInput && typeof brandInput === "object" ? brandInput : {};
    const result = { name: safeText(brand.name, fallback.name, 120) };
    BRAND_ROLES.forEach((role) => { result[role.id] = normalizeHex(brand[role.id], fallback[role.id]); });
    return result;
  }

  function exportBrandCss(brandInput) {
    const brand = buildBrandTokens(brandInput);
    const lines = BRAND_ROLES.map((role) => `  --hh-color-${role.id}: ${brand[role.id]};`);
    return `/* ${brand.name.replace(/\*\//g, "")} · local color tokens */\n:root {\n${lines.join("\n")}\n}\n`;
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      meta: { id: uid("color-project"), name: "Professional Color Pipeline", updatedAt: new Date().toISOString() },
      activeTab: "convert",
      baseColor: "#FF5F87",
      harmonyMode: "complementary",
      palette: ["#FF5F87", "#54D7E4", "#F5C451", "#52C98B", "#7957D5"],
      paletteSource: "Bảng màu dự án",
      mesh: createGradientMesh(),
      brand: buildBrandTokens(),
      contrast: { foreground: "#F4F7F8", background: "#0D141A", fontSize: 16, bold: false },
      proof: { enabled: false, dotGain: 0.14, inkLimit: 300, paper: "#F4F0E6" },
      lut: createIdentityLut(2),
      lutEnabled: false
    };
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const fallback = createDefaultProject();
    let lut = fallback.lut;
    try { if (source.lut) lut = normalizeCubeLut(source.lut); } catch (_) { lut = fallback.lut; }
    const tabs = ["convert", "harmony", "mesh", "image", "brand", "proof", "lut"];
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        id: safeText(source.meta && source.meta.id, fallback.meta.id, 100).replace(/[^a-zA-Z0-9_-]/g, "") || fallback.meta.id,
        name: safeText(source.meta && source.meta.name, fallback.meta.name, 120),
        updatedAt: safeText(source.meta && source.meta.updatedAt, fallback.meta.updatedAt, 40)
      },
      activeTab: tabs.includes(source.activeTab) ? source.activeTab : fallback.activeTab,
      baseColor: normalizeHex(source.baseColor, fallback.baseColor),
      harmonyMode: HARMONY_MODES.some((mode) => mode.id === source.harmonyMode) ? source.harmonyMode : fallback.harmonyMode,
      palette: Array.isArray(source.palette) ? source.palette.slice(0, 12).map((color) => normalizeHex(color, fallback.baseColor)) : fallback.palette,
      paletteSource: safeText(source.paletteSource, fallback.paletteSource, 160),
      mesh: normalizeGradientMesh(source.mesh),
      brand: buildBrandTokens(source.brand),
      contrast: {
        foreground: normalizeHex(source.contrast && source.contrast.foreground, fallback.contrast.foreground),
        background: normalizeHex(source.contrast && source.contrast.background, fallback.contrast.background),
        fontSize: clamp(source.contrast && source.contrast.fontSize, 8, 200, fallback.contrast.fontSize),
        bold: Boolean(source.contrast && source.contrast.bold)
      },
      proof: {
        enabled: Boolean(source.proof && source.proof.enabled),
        dotGain: clamp(source.proof && source.proof.dotGain, 0, 0.4, fallback.proof.dotGain),
        inkLimit: clamp(source.proof && source.proof.inkLimit, 100, 400, fallback.proof.inkLimit),
        paper: normalizeHex(source.proof && source.proof.paper, fallback.proof.paper)
      },
      lut,
      lutEnabled: Boolean(source.lutEnabled)
    };
  }

  function exportProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function detectCapabilities(scopeInput) {
    const scope = scopeInput || {};
    let canvas = false;
    let storage = false;
    try {
      const element = scope.document && scope.document.createElement && scope.document.createElement("canvas");
      canvas = Boolean(element && element.getContext && element.getContext("2d"));
    } catch (_) { canvas = false; }
    try { storage = Boolean(scope.localStorage); } catch (_) { storage = false; }
    return {
      canvas2d: { supported: canvas, reason: canvas ? "" : "Trình duyệt không hỗ trợ Canvas 2D." },
      localImage: { supported: Boolean(canvas && scope.FileReader && scope.Image), reason: canvas && scope.FileReader && scope.Image ? "" : "Không thể đọc và giải mã ảnh local trong trình duyệt này." },
      fileImport: { supported: Boolean(scope.FileReader), reason: scope.FileReader ? "" : "FileReader không được hỗ trợ." },
      download: { supported: Boolean(scope.document && scope.Blob && scope.URL && typeof scope.URL.createObjectURL === "function"), reason: scope.document && scope.Blob && scope.URL && typeof scope.URL.createObjectURL === "function" ? "" : "Trình duyệt không hỗ trợ tạo tệp tải xuống." },
      localStorage: { supported: storage, reason: storage ? "" : "Không thể dùng localStorage trong ngữ cảnh này." },
      reducedMotion: Boolean(scope.matchMedia && scope.matchMedia("(prefers-reduced-motion: reduce)").matches)
    };
  }

  function createPreviewBuffer(widthInput, heightInput) {
    const width = Math.round(clamp(widthInput, 32, 640, 320));
    const height = Math.round(clamp(heightInput, 24, 420, 180));
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const x = column / Math.max(1, width - 1);
        const y = row / Math.max(1, height - 1);
        const rgb = row > height * 0.82
          ? hslToRgb(0, 0, x * 100)
          : hslToRgb(x * 360, 82, 22 + (1 - y) * 58);
        const offset = (row * width + column) * 4;
        data[offset] = Math.round(rgb.r);
        data[offset + 1] = Math.round(rgb.g);
        data[offset + 2] = Math.round(rgb.b);
        data[offset + 3] = 255;
      }
    }
    return { data, width, height, name: "HH color chart" };
  }

  function drawPixelBuffer(canvas, bufferInput) {
    const buffer = bufferInput || {};
    if (!canvas || typeof canvas.getContext !== "function") return { supported: false, reason: "Canvas 2D không khả dụng." };
    const context = canvas.getContext("2d");
    if (!context || typeof context.createImageData !== "function" || typeof context.putImageData !== "function") return { supported: false, reason: "Canvas pixel API không khả dụng." };
    const width = Math.round(Number(buffer.width));
    const height = Math.round(Number(buffer.height));
    if (!width || !height || !buffer.data || buffer.data.length !== width * height * 4) return { supported: false, reason: "Dữ liệu ảnh không hợp lệ." };
    const image = context.createImageData(width, height);
    image.data.set(buffer.data);
    canvas.width = width;
    canvas.height = height;
    context.putImageData(image, 0, 0);
    return { supported: true, width, height };
  }

  function processPixelBuffer(bufferInput, projectInput) {
    const buffer = bufferInput || {};
    const project = normalizeProject(projectInput);
    let data = new Uint8ClampedArray(buffer.data || []);
    if (project.lutEnabled) data = applyLutToPixels(data, project.lut);
    if (project.proof.enabled) data = softProofPixels(data, project.proof);
    return { data, width: Number(buffer.width) || 0, height: Number(buffer.height) || 0, name: safeText(buffer.name, "Preview", 160) };
  }

  function readTextFile(file, scopeInput, maxBytesInput) {
    const scope = scopeInput || globalScope;
    const maxBytes = Number(maxBytesInput) || 6 * 1024 * 1024;
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error("Chưa có tệp.")); return; }
      if (Number(file.size) > maxBytes) { reject(new Error(`Tệp vượt giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB.`)); return; }
      if (!scope.FileReader) { reject(new Error("FileReader không được hỗ trợ.")); return; }
      const reader = new scope.FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không thể đọc tệp local."));
      reader.readAsText(file);
    });
  }

  function decodeLocalImage(file, scopeInput) {
    const scope = scopeInput || globalScope;
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error("Chưa có ảnh.")); return; }
      if (Number(file.size) > MAX_IMAGE_BYTES) { reject(new Error("Ảnh vượt giới hạn 20 MB.")); return; }
      if (file.type && !/^image\/(?:png|jpeg|webp)$/i.test(file.type)) { reject(new Error("Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP local.")); return; }
      const capabilities = detectCapabilities(scope);
      if (!capabilities.localImage.supported) { reject(new Error(capabilities.localImage.reason)); return; }
      const reader = new scope.FileReader();
      reader.onerror = () => reject(new Error("Không thể đọc ảnh local."));
      reader.onload = () => {
        const image = new scope.Image();
        image.onerror = () => reject(new Error("Trình duyệt không thể giải mã ảnh này."));
        image.onload = () => {
          try {
            const sourceWidth = Number(image.naturalWidth || image.width);
            const sourceHeight = Number(image.naturalHeight || image.height);
            if (!sourceWidth || !sourceHeight) throw new Error("Ảnh không có kích thước hợp lệ.");
            const scale = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));
            const canvas = scope.document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Canvas 2D không khả dụng.");
            context.drawImage(image, 0, 0, width, height);
            const pixels = context.getImageData(0, 0, width, height);
            resolve({ data: new Uint8ClampedArray(pixels.data), width, height, name: safeText(file.name, "Ảnh local", 160), type: safeText(file.type, "image", 80) });
          } catch (error) { reject(error); }
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function ensureStyles() {
    const documentRef = globalScope.document;
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhcolor{--hc-bg:#091015;--hc-panel:#0e181e;--hc-panel2:#132129;--hc-line:#2b424c;--hc-text:#f3f7f6;--hc-muted:#9bafb5;--hc-cyan:#58d7df;--hc-coral:#ff7086;--hc-lime:#b8e66f;--hc-yellow:#f3c75f;display:block;min-width:0;overflow:hidden;border:1px solid var(--hc-line);border-radius:8px;background:var(--hc-bg);color:var(--hc-text);font:500 12px/1.45 Inter,Segoe UI,system-ui,sans-serif;letter-spacing:0}.hhcolor *{box-sizing:border-box}.hhcolor button,.hhcolor input,.hhcolor select{font:inherit;letter-spacing:0}.hhcolor button{cursor:pointer}.hhcolor button:disabled{cursor:not-allowed;opacity:.45}.hhcolor :focus-visible{outline:2px solid var(--hc-cyan);outline-offset:2px}.hhc-top{display:flex;align-items:center;gap:8px;min-height:58px;padding:8px 10px;border-bottom:1px solid var(--hc-line);background:#0b141a}.hhc-brandmark{display:flex;align-items:center;gap:9px;min-width:220px;margin-right:auto}.hhc-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--hc-coral);border-radius:6px;color:var(--hc-coral);font-weight:900}.hhc-brandmark strong,.hhc-brandmark small{display:block}.hhc-brandmark small,.hhc-muted{color:var(--hc-muted);font-size:10px}.hhc-project-name{width:min(260px,24vw);min-height:34px;padding:6px 8px;border:1px solid var(--hc-line);border-radius:5px;background:#081116;color:var(--hc-text)}.hhc-btn{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:6px 10px;border:1px solid var(--hc-line);border-radius:6px;background:#15242b;color:var(--hc-text)}.hhc-btn:hover{border-color:var(--hc-cyan);background:#1a2c34}.hhc-btn-primary{border-color:transparent;background:var(--hc-cyan);color:#061114;font-weight:850}.hhc-shell{display:grid;grid-template-columns:176px minmax(0,1fr);min-height:650px}.hhc-tabs{display:flex;flex-direction:column;gap:3px;padding:10px;border-right:1px solid var(--hc-line);background:#0c151b}.hhc-tab{display:flex;align-items:center;width:100%;min-height:38px;padding:7px 9px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--hc-muted);text-align:left}.hhc-tab[aria-selected=true]{border-color:#31525d;background:#14262d;color:var(--hc-text);box-shadow:inset 3px 0 var(--hc-coral)}.hhc-main{min-width:0}.hhc-panel{min-width:0}.hhc-panel[hidden]{display:none}.hhc-panel-head{display:flex;align-items:center;gap:8px;min-height:48px;padding:9px 14px;border-bottom:1px solid var(--hc-line);background:#0c161c}.hhc-panel-head h2{margin:0 auto 0 0;font-size:14px}.hhc-grid{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);min-height:550px}.hhc-controls{min-width:0;border-right:1px solid var(--hc-line);background:var(--hc-panel)}.hhc-preview{min-width:0;background:#080e12}.hhc-section{padding:13px;border-bottom:1px solid var(--hc-line)}.hhc-section h3{margin:0 0 10px;font-size:12px}.hhc-eyebrow{display:block;margin-bottom:8px;color:var(--hc-cyan);font-size:9px;font-weight:900;text-transform:uppercase}.hhc-field{display:grid;gap:5px;margin-bottom:10px}.hhc-field>span{color:#bfd0d4;font-size:10px;font-weight:750}.hhc-field input,.hhc-field select{width:100%;min-width:0;min-height:34px;padding:6px 8px;border:1px solid var(--hc-line);border-radius:5px;background:#081116;color:var(--hc-text)}.hhc-row{display:flex;align-items:center;gap:7px}.hhc-row>*{min-width:0}.hhc-row .hhc-field{flex:1}.hhc-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hhc-toggle{display:flex;align-items:center;gap:7px;min-height:32px;color:#c7d5d8}.hhc-toggle input{accent-color:var(--hc-coral)}.hhc-colorpair{display:grid;grid-template-columns:42px minmax(0,1fr);gap:7px}.hhc-colorpair input[type=color]{height:36px;padding:3px}.hhc-stage-wrap{display:grid;place-items:center;min-height:390px;padding:20px;background-color:#091116;background-image:linear-gradient(#132129 1px,transparent 1px),linear-gradient(90deg,#132129 1px,transparent 1px);background-size:24px 24px}.hhc-color-stage{display:grid;place-items:end start;width:min(100%,760px);aspect-ratio:12/7;padding:22px;border:1px solid #36515b;border-radius:6px;background:#ff5f87;box-shadow:0 20px 48px #0008}.hhc-color-stage span{padding:5px 7px;border-radius:4px;background:#071015cc;color:#fff;font-weight:800}.hhc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--hc-line)}.hhc-metric{min-width:0;padding:11px;border-right:1px solid var(--hc-line)}.hhc-metric:last-child{border-right:0}.hhc-metric span,.hhc-metric strong{display:block}.hhc-metric span{margin-bottom:4px;color:var(--hc-muted);font-size:9px;text-transform:uppercase}.hhc-metric strong{overflow-wrap:anywhere;font-size:11px}.hhc-palette{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}.hhc-swatch{position:relative;display:grid;align-content:end;min-height:92px;padding:8px;border:1px solid #ffffff35;border-radius:6px;background:var(--swatch);color:#fff;text-align:left;text-shadow:0 1px 3px #000}.hhc-swatch::after{position:absolute;inset:0;border-radius:5px;background:#0002;content:""}.hhc-swatch span,.hhc-swatch small{position:relative;z-index:1}.hhc-swatch small{font-size:9px}.hhc-swatch[data-warning=true]{box-shadow:inset 0 0 0 2px var(--hc-yellow)}.hhc-canvasbox{padding:14px}.hhc-canvas{display:block;width:100%;height:auto;min-height:180px;aspect-ratio:12/7;border:1px solid #38515b;border-radius:6px;background:#101820;image-rendering:auto}.hhc-mesh-points{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hhc-mesh-point{padding:8px;border:1px solid var(--hc-line);border-radius:6px;background:#0b1419}.hhc-mesh-point strong{display:block;margin-bottom:7px;font-size:10px}.hhc-point-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:5px}.hhc-point-values input{width:100%;min-height:30px;padding:4px;border:1px solid var(--hc-line);border-radius:4px;background:#071015;color:var(--hc-text)}.hhc-image-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}.hhc-image-grid figure{min-width:0;margin:0}.hhc-image-grid figcaption{margin-bottom:6px;color:var(--hc-muted);font-size:10px}.hhc-image-grid canvas{min-height:150px}.hhc-brand-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hhc-brand-token{display:grid;grid-template-columns:38px minmax(0,1fr);gap:6px;align-items:center}.hhc-brand-token input[type=color]{width:38px;height:34px;padding:3px;border:1px solid var(--hc-line);border-radius:5px;background:#081116}.hhc-brand-token input[type=text]{width:100%;min-width:0;min-height:34px;padding:6px;border:1px solid var(--hc-line);border-radius:5px;background:#081116;color:var(--hc-text)}.hhc-contrast-preview{display:grid;place-items:center;min-height:230px;padding:28px;text-align:center}.hhc-contrast-preview strong{font-size:24px}.hhc-result{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--hc-line)}.hhc-result div{padding:12px;border-right:1px solid var(--hc-line)}.hhc-result div:last-child{border-right:0}.hhc-result span,.hhc-result strong{display:block}.hhc-result span{color:var(--hc-muted);font-size:9px}.hhc-pass{color:var(--hc-lime)}.hhc-fail{color:#ff9aaa}.hhc-proof-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}.hhc-proof-sample{display:grid;place-items:end start;min-height:210px;padding:14px;border:1px solid var(--hc-line);border-radius:6px;background:var(--proof-color)}.hhc-proof-sample span{padding:4px 6px;border-radius:4px;background:#071015cc;color:#fff}.hhc-note{margin:8px 0 0;padding:8px;border-left:3px solid var(--hc-yellow);background:#19180f;color:#d8d5c4;font-size:10px}.hhc-capabilities{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 10px;margin:0}.hhc-capabilities dt{color:var(--hc-muted)}.hhc-capabilities dd{margin:0;color:#ff9aaa}.hhc-capabilities dd[data-supported=true]{color:var(--hc-lime)}.hhc-empty{display:grid;place-items:center;min-height:180px;padding:20px;color:var(--hc-muted);text-align:center}.hhc-status{min-height:32px;padding:8px 12px;border-top:1px solid var(--hc-line);background:#081116;color:var(--hc-muted)}.hhc-file{display:none}.hhc-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1050px){.hhc-shell{grid-template-columns:1fr}.hhc-tabs{flex-direction:row;overflow:auto;border-right:0;border-bottom:1px solid var(--hc-line)}.hhc-tab{flex:0 0 auto;width:auto}.hhc-grid{grid-template-columns:minmax(230px,290px) minmax(0,1fr)}.hhc-brand-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.hhc-top{flex-wrap:wrap}.hhc-brandmark{width:100%}.hhc-project-name{width:100%;order:2}.hhc-top .hhc-btn{flex:1}.hhc-grid{display:block}.hhc-controls{border-right:0;border-bottom:1px solid var(--hc-line)}.hhc-stage-wrap{min-height:270px;padding:10px}.hhc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.hhc-metric:nth-child(2){border-right:0}.hhc-metric:nth-child(-n+2){border-bottom:1px solid var(--hc-line)}}@media(max-width:420px){.hhcolor{border-left:0;border-right:0}.hhc-top .hhc-btn{min-width:calc(50% - 5px)}.hhc-tabs{padding:7px}.hhc-tab{min-height:36px;padding:6px 8px}.hhc-grid2,.hhc-mesh-points,.hhc-image-grid,.hhc-brand-list,.hhc-proof-pair{grid-template-columns:1fr}.hhc-palette{grid-template-columns:repeat(2,minmax(0,1fr))}.hhc-stage-wrap{min-height:230px}.hhc-color-stage{padding:12px}.hhc-result{grid-template-columns:1fr}.hhc-result div{border-right:0;border-bottom:1px solid var(--hc-line)}.hhc-result div:last-child{border-bottom:0}.hhc-panel-head{align-items:flex-start;flex-wrap:wrap}.hhc-panel-head .hhc-btn{flex:1}.hhc-canvas{min-height:140px}}@media(prefers-reduced-motion:reduce){.hhcolor *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    documentRef.head.appendChild(style);
  }

  function downloadText(filename, content, mime) {
    const capabilities = detectCapabilities(globalScope);
    if (!capabilities.download.supported) return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([content], { type: mime || "text/plain;charset=utf-8" }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function mount(root, optionsInput) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root).api;
    ensureStyles();
    const options = optionsInput || {};
    const capabilities = detectCapabilities(globalScope);
    let storage = options.storage;
    if (storage === undefined) {
      try { storage = globalScope.localStorage || null; } catch (_) { storage = null; }
    }
    let project = options.project ? normalizeProject(options.project) : createDefaultProject();
    if (!options.project) {
      try {
        const saved = storage && storage.getItem(STORAGE_KEY);
        if (saved) project = normalizeProject(JSON.parse(saved));
      } catch (_) { /* Keep the valid local default. */ }
    }
    let imageBuffer = null;
    let statusTimer = 0;
    let disposed = false;
    const listeners = [];
    const fallbackPreview = createPreviewBuffer(320, 180);

    root.classList.add("hhcolor");
    root.setAttribute("data-graphic-color-pro", "");
    root.innerHTML = `<header class="hhc-top"><div class="hhc-brandmark"><span class="hhc-mark" aria-hidden="true">CP</span><div><strong>Professional Color Pipeline</strong><small>Color math · local-first</small></div></div><label class="hhc-sr" for="hhc-project-name">Tên dự án</label><input id="hhc-project-name" class="hhc-project-name" maxlength="120" data-hhc-project-name><button class="hhc-btn" type="button" data-hhc-action="import-project">Nhập project</button><button class="hhc-btn hhc-btn-primary" type="button" data-hhc-action="export-project">Xuất project</button><input class="hhc-file" type="file" accept="application/json,.json" data-hhc-project-file aria-label="Chọn Color Pipeline project JSON"></header><div class="hhc-shell"><nav class="hhc-tabs" role="tablist" aria-label="Công cụ màu"><button class="hhc-tab" type="button" role="tab" id="hhc-tab-convert" aria-controls="hhc-panel-convert" data-hhc-tab="convert">Chuyển đổi</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-harmony" aria-controls="hhc-panel-harmony" data-hhc-tab="harmony">Harmony</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-mesh" aria-controls="hhc-panel-mesh" data-hhc-tab="mesh">Gradient mesh</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-image" aria-controls="hhc-panel-image" data-hhc-tab="image">Palette ảnh</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-brand" aria-controls="hhc-panel-brand" data-hhc-tab="brand">Brand colors</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-proof" aria-controls="hhc-panel-proof" data-hhc-tab="proof">WCAG & proof</button><button class="hhc-tab" type="button" role="tab" id="hhc-tab-lut" aria-controls="hhc-panel-lut" data-hhc-tab="lut">LUT .cube</button></nav><main class="hhc-main">
      <section class="hhc-panel" id="hhc-panel-convert" role="tabpanel" aria-labelledby="hhc-tab-convert" data-hhc-panel="convert"><header class="hhc-panel-head"><h2>Color conversion</h2><span class="hhc-muted" data-hhc-gamut-status></span></header><div class="hhc-grid"><aside class="hhc-controls"><div class="hhc-section"><span class="hhc-eyebrow">Màu nguồn</span><div class="hhc-colorpair"><input type="color" value="#FF5F87" data-hhc-base-color aria-label="Màu nguồn"><label class="hhc-field"><span>HEX</span><input maxlength="7" value="#FF5F87" data-hhc-base-hex></label></div></div><div class="hhc-section"><span class="hhc-eyebrow">Không gian màu</span><dl class="hhc-capabilities"><dt>RGB</dt><dd data-hhc-value="rgb"></dd><dt>HSL</dt><dd data-hhc-value="hsl"></dd><dt>CIELAB D65</dt><dd data-hhc-value="lab"></dd><dt>OKLCH</dt><dd data-hhc-value="oklch"></dd><dt>CMYK xấp xỉ</dt><dd data-hhc-value="cmyk"></dd></dl><p class="hhc-note">${escapeHtml(CMYK_NOTICE)}</p></div></aside><div class="hhc-preview"><div class="hhc-stage-wrap"><div class="hhc-color-stage" data-hhc-base-preview><span data-hhc-base-label></span></div></div><div class="hhc-metrics"><div class="hhc-metric"><span>Lightness HSL</span><strong data-hhc-metric="hsl-l"></strong></div><div class="hhc-metric"><span>L* LAB</span><strong data-hhc-metric="lab-l"></strong></div><div class="hhc-metric"><span>Chroma OKLCH</span><strong data-hhc-metric="oklch-c"></strong></div><div class="hhc-metric"><span>sRGB gamut</span><strong data-hhc-metric="gamut"></strong></div></div></div></div></section>
      <section class="hhc-panel" id="hhc-panel-harmony" role="tabpanel" aria-labelledby="hhc-tab-harmony" data-hhc-panel="harmony" hidden><header class="hhc-panel-head"><h2>Harmony generator</h2><label class="hhc-field" style="margin:0"><span>Quy tắc</span><select data-hhc-harmony-mode>${HARMONY_MODES.map((mode) => `<option value="${mode.id}">${escapeHtml(mode.label)}</option>`).join("")}</select></label></header><div class="hhc-section"><div class="hhc-palette" data-hhc-harmony></div><p class="hhc-note" data-hhc-harmony-note></p></div></section>
      <section class="hhc-panel" id="hhc-panel-mesh" role="tabpanel" aria-labelledby="hhc-tab-mesh" data-hhc-panel="mesh" hidden><header class="hhc-panel-head"><h2>Gradient mesh</h2><button class="hhc-btn" type="button" data-hhc-action="mesh-harmony">Nạp harmony</button></header><div class="hhc-grid"><aside class="hhc-controls"><div class="hhc-section"><span class="hhc-eyebrow">Mesh points</span><div class="hhc-mesh-points" data-hhc-mesh-points></div></div></aside><div class="hhc-preview"><div class="hhc-canvasbox"><canvas class="hhc-canvas" width="360" height="210" tabindex="0" aria-label="Canvas xem trước gradient mesh" data-hhc-mesh-canvas></canvas><p class="hhc-note" data-hhc-mesh-status></p></div></div></div></section>
      <section class="hhc-panel" id="hhc-panel-image" role="tabpanel" aria-labelledby="hhc-tab-image" data-hhc-panel="image" hidden><header class="hhc-panel-head"><h2>Palette extraction local</h2><label class="hhc-field" style="margin:0"><span>Số màu</span><input type="number" min="2" max="12" value="6" data-hhc-palette-count></label><button class="hhc-btn" type="button" data-hhc-action="load-image"${capabilities.localImage.supported ? "" : " disabled"}>Mở ảnh local</button><input class="hhc-file" type="file" accept="image/png,image/jpeg,image/webp" data-hhc-image-file aria-label="Chọn ảnh local để trích màu"></header><div class="hhc-image-grid"><figure><figcaption>Ảnh nguồn</figcaption><canvas class="hhc-canvas" width="320" height="180" tabindex="0" aria-label="Ảnh nguồn local" data-hhc-image-original></canvas></figure><figure><figcaption>Pipeline preview</figcaption><canvas class="hhc-canvas" width="320" height="180" tabindex="0" aria-label="Ảnh sau LUT và soft-proof" data-hhc-image-processed></canvas></figure></div><div class="hhc-section"><div class="hhc-row"><h3 style="margin-right:auto" data-hhc-palette-source></h3><button class="hhc-btn" type="button" data-hhc-action="palette-brand">Gán vào brand</button></div><div class="hhc-palette" data-hhc-palette></div><p class="hhc-note" data-hhc-image-status>${escapeHtml(capabilities.localImage.supported ? "Ảnh và pixel chỉ được xử lý trong phiên local; project chỉ lưu palette đã trích." : capabilities.localImage.reason)}</p></div></section>
      <section class="hhc-panel" id="hhc-panel-brand" role="tabpanel" aria-labelledby="hhc-tab-brand" data-hhc-panel="brand" hidden><header class="hhc-panel-head"><h2>Brand colors</h2><button class="hhc-btn" type="button" data-hhc-action="export-brand">Xuất CSS tokens</button></header><div class="hhc-section"><label class="hhc-field"><span>Tên hệ màu</span><input maxlength="120" data-hhc-brand-name></label><div class="hhc-brand-list">${BRAND_ROLES.map((role) => `<label class="hhc-brand-token"><input type="color" data-hhc-brand-color="${role.id}" aria-label="${escapeHtml(role.label)} color"><input type="text" maxlength="7" data-hhc-brand-hex="${role.id}" aria-label="${escapeHtml(role.label)} HEX"></label>`).join("")}</div></div><div class="hhc-section"><span class="hhc-eyebrow">Token preview</span><div class="hhc-palette" data-hhc-brand-preview></div><p class="hhc-note" data-hhc-brand-contrast></p></div></section>
      <section class="hhc-panel" id="hhc-panel-proof" role="tabpanel" aria-labelledby="hhc-tab-proof" data-hhc-panel="proof" hidden><header class="hhc-panel-head"><h2>WCAG contrast & soft-proof</h2><button class="hhc-btn" type="button" data-hhc-action="swap-contrast" aria-label="Đổi màu chữ và màu nền">Đổi màu</button></header><div class="hhc-grid"><aside class="hhc-controls"><div class="hhc-section"><span class="hhc-eyebrow">WCAG 2 contrast</span><div class="hhc-grid2"><label class="hhc-field"><span>Màu chữ</span><input type="color" data-hhc-contrast="foreground"></label><label class="hhc-field"><span>Màu nền</span><input type="color" data-hhc-contrast="background"></label><label class="hhc-field"><span>Cỡ chữ px</span><input type="number" min="8" max="200" step="1" data-hhc-contrast="fontSize"></label><label class="hhc-toggle"><input type="checkbox" data-hhc-contrast="bold"> Chữ đậm</label></div></div><div class="hhc-section"><span class="hhc-eyebrow">Soft-proof xấp xỉ</span><label class="hhc-toggle"><input type="checkbox" data-hhc-proof="enabled"> Bật trong pipeline preview</label><label class="hhc-field"><span>Dot gain mô phỏng</span><input type="range" min="0" max="0.4" step="0.01" data-hhc-proof="dotGain"></label><label class="hhc-field"><span>Giới hạn mực %</span><input type="number" min="100" max="400" step="5" data-hhc-proof="inkLimit"></label><label class="hhc-field"><span>Màu giấy mô phỏng</span><input type="color" data-hhc-proof="paper"></label><p class="hhc-note">${escapeHtml(SOFT_PROOF_NOTICE)}</p></div></aside><div class="hhc-preview"><div class="hhc-contrast-preview" data-hhc-contrast-preview><strong>HH Color System</strong></div><div class="hhc-result"><div><span>Tỉ lệ</span><strong data-hhc-contrast-result="ratio"></strong></div><div><span>WCAG AA</span><strong data-hhc-contrast-result="aa"></strong></div><div><span>WCAG AAA</span><strong data-hhc-contrast-result="aaa"></strong></div></div><div class="hhc-proof-pair"><div class="hhc-proof-sample" data-hhc-proof-sample="rgb"><span>RGB</span></div><div class="hhc-proof-sample" data-hhc-proof-sample="cmyk"><span>CMYK xấp xỉ</span></div></div></div></div></section>
      <section class="hhc-panel" id="hhc-panel-lut" role="tabpanel" aria-labelledby="hhc-tab-lut" data-hhc-panel="lut" hidden><header class="hhc-panel-head"><h2>LUT .cube</h2><button class="hhc-btn" type="button" data-hhc-action="import-lut"${capabilities.fileImport.supported ? "" : " disabled"}>Nhập .cube</button><button class="hhc-btn" type="button" data-hhc-action="identity-lut">Identity 17³</button><button class="hhc-btn" type="button" data-hhc-action="export-lut"${capabilities.download.supported ? "" : " disabled"}>Xuất .cube</button><input class="hhc-file" type="file" accept=".cube,text/plain" data-hhc-lut-file aria-label="Chọn LUT .cube local"></header><div class="hhc-grid"><aside class="hhc-controls"><div class="hhc-section"><label class="hhc-toggle"><input type="checkbox" data-hhc-lut-enabled> Áp dụng LUT vào preview</label><dl class="hhc-capabilities"><dt>Title</dt><dd data-hhc-lut-meta="title"></dd><dt>Loại</dt><dd data-hhc-lut-meta="type"></dd><dt>Kích thước</dt><dd data-hhc-lut-meta="size"></dd><dt>Số mẫu</dt><dd data-hhc-lut-meta="samples"></dd><dt>Domain</dt><dd data-hhc-lut-meta="domain"></dd></dl><p class="hhc-note" data-hhc-lut-status>Parser và preview chạy local, không tải LUT lên mạng.</p></div><div class="hhc-section"><span class="hhc-eyebrow">Capability status</span><dl class="hhc-capabilities" data-hhc-capabilities></dl></div></aside><div class="hhc-preview"><div class="hhc-canvasbox"><canvas class="hhc-canvas" width="320" height="180" tabindex="0" aria-label="Canvas xem trước LUT .cube" data-hhc-lut-canvas></canvas></div></div></div></section>
    </main></div><footer class="hhc-status" role="status" aria-live="polite" data-hhc-status>Sẵn sàng. Project được lưu local trên thiết bị.</footer>`;

    function query(selector) { return root.querySelector(selector); }
    function queryAll(selector) { return Array.from(root.querySelectorAll(selector)); }
    function on(node, eventName, handler) {
      if (!node) return;
      node.addEventListener(eventName, handler);
      listeners.push(() => node.removeEventListener(eventName, handler));
    }
    function announce(message, persistent) {
      const status = query("[data-hhc-status]");
      if (status) status.textContent = safeText(message, "", 500);
      globalScope.clearTimeout(statusTimer);
      if (!persistent) statusTimer = globalScope.setTimeout(() => {
        if (status && !disposed) status.textContent = capabilities.localStorage.supported ? "Đã tự lưu local trên thiết bị." : capabilities.localStorage.reason;
      }, 2800);
    }
    function persist() {
      project.meta.updatedAt = new Date().toISOString();
      try {
        if (!storage) throw new Error("storage unavailable");
        storage.setItem(STORAGE_KEY, JSON.stringify(project));
        return true;
      } catch (_) {
        announce("Không thể lưu local; thay đổi chỉ còn trong phiên hiện tại.", true);
        return false;
      }
    }
    function setTab(tab, shouldFocus) {
      const valid = query(`[data-hhc-tab="${tab}"]`) ? tab : "convert";
      project.activeTab = valid;
      queryAll("[data-hhc-tab]").forEach((button) => {
        const selected = button.dataset.hhcTab === valid;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && shouldFocus) button.focus();
      });
      queryAll("[data-hhc-panel]").forEach((panel) => { panel.hidden = panel.dataset.hhcPanel !== valid; });
      persist();
    }
    function renderConverter() {
      const report = colorReport(project.baseColor);
      const cmyk = rgbToCmykApproximation(report.rgb);
      query("[data-hhc-base-color]").value = report.hex;
      query("[data-hhc-base-hex]").value = report.hex;
      query("[data-hhc-base-preview]").style.backgroundColor = report.hex;
      query("[data-hhc-base-label]").textContent = report.hex;
      query('[data-hhc-value="rgb"]').textContent = `${Math.round(report.rgb.r)} / ${Math.round(report.rgb.g)} / ${Math.round(report.rgb.b)}`;
      query('[data-hhc-value="hsl"]').textContent = `${round(report.hsl.h, 1)}° / ${round(report.hsl.s, 1)}% / ${round(report.hsl.l, 1)}%`;
      query('[data-hhc-value="lab"]').textContent = `${round(report.lab.l, 2)} / ${round(report.lab.a, 2)} / ${round(report.lab.b, 2)}`;
      query('[data-hhc-value="oklch"]').textContent = `${round(report.oklch.l, 4)} / ${round(report.oklch.c, 4)} / ${round(report.oklch.h, 1)}°`;
      query('[data-hhc-value="cmyk"]').textContent = `${round(cmyk.c, 1)} / ${round(cmyk.m, 1)} / ${round(cmyk.y, 1)} / ${round(cmyk.k, 1)}%`;
      query('[data-hhc-metric="hsl-l"]').textContent = `${round(report.hsl.l, 1)}%`;
      query('[data-hhc-metric="lab-l"]').textContent = round(report.lab.l, 2);
      query('[data-hhc-metric="oklch-c"]').textContent = round(report.oklch.c, 4);
      query('[data-hhc-metric="gamut"]').textContent = report.inSrgbGamut ? "Trong gamut" : "Ngoài gamut";
      query("[data-hhc-gamut-status]").textContent = report.inSrgbGamut ? "sRGB · không clipping" : "Cảnh báo gamut · đã clipping";
    }
    function renderHarmony() {
      query("[data-hhc-harmony-mode]").value = project.harmonyMode;
      const harmony = generateHarmony(project.baseColor, project.harmonyMode);
      query("[data-hhc-harmony]").innerHTML = harmony.map((color) => `<button class="hhc-swatch" type="button" style="--swatch:${color.hex}" data-hhc-use-color="${color.hex}" data-warning="${color.gamutWarning}" aria-label="Dùng màu ${color.hex}${color.gamutWarning ? ", ngoài gamut trước khi map" : ""}"><span>${color.hex}</span><small>OKLCH ${round(color.oklch.h, 1)}°</small></button>`).join("");
      const warnings = harmony.filter((color) => color.gamutWarning).length;
      query("[data-hhc-harmony-note]").textContent = warnings ? `${warnings} màu ngoài sRGB đã giảm chroma để preview; dữ liệu OKLCH gốc vẫn được báo cáo.` : "Tất cả màu harmony nằm trong sRGB gamut.";
    }
    function renderMeshCanvas() {
      const result = drawGradientMesh(query("[data-hhc-mesh-canvas]"), project.mesh, { width: 360, height: 210 });
      query("[data-hhc-mesh-status]").textContent = result.supported ? `${result.pointCount} điểm · nội suy OKLab · ${result.width} × ${result.height}` : result.reason;
    }
    function renderMesh() {
      query("[data-hhc-mesh-points]").innerHTML = project.mesh.points.map((point, index) => `<div class="hhc-mesh-point"><strong>Point ${index + 1}</strong><input type="color" value="${point.color}" data-hhc-mesh-color="${index}" aria-label="Màu point ${index + 1}"><div class="hhc-point-values"><input type="number" min="0" max="1" step="0.01" value="${round(point.x, 2)}" data-hhc-mesh-value="x" data-index="${index}" aria-label="X point ${index + 1}"><input type="number" min="0" max="1" step="0.01" value="${round(point.y, 2)}" data-hhc-mesh-value="y" data-index="${index}" aria-label="Y point ${index + 1}"><input type="number" min="0.1" max="3" step="0.05" value="${round(point.strength, 2)}" data-hhc-mesh-value="strength" data-index="${index}" aria-label="Strength point ${index + 1}"></div></div>`).join("");
      renderMeshCanvas();
    }
    function renderImageCanvases() {
      const source = imageBuffer || fallbackPreview;
      drawPixelBuffer(query("[data-hhc-image-original]"), source);
      drawPixelBuffer(query("[data-hhc-image-processed]"), processPixelBuffer(source, project));
      drawPixelBuffer(query("[data-hhc-lut-canvas]"), processPixelBuffer(source, project));
    }
    function renderPalette() {
      query("[data-hhc-palette-source]").textContent = project.paletteSource;
      query("[data-hhc-palette]").innerHTML = project.palette.map((color) => `<button class="hhc-swatch" type="button" style="--swatch:${color}" data-hhc-use-color="${color}" aria-label="Dùng màu ${color}"><span>${color}</span></button>`).join("");
      renderImageCanvases();
    }
    function renderBrand() {
      query("[data-hhc-brand-name]").value = project.brand.name;
      BRAND_ROLES.forEach((role) => {
        query(`[data-hhc-brand-color="${role.id}"]`).value = project.brand[role.id];
        query(`[data-hhc-brand-hex="${role.id}"]`).value = project.brand[role.id];
      });
      query("[data-hhc-brand-preview]").innerHTML = BRAND_ROLES.map((role) => `<button class="hhc-swatch" type="button" style="--swatch:${project.brand[role.id]}" data-hhc-use-color="${project.brand[role.id]}" aria-label="Dùng ${escapeHtml(role.label)} ${project.brand[role.id]}"><span>${escapeHtml(role.label)}</span><small>${project.brand[role.id]}</small></button>`).join("");
      const body = evaluateContrast(project.brand.text, project.brand.background, 16, false);
      const primary = evaluateContrast(project.brand.primary, project.brand.background, 24, true);
      query("[data-hhc-brand-contrast]").textContent = `Text / Background ${body.ratio}:1 · ${body.label}; Primary / Background ${primary.ratio}:1 · ${primary.label}.`;
    }
    function renderProof() {
      Object.entries(project.contrast).forEach(([key, value]) => {
        const input = query(`[data-hhc-contrast="${key}"]`);
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = value;
      });
      Object.entries(project.proof).forEach(([key, value]) => {
        const input = query(`[data-hhc-proof="${key}"]`);
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = value;
      });
      const result = evaluateContrast(project.contrast.foreground, project.contrast.background, project.contrast.fontSize, project.contrast.bold);
      const preview = query("[data-hhc-contrast-preview]");
      preview.style.color = project.contrast.foreground;
      preview.style.backgroundColor = project.contrast.background;
      preview.querySelector("strong").style.fontSize = `${project.contrast.fontSize}px`;
      preview.querySelector("strong").style.fontWeight = project.contrast.bold ? "700" : "400";
      query('[data-hhc-contrast-result="ratio"]').textContent = `${result.ratio}:1`;
      const aa = query('[data-hhc-contrast-result="aa"]');
      const aaa = query('[data-hhc-contrast-result="aaa"]');
      aa.textContent = result.aa ? "Đạt" : "Chưa đạt";
      aaa.textContent = result.aaa ? "Đạt" : "Chưa đạt";
      aa.className = result.aa ? "hhc-pass" : "hhc-fail";
      aaa.className = result.aaa ? "hhc-pass" : "hhc-fail";
      const proof = softProofRgb(hexToRgb(project.baseColor), project.proof);
      query('[data-hhc-proof-sample="rgb"]').style.setProperty("--proof-color", project.baseColor);
      query('[data-hhc-proof-sample="cmyk"]').style.setProperty("--proof-color", proof.hex);
      renderImageCanvases();
    }
    function renderLut() {
      const lut = project.lut;
      query("[data-hhc-lut-enabled]").checked = project.lutEnabled;
      query('[data-hhc-lut-meta="title"]').textContent = lut.title;
      query('[data-hhc-lut-meta="type"]').textContent = lut.type;
      query('[data-hhc-lut-meta="size"]').textContent = String(lut.size);
      query('[data-hhc-lut-meta="samples"]').textContent = String(lut.data.length);
      query('[data-hhc-lut-meta="domain"]').textContent = `${lut.domainMin.join("/")} → ${lut.domainMax.join("/")}`;
      const rows = [
        ["Canvas 2D", capabilities.canvas2d],
        ["Ảnh local", capabilities.localImage],
        ["Nhập tệp", capabilities.fileImport],
        ["Tải xuống", capabilities.download],
        ["Lưu local", capabilities.localStorage]
      ];
      query("[data-hhc-capabilities]").innerHTML = rows.map(([label, capability]) => `<dt>${escapeHtml(label)}</dt><dd data-supported="${capability.supported}" title="${escapeHtml(capability.reason)}">${capability.supported ? "Sẵn sàng" : "Không hỗ trợ"}</dd>`).join("");
      renderImageCanvases();
    }
    function renderAll() {
      query("[data-hhc-project-name]").value = project.meta.name;
      renderConverter();
      renderHarmony();
      renderMesh();
      renderPalette();
      renderBrand();
      renderProof();
      renderLut();
      setTab(project.activeTab, false);
    }
    function updateBaseColor(value) {
      project.baseColor = normalizeHex(value, project.baseColor);
      renderConverter();
      renderHarmony();
      renderProof();
      persist();
    }

    on(root, "click", (event) => {
      const tab = event.target.closest("[data-hhc-tab]");
      if (tab) { setTab(tab.dataset.hhcTab, false); return; }
      const colorButton = event.target.closest("[data-hhc-use-color]");
      if (colorButton) { updateBaseColor(colorButton.dataset.hhcUseColor); announce(`Đã chọn ${project.baseColor}.`); return; }
      const actionButton = event.target.closest("[data-hhc-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.hhcAction;
      if (action === "import-project") query("[data-hhc-project-file]").click();
      else if (action === "export-project") {
        if (!downloadText("hh-color-pipeline.json", exportProject(project), "application/json;charset=utf-8")) announce(capabilities.download.reason, true);
        else announce("Đã xuất Color Pipeline project.");
      } else if (action === "mesh-harmony") {
        const colors = generateHarmonyHex(project.baseColor, project.harmonyMode);
        project.mesh.points.forEach((point, index) => { point.color = colors[index % colors.length]; });
        renderMesh();
        persist();
        announce("Đã nạp harmony vào gradient mesh.");
      } else if (action === "load-image") query("[data-hhc-image-file]").click();
      else if (action === "palette-brand") {
        BRAND_ROLES.forEach((role, index) => { if (project.palette[index]) project.brand[role.id] = project.palette[index]; });
        renderBrand();
        persist();
        announce("Đã gán palette vào brand colors.");
      } else if (action === "export-brand") {
        if (!downloadText("hh-brand-colors.css", exportBrandCss(project.brand), "text/css;charset=utf-8")) announce(capabilities.download.reason, true);
        else announce("Đã xuất CSS brand tokens.");
      } else if (action === "swap-contrast") {
        const foreground = project.contrast.foreground;
        project.contrast.foreground = project.contrast.background;
        project.contrast.background = foreground;
        renderProof();
        persist();
      } else if (action === "import-lut") query("[data-hhc-lut-file]").click();
      else if (action === "identity-lut") {
        project.lut = createIdentityLut(17);
        project.lutEnabled = true;
        renderLut();
        persist();
        announce("Đã tạo Identity LUT 17³.");
      } else if (action === "export-lut") {
        if (!downloadText("hh-color-grade.cube", exportCubeLut(project.lut, project.lut.title), "text/plain;charset=utf-8")) announce(capabilities.download.reason, true);
        else announce("Đã xuất LUT .cube.");
      }
    });

    on(root, "input", (event) => {
      const target = event.target;
      if (target.matches("[data-hhc-base-color]")) updateBaseColor(target.value);
      else if (target.matches("[data-hhc-project-name]")) { project.meta.name = safeText(target.value, "Professional Color Pipeline", 120); persist(); }
      else if (target.matches("[data-hhc-harmony-mode]")) { project.harmonyMode = target.value; renderHarmony(); persist(); }
      else if (target.matches("[data-hhc-mesh-color]")) {
        const point = project.mesh.points[Number(target.dataset.hhcMeshColor)];
        if (point) { point.color = normalizeHex(target.value, point.color); renderMeshCanvas(); persist(); }
      } else if (target.matches("[data-hhc-mesh-value]")) {
        const point = project.mesh.points[Number(target.dataset.index)];
        const key = target.dataset.hhcMeshValue;
        if (point && ["x", "y", "strength"].includes(key)) {
          point[key] = key === "strength" ? clamp(target.value, 0.1, 3, point[key]) : clamp(target.value, 0, 1, point[key]);
          renderMeshCanvas();
          persist();
        }
      } else if (target.matches("[data-hhc-brand-name]")) { project.brand.name = safeText(target.value, "HH Color System", 120); persist(); }
      else if (target.matches("[data-hhc-brand-color]")) {
        const role = target.dataset.hhcBrandColor;
        project.brand[role] = normalizeHex(target.value, project.brand[role]);
        renderBrand();
        persist();
      } else if (target.matches("[data-hhc-contrast]")) {
        const key = target.dataset.hhcContrast;
        project.contrast[key] = target.type === "checkbox" ? target.checked : key === "fontSize" ? clamp(target.value, 8, 200, 16) : normalizeHex(target.value, project.contrast[key]);
        renderProof();
        persist();
      } else if (target.matches("[data-hhc-proof]")) {
        const key = target.dataset.hhcProof;
        project.proof[key] = target.type === "checkbox" ? target.checked : key === "paper" ? normalizeHex(target.value, project.proof.paper) : key === "inkLimit" ? clamp(target.value, 100, 400, 300) : clamp(target.value, 0, 0.4, 0.14);
        renderProof();
        persist();
      } else if (target.matches("[data-hhc-lut-enabled]")) {
        project.lutEnabled = target.checked;
        renderLut();
        persist();
      }
    });

    on(root, "change", (event) => {
      const target = event.target;
      if (target.matches("[data-hhc-base-hex]")) updateBaseColor(target.value);
      else if (target.matches("[data-hhc-brand-hex]")) {
        const role = target.dataset.hhcBrandHex;
        project.brand[role] = normalizeHex(target.value, project.brand[role]);
        renderBrand();
        persist();
      } else if (target.matches("[data-hhc-project-file]")) {
        const file = target.files && target.files[0];
        if (!file) return;
        readTextFile(file, globalScope, 4 * 1024 * 1024).then((text) => {
          const parsed = JSON.parse(text);
          if (!parsed || parsed.format !== FORMAT) throw new Error("Tệp không phải HH Color Pipeline project.");
          project = normalizeProject(parsed);
          renderAll();
          persist();
          announce("Đã nhập Color Pipeline project.");
        }).catch((error) => announce(error.message || "Không thể nhập project.", true));
        target.value = "";
      } else if (target.matches("[data-hhc-image-file]")) {
        const file = target.files && target.files[0];
        if (!file) return;
        decodeLocalImage(file, globalScope).then((buffer) => {
          imageBuffer = buffer;
          const count = clamp(query("[data-hhc-palette-count]").value, 2, 12, 6);
          project.palette = extractPaletteFromPixels(buffer.data, count);
          project.paletteSource = safeText(buffer.name, "Ảnh local", 160);
          renderPalette();
          renderBrand();
          renderLut();
          persist();
          query("[data-hhc-image-status]").textContent = `${buffer.name} · ${buffer.width} × ${buffer.height} · xử lý local.`;
          announce(`Đã trích ${project.palette.length} màu từ ảnh local.`);
        }).catch((error) => announce(error.message || "Không thể xử lý ảnh.", true));
        target.value = "";
      } else if (target.matches("[data-hhc-lut-file]")) {
        const file = target.files && target.files[0];
        if (!file) return;
        readTextFile(file, globalScope, 6 * 1024 * 1024).then((text) => {
          project.lut = parseCubeLut(text);
          project.lutEnabled = true;
          renderLut();
          persist();
          query("[data-hhc-lut-status]").textContent = `${project.lut.title} · ${project.lut.type} ${project.lut.size} · parser local.`;
          announce("Đã nhập và áp dụng LUT .cube.");
        }).catch((error) => announce(error.message || "LUT .cube không hợp lệ.", true));
        target.value = "";
      }
    });

    on(root, "keydown", (event) => {
      const tab = event.target.closest('[role="tab"][data-hhc-tab]');
      if (tab && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const tabs = queryAll("[data-hhc-tab]");
        const current = tabs.indexOf(tab);
        const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + direction + tabs.length) % tabs.length;
        setTab(tabs[next].dataset.hhcTab, true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        persist();
        announce("Đã lưu project local.");
      }
    });

    renderAll();
    if (!capabilities.localStorage.supported) announce(capabilities.localStorage.reason, true);
    else persist();

    const instanceApi = {
      getProject: () => clone(project),
      setProject: (nextProject) => { project = normalizeProject(nextProject); renderAll(); persist(); return clone(project); },
      getCapabilities: () => clone(capabilities),
      getImageInfo: () => imageBuffer ? { width: imageBuffer.width, height: imageBuffer.height, name: imageBuffer.name } : null,
      setImageData: (imageData, name) => {
        const width = Math.round(Number(imageData && imageData.width));
        const height = Math.round(Number(imageData && imageData.height));
        const data = imageData && imageData.data;
        if (!width || !height || !data || data.length !== width * height * 4) throw new Error("Dữ liệu ảnh không hợp lệ.");
        imageBuffer = { width, height, data: new Uint8ClampedArray(data), name: safeText(name, "Image data", 160) };
        project.palette = extractPaletteFromPixels(imageBuffer.data, 6);
        project.paletteSource = imageBuffer.name;
        renderPalette();
        persist();
        return clone(project.palette);
      },
      exportProject: () => exportProject(project),
      exportCubeLut: () => exportCubeLut(project.lut, project.lut.title),
      applyColor: (color) => applyCubeLut(color, project.lut)
    };
    mounted.set(root, {
      api: instanceApi,
      cleanup: () => {
        disposed = true;
        globalScope.clearTimeout(statusTimer);
        listeners.splice(0).forEach((remove) => remove());
        imageBuffer = null;
      }
    });
    return instanceApi;
  }

  function unmount(root) {
    const instance = mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.classList.remove("hhcolor");
    root.removeAttribute("data-graphic-color-pro");
    root.innerHTML = "";
    return true;
  }

  const api = {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    MAX_CUBE_SIZE,
    SOFT_PROOF_NOTICE,
    CMYK_NOTICE,
    HARMONY_MODES,
    BRAND_ROLES,
    normalizeHex,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    rgbToXyz,
    xyzToRgb,
    xyzToRgbReport,
    xyzToLab,
    labToXyz,
    rgbToLab,
    labToRgb,
    labToRgbReport,
    rgbToOklab,
    oklabToRgb,
    oklabToRgbReport,
    oklabToOklch,
    oklchToOklab,
    rgbToOklch,
    oklchToRgb,
    oklchToRgbReport,
    mapOklchToSrgb,
    deltaE76,
    colorReport,
    generateHarmony,
    generateHarmonyHex,
    createGradientMesh,
    normalizeGradientMesh,
    sampleGradientMesh,
    drawGradientMesh,
    extractPaletteFromPixels,
    relativeLuminance,
    contrastRatio,
    evaluateContrast,
    rgbToCmykApproximation,
    cmykToRgbApproximation,
    rgbToCmyk: rgbToCmykApproximation,
    cmykToRgb: cmykToRgbApproximation,
    softProofRgb,
    softProofPixels,
    normalizeCubeLut,
    parseCubeLut,
    createIdentityLut,
    exportCubeLut,
    applyCubeLut,
    applyLutToPixels,
    buildBrandTokens,
    exportBrandCss,
    createDefaultProject,
    normalizeProject,
    exportProject,
    detectCapabilities,
    createPreviewBuffer,
    processPixelBuffer,
    decodeLocalImage,
    escapeHtml,
    mount,
    unmount
  };

  api.rgbToLAB = rgbToLab;
  api.labToRGB = labToRgb;
  api.rgbToOKLCH = rgbToOklch;
  api.oklchToRGB = oklchToRgb;
  globalScope.HHGraphicColorPro = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
