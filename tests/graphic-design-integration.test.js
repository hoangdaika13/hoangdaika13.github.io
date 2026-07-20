const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Graphic Design is a first-class application section", () => {
  const html = read("index.html");
  const client = read("script.js");
  const worker = read("sw.js");
  for (const asset of ["graphic-design-studio.css?v=2", "graphic-design-animation.js?v=1", "graphic-design-3d.js?v=1", "graphic-design-prototype.js?v=1", "graphic-design-motion.js?v=1", "graphic-design-quick-motion.js?v=1", "graphic-design-mockup.js?v=1", "graphic-design-character.js?v=1", "graphic-design-studio.js?v=2"]) {
    assert.match(html, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(client, /id: "graphic-design"/);
  assert.match(client, /route: "\/graphic-design"/);
  assert.match(client, /data-graphic-design-host/);
  assert.match(client, /HHGraphicDesign\?\.mount/);
  assert.match(client, /\/graphic-design\/quick-motion/);
  assert.match(client, /\/graphic-design\/mockup/);
  assert.match(client, /"quick-motion": "Motion Maker"/);
  assert.match(client, /mockup: "3D Device Mockup"/);
});
