const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms loads rigged PBR human and environment assets", () => {
  const source = read("astral-realms.js");
  for (const token of [
    "PHOTOREAL_ASSETS",
    "astral-realms-panorama-v1.webp",
    "BUILTIN_CHARACTER_ASSETS",
    "hh-human-asteria-v1.glb",
    "hh-human-vanguard-v1.glb",
    "loadPhotorealAssets",
    "loadBuiltInCharacterAssets",
    "createPhotorealCharacterModel",
    "SkinnedMesh",
    "MeshPhysicalMaterial",
    'visualStyle: "photoreal"'
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("photoreal assets are optimized for browser delivery", () => {
  const files = [
    "assets/astral-realms/astral-realms-panorama-v1.webp",
    "assets/astral-realms/astral-crew-atlas-v2.webp"
  ];
  for (const file of files) {
    const stat = fs.statSync(path.join(root, file));
    assert.ok(stat.size > 100_000, `${file} should contain a real visual asset`);
    assert.ok(stat.size < 1_000_000, `${file} should remain below 1 MB`);
  }
});

test("licensed realistic avatar catalog and environment models are integrated", () => {
  const source = read("astral-realms.js");
  const characterManifest = JSON.parse(read("assets/astral-realms/characters/manifest.json"));
  const avatarCatalog = JSON.parse(read("assets/astral-realms/characters/valid-avatars.json"));
  const localAvatars = [
    "valid-asian-f-1-casual.glb",
    "valid-asian-m-1-casual.glb",
    "valid-black-f-1-casual.glb",
    "valid-white-m-1-casual.glb"
  ];
  assert.equal(avatarCatalog.length, 210);
  assert.ok(characterManifest.sources.length >= 6);
  assert.equal(characterManifest.catalogs[0].license, "MIT");
  for (const file of localAvatars) {
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", "default", file));
    assert.ok(bytes.length > 1_500_000, `${file} should contain a full realistic avatar`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  }
  for (const file of ["boulder_01.glb", "grass_medium_01.glb", "rock_moss_set_01.glb", "shrub_01.glb", "dead_tree_trunk_02.glb", "fern_02.glb", "pine_roots_web.glb", "modular_fort_01_web.glb"]) {
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "environment", file));
    assert.ok(bytes.length > 100_000, `${file} should contain a real CC0 environment model`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  }
  assert.match(source, /data-genesis-catalog/);
  assert.match(source, /applyProceduralRigMotion/);
  assert.match(source, /characterPreview = "3d"|characterPreview = "validating"/);
});

test("visual V10 exposes adaptive 3D modes and UI portraits", () => {
  const source = read("astral-realms.js");
  const css = read("astral-realms.css");
  assert.match(source, /Human Rig \+ Mesh World PBR/);
  assert.match(source, /PBR 3D nhẹ/);
  assert.match(source, /3D hiệu năng/);
  assert.match(css, /Astral Realms Visual V7/);
  assert.match(css, /har-team-portrait/);
  assert.match(css, /har-character-card__avatar > i/);
  assert.match(css, /prefers-reduced-motion/);
});

test("runtime and offline cache request the V3 bundle", () => {
  const loader = read("performance-loader.js");
  const serviceWorker = read("sw.js");
  for (const token of ["astral-realms.css?v=71", "astral-realms.js?v=81"]) {
    assert.match(loader, new RegExp(token.replace(/[.?]/g, "\\$&")));
    assert.match(serviceWorker, new RegExp(token.replace(/[.?]/g, "\\$&")));
  }
  assert.match(serviceWorker, /assets\/astral-realms\/astral-realms-panorama-v1\.webp/);
  assert.match(serviceWorker, /assets\/astral-realms\/astral-crew-atlas-v2\.webp/);
});
