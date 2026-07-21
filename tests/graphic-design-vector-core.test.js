const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-vector-core.js"), "utf8");
const vector = require("../graphic-design-vector-core.js");

test("Vector Core exposes a standalone mount contract and stable project format", () => {
  assert.equal(vector.VERSION, 1);
  assert.equal(vector.FORMAT, "hh-vector-motion-project");
  assert.equal(vector.STORAGE_KEY, "hh.graphic-vector-core.project.v1");
  assert.equal(typeof vector.mount, "function");
  assert.equal(typeof vector.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicVectorCore = api/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /mounted\.delete\(root\)/);
});

test("toolbox covers selection, Pen and all requested vector primitives", () => {
  assert.deepEqual(vector.TOOLS.map((item) => item.id), ["select", "pen", "rectangle", "ellipse", "polygon", "star", "text"]);
  assert.ok(["group", "composition", "rect", "ellipse", "polygon", "star", "text", "path", "mask"].every((type) => vector.LAYER_TYPES.includes(type)));
  for (const marker of ["data-vc-tool", "data-vc-artboard", "data-vc-anchor", "beginCanvasInteraction", "moveCanvasInteraction", "smartGuides", "snapPoint"]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test("default project is a usable nested multi-layer motion composition", () => {
  const project = vector.createDefaultProject();
  assert.equal(project.format, vector.FORMAT);
  assert.equal(project.stage.width, 1280);
  assert.equal(project.stage.height, 720);
  assert.ok(project.layers.length >= 6);
  assert.ok(project.layers.some((layer) => layer.type === "composition"));
  assert.ok(project.layers.some((layer) => layer.type === "path" && layer.geometry.points.length >= 3));
  assert.ok(project.layers.some((layer) => layer.type === "text"));
  assert.ok(project.layers.some((layer) => layer.parentId));
  assert.ok(project.layers.reduce((sum, layer) => sum + layer.keyframes.length, 0) >= 6);
  assert.ok(project.layers.some((layer) => layer.motionPath.length >= 3));
  assert.ok(project.timeline.markers.length >= 2);
  assert.ok(project.timeline.compositions.length >= 1);
  assert.deepEqual(project.timeline.workArea, { start: 0, end: 6 });
});

test("normalizer bounds unsafe imported data and repairs broken relationships", () => {
  const project = vector.normalizeProject({
    meta: { name: "<script>" + "x".repeat(300) },
    stage: { width: 999999, height: 1, background: "url(javascript:bad)" },
    settings: { grid: -3 },
    timeline: { duration: 999999, fps: 1000, workArea: { start: -2, end: 999999 } },
    layers: [{
      id: "bad id<script>",
      name: "layer\u0000" + "x".repeat(200),
      type: "unknown",
      parentId: "missing",
      maskId: "missing",
      blendMode: "unsafe",
      matte: "unsafe",
      transform: { opacity: 9, scaleX: 9999 },
      style: { fill: "javascript:bad", strokeWidth: 9000, fontSize: 9999 },
      geometry: { width: -3, sides: 1000, text: "x".repeat(2000) },
      keyframes: [{ time: -2, easing: [9, 9, -9, -9] }]
    }]
  });
  const layer = project.layers[0];
  assert.equal(project.meta.name.length, 120);
  assert.equal(project.stage.width, 8192);
  assert.equal(project.stage.height, 64);
  assert.equal(project.stage.background, "#080d18");
  assert.equal(project.settings.grid, 2);
  assert.equal(project.timeline.duration, 3600);
  assert.equal(project.timeline.fps, 120);
  assert.equal(layer.type, "rect");
  assert.equal(layer.parentId, null);
  assert.equal(layer.maskId, null);
  assert.equal(layer.blendMode, "normal");
  assert.equal(layer.matte, "none");
  assert.equal(layer.transform.opacity, 1);
  assert.equal(layer.transform.scaleX, 100);
  assert.equal(layer.style.fill, "#63e6ff");
  assert.equal(layer.style.strokeWidth, 500);
  assert.equal(layer.style.fontSize, 1000);
  assert.equal(layer.geometry.width, 1);
  assert.equal(layer.geometry.sides, 32);
  assert.equal(layer.geometry.text.length, 1000);
  assert.equal(layer.keyframes[0].time, 0);
  assert.deepEqual(layer.keyframes[0].easing, [1, 2, 0, -2]);
});

test("Bezier path model produces real cubic path data with anchors and handles", () => {
  const data = vector.pathData([
    { x: 0, y: 0, inX: 0, inY: 0, outX: 20, outY: 0 },
    { x: 100, y: 80, inX: 60, inY: 80, outX: 100, outY: 80 },
    { x: 180, y: 20, inX: 140, inY: 20, outX: 180, outY: 20 }
  ], true);
  assert.match(data, /^M 0 0 C 20 0 60 80 100 80 C 100 80 140 20 180 20 C 180 20 0 0 0 0 Z$/);
  assert.equal(vector.pathData([], false), "");
  const pathLayer = vector.createLayer("pen", 20, 30);
  assert.equal(pathLayer.type, "path");
  assert.equal(pathLayer.style.fill, "none");
  assert.equal(pathLayer.style.stroke, "#ff63c7");
});

test("cubic-bezier easing and keyframe interpolation are finite and accurate", () => {
  assert.ok(Math.abs(vector.cubicBezierValue(0, [0.42, 0, 0.58, 1])) < 0.001);
  assert.ok(Math.abs(vector.cubicBezierValue(1, [0.42, 0, 0.58, 1]) - 1) < 0.001);
  const linearMiddle = vector.cubicBezierValue(0.5, [0, 0, 1, 1]);
  assert.ok(Math.abs(linearMiddle - 0.5) < 0.002);
  const project = vector.createDefaultProject();
  const layer = project.layers.find((item) => item.id === "layer-title");
  const before = vector.evaluateLayer(layer, 0.5);
  const middle = vector.evaluateLayer(layer, 1.05);
  const after = vector.evaluateLayer(layer, 1.6);
  assert.ok(Number.isFinite(middle.transform.y));
  assert.ok(middle.transform.opacity >= before.transform.opacity);
  assert.ok(after.transform.opacity >= middle.transform.opacity);
});

test("motion path, polygon and star geometry return deterministic real coordinates", () => {
  assert.deepEqual(vector.motionPathPoint([{ x: 0, y: 0 }, { x: 100, y: 50 }], 0.25), { x: 25, y: 12.5 });
  assert.equal(vector.regularPolygonPoints(0, 0, 10, 4, 0).split(" ").length, 4);
  assert.equal(vector.regularPolygonPoints(0, 0, 10, 5, 4).split(" ").length, 10);
  const bounds = vector.layerBounds(vector.createLayer("rectangle", 10, 20));
  assert.deepEqual(bounds, { x: 10, y: 20, width: 1, height: 1 });
});

test("SVG renderer outputs real shapes, hierarchy, blend modes, Trim Path and safe text", () => {
  const project = vector.createDefaultProject();
  const unsafe = project.layers.find((layer) => layer.type === "text");
  unsafe.geometry.text = "<script>alert(1)</script>";
  const svg = vector.renderSvg(project, 1.4);
  assert.match(svg, /^<svg/);
  assert.match(svg, /viewBox="0 0 1280 720"/);
  assert.match(svg, /data-layer-type="composition"/);
  assert.match(svg, /<rect /);
  assert.match(svg, /<ellipse /);
  assert.match(svg, /<polygon /);
  assert.match(svg, /<path /);
  assert.match(svg, /mix-blend-mode:screen/);
  assert.match(svg, /stroke-dasharray=/);
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(svg, /<script>alert/);
});

test("mask, clipping path, matte and parent-child metadata render truthfully", () => {
  const project = vector.createDefaultProject();
  const mask = vector.normalizeLayer({
    id: "mask-one", name: "Mask", type: "mask",
    geometry: { points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }], closed: true },
    style: { fill: "#ffffff", stroke: "none" }
  }, project.layers.length, project.timeline.duration);
  project.layers.push(mask);
  const target = project.layers.find((layer) => layer.type === "ellipse");
  target.maskId = mask.id;
  target.clip = true;
  target.matte = "alpha";
  const svg = vector.renderSvg(project, 0);
  assert.match(svg, /<mask id="mask-mask-one"/);
  assert.match(svg, /<clipPath id="clip-mask-one"/);
  assert.match(svg, /clip-path="url\(#clip-mask-one\)"/);
  assert.match(svg, /data-matte="alpha"/);
});

test("animated SVG contains native SMIL transforms and reduced-motion metadata", () => {
  const project = vector.createDefaultProject();
  const path = project.layers.find((layer) => layer.type === "path");
  path.morphModel = [
    path.geometry.points.map((point) => ({ ...point })),
    path.geometry.points.map((point, index) => ({ ...point, y: point.y + (index % 2 ? -40 : 30), inY: point.inY + 20, outY: point.outY - 20 }))
  ];
  const svg = vector.renderAnimatedSvg(project);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<animateTransform attributeName="transform"/);
  assert.match(svg, /type="translate"/);
  assert.match(svg, /type="rotate"/);
  assert.match(svg, /type="scale"/);
  assert.match(svg, /<animateMotion /);
  assert.match(svg, /<animate attributeName="d"/);
  assert.match(svg, /<animate attributeName="opacity"/);
  assert.match(svg, /repeatCount="indefinite"/);
  assert.match(svg, /prefers-reduced-motion:reduce/);
  assert.match(svg, /<metadata>HH Vector Motion/);
});

test("alignment and distribution update selected layers without moving unselected content", () => {
  const project = vector.normalizeProject({
    timeline: { duration: 5 },
    layers: [
      { id: "a", type: "rect", geometry: { x: 10, y: 20, width: 20, height: 20 } },
      { id: "b", type: "rect", geometry: { x: 80, y: 90, width: 30, height: 30 } },
      { id: "c", type: "rect", geometry: { x: 170, y: 40, width: 20, height: 20 } },
      { id: "untouched", type: "rect", geometry: { x: 900, y: 900, width: 30, height: 30 } }
    ]
  });
  const aligned = vector.alignLayers(project, ["a", "b", "c"], "left");
  const selectedLeft = aligned.layers.filter((layer) => ["a", "b", "c"].includes(layer.id)).map((layer) => vector.layerBounds(layer).x + layer.transform.x);
  assert.deepEqual(selectedLeft, [10, 10, 10]);
  assert.equal(aligned.layers.find((layer) => layer.id === "untouched").transform.x, 0);
  const distributed = vector.alignLayers(project, ["a", "b", "c"], "distribute-x");
  assert.notDeepEqual(distributed.layers.map((layer) => layer.transform.x), project.layers.map((layer) => layer.transform.x));
});

test("project export is normalized JSON and contains no executable user markup", () => {
  const project = vector.createDefaultProject();
  project.meta.name = "A <script> project";
  const exported = JSON.parse(vector.exportProject(project));
  assert.equal(exported.format, vector.FORMAT);
  assert.equal(exported.version, vector.VERSION);
  assert.ok(exported.exportedAt);
  assert.ok(Array.isArray(exported.layers));
  assert.equal(typeof exported.meta.name, "string");
});

test("local-first persistence uses IndexedDB with an explicit localStorage fallback", () => {
  assert.equal(vector.DATABASE_NAME, "hh-creative-projects");
  assert.equal(vector.STORE_NAME, "vector-motion");
  assert.match(source, /indexedDB\.open\(DATABASE_NAME, 1\)/);
  assert.match(source, /createObjectStore\(STORE_NAME\)/);
  assert.match(source, /local\?\.getItem\(STORAGE_KEY\)/);
  assert.match(source, /local\?\.setItem\(STORAGE_KEY/);
  assert.match(source, /Đã khôi phục phiên làm việc gần nhất/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|gtag\s*\(/i);
});

test("exports are honest about PNG sequence and WebM browser capabilities", async () => {
  assert.equal(typeof vector.exportPngSequence, "function");
  assert.equal(typeof vector.exportWebM, "function");
  assert.match(source, /PNG sequence tải nhiều PNG riêng, không giả dạng ZIP/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /captureStream/);
  await assert.rejects(() => vector.exportWebM(vector.createDefaultProject()), /MediaRecorder/);
  assert.doesNotMatch(source, /JSZip|ffmpeg|GIFEncoder/);
});

test("editor UI includes layer operations, multi-track timeline and working output controls", () => {
  for (const marker of [
    "data-vc-layers",
    "data-vc-group",
    "data-vc-ungroup",
    "data-vc-mask",
    "data-vc-duplicate",
    "data-vc-align",
    "data-vc-add-marker",
    "data-vc-add-key",
    "data-vc-work",
    "data-vc-track",
    "data-vc-key",
    "data-vc-use-path",
    "data-vc-capture-morph",
    "data-vc-easing",
    "data-vc-export=\"sequence\"",
    "data-vc-export=\"webm\"",
    "function undo()",
    "function redo()",
    "FileReader",
    "requestAnimationFrame"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
});

test("responsive UI is accessible, keyboard-aware and respects reduced motion", () => {
  assert.match(source, /setAttribute\("aria-label", "HH Vector & Motion Core"\)/);
  assert.match(source, /role="application" aria-label="Canvas SVG Vector Motion"/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /@media\(max-width:1200px\)/);
  assert.match(source, /@media\(max-width:820px\)/);
  assert.match(source, /@media\(max-width:520px\)/);
  assert.match(source, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /event\.code === "Space"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "z"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "g"/);
});

test("safe expressions support deterministic math without executing JavaScript", () => {
  const sine = vector.evaluateExpression("clamp(sin(progress * 3.14159), 0, 1)", { progress: 0.5 });
  assert.equal(sine.ok, true);
  assert.ok(Math.abs(sine.value - 1) < 0.00001);
  assert.equal(vector.evaluateExpression("value + time * 2", { value: 4, time: 3 }).value, 10);
  for (const unsafe of ["globalThis.alert(1)", "constructor.constructor('return 1')()", "process.exit()", "value = 9"]) {
    assert.equal(vector.evaluateExpression(unsafe, { value: 1 }).ok, false, unsafe);
  }
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
});

test("layer expressions and unequal morph paths evaluate safely", () => {
  const layer = vector.normalizeLayer({
    id: "motion", type: "path", expressions: { rotation: "progress * 360", opacity: "clamp(value, .2, .8)", evil: "1" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    keyframes: [
      { time: 0, transform: { opacity: 0 }, morphPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { time: 2, transform: { opacity: 1 }, morphPoints: [{ x: 0, y: 0 }, { x: 50, y: 80 }, { x: 100, y: 0 }] }
    ]
  }, 0, 2);
  assert.deepEqual(Object.keys(layer.expressions), ["rotation", "opacity"]);
  const middle = vector.evaluateLayer(layer, 1, 2);
  assert.equal(middle.transform.rotation, 180);
  assert.ok(middle.transform.opacity >= 0.2 && middle.transform.opacity <= 0.8);
  assert.equal(middle.morphPoints.length, 3);
  const project = vector.normalizeProject({ timeline: { duration: 2 }, layers: [layer] });
  const animated = vector.renderAnimatedSvg(project);
  assert.match(animated, /type="rotate"[^>]+values="0 0 0;[^\"]+;360 0 0"/);
});

test("Bezier motion sampling follows handles and reports tangent angle", () => {
  const path = [
    { x: 0, y: 0, inX: 0, inY: 0, outX: 0, outY: 100 },
    { x: 100, y: 100, inX: 100, inY: 0, outX: 100, outY: 100 }
  ];
  const sample = vector.motionPathSample(path, 0.5);
  assert.ok(sample.x > 30 && sample.x < 70);
  assert.ok(sample.y > 30 && sample.y < 70);
  assert.ok(Number.isFinite(sample.angle));
  assert.equal(vector.resamplePathPoints(path, 7).length, 7);
});

test("Lottie export is a truthful compatible subset with import warnings", () => {
  const project = vector.createDefaultProject();
  const target = project.layers.find((layer) => layer.type === "ellipse");
  target.matte = "alpha";
  const lottie = JSON.parse(vector.exportLottie(project));
  assert.equal(lottie.v, "5.12.2");
  assert.equal(lottie.meta.capability, "lottie-compatible-subset");
  assert.equal(lottie.fr, project.timeline.fps);
  assert.ok(lottie.layers.length >= 5);
  assert.ok(lottie.meta.warnings.some((warning) => /mask/i.test(warning)));
  assert.doesNotMatch(JSON.stringify(lottie), /<script|javascript:/i);
});

test("export capability matrix never claims unavailable browser encoders", async () => {
  const capabilities = vector.getExportCapabilities({});
  assert.equal(capabilities.animatedSvg.supported, true);
  assert.equal(capabilities.lottie.level, "compatible-subset");
  assert.equal(capabilities.webm.supported, false);
  assert.equal(capabilities.gif.supported, false);
  await assert.rejects(() => vector.exportGif(vector.createDefaultProject()), /GIF/);
  for (const marker of ["data-vc-expression", 'data-vc-export="lottie"', 'data-vc-export="gif"']) assert.ok(source.includes(marker));
});
