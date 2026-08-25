const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "hh-eonwild-vegetation-system.js");
const vegetation = require(modulePath);
const source = fs.readFileSync(modulePath, "utf8");

function viableTerrain(x, z, out) {
  out.height = Math.sin(x * 0.01) * 2 + Math.cos(z * 0.01);
  out.slopeDegrees = 7;
  out.waterDepth = 0;
  out.distanceToWater = 7;
  out.rockDistance = 12;
  out.rockMask = 0;
  out.moisture = 0.76;
  return out;
}

test("UMD and CommonJS surfaces expose a renderer-independent production contract", () => {
  assert.equal(vegetation.VERSION, "1.0.0");
  assert.equal(typeof vegetation.create, "function");
  assert.equal(typeof vegetation.createVegetationPlanner, "function");
  assert.equal(typeof vegetation.createWindField, "function");
  assert.equal(typeof vegetation.createVegetationStateSystem, "function");
  assert.equal(typeof vegetation.createLodController, "function");
  assert.doesNotMatch(source, /\bBABYLON\b/);

  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "hh-eonwild-vegetation-system.js" });
  assert.equal(context.globalThis.HHEonWildVegetation.VERSION, vegetation.VERSION);
  assert.equal(typeof context.globalThis.HHEonWildVegetation.create, "function");

  const runtime = vegetation.create({ seed: "contract", qualityPreset: "high", bindVisibility: false });
  for (const method of ["update", "animate", "disturb", "configure", "getStatus", "pause", "resume", "dispose"]) assert.equal(typeof runtime[method], "function", `${method} must be available`);
  assert.equal(runtime.getStatus().quality, "high");
  runtime.dispose();
});

test("the catalog covers every requested ecological vegetation role", () => {
  const categories = new Set(vegetation.VEGETATION_TYPES.map((type) => type.category));
  for (const category of ["grass", "reed", "fern", "shrub", "sapling", "mature-tree", "dead-tree", "root", "log", "fungi", "moss"]) assert.ok(categories.has(category), `missing ${category}`);
  assert.ok(vegetation.VEGETATION_TYPES.filter((type) => type.category === "grass").length >= 3);
  assert.ok(Object.isFrozen(vegetation.VEGETATION_TYPES));
  assert.ok(vegetation.VEGETATION_TYPES.every(Object.isFrozen));
});

test("chunk placement is deterministic by seed, biome and chunk", () => {
  const options = { seed: "deterministic-forest", chunkSize: 256, quality: "high" };
  const first = vegetation.createVegetationPlanner(options).planChunk({ cx: 4, cz: -3, biome: "forest", terrainSampler: viableTerrain });
  const second = vegetation.createVegetationPlanner(options).planChunk({ cx: 4, cz: -3, biome: "forest", terrainSampler: viableTerrain });
  assert.deepEqual(first, second);
  assert.ok(first.placements.length > 100);
  assert.ok(first.placements.length <= vegetation.QUALITY_BUDGETS.high.maxInstancesPerChunk);
  assert.equal(new Set(first.placements.map((placement) => placement.id)).size, first.placements.length);

  const changed = vegetation.createVegetationPlanner({ ...options, seed: "different-forest" }).planChunk({ cx: 4, cz: -3, biome: "forest", terrainSampler: viableTerrain });
  assert.notDeepEqual(first.placements.slice(0, 12), changed.placements.slice(0, 12));
});

test("placement rejects water, steep terrain, rocks and invalid samplers without throwing", () => {
  const planner = vegetation.createVegetationPlanner({ seed: "constraints", quality: "balanced" });
  const water = planner.planChunk({ biome: "wetland", terrainSampler(x, z, out) { viableTerrain(x, z, out); out.waterDepth = 0.01; return out; } });
  const steep = planner.planChunk({ biome: "forest", terrainSampler(x, z, out) { viableTerrain(x, z, out); out.slopeDegrees = 70; return out; } });
  const rock = planner.planChunk({ biome: "grassland", terrainSampler(x, z, out) { viableTerrain(x, z, out); out.rockMask = 1; out.rockDistance = 0; return out; } });
  const invalid = planner.planChunk({ biome: "forest", terrainSampler() { throw new Error("synthetic terrain failure"); } });
  assert.equal(water.placements.length, 0);
  assert.equal(water.stats.waterRejected, water.stats.attempts);
  assert.equal(steep.placements.length, 0);
  assert.equal(steep.stats.slopeRejected, steep.stats.attempts);
  assert.equal(rock.placements.length, 0);
  assert.equal(rock.stats.rockRejected, rock.stats.attempts);
  assert.equal(invalid.placements.length, 0);
  assert.equal(invalid.stats.invalidTerrain, invalid.stats.attempts);
});

test("biome and clearing constraints distinguish shoreline and canopy species", () => {
  const wetGround = { valid: true, waterDepth: 0, slopeDegrees: 4, rockMask: 0, rockDistance: 8, moisture: 0.9, distanceToWater: 3 };
  const ecology = { cluster: 0.8, clearing: 0.1, canopyOpportunity: 0.8 };
  assert.equal(vegetation.isPlacementAllowed("reed", wetGround, ecology, "wetland"), true);
  assert.equal(vegetation.isPlacementAllowed("reed", { ...wetGround, waterDepth: 0.02 }, ecology, "wetland"), false);
  assert.equal(vegetation.isPlacementAllowed("reed", { ...wetGround, distanceToWater: 20 }, ecology, "wetland"), false);
  assert.equal(vegetation.isPlacementAllowed("tree-mature-deciduous", wetGround, { ...ecology, clearing: 0.9 }, "forest"), false);
  assert.equal(vegetation.isPlacementAllowed("tree-mature-deciduous", wetGround, ecology, "grassland"), false);
  assert.equal(vegetation.isPlacementAllowed("moss-patch", { ...wetGround, slopeDegrees: 43, rockDistance: 0 }, ecology, "forest"), true);
});

test("ecological cluster and clearing fields are seeded, continuous and bounded", () => {
  const a = vegetation.sampleEcologyFields("eco", 1200, -760, "rainforest");
  const b = vegetation.sampleEcologyFields("eco", 1200, -760, "rainforest");
  const nearby = vegetation.sampleEcologyFields("eco", 1200.02, -759.98, "rainforest");
  assert.deepEqual(a, b);
  for (const value of [a.cluster, a.clearing, a.canopyOpportunity]) assert.ok(value >= 0 && value <= 1);
  assert.ok(Math.abs(a.cluster - nearby.cluster) < 0.01);
  assert.ok(Math.abs(a.clearing - nearby.clearing) < 0.01);
  assert.notDeepEqual(a, vegetation.sampleEcologyFields("other-eco", 1200, -760, "rainforest"));
});

test("quality budgets scale monotonically and contain bounded LOD/dither plans", () => {
  const order = ["static", "light", "balanced", "high", "ultra", "cinematic", "personal"];
  for (let index = 0; index < order.length; index += 1) {
    const budget = vegetation.QUALITY_BUDGETS[order[index]];
    assert.ok(Object.isFrozen(budget));
    assert.ok(Object.isFrozen(budget.lodDistances));
    assert.equal(budget.lodDistances.length, 4);
    for (let distance = 1; distance < budget.lodDistances.length; distance += 1) assert.ok(budget.lodDistances[distance] > budget.lodDistances[distance - 1]);
    assert.ok(budget.ditherMeters > 0);
    assert.ok(budget.hysteresisMeters > 0);
    assert.ok(budget.maxInstancesPerChunk <= vegetation.LIMITS.maximumInstancesPerChunk);
    assert.ok(budget.maxInfluences <= vegetation.LIMITS.maximumInfluences);
    if (index) {
      const previous = vegetation.QUALITY_BUDGETS[order[index - 1]];
      assert.ok(budget.densityScale >= previous.densityScale);
      assert.ok(budget.maxInstancesPerChunk >= previous.maxInstancesPerChunk);
      assert.ok(budget.maxActiveInstances >= previous.maxActiveInstances);
    }
  }
});

test("wind is four-layered, seeded, world-continuous and allocation-safe with caller output", () => {
  assert.deepEqual(vegetation.WIND_LAYERS.map((layer) => layer.order), [0, 1, 2, 3]);
  for (let index = 1; index < vegetation.WIND_LAYERS.length; index += 1) {
    assert.ok(vegetation.WIND_LAYERS[index].spatialFrequency > vegetation.WIND_LAYERS[index - 1].spatialFrequency);
    assert.ok(vegetation.WIND_LAYERS[index].temporalFrequency > vegetation.WIND_LAYERS[index - 1].temporalFrequency);
  }
  const field = vegetation.createWindField({ seed: "wind-seed", baseSpeed: 8 });
  const out = vegetation.createWindSample();
  const layersReference = out.layers;
  const layerObjects = out.layers.slice();
  const returned = field.sampleInto(470.25, -811.5, 12.75, out);
  const snapshot = JSON.parse(JSON.stringify(returned));
  assert.equal(returned, out);
  assert.equal(returned.layers, layersReference);
  field.sampleInto(470.25, -811.5, 12.75, out);
  assert.deepEqual(out, snapshot);
  assert.ok(out.layers.every((layer, index) => layer === layerObjects[index]));
  assert.deepEqual(out.layers.map((layer) => layer.id), vegetation.WIND_LAYERS.map((layer) => layer.id));

  const nearby = field.sampleInto(470.26, -811.49, 12.751, vegetation.createWindSample());
  assert.ok(Math.hypot(snapshot.x - nearby.x, snapshot.z - nearby.z) < 0.1);
  const different = vegetation.createWindField({ seed: "other-wind", baseSpeed: 8 }).sampleInto(470.25, -811.5, 12.75, vegetation.createWindSample());
  assert.notEqual(snapshot.x, different.x);
  assert.equal(field.sample(0, 0, 0), field.sample(0, 0, 1), "default wind sampling should reuse its bounded frame buffer");
});

test("gust fronts arrive in deterministic chronological order and peak at the front", () => {
  const field = vegetation.createWindField({ seed: "gust", baseSpeed: 7, gustStrength: 1 });
  const schedule = field.getGustFrontSchedule(32, -90, 5, 6);
  assert.equal(schedule.length, 6);
  assert.ok(schedule.every((event) => event.etaSeconds >= 0 && event.strength > 0 && event.strength <= 1));
  for (let index = 1; index < schedule.length; index += 1) {
    assert.ok(schedule[index].arrivalSeconds > schedule[index - 1].arrivalSeconds);
    assert.equal(schedule[index].index, schedule[index - 1].index + 1);
  }
  assert.deepEqual(schedule, field.getGustFrontSchedule(32, -90, 5, 6));
  const peak = field.sampleInto(32, -90, schedule[0].arrivalSeconds, vegetation.createWindSample()).gust;
  const halfway = field.sampleInto(32, -90, schedule[0].arrivalSeconds + field.gustSpacing / field.gustSpeed / 2, vegetation.createWindSample()).gust;
  assert.ok(peak > 0.5);
  assert.ok(halfway < 0.001);
});

test("bounded object pools refuse overflow, reuse objects and dispose idempotently", () => {
  let resets = 0;
  const pool = new vegetation.BoundedObjectPool({ capacity: 3, create: (index) => ({ index, value: 0 }), reset: (item) => { item.value = 0; resets += 1; } });
  const first = pool.acquire();
  const second = pool.acquire();
  const third = pool.acquire();
  assert.equal(pool.acquire(), null);
  assert.equal(pool.activeCount, 3);
  second.value = 9;
  assert.equal(pool.release(second), true);
  assert.equal(pool.release(second), false);
  assert.equal(pool.acquire(), second);
  assert.equal(second.value, 0);
  assert.equal(pool.activeCount, 3);
  assert.equal(pool.clear(), true);
  assert.equal(pool.activeCount, 0);
  assert.ok(resets >= 4);
  assert.equal(pool.dispose(), true);
  assert.equal(pool.dispose(), false);
  assert.equal(pool.acquire(), null);
  assert.ok(first && third);
});

test("influence storage evicts oldest entries, remains bounded and decays in place", () => {
  const pool = new vegetation.InfluencePool(2);
  const oldest = pool.add({ x: 0, z: 0, radius: 2, startMs: 0, durationMs: 100, compression: 1 });
  pool.add({ x: 40, z: 0, radius: 2, startMs: 0, durationMs: 100, wetness: 1 });
  const newest = pool.add({ x: 80, z: 0, radius: 2, startMs: 0, durationMs: 100, burn: 1 });
  assert.ok(newest > oldest);
  assert.equal(pool.activeCount, 2);
  const out = vegetation.createVegetationStateSample();
  const ref = pool.sampleInto(0, 0, 0, out);
  assert.equal(ref, out);
  assert.equal(out.activeInfluences, 0, "oldest influence should have been evicted");
  pool.sampleInto(80, 0, 0, out);
  assert.equal(out.burn, 1);
  assert.equal(pool.decay(101), 2);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.dispose(), true);
  assert.equal(pool.add({}), null);
});

test("vegetation states model compression, wet, burn, snow and mud without growing storage", () => {
  const states = vegetation.createVegetationStateSystem({ quality: "balanced", capacity: 4 });
  states.snapEnvironment({ wetness: 0.45, snow: 0.3, mud: 0.2 });
  states.disturb({ type: "footstep", x: 2, z: 3, radius: 2, strength: 0.9, mud: 0.5, startMs: 1000, durationMs: 2000 });
  states.disturb({ type: "fire", x: 2, z: 3, radius: 1, strength: 0.8, startMs: 1000, durationMs: 2000 });
  const out = vegetation.createVegetationStateSample();
  const ref = states.sampleInto(2, 3, 1000, out);
  assert.equal(ref, out);
  assert.equal(out.compression, 0.9);
  assert.equal(out.wetness, 0.45);
  assert.equal(out.burn, 0.8);
  assert.equal(out.snow, 0.3);
  assert.equal(out.mud, 0.5);
  assert.ok(out.health < 0.3);
  states.sampleInto(2, 3, 2000, out);
  assert.ok(out.compression > 0 && out.compression < 0.9);
  states.decay(3001);
  assert.equal(states.influences.activeCount, 0);
  assert.equal(states.dispose(), true);
});

test("LOD hysteresis prevents boundary flicker and dither is centered on transitions", () => {
  const controller = vegetation.createLodController({ quality: "balanced" });
  const [first, , , cull] = vegetation.QUALITY_BUDGETS.balanced.lodDistances;
  const h = vegetation.QUALITY_BUDGETS.balanced.hysteresisMeters;
  assert.equal(controller.evaluate(first + 1, 0).lod, 0, "small outward motion should retain LOD0");
  assert.equal(controller.evaluate(first + h + 1, 0).lod, 1);
  assert.equal(controller.evaluate(first - 1, 1).lod, 1, "small inward motion should retain LOD1");
  assert.equal(controller.evaluate(first - h - 1, 1).lod, 0);
  const transition = controller.evaluate(first, 0);
  assert.equal(transition.transitionIndex, 0);
  assert.ok(Math.abs(transition.dither - 0.5) < 1e-9);
  assert.equal(controller.evaluate(cull + h - 1, 3).lod, 3);
  assert.equal(controller.evaluate(cull + h + 1, 3).lod, 4);
  assert.equal(controller.evaluate(10, 0), controller.evaluate(12, 0), "default LOD evaluation should reuse its bounded sample");
  controller.dispose();
  assert.equal(controller.evaluate(0, 0).visible, false);
});

test("runtime pauses on hidden tabs, preserves manual pause and removes visibility listeners", () => {
  const listeners = new Set();
  const documentLike = {
    hidden: false,
    addEventListener(type, listener) { if (type === "visibilitychange") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "visibilitychange") listeners.delete(listener); }
  };
  const emit = () => { for (const listener of listeners) listener(); };
  const runtime = vegetation.create({ seed: "lifecycle", bindVisibility: false });
  const frame = vegetation.createRuntimeFrame();
  const windLayers = frame.wind.layers;
  assert.equal(runtime.bindVisibility(documentLike), true);
  assert.equal(listeners.size, 1);
  assert.equal(runtime.update({ timeSeconds: 1, deltaSeconds: 0.016 }, frame), frame);
  assert.equal(frame.status, "running");
  assert.equal(frame.wind.layers, windLayers);

  documentLike.hidden = true;
  emit();
  assert.equal(runtime.getStatus().pauseReason, "visibility");
  assert.equal(runtime.animate({ timeSeconds: 2 }, frame).status, "paused");
  documentLike.hidden = false;
  emit();
  assert.equal(runtime.getStatus().status, "ready");

  runtime.pause("manual");
  documentLike.hidden = true;
  emit();
  documentLike.hidden = false;
  emit();
  assert.equal(runtime.getStatus().pauseReason, "manual");
  assert.equal(runtime.resume(), true);
  assert.equal(runtime.dispose(), true);
  assert.equal(listeners.size, 0);
  assert.equal(runtime.dispose(), false);
  assert.equal(runtime.update({}, frame).status, "disposed");
  assert.equal(runtime.resume(), false);
});

test("runtime configure and disturbance APIs change real bounded state", () => {
  const runtime = vegetation.create({ seed: "runtime", quality: "light", influenceCapacity: 3, bindVisibility: false });
  assert.equal(runtime.configure({ quality: "ultra", baseWindSpeed: 12, windDirectionRadians: Math.PI / 2, wetness: 0.7 }), true);
  assert.equal(runtime.getStatus().quality, "ultra");
  assert.equal(runtime.disturb({ type: "snow", x: 0, z: 0, startMs: 0, durationMs: 1000, strength: 0.8 }), 1);
  assert.equal(runtime.disturb({ type: "mud", x: 2, z: 0, startMs: 0, durationMs: 1000, strength: 0.7 }), 2);
  assert.equal(runtime.disturb({ type: "fire", x: 4, z: 0, startMs: 0, durationMs: 1000, strength: 0.9 }), 3);
  assert.equal(runtime.disturb({ type: "footstep", x: 6, z: 0, startMs: 0, durationMs: 1000 }), 4);
  assert.equal(runtime.states.influences.activeCount, 3);
  const stateOut = vegetation.createVegetationStateSample();
  assert.equal(runtime.sampleStateInto(6, 0, 0, stateOut), stateOut);
  assert.ok(stateOut.compression > 0);
  const frame = runtime.update({ timeSeconds: 0, deltaSeconds: 0.25, cameraX: 0, cameraZ: 0 });
  assert.equal(frame.status, "running");
  assert.ok(frame.wind.speed > 0);
  assert.equal(frame, runtime.update({ timeSeconds: 0.1, deltaSeconds: 0.1 }), "default runtime updates should reuse a bounded frame buffer");
  runtime.dispose();
});
