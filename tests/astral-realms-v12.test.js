const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");
const manifest = JSON.parse(read("assets/astral-realms/characters/manifest.json"));

test("Character V12 defines a truthful four-class Hero asset gate", () => {
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*12/);
  for (const token of [
    "hero-digital-human",
    "gameplay-human",
    "npc-human",
    "fallback-proxy",
    "HERO_ASSET_REQUIREMENTS",
    "classifyCharacterAsset",
    "heroChecks",
    "heroReady"
  ]) assert.ok(source.includes(token), `missing Hero gate token ${token}`);
  for (const signal of [
    "headVertices",
    "faceMorphTargets",
    "corneaMeshes",
    "tearLineMeshes",
    "teethMeshes",
    "tongueMeshes",
    "eyelashMeshes",
    "normalMaps",
    "roughnessMaps",
    "thicknessMaps",
    "lodGroups"
  ]) assert.ok(source.includes(signal), `missing measured signal ${signal}`);
});

test("bundled VALID humans are explicitly NPC, multiplayer and fallback assets", () => {
  assert.equal(manifest.version, 3);
  assert.equal(manifest.skeletonContract, "hh-humanoid-v12");
  assert.equal(manifest.heroGate.nativeFacialMorphs, 52);
  assert.equal(manifest.heroGate.explicitLods, 4);
  assert.equal(manifest.sources.length, 4);
  for (const asset of manifest.sources) {
    assert.equal(asset.classification, "npc-human");
    assert.equal(asset.heroEligible, false);
    assert.deepEqual(asset.intendedRoles, ["npc", "multiplayer", "fallback"]);
  }
});

test("Genesis V12 is a ten-step fullscreen creator with A/B, slots and version history", () => {
  for (const step of ["identity", "face", "skin", "eyes", "hair", "body", "wardrobe", "performance", "preview", "dna"]) {
    assert.ok(source.includes(`id: "${step}"`), `missing Genesis step ${step}`);
  }
  for (const token of [
    "data-genesis-step",
    "previous-step",
    "next-step",
    "capture-a",
    "capture-b",
    "viewGenesisCompareSlot",
    "characterSlots",
    "versionHistory",
    "saveCharacterSlot",
    "loadCharacterSlot"
  ]) assert.ok(source.includes(token), `missing Genesis V12 control ${token}`);
  assert.match(css, /\.har-genesis-stepper/);
  assert.match(css, /\.har-character-slots/);
  assert.match(css, /\.har-genesis-navigation/);
});

test("Motion DNA drives directional blend, starts, stops, warping and real terrain foot contact", () => {
  for (const token of [
    "MOTION_DNA_PRESETS",
    "directionalBlend",
    "movementChangedAt",
    'return isMoving ? "start" : "stop"',
    "speedResponse",
    "rootMotionPolicy",
    "upperBodyLayer",
    "terrain-raycast",
    "applyUpperBodyIK",
    "weapon-socket-locked",
    "upper-body-additive"
  ]) assert.ok(source.includes(token), `missing Motion V12 feature ${token}`);
  assert.match(source, /data-genesis-motion-dna/);
  assert.match(css, /\.har-motion-dna/);
});

test("facial performance layers visemes, emotion, gaze, correctives and local Face Pilot", () => {
  for (const token of [
    "blendFacialLayers",
    "applyFacialCorrectives",
    "correctiveSmile",
    "correctiveJawOpen",
    "gaze-target-active",
    "facial LOD",
    "Face Pilot đang chạy cục bộ"
  ]) assert.ok(source.includes(token), `missing facial feature ${token}`);
  assert.match(source, /MEDIAPIPE_FACE_CHANNELS/);
  assert.match(source, /CHARACTER_VISEMES/);
});

test("appearance evolution and deterministic NPC DNA share one skeleton contract", () => {
  for (const token of [
    "persistentScars",
    "clothingDamage",
    "fatigueMemory",
    "auraPower",
    "tattooResponse",
    "buildNpcCharacterDNA",
    "deterministicSeed",
    "hh-humanoid-v12",
    "lastAnimationUpdateAt"
  ]) assert.ok(source.includes(token), `missing evolution/NPC token ${token}`);
  assert.match(css, /\.har-evolution-preview/);
  const realtime = read("realtime-server/src/astral-realms.js");
  assert.match(realtime, /APPEARANCE_VERSION\s*=\s*7/);
  assert.match(realtime, /motionDNA:/);
  assert.match(realtime, /evolution:/);
  assert.match(realtime, /\^valid-/);
});

test("Character V12 assets are cache-busted across route, worker and shell", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  for (const asset of ["astral-realms.css?v=22", "astral-realms.js?v=22"]) {
    assert.ok(loader.includes(asset));
    assert.ok(worker.includes(asset));
  }
  assert.match(worker, /hh-identity-portal-v306/);
  assert.match(index, /performance-loader\.js\?v=82/);
});
