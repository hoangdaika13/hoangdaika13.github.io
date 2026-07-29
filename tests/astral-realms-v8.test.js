const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Character V11 preserves browser-safe model tiers and one humanoid contract", () => {
  const source = read("astral-realms.js");
  assert.match(source, /CHARACTER_VISUAL_VERSION = 11/);
  assert.match(source, /CHARACTER_MODEL_TIERS/);
  for (const tier of ["hero", "near", "crowd", "impostor"]) {
    assert.match(source, new RegExp(`${tier}: \\{[^\\n]+triangles:`));
  }
  assert.match(source, /HH_HUMANOID_SKELETON/);
  for (const slot of ["root", "hips", "spine", "head", "leftHand", "rightHand", "leftFoot", "rightFoot"]) {
    assert.match(source, new RegExp(`${slot}: \\[`));
  }
});

test("local GLB import analyzes and installs a rigged character without uploading it", () => {
  const source = read("astral-realms.js");
  assert.match(source, /loadCharacterModules/);
  assert.match(source, /GLTFLoaderClass/);
  assert.match(source, /importCharacterGLB/);
  assert.match(source, /installImportedCharacter/);
  assert.match(source, /file\.arrayBuffer\(\)/);
  assert.match(source, /loader\.parse\(buffer/);
  assert.match(source, /không tải lên máy chủ HH/);
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
  assert.match(source, /Video xử lý trên thiết bị và không được gửi tới backend HH/i);
});

test("Character Lab exposes runtime metrics, motion preview and adaptive material controls", () => {
  const source = read("astral-realms.js");
  const css = read("astral-realms.css");
  for (const token of [
    "har-character-runtime-grid",
    "har-character-import",
    "har-motion-grid",
    "har-face-pilot",
    "characterQuality",
    "facialAnimation",
    "surfaceFx",
    "updateCharacterSurface",
    "updateCharacterLod"
  ]) {
    assert.ok(source.includes(token) || css.includes(token), `missing ${token}`);
  }
  assert.match(css, /Astral Realms Character V9/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("GLTF dependencies and the V11 bundle are available offline", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const token of ["astral-realms.css?v=17", "astral-realms.js?v=17"]) {
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
