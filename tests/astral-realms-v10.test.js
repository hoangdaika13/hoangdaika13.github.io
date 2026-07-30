const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");

function between(startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing ${endToken}`);
  return source.slice(start, end);
}

test("Character Genesis is mandatory once per visual schema and persists completion", () => {
  const start = between("    async startGame(", "    resetGraphicsAfterFailure()");
  assert.match(source, /data-har-genesis/);
  assert.match(source, /renderGenesisCreator/);
  assert.match(source, /openGenesisCreator/);
  assert.match(source, /completeGenesisCreator/);
  assert.match(start, /!this\.state\.appearance\.creatorCompletedAt/);
  assert.match(start, /creatorVersion[\s\S]{0,100}CHARACTER_VISUAL_VERSION/);
  assert.match(start, /this\.openGenesisCreator\(\)/);
  assert.match(source, /creatorCompletedAt\s*=\s*nowIso\(\)/);
  assert.match(source, /creatorVersion\s*=\s*CHARACTER_VISUAL_VERSION/);
  assert.match(source, /Hoàn tất Character Genesis/);
});

test("Genesis exposes full-body appearance controls and live 3D motion preview", () => {
  const render = between("    renderGenesisCreator()", "    refreshGenesisCreator()");
  for (const token of [
    "data-genesis-name",
    "data-genesis-base",
    "data-genesis-preset",
    "data-genesis-setting",
    "data-genesis-group",
    "data-genesis-morph",
    "data-genesis-motion",
    "data-genesis-action=\"confirm\""
  ]) assert.ok(render.includes(token), `missing Genesis control ${token}`);
  assert.match(source, /applyRiggedBodyProportions/);
  assert.match(source, /setGenesisMotion/);
  assert.match(source, /rebuildActiveBuiltInCharacter/);
  assert.match(source, /runtime\.mixer\.update\(dt\)/);
});

test("built-in heroes are actual rigged GLB assets with shared animation", () => {
  const worker = read("sw.js");
  const manifest = read("assets/astral-realms/manifest.json");
  for (const file of ["hh-human-asteria-v1.glb", "hh-human-vanguard-v1.glb"]) {
    const fullPath = path.join(root, "assets", "astral-realms", file);
    const bytes = fs.readFileSync(fullPath);
    assert.ok(bytes.length > 1_000_000, `${file} must be a real model`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
    assert.ok(worker.includes(file), `offline cache missing ${file}`);
    assert.ok(manifest.includes(file), `manifest missing ${file}`);
  }
  assert.match(source, /SkeletonUtils\.js/);
  assert.match(source, /cloneSkinnedCharacter/);
  assert.match(source, /"builtin-rigged"/);
  assert.match(source, /"procedural-3d-recovery"/);
  assert.match(source, /builtInAnimations/);
  assert.match(source, /AnimationMixer/);
});

test("characters never downgrade to a flat image in the 3D world", () => {
  assert.doesNotMatch(source, /createCharacterImpostor|isCharacterImpostor/);
  assert.match(source, /HHHuman3DProxy/);
  assert.match(source, /Imported3DProxy/);
  assert.match(source, /isCharacterLodProxy\s*=\s*true/);
});

test("the visible environment is mesh terrain and the panorama is IBL only", () => {
  const world = between("    createWorld()", "    createToonGradient()");
  assert.match(world, /const environmentMap = this\.photorealAssets\.hdrEnvironment \|\| this\.photorealAssets\.panorama/);
  assert.match(world, /scene\.environment\s*=\s*environmentMap/);
  assert.doesNotMatch(world, /scene\.background\s*=\s*(environmentMap|this\.photorealAssets\.(hdrEnvironment|panorama))/);
  assert.match(world, /new THREE\.PlaneGeometry\(376,\s*376/);
  assert.match(world, /positions\.setZ/);
  assert.match(world, /terrainGeometry\.computeVertexNormals\(\)/);
  assert.match(world, /MeshPhysicalMaterial/);
  assert.match(source, /Địa hình mesh 3D và panorama chỉ dùng làm IBL/);
});

test("Character V13 supersedes V12 with updated route, offline cache and responsive UI", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("astral-realms.css");
  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*13/);
  for (const asset of ["astral-realms.css?v=71", "astral-realms.js?v=72"]) {
    assert.ok(loader.includes(asset));
    assert.ok(worker.includes(asset));
  }
  assert.match(worker, /hh-identity-portal-v358/);
  assert.match(index, /performance-loader\.js\?v=113/);
  assert.match(css, /Astral Realms Character V13/);
  assert.match(css, /\.har-genesis/);
  assert.match(css, /max-width: 720px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
