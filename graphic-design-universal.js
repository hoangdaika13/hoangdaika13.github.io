(() => {
  "use strict";

  const VERSION = 2;
  const FORMAT = "hh-design-document";
  const STORAGE_KEY = "hh.graphic-design.universal.v2";
  const LEGACY_STORAGE_KEY = "hh.graphic-design.universal.v1";
  const ASSET_DB_NAME = "hh-graphic-design-assets-v2";
  const ASSET_STORE_NAME = "blobs";
  const MAX_COMMANDS = 160;
  const MAX_JOBS = 50;
  const MAX_COMMENTS = 80;
  const MAX_ASSETS = 500;
  const MAX_LAYERS = 4000;
  const GALAXY_PREF_KEY = "hh.home.galaxy.preferences.v2";
  const instances = new WeakMap();
  const GALAXY_THEMES = Object.freeze({
    neon: ["#59efff", "#ff55ce"],
    purple: ["#aa7dff", "#ff68d7"],
    solar: ["#ffba55", "#ff547d"],
    deep: ["#4a78ff", "#7de7ff"],
    aurora: ["#58f3ff", "#69ffb7"],
    magenta: ["#ff4ecf", "#a971ff"],
    emerald: ["#58f5a8", "#bcff65"],
    quantum: ["#54a4ff", "#58f4ff"],
    golden: ["#ffd75e", "#ff874a"],
    crimson: ["#ff654d", "#ff4c9f"],
    ice: ["#d8fbff", "#78b7ff"],
    blackhole: ["#8c78ff", "#303c75"],
    time: ["#5eefff", "#ffb653"]
  });

  const clone = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const now = () => new Date().toISOString();
  const text = (value, fallback = "") => String(value == null ? fallback : value).slice(0, 2000);
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, number(value, fallback)));
  const escapeHTML = (value) => text(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const jsonEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ENTITY_COLLECTIONS = Object.freeze([
    "pages", "frames", "layers", "assets", "components", "versions",
    "branches", "comments", "approvals", "jobs"
  ]);
  const TRACKED_FIELDS = Object.freeze([
    "name", "branch", "status", "canvas", "variables", "brand", "prototype",
    "timeline", "settings", "selectedLayerId", "selectedLayerIds",
    "activePageId", "activeFrameId"
  ]);

  function galaxyProfile() {
    let preferences = {};
    try { preferences = JSON.parse(globalThis.localStorage?.getItem(GALAXY_PREF_KEY) || "{}") || {}; } catch { preferences = {}; }
    const colors = GALAXY_THEMES[preferences.theme] || GALAXY_THEMES.neon;
    const reduced = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    return {
      primary: colors[0],
      secondary: colors[1],
      motion: reduced ? "off" : text(preferences.motion || "balanced", "balanced")
    };
  }

  const DEFAULT_BRAND = {
    name: "HH Neon Design System",
    tokens: {
      "color.brand.primary": "#ff5fc8",
      "color.brand.secondary": "#63e8ff",
      "color.brand.accent": "#c9f26f",
      "color.surface.canvas": "#07101d",
      "color.text.primary": "#f4f8ff",
      "space.1": 4,
      "space.2": 8,
      "space.3": 12,
      "radius.md": 12
    },
    fonts: { heading: "Inter", body: "Inter" },
    themes: ["Neon Nebula", "Purple Galaxy", "Solar Fire", "Deep Space"],
    activeTheme: "Neon Nebula"
  };

  const PLANETS = Object.freeze([
    { id: "design", label: "Design Command", tone: "#63e8ff", description: "Canvas, frame, grid và prototype" },
    { id: "vector", label: "Vector Forge", tone: "#b98cff", description: "Bezier, boolean, path và SVG" },
    { id: "raster", label: "Raster Lab", tone: "#ff6fc8", description: "Layer, mask, brush và chỉnh ảnh" },
    { id: "type", label: "Typography", tone: "#ffd36b", description: "Font, OpenType và text path" },
    { id: "brand", label: "Brand System", tone: "#c9f26f", description: "Token, theme và component library" },
    { id: "motion", label: "Motion Studio", tone: "#ff9b6b", description: "Timeline, keyframe và export motion" },
    { id: "3d", label: "3D Nebula", tone: "#8ca7ff", description: "GLB, camera, light và material" },
    { id: "assets", label: "Asset Observatory", tone: "#73e9d0", description: "Tài sản, quyền và phiên bản" },
    { id: "ai", label: "Design AI Copilot", tone: "#f05bd0", description: "Concept, layout và QA có kiểm soát" },
    { id: "qa", label: "Design Health", tone: "#ff8f57", description: "Contrast, responsive và preflight" },
    { id: "export", label: "Export Center", tone: "#7ddcff", description: "Batch export và Dev Handoff" }
  ]);

  function defaultDocument(input = {}) {
    const documentId = text(input.id || uid("design"), uid("design"));
    const frameId = text(input.frameId || uid("frame"), uid("frame"));
    const pageId = text(input.pageId || uid("page"), uid("page"));
    const titleId = uid("layer");
    return {
      schemaVersion: VERSION,
      format: FORMAT,
      id: documentId,
      name: text(input.name || "HH Design Document", "HH Design Document"),
      branch: "main",
      status: "draft",
      canvas: {
        width: 1440,
        height: 900,
        background: "#07101d",
        grid: 8,
        zoom: 1,
        panX: 0,
        panY: 0,
        gridVisible: true,
        rulersVisible: true,
        smartGuides: true,
        snap: true,
        guides: [],
        quality: "auto"
      },
      pages: [{ id: pageId, name: "Main page", frameIds: [frameId] }],
      frames: [{
        id: frameId,
        pageId,
        name: "Hero frame",
        x: 0,
        y: 0,
        width: 1440,
        height: 900,
        background: "#07101d",
        breakpoint: "desktop"
      }],
      layers: [normalizeLayer({
        id: titleId,
        frameId,
        name: "Bắt đầu thiết kế",
        type: "text",
        x: 96,
        y: 160,
        width: 700,
        height: 100,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: "Bắt đầu thiết kế",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: "#f4f8ff",
        stroke: "none",
        strokeWidth: 0,
        blendMode: "normal",
        altText: ""
      }, frameId)],
      assets: [],
      components: [],
      variables: {
        activeMode: "default",
        collections: [{
          id: "global",
          name: "Global",
          modes: ["default", "dark", "mobile", "desktop"],
          values: {
            "color.brand.primary": { type: "color", default: "#ff5fc8", dark: "#ff78d2" },
            "color.brand.secondary": { type: "color", default: "#63e8ff", dark: "#73f2ff" },
            "space.2": { type: "number", default: 8, mobile: 8, desktop: 12 }
          }
        }]
      },
      prototype: { startFrameId: frameId, actions: [], variables: {} },
      timeline: { duration: 5, fps: 30, currentTime: 0, playing: false, loop: false, keyframes: [] },
      settings: {
        autoLayoutPreview: true,
        highContrastCanvas: false,
        reduceCanvasMotion: false,
        presentationBackground: "#02050c"
      },
      brand: clone(DEFAULT_BRAND),
      commandLog: [],
      history: { past: [], future: [] },
      versions: [],
      branches: [{ id: "main", name: "main", parent: null, createdAt: now() }],
      comments: [],
      approvals: [],
      jobs: [],
      selectedLayerId: titleId,
      selectedLayerIds: [titleId],
      activePageId: pageId,
      activeFrameId: frameId,
      updatedAt: now(),
      ...clone(input)
    };
  }

  function normalizeLayer(layer, frameId) {
    const source = layer && typeof layer === "object" ? layer : {};
    const allowedTypes = new Set([
      "rect", "ellipse", "text", "image", "video", "audio", "group", "path",
      "polygon", "star", "adjustment", "component", "instance", "3d"
    ]);
    const normalizePoint = (pointValue) => ({
      x: number(pointValue?.x),
      y: number(pointValue?.y),
      inX: number(pointValue?.inX),
      inY: number(pointValue?.inY),
      outX: number(pointValue?.outX),
      outY: number(pointValue?.outY),
      smooth: pointValue?.smooth === true
    });
    const gradient = source.gradient && typeof source.gradient === "object"
      ? {
          type: ["linear", "radial", "conic", "mesh"].includes(source.gradient.type) ? source.gradient.type : "linear",
          angle: clamp(source.gradient.angle, -360, 360, 0),
          stops: (Array.isArray(source.gradient.stops) ? source.gradient.stops : []).slice(0, 16).map((stop, index) => ({
            id: text(stop.id || `stop-${index}`, `stop-${index}`),
            offset: clamp(stop.offset, 0, 1, index ? 1 : 0),
            color: safeColor(stop.color, index ? "#ff5fc8" : "#63e8ff"),
            opacity: clamp(stop.opacity, 0, 1, 1)
          }))
        }
      : null;
    const autoLayout = source.autoLayout && typeof source.autoLayout === "object"
      ? {
          enabled: source.autoLayout.enabled === true,
          direction: source.autoLayout.direction === "horizontal" ? "horizontal" : "vertical",
          wrap: source.autoLayout.wrap === true,
          gap: clamp(source.autoLayout.gap, 0, 400, 12),
          paddingTop: clamp(source.autoLayout.paddingTop, 0, 1000, 16),
          paddingRight: clamp(source.autoLayout.paddingRight, 0, 1000, 16),
          paddingBottom: clamp(source.autoLayout.paddingBottom, 0, 1000, 16),
          paddingLeft: clamp(source.autoLayout.paddingLeft, 0, 1000, 16),
          align: ["start", "center", "end", "space-between"].includes(source.autoLayout.align) ? source.autoLayout.align : "start"
        }
      : { enabled: false, direction: "vertical", wrap: false, gap: 12, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, align: "start" };
    return {
      id: text(source.id || uid("layer"), uid("layer")),
      frameId: text(source.frameId || frameId, frameId),
      parentId: source.parentId ? text(source.parentId) : null,
      name: text(source.name || "Layer", "Layer"),
      type: allowedTypes.has(source.type) ? source.type : "rect",
      x: number(source.x),
      y: number(source.y),
      width: Math.max(1, number(source.width, 200)),
      height: Math.max(1, number(source.height, 120)),
      rotation: clamp(source.rotation, -360, 360, 0),
      skewX: clamp(source.skewX, -89, 89, 0),
      skewY: clamp(source.skewY, -89, 89, 0),
      anchorX: clamp(source.anchorX, 0, 1, 0.5),
      anchorY: clamp(source.anchorY, 0, 1, 0.5),
      opacity: clamp(source.opacity, 0, 1, 1),
      visible: source.visible !== false,
      locked: source.locked === true,
      alphaLock: source.alphaLock === true,
      text: text(source.text),
      fontFamily: text(source.fontFamily || "Inter", "Inter"),
      fontSize: clamp(source.fontSize, 6, 320, 16),
      fontWeight: clamp(source.fontWeight, 100, 900, 400),
      lineHeight: clamp(source.lineHeight, 0.5, 4, 1.2),
      letterSpacing: clamp(source.letterSpacing, -40, 200, 0),
      fill: safeColor(source.fill, "#63e8ff"),
      stroke: source.stroke === "none" ? "none" : safeColor(source.stroke, "#63e8ff"),
      strokeWidth: clamp(source.strokeWidth, 0, 80, 0),
      strokeDash: (Array.isArray(source.strokeDash) ? source.strokeDash : []).slice(0, 12).map((item) => clamp(item, 0, 1000, 0)),
      strokeCap: ["butt", "round", "square"].includes(source.strokeCap) ? source.strokeCap : "round",
      strokeJoin: ["miter", "round", "bevel"].includes(source.strokeJoin) ? source.strokeJoin : "round",
      arrowStart: source.arrowStart === true,
      arrowEnd: source.arrowEnd === true,
      cornerRadius: clamp(source.cornerRadius, 0, 10000, 14),
      blendMode: text(source.blendMode || "normal", "normal"),
      assetId: source.assetId ? text(source.assetId) : null,
      altText: text(source.altText),
      pathData: text(source.pathData),
      pathPoints: (Array.isArray(source.pathPoints) ? source.pathPoints : []).slice(0, 1000).map(normalizePoint),
      pathClosed: source.pathClosed === true,
      textPathLayerId: source.textPathLayerId ? text(source.textPathLayerId) : null,
      gradient,
      masks: (Array.isArray(source.masks) ? source.masks : []).slice(0, 20).map((mask) => ({
        id: text(mask.id || uid("mask"), uid("mask")),
        type: ["rect", "ellipse", "path", "alpha"].includes(mask.type) ? mask.type : "rect",
        enabled: mask.enabled !== false,
        inverted: mask.inverted === true,
        feather: clamp(mask.feather, 0, 200, 0),
        opacity: clamp(mask.opacity, 0, 1, 1),
        x: number(mask.x),
        y: number(mask.y),
        width: Math.max(1, number(mask.width, source.width || 200)),
        height: Math.max(1, number(mask.height, source.height || 120)),
        pathData: text(mask.pathData)
      })),
      adjustments: (Array.isArray(source.adjustments) ? source.adjustments : []).slice(0, 30).map((adjustment) => ({
        id: text(adjustment.id || uid("adjustment"), uid("adjustment")),
        type: ["brightness", "contrast", "saturation", "hue", "exposure", "blur", "grayscale", "sepia"].includes(adjustment.type) ? adjustment.type : "brightness",
        value: clamp(adjustment.value, -200, 200, 0),
        enabled: adjustment.enabled !== false
      })),
      autoLayout,
      layoutSizing: {
        width: ["fixed", "hug", "fill"].includes(source.layoutSizing?.width) ? source.layoutSizing.width : "fixed",
        height: ["fixed", "hug", "fill"].includes(source.layoutSizing?.height) ? source.layoutSizing.height : "fixed"
      },
      constraints: {
        horizontal: ["left", "right", "center", "stretch", "scale"].includes(source.constraints?.horizontal) ? source.constraints.horizontal : "left",
        vertical: ["top", "bottom", "center", "stretch", "scale"].includes(source.constraints?.vertical) ? source.constraints.vertical : "top"
      },
      componentId: source.componentId ? text(source.componentId) : null,
      instanceOf: source.instanceOf ? text(source.instanceOf) : null,
      overrides: source.overrides && typeof source.overrides === "object" ? clone(source.overrides) : {},
      variableBindings: source.variableBindings && typeof source.variableBindings === "object" ? clone(source.variableBindings) : {},
      prototypeActions: (Array.isArray(source.prototypeActions) ? source.prototypeActions : []).slice(0, 30).map((action) => ({
        id: text(action.id || uid("interaction"), uid("interaction")),
        trigger: ["click", "hover", "drag", "scroll", "keyboard"].includes(action.trigger) ? action.trigger : "click",
        action: ["navigate", "overlay", "back", "open-url", "set-variable"].includes(action.action) ? action.action : "navigate",
        targetFrameId: action.targetFrameId ? text(action.targetFrameId) : null,
        url: text(action.url),
        key: text(action.key),
        value: typeof action.value === "boolean" || typeof action.value === "number" ? action.value : text(action.value)
      })),
      metadata: source.metadata && typeof source.metadata === "object" ? clone(source.metadata) : {}
    };
  }

  function normalizeDocument(input) {
    const source = input && typeof input === "object" ? input : {};
    const base = defaultDocument({
      id: source.id,
      name: source.name,
      frameId: source.frames?.[0]?.id,
      pageId: source.pages?.[0]?.id
    });
    const merged = { ...base, ...clone(source) };
    merged.format = FORMAT;
    merged.schemaVersion = VERSION;
    merged.canvas = {
      ...base.canvas,
      ...(source.canvas || {}),
      width: clamp(source.canvas?.width, 1, 100000, base.canvas.width),
      height: clamp(source.canvas?.height, 1, 100000, base.canvas.height),
      background: safeColor(source.canvas?.background, base.canvas.background),
      grid: clamp(source.canvas?.grid, 1, 128, base.canvas.grid),
      zoom: clamp(source.canvas?.zoom, 0.05, 16, 1),
      panX: number(source.canvas?.panX),
      panY: number(source.canvas?.panY),
      gridVisible: source.canvas?.gridVisible !== false,
      rulersVisible: source.canvas?.rulersVisible !== false,
      smartGuides: source.canvas?.smartGuides !== false,
      snap: source.canvas?.snap !== false,
      quality: ["auto", "high", "balanced", "low"].includes(source.canvas?.quality) ? source.canvas.quality : "auto",
      guides: (Array.isArray(source.canvas?.guides) ? source.canvas.guides : []).slice(0, 200).map((guide) => ({
        id: text(guide.id || uid("guide"), uid("guide")),
        axis: guide.axis === "x" ? "x" : "y",
        position: number(guide.position),
        locked: guide.locked === true
      }))
    };
    merged.pages = (Array.isArray(source.pages) ? source.pages : base.pages).slice(0, 100).map((page) => ({
      id: text(page.id || uid("page"), uid("page")),
      name: text(page.name || "Page", "Page"),
      frameIds: Array.isArray(page.frameIds) ? [...new Set(page.frameIds.map(String))].slice(0, 100) : []
    }));
    merged.frames = (Array.isArray(source.frames) ? source.frames : base.frames).slice(0, 200).map((frame) => ({
      id: text(frame.id || uid("frame"), uid("frame")),
      pageId: text(frame.pageId || merged.pages[0]?.id, merged.pages[0]?.id || ""),
      name: text(frame.name || "Frame", "Frame"),
      x: number(frame.x),
      y: number(frame.y),
      width: clamp(frame.width, 1, 100000, 1440),
      height: clamp(frame.height, 1, 100000, 900),
      background: safeColor(frame.background, merged.canvas.background),
      breakpoint: text(frame.breakpoint || "desktop", "desktop")
    }));
    merged.layers = (Array.isArray(source.layers) ? source.layers : base.layers).slice(0, MAX_LAYERS).map((layer) => normalizeLayer(layer, merged.frames[0]?.id || ""));
    const layerIds = new Set(merged.layers.map((layer) => layer.id));
    merged.layers.forEach((layer) => {
      if (layer.parentId && (!layerIds.has(layer.parentId) || layer.parentId === layer.id)) layer.parentId = null;
      if (layer.textPathLayerId && !layerIds.has(layer.textPathLayerId)) layer.textPathLayerId = null;
    });
    merged.assets = (Array.isArray(source.assets) ? source.assets : []).slice(0, MAX_ASSETS).map((asset) => ({
      id: text(asset.id || uid("asset"), uid("asset")),
      name: text(asset.name || "Asset", "Asset"),
      kind: text(asset.kind || "other", "other"),
      type: text(asset.type || "application/octet-stream"),
      size: Math.max(0, number(asset.size)),
      checksum: text(asset.checksum),
      source: text(asset.source || "local", "local"),
      sourceUrl: text(asset.sourceUrl),
      author: text(asset.author),
      license: text(asset.license || "unknown", "unknown"),
      licenseExpiresAt: text(asset.licenseExpiresAt),
      status: ["ready", "missing", "offline", "processing"].includes(asset.status) ? asset.status : "ready",
      width: number(asset.width),
      height: number(asset.height),
      altText: text(asset.altText),
      tags: (Array.isArray(asset.tags) ? asset.tags : []).slice(0, 30).map((item) => text(item, "")).filter(Boolean),
      dominantColor: safeColor(asset.dominantColor, "#253b52"),
      thumbnail: /^data:image\/(png|jpeg|webp);base64,/i.test(String(asset.thumbnail || "")) ? String(asset.thumbnail).slice(0, 180000) : "",
      version: Math.max(1, Math.floor(number(asset.version, 1))),
      versions: (Array.isArray(asset.versions) ? asset.versions : []).slice(-20).map((version) => ({
        id: text(version.id || uid("asset-version"), uid("asset-version")),
        checksum: text(version.checksum),
        size: Math.max(0, number(version.size)),
        createdAt: text(version.createdAt || now(), now())
      })),
      createdAt: text(asset.createdAt || now(), now())
    }));
    merged.components = Array.isArray(source.components) ? source.components.slice(0, 500).map((component) => ({
      id: text(component.id || uid("component"), uid("component")),
      name: text(component.name || "Component", "Component"),
      masterLayerId: text(component.masterLayerId),
      description: text(component.description),
      properties: component.properties && typeof component.properties === "object" ? clone(component.properties) : {},
      variants: Array.isArray(component.variants) ? component.variants.slice(0, 50).map((variant) => ({ id: text(variant.id || uid("variant"), uid("variant")), name: text(variant.name || "Default", "Default"), properties: variant.properties && typeof variant.properties === "object" ? clone(variant.properties) : {} })) : []
    })) : [];
    merged.variables = source.variables && typeof source.variables === "object" ? clone(source.variables) : clone(base.variables);
    merged.variables.activeMode = text(merged.variables.activeMode || "default", "default");
    merged.variables.collections = (Array.isArray(merged.variables.collections) ? merged.variables.collections : base.variables.collections).slice(0, 30).map((collection) => ({
      id: text(collection.id || uid("variables"), uid("variables")),
      name: text(collection.name || "Collection", "Collection"),
      modes: [...new Set((Array.isArray(collection.modes) ? collection.modes : ["default"]).map((mode) => text(mode)).filter(Boolean))].slice(0, 20),
      values: collection.values && typeof collection.values === "object"
        ? Object.fromEntries(Object.entries(collection.values).slice(0, 500).map(([key, variable]) => [
            text(key),
            {
              type: ["color", "number", "string", "boolean"].includes(variable?.type) ? variable.type : "string",
              ...Object.fromEntries(Object.entries(variable || {}).filter(([mode]) => mode !== "type").slice(0, 20).map(([mode, value]) => [text(mode), typeof value === "boolean" || typeof value === "number" ? value : text(value)]))
            }
          ]))
        : {}
    }));
    merged.prototype = {
      ...clone(base.prototype),
      ...(source.prototype || {}),
      startFrameId: text(source.prototype?.startFrameId || merged.frames[0]?.id),
      actions: (Array.isArray(source.prototype?.actions) ? source.prototype.actions : []).slice(0, 500).map((action) => ({
        id: text(action.id || uid("interaction"), uid("interaction")),
        layerId: text(action.layerId),
        trigger: text(action.trigger || "click", "click"),
        action: text(action.action || "navigate", "navigate"),
        targetFrameId: action.targetFrameId ? text(action.targetFrameId) : null,
        value: typeof action.value === "boolean" || typeof action.value === "number" ? action.value : text(action.value)
      })),
      variables: source.prototype?.variables && typeof source.prototype.variables === "object" ? clone(source.prototype.variables) : {}
    };
    merged.timeline = {
      ...clone(base.timeline),
      ...(source.timeline || {}),
      duration: clamp(source.timeline?.duration, 0.1, 3600, 5),
      fps: clamp(source.timeline?.fps, 1, 120, 30),
      currentTime: clamp(source.timeline?.currentTime, 0, Math.max(0.1, number(source.timeline?.duration, 5)), 0),
      playing: source.timeline?.playing === true,
      loop: source.timeline?.loop === true,
      keyframes: (Array.isArray(source.timeline?.keyframes) ? source.timeline.keyframes : []).slice(0, 5000).map((keyframe) => ({
        id: text(keyframe.id || uid("keyframe"), uid("keyframe")),
        layerId: text(keyframe.layerId),
        property: ["x", "y", "width", "height", "rotation", "opacity", "fill"].includes(keyframe.property) ? keyframe.property : "opacity",
        time: clamp(keyframe.time, 0, Math.max(0.1, number(source.timeline?.duration, 5)), 0),
        value: keyframe.property === "fill" ? safeColor(keyframe.value, "#63e8ff") : number(keyframe.value),
        easing: text(keyframe.easing || "ease", "ease")
      }))
    };
    merged.settings = { ...clone(base.settings), ...(source.settings || {}) };
    merged.brand = { ...clone(DEFAULT_BRAND), ...(source.brand || {}), tokens: { ...clone(DEFAULT_BRAND.tokens), ...(source.brand?.tokens || {}) }, fonts: { ...clone(DEFAULT_BRAND.fonts), ...(source.brand?.fonts || {}) } };
    merged.commandLog = Array.isArray(source.commandLog) ? source.commandLog.slice(-MAX_COMMANDS) : [];
    merged.history = {
      past: Array.isArray(source.history?.past) ? source.history.past.slice(-MAX_COMMANDS).map(String) : [],
      future: Array.isArray(source.history?.future) ? source.history.future.slice(0, MAX_COMMANDS).map(String) : []
    };
    merged.versions = Array.isArray(source.versions) ? source.versions.slice(-40) : [];
    merged.branches = Array.isArray(source.branches) && source.branches.length ? source.branches.slice(-40) : clone(base.branches);
    merged.comments = Array.isArray(source.comments) ? source.comments.slice(-MAX_COMMENTS) : [];
    merged.approvals = Array.isArray(source.approvals) ? source.approvals.slice(-100) : [];
    merged.jobs = Array.isArray(source.jobs) ? source.jobs.slice(-MAX_JOBS) : [];
    merged.selectedLayerIds = [...new Set((Array.isArray(source.selectedLayerIds) ? source.selectedLayerIds : [source.selectedLayerId]).map((id) => text(id)).filter((id) => layerIds.has(id)))].slice(0, 500);
    if (!merged.selectedLayerIds.length && merged.layers[0]?.id) merged.selectedLayerIds = [merged.layers[0].id];
    merged.selectedLayerId = text(source.selectedLayerId || merged.selectedLayerIds[0] || merged.layers[0]?.id);
    if (merged.selectedLayerId && !merged.selectedLayerIds.includes(merged.selectedLayerId)) merged.selectedLayerIds.push(merged.selectedLayerId);
    merged.activePageId = text(source.activePageId || merged.pages[0]?.id);
    merged.activeFrameId = text(source.activeFrameId || merged.frames[0]?.id);
    merged.updatedAt = text(source.updatedAt || now(), now());
    return merged;
  }

  function serializableDocument(document) {
    const value = clone(normalizeDocument(document));
    value.canvas.panX = 0;
    value.canvas.panY = 0;
    value.timeline.playing = false;
    value.commandLog = value.commandLog.slice(-MAX_COMMANDS).map((command) => ({
      id: text(command.id),
      type: text(command.type),
      payload: clone(command.payload || {}),
      changes: Array.isArray(command.changes) ? clone(command.changes) : [],
      before: { commandLog: [] },
      after: { commandLog: [] },
      createdAt: text(command.createdAt || now(), now()),
      branch: text(command.branch || value.branch, value.branch)
    }));
    return value;
  }

  function snapshotDocument(document) {
    const value = serializableDocument(document);
    value.commandLog = [];
    value.history = { past: [], future: [] };
    return value;
  }

  function documentChanges(before, after) {
    const changes = [];
    for (const field of TRACKED_FIELDS) {
      if (!jsonEqual(before[field], after[field])) {
        changes.push({ kind: "field", field, before: clone(before[field]), after: clone(after[field]) });
      }
    }
    for (const collection of ENTITY_COLLECTIONS) {
      const beforeItems = Array.isArray(before[collection]) ? before[collection] : [];
      const afterItems = Array.isArray(after[collection]) ? after[collection] : [];
      const beforeMap = new Map(beforeItems.map((item, index) => [item.id, { item, index }]));
      const afterMap = new Map(afterItems.map((item, index) => [item.id, { item, index }]));
      const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
      for (const id of ids) {
        const previous = beforeMap.get(id);
        const next = afterMap.get(id);
        if (!previous || !next || previous.index !== next.index || !jsonEqual(previous.item, next.item)) {
          changes.push({
            kind: "entity",
            collection,
            id,
            before: previous ? clone(previous.item) : null,
            after: next ? clone(next.item) : null,
            indexBefore: previous?.index ?? -1,
            indexAfter: next?.index ?? -1
          });
        }
      }
    }
    return changes;
  }

  function applyChanges(document, changes, direction) {
    const next = normalizeDocument(document);
    const useAfter = direction === "redo";
    for (const change of Array.isArray(changes) ? changes : []) {
      if (change.kind === "field" && TRACKED_FIELDS.includes(change.field)) {
        next[change.field] = clone(useAfter ? change.after : change.before);
        continue;
      }
      if (change.kind !== "entity" || !ENTITY_COLLECTIONS.includes(change.collection)) continue;
      const target = useAfter ? change.after : change.before;
      const targetIndex = useAfter ? change.indexAfter : change.indexBefore;
      const collection = next[change.collection];
      const existingIndex = collection.findIndex((item) => item.id === change.id);
      if (existingIndex >= 0) collection.splice(existingIndex, 1);
      if (target) collection.splice(Math.max(0, Math.min(collection.length, targetIndex)), 0, clone(target));
    }
    next.updatedAt = now();
    return normalizeDocument(next);
  }

  function selectionIds(document, payload = {}) {
    const requested = Array.isArray(payload.ids)
      ? payload.ids
      : [payload.id || document.selectedLayerId];
    const valid = new Set(document.layers.map((layer) => layer.id));
    return [...new Set(requested.map((id) => text(id)).filter((id) => valid.has(id)))];
  }

  function selectedLayers(document, payload = {}) {
    const ids = selectionIds(document, payload);
    return document.layers.filter((layer) => ids.includes(layer.id));
  }

  function pathFromPoints(points, closed = false) {
    const normalized = (Array.isArray(points) ? points : []).map((point) => ({
      x: number(point.x),
      y: number(point.y),
      inX: number(point.inX),
      inY: number(point.inY),
      outX: number(point.outX),
      outY: number(point.outY)
    }));
    if (!normalized.length) return "";
    let d = `M ${normalized[0].x} ${normalized[0].y}`;
    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];
      const hasCurve = previous.outX || previous.outY || current.inX || current.inY;
      d += hasCurve
        ? ` C ${previous.x + previous.outX} ${previous.y + previous.outY} ${current.x + current.inX} ${current.y + current.inY} ${current.x} ${current.y}`
        : ` L ${current.x} ${current.y}`;
    }
    if (closed) d += " Z";
    return d;
  }

  function snapValue(document, value) {
    if (!document.canvas.snap) return number(value);
    const size = Math.max(1, number(document.canvas.grid, 8));
    return Math.round(number(value) / size) * size;
  }

  function layoutChildren(document, parent) {
    if (!parent?.autoLayout?.enabled) return;
    const children = document.layers.filter((layer) => layer.parentId === parent.id && layer.visible);
    let cursorX = parent.x + parent.autoLayout.paddingLeft;
    let cursorY = parent.y + parent.autoLayout.paddingTop;
    const availableWidth = Math.max(1, parent.width - parent.autoLayout.paddingLeft - parent.autoLayout.paddingRight);
    const availableHeight = Math.max(1, parent.height - parent.autoLayout.paddingTop - parent.autoLayout.paddingBottom);
    for (const child of children) {
      if (parent.autoLayout.direction === "horizontal") {
        if (parent.autoLayout.wrap && cursorX + child.width > parent.x + parent.width - parent.autoLayout.paddingRight) {
          cursorX = parent.x + parent.autoLayout.paddingLeft;
          cursorY += child.height + parent.autoLayout.gap;
        }
        child.x = cursorX;
        child.y = parent.autoLayout.align === "center"
          ? parent.y + (parent.height - child.height) / 2
          : parent.autoLayout.align === "end" ? parent.y + parent.height - parent.autoLayout.paddingBottom - child.height : cursorY;
        if (child.layoutSizing.width === "fill") child.width = availableWidth;
        cursorX += child.width + parent.autoLayout.gap;
      } else {
        if (parent.autoLayout.wrap && cursorY + child.height > parent.y + parent.height - parent.autoLayout.paddingBottom) {
          cursorY = parent.y + parent.autoLayout.paddingTop;
          cursorX += child.width + parent.autoLayout.gap;
        }
        child.y = cursorY;
        child.x = parent.autoLayout.align === "center"
          ? parent.x + (parent.width - child.width) / 2
          : parent.autoLayout.align === "end" ? parent.x + parent.width - parent.autoLayout.paddingRight - child.width : cursorX;
        if (child.layoutSizing.width === "fill") child.width = availableWidth;
        cursorY += child.height + parent.autoLayout.gap;
      }
    }
    if (parent.layoutSizing.width === "hug" && children.length) {
      parent.width = Math.max(...children.map((layer) => layer.x + layer.width)) - parent.x + parent.autoLayout.paddingRight;
    }
    if (parent.layoutSizing.height === "hug" && children.length) {
      parent.height = Math.max(...children.map((layer) => layer.y + layer.height)) - parent.y + parent.autoLayout.paddingBottom;
    }
  }

  function operation(document, type, payload = {}) {
    const next = normalizeDocument(document);
    const before = normalizeDocument(next);
    const frameId = text(payload.frameId || next.activeFrameId || next.frames[0]?.id);
    if (type === "add-frame") {
      const id = uid("frame");
      next.frames.push({ id, pageId: text(payload.pageId || next.activePageId, next.pages[0]?.id || ""), name: text(payload.name || `Frame ${next.frames.length + 1}`), x: number(payload.x), y: number(payload.y), width: clamp(payload.width, 1, 100000, 800), height: clamp(payload.height, 1, 100000, 500), background: safeColor(payload.background, next.canvas.background), breakpoint: text(payload.breakpoint || "desktop", "desktop") });
      const page = next.pages.find((item) => item.id === next.frames.at(-1).pageId) || next.pages[0];
      page?.frameIds.push(id);
      next.activeFrameId = id;
    } else if (type === "add-layer") {
      const id = uid("layer");
      const kind = ["rect", "ellipse", "text", "image", "video", "audio", "group", "path", "polygon", "star", "adjustment", "component", "instance", "3d"].includes(payload.type) ? payload.type : "rect";
      const layer = normalizeLayer({
        ...payload,
        id,
        frameId,
        type: kind,
        name: payload.name || `${kind} layer`,
        x: snapValue(next, payload.x ?? 120),
        y: snapValue(next, payload.y ?? 120),
        width: payload.width ?? 240,
        height: payload.height ?? 140,
        fill: payload.fill || next.brand.tokens["color.brand.secondary"]
      }, frameId);
      if (layer.type === "path" && layer.pathPoints.length && !layer.pathData) layer.pathData = pathFromPoints(layer.pathPoints, layer.pathClosed);
      next.layers.push(layer);
      next.selectedLayerId = id;
      next.selectedLayerIds = [id];
    } else if (type === "update-layer") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) {
        const changes = { ...(payload.changes || {}) };
        if ("x" in changes) changes.x = snapValue(next, changes.x);
        if ("y" in changes) changes.y = snapValue(next, changes.y);
        Object.assign(layer, normalizeLayer({ ...layer, ...changes }, layer.frameId));
        if ((changes.pathPoints || changes.pathClosed != null) && layer.pathPoints.length) layer.pathData = pathFromPoints(layer.pathPoints, layer.pathClosed);
        if (layer.parentId) layoutChildren(next, next.layers.find((item) => item.id === layer.parentId));
        if (layer.autoLayout.enabled) layoutChildren(next, layer);
      }
    } else if (type === "update-layers") {
      const changesById = payload.changesById && typeof payload.changesById === "object" ? payload.changesById : {};
      for (const layer of next.layers) {
        const changes = changesById[layer.id] || (selectionIds(next, payload).includes(layer.id) ? payload.changes : null);
        if (!changes || layer.locked) continue;
        const normalizedChanges = { ...changes };
        if ("x" in normalizedChanges) normalizedChanges.x = snapValue(next, normalizedChanges.x);
        if ("y" in normalizedChanges) normalizedChanges.y = snapValue(next, normalizedChanges.y);
        Object.assign(layer, normalizeLayer({ ...layer, ...normalizedChanges }, layer.frameId));
      }
      [...new Set(next.layers.map((layer) => layer.parentId).filter(Boolean))].forEach((id) => layoutChildren(next, next.layers.find((layer) => layer.id === id)));
    } else if (type === "remove-layer") {
      const removedIds = new Set(selectionIds(next, payload));
      const includeChildren = (parentId) => next.layers.filter((layer) => layer.parentId === parentId).forEach((child) => {
        if (!removedIds.has(child.id)) {
          removedIds.add(child.id);
          includeChildren(child.id);
        }
      });
      [...removedIds].forEach(includeChildren);
      next.layers = next.layers.filter((item) => !removedIds.has(item.id));
      next.selectedLayerId = next.layers.find((item) => item.frameId === frameId)?.id || "";
      next.selectedLayerIds = next.selectedLayerId ? [next.selectedLayerId] : [];
    } else if (type === "duplicate-layer") {
      const sources = selectedLayers(next, payload);
      const duplicates = [];
      for (const source of sources) {
        const duplicate = normalizeLayer({ ...source, id: uid("layer"), name: `${source.name} copy`, x: source.x + 24, y: source.y + 24, instanceOf: source.instanceOf }, source.frameId);
        next.layers.push(duplicate);
        duplicates.push(duplicate.id);
      }
      next.selectedLayerIds = duplicates;
      next.selectedLayerId = duplicates.at(-1) || next.selectedLayerId;
    } else if (type === "group-layers") {
      const layers = selectedLayers(next, payload).filter((layer) => !layer.locked);
      if (layers.length) {
        const minX = Math.min(...layers.map((layer) => layer.x));
        const minY = Math.min(...layers.map((layer) => layer.y));
        const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
        const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
        const group = normalizeLayer({ id: uid("layer"), frameId, type: "group", name: payload.name || "Group", x: minX, y: minY, width: maxX - minX, height: maxY - minY, fill: "#07101d", opacity: 1, stroke: "none", autoLayout: payload.autoLayout }, frameId);
        next.layers.push(group);
        layers.forEach((layer) => { layer.parentId = group.id; });
        next.selectedLayerId = group.id;
        next.selectedLayerIds = [group.id];
        if (payload.autoLayout?.enabled) layoutChildren(next, group);
      }
    } else if (type === "ungroup-layer") {
      const groupIds = new Set(selectionIds(next, payload));
      next.layers.forEach((layer) => {
        if (groupIds.has(layer.parentId)) layer.parentId = null;
      });
      next.layers = next.layers.filter((layer) => !(groupIds.has(layer.id) && ["group", "component"].includes(layer.type)));
      next.selectedLayerIds = next.layers.filter((layer) => !layer.parentId && layer.frameId === frameId).slice(-1).map((layer) => layer.id);
      next.selectedLayerId = next.selectedLayerIds[0] || "";
    } else if (type === "toggle-layer") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer) {
        if (payload.field === "locked") layer.locked = payload.value == null ? !layer.locked : Boolean(payload.value);
        if (payload.field === "visible") layer.visible = payload.value == null ? !layer.visible : Boolean(payload.value);
        if (payload.field === "alphaLock") layer.alphaLock = payload.value == null ? !layer.alphaLock : Boolean(payload.value);
      }
    } else if (type === "reorder-layer") {
      const index = next.layers.findIndex((layer) => layer.id === payload.id);
      if (index >= 0) {
        const [layer] = next.layers.splice(index, 1);
        const targetIndex = clamp(payload.index, 0, next.layers.length, index);
        next.layers.splice(targetIndex, 0, layer);
      }
    } else if (type === "align-layers") {
      const layers = selectedLayers(next, payload).filter((layer) => !layer.locked);
      if (layers.length > 1) {
        const minX = Math.min(...layers.map((layer) => layer.x));
        const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
        const minY = Math.min(...layers.map((layer) => layer.y));
        const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
        layers.forEach((layer) => {
          if (payload.align === "left") layer.x = minX;
          if (payload.align === "center-x") layer.x = minX + (maxX - minX - layer.width) / 2;
          if (payload.align === "right") layer.x = maxX - layer.width;
          if (payload.align === "top") layer.y = minY;
          if (payload.align === "center-y") layer.y = minY + (maxY - minY - layer.height) / 2;
          if (payload.align === "bottom") layer.y = maxY - layer.height;
        });
      }
    } else if (type === "distribute-layers") {
      const axis = payload.axis === "y" ? "y" : "x";
      const sizeKey = axis === "x" ? "width" : "height";
      const layers = selectedLayers(next, payload).filter((layer) => !layer.locked).sort((a, b) => a[axis] - b[axis]);
      if (layers.length > 2) {
        const start = layers[0][axis];
        const end = layers.at(-1)[axis] + layers.at(-1)[sizeKey];
        const total = layers.reduce((sum, layer) => sum + layer[sizeKey], 0);
        const gap = (end - start - total) / (layers.length - 1);
        let cursor = start;
        layers.forEach((layer) => {
          layer[axis] = cursor;
          cursor += layer[sizeKey] + gap;
        });
      }
    } else if (type === "tidy-layers") {
      const layers = selectedLayers(next, payload).filter((layer) => !layer.locked);
      const columns = Math.max(1, Math.ceil(Math.sqrt(layers.length)));
      const gap = clamp(payload.gap, 0, 500, next.canvas.grid * 2);
      const startX = Math.min(...layers.map((layer) => layer.x), 0);
      const startY = Math.min(...layers.map((layer) => layer.y), 0);
      const cellWidth = Math.max(...layers.map((layer) => layer.width), 100) + gap;
      const cellHeight = Math.max(...layers.map((layer) => layer.height), 100) + gap;
      layers.forEach((layer, index) => {
        layer.x = startX + (index % columns) * cellWidth;
        layer.y = startY + Math.floor(index / columns) * cellHeight;
      });
    } else if (type === "set-canvas") {
      const incoming = payload.changes && typeof payload.changes === "object" ? payload.changes : {};
      next.canvas = normalizeDocument({ ...next, canvas: { ...next.canvas, ...incoming } }).canvas;
    } else if (type === "add-guide") {
      next.canvas.guides.push({ id: uid("guide"), axis: payload.axis === "x" ? "x" : "y", position: number(payload.position), locked: false });
    } else if (type === "remove-guide") {
      next.canvas.guides = next.canvas.guides.filter((guide) => guide.id !== payload.id);
    } else if (type === "set-brand-token") {
      const key = text(payload.key);
      if (key && key.length < 80) next.brand.tokens[key] = typeof payload.value === "number" ? payload.value : text(payload.value);
    } else if (type === "set-brand-font") {
      const key = ["heading", "body"].includes(payload.key) ? payload.key : "";
      if (key) next.brand.fonts[key] = text(payload.value || "Inter", "Inter");
    } else if (type === "add-asset") {
      if (next.assets.length < MAX_ASSETS) next.assets.push({ ...payload, id: text(payload.id || uid("asset"), uid("asset")), createdAt: now(), status: payload.status || "ready", license: payload.license || "unknown", source: payload.source || "local" });
    } else if (type === "remove-asset") {
      next.assets = next.assets.filter((asset) => asset.id !== payload.id);
      next.layers = next.layers.map((layer) => layer.assetId === payload.id ? { ...layer, assetId: null } : layer);
    } else if (type === "replace-asset") {
      const asset = next.assets.find((item) => item.id === payload.id);
      if (asset) {
        asset.versions.push({ id: uid("asset-version"), checksum: asset.checksum, size: asset.size, createdAt: now() });
        Object.assign(asset, {
          name: text(payload.name || asset.name, asset.name),
          type: text(payload.type || asset.type, asset.type),
          size: Math.max(0, number(payload.size, asset.size)),
          checksum: text(payload.checksum || asset.checksum),
          width: number(payload.width, asset.width),
          height: number(payload.height, asset.height),
          thumbnail: payload.thumbnail || asset.thumbnail,
          status: "ready",
          version: asset.version + 1
        });
      }
    } else if (type === "set-asset-metadata") {
      const asset = next.assets.find((item) => item.id === payload.id);
      if (asset) Object.assign(asset, {
        sourceUrl: text(payload.sourceUrl ?? asset.sourceUrl),
        author: text(payload.author ?? asset.author),
        license: text(payload.license ?? asset.license, "unknown"),
        licenseExpiresAt: text(payload.licenseExpiresAt ?? asset.licenseExpiresAt),
        altText: text(payload.altText ?? asset.altText),
        tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 30).map((item) => text(item)).filter(Boolean) : asset.tags
      });
    } else if (type === "add-adjustment") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) {
        layer.adjustments.push({
          id: uid("adjustment"),
          type: ["brightness", "contrast", "saturation", "hue", "exposure", "blur", "grayscale", "sepia"].includes(payload.adjustmentType) ? payload.adjustmentType : "brightness",
          value: clamp(payload.value, -200, 200, 0),
          enabled: true
        });
      }
    } else if (type === "update-adjustment") {
      const layer = next.layers.find((item) => item.id === payload.id);
      const adjustment = layer?.adjustments.find((item) => item.id === payload.adjustmentId);
      if (adjustment && !layer.locked) {
        if (payload.value != null) adjustment.value = clamp(payload.value, -200, 200, adjustment.value);
        if (payload.enabled != null) adjustment.enabled = Boolean(payload.enabled);
      }
    } else if (type === "remove-adjustment") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) layer.adjustments = layer.adjustments.filter((item) => item.id !== payload.adjustmentId);
    } else if (type === "add-mask") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) {
        layer.masks.push({
          id: uid("mask"),
          type: ["rect", "ellipse", "path", "alpha"].includes(payload.maskType) ? payload.maskType : "rect",
          enabled: true,
          inverted: false,
          feather: clamp(payload.feather, 0, 200, 0),
          opacity: 1,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          pathData: text(payload.pathData)
        });
      }
    } else if (type === "update-mask") {
      const layer = next.layers.find((item) => item.id === payload.id);
      const mask = layer?.masks.find((item) => item.id === payload.maskId);
      if (mask && !layer.locked) Object.assign(mask, {
        ...mask,
        ...(payload.changes || {}),
        feather: clamp(payload.changes?.feather ?? mask.feather, 0, 200, mask.feather),
        opacity: clamp(payload.changes?.opacity ?? mask.opacity, 0, 1, mask.opacity)
      });
    } else if (type === "remove-mask") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) layer.masks = layer.masks.filter((item) => item.id !== payload.maskId);
    } else if (type === "set-gradient") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) {
        layer.gradient = normalizeLayer({ ...layer, gradient: payload.gradient || null }, layer.frameId).gradient;
      }
    } else if (type === "boolean-layers") {
      const layers = selectedLayers(next, payload).filter((layer) => !layer.locked);
      if (layers.length >= 2) {
        const mode = ["union", "subtract", "intersect", "exclude"].includes(payload.mode) ? payload.mode : "union";
        const minX = Math.min(...layers.map((layer) => layer.x));
        const minY = Math.min(...layers.map((layer) => layer.y));
        const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
        const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
        const booleanLayer = normalizeLayer({
          id: uid("layer"),
          frameId,
          type: "path",
          name: `${mode} · ${layers.map((layer) => layer.name).join(" + ")}`,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          fill: layers[0].fill,
          stroke: layers[0].stroke,
          strokeWidth: layers[0].strokeWidth,
          pathData: `M ${minX} ${minY} H ${maxX} V ${maxY} H ${minX} Z`,
          metadata: {
            booleanMode: mode,
            booleanSources: layers.map((layer) => clone(layer))
          }
        }, frameId);
        next.layers = next.layers.filter((layer) => !layers.some((source) => source.id === layer.id));
        next.layers.push(booleanLayer);
        next.selectedLayerId = booleanLayer.id;
        next.selectedLayerIds = [booleanLayer.id];
      }
    } else if (type === "create-component") {
      const layers = selectedLayers(next, payload);
      if (layers.length) {
        const existingGroup = layers.length === 1 && ["group", "component"].includes(layers[0].type) ? layers[0] : null;
        let master = existingGroup;
        if (!master) {
          const minX = Math.min(...layers.map((layer) => layer.x));
          const minY = Math.min(...layers.map((layer) => layer.y));
          const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
          const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
          master = normalizeLayer({ id: uid("layer"), frameId, type: "component", name: payload.name || "Component", x: minX, y: minY, width: maxX - minX, height: maxY - minY, fill: "#07101d", stroke: next.brand.tokens["color.brand.secondary"], strokeWidth: 1 }, frameId);
          next.layers.push(master);
          layers.forEach((layer) => { layer.parentId = master.id; });
        }
        master.type = "component";
        const component = {
          id: uid("component"),
          name: text(payload.name || master.name || "Component", "Component"),
          masterLayerId: master.id,
          description: text(payload.description),
          properties: payload.properties && typeof payload.properties === "object" ? clone(payload.properties) : {},
          variants: [{ id: uid("variant"), name: "Default", properties: {} }]
        };
        master.componentId = component.id;
        next.components.push(component);
        next.selectedLayerId = master.id;
        next.selectedLayerIds = [master.id];
      }
    } else if (type === "create-instance") {
      const component = next.components.find((item) => item.id === payload.componentId) || next.components[0];
      const master = component && next.layers.find((layer) => layer.id === component.masterLayerId);
      if (component && master) {
        const instance = normalizeLayer({
          ...master,
          id: uid("layer"),
          frameId,
          type: "instance",
          name: `${component.name} instance`,
          x: payload.x ?? master.x + master.width + 40,
          y: payload.y ?? master.y,
          parentId: null,
          componentId: component.id,
          instanceOf: master.id,
          overrides: payload.overrides || {}
        }, frameId);
        next.layers.push(instance);
        next.selectedLayerId = instance.id;
        next.selectedLayerIds = [instance.id];
      }
    } else if (type === "add-component-variant") {
      const component = next.components.find((item) => item.id === payload.componentId);
      if (component) component.variants.push({ id: uid("variant"), name: text(payload.name || `Variant ${component.variants.length + 1}`), properties: payload.properties && typeof payload.properties === "object" ? clone(payload.properties) : {} });
    } else if (type === "set-variable") {
      const collection = next.variables.collections.find((item) => item.id === payload.collectionId) || next.variables.collections[0];
      const key = text(payload.key);
      const mode = text(payload.mode || next.variables.activeMode || "default", "default");
      if (collection && key) {
        const current = collection.values[key] || { type: ["color", "number", "string", "boolean"].includes(payload.variableType) ? payload.variableType : "string" };
        current.type = ["color", "number", "string", "boolean"].includes(payload.variableType) ? payload.variableType : current.type;
        current[mode] = typeof payload.value === "boolean" || typeof payload.value === "number" ? payload.value : text(payload.value);
        collection.values[key] = current;
        if (!collection.modes.includes(mode)) collection.modes.push(mode);
      }
    } else if (type === "set-variable-mode") {
      next.variables.activeMode = text(payload.mode || "default", "default");
    } else if (type === "bind-variable") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && payload.property && payload.variableKey) layer.variableBindings[text(payload.property)] = text(payload.variableKey);
    } else if (type === "set-auto-layout") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) {
        layer.autoLayout = normalizeLayer({ ...layer, autoLayout: { ...layer.autoLayout, ...(payload.changes || {}), enabled: true } }, layer.frameId).autoLayout;
        if (payload.layoutSizing) layer.layoutSizing = { ...layer.layoutSizing, ...payload.layoutSizing };
        layoutChildren(next, layer);
      }
    } else if (type === "add-prototype-action") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer) {
        const action = normalizeLayer({ ...layer, prototypeActions: [...layer.prototypeActions, payload.action || payload] }, layer.frameId).prototypeActions.at(-1);
        layer.prototypeActions = [...layer.prototypeActions, action];
        next.prototype.actions.push({ ...action, layerId: layer.id });
      }
    } else if (type === "add-keyframe") {
      const layer = next.layers.find((item) => item.id === payload.id);
      const property = ["x", "y", "width", "height", "rotation", "opacity", "fill"].includes(payload.property) ? payload.property : "opacity";
      if (layer) next.timeline.keyframes.push({
        id: uid("keyframe"),
        layerId: layer.id,
        property,
        time: clamp(payload.time, 0, next.timeline.duration, next.timeline.currentTime),
        value: payload.value ?? layer[property],
        easing: text(payload.easing || "ease", "ease")
      });
    } else if (type === "remove-keyframe") {
      next.timeline.keyframes = next.timeline.keyframes.filter((keyframe) => keyframe.id !== payload.id);
    } else if (type === "set-timeline") {
      next.timeline = normalizeDocument({ ...next, timeline: { ...next.timeline, ...(payload.changes || {}) } }).timeline;
    } else if (type === "apply-ai-plan") {
      const plan = payload.plan && typeof payload.plan === "object" ? payload.plan : {};
      const frame = next.frames.find((item) => item.id === frameId) || next.frames[0];
      const palette = (Array.isArray(plan.palette) ? plan.palette : []).map((item) => String(item).match(/#[0-9a-f]{6}/i)?.[0]).filter(Boolean);
      const primary = palette[0] || next.brand.tokens["color.brand.primary"];
      const secondary = palette[1] || next.brand.tokens["color.brand.secondary"];
      const operationName = text(payload.operation || "plan", "plan");
      const targetIds = new Set((Array.isArray(payload.inputLayerIds) ? payload.inputLayerIds : next.selectedLayerIds).map((id) => text(id)));
      if (operationName === "recolor") {
        next.brand.tokens["color.brand.primary"] = primary;
        next.brand.tokens["color.brand.secondary"] = secondary;
        next.layers.filter((layer) => targetIds.has(layer.id) && !layer.locked).forEach((layer, index) => {
          layer.fill = palette[index % Math.max(1, palette.length)] || (index % 2 ? secondary : primary);
        });
      } else if (operationName === "alt-text") {
        const description = text(plan.summary || plan.accessibility?.join?.(" ") || payload.prompt || "Hình ảnh trong thiết kế");
        next.layers.filter((layer) => targetIds.has(layer.id) && layer.type === "image" && !layer.locked).forEach((layer) => { layer.altText = description; });
      } else if (operationName === "responsive") {
        const variants = [
          { name: "AI Mobile", width: 390, height: 844, breakpoint: "mobile" },
          { name: "AI Tablet", width: 768, height: 1024, breakpoint: "tablet" }
        ];
        const sourceLayers = next.layers.filter((layer) => layer.frameId === frame.id && (targetIds.size ? targetIds.has(layer.id) : true));
        const createdIds = [];
        variants.forEach((variant, variantIndex) => {
          const targetFrame = { id: uid("frame"), pageId: frame.pageId, name: variant.name, x: frame.x + frame.width + 120 + variantIndex * (variant.width + 100), y: frame.y, width: variant.width, height: variant.height, background: frame.background, breakpoint: variant.breakpoint };
          next.frames.push(targetFrame);
          const page = next.pages.find((item) => item.id === targetFrame.pageId);
          page?.frameIds.push(targetFrame.id);
          sourceLayers.forEach((layer) => {
            const cloneLayer = normalizeLayer({
              ...clone(layer),
              id: uid("layer"),
              frameId: targetFrame.id,
              parentId: null,
              name: `${layer.name} · ${variant.breakpoint}`,
              x: layer.x / frame.width * targetFrame.width,
              y: layer.y / frame.height * targetFrame.height,
              width: Math.max(1, layer.width / frame.width * targetFrame.width),
              height: Math.max(1, layer.height / frame.height * targetFrame.height)
            }, targetFrame.id);
            next.layers.push(cloneLayer);
            createdIds.push(cloneLayer.id);
          });
        });
        next.selectedLayerIds = createdIds;
        next.selectedLayerId = createdIds[0] || next.selectedLayerId;
      } else if (operationName === "audit") {
        next.comments.push({ id: uid("comment"), layerId: next.selectedLayerId, frameId: frame.id, body: text(plan.summary || payload.prompt || "AI layout audit"), status: "open", author: "Design AI Copilot", createdAt: now() });
      } else {
        next.brand.tokens["color.brand.primary"] = primary;
        next.brand.tokens["color.brand.secondary"] = secondary;
        const headline = normalizeLayer({ id: uid("layer"), frameId: frame.id, type: "text", name: "AI headline", text: text(plan.summary || payload.prompt || "Ý tưởng thiết kế mới", "Ý tưởng thiết kế mới"), x: 96, y: 110, width: Math.max(320, frame.width * 0.55), height: 120, fontSize: Math.min(72, Math.max(38, frame.width / 18)), fontWeight: 800, fill: next.brand.tokens["color.text.primary"] }, frame.id);
        const accent = normalizeLayer({ id: uid("layer"), frameId: frame.id, type: "ellipse", name: "AI visual accent", x: frame.width * 0.68, y: frame.height * 0.2, width: Math.min(330, frame.width * 0.24), height: Math.min(330, frame.width * 0.24), fill: primary, gradient: { type: "radial", angle: 0, stops: [{ offset: 0, color: "#ffffff", opacity: 1 }, { offset: 0.45, color: primary, opacity: 1 }, { offset: 1, color: secondary, opacity: 1 }] } }, frame.id);
        const cta = normalizeLayer({ id: uid("layer"), frameId: frame.id, type: "rect", name: "AI CTA", x: 96, y: 320, width: 230, height: 64, fill: secondary, cornerRadius: 18 }, frame.id);
        const ctaText = normalizeLayer({ id: uid("layer"), frameId: frame.id, parentId: cta.id, type: "text", name: "AI CTA label", text: "Khám phá ngay", x: 132, y: 333, width: 170, height: 40, fontSize: 20, fontWeight: 750, fill: "#07101d" }, frame.id);
        next.layers.push(headline, accent, cta, ctaText);
        next.selectedLayerIds = [headline.id, accent.id, cta.id, ctaText.id];
        next.selectedLayerId = headline.id;
      }
    } else if (type === "fix-health-issue") {
      const issueId = text(payload.issueId);
      const layerId = issueId.split("-").slice(1).join("-");
      const layer = next.layers.find((item) => item.id === layerId);
      if (issueId.startsWith("contrast-") && layer) layer.fill = contrastRatio("#f4f8ff", next.canvas.background) >= 4.5 ? "#f4f8ff" : "#07101d";
      if (issueId.startsWith("alt-") && layer) layer.altText = layer.name || "Hình ảnh trong thiết kế";
      if (issueId.startsWith("touch-") && layer) {
        layer.width = Math.max(44, layer.width);
        layer.height = Math.max(44, layer.height);
      }
      if (issueId.startsWith("overflow-") && layer) {
        const frame = next.frames.find((item) => item.id === layer.frameId);
        if (frame) {
          layer.x = clamp(layer.x, 0, Math.max(0, frame.width - layer.width), 0);
          layer.y = clamp(layer.y, 0, Math.max(0, frame.height - layer.height), 0);
        }
      }
    } else if (type === "set-approval") {
      const status = ["draft", "review", "approved", "changes-requested"].includes(payload.status) ? payload.status : "draft";
      next.status = status;
      next.approvals.push({ id: uid("approval"), status, actor: text(payload.actor || "local-user", "local-user"), note: text(payload.note), createdAt: now() });
    } else if (type === "add-comment") {
      next.comments.push({ id: uid("comment"), layerId: text(payload.layerId), frameId, body: text(payload.body), status: "open", author: text(payload.author || "local-user", "local-user"), createdAt: now() });
    } else if (type === "resolve-comment") {
      const comment = next.comments.find((item) => item.id === payload.id);
      if (comment) comment.status = "resolved";
    } else if (type === "create-version") {
      next.versions.push({ id: uid("version"), name: text(payload.name || `Version ${next.versions.length + 1}`), branch: next.branch, createdAt: now(), snapshot: snapshotDocument(next) });
    } else if (type === "create-branch") {
      const name = text(payload.name || `feature-${Date.now().toString(36)}`, "feature").replace(/\s+/g, "-").slice(0, 80);
      next.branches.push({ id: name, name, parent: next.branch, createdAt: now() });
      next.branch = name;
    } else if (type === "set-job") {
      const incoming = payload.job || {};
      const existing = next.jobs.find((item) => item.id === incoming.id);
      const job = {
        id: text(incoming.id || uid("job"), uid("job")),
        kind: text(incoming.kind || "design-ai", "design-ai"),
        operation: text(incoming.operation || existing?.operation || "plan", "plan"),
        status: ["queued", "running", "completed", "failed", "cancelled"].includes(incoming.status) ? incoming.status : "queued",
        provider: text(incoming.provider || existing?.provider || "auto", "auto"),
        model: text(incoming.model || existing?.model || "auto", "auto"),
        input: text(incoming.input ?? existing?.input),
        output: text(incoming.output ?? existing?.output),
        error: text(incoming.error ?? existing?.error),
        structured: incoming.structured && typeof incoming.structured === "object" ? clone(incoming.structured) : (existing?.structured || null),
        inputLayerIds: (Array.isArray(incoming.inputLayerIds) ? incoming.inputLayerIds : existing?.inputLayerIds || []).slice(0, 100).map((id) => text(id)),
        resultLayerIds: (Array.isArray(incoming.resultLayerIds) ? incoming.resultLayerIds : existing?.resultLayerIds || []).slice(0, 100).map((id) => text(id)),
        resultAssetIds: (Array.isArray(incoming.resultAssetIds) ? incoming.resultAssetIds : existing?.resultAssetIds || []).slice(0, 100).map((id) => text(id)),
        versionBefore: text(incoming.versionBefore || existing?.versionBefore),
        versionAfter: text(incoming.versionAfter || existing?.versionAfter),
        usage: incoming.usage && typeof incoming.usage === "object" ? clone(incoming.usage) : (existing?.usage || null),
        cost: Math.max(0, number(incoming.cost, existing?.cost || 0)),
        latencyMs: Math.max(0, number(incoming.latencyMs, existing?.latencyMs || 0)),
        createdAt: text(existing?.createdAt || incoming.createdAt || now(), now()),
        updatedAt: now()
      };
      if (existing) Object.assign(existing, job);
      else next.jobs.push(job);
      next.jobs = next.jobs.slice(-MAX_JOBS);
    }
    const changes = documentChanges(before, next);
    if (!changes.length) return next;
    const command = {
      id: uid("cmd"),
      type,
      payload: clone(payload),
      changes,
      before: { commandLog: [] },
      after: { commandLog: [] },
      createdAt: now(),
      branch: next.branch
    };
    next.commandLog = [...next.commandLog, command].slice(-MAX_COMMANDS);
    next.history = { past: [...(document?.history?.past || []), command.id].slice(-MAX_COMMANDS), future: [] };
    next.updatedAt = now();
    return next;
  }

  function undo(document) {
    const current = normalizeDocument(document);
    const command = current.commandLog.find((item) => item.id === current.history.past.at(-1));
    if (!command) return current;
    const restored = command.changes?.length
      ? applyChanges(current, command.changes, "undo")
      : normalizeDocument(command.before);
    restored.commandLog = current.commandLog;
    restored.history = { past: current.history.past.slice(0, -1), future: [command.id, ...current.history.future].slice(0, MAX_COMMANDS) };
    restored.updatedAt = now();
    return restored;
  }

  function redo(document) {
    const current = normalizeDocument(document);
    const command = current.commandLog.find((item) => item.id === current.history.future[0]);
    if (!command) return current;
    const applied = command.changes?.length
      ? applyChanges(current, command.changes, "redo")
      : normalizeDocument(command.after);
    applied.commandLog = current.commandLog;
    applied.history = { past: [...current.history.past, command.id].slice(-MAX_COMMANDS), future: current.history.future.slice(1) };
    applied.updatedAt = now();
    return applied;
  }

  function luminance(hex) {
    const rgb = String(hex || "#000000").slice(1).match(/.{2}/g)?.map((part) => parseInt(part, 16) / 255) || [0, 0, 0];
    return rgb.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }

  function contrastRatio(a, b) {
    const light = Math.max(luminance(a), luminance(b));
    const dark = Math.min(luminance(a), luminance(b));
    return (light + 0.05) / (dark + 0.05);
  }

  function runHealthScan(document) {
    const doc = normalizeDocument(document);
    const issues = [];
    const frameIds = new Set(doc.frames.map((frame) => frame.id));
    const layerIds = new Set(doc.layers.map((layer) => layer.id));
    const assetIds = new Set(doc.assets.map((asset) => asset.id));
    const tokenValues = new Set(Object.values(doc.brand.tokens).filter((value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)));
    if (!doc.pages.length) issues.push({ id: "pages", severity: "error", message: "Tài liệu chưa có page." });
    if (!doc.frames.length) issues.push({ id: "frames", severity: "error", message: "Tài liệu chưa có frame." });
    doc.layers.forEach((layer) => {
      const frame = doc.frames.find((item) => item.id === layer.frameId);
      if (!frameIds.has(layer.frameId)) issues.push({ id: `orphan-${layer.id}`, severity: "error", message: `${layer.name} không còn frame liên kết.` });
      if (layer.parentId && !layerIds.has(layer.parentId)) issues.push({ id: `parent-${layer.id}`, severity: "error", message: `${layer.name} có parent không tồn tại.` });
      if (!layer.visible && !layer.locked) issues.push({ id: `hidden-${layer.id}`, severity: "info", message: `${layer.name} đang ẩn nhưng chưa khóa.` });
      if (layer.type === "text" && !layer.text.trim()) issues.push({ id: `text-${layer.id}`, severity: "error", message: `${layer.name} chưa có nội dung.` });
      if (layer.type === "text" && layer.fontSize < 12) issues.push({ id: `font-${layer.id}`, severity: "warning", message: `${layer.name} có cỡ chữ dưới 12px.` });
      if (layer.type === "text" && /[\u0102-\u01B0\u1EA0-\u1EF9]/.test(layer.text) && !layer.fontFamily.trim()) issues.push({ id: `glyph-${layer.id}`, severity: "warning", message: `${layer.name} cần font có glyph tiếng Việt.` });
      if (layer.type === "image" && !layer.altText.trim()) issues.push({ id: `alt-${layer.id}`, severity: "warning", message: `${layer.name} thiếu alt text.` });
      if (layer.type === "image" && layer.assetId && !assetIds.has(layer.assetId)) issues.push({ id: `asset-link-${layer.id}`, severity: "error", message: `${layer.name} đang liên kết asset không tồn tại.` });
      if (layer.type === "text" && contrastRatio(layer.fill, doc.canvas.background) < 4.5) issues.push({ id: `contrast-${layer.id}`, severity: "warning", message: `${layer.name} có contrast dưới WCAG AA.` });
      if (["rect", "instance", "component"].includes(layer.type) && (layer.width < 44 || layer.height < 44) && layer.prototypeActions.length) issues.push({ id: `touch-${layer.id}`, severity: "warning", message: `${layer.name} có vùng chạm nhỏ hơn 44×44.` });
      if (frame && (layer.x < 0 || layer.y < 0 || layer.x + layer.width > frame.width || layer.y + layer.height > frame.height)) issues.push({ id: `overflow-${layer.id}`, severity: "warning", message: `${layer.name} tràn khỏi frame ${frame.name}.` });
      if (typeof layer.fill === "string" && /^#[0-9a-f]{6}$/i.test(layer.fill) && !tokenValues.has(layer.fill) && !layer.variableBindings.fill) issues.push({ id: `raw-color-${layer.id}`, severity: "info", message: `${layer.name} dùng màu trực tiếp ngoài Brand Kit.` });
      if (layer.type === "text" && layer.text.length * layer.fontSize * 0.56 > layer.width * 1.2) issues.push({ id: `text-overflow-${layer.id}`, severity: "warning", message: `${layer.name} có khả năng tràn chữ.` });
    });
    doc.assets.forEach((asset) => {
      if (asset.status !== "ready") issues.push({ id: `asset-${asset.id}`, severity: "error", message: `${asset.name}: asset ${asset.status}.` });
      if (asset.license === "unknown") issues.push({ id: `license-${asset.id}`, severity: "warning", message: `${asset.name} chưa có nguồn hoặc license.` });
      if (asset.licenseExpiresAt && Number.isFinite(Date.parse(asset.licenseExpiresAt)) && Date.parse(asset.licenseExpiresAt) < Date.now()) issues.push({ id: `license-expired-${asset.id}`, severity: "error", message: `${asset.name} có license đã hết hạn.` });
      if (asset.kind === "image" && asset.width && asset.width < 800) issues.push({ id: `resolution-${asset.id}`, severity: "warning", message: `${asset.name} có độ phân giải thấp.` });
    });
    doc.frames.forEach((frame) => {
      if (frame.breakpoint.toLowerCase().includes("mobile") && frame.width > 600) issues.push({ id: `breakpoint-${frame.id}`, severity: "warning", message: `${frame.name} gắn nhãn mobile nhưng rộng hơn 600px.` });
    });
    return {
      ok: !issues.some((issue) => issue.severity === "error"),
      issues,
      scannedAt: now(),
      summary: {
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
        info: issues.filter((issue) => issue.severity === "info").length
      }
    };
  }

  function exportDocument(document) {
    return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now(), document: serializableDocument(document) }, null, 2);
  }

  function importDocument(input) {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    if (!parsed || parsed.format !== FORMAT || !parsed.document) throw new Error("Tệp HH Design không hợp lệ.");
    const imported = normalizeDocument(parsed.document);
    imported.history = { past: [], future: [] };
    return imported;
  }

  function readStored() {
    try {
      const current = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (current) return normalizeDocument(JSON.parse(current));
      const legacy = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = normalizeDocument(JSON.parse(legacy));
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(serializableDocument(migrated)));
        return migrated;
      }
      return normalizeDocument(defaultDocument());
    } catch {
      return normalizeDocument(defaultDocument());
    }
  }

  function writeStored(document) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(serializableDocument(document)));
      return true;
    } catch { return false; }
  }

  function openAssetDatabase() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(ASSET_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) request.result.createObjectStore(ASSET_STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không thể mở Asset Observatory."));
    });
  }

  async function putAssetBlob(id, blob, meta = {}) {
    const db = await openAssetDatabase();
    if (!db) throw new Error("Trình duyệt không hỗ trợ IndexedDB.");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
      transaction.objectStore(ASSET_STORE_NAME).put({ id: text(id), blob, meta: clone(meta), updatedAt: now() });
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = () => { const error = transaction.error; db.close(); reject(error || new Error("Không thể lưu asset.")); };
    });
  }

  async function getAssetBlob(id) {
    const db = await openAssetDatabase();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ASSET_STORE_NAME, "readonly");
      const request = transaction.objectStore(ASSET_STORE_NAME).get(text(id));
      request.onsuccess = () => { const result = request.result || null; db.close(); resolve(result); };
      request.onerror = () => { const error = request.error; db.close(); reject(error); };
    });
  }

  async function removeAssetBlob(id) {
    const db = await openAssetDatabase();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
      transaction.objectStore(ASSET_STORE_NAME).delete(text(id));
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = () => { const error = transaction.error; db.close(); reject(error); };
    });
  }

  async function checksumBlob(blob) {
    const buffer = await blob.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    let hash = 2166136261;
    for (const byte of new Uint8Array(buffer)) hash = Math.imul(hash ^ byte, 16777619);
    return `fnv1a-${(hash >>> 0).toString(16)}`;
  }

  function imageDimensions(blob) {
    return new Promise((resolve) => {
      if (!String(blob?.type || "").startsWith("image/") || typeof Image === "undefined") return resolve({ width: 0, height: 0, thumbnail: "" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const ratio = Math.min(1, 320 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/webp", 0.78);
        URL.revokeObjectURL(url);
        resolve({ width, height, thumbnail });
      };
      image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0, thumbnail: "" }); };
      image.src = url;
    });
  }

  async function assetRecordFromBlob(blob, name, source = "local-device") {
    const id = uid("asset");
    const checksum = await checksumBlob(blob);
    const dimensions = await imageDimensions(blob);
    const kind = String(blob.type || "").startsWith("image/")
      ? "image"
      : String(blob.type || "").startsWith("video/") ? "video"
        : String(blob.type || "").startsWith("audio/") ? "audio"
          : blob.type === "image/svg+xml" ? "vector" : "other";
    const record = {
      id,
      name: text(name || "Asset", "Asset"),
      kind,
      type: text(blob.type || "application/octet-stream"),
      size: blob.size,
      checksum,
      source,
      license: "unknown",
      status: "ready",
      width: dimensions.width,
      height: dimensions.height,
      thumbnail: dimensions.thumbnail,
      version: 1,
      versions: [],
      tags: [],
      createdAt: now()
    };
    await putAssetBlob(id, blob, { name: record.name, type: record.type, checksum });
    return record;
  }

  function addStyles() {
    if (typeof document === "undefined" || document.getElementById("hh-graphic-design-universal-style")) return;
    const style = document.createElement("style");
    style.id = "hh-graphic-design-universal-style";
    style.textContent = `
      .gdu-shell{--gdu-cyan:#63e8ff;--gdu-pink:#ff5fc8;--gdu-purple:#a98cff;--gdu-lime:#c9f26f;--gdu-ink:#07101d;--gdu-panel:rgba(10,18,33,.92);--gdu-line:rgba(125,210,255,.22);position:relative;margin:0 0 20px;border:1px solid var(--gdu-line);border-radius:20px;background:radial-gradient(circle at 78% 12%,rgba(255,95,200,.11),transparent 30%),linear-gradient(135deg,rgba(6,14,28,.98),rgba(16,12,39,.94));box-shadow:0 22px 80px rgba(0,0,0,.35),0 0 46px rgba(99,232,255,.09);overflow:hidden;color:#edf7ff;font:500 13px/1.45 Inter,system-ui,sans-serif}.gdu-shell *{box-sizing:border-box}.gdu-top{display:flex;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--gdu-line);background:linear-gradient(90deg,rgba(99,232,255,.1),transparent 50%,rgba(255,95,200,.09))}.gdu-top h3{margin:0;font-size:16px}.gdu-top p{margin:3px 0 0;color:#9eb0c6;font-size:11px}.gdu-top-actions{display:flex;gap:7px;align-items:center;margin-left:auto;flex-wrap:wrap}.gdu-shell button,.gdu-shell input,.gdu-shell select{font:inherit}.gdu-shell button{min-height:32px;padding:6px 10px;border:1px solid #355269;border-radius:8px;background:#122236;color:#effbff;cursor:pointer}.gdu-shell button:hover,.gdu-shell button:focus-visible{border-color:var(--gdu-cyan);outline:0;box-shadow:0 0 0 2px rgba(99,232,255,.15)}.gdu-primary{background:linear-gradient(110deg,var(--gdu-cyan),var(--gdu-pink))!important;border:0!important;color:#08101a!important;font-weight:800}.gdu-layout{display:grid;grid-template-columns:150px minmax(360px,1fr) 250px;min-height:430px}.gdu-planets,.gdu-inspector{padding:12px;border-right:1px solid var(--gdu-line);background:rgba(5,12,24,.62)}.gdu-inspector{border-right:0;border-left:1px solid var(--gdu-line)}.gdu-planet{display:flex!important;width:100%;align-items:center;gap:7px;margin-bottom:6px;text-align:left;background:transparent!important;border-color:transparent!important}.gdu-planet i{width:23px;height:23px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#fff,var(--planet-tone),transparent 70%);box-shadow:0 0 12px var(--planet-tone)}.gdu-planet small{display:block;color:#8ea1b6;font-size:9px}.gdu-planet.is-active{border-color:var(--planet-tone)!important;background:rgba(99,232,255,.09)!important}.gdu-lab{padding:12px;min-width:0}.gdu-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:9px}.gdu-toolbar .gdu-spacer{flex:1}.gdu-stage{position:relative;min-height:300px;padding:18px;border:1px solid rgba(137,186,255,.25);border-radius:14px;background:radial-gradient(circle at 50% 45%,rgba(77,56,140,.34),transparent 54%),#050b16;overflow:auto}.gdu-stage svg{display:block;width:100%;min-width:420px;height:auto;border-radius:10px;background:#07101d;box-shadow:0 0 42px rgba(99,232,255,.13)}.gdu-stage [data-gdu-layer]{cursor:pointer}.gdu-stage [data-gdu-layer].is-selected{filter:drop-shadow(0 0 8px var(--gdu-cyan));stroke:var(--gdu-cyan)!important;stroke-width:3!important}.gdu-layers{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.gdu-layer{min-height:28px;padding:4px 8px!important;font-size:11px}.gdu-layer.is-selected{border-color:var(--gdu-pink);color:#fff}.gdu-inspector h4{margin:0 0 8px;color:var(--gdu-cyan);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.gdu-field{display:grid;gap:4px;margin:0 0 8px;color:#9eb0c6;font-size:10px}.gdu-field input,.gdu-field select,.gdu-ai-input{width:100%;min-height:30px;padding:6px 8px;border:1px solid #294254;border-radius:7px;background:#08121f;color:#f4f8ff}.gdu-pills{display:flex;gap:5px;flex-wrap:wrap}.gdu-pill{padding:4px 7px;border:1px solid #385266;border-radius:999px;color:#9edcea;font-size:10px}.gdu-health{margin-top:10px;padding:9px;border:1px solid rgba(255,143,87,.3);border-radius:10px;background:rgba(255,143,87,.07)}.gdu-health strong{color:#ffb77d}.gdu-health ul{margin:7px 0 0;padding-left:17px;color:#e1bba5;font-size:10px}.gdu-ai{margin-top:10px;padding:9px;border:1px solid rgba(240,91,208,.3);border-radius:10px;background:rgba(240,91,208,.07)}.gdu-ai textarea{min-height:62px;resize:vertical}.gdu-job{margin-top:7px;color:#b9c8d8;font-size:10px}.gdu-footer{display:flex;gap:8px;justify-content:space-between;padding:9px 12px;border-top:1px solid var(--gdu-line);color:#8ea1b6;font-size:10px}.gdu-footer b{color:var(--gdu-cyan)}.gdu-toast{position:absolute;right:12px;bottom:12px;padding:9px 11px;border:1px solid var(--gdu-cyan);border-radius:9px;background:#07101d;color:#eafaff;box-shadow:0 0 20px rgba(99,232,255,.2);z-index:3}.gdu-empty{padding:14px;color:#8ea1b6}.gdu-shell[data-gdu-compact="true"] .gdu-layout{display:none}.gdu-shell[data-gdu-compact="true"] .gdu-footer{border-top:0}.gdu-shell[data-gdu-mode="focus"] .gdu-planets{display:none}.gdu-shell[data-gdu-mode="focus"] .gdu-layout{grid-template-columns:minmax(0,1fr) 250px}@media(max-width:1000px){.gdu-layout{grid-template-columns:130px minmax(320px,1fr)}.gdu-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--gdu-line);display:grid;grid-template-columns:1fr 1fr;gap:12px}}@media(max-width:680px){.gdu-top{align-items:flex-start;flex-wrap:wrap}.gdu-top-actions{width:100%;margin-left:0}.gdu-layout{display:block}.gdu-planets,.gdu-inspector{border:0;border-bottom:1px solid var(--gdu-line)}.gdu-planets{display:flex;overflow:auto;gap:6px}.gdu-planet{min-width:142px;margin:0}.gdu-stage{min-height:250px}.gdu-footer{flex-wrap:wrap}.gdu-inspector{display:block}}@media(prefers-reduced-motion:reduce){.gdu-shell *{animation-duration:.001ms!important;transition-duration:.001ms!important}.gdu-shell{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function activeFrame(document) {
    return document.frames.find((frame) => frame.id === document.activeFrameId) || document.frames[0];
  }

  function resolveVariable(documentState, key, fallback) {
    if (!key) return fallback;
    const mode = documentState.variables.activeMode || "default";
    for (const collection of documentState.variables.collections) {
      const variable = collection.values?.[key];
      if (!variable) continue;
      const value = variable[mode] ?? variable.default ?? Object.entries(variable).find(([name]) => name !== "type")?.[1];
      return value ?? fallback;
    }
    return documentState.brand.tokens[key] ?? fallback;
  }

  function layerFill(documentState, layer) {
    const bound = resolveVariable(documentState, layer.variableBindings?.fill, layer.fill);
    return layer.gradient ? `url(#gdu-gradient-${escapeHTML(layer.id)})` : safeColor(bound, layer.fill);
  }

  function layerFilter(layer) {
    const filters = [];
    for (const adjustment of layer.adjustments.filter((item) => item.enabled)) {
      if (adjustment.type === "brightness") filters.push(`brightness(${Math.max(0, 1 + adjustment.value / 100)})`);
      if (adjustment.type === "contrast") filters.push(`contrast(${Math.max(0, 1 + adjustment.value / 100)})`);
      if (adjustment.type === "saturation") filters.push(`saturate(${Math.max(0, 1 + adjustment.value / 100)})`);
      if (adjustment.type === "hue") filters.push(`hue-rotate(${adjustment.value}deg)`);
      if (adjustment.type === "exposure") filters.push(`brightness(${Math.max(0, 2 ** (adjustment.value / 100))})`);
      if (adjustment.type === "blur") filters.push(`blur(${Math.max(0, adjustment.value / 10)}px)`);
      if (adjustment.type === "grayscale") filters.push(`grayscale(${clamp(Math.abs(adjustment.value) / 100, 0, 1, 0)})`);
      if (adjustment.type === "sepia") filters.push(`sepia(${clamp(Math.abs(adjustment.value) / 100, 0, 1, 0)})`);
    }
    return filters.join(" ");
  }

  function layerTransform(layer) {
    const anchorX = layer.x + layer.width * layer.anchorX;
    const anchorY = layer.y + layer.height * layer.anchorY;
    return `rotate(${layer.rotation} ${anchorX} ${anchorY}) translate(${anchorX} ${anchorY}) skewX(${layer.skewX}) skewY(${layer.skewY}) translate(${-anchorX} ${-anchorY})`;
  }

  function polygonPoints(layer, count, innerRatio = 1) {
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const outer = Math.min(layer.width, layer.height) / 2;
    const points = [];
    const total = innerRatio < 1 ? count * 2 : count;
    for (let index = 0; index < total; index += 1) {
      const radius = innerRatio < 1 && index % 2 ? outer * innerRatio : outer;
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / total);
      points.push(`${centerX + Math.cos(angle) * radius},${centerY + Math.sin(angle) * radius}`);
    }
    return points.join(" ");
  }

  function layerSVG(layer) {
    const documentState = this;
    if (layer.type === "adjustment") return "";
    const selected = documentState.selectedLayerIds.includes(layer.id) ? " is-selected" : "";
    const filter = layerFilter(layer);
    const mask = layer.masks.find((item) => item.enabled);
    const attrs = [
      `data-gdu-layer="${escapeHTML(layer.id)}"`,
      `class="${selected.trim()}"`,
      `transform="${layerTransform(layer)}"`,
      `opacity="${layer.opacity}"`,
      `style="mix-blend-mode:${escapeHTML(layer.blendMode)}${filter ? `;filter:${escapeHTML(filter)}` : ""}"`,
      mask ? `clip-path="url(#gdu-mask-${escapeHTML(layer.id)}-${escapeHTML(mask.id)})"` : "",
      layer.locked ? `data-gdu-locked="true"` : ""
    ].filter(Boolean).join(" ");
    const stroke = layer.stroke === "none" ? "none" : escapeHTML(resolveVariable(documentState, layer.variableBindings?.stroke, layer.stroke));
    const common = `fill="${escapeHTML(layerFill(documentState, layer))}" stroke="${stroke}" stroke-width="${layer.strokeWidth}" stroke-linecap="${layer.strokeCap}" stroke-linejoin="${layer.strokeJoin}" ${layer.strokeDash.length ? `stroke-dasharray="${layer.strokeDash.join(" ")}"` : ""} ${layer.arrowStart ? 'marker-start="url(#gdu-arrow-start)"' : ""} ${layer.arrowEnd ? 'marker-end="url(#gdu-arrow-end)"' : ""}`;
    if (layer.type === "ellipse") return `<ellipse ${attrs} cx="${layer.x + layer.width / 2}" cy="${layer.y + layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" ${common}></ellipse>`;
    if (layer.type === "polygon") return `<polygon ${attrs} points="${polygonPoints(layer, clamp(layer.metadata?.sides, 3, 24, 6))}" ${common}></polygon>`;
    if (layer.type === "star") return `<polygon ${attrs} points="${polygonPoints(layer, clamp(layer.metadata?.points, 3, 24, 5), clamp(layer.metadata?.innerRatio, 0.1, 0.9, 0.45))}" ${common}></polygon>`;
    if (layer.type === "path") return `<path ${attrs} d="${escapeHTML(layer.pathData || pathFromPoints(layer.pathPoints, layer.pathClosed) || `M ${layer.x} ${layer.y} L ${layer.x + layer.width} ${layer.y + layer.height}`)}" ${common}></path>`;
    if (layer.type === "text") {
      const fontFamily = resolveVariable(documentState, layer.variableBindings?.fontFamily, layer.fontFamily);
      const fontSize = resolveVariable(documentState, layer.variableBindings?.fontSize, layer.fontSize);
      const textContent = escapeHTML(layer.text || "Text");
      if (layer.textPathLayerId) return `<text ${attrs} ${common} font-family="${escapeHTML(fontFamily)}" font-size="${fontSize}" font-weight="${layer.fontWeight}" letter-spacing="${layer.letterSpacing}"><textPath href="#gdu-text-path-${escapeHTML(layer.textPathLayerId)}" startOffset="0%">${textContent}</textPath></text>`;
      return `<text ${attrs} x="${layer.x}" y="${layer.y + Number(fontSize)}" ${common} font-family="${escapeHTML(fontFamily)}" font-size="${fontSize}" font-weight="${layer.fontWeight}" letter-spacing="${layer.letterSpacing}">${textContent}</text>`;
    }
    if (layer.type === "image") {
      const asset = documentState.assets.find((item) => item.id === layer.assetId);
      const href = layer.metadata?.objectUrl || asset?.thumbnail || layer.metadata?.dataUrl;
      if (href) return `<image ${attrs} href="${escapeHTML(href)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid slice"></image>`;
      return `<g ${attrs}><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius}" fill="#132238" stroke="#52677d" stroke-dasharray="8 6"></rect><text x="${layer.x + 16}" y="${layer.y + 30}" fill="#91a8bd" font-size="14">Asset chưa được liên kết</text></g>`;
    }
    if (["group", "component", "instance"].includes(layer.type)) {
      return `<rect ${attrs} x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius}" fill="${layer.type === "group" ? "rgba(99,232,255,.025)" : escapeHTML(layerFill(documentState, layer))}" stroke="${stroke === "none" ? "#63e8ff" : stroke}" stroke-width="${Math.max(1, layer.strokeWidth)}" stroke-dasharray="${layer.type === "group" ? "7 5" : ""}"></rect>`;
    }
    return `<rect ${attrs} x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius}" ${common}></rect>`;
  }

  function renderLayerDefinitions(documentState, layers) {
    const definitions = [];
    definitions.push(`<marker id="gdu-arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke"></path></marker>`);
    definitions.push(`<marker id="gdu-arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto-start-reverse"><path d="M8,0 L0,4 L8,8 z" fill="context-stroke"></path></marker>`);
    for (const layer of layers) {
      if (layer.gradient) {
        const stops = layer.gradient.stops.length ? layer.gradient.stops : [{ offset: 0, color: "#63e8ff", opacity: 1 }, { offset: 1, color: "#ff5fc8", opacity: 1 }];
        const markup = stops.map((stop) => `<stop offset="${stop.offset * 100}%" stop-color="${escapeHTML(stop.color)}" stop-opacity="${stop.opacity}"></stop>`).join("");
        if (layer.gradient.type === "radial" || layer.gradient.type === "mesh") definitions.push(`<radialGradient id="gdu-gradient-${escapeHTML(layer.id)}">${markup}</radialGradient>`);
        else definitions.push(`<linearGradient id="gdu-gradient-${escapeHTML(layer.id)}" gradientTransform="rotate(${layer.gradient.angle} .5 .5)">${markup}</linearGradient>`);
      }
      for (const mask of layer.masks.filter((item) => item.enabled)) {
        const shape = mask.type === "ellipse"
          ? `<ellipse cx="${mask.x + mask.width / 2}" cy="${mask.y + mask.height / 2}" rx="${mask.width / 2}" ry="${mask.height / 2}"></ellipse>`
          : mask.type === "path" && mask.pathData
            ? `<path d="${escapeHTML(mask.pathData)}"></path>`
            : `<rect x="${mask.x}" y="${mask.y}" width="${mask.width}" height="${mask.height}" rx="${mask.feather}"></rect>`;
        definitions.push(`<clipPath id="gdu-mask-${escapeHTML(layer.id)}-${escapeHTML(mask.id)}">${shape}</clipPath>`);
      }
      if (layer.type === "path") definitions.push(`<path id="gdu-text-path-${escapeHTML(layer.id)}" d="${escapeHTML(layer.pathData || pathFromPoints(layer.pathPoints, layer.pathClosed))}"></path>`);
    }
    return definitions.join("");
  }

  function selectionBounds(documentState) {
    const layers = documentState.layers.filter((layer) => documentState.selectedLayerIds.includes(layer.id) && layer.visible);
    if (!layers.length) return null;
    const x = Math.min(...layers.map((layer) => layer.x));
    const y = Math.min(...layers.map((layer) => layer.y));
    const right = Math.max(...layers.map((layer) => layer.x + layer.width));
    const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
    return { x, y, width: right - x, height: bottom - y, layers };
  }

  function renderSelection(documentState) {
    const bounds = selectionBounds(documentState);
    if (!bounds) return "";
    const size = 12;
    const points = [
      ["nw", bounds.x, bounds.y],
      ["n", bounds.x + bounds.width / 2, bounds.y],
      ["ne", bounds.x + bounds.width, bounds.y],
      ["e", bounds.x + bounds.width, bounds.y + bounds.height / 2],
      ["se", bounds.x + bounds.width, bounds.y + bounds.height],
      ["s", bounds.x + bounds.width / 2, bounds.y + bounds.height],
      ["sw", bounds.x, bounds.y + bounds.height],
      ["w", bounds.x, bounds.y + bounds.height / 2]
    ];
    return `<g class="gdu-selection-ui" pointer-events="none"><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="#63e8ff" stroke-width="2" stroke-dasharray="${bounds.layers.length > 1 ? "8 5" : ""}"></rect><line x1="${bounds.x + bounds.width / 2}" y1="${bounds.y}" x2="${bounds.x + bounds.width / 2}" y2="${bounds.y - 32}" stroke="#63e8ff" stroke-width="2"></line>${points.map(([name, x, y]) => `<rect data-gdu-handle="${name}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="3" fill="#07101d" stroke="#63e8ff" stroke-width="2" pointer-events="all"></rect>`).join("")}<circle data-gdu-handle="rotate" cx="${bounds.x + bounds.width / 2}" cy="${bounds.y - 40}" r="7" fill="#ff5fc8" stroke="#fff" stroke-width="2" pointer-events="all"></circle><circle data-gdu-handle="anchor" cx="${bounds.x + bounds.width / 2}" cy="${bounds.y + bounds.height / 2}" r="5" fill="#c9f26f" stroke="#07101d" stroke-width="2" pointer-events="all"></circle></g>`;
  }

  function renderRulers(documentState, frame) {
    if (!documentState.canvas.rulersVisible) return "";
    const step = Math.max(20, documentState.canvas.grid * 5);
    const horizontal = [];
    const vertical = [];
    for (let value = 0; value <= frame.width; value += step) horizontal.push(`<g><line x1="${value}" y1="0" x2="${value}" y2="10"></line><text x="${value + 3}" y="22">${value}</text></g>`);
    for (let value = 0; value <= frame.height; value += step) vertical.push(`<g><line x1="0" y1="${value}" x2="10" y2="${value}"></line><text x="13" y="${value + 4}">${value}</text></g>`);
    return `<g class="gdu-rulers" pointer-events="none"><g class="gdu-ruler-x">${horizontal.join("")}</g><g class="gdu-ruler-y">${vertical.join("")}</g></g>`;
  }

  function renderCanvas(documentState, zoom) {
    const frame = activeFrame(documentState);
    if (!frame) return `<div class="gdu-empty">Chưa có frame để hiển thị.</div>`;
    const layers = documentState.layers.filter((layer) => layer.frameId === frame.id && layer.visible);
    const grid = documentState.canvas.grid;
    const width = Math.max(320, Math.round(frame.width * zoom));
    const guides = documentState.canvas.guides.map((guide) => guide.axis === "x"
      ? `<line data-gdu-guide="${escapeHTML(guide.id)}" x1="${guide.position}" y1="0" x2="${guide.position}" y2="${frame.height}" class="gdu-guide"></line>`
      : `<line data-gdu-guide="${escapeHTML(guide.id)}" x1="0" y1="${guide.position}" x2="${frame.width}" y2="${guide.position}" class="gdu-guide"></line>`).join("");
    return `<svg data-gdu-canvas viewBox="0 0 ${frame.width} ${frame.height}" width="${width}" height="${Math.max(180, Math.round(frame.height * zoom))}" role="application" tabindex="0" aria-label="${escapeHTML(frame.name)}"><defs><pattern id="gdu-grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M ${grid} 0 L 0 0 0 ${grid}" fill="none" stroke="rgba(127,199,255,.09)" stroke-width="1"></path></pattern>${renderLayerDefinitions(documentState, layers)}</defs><rect data-gdu-canvas-background x="0" y="0" width="${frame.width}" height="${frame.height}" fill="${escapeHTML(frame.background)}"></rect>${documentState.canvas.gridVisible ? `<rect x="0" y="0" width="${frame.width}" height="${frame.height}" fill="url(#gdu-grid)" pointer-events="none"></rect>` : ""}${renderRulers(documentState, frame)}${layers.map(layerSVG.bind(documentState)).join("")}${guides}${renderSelection(documentState)}</svg>`;
  }

  function field(name, label, value, options = {}) {
    const type = options.type || "number";
    const attributes = [
      options.min != null ? `min="${options.min}"` : "",
      options.max != null ? `max="${options.max}"` : "",
      options.step != null ? `step="${options.step}"` : "",
      options.disabled ? "disabled" : ""
    ].filter(Boolean).join(" ");
    return `<label class="gdu-field"><span>${escapeHTML(label)}</span><input type="${type}" data-gdu-field="${escapeHTML(name)}" value="${escapeHTML(value)}" ${attributes}></label>`;
  }

  function renderLayerTree(documentState, frame) {
    const layers = documentState.layers.filter((layer) => layer.frameId === frame?.id).slice().reverse();
    if (!layers.length) return `<div class="gdu-empty">Chưa có layer.</div>`;
    return `<div class="gdu-layer-tree" role="tree">${layers.map((layer, index) => `<div class="gdu-layer-row ${documentState.selectedLayerIds.includes(layer.id) ? "is-selected" : ""}" role="treeitem" aria-selected="${documentState.selectedLayerIds.includes(layer.id)}" style="--layer-depth:${layer.parentId ? 1 : 0}"><button type="button" class="gdu-layer-toggle" data-gdu-toggle-layer="${escapeHTML(layer.id)}" data-gdu-toggle-field="visible" title="${layer.visible ? "Ẩn" : "Hiện"} layer">${layer.visible ? "◉" : "○"}</button><button type="button" class="gdu-layer-main" data-gdu-layer-button="${escapeHTML(layer.id)}" data-gdu-layer-index="${index}"><span>${escapeHTML(({ rect: "▰", ellipse: "●", text: "T", image: "▧", path: "⌁", group: "◇", component: "◫", instance: "◧", adjustment: "◐" })[layer.type] || "◆")}</span><b>${escapeHTML(layer.name)}</b><small>${escapeHTML(layer.type)}</small></button><button type="button" class="gdu-layer-toggle" data-gdu-toggle-layer="${escapeHTML(layer.id)}" data-gdu-toggle-field="locked" title="${layer.locked ? "Mở khóa" : "Khóa"}">${layer.locked ? "◆" : "◇"}</button></div>`).join("")}</div>`;
  }

  function renderTransformInspector(selected, documentState) {
    if (!selected) return `<div class="gdu-empty">Chọn một hoặc nhiều layer để chỉnh.</div>`;
    const multiple = documentState.selectedLayerIds.length > 1;
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Transform</strong><span>${multiple ? `${documentState.selectedLayerIds.length} layers` : escapeHTML(selected.type)}</span></div><label class="gdu-field"><span>Tên layer</span><input data-gdu-field="name" value="${escapeHTML(selected.name)}" ${multiple ? "disabled" : ""}></label><div class="gdu-field-grid">${field("x", "X", selected.x, { step: 1 })}${field("y", "Y", selected.y, { step: 1 })}${field("width", "W", selected.width, { min: 1 })}${field("height", "H", selected.height, { min: 1 })}${field("rotation", "Xoay", selected.rotation, { step: 0.5 })}${field("opacity", "Opacity", selected.opacity, { min: 0, max: 1, step: 0.01 })}${field("skewX", "Skew X", selected.skewX, { min: -89, max: 89, step: 0.5 })}${field("skewY", "Skew Y", selected.skewY, { min: -89, max: 89, step: 0.5 })}${field("anchorX", "Anchor X", selected.anchorX, { min: 0, max: 1, step: 0.01 })}${field("anchorY", "Anchor Y", selected.anchorY, { min: 0, max: 1, step: 0.01 })}</div><div class="gdu-button-grid"><button type="button" data-gdu-command="lock">${selected.locked ? "Mở khóa" : "Khóa"}</button><button type="button" data-gdu-command="hide">${selected.visible ? "Ẩn" : "Hiện"}</button><button type="button" data-gdu-command="group">Nhóm</button><button type="button" data-gdu-command="ungroup">Bỏ nhóm</button></div></section>`;
  }

  function renderDesignPanel(documentState, selected) {
    const frame = activeFrame(documentState);
    return `${renderTransformInspector(selected, documentState)}<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Professional Canvas</strong><span>${escapeHTML(documentState.canvas.quality)}</span></div><div class="gdu-toggle-grid"><label><input type="checkbox" data-gdu-canvas-setting="gridVisible" ${documentState.canvas.gridVisible ? "checked" : ""}> Grid</label><label><input type="checkbox" data-gdu-canvas-setting="snap" ${documentState.canvas.snap ? "checked" : ""}> Snap</label><label><input type="checkbox" data-gdu-canvas-setting="smartGuides" ${documentState.canvas.smartGuides ? "checked" : ""}> Smart guide</label><label><input type="checkbox" data-gdu-canvas-setting="rulersVisible" ${documentState.canvas.rulersVisible ? "checked" : ""}> Ruler</label></div><div class="gdu-field-grid">${field("canvas-grid", "Grid", documentState.canvas.grid, { min: 1, max: 128 })}${field("frame-width", "Frame W", frame?.width || 0, { min: 1 })}${field("frame-height", "Frame H", frame?.height || 0, { min: 1 })}</div><div class="gdu-button-grid"><button type="button" data-gdu-command="guide-x">+ Guide X</button><button type="button" data-gdu-command="guide-y">+ Guide Y</button><button type="button" data-gdu-command="fit">Fit canvas</button><button type="button" data-gdu-command="zoom-selection">Zoom selection</button><button type="button" data-gdu-command="presentation">Trình chiếu</button><button type="button" data-gdu-command="command-palette">Command palette</button></div></section><section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Auto Layout</strong><span>${selected?.autoLayout.enabled ? "Sẵn sàng" : "Tắt"}</span></div>${selected ? `<div class="gdu-button-grid"><button type="button" data-gdu-command="auto-layout-v">Dọc</button><button type="button" data-gdu-command="auto-layout-h">Ngang</button><button type="button" data-gdu-command="auto-layout-wrap">Wrap</button><button type="button" data-gdu-command="auto-layout-off">Tắt</button></div><div class="gdu-field-grid">${field("layout-gap", "Gap", selected.autoLayout.gap, { min: 0 })}${field("layout-padding", "Padding", selected.autoLayout.paddingTop, { min: 0 })}</div>` : `<div class="gdu-empty">Chọn group hoặc component.</div>`}</section>`;
  }

  function renderVectorPanel(documentState, selected) {
    const paths = documentState.layers.filter((layer) => layer.frameId === documentState.activeFrameId && layer.type === "path");
    return `${renderTransformInspector(selected, documentState)}<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Vector Forge</strong><span>Sẵn sàng</span></div><div class="gdu-button-grid"><button type="button" data-gdu-command="pen">Pen Tool (P)</button><button type="button" data-gdu-command="add-polygon">Polygon</button><button type="button" data-gdu-command="add-star">Star</button><button type="button" data-gdu-command="shape-builder">Shape Builder</button></div><div class="gdu-button-grid"><button type="button" data-gdu-boolean="union">Union</button><button type="button" data-gdu-boolean="subtract">Subtract</button><button type="button" data-gdu-boolean="intersect">Intersect</button><button type="button" data-gdu-boolean="exclude">Exclude</button></div>${selected ? `<div class="gdu-field-grid">${field("strokeWidth", "Stroke", selected.strokeWidth, { min: 0, max: 80, step: 0.5 })}${field("cornerRadius", "Radius", selected.cornerRadius, { min: 0 })}</div><div class="gdu-color-row"><label>Fill<input type="color" data-gdu-field="fill" value="${safeColor(selected.fill, "#63e8ff")}"></label><label>Stroke<input type="color" data-gdu-field="stroke" value="${safeColor(selected.stroke, "#63e8ff")}"></label></div><div class="gdu-button-grid"><button type="button" data-gdu-command="gradient-linear">Linear gradient</button><button type="button" data-gdu-command="gradient-radial">Radial gradient</button><button type="button" data-gdu-command="toggle-arrow">Arrow end</button><button type="button" data-gdu-command="text-on-path" ${paths.length ? "" : "disabled"}>Text on path</button></div>` : ""}<button type="button" class="gdu-wide" data-gdu-route="vector">Mở Vector & Motion Core đầy đủ →</button></section>`;
  }

  function renderRasterPanel(documentState, selected) {
    const imageLayer = selected?.type === "image" ? selected : null;
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Raster Lab</strong><span>${globalThis.OffscreenCanvas ? "Worker/Canvas sẵn sàng" : "Canvas2D fallback"}</span></div><div class="gdu-button-grid"><button type="button" data-gdu-command="import-image">Nhập ảnh</button><button type="button" data-gdu-command="mask-rect" ${imageLayer ? "" : "disabled"}>Layer mask</button><button type="button" data-gdu-command="mask-ellipse" ${imageLayer ? "" : "disabled"}>Ellipse mask</button><button type="button" data-gdu-command="alpha-lock" ${imageLayer ? "" : "disabled"}>Alpha lock</button></div><div class="gdu-button-grid"><button type="button" data-gdu-adjustment="brightness" ${imageLayer ? "" : "disabled"}>Brightness</button><button type="button" data-gdu-adjustment="contrast" ${imageLayer ? "" : "disabled"}>Contrast</button><button type="button" data-gdu-adjustment="saturation" ${imageLayer ? "" : "disabled"}>Saturation</button><button type="button" data-gdu-adjustment="hue" ${imageLayer ? "" : "disabled"}>Hue</button><button type="button" data-gdu-adjustment="blur" ${imageLayer ? "" : "disabled"}>Smart Blur</button><button type="button" data-gdu-command="before-after" ${imageLayer ? "" : "disabled"}>Before / After</button></div>${imageLayer ? `<div class="gdu-adjustments">${imageLayer.adjustments.map((adjustment) => `<label><span>${escapeHTML(adjustment.type)}</span><input type="range" min="-100" max="100" value="${adjustment.value}" data-gdu-adjustment-value="${escapeHTML(adjustment.id)}"><button type="button" data-gdu-remove-adjustment="${escapeHTML(adjustment.id)}">×</button></label>`).join("") || `<div class="gdu-empty">Chưa có Smart Filter.</div>`}</div>` : `<div class="gdu-empty">Chọn một image layer để chỉnh không phá hủy.</div>`}<button type="button" class="gdu-wide" data-gdu-route="nondestructive">Mở Non-destructive Editor đầy đủ →</button></section>`;
  }

  function renderTypographyPanel(documentState, selected) {
    const pathLayers = documentState.layers.filter((layer) => layer.type === "path");
    return `${renderTransformInspector(selected, documentState)}<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Typography Observatory</strong><span>${document.fonts?.check ? "Font API sẵn sàng" : "Font fallback"}</span></div>${selected?.type === "text" ? `<label class="gdu-field"><span>Nội dung</span><textarea data-gdu-field="text">${escapeHTML(selected.text)}</textarea></label><label class="gdu-field"><span>Font family</span><input data-gdu-field="fontFamily" value="${escapeHTML(selected.fontFamily)}"></label><div class="gdu-field-grid">${field("fontSize", "Size", selected.fontSize, { min: 6, max: 320 })}${field("fontWeight", "Weight", selected.fontWeight, { min: 100, max: 900, step: 50 })}${field("lineHeight", "Line height", selected.lineHeight, { min: 0.5, max: 4, step: 0.05 })}${field("letterSpacing", "Tracking", selected.letterSpacing, { min: -40, max: 200, step: 0.5 })}</div><label class="gdu-field"><span>Text path</span><select data-gdu-text-path><option value="">Không dùng</option>${pathLayers.map((path) => `<option value="${escapeHTML(path.id)}" ${selected.textPathLayerId === path.id ? "selected" : ""}>${escapeHTML(path.name)}</option>`).join("")}</select></label>` : `<div class="gdu-empty">Chọn text layer.</div>`}<button type="button" class="gdu-wide" data-gdu-route="typography">Mở Typography Pro →</button></section>`;
  }

  function renderBrandPanel(documentState, selected) {
    const collection = documentState.variables.collections[0];
    const mode = documentState.variables.activeMode;
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Brand System</strong><span>${escapeHTML(mode)}</span></div><label class="gdu-field"><span>Variable mode</span><select data-gdu-variable-mode>${collection.modes.map((item) => `<option value="${escapeHTML(item)}" ${item === mode ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}</select></label><div class="gdu-variable-list">${Object.entries(collection.values).slice(0, 20).map(([key, variable]) => `<div><code>${escapeHTML(key)}</code><span>${escapeHTML(variable[mode] ?? variable.default ?? "—")}</span><button type="button" data-gdu-bind-variable="${escapeHTML(key)}" ${selected ? "" : "disabled"}>Bind</button></div>`).join("")}</div><div class="gdu-inline-form"><input data-gdu-variable-key placeholder="token.name"><input data-gdu-variable-value placeholder="#63e8ff"><button type="button" data-gdu-command="add-variable">Thêm</button></div><div class="gdu-button-grid"><button type="button" data-gdu-command="create-component" ${documentState.selectedLayerIds.length ? "" : "disabled"}>Tạo component</button><button type="button" data-gdu-command="create-instance" ${documentState.components.length ? "" : "disabled"}>Tạo instance</button><button type="button" data-gdu-command="add-variant" ${documentState.components.length ? "" : "disabled"}>Thêm variant</button><button type="button" data-gdu-command="export-tokens">Xuất tokens</button></div><div class="gdu-component-list">${documentState.components.slice(-6).map((component) => `<button type="button" data-gdu-component="${escapeHTML(component.id)}"><b>${escapeHTML(component.name)}</b><small>${component.variants.length} variants</small></button>`).join("") || `<div class="gdu-empty">Chưa có component.</div>`}</div></section>`;
  }

  function renderMotionPanel(documentState, selected) {
    const frames = documentState.frames.filter((frame) => frame.id !== documentState.activeFrameId);
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Prototype & Motion</strong><span>${documentState.timeline.fps} FPS</span></div><div class="gdu-field-grid">${field("timeline-duration", "Duration", documentState.timeline.duration, { min: 0.1, max: 3600, step: 0.1 })}${field("timeline-time", "Playhead", documentState.timeline.currentTime, { min: 0, max: documentState.timeline.duration, step: 0.01 })}</div><div class="gdu-button-grid"><button type="button" data-gdu-command="play-motion">${documentState.timeline.playing ? "Dừng" : "Phát"}</button><button type="button" data-gdu-keyframe="x" ${selected ? "" : "disabled"}>Key X</button><button type="button" data-gdu-keyframe="y" ${selected ? "" : "disabled"}>Key Y</button><button type="button" data-gdu-keyframe="rotation" ${selected ? "" : "disabled"}>Key Rotation</button><button type="button" data-gdu-keyframe="opacity" ${selected ? "" : "disabled"}>Key Opacity</button><button type="button" data-gdu-command="prototype-action" ${selected && frames.length ? "" : "disabled"}>+ Navigate</button></div><div class="gdu-timeline-mini">${documentState.timeline.keyframes.slice(-30).map((keyframe) => `<button type="button" data-gdu-keyframe-id="${escapeHTML(keyframe.id)}" style="left:${Math.min(100, keyframe.time / documentState.timeline.duration * 100)}%" title="${escapeHTML(keyframe.property)} · ${keyframe.time}s"></button>`).join("")}<i style="left:${Math.min(100, documentState.timeline.currentTime / documentState.timeline.duration * 100)}%"></i></div><div class="gdu-status-list"><span>Prototype actions <b>${documentState.prototype.actions.length}</b></span><span>Keyframes <b>${documentState.timeline.keyframes.length}</b></span><span>WebCodecs <b>${globalThis.VideoEncoder ? "Sẵn sàng" : "Thiết bị không hỗ trợ"}</b></span></div><div class="gdu-button-grid"><button type="button" data-gdu-route="prototype">Prototype Studio</button><button type="button" data-gdu-route="motion">Motion Studio</button><button type="button" data-gdu-route="quick-motion">Quick Motion</button></div></section>`;
  }

  function renderAssetsPanel(documentState) {
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Asset Observatory</strong><span>IndexedDB · ${documentState.assets.length}/${MAX_ASSETS}</span></div><div class="gdu-button-grid"><button type="button" data-gdu-command="import-asset">Tải asset</button><button type="button" data-gdu-command="relink-asset">Relink gần nhất</button><button type="button" data-gdu-command="asset-search">Tìm asset</button><button type="button" data-gdu-route="projects">Project Store</button></div><input class="gdu-search" data-gdu-asset-search placeholder="Tìm theo tên, tag, loại file..."><div class="gdu-asset-grid">${documentState.assets.slice().reverse().slice(0, 30).map((asset) => `<article data-gdu-asset-card="${escapeHTML(asset.id)}">${asset.thumbnail ? `<img src="${escapeHTML(asset.thumbnail)}" alt="">` : `<span>${escapeHTML(({ image: "▧", video: "▶", audio: "♫", vector: "⌁" })[asset.kind] || "◆")}</span>`}<div><b>${escapeHTML(asset.name)}</b><small>${escapeHTML(asset.kind)} · v${asset.version} · ${Math.round(asset.size / 1024)} KB</small><em data-status="${escapeHTML(asset.status)}">${escapeHTML(asset.status)}</em></div><button type="button" data-gdu-use-asset="${escapeHTML(asset.id)}">Dùng</button><button type="button" data-gdu-relink-asset="${escapeHTML(asset.id)}">Relink</button><button type="button" data-gdu-remove-asset="${escapeHTML(asset.id)}">×</button></article>`).join("") || `<div class="gdu-empty">Chưa có asset. File thật sẽ được lưu trong IndexedDB.</div>`}</div></section>`;
  }

  function renderAIJob(job) {
    if (!job) return `<div class="gdu-empty">Chưa có AI job.</div>`;
    return `<article class="gdu-job-card" data-gdu-job><header><b>${escapeHTML(job.operation || job.kind)}</b><span data-status="${escapeHTML(job.status)}">${escapeHTML(job.status)}</span></header><p>${escapeHTML(job.output || job.error || job.input || "Đang xử lý...")}</p><footer><span>${escapeHTML(job.provider)} · ${escapeHTML(job.model)}</span><span>${job.latencyMs ? `${job.latencyMs}ms` : ""}</span></footer>${job.status === "completed" && (job.structured || job.resultAssetIds?.length) ? `<button type="button" data-gdu-apply-ai="${escapeHTML(job.id)}">Xem diff và áp dụng</button>` : ""}${["running", "queued"].includes(job.status) ? `<button type="button" data-gdu-cancel-ai="${escapeHTML(job.id)}">Hủy</button>` : ""}${job.status === "failed" ? `<button type="button" data-gdu-retry-ai="${escapeHTML(job.id)}">Thử lại</button>` : ""}</article>`;
  }

  function renderAIPanel(documentState, jobs) {
    const providerStatus = jobs[0]?.status === "failed" && /chưa cấu hình|not configured|403/i.test(jobs[0].error || "") ? "Chưa cấu hình provider" : "Backend provider";
    return `<section class="gdu-panel-section gdu-ai-panel" data-gdu-ai-panel><div class="gdu-panel-title"><strong>Design AI Copilot</strong><span>${escapeHTML(providerStatus)}</span></div><textarea data-gdu-ai-input placeholder="Mô tả layout, hình ảnh hoặc thay đổi cần thực hiện..."></textarea><div class="gdu-ai-controls"><select data-gdu-ai-operation><option value="plan">Tạo layout A/B</option><option value="image">Generate Image</option><option value="inpaint">Inpaint vùng chọn</option><option value="outpaint">Outpaint canvas</option><option value="remove">Xóa vật thể</option><option value="harmonize">Harmonize ánh sáng</option><option value="recolor">Recolor theo Brand Kit</option><option value="responsive">Tạo responsive variants</option><option value="alt-text">Tạo alt text</option><option value="audit">Phân tích bố cục</option></select><button type="button" class="gdu-primary" data-gdu-ai-run>Chạy AI</button></div><p class="gdu-help">AI chỉ chạy khi bạn bấm. Kết quả được lưu thành job, asset hoặc layer và có thể undo/restore.</p><div class="gdu-job-list">${jobs.slice(0, 4).map(renderAIJob).join("") || renderAIJob(null)}</div></section>`;
  }

  function renderHealthPanel(documentState, health) {
    return `<section class="gdu-panel-section gdu-health-panel"><div class="gdu-panel-title"><strong>Design Health</strong><span>${health.summary.errors} lỗi · ${health.summary.warnings} cảnh báo</span></div><div class="gdu-health-score"><b>${Math.max(0, 100 - health.summary.errors * 18 - health.summary.warnings * 5)}</b><span>/100</span></div><div class="gdu-issue-list">${health.issues.slice(0, 40).map((issue) => `<article data-severity="${issue.severity}"><button type="button" data-gdu-select-issue="${escapeHTML(issue.id)}"><b>${escapeHTML(issue.message)}</b><small>${escapeHTML(issue.severity)}</small></button>${/^(contrast|alt|touch|overflow)-/.test(issue.id) ? `<button type="button" data-gdu-fix-issue="${escapeHTML(issue.id)}">Sửa tự động</button>` : ""}</article>`).join("") || `<div class="gdu-success">Không có lỗi chặn export.</div>`}</div><div class="gdu-button-grid"><button type="button" data-gdu-command="scan">Quét lại</button><button type="button" data-gdu-command="fix-all-health">Sửa lỗi có thể tự động</button><button type="button" data-gdu-command="preflight">Export preflight</button></div></section>`;
  }

  function renderExportPanel(documentState, health) {
    const selected = documentState.layers.find((layer) => layer.id === documentState.selectedLayerId);
    return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>Export & Dev Handoff</strong><span>${health.ok ? "Sẵn sàng" : "Cần preflight"}</span></div><div class="gdu-button-grid"><button type="button" data-gdu-export="json">.hhdesign</button><button type="button" data-gdu-export="svg">SVG</button><button type="button" data-gdu-export="png">PNG</button><button type="button" data-gdu-export="png-2x">PNG 2×</button><button type="button" data-gdu-export="png-3x">PNG 3×</button><button type="button" data-gdu-export="tokens-json">Tokens JSON</button><button type="button" data-gdu-export="tokens-css">CSS variables</button><button type="button" data-gdu-export="react" ${selected ? "" : "disabled"}>React component</button></div>${selected ? `<div class="gdu-code-preview"><header><b>Inspect · ${escapeHTML(selected.name)}</b><button type="button" data-gdu-command="copy-css">Copy CSS</button></header><pre>${escapeHTML(`width: ${selected.width}px;\nheight: ${selected.height}px;\ntransform: translate(${selected.x}px, ${selected.y}px) rotate(${selected.rotation}deg);\nopacity: ${selected.opacity};\nbackground: ${selected.fill};`)}</pre></div>` : ""}<label class="gdu-ready"><input type="checkbox" data-gdu-ready-dev ${documentState.status === "approved" ? "checked" : ""}> Ready for Development</label><div class="gdu-status-list"><span>Responsive frames <b>${documentState.frames.length}</b></span><span>Variables <b>${documentState.variables.collections.reduce((sum, item) => sum + Object.keys(item.values).length, 0)}</b></span><span>Assets <b>${documentState.assets.length}</b></span><span>Health <b>${health.ok ? "Pass" : "Blocked"}</b></span></div><button type="button" class="gdu-wide" data-gdu-route="export">Mở Export Center →</button></section>`;
  }

  function renderFocusPanel(documentState, focus, selected, health, jobs) {
    if (focus === "vector") return renderVectorPanel(documentState, selected);
    if (focus === "raster") return renderRasterPanel(documentState, selected);
    if (focus === "type") return renderTypographyPanel(documentState, selected);
    if (focus === "brand") return renderBrandPanel(documentState, selected);
    if (focus === "motion") return renderMotionPanel(documentState, selected);
    if (focus === "assets") return renderAssetsPanel(documentState);
    if (focus === "ai") return renderAIPanel(documentState, jobs);
    if (focus === "qa") return renderHealthPanel(documentState, health);
    if (focus === "export") return renderExportPanel(documentState, health);
    if (focus === "3d") return `<section class="gdu-panel-section"><div class="gdu-panel-title"><strong>3D Nebula</strong><span>${globalThis.WebGL2RenderingContext ? "WebGL sẵn sàng" : "Thiết bị không hỗ trợ"}</span></div><p class="gdu-help">Import GLB/GLTF, camera, light, PBR material và render PNG/WebM hoạt động trong engine 3D chuyên dụng.</p><div class="gdu-button-grid"><button type="button" data-gdu-route="3d">Mở 3D Studio</button><button type="button" data-gdu-route="mockup">Device Mockup</button><button type="button" data-gdu-route="composer">Scene Composer</button></div></section>`;
    return renderDesignPanel(documentState, selected);
  }

  function renderShell(documentState, mode, focus, zoom = 1, compact = false, presentation = false) {
    const frame = activeFrame(documentState);
    const selected = documentState.layers.find((layer) => layer.id === documentState.selectedLayerId);
    const activePlanet = PLANETS.find((planet) => planet.id === focus) || PLANETS[0];
    const jobs = documentState.jobs.slice().reverse();
    const health = runHealthScan(documentState);
    const galaxy = galaxyProfile();
    return `<section class="gdu-shell" data-gdu-shell data-gdu-mode="${escapeHTML(mode)}" data-gdu-motion="${escapeHTML(galaxy.motion)}" data-gdu-compact="${compact}" style="--planet-tone:${activePlanet.tone};--gdu-cyan:${galaxy.primary};--gdu-pink:${galaxy.secondary}">
      <header class="gdu-top"><div class="gdu-document-title"><span class="gdu-live-dot"></span><div><h3>HH Design Professional</h3><p>${escapeHTML(documentState.name)} · nhánh ${escapeHTML(documentState.branch)} · ${documentState.layers.length} layer · ${documentState.assets.length} asset · command log ${documentState.commandLog.length}</p></div></div><div class="gdu-top-actions"><button type="button" data-gdu-command="toggle-shell">${compact ? "Mở Professional Canvas" : "Thu gọn Canvas"}</button><button type="button" data-gdu-command="undo" aria-label="Hoàn tác" ${documentState.history.past.length ? "" : "disabled"}>↶</button><button type="button" data-gdu-command="redo" aria-label="Làm lại" ${documentState.history.future.length ? "" : "disabled"}>↷</button><button type="button" data-gdu-command="add-frame">＋ Frame</button><button type="button" data-gdu-command="save">Lưu</button><button type="button" class="gdu-primary" data-gdu-command="export">Xuất .hhdesign</button></div></header>
      <div class="gdu-layout">
        <nav class="gdu-planets" aria-label="Design planets">${PLANETS.map((planet) => `<button type="button" class="gdu-planet ${planet.id === activePlanet.id ? "is-active" : ""}" data-gdu-planet="${planet.id}" style="--planet-tone:${planet.tone}" title="${escapeHTML(planet.description)}"><i aria-hidden="true"></i><span><b>${escapeHTML(planet.label)}</b><small>${escapeHTML(planet.description)}</small></span></button>`).join("")}</nav>
        <section class="gdu-lab"><div class="gdu-toolbar" role="toolbar" aria-label="Công cụ canvas"><div class="gdu-tool-group"><button type="button" class="${documentState.settings.activeTool === "select" || !documentState.settings.activeTool ? "is-active" : ""}" data-gdu-tool="select" title="Select (V)">V</button><button type="button" class="${documentState.settings.activeTool === "pen" ? "is-active" : ""}" data-gdu-tool="pen" title="Pen (P)">P</button><button type="button" data-gdu-tool="text" title="Text (T)">T</button><button type="button" data-gdu-tool="rect" title="Rectangle (R)">R</button><button type="button" data-gdu-tool="ellipse" title="Ellipse (E)">E</button></div><div class="gdu-tool-group"><button type="button" data-gdu-align="left" title="Căn trái">⇤</button><button type="button" data-gdu-align="center-x" title="Căn giữa ngang">↔</button><button type="button" data-gdu-align="right" title="Căn phải">⇥</button><button type="button" data-gdu-align="top" title="Căn trên">↥</button><button type="button" data-gdu-align="center-y" title="Căn giữa dọc">↕</button><button type="button" data-gdu-align="bottom" title="Căn dưới">↧</button><button type="button" data-gdu-distribute="x" title="Phân bố ngang">⫼</button><button type="button" data-gdu-distribute="y" title="Phân bố dọc">⋮</button><button type="button" data-gdu-command="tidy" title="Tidy up">▦</button></div><div class="gdu-tool-group"><button type="button" data-gdu-command="duplicate" title="Duplicate (Ctrl/Cmd+D)">Duplicate</button><button type="button" data-gdu-command="remove" title="Delete">Delete</button></div><span class="gdu-spacer"></span><div class="gdu-tool-group"><button type="button" data-gdu-command="zoom-out">−</button><button type="button" data-gdu-command="fit" data-gdu-zoom>${Math.round(zoom * 100)}%</button><button type="button" data-gdu-command="zoom-in">＋</button></div><select data-gdu-mode aria-label="Chế độ hiển thị"><option value="studio" ${mode === "studio" ? "selected" : ""}>Studio</option><option value="galaxy" ${mode === "galaxy" ? "selected" : ""}>Galaxy</option><option value="focus" ${mode === "focus" ? "selected" : ""}>Focus</option></select></div><div class="gdu-canvas-meta"><span>${escapeHTML(frame?.name || "No frame")} · ${frame?.width || 0}×${frame?.height || 0}</span><span data-gdu-fps>FPS đang đo</span><span>Quality ${escapeHTML(documentState.canvas.quality)}</span><span>${documentState.selectedLayerIds.length} selected</span></div><div class="gdu-stage" data-gdu-stage data-gdu-tool="${escapeHTML(documentState.settings.activeTool || "select")}"><div class="gdu-canvas-space" data-gdu-canvas-space>${renderCanvas(documentState, zoom)}<div class="gdu-marquee" data-gdu-marquee hidden></div><div class="gdu-smart-guide gdu-smart-guide-x" data-gdu-smart-x hidden></div><div class="gdu-smart-guide gdu-smart-guide-y" data-gdu-smart-y hidden></div></div></div><details class="gdu-layers-drawer" open><summary>Scene graph · ${documentState.layers.filter((layer) => layer.frameId === frame?.id).length} layers</summary>${renderLayerTree(documentState, frame)}</details></section>
        <aside class="gdu-inspector"><header><h4>${escapeHTML(activePlanet.label)}</h4><p>${escapeHTML(activePlanet.description)}</p></header><div class="gdu-inspector-scroll">${renderFocusPanel(documentState, activePlanet.id, selected, health, jobs)}</div></aside>
      </div><footer class="gdu-footer"><span><b>${escapeHTML(activePlanet.label)}</b> · ${escapeHTML(activePlanet.description)}</span><span>Scene graph JSON · IndexedDB asset · command log dạng patch</span><span data-gdu-status>Đã lưu local-first · ${escapeHTML(documentState.updatedAt)}</span></footer><div class="gdu-toast" data-gdu-toast hidden role="status" aria-live="polite"></div><div class="gdu-context-menu" data-gdu-context-menu hidden><button type="button" data-gdu-command="duplicate">Nhân bản</button><button type="button" data-gdu-command="group">Nhóm</button><button type="button" data-gdu-command="lock">Khóa/Mở khóa</button><button type="button" data-gdu-command="hide">Ẩn/Hiện</button><button type="button" data-gdu-command="create-component">Tạo component</button><button type="button" data-gdu-command="remove">Xóa</button></div><dialog class="gdu-command-dialog" data-gdu-command-dialog><form method="dialog"><header><strong>Command Palette</strong><button value="close" aria-label="Đóng">×</button></header><input data-gdu-command-search autofocus placeholder="Tìm lệnh hoặc workspace…"><div class="gdu-command-list">${[
        ["add-rect", "Tạo rectangle", "R"],
        ["add-text", "Tạo text", "T"],
        ["pen", "Bật Pen Tool", "P"],
        ["group", "Nhóm layer", "Ctrl/Cmd+G"],
        ["create-component", "Tạo component", "Alt+Ctrl/Cmd+K"],
        ["fit", "Fit canvas", "Shift+1"],
        ["zoom-selection", "Zoom to selection", "Shift+2"],
        ["presentation", "Presentation mode", "Shift+Enter"],
        ["scan", "Quét Design Health", ""],
        ["export", "Xuất .hhdesign", ""]
      ].map(([command, label, shortcut]) => `<button type="button" data-gdu-palette-command="${command}"><b>${label}</b><kbd>${shortcut}</kbd></button>`).join("")}</div></form></dialog><div class="gdu-presentation" data-gdu-presentation ${presentation ? "" : "hidden"}><button type="button" data-gdu-command="presentation-close">Đóng trình chiếu</button><div>${renderCanvas({ ...documentState, selectedLayerId: "", selectedLayerIds: [], canvas: { ...documentState.canvas, gridVisible: false, rulersVisible: false, guides: [] } }, Math.min(1, zoom))}</div></div><input class="gdu-hidden-input" type="file" data-gdu-asset-file accept="image/*,video/*,audio/*,.svg,.pdf,.glb,.gltf,.json"><input class="gdu-hidden-input" type="file" data-gdu-relink-file><input class="gdu-hidden-input" type="file" data-gdu-import-document accept=".json,.hhdesign,application/json"></section>`;
  }

  function persist(documentState, instance) {
    writeStored(documentState);
    if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
      globalThis.dispatchEvent(new CustomEvent("hh:graphic-design-document-change", { detail: { document: serializableDocument(documentState) } }));
    }
    const projectStore = globalThis.HHGraphicProjectStore;
    if (projectStore?.createStore && !instance.mirrorBusy) {
      instance.mirrorBusy = true;
      Promise.resolve(projectStore.createStore()).then((store) => store.saveProject({ id: documentState.id, name: documentState.name, branch: documentState.branch, status: documentState.status, data: { designDocument: serializableDocument(documentState) }, assetIds: documentState.assets.map((asset) => asset.id) })).catch(() => null).finally(() => { instance.mirrorBusy = false; });
    }
  }

  function download(name, content, type) {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(new Blob([content], { type: type || "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function cssForLayer(layer) {
    if (!layer) return "";
    const radius = layer.type === "ellipse" ? "50%" : `${Math.max(0, layer.cornerRadius || 0)}px`;
    return [
      `position: absolute`,
      `left: ${layer.x}px`,
      `top: ${layer.y}px`,
      `width: ${layer.width}px`,
      `height: ${layer.height}px`,
      `opacity: ${layer.opacity}`,
      `transform: rotate(${layer.rotation}deg) skew(${layer.skewX}deg, ${layer.skewY}deg)`,
      `transform-origin: ${layer.anchorX * 100}% ${layer.anchorY * 100}%`,
      `background: ${layer.fill}`,
      `border: ${layer.strokeWidth}px ${layer.strokeDash.length ? "dashed" : "solid"} ${layer.stroke}`,
      `border-radius: ${radius}`
    ].join(";\n") + ";";
  }

  function reactComponentForLayer(layer) {
    if (!layer) return "export function HHDesign(){ return null; }\n";
    const rawName = text(layer.name || "HHDesign", "HHDesign").replace(/[^a-z0-9]+/gi, " ").trim();
    const componentName = (rawName.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("") || "HHDesign").replace(/^[^A-Za-z_]/, "HH");
    const style = {
      position: "absolute",
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      opacity: layer.opacity,
      transform: `rotate(${layer.rotation}deg) skew(${layer.skewX}deg, ${layer.skewY}deg)`,
      transformOrigin: `${layer.anchorX * 100}% ${layer.anchorY * 100}%`,
      background: layer.fill,
      border: `${layer.strokeWidth}px ${layer.strokeDash.length ? "dashed" : "solid"} ${layer.stroke}`,
      borderRadius: layer.type === "ellipse" ? "50%" : layer.cornerRadius,
      color: layer.type === "text" ? layer.fill : undefined,
      fontFamily: layer.type === "text" ? layer.fontFamily : undefined,
      fontSize: layer.type === "text" ? layer.fontSize : undefined,
      fontWeight: layer.type === "text" ? layer.fontWeight : undefined,
      lineHeight: layer.type === "text" ? layer.lineHeight : undefined,
      letterSpacing: layer.type === "text" ? layer.letterSpacing : undefined
    };
    Object.keys(style).forEach((key) => style[key] == null && delete style[key]);
    const styleSource = JSON.stringify(style, null, 2).replace(/^/gm, "  ");
    const alt = JSON.stringify(layer.altText || layer.name || "");
    const source = JSON.stringify(layer.metadata?.dataUrl || "");
    const content = JSON.stringify(layer.text || "");
    let element = `<div style={style} />`;
    if (layer.type === "text") element = `<p style={style}>{${content}}</p>`;
    if (layer.type === "image") element = `<img src={${source}} alt={${alt}} style={style} />`;
    if (layer.type === "path") element = `<svg viewBox="0 0 ${Math.max(1, layer.width)} ${Math.max(1, layer.height)}" style={style} role="img" aria-label={${alt}}><path d={${JSON.stringify(layer.pathData)}} fill={${JSON.stringify(layer.fill)}} stroke={${JSON.stringify(layer.stroke)}} strokeWidth={${layer.strokeWidth}} /></svg>`;
    return `export function ${componentName}() {\n  const style = ${styleSource.trimStart()};\n  return ${element};\n}\n`;
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    addStyles();
    const host = root.querySelector(".gd-main") || root;
    // Repair fresh and legacy documents before any renderer calls array
    // methods on layer masks, adjustments, strokes or prototype actions.
    let documentState = normalizeDocument(readStored());
    const instance = {
      document: documentState,
      zoom: documentState.canvas.zoom || 1,
      focus: "design",
      mode: "studio",
      compact: Boolean(options.view && options.view !== "overview"),
      mirrorBusy: false,
      fps: 60,
      fpsFrames: 0,
      fpsStartedAt: globalThis.performance?.now?.() || Date.now(),
      penPoints: [],
      drag: null,
      presentation: false,
      aiControllers: new Map(),
      relinkAssetId: ""
    };
    host.insertAdjacentHTML("afterbegin", renderShell(documentState, instance.mode, instance.focus, instance.zoom, instance.compact, instance.presentation));
    let shell = host.querySelector("[data-gdu-shell]");
    const qs = (selector) => shell?.querySelector(selector);
    const toast = (message) => { const element = qs("[data-gdu-toast]"); if (!element) return; element.textContent = message; element.hidden = false; clearTimeout(instance.toastTimer); instance.toastTimer = setTimeout(() => { element.hidden = true; }, 2600); };
    const redraw = () => { shell.outerHTML = renderShell(instance.document, instance.mode, instance.focus, instance.zoom, instance.compact, instance.presentation); shell = host.querySelector("[data-gdu-shell]"); bind(); };
    const sync = () => { persist(instance.document, instance); redraw(); };
    const setStatus = (message) => { const element = shell.querySelector("[data-gdu-status]"); if (element) element.textContent = message; };
    const activeSelection = () => instance.document.selectedLayerIds.length ? instance.document.selectedLayerIds : [instance.document.selectedLayerId].filter(Boolean);
    const selectLayers = (ids, additive = false) => {
      const valid = new Set(instance.document.layers.map((layer) => layer.id));
      const nextIds = [...new Set((additive ? instance.document.selectedLayerIds : []).concat(ids).map((id) => text(id)).filter((id) => valid.has(id)))].slice(0, 500);
      instance.document.selectedLayerIds = nextIds;
      instance.document.selectedLayerId = nextIds.at(-1) || "";
      persist(instance.document, instance);
      redraw();
    };
    const updateLayer = (field, value) => {
      const selected = instance.document.layers.find((layer) => layer.id === instance.document.selectedLayerId);
      if (!selected || selected.locked) return;
      const numericFields = new Set(["x", "y", "width", "height", "opacity", "rotation", "skewX", "skewY", "anchorX", "anchorY", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "strokeWidth", "cornerRadius"]);
      const changes = { [field]: numericFields.has(field) ? number(value, selected[field]) : field === "fill" || field === "stroke" ? safeColor(value, selected[field]) : text(value) };
      instance.document = operation(instance.document, "update-layer", { id: selected.id, changes });
      sync();
    };
    const blobToBase64 = async (blob) => {
      if (!blob) return "";
      const buffer = await blob.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return btoa(binary);
    };
    const selectedReferenceImages = async () => {
      const references = [];
      for (const layer of instance.document.layers.filter((item) => activeSelection().includes(item.id)).slice(0, 2)) {
        const asset = instance.document.assets.find((item) => item.id === layer.assetId);
        const stored = asset ? await getAssetBlob(asset.id).catch(() => null) : null;
        if (stored?.blob && /^image\/(png|jpeg|webp)$/i.test(stored.blob.type)) references.push({ name: asset.name, mimeType: stored.blob.type, data: await blobToBase64(stored.blob) });
      }
      return references;
    };
    const runAI = async (forcedInput = "") => {
      const input = text(forcedInput || qs("[data-gdu-ai-input]")?.value);
      if (!input) return toast("Hãy nhập yêu cầu thiết kế.");
      const operationName = text(qs("[data-gdu-ai-operation]")?.value || "plan", "plan");
      const jobId = uid("job");
      const controller = new AbortController();
      instance.aiControllers.set(jobId, controller);
      const inputLayerIds = activeSelection();
      instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: operationName === "plan" ? "design-plan" : "design-media", operation: operationName, status: "queued", provider: "auto", model: "auto", input, inputLayerIds } });
      sync();
      const startedAt = Date.now();
      instance.document = operation(instance.document, "set-job", { job: { id: jobId, status: "running", operation: operationName } });
      sync();
      try {
        const isMedia = ["image", "inpaint", "outpaint", "remove", "harmonize"].includes(operationName);
        const references = isMedia ? await selectedReferenceImages() : [];
        const payload = isMedia
          ? { actionType: "design-image", input: `${operationName.toUpperCase()}: ${input}`, meta: { operation: operationName, aspectRatio: "16:9", imageSize: "1K", referenceImages: references, requireProvider: true } }
          : {
              actionType: "design-plan",
              input: `${operationName.toUpperCase()}: ${input}`,
              meta: {
                provider: "auto",
                model: "auto",
                requireProvider: true,
                allowProviderFallback: true,
                context: JSON.stringify({
                  documentId: instance.document.id,
                  frame: activeFrame(instance.document),
                  selectedLayerIds: inputLayerIds,
                  layers: instance.document.layers.slice(0, 40).map(({ id, name, type, text, x, y, width, height }) => ({ id, name, type, text, x, y, width, height }))
                })
              }
            };
        const endpoint = isMedia ? "/api/modules/music-ai/actions" : "/api/modules/ai-center/actions";
        const response = await fetch(`${options.apiBase || ""}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || data?.message || `AI HTTP ${response.status}`);
        const action = data.action || data.media || {};
        if (isMedia && action.data) {
          const mimeType = text(action.mimeType || "image/jpeg", "image/jpeg");
          const binary = Uint8Array.from(atob(action.data), (char) => char.charCodeAt(0));
          const blob = new Blob([binary], { type: mimeType });
          const record = await assetRecordFromBlob(blob, `AI ${operationName} · ${new Date().toLocaleString("vi-VN")}`, "ai-provider");
          instance.document = operation(instance.document, "add-asset", record);
          instance.document = operation(instance.document, "set-job", { job: { id: jobId, operation: operationName, status: "completed", provider: action.provider || "gemini-media", model: action.model, input, resultAssetIds: [record.id], latencyMs: Date.now() - startedAt, output: "Đã tạo asset. Xem diff rồi bấm Áp dụng để đặt vào canvas." } });
        } else {
          const structured = action.structured || null;
          instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: "design-plan", operation: operationName, status: "completed", provider: action.provider, model: action.model, input, structured, output: action.output || JSON.stringify(structured || {}), latencyMs: Date.now() - startedAt } });
        }
        sync();
        toast(`AI hoàn tất bằng ${action.provider || "provider"}.`);
      } catch (error) {
        const cancelled = error?.name === "AbortError" || controller.signal.aborted;
        instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: "design-ai", operation: operationName, status: cancelled ? "cancelled" : "failed", input, inputLayerIds, latencyMs: Date.now() - startedAt, error: cancelled ? "Đã hủy theo yêu cầu." : text(error.message || "Không thể kết nối AI.") } });
        sync();
        toast(cancelled ? "Đã hủy AI job." : "AI lỗi: " + text(error.message || "Không thể kết nối AI."));
      } finally {
        instance.aiControllers.delete(jobId);
      }
    };
    const applyAIJob = (jobId) => {
      const job = instance.document.jobs.find((item) => item.id === jobId);
      if (!job?.structured && !job?.resultAssetIds?.length) return toast("Job chưa có kết quả để áp dụng.");
      if (job.resultAssetIds?.length) {
        const asset = instance.document.assets.find((item) => item.id === job.resultAssetIds[0]);
        if (!asset) return toast("Asset AI không còn trong Asset Observatory.");
        instance.document = operation(instance.document, "add-layer", { type: "image", name: `AI ${job.operation}`, assetId: asset.id, width: Math.min(720, asset.width || 1024), height: Math.min(520, asset.height || 576), metadata: { dataUrl: asset.thumbnail } });
      } else {
        instance.document = operation(instance.document, "apply-ai-plan", { plan: job.structured, prompt: job.input, operation: job.operation, inputLayerIds: job.inputLayerIds });
      }
      instance.document = operation(instance.document, "set-job", { job: { id: jobId, resultLayerIds: instance.document.selectedLayerIds, versionAfter: instance.document.updatedAt } });
      sync();
      toast("Đã áp dụng AI plan vào Universal Design Document.");
    };
    const downloadSvg = (scale = 1) => {
      const svg = qs("[data-gdu-canvas]");
      if (!svg) return toast("Chưa có canvas để xuất.");
      const copy = svg.cloneNode(true);
      copy.querySelector(".gdu-selection-ui")?.remove();
      copy.querySelector(".gdu-rulers")?.remove();
      copy.setAttribute("width", Math.round(activeFrame(instance.document)?.width * scale || 1440 * scale));
      copy.setAttribute("height", Math.round(activeFrame(instance.document)?.height * scale || 900 * scale));
      download(`hh-design-${scale}x.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`, "image/svg+xml");
      toast(`Đã xuất SVG ${scale}×.`);
    };
    const downloadPng = async (scale = 1) => {
      const svg = qs("[data-gdu-canvas]");
      if (!svg) return toast("Chưa có canvas để xuất.");
      const width = Math.round(activeFrame(instance.document)?.width * scale || 1440 * scale);
      const height = Math.round(activeFrame(instance.document)?.height * scale || 900 * scale);
      const copy = svg.cloneNode(true);
      copy.querySelector(".gdu-selection-ui")?.remove();
      copy.querySelector(".gdu-rulers")?.remove();
      copy.setAttribute("width", width);
      copy.setAttribute("height", height);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
          canvas.toBlob((png) => {
            if (!png) return reject(new Error("Không tạo được PNG."));
            download(`hh-design-${scale}x.png`, png, "image/png");
            URL.revokeObjectURL(url);
            resolve();
          }, "image/png");
        };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG không thể render thành PNG.")); };
        image.src = url;
      }).then(() => toast(`Đã xuất PNG ${scale}×.`)).catch((error) => toast(error.message));
    };
    const importFiles = async (files) => {
      for (const file of [...files].slice(0, 20)) {
        if (file.size > 40_000_000) { toast(`${file.name}: vượt giới hạn 40MB.`); continue; }
        try {
          const record = await assetRecordFromBlob(file, file.name);
          if (instance.document.assets.some((asset) => asset.checksum && asset.checksum === record.checksum)) {
            toast(`${file.name}: asset trùng checksum, không tạo bản sao.`);
            continue;
          }
          instance.document = operation(instance.document, "add-asset", record);
          if (record.kind === "image") instance.document = operation(instance.document, "add-layer", { type: "image", name: file.name, assetId: record.id, width: Math.min(620, record.width || 620), height: Math.min(420, record.height || 420), metadata: { dataUrl: record.thumbnail } });
        } catch (error) {
          toast(`${file.name}: ${error.message}`);
        }
      }
      sync();
    };
    const relinkFile = async (file) => {
      const asset = instance.document.assets.find((item) => item.id === instance.relinkAssetId);
      if (!asset || !file) return toast("Không tìm thấy asset cần relink.");
      try {
        const replacement = await assetRecordFromBlob(file, file.name, "local-device");
        await putAssetBlob(asset.id, file, { name: replacement.name, type: replacement.type, checksum: replacement.checksum });
        await removeAssetBlob(replacement.id).catch(() => null);
        instance.document = operation(instance.document, "replace-asset", {
          id: asset.id,
          name: replacement.name,
          type: replacement.type,
          size: replacement.size,
          checksum: replacement.checksum,
          width: replacement.width,
          height: replacement.height,
          thumbnail: replacement.thumbnail
        });
        instance.relinkAssetId = "";
        sync();
        toast("Đã relink asset và giữ nguyên mọi liên kết layer.");
      } catch (error) {
        toast(`Relink thất bại: ${text(error.message || "Không thể đọc file.")}`);
      }
    };
    const onCommand = (command) => {
      if (command === "toggle-shell") instance.compact = !instance.compact;
      else if (command === "undo") instance.document = undo(instance.document);
      else if (command === "redo") instance.document = redo(instance.document);
      else if (command === "add-frame") instance.document = operation(instance.document, "add-frame", { name: `Frame ${instance.document.frames.length + 1}`, width: 900, height: 560, x: 32, y: 32 });
      else if (command === "add-rect") instance.document = operation(instance.document, "add-layer", { type: "rect", fill: instance.document.brand.tokens["color.brand.secondary"] });
      else if (command === "add-ellipse") instance.document = operation(instance.document, "add-layer", { type: "ellipse", fill: instance.document.brand.tokens["color.brand.primary"], width: 180, height: 180 });
      else if (command === "add-text") instance.document = operation(instance.document, "add-layer", { type: "text", text: "Ý tưởng mới", fill: instance.document.brand.tokens["color.text.primary"], fontSize: 42 });
      else if (command === "add-polygon") instance.document = operation(instance.document, "add-layer", { type: "polygon", metadata: { sides: 6 }, width: 180, height: 180, fill: instance.document.brand.tokens["color.brand.secondary"] });
      else if (command === "add-star") instance.document = operation(instance.document, "add-layer", { type: "star", metadata: { points: 5, innerRatio: 0.45 }, width: 180, height: 180, fill: instance.document.brand.tokens["color.brand.primary"] });
      else if (command === "duplicate" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "duplicate-layer", { ids: instance.document.selectedLayerIds });
      else if (command === "remove" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "remove-layer", { ids: instance.document.selectedLayerIds });
      else if (command === "group" && instance.document.selectedLayerIds.length > 1) instance.document = operation(instance.document, "group-layers", { ids: instance.document.selectedLayerIds });
      else if (command === "ungroup" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "ungroup-layer", { ids: instance.document.selectedLayerIds });
      else if (command === "lock" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "toggle-layer", { id: instance.document.selectedLayerId, field: "locked" });
      else if (command === "hide" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "toggle-layer", { id: instance.document.selectedLayerId, field: "visible" });
      else if (command === "tidy") instance.document = operation(instance.document, "tidy-layers", { ids: instance.document.selectedLayerIds });
      else if (command === "fit") {
        const stage = qs("[data-gdu-stage]");
        const active = activeFrame(instance.document);
        if (stage && active) instance.zoom = clamp(Math.min((stage.clientWidth - 48) / active.width, (stage.clientHeight - 48) / active.height), 0.08, 4, 1);
      }
      else if (command === "zoom-selection") {
        const bounds = selectionBounds(instance.document);
        if (bounds) instance.zoom = clamp(Math.min(2.8, 620 / Math.max(bounds.width, bounds.height)), 0.1, 4, 1);
      }
      else if (command === "presentation" || command === "presentation-close") instance.presentation = command === "presentation";
      else if (command === "guide-x" || command === "guide-y") instance.document = operation(instance.document, "add-guide", { axis: command === "guide-x" ? "x" : "y", position: command === "guide-x" ? (activeFrame(instance.document)?.width || 1440) / 2 : (activeFrame(instance.document)?.height || 900) / 2 });
      else if (command === "auto-layout-v" && instance.document.selectedLayerId) instance.document = operation(instance.document, "set-auto-layout", { id: instance.document.selectedLayerId, changes: { direction: "vertical", enabled: true } });
      else if (command === "auto-layout-h" && instance.document.selectedLayerId) instance.document = operation(instance.document, "set-auto-layout", { id: instance.document.selectedLayerId, changes: { direction: "horizontal", enabled: true } });
      else if (command === "auto-layout-wrap" && instance.document.selectedLayerId) instance.document = operation(instance.document, "set-auto-layout", { id: instance.document.selectedLayerId, changes: { wrap: true, enabled: true } });
      else if (command === "auto-layout-off" && instance.document.selectedLayerId) instance.document = operation(instance.document, "update-layer", { id: instance.document.selectedLayerId, changes: { autoLayout: { ...instance.document.layers.find((layer) => layer.id === instance.document.selectedLayerId)?.autoLayout, enabled: false } } });
      else if (command === "add-variable") {
        const key = qs("[data-gdu-variable-key]")?.value;
        const value = qs("[data-gdu-variable-value]")?.value;
        if (key && value) instance.document = operation(instance.document, "set-variable", { key, value, variableType: /^#/.test(value) ? "color" : "string" });
      }
      else if (command === "create-component" && instance.document.selectedLayerIds.length) instance.document = operation(instance.document, "create-component", { ids: instance.document.selectedLayerIds, name: "HH Component" });
      else if (command === "create-instance" && instance.document.components.length) instance.document = operation(instance.document, "create-instance", { componentId: instance.document.components.at(-1).id });
      else if (command === "add-variant" && instance.document.components.length) instance.document = operation(instance.document, "add-component-variant", { componentId: instance.document.components.at(-1).id, name: `Variant ${instance.document.components.at(-1).variants.length + 1}` });
      else if (command === "gradient-linear" || command === "gradient-radial") instance.document = operation(instance.document, "set-gradient", { id: instance.document.selectedLayerId, gradient: { type: command === "gradient-radial" ? "radial" : "linear", stops: [{ offset: 0, color: "#63e8ff", opacity: 1 }, { offset: 1, color: "#ff5fc8", opacity: 1 }] } });
      else if (command === "toggle-arrow") instance.document = operation(instance.document, "update-layer", { id: instance.document.selectedLayerId, changes: { arrowEnd: !instance.document.layers.find((layer) => layer.id === instance.document.selectedLayerId)?.arrowEnd } });
      else if (command === "text-on-path") {
        const path = instance.document.layers.find((layer) => layer.type === "path");
        if (path) instance.document = operation(instance.document, "update-layer", { id: instance.document.selectedLayerId, changes: { textPathLayerId: path.id } });
      }
      else if (command === "mask-rect" || command === "mask-ellipse") instance.document = operation(instance.document, "add-mask", { id: instance.document.selectedLayerId, maskType: command === "mask-ellipse" ? "ellipse" : "rect" });
      else if (command === "alpha-lock") instance.document = operation(instance.document, "toggle-layer", { id: instance.document.selectedLayerId, field: "alphaLock" });
      else if (command === "before-after" && instance.document.selectedLayerId) {
        const layer = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId);
        if (layer) layer.metadata.previewBeforeAfter = !layer.metadata.previewBeforeAfter;
      }
      else if (command === "play-motion") instance.document = operation(instance.document, "set-timeline", { changes: { playing: !instance.document.timeline.playing } });
      else if (command === "prototype-action") {
        const targetFrame = instance.document.frames.find((item) => item.id !== instance.document.activeFrameId);
        if (targetFrame) instance.document = operation(instance.document, "add-prototype-action", { id: instance.document.selectedLayerId, action: { trigger: "click", action: "navigate", targetFrameId: targetFrame.id } });
      }
      else if (command === "import-image" || command === "import-asset") return qs("[data-gdu-asset-file]")?.click();
      else if (command === "relink-asset") {
        const asset = instance.document.assets.find((item) => item.id === instance.relinkAssetId) || instance.document.assets.at(-1);
        if (!asset) return toast("Chưa có asset để relink.");
        instance.relinkAssetId = asset.id;
        return qs("[data-gdu-relink-file]")?.click();
      }
      else if (command === "asset-search") { qs("[data-gdu-asset-search]")?.focus(); return; }
      else if (command === "copy-css") {
        const layer = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId);
        if (!layer) return toast("Hãy chọn một layer để sao chép CSS.");
        const css = cssForLayer(layer);
        const copyRequest = globalThis.navigator?.clipboard?.writeText?.(css);
        if (copyRequest?.then) return copyRequest.then(() => toast("Đã sao chép CSS của layer.")).catch(() => { download("hh-design-layer.css", css, "text/css"); toast("Clipboard bị chặn, đã tải CSS."); });
        download("hh-design-layer.css", css, "text/css");
        return toast("Clipboard không được hỗ trợ, đã tải CSS.");
      }
      else if (command === "export-tokens") { download("hh-design-tokens.json", JSON.stringify(instance.document.variables, null, 2)); return toast("Đã xuất design tokens."); }
      else if (command === "scan") { const result = runHealthScan(instance.document); return toast(result.ok ? "Design Health: không có lỗi chặn export." : `Design Health: ${result.summary.errors} lỗi, ${result.summary.warnings} cảnh báo.`); }
      else if (command === "fix-all-health") {
        for (const issue of runHealthScan(instance.document).issues.filter((item) => /^(contrast|alt|touch|overflow)-/.test(item.id))) instance.document = operation(instance.document, "fix-health-issue", { issueId: issue.id });
      }
      else if (command === "preflight") { const result = runHealthScan(instance.document); return toast(result.ok ? "Preflight đạt. Có thể export." : `Preflight chặn export: ${result.summary.errors} lỗi.`); }
      else if (command === "command-palette") { qs("[data-gdu-command-dialog]")?.showModal?.(); return; }
      else if (command === "set-approval") instance.document = operation(instance.document, "set-approval", { status: "review" });
      else if (command === "save") { persist(instance.document, instance); return toast("Đã lưu Universal Design Document."); }
      else if (command === "export") { download("hh-design-document.json", exportDocument(instance.document)); return toast("Đã xuất tài liệu thiết kế."); }
      else if (command === "zoom-in") instance.zoom = clamp(instance.zoom + 0.1, 0.05, 4);
      else if (command === "zoom-out") instance.zoom = clamp(instance.zoom - 0.1, 0.05, 4);
      else if (command === "pen") { instance.document.settings.activeTool = "pen"; instance.penPoints = []; }
      else if (command === "shape-builder") {
        if (instance.document.selectedLayerIds.length < 2) return toast("Shape Builder cần ít nhất hai shape.");
        instance.document = operation(instance.document, "boolean-layers", { ids: instance.document.selectedLayerIds, mode: "union" });
      }
      else return;
      instance.document.canvas.zoom = instance.zoom;
      sync();
    };
    function bind() {
      const currentShell = host.querySelector("[data-gdu-shell]");
      if (!currentShell) return;
      const canvasPoint = (event) => {
        const canvas = currentShell.querySelector("[data-gdu-canvas]");
        const rect = canvas?.getBoundingClientRect();
        const frame = activeFrame(instance.document);
        if (!canvas || !rect || !frame) return { x: 0, y: 0 };
        return { x: (event.clientX - rect.left) * frame.width / rect.width, y: (event.clientY - rect.top) * frame.height / rect.height };
      };
      const updatePreview = () => {
        currentShell.querySelectorAll("[data-gdu-layer]").forEach((node) => {
          const layer = instance.document.layers.find((item) => item.id === node.dataset.gduLayer);
          if (layer) node.setAttribute("transform", layerTransform(layer));
        });
      };
      const commitDrag = () => {
        const drag = instance.drag;
        if (!drag) return;
        const changesById = {};
        for (const layer of instance.document.layers) {
          const before = drag.before.layers.find((item) => item.id === layer.id);
          if (before && !jsonEqual(before, layer)) changesById[layer.id] = { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation, anchorX: layer.anchorX, anchorY: layer.anchorY };
        }
        instance.document = drag.before;
        if (Object.keys(changesById).length) instance.document = operation(instance.document, "update-layers", { changesById });
        instance.drag = null;
        sync();
      };
      currentShell.addEventListener("click", (event) => {
        const commandButton = event.target.closest("[data-gdu-command]");
        if (commandButton) return onCommand(commandButton.dataset.gduCommand);
        const routeButton = event.target.closest("[data-gdu-route]");
        if (routeButton) { globalThis.location.hash = `/graphic-design/${routeButton.dataset.gduRoute}`.replace("/graphic-design/overview", "/graphic-design"); return; }
        const planet = event.target.closest("[data-gdu-planet]");
        if (planet) { instance.focus = planet.dataset.gduPlanet; return sync(); }
        const palette = event.target.closest("[data-gdu-palette-command]");
        if (palette) { onCommand(palette.dataset.gduPaletteCommand); qs("[data-gdu-command-dialog]")?.close?.(); return; }
        const tool = event.target.closest("[data-gdu-tool]");
        if (tool) { instance.document.settings.activeTool = tool.dataset.gduTool; instance.penPoints = []; return redraw(); }
        const align = event.target.closest("[data-gdu-align]");
        if (align) { instance.document = operation(instance.document, "align-layers", { ids: activeSelection(), align: align.dataset.gduAlign }); return sync(); }
        const distribute = event.target.closest("[data-gdu-distribute]");
        if (distribute) { instance.document = operation(instance.document, "distribute-layers", { ids: activeSelection(), axis: distribute.dataset.gduDistribute }); return sync(); }
        const booleanButton = event.target.closest("[data-gdu-boolean]");
        if (booleanButton) { instance.document = operation(instance.document, "boolean-layers", { ids: activeSelection(), mode: booleanButton.dataset.gduBoolean }); return sync(); }
        const aiRun = event.target.closest("[data-gdu-ai-run]");
        if (aiRun) return runAI();
        const apply = event.target.closest("[data-gdu-apply-ai]");
        if (apply) return applyAIJob(apply.dataset.gduApplyAi);
        const retry = event.target.closest("[data-gdu-retry-ai]");
        if (retry) {
          const job = instance.document.jobs.find((item) => item.id === retry.dataset.gduRetryAi);
          if (job) return runAI(job.input);
        }
        const cancel = event.target.closest("[data-gdu-cancel-ai]");
        if (cancel) {
          instance.aiControllers.get(cancel.dataset.gduCancelAi)?.abort();
          instance.document = operation(instance.document, "set-job", { job: { id: cancel.dataset.gduCancelAi, status: "cancelled", error: "Đã hủy theo yêu cầu." } });
          return sync();
        }
        const fix = event.target.closest("[data-gdu-fix-issue]");
        if (fix) { instance.document = operation(instance.document, "fix-health-issue", { issueId: fix.dataset.gduFixIssue }); return sync(); }
        const selectIssue = event.target.closest("[data-gdu-select-issue]");
        if (selectIssue) {
          const issueId = selectIssue.dataset.gduSelectIssue;
          const layer = instance.document.layers.find((item) => issueId.endsWith(item.id));
          if (layer) return selectLayers([layer.id]);
        }
        const toggler = event.target.closest("[data-gdu-toggle-layer]");
        if (toggler) { instance.document = operation(instance.document, "toggle-layer", { id: toggler.dataset.gduToggleLayer, field: toggler.dataset.gduToggleField }); return sync(); }
        const layer = event.target.closest("[data-gdu-layer], [data-gdu-layer-button]");
        if (layer) return selectLayers([layer.dataset.gduLayer || layer.dataset.gduLayerButton], event.shiftKey);
        const keyframe = event.target.closest("[data-gdu-keyframe]");
        if (keyframe && instance.document.selectedLayerId) { const selected = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId); instance.document = operation(instance.document, "add-keyframe", { id: selected.id, property: keyframe.dataset.gduKeyframe, time: instance.document.timeline.currentTime, value: selected[keyframe.dataset.gduKeyframe] }); return sync(); }
        const removeAdjustment = event.target.closest("[data-gdu-remove-adjustment]");
        if (removeAdjustment) { instance.document = operation(instance.document, "remove-adjustment", { id: instance.document.selectedLayerId, adjustmentId: removeAdjustment.dataset.gduRemoveAdjustment }); return sync(); }
        const adjustment = event.target.closest("[data-gdu-adjustment]");
        if (adjustment) { instance.document = operation(instance.document, "add-adjustment", { id: instance.document.selectedLayerId, adjustmentType: adjustment.dataset.gduAdjustment }); return sync(); }
        const addComponent = event.target.closest("[data-gdu-component]");
        if (addComponent) { const component = instance.document.components.find((item) => item.id === addComponent.dataset.gduComponent); if (component) instance.document = operation(instance.document, "create-instance", { componentId: component.id }); return sync(); }
        const bindVariable = event.target.closest("[data-gdu-bind-variable]");
        if (bindVariable && instance.document.selectedLayerId) { instance.document = operation(instance.document, "bind-variable", { id: instance.document.selectedLayerId, property: "fill", variableKey: bindVariable.dataset.gduBindVariable }); return sync(); }
        const assetRelink = event.target.closest("[data-gdu-relink-asset]");
        if (assetRelink) { instance.relinkAssetId = assetRelink.dataset.gduRelinkAsset; return qs("[data-gdu-relink-file]")?.click(); }
        const assetUse = event.target.closest("[data-gdu-use-asset]");
        if (assetUse) { const asset = instance.document.assets.find((item) => item.id === assetUse.dataset.gduUseAsset); if (asset) instance.document = operation(instance.document, "add-layer", { type: asset.kind === "image" ? "image" : "rect", name: asset.name, assetId: asset.id, metadata: { dataUrl: asset.thumbnail } }); return sync(); }
        const assetRemove = event.target.closest("[data-gdu-remove-asset]");
        if (assetRemove) { instance.document = operation(instance.document, "remove-asset", { id: assetRemove.dataset.gduRemoveAsset }); removeAssetBlob(assetRemove.dataset.gduRemoveAsset).catch(() => null); return sync(); }
        const exportButton = event.target.closest("[data-gdu-export]");
        if (exportButton) {
          const kind = exportButton.dataset.gduExport;
          if (kind === "json") download("hh-design-document.json", exportDocument(instance.document));
          if (kind === "svg") downloadSvg(1);
          if (kind === "png") downloadPng(1);
          if (kind === "png-2x") downloadPng(2);
          if (kind === "png-3x") downloadPng(3);
          if (kind === "tokens-json") download("hh-design-tokens.json", JSON.stringify(instance.document.variables, null, 2));
          if (kind === "tokens-css") download("hh-design-tokens.css", `:root {\n${Object.entries(instance.document.brand.tokens).map(([key, value]) => `  --hh-${key.replace(/[^a-z0-9]+/gi, "-")}: ${value};`).join("\n")}\n}`, "text/css");
          if (kind === "react") download("hh-design-component.jsx", reactComponentForLayer(instance.document.layers.find((layer) => layer.id === instance.document.selectedLayerId)), "text/javascript");
          return;
        }
        if (event.target.closest("[data-gdu-ai-run]")) return runAI();
      });
      currentShell.addEventListener("change", (event) => {
        if (event.target.matches("[data-gdu-field]")) updateLayer(event.target.dataset.gduField, event.target.value);
        if (event.target.matches("[data-gdu-mode]")) { instance.mode = event.target.value; return sync(); }
        if (event.target.matches("[data-gdu-canvas-setting]")) { instance.document = operation(instance.document, "set-canvas", { changes: { [event.target.dataset.gduCanvasSetting]: event.target.checked } }); return sync(); }
        if (event.target.matches("[data-gdu-variable-mode]")) { instance.document = operation(instance.document, "set-variable-mode", { mode: event.target.value }); return sync(); }
        if (event.target.matches("[data-gdu-text-path]") && instance.document.selectedLayerId) { instance.document = operation(instance.document, "update-layer", { id: instance.document.selectedLayerId, changes: { textPathLayerId: event.target.value || null } }); return sync(); }
        if (event.target.matches("[data-gdu-ready-dev]")) { instance.document = operation(instance.document, "set-approval", { status: event.target.checked ? "approved" : "draft", note: event.target.checked ? "Ready for Development" : "Reopened" }); return sync(); }
        if (event.target.matches("[data-gdu-asset-file]")) return importFiles(event.target.files);
        if (event.target.matches("[data-gdu-relink-file]") && event.target.files?.[0]) return relinkFile(event.target.files[0]);
        if (event.target.matches("[data-gdu-import-document]") && event.target.files?.[0]) {
          const reader = new FileReader();
          reader.onload = () => { try { instance.document = importDocument(reader.result); sync(); toast("Đã nhập lại Universal Design Document."); } catch (error) { toast(error.message); } };
          reader.readAsText(event.target.files[0]);
        }
      });
      currentShell.addEventListener("input", (event) => {
        if (event.target.matches("[data-gdu-asset-search]")) {
          const query = event.target.value.trim().toLowerCase();
          currentShell.querySelectorAll("[data-gdu-asset-card]").forEach((card) => {
            const asset = instance.document.assets.find((item) => item.id === card.dataset.gduAssetCard);
            card.hidden = Boolean(query && asset && ![asset.name, asset.kind, asset.type, ...(asset.tags || [])].join(" ").toLowerCase().includes(query));
          });
        }
        if (event.target.matches("[data-gdu-command-search]")) {
          const query = event.target.value.trim().toLowerCase();
          currentShell.querySelectorAll("[data-gdu-palette-command]").forEach((button) => { button.hidden = Boolean(query && !button.textContent.toLowerCase().includes(query)); });
        }
        if (event.target.matches("[data-gdu-adjustment-value]") && instance.document.selectedLayerId) {
          instance.document = operation(instance.document, "update-adjustment", { id: instance.document.selectedLayerId, adjustmentId: event.target.dataset.gduAdjustmentValue, value: event.target.value });
          persist(instance.document, instance);
        }
      });
      const canvas = currentShell.querySelector("[data-gdu-canvas]");
      const stage = currentShell.querySelector("[data-gdu-stage]");
      const marquee = currentShell.querySelector("[data-gdu-marquee]");
      canvas?.addEventListener("wheel", (event) => {
        if (event.ctrlKey || event.metaKey) { event.preventDefault(); instance.zoom = clamp(instance.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.05, 4); instance.document.canvas.zoom = instance.zoom; redraw(); }
      }, { passive: false });
      stage?.addEventListener("pointerdown", (event) => {
        if (event.button === 1 || event.altKey) { instance.drag = { kind: "pan", x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop }; stage.setPointerCapture?.(event.pointerId); return; }
        const point = canvasPoint(event);
        const target = event.target.closest("[data-gdu-layer]");
        const handle = event.target.closest("[data-gdu-handle]");
        const activeTool = instance.document.settings.activeTool || "select";
        if (!target && !handle && ["text", "rect", "ellipse"].includes(activeTool)) {
          const defaults = activeTool === "text"
            ? { type: "text", name: "Text layer", text: "Nhập nội dung", x: point.x, y: point.y, width: 320, height: 72, fontSize: 32, fill: instance.document.brand.tokens["color.text.primary"] }
            : { type: activeTool, name: activeTool === "rect" ? "Rectangle" : "Ellipse", x: point.x, y: point.y, width: activeTool === "rect" ? 220 : 180, height: activeTool === "rect" ? 120 : 180, fill: activeTool === "rect" ? instance.document.brand.tokens["color.brand.secondary"] : instance.document.brand.tokens["color.brand.primary"] };
          instance.document = operation(instance.document, "add-layer", defaults);
          instance.document.settings.activeTool = "select";
          return sync();
        }
        if (handle && selectionBounds(instance.document)) {
          const bounds = selectionBounds(instance.document);
          instance.drag = { kind: handle.dataset.gduHandle === "rotate" ? "rotate" : handle.dataset.gduHandle === "anchor" ? "anchor" : "resize", handle: handle.dataset.gduHandle, x: point.x, y: point.y, before: clone(instance.document), bounds };
          stage.setPointerCapture?.(event.pointerId);
          return;
        }
        if (target && activeTool !== "pen") {
          const targetId = target.dataset.gduLayer;
          const nextIds = event.shiftKey
            ? (instance.document.selectedLayerIds.includes(targetId)
              ? instance.document.selectedLayerIds.filter((id) => id !== targetId)
              : [...instance.document.selectedLayerIds, targetId])
            : [targetId];
          instance.document.selectedLayerIds = nextIds.length ? nextIds : [targetId];
          instance.document.selectedLayerId = targetId;
          instance.drag = { kind: "move", x: point.x, y: point.y, before: clone(instance.document), origins: activeSelection().map((id) => { const layer = instance.document.layers.find((item) => item.id === id); return { id, x: layer.x, y: layer.y }; }) };
          stage.setPointerCapture?.(event.pointerId);
          return;
        }
        if (instance.document.settings.activeTool === "pen") {
          instance.penPoints.push({ x: snapValue(instance.document, point.x), y: snapValue(instance.document, point.y) });
          if (event.detail >= 2 && instance.penPoints.length >= 2) {
            instance.document = operation(instance.document, "add-layer", { type: "path", name: "Bezier path", pathPoints: instance.penPoints, pathClosed: true, pathData: pathFromPoints(instance.penPoints, true), width: 240, height: 160, fill: "none", stroke: instance.document.brand.tokens["color.brand.primary"], strokeWidth: 4 });
            instance.penPoints = [];
            sync();
          } else redraw();
          return;
        }
        instance.drag = { kind: "marquee", x: event.offsetX, y: event.offsetY, start: point };
        if (marquee) { marquee.hidden = false; marquee.style.left = `${event.offsetX}px`; marquee.style.top = `${event.offsetY}px`; marquee.style.width = "0px"; marquee.style.height = "0px"; }
        stage.setPointerCapture?.(event.pointerId);
      });
      stage?.addEventListener("pointermove", (event) => {
        const drag = instance.drag;
        if (!drag) return;
        if (drag.kind === "pan") { stage.scrollLeft = drag.left - (event.clientX - drag.x); stage.scrollTop = drag.top - (event.clientY - drag.y); return; }
        const point = canvasPoint(event);
        if (drag.kind === "move") {
          const dx = point.x - drag.x;
          const dy = point.y - drag.y;
          drag.origins.forEach((origin) => { const layer = instance.document.layers.find((item) => item.id === origin.id); if (layer && !layer.locked) { layer.x = origin.x + dx; layer.y = origin.y + dy; } });
          updatePreview();
        } else if (drag.kind === "resize") {
          const layer = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId);
          if (layer) {
            const dx = point.x - drag.x;
            const dy = point.y - drag.y;
            if (drag.handle.includes("e")) layer.width = Math.max(1, drag.before.layers.find((item) => item.id === layer.id).width + dx);
            if (drag.handle.includes("s")) layer.height = Math.max(1, drag.before.layers.find((item) => item.id === layer.id).height + dy);
            if (drag.handle.includes("w")) { layer.x = drag.before.layers.find((item) => item.id === layer.id).x + dx; layer.width = Math.max(1, drag.before.layers.find((item) => item.id === layer.id).width - dx); }
            if (drag.handle.includes("n")) { layer.y = drag.before.layers.find((item) => item.id === layer.id).y + dy; layer.height = Math.max(1, drag.before.layers.find((item) => item.id === layer.id).height - dy); }
          }
        } else if (drag.kind === "rotate") {
          const layer = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId);
          const before = drag.before.layers.find((item) => item.id === layer?.id);
          if (layer && before) layer.rotation = before.rotation + (Math.atan2(point.y - drag.bounds.y - drag.bounds.height / 2, point.x - drag.bounds.x - drag.bounds.width / 2) * 180 / Math.PI) - (Math.atan2(drag.y - drag.bounds.y - drag.bounds.height / 2, drag.x - drag.bounds.x - drag.bounds.width / 2) * 180 / Math.PI);
        } else if (drag.kind === "anchor") {
          const layer = instance.document.layers.find((item) => item.id === instance.document.selectedLayerId);
          if (layer) { layer.anchorX = clamp((point.x - layer.x) / layer.width, 0, 1, 0.5); layer.anchorY = clamp((point.y - layer.y) / layer.height, 0, 1, 0.5); }
        } else if (drag.kind === "marquee" && marquee) {
          const left = Math.min(event.offsetX, drag.x); const top = Math.min(event.offsetY, drag.y); marquee.style.left = `${left}px`; marquee.style.top = `${top}px`; marquee.style.width = `${Math.abs(event.offsetX - drag.x)}px`; marquee.style.height = `${Math.abs(event.offsetY - drag.y)}px`;
        }
        updatePreview();
      });
      stage?.addEventListener("pointerup", (event) => {
        const drag = instance.drag;
        if (!drag) return;
        if (drag.kind === "move" || drag.kind === "resize" || drag.kind === "rotate" || drag.kind === "anchor") commitDrag();
        else if (drag.kind === "marquee") {
          const point = canvasPoint(event);
          const left = Math.min(drag.start.x, point.x); const top = Math.min(drag.start.y, point.y); const right = Math.max(drag.start.x, point.x); const bottom = Math.max(drag.start.y, point.y);
          const ids = instance.document.layers.filter((layer) => layer.frameId === activeFrame(instance.document)?.id && layer.x < right && layer.x + layer.width > left && layer.y < bottom && layer.y + layer.height > top).map((layer) => layer.id);
          instance.drag = null;
          if (marquee) marquee.hidden = true;
          selectLayers(ids);
        } else instance.drag = null;
      });
      currentShell.addEventListener("contextmenu", (event) => {
        const target = event.target.closest("[data-gdu-layer]");
        if (!target) return;
        event.preventDefault();
        selectLayers([target.dataset.gduLayer]);
        const menu = qs("[data-gdu-context-menu]");
        if (menu) { menu.hidden = false; menu.style.left = `${event.offsetX}px`; menu.style.top = `${event.offsetY}px`; }
      });
    }
    bind();
    const onKeyDown = (event) => {
      const target = event.target;
      const editing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "Escape") {
        qs("[data-gdu-context-menu]")?.setAttribute("hidden", "");
        qs("[data-gdu-command-dialog]")?.close?.();
        instance.document.settings.activeTool = "select";
        if (instance.presentation) onCommand("presentation-close");
        return;
      }
      if (editing) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); onCommand(event.shiftKey ? "redo" : "undo"); return; }
      if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); onCommand("redo"); return; }
      if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); onCommand("duplicate"); return; }
      if (mod && event.key.toLowerCase() === "g") { event.preventDefault(); onCommand("group"); return; }
      if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); onCommand("command-palette"); return; }
      if (event.shiftKey && event.key === "Enter") { event.preventDefault(); onCommand("presentation"); return; }
      if (event.shiftKey && event.key === "1") { event.preventDefault(); onCommand("fit"); return; }
      if (event.shiftKey && event.key === "2") { event.preventDefault(); onCommand("zoom-selection"); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onCommand("remove"); return; }
      const tools = { v: "select", p: "pen", t: "text", r: "rect", e: "ellipse" };
      if (tools[event.key.toLowerCase()]) { instance.document.settings.activeTool = tools[event.key.toLowerCase()]; instance.penPoints = []; redraw(); return; }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && activeSelection().length) {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        const changesById = Object.fromEntries(activeSelection().map((id) => {
          const layer = instance.document.layers.find((item) => item.id === id);
          return [id, { x: layer.x + dx, y: layer.y + dy }];
        }));
        instance.document = operation(instance.document, "update-layers", { changesById });
        sync();
      }
    };
    globalThis.addEventListener?.("keydown", onKeyDown);
    let fpsFrameHandle = 0;
    const sampleFrame = (nowTime) => {
      if (!host.isConnected) return;
      if (globalThis.document?.hidden) {
        instance.fpsFrames = 0;
        instance.fpsStartedAt = nowTime;
      } else {
        instance.fpsFrames += 1;
        const elapsed = nowTime - instance.fpsStartedAt;
        if (elapsed >= 1000) {
          instance.fps = Math.round(instance.fpsFrames * 1000 / elapsed);
          instance.fpsFrames = 0;
          instance.fpsStartedAt = nowTime;
          const fpsNode = qs("[data-gdu-fps]");
          if (fpsNode) fpsNode.textContent = `FPS ${instance.fps}`;
          if (instance.document.canvas.quality === "auto" && instance.fps < 30 && instance.mode === "galaxy") {
            instance.document.canvas.quality = "low";
            persist(instance.document, instance);
          }
        }
      }
      fpsFrameHandle = globalThis.requestAnimationFrame?.(sampleFrame) || 0;
    };
    if (globalThis.requestAnimationFrame) fpsFrameHandle = globalThis.requestAnimationFrame(sampleFrame);
    else {
      const fpsNode = qs("[data-gdu-fps]");
      if (fpsNode) fpsNode.textContent = "FPS không được trình duyệt cung cấp";
    }
    const onGalaxyPreferences = () => redraw();
    globalThis.addEventListener?.("hh:home-galaxy-preferences-applied", onGalaxyPreferences);
    const controller = {
      get document() { return clone(instance.document); },
      dispatch(type, payload) { instance.document = operation(instance.document, type, payload); sync(); return clone(instance.document); },
      select(ids) { selectLayers(Array.isArray(ids) ? ids : [ids]); return clone(instance.document); },
      undo() { instance.document = undo(instance.document); sync(); return clone(instance.document); },
      redo() { instance.document = redo(instance.document); sync(); return clone(instance.document); },
      health() { return runHealthScan(instance.document); },
      export() { return exportDocument(instance.document); },
      async putAsset(id, blob, meta) { return putAssetBlob(id, blob, meta); },
      async getAsset(id) { return getAssetBlob(id); },
      unmount() {
        globalThis.removeEventListener?.("hh:home-galaxy-preferences-applied", onGalaxyPreferences);
        globalThis.removeEventListener?.("keydown", onKeyDown);
        if (fpsFrameHandle) globalThis.cancelAnimationFrame?.(fpsFrameHandle);
        instance.aiControllers.forEach((controller) => controller.abort());
        instance.aiControllers.clear();
        host.querySelector("[data-gdu-shell]")?.remove();
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

  const api = Object.freeze({ VERSION, FORMAT, STORAGE_KEY, GALAXY_PREF_KEY, PLANETS, defaultDocument, normalizeLayer, normalizeDocument, serializableDocument, snapshotDocument, documentChanges, applyChanges, pathFromPoints, operation, undo, redo, runHealthScan, exportDocument, importDocument, putAssetBlob, getAssetBlob, removeAssetBlob, checksumBlob, assetRecordFromBlob, mount, unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalThis.HHGraphicDesignUniversal = api;
})();
