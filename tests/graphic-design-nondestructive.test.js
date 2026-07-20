const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-nondestructive.js");
const source = fs.readFileSync(file, "utf8");
const nondestructive = require(file);

const IMAGE_A = "data:image/png;base64,AAAA";
const IMAGE_B = "data:image/webp;base64,BBBB";

function asset(dataUrl = IMAGE_A, overrides = {}) {
  return {
    id: "asset-source",
    name: "Local <source>.png",
    type: dataUrl.includes("webp") ? "image/webp" : "image/png",
    width: 800,
    height: 600,
    dataUrl,
    ...overrides
  };
}

function projectWithSmartObject() {
  const imported = nondestructive.importAsset(nondestructive.createDefaultProject(), asset(), { name: "Hero <unsafe>" });
  return { ...imported, project: imported.project };
}

test("exposes the standalone UMD/global lifecycle and pure engine API", () => {
  assert.equal(nondestructive.VERSION, 1);
  assert.equal(nondestructive.FORMAT, "hh-graphic-nondestructive");
  assert.equal(nondestructive.STORAGE_KEY, "hh.graphic-nondestructive.project.v1");
  for (const method of [
    "createEngine", "addAdjustmentLayer", "addSmartFilter", "updateFilterMask",
    "updateLinkedSmartObject", "reorderModifier", "serializeProject", "deserializeProject",
    "renderProject", "mount", "unmount"
  ]) assert.equal(typeof nondestructive[method], "function", `${method} should be exported`);
  assert.match(source, /globalScope\.HHGraphicNondestructive = api/);
  assert.match(source, /if \(typeof module !== "undefined" && module\.exports\) module\.exports = api/);
  assert.match(source, /instances\.has\(root\)/);
  assert.match(source, /instances\.delete\(root\)/);
});

test("normalization bounds user data and rejects unsafe or unsupported assets", () => {
  const project = nondestructive.normalizeProject({
    name: "n".repeat(300),
    width: -10,
    height: 90000,
    assets: [
      asset("https://remote.invalid/image.png"),
      asset(IMAGE_A, { id: "asset<script>", name: "x".repeat(300), width: 0, height: 99999 })
    ],
    layers: [{
      id: "layer<script>",
      type: "smart-object",
      assetId: "asset<script>",
      opacity: 8,
      blendMode: "unsafe-mode",
      modifiers: [{
        id: "filter<script>", type: "smart-filter", kind: "blur", value: 999,
        mask: { enabled: true, shape: "triangle", x: -4, y: 7, width: 0, height: 5, opacity: 9, feather: 900 }
      }, { type: "remote-plugin" }]
    }]
  });
  assert.equal(project.name.length, 160);
  assert.equal(project.width, 64);
  assert.equal(project.height, 8192);
  assert.equal(project.assets.length, 1);
  assert.doesNotMatch(project.assets[0].id, /[<>]/);
  assert.equal(project.assets[0].name.length, 160);
  assert.equal(project.assets[0].width, 1);
  assert.equal(project.assets[0].height, 16384);
  assert.equal(project.layers[0].opacity, 1);
  assert.equal(project.layers[0].blendMode, "source-over");
  assert.equal(project.layers[0].modifiers.length, 1);
  assert.equal(project.layers[0].modifiers[0].value, 32);
  assert.deepEqual(project.layers[0].modifiers[0].mask, {
    enabled: true, inverted: false, shape: "full", x: 0, y: 1,
    width: 0.02, height: 1, opacity: 1, feather: 100
  });
  assert.throws(
    () => nondestructive.addAsset(project, asset("https://remote.invalid/image.png")),
    (error) => error.code === "UNSUPPORTED_ASSET"
  );
});

test("adjustment layers, smart filters, masks, toggles, and stack order remain editable", () => {
  const imported = projectWithSmartObject();
  const first = nondestructive.addSmartFilter(imported.project, imported.layerId, { id: "first", kind: "brightness", value: 130 });
  const second = nondestructive.addSmartFilter(first.project, imported.layerId, { id: "second", kind: "blur", value: 6 });
  let project = nondestructive.reorderModifier(second.project, imported.layerId, second.modifierId, 0);
  let layer = project.layers.find((candidate) => candidate.id === imported.layerId);
  assert.deepEqual(layer.modifiers.map((modifier) => modifier.kind), ["blur", "brightness"]);

  project = nondestructive.setModifierEnabled(project, imported.layerId, second.modifierId, false);
  project = nondestructive.updateFilterMask(project, imported.layerId, second.modifierId, {
    enabled: true, shape: "ellipse", x: 0.25, y: 0.75, width: 0.4, height: 0.6, opacity: 0.7, feather: 18, inverted: true
  });
  layer = project.layers.find((candidate) => candidate.id === imported.layerId);
  assert.equal(layer.modifiers[0].enabled, false);
  assert.deepEqual(layer.modifiers[0].mask, {
    enabled: true, inverted: true, shape: "ellipse", x: 0.25, y: 0.75,
    width: 0.4, height: 0.6, opacity: 0.7, feather: 18
  });

  const adjustment = nondestructive.addAdjustmentLayer(project, {
    name: "Global tone", settings: { brightness: 120, contrast: 88, hue: -30 },
    mask: { enabled: true, shape: "linear", opacity: 0.5 }
  });
  assert.equal(adjustment.project.layers[0].type, "adjustment");
  assert.equal(adjustment.project.layers[0].modifiers[0].settings.brightness, 120);
  const stacked = nondestructive.addAdjustmentModifier(adjustment.project, adjustment.layerId, { settings: { sepia: 50 } });
  assert.equal(stacked.project.layers[0].modifiers.length, 2);
});

test("one linked source update reaches every smart object instance without flattening filters", () => {
  const imported = projectWithSmartObject();
  const filtered = nondestructive.addSmartFilter(imported.project, imported.layerId, { kind: "contrast", value: 135 });
  const linked = nondestructive.addSmartObject(filtered.project, imported.assetId, { name: "Linked instance" });
  const updated = nondestructive.updateLinkedSmartObject(linked.project, imported.assetId, asset(IMAGE_B, {
    name: "Replacement.webp", type: "image/webp", width: 1024, height: 768
  }));

  assert.equal(updated.project.assets.length, 1);
  assert.equal(updated.project.assets[0].dataUrl, IMAGE_B);
  assert.equal(updated.project.assets[0].sourceVersion, 2);
  assert.equal(updated.affectedLayerIds.length, 2);
  assert.ok(updated.project.layers.every((layer) => layer.assetId === imported.assetId));
  const originalInstance = updated.project.layers.find((layer) => layer.id === imported.layerId);
  assert.equal(originalInstance.modifiers[0].kind, "contrast");
  assert.equal(originalInstance.modifiers[0].value, 135);
});

test("history supports undo, redo, branch truncation, and a bounded stack", () => {
  const engine = nondestructive.createEngine(undefined, { historyLimit: 4 });
  const imported = engine.importAsset(asset(), { name: "Base" });
  const filter = engine.addSmartFilter(imported.layerId, { kind: "sepia", value: 50 });
  engine.updateFilterMask(imported.layerId, filter.modifierId, { enabled: true, shape: "rectangle" });
  assert.equal(engine.getProject().layers[0].modifiers[0].mask.enabled, true);
  assert.equal(engine.getHistoryState().length, 4);

  assert.equal(engine.undo(), true);
  assert.equal(engine.getProject().layers[0].modifiers[0].mask.enabled, false);
  assert.equal(engine.redo(), true);
  assert.equal(engine.getProject().layers[0].modifiers[0].mask.enabled, true);
  assert.equal(engine.undo(), true);
  engine.updateLayer(imported.layerId, { opacity: 0.4 });
  assert.equal(engine.getHistoryState().canRedo, false);
  assert.equal(engine.getProject().layers[0].opacity, 0.4);
});

test("project serialization round-trips local assets and reports unsupported schemas honestly", () => {
  const imported = projectWithSmartObject();
  const adjusted = nondestructive.addAdjustmentLayer(imported.project, { settings: { saturate: 160 } });
  const serialized = nondestructive.serializeProject(adjusted.project);
  const parsed = JSON.parse(serialized);
  const restored = nondestructive.deserializeProject(serialized);
  assert.equal(parsed.format, nondestructive.FORMAT);
  assert.equal(parsed.version, nondestructive.VERSION);
  assert.equal(restored.assets[0].dataUrl, IMAGE_A);
  assert.equal(restored.layers.length, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "history"), false);
  assert.throws(
    () => nondestructive.deserializeProject("not json"),
    (error) => error.code === "INVALID_JSON"
  );
  assert.throws(
    () => nondestructive.deserializeProject(JSON.stringify({ format: "other", version: 1 })),
    (error) => error.code === "UNSUPPORTED_FORMAT"
  );
  assert.throws(
    () => nondestructive.deserializeProject(JSON.stringify({ format: nondestructive.FORMAT, version: 99 })),
    (error) => error.code === "UNSUPPORTED_VERSION"
  );
});

test("modifier filters compile deterministically in stack-ready Canvas2D syntax", () => {
  assert.equal(
    nondestructive.compileModifierFilter({ type: "smart-filter", kind: "blur", value: 7.5 }),
    "blur(7.5px)"
  );
  assert.equal(
    nondestructive.compileModifierFilter({
      type: "adjustment",
      settings: { brightness: 110, contrast: 90, saturate: 140, grayscale: 5, sepia: 12, hue: -22 }
    }),
    "brightness(110%) contrast(90%) saturate(140%) grayscale(5%) sepia(12%) hue-rotate(-22deg)"
  );
});

test("Canvas2D renderer paints smart objects, adjustment layers, masks, and unsupported states", async () => {
  const calls = [];
  function context() {
    const value = {
      clearRect(...args) { calls.push(["clearRect", ...args]); },
      drawImage(...args) { calls.push(["drawImage", args.length]); },
      fillRect(...args) { calls.push(["fillRect", ...args]); },
      save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, ellipse() {}, fill() {},
      createLinearGradient() { return { addColorStop() {} }; },
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillStyle: "#000"
    };
    let filter = "none";
    Object.defineProperty(value, "filter", {
      get() { return filter; },
      set(next) { filter = next; calls.push(["filter", next]); }
    });
    return value;
  }
  function canvas() {
    const ctx = context();
    return { width: 0, height: 0, getContext(kind) { return kind === "2d" ? ctx : null; } };
  }

  const imported = projectWithSmartObject();
  const filtered = nondestructive.addSmartFilter(imported.project, imported.layerId, {
    kind: "blur", value: 3, mask: { enabled: true, shape: "ellipse", feather: 4 }
  });
  const adjusted = nondestructive.addAdjustmentLayer(filtered.project, { settings: { contrast: 120 } });
  const output = canvas();
  const result = await nondestructive.renderProject(output, adjusted.project, {
    maxDimension: 400,
    createCanvas: canvas,
    resolveImage: () => ({ naturalWidth: 800, naturalHeight: 600 })
  });
  assert.equal(result.supported, true);
  assert.equal(result.filtersSupported, true);
  assert.equal(result.renderedLayers, 2);
  assert.equal(output.width, 400);
  assert.equal(output.height, 300);
  assert.ok(calls.some((entry) => entry[0] === "filter" && entry[1] === "blur(3px)"));
  assert.ok(calls.some((entry) => entry[0] === "filter" && /contrast\(120%\)/.test(entry[1])));
  assert.ok(calls.some((entry) => entry[0] === "drawImage"));

  const unsupported = await nondestructive.renderProject({ getContext: () => null }, adjusted.project);
  assert.equal(unsupported.supported, false);
  assert.match(unsupported.reason, /Canvas2D/);
});

test("mounted UI contract is local-first, escaped, keyboard-aware, reduced-motion safe, and responsive", () => {
  for (const token of [
    "data-gnd-canvas", "data-gnd-layers", "data-gnd-modifiers", "data-gnd-mask=\"enabled\"",
    "data-gnd-action=\"add-linked\"", "data-gnd-action=\"replace-source\"", "data-gnd-action=\"undo\"",
    "data-gnd-action=\"redo\"", "data-gnd-image-file", "readAsDataURL", "FileReader", "localStorage",
    "STORAGE_KEY", "aria-live=\"polite\"", "role=\"alert\"", ":focus-visible",
    "@media(max-width:640px)", "prefers-reduced-motion:reduce", "event.ctrlKey || event.metaKey",
    "escapeHtml(layer.name)", "Canvas2D is not supported"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
  assert.doesNotMatch(source, /https?:\/\/|cdn\.|api[_-]?key|secret/i);
});
