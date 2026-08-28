(function (globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHDrawStudio = api;
})(typeof window !== "undefined" ? window : globalThis, function createDrawStudio(globalScope) {
  "use strict";

  const VERSION = "2.3.0";
  const STORAGE_SCHEMA = "hh.draw.studio.v1";
  const BRUSH_LIBRARY_SCHEMA = "hh.draw.brush-library.v1";
  const LAYOUT_SCHEMA = "hh.draw.layout.v1";
  const INSPECTOR_SCHEMA = "hh.draw.inspector.v1";
  const DEFAULT_LAYOUT = Object.freeze({ toolrailCollapsed: false, inspectorCollapsed: false, dockCollapsed: false, compactControls: false });
  const INSPECTOR_TABS = Object.freeze(["tool", "object", "layer", "document"]);
  const INSPECTOR_GROUPS = Object.freeze({
    tool: Object.freeze(["tool-core", "tool-pattern", "tool-dynamics"]),
    object: Object.freeze(["object-transform"]),
    layer: Object.freeze(["layer-studio"]),
    document: Object.freeze(["document-canvas", "document-animation", "document-media", "document-export"])
  });
  const DEFAULT_INSPECTOR_STATE = Object.freeze({
    activeTab: "tool",
    openGroups: Object.freeze({ tool: "tool-core", object: "object-transform", layer: "layer-studio", document: "document-canvas" }),
    pinnedGroups: Object.freeze([]),
    closeLibraryAfterSelect: false
  });
  const MAX_STROKES = 120;
  const MAX_POINTS_PER_STROKE = 1400;
  const MAX_LAYERS = 16;
  const MAX_HISTORY = 48;
  const LAYER_BLEND_MODES = Object.freeze(["source-over", "screen", "lighten", "overlay", "color-dodge", "soft-light", "multiply"]);
  const LAYER_TYPES = Object.freeze(["stroke", "particle", "effect", "background"]);
  const PATTERN_GENERATORS = Object.freeze({
    rosette: Object.freeze({ label: "Hoa hồng cực quang", icon: "❉", description: "Đường cong rose nhiều cánh" }),
    spirograph: Object.freeze({ label: "Quỹ đạo Spiro", icon: "◎", description: "Hypotrochoid theo seed" }),
    aurora: Object.freeze({ label: "Sóng cực quang", icon: "≈", description: "Dải sóng giao thoa mềm" }),
    constellation: Object.freeze({ label: "Chòm sao", icon: "✦", description: "Mạng sao có thể tái tạo" }),
    portal: Object.freeze({ label: "Cổng thiên hà", icon: "◌", description: "Nhiều vòng quỹ đạo lệch pha" }),
    starburst: Object.freeze({ label: "Bùng nổ ánh sáng", icon: "✺", description: "Tia sáng hướng tâm" })
  });
  const CANVAS_PRESETS = Object.freeze({ viewport: { label: "Theo khung vẽ", width: 0, height: 0 }, instagram: { label: "Instagram 1:1", width: 1080, height: 1080 }, story: { label: "Story / TikTok 9:16", width: 1080, height: 1920 }, youtube: { label: "YouTube 16:9", width: 1920, height: 1080 }, wallpaper: { label: "Wallpaper 4K", width: 3840, height: 2160 }, custom: { label: "Tùy chỉnh", width: 1920, height: 1080 } });
  const PALETTE = ["#ff4fa3", "#ff7b47", "#ffd84e", "#63efb0", "#45d9ff", "#7581ff", "#bd65ff", "#f4f2ff"];
  const COLOR_PALETTES = Object.freeze({
    cosmic: Object.freeze({ label: "Cosmic", stops: Object.freeze(["#34e7ff", "#7b61ff", "#ff4fb8", "#ffd86b"]) }),
    aurora: Object.freeze({ label: "Aurora", stops: Object.freeze(["#43ffd4", "#39a8ff", "#9b5cff", "#ff72c6"]) }),
    prism: Object.freeze({ label: "Prism", stops: Object.freeze(["#ff4f87", "#ffbe3f", "#55f29a", "#42d9ff", "#916cff"]) }),
    fire: Object.freeze({ label: "Solar Fire", stops: Object.freeze(["#ff2d55", "#ff7138", "#ffd84d", "#fff3c4"]) }),
    ocean: Object.freeze({ label: "Deep Ocean", stops: Object.freeze(["#48f4ff", "#1597ff", "#4058ff", "#8d5dff"]) }),
    candy: Object.freeze({ label: "Candy", stops: Object.freeze(["#ff5fb7", "#ff91e0", "#8b7cff", "#52e7ff"]) }),
    emerald: Object.freeze({ label: "Emerald", stops: Object.freeze(["#c7ff6b", "#42f5a7", "#19d7d1", "#4f83ff"]) }),
    mono: Object.freeze({ label: "Moon Ink", stops: Object.freeze(["#6c7692", "#d4dcf3", "#ffffff"]) }),
    custom: Object.freeze({ label: "Tùy chỉnh", stops: Object.freeze([]) })
  });
  const PRESETS = Object.freeze({
    silk: { label: "Silk Light", icon: "∞", brushMode: "silk", paletteId: "cosmic", symmetry: 6, mirror: true, spiral: false, brushSize: 1.35, glow: 22, flow: 0.7, colorA: "#45d9ff", colorB: "#bd65ff", autoHue: false },
    mandala: { label: "Lotus Mandala", icon: "✺", brushMode: "lotus", paletteId: "candy", symmetry: 12, mirror: true, spiral: false, brushSize: 1.05, glow: 18, flow: 0.62, colorA: "#ff4fa3", colorB: "#ffd84e", autoHue: false },
    kaleidoscope: { label: "Kaleidoscope", icon: "◇", brushMode: "prism", paletteId: "prism", symmetry: 8, mirror: true, spiral: true, brushSize: 1.55, glow: 24, flow: 0.76, colorA: "#63efb0", colorB: "#7581ff", autoHue: false },
    aurora: { label: "Aurora Flow", icon: "≈", brushMode: "aurora", paletteId: "aurora", symmetry: 4, mirror: true, spiral: true, brushSize: 2.8, glow: 32, flow: 0.5, colorA: "#4fffd1", colorB: "#a968ff", autoHue: false },
    neon: { label: "Neon Ribbon", icon: "⌁", brushMode: "neon", paletteId: "candy", symmetry: 2, mirror: true, spiral: false, brushSize: 4.2, glow: 36, flow: 0.42, colorA: "#ff4fa3", colorB: "#45d9ff", autoHue: false },
    plasma: { label: "Plasma Bloom", icon: "✹", brushMode: "plasma", paletteId: "cosmic", symmetry: 5, mirror: true, spiral: true, brushSize: 3.4, glow: 40, flow: 0.58, colorA: "#48eaff", colorB: "#ff4fb8", autoHue: false },
    electric: { label: "Electric Arc", icon: "ϟ", brushMode: "electric", paletteId: "ocean", symmetry: 3, mirror: true, spiral: false, brushSize: 1.3, glow: 34, flow: 0.86, colorA: "#65f5ff", colorB: "#7b6cff", autoHue: false },
    nebula: { label: "Nebula Smoke", icon: "☁", brushMode: "nebula", paletteId: "cosmic", symmetry: 4, mirror: true, spiral: true, brushSize: 5.8, glow: 44, flow: 0.28, colorA: "#735dff", colorB: "#ff5ebd", autoHue: false },
    prism: { label: "Crystal Prism", icon: "◈", brushMode: "prism", paletteId: "prism", symmetry: 7, mirror: true, spiral: false, brushSize: 2.1, glow: 26, flow: 0.72, colorA: "#56f5ff", colorB: "#ff5eae", autoHue: false },
    fire: { label: "Fire Trail", icon: "♨", brushMode: "fire", paletteId: "fire", symmetry: 3, mirror: true, spiral: false, brushSize: 4.6, glow: 38, flow: 0.66, colorA: "#ff4c2f", colorB: "#ffd84d", autoHue: false },
    galaxy: { label: "Galaxy Dust", icon: "✦", brushMode: "galaxy", paletteId: "cosmic", symmetry: 6, mirror: true, spiral: true, brushSize: 2.4, glow: 30, flow: 0.64, colorA: "#48eaff", colorB: "#bd65ff", autoHue: false },
    comet: { label: "Comet Tail", icon: "☄", brushMode: "comet", paletteId: "ocean", symmetry: 2, mirror: true, spiral: false, brushSize: 5.2, glow: 42, flow: 0.55, colorA: "#f6ffff", colorB: "#45d9ff", autoHue: false },
    ripple: { label: "Water Ripple", icon: "≋", brushMode: "ripple", paletteId: "ocean", symmetry: 4, mirror: true, spiral: false, brushSize: 2.2, glow: 20, flow: 0.45, colorA: "#46edff", colorB: "#5475ff", autoHue: false },
    quantum: { label: "Quantum Threads", icon: "⌬", brushMode: "quantum", paletteId: "emerald", symmetry: 8, mirror: true, spiral: true, brushSize: 0.8, glow: 24, flow: 0.82, colorA: "#50f4c8", colorB: "#6b70ff", autoHue: false },
    rainbow: { label: "Rainbow Ribbon", icon: "◒", brushMode: "rainbow", paletteId: "prism", symmetry: 3, mirror: true, spiral: false, brushSize: 5.6, glow: 30, flow: 0.62, colorA: "#ff4f87", colorB: "#42d9ff", autoHue: false },
    ink: { label: "Moon Ink", icon: "◐", brushMode: "ink", paletteId: "mono", symmetry: 2, mirror: false, spiral: false, brushSize: 3.8, glow: 8, flow: 0.76, colorA: "#d4dcf3", colorB: "#ffffff", autoHue: false },
    starfield: { label: "Starfield", icon: "✧", category: "particle", brushMode: "starfield", paletteId: "cosmic", symmetry: 5, mirror: true, spiral: false, brushSize: 1.2, glow: 28, flow: 0.7 },
    fireworks: { label: "Fireworks", icon: "✺", category: "particle", brushMode: "fireworks", paletteId: "prism", symmetry: 6, mirror: false, spiral: false, brushSize: 1.4, glow: 34, flow: 0.68 },
    sparkFountain: { label: "Spark Fountain", icon: "⋰", category: "particle", brushMode: "spark", paletteId: "fire", symmetry: 3, mirror: true, spiral: false, brushSize: 1.5, glow: 32, flow: 0.72 },
    bokeh: { label: "Bokeh Dream", icon: "◌", category: "particle", brushMode: "bokeh", paletteId: "candy", symmetry: 3, mirror: true, spiral: false, brushSize: 4.2, glow: 24, flow: 0.38 },
    meteor: { label: "Meteor Shower", icon: "☄", category: "particle", brushMode: "meteor", paletteId: "ocean", symmetry: 4, mirror: true, spiral: false, brushSize: 3.5, glow: 38, flow: 0.6 },
    fluidInk: { label: "Fluid Ink", icon: "≋", category: "physics", brushMode: "fluid", paletteId: "aurora", symmetry: 2, mirror: true, spiral: false, brushSize: 5.2, glow: 22, flow: 0.38 },
    magnetic: { label: "Magnetic Field", icon: "⊂", category: "physics", brushMode: "magnetic", paletteId: "emerald", symmetry: 6, mirror: true, spiral: false, brushSize: 1.1, glow: 24, flow: 0.72 },
    gravity: { label: "Gravity Orbit", icon: "◎", category: "physics", brushMode: "gravity", paletteId: "cosmic", symmetry: 5, mirror: true, spiral: true, brushSize: 1.5, glow: 30, flow: 0.64 },
    turbulence: { label: "Turbulence Smoke", icon: "∿", category: "physics", brushMode: "turbulence", paletteId: "cosmic", symmetry: 3, mirror: true, spiral: true, brushSize: 5.5, glow: 36, flow: 0.28 },
    liquidPlasma: { label: "Liquid Plasma", icon: "◍", category: "physics", brushMode: "liquid-plasma", paletteId: "candy", symmetry: 4, mirror: true, spiral: true, brushSize: 4.8, glow: 42, flow: 0.48 },
    spirograph: { label: "Spirograph", icon: "❉", category: "geometry", brushMode: "spirograph", paletteId: "prism", symmetry: 10, mirror: false, spiral: true, brushSize: 1, glow: 20, flow: 0.78 },
    harmonograph: { label: "Harmonograph", icon: "∿", category: "geometry", brushMode: "harmonograph", paletteId: "aurora", symmetry: 4, mirror: true, spiral: false, brushSize: 1.2, glow: 22, flow: 0.74 },
    lissajous: { label: "Lissajous", icon: "∞", category: "geometry", brushMode: "lissajous", paletteId: "ocean", symmetry: 3, mirror: true, spiral: false, brushSize: 1.3, glow: 24, flow: 0.7 },
    flowerLife: { label: "Flower of Life", icon: "❀", category: "geometry", brushMode: "flower-life", paletteId: "candy", symmetry: 12, mirror: false, spiral: false, brushSize: 1, glow: 22, flow: 0.68 },
    voronoi: { label: "Voronoi Crystal", icon: "⬡", category: "geometry", brushMode: "voronoi", paletteId: "prism", symmetry: 6, mirror: true, spiral: false, brushSize: 1.5, glow: 18, flow: 0.66 },
    jellyfish: { label: "Jellyfish Glow", icon: "♨", category: "nature", brushMode: "jellyfish", paletteId: "ocean", symmetry: 3, mirror: true, spiral: false, brushSize: 3.2, glow: 34, flow: 0.46 },
    coral: { label: "Coral Growth", icon: "Y", category: "nature", brushMode: "coral", paletteId: "candy", symmetry: 5, mirror: true, spiral: false, brushSize: 1.8, glow: 24, flow: 0.62 },
    vine: { label: "Vine Bloom", icon: "❧", category: "nature", brushMode: "vine", paletteId: "emerald", symmetry: 4, mirror: true, spiral: false, brushSize: 2, glow: 22, flow: 0.58 },
    feather: { label: "Feather Light", icon: "⌁", category: "nature", brushMode: "feather", paletteId: "aurora", symmetry: 2, mirror: true, spiral: false, brushSize: 2.2, glow: 20, flow: 0.55 },
    butterfly: { label: "Butterfly Trail", icon: "Ƹ", category: "nature", brushMode: "butterfly", paletteId: "candy", symmetry: 6, mirror: true, spiral: false, brushSize: 1.7, glow: 28, flow: 0.66 },
    calligraphy: { label: "Neon Calligraphy", icon: "𝒜", category: "art", brushMode: "calligraphy", paletteId: "candy", symmetry: 1, mirror: false, spiral: false, brushSize: 5, glow: 30, flow: 0.72 },
    dryInk: { label: "Dry Ink", icon: "≀", category: "art", brushMode: "dry-ink", paletteId: "mono", symmetry: 1, mirror: false, spiral: false, brushSize: 4.2, glow: 4, flow: 0.64 },
    watercolor: { label: "Watercolor Bloom", icon: "❋", category: "art", brushMode: "watercolor", paletteId: "aurora", symmetry: 2, mirror: true, spiral: false, brushSize: 7, glow: 10, flow: 0.26 },
    oilRibbon: { label: "Oil Ribbon", icon: "▰", category: "art", brushMode: "oil", paletteId: "fire", symmetry: 2, mirror: true, spiral: false, brushSize: 6.5, glow: 12, flow: 0.7 },
    chalk: { label: "Chalk Galaxy", icon: "⋯", category: "art", brushMode: "chalk", paletteId: "mono", symmetry: 4, mirror: true, spiral: false, brushSize: 4, glow: 12, flow: 0.52 },
    pixelNeon: { label: "Pixel Neon", icon: "▦", category: "digital", brushMode: "pixel", paletteId: "prism", symmetry: 4, mirror: true, spiral: false, brushSize: 3, glow: 20, flow: 0.8 },
    glitchTrail: { label: "Glitch Trail", icon: "⌁", category: "digital", brushMode: "glitch", paletteId: "prism", symmetry: 2, mirror: true, spiral: false, brushSize: 3.5, glow: 22, flow: 0.7 },
    hologram: { label: "Hologram Scan", icon: "▤", category: "digital", brushMode: "hologram", paletteId: "ocean", symmetry: 4, mirror: true, spiral: false, brushSize: 2.2, glow: 30, flow: 0.58 },
    laser: { label: "Laser Grid", icon: "╳", category: "digital", brushMode: "laser", paletteId: "emerald", symmetry: 8, mirror: true, spiral: false, brushSize: 1.1, glow: 38, flow: 0.82 },
    chromatic: { label: "Chromatic Split", icon: "RGB", category: "digital", brushMode: "chromatic", paletteId: "prism", symmetry: 3, mirror: true, spiral: false, brushSize: 3.8, glow: 24, flow: 0.7 }
  });

  const BRUSH_MODES = Object.freeze([...new Set(Object.values(PRESETS).map((preset) => preset.brushMode))]);

  const DEFAULT_SETTINGS = Object.freeze({
    preset: "silk",
    brushMode: "silk",
    paletteId: "cosmic",
    symmetry: 6,
    mirror: true,
    spiral: false,
    spiralCopies: 3,
    brushSize: 1.35,
    glow: 22,
    flow: 0.7,
    stabilizer: 42,
    pressureEnabled: true,
    pressureCurve: 1,
    velocityWidth: 0.35,
    velocityGlow: 0.2,
    taperStart: 0.12,
    taperEnd: 0.08,
    spacing: 1.2,
    scatter: 0,
    rotation: 0,
    noise: 0.08,
    curvature: 0.35,
    elasticity: 0.25,
    inertia: 0.18,
    stylusEraser: true,
    grid: false,
    snapCenter: true,
    touchDraw: true,
    patternSeed: "HH-NEBULA",
    patternComplexity: 7,
    patternScale: 0.78,
    quality: "auto",
    colorA: "#45d9ff",
    colorB: "#bd65ff",
    customStops: Object.freeze(["#45d9ff", "#7581ff", "#bd65ff"]),
    gradientFlow: "length",
    paletteSeed: "HH-COSMIC",
    autoHue: false,
    guides: true,
    background: "cosmic",
    canvasPreset: "viewport",
    canvasWidth: 1920,
    canvasHeight: 1080,
    exportScale: 2,
    exportFormat: "png"
  });

  const QUALITY_PROFILES = Object.freeze({
    quality: Object.freeze({ id: "quality", fibers: 5, linkOffsets: [5, 10, 15, 20], blur: 1, particles: 3, detail: 1 }),
    balanced: Object.freeze({ id: "balanced", fibers: 3, linkOffsets: [7, 14], blur: 0.72, particles: 2, detail: 0.72 }),
    performance: Object.freeze({ id: "performance", fibers: 1, linkOffsets: [12], blur: 0.4, particles: 1, detail: 0.4 })
  });

  let runtime = null;
  let databasePromise = null;
  const transformCache = new Map();
  const colorCache = new Map();

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function isHex(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function normalizeHex(value, fallback) {
    return isHex(value) ? String(value).toLowerCase() : fallback;
  }

  function hexToRgb(hex) {
    const safe = normalizeHex(hex, "#ffffff").slice(1);
    return [Number.parseInt(safe.slice(0, 2), 16), Number.parseInt(safe.slice(2, 4), 16), Number.parseInt(safe.slice(4, 6), 16)];
  }

  function mixHex(first, second, amount = 0.5) {
    const a = hexToRgb(first);
    const b = hexToRgb(second);
    const t = clamp(amount, 0, 1, 0.5);
    return `#${a.map((value, index) => Math.round(value + (b[index] - value) * t).toString(16).padStart(2, "0")).join("")}`;
  }

  function rgbToHsl([red, green, blue]) {
    const r = red / 255; const g = green / 255; const b = blue / 255; const max = Math.max(r, g, b); const min = Math.min(r, g, b); const light = (max + min) / 2;
    if (max === min) return [0, 0, light];
    const delta = max - min; const saturation = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue /= 6; return [hue * 360, saturation, light];
  }

  function hslToHex(hue, saturation, light) {
    const h = ((hue % 360) + 360) % 360 / 360;
    const channel = (p, q, input) => { let t = input; if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    if (!saturation) { const value = Math.round(light * 255).toString(16).padStart(2, "0"); return `#${value}${value}${value}`; }
    const q = light < 0.5 ? light * (1 + saturation) : light + saturation - light * saturation; const p = 2 * light - q;
    return `#${[channel(p, q, h + 1 / 3), channel(p, q, h), channel(p, q, h - 1 / 3)].map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
  }

  function seedNumber(value) {
    let hash = 2166136261;
    for (const character of String(value || "HH")) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function harmonyColors(base, type, seed = "HH") {
    const [hue, saturation, light] = rgbToHsl(hexToRgb(base));
    const offsets = type === "complementary" ? [0, 180, 30, 210] : type === "analogous" ? [-45, -20, 0, 25, 50] : type === "triadic" ? [0, 120, 240, 60] : Array.from({ length: 5 }, (_, index) => (seedNumber(seed) * (index + 3) * 0.0000137 * 360) % 360 - hue);
    return offsets.map((offset, index) => hslToHex(hue + offset, clamp(saturation + (index % 2 ? 0.08 : -0.03), 0.35, 1, saturation), clamp(light + (index % 3 - 1) * 0.08, 0.3, 0.78, light)));
  }

  function contrastRatio(first, second = "#05091b") {
    const luminance = (hex) => { const values = hexToRgb(hex).map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; };
    const a = luminance(first); const b = luminance(second); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function seededRandom(seed = "HH") {
    let state = seedNumber(seed) || 0x9e3779b9;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function generatePatternStrokes(type, inputSettings = DEFAULT_SETTINGS) {
    if (!Object.hasOwn(PATTERN_GENERATORS, type)) return [];
    const settings = normalizeSettings(inputSettings);
    const random = seededRandom(`${settings.patternSeed}:${type}`);
    const complexity = settings.patternComplexity;
    const radius = settings.patternScale * 0.46;
    const strokeSettings = normalizeSettings({ ...settings, symmetry: 1, mirror: false, spiral: false });
    const makeStroke = (points, index = 0) => normalizeStroke({
      id: `generated-${type}-${seedNumber(settings.patternSeed)}-${index}`,
      settings: strokeSettings,
      points: points.map((point, pointIndex) => ({ ...point, pressure: point.pressure ?? 0.62, time: pointIndex * 8, pointerType: "mouse" })),
      complete: true,
      createdAt: seedNumber(`${settings.patternSeed}:${type}`) + index
    }, index);
    const strokes = [];
    if (type === "rosette") {
      const petals = complexity + (complexity % 2);
      strokes.push(makeStroke(Array.from({ length: 360 }, (_, index) => {
        const angle = index / 359 * Math.PI * 2;
        const wave = Math.cos(petals * angle) * radius;
        return { x: 0.5 + Math.cos(angle) * wave, y: 0.5 + Math.sin(angle) * wave, pressure: 0.48 + Math.abs(wave / radius) * 0.44 };
      })));
    } else if (type === "spirograph") {
      const outer = 7 + complexity;
      const inner = 2 + Math.floor(random() * Math.max(2, complexity / 2));
      const distance = inner * (0.72 + random() * 0.9);
      const normalizer = Math.max(1, outer - inner + distance);
      strokes.push(makeStroke(Array.from({ length: 520 }, (_, index) => {
        const angle = index / 519 * Math.PI * 2 * Math.max(2, inner);
        const x = (outer - inner) * Math.cos(angle) + distance * Math.cos((outer - inner) / inner * angle);
        const y = (outer - inner) * Math.sin(angle) - distance * Math.sin((outer - inner) / inner * angle);
        return { x: 0.5 + x / normalizer * radius, y: 0.5 + y / normalizer * radius, pressure: 0.58 + 0.25 * Math.sin(angle * 0.5) };
      })));
    } else if (type === "aurora") {
      const bands = Math.min(8, Math.max(3, Math.round(complexity / 2)));
      for (let band = 0; band < bands; band += 1) {
        const phase = random() * Math.PI * 2;
        const frequency = 1.2 + random() * 2.2;
        strokes.push(makeStroke(Array.from({ length: 220 }, (_, index) => {
          const progress = index / 219;
          const x = 0.5 + (progress - 0.5) * radius * 1.9;
          const ribbon = Math.sin(progress * Math.PI * 2 * frequency + phase) * radius * 0.2 + Math.sin(progress * Math.PI * 7 + phase) * radius * 0.045;
          return { x, y: 0.5 + ribbon + (band - (bands - 1) / 2) * radius * 0.075, pressure: 0.38 + 0.5 * Math.sin(progress * Math.PI) };
        }), band));
      }
    } else if (type === "constellation") {
      const count = Math.min(44, 10 + complexity * 2);
      const points = Array.from({ length: count }, () => ({ x: 0.5 + (random() - 0.5) * radius * 1.8, y: 0.5 + (random() - 0.5) * radius * 1.8, pressure: 0.35 + random() * 0.65 }));
      points.sort((a, b) => Math.atan2(a.y - 0.5, a.x - 0.5) - Math.atan2(b.y - 0.5, b.x - 0.5));
      strokes.push(makeStroke(points));
      points.filter((_, index) => index % 3 === 0).slice(0, 10).forEach((point, index) => {
        const starRadius = 0.008 + random() * 0.012;
        strokes.push(makeStroke(Array.from({ length: 17 }, (_, starIndex) => { const angle = starIndex / 16 * Math.PI * 2; return { x: point.x + Math.cos(angle) * starRadius, y: point.y + Math.sin(angle) * starRadius, pressure: 0.72 }; }), index + 1));
      });
    } else if (type === "portal") {
      const rings = Math.min(12, Math.max(4, complexity));
      for (let ring = 0; ring < rings; ring += 1) {
        const ringRadius = radius * (0.22 + ring / rings * 0.78);
        const squash = 0.55 + random() * 0.3;
        const phase = random() * Math.PI;
        strokes.push(makeStroke(Array.from({ length: 150 }, (_, index) => { const angle = index / 149 * Math.PI * 2; return { x: 0.5 + Math.cos(angle + phase) * ringRadius, y: 0.5 + Math.sin(angle + phase) * ringRadius * squash, pressure: 0.4 + ring / rings * 0.42 }; }), ring));
      }
    } else if (type === "starburst") {
      const rays = Math.min(28, Math.max(8, complexity * 2));
      for (let ray = 0; ray < rays; ray += 1) {
        const angle = ray / rays * Math.PI * 2 + (random() - 0.5) * 0.08;
        const endRadius = radius * (0.58 + random() * 0.42);
        strokes.push(makeStroke(Array.from({ length: 28 }, (_, index) => { const progress = index / 27; const eased = progress * progress; return { x: 0.5 + Math.cos(angle) * endRadius * eased, y: 0.5 + Math.sin(angle) * endRadius * eased, pressure: 0.95 - progress * 0.62 }; }), ray));
      }
    }
    return strokes.slice(0, MAX_STROKES);
  }

  function normalizeSettings(input = {}) {
    const preset = Object.hasOwn(PRESETS, input.preset) ? input.preset : DEFAULT_SETTINGS.preset;
    return {
      preset,
      brushMode: BRUSH_MODES.includes(input.brushMode) ? input.brushMode : (PRESETS[preset]?.brushMode || DEFAULT_SETTINGS.brushMode),
      paletteId: Object.hasOwn(COLOR_PALETTES, input.paletteId) ? input.paletteId : (PRESETS[preset]?.paletteId || DEFAULT_SETTINGS.paletteId),
      symmetry: Math.round(clamp(input.symmetry, 1, 12, DEFAULT_SETTINGS.symmetry)),
      mirror: input.mirror !== false,
      spiral: Boolean(input.spiral),
      spiralCopies: Math.round(clamp(input.spiralCopies, 2, 5, DEFAULT_SETTINGS.spiralCopies)),
      brushSize: clamp(input.brushSize, 0.5, 8, DEFAULT_SETTINGS.brushSize),
      glow: clamp(input.glow, 0, 48, DEFAULT_SETTINGS.glow),
      flow: clamp(input.flow, 0.15, 1, DEFAULT_SETTINGS.flow),
      stabilizer: clamp(input.stabilizer, 0, 95, DEFAULT_SETTINGS.stabilizer),
      pressureEnabled: input.pressureEnabled !== false,
      pressureCurve: clamp(input.pressureCurve, 0.35, 3, DEFAULT_SETTINGS.pressureCurve),
      velocityWidth: clamp(input.velocityWidth, 0, 1, DEFAULT_SETTINGS.velocityWidth),
      velocityGlow: clamp(input.velocityGlow, 0, 1, DEFAULT_SETTINGS.velocityGlow),
      taperStart: clamp(input.taperStart, 0, 0.5, DEFAULT_SETTINGS.taperStart),
      taperEnd: clamp(input.taperEnd, 0, 0.5, DEFAULT_SETTINGS.taperEnd),
      spacing: clamp(input.spacing, 0.6, 16, DEFAULT_SETTINGS.spacing),
      scatter: clamp(input.scatter, 0, 24, DEFAULT_SETTINGS.scatter),
      rotation: clamp(input.rotation, 0, 360, DEFAULT_SETTINGS.rotation),
      noise: clamp(input.noise, 0, 1, DEFAULT_SETTINGS.noise),
      curvature: clamp(input.curvature, 0, 1, DEFAULT_SETTINGS.curvature),
      elasticity: clamp(input.elasticity, 0, 1, DEFAULT_SETTINGS.elasticity),
      inertia: clamp(input.inertia, 0, 1, DEFAULT_SETTINGS.inertia),
      stylusEraser: input.stylusEraser !== false,
      grid: Boolean(input.grid),
      snapCenter: input.snapCenter !== false,
      touchDraw: input.touchDraw !== false,
      patternSeed: String(input.patternSeed || DEFAULT_SETTINGS.patternSeed).replace(/[<>]/g, "").slice(0, 48) || DEFAULT_SETTINGS.patternSeed,
      patternComplexity: Math.round(clamp(input.patternComplexity, 3, 16, DEFAULT_SETTINGS.patternComplexity)),
      patternScale: clamp(input.patternScale, 0.3, 0.95, DEFAULT_SETTINGS.patternScale),
      quality: ["auto", "quality", "balanced", "performance"].includes(input.quality) ? input.quality : DEFAULT_SETTINGS.quality,
      colorA: normalizeHex(input.colorA, DEFAULT_SETTINGS.colorA),
      colorB: normalizeHex(input.colorB, DEFAULT_SETTINGS.colorB),
      customStops: Array.isArray(input.customStops) && input.customStops.length >= 2 ? input.customStops.slice(0, 8).map((color, index) => normalizeHex(color, index ? DEFAULT_SETTINGS.colorB : DEFAULT_SETTINGS.colorA)) : [...DEFAULT_SETTINGS.customStops],
      gradientFlow: ["length", "speed", "pressure"].includes(input.gradientFlow) ? input.gradientFlow : DEFAULT_SETTINGS.gradientFlow,
      paletteSeed: String(input.paletteSeed || DEFAULT_SETTINGS.paletteSeed).slice(0, 40),
      autoHue: Boolean(input.autoHue),
      guides: input.guides !== false,
      background: ["cosmic", "black", "midnight", "transparent"].includes(input.background) ? input.background : DEFAULT_SETTINGS.background,
      canvasPreset: Object.hasOwn(CANVAS_PRESETS, input.canvasPreset) ? input.canvasPreset : DEFAULT_SETTINGS.canvasPreset,
      canvasWidth: Math.round(clamp(input.canvasWidth, 320, 7680, DEFAULT_SETTINGS.canvasWidth)),
      canvasHeight: Math.round(clamp(input.canvasHeight, 320, 7680, DEFAULT_SETTINGS.canvasHeight)),
      exportScale: Math.round(clamp(input.exportScale, 1, 4, DEFAULT_SETTINGS.exportScale)),
      exportFormat: ["png", "webp", "jpeg"].includes(input.exportFormat) ? input.exportFormat : DEFAULT_SETTINGS.exportFormat
    };
  }

  function resolveQualityProfile(mode = "auto", capabilities = {}) {
    if (QUALITY_PROFILES[mode]) return QUALITY_PROFILES[mode];
    const memory = Number(capabilities.deviceMemory);
    const cores = Number(capabilities.hardwareConcurrency);
    if ((Number.isFinite(memory) && memory <= 4) || (Number.isFinite(cores) && cores <= 4)) return QUALITY_PROFILES.performance;
    return QUALITY_PROFILES.balanced;
  }

  function transformKey(settings) {
    return `${settings.symmetry}|${settings.mirror ? 1 : 0}|${settings.spiral ? settings.spiralCopies : 1}`;
  }

  function transformsForSettings(settings) {
    const key = transformKey(settings);
    if (transformCache.has(key)) return transformCache.get(key);
    const transforms = [];
    const spiralCount = settings.spiral ? settings.spiralCopies : 1;
    for (let spiralIndex = 0; spiralIndex < spiralCount; spiralIndex += 1) {
      const scale = spiralIndex ? Math.pow(0.76, spiralIndex) : 1;
      const spiralAngle = spiralIndex ? spiralIndex * 0.16 : 0;
      for (let index = 0; index < settings.symmetry; index += 1) {
        const angle = (Math.PI * 2 * index) / settings.symmetry + spiralAngle;
        const cos = Math.cos(angle) * scale;
        const sin = Math.sin(angle) * scale;
        transforms.push({ a: cos, b: -sin, c: sin, d: cos, mirrored: false, rotation: index, spiral: spiralIndex });
        if (settings.mirror) transforms.push({ a: -cos, b: -sin, c: -sin, d: cos, mirrored: true, rotation: index, spiral: spiralIndex });
      }
    }
    transformCache.set(key, transforms);
    return transforms;
  }

  function transformPoint(point, transform) {
    const dx = point.x - 0.5;
    const dy = point.y - 0.5;
    return { x: 0.5 + dx * transform.a + dy * transform.b, y: 0.5 + dx * transform.c + dy * transform.d };
  }

  function normalizePoint(point) {
    return {
      x: clamp(point?.x, 0, 1, 0.5),
      y: clamp(point?.y, 0, 1, 0.5),
      pressure: clamp(point?.pressure, 0.05, 1, 0.5),
      time: Math.max(0, Number(point?.time) || 0),
      tiltX: clamp(point?.tiltX, -90, 90, 0),
      tiltY: clamp(point?.tiltY, -90, 90, 0),
      twist: clamp(point?.twist, 0, 359, 0),
      pointerType: ["mouse", "pen", "touch"].includes(point?.pointerType) ? point.pointerType : "mouse"
    };
  }

  function normalizeStroke(stroke, index = 0) {
    const points = Array.isArray(stroke?.points) ? stroke.points.slice(-MAX_POINTS_PER_STROKE).map(normalizePoint) : [];
    return {
      id: String(stroke?.id || `stroke-${index}`),
      settings: normalizeSettings(stroke?.settings || {}),
      points,
      complete: stroke?.complete !== false,
      erase: Boolean(stroke?.erase),
      createdAt: Math.max(0, Number(stroke?.createdAt) || index)
    };
  }

  function normalizeLayer(layer, index = 0, depth = 0) {
    const id = String(layer?.id || `layer-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || `layer-${index + 1}`;
    const children = depth < 3 && Array.isArray(layer?.children)
      ? layer.children.slice(0, MAX_LAYERS).map((child, childIndex) => normalizeLayer(child, childIndex, depth + 1))
      : [];
    return {
      id,
      name: String(layer?.name || `Layer ${index + 1}`).slice(0, 80),
      type: LAYER_TYPES.includes(layer?.type) ? layer.type : "stroke",
      visible: layer?.visible !== false,
      locked: Boolean(layer?.locked),
      opacity: clamp(layer?.opacity, 0, 1, 1),
      blendMode: LAYER_BLEND_MODES.includes(layer?.blendMode) ? layer.blendMode : "source-over",
      mask: Array.isArray(layer?.mask) ? layer.mask.slice(0, 240).map((point) => ({ x: clamp(point?.x, 0, 1, 0), y: clamp(point?.y, 0, 1, 0) })) : [],
      strokes: Array.isArray(layer?.strokes) ? layer.strokes.slice(-MAX_STROKES).map(normalizeStroke).filter((stroke) => stroke.points.length) : [],
      children,
      revision: Math.max(0, Math.round(Number(layer?.revision) || 0))
    };
  }

  function normalizeView(view = {}) {
    return {
      zoom: clamp(view.zoom, 0.25, 8, 1),
      panX: clamp(view.panX, -4, 4, 0),
      panY: clamp(view.panY, -4, 4, 0),
      rotation: clamp(view.rotation, -180, 180, 0)
    };
  }

  function normalizeAnimation(animation = {}) {
    const keyframes = Array.isArray(animation.keyframes) ? animation.keyframes.slice(0, 32).map((frame, index) => ({ id: String(frame?.id || `keyframe-${index}`), progress: clamp(frame?.progress, 0, 1, index ? 1 : 0), colorA: normalizeHex(frame?.colorA, DEFAULT_SETTINGS.colorA), colorB: normalizeHex(frame?.colorB, DEFAULT_SETTINGS.colorB), glow: clamp(frame?.glow, 0, 48, DEFAULT_SETTINGS.glow), symmetry: Math.round(clamp(frame?.symmetry, 1, 12, DEFAULT_SETTINGS.symmetry)), zoom: clamp(frame?.zoom, 0.25, 8, 1), rotation: clamp(frame?.rotation, -180, 180, 0) })).sort((a, b) => a.progress - b.progress) : [];
    return {
      duration: clamp(animation.duration, 3, 30, 8),
      speed: [0.25, 0.5, 1, 2, 4].includes(Number(animation.speed)) ? Number(animation.speed) : 1,
      loop: animation.loop !== false,
      fps: [15, 24, 30, 60].includes(Number(animation.fps)) ? Number(animation.fps) : 30,
      format: ["webm", "mp4"].includes(animation.format) ? animation.format : "webm",
      keyframes
    };
  }

  function resolveAnimationKeyframe(animation, progress) {
    const frames = animation?.keyframes || []; if (!frames.length) return null; const afterIndex = frames.findIndex((frame) => frame.progress >= progress); if (afterIndex <= 0) return frames[0]; if (afterIndex < 0) return frames.at(-1); const before = frames[afterIndex - 1]; const after = frames[afterIndex]; const amount = (progress - before.progress) / Math.max(1e-6, after.progress - before.progress);
    return { colorA: mixHex(before.colorA, after.colorA, amount), colorB: mixHex(before.colorB, after.colorB, amount), glow: before.glow + (after.glow - before.glow) * amount, symmetry: Math.round(before.symmetry + (after.symmetry - before.symmetry) * amount), zoom: before.zoom + (after.zoom - before.zoom) * amount, rotation: before.rotation + (after.rotation - before.rotation) * amount };
  }

  function createLayer(name = "Layer mới", type = "stroke") {
    const stamp = Date.now();
    return normalizeLayer({ id: `layer-${stamp}-${Math.round(Math.random() * 1e5)}`, name, type });
  }

  function layerStrokes(layer) {
    return [...(layer?.children || []).flatMap(layerStrokes), ...(layer?.strokes || [])];
  }

  function projectStrokes(project, { visibleOnly = false } = {}) {
    return (project?.layers || []).filter((layer) => !visibleOnly || layer.visible).flatMap(layerStrokes);
  }

  function activeLayer(project) {
    return project?.layers?.find((layer) => layer.id === project.activeLayerId) || project?.layers?.[0] || null;
  }

  function normalizeProject(input = {}) {
    const legacyStrokes = Array.isArray(input.strokes) ? input.strokes : [];
    const sourceLayers = Array.isArray(input.layers) && input.layers.length ? input.layers : [{ id: "layer-light", name: "Ánh sáng", type: "stroke", strokes: legacyStrokes }];
    // Do not pass normalizeLayer directly to Array#map: map's third argument is
    // the source array, which would be mistaken for the recursion depth and
    // silently discard compound-layer children during project hydration.
    const layers = sourceLayers.slice(0, MAX_LAYERS).map((layer, index) => normalizeLayer(layer, index, 0));
    const selectedId = layers.some((layer) => layer.id === input.activeLayerId) ? input.activeLayerId : layers[0].id;
    return {
      schema: STORAGE_SCHEMA,
      version: 2,
      settings: normalizeSettings(input.settings || {}),
      view: normalizeView(input.view),
      animation: normalizeAnimation(input.animation),
      layers,
      activeLayerId: selectedId,
      updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date(0).toISOString()
    };
  }

  function buildSymmetryPoints(point, inputSettings = DEFAULT_SETTINGS) {
    const settings = normalizeSettings(inputSettings);
    const source = normalizePoint(point);
    return transformsForSettings(settings).map((transform) => ({ ...transformPoint(source, transform), mirrored: transform.mirrored, rotation: transform.rotation, spiral: transform.spiral }));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function ownerKey(currentUser) {
    const owner = currentUser?._id || currentUser?.id || currentUser?.email || "guest";
    return `${STORAGE_SCHEMA}:${String(owner).toLowerCase().replace(/[^a-z0-9@._-]/g, "-").slice(0, 100)}`;
  }

  function brushLibraryKey(storageKey) {
    return `${BRUSH_LIBRARY_SCHEMA}:${seedNumber(storageKey)}`;
  }

  function layoutKey(storageKey) {
    return `${LAYOUT_SCHEMA}:${seedNumber(storageKey)}`;
  }

  function inspectorKey(storageKey) {
    return `${INSPECTOR_SCHEMA}:${seedNumber(storageKey)}`;
  }

  function normalizeLayout(input = {}) {
    return {
      toolrailCollapsed: input?.toolrailCollapsed === true,
      inspectorCollapsed: input?.inspectorCollapsed === true,
      dockCollapsed: input?.dockCollapsed === true,
      compactControls: input?.compactControls === true
    };
  }

  function readLayout(storageKey) {
    try { return normalizeLayout(JSON.parse(globalScope.localStorage?.getItem(layoutKey(storageKey)) || "{}")); }
    catch { return { ...DEFAULT_LAYOUT }; }
  }

  function saveLayout(targetRuntime = runtime) {
    if (!targetRuntime) return false;
    try { globalScope.localStorage?.setItem(layoutKey(targetRuntime.storageKey), JSON.stringify(normalizeLayout(targetRuntime.layout))); return true; }
    catch { return false; }
  }

  function normalizeInspectorState(input = {}) {
    const activeTab = INSPECTOR_TABS.includes(input?.activeTab) ? input.activeTab : DEFAULT_INSPECTOR_STATE.activeTab;
    const openGroups = {};
    INSPECTOR_TABS.forEach((tab) => {
      const candidate = input?.openGroups?.[tab];
      openGroups[tab] = candidate === "" || INSPECTOR_GROUPS[tab].includes(candidate) ? candidate : DEFAULT_INSPECTOR_STATE.openGroups[tab];
    });
    const allGroups = new Set(Object.values(INSPECTOR_GROUPS).flat());
    const pinnedGroups = Array.isArray(input?.pinnedGroups) ? [...new Set(input.pinnedGroups.filter((id) => allGroups.has(id)))].slice(0, 2) : [];
    return { activeTab, openGroups, pinnedGroups, closeLibraryAfterSelect: input?.closeLibraryAfterSelect === true };
  }

  function readInspectorState(storageKey) {
    try { return normalizeInspectorState(JSON.parse(globalScope.localStorage?.getItem(inspectorKey(storageKey)) || "{}")); }
    catch { return normalizeInspectorState(); }
  }

  function saveInspectorState(targetRuntime = runtime) {
    if (!targetRuntime) return false;
    try { globalScope.localStorage?.setItem(inspectorKey(targetRuntime.storageKey), JSON.stringify(normalizeInspectorState(targetRuntime.inspectorState))); return true; }
    catch { return false; }
  }

  function readBrushLibrary(storageKey) {
    try {
      const value = JSON.parse(globalScope.localStorage?.getItem(brushLibraryKey(storageKey)) || "{}");
      return {
        favorites: Array.isArray(value.favorites) ? value.favorites.filter((id) => Object.hasOwn(PRESETS, id)).slice(0, 24) : [],
        recent: Array.isArray(value.recent) ? value.recent.filter((id) => Object.hasOwn(PRESETS, id)).slice(0, 8) : []
      };
    } catch { return { favorites: [], recent: [] }; }
  }

  function saveBrushLibrary(targetRuntime = runtime) {
    if (!targetRuntime) return;
    try { globalScope.localStorage?.setItem(brushLibraryKey(targetRuntime.storageKey), JSON.stringify({ favorites: [...targetRuntime.favoriteBrushes], recent: targetRuntime.recentBrushes })); } catch { /* Local preferences may be unavailable. */ }
  }

  function storageRead(key) {
    try { return normalizeProject(JSON.parse(globalScope.localStorage?.getItem(key) || "{}")); } catch { return normalizeProject(); }
  }

  function openProjectDatabase() {
    if (databasePromise) return databasePromise;
    if (!globalScope.indexedDB) return Promise.resolve(null);
    databasePromise = new Promise((resolve) => {
      const request = globalScope.indexedDB.open("hh-draw-studio", 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects"); if (!db.objectStoreNames.contains("checkpoints")) db.createObjectStore("checkpoints"); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null);
    });
    return databasePromise;
  }

  async function databaseGet(storeName, key) {
    const db = await openProjectDatabase(); if (!db) return null;
    return new Promise((resolve) => { const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null); });
  }

  async function databasePut(storeName, key, value) {
    const db = await openProjectDatabase(); if (!db) return false;
    return new Promise((resolve) => { const transaction = db.transaction(storeName, "readwrite"); transaction.objectStore(storeName).put(value, key); transaction.oncomplete = () => resolve(true); transaction.onerror = () => resolve(false); });
  }

  function projectPointCount(project) {
    return projectStrokes(project).reduce((sum, stroke) => sum + stroke.points.length, 0);
  }

  function projectRenderCost(project, quality = "balanced") {
    const profile = QUALITY_PROFILES[quality] || QUALITY_PROFILES.balanced;
    const transformLimit = profile.id === "quality" ? 96 : profile.id === "balanced" ? 48 : 24;
    const expensiveModes = new Set(["nebula", "plasma", "bokeh", "fluid", "turbulence", "liquid-plasma", "watercolor", "oil", "fireworks", "voronoi"]);
    return projectStrokes(project, { visibleOnly: true }).reduce((sum, stroke) => {
      const settings = normalizeSettings(stroke.settings || {});
      const transforms = Math.min(transformLimit, transformsForSettings(settings).length);
      const modeWeight = expensiveModes.has(settings.brushMode) ? 1.75 : 1;
      return sum + Math.max(0, stroke.points.length - 1) * transforms * Math.max(1, profile.fibers) * modeWeight;
    }, 0);
  }

  function storageWrite(key, project) {
    try {
      const compact = { ...project, layers: project.layers.slice(0, MAX_LAYERS), updatedAt: new Date().toISOString() };
      databasePut("projects", key, compact);
      if (projectPointCount(compact) <= 5000) globalScope.localStorage?.setItem(key, JSON.stringify(compact));
      else globalScope.localStorage?.setItem(key, JSON.stringify({ schema: STORAGE_SCHEMA, version: 2, settings: compact.settings, view: compact.view, animation: compact.animation, layers: compact.layers.map((layer) => ({ ...layer, strokes: [], children: [] })), activeLayerId: compact.activeLayerId, deferredToIndexedDb: true, updatedAt: compact.updatedAt }));
      return true;
    } catch { return false; }
  }

  async function hydrateFromDatabase(targetRuntime) {
    const stored = await databaseGet("projects", targetRuntime.storageKey);
    if (!stored || runtime !== targetRuntime || targetRuntime.userChangedProject) return;
    const project = normalizeProject(stored); if (!projectStrokes(project).length && projectStrokes(targetRuntime.project).length) return;
    targetRuntime.project = project; clearLayerCache(targetRuntime); syncControls(targetRuntime); syncLayerPanel(targetRuntime); renderProjectSafely(targetRuntime); drawGuides(targetRuntime); announce("Đã khôi phục project từ bộ nhớ bất đồng bộ", targetRuntime);
  }

  function scheduleCheckpoint(targetRuntime = runtime, label = "Tự động") {
    if (!targetRuntime || targetRuntime.checkpointPending) return; targetRuntime.checkpointPending = true;
    const run = async () => { targetRuntime.checkpointPending = false; const existing = await databaseGet("checkpoints", targetRuntime.storageKey) || []; const checkpoint = { id: Date.now(), label, createdAt: new Date().toISOString(), project: targetRuntime.project }; await databasePut("checkpoints", targetRuntime.storageKey, [checkpoint, ...existing].slice(0, 5)); };
    if (typeof globalScope.requestIdleCallback === "function") globalScope.requestIdleCallback(run, { timeout: 2000 }); else globalScope.setTimeout(run, 800);
  }

  async function restoreLatestCheckpoint(targetRuntime = runtime) {
    const checkpoints = await databaseGet("checkpoints", targetRuntime.storageKey) || []; if (!checkpoints.length) { toast("Chưa có checkpoint để khôi phục", targetRuntime); return; }
    pushHistory(targetRuntime); targetRuntime.project = normalizeProject(checkpoints[0].project); clearLayerCache(targetRuntime); syncControls(targetRuntime); syncLayerPanel(targetRuntime); renderProjectSafely(targetRuntime); drawGuides(targetRuntime); scheduleSave(targetRuntime); toast(`Đã khôi phục checkpoint ${checkpoints[0].label}`, targetRuntime);
  }

  function presetMarkup(settings, library = { favorites: [] }) {
    const favorites = new Set(library.favorites || []);
    return Object.entries(PRESETS).map(([id, preset]) => `<div class="draw-preset-card" data-draw-preset-card="${id}" data-draw-category="${preset.category || "light"}" data-draw-label="${escapeHtml(preset.label.toLowerCase())}"><button type="button" class="draw-preset ${settings.preset === id ? "is-active" : ""}" data-draw-preset="${id}" aria-pressed="${settings.preset === id}"><i>${preset.icon}</i><span>${escapeHtml(preset.label)}</span></button><button type="button" class="draw-preset-favorite ${favorites.has(id) ? "is-active" : ""}" data-draw-favorite="${id}" aria-pressed="${favorites.has(id)}" title="${favorites.has(id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}">☆</button></div>`).join("");
  }

  function modeFilterMarkup() {
    return [["all", "Tất cả"], ["favorites", "★ Yêu thích"], ["recent", "Gần đây"], ["light", "Ánh sáng"], ["particle", "Hạt"], ["physics", "Vật lý"], ["geometry", "Hình học"], ["nature", "Tự nhiên"], ["art", "Nghệ thuật"], ["digital", "Digital"]].map(([id, label], index) => `<button type="button" data-draw-mode-filter="${id}" class="${index === 0 ? "is-active" : ""}" aria-pressed="${index === 0}">${label}</button>`).join("");
  }

  function generatorMarkup(settings) {
    return `<div class="draw-generator-grid">${Object.entries(PATTERN_GENERATORS).map(([id, generator]) => `<button type="button" data-draw-generator="${id}" title="${escapeHtml(generator.description)}"><i>${generator.icon}</i><span><strong>${escapeHtml(generator.label)}</strong><small>${escapeHtml(generator.description)}</small></span></button>`).join("")}</div><div class="draw-generator-settings"><label><span>Seed tái tạo</span><input type="text" maxlength="48" value="${escapeHtml(settings.patternSeed)}" data-draw-setting="patternSeed"></label><label class="draw-range"><span><b>Chi tiết</b><output data-draw-output="patternComplexity">${settings.patternComplexity}</output></span><input type="range" min="3" max="16" step="1" value="${settings.patternComplexity}" data-draw-setting="patternComplexity"></label><label class="draw-range"><span><b>Kích thước</b><output data-draw-output="patternScale">${Math.round(settings.patternScale * 100)}%</output></span><input type="range" min="0.3" max="0.95" step="0.01" value="${settings.patternScale}" data-draw-setting="patternScale"></label><button type="button" class="draw-wide" data-draw-generator-remix>⟳ Đổi seed và tạo biến thể</button></div>`;
  }

  function paletteMarkup(settings) {
    return PALETTE.map((color) => `<button type="button" class="draw-color ${settings.colorA === color.toLowerCase() ? "is-active" : ""}" data-draw-color="${color}" style="--swatch:${color}" aria-label="Chọn màu ${color}" aria-pressed="${settings.colorA === color.toLowerCase()}"></button>`).join("");
  }

  function colorPaletteMarkup(settings) {
    return Object.entries(COLOR_PALETTES).filter(([id]) => id !== "custom").map(([id, palette]) => {
      const gradient = `linear-gradient(90deg,${palette.stops.join(",")})`;
      return `<button type="button" class="draw-gradient ${settings.paletteId === id ? "is-active" : ""}" data-draw-palette="${id}" aria-label="Bảng màu ${escapeHtml(palette.label)}" aria-pressed="${settings.paletteId === id}" style="--gradient:${gradient}"><i></i><span>${escapeHtml(palette.label)}</span></button>`;
    }).join("");
  }

  function gradientEditorMarkup(settings) {
    const minimumContrast = Math.min(...settings.customStops.map((color) => contrastRatio(color)));
    return `<div class="draw-gradient-editor" data-draw-gradient-editor><div class="draw-gradient-preview" style="--custom-gradient:linear-gradient(90deg,${settings.customStops.join(",")})"></div><div class="draw-gradient-stops">${settings.customStops.map((color, index) => `<label><input type="color" value="${color}" data-draw-gradient-stop="${index}" aria-label="Điểm màu ${index + 1}">${settings.customStops.length > 2 ? `<button type="button" data-draw-gradient-remove="${index}" title="Xóa điểm màu">×</button>` : ""}</label>`).join("")}</div><small class="draw-contrast ${minimumContrast >= 4.5 ? "is-good" : ""}">Tương phản nền tối thấp nhất ${minimumContrast.toFixed(1)}:1 · ${minimumContrast >= 4.5 ? "đạt mức chữ thường" : "chỉ nên dùng làm hiệu ứng"}</small><div class="draw-gradient-tools"><button type="button" data-draw-gradient-add>＋ Điểm màu</button><select data-draw-setting="gradientFlow" aria-label="Màu thay đổi theo"><option value="length"${settings.gradientFlow === "length" ? " selected" : ""}>Theo chiều dài</option><option value="speed"${settings.gradientFlow === "speed" ? " selected" : ""}>Theo tốc độ</option><option value="pressure"${settings.gradientFlow === "pressure" ? " selected" : ""}>Theo lực bút</option></select></div><div class="draw-harmony-tools"><button type="button" data-draw-harmony="complementary">Bổ túc</button><button type="button" data-draw-harmony="analogous">Tương đồng</button><button type="button" data-draw-harmony="triadic">Tam giác</button><button type="button" data-draw-harmony="random">Seed</button></div><label class="draw-seed"><span>Seed tái tạo</span><input type="text" maxlength="40" data-draw-palette-seed value="${escapeHtml(settings.paletteSeed)}"></label><label class="draw-import draw-palette-image"><input type="file" accept="image/png,image/jpeg,image/webp" data-draw-palette-image><span>Trích màu từ ảnh</span></label><div class="draw-harmony-tools"><button type="button" data-draw-palette-export="css">CSS</button><button type="button" data-draw-palette-export="json">JSON</button><button type="button" data-draw-palette-export="png">PNG</button></div></div>`;
  }

  function blendModeLabel(mode) {
    return ({ "source-over": "Thường", screen: "Screen", lighten: "Lighten", overlay: "Overlay", "color-dodge": "Color Dodge", "soft-light": "Soft Light", multiply: "Multiply" })[mode] || "Thường";
  }

  function layerTypeIcon(type) {
    return ({ stroke: "✎", particle: "✦", effect: "◈", background: "▣" })[type] || "✎";
  }

  function layerPanelMarkup(project) {
    const selected = activeLayer(project);
    const rows = [...project.layers].reverse().map((layer) => `<div class="draw-layer-row ${layer.id === project.activeLayerId ? "is-active" : ""}" data-layer-id="${escapeHtml(layer.id)}">
      <button type="button" class="draw-layer-icon" data-draw-layer-visible title="${layer.visible ? "Ẩn" : "Hiện"} ${escapeHtml(layer.name)}" aria-pressed="${layer.visible}">${layer.visible ? "◉" : "○"}</button>
      <button type="button" class="draw-layer-main" data-draw-layer-select aria-pressed="${layer.id === project.activeLayerId}"><i>${layerTypeIcon(layer.type)}</i><span><strong>${escapeHtml(layer.name)}</strong><small>${layerStrokes(layer).length} nét · ${blendModeLabel(layer.blendMode)}</small></span></button>
      <button type="button" class="draw-layer-icon" data-draw-layer-lock title="${layer.locked ? "Mở khóa" : "Khóa"} ${escapeHtml(layer.name)}" aria-pressed="${layer.locked}">${layer.locked ? "▣" : "▢"}</button>
    </div>`).join("");
    return `<div class="draw-layer-list" data-draw-layer-list>${rows}</div>
      <div class="draw-layer-toolbar" role="toolbar" aria-label="Thao tác layer"><button type="button" data-draw-layer-add title="Thêm layer">＋</button><button type="button" data-draw-layer-duplicate title="Nhân bản layer">▣</button><button type="button" data-draw-layer-up title="Đưa layer lên">↑</button><button type="button" data-draw-layer-down title="Đưa layer xuống">↓</button><button type="button" data-draw-layer-merge title="Gộp layer xuống">⇣</button><button type="button" data-draw-layer-delete title="Xóa layer">×</button></div>
      <div class="draw-layer-inspector" data-draw-layer-inspector>
        <label><span>Tên layer</span><input type="text" maxlength="80" data-draw-layer-name value="${escapeHtml(selected?.name || "Layer")}"></label>
        <div class="draw-inline"><label><span>Loại</span><select data-draw-layer-type>${LAYER_TYPES.map((type) => `<option value="${type}"${selected?.type === type ? " selected" : ""}>${({ stroke: "Nét vẽ", particle: "Hạt", effect: "Hiệu ứng", background: "Nền" })[type]}</option>`).join("")}</select></label><label><span>Hòa trộn</span><select data-draw-layer-blend>${LAYER_BLEND_MODES.map((mode) => `<option value="${mode}"${selected?.blendMode === mode ? " selected" : ""}>${blendModeLabel(mode)}</option>`).join("")}</select></label></div>
        <label class="draw-range"><span><b>Độ trong suốt</b><output data-draw-layer-opacity-output>${Math.round((selected?.opacity ?? 1) * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${selected?.opacity ?? 1}" data-draw-layer-opacity></label>
      </div>`;
  }

  function inspectorAccordionMarkup(state, id, title, summary, body) {
    const open = state.openGroups[INSPECTOR_TABS.find((tab) => INSPECTOR_GROUPS[tab].includes(id))] === id || state.pinnedGroups.includes(id);
    const pinned = state.pinnedGroups.includes(id);
    return `<section class="draw-accordion ${open ? "is-open" : ""} ${pinned ? "is-pinned" : ""}" data-draw-accordion="${id}">
      <div class="draw-accordion-heading"><button type="button" data-draw-accordion-toggle="${id}" aria-expanded="${open}" aria-controls="draw-accordion-${id}"><span><strong>${title}</strong><small>${summary}</small></span><i aria-hidden="true">⌄</i></button><button type="button" class="draw-accordion-pin" data-draw-accordion-pin="${id}" aria-pressed="${pinned}" title="${pinned ? "Bỏ ghim nhóm" : "Ghim nhóm này"}" aria-label="${pinned ? "Bỏ ghim" : "Ghim"} ${title}">${pinned ? "◆" : "◇"}</button></div>
      <div class="draw-accordion-body" id="draw-accordion-${id}" ${open ? "" : "hidden"}>${body}</div>
    </section>`;
  }

  function markup(project, library = { favorites: [], recent: [] }, inputInspectorState = DEFAULT_INSPECTOR_STATE) {
    const settings = project.settings;
    const animation = project.animation;
    const inspectorState = normalizeInspectorState(inputInspectorState);
    const activePreset = PRESETS[settings.preset] || PRESETS.silk;
    const activePalette = COLOR_PALETTES[settings.paletteId] || COLOR_PALETTES.custom;
    const panelHidden = (tab) => inspectorState.activeTab === tab ? "" : "hidden";
    return `<section class="draw-studio" data-draw-studio data-background="${settings.background}">
      <div class="draw-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="draw-topbar">
        <div class="draw-brand"><span>✦</span><div><small>HH CREATIVE LIGHT LAB</small><strong>Vẽ · Chromatic Studio</strong></div></div>
        <div class="draw-project-context" aria-label="Trạng thái dự án"><span><small>DỰ ÁN HIỆN TẠI</small><strong>Tác phẩm ánh sáng</strong></span><i></i><span><small data-draw-save-state>Đã tự lưu</small><b>${settings.canvasWidth} × ${settings.canvasHeight}</b></span></div>
        <nav aria-label="Thao tác dự án">
          <button type="button" data-draw-new><i>＋</i><span>Mới</span></button>
          <button type="button" data-draw-save><i>✓</i><span>Lưu</span></button>
          <button type="button" data-draw-undo disabled><i>↶</i><span>Hoàn tác</span></button>
          <button type="button" data-draw-redo disabled><i>↷</i><span>Làm lại</span></button>
          <button type="button" data-draw-copy><i>▣</i><span>Sao chép</span></button>
          <button type="button" data-draw-zen aria-pressed="false"><i>◐</i><span>Zen Canvas</span></button>
          <button type="button" data-draw-fullscreen><i>⛶</i><span>Toàn màn hình</span></button>
          <button type="button" data-draw-layout-reset title="Đặt lại bố cục studio"><i>▦</i><span>Bố cục</span></button>
          <button type="button" class="draw-primary" data-draw-export><i>↓</i><span>Tải ảnh</span></button>
        </nav>
      </header>
      <div class="draw-workspace">
        <aside class="draw-toolrail" aria-label="Công cụ vẽ chính">
          <button type="button" class="draw-rail-toggle" data-draw-layout-toggle="toolrail" title="Thu gọn thanh công cụ" aria-label="Thu gọn thanh công cụ">⇤</button>
          <div role="toolbar" aria-label="Chọn công cụ"><button type="button" class="is-active" data-draw-tool="draw" title="Bút vẽ (B)" aria-pressed="true"><i>✎</i><span>Bút</span><kbd>B</kbd></button><button type="button" data-draw-tool="eraser" title="Tẩy (E)" aria-pressed="false"><i>⌫</i><span>Tẩy</span><kbd>E</kbd></button><button type="button" data-draw-tool="select" title="Chọn nét (V)" aria-pressed="false"><i>◇</i><span>Chọn</span><kbd>V</kbd></button><button type="button" data-draw-tool="pan" title="Di chuyển canvas (H hoặc Space)" aria-pressed="false"><i>✥</i><span>Di chuyển</span><kbd>H</kbd></button></div>
          <span></span>
          <div role="toolbar" aria-label="Điều hướng thuộc tính"><button type="button" data-draw-jump="layers" title="Mở Layer Studio"><i>▱</i><span>Layer</span></button><button type="button" data-draw-jump="brushes" title="Mở thư viện brush"><i>✺</i><span>Brush</span></button><button type="button" data-draw-jump="colors" title="Mở bảng màu"><i>◉</i><span>Màu</span></button><button type="button" data-draw-jump="canvas" title="Mở thiết lập canvas"><i>⌗</i><span>Canvas</span></button><button type="button" data-draw-jump="export" title="Mở thiết lập xuất"><i>↓</i><span>Xuất</span></button></div>
        </aside>
        <aside class="draw-controls" data-draw-inspector aria-label="Thuộc tính theo ngữ cảnh">
          <header><div><small>THUỘC TÍNH THEO NGỮ CẢNH</small><strong data-draw-inspector-title>Công cụ Bút</strong></div><span><button type="button" data-draw-layout-toggle="inspector" title="Thu gọn bảng thuộc tính" aria-label="Thu gọn bảng thuộc tính">⇥</button><button type="button" data-draw-panel-close aria-label="Đóng bảng điều khiển">×</button></span></header>
          <nav class="draw-inspector-tabs" role="tablist" aria-label="Nhóm thuộc tính">
            <button type="button" role="tab" id="draw-tab-tool" data-draw-inspector-tab="tool" aria-controls="draw-panel-tool" aria-selected="${inspectorState.activeTab === "tool"}">Công cụ</button>
            <button type="button" role="tab" id="draw-tab-object" data-draw-inspector-tab="object" aria-controls="draw-panel-object" aria-selected="${inspectorState.activeTab === "object"}">Đối tượng</button>
            <button type="button" role="tab" id="draw-tab-layer" data-draw-inspector-tab="layer" aria-controls="draw-panel-layer" aria-selected="${inspectorState.activeTab === "layer"}">Layer</button>
            <button type="button" role="tab" id="draw-tab-document" data-draw-inspector-tab="document" aria-controls="draw-panel-document" aria-selected="${inspectorState.activeTab === "document"}">Tài liệu</button>
          </nav>
          <div class="draw-inspector-body">
            <div class="draw-inspector-panel" id="draw-panel-tool" role="tabpanel" aria-labelledby="draw-tab-tool" data-draw-inspector-panel="tool" ${panelHidden("tool")}>
              ${inspectorAccordionMarkup(inspectorState, "tool-core", "Bút & màu", `${escapeHtml(activePreset.label)} · ${settings.brushSize.toFixed(1)} px · ${settings.colorA.toUpperCase()}`, `<div class="draw-context-launchers"><button type="button" data-draw-jump="brushes"><i>✺</i><span><strong data-draw-summary-brush>${escapeHtml(activePreset.label)}</strong><small>Mở thư viện ${Object.keys(PRESETS).length} brush</small></span><b>›</b></button><button type="button" data-draw-jump="colors"><i class="draw-color-orb" data-draw-color-orb style="--draw-active-color:${settings.colorA}"></i><span><strong data-draw-summary-color>${escapeHtml(activePalette.label)}</strong><small data-draw-summary-hex>${settings.colorA}</small></span><b>›</b></button></div><label class="draw-select-row"><span><strong>Chất lượng realtime</strong><small>Tự cân bằng nét theo thiết bị</small></span><select data-draw-setting="quality"><option value="auto"${settings.quality === "auto" ? " selected" : ""}>Tự động thông minh</option><option value="quality"${settings.quality === "quality" ? " selected" : ""}>Chất lượng cao</option><option value="balanced"${settings.quality === "balanced" ? " selected" : ""}>Cân bằng</option><option value="performance"${settings.quality === "performance" ? " selected" : ""}>Ưu tiên tốc độ</option></select></label><label class="draw-range"><span><b>Độ dày</b><output data-draw-output="brushSize">${settings.brushSize.toFixed(1)} px</output></span><input type="range" min="0.5" max="8" step="0.1" value="${settings.brushSize}" data-draw-setting="brushSize"></label><label class="draw-range"><span><b>Hào quang</b><output data-draw-output="glow">${Math.round(settings.glow)}%</output></span><input type="range" min="0" max="48" step="1" value="${settings.glow}" data-draw-setting="glow"></label><label class="draw-range"><span><b>Độ mềm</b><output data-draw-output="flow">${Math.round(settings.flow * 100)}%</output></span><input type="range" min="0.15" max="1" step="0.01" value="${settings.flow}" data-draw-setting="flow"></label>`)}
              ${inspectorAccordionMarkup(inspectorState, "tool-pattern", "Pattern Composer", "6 thuật toán · seed tái tạo · undo/redo thật", generatorMarkup(settings))}
              ${inspectorAccordionMarkup(inspectorState, "tool-dynamics", "Brush Dynamics", "Lực bút · độ mượt · tốc độ · độ tán", `
            <label class="draw-range"><span><b>Stabilizer</b><output data-draw-output="stabilizer">${Math.round(settings.stabilizer)}%</output></span><input type="range" min="0" max="95" step="1" value="${settings.stabilizer}" data-draw-setting="stabilizer"></label>
            <label class="draw-switch"><span><strong>Lực bút</strong><small>Dùng pressure của bút hoặc cảm ứng</small></span><input type="checkbox" data-draw-setting="pressureEnabled" ${settings.pressureEnabled ? "checked" : ""}><i></i></label>
            <label class="draw-range"><span><b>Đường cong lực</b><output data-draw-output="pressureCurve">${settings.pressureCurve.toFixed(2)}×</output></span><input type="range" min="0.35" max="3" step="0.05" value="${settings.pressureCurve}" data-draw-setting="pressureCurve"></label>
            <label class="draw-range"><span><b>Tốc độ → độ dày</b><output data-draw-output="velocityWidth">${Math.round(settings.velocityWidth * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.velocityWidth}" data-draw-setting="velocityWidth"></label>
            <label class="draw-range"><span><b>Tốc độ → ánh sáng</b><output data-draw-output="velocityGlow">${Math.round(settings.velocityGlow * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.velocityGlow}" data-draw-setting="velocityGlow"></label>
            <div class="draw-inline"><label><span>Vuốt đầu</span><input type="range" min="0" max="0.5" step="0.01" value="${settings.taperStart}" data-draw-setting="taperStart"></label><label><span>Vuốt cuối</span><input type="range" min="0" max="0.5" step="0.01" value="${settings.taperEnd}" data-draw-setting="taperEnd"></label></div>
            <label class="draw-range"><span><b>Khoảng điểm</b><output data-draw-output="spacing">${settings.spacing.toFixed(1)} px</output></span><input type="range" min="0.6" max="16" step="0.2" value="${settings.spacing}" data-draw-setting="spacing"></label>
            <label class="draw-range"><span><b>Scatter</b><output data-draw-output="scatter">${settings.scatter.toFixed(1)} px</output></span><input type="range" min="0" max="24" step="0.5" value="${settings.scatter}" data-draw-setting="scatter"></label>
            <label class="draw-range"><span><b>Noise</b><output data-draw-output="noise">${Math.round(settings.noise * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.noise}" data-draw-setting="noise"></label>
            <label class="draw-range"><span><b>Độ cong</b><output data-draw-output="curvature">${Math.round(settings.curvature * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.curvature}" data-draw-setting="curvature"></label>
            <label class="draw-range"><span><b>Đàn hồi</b><output data-draw-output="elasticity">${Math.round(settings.elasticity * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.elasticity}" data-draw-setting="elasticity"></label>
            <label class="draw-range"><span><b>Quán tính</b><output data-draw-output="inertia">${Math.round(settings.inertia * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${settings.inertia}" data-draw-setting="inertia"></label>
            <label class="draw-range"><span><b>Xoay đầu bút</b><output data-draw-output="rotation">${Math.round(settings.rotation)}°</output></span><input type="range" min="0" max="360" step="1" value="${settings.rotation}" data-draw-setting="rotation"></label>
            <label class="draw-switch"><span><strong>Đầu tẩy stylus</strong><small>Tự nhận diện nút tẩy của bút</small></span><input type="checkbox" data-draw-setting="stylusEraser" ${settings.stylusEraser ? "checked" : ""}><i></i></label>
          `)}
            </div>
            <div class="draw-inspector-panel" id="draw-panel-object" role="tabpanel" aria-labelledby="draw-tab-object" data-draw-inspector-panel="object" ${panelHidden("object")}>
              ${inspectorAccordionMarkup(inspectorState, "object-transform", "Chọn & biến đổi", "Thao tác thật trên các nét đang chọn", `<div class="draw-object-status"><i>◇</i><span><strong><b data-draw-selection-count>0</b> nét đang chọn</strong><small>Kéo trên canvas để tạo vùng chọn chữ nhật, ellipse hoặc lasso.</small></span></div><div class="draw-object-shapes" role="toolbar" aria-label="Kiểu vùng chọn"><button type="button" data-draw-select-shape="rect" class="is-active" aria-pressed="true">□ Chữ nhật</button><button type="button" data-draw-select-shape="ellipse" aria-pressed="false">○ Ellipse</button><button type="button" data-draw-select-shape="lasso" aria-pressed="false">⌁ Lasso</button></div><div class="draw-transform-grid" role="toolbar" aria-label="Biến đổi nét đã chọn"><button type="button" data-draw-transform="duplicate">▣ Nhân bản</button><button type="button" data-draw-transform="rotate">↻ Xoay 90°</button><button type="button" data-draw-transform="scale-up">⊕ Phóng lớn</button><button type="button" data-draw-transform="scale-down">⊖ Thu nhỏ</button><button type="button" data-draw-transform="flip-x">↔ Lật ngang</button><button type="button" data-draw-transform="flip-y">↕ Lật dọc</button><button type="button" data-draw-transform="reverse">⇄ Đảo nét</button><button type="button" data-draw-transform="warp">≋ Warp</button><button type="button" data-draw-transform="perspective">◇ Phối cảnh</button><button type="button" data-draw-transform="mask">◩ Tạo mask</button><button type="button" data-draw-transform="clear-mask">◨ Xóa mask</button><button type="button" class="is-danger" data-draw-transform="delete">× Xóa nét</button></div>`)}
            </div>
            <div class="draw-inspector-panel" id="draw-panel-layer" role="tabpanel" aria-labelledby="draw-tab-layer" data-draw-inspector-panel="layer" ${panelHidden("layer")}>
              ${inspectorAccordionMarkup(inspectorState, "layer-studio", "Layer Studio", `${project.layers.length}/${MAX_LAYERS} layer · opacity · blend · lock`, `<div class="draw-layer-section" data-draw-panel-section="layers" tabindex="-1"><div data-draw-layer-panel>${layerPanelMarkup(project)}</div></div>`)}
            </div>
            <div class="draw-inspector-panel" id="draw-panel-document" role="tabpanel" aria-labelledby="draw-tab-document" data-draw-inspector-panel="document" ${panelHidden("document")}>
              ${inspectorAccordionMarkup(inspectorState, "document-canvas", "Canvas & đối xứng", `${settings.canvasWidth} × ${settings.canvasHeight} · ${settings.symmetry} nhánh`, `<div data-draw-panel-section="canvas" tabindex="-1"><label class="draw-range"><span><b>Đối xứng quay</b><output data-draw-output="symmetry">${settings.symmetry} nhánh</output></span><input type="range" min="1" max="12" step="1" value="${settings.symmetry}" data-draw-setting="symmetry"></label><label class="draw-switch"><span><strong>Phản chiếu qua tâm</strong><small>Nhân đôi nét qua mỗi trục</small></span><input type="checkbox" data-draw-setting="mirror" ${settings.mirror ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Xoáy vào trung tâm</strong><small>Tạo các lớp thu nhỏ hướng tâm</small></span><input type="checkbox" data-draw-setting="spiral" ${settings.spiral ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Hiện đường dẫn</strong><small>Lưới chỉ dẫn không đi vào ảnh xuất</small></span><input type="checkbox" data-draw-setting="guides" ${settings.guides ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Lưới căn chỉnh</strong><small>Lưới chỉ hiển thị khi làm việc</small></span><input type="checkbox" data-draw-setting="grid" ${settings.grid ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Hít vào tâm</strong><small>Tự bắt nét gần đúng tâm canvas</small></span><input type="checkbox" data-draw-setting="snapCenter" ${settings.snapCenter ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Vẽ bằng cảm ứng</strong><small>Tắt để một ngón tay chỉ di chuyển canvas</small></span><input type="checkbox" data-draw-setting="touchDraw" ${settings.touchDraw ? "checked" : ""}><i></i></label></div>`)}
              ${inspectorAccordionMarkup(inspectorState, "document-animation", "Animation Studio", "Replay · timeline · loop · xuất video", `<div class="draw-animation-controls"><button type="button" data-draw-animation="play" title="Phát">▶</button><button type="button" data-draw-animation="pause" title="Tạm dừng">Ⅱ</button><button type="button" data-draw-animation="stop" title="Dừng">■</button><span data-draw-animation-time>00:00</span></div><div class="draw-keyframe-controls"><button type="button" data-draw-keyframe="add">＋ Keyframe</button><button type="button" data-draw-keyframe="remove">Xóa gần nhất</button><span><b data-draw-keyframe-count>${animation.keyframes.length}</b>/32</span></div><label class="draw-range"><span><b>Timeline</b><output data-draw-output="timeline">0%</output></span><input type="range" min="0" max="1" step="0.001" value="0" data-draw-timeline></label><label class="draw-range"><span><b>Thời lượng</b><output data-draw-animation-output="duration">${animation.duration.toFixed(0)} giây</output></span><input type="range" min="3" max="30" step="1" value="${animation.duration}" data-draw-animation-setting="duration"></label><div class="draw-inline"><label><span>Tốc độ</span><select data-draw-animation-setting="speed">${[0.25,0.5,1,2,4].map((value) => `<option value="${value}"${animation.speed === value ? " selected" : ""}>${value}×</option>`).join("")}</select></label><label><span>FPS</span><select data-draw-animation-setting="fps">${[15,24,30,60].map((value) => `<option value="${value}"${animation.fps === value ? " selected" : ""}>${value} FPS</option>`).join("")}</select></label><label><span>Video</span><select data-draw-animation-setting="format"><option value="webm"${animation.format === "webm" ? " selected" : ""}>WebM</option><option value="mp4"${animation.format === "mp4" ? " selected" : ""}>MP4 nếu hỗ trợ</option></select></label></div><label class="draw-switch"><span><strong>Loop liền mạch</strong><small>Phát lại từ đầu sau khi hoàn tất</small></span><input type="checkbox" data-draw-animation-setting="loop" ${animation.loop ? "checked" : ""}><i></i></label><button type="button" class="draw-wide" data-draw-audio-reactive>♫ Bật Audio Reactive</button><button type="button" class="draw-wide draw-primary" data-draw-animation-export>Xuất video timelapse</button>`)}
              ${inspectorAccordionMarkup(inspectorState, "document-media", "Media nền cục bộ", "Ảnh hoặc video chỉ lưu trong phiên", `<label class="draw-import"><input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" data-draw-background-media><span>Chọn ảnh hoặc video nền</span></label><button type="button" class="draw-wide" data-draw-background-remove>Xóa media nền</button><small class="draw-local-note" data-draw-background-status>Không tải media ra khỏi thiết bị · chỉ dùng trong phiên này</small>`)}
              ${inspectorAccordionMarkup(inspectorState, "document-export", "Project & xuất bản", "PNG · WebP · JPEG · SVG · project JSON", `<div data-draw-panel-section="export" tabindex="-1"><label class="draw-select-row"><span><strong>Kích thước canvas</strong><small>Preset mạng xã hội hoặc kích thước tùy chỉnh</small></span><select data-draw-setting="canvasPreset">${Object.entries(CANVAS_PRESETS).map(([id, preset]) => `<option value="${id}"${settings.canvasPreset === id ? " selected" : ""}>${preset.label}</option>`).join("")}</select></label><div class="draw-inline"><label><span>Rộng</span><input type="number" min="320" max="7680" value="${settings.canvasWidth}" data-draw-setting="canvasWidth"></label><label><span>Cao</span><input type="number" min="320" max="7680" value="${settings.canvasHeight}" data-draw-setting="canvasHeight"></label><label><span>Nền</span><select data-draw-setting="background"><option value="cosmic"${settings.background === "cosmic" ? " selected" : ""}>Vũ trụ</option><option value="midnight"${settings.background === "midnight" ? " selected" : ""}>Xanh đêm</option><option value="black"${settings.background === "black" ? " selected" : ""}>Đen</option><option value="transparent"${settings.background === "transparent" ? " selected" : ""}>Trong suốt</option></select></label><label><span>Định dạng</span><select data-draw-setting="exportFormat"><option value="png"${settings.exportFormat === "png" ? " selected" : ""}>PNG</option><option value="webp"${settings.exportFormat === "webp" ? " selected" : ""}>WebP</option><option value="jpeg"${settings.exportFormat === "jpeg" ? " selected" : ""}>JPEG</option></select></label><label><span>Độ phân giải</span><select data-draw-setting="exportScale"><option value="1"${settings.exportScale === 1 ? " selected" : ""}>1×</option><option value="2"${settings.exportScale === 2 ? " selected" : ""}>2×</option><option value="4"${settings.exportScale === 4 ? " selected" : ""}>4×</option></select></label></div><button type="button" class="draw-wide" data-draw-export-svg>Xuất SVG vector</button><button type="button" class="draw-wide" data-draw-export-layers>Xuất từng layer PNG</button><div class="draw-export-pair"><button type="button" data-draw-brush-export>Xuất preset brush</button><label class="draw-import"><input type="file" accept="application/json,.json" data-draw-brush-import><span>Nhập preset</span></label></div><button type="button" class="draw-wide" data-draw-project-export>Xuất project JSON</button><label class="draw-import"><input type="file" accept="application/json,.json" data-draw-project-import><span>Nhập project JSON</span></label></div>`)}
            </div>
          </div>
          <section class="draw-context-drawer" data-draw-drawer="brushes" data-draw-panel-section="brushes" tabindex="-1" hidden aria-labelledby="draw-brush-library-title"><header><div><small>THƯ VIỆN BRUSH</small><strong id="draw-brush-library-title">${Object.keys(PRESETS).length} chế độ nét động</strong></div><button type="button" data-draw-drawer-close aria-label="Đóng thư viện brush">×</button></header><div class="draw-drawer-options"><label class="draw-switch"><span><strong>Đóng sau khi chọn</strong><small>Quay lại canvas ngay sau khi chọn brush</small></span><input type="checkbox" data-draw-close-after-select ${inspectorState.closeLibraryAfterSelect ? "checked" : ""}><i></i></label></div><label class="draw-brush-search"><span>⌕</span><input type="search" data-draw-brush-search placeholder="Tìm brush, ví dụ plasma, ink…" autocomplete="off"></label><div class="draw-mode-filters" role="toolbar" aria-label="Lọc chế độ nét">${modeFilterMarkup()}</div><div class="draw-section-heading"><h3>Kết quả</h3><span data-draw-mode-count>${Object.keys(PRESETS).length}</span></div><div class="draw-preset-grid">${presetMarkup(settings, library)}</div><p class="draw-filter-empty" data-draw-filter-empty hidden>Không có brush phù hợp. Hãy thử từ khóa hoặc nhóm khác.</p></section>
          <section class="draw-context-drawer" data-draw-drawer="colors" data-draw-panel-section="colors" tabindex="-1" hidden aria-labelledby="draw-color-studio-title"><header><div><small>COLOR STUDIO</small><strong id="draw-color-studio-title">Màu, gradient & hòa sắc</strong></div><button type="button" data-draw-drawer-close aria-label="Đóng Color Studio">×</button></header><div class="draw-color-readout"><i data-draw-color-orb style="--draw-active-color:${settings.colorA}"></i><label><span>HEX</span><input type="text" maxlength="7" value="${settings.colorA}" data-draw-color-code aria-label="Mã màu HEX"></label><span><small>RGB</small><b data-draw-color-rgb></b></span><span><small>HSL</small><b data-draw-color-hsl></b></span></div><div class="draw-color-actions"><button type="button" data-draw-eyedropper>⌾ Lấy màu</button><button type="button" data-draw-color-copy>▣ Sao chép HEX</button><button type="button" data-draw-color-paste>⇥ Dán HEX</button></div><div class="draw-gradient-grid">${colorPaletteMarkup(settings)}</div><details class="draw-custom-color" open><summary>Tùy chỉnh màu riêng</summary><div class="draw-palette">${paletteMarkup(settings)}</div><div class="draw-color-mix"><label><span>Màu chính</span><input type="color" data-draw-color-a value="${settings.colorA}"></label><i>＋</i><label><span>Màu hòa</span><input type="color" data-draw-color-b value="${settings.colorB}"></label><b data-draw-mix-preview style="--mix:${mixHex(settings.colorA, settings.colorB)}"></b></div>${gradientEditorMarkup(settings)}</details><label class="draw-switch"><span><strong>Cầu vồng chuyển động</strong><small>Tự chạy toàn bộ phổ màu theo chiều dài nét</small></span><input type="checkbox" data-draw-setting="autoHue" ${settings.autoHue ? "checked" : ""}><i></i></label></section>
        </aside>
        <main class="draw-canvas-stage">
          <canvas data-draw-canvas tabindex="0" aria-label="Khung vẽ ánh sáng. Giữ chuột hoặc chạm và kéo để vẽ.">Trình duyệt chưa hỗ trợ Canvas.</canvas>
          <canvas class="draw-guide-canvas" data-draw-guides aria-hidden="true"></canvas>
          <div class="draw-ruler draw-ruler-x" aria-hidden="true"></div><div class="draw-ruler draw-ruler-y" aria-hidden="true"></div>
          <div class="draw-brush-cursor" data-draw-brush-cursor aria-hidden="true"></div>
          <div class="draw-selection-box" data-draw-selection-box hidden aria-hidden="true"></div>
          <div class="draw-selection-actions" data-draw-selection-actions hidden role="toolbar" aria-label="Biến đổi vùng chọn"><span><b data-draw-selection-count>0</b> nét</span><button type="button" data-draw-select-shape="rect" class="is-active" title="Chọn hình chữ nhật">□</button><button type="button" data-draw-select-shape="ellipse" title="Chọn ellipse">○</button><button type="button" data-draw-select-shape="lasso" title="Lasso">⌁</button><i></i><button type="button" data-draw-transform="duplicate" title="Nhân bản">▣</button><button type="button" data-draw-transform="reverse" title="Đảo chiều nét">⇄</button><button type="button" data-draw-transform="trim-start" title="Cắt 20% đầu">◁</button><button type="button" data-draw-transform="trim-end" title="Cắt 20% cuối">▷</button><button type="button" data-draw-transform="flip-x" title="Lật ngang">↔</button><button type="button" data-draw-transform="flip-y" title="Lật dọc">↕</button><button type="button" data-draw-transform="rotate" title="Xoay 90°">↻</button><button type="button" data-draw-transform="scale-up" title="Phóng lớn">⊕</button><button type="button" data-draw-transform="scale-down" title="Thu nhỏ">⊖</button><button type="button" data-draw-transform="warp" title="Warp">≋</button><button type="button" data-draw-transform="perspective" title="Perspective">◇</button><button type="button" data-draw-transform="mask" title="Tạo mask">◩</button><button type="button" data-draw-transform="clear-mask" title="Xóa mask">◨</button><button type="button" data-draw-transform="keep-selection" title="Giữ vùng chọn, xóa nền vector">◉</button><button type="button" data-draw-transform="delete" title="Xóa nét đã chọn">×</button></div>
          <canvas class="draw-minimap" data-draw-minimap width="160" height="100" aria-label="Bản đồ canvas, bấm để di chuyển góc nhìn"></canvas>
          <div class="draw-empty" data-draw-empty><i>✦</i><strong>Chạm và kéo để đánh thức sắc màu</strong><span>Chọn một brush engine, bảng màu rồi kéo nét — tác phẩm xuất hiện tức thì.</span></div>
          <button type="button" class="draw-panel-toggle" data-draw-panel-open aria-label="Mở bảng điều khiển">☰ <span>Điều khiển</span></button>
          <div class="draw-toolbox" role="toolbar" aria-label="Công cụ canvas"><button type="button" class="is-active" data-draw-tool="draw" title="Vẽ (B)" aria-pressed="true">✎</button><button type="button" data-draw-tool="eraser" title="Tẩy (E)" aria-pressed="false">⌫</button><button type="button" data-draw-tool="select" title="Chọn nét (V)" aria-pressed="false">◇</button><button type="button" data-draw-tool="pan" title="Di chuyển canvas (H hoặc Space)" aria-pressed="false">✥</button><i></i><button type="button" data-draw-view="zoom-out" title="Thu nhỏ">−</button><button type="button" class="draw-zoom-readout" data-draw-view="fit" title="Vừa khung"><span data-draw-zoom>100%</span></button><button type="button" data-draw-view="zoom-in" title="Phóng lớn">＋</button><button type="button" data-draw-view="rotate-left" title="Xoay trái">↶</button><button type="button" data-draw-view="rotate-right" title="Xoay phải">↷</button><button type="button" data-draw-view="reset" title="Đặt lại góc nhìn">⌂</button></div>
          <div class="draw-canvas-status" aria-live="polite"><span><i></i><b data-draw-status>Đã sẵn sàng</b></span><small data-draw-performance>Auto · Cân bằng</small><small data-draw-engine>Worker · sẵn sàng</small><small data-draw-stats>${projectStrokes(project).length} nét · ${project.layers.length} layer · tự lưu</small></div>
          <div class="draw-quickbar">
            <button type="button" data-draw-new title="Tạo bản vẽ mới">＋</button>
            <button type="button" data-draw-undo title="Hoàn tác" disabled>↶</button>
            <button type="button" data-draw-redo title="Làm lại" disabled>↷</button>
            <button type="button" data-draw-guides-toggle title="Bật hoặc tắt lưới" aria-pressed="${settings.guides}">⌗</button>
            <button type="button" data-draw-checkpoint-restore title="Khôi phục checkpoint gần nhất">⟲</button>
            <button type="button" data-draw-export title="Tải ảnh">↓</button>
          </div>
          <section class="draw-workspace-dock" data-draw-dock aria-label="Điều hướng nhanh studio">
            <button type="button" class="draw-dock-toggle" data-draw-layout-toggle="dock" title="Thu gọn thanh studio" aria-label="Thu gọn thanh studio">⌄</button>
            <div class="draw-dock-tabs" role="toolbar" aria-label="Mở nhanh khu vực làm việc"><button type="button" data-draw-jump="layers"><i>▱</i><span><strong>Layer</strong><small data-draw-dock-layers>${project.layers.length} lớp</small></span></button><button type="button" data-draw-jump="brushes"><i>✺</i><span><strong>Brush</strong><small>${escapeHtml(PRESETS[settings.preset]?.label || "Silk Light")}</small></span></button><button type="button" data-draw-jump="colors"><i>◉</i><span><strong>Màu</strong><small>${escapeHtml(COLOR_PALETTES[settings.paletteId]?.label || "Tùy chỉnh")}</small></span></button><button type="button" data-draw-jump="canvas"><i>⌗</i><span><strong>Artboard</strong><small>${settings.canvasWidth} × ${settings.canvasHeight}</small></span></button></div>
            <div class="draw-dock-history" role="toolbar" aria-label="Lịch sử thao tác"><span><small>LỊCH SỬ</small><b data-draw-history-count>0 thao tác</b></span><button type="button" data-draw-undo title="Hoàn tác" disabled>↶</button><button type="button" data-draw-redo title="Làm lại" disabled>↷</button></div>
            <div class="draw-dock-layout" role="toolbar" aria-label="Tùy chỉnh bố cục"><button type="button" data-draw-layout-toggle="toolrail" title="Bật hoặc tắt thanh công cụ">⇤</button><button type="button" data-draw-layout-toggle="inspector" title="Bật hoặc tắt bảng thuộc tính">⇥</button><button type="button" data-draw-layout-reset title="Đặt lại bố cục">▦</button></div>
          </section>
          <button type="button" class="draw-zen-exit" data-draw-zen aria-label="Thoát Zen Canvas">Thoát Zen · Z</button>
        </main>
      </div>
      <div class="draw-toast" data-draw-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function backgroundFill(ctx, width, height, background) {
    if (background === "transparent") return;
    if (background === "black") { ctx.fillStyle = "#020205"; ctx.fillRect(0, 0, width, height); return; }
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
    if (background === "midnight") { gradient.addColorStop(0, "#101b42"); gradient.addColorStop(1, "#02040d"); }
    else { gradient.addColorStop(0, "#120c2f"); gradient.addColorStop(0.48, "#06142a"); gradient.addColorStop(1, "#010207"); }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawMediaCover(ctx, media, width, height) {
    const sourceWidth = media?.videoWidth || media?.naturalWidth || media?.width || 0; const sourceHeight = media?.videoHeight || media?.naturalHeight || media?.height || 0; if (!sourceWidth || !sourceHeight) return;
    const scale = Math.max(width / sourceWidth, height / sourceHeight); const drawWidth = sourceWidth * scale; const drawHeight = sourceHeight * scale; ctx.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function paletteStops(settings) {
    const selected = COLOR_PALETTES[settings.paletteId];
    return selected?.stops?.length ? selected.stops : settings.customStops?.length >= 2 ? settings.customStops : [settings.colorA, settings.colorB];
  }

  function samplePalette(settings, amount = 0) {
    const stops = paletteStops(settings);
    if (stops.length === 1) return stops[0];
    const normalized = ((Number(amount) || 0) % 1 + 1) % 1;
    const scaled = normalized * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    const localAmount = scaled - index;
    const bucket = Math.round(localAmount * 48);
    const key = `${stops[index]}|${stops[index + 1]}|${bucket}`;
    if (!colorCache.has(key)) {
      if (colorCache.size > 1024) colorCache.clear();
      colorCache.set(key, mixHex(stops[index], stops[index + 1], bucket / 48));
    }
    return colorCache.get(key);
  }

  function segmentColor(stroke, segmentIndex, phase = 0) {
    if (stroke.settings.autoHue) {
      const hue = (segmentIndex * 2.4 + phase * 360 + Number(stroke.id.replace(/\D/g, "").slice(-5))) % 360;
      return `hsl(${hue} 96% 68%)`;
    }
    const point = stroke.points[segmentIndex] || stroke.points.at(-1);
    const previous = stroke.points[Math.max(0, segmentIndex - 1)] || point;
    let amount = (Math.sin(segmentIndex * 0.055 + phase * Math.PI * 2) + 1) / 2;
    if (stroke.settings.gradientFlow === "pressure") amount = clamp((point?.pressure || 0.5) + phase, 0, 1, 0.5);
    else if (stroke.settings.gradientFlow === "speed") {
      const distance = Math.hypot((point?.x || 0) - (previous?.x || 0), (point?.y || 0) - (previous?.y || 0));
      const elapsed = Math.max(1, (point?.time || 0) - (previous?.time || 0));
      amount = (Math.min(1, distance * 14000 / elapsed) + phase) % 1;
    }
    return samplePalette(stroke.settings, amount);
  }

  function profileFor(targetRuntime, settings, forceQuality = false) {
    if (forceQuality) return QUALITY_PROFILES.quality;
    if (targetRuntime?.isPlaying || targetRuntime?.exportingAnimation) return QUALITY_PROFILES.performance;
    if (settings.quality !== "auto") return resolveQualityProfile(settings.quality);
    return QUALITY_PROFILES[targetRuntime?.liveQuality] || QUALITY_PROFILES.balanced;
  }

  function transformsForRender(settings, qualityProfile) {
    const transforms = transformsForSettings(settings);
    const maxTransforms = qualityProfile.id === "quality" ? 96 : qualityProfile.id === "balanced" ? 48 : 24;
    if (transforms.length <= maxTransforms) return transforms;
    const stride = transforms.length / maxTransforms;
    return Array.from({ length: maxTransforms }, (_, index) => transforms[Math.floor(index * stride)]);
  }

  function segmentGeometry(previous, current, transforms, width, height) {
    return transforms.map((transform) => {
      const start = transformPoint(previous, transform);
      const end = transformPoint(current, transform);
      const sx = start.x * width;
      const sy = start.y * height;
      const ex = end.x * width;
      const ey = end.y * height;
      const length = Math.max(0.001, Math.hypot(ex - sx, ey - sy));
      return { sx, sy, ex, ey, nx: -(ey - sy) / length, ny: (ex - sx) / length, length };
    });
  }

  function traceGeometry(ctx, geometry, offset = 0, bend = 0, angular = false) {
    ctx.beginPath();
    geometry.forEach(({ sx, sy, ex, ey, nx, ny }) => {
      const startX = sx + nx * offset;
      const startY = sy + ny * offset;
      const endX = ex + nx * offset;
      const endY = ey + ny * offset;
      ctx.moveTo(startX, startY);
      if (angular) {
        ctx.lineTo((sx + ex) / 2 + nx * (offset + bend), (sy + ey) / 2 + ny * (offset + bend));
        ctx.lineTo(endX, endY);
      } else {
        ctx.quadraticCurveTo((sx + ex) / 2 + nx * bend, (sy + ey) / 2 + ny * bend, endX, endY);
      }
    });
    ctx.stroke();
  }

  function drawFiberSegment(ctx, previous, current, stroke, segmentIndex, width, height, scale = 1, qualityProfile = QUALITY_PROFILES.balanced) {
    const transforms = transformsForRender(stroke.settings, qualityProfile);
    const colors = [0, 0.18, 0.37, 0.58, 0.78].map((phase) => segmentColor(stroke, segmentIndex, phase));
    const speed = Math.hypot((current.x - previous.x) * width, (current.y - previous.y) * height);
    const rawPressure = stroke.settings.pressureEnabled ? (current.pressure || 0.5) : 0.5;
    const pressure = Math.pow(rawPressure, stroke.settings.pressureCurve || 1);
    const velocityRatio = Math.min(1, speed / 52);
    const velocityScale = 1 - stroke.settings.velocityWidth * velocityRatio * 0.58;
    const progress = segmentIndex / Math.max(1, stroke.points.length - 1);
    const startTaper = stroke.settings.taperStart > 0 ? Math.min(1, progress / stroke.settings.taperStart) : 1;
    const endTaper = stroke.complete && stroke.settings.taperEnd > 0 ? Math.min(1, (1 - progress) / stroke.settings.taperEnd) : 1;
    const taperScale = Math.max(0.08, Math.min(startTaper, endTaper));
    const audioBoost = 1 + (runtime?.audioLevel || 0) * 0.7;
    const baseWidth = stroke.settings.brushSize * (0.72 + pressure * 0.56) * velocityScale * taperScale * audioBoost * scale;
    const geometry = segmentGeometry(previous, current, transforms, width, height);
    if (stroke.settings.scatter > 0) geometry.forEach((item, index) => {
      const startScatter = Math.sin((segmentIndex - 1) * 12.9898 + index * 7.13) * stroke.settings.scatter * scale;
      const endScatter = Math.sin(segmentIndex * 12.9898 + index * 7.13) * stroke.settings.scatter * scale;
      item.sx += item.nx * startScatter; item.sy += item.ny * startScatter;
      item.ex += item.nx * endScatter; item.ey += item.ny * endScatter;
    });
    const mode = stroke.settings.brushMode || "silk";
    const speedFade = Math.max(0.48, 1 - speed / 90);
    const stylusAngle = ((current.twist || 0) + stroke.settings.rotation) * Math.PI / 180;
    const noiseWave = (Math.sin(segmentIndex * 4.913 + 1.37) + Math.sin(segmentIndex * 1.719)) * stroke.settings.noise * 2.2;
    const wave = Math.sin(segmentIndex * 0.32 + stylusAngle) * (0.55 + stroke.settings.curvature * 0.9) + noiseWave;
    const dynamicGlow = stroke.settings.glow * (1 + stroke.settings.velocityGlow * velocityRatio * 0.7) * audioBoost;
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : mode === "ink" ? "source-over" : mode === "nebula" ? "screen" : "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const paint = (color, widthFactor, alpha, blurFactor = 0.5, offset = 0, bend = 0, angular = false) => {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = stroke.erase ? 0 : dynamicGlow * scale * qualityProfile.blur * blurFactor;
      ctx.globalAlpha = Math.min(0.88, alpha * speedFade);
      ctx.lineWidth = Math.max(0.2, baseWidth * widthFactor);
      traceGeometry(ctx, geometry, offset * scale, bend * scale, angular);
    };
    const stampDots = (color, radius = 1, alpha = 0.3, spread = 0) => {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = dynamicGlow * scale * 0.55; ctx.globalAlpha = alpha;
      ctx.beginPath();
      geometry.forEach(({ ex, ey, nx, ny }, index) => {
        const drift = Math.sin(segmentIndex * 3.17 + index * 8.31) * spread * scale;
        const x = ex + nx * drift; const y = ey + ny * drift; const r = Math.max(0.35, radius * scale * (0.65 + ((segmentIndex + index) % 5) * 0.12));
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      });
      ctx.fill();
    };

    if (stroke.erase) {
      paint("#000000", 3.2, 0.92, 0, 0, 0);
    } else if (["silk", "lotus", "quantum", "galaxy"].includes(mode)) {
      const lotusBend = mode === "lotus" ? wave * 8 : wave * 2.2;
      paint(colors[0], mode === "quantum" ? 0.45 : 1, 0.18 + stroke.settings.flow * 0.3, 1, 0, lotusBend);
      const extra = mode === "quantum" ? 2 : stroke.settings.brushSize > 3 ? 1 : 0;
      const fiberCount = Math.min(7, qualityProfile.fibers + extra);
      for (let fiber = 0; fiber < fiberCount; fiber += 1) {
        const offset = (fiber - (fiberCount - 1) / 2) * (0.72 + baseWidth * (mode === "quantum" ? 0.55 : 0.34)) + Math.sin((segmentIndex + fiber) * 0.47) * 0.65;
        paint(colors[(fiber + 1) % colors.length], mode === "quantum" ? 0.22 : 0.2 + fiber * 0.035, 0.055 + stroke.settings.flow * 0.08, 0.44, offset, -offset * 0.45);
      }
      if (mode === "galaxy" && segmentIndex % (qualityProfile.id === "quality" ? 2 : 4) === 0) {
        ctx.fillStyle = colors[3];
        ctx.shadowColor = colors[3];
        ctx.shadowBlur = dynamicGlow * scale * 0.65;
        ctx.globalAlpha = 0.34 * qualityProfile.detail;
        ctx.beginPath();
        geometry.forEach(({ ex, ey, nx, ny }, index) => {
          const scatter = (2.5 + ((segmentIndex + index * 7) % 9)) * scale;
          const direction = ((segmentIndex + index) % 2 ? -1 : 1);
          ctx.moveTo(ex + nx * scatter * direction + 1.3 * scale, ey + ny * scatter * direction);
          ctx.arc(ex + nx * scatter * direction, ey + ny * scatter * direction, Math.max(0.45, baseWidth * 0.22), 0, Math.PI * 2);
        });
        ctx.fill();
      }
    } else if (mode === "aurora") {
      paint(colors[0], 5.2, 0.035 + stroke.settings.flow * 0.035, 1.2, wave * 3.5, wave * 8);
      paint(colors[2], 2.5, 0.075 + stroke.settings.flow * 0.05, 0.8, -wave * 2.5, -wave * 5);
      paint(colors[4], 0.48, 0.28, 0.4, 0, wave * 3);
    } else if (mode === "neon") {
      paint(colors[0], 3.8, 0.08 + stroke.settings.flow * 0.06, 1.25, 0, wave * 1.2);
      paint(colors[2], 1.25, 0.34, 0.8, 0, wave * 1.2);
      paint("#f4ffff", 0.28, 0.72, 0.22, 0, wave * 1.2);
    } else if (mode === "plasma") {
      paint(colors[0], 5.4, 0.045 + stroke.settings.flow * 0.04, 1.35, wave * 2.5, wave * 10);
      paint(colors[2], 2.8, 0.11, 0.9, -wave * 2, -wave * 7);
      paint(colors[4], 0.68, 0.4, 0.48, 0, wave * 4);
      paint("#ffffff", 0.18, 0.55, 0.15, 0, -wave * 2);
    } else if (mode === "electric") {
      const jag = (Math.sin(segmentIndex * 2.73) + Math.sin(segmentIndex * 0.91)) * (3.8 + stroke.settings.noise * 5);
      paint(colors[0], 3.2, 0.09, 1.2, 0, jag, true);
      paint(colors[2], 0.82, 0.54, 0.7, 0, jag, true);
      paint("#ffffff", 0.2, 0.78, 0.15, 0, jag, true);
      if (qualityProfile.detail > 0.4 && segmentIndex % 5 === 0) {
        ctx.strokeStyle = colors[3]; ctx.shadowColor = colors[3]; ctx.shadowBlur = dynamicGlow * 0.5 * scale; ctx.lineWidth = Math.max(0.25, baseWidth * 0.28); ctx.globalAlpha = 0.32;
        ctx.beginPath();
        geometry.forEach(({ sx, sy, ex, ey, nx, ny }, index) => {
          const mx = (sx + ex) / 2; const my = (sy + ey) / 2; const length = (5 + ((segmentIndex + index) % 8)) * scale;
          ctx.moveTo(mx, my); ctx.lineTo(mx + nx * length + (ex - sx) * 0.18, my + ny * length + (ey - sy) * 0.18);
        });
        ctx.stroke();
      }
    } else if (mode === "nebula") {
      paint(colors[0], 7.2, 0.025 + stroke.settings.flow * 0.025, 1.45, wave * 5, wave * 12);
      paint(colors[2], 4.1, 0.04 + stroke.settings.flow * 0.04, 1.05, -wave * 4, -wave * 8);
      paint(colors[4], 1.1, 0.14, 0.62, 0, wave * 4);
    } else if (mode === "prism" || mode === "rainbow") {
      const laneCount = qualityProfile.id === "performance" ? 3 : 5;
      for (let lane = 0; lane < laneCount; lane += 1) {
        const offset = (lane - (laneCount - 1) / 2) * baseWidth * 0.7;
        paint(colors[lane], mode === "rainbow" ? 0.58 : 0.4, 0.28 + stroke.settings.flow * 0.12, 0.62, offset, mode === "prism" ? wave * (lane + 2) : -offset * 0.3, mode === "prism");
      }
      paint("#ffffff", 0.12, 0.38, 0.14, 0, 0, mode === "prism");
    } else if (mode === "fire") {
      paint(colors[0], 4.8, 0.07, 1.3, wave * 2.5, wave * 7);
      paint(colors[1], 2.6, 0.16, 0.9, -wave * 1.5, -wave * 4);
      paint(colors[3], 0.85, 0.46, 0.48, 0, wave * 2);
      paint("#fff8d8", 0.22, 0.72, 0.12, 0, 0);
    } else if (mode === "comet") {
      paint(colors[1], 5.5, 0.055, 1.4, wave * 3, wave * 5);
      paint(colors[2], 2.2, 0.16, 0.85, 0, wave * 2);
      paint("#ffffff", 0.38, 0.7, 0.25, 0, 0);
      if (segmentIndex % (qualityProfile.id === "quality" ? 2 : 4) === 0) {
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = colors[0]; ctx.shadowBlur = dynamicGlow * scale; ctx.globalAlpha = 0.74;
        ctx.beginPath(); geometry.forEach(({ ex, ey }) => { ctx.moveTo(ex + baseWidth * 0.55, ey); ctx.arc(ex, ey, Math.max(0.65, baseWidth * 0.55), 0, Math.PI * 2); }); ctx.fill();
      }
    } else if (mode === "ripple") {
      const lanes = qualityProfile.id === "quality" ? 5 : 3;
      for (let lane = 0; lane < lanes; lane += 1) {
        const offset = (lane - (lanes - 1) / 2) * baseWidth * 1.25 + Math.sin(segmentIndex * 0.24 + lane) * 1.8;
        paint(colors[lane % colors.length], 0.34, 0.2 + stroke.settings.flow * 0.08, 0.48, offset, -offset * 0.5);
      }
    } else if (mode === "ink") {
      paint(colors[0], 2.4, 0.15 + stroke.settings.flow * 0.12, 0.35, wave * 1.4, wave * 3);
      paint(colors[2], 0.55, 0.5, 0.12, 0, -wave * 1.5);
    } else if (mode === "starfield") {
      paint(colors[0], 0.25, 0.28, 0.7, 0, wave * 1.5);
      if (segmentIndex % 2 === 0) stampDots(colors[2], 0.9 + baseWidth * 0.16, 0.58, 7);
      if (qualityProfile.detail > 0.4 && segmentIndex % 7 === 0) {
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.55 * scale; ctx.globalAlpha = 0.62; ctx.beginPath();
        geometry.forEach(({ ex, ey }) => { const r = 3.8 * scale; ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.moveTo(ex, ey - r); ctx.lineTo(ex, ey + r); }); ctx.stroke();
      }
    } else if (mode === "fireworks") {
      if (segmentIndex % 4 === 0) {
        ctx.strokeStyle = colors[segmentIndex % colors.length]; ctx.shadowColor = colors[2]; ctx.shadowBlur = dynamicGlow * scale; ctx.lineWidth = Math.max(0.3, baseWidth * 0.28); ctx.globalAlpha = 0.46; ctx.beginPath();
        geometry.forEach(({ ex, ey }, index) => { for (let ray = 0; ray < 6; ray += 1) { const angle = ray * Math.PI / 3 + index * 0.11; const radius = (4 + (segmentIndex % 9)) * scale; ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(angle) * radius, ey + Math.sin(angle) * radius); } }); ctx.stroke();
        stampDots(colors[4], 0.8, 0.62, 10);
      }
    } else if (mode === "spark") {
      paint(colors[1], 0.34, 0.4, 0.75, wave * 2, wave * 3);
      if (segmentIndex % 2 === 0) stampDots(colors[3], 0.75, 0.52, 12 + speed * 0.2);
    } else if (mode === "bokeh") {
      if (segmentIndex % (qualityProfile.id === "performance" ? 5 : 3) === 0) {
        ctx.globalCompositeOperation = "screen"; ctx.lineWidth = Math.max(0.6, baseWidth * 0.12); ctx.strokeStyle = colors[2]; ctx.fillStyle = colors[0]; ctx.shadowColor = colors[3]; ctx.shadowBlur = dynamicGlow * 0.7; ctx.globalAlpha = 0.12; ctx.beginPath();
        geometry.forEach(({ ex, ey }, index) => { const radius = (baseWidth * 1.2 + ((segmentIndex + index) % 7)) * scale; ctx.moveTo(ex + radius, ey); ctx.arc(ex, ey, radius, 0, Math.PI * 2); }); ctx.fill(); ctx.globalAlpha = 0.34; ctx.stroke();
      }
    } else if (mode === "meteor") {
      paint(colors[1], 5.2, 0.055, 1.25, wave * 2, 0);
      paint(colors[2], 1.2, 0.32, 0.65, 0, 0);
      paint("#ffffff", 0.2, 0.75, 0.15, 0, 0);
      if (segmentIndex % 3 === 0) stampDots(colors[3], 1.15, 0.7, 4);
    } else if (mode === "fluid") {
      ctx.globalCompositeOperation = "screen";
      const lanes = qualityProfile.id === "performance" ? 3 : 5;
      for (let lane = 0; lane < lanes; lane += 1) { const offset = Math.sin(segmentIndex * 0.18 + lane * 1.7) * baseWidth * 1.6; paint(colors[lane], 1.1 + lane * 0.38, 0.045 + lane * 0.016, 0.7, offset, -offset * 1.3); }
      paint(colors[4], 0.32, 0.34, 0.25, 0, wave * 4);
    } else if (mode === "magnetic") {
      const centerPull = Math.sin(segmentIndex * 0.14) * Math.min(width, height) * 0.018;
      for (let lane = -2; lane <= 2; lane += qualityProfile.id === "performance" ? 2 : 1) paint(colors[(lane + 5) % colors.length], 0.22, 0.22, 0.55, lane * baseWidth * 1.2, centerPull + lane * 2);
    } else if (mode === "gravity") {
      ctx.strokeStyle = colors[segmentIndex % colors.length]; ctx.shadowColor = colors[2]; ctx.shadowBlur = dynamicGlow * scale; ctx.lineWidth = Math.max(0.25, baseWidth * 0.48); ctx.globalAlpha = 0.3; ctx.beginPath();
      geometry.forEach(({ sx, sy, ex, ey }) => { const cx = width / 2; const cy = height / 2; const radius = Math.max(2, (Math.hypot(sx - cx, sy - cy) + Math.hypot(ex - cx, ey - cy)) / 2); const a1 = Math.atan2(sy - cy, sx - cx); const a2 = Math.atan2(ey - cy, ex - cx); ctx.arc(cx, cy, radius, a1, a2, false); }); ctx.stroke();
      if (segmentIndex % 4 === 0) stampDots("#ffffff", 0.75, 0.58, 2);
    } else if (mode === "turbulence") {
      ctx.globalCompositeOperation = "screen";
      for (let lane = 0; lane < (qualityProfile.id === "performance" ? 2 : 4); lane += 1) { const turbulence = Math.sin(segmentIndex * (0.2 + lane * 0.07) + lane) * (8 + lane * 4); paint(colors[lane], 3.8 - lane * 0.6, 0.035 + lane * 0.018, 1.1, turbulence * 0.4, turbulence); }
    } else if (mode === "liquid-plasma") {
      paint(colors[0], 5.8, 0.045, 1.35, wave * 3, wave * 9);
      paint(colors[2], 2.4, 0.14, 0.85, -wave * 2, -wave * 6);
      paint("#ffffff", 0.22, 0.58, 0.18, 0, 0);
      if (segmentIndex % 3 === 0) stampDots(colors[4], Math.max(1, baseWidth * 0.55), 0.28, 5);
    } else if (mode === "spirograph") {
      paint(colors[0], 0.35, 0.34, 0.65, 0, wave * 7);
      if (segmentIndex % 3 === 0) { ctx.strokeStyle = colors[3]; ctx.lineWidth = Math.max(0.22, baseWidth * 0.2); ctx.globalAlpha = 0.22; ctx.beginPath(); geometry.forEach(({ ex, ey }, index) => { const r = (3 + ((segmentIndex + index) % 8)) * scale; ctx.moveTo(ex + r, ey); ctx.arc(ex, ey, r, 0, Math.PI * 2); }); ctx.stroke(); }
    } else if (mode === "harmonograph") {
      const damping = Math.max(0.2, 1 - segmentIndex / Math.max(80, stroke.points.length));
      for (let lane = -2; lane <= 2; lane += 1) paint(colors[lane + 2], 0.28, 0.2, 0.5, lane * baseWidth, Math.sin(segmentIndex * (0.11 + Math.abs(lane) * 0.025)) * 10 * damping);
    } else if (mode === "lissajous") {
      const xWave = Math.sin(segmentIndex * 0.21) * 9; const yWave = Math.sin(segmentIndex * 0.34 + Math.PI / 2) * 9;
      paint(colors[0], 0.45, 0.34, 0.7, xWave, yWave);
      paint(colors[3], 0.2, 0.28, 0.35, -xWave, -yWave);
    } else if (mode === "flower-life") {
      paint(colors[0], 0.24, 0.24, 0.55, 0, wave * 5);
      if (segmentIndex % 4 === 0) { ctx.strokeStyle = colors[2]; ctx.shadowColor = colors[2]; ctx.shadowBlur = dynamicGlow * 0.45; ctx.lineWidth = Math.max(0.2, baseWidth * 0.18); ctx.globalAlpha = 0.25; ctx.beginPath(); geometry.forEach(({ ex, ey }) => { const r = Math.max(4, baseWidth * 3.2) * scale; ctx.moveTo(ex + r, ey); ctx.arc(ex, ey, r, 0, Math.PI * 2); }); ctx.stroke(); }
    } else if (mode === "voronoi") {
      ctx.strokeStyle = colors[segmentIndex % colors.length]; ctx.shadowColor = colors[1]; ctx.shadowBlur = dynamicGlow * 0.4; ctx.lineWidth = Math.max(0.25, baseWidth * 0.32); ctx.globalAlpha = 0.32; ctx.beginPath();
      geometry.forEach(({ sx, sy, ex, ey, nx, ny }, index) => { const edge = (4 + ((segmentIndex + index) % 9)) * scale; ctx.moveTo(sx, sy); ctx.lineTo((sx + ex) / 2 + nx * edge, (sy + ey) / 2 + ny * edge); ctx.lineTo(ex, ey); ctx.lineTo((sx + ex) / 2 - nx * edge, (sy + ey) / 2 - ny * edge); ctx.closePath(); }); ctx.stroke();
    } else if (mode === "jellyfish") {
      paint(colors[0], 3.6, 0.055, 1.1, 0, wave * 6);
      paint(colors[2], 0.48, 0.38, 0.52, 0, -wave * 3);
      if (segmentIndex % 5 === 0) { ctx.strokeStyle = colors[3]; ctx.lineWidth = Math.max(0.2, baseWidth * 0.16); ctx.globalAlpha = 0.28; ctx.beginPath(); geometry.forEach(({ ex, ey, nx, ny }, index) => { const length = (8 + index % 7) * scale; ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + nx * length, ey + ny * length, ex - ny * length * 1.6, ey + nx * length * 1.6); }); ctx.stroke(); }
    } else if (mode === "coral") {
      paint(colors[0], 0.72, 0.38, 0.65, 0, wave * 2);
      if (segmentIndex % 4 === 0) { ctx.strokeStyle = colors[2]; ctx.shadowColor = colors[2]; ctx.shadowBlur = dynamicGlow * 0.5; ctx.lineWidth = Math.max(0.25, baseWidth * 0.38); ctx.globalAlpha = 0.34; ctx.beginPath(); geometry.forEach(({ sx, sy, ex, ey, nx, ny }) => { const mx = (sx + ex) / 2; const my = (sy + ey) / 2; const branch = (6 + segmentIndex % 10) * scale; ctx.moveTo(mx, my); ctx.lineTo(mx + nx * branch, my + ny * branch); ctx.moveTo(mx, my); ctx.lineTo(mx - nx * branch * 0.7, my - ny * branch * 0.7); }); ctx.stroke(); }
    } else if (mode === "vine") {
      paint(colors[1], 0.65, 0.36, 0.55, 0, wave * 5);
      if (segmentIndex % 5 === 0) { ctx.fillStyle = colors[0]; ctx.globalAlpha = 0.28; ctx.beginPath(); geometry.forEach(({ ex, ey, nx, ny }) => { ctx.ellipse(ex + nx * 4, ey + ny * 4, Math.max(1.5, baseWidth), Math.max(3, baseWidth * 2.2), Math.atan2(ny, nx), 0, Math.PI * 2); }); ctx.fill(); }
    } else if (mode === "feather") {
      paint(colors[0], 0.54, 0.35, 0.58, 0, wave * 3);
      ctx.strokeStyle = colors[2]; ctx.lineWidth = Math.max(0.2, baseWidth * 0.16); ctx.globalAlpha = 0.2; ctx.beginPath(); geometry.forEach(({ sx, sy, ex, ey, nx, ny }, index) => { const mx = (sx + ex) / 2; const my = (sy + ey) / 2; const barb = (5 + index % 6) * scale; ctx.moveTo(mx, my); ctx.lineTo(mx + nx * barb - (ex - sx) * 0.25, my + ny * barb - (ey - sy) * 0.25); ctx.moveTo(mx, my); ctx.lineTo(mx - nx * barb - (ex - sx) * 0.25, my - ny * barb - (ey - sy) * 0.25); }); ctx.stroke();
    } else if (mode === "butterfly") {
      paint(colors[0], 0.32, 0.28, 0.62, wave * 2, wave * 5);
      if (segmentIndex % 5 === 0) { ctx.strokeStyle = colors[3]; ctx.lineWidth = Math.max(0.2, baseWidth * 0.2); ctx.globalAlpha = 0.3; ctx.beginPath(); geometry.forEach(({ ex, ey, nx, ny }) => { const r = (5 + baseWidth) * scale; ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + nx * r, ey + ny * r, ex + ny * r, ey - nx * r); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex - nx * r, ey - ny * r, ex - ny * r, ey + nx * r); }); ctx.stroke(); }
    } else if (mode === "calligraphy") {
      const tilt = Math.min(1, Math.hypot(current.tiltX || 0, current.tiltY || 0) / 70);
      paint(colors[0], 2.6 + tilt * 2.2, 0.15, 0.85, wave * baseWidth, wave * 2);
      paint(colors[3], 0.34, 0.58, 0.28, -wave * baseWidth * 0.5, 0);
    } else if (mode === "dry-ink") {
      ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([Math.max(1, baseWidth * 0.7), Math.max(1, baseWidth * (0.3 + stroke.settings.noise))]); ctx.lineDashOffset = segmentIndex % 9;
      paint(colors[0], 1.8, 0.3 + pressure * 0.25, 0.08, 0, noiseWave * 1.5); ctx.setLineDash([]);
      if (segmentIndex % 3 === 0) stampDots(colors[2], 0.65, 0.18, baseWidth * 1.4);
    } else if (mode === "watercolor") {
      ctx.globalCompositeOperation = "screen";
      paint(colors[0], 7.5, 0.018, 0.22, wave * 2, wave * 8); paint(colors[2], 5.2, 0.025, 0.18, -wave * 2, -wave * 5); paint(colors[4], 1.1, 0.08, 0.08, 0, wave * 2);
      if (segmentIndex % 4 === 0) stampDots(colors[1], Math.max(1, baseWidth * 0.9), 0.045, 6);
    } else if (mode === "oil") {
      ctx.globalCompositeOperation = "overlay";
      paint(colors[0], 3.4, 0.28, 0.18, baseWidth * 0.4, wave * 2); paint(colors[2], 2.3, 0.3, 0.12, -baseWidth * 0.35, -wave * 2); paint(colors[4], 0.42, 0.42, 0.08, 0, 0);
    } else if (mode === "chalk") {
      ctx.globalCompositeOperation = "screen"; paint(colors[0], 1.6, 0.16, 0.12, 0, noiseWave * 2);
      if (segmentIndex % 2 === 0) stampDots(colors[2], 0.5 + baseWidth * 0.12, 0.2, baseWidth * 2.2);
    } else if (mode === "pixel") {
      ctx.fillStyle = colors[segmentIndex % colors.length]; ctx.shadowColor = colors[2]; ctx.shadowBlur = dynamicGlow * 0.45; ctx.globalAlpha = 0.48; const size = Math.max(1, Math.round(baseWidth * 1.3));
      geometry.forEach(({ ex, ey }) => ctx.fillRect(Math.round(ex / size) * size, Math.round(ey / size) * size, size, size));
    } else if (mode === "glitch") {
      const block = Math.max(2, baseWidth * 1.4); ctx.globalAlpha = 0.34;
      geometry.forEach(({ ex, ey }, index) => { const shift = ((segmentIndex + index) % 7 - 3) * scale; ctx.fillStyle = "#ff357f"; ctx.fillRect(ex - shift, ey - block / 2, block * 2, block * 0.55); ctx.fillStyle = "#36efff"; ctx.fillRect(ex + shift, ey, block * 2.4, block * 0.55); });
    } else if (mode === "hologram") {
      paint(colors[0], 0.34, 0.34, 0.9, 0, 0);
      for (let scan = -2; scan <= 2; scan += 1) paint(scan % 2 ? colors[2] : colors[4], 0.13, 0.18, 0.3, scan * baseWidth * 1.5 + (segmentIndex % 3), 0);
    } else if (mode === "laser") {
      paint(colors[0], 5, 0.07, 1.4, 0, 0, true); paint(colors[2], 0.8, 0.62, 0.85, 0, 0, true); paint("#ffffff", 0.16, 0.9, 0.1, 0, 0, true);
    } else if (mode === "chromatic") {
      paint("#ff315e", 0.5, 0.38, 0.5, -baseWidth * 1.1, wave * 2); paint("#42f5ff", 0.5, 0.38, 0.5, baseWidth * 1.1, -wave * 2); paint("#8d63ff", 0.36, 0.36, 0.35, 0, wave); paint("#ffffff", 0.14, 0.5, 0.08, 0, 0);
    }
    ctx.restore();
  }

  function drawMinimap(targetRuntime = runtime) {
    const minimap = targetRuntime?.root?.querySelector("[data-draw-minimap]"); if (!minimap) return; const view = targetRuntime.project.view; minimap.hidden = view.zoom <= 1.01 && Math.abs(view.panX) < 0.01 && Math.abs(view.panY) < 0.01; if (minimap.hidden) return; const ctx = minimap.getContext("2d"); ctx.clearRect(0, 0, minimap.width, minimap.height); ctx.globalAlpha = 0.72; ctx.drawImage(targetRuntime.canvas, 0, 0, minimap.width, minimap.height); ctx.globalAlpha = 1; const boxWidth = minimap.width / view.zoom; const boxHeight = minimap.height / view.zoom; const x = (minimap.width - boxWidth) / 2 - view.panX * minimap.width / view.zoom; const y = (minimap.height - boxHeight) / 2 - view.panY * minimap.height / view.zoom; ctx.strokeStyle = "#78efff"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, boxWidth, boxHeight);
  }

  function handleMinimapPointer(event, targetRuntime = runtime) {
    const rect = event.currentTarget.getBoundingClientRect(); targetRuntime.project.view.panX = clamp(0.5 - (event.clientX - rect.left) / rect.width, -4, 4, 0); targetRuntime.project.view.panY = clamp(0.5 - (event.clientY - rect.top) / rect.height, -4, 4, 0); renderAll(targetRuntime); drawGuides(targetRuntime); syncViewUi(targetRuntime); scheduleSave(targetRuntime);
  }

  function drawSilkLinks(ctx, stroke, segmentIndex, width, height, scale = 1, qualityProfile = QUALITY_PROFILES.balanced) {
    const current = stroke.points[segmentIndex];
    const mode = stroke.settings.brushMode || "silk";
    if (!current || stroke.erase || segmentIndex < 5 || !["silk", "lotus", "quantum", "galaxy"].includes(mode)) return;
    const color = segmentColor(stroke, segmentIndex);
    const transforms = transformsForRender(stroke.settings, qualityProfile);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.2, stroke.settings.brushSize * (mode === "quantum" ? 0.14 : 0.22) * scale);
    ctx.globalAlpha = (0.035 + stroke.settings.flow * 0.045) * (mode === "quantum" ? 1.45 : 1);
    ctx.shadowColor = color;
    ctx.shadowBlur = stroke.settings.glow * 0.3 * scale * qualityProfile.blur;
    for (const offset of qualityProfile.linkOffsets) {
      const older = stroke.points[segmentIndex - offset];
      if (!older) continue;
      const distance = Math.hypot((current.x - older.x) * width, (current.y - older.y) * height);
      if (distance > Math.min(width, height) * 0.22) continue;
      ctx.beginPath();
      transforms.forEach((transform) => { const start = transformPoint(older, transform); const end = transformPoint(current, transform); ctx.moveTo(start.x * width, start.y * height); ctx.lineTo(end.x * width, end.y * height); });
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderStroke(ctx, stroke, width, height, scale = 1, qualityProfile = QUALITY_PROFILES.balanced, startAt = 1, endAt = stroke.points.length, stride = 1) {
    const step = Math.max(1, Math.round(stride));
    for (let index = Math.max(1, startAt); index < Math.min(stroke.points.length, endAt); index += step) {
      drawFiberSegment(ctx, stroke.points[Math.max(0, index - step)], stroke.points[index], stroke, index, width, height, scale, qualityProfile);
      drawSilkLinks(ctx, stroke, index, width, height, scale, qualityProfile);
    }
  }

  function createRenderCanvas(pixelWidth, pixelHeight) {
    const canvas = typeof globalScope.OffscreenCanvas === "function"
      ? new globalScope.OffscreenCanvas(pixelWidth, pixelHeight)
      : globalScope.document?.createElement?.("canvas");
    if (!canvas) return null;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    return canvas;
  }

  function clearLayerCache(targetRuntime = runtime) {
    targetRuntime?.layerCache?.clear?.();
  }

  function ensureRenderWorker(targetRuntime = runtime) {
    if (!targetRuntime || targetRuntime.renderWorker || typeof globalScope.Worker !== "function" || typeof globalScope.OffscreenCanvas !== "function") return Boolean(targetRuntime?.renderWorker);
    try {
      const worker = new globalScope.Worker("draw-studio-worker.js?v=5");
      worker.onmessage = (event) => {
        const message = event.data || {}; if (message.requestId !== targetRuntime.workerRequestId || runtime !== targetRuntime) { (message.layers || []).forEach((item) => item.bitmap?.close?.()); return; }
        targetRuntime.workerBusy = false;
        if (message.type !== "render-layers-complete") { announce("Worker render lỗi · chuyển sang chế độ an toàn", targetRuntime); renderAll(targetRuntime); return; }
        const pixelWidth = targetRuntime.canvas.width; const pixelHeight = targetRuntime.canvas.height; const cacheKey = `${pixelWidth}x${pixelHeight}|${targetRuntime.dpr}`;
        for (const item of message.layers || []) { const layer = targetRuntime.project.layers.find((entry) => entry.id === item.id); if (!layer || layer.revision !== item.revision) { item.bitmap?.close?.(); continue; } const buffer = createRenderCanvas(pixelWidth, pixelHeight); const context = buffer?.getContext?.("2d"); if (context) { context.drawImage(item.bitmap, 0, 0); targetRuntime.layerCache.set(layer.id, { canvas: buffer, revision: layer.revision, cacheKey }); } item.bitmap?.close?.(); }
        renderAll(targetRuntime); announce("Đã dựng lại project bằng worker", targetRuntime);
      };
      worker.onerror = () => { targetRuntime.workerBusy = false; targetRuntime.renderWorker?.terminate?.(); targetRuntime.renderWorker = null; };
      targetRuntime.renderWorker = worker; return true;
    } catch { return false; }
  }

  function renderProjectSafely(targetRuntime = runtime) {
    if (!targetRuntime) return;
    const renderCost = projectRenderCost(targetRuntime.project, targetRuntime.liveQuality);
    if ((projectPointCount(targetRuntime.project) <= 2500 && renderCost <= 12000) || !ensureRenderWorker(targetRuntime)) { renderAll(targetRuntime); return; }
    targetRuntime.workerRequestId += 1; targetRuntime.workerBusy = true; announce("Đang dựng layer nền · giao diện vẫn hoạt động", targetRuntime);
    targetRuntime.renderWorker.postMessage({ type: "render-layers", requestId: targetRuntime.workerRequestId, project: targetRuntime.project, pixelWidth: targetRuntime.canvas.width, pixelHeight: targetRuntime.canvas.height, ratio: targetRuntime.dpr, quality: targetRuntime.liveQuality });
  }

  function renderLayerBuffer(layer, targetRuntime, width, height, ratio, scale, forceQuality, depth = 0, playbackState = null) {
    if (!layer?.visible) return null;
    const cacheable = !forceQuality && !playbackState && depth === 0 && targetRuntime?.layerCache;
    const cacheKey = `${Math.round(width * ratio)}x${Math.round(height * ratio)}|${ratio}`;
    const cached = cacheable ? targetRuntime.layerCache.get(layer.id) : null;
    if (cached?.revision === layer.revision && cached.cacheKey === cacheKey) return cached.canvas;
    const buffer = createRenderCanvas(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
    const layerCtx = buffer?.getContext?.("2d");
    if (!layerCtx) return null;
    layerCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    layerCtx.clearRect(0, 0, width, height);
    layerCtx.save();
    if (layer.mask?.length >= 3) {
      layerCtx.beginPath(); layer.mask.forEach((point, index) => { const x = point.x * width; const y = point.y * height; if (!index) layerCtx.moveTo(x, y); else layerCtx.lineTo(x, y); }); layerCtx.closePath(); layerCtx.clip();
    }
    for (const child of layer.children || []) {
      const childBuffer = renderLayerBuffer(child, targetRuntime, width, height, ratio, scale, forceQuality, depth + 1, playbackState);
      if (!childBuffer) continue;
      layerCtx.save();
      layerCtx.globalAlpha = child.opacity;
      layerCtx.globalCompositeOperation = child.blendMode;
      layerCtx.drawImage(childBuffer, 0, 0, width, height);
      layerCtx.restore();
    }
    for (const stroke of layer.strokes || []) {
      if (!playbackState) renderStroke(layerCtx, stroke, width, height, scale, profileFor(targetRuntime, stroke.settings, forceQuality));
      else {
        const segments = Math.max(0, stroke.points.length - 1); const allowed = Math.min(segments, Math.max(0, playbackState.remaining));
        if (allowed > 0) { const animatedStroke = playbackState.keyframe ? { ...stroke, settings: normalizeSettings({ ...stroke.settings, colorA: playbackState.keyframe.colorA, colorB: playbackState.keyframe.colorB, paletteId: "custom", customStops: [playbackState.keyframe.colorA, playbackState.keyframe.colorB], glow: playbackState.keyframe.glow, symmetry: playbackState.keyframe.symmetry }) } : stroke; renderStroke(layerCtx, animatedStroke, width, height, scale, profileFor(targetRuntime, animatedStroke.settings, false), 1, allowed + 1, playbackState.stride); }
        playbackState.remaining -= segments;
      }
    }
    layerCtx.restore();
    if (cacheable) targetRuntime.layerCache.set(layer.id, { canvas: buffer, revision: layer.revision, cacheKey });
    return buffer;
  }

  function applyCameraTransform(ctx, width, height, view) {
    if (!view) return;
    ctx.translate(width / 2 + view.panX * width, height / 2 + view.panY * height);
    ctx.rotate(view.rotation * Math.PI / 180);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-width / 2, -height / 2);
  }

  function renderAll(targetRuntime = runtime, { targetCanvas, includeBackground = false, scale = 1, playbackProgress = null } = {}) {
    if (!targetRuntime) return;
    const canvas = targetCanvas || targetRuntime.canvas;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return;
    const width = canvas.width / (targetCanvas ? 1 : targetRuntime.dpr);
    const height = canvas.height / (targetCanvas ? 1 : targetRuntime.dpr);
    const ratio = targetCanvas ? 1 : targetRuntime.dpr;
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (includeBackground) backgroundFill(ctx, width, height, targetRuntime.project.settings.background);
    if (targetRuntime.backgroundMedia?.element) drawMediaCover(ctx, targetRuntime.backgroundMedia.element, width, height);
    const normalizedProgress = playbackProgress === null ? null : clamp(playbackProgress, 0, 1, 0); const animationKeyframe = normalizedProgress === null ? null : resolveAnimationKeyframe(targetRuntime.project.animation, normalizedProgress);
    if (!targetCanvas || normalizedProgress !== null) applyCameraTransform(ctx, width, height, animationKeyframe ? { ...targetRuntime.project.view, zoom: animationKeyframe.zoom, rotation: animationKeyframe.rotation } : targetRuntime.project.view);
    const totalSegments = playbackProgress === null ? 0 : projectStrokes(targetRuntime.project, { visibleOnly: true }).reduce((sum, stroke) => sum + Math.max(0, stroke.points.length - 1), 0);
    const playbackState = playbackProgress === null ? null : { remaining: Math.floor(totalSegments * normalizedProgress), stride: Math.max(1, Math.ceil(totalSegments / 900)), keyframe: animationKeyframe };
    for (const layer of targetRuntime.project.layers) {
      const buffer = renderLayerBuffer(layer, targetRuntime, width, height, ratio, scale, Boolean(targetCanvas), 0, playbackState);
      if (!buffer) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(buffer, 0, 0, width, height);
      ctx.restore();
    }
    ctx.restore();
    // The minimap mirrors the fully composited frame. Updating it once here is
    // both correct and dramatically cheaper than doing work for every segment.
    if (!targetCanvas) drawMinimap(targetRuntime);
  }

  function drawGuides(targetRuntime = runtime) {
    if (!targetRuntime?.guideCanvas) return;
    const canvas = targetRuntime.guideCanvas;
    const ctx = canvas.getContext("2d");
    const width = canvas.width / targetRuntime.dpr;
    const height = canvas.height / targetRuntime.dpr;
    ctx.setTransform(targetRuntime.dpr, 0, 0, targetRuntime.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!targetRuntime.project.settings.guides) return;
    const radius = Math.min(width, height) * 0.33;
    ctx.save();
    applyCameraTransform(ctx, width, height, targetRuntime.project.view);
    ctx.translate(width / 2, height / 2);
    if (targetRuntime.project.settings.grid) {
      ctx.save(); ctx.translate(-width / 2, -height / 2); ctx.setLineDash([]); ctx.strokeStyle = "rgba(111,189,238,.075)"; ctx.lineWidth = 1;
      const step = Math.max(24, Math.min(width, height) / 12); ctx.beginPath(); for (let x = 0; x <= width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); } for (let y = 0; y <= height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); } ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = "rgba(143,203,255,.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    for (let index = 0; index < targetRuntime.project.settings.symmetry; index += 1) {
      const angle = (Math.PI * 2 * index) / targetRuntime.project.settings.symmetry;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function resizeCanvases(targetRuntime = runtime) {
    if (!targetRuntime?.canvas?.isConnected) return;
    const rect = targetRuntime.canvas.getBoundingClientRect();
    const dpr = Math.min(2, Math.max(1, globalScope.devicePixelRatio || 1));
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(320, Math.round(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (targetRuntime.dpr === dpr && targetRuntime.canvas.width === pixelWidth && targetRuntime.canvas.height === pixelHeight) return;
    targetRuntime.dpr = dpr;
    [targetRuntime.canvas, targetRuntime.guideCanvas].forEach((canvas) => { canvas.width = pixelWidth; canvas.height = pixelHeight; });
    clearLayerCache(targetRuntime);
    renderProjectSafely(targetRuntime);
    drawGuides(targetRuntime);
  }

  function scheduleResize(targetRuntime = runtime) {
    if (!targetRuntime) return;
    globalScope.cancelAnimationFrame?.(targetRuntime.resizeFrame);
    targetRuntime.resizeFrame = globalScope.requestAnimationFrame?.(() => { targetRuntime.resizeFrame = 0; resizeCanvases(targetRuntime); });
  }

  function updateUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const strokes = projectStrokes(targetRuntime.project).length;
    targetRuntime.root.querySelectorAll("[data-draw-undo]").forEach((button) => { button.disabled = !targetRuntime.historyUndo.length; });
    targetRuntime.root.querySelectorAll("[data-draw-redo]").forEach((button) => { button.disabled = !targetRuntime.historyRedo.length; });
    const empty = targetRuntime.root.querySelector("[data-draw-empty]");
    if (empty) empty.hidden = Boolean(strokes || targetRuntime.activeStroke);
    const stats = targetRuntime.root.querySelector("[data-draw-stats]");
    if (stats) stats.textContent = `${strokes} nét · ${targetRuntime.project.layers.length} layer · ${targetRuntime.saved ? "đã tự lưu" : targetRuntime.saveFailed ? "lưu thất bại" : "đang lưu"}`;
    const saveState = targetRuntime.root.querySelector("[data-draw-save-state]");
    if (saveState) { const state = targetRuntime.saved ? "saved" : targetRuntime.saveFailed ? "failed" : "saving"; saveState.textContent = state === "saved" ? "Đã tự lưu" : state === "failed" ? "Lưu thất bại" : "Đang lưu…"; saveState.dataset.state = state; }
    const historyCount = targetRuntime.root.querySelector("[data-draw-history-count]");
    if (historyCount) historyCount.textContent = `${targetRuntime.historyUndo.length} thao tác`;
    const dockLayers = targetRuntime.root.querySelector("[data-draw-dock-layers]");
    if (dockLayers) dockLayers.textContent = `${targetRuntime.project.layers.length} lớp`;
    const performance = targetRuntime.root.querySelector("[data-draw-performance]");
    if (performance) {
      const labels = { quality: "Chất lượng cao", balanced: "Cân bằng", performance: "Ưu tiên tốc độ" };
      const selected = targetRuntime.project.settings.quality;
      performance.textContent = selected === "auto" ? `Auto · ${labels[targetRuntime.liveQuality] || "Cân bằng"}` : labels[selected];
    }
    const engine = targetRuntime.root.querySelector("[data-draw-engine]");
    if (engine) {
      const cost = Number(targetRuntime.paintCost || 0);
      const worker = typeof globalScope.OffscreenCanvas === "function" ? "Worker" : "Canvas";
      engine.textContent = cost ? `${worker} · ${cost.toFixed(1)} ms · hàng đợi ${targetRuntime.pointQueue.length}` : `${worker} · sẵn sàng`;
      engine.dataset.tone = cost > 12 ? "hot" : cost > 7 ? "warm" : "cool";
    }
  }

  function syncLayoutUi(targetRuntime = runtime, { resize = true } = {}) {
    if (!targetRuntime?.root) return;
    const layout = normalizeLayout(targetRuntime.layout);
    targetRuntime.layout = layout;
    targetRuntime.root.classList.toggle("is-toolrail-collapsed", layout.toolrailCollapsed);
    targetRuntime.root.classList.toggle("is-inspector-collapsed", layout.inspectorCollapsed);
    targetRuntime.root.classList.toggle("is-dock-collapsed", layout.dockCollapsed);
    targetRuntime.root.classList.toggle("is-compact-controls", layout.compactControls);
    targetRuntime.root.querySelectorAll("[data-draw-layout-toggle]").forEach((button) => {
      const key = button.dataset.drawLayoutToggle;
      const active = key === "toolrail" ? !layout.toolrailCollapsed : key === "inspector" ? !layout.inspectorCollapsed : key === "dock" ? !layout.dockCollapsed : false;
      button.setAttribute("aria-pressed", String(active));
      const labels = { toolrail: "thanh công cụ", inspector: "bảng thuộc tính", dock: "thanh studio" };
      if (labels[key]) button.setAttribute("aria-label", `${active ? "Thu gọn" : "Mở"} ${labels[key]}`);
    });
    if (resize) scheduleResize(targetRuntime);
  }

  function changeLayout(action, targetRuntime = runtime) {
    if (!targetRuntime) return;
    const layoutKeys = { toolrail: "toolrailCollapsed", inspector: "inspectorCollapsed", dock: "dockCollapsed", compact: "compactControls" };
    const key = layoutKeys[action] || action;
    if (action === "reset") {
      targetRuntime.layout = { ...DEFAULT_LAYOUT };
      targetRuntime.inspectorState = normalizeInspectorState();
      targetRuntime.activeDrawer = "";
      saveInspectorState(targetRuntime);
      syncInspectorUi(targetRuntime);
    }
    else if (Object.hasOwn(targetRuntime.layout, key)) targetRuntime.layout[key] = !targetRuntime.layout[key];
    else return;
    syncLayoutUi(targetRuntime);
    saveLayout(targetRuntime);
    toast(action === "reset" ? "Đã đặt lại bố cục studio" : "Đã cập nhật bố cục làm việc", targetRuntime);
  }

  function syncInspectorUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    targetRuntime.inspectorState = normalizeInspectorState(targetRuntime.inspectorState);
    const state = targetRuntime.inspectorState;
    targetRuntime.root.querySelectorAll("[data-draw-inspector-tab]").forEach((button) => {
      const active = button.dataset.drawInspectorTab === state.activeTab;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    targetRuntime.root.querySelectorAll("[data-draw-inspector-panel]").forEach((panel) => { panel.hidden = panel.dataset.drawInspectorPanel !== state.activeTab; });
    targetRuntime.root.querySelectorAll("[data-draw-accordion]").forEach((section) => {
      const id = section.dataset.drawAccordion;
      const tab = INSPECTOR_TABS.find((candidate) => INSPECTOR_GROUPS[candidate].includes(id));
      const open = state.pinnedGroups.includes(id) || state.openGroups[tab] === id;
      const pinned = state.pinnedGroups.includes(id);
      section.classList.toggle("is-open", open);
      section.classList.toggle("is-pinned", pinned);
      section.querySelector("[data-draw-accordion-toggle]")?.setAttribute("aria-expanded", String(open));
      const body = section.querySelector(".draw-accordion-body"); if (body) body.hidden = !open;
      const pin = section.querySelector("[data-draw-accordion-pin]");
      if (pin) { pin.setAttribute("aria-pressed", String(pinned)); pin.textContent = pinned ? "◆" : "◇"; pin.title = pinned ? "Bỏ ghim nhóm" : "Ghim nhóm này"; }
    });
    targetRuntime.root.querySelectorAll("[data-draw-drawer]").forEach((drawer) => {
      const active = drawer.dataset.drawDrawer === targetRuntime.activeDrawer;
      drawer.hidden = !active;
      drawer.classList.toggle("is-open", active);
      drawer.setAttribute("aria-hidden", String(!active));
    });
    targetRuntime.root.classList.toggle("is-context-drawer-open", Boolean(targetRuntime.activeDrawer));
    const title = targetRuntime.root.querySelector("[data-draw-inspector-title]");
    if (title) title.textContent = targetRuntime.activeDrawer ? ({ brushes: "Thư viện Brush", colors: "Color Studio" })[targetRuntime.activeDrawer] : ({ tool: targetRuntime.tool === "eraser" ? "Công cụ Tẩy" : "Công cụ Bút", object: "Đối tượng đã chọn", layer: "Layer Studio", document: "Thiết lập tài liệu" })[state.activeTab];
  }

  function setInspectorTab(tab, targetRuntime = runtime, options = {}) {
    if (!targetRuntime || !INSPECTOR_TABS.includes(tab)) return false;
    targetRuntime.inspectorState.activeTab = tab;
    if (options.group && INSPECTOR_GROUPS[tab].includes(options.group)) targetRuntime.inspectorState.openGroups[tab] = options.group;
    if (options.closeDrawer !== false) targetRuntime.activeDrawer = "";
    if (options.reveal) {
      targetRuntime.layout.inspectorCollapsed = false;
      syncLayoutUi(targetRuntime);
      saveLayout(targetRuntime);
      if (globalScope.matchMedia?.("(max-width: 900px)")?.matches) targetRuntime.root.classList.add("is-panel-open");
    }
    saveInspectorState(targetRuntime);
    syncInspectorUi(targetRuntime);
    if (options.focus) targetRuntime.root.querySelector(`[data-draw-inspector-tab="${tab}"]`)?.focus({ preventScroll: true });
    return true;
  }

  function toggleInspectorAccordion(groupId, targetRuntime = runtime) {
    if (!targetRuntime) return false;
    const tab = INSPECTOR_TABS.find((candidate) => INSPECTOR_GROUPS[candidate].includes(groupId));
    if (!tab) return false;
    const pinned = targetRuntime.inspectorState.pinnedGroups.includes(groupId);
    targetRuntime.inspectorState.openGroups[tab] = !pinned && targetRuntime.inspectorState.openGroups[tab] === groupId ? "" : groupId;
    saveInspectorState(targetRuntime); syncInspectorUi(targetRuntime); return true;
  }

  function toggleInspectorPin(groupId, targetRuntime = runtime) {
    if (!targetRuntime) return false;
    const allGroups = Object.values(INSPECTOR_GROUPS).flat(); if (!allGroups.includes(groupId)) return false;
    const pinned = targetRuntime.inspectorState.pinnedGroups;
    if (pinned.includes(groupId)) targetRuntime.inspectorState.pinnedGroups = pinned.filter((id) => id !== groupId);
    else if (pinned.length >= 2) { toast("Chỉ có thể ghim tối đa hai nhóm", targetRuntime); return false; }
    else targetRuntime.inspectorState.pinnedGroups = [...pinned, groupId];
    saveInspectorState(targetRuntime); syncInspectorUi(targetRuntime); return true;
  }

  function openInspectorDrawer(drawerId, targetRuntime = runtime, opener = null) {
    if (!targetRuntime || !["brushes", "colors"].includes(drawerId)) return false;
    targetRuntime.drawerOpener = opener || globalScope.document?.activeElement || null;
    targetRuntime.activeDrawer = drawerId;
    targetRuntime.layout.inspectorCollapsed = false;
    syncLayoutUi(targetRuntime); saveLayout(targetRuntime); syncInspectorUi(targetRuntime);
    if (globalScope.matchMedia?.("(max-width: 900px)")?.matches) targetRuntime.root.classList.add("is-panel-open");
    globalScope.requestAnimationFrame?.(() => targetRuntime.root.querySelector(`[data-draw-drawer="${drawerId}"] [data-draw-drawer-close]`)?.focus({ preventScroll: true }));
    return true;
  }

  function closeInspectorDrawer(targetRuntime = runtime, { restoreFocus = true } = {}) {
    if (!targetRuntime?.activeDrawer) return false;
    targetRuntime.activeDrawer = ""; syncInspectorUi(targetRuntime);
    if (restoreFocus && targetRuntime.drawerOpener?.isConnected) targetRuntime.drawerOpener.focus?.({ preventScroll: true });
    targetRuntime.drawerOpener = null; return true;
  }

  function jumpToPanel(sectionId, targetRuntime = runtime) {
    if (!targetRuntime?.root || !["layers", "brushes", "colors", "canvas", "export"].includes(sectionId)) return false;
    const routes = { layers: ["layer", "layer-studio"], canvas: ["document", "document-canvas"], export: ["document", "document-export"] };
    if (sectionId === "brushes" || sectionId === "colors") openInspectorDrawer(sectionId, targetRuntime, globalScope.document?.activeElement);
    else setInspectorTab(routes[sectionId][0], targetRuntime, { group: routes[sectionId][1], reveal: true, focus: true });
    targetRuntime.root.querySelectorAll("[data-draw-jump]").forEach((button) => button.classList.toggle("is-active", button.dataset.drawJump === sectionId));
    announce(`Đã mở ${({ layers: "Layer Studio", brushes: "thư viện brush", colors: "bảng màu", canvas: "thiết lập canvas", export: "khu vực xuất bản" })[sectionId]}`, targetRuntime);
    return true;
  }

  function announce(message, targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const status = targetRuntime.root.querySelector("[data-draw-status]");
    if (status) status.textContent = message;
  }

  function toast(message, targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const node = targetRuntime.root.querySelector("[data-draw-toast]");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-visible");
    globalScope.clearTimeout(targetRuntime.toastTimer);
    targetRuntime.toastTimer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function applyPrimaryColor(value, targetRuntime = runtime) {
    if (!targetRuntime || !isHex(value)) { toast("Mã màu phải theo dạng #RRGGBB", targetRuntime); return false; }
    const selected = normalizeHex(value, targetRuntime.project.settings.colorA);
    const stops = [...targetRuntime.project.settings.customStops]; stops[0] = selected;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorA: selected, customStops: stops, paletteId: "custom" });
    syncControls(targetRuntime); syncGradientEditor(targetRuntime); scheduleSave(targetRuntime); announce(`Màu chính ${selected.toUpperCase()}`, targetRuntime); return true;
  }

  async function copyPrimaryColor(targetRuntime = runtime) {
    if (!targetRuntime) return;
    try { await globalScope.navigator?.clipboard?.writeText(targetRuntime.project.settings.colorA.toUpperCase()); toast("Đã sao chép mã HEX", targetRuntime); }
    catch { toast("Trình duyệt chưa cho phép sao chép màu", targetRuntime); }
  }

  async function pastePrimaryColor(targetRuntime = runtime) {
    if (!targetRuntime) return;
    try { const value = String(await globalScope.navigator?.clipboard?.readText?.()).trim(); if (applyPrimaryColor(value, targetRuntime)) toast("Đã dán màu từ clipboard", targetRuntime); }
    catch { toast("Trình duyệt chưa cho phép đọc clipboard", targetRuntime); }
  }

  async function pickPrimaryColor(targetRuntime = runtime) {
    if (!targetRuntime) return;
    if (typeof globalScope.EyeDropper !== "function") { toast("Eyedropper chưa được trình duyệt này hỗ trợ", targetRuntime); return; }
    try { const result = await new globalScope.EyeDropper().open(); if (result?.sRGBHex) applyPrimaryColor(result.sRGBHex, targetRuntime); }
    catch { /* Người dùng đóng công cụ lấy màu. */ }
  }

  function scheduleSave(targetRuntime = runtime) {
    if (!targetRuntime) return;
    targetRuntime.userChangedProject = true;
    targetRuntime.saved = false;
    targetRuntime.saveFailed = false;
    updateUi(targetRuntime);
    globalScope.clearTimeout(targetRuntime.saveTimer);
    targetRuntime.saveTimer = globalScope.setTimeout(() => {
      targetRuntime.saved = storageWrite(targetRuntime.storageKey, targetRuntime.project);
      targetRuntime.saveFailed = !targetRuntime.saved;
      updateUi(targetRuntime);
    }, 280);
  }

  function saveNow(targetRuntime = runtime) {
    if (!targetRuntime) return false;
    globalScope.clearTimeout(targetRuntime.saveTimer);
    targetRuntime.saveTimer = 0;
    targetRuntime.userChangedProject = true;
    targetRuntime.saved = storageWrite(targetRuntime.storageKey, targetRuntime.project);
    targetRuntime.saveFailed = !targetRuntime.saved;
    updateUi(targetRuntime);
    if (targetRuntime.saved) {
      scheduleCheckpoint(targetRuntime, "Lưu thủ công");
      toast("Đã lưu project an toàn", targetRuntime);
      announce("Project đã được lưu", targetRuntime);
    } else {
      toast("Không thể lưu project trên thiết bị này", targetRuntime);
      announce("Lưu project thất bại", targetRuntime);
    }
    return targetRuntime.saved;
  }

  function projectSnapshot(project) {
    return JSON.stringify(project);
  }

  function pushHistory(targetRuntime, entry = { kind: "snapshot", value: projectSnapshot(targetRuntime.project) }) {
    if (!targetRuntime) return;
    const historyEntry = typeof entry === "string" ? { kind: "snapshot", value: entry } : entry;
    const previous = targetRuntime.historyUndo.at(-1);
    if (historyEntry?.kind !== "snapshot" || previous?.kind !== "snapshot" || previous.value !== historyEntry.value) targetRuntime.historyUndo.push(historyEntry);
    const pointCount = projectPointCount(targetRuntime.project);
    const historyLimit = pointCount > 50000 ? 8 : pointCount > 12000 ? 20 : MAX_HISTORY;
    while (targetRuntime.historyUndo.length > historyLimit) targetRuntime.historyUndo.shift();
    targetRuntime.historyRedo.length = 0;
    targetRuntime.historyActionCount = (targetRuntime.historyActionCount || 0) + 1;
    if (targetRuntime.historyActionCount % 5 === 0) scheduleCheckpoint(targetRuntime, "Tự động sau 5 thao tác");
    updateUi(targetRuntime);
  }

  function restoreSnapshot(targetRuntime, snapshot) {
    try {
      targetRuntime.project = normalizeProject(JSON.parse(snapshot));
      clearLayerCache(targetRuntime);
      targetRuntime.activeStroke = null;
      targetRuntime.drawing = false;
      targetRuntime.root.classList.remove("is-drawing");
      syncControls(targetRuntime);
      renderProjectSafely(targetRuntime);
      drawGuides(targetRuntime);
      scheduleSave(targetRuntime);
      return true;
    } catch { return false; }
  }

  function pointerPoint(event, targetRuntime = runtime, inputRect = null) {
    const rect = inputRect || targetRuntime.drawRect || targetRuntime.canvas.getBoundingClientRect();
    const view = targetRuntime.project.view;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const screenX = event.clientX - rect.left - centerX - view.panX * rect.width;
    const screenY = event.clientY - rect.top - centerY - view.panY * rect.height;
    const angle = -view.rotation * Math.PI / 180;
    let localX = (screenX * Math.cos(angle) - screenY * Math.sin(angle)) / view.zoom + centerX;
    let localY = (screenX * Math.sin(angle) + screenY * Math.cos(angle)) / view.zoom + centerY;
    if (targetRuntime.project.settings.snapCenter && Math.hypot(localX - centerX, localY - centerY) < 10 / view.zoom) { localX = centerX; localY = centerY; }
    return normalizePoint({
      x: localX / rect.width,
      y: localY / rect.height,
      pressure: event.pressure > 0 ? event.pressure : event.pointerType === "mouse" ? 0.5 : 0.42,
      time: globalScope.performance?.now?.() || Date.now(),
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      twist: event.twist || 0,
      pointerType: event.pointerType || "mouse"
    });
  }

  function updateBrushCursor(event, targetRuntime = runtime) {
    const cursor = targetRuntime?.root?.querySelector("[data-draw-brush-cursor]");
    if (!cursor || event.pointerType === "touch") return;
    const rect = targetRuntime.canvas.getBoundingClientRect();
    const size = Math.max(8, targetRuntime.project.settings.brushSize * 4 + targetRuntime.project.settings.scatter * 2);
    cursor.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
    cursor.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
    cursor.style.setProperty("--cursor-size", `${size}px`);
    cursor.style.setProperty("--cursor-color", samplePalette(targetRuntime.project.settings, 0.42));
    cursor.classList.add("is-visible");
  }

  function beginStroke(event, targetRuntime = runtime) {
    const stylusErase = targetRuntime?.project.settings.stylusEraser && (event.button === 5 || event.buttons === 32);
    if (!targetRuntime) return;
    if (event.pointerType === "touch") {
      targetRuntime.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (targetRuntime.touchPointers.size >= 2) {
        if (targetRuntime.drawing || targetRuntime.activeStroke) { targetRuntime.drawing = false; targetRuntime.activeStroke = null; targetRuntime.activeLayerBuffer = null; targetRuntime.pointQueue.length = 0; targetRuntime.pendingHistory = ""; targetRuntime.root.classList.remove("is-drawing"); clearLayerCache(targetRuntime); renderProjectSafely(targetRuntime); }
        const points = [...targetRuntime.touchPointers.values()].slice(0, 2); const dx = points[1].x - points[0].x; const dy = points[1].y - points[0].y;
        targetRuntime.gesture = { distance: Math.max(1, Math.hypot(dx, dy)), angle: Math.atan2(dy, dx), centerX: (points[0].x + points[1].x) / 2, centerY: (points[0].y + points[1].y) / 2, view: { ...targetRuntime.project.view } };
        targetRuntime.canvas.setPointerCapture?.(event.pointerId); event.preventDefault(); announce("Pinch để zoom, xoay và di chuyển", targetRuntime); return;
      }
    }
    if (targetRuntime.drawing || targetRuntime.panning) return;
    if (targetRuntime.workerBusy) { toast("Đang dựng lại layer nền · thử vẽ sau một nhịp", targetRuntime); return; }
    const shouldPan = targetRuntime.spacePressed || targetRuntime.tool === "pan" || event.button === 1 || (event.pointerType === "touch" && !targetRuntime.project.settings.touchDraw);
    if (shouldPan) {
      event.preventDefault(); targetRuntime.canvas.setPointerCapture?.(event.pointerId); targetRuntime.panning = true;
      targetRuntime.panStart = { x: event.clientX, y: event.clientY, panX: targetRuntime.project.view.panX, panY: targetRuntime.project.view.panY };
      targetRuntime.root.classList.add("is-panning"); announce("Đang di chuyển canvas…", targetRuntime); return;
    }
    if (targetRuntime.tool === "select") { beginSelection(event, targetRuntime); return; }
    if (event.button > 0 && !stylusErase) return;
    const layer = activeLayer(targetRuntime.project);
    if (!layer || layer.locked || !layer.visible) {
      toast(layer?.locked ? "Layer đang khóa · hãy mở khóa để vẽ" : "Layer đang ẩn · hãy bật hiển thị để vẽ", targetRuntime);
      return;
    }
    event.preventDefault();
    targetRuntime.canvas.setPointerCapture?.(event.pointerId);
    targetRuntime.drawRect = targetRuntime.canvas.getBoundingClientRect();
    targetRuntime.pointQueue.length = 0;
    const point = pointerPoint(event, targetRuntime, targetRuntime.drawRect);
    const logicalWidth = targetRuntime.canvas.width / targetRuntime.dpr;
    const logicalHeight = targetRuntime.canvas.height / targetRuntime.dpr;
    targetRuntime.activeLayerBuffer = renderLayerBuffer(layer, targetRuntime, logicalWidth, logicalHeight, targetRuntime.dpr, 1, false);
    targetRuntime.activeStroke = { id: `stroke-${Date.now()}-${Math.round(Math.random() * 1e5)}`, layerId: layer.id, settings: normalizeSettings(targetRuntime.project.settings), points: [point], complete: false, erase: Boolean(stylusErase || targetRuntime.tool === "eraser"), createdAt: Date.now() };
    targetRuntime.drawing = true;
    targetRuntime.root.classList.add("is-drawing");
    announce("Đang dệt ánh sáng…", targetRuntime);
    updateUi(targetRuntime);
  }

  function updateAdaptiveQuality(targetRuntime, cost) {
    targetRuntime.paintCost = targetRuntime.paintCost ? targetRuntime.paintCost * 0.82 + cost * 0.18 : cost;
    targetRuntime.root.style.setProperty("--draw-latency", Math.min(1, targetRuntime.paintCost / 18).toFixed(3));
    updateUi(targetRuntime);
    if (targetRuntime.project.settings.quality !== "auto") return;
    if (targetRuntime.paintCost > 10 && targetRuntime.liveQuality !== "performance") {
      targetRuntime.liveQuality = "performance";
      targetRuntime.fastFrames = 0;
      updateUi(targetRuntime);
      return;
    }
    targetRuntime.fastFrames = targetRuntime.paintCost < 4.5 ? targetRuntime.fastFrames + 1 : 0;
    if (targetRuntime.liveQuality === "performance" && targetRuntime.fastFrames > 45) {
      targetRuntime.liveQuality = "balanced";
      targetRuntime.fastFrames = 0;
      updateUi(targetRuntime);
    }
  }

  function flushPointQueue(targetRuntime = runtime, force = false) {
    if (!targetRuntime?.drawing || !targetRuntime.activeStroke || !targetRuntime.pointQueue.length) return;
    const startedAt = globalScope.performance?.now?.() || Date.now();
    const stroke = targetRuntime.activeStroke;
    const rect = targetRuntime.drawRect || targetRuntime.canvas.getBoundingClientRect();
    const qualityProfile = profileFor(targetRuntime, stroke.settings);
    const frameBudget = qualityProfile.id === "quality" ? 24 : qualityProfile.id === "balanced" ? 16 : 10;
    const queued = force ? targetRuntime.pointQueue.splice(0) : targetRuntime.pointQueue.splice(0, frameBudget);
    const points = force && queued.length > frameBudget
      ? Array.from({ length: frameBudget }, (_, index) => queued[Math.round(index * (queued.length - 1) / Math.max(1, frameBudget - 1))])
      : queued;
    const paintCanvas = targetRuntime.activeLayerBuffer || targetRuntime.canvas;
    const ctx = paintCanvas.getContext("2d");
    ctx.setTransform(targetRuntime.dpr, 0, 0, targetRuntime.dpr, 0, 0);
    for (const inputPoint of points) {
      let previous = stroke.points.at(-1);
      const beforePrevious = stroke.points.at(-2) || previous;
      const stability = stroke.settings.stabilizer / 100;
      const response = Math.max(0.08, (1 - stability * 0.88) * (0.68 + stroke.settings.elasticity * 0.32));
      const inertiaX = previous.x + (previous.x - beforePrevious.x) * stroke.settings.inertia;
      const inertiaY = previous.y + (previous.y - beforePrevious.y) * stroke.settings.inertia;
      const rawPoint = normalizePoint({
        ...inputPoint,
        x: inertiaX + (inputPoint.x - inertiaX) * response,
        y: inertiaY + (inputPoint.y - inertiaY) * response
      });
      const distance = Math.hypot((rawPoint.x - previous.x) * rect.width, (rawPoint.y - previous.y) * rect.height);
      if (distance < stroke.settings.spacing) continue;
      const subdivisions = Math.min(3, Math.max(1, Math.ceil(distance / 10)));
      for (let step = 1; step <= subdivisions; step += 1) {
        if (stroke.points.length >= MAX_POINTS_PER_STROKE) break;
        const amount = step / subdivisions;
        const point = normalizePoint({
          x: previous.x + (rawPoint.x - previous.x) * amount,
          y: previous.y + (rawPoint.y - previous.y) * amount,
          pressure: previous.pressure + (rawPoint.pressure - previous.pressure) * amount,
          time: previous.time + (rawPoint.time - previous.time) * amount,
          tiltX: previous.tiltX + (rawPoint.tiltX - previous.tiltX) * amount,
          tiltY: previous.tiltY + (rawPoint.tiltY - previous.tiltY) * amount,
          twist: previous.twist + (rawPoint.twist - previous.twist) * amount,
          pointerType: rawPoint.pointerType
        });
        stroke.points.push(point);
        const segmentIndex = stroke.points.length - 1;
        drawFiberSegment(ctx, stroke.points[segmentIndex - 1], point, stroke, segmentIndex, rect.width, rect.height, 1, qualityProfile);
        drawSilkLinks(ctx, stroke, segmentIndex, rect.width, rect.height, 1, qualityProfile);
        previous = point;
      }
    }
    if (targetRuntime.activeLayerBuffer) renderAll(targetRuntime);
    updateAdaptiveQuality(targetRuntime, (globalScope.performance?.now?.() || Date.now()) - startedAt);
    if (!force && targetRuntime.pointQueue.length && !targetRuntime.drawFrame) targetRuntime.drawFrame = globalScope.requestAnimationFrame?.(() => { targetRuntime.drawFrame = 0; flushPointQueue(targetRuntime); });
  }

  function appendPoint(event, targetRuntime = runtime) {
    updateBrushCursor(event, targetRuntime);
    if (event.pointerType === "touch" && targetRuntime?.touchPointers.has(event.pointerId)) targetRuntime.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (targetRuntime?.gesture && targetRuntime.touchPointers.size >= 2) {
      const points = [...targetRuntime.touchPointers.values()].slice(0, 2); const dx = points[1].x - points[0].x; const dy = points[1].y - points[0].y; const distance = Math.max(1, Math.hypot(dx, dy)); const angle = Math.atan2(dy, dx); const centerX = (points[0].x + points[1].x) / 2; const centerY = (points[0].y + points[1].y) / 2; const rect = targetRuntime.canvas.getBoundingClientRect();
      targetRuntime.project.view.zoom = clamp(targetRuntime.gesture.view.zoom * distance / targetRuntime.gesture.distance, 0.25, 8, 1); targetRuntime.project.view.rotation = clamp(targetRuntime.gesture.view.rotation + (angle - targetRuntime.gesture.angle) * 180 / Math.PI, -180, 180, 0); targetRuntime.project.view.panX = clamp(targetRuntime.gesture.view.panX + (centerX - targetRuntime.gesture.centerX) / rect.width, -4, 4, 0); targetRuntime.project.view.panY = clamp(targetRuntime.gesture.view.panY + (centerY - targetRuntime.gesture.centerY) / rect.height, -4, 4, 0); renderAll(targetRuntime); drawGuides(targetRuntime); syncViewUi(targetRuntime); return;
    }
    if (targetRuntime?.selecting) { updateSelection(event, targetRuntime); return; }
    if (targetRuntime?.panning && targetRuntime.panStart) {
      const rect = targetRuntime.canvas.getBoundingClientRect();
      targetRuntime.project.view.panX = clamp(targetRuntime.panStart.panX + (event.clientX - targetRuntime.panStart.x) / rect.width, -4, 4, 0);
      targetRuntime.project.view.panY = clamp(targetRuntime.panStart.panY + (event.clientY - targetRuntime.panStart.y) / rect.height, -4, 4, 0);
      renderAll(targetRuntime); drawGuides(targetRuntime); syncViewUi(targetRuntime); return;
    }
    if (!targetRuntime?.drawing || !targetRuntime.activeStroke) return;
    const coalescedEvents = event.getCoalescedEvents?.();
    const events = coalescedEvents?.length ? coalescedEvents : [event];
    events.forEach((item) => targetRuntime.pointQueue.push(pointerPoint(item, targetRuntime, targetRuntime.drawRect)));
    if (targetRuntime.pointQueue.length > 192) targetRuntime.pointQueue.splice(0, targetRuntime.pointQueue.length - 192);
    if (!targetRuntime.drawFrame) targetRuntime.drawFrame = globalScope.requestAnimationFrame?.(() => { targetRuntime.drawFrame = 0; flushPointQueue(targetRuntime); });
  }

  function finishStroke(event, targetRuntime = runtime) {
    if (event.pointerType === "touch") targetRuntime?.touchPointers.delete(event.pointerId);
    if (targetRuntime?.gesture) { if (targetRuntime.touchPointers.size < 2) { targetRuntime.gesture = null; scheduleSave(targetRuntime); announce("Đã cập nhật góc nhìn", targetRuntime); } return; }
    if (targetRuntime?.selecting) { finishSelection(event, targetRuntime); return; }
    if (targetRuntime?.panning) {
      try { if (Number(event.pointerId) >= 0) targetRuntime.canvas.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
      targetRuntime.panning = false; targetRuntime.panStart = null; targetRuntime.root.classList.remove("is-panning"); scheduleSave(targetRuntime); announce("Đã di chuyển canvas", targetRuntime); return;
    }
    if (!targetRuntime?.drawing) return;
    globalScope.cancelAnimationFrame?.(targetRuntime.drawFrame);
    targetRuntime.drawFrame = 0;
    flushPointQueue(targetRuntime, true);
    try { if (Number(event.pointerId) >= 0) targetRuntime.canvas.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released by the browser. */ }
    const stroke = targetRuntime.activeStroke;
    targetRuntime.drawing = false;
    targetRuntime.activeStroke = null;
    targetRuntime.drawRect = null;
    targetRuntime.root.classList.remove("is-drawing");
    if (stroke?.points.length > 1) {
      const layer = targetRuntime.project.layers.find((item) => item.id === stroke.layerId) || activeLayer(targetRuntime.project);
      stroke.complete = true;
      layer.strokes.push(stroke);
      if (layer.strokes.length > MAX_STROKES) layer.strokes.shift();
      layer.revision += 1;
      const cacheEntry = targetRuntime.layerCache.get(layer.id);
      if (cacheEntry?.canvas === targetRuntime.activeLayerBuffer) cacheEntry.revision = layer.revision;
      pushHistory(targetRuntime, { kind: "stroke-add", layerId: layer.id, stroke: normalizeStroke(JSON.parse(JSON.stringify(stroke))) });
      renderAll(targetRuntime);
      syncLayerPanel(targetRuntime);
      scheduleSave(targetRuntime);
      announce("Nét vẽ đã hoàn tất", targetRuntime);
    } else { announce("Chạm và kéo để bắt đầu", targetRuntime); }
    targetRuntime.activeLayerBuffer = null;
    updateUi(targetRuntime);
  }

  function undo(targetRuntime = runtime) {
    const entry = targetRuntime?.historyUndo.pop();
    if (!entry) return;
    if (entry.kind === "stroke-add") {
      const layer = targetRuntime.project.layers.find((item) => item.id === entry.layerId);
      if (!layer) return;
      const index = layer.strokes.findIndex((stroke) => stroke.id === entry.stroke.id);
      if (index < 0) return;
      layer.strokes.splice(index, 1); layer.revision += 1; targetRuntime.historyRedo.push(entry); clearLayerCache(targetRuntime); renderProjectSafely(targetRuntime); syncLayerPanel(targetRuntime); scheduleSave(targetRuntime); announce("Đã hoàn tác nét vẽ", targetRuntime); return;
    }
    targetRuntime.historyRedo.push({ kind: "snapshot", value: projectSnapshot(targetRuntime.project) });
    if (restoreSnapshot(targetRuntime, entry.value || entry)) announce("Đã hoàn tác thao tác", targetRuntime);
  }

  function redo(targetRuntime = runtime) {
    const entry = targetRuntime?.historyRedo.pop();
    if (!entry) return;
    if (entry.kind === "stroke-add") {
      const layer = targetRuntime.project.layers.find((item) => item.id === entry.layerId);
      if (!layer || layer.strokes.some((stroke) => stroke.id === entry.stroke.id)) return;
      layer.strokes.push(normalizeStroke(entry.stroke)); layer.revision += 1; targetRuntime.historyUndo.push(entry); clearLayerCache(targetRuntime); renderProjectSafely(targetRuntime); syncLayerPanel(targetRuntime); scheduleSave(targetRuntime); announce("Đã làm lại nét vẽ", targetRuntime); return;
    }
    targetRuntime.historyUndo.push({ kind: "snapshot", value: projectSnapshot(targetRuntime.project) });
    if (restoreSnapshot(targetRuntime, entry.value || entry)) announce("Đã làm lại thao tác", targetRuntime);
  }

  function clearDrawing(targetRuntime = runtime) {
    const strokeCount = projectStrokes(targetRuntime?.project).length;
    if (!strokeCount || globalScope.confirm?.("Tạo bản vẽ mới? Các layer và nét hiện tại sẽ được đưa vào lịch sử hoàn tác.") !== false) {
      pushHistory(targetRuntime);
      const layer = createLayer("Ánh sáng", "stroke");
      targetRuntime.project.layers = [layer];
      targetRuntime.project.activeLayerId = layer.id;
      renderAll(targetRuntime);
      syncLayerPanel(targetRuntime);
      scheduleSave(targetRuntime);
      announce("Bản vẽ mới đã sẵn sàng", targetRuntime);
      toast("Đã tạo canvas mới · có thể Làm lại để khôi phục nét gần nhất", targetRuntime);
    }
  }

  function extensionFor(format) { return format === "jpeg" ? "jpg" : format; }

  function exportDimensions(targetRuntime, scaleOverride = null) {
    const settings = targetRuntime.project.settings; const rect = targetRuntime.canvas.getBoundingClientRect(); const preset = CANVAS_PRESETS[settings.canvasPreset]; const baseWidth = settings.canvasPreset === "viewport" ? Math.max(320, Math.round(rect.width)) : settings.canvasPreset === "custom" ? settings.canvasWidth : preset.width; const baseHeight = settings.canvasPreset === "viewport" ? Math.max(320, Math.round(rect.height)) : settings.canvasPreset === "custom" ? settings.canvasHeight : preset.height; const requestedScale = scaleOverride || settings.exportScale; const memory = Number(globalScope.navigator?.deviceMemory); const maxPixels = Number.isFinite(memory) && memory <= 4 ? 12_000_000 : 32_000_000; const safeScale = Math.min(requestedScale, Math.sqrt(maxPixels / Math.max(1, baseWidth * baseHeight))); return { width: Math.max(1, Math.round(baseWidth * safeScale)), height: Math.max(1, Math.round(baseHeight * safeScale)), requestedScale, safeScale, renderScale: Math.min(baseWidth * safeScale / Math.max(1, rect.width), baseHeight * safeScale / Math.max(1, rect.height)) };
  }

  function exportCanvas(targetRuntime = runtime, { copy = false } = {}) {
    if (!targetRuntime?.canvas) return Promise.resolve(false);
    const settings = targetRuntime.project.settings;
    const dimensions = exportDimensions(targetRuntime);
    const canvas = globalScope.document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    renderAll(targetRuntime, { targetCanvas: canvas, includeBackground: true, scale: dimensions.renderScale });
    const mime = settings.exportFormat === "jpeg" ? "image/jpeg" : `image/${settings.exportFormat}`;
    return new Promise((resolve) => canvas.toBlob(async (blob) => {
      if (!blob) { toast("Không thể tạo ảnh trên trình duyệt này.", targetRuntime); resolve(false); return; }
      if (copy) {
        try {
          if (!globalScope.ClipboardItem || !globalScope.navigator?.clipboard?.write) throw new Error("unsupported");
          const pngBlob = mime === "image/png" ? blob : await new Promise((done) => canvas.toBlob(done, "image/png"));
          await globalScope.navigator.clipboard.write([new globalScope.ClipboardItem({ "image/png": pngBlob })]);
          toast("Đã sao chép ảnh PNG vào clipboard", targetRuntime); resolve(true); return;
        } catch { toast("Clipboard ảnh chưa được trình duyệt cấp quyền. Hãy dùng Tải ảnh.", targetRuntime); resolve(false); return; }
      }
       downloadBlob(blob, `hh-chromatic-${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionFor(settings.exportFormat)}`);
       const limited = dimensions.safeScale + 0.01 < dimensions.requestedScale; toast(`Đã xuất ${settings.exportFormat.toUpperCase()} ${canvas.width}×${canvas.height}${limited ? " · đã giới hạn an toàn để tránh treo tab" : ""}`, targetRuntime); resolve(true);
    }, mime, settings.exportFormat === "jpeg" ? 0.94 : 0.92));
  }

  function exportSvg(targetRuntime = runtime) {
    if (!targetRuntime) return;
    const dimensions = exportDimensions(targetRuntime, 1); const width = dimensions.width; const height = dimensions.height; const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`];
    if (targetRuntime.project.settings.background !== "transparent") parts.push(`<rect width="100%" height="100%" fill="${targetRuntime.project.settings.background === "black" ? "#020205" : targetRuntime.project.settings.background === "midnight" ? "#081127" : "#05091b"}"/>`);
    let pointBudget = 120000;
    for (const layer of targetRuntime.project.layers) {
      if (!layer.visible) continue; parts.push(`<g opacity="${layer.opacity}" style="mix-blend-mode:${layer.blendMode === "source-over" ? "normal" : layer.blendMode}">`);
      for (const stroke of layerStrokes(layer)) {
        const transforms = transformsForRender(stroke.settings, QUALITY_PROFILES.quality); const stride = Math.max(1, Math.ceil(stroke.points.length * transforms.length / Math.max(1, pointBudget))); const color = segmentColor(stroke, Math.floor(stroke.points.length / 2));
        for (const transform of transforms) { const points = stroke.points.filter((_, index) => index % stride === 0 || index === stroke.points.length - 1).map((point) => transformPoint(point, transform)); if (points.length < 2) continue; pointBudget -= points.length; const data = points.map((point, index) => `${index ? "L" : "M"}${(point.x * width).toFixed(2)} ${(point.y * height).toFixed(2)}`).join(" "); parts.push(`<path d="${data}" fill="none" stroke="${color}" stroke-width="${Math.max(0.2, stroke.settings.brushSize * dimensions.renderScale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`); if (pointBudget <= 0) break; }
        if (pointBudget <= 0) break;
      }
      parts.push("</g>"); if (pointBudget <= 0) break;
    }
    parts.push("</svg>"); downloadBlob(new Blob([parts.join("")], { type: "image/svg+xml" }), `hh-chromatic-${Date.now()}.svg`); toast(pointBudget <= 0 ? "Đã xuất SVG tối ưu theo ngân sách an toàn" : "Đã xuất SVG vector", targetRuntime);
  }

  async function exportLayers(targetRuntime = runtime) {
    if (!targetRuntime) return; const dimensions = exportDimensions(targetRuntime, 1); const originalLayers = targetRuntime.project.layers;
    try {
      for (let index = 0; index < originalLayers.length; index += 1) { const layer = originalLayers[index]; if (!layer.visible) continue; const canvas = globalScope.document.createElement("canvas"); canvas.width = dimensions.width; canvas.height = dimensions.height; targetRuntime.project.layers = [layer]; renderAll(targetRuntime, { targetCanvas: canvas, includeBackground: false, scale: dimensions.renderScale }); const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png")); if (blob) downloadBlob(blob, `${String(index + 1).padStart(2, "0")}-${layer.name.replace(/[^a-z0-9_-]/gi, "-")}.png`); await new Promise((resolve) => globalScope.setTimeout(resolve, 80)); }
      toast("Đã xuất từng layer PNG", targetRuntime);
    } finally { targetRuntime.project.layers = originalLayers; }
  }

  function exportProject(targetRuntime = runtime) {
    if (!targetRuntime) return;
    const blob = new Blob([JSON.stringify({ ...targetRuntime.project, updatedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = globalScope.document.createElement("a");
    anchor.href = url; anchor.download = `hh-draw-project-${Date.now()}.json`; anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    toast("Đã xuất project JSON có thể chỉnh sửa tiếp", targetRuntime);
  }

  function exportBrushPreset(targetRuntime = runtime) {
    if (!targetRuntime) return; const settings = targetRuntime.project.settings; const { background, canvasPreset, canvasWidth, canvasHeight, exportScale, exportFormat, quality, guides, grid, ...brush } = settings; downloadBlob(new Blob([JSON.stringify({ schema: "hh.draw.brush.v1", name: PRESETS[settings.preset]?.label || "HH Custom Brush", settings: brush }, null, 2)], { type: "application/json" }), `hh-brush-${Date.now()}.json`); toast("Đã xuất preset brush", targetRuntime);
  }

  async function importBrushPreset(file, targetRuntime = runtime) {
    if (!file || file.size > 512 * 1024) { toast("Preset brush không hợp lệ hoặc lớn hơn 512 KB", targetRuntime); return; }
    try { const data = JSON.parse(await file.text()); if (data.schema !== "hh.draw.brush.v1" || !data.settings) throw new Error("schema"); targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, ...data.settings }); syncControls(targetRuntime); syncGradientEditor(targetRuntime); drawGuides(targetRuntime); scheduleSave(targetRuntime); toast(`Đã nhập preset ${String(data.name || "brush").slice(0, 60)}`, targetRuntime); } catch { toast("Không thể đọc preset brush này", targetRuntime); }
  }

  async function importProject(file, targetRuntime = runtime) {
    if (!file || file.size > 8 * 1024 * 1024) { toast("Project JSON không hợp lệ hoặc lớn hơn 8 MB.", targetRuntime); return; }
    try {
      const project = normalizeProject(JSON.parse(await file.text()));
      pushHistory(targetRuntime);
      targetRuntime.project = project;
      clearLayerCache(targetRuntime);
      targetRuntime.historyRedo = [];
      targetRuntime.liveQuality = project.settings.quality === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : project.settings.quality;
      targetRuntime.paintCost = 0;
      targetRuntime.fastFrames = 0;
      syncControls(targetRuntime);
      renderProjectSafely(targetRuntime);
      drawGuides(targetRuntime);
      scheduleSave(targetRuntime);
      syncLayerPanel(targetRuntime);
      toast(`Đã nhập ${projectStrokes(project).length} nét trên ${project.layers.length} layer`, targetRuntime);
    } catch { toast("Không thể đọc project JSON này.", targetRuntime); }
  }

  function syncLayerPanel(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const panel = targetRuntime.root.querySelector("[data-draw-layer-panel]");
    if (panel) panel.innerHTML = layerPanelMarkup(targetRuntime.project);
    const count = targetRuntime.root.querySelector(".draw-layer-section .draw-section-heading span");
    if (count) count.textContent = `${targetRuntime.project.layers.length}/${MAX_LAYERS}`;
    updateUi(targetRuntime);
  }

  function commitLayerMutation(targetRuntime, mutate, message) {
    if (!targetRuntime) return false;
    const before = projectSnapshot(targetRuntime.project);
    const changed = mutate();
    if (changed === false) return false;
    pushHistory(targetRuntime, before);
    clearLayerCache(targetRuntime);
    syncLayerPanel(targetRuntime);
    renderProjectSafely(targetRuntime);
    scheduleSave(targetRuntime);
    if (message) announce(message, targetRuntime);
    return true;
  }

  function handleLayerAction(button, targetRuntime = runtime) {
    if (!button || !targetRuntime) return false;
    const row = button.closest("[data-layer-id]");
    const rowLayer = row ? targetRuntime.project.layers.find((layer) => layer.id === row.dataset.layerId) : null;
    if (button.matches("[data-draw-layer-select]") && rowLayer) {
      targetRuntime.project.activeLayerId = rowLayer.id;
      targetRuntime.selectionIds.clear(); targetRuntime.selectionRegion = null; targetRuntime.selectionScreen = null; updateSelectionBox(targetRuntime);
      syncLayerPanel(targetRuntime);
      syncSelectionUi(targetRuntime);
      announce(`Layer ${rowLayer.name}`, targetRuntime);
      return true;
    }
    if (button.matches("[data-draw-layer-visible]") && rowLayer) return commitLayerMutation(targetRuntime, () => { rowLayer.visible = !rowLayer.visible; rowLayer.revision += 1; }, rowLayer.visible ? `Đã ẩn ${rowLayer.name}` : `Đã hiện ${rowLayer.name}`);
    if (button.matches("[data-draw-layer-lock]") && rowLayer) return commitLayerMutation(targetRuntime, () => { rowLayer.locked = !rowLayer.locked; }, rowLayer.locked ? `Đã mở khóa ${rowLayer.name}` : `Đã khóa ${rowLayer.name}`);
    const selected = activeLayer(targetRuntime.project);
    if (!selected) return false;
    if (button.matches("[data-draw-layer-add]")) {
      if (targetRuntime.project.layers.length >= MAX_LAYERS) { toast(`Tối đa ${MAX_LAYERS} layer`, targetRuntime); return true; }
      return commitLayerMutation(targetRuntime, () => { const layer = createLayer(`Layer ${targetRuntime.project.layers.length + 1}`, "stroke"); const index = targetRuntime.project.layers.indexOf(selected); targetRuntime.project.layers.splice(index + 1, 0, layer); targetRuntime.project.activeLayerId = layer.id; }, "Đã thêm layer mới");
    }
    if (button.matches("[data-draw-layer-duplicate]")) {
      if (targetRuntime.project.layers.length >= MAX_LAYERS) { toast(`Tối đa ${MAX_LAYERS} layer`, targetRuntime); return true; }
      return commitLayerMutation(targetRuntime, () => { const clone = normalizeLayer(JSON.parse(JSON.stringify(selected))); clone.id = `layer-${Date.now()}-${Math.round(Math.random() * 1e5)}`; clone.name = `${selected.name} copy`; const index = targetRuntime.project.layers.indexOf(selected); targetRuntime.project.layers.splice(index + 1, 0, clone); targetRuntime.project.activeLayerId = clone.id; }, "Đã nhân bản layer");
    }
    if (button.matches("[data-draw-layer-up]") || button.matches("[data-draw-layer-down]")) {
      const direction = button.matches("[data-draw-layer-up]") ? 1 : -1;
      const index = targetRuntime.project.layers.indexOf(selected);
      const next = index + direction;
      if (next < 0 || next >= targetRuntime.project.layers.length) { toast(direction > 0 ? "Layer đã ở trên cùng" : "Layer đã ở dưới cùng", targetRuntime); return true; }
      return commitLayerMutation(targetRuntime, () => { [targetRuntime.project.layers[index], targetRuntime.project.layers[next]] = [targetRuntime.project.layers[next], targetRuntime.project.layers[index]]; }, "Đã thay đổi thứ tự layer");
    }
    if (button.matches("[data-draw-layer-merge]")) {
      const index = targetRuntime.project.layers.indexOf(selected);
      if (index <= 0) { toast("Không có layer bên dưới để gộp", targetRuntime); return true; }
      return commitLayerMutation(targetRuntime, () => {
        const below = targetRuntime.project.layers[index - 1];
        const merged = normalizeLayer({ id: `layer-${Date.now()}-merged`, name: `${below.name} + ${selected.name}`, type: "effect", children: [below, selected], strokes: [], opacity: 1, blendMode: "source-over" });
        targetRuntime.project.layers.splice(index - 1, 2, merged);
        targetRuntime.project.activeLayerId = merged.id;
      }, "Đã gộp layer và giữ nguyên cấu trúc hiệu ứng");
    }
    if (button.matches("[data-draw-layer-delete]")) {
      if (targetRuntime.project.layers.length <= 1) { toast("Project cần ít nhất một layer", targetRuntime); return true; }
      return commitLayerMutation(targetRuntime, () => { const index = targetRuntime.project.layers.indexOf(selected); targetRuntime.project.layers.splice(index, 1); targetRuntime.project.activeLayerId = targetRuntime.project.layers[Math.max(0, index - 1)].id; }, "Đã xóa layer · có thể Hoàn tác");
    }
    return false;
  }

  function updateActiveLayerControl(input, targetRuntime = runtime) {
    const layer = activeLayer(targetRuntime?.project);
    if (!layer) return false;
    const before = projectSnapshot(targetRuntime.project);
    if (input.matches("[data-draw-layer-name]")) layer.name = String(input.value || "Layer").trim().slice(0, 80) || "Layer";
    else if (input.matches("[data-draw-layer-type]")) layer.type = LAYER_TYPES.includes(input.value) ? input.value : "stroke";
    else if (input.matches("[data-draw-layer-blend]")) layer.blendMode = LAYER_BLEND_MODES.includes(input.value) ? input.value : "source-over";
    else if (input.matches("[data-draw-layer-opacity]")) layer.opacity = clamp(input.value, 0, 1, 1);
    else return false;
    pushHistory(targetRuntime, before);
    syncLayerPanel(targetRuntime);
    renderAll(targetRuntime);
    scheduleSave(targetRuntime);
    return true;
  }

  function syncViewUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const zoom = targetRuntime.root.querySelector("[data-draw-zoom]");
    if (zoom) zoom.textContent = `${Math.round(targetRuntime.project.view.zoom * 100)}%`;
    targetRuntime.root.querySelectorAll("[data-draw-tool]").forEach((button) => { const active = button.dataset.drawTool === targetRuntime.tool; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    targetRuntime.root.dataset.tool = targetRuntime.tool;
  }

  function setTool(tool, targetRuntime = runtime) {
    if (!targetRuntime || !["draw", "eraser", "select", "pan"].includes(tool)) return;
    targetRuntime.tool = tool;
    syncViewUi(targetRuntime);
    syncSelectionUi(targetRuntime);
    if (tool === "draw" || tool === "eraser") setInspectorTab("tool", targetRuntime, { group: "tool-core", reveal: true });
    else if (tool === "select") setInspectorTab("object", targetRuntime, { group: "object-transform", reveal: true });
    else setInspectorTab("document", targetRuntime, { group: "document-canvas", reveal: false });
    announce(({ draw: "Công cụ vẽ", eraser: "Công cụ tẩy", select: "Chọn và biến đổi", pan: "Di chuyển canvas" })[tool], targetRuntime);
  }

  function updateView(action, targetRuntime = runtime, amount = 0) {
    if (!targetRuntime) return;
    const view = targetRuntime.project.view;
    if (action === "zoom-in") view.zoom = clamp(view.zoom * 1.2, 0.25, 8, 1);
    else if (action === "zoom-out") view.zoom = clamp(view.zoom / 1.2, 0.25, 8, 1);
    else if (action === "zoom") view.zoom = clamp(view.zoom * Math.exp(-amount * 0.0012), 0.25, 8, 1);
    else if (action === "rotate-left") view.rotation = clamp(view.rotation - 15, -180, 180, 0);
    else if (action === "rotate-right") view.rotation = clamp(view.rotation + 15, -180, 180, 0);
    else if (action === "rotate") view.rotation = clamp(view.rotation + amount, -180, 180, 0);
    else if (action === "fit" || action === "reset") Object.assign(view, { zoom: 1, panX: 0, panY: 0, rotation: 0 });
    renderAll(targetRuntime);
    drawGuides(targetRuntime);
    syncViewUi(targetRuntime);
    scheduleSave(targetRuntime);
  }

  function handleCanvasWheel(event, targetRuntime = runtime) {
    if (!targetRuntime) return;
    event.preventDefault();
    if (event.shiftKey) updateView("rotate", targetRuntime, event.deltaY > 0 ? 3 : -3);
    else updateView("zoom", targetRuntime, event.deltaY);
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const a = polygon[index]; const b = polygon[previous];
      const intersects = ((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function syncSelectionUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const actions = targetRuntime.root.querySelector("[data-draw-selection-actions]");
    if (actions) actions.hidden = targetRuntime.tool !== "select";
    targetRuntime.root.querySelectorAll("[data-draw-selection-count]").forEach((count) => { count.textContent = String(targetRuntime.selectionIds.size); });
    targetRuntime.root.querySelectorAll("[data-draw-select-shape]").forEach((button) => { const active = button.dataset.drawSelectShape === targetRuntime.selectionShape; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  }

  function updateSelectionBox(targetRuntime = runtime) {
    const box = targetRuntime?.root?.querySelector("[data-draw-selection-box]");
    const region = targetRuntime?.selectionScreen;
    if (!box || !region) { if (box) box.hidden = true; return; }
    box.hidden = false;
    box.style.left = `${Math.min(region.x1, region.x2)}px`;
    box.style.top = `${Math.min(region.y1, region.y2)}px`;
    box.style.width = `${Math.abs(region.x2 - region.x1)}px`;
    box.style.height = `${Math.abs(region.y2 - region.y1)}px`;
    box.dataset.shape = targetRuntime.selectionShape;
  }

  function beginSelection(event, targetRuntime = runtime) {
    event.preventDefault(); targetRuntime.canvas.setPointerCapture?.(event.pointerId); targetRuntime.selecting = true;
    const rect = targetRuntime.canvas.getBoundingClientRect(); const point = pointerPoint(event, targetRuntime, rect);
    targetRuntime.selectionPath = [point]; targetRuntime.selectionScreen = { x1: event.clientX - rect.left, y1: event.clientY - rect.top, x2: event.clientX - rect.left, y2: event.clientY - rect.top };
    updateSelectionBox(targetRuntime); syncSelectionUi(targetRuntime); announce("Kéo để chọn nét", targetRuntime);
  }

  function updateSelection(event, targetRuntime = runtime) {
    if (!targetRuntime?.selecting) return;
    const rect = targetRuntime.canvas.getBoundingClientRect(); const point = pointerPoint(event, targetRuntime, rect);
    targetRuntime.selectionScreen.x2 = event.clientX - rect.left; targetRuntime.selectionScreen.y2 = event.clientY - rect.top;
    if (targetRuntime.selectionShape === "lasso") targetRuntime.selectionPath.push(point);
    else targetRuntime.selectionPath = [targetRuntime.selectionPath[0], point];
    updateSelectionBox(targetRuntime);
  }

  function finishSelection(event, targetRuntime = runtime) {
    if (!targetRuntime?.selecting) return false;
    updateSelection(event, targetRuntime); targetRuntime.selecting = false;
    try { targetRuntime.canvas.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    const path = targetRuntime.selectionPath;
    const first = path[0]; const last = path.at(-1) || first;
    const minX = Math.min(first.x, last.x); const maxX = Math.max(first.x, last.x); const minY = Math.min(first.y, last.y); const maxY = Math.max(first.y, last.y);
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2; const radiusX = Math.max(1e-5, (maxX - minX) / 2); const radiusY = Math.max(1e-5, (maxY - minY) / 2);
    const contains = targetRuntime.selectionShape === "lasso" && path.length >= 3
      ? (point) => pointInPolygon(point, path)
      : targetRuntime.selectionShape === "ellipse"
        ? (point) => ((point.x - centerX) / radiusX) ** 2 + ((point.y - centerY) / radiusY) ** 2 <= 1
        : (point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    const layer = activeLayer(targetRuntime.project); targetRuntime.selectionIds.clear();
    (layer?.strokes || []).forEach((stroke) => { if (stroke.points.some(contains)) targetRuntime.selectionIds.add(stroke.id); });
    targetRuntime.selectionRegion = { minX, maxX, minY, maxY, path: targetRuntime.selectionShape === "lasso" ? path.slice(0, 240) : [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] };
    syncSelectionUi(targetRuntime); announce(`Đã chọn ${targetRuntime.selectionIds.size} nét`, targetRuntime); return true;
  }

  function transformSelection(action, targetRuntime = runtime) {
    const layer = activeLayer(targetRuntime?.project);
    if (!layer) return;
    if (action === "mask") {
      if (!targetRuntime.selectionRegion?.path?.length) { toast("Hãy kéo vùng chọn trước khi tạo mask", targetRuntime); return; }
      return commitLayerMutation(targetRuntime, () => { layer.mask = targetRuntime.selectionRegion.path.map(({ x, y }) => ({ x, y })); layer.revision += 1; }, "Đã tạo clipping mask cho layer");
    }
    if (action === "clear-mask") return commitLayerMutation(targetRuntime, () => { if (!layer.mask.length) return false; layer.mask = []; layer.revision += 1; }, "Đã xóa mask của layer");
    const selected = layer.strokes.filter((stroke) => targetRuntime.selectionIds.has(stroke.id));
    if (!selected.length) { toast("Chưa có nét nào được chọn", targetRuntime); return; }
    const before = projectSnapshot(targetRuntime.project);
    const allPoints = selected.flatMap((stroke) => stroke.points); const minX = Math.min(...allPoints.map((point) => point.x)); const maxX = Math.max(...allPoints.map((point) => point.x)); const minY = Math.min(...allPoints.map((point) => point.y)); const maxY = Math.max(...allPoints.map((point) => point.y)); const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    if (action === "duplicate") {
      const clones = selected.map((stroke) => ({ ...JSON.parse(JSON.stringify(stroke)), id: `stroke-${Date.now()}-${Math.round(Math.random() * 1e5)}`, points: stroke.points.map((point) => ({ ...point, x: clamp(point.x + 0.025, 0, 1, point.x), y: clamp(point.y + 0.025, 0, 1, point.y) })) }));
      layer.strokes.push(...clones); targetRuntime.selectionIds = new Set(clones.map((stroke) => stroke.id));
    } else if (action === "delete") {
      layer.strokes = layer.strokes.filter((stroke) => !targetRuntime.selectionIds.has(stroke.id)); targetRuntime.selectionIds.clear();
    } else if (action === "keep-selection") {
      layer.strokes = layer.strokes.filter((stroke) => targetRuntime.selectionIds.has(stroke.id));
    } else if (action === "reverse") selected.forEach((stroke) => { const startTime = stroke.points[0]?.time || 0; const endTime = stroke.points.at(-1)?.time || startTime; stroke.points = [...stroke.points].reverse().map((point, index, points) => ({ ...point, time: startTime + (endTime - (point.time || startTime)) + index * 0.001 })); });
    else if (action === "trim-start" || action === "trim-end") selected.forEach((stroke) => { const cut = Math.max(1, Math.floor(stroke.points.length * 0.2)); stroke.points = action === "trim-start" ? stroke.points.slice(cut) : stroke.points.slice(0, -cut); });
    else selected.forEach((stroke) => { stroke.points = stroke.points.map((point) => {
      let x = point.x; let y = point.y;
      if (action === "flip-x") x = cx - (x - cx); else if (action === "flip-y") y = cy - (y - cy);
      else if (action === "rotate") { const dx = x - cx; const dy = y - cy; x = cx - dy; y = cy + dx; }
      else if (action === "scale-up" || action === "scale-down") { const factor = action === "scale-up" ? 1.12 : 0.88; x = cx + (x - cx) * factor; y = cy + (y - cy) * factor; }
      else if (action === "warp") x += Math.sin((y - minY) / Math.max(1e-5, maxY - minY) * Math.PI) * 0.045;
      else if (action === "perspective") x += ((y - cy) / Math.max(1e-5, maxY - minY)) * 0.07;
      return { ...point, x: clamp(x, 0, 1, point.x), y: clamp(y, 0, 1, point.y) };
    }); });
    layer.revision += 1; pushHistory(targetRuntime, before); clearLayerCache(targetRuntime); renderProjectSafely(targetRuntime); syncLayerPanel(targetRuntime); syncSelectionUi(targetRuntime); scheduleSave(targetRuntime); announce("Đã áp dụng biến đổi vùng chọn", targetRuntime);
  }

  function syncGradientEditor(targetRuntime = runtime) {
    const editor = targetRuntime?.root?.querySelector("[data-draw-gradient-editor]");
    if (editor) editor.outerHTML = gradientEditorMarkup(targetRuntime.project.settings);
  }

  function applyCustomStops(stops, targetRuntime = runtime, message = "Đã cập nhật gradient") {
    if (!targetRuntime) return;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, customStops: stops, paletteId: "custom", autoHue: false });
    syncControls(targetRuntime); syncGradientEditor(targetRuntime); scheduleSave(targetRuntime); announce(message, targetRuntime);
  }

  function downloadBlob(blob, filename) {
    const url = globalScope.URL.createObjectURL(blob); const anchor = globalScope.document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
  }

  async function extractPaletteFromImage(file, targetRuntime = runtime) {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > 12 * 1024 * 1024) { toast("Ảnh phải là PNG, JPEG hoặc WebP và nhỏ hơn 12 MB", targetRuntime); return; }
    try {
      const bitmap = await globalScope.createImageBitmap(file); const canvas = createRenderCanvas(64, 64); const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0, 64, 64); bitmap.close?.();
      const data = ctx.getImageData(0, 0, 64, 64).data; const buckets = new Map();
      for (let index = 0; index < data.length; index += 16) { if (data[index + 3] < 100) continue; const r = Math.round(data[index] / 32) * 32; const g = Math.round(data[index + 1] / 32) * 32; const b = Math.round(data[index + 2] / 32) * 32; const key = `${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)}`; buckets.set(key, (buckets.get(key) || 0) + 1); }
      const colors = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key]) => `#${key.split(",").map((value) => Number(value).toString(16).padStart(2, "0")).join("")}`);
      if (colors.length < 2) throw new Error("palette"); applyCustomStops(colors, targetRuntime, `Đã trích ${colors.length} màu từ ảnh`);
    } catch { toast("Không thể đọc bảng màu từ ảnh này", targetRuntime); }
  }

  function exportPalette(format, targetRuntime = runtime) {
    const stops = paletteStops(targetRuntime.project.settings); const stamp = Date.now();
    if (format === "css") { const css = `:root {\n${stops.map((color, index) => `  --hh-color-${index + 1}: ${color};`).join("\n")}\n  --hh-gradient: linear-gradient(90deg, ${stops.join(", ")});\n}`; downloadBlob(new Blob([css], { type: "text/css" }), `hh-palette-${stamp}.css`); }
    else if (format === "json") downloadBlob(new Blob([JSON.stringify({ name: targetRuntime.project.settings.paletteSeed, colors: stops }, null, 2)], { type: "application/json" }), `hh-palette-${stamp}.json`);
    else {
      const canvas = globalScope.document.createElement("canvas"); canvas.width = 1200; canvas.height = 300; const ctx = canvas.getContext("2d"); const width = canvas.width / stops.length; stops.forEach((color, index) => { ctx.fillStyle = color; ctx.fillRect(index * width, 0, width + 1, 240); ctx.fillStyle = "#061020"; ctx.font = "700 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText(color.toUpperCase(), index * width + width / 2, 280); }); canvas.toBlob((blob) => blob && downloadBlob(blob, `hh-palette-${stamp}.png`), "image/png");
    }
    toast(`Đã xuất bảng màu ${format.toUpperCase()}`, targetRuntime);
  }

  function syncAnimationUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const progress = clamp(targetRuntime.playbackProgress, 0, 1, 0);
    const slider = targetRuntime.root.querySelector("[data-draw-timeline]"); if (slider && globalScope.document?.activeElement !== slider) slider.value = progress;
    const output = targetRuntime.root.querySelector('[data-draw-output="timeline"]'); if (output) output.textContent = `${Math.round(progress * 100)}%`;
    const time = targetRuntime.root.querySelector("[data-draw-animation-time]"); if (time) { const seconds = progress * targetRuntime.project.animation.duration; time.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }
    const duration = targetRuntime.root.querySelector('[data-draw-animation-output="duration"]'); if (duration) duration.textContent = `${Math.round(targetRuntime.project.animation.duration)} giây`;
    const keyframes = targetRuntime.root.querySelector("[data-draw-keyframe-count]"); if (keyframes) keyframes.textContent = String(targetRuntime.project.animation.keyframes.length);
    targetRuntime.root.classList.toggle("is-playing", Boolean(targetRuntime.isPlaying));
  }

  function renderPlayback(targetRuntime = runtime) {
    renderAll(targetRuntime, { playbackProgress: targetRuntime.playbackProgress }); syncAnimationUi(targetRuntime);
  }

  function pauseAnimation(targetRuntime = runtime) {
    if (!targetRuntime) return; targetRuntime.isPlaying = false; globalScope.cancelAnimationFrame?.(targetRuntime.playbackFrame); targetRuntime.playbackFrame = 0; syncAnimationUi(targetRuntime); announce("Đã tạm dừng animation", targetRuntime);
  }

  function stopAnimation(targetRuntime = runtime) {
    if (!targetRuntime) return; targetRuntime.isPlaying = false; globalScope.cancelAnimationFrame?.(targetRuntime.playbackFrame); targetRuntime.playbackFrame = 0; targetRuntime.playbackProgress = 0; renderAll(targetRuntime); syncAnimationUi(targetRuntime); announce("Đã dừng animation", targetRuntime);
  }

  function playAnimation(targetRuntime = runtime) {
    if (!targetRuntime || !projectStrokes(targetRuntime.project).length) { toast("Hãy vẽ ít nhất một nét trước khi phát", targetRuntime); return; }
    if (targetRuntime.isPlaying) return;
    targetRuntime.isPlaying = true; const animation = targetRuntime.project.animation; const startProgress = targetRuntime.playbackProgress >= 1 ? 0 : targetRuntime.playbackProgress; const startedAt = (globalScope.performance?.now?.() || Date.now()) - startProgress * animation.duration * 1000 / animation.speed; let lastRender = 0;
    const tick = (now) => {
      if (!targetRuntime.isPlaying) return; const elapsed = Math.max(0, now - startedAt); let progress = elapsed * animation.speed / (animation.duration * 1000);
      if (progress >= 1) { if (animation.loop) progress %= 1; else { targetRuntime.playbackProgress = 1; renderPlayback(targetRuntime); pauseAnimation(targetRuntime); return; } }
      targetRuntime.playbackProgress = progress;
      const interval = 1000 / Math.min(30, animation.fps); if (now - lastRender >= interval) { lastRender = now; renderPlayback(targetRuntime); }
      targetRuntime.playbackFrame = globalScope.requestAnimationFrame?.(tick);
    };
    targetRuntime.playbackFrame = globalScope.requestAnimationFrame?.(tick); syncAnimationUi(targetRuntime); announce("Đang phát timelapse…", targetRuntime);
  }

  function updateAnimationSetting(input, targetRuntime = runtime) {
    if (!targetRuntime) return;
    const key = input.dataset.drawAnimationSetting; const raw = input.type === "checkbox" ? input.checked : input.value; targetRuntime.project.animation = normalizeAnimation({ ...targetRuntime.project.animation, [key]: raw }); syncAnimationUi(targetRuntime); scheduleSave(targetRuntime);
  }

  function updateKeyframe(action, targetRuntime = runtime) {
    if (!targetRuntime) return; const animation = targetRuntime.project.animation; const frames = [...animation.keyframes];
    if (action === "add") { const settings = targetRuntime.project.settings; const view = targetRuntime.project.view; const frame = { id: `keyframe-${Date.now()}`, progress: targetRuntime.playbackProgress, colorA: settings.colorA, colorB: settings.colorB, glow: settings.glow, symmetry: settings.symmetry, zoom: view.zoom, rotation: view.rotation }; const nearby = frames.findIndex((item) => Math.abs(item.progress - frame.progress) < 0.01); if (nearby >= 0) frames[nearby] = frame; else if (frames.length < 32) frames.push(frame); else { toast("Tối đa 32 keyframe", targetRuntime); return; } }
    else { if (!frames.length) { toast("Chưa có keyframe", targetRuntime); return; } let closest = 0; frames.forEach((frame, index) => { if (Math.abs(frame.progress - targetRuntime.playbackProgress) < Math.abs(frames[closest].progress - targetRuntime.playbackProgress)) closest = index; }); frames.splice(closest, 1); }
    targetRuntime.project.animation = normalizeAnimation({ ...animation, keyframes: frames }); syncAnimationUi(targetRuntime); scheduleSave(targetRuntime); toast(action === "add" ? "Đã lưu keyframe màu, glow, đối xứng và camera" : "Đã xóa keyframe gần nhất", targetRuntime);
  }

  async function exportAnimation(targetRuntime = runtime) {
    if (!targetRuntime || targetRuntime.exportingAnimation) return;
    if (!globalScope.MediaRecorder || !globalScope.HTMLCanvasElement?.prototype?.captureStream) { toast("Trình duyệt này chưa hỗ trợ ghi video canvas", targetRuntime); return; }
    const strokes = projectStrokes(targetRuntime.project); if (!strokes.length) { toast("Hãy vẽ trước khi xuất video", targetRuntime); return; }
    const settings = targetRuntime.project.settings; const preset = CANVAS_PRESETS[settings.canvasPreset]; const sourceWidth = settings.canvasPreset === "viewport" ? targetRuntime.canvas.width / targetRuntime.dpr : settings.canvasWidth; const sourceHeight = settings.canvasPreset === "viewport" ? targetRuntime.canvas.height / targetRuntime.dpr : settings.canvasHeight; const ratio = Math.min(1, 1280 / sourceWidth, 1280 / sourceHeight); const width = Math.max(320, Math.round(sourceWidth * ratio / 2) * 2); const height = Math.max(320, Math.round(sourceHeight * ratio / 2) * 2); const canvas = globalScope.document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const animation = targetRuntime.project.animation; const requestedMp4 = animation.format === "mp4"; const candidates = requestedMp4 ? ["video/mp4;codecs=avc1.42E01E", "video/webm;codecs=vp9", "video/webm;codecs=vp8"] : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]; const mimeType = candidates.find((type) => globalScope.MediaRecorder.isTypeSupported(type)) || ""; if (!mimeType) { toast("Không tìm thấy codec video được hỗ trợ", targetRuntime); return; }
    targetRuntime.exportingAnimation = true; targetRuntime.exportCancelled = false; announce("Đang dựng video · vẫn có thể dùng nút Dừng", targetRuntime); const stream = canvas.captureStream(Math.min(30, animation.fps)); const chunks = []; const recorder = new globalScope.MediaRecorder(stream, { mimeType, videoBitsPerSecond: width * height > 1_000_000 ? 8_000_000 : 4_000_000 }); recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); }; recorder.start(500);
    const durationMs = animation.duration * 1000; const started = globalScope.performance?.now?.() || Date.now();
    while (!targetRuntime.exportCancelled) {
      const now = globalScope.performance?.now?.() || Date.now(); const progress = Math.min(1, (now - started) / durationMs); renderAll(targetRuntime, { targetCanvas: canvas, includeBackground: true, scale: width / Math.max(1, sourceWidth), playbackProgress: progress }); if (progress >= 1) break; await new Promise((resolve) => globalScope.setTimeout(resolve, 1000 / Math.min(30, animation.fps)));
    }
    await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); }); stream.getTracks().forEach((track) => track.stop()); targetRuntime.exportingAnimation = false;
    if (targetRuntime.exportCancelled) { toast("Đã hủy xuất video", targetRuntime); return; }
    const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm"; downloadBlob(new Blob(chunks, { type: mimeType }), `hh-chromatic-timelapse-${Date.now()}.${extension}`); toast(requestedMp4 && extension !== "mp4" ? "MP4 chưa được hỗ trợ · đã xuất WebM" : `Đã xuất video ${extension.toUpperCase()}`, targetRuntime); announce("Xuất video hoàn tất", targetRuntime);
  }

  async function toggleAudioReactive(targetRuntime = runtime) {
    if (!targetRuntime) return;
    if (targetRuntime.audioStream) { targetRuntime.audioStream.getTracks().forEach((track) => track.stop()); targetRuntime.audioContext?.close?.(); globalScope.cancelAnimationFrame?.(targetRuntime.audioFrame); targetRuntime.audioStream = null; targetRuntime.audioLevel = 0; targetRuntime.root.style.setProperty("--audio-level", 0); toast("Đã tắt Audio Reactive", targetRuntime); return; }
    try {
      const stream = await globalScope.navigator.mediaDevices.getUserMedia({ audio: true }); const AudioContext = globalScope.AudioContext || globalScope.webkitAudioContext; const context = new AudioContext(); const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser); const data = new Uint8Array(analyser.frequencyBinCount); targetRuntime.audioStream = stream; targetRuntime.audioContext = context;
      const pulse = () => { if (!targetRuntime.audioStream) return; analyser.getByteFrequencyData(data); targetRuntime.audioLevel = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length * 255); targetRuntime.root.style.setProperty("--audio-level", targetRuntime.audioLevel.toFixed(3)); targetRuntime.audioFrame = globalScope.requestAnimationFrame?.(pulse); }; pulse(); toast("Audio Reactive đang hoạt động trên thiết bị", targetRuntime);
    } catch { toast("Không thể bật microphone · hãy kiểm tra quyền trình duyệt", targetRuntime); }
  }

  function removeBackgroundMedia(targetRuntime = runtime, quiet = false) {
    if (!targetRuntime) return; globalScope.cancelAnimationFrame?.(targetRuntime.backgroundFrame); targetRuntime.backgroundFrame = 0; targetRuntime.backgroundMedia?.element?.pause?.(); if (targetRuntime.backgroundMedia?.url) globalScope.URL.revokeObjectURL(targetRuntime.backgroundMedia.url); targetRuntime.backgroundMedia = null; const status = targetRuntime.root?.querySelector("[data-draw-background-status]"); if (status) status.textContent = "Không tải media ra khỏi thiết bị · chỉ dùng trong phiên này"; renderAll(targetRuntime); if (!quiet) toast("Đã xóa media nền", targetRuntime);
  }

  async function loadBackgroundMedia(file, targetRuntime = runtime) {
    if (!file || file.size > 80 * 1024 * 1024 || !/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/i.test(file.type)) { toast("Media phải là PNG/JPEG/WebP/MP4/WebM và nhỏ hơn 80 MB", targetRuntime); return; }
    removeBackgroundMedia(targetRuntime, true); const url = globalScope.URL.createObjectURL(file); const isVideo = file.type.startsWith("video/"); const element = globalScope.document.createElement(isVideo ? "video" : "img"); element.src = url;
    try {
      if (isVideo) { element.muted = true; element.loop = true; element.playsInline = true; await new Promise((resolve, reject) => { element.onloadedmetadata = resolve; element.onerror = reject; }); await element.play(); }
      else if (element.decode) await element.decode(); else await new Promise((resolve, reject) => { element.onload = resolve; element.onerror = reject; });
      targetRuntime.backgroundMedia = { type: isVideo ? "video" : "image", element, url, name: file.name }; const status = targetRuntime.root.querySelector("[data-draw-background-status]"); if (status) status.textContent = `${file.name} · local · không tải lên máy chủ`; renderAll(targetRuntime); toast(`Đã đặt ${isVideo ? "video" : "ảnh"} nền`, targetRuntime);
      if (isVideo) { let last = 0; const tick = (time) => { if (!targetRuntime.backgroundMedia || globalScope.document.hidden) return; if (time - last > 40 && !targetRuntime.drawing && !targetRuntime.workerBusy) { last = time; renderAll(targetRuntime); } targetRuntime.backgroundFrame = globalScope.requestAnimationFrame?.(tick); }; targetRuntime.backgroundFrame = globalScope.requestAnimationFrame?.(tick); }
    } catch { globalScope.URL.revokeObjectURL(url); toast("Không thể đọc media nền này", targetRuntime); }
  }

  function syncControls(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const settings = targetRuntime.project.settings;
    targetRuntime.root.dataset.background = settings.background;
    targetRuntime.root.dataset.brushMode = settings.brushMode;
    targetRuntime.root.dataset.guides = String(settings.guides);
    targetRuntime.root.querySelectorAll("[data-draw-preset]").forEach((button) => { const active = button.dataset.drawPreset === settings.preset; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    targetRuntime.root.querySelectorAll("[data-draw-palette]").forEach((button) => { const active = button.dataset.drawPalette === settings.paletteId; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    targetRuntime.root.querySelectorAll("[data-draw-color]").forEach((button) => { const active = button.dataset.drawColor.toLowerCase() === settings.colorA; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    ["symmetry", "brushSize", "glow", "flow", "stabilizer", "pressureCurve", "velocityWidth", "velocityGlow", "taperStart", "taperEnd", "spacing", "scatter", "rotation", "noise", "curvature", "elasticity", "inertia", "quality", "background", "canvasPreset", "canvasWidth", "canvasHeight", "exportFormat", "exportScale", "gradientFlow", "patternSeed", "patternComplexity", "patternScale", "colorA", "colorB"].forEach((key) => {
      const selector = key === "colorA" ? "[data-draw-color-a]" : key === "colorB" ? "[data-draw-color-b]" : `[data-draw-setting=\"${key}\"]`;
      const input = targetRuntime.root.querySelector(selector); if (input) input.value = settings[key];
    });
    ["mirror", "spiral", "autoHue", "guides", "pressureEnabled", "stylusEraser", "grid", "snapCenter", "touchDraw"].forEach((key) => { const input = targetRuntime.root.querySelector(`[data-draw-setting=\"${key}\"]`); if (input) input.checked = settings[key]; });
    const labels = { symmetry: `${settings.symmetry} nhánh`, brushSize: `${settings.brushSize.toFixed(1)} px`, glow: `${Math.round(settings.glow)}%`, flow: `${Math.round(settings.flow * 100)}%`, stabilizer: `${Math.round(settings.stabilizer)}%`, pressureCurve: `${settings.pressureCurve.toFixed(2)}×`, velocityWidth: `${Math.round(settings.velocityWidth * 100)}%`, velocityGlow: `${Math.round(settings.velocityGlow * 100)}%`, spacing: `${settings.spacing.toFixed(1)} px`, scatter: `${settings.scatter.toFixed(1)} px`, rotation: `${Math.round(settings.rotation)}°`, noise: `${Math.round(settings.noise * 100)}%`, curvature: `${Math.round(settings.curvature * 100)}%`, elasticity: `${Math.round(settings.elasticity * 100)}%`, inertia: `${Math.round(settings.inertia * 100)}%`, patternComplexity: String(settings.patternComplexity), patternScale: `${Math.round(settings.patternScale * 100)}%` };
    Object.entries(labels).forEach(([key, label]) => { const output = targetRuntime.root.querySelector(`[data-draw-output=\"${key}\"]`); if (output) output.textContent = label; });
    const preview = targetRuntime.root.querySelector("[data-draw-mix-preview]"); if (preview) preview.style.setProperty("--mix", mixHex(settings.colorA, settings.colorB));
    const presetLabel = PRESETS[settings.preset]?.label || PRESETS.silk.label;
    const paletteLabel = COLOR_PALETTES[settings.paletteId]?.label || "Tùy chỉnh";
    targetRuntime.root.querySelectorAll("[data-draw-summary-brush]").forEach((node) => { node.textContent = presetLabel; });
    targetRuntime.root.querySelectorAll("[data-draw-summary-color]").forEach((node) => { node.textContent = paletteLabel; });
    targetRuntime.root.querySelectorAll("[data-draw-summary-hex]").forEach((node) => { node.textContent = settings.colorA.toUpperCase(); });
    targetRuntime.root.querySelectorAll("[data-draw-color-orb]").forEach((node) => { node.style.setProperty("--draw-active-color", settings.colorA); });
    const colorCode = targetRuntime.root.querySelector("[data-draw-color-code]"); if (colorCode && globalScope.document?.activeElement !== colorCode) colorCode.value = settings.colorA.toUpperCase();
    const rgb = hexToRgb(settings.colorA); const hsl = rgbToHsl(rgb);
    const rgbNode = targetRuntime.root.querySelector("[data-draw-color-rgb]"); if (rgbNode) rgbNode.textContent = rgb.join(", ");
    const hslNode = targetRuntime.root.querySelector("[data-draw-color-hsl]"); if (hslNode) hslNode.textContent = `${Math.round(hsl[0])}°, ${Math.round(hsl[1] * 100)}%, ${Math.round(hsl[2] * 100)}%`;
    targetRuntime.root.querySelector("[data-draw-guides-toggle]")?.setAttribute("aria-pressed", String(settings.guides));
    syncInspectorUi(targetRuntime);
    syncViewUi(targetRuntime);
    updateUi(targetRuntime);
  }

  function applyBrushFilters(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const query = String(targetRuntime.brushSearch || "").trim().toLowerCase();
    const filter = targetRuntime.brushFilter || "all";
    const recent = new Set(targetRuntime.recentBrushes || []);
    let visible = 0;
    targetRuntime.root.querySelectorAll("[data-draw-preset-card]").forEach((card) => {
      const id = card.dataset.drawPresetCard;
      const category = card.dataset.drawCategory;
      const label = card.dataset.drawLabel || "";
      const groupMatch = filter === "all" || filter === category || (filter === "favorites" && targetRuntime.favoriteBrushes.has(id)) || (filter === "recent" && recent.has(id));
      const searchMatch = !query || label.includes(query) || id.toLowerCase().includes(query) || category.includes(query);
      card.hidden = !(groupMatch && searchMatch);
      if (!card.hidden) visible += 1;
    });
    const count = targetRuntime.root.querySelector("[data-draw-mode-count]"); if (count) count.textContent = String(visible);
    const empty = targetRuntime.root.querySelector("[data-draw-filter-empty]"); if (empty) empty.hidden = visible > 0;
  }

  function syncBrushLibraryUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    targetRuntime.root.querySelectorAll("[data-draw-favorite]").forEach((button) => {
      const active = targetRuntime.favoriteBrushes.has(button.dataset.drawFavorite);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.title = active ? "Bỏ yêu thích" : "Thêm vào yêu thích";
      button.textContent = active ? "★" : "☆";
    });
    applyBrushFilters(targetRuntime);
  }

  function toggleFavorite(id, targetRuntime = runtime) {
    if (!targetRuntime || !Object.hasOwn(PRESETS, id)) return;
    if (targetRuntime.favoriteBrushes.has(id)) targetRuntime.favoriteBrushes.delete(id);
    else if (targetRuntime.favoriteBrushes.size < 24) targetRuntime.favoriteBrushes.add(id);
    else { toast("Tối đa 24 brush yêu thích", targetRuntime); return; }
    saveBrushLibrary(targetRuntime);
    syncBrushLibraryUi(targetRuntime);
  }

  function composePattern(type, targetRuntime = runtime) {
    if (!targetRuntime || !Object.hasOwn(PATTERN_GENERATORS, type)) return;
    const layer = activeLayer(targetRuntime.project);
    if (!layer || layer.locked || !layer.visible) { toast("Hãy chọn một layer đang mở và hiển thị", targetRuntime); return; }
    const strokes = generatePatternStrokes(type, targetRuntime.project.settings);
    if (!strokes.length) return;
    pushHistory(targetRuntime);
    strokes.forEach((stroke, index) => { stroke.id = `generated-${type}-${Date.now()}-${index}`; stroke.layerId = layer.id; });
    layer.strokes.push(...strokes);
    if (layer.strokes.length > MAX_STROKES) layer.strokes.splice(0, layer.strokes.length - MAX_STROKES);
    layer.revision += 1;
    clearLayerCache(targetRuntime);
    renderProjectSafely(targetRuntime);
    syncLayerPanel(targetRuntime);
    scheduleSave(targetRuntime);
    announce(`${PATTERN_GENERATORS[type].label} · ${strokes.length} nét đã tạo`, targetRuntime);
    targetRuntime.root.classList.remove("is-panel-open");
  }

  function remixPattern(targetRuntime = runtime) {
    if (!targetRuntime) return;
    const nextSeed = `${targetRuntime.project.settings.patternSeed.split("-").slice(0, 2).join("-") || "HH"}-${Math.floor((globalScope.performance?.now?.() || Date.now()) % 99999).toString(36).toUpperCase()}`;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, patternSeed: nextSeed });
    syncControls(targetRuntime);
    scheduleSave(targetRuntime);
    toast(`Seed mới: ${nextSeed}`, targetRuntime);
  }

  function applyPreset(id, targetRuntime = runtime) {
    const preset = PRESETS[id];
    if (!preset || !targetRuntime) return;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, ...preset, preset: id });
    targetRuntime.recentBrushes = [id, ...targetRuntime.recentBrushes.filter((item) => item !== id)].slice(0, 8);
    saveBrushLibrary(targetRuntime);
    syncBrushLibraryUi(targetRuntime);
    syncControls(targetRuntime);
    drawGuides(targetRuntime);
    scheduleSave(targetRuntime);
    announce(`Đã chọn ${preset.label}`, targetRuntime);
    if (targetRuntime.inspectorState.closeLibraryAfterSelect && targetRuntime.activeDrawer === "brushes") closeInspectorDrawer(targetRuntime);
  }

  function updateSetting(input, targetRuntime = runtime) {
    const key = input.dataset.drawSetting;
    if (!key) return;
    const controls = targetRuntime?.root?.querySelector(".draw-controls");
    const preservedScrollTop = Number.isFinite(targetRuntime?.controlScrollAnchor) ? targetRuntime.controlScrollAnchor : controls?.scrollTop || 0;
    const booleans = new Set(["mirror", "spiral", "autoHue", "guides", "pressureEnabled", "stylusEraser", "grid", "snapCenter", "touchDraw"]);
    const numbers = new Set(["symmetry", "brushSize", "glow", "flow", "stabilizer", "pressureCurve", "velocityWidth", "velocityGlow", "taperStart", "taperEnd", "spacing", "scatter", "rotation", "noise", "curvature", "elasticity", "inertia", "patternComplexity", "patternScale", "canvasWidth", "canvasHeight", "exportScale"]);
    const value = booleans.has(key) ? input.checked : numbers.has(key) ? Number(input.value) : input.value;
    let nextSettings = normalizeSettings({ ...targetRuntime.project.settings, [key]: value, preset: targetRuntime.project.settings.preset });
    if (key === "canvasPreset" && !["viewport", "custom"].includes(value)) nextSettings = normalizeSettings({ ...nextSettings, canvasWidth: CANVAS_PRESETS[value].width, canvasHeight: CANVAS_PRESETS[value].height });
    if (["canvasWidth", "canvasHeight"].includes(key)) nextSettings = normalizeSettings({ ...nextSettings, canvasPreset: "custom" });
    targetRuntime.project.settings = nextSettings;
    if (key === "quality") {
      targetRuntime.liveQuality = value === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : value;
      targetRuntime.paintCost = 0;
      targetRuntime.fastFrames = 0;
    }
    syncControls(targetRuntime);
    if (controls) {
      const restoreScroll = () => { if (controls.isConnected) controls.scrollTop = preservedScrollTop; };
      restoreScroll();
      globalScope.queueMicrotask?.(restoreScroll);
      globalScope.requestAnimationFrame?.(() => { restoreScroll(); targetRuntime.controlScrollAnchor = null; });
    }
    if (["symmetry", "guides", "mirror", "spiral", "grid"].includes(key)) drawGuides(targetRuntime);
    scheduleSave(targetRuntime);
  }

  function handleClick(event, targetRuntime = runtime) {
    const inspectorTab = event.target.closest("[data-draw-inspector-tab]"); if (inspectorTab) { setInspectorTab(inspectorTab.dataset.drawInspectorTab, targetRuntime, { focus: false }); return; }
    const accordionToggle = event.target.closest("[data-draw-accordion-toggle]"); if (accordionToggle) { toggleInspectorAccordion(accordionToggle.dataset.drawAccordionToggle, targetRuntime); return; }
    const accordionPin = event.target.closest("[data-draw-accordion-pin]"); if (accordionPin) { toggleInspectorPin(accordionPin.dataset.drawAccordionPin, targetRuntime); return; }
    if (event.target.closest("[data-draw-drawer-close]")) { closeInspectorDrawer(targetRuntime); return; }
    if (event.target.closest("[data-draw-eyedropper]")) { pickPrimaryColor(targetRuntime); return; }
    if (event.target.closest("[data-draw-color-copy]")) { copyPrimaryColor(targetRuntime); return; }
    if (event.target.closest("[data-draw-color-paste]")) { pastePrimaryColor(targetRuntime); return; }
    const layoutToggle = event.target.closest("[data-draw-layout-toggle]"); if (layoutToggle) { changeLayout(layoutToggle.dataset.drawLayoutToggle, targetRuntime); return; }
    if (event.target.closest("[data-draw-layout-reset]")) { changeLayout("reset", targetRuntime); return; }
    const panelJump = event.target.closest("[data-draw-jump]"); if (panelJump) { jumpToPanel(panelJump.dataset.drawJump, targetRuntime); return; }
    const favorite = event.target.closest("[data-draw-favorite]"); if (favorite) { toggleFavorite(favorite.dataset.drawFavorite, targetRuntime); return; }
    const generator = event.target.closest("[data-draw-generator]"); if (generator) { composePattern(generator.dataset.drawGenerator, targetRuntime); return; }
    if (event.target.closest("[data-draw-generator-remix]")) { remixPattern(targetRuntime); return; }
    if (event.target.closest("[data-draw-zen]")) { const active = targetRuntime.root.classList.toggle("is-zen"); targetRuntime.root.querySelectorAll("[data-draw-zen]").forEach((button) => button.setAttribute("aria-pressed", String(active))); toast(active ? "Zen Canvas · nhấn Z để thoát" : "Đã trở lại studio", targetRuntime); scheduleResize(targetRuntime); return; }
    const animationAction = event.target.closest("[data-draw-animation]"); if (animationAction) { const action = animationAction.dataset.drawAnimation; if (action === "play") playAnimation(targetRuntime); else if (action === "pause") pauseAnimation(targetRuntime); else { if (targetRuntime.exportingAnimation) targetRuntime.exportCancelled = true; stopAnimation(targetRuntime); } return; }
    const keyframe = event.target.closest("[data-draw-keyframe]"); if (keyframe) { updateKeyframe(keyframe.dataset.drawKeyframe, targetRuntime); return; }
    if (event.target.closest("[data-draw-animation-export]")) { exportAnimation(targetRuntime); return; }
    if (event.target.closest("[data-draw-audio-reactive]")) { toggleAudioReactive(targetRuntime); return; }
    if (event.target.closest("[data-draw-background-remove]")) { removeBackgroundMedia(targetRuntime); return; }
    if (event.target.closest("[data-draw-gradient-add]")) { const stops = [...targetRuntime.project.settings.customStops]; if (stops.length >= 8) toast("Gradient hỗ trợ tối đa 8 điểm màu", targetRuntime); else { stops.push(samplePalette(targetRuntime.project.settings, 0.5)); applyCustomStops(stops, targetRuntime); } return; }
    const removeStop = event.target.closest("[data-draw-gradient-remove]"); if (removeStop) { const stops = [...targetRuntime.project.settings.customStops]; if (stops.length > 2) { stops.splice(Number(removeStop.dataset.drawGradientRemove), 1); applyCustomStops(stops, targetRuntime); } return; }
    const harmony = event.target.closest("[data-draw-harmony]"); if (harmony) { applyCustomStops(harmonyColors(targetRuntime.project.settings.colorA, harmony.dataset.drawHarmony, targetRuntime.project.settings.paletteSeed), targetRuntime, `Đã tạo hòa sắc ${harmony.textContent.trim()}`); return; }
    const paletteExport = event.target.closest("[data-draw-palette-export]"); if (paletteExport) { exportPalette(paletteExport.dataset.drawPaletteExport, targetRuntime); return; }
    const shape = event.target.closest("[data-draw-select-shape]"); if (shape) { targetRuntime.selectionShape = shape.dataset.drawSelectShape; syncSelectionUi(targetRuntime); return; }
    const transform = event.target.closest("[data-draw-transform]"); if (transform) { transformSelection(transform.dataset.drawTransform, targetRuntime); return; }
    const tool = event.target.closest("[data-draw-tool]"); if (tool) { setTool(tool.dataset.drawTool, targetRuntime); return; }
    const view = event.target.closest("[data-draw-view]"); if (view) { updateView(view.dataset.drawView, targetRuntime); return; }
    const modeFilter = event.target.closest("[data-draw-mode-filter]");
    if (modeFilter) {
      const id = modeFilter.dataset.drawModeFilter;
      targetRuntime.brushFilter = id;
      targetRuntime.root.querySelectorAll("[data-draw-mode-filter]").forEach((button) => { const active = button === modeFilter; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
      applyBrushFilters(targetRuntime);
      return;
    }
    const layerAction = event.target.closest("[data-draw-layer-select],[data-draw-layer-visible],[data-draw-layer-lock],[data-draw-layer-add],[data-draw-layer-duplicate],[data-draw-layer-up],[data-draw-layer-down],[data-draw-layer-merge],[data-draw-layer-delete]");
    if (layerAction && handleLayerAction(layerAction, targetRuntime)) return;
    const preset = event.target.closest("[data-draw-preset]"); if (preset) { applyPreset(preset.dataset.drawPreset, targetRuntime); return; }
    const palette = event.target.closest("[data-draw-palette]");
    if (palette) {
      const id = palette.dataset.drawPalette;
      if (COLOR_PALETTES[id]) {
        targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, paletteId: id, autoHue: false });
        syncControls(targetRuntime); scheduleSave(targetRuntime); announce(`Bảng màu ${COLOR_PALETTES[id].label}`, targetRuntime);
      }
      return;
    }
    const color = event.target.closest("[data-draw-color]"); if (color) { const selected = color.dataset.drawColor.toLowerCase(); targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorA: selected, customStops: [selected, ...targetRuntime.project.settings.customStops.slice(1)], paletteId: "custom" }); syncControls(targetRuntime); syncGradientEditor(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.closest("[data-draw-new]")) { clearDrawing(targetRuntime); return; }
    if (event.target.closest("[data-draw-save]")) { saveNow(targetRuntime); return; }
    if (event.target.closest("[data-draw-undo]")) { undo(targetRuntime); return; }
    if (event.target.closest("[data-draw-redo]")) { redo(targetRuntime); return; }
    if (event.target.closest("[data-draw-export]")) { exportCanvas(targetRuntime); return; }
    if (event.target.closest("[data-draw-export-svg]")) { exportSvg(targetRuntime); return; }
    if (event.target.closest("[data-draw-export-layers]")) { exportLayers(targetRuntime); return; }
    if (event.target.closest("[data-draw-copy]")) { exportCanvas(targetRuntime, { copy: true }); return; }
    if (event.target.closest("[data-draw-project-export]")) { exportProject(targetRuntime); return; }
    if (event.target.closest("[data-draw-brush-export]")) { exportBrushPreset(targetRuntime); return; }
    if (event.target.closest("[data-draw-fullscreen]")) { const node = targetRuntime.root; if (globalScope.document.fullscreenElement) globalScope.document.exitFullscreen?.(); else node.requestFullscreen?.(); return; }
    if (event.target.closest("[data-draw-panel-open]")) { targetRuntime.root.classList.add("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-close]")?.focus(); return; }
    if (event.target.closest("[data-draw-panel-close]")) { closeInspectorDrawer(targetRuntime, { restoreFocus: false }); targetRuntime.root.classList.remove("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-open]")?.focus(); return; }
    if (event.target.closest("[data-draw-guides-toggle]")) { targetRuntime.project.settings.guides = !targetRuntime.project.settings.guides; syncControls(targetRuntime); drawGuides(targetRuntime); scheduleSave(targetRuntime); }
    if (event.target.closest("[data-draw-checkpoint-restore]")) { restoreLatestCheckpoint(targetRuntime); return; }
  }

  function handleChange(event, targetRuntime = runtime) {
    if (event.target.matches("[data-draw-close-after-select]")) { targetRuntime.inspectorState.closeLibraryAfterSelect = event.target.checked; saveInspectorState(targetRuntime); return; }
    if (event.target.matches("[data-draw-color-code]")) { applyPrimaryColor(event.target.value, targetRuntime); return; }
    if (event.target.matches("[data-draw-animation-setting]")) { updateAnimationSetting(event.target, targetRuntime); return; }
    if (event.target.matches("[data-draw-timeline]")) { pauseAnimation(targetRuntime); targetRuntime.playbackProgress = clamp(event.target.value, 0, 1, 0); renderPlayback(targetRuntime); return; }
    if (event.target.matches("[data-draw-gradient-stop]")) { const stops = [...targetRuntime.project.settings.customStops]; stops[Number(event.target.dataset.drawGradientStop)] = normalizeHex(event.target.value, stops[0]); applyCustomStops(stops, targetRuntime); return; }
    if (event.target.matches("[data-draw-palette-seed]")) { targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, paletteSeed: event.target.value }); scheduleSave(targetRuntime); return; }
    if (event.target.matches("[data-draw-palette-image]")) { extractPaletteFromImage(event.target.files?.[0], targetRuntime); event.target.value = ""; return; }
    if (event.target.matches("[data-draw-layer-name],[data-draw-layer-type],[data-draw-layer-blend],[data-draw-layer-opacity]")) { updateActiveLayerControl(event.target, targetRuntime); return; }
    if (event.target.matches("[data-draw-color-a]")) { const stops = [...targetRuntime.project.settings.customStops]; stops[0] = event.target.value; targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorA: event.target.value, customStops: stops, paletteId: "custom" }); syncControls(targetRuntime); syncGradientEditor(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.matches("[data-draw-color-b]")) { const stops = [...targetRuntime.project.settings.customStops]; stops[stops.length - 1] = event.target.value; targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorB: event.target.value, customStops: stops, paletteId: "custom" }); syncControls(targetRuntime); syncGradientEditor(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.matches("[data-draw-setting]")) updateSetting(event.target, targetRuntime);
    if (event.target.matches("[data-draw-project-import]")) { importProject(event.target.files?.[0], targetRuntime); event.target.value = ""; }
    if (event.target.matches("[data-draw-brush-import]")) { importBrushPreset(event.target.files?.[0], targetRuntime); event.target.value = ""; }
    if (event.target.matches("[data-draw-background-media]")) { loadBackgroundMedia(event.target.files?.[0], targetRuntime); event.target.value = ""; }
  }

  function handleKeydown(event, targetRuntime = runtime) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable === true || Boolean(event.target?.closest?.("[contenteditable]:not([contenteditable='false'])"));
    if (event.key === "Escape" && targetRuntime.activeDrawer) { event.preventDefault(); closeInspectorDrawer(targetRuntime); return; }
    if (event.key === "Escape" && targetRuntime.root.classList.contains("is-panel-open")) { targetRuntime.root.classList.remove("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-open]")?.focus(); return; }
    const activeTabButton = event.target?.closest?.("[data-draw-inspector-tab]");
    if (activeTabButton && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault(); const current = INSPECTOR_TABS.indexOf(activeTabButton.dataset.drawInspectorTab); const next = event.key === "Home" ? 0 : event.key === "End" ? INSPECTOR_TABS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + INSPECTOR_TABS.length) % INSPECTOR_TABS.length; setInspectorTab(INSPECTOR_TABS[next], targetRuntime, { focus: true }); return;
    }
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo(targetRuntime) : undo(targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveNow(targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) { event.preventDefault(); updateView("zoom-in", targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === "-") { event.preventDefault(); updateView("zoom-out", targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); transformSelection("duplicate", targetRuntime); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && targetRuntime.selectionIds?.size) { event.preventDefault(); transformSelection("delete", targetRuntime); return; }
    if (event.key === "0") { event.preventDefault(); updateView("fit", targetRuntime); return; }
    if (event.key === "1") { event.preventDefault(); updateView("reset", targetRuntime); return; }
    if (event.code === "Space") { event.preventDefault(); targetRuntime.spacePressed = true; targetRuntime.root.classList.add("is-space-pan"); return; }
    if (event.key.toLowerCase() === "b") { event.preventDefault(); setTool("draw", targetRuntime); return; }
    if (event.key.toLowerCase() === "e") { event.preventDefault(); setTool("eraser", targetRuntime); return; }
    if (event.key.toLowerCase() === "v") { event.preventDefault(); setTool("select", targetRuntime); return; }
    if (event.key.toLowerCase() === "h") { event.preventDefault(); setTool("pan", targetRuntime); return; }
    if (event.key.toLowerCase() === "f") { event.preventDefault(); targetRuntime.root.requestFullscreen?.(); return; }
    if (event.key.toLowerCase() === "z") { event.preventDefault(); const active = targetRuntime.root.classList.toggle("is-zen"); targetRuntime.root.querySelectorAll("[data-draw-zen]").forEach((button) => button.setAttribute("aria-pressed", String(active))); scheduleResize(targetRuntime); return; }
  }

  function handleKeyup(event, targetRuntime = runtime) {
    if (event.code === "Space" && targetRuntime) { targetRuntime.spacePressed = false; targetRuntime.root.classList.remove("is-space-pan"); }
  }

  function mount(root, options = {}) {
    if (!root || !globalScope.document) return false;
    unmount();
    const storageKey = ownerKey(options.currentUser);
    const project = storageRead(storageKey);
    const brushLibrary = readBrushLibrary(storageKey);
    const layout = readLayout(storageKey);
    const inspectorState = readInspectorState(storageKey);
    root.innerHTML = markup(project, brushLibrary, inspectorState);
    const studio = root.firstElementChild;
    const canvas = studio.querySelector("[data-draw-canvas]");
    const guideCanvas = studio.querySelector("[data-draw-guides]");
    const minimap = studio.querySelector("[data-draw-minimap]");
    if (!canvas || !guideCanvas) return false;
    const initialQuality = project.settings.quality === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : project.settings.quality;
    runtime = { host: root, root: studio, canvas, guideCanvas, minimap, project, storageKey, layout, inspectorState, activeDrawer: "", drawerOpener: null, favoriteBrushes: new Set(brushLibrary.favorites), recentBrushes: brushLibrary.recent, brushFilter: "all", brushSearch: "", historyUndo: [], historyRedo: [], historyActionCount: 0, pendingHistory: "", checkpointPending: false, userChangedProject: false, controlScrollAnchor: null, layerCache: new Map(), renderWorker: null, workerBusy: false, workerRequestId: 0, activeLayerBuffer: null, activeStroke: null, drawing: false, panning: false, panStart: null, touchPointers: new Map(), gesture: null, selecting: false, selectionShape: "rect", selectionPath: [], selectionScreen: null, selectionRegion: null, selectionIds: new Set(), playbackProgress: 0, playbackFrame: 0, isPlaying: false, exportingAnimation: false, exportCancelled: false, audioLevel: 0, audioStream: null, audioContext: null, audioFrame: 0, spacePressed: false, tool: "draw", dpr: 1, saved: true, saveFailed: false, resizeObserver: null, resizeFrame: 0, drawFrame: 0, pointQueue: [], drawRect: null, paintCost: 0, fastFrames: 0, liveQuality: initialQuality, saveTimer: 0, toastTimer: 0 };
    runtime.onClick = (event) => handleClick(event, runtime);
    runtime.onChange = (event) => handleChange(event, runtime);
    runtime.onInput = (event) => { if (event.target.matches("[data-draw-brush-search]")) { runtime.brushSearch = event.target.value; applyBrushFilters(runtime); } else if (event.target.matches("input[type=range][data-draw-setting]")) updateSetting(event.target, runtime); else if (event.target.matches('input[type=range][data-draw-animation-setting]')) updateAnimationSetting(event.target, runtime); else if (event.target.matches("[data-draw-timeline]")) { runtime.playbackProgress = clamp(event.target.value, 0, 1, 0); renderPlayback(runtime); } };
    runtime.onKeydown = (event) => handleKeydown(event, runtime);
    runtime.onKeyup = (event) => handleKeyup(event, runtime);
    runtime.onPointerDown = (event) => beginStroke(event, runtime);
    runtime.onPointerMove = (event) => appendPoint(event, runtime);
    runtime.onPointerUp = (event) => finishStroke(event, runtime);
    runtime.onPointerLeave = () => runtime?.root.querySelector("[data-draw-brush-cursor]")?.classList.remove("is-visible");
    runtime.onControlPointerDown = (event) => { if (event.target.closest?.(".draw-switch")) runtime.controlScrollAnchor = runtime.root.querySelector(".draw-controls")?.scrollTop ?? null; };
    runtime.onVisibility = () => { if (!runtime) return; runtime.root.classList.toggle("is-page-hidden", globalScope.document.hidden); if (!globalScope.document.hidden) return; if (runtime.drawing) finishStroke({ pointerId: -1 }, runtime); if (runtime.isPlaying) pauseAnimation(runtime); if (runtime.audioStream) toggleAudioReactive(runtime); };
    studio.addEventListener("click", runtime.onClick);
    studio.addEventListener("change", runtime.onChange);
    studio.addEventListener("input", runtime.onInput);
    studio.addEventListener("keydown", runtime.onKeydown);
    studio.addEventListener("pointerdown", runtime.onControlPointerDown, true);
    canvas.addEventListener("pointerdown", runtime.onPointerDown);
    canvas.addEventListener("pointermove", runtime.onPointerMove);
    canvas.addEventListener("pointerup", runtime.onPointerUp);
    canvas.addEventListener("pointercancel", runtime.onPointerUp);
    canvas.addEventListener("pointerleave", runtime.onPointerLeave);
    canvas.addEventListener("wheel", runtime.onWheel = (event) => handleCanvasWheel(event, runtime), { passive: false });
    minimap?.addEventListener("pointerdown", runtime.onMinimapPointer = (event) => handleMinimapPointer(event, runtime));
    globalScope.document.addEventListener("visibilitychange", runtime.onVisibility);
    globalScope.document.addEventListener("keyup", runtime.onKeyup);
    runtime.resizeObserver = typeof globalScope.ResizeObserver === "function" ? new globalScope.ResizeObserver(() => scheduleResize(runtime)) : null;
    runtime.resizeObserver?.observe(canvas);
    syncLayoutUi(runtime, { resize: false });
    syncInspectorUi(runtime);
    globalScope.requestAnimationFrame?.(() => { resizeCanvases(runtime); syncControls(runtime); syncBrushLibraryUi(runtime); announce("Đã sẵn sàng · kéo để vẽ", runtime); });
    hydrateFromDatabase(runtime);
    return true;
  }

  function unmount() {
    if (!runtime) return;
    globalScope.clearTimeout(runtime.saveTimer);
    globalScope.clearTimeout(runtime.toastTimer);
    globalScope.cancelAnimationFrame?.(runtime.drawFrame);
    globalScope.cancelAnimationFrame?.(runtime.resizeFrame);
    globalScope.cancelAnimationFrame?.(runtime.playbackFrame);
    globalScope.cancelAnimationFrame?.(runtime.audioFrame);
    globalScope.cancelAnimationFrame?.(runtime.backgroundFrame);
    runtime.backgroundMedia?.element?.pause?.();
    if (runtime.backgroundMedia?.url) globalScope.URL.revokeObjectURL(runtime.backgroundMedia.url);
    runtime.audioStream?.getTracks?.().forEach((track) => track.stop());
    runtime.audioContext?.close?.();
    runtime.resizeObserver?.disconnect?.();
    runtime.renderWorker?.terminate?.();
    runtime.root?.removeEventListener("click", runtime.onClick);
    runtime.root?.removeEventListener("change", runtime.onChange);
    runtime.root?.removeEventListener("input", runtime.onInput);
    runtime.root?.removeEventListener("keydown", runtime.onKeydown);
    runtime.root?.removeEventListener("pointerdown", runtime.onControlPointerDown, true);
    runtime.canvas?.removeEventListener("pointerdown", runtime.onPointerDown);
    runtime.canvas?.removeEventListener("pointermove", runtime.onPointerMove);
    runtime.canvas?.removeEventListener("pointerup", runtime.onPointerUp);
    runtime.canvas?.removeEventListener("pointercancel", runtime.onPointerUp);
    runtime.canvas?.removeEventListener("pointerleave", runtime.onPointerLeave);
    runtime.canvas?.removeEventListener("wheel", runtime.onWheel);
    runtime.minimap?.removeEventListener("pointerdown", runtime.onMinimapPointer);
    globalScope.document?.removeEventListener("visibilitychange", runtime.onVisibility);
    globalScope.document?.removeEventListener("keyup", runtime.onKeyup);
    storageWrite(runtime.storageKey, runtime.project);
    runtime = null;
  }

  function inspect() {
    return { version: VERSION, mounted: Boolean(runtime), strokes: runtime ? projectStrokes(runtime.project).length : 0, layers: runtime?.project.layers.length || 0, preset: runtime?.project.settings.preset || DEFAULT_SETTINGS.preset, brushMode: runtime?.project.settings.brushMode || DEFAULT_SETTINGS.brushMode, paletteId: runtime?.project.settings.paletteId || DEFAULT_SETTINGS.paletteId, quality: runtime?.project.settings.quality || DEFAULT_SETTINGS.quality };
  }

  function renderLayerBitmap(inputLayer, inputSettings, pixelWidth, pixelHeight, ratio = 1, quality = "performance") {
    if (typeof globalScope.OffscreenCanvas !== "function") return null;
    const project = normalizeProject({ settings: inputSettings, layers: [inputLayer], activeLayerId: inputLayer?.id }); const layer = project.layers[0]; const targetRuntime = { project, liveQuality: QUALITY_PROFILES[quality] ? quality : "performance", layerCache: null };
    return renderLayerBuffer(layer, targetRuntime, Math.max(1, pixelWidth / ratio), Math.max(1, pixelHeight / ratio), ratio, 1, false);
  }

  return { VERSION, STORAGE_SCHEMA, BRUSH_LIBRARY_SCHEMA, LAYOUT_SCHEMA, INSPECTOR_SCHEMA, DEFAULT_LAYOUT, DEFAULT_INSPECTOR_STATE, INSPECTOR_TABS, INSPECTOR_GROUPS, PALETTE, COLOR_PALETTES, PRESETS, BRUSH_MODES, PATTERN_GENERATORS, DEFAULT_SETTINGS, QUALITY_PROFILES, LAYER_BLEND_MODES, LAYER_TYPES, CANVAS_PRESETS, normalizeLayout, normalizeInspectorState, normalizeSettings, normalizeProject, normalizeLayer, projectStrokes, projectRenderCost, resolveQualityProfile, buildSymmetryPoints, generatePatternStrokes, mixHex, samplePalette, harmonyColors, renderLayerBitmap, mount, unmount, inspect };
});
