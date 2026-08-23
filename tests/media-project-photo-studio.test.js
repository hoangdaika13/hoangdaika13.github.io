const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const studio = require(path.join(root, "media-project-photo-studio.js"));
const source = fs.readFileSync(path.join(root, "media-project-photo-studio.js"), "utf8");
const css = fs.readFileSync(path.join(root, "media-project-photo-studio.css"), "utf8");
const page = fs.readFileSync(path.join(root, "media-design-page.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("photo recipes are bounded, deterministic and non-destructive", () => {
  const recipe = studio.normalizeRecipe({ exposure: 99, contrast: -8, saturation: 999, temperature: -999, blur: 90, grayscale: 250, rotation: 91, quality: 3, format: "image/tiff" });
  assert.deepEqual(recipe, { exposure: 3, contrast: 20, saturation: 240, temperature: -100, blur: 12, grayscale: 100, rotation: 0, flipX: false, flipY: false, quality: 30, format: "image/webp" });
  assert.match(studio.recipeFilter(recipe), /brightness\(800%\).*contrast\(20%\).*saturate\(240%\)/);
  assert.deepEqual(studio.defaultRecipe(), { exposure: 0, contrast: 100, saturation: 100, temperature: 0, blur: 0, grayscale: 0, rotation: 0, flipX: false, flipY: false, quality: 92, format: "image/webp" });
});

test("histogram samples real RGB pixels into stable channels", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const histogram = studio.calculateHistogram(pixels, 8);
  assert.equal(histogram.samples, 4);
  assert.equal(histogram.red.reduce((a, b) => a + b, 0), 4);
  assert.equal(histogram.green.reduce((a, b) => a + b, 0), 4);
  assert.equal(histogram.blue.reduce((a, b) => a + b, 0), 4);
  assert.match(studio.histogramPath(histogram.luminance), /^M/);
});

test("Project Core and Photo Lab expose real workflows and shared Media Bin ingest", () => {
  ["data-mpp-checkpoint", "data-mpp-branch-form", "data-mpp-import-assets", "data-mpp-export-manifest", "data-mpp-photo-files", "data-mpp-photo-canvas", "data-mpp-recipe", "data-mpp-export-photo"].forEach((token) => assert.match(source, new RegExp(token)));
  assert.match(source, /createStateStore/);
  assert.match(source, /addAssetRecord/);
  assert.match(source, /saveAsset/);
  assert.match(source, /createImageBitmap/);
  assert.match(source, /OffscreenCanvas/);
  assert.match(page, /HHMediaProjectPhotoStudio\?\.mount/);
});

test("new studios are colorful, responsive, motion-safe and offline cached", () => {
  assert.match(css, /is-project/);
  assert.match(css, /is-photo/);
  assert.match(css, /mpp-photo-develop/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(loader, /media-project-photo-studio\.css\?v=5/);
  assert.match(loader, /media-project-photo-studio\.js\?v=4/);
  assert.match(worker, /media-project-photo-studio\.css\?v=5/);
  assert.match(worker, /media-project-photo-studio\.js\?v=4/);
});

test("Layer Studio performs bounded CRUD, reorder, lock, blend and exact undo redo", () => {
  let state = studio.normalizeState({});
  state = studio.addLayer(state, { id: "background", name: "Nền", sourcePhotoId: "photo-a" });
  state = studio.addLayer(state, { id: "glow", name: "Hào quang", sourcePhotoId: "photo-b", blendMode: "screen", opacity: 64 });
  assert.deepEqual(state.layers.map((layer) => layer.id), ["background", "glow"]);
  assert.equal(state.selectedLayerId, "glow");

  state = studio.reorderLayer(state, "glow", 0);
  assert.deepEqual(state.layers.map((layer) => layer.id), ["glow", "background"]);
  state = studio.updateLayer(state, "glow", { name: "Ánh sáng", opacity: 41, blendMode: "color-dodge" });
  assert.equal(state.layers[0].name, "Ánh sáng");
  assert.equal(state.layers[0].opacity, 41);
  assert.equal(state.layers[0].blendMode, "color-dodge");

  const edited = state;
  state = studio.undoPhotoState(state);
  assert.equal(state.layers[0].name, "Hào quang");
  state = studio.redoPhotoState(state);
  assert.deepEqual(studio.photoDocument(state), studio.photoDocument(edited));

  state = studio.updateLayer(state, "glow", { locked: true });
  const locked = studio.deleteLayer(state, "glow");
  assert.ok(locked.layers.some((layer) => layer.id === "glow"));
  state = studio.updateLayer(locked, "glow", { locked: false });
  state = studio.duplicateLayer(state, "glow");
  assert.equal(state.layers.length, 3);
  assert.notEqual(state.layers[1].id, "glow");
  state = studio.mergeLayerDown(state, state.layers[1].id);
  assert.equal(state.layers[0].kind, "group");
  assert.equal(state.layers[0].children.length, 2);
});

test("layer, transform, selection and history payloads reject hostile or excessive state", () => {
  const layers = Array.from({ length: studio.MAX_LAYERS + 25 }, (_, index) => ({
    id: index < 2 ? "duplicate" : `layer-${index}`,
    name: "x".repeat(300), opacity: index % 2 ? 999 : -20, blendMode: "script", transform: { x: 999999, scaleX: 0, rotation: 900 }
  }));
  const state = studio.normalizeState({
    layers, selectedLayerId: "x".repeat(200), photoTool: "inject", selection: { type: "lasso", points: Array.from({ length: 3000 }, () => [-4, 500]) },
    history: { undo: Array.from({ length: 100 }, (_, index) => ({ label: `Edit ${index}`, snapshot: {} })), redo: [] }
  });
  assert.equal(state.version, studio.STATE_VERSION);
  assert.equal(state.layers.length, studio.MAX_LAYERS);
  assert.equal(new Set(state.layers.map((layer) => layer.id)).size, state.layers.length);
  assert.ok(state.layers.every((layer) => layer.name.length <= 120 && studio.BLEND_MODES.includes(layer.blendMode)));
  assert.equal(state.layers[0].transform.x, 32768);
  assert.equal(state.layers[0].transform.scaleX, 0.05);
  assert.equal(state.photoTool, "move");
  assert.equal(state.selection.points.length, 2048);
  assert.deepEqual(state.selection.points[0], [0, 100]);
  assert.equal(state.history.undo.length, 80);
});

test("image import validates magic bytes, MIME, unsafe SVG and size before decoding", async () => {
  const namedBlob = (bytes, name, type) => {
    const blob = new Blob([Uint8Array.from(bytes)], { type });
    Object.defineProperties(blob, { name: { value: name }, lastModified: { value: 1 } });
    return blob;
  };
  const png = namedBlob([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0], "safe.png", "image/png");
  const valid = await studio.validateImageFile(png);
  assert.equal(valid.valid, true);
  assert.equal(valid.type, "image/png");
  assert.equal(studio.detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])), "image/jpeg");
  assert.equal(studio.detectImageType(Uint8Array.from(Buffer.from("RIFF0000WEBP"))), "image/webp");

  const mismatch = await studio.validateImageFile(namedBlob([0xff, 0xd8, 0xff, 0xdb], "spoof.png", "image/png"));
  assert.equal(mismatch.code, "mime-mismatch");
  const svg = await studio.validateImageFile(namedBlob(Buffer.from("<svg><script/></svg>"), "attack.svg", "image/svg+xml"));
  assert.equal(svg.code, "unsafe-vector");
  const oversized = { name: "huge.png", type: "image/png", size: studio.MAX_PHOTO_BYTES + 1, slice: png.slice.bind(png) };
  assert.equal((await studio.validateImageFile(oversized)).code, "file-too-large");
  const hugeHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x9c, 0x40, 0, 0, 0x9c, 0x40];
  const unsafeDimensions = await studio.validateImageFile(namedBlob(hugeHeader, "decompression-bomb.png", "image/png"));
  assert.equal(unsafeDimensions.code, "unsafe-dimensions");
  assert.equal(studio.dimensionsAreSafe({ width: 10000, height: 9000 }), false);
});

test("export reports actual browser MIME fallback instead of claiming requested codec", async () => {
  const surface = { convertToBlob: async () => new Blob(["png"], { type: "image/png" }) };
  const encoded = await studio.encodeSurface(surface, "image/webp", 0.92);
  assert.equal(encoded.requestedType, "image/webp");
  assert.equal(encoded.actualType, "image/png");
  assert.equal(encoded.fallback, true);
  assert.deepEqual(studio.photoCapabilities({ document: { createElement() {} } }).formats, {
    "image/png": "required", "image/jpeg": "verify-on-export", "image/webp": "verify-on-export"
  });
});

test("canvas composition honors real layer order, opacity, blend and visibility", () => {
  const previous = globalThis.OffscreenCanvas, contexts = [];
  class FakeContext {
    constructor() { this.globalAlpha = 1; this.globalCompositeOperation = "source-over"; this.draws = []; contexts.push(this); }
    clearRect() {}
    save() {}
    restore() {}
    translate() {}
    rotate() {}
    scale() {}
    fillRect() {}
    drawImage(source) { this.draws.push({ source, alpha: this.globalAlpha, blend: this.globalCompositeOperation }); }
    getImageData() { return { data: new Uint8ClampedArray(4) }; }
  }
  class FakeCanvas {
    constructor(width = 1, height = 1) { this.width = width; this.height = height; this.context = new FakeContext(); }
    getContext() { return this.context; }
  }
  globalThis.OffscreenCanvas = FakeCanvas;
  try {
    const sourceA = { width: 200, height: 100 }, sourceB = { width: 80, height: 60 };
    const layers = [
      { id: "a", name: "A", sourcePhotoId: "a", opacity: 50, blendMode: "screen" },
      { id: "b", name: "B", sourcePhotoId: "b", visible: false }
    ];
    const surface = new FakeCanvas();
    const output = studio.drawComposite(surface, new Map([["a", sourceA], ["b", sourceB]]), layers, studio.defaultRecipe(), 1600);
    assert.equal(output.renderedLayers, 1);
    assert.ok(contexts.flatMap((context) => context.draws).some((draw) => draw.source === sourceA));
    const compositeDraw = contexts.flatMap((context) => context.draws).find((draw) => draw.alpha === 0.5 && draw.blend === "screen");
    assert.ok(compositeDraw, "opacity and blend are applied when the isolated layer surface is composited");

    const transparent = studio.drawComposite(new FakeCanvas(), new Map([["a", sourceA]]), [{ ...layers[0], visible: false }], studio.defaultRecipe(), 1600);
    assert.equal(transparent.renderedLayers, 0);
  } finally {
    if (previous === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = previous;
  }
});

test("photo workspace exposes native layer controls, selection, cleanup and one main scroll", () => {
  ["data-mpp-layer-row", "data-mpp-layer-visible", "data-mpp-layer-lock", "data-mpp-layer-opacity", "data-mpp-layer-blend", "data-mpp-duplicate-layer", "data-mpp-merge-layer", "data-mpp-delete-layer", "data-mpp-undo", "data-mpp-redo", "data-mpp-selection-overlay", "validateImageFile", "encodeSurface"].forEach((token) => assert.match(source, new RegExp(token)));
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /sourceCache\.forEach/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(css, /Photo & Image v2/);
  assert.match(css, /mpp-layer-studio/);
  assert.match(css, /media-project-photo-studio\.is-photo>main\{[^}]*overflow:auto/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*mpp-layer-list/);
});

test("crop and straighten stay normalized, aspect-aware and restorable by history", () => {
  assert.equal(studio.selectionHasArea({ type: "rectangle", x: 1, y: 1, width: 0, height: 20 }), false);
  assert.equal(studio.selectionHasArea({ type: "lasso", points: [[1, 1], [2, 2], [3, 1]] }), true);
  assert.deepEqual(studio.normalizeCrop({ enabled: true, x: 90, y: 95, width: 50, height: 90, aspect: "hack" }), { enabled: true, x: 90, y: 95, width: 10, height: 5, aspect: "free" });
  const square = studio.applyCropAspect({ enabled: true, x: 0, y: 0, width: 80, height: 70 }, "1:1", 2);
  assert.equal(square.aspect, "1:1");
  assert.equal(square.width / square.height, 0.5);
  assert.deepEqual(studio.cropRect(1000, 500, { enabled: true, x: 10, y: 20, width: 50, height: 40 }), { x: 100, y: 100, width: 500, height: 200 });
  assert.deepEqual(studio.mapSelectionToCrop({ type: "rectangle", x: 20, y: 30, width: 20, height: 20 }, { enabled: true, x: 10, y: 20, width: 50, height: 40 }), { type: "rectangle", x: 20, y: 25, width: 40, height: 50, points: [] });

  let state = studio.normalizeState({});
  state = studio.mutatePhotoState(state, "Crop", (draft) => { draft.crop = { enabled: true, x: 10, y: 15, width: 70, height: 60, aspect: "free" }; draft.straighten = 99; });
  assert.equal(state.crop.enabled, true);
  assert.equal(state.straighten, 15);
  state = studio.undoPhotoState(state);
  assert.equal(state.crop.enabled, false);
  assert.equal(state.straighten, 0);
});

test("effect stack is bounded, ordered, independently enabled and undoable", () => {
  let state = studio.normalizeState({ effects: Array.from({ length: 40 }, (_, index) => ({ id: `effect-${index}`, type: "grain", amount: 999 })) });
  assert.equal(state.effects.length, studio.MAX_EFFECTS);
  assert.ok(state.effects.every((effect) => effect.amount === 100));
  state = studio.normalizeState({});
  state = studio.addEffect(state, "vignette");
  const vignetteId = state.effects[0].id;
  state = studio.addEffect(state, "warmth");
  const warmthId = state.effects[1].id;
  state = studio.updateEffect(state, vignetteId, { amount: 75, enabled: false });
  assert.deepEqual(state.effects.map((effect) => [effect.type, effect.enabled, effect.amount]), [["vignette", false, 75], ["warmth", true, 30]]);
  state = studio.reorderEffect(state, warmthId, 0);
  assert.deepEqual(state.effects.map((effect) => effect.type), ["warmth", "vignette"]);
  state = studio.deleteEffect(state, vignetteId);
  assert.deepEqual(state.effects.map((effect) => effect.type), ["warmth"]);
  state = studio.undoPhotoState(state);
  assert.equal(state.effects.length, 2);
});

test("mask, clipping and brush metadata are bounded and carried by Layer Studio history", () => {
  const hostileStroke = { mode: "paint", brush: { size: 999, opacity: -5, color: "url(js)" }, points: Array.from({ length: 800 }, () => [-10, 500, 7]) };
  let state = studio.addLayer(studio.normalizeState({}), { id: "paint", kind: "paint", strokes: [hostileStroke] });
  let paint = state.layers[0];
  assert.equal(paint.strokes[0].points.length, 512);
  assert.deepEqual(paint.strokes[0].points[0], [0, 100, 1]);
  assert.equal(paint.strokes[0].brush.size, 240);
  assert.equal(paint.strokes[0].brush.opacity, 1);
  assert.equal(paint.strokes[0].brush.color, "#ff6bce");
  state = studio.updateLayer(state, "paint", { clippingToBelow: true, mask: { type: "selection", enabled: true, inverted: true, feather: 999, selection: { type: "ellipse", x: 10, y: 10, width: 50, height: 50 } } }, "Mask layer");
  paint = state.layers[0];
  assert.equal(paint.clippingToBelow, true);
  assert.equal(paint.mask.type, "selection");
  assert.equal(paint.mask.feather, 100);
  assert.equal(paint.mask.selection.type, "ellipse");
  state = studio.undoPhotoState(state);
  assert.equal(state.layers[0].mask.type, "none");
  assert.equal(state.layers[0].clippingToBelow, false);
});

test("magic selection is capability-gated and batch plans never claim unsupported work", () => {
  assert.equal(studio.photoCapabilities({ document: { createElement() {} } }).magicSelect, "unavailable");
  assert.equal(studio.photoCapabilities({ document: { createElement() {} } }, { magicSelect() {} }).magicSelect, "adapter-ready");
  const photos = [
    { id: "a", name: "alpha.png", size: 100, width: 1200, height: 800 },
    { id: "b", name: "beta.png", size: 100, width: 40000, height: 10 }
  ];
  let plan = studio.createBatchExportPlan(photos, [], { format: "image/webp" }, { formats: { "image/webp": "verify-on-export" } });
  assert.equal(plan.valid, false);
  assert.match(plan.blockers[0], /Chưa chọn/);
  plan = studio.createBatchExportPlan(photos, ["a"], { format: "image/jpeg" }, { formats: { "image/jpeg": "verify-on-export" } });
  assert.equal(plan.valid, true);
  assert.match(plan.warnings[0], /alpha/);
  plan = studio.createBatchExportPlan(photos, ["a"], { format: "image/webp" }, { formats: { "image/webp": "unavailable" } });
  assert.equal(plan.valid, false);
  assert.match(plan.blockers.join(" "), /không có bộ mã hóa/);
  plan = studio.createBatchExportPlan(photos, ["b"], { format: "image/png" }, { formats: { "image/png": "required" } });
  assert.equal(plan.valid, false);
  assert.match(plan.blockers.join(" "), /kích thước/);
  plan = studio.createBatchExportPlan(photos, ["a", "stale-id"], { format: "image/png" }, { formats: { "image/png": "required" } });
  assert.equal(plan.valid, false);
  assert.match(plan.blockers.join(" "), /không còn/);
});

test("Photo v3 exposes real crop, brush, masks, effects, before-after and batch UI", () => {
  ["data-mpp-crop-aspect", "data-mpp-straighten", "data-mpp-brush", "data-mpp-layer-clipping", "data-mpp-mask-from-selection", "data-mpp-mask-feather", "data-mpp-add-effect", "data-mpp-effect-amount", "data-mpp-compare-mode", "data-mpp-batch-photo", "data-mpp-batch-export"].forEach((token) => assert.match(source, new RegExp(token)));
  assert.match(source, /Magic Select chưa được cấu hình/);
  assert.match(source, /drawBeforeAfter/);
  assert.match(source, /pointercancel/);
  assert.match(css, /Photo & Image v3/);
  assert.match(css, /mpp-crop-overlay/);
  assert.match(css, /mpp-effect-stack/);
  assert.match(css, /mpp-mask-controls/);
  assert.match(css, /mpp-batch-warning/);
});

test("renderer applies crop, paint strokes, selection mask and effects to real canvas operations", () => {
  const previous = globalThis.OffscreenCanvas, operations = [];
  class Context {
    constructor() { this.globalAlpha = 1; this.globalCompositeOperation = "source-over"; this.filter = "none"; }
    clearRect() { operations.push("clear"); }
    save() {}
    restore() {}
    translate() {}
    rotate() {}
    scale() {}
    beginPath() { operations.push("beginPath"); }
    rect() { operations.push("rect"); }
    ellipse() { operations.push("ellipse"); }
    moveTo() {}
    lineTo() { operations.push("lineTo"); }
    closePath() {}
    arc() { operations.push("arc"); }
    clip() { operations.push("clip"); }
    fill() { operations.push("fill"); }
    stroke() { operations.push("stroke"); }
    fillRect() { operations.push(`fillRect:${this.globalCompositeOperation}`); }
    drawImage() { operations.push(`draw:${this.globalCompositeOperation}`); }
    getImageData() { return { data: new Uint8ClampedArray(4) }; }
    createRadialGradient() { return { addColorStop() {} }; }
  }
  class Canvas {
    constructor(width = 1, height = 1) { this.width = width; this.height = height; this.context = new Context(); }
    getContext() { return this.context; }
  }
  globalThis.OffscreenCanvas = Canvas;
  try {
    const image = { width: 200, height: 100 };
    const layers = [
      { id: "image", sourcePhotoId: "image", mask: { type: "selection", enabled: true, selection: { type: "ellipse", x: 10, y: 10, width: 80, height: 80 } } },
      { id: "paint", kind: "paint", strokes: [{ mode: "paint", brush: { size: 10, color: "#ff0000" }, points: [[10, 10, 1], [90, 90, 1]] }] }
    ];
    const surface = new Canvas();
    const result = studio.drawComposite(surface, new Map([["image", image]]), layers, studio.defaultRecipe(), 1600, {
      crop: { enabled: true, x: 0, y: 0, width: 50, height: 50 }, effects: [{ type: "warmth", amount: 40 }]
    });
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
    assert.equal(result.renderedLayers, 2);
    assert.ok(operations.includes("ellipse"));
    assert.ok(operations.includes("stroke"));
    assert.ok(operations.some((operation) => operation === "fillRect:soft-light"));
    assert.ok(operations.some((operation) => operation === "draw:destination-in"));
  } finally {
    if (previous === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = previous;
  }
});
