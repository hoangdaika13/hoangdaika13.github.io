const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");

test("cinematic panorama V2 is bundled and used by the realtime sky dome", () => {
  const panorama = path.join(root, "assets", "astral-realms", "environment", "astral-cinematic-panorama-v2.png");
  assert.ok(fs.existsSync(panorama));
  assert.ok(fs.statSync(panorama).size > 2_000_000);
  assert.match(source, /astral-cinematic-panorama-v2\.png/);
});

test("film pipeline provides bloom, grade, vignette, grain and chromatic response", () => {
  for (const token of [
    "setupCinematicPostProcessing",
    "renderCinematicFrame",
    "AstralCinematicFilmPipeline",
    "uBloomStrength",
    "uGradeMix",
    "uGrainStrength",
    "hhFilmLuminance",
    "chroma",
    "vignette",
    "filmNoise"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /new THREE\.WebGLRenderTarget/);
  assert.match(source, /this\.renderCinematicFrame\(renderScene, this\.camera, time\)/);
  assert.match(source, /disposeCinematicPostProcessing\(\)/);
  assert.doesNotMatch(source, /float luminance\(vec3 color\)/);
});

test("ultra profile increases real geometry, shadows and pixel density", () => {
  assert.match(source, /quality === "cinematic" \? 4096/);
  assert.match(source, /quality === "cinematic" \? 256/);
  assert.match(source, /quality === "cinematic" \? 16 : 8/);
  assert.match(source, /quality === "cinematic" \? 2\.5 : 2/);
  assert.match(source, /shadowMap\.type = THREE\.PCFShadowMap/);
});

test("cinematic atmosphere has volumetric beams, fog banks and hero contact shadow", () => {
  for (const token of [
    "createCinematicAtmosphere",
    "updateCinematicAtmosphere",
    "AstralCinematicVolumetricAtmosphere",
    "AstralVolumetricFogBank",
    "AstralHeroContactShadow",
    "disposeCinematicAtmosphere"
  ]) assert.ok(source.includes(token), `missing ${token}`);
});

test("every real character receives film skin, cornea, hair and portrait lighting", () => {
  for (const token of [
    "enhanceCharacterMaterialForCinema",
    "hhSkinScatterColor",
    "hhSkinScatterStrength",
    "hhCharacterRimStrength",
    "hhEyeFresnelStrength",
    "hh-character-film-v1",
    "AstralCharacterCinematicLightRig",
    "AstralCharacterPortraitKey",
    "AstralCharacterPortraitFill",
    "AstralCharacterPortraitRim"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /this\.enhanceCharacterMaterialForCinema\(material, role, recipe, profile\)/);
  assert.match(source, /material\.anisotropy = cinematic \? 0\.92 : 0\.74/);
  assert.match(source, /material\.clearcoatRoughness = 0\.018/);
  assert.match(source, /this\.applyDigitalHumanMaterials\(mesh, recipe, id\)/);
});

test("cinematic setting applies the complete quality bundle and restrained overlay", () => {
  assert.match(source, /Điện ảnh Ultra · nặng nhất/);
  assert.match(source, /Bloom · color grade · grain/);
  assert.match(source, /renderStyle: "cinematic"/);
  assert.match(source, /characterQuality: "hero"/);
  assert.match(source, /digitalHumanQuality: "cinematic"/);
  assert.match(source, /dynamicResolution: false/);
  assert.match(source, /this\.state\.settings = \{ \.\.\.this\.state\.settings, \.\.\.preferredSettings \}/);
  assert.match(css, /har-film-anamorphic-drift/);
  assert.match(css, /is-film-ultra/);
});
