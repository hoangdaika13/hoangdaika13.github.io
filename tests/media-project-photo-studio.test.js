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
  assert.match(loader, /media-project-photo-studio\.css\?v=4/);
  assert.match(loader, /media-project-photo-studio\.js\?v=3/);
  assert.match(worker, /media-project-photo-studio\.css\?v=4/);
  assert.match(worker, /media-project-photo-studio\.js\?v=3/);
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
    const layerDraw = contexts.flatMap((context) => context.draws).find((draw) => draw.source === sourceA);
    assert.equal(layerDraw.alpha, 0.5);
    assert.equal(layerDraw.blend, "screen");

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
