const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Cosmic Studio is registered as a lazy Galaxy module", () => {
  const loader = read("performance-loader.js");
  assert.match(loader, /galaxy-cosmic-studio\.css\?v=1/);
  assert.match(loader, /galaxy-cosmic-studio\.js\?v=3/);
  assert.match(loader, /galaxy-home-ai\.css\?v=24/);
});

test("Cosmic Studio exposes every Layer One workspace and local-first controls", () => {
  const source = read("galaxy-cosmic-studio.js");
  for (const route of ["ai", "music", "video", "creator", "games", "dev", "learning", "community", "tools", "analytics", "settings"]) {
    assert.match(source, new RegExp(`/galaxy/${route}`));
  }
  assert.match(source, /data-gcs-view/);
  assert.match(source, /data-gcs-directory/);
  assert.match(source, /data-hgl1-action=\"open-command\"/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /accountStorage/);
  assert.match(source, /sensitive/);
});

test("Galaxy keeps Platform chrome and lifecycle cleanup deterministic", () => {
  const homeCss = read("galaxy-home-ai.css");
  const layer = read("galaxy-layer-one.js");
  const cosmicCss = read("galaxy-cosmic-studio.css");
  assert.match(homeCss, /#appShell\[data-hh-layer="platform"\]\[data-galaxy-shell\] > \.app-header/);
  assert.match(homeCss, /#appShell\[data-hh-layer="platform"\]\[data-galaxy-shell\] > \.app-shell__body/);
  assert.match(layer, /accountStorage\?\./);
  assert.match(layer, /action === \"open-command\"/);
  assert.match(layer, /active\.cosmicStudio\?\.destroy/);
  assert.match(cosmicCss, /prefers-reduced-motion/);
  assert.match(cosmicCss, /overflow-y:auto/);
});

test("new assets are available to the offline catalog", () => {
  const worker = read("sw.js");
  assert.match(worker, /galaxy-cosmic-studio\.css\?v=1/);
  assert.match(worker, /galaxy-cosmic-studio\.js\?v=3/);
  assert.match(worker, /galaxy-home-ai\.css\?v=24/);
  assert.match(worker, /performance-loader\.js\?v=647/);
});
