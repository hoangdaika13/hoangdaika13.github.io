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

test("Character Genesis remains mandatory once per visual schema", () => {
  const start = between("    async startGame(", "    beginRuntimeSession(");
  assert.match(source, /data-har-genesis/);
  assert.match(start, /creatorVersion[\s\S]{0,100}CHARACTER_VISUAL_VERSION/);
  assert.match(start, /this\.openGenesisCreator\(\)/);
  assert.match(source, /creatorCompletedAt\s*=\s*nowIso\(\)/);
});

test("Genesis keeps all appearance controls but locks the base Hero", () => {
  const render = between("    renderGenesisCreator()", "    refreshGenesisCreator()");
  for (const token of ["data-genesis-name", "data-hero-prime-lock", "data-genesis-preset", "data-genesis-setting", "data-genesis-group", "data-genesis-morph", "data-genesis-motion", "data-genesis-action=\"confirm\""]) {
    assert.ok(render.includes(token), `missing Genesis control ${token}`);
  }
  assert.doesNotMatch(render, /data-genesis-base|data-genesis-catalog/);
  assert.match(source, /applyRiggedBodyProportions/);
  assert.match(source, /applyHeroArmIK/);
});

test("only the canonical Hero GLB is present and cached", () => {
  const worker = read("sw.js");
  const manifest = JSON.parse(read("assets/astral-realms/manifest.json"));
  assert.equal(manifest.heroOnly, true);
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].file, "characters/default/valid-asian-f-1-casual.glb");
  assert.match(worker, /characters\/default\/valid-asian-f-1-casual\.glb/);
  assert.match(source, /SkeletonUtils\.js/);
  assert.match(source, /cloneSkinnedCharacter/);
});

test("player never downgrades to proxy, crowd or impostor tiers", () => {
  const tiers = between("const CHARACTER_MODEL_TIERS", "const CHARACTER_ASSET_CLASSES");
  assert.match(tiers, /hero:/);
  assert.doesNotMatch(tiers, /\bnear\b|\bcrowd\b|\bimpostor\b/);
  assert.doesNotMatch(source, /data-genesis-fallback-character/);
  const compatibility = between("    applyCompatibilityProfile(", "    async startGame(");
  assert.match(compatibility, /characterQuality\s*=\s*"hero"/);
  assert.doesNotMatch(compatibility, /characterQuality\s*=\s*"near"/);
});

test("Genesis camera contains the full dynamic Hero silhouette", () => {
  assert.match(source, /horizontalFov/);
  assert.match(source, /safeHalfWidth/);
  assert.match(source, /fullyContained/);
  assert.match(source, /aspectChanged/);
  assert.match(source, /genesisAttachmentVisibility/);
});
