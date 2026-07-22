const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const worker = read("sw.js");

const assets = [
  "home-daily-command.css?v=3",
  "home-command-search.css?v=2",
  "home-widget-project-pulse.css?v=2",
  "home-health-focus.css?v=2",
  "home-daily-command.js?v=4",
  "home-command-search.js?v=2",
  "home-widget-project-pulse.js?v=2",
  "home-health-focus.js?v=2"
];

test("home experience assets are loaded and cached", () => {
  for (const asset of assets) {
    assert.ok(index.includes(asset), `${asset} must be loaded by index.html`);
    assert.ok(worker.includes(`./${asset}`), `${asset} must be cached for offline use`);
  }
  assert.match(worker, /const CACHE = "hh-identity-portal-v\d+"/);
});

test("home enhancements load after the existing Command Center runtime", () => {
  const base = index.indexOf("command-center-pro.js?v=5");
  assert.ok(base >= 0);
  for (const file of assets.filter((asset) => asset.endsWith(".js?v=1"))) {
    assert.ok(index.indexOf(file) > base, `${file} must enhance the initialized runtime`);
  }
});
