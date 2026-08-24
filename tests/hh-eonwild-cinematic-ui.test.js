"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const gamePath = path.join(root, "hh-eonwild-game.js");
const cssPath = path.join(root, "hh-eonwild-game.css");
const game = require(gamePath);
const source = fs.readFileSync(gamePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("v4 expands the legacy world exactly once", () => {
  const legacy = game.normalizeState({
    schemaVersion: 3,
    player: { x: 100, y: 200 },
    speciesId: "triceratops",
    realmId: "mesozoic",
    worldAddress: { realmId: "mesozoic", timeSliceId: "cretaceous-laramidia", regionId: "late-cretaceous-floodplain", biomeId: "forest", chunkX: 8, chunkZ: 12, seed: "legacy" },
    replay: [{ x: 25, y: 75, t: 1 }],
    heatmap: [{ x: 40, y: 80, value: 2 }],
    heatmapCellSize: 64
  });
  assert.equal(game.WORLD_SIZE, 16384);
  assert.equal(legacy.schemaVersion, 4);
  assert.equal(legacy.player.x, 400);
  assert.equal(legacy.player.y, 800);
  assert.equal(legacy.replay[0].x, 100);
  assert.equal(legacy.replay[0].y, 300);
  assert.equal(legacy.heatmap[0].x, 160);
  assert.equal(legacy.heatmap[0].y, 320);
  assert.equal(legacy.heatmapCellSize, 64);
  assert.equal(legacy.worldAddress.chunkX, 32);
  assert.equal(legacy.worldAddress.chunkZ, 48);

  const normalizedAgain = game.normalizeState(legacy);
  assert.equal(normalizedAgain.player.x, 400);
  assert.equal(normalizedAgain.player.y, 800);
  assert.equal(normalizedAgain.replay[0].x, 100);
  assert.equal(normalizedAgain.heatmapCellSize, 64);
  assert.equal(normalizedAgain.worldAddress.chunkX, 32);
});

test("Cinematic Personal and physical camera inputs are bounded truthfully", () => {
  const state = game.normalizeState({
    settings: {
      quality: "personal",
      photoFocalLength: 999,
      photoAperture: 0,
      photoShutter: 99999,
      photoIso: 99999,
      photoExposureComp: -99,
      photoFocusDistance: 9999,
      photoAutofocus: false,
      photoComposition: "invalid",
      photoCrop: "2.39",
      photoShake: 999
    }
  });
  assert.equal(state.settings.quality, "personal");
  assert.equal(state.settings.photoFocalLength, 200);
  assert.equal(state.settings.photoAperture, 1.4);
  assert.equal(state.settings.photoShutter, 8000);
  assert.equal(state.settings.photoIso, 6400);
  assert.equal(state.settings.photoExposureComp, -5);
  assert.equal(state.settings.photoFocusDistance, 500);
  assert.equal(state.settings.photoAutofocus, false);
  assert.equal(state.settings.photoComposition, "thirds");
  assert.equal(state.settings.photoCrop, "2.39");
  assert.equal(state.settings.photoShake, 100);
  assert.match(source, /quality !== "personal" && instance\.state\.settings\.adaptiveQuality/);
  assert.match(source, /sample\.quality === "personal" && instance\.state\.settings\.quality !== "personal"/);
});

test("Photo Mode and Personal Cinematic Pack expose real accessible controls", () => {
  for (const control of ["photoFocalLength", "photoAperture", "photoShutter", "photoIso", "photoExposureComp", "photoFocusDistance", "photoAutofocus", "photoComposition", "photoCrop", "photoShake"]) {
    assert.match(source, new RegExp(`data-hwe-photo-setting=\\"${control}\\"`));
  }
  for (const action of ["manifest", "local", "install", "pause", "verify", "remove"]) {
    assert.match(source, new RegExp(`data-hwe-pack-${action}`));
  }
  assert.match(source, /installFromFiles/);
  assert.match(source, /prepareCinematicRuntimeAssets/);
  for (const packId of ["creature-ultra", "forest-vegetation", "terrain-rock", "ocean", "weather-atmosphere", "cinematic-audio"]) {
    assert.ok(source.includes(packId), "missing runtime pack " + packId);
  }
  assert.match(source, /manager\.assetUrl\(packId, asset\.path\)/);
  assert.match(source, /releaseCinematicUrls/);
  assert.match(source, /cinematicEnvironmentAssets/);
  assert.match(source, /cinematicTerrainAssets/);
  assert.match(source, /cinematicOceanAssets/);
  assert.match(source, /cinematicWeatherAssets/);
  assert.match(source, /cinematicAudioAssets/);
  assert.match(source, /licenseReportFile/);
  assert.match(source, /multiple webkitdirectory directory data-hwe-pack-local-files/);
  assert.match(source, /MAX_ASSETS \|\| 256/);
  assert.match(source, /requestPersistence\(\)/);
  assert.match(source, /verifyAll\(/);
  assert.match(source, /removeAll\(\)/);
  assert.match(source, /onProgress:\s*\(progress\)/);
  assert.match(source, /backend:\s*"auto"/);
  assert.match(source, /paused:\s*instance\.paused && !instance\.photoMode/);
  assert.match(source, /setPaused\?\.\(false\)/);
  assert.match(source, /capture\(\{ width: 3840, height: 2160 \}\)/);
  assert.match(source, /draw · \$\{Math\.round\(\(rendererStatus\.triangles/);
  assert.match(source, /SHA-256/);
  assert.match(source, /Không có phần trăm giả/);
  assert.match(css, /\.hwe-photo-composition/);
  assert.match(css, /\.hwe-render-fallback/);
  assert.match(css, /\.hwe-cinematic-packs/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});

test("App Shell service worker never duplicates resumable Cinematic Pack bytes", () => {
  assert.match(serviceWorkerSource, /request\.cache === "no-store"/);
  assert.match(serviceWorkerSource, /request\.headers\.has\("range"\)/);
  const bypass = serviceWorkerSource.indexOf("const bypassShellCache");
  const shellLookup = serviceWorkerSource.indexOf("caches.match(request)", bypass);
  assert.ok(bypass >= 0 && shellLookup > bypass);
  assert.match(serviceWorkerSource.slice(bypass, shellLookup), /isPrivateRequest \|\| bypassShellCache/);
});
