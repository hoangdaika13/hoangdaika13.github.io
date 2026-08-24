const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const renderer = require(path.join(root, "hh-eonwild-renderer-3d.js"));
const source = fs.readFileSync(path.join(root, "hh-eonwild-renderer-3d.js"), "utf8");

test("EonWild environment assets are same-origin, version-matched and bounded", () => {
  assert.match(renderer.DEFAULT_LOCAL_GLTF_LOADER_URL, /^\.\/vendor\/babylonjs-loaders-9\.22\.1\.min\.js/);
  assert.equal(renderer.DEFAULT_ENVIRONMENT_ASSET_BASE, "./assets/eonwild/environment/");
  assert.equal(renderer.DEFAULT_CREATURE_ASSET_BASE, "./assets/eonwild/creatures/");
  assert.deepEqual(renderer.ENVIRONMENT_ASSETS.map((asset) => asset.file), [
    "fern-02-1k.glb",
    "rock-moss-set-01-1k.glb",
    "quiver-tree-02-1k.glb"
  ]);
  for (const quality of ["low", "balanced", "high", "ultra"]) {
    const budget = renderer.ENVIRONMENT_BUDGETS[quality];
    assert.ok(budget.fern + budget.rock + budget.quiver <= 32);
    assert.ok(budget.rainParticles <= 240);
    assert.ok(budget.hdrCubeSize <= 256);
  }
});

test("animated creature prototypes are bounded, same-origin and never promoted to production", () => {
  assert.deepEqual(renderer.CREATURE_PROTOTYPE_ASSETS.map((asset) => [asset.id, asset.file]), [
    ["tyrannosaurus", "quaternius-tyrannosaurus-prototype.glb"],
    ["triceratops", "quaternius-triceratops-prototype.glb"]
  ]);
  assert.ok(renderer.CREATURE_PROTOTYPE_ASSETS.every((asset) => asset.scale > 0 && asset.scale < 1 && asset.source.includes("CC0")));
  for (const token of [
    "CreaturePrototypeManager",
    "animated-creature-prototype",
    "productionApproved: false",
    "CREATURE_GLB_TIMEOUT",
    "CREATURE_ASSET_ORIGIN_DENIED",
    "this._creatureAssets?.syncPose",
    "this._creatureAssets?.dispose()"
  ]) assert.ok(source.includes(token), `missing creature prototype lifecycle token ${token}`);
});

test("environment placement is deterministic, finite and never placed underwater", () => {
  const options = { qualityPreset: "balanced", seed: "renderer-assets-test" };
  const first = renderer.planEnvironmentPlacements(1024, 1024, options);
  const second = renderer.planEnvironmentPlacements(1024, 1024, options);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0 && first.length <= 15);
  assert.equal(new Set(first.map((placement) => placement.id)).size, first.length);
  for (const placement of first) {
    assert.ok(Object.isFrozen(placement));
    assert.ok(Number.isFinite(placement.x) && placement.x >= 0 && placement.x <= renderer.WORLD_SIZE);
    assert.ok(Number.isFinite(placement.z) && placement.z >= 0 && placement.z <= renderer.WORLD_SIZE);
    assert.ok(placement.y > renderer.WATER_LEVEL);
    assert.ok(placement.scale > 0 && placement.scale < 8);
  }
  const nearby = renderer.planEnvironmentPlacements(1040, 1024, options);
  const nearbyById = new Map(nearby.map((placement) => [placement.id, placement]));
  const stable = first.filter((placement) => nearbyById.has(placement.id));
  assert.ok(stable.length > 0, "nearby cells must retain some stable world props");
  for (const placement of stable) {
    const next = nearbyById.get(placement.id);
    assert.equal(next.x, placement.x);
    assert.equal(next.y, placement.y);
    assert.equal(next.z, placement.z);
  }
});

test("photogrammetry streams only after the warm frame and fails open", async () => {
  assert.match(source, /this\._scene\.render\(\)[\s\S]{0,1800}this\._scheduleEnvironmentAssetLoad\(generation\)/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /LoadAssetContainerAsync/);
  assert.match(source, /procedural-fallback/);
  assert.doesNotMatch(source, /allowRemoteEnvironmentAssets/);
  const scheduleStart = source.indexOf("\n    _scheduleEnvironmentAssetLoad(");
  const schedule = source.slice(scheduleStart, source.indexOf("\n    _installRuntimeListeners(", scheduleStart));
  assert.ok(schedule.indexOf("await this._creatureAssets.start()") < schedule.indexOf("await this._environmentAssets.start()"), "small creature prototypes must decode before large environment scans");
  await assert.rejects(
    renderer.loadBabylonGltfLoader({ SceneLoader: { LoadAssetContainerAsync() {} } }, {
      gltfLoaderUrl: "https://untrusted.example/babylonjs.loaders.js"
    }, { baseURI: "https://hoang8.com/", location: { origin: "https://hoang8.com" } }),
    (error) => error?.code === "GLTF_LOADER_ORIGIN_DENIED"
  );
  for (const unsafeUrl of ["file:///C:/private/model.glb", "blob:https://hoang8.com/unsafe"]) {
    await assert.rejects(
      renderer.loadBabylonGltfLoader({ SceneLoader: { LoadAssetContainerAsync() {} } }, { gltfLoaderUrl: unsafeUrl }, { baseURI: "https://hoang8.com/" }),
      (error) => error?.code === "GLTF_LOADER_ORIGIN_DENIED"
    );
  }
});

test("wind, HDR, rain, fog and water effects share the renderer lifecycle", () => {
  for (const token of [
    "HDRCubeTexture",
    "createDefaultSkybox",
    "hwe3d-bounded-rain",
    "hwe3d-water-normal-map",
    "valleyFactor",
    "windMultiplier",
    "isSameOriginAssetUrl",
    "assignments.set(instance",
    "_cancelEnvironmentAssetSchedule",
    "this._environmentAssets?.dispose()",
    "this._weatherFx.rain?.stop()"
  ]) assert.ok(source.includes(token), `missing lifecycle token ${token}`);
  assert.match(source, /pause\(cause = "user"\)[\s\S]{0,220}this\._cancelEnvironmentAssetSchedule\(\)/);
  assert.match(source, /add\(documentRef, "visibilitychange", visibilityHandler, false\)/);
  assert.match(source, /this\.pause\("visibility"\)/);
});
