const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("graphic design studio exposes all requested workspaces", () => {
  const client = read("graphic-design-studio.js");
  for (const token of ["HHGraphicDesign", "data-graphic-quick-motion", "data-graphic-animation", "data-graphic-3d", "data-graphic-mockup", "data-graphic-prototype", "data-graphic-motion", "data-graphic-character", "routeFor"]) {
    assert.match(client, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("graphic design studio is responsive and keeps engine states truthful", () => {
  const css = read("graphic-design-studio.css");
  assert.match(css, /@media \(max-width:\s*900px\)/);
  assert.match(css, /@media \(max-width:\s*680px\)/);
  assert.match(css, /gd-engine-unavailable/);
  assert.match(css, /prefers-reduced-motion/);
});

test("graphic design hub fixes the hero grid and provides real local workflows", () => {
  const client = read("graphic-design-studio.js");
  const css = read("graphic-design-studio.css");
  for (const token of [
    "hh.graphic-design.hub.v2",
    "data-gd-project-list",
    "data-gd-template-list",
    "data-gd-brand",
    "data-gd-assets",
    "data-gd-dropzone",
    "data-gd-check",
    "copy-tokens",
    "download-tokens"
  ]) assert.match(client, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /\.gd-hero-orbit\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.gd-dashboard-grid/);
  assert.match(css, /\.gd-template-grid/);
  assert.match(css, /\.gd-resource-grid/);
});
