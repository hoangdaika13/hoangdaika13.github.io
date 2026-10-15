const test = require("node:test");
const assert = require("node:assert/strict");
const design = require("../graphic-design-universal.js");

const storage = () => {
  const map = new Map();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
function imageDocument() {
  const doc = design.defaultDocument({ id: "portable-source" });
  doc.layers = [design.normalizeLayer({ id: "image-layer", type: "image", name: "Original image", assetId: "source-image", altText: "Test image", x: 0, y: 0, width: 1200, height: 800 }, doc.frames[0].id)];
  doc.assets = [{ id: "source-image", name: "Original", kind: "image", type: "image/png", size: 3200, checksum: "source", status: "ready", license: "owned", width: 1200, height: 800, thumbnail: "data:image/png;base64,dGh1bWI=" }];
  return doc;
}
const original = () => new Blob([Uint8Array.from({ length: 3200 }, (_, index) => index % 251)], { type: "image/png" });

test("portable package embeds original bytes, remaps IDs and restores in a clean asset store", async () => {
  const doc = imageDocument();
  const blob = original();
  const payload = await design.exportPackage(doc, { readAsset: async (id) => id === "source-image" ? { blob } : null });
  const parsed = JSON.parse(payload);
  assert.equal(parsed.format, "hh-design-package");
  assert.equal(parsed.assets[0].size, blob.size);
  assert.notEqual(parsed.assets[0].data, "dGh1bWI=");
  const clean = new Map();
  const restored = await design.importPackage(payload, { documentId: "target-project", storeAssets: async (records) => records.forEach((entry) => clean.set(entry.id, entry)) });
  assert.equal(restored.id, "target-project");
  assert.notEqual(restored.assets[0].id, doc.assets[0].id);
  assert.equal(restored.layers[0].assetId, restored.assets[0].id);
  assert.deepEqual(new Uint8Array(await clean.get(restored.assets[0].id).blob.arrayBuffer()), new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(restored.history, { past: [], future: [] });
  const restoredTwice = await design.importPackage(payload, { storeAssets: async (records) => records.forEach((entry) => clean.set(entry.id, entry)) });
  assert.notEqual(restoredTwice.assets[0].id, restored.assets[0].id);
  assert.equal(clean.size, 2, "Importing twice never overwrites an existing asset");
});

test("package validation completes before writes and rejects corruption, duplicates and oversized assets", async () => {
  const payload = JSON.parse(await design.exportPackage(imageDocument(), { readAsset: async () => ({ blob: original() }) }));
  let writes = 0;
  const storeAssets = async () => { writes += 1; };
  const corrupt = structuredClone(payload); corrupt.assets[0].data = "AAAA" + corrupt.assets[0].data.slice(4);
  await assert.rejects(design.importPackage(corrupt, { storeAssets }), /Checksum/);
  const size = structuredClone(payload); size.assets[0].size += 1;
  await assert.rejects(design.importPackage(size, { storeAssets }), /Kích thước/);
  const duplicate = structuredClone(payload); duplicate.assets.push(duplicate.assets[0]);
  await assert.rejects(design.importPackage(duplicate, { storeAssets }), /Manifest/);
  const huge = structuredClone(payload); huge.assets[0].size = design.PACKAGE_LIMITS.assetBytes + 1;
  await assert.rejects(design.importPackage(huge, { storeAssets }), /16 MiB/);
  const version = structuredClone(payload); version.version = 999;
  await assert.rejects(design.importPackage(version, { storeAssets }), /phiên bản/);
  assert.equal(writes, 0);
});

test("failed asset transaction never returns a falsely imported document; old metadata remains compatible", async () => {
  const payload = await design.exportPackage(imageDocument(), { readAsset: async () => ({ blob: original() }) });
  await assert.rejects(design.importPackage(payload, { storeAssets: async () => { throw new Error("Quota exceeded"); } }), /Quota/);
  const metadataOnly = design.exportDocument(imageDocument());
  const restored = await design.importPackage(metadataOnly);
  assert.equal(restored.id, "portable-source");
  assert.equal((await design.exportPreflight(restored, { readAsset: async () => null })).ok, false);
  await assert.rejects(design.exportPackage(restored, { readAsset: async () => null }), /Thiếu bản gốc/);
});

test("SVG graphical export embeds full original bytes without truncation and excludes editor chrome", async () => {
  const doc = imageDocument();
  doc.layers[0].metadata = { objectUrl: "blob:stale", dataUrl: doc.assets[0].thumbnail };
  const blob = original();
  const output = await design.prepareExportSVG(doc, { readAsset: async () => ({ blob }), scale: 2 });
  const encoded = Buffer.from(await blob.arrayBuffer()).toString("base64");
  assert.ok(encoded.length > 2000, "Regression exceeds old escaping truncation limit");
  assert.ok(output.svg.includes(`href="data:image/png;base64,${encoded}"`));
  assert.ok(!output.svg.includes("dGh1bWI="));
  assert.ok(!output.svg.includes("blob:stale"));
  assert.ok(!output.svg.includes('class="gdu-selection-ui"'));
  assert.ok(!output.svg.includes('class="gdu-rulers"'));
  assert.ok(!output.svg.includes('fill="url(#gdu-grid)"'));
  assert.ok(output.svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(output.svg.includes('width="2880" height="1800"'));
  assert.doesNotMatch(output.svg, /\sdata-gdu-[\w-]+(?=[\s>])/);
  assert.equal(output.width, 2880);
  assert.equal(output.height, 1800);
  const saved = design.serializableDocument(doc);
  assert.equal(saved.layers[0].metadata.objectUrl, undefined);
});

test("preflight blocks missing original, untrusted SVG and health errors; warnings alone remain exportable", async () => {
  const doc = imageDocument();
  let preflight = await design.exportPreflight(doc, { readAsset: async () => null });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.issues.some((issue) => issue.id === "original-image-layer"));
  await assert.rejects(design.prepareExportSVG(doc, { readAsset: async () => null }), /Preflight chặn/);
  preflight = await design.exportPreflight(doc, { readAsset: async () => ({ blob: new Blob(['<svg onload="bad()"/>'], { type: "image/svg+xml" }) }) });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.issues.some((issue) => issue.id === "mime-image-layer"));
  doc.assets[0].status = "missing";
  await assert.rejects(design.prepareExportSVG(doc, { readAsset: async () => ({ blob: original() }) }), /asset missing/);
  doc.assets[0].status = "ready";
  doc.assets[0].license = "unknown";
  const result = await design.prepareExportSVG(doc, { readAsset: async () => ({ blob: original() }) });
  assert.ok(result.warnings.some((issue) => issue.id === "license-source-image"));
  doc.frames[0].width = 100000;
  await assert.rejects(design.prepareExportSVG(doc, { readAsset: async () => ({ blob: original() }) }), /Kích thước xuất/);
});

function rect(x, y, width, height, extra = {}) { return { type: "rect", frameId: "frame", x, y, width, height, cornerRadius: 0, ...extra }; }
function winding(path, x, y) {
  let total = 0;
  for (const contour of path.split("Z").filter((part) => part.trim())) {
    const values = contour.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const points = [];
    for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, ay] = points[i], [bx, by] = points[i + 1];
      const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
      if (ay <= y && by > y && cross > 0) total += 1;
      if (ay > y && by <= y && cross < 0) total -= 1;
    }
  }
  return total !== 0;
}

test("rectangle Boolean preserves actual union, subtract holes, intersection and XOR geometry", () => {
  const layers = [rect(0, 0, 100, 100), rect(25, 25, 50, 50)];
  const expected = { union: 10000, subtract: 7500, intersect: 2500, exclude: 7500 };
  for (const mode of Object.keys(expected)) {
    const result = design.rectangleBoolean(layers, mode);
    assert.equal(result.area, expected[mode], mode);
    assert.equal(winding(result.pathData, 50, 50), mode === "union" || mode === "intersect", `${mode} center`);
    assert.equal(winding(result.pathData, 10, 10), mode !== "intersect", `${mode} border`);
  }
  const separated = design.rectangleBoolean([rect(0, 0, 10, 10), rect(30, 0, 10, 10)], "union");
  assert.equal(separated.area, 200);
  assert.equal(winding(separated.pathData, 20, 5), false, "Empty gap must not become bounding-box fill");
  assert.equal(design.rectangleBoolean([rect(0, 0, 10, 10), rect(30, 0, 10, 10)], "intersect").empty, true);
});

test("Boolean contours match independently sampled coverage for overlapping and corner-touching shapes", () => {
  const layers = [rect(0, 0, 30, 30), rect(15, 10, 35, 25), rect(30, 35, 20, 20), rect(10, 40, 20, 10)];
  for (const mode of ["union", "subtract", "intersect", "exclude"]) {
    const result = design.rectangleBoolean(layers, mode);
    for (let x = -1.25; x < 60; x += 3.5) for (let y = -1.25; y < 60; y += 3.5) {
      const contains = layers.map((layer) => x > layer.x && x < layer.x + layer.width && y > layer.y && y < layer.y + layer.height);
      const count = contains.filter(Boolean).length;
      const expected = mode === "union" ? count > 0 : mode === "subtract" ? contains[0] && count === 1 : mode === "intersect" ? count === layers.length : count % 2 === 1;
      assert.equal(result.empty ? false : winding(result.pathData, x, y), expected, `${mode} at ${x},${y}`);
    }
  }
});

test("unsupported Boolean geometry does not mutate original; valid result and empty result support undo", () => {
  let doc = design.defaultDocument();
  doc.layers = [design.normalizeLayer({ id: "a", ...rect(0, 0, 100, 100) }, doc.frames[0].id), design.normalizeLayer({ id: "b", ...rect(25, 25, 50, 50) }, doc.frames[0].id)];
  const before = structuredClone(doc);
  const result = design.operation(doc, "boolean-layers", { ids: ["a", "b"], mode: "subtract" });
  assert.equal(result.layers.length, 1);
  assert.equal(winding(result.layers[0].pathData, 50, 50), false);
  assert.deepEqual(design.undo(result).layers, design.normalizeDocument(before).layers);
  doc.layers[1].rotation = 15;
  const untouched = JSON.stringify(doc);
  assert.throws(() => design.operation(doc, "boolean-layers", { ids: ["a", "b"], mode: "union" }), /không bo góc/);
  assert.equal(JSON.stringify(doc), untouched);
  assert.throws(() => design.rectangleBoolean([rect(0, 0, 10, 10), rect(0, 0, 5, 5, { type: "path" })]), /engine/);
});

test("storage failures are explicit and scoped reads never claim unrelated legacy data", () => {
  const store = storage();
  store.setItem(design.STORAGE_KEY, JSON.stringify(design.defaultDocument({ id: "legacy-private" })));
  const blank = design.readStored(store, "hh.account.b.project.2", { allowLegacy: false, documentId: "project-2" });
  assert.equal(blank.id, "project-2");
  assert.equal(design.writeStored(blank, null), false);
  assert.equal(design.writeStored(blank, { setItem() { throw new Error("Quota"); } }), false);
  assert.equal(design.writeStored(blank, store, "hh.account.b.project.2"), true);
  assert.equal(JSON.parse(store.getItem(design.STORAGE_KEY)).id, "legacy-private");
});

test("frame mutations update real render/export dimensions with validated inputs and exact undo", async () => {
  const doc = design.defaultDocument();
  const updated = design.operation(doc, "set-frame", { id: doc.activeFrameId, changes: { width: 800, height: 600, background: "#112233", name: "Poster" } });
  assert.equal(updated.frames[0].width, 800);
  assert.equal(updated.frames[0].height, 600);
  const exported = await design.prepareExportSVG(updated);
  assert.equal(exported.width, 800);
  assert.equal(exported.height, 600);
  assert.ok(exported.svg.includes('fill="#112233"'));
  assert.deepEqual(design.undo(updated).frames, doc.frames);
  const sanitized = design.operation(updated, "set-frame", { changes: { width: -10, height: 1e9, background: 'url(javascript:bad)' } });
  assert.equal(sanitized.frames[0].width, 1);
  assert.equal(sanitized.frames[0].height, 100000);
  assert.equal(sanitized.frames[0].background, "#112233");
});

test("mirror writes are ordered and never drop latest edit; failure cannot claim saved", async () => {
  const previous = global.HHGraphicProjectStore;
  const saved = [], closed = [], store = storage();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  global.HHGraphicProjectStore = { createStore: async ({ accountId }) => ({ saveProject: async (project) => { if (!saved.length) await gate; saved.push({ accountId, project }); }, close: () => closed.push(true) }) };
  try {
    const state = { storage: store, storageKey: "hh.scoped", projectContext: { accountId: "account-a" } };
    const first = design.defaultDocument({ id: "project", name: "Revision one" });
    const firstSave = design.persist(first, state);
    const second = structuredClone(first); second.name = "Revision two";
    const secondSave = design.persist(second, state);
    release();
    assert.equal((await firstSave).ok, true);
    assert.equal((await secondSave).ok, true);
    assert.deepEqual(saved.map((item) => item.project.name), ["Revision one", "Revision two"]);
    assert.ok(saved.every((item) => item.accountId === "account-a"));
    assert.equal(closed.length, 2);
    assert.equal(JSON.parse(store.getItem("hh.scoped")).name, "Revision two");
    global.HHGraphicProjectStore = { createStore: async () => ({ saveProject: async () => { throw new Error("IDB quota"); }, close() {} }) };
    const failed = await design.persist(second, state);
    assert.equal(failed.ok, false);
    assert.equal(failed.local, true);
    assert.equal(failed.mirrored, false);
    assert.match(state.saveState, /kho dự án chưa lưu: IDB quota/);
  } finally { global.HHGraphicProjectStore = previous; }
});
