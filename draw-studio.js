(function (globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) globalScope.HHDrawStudio = api;
})(typeof window !== "undefined" ? window : globalThis, function createDrawStudio(globalScope) {
  "use strict";

  const VERSION = "1.2.0";
  const STORAGE_SCHEMA = "hh.draw.studio.v1";
  const MAX_STROKES = 120;
  const MAX_POINTS_PER_STROKE = 1400;
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
    ink: { label: "Moon Ink", icon: "◐", brushMode: "ink", paletteId: "mono", symmetry: 2, mirror: false, spiral: false, brushSize: 3.8, glow: 8, flow: 0.76, colorA: "#d4dcf3", colorB: "#ffffff", autoHue: false }
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
    quality: "auto",
    colorA: "#45d9ff",
    colorB: "#bd65ff",
    autoHue: false,
    guides: true,
    background: "cosmic",
    exportScale: 2,
    exportFormat: "png"
  });

  const QUALITY_PROFILES = Object.freeze({
    quality: Object.freeze({ id: "quality", fibers: 5, linkOffsets: [5, 10, 15, 20], blur: 1, particles: 3, detail: 1 }),
    balanced: Object.freeze({ id: "balanced", fibers: 3, linkOffsets: [7, 14], blur: 0.72, particles: 2, detail: 0.72 }),
    performance: Object.freeze({ id: "performance", fibers: 1, linkOffsets: [12], blur: 0.4, particles: 1, detail: 0.4 })
  });

  let runtime = null;
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
      quality: ["auto", "quality", "balanced", "performance"].includes(input.quality) ? input.quality : DEFAULT_SETTINGS.quality,
      colorA: normalizeHex(input.colorA, DEFAULT_SETTINGS.colorA),
      colorB: normalizeHex(input.colorB, DEFAULT_SETTINGS.colorB),
      autoHue: Boolean(input.autoHue),
      guides: input.guides !== false,
      background: ["cosmic", "black", "midnight", "transparent"].includes(input.background) ? input.background : DEFAULT_SETTINGS.background,
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
      time: Math.max(0, Number(point?.time) || 0)
    };
  }

  function normalizeStroke(stroke, index = 0) {
    const points = Array.isArray(stroke?.points) ? stroke.points.slice(-MAX_POINTS_PER_STROKE).map(normalizePoint) : [];
    return {
      id: String(stroke?.id || `stroke-${index}`),
      settings: normalizeSettings(stroke?.settings || {}),
      points
    };
  }

  function normalizeProject(input = {}) {
    return {
      schema: STORAGE_SCHEMA,
      version: 1,
      settings: normalizeSettings(input.settings || {}),
      strokes: Array.isArray(input.strokes) ? input.strokes.slice(-MAX_STROKES).map(normalizeStroke).filter((stroke) => stroke.points.length) : [],
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

  function storageRead(key) {
    try { return normalizeProject(JSON.parse(globalScope.localStorage?.getItem(key) || "{}")); } catch { return normalizeProject(); }
  }

  function storageWrite(key, project) {
    try {
      const compact = { ...project, strokes: project.strokes.slice(-MAX_STROKES), updatedAt: new Date().toISOString() };
      globalScope.localStorage?.setItem(key, JSON.stringify(compact));
      return true;
    } catch { return false; }
  }

  function presetMarkup(settings) {
    return Object.entries(PRESETS).map(([id, preset]) => `<button type="button" class="draw-preset ${settings.preset === id ? "is-active" : ""}" data-draw-preset="${id}" aria-pressed="${settings.preset === id}"><i>${preset.icon}</i><span>${escapeHtml(preset.label)}</span></button>`).join("");
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

  function markup(project) {
    const settings = project.settings;
    return `<section class="draw-studio" data-draw-studio data-background="${settings.background}">
      <div class="draw-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="draw-topbar">
        <div class="draw-brand"><span>✦</span><div><small>HH CREATIVE LIGHT LAB</small><strong>Vẽ · Chromatic Studio</strong></div></div>
        <nav aria-label="Thao tác dự án">
          <button type="button" data-draw-new><i>＋</i><span>Mới</span></button>
          <button type="button" data-draw-undo disabled><i>↶</i><span>Hoàn tác</span></button>
          <button type="button" data-draw-redo disabled><i>↷</i><span>Làm lại</span></button>
          <button type="button" data-draw-copy><i>▣</i><span>Sao chép</span></button>
          <button type="button" data-draw-fullscreen><i>⛶</i><span>Toàn màn hình</span></button>
          <button type="button" class="draw-primary" data-draw-export><i>↓</i><span>Tải ảnh</span></button>
        </nav>
      </header>
      <div class="draw-workspace">
        <aside class="draw-controls" aria-label="Điều khiển nét vẽ">
          <header><div><small>ĐIỀU KHIỂN</small><strong>Tạo ánh sáng của bạn</strong></div><button type="button" data-draw-panel-close aria-label="Đóng bảng điều khiển">×</button></header>
          <section><h3>16 chế độ nét động</h3><div class="draw-preset-grid">${presetMarkup(settings)}</div></section>
          <section><h3>Bảng màu đa sắc</h3><div class="draw-gradient-grid">${colorPaletteMarkup(settings)}</div><details class="draw-custom-color"><summary>Tùy chỉnh màu riêng</summary><div class="draw-palette">${paletteMarkup(settings)}</div><div class="draw-color-mix"><label><span>Màu chính</span><input type="color" data-draw-color-a value="${settings.colorA}"></label><i>＋</i><label><span>Màu hòa</span><input type="color" data-draw-color-b value="${settings.colorB}"></label><b data-draw-mix-preview style="--mix:${mixHex(settings.colorA, settings.colorB)}"></b></div></details><label class="draw-switch"><span><strong>Cầu vồng chuyển động</strong><small>Tự chạy toàn bộ phổ màu theo chiều dài nét</small></span><input type="checkbox" data-draw-setting="autoHue" ${settings.autoHue ? "checked" : ""}><i></i></label></section>
          <section><h3>Đối xứng</h3><label class="draw-range"><span><b>Đối xứng quay</b><output data-draw-output="symmetry">${settings.symmetry} nhánh</output></span><input type="range" min="1" max="12" step="1" value="${settings.symmetry}" data-draw-setting="symmetry"></label><label class="draw-switch"><span><strong>Phản chiếu qua tâm</strong><small>Nhân đôi nét qua mỗi trục</small></span><input type="checkbox" data-draw-setting="mirror" ${settings.mirror ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Xoáy vào trung tâm</strong><small>Tạo các lớp thu nhỏ hướng tâm</small></span><input type="checkbox" data-draw-setting="spiral" ${settings.spiral ? "checked" : ""}><i></i></label><label class="draw-switch"><span><strong>Hiện đường dẫn</strong><small>Lưới chỉ dẫn không đi vào ảnh xuất</small></span><input type="checkbox" data-draw-setting="guides" ${settings.guides ? "checked" : ""}><i></i></label></section>
          <section><h3>Nét vẽ & hiệu năng</h3><label class="draw-select-row"><span><strong>Chất lượng realtime</strong><small>Tự điều chỉnh để nét luôn bám sát con trỏ</small></span><select data-draw-setting="quality"><option value="auto"${settings.quality === "auto" ? " selected" : ""}>Tự động thông minh</option><option value="quality"${settings.quality === "quality" ? " selected" : ""}>Chất lượng cao</option><option value="balanced"${settings.quality === "balanced" ? " selected" : ""}>Cân bằng</option><option value="performance"${settings.quality === "performance" ? " selected" : ""}>Ưu tiên tốc độ</option></select></label><label class="draw-range"><span><b>Độ dày</b><output data-draw-output="brushSize">${settings.brushSize.toFixed(1)} px</output></span><input type="range" min="0.5" max="8" step="0.1" value="${settings.brushSize}" data-draw-setting="brushSize"></label><label class="draw-range"><span><b>Hào quang</b><output data-draw-output="glow">${Math.round(settings.glow)}%</output></span><input type="range" min="0" max="48" step="1" value="${settings.glow}" data-draw-setting="glow"></label><label class="draw-range"><span><b>Độ mềm</b><output data-draw-output="flow">${Math.round(settings.flow * 100)}%</output></span><input type="range" min="0.15" max="1" step="0.01" value="${settings.flow}" data-draw-setting="flow"></label></section>
          <section><h3>Xuất ảnh</h3><div class="draw-inline"><label><span>Nền</span><select data-draw-setting="background"><option value="cosmic"${settings.background === "cosmic" ? " selected" : ""}>Vũ trụ</option><option value="midnight"${settings.background === "midnight" ? " selected" : ""}>Xanh đêm</option><option value="black"${settings.background === "black" ? " selected" : ""}>Đen</option><option value="transparent"${settings.background === "transparent" ? " selected" : ""}>Trong suốt</option></select></label><label><span>Định dạng</span><select data-draw-setting="exportFormat"><option value="png"${settings.exportFormat === "png" ? " selected" : ""}>PNG</option><option value="webp"${settings.exportFormat === "webp" ? " selected" : ""}>WebP</option><option value="jpeg"${settings.exportFormat === "jpeg" ? " selected" : ""}>JPEG</option></select></label><label><span>Độ phân giải</span><select data-draw-setting="exportScale"><option value="1"${settings.exportScale === 1 ? " selected" : ""}>1×</option><option value="2"${settings.exportScale === 2 ? " selected" : ""}>2×</option><option value="4"${settings.exportScale === 4 ? " selected" : ""}>4×</option></select></label></div><button type="button" class="draw-wide" data-draw-project-export>Xuất project JSON</button><label class="draw-import"><input type="file" accept="application/json,.json" data-draw-project-import><span>Nhập project JSON</span></label></section>
        </aside>
        <main class="draw-canvas-stage">
          <canvas data-draw-canvas tabindex="0" aria-label="Khung vẽ ánh sáng. Giữ chuột hoặc chạm và kéo để vẽ.">Trình duyệt chưa hỗ trợ Canvas.</canvas>
          <canvas class="draw-guide-canvas" data-draw-guides aria-hidden="true"></canvas>
          <div class="draw-empty" data-draw-empty><i>✦</i><strong>Chạm và kéo để đánh thức sắc màu</strong><span>Chọn một brush engine, bảng màu rồi kéo nét — tác phẩm xuất hiện tức thì.</span></div>
          <button type="button" class="draw-panel-toggle" data-draw-panel-open aria-label="Mở bảng điều khiển">☰ <span>Điều khiển</span></button>
          <div class="draw-canvas-status" aria-live="polite"><span><i></i><b data-draw-status>Đã sẵn sàng</b></span><small data-draw-performance>Auto · Cân bằng</small><small data-draw-stats>${project.strokes.length} nét · tự lưu trên thiết bị</small></div>
          <div class="draw-quickbar">
            <button type="button" data-draw-new title="Tạo bản vẽ mới">＋</button>
            <button type="button" data-draw-undo title="Hoàn tác" disabled>↶</button>
            <button type="button" data-draw-redo title="Làm lại" disabled>↷</button>
            <button type="button" data-draw-guides-toggle title="Bật hoặc tắt lưới" aria-pressed="${settings.guides}">⌗</button>
            <button type="button" data-draw-export title="Tải ảnh">↓</button>
          </div>
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

  function paletteStops(settings) {
    const selected = COLOR_PALETTES[settings.paletteId];
    return selected?.stops?.length ? selected.stops : [settings.colorA, settings.colorB];
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
    const wave = (Math.sin(segmentIndex * 0.055 + phase * Math.PI * 2) + 1) / 2;
    return samplePalette(stroke.settings, wave);
  }

  function profileFor(targetRuntime, settings, forceQuality = false) {
    if (forceQuality) return QUALITY_PROFILES.quality;
    if (settings.quality !== "auto") return resolveQualityProfile(settings.quality);
    return QUALITY_PROFILES[targetRuntime?.liveQuality] || QUALITY_PROFILES.balanced;
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
    const transforms = transformsForSettings(stroke.settings);
    const colors = [0, 0.18, 0.37, 0.58, 0.78].map((phase) => segmentColor(stroke, segmentIndex, phase));
    const speed = Math.hypot((current.x - previous.x) * width, (current.y - previous.y) * height);
    const pressure = current.pressure || 0.5;
    const baseWidth = stroke.settings.brushSize * (0.72 + pressure * 0.56) * scale;
    const geometry = segmentGeometry(previous, current, transforms, width, height);
    const mode = stroke.settings.brushMode || "silk";
    const speedFade = Math.max(0.48, 1 - speed / 90);
    const wave = Math.sin(segmentIndex * 0.32);
    ctx.save();
    ctx.globalCompositeOperation = mode === "ink" ? "source-over" : mode === "nebula" ? "screen" : "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const paint = (color, widthFactor, alpha, blurFactor = 0.5, offset = 0, bend = 0, angular = false) => {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = stroke.settings.glow * scale * qualityProfile.blur * blurFactor;
      ctx.globalAlpha = Math.min(0.88, alpha * speedFade);
      ctx.lineWidth = Math.max(0.2, baseWidth * widthFactor);
      traceGeometry(ctx, geometry, offset * scale, bend * scale, angular);
    };

    if (["silk", "lotus", "quantum", "galaxy"].includes(mode)) {
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
        ctx.shadowBlur = stroke.settings.glow * scale * 0.65;
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
      const jag = (Math.sin(segmentIndex * 2.73) + Math.sin(segmentIndex * 0.91)) * 3.8;
      paint(colors[0], 3.2, 0.09, 1.2, 0, jag, true);
      paint(colors[2], 0.82, 0.54, 0.7, 0, jag, true);
      paint("#ffffff", 0.2, 0.78, 0.15, 0, jag, true);
      if (qualityProfile.detail > 0.4 && segmentIndex % 5 === 0) {
        ctx.strokeStyle = colors[3]; ctx.shadowColor = colors[3]; ctx.shadowBlur = stroke.settings.glow * 0.5 * scale; ctx.lineWidth = Math.max(0.25, baseWidth * 0.28); ctx.globalAlpha = 0.32;
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
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = colors[0]; ctx.shadowBlur = stroke.settings.glow * scale; ctx.globalAlpha = 0.74;
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
    }
    ctx.restore();
  }

  function drawSilkLinks(ctx, stroke, segmentIndex, width, height, scale = 1, qualityProfile = QUALITY_PROFILES.balanced) {
    const current = stroke.points[segmentIndex];
    const mode = stroke.settings.brushMode || "silk";
    if (!current || segmentIndex < 5 || !["silk", "lotus", "quantum", "galaxy"].includes(mode)) return;
    const color = segmentColor(stroke, segmentIndex);
    const transforms = transformsForSettings(stroke.settings);
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

  function renderStroke(ctx, stroke, width, height, scale = 1, qualityProfile = QUALITY_PROFILES.balanced, startAt = 1) {
    for (let index = Math.max(1, startAt); index < stroke.points.length; index += 1) {
      drawFiberSegment(ctx, stroke.points[index - 1], stroke.points[index], stroke, index, width, height, scale, qualityProfile);
      drawSilkLinks(ctx, stroke, index, width, height, scale, qualityProfile);
    }
  }

  function renderAll(targetRuntime = runtime, { targetCanvas, includeBackground = false, scale = 1 } = {}) {
    if (!targetRuntime) return;
    const canvas = targetCanvas || targetRuntime.canvas;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return;
    const width = canvas.width / (targetCanvas ? 1 : targetRuntime.dpr);
    const height = canvas.height / (targetCanvas ? 1 : targetRuntime.dpr);
    ctx.save();
    ctx.setTransform(targetCanvas ? 1 : targetRuntime.dpr, 0, 0, targetCanvas ? 1 : targetRuntime.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (includeBackground) backgroundFill(ctx, width, height, targetRuntime.project.settings.background);
    targetRuntime.project.strokes.forEach((stroke) => renderStroke(ctx, stroke, width, height, scale, profileFor(targetRuntime, stroke.settings, Boolean(targetCanvas))));
    ctx.restore();
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
    ctx.translate(width / 2, height / 2);
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
    renderAll(targetRuntime);
    drawGuides(targetRuntime);
  }

  function scheduleResize(targetRuntime = runtime) {
    if (!targetRuntime) return;
    globalScope.cancelAnimationFrame?.(targetRuntime.resizeFrame);
    targetRuntime.resizeFrame = globalScope.requestAnimationFrame?.(() => { targetRuntime.resizeFrame = 0; resizeCanvases(targetRuntime); });
  }

  function updateUi(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const strokes = targetRuntime.project.strokes.length;
    targetRuntime.root.querySelectorAll("[data-draw-undo]").forEach((button) => { button.disabled = !strokes; });
    targetRuntime.root.querySelectorAll("[data-draw-redo]").forEach((button) => { button.disabled = !targetRuntime.redo.length; });
    const empty = targetRuntime.root.querySelector("[data-draw-empty]");
    if (empty) empty.hidden = Boolean(strokes || targetRuntime.activeStroke);
    const stats = targetRuntime.root.querySelector("[data-draw-stats]");
    if (stats) stats.textContent = `${strokes} nét · ${targetRuntime.saved ? "đã tự lưu" : "đang lưu"} trên thiết bị`;
    const performance = targetRuntime.root.querySelector("[data-draw-performance]");
    if (performance) {
      const labels = { quality: "Chất lượng cao", balanced: "Cân bằng", performance: "Ưu tiên tốc độ" };
      const selected = targetRuntime.project.settings.quality;
      performance.textContent = selected === "auto" ? `Auto · ${labels[targetRuntime.liveQuality] || "Cân bằng"}` : labels[selected];
    }
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

  function scheduleSave(targetRuntime = runtime) {
    if (!targetRuntime) return;
    targetRuntime.saved = false;
    updateUi(targetRuntime);
    globalScope.clearTimeout(targetRuntime.saveTimer);
    targetRuntime.saveTimer = globalScope.setTimeout(() => {
      targetRuntime.saved = storageWrite(targetRuntime.storageKey, targetRuntime.project);
      updateUi(targetRuntime);
    }, 280);
  }

  function pointerPoint(event, targetRuntime = runtime, inputRect = null) {
    const rect = inputRect || targetRuntime.drawRect || targetRuntime.canvas.getBoundingClientRect();
    return normalizePoint({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
      pressure: event.pressure > 0 ? event.pressure : event.pointerType === "mouse" ? 0.5 : 0.42,
      time: globalScope.performance?.now?.() || Date.now()
    });
  }

  function beginStroke(event, targetRuntime = runtime) {
    if (!targetRuntime || targetRuntime.drawing || event.button > 0) return;
    event.preventDefault();
    targetRuntime.canvas.setPointerCapture?.(event.pointerId);
    targetRuntime.drawRect = targetRuntime.canvas.getBoundingClientRect();
    targetRuntime.pointQueue.length = 0;
    const point = pointerPoint(event, targetRuntime, targetRuntime.drawRect);
    targetRuntime.activeStroke = { id: `stroke-${Date.now()}-${Math.round(Math.random() * 1e5)}`, settings: normalizeSettings(targetRuntime.project.settings), points: [point] };
    targetRuntime.redo.length = 0;
    targetRuntime.drawing = true;
    targetRuntime.root.classList.add("is-drawing");
    announce("Đang dệt ánh sáng…", targetRuntime);
    updateUi(targetRuntime);
  }

  function updateAdaptiveQuality(targetRuntime, cost) {
    targetRuntime.paintCost = targetRuntime.paintCost ? targetRuntime.paintCost * 0.82 + cost * 0.18 : cost;
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

  function flushPointQueue(targetRuntime = runtime) {
    if (!targetRuntime?.drawing || !targetRuntime.activeStroke || !targetRuntime.pointQueue.length) return;
    const startedAt = globalScope.performance?.now?.() || Date.now();
    const points = targetRuntime.pointQueue.splice(0);
    const stroke = targetRuntime.activeStroke;
    const rect = targetRuntime.drawRect || targetRuntime.canvas.getBoundingClientRect();
    const ctx = targetRuntime.canvas.getContext("2d");
    const qualityProfile = profileFor(targetRuntime, stroke.settings);
    ctx.setTransform(targetRuntime.dpr, 0, 0, targetRuntime.dpr, 0, 0);
    for (const rawPoint of points) {
      let previous = stroke.points.at(-1);
      const distance = Math.hypot((rawPoint.x - previous.x) * rect.width, (rawPoint.y - previous.y) * rect.height);
      if (distance < 1.2) continue;
      const subdivisions = Math.min(3, Math.max(1, Math.ceil(distance / 10)));
      for (let step = 1; step <= subdivisions; step += 1) {
        if (stroke.points.length >= MAX_POINTS_PER_STROKE) break;
        const amount = step / subdivisions;
        const point = normalizePoint({
          x: previous.x + (rawPoint.x - previous.x) * amount,
          y: previous.y + (rawPoint.y - previous.y) * amount,
          pressure: previous.pressure + (rawPoint.pressure - previous.pressure) * amount,
          time: previous.time + (rawPoint.time - previous.time) * amount
        });
        stroke.points.push(point);
        const segmentIndex = stroke.points.length - 1;
        drawFiberSegment(ctx, stroke.points[segmentIndex - 1], point, stroke, segmentIndex, rect.width, rect.height, 1, qualityProfile);
        drawSilkLinks(ctx, stroke, segmentIndex, rect.width, rect.height, 1, qualityProfile);
        previous = point;
      }
    }
    updateAdaptiveQuality(targetRuntime, (globalScope.performance?.now?.() || Date.now()) - startedAt);
  }

  function appendPoint(event, targetRuntime = runtime) {
    if (!targetRuntime?.drawing || !targetRuntime.activeStroke) return;
    const coalescedEvents = event.getCoalescedEvents?.();
    const events = coalescedEvents?.length ? coalescedEvents : [event];
    events.forEach((item) => targetRuntime.pointQueue.push(pointerPoint(item, targetRuntime, targetRuntime.drawRect)));
    if (targetRuntime.pointQueue.length > 192) targetRuntime.pointQueue.splice(0, targetRuntime.pointQueue.length - 192);
    if (!targetRuntime.drawFrame) targetRuntime.drawFrame = globalScope.requestAnimationFrame?.(() => { targetRuntime.drawFrame = 0; flushPointQueue(targetRuntime); });
  }

  function finishStroke(event, targetRuntime = runtime) {
    if (!targetRuntime?.drawing) return;
    globalScope.cancelAnimationFrame?.(targetRuntime.drawFrame);
    targetRuntime.drawFrame = 0;
    flushPointQueue(targetRuntime);
    try { if (Number(event.pointerId) >= 0) targetRuntime.canvas.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released by the browser. */ }
    const stroke = targetRuntime.activeStroke;
    targetRuntime.drawing = false;
    targetRuntime.activeStroke = null;
    targetRuntime.drawRect = null;
    targetRuntime.root.classList.remove("is-drawing");
    if (stroke?.points.length > 1) {
      targetRuntime.project.strokes.push(stroke);
      if (targetRuntime.project.strokes.length > MAX_STROKES) targetRuntime.project.strokes.shift();
      scheduleSave(targetRuntime);
      announce("Nét vẽ đã hoàn tất", targetRuntime);
    } else announce("Chạm và kéo để bắt đầu", targetRuntime);
    updateUi(targetRuntime);
  }

  function undo(targetRuntime = runtime) {
    const stroke = targetRuntime?.project.strokes.pop();
    if (!stroke) return;
    targetRuntime.redo.push(stroke);
    renderAll(targetRuntime);
    scheduleSave(targetRuntime);
    announce("Đã hoàn tác một nét", targetRuntime);
  }

  function redo(targetRuntime = runtime) {
    const stroke = targetRuntime?.redo.pop();
    if (!stroke) return;
    targetRuntime.project.strokes.push(stroke);
    renderAll(targetRuntime);
    scheduleSave(targetRuntime);
    announce("Đã khôi phục một nét", targetRuntime);
  }

  function clearDrawing(targetRuntime = runtime) {
    if (!targetRuntime?.project.strokes.length || globalScope.confirm?.("Tạo bản vẽ mới? Các nét hiện tại sẽ bị xóa khỏi project này.") !== false) {
      targetRuntime.redo = [...targetRuntime.project.strokes];
      targetRuntime.project.strokes = [];
      renderAll(targetRuntime);
      scheduleSave(targetRuntime);
      announce("Bản vẽ mới đã sẵn sàng", targetRuntime);
      toast("Đã tạo canvas mới · có thể Làm lại để khôi phục nét gần nhất", targetRuntime);
    }
  }

  function extensionFor(format) { return format === "jpeg" ? "jpg" : format; }

  function exportCanvas(targetRuntime = runtime, { copy = false } = {}) {
    if (!targetRuntime?.canvas) return Promise.resolve(false);
    const settings = targetRuntime.project.settings;
    const rect = targetRuntime.canvas.getBoundingClientRect();
    const scale = settings.exportScale;
    const canvas = globalScope.document.createElement("canvas");
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    renderAll(targetRuntime, { targetCanvas: canvas, includeBackground: true, scale });
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
      const url = globalScope.URL.createObjectURL(blob);
      const anchor = globalScope.document.createElement("a");
      anchor.href = url; anchor.download = `hh-silk-${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionFor(settings.exportFormat)}`; anchor.click();
      globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
      toast(`Đã xuất ${settings.exportFormat.toUpperCase()} ${scale}×`, targetRuntime); resolve(true);
    }, mime, settings.exportFormat === "jpeg" ? 0.94 : 0.92));
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

  async function importProject(file, targetRuntime = runtime) {
    if (!file || file.size > 8 * 1024 * 1024) { toast("Project JSON không hợp lệ hoặc lớn hơn 8 MB.", targetRuntime); return; }
    try {
      const project = normalizeProject(JSON.parse(await file.text()));
      targetRuntime.project = project;
      targetRuntime.redo = [];
      targetRuntime.liveQuality = project.settings.quality === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : project.settings.quality;
      targetRuntime.paintCost = 0;
      targetRuntime.fastFrames = 0;
      syncControls(targetRuntime);
      renderAll(targetRuntime);
      drawGuides(targetRuntime);
      scheduleSave(targetRuntime);
      toast(`Đã nhập ${project.strokes.length} nét vẽ`, targetRuntime);
    } catch { toast("Không thể đọc project JSON này.", targetRuntime); }
  }

  function syncControls(targetRuntime = runtime) {
    if (!targetRuntime?.root) return;
    const settings = targetRuntime.project.settings;
    targetRuntime.root.dataset.background = settings.background;
    targetRuntime.root.dataset.brushMode = settings.brushMode;
    targetRuntime.root.querySelectorAll("[data-draw-preset]").forEach((button) => { const active = button.dataset.drawPreset === settings.preset; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    targetRuntime.root.querySelectorAll("[data-draw-palette]").forEach((button) => { const active = button.dataset.drawPalette === settings.paletteId; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    targetRuntime.root.querySelectorAll("[data-draw-color]").forEach((button) => { const active = button.dataset.drawColor.toLowerCase() === settings.colorA; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    ["symmetry", "brushSize", "glow", "flow", "quality", "background", "exportFormat", "exportScale", "colorA", "colorB"].forEach((key) => {
      const selector = key === "colorA" ? "[data-draw-color-a]" : key === "colorB" ? "[data-draw-color-b]" : `[data-draw-setting=\"${key}\"]`;
      const input = targetRuntime.root.querySelector(selector); if (input) input.value = settings[key];
    });
    ["mirror", "spiral", "autoHue", "guides"].forEach((key) => { const input = targetRuntime.root.querySelector(`[data-draw-setting=\"${key}\"]`); if (input) input.checked = settings[key]; });
    const labels = { symmetry: `${settings.symmetry} nhánh`, brushSize: `${settings.brushSize.toFixed(1)} px`, glow: `${Math.round(settings.glow)}%`, flow: `${Math.round(settings.flow * 100)}%` };
    Object.entries(labels).forEach(([key, label]) => { const output = targetRuntime.root.querySelector(`[data-draw-output=\"${key}\"]`); if (output) output.textContent = label; });
    const preview = targetRuntime.root.querySelector("[data-draw-mix-preview]"); if (preview) preview.style.setProperty("--mix", mixHex(settings.colorA, settings.colorB));
    targetRuntime.root.querySelector("[data-draw-guides-toggle]")?.setAttribute("aria-pressed", String(settings.guides));
    updateUi(targetRuntime);
  }

  function applyPreset(id, targetRuntime = runtime) {
    const preset = PRESETS[id];
    if (!preset || !targetRuntime) return;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, ...preset, preset: id });
    syncControls(targetRuntime);
    drawGuides(targetRuntime);
    scheduleSave(targetRuntime);
    announce(`Đã chọn ${preset.label}`, targetRuntime);
  }

  function updateSetting(input, targetRuntime = runtime) {
    const key = input.dataset.drawSetting;
    if (!key) return;
    const booleans = new Set(["mirror", "spiral", "autoHue", "guides"]);
    const numbers = new Set(["symmetry", "brushSize", "glow", "flow", "exportScale"]);
    const value = booleans.has(key) ? input.checked : numbers.has(key) ? Number(input.value) : input.value;
    targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, [key]: value, preset: targetRuntime.project.settings.preset });
    if (key === "quality") {
      targetRuntime.liveQuality = value === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : value;
      targetRuntime.paintCost = 0;
      targetRuntime.fastFrames = 0;
    }
    syncControls(targetRuntime);
    if (["symmetry", "guides", "mirror", "spiral"].includes(key)) drawGuides(targetRuntime);
    scheduleSave(targetRuntime);
  }

  function handleClick(event, targetRuntime = runtime) {
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
    const color = event.target.closest("[data-draw-color]"); if (color) { targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorA: color.dataset.drawColor.toLowerCase(), paletteId: "custom" }); syncControls(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.closest("[data-draw-new]")) { clearDrawing(targetRuntime); return; }
    if (event.target.closest("[data-draw-undo]")) { undo(targetRuntime); return; }
    if (event.target.closest("[data-draw-redo]")) { redo(targetRuntime); return; }
    if (event.target.closest("[data-draw-export]")) { exportCanvas(targetRuntime); return; }
    if (event.target.closest("[data-draw-copy]")) { exportCanvas(targetRuntime, { copy: true }); return; }
    if (event.target.closest("[data-draw-project-export]")) { exportProject(targetRuntime); return; }
    if (event.target.closest("[data-draw-fullscreen]")) { const node = targetRuntime.root; if (globalScope.document.fullscreenElement) globalScope.document.exitFullscreen?.(); else node.requestFullscreen?.(); return; }
    if (event.target.closest("[data-draw-panel-open]")) { targetRuntime.root.classList.add("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-close]")?.focus(); return; }
    if (event.target.closest("[data-draw-panel-close]")) { targetRuntime.root.classList.remove("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-open]")?.focus(); return; }
    if (event.target.closest("[data-draw-guides-toggle]")) { targetRuntime.project.settings.guides = !targetRuntime.project.settings.guides; syncControls(targetRuntime); drawGuides(targetRuntime); scheduleSave(targetRuntime); }
  }

  function handleChange(event, targetRuntime = runtime) {
    if (event.target.matches("[data-draw-color-a]")) { targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorA: event.target.value, paletteId: "custom" }); syncControls(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.matches("[data-draw-color-b]")) { targetRuntime.project.settings = normalizeSettings({ ...targetRuntime.project.settings, colorB: event.target.value, paletteId: "custom" }); syncControls(targetRuntime); scheduleSave(targetRuntime); return; }
    if (event.target.matches("[data-draw-setting]")) updateSetting(event.target, targetRuntime);
    if (event.target.matches("[data-draw-project-import]")) { importProject(event.target.files?.[0], targetRuntime); event.target.value = ""; }
  }

  function handleKeydown(event, targetRuntime = runtime) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo(targetRuntime) : undo(targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(targetRuntime); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); exportCanvas(targetRuntime); return; }
    if (!typing && event.code === "Space") { event.preventDefault(); clearDrawing(targetRuntime); return; }
    if (!typing && event.key.toLowerCase() === "f") { event.preventDefault(); targetRuntime.root.requestFullscreen?.(); return; }
    if (event.key === "Escape" && targetRuntime.root.classList.contains("is-panel-open")) { targetRuntime.root.classList.remove("is-panel-open"); targetRuntime.root.querySelector("[data-draw-panel-open]")?.focus(); }
  }

  function mount(root, options = {}) {
    if (!root || !globalScope.document) return false;
    unmount();
    const storageKey = ownerKey(options.currentUser);
    const project = storageRead(storageKey);
    root.innerHTML = markup(project);
    const studio = root.firstElementChild;
    const canvas = studio.querySelector("[data-draw-canvas]");
    const guideCanvas = studio.querySelector("[data-draw-guides]");
    const initialQuality = project.settings.quality === "auto" ? resolveQualityProfile("auto", { deviceMemory: globalScope.navigator?.deviceMemory, hardwareConcurrency: globalScope.navigator?.hardwareConcurrency }).id : project.settings.quality;
    runtime = { host: root, root: studio, canvas, guideCanvas, project, storageKey, redo: [], activeStroke: null, drawing: false, dpr: 1, saved: true, resizeObserver: null, resizeFrame: 0, drawFrame: 0, pointQueue: [], drawRect: null, paintCost: 0, fastFrames: 0, liveQuality: initialQuality, saveTimer: 0, toastTimer: 0 };
    runtime.onClick = (event) => handleClick(event, runtime);
    runtime.onChange = (event) => handleChange(event, runtime);
    runtime.onInput = (event) => { if (event.target.matches("input[type=range][data-draw-setting]")) updateSetting(event.target, runtime); };
    runtime.onKeydown = (event) => handleKeydown(event, runtime);
    runtime.onPointerDown = (event) => beginStroke(event, runtime);
    runtime.onPointerMove = (event) => appendPoint(event, runtime);
    runtime.onPointerUp = (event) => finishStroke(event, runtime);
    runtime.onVisibility = () => { if (globalScope.document.hidden && runtime?.drawing) finishStroke({ pointerId: -1 }, runtime); };
    studio.addEventListener("click", runtime.onClick);
    studio.addEventListener("change", runtime.onChange);
    studio.addEventListener("input", runtime.onInput);
    studio.addEventListener("keydown", runtime.onKeydown);
    canvas.addEventListener("pointerdown", runtime.onPointerDown);
    canvas.addEventListener("pointermove", runtime.onPointerMove);
    canvas.addEventListener("pointerup", runtime.onPointerUp);
    canvas.addEventListener("pointercancel", runtime.onPointerUp);
    globalScope.document.addEventListener("visibilitychange", runtime.onVisibility);
    runtime.resizeObserver = typeof globalScope.ResizeObserver === "function" ? new globalScope.ResizeObserver(() => scheduleResize(runtime)) : null;
    runtime.resizeObserver?.observe(canvas);
    globalScope.requestAnimationFrame?.(() => { resizeCanvases(runtime); syncControls(runtime); announce("Đã sẵn sàng · kéo để vẽ", runtime); });
    return true;
  }

  function unmount() {
    if (!runtime) return;
    globalScope.clearTimeout(runtime.saveTimer);
    globalScope.clearTimeout(runtime.toastTimer);
    globalScope.cancelAnimationFrame?.(runtime.drawFrame);
    globalScope.cancelAnimationFrame?.(runtime.resizeFrame);
    runtime.resizeObserver?.disconnect?.();
    runtime.root?.removeEventListener("click", runtime.onClick);
    runtime.root?.removeEventListener("change", runtime.onChange);
    runtime.root?.removeEventListener("input", runtime.onInput);
    runtime.root?.removeEventListener("keydown", runtime.onKeydown);
    runtime.canvas?.removeEventListener("pointerdown", runtime.onPointerDown);
    runtime.canvas?.removeEventListener("pointermove", runtime.onPointerMove);
    runtime.canvas?.removeEventListener("pointerup", runtime.onPointerUp);
    runtime.canvas?.removeEventListener("pointercancel", runtime.onPointerUp);
    globalScope.document?.removeEventListener("visibilitychange", runtime.onVisibility);
    storageWrite(runtime.storageKey, runtime.project);
    runtime = null;
  }

  function inspect() {
    return { version: VERSION, mounted: Boolean(runtime), strokes: runtime?.project.strokes.length || 0, preset: runtime?.project.settings.preset || DEFAULT_SETTINGS.preset, brushMode: runtime?.project.settings.brushMode || DEFAULT_SETTINGS.brushMode, paletteId: runtime?.project.settings.paletteId || DEFAULT_SETTINGS.paletteId, quality: runtime?.project.settings.quality || DEFAULT_SETTINGS.quality };
  }

  return { VERSION, STORAGE_SCHEMA, PALETTE, COLOR_PALETTES, PRESETS, BRUSH_MODES, DEFAULT_SETTINGS, QUALITY_PROFILES, normalizeSettings, normalizeProject, resolveQualityProfile, buildSymmetryPoints, mixHex, samplePalette, mount, unmount, inspect };
});
