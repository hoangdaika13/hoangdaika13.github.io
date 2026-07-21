(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-vector-motion-project";
  const STORAGE_KEY = "hh.graphic-vector-core.project.v1";
  const DATABASE_NAME = "hh-creative-projects";
  const STORE_NAME = "vector-motion";
  const STYLE_ID = "hh-graphic-vector-core-styles-v1";
  const MAX_HISTORY = 80;
  const EXPRESSION_PROPERTIES = Object.freeze(["x", "y", "scaleX", "scaleY", "rotation", "opacity", "trimStart", "trimEnd", "trimOffset"]);
  const EXPRESSION_FUNCTIONS = Object.freeze({
    min: (...values) => Math.min(...values),
    max: (...values) => Math.max(...values),
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil
  });
  const mounted = new WeakMap();

  const TOOLS = [
    { id: "select", label: "Chọn", key: "V", icon: "↖" },
    { id: "pen", label: "Pen", key: "P", icon: "⌁" },
    { id: "rectangle", label: "Chữ nhật", key: "R", icon: "□" },
    { id: "ellipse", label: "Ellipse", key: "E", icon: "○" },
    { id: "polygon", label: "Đa giác", key: "Y", icon: "⬡" },
    { id: "star", label: "Ngôi sao", key: "S", icon: "☆" },
    { id: "text", label: "Văn bản", key: "T", icon: "T" }
  ];
  const LAYER_TYPES = ["group", "composition", "rect", "ellipse", "polygon", "star", "text", "path", "mask"];
  const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"];
  const MATTE_MODES = ["none", "alpha", "alpha-inverted", "luma", "luma-inverted"];
  const ALIGN_ACTIONS = ["left", "center-x", "right", "top", "center-y", "bottom", "distribute-x", "distribute-y"];

  function uid(prefix) {
    return `${prefix || "item"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }

  function round(value, places) {
    const factor = 10 ** (places == null ? 2 : places);
    return Math.round(Number(value || 0) * factor) / factor;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|none|transparent)$/i.test(color) ? color : fallback;
  }

  function safeId(value, fallback) {
    const id = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
    return id || fallback || uid("layer");
  }

  function safeText(value, fallback, max) {
    return String(value == null ? (fallback || "") : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max || 240);
  }

  function normalizeExpressions(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return EXPRESSION_PROPERTIES.reduce((output, property) => {
      if (!Object.prototype.hasOwnProperty.call(source, property)) return output;
      const expression = safeText(source[property], "", 240).trim();
      if (expression) output[property] = expression;
      return output;
    }, {});
  }

  function tokenizeExpression(expression) {
    const source = safeText(expression, "", 240).trim();
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      const rest = source.slice(index);
      const whitespace = rest.match(/^\s+/);
      if (whitespace) { index += whitespace[0].length; continue; }
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { tokens.push({ type: "number", value: Number(number[0]) }); index += number[0].length; continue; }
      const identifier = rest.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (identifier) { tokens.push({ type: "identifier", value: identifier[0] }); index += identifier[0].length; continue; }
      const character = source[index];
      if ("+-*/%(),".includes(character)) { tokens.push({ type: character, value: character }); index += 1; continue; }
      throw new SyntaxError(`Ky tu expression khong duoc ho tro: ${character}`);
    }
    tokens.push({ type: "eof", value: "" });
    return tokens;
  }

  function evaluateExpression(expression, context) {
    try {
      const tokens = tokenizeExpression(expression);
      const values = context && typeof context === "object" ? context : {};
      let cursor = 0;
      const peek = () => tokens[cursor];
      const take = (type) => {
        const token = tokens[cursor];
        if (token.type !== type) throw new SyntaxError(`Can ${type}, nhan ${token.type}`);
        cursor += 1;
        return token;
      };
      function primary() {
        const token = peek();
        if (token.type === "number") { cursor += 1; return token.value; }
        if (token.type === "(") { cursor += 1; const value = additive(); take(")"); return value; }
        if (token.type === "identifier") {
          cursor += 1;
          const name = token.value;
          if (peek().type === "(") {
            cursor += 1;
            const args = [];
            if (peek().type !== ")") {
              do { args.push(additive()); if (peek().type !== ",") break; cursor += 1; } while (args.length < 8);
            }
            take(")");
            if (!Object.prototype.hasOwnProperty.call(EXPRESSION_FUNCTIONS, name)) throw new SyntaxError(`Ham ${name} khong duoc phep`);
            return EXPRESSION_FUNCTIONS[name](...args);
          }
          if (!Object.prototype.hasOwnProperty.call(values, name)) throw new SyntaxError(`Bien ${name} khong ton tai`);
          return Number(values[name]);
        }
        throw new SyntaxError(`Token ${token.type} khong hop le`);
      }
      function unary() {
        if (peek().type === "+") { cursor += 1; return unary(); }
        if (peek().type === "-") { cursor += 1; return -unary(); }
        return primary();
      }
      function multiplicative() {
        let value = unary();
        while (["*", "/", "%"].includes(peek().type)) {
          const operator = tokens[cursor++].type;
          const right = unary();
          value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
        }
        return value;
      }
      function additive() {
        let value = multiplicative();
        while (["+", "-"].includes(peek().type)) {
          const operator = tokens[cursor++].type;
          const right = multiplicative();
          value = operator === "+" ? value + right : value - right;
        }
        return value;
      }
      const value = additive();
      if (peek().type !== "eof") throw new SyntaxError("Expression con token du thua");
      if (!Number.isFinite(value)) throw new RangeError("Expression khong tao ra so huu han");
      return { ok: true, value };
    } catch (error) {
      return { ok: false, value: null, error: safeText(error?.message, "Expression khong hop le", 160) };
    }
  }

  function defaultTransform(transform) {
    return {
      x: clamp(transform?.x || 0, -100000, 100000),
      y: clamp(transform?.y || 0, -100000, 100000),
      scaleX: clamp(transform?.scaleX == null ? 1 : transform.scaleX, -100, 100),
      scaleY: clamp(transform?.scaleY == null ? 1 : transform.scaleY, -100, 100),
      rotation: clamp(transform?.rotation || 0, -36000, 36000),
      anchorX: clamp(transform?.anchorX || 0, -100000, 100000),
      anchorY: clamp(transform?.anchorY || 0, -100000, 100000),
      opacity: clamp(transform?.opacity == null ? 1 : transform.opacity, 0, 1)
    };
  }

  function point(raw, fallback) {
    const base = fallback || { x: 0, y: 0 };
    return {
      x: clamp(raw?.x == null ? base.x : raw.x, -100000, 100000),
      y: clamp(raw?.y == null ? base.y : raw.y, -100000, 100000),
      inX: clamp(raw?.inX == null ? (raw?.x == null ? base.x : raw.x) : raw.inX, -100000, 100000),
      inY: clamp(raw?.inY == null ? (raw?.y == null ? base.y : raw.y) : raw.inY, -100000, 100000),
      outX: clamp(raw?.outX == null ? (raw?.x == null ? base.x : raw.x) : raw.outX, -100000, 100000),
      outY: clamp(raw?.outY == null ? (raw?.y == null ? base.y : raw.y) : raw.outY, -100000, 100000),
      corner: raw?.corner === true
    };
  }

  function normalizeKeyframe(raw, duration) {
    const easing = Array.isArray(raw?.easing) ? raw.easing.slice(0, 4).map((value, index) => clamp(value, index % 2 ? -2 : 0, index % 2 ? 2 : 1)) : [0.42, 0, 0.58, 1];
    while (easing.length < 4) easing.push([0.42, 0, 0.58, 1][easing.length]);
    return {
      id: safeId(raw?.id, uid("key")),
      time: clamp(raw?.time || 0, 0, duration),
      transform: defaultTransform(raw?.transform),
      easing,
      morphPoints: Array.isArray(raw?.morphPoints) ? raw.morphPoints.slice(0, 200).map((item) => point(item)) : []
    };
  }

  function normalizeLayer(raw, index, duration) {
    const type = LAYER_TYPES.includes(raw?.type) ? raw.type : "rect";
    const geometry = raw?.geometry || {};
    const id = safeId(raw?.id, `layer-${index + 1}`);
    return {
      id,
      name: safeText(raw?.name, `${type} ${index + 1}`, 80),
      type,
      parentId: raw?.parentId ? safeId(raw.parentId, "") : null,
      visible: raw?.visible !== false,
      locked: raw?.locked === true,
      solo: raw?.solo === true,
      expanded: raw?.expanded !== false,
      blendMode: BLEND_MODES.includes(raw?.blendMode) ? raw.blendMode : "normal",
      matte: MATTE_MODES.includes(raw?.matte) ? raw.matte : "none",
      maskId: raw?.maskId ? safeId(raw.maskId, "") : null,
      clip: raw?.clip === true,
      transform: defaultTransform(raw?.transform),
      style: {
        fill: safeColor(raw?.style?.fill, type === "path" ? "none" : "#63e6ff"),
        stroke: safeColor(raw?.style?.stroke, type === "path" ? "#ff5fc9" : "none"),
        strokeWidth: clamp(raw?.style?.strokeWidth == null ? (type === "path" ? 8 : 0) : raw.style.strokeWidth, 0, 500),
        fontSize: clamp(raw?.style?.fontSize || 72, 6, 1000),
        fontFamily: safeText(raw?.style?.fontFamily, "Inter, system-ui, sans-serif", 120),
        fontWeight: clamp(raw?.style?.fontWeight || 700, 100, 950),
        lineJoin: ["miter", "round", "bevel"].includes(raw?.style?.lineJoin) ? raw.style.lineJoin : "round",
        lineCap: ["butt", "round", "square"].includes(raw?.style?.lineCap) ? raw.style.lineCap : "round"
      },
      geometry: {
        x: clamp(geometry.x || 0, -100000, 100000),
        y: clamp(geometry.y || 0, -100000, 100000),
        width: clamp(geometry.width || 240, 1, 100000),
        height: clamp(geometry.height || 160, 1, 100000),
        rx: clamp(geometry.rx || 0, 0, 50000),
        cx: clamp(geometry.cx || 0, -100000, 100000),
        cy: clamp(geometry.cy || 0, -100000, 100000),
        radius: clamp(geometry.radius || 100, 1, 100000),
        innerRadius: clamp(geometry.innerRadius || 44, 0, 100000),
        sides: Math.round(clamp(geometry.sides || 5, 3, 32)),
        text: safeText(geometry.text, "Văn bản mới", 1000),
        closed: geometry.closed !== false,
        points: Array.isArray(geometry.points) ? geometry.points.slice(0, 200).map((item) => point(item)) : []
      },
      trim: {
        enabled: raw?.trim?.enabled === true,
        start: clamp(raw?.trim?.start || 0, 0, 100),
        end: clamp(raw?.trim?.end == null ? 100 : raw.trim.end, 0, 100),
        offset: clamp(raw?.trim?.offset || 0, -1000, 1000)
      },
      motionPath: Array.isArray(raw?.motionPath) ? raw.motionPath.slice(0, 200).map((item) => point(item)) : [],
      morphModel: Array.isArray(raw?.morphModel) ? raw.morphModel.slice(0, 12).map((shape) => Array.isArray(shape) ? shape.slice(0, 200).map((item) => point(item)) : []) : [],
      expressions: normalizeExpressions(raw?.expressions),
      keyframes: (Array.isArray(raw?.keyframes) ? raw.keyframes : []).slice(0, 240).map((item) => normalizeKeyframe(item, duration)).sort((a, b) => a.time - b.time),
      nestedCompositionId: raw?.nestedCompositionId ? safeId(raw.nestedCompositionId, "") : null
    };
  }

  function createLayer(type, x, y, options) {
    const opts = options || {};
    const id = uid(type);
    const palette = {
      rectangle: "#5ee7f0",
      rect: "#5ee7f0",
      ellipse: "#ff63c7",
      polygon: "#c8f36d",
      star: "#ffd166",
      text: "#f7f8ff",
      pen: "none",
      path: "none"
    };
    const actualType = type === "rectangle" ? "rect" : type === "pen" ? "path" : type;
    const layer = normalizeLayer({
      id,
      name: opts.name || ({ rect: "Hình chữ nhật", ellipse: "Ellipse", polygon: "Đa giác", star: "Ngôi sao", text: "Văn bản", path: "Đường Pen" }[actualType] || "Layer"),
      type: actualType,
      parentId: opts.parentId || null,
      style: { fill: palette[type] || palette[actualType] || "#5ee7f0", stroke: actualType === "path" ? "#ff63c7" : "none", strokeWidth: actualType === "path" ? 8 : 0, fontSize: 72, fontWeight: 800 },
      geometry: actualType === "ellipse"
        ? { cx: x, cy: y, width: 1, height: 1, radius: 1 }
        : actualType === "polygon" || actualType === "star"
          ? { cx: x, cy: y, radius: 1, innerRadius: 0.45, sides: actualType === "star" ? 5 : 6 }
          : actualType === "path"
            ? { points: [point({ x, y })], closed: false }
            : { x, y, width: actualType === "text" ? 420 : 1, height: actualType === "text" ? 90 : 1, rx: 24, text: actualType === "text" ? "Tiêu đề chuyển động" : "" },
      keyframes: []
    }, 0, 8);
    return layer;
  }

  function createDefaultProject() {
    const duration = 6;
    const group = normalizeLayer({ id: "group-hero", name: "Hero Composition", type: "composition", expanded: true }, 0, duration);
    const panel = normalizeLayer({
      id: "layer-panel", name: "Gradient Panel", type: "rect", parentId: group.id,
      geometry: { x: 130, y: 130, width: 1020, height: 460, rx: 48 },
      style: { fill: "#172039", stroke: "#5ee7f0", strokeWidth: 2 },
      keyframes: [
        { id: "panel-k0", time: 0, transform: { x: -90, opacity: 0 }, easing: [0.22, 1, 0.36, 1] },
        { id: "panel-k1", time: 1.2, transform: { x: 0, opacity: 1 }, easing: [0.22, 1, 0.36, 1] }
      ]
    }, 1, duration);
    const orb = normalizeLayer({
      id: "layer-orb", name: "Motion Orb", type: "ellipse", parentId: group.id,
      geometry: { cx: 320, cy: 360, width: 260, height: 260 },
      style: { fill: "#ff63c7", stroke: "#ffffff", strokeWidth: 4 }, blendMode: "screen",
      motionPath: [{ x: 320, y: 360 }, { x: 520, y: 190 }, { x: 790, y: 430 }, { x: 980, y: 290 }],
      keyframes: [
        { id: "orb-k0", time: 0, transform: { scaleX: 0.5, scaleY: 0.5, opacity: 0 }, easing: [0.34, 1.56, 0.64, 1] },
        { id: "orb-k1", time: 2.4, transform: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: [0.34, 1.56, 0.64, 1] }
      ]
    }, 2, duration);
    const star = normalizeLayer({
      id: "layer-star", name: "Spark", type: "star", parentId: group.id,
      geometry: { cx: 1040, cy: 220, radius: 76, innerRadius: 32, sides: 6 },
      style: { fill: "#c8f36d", stroke: "none" },
      keyframes: [
        { id: "star-k0", time: 0, transform: { rotation: -45, scaleX: 0, scaleY: 0, opacity: 0 }, easing: [0.34, 1.56, 0.64, 1] },
        { id: "star-k1", time: 1.8, transform: { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: [0.34, 1.56, 0.64, 1] }
      ]
    }, 3, duration);
    const title = normalizeLayer({
      id: "layer-title", name: "Headline", type: "text", parentId: group.id,
      geometry: { x: 520, y: 305, width: 560, height: 100, text: "VECTOR IN MOTION" },
      style: { fill: "#ffffff", stroke: "none", fontSize: 70, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 900 },
      keyframes: [
        { id: "title-k0", time: 0.5, transform: { y: 50, opacity: 0 }, easing: [0.16, 1, 0.3, 1] },
        { id: "title-k1", time: 1.6, transform: { y: 0, opacity: 1 }, easing: [0.16, 1, 0.3, 1] }
      ]
    }, 4, duration);
    const pathLayer = normalizeLayer({
      id: "layer-path", name: "Bezier Stroke", type: "path", parentId: group.id,
      geometry: {
        closed: false,
        points: [
          { x: 185, y: 525, outX: 340, outY: 440 },
          { x: 610, y: 510, inX: 460, inY: 610, outX: 760, outY: 400 },
          { x: 1080, y: 500, inX: 900, inY: 620 }
        ]
      },
      style: { fill: "none", stroke: "#5ee7f0", strokeWidth: 12 },
      trim: { enabled: true, start: 0, end: 78, offset: 0 }
    }, 5, duration);
    return normalizeProject({
      format: FORMAT,
      version: VERSION,
      meta: { name: "HH Vector Motion", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      stage: { width: 1280, height: 720, background: "#080d18" },
      settings: { snap: true, smartGuides: true, grid: 20, showGrid: true },
      layers: [group, panel, orb, star, title, pathLayer],
      timeline: {
        duration,
        fps: 30,
        workArea: { start: 0, end: duration },
        markers: [{ id: "marker-intro", time: 0.5, label: "Intro" }, { id: "marker-reveal", time: 1.8, label: "Reveal" }],
        compositions: [{ id: "comp-main", name: "Main", duration }]
      }
    });
  }

  function normalizeProject(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const duration = clamp(source.timeline?.duration || 6, 0.1, 3600);
    const rawLayers = Array.isArray(source.layers) ? source.layers.slice(0, 1000) : [];
    const layers = rawLayers.map((item, index) => normalizeLayer(item, index, duration));
    const ids = new Set(layers.map((layer) => layer.id));
    const seenIds = new Set();
    layers.forEach((layer, index) => {
      if (seenIds.has(layer.id)) layer.id = `${layer.id}-${index + 1}`;
      seenIds.add(layer.id);
    });
    const finalIds = new Set(layers.map((layer) => layer.id));
    layers.forEach((layer) => {
      if (!finalIds.has(layer.parentId) || layer.parentId === layer.id) layer.parentId = null;
      if (!finalIds.has(layer.maskId) || layer.maskId === layer.id) layer.maskId = null;
    });
    const fallbackLayers = layers.length ? layers : [normalizeLayer({ id: "layer-empty", name: "Artboard", type: "rect", geometry: { x: 200, y: 160, width: 880, height: 400, rx: 36 }, style: { fill: "#172039", stroke: "#5ee7f0", strokeWidth: 2 } }, 0, duration)];
    const markers = (Array.isArray(source.timeline?.markers) ? source.timeline.markers : []).slice(0, 240).map((item) => ({
      id: safeId(item?.id, uid("marker")),
      time: clamp(item?.time || 0, 0, duration),
      label: safeText(item?.label, "Marker", 60)
    })).sort((a, b) => a.time - b.time);
    const compositions = (Array.isArray(source.timeline?.compositions) ? source.timeline.compositions : []).slice(0, 60).map((item, index) => ({
      id: safeId(item?.id, `comp-${index + 1}`),
      name: safeText(item?.name, `Composition ${index + 1}`, 80),
      duration: clamp(item?.duration || duration, 0.1, 3600)
    }));
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: safeText(source.meta?.name, "Dự án Vector Motion", 120),
        createdAt: safeText(source.meta?.createdAt, new Date().toISOString(), 40),
        updatedAt: new Date().toISOString()
      },
      stage: {
        width: Math.round(clamp(source.stage?.width || 1280, 64, 8192)),
        height: Math.round(clamp(source.stage?.height || 720, 64, 8192)),
        background: safeColor(source.stage?.background, "#080d18")
      },
      settings: {
        snap: source.settings?.snap !== false,
        smartGuides: source.settings?.smartGuides !== false,
        grid: Math.round(clamp(source.settings?.grid || 20, 2, 400)),
        showGrid: source.settings?.showGrid !== false
      },
      layers: fallbackLayers,
      timeline: {
        duration,
        fps: Math.round(clamp(source.timeline?.fps || 30, 1, 120)),
        workArea: {
          start: clamp(source.timeline?.workArea?.start || 0, 0, duration),
          end: clamp(source.timeline?.workArea?.end == null ? duration : source.timeline.workArea.end, 0, duration)
        },
        markers,
        compositions: compositions.length ? compositions : [{ id: "comp-main", name: "Main", duration }]
      }
    };
  }

  function cubicBezierCoordinate(t, p1, p2) {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * p1 + 3 * inverse * t * t * p2 + t * t * t;
  }

  function cubicBezierValue(progress, curve) {
    const x = clamp(progress, 0, 1);
    const values = Array.isArray(curve) && curve.length === 4 ? curve : [0.42, 0, 0.58, 1];
    let low = 0;
    let high = 1;
    let time = x;
    for (let index = 0; index < 18; index += 1) {
      time = (low + high) / 2;
      const currentX = cubicBezierCoordinate(time, clamp(values[0], 0, 1), clamp(values[2], 0, 1));
      if (currentX < x) low = time;
      else high = time;
    }
    return cubicBezierCoordinate(time, clamp(values[1], -2, 2), clamp(values[3], -2, 2));
  }

  function interpolateNumber(start, end, value) {
    return start + (end - start) * value;
  }

  function resamplePathPoints(points, count) {
    const source = (Array.isArray(points) ? points : []).map((item) => point(item));
    const total = Math.round(clamp(count || source.length, 2, 200));
    if (!source.length) return [];
    if (source.length === 1) return Array.from({ length: total }, () => point(source[0]));
    return Array.from({ length: total }, (_, index) => {
      const sample = motionPathSample(source, index / Math.max(1, total - 1));
      return point({ x: sample.x, y: sample.y });
    });
  }

  function interpolateMorphPoints(previousPoints, nextPoints, progress) {
    if (!previousPoints?.length || !nextPoints?.length) return [];
    const count = Math.max(previousPoints.length, nextPoints.length);
    const previous = previousPoints.length === count ? previousPoints.map((item) => point(item)) : resamplePathPoints(previousPoints, count);
    const next = nextPoints.length === count ? nextPoints.map((item) => point(item)) : resamplePathPoints(nextPoints, count);
    return previous.map((item, index) => ({
      x: interpolateNumber(item.x, next[index].x, progress),
      y: interpolateNumber(item.y, next[index].y, progress),
      inX: interpolateNumber(item.inX, next[index].inX, progress),
      inY: interpolateNumber(item.inY, next[index].inY, progress),
      outX: interpolateNumber(item.outX, next[index].outX, progress),
      outY: interpolateNumber(item.outY, next[index].outY, progress),
      corner: item.corner && next[index].corner
    }));
  }

  function applyLayerExpressions(layer, result, time, duration) {
    const expressions = normalizeExpressions(layer.expressions);
    const progress = duration > 0 ? clamp(time / duration, 0, 1) : 0;
    const context = {
      time,
      progress,
      index: Number(layer.index || 0),
      value: 0,
      x: result.transform.x,
      y: result.transform.y,
      scaleX: result.transform.scaleX,
      scaleY: result.transform.scaleY,
      rotation: result.transform.rotation,
      opacity: result.transform.opacity
    };
    Object.entries(expressions).forEach(([property, expression]) => {
      context.value = property.startsWith("trim")
        ? result.trim[property === "trimStart" ? "start" : property === "trimEnd" ? "end" : "offset"]
        : result.transform[property];
      const evaluated = evaluateExpression(expression, context);
      if (!evaluated.ok) return;
      if (property === "opacity") result.transform.opacity = clamp(evaluated.value, 0, 1);
      else if (property === "scaleX" || property === "scaleY") result.transform[property] = clamp(evaluated.value, -100, 100);
      else if (property === "trimStart") result.trim.start = clamp(evaluated.value, 0, 100);
      else if (property === "trimEnd") result.trim.end = clamp(evaluated.value, 0, 100);
      else if (property === "trimOffset") result.trim.offset = clamp(evaluated.value, -1000, 1000);
      else if (Object.prototype.hasOwnProperty.call(result.transform, property)) result.transform[property] = clamp(evaluated.value, -100000, 100000);
      context[property] = evaluated.value;
    });
    return result;
  }

  function evaluateLayer(layer, time, duration) {
    const frames = layer.keyframes || [];
    const trim = { ...layer.trim };
    if (!frames.length) return applyLayerExpressions(layer, { transform: clone(layer.transform), morphPoints: [], trim }, time, duration || 0);
    if (time <= frames[0].time) return applyLayerExpressions(layer, { transform: clone(frames[0].transform), morphPoints: clone(frames[0].morphPoints || []), trim }, time, duration || frames[frames.length - 1].time);
    if (time >= frames[frames.length - 1].time) return applyLayerExpressions(layer, { transform: clone(frames[frames.length - 1].transform), morphPoints: clone(frames[frames.length - 1].morphPoints || []), trim }, time, duration || frames[frames.length - 1].time);
    const nextIndex = frames.findIndex((frame) => frame.time >= time);
    const next = frames[nextIndex];
    const previous = frames[nextIndex - 1];
    const rawProgress = (time - previous.time) / Math.max(0.0001, next.time - previous.time);
    const progress = cubicBezierValue(rawProgress, previous.easing);
    const transform = {};
    Object.keys(defaultTransform()).forEach((key) => {
      transform[key] = interpolateNumber(previous.transform[key], next.transform[key], progress);
    });
    const morphPoints = interpolateMorphPoints(previous.morphPoints, next.morphPoints, progress);
    return applyLayerExpressions(layer, { transform, morphPoints, trim }, time, duration || frames[frames.length - 1].time);
  }

  function cubicPoint(start, end, progress) {
    const t = clamp(progress, 0, 1);
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * start.outX + 3 * inverse * t ** 2 * end.inX + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * start.outY + 3 * inverse * t ** 2 * end.inY + t ** 3 * end.y
    };
  }

  function motionPathSample(points, progress) {
    if (!Array.isArray(points) || !points.length) return { x: 0, y: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    const raw = points;
    const normalized = raw.map((item) => point(item));
    const hasHandles = raw.some((item) => item && ["inX", "inY", "outX", "outY"].some((key) => Object.prototype.hasOwnProperty.call(item, key)));
    if (!hasHandles) {
      const lengths = raw.slice(1).map((item, index) => Math.hypot(item.x - raw[index].x, item.y - raw[index].y));
      const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
      let distance = clamp(progress, 0, 1) * total;
      let segment = 0;
      while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
      const local = lengths[segment] ? distance / lengths[segment] : 0;
      const start = raw[segment];
      const end = raw[segment + 1];
      const x = interpolateNumber(start.x, end.x, local);
      const y = interpolateNumber(start.y, end.y, local);
      return { x, y, angle: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI };
    }
    const samples = [];
    let total = 0;
    normalized.slice(0, -1).forEach((start, segment) => {
      let previous = cubicPoint(start, normalized[segment + 1], 0);
      for (let step = 1; step <= 20; step += 1) {
        const current = cubicPoint(start, normalized[segment + 1], step / 20);
        total += Math.hypot(current.x - previous.x, current.y - previous.y);
        samples.push({ segment, t: step / 20, distance: total, point: current, previous });
        previous = current;
      }
    });
    const target = clamp(progress, 0, 1) * (total || 1);
    const sample = samples.find((item) => item.distance >= target) || samples[samples.length - 1];
    const beforeDistance = sample.distance - Math.hypot(sample.point.x - sample.previous.x, sample.point.y - sample.previous.y);
    const ratio = sample.distance === beforeDistance ? 0 : clamp((target - beforeDistance) / (sample.distance - beforeDistance), 0, 1);
    const x = interpolateNumber(sample.previous.x, sample.point.x, ratio);
    const y = interpolateNumber(sample.previous.y, sample.point.y, ratio);
    return { x, y, angle: Math.atan2(sample.point.y - sample.previous.y, sample.point.x - sample.previous.x) * 180 / Math.PI };
  }

  function motionPathPoint(points, progress) {
    const sample = motionPathSample(points, progress);
    return { x: sample.x, y: sample.y };
  }

  function pathData(points, closed) {
    const list = Array.isArray(points) ? points : [];
    if (!list.length) return "";
    let data = `M ${round(list[0].x)} ${round(list[0].y)}`;
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      data += ` C ${round(previous.outX)} ${round(previous.outY)} ${round(current.inX)} ${round(current.inY)} ${round(current.x)} ${round(current.y)}`;
    }
    if (closed && list.length > 1) {
      const last = list[list.length - 1];
      const first = list[0];
      data += ` C ${round(last.outX)} ${round(last.outY)} ${round(first.inX)} ${round(first.inY)} ${round(first.x)} ${round(first.y)} Z`;
    }
    return data;
  }

  function regularPolygonPoints(cx, cy, radius, sides, innerRadius) {
    const count = Math.max(3, Math.round(sides || 5));
    const star = Number(innerRadius) > 0;
    const total = star ? count * 2 : count;
    const points = [];
    for (let index = 0; index < total; index += 1) {
      const useRadius = star && index % 2 ? innerRadius : radius;
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / total);
      points.push(`${round(cx + Math.cos(angle) * useRadius)},${round(cy + Math.sin(angle) * useRadius)}`);
    }
    return points.join(" ");
  }

  function layerBounds(layer) {
    const geometry = layer.geometry;
    if (layer.type === "ellipse") return { x: geometry.cx - geometry.width / 2, y: geometry.cy - geometry.height / 2, width: geometry.width, height: geometry.height };
    if (layer.type === "polygon" || layer.type === "star") return { x: geometry.cx - geometry.radius, y: geometry.cy - geometry.radius, width: geometry.radius * 2, height: geometry.radius * 2 };
    if (layer.type === "path" || layer.type === "mask") {
      const points = geometry.points || [];
      if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
      const xs = points.map((item) => item.x);
      const ys = points.map((item) => item.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
  }

  function layerShapeMarkup(layer, evaluated, animation) {
    const geometry = layer.geometry;
    const points = evaluated.morphPoints?.length ? evaluated.morphPoints : geometry.points;
    const style = layer.style;
    const common = `fill="${escapeHtml(style.fill)}" stroke="${escapeHtml(style.stroke)}" stroke-width="${round(style.strokeWidth)}" stroke-linejoin="${style.lineJoin}" stroke-linecap="${style.lineCap}"`;
    if (layer.type === "rect") return `<rect x="${round(geometry.x)}" y="${round(geometry.y)}" width="${round(geometry.width)}" height="${round(geometry.height)}" rx="${round(Math.min(geometry.rx, geometry.width / 2, geometry.height / 2))}" ${common}/>`;
    if (layer.type === "ellipse") return `<ellipse cx="${round(geometry.cx)}" cy="${round(geometry.cy)}" rx="${round(geometry.width / 2)}" ry="${round(geometry.height / 2)}" ${common}/>`;
    if (layer.type === "polygon" || layer.type === "star") return `<polygon points="${regularPolygonPoints(geometry.cx, geometry.cy, geometry.radius, geometry.sides, layer.type === "star" ? geometry.innerRadius : 0)}" ${common}/>`;
    if (layer.type === "text") return `<text x="${round(geometry.x)}" y="${round(geometry.y + style.fontSize)}" fill="${escapeHtml(style.fill)}" stroke="${escapeHtml(style.stroke)}" stroke-width="${round(style.strokeWidth)}" font-family="${escapeHtml(style.fontFamily)}" font-size="${round(style.fontSize)}" font-weight="${round(style.fontWeight)}">${escapeHtml(geometry.text)}</text>`;
    if (layer.type === "path" || layer.type === "mask") {
      const trimState = evaluated.trim || layer.trim;
      const trimLength = Math.max(0, trimState.end - trimState.start);
      const trim = trimState.enabled ? ` pathLength="100" stroke-dasharray="${round(trimLength)} ${round(100 - trimLength)}" stroke-dashoffset="${round(-trimState.start - trimState.offset)}"` : "";
      const morphCount = Math.max(points.length, ...layer.morphModel.map((shape) => shape.length), 0);
      const morphShapes = morphCount > 1 ? layer.morphModel.filter((shape) => shape.length > 1).map((shape) => shape.length === morphCount ? shape : resamplePathPoints(shape, morphCount)) : [];
      const morph = animation?.animated && morphShapes.length >= 2
        ? `<animate attributeName="d" dur="${animation.duration}s" values="${morphShapes.map((shape) => pathData(shape, geometry.closed)).join(";")}" repeatCount="${animation.loop === false ? "1" : "indefinite"}"/>`
        : "";
      const hasTrimExpression = ["trimStart", "trimEnd", "trimOffset"].some((property) => layer.expressions?.[property]);
      const trimAnimation = animation?.animated && hasTrimExpression
        ? (() => {
          const frames = Array.from({ length: 21 }, (_, index) => evaluateLayer(layer, animation.duration * index / 20, animation.duration).trim);
          const dash = frames.map((item) => `${round(Math.max(0, item.end - item.start))} ${round(100 - Math.max(0, item.end - item.start))}`).join(";");
          const offset = frames.map((item) => round(-item.start - item.offset)).join(";");
          const repeat = animation.loop === false ? "1" : "indefinite";
          return `<animate attributeName="stroke-dasharray" dur="${animation.duration}s" values="${dash}" repeatCount="${repeat}"/><animate attributeName="stroke-dashoffset" dur="${animation.duration}s" values="${offset}" repeatCount="${repeat}"/>`;
        })()
        : "";
      return `<path d="${pathData(points, geometry.closed)}" ${common}${trim}>${morph}${trimAnimation}</path>`;
    }
    return "";
  }

  function renderSvg(project, time, options) {
    const data = normalizeProject(project);
    const opts = options || {};
    const currentTime = clamp(time || 0, 0, data.timeline.duration);
    const byParent = new Map();
    data.layers.forEach((layer) => {
      const key = layer.parentId || "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(layer);
    });
    const soloed = data.layers.filter((layer) => layer.solo).map((layer) => layer.id);

    function animationMarkup(layer) {
      const expressionDriven = Object.keys(layer.expressions || {}).some((property) => ["x", "y", "scaleX", "scaleY", "rotation", "opacity"].includes(property));
      if (!opts.animated || (layer.keyframes.length < 2 && !expressionDriven)) return "";
      const duration = data.timeline.duration;
      const expressionSamples = Math.min(121, Math.max(11, Math.ceil(duration * 12) + 1));
      const sampleTimes = expressionDriven
        ? Array.from({ length: expressionSamples }, (_, index) => duration * index / Math.max(1, expressionSamples - 1))
        : [...new Set([0, ...layer.keyframes.map((key) => key.time), duration])].sort((a, b) => a - b);
      const samples = sampleTimes.map((sampleTime) => ({ time: sampleTime, ...evaluateLayer(layer, sampleTime, duration) }));
      const times = samples.map((sample) => round(sample.time / duration, 4)).join(";");
      const translations = samples.map((sample) => `${round(sample.transform.x)} ${round(sample.transform.y)}`).join(";");
      const rotations = samples.map((sample) => `${round(sample.transform.rotation)} ${round(sample.transform.anchorX)} ${round(sample.transform.anchorY)}`).join(";");
      const scales = samples.map((sample) => `${round(sample.transform.scaleX, 4)} ${round(sample.transform.scaleY, 4)}`).join(";");
      const opacity = samples.map((sample) => round(sample.transform.opacity, 4)).join(";");
      const splines = samples.slice(0, -1).map((sample) => {
        if (expressionDriven) return "0 0 1 1";
        const easing = [...layer.keyframes].reverse().find((key) => key.time <= sample.time)?.easing || layer.keyframes[0]?.easing || [0.42, 0, 0.58, 1];
        return easing.map((value) => round(value, 4)).join(" ");
      }).join(";");
      const splineAttrs = splines ? ` calcMode="spline" keySplines="${splines}"` : "";
      const repeat = opts.loop === false ? "1" : "indefinite";
      const motion = layer.motionPath.length > 1 ? `<animateMotion dur="${duration}s" path="${pathData(layer.motionPath, false)}" repeatCount="${repeat}" rotate="auto"/>` : "";
      return `<animateTransform attributeName="transform" additive="sum" type="translate" dur="${duration}s" values="${translations}" keyTimes="${times}"${splineAttrs} repeatCount="${repeat}"/><animateTransform attributeName="transform" additive="sum" type="rotate" dur="${duration}s" values="${rotations}" keyTimes="${times}"${splineAttrs} repeatCount="${repeat}"/><animateTransform attributeName="transform" additive="sum" type="scale" dur="${duration}s" values="${scales}" keyTimes="${times}"${splineAttrs} repeatCount="${repeat}"/><animate attributeName="opacity" dur="${duration}s" values="${opacity}" keyTimes="${times}"${splineAttrs} repeatCount="${repeat}"/>${motion}`;
    }

    function renderLayer(layer, stack) {
      if (!layer.visible || layer.type === "mask" || (soloed.length && !soloed.includes(layer.id) && !soloed.includes(layer.parentId))) return "";
      if ((stack || []).includes(layer.id)) return "";
      const evaluated = evaluateLayer(layer, currentTime, data.timeline.duration);
      const progress = data.timeline.duration ? currentTime / data.timeline.duration : 0;
      const motion = opts.animated ? { x: 0, y: 0 } : layer.motionPath.length ? motionPathPoint(layer.motionPath, progress) : { x: 0, y: 0 };
      const transform = evaluated.transform;
      const translateX = transform.x + motion.x;
      const translateY = transform.y + motion.y;
      const transformValue = `translate(${round(translateX)} ${round(translateY)}) translate(${round(transform.anchorX)} ${round(transform.anchorY)}) rotate(${round(transform.rotation)}) scale(${round(transform.scaleX, 4)} ${round(transform.scaleY, 4)}) translate(${round(-transform.anchorX)} ${round(-transform.anchorY)})`;
      const maskAttribute = layer.maskId ? `${layer.clip ? "clip-path" : "mask"}="url(#${layer.clip ? "clip" : "mask"}-${escapeHtml(layer.maskId)})"` : "";
      const matte = layer.matte !== "none" ? ` data-matte="${layer.matte}"` : "";
      const children = (byParent.get(layer.id) || []).map((child) => renderLayer(child, [...(stack || []), layer.id])).join("");
      const shape = layer.type === "group" || layer.type === "composition" ? "" : layerShapeMarkup(layer, evaluated, { animated: opts.animated, duration: data.timeline.duration, loop: opts.loop });
      return `<g data-layer-id="${escapeHtml(layer.id)}" data-layer-type="${layer.type}" transform="${transformValue}" opacity="${round(transform.opacity, 4)}" style="mix-blend-mode:${layer.blendMode}" ${maskAttribute}${matte}>${animationMarkup(layer)}${shape}${children}</g>`;
    }

    const definitions = data.layers.filter((layer) => layer.type === "mask").map((layer) => {
      const shape = layerShapeMarkup(layer, evaluateLayer(layer, currentTime, data.timeline.duration));
      return `<mask id="mask-${escapeHtml(layer.id)}" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="black"/>${shape.replace(/fill="[^"]*"/, "fill=\"white\"")}</mask><clipPath id="clip-${escapeHtml(layer.id)}">${shape}</clipPath>`;
    }).join("");
    const gridSize = data.settings.grid;
    const grid = data.settings.showGrid ? `<pattern id="vc-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse"><path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="rgba(255,255,255,.055)" stroke-width="1"/></pattern>` : "";
    const content = (byParent.get("root") || []).map((layer) => renderLayer(layer, [])).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.stage.width} ${data.stage.height}" width="${data.stage.width}" height="${data.stage.height}" role="img" aria-label="Canvas vector ${escapeHtml(data.meta.name)}"><defs>${grid}${definitions}</defs><rect width="100%" height="100%" fill="${escapeHtml(data.stage.background)}"/>${data.settings.showGrid ? "<rect width=\"100%\" height=\"100%\" fill=\"url(#vc-grid)\" pointer-events=\"none\"/>" : ""}${content}</svg>`;
  }

  function renderAnimatedSvg(project) {
    const data = normalizeProject(project);
    return renderSvg(data, 0, { animated: true, loop: true }).replace("</svg>", `<metadata>HH Vector Motion · ${escapeHtml(data.meta.name)}</metadata><style>@media(prefers-reduced-motion:reduce){animate,animateTransform{display:none}}</style></svg>`);
  }

  function exportProject(project) {
    const data = normalizeProject(project);
    return JSON.stringify({ ...data, format: FORMAT, exportedAt: new Date().toISOString() }, null, 2);
  }

  function colorToLottie(value) {
    const match = String(value || "").match(/^#([0-9a-f]{6})$/i);
    if (!match) return [0.39, 0.9, 0.94, 1];
    return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255).concat(1);
  }

  function lottieBezierShape(points, closed) {
    const normalized = (points || []).map((item) => point(item));
    return {
      c: Boolean(closed),
      v: normalized.map((item) => [round(item.x, 4), round(item.y, 4)]),
      i: normalized.map((item) => [round(item.inX - item.x, 4), round(item.inY - item.y, 4)]),
      o: normalized.map((item) => [round(item.outX - item.x, 4), round(item.outY - item.y, 4)])
    };
  }

  function lottieAnimatedProperty(layer, property, fps, mapper, fallback) {
    const frames = layer.keyframes || [];
    if (frames.length < 2) return { a: 0, k: mapper ? mapper(layer.transform[property]) : layer.transform[property] ?? fallback };
    return {
      a: 1,
      k: frames.map((frame, index) => ({
        t: round(frame.time * fps, 3),
        s: [mapper ? mapper(frame.transform[property]) : frame.transform[property]],
        h: 0,
        ...(index < frames.length - 1 ? { e: [mapper ? mapper(frames[index + 1].transform[property]) : frames[index + 1].transform[property]] } : {})
      }))
    };
  }

  function exportLottie(projectInput) {
    const project = normalizeProject(projectInput);
    const fps = project.timeline.fps;
    const indexById = new Map(project.layers.map((layer, index) => [layer.id, index + 1]));
    const warnings = [];
    const layers = project.layers.filter((layer) => layer.type !== "mask").map((layer, index) => {
      const transform = {
        o: lottieAnimatedProperty(layer, "opacity", fps, (value) => round(value * 100, 3), 100),
        r: lottieAnimatedProperty(layer, "rotation", fps, null, 0),
        p: layer.keyframes.length >= 2
          ? { a: 1, k: layer.keyframes.map((frame, frameIndex) => ({ t: round(frame.time * fps, 3), s: [round(frame.transform.x, 3), round(frame.transform.y, 3), 0], ...(frameIndex < layer.keyframes.length - 1 ? { e: [round(layer.keyframes[frameIndex + 1].transform.x, 3), round(layer.keyframes[frameIndex + 1].transform.y, 3), 0] } : {}) })) }
          : { a: 0, k: [round(layer.transform.x, 3), round(layer.transform.y, 3), 0] },
        a: { a: 0, k: [round(layer.transform.anchorX, 3), round(layer.transform.anchorY, 3), 0] },
        s: layer.keyframes.length >= 2
          ? { a: 1, k: layer.keyframes.map((frame, frameIndex) => ({ t: round(frame.time * fps, 3), s: [round(frame.transform.scaleX * 100, 3), round(frame.transform.scaleY * 100, 3), 100], ...(frameIndex < layer.keyframes.length - 1 ? { e: [round(layer.keyframes[frameIndex + 1].transform.scaleX * 100, 3), round(layer.keyframes[frameIndex + 1].transform.scaleY * 100, 3), 100] } : {}) })) }
          : { a: 0, k: [round(layer.transform.scaleX * 100, 3), round(layer.transform.scaleY * 100, 3), 100] }
      };
      const base = { ind: index + 1, nm: layer.name, ip: 0, op: Math.ceil(project.timeline.duration * fps), st: 0, ks: transform, ...(layer.parentId && indexById.has(layer.parentId) ? { parent: indexById.get(layer.parentId) } : {}) };
      if (layer.type === "text") {
        return { ...base, ty: 5, t: { d: { k: [{ t: 0, s: { t: layer.geometry.text, s: layer.style.fontSize, f: layer.style.fontFamily, fc: colorToLottie(layer.style.fill).slice(0, 3), j: 0 } }] } } };
      }
      const shapes = [];
      if (layer.type === "rect") shapes.push({ ty: "rc", p: { a: 0, k: [layer.geometry.x + layer.geometry.width / 2, layer.geometry.y + layer.geometry.height / 2] }, s: { a: 0, k: [layer.geometry.width, layer.geometry.height] }, r: { a: 0, k: layer.geometry.rx } });
      else if (layer.type === "ellipse") shapes.push({ ty: "el", p: { a: 0, k: [layer.geometry.cx, layer.geometry.cy] }, s: { a: 0, k: [layer.geometry.width, layer.geometry.height] } });
      else if (layer.type === "polygon" || layer.type === "star") shapes.push({ ty: "sr", sy: layer.type === "star" ? 1 : 2, p: { a: 0, k: [layer.geometry.cx, layer.geometry.cy] }, pt: { a: 0, k: layer.geometry.sides }, or: { a: 0, k: layer.geometry.radius }, ir: { a: 0, k: layer.geometry.innerRadius }, r: { a: 0, k: 0 } });
      else if (layer.type === "path") {
        const shapeModels = [layer.geometry.points, ...layer.morphModel].filter((shape) => shape?.length);
        const count = Math.max(...shapeModels.map((shape) => shape.length));
        const normalizedShapes = shapeModels.map((shape) => lottieBezierShape(shape.length === count ? shape : resamplePathPoints(shape, count), layer.geometry.closed));
        shapes.push({ ty: "sh", ks: normalizedShapes.length > 1 ? { a: 1, k: normalizedShapes.map((shape, shapeIndex) => ({ t: round(shapeIndex * project.timeline.duration * fps / Math.max(1, normalizedShapes.length - 1), 3), s: [shape] })) } : { a: 0, k: normalizedShapes[0] || lottieBezierShape([], false) } });
      } else if (!["group", "composition"].includes(layer.type)) warnings.push(`Layer ${layer.name}: type ${layer.type} is metadata-only in Lottie subset.`);
      if (layer.trim.enabled) shapes.push({ ty: "tm", s: { a: 0, k: layer.trim.start }, e: { a: 0, k: layer.trim.end }, o: { a: 0, k: layer.trim.offset }, m: 1 });
      if (layer.style.fill !== "none") shapes.push({ ty: "fl", c: { a: 0, k: colorToLottie(layer.style.fill) }, o: { a: 0, k: 100 } });
      if (layer.style.stroke !== "none" && layer.style.strokeWidth > 0) shapes.push({ ty: "st", c: { a: 0, k: colorToLottie(layer.style.stroke) }, w: { a: 0, k: layer.style.strokeWidth }, o: { a: 0, k: 100 }, lc: 2, lj: 2 });
      if (layer.maskId || layer.matte !== "none") warnings.push(`Layer ${layer.name}: masks and mattes require review after Lottie import.`);
      return { ...base, ty: 4, shapes };
    });
    return JSON.stringify({
      v: "5.12.2", fr: fps, ip: 0, op: Math.ceil(project.timeline.duration * fps), w: project.stage.width, h: project.stage.height,
      nm: project.meta.name, ddd: 0, assets: [], layers,
      meta: { generator: "HH Vector Motion", capability: "lottie-compatible-subset", warnings }
    }, null, 2);
  }

  function getExportCapabilities(scope) {
    const runtime = scope || globalScope;
    const canvas = Boolean(runtime.document && runtime.Image && runtime.URL?.createObjectURL);
    const webm = Boolean(canvas && runtime.MediaRecorder && runtime.document?.createElement?.("canvas")?.captureStream);
    const gif = Boolean(canvas && typeof runtime.createImageBitmap === "function");
    return {
      projectJson: { supported: true, level: "native" },
      animatedSvg: { supported: true, level: "native-smil" },
      lottie: { supported: true, level: "compatible-subset", note: "Masks, mattes and expressions may need review after import." },
      pngSequence: { supported: canvas, level: canvas ? "native-frames" : "unavailable" },
      webm: { supported: webm, level: webm ? "browser-mediarecorder" : "unavailable" },
      gif: { supported: gif, level: gif ? "browser-encoded-256-color" : "unavailable" }
    };
  }

  function gifPalette() {
    const bytes = [];
    for (let index = 0; index < 256; index += 1) bytes.push(((index >> 5) & 7) * 255 / 7, ((index >> 2) & 7) * 255 / 7, (index & 3) * 255 / 3);
    return bytes.map(Math.round);
  }

  function gifPixels(imageData) {
    const output = new Uint8Array(imageData.data.length / 4);
    for (let source = 0, target = 0; source < imageData.data.length; source += 4, target += 1) output[target] = (imageData.data[source] >> 5) << 5 | (imageData.data[source + 1] >> 5) << 2 | (imageData.data[source + 2] >> 6);
    return output;
  }

  function gifLzw(pixels) {
    const clear = 256;
    const end = 257;
    let codeSize = 9;
    let nextCode = 258;
    let dictionary = new Map();
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    const emit = (code) => {
      buffer |= code << bits;
      bits += codeSize;
      while (bits >= 8) { bytes.push(buffer & 255); buffer >>>= 8; bits -= 8; }
    };
    const reset = () => { dictionary = new Map(); codeSize = 9; nextCode = 258; };
    emit(clear);
    if (pixels.length) {
      let prefix = pixels[0];
      for (let index = 1; index < pixels.length; index += 1) {
        const suffix = pixels[index];
        const key = `${prefix},${suffix}`;
        if (dictionary.has(key)) { prefix = dictionary.get(key); continue; }
        emit(prefix);
        if (nextCode < 4096) {
          dictionary.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
        } else { emit(clear); reset(); }
        prefix = suffix;
      }
      emit(prefix);
    }
    emit(end);
    if (bits) bytes.push(buffer & 255);
    return bytes;
  }

  async function exportGif(projectInput, options, onProgress) {
    const capabilities = getExportCapabilities(globalScope);
    if (!capabilities.gif.supported) throw new Error("GIF chi kha dung khi trinh duyet ho tro Canvas, Image va createImageBitmap");
    const project = normalizeProject(projectInput);
    const settings = options && typeof options === "object" ? options : {};
    const fps = Math.round(clamp(settings.fps || Math.min(project.timeline.fps, 15), 1, 30));
    const frameCount = Math.round(clamp(Math.ceil(project.timeline.duration * fps), 2, 180));
    const maxWidth = Math.round(clamp(settings.maxWidth || 960, 64, 1920));
    const scale = Math.min(1, maxWidth / project.stage.width);
    const width = Math.max(1, Math.round(project.stage.width * scale));
    const height = Math.max(1, Math.round(project.stage.height * scale));
    const canvas = globalScope.document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Khong khoi tao duoc Canvas 2D cho GIF");
    const bytes = [];
    const word = (value) => { bytes.push(value & 255, value >> 8 & 255); };
    bytes.push(...[71, 73, 70, 56, 57, 97]); word(width); word(height); bytes.push(0xf7, 0, 0, ...gifPalette());
    bytes.push(0x21, 0xff, 0x0b, ...Array.from("NETSCAPE2.0", (char) => char.charCodeAt(0)), 3, 1, 0, 0, 0);
    for (let index = 0; index < frameCount; index += 1) {
      const time = project.timeline.duration * index / Math.max(1, frameCount - 1);
      const png = await svgToPngBlob(renderSvg(project, time), project.stage.width, project.stage.height);
      const bitmap = await globalScope.createImageBitmap(png);
      context.clearRect(0, 0, width, height); context.drawImage(bitmap, 0, 0, width, height); bitmap.close?.();
      const compressed = gifLzw(gifPixels(context.getImageData(0, 0, width, height)));
      const delay = Math.max(2, Math.round(100 / fps));
      bytes.push(0x21, 0xf9, 4, 0x04, delay & 255, delay >> 8 & 255, 0, 0, 0x2c); word(0); word(0); word(width); word(height); bytes.push(0, 8);
      for (let offset = 0; offset < compressed.length; offset += 255) { const block = compressed.slice(offset, offset + 255); bytes.push(block.length, ...block); }
      bytes.push(0);
      if (typeof onProgress === "function") onProgress(index + 1, frameCount);
    }
    bytes.push(0x3b);
    return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
  }

  function createStorageDriver(scope) {
    const local = (() => {
      try { return scope.localStorage || null; } catch (_) { return null; }
    })();
    let databasePromise = null;
    function openDatabase() {
      if (!scope.indexedDB) return Promise.reject(new Error("IndexedDB không khả dụng"));
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const request = scope.indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB"));
      });
      return databasePromise;
    }
    async function idb(action, value) {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, action === "get" ? "readonly" : "readwrite");
        const request = action === "get" ? transaction.objectStore(STORE_NAME).get(STORAGE_KEY) : transaction.objectStore(STORE_NAME).put(value, STORAGE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Lỗi IndexedDB"));
      });
    }
    return {
      async load() {
        try {
          const value = await idb("get");
          if (value) return typeof value === "string" ? JSON.parse(value) : value;
        } catch (_) { /* Use the local fallback below. */ }
        try {
          const value = local?.getItem(STORAGE_KEY);
          return value ? JSON.parse(value) : null;
        } catch (_) { return null; }
      },
      async save(project) {
        const payload = clone(project);
        try {
          await idb("put", payload);
          try { local?.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) { /* IndexedDB already persisted it. */ }
          return "indexeddb";
        } catch (_) {
          try { local?.setItem(STORAGE_KEY, JSON.stringify(payload)); return "localStorage"; } catch (_) { throw new Error("Không thể tự lưu trên thiết bị này"); }
        }
      }
    };
  }

  function downloadBlob(blob, filename) {
    if (!globalScope.document || !globalScope.URL?.createObjectURL) return false;
    const anchor = globalScope.document.createElement("a");
    const url = globalScope.URL.createObjectURL(blob);
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    globalScope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1200);
    return true;
  }

  function svgToPngBlob(svgMarkup, width, height) {
    return new Promise((resolve, reject) => {
      if (!globalScope.document || typeof globalScope.Image !== "function") return reject(new Error("Trình duyệt không hỗ trợ Canvas/Image"));
      const canvas = globalScope.document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Không khởi tạo được Canvas 2D"));
      const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const url = globalScope.URL.createObjectURL(blob);
      const image = new globalScope.Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        globalScope.URL.revokeObjectURL(url);
        canvas.toBlob((output) => output ? resolve(output) : reject(new Error("Không tạo được PNG")), "image/png");
      };
      image.onerror = () => { globalScope.URL.revokeObjectURL(url); reject(new Error("Không đọc được SVG")); };
      image.src = url;
    });
  }

  async function exportPngSequence(project, frameCount, onProgress) {
    const data = normalizeProject(project);
    const count = Math.round(clamp(frameCount || 12, 2, 120));
    const outputs = [];
    for (let index = 0; index < count; index += 1) {
      const time = count === 1 ? 0 : data.timeline.duration * index / (count - 1);
      const blob = await svgToPngBlob(renderSvg(data, time), data.stage.width, data.stage.height);
      outputs.push({ filename: `hh-frame-${String(index + 1).padStart(3, "0")}.png`, blob, time });
      if (typeof onProgress === "function") onProgress(index + 1, count);
    }
    return outputs;
  }

  async function exportWebM(project, onProgress) {
    const data = normalizeProject(project);
    if (!globalScope.MediaRecorder || !globalScope.document) throw new Error("WebM chỉ khả dụng khi trình duyệt hỗ trợ MediaRecorder");
    const canvas = globalScope.document.createElement("canvas");
    canvas.width = data.stage.width;
    canvas.height = data.stage.height;
    if (typeof canvas.captureStream !== "function") throw new Error("Trình duyệt không hỗ trợ captureStream cho WebM");
    const context = canvas.getContext("2d");
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((item) => !globalScope.MediaRecorder.isTypeSupported || globalScope.MediaRecorder.isTypeSupported(item));
    if (!context || !mime) throw new Error("Không có bộ mã hóa WebM tương thích");
    const stream = canvas.captureStream(data.timeline.fps);
    const recorder = new globalScope.MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const finished = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
      recorder.onerror = () => reject(recorder.error || new Error("Mã hóa WebM thất bại"));
    });
    recorder.start(200);
    const frames = Math.max(2, Math.ceil(data.timeline.duration * data.timeline.fps));
    for (let index = 0; index < frames; index += 1) {
      const svg = renderSvg(data, data.timeline.duration * index / (frames - 1));
      const png = await svgToPngBlob(svg, data.stage.width, data.stage.height);
      const bitmap = typeof globalScope.createImageBitmap === "function" ? await globalScope.createImageBitmap(png) : null;
      if (bitmap) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0);
        bitmap.close?.();
      }
      if (typeof onProgress === "function" && index % Math.max(1, Math.floor(data.timeline.fps / 2)) === 0) onProgress(index + 1, frames);
      await new Promise((resolve) => globalScope.setTimeout(resolve, 1000 / data.timeline.fps));
    }
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    return finished;
  }

  function alignLayers(project, selectedIds, action) {
    if (!ALIGN_ACTIONS.includes(action)) return normalizeProject(project);
    const data = normalizeProject(project);
    const selected = data.layers.filter((layer) => selectedIds.includes(layer.id) && !["group", "composition", "mask"].includes(layer.type));
    if (selected.length < 2) return data;
    const bounds = selected.map((layer) => ({ layer, ...layerBounds(layer) }));
    const left = Math.min(...bounds.map((item) => item.x));
    const right = Math.max(...bounds.map((item) => item.x + item.width));
    const top = Math.min(...bounds.map((item) => item.y));
    const bottom = Math.max(...bounds.map((item) => item.y + item.height));
    if (action === "distribute-x" || action === "distribute-y") {
      const horizontal = action === "distribute-x";
      const sorted = [...bounds].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
      const start = horizontal ? left : top;
      const end = horizontal ? right : bottom;
      const totalSize = sorted.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0);
      const gap = (end - start - totalSize) / Math.max(1, sorted.length - 1);
      let cursor = start;
      sorted.forEach((item) => {
        const delta = cursor - (horizontal ? item.x : item.y);
        item.layer.transform[horizontal ? "x" : "y"] += delta;
        cursor += (horizontal ? item.width : item.height) + gap;
      });
      return data;
    }
    bounds.forEach((item) => {
      if (action === "left") item.layer.transform.x += left - item.x;
      if (action === "center-x") item.layer.transform.x += (left + right) / 2 - (item.x + item.width / 2);
      if (action === "right") item.layer.transform.x += right - (item.x + item.width);
      if (action === "top") item.layer.transform.y += top - item.y;
      if (action === "center-y") item.layer.transform.y += (top + bottom) / 2 - (item.y + item.height / 2);
      if (action === "bottom") item.layer.transform.y += bottom - (item.y + item.height);
    });
    return data;
  }

  function ensureStyles() {
    if (!globalScope.document || globalScope.document.getElementById(STYLE_ID)) return;
    const style = globalScope.document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhvc{--vc-bg:#080c14;--vc-panel:#0d141f;--vc-panel-2:#111b29;--vc-line:#253448;--vc-line-2:#334961;--vc-text:#eef4ff;--vc-muted:#8b9bb0;--vc-cyan:#62dfe8;--vc-pink:#f05caf;--vc-lime:#b9e86f;--vc-yellow:#ffd166;color:var(--vc-text);background:radial-gradient(circle at 18% 4%,rgba(240,92,175,.12),transparent 28%),radial-gradient(circle at 88% 12%,rgba(98,223,232,.11),transparent 28%),var(--vc-bg);font:12px/1.45 Inter,Segoe UI,system-ui,sans-serif;min-height:720px;overflow:hidden;border:1px solid var(--vc-line);border-radius:8px;letter-spacing:0}.hhvc *{box-sizing:border-box}.hhvc button,.hhvc input,.hhvc select{font:inherit;letter-spacing:0}.hhvc button{color:inherit}.hhvc-topbar{min-height:54px;display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--vc-line);background:rgba(9,14,23,.94);backdrop-filter:blur(18px)}.hhvc-brand{display:flex;align-items:center;gap:9px;margin-right:auto;min-width:220px}.hhvc-mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--vc-cyan);border-radius:7px;color:var(--vc-cyan);font-weight:900;background:linear-gradient(145deg,rgba(98,223,232,.18),rgba(240,92,175,.14));box-shadow:0 0 24px rgba(98,223,232,.12)}.hhvc-brand strong,.hhvc-brand span{display:block}.hhvc-brand span{color:var(--vc-muted);font-size:9px}.hhvc-project-name{width:min(290px,26vw);background:#09101a;border:1px solid var(--vc-line);border-radius:6px;color:var(--vc-text);padding:8px 10px}.hhvc-btn,.hhvc-tool,.hhvc-icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:0 10px;border:1px solid var(--vc-line);border-radius:6px;background:#111a26;cursor:pointer;transition:transform .14s ease,border-color .14s ease,background .14s ease,color .14s ease}.hhvc-btn:hover,.hhvc-tool:hover,.hhvc-icon-btn:hover{border-color:var(--vc-cyan);color:#fff;background:#142433}.hhvc-btn:active,.hhvc-tool:active{transform:translateY(1px)}.hhvc-btn:focus-visible,.hhvc-tool:focus-visible,.hhvc input:focus-visible,.hhvc select:focus-visible{outline:2px solid var(--vc-cyan);outline-offset:2px}.hhvc-btn-primary{background:linear-gradient(135deg,var(--vc-cyan),#8cd6ae);border-color:transparent;color:#071018;font-weight:850}.hhvc-btn-pink{border-color:rgba(240,92,175,.55);color:#ff8dce}.hhvc-body{display:grid;grid-template-columns:54px 230px minmax(360px,1fr) 270px;height:calc(100vh - 164px);min-height:570px;max-height:940px}.hhvc-toolbar{border-right:1px solid var(--vc-line);padding:8px 6px;background:#090f18;display:flex;flex-direction:column;align-items:center;gap:5px}.hhvc-tool{width:40px;height:38px;padding:0;position:relative;font-weight:850}.hhvc-tool small{position:absolute;right:2px;bottom:0;color:var(--vc-muted);font-size:7px}.hhvc-tool[aria-pressed=true]{border-color:var(--vc-pink);background:rgba(240,92,175,.16);color:#ff8dce;box-shadow:inset 3px 0 var(--vc-pink)}.hhvc-panel{background:rgba(10,16,26,.9);min-width:0;overflow:auto}.hhvc-layers{border-right:1px solid var(--vc-line)}.hhvc-inspector{border-left:1px solid var(--vc-line)}.hhvc-panel-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;min-height:42px;padding:8px 10px;background:rgba(13,20,31,.96);border-bottom:1px solid var(--vc-line)}.hhvc-eyebrow{font-size:8px;color:var(--vc-cyan);font-weight:850;text-transform:uppercase}.hhvc-layer-tree{padding:7px}.hhvc-layer-row{display:grid;grid-template-columns:24px 24px minmax(0,1fr) 24px;align-items:center;gap:4px;min-height:38px;padding:3px 4px 3px calc(4px + var(--vc-depth,0)*12px);border:1px solid transparent;border-radius:6px;color:#b6c2d2}.hhvc-layer-row:hover{background:#111b28}.hhvc-layer-row.is-selected{background:linear-gradient(90deg,rgba(98,223,232,.16),rgba(240,92,175,.08));border-color:rgba(98,223,232,.38);color:#fff}.hhvc-layer-row.is-hidden{opacity:.5}.hhvc-layer-row button{width:24px;height:24px;padding:0;border:0;background:transparent;color:var(--vc-muted);cursor:pointer}.hhvc-layer-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.hhvc-layer-kind{color:var(--vc-cyan);font-size:8px}.hhvc-layer-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px;border-top:1px solid var(--vc-line)}.hhvc-workspace{min-width:0;background:#070b12;display:grid;grid-template-rows:auto minmax(280px,1fr) 230px}.hhvc-contextbar{display:flex;align-items:center;gap:5px;min-height:44px;padding:6px 8px;border-bottom:1px solid var(--vc-line);background:#0d141e;overflow-x:auto}.hhvc-contextbar .hhvc-divider{width:1px;height:24px;background:var(--vc-line);flex:0 0 auto}.hhvc-contextbar label{display:flex;align-items:center;gap:4px;color:var(--vc-muted);white-space:nowrap}.hhvc-contextbar input[type=checkbox]{accent-color:var(--vc-cyan)}.hhvc-stage-shell{position:relative;overflow:auto;display:grid;place-items:center;padding:24px;background-color:#070b12;background-image:linear-gradient(45deg,#0c131e 25%,transparent 25%),linear-gradient(-45deg,#0c131e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0c131e 75%),linear-gradient(-45deg,transparent 75%,#0c131e 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.hhvc-artboard{position:relative;width:min(100%,1100px);aspect-ratio:var(--vc-ratio,16/9);box-shadow:0 22px 70px rgba(0,0,0,.55),0 0 0 1px #314258;isolation:isolate;touch-action:none;user-select:none}.hhvc-artboard svg{display:block;width:100%;height:100%;overflow:visible}.hhvc-artboard [data-layer-id]{cursor:pointer}.hhvc-selection{fill:none;stroke:var(--vc-cyan);stroke-width:2;stroke-dasharray:8 5;pointer-events:none;vector-effect:non-scaling-stroke}.hhvc-anchor{fill:#08111c;stroke:var(--vc-pink);stroke-width:2;vector-effect:non-scaling-stroke}.hhvc-handle{fill:var(--vc-cyan);stroke:#071018;stroke-width:1;vector-effect:non-scaling-stroke}.hhvc-guide{stroke:var(--vc-pink);stroke-width:1.5;stroke-dasharray:4 4;vector-effect:non-scaling-stroke;pointer-events:none}.hhvc-timeline{border-top:1px solid var(--vc-line);background:#0a111b;overflow:hidden;display:grid;grid-template-rows:42px minmax(0,1fr)}.hhvc-transport{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--vc-line)}.hhvc-time{font-variant-numeric:tabular-nums;color:var(--vc-cyan);font-weight:800;margin-left:auto}.hhvc-timebar{overflow:auto;position:relative;padding-left:126px}.hhvc-ruler{position:sticky;top:0;height:28px;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 1px),#26364a calc(10% - 1px) 10%);border-bottom:1px solid var(--vc-line)}.hhvc-work-area{position:absolute;top:2px;height:22px;background:rgba(98,223,232,.12);border:1px solid rgba(98,223,232,.38);pointer-events:none}.hhvc-marker{position:absolute;top:2px;width:8px;height:8px;background:var(--vc-yellow);transform:rotate(45deg) translateX(-50%);border-radius:1px}.hhvc-playhead{position:absolute;top:0;bottom:0;width:1px;background:var(--vc-pink);pointer-events:none;z-index:3}.hhvc-playhead:before{content:"";position:absolute;top:0;left:-4px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--vc-pink)}.hhvc-track{height:34px;position:relative;border-bottom:1px solid #182436}.hhvc-track-name{position:sticky;left:-126px;transform:translateX(-126px);width:122px;height:34px;display:flex;align-items:center;padding:0 8px;background:#0e1723;border-right:1px solid var(--vc-line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:2}.hhvc-key{position:absolute;top:13px;width:9px;height:9px;background:var(--vc-cyan);border:1px solid #fff;transform:rotate(45deg) translateX(-50%);border-radius:1px;cursor:pointer}.hhvc-inspector-body{padding:10px}.hhvc-section{padding:10px 0;border-bottom:1px solid var(--vc-line)}.hhvc-section:first-child{padding-top:0}.hhvc-section h4{margin:0 0 9px;font-size:10px}.hhvc-field{display:grid;gap:4px;margin:8px 0;color:var(--vc-muted);font-size:9px}.hhvc-field input,.hhvc-field select{min-width:0;width:100%;height:32px;padding:0 8px;border:1px solid var(--vc-line);border-radius:5px;background:#080f18;color:var(--vc-text)}.hhvc-field input[type=color]{padding:3px}.hhvc-field input[type=range]{padding:0;border:0;accent-color:var(--vc-pink)}.hhvc-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hhvc-chip-row{display:flex;gap:5px;flex-wrap:wrap}.hhvc-chip{padding:4px 7px;border:1px solid var(--vc-line);border-radius:999px;background:#0b131e;color:var(--vc-muted);font-size:8px}.hhvc-ease-preview{width:100%;aspect-ratio:1.6;border:1px solid var(--vc-line);border-radius:6px;background:linear-gradient(90deg,transparent 49.5%,rgba(255,255,255,.05) 50%,transparent 50.5%),linear-gradient(transparent 49.5%,rgba(255,255,255,.05) 50%,transparent 50.5%),#080f18}.hhvc-ease-preview path{fill:none;stroke:var(--vc-pink);stroke-width:3}.hhvc-ease-preview circle{fill:var(--vc-cyan)}.hhvc-status{display:flex;align-items:center;gap:8px;min-height:34px;padding:7px 10px;border-top:1px solid var(--vc-line);background:#090f18;color:var(--vc-muted);font-size:9px}.hhvc-status:before{content:"";width:7px;height:7px;border-radius:50%;background:#67dba1;box-shadow:0 0 12px #67dba1}.hhvc-hidden-input{position:absolute!important;width:1px;height:1px;opacity:0;pointer-events:none}.hhvc-empty{padding:24px 12px;text-align:center;color:var(--vc-muted)}@media(max-width:1200px){.hhvc-body{grid-template-columns:50px 190px minmax(340px,1fr)}.hhvc-inspector{grid-column:2/-1;border-left:0;border-top:1px solid var(--vc-line);display:none}.hhvc-body.is-inspector-open{grid-template-rows:minmax(480px,1fr) 360px;height:auto;max-height:none}.hhvc-body.is-inspector-open .hhvc-inspector{display:block;grid-column:2/-1}.hhvc-inspector-body{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:16px}.hhvc-section{border:1px solid var(--vc-line);border-radius:7px;padding:10px}}@media(max-width:820px){.hhvc{min-height:0}.hhvc-topbar{flex-wrap:wrap}.hhvc-brand{min-width:0}.hhvc-project-name{order:3;width:100%}.hhvc-body{display:grid;grid-template-columns:48px minmax(0,1fr);height:auto;max-height:none}.hhvc-layers{grid-column:2;max-height:230px;border-right:0;border-bottom:1px solid var(--vc-line)}.hhvc-workspace{grid-column:1/-1;grid-row:2;min-height:690px}.hhvc-inspector{grid-column:1/-1!important}.hhvc-toolbar{grid-row:1;grid-column:1}.hhvc-inspector-body{grid-template-columns:1fr 1fr}.hhvc-stage-shell{padding:14px}.hhvc-topbar .hhvc-btn span{display:none}}@media(max-width:520px){.hhvc-topbar{gap:4px}.hhvc-brand{width:100%}.hhvc-body{display:block}.hhvc-toolbar{position:sticky;top:0;z-index:8;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--vc-line);padding:6px}.hhvc-tool{flex:0 0 38px}.hhvc-layers{max-height:210px}.hhvc-workspace{display:block}.hhvc-contextbar{position:sticky;top:50px;z-index:6}.hhvc-stage-shell{min-height:300px}.hhvc-timeline{height:230px}.hhvc-inspector-body{display:block}.hhvc-grid-2{grid-template-columns:1fr}.hhvc-layer-actions{grid-template-columns:1fr 1fr}.hhvc-body.is-inspector-open{display:block}}@media(prefers-reduced-motion:reduce){.hhvc *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
    `;
    globalScope.document.head.appendChild(style);
  }

  function mount(root) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root).api;
    ensureStyles();
    const storage = createStorageDriver(globalScope);
    let project = createDefaultProject();
    let selectedIds = [project.layers.find((layer) => layer.type === "text")?.id || project.layers[0].id];
    let tool = "select";
    let currentTime = 0;
    let playing = false;
    let raf = 0;
    let playStarted = 0;
    let playOffset = 0;
    let interaction = null;
    let guides = [];
    let history = [];
    let future = [];
    let saveTimer = 0;
    let statusTimer = 0;
    const listeners = [];
    const reducedMotion = typeof globalScope.matchMedia === "function" && globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("hhvc");
    root.setAttribute("data-graphic-vector-core", "");
    root.setAttribute("aria-label", "HH Vector & Motion Core");
    root.innerHTML = `<header class="hhvc-topbar"><div class="hhvc-brand"><span class="hhvc-mark">VC</span><span><strong>Vector & Motion Core</strong><span>SVG · Bezier · Timeline · Composition</span></span></div><input class="hhvc-project-name" data-vc-project-name maxlength="120" aria-label="Tên dự án"><button class="hhvc-btn" type="button" data-vc-undo title="Hoàn tác Ctrl+Z">↶ <span>Hoàn tác</span></button><button class="hhvc-btn" type="button" data-vc-redo title="Làm lại Ctrl+Y">↷ <span>Làm lại</span></button><button class="hhvc-btn" type="button" data-vc-import>Mở</button><button class="hhvc-btn hhvc-btn-primary" type="button" data-vc-export="json">Lưu project</button><button class="hhvc-btn hhvc-btn-pink" type="button" data-vc-inspector>Thuộc tính</button><input class="hhvc-hidden-input" type="file" accept="application/json,.json,.hhvector" data-vc-file aria-label="Nhập project Vector Motion"></header><div class="hhvc-body" data-vc-body><aside class="hhvc-toolbar" aria-label="Công cụ vector">${TOOLS.map((item) => `<button class="hhvc-tool" type="button" data-vc-tool="${item.id}" aria-label="${item.label}" title="${item.label} (${item.key})"><span>${item.icon}</span><small>${item.key}</small></button>`).join("")}</aside><aside class="hhvc-panel hhvc-layers" aria-label="Cây layer"><div class="hhvc-panel-head"><div><span class="hhvc-eyebrow">Scene graph</span><strong>Layers</strong></div><button class="hhvc-icon-btn" type="button" data-vc-add-comp title="Nested composition">+ Comp</button></div><div class="hhvc-layer-tree" data-vc-layers></div><div class="hhvc-layer-actions"><button class="hhvc-btn" type="button" data-vc-group>Nhóm</button><button class="hhvc-btn" type="button" data-vc-ungroup>Bỏ nhóm</button><button class="hhvc-btn" type="button" data-vc-mask>Tạo mask</button><button class="hhvc-btn" type="button" data-vc-duplicate>Nhân bản</button></div></aside><main class="hhvc-workspace"><div class="hhvc-contextbar"><strong data-vc-tool-label>Chọn</strong><span class="hhvc-divider"></span>${ALIGN_ACTIONS.map((action) => `<button class="hhvc-icon-btn" type="button" data-vc-align="${action}" title="${action}">${({ left: "⇤", "center-x": "↔", right: "⇥", top: "↥", "center-y": "↕", bottom: "↧", "distribute-x": "⫼", "distribute-y": "⋮" })[action]}</button>`).join("")}<span class="hhvc-divider"></span><label><input type="checkbox" data-vc-snap> Snap</label><label><input type="checkbox" data-vc-smart-guides> Smart guide</label><label><input type="checkbox" data-vc-grid> Grid</label><span class="hhvc-divider"></span><button class="hhvc-btn" type="button" data-vc-add-marker>+ Marker</button><button class="hhvc-btn" type="button" data-vc-add-key>+ Keyframe</button></div><div class="hhvc-stage-shell"><div class="hhvc-artboard" data-vc-artboard tabindex="0" role="application" aria-label="Canvas SVG Vector Motion"><div data-vc-canvas></div></div></div><section class="hhvc-timeline" aria-label="Timeline nhiều track"><div class="hhvc-transport"><button class="hhvc-btn" type="button" data-vc-home title="Về đầu">|◀</button><button class="hhvc-btn hhvc-btn-primary" type="button" data-vc-play>▶ Phát</button><button class="hhvc-btn" type="button" data-vc-stop>■ Dừng</button><label>Đầu <input type="number" min="0" step="0.1" data-vc-work="start" style="width:58px"></label><label>Cuối <input type="number" min="0.1" step="0.1" data-vc-work="end" style="width:58px"></label><span class="hhvc-time" data-vc-time>00:00.00</span></div><div class="hhvc-timebar" data-vc-timebar><div class="hhvc-ruler" data-vc-ruler></div><div data-vc-tracks></div><i class="hhvc-playhead" data-vc-playhead></i></div></section></main><aside class="hhvc-panel hhvc-inspector" aria-label="Thuộc tính layer"><div class="hhvc-panel-head"><div><span class="hhvc-eyebrow">Inspector</span><strong data-vc-selection-name>Chưa chọn</strong></div><span class="hhvc-layer-kind" data-vc-selection-kind></span></div><div class="hhvc-inspector-body" data-vc-inspector-body></div></aside></div><footer class="hhvc-status" role="status" aria-live="polite" data-vc-status>Sẵn sàng. Project tự lưu bằng IndexedDB trên thiết bị.</footer>`;

    function on(node, event, handler, options) {
      node?.addEventListener(event, handler, options);
      if (node) listeners.push(() => node.removeEventListener(event, handler, options));
    }

    function announce(message) {
      const status = root.querySelector("[data-vc-status]");
      if (status) status.textContent = message;
      globalScope.clearTimeout(statusTimer);
      statusTimer = globalScope.setTimeout(() => { if (status) status.textContent = "Đã tự lưu project trên thiết bị."; }, 2800);
    }

    function persist() {
      project.meta.updatedAt = new Date().toISOString();
      globalScope.clearTimeout(saveTimer);
      saveTimer = globalScope.setTimeout(async () => {
        try {
          const target = await storage.save(project);
          const status = root.querySelector("[data-vc-status]");
          if (status) status.textContent = `Đã tự lưu bằng ${target}.`;
        } catch (error) { announce(error.message); }
      }, 240);
    }

    function snapshot() {
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      future = [];
    }

    function commit(mutator, message, renderMode) {
      snapshot();
      mutator(project);
      project = normalizeProject(project);
      selectedIds = selectedIds.filter((id) => project.layers.some((layer) => layer.id === id));
      persist();
      if (renderMode === "canvas") renderCanvas();
      else render();
      if (message) announce(message);
    }

    function undo() {
      if (!history.length) return announce("Không còn bước để hoàn tác.");
      future.push(clone(project));
      project = normalizeProject(history.pop());
      render(); persist(); announce("Đã hoàn tác.");
    }

    function redo() {
      if (!future.length) return announce("Không còn bước để làm lại.");
      history.push(clone(project));
      project = normalizeProject(future.pop());
      render(); persist(); announce("Đã làm lại.");
    }

    function selectedLayers() {
      return project.layers.filter((layer) => selectedIds.includes(layer.id));
    }

    function primaryLayer() {
      return project.layers.find((layer) => layer.id === selectedIds[selectedIds.length - 1]) || null;
    }

    function layerDepth(layer) {
      let depth = 0;
      let current = layer;
      const seen = new Set();
      while (current?.parentId && depth < 12 && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        current = project.layers.find((item) => item.id === current.parentId);
        depth += 1;
      }
      return depth;
    }

    function renderLayers() {
      const container = root.querySelector("[data-vc-layers]");
      container.innerHTML = project.layers.slice().reverse().map((layer) => `<div class="hhvc-layer-row${selectedIds.includes(layer.id) ? " is-selected" : ""}${layer.visible ? "" : " is-hidden"}" style="--vc-depth:${layerDepth(layer)}" data-vc-layer-row="${escapeHtml(layer.id)}"><button type="button" data-vc-visible="${escapeHtml(layer.id)}" aria-label="${layer.visible ? "Ẩn" : "Hiện"} ${escapeHtml(layer.name)}">${layer.visible ? "◉" : "○"}</button><button type="button" data-vc-lock="${escapeHtml(layer.id)}" aria-label="${layer.locked ? "Mở khóa" : "Khóa"} ${escapeHtml(layer.name)}">${layer.locked ? "▣" : "◇"}</button><button type="button" data-vc-select-layer="${escapeHtml(layer.id)}" style="width:auto;text-align:left"><strong>${escapeHtml(layer.name)}</strong><span class="hhvc-layer-kind">${layer.type.toUpperCase()}${layer.parentId ? " · CHILD" : ""}</span></button><button type="button" data-vc-delete="${escapeHtml(layer.id)}" aria-label="Xóa ${escapeHtml(layer.name)}">×</button></div>`).join("") || `<div class="hhvc-empty">Chưa có layer</div>`;
    }

    function selectionOverlay() {
      const layer = primaryLayer();
      if (!layer || ["group", "composition"].includes(layer.type)) return "";
      const bounds = layerBounds(layer);
      const transform = layer.transform;
      let anchors = "";
      if (["path", "mask"].includes(layer.type)) {
        anchors = layer.geometry.points.map((item, index) => `<g data-vc-anchor="${index}"><line x1="${item.inX}" y1="${item.inY}" x2="${item.outX}" y2="${item.outY}" stroke="#62dfe8" stroke-width="1" vector-effect="non-scaling-stroke"/><circle class="hhvc-handle" cx="${item.inX}" cy="${item.inY}" r="5"/><circle class="hhvc-handle" cx="${item.outX}" cy="${item.outY}" r="5"/><circle class="hhvc-anchor" cx="${item.x}" cy="${item.y}" r="6"/></g>`).join("");
      }
      return `<g transform="translate(${transform.x} ${transform.y})"><rect class="hhvc-selection" x="${bounds.x}" y="${bounds.y}" width="${Math.max(1, bounds.width)}" height="${Math.max(1, bounds.height)}"/>${anchors}</g>`;
    }

    function renderCanvas() {
      const canvas = root.querySelector("[data-vc-canvas]");
      const artboard = root.querySelector("[data-vc-artboard]");
      if (!canvas || !artboard) return;
      artboard.style.setProperty("--vc-ratio", `${project.stage.width}/${project.stage.height}`);
      const svg = renderSvg(project, currentTime).replace("</svg>", `${selectionOverlay()}${guides.map((guide) => guide.axis === "x" ? `<line class="hhvc-guide" x1="${guide.value}" x2="${guide.value}" y1="0" y2="${project.stage.height}"/>` : `<line class="hhvc-guide" y1="${guide.value}" y2="${guide.value}" x1="0" x2="${project.stage.width}"/>`).join("")}</svg>`);
      canvas.innerHTML = svg;
      const playhead = root.querySelector("[data-vc-playhead]");
      if (playhead) playhead.style.left = `${126 + currentTime / project.timeline.duration * Math.max(300, root.querySelector("[data-vc-timebar]")?.clientWidth - 126 || 600)}px`;
      const timeLabel = root.querySelector("[data-vc-time]");
      if (timeLabel) timeLabel.textContent = `00:${String(Math.floor(currentTime)).padStart(2, "0")}.${String(Math.floor(currentTime % 1 * 100)).padStart(2, "0")}`;
    }

    function renderTimeline() {
      const tracks = root.querySelector("[data-vc-tracks]");
      const ruler = root.querySelector("[data-vc-ruler]");
      const width = Math.max(360, root.querySelector("[data-vc-timebar]")?.clientWidth - 126 || 600);
      const percent = (time) => clamp(time / project.timeline.duration * 100, 0, 100);
      ruler.innerHTML = `<div class="hhvc-work-area" style="left:${percent(project.timeline.workArea.start)}%;width:${percent(project.timeline.workArea.end - project.timeline.workArea.start)}%"></div>${project.timeline.markers.map((marker) => `<i class="hhvc-marker" style="left:${percent(marker.time)}%" title="${escapeHtml(marker.label)} · ${round(marker.time)}s"></i>`).join("")}`;
      tracks.innerHTML = project.layers.filter((layer) => layer.type !== "mask").map((layer) => `<div class="hhvc-track" data-vc-track="${escapeHtml(layer.id)}"><span class="hhvc-track-name">${escapeHtml(layer.name)}</span>${layer.keyframes.map((key) => `<button class="hhvc-key" type="button" data-vc-key="${escapeHtml(key.id)}" data-vc-key-layer="${escapeHtml(layer.id)}" style="left:${percent(key.time)}%" title="${round(key.time)} giây"></button>`).join("")}</div>`).join("");
      root.querySelector("[data-vc-timebar]").style.setProperty("--vc-track-width", `${width}px`);
    }

    function inspectorMarkup(layer) {
      if (!layer) return `<div class="hhvc-empty">Chọn một layer để chỉnh thuộc tính.</div>`;
      const parents = project.layers.filter((item) => ["group", "composition"].includes(item.type) && item.id !== layer.id);
      const key = layer.keyframes.slice().sort((a, b) => Math.abs(a.time - currentTime) - Math.abs(b.time - currentTime))[0];
      const easing = key?.easing || [0.42, 0, 0.58, 1];
      const easePath = `M 10 110 C ${10 + easing[0] * 120} ${110 - easing[1] * 100} ${10 + easing[2] * 120} ${110 - easing[3] * 100} 130 10`;
      return `<section class="hhvc-section"><h4>Layer</h4><label class="hhvc-field"><span>Tên</span><input data-vc-prop="name" value="${escapeHtml(layer.name)}" maxlength="80"></label><label class="hhvc-field"><span>Parent</span><select data-vc-prop="parentId"><option value="">Không có</option>${parents.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === layer.parentId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label><div class="hhvc-grid-2"><label class="hhvc-field"><span>Blend</span><select data-vc-prop="blendMode">${BLEND_MODES.map((mode) => `<option${mode === layer.blendMode ? " selected" : ""}>${mode}</option>`).join("")}</select></label><label class="hhvc-field"><span>Matte</span><select data-vc-prop="matte">${MATTE_MODES.map((mode) => `<option${mode === layer.matte ? " selected" : ""}>${mode}</option>`).join("")}</select></label></div><label class="hhvc-field"><span>Mask</span><select data-vc-prop="maskId"><option value="">Không có</option>${project.layers.filter((item) => item.type === "mask").map((item) => `<option value="${escapeHtml(item.id)}"${item.id === layer.maskId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="hhvc-field"><span><input type="checkbox" data-vc-prop="clip"${layer.clip ? " checked" : ""}> Clipping path</span></label></section><section class="hhvc-section"><h4>Transform</h4><div class="hhvc-grid-2">${[["x", "X"], ["y", "Y"], ["scaleX", "Scale X"], ["scaleY", "Scale Y"], ["rotation", "Xoay"], ["opacity", "Opacity"]].map(([keyName, label]) => `<label class="hhvc-field"><span>${label}</span><input type="number" step="${keyName === "opacity" ? ".01" : ".1"}" data-vc-transform="${keyName}" value="${round(layer.transform[keyName], 3)}"></label>`).join("")}</div></section><section class="hhvc-section"><h4>Appearance</h4><div class="hhvc-grid-2"><label class="hhvc-field"><span>Fill</span><input type="color" data-vc-style="fill" value="${/^#[0-9a-f]{6}$/i.test(layer.style.fill) ? layer.style.fill : "#62dfe8"}"></label><label class="hhvc-field"><span>Stroke</span><input type="color" data-vc-style="stroke" value="${/^#[0-9a-f]{6}$/i.test(layer.style.stroke) ? layer.style.stroke : "#f05caf"}"></label><label class="hhvc-field"><span>Độ dày</span><input type="number" min="0" max="500" data-vc-style="strokeWidth" value="${layer.style.strokeWidth}"></label><label class="hhvc-field"><span>Font size</span><input type="number" min="6" max="1000" data-vc-style="fontSize" value="${layer.style.fontSize}"></label></div>${layer.type === "text" ? `<label class="hhvc-field"><span>Nội dung</span><input data-vc-geometry="text" value="${escapeHtml(layer.geometry.text)}" maxlength="1000"></label>` : ""}</section><section class="hhvc-section"><h4>Trim Path & Morph</h4><label class="hhvc-field"><span><input type="checkbox" data-vc-trim="enabled"${layer.trim.enabled ? " checked" : ""}> Bật Trim Path</span></label><div class="hhvc-grid-2"><label class="hhvc-field"><span>Start</span><input type="range" min="0" max="100" data-vc-trim="start" value="${layer.trim.start}"></label><label class="hhvc-field"><span>End</span><input type="range" min="0" max="100" data-vc-trim="end" value="${layer.trim.end}"></label></div><div class="hhvc-chip-row"><span class="hhvc-chip">Motion path: ${layer.motionPath.length} điểm</span><span class="hhvc-chip">Morph: ${layer.morphModel.length} shape</span><button class="hhvc-btn" type="button" data-vc-use-path>Đặt motion path</button><button class="hhvc-btn" type="button" data-vc-capture-morph>Chụp morph</button></div></section><section class="hhvc-section"><h4>Cubic-bezier easing</h4><svg class="hhvc-ease-preview" viewBox="0 0 140 120" role="img" aria-label="Biểu đồ cubic-bezier"><path d="M10 110 L130 10" stroke="#28384c"/><path d="${easePath}"/><circle cx="${10 + easing[0] * 120}" cy="${110 - easing[1] * 100}" r="4"/><circle cx="${10 + easing[2] * 120}" cy="${110 - easing[3] * 100}" r="4"/></svg><div class="hhvc-grid-2">${easing.map((value, index) => `<label class="hhvc-field"><span>${["X1", "Y1", "X2", "Y2"][index]}</span><input type="number" min="${index % 2 ? -2 : 0}" max="${index % 2 ? 2 : 1}" step=".01" data-vc-easing="${index}" value="${round(value, 3)}"></label>`).join("")}</div></section><section class="hhvc-section"><h4>Xuất</h4><div class="hhvc-chip-row"><button class="hhvc-btn" type="button" data-vc-export="svg">SVG động</button><button class="hhvc-btn" type="button" data-vc-export="png">PNG hiện tại</button><button class="hhvc-btn" type="button" data-vc-export="sequence">PNG sequence</button><button class="hhvc-btn" type="button" data-vc-export="webm">WebM</button></div><p style="color:var(--vc-muted);font-size:9px">PNG sequence tải nhiều PNG riêng, không giả dạng ZIP. WebM chỉ chạy khi MediaRecorder và captureStream được hỗ trợ.</p></section>`;
    }

    function renderInspector() {
      const layer = primaryLayer();
      root.querySelector("[data-vc-selection-name]").textContent = layer?.name || "Chưa chọn";
      root.querySelector("[data-vc-selection-kind]").textContent = layer?.type?.toUpperCase() || "";
      const inspector = root.querySelector("[data-vc-inspector-body]");
      inspector.innerHTML = inspectorMarkup(layer);
      if (!layer) return;
      inspector.insertAdjacentHTML("beforeend", `<section class="hhvc-section"><h4>Expression an toàn</h4><label class="hhvc-field"><span>Rotation</span><input data-vc-expression="rotation" maxlength="240" placeholder="progress * 360" value="${escapeHtml(layer.expressions.rotation || "")}"></label><label class="hhvc-field"><span>Opacity</span><input data-vc-expression="opacity" maxlength="240" placeholder="clamp(value, 0, 1)" value="${escapeHtml(layer.expressions.opacity || "")}"></label><p style="color:var(--vc-muted);font-size:9px">Chỉ hỗ trợ số, time, progress, value và hàm whitelist. Không dùng eval hoặc JavaScript.</p><div class="hhvc-chip-row"><button class="hhvc-btn" type="button" data-vc-export="lottie">Lottie subset</button><button class="hhvc-btn" type="button" data-vc-export="gif">GIF</button></div></section>`);
    }

    function renderControls() {
      root.querySelector("[data-vc-project-name]").value = project.meta.name;
      root.querySelectorAll("[data-vc-tool]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.vcTool === tool)));
      root.querySelector("[data-vc-tool-label]").textContent = TOOLS.find((item) => item.id === tool)?.label || "Chọn";
      root.querySelector("[data-vc-snap]").checked = project.settings.snap;
      root.querySelector("[data-vc-smart-guides]").checked = project.settings.smartGuides;
      root.querySelector("[data-vc-grid]").checked = project.settings.showGrid;
      root.querySelectorAll("[data-vc-work]").forEach((input) => { input.value = project.timeline.workArea[input.dataset.vcWork]; input.max = project.timeline.duration; });
    }

    function render() {
      renderControls(); renderLayers(); renderCanvas(); renderTimeline(); renderInspector();
    }

    function setTool(nextTool) {
      if (!TOOLS.some((item) => item.id === nextTool)) return;
      tool = nextTool;
      renderControls();
      root.querySelector("[data-vc-artboard]")?.focus({ preventScroll: true });
    }

    function selectLayer(id, additive) {
      if (!project.layers.some((layer) => layer.id === id)) return;
      selectedIds = additive ? (selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]) : [id];
      renderLayers(); renderCanvas(); renderInspector();
    }

    function canvasPoint(event) {
      const svg = root.querySelector("[data-vc-canvas] svg");
      const box = svg?.getBoundingClientRect();
      if (!svg || !box?.width || !box?.height) return { x: 0, y: 0 };
      return { x: (event.clientX - box.left) / box.width * project.stage.width, y: (event.clientY - box.top) / box.height * project.stage.height };
    }

    function snapPoint(rawPoint, movingLayer) {
      let x = rawPoint.x;
      let y = rawPoint.y;
      guides = [];
      if (project.settings.snap) {
        x = Math.round(x / project.settings.grid) * project.settings.grid;
        y = Math.round(y / project.settings.grid) * project.settings.grid;
      }
      if (project.settings.smartGuides) {
        const threshold = 7;
        project.layers.filter((layer) => layer.id !== movingLayer?.id && !["group", "composition", "mask"].includes(layer.type)).forEach((layer) => {
          const bounds = layerBounds(layer);
          [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width].forEach((value) => { if (Math.abs(x - value) <= threshold) { x = value; guides.push({ axis: "x", value }); } });
          [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height].forEach((value) => { if (Math.abs(y - value) <= threshold) { y = value; guides.push({ axis: "y", value }); } });
        });
      }
      return { x, y };
    }

    function beginCanvasInteraction(event) {
      if (event.button !== 0) return;
      const raw = canvasPoint(event);
      const hit = event.target.closest?.("[data-layer-id]")?.getAttribute("data-layer-id");
      if (tool === "select") {
        if (hit) selectLayer(hit, event.shiftKey || event.ctrlKey || event.metaKey);
        else if (!event.shiftKey) { selectedIds = []; render(); return; }
        const layer = primaryLayer();
        if (!layer || layer.locked) return;
        snapshot();
        interaction = { type: "move", start: raw, original: selectedLayers().map((item) => ({ id: item.id, x: item.transform.x, y: item.transform.y })) };
        return;
      }
      const start = snapPoint(raw);
      if (tool === "pen") {
        let layer = primaryLayer();
        let created = false;
        if (!layer || layer.type !== "path" || event.altKey) {
          snapshot();
          layer = createLayer("pen", start.x, start.y);
          project.layers.push(layer);
          selectedIds = [layer.id];
          created = true;
        } else snapshot();
        if (!created) layer.geometry.points.push(point(start));
        interaction = { type: "pen", layerId: layer.id, pointIndex: created ? 0 : layer.geometry.points.length - 1, start };
        render(); persist();
        return;
      }
      snapshot();
      const layer = createLayer(tool, start.x, start.y);
      project.layers.push(layer);
      selectedIds = [layer.id];
      interaction = { type: "draw", layerId: layer.id, start, tool };
      if (tool === "text") interaction = null;
      render(); persist();
    }

    function moveCanvasInteraction(event) {
      if (!interaction) return;
      const raw = canvasPoint(event);
      const layer = project.layers.find((item) => item.id === interaction.layerId) || primaryLayer();
      if (!layer) return;
      const current = snapPoint(raw, layer);
      if (interaction.type === "move") {
        const dx = current.x - interaction.start.x;
        const dy = current.y - interaction.start.y;
        interaction.original.forEach((origin) => {
          const target = project.layers.find((item) => item.id === origin.id);
          if (target) { target.transform.x = origin.x + dx; target.transform.y = origin.y + dy; }
        });
      }
      if (interaction.type === "draw") {
        const x = Math.min(interaction.start.x, current.x);
        const y = Math.min(interaction.start.y, current.y);
        const width = Math.max(1, Math.abs(current.x - interaction.start.x));
        const height = Math.max(1, Math.abs(current.y - interaction.start.y));
        if (layer.type === "ellipse") { layer.geometry.cx = x + width / 2; layer.geometry.cy = y + height / 2; layer.geometry.width = width; layer.geometry.height = height; }
        else if (["polygon", "star"].includes(layer.type)) { layer.geometry.cx = interaction.start.x; layer.geometry.cy = interaction.start.y; layer.geometry.radius = Math.max(width, height); layer.geometry.innerRadius = layer.geometry.radius * 0.44; }
        else { layer.geometry.x = x; layer.geometry.y = y; layer.geometry.width = width; layer.geometry.height = height; }
      }
      if (interaction.type === "pen") {
        const anchor = layer.geometry.points[interaction.pointIndex];
        const dx = current.x - interaction.start.x;
        const dy = current.y - interaction.start.y;
        anchor.outX = anchor.x + dx;
        anchor.outY = anchor.y + dy;
        anchor.inX = anchor.x - dx;
        anchor.inY = anchor.y - dy;
      }
      renderCanvas(); renderInspector();
    }

    function endCanvasInteraction() {
      if (!interaction) return;
      project = normalizeProject(project);
      interaction = null;
      guides = [];
      persist(); render();
    }

    function groupSelection() {
      const layers = selectedLayers();
      if (layers.length < 2) return announce("Chọn ít nhất hai layer để nhóm.");
      commit((draft) => {
        const group = normalizeLayer({ id: uid("group"), name: "Nhóm mới", type: "group", expanded: true }, draft.layers.length, draft.timeline.duration);
        draft.layers.push(group);
        layers.forEach((item) => { const target = draft.layers.find((layer) => layer.id === item.id); if (target) target.parentId = group.id; });
        selectedIds = [group.id];
      }, "Đã tạo nhóm layer.");
    }

    function ungroupSelection() {
      const groups = selectedLayers().filter((layer) => ["group", "composition"].includes(layer.type));
      if (!groups.length) return announce("Chọn group hoặc composition để bỏ nhóm.");
      commit((draft) => {
        groups.forEach((group) => {
          draft.layers.forEach((layer) => { if (layer.parentId === group.id) layer.parentId = group.parentId || null; });
          draft.layers = draft.layers.filter((layer) => layer.id !== group.id);
        });
        selectedIds = [];
      }, "Đã bỏ nhóm.");
    }

    function createMaskFromSelection() {
      const layers = selectedLayers();
      if (layers.length < 2) return announce("Chọn layer nội dung và một shape làm mask.");
      commit((draft) => {
        const target = draft.layers.find((layer) => layer.id === layers[0].id);
        const mask = draft.layers.find((layer) => layer.id === layers[layers.length - 1].id);
        if (!target || !mask) return;
        if (!["path", "rect", "ellipse", "polygon", "star"].includes(mask.type)) return;
        if (mask.type !== "path") {
          const bounds = layerBounds(mask);
          mask.geometry.points = [point({ x: bounds.x, y: bounds.y }), point({ x: bounds.x + bounds.width, y: bounds.y }), point({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }), point({ x: bounds.x, y: bounds.y + bounds.height })];
          mask.geometry.closed = true;
        }
        mask.type = "mask";
        mask.name = `Mask · ${mask.name}`;
        target.maskId = mask.id;
        selectedIds = [target.id];
      }, "Đã tạo mask. Bật Clipping path trong Inspector khi cần.");
    }

    function addKeyframe() {
      const layer = primaryLayer();
      if (!layer) return announce("Chọn layer trước khi thêm keyframe.");
      commit((draft) => {
        const target = draft.layers.find((item) => item.id === layer.id);
        const existing = target.keyframes.find((key) => Math.abs(key.time - currentTime) < 0.01);
        if (existing) existing.transform = clone(target.transform);
        else target.keyframes.push(normalizeKeyframe({ time: currentTime, transform: target.transform, easing: [0.42, 0, 0.58, 1], morphPoints: target.geometry.points }, draft.timeline.duration));
        target.keyframes.sort((a, b) => a.time - b.time);
      }, "Đã thêm keyframe.");
    }

    function playPause() {
      if (reducedMotion) return announce("Animation đã tắt theo tùy chọn giảm chuyển động của hệ thống.");
      playing = !playing;
      const button = root.querySelector("[data-vc-play]");
      if (button) button.textContent = playing ? "Ⅱ Tạm dừng" : "▶ Phát";
      if (playing) {
        playStarted = globalScope.performance?.now?.() || Date.now();
        playOffset = currentTime;
        raf = globalScope.requestAnimationFrame(frame);
      } else globalScope.cancelAnimationFrame(raf);
    }

    function frame(now) {
      if (!playing) return;
      const elapsed = ((now || Date.now()) - playStarted) / 1000;
      const start = project.timeline.workArea.start;
      const end = Math.max(start + 0.01, project.timeline.workArea.end);
      currentTime = start + ((playOffset - start + elapsed) % (end - start));
      renderCanvas();
      raf = globalScope.requestAnimationFrame(frame);
    }

    async function handleExport(kind) {
      try {
        const base = project.meta.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "hh-vector-motion";
        if (kind === "json") downloadBlob(new Blob([exportProject(project)], { type: "application/json" }), `${base}.hhvector.json`);
        if (kind === "svg") downloadBlob(new Blob([renderAnimatedSvg(project)], { type: "image/svg+xml;charset=utf-8" }), `${base}.animated.svg`);
        if (kind === "lottie") downloadBlob(new Blob([exportLottie(project)], { type: "application/json" }), `${base}.lottie.json`);
        if (kind === "png") {
          announce("Đang dựng PNG từ SVG...");
          const blob = await svgToPngBlob(renderSvg(project, currentTime), project.stage.width, project.stage.height);
          downloadBlob(blob, `${base}.png`);
        }
        if (kind === "sequence") {
          announce("Đang dựng PNG sequence. Trình duyệt có thể hỏi quyền tải nhiều tệp.");
          const frames = await exportPngSequence(project, Math.min(24, Math.max(8, Math.round(project.timeline.duration * 2))), (done, total) => announce(`Đang dựng frame ${done}/${total}...`));
          frames.forEach((item, index) => globalScope.setTimeout(() => downloadBlob(item.blob, item.filename), index * 130));
        }
        if (kind === "webm") {
          announce("Đang mã hóa WebM bằng MediaRecorder...");
          const blob = await exportWebM(project, (done, total) => announce(`WebM ${Math.round(done / total * 100)}%`));
          downloadBlob(blob, `${base}.webm`);
        }
        if (kind === "gif") {
          announce("Dang ma hoa GIF 256 mau tren thiet bi...");
          const blob = await exportGif(project, { fps: 12, maxWidth: 960 }, (done, total) => announce(`GIF ${Math.round(done / total * 100)}%`));
          downloadBlob(blob, `${base}.gif`);
        }
        announce(`Đã chuẩn bị tệp ${kind.toUpperCase()}.`);
      } catch (error) { announce(error.message || "Không thể xuất định dạng này."); }
    }

    on(root, "click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.vcTool) return setTool(target.dataset.vcTool);
      if (target.dataset.vcSelectLayer) return selectLayer(target.dataset.vcSelectLayer, event.shiftKey || event.ctrlKey || event.metaKey);
      if (target.dataset.vcVisible) return commit((draft) => { const layer = draft.layers.find((item) => item.id === target.dataset.vcVisible); if (layer) layer.visible = !layer.visible; });
      if (target.dataset.vcLock) return commit((draft) => { const layer = draft.layers.find((item) => item.id === target.dataset.vcLock); if (layer) layer.locked = !layer.locked; });
      if (target.dataset.vcDelete) return commit((draft) => { const id = target.dataset.vcDelete; draft.layers = draft.layers.filter((layer) => layer.id !== id); draft.layers.forEach((layer) => { if (layer.parentId === id) layer.parentId = null; if (layer.maskId === id) layer.maskId = null; }); selectedIds = selectedIds.filter((item) => item !== id); }, "Đã xóa layer.");
      if (target.dataset.vcAlign) return commit((draft) => { const aligned = alignLayers(draft, selectedIds, target.dataset.vcAlign); Object.assign(draft, aligned); }, "Đã căn chỉnh layer.");
      if (target.hasAttribute("data-vc-group")) return groupSelection();
      if (target.hasAttribute("data-vc-ungroup")) return ungroupSelection();
      if (target.hasAttribute("data-vc-mask")) return createMaskFromSelection();
      if (target.hasAttribute("data-vc-duplicate")) return commit((draft) => { const copies = selectedLayers().map((layer) => ({ ...clone(layer), id: uid(layer.type), name: `${layer.name} copy`, transform: { ...layer.transform, x: layer.transform.x + 24, y: layer.transform.y + 24 } })); draft.layers.push(...copies); selectedIds = copies.map((layer) => layer.id); }, "Đã nhân bản layer.");
      if (target.hasAttribute("data-vc-add-comp")) return commit((draft) => { const comp = normalizeLayer({ id: uid("comp"), name: "Nested Composition", type: "composition" }, draft.layers.length, draft.timeline.duration); draft.layers.push(comp); draft.timeline.compositions.push({ id: comp.id, name: comp.name, duration: draft.timeline.duration }); selectedIds = [comp.id]; }, "Đã tạo nested composition.");
      if (target.hasAttribute("data-vc-add-marker")) return commit((draft) => { draft.timeline.markers.push({ id: uid("marker"), time: currentTime, label: `Marker ${draft.timeline.markers.length + 1}` }); }, "Đã thêm marker.");
      if (target.hasAttribute("data-vc-add-key")) return addKeyframe();
      if (target.hasAttribute("data-vc-undo")) return undo();
      if (target.hasAttribute("data-vc-redo")) return redo();
      if (target.hasAttribute("data-vc-import")) return root.querySelector("[data-vc-file]").click();
      if (target.dataset.vcExport) return handleExport(target.dataset.vcExport);
      if (target.hasAttribute("data-vc-inspector")) { root.querySelector("[data-vc-body]").classList.toggle("is-inspector-open"); return; }
      if (target.hasAttribute("data-vc-play")) return playPause();
      if (target.hasAttribute("data-vc-stop")) { playing = false; globalScope.cancelAnimationFrame(raf); currentTime = project.timeline.workArea.start; root.querySelector("[data-vc-play]").textContent = "▶ Phát"; renderCanvas(); return; }
      if (target.hasAttribute("data-vc-home")) { currentTime = 0; renderCanvas(); return; }
      if (target.dataset.vcKey) { const layer = project.layers.find((item) => item.id === target.dataset.vcKeyLayer); const key = layer?.keyframes.find((item) => item.id === target.dataset.vcKey); if (key) { currentTime = key.time; selectedIds = [layer.id]; render(); } return; }
      if (target.hasAttribute("data-vc-use-path")) return commit((draft) => { const layer = draft.layers.find((item) => item.id === primaryLayer()?.id); if (layer) layer.motionPath = layer.geometry.points.length ? clone(layer.geometry.points) : [{ x: 0, y: 0 }, { x: 160, y: -100 }, { x: 320, y: 0 }]; }, "Đã gán motion path.");
      if (target.hasAttribute("data-vc-capture-morph")) return commit((draft) => { const layer = draft.layers.find((item) => item.id === primaryLayer()?.id); if (layer?.geometry.points.length) layer.morphModel.push(clone(layer.geometry.points)); }, "Đã chụp trạng thái morph.");
    });

    on(root, "input", (event) => {
      const target = event.target;
      if (target.hasAttribute("data-vc-project-name")) { project.meta.name = safeText(target.value, project.meta.name, 120); persist(); return; }
      const layer = primaryLayer();
      if (!layer) return;
      if (target.dataset.vcTransform) { layer.transform[target.dataset.vcTransform] = Number(target.value); project = normalizeProject(project); persist(); renderCanvas(); return; }
      if (target.dataset.vcStyle) { layer.style[target.dataset.vcStyle] = target.dataset.vcStyle === "strokeWidth" || target.dataset.vcStyle === "fontSize" ? Number(target.value) : target.value; project = normalizeProject(project); persist(); renderCanvas(); return; }
      if (target.dataset.vcGeometry) { layer.geometry[target.dataset.vcGeometry] = safeText(target.value, "", 1000); persist(); renderCanvas(); return; }
      if (target.dataset.vcTrim) { layer.trim[target.dataset.vcTrim] = target.type === "checkbox" ? target.checked : Number(target.value); project = normalizeProject(project); persist(); renderCanvas(); return; }
      if (target.dataset.vcExpression) { layer.expressions[target.dataset.vcExpression] = safeText(target.value, "", 240); project = normalizeProject(project); persist(); renderCanvas(); return; }
      if (target.dataset.vcEasing != null) {
        const key = layer.keyframes.slice().sort((a, b) => Math.abs(a.time - currentTime) - Math.abs(b.time - currentTime))[0];
        if (key) { key.easing[Number(target.dataset.vcEasing)] = Number(target.value); project = normalizeProject(project); persist(); renderInspector(); }
      }
    });

    on(root, "change", (event) => {
      const target = event.target;
      if (target.hasAttribute("data-vc-snap")) return commit((draft) => { draft.settings.snap = target.checked; });
      if (target.hasAttribute("data-vc-smart-guides")) return commit((draft) => { draft.settings.smartGuides = target.checked; });
      if (target.hasAttribute("data-vc-grid")) return commit((draft) => { draft.settings.showGrid = target.checked; });
      if (target.dataset.vcWork) return commit((draft) => { draft.timeline.workArea[target.dataset.vcWork] = Number(target.value); });
      const layer = primaryLayer();
      if (!layer) return;
      if (target.dataset.vcProp) {
        commit((draft) => {
          const current = draft.layers.find((item) => item.id === layer.id);
          if (!current) return;
          current[target.dataset.vcProp] = target.type === "checkbox" ? target.checked : target.value || (target.dataset.vcProp === "parentId" || target.dataset.vcProp === "maskId" ? null : "");
        });
      }
    });

    on(root.querySelector("[data-vc-file]"), "change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const value = JSON.parse(String(reader.result || ""));
          if (value.format && value.format !== FORMAT) throw new Error("Sai định dạng project");
          snapshot(); project = normalizeProject(value); selectedIds = [project.layers[0].id]; persist(); render(); announce("Đã nhập project Vector Motion.");
        } catch (_) { announce("Tệp không phải project Vector Motion hợp lệ."); }
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    on(root.querySelector("[data-vc-artboard]"), "pointerdown", beginCanvasInteraction);
    on(root, "pointermove", moveCanvasInteraction);
    on(root, "pointerup", endCanvasInteraction);
    on(root, "pointercancel", endCanvasInteraction);
    on(root.querySelector("[data-vc-ruler]"), "pointerdown", (event) => {
      const box = event.currentTarget.getBoundingClientRect();
      currentTime = clamp((event.clientX - box.left) / box.width * project.timeline.duration, 0, project.timeline.duration);
      renderCanvas();
    });
    on(root, "keydown", (event) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(event.target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") { event.preventDefault(); return event.shiftKey ? ungroupSelection() : groupSelection(); }
      if (event.code === "Space" && !typing) { event.preventDefault(); return playPause(); }
      if (!typing) {
        const match = TOOLS.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
        if (match) setTool(match.id);
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          commit((draft) => { draft.layers = draft.layers.filter((layer) => !selectedIds.includes(layer.id)); selectedIds = []; }, "Đã xóa layer đã chọn.");
        }
      }
    });

    render();
    storage.load().then((saved) => {
      if (!saved || mounted.get(root)?.destroyed) return;
      project = normalizeProject(saved);
      selectedIds = [project.layers[0].id];
      render();
      announce("Đã khôi phục phiên làm việc gần nhất.");
    });

    const api = {
      getProject: () => clone(project),
      setProject: (next) => { snapshot(); project = normalizeProject(next); selectedIds = [project.layers[0].id]; persist(); render(); },
      setTool,
      selectLayer: (id) => selectLayer(id, false),
      setTime: (time) => { currentTime = clamp(time, 0, project.timeline.duration); renderCanvas(); },
      play: () => { if (!playing) playPause(); },
      pause: () => { if (playing) playPause(); },
      undo,
      redo,
      exportProject: () => exportProject(project),
      exportAnimatedSvg: () => renderAnimatedSvg(project),
      exportLottie: () => exportLottie(project),
      exportGif: (options, onProgress) => exportGif(project, options, onProgress),
      getExportCapabilities: () => getExportCapabilities(globalScope)
    };
    mounted.set(root, {
      api,
      listeners,
      destroyed: false,
      cleanup() {
        this.destroyed = true;
        playing = false;
        globalScope.cancelAnimationFrame?.(raf);
        globalScope.clearTimeout(saveTimer);
        globalScope.clearTimeout(statusTimer);
        listeners.splice(0).forEach((off) => off());
      }
    });
    return api;
  }

  function unmount(root) {
    const state = mounted.get(root);
    if (!state) return false;
    state.cleanup();
    mounted.delete(root);
    root.classList.remove("hhvc");
    root.removeAttribute("data-graphic-vector-core");
    root.removeAttribute("aria-label");
    root.innerHTML = "";
    return true;
  }

  const api = {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    DATABASE_NAME,
    STORE_NAME,
    TOOLS,
    LAYER_TYPES,
    BLEND_MODES,
    MATTE_MODES,
    ALIGN_ACTIONS,
    EXPRESSION_PROPERTIES,
    createLayer,
    createDefaultProject,
    normalizeProject,
    normalizeLayer,
    cubicBezierValue,
    evaluateExpression,
    evaluateLayer,
    interpolateMorphPoints,
    resamplePathPoints,
    motionPathSample,
    motionPathPoint,
    pathData,
    regularPolygonPoints,
    layerBounds,
    alignLayers,
    renderSvg,
    renderAnimatedSvg,
    exportProject,
    exportLottie,
    exportPngSequence,
    exportWebM,
    exportGif,
    getExportCapabilities,
    createStorageDriver,
    mount,
    unmount
  };

  globalScope.HHGraphicVectorCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
