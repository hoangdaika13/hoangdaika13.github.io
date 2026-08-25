const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-water-weather-system.js");
const source = fs.readFileSync(sourcePath, "utf8");
const api = require(sourcePath);

function rounded(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "number" ? Math.round(item * 1e8) / 1e8 : item));
}

test("publishes the same browser UMD and CommonJS surface", () => {
  assert.equal(api.VERSION, "1.0.0");
  for (const name of [
    "RiverNetworkSystem", "WaterRenderingSystem", "WeatherSimulationSystem",
    "AtmosphereSystem", "EnvironmentalInteractionSystem", "WaterWeatherEnvironment"
  ]) assert.equal(typeof api[name], "function", name);
  for (const name of [
    "create", "createRiverNetworkSystem", "createWaterRenderingSystem",
    "createWeatherSimulationSystem", "createAtmosphereSystem", "createEnvironmentalInteractionSystem"
  ]) assert.equal(typeof api[name], "function", name);

  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "hh-eonwild-water-weather-system.js" });
  assert.equal(context.globalThis.HHEonWildWaterWeather.VERSION, api.VERSION);
  assert.equal(typeof context.globalThis.HHEonWildWaterWeather.create, "function");
});

test("river tracing is deterministic, downhill and crosses chunk boundaries", () => {
  const terrain = (x, z) => 180 - x * 0.45 - z * 0.22;
  const make = () => new api.RiverNetworkSystem({
    seed: "river-contract", terrainSampler: terrain, chunkSize: 32, step: 8,
    seaLevel: -500, maxPointsPerRiver: 32, maxRivers: 8, autoVisibility: false
  });
  const firstSystem = make();
  const secondSystem = make();
  const first = firstSystem.traceDownhill({ x: 2, z: 2 }, { maxPoints: 24 });
  const second = secondSystem.traceDownhill({ x: 2, z: 2 }, { maxPoints: 24 });
  assert.deepEqual(rounded(first), rounded(second));
  assert.equal(first.points.length, 24);
  for (let index = 1; index < first.points.length; index += 1) {
    assert.ok(first.points[index].y <= first.points[index - 1].y, `point ${index} went uphill`);
    assert.ok(first.points[index - 1].y - first.points[index].y >= firstSystem.minimumDrop);
  }
  assert.ok(first.crossedChunks.length > 1, "world-space path should continue into adjacent chunks");
  assert.equal(first.endReason, "point-budget");
  assert.ok(first.totalDrop > 0);
  assert.ok(first.length > 32);
  assert.ok(firstSystem.getChunkSegments(first.crossedChunks[0].x, first.crossedChunks[0].z).length > 0);
  firstSystem.dispose();
  secondSystem.dispose();
});

test("river chunk generation is order-stable and local minima form real basins", () => {
  const slope = (x, z) => 300 - x * 0.3 - z * 0.12;
  const chunksA = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 0 }];
  const chunksB = chunksA.slice().reverse();
  const a = new api.RiverNetworkSystem({ seed: 901, terrainSampler: slope, chunkSize: 64, step: 12, mergeDistance: 18, maxPointsPerRiver: 20, autoVisibility: false });
  const b = new api.RiverNetworkSystem({ seed: 901, terrainSampler: slope, chunkSize: 64, step: 12, mergeDistance: 18, maxPointsPerRiver: 20, autoVisibility: false });
  a.generateForChunks(chunksA, { sourcesPerChunk: 1 });
  b.generateForChunks(chunksB, { sourcesPerChunk: 1 });
  assert.deepEqual(rounded(a.getNetwork()), rounded(b.getNetwork()));
  assert.ok(a.getRivers().some((river) => river.connectedTo), "nearby downhill paths should be able to merge into a network");

  const bowl = new api.RiverNetworkSystem({ seed: "bowl", terrainSampler: (x, z) => x * x + z * z, step: 4, seaLevel: -10, autoVisibility: false });
  const trapped = bowl.traceDownhill({ x: 0, z: 0 });
  assert.equal(trapped.points.length, 1);
  assert.equal(trapped.endReason, "local-minimum");
  assert.equal(bowl.getBasins()[0].type, "lake");
  a.dispose(); b.dispose(); bowl.dispose();
});

test("water rendering has bounded bodies, shared materials and pooled transient effects", () => {
  const water = new api.WaterRenderingSystem({
    quality: "lite", budgets: { waterBodies: 2, foam: 2, ripples: 3, wakes: 1 }, autoVisibility: false
  });
  assert.ok(water.addOcean({ id: "ocean", width: 1000, length: 1000 }));
  assert.ok(water.addLake({ id: "lake", width: 50, length: 80 }));
  assert.equal(water.addRiver({ id: "over-budget", points: [{ x: 0, y: 1, z: 0 }, { x: 3, y: 0, z: 2 }] }), null);
  for (let index = 0; index < 9; index += 1) water.emitRipple({ x: index, y: 0, z: 0 });
  for (let index = 0; index < 5; index += 1) water.emitFoam({ x: index, y: 0, z: 0 });
  for (let index = 0; index < 4; index += 1) water.emitWake({ x: index, y: 0, z: 0 });
  const descriptors = water.getRenderDescriptors();
  assert.equal(descriptors.backend, "procedural-descriptor");
  assert.equal(descriptors.bodies.length, 2);
  assert.equal(descriptors.effects.ripples.length, 3);
  assert.equal(descriptors.effects.foam.length, 2);
  assert.equal(descriptors.effects.wakes.length, 1);
  assert.equal(water.getTelemetry().meshCount, 0);
  assert.equal(water.getTelemetry().ripples.evicted, 6);
  assert.equal(water.getTelemetry().drawCalls, null, "must not invent renderer counters");
  water.update(0.25);
  water.dispose();
  assert.equal(water.state, "disposed");
  assert.equal(water.getTelemetry().waterBodies, 0);
});

test("optional Babylon adapter creates bounded body meshes, never per-particle meshes", () => {
  const calls = [];
  const disposed = [];
  const mesh = (name) => ({ name, position: {}, dispose() { disposed.push(name); } });
  class PBRMaterial {
    constructor(name) { this.name = name; this.subSurface = {}; calls.push(["material", name]); }
    dispose() { disposed.push(this.name); }
  }
  class Vector3 { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } }
  const Babylon = {
    PBRMaterial, Vector3,
    MeshBuilder: {
      CreateGround(name) { calls.push(["ground", name]); return mesh(name); },
      CreateRibbon(name) { calls.push(["ribbon", name]); return mesh(name); }
    }
  };
  const water = new api.WaterRenderingSystem({
    Babylon, scene: {}, quality: "high",
    budgets: { waterBodies: 3, foam: 4, ripples: 4, wakes: 4 }, autoVisibility: false
  });
  water.addOcean({ id: "ocean" });
  water.addRiver({ id: "river", points: [{ x: 0, y: 2, z: 0 }, { x: 8, y: 1, z: 4 }] });
  water.addWaterfall({ id: "fall", points: [{ x: 0, y: 8, z: 0 }, { x: 0, y: 0, z: 1 }] });
  for (let index = 0; index < 20; index += 1) {
    water.emitFoam({ x: index, z: 0 });
    water.emitRipple({ x: index, z: 0 });
    water.emitWake({ x: index, z: 0 });
  }
  assert.equal(calls.filter((entry) => entry[0] === "ground" || entry[0] === "ribbon").length, 3);
  assert.equal(water.getTelemetry().meshCount, 3);
  assert.ok(water.getTelemetry().materialCount <= api.HARD_LIMITS.materials);
  assert.doesNotMatch(source, /emit(?:Foam|Ripple|Wake)[\s\S]{0,400}Create(?:Ground|Ribbon|Sphere|Plane)/);
  water.dispose();
  assert.ok(disposed.includes("hwe-water-ocean"));
  assert.equal(water.getTelemetry().meshCount, 0);
});

test("weather is deterministic, wetness is physical state and precipitation pools stay bounded", () => {
  const options = {
    seed: "weather-contract", weather: "rain", intensity: 1, wetness: 0.1,
    terrainSampler: (x, z) => x * 0.001 + z * 0.002, quality: "lite",
    budgets: { weatherSplashes: 3, weatherRipples: 2, rainLayers: 1 }, autoVisibility: false
  };
  const a = new api.WeatherSimulationSystem(options);
  const b = new api.WeatherSimulationSystem(options);
  const context = {
    camera: { x: 1, y: 10, z: 2 }, forward: { x: 0.2, z: 1 },
    surfaceSampler: (x) => Math.floor(Math.abs(x)) % 2 ? "river-water" : "soil",
    lowlandFraction: 0.8, drainage: 0.1
  };
  for (let index = 0; index < 80; index += 1) { a.update(0.1, context); b.update(0.1, context); }
  assert.deepEqual(rounded(a.getState()), rounded(b.getState()));
  assert.deepEqual(rounded(a.getRenderDescriptors()), rounded(b.getRenderDescriptors()));
  assert.ok(a.getState().wetness > 0.1);
  assert.ok(a.getState().riverLevel > 1);
  assert.ok(a.getState().puddleCoverage > 0);
  assert.ok(a.getRenderDescriptors().splashes.length <= 3);
  assert.ok(a.getRenderDescriptors().ripples.length <= 2);
  assert.equal(a.getRenderDescriptors().layers.length, 1);
  assert.equal(a.getRenderDescriptors().meshPerParticle, false);

  const beforeDrying = a.getState().wetness;
  a.setWeather("clear", { intensity: 1, temperatureC: 34, humidity: 0.15, wind: { x: 1, z: 0, speed: 24 } });
  for (let index = 0; index < 80; index += 1) a.update(0.1, context);
  assert.ok(a.getState().wetness < beforeDrying);
  a.dispose(); b.dispose();
});

test("storm thunder uses distance delay and safety prevents rapid flashes", () => {
  const weather = new api.WeatherSimulationSystem({
    seed: 10, weather: "storm", flashEffects: true,
    minimumFlashInterval: 3.5, flashDuration: 0.1, thunderLimit: 2, autoVisibility: false
  });
  const first = weather.triggerLightning(343, { intensity: 99 });
  assert.equal(first.delaySeconds, 1);
  assert.equal(first.flashShown, true);
  assert.equal(weather.getState().flash.intensity, 1.6);
  assert.equal(weather.triggerLightning(100), null, "flash cadence must reject strobing");
  for (let index = 0; index < 4; index += 1) weather.update(0.25);
  const due = weather.consumeDueThunder();
  assert.equal(due.length, 1);
  assert.equal(due[0].id, first.id);
  const safety = weather.getTelemetry().flashSafety;
  assert.ok(safety.minimumIntervalSeconds >= 2.5);
  assert.ok(safety.maximumDurationSeconds <= 0.12);
  assert.ok(safety.maximumIntensity <= 1.6);
  weather.dispose();
});

test("weather pauses for visibility without advancing pools and removes its listener", () => {
  const listeners = new Set();
  const visibilityTarget = {
    hidden: false,
    addEventListener(type, handler) { if (type === "visibilitychange") listeners.add(handler); },
    removeEventListener(type, handler) { if (type === "visibilitychange") listeners.delete(handler); }
  };
  const weather = new api.WeatherSimulationSystem({ weather: "rain", visibilityTarget });
  weather.update(0.25, { camera: { x: 0, y: 4, z: 0 } });
  const time = weather.getTelemetry().simulatedSeconds;
  visibilityTarget.hidden = true;
  listeners.forEach((handler) => handler());
  assert.equal(weather.state, "paused");
  assert.equal(weather.update(0.25), false);
  assert.equal(weather.getTelemetry().simulatedSeconds, time);
  visibilityTarget.hidden = false;
  listeners.forEach((handler) => handler());
  assert.equal(weather.state, "running");
  weather.pause("menu");
  weather.setVisible(true);
  assert.equal(weather.state, "paused", "visibility must not override a manual pause");
  weather.resume();
  assert.equal(weather.state, "running");
  weather.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(weather.update(1), false);
});

test("atmosphere produces physical-ish celestial state and distinct bounded fog layers", () => {
  const atmosphere = new api.AtmosphereSystem({
    quality: "cinematic", latitude: 12, dayOfYear: 172, timeOfDay: 6,
    weather: "mist", humidity: 0.95, waterLevel: 4, autoVisibility: false
  });
  const state = atmosphere.update(0, {
    groundHeight: 2, valleyFloor: -3, valleyFactor: 0.9,
    waterLevel: 4, distanceToWater: 8
  });
  assert.ok(Number.isFinite(state.sun.elevationDegrees));
  assert.ok(Number.isFinite(state.sun.azimuthDegrees));
  assert.ok(state.sun.colorTemperatureK >= 2900 && state.sun.colorTemperatureK <= 6000);
  assert.ok(state.sky.rayleigh.x > 0 && state.sky.mie > 0);
  assert.equal(state.sky.cloudMode, "volumetric-personal");
  assert.ok(state.fogLayers.some((layer) => layer.type === "height"));
  assert.ok(state.fogLayers.some((layer) => layer.type === "valley"));
  assert.ok(state.fogLayers.some((layer) => layer.type === "water-surface"));
  assert.ok(state.fogLayers.length <= api.HARD_LIMITS.fogLayers);
  assert.ok(atmosphere.getFogDensityAt({ x: 0, y: 4, z: 0 }, { distanceToWater: 3 }) > atmosphere.getFogDensityAt({ x: 0, y: 500, z: 0 }, { distanceToWater: 1000 }));

  atmosphere.setQuality("lite");
  const lite = atmosphere.update(0, { valleyFactor: 1, distanceToWater: 0 });
  assert.equal(lite.sky.model, "physical-gradient-approximation");
  assert.equal(lite.sky.volumetricSteps, 0);
  assert.ok(lite.fogLayers.length <= api.QUALITY_PROFILES.lite.fogLayers);
  assert.equal(atmosphere.getTelemetry().drawCalls, null);
  atmosphere.dispose();
});

test("environment interactions pool, cap, query, decay and dispose without meshes", () => {
  const interactions = new api.EnvironmentalInteractionSystem({
    quality: "lite", budgets: { footprints: 2, interactionSplashes: 1, disturbances: 2, wetnessPatches: 2 }, autoVisibility: false
  });
  for (let index = 0; index < 8; index += 1) interactions.recordFootprint({ id: `foot-${index}`, x: index, z: 0, surface: "mud", wetness: 1, lifetime: 1 });
  for (let index = 0; index < 4; index += 1) interactions.emitSplash({ x: index, z: 0, lifetime: 0.1 });
  for (let index = 0; index < 5; index += 1) interactions.disturbVegetation({ x: index, z: 0, lifetime: 0.1 });
  interactions.applyWetness({ x: 0, z: 0, wetness: 0.5, surface: "soil" });
  interactions.applyWetness({ x: 0.2, z: 0.2, wetness: 0.8, surface: "soil" });
  const descriptors = interactions.getRenderDescriptors();
  assert.equal(descriptors.footprints.length, 2);
  assert.equal(descriptors.splashes.length, 1);
  assert.equal(descriptors.disturbances.length, 2);
  assert.equal(descriptors.wetnessPatches.length, 1, "nearby wet patches should merge");
  assert.equal(descriptors.rendererContract.individualMeshes, false);
  assert.ok(interactions.query({ x: 7, z: 0 }, 2, "footprint").length > 0);
  const telemetry = interactions.getTelemetry();
  assert.equal(telemetry.meshCount, 0);
  assert.equal(telemetry.drawCalls, null);
  interactions.pause();
  const frozen = interactions.getRenderDescriptors();
  assert.equal(interactions.update(10), false);
  assert.deepEqual(interactions.getRenderDescriptors(), frozen);
  interactions.resume();
  for (let index = 0; index < 20; index += 1) interactions.update(0.25, { wetness: 0, temperatureC: 35, windSpeed: 20 });
  assert.equal(interactions.getRenderDescriptors().splashes.length, 0);
  assert.equal(interactions.getRenderDescriptors().disturbances.length, 0);
  interactions.dispose();
  assert.equal(interactions.state, "disposed");
});

test("combined runtime has configure/update/pause/visibility/dispose lifecycle", () => {
  const environment = api.create({
    seed: "combined", terrainSampler: (x, z) => 100 - x - z,
    weather: "rain", quality: "lite", autoVisibility: false
  });
  assert.ok(environment instanceof api.WaterWeatherEnvironment);
  const configured = environment.configure({ weather: "storm", intensity: 0.6, timeOfDay: 19 });
  assert.equal(configured.weather.type, "storm");
  const frame = environment.update(1 / 30, { camera: { x: 0, y: 2, z: 0 } });
  assert.equal(frame.weather.type, "storm");
  assert.equal(environment.getTelemetry().updateCount, 1);
  environment.pause("route-transition");
  assert.equal(environment.update(1), false);
  environment.setVisible(false);
  environment.resume();
  assert.equal(environment.state, "paused");
  environment.setVisible(true);
  assert.equal(environment.state, "running");
  environment.dispose();
  assert.equal(environment.state, "disposed");
  assert.equal(environment.water.state, "disposed");
  assert.equal(environment.weather.state, "disposed");
  assert.equal(environment.atmosphere.state, "disposed");
  assert.equal(environment.interactions.state, "disposed");
});

test("telemetry is honest and code has no network, interval or nondeterministic random dependency", () => {
  const environment = api.create({ autoVisibility: false });
  const telemetry = environment.getTelemetry();
  assert.equal(telemetry.fps, null);
  assert.equal(telemetry.frameTimeP95Ms, null);
  assert.equal(telemetry.drawCalls, null);
  assert.equal(telemetry.gpuMemoryBytes, null);
  assert.equal(telemetry.measuredRendering, false);
  assert.equal(telemetry.weather.onlinePlayers, null);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /particleMeshes:\s*0/);
  environment.dispose();
});
