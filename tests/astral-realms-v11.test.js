const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");

test("Digital Human V13 keeps 52-channel facial performance and visemes", () => {
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*13/);
  assert.match(source, /MEDIAPIPE_FACE_CHANNELS/);
  for (const viseme of ["A", "E", "I", "O", "U", "MBP", "FV", "L", "WQ"]) assert.ok(source.includes(`${viseme}:`));
  assert.match(source, /setCharacterFacePreview/);
  assert.match(source, /data-genesis-expression/);
  assert.match(source, /data-genesis-viseme/);
});

test("Digital Human materials expose skin, eye, hair and environment responses", () => {
  for (const token of ["applyDigitalHumanMaterials", "skinLayers: 5", "skin-normal", "skin-roughness", "anisotropy", "hair-cards-anisotropic", "sweat", "dirt", "blood", "burn"]) assert.ok(source.includes(token));
});

test("Character Genesis exposes modular assets, skin controls, lighting and DNA", () => {
  for (const token of ["data-genesis-setting=\"hair\"", "data-genesis-setting=\"beard\"", "data-genesis-setting=\"brow\"", "data-genesis-setting=\"makeup\"", "data-genesis-setting=\"accessory\"", "data-genesis-decal", "data-genesis-surface", "data-genesis-lighting", "data-genesis-dna", "copyCharacterDNA", "applyCharacterDNA"]) assert.ok(source.includes(token));
  assert.match(css, /\.har-genesis-capabilities/);
});

test("motion runtime has inertial transitions, terrain contact and fixed Hero budgets", () => {
  assert.match(source, /mode:\s*"inertial-crossfade"/);
  assert.match(source, /applyFootContactIK/);
  assert.match(source, /updateSecondaryCharacterMotion/);
  assert.match(source, /applyHeroArmIK/);
  assert.match(source, /updateHz:\s*60/);
  assert.match(source, /faceChannelBudget\s*=\s*CHARACTER_MODEL_TIERS\.hero\.face/);
});

test("Hero QA reports measured capability without permitting a lower asset class", () => {
  for (const token of ["headVertices", "faceMorphTargets", "separateEyeMeshes", "hairCardMeshes", "digitalHumanTier", "hero-prime", "unsupported"]) assert.ok(source.includes(token));
  assert.doesNotMatch(source, /"gameplay-human"|"fallback-proxy"/);
});

test("broken Hero textures block startup and retain Retry", () => {
  assert.match(source, /Hero Prime không giải mã được đầy đủ mesh\/texture/);
  assert.match(source, /Game đã dừng để không thay bằng model yếu|Game đã dừng thay vì hiển thị model chất lượng thấp/);
  assert.match(source, /data-har-retry/);
  assert.match(source, /manager\.hhPreferTextureLoader = true/);
});

test("Digital Human controls remain responsive and motion-safe", () => {
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 450px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
