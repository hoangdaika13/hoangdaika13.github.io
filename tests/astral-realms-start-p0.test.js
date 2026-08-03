const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");

test("start hub renders real save facts instead of marketing counters", () => {
  for (const token of [
    "data-har-start-character",
    "data-har-start-level",
    "data-har-start-zone",
    "data-har-start-playtime",
    "data-har-start-power",
    "data-har-start-checkpoint",
    "data-har-start-saved-at",
    "renderStartScreen",
    "equipmentPowerForStart"
  ]) assert.ok(source.includes(token), `missing start-save token ${token}`);
  assert.doesNotMatch(source, /08<\/strong>Khu vực streaming/);
  assert.doesNotMatch(source, /06<\/strong>Nhiệm vụ thật/);
});

test("start hub owns a lightweight 3D character and equipped weapon preview", () => {
  for (const token of [
    "data-har-start-preview",
    "prepareStartPreview",
    "disposeStartPreview",
    "createAnimeCharacterMesh",
    "createPlayerWeapon(profile, weaponClass, { hydrate: false })",
    "startPreviewFrame"
  ]) assert.ok(source.includes(token), `missing start-preview token ${token}`);
  assert.match(css, /\.har-start-character/);
  assert.match(css, /\.har-start-preview/);
});

test("start hub provides character select, settings and a truthful performance check", () => {
  for (const token of [
    "data-har-start-settings",
    "data-har-start-character-select",
    "data-har-start-benchmark",
    "runStartPerformanceCheck",
    "pendingStartAction"
  ]) assert.ok(source.includes(token), `missing start action ${token}`);
  assert.match(source, /navigator\?\.deviceMemory/);
  assert.match(source, /navigator\?\.hardwareConcurrency/);
  assert.match(css, /\.har-start-save/);
});

