const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("P0 and P1 workspace upgrades are loaded and available offline", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  const assets = [
    "command-center-pro.css?v=4",
    "command-center-pro.js?v=5",
    "team-collaboration-pro.css?v=2",
    "team-collaboration-pro.js?v=2",
    "ai-center-advanced.css?v=1",
    "ai-center-advanced.js?v=1",
    "platform-p0.css?v=1",
    "platform-p0.js?v=1"
  ];

  for (const asset of assets) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
  assert.match(worker, /hh-dev-hub-v166/);
});
