const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const renderer = require(path.join(root, "hh-eonwild-renderer-3d.js"));
const core = require(path.join(root, "hh-eonwild-3d-core.js"));
const source = fs.readFileSync(path.join(root, "hh-eonwild-renderer-3d.js"), "utf8");

test("Cinematic Personal is explicit, bounded and never an automatic upgrade", () => {
  assert.equal(renderer.CINEMATIC_PRESET, "cinematic");
  assert.equal(renderer.WORLD_SIZE, 16384);
  assert.equal(renderer.QUALITY_ORDER.at(-1), "cinematic");
  assert.equal(renderer.QUALITY_PRESETS.cinematic.maxChunks, renderer.MAX_ACTIVE_CHUNKS);
  assert.ok(renderer.QUALITY_PRESETS.cinematic.terrainSegments > renderer.QUALITY_PRESETS.ultra.terrainSegments);
  assert.ok(renderer.ENVIRONMENT_BUDGETS.cinematic.rainParticles > renderer.ENVIRONMENT_BUDGETS.ultra.rainParticles);
  assert.equal(core.WORLD_CONFIG.logicalSizeMeters, 16384);
  assert.equal(core.QUALITY_PROFILES.personal.ownerOnly, true);
  const coreGovernor = core.createAdaptiveGovernor({ quality: "cinematic", allowUpgrade: true });
  for (let index = 0; index < 30; index += 1) coreGovernor.sample(240);
  assert.equal(coreGovernor.quality, "cinematic", "core governor must not auto-enable Personal");

  const adapter = renderer.create({ qualityPreset: "personal" });
  assert.equal(adapter.qualityPreset, "cinematic");
  adapter._qualityPreset = "ultra";
  adapter._qualityRequested = "cinematic";
  const changes = [];
  adapter._applyQuality = (preset) => changes.push(preset);
  adapter._shiftAdaptiveQuality(1, "test-headroom");
  assert.deepEqual(changes, [], "adaptive quality must not opt into Cinematic Personal");
  adapter._qualityPreset = "cinematic";
  adapter._shiftAdaptiveQuality(-1, "test-budget");
  assert.deepEqual(changes, ["ultra"], "adaptive quality may leave Cinematic Personal to protect responsiveness");
});

test("cinematic pipelines are constructed in TAA-first order and disposed in reverse", () => {
  const constructed = [];
  const disposed = [];
  class Pipeline {
    constructor(name) {
      this.name = name;
      this.isSupported = true;
      this.depthOfField = {};
      this.sharpen = {};
      this.grain = {};
      constructed.push(name);
    }
    prepare() {}
    dispose() { disposed.push(this.name); }
  }
  const adapter = renderer.create({ qualityPreset: "cinematic" });
  adapter._Babylon = {
    TAARenderingPipeline: Pipeline,
    DefaultRenderingPipeline: Pipeline,
    SSAO2RenderingPipeline: Pipeline,
    SSRRenderingPipeline: Pipeline,
    DepthOfFieldEffectBlurLevel: { Medium: 1 }
  };
  adapter._scene = {};
  adapter._camera = { fov: Math.PI / 4, maxZ: 1600 };
  adapter._backend = "webgl2";
  adapter._qualityPreset = "cinematic";
  const state = adapter._buildCinematicPostProcessing("cinematic");
  assert.deepEqual(constructed, [
    "hwe3d-cinematic-taa",
    "hwe3d-cinematic-default",
    "hwe3d-cinematic-ssao2",
    "hwe3d-cinematic-ssr"
  ]);
  assert.deepEqual(state.active, ["taa", "aces-bloom-sharpen-grain", "ssao2", "ssr"]);
  adapter._disposePostProcessing();
  assert.deepEqual(disposed, [
    "hwe3d-cinematic-ssr",
    "hwe3d-cinematic-ssao2",
    "hwe3d-cinematic-default",
    "hwe3d-cinematic-taa"
  ]);

  const method = source.slice(source.indexOf("_buildCinematicPostProcessing("), source.indexOf("_rebuildRenderingFeatures(", source.indexOf("_buildCinematicPostProcessing(")));
  assert.ok(method.indexOf("new B.TAARenderingPipeline") < method.indexOf("new B.DefaultRenderingPipeline"));
  assert.ok(method.indexOf("new B.DefaultRenderingPipeline") < method.indexOf("new B.SSAO2RenderingPipeline"));
  assert.ok(method.indexOf("new B.SSAO2RenderingPipeline") < method.indexOf("new B.SSRRenderingPipeline"));
});

test("each optional cinematic effect fails open without disabling the remaining renderer", () => {
  class WorkingPipeline {
    constructor() { this.isSupported = true; this.sharpen = {}; this.grain = {}; this.depthOfField = {}; }
    prepare() {}
    dispose() {}
  }
  const adapter = renderer.create({ qualityPreset: "cinematic" });
  adapter._Babylon = {
    TAARenderingPipeline: class { constructor() { throw new Error("synthetic TAA failure"); } },
    DefaultRenderingPipeline: WorkingPipeline,
    SSAO2RenderingPipeline: class { constructor() { throw new Error("synthetic SSAO failure"); } },
    SSRRenderingPipeline: WorkingPipeline,
    DepthOfFieldEffectBlurLevel: { Medium: 1 }
  };
  adapter._scene = {};
  adapter._camera = { fov: Math.PI / 4, maxZ: 1600 };
  adapter._backend = "webgl2";
  adapter._qualityPreset = "cinematic";
  const state = adapter._buildCinematicPostProcessing("cinematic");
  assert.equal(state.taa, null);
  assert.ok(state.defaultPipeline);
  assert.equal(state.ssao, null);
  assert.ok(state.ssr);
  assert.deepEqual(state.failures.map((entry) => entry.feature), ["taa", "ssao2"]);
  assert.equal(adapter.status, "idle", "optional pipeline failures must not mark the adapter failed");
});

test("physical camera controls expose photographic units and drive Babylon DOF", () => {
  const adapter = renderer.create({ qualityPreset: "cinematic" });
  const defaultPipeline = { depthOfFieldEnabled: false, depthOfField: {}, depthOfFieldBlurLevel: 0 };
  adapter._Babylon = { DepthOfFieldEffectBlurLevel: { Medium: 2 } };
  adapter._camera = { fov: Math.PI / 4 };
  adapter._scene = { imageProcessingConfiguration: { exposure: 1.02 } };
  adapter._qualityPreset = "cinematic";
  adapter._postProcessing = { defaultPipeline };
  const result = adapter.setPhotoSettings({
    focalLengthMm: 85,
    apertureFStop: 2.8,
    shutterSpeed: 250,
    iso: 200,
    focusDistanceM: 12,
    exposureCompensationEv: 0.5,
    depthOfField: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.focalLengthMm, 85);
  assert.equal(result.apertureFStop, 2.8);
  assert.equal(result.shutterSeconds, 1 / 250);
  assert.equal(result.iso, 200);
  assert.equal(result.focusDistanceM, 12);
  assert.equal(result.depthOfFieldActive, true);
  assert.equal(defaultPipeline.depthOfField.focalLength, 85);
  assert.equal(defaultPipeline.depthOfField.fStop, 2.8);
  assert.equal(defaultPipeline.depthOfField.focusDistance, 12000);
  assert.ok(adapter._camera.fov < Math.PI / 4);
  assert.ok(result.exposure > 1.02 && result.exposure <= 4);

  adapter._camera.position = { x: 0, y: 0, z: 10 };
  adapter._proxies.set("tyrannosaurus", { root: { position: { x: 0, y: 0, z: 0 } } });
  const autofocus = adapter.setPhotoSettings({ autofocus: true, cameraShake: 0.4, focusDistanceM: 50, depthOfField: true });
  assert.equal(autofocus.autofocus, true);
  assert.equal(autofocus.cameraShake, 0.4);
  assert.equal(autofocus.effectiveFocusDistanceM, 10);
  assert.equal(defaultPipeline.depthOfField.focusDistance, 10000);
  assert.match(source, /dimensions\.width[\s\S]*7680/);
});

test("renderer telemetry reports real counters when available and bounded VRAM estimates", () => {
  const adapter = renderer.create({ qualityPreset: "cinematic" });
  const mesh = {
    isVisible: true,
    isEnabled: () => true,
    subMeshes: [{}, {}],
    getTotalIndices: () => 3000,
    getTotalVertices: () => 640
  };
  adapter._state = "running";
  adapter._backend = "webgl2";
  adapter._qualityPreset = "cinematic";
  adapter._qualityRequested = "cinematic";
  adapter._engine = {
    _drawCalls: { current: 17 },
    getRenderWidth: () => 3840,
    getRenderHeight: () => 2160,
    getLoadedTexturesCache: () => [{ width: 1024, height: 1024, type: 0, generateMipMaps: true }]
  };
  adapter._scene = {
    meshes: [mesh],
    textures: [],
    getActiveMeshes: () => [mesh],
    getActiveIndices: () => 3000
  };
  adapter._lights = { shadow: {}, shadowKind: "cascaded-pcf" };
  adapter._postProcessing = { supportedBackend: true, active: ["taa", "ssao2"], taa: {}, ssao: {}, ssr: null, defaultPipeline: null };
  adapter._lastFrameDrawCalls = 17;
  adapter._drawCallsMeasured = true;
  const telemetry = adapter.getTelemetry();
  assert.equal(telemetry.drawCalls, 17);
  assert.equal(telemetry.drawCallsMeasured, true);
  assert.equal(telemetry.triangles, 1000);
  assert.equal(telemetry.vertices, 640);
  assert.equal(telemetry.textureCount, 1);
  assert.ok(telemetry.estimatedVramBytes > 3840 * 2160 * 12);
  assert.equal(telemetry.estimatedVRAMMiB, telemetry.estimatedVramMiB);
  assert.equal(telemetry.renderingFeatures.shadow, "cascaded-pcf");
  assert.match(source, /drawCallsAfter\s*-\s*drawCallsBefore/);
  assert.doesNotMatch(source, /measuredDrawCalls\s*=\s*Math\.max\(0,\s*Math\.floor\(finite\(engine\._drawCalls\?\.current/);
  assert.match(source, /numMaxUncapturedErrors\s*=\s*-1/);
  assert.match(source, /"webgpu-validation"/);
  assert.match(source, /WEBGPU_RUNTIME_VALIDATION_FAILED/);
});

test("verified Personal creature pack descriptors are consumed without being promoted to production", () => {
  assert.match(source, /cinematicCreatureAssets/);
  assert.match(source, /trustedObjectUrl/);
  assert.match(source, /verified-cinematic-creature-candidate/);
  assert.match(source, /productionApproved:\s*false/);
  assert.match(source, /cinematic-candidate-ready/);
  assert.match(source, /parsed\.protocol === "blob:" && parsed\.origin === base\.origin/);
  assert.match(source, /lodEntries/);
  assert.match(source, /distance < 42 \? 0 : distance < 105 \? 1 : distance < 230 \? 2 : 3/);
  assert.match(source, /availableLods/);
});

test("all six verified Personal packs have a bounded runtime consumer and lifecycle", () => {
  for (const token of [
    "cinematicEnvironmentAssets",
    "cinematicTerrainAssets",
    "cinematicOceanAssets",
    "cinematicWeatherAssets",
    "cinematicAudioAssets",
    "verified-personal-environment-candidate",
    "verified-personal-hdri-candidate",
    "createRuntimeTexture",
    "CinematicAudioManager",
    "setAmbientAudio",
    "this._cinematicAudio?.dispose()"
  ]) assert.ok(source.includes(token), "missing Personal runtime integration " + token);
  assert.match(source, /this\._water\.foamTexture/);
  assert.match(source, /for \(const texture of this\.textures\) safeDispose\(texture\)/);
  assert.match(source, /this\._cinematicAudio\?\.pause\(\)/);
  assert.match(source, /this\.hdrDefinition = null/);
  assert.match(source, /await this\._loadDefinition\(fallback\)/);
});
