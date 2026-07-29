const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Character V13 locks one Hero Prime tier and a complete humanoid arm contract", () => {
  const source = read("astral-realms.js");
  assert.match(source, /CHARACTER_VISUAL_VERSION = 13/);
  const tiers = source.slice(source.indexOf("const CHARACTER_MODEL_TIERS"), source.indexOf("const CHARACTER_ASSET_CLASSES"));
  assert.match(tiers, /hero:\s*\{[^\n]+triangles:[^\n]+face:\s*52[^\n]+updateHz:\s*60/);
  assert.doesNotMatch(tiers, /\bnear\b|\bcrowd\b|\bimpostor\b/);
  assert.match(source, /HH_HUMANOID_SKELETON/);
  for (const slot of [
    "root", "hips", "spine", "head",
    "leftShoulder", "rightShoulder", "leftUpperArm", "rightUpperArm",
    "leftForeArm", "rightForeArm", "leftHand", "rightHand",
    "leftThumb", "rightThumb", "leftIndex", "rightIndex",
    "leftFoot", "rightFoot"
  ]) {
    assert.match(source, new RegExp(`${slot}: \\[`));
  }
});

test("local GLB inspection analyzes a candidate but cannot replace Hero Prime", () => {
  const source = read("astral-realms.js");
  assert.match(source, /loadCharacterModules/);
  assert.match(source, /GLTFLoaderClass/);
  assert.match(source, /importCharacterGLB/);
  assert.match(source, /file\.arrayBuffer\(\)/);
  assert.match(source, /loader\.parse\(buffer/);
  assert.match(source, /validateCharacterAsset/);
  assert.doesNotMatch(source, /installImportedCharacter\s*\(/);
  assert.doesNotMatch(source, /fetch\([^)]*file\.arrayBuffer/);
});

test("animation state machine crossfades traversal, combat and reaction states", () => {
  const source = read("astral-realms.js");
  assert.match(source, /AnimationMixer/);
  assert.match(source, /crossFadeTo/);
  assert.match(source, /setCharacterAction/);
  assert.match(source, /resolveCharacterMotion/);
  for (const motion of ["idle", "walk", "run", "sprint", "strafe", "jump", "fall", "land", "glide", "swim", "climb", "dodge", "attack1", "attack2", "attack3", "skill", "ultimate", "hit", "defeated"]) {
    assert.match(source, new RegExp(`${motion}: \\[`));
  }
  assert.match(source, /applyCorrectiveMorphs/);
  assert.match(source, /weaponAnchor/);
});

test("Face Pilot is explicit, camera-only and processes MediaPipe blendshapes locally", () => {
  const source = read("astral-realms.js");
  assert.match(source, /toggleFacePilot/);
  assert.match(source, /FaceLandmarker\.createFromOptions/);
  assert.match(source, /outputFaceBlendshapes: true/);
  assert.match(source, /detectForVideo/);
  assert.match(source, /audio: false/);
  assert.match(source, /getTracks\?\.\(\)\.forEach/);
  assert.match(source, /MEDIAPIPE_FACE_CHANNELS/);
  assert.doesNotMatch(source, /fetch\([^)]*(?:facePilot|srcObject|video)/i);
});

test("Character Lab exposes Hero metrics, motion preview and full-quality controls", () => {
  const source = read("astral-realms.js");
  const css = read("astral-realms.css");
  for (const token of [
    "har-character-runtime-grid",
    "har-motion-grid",
    "har-face-pilot",
    "characterQuality",
    "facialAnimation",
    "surfaceFx",
    "updateCharacterSurface",
    "updateCharacterLod",
    "applyHeroArmIK"
  ]) {
    assert.ok(source.includes(token) || css.includes(token), `missing ${token}`);
  }
  assert.match(css, /Astral Realms Character V9/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("GLTF dependencies and the V13 bundle are available offline", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const token of ["astral-realms.css?v=35", "astral-realms.js?v=35"]) {
    assert.ok(loader.includes(token), `route loader missing ${token}`);
    assert.ok(worker.includes(token), `service worker missing ${token}`);
  }
  for (const file of [
    "vendor/addons/loaders/GLTFLoader.js",
    "vendor/addons/utils/BufferGeometryUtils.js",
    "vendor/addons/utils/SkeletonUtils.js"
  ]) {
    assert.ok(fs.statSync(path.join(root, file)).size > 1_000, `${file} must contain the vendored Three.js helper`);
    assert.ok(worker.includes(file), `service worker missing ${file}`);
  }
});

test("MediaPipe uses a narrow CSP allowance instead of an unrestricted script origin", () => {
  const vercel = read("vercel.json");
  assert.match(vercel, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(vercel, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(vercel, /object-src 'none'/);
  assert.match(vercel, /frame-ancestors 'none'/);
});
