"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const landscape = require(path.join(root, "hh-eonwild-landscape-core.js"));
const vegetation = require(path.join(root, "hh-eonwild-vegetation-system.js"));
const environmentRenderer = require(path.join(root, "hh-eonwild-environment-renderer.js"));
const waterWeather = require(path.join(root, "hh-eonwild-water-weather-system.js"));
const renderer = require(path.join(root, "hh-eonwild-renderer-3d.js"));

test("route bundle loads every procedural dependency before the guarded renderer and game", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const order = [
    "hh-eonwild-landscape-core.js?v=1",
    "hh-eonwild-vegetation-system.js?v=1",
    "hh-eonwild-environment-renderer.js?v=1",
    "hh-eonwild-water-weather-system.js?v=1",
    "hh-eonwild-renderer-3d.js?v=13",
    "hh-eonwild-game.js?v=16"
  ];
  let previous = -1;
  for (const asset of order) {
    const position = loader.indexOf(`"${asset}"`);
    assert.ok(position > previous, `${asset} must load in dependency order`);
    previous = position;
    assert.ok(worker.includes(`"./${asset}"`), `${asset} must be available offline`);
  }
  assert.ok(worker.includes('"./hh-eonwild-landscape-worker.js?v=1"'));
  assert.match(require(path.join(root, "package.json")).scripts["test:eonwild"], /hh-eonwild-procedural-integration\.test\.js/);
});

test("same-origin landscape Worker validates jobs and returns renderer-neutral geometry", () => {
  const workerSource = read("hh-eonwild-landscape-worker.js");
  const listeners = {};
  const messages = [];
  const scope = {
    HHEonWildLandscapeCore: landscape,
    addEventListener(type, callback) { listeners[type] = callback; },
    postMessage(message, transfers) { messages.push({ message, transfers }); },
    importScripts() { throw new Error("the preloaded core should be reused"); }
  };
  vm.runInNewContext(workerSource, { self: scope, globalThis: scope, URL, ArrayBuffer, Uint8Array, Float32Array, Uint16Array, Uint32Array }, { filename: "hh-eonwild-landscape-worker.js" });
  const core = landscape.createLandscapeCore({ seed: "WORKER-INTEGRATION", realmId: "mesozoic", timeSliceId: "cretaceous", worldSize: 16384, chunkSize: 256, seaLevel: 3.5 });
  const job = core.createWorkerJob({ chunkX: 31, chunkZ: 31, lod: 1, resolution: 17, includeNormals: true, includeBiomeWeights: true });
  listeners.message({ data: { id: "valid-job", job } });
  assert.equal(messages[0].message.ok, true);
  assert.equal(messages[0].message.result.positions instanceof Float32Array, true);
  assert.equal(messages[0].message.result.indices.length, 16 * 16 * 6);
  listeners.message({ data: { id: "invalid-job", job: { type: "unknown" } } });
  assert.equal(messages[1].message.ok, false);
  assert.match(messages[1].message.error.message, /Unsupported|Invalid/);
  core.dispose();
  assert.match(workerSource, /MAX_TRANSFER_BYTES\s*=\s*32\s*\*\s*1024\s*\*\s*1024/);
  assert.doesNotMatch(workerSource, /\bfetch\s*\(|eval\s*\(|new\s+Function/);
});

test("procedural landscape, vegetation, water and weather share deterministic bounded lifecycle", () => {
  const core = landscape.createLandscapeCore({ seed: "FULL-ENVIRONMENT-541", realmId: "mesozoic", timeSliceId: "cretaceous", worldSize: 16384, chunkSize: 256, seaLevel: 3.5 });
  const plants = vegetation.create({ seed: "FULL-ENVIRONMENT-541", chunkSize: 256, quality: "balanced", bindVisibility: false });
  const plantsRenderer = environmentRenderer.create({
    landscape: core,
    vegetationSystem: plants,
    seed: "FULL-ENVIRONMENT-541",
    quality: "balanced",
    maxActiveChunks: 4,
    maxQueuedChunks: 6,
    maxActiveInstances: 170,
    maxInstancesPerChunk: 64,
    renderOffsetX: -8192,
    renderOffsetZ: -8192,
    frustumCulling: false
  });
  const environment = waterWeather.create({ seed: "FULL-ENVIRONMENT-541", quality: "balanced", autoVisibility: false });
  const riverBodies = environment.water.syncRiverNetwork(core.getRiverNetwork().slice(0, 2).map((river) => ({
    ...river,
    points: river.points.map((point) => ({ x: point.x - 8192, y: point.bedHeight, z: point.z - 8192, width: point.width, flow: point.discharge }))
  })));
  assert.ok(riverBodies.length >= 1);

  for (let frame = 0; frame < 8; frame += 1) {
    const time = frame / 30;
    environment.update(1 / 30, { hour: 16, weather: "rain", player: { x: 8192, y: 12, z: 8192 }, collectState: false });
    plantsRenderer.update({ playerX: 8192, playerZ: 8192, timeSeconds: time, deltaSeconds: 1 / 30, weather: { type: "rain", wetness: 0.8 }, wetness: 0.8 });
  }
  environment.interactions.addFootprint({ x: 8192, y: 4, z: 8192, speciesId: "tyrannosaurus", surface: "mud" });
  environment.interactions.addSplash({ x: 8192, y: 3.5, z: 8192, speciesId: "tyrannosaurus" });
  plantsRenderer.disturb({ type: "footprint", x: 8192, z: 8192, radius: 2, strength: 0.8 });

  const plantTelemetry = plantsRenderer.getTelemetry();
  const environmentTelemetry = environment.getTelemetry();
  assert.ok(plantTelemetry.activeChunks <= 4);
  assert.ok(plantTelemetry.activeInstances <= 170);
  assert.ok(plantTelemetry.queuedChunks <= 6);
  assert.ok(environmentTelemetry.water.waterBodies <= waterWeather.HARD_LIMITS.waterBodies);
  assert.ok(environmentTelemetry.interactions.footprints.active >= 1);
  assert.equal(environmentTelemetry.fps, null, "subsystem must not invent renderer FPS");

  assert.equal(plantsRenderer.dispose(), true);
  assert.equal(environment.dispose(), true);
  assert.equal(plants.dispose(), true);
  assert.equal(core.dispose(), true);
  assert.equal(plantsRenderer.getTelemetry().activeChunks, 0);
});

test("guarded Babylon adapter owns and disposes all new environment subsystems", () => {
  const source = read("hh-eonwild-renderer-3d.js");
  for (const token of [
    "HHEonWildLandscapeCore",
    "HHEonWildVegetation",
    "HHEonWildEnvironmentRenderer",
    "HHEonWildWaterWeather",
    "LandscapeWorkerBridge",
    "createWorkerJob",
    "[\"chunk-centered\", \"centered-chunk\"].includes(geometry.coordinateSpace)",
    "renderOffsetX: -WORLD_HALF",
    "recordEnvironmentalInteraction",
    "this._environmentRenderer?.dispose?.()",
    "this._waterWeather?.dispose?.()",
    "this._landscape?.dispose?.()"
  ]) assert.ok(source.includes(token), `missing integration token ${token}`);
  assert.equal(renderer.DEFAULT_LANDSCAPE_WORKER_URL, "./hh-eonwild-landscape-worker.js?v=1");
  assert.equal(renderer.createProceduralLandscape({ seed: "TEST" }).getStatus().config.worldSize, 16384);
  assert.match(source, /if\s*\(this\.inFlight\.size\s*>=\s*2\)/);
  assert.match(source, /initialSegments\s*=\s*this\.active\.size\s*===\s*0\s*\?\s*Math\.min\(item\.segments,\s*24\)/);
  assert.doesNotMatch(source, /new\s+(?:BABYLON\.)?Mesh\([^\n]*placement/i, "vegetation must stay thin-instanced");
});
