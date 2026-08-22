const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-capability-atlas.js");
const styles = read("home-capability-atlas.css");
const router = read("script.js");
const html = read("index.html");
const loader = read("performance-loader.js");
const worker = read("sw.js");

test("Home Capability Atlas is mounted, versioned and available offline", () => {
  assert.match(html, /id="homeCapabilityAtlasRoot"/);
  for (const asset of ["home-capability-atlas.css?v=1", "home-capability-atlas.js?v=3"]) {
    assert.ok(loader.includes(asset), `${asset} must load with Home enhancements`);
    assert.ok(worker.includes(`./${asset}`), `${asset} must be cached by the service worker`);
  }
  assert.match(router, /window\.HHNavigationCatalog/);
  assert.match(source, /window\.HHHomeCapabilityAtlas/);
});

test("the atlas uses the live permission-aware sidebar catalog", () => {
  assert.match(router, /orderedNavigationSections\(\)\.map/);
  assert.match(router, /sidebarSearchAliases\[group\.id\]/);
  assert.match(router, /group\.pages/);
  assert.match(router, /group\.studioItems/);
  assert.match(router, /moduleById\(id\)/);
  assert.match(source, /HHNavigationCatalog\?\.getSections/);
  assert.match(source, /const key = normalize\(feature\.title\)/);
  assert.doesNotMatch(source, /Admin Panel.*route:\s*["']\/admin/s);
});

test("all public top-level workspaces have beginner-friendly summaries", () => {
  for (const id of [
    "chat-ai", "create", "draw", "music-ai", "comic-motion", "media-design", "graphic-design",
    "google", "youtube-main", "discord", "communication", "remote", "comic-reader", "cinema",
    "music-library", "fortune", "work", "davinci-resolve", "dev", "insights", "copyright",
    "learn", "english", "japanese", "chinese", "system", "support"
  ]) assert.ok(source.includes(`${JSON.stringify(id)}:`) || source.includes(`${id}: [`), `missing summary for ${id}`);
  assert.match(source, /BẢN ĐỒ CHỨC NĂNG HH/);
  assert.match(source, /Xem \$\{features\.length\} chức năng/);
  assert.match(source, /data-app-route/);
});

test("search, group filters, responsive layout and motion comfort are present", () => {
  for (const contract of ["data-hca-search", "data-hca-section", "data-hca-expand", "data-hca-clear", "aria-live"]) {
    assert.ok(source.includes(contract), `missing interaction ${contract}`);
  }
  assert.match(styles, /@media\s*\(max-width:\s*560px\)/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /hca-nebula-drift/);
  assert.match(styles, /hca-orbit-spin/);
});
