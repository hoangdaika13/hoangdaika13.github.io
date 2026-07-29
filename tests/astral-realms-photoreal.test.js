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

test("route and offline cache request the Hero-only bundle", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /astral-realms\.js\?v=3[1-9]/);
  assert.match(worker, /valid-asian-f-1-casual\.glb/);
  assert.doesNotMatch(worker, /hh-human-asteria|hh-human-vanguard/);
});
