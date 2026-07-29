const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms V2 ships a four-character anime action roster", () => {
  const source = read("astral-realms.js");
  assert.match(source, /const CHARACTERS = Object\.freeze/);
  for (const id of ["lyra", "cael", "nyx", "sol"]) {
    assert.match(source, new RegExp(`\\b${id}:\\s*\\{`));
  }
  assert.match(source, /switchCharacter\(/);
  assert.match(source, /createAnimeCharacterMesh\(/);
  assert.match(source, /MeshToonMaterial/);
  assert.match(source, /faceShadow/);
  assert.match(source, /updateCharacterAnimation\(/);
});

test("the renderer has a real WebGPU feature flag and WebGL fallback", () => {
  const source = read("astral-realms.js");
  const worker = read("sw.js");
  assert.match(source, /vendor\/three\.webgpu\.min\.js/);
  assert.match(source, /new THREE\.WebGPURenderer/);
  assert.match(source, /new THREE\.WebGLRenderer/);
  assert.match(source, /rendererBackend/);
  assert.ok(worker.includes("vendor/three.webgpu.min.js"));
  assert.ok(fs.existsSync(path.join(root, "vendor/three.webgpu.min.js")));
});

test("the open world V2 includes authored-style environment systems and LOD", () => {
  const source = read("astral-realms.js");
  for (const token of [
    "createAtmosphere",
    "createWater",
    "createInstancedNature",
    "InstancedMesh",
    "createElementalPuzzles",
    "updateWorldStreaming",
    "dynamicResolution",
    "updateCinematicCamera"
  ]) {
    assert.ok(source.includes(token), `Missing V2 world contract: ${token}`);
  }
  assert.match(source, /bossPhase/);
  assert.match(source, /weakPoint/);
});

test("Photo Mode and cinematic graphics settings create real output controls", () => {
  const source = read("astral-realms.js");
  const css = read("astral-realms.css");
  assert.match(source, /togglePhotoMode\(/);
  assert.match(source, /capturePhoto\(/);
  assert.match(source, /canvas\.toBlob/);
  assert.match(source, /data-har-photo/);
  assert.match(source, /option value="cinematic"/);
  assert.match(css, /\.har-photo/);
  assert.match(css, /\.har-shell\.is-photo-mode/);
});

test("V2 assets are versioned in the route loader and offline cache", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const asset of ["astral-realms.css?v=22", "astral-realms.js?v=22"]) {
    assert.ok(loader.includes(asset), `loader missing ${asset}`);
    assert.ok(worker.includes(asset), `worker missing ${asset}`);
  }
});
