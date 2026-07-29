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

test("Genesis step 10 exposes an early completion dock for Character DNA V13 and Prologue", () => {
  const render = between("    renderGenesisCreator()", "    refreshGenesisCreator()");
  const dockAt = render.search(/data-genesis-action-dock/);
  const dnaSectionAt = render.search(/class="har-genesis-dna"/);
  assert.ok(dockAt >= 0, "step 10 needs a sticky completion/action dock");
  assert.ok(dnaSectionAt > dockAt, "completion dock must appear before the long DNA/history content");

  const dock = render.slice(dockAt, dnaSectionAt);
  assert.match(dock, /data-genesis-stage="dna"/);
  assert.match(dock, /data-genesis-action="confirm"/);
  assert.match(dock, /Hoàn tất\s*(?:&|và)\s*bắt đầu Prologue/i);
  assert.match(render, /Character DNA V13/);
  assert.match(dock, /aria-label|type="button"/);
});

test("post-game Character Creator exposes a sticky save-and-close dock with a real handler", () => {
  const creator = between("    renderCharacterCreatorPanel() {", "    renderWorldPanel() {");
  const css = read("astral-realms.css");
  const handlerStart = source.indexOf('else if (action === "appearance-finish")');
  const handlerEnd = source.indexOf('else if (action === "manual-save")', handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "missing appearance-finish handler boundary");
  const handler = source.slice(handlerStart, handlerEnd);
  const dnaAt = creator.indexOf('class="har-section har-character-dna"');
  const dockAt = creator.indexOf('data-appearance-action-dock');

  assert.ok(dnaAt >= 0 && dockAt > dnaAt, "finish dock must follow the DNA editor content");
  assert.match(creator, /class="har-creator__finish"[^>]*data-appearance-action-dock/);
  assert.match(creator, /data-panel-action="appearance-finish"/);
  assert.match(creator, /Lưu ngoại hình\s*&amp;\s*trở lại game/);
  assert.match(creator, /data-panel-action="appearance-save"/);
  assert.match(creator, /data-appearance-name/);
  assert.match(source, /data-har-panel-close[^>]*aria-label="Đóng bảng"/);
  assert.match(css, /\.har-creator__finish\s*\{[\s\S]{0,260}position:\s*sticky/);
  assert.match(handler, /creatorVersion\s*=\s*CHARACTER_VISUAL_VERSION/);
  assert.match(handler, /lastSavedAt\s*=\s*nowIso\(\)/);
  assert.match(handler, /await this\.saveProgress\(/);
  assert.match(handler, /this\.closePanel\(\)/);
  assert.match(handler, /this\.toast\(/);
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
