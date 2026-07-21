const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Work route mounts a dedicated operating center", () => {
  const app = read("script.js");
  assert.match(app, /route === "\/work"/);
  assert.match(app, /HHWorkCenter\?\.mount/);
  assert.match(app, /data-work-center-host/);
  assert.match(app, /data-work-capture/);
});

test("Work Center connects all nine workspaces", () => {
  const source = read("work-center.js");
  for (const id of ["project-center", "cloud-storage", "download-center", "knowledge-center", "store", "wishlist-compare", "team-collaboration", "form-builder", "workflow-automation"]) {
    assert.match(source, new RegExp(`id: "${id}"`));
    assert.match(source, new RegExp(`\/work\/${id}`));
  }
});

test("Quick capture writes to Project Center and Knowledge Center", () => {
  const source = read("work-center.js");
  assert.match(source, /hh-project-center/);
  assert.match(source, /hh-knowledge-center/);
  assert.match(source, /function saveCapture/);
  assert.match(source, /state\.tasks\.unshift/);
  assert.match(source, /state\.projects\.unshift/);
  assert.match(source, /state\.articles\.unshift/);
  assert.doesNotMatch(source, /window\.prompt|window\.alert/);
});

test("Device Vault persists real files with IndexedDB", () => {
  const source = read("work-center.js");
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /dataTransfer\?\.files/);
  assert.match(source, /store\.put/);
  assert.match(source, /store\.delete/);
  assert.match(source, /URL\.createObjectURL/);
});

test("Work assets are versioned and available offline", () => {
  const index = read("index.html");
  const worker = read("sw.js");
for (const asset of ["work-center.css?v=1", "work-center.js?v=1", "script.js?v=114", "insights-pro.css?v=1", "insights-pro.js?v=3"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(worker, pattern);
  }
});
