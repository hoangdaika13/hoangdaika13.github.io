const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "image-text-studio.js"), "utf8");

function load() {
  const window = {};
  const context = { window, console, setTimeout: () => 0, clearTimeout() {}, cancelAnimationFrame() {}, requestAnimationFrame: () => 0, localStorage: { setItem() {} } };
  // Test-only closure access. Production API exposes mount/unmount only.
  const instrumented = source.replace('global.HHImageTextStudio = Object.freeze({ mount, unmount, version: "1.1.0" });', 'global.testAPI = { layerEditPatch, applyLayerEdit, layerFor, drawTextLayer, DEFAULT_LAYER, state, snapshotState, restoreSnapshot, pushHistory, undo, redo, projectData, validateJSON: text => validateProjectData(JSON.parse(text)) }; renderAll = () => {}; global.HHImageTextStudio = { mount, unmount };');
  assert.notEqual(instrumented, source);
  vm.runInNewContext(instrumented, context);
  return window.testAPI;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
function fixture(api) {
  api.state.settings.editMode = "all";
  api.state.items = [
    { id: "a", name: "a.png", focusX: .2, focusY: .3, outputBaseName: "first", youtubeTitle: "Title A", overrides: { title: { text: "Image A", color: "#ff0000", autoContrast: true, gradient: true, x: .25 } } },
    { id: "b", name: "b.png", focusX: .6, focusY: .4, outputBaseName: "second", youtubeTitle: "Title B", overrides: { title: { text: "Image B", color: "#00ff00", gradient: true, y: .7 } } }
  ];
  return api.state.items;
}

test("solid colors disable both overrides that previously masked the chosen paint", () => {
  const api = load();
  assert.deepEqual(plain(api.layerEditPatch("color", "#FF5378")), { color: "#ff5378", autoContrast: false, gradient: false });
  assert.equal(api.layerEditPatch("color", "red"), null);
  assert.equal(api.layerEditPatch("color", "#12"), null);
  assert.equal(api.layerEditPatch("__proto__", "bad"), null);
  assert.deepEqual(plain(api.layerEditPatch("stroke", "#123456")), { stroke: "#123456", autoContrast: false });
});

test("three paint modes are exclusive and gradient edits disable automatic contrast", () => {
  const api = load();
  assert.deepEqual(plain(api.layerEditPatch("colorMode", "auto")), { autoContrast: true, gradient: false });
  assert.deepEqual(plain(api.layerEditPatch("colorMode", "gradient")), { autoContrast: false, gradient: true });
  assert.deepEqual(plain(api.layerEditPatch("colorMode", "solid")), { autoContrast: false, gradient: false });
  assert.deepEqual(plain(api.layerEditPatch("gradientEnd", "#a994ff")), { gradientEnd: "#a994ff", autoContrast: false, gradient: true });
  assert.equal(api.layerEditPatch("colorMode", "unknown"), null);
});

test("all-image color change wins over per-image AI colors without erasing text or layout", () => {
  const api = load(), images = fixture(api);
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#65e9ef"));
  images.forEach((item) => {
    const layer = api.layerFor(item, "title");
    assert.equal(layer.color, "#65e9ef"); assert.equal(layer.autoContrast, false); assert.equal(layer.gradient, false);
  });
  assert.equal(images[0].overrides.title.text, "Image A");
  assert.equal(images[0].overrides.title.x, .25);
  assert.equal(images[1].overrides.title.y, .7);
  assert.equal(images[1].youtubeTitle, "Title B");
});

test("current-image color is isolated and retains the other images and template", () => {
  const api = load(), images = fixture(api), originalTemplate = JSON.stringify(api.state.template), other = JSON.stringify(images[1]);
  api.state.settings.editMode = "current";
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#a994ff"));
  assert.equal(api.layerFor(images[0], "title").color, "#a994ff");
  assert.equal(JSON.stringify(api.state.template), originalTemplate);
  assert.equal(JSON.stringify(images[1]), other);
});

test("undo/redo restore every per-image override and metadata after a global color edit", () => {
  const api = load(), images = fixture(api), before = api.snapshotState();
  api.pushHistory();
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#ffd36a"));
  const changed = api.snapshotState();
  api.undo(); assert.equal(api.snapshotState(), before);
  api.redo(); assert.equal(api.snapshotState(), changed);
  assert.equal(images[0].focusX, .2); assert.equal(images[1].outputBaseName, "second");
});

function paintContext() {
  const fills = [], strokes = [], gradients = [];
  return {
    fills, strokes, gradients,
    save() {}, restore() {}, translate() {}, rotate() {}, measureText(text) { return { width: text.length * 40 }; },
    fillText(text) { fills.push({ text, color: this.fillStyle }); }, strokeText(text) { strokes.push({ text, color: this.strokeStyle }); },
    getImageData() { return { data: new Uint8ClampedArray(1600).fill(255) }; },
    createLinearGradient() { const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } }; gradients.push(gradient); return gradient; }
  };
}
test("shared preview/export renderer uses exact solid HEX on both bright and dark images", () => {
  const api = load(), images = fixture(api);
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#ff5378"));
  for (const width of [1280, 1920, 3840]) {
    const ctx = paintContext();
    api.drawTextLayer(ctx, width, width * 9 / 16, images[0], "title", api.layerFor(images[0], "title"), width === 1280);
    assert.ok(ctx.fills.length); assert.ok(ctx.fills.every((entry) => entry.color === "#ff5378"));
    assert.equal(ctx.gradients.length, 0);
  }
});

test("gradient and automatic contrast still render intentionally when selected", () => {
  const api = load(), images = fixture(api), ctx = paintContext();
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("gradientStart", "#ff5378"));
  api.drawTextLayer(ctx, 1280, 720, images[0], "title", api.layerFor(images[0], "title"));
  assert.equal(ctx.gradients.length, 1);
  assert.equal(ctx.gradients[0].stops[0][1], "#ff5378");
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("colorMode", "auto"));
  const auto = paintContext();
  api.drawTextLayer(auto, 1280, 720, images[0], "title", api.layerFor(images[0], "title"));
  assert.equal(auto.fills[0].color, "#111716");
});

test("editing controls precede optional AI and expose accessible HEX, mode and swatches", () => {
  const inspector = source.slice(source.indexOf("function renderInspector"), source.indexOf("function renderLibrary"));
  assert.ok(inspector.indexOf('its-text-field') >= 0);
  assert.ok(inspector.indexOf('its-text-field') < inspector.indexOf('its-ai-disclosure'));
  assert.ok(inspector.indexOf('its-color-panel') < inspector.indexOf('its-ai-disclosure'));
  for (const text of ['aria-label="Mã HEX màu chữ"', 'aria-label="Chế độ màu chữ"', 'aria-label="Chọn màu chữ"', 'data-color-mode-hint', 'data-color-swatch']) assert.ok(inspector.includes(text));
  assert.match(source, /else if \(name === "color-swatch"\).*pushHistory\(\).*setLayerProperty/);
});

test("chosen paint mode and per-image text survive project export/import validation", () => {
  const api = load(), images = fixture(api);
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#65e9ef"));
  const restored = api.validateJSON(JSON.stringify(api.projectData()));
  assert.equal(restored.template.title.color, "#65e9ef");
  assert.equal(restored.template.title.autoContrast, false);
  assert.equal(restored.template.title.gradient, false);
  assert.equal(restored.images[0].overrides.title.text, "Image A");
  assert.equal(restored.images[1].youtubeTitle, "Title B");
});

test("copying a selected style to all retains unique image captions", () => {
  const api = load(), images = fixture(api);
  api.state.settings.editMode = "current";
  api.applyLayerEdit(api.state, images[0], "title", api.layerEditPatch("color", "#a994ff"));
  const style = api.layerFor(images[0], "title"); delete style.text;
  api.state.settings.editMode = "all";
  api.applyLayerEdit(api.state, images[0], "title", style);
  assert.equal(api.layerFor(images[0], "title").text, "Image A");
  assert.equal(api.layerFor(images[1], "title").text, "Image B");
  assert.equal(api.layerFor(images[1], "title").color, "#a994ff");
});
