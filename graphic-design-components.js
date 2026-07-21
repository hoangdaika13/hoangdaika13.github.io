(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-components";
  const LIBRARY_FORMAT = "hh-graphic-component-library";
  const STORAGE_KEY = "hh.graphic-components.project.v1";
  const STYLE_ID = "hh-graphic-components-style-v1";
  const SVG_NAMESPACE = "http" + "://www.w3.org/2000/svg";
  const XHTML_NAMESPACE = "http" + "://www.w3.org/1999/xhtml";
  const MAX_TREE_DEPTH = 18;
  const instances = new WeakMap();

  const VARIANT_AXES = Object.freeze({
    theme: Object.freeze(["light", "dark"]),
    size: Object.freeze(["sm", "md", "lg"]),
    state: Object.freeze(["default", "hover", "disabled"]),
    language: Object.freeze(["vi", "en", "ja"])
  });
  const AXIS_LABELS = Object.freeze({ theme: "Theme", size: "Size", state: "State", language: "Language" });
  const DEFAULT_SELECTION = Object.freeze({ theme: "dark", size: "md", state: "default", language: "vi" });
  const AXIS_ORDER = Object.freeze(Object.keys(VARIANT_AXES));
  const NODE_TYPES = Object.freeze(["frame", "text", "button", "component", "unsupported"]);
  const TOKEN_CATEGORIES = Object.freeze(["color", "font", "spacing", "radius"]);
  const CONSTRAINT_AXES = Object.freeze({
    horizontal: Object.freeze(["left", "center", "right", "stretch", "scale"]),
    vertical: Object.freeze(["top", "center", "bottom", "stretch", "scale"])
  });
  const ARTBOARD_PRESETS = Object.freeze({
    mobile: Object.freeze({ width: 390, height: 844, minWidth: 0, maxWidth: 599 }),
    tablet: Object.freeze({ width: 768, height: 1024, minWidth: 600, maxWidth: 1023 }),
    desktop: Object.freeze({ width: 1440, height: 1024, minWidth: 1024, maxWidth: 4096 })
  });
  const COLOR_PROPS = new Set(["background", "color", "borderColor"]);
  const NUMBER_RULES = Object.freeze({
    padding: [0, 96], gap: [0, 64], radius: [0, 64], width: [24, 1600], height: [16, 1200],
    minWidth: [0, 1600], maxWidth: [24, 4096], minHeight: [0, 1200], maxHeight: [16, 4096],
    fontSize: [8, 96], fontWeight: [100, 900], borderWidth: [0, 12], opacity: [0, 1]
  });
  const STRING_RULES = Object.freeze({
    layout: ["row", "column"], align: ["start", "center", "end", "stretch"],
    justify: ["start", "center", "end", "between"], wrap: ["nowrap", "wrap"]
  });

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, limit || 240);
  }

  function safeId(value, fallback) {
    const id = String(value || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    return id || fallback || uid("item");
  }

  function safeColor(value, fallback) {
    const color = String(value || "");
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
  }

  function bounded(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeJson(value, spacing) {
    return JSON.stringify(value, null, spacing).replace(/[<>&\u2028\u2029]/g, (character) => ({
      "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029"
    })[character]);
  }

  function createDefaultTokens() {
    return {
      base: {
        color: { accent: "#62D9E6", surface: "#151D2B", text: "#F8FAFC", muted: "#94A3B8", border: "#334155" },
        font: { body: "Inter, system-ui, sans-serif", display: "Inter, system-ui, sans-serif" },
        spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
        radius: { sm: 4, md: 8, lg: 16 }
      },
      themes: {
        light: { color: { surface: "#FFFFFF", text: "#0F172A", muted: "#475569", border: "#CBD5E1", accent: "#0F766E" } },
        dark: { color: { surface: "#151D2B", text: "#F8FAFC", muted: "#94A3B8", border: "#334155", accent: "#62D9E6" } }
      }
    };
  }

  function sanitizeTokenValue(category, value, fallback) {
    if (category === "color") return safeColor(value, fallback || "#000000");
    if (category === "font") {
      const font = cleanText(value, 120).replace(/[;{}<>]/g, "").trim();
      return font || fallback || "system-ui, sans-serif";
    }
    if (category === "spacing") return bounded(value, 0, 256, Number(fallback) || 0);
    if (category === "radius") return bounded(value, 0, 256, Number(fallback) || 0);
    return undefined;
  }

  function normalizeTokenGroup(raw, fallback) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const base = fallback && typeof fallback === "object" ? fallback : {};
    return TOKEN_CATEGORIES.reduce((output, category) => {
      output[category] = {};
      const values = source[category] && typeof source[category] === "object" ? source[category] : base[category] || {};
      Object.entries(values).slice(0, 100).forEach(([name, value]) => {
        const id = safeId(name, "");
        const normalized = sanitizeTokenValue(category, value, base[category]?.[id]);
        if (id && normalized !== undefined) output[category][id] = normalized;
      });
      return output;
    }, {});
  }

  function normalizeTokens(raw) {
    const fallback = createDefaultTokens();
    const source = raw && typeof raw === "object" ? raw : {};
    const base = normalizeTokenGroup(source.base, fallback.base);
    TOKEN_CATEGORIES.forEach((category) => {
      if (!Object.keys(base[category]).length) base[category] = clone(fallback.base[category]);
    });
    const themes = {};
    const rawThemes = source.themes && typeof source.themes === "object" ? source.themes : fallback.themes;
    Object.entries(rawThemes).slice(0, 12).forEach(([theme, values]) => { themes[safeId(theme, "theme")] = normalizeTokenGroup(values, {}); });
    if (!themes.light) themes.light = normalizeTokenGroup(fallback.themes.light, {});
    if (!themes.dark) themes.dark = normalizeTokenGroup(fallback.themes.dark, {});
    return { base, themes };
  }

  function normalizeTokenBindings(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const bindings = {};
    Object.entries(source).slice(0, 40).forEach(([property, rawPath]) => {
      if (![...Object.keys(NUMBER_RULES), ...Object.keys(STRING_RULES), ...COLOR_PROPS, "text", "disabled", "shadow"].includes(property)) return;
      const [category, name] = String(rawPath || "").split(".");
      if (TOKEN_CATEGORIES.includes(category) && safeId(name, "")) bindings[property] = `${category}.${safeId(name, "")}`;
    });
    return bindings;
  }

  function normalizeConstraints(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      horizontal: CONSTRAINT_AXES.horizontal.includes(source.horizontal) ? source.horizontal : "left",
      vertical: CONSTRAINT_AXES.vertical.includes(source.vertical) ? source.vertical : "top"
    };
  }

  function normalizeSelection(raw, fallback) {
    const source = raw && typeof raw === "object" ? raw : {};
    const base = fallback || DEFAULT_SELECTION;
    return AXIS_ORDER.reduce((selection, axis) => {
      selection[axis] = VARIANT_AXES[axis].includes(source[axis]) ? source[axis] : base[axis];
      return selection;
    }, {});
  }

  function normalizeVariantBinding(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return AXIS_ORDER.reduce((selection, axis) => {
      if (VARIANT_AXES[axis].includes(source[axis])) selection[axis] = source[axis];
      return selection;
    }, {});
  }

  function defaultProps(type) {
    if (type === "frame") return { layout: "column", wrap: "nowrap", align: "stretch", justify: "start", gap: 12, padding: 20, radius: 8, width: 320, background: "#151D2B", borderColor: "#334155", borderWidth: 1, opacity: 1 };
    if (type === "button") return { layout: "row", wrap: "nowrap", align: "center", justify: "center", gap: 8, padding: 12, radius: 6, background: "#62D9E6", borderColor: "#62D9E6", borderWidth: 1, opacity: 1, disabled: false };
    if (type === "text") return { text: "Text", color: "#F8FAFC", fontSize: 14, fontWeight: 500, opacity: 1 };
    return {};
  }

  function sanitizeProperty(name, value, fallback) {
    if (name === "text") return cleanText(value, 500);
    if (COLOR_PROPS.has(name)) return safeColor(value, fallback || "#000000");
    if (Object.prototype.hasOwnProperty.call(NUMBER_RULES, name)) {
      const range = NUMBER_RULES[name];
      return bounded(value, range[0], range[1], Number.isFinite(Number(fallback)) ? Number(fallback) : range[0]);
    }
    if (Object.prototype.hasOwnProperty.call(STRING_RULES, name)) return STRING_RULES[name].includes(value) ? value : (fallback || STRING_RULES[name][0]);
    if (name === "disabled" || name === "shadow") return value === true;
    return undefined;
  }

  function normalizeProps(type, raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const props = defaultProps(type);
    for (const name of [...Object.keys(NUMBER_RULES), ...Object.keys(STRING_RULES), ...COLOR_PROPS, "text", "disabled", "shadow"]) {
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const value = sanitizeProperty(name, source[name], props[name]);
      if (value !== undefined) props[name] = value;
    }
    return props;
  }

  function normalizeOverrideMap(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const overrides = {};
    for (const [rawPath, rawValue] of Object.entries(source).slice(0, 240)) {
      const parts = String(rawPath).split(".");
      if (parts.length !== 2) continue;
      const nodeId = safeId(parts[0], "");
      const property = parts[1];
      if (!nodeId || ![...Object.keys(NUMBER_RULES), ...Object.keys(STRING_RULES), ...COLOR_PROPS, "text", "disabled", "shadow"].includes(property)) continue;
      const value = sanitizeProperty(property, rawValue, undefined);
      if (value !== undefined) overrides[`${nodeId}.${property}`] = value;
    }
    return overrides;
  }

  function normalizeNode(raw, index, depth, seen) {
    const source = raw && typeof raw === "object" ? raw : {};
    if (depth > MAX_TREE_DEPTH || (seen && seen.has(source))) {
      return { id: uid("unsupported"), type: "unsupported", name: "Invalid node", props: {}, children: [], message: "Cay node vuot gioi han an toan." };
    }
    const nextSeen = seen || new WeakSet();
    nextSeen.add(source);
    const type = NODE_TYPES.includes(source.type) ? source.type : "frame";
    const node = {
      id: safeId(source.id, `node-${index || 0}`),
      type,
      name: cleanText(source.name || (type === "text" ? "Text" : "Layer"), 100),
      props: normalizeProps(type, source.props),
      tokenBindings: normalizeTokenBindings(source.tokenBindings),
      constraints: normalizeConstraints(source.constraints),
      children: []
    };
    if (type === "component") {
      node.componentId = safeId(source.componentId, "missing-component");
      node.variant = normalizeVariantBinding(source.variant);
      node.overrides = normalizeOverrideMap(source.overrides);
    } else if (type === "unsupported") {
      node.message = cleanText(source.message || "Node khong duoc ho tro.", 180);
    } else if (Array.isArray(source.children)) {
      node.children = source.children.slice(0, 60).map((child, childIndex) => normalizeNode(child, childIndex, depth + 1, nextSeen));
    }
    nextSeen.delete(source);
    return node;
  }

  function normalizeVariantValues(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return AXIS_ORDER.reduce((variants, axis) => {
      variants[axis] = {};
      const axisSource = source[axis] && typeof source[axis] === "object" ? source[axis] : {};
      for (const value of VARIANT_AXES[axis]) variants[axis][value] = normalizeOverrideMap(axisSource[value]);
      return variants;
    }, {});
  }

  function normalizeComponent(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      id: safeId(source.id, `component-${index || 0}`),
      name: cleanText(source.name || `Component ${(index || 0) + 1}`, 100),
      description: cleanText(source.description || "Reusable local component", 240),
      root: normalizeNode(source.root || { id: `root-${index || 0}`, type: "frame", name: "Root" }, 0, 0),
      variantAxes: clone(VARIANT_AXES),
      variantValues: normalizeVariantValues(source.variantValues)
    };
  }

  function buttonComponent() {
    return normalizeComponent({
      id: "action-button",
      name: "Action Button",
      description: "Primary action with theme, size, state and language variants.",
      root: {
        id: "button-root", type: "button", name: "Button", props: { background: "#62D9E6", borderColor: "#62D9E6", padding: 12, radius: 6, shadow: true },
        children: [{ id: "button-label", type: "text", name: "Label", props: { text: "Bat dau", color: "#071018", fontSize: 14, fontWeight: 800 } }]
      },
      variantValues: {
        theme: {
          light: { "button-root.background": "#0F766E", "button-root.borderColor": "#0F766E", "button-label.color": "#FFFFFF" },
          dark: { "button-root.background": "#62D9E6", "button-root.borderColor": "#62D9E6", "button-label.color": "#071018" }
        },
        size: {
          sm: { "button-root.padding": 8, "button-label.fontSize": 12 },
          md: { "button-root.padding": 12, "button-label.fontSize": 14 },
          lg: { "button-root.padding": 16, "button-label.fontSize": 17 }
        },
        state: {
          default: { "button-root.opacity": 1, "button-root.disabled": false },
          hover: { "button-root.background": "#C8EF73", "button-root.borderColor": "#C8EF73", "button-root.disabled": false },
          disabled: { "button-root.opacity": 0.45, "button-root.disabled": true }
        },
        language: {
          vi: {},
          en: { "button-label.text": "Get started" },
          ja: { "button-label.text": "Start" }
        }
      }
    }, 0);
  }

  function cardComponent() {
    return normalizeComponent({
      id: "feature-card",
      name: "Feature Card",
      description: "Card master containing a nested Action Button instance.",
      root: {
        id: "card-root", type: "frame", name: "Card", props: { background: "#151D2B", borderColor: "#334155", width: 330, padding: 22, gap: 12, radius: 8, shadow: true },
        children: [
          { id: "card-title", type: "text", name: "Title", props: { text: "He thong component", color: "#FFFFFF", fontSize: 21, fontWeight: 800 } },
          { id: "card-body", type: "text", name: "Body", props: { text: "Sua master mot lan, instance cap nhat ngay.", color: "#B8C5D6", fontSize: 13, fontWeight: 500 } },
          { id: "card-action", type: "component", name: "Nested Action", componentId: "action-button", variant: { size: "sm" }, overrides: {} }
        ]
      },
      variantValues: {
        theme: {
          light: { "card-root.background": "#FFFFFF", "card-root.borderColor": "#CBD5E1", "card-title.color": "#0F172A", "card-body.color": "#475569" },
          dark: { "card-root.background": "#151D2B", "card-root.borderColor": "#334155", "card-title.color": "#FFFFFF", "card-body.color": "#B8C5D6" }
        },
        size: {
          sm: { "card-root.width": 270, "card-root.padding": 16, "card-title.fontSize": 17 },
          md: { "card-root.width": 330, "card-root.padding": 22, "card-title.fontSize": 21 },
          lg: { "card-root.width": 420, "card-root.padding": 30, "card-title.fontSize": 27 }
        },
        state: {
          default: { "card-root.opacity": 1 }, hover: { "card-root.borderColor": "#F25CB4" }, disabled: { "card-root.opacity": 0.45 }
        },
        language: {
          vi: {},
          en: { "card-title.text": "Component system", "card-body.text": "Edit the master once and every instance follows." },
          ja: { "card-title.text": "Component system", "card-body.text": "Master edits propagate to every instance." }
        }
      }
    }, 1);
  }

  function createDefaultProject() {
    const components = [buttonComponent(), cardComponent()];
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("components"),
      name: "HH Component Library",
      updatedAt: new Date().toISOString(),
      library: {
        id: "hh-local-library",
        name: "HH Local Components",
        description: "Reusable component masters stored on this device.",
        components
      },
      instances: [
        { id: "button-live", name: "Live instance", componentId: "action-button", sourceComponentId: "action-button", selection: clone(DEFAULT_SELECTION), overrides: {}, detached: false, snapshot: null },
        { id: "button-override", name: "Label override", componentId: "action-button", sourceComponentId: "action-button", selection: clone(DEFAULT_SELECTION), overrides: { "button-label.text": "Dung mien phi" }, detached: false, snapshot: null },
        { id: "card-live", name: "Nested card", componentId: "feature-card", sourceComponentId: "feature-card", selection: clone(DEFAULT_SELECTION), overrides: {}, detached: false, snapshot: null }
      ],
      tokens: createDefaultTokens(),
      activeTheme: "dark",
      artboards: Object.entries(ARTBOARD_PRESETS).map(([id, preset]) => ({ id, name: id[0].toUpperCase() + id.slice(1), ...preset, rootInstanceId: id === "desktop" ? "card-live" : "button-live" })),
      devMode: { readyForHandoff: false, includeComments: true, unit: "px" }
    };
  }

  function normalizeArtboard(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    const preset = ARTBOARD_PRESETS[Object.keys(ARTBOARD_PRESETS)[index] || "desktop"] || ARTBOARD_PRESETS.desktop;
    const minWidth = bounded(source.minWidth, 0, 4096, preset.minWidth);
    const maxWidth = bounded(source.maxWidth, minWidth, 8192, preset.maxWidth);
    return {
      id: safeId(source.id, `artboard-${index + 1}`),
      name: cleanText(source.name || `Artboard ${index + 1}`, 80),
      width: Math.round(bounded(source.width, 64, 8192, preset.width)),
      height: Math.round(bounded(source.height, 64, 8192, preset.height)),
      minWidth: Math.round(minWidth),
      maxWidth: Math.round(maxWidth),
      rootInstanceId: safeId(source.rootInstanceId, "") || null
    };
  }

  function normalizeDetachedSnapshot(raw) {
    if (!raw || typeof raw !== "object" || !raw.root) return null;
    return {
      name: cleanText(raw.name || "Detached component", 100),
      selection: normalizeSelection(raw.selection),
      root: normalizeNode(raw.root, 0, 0)
    };
  }

  function normalizeInstance(raw, index, fallbackComponentId) {
    const source = raw && typeof raw === "object" ? raw : {};
    const detached = source.detached === true;
    const componentId = detached ? null : safeId(source.componentId || source.sourceComponentId, fallbackComponentId);
    return {
      id: safeId(source.id, `instance-${index || 0}`),
      name: cleanText(source.name || `Instance ${(index || 0) + 1}`, 100),
      componentId,
      sourceComponentId: safeId(source.sourceComponentId || source.componentId, fallbackComponentId),
      selection: normalizeSelection(source.selection),
      overrides: detached ? {} : normalizeOverrideMap(source.overrides),
      detached,
      snapshot: detached ? normalizeDetachedSnapshot(source.snapshot) : null
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : {};
    const sourceLibrary = source.library && typeof source.library === "object" ? source.library : {};
    const rawComponents = Array.isArray(sourceLibrary.components) && sourceLibrary.components.length ? sourceLibrary.components : fallback.library.components;
    const components = rawComponents.slice(0, 100).map((component, index) => normalizeComponent(component, index));
    const usedComponentIds = new Set();
    components.forEach((component, index) => {
      let id = component.id;
      while (usedComponentIds.has(id)) id = `${component.id}-${index + 1}`;
      component.id = id;
      usedComponentIds.add(id);
    });
    const firstComponentId = components[0]?.id || "missing-component";
    const rawInstances = Array.isArray(source.instances) ? source.instances : fallback.instances;
    const normalizedInstances = rawInstances.slice(0, 200).map((instance, index) => normalizeInstance(instance, index, firstComponentId));
    const usedInstanceIds = new Set();
    normalizedInstances.forEach((instance, index) => {
      let id = instance.id;
      while (usedInstanceIds.has(id)) id = `${instance.id}-${index + 1}`;
      instance.id = id;
      usedInstanceIds.add(id);
    });
    return {
      format: FORMAT,
      version: VERSION,
      id: safeId(source.id, fallback.id),
      name: cleanText(source.name || fallback.name, 140),
      updatedAt: new Date().toISOString(),
      library: {
        id: safeId(sourceLibrary.id, fallback.library.id),
        name: cleanText(sourceLibrary.name || fallback.library.name, 120),
        description: cleanText(sourceLibrary.description || fallback.library.description, 300),
        components
      },
      instances: normalizedInstances,
      tokens: normalizeTokens(source.tokens || fallback.tokens),
      activeTheme: safeId(source.activeTheme, "dark"),
      artboards: (Array.isArray(source.artboards) && source.artboards.length ? source.artboards : fallback.artboards).slice(0, 30).map(normalizeArtboard),
      devMode: {
        readyForHandoff: source.devMode?.readyForHandoff === true,
        includeComments: source.devMode?.includeComments !== false,
        unit: ["px", "rem"].includes(source.devMode?.unit) ? source.devMode.unit : "px"
      }
    };
  }

  function walkNodes(node, visitor) {
    if (!node) return;
    visitor(node);
    (node.children || []).forEach((child) => walkNodes(child, visitor));
  }

  function findNode(root, nodeId) {
    let found = null;
    walkNodes(root, (node) => { if (!found && node.id === nodeId) found = node; });
    return found;
  }

  function componentMap(project) {
    return new Map(project.library.components.map((component) => [component.id, component]));
  }

  function tokenValueFromProject(project, path, themeInput) {
    const [category, rawName] = String(path || "").split(".");
    const name = safeId(rawName, "");
    if (!TOKEN_CATEGORIES.includes(category) || !name) return undefined;
    const theme = safeId(themeInput || project.activeTheme, "dark");
    const themed = project.tokens?.themes?.[theme]?.[category]?.[name];
    return themed !== undefined ? themed : project.tokens?.base?.[category]?.[name];
  }

  function resolveToken(projectInput, path, theme) {
    const project = normalizeProject(projectInput);
    return clone(tokenValueFromProject(project, path, theme));
  }

  function applyTokenBindings(root, project, theme) {
    walkNodes(root, (node) => {
      if (!node.props || node.type === "component" || node.type === "unsupported") return;
      Object.entries(normalizeTokenBindings(node.tokenBindings)).forEach(([property, path]) => {
        const token = tokenValueFromProject(project, path, theme);
        const value = sanitizeProperty(property, token, node.props[property]);
        if (value !== undefined) node.props[property] = value;
      });
    });
    return root;
  }

  function graphForProject(project) {
    const graph = new Map(project.library.components.map((component) => [component.id, []]));
    project.library.components.forEach((component) => {
      walkNodes(component.root, (node) => { if (node.type === "component") graph.get(component.id).push(node.componentId); });
    });
    return graph;
  }

  function validateGraph(projectInput) {
    const project = normalizeProject(projectInput);
    const graph = graphForProject(project);
    const known = new Set(graph.keys());
    const missing = [];
    graph.forEach((targets, from) => targets.forEach((target) => { if (!known.has(target)) missing.push({ from, target }); }));
    const state = new Map();
    const stack = [];
    const cycleKeys = new Set();
    const cycles = [];
    function visit(id) {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) {
        const start = stack.indexOf(id);
        const cycle = [...stack.slice(start), id];
        const key = cycle.join("->");
        if (!cycleKeys.has(key)) { cycleKeys.add(key); cycles.push(cycle); }
        return;
      }
      state.set(id, 1); stack.push(id);
      (graph.get(id) || []).filter((target) => known.has(target)).forEach(visit);
      stack.pop(); state.set(id, 2);
    }
    graph.forEach((_, id) => visit(id));
    return { valid: cycles.length === 0 && missing.length === 0, cycles, missing, graph: Object.fromEntries([...graph].map(([id, targets]) => [id, [...targets]])) };
  }

  function wouldCreateCycle(projectInput, parentComponentId, childComponentId) {
    const project = normalizeProject(projectInput);
    const parent = safeId(parentComponentId, "");
    const child = safeId(childComponentId, "");
    const graph = graphForProject(project);
    if (!graph.has(parent) || !graph.has(child) || parent === child) return true;
    const visited = new Set();
    function reachesParent(id) {
      if (id === parent) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return (graph.get(id) || []).some(reachesParent);
    }
    return reachesParent(child);
  }

  function applyOverrides(root, overrides) {
    for (const [path, rawValue] of Object.entries(normalizeOverrideMap(overrides))) {
      const [nodeId, property] = path.split(".");
      const node = findNode(root, nodeId);
      if (!node || node.type === "component" || node.type === "unsupported") continue;
      const value = sanitizeProperty(property, rawValue, node.props[property]);
      if (value !== undefined) node.props[property] = value;
    }
    return root;
  }

  function resolveComponentFromProject(project, componentId, selectionInput, overrides, stack) {
    const map = componentMap(project);
    const selection = normalizeSelection(selectionInput);
    const component = map.get(componentId);
    if (!component) {
      return {
        componentId, name: "Missing component", selection, issues: [{ type: "missing", componentId }],
        root: { id: uid("missing"), type: "unsupported", name: "Missing component", props: {}, children: [], message: `Component '${cleanText(componentId, 80)}' khong ton tai trong library.` }
      };
    }
    const lineage = Array.isArray(stack) ? stack : [];
    if (lineage.includes(componentId) || lineage.length >= MAX_TREE_DEPTH) {
      return {
        componentId, name: component.name, selection, issues: [{ type: "cycle", path: [...lineage, componentId] }],
        root: { id: uid("cycle"), type: "unsupported", name: "Cycle blocked", props: {}, children: [], message: `Da chan cycle: ${[...lineage, componentId].join(" -> ")}` }
      };
    }
    const root = clone(component.root);
    AXIS_ORDER.forEach((axis) => applyOverrides(root, component.variantValues[axis][selection[axis]]));
    applyTokenBindings(root, project, selection.theme);
    applyOverrides(root, overrides);
    const issues = [];
    function resolveNested(node) {
      if (node.type === "component") {
        const nestedSelection = normalizeSelection({ ...selection, ...node.variant }, selection);
        const nested = resolveComponentFromProject(project, node.componentId, nestedSelection, node.overrides, [...lineage, componentId]);
        issues.push(...nested.issues);
        node.resolved = nested.root;
        node.resolvedName = nested.name;
        node.selection = nested.selection;
        return;
      }
      (node.children || []).forEach(resolveNested);
    }
    resolveNested(root);
    return { componentId: component.id, name: component.name, selection, root, issues };
  }

  function resolveComponent(projectInput, componentId, selection, overrides) {
    const project = normalizeProject(projectInput);
    return resolveComponentFromProject(project, safeId(componentId, "missing-component"), selection, overrides, []);
  }

  function flattenResolvedNode(node) {
    if (!node) return { id: uid("empty"), type: "unsupported", name: "Empty", props: {}, children: [], message: "Snapshot trong." };
    if (node.type === "component") {
      return {
        id: node.id, type: "frame", name: node.resolvedName || node.name, props: { layout: "column", align: "stretch", justify: "start", gap: 0, padding: 0, radius: 0, width: 320, background: "#151D2B", borderColor: "#151D2B", borderWidth: 0, opacity: 1 },
        children: [flattenResolvedNode(node.resolved)]
      };
    }
    return { ...clone(node), children: (node.children || []).map(flattenResolvedNode) };
  }

  function resolveInstance(projectInput, instanceId) {
    const project = normalizeProject(projectInput);
    const instance = project.instances.find((item) => item.id === instanceId);
    if (!instance) return null;
    if (instance.detached) {
      if (!instance.snapshot) {
        return { instanceId: instance.id, detached: true, name: instance.name, componentId: instance.sourceComponentId, selection: instance.selection, issues: [{ type: "missing-snapshot" }], root: { id: uid("missing"), type: "unsupported", name: "Missing snapshot", props: {}, children: [], message: "Detached instance khong co snapshot hop le." } };
      }
      return { instanceId: instance.id, detached: true, componentId: instance.sourceComponentId, name: instance.name, selection: clone(instance.snapshot.selection), root: clone(instance.snapshot.root), issues: [] };
    }
    const resolved = resolveComponentFromProject(project, instance.componentId, instance.selection, instance.overrides, []);
    return { ...resolved, instanceId: instance.id, instanceName: instance.name, detached: false };
  }

  function setMasterProperty(projectInput, componentId, path, value) {
    const project = normalizeProject(projectInput);
    const component = project.library.components.find((item) => item.id === componentId);
    const parts = String(path || "").split(".");
    if (!component || parts.length !== 2) return project;
    const node = findNode(component.root, safeId(parts[0], ""));
    if (!node || node.type === "component" || node.type === "unsupported") return project;
    const nextValue = sanitizeProperty(parts[1], value, node.props[parts[1]]);
    if (nextValue !== undefined) node.props[parts[1]] = nextValue;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function updateMaster(projectInput, componentId, pathOrPatch, value) {
    if (typeof pathOrPatch === "string") return setMasterProperty(projectInput, componentId, pathOrPatch, value);
    let project = normalizeProject(projectInput);
    for (const [path, nextValue] of Object.entries(pathOrPatch && typeof pathOrPatch === "object" ? pathOrPatch : {})) project = setMasterProperty(project, componentId, path, nextValue);
    return project;
  }

  function setVariantProperty(projectInput, componentId, axis, variant, path, value) {
    const project = normalizeProject(projectInput);
    const component = project.library.components.find((item) => item.id === componentId);
    if (!component || !VARIANT_AXES[axis]?.includes(variant)) return project;
    const normalized = normalizeOverrideMap({ [path]: value });
    const normalizedPath = Object.keys(normalized)[0];
    if (!normalizedPath) return project;
    component.variantValues[axis][variant][normalizedPath] = normalized[normalizedPath];
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function setInstanceOverride(projectInput, instanceId, path, value) {
    const project = normalizeProject(projectInput);
    const instance = project.instances.find((item) => item.id === instanceId);
    const parts = String(path || "").split(".");
    if (!instance || instance.detached || parts.length !== 2) return project;
    const normalized = normalizeOverrideMap({ [path]: value });
    if (Object.prototype.hasOwnProperty.call(normalized, `${safeId(parts[0], "")}.${parts[1]}`)) instance.overrides = { ...instance.overrides, ...normalized };
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function resetOverride(projectInput, instanceId, path) {
    const project = normalizeProject(projectInput);
    const instance = project.instances.find((item) => item.id === instanceId);
    if (!instance || instance.detached) return project;
    if (path == null) instance.overrides = {};
    else delete instance.overrides[String(path)];
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function setInstanceVariant(projectInput, instanceId, axis, value) {
    const project = normalizeProject(projectInput);
    const instance = project.instances.find((item) => item.id === instanceId);
    if (!instance || instance.detached || !VARIANT_AXES[axis]?.includes(value)) return project;
    instance.selection[axis] = value;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function detachInstance(projectInput, instanceId) {
    const project = normalizeProject(projectInput);
    const instance = project.instances.find((item) => item.id === instanceId);
    if (!instance || instance.detached) return project;
    const resolved = resolveComponentFromProject(project, instance.componentId, instance.selection, instance.overrides, []);
    instance.snapshot = { name: resolved.name, selection: clone(resolved.selection), root: flattenResolvedNode(resolved.root) };
    instance.sourceComponentId = instance.componentId;
    instance.componentId = null;
    instance.overrides = {};
    instance.detached = true;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function createInstance(projectInput, componentId, options) {
    const project = normalizeProject(projectInput);
    const component = project.library.components.find((item) => item.id === componentId);
    if (!component) throw new RangeError(`Unknown component: ${cleanText(componentId, 80)}`);
    const settings = options && typeof options === "object" ? options : {};
    return normalizeInstance({
      id: settings.id || uid("instance"), name: settings.name || `${component.name} instance`, componentId: component.id,
      sourceComponentId: component.id, selection: settings.selection, overrides: settings.overrides, detached: false
    }, project.instances.length, component.id);
  }

  function addInstance(projectInput, componentId, options) {
    const project = normalizeProject(projectInput);
    const instance = createInstance(project, componentId, options);
    const used = new Set(project.instances.map((item) => item.id));
    while (used.has(instance.id)) instance.id = uid("instance");
    project.instances.push(instance);
    project.updatedAt = new Date().toISOString();
    return { project, instance: clone(instance) };
  }

  function createComponent(options) {
    const settings = options && typeof options === "object" ? options : {};
    return normalizeComponent({
      id: settings.id || uid("component"), name: settings.name || "New Component", description: settings.description || "Reusable local component",
      root: settings.root || { id: uid("root"), type: "frame", name: "Root", children: [{ id: uid("label"), type: "text", name: "Label", props: { text: "New component" } }] },
      variantValues: settings.variantValues
    }, 0);
  }

  function addComponent(projectInput, componentInput) {
    const project = normalizeProject(projectInput);
    const component = normalizeComponent(componentInput || createComponent(), project.library.components.length);
    const used = new Set(project.library.components.map((item) => item.id));
    const base = component.id;
    let suffix = 2;
    while (used.has(component.id)) component.id = `${base}-${suffix++}`;
    project.library.components.push(component);
    project.updatedAt = new Date().toISOString();
    return { project, component: clone(component) };
  }

  function addNestedComponent(projectInput, parentComponentId, childComponentId, options) {
    const project = normalizeProject(projectInput);
    const parent = project.library.components.find((item) => item.id === parentComponentId);
    const child = project.library.components.find((item) => item.id === childComponentId);
    if (!parent || !child) return { ok: false, project, error: "Component cha hoac con khong ton tai." };
    if (wouldCreateCycle(project, parent.id, child.id)) return { ok: false, project, error: "Khong the long component vi quan he nay tao cycle." };
    const target = options?.targetNodeId ? findNode(parent.root, safeId(options.targetNodeId, "")) : parent.root;
    if (!target || target.type === "component" || target.type === "text" || target.type === "unsupported") return { ok: false, project, error: "Node dich khong the chua component con." };
    const used = new Set(); walkNodes(parent.root, (node) => used.add(node.id));
    let nodeId = safeId(options?.id, `${child.id}-nested`); let suffix = 2;
    while (used.has(nodeId)) nodeId = `${safeId(options?.id, `${child.id}-nested`)}-${suffix++}`;
    target.children.push(normalizeNode({ id: nodeId, type: "component", name: options?.name || child.name, componentId: child.id, variant: options?.selection, overrides: options?.overrides }, target.children.length, 0));
    project.updatedAt = new Date().toISOString();
    return { ok: true, project, nodeId };
  }

  function serializeProject(projectInput) {
    return safeJson(normalizeProject(projectInput), 2);
  }

  function deserializeProject(serialized) {
    let parsed;
    try { parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized; }
    catch (_) { throw new TypeError("Project JSON khong hop le."); }
    if (!parsed || (parsed.format && parsed.format !== FORMAT)) throw new TypeError(`Chi ho tro format ${FORMAT}.`);
    return normalizeProject(parsed);
  }

  function serializeLibrary(projectInput) {
    const project = normalizeProject(projectInput);
    return safeJson({ format: LIBRARY_FORMAT, version: VERSION, exportedAt: new Date().toISOString(), library: project.library }, 2);
  }

  function importLibrary(projectInput, serialized, options) {
    const project = normalizeProject(projectInput);
    let parsed;
    try { parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized; }
    catch (_) { return { ok: false, project, added: [], error: "Library JSON khong hop le." }; }
    if (!parsed || parsed.format !== LIBRARY_FORMAT || !parsed.library || !Array.isArray(parsed.library.components)) return { ok: false, project, added: [], error: `Chi ho tro format ${LIBRARY_FORMAT}.` };
    const incoming = parsed.library.components.slice(0, 100).map((item, index) => normalizeComponent(item, index));
    const replace = options?.replace === true;
    const used = new Set(project.library.components.map((item) => item.id));
    const idMap = new Map();
    incoming.forEach((component) => {
      const original = component.id;
      if (replace && used.has(original)) { idMap.set(original, original); return; }
      let id = original; let suffix = 2;
      while (used.has(id)) id = `${original}-${suffix++}`;
      idMap.set(original, id); used.add(id);
    });
    incoming.forEach((component) => {
      component.id = idMap.get(component.id) || component.id;
      walkNodes(component.root, (node) => { if (node.type === "component" && idMap.has(node.componentId)) node.componentId = idMap.get(node.componentId); });
    });
    incoming.forEach((component) => {
      const index = project.library.components.findIndex((item) => item.id === component.id);
      if (index >= 0 && replace) project.library.components[index] = component;
      else project.library.components.push(component);
    });
    const graph = validateGraph(project);
    if (graph.cycles.length) return { ok: false, project: normalizeProject(projectInput), added: [], error: "Library import bi chan vi co nested cycle." };
    project.updatedAt = new Date().toISOString();
    return { ok: true, project, added: incoming.map((item) => item.id), error: null };
  }

  function setToken(projectInput, path, value, themeInput) {
    const project = normalizeProject(projectInput);
    const [category, rawName] = String(path || "").split(".");
    const name = safeId(rawName, "");
    if (!TOKEN_CATEGORIES.includes(category) || !name) return project;
    const theme = themeInput == null ? null : safeId(themeInput, "");
    const target = theme
      ? (project.tokens.themes[theme] || (project.tokens.themes[theme] = normalizeTokenGroup({}, {})))
      : project.tokens.base;
    const fallback = target[category]?.[name] ?? project.tokens.base[category]?.[name];
    const normalized = sanitizeTokenValue(category, value, fallback);
    if (normalized !== undefined) target[category][name] = normalized;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function setNodeTokenBinding(projectInput, componentId, nodeId, property, tokenPath) {
    const project = normalizeProject(projectInput);
    const component = project.library.components.find((item) => item.id === safeId(componentId, ""));
    const node = component && findNode(component.root, safeId(nodeId, ""));
    const normalized = normalizeTokenBindings({ [property]: tokenPath });
    if (!node || !Object.prototype.hasOwnProperty.call(normalized, property)) return project;
    node.tokenBindings[property] = normalized[property];
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function setNodeConstraints(projectInput, componentId, nodeId, constraints) {
    const project = normalizeProject(projectInput);
    const component = project.library.components.find((item) => item.id === safeId(componentId, ""));
    const node = component && findNode(component.root, safeId(nodeId, ""));
    if (node) node.constraints = normalizeConstraints(constraints);
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function addArtboard(projectInput, options) {
    const project = normalizeProject(projectInput);
    const candidate = normalizeArtboard(options, project.artboards.length);
    const used = new Set(project.artboards.map((item) => item.id));
    const base = candidate.id;
    let suffix = 2;
    while (used.has(candidate.id)) candidate.id = `${base}-${suffix++}`;
    if (!project.instances.some((item) => item.id === candidate.rootInstanceId)) candidate.rootInstanceId = project.instances[0]?.id || null;
    project.artboards.push(candidate);
    project.updatedAt = new Date().toISOString();
    return { project, artboard: clone(candidate) };
  }

  function selectResponsiveArtboard(projectInput, viewportWidth) {
    const project = normalizeProject(projectInput);
    const width = bounded(viewportWidth, 0, 8192, 0);
    const exact = project.artboards.find((item) => width >= item.minWidth && width <= item.maxWidth);
    if (exact) return clone(exact);
    return clone([...project.artboards].sort((a, b) => Math.abs(a.width - width) - Math.abs(b.width - width))[0] || null);
  }

  function intrinsicNodeSize(node) {
    const props = node.props || {};
    if (node.type === "text") return { width: Math.max(16, cleanText(props.text, 500).length * bounded(props.fontSize, 8, 96, 14) * 0.56), height: bounded(props.fontSize, 8, 96, 14) * 1.35 };
    return { width: bounded(props.width, 24, 4096, node.type === "button" ? 140 : 320), height: bounded(props.height, 16, 4096, node.type === "button" ? 44 : 80) };
  }

  function applyConstraintSize(size, parentSize, axis) {
    if (axis === "stretch") return parentSize;
    if (axis === "scale") return Math.min(parentSize, size);
    return size;
  }

  function computeAutoLayout(resolvedInput, containerInput) {
    const root = resolvedInput?.root ? resolvedInput.root : resolvedInput;
    const container = {
      x: bounded(containerInput?.x, -8192, 8192, 0), y: bounded(containerInput?.y, -8192, 8192, 0),
      width: bounded(containerInput?.width, 24, 8192, intrinsicNodeSize(root || {}).width),
      height: bounded(containerInput?.height, 16, 8192, intrinsicNodeSize(root || {}).height)
    };
    function layout(node, box) {
      if (!node) return null;
      const props = node.props || {};
      const intrinsic = intrinsicNodeSize(node);
      const constraints = normalizeConstraints(node.constraints);
      const width = applyConstraintSize(bounded(props.width, 24, 4096, intrinsic.width), box.width, constraints.horizontal);
      const height = applyConstraintSize(bounded(props.height, 16, 4096, intrinsic.height), box.height, constraints.vertical);
      const x = constraints.horizontal === "right" ? box.x + box.width - width : constraints.horizontal === "center" ? box.x + (box.width - width) / 2 : box.x;
      const y = constraints.vertical === "bottom" ? box.y + box.height - height : constraints.vertical === "center" ? box.y + (box.height - height) / 2 : box.y;
      const result = { id: node.id, type: node.type, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), children: [] };
      const children = (node.children || []).filter((item) => item.type !== "unsupported");
      if (!children.length) return result;
      const padding = bounded(props.padding, 0, 256, 0);
      const gap = bounded(props.gap, 0, 256, 0);
      const row = props.layout === "row";
      let cursor = row ? x + padding : y + padding;
      children.forEach((child) => {
        const childSize = intrinsicNodeSize(child);
        const childBox = row
          ? { x: cursor, y: y + padding, width: childSize.width, height: Math.max(16, height - padding * 2) }
          : { x: x + padding, y: cursor, width: Math.max(24, width - padding * 2), height: childSize.height };
        const childLayout = layout(child, childBox);
        if (childLayout) { result.children.push(childLayout); cursor += (row ? childLayout.width : childLayout.height) + gap; }
      });
      return result;
    }
    return layout(root, container);
  }

  function tokenEntries(projectInput, theme) {
    const project = normalizeProject(projectInput);
    const entries = [];
    TOKEN_CATEGORIES.forEach((category) => {
      const names = new Set([...Object.keys(project.tokens.base[category] || {}), ...Object.keys(project.tokens.themes[safeId(theme || project.activeTheme, "dark")]?.[category] || {})]);
      names.forEach((name) => entries.push({ category, name, path: `${category}.${name}`, value: tokenValueFromProject(project, `${category}.${name}`, theme) }));
    });
    return entries;
  }

  function exportCssVariables(projectInput, theme) {
    const variables = tokenEntries(projectInput, theme).map((token) => `  --hh-${token.category}-${token.name}: ${token.category === "spacing" || token.category === "radius" ? `${token.value}px` : token.value};`);
    return `:root {\n${variables.join("\n")}\n}`;
  }

  function exportTailwindConfig(projectInput, theme) {
    const groups = { colors: {}, fontFamily: {}, spacing: {}, borderRadius: {} };
    tokenEntries(projectInput, theme).forEach((token) => {
      if (token.category === "color") groups.colors[token.name] = token.value;
      if (token.category === "font") groups.fontFamily[token.name] = token.value.split(",").map((item) => item.trim().replace(/^['\"]|['\"]$/g, ""));
      if (token.category === "spacing") groups.spacing[token.name] = `${token.value}px`;
      if (token.category === "radius") groups.borderRadius[token.name] = `${token.value}px`;
    });
    return `module.exports = ${safeJson({ theme: { extend: groups } }, 2)};`;
  }

  function exportComponentSvg(projectInput, componentId, selection, width, height) {
    const resolved = resolveComponent(projectInput, componentId, selection || {});
    const safeWidth = Math.round(bounded(width, 64, 4096, 640));
    const safeHeight = Math.round(bounded(height, 64, 4096, 480));
    return `<svg xmlns="${SVG_NAMESPACE}" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><foreignObject width="100%" height="100%"><div xmlns="${XHTML_NAMESPACE}" style="box-sizing:border-box;padding:24px;background:#0b111b;width:100%;height:100%">${renderResolvedHtml(resolved)}</div></foreignObject></svg>`;
  }

  function inspectComponent(projectInput, componentId, selection) {
    const project = normalizeProject(projectInput);
    const resolved = resolveComponent(project, componentId, selection || {});
    const nodes = [];
    walkNodes(resolved.root, (node) => nodes.push({ id: node.id, type: node.type, props: clone(node.props || {}), tokenBindings: clone(node.tokenBindings || {}), constraints: clone(node.constraints || {}) }));
    return { componentId: resolved.componentId, selection: resolved.selection, issues: resolved.issues, nodes, tokens: tokenEntries(project, resolved.selection.theme) };
  }

  function exportDevMode(projectInput, componentId, selection) {
    const project = normalizeProject(projectInput);
    return {
      format: "hh-dev-handoff",
      version: 1,
      readyForHandoff: project.devMode.readyForHandoff,
      inspect: inspectComponent(project, componentId, selection),
      cssVariables: exportCssVariables(project, selection?.theme),
      tailwindConfig: exportTailwindConfig(project, selection?.theme),
      svg: exportComponentSvg(project, componentId, selection)
    };
  }

  function validStorage(storage) {
    return !!storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";
  }

  function saveProject(storage, projectInput) {
    if (!validStorage(storage)) return { ok: false, reason: "unsupported" };
    try { storage.setItem(STORAGE_KEY, serializeProject(projectInput)); return { ok: true, reason: null }; }
    catch (error) { return { ok: false, reason: error?.name === "QuotaExceededError" ? "quota" : "unavailable" }; }
  }

  function loadProject(storage) {
    if (!validStorage(storage)) return { ok: false, reason: "unsupported", project: createDefaultProject() };
    try {
      const saved = storage.getItem(STORAGE_KEY);
      return { ok: true, reason: null, project: saved ? deserializeProject(saved) : createDefaultProject() };
    } catch (_) { return { ok: false, reason: "invalid-or-unavailable", project: createDefaultProject() }; }
  }

  function cssStyle(props) {
    const align = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" }[props.align] || "stretch";
    const justify = { start: "flex-start", center: "center", end: "flex-end", between: "space-between" }[props.justify] || "flex-start";
    const values = [
      `opacity:${bounded(props.opacity, 0, 1, 1)}`, `gap:${bounded(props.gap, 0, 64, 0)}px`, `padding:${bounded(props.padding, 0, 96, 0)}px`,
      `border-radius:${bounded(props.radius, 0, 64, 0)}px`, `border:${bounded(props.borderWidth, 0, 12, 0)}px solid ${safeColor(props.borderColor, "#334155")}`,
      `background:${safeColor(props.background, "#151D2B")}`, `align-items:${align}`, `justify-content:${justify}`,
      `flex-direction:${props.layout === "row" ? "row" : "column"}`, `flex-wrap:${props.wrap === "wrap" ? "wrap" : "nowrap"}`
    ];
    if (Number.isFinite(Number(props.width))) values.push(`width:${bounded(props.width, 24, 1600, 320)}px;max-width:100%`);
    if (Number.isFinite(Number(props.height))) values.push(`min-height:${bounded(props.height, 16, 1200, 16)}px`);
    if (props.shadow) values.push("box-shadow:0 12px 30px rgba(0,0,0,.25)");
    return values.join(";");
  }

  function renderResolvedNode(node) {
    if (!node || node.type === "unsupported") return `<div class="hgc-unsupported" role="status">${escapeHtml(node?.message || "No preview available.")}</div>`;
    if (node.type === "component") return `<div class="hgc-nested" data-hgc-nested-preview="${escapeHtml(node.componentId)}"><span class="hgc-nested-label">${escapeHtml(node.resolvedName || node.name)}</span>${renderResolvedNode(node.resolved)}</div>`;
    if (node.type === "text") {
      const props = node.props || {};
      return `<span class="hgc-node-text" style="color:${safeColor(props.color, "#F8FAFC")};font-size:${bounded(props.fontSize, 8, 96, 14)}px;font-weight:${bounded(props.fontWeight, 100, 900, 500)};opacity:${bounded(props.opacity, 0, 1, 1)}">${escapeHtml(props.text)}</span>`;
    }
    const className = node.type === "button" ? "hgc-node hgc-node-button" : "hgc-node hgc-node-frame";
    const disabled = node.props?.disabled ? " is-disabled" : "";
    return `<div class="${className}${disabled}" style="${cssStyle(node.props || {})}"${node.type === "button" ? ` role="img" aria-label="Button preview${node.props?.disabled ? ", disabled" : ""}"` : ""}>${(node.children || []).map(renderResolvedNode).join("")}</div>`;
  }

  function renderResolvedHtml(resolved) {
    if (!resolved || !resolved.root) return `<div class="hgc-unsupported" role="status">No preview available.</div>`;
    return renderResolvedNode(resolved.root);
  }

  function getCapabilities(storageCandidate) {
    let storage = storageCandidate;
    if (arguments.length === 0) {
      try { storage = globalScope.localStorage; } catch (_) { storage = null; }
    }
    return {
      dom: typeof globalScope.document !== "undefined" && typeof globalScope.document.createElement === "function",
      localPersistence: validStorage(storage),
      clipboard: !!globalScope.navigator?.clipboard?.writeText,
      download: typeof globalScope.Blob === "function" && !!globalScope.URL?.createObjectURL
    };
  }

  function addStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hgc{--cyan:#62d9e6;--pink:#f25cb4;--lime:#c8ef73;--ink:#071018;--bg:#090e16;--panel:#101925;--panel2:#151f2d;--line:#2d3d50;--muted:#96a7ba;color:#eef7ff;background:var(--bg);border:1px solid var(--line);border-radius:8px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif;min-width:0}.hgc *{box-sizing:border-box}.hgc button,.hgc input,.hgc select{font:inherit}.hgc button{min-height:34px;padding:7px 10px;border:1px solid #3a4f64;border-radius:6px;background:#142131;color:#edf7ff;cursor:pointer}.hgc button:hover{border-color:var(--cyan)}.hgc button:focus-visible,.hgc input:focus-visible,.hgc select:focus-visible,.hgc [tabindex]:focus-visible{outline:2px solid var(--lime);outline-offset:2px}.hgc button:disabled{cursor:not-allowed;opacity:.45}.hgc-primary{background:var(--cyan)!important;border-color:var(--cyan)!important;color:var(--ink)!important;font-weight:800}.hgc-danger{border-color:#b84d72!important;color:#ffb5cd!important}.hgc-header{display:flex;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid var(--line);background:#0c141f}.hgc-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--pink);border-radius:6px;color:var(--pink);font-weight:900}.hgc-title{min-width:0;margin-right:auto}.hgc-title h2{margin:0;font-size:17px;letter-spacing:0}.hgc-title p{margin:2px 0 0;color:var(--muted);font-size:11px}.hgc-actions{display:flex;gap:6px}.hgc-main{display:grid;grid-template-columns:224px minmax(0,1fr) 270px;min-height:680px}.hgc-library,.hgc-inspector{min-width:0;background:#0c131d;overflow:auto}.hgc-library{border-right:1px solid var(--line)}.hgc-inspector{border-left:1px solid var(--line)}.hgc-section{padding:12px;border-bottom:1px solid var(--line)}.hgc-section-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}.hgc-section h3{margin:0;color:var(--cyan);font-size:10px;text-transform:uppercase}.hgc-section-head span{margin-left:auto;color:var(--muted);font-size:10px}.hgc-component-list{display:grid;gap:5px}.hgc-component{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:center;gap:8px;width:100%;text-align:left}.hgc-component.is-active{border-color:var(--pink);background:#2b182c}.hgc-component-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:5px;background:#203247;color:var(--cyan);font-size:10px;font-weight:900}.hgc-component small,.hgc-meta{display:block;color:var(--muted);overflow-wrap:anywhere}.hgc-graph{display:grid;gap:5px;color:var(--muted);font-size:11px}.hgc-graph strong{color:var(--lime)}.hgc-stack{display:grid;gap:8px}.hgc-row{display:flex;align-items:center;gap:6px}.hgc-row>*{min-width:0;flex:1}.hgc label{display:grid;gap:4px;color:#becbd8;font-size:11px}.hgc input,.hgc select{width:100%;min-height:35px;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:#080e16;color:#eef7ff}.hgc input[type=color]{height:38px;padding:3px}.hgc-workspace{display:grid;grid-template-rows:auto 1fr auto;min-width:0;background:#080d14}.hgc-toolbar{display:flex;align-items:end;gap:7px;padding:9px 11px;border-bottom:1px solid var(--line);overflow:auto}.hgc-toolbar label{min-width:92px}.hgc-stage{min-width:0;padding:14px;overflow:auto;background-color:#0a111b;background-image:linear-gradient(#182535 1px,transparent 1px),linear-gradient(90deg,#182535 1px,transparent 1px);background-size:22px 22px}.hgc-preview-band{margin-bottom:14px}.hgc-preview-band>header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.hgc-preview-band h3{margin:0;font-size:12px}.hgc-badge{display:inline-flex;padding:2px 6px;border:1px solid #3b5268;border-radius:999px;color:var(--cyan);font-size:10px}.hgc-preview-surface{display:grid;place-items:center;min-height:190px;padding:18px;border:1px solid #34475b;border-radius:6px;background:#0f1722}.hgc-instance-grid{display:grid;grid-template-columns:repeat(2,minmax(190px,1fr));gap:10px}.hgc-instance{min-width:0;border:1px solid var(--line);border-radius:6px;background:var(--panel)}.hgc-instance.is-active{border-color:var(--pink);box-shadow:0 0 0 2px rgba(242,92,180,.14)}.hgc-instance-head{display:flex;align-items:center;gap:7px;padding:7px 8px;border-bottom:1px solid var(--line)}.hgc-instance-head button{min-height:28px;padding:4px 7px;text-align:left;overflow-wrap:anywhere}.hgc-instance-head span{margin-left:auto;color:var(--muted);font-size:9px}.hgc-instance-body{display:grid;place-items:center;min-height:180px;padding:14px;overflow:hidden}.hgc-node{display:flex;box-sizing:border-box;overflow-wrap:anywhere}.hgc-node-button{width:max-content!important;min-width:84px}.hgc-node-button.is-disabled{filter:grayscale(.35)}.hgc-node-text{display:block;max-width:100%;overflow-wrap:anywhere;letter-spacing:0}.hgc-nested{display:grid;gap:4px;max-width:100%}.hgc-nested-label{color:var(--muted);font-size:9px;text-transform:uppercase}.hgc-unsupported{max-width:300px;padding:10px;border:1px solid #b84d72;border-radius:5px;background:#351726;color:#ffd4e2;overflow-wrap:anywhere}.hgc-propagation{display:flex;align-items:center;gap:8px;padding:9px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.hgc-propagation strong{color:var(--lime)}.hgc-status{margin-left:auto;min-width:0;text-align:right;overflow-wrap:anywhere}.hgc-empty{padding:12px;color:var(--muted);text-align:center}.hgc-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:980px){.hgc-main{grid-template-columns:190px minmax(0,1fr)}.hgc-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(3,1fr)}.hgc-inspector .hgc-section{border-right:1px solid var(--line)}}
      @media(max-width:640px){.hgc{width:100%;max-width:100%;border-radius:6px}.hgc-header{align-items:flex-start;flex-wrap:wrap;padding:11px}.hgc-title{width:calc(100% - 52px)}.hgc-actions{width:100%;overflow:auto}.hgc-actions button{flex:0 0 auto}.hgc-main{display:block;min-height:0}.hgc-library{border-right:0;border-bottom:1px solid var(--line)}.hgc-component-list{grid-template-columns:repeat(2,minmax(0,1fr))}.hgc-toolbar{align-items:stretch;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.hgc-toolbar label{min-width:0}.hgc-stage{padding:9px}.hgc-preview-surface{min-height:160px;padding:10px}.hgc-instance-grid{grid-template-columns:1fr}.hgc-instance-body{min-height:160px;padding:10px}.hgc-inspector{display:block;border-left:0}.hgc-inspector .hgc-section{border-right:0}.hgc-propagation{align-items:flex-start;flex-wrap:wrap}.hgc-status{width:100%;text-align:left;margin-left:0}.hgc-node-frame{max-width:100%!important}}
      @media(prefers-reduced-motion:reduce){.hgc *{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    doc.head.appendChild(style);
  }

  function resolveRoot(target) {
    if (typeof target === "string" && globalScope.document) return globalScope.document.querySelector(target);
    return target;
  }

  function firstTextNode(component) {
    let found = null;
    walkNodes(component?.root, (node) => { if (!found && node.type === "text") found = node; });
    return found;
  }

  function storageFromOptions(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, "storage")) return validStorage(options.storage) ? options.storage : null;
    try { return validStorage(globalScope.localStorage) ? globalScope.localStorage : null; } catch (_) { return null; }
  }

  function downloadText(doc, text, filename) {
    if (typeof globalScope.Blob !== "function" || !globalScope.URL?.createObjectURL) return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([text], { type: "application/json" }));
    const anchor = doc.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function mount(target, options) {
    const root = resolveRoot(target);
    if (!root || typeof root.querySelector !== "function" || !root.ownerDocument) throw new TypeError("HHGraphicComponents.mount can mot root element hop le.");
    if (instances.has(root)) return instances.get(root);
    const doc = root.ownerDocument;
    addStyles(doc);
    const storage = storageFromOptions(options);
    const loaded = options?.project ? { ok: true, reason: null, project: normalizeProject(options.project) } : loadProject(storage);
    let project = loaded.project;
    let selectedComponentId = project.library.components[0]?.id || null;
    let selectedInstanceId = project.instances.find((item) => item.sourceComponentId === selectedComponentId)?.id || null;
    let activeSelection = clone(DEFAULT_SELECTION);
    let revision = 0;

    root.classList.add("hgc");
    root.setAttribute("data-graphic-components", "");
    root.setAttribute("aria-label", "Component and Variant System");
    root.innerHTML = `<header class="hgc-header"><div class="hgc-mark" aria-hidden="true">CV</div><div class="hgc-title"><h2>Component &amp; Variant System</h2><p>Master, instance, override, nested graph and reusable local library</p></div><div class="hgc-actions"><button type="button" data-hgc-action="new-component">New master</button><button type="button" data-hgc-action="import">Import</button><button type="button" data-hgc-action="export-library">Library</button><button type="button" class="hgc-primary" data-hgc-action="save" title="Ctrl+S" aria-keyshortcuts="Control+S Meta+S">Save</button></div></header><div class="hgc-main"><aside class="hgc-library" aria-label="Component library"><section class="hgc-section"><div class="hgc-section-head"><h3>Local library</h3><span data-hgc-library-count></span></div><div class="hgc-component-list" data-hgc-components></div></section><section class="hgc-section"><div class="hgc-section-head"><h3>Nested graph</h3><span>Cycle safe</span></div><div class="hgc-graph" data-hgc-graph></div></section><section class="hgc-section"><div class="hgc-stack"><label>Nested component<select data-hgc-nested-select></select></label><button type="button" data-hgc-action="nest">Add to selected master</button></div></section></aside><section class="hgc-workspace"><div class="hgc-toolbar" aria-label="Variant controls">${AXIS_ORDER.map((axis) => `<label>${AXIS_LABELS[axis]}<select data-hgc-axis="${axis}">${VARIANT_AXES[axis].map((value) => `<option value="${value}">${value}</option>`).join("")}</select></label>`).join("")}</div><div class="hgc-stage"><section class="hgc-preview-band" aria-labelledby="hgc-master-heading"><header><h3 id="hgc-master-heading">Component master</h3><span class="hgc-badge">Source</span></header><div class="hgc-preview-surface" data-hgc-master-preview></div></section><section class="hgc-preview-band" aria-labelledby="hgc-instance-heading"><header><h3 id="hgc-instance-heading">Instances</h3><span class="hgc-badge" data-hgc-propagated-count></span></header><div class="hgc-instance-grid" data-hgc-instances></div></section></div><footer class="hgc-propagation"><strong>Live propagation</strong><span data-hgc-revision>Revision 0</span><span class="hgc-status" role="status" aria-live="polite" data-hgc-status></span></footer></section><aside class="hgc-inspector" aria-label="Component inspector"><section class="hgc-section"><div class="hgc-section-head"><h3>Master</h3><span>Shared source</span></div><div class="hgc-stack" data-hgc-master-editor></div></section><section class="hgc-section"><div class="hgc-section-head"><h3>Instance</h3><span data-hgc-instance-state></span></div><div class="hgc-stack" data-hgc-instance-editor></div></section><section class="hgc-section"><div class="hgc-section-head"><h3>Persistence</h3><span>v1</span></div><p class="hgc-meta">Project and library stay local. JSON export remains available when browser download APIs are supported.</p><button type="button" data-hgc-action="export-project">Export project</button></section></aside></div><input class="hgc-sr" type="file" accept="application/json,.json" data-hgc-file>`;

    const qs = (selector) => root.querySelector(selector);
    const announce = (message) => { const node = qs("[data-hgc-status]"); if (node) node.textContent = message; };

    function selectedComponent() { return project.library.components.find((item) => item.id === selectedComponentId) || null; }
    function selectedInstance() { return project.instances.find((item) => item.id === selectedInstanceId) || null; }
    function componentInstances() { return project.instances.filter((item) => item.sourceComponentId === selectedComponentId); }
    function persist(silent) {
      const result = saveProject(storage, project);
      if (!silent) announce(result.ok ? "Da luu project tren thiet bi." : result.reason === "unsupported" ? "Local persistence khong duoc ho tro; project dang chay trong bo nho." : "Khong the luu local project. Hay export JSON de giu ban sao.");
      return result;
    }

    function renderLibrary() {
      qs("[data-hgc-library-count]").textContent = `${project.library.components.length} masters`;
      qs("[data-hgc-components]").innerHTML = project.library.components.map((component) => `<button type="button" class="hgc-component${component.id === selectedComponentId ? " is-active" : ""}" data-hgc-component="${escapeHtml(component.id)}" aria-pressed="${component.id === selectedComponentId}"><span class="hgc-component-mark" aria-hidden="true">${escapeHtml(component.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(component.name)}</strong><small>${escapeHtml(component.description)}</small></span></button>`).join("");
      qs("[data-hgc-nested-select]").innerHTML = project.library.components.map((component) => `<option value="${escapeHtml(component.id)}"${component.id === selectedComponentId ? " disabled" : ""}>${escapeHtml(component.name)}</option>`).join("");
      const validation = validateGraph(project);
      qs("[data-hgc-graph]").innerHTML = validation.valid ? `<strong>Graph hop le</strong>${project.library.components.map((component) => `<span>${escapeHtml(component.name)} -> ${escapeHtml((validation.graph[component.id] || []).join(", ") || "none")}</span>`).join("")}` : `<span class="hgc-unsupported">${validation.cycles.length ? "Cycle da duoc phat hien va se bi chan khi resolve." : "Co nested component bi thieu trong library."}</span>`;
    }

    function renderMaster() {
      const component = selectedComponent();
      qs("[data-hgc-master-preview]").innerHTML = component ? renderResolvedHtml(resolveComponent(project, component.id, activeSelection)) : `<div class="hgc-empty">Library chua co component master.</div>`;
    }

    function renderInstances() {
      const list = componentInstances();
      qs("[data-hgc-propagated-count]").textContent = `${list.filter((item) => !item.detached).length} linked`;
      qs("[data-hgc-instances]").innerHTML = list.map((instance) => {
        const resolved = resolveInstance(project, instance.id);
        const overrideCount = Object.keys(instance.overrides).length;
        return `<article class="hgc-instance${instance.id === selectedInstanceId ? " is-active" : ""}" data-hgc-instance-card="${escapeHtml(instance.id)}"><header class="hgc-instance-head"><button type="button" data-hgc-instance="${escapeHtml(instance.id)}" aria-pressed="${instance.id === selectedInstanceId}">${escapeHtml(instance.name)}</button><span>${instance.detached ? "DETACHED" : overrideCount ? `${overrideCount} OVERRIDE` : "LINKED"}</span></header><div class="hgc-instance-body">${renderResolvedHtml(resolved)}</div></article>`;
      }).join("") || `<div class="hgc-empty">Chua co instance. Tao mot instance de xem propagation.</div>`;
    }

  function renderMasterEditor() {
      const component = selectedComponent();
      if (!component) return qs("[data-hgc-master-editor]").innerHTML = `<div class="hgc-empty">No master selected.</div>`;
      const textNode = firstTextNode(component);
      const resolved = resolveComponent(project, component.id, activeSelection);
      const resolvedText = textNode ? findNode(resolved.root, textNode.id) : null;
      qs("[data-hgc-master-editor]").innerHTML = `<label>Master name<input data-hgc-master-name maxlength="100" value="${escapeHtml(component.name)}"></label>${textNode ? `<label>${escapeHtml(textNode.name)} (${escapeHtml(activeSelection.language)})<input data-hgc-variant-axis="language" data-hgc-variant-path="${escapeHtml(`${textNode.id}.text`)}" maxlength="500" value="${escapeHtml(resolvedText?.props.text || "")}"></label>` : ""}<label>Background (${escapeHtml(activeSelection.theme)})<input type="color" data-hgc-variant-axis="theme" data-hgc-variant-path="${escapeHtml(`${component.root.id}.background`)}" value="${safeColor(resolved.root.props.background, "#151D2B")}"></label><button type="button" data-hgc-action="add-instance">Create linked instance</button>`;
    }

    function renderInstanceEditor() {
      const instance = selectedInstance();
      const host = qs("[data-hgc-instance-editor]");
      const state = qs("[data-hgc-instance-state]");
      if (!instance || instance.sourceComponentId !== selectedComponentId) { state.textContent = "None"; host.innerHTML = `<div class="hgc-empty">Select an instance.</div>`; return; }
      state.textContent = instance.detached ? "Detached" : "Linked";
      const component = selectedComponent();
      const textNode = firstTextNode(component);
      if (instance.detached) {
        host.innerHTML = `<p class="hgc-meta">Snapshot doc lap. Master edits se khong propagate vao instance nay.</p>`;
        return;
      }
      const path = textNode ? `${textNode.id}.text` : "";
      const current = path ? (instance.overrides[path] ?? "") : "";
      host.innerHTML = `${textNode ? `<label>Text override<input data-hgc-override-path="${escapeHtml(path)}" maxlength="500" value="${escapeHtml(current)}" placeholder="De trong de theo master"></label>` : ""}<div class="hgc-row"><button type="button" data-hgc-action="reset-overrides">Reset override</button><button type="button" class="hgc-danger" data-hgc-action="detach">Detach</button></div>`;
    }

    function renderDesignSystemEditor() {
      const host = qs("[data-hgc-master-editor]");
      const component = selectedComponent();
      if (!host || !component) return;
      const accent = resolveToken(project, "color.accent", activeSelection.theme);
      const artboard = selectResponsiveArtboard(project, activeSelection.size === "sm" ? 390 : activeSelection.size === "lg" ? 1440 : 768);
      host.insertAdjacentHTML("beforeend", `<hr><strong>Design tokens &amp; Dev Mode</strong><label>Accent token (${escapeHtml(activeSelection.theme)})<input type="color" data-hgc-token="color.accent" value="${safeColor(accent, "#62D9E6")}"></label><label>Responsive artboard<input value="${escapeHtml(`${artboard?.name || "None"} · ${artboard?.width || 0}x${artboard?.height || 0}`)}" readonly></label><div class="hgc-row"><button type="button" data-hgc-action="bind-accent">Bind master to accent</button><button type="button" data-hgc-action="export-dev">Export Dev Mode</button></div>`);
    }

    function renderAxisControls() {
      AXIS_ORDER.forEach((axis) => { const select = qs(`[data-hgc-axis="${axis}"]`); if (select) select.value = activeSelection[axis]; });
    }

    function render() {
      renderLibrary(); renderMaster(); renderInstances(); renderMasterEditor(); renderDesignSystemEditor(); renderInstanceEditor(); renderAxisControls();
      qs("[data-hgc-revision]").textContent = `Revision ${revision}`;
    }

    function adopt(nextProject, message) {
      project = normalizeProject(nextProject);
      revision += 1;
      persist(true);
      render();
      if (message) announce(message);
    }

    function adoptLive(nextProject, message, refreshLibrary) {
      project = normalizeProject(nextProject);
      revision += 1;
      persist(true);
      if (refreshLibrary) renderLibrary();
      renderMaster(); renderInstances();
      qs("[data-hgc-revision]").textContent = `Revision ${revision}`;
      if (message) announce(message);
    }

    function chooseComponent(componentId) {
      if (!project.library.components.some((item) => item.id === componentId)) return;
      selectedComponentId = componentId;
      selectedInstanceId = project.instances.find((item) => item.sourceComponentId === componentId)?.id || null;
      const instance = selectedInstance(); activeSelection = clone(instance?.selection || DEFAULT_SELECTION);
      render();
    }

    function chooseInstance(instanceId) {
      const instance = project.instances.find((item) => item.id === instanceId);
      if (!instance) return;
      selectedInstanceId = instance.id;
      activeSelection = clone(instance.selection);
      renderInstances(); renderInstanceEditor(); renderAxisControls();
    }

    function exportPayload(payload, filename, unsupportedMessage) {
      if (downloadText(doc, payload, filename)) announce(`Da export ${filename}.`);
      else announce(unsupportedMessage || "Trinh duyet khong ho tro download Blob; du lieu van an toan trong project hien tai.");
    }

    const onClick = (event) => {
      const targetNode = event.target.closest("button");
      if (!targetNode || !root.contains(targetNode)) return;
      if (targetNode.dataset.hgcComponent) return chooseComponent(targetNode.dataset.hgcComponent);
      if (targetNode.dataset.hgcInstance) return chooseInstance(targetNode.dataset.hgcInstance);
      const action = targetNode.dataset.hgcAction;
      if (!action) return;
      if (action === "save") return persist(false);
      if (action === "import") return qs("[data-hgc-file]").click();
      if (action === "export-project") return exportPayload(serializeProject(project), `${safeId(project.name, "hh-components")}.json`);
      if (action === "export-library") return exportPayload(serializeLibrary(project), `${safeId(project.library.name, "hh-library")}.hhcomponents.json`);
      if (action === "export-dev") return exportPayload(safeJson(exportDevMode(project, selectedComponentId, activeSelection), 2), `${safeId(project.name, "hh-components")}.handoff.json`);
      if (action === "bind-accent") {
        const component = selectedComponent();
        if (!component) return;
        return adopt(setNodeTokenBinding(project, component.id, component.root.id, "background", "color.accent"), "Master background is now linked to the theme accent token.");
      }
      if (action === "new-component") {
        const added = addComponent(project, createComponent({ name: `Component ${project.library.components.length + 1}` }));
        selectedComponentId = added.component.id; selectedInstanceId = null;
        return adopt(added.project, "Da tao component master moi trong local library.");
      }
      if (action === "add-instance") {
        if (!selectedComponentId) return;
        const added = addInstance(project, selectedComponentId);
        selectedInstanceId = added.instance.id; activeSelection = clone(added.instance.selection);
        return adopt(added.project, "Da tao linked instance. Master edits se propagate tu dong.");
      }
      if (action === "reset-overrides") {
        if (!selectedInstanceId) return;
        return adopt(resetOverride(project, selectedInstanceId), "Da reset override; instance dang theo master.");
      }
      if (action === "detach") {
        if (!selectedInstanceId) return;
        return adopt(detachInstance(project, selectedInstanceId), "Da detach thanh snapshot doc lap. Master se khong con propagate vao instance nay.");
      }
      if (action === "nest") {
        const childId = qs("[data-hgc-nested-select]").value;
        const result = addNestedComponent(project, selectedComponentId, childId);
        return result.ok ? adopt(result.project, "Da them nested component va giu graph khong cycle.") : announce(result.error);
      }
    };

    const onInput = (event) => {
      const targetNode = event.target;
      if (targetNode.matches("[data-hgc-master-name]")) {
        const next = normalizeProject(project); const component = next.library.components.find((item) => item.id === selectedComponentId);
        if (component) component.name = cleanText(targetNode.value, 100);
        return adoptLive(next, "Master name da cap nhat trong library.", true);
      }
      if (targetNode.dataset.hgcMasterPath) return adoptLive(setMasterProperty(project, selectedComponentId, targetNode.dataset.hgcMasterPath, targetNode.value), "Master edit da propagate toi moi linked instance.");
      if (targetNode.dataset.hgcToken) return adoptLive(setToken(project, targetNode.dataset.hgcToken, targetNode.value, activeSelection.theme), "Theme token da cap nhat va propagate toi component dang lien ket.");
      if (targetNode.dataset.hgcVariantPath) return adoptLive(setVariantProperty(project, selectedComponentId, targetNode.dataset.hgcVariantAxis, activeSelection[targetNode.dataset.hgcVariantAxis], targetNode.dataset.hgcVariantPath, targetNode.value), "Variant master edit da propagate toi cac linked instance cung variant.");
      if (targetNode.dataset.hgcOverridePath) {
        if (!selectedInstanceId) return;
        const value = targetNode.value;
        const next = value === "" ? resetOverride(project, selectedInstanceId, targetNode.dataset.hgcOverridePath) : setInstanceOverride(project, selectedInstanceId, targetNode.dataset.hgcOverridePath, value);
        return adoptLive(next, value === "" ? "Override da reset; instance dang theo master." : "Override chi ap dung cho instance da chon.");
      }
    };

    const onChange = (event) => {
      const targetNode = event.target;
      if (targetNode.dataset.hgcAxis) {
        const axis = targetNode.dataset.hgcAxis;
        activeSelection[axis] = targetNode.value;
        const instance = selectedInstance();
        if (instance && !instance.detached && instance.sourceComponentId === selectedComponentId) return adopt(setInstanceVariant(project, instance.id, axis, targetNode.value), `${AXIS_LABELS[axis]} variant da ap dung cho instance.`);
        renderMaster(); renderAxisControls(); announce(`${AXIS_LABELS[axis]} variant dang duoc preview tren master.`); return;
      }
      if (targetNode.matches("[data-hgc-file]") && targetNode.files?.[0]) {
        if (typeof globalScope.FileReader !== "function") return announce("Trinh duyet khong ho tro FileReader; khong the import JSON tu file.");
        const reader = new globalScope.FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result || "{}"));
            if (parsed.format === LIBRARY_FORMAT) {
              const imported = importLibrary(project, parsed);
              if (!imported.ok) return announce(imported.error);
              adopt(imported.project, `Da import ${imported.added.length} component vao local library.`);
            } else {
              const next = deserializeProject(parsed);
              selectedComponentId = next.library.components[0]?.id || null;
              selectedInstanceId = next.instances.find((item) => item.sourceComponentId === selectedComponentId)?.id || null;
              activeSelection = clone(selectedInstance()?.selection || DEFAULT_SELECTION);
              adopt(next, "Da import Component project.");
            }
          } catch (error) { announce(cleanText(error?.message || "Project JSON khong hop le.", 180)); }
        };
        reader.onerror = () => announce("Khong the doc file JSON tren thiet bi nay.");
        reader.readAsText(targetNode.files[0]); targetNode.value = "";
      }
    };

    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist(false); return; }
      const componentButton = event.target.closest?.("[data-hgc-component]");
      if (componentButton && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        const buttons = [...root.querySelectorAll("[data-hgc-component]")];
        const index = buttons.indexOf(componentButton);
        const next = buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length];
        next?.focus();
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeydown);
    render();
    if (!storage) announce("Local persistence khong duoc ho tro; workspace dang chay trong bo nho va van co the export JSON.");
    else if (!loaded.ok) announce("Khong doc duoc local project; da mo library mac dinh. Export JSON neu can giu ban sao.");
    else announce("Linked instances dang nhan edit truc tiep tu component master.");

    const controller = {
      supported: true,
      capabilities: getCapabilities(storage),
      getProject: () => clone(project),
      setProject(next) { selectedComponentId = normalizeProject(next).library.components[0]?.id || null; selectedInstanceId = null; adopt(next, "Da nap project vao workspace."); },
      selectComponent: chooseComponent,
      selectInstance: chooseInstance,
      updateMaster(componentId, path, value) { selectedComponentId = componentId; adopt(setMasterProperty(project, componentId, path, value), "Master edit da propagate toi linked instances."); },
      setOverride(instanceId, path, value) { selectedInstanceId = instanceId; adopt(setInstanceOverride(project, instanceId, path, value), "Instance override da cap nhat."); },
      resetOverride(instanceId, path) { selectedInstanceId = instanceId; adopt(resetOverride(project, instanceId, path), "Instance override da reset."); },
      detach(instanceId) { selectedInstanceId = instanceId; adopt(detachInstance(project, instanceId), "Instance da detach thanh snapshot."); },
      save: () => persist(false),
      render,
      unmount: () => unmount(root)
    };
    instances.set(root, { controller, cleanup() { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKeydown); } });
    return controller;
  }

  function unmount(target) {
    const root = resolveRoot(target);
    const mounted = root && instances.get(root);
    if (!mounted) return false;
    mounted.cleanup(); instances.delete(root);
    root.classList.remove("hgc"); root.removeAttribute("data-graphic-components"); root.removeAttribute("aria-label"); root.replaceChildren();
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, LIBRARY_FORMAT, STORAGE_KEY, VARIANT_AXES, DEFAULT_SELECTION, NODE_TYPES, TOKEN_CATEGORIES, CONSTRAINT_AXES, ARTBOARD_PRESETS,
    escapeHtml, createDefaultProject, normalizeProject, createComponent, addComponent, createInstance, addInstance,
    validateGraph, wouldCreateCycle, addNestedComponent, resolveComponent, resolveInstance, renderResolvedHtml,
    setMasterProperty, updateMaster, setVariantProperty, setInstanceOverride, resetOverride, setInstanceVariant, detachInstance,
    createDefaultTokens, normalizeTokens, resolveToken, setToken, setNodeTokenBinding, setNodeConstraints,
    addArtboard, selectResponsiveArtboard, computeAutoLayout, inspectComponent,
    exportCssVariables, exportTailwindConfig, exportComponentSvg, exportDevMode,
    serializeProject, deserializeProject, serializeLibrary, importLibrary, saveProject, loadProject, getCapabilities,
    mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicComponents = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
