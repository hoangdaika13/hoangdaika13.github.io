"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const root = path.resolve(__dirname, "..");
function load() {
  const context = { document: { querySelector: () => ({}) }, addEventListener() {} };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, "tool-manifests.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "feature-lab.js"), "utf8"), context);
  return context.HHFeatureLab;
}
const plain = value => JSON.parse(JSON.stringify(value));
test("catalog view normalizes only bounded enum controls, not arbitrary search/private content", () => {
  const api = load();
  assert.deepEqual(plain(api.normalizeCatalogView(null)), { group: "all", collection: "all", runtime: "all", sort: "registry" });
  assert.deepEqual(plain(api.normalizeCatalogView({ group: "Developer", collection: "pinned", runtime: "ai", sort: "name", secret: "not stored", query: "private" })), { group: "Developer", collection: "pinned", runtime: "ai", sort: "name" });
  assert.deepEqual(plain(api.normalizeCatalogView({ group: "fake", collection: [], runtime: {}, sort: "javascript:evil" })), plain(api.normalizeCatalogView()));
});
test("catalog combines engine, group, collection and Vietnamese accent-insensitive metadata search", () => {
  const api = load(), catalog = [
    { id: "one", name: "Ghi chú", description: "Đổi văn bản", group: "Productivity", runtime: "browser" },
    { id: "two", name: "Tạo ảnh", description: "Đổi văn bản", group: "Developer", runtime: "ai" },
    { id: "three", name: "Tạo ảnh", description: "Đổi văn bản", group: "Developer", runtime: "browser" }
  ];
  assert.deepEqual(plain(api.filterCatalog(catalog, { group: "Developer", runtime: "ai", collection: "favorites" }, { favorites: ["two"] }, "doi van ban").map(row => row.id)), ["two"]);
  assert.deepEqual(plain(api.filterCatalog(catalog, {}, {}, "ghi chu").map(row => row.id)), ["one"]);
  assert.equal(api.filterCatalog(catalog, { collection: "recent" }, {}, "").length, 0);
  assert.equal(api.filterCatalog(catalog, { group: "Developer" }, {}, "missing").length, 0);
});
test("catalog orders actual recent/pinned ids and stable names without mutating source or inventing counts", () => {
  const api = load(), catalog = [{ id: "b", name: "Beta", group: "Developer", runtime: "browser" }, { id: "a", name: "Alpha", group: "Developer", runtime: "browser" }, { id: "c", name: "Charlie", group: "Developer", runtime: "browser" }];
  assert.deepEqual(plain(api.filterCatalog(catalog, { sort: "name" }).map(row => row.id)), ["a", "b", "c"]);
  assert.deepEqual(plain(api.filterCatalog(catalog, { sort: "recent" }, { recent: ["c", "a"] }).map(row => row.id)), ["c", "a", "b"]);
  assert.deepEqual(plain(api.filterCatalog(catalog, { sort: "pinned" }, { pinned: ["a"] }).map(row => row.id)), ["a", "b", "c"]);
  assert.deepEqual(catalog.map(row => row.id), ["b", "a", "c"]);
  assert.equal(api.catalog().length, 86);
});
test("catalog persists only account-scoped view enums and keeps workspace mounted while filtering", () => {
  const source = fs.readFileSync(path.join(root, "feature-lab.js"), "utf8");
  assert.match(source, /hh\.all-tools\.catalog-view\.v1/);
  assert.match(source, /writeJSON\(VIEW_KEY, viewFromControls\(\), owner\)/);
  assert.match(source, /data-lab-runtime-filter/); assert.match(source, /data-lab-sort/); assert.match(source, /data-lab-reset-filters/);
  assert.match(source, /focused\.focus\(\{ preventScroll: true \}\)/);
  const onChange = source.slice(source.indexOf("const onChange = event"), source.indexOf("const onKey = event"));
  assert.doesNotMatch(onChange, /render\(|select\(/);
});
