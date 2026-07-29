const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");

test("Digital Human V13 defines 52-channel facial performance and complete visemes", () => {
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*13/);
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

test("Genesis adds a live silhouette safety check, auto-fit action and motion-safe turntable", () => {
  for (const token of [
    "buildAppearanceFitReport",
    "autoFitCharacter",
    "data-genesis-action=\"auto-fit\"",
    "data-genesis-action=\"toggle-turntable\"",
    "genesisTurntable",
    "FIT & SILHOUETTE CHECK",
    "prefers-reduced-motion"
  ]) assert.ok(source.includes(token), `missing Genesis V11.1 feature ${token}`);
  assert.match(css, /\.har-genesis-fit/);
  assert.match(source, /extremes\.length/);
  assert.match(source, /cameraYaw = \(this\.cameraYaw \+ dt \* 0\.34\)/);
});

test("broken embedded GLB textures recover to a visible articulated PBR character", () => {
  for (const token of [
    "sanitizeBuiltInCharacterAsset",
    "hhTextureFallbacks",
    "hhRenderableMeshes",
    "assetNeedsVisualRecovery",
    "procedural-3d-recovery",
    "HH Articulated PBR Recovery"
  ]) assert.ok(source.includes(token), `missing visibility recovery ${token}`);
  assert.match(source, /object\.frustumCulled = false/);
  assert.match(source, /material\.opacity = 1/);
  assert.match(source, /crowdProxy\.visible = useProxy \|\| assetNeedsVisualRecovery/);
  assert.match(source, /manager\.hhPreferTextureLoader = true/);
  assert.match(read("vendor/addons/loaders/GLTFLoader.js"), /manager\?\.hhPreferTextureLoader === true/);
});

test("Character Genesis uses a clear aerial studio instead of rendering inside terrain", () => {
  assert.match(source, /setupGenesisPreview\(\)/);
  assert.match(source, /this\.genesisScene = new THREE\.Scene\(\)/);
  assert.match(source, /createGenesisStudio/);
  assert.match(source, /renderGenesisFrame/);
  assert.doesNotMatch(source, /this\.root\.dataset\.characterPreview = "3d";\s*this\.setLoading/);
});

test("V13 resolves native VALID morphs and keeps facial motion organically asymmetric", () => {
  assert.match(source, /FACIAL_MORPH_ALIASES/);
  assert.match(source, /normalizeMorphTargetName/);
  assert.match(source, /supportedFacialChannels/);
  assert.match(source, /LeyeClose_h/);
  assert.match(source, /RsmileOpen_h/);
  assert.match(source, /blinkEyeDelay/);
  assert.match(source, /saccadeTargetX/);
  assert.match(source, /mouthDimpleLeft/);
});

test("V13 loads offline-baked VALID motion and never retargets a foreign rig at runtime", () => {
  assert.match(source, /rest-space-quaternion/);
  assert.match(source, /relaxedArmOffsets/);
  assert.match(source, /leftShoulder/);
  assert.match(source, /shoulderBreath/);
  assert.match(source, /offlineBakedAnimations/);
  assert.match(source, /loadMotionLibrary/);
  assert.match(source, /offline-baked-v13/);
  assert.doesNotMatch(source, /retargetCharacterClip/);
  assert.doesNotMatch(source, /buildRetargetedCharacterAnimations/);
});

test("V13 face camera uses the head bone instead of full-body arm span", () => {
  assert.match(source, /headPosition/);
  assert.match(source, /visibleHeight = size\.y \* profile\.visible/);
  assert.match(source, /Face framing must not use the full-body width/);
  assert.doesNotMatch(source, /Math\.max\(size\.y \* 0\.38, size\.x \* 1\.3\)/);
});

test("V13 keeps authored body atlases neutral under warm studio light", () => {
  assert.match(source, /body-composite/);
  assert.match(source, /eye-moisture/);
  assert.match(source, /materialRole: role/);
  assert.match(source, /studio\.fill \|\| studio\.key/);
  assert.match(source, /0xffddca/);
});
