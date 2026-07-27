const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const universal = require(path.join(root, "graphic-design-universal.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Universal Design Document owns every shared design domain", () => {
  const document = universal.defaultDocument({ id: "design-test", name: "Design test" });

  assert.equal(document.format, "hh-design-document");
  assert.equal(document.id, "design-test");
  for (const key of [
    "pages", "frames", "layers", "assets", "components", "variables",
    "commandLog", "versions", "branches", "comments", "approvals", "jobs"
  ]) {
    assert.ok(Object.hasOwn(document, key), `${key} must exist`);
  }
  assert.equal(document.canvas.width, 1440);
  assert.equal(document.canvas.height, 900);
  assert.equal(universal.PLANETS.length, 11);
});

test("commands update one document and support exact undo and redo", () => {
  let document = universal.defaultDocument({ id: "history-test" });
  document = universal.operation(document, "add-layer", {
    type: "rect",
    name: "CTA",
    x: 40,
    y: 70,
    width: 220,
    height: 64
  });
  const layerId = document.selectedLayerId;

  assert.equal(document.layers.find((layer) => layer.id === layerId).opacity, 1);
  assert.equal(document.layers.find((layer) => layer.id === layerId).rotation, 0);
  assert.equal(document.commandLog.at(-1).before.commandLog.length, 0);
  assert.equal(document.commandLog.at(-1).after.commandLog.length, 0);

  document = universal.operation(document, "update-layer", {
    id: layerId,
    changes: { x: 320, opacity: 0.5 }
  });
  assert.equal(document.layers.find((layer) => layer.id === layerId).x, 320);

  document = universal.undo(document);
  assert.equal(document.layers.find((layer) => layer.id === layerId).x, 40);
  assert.equal(document.layers.find((layer) => layer.id === layerId).opacity, 1);

  document = universal.redo(document);
  assert.equal(document.layers.find((layer) => layer.id === layerId).x, 320);
  assert.equal(document.layers.find((layer) => layer.id === layerId).opacity, 0.5);
});

test("Brand Kit and Asset Observatory mutations share the same document", () => {
  let document = universal.defaultDocument({ id: "shared-data" });
  document = universal.operation(document, "set-brand-token", {
    key: "color.brand.primary",
    value: "#1234aa"
  });
  document = universal.operation(document, "set-brand-font", {
    key: "heading",
    value: "Be Vietnam Pro"
  });
  document = universal.operation(document, "add-asset", {
    id: "hero-image",
    name: "Hero image",
    kind: "image",
    type: "image/webp",
    source: "local-device",
    license: "unknown"
  });

  assert.equal(document.brand.tokens["color.brand.primary"], "#1234aa");
  assert.equal(document.brand.fonts.heading, "Be Vietnam Pro");
  assert.equal(document.assets.at(-1).id, "hero-image");

  document = universal.operation(document, "remove-asset", { id: "hero-image" });
  assert.equal(document.assets.some((asset) => asset.id === "hero-image"), false);
});

test("Design Health reports real accessibility, asset and rights issues", () => {
  let document = universal.defaultDocument({ id: "health-test" });
  document.layers[0].fill = "#07101d";
  document = universal.operation(document, "add-layer", {
    type: "image",
    name: "Unlicensed preview",
    assetId: "asset-low-res",
    altText: ""
  });
  document = universal.operation(document, "add-asset", {
    id: "asset-low-res",
    name: "Preview",
    kind: "image",
    width: 320,
    height: 180,
    status: "missing",
    license: "unknown"
  });

  const health = universal.runHealthScan(document);
  const ids = health.issues.map((issue) => issue.id);
  assert.equal(health.ok, false);
  assert.ok(ids.some((id) => id.startsWith("contrast-")));
  assert.ok(ids.some((id) => id.startsWith("alt-")));
  assert.ok(ids.includes("asset-asset-low-res"));
  assert.ok(ids.includes("license-asset-low-res"));
  assert.ok(ids.includes("resolution-asset-low-res"));
});

test("HH Design export is portable and rejects unrelated JSON", () => {
  let document = universal.defaultDocument({ id: "roundtrip", name: "Portable design" });
  document = universal.operation(document, "set-brand-token", {
    key: "color.brand.primary",
    value: "#1122ff"
  });
  const exported = universal.exportDocument(document);
  const restored = universal.importDocument(exported);

  assert.equal(restored.id, "roundtrip");
  assert.equal(restored.name, "Portable design");
  assert.equal(restored.brand.tokens["color.brand.primary"], "#1122ff");
  assert.deepEqual(restored.history, { past: [], future: [] });
  assert.throws(
    () => universal.importDocument(JSON.stringify({ format: "not-hh-design" })),
    /không hợp lệ/
  );
});

test("Graphic Design AI uses the configured backend without client secrets", () => {
  const client = read("graphic-design-universal.js");
  const backend = read("api/modules/[moduleId]/actions.js");

  assert.match(client, /\/api\/modules\/ai-center\/actions/);
  assert.match(client, /actionType:\s*"design-plan"/);
  assert.match(client, /requireProvider:\s*true/);
  assert.match(client, /data-gdu-compact/);
  assert.match(client, /"queued", "running", "completed", "failed", "cancelled"/);
  assert.doesNotMatch(client, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(client, /sk-[0-9A-Za-z_-]{20,}/);
  assert.match(backend, /const designPlanSchema =/);
  assert.match(backend, /if \(actionType === "design-plan"\) return designPlanSchema/);
  assert.match(backend, /function geminiSchema\(schema\)/);
  assert.match(backend, /if \(key === "additionalProperties"\) continue/);
  assert.match(backend, /palette/);
  assert.match(backend, /accessibility/);
  assert.match(backend, /nextActions/);
});
