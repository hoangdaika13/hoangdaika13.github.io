const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const draw = require(path.join(root, "draw-studio.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("drawing settings are bounded and keep supported mode, dynamics, canvas, palette and export choices", () => {
  const settings = draw.normalizeSettings({ symmetry: 99, brushSize: -2, glow: 500, flow: 0, stabilizer: 200, pressureCurve: 9, spacing: 99, scatter: 99, canvasWidth: 99, canvasHeight: 99999, brushMode: "unknown", paletteId: "unknown", colorA: "bad", colorB: "#ABCDEF", customStops: ["bad", "#123456"], exportScale: 9, exportFormat: "svg" });
  assert.equal(settings.symmetry, 12);
  assert.equal(settings.brushSize, 0.5);
  assert.equal(settings.glow, 48);
  assert.equal(settings.flow, 0.15);
  assert.equal(settings.colorA, draw.DEFAULT_SETTINGS.colorA);
  assert.equal(settings.colorB, "#abcdef");
  assert.equal(settings.exportScale, 4);
  assert.equal(settings.exportFormat, "png");
  assert.equal(settings.quality, "auto");
  assert.equal(settings.brushMode, "silk");
  assert.equal(settings.paletteId, "cosmic");
  assert.equal(settings.stabilizer, 95);
  assert.equal(settings.pressureCurve, 3);
  assert.equal(settings.spacing, 16);
  assert.equal(settings.scatter, 24);
  assert.equal(settings.canvasWidth, 320);
  assert.equal(settings.canvasHeight, 7680);
  assert.equal(settings.customStops.length, 2);
});

test("chromatic studio exposes categorized brush engines and multi-stop palettes", () => {
  assert.equal(Object.keys(draw.PRESETS).length, 46);
  assert.ok(draw.BRUSH_MODES.length >= 40);
  for (const preset of Object.values(draw.PRESETS)) {
    assert.ok(draw.BRUSH_MODES.includes(preset.brushMode));
    assert.ok(draw.COLOR_PALETTES[preset.paletteId]);
  }
  for (const [id, palette] of Object.entries(draw.COLOR_PALETTES)) {
    if (id !== "custom") assert.ok(palette.stops.length >= 3);
  }
  assert.match(draw.samplePalette({ paletteId: "prism", colorA: "#000000", colorB: "#ffffff" }, 0.5), /^#[0-9a-f]{6}$/);
  assert.equal(draw.harmonyColors("#ff0000", "triadic").length, 4);
});

test("Pattern Composer creates bounded deterministic geometry for every real generator", () => {
  assert.equal(Object.keys(draw.PATTERN_GENERATORS).length, 6);
  const settings = draw.normalizeSettings({ patternSeed: "HH-TEST", patternComplexity: 9, patternScale: 0.72, brushMode: "neon" });
  for (const type of Object.keys(draw.PATTERN_GENERATORS)) {
    const first = draw.generatePatternStrokes(type, settings);
    const second = draw.generatePatternStrokes(type, settings);
    assert.ok(first.length >= 1 && first.length <= 120, `${type} must create bounded strokes`);
    assert.deepEqual(first, second, `${type} must be reproducible from its seed`);
    assert.ok(first.every((stroke) => stroke.points.length >= 2 && stroke.points.length <= 1400));
    assert.ok(first.flatMap((stroke) => stroke.points).every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
  }
  assert.deepEqual(draw.generatePatternStrokes("unknown", settings), []);
});

test("draw settings preserve Pattern Composer controls within safe bounds", () => {
  const settings = draw.normalizeSettings({ patternSeed: "<HH>".repeat(40), patternComplexity: 99, patternScale: 0.01 });
  assert.equal(settings.patternComplexity, 16);
  assert.equal(settings.patternScale, 0.3);
  assert.ok(settings.patternSeed.length <= 48);
  assert.doesNotMatch(settings.patternSeed, /[<>]/);
});

test("adaptive quality selects a low-latency profile for constrained devices", () => {
  assert.equal(draw.resolveQualityProfile("auto", { deviceMemory: 2, hardwareConcurrency: 8 }).id, "performance");
  assert.equal(draw.resolveQualityProfile("auto", { deviceMemory: 8, hardwareConcurrency: 8 }).id, "balanced");
  assert.equal(draw.resolveQualityProfile("quality", { deviceMemory: 2, hardwareConcurrency: 2 }).id, "quality");
  assert.ok(draw.QUALITY_PROFILES.performance.fibers < draw.QUALITY_PROFILES.quality.fibers);
});

test("symmetry engine creates deterministic rotation, mirror and spiral variants", () => {
  const point = { x: 0.72, y: 0.4, pressure: 0.5 };
  const radial = draw.buildSymmetryPoints(point, { symmetry: 6, mirror: false, spiral: false });
  const mirrored = draw.buildSymmetryPoints(point, { symmetry: 6, mirror: true, spiral: false });
  const spiral = draw.buildSymmetryPoints(point, { symmetry: 6, mirror: true, spiral: true, spiralCopies: 3 });
  assert.equal(radial.length, 6);
  assert.equal(mirrored.length, 12);
  assert.equal(spiral.length, 36);
  assert.deepEqual(spiral, draw.buildSymmetryPoints(point, { symmetry: 6, mirror: true, spiral: true, spiralCopies: 3 }));
  assert.ok(spiral.every((variant) => Number.isFinite(variant.x) && Number.isFinite(variant.y)));
});

test("project normalization bounds untrusted local and imported data", () => {
  const points = Array.from({ length: 1600 }, (_, index) => ({ x: index / 1600, y: 0.5, pressure: 0.4, time: index }));
  const strokes = Array.from({ length: 140 }, (_, index) => ({ id: `s-${index}`, settings: { symmetry: 4 }, points }));
  const project = draw.normalizeProject({ strokes, settings: { preset: "mandala" } });
  assert.equal(project.schema, draw.STORAGE_SCHEMA);
  assert.equal(project.version, 2);
  assert.equal(project.layers.length, 1);
  assert.equal(project.layers[0].strokes.length, 120);
  assert.equal(project.layers[0].strokes[0].points.length, 1400);
  assert.equal(draw.projectStrokes(project).length, 120);
  assert.equal(project.settings.preset, "mandala");
});

test("layer studio validates blend modes, opacity, masks and nested merged layers", () => {
  const project = draw.normalizeProject({ layers: [{ id: "base", name: "Base", opacity: 5, blendMode: "invalid", mask: [{ x: -1, y: 2 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }], children: [{ name: "Child", blendMode: "screen" }] }] });
  assert.equal(project.layers[0].opacity, 1);
  assert.equal(project.layers[0].blendMode, "source-over");
  assert.equal(project.layers[0].mask[0].x, 0);
  assert.equal(project.layers[0].children[0].blendMode, "screen");
  assert.ok(draw.LAYER_BLEND_MODES.includes("color-dodge"));
});

test("render scheduler accounts for symmetry and spiral complexity, not only point count", () => {
  const points = Array.from({ length: 180 }, (_, index) => ({ x: index / 180, y: 0.5, pressure: 0.5, time: index }));
  const light = draw.normalizeProject({ strokes: [{ points, settings: { symmetry: 1, mirror: false, spiral: false } }] });
  const heavy = draw.normalizeProject({ strokes: [{ points, settings: { symmetry: 12, mirror: true, spiral: true, spiralCopies: 5 } }] });
  assert.ok(draw.projectRenderCost(heavy, "balanced") > draw.projectRenderCost(light, "balanced") * 20);
  assert.ok(draw.projectRenderCost(heavy, "balanced") > 12000);
});

test("color mixing returns stable hexadecimal colors", () => {
  assert.equal(draw.mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(draw.mixHex("#ff0000", "#0000ff", 0.25), "#bf0040");
});

test("segment renderer never touches the project minimap or export-only state", () => {
  const source = read("draw-studio.js");
  const segmentRenderer = source.slice(source.indexOf("function drawFiberSegment"), source.indexOf("function drawMinimap"));
  const compositor = source.slice(source.indexOf("function renderAll"), source.indexOf("function drawGuides"));
  assert.doesNotMatch(segmentRenderer, /targetCanvas|drawMinimap/);
  assert.match(compositor, /if \(!targetCanvas\) drawMinimap\(targetRuntime\)/);
});

test("Draw is a first-class lazy route with a real interactive tool contract", () => {
  const client = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  const source = read("draw-studio.js");
  const renderWorker = read("draw-studio-worker.js");
  const css = read("draw-studio.css");

  assert.match(client, /id: "draw"[\s\S]*?label: "Vẽ"[\s\S]*?route: "\/draw"/);
  assert.match(client, /window\.HHDrawStudio\?\.mount/);
  assert.match(client, /title: "Vẽ · Chromatic Studio"[\s\S]*?route: "\/draw"/);
  assert.match(loader, /draw:\s*\{[\s\S]*?draw-studio\.css\?v=8[\s\S]*?draw-studio\.js\?v=9/);
  assert.match(loader, /value\.startsWith\("\/draw"\)/);
  assert.match(worker, /draw-studio\.css\?v=8/);
  assert.match(worker, /draw-studio\.js\?v=9/);
  assert.match(worker, /draw-studio-worker\.js\?v=5/);
  assert.match(html, /data-hh-galaxy-key="draw"/);
  assert.match(galaxy, /draw:\s*\{[\s\S]*?route: "#\/draw"/);
  for (const contract of ["data-draw-canvas", "data-draw-preset", "data-draw-setting=\"symmetry\"", "data-draw-setting=\"mirror\"", "data-draw-setting=\"spiral\"", "data-draw-setting=\"quality\"", "data-draw-layer-panel", "data-draw-tool=\"select\"", "data-draw-animation-export", "data-draw-export-svg", "data-draw-export-layers", "data-draw-undo", "data-draw-redo", "data-draw-export", "data-draw-project-export", "data-draw-project-import"]) assert.match(source, new RegExp(contract));
  for (const contract of ["data-draw-brush-search", "data-draw-favorite", "data-draw-generator", "data-draw-generator-remix", "data-draw-zen", "data-draw-engine"]) assert.match(source, new RegExp(contract));
  assert.match(source, /data-draw-palette/);
  for (const mode of ["plasma", "electric", "nebula", "prism", "fire", "galaxy", "comet", "ripple", "quantum", "rainbow", "ink"]) assert.match(source, new RegExp(`mode === \\\"${mode}\\\"|\\[.*\\\"${mode}\\\"`));
  assert.match(source, /pointerdown/);
  assert.match(source, /getCoalescedEvents/);
  assert.match(source, /coalescedEvents\?\.length/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /transformCache/);
  assert.match(source, /updateAdaptiveQuality/);
  assert.match(source, /frameBudget/);
  assert.match(source, /layerCache/);
  assert.match(source, /kind:\s*"stroke-add"/);
  assert.match(source, /projectRenderCost\(targetRuntime\.project/);
  assert.match(source, /indexedDB/);
  assert.match(source, /getUserMedia/);
  assert.match(source, /captureStream/);
  assert.match(source, /globalCompositeOperation = "lighter"/);
  assert.match(source, /localStorage/);
  assert.match(css, /touch-action:none/);
  assert.match(css, /overflow-anchor:none/);
  assert.match(css, /\.draw-switch\{position:relative/);
  assert.match(renderWorker, /OffscreenCanvas|renderLayerBitmap/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("module inspection is safe before browser mounting", () => {
  assert.deepEqual(draw.inspect(), { version: "2.1.0", mounted: false, strokes: 0, layers: 0, preset: "silk", brushMode: "silk", paletteId: "cosmic", quality: "auto" });
  assert.equal(typeof draw.mount, "function");
  assert.equal(typeof draw.unmount, "function");
});
