const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ENGINES = [
  ["graphic-design-nondestructive.js?v=1", "HHGraphicNondestructive", "nondestructive"],
  ["graphic-design-typography-pro.js?v=1", "HHGraphicTypographyPro", "typography"],
  ["graphic-design-node-effects.js?v=1", "HHGraphicNodeEffects", "effects"],
  ["graphic-design-character-pro.js?v=1", "HHGraphicCharacterPro", "character"],
  ["graphic-design-simulation.js?v=1", "HHGraphicSimulation", "simulation"],
  ["graphic-design-data-driven.js?v=1", "HHGraphicDataDriven", "data"],
  ["graphic-design-components.js?v=2", "HHGraphicComponents", "components"],
  ["graphic-design-color-pro.js?v=1", "HHGraphicColorPro", "color"],
  ["graphic-design-export-center.js?v=2", "HHGraphicExportCenter", "export"],
  ["graphic-design-plugins.js?v=1", "HHGraphicPlugins", "plugins"],
  ["graphic-design-review.js?v=2", "HHGraphicReview", "review"],
  ["graphic-design-performance.js?v=1", "HHGraphicPerformance", "performance"]
];

test("Graphic Design Pro engines are loaded, routed and cached", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  const studio = read("graphic-design-studio.js");
  const shell = read("script.js");

  for (const [asset, api, route] of ENGINES) {
    const escaped = asset.replace(/[.?]/g, "\\$&");
    assert.match(worker, new RegExp(escaped));
    assert.match(studio, new RegExp(escaped));
    assert.match(studio, new RegExp(api));
    assert.match(studio, new RegExp(`id: ["']${route}["']`));
    assert.match(shell, new RegExp(`/graphic-design/${route}`));
  }
  assert.match(worker, /hh-learning-os-v170/);
  assert.match(html, /script\.js\?v=117/);
  assert.match(html, /graphic-design-studio\.js\?v=5/);
  assert.doesNotMatch(html, /graphic-design-nondestructive\.js\?v=1/);
  assert.match(studio, /engineLoads/);
  assert.match(studio, /script\.async = true/);
});

test("Graphic Design Pro source does not ship obvious credentials", () => {
  for (const [asset] of ENGINES) {
    const source = read(asset.split("?")[0]);
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}/);
    assert.doesNotMatch(source, /mongodb(?:\+srv)?:\/\//i);
    assert.doesNotMatch(source, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
  }
});
