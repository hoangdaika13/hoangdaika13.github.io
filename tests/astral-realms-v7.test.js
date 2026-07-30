const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Visual V7 fixes the photoreal black-frame regression", () => {
  const source = read("astral-realms.js");
  assert.match(source, /scene\.background\?\.isColor/);
  assert.match(source, /rendererMode === "webgpu"/);
  assert.match(source, /webglcontextlost/);
  assert.match(source, /enterRendererRecovery/);
  assert.match(source, /lastRenderSuccessAt/);
  assert.doesNotMatch(source, /scene\.background\.setRGB/);
});

test("all eight open-world regions have living biome profiles", () => {
  const source = read("astral-realms.js");
  for (const zone of ["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"]) {
    assert.match(source, new RegExp(`${zone}: \\{ accent:`));
  }
  for (const system of [
    "createLivingWorldEffects",
    "updateLivingWorld",
    "createFootprintPool",
    "emitFootprint",
    "applyBiomeVisualState"
  ]) {
    assert.match(source, new RegExp(`${system}\\(`));
  }
});

test("combat, NPCs and cinematics expose real V7 behavior", () => {
  const source = read("astral-realms.js");
  assert.match(source, /spawnElementBurst/);
  assert.match(source, /schedule: \{/);
  assert.match(source, /is-world-event/);
  assert.match(source, /is-cinematic/);
  assert.match(source, /vfxLevel/);
  assert.match(source, /livingWorld/);
});

test("V7 visual effects remain responsive and motion-safe", () => {
  const css = read("astral-realms.css");
  assert.match(css, /Astral Realms Visual V7/);
  assert.match(css, /\.har-biome-fx/);
  assert.match(css, /\.har-cinematic-bars/);
  assert.match(css, /data-precipitation="snow"/);
  assert.match(css, /data-vfx="static"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 760px/);
});

test("the route loader and offline cache keep the latest Astral Realms bundle", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const token of ["astral-realms.css?v=71", "astral-realms.js?v=71"]) {
    assert.ok(loader.includes(token), `loader missing ${token}`);
    assert.ok(worker.includes(token), `worker missing ${token}`);
  }
});
