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

test("environment placement follows the active landscape and safely falls back", () => {
  const landscape = {
    sample(x, z) {
      return {
        height: 96 + x * 0.002 + z * 0.001,
        moisture: 0.52,
        heat: 0.58,
        biomeId: "forest"
      };
    }
  };
  const options = { qualityPreset: "balanced", seed: "renderer-landscape-placement", landscape };
  const first = renderer.planEnvironmentPlacements(2048, 2048, options);
  const second = renderer.planEnvironmentPlacements(2048, 2048, options);
  assert.ok(first.length > 0, "the landscape-backed planner must produce visible environment props");
  assert.deepEqual(first, second, "the same landscape and seed must remain deterministic");
  for (const placement of first) {
    assert.equal(placement.y, landscape.sample(placement.x, placement.z).height);
  }

  const fallbackOptions = { qualityPreset: "balanced", seed: "renderer-landscape-fallback" };
  const legacy = renderer.planEnvironmentPlacements(2048, 2048, fallbackOptions);
  const failedLandscape = renderer.planEnvironmentPlacements(2048, 2048, {
    ...fallbackOptions,
    landscape: { sample() { throw new Error("landscape unavailable"); } }
  });
  assert.deepEqual(failedLandscape, legacy, "a failed landscape sampler must preserve the deterministic legacy fallback");

  const managerUpdateStart = source.indexOf("\n    update(worldX, worldZ, force = false)");
  const managerUpdate = source.slice(managerUpdateStart, source.indexOf("\n    configure(qualityPreset)", managerUpdateStart));
  assert.match(managerUpdate, /planEnvironmentPlacements\([\s\S]*landscape:\s*this\.adapter\._landscape/);
});

test("procedural lake planning and water queries share one public adapter plan", () => {
  assert.equal(typeof renderer.planProceduralLakes, "function");
  assert.equal(typeof renderer.queryLandscapeWater, "function");
  for (const method of ["planProceduralLakes", "queryLandscapeWater", "queryWorldWater"]) {
    assert.equal(typeof renderer.EonWild3DAdapter.prototype[method], "function", `${method} must be public`);
  }

  const landscape = {
    config: { seaLevel: renderer.WATER_LEVEL },
    sample() {
      return {
        height: 20,
        moisture: 0.9,
        heat: 0.62,
        slopeDegrees: 0,
        biomeId: "wetland"
      };
    }
  };
  const purePlan = renderer.planProceduralLakes(landscape, 2048, 2048);
  assert.ok(Object.isFrozen(purePlan));
  assert.ok(purePlan.length > 0);
  const lake = purePlan[0];
  const pureQuery = renderer.queryLandscapeWater(landscape, lake.worldX, lake.worldZ, { lakes: purePlan });
  assert.equal(pureQuery.isWater, true);
  assert.equal(pureQuery.type, "swamp");
  assert.equal(pureQuery.surfaceHeight, lake.level);

  const adapter = renderer.create({ playerX: 2048, playerZ: 2048 });
  adapter._landscape = landscape;
  const committedPlan = adapter.planProceduralLakes({ x: 2048, z: 2048, commit: true });
  assert.deepEqual(committedPlan, purePlan);
  assert.equal(adapter._proceduralLakes, committedPlan, "the adapter must query the same immutable plan used by rendering");
  const adapterQuery = adapter.queryLandscapeWater({ x: lake.worldX, z: lake.worldZ });
  assert.deepEqual(adapterQuery, pureQuery);
  assert.deepEqual(adapter.queryWorldWater({ x: lake.worldX, z: lake.worldZ }), pureQuery);
  assert.equal(adapter.getGameplayCapabilities().waterQueries.proceduralLakes, purePlan.length);
  adapter._landscape = null;
  adapter.dispose();
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
