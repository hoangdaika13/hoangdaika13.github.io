const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");

test("Astral Realms provides free-look pointer-lock and a damped shoulder camera", () => {
  for (const token of [
    "requestPointerLock", "pointerlockchange", "cameraYawTarget", "cameraPitchTarget",
    "cameraShoulderSide", "resolveCameraSphereCollision", "sphere-bundle-hit",
    "cameraAutoFollow", "cameraInputAt", 'event.code === "KeyV"'
  ]) assert.ok(source.includes(token), `camera runtime missing ${token}`);
  assert.match(source, /this\.camera\.position\.lerp\(desired, 1 - Math\.exp/);
  assert.match(source, /pointerLockRequest\?\.catch\?\.\(\(\) =>/);
  assert.match(source, /object\.userData\?\.environmentSource \|\| centerHit\.object/);
  assert.match(source, /data-setting="cameraSensitivity"/);
  assert.match(source, /data-setting="invertCameraY"/);
  assert.match(source, /data-setting="cameraDistance"/);
});

test("weapon visuals retain a safe fallback until the authored GLB passes two rendered frames", () => {
  for (const token of [
    "validateWeaponFrame", "assetPendingValidation", "fallbackVisual",
    "projectedPixels", "visibleMaterial", "consecutiveFrames >= 2",
    "characterWeaponAsset", "characterWeaponError", "WeaponFallbackVisibleEdge",
    "hhWeaponNormalizationScale", "hhAxisNormalized", "hhGripAligned",
    "solveTwoBoneHandGrip", "applyWeaponUpperBodyIk"
  ]) assert.ok(source.includes(token), `weapon visibility runtime missing ${token}`);
  assert.match(source, /const calibrationKey = `\$\{socket\.modelId[\s\S]*?:\$\{weapon\.userData\?\.assetId[\s\S]*?:\$\{hand\}`/);
  assert.match(source, /if \(weapon\?\.userData\?\.fallbackVisual\) weapon\.userData\.fallbackVisual\.visible = true/);
  assert.match(source, /weapon\.remove\(fallback\)/);
  assert.match(source, /const angularDiameter = 2 \* Math\.atan/);
  assert.match(source, /fallback\.userData\.readabilityGuide = retainedGuide/);
});

test("authored environment placement follows terrain and validates architecture footprints", () => {
  for (const token of [
    "terrainHeightAt", "terrainNormalAt", "environmentPlacementIndex",
    "registerEnvironmentCollider", "runEnvironmentPlacementQa", "TerrainFoundation",
    "footprintSamples", "enableGpuFoliageWind", "hhWindTime",
    "clearEnvironmentColliders", "resolveEnvironmentMovement"
  ]) assert.ok(source.includes(token), `environment runtime missing ${token}`);
  assert.match(source, /const samplePoints = architecture[\s\S]*?\[0, -footprint\]/);
  assert.match(source, /object\.position\.set\(x, groundHeight, z\)/);
  assert.match(source, /object\.parent\.worldToLocal\(center\.clone\(\)\)/);
  assert.match(source, /const solidProp = \["boulder", "mossRocks", "pineRoots", "kenneyBridge", "free3dStone"\]/);
  assert.match(source, /Math\.max\(16, zone\.radius \* 0\.48\)/);
  assert.doesNotMatch(source, /object\.position\.set\(x, 1\.05, z\)/);
});

test("animation and foliage work use stable budgets without sacrificing the hero weapon", () => {
  assert.match(source, /this\.fixedAnimationStep = 1 \/ 60/);
  assert.match(source, /fixedSteps < 4/);
  assert.match(source, /this\.applyWeaponUpperBodyIk\(runtime, dt\)/);
  assert.match(source, /object\.userData\?\.gpuFoliageWind/);
  assert.match(source, /\["volumetric", "reflection", "far-shadow", "far-foliage", "particle", "cloth-hair"\]/);
  assert.match(source, /this\.playerMesh\.visible = true/);
  assert.match(source, /this\.playerWeapon\.visible = true/);
});
