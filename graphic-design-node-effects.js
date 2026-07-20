(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-node-effects";
  const STORAGE_KEY = "hh.graphic-node-effects.graph.v1";
  const STYLE_ID = "hh-graphic-node-effects-styles-v1";
  const MAX_NODES = 80;
  const MAX_CONNECTIONS = 180;
  const MAX_GROUPS = 24;
  const MAX_IMAGE_DATA_LENGTH = 6 * 1024 * 1024;
  const mounted = new WeakMap();
  const imageCache = new Map();

  const NODE_DEFINITIONS = Object.freeze({
    Source: { label: "Source", color: "#43d9ad", inputs: 0 },
    Blur: { label: "Blur", color: "#71b7ff", inputs: 1 },
    Glow: { label: "Glow", color: "#f0cf65", inputs: 1 },
    Shadow: { label: "Shadow", color: "#a994ff", inputs: 1 },
    Distortion: { label: "Distortion", color: "#ff7aa8", inputs: 1 },
    Color: { label: "Color", color: "#ff9b5f", inputs: 1 },
    Mask: { label: "Mask", color: "#7ed5e8", inputs: 1 },
    Blend: { label: "Blend", color: "#c9ed72", inputs: 2 },
    Output: { label: "Output", color: "#f5f7fb", inputs: 1 }
  });
  const NODE_TYPES = Object.freeze(Object.keys(NODE_DEFINITIONS));
  const BLEND_MODES = Object.freeze(["source-over", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "soft-light", "difference"]);
  const PRESETS = Object.freeze([
    { id: "soft-glow", name: "Soft glow", values: { Blur: { radius: 2 }, Glow: { size: 16, opacity: 0.58, color: "#64e6ff" }, Shadow: { x: 8, y: 12, blur: 18, opacity: 0.34 }, Distortion: { amount: 0 }, Color: { saturation: 118, contrast: 106, hue: 0 }, Mask: { shape: "vignette", size: 82, feather: 36 }, Blend: { mode: "screen", opacity: 22 } } },
    { id: "cinematic", name: "Cinematic", values: { Blur: { radius: 0 }, Glow: { size: 8, opacity: 0.28, color: "#ffb36b" }, Shadow: { x: 14, y: 18, blur: 24, opacity: 0.48 }, Distortion: { amount: 0 }, Color: { brightness: 92, contrast: 126, saturation: 78, hue: -8, tint: "#1e6f87", tintAmount: 14 }, Mask: { shape: "vignette", size: 72, feather: 44 }, Blend: { mode: "soft-light", opacity: 34 } } },
    { id: "liquid-wave", name: "Liquid wave", values: { Blur: { radius: 1 }, Glow: { size: 10, opacity: 0.4, color: "#55f0c4" }, Shadow: { x: 4, y: 9, blur: 14, opacity: 0.3 }, Distortion: { amount: 18, wavelength: 54, phase: 28, direction: "horizontal" }, Color: { brightness: 104, contrast: 112, saturation: 138, hue: 18 }, Mask: { shape: "radial", size: 88, feather: 24 }, Blend: { mode: "screen", opacity: 28 } } },
    { id: "mono-poster", name: "Mono poster", values: { Blur: { radius: 0 }, Glow: { size: 4, opacity: 0.2, color: "#ffffff" }, Shadow: { x: 12, y: 12, blur: 0, opacity: 0.72 }, Distortion: { amount: 3, wavelength: 24, phase: 0, direction: "vertical" }, Color: { brightness: 104, contrast: 154, saturation: 0, hue: 0 }, Mask: { shape: "linear", size: 100, feather: 12 }, Blend: { mode: "multiply", opacity: 20 } } }
  ]);

  const PARAM_FIELDS = Object.freeze({
    Source: [
      { key: "mode", label: "Artwork", type: "select", options: ["poster", "rings", "grid"] },
      { key: "background", label: "Background", type: "color" },
      { key: "accent", label: "Accent", type: "color" },
      { key: "text", label: "Title", type: "text", max: 80 }
    ],
    Blur: [{ key: "radius", label: "Radius", type: "range", min: 0, max: 36, step: 1 }],
    Glow: [
      { key: "color", label: "Color", type: "color" },
      { key: "size", label: "Size", type: "range", min: 0, max: 48, step: 1 },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.01 }
    ],
    Shadow: [
      { key: "color", label: "Color", type: "color" },
      { key: "x", label: "Offset X", type: "range", min: -60, max: 60, step: 1 },
      { key: "y", label: "Offset Y", type: "range", min: -60, max: 60, step: 1 },
      { key: "blur", label: "Blur", type: "range", min: 0, max: 60, step: 1 },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.01 }
    ],
    Distortion: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 48, step: 1 },
      { key: "wavelength", label: "Wavelength", type: "range", min: 8, max: 180, step: 1 },
      { key: "phase", label: "Phase", type: "range", min: -180, max: 180, step: 1 },
      { key: "direction", label: "Direction", type: "select", options: ["horizontal", "vertical"] }
    ],
    Color: [
      { key: "brightness", label: "Brightness", type: "range", min: 0, max: 200, step: 1 },
      { key: "contrast", label: "Contrast", type: "range", min: 0, max: 200, step: 1 },
      { key: "saturation", label: "Saturation", type: "range", min: 0, max: 200, step: 1 },
      { key: "hue", label: "Hue", type: "range", min: -180, max: 180, step: 1 },
      { key: "tint", label: "Tint", type: "color" },
      { key: "tintAmount", label: "Tint mix", type: "range", min: 0, max: 100, step: 1 }
    ],
    Mask: [
      { key: "shape", label: "Shape", type: "select", options: ["radial", "linear", "vignette"] },
      { key: "size", label: "Size", type: "range", min: 10, max: 100, step: 1 },
      { key: "feather", label: "Feather", type: "range", min: 0, max: 80, step: 1 },
      { key: "invert", label: "Invert", type: "checkbox" }
    ],
    Blend: [
      { key: "mode", label: "Mode", type: "select", options: BLEND_MODES },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 100, step: 1 }
    ],
    Output: [{ key: "background", label: "Background", type: "text", max: 32 }]
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix || "item"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function safeText(value, fallback, maxLength) {
    return String(value == null ? (fallback || "") : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 120);
  }

  function safeId(value, fallback) {
    const id = String(value == null ? "" : value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return id || fallback || uid("node");
  }

  function safeColor(value, fallback, allowTransparent) {
    const text = String(value == null ? "" : value).trim();
    if (allowTransparent && text === "transparent") return text;
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(text) ? text : fallback;
  }

  function safeImageData(value) {
    const text = String(value == null ? "" : value);
    if (text.length > MAX_IMAGE_DATA_LENGTH) return "";
    return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(text) ? text : "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function defaultParams(type) {
    const defaults = {
      Source: { mode: "poster", background: "#101824", accent: "#39d9b0", text: "NODE EFFECTS", imageData: "" },
      Blur: { radius: 2 },
      Glow: { color: "#61e9ff", size: 14, opacity: 0.5 },
      Shadow: { color: "#05070d", x: 10, y: 14, blur: 18, opacity: 0.42 },
      Distortion: { amount: 7, wavelength: 64, phase: 0, direction: "horizontal" },
      Color: { brightness: 100, contrast: 112, saturation: 122, hue: 0, tint: "#ff6f91", tintAmount: 6 },
      Mask: { shape: "vignette", size: 86, feather: 30, invert: false },
      Blend: { mode: "screen", opacity: 24 },
      Output: { background: "#080b11" }
    };
    return clone(defaults[type]);
  }

  function normalizeParams(type, raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const fallback = defaultParams(type);
    if (type === "Source") return {
      mode: ["poster", "rings", "grid"].includes(input.mode) ? input.mode : fallback.mode,
      background: safeColor(input.background, fallback.background),
      accent: safeColor(input.accent, fallback.accent),
      text: safeText(input.text, fallback.text, 80),
      imageData: safeImageData(input.imageData)
    };
    if (type === "Blur") return { radius: clamp(input.radius, 0, 36, fallback.radius) };
    if (type === "Glow") return { color: safeColor(input.color, fallback.color), size: clamp(input.size, 0, 48, fallback.size), opacity: clamp(input.opacity, 0, 1, fallback.opacity) };
    if (type === "Shadow") return { color: safeColor(input.color, fallback.color), x: clamp(input.x, -60, 60, fallback.x), y: clamp(input.y, -60, 60, fallback.y), blur: clamp(input.blur, 0, 60, fallback.blur), opacity: clamp(input.opacity, 0, 1, fallback.opacity) };
    if (type === "Distortion") return { amount: clamp(input.amount, 0, 48, fallback.amount), wavelength: clamp(input.wavelength, 8, 180, fallback.wavelength), phase: clamp(input.phase, -180, 180, fallback.phase), direction: ["horizontal", "vertical"].includes(input.direction) ? input.direction : fallback.direction };
    if (type === "Color") return { brightness: clamp(input.brightness, 0, 200, fallback.brightness), contrast: clamp(input.contrast, 0, 200, fallback.contrast), saturation: clamp(input.saturation, 0, 200, fallback.saturation), hue: clamp(input.hue, -180, 180, fallback.hue), tint: safeColor(input.tint, fallback.tint), tintAmount: clamp(input.tintAmount, 0, 100, fallback.tintAmount) };
    if (type === "Mask") return { shape: ["radial", "linear", "vignette"].includes(input.shape) ? input.shape : fallback.shape, size: clamp(input.size, 10, 100, fallback.size), feather: clamp(input.feather, 0, 80, fallback.feather), invert: input.invert === true || input.invert === "true" };
    if (type === "Blend") return { mode: BLEND_MODES.includes(input.mode) ? input.mode : fallback.mode, opacity: clamp(input.opacity, 0, 100, fallback.opacity) };
    return { background: safeColor(input.background, fallback.background, true) };
  }

  function normalizeNode(raw, index) {
    const type = NODE_TYPES.includes(raw && raw.type) ? raw.type : "Blur";
    return {
      id: safeId(raw && raw.id, `${type.toLowerCase()}-${index + 1}`),
      type,
      name: safeText(raw && raw.name, NODE_DEFINITIONS[type].label, 64) || NODE_DEFINITIONS[type].label,
      enabled: !(raw && raw.enabled === false),
      order: Math.round(clamp(raw && raw.order, 0, MAX_NODES - 1, index)),
      x: Math.round(clamp(raw && raw.x, 0, 1600, 40 + (index % 4) * 205)),
      y: Math.round(clamp(raw && raw.y, 0, 1000, 50 + Math.floor(index / 4) * 150)),
      groupId: raw && raw.groupId ? safeId(raw.groupId, "") : null,
      params: normalizeParams(type, raw && raw.params)
    };
  }

  function rawStarterGraph() {
    const layout = [
      ["source", "Source", 24, 70], ["blur", "Blur", 224, 26], ["glow", "Glow", 424, 26],
      ["shadow", "Shadow", 624, 26], ["distortion", "Distortion", 224, 174], ["color", "Color", 424, 174],
      ["mask", "Mask", 624, 174], ["blend", "Blend", 424, 322], ["output", "Output", 624, 322]
    ];
    const nodes = layout.map((item, index) => ({ id: item[0], type: item[1], name: item[1], enabled: true, order: index, x: item[2], y: item[3], params: defaultParams(item[1]) }));
    const links = [
      ["source", "blur", 0], ["blur", "glow", 0], ["glow", "shadow", 0], ["shadow", "distortion", 0],
      ["distortion", "color", 0], ["color", "mask", 0], ["mask", "blend", 0], ["source", "blend", 1], ["blend", "output", 0]
    ];
    return {
      format: FORMAT,
      version: VERSION,
      meta: { name: "Node Effects Composer", updatedAt: new Date().toISOString() },
      preview: { width: 720, height: 450 },
      nodes,
      connections: links.map((item, index) => ({ id: `link-${index + 1}`, from: item[0], to: item[1], input: item[2] })),
      groups: []
    };
  }

  function hasPath(connections, startId, targetId) {
    const queue = [startId];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      connections.forEach((connection) => {
        if (connection.from === current && !visited.has(connection.to)) queue.push(connection.to);
      });
    }
    return false;
  }

  function normalizeGraph(raw) {
    const input = raw && typeof raw === "object" ? raw : rawStarterGraph();
    const incomingNodes = Array.isArray(input.nodes) ? input.nodes.slice(0, MAX_NODES) : rawStarterGraph().nodes;
    const nodes = incomingNodes.map(normalizeNode);
    if (!nodes.length) nodes.push(normalizeNode({ type: "Source", id: "source" }, 0), normalizeNode({ type: "Output", id: "output", order: 1, x: 250 }, 1));
    const nodeIds = new Set();
    nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) node.id = safeId(`${node.id}-${index + 1}`, `node-${index + 1}`);
      nodeIds.add(node.id);
    });
    nodes.sort((a, b) => a.order - b.order).forEach((node, index) => { node.order = index; });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const connections = [];
    const occupiedInputs = new Set();
    (Array.isArray(input.connections) ? input.connections : []).slice(0, MAX_CONNECTIONS).forEach((rawConnection, index) => {
      const from = safeId(rawConnection && rawConnection.from, "");
      const to = safeId(rawConnection && rawConnection.to, "");
      if (!nodeById.has(from) || !nodeById.has(to) || from === to) return;
      if (nodeById.get(from).type === "Output" || nodeById.get(to).type === "Source") return;
      const inputIndex = nodeById.get(to).type === "Blend" && Number(rawConnection.input) === 1 ? 1 : 0;
      const portKey = `${to}:${inputIndex}`;
      if (occupiedInputs.has(portKey) || hasPath(connections, to, from)) return;
      occupiedInputs.add(portKey);
      connections.push({ id: safeId(rawConnection.id, `link-${index + 1}`), from, to, input: inputIndex });
    });
    const groupIds = new Set();
    const groups = (Array.isArray(input.groups) ? input.groups : []).slice(0, MAX_GROUPS).map((rawGroup, index) => {
      let id = safeId(rawGroup && rawGroup.id, `group-${index + 1}`);
      if (groupIds.has(id)) id = `${id}-${index + 1}`;
      groupIds.add(id);
      return {
        id,
        name: safeText(rawGroup && rawGroup.name, `Group ${index + 1}`, 64) || `Group ${index + 1}`,
        color: safeColor(rawGroup && rawGroup.color, ["#4bd6b0", "#ff8db3", "#76b9ff", "#e4c568"][index % 4]),
        nodeIds: Array.isArray(rawGroup && rawGroup.nodeIds) ? rawGroup.nodeIds.map((idValue) => safeId(idValue, "")).filter((idValue, position, all) => nodeById.has(idValue) && all.indexOf(idValue) === position).slice(0, MAX_NODES) : []
      };
    });
    const assigned = new Set();
    groups.forEach((group) => {
      group.nodeIds = group.nodeIds.filter((id) => {
        if (assigned.has(id)) return false;
        assigned.add(id);
        return true;
      });
    });
    nodes.forEach((node) => {
      const explicit = groups.find((group) => group.nodeIds.includes(node.id));
      if (explicit) node.groupId = explicit.id;
      else if (node.groupId && groupIds.has(node.groupId) && !assigned.has(node.id)) {
        const group = groups.find((item) => item.id === node.groupId);
        group.nodeIds.push(node.id);
        assigned.add(node.id);
      } else node.groupId = null;
    });
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: safeText(input.meta && input.meta.name, "Node Effects Composer", 100) || "Node Effects Composer",
        updatedAt: safeText(input.meta && input.meta.updatedAt, new Date().toISOString(), 40)
      },
      preview: {
        width: Math.round(clamp(input.preview && input.preview.width, 240, 1920, 720)),
        height: Math.round(clamp(input.preview && input.preview.height, 180, 1080, 450))
      },
      nodes,
      connections,
      groups
    };
  }

  function createDefaultGraph() {
    return normalizeGraph(rawStarterGraph());
  }

  function createNode(type, overrides) {
    if (!NODE_TYPES.includes(type)) throw new RangeError(`Unsupported node type: ${safeText(type, "unknown", 32)}`);
    const input = Object.assign({ id: uid(type.toLowerCase()), type, name: NODE_DEFINITIONS[type].label, enabled: true, order: 0 }, overrides || {});
    input.type = type;
    return normalizeNode(input, Number(input.order) || 0);
  }

  function addNode(graph, type, overrides) {
    const next = normalizeGraph(graph);
    if (next.nodes.length >= MAX_NODES) throw new RangeError(`A graph can contain at most ${MAX_NODES} nodes`);
    const node = createNode(type, Object.assign({ order: next.nodes.length, x: 42 + (next.nodes.length % 4) * 198, y: 52 + Math.floor(next.nodes.length / 4) * 142 }, overrides || {}));
    while (next.nodes.some((item) => item.id === node.id)) node.id = uid(type.toLowerCase());
    next.nodes.push(node);
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function removeNode(graph, nodeId) {
    const next = normalizeGraph(graph);
    const id = safeId(nodeId, "");
    next.nodes = next.nodes.filter((node) => node.id !== id);
    next.nodes.forEach((node, index) => { node.order = index; });
    next.connections = next.connections.filter((connection) => connection.from !== id && connection.to !== id);
    next.groups.forEach((group) => { group.nodeIds = group.nodeIds.filter((item) => item !== id); });
    next.groups = next.groups.filter((group) => group.nodeIds.length);
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function connectNodes(graph, fromId, toId, inputIndex) {
    const next = normalizeGraph(graph);
    const from = safeId(fromId, "");
    const to = safeId(toId, "");
    const source = next.nodes.find((node) => node.id === from);
    const target = next.nodes.find((node) => node.id === to);
    if (!source || !target) throw new RangeError("Both connection nodes must exist");
    if (from === to || source.type === "Output" || target.type === "Source") throw new RangeError("This connection is not supported");
    if (hasPath(next.connections, to, from)) throw new RangeError("Connections cannot create a cycle");
    const port = target.type === "Blend" && Number(inputIndex) === 1 ? 1 : 0;
    next.connections = next.connections.filter((connection) => !(connection.to === to && connection.input === port));
    next.connections.push({ id: uid("link"), from, to, input: port });
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function disconnectNodes(graph, connectionId) {
    const next = normalizeGraph(graph);
    const id = safeId(connectionId, "");
    next.connections = next.connections.filter((connection) => connection.id !== id);
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function reorderNode(graph, nodeId, directionOrIndex) {
    const next = normalizeGraph(graph);
    const current = next.nodes.findIndex((node) => node.id === safeId(nodeId, ""));
    if (current < 0) return next;
    let target = current;
    if (directionOrIndex === "up") target = current - 1;
    else if (directionOrIndex === "down") target = current + 1;
    else target = Math.round(clamp(directionOrIndex, 0, next.nodes.length - 1, current));
    target = Math.max(0, Math.min(next.nodes.length - 1, target));
    const moved = next.nodes.splice(current, 1)[0];
    next.nodes.splice(target, 0, moved);
    next.nodes.forEach((node, index) => { node.order = index; });
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function setNodeEnabled(graph, nodeId, enabled) {
    const next = normalizeGraph(graph);
    const node = next.nodes.find((item) => item.id === safeId(nodeId, ""));
    if (node) node.enabled = enabled !== false;
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function toggleNode(graph, nodeId) {
    const next = normalizeGraph(graph);
    const node = next.nodes.find((item) => item.id === safeId(nodeId, ""));
    return node ? setNodeEnabled(next, node.id, !node.enabled) : next;
  }

  function groupNodes(graph, nodeIds, name, color) {
    const next = normalizeGraph(graph);
    const selected = Array.from(new Set(Array.isArray(nodeIds) ? nodeIds.map((id) => safeId(id, "")) : [])).filter((id) => next.nodes.some((node) => node.id === id));
    if (!selected.length) throw new RangeError("Select at least one node to create a group");
    if (next.groups.length >= MAX_GROUPS) throw new RangeError(`A graph can contain at most ${MAX_GROUPS} groups`);
    next.groups.forEach((group) => { group.nodeIds = group.nodeIds.filter((id) => !selected.includes(id)); });
    next.groups = next.groups.filter((group) => group.nodeIds.length);
    const group = { id: uid("group"), name: safeText(name, `Group ${next.groups.length + 1}`, 64) || `Group ${next.groups.length + 1}`, color: safeColor(color, "#4bd6b0"), nodeIds: selected };
    next.groups.push(group);
    next.nodes.forEach((node) => { if (selected.includes(node.id)) node.groupId = group.id; });
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function ungroupNodes(graph, nodeIds) {
    const next = normalizeGraph(graph);
    const selected = new Set(Array.isArray(nodeIds) ? nodeIds.map((id) => safeId(id, "")) : []);
    next.groups.forEach((group) => { group.nodeIds = group.nodeIds.filter((id) => !selected.has(id)); });
    next.groups = next.groups.filter((group) => group.nodeIds.length);
    next.nodes.forEach((node) => { if (selected.has(node.id)) node.groupId = null; });
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function applyPreset(graphOrPreset, maybePreset) {
    const presetId = typeof graphOrPreset === "string" ? graphOrPreset : maybePreset;
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) throw new RangeError(`Unknown preset: ${safeText(presetId, "", 40)}`);
    const next = normalizeGraph(typeof graphOrPreset === "string" ? createDefaultGraph() : graphOrPreset);
    next.nodes.forEach((node) => {
      if (preset.values[node.type]) node.params = normalizeParams(node.type, Object.assign({}, node.params, preset.values[node.type]));
    });
    next.meta.name = preset.name;
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function validateGraph(graph) {
    const errors = [];
    const warnings = [];
    if (!graph || typeof graph !== "object") return { valid: false, errors: ["Graph must be an object"], warnings };
    const normalized = normalizeGraph(graph);
    if (normalized.nodes.length !== (Array.isArray(graph.nodes) ? Math.min(graph.nodes.length, MAX_NODES) : 0)) warnings.push("Some unsupported or excess nodes were normalized");
    const ids = new Set(normalized.nodes.map((node) => node.id));
    normalized.connections.forEach((connection) => {
      if (!ids.has(connection.from) || !ids.has(connection.to)) errors.push(`Dangling connection: ${connection.id}`);
    });
    if (!normalized.nodes.some((node) => node.type === "Source")) warnings.push("Graph has no Source node");
    if (!normalized.nodes.some((node) => node.type === "Output")) warnings.push("Graph has no Output node");
    return { valid: errors.length === 0, errors, warnings };
  }

  function serializeGraph(graph) {
    return JSON.stringify(normalizeGraph(graph), null, 2);
  }

  function exportGraph(graph) {
    return JSON.stringify({ format: FORMAT, version: VERSION, extension: ".hheffects", graph: normalizeGraph(graph) }, null, 2);
  }

  function deserializeGraph(value) {
    let parsed = value;
    if (typeof value === "string") {
      try { parsed = JSON.parse(value); } catch (_) { throw new TypeError("The graph file is not valid JSON"); }
    }
    if (!parsed || typeof parsed !== "object") throw new TypeError("The graph file is empty");
    const raw = parsed.graph && parsed.format === FORMAT ? parsed.graph : parsed;
    if (raw.format && raw.format !== FORMAT) throw new TypeError(`Unsupported graph format: ${safeText(raw.format, "unknown", 80)}`);
    return normalizeGraph(raw);
  }

  function makeSurface(target, width, height) {
    let surface = null;
    const doc = target && target.ownerDocument;
    if (doc && typeof doc.createElement === "function") surface = doc.createElement("canvas");
    else if (typeof globalScope.OffscreenCanvas === "function") surface = new globalScope.OffscreenCanvas(width, height);
    if (!surface) return null;
    surface.width = width;
    surface.height = height;
    return surface;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawSource(context, node, width, height, onInvalidate) {
    const params = node.params;
    context.clearRect(0, 0, width, height);
    if (params.imageData && typeof globalScope.Image === "function") {
      let image = imageCache.get(params.imageData);
      if (!image) {
        image = new globalScope.Image();
        image.onload = () => { if (typeof onInvalidate === "function") onInvalidate(); };
        image.onerror = () => imageCache.delete(params.imageData);
        image.src = params.imageData;
        imageCache.set(params.imageData, image);
      }
      if (image.complete && image.naturalWidth) {
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        return;
      }
    }
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, params.background);
    gradient.addColorStop(1, "#07090f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = params.accent;
    context.fillStyle = params.accent;
    if (params.mode === "grid") {
      context.globalAlpha = 0.3;
      for (let x = 0; x < width; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.globalAlpha = 1;
    } else if (params.mode === "rings") {
      context.lineWidth = Math.max(4, width / 90);
      context.globalAlpha = 0.72;
      for (let radius = Math.min(width, height) * 0.12; radius < Math.max(width, height) * 0.62; radius += Math.min(width, height) * 0.095) {
        context.beginPath(); context.arc(width * 0.53, height * 0.48, radius, 0, Math.PI * 2); context.stroke();
      }
      context.globalAlpha = 1;
    } else {
      context.save();
      context.translate(width * 0.56, height * 0.44);
      context.rotate(-0.16);
      context.globalAlpha = 0.88;
      roundedRect(context, -width * 0.23, -height * 0.27, width * 0.46, height * 0.54, Math.min(width, height) * 0.07);
      context.fill();
      context.globalCompositeOperation = "destination-out";
      roundedRect(context, -width * 0.17, -height * 0.2, width * 0.34, height * 0.4, Math.min(width, height) * 0.045);
      context.fill();
      context.restore();
    }
    context.fillStyle = "#f7fafc";
    context.font = `800 ${Math.max(22, Math.round(width / 18))}px system-ui, sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(params.text || "NODE EFFECTS", width * 0.08, height * 0.84, width * 0.84);
    context.fillStyle = params.accent;
    context.fillRect(width * 0.08, height * 0.87, width * 0.2, Math.max(4, height * 0.012));
  }

  function drawBlurred(context, source, radius, x, y, warnings) {
    const offsetX = Number(x) || 0;
    const offsetY = Number(y) || 0;
    if ("filter" in context) {
      context.save();
      context.filter = `blur(${Math.max(0, radius)}px)`;
      context.drawImage(source, offsetX, offsetY);
      context.restore();
      return;
    }
    if (!warnings.includes("Canvas2D filter is unavailable; blur uses an approximate preview")) warnings.push("Canvas2D filter is unavailable; blur uses an approximate preview");
    const spread = Math.max(1, Math.min(10, Math.round(radius / 2)));
    context.save();
    context.globalAlpha *= 1 / 9;
    for (let ix = -1; ix <= 1; ix += 1) for (let iy = -1; iy <= 1; iy += 1) context.drawImage(source, offsetX + ix * spread, offsetY + iy * spread);
    context.restore();
  }

  function tintSurface(target, source, color, width, height) {
    const surface = makeSurface(target, width, height);
    if (!surface) return null;
    const context = surface.getContext("2d");
    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    return surface;
  }

  function parseHexColor(color) {
    const value = String(color || "").replace("#", "");
    if (/^[0-9a-f]{3}$/i.test(value)) return value.split("").map((part) => parseInt(part + part, 16));
    if (/^[0-9a-f]{6,8}$/i.test(value)) return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
    return [255, 111, 145];
  }

  function applyColorPixels(context, params, width, height, warnings) {
    let imageData;
    try { imageData = context.getImageData(0, 0, width, height); } catch (_) {
      warnings.push("Pixel color processing is unavailable for this source");
      return;
    }
    const data = imageData.data;
    const brightness = params.brightness / 100;
    const contrast = params.contrast / 100;
    const saturation = params.saturation / 100;
    const radians = params.hue * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const tint = parseHexColor(params.tint);
    const tintAmount = params.tintAmount / 100;
    for (let index = 0; index < data.length; index += 4) {
      let red = ((data[index] - 128) * contrast + 128) * brightness;
      let green = ((data[index + 1] - 128) * contrast + 128) * brightness;
      let blue = ((data[index + 2] - 128) * contrast + 128) * brightness;
      const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      red = gray + (red - gray) * saturation;
      green = gray + (green - gray) * saturation;
      blue = gray + (blue - gray) * saturation;
      const hueRed = (0.213 + cos * 0.787 - sin * 0.213) * red + (0.715 - cos * 0.715 - sin * 0.715) * green + (0.072 - cos * 0.072 + sin * 0.928) * blue;
      const hueGreen = (0.213 - cos * 0.213 + sin * 0.143) * red + (0.715 + cos * 0.285 + sin * 0.14) * green + (0.072 - cos * 0.072 - sin * 0.283) * blue;
      const hueBlue = (0.213 - cos * 0.213 - sin * 0.787) * red + (0.715 - cos * 0.715 + sin * 0.715) * green + (0.072 + cos * 0.928 + sin * 0.072) * blue;
      data[index] = Math.max(0, Math.min(255, hueRed * (1 - tintAmount) + tint[0] * tintAmount));
      data[index + 1] = Math.max(0, Math.min(255, hueGreen * (1 - tintAmount) + tint[1] * tintAmount));
      data[index + 2] = Math.max(0, Math.min(255, hueBlue * (1 - tintAmount) + tint[2] * tintAmount));
    }
    context.putImageData(imageData, 0, 0);
  }

  function renderNode(target, node, inputs, width, height, warnings, onInvalidate) {
    const surface = makeSurface(target, width, height);
    if (!surface) return null;
    const context = surface.getContext("2d");
    const primary = inputs[0] || null;
    if (node.type === "Source") {
      if (node.enabled) drawSource(context, node, width, height, onInvalidate);
      return surface;
    }
    if (!primary) return surface;
    if (!node.enabled) { context.drawImage(primary, 0, 0); return surface; }
    if (node.type === "Blur") drawBlurred(context, primary, node.params.radius, 0, 0, warnings);
    else if (node.type === "Glow") {
      context.drawImage(primary, 0, 0);
      const tinted = tintSurface(target, primary, node.params.color, width, height);
      if (tinted) {
        context.save(); context.globalCompositeOperation = "screen"; context.globalAlpha = node.params.opacity; drawBlurred(context, tinted, node.params.size, 0, 0, warnings); context.restore();
      }
    } else if (node.type === "Shadow") {
      const tinted = tintSurface(target, primary, node.params.color, width, height);
      if (tinted) { context.save(); context.globalAlpha = node.params.opacity; drawBlurred(context, tinted, node.params.blur, node.params.x, node.params.y, warnings); context.restore(); }
      context.drawImage(primary, 0, 0);
    } else if (node.type === "Distortion") {
      const phase = node.params.phase * Math.PI / 180;
      if (node.params.direction === "vertical") {
        for (let x = 0; x < width; x += 2) { const offset = Math.sin(x / node.params.wavelength * Math.PI * 2 + phase) * node.params.amount; context.drawImage(primary, x, 0, 2, height, x, offset, 2, height); }
      } else {
        for (let y = 0; y < height; y += 2) { const offset = Math.sin(y / node.params.wavelength * Math.PI * 2 + phase) * node.params.amount; context.drawImage(primary, 0, y, width, 2, offset, y, width, 2); }
      }
    } else if (node.type === "Color") {
      context.drawImage(primary, 0, 0);
      applyColorPixels(context, node.params, width, height, warnings);
    } else if (node.type === "Mask") {
      context.drawImage(primary, 0, 0);
      context.globalCompositeOperation = "destination-in";
      let gradient;
      const size = node.params.size / 100;
      const feather = node.params.feather / 100;
      if (node.params.shape === "linear") {
        gradient = context.createLinearGradient(0, 0, width, 0);
        const edge = Math.min(0.49, feather * 0.5);
        gradient.addColorStop(0, node.params.invert ? "#fff" : "transparent");
        gradient.addColorStop(edge, node.params.invert ? "transparent" : "#fff");
        gradient.addColorStop(1 - edge, node.params.invert ? "transparent" : "#fff");
        gradient.addColorStop(1, node.params.invert ? "#fff" : "transparent");
      } else {
        const radius = Math.hypot(width, height) * 0.5;
        const inner = Math.max(0, Math.min(0.98, size - feather));
        gradient = context.createRadialGradient(width / 2, height / 2, radius * inner, width / 2, height / 2, radius * Math.max(inner + 0.01, size));
        const center = node.params.invert ? "transparent" : "#fff";
        const edge = node.params.invert ? "#fff" : "transparent";
        gradient.addColorStop(0, center);
        gradient.addColorStop(1, edge);
      }
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
    } else if (node.type === "Blend") {
      context.drawImage(primary, 0, 0);
      if (inputs[1]) { context.save(); context.globalCompositeOperation = node.params.mode; context.globalAlpha = node.params.opacity / 100; context.drawImage(inputs[1], 0, 0); context.restore(); }
    } else if (node.type === "Output") {
      if (node.params.background !== "transparent") { context.fillStyle = node.params.background; context.fillRect(0, 0, width, height); }
      context.drawImage(primary, 0, 0);
    }
    return surface;
  }

  function topologicalNodes(graph) {
    const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    graph.connections.forEach((connection) => indegree.set(connection.to, (indegree.get(connection.to) || 0) + 1));
    const queue = graph.nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.order - b.order);
    const ordered = [];
    while (queue.length) {
      const node = queue.shift();
      ordered.push(node);
      graph.connections.filter((connection) => connection.from === node.id).forEach((connection) => {
        indegree.set(connection.to, indegree.get(connection.to) - 1);
        if (indegree.get(connection.to) === 0) {
          queue.push(graph.nodes.find((item) => item.id === connection.to));
          queue.sort((a, b) => a.order - b.order);
        }
      });
    }
    return ordered;
  }

  function renderGraph(graphValue, canvas, options) {
    if (!canvas || typeof canvas.getContext !== "function") return { supported: false, reason: "Canvas2D is unavailable", warnings: [] };
    let targetContext;
    try { targetContext = canvas.getContext("2d"); } catch (_) { targetContext = null; }
    if (!targetContext) return { supported: false, reason: "Canvas2D is unavailable", warnings: [] };
    const graph = normalizeGraph(graphValue);
    const width = Math.round(clamp(options && options.width, 240, 1920, graph.preview.width));
    const height = Math.round(clamp(options && options.height, 180, 1080, graph.preview.height));
    const probe = makeSurface(canvas, width, height);
    if (!probe || typeof probe.getContext !== "function" || !probe.getContext("2d")) return { supported: false, reason: "Offscreen Canvas2D surfaces are unavailable", warnings: [] };
    const warnings = [];
    const surfaces = new Map();
    const ordered = topologicalNodes(graph);
    ordered.forEach((node) => {
      const incoming = graph.connections.filter((connection) => connection.to === node.id).sort((a, b) => a.input - b.input);
      const inputs = [];
      incoming.forEach((connection) => { inputs[connection.input] = surfaces.get(connection.from) || null; });
      const surface = renderNode(canvas, node, inputs, width, height, warnings, options && options.onInvalidate);
      if (surface) surfaces.set(node.id, surface);
    });
    const outputNode = ordered.filter((node) => node.type === "Output").pop();
    const output = outputNode ? surfaces.get(outputNode.id) : surfaces.get(ordered[ordered.length - 1] && ordered[ordered.length - 1].id);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    targetContext = canvas.getContext("2d");
    targetContext.clearRect(0, 0, width, height);
    if (output) targetContext.drawImage(output, 0, 0);
    return { supported: true, width, height, warnings, renderedNodeIds: ordered.map((node) => node.id) };
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhne{--ne-bg:#090d13;--ne-panel:#101720;--ne-panel-2:#151e29;--ne-line:#2b3948;--ne-text:#edf3f8;--ne-muted:#91a1b2;--ne-accent:#43d9ad;display:flex;flex-direction:column;min-height:760px;overflow:hidden;color:var(--ne-text);background:var(--ne-bg);border:1px solid var(--ne-line);border-radius:8px;font:500 13px/1.4 Inter,system-ui,sans-serif}.hhne *{box-sizing:border-box;letter-spacing:0}.hhne button,.hhne input,.hhne select{font:inherit}.hhne button{min-height:34px;padding:6px 10px;color:var(--ne-text);background:#17212c;border:1px solid #354658;border-radius:6px;cursor:pointer}.hhne button:hover{border-color:#5a7188}.hhne button:focus-visible,.hhne input:focus-visible,.hhne select:focus-visible,.hhne [tabindex]:focus-visible{outline:2px solid var(--ne-accent);outline-offset:2px}.hhne button:disabled{opacity:.48;cursor:not-allowed}.hhne input,.hhne select{min-width:0;min-height:34px;width:100%;padding:5px 8px;color:var(--ne-text);background:#0b1118;border:1px solid #354658;border-radius:5px}.hhne input[type=color]{padding:3px}.hhne input[type=checkbox]{width:18px;min-height:18px;accent-color:var(--ne-accent)}.hhne input[type=range]{padding:0;accent-color:var(--ne-accent)}.hhne-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 11px;border-bottom:1px solid var(--ne-line);background:#0d131b}.hhne-brand{display:flex;align-items:center;gap:9px;margin-right:auto;min-width:190px}.hhne-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:6px;background:#43d9ad;color:#07110e;font-weight:900}.hhne-title{display:block;font-size:14px}.hhne-kicker{display:block;color:var(--ne-accent);font-size:10px;font-weight:800;text-transform:uppercase}.hhne-name{width:min(220px,100%)}.hhne-body{display:grid;grid-template-columns:188px minmax(360px,1fr) 278px;min-height:0;flex:1}.hhne-side{min-width:0;overflow:auto;background:var(--ne-panel);border-right:1px solid var(--ne-line)}.hhne-side.hhne-right{border-right:0;border-left:1px solid var(--ne-line)}.hhne-section{padding:11px;border-bottom:1px solid #23303e}.hhne-section h2,.hhne-section h3{margin:0 0 8px;color:var(--ne-muted);font-size:10px;text-transform:uppercase}.hhne-palette{display:grid;grid-template-columns:1fr 1fr;gap:5px}.hhne-palette button{min-width:0;padding:6px 4px}.hhne-row{display:flex;align-items:center;gap:6px}.hhne-row>*{min-width:0}.hhne-row select,.hhne-row input{flex:1}.hhne-stack{display:grid;gap:6px}.hhne-group-list{display:grid;gap:5px;margin-top:8px}.hhne-group-item{display:flex;align-items:center;gap:7px;color:var(--ne-muted)}.hhne-group-swatch{width:10px;height:10px;border-radius:2px}.hhne-main{display:grid;grid-template-rows:minmax(410px,1fr) 292px;min-width:0;min-height:0}.hhne-graph-shell{display:grid;grid-template-rows:auto 1fr;min-height:0;background-color:#0b1017;background-image:linear-gradient(#1c283555 1px,transparent 1px),linear-gradient(90deg,#1c283555 1px,transparent 1px);background-size:24px 24px}.hhne-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:7px 9px;border-bottom:1px solid var(--ne-line);background:#0e151e}.hhne-workspace{position:relative;min-width:0;min-height:520px;overflow:auto}.hhne-wires{position:absolute;inset:0;width:100%;height:100%;min-width:850px;min-height:520px;pointer-events:none}.hhne-wire{fill:none;stroke:#658097;stroke-width:2}.hhne-group-box{position:absolute;border:1px dashed var(--group-color);background:color-mix(in srgb,var(--group-color) 7%,transparent);border-radius:7px;pointer-events:none}.hhne-group-box span{position:absolute;left:7px;top:-20px;color:var(--group-color);font-size:10px;font-weight:800}.hhne-node{position:absolute;left:var(--node-x);top:var(--node-y);width:170px;height:94px;overflow:hidden;background:#131d27;border:1px solid #394b5e;border-top:3px solid var(--node-color);border-radius:7px;box-shadow:0 7px 20px #0005}.hhne-node.is-selected{border-color:var(--ne-accent);box-shadow:0 0 0 2px #43d9ad33}.hhne-node.is-disabled{opacity:.58}.hhne-node-head{display:grid;grid-template-columns:23px 1fr auto;align-items:center;gap:5px;padding:5px}.hhne-node-order{color:var(--ne-muted);font-size:10px}.hhne-node-select{min-height:29px;padding:4px 5px;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:0}.hhne-node-select:hover{border-color:transparent}.hhne-node-mark{display:flex;align-items:center;padding:0}.hhne-node-mark input{width:17px;min-height:17px}.hhne-ports{display:flex;justify-content:space-between;align-items:center;padding:7px;border-top:1px solid #2a3948}.hhne-port{min-height:25px!important;padding:2px 7px!important;border-radius:12px!important;font-size:9px!important}.hhne-port.out{border-color:var(--node-color)}.hhne-node-group{max-width:88px;overflow:hidden;color:var(--ne-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.hhne-preview{display:grid;place-items:center;min-height:0;padding:12px;overflow:hidden;background:#070a0f;border-top:1px solid var(--ne-line)}.hhne-preview canvas{display:block;width:auto;max-width:100%;height:auto;max-height:266px;aspect-ratio:8/5;background:#080b11;border:1px solid #344657;box-shadow:0 12px 38px #0008}.hhne-field{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:center;gap:8px;margin-bottom:7px}.hhne-field label{color:var(--ne-muted);overflow:hidden;text-overflow:ellipsis}.hhne-field-output{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:center}.hhne-value{min-width:36px;color:#b8c7d6;text-align:right;font-variant-numeric:tabular-nums}.hhne-connections{display:grid;gap:5px}.hhne-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:center;color:var(--ne-muted)}.hhne-empty{padding:8px 0;color:var(--ne-muted)}.hhne-status{display:flex;justify-content:space-between;gap:8px;min-height:34px;padding:8px 11px;border-top:1px solid var(--ne-line);color:var(--ne-muted);background:#0d131b}.hhne-status strong{color:var(--ne-accent)}.hhne-unsupported{display:grid;place-items:center;min-height:260px;padding:24px;text-align:center}.hhne-unsupported h2{margin:0 0 7px}.hhne-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:1050px){.hhne-body{grid-template-columns:180px minmax(360px,1fr)}.hhne-side.hhne-right{grid-column:1/-1;border-left:0;border-top:1px solid var(--ne-line);display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.hhne-side.hhne-right .hhne-section{border-right:1px solid #23303e}.hhne-main{grid-template-rows:minmax(430px,1fr) 250px}}
      @media(max-width:680px){.hhne{min-height:980px;width:100%;border-left:0;border-right:0}.hhne-top{align-items:stretch}.hhne-brand{width:100%}.hhne-name{width:100%}.hhne-top>button{flex:1 1 auto}.hhne-body{display:block;overflow:auto}.hhne-side{overflow:visible;border-right:0;border-bottom:1px solid var(--ne-line)}.hhne-palette{grid-template-columns:repeat(3,minmax(0,1fr))}.hhne-main{display:block}.hhne-graph-shell{display:block}.hhne-toolbar{position:sticky;top:0;z-index:5}.hhne-workspace{min-height:0;padding:9px;overflow:visible}.hhne-wires,.hhne-group-box{display:none}.hhne-node{position:relative;left:auto;top:auto;width:100%;height:88px;margin-bottom:7px}.hhne-preview{min-height:230px}.hhne-preview canvas{width:100%;height:auto}.hhne-side.hhne-right{display:block}.hhne-field{grid-template-columns:92px minmax(0,1fr)}.hhne-status{flex-direction:column}.hhne-row{flex-wrap:wrap}.hhne-row>*{flex:1 1 110px}}
      @media(max-width:390px){.hhne-palette{grid-template-columns:repeat(2,minmax(0,1fr))}.hhne-field{grid-template-columns:78px minmax(0,1fr)}.hhne-toolbar button{flex:1 1 42%}}
      @media(prefers-reduced-motion:reduce){.hhne *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    doc.head.appendChild(style);
  }

  function downloadText(doc, filename, content, type) {
    const runtime = doc && doc.defaultView ? doc.defaultView : globalScope;
    if (!doc || typeof runtime.Blob !== "function" || !runtime.URL || typeof runtime.URL.createObjectURL !== "function") return false;
    const link = doc.createElement("a");
    const url = runtime.URL.createObjectURL(new runtime.Blob([content], { type: type || "application/json" }));
    link.href = url;
    link.download = filename;
    link.hidden = true;
    doc.body.appendChild(link);
    link.click();
    link.remove();
    runtime.setTimeout(() => runtime.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function" || typeof root.innerHTML !== "string") throw new TypeError("HHGraphicNodeEffects.mount requires a valid root element");
    if (mounted.has(root)) return mounted.get(root).api;
    const settings = options && options.nodes ? { graph: options } : (options || {});
    const doc = root.ownerDocument || globalScope.document;
    injectStyles(doc);
    root.classList.add("hhne");
    root.dataset.graphicNodeEffects = "";
    root.setAttribute("aria-label", "Node Effects Composer");

    let storage = settings.storage || null;
    if (!storage) { try { storage = globalScope.localStorage || null; } catch (_) { storage = null; } }
    let stored = null;
    if (!settings.graph && storage) { try { stored = storage.getItem(STORAGE_KEY); } catch (_) { stored = null; } }
    let graph;
    try { graph = settings.graph ? normalizeGraph(settings.graph) : stored ? deserializeGraph(stored) : createDefaultGraph(); } catch (_) { graph = createDefaultGraph(); }
    let selectedId = graph.nodes[0] && graph.nodes[0].id;
    let markedIds = new Set(selectedId ? [selectedId] : []);
    let connectionSource = null;
    let saveTimer = 0;
    let frame = 0;
    let pointer = null;
    const listeners = [];
    const reducedMotion = typeof globalScope.matchMedia === "function" && globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.innerHTML = `
      <header class="hhne-top">
        <div class="hhne-brand"><span class="hhne-mark" aria-hidden="true">NE</span><div><span class="hhne-kicker">Graphic design</span><strong class="hhne-title">Node Effects Composer</strong></div></div>
        <label class="hhne-sr" for="hhne-graph-name">Graph name</label><input class="hhne-name" id="hhne-graph-name" data-ne-graph-name maxlength="100">
        <button type="button" data-ne-action="new">New</button><button type="button" data-ne-action="import">Import</button><button type="button" data-ne-action="save">Save</button><button type="button" data-ne-action="export">Export graph</button>
        <input class="hhne-sr" type="file" accept=".hheffects,.json,application/json" data-ne-file="graph"><input class="hhne-sr" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-ne-file="image">
      </header>
      <div class="hhne-body">
        <aside class="hhne-side" aria-label="Node library">
          <section class="hhne-section"><h2>Nodes</h2><div class="hhne-palette">${NODE_TYPES.map((type) => `<button type="button" data-ne-add="${type}">${NODE_DEFINITIONS[type].label}</button>`).join("")}</div></section>
          <section class="hhne-section"><h2>Preset</h2><div class="hhne-stack"><select aria-label="Effect preset" data-ne-preset>${PRESETS.map((preset) => `<option value="${preset.id}">${escapeHtml(preset.name)}</option>`).join("")}</select><button type="button" data-ne-action="preset">Apply preset</button></div></section>
          <section class="hhne-section"><h2>Group</h2><div class="hhne-stack"><input maxlength="64" placeholder="Group name" aria-label="Group name" data-ne-group-name><div class="hhne-row"><button type="button" data-ne-action="group">Group</button><button type="button" data-ne-action="ungroup">Ungroup</button></div><div class="hhne-group-list" data-ne-groups></div></div></section>
        </aside>
        <main class="hhne-main">
          <section class="hhne-graph-shell" aria-label="Effect node graph">
            <div class="hhne-toolbar"><button type="button" data-ne-action="up" aria-label="Move selected node earlier">Move up</button><button type="button" data-ne-action="down" aria-label="Move selected node later">Move down</button><button type="button" data-ne-action="toggle">Disable</button><button type="button" data-ne-action="delete">Delete</button></div>
            <div class="hhne-workspace" data-ne-workspace></div>
          </section>
          <section class="hhne-preview" aria-label="Realtime Canvas2D preview"><canvas data-ne-canvas aria-label="Realtime effects preview"></canvas></section>
        </main>
        <aside class="hhne-side hhne-right" aria-label="Node inspector">
          <section class="hhne-section"><h2>Node</h2><div data-ne-inspector></div></section>
          <section class="hhne-section"><h2>Connect</h2><div data-ne-connect></div></section>
          <section class="hhne-section"><h2>Inputs</h2><div class="hhne-connections" data-ne-connections></div></section>
        </aside>
      </div>
      <footer class="hhne-status"><span data-ne-status aria-live="polite">Ready.</span><span><strong>Local-first</strong> / Canvas2D</span></footer>`;

    const canvas = root.querySelector("[data-ne-canvas]");
    let canvasContext = null;
    try { canvasContext = canvas && canvas.getContext("2d"); } catch (_) { canvasContext = null; }
    if (!canvasContext) {
      root.innerHTML = '<section class="hhne-unsupported" role="status"><div><h2>Canvas2D is not supported</h2><p>The node graph can be serialized through the API, but a truthful realtime preview cannot run in this browser.</p></div></section>';
      const unsupportedApi = { unsupported: true, getGraph: () => clone(graph), serialize: () => serializeGraph(graph), exportGraph: () => exportGraph(graph), unmount: () => unmount(root) };
      mounted.set(root, { api: unsupportedApi, cleanup: () => { root.innerHTML = ""; root.classList.remove("hhne"); } });
      return unsupportedApi;
    }

    const status = root.querySelector("[data-ne-status]");
    function announce(message) { status.textContent = safeText(message, "Ready", 180); }
    function selectedNode() { return graph.nodes.find((node) => node.id === selectedId) || null; }
    function on(target, event, handler, eventOptions) {
      target.addEventListener(event, handler, eventOptions);
      listeners.push(() => target.removeEventListener(event, handler, eventOptions));
    }
    function persistSoon() {
      clearTimeout(saveTimer);
      saveTimer = globalScope.setTimeout(() => {
        if (!storage) { announce("Local storage is unavailable. Export remains available."); return; }
        try { storage.setItem(STORAGE_KEY, serializeGraph(graph)); } catch (_) { announce("Local save failed. Export the graph to keep a copy."); }
      }, 180);
    }
    function schedulePreview() {
      if (frame && typeof globalScope.cancelAnimationFrame === "function") globalScope.cancelAnimationFrame(frame);
      const draw = () => {
        frame = 0;
        const result = renderGraph(graph, canvas, { onInvalidate: schedulePreview });
        if (!result.supported) announce(result.reason);
        else if (result.warnings.length) announce(result.warnings[0]);
      };
      if (!reducedMotion && typeof globalScope.requestAnimationFrame === "function") frame = globalScope.requestAnimationFrame(draw);
      else draw();
    }
    function focusNode(id) {
      globalScope.setTimeout(() => root.querySelector(`[data-ne-select="${id}"]`)?.focus(), 0);
    }
    function commit(message, mutate, focusId) {
      mutate();
      graph = normalizeGraph(graph);
      if (!graph.nodes.some((node) => node.id === selectedId)) selectedId = graph.nodes[0] && graph.nodes[0].id;
      markedIds = new Set(Array.from(markedIds).filter((id) => graph.nodes.some((node) => node.id === id)));
      render();
      persistSoon();
      announce(message);
      if (focusId || selectedId) focusNode(focusId || selectedId);
    }

    function groupBounds(group) {
      const nodes = graph.nodes.filter((node) => group.nodeIds.includes(node.id));
      if (!nodes.length) return null;
      const minX = Math.min(...nodes.map((node) => node.x)) - 12;
      const minY = Math.min(...nodes.map((node) => node.y)) - 12;
      const maxX = Math.max(...nodes.map((node) => node.x + 170)) + 12;
      const maxY = Math.max(...nodes.map((node) => node.y + 94)) + 12;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    function renderWorkspace() {
      const workspace = root.querySelector("[data-ne-workspace]");
      const wires = graph.connections.map((connection) => {
        const from = graph.nodes.find((node) => node.id === connection.from);
        const to = graph.nodes.find((node) => node.id === connection.to);
        if (!from || !to) return "";
        const x1 = from.x + 170; const y1 = from.y + 71; const x2 = to.x; const y2 = to.y + 71 + connection.input * 14;
        const bend = Math.max(34, Math.abs(x2 - x1) * 0.48);
        return `<path class="hhne-wire" d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}"></path>`;
      }).join("");
      const groupBoxes = graph.groups.map((group) => {
        const box = groupBounds(group);
        return box ? `<div class="hhne-group-box" style="--group-color:${escapeHtml(group.color)};left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px"><span>${escapeHtml(group.name)}</span></div>` : "";
      }).join("");
      const nodes = graph.nodes.map((node) => {
        const group = graph.groups.find((item) => item.id === node.groupId);
        return `<article class="hhne-node${node.id === selectedId ? " is-selected" : ""}${node.enabled ? "" : " is-disabled"}" style="--node-x:${node.x}px;--node-y:${node.y}px;--node-color:${NODE_DEFINITIONS[node.type].color}" data-ne-node="${node.id}">
          <div class="hhne-node-head"><span class="hhne-node-order">${node.order + 1}</span><button type="button" class="hhne-node-select" data-ne-select="${node.id}" data-ne-drag="${node.id}" aria-pressed="${node.id === selectedId}">${escapeHtml(node.name)}</button><label class="hhne-node-mark"><span class="hhne-sr">Mark ${escapeHtml(node.name)} for grouping</span><input type="checkbox" data-ne-mark="${node.id}"${markedIds.has(node.id) ? " checked" : ""}></label></div>
          <div class="hhne-ports">${node.type === "Source" ? "<span></span>" : `<button type="button" class="hhne-port in" data-ne-connect-end="${node.id}" aria-label="Connect to ${escapeHtml(node.name)} input">IN</button>`}<span class="hhne-node-group">${group ? escapeHtml(group.name) : escapeHtml(node.type)}</span>${node.type === "Output" ? "<span></span>" : `<button type="button" class="hhne-port out" data-ne-connect-start="${node.id}" aria-label="Start connection from ${escapeHtml(node.name)}">OUT</button>`}</div>
        </article>`;
      }).join("");
      workspace.innerHTML = `<svg class="hhne-wires" aria-hidden="true" viewBox="0 0 850 520" preserveAspectRatio="none">${wires}</svg>${groupBoxes}${nodes}`;
    }

    function renderField(node, field) {
      const value = node.params[field.key];
      if (field.type === "select") return `<div class="hhne-field"><label for="ne-${node.id}-${field.key}">${field.label}</label><select id="ne-${node.id}-${field.key}" data-ne-param="${field.key}">${Array.from(field.options).map((option) => `<option value="${escapeHtml(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
      if (field.type === "checkbox") return `<div class="hhne-field"><label for="ne-${node.id}-${field.key}">${field.label}</label><input id="ne-${node.id}-${field.key}" type="checkbox" data-ne-param="${field.key}"${value ? " checked" : ""}></div>`;
      if (field.type === "range") return `<div class="hhne-field"><label for="ne-${node.id}-${field.key}">${field.label}</label><div class="hhne-field-output"><input id="ne-${node.id}-${field.key}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-ne-param="${field.key}"><output class="hhne-value" data-ne-value="${field.key}">${value}</output></div></div>`;
      return `<div class="hhne-field"><label for="ne-${node.id}-${field.key}">${field.label}</label><input id="ne-${node.id}-${field.key}" type="${field.type}" maxlength="${field.max || ""}" value="${escapeHtml(value)}" data-ne-param="${field.key}"></div>`;
    }

    function renderInspector() {
      const node = selectedNode();
      const inspector = root.querySelector("[data-ne-inspector]");
      const connect = root.querySelector("[data-ne-connect]");
      const incomingHost = root.querySelector("[data-ne-connections]");
      if (!node) {
        inspector.innerHTML = '<div class="hhne-empty">No node selected.</div>';
        connect.innerHTML = "";
        incomingHost.innerHTML = "";
        return;
      }
      inspector.innerHTML = `<div class="hhne-field"><label for="ne-node-name">Name</label><input id="ne-node-name" maxlength="64" value="${escapeHtml(node.name)}" data-ne-node-name></div><div class="hhne-field"><label>Type</label><input value="${escapeHtml(node.type)}" readonly></div>${PARAM_FIELDS[node.type].map((field) => renderField(node, field)).join("")}${node.type === "Source" ? '<div class="hhne-row"><button type="button" data-ne-action="image">Local image</button><button type="button" data-ne-action="clear-image">Clear image</button></div>' : ""}`;
      if (NODE_DEFINITIONS[node.type].inputs) {
        const candidates = graph.nodes.filter((item) => item.id !== node.id && item.type !== "Output");
        connect.innerHTML = `<div class="hhne-stack"><label class="hhne-sr" for="ne-connect-from">Source node</label><select id="ne-connect-from" data-ne-connect-from>${candidates.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select>${node.type === "Blend" ? '<label class="hhne-sr" for="ne-connect-port">Blend input</label><select id="ne-connect-port" data-ne-connect-port><option value="0">Primary input</option><option value="1">Secondary input</option></select>' : ""}<button type="button" data-ne-action="connect"${candidates.length ? "" : " disabled"}>Connect</button></div>`;
      } else connect.innerHTML = '<div class="hhne-empty">Source has no input.</div>';
      const incoming = graph.connections.filter((connection) => connection.to === node.id);
      incomingHost.innerHTML = incoming.length ? incoming.map((connection) => {
        const from = graph.nodes.find((item) => item.id === connection.from);
        return `<div class="hhne-link"><span>${escapeHtml(from ? from.name : connection.from)} / input ${connection.input + 1}</span><button type="button" data-ne-disconnect="${connection.id}" aria-label="Disconnect ${escapeHtml(from ? from.name : connection.from)}">Remove</button></div>`;
      }).join("") : '<div class="hhne-empty">No inputs.</div>';
    }

    function render() {
      root.querySelector("[data-ne-graph-name]").value = graph.meta.name;
      const node = selectedNode();
      root.querySelector('[data-ne-action="toggle"]').textContent = node && node.enabled ? "Disable" : "Enable";
      root.querySelector("[data-ne-groups]").innerHTML = graph.groups.length ? graph.groups.map((group) => `<div class="hhne-group-item"><span class="hhne-group-swatch" style="background:${escapeHtml(group.color)}"></span><span>${escapeHtml(group.name)} (${group.nodeIds.length})</span></div>`).join("") : '<span class="hhne-empty">No groups.</span>';
      renderWorkspace();
      renderInspector();
      schedulePreview();
    }

    function tryConnect(from, to, port) {
      try { commit("Nodes connected.", () => { graph = connectNodes(graph, from, to, port); connectionSource = null; }, to); }
      catch (error) { announce(error.message); }
    }

    on(root, "click", (event) => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.neAction;
      if (button.dataset.neAdd) {
        const type = button.dataset.neAdd;
        let next;
        try { next = addNode(graph, type); } catch (error) { announce(error.message); return; }
        const added = next.nodes[next.nodes.length - 1];
        commit(`${type} node added.`, () => { graph = next; selectedId = added.id; markedIds = new Set([added.id]); }, added.id);
      } else if (button.dataset.neSelect) { selectedId = button.dataset.neSelect; render(); focusNode(selectedId); }
      else if (button.dataset.neConnectStart) { connectionSource = button.dataset.neConnectStart; announce(`Connection source: ${graph.nodes.find((node) => node.id === connectionSource)?.name || "node"}.`); }
      else if (button.dataset.neConnectEnd) {
        if (!connectionSource) { selectedId = button.dataset.neConnectEnd; render(); announce("Choose an output node first, or use the Connect controls."); }
        else tryConnect(connectionSource, button.dataset.neConnectEnd, 0);
      } else if (button.dataset.neDisconnect) commit("Input disconnected.", () => { graph = disconnectNodes(graph, button.dataset.neDisconnect); });
      else if (action === "new") commit("New graph created.", () => { graph = createDefaultGraph(); selectedId = graph.nodes[0].id; markedIds = new Set([selectedId]); });
      else if (action === "import") root.querySelector('[data-ne-file="graph"]').click();
      else if (action === "save") {
        if (!storage) announce("Local storage is unavailable. Export remains available.");
        else { try { storage.setItem(STORAGE_KEY, serializeGraph(graph)); announce("Graph saved on this device."); } catch (_) { announce("Local save failed. Export the graph to keep a copy."); } }
      } else if (action === "export") {
        const filename = `${safeId(graph.meta.name, "node-effects")}.hheffects`;
        announce(downloadText(doc, filename, exportGraph(graph), "application/json") ? "Graph exported." : "File download is unsupported in this browser. Use the serialize API.");
      } else if (action === "preset") {
        const preset = root.querySelector("[data-ne-preset]").value;
        try { commit("Preset applied.", () => { graph = applyPreset(graph, preset); }); } catch (error) { announce(error.message); }
      } else if (action === "toggle" && selectedId) commit("Node state changed.", () => { graph = toggleNode(graph, selectedId); });
      else if (action === "delete" && selectedId) {
        const removed = selectedId;
        commit("Node deleted.", () => { graph = removeNode(graph, removed); });
      } else if ((action === "up" || action === "down") && selectedId) commit("Node order changed.", () => { graph = reorderNode(graph, selectedId, action); });
      else if (action === "group") {
        const name = root.querySelector("[data-ne-group-name]").value;
        try { commit("Group created.", () => { graph = groupNodes(graph, Array.from(markedIds), name); }); } catch (error) { announce(error.message); }
      } else if (action === "ungroup") commit("Nodes ungrouped.", () => { graph = ungroupNodes(graph, Array.from(markedIds)); });
      else if (action === "connect" && selectedId) {
        const from = root.querySelector("[data-ne-connect-from]")?.value;
        const port = Number(root.querySelector("[data-ne-connect-port]")?.value || 0);
        if (from) tryConnect(from, selectedId, port);
      } else if (action === "image") root.querySelector('[data-ne-file="image"]').click();
      else if (action === "clear-image" && selectedNode()?.type === "Source") commit("Source image cleared.", () => { selectedNode().params.imageData = ""; });
    });

    on(root, "change", (event) => {
      const target = event.target;
      if (target.dataset.neMark) {
        if (target.checked) markedIds.add(target.dataset.neMark); else markedIds.delete(target.dataset.neMark);
        return;
      }
      if (target.dataset.neGraphName !== undefined) commit("Graph renamed.", () => { graph.meta.name = safeText(target.value, "Node Effects Composer", 100); });
      else if (target.dataset.neNodeName !== undefined && selectedNode()) commit("Node renamed.", () => { selectedNode().name = safeText(target.value, selectedNode().type, 64); });
      else if (target.dataset.neParam !== undefined && selectedNode()) {
        const key = target.dataset.neParam;
        const value = target.type === "checkbox" ? target.checked : target.type === "range" ? Number(target.value) : target.value;
        commit("Effect updated.", () => { selectedNode().params = normalizeParams(selectedNode().type, Object.assign({}, selectedNode().params, { [key]: value })); });
      }
    });

    on(root, "input", (event) => {
      const target = event.target;
      if (target.dataset.neParam === undefined || target.type !== "range" || !selectedNode()) return;
      const key = target.dataset.neParam;
      selectedNode().params = normalizeParams(selectedNode().type, Object.assign({}, selectedNode().params, { [key]: Number(target.value) }));
      root.querySelector(`[data-ne-value="${key}"]`).textContent = target.value;
      schedulePreview();
      persistSoon();
    });

    on(root.querySelector('[data-ne-file="graph"]'), "change", async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        const content = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
          if (typeof globalScope.FileReader !== "function") { reject(new Error("Local file reading is unsupported in this browser")); return; }
          const reader = new globalScope.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The graph file could not be read")); reader.readAsText(file);
        });
        const imported = deserializeGraph(content);
        commit("Graph imported.", () => { graph = imported; selectedId = graph.nodes[0]?.id || null; markedIds = new Set(selectedId ? [selectedId] : []); });
      } catch (error) { announce(error.message); }
    });

    on(root.querySelector('[data-ne-file="image"]'), "change", (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;
      if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type || "") || file.size > MAX_IMAGE_DATA_LENGTH * 0.72) { announce("Choose a PNG, JPEG, WebP, or GIF under 4 MB."); return; }
      if (typeof globalScope.FileReader !== "function") { announce("Local image reading is unsupported in this browser."); return; }
      const reader = new globalScope.FileReader();
      reader.onload = () => {
        const node = selectedNode();
        if (!node || node.type !== "Source") return;
        const imageData = safeImageData(reader.result);
        if (!imageData) { announce("The local image could not be accepted."); return; }
        commit("Local source image loaded.", () => { node.params.imageData = imageData; });
      };
      reader.onerror = () => announce("The local image could not be read.");
      reader.readAsDataURL(file);
    });

    on(root, "keydown", (event) => {
      const editable = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (storage) { try { storage.setItem(STORAGE_KEY, serializeGraph(graph)); announce("Graph saved on this device."); } catch (_) { announce("Local save failed. Export the graph to keep a copy."); } }
        else announce("Local storage is unavailable. Export remains available.");
      } else if (!editable && (event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        const removed = selectedId;
        commit("Node deleted.", () => { graph = removeNode(graph, removed); });
      } else if (!editable && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && selectedId) {
        event.preventDefault();
        commit("Node order changed.", () => { graph = reorderNode(graph, selectedId, event.key === "ArrowUp" ? "up" : "down"); });
      }
    });

    on(root, "pointerdown", (event) => {
      const handle = event.target.closest("[data-ne-drag]");
      if (!handle || (typeof globalScope.matchMedia === "function" && globalScope.matchMedia("(max-width: 680px)").matches)) return;
      const node = graph.nodes.find((item) => item.id === handle.dataset.neDrag);
      if (!node) return;
      pointer = { id: node.id, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, moved: false, element: handle.closest("[data-ne-node]") };
      if (typeof handle.setPointerCapture === "function") handle.setPointerCapture(event.pointerId);
    });
    on(root, "pointermove", (event) => {
      if (!pointer) return;
      const deltaX = event.clientX - pointer.startX;
      const deltaY = event.clientY - pointer.startY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 4) return;
      pointer.moved = true;
      pointer.element.style.left = `${Math.max(0, Math.min(1600, pointer.x + deltaX))}px`;
      pointer.element.style.top = `${Math.max(0, Math.min(1000, pointer.y + deltaY))}px`;
      event.preventDefault();
    });
    on(root, "pointerup", (event) => {
      if (!pointer) return;
      const active = pointer;
      pointer = null;
      if (!active.moved) return;
      const x = Math.max(0, Math.min(1600, active.x + event.clientX - active.startX));
      const y = Math.max(0, Math.min(1000, active.y + event.clientY - active.startY));
      commit("Node position updated.", () => { const node = graph.nodes.find((item) => item.id === active.id); if (node) { node.x = x; node.y = y; } }, active.id);
    });

    const api = {
      unsupported: false,
      getGraph: () => clone(graph),
      setGraph: (value) => commit("Graph loaded.", () => { graph = deserializeGraph(value); selectedId = graph.nodes[0]?.id || null; markedIds = new Set(selectedId ? [selectedId] : []); }),
      addNode: (type, overrides) => { const next = addNode(graph, type, overrides); const node = next.nodes[next.nodes.length - 1]; commit(`${type} node added.`, () => { graph = next; selectedId = node.id; }, node.id); return clone(node); },
      connect: (from, to, port) => tryConnect(from, to, port),
      serialize: () => serializeGraph(graph),
      exportGraph: () => exportGraph(graph),
      render: () => renderGraph(graph, canvas),
      unmount: () => unmount(root)
    };
    mounted.set(root, { api, cleanup: () => {
      clearTimeout(saveTimer);
      if (frame && typeof globalScope.cancelAnimationFrame === "function") globalScope.cancelAnimationFrame(frame);
      listeners.splice(0).forEach((remove) => remove());
      root.innerHTML = "";
      root.classList.remove("hhne");
      delete root.dataset.graphicNodeEffects;
    } });
    render();
    if (!storage) announce("Local storage is unavailable. Export remains available.");
    return api;
  }

  function unmount(root) {
    const controller = root && mounted.get(root);
    if (!controller) return false;
    controller.cleanup();
    mounted.delete(root);
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, NODE_TYPES, NODE_DEFINITIONS, PRESETS,
    escapeHtml, createNode, createDefaultGraph, normalizeGraph, validateGraph,
    addNode, removeNode, connectNodes, disconnectNodes, reorderNode,
    setNodeEnabled, toggleNode, groupNodes, ungroupNodes, applyPreset,
    serializeGraph, deserializeGraph, exportGraph, renderGraph, mount, unmount
  });

  globalScope.HHGraphicNodeEffects = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
