const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms V3 loads original photoreal human and environment assets", () => {
  const source = read("astral-realms.js");
  for (const token of [
    "PHOTOREAL_ASSETS",
    "astral-realms-panorama-v1.webp",
    "astral-crew-atlas-v1.webp",
    "loadPhotorealAssets",
    "createPhotorealCharacterModel",
    "SpriteMaterial",
    "MeshPhysicalMaterial",
    'visualStyle: "photoreal"'
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("photoreal assets are optimized for browser delivery", () => {
  const files = [
    "assets/astral-realms/astral-realms-panorama-v1.webp",
    "assets/astral-realms/astral-crew-atlas-v1.webp"
  ];
  for (const file of files) {
    const stat = fs.statSync(path.join(root, file));
    assert.ok(stat.size > 100_000, `${file} should contain a real visual asset`);
    assert.ok(stat.size < 1_000_000, `${file} should remain below 1 MB`);
  }
});

test("visual V3 exposes adaptive modes and character portraits", () => {
  const source = read("astral-realms.js");
  const css = read("astral-realms.css");
  assert.match(source, /Người thật · Cảnh thật/);
  assert.match(source, /PBR 3D nhẹ/);
  assert.match(source, /Toon hiệu năng/);
  assert.match(css, /Astral Realms Visual V7/);
  assert.match(css, /har-team-portrait/);
  assert.match(css, /har-character-card__avatar > i/);
  assert.match(css, /prefers-reduced-motion/);
});

test("runtime and offline cache request the V3 bundle", () => {
  const loader = read("performance-loader.js");
  const serviceWorker = read("sw.js");
  for (const token of ["astral-realms.css?v=8", "astral-realms.js?v=8"]) {
    assert.match(loader, new RegExp(token.replace(/[.?]/g, "\\$&")));
    assert.match(serviceWorker, new RegExp(token.replace(/[.?]/g, "\\$&")));
  }
  assert.match(serviceWorker, /assets\/astral-realms\/astral-realms-panorama-v1\.webp/);
  assert.match(serviceWorker, /assets\/astral-realms\/astral-crew-atlas-v1\.webp/);
});
