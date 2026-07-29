const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");

function between(text, startToken, endToken) {
  const start = text.indexOf(startToken);
  assert.ok(start >= 0, `missing start token ${startToken}`);
  const end = text.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `missing end token ${endToken}`);
  return text.slice(start, end);
}

function objectAfter(text, token) {
  const declaration = text.indexOf(token);
  assert.ok(declaration >= 0, `missing object ${token}`);
  const start = text.indexOf("{", declaration + token.length);
  assert.ok(start >= 0, `missing opening brace for ${token}`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  assert.fail(`missing closing brace for ${token}`);
}

function numericField(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`\\b${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
    if (match) return Number(match[1]);
  }
  return Number.NaN;
}

test("Ultra Photoreal has one explicit immutable profile", () => {
  assert.match(source, /const ULTRA_PHOTOREAL_VERSION\s*=\s*\d+/);
  assert.match(source, /const ULTRA_PHOTOREAL_PROFILE\s*=\s*Object\.freeze\(\{/);
  const profile = objectAfter(source, "const ULTRA_PHOTOREAL_PROFILE");
  assert.match(profile, /\bquality:\s*"cinematic"/);
  assert.match(profile, /\bvfxLevel:\s*"cinematic"/);
  assert.match(profile, /\bdynamicResolution:\s*false/);
  assert.match(profile, /\bvisualStyle:\s*"photoreal"/);

  assert.equal(numericField(profile, ["shadowMapSize", "shadowResolution"]), 4096);
  assert.equal(numericField(profile, ["maxPixelRatio", "pixelRatioCap", "nativePixelRatioCap"]), 2);
  assert.ok(numericField(profile, ["minimumExposure", "minExposure", "exposure"]) >= 1.1, "Ultra exposure must remain bright");
  assert.ok(numericField(profile, ["proceduralTextureSize", "detailTextureSize", "textureSize"]) >= 256, "procedural detail textures must be at least 256px");
  assert.ok(numericField(profile, ["hairCardCount", "hairCards"]) >= 32, "the Hero needs at least 32 hair cards");
});

test("default and normalized saves cannot downgrade the single Ultra profile", () => {
  const defaults = between(source, "  function defaultState()", "  function normalizeState(");
  const settings = between(defaults, "      settings: {", "      stats: {");
  for (const [name, pattern] of [
    ["cinematic quality", /quality:\s*(?:"cinematic"|ULTRA_PHOTOREAL_PROFILE\.quality)/],
    ["cinematic VFX", /vfxLevel:\s*(?:"cinematic"|ULTRA_PHOTOREAL_PROFILE\.vfxLevel)/],
    ["native resolution", /dynamicResolution:\s*(?:false|ULTRA_PHOTOREAL_PROFILE\.dynamicResolution)/],
    ["photoreal materials", /visualStyle:\s*(?:"photoreal"|ULTRA_PHOTOREAL_PROFILE\.visualStyle)/]
  ]) assert.match(settings, pattern, `default settings do not lock ${name}`);

  const normalize = between(source, "  function normalizeState(input)", "  class AstralSaveStore");
  for (const [key, value] of [
    ["quality", '"cinematic"'],
    ["vfxLevel", '"cinematic"'],
    ["dynamicResolution", "false"],
    ["visualStyle", '"photoreal"']
  ]) {
    const direct = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      normalize,
      new RegExp(`state\\.settings\\.${key}\\s*=\\s*(?:${direct}|ULTRA_PHOTOREAL_PROFILE\\.${key})`),
      `normalizeState must lock ${key}`
    );
  }
});

test("renderer keeps native pixels, soft 4K shadows and a bright ACES exposure", () => {
  const setup = between(source, "    async setupRenderer()", "    createTerrainTexture()");
  const world = between(source, "    createWorld()", "    createToonGradient()");
  const resize = between(source, "    resize()", "    openPanel(");
  assert.match(setup, /this\.renderer\.shadowMap\.type\s*=\s*THREE\.PCFShadowMap/);
  assert.match(setup, /toneMappingExposure[^;]*(?:ULTRA_PHOTOREAL_PROFILE\.(?:minimumExposure|minExposure|exposure)|Math\.max)/);
  assert.match(world, /const shadowSize\s*=\s*(?:ULTRA_PHOTOREAL_PROFILE\.(?:shadowMapSize|shadowResolution)|4096)/);
  assert.match(world, /shadow\.mapSize\.set\(shadowSize,\s*shadowSize\)/);
  assert.match(resize, /(?:cinematic:\s*1|setPixelRatio\(Math\.min\(ULTRA_PHOTOREAL_PROFILE\.(?:maxPixelRatio|pixelRatioCap|nativePixelRatioCap),\s*root\.devicePixelRatio \|\| 1\)\))/);
  assert.match(resize, /setPixelRatio\(Math\.min\((?:2|ULTRA_PHOTOREAL_PROFILE\.(?:maxPixelRatio|pixelRatioCap|nativePixelRatioCap)),\s*\(?root\.devicePixelRatio \|\| 1\)?(?: \* ratio)?\)\)/);
});

test("procedural skin and Hero hair actually consume the Ultra profile", () => {
  const texture = between(source, "    createCharacterDetailTexture(", "    createAnimeCharacterMesh(");
  const profile = objectAfter(source, "const ULTRA_PHOTOREAL_PROFILE");
  const requiredTextureSize = numericField(profile, ["proceduralTextureSize", "detailTextureSize", "textureSize"]);
  const requiredHairCards = numericField(profile, ["hairCardCount", "hairCards"]);
  assert.ok(requiredTextureSize >= 256);
  assert.ok(requiredHairCards >= 32);

  const textureUsesProfile = /const size\s*=\s*ULTRA_PHOTOREAL_PROFILE\.(?:proceduralTextureSize|detailTextureSize|textureSize)/.test(texture);
  const literalTextureSize = Number(texture.match(/const size\s*=\s*(\d+)/)?.[1] || 0);
  assert.ok(textureUsesProfile || literalTextureSize >= 256, "character detail texture still renders below 256px");

  const hairUsesProfile = /ULTRA_PHOTOREAL_PROFILE\.(?:hairCardCount|hairCards)/.test(source);
  const literalHairCounts = [...source.matchAll(/for \(let index = 0; index < (\d+); index \+= 1\)[\s\S]{0,900}?materialRole:\s*"hair-card"/g)]
    .map((match) => Number(match[1]));
  assert.ok(hairUsesProfile || literalHairCounts.some((count) => count >= 32), "Hero runtime still builds fewer than 32 hair cards");
});

test("a three-point character lighting rig follows the active player", () => {
  assert.match(source, /(?:characterLightingRig|characterLightRig|heroLightRig)/);
  for (const role of ["Key", "Fill", "Rim"]) {
    assert.match(
      source,
      new RegExp(`(?:character${role}Light|UltraHero${role}|(?:characterLightingRig|characterLightRig|heroLights)\\.${role.toLowerCase()})`),
      `missing character ${role.toLowerCase()} light`
    );
  }
  const follow = source.match(/(?:this\.(?:heroLightRig|characterLightRig|characterLightingRig)\.position\.(?:(?:copy|lerp|set)\(|[xyz]\s*\+=)|update(?:Character|Hero)(?:Lighting|Light)Rig\s*\()/);
  assert.ok(follow, "missing runtime follow logic for the character light rig");
  const update = source.slice(Math.max(0, follow.index - 900), follow.index + 4200);
  assert.match(update, /(?:this\.playerMesh|this\.state\.player)/);
  assert.match(update, /(?:getWorldPosition|\.position\.(?:(?:copy|lerp|set)\(|[xyz]\s*\+=))/);
});

test("Hero lighting is finite and the combined body atlas stays opaque", () => {
  const world = between(source, "    createWorld()", "    createToonGradient()");
  for (const role of ["heroKey", "heroFill", "heroRim"]) {
    assert.match(world, new RegExp(`const ${role}\\s*=\\s*new THREE\\.SpotLight\\(`));
  }
  const rigged = between(source, "    createBuiltInRiggedCharacter(", "    createPhotorealCharacterModel(");
  assert.match(rigged, /"hybrid-body"/);
  assert.match(rigged, /transmission:\s*role === "skin" \? 0\.012 : 0/);
  assert.match(rigged, /side:\s*THREE\.FrontSide/);
  const materialPass = between(source, "    applyDigitalHumanMaterials(", "    applyAppearanceToMesh(");
  const hybrid = between(materialPass, 'role === "hybrid-body"', 'role === "hair"');
  assert.match(hybrid, /hhOriginalColor/);
  assert.match(hybrid, /material\.transmission = 0/);
  assert.match(hybrid, /material\.thickness = 0/);
});

test("Ultra startup gates 4K GPU limits and prewarms the Genesis scene", () => {
  const setup = between(source, "    async setupRenderer()", "    async prewarmUltraRenderer()");
  assert.match(setup, /capabilities\?\.maxTextureSize/);
  assert.match(setup, /ultraTextureLimit[^;]+ULTRA_PHOTOREAL_PROFILE\.shadowMapSize/);
  const genesis = between(source, "    setupGenesisPreview()", "    teardownGenesisPreview(");
  assert.match(genesis, /key\.shadow\.mapSize\.set\(ULTRA_PHOTOREAL_PROFILE\.shadowMapSize/);
  assert.match(genesis, /this\.prewarmGenesisRenderer\(\)/);
  assert.match(source, /prewarmGenesisRenderer\(\)[\s\S]{0,900}?compileAsync/);
  const frame = between(source, "    renderGenesisFrame(", "    buildAppearanceFitReport(");
  assert.match(frame, /measuredWidth < 32[\s\S]{0,220}?return false/);
});

test("Hero and NPC spawns cannot intersect the raised HH Core pedestal", () => {
  const defaults = between(source, "  function defaultState()", "  function normalizeState(");
  assert.match(defaults, /x:\s*0,[\s\S]{0,60}?z:\s*10\.5/);
  const stateToWorld = between(source, "    applyStateToWorld()", "    refreshWorldStateVisuals()");
  assert.match(stateToWorld, /coreDistance < 8\.8/);
  assert.match(stateToWorld, /player\.z = Math\.sin\(angle\) \* 10\.6/);
  const movement = between(source, "    updatePlayer(dt, time)", "    updateEnemies(dt, time)");
  assert.match(movement, /coreDistance < 8\.8[\s\S]{0,260}?nextZ = Math\.sin\(angle\) \* 8\.8/);
  assert.match(source, /createNpc\("luma",\s*"Navigator Luma",\s*-9\.5,\s*5\.8/);
  assert.match(source, /gameplayVisualLift:\s*0\.03/);
  assert.match(source, /clearUltraCentralLane\(zoneId, x, z, seed = 0\)/);
  assert.match(source, /inSpawnLane[\s\S]{0,220}?nearNavigator/);
  assert.match(source, /new THREE\.IcosahedronGeometry\(0\.72, 2\)/);
});

test("Hero QA recognizes the canonical combined surface and native expression bank", () => {
  const qa = between(source, "    buildCharacterQaReport(", "    registerCharacterRuntime(");
  assert.match(qa, /head\|face\|skin_head\|dermis\|highres/);
  assert.match(qa, /nativeExpressionTargets/);
  assert.match(qa, /HERO_ASSET_REQUIREMENTS\.nativeFaceMorphs/);
  assert.match(qa, /physicalMaterials/);
  assert.match(qa, /materialRoles\.some\(\(role\) => role === "hair" \|\| role === "hair-card"\)/);
  assert.match(source, /heroLightRig\.position\.y\s*\+=/);
});

test("World Art V4 raises the cinematic scene budget and environment density", () => {
  assert.match(source, /const WORLD_ART_VERSION\s*=\s*4/);
  const budgets = objectAfter(source, "const WORLD_ART_BUDGETS");
  const cinematic = objectAfter(budgets, "cinematic: Object.freeze(");
  assert.ok(numericField(cinematic, ["vistaInstances"]) > 16);
  assert.ok(numericField(cinematic, ["localParticles"]) > 48);
  assert.ok(numericField(cinematic, ["activeRadius"]) > 112);
  assert.ok(numericField(cinematic, ["shadowRadius"]) > 62);
  assert.ok(numericField(cinematic, ["skyUpdateMs"]) <= 48);
  const staticBudget = objectAfter(budgets, "static: Object.freeze(");
  assert.equal(numericField(staticBudget, ["activeRadius"]), numericField(cinematic, ["activeRadius"]), "reduced motion must not swap to a weaker geometry tier");

  const defaults = between(source, "  function defaultState()", "  function normalizeState(");
  const weatherDensity = Number(defaults.match(/weatherDensity:\s*(\d+)/)?.[1] || 0);
  assert.ok(weatherDensity > 80, "Ultra weather density must be higher than World Art V3");
  const nature = between(source, "    createInstancedNature()", "    createLicensedEnvironmentDecor()");
  const profileDensity = /ULTRA_PHOTOREAL_PROFILE\.(?:worldDensity|worldDensityMultiplier|natureDensity)/.test(nature);
  const cinematicDensity = Number(nature.match(/quality === "cinematic" \? (\d+(?:\.\d+)?)/)?.[1] || 0);
  assert.ok(profileDensity || cinematicDensity > 1.25, "cinematic nature density was not raised above World Art V3");
});

test("Ultra World Art CSS is brighter, lightly vignetted and motion-safe", () => {
  assert.match(css, /\[data-world-art="v4"\]/);
  const ultraStart = css.indexOf("Astral Realms Ultra Photoreal V4");
  assert.ok(ultraStart >= 0, "missing the Ultra Photoreal V4 CSS layer");
  const ultraCss = css.slice(ultraStart);
  const brightness = Number(ultraCss.match(/--har-v4-brightness:\s*(\d+(?:\.\d+)?)/)?.[1] || 0);
  assert.ok(brightness >= 1.03, "Ultra post-processing must brighten rather than crush the scene");
  assert.match(ultraCss, /brightness\(var\(--har-v4-brightness\)\)/);
  assert.match(ultraCss, /radial-gradient\(/);
  const vignetteAlphas = [...ultraCss.matchAll(/rgba\([^)]*,\s*(\.?\d+)\)/g)].map((match) => Number(match[1]));
  assert.ok(vignetteAlphas.some((alpha) => alpha > 0 && alpha <= 0.3), "Ultra vignette must remain light");
  assert.match(ultraCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/);
});
