((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaProjectPhotoStudio = api;
})((globalScope) => {
  "use strict";

  const SCHEMA = "hh.media.project-photo.v1";
  const STORAGE_KEY = SCHEMA;
  const STATE_VERSION = 3;
  const MAX_PHOTO_BYTES = 64 * 1024 * 1024;
  const MAX_SESSION_BYTES = 256 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 32768;
  const MAX_IMAGE_PIXELS = 80 * 1000 * 1000;
  const MAX_PHOTOS = 60;
  const MAX_LAYERS = 120;
  const HISTORY_LIMIT = 80;
  const MAX_HISTORY_BYTES = 3 * 1024 * 1024;
  const MAX_EFFECTS = 24;
  const MAX_BATCH_EXPORTS = 10;
  const MAX_STROKES = 120;
  const MAX_STROKE_POINTS = 512;
  const MAX_TOTAL_STROKE_POINTS = 30000;
  const IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
  const BLEND_MODES = Object.freeze(["source-over", "screen", "lighten", "overlay", "color-dodge", "soft-light", "multiply", "darken"]);
  const EFFECT_TYPES = Object.freeze(["exposure", "contrast", "saturation", "vignette", "grain", "warmth", "fade"]);
  const active = new Map();
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const formatBytes = (value) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : value < 1073741824 ? `${(value / 1048576).toFixed(2)} MB` : `${(value / 1073741824).toFixed(2)} GB`;
  const safeName = (value, fallback = "hh-media") => String(value || fallback).normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;

  function defaultRecipe() {
    return { exposure: 0, contrast: 100, saturation: 100, temperature: 0, blur: 0, grayscale: 0, rotation: 0, flipX: false, flipY: false, quality: 92, format: "image/webp" };
  }

  function normalizeRecipe(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      exposure: clamp(source.exposure, -3, 3), contrast: clamp(source.contrast || 100, 20, 220),
      saturation: clamp(source.saturation || 100, 0, 240), temperature: clamp(source.temperature, -100, 100),
      blur: clamp(source.blur, 0, 12), grayscale: clamp(source.grayscale, 0, 100),
      rotation: [0, 90, 180, 270].includes(Number(source.rotation)) ? Number(source.rotation) : 0,
      flipX: Boolean(source.flipX), flipY: Boolean(source.flipY), quality: clamp(source.quality || 92, 30, 100),
      format: ["image/png", "image/jpeg", "image/webp"].includes(source.format) ? source.format : "image/webp"
    };
  }

  function normalizeTransform(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      x: clamp(source.x, -32768, 32768), y: clamp(source.y, -32768, 32768),
      scaleX: clamp(source.scaleX == null ? 1 : source.scaleX, .05, 16), scaleY: clamp(source.scaleY == null ? 1 : source.scaleY, .05, 16),
      rotation: clamp(source.rotation, -180, 180), flipX: Boolean(source.flipX), flipY: Boolean(source.flipY)
    };
  }

  function normalizeSelection(input) {
    const source = input && typeof input === "object" ? input : {}, type = ["none", "rectangle", "ellipse", "lasso"].includes(source.type) ? source.type : "none";
    return {
      type, x: clamp(source.x, 0, 100), y: clamp(source.y, 0, 100), width: clamp(source.width, 0, 100), height: clamp(source.height, 0, 100),
      points: type === "lasso" && Array.isArray(source.points) ? source.points.slice(0, 2048).map((point) => [clamp(point?.[0], 0, 100), clamp(point?.[1], 0, 100)]) : []
    };
  }

  function selectionHasArea(input) {
    const selection = normalizeSelection(input);
    if (selection.type === "lasso") return selection.points.length >= 3 && new Set(selection.points.map((point) => `${point[0].toFixed(2)},${point[1].toFixed(2)}`)).size >= 3;
    return ["rectangle", "ellipse"].includes(selection.type) && selection.width * selection.height >= .01;
  }

  function normalizeCrop(input) {
    const source = input && typeof input === "object" ? input : {}, x = clamp(source.x, 0, 99.9), y = clamp(source.y, 0, 99.9);
    return {
      enabled: Boolean(source.enabled), x, y, width: clamp(source.width == null ? 100 : source.width, .1, 100 - x), height: clamp(source.height == null ? 100 : source.height, .1, 100 - y),
      aspect: ["free", "1:1", "4:5", "16:9", "3:2"].includes(source.aspect) ? source.aspect : "free"
    };
  }

  function mapSelectionToCrop(selectionInput, cropInput) {
    const selection = normalizeSelection(selectionInput), crop = normalizeCrop(cropInput); if (!crop.enabled || selection.type === "none") return selection;
    const mapPoint = (point) => [clamp((point[0] - crop.x) / crop.width * 100, 0, 100), clamp((point[1] - crop.y) / crop.height * 100, 0, 100)];
    if (selection.type === "lasso") return normalizeSelection({ ...selection, points: selection.points.map(mapPoint) });
    return normalizeSelection({ ...selection, x: (selection.x - crop.x) / crop.width * 100, y: (selection.y - crop.y) / crop.height * 100, width: selection.width / crop.width * 100, height: selection.height / crop.height * 100 });
  }

  function normalizeBrush(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      size: clamp(source.size == null ? 18 : source.size, 1, 240), opacity: clamp(source.opacity == null ? 100 : source.opacity, 1, 100),
      hardness: clamp(source.hardness == null ? 85 : source.hardness, 0, 100), smoothing: clamp(source.smoothing == null ? 55 : source.smoothing, 0, 100),
      color: /^#[0-9a-f]{6}$/i.test(source.color) ? source.color.toLowerCase() : "#ff6bce"
    };
  }

  function normalizeStroke(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      id: String(source.id || uid("stroke")).slice(0, 96), mode: source.mode === "erase" ? "erase" : "paint", brush: normalizeBrush(source.brush),
      points: (Array.isArray(source.points) ? source.points : []).slice(0, MAX_STROKE_POINTS).map((point) => [clamp(point?.[0], 0, 100), clamp(point?.[1], 0, 100), clamp(point?.[2] == null ? 1 : point[2], 0, 1)])
    };
  }

  function normalizeMask(input) {
    const source = input && typeof input === "object" ? input : {}, type = ["none", "selection", "alpha"].includes(source.type) ? source.type : "none";
    return { type, enabled: type !== "none" && source.enabled !== false, inverted: Boolean(source.inverted), feather: clamp(source.feather, 0, 100), selection: normalizeSelection(source.selection) };
  }

  function normalizeEffect(input, index = 0) {
    const source = input && typeof input === "object" ? input : {}, type = EFFECT_TYPES.includes(source.type) ? source.type : "vignette", signed = ["exposure", "contrast", "saturation"].includes(type);
    return { id: String(source.id || uid("effect")).slice(0, 96), name: String(source.name || `${type} ${index + 1}`).slice(0, 120), type, enabled: source.enabled !== false, amount: clamp(source.amount == null ? (signed ? 20 : 30) : source.amount, signed ? -100 : 0, 100) };
  }

  function normalizeEffects(input) {
    const seen = new Set();
    return (Array.isArray(input) ? input : []).slice(0, MAX_EFFECTS).map((effect, index) => normalizeEffect(effect, index)).map((effect) => { if (seen.has(effect.id)) effect.id = uid("effect"); seen.add(effect.id); return effect; });
  }

  function normalizeLayer(input, index = 0, depth = 0) {
    const source = input && typeof input === "object" ? input : {};
    const kind = ["image", "paint", "adjustment", "group"].includes(source.kind) ? source.kind : "image";
    return {
      id: String(source.id || uid("layer")).slice(0, 96), name: String(source.name || `Layer ${index + 1}`).slice(0, 120), kind,
      sourcePhotoId: String(source.sourcePhotoId || "").slice(0, 96), visible: source.visible !== false, locked: Boolean(source.locked),
      opacity: clamp(source.opacity == null ? 100 : source.opacity, 0, 100), blendMode: BLEND_MODES.includes(source.blendMode) ? source.blendMode : "source-over",
      transform: normalizeTransform(source.transform), mask: normalizeMask(source.mask), clippingToBelow: Boolean(source.clippingToBelow),
      strokes: kind === "paint" ? (Array.isArray(source.strokes) ? source.strokes : []).slice(-MAX_STROKES).map(normalizeStroke).filter((stroke) => stroke.points.length) : [],
      children: kind === "group" && depth < 3 && Array.isArray(source.children) ? source.children.slice(0, MAX_LAYERS).map((child, childIndex) => normalizeLayer(child, childIndex, depth + 1)) : []
    };
  }

  function normalizeLayers(input) {
    const seen = new Set(); let remaining = MAX_LAYERS, strokePointsRemaining = MAX_TOTAL_STROKE_POINTS;
    const visit = (layerInput, index, depth) => {
      if (remaining <= 0) return null; remaining -= 1;
      const raw = layerInput && typeof layerInput === "object" ? layerInput : {}, layer = normalizeLayer({ ...raw, children: [] }, index, depth);
      if (seen.has(layer.id)) layer.id = uid("layer"); seen.add(layer.id);
      layer.strokes = layer.strokes.map((stroke) => { if (strokePointsRemaining <= 0) return null; const points = stroke.points.slice(0, strokePointsRemaining); strokePointsRemaining -= points.length; return { ...stroke, points }; }).filter(Boolean);
      if (layer.kind === "group" && depth < 3 && Array.isArray(raw.children)) layer.children = raw.children.map((child, childIndex) => visit(child, childIndex, depth + 1)).filter(Boolean);
      return layer;
    };
    return (Array.isArray(input) ? input : []).slice(0, MAX_LAYERS).map((layer, index) => visit(layer, index, 0)).filter(Boolean);
  }

  function photoDocument(state) {
    return {
      recipe: normalizeRecipe(state?.recipe), layers: normalizeLayers(state?.layers), selectedLayerId: String(state?.selectedLayerId || ""),
      selectedPhotoId: String(state?.selectedPhotoId || ""), selection: normalizeSelection(state?.selection), crop: normalizeCrop(state?.crop), straighten: clamp(state?.straighten, -15, 15),
      effects: normalizeEffects(state?.effects), brush: normalizeBrush(state?.brush), photoTool: ["move", "rectangle", "ellipse", "lasso", "crop", "brush", "eraser", "magic"].includes(state?.photoTool) ? state.photoTool : "move"
    };
  }

  function normalizeHistory(input) {
    const source = input && typeof input === "object" ? input : {};
    const entries = (rows) => (Array.isArray(rows) ? rows : []).slice(-HISTORY_LIMIT).map((entry) => ({
      id: String(entry?.id || uid("history")).slice(0, 96), label: String(entry?.label || "Chỉnh sửa").slice(0, 120), createdAt: String(entry?.createdAt || now()), snapshot: photoDocument(entry?.snapshot || {})
    }));
    let budget = MAX_HISTORY_BYTES;
    const bounded = (rows) => { const kept = []; for (let index = rows.length - 1; index >= 0; index -= 1) { const bytes = JSON.stringify(rows[index]).length * 2; if (bytes > budget) continue; kept.push(rows[index]); budget -= bytes; } return kept.reverse(); };
    const undo = bounded(entries(source.undo)), redo = bounded(entries(source.redo));
    return { undo, redo };
  }

  function defaultState() {
    return {
      schema: SCHEMA, version: STATE_VERSION, projectTab: "overview", graphFilter: "all", selectedNode: "",
      photoTab: "develop", photoView: "fit", recipe: defaultRecipe(), selectedPhotoId: "",
      layers: [], selectedLayerId: "", selection: normalizeSelection(), crop: normalizeCrop(), straighten: 0, effects: [], brush: normalizeBrush(), photoTool: "move", batchPhotoIds: [], compareMode: "off", history: { undo: [], redo: [] },
      snapshots: [], recentProjects: [], lastSavedAt: "", updatedAt: now()
    };
  }

  function normalizeState(input) {
    const base = defaultState(), source = input && typeof input === "object" ? input : {};
    return {
      ...base, ...source, schema: SCHEMA, version: STATE_VERSION,
      projectTab: ["overview", "graph", "versions", "activity"].includes(source.projectTab) ? source.projectTab : "overview",
      photoTab: ["develop", "lighttable", "history", "export"].includes(source.photoTab) ? source.photoTab : "develop",
      recipe: normalizeRecipe(source.recipe), layers: normalizeLayers(source.layers), selectedLayerId: String(source.selectedLayerId || "").slice(0, 96),
      selection: normalizeSelection(source.selection), crop: normalizeCrop(source.crop), straighten: clamp(source.straighten, -15, 15), effects: normalizeEffects(source.effects), brush: normalizeBrush(source.brush),
      photoTool: ["move", "rectangle", "ellipse", "lasso", "crop", "brush", "eraser", "magic"].includes(source.photoTool) ? source.photoTool : "move",
      batchPhotoIds: [...new Set((Array.isArray(source.batchPhotoIds) ? source.batchPhotoIds : []).map((id) => String(id).slice(0, 96)))].slice(0, MAX_BATCH_EXPORTS), compareMode: source.compareMode === "split" ? "split" : "off", history: normalizeHistory(source.history),
      snapshots: (Array.isArray(source.snapshots) ? source.snapshots : []).slice(-60).map((item, index) => ({
        id: String(item?.id || uid("snapshot")).slice(0, 96), name: String(item?.name || `Snapshot ${index + 1}`).slice(0, 120),
        photoId: String(item?.photoId || "").slice(0, 96), photoName: String(item?.photoName || "Ảnh").slice(0, 240), recipe: normalizeRecipe(item?.recipe),
        ...(item?.document ? { document: photoDocument(item.document) } : {}), createdAt: String(item?.createdAt || now())
      })),
      recentProjects: Array.isArray(source.recentProjects) ? source.recentProjects.slice(-12) : [], updatedAt: now()
    };
  }

  function restorePhotoDocument(stateInput, snapshot) {
    const state = normalizeState(stateInput), documentState = photoDocument(snapshot);
    return normalizeState({ ...state, ...documentState, history: state.history });
  }

  function mutatePhotoState(stateInput, label, mutation) {
    const state = normalizeState(stateInput), before = photoDocument(state), draft = clone(state);
    mutation?.(draft);
    let next = normalizeState({ ...draft, history: state.history });
    if (JSON.stringify(photoDocument(next)) === JSON.stringify(before)) return state;
    next.history = normalizeHistory({ undo: [...state.history.undo, { id: uid("history"), label, createdAt: now(), snapshot: before }], redo: [] });
    return next;
  }

  function undoPhotoState(stateInput) {
    const state = normalizeState(stateInput), entry = state.history.undo.at(-1);
    if (!entry) return state;
    const current = photoDocument(state), next = restorePhotoDocument(state, entry.snapshot);
    next.history = normalizeHistory({ undo: state.history.undo.slice(0, -1), redo: [...state.history.redo, { id: uid("history"), label: entry.label, createdAt: now(), snapshot: current }] });
    return next;
  }

  function redoPhotoState(stateInput) {
    const state = normalizeState(stateInput), entry = state.history.redo.at(-1);
    if (!entry) return state;
    const current = photoDocument(state), next = restorePhotoDocument(state, entry.snapshot);
    next.history = normalizeHistory({ undo: [...state.history.undo, { id: uid("history"), label: entry.label, createdAt: now(), snapshot: current }], redo: state.history.redo.slice(0, -1) });
    return next;
  }

  function addLayer(stateInput, input = {}) {
    return mutatePhotoState(stateInput, "Thêm layer", (draft) => {
      if (draft.layers.length >= MAX_LAYERS) return;
      const layer = normalizeLayer({ ...input, id: input.id || uid("layer") }, draft.layers.length);
      draft.layers.push(layer); draft.selectedLayerId = layer.id; if (layer.sourcePhotoId) draft.selectedPhotoId = layer.sourcePhotoId;
    });
  }

  function updateLayer(stateInput, id, patch = {}, label = "Cập nhật layer") {
    return mutatePhotoState(stateInput, label, (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === id); if (index < 0) return;
      const layer = draft.layers[index], keys = Object.keys(patch), mayEditLocked = keys.every((key) => ["locked", "visible"].includes(key));
      if (layer.locked && !mayEditLocked) return;
      draft.layers[index] = normalizeLayer({ ...layer, ...patch, id: layer.id }, index);
    });
  }

  function deleteLayer(stateInput, id) {
    return mutatePhotoState(stateInput, "Xóa layer", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === id); if (index < 0 || draft.layers[index].locked) return;
      draft.layers.splice(index, 1); draft.selectedLayerId = draft.layers[Math.min(index, draft.layers.length - 1)]?.id || "";
    });
  }

  function reorderLayer(stateInput, id, targetIndex) {
    return mutatePhotoState(stateInput, "Sắp xếp layer", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === id); if (index < 0 || draft.layers[index].locked) return;
      const to = Math.round(clamp(targetIndex, 0, Math.max(0, draft.layers.length - 1))); if (to === index) return;
      const [layer] = draft.layers.splice(index, 1); draft.layers.splice(to, 0, layer);
    });
  }

  function cloneLayerTree(layer) {
    const duplicate = normalizeLayer({ ...clone(layer), id: uid("layer"), name: `${layer.name} bản sao`, locked: false });
    duplicate.children = duplicate.children.map(cloneLayerTree); return duplicate;
  }

  function duplicateLayer(stateInput, id) {
    return mutatePhotoState(stateInput, "Nhân bản layer", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === id); if (index < 0 || draft.layers.length >= MAX_LAYERS) return;
      const copy = cloneLayerTree(draft.layers[index]); draft.layers.splice(index + 1, 0, copy); draft.selectedLayerId = copy.id;
    });
  }

  function mergeLayerDown(stateInput, id) {
    return mutatePhotoState(stateInput, "Gộp layer", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === id); if (index <= 0 || draft.layers[index].locked || draft.layers[index - 1].locked) return;
      const lower = draft.layers[index - 1], upper = draft.layers[index];
      const merged = normalizeLayer({ id: uid("layer"), name: `${lower.name} + ${upper.name}`, kind: "group", children: [lower, upper] }, index - 1);
      draft.layers.splice(index - 1, 2, merged); draft.selectedLayerId = merged.id;
    });
  }

  function addEffect(stateInput, type) {
    return mutatePhotoState(stateInput, "Thêm hiệu ứng", (draft) => {
      if (draft.effects.length >= MAX_EFFECTS || !EFFECT_TYPES.includes(type)) return;
      draft.effects.push(normalizeEffect({ id: uid("effect"), type }, draft.effects.length));
    });
  }

  function updateEffect(stateInput, id, patch = {}, label = "Điều chỉnh hiệu ứng") {
    return mutatePhotoState(stateInput, label, (draft) => {
      const index = draft.effects.findIndex((effect) => effect.id === id); if (index < 0) return;
      draft.effects[index] = normalizeEffect({ ...draft.effects[index], ...patch, id: draft.effects[index].id }, index);
    });
  }

  function deleteEffect(stateInput, id) {
    return mutatePhotoState(stateInput, "Xóa hiệu ứng", (draft) => { const index = draft.effects.findIndex((effect) => effect.id === id); if (index >= 0) draft.effects.splice(index, 1); });
  }

  function reorderEffect(stateInput, id, targetIndex) {
    return mutatePhotoState(stateInput, "Sắp xếp hiệu ứng", (draft) => {
      const index = draft.effects.findIndex((effect) => effect.id === id); if (index < 0) return;
      const to = Math.round(clamp(targetIndex, 0, Math.max(0, draft.effects.length - 1))); if (to === index) return;
      const [effect] = draft.effects.splice(index, 1); draft.effects.splice(to, 0, effect);
    });
  }

  function cropRect(width, height, cropInput) {
    const crop = normalizeCrop(cropInput); if (!crop.enabled) return { x: 0, y: 0, width, height };
    const x = Math.min(width - 1, Math.round(width * crop.x / 100)), y = Math.min(height - 1, Math.round(height * crop.y / 100));
    return { x, y, width: Math.max(1, Math.min(width - x, Math.round(width * crop.width / 100))), height: Math.max(1, Math.min(height - y, Math.round(height * crop.height / 100))) };
  }

  function applyCropAspect(cropInput, aspect, canvasRatio = 1) {
    const crop = normalizeCrop({ ...cropInput, enabled: true, aspect }); if (aspect === "free") return crop;
    const [wide, high] = aspect.split(":").map(Number), target = wide / high / Math.max(.0001, Number(canvasRatio) || 1);
    let width = crop.width, height = crop.height;
    if (width / height > target) width = height * target; else height = width / target;
    return normalizeCrop({ ...crop, width, height, x: Math.min(crop.x, 100 - width), y: Math.min(crop.y, 100 - height) });
  }

  function createBatchExportPlan(photosInput, selectedIdsInput, recipeInput, capabilitiesInput) {
    const photos = Array.isArray(photosInput) ? photosInput : [], ids = [...new Set(Array.isArray(selectedIdsInput) ? selectedIdsInput.map(String) : [])], recipe = normalizeRecipe(recipeInput), capabilities = capabilitiesInput || photoCapabilities();
    const items = ids.slice(0, MAX_BATCH_EXPORTS).map((id) => photos.find((photo) => String(photo?.id) === id)).filter(Boolean).map((photo) => ({ id: photo.id, name: String(photo.name || "photo"), size: Number(photo.file?.size || photo.size || 0), width: Number(photo.width || 0), height: Number(photo.height || 0) }));
    const blockers = [], warnings = [];
    if (!items.length) blockers.push("Chưa chọn ảnh để xuất batch.");
    if (ids.length > MAX_BATCH_EXPORTS) blockers.push(`Mỗi batch tối đa ${MAX_BATCH_EXPORTS} ảnh.`);
    if (items.length !== Math.min(ids.length, MAX_BATCH_EXPORTS)) blockers.push("Một số ảnh batch không còn trong Lighttable; hãy chọn lại.");
    if (capabilities.formats?.[recipe.format] === "unavailable") blockers.push(`Trình duyệt không có bộ mã hóa ${recipe.format}.`);
    if (recipe.format === "image/jpeg") warnings.push("JPEG không giữ kênh alpha; vùng trong suốt sẽ được làm phẳng.");
    items.forEach((item) => { if (item.width > MAX_IMAGE_EDGE || item.height > MAX_IMAGE_EDGE || item.width * item.height > MAX_IMAGE_PIXELS) blockers.push(`${item.name} vượt giới hạn kích thước an toàn.`); });
    return { valid: blockers.length === 0, requestedType: recipe.format, items, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
  }

  function createStore(storage) {
    const target = storage || globalScope.localStorage;
    return {
      load() { try { return normalizeState(JSON.parse(target?.getItem?.(STORAGE_KEY) || "{}")); } catch (_) { return defaultState(); } },
      save(value) { const next = normalizeState(value); try { target?.setItem?.(STORAGE_KEY, JSON.stringify(next)); } catch (_) {} return next; }
    };
  }

  function recipeFilter(recipeInput) {
    const recipe = normalizeRecipe(recipeInput);
    const brightness = Math.round(100 * (2 ** recipe.exposure));
    const hue = Math.round(recipe.temperature * -0.16);
    return `brightness(${brightness}%) contrast(${recipe.contrast}%) saturate(${recipe.saturation}%) hue-rotate(${hue}deg) blur(${recipe.blur}px) grayscale(${recipe.grayscale}%)`;
  }

  function calculateHistogram(pixels, bins = 32) {
    const result = { red: Array(bins).fill(0), green: Array(bins).fill(0), blue: Array(bins).fill(0), luminance: Array(bins).fill(0), samples: 0 };
    if (!pixels?.length) return result;
    const step = Math.max(4, Math.ceil(pixels.length / 200000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += step) {
      const r = pixels[index] || 0, g = pixels[index + 1] || 0, b = pixels[index + 2] || 0;
      result.red[Math.min(bins - 1, Math.floor(r / 256 * bins))] += 1;
      result.green[Math.min(bins - 1, Math.floor(g / 256 * bins))] += 1;
      result.blue[Math.min(bins - 1, Math.floor(b / 256 * bins))] += 1;
      result.luminance[Math.min(bins - 1, Math.floor((.2126 * r + .7152 * g + .0722 * b) / 256 * bins))] += 1;
      result.samples += 1;
    }
    return result;
  }

  function histogramPath(values, width = 300, height = 86) {
    const max = Math.max(1, ...values);
    return values.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(1, values.length - 1) * width).toFixed(1)},${(height - value / max * height).toFixed(1)}`).join(" ");
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function checksum(file) {
    if (globalScope.crypto?.subtle && file?.arrayBuffer) {
      const digest = await globalScope.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    return `${file?.name || "asset"}-${file?.size || 0}-${file?.lastModified || 0}`;
  }

  function detectImageType(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8")) return "image/gif";
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)))) return "image/avif";
    return "";
  }

  function detectImageDimensions(input, type) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0), be32 = (index) => bytes[index] * 0x1000000 + bytes[index + 1] * 0x10000 + bytes[index + 2] * 0x100 + bytes[index + 3], le16 = (index) => bytes[index] + bytes[index + 1] * 0x100;
    if (type === "image/png" && bytes.length >= 24) return { width: be32(16), height: be32(20) };
    if (type === "image/gif" && bytes.length >= 10) return { width: le16(6), height: le16(8) };
    if (type === "image/jpeg") {
      for (let index = 2; index + 8 < bytes.length;) {
        if (bytes[index] !== 0xff) { index += 1; continue; }
        const marker = bytes[index + 1], length = (bytes[index + 2] << 8) + bytes[index + 3];
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { height: (bytes[index + 5] << 8) + bytes[index + 6], width: (bytes[index + 7] << 8) + bytes[index + 8] };
        index += marker === 0xd8 || marker === 0xd9 ? 2 : Math.max(2, length + 2);
      }
    }
    if (type === "image/webp" && bytes.length >= 30) {
      const chunk = String.fromCharCode(...bytes.slice(12, 16));
      if (chunk === "VP8X") return { width: 1 + bytes[24] + bytes[25] * 0x100 + bytes[26] * 0x10000, height: 1 + bytes[27] + bytes[28] * 0x100 + bytes[29] * 0x10000 };
      if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
      if (chunk === "VP8L" && bytes[20] === 0x2f) { const bits = bytes[21] + bytes[22] * 0x100 + bytes[23] * 0x10000 + bytes[24] * 0x1000000; return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
    }
    if (type === "image/avif") {
      for (let index = 4; index + 16 < bytes.length; index += 1) if (String.fromCharCode(...bytes.slice(index, index + 4)) === "ispe") return { width: be32(index + 8), height: be32(index + 12) };
    }
    return null;
  }

  function dimensionsAreSafe(dimensions) {
    if (!dimensions) return true;
    const width = Number(dimensions.width || 0), height = Number(dimensions.height || 0);
    return width > 0 && height > 0 && width <= MAX_IMAGE_EDGE && height <= MAX_IMAGE_EDGE && width * height <= MAX_IMAGE_PIXELS;
  }

  async function validateImageFile(file, options = {}) {
    const maxBytes = clamp(options.maxBytes || MAX_PHOTO_BYTES, 1024, MAX_PHOTO_BYTES), name = String(file?.name || "").slice(0, 240), size = Number(file?.size || 0), claimedType = String(file?.type || "").toLowerCase();
    if (!file || typeof file.slice !== "function") return { valid: false, code: "invalid-file", error: "Tệp không hợp lệ." };
    if (!size) return { valid: false, code: "empty-file", error: `${name || "Ảnh"} đang trống.` };
    if (size > maxBytes) return { valid: false, code: "file-too-large", error: `${name || "Ảnh"} vượt giới hạn ${formatBytes(maxBytes)}.` };
    if (claimedType === "image/svg+xml" || /\.svgz?$/i.test(name)) return { valid: false, code: "unsafe-vector", error: "SVG không được nhập trực tiếp vì có thể chứa mã thực thi. Hãy xuất PNG/WebP trước." };
    let detectedType = "", dimensions = null;
    try { const header = new Uint8Array(await file.slice(0, Math.min(size, 65536)).arrayBuffer()); detectedType = detectImageType(header); dimensions = detectImageDimensions(header, detectedType); } catch (_) { return { valid: false, code: "unreadable", error: `Không thể kiểm tra chữ ký của ${name || "ảnh"}.` }; }
    if (!detectedType || !IMAGE_TYPES.includes(detectedType)) return { valid: false, code: "unsupported-signature", error: `${name || "Ảnh"} không có chữ ký định dạng ảnh được hỗ trợ.` };
    if (claimedType && claimedType !== "application/octet-stream" && claimedType !== detectedType) return { valid: false, code: "mime-mismatch", error: `${name || "Ảnh"} có MIME không khớp nội dung thật.` };
    if (!dimensionsAreSafe(dimensions)) return { valid: false, code: "unsafe-dimensions", error: `${name || "Ảnh"} vượt giới hạn ${MAX_IMAGE_EDGE}px hoặc ${MAX_IMAGE_PIXELS / 1000000} megapixel.` };
    return { valid: true, code: "ok", name: name || `photo.${detectedType.split("/")[1]}`, size, type: detectedType, width: dimensions?.width || 0, height: dimensions?.height || 0 };
  }

  function photoCapabilities(scope = globalScope, adapters = {}) {
    const canvas = Boolean(scope?.document?.createElement || scope?.OffscreenCanvas);
    return {
      canvas, imageBitmap: typeof scope?.createImageBitmap === "function", offscreenCanvas: typeof scope?.OffscreenCanvas === "function",
      formats: { "image/png": canvas ? "required" : "unavailable", "image/jpeg": canvas ? "verify-on-export" : "unavailable", "image/webp": canvas ? "verify-on-export" : "unavailable" },
      magicSelect: typeof adapters?.magicSelect === "function" ? "adapter-ready" : "unavailable", backgroundRemoval: typeof adapters?.backgroundRemoval === "function" ? "adapter-ready" : "external-workspace",
      maskSelection: canvas ? "local" : "unavailable", clippingMask: canvas ? "local" : "unavailable", brush: canvas ? "local" : "unavailable",
      maxImportBytes: MAX_PHOTO_BYTES, maxPhotos: MAX_PHOTOS, maxLayers: MAX_LAYERS, maxBatchExports: MAX_BATCH_EXPORTS
    };
  }

  async function encodeSurface(surface, requestedType, quality) {
    const type = ["image/png", "image/jpeg", "image/webp"].includes(requestedType) ? requestedType : "image/png";
    let blob;
    if (surface?.convertToBlob) blob = await surface.convertToBlob({ type, quality: clamp(quality, 0, 1) });
    else if (surface?.toBlob) blob = await new Promise((resolve, reject) => surface.toBlob((value) => value ? resolve(value) : reject(new Error("Không thể tạo file ảnh.")), type, clamp(quality, 0, 1)));
    else throw new Error("Trình duyệt không cung cấp bộ mã hóa Canvas.");
    const actualType = String(blob.type || "image/png").toLowerCase();
    return { blob, requestedType: type, actualType, fallback: actualType !== type };
  }

  function projectHealth(projectState, api) {
    return api?.calculateHealth?.(projectState) || { score: 100, status: "healthy", blockers: [], warnings: [], splitTotal: 100 };
  }

  function projectTabs(state) {
    return `<nav class="mpp-tabs" aria-label="Chế độ Project Core">${[["overview", "Tổng quan"], ["graph", "Media Graph"], ["versions", "Phiên bản"], ["activity", "Hoạt động"]].map(([id, label]) => `<button type="button" data-mpp-project-tab="${id}" class="${state.projectTab === id ? "is-active" : ""}">${label}</button>`).join("")}</nav>`;
  }

  function graphMarkup(projectState, state) {
    const nodes = (projectState.project.graph.nodes || []).slice(-28), edges = projectState.project.graph.edges || [];
    const filtered = state.graphFilter === "all" ? nodes : nodes.filter((node) => node.type === state.graphFilter || node.type === "project");
    return `<section class="mpp-graph-deck"><header><div><small>IDENTITY-BASED LINEAGE</small><h3>Media Graph · ${filtered.length} node</h3></div><label>Lọc<select data-mpp-graph-filter><option value="all">Tất cả</option><option value="project" ${state.graphFilter === "project" ? "selected" : ""}>Project</option><option value="asset" ${state.graphFilter === "asset" ? "selected" : ""}>Asset</option></select></label></header><div class="mpp-graph-stage">${filtered.map((node, index) => `<button type="button" data-mpp-node="${escapeHtml(node.id)}" class="${state.selectedNode === node.id ? "is-active" : ""}" data-kind="${escapeHtml(node.type || "asset")}" style="--x:${12 + (index % 5) * 19}%;--y:${16 + Math.floor(index / 5) * 22}%"><i>${node.type === "project" ? "UP" : "A"}</i><span>${escapeHtml(node.label || node.name || node.id)}</span></button>`).join("") || "<p>Graph đang trống.</p>"}<div class="mpp-graph-flow" aria-hidden="true"></div></div><footer><span>${edges.length} quan hệ</span><span>ID ổn định · relink không đổi lineage</span><button type="button" data-mpp-import-assets>＋ Ingest asset</button></footer></section>`;
  }

  function projectPanel(projectState, state, api, storageInfo) {
    const health = projectHealth(projectState, api), audit = (projectState.review.audit || []).slice(-18).reverse();
    if (state.projectTab === "graph") return graphMarkup(projectState, state);
    if (state.projectTab === "versions") return `<section class="mpp-version-grid"><article><header><small>BRANCHES</small><h3>${projectState.project.branches.length} nhánh</h3></header><form data-mpp-branch-form><input name="name" maxlength="80" placeholder="Tên nhánh thử nghiệm" required><button>Tạo nhánh</button></form><div>${projectState.project.branches.slice().reverse().map((branch) => `<button type="button" data-mpp-branch="${escapeHtml(branch.id)}" class="${branch.id === projectState.project.activeBranchId ? "is-active" : ""}"><i>⌘</i><span><strong>${escapeHtml(branch.name)}</strong><small>${escapeHtml(branch.head || "Chưa checkpoint")}</small></span></button>`).join("")}</div></article><article><header><small>CHECKPOINTS</small><h3>${projectState.project.checkpoints.length} phiên bản</h3></header><button type="button" class="is-primary" data-mpp-checkpoint>Tạo checkpoint an toàn</button><div>${projectState.project.checkpoints.slice().reverse().map((point) => `<button type="button" data-mpp-checkpoint-id="${escapeHtml(point.id)}"><i>◇</i><span><strong>${escapeHtml(point.label)}</strong><small>${new Date(point.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(point.graphHash)}</small></span></button>`).join("") || "<p>Chưa có checkpoint.</p>"}</div></article></section>`;
    if (state.projectTab === "activity") return `<section class="mpp-activity"><header><div><small>IMMUTABLE ACTIVITY</small><h3>Audit log trên thiết bị</h3></div><button type="button" data-mpp-export-manifest>Xuất manifest</button></header><div>${audit.map((item) => `<article><i></i><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail || "Thay đổi dữ liệu dự án")}</p><small>${escapeHtml(item.actor || "local-owner")} · ${new Date(item.createdAt).toLocaleString("vi-VN")}</small></div></article>`).join("")}</div></section>`;
    const issues = [...health.blockers, ...health.warnings];
    return `<section class="mpp-overview-grid"><article class="mpp-command-card"><header><small>NEXT BEST ACTION</small><b data-status="${health.status}">${health.status === "healthy" ? "READY" : "ATTENTION"}</b></header><h3>${health.status === "healthy" ? "Tạo checkpoint trước phiên chỉnh sửa mới" : "Xử lý cảnh báo trước khi xuất bản"}</h3><p>${issues[0]?.message || "Project đang nhất quán. Checkpoint giúp bảo toàn graph và nhánh hiện tại."}</p><div><button type="button" class="is-primary" data-mpp-checkpoint>◇ Checkpoint</button><button type="button" data-mpp-project-tab="graph">Mở graph</button></div></article><article class="mpp-health-card"><div class="mpp-health-ring" style="--score:${health.score}"><strong>${health.score}</strong><span>/100</span></div><div><small>PROJECT HEALTH</small><h3>${issues.length ? `${issues.length} mục cần xem` : "Không có blocker"}</h3><p>${health.blockers.length} blocker · ${health.warnings.length} cảnh báo</p></div></article><article class="mpp-storage-card"><small>LOCAL STORAGE</small><h3>${storageInfo.usageLabel}</h3><p>${storageInfo.quotaLabel} khả dụng · ${storageInfo.persistent}</p><i style="--used:${storageInfo.percent}%"></i></article><article class="mpp-pipeline-card"><header><small>PRODUCTION PIPELINE</small><span>${projectState.assets.items.length} asset</span></header><div><b>INGEST</b><i></i><b>ORGANIZE</b><i></i><b>EDIT</b><i></i><b>REVIEW</b><i></i><b>DELIVER</b></div><footer><button type="button" data-mpp-import-assets>＋ Import</button><button type="button" data-mpp-route="/media-design/review-studio">Review</button><button type="button" data-mpp-route="/media-design/export-workspace">Delivery</button></footer></article><article class="mpp-recent-card"><header><small>RECENT ACTIVITY</small><button type="button" data-mpp-project-tab="activity">Xem tất cả</button></header>${audit.slice(0, 5).map((item) => `<p><i></i><span><strong>${escapeHtml(item.action)}</strong><small>${new Date(item.createdAt).toLocaleTimeString("vi-VN")}</small></span></p>`).join("")}</article></section>`;
  }

  function projectMarkup(projectState, state, api, storageInfo) {
    const health = projectHealth(projectState, api);
    return `<section class="media-project-photo-studio is-project" data-mpp data-workspace="media-core"><header class="mpp-toolbar"><div><span>UP</span><label><small>PROJECT NAME</small><input data-mpp-project-name maxlength="140" value="${escapeHtml(projectState.project.name)}"></label></div><div class="mpp-toolbar-status"><span><i></i> Autosave ${state.lastSavedAt ? new Date(state.lastSavedAt).toLocaleTimeString("vi-VN") : "sẵn sàng"}</span><b data-status="${health.status}">${health.score}/100</b><button type="button" data-mpp-export-manifest>⇩ Manifest</button><button type="button" data-mpp-checkpoint>◇ Checkpoint</button></div></header>${projectTabs(state)}<main>${projectPanel(projectState, state, api, storageInfo)}</main><input type="file" data-mpp-project-files multiple hidden accept="image/*,video/*,audio/*,.pdf,.svg,.json"></section>`;
  }

  function photoTabs(state, photos) {
    return `<nav class="mpp-photo-tabs" aria-label="Quy trình Photo & Image">${[["develop", `Develop · ${state.layers.length} layer`], ["lighttable", `Lighttable · ${photos.length}`], ["history", `History · ${state.history.undo.length}`], ["export", "Export"]].map(([id, label]) => `<button type="button" data-mpp-photo-tab="${id}" class="${state.photoTab === id ? "is-active" : ""}">${label}</button>`).join("")}</nav>`;
  }

  function effectStackMarkup(state) {
    const labels = { exposure: "Phơi sáng", contrast: "Tương phản", saturation: "Bão hòa", vignette: "Vignette", grain: "Hạt phim", warmth: "Ánh ấm", fade: "Fade" };
    return `<section class="mpp-effect-stack"><header><small>ADJUSTMENT & EFFECT STACK</small><label>＋<select data-mpp-add-effect aria-label="Thêm hiệu ứng"><option value="">Thêm…</option>${EFFECT_TYPES.map((type) => `<option value="${type}">${labels[type]}</option>`).join("")}</select></label></header><div>${state.effects.map((effect, index) => `<article class="${effect.enabled ? "is-enabled" : ""}"><button type="button" data-mpp-effect-toggle="${escapeHtml(effect.id)}" aria-pressed="${effect.enabled}" title="Bật/tắt">${effect.enabled ? "◉" : "○"}</button><span><strong>${labels[effect.type]}</strong><input type="range" min="${["exposure", "contrast", "saturation"].includes(effect.type) ? -100 : 0}" max="100" value="${effect.amount}" data-mpp-effect-amount="${escapeHtml(effect.id)}" aria-label="Mức ${labels[effect.type]}"><small>${effect.amount}</small></span><i><button type="button" data-mpp-effect-move="${escapeHtml(effect.id)}" data-direction="up" ${index <= 0 ? "disabled" : ""}>↑</button><button type="button" data-mpp-effect-move="${escapeHtml(effect.id)}" data-direction="down" ${index >= state.effects.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-mpp-effect-delete="${escapeHtml(effect.id)}" aria-label="Xóa ${labels[effect.type]}">×</button></i></article>`).join("") || "<p>Chưa có hiệu ứng. Stack được áp dụng tuần tự và không ghi đè ảnh nguồn.</p>"}</div></section>`;
  }

  function recipeControls(state, capabilities = photoCapabilities()) {
    const recipe = state.recipe;
    const range = (name, label, min, max, value, unit = "") => `<label><span>${label}<b data-mpp-value="${name}">${value}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${name === "exposure" ? ".1" : "1"}" value="${value}" data-mpp-recipe="${name}"></label>`;
    const tools = [["move", "Di chuyển", "↖"], ["rectangle", "Chọn chữ nhật", "▭"], ["ellipse", "Chọn ellipse", "◯"], ["lasso", "Chọn lasso", "⌁"], ["crop", "Crop", "⌗"], ["brush", "Cọ", "✎"], ["eraser", "Tẩy", "⌫"], ["magic", "Magic Select", "✦"]];
    const brush = state.brush, crop = state.crop;
    return `<div class="mpp-adjustments" data-mpp-scroll="adjustments"><header><small>NON-DESTRUCTIVE RECIPE</small><button type="button" data-mpp-reset-recipe>Đặt lại</button></header><div class="mpp-tool-row" role="toolbar" aria-label="Công cụ ảnh">${tools.map(([id, label, icon]) => { const disabled = id === "magic" && capabilities.magicSelect !== "adapter-ready"; return `<button type="button" data-mpp-tool="${id}" class="${state.photoTool === id ? "is-active" : ""}" aria-pressed="${state.photoTool === id}" title="${disabled ? "Cần adapter phân đoạn được cấu hình; không có kết quả giả" : label}" ${disabled ? "disabled" : ""}><i>${icon}</i><span>${label}</span></button>`; }).join("")}</div>${capabilities.magicSelect !== "adapter-ready" ? `<p class="mpp-capability-note"><b>Magic Select:</b> chưa có engine phân đoạn; rectangle, ellipse và lasso vẫn chạy local.</p>` : ""}${state.selection.type !== "none" ? `<button type="button" class="mpp-clear-selection" data-mpp-clear-selection>Xóa vùng chọn ${state.selection.type}</button>` : ""}${state.photoTool === "crop" || crop.enabled ? `<section class="mpp-crop-controls"><header><strong>Crop & Straighten</strong><button type="button" data-mpp-reset-crop ${crop.enabled || state.straighten ? "" : "disabled"}>Đặt lại</button></header><div>${["free", "1:1", "4:5", "16:9", "3:2"].map((aspect) => `<button type="button" data-mpp-crop-aspect="${aspect}" class="${crop.aspect === aspect ? "is-active" : ""}">${aspect === "free" ? "Tự do" : aspect}</button>`).join("")}</div><label><span>Straighten<b>${state.straighten}°</b></span><input type="range" min="-15" max="15" step=".1" value="${state.straighten}" data-mpp-straighten></label></section>` : ""}${["brush", "eraser"].includes(state.photoTool) ? `<section class="mpp-brush-controls"><header><strong>${state.photoTool === "eraser" ? "Đầu tẩy" : "Brush"}</strong><input type="color" value="${brush.color}" data-mpp-brush="color" ${state.photoTool === "eraser" ? "disabled" : ""} aria-label="Màu cọ"></header><label><span>Kích thước<b>${brush.size}px</b></span><input type="range" min="1" max="240" value="${brush.size}" data-mpp-brush="size"></label><label><span>Opacity<b>${brush.opacity}%</b></span><input type="range" min="1" max="100" value="${brush.opacity}" data-mpp-brush="opacity"></label><label><span>Hardness<b>${brush.hardness}%</b></span><input type="range" min="0" max="100" value="${brush.hardness}" data-mpp-brush="hardness"></label><label><span>Smoothing<b>${brush.smoothing}%</b></span><input type="range" min="0" max="100" value="${brush.smoothing}" data-mpp-brush="smoothing"></label></section>` : ""}${range("exposure", "Exposure", -3, 3, recipe.exposure, " EV")}${range("contrast", "Contrast", 20, 220, recipe.contrast, "%")}${range("saturation", "Saturation", 0, 240, recipe.saturation, "%")}${range("temperature", "Temperature", -100, 100, recipe.temperature)}${range("blur", "Blur", 0, 12, recipe.blur, "px")}${range("grayscale", "Grayscale", 0, 100, recipe.grayscale, "%")}<div class="mpp-transform-row"><button type="button" data-mpp-transform="rotate">↻ Xoay</button><button type="button" data-mpp-transform="flipX">↔ Lật ngang</button><button type="button" data-mpp-transform="flipY">↕ Lật dọc</button></div>${effectStackMarkup(state)}</div>`;
  }

  function selectionOverlay(selectionInput) {
    const selection = normalizeSelection(selectionInput); if (selection.type === "none") return "";
    const polygon = selection.type === "lasso" && selection.points.length > 2 ? `clip-path:polygon(${selection.points.map((point) => `${point[0]}% ${point[1]}%`).join(",")});inset:0;` : `left:${selection.x}%;top:${selection.y}%;width:${selection.width}%;height:${selection.height}%;`;
    return `<div class="mpp-selection is-${selection.type}" data-mpp-selection-overlay aria-label="Vùng chọn ${selection.type}" style="${polygon}"></div>`;
  }

  function cropOverlay(cropInput) {
    const crop = normalizeCrop(cropInput); if (!crop.enabled) return "";
    return `<div class="mpp-crop-overlay" data-mpp-crop-overlay aria-label="Khung crop" style="left:${crop.x}%;top:${crop.y}%;width:${crop.width}%;height:${crop.height}%"><i></i><i></i><i></i><i></i></div>`;
  }

  function layerStudio(state, photos = []) {
    const selected = state.layers.find((layer) => layer.id === state.selectedLayerId), index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    const blendLabels = { "source-over": "Bình thường", screen: "Screen", lighten: "Lighten", overlay: "Overlay", "color-dodge": "Color Dodge", "soft-light": "Soft Light", multiply: "Multiply", darken: "Darken" };
    return `<section class="mpp-layer-studio"><header><div><small>LAYER STUDIO</small><strong>${state.layers.length}/${MAX_LAYERS}</strong></div><button type="button" data-mpp-add-layer ${state.selectedPhotoId && state.layers.length < MAX_LAYERS ? "" : "disabled"}>＋ Layer</button></header><div class="mpp-layer-list" data-mpp-scroll="layers">${state.layers.slice().reverse().map((layer) => {
      const realIndex = state.layers.findIndex((item) => item.id === layer.id);
      const missing = layer.kind !== "group" && layer.sourcePhotoId && !photos.some((photo) => photo.id === layer.sourcePhotoId);
      return `<article class="${layer.id === state.selectedLayerId ? "is-active" : ""} ${layer.locked ? "is-locked" : ""} ${missing ? "is-missing" : ""}" data-mpp-layer-row="${escapeHtml(layer.id)}" draggable="${!layer.locked}"><button type="button" data-mpp-layer-visible="${escapeHtml(layer.id)}" aria-label="${layer.visible ? "Ẩn" : "Hiện"} ${escapeHtml(layer.name)}" aria-pressed="${layer.visible}">${layer.visible ? "◉" : "○"}</button><button type="button" class="mpp-layer-main" data-mpp-layer-select="${escapeHtml(layer.id)}"><i>${layer.kind === "group" ? "▦" : layer.kind === "adjustment" ? "◐" : "▧"}</i><span><strong>${escapeHtml(layer.name)}</strong><small>${missing ? "Thiếu ảnh nguồn · cần relink" : `${blendLabels[layer.blendMode]} · ${layer.opacity}%`}</small></span></button><button type="button" data-mpp-layer-lock="${escapeHtml(layer.id)}" aria-label="${layer.locked ? "Mở khóa" : "Khóa"} ${escapeHtml(layer.name)}">${layer.locked ? "🔒" : "◇"}</button><span class="mpp-layer-order"><button type="button" data-mpp-layer-move="${escapeHtml(layer.id)}" data-direction="up" ${realIndex >= state.layers.length - 1 || layer.locked ? "disabled" : ""} aria-label="Đưa layer lên">↑</button><button type="button" data-mpp-layer-move="${escapeHtml(layer.id)}" data-direction="down" ${realIndex <= 0 || layer.locked ? "disabled" : ""} aria-label="Đưa layer xuống">↓</button></span></article>`;
    }).join("") || "<p>Nhập ảnh để tạo layer đầu tiên.</p>"}</div>${selected ? `<div class="mpp-layer-properties"><label>Tên<input data-mpp-layer-name="${escapeHtml(selected.id)}" maxlength="120" value="${escapeHtml(selected.name)}" ${selected.locked ? "disabled" : ""}></label><label>Opacity <b>${selected.opacity}%</b><input type="range" min="0" max="100" value="${selected.opacity}" data-mpp-layer-opacity="${escapeHtml(selected.id)}" ${selected.locked ? "disabled" : ""}></label><label>Blend<select data-mpp-layer-blend="${escapeHtml(selected.id)}" ${selected.locked ? "disabled" : ""}>${BLEND_MODES.map((mode) => `<option value="${mode}" ${selected.blendMode === mode ? "selected" : ""}>${blendLabels[mode]}</option>`).join("")}</select></label><div class="mpp-layer-transform"><label>X<input type="number" min="-32768" max="32768" value="${selected.transform.x}" data-mpp-layer-transform="x"></label><label>Y<input type="number" min="-32768" max="32768" value="${selected.transform.y}" data-mpp-layer-transform="y"></label><label>Tỷ lệ<input type="number" min=".05" max="16" step=".05" value="${selected.transform.scaleX}" data-mpp-layer-transform="scale"></label><label>Góc<input type="number" min="-180" max="180" value="${selected.transform.rotation}" data-mpp-layer-transform="rotation"></label></div><section class="mpp-mask-controls"><label><input type="checkbox" data-mpp-layer-clipping="${escapeHtml(selected.id)}" ${selected.clippingToBelow ? "checked" : ""} ${index <= 0 || selected.locked ? "disabled" : ""}> Clipping xuống layer dưới</label><div><button type="button" data-mpp-mask-from-selection ${!selectionHasArea(state.selection) || selected.locked || selected.kind === "group" ? "disabled" : ""}>Mask từ vùng chọn</button><button type="button" data-mpp-mask-toggle ${selected.mask.type === "none" || selected.locked ? "disabled" : ""}>${selected.mask.enabled ? "Tắt mask" : "Bật mask"}</button><button type="button" data-mpp-mask-invert ${selected.mask.type === "none" || selected.locked ? "disabled" : ""}>Đảo mask</button><button type="button" data-mpp-mask-remove ${selected.mask.type === "none" || selected.locked ? "disabled" : ""}>Gỡ mask</button></div>${selected.mask.type !== "none" ? `<label class="mpp-mask-feather">Feather <b>${selected.mask.feather}</b><input type="range" min="0" max="100" value="${selected.mask.feather}" data-mpp-mask-feather="${escapeHtml(selected.id)}" ${selected.locked ? "disabled" : ""}></label>` : ""}<small>${selected.kind === "group" ? "Group mask chưa được raster hóa; hãy mask layer con." : selected.mask.type === "none" ? "Chưa có mask" : `${selected.mask.type} · ${selected.mask.inverted ? "đảo" : "thường"}${selected.mask.feather ? ` · feather ${selected.mask.feather}` : ""}`}</small></section><footer><button type="button" data-mpp-duplicate-layer>Nhân bản</button><button type="button" data-mpp-merge-layer ${index <= 0 || selected.locked ? "disabled" : ""}>Gộp xuống</button><button type="button" data-mpp-delete-layer ${selected.locked ? "disabled" : ""}>Xóa</button></footer></div>` : ""}</section>`;
  }

  function filmstrip(photos, selectedId) {
    return `<div class="mpp-filmstrip">${photos.map((photo) => `<button type="button" data-mpp-photo="${photo.id}" class="${photo.id === selectedId ? "is-active" : ""}"><img src="${photo.url}" alt=""><span><strong>${escapeHtml(photo.name)}</strong><small>${photo.width || "…"}×${photo.height || "…"}</small></span></button>`).join("") || "<p>Thả ảnh vào để bắt đầu.</p>"}</div>`;
  }

  function photoPanel(state, photos, histogram, capabilities = photoCapabilities()) {
    const selected = photos.find((item) => item.id === state.selectedPhotoId);
    if (state.photoTab === "lighttable") {
      const plan = createBatchExportPlan(photos, state.batchPhotoIds, state.recipe, capabilities);
      return `<section class="mpp-lighttable"><header><div><small>LOCAL LIGHTTABLE & BATCH</small><h3>${photos.length} ảnh · ${state.batchPhotoIds.length} đã chọn</h3></div><span><button type="button" data-mpp-batch-all ${photos.length ? "" : "disabled"}>${state.batchPhotoIds.length === Math.min(photos.length, MAX_BATCH_EXPORTS) && photos.length ? "Bỏ chọn" : "Chọn tối đa 10"}</button><button type="button" data-mpp-batch-export ${plan.valid ? "" : "disabled"}>Xuất batch</button><label>Thêm ảnh<input type="file" accept="${IMAGE_TYPES.join(",")}" multiple data-mpp-photo-files></label></span></header>${plan.warnings.length ? `<p class="mpp-batch-warning">${escapeHtml(plan.warnings.join(" "))}</p>` : ""}${plan.blockers.length && state.batchPhotoIds.length ? `<p class="mpp-batch-error">${escapeHtml(plan.blockers.join(" "))}</p>` : ""}<div>${photos.map((photo) => `<article class="${photo.id === state.selectedPhotoId ? "is-active" : ""} ${state.batchPhotoIds.includes(photo.id) ? "is-batch" : ""}"><button type="button" data-mpp-photo="${photo.id}"><img src="${photo.url}" alt="${escapeHtml(photo.name)}"><span><strong>${escapeHtml(photo.name)}</strong><small>${formatBytes(photo.file.size)} · ${photo.width || "…"}×${photo.height || "…"}</small></span></button><label><input type="checkbox" data-mpp-batch-photo="${escapeHtml(photo.id)}" ${state.batchPhotoIds.includes(photo.id) ? "checked" : ""}> Batch</label></article>`).join("") || "<p>Chưa có ảnh. File chỉ được giải mã trên thiết bị.</p>"}</div></section>`;
    }
    if (state.photoTab === "history") return `<section class="mpp-photo-history"><header><div><small>EDIT HISTORY</small><h3>${state.history.undo.length} thao tác · ${state.snapshots.length} snapshot</h3></div><span><button type="button" data-mpp-undo ${state.history.undo.length ? "" : "disabled"}>↶ Undo</button><button type="button" data-mpp-redo ${state.history.redo.length ? "" : "disabled"}>↷ Redo</button><button type="button" data-mpp-photo-snapshot ${selected ? "" : "disabled"}>＋ Snapshot</button></span></header><div data-mpp-scroll="history">${state.history.undo.slice().reverse().map((item) => `<article><i>↳</i><span><strong>${escapeHtml(item.label)}</strong><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></span></article>`).join("")}${state.snapshots.slice().reverse().map((item) => `<button type="button" data-mpp-restore-snapshot="${item.id}"><i>◇</i><span><strong>${escapeHtml(item.name)}</strong><small>${new Date(item.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(item.photoName || "Ảnh")}</small></span><b>Khôi phục</b></button>`).join("") || (!state.history.undo.length ? "<p>Chưa có thao tác chỉnh sửa.</p>" : "")}</div></section>`;
    if (state.photoTab === "export") {
      return `<section class="mpp-photo-export"><article><small>OUTPUT RECIPE</small><h3>Xuất composition có layer</h3><p>Preview giới hạn 1600px; output được render từ ảnh nguồn tối đa 8192px. MIME kết quả được kiểm tra sau khi trình duyệt mã hóa.</p><label>Định dạng<select data-mpp-export-format><option value="image/webp" ${state.recipe.format === "image/webp" ? "selected" : ""}>WebP · kiểm tra khi xuất</option><option value="image/jpeg" ${state.recipe.format === "image/jpeg" ? "selected" : ""}>JPEG · không alpha</option><option value="image/png" ${state.recipe.format === "image/png" ? "selected" : ""}>PNG · bắt buộc hỗ trợ</option></select></label><label>Chất lượng <span data-mpp-value="quality">${state.recipe.quality}%</span><input type="range" min="30" max="100" value="${state.recipe.quality}" data-mpp-recipe="quality"></label><div class="mpp-export-actions"><button type="button" class="is-primary" data-mpp-export-photo ${selected ? "" : "disabled"}>Xuất ${selected ? escapeHtml(selected.name) : "ảnh"}</button><button type="button" data-mpp-export-photo-project>Xuất project có layer</button></div></article><article><small>CAPABILITY TRUTH</small><div class="mpp-engine-status"><p><i class="${capabilities.imageBitmap ? "is-ready" : ""}"></i><span><strong>Image decode</strong><small>${capabilities.imageBitmap ? "ImageBitmap sẵn sàng" : "Fallback HTMLImage; không tuyên bố tăng tốc"}</small></span></p><p><i class="${capabilities.offscreenCanvas ? "is-ready" : ""}"></i><span><strong>Render path</strong><small>${capabilities.offscreenCanvas ? "OffscreenCanvas khả dụng" : capabilities.canvas ? "Canvas 2D trên main thread" : "Không khả dụng"}</small></span></p><p><i class="is-ready"></i><span><strong>Project structure</strong><small>${state.layers.length} layer · ${state.history.undo.length} bước undo · local-first</small></span></p></div></article></section>`;
    }
    const paths = histogram ? [["#ff668c", histogram.red], ["#67efb0", histogram.green], ["#5d9dff", histogram.blue], ["#e8f0ff", histogram.luminance]] : [];
    return `<section class="mpp-photo-develop">${recipeControls(state, capabilities)}<main class="mpp-photo-canvas"><header><div><button type="button" data-mpp-view="fit" class="${state.photoView === "fit" ? "is-active" : ""}">Fit</button><button type="button" data-mpp-view="100" class="${state.photoView === "100" ? "is-active" : ""}">100%</button></div><span>${selected ? `${escapeHtml(selected.name)} · ${selected.width || "…"}×${selected.height || "…"}` : "Chưa có ảnh"}</span><button type="button" data-mpp-compare-mode class="${state.compareMode === "split" ? "is-active" : ""}" ${selected ? "" : "disabled"}>${state.compareMode === "split" ? "Tắt chia đôi" : "Trước / Sau"}</button><button type="button" data-mpp-compare ${selected ? "" : "disabled"}>Giữ xem gốc</button></header><div class="mpp-canvas-stage tool-${state.photoTool}" data-mpp-drop data-mpp-scroll="canvas"><canvas data-mpp-photo-canvas></canvas>${selectionOverlay(state.selection)}${cropOverlay(state.crop)}<div class="mpp-empty-photo" ${selected ? "hidden" : ""}><i>PI</i><h3>Thả ảnh vào Photo Lab</h3><p>JPEG, PNG, WebP, GIF hoặc AVIF hợp lệ · tối đa ${formatBytes(MAX_PHOTO_BYTES)}.</p><label>Chọn ảnh<input type="file" accept="${IMAGE_TYPES.join(",")}" multiple data-mpp-photo-files></label></div></div>${filmstrip(photos, state.selectedPhotoId)}</main><aside class="mpp-photo-inspector" data-mpp-scroll="inspector">${layerStudio(state, photos)}<section class="mpp-live-scopes"><header><small>LIVE SCOPES</small><button type="button" data-mpp-photo-snapshot ${selected ? "" : "disabled"}>◇ Snapshot</button></header><svg viewBox="0 0 300 86" preserveAspectRatio="none">${paths.map(([color, values]) => `<path d="${histogramPath(values)}" stroke="${color}"/>`).join("")}</svg><dl><div><dt>Không gian màu</dt><dd>sRGB preview</dd></div><div><dt>Recipe</dt><dd>${Object.values(state.recipe).filter((value) => value !== 0 && value !== false).length} tham số</dd></div><div><dt>Effect stack</dt><dd>${state.effects.filter((effect) => effect.enabled).length}/${state.effects.length}</dd></div><div><dt>Mask / clipping</dt><dd>${state.layers.filter((layer) => layer.mask?.enabled || layer.clippingToBelow).length}</dd></div><div><dt>Ảnh nguồn</dt><dd>${selected ? formatBytes(selected.file.size) : "—"}</dd></div></dl><button type="button" data-mpp-photo-tab="export" ${selected ? "" : "disabled"}>Tiếp tục xuất ảnh →</button></section></aside></section>`;
  }

  function photoMarkup(state, photos, histogram, capabilities) {
    return `<section class="media-project-photo-studio is-photo" data-mpp data-workspace="photo-workspace"><header class="mpp-photo-toolbar"><div><span>PI</span><div><small>PHOTO & IMAGE LAB</small><strong>Lighttable → Layer Studio → Review → Export</strong></div></div><label>＋ Nhập ảnh<input type="file" accept="${IMAGE_TYPES.join(",")}" multiple data-mpp-photo-files></label><button type="button" data-mpp-undo ${state.history.undo.length ? "" : "disabled"} title="Hoàn tác · Ctrl+Z">↶ Undo</button><button type="button" data-mpp-redo ${state.history.redo.length ? "" : "disabled"} title="Làm lại · Ctrl+Y">↷ Redo</button><button type="button" data-mpp-route="/media-design/background-remover">Xóa nền</button><button type="button" data-mpp-route="/media-design/collage">Collage</button></header>${photoTabs(state, photos)}<main data-mpp-scroll="workspace">${photoPanel(state, photos, histogram, capabilities)}</main><div class="mpp-photo-status" data-mpp-status role="status" aria-live="polite">Sẵn sàng xử lý cục bộ.</div></section>`;
  }

  function sourceDimensions(source) { return { width: source.naturalWidth || source.videoWidth || source.width || 1, height: source.naturalHeight || source.videoHeight || source.height || 1 }; }

  function drawSource(surface, source, recipeInput, maxEdge = 1600) {
    const recipe = normalizeRecipe(recipeInput), dimensions = sourceDimensions(source), scale = Math.min(1, maxEdge / Math.max(dimensions.width, dimensions.height));
    const sourceWidth = Math.max(1, Math.round(dimensions.width * scale)), sourceHeight = Math.max(1, Math.round(dimensions.height * scale));
    const rotated = recipe.rotation === 90 || recipe.rotation === 270;
    surface.width = rotated ? sourceHeight : sourceWidth; surface.height = rotated ? sourceWidth : sourceHeight;
    const context = surface.getContext("2d", { alpha: true, willReadFrequently: maxEdge <= 1600 });
    context.clearRect(0, 0, surface.width, surface.height); context.save(); context.filter = recipeFilter(recipe);
    context.translate(surface.width / 2, surface.height / 2); context.rotate(recipe.rotation * Math.PI / 180); context.scale(recipe.flipX ? -1 : 1, recipe.flipY ? -1 : 1);
    context.drawImage(source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight); context.restore();
    return { context, width: surface.width, height: surface.height, sourceWidth: dimensions.width, sourceHeight: dimensions.height };
  }

  function flattenVisibleLayers(layersInput, parentOpacity = 1, output = [], parentTransform = normalizeTransform(), parentBlend = "source-over") {
    normalizeLayers(layersInput).forEach((layer) => {
      if (!layer.visible || layer.opacity <= 0) return;
      const opacity = parentOpacity * layer.opacity / 100;
      const transform = normalizeTransform({
        x: parentTransform.x + layer.transform.x * parentTransform.scaleX, y: parentTransform.y + layer.transform.y * parentTransform.scaleY,
        scaleX: parentTransform.scaleX * layer.transform.scaleX, scaleY: parentTransform.scaleY * layer.transform.scaleY,
        rotation: parentTransform.rotation + layer.transform.rotation, flipX: parentTransform.flipX !== layer.transform.flipX, flipY: parentTransform.flipY !== layer.transform.flipY
      });
      const blendMode = layer.blendMode === "source-over" ? parentBlend : layer.blendMode;
      if (layer.kind === "group") flattenVisibleLayers(layer.children, opacity, output, transform, blendMode);
      else if (layer.sourcePhotoId || (layer.kind === "paint" && layer.strokes.length)) output.push({ ...layer, transform, blendMode, effectiveOpacity: opacity });
    });
    return output;
  }

  function rasterSurface(width, height) {
    if (globalScope.OffscreenCanvas) return new globalScope.OffscreenCanvas(width, height);
    const canvas = globalScope.document?.createElement?.("canvas");
    if (!canvas) throw new Error("Canvas không khả dụng.");
    canvas.width = width; canvas.height = height; return canvas;
  }

  function traceSelectionPath(context, selectionInput, width, height) {
    const selection = normalizeSelection(selectionInput); if (selection.type === "none") return false;
    context.beginPath();
    if (selection.type === "rectangle") context.rect(selection.x / 100 * width, selection.y / 100 * height, selection.width / 100 * width, selection.height / 100 * height);
    else if (selection.type === "ellipse") {
      const x = (selection.x + selection.width / 2) / 100 * width, y = (selection.y + selection.height / 2) / 100 * height, radiusX = selection.width / 200 * width, radiusY = selection.height / 200 * height;
      if (typeof context.ellipse === "function") context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2); else context.rect(selection.x / 100 * width, selection.y / 100 * height, selection.width / 100 * width, selection.height / 100 * height);
    } else if (selection.type === "lasso" && selection.points.length > 2) {
      selection.points.forEach((point, index) => { const x = point[0] / 100 * width, y = point[1] / 100 * height; if (index) context.lineTo(x, y); else context.moveTo(x, y); }); context.closePath();
    } else return false;
    return true;
  }

  function selectionMaskSurface(width, height, maskInput) {
    const mask = normalizeMask(maskInput), surface = rasterSurface(width, height), context = surface.getContext("2d", { alpha: true });
    if (!context || !mask.enabled || mask.type !== "selection" || !selectionHasArea(mask.selection)) return null;
    if (mask.inverted) { context.fillStyle = "#fff"; context.fillRect(0, 0, width, height); context.globalCompositeOperation = "destination-out"; }
    else context.fillStyle = "#fff";
    if (traceSelectionPath(context, mask.selection, width, height)) context.fill();
    return surface;
  }

  function applyLayerMask(layerSurface, maskInput) {
    const mask = normalizeMask(maskInput), width = layerSurface.width, height = layerSurface.height, maskSurface = selectionMaskSurface(width, height, mask);
    if (!maskSurface) return;
    const context = layerSurface.getContext("2d", { alpha: true }); context.save(); context.globalCompositeOperation = "destination-in";
    if (mask.feather && "filter" in context) context.filter = `blur(${Math.min(width, height) * mask.feather / 2000}px)`;
    context.drawImage(maskSurface, 0, 0); context.restore();
  }

  function drawPaintStrokes(context, strokesInput, width, height, scale = 1) {
    (Array.isArray(strokesInput) ? strokesInput : []).map(normalizeStroke).forEach((stroke) => {
      if (!stroke.points.length) return; const brush = stroke.brush;
      context.save(); context.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over"; context.globalAlpha = brush.opacity / 100;
      context.strokeStyle = brush.color; context.fillStyle = brush.color; context.lineCap = "round"; context.lineJoin = "round";
      if (brush.hardness < 100) { context.shadowColor = stroke.mode === "erase" ? "#000" : brush.color; context.shadowBlur = Math.max(1, brush.size * scale) * (100 - brush.hardness) / 100; }
      if (stroke.points.length === 1) { const point = stroke.points[0]; context.lineWidth = Math.max(1, brush.size * scale * (.25 + .75 * point[2])); context.beginPath(); context.arc(point[0] / 100 * width, point[1] / 100 * height, context.lineWidth / 2, 0, Math.PI * 2); context.fill(); }
      else for (let index = 1; index < stroke.points.length; index += 1) { const previous = stroke.points[index - 1], point = stroke.points[index]; context.lineWidth = Math.max(1, brush.size * scale * (.25 + .75 * (previous[2] + point[2]) / 2)); context.beginPath(); context.moveTo(previous[0] / 100 * width, previous[1] / 100 * height); context.lineTo(point[0] / 100 * width, point[1] / 100 * height); context.stroke(); }
      context.restore();
    });
  }

  function applyEffectStack(surface, effectsInput) {
    const effects = normalizeEffects(effectsInput).filter((effect) => effect.enabled && effect.amount !== 0), width = surface.width, height = surface.height, context = surface.getContext("2d", { alpha: true });
    if (!context) return surface;
    const filtered = (filter) => { const copy = rasterSurface(width, height), copyContext = copy.getContext("2d", { alpha: true }); copyContext.drawImage(surface, 0, 0); context.clearRect(0, 0, width, height); context.save(); context.filter = filter; context.drawImage(copy, 0, 0); context.restore(); };
    effects.forEach((effect) => {
      if (effect.type === "exposure") filtered(`brightness(${Math.round(100 * (2 ** (effect.amount / 100)))}%)`);
      else if (effect.type === "contrast") filtered(`contrast(${Math.max(0, 100 + effect.amount)}%)`);
      else if (effect.type === "saturation") filtered(`saturate(${Math.max(0, 100 + effect.amount)}%)`);
      else if (effect.type === "vignette" && typeof context.createRadialGradient === "function") { const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .18, width / 2, height / 2, Math.max(width, height) * .7); gradient.addColorStop(0, "rgba(0,0,0,0)"); gradient.addColorStop(1, `rgba(0,0,0,${effect.amount / 125})`); context.save(); context.fillStyle = gradient; context.fillRect(0, 0, width, height); context.restore(); }
      else if (effect.type === "warmth") { context.save(); context.globalAlpha = effect.amount / 250; context.globalCompositeOperation = "soft-light"; context.fillStyle = "#ff8735"; context.fillRect(0, 0, width, height); context.restore(); }
      else if (effect.type === "fade") { context.save(); context.globalAlpha = effect.amount / 250; context.globalCompositeOperation = "screen"; context.fillStyle = "#d8c9bf"; context.fillRect(0, 0, width, height); context.restore(); }
      else if (effect.type === "grain") { let seed = 2166136261; context.save(); context.globalAlpha = effect.amount / 650; context.globalCompositeOperation = "overlay"; for (let index = 0, count = Math.min(1200, Math.ceil(width * height / 5000)); index < count; index += 1) { seed = Math.imul(seed ^ index, 16777619) >>> 0; const x = seed % width; seed = Math.imul(seed ^ (index + 1), 16777619) >>> 0; const y = seed % height; context.fillStyle = seed & 1 ? "#fff" : "#000"; context.fillRect(x, y, Math.max(1, width / 700), Math.max(1, height / 700)); } context.restore(); }
    });
    return surface;
  }

  function drawComposite(surface, sourcesInput, layersInput, recipeInput, maxEdge = 1600, documentOptions = {}) {
    const sources = sourcesInput instanceof Map ? sourcesInput : new Map(Object.entries(sourcesInput || {}));
    const documentLayers = normalizeLayers(layersInput);
    let layers = flattenVisibleLayers(documentLayers).filter((layer) => layer.kind === "paint" || sources.has(layer.sourcePhotoId));
    if (!layers.length && !documentLayers.length && sources.size) {
      const firstId = sources.keys().next().value;
      layers = [{ ...normalizeLayer({ sourcePhotoId: firstId, name: "Ảnh nguồn" }), effectiveOpacity: 1 }];
    }
    if (!layers.length && !sources.size) throw new Error("Không có layer ảnh hiển thị để render.");
    const dimensions = layers.filter((layer) => sources.has(layer.sourcePhotoId)).map((layer) => sourceDimensions(sources.get(layer.sourcePhotoId)));
    if (!dimensions.length && sources.size) dimensions.push(sourceDimensions(sources.values().next().value));
    if (!dimensions.length) dimensions.push({ width: 1600, height: 900 });
    const naturalWidth = Math.max(1, ...dimensions.map((item) => item.width)), naturalHeight = Math.max(1, ...dimensions.map((item) => item.height));
    const scale = Math.min(1, Math.max(1, Number(maxEdge) || 1600) / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale)), height = Math.max(1, Math.round(naturalHeight * scale));
    const composition = rasterSurface(width, height), context = composition.getContext("2d", { alpha: true });
    if (!context) throw new Error("Canvas 2D không khả dụng.");
    const recipe = normalizeRecipe(recipeInput); let clippingBase = null;
    layers.forEach((layer) => {
      const layerSurface = rasterSurface(width, height), layerContext = layerSurface.getContext("2d", { alpha: true }), transform = normalizeTransform(layer.transform);
      if (!layerContext) return;
      if (layer.kind === "paint") drawPaintStrokes(layerContext, layer.strokes, width, height, scale);
      else {
        const source = sources.get(layer.sourcePhotoId), sourceSize = sourceDimensions(source);
        layerContext.save(); layerContext.filter = recipeFilter({ ...recipe, rotation: 0, flipX: false, flipY: false });
        layerContext.translate(width / 2 + transform.x * scale, height / 2 + transform.y * scale); layerContext.rotate(transform.rotation * Math.PI / 180);
        layerContext.scale((transform.flipX ? -1 : 1) * transform.scaleX, (transform.flipY ? -1 : 1) * transform.scaleY);
        layerContext.drawImage(source, -sourceSize.width * scale / 2, -sourceSize.height * scale / 2, sourceSize.width * scale, sourceSize.height * scale); layerContext.restore();
      }
      applyLayerMask(layerSurface, layer.mask);
      if (layer.clippingToBelow) {
        layerContext.save(); layerContext.globalCompositeOperation = "destination-in"; if (clippingBase) layerContext.drawImage(clippingBase, 0, 0); else layerContext.clearRect(0, 0, width, height); layerContext.restore();
      }
      context.save(); context.globalAlpha = clamp(layer.effectiveOpacity, 0, 1); context.globalCompositeOperation = layer.blendMode; context.drawImage(layerSurface, 0, 0); context.restore();
      if (!layer.clippingToBelow) { clippingBase = rasterSurface(width, height); const alphaContext = clippingBase.getContext("2d", { alpha: true }); alphaContext.globalAlpha = clamp(layer.effectiveOpacity, 0, 1); alphaContext.drawImage(layerSurface, 0, 0); alphaContext.globalCompositeOperation = "source-in"; alphaContext.globalAlpha = 1; alphaContext.fillStyle = "#fff"; alphaContext.fillRect(0, 0, width, height); }
    });
    applyEffectStack(composition, documentOptions.effects);
    const crop = cropRect(width, height, documentOptions.crop), angle = (recipe.rotation + clamp(documentOptions.straighten, -15, 15)) * Math.PI / 180, cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
    surface.width = Math.max(1, Math.ceil(crop.width * cosine + crop.height * sine)); surface.height = Math.max(1, Math.ceil(crop.width * sine + crop.height * cosine));
    const output = surface.getContext("2d", { alpha: true, willReadFrequently: maxEdge <= 1600 });
    if (!output) throw new Error("Canvas 2D không khả dụng.");
    output.clearRect(0, 0, surface.width, surface.height); output.save(); output.translate(surface.width / 2, surface.height / 2);
    output.rotate(angle); output.scale(recipe.flipX ? -1 : 1, recipe.flipY ? -1 : 1); output.drawImage(composition, crop.x, crop.y, crop.width, crop.height, -crop.width / 2, -crop.height / 2, crop.width, crop.height); output.restore();
    return { context: output, width: surface.width, height: surface.height, sourceWidth: naturalWidth, sourceHeight: naturalHeight, renderedLayers: layers.length };
  }

  function drawBeforeAfter(surface, originalSource, sources, stateInput, maxEdge = 1600) {
    const state = normalizeState(stateInput), edited = rasterSurface(1, 1); drawComposite(edited, sources, state.layers, state.recipe, maxEdge, state);
    const original = rasterSurface(1, 1); drawSource(original, originalSource, defaultRecipe(), maxEdge);
    surface.width = edited.width; surface.height = edited.height; const context = surface.getContext("2d", { alpha: true, willReadFrequently: true });
    context.drawImage(edited, 0, 0); context.save(); context.beginPath(); context.rect(0, 0, surface.width / 2, surface.height); context.clip(); context.drawImage(original, 0, 0, original.width, original.height, 0, 0, surface.width, surface.height); context.restore();
    context.save(); context.fillStyle = "#fff"; context.fillRect(Math.floor(surface.width / 2) - 1, 0, 2, surface.height); context.restore();
    return { context, width: surface.width, height: surface.height, sourceWidth: sourceDimensions(originalSource).width, sourceHeight: sourceDimensions(originalSource).height, renderedLayers: flattenVisibleLayers(state.layers).length, comparison: true };
  }

  function calculateSurfaceHistogram(surface, maxEdge = 256) {
    const width = Math.max(1, Number(surface?.width) || 1), height = Math.max(1, Number(surface?.height) || 1), scale = Math.min(1, clamp(maxEdge, 32, 512) / Math.max(width, height));
    const sample = rasterSurface(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))), context = sample.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!context) return calculateHistogram([]);
    context.drawImage(surface, 0, 0, sample.width, sample.height); return calculateHistogram(context.getImageData(0, 0, sample.width, sample.height).data);
  }

  async function decodePhoto(file, signal) {
    if (signal?.aborted) throw new DOMException("Đã hủy đọc ảnh.", "AbortError");
    if (globalScope.createImageBitmap) return globalScope.createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const image = new Image(), url = URL.createObjectURL(file), finish = (callback, value) => { signal?.removeEventListener?.("abort", abort); URL.revokeObjectURL(url); callback(value); };
      const abort = () => { image.src = ""; finish(reject, new DOMException("Đã hủy đọc ảnh.", "AbortError")); };
      signal?.addEventListener?.("abort", abort, { once: true }); image.onload = () => finish(resolve, image); image.onerror = () => finish(reject, new Error(`Không thể đọc ${file.name}.`)); image.src = url;
    });
  }

  async function storageEstimate() {
    try {
      const result = await globalScope.navigator?.storage?.estimate?.();
      const usage = Number(result?.usage || 0), quota = Number(result?.quota || 0), persistent = await globalScope.navigator?.storage?.persisted?.();
      return { usage, quota, percent: quota ? Math.min(100, usage / quota * 100) : 0, usageLabel: formatBytes(usage), quotaLabel: quota ? formatBytes(quota) : "Chưa kiểm tra", persistent: persistent ? "Lưu bền vững" : "Có thể bị dọn bởi trình duyệt" };
    } catch (_) { return { usage: 0, quota: 0, percent: 0, usageLabel: "Chưa kiểm tra", quotaLabel: "Không khả dụng", persistent: "Không thể kiểm tra" }; }
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount(host);
    const workspace = options.workspace || options.toolId;
    if (!["media-core", "photo-workspace"].includes(workspace)) return null;
    const controller = new AbortController(), store = createStore(options.storage), projectApi = options.professionalApi || globalScope.HHMediaProfessionalSuite;
    const projectStore = projectApi?.createStateStore?.(options.storage), mediaApi = options.mediaApi || globalScope.HHUniversalMediaProject, adapters = options.adapters || {};
    const capabilities = photoCapabilities(globalScope, adapters);
    const requestFrame = globalScope.requestAnimationFrame?.bind(globalScope) || ((callback) => setTimeout(callback, 16));
    const cancelFrame = globalScope.cancelAnimationFrame?.bind(globalScope) || clearTimeout;
    let state = store.load(), projectState = projectStore?.load?.(), photos = [], histogram = null;
    let storageInfo = { usageLabel: "Đang kiểm tra…", quotaLabel: "—", percent: 0, persistent: "—" }, frame = 0, compare = false, disposed = false, drawVersion = 0, selectionGesture = null, editBaseline = null, draggedLayerId = "", restoringFocus = false, exporting = false, batching = false;
    const objectUrls = new Set(), sourceCache = new Map(), decodeJobs = new Map();
    const navigate = (route) => typeof options.onNavigate === "function" ? options.onNavigate(route) : (globalScope.location.hash = `#${route}`);
    const save = () => { state.lastSavedAt = now(); state = store.save(state); if (projectState) projectState = projectStore?.save?.(projectState) || projectState; };
    const status = (message, tone = "success") => { const node = host.querySelector("[data-mpp-status]"); if (node) { node.textContent = message; node.dataset.tone = tone; } };
    const captureUi = () => {
      const scroll = [...host.querySelectorAll("[data-mpp-scroll]")].map((node) => [node.dataset.mppScroll, node.scrollTop, node.scrollLeft]);
      const focused = globalScope.document?.activeElement, attributes = ["data-mpp-layer-name", "data-mpp-layer-opacity", "data-mpp-layer-blend", "data-mpp-recipe", "data-mpp-layer-transform", "data-mpp-effect-amount", "data-mpp-brush", "data-mpp-straighten", "data-mpp-mask-feather"];
      const focus = focused && host.contains(focused) ? attributes.map((name) => [name, focused.getAttribute?.(name)]).find((row) => row[1] != null) : null;
      return { scroll, focus };
    };
    const restoreUi = (view) => {
      view?.scroll?.forEach(([key, top, left]) => { const node = [...host.querySelectorAll("[data-mpp-scroll]")].find((item) => item.dataset.mppScroll === key); if (node) { node.scrollTop = top; node.scrollLeft = left; } });
      if (view?.focus) { const [attribute, value] = view.focus, node = [...host.querySelectorAll(`[${attribute}]`)].find((item) => item.getAttribute(attribute) === value); restoringFocus = true; node?.focus?.({ preventScroll: true }); restoringFocus = false; }
    };
    const render = (preserve = true) => {
      if (disposed) return;
      const view = preserve ? captureUi() : null;
      host.innerHTML = workspace === "media-core" ? projectMarkup(projectState, state, projectApi, storageInfo) : photoMarkup(state, photos, histogram, capabilities);
      restoreUi(view); if (workspace === "photo-workspace" && photos.length) scheduleDraw();
    };
    const refreshProjectStorage = async () => { const result = await storageEstimate(); if (disposed || controller.signal.aborted) return; storageInfo = result; if (workspace === "media-core" && host.isConnected) render(); };
    const selectedPhoto = () => photos.find((item) => item.id === state.selectedPhotoId);
    const ensureSource = async (id) => {
      if (sourceCache.has(id)) return sourceCache.get(id);
      if (decodeJobs.has(id)) return decodeJobs.get(id);
      const photo = photos.find((item) => item.id === id); if (!photo) return null;
      const job = decodePhoto(photo.file, controller.signal).then((source) => {
        if (disposed || controller.signal.aborted) { source?.close?.(); return null; }
        const dimensions = sourceDimensions(source); if (!dimensionsAreSafe(dimensions)) { source?.close?.(); throw new Error(`${photo.name} vượt giới hạn ${MAX_IMAGE_EDGE}px hoặc ${MAX_IMAGE_PIXELS / 1000000} megapixel.`); }
        sourceCache.set(id, source); photo.width = dimensions.width; photo.height = dimensions.height; return source;
      }).finally(() => decodeJobs.delete(id));
      decodeJobs.set(id, job); return job;
    };
    const visiblePhotoIds = () => {
      const ids = [...new Set(flattenVisibleLayers(state.layers).map((layer) => layer.sourcePhotoId).filter((id) => photos.some((photo) => photo.id === id)))];
      if (!ids.length && state.selectedPhotoId) ids.push(state.selectedPhotoId); return ids;
    };
    const loadVisibleSources = async () => {
      const ids = visiblePhotoIds(); await Promise.all(ids.map((id) => ensureSource(id)));
      return new Map(ids.filter((id) => sourceCache.has(id)).map((id) => [id, sourceCache.get(id)]));
    };
    const scheduleDraw = (original = compare) => {
      cancelFrame(frame); const version = ++drawVersion;
      frame = requestFrame(async () => {
        try {
          const sources = await loadVisibleSources(); if (disposed || version !== drawVersion) return;
          const canvas = host.querySelector("[data-mpp-photo-canvas]"); if (!canvas || !sources.size) return;
          const originalSource = sourceCache.get(state.selectedPhotoId) || sources.values().next().value;
          const previewState = state.photoTool === "crop" ? { ...state, crop: { ...state.crop, enabled: false }, straighten: 0, recipe: { ...state.recipe, rotation: 0, flipX: false, flipY: false } } : state;
          const output = original ? drawSource(canvas, originalSource, defaultRecipe(), 1600) : state.compareMode === "split" ? drawBeforeAfter(canvas, originalSource, sources, previewState, 1600) : drawComposite(canvas, sources, state.layers, state.recipe, 1600, previewState);
          canvas.style.width = state.photoView === "100" ? `${output.width}px` : ""; canvas.style.height = state.photoView === "100" ? `${output.height}px` : "";
          syncCanvasOverlays();
          if (!original) {
            histogram = calculateSurfaceHistogram(canvas, 256);
            const svg = host.querySelector(".mpp-live-scopes svg");
            if (svg) svg.innerHTML = [["#ff668c", histogram.red], ["#67efb0", histogram.green], ["#5d9dff", histogram.blue], ["#e8f0ff", histogram.luminance]].map(([color, values]) => `<path d="${histogramPath(values)}" stroke="${color}"/>`).join("");
          }
        } catch (error) { if (!disposed && error?.name !== "AbortError") status(error.message || "Không thể render ảnh.", "error"); }
      });
    };
    const selectPhoto = async (id, selectLayer = true) => {
      const photo = photos.find((item) => item.id === id); if (!photo) return;
      const source = await ensureSource(id); if (!source || disposed) return;
      state.selectedPhotoId = photo.id;
      if (selectLayer) state.selectedLayerId = [...state.layers].reverse().find((layer) => layer.sourcePhotoId === id)?.id || state.selectedLayerId;
      save(); render(); status(`Đã mở ${photo.name} · ${photo.width}×${photo.height}.`);
    };
    const withMediaDb = async (callback) => {
      if (!mediaApi?.createStore) return null;
      const db = mediaApi.createStore();
      try { await db.ready(); return await callback(db); } finally { try { await db.close?.(); } catch (_) {} }
    };
    const getMediaProject = async (db) => (await db.listProjects())[0] || db.saveProject({ name: projectState?.project?.name || "Universal Media Project" });
    const ingestProjectFiles = async (files) => {
      if (!projectState || !projectApi?.addAssetRecord) return;
      const list = [...files].filter((file) => file.size > 0).slice(0, 60);
      for (const file of list) { if (controller.signal.aborted) return; const result = projectApi.addAssetRecord(projectState, { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, checksum: await checksum(file), source: "project-core" }); projectState = result.state; }
      save(); render();
      try { await withMediaDb(async (db) => { const project = await getMediaProject(db); for (const file of list) await db.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, blob: file }); }); } catch (_) {}
    };
    const ingestPhotos = async (files) => {
      const available = Math.max(0, Math.min(MAX_PHOTOS - photos.length, MAX_LAYERS - state.layers.length));
      if (!available) { status(`Đã đạt giới hạn ${Math.min(MAX_PHOTOS, MAX_LAYERS)} ảnh/layer trong phiên.`, "error"); return; }
      const candidates = [...files].slice(0, available), checked = [];
      for (const file of candidates) checked.push({ file, result: await validateImageFile(file) });
      let sessionBytes = photos.reduce((total, photo) => total + Number(photo.file?.size || 0), 0); const records = [], rejected = checked.filter((item) => !item.result.valid);
      checked.filter((item) => item.result.valid).forEach(({ file, result }) => {
        if (sessionBytes + result.size > MAX_SESSION_BYTES) { rejected.push({ result: { error: `Phiên vượt giới hạn ${formatBytes(MAX_SESSION_BYTES)}.` } }); return; }
        sessionBytes += result.size; const id = uid("photo"), url = URL.createObjectURL(file); objectUrls.add(url);
        records.push({ id, file, url, name: result.name, type: result.type, width: result.width, height: result.height });
      });
      if (!records.length) { status(rejected[0]?.result?.error || "Không có ảnh hợp lệ để nhập.", "error"); return; }
      photos.push(...records);
      state = mutatePhotoState(state, `Nhập ${records.length} ảnh`, (draft) => {
        records.forEach((photo) => draft.layers.push(normalizeLayer({ name: photo.name, kind: "image", sourcePhotoId: photo.id }, draft.layers.length)));
        draft.selectedPhotoId = records[records.length - 1].id; draft.selectedLayerId = draft.layers.at(-1)?.id || "";
      });
      save(); render();
      try {
        await withMediaDb(async (db) => { const project = await getMediaProject(db); for (const photo of records) await db.saveAsset({ id: photo.id, projectId: project.id, name: photo.name, type: photo.type, size: photo.file.size, lastModified: photo.file.lastModified, blob: photo.file, metadata: { source: "photo-lighttable", detectedType: photo.type } }); });
      } catch (_) { status("Ảnh dùng được trong phiên này nhưng IndexedDB chưa lưu được.", "error"); }
      await selectPhoto(state.selectedPhotoId, false);
      status(`Đã nhập ${records.length} ảnh${rejected.length ? ` · bỏ qua ${rejected.length} tệp không hợp lệ` : ""}.`, rejected.length ? "warning" : "success");
    };
    const restorePhotos = async () => {
      if (workspace !== "photo-workspace" || !mediaApi?.createStore) return;
      try {
        const restored = await withMediaDb(async (db) => { const project = (await db.listProjects())[0]; if (!project) return []; return (await db.listAssets(project.id)).filter((asset) => asset?.metadata?.source === "photo-lighttable" && asset.blob && IMAGE_TYPES.includes(asset.metadata.detectedType || asset.type)).slice(-MAX_PHOTOS); });
        if (disposed || !restored?.length) return;
        restored.forEach((asset) => { if (photos.some((photo) => photo.id === asset.id)) return; const url = URL.createObjectURL(asset.blob); objectUrls.add(url); photos.push({ id: asset.id, file: asset.blob, url, name: asset.name, type: asset.metadata.detectedType || asset.type, width: 0, height: 0 }); });
        state.batchPhotoIds = state.batchPhotoIds.filter((id) => photos.some((photo) => photo.id === id)).slice(0, MAX_BATCH_EXPORTS);
        const missing = photos.filter((photo) => !state.layers.some((layer) => layer.sourcePhotoId === photo.id));
        if (missing.length) state.layers = normalizeLayers([...state.layers, ...missing.map((photo) => ({ name: photo.name, sourcePhotoId: photo.id, kind: "image" }))]);
        if (!photos.some((photo) => photo.id === state.selectedPhotoId)) state.selectedPhotoId = photos.at(-1)?.id || "";
        if (!state.layers.some((layer) => layer.id === state.selectedLayerId)) state.selectedLayerId = [...state.layers].reverse().find((layer) => layer.sourcePhotoId === state.selectedPhotoId)?.id || state.layers.at(-1)?.id || "";
        save(); render(false); if (state.selectedPhotoId) await selectPhoto(state.selectedPhotoId, false); status(`Đã khôi phục ${photos.length} ảnh từ thiết bị.`);
      } catch (_) { if (!disposed) status("Không thể khôi phục ảnh local; bạn vẫn có thể nhập phiên mới.", "warning"); }
    };
    const exportPhoto = async () => {
      if (exporting) { status("Một bản xuất đang được xử lý.", "warning"); return; }
      const photo = selectedPhoto(); if (!photo) throw new Error("Hãy chọn ảnh trước khi xuất.");
      exporting = true; const button = host.querySelector("[data-mpp-export-photo]"); if (button) button.disabled = true;
      try {
        status("Đang render composition từ ảnh nguồn…", "working");
        const sources = await loadVisibleSources(); if (!sources.size) throw new Error("Không còn ảnh nguồn cho các layer đang hiển thị.");
        const maxDimension = Math.max(...[...sources.values()].flatMap((source) => { const dimensions = sourceDimensions(source); return [dimensions.width, dimensions.height]; }));
        const surface = rasterSurface(1, 1); drawComposite(surface, sources, state.layers, state.recipe, Math.min(8192, maxDimension), state);
        const encoded = await encodeSurface(surface, state.recipe.format, state.recipe.quality / 100), extension = encoded.actualType === "image/jpeg" ? "jpg" : encoded.actualType.split("/")[1] || "png";
        download(`${safeName(photo.name.replace(/\.[^.]+$/, ""))}-hh-edit.${extension}`, encoded.blob, encoded.actualType);
        status(encoded.fallback ? `Trình duyệt không mã hóa ${encoded.requestedType}; đã xuất ${encoded.actualType} · ${formatBytes(encoded.blob.size)}.` : `Đã xuất ${state.layers.length} layer thành ${extension.toUpperCase()} · ${formatBytes(encoded.blob.size)}.`, encoded.fallback ? "warning" : "success");
      } finally { exporting = false; const current = host.querySelector("[data-mpp-export-photo]"); if (current) current.disabled = !selectedPhoto(); }
    };
    const batchExportPhotos = async () => {
      if (batching || exporting) { status("Một tác vụ xuất đang được xử lý.", "warning"); return; }
      const plan = createBatchExportPlan(photos, state.batchPhotoIds, state.recipe, capabilities); if (!plan.valid) throw new Error(plan.blockers.join(" "));
      batching = true; const button = host.querySelector("[data-mpp-batch-export]"); if (button) button.disabled = true;
      let completed = 0, fallbackCount = 0;
      try {
        for (const item of plan.items) {
          if (disposed || controller.signal.aborted) throw new DOMException("Đã hủy batch.", "AbortError");
          status(`Đang xuất ${completed + 1}/${plan.items.length} · ${item.name}…`, "working");
          const source = await ensureSource(item.id); if (!source) throw new Error(`Thiếu ảnh nguồn ${item.name}.`);
          const surface = rasterSurface(1, 1), layer = normalizeLayer({ id: `batch-${item.id}`, name: item.name, sourcePhotoId: item.id });
          drawComposite(surface, new Map([[item.id, source]]), [layer], state.recipe, Math.min(8192, Math.max(sourceDimensions(source).width, sourceDimensions(source).height)), { crop: state.crop, straighten: state.straighten, effects: state.effects });
          const encoded = await encodeSurface(surface, state.recipe.format, state.recipe.quality / 100), extension = encoded.actualType === "image/jpeg" ? "jpg" : encoded.actualType.split("/")[1] || "png";
          if (encoded.fallback) fallbackCount += 1; download(`${safeName(item.name.replace(/\.[^.]+$/, ""))}-hh-batch.${extension}`, encoded.blob, encoded.actualType); completed += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        status(`Đã xuất ${completed}/${plan.items.length} ảnh${fallbackCount ? ` · ${fallbackCount} file dùng codec fallback` : ""}.`, fallbackCount ? "warning" : "success");
      } finally { batching = false; const current = host.querySelector("[data-mpp-batch-export]"); if (current) current.disabled = !createBatchExportPlan(photos, state.batchPhotoIds, state.recipe, capabilities).valid; }
    };
    const exportPhotoProject = () => {
      const payload = { schema: SCHEMA, version: STATE_VERSION, exportedAt: now(), document: photoDocument(state), history: state.history, snapshots: state.snapshots, assets: photos.map((photo) => ({ id: photo.id, name: photo.name, type: photo.type || photo.file.type, size: photo.file.size, lastModified: photo.file.lastModified, embedded: false })) };
      download(`${safeName(selectedPhoto()?.name?.replace(/\.[^.]+$/, "") || "hh-photo-project")}.hhphoto.json`, JSON.stringify(payload, null, 2), "application/json");
      status("Đã xuất cấu trúc layer và lịch sử. Ảnh nguồn vẫn được giữ trong kho local và cần relink trên thiết bị khác.");
    };
    const applyState = (next, message) => { state = next; save(); render(); if (message) status(message); };
    const beginEdit = () => { if (!editBaseline) editBaseline = photoDocument(state); };
    const finishEdit = (label) => {
      if (!editBaseline) return false; const before = editBaseline; editBaseline = null;
      if (JSON.stringify(before) === JSON.stringify(photoDocument(state))) return false;
      state.history = normalizeHistory({ undo: [...state.history.undo, { id: uid("history"), label, createdAt: now(), snapshot: before }], redo: [] }); save(); return true;
    };
    const overlayGeometry = (stage, box, documentCoordinates = false) => {
      const canvas = stage.querySelector("[data-mpp-photo-canvas]"), stageRect = stage.getBoundingClientRect(), canvasRect = canvas?.getBoundingClientRect?.();
      if (!canvasRect?.width || !canvasRect?.height) return null;
      const crop = normalizeCrop(state.crop), map = documentCoordinates && crop.enabled && state.photoTool !== "crop" ? { x: (box.x - crop.x) / crop.width * 100, y: (box.y - crop.y) / crop.height * 100, width: box.width / crop.width * 100, height: box.height / crop.height * 100 } : box;
      return { left: canvasRect.left - stageRect.left + map.x / 100 * canvasRect.width, top: canvasRect.top - stageRect.top + map.y / 100 * canvasRect.height, width: map.width / 100 * canvasRect.width, height: map.height / 100 * canvasRect.height, canvasRect };
    };
    const updateSelectionOverlay = (stage) => {
      const selection = normalizeSelection(state.selection); let node = stage.querySelector("[data-mpp-selection-overlay]");
      if (selection.type === "none") { node?.remove(); return; }
      if (!node) { node = globalScope.document.createElement("div"); node.dataset.mppSelectionOverlay = ""; stage.append(node); }
      node.className = `mpp-selection is-${selection.type}`;
      const geometry = overlayGeometry(stage, selection, true); if (!geometry) return;
      if (selection.type === "lasso") { const stageRect = stage.getBoundingClientRect(), crop = normalizeCrop(state.crop), points = crop.enabled && state.photoTool !== "crop" ? selection.points.map((point) => [(point[0] - crop.x) / crop.width * 100, (point[1] - crop.y) / crop.height * 100]) : selection.points; node.style.cssText = `left:${geometry.canvasRect.left - stageRect.left}px;top:${geometry.canvasRect.top - stageRect.top}px;width:${geometry.canvasRect.width}px;height:${geometry.canvasRect.height}px;clip-path:polygon(${points.map((point) => `${point[0]}% ${point[1]}%`).join(",")})`; }
      else node.style.cssText = `left:${geometry.left}px;top:${geometry.top}px;width:${geometry.width}px;height:${geometry.height}px`;
    };
    const updateCropOverlay = (stage) => {
      const crop = normalizeCrop(state.crop); let node = stage.querySelector("[data-mpp-crop-overlay]");
      if (!crop.enabled) { node?.remove(); return; }
      if (!node) { node = globalScope.document.createElement("div"); node.className = "mpp-crop-overlay"; node.dataset.mppCropOverlay = ""; node.innerHTML = "<i></i><i></i><i></i><i></i>"; stage.append(node); }
      const geometry = overlayGeometry(stage, crop); if (geometry) node.style.cssText = `left:${geometry.left}px;top:${geometry.top}px;width:${geometry.width}px;height:${geometry.height}px;--crop-w:${geometry.width}px;--crop-h:${geometry.height}px`;
    };
    const syncCanvasOverlays = () => { const stage = host.querySelector(".mpp-canvas-stage"); if (stage) { updateSelectionOverlay(stage); updateCropOverlay(stage); } };
    const pointerPoint = (stage, event) => {
      const canvas = stage.querySelector("[data-mpp-photo-canvas]"), rect = canvas?.getBoundingClientRect?.() || stage.getBoundingClientRect();
      let x = clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100), y = clamp((event.clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100); const crop = normalizeCrop(state.crop);
      if (crop.enabled && state.photoTool !== "crop") { x = crop.x + x * crop.width / 100; y = crop.y + y * crop.height / 100; }
      return [x, y, clamp(Number(event.pressure) || .5, 0, 1)];
    };
    const handleClick = async (event) => {
      const route = event.target.closest("[data-mpp-route]"); if (route) { navigate(route.dataset.mppRoute); return; }
      const projectTab = event.target.closest("[data-mpp-project-tab]"); if (projectTab) { state.projectTab = projectTab.dataset.mppProjectTab; save(); render(); return; }
      const photoTab = event.target.closest("[data-mpp-photo-tab]"); if (photoTab) { state.photoTab = photoTab.dataset.mppPhotoTab; save(); render(); return; }
      if (event.target.closest("[data-mpp-import-assets]")) { host.querySelector("[data-mpp-project-files]")?.click(); return; }
      if (event.target.closest("[data-mpp-checkpoint]") && projectState && projectApi?.createCheckpoint) { projectState = projectApi.createCheckpoint(projectState, `Checkpoint ${new Date().toLocaleString("vi-VN")}`); save(); render(); return; }
      if (event.target.closest("[data-mpp-export-manifest]") && projectState) { download(`${safeName(projectState.project.name)}.hhcore.json`, JSON.stringify({ schema: "hh.project-core.v1", exportedAt: now(), project: projectState }, null, 2), "application/json"); return; }
      const node = event.target.closest("[data-mpp-node]"); if (node) { state.selectedNode = node.dataset.mppNode; save(); render(); return; }
      const branch = event.target.closest("[data-mpp-branch]"); if (branch && projectState?.project?.branches?.some((item) => item.id === branch.dataset.mppBranch)) { projectState.project.activeBranchId = branch.dataset.mppBranch; save(); render(); return; }
      const photoButton = event.target.closest("[data-mpp-photo]"); if (photoButton) { await selectPhoto(photoButton.dataset.mppPhoto); return; }
      const view = event.target.closest("[data-mpp-view]"); if (view) { state.photoView = view.dataset.mppView; save(); host.querySelectorAll("[data-mpp-view]").forEach((button) => button.classList.toggle("is-active", button === view)); scheduleDraw(); return; }
      if (event.target.closest("[data-mpp-undo]")) { applyState(undoPhotoState(state), "Đã hoàn tác."); return; }
      if (event.target.closest("[data-mpp-redo]")) { applyState(redoPhotoState(state), "Đã làm lại."); return; }
      if (event.target.closest("[data-mpp-reset-recipe]")) { applyState(mutatePhotoState(state, "Đặt lại công thức", (draft) => { draft.recipe = defaultRecipe(); }), "Đã đặt lại công thức."); return; }
      const transform = event.target.closest("[data-mpp-transform]"); if (transform) { const action = transform.dataset.mppTransform; applyState(mutatePhotoState(state, "Biến đổi canvas", (draft) => { if (action === "rotate") draft.recipe.rotation = (draft.recipe.rotation + 90) % 360; else draft.recipe[action] = !draft.recipe[action]; })); return; }
      const tool = event.target.closest("[data-mpp-tool]"); if (tool) { state.photoTool = tool.dataset.mppTool; save(); render(); return; }
      if (event.target.closest("[data-mpp-reset-crop]")) { applyState(mutatePhotoState(state, "Đặt lại crop", (draft) => { draft.crop = normalizeCrop(); draft.straighten = 0; }), "Đã đặt lại crop và góc nghiêng."); return; }
      const aspect = event.target.closest("[data-mpp-crop-aspect]"); if (aspect) { const photo = selectedPhoto(), ratio = photo?.width && photo?.height ? photo.width / photo.height : 1; applyState(mutatePhotoState(state, "Đổi tỷ lệ crop", (draft) => { draft.crop = applyCropAspect(draft.crop, aspect.dataset.mppCropAspect, ratio); })); return; }
      if (event.target.closest("[data-mpp-compare-mode]")) { state.compareMode = state.compareMode === "split" ? "off" : "split"; save(); render(); return; }
      if (event.target.closest("[data-mpp-clear-selection]")) { applyState(mutatePhotoState(state, "Xóa vùng chọn", (draft) => { draft.selection = normalizeSelection(); }), "Đã xóa vùng chọn."); return; }
      if (event.target.closest("[data-mpp-add-layer]")) { const photo = selectedPhoto(); if (photo) applyState(addLayer(state, { name: `${photo.name} layer`, sourcePhotoId: photo.id }), "Đã thêm layer ảnh."); return; }
      const selectLayer = event.target.closest("[data-mpp-layer-select]"); if (selectLayer) { const layer = state.layers.find((item) => item.id === selectLayer.dataset.mppLayerSelect); if (layer) { state.selectedLayerId = layer.id; if (layer.sourcePhotoId) state.selectedPhotoId = layer.sourcePhotoId; save(); render(); } return; }
      const visible = event.target.closest("[data-mpp-layer-visible]"); if (visible) { const layer = state.layers.find((item) => item.id === visible.dataset.mppLayerVisible); if (layer) applyState(updateLayer(state, layer.id, { visible: !layer.visible }, layer.visible ? "Ẩn layer" : "Hiện layer")); return; }
      const lock = event.target.closest("[data-mpp-layer-lock]"); if (lock) { const layer = state.layers.find((item) => item.id === lock.dataset.mppLayerLock); if (layer) applyState(updateLayer(state, layer.id, { locked: !layer.locked }, layer.locked ? "Mở khóa layer" : "Khóa layer")); return; }
      const move = event.target.closest("[data-mpp-layer-move]"); if (move) { const index = state.layers.findIndex((item) => item.id === move.dataset.mppLayerMove), delta = move.dataset.direction === "up" ? 1 : -1; applyState(reorderLayer(state, move.dataset.mppLayerMove, index + delta)); return; }
      if (event.target.closest("[data-mpp-duplicate-layer]") && state.selectedLayerId) { applyState(duplicateLayer(state, state.selectedLayerId), "Đã nhân bản layer."); return; }
      if (event.target.closest("[data-mpp-merge-layer]") && state.selectedLayerId) { applyState(mergeLayerDown(state, state.selectedLayerId), "Đã gộp layer xuống."); return; }
      if (event.target.closest("[data-mpp-delete-layer]") && state.selectedLayerId) { applyState(deleteLayer(state, state.selectedLayerId), "Đã xóa layer."); return; }
      if (event.target.closest("[data-mpp-mask-from-selection]") && state.selectedLayerId && selectionHasArea(state.selection)) { const layer = state.layers.find((item) => item.id === state.selectedLayerId); if (layer && layer.kind !== "group" && !layer.locked) applyState(updateLayer(state, state.selectedLayerId, { mask: { type: "selection", enabled: true, selection: clone(state.selection), inverted: false, feather: 0 } }, "Tạo mask từ vùng chọn"), "Đã tạo mask không phá hủy."); return; }
      if (event.target.closest("[data-mpp-mask-toggle]") && state.selectedLayerId) { const layer = state.layers.find((item) => item.id === state.selectedLayerId); if (layer?.mask.type !== "none") applyState(updateLayer(state, layer.id, { mask: { ...layer.mask, enabled: !layer.mask.enabled } }, layer.mask.enabled ? "Tắt mask" : "Bật mask")); return; }
      if (event.target.closest("[data-mpp-mask-invert]") && state.selectedLayerId) { const layer = state.layers.find((item) => item.id === state.selectedLayerId); if (layer?.mask.type !== "none") applyState(updateLayer(state, layer.id, { mask: { ...layer.mask, inverted: !layer.mask.inverted } }, "Đảo mask")); return; }
      if (event.target.closest("[data-mpp-mask-remove]") && state.selectedLayerId) { applyState(updateLayer(state, state.selectedLayerId, { mask: normalizeMask() }, "Gỡ mask"), "Đã gỡ mask."); return; }
      const effectToggle = event.target.closest("[data-mpp-effect-toggle]"); if (effectToggle) { const effect = state.effects.find((item) => item.id === effectToggle.dataset.mppEffectToggle); if (effect) applyState(updateEffect(state, effect.id, { enabled: !effect.enabled }, effect.enabled ? "Tắt hiệu ứng" : "Bật hiệu ứng")); return; }
      const effectDelete = event.target.closest("[data-mpp-effect-delete]"); if (effectDelete) { applyState(deleteEffect(state, effectDelete.dataset.mppEffectDelete), "Đã xóa hiệu ứng."); return; }
      const effectMove = event.target.closest("[data-mpp-effect-move]"); if (effectMove) { const index = state.effects.findIndex((item) => item.id === effectMove.dataset.mppEffectMove), delta = effectMove.dataset.direction === "up" ? -1 : 1; applyState(reorderEffect(state, effectMove.dataset.mppEffectMove, index + delta)); return; }
      if (event.target.closest("[data-mpp-batch-all]")) { const all = photos.slice(0, MAX_BATCH_EXPORTS).map((photo) => photo.id); state.batchPhotoIds = state.batchPhotoIds.length === all.length ? [] : all; save(); render(); return; }
      if (event.target.closest("[data-mpp-batch-export]")) { await batchExportPhotos(); return; }
      if (event.target.closest("[data-mpp-photo-snapshot]")) { const photo = selectedPhoto(); if (!photo) return; state.snapshots.push({ id: uid("snapshot"), name: `Snapshot ${state.snapshots.length + 1}`, photoId: photo.id, photoName: photo.name, recipe: clone(state.recipe), document: photoDocument(state), createdAt: now() }); save(); if (state.photoTab === "history") render(); else status("Đã lưu snapshot công thức và layer."); return; }
      const restore = event.target.closest("[data-mpp-restore-snapshot]"); if (restore) { const item = state.snapshots.find((row) => row.id === restore.dataset.mppRestoreSnapshot); if (item) { const next = mutatePhotoState(state, "Khôi phục snapshot", (draft) => Object.assign(draft, item.document || { recipe: item.recipe })); next.photoTab = "develop"; applyState(next, "Đã khôi phục snapshot."); } return; }
      if (event.target.closest("[data-mpp-export-photo]")) { await exportPhoto(); return; }
      if (event.target.closest("[data-mpp-export-photo-project]")) { exportPhotoProject(); }
    };
    const handleChange = async (event) => {
      if (event.target.matches("[data-mpp-project-name]") && projectState) { projectState.project.name = String(event.target.value || "Universal Media Project").slice(0, 140); const node = projectState.project.graph.nodes.find((item) => item.id === projectState.project.id); if (node) node.label = projectState.project.name; save(); render(); return; }
      if (event.target.matches("[data-mpp-graph-filter]")) { state.graphFilter = event.target.value; save(); render(); return; }
      if (event.target.matches("[data-mpp-project-files]")) { await ingestProjectFiles(event.target.files || []); return; }
      if (event.target.matches("[data-mpp-photo-files]")) { await ingestPhotos(event.target.files || []); event.target.value = ""; return; }
      if (event.target.matches("[data-mpp-export-format]")) { applyState(mutatePhotoState(state, "Đổi định dạng xuất", (draft) => { draft.recipe.format = event.target.value; })); return; }
      if (event.target.matches("[data-mpp-recipe]")) { if (finishEdit("Điều chỉnh công thức")) render(); return; }
      if (event.target.matches("[data-mpp-straighten]")) { if (finishEdit("Straighten ảnh")) render(); return; }
      if (event.target.matches("[data-mpp-brush]")) { if (finishEdit("Điều chỉnh brush")) render(); return; }
      if (event.target.matches("[data-mpp-effect-amount]")) { if (finishEdit("Điều chỉnh effect stack")) render(); return; }
      if (event.target.matches("[data-mpp-mask-feather]")) { if (finishEdit("Feather mask")) render(); return; }
      if (event.target.matches("[data-mpp-add-effect]") && event.target.value) { applyState(addEffect(state, event.target.value), "Đã thêm hiệu ứng vào stack."); return; }
      const batchPhoto = event.target.dataset.mppBatchPhoto; if (batchPhoto) { const selected = new Set(state.batchPhotoIds); if (event.target.checked) { if (selected.size < MAX_BATCH_EXPORTS) selected.add(batchPhoto); else { event.target.checked = false; status(`Batch tối đa ${MAX_BATCH_EXPORTS} ảnh.`, "warning"); return; } } else selected.delete(batchPhoto); state.batchPhotoIds = [...selected]; save(); render(); return; }
      const layerName = event.target.dataset.mppLayerName; if (layerName) { applyState(updateLayer(state, layerName, { name: event.target.value }, "Đổi tên layer")); return; }
      const layerOpacity = event.target.dataset.mppLayerOpacity; if (layerOpacity) { if (finishEdit("Đổi opacity layer")) render(); return; }
      const layerBlend = event.target.dataset.mppLayerBlend; if (layerBlend) { applyState(updateLayer(state, layerBlend, { blendMode: event.target.value }, "Đổi blend mode")); return; }
      const layerClipping = event.target.dataset.mppLayerClipping; if (layerClipping) { applyState(updateLayer(state, layerClipping, { clippingToBelow: event.target.checked }, event.target.checked ? "Bật clipping mask" : "Tắt clipping mask")); return; }
      const transformKey = event.target.dataset.mppLayerTransform; if (transformKey && state.selectedLayerId) { const value = Number(event.target.value); applyState(updateLayer(state, state.selectedLayerId, { transform: { ...state.layers.find((layer) => layer.id === state.selectedLayerId)?.transform, ...(transformKey === "scale" ? { scaleX: value, scaleY: value } : { [transformKey]: value }) } }, "Biến đổi layer")); }
    };
    host.addEventListener("click", (event) => { handleClick(event).catch((error) => { if (error?.name !== "AbortError") status(error.message || "Thao tác thất bại.", "error"); }); }, { signal: controller.signal });
    host.addEventListener("submit", (event) => { if (!event.target.matches("[data-mpp-branch-form]")) return; event.preventDefault(); try { const name = new FormData(event.target).get("name"); projectState = projectApi.createBranch(projectState, name); save(); render(); } catch (error) { status(error.message, "error"); } }, { signal: controller.signal });
    host.addEventListener("focusin", (event) => { if (!restoringFocus && event.target.matches("[data-mpp-recipe],[data-mpp-layer-opacity],[data-mpp-straighten],[data-mpp-brush],[data-mpp-effect-amount],[data-mpp-mask-feather]")) beginEdit(); }, { signal: controller.signal });
    host.addEventListener("input", (event) => {
      const recipe = event.target.dataset.mppRecipe;
      if (recipe) { beginEdit(); state.recipe[recipe] = Number(event.target.value); state.recipe = normalizeRecipe(state.recipe); const value = host.querySelector(`[data-mpp-value="${recipe}"]`); if (value) value.textContent = `${event.target.value}${recipe === "exposure" ? " EV" : ["contrast", "saturation", "grayscale", "quality"].includes(recipe) ? "%" : recipe === "blur" ? "px" : ""}`; save(); scheduleDraw(); return; }
      const layerId = event.target.dataset.mppLayerOpacity;
      if (layerId) { beginEdit(); const index = state.layers.findIndex((layer) => layer.id === layerId); if (index >= 0 && !state.layers[index].locked) { state.layers[index] = normalizeLayer({ ...state.layers[index], opacity: event.target.value }, index); event.target.closest("label")?.querySelector("b") && (event.target.closest("label").querySelector("b").textContent = `${state.layers[index].opacity}%`); save(); scheduleDraw(); } return; }
      if (event.target.matches("[data-mpp-straighten]")) { beginEdit(); state.straighten = clamp(event.target.value, -15, 15); const value = event.target.closest("label")?.querySelector("b"); if (value) value.textContent = `${state.straighten}°`; save(); scheduleDraw(); return; }
      const brushKey = event.target.dataset.mppBrush; if (brushKey) { beginEdit(); state.brush = normalizeBrush({ ...state.brush, [brushKey]: brushKey === "color" ? event.target.value : Number(event.target.value) }); const value = event.target.closest("label")?.querySelector("b"); if (value) value.textContent = `${state.brush[brushKey]}${brushKey === "size" ? "px" : "%"}`; save(); return; }
      const effectId = event.target.dataset.mppEffectAmount; if (effectId) { beginEdit(); const index = state.effects.findIndex((effect) => effect.id === effectId); if (index >= 0) { state.effects[index] = normalizeEffect({ ...state.effects[index], amount: Number(event.target.value) }, index); const value = event.target.closest("span")?.querySelector("small"); if (value) value.textContent = state.effects[index].amount; save(); scheduleDraw(); } }
      const maskLayerId = event.target.dataset.mppMaskFeather; if (maskLayerId) { beginEdit(); const index = state.layers.findIndex((layer) => layer.id === maskLayerId); if (index >= 0 && !state.layers[index].locked && state.layers[index].mask.type !== "none") { state.layers[index] = normalizeLayer({ ...state.layers[index], mask: { ...state.layers[index].mask, feather: Number(event.target.value) } }, index); const value = event.target.closest("label")?.querySelector("b"); if (value) value.textContent = state.layers[index].mask.feather; save(); scheduleDraw(); } }
    }, { signal: controller.signal });
    host.addEventListener("change", (event) => { handleChange(event).catch((error) => { if (error?.name !== "AbortError") status(error.message || "Không thể cập nhật.", "error"); }); }, { signal: controller.signal });
    host.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); applyState(event.shiftKey ? redoPhotoState(state) : undoPhotoState(state), event.shiftKey ? "Đã làm lại." : "Đã hoàn tác."); }
      else if (event.key.toLowerCase() === "y") { event.preventDefault(); applyState(redoPhotoState(state), "Đã làm lại."); }
    }, { signal: controller.signal });
    host.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-mpp-compare]")) { compare = true; scheduleDraw(true); return; }
      const stage = event.target.closest(".mpp-canvas-stage"); if (!stage || state.photoTool === "move" || !selectedPhoto()) return;
      event.preventDefault(); const point = pointerPoint(stage, event), baseline = photoDocument(state);
      if (state.photoTool === "magic") {
        if (typeof adapters.magicSelect !== "function") { status("Magic Select chưa được cấu hình engine phân đoạn; không tạo vùng chọn giả.", "warning"); return; }
        const requestedPhotoId = state.selectedPhotoId; status("Đang phân đoạn vùng ảnh…", "working");
        Promise.resolve(adapters.magicSelect({ file: selectedPhoto().file, point: point.slice(0, 2), signal: controller.signal })).then((result) => { if (disposed || state.selectedPhotoId !== requestedPhotoId) return; const selection = normalizeSelection(result?.selection || result); if (!selectionHasArea(selection)) throw new Error("Engine không trả về vùng chọn hợp lệ."); applyState(mutatePhotoState(state, "Magic Select", (draft) => { draft.selection = selection; }), "Đã nhận vùng chọn từ adapter."); }).catch((error) => { if (error?.name !== "AbortError") status(error.message || "Magic Select thất bại.", "error"); });
        return;
      }
      if (["brush", "eraser"].includes(state.photoTool)) {
        let layer = state.layers.find((item) => item.id === state.selectedLayerId && item.kind === "paint" && !item.locked);
        if (!layer) { layer = normalizeLayer({ id: uid("layer"), name: "Brush layer", kind: "paint" }, state.layers.length); state.layers.push(layer); state.selectedLayerId = layer.id; }
        const stroke = normalizeStroke({ mode: state.photoTool === "eraser" ? "erase" : "paint", brush: state.brush, points: [point] }); layer.strokes.push(stroke);
        selectionGesture = { type: "brush", pointerId: event.pointerId, stage, baseline, layerId: layer.id, strokeId: stroke.id, lastPoint: point }; stage.setPointerCapture?.(event.pointerId); scheduleDraw(); return;
      }
      selectionGesture = { type: state.photoTool === "crop" ? "crop" : "selection", pointerId: event.pointerId, stage, start: point, baseline, points: [point] }; stage.setPointerCapture?.(event.pointerId);
      if (state.photoTool === "crop") { state.crop = normalizeCrop({ enabled: true, aspect: state.crop.aspect, x: point[0], y: point[1], width: .1, height: .1 }); updateCropOverlay(stage); }
      else { state.selection = normalizeSelection({ type: state.photoTool, x: point[0], y: point[1], width: 0, height: 0, points: [point] }); updateSelectionOverlay(stage); }
    }, { signal: controller.signal });
    host.addEventListener("pointermove", (event) => {
      if (!selectionGesture || event.pointerId !== selectionGesture.pointerId) return;
      const point = pointerPoint(selectionGesture.stage, event);
      if (selectionGesture.type === "brush") {
        const distance = Math.hypot(point[0] - selectionGesture.lastPoint[0], point[1] - selectionGesture.lastPoint[1]), threshold = .08 + state.brush.smoothing / 90;
        if (distance < threshold) return; const layer = state.layers.find((item) => item.id === selectionGesture.layerId), stroke = layer?.strokes.find((item) => item.id === selectionGesture.strokeId); if (!stroke || stroke.points.length >= MAX_STROKE_POINTS) return;
        stroke.points.push(point); selectionGesture.lastPoint = point; scheduleDraw(); return;
      }
      if (selectionGesture.type === "crop") {
        let crop = normalizeCrop({ enabled: true, aspect: state.crop.aspect, x: Math.min(selectionGesture.start[0], point[0]), y: Math.min(selectionGesture.start[1], point[1]), width: Math.max(.1, Math.abs(point[0] - selectionGesture.start[0])), height: Math.max(.1, Math.abs(point[1] - selectionGesture.start[1])) });
        if (crop.aspect !== "free") { const photo = selectedPhoto(), ratio = photo?.width && photo?.height ? photo.width / photo.height : 1; crop = applyCropAspect(crop, crop.aspect, ratio); }
        state.crop = crop; updateCropOverlay(selectionGesture.stage); return;
      }
      if (state.photoTool === "lasso") { selectionGesture.points.push(point); state.selection = normalizeSelection({ type: "lasso", points: selectionGesture.points }); }
      else state.selection = normalizeSelection({ type: state.photoTool, x: Math.min(selectionGesture.start[0], point[0]), y: Math.min(selectionGesture.start[1], point[1]), width: Math.abs(point[0] - selectionGesture.start[0]), height: Math.abs(point[1] - selectionGesture.start[1]) });
      updateSelectionOverlay(selectionGesture.stage);
    }, { signal: controller.signal });
    host.addEventListener("pointerup", (event) => {
      if (!selectionGesture || event.pointerId !== selectionGesture.pointerId) return;
      const gesture = selectionGesture, before = gesture.baseline; gesture.stage.releasePointerCapture?.(event.pointerId); selectionGesture = null;
      if (gesture.type === "selection" && !selectionHasArea(state.selection)) { state = restorePhotoDocument(state, before); save(); render(); status("Vùng chọn quá nhỏ nên đã được hủy.", "warning"); return; }
      const label = gesture.type === "brush" ? (state.photoTool === "eraser" ? "Tẩy nét" : "Vẽ nét") : gesture.type === "crop" ? "Crop ảnh" : "Tạo vùng chọn";
      if (JSON.stringify(before) !== JSON.stringify(photoDocument(state))) state.history = normalizeHistory({ undo: [...state.history.undo, { id: uid("history"), label, createdAt: now(), snapshot: before }], redo: [] });
      save(); render(); status(gesture.type === "brush" ? "Đã ghi nét vào paint layer." : gesture.type === "crop" ? "Đã áp dụng crop không phá hủy." : "Đã tạo vùng chọn.");
    }, { signal: controller.signal });
    host.addEventListener("pointercancel", (event) => { if (!selectionGesture || event.pointerId !== selectionGesture.pointerId) return; const baseline = selectionGesture.baseline; selectionGesture = null; state = restorePhotoDocument(state, baseline); save(); render(); status("Đã hủy thao tác con trỏ.", "warning"); }, { signal: controller.signal });
    globalScope.addEventListener?.("resize", () => syncCanvasOverlays(), { signal: controller.signal });
    globalScope.addEventListener?.("pointerup", () => { if (compare) { compare = false; scheduleDraw(false); } }, { signal: controller.signal });
    host.addEventListener("dragstart", (event) => { const row = event.target.closest("[data-mpp-layer-row]"); if (row) { draggedLayerId = row.dataset.mppLayerRow; event.dataTransfer?.setData("text/x-hh-layer", draggedLayerId); event.dataTransfer && (event.dataTransfer.effectAllowed = "move"); } }, { signal: controller.signal });
    host.addEventListener("dragend", () => { draggedLayerId = ""; }, { signal: controller.signal });
    host.addEventListener("dragover", (event) => { if (event.target.closest("[data-mpp-layer-row]") && draggedLayerId) { event.preventDefault(); return; } if (workspace === "photo-workspace" && event.dataTransfer?.types?.includes("Files")) event.preventDefault(); }, { signal: controller.signal });
    host.addEventListener("drop", (event) => {
      const row = event.target.closest("[data-mpp-layer-row]");
      if (row && draggedLayerId) { event.preventDefault(); const index = state.layers.findIndex((layer) => layer.id === row.dataset.mppLayerRow); applyState(reorderLayer(state, draggedLayerId, index), "Đã sắp xếp layer."); draggedLayerId = ""; return; }
      if (workspace !== "photo-workspace" || !event.dataTransfer?.files?.length) return; event.preventDefault(); ingestPhotos(event.dataTransfer.files).catch((error) => status(error.message, "error"));
    }, { signal: controller.signal });
    render(false); refreshProjectStorage();
    const instance = { controller, objectUrls, dispose: () => { disposed = true; drawVersion += 1; cancelFrame(frame); sourceCache.forEach((source) => source?.close?.()); sourceCache.clear(); decodeJobs.clear(); selectionGesture = null; }, getState: () => ({ ui: clone(state), project: clone(projectState), photos: photos.map(({ file, url, ...item }) => ({ ...item, size: file.size })) }) };
    active.set(host, instance); restorePhotos(); return instance;
  }

  function unmount(host) {
    const rows = host ? [[host, active.get(host)]] : [...active.entries()];
    rows.forEach(([node, instance]) => { if (!instance) return; instance.controller.abort(); instance.dispose?.(); instance.objectUrls.forEach((url) => URL.revokeObjectURL(url)); node.innerHTML = ""; active.delete(node); });
  }

  return Object.freeze({
    SCHEMA, STORAGE_KEY, STATE_VERSION, MAX_PHOTO_BYTES, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, MAX_PHOTOS, MAX_LAYERS, MAX_EFFECTS, MAX_BATCH_EXPORTS, IMAGE_TYPES, BLEND_MODES, EFFECT_TYPES,
    defaultRecipe, normalizeRecipe, normalizeTransform, normalizeSelection, selectionHasArea, normalizeCrop, mapSelectionToCrop, normalizeBrush, normalizeStroke, normalizeMask, normalizeEffect, normalizeEffects, normalizeLayer, normalizeLayers, normalizeState, createStore,
    photoDocument, mutatePhotoState, undoPhotoState, redoPhotoState, addLayer, updateLayer, deleteLayer, reorderLayer, duplicateLayer, mergeLayerDown,
    addEffect, updateEffect, deleteEffect, reorderEffect, cropRect, applyCropAspect, createBatchExportPlan,
    recipeFilter, calculateHistogram, calculateSurfaceHistogram, histogramPath, detectImageType, detectImageDimensions, dimensionsAreSafe, validateImageFile, photoCapabilities, encodeSurface, flattenVisibleLayers, traceSelectionPath, selectionMaskSurface, applyLayerMask, drawPaintStrokes, applyEffectStack, drawSource, drawComposite, drawBeforeAfter,
    mount, unmount
  });
});
