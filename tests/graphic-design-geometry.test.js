const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const design = require("../graphic-design-universal.js");
const geometry = require("../graphic-design-geometry.js");
const root = path.resolve(__dirname, "..");
const shape = (overrides = {}) => design.normalizeLayer({ type: "rect", x: 0, y: 0, width: 100, height: 100, cornerRadius: 0, ...overrides }, "frame");
const near = (value, expected, tolerance = 1e-6) => assert.ok(Math.abs(value - expected) <= tolerance, `${value} ≈ ${expected} (±${tolerance})`);
function rings(pathData) {
  return pathData.split(/Z/i).filter((part) => part.trim()).map((part) => {
    const values = part.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g).map(Number), points = [];
    for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
    return points;
  });
}
function filled(pathData, x, y) {
  let winding = 0;
  for (const ring of rings(pathData)) for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (a[1] <= y && b[1] > y && cross > 0) winding += 1;
    if (a[1] > y && b[1] <= y && cross < 0) winding -= 1;
  }
  return winding !== 0;
}
function documentWith(layers) {
  const doc = design.defaultDocument({ id: "geometry-test" });
  doc.layers = layers.map((layer) => ({ ...layer, frameId: doc.frames[0].id }));
  return doc;
}

test("pinned Boolean vendor has reviewed source hash, bundled notices and browser-compatible exports", () => {
  const source = fs.readFileSync(path.join(root, "vendor/polygon-clipping-0.15.7.umd.min.js"));
  assert.equal(crypto.createHash("sha256").update(source).digest("hex"), "1bd1335a65dac024dcba9843c60160b3b53faa46967b1b3ae2a4d5ef0ff04fce");
  const notices = fs.readFileSync(path.join(root, "vendor/POLYGON-CLIPPING-NOTICES.md"), "utf8");
  for (const phrase of ["0.15.7", "Mike Fogel", "Alexander Milevski", "Unlicense", "Apache", "2024-04-19"]) assert.ok(notices.includes(phrase), phrase);
  const scope = vm.createContext({ structuredClone });
  for (const file of ["vendor/polygon-clipping-0.15.7.umd.min.js", "graphic-design-geometry.js", "graphic-design-universal.js"]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), scope);
  assert.equal(typeof scope.polygonClipping.union, "function");
  near(scope.HHGraphicDesignUniversal.vectorBoolean([shape(), shape({ rotation: 45 })], "intersect").area, 8284.2712474619);
});

test("exact orthogonal fast path remains exact and does not need polygon approximation", () => {
  const result = design.vectorBoolean([shape(), shape({ x: 25, y: 25, width: 50, height: 50 })], "subtract");
  assert.equal(result.area, 7500);
  assert.equal(result.engine, undefined);
  assert.equal(filled(result.pathData, 50, 50), false);
  assert.equal(filled(result.pathData, 10, 10), true);
});

test("rotated and skewed rectangles use real transformed contours, not their bounding boxes", () => {
  const a = shape(), b = shape({ rotation: 45 });
  near(design.vectorBoolean([a, b], "intersect").area, 10000 - 8 * (50 - 50 / Math.sqrt(2)) ** 2);
  const result = design.vectorBoolean([a, b], "subtract");
  assert.equal(result.approximate, false);
  assert.equal(filled(result.pathData, 50, 50), false);
  assert.equal(filled(result.pathData, 1, 1), true);
  const skewed = shape({ x: 250, skewX: 30, skewY: -20, anchorX: 0.2, anchorY: 0.8 });
  near(design.vectorBoolean([a, skewed], "union").area, 20000);
});

test("ellipse subtraction preserves a real hole within a bounded curve tolerance", () => {
  const result = design.vectorBoolean([shape(), shape({ type: "ellipse", x: 20, y: 20, width: 60, height: 60 })], "subtract");
  assert.equal(result.approximate, true);
  assert.equal(result.tolerance, 0.25);
  near(result.area, 10000 - Math.PI * 30 ** 2, 25);
  assert.equal(rings(result.pathData).length, 2);
  assert.equal(filled(result.pathData, 50, 50), false);
  assert.equal(filled(result.pathData, 5, 50), true);
});

test("rounded rectangles use bounded arcs and disconnected shapes retain their empty gap", () => {
  const rounded = shape({ cornerRadius: 20 }), distant = shape({ type: "ellipse", x: 300, y: 0, width: 20, height: 20 });
  const result = design.vectorBoolean([rounded, distant], "union");
  near(result.area, 10000 - (4 - Math.PI) * 20 ** 2 + Math.PI * 10 ** 2, 30);
  assert.equal(rings(result.pathData).length, 2);
  assert.equal(filled(result.pathData, 200, 50), false);
  assert.equal(filled(result.pathData, 1, 1), false);
  assert.equal(filled(result.pathData, 50, 50), true);
});

test("regular polygon/star Boolean matches renderer geometry", () => {
  const triangle = shape({ type: "polygon", metadata: { sides: 3 }, x: 200 }), star = shape({ type: "star", metadata: { points: 5, innerRatio: 0.4 } });
  const result = design.vectorBoolean([star, triangle], "union");
  assert.equal(result.approximate, false);
  const triangleArea = 3 * Math.sqrt(3) / 4 * 50 ** 2;
  const starArea = 5 * 50 * 20 * Math.sin(Math.PI / 5);
  near(result.area, triangleArea + starArea);
  assert.equal(filled(result.pathData, 50, 50), true);
  assert.equal(filled(result.pathData, 150, 50), false);
});

test("relative cubic, smooth cubic, quadratic and smooth quadratic paths are flattened and usable", () => {
  const variants = [
    "M 0 0 C 0 -30 100 -30 100 0 L 100 100 L 0 100 Z",
    "m 0 0 c 0 -30 50 -30 50 0 s 50 30 50 0 l 0 100 h -100 z",
    "M0 0 Q50 -30 100 0 V100 H0 Z",
    "M0 0 Q25 -30 50 0 T100 0 L100 100 H0 Z"
  ];
  for (const pathData of variants) {
    const result = design.vectorBoolean([shape({ type: "path", pathData }), shape({ x: 20, y: 20, width: 60, height: 60 })], "subtract");
    assert.equal(result.approximate, true);
    assert.equal(filled(result.pathData, 50, 50), false, pathData);
    assert.equal(filled(result.pathData, 10, 50), true, pathData);
    assert.ok(result.area > 6000 && result.area < 9000);
  }
});

test("curve tolerance is bounded in world space after both skews and rotation", () => {
  const layer = shape({ type: "path", rotation: 37, skewX: 60, skewY: -40, anchorX: 0, anchorY: 1, pathData: "M0 0 C0 100 100 100 100 0 L0 0 Z" });
  const budget = { points: 0, pairs: 0 }, transform = geometry.transformFor(layer), contour = geometry.shapeRings(layer, budget)[0];
  const distance = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  for (let i = 0; i <= 200; i += 1) {
    const t = i / 200, p = transform([100 * (3 * (1 - t) * t * t + t ** 3), 300 * (1 - t) * t]);
    const closest = Math.min(...contour.slice(1).map((q, index) => distance(p, contour[index], q)));
    assert.ok(closest <= geometry.LIMITS.tolerance + 1e-6, `${i}: ${closest}`);
  }
});

test("compound nonzero SVG winding preserves holes, islands and same-direction filled contours", () => {
  const pathData = "M0 0 H100 V100 H0 Z M20 20 V80 H80 V20 Z M35 35 H65 V65 H35 Z";
  const result = design.vectorBoolean([shape({ type: "path", pathData }), shape({ x: 200 })], "union");
  near(result.area, 10000 - 3600 + 900 + 10000);
  assert.equal(filled(result.pathData, 10, 10), true);
  assert.equal(filled(result.pathData, 25, 25), false);
  assert.equal(filled(result.pathData, 50, 50), true);
  const sameDirection = design.vectorBoolean([shape({ type: "path", pathData: "M0 0 H100 V100 H0 Z M20 20 H80 V80 H20 Z" }), shape({ x: 200 })], "union");
  near(sameDirection.area, 20000);
});

test("Boolean-generated compound paths can take part in a subsequent operation", () => {
  const first = design.vectorBoolean([shape(), shape({ type: "ellipse", x: 20, y: 20, width: 60, height: 60 })], "subtract");
  const second = design.vectorBoolean([shape({ type: "path", pathData: first.pathData }), shape({ x: 40, y: 0, width: 20, height: 100 })], "union");
  assert.equal(filled(second.pathData, 50, 50), true);
  assert.equal(filled(second.pathData, 30, 50), false);
});

test("unsupported, invalid and overcomplex geometry is rejected atomically", () => {
  const bad = [
    shape({ type: "path", pathData: "M0 0 A20 20 0 0 0 40 40 Z" }),
    shape({ type: "path", pathData: "M0 0 L100 0 L100 100" }),
    shape({ type: "path", pathData: "M0 0 L100 100 L0 100 L100 0 Z" }),
    shape({ type: "path", pathData: "M0 0 H100 V100 H0 Z M50 50 H150 V150 H50 Z" }),
    shape({ type: "path", pathData: "M0 0 L1e999 0 Z" }),
    shape({ type: "path", pathData: "M,0 0 H100 V100 H0 Z" }),
    shape({ type: "path", pathData: "M0,,0 H100 V100 H0 Z" }),
    shape({ type: "text", text: "Không phải outline" }),
    shape({ fill: "none", strokeWidth: 3 }),
    shape({ masks: [{ enabled: true }] }),
    shape({ adjustments: [{ enabled: true }] }),
    shape({ locked: true }),
    shape({ type: "path", pathData: "M0 0 " + Array.from({ length: 1100 }, (_, i) => `L${i} ${i % 2}`).join(" ") + " Z" })
  ];
  for (const candidate of bad) {
    const doc = documentWith([shape({ id: "a" }), { ...candidate, id: "b" }]), before = JSON.stringify(doc);
    assert.throws(() => design.operation(doc, "boolean-layers", { ids: ["a", "b"], mode: "union" }));
    assert.equal(JSON.stringify(doc), before);
  }
  assert.throws(() => geometry.booleanLayers([shape(), { ...shape(), x: Infinity }]));
  assert.throws(() => design.vectorBoolean([shape(), { ...shape(), x: Infinity }]));
  assert.throws(() => design.vectorBoolean([shape(), { ...shape(), width: -1 }]));
  assert.throws(() => design.vectorBoolean([shape(), { ...shape(), x: 1000000 }]));
  assert.throws(() => geometry.booleanLayers([shape(), shape({ frameId: "different" })]));
  assert.throws(() => geometry.booleanLayers(Array.from({ length: 33 }, () => shape())));
});

test("Boolean result and empty intersection retain exact source undo/redo", () => {
  const original = documentWith([shape({ id: "a", rotation: 30 }), shape({ id: "b", type: "ellipse", x: 200 })]);
  for (const mode of ["union", "intersect", "subtract", "exclude"]) {
    const result = design.operation(original, "boolean-layers", { ids: ["a", "b"], mode });
    assert.equal(result.layers.length, mode === "intersect" ? 0 : 1);
    assert.equal(result.commandLog.at(-1).type, "boolean-layers");
    assert.deepEqual(design.undo(result).layers, design.normalizeDocument(original).layers);
    assert.deepEqual(design.redo(design.undo(result)).layers, result.layers);
  }
});

test("native vector snapshot imports as a fresh editable frame without snapping or ID collisions", () => {
  const original = design.defaultDocument({ id: "bridge" }); original.canvas.snap = true; original.canvas.grid = 8;
  const source = { name: "Bézier snapshot", width: 720, height: 480, background: "#123456", layers: [shape({ id: original.layers[0].id, x: 1.125, y: -2.75, fill: "none", type: "path", pathData: "M1.125 -2.75 L50 60 Z", parentId: "old-parent" })] };
  const before = JSON.stringify(source), result = design.operation(original, "import-frame-layers", source), layer = result.layers.at(-1);
  assert.equal(result.frames.length, original.frames.length + 1);
  assert.equal(result.frames.at(-1).name, source.name);
  assert.equal(result.frames.at(-1).width, 720);
  assert.notEqual(layer.id, source.layers[0].id);
  assert.equal(layer.parentId, null);
  assert.equal(layer.frameId, result.activeFrameId);
  assert.equal(layer.x, 1.125); assert.equal(layer.y, -2.75); assert.equal(layer.fill, "none");
  assert.equal(layer.pathData, source.layers[0].pathData);
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.history.past.length, original.history.past.length + 1);
  assert.deepEqual(design.undo(result).frames, design.normalizeDocument(original).frames);
  assert.deepEqual(design.undo(result).layers, design.normalizeDocument(original).layers);
});

test("invalid snapshot frame payload never partially creates a frame or layer", () => {
  const original = design.defaultDocument(), before = JSON.stringify(original);
  const valid = { width: 720, height: 480, layers: [shape()] };
  for (const bad of [
    { layers: null }, { layers: Array.from({ length: 1001 }, () => shape()) }, { width: Infinity }, { height: 0 }, { width: 8193 },
    { layers: [shape(), { type: "image", assetId: "missing" }] }, { layers: [{ ...shape(), x: NaN }] },
    { layers: [shape(), { type: "path", pathPoints: [{ x: Infinity, y: 0 }] }] }
  ]) {
    assert.throws(() => design.operation(original, "import-frame-layers", { ...valid, ...bad }));
    assert.equal(JSON.stringify(original), before);
  }
});

test("SVG export targets a requested frame without mutating active selection and scopes asset preflight", async () => {
  let doc = design.defaultDocument({ id: "frames" });
  const originalFrame = doc.frames[0].id;
  doc.layers = [shape({ id: "unrelated-broken-image", type: "image", assetId: "missing", frameId: originalFrame })];
  doc = design.operation(doc, "import-frame-layers", { name: "Export me", width: 320, height: 180, background: "#123456", layers: [shape({ fill: "none", stroke: "#abcdef", strokeWidth: 2, x: 1.25 })] });
  const requested = doc.activeFrameId; doc.activeFrameId = originalFrame;
  const before = JSON.stringify(doc), preflight = await design.exportPreflight(doc, { frameId: requested });
  assert.equal(preflight.ok, true);
  const result = await design.prepareExportSVG(doc, { frameId: requested, scale: 2 });
  assert.equal(result.frameId, requested); assert.equal(result.width, 640); assert.equal(result.height, 360);
  assert.match(result.svg, /viewBox="0 0 320 180"/);
  assert.match(result.svg, /fill="none"/);
  assert.match(result.svg, /stroke="#abcdef"/);
  assert.equal(JSON.stringify(doc), before);
  assert.equal((await design.exportPreflight(doc, { frameId: originalFrame })).ok, false);
  await assert.rejects(design.exportPreflight(doc, { frameId: "unknown" }), /không tồn tại/);
  await assert.rejects(design.prepareExportSVG(doc, { frameId: "unknown" }), /không tồn tại/);
});
