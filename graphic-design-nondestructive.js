(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-nondestructive";
  const STORAGE_KEY = "hh.graphic-nondestructive.project.v1";
  const STYLE_ID = "hh-graphic-nondestructive-style-v1";
  const MAX_HISTORY = 60;
  const MAX_ASSET_BYTES = 12 * 1024 * 1024;
  const MAX_DATA_URL_LENGTH = 18 * 1024 * 1024;
  const instances = new WeakMap();

  const FILTER_DEFINITIONS = Object.freeze({
    brightness: Object.freeze({ label: "Brightness", min: 25, max: 200, step: 1, initial: 110, unit: "%" }),
    contrast: Object.freeze({ label: "Contrast", min: 25, max: 200, step: 1, initial: 110, unit: "%" }),
    saturate: Object.freeze({ label: "Saturation", min: 0, max: 300, step: 1, initial: 120, unit: "%" }),
    grayscale: Object.freeze({ label: "Grayscale", min: 0, max: 100, step: 1, initial: 100, unit: "%" }),
    sepia: Object.freeze({ label: "Sepia", min: 0, max: 100, step: 1, initial: 65, unit: "%" }),
    blur: Object.freeze({ label: "Blur", min: 0, max: 32, step: 0.5, initial: 4, unit: "px" }),
    "hue-rotate": Object.freeze({ label: "Hue", min: -180, max: 180, step: 1, initial: 24, unit: "deg" })
  });

  const ADJUSTMENT_DEFINITIONS = Object.freeze({
    brightness: Object.freeze({ label: "Brightness", min: 25, max: 200, step: 1, initial: 100, unit: "%" }),
    contrast: Object.freeze({ label: "Contrast", min: 25, max: 200, step: 1, initial: 100, unit: "%" }),
    saturate: Object.freeze({ label: "Saturation", min: 0, max: 300, step: 1, initial: 100, unit: "%" }),
    grayscale: Object.freeze({ label: "Grayscale", min: 0, max: 100, step: 1, initial: 0, unit: "%" }),
    sepia: Object.freeze({ label: "Sepia", min: 0, max: 100, step: 1, initial: 0, unit: "%" }),
    hue: Object.freeze({ label: "Hue", min: -180, max: 180, step: 1, initial: 0, unit: "deg" })
  });

  const BLEND_MODES = Object.freeze(["source-over", "multiply", "screen", "overlay", "darken", "lighten"]);
  const MASK_SHAPES = Object.freeze(["full", "rectangle", "ellipse", "linear"]);

  class ProjectFormatError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "ProjectFormatError";
      this.code = code;
    }
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function cleanText(value, fallback, maxLength) {
    const text = String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return (text || fallback).slice(0, maxLength);
  }

  function safeId(value, prefix) {
    const cleaned = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 96);
    return cleaned || uid(prefix);
  }

  function uniqueId(value, prefix, used) {
    let id = safeId(value, prefix);
    while (used.has(id)) id = uid(prefix);
    used.add(id);
    return id;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSafeImageDataUrl(value) {
    return typeof value === "string"
      && value.length <= MAX_DATA_URL_LENGTH
      && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value);
  }

  function normalizeMask(input) {
    const source = isRecord(input) ? input : {};
    return {
      enabled: source.enabled === true,
      inverted: source.inverted === true,
      shape: MASK_SHAPES.includes(source.shape) ? source.shape : "full",
      x: clamp(source.x, 0, 1, 0.5),
      y: clamp(source.y, 0, 1, 0.5),
      width: clamp(source.width, 0.02, 1, 0.7),
      height: clamp(source.height, 0.02, 1, 0.7),
      opacity: clamp(source.opacity, 0, 1, 1),
      feather: clamp(source.feather, 0, 100, 0)
    };
  }

  function normalizeSmartFilter(input, usedIds) {
    const source = isRecord(input) ? input : {};
    const kind = Object.prototype.hasOwnProperty.call(FILTER_DEFINITIONS, source.kind) ? source.kind : "brightness";
    const definition = FILTER_DEFINITIONS[kind];
    return {
      id: uniqueId(source.id, "filter", usedIds),
      type: "smart-filter",
      name: cleanText(source.name, definition.label, 100),
      kind,
      value: clamp(source.value, definition.min, definition.max, definition.initial),
      enabled: source.enabled !== false,
      mask: normalizeMask(source.mask)
    };
  }

  function normalizeAdjustment(input, usedIds) {
    const source = isRecord(input) ? input : {};
    const settingsSource = isRecord(source.settings) ? source.settings : {};
    const settings = {};
    Object.keys(ADJUSTMENT_DEFINITIONS).forEach((key) => {
      const definition = ADJUSTMENT_DEFINITIONS[key];
      settings[key] = clamp(settingsSource[key], definition.min, definition.max, definition.initial);
    });
    return {
      id: uniqueId(source.id, "adjustment", usedIds),
      type: "adjustment",
      name: cleanText(source.name, "Color adjustment", 100),
      settings,
      enabled: source.enabled !== false,
      mask: normalizeMask(source.mask)
    };
  }

  function normalizeModifier(input, layerType, usedIds) {
    if (!isRecord(input)) return null;
    if (layerType === "smart-object" && input.type === "smart-filter") return normalizeSmartFilter(input, usedIds);
    if (layerType === "adjustment" && input.type === "adjustment") return normalizeAdjustment(input, usedIds);
    return null;
  }

  function normalizeAsset(input, usedIds) {
    const source = isRecord(input) ? input : {};
    if (!isSafeImageDataUrl(source.dataUrl)) return null;
    const type = ["image/png", "image/jpeg", "image/webp"].includes(source.type) ? source.type : "image/png";
    return {
      id: uniqueId(source.id, "asset", usedIds),
      name: cleanText(source.name, "Local image", 160),
      type,
      width: Math.round(clamp(source.width, 1, 16384, 1)),
      height: Math.round(clamp(source.height, 1, 16384, 1)),
      dataUrl: source.dataUrl,
      sourceVersion: Math.round(clamp(source.sourceVersion, 1, 1000000, 1)),
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.slice(0, 40) : new Date().toISOString()
    };
  }

  function normalizeLayer(input, usedIds) {
    const source = isRecord(input) ? input : {};
    const type = source.type === "adjustment" ? "adjustment" : "smart-object";
    const modifierIds = new Set();
    const modifiers = (Array.isArray(source.modifiers) ? source.modifiers : [])
      .slice(0, 24)
      .map((modifier) => normalizeModifier(modifier, type, modifierIds))
      .filter(Boolean);
    return {
      id: uniqueId(source.id, type === "adjustment" ? "adjustment-layer" : "smart-object", usedIds),
      type,
      name: cleanText(source.name, type === "adjustment" ? "Adjustment layer" : "Smart object", 120),
      visible: source.visible !== false,
      opacity: clamp(source.opacity, 0, 1, 1),
      blendMode: BLEND_MODES.includes(source.blendMode) ? source.blendMode : "source-over",
      assetId: type === "smart-object" ? safeId(source.assetId, "missing-asset") : null,
      fit: ["contain", "cover", "stretch"].includes(source.fit) ? source.fit : "contain",
      transform: {
        x: clamp(source.transform?.x, -2, 2, 0),
        y: clamp(source.transform?.y, -2, 2, 0),
        width: clamp(source.transform?.width, 0.01, 4, 1),
        height: clamp(source.transform?.height, 0.01, 4, 1),
        rotation: clamp(source.transform?.rotation, -360, 360, 0)
      },
      modifiers
    };
  }

  function createDefaultProject() {
    const timestamp = new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("nondestructive"),
      name: "Untitled edit",
      width: 1200,
      height: 800,
      background: "transparent",
      createdAt: timestamp,
      updatedAt: timestamp,
      assets: [],
      layers: []
    };
  }

  function normalizeProject(input) {
    const fallback = createDefaultProject();
    const source = isRecord(input) ? input : {};
    const assetIds = new Set();
    const assets = (Array.isArray(source.assets) ? source.assets : [])
      .slice(0, 32)
      .map((asset) => normalizeAsset(asset, assetIds))
      .filter(Boolean);
    const layerIds = new Set();
    const layers = (Array.isArray(source.layers) ? source.layers : [])
      .slice(0, 64)
      .map((layer) => normalizeLayer(layer, layerIds));
    return {
      format: FORMAT,
      version: VERSION,
      id: safeId(source.id, "nondestructive"),
      name: cleanText(source.name, fallback.name, 160),
      width: Math.round(clamp(source.width, 64, 8192, fallback.width)),
      height: Math.round(clamp(source.height, 64, 8192, fallback.height)),
      background: source.background === "white" ? "white" : "transparent",
      createdAt: typeof source.createdAt === "string" ? source.createdAt.slice(0, 40) : fallback.createdAt,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.slice(0, 40) : fallback.updatedAt,
      assets,
      layers
    };
  }

  function touch(project) {
    project.updatedAt = new Date().toISOString();
    return normalizeProject(project);
  }

  function requireLayer(project, layerId) {
    const layer = project.layers.find((candidate) => candidate.id === layerId);
    if (!layer) throw new RangeError(`Unknown layer: ${String(layerId)}`);
    return layer;
  }

  function requireModifier(layer, modifierId) {
    const modifier = layer.modifiers.find((candidate) => candidate.id === modifierId);
    if (!modifier) throw new RangeError(`Unknown modifier: ${String(modifierId)}`);
    return modifier;
  }

  function addAsset(projectInput, assetInput) {
    const project = normalizeProject(projectInput);
    if (!isRecord(assetInput) || !isSafeImageDataUrl(assetInput.dataUrl)) {
      throw new ProjectFormatError("Only local PNG, JPEG, or WebP data URLs are supported.", "UNSUPPORTED_ASSET");
    }
    const usedIds = new Set(project.assets.map((asset) => asset.id));
    const asset = normalizeAsset({ ...assetInput, id: uniqueId(assetInput.id, "asset", usedIds) }, new Set());
    project.assets.push(asset);
    return { project: touch(project), assetId: asset.id };
  }

  function addSmartObject(projectInput, assetId, options) {
    const project = normalizeProject(projectInput);
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new RangeError(`Unknown linked asset: ${String(assetId)}`);
    const usedIds = new Set(project.layers.map((layer) => layer.id));
    const source = isRecord(options) ? options : {};
    const layer = normalizeLayer({
      ...source,
      id: uniqueId(source.id, "smart-object", usedIds),
      type: "smart-object",
      name: source.name || asset.name,
      assetId: asset.id,
      modifiers: []
    }, new Set());
    project.layers.unshift(layer);
    return { project: touch(project), layerId: layer.id };
  }

  function importAsset(projectInput, assetInput, layerOptions) {
    const before = normalizeProject(projectInput);
    const added = addAsset(before, assetInput);
    const linked = addSmartObject(added.project, added.assetId, layerOptions);
    if (before.layers.length === 0 && isRecord(assetInput)) {
      linked.project.width = Math.round(clamp(assetInput.width, 64, 8192, linked.project.width));
      linked.project.height = Math.round(clamp(assetInput.height, 64, 8192, linked.project.height));
      linked.project = touch(linked.project);
    }
    return { project: linked.project, assetId: added.assetId, layerId: linked.layerId };
  }

  function updateLinkedSmartObject(projectInput, assetId, patch) {
    const project = normalizeProject(projectInput);
    const index = project.assets.findIndex((asset) => asset.id === assetId);
    if (index < 0) throw new RangeError(`Unknown linked asset: ${String(assetId)}`);
    const source = isRecord(patch) ? patch : {};
    if (Object.prototype.hasOwnProperty.call(source, "dataUrl") && !isSafeImageDataUrl(source.dataUrl)) {
      throw new ProjectFormatError("Replacement must be a local PNG, JPEG, or WebP data URL.", "UNSUPPORTED_ASSET");
    }
    const current = project.assets[index];
    const usedIds = new Set(project.assets.filter((_, assetIndex) => assetIndex !== index).map((asset) => asset.id));
    const next = normalizeAsset({
      ...current,
      ...source,
      id: current.id,
      sourceVersion: current.sourceVersion + 1,
      updatedAt: new Date().toISOString()
    }, usedIds);
    if (!next) throw new ProjectFormatError("Linked asset data is not supported.", "UNSUPPORTED_ASSET");
    project.assets[index] = next;
    const affectedLayerIds = project.layers.filter((layer) => layer.assetId === assetId).map((layer) => layer.id);
    return { project: touch(project), affectedLayerIds };
  }

  function addAdjustmentLayer(projectInput, options) {
    const project = normalizeProject(projectInput);
    const source = isRecord(options) ? options : {};
    const layerIds = new Set(project.layers.map((layer) => layer.id));
    const layerId = uniqueId(source.id, "adjustment-layer", layerIds);
    const modifierIds = new Set();
    const modifier = normalizeAdjustment({
      id: source.modifierId,
      name: source.modifierName || "Color adjustment",
      settings: source.settings,
      mask: source.mask
    }, modifierIds);
    const layer = normalizeLayer({
      id: layerId,
      type: "adjustment",
      name: source.name || "Adjustment layer",
      visible: source.visible,
      opacity: source.opacity,
      blendMode: source.blendMode,
      modifiers: [modifier]
    }, new Set());
    project.layers.unshift(layer);
    return { project: touch(project), layerId: layer.id, modifierId: layer.modifiers[0].id };
  }

  function addAdjustmentModifier(projectInput, layerId, options) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    if (layer.type !== "adjustment") throw new TypeError("Adjustment modifiers require an adjustment layer.");
    const usedIds = new Set(layer.modifiers.map((modifier) => modifier.id));
    const modifier = normalizeAdjustment(options, usedIds);
    layer.modifiers.push(modifier);
    return { project: touch(project), modifierId: modifier.id };
  }

  function addSmartFilter(projectInput, layerId, options) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    if (layer.type !== "smart-object") throw new TypeError("Smart filters require a smart object layer.");
    const usedIds = new Set(layer.modifiers.map((modifier) => modifier.id));
    const modifier = normalizeSmartFilter({ type: "smart-filter", ...(isRecord(options) ? options : {}) }, usedIds);
    layer.modifiers.push(modifier);
    return { project: touch(project), modifierId: modifier.id };
  }

  function updateLayer(projectInput, layerId, patch) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    const source = isRecord(patch) ? patch : {};
    if (Object.prototype.hasOwnProperty.call(source, "name")) layer.name = cleanText(source.name, layer.name, 120);
    if (Object.prototype.hasOwnProperty.call(source, "visible")) layer.visible = source.visible !== false;
    if (Object.prototype.hasOwnProperty.call(source, "opacity")) layer.opacity = clamp(source.opacity, 0, 1, layer.opacity);
    if (Object.prototype.hasOwnProperty.call(source, "blendMode")) layer.blendMode = BLEND_MODES.includes(source.blendMode) ? source.blendMode : layer.blendMode;
    if (layer.type === "smart-object" && Object.prototype.hasOwnProperty.call(source, "fit")) layer.fit = ["contain", "cover", "stretch"].includes(source.fit) ? source.fit : layer.fit;
    if (isRecord(source.transform)) {
      layer.transform = normalizeLayer({ ...layer, transform: { ...layer.transform, ...source.transform } }, new Set()).transform;
    }
    return touch(project);
  }

  function updateModifier(projectInput, layerId, modifierId, patch) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    const modifier = requireModifier(layer, modifierId);
    const source = isRecord(patch) ? patch : {};
    if (Object.prototype.hasOwnProperty.call(source, "name")) modifier.name = cleanText(source.name, modifier.name, 100);
    if (Object.prototype.hasOwnProperty.call(source, "enabled")) modifier.enabled = source.enabled !== false;
    if (modifier.type === "smart-filter") {
      if (Object.prototype.hasOwnProperty.call(source, "kind") && FILTER_DEFINITIONS[source.kind]) {
        modifier.kind = source.kind;
        if (!Object.prototype.hasOwnProperty.call(source, "value")) modifier.value = FILTER_DEFINITIONS[source.kind].initial;
        modifier.name = FILTER_DEFINITIONS[source.kind].label;
      }
      const definition = FILTER_DEFINITIONS[modifier.kind];
      if (Object.prototype.hasOwnProperty.call(source, "value")) modifier.value = clamp(source.value, definition.min, definition.max, definition.initial);
    } else if (isRecord(source.settings)) {
      Object.keys(ADJUSTMENT_DEFINITIONS).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(source.settings, key)) return;
        const definition = ADJUSTMENT_DEFINITIONS[key];
        modifier.settings[key] = clamp(source.settings[key], definition.min, definition.max, definition.initial);
      });
    }
    return touch(project);
  }

  function updateFilterMask(projectInput, layerId, modifierId, patch) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    const modifier = requireModifier(layer, modifierId);
    modifier.mask = normalizeMask({ ...modifier.mask, ...(isRecord(patch) ? patch : {}) });
    return touch(project);
  }

  function setModifierEnabled(projectInput, layerId, modifierId, enabled) {
    return updateModifier(projectInput, layerId, modifierId, { enabled: Boolean(enabled) });
  }

  function reorderModifier(projectInput, layerId, modifierId, toIndex) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    const fromIndex = layer.modifiers.findIndex((modifier) => modifier.id === modifierId);
    if (fromIndex < 0) throw new RangeError(`Unknown modifier: ${String(modifierId)}`);
    const destination = Math.round(clamp(toIndex, 0, Math.max(0, layer.modifiers.length - 1), fromIndex));
    if (destination === fromIndex) return project;
    const [modifier] = layer.modifiers.splice(fromIndex, 1);
    layer.modifiers.splice(destination, 0, modifier);
    return touch(project);
  }

  function removeModifier(projectInput, layerId, modifierId) {
    const project = normalizeProject(projectInput);
    const layer = requireLayer(project, layerId);
    const index = layer.modifiers.findIndex((modifier) => modifier.id === modifierId);
    if (index < 0) throw new RangeError(`Unknown modifier: ${String(modifierId)}`);
    layer.modifiers.splice(index, 1);
    return touch(project);
  }

  function reorderLayer(projectInput, layerId, toIndex) {
    const project = normalizeProject(projectInput);
    const fromIndex = project.layers.findIndex((layer) => layer.id === layerId);
    if (fromIndex < 0) throw new RangeError(`Unknown layer: ${String(layerId)}`);
    const destination = Math.round(clamp(toIndex, 0, Math.max(0, project.layers.length - 1), fromIndex));
    if (destination === fromIndex) return project;
    const [layer] = project.layers.splice(fromIndex, 1);
    project.layers.splice(destination, 0, layer);
    return touch(project);
  }

  function removeLayer(projectInput, layerId) {
    const project = normalizeProject(projectInput);
    const index = project.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) throw new RangeError(`Unknown layer: ${String(layerId)}`);
    project.layers.splice(index, 1);
    const referenced = new Set(project.layers.filter((layer) => layer.type === "smart-object").map((layer) => layer.assetId));
    project.assets = project.assets.filter((asset) => referenced.has(asset.id));
    return touch(project);
  }

  function serializeProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function deserializeProject(serialized) {
    let parsed;
    try {
      parsed = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    } catch (_) {
      throw new ProjectFormatError("Project JSON is invalid.", "INVALID_JSON");
    }
    if (!isRecord(parsed) || parsed.format !== FORMAT) {
      throw new ProjectFormatError("Unsupported project format.", "UNSUPPORTED_FORMAT");
    }
    if (parsed.version !== VERSION) {
      throw new ProjectFormatError(`Unsupported project version: ${String(parsed.version)}`, "UNSUPPORTED_VERSION");
    }
    return normalizeProject(parsed);
  }

  function createEngine(initialProject, options) {
    const settings = isRecord(options) ? options : {};
    const historyLimit = Math.round(clamp(settings.historyLimit, 2, 200, MAX_HISTORY));
    let project = normalizeProject(initialProject || createDefaultProject());
    let history = [clone(project)];
    let historyIndex = 0;
    const listeners = new Set();

    function notify(label) {
      const state = { label, project: clone(project), history: getHistoryState() };
      listeners.forEach((listener) => listener(state));
    }

    function commit(nextProject, label) {
      const normalized = normalizeProject(nextProject);
      if (serializeProject(normalized) === serializeProject(project)) return false;
      project = normalized;
      history.splice(historyIndex + 1);
      history.push(clone(project));
      if (history.length > historyLimit) history.shift();
      historyIndex = history.length - 1;
      notify(label || "Edit");
      return true;
    }

    function run(operation, label) {
      const result = operation(project);
      const nextProject = isRecord(result) && result.project ? result.project : result;
      const changed = commit(nextProject, label);
      return isRecord(result) && result.project ? { ...result, project: clone(project), changed } : changed;
    }

    function getHistoryState() {
      return { canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1, index: historyIndex, length: history.length };
    }

    const engine = {
      getProject: () => clone(project),
      getHistoryState,
      subscribe(listener) { if (typeof listener !== "function") throw new TypeError("Listener must be a function."); listeners.add(listener); return () => listeners.delete(listener); },
      setProject(nextProject) { project = normalizeProject(nextProject); history = [clone(project)]; historyIndex = 0; notify("Load project"); return clone(project); },
      importAsset(asset, layerOptions) { return run((current) => importAsset(current, asset, layerOptions), "Import image"); },
      addAsset(asset) { return run((current) => addAsset(current, asset), "Add asset"); },
      addSmartObject(assetId, layerOptions) { return run((current) => addSmartObject(current, assetId, layerOptions), "Add linked instance"); },
      updateLinkedAsset(assetId, patch) { return run((current) => updateLinkedSmartObject(current, assetId, patch), "Update linked source"); },
      addAdjustmentLayer(layerOptions) { return run((current) => addAdjustmentLayer(current, layerOptions), "Add adjustment layer"); },
      addAdjustmentModifier(layerId, modifierOptions) { return run((current) => addAdjustmentModifier(current, layerId, modifierOptions), "Add adjustment"); },
      addSmartFilter(layerId, filterOptions) { return run((current) => addSmartFilter(current, layerId, filterOptions), "Add smart filter"); },
      updateLayer(layerId, patch) { return run((current) => updateLayer(current, layerId, patch), "Update layer"); },
      updateModifier(layerId, modifierId, patch) { return run((current) => updateModifier(current, layerId, modifierId, patch), "Update modifier"); },
      updateFilterMask(layerId, modifierId, patch) { return run((current) => updateFilterMask(current, layerId, modifierId, patch), "Update filter mask"); },
      setModifierEnabled(layerId, modifierId, enabled) { return run((current) => setModifierEnabled(current, layerId, modifierId, enabled), enabled ? "Enable modifier" : "Disable modifier"); },
      reorderModifier(layerId, modifierId, toIndex) { return run((current) => reorderModifier(current, layerId, modifierId, toIndex), "Reorder modifier"); },
      removeModifier(layerId, modifierId) { return run((current) => removeModifier(current, layerId, modifierId), "Remove modifier"); },
      reorderLayer(layerId, toIndex) { return run((current) => reorderLayer(current, layerId, toIndex), "Reorder layer"); },
      removeLayer(layerId) { return run((current) => removeLayer(current, layerId), "Remove layer"); },
      undo() {
        if (historyIndex <= 0) return false;
        historyIndex -= 1;
        project = clone(history[historyIndex]);
        notify("Undo");
        return true;
      },
      redo() {
        if (historyIndex >= history.length - 1) return false;
        historyIndex += 1;
        project = clone(history[historyIndex]);
        notify("Redo");
        return true;
      },
      serialize: () => serializeProject(project)
    };
    return Object.freeze(engine);
  }

  function compileModifierFilter(modifierInput) {
    const modifier = isRecord(modifierInput) ? modifierInput : {};
    if (modifier.type === "smart-filter") {
      const kind = FILTER_DEFINITIONS[modifier.kind] ? modifier.kind : "brightness";
      const definition = FILTER_DEFINITIONS[kind];
      const value = clamp(modifier.value, definition.min, definition.max, definition.initial);
      return `${kind}(${value}${definition.unit})`;
    }
    const settings = isRecord(modifier.settings) ? modifier.settings : {};
    const value = (key) => {
      const definition = ADJUSTMENT_DEFINITIONS[key];
      return clamp(settings[key], definition.min, definition.max, definition.initial);
    };
    return [
      `brightness(${value("brightness")}%)`,
      `contrast(${value("contrast")}%)`,
      `saturate(${value("saturate")}%)`,
      `grayscale(${value("grayscale")}%)`,
      `sepia(${value("sepia")}%)`,
      `hue-rotate(${value("hue")}deg)`
    ].join(" ");
  }

  function getCapabilities(runtime) {
    const scope = runtime || globalScope;
    let canvas2d = false;
    let canvasFilter = false;
    let canvasExport = false;
    try {
      const canvas = scope.document?.createElement?.("canvas");
      const context = canvas?.getContext?.("2d");
      canvas2d = Boolean(context);
      canvasFilter = Boolean(context && "filter" in context);
      canvasExport = Boolean(canvas && typeof canvas.toBlob === "function");
    } catch (_) {
      canvas2d = false;
    }
    let localStorage = false;
    try { localStorage = Boolean(scope.localStorage); } catch (_) { localStorage = false; }
    return Object.freeze({
      canvas2d,
      canvasFilter,
      canvasExport,
      fileReader: typeof scope.FileReader === "function",
      imageDecoder: typeof scope.Image === "function",
      localStorage
    });
  }

  function makeCanvas(width, height, options) {
    let canvas = null;
    if (typeof options?.createCanvas === "function") canvas = options.createCanvas(width, height);
    else if (options?.runtime?.document?.createElement) canvas = options.runtime.document.createElement("canvas");
    else if (globalScope.document?.createElement) canvas = globalScope.document.createElement("canvas");
    else if (typeof globalScope.OffscreenCanvas === "function") canvas = new globalScope.OffscreenCanvas(width, height);
    if (!canvas) return null;
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function copyCanvas(source, width, height, options) {
    const canvas = makeCanvas(width, height, options);
    const context = canvas?.getContext?.("2d");
    if (!context) return null;
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  function drawCheckerboard(context, width, height) {
    const size = Math.max(8, Math.round(Math.min(width, height) / 32));
    context.fillStyle = "#111722";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#1c2532";
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) context.fillRect(x, y, size, size);
      }
    }
  }

  function drawImageFitted(context, image, x, y, width, height, fit) {
    const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width) || 1);
    const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height) || 1);
    if (fit === "stretch") {
      context.drawImage(image, x, y, width, height);
      return;
    }
    const scale = fit === "cover" ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawMaskShape(context, mask, width, height, alpha) {
    const centerX = mask.x * width;
    const centerY = mask.y * height;
    const maskWidth = mask.width * width;
    const maskHeight = mask.height * height;
    context.save();
    context.globalAlpha = alpha;
    if (mask.feather > 0 && "filter" in context) context.filter = `blur(${mask.feather * Math.min(width, height) / 1000}px)`;
    if (mask.shape === "full") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    } else if (mask.shape === "linear" && typeof context.createLinearGradient === "function") {
      const gradient = context.createLinearGradient(centerX - maskWidth / 2, centerY, centerX + maskWidth / 2, centerY);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(255,255,255,1)");
      context.fillStyle = gradient;
      context.fillRect(centerX - maskWidth / 2, centerY - maskHeight / 2, maskWidth, maskHeight);
    } else if (mask.shape === "ellipse" && typeof context.ellipse === "function") {
      context.beginPath();
      context.ellipse(centerX, centerY, maskWidth / 2, maskHeight / 2, 0, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
    } else {
      context.fillStyle = "#ffffff";
      context.fillRect(centerX - maskWidth / 2, centerY - maskHeight / 2, maskWidth, maskHeight);
    }
    context.restore();
  }

  function createMaskCanvas(maskInput, width, height, options) {
    const mask = normalizeMask(maskInput);
    const canvas = makeCanvas(width, height, options);
    const context = canvas?.getContext?.("2d");
    if (!context) return null;
    context.clearRect(0, 0, width, height);
    if (mask.inverted) {
      context.fillStyle = `rgba(255,255,255,${mask.opacity})`;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "destination-out";
      drawMaskShape(context, mask, width, height, 1);
    } else {
      drawMaskShape(context, mask, width, height, mask.opacity);
    }
    context.globalCompositeOperation = "source-over";
    return canvas;
  }

  function applyModifierCanvas(source, modifier, width, height, options, warnings) {
    if (!modifier.enabled) return source;
    const filtered = makeCanvas(width, height, options);
    const filteredContext = filtered?.getContext?.("2d");
    if (!filteredContext) return source;
    if (!("filter" in filteredContext)) {
      warnings.add("Canvas2D filters are unsupported; enabled modifiers were skipped.");
      return source;
    }
    filteredContext.clearRect(0, 0, width, height);
    filteredContext.filter = compileModifierFilter(modifier);
    filteredContext.drawImage(source, 0, 0, width, height);
    filteredContext.filter = "none";
    if (!modifier.mask?.enabled) return filtered;
    const mask = createMaskCanvas(modifier.mask, width, height, options);
    if (!mask) return source;
    const masked = copyCanvas(filtered, width, height, options);
    const maskedContext = masked?.getContext?.("2d");
    if (!maskedContext) return source;
    maskedContext.globalCompositeOperation = "destination-in";
    maskedContext.drawImage(mask, 0, 0, width, height);
    maskedContext.globalCompositeOperation = "source-over";
    const result = copyCanvas(source, width, height, options);
    const resultContext = result?.getContext?.("2d");
    if (!resultContext) return source;
    resultContext.drawImage(masked, 0, 0, width, height);
    return result;
  }

  function loadAssetImage(asset, options) {
    if (typeof options?.resolveImage === "function") return Promise.resolve(options.resolveImage(asset));
    const runtime = options?.runtime || globalScope;
    const cache = options?.imageCache;
    const cacheKey = `${asset.id}:${asset.sourceVersion}`;
    if (cache?.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));
    if (typeof runtime.Image !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = new runtime.Image();
      image.onload = () => { cache?.set(cacheKey, image); resolve(image); };
      image.onerror = () => resolve(null);
      image.src = asset.dataUrl;
    });
  }

  async function renderProject(canvas, projectInput, options) {
    if (!canvas || typeof canvas.getContext !== "function") {
      return { supported: false, filtersSupported: false, reason: "Canvas2D is unavailable.", warnings: ["Canvas2D is unavailable."], renderedLayers: 0, missingAssets: [] };
    }
    const targetContext = canvas.getContext("2d");
    if (!targetContext) {
      return { supported: false, filtersSupported: false, reason: "Canvas2D is unavailable.", warnings: ["Canvas2D is unavailable."], renderedLayers: 0, missingAssets: [] };
    }
    const project = normalizeProject(projectInput);
    const settings = isRecord(options) ? options : {};
    const maxDimension = clamp(settings.maxDimension, 256, 4096, 1600);
    const scale = Math.min(1, maxDimension / Math.max(project.width, project.height));
    const width = Math.max(1, Math.round(project.width * scale));
    const height = Math.max(1, Math.round(project.height * scale));
    const canvasOptions = { ...settings, runtime: settings.runtime || globalScope };
    const composed = makeCanvas(width, height, canvasOptions);
    let composedContext = composed?.getContext?.("2d");
    if (!composedContext) {
      return { supported: false, filtersSupported: false, reason: "Canvas2D working buffers are unavailable.", warnings: ["Canvas2D working buffers are unavailable."], renderedLayers: 0, missingAssets: [] };
    }
    const warnings = new Set();
    const missingAssets = [];
    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
    let renderedLayers = 0;
    composedContext.clearRect(0, 0, width, height);

    for (const layer of [...project.layers].reverse()) {
      if (!layer.visible || layer.opacity <= 0) continue;
      if (layer.type === "adjustment") {
        const original = copyCanvas(composed, width, height, canvasOptions);
        let adjusted = copyCanvas(composed, width, height, canvasOptions);
        if (!original || !adjusted) continue;
        for (const modifier of layer.modifiers) {
          if (!modifier.enabled) continue;
          adjusted = applyModifierCanvas(adjusted, modifier, width, height, canvasOptions, warnings);
        }
        composedContext.clearRect(0, 0, width, height);
        composedContext.globalAlpha = 1;
        composedContext.globalCompositeOperation = "source-over";
        composedContext.drawImage(original, 0, 0, width, height);
        composedContext.globalAlpha = layer.opacity;
        composedContext.globalCompositeOperation = layer.blendMode;
        composedContext.drawImage(adjusted, 0, 0, width, height);
        composedContext.globalAlpha = 1;
        composedContext.globalCompositeOperation = "source-over";
        renderedLayers += 1;
        continue;
      }

      const asset = assetMap.get(layer.assetId);
      if (!asset) {
        missingAssets.push(layer.assetId);
        warnings.add(`Missing linked asset: ${layer.assetId}`);
        continue;
      }
      const image = await loadAssetImage(asset, canvasOptions);
      if (!image) {
        missingAssets.push(asset.id);
        warnings.add(`Unable to decode local asset: ${asset.name}`);
        continue;
      }
      let layerCanvas = makeCanvas(width, height, canvasOptions);
      const layerContext = layerCanvas?.getContext?.("2d");
      if (!layerContext) continue;
      const x = layer.transform.x * width;
      const y = layer.transform.y * height;
      const layerWidth = layer.transform.width * width;
      const layerHeight = layer.transform.height * height;
      layerContext.save();
      layerContext.translate(x + layerWidth / 2, y + layerHeight / 2);
      layerContext.rotate(layer.transform.rotation * Math.PI / 180);
      drawImageFitted(layerContext, image, -layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight, layer.fit);
      layerContext.restore();
      for (const modifier of layer.modifiers) {
        layerCanvas = applyModifierCanvas(layerCanvas, modifier, width, height, canvasOptions, warnings);
      }
      composedContext.globalAlpha = layer.opacity;
      composedContext.globalCompositeOperation = layer.blendMode;
      composedContext.drawImage(layerCanvas, 0, 0, width, height);
      composedContext.globalAlpha = 1;
      composedContext.globalCompositeOperation = "source-over";
      renderedLayers += 1;
    }

    canvas.width = width;
    canvas.height = height;
    drawCheckerboard(targetContext, width, height);
    if (project.background === "white") {
      targetContext.fillStyle = "#ffffff";
      targetContext.fillRect(0, 0, width, height);
    }
    targetContext.drawImage(composed, 0, 0, width, height);
    return {
      supported: true,
      filtersSupported: !Array.from(warnings).some((message) => message.startsWith("Canvas2D filters")),
      reason: "",
      warnings: Array.from(warnings),
      renderedLayers,
      missingAssets,
      width,
      height
    };
  }

  function addStyles(documentObject) {
    const documentRef = documentObject || globalScope.document;
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .gnd{--bg:#080b11;--panel:#101721;--panel-2:#151d29;--line:#2b3948;--text:#eef6fb;--muted:#91a2b2;--cyan:#5ed8e6;--pink:#f06dad;--lime:#bce96d;--amber:#f3bd58;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif;letter-spacing:0}.gnd *{box-sizing:border-box;min-width:0}.gnd button,.gnd input,.gnd select{font:inherit;letter-spacing:0}.gnd button{min-height:34px;border:1px solid #3a4a5d;border-radius:6px;background:#182331;color:var(--text);cursor:pointer}.gnd button:hover{border-color:var(--cyan)}.gnd button:focus-visible,.gnd input:focus-visible,.gnd select:focus-visible,.gnd canvas:focus-visible{outline:2px solid var(--lime);outline-offset:2px}.gnd button:disabled{cursor:not-allowed;opacity:.42}.gnd-icon{display:grid;place-items:center;width:36px;padding:0;font-size:18px}.gnd-command{padding:7px 11px}.gnd-primary{border-color:#397c82!important;background:var(--cyan)!important;color:#071116!important;font-weight:800}.gnd-header{display:flex;align-items:center;gap:14px;padding:12px 14px;border-bottom:1px solid var(--line);background:#0d131c}.gnd-brand{display:flex;align-items:center;gap:10px}.gnd-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid #4b6174;border-radius:6px;background:#192635;color:var(--cyan);font-weight:900}.gnd h2,.gnd h3,.gnd p{margin:0}.gnd h2{font-size:16px}.gnd h3{font-size:12px;text-transform:uppercase;color:var(--cyan)}.gnd-project-label{color:var(--muted);font-size:11px}.gnd-header-actions{display:flex;gap:6px;margin-left:auto;overflow-x:auto;padding:2px}.gnd-main{display:grid;grid-template-columns:236px minmax(320px,1fr) 286px;min-height:650px}.gnd-sidebar{display:flex;flex-direction:column;min-height:0;background:var(--panel)}.gnd-layers{border-right:1px solid var(--line)}.gnd-modifiers{border-left:1px solid var(--line)}.gnd-section-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--line)}.gnd-section-head button{margin-left:auto;padding:4px 8px;min-height:29px}.gnd-layer-tools,.gnd-add-filter{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:9px;border-bottom:1px solid var(--line)}.gnd-layer-tools button,.gnd-add-filter button{padding:6px}.gnd-list{list-style:none;margin:0;padding:6px;overflow:auto}.gnd-list li{display:grid;grid-template-columns:34px minmax(0,1fr) 30px 30px;align-items:center;gap:4px;margin-bottom:4px}.gnd-list button{padding:5px;min-height:34px}.gnd-select{display:flex;align-items:center;gap:7px;text-align:left;overflow:hidden}.gnd-select.is-active{border-color:var(--pink);background:#252032}.gnd-type{display:grid;place-items:center;flex:0 0 28px;height:24px;border-radius:4px;background:#203143;color:var(--cyan);font-size:10px;font-weight:800}.gnd-layer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gnd-mini{display:grid;place-items:center;width:30px;padding:0}.gnd-empty{padding:18px 12px;color:var(--muted);text-align:center}.gnd-stage{display:grid;grid-template-rows:auto 1fr auto;min-height:0;background:#090e15}.gnd-toolbar{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11px}.gnd-save-state{margin-left:auto}.gnd-canvas-area{display:grid;place-items:center;min-height:420px;padding:18px;overflow:auto;background:#0b1018}.gnd-canvas-frame{display:grid;place-items:center;width:100%;height:100%;margin:0}.gnd canvas{display:block;max-width:100%;max-height:68vh;border:1px solid #425267;background:#111722;box-shadow:0 16px 36px rgba(0,0,0,.34)}.gnd figcaption{margin-top:8px;color:var(--muted);font-size:11px;text-align:center}.gnd-statusbar{display:flex;align-items:center;gap:10px;min-height:38px;padding:8px 12px;border-top:1px solid var(--line);color:var(--muted)}.gnd-statusbar [role=status]{flex:1}.gnd-local{color:var(--lime);font-size:11px}.gnd-unsupported{margin:14px;padding:12px;border:1px solid #8c5e2c;border-radius:6px;background:#2a1d10;color:#ffd99a}.gnd-unsupported[hidden]{display:none}.gnd-inspector{padding:10px;overflow:auto}.gnd-fieldset{display:grid;gap:9px;margin:0 0 12px;padding:0 0 12px;border:0;border-bottom:1px solid var(--line)}.gnd-fieldset legend{margin-bottom:9px;color:var(--pink);font-size:11px;font-weight:800;text-transform:uppercase}.gnd label{display:grid;gap:4px;color:var(--muted);font-size:11px}.gnd input[type=text],.gnd select{width:100%;min-height:35px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:#0b1119;color:var(--text)}.gnd input[type=range]{width:100%;accent-color:var(--cyan)}.gnd-check{display:flex!important;align-items:center;gap:7px}.gnd-check input{accent-color:var(--pink)}.gnd-range-head{display:flex;justify-content:space-between;gap:8px}.gnd output{color:var(--text);font-variant-numeric:tabular-nums}.gnd-modifier-list{max-height:210px;border-bottom:1px solid var(--line)}.gnd-add-filter{grid-template-columns:1fr auto}.gnd-danger{border-color:#744258!important;color:#ffb7d5!important}.gnd-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:980px){.gnd-main{grid-template-columns:210px minmax(300px,1fr)}.gnd-modifiers{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}.gnd-inspector{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gnd-inspector>.gnd-empty{grid-column:1/-1}}
      @media(max-width:640px){.gnd{width:100%;border-left:0;border-right:0}.gnd-header{align-items:flex-start;flex-wrap:wrap;padding:10px}.gnd-header-actions{width:100%;margin-left:0}.gnd-command{white-space:nowrap}.gnd-main{display:block;min-height:0}.gnd-layers,.gnd-modifiers{border:0;border-bottom:1px solid var(--line)}.gnd-list{max-height:220px}.gnd-stage{min-height:430px}.gnd-canvas-area{min-height:310px;padding:10px}.gnd canvas{max-height:52vh}.gnd-inspector{display:block}.gnd-statusbar{align-items:flex-start;flex-direction:column}.gnd-save-state{margin-left:0}.gnd-layer-name{white-space:normal;overflow-wrap:anywhere}}
      @media(prefers-reduced-motion:reduce){.gnd *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    documentRef.head.appendChild(style);
  }

  function downloadBlob(runtime, blob, filename) {
    if (!runtime.URL?.createObjectURL || !runtime.document?.createElement) return false;
    const url = runtime.URL.createObjectURL(blob);
    const anchor = runtime.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    runtime.setTimeout(() => runtime.URL.revokeObjectURL(url), 0);
    return true;
  }

  function safeFilename(value) {
    return cleanText(value, "nondestructive-edit", 80).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "nondestructive-edit";
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const settings = isRecord(options) ? options : {};
    const runtime = settings.runtime || globalScope;
    const documentRef = root.ownerDocument || runtime.document;
    addStyles(documentRef);
    let storage = settings.storage;
    if (storage === undefined) {
      try { storage = runtime.localStorage || null; } catch (_) { storage = null; }
    }
    let initialProject = settings.project;
    let startupMessage = "Ready.";
    if (!initialProject && storage) {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        if (saved) initialProject = deserializeProject(saved);
      } catch (error) {
        startupMessage = error?.code === "UNSUPPORTED_VERSION" ? "Saved project version is unsupported." : "Saved local project could not be opened.";
      }
    }
    const engine = createEngine(initialProject || createDefaultProject(), settings);
    const capabilities = getCapabilities(runtime);
    const imageCache = new Map();
    let selectedLayerId = engine.getProject().layers[0]?.id || null;
    let selectedModifierId = engine.getProject().layers[0]?.modifiers[0]?.id || null;
    let pendingImageMode = "add";
    let renderRevision = 0;

    root.classList.add("gnd");
    root.innerHTML = `<header class="gnd-header"><div class="gnd-brand"><span class="gnd-mark" aria-hidden="true">ND</span><div><h2>Non-destructive Editor</h2><p class="gnd-project-label" data-gnd-project-label></p></div></div><div class="gnd-header-actions"><button type="button" class="gnd-icon" data-gnd-action="undo" aria-label="Undo" title="Undo (Ctrl+Z)">&#8630;</button><button type="button" class="gnd-icon" data-gnd-action="redo" aria-label="Redo" title="Redo (Ctrl+Y)">&#8631;</button><button type="button" class="gnd-command gnd-primary" data-gnd-action="import-image">Import image</button><button type="button" class="gnd-command" data-gnd-action="import-project">Open project</button><button type="button" class="gnd-command" data-gnd-action="export-project">Export</button></div></header><div class="gnd-main"><aside class="gnd-sidebar gnd-layers" aria-labelledby="gnd-layers-title"><div class="gnd-section-head"><h3 id="gnd-layers-title">Layers</h3><button type="button" data-gnd-action="add-adjustment">+ Adjustment</button></div><div class="gnd-layer-tools"><button type="button" data-gnd-action="add-linked">Linked copy</button><button type="button" class="gnd-danger" data-gnd-action="remove-layer">Delete</button></div><ul class="gnd-list" data-gnd-layers></ul></aside><section class="gnd-stage" aria-label="Canvas preview"><div class="gnd-toolbar"><span data-gnd-size></span><span data-gnd-render-info></span><span class="gnd-save-state" data-gnd-save-state></span></div><div class="gnd-unsupported" role="alert" data-gnd-unsupported hidden></div><div class="gnd-canvas-area"><figure class="gnd-canvas-frame"><canvas tabindex="0" data-gnd-canvas aria-label="Rendered project preview"></canvas><figcaption data-gnd-caption>Canvas2D preview</figcaption></figure></div><footer class="gnd-statusbar"><span role="status" aria-live="polite" data-gnd-status></span><span class="gnd-local">Local-first</span></footer></section><aside class="gnd-sidebar gnd-modifiers" aria-labelledby="gnd-modifiers-title"><div class="gnd-section-head"><h3 id="gnd-modifiers-title">Modifier stack</h3></div><div class="gnd-add-filter"><select data-gnd-new-filter aria-label="Smart filter type">${Object.keys(FILTER_DEFINITIONS).map((kind) => `<option value="${kind}">${escapeHtml(FILTER_DEFINITIONS[kind].label)}</option>`).join("")}</select><button type="button" data-gnd-action="add-filter">Add</button></div><ul class="gnd-list gnd-modifier-list" data-gnd-modifiers></ul><div class="gnd-inspector" data-gnd-inspector></div></aside></div><input class="gnd-sr" type="file" accept="image/png,image/jpeg,image/webp" data-gnd-image-file><input class="gnd-sr" type="file" accept="application/json,.json" data-gnd-project-file>`;

    const query = (selector) => root.querySelector(selector);
    const canvas = query("[data-gnd-canvas]");
    const statusNode = query("[data-gnd-status]");
    const unsupportedNode = query("[data-gnd-unsupported]");
    const announce = (message) => { statusNode.textContent = message; };

    function currentSelection() {
      const project = engine.getProject();
      let layer = project.layers.find((candidate) => candidate.id === selectedLayerId) || null;
      if (!layer && project.layers.length) {
        layer = project.layers[0];
        selectedLayerId = layer.id;
      }
      let modifier = layer?.modifiers.find((candidate) => candidate.id === selectedModifierId) || null;
      if (!modifier && layer?.modifiers.length) {
        modifier = layer.modifiers[0];
        selectedModifierId = modifier.id;
      }
      if (!layer) selectedModifierId = null;
      return { project, layer, modifier };
    }

    function persist() {
      const saveNode = query("[data-gnd-save-state]");
      if (!storage) {
        saveNode.textContent = "Storage unsupported";
        return false;
      }
      try {
        storage.setItem(STORAGE_KEY, engine.serialize());
        saveNode.textContent = "Saved locally";
        return true;
      } catch (_) {
        saveNode.textContent = "Local save failed";
        announce("Local storage is full or unavailable. Export the project to keep this edit.");
        return false;
      }
    }

    function syncHeader() {
      const { project } = currentSelection();
      query("[data-gnd-project-label]").textContent = project.name;
      query("[data-gnd-size]").textContent = `${project.width} x ${project.height}`;
      const history = engine.getHistoryState();
      query('[data-gnd-action="undo"]').disabled = !history.canUndo;
      query('[data-gnd-action="redo"]').disabled = !history.canRedo;
    }

    function renderLayers() {
      const { project, layer: selected } = currentSelection();
      const list = query("[data-gnd-layers]");
      if (!project.layers.length) {
        list.innerHTML = '<li class="gnd-empty">No layers</li>';
        return;
      }
      list.innerHTML = project.layers.map((layer, index) => `<li><button type="button" class="gnd-mini" data-gnd-toggle-layer="${escapeHtml(layer.id)}" aria-label="${layer.visible ? "Hide" : "Show"} ${escapeHtml(layer.name)}" aria-pressed="${layer.visible}">${layer.visible ? "&#9673;" : "&#9675;"}</button><button type="button" class="gnd-select ${selected?.id === layer.id ? "is-active" : ""}" data-gnd-select-layer="${escapeHtml(layer.id)}" aria-current="${selected?.id === layer.id ? "true" : "false"}"><span class="gnd-type">${layer.type === "adjustment" ? "ADJ" : "OBJ"}</span><span class="gnd-layer-name">${escapeHtml(layer.name)}</span></button><button type="button" class="gnd-mini" data-gnd-layer-up="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} up" title="Move up" ${index === 0 ? "disabled" : ""}>&#8593;</button><button type="button" class="gnd-mini" data-gnd-layer-down="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} down" title="Move down" ${index === project.layers.length - 1 ? "disabled" : ""}>&#8595;</button></li>`).join("");
    }

    function renderModifiers() {
      const { layer, modifier: selected } = currentSelection();
      const list = query("[data-gnd-modifiers]");
      const addFilterButton = query('[data-gnd-action="add-filter"]');
      const addFilterSelect = query("[data-gnd-new-filter]");
      addFilterButton.disabled = layer?.type !== "smart-object";
      addFilterSelect.disabled = layer?.type !== "smart-object";
      if (!layer) {
        list.innerHTML = '<li class="gnd-empty">Select a layer</li>';
        return;
      }
      if (!layer.modifiers.length) {
        list.innerHTML = '<li class="gnd-empty">No modifiers</li>';
        return;
      }
      list.innerHTML = layer.modifiers.map((modifier, index) => `<li><button type="button" class="gnd-mini" data-gnd-toggle-modifier="${escapeHtml(modifier.id)}" aria-label="${modifier.enabled ? "Disable" : "Enable"} ${escapeHtml(modifier.name)}" aria-pressed="${modifier.enabled}">${modifier.enabled ? "&#9673;" : "&#9675;"}</button><button type="button" class="gnd-select ${selected?.id === modifier.id ? "is-active" : ""}" data-gnd-select-modifier="${escapeHtml(modifier.id)}" aria-current="${selected?.id === modifier.id ? "true" : "false"}"><span class="gnd-type">${modifier.type === "adjustment" ? "ADJ" : "FX"}</span><span class="gnd-layer-name">${escapeHtml(modifier.name)}</span></button><button type="button" class="gnd-mini" data-gnd-modifier-up="${escapeHtml(modifier.id)}" aria-label="Move ${escapeHtml(modifier.name)} up" title="Move up" ${index === 0 ? "disabled" : ""}>&#8593;</button><button type="button" class="gnd-mini" data-gnd-modifier-down="${escapeHtml(modifier.id)}" aria-label="Move ${escapeHtml(modifier.name)} down" title="Move down" ${index === layer.modifiers.length - 1 ? "disabled" : ""}>&#8595;</button></li>`).join("");
    }

    function rangeField(key, definition, value, scope) {
      return `<label><span class="gnd-range-head"><span>${escapeHtml(definition.label)}</span><output data-gnd-output="${escapeHtml(scope)}-${escapeHtml(key)}">${value}${definition.unit}</output></span><input type="range" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${value}" data-gnd-${scope}="${escapeHtml(key)}"></label>`;
    }

    function maskFields(mask) {
      return `<fieldset class="gnd-fieldset"><legend>Filter mask</legend><label class="gnd-check"><input type="checkbox" data-gnd-mask="enabled" ${mask.enabled ? "checked" : ""}> Enabled</label><label>Shape<select data-gnd-mask="shape">${MASK_SHAPES.map((shape) => `<option value="${shape}" ${shape === mask.shape ? "selected" : ""}>${escapeHtml(shape)}</option>`).join("")}</select></label>${rangeField("opacity", { label: "Opacity", min: 0, max: 1, step: 0.01, unit: "" }, mask.opacity, "mask")}${rangeField("feather", { label: "Feather", min: 0, max: 100, step: 1, unit: "%" }, mask.feather, "mask")}${rangeField("x", { label: "Center X", min: 0, max: 1, step: 0.01, unit: "" }, mask.x, "mask")}${rangeField("y", { label: "Center Y", min: 0, max: 1, step: 0.01, unit: "" }, mask.y, "mask")}${rangeField("width", { label: "Width", min: 0.02, max: 1, step: 0.01, unit: "" }, mask.width, "mask")}${rangeField("height", { label: "Height", min: 0.02, max: 1, step: 0.01, unit: "" }, mask.height, "mask")}<label class="gnd-check"><input type="checkbox" data-gnd-mask="inverted" ${mask.inverted ? "checked" : ""}> Invert mask</label></fieldset>`;
    }

    function renderInspector() {
      const { project, layer, modifier } = currentSelection();
      const inspector = query("[data-gnd-inspector]");
      if (!layer) {
        inspector.innerHTML = '<p class="gnd-empty">Import a local image or add an adjustment layer.</p>';
        return;
      }
      const asset = project.assets.find((candidate) => candidate.id === layer.assetId);
      let html = `<fieldset class="gnd-fieldset"><legend>Layer</legend><label>Name<input type="text" maxlength="120" data-gnd-layer-name value="${escapeHtml(layer.name)}"></label>${rangeField("opacity", { label: "Opacity", min: 0, max: 1, step: 0.01, unit: "" }, layer.opacity, "layer")}<label>Blend mode<select data-gnd-layer-blend>${BLEND_MODES.map((mode) => `<option value="${mode}" ${mode === layer.blendMode ? "selected" : ""}>${escapeHtml(mode)}</option>`).join("")}</select></label>${layer.type === "smart-object" ? `<label>Fit<select data-gnd-layer-fit><option value="contain" ${layer.fit === "contain" ? "selected" : ""}>contain</option><option value="cover" ${layer.fit === "cover" ? "selected" : ""}>cover</option><option value="stretch" ${layer.fit === "stretch" ? "selected" : ""}>stretch</option></select></label><button type="button" data-gnd-action="replace-source">Replace linked source</button><p class="gnd-project-label">${escapeHtml(asset?.name || "Missing source")} - v${asset?.sourceVersion || 0}</p>` : ""}</fieldset>`;
      if (!modifier) {
        html += '<p class="gnd-empty">Select or add a modifier.</p>';
        inspector.innerHTML = html;
        return;
      }
      if (modifier.type === "smart-filter") {
        const definition = FILTER_DEFINITIONS[modifier.kind];
        html += `<fieldset class="gnd-fieldset"><legend>Smart filter</legend><label>Filter<select data-gnd-filter-kind>${Object.keys(FILTER_DEFINITIONS).map((kind) => `<option value="${kind}" ${kind === modifier.kind ? "selected" : ""}>${escapeHtml(FILTER_DEFINITIONS[kind].label)}</option>`).join("")}</select></label>${rangeField("value", definition, modifier.value, "filter")}<button type="button" class="gnd-danger" data-gnd-action="remove-modifier">Remove filter</button></fieldset>`;
      } else {
        html += `<fieldset class="gnd-fieldset"><legend>Adjustment</legend>${Object.keys(ADJUSTMENT_DEFINITIONS).map((key) => rangeField(key, ADJUSTMENT_DEFINITIONS[key], modifier.settings[key], "adjustment")).join("")}<button type="button" data-gnd-action="add-adjustment-modifier">Add adjustment</button><button type="button" class="gnd-danger" data-gnd-action="remove-modifier">Remove adjustment</button></fieldset>`;
      }
      html += maskFields(modifier.mask);
      inspector.innerHTML = html;
    }

    async function renderPreview() {
      const revision = ++renderRevision;
      if (!capabilities.canvas2d) {
        unsupportedNode.hidden = false;
        unsupportedNode.textContent = "Canvas2D is not supported in this browser. Editing data remains available, but no preview can be rendered.";
        query("[data-gnd-render-info]").textContent = "Preview unsupported";
        return;
      }
      unsupportedNode.hidden = true;
      const scratch = documentRef.createElement("canvas");
      const result = await renderProject(scratch, engine.getProject(), { runtime, imageCache, maxDimension: settings.maxDimension || 1600 });
      if (revision !== renderRevision) return;
      if (!result.supported) {
        unsupportedNode.hidden = false;
        unsupportedNode.textContent = result.reason;
        return;
      }
      canvas.width = scratch.width;
      canvas.height = scratch.height;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(scratch, 0, 0);
      query("[data-gnd-render-info]").textContent = `${result.renderedLayers} layer${result.renderedLayers === 1 ? "" : "s"} rendered`;
      query("[data-gnd-caption]").textContent = result.warnings[0] || "Canvas2D preview";
      if (result.warnings.length) announce(result.warnings.join(" "));
    }

    function renderAll() {
      syncHeader();
      renderLayers();
      renderModifiers();
      renderInspector();
      renderPreview();
    }

    function afterChange(message, structural) {
      persist();
      if (structural) renderAll();
      else { syncHeader(); renderPreview(); }
      if (message) announce(message);
    }

    function selectLayer(layerId, focus) {
      const project = engine.getProject();
      const layer = project.layers.find((candidate) => candidate.id === layerId);
      if (!layer) return;
      selectedLayerId = layer.id;
      selectedModifierId = layer.modifiers[0]?.id || null;
      renderAll();
      if (focus) documentRef.defaultView?.queueMicrotask?.(() => query(`[data-gnd-select-layer="${layer.id}"]`)?.focus());
    }

    function importLocalImage(file, mode) {
      if (!capabilities.fileReader || !capabilities.imageDecoder) {
        announce("Local image import is unsupported because FileReader or image decoding is unavailable.");
        return;
      }
      if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        announce("Only local PNG, JPEG, and WebP images are supported.");
        return;
      }
      if (file.size > MAX_ASSET_BYTES) {
        announce("This image exceeds the 12 MB local import limit.");
        return;
      }
      const reader = new runtime.FileReader();
      reader.onerror = () => announce("The local image could not be read.");
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (!isSafeImageDataUrl(dataUrl)) return announce("The image data is unsupported or too large.");
        const image = new runtime.Image();
        image.onerror = () => announce("The local image could not be decoded.");
        image.onload = () => {
          const payload = { name: file.name, type: file.type, width: image.naturalWidth, height: image.naturalHeight, dataUrl };
          try {
            if (mode === "replace") {
              const { layer } = currentSelection();
              if (!layer || layer.type !== "smart-object") return announce("Select a smart object before replacing its source.");
              const result = engine.updateLinkedAsset(layer.assetId, payload);
              imageCache.clear();
              afterChange(`Updated ${result.affectedLayerIds.length} linked instance${result.affectedLayerIds.length === 1 ? "" : "s"}.`, true);
            } else {
              const result = engine.importAsset(payload, { name: file.name });
              selectedLayerId = result.layerId;
              selectedModifierId = null;
              afterChange("Local image imported as a smart object.", true);
            }
          } catch (error) {
            announce(error.message || "The image could not be imported.");
          }
        };
        image.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }

    function importProjectFile(file) {
      if (!capabilities.fileReader) return announce("Project import is unsupported because FileReader is unavailable.");
      if (!file || file.size > MAX_DATA_URL_LENGTH * 2) return announce("Project file is too large.");
      const reader = new runtime.FileReader();
      reader.onerror = () => announce("The project file could not be read.");
      reader.onload = () => {
        try {
          const project = deserializeProject(String(reader.result || ""));
          engine.setProject(project);
          selectedLayerId = project.layers[0]?.id || null;
          selectedModifierId = project.layers[0]?.modifiers[0]?.id || null;
          imageCache.clear();
          afterChange("Project opened.", true);
        } catch (error) {
          announce(error instanceof ProjectFormatError ? error.message : "Project file is invalid.");
        }
      };
      reader.readAsText(file);
    }

    const onClick = (event) => {
      const target = event.target.closest("button");
      if (!target || !root.contains(target)) return;
      const selection = currentSelection();
      if (target.dataset.gndSelectLayer) return selectLayer(target.dataset.gndSelectLayer, true);
      if (target.dataset.gndSelectModifier) {
        selectedModifierId = target.dataset.gndSelectModifier;
        renderModifiers();
        renderInspector();
        return documentRef.defaultView?.queueMicrotask?.(() => query(`[data-gnd-select-modifier="${selectedModifierId}"]`)?.focus());
      }
      if (target.dataset.gndToggleLayer) {
        const layer = selection.project.layers.find((candidate) => candidate.id === target.dataset.gndToggleLayer);
        if (layer) engine.updateLayer(layer.id, { visible: !layer.visible });
        return afterChange(layer?.visible ? "Layer hidden." : "Layer shown.", true);
      }
      if (target.dataset.gndToggleModifier) {
        const modifier = selection.layer?.modifiers.find((candidate) => candidate.id === target.dataset.gndToggleModifier);
        if (modifier) engine.setModifierEnabled(selection.layer.id, modifier.id, !modifier.enabled);
        return afterChange(modifier?.enabled ? "Modifier disabled." : "Modifier enabled.", true);
      }
      if (target.dataset.gndLayerUp || target.dataset.gndLayerDown) {
        const layerId = target.dataset.gndLayerUp || target.dataset.gndLayerDown;
        const index = selection.project.layers.findIndex((layer) => layer.id === layerId);
        engine.reorderLayer(layerId, index + (target.dataset.gndLayerUp ? -1 : 1));
        return afterChange("Layer order updated.", true);
      }
      if (target.dataset.gndModifierUp || target.dataset.gndModifierDown) {
        const modifierId = target.dataset.gndModifierUp || target.dataset.gndModifierDown;
        const index = selection.layer.modifiers.findIndex((modifier) => modifier.id === modifierId);
        engine.reorderModifier(selection.layer.id, modifierId, index + (target.dataset.gndModifierUp ? -1 : 1));
        return afterChange("Modifier order updated.", true);
      }
      const action = target.dataset.gndAction;
      if (action === "undo" || action === "redo") {
        const changed = action === "undo" ? engine.undo() : engine.redo();
        if (!changed) return announce(action === "undo" ? "Nothing to undo." : "Nothing to redo.");
        return afterChange(action === "undo" ? "Undone." : "Redone.", true);
      }
      if (action === "import-image") {
        pendingImageMode = "add";
        return query("[data-gnd-image-file]").click();
      }
      if (action === "replace-source") {
        pendingImageMode = "replace";
        return query("[data-gnd-image-file]").click();
      }
      if (action === "import-project") return query("[data-gnd-project-file]").click();
      if (action === "export-project") {
        if (typeof runtime.Blob !== "function") return announce("Blob export is unsupported in this browser.");
        const blob = new runtime.Blob([engine.serialize()], { type: "application/json" });
        const downloaded = downloadBlob(runtime, blob, `${safeFilename(selection.project.name)}.hhnd.json`);
        return announce(downloaded ? "Project exported." : "Project download is unsupported in this browser.");
      }
      if (action === "add-adjustment") {
        const result = engine.addAdjustmentLayer();
        selectedLayerId = result.layerId;
        selectedModifierId = result.modifierId;
        return afterChange("Adjustment layer added.", true);
      }
      if (action === "add-adjustment-modifier" && selection.layer?.type === "adjustment") {
        const result = engine.addAdjustmentModifier(selection.layer.id, { name: `Adjustment ${selection.layer.modifiers.length + 1}` });
        selectedModifierId = result.modifierId;
        return afterChange("Adjustment added to the stack.", true);
      }
      if (action === "add-linked") {
        const assetId = selection.layer?.type === "smart-object" ? selection.layer.assetId : selection.project.assets[0]?.id;
        if (!assetId) return announce("Import an image before creating a linked copy.");
        const result = engine.addSmartObject(assetId, { name: `${selection.layer?.name || "Smart object"} linked` });
        selectedLayerId = result.layerId;
        selectedModifierId = null;
        return afterChange("Linked smart object instance added.", true);
      }
      if (action === "add-filter" && selection.layer?.type === "smart-object") {
        const kind = query("[data-gnd-new-filter]").value;
        const result = engine.addSmartFilter(selection.layer.id, { kind });
        selectedModifierId = result.modifierId;
        return afterChange("Smart filter added.", true);
      }
      if (action === "remove-modifier" && selection.layer && selection.modifier) {
        engine.removeModifier(selection.layer.id, selection.modifier.id);
        selectedModifierId = null;
        return afterChange("Modifier removed.", true);
      }
      if (action === "remove-layer" && selection.layer) {
        const oldIndex = selection.project.layers.findIndex((layer) => layer.id === selection.layer.id);
        engine.removeLayer(selection.layer.id);
        const nextProject = engine.getProject();
        selectedLayerId = nextProject.layers[Math.min(oldIndex, nextProject.layers.length - 1)]?.id || null;
        selectedModifierId = nextProject.layers.find((layer) => layer.id === selectedLayerId)?.modifiers[0]?.id || null;
        return afterChange("Layer removed.", true);
      }
    };

    const onInput = (event) => {
      const { layer, modifier } = currentSelection();
      if (!layer) return;
      let message = "Edit applied.";
      if (event.target.matches("[data-gnd-layer-name]")) engine.updateLayer(layer.id, { name: event.target.value });
      else if (event.target.dataset.gndLayer === "opacity") engine.updateLayer(layer.id, { opacity: event.target.value });
      else if (event.target.dataset.gndFilter === "value" && modifier) engine.updateModifier(layer.id, modifier.id, { value: event.target.value });
      else if (event.target.dataset.gndAdjustment && modifier) engine.updateModifier(layer.id, modifier.id, { settings: { [event.target.dataset.gndAdjustment]: event.target.value } });
      else if (event.target.dataset.gndMask && modifier && event.target.type === "range") engine.updateFilterMask(layer.id, modifier.id, { [event.target.dataset.gndMask]: event.target.value });
      else return;
      const outputKey = event.target.dataset.gndLayer ? `layer-${event.target.dataset.gndLayer}` : event.target.dataset.gndFilter ? `filter-${event.target.dataset.gndFilter}` : event.target.dataset.gndAdjustment ? `adjustment-${event.target.dataset.gndAdjustment}` : `mask-${event.target.dataset.gndMask}`;
      const output = query(`[data-gnd-output="${outputKey}"]`);
      if (output) {
        const definition = event.target.dataset.gndAdjustment ? ADJUSTMENT_DEFINITIONS[event.target.dataset.gndAdjustment] : modifier?.type === "smart-filter" && event.target.dataset.gndFilter ? FILTER_DEFINITIONS[modifier.kind] : { unit: "" };
        output.textContent = `${event.target.value}${definition?.unit || ""}`;
      }
      afterChange(message, false);
    };

    const onChange = (event) => {
      const { layer, modifier } = currentSelection();
      if (event.target.matches("[data-gnd-image-file]")) {
        const file = event.target.files?.[0];
        event.target.value = "";
        return importLocalImage(file, pendingImageMode);
      }
      if (event.target.matches("[data-gnd-project-file]")) {
        const file = event.target.files?.[0];
        event.target.value = "";
        return importProjectFile(file);
      }
      if (!layer) return;
      if (event.target.matches("[data-gnd-layer-name]")) return afterChange("Layer renamed.", true);
      if (event.target.matches("[data-gnd-layer-blend]")) engine.updateLayer(layer.id, { blendMode: event.target.value });
      else if (event.target.matches("[data-gnd-layer-fit]")) engine.updateLayer(layer.id, { fit: event.target.value });
      else if (event.target.matches("[data-gnd-filter-kind]") && modifier) engine.updateModifier(layer.id, modifier.id, { kind: event.target.value });
      else if (event.target.dataset.gndMask && modifier && event.target.type !== "range") engine.updateFilterMask(layer.id, modifier.id, { [event.target.dataset.gndMask]: event.target.type === "checkbox" ? event.target.checked : event.target.value });
      else return;
      afterChange("Edit applied.", true);
    };

    const onKeydown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        const changed = event.shiftKey ? engine.redo() : engine.undo();
        if (changed) afterChange(event.shiftKey ? "Redone." : "Undone.", true);
      } else if (key === "y") {
        event.preventDefault();
        if (engine.redo()) afterChange("Redone.", true);
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeydown);
    if (!storage) startupMessage = "Local storage is unsupported. Export the project to keep this edit.";
    announce(startupMessage);
    persist();
    renderAll();

    const controller = Object.freeze({
      engine,
      getProject: engine.getProject,
      setProject(project) {
        engine.setProject(project);
        const next = engine.getProject();
        selectedLayerId = next.layers[0]?.id || null;
        selectedModifierId = next.layers[0]?.modifiers[0]?.id || null;
        imageCache.clear();
        afterChange("Project loaded.", true);
      },
      render: renderPreview,
      undo() { const changed = engine.undo(); if (changed) afterChange("Undone.", true); return changed; },
      redo() { const changed = engine.redo(); if (changed) afterChange("Redone.", true); return changed; },
      serialize: engine.serialize,
      getCapabilities: () => ({ ...capabilities }),
      unmount() {
        renderRevision += 1;
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.removeEventListener("change", onChange);
        root.removeEventListener("keydown", onKeydown);
        root.replaceChildren();
        root.classList.remove("gnd");
        imageCache.clear();
        instances.delete(root);
      }
    });
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    return true;
  }

  const api = Object.freeze({
    VERSION,
    FORMAT,
    STORAGE_KEY,
    MAX_HISTORY,
    MAX_ASSET_BYTES,
    FILTER_DEFINITIONS,
    ADJUSTMENT_DEFINITIONS,
    MASK_SHAPES,
    ProjectFormatError,
    createDefaultProject,
    normalizeProject,
    normalizeMask,
    addAsset,
    importAsset,
    addSmartObject,
    updateLinkedSmartObject,
    addAdjustmentLayer,
    addAdjustmentModifier,
    addSmartFilter,
    updateLayer,
    updateModifier,
    updateFilterMask,
    setModifierEnabled,
    reorderModifier,
    removeModifier,
    reorderLayer,
    removeLayer,
    serializeProject,
    deserializeProject,
    createEngine,
    compileModifierFilter,
    getCapabilities,
    renderProject,
    mount,
    unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicNondestructive = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
