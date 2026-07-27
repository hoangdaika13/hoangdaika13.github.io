(() => {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-design-document";
  const STORAGE_KEY = "hh.graphic-design.universal.v1";
  const MAX_COMMANDS = 80;
  const MAX_JOBS = 30;
  const MAX_COMMENTS = 80;
  const MAX_ASSETS = 200;
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
      canvas: { width: 1440, height: 900, background: "#07101d", grid: 8, zoom: 1 },
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
      layers: [{
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
      }],
      assets: [],
      components: [],
      variables: { collections: [{ id: "global", name: "Global", modes: ["default", "dark"] }] },
      brand: clone(DEFAULT_BRAND),
      commandLog: [],
      history: { past: [], future: [] },
      versions: [],
      branches: [{ id: "main", name: "main", parent: null, createdAt: now() }],
      comments: [],
      approvals: [],
      jobs: [],
      selectedLayerId: titleId,
      activePageId: pageId,
      activeFrameId: frameId,
      updatedAt: now(),
      ...clone(input)
    };
  }

  function normalizeLayer(layer, frameId) {
    const source = layer && typeof layer === "object" ? layer : {};
    const allowedTypes = new Set(["rect", "ellipse", "text", "image", "video", "audio", "group", "path", "3d"]);
    return {
      id: text(source.id || uid("layer"), uid("layer")),
      frameId: text(source.frameId || frameId, frameId),
      name: text(source.name || "Layer", "Layer"),
      type: allowedTypes.has(source.type) ? source.type : "rect",
      x: number(source.x),
      y: number(source.y),
      width: Math.max(1, number(source.width, 200)),
      height: Math.max(1, number(source.height, 120)),
      rotation: clamp(source.rotation, -360, 360, 0),
      opacity: clamp(source.opacity, 0, 1, 1),
      visible: source.visible !== false,
      locked: source.locked === true,
      text: text(source.text),
      fontFamily: text(source.fontFamily || "Inter", "Inter"),
      fontSize: clamp(source.fontSize, 6, 320, 16),
      fontWeight: clamp(source.fontWeight, 100, 900, 400),
      fill: safeColor(source.fill, "#63e8ff"),
      stroke: source.stroke === "none" ? "none" : safeColor(source.stroke, "#63e8ff"),
      strokeWidth: clamp(source.strokeWidth, 0, 80, 0),
      blendMode: text(source.blendMode || "normal", "normal"),
      assetId: source.assetId ? text(source.assetId) : null,
      altText: text(source.altText),
      pathData: text(source.pathData),
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
      grid: clamp(source.canvas?.grid, 1, 128, base.canvas.grid)
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
    merged.layers = (Array.isArray(source.layers) ? source.layers : base.layers).slice(0, 2000).map((layer) => normalizeLayer(layer, merged.frames[0]?.id || ""));
    merged.assets = (Array.isArray(source.assets) ? source.assets : []).slice(0, MAX_ASSETS).map((asset) => ({
      id: text(asset.id || uid("asset"), uid("asset")),
      name: text(asset.name || "Asset", "Asset"),
      kind: text(asset.kind || "other", "other"),
      type: text(asset.type || "application/octet-stream"),
      size: Math.max(0, number(asset.size)),
      checksum: text(asset.checksum),
      source: text(asset.source || "local", "local"),
      license: text(asset.license || "unknown", "unknown"),
      status: ["ready", "missing", "offline", "processing"].includes(asset.status) ? asset.status : "ready",
      width: number(asset.width),
      height: number(asset.height),
      altText: text(asset.altText),
      createdAt: text(asset.createdAt || now(), now())
    }));
    merged.components = Array.isArray(source.components) ? source.components.slice(0, 500).map((component) => ({
      id: text(component.id || uid("component"), uid("component")),
      name: text(component.name || "Component", "Component"),
      masterLayerId: text(component.masterLayerId),
      variants: Array.isArray(component.variants) ? component.variants.slice(0, 50).map((variant) => ({ id: text(variant.id || uid("variant"), uid("variant")), name: text(variant.name || "Default", "Default"), properties: variant.properties && typeof variant.properties === "object" ? clone(variant.properties) : {} })) : []
    })) : [];
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
    merged.selectedLayerId = text(source.selectedLayerId || merged.layers[0]?.id);
    merged.activePageId = text(source.activePageId || merged.pages[0]?.id);
    merged.activeFrameId = text(source.activeFrameId || merged.frames[0]?.id);
    merged.updatedAt = text(source.updatedAt || now(), now());
    return merged;
  }

  function serializableDocument(document) {
    const value = clone(normalizeDocument(document));
    value.history = { past: [], future: [] };
    return value;
  }

  function snapshotDocument(document) {
    const value = serializableDocument(document);
    value.commandLog = [];
    value.versions = [];
    return value;
  }

  function operation(document, type, payload = {}) {
    const next = normalizeDocument(document);
    const before = snapshotDocument(next);
    const frameId = text(payload.frameId || next.activeFrameId || next.frames[0]?.id);
    if (type === "add-frame") {
      const id = uid("frame");
      next.frames.push({ id, pageId: text(payload.pageId || next.activePageId, next.pages[0]?.id || ""), name: text(payload.name || `Frame ${next.frames.length + 1}`), x: number(payload.x), y: number(payload.y), width: clamp(payload.width, 1, 100000, 800), height: clamp(payload.height, 1, 100000, 500), background: safeColor(payload.background, next.canvas.background), breakpoint: text(payload.breakpoint || "desktop", "desktop") });
      const page = next.pages.find((item) => item.id === next.frames.at(-1).pageId) || next.pages[0];
      page?.frameIds.push(id);
      next.activeFrameId = id;
    } else if (type === "add-layer") {
      const id = uid("layer");
      const kind = ["rect", "ellipse", "text", "image", "video", "audio", "group", "path", "3d"].includes(payload.type) ? payload.type : "rect";
      next.layers.push(normalizeLayer({ ...payload, id, frameId, type: kind, name: payload.name || `${kind} layer`, x: payload.x ?? 120, y: payload.y ?? 120, width: payload.width ?? 240, height: payload.height ?? 140, fill: payload.fill || next.brand.tokens["color.brand.secondary"] }, frameId));
      next.selectedLayerId = id;
    } else if (type === "update-layer") {
      const layer = next.layers.find((item) => item.id === payload.id);
      if (layer && !layer.locked) Object.assign(layer, normalizeLayer({ ...layer, ...payload.changes }, layer.frameId));
    } else if (type === "remove-layer") {
      next.layers = next.layers.filter((item) => item.id !== payload.id);
      next.selectedLayerId = next.layers.find((item) => item.frameId === frameId)?.id || "";
    } else if (type === "duplicate-layer") {
      const source = next.layers.find((item) => item.id === payload.id);
      if (source) {
        const duplicate = normalizeLayer({ ...source, id: uid("layer"), name: `${source.name} copy`, x: source.x + 24, y: source.y + 24 }, source.frameId);
        next.layers.push(duplicate);
        next.selectedLayerId = duplicate.id;
      }
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
      const job = { id: text(incoming.id || uid("job"), uid("job")), kind: text(incoming.kind || "design-ai", "design-ai"), status: ["queued", "running", "completed", "failed", "cancelled"].includes(incoming.status) ? incoming.status : "queued", provider: text(incoming.provider || "auto", "auto"), model: text(incoming.model || "auto", "auto"), input: text(incoming.input), output: text(incoming.output), error: text(incoming.error), usage: incoming.usage && typeof incoming.usage === "object" ? clone(incoming.usage) : null, createdAt: text(incoming.createdAt || now(), now()), updatedAt: now() };
      if (existing) Object.assign(existing, job);
      else next.jobs.push(job);
      next.jobs = next.jobs.slice(-MAX_JOBS);
    }
    const after = snapshotDocument(next);
    const command = { id: uid("cmd"), type, payload: clone(payload), before, after, createdAt: now(), branch: next.branch };
    next.commandLog = [...next.commandLog, command].slice(-MAX_COMMANDS);
    next.history = { past: [...(document?.history?.past || []), command.id].slice(-MAX_COMMANDS), future: [] };
    next.updatedAt = now();
    return next;
  }

  function undo(document) {
    const current = normalizeDocument(document);
    const command = current.commandLog.find((item) => item.id === current.history.past.at(-1));
    if (!command) return current;
    const restored = normalizeDocument(command.before);
    restored.commandLog = current.commandLog;
    restored.history = { past: current.history.past.slice(0, -1), future: [command.id, ...current.history.future].slice(0, MAX_COMMANDS) };
    restored.updatedAt = now();
    return restored;
  }

  function redo(document) {
    const current = normalizeDocument(document);
    const command = current.commandLog.find((item) => item.id === current.history.future[0]);
    if (!command) return current;
    const applied = normalizeDocument(command.after);
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
    if (!doc.pages.length) issues.push({ id: "pages", severity: "error", message: "Tài liệu chưa có page." });
    if (!doc.frames.length) issues.push({ id: "frames", severity: "error", message: "Tài liệu chưa có frame." });
    doc.layers.forEach((layer) => {
      if (!frameIds.has(layer.frameId)) issues.push({ id: `orphan-${layer.id}`, severity: "error", message: `${layer.name} không còn frame liên kết.` });
      if (!layer.visible && !layer.locked) issues.push({ id: `hidden-${layer.id}`, severity: "info", message: `${layer.name} đang ẩn nhưng chưa khóa.` });
      if (layer.type === "text" && !layer.text.trim()) issues.push({ id: `text-${layer.id}`, severity: "error", message: `${layer.name} chưa có nội dung.` });
      if (layer.type === "image" && !layer.altText.trim()) issues.push({ id: `alt-${layer.id}`, severity: "warning", message: `${layer.name} thiếu alt text.` });
      if (layer.type === "text" && contrastRatio(layer.fill, doc.canvas.background) < 4.5) issues.push({ id: `contrast-${layer.id}`, severity: "warning", message: `${layer.name} có contrast dưới WCAG AA.` });
    });
    doc.assets.forEach((asset) => {
      if (asset.status !== "ready") issues.push({ id: `asset-${asset.id}`, severity: "error", message: `${asset.name}: asset ${asset.status}.` });
      if (asset.license === "unknown") issues.push({ id: `license-${asset.id}`, severity: "warning", message: `${asset.name} chưa có nguồn hoặc license.` });
      if (asset.kind === "image" && asset.width && asset.width < 800) issues.push({ id: `resolution-${asset.id}`, severity: "warning", message: `${asset.name} có độ phân giải thấp.` });
    });
    return { ok: !issues.some((issue) => issue.severity === "error"), issues, scannedAt: now(), summary: { errors: issues.filter((issue) => issue.severity === "error").length, warnings: issues.filter((issue) => issue.severity === "warning").length, info: issues.filter((issue) => issue.severity === "info").length } };
  }

  function exportDocument(document) {
    return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now(), document: serializableDocument(document) }, null, 2);
  }

  function importDocument(input) {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    if (!parsed || parsed.format !== FORMAT || !parsed.document) throw new Error("Tệp HH Design không hợp lệ.");
    return normalizeDocument(parsed.document);
  }

  function readStored() {
    try { return normalizeDocument(JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null")); } catch { return defaultDocument(); }
  }

  function writeStored(document) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(serializableDocument(document)));
      return true;
    } catch { return false; }
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

  function layerSVG(layer) {
    const selected = layer.id === this.selectedLayerId ? " is-selected" : "";
    const attrs = `data-gdu-layer="${escapeHTML(layer.id)}" class="${selected.trim()}" transform="rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})" opacity="${layer.opacity}" style="mix-blend-mode:${escapeHTML(layer.blendMode)}"`;
    const stroke = layer.stroke === "none" ? "none" : escapeHTML(layer.stroke);
    if (layer.type === "ellipse") return `<ellipse ${attrs} cx="${layer.x + layer.width / 2}" cy="${layer.y + layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${escapeHTML(layer.fill)}" stroke="${stroke}" stroke-width="${layer.strokeWidth}"></ellipse>`;
    if (layer.type === "text") return `<text ${attrs} x="${layer.x}" y="${layer.y + layer.fontSize}" fill="${escapeHTML(layer.fill)}" font-family="${escapeHTML(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}">${escapeHTML(layer.text || "Text")}</text>`;
    if (layer.type === "image" && layer.metadata?.dataUrl) return `<image ${attrs} href="${escapeHTML(layer.metadata.dataUrl)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid slice"></image>`;
    return `<rect ${attrs} x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="14" fill="${escapeHTML(layer.fill)}" stroke="${stroke}" stroke-width="${layer.strokeWidth}"></rect>`;
  }

  function renderCanvas(documentState, zoom) {
    const frame = activeFrame(documentState);
    if (!frame) return `<div class="gdu-empty">Chưa có frame để hiển thị.</div>`;
    const layers = documentState.layers.filter((layer) => layer.frameId === frame.id && layer.visible);
    const grid = documentState.canvas.grid;
    const width = Math.max(320, Math.round(frame.width * zoom));
    return `<svg data-gdu-canvas viewBox="0 0 ${frame.width} ${frame.height}" width="${width}" role="img" aria-label="${escapeHTML(frame.name)}"><defs><pattern id="gdu-grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M ${grid} 0 L 0 0 0 ${grid}" fill="none" stroke="rgba(127,199,255,.09)" stroke-width="1"></path></pattern></defs><rect x="0" y="0" width="${frame.width}" height="${frame.height}" fill="${escapeHTML(frame.background)}"></rect><rect x="0" y="0" width="${frame.width}" height="${frame.height}" fill="url(#gdu-grid)" pointer-events="none"></rect>${layers.map(layerSVG.bind(documentState)).join("")}</svg>`;
  }

  function renderShell(documentState, mode, focus, zoom = 1, compact = false) {
    const frame = activeFrame(documentState);
    const selected = documentState.layers.find((layer) => layer.id === documentState.selectedLayerId);
    const activePlanet = PLANETS.find((planet) => planet.id === focus) || PLANETS[0];
    const jobs = documentState.jobs.slice(-3).reverse();
    const health = runHealthScan(documentState);
    const galaxy = galaxyProfile();
    return `<section class="gdu-shell" data-gdu-shell data-gdu-mode="${escapeHTML(mode)}" data-gdu-motion="${escapeHTML(galaxy.motion)}" data-gdu-compact="${compact}" style="--planet-tone:${activePlanet.tone};--gdu-cyan:${galaxy.primary};--gdu-pink:${galaxy.secondary}">
      <header class="gdu-top"><div><h3>Universal Design Document</h3><p>${escapeHTML(documentState.name)} · nhánh ${escapeHTML(documentState.branch)} · ${documentState.layers.length} layer · ${documentState.assets.length} asset</p></div><div class="gdu-top-actions"><button type="button" data-gdu-command="toggle-shell">${compact ? "Mở Universal Canvas" : "Thu gọn Canvas"}</button><button type="button" data-gdu-command="undo" aria-label="Hoàn tác">↶</button><button type="button" data-gdu-command="redo" aria-label="Làm lại">↷</button><button type="button" data-gdu-command="add-frame">＋ Frame</button><button type="button" data-gdu-command="save">Lưu</button><button type="button" class="gdu-primary" data-gdu-command="export">Xuất .hhdesign</button></div></header>
      <div class="gdu-layout">
        <nav class="gdu-planets" aria-label="Design planets">${PLANETS.map((planet) => `<button type="button" class="gdu-planet ${planet.id === activePlanet.id ? "is-active" : ""}" data-gdu-planet="${planet.id}" style="--planet-tone:${planet.tone}" title="${escapeHTML(planet.description)}"><i aria-hidden="true"></i><span><b>${escapeHTML(planet.label)}</b><small>${escapeHTML(planet.description)}</small></span></button>`).join("")}</nav>
        <section class="gdu-lab"><div class="gdu-toolbar"><button type="button" data-gdu-command="add-rect">＋ Rect</button><button type="button" data-gdu-command="add-text">＋ Text</button><button type="button" data-gdu-command="add-ellipse">＋ Ellipse</button><button type="button" data-gdu-command="duplicate">Duplicate</button><button type="button" data-gdu-command="remove">Delete</button><span class="gdu-spacer"></span><button type="button" data-gdu-command="zoom-out">−</button><span data-gdu-zoom>${Math.round(zoom * 100)}%</span><button type="button" data-gdu-command="zoom-in">＋</button><select data-gdu-mode aria-label="Chế độ hiển thị"><option value="studio" ${mode === "studio" ? "selected" : ""}>Studio</option><option value="galaxy" ${mode === "galaxy" ? "selected" : ""}>Galaxy</option><option value="focus" ${mode === "focus" ? "selected" : ""}>Focus</option></select></div><div class="gdu-stage" data-gdu-stage>${renderCanvas(documentState, zoom)}<div class="gdu-layers" aria-label="Layer tree">${documentState.layers.filter((layer) => layer.frameId === frame?.id).slice().reverse().map((layer) => `<button type="button" class="gdu-layer ${layer.id === documentState.selectedLayerId ? "is-selected" : ""}" data-gdu-layer-button="${escapeHTML(layer.id)}">${escapeHTML(layer.name)}</button>`).join("") || `<span class="gdu-empty">Chưa có layer.</span>`}</div></div></section>
        <aside class="gdu-inspector"><section><h4>Inspector</h4>${selected ? `<label class="gdu-field">Tên layer<input data-gdu-field="name" value="${escapeHTML(selected.name)}"></label><div class="gdu-pills"><span class="gdu-pill">${escapeHTML(selected.type)}</span><span class="gdu-pill">${selected.visible ? "visible" : "hidden"}</span>${selected.locked ? `<span class="gdu-pill">locked</span>` : ""}</div><div class="gdu-pills"><label class="gdu-field">X<input type="number" data-gdu-field="x" value="${selected.x}"></label><label class="gdu-field">Y<input type="number" data-gdu-field="y" value="${selected.y}"></label></div><div class="gdu-pills"><label class="gdu-field">W<input type="number" min="1" data-gdu-field="width" value="${selected.width}"></label><label class="gdu-field">H<input type="number" min="1" data-gdu-field="height" value="${selected.height}"></label></div>${selected.type === "text" ? `<label class="gdu-field">Nội dung<textarea class="gdu-ai-input" data-gdu-field="text">${escapeHTML(selected.text)}</textarea></label>` : ""}<label class="gdu-field">Opacity<input type="range" min="0" max="1" step=".01" data-gdu-field="opacity" value="${selected.opacity}"></label>` : `<div class="gdu-empty">Chọn một layer để chỉnh.</div>`}</section><section class="gdu-health"><strong>Design Health</strong><div>${health.ok ? "Không có lỗi chặn export." : `${health.summary.errors} lỗi cần xử lý.`}</div><ul>${health.issues.slice(0, 4).map((issue) => `<li>${escapeHTML(issue.message)}</li>`).join("") || "<li>Chưa có cảnh báo.</li>"}</ul><button type="button" data-gdu-command="scan">Quét lại</button></section><section class="gdu-ai"><strong>Design AI Copilot</strong><textarea class="gdu-ai-input" data-gdu-ai-input placeholder="Ví dụ: tạo 3 layout hero neon cho mobile"></textarea><button type="button" class="gdu-primary" data-gdu-ai-run>Chạy AI</button><div class="gdu-job" data-gdu-job>${jobs[0] ? `${escapeHTML(jobs[0].status)} · ${escapeHTML(jobs[0].output || jobs[0].error || jobs[0].kind)}` : "Chưa có AI job."}</div></section></aside>
      </div><footer class="gdu-footer"><span><b>${escapeHTML(activePlanet.label)}</b> · ${escapeHTML(activePlanet.description)}</span><span data-gdu-status>Đã lưu local-first · ${escapeHTML(documentState.updatedAt)}</span></footer><div class="gdu-toast" data-gdu-toast hidden></div></section>`;
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

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    addStyles();
    const host = root.querySelector(".gd-main") || root;
    let documentState = readStored();
    const instance = { document: documentState, zoom: 1, focus: "design", mode: "studio", compact: Boolean(options.view && options.view !== "overview"), mirrorBusy: false };
    host.insertAdjacentHTML("afterbegin", renderShell(documentState, instance.mode, instance.focus, instance.zoom, instance.compact));
    let shell = host.querySelector("[data-gdu-shell]");
    const qs = (selector) => shell?.querySelector(selector);
    const toast = (message) => { const element = qs("[data-gdu-toast]"); if (!element) return; element.textContent = message; element.hidden = false; clearTimeout(instance.toastTimer); instance.toastTimer = setTimeout(() => { element.hidden = true; }, 2600); };
    const redraw = () => { shell.outerHTML = renderShell(instance.document, instance.mode, instance.focus, instance.zoom, instance.compact); shell = host.querySelector("[data-gdu-shell]"); bind(); };
    const sync = () => { persist(instance.document, instance); redraw(); };
    const setStatus = (message) => { const element = shell.querySelector("[data-gdu-status]"); if (element) element.textContent = message; };
    const updateLayer = (field, value) => {
      const selected = instance.document.layers.find((layer) => layer.id === instance.document.selectedLayerId);
      if (!selected || selected.locked) return;
      const changes = { [field]: ["x", "y", "width", "height", "opacity"].includes(field) ? number(value, selected[field]) : text(value) };
      instance.document = operation(instance.document, "update-layer", { id: selected.id, changes });
      sync();
    };
    const runAI = async () => {
      const input = text(qs("[data-gdu-ai-input]")?.value);
      if (!input) return toast("Hãy nhập yêu cầu thiết kế.");
      const jobId = uid("job");
      instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: "design-plan", status: "running", provider: "auto", model: "auto", input } });
      sync();
      try {
        const payload = {
          actionType: "design-plan",
          input,
          meta: {
            provider: "auto",
            model: "auto",
            requireProvider: true,
            allowProviderFallback: true,
            context: JSON.stringify({
              documentId: instance.document.id,
              frame: activeFrame(instance.document),
              layers: instance.document.layers.slice(0, 20).map(({ id, name, type, text }) => ({ id, name, type, text }))
            })
          }
        };
        const response = await fetch(`${options.apiBase || ""}/api/modules/ai-center/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || data?.message || `AI HTTP ${response.status}`);
        const action = data.action || {};
        instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: "design-plan", status: "completed", provider: action.provider, model: action.model, input, output: action.output || JSON.stringify(action.structured || {}) } });
        sync();
        toast(`AI hoàn tất bằng ${action.provider || "provider"}.`);
      } catch (error) {
        instance.document = operation(instance.document, "set-job", { job: { id: jobId, kind: "design-plan", status: "failed", input, error: text(error.message || "Không thể kết nối AI.") } });
        sync();
        toast("AI lỗi: " + text(error.message || "Không thể kết nối AI."));
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
      else if (command === "duplicate" && instance.document.selectedLayerId) instance.document = operation(instance.document, "duplicate-layer", { id: instance.document.selectedLayerId });
      else if (command === "remove" && instance.document.selectedLayerId) instance.document = operation(instance.document, "remove-layer", { id: instance.document.selectedLayerId });
      else if (command === "set-approval") instance.document = operation(instance.document, "set-approval", { status: "review" });
      else if (command === "scan") { const result = runHealthScan(instance.document); return toast(result.ok ? "Design Health: không có lỗi chặn export." : `Design Health: ${result.summary.errors} lỗi, ${result.summary.warnings} cảnh báo.`); }
      else if (command === "save") { persist(instance.document, instance); return toast("Đã lưu Universal Design Document."); }
      else if (command === "export") { download("hh-design-document.json", exportDocument(instance.document)); return toast("Đã xuất tài liệu thiết kế."); }
      else if (command === "zoom-in") instance.zoom = clamp(instance.zoom + 0.1, 0.5, 2.5);
      else if (command === "zoom-out") instance.zoom = clamp(instance.zoom - 0.1, 0.5, 2.5);
      else return;
      sync();
    };
    function bind() {
      const currentShell = host.querySelector("[data-gdu-shell]");
      if (!currentShell) return;
      currentShell.addEventListener("click", (event) => {
        const commandButton = event.target.closest("[data-gdu-command]");
        if (commandButton) return onCommand(commandButton.dataset.gduCommand);
        const planet = event.target.closest("[data-gdu-planet]");
        if (planet) { instance.focus = planet.dataset.gduPlanet; return sync(); }
        const layer = event.target.closest("[data-gdu-layer], [data-gdu-layer-button]");
        if (layer) { instance.document.selectedLayerId = layer.dataset.gduLayer || layer.dataset.gduLayerButton; return sync(); }
        if (event.target.closest("[data-gdu-ai-run]")) return runAI();
      });
      currentShell.addEventListener("change", (event) => {
        if (event.target.matches("[data-gdu-field]")) updateLayer(event.target.dataset.gduField, event.target.value);
        if (event.target.matches("[data-gdu-mode]")) { instance.mode = event.target.value; return sync(); }
      });
      currentShell.querySelector("[data-gdu-canvas]")?.addEventListener("click", (event) => {
        const target = event.target.closest("[data-gdu-layer]");
        if (target) { instance.document.selectedLayerId = target.dataset.gduLayer; sync(); }
      });
    }
    bind();
    const onGalaxyPreferences = () => redraw();
    globalThis.addEventListener?.("hh:home-galaxy-preferences-applied", onGalaxyPreferences);
    const controller = { get document() { return clone(instance.document); }, dispatch(type, payload) { instance.document = operation(instance.document, type, payload); sync(); return clone(instance.document); }, undo() { instance.document = undo(instance.document); sync(); return clone(instance.document); }, redo() { instance.document = redo(instance.document); sync(); return clone(instance.document); }, health() { return runHealthScan(instance.document); }, export() { return exportDocument(instance.document); }, unmount() { globalThis.removeEventListener?.("hh:home-galaxy-preferences-applied", onGalaxyPreferences); host.querySelector("[data-gdu-shell]")?.remove(); instances.delete(root); } };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    return true;
  }

  const api = Object.freeze({ VERSION, FORMAT, STORAGE_KEY, GALAXY_PREF_KEY, PLANETS, defaultDocument, normalizeLayer, normalizeDocument, serializableDocument, snapshotDocument, operation, undo, redo, runHealthScan, exportDocument, importDocument, mount, unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalThis.HHGraphicDesignUniversal = api;
})();
