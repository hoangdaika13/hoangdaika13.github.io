const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const draw = require(path.join(root, "draw-studio.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("drawing settings are bounded and keep supported export choices", () => {
  const settings = draw.normalizeSettings({ symmetry: 99, brushSize: -2, glow: 500, flow: 0, colorA: "bad", colorB: "#ABCDEF", exportScale: 9, exportFormat: "svg" });
  assert.equal(settings.symmetry, 12);
  assert.equal(settings.brushSize, 0.5);
  assert.equal(settings.glow, 48);
  assert.equal(settings.flow, 0.15);
  assert.equal(settings.colorA, draw.DEFAULT_SETTINGS.colorA);
  assert.equal(settings.colorB, "#abcdef");
  assert.equal(settings.exportScale, 4);
  assert.equal(settings.exportFormat, "png");
  assert.equal(settings.quality, "auto");
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
  assert.equal(project.strokes.length, 120);
  assert.equal(project.strokes[0].points.length, 1400);
  assert.equal(project.settings.preset, "mandala");
});

test("color mixing returns stable hexadecimal colors", () => {
  assert.equal(draw.mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(draw.mixHex("#ff0000", "#0000ff", 0.25), "#bf0040");
});

test("Draw is a first-class lazy route with a real interactive tool contract", () => {
  const client = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  const source = read("draw-studio.js");
  const css = read("draw-studio.css");

  assert.match(client, /id: "draw"[\s\S]*?label: "Vẽ"[\s\S]*?route: "\/draw"/);
  assert.match(client, /window\.HHDrawStudio\?\.mount/);
  assert.match(client, /title: "Vẽ · Silk Studio"[\s\S]*?route: "\/draw"/);
  assert.match(loader, /draw:\s*\{[\s\S]*?draw-studio\.css\?v=4[\s\S]*?draw-studio\.js\?v=3/);
  assert.match(loader, /value\.startsWith\("\/draw"\)/);
  assert.match(worker, /draw-studio\.css\?v=4/);
  assert.match(worker, /draw-studio\.js\?v=3/);
  assert.match(html, /data-hh-galaxy-key="draw"/);
  assert.match(galaxy, /draw:\s*\{[\s\S]*?route: "#\/draw"/);
  for (const contract of ["data-draw-canvas", "data-draw-preset", "data-draw-setting=\"symmetry\"", "data-draw-setting=\"mirror\"", "data-draw-setting=\"spiral\"", "data-draw-setting=\"quality\"", "data-draw-undo", "data-draw-redo", "data-draw-export", "data-draw-project-export", "data-draw-project-import"]) assert.match(source, new RegExp(contract));
  assert.match(source, /pointerdown/);
  assert.match(source, /getCoalescedEvents/);
  assert.match(source, /coalescedEvents\?\.length/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /transformCache/);
  assert.match(source, /updateAdaptiveQuality/);
  assert.match(source, /globalCompositeOperation = "lighter"/);
  assert.match(source, /localStorage/);
  assert.match(css, /touch-action:none/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("module inspection is safe before browser mounting", () => {
  assert.deepEqual(draw.inspect(), { version: "1.1.0", mounted: false, strokes: 0, preset: "silk", quality: "auto" });
  assert.equal(typeof draw.mount, "function");
  assert.equal(typeof draw.unmount, "function");
});
