const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");

test("Astral Realms loads exactly one canonical Hero Prime model", () => {
  assert.match(source, /HERO_CHARACTER_MODEL_ID\s*=\s*"valid-asian-f-1-casual"/);
  assert.match(source, /HERO_CHARACTER_ASSET_URL/);
  assert.match(source, /hero-prime-rigged/);
  assert.match(source, /createPhotorealCharacterModel/);
  assert.match(source, /SkinnedMesh/);
  const file = path.join(root, "assets/astral-realms/characters/default/valid-asian-f-1-casual.glb");
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 1_500_000);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  for (const removed of [
    "assets/astral-realms/hh-human-asteria-v1.glb",
    "assets/astral-realms/hh-human-vanguard-v1.glb",
    "assets/astral-realms/characters/default/valid-asian-m-1-casual.glb",
    "assets/astral-realms/characters/default/valid-black-f-1-casual.glb",
    "assets/astral-realms/characters/default/valid-white-m-1-casual.glb"
  ]) assert.equal(fs.existsSync(path.join(root, removed)), false, `${removed} must be removed`);
});

test("Hero load failure blocks with Retry and never substitutes player geometry", () => {
  const loader = source.slice(source.indexOf("async loadCharacterAssetsFromPipeline()"), source.indexOf("sanitizeBuiltInCharacterAsset("));
  const creator = source.slice(source.indexOf("createPhotorealCharacterModel("), source.indexOf("updateCharacterSurface("));
  assert.match(loader, /throw new Error/);
  assert.doesNotMatch(loader, /fallbackUrl|partial|crowdProxy|impostor/);
  assert.match(creator, /không có visual fallback/);
  assert.match(source, /data-har-retry/);
  assert.doesNotMatch(source, /data-genesis-fallback-character/);
});

test("licensed environment models remain integrated independently of Hero quality", () => {
  for (const file of ["boulder_01.glb", "grass_medium_01.glb", "rock_moss_set_01.glb", "shrub_01.glb", "dead_tree_trunk_02.glb", "fern_02.glb"]) {
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "environment", file));
    assert.ok(bytes.length > 100_000, `${file} should contain a real CC0 environment model`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  }
  assert.match(source, /scene\.environment\s*=\s*this\.photorealAssets\.panorama/);
  assert.doesNotMatch(source, /scene\.background\s*=\s*this\.photorealAssets\.panorama/);
});

test("Hero framing and arm IK use actual shoulders, elbows, wrists and fingers", () => {
  for (const token of ["leftShoulder", "rightShoulder", "leftForeArm", "rightForeArm", "leftHand", "rightHand", "applyHeroArmIK", "rotateHeroBoneTowardWorldTarget", "elbowPole", "wristAlignment", "fullyContained"]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
  assert.doesNotMatch(source, /relaxedArm\s*=\s*[^;]*1\.4/);
});

test("Hero arm proportions stay anatomical and idle fingers remain relaxed", () => {
  const proportions = source.slice(
    source.indexOf("    applyRiggedBodyProportions(mesh, recipe) {"),
    source.indexOf("    createBuiltInRiggedCharacter(profile, scale = 1) {")
  );
  const armIk = source.slice(
    source.indexOf("    applyHeroArmIK(runtime, time, motion = \"idle\", dt = 0.016) {"),
    source.indexOf("    applyProceduralRigMotion(runtime, time, motion = \"idle\", dt = 0.016) {")
  );

  assert.match(proportions, /const armLength\s*=\s*clamp\([^;]+,\s*0\.94,\s*1\.06\)/);
  assert.match(proportions, /const forearmLength\s*=\s*clamp\([^;]+,\s*0\.95,\s*1\.05\)/);
  assert.match(proportions, /const armMass\s*=\s*clamp\([^;]+,\s*1\.01,\s*1\.16\)/);
  assert.match(proportions, /const forearmMass\s*=\s*clamp\([^;]+,\s*1,\s*1\.13\)/);
  assert.match(proportions, /const fingerLengthScale\s*=\s*clamp\([^;]+,\s*0\.915,\s*0\.995\)/);
  assert.match(proportions, /setSegmentScale\(leftArm/);
  assert.match(proportions, /setSegmentScale\(rightArm/);
  assert.match(proportions, /setPalmScale\(leftHand/);
  assert.match(proportions, /setPalmScale\(rightHand/);
  assert.match(proportions, /armCalibration\s*=\s*\{/);
  assert.doesNotMatch(proportions, /setScale\(leftArm,\s*armMass,\s*armLength/);
  assert.doesNotMatch(proportions, /setScale\(rightArm,\s*armMass,\s*armLength/);

  assert.match(armIk, /const relaxedCurl\s*=\s*\[[^\]]+\]/);
  assert.match(armIk, /const actionCurl\s*=\s*\[[^\]]+\]/);
  assert.match(armIk, /const curl\s*=\s*combat\s*\?\s*actionCurl\s*:\s*relaxedCurl/);
  assert.match(armIk, /hhHeroFingerBase/);
  assert.match(armIk, /two-bone|analytic-two-bone|elbowPole/i);
  assert.doesNotMatch(armIk, /relaxedCurl\s*=\s*\[[^\]]*(?:0\.2|0\.3|0\.4|1\.4)/);
});

test("route and offline cache request the Hero-only bundle", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /astral-realms\.js\?v=3[1-9]/);
  assert.match(worker, /valid-asian-f-1-casual\.glb/);
  assert.doesNotMatch(worker, /hh-human-asteria|hh-human-vanguard/);
});
