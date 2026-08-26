"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const game = read("hh-eonwild-game.js");
const css = read("hh-eonwild-game.css");
const loader = read("performance-loader.js");
const serviceWorker = read("sw.js");
const packageJson = require(path.join(root, "package.json"));
const registry = require(path.join(root, "hh-eonwild-species-registry.js"));
const atlas = require(path.join(root, "hh-eonwild-world-atlas.js"));
const input = require(path.join(root, "hh-eonwild-input-system.js"));

test("route-lazy bundle loads and precaches desktop control and collision kernels before game v30", () => {
  const expected = [
    "hh-eonwild-cinematic-pack.js?v=1", "hh-eonwild-content-v2.js?v=3",
    "hh-eonwild-species-registry.js?v=1", "hh-eonwild-input-system.js?v=3",
    "hh-eonwild-desktop-controller.js?v=3",
    "hh-eonwild-collision-system.js?v=1",
    "hh-eonwild-world-atlas.js?v=2", "hh-eonwild-simulation-v2.js?v=4",
    "hh-eonwild-3d-core.js?v=9", "hh-eonwild-landscape-core.js?v=1",
    "hh-eonwild-vegetation-system.js?v=1", "hh-eonwild-environment-renderer.js?v=4",
    "hh-eonwild-water-weather-system.js?v=1", "hh-eonwild-renderer-3d.js?v=21",
    "hh-eonwild-game.js?v=30"
  ];
  let previous = -1;
  for (const asset of expected) {
    const index = loader.indexOf(`"${asset}"`);
    assert.ok(index > previous, `${asset} must load once and after its dependency`);
    previous = index;
  }
  assert.match(loader, /styles:\s*\["hh-eonwild-game\.css\?v=27"\]/);
  for (const asset of [...expected.slice(2), "hh-eonwild-game.css?v=27"]) {
    const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.equal((serviceWorker.match(new RegExp(`"\\./${escapedAsset}"`, "g")) || []).length, 1, `${asset} must have one immutable cache entry`);
  }
  assert.match(serviceWorker, /EONWILD_OFFLINE_ASSETS\s*=\s*RUNTIME_ASSETS\.filter/);
  assert.match(serviceWorker, /RUNTIME_ASSETS\.filter\(asset => asset\.startsWith\("\.\/hh-eonwild-"\)\)/);
  assert.match(serviceWorker, /INSTALL_ASSETS\s*=\s*\[\.\.\.new Set\(\[\.\.\.CORE, \.\.\.EONWILD_OFFLINE_ASSETS\]\)\]/);
  assert.match(serviceWorker, /cache\.addAll\(INSTALL_ASSETS\)/);
  assert.match(packageJson.scripts["test:eonwild"], /hh-eonwild-collision-system\.test\.js/);
});

test("game mounts the 300-species catalog without promoting imported taxa", () => {
  assert.equal(registry.species.length, 300);
  assert.match(game, /HHEonWildSpeciesRegistry/);
  assert.match(game, /data-hwe-planet-search/);
  assert.match(game, /data-hwe-planet-group/);
  assert.match(game, /data-hwe-planet-species/);
  assert.match(game, /Catalog-only/);
  assert.match(game, /Tên Việt chưa được nguồn cung cấp/);
  assert.doesNotMatch(game, /SPECIES_REGISTRY\?\.SPECIES[\s\S]{0,180}(?:createPopulation|simulationAllowed\s*=\s*true)/);
  assert.match(css, /\.hwe-planet-grid\s*\{[^}]*overflow-y:\s*auto/);
});

test("World Atlas exposes map selection, confidence and active-region truth", () => {
  assert.equal(atlas.MAPS.length, 26);
  assert.match(game, /data-hwe-atlas-map/);
  assert.match(game, /data-hwe-atlas-map-select/);
  assert.match(game, /floating origin/i);
  assert.match(game, /renderer chỉ dựng vùng 16 × 16 km đang hoạt động/i);
  assert.match(game, /Không phải tái dựng khoa học/);
  assert.match(game, /selectAtlasMap\(instance,/);
  assert.match(game, /atlasAddressForMap/);
  assert.match(game, /new WORLD_ATLAS\.FloatingOrigin/);
  assert.match(game, /new WORLD_ATLAS\.ChunkStreamPlanner/);
  assert.match(game, /new WORLD_ATLAS\.AtlasTileCache/);
  assert.match(game, /syncPlanetRuntime\(instance, seconds, dx, dy\)/);
  assert.match(game, /worldSeedForState\(instance\.state\)/);
  assert.match(css, /\.hwe-atlas-map\.is-selected/);
});

test("Input Action System owns remap, persistence, joystick and cleanup", () => {
  assert.equal(input.VERSION, "1.2.0");
  assert.equal(input.ACTION_IDS.length, 23);
  assert.ok(input.DEFAULT_ACTIONS.interact.some((binding) => binding.code === "KeyE"));
  assert.ok(input.DEFAULT_ACTIONS.interact.some((binding) => binding.code === "KeyF"));
  assert.ok(input.DEFAULT_ACTIONS.toggleView.some((binding) => binding.code === "KeyV"));
  assert.ok(input.DEFAULT_ACTIONS.lockTarget.some((binding) => binding.code === "KeyZ"));
  assert.match(game, /HHEonWildInputSystem/);
  assert.match(game, /data-hwe-remap-action/);
  assert.match(game, /data-hwe-input-preset/);
  assert.match(game, /data-hwe-input-setting="gamepadDeadzone"/);
  assert.match(game, /data-hwe-touch-stick/);
  assert.match(game, /inputSystem\?\.attach\?\.\(instance\.root\)/);
  assert.match(game, /inputSystem\?\.dispose\?\.\(\)/);
  assert.match(game, /new DESKTOP\.FixedTimestepController/);
  assert.match(game, /desktopController\?\.advance/);
  assert.match(game, /filter\(\(binding\) => binding\.device !== "keyboard"\)/);
  assert.match(game, /inputSystem\?\.attach\?\.\(instance\.root\)/);
  assert.match(game, /releaseAll\?\.\("window-blur"\)/);
  assert.match(css, /\.hwe-touch-stick\s*\{/);
  assert.match(css, /\.hwe-input-bindings\s*\{/);
  assert.match(css, /container-name:\s*hwe-workspace/);
  assert.doesNotMatch(css, /@container hwe-root/);
});

test("expanded EonWild suite is part of the default feature command", () => {
  const command = packageJson.scripts["test:eonwild"];
  for (const file of [
    "hh-eonwild-input-system.test.js", "hh-eonwild-desktop-controller.test.js", "hh-eonwild-ui-accessibility.test.js",
    "hh-eonwild-species-registry.test.js", "hh-eonwild-world-atlas.test.js",
    "hh-eonwild-expansion-integration.test.js"
  ]) assert.match(command, new RegExp(file.replaceAll(".", "\\.")));
});
