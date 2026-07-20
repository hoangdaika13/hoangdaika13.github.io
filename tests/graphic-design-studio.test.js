const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("graphic design studio exposes all requested workspaces", () => {
  const client = read("graphic-design-studio.js");
  for (const token of ["HHGraphicDesign", "data-graphic-animation", "data-graphic-3d", "data-graphic-prototype", "data-graphic-motion", "character", "routeFor"]) {
    assert.match(client, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("graphic design studio is responsive and keeps engine states truthful", () => {
  const css = read("graphic-design-studio.css");
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:560px\)/);
  assert.match(css, /gd-engine-unavailable/);
  assert.match(css, /prefers-reduced-motion/);
});
