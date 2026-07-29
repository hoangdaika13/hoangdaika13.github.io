const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");
const manifest = JSON.parse(read("assets/astral-realms/characters/manifest.json"));

test("Character V13 defines one truthful Hero Prime class", () => {
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*13/);
  for (const token of ["hero-prime", "unsupported", "HERO_ASSET_REQUIREMENTS", "classifyCharacterAsset", "heroChecks", "heroReady"]) assert.ok(source.includes(token));
  for (const signal of ["headVertices", "faceMorphTargets", "corneaMeshes", "tearLineMeshes", "teethMeshes", "tongueMeshes", "eyelashMeshes", "normalMaps", "roughnessMaps", "thicknessMaps"]) assert.ok(source.includes(signal));
});

test("manifest exposes exactly one full-quality Hero role", () => {
  assert.equal(manifest.version, 4);
  assert.equal(manifest.heroOnly, true);
  assert.equal(manifest.modelId, "valid-asian-f-1-casual");
  assert.equal(manifest.provider, "hero-core");
  assert.equal(manifest.classification, "hero-prime");
  assert.equal(manifest.heroEligible, true);
  assert.deepEqual(manifest.intendedRoles, ["hero"]);
  assert.doesNotMatch(JSON.stringify(manifest), /fallback|npc|multiplayer/);
});

test("Genesis V13 remains a ten-step fullscreen creator", () => {
  for (const step of ["identity", "face", "skin", "eyes", "hair", "body", "wardrobe", "performance", "preview", "dna"]) assert.ok(source.includes(`id: "${step}"`));
  for (const token of ["data-genesis-step", "previous-step", "next-step", "capture-a", "capture-b", "viewGenesisCompareSlot", "characterSlots", "versionHistory", "saveCharacterSlot", "loadCharacterSlot"]) assert.ok(source.includes(token));
  assert.match(css, /\.har-genesis-stepper/);
});

test("Motion DNA drives directional blend, IK, warping and terrain contact", () => {
  for (const token of ["MOTION_DNA_PRESETS", "directionalBlend", "movementChangedAt", 'return isMoving ? "start" : "stop"', "speedResponse", "rootMotionPolicy", "upperBodyLayer", "terrain-raycast", "applyUpperBodyIK", "two-bone-arm-ik", "upper-body-additive"]) assert.ok(source.includes(token));
});

test("facial performance layers visemes, emotion, gaze and local Face Pilot", () => {
  for (const token of ["blendFacialLayers", "applyFacialCorrectives", "correctiveSmile", "correctiveJawOpen", "gaze-target-active", "Face Pilot đang chạy cục bộ"]) assert.ok(source.includes(token));
  assert.doesNotMatch(source, /facial LOD/);
});

test("appearance evolution and NPC DNA share the Hero skeleton", () => {
  for (const token of ["persistentScars", "clothingDamage", "fatigueMemory", "auraPower", "tattooResponse", "buildNpcCharacterDNA", "deterministicSeed", "hh-humanoid-v12"]) assert.ok(source.includes(token));
  const realtime = read("realtime-server/src/astral-realms.js");
  assert.match(realtime, /APPEARANCE_VERSION\s*=\s*13/);
  assert.match(realtime, /HERO_CHARACTER_MODEL_ID/);
  assert.doesNotMatch(realtime, /\^valid-/);
});

test("Character V13 assets are cache-busted across route and worker", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  assert.match(loader, /astral-realms\.js\?v=3[1-9]/);
  assert.match(worker, /astral-realms\.js\?v=3[1-9]/);
  assert.match(index, /performance-loader\.js\?v=9[1-9]/);
});
