const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");

test("Digital Human V11 defines 52-channel facial performance and complete visemes", () => {
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*11/);
  assert.match(source, /MEDIAPIPE_FACE_CHANNELS/);
  assert.match(source, /CHARACTER_VISEMES/);
  for (const viseme of ["A", "E", "I", "O", "U", "MBP", "FV", "L", "WQ"]) {
    assert.ok(source.includes(`${viseme}:`), `missing viseme ${viseme}`);
  }
  assert.match(source, /CHARACTER_EXPRESSION_PRESETS/);
  assert.match(source, /applyBoneFacialFallback/);
  assert.match(source, /setCharacterFacePreview/);
  assert.match(source, /data-genesis-expression/);
  assert.match(source, /data-genesis-viseme/);
});

test("Digital Human materials expose skin, eye, hair and environment responses", () => {
  assert.match(source, /applyDigitalHumanMaterials/);
  for (const token of [
    "skinLayers: 5",
    "skin-normal",
    "skin-roughness",
    "anisotropy",
    "hair-cards-anisotropic",
    "sweat",
    "dirt",
    "blood",
    "burn"
  ]) assert.ok(source.includes(token), `missing surface feature ${token}`);
  assert.match(source, /beards:/);
  assert.match(source, /makeups:/);
  assert.match(source, /accessories:/);
});

test("Character Genesis exposes modular assets, skin controls, lighting and DNA", () => {
  for (const token of [
    "data-genesis-setting=\"hair\"",
    "data-genesis-setting=\"beard\"",
    "data-genesis-setting=\"brow\"",
    "data-genesis-setting=\"makeup\"",
    "data-genesis-setting=\"accessory\"",
    "data-genesis-setting=\"outfitPrimary\"",
    "data-genesis-decal",
    "data-genesis-surface",
    "data-genesis-lighting",
    "data-genesis-dna",
    "copyCharacterDNA",
    "applyCharacterDNA"
  ]) assert.ok(source.includes(token), `missing Genesis feature ${token}`);
  assert.match(source, /hh\.character-dna\.v1/);
  assert.match(css, /\.har-genesis-capabilities/);
  assert.match(css, /\.har-genesis-detail-grid/);
  assert.match(css, /\.har-genesis-dna/);
});

test("motion runtime has inertial transitions, foot contact, secondary bones and adaptive LOD budgets", () => {
  assert.match(source, /mode:\s*"inertial-crossfade"/);
  assert.match(source, /applyFootContactIK/);
  assert.match(source, /updateSecondaryCharacterMotion/);
  assert.match(source, /motionWarp/);
  assert.match(source, /updateHz:\s*60/);
  assert.match(source, /faceChannelBudget/);
});

test("import QA reports real Web Digital Human capability instead of inferring it from provider names", () => {
  for (const token of [
    "headVertices",
    "faceMorphTargets",
    "separateEyeMeshes",
    "hairCardMeshes",
    "digitalHumanTier",
    "\"web-hero\"",
    "\"gameplay-rig\""
  ]) assert.ok(source.includes(token), `missing QA signal ${token}`);
  assert.match(source, /Head mesh dưới 18K vertices/);
  assert.match(source, /\/52 facial morph native/);
});

test("Digital Human controls stay usable on narrow screens and reduced motion remains supported", () => {
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 450px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.har-creator__surface/);
  assert.match(css, /\.har-face-performance-lab/);
});
