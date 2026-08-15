const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");

function between(startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing ${endToken}`);
  return source.slice(start, end);
}

test("Nexus Echo is one causal eight-chapter canon", () => {
  const archive = between("  const ASTRAL_CINEMATICS", "  const BIOME_PROFILES");
  assert.equal((archive.match(/requiredEvent:/g) || []).length, 8);
  for (const fact of [
    "Con quái vật gọi tên tôi",
    "Thành phố không có bóng",
    "Bốn lời khai",
    "Vũ khí biết khóc",
    "Cuộc chiến H-Central",
    "Hành tinh ngày mai đã chết",
    "Người săn cuối cùng",
    "Kho Lưu Trữ Sống"
  ]) assert.ok(archive.includes(fact), `missing canonical fact: ${fact}`);
  assert.doesNotMatch(archive, /mọi lựa chọn|chọn phe|nhiều kết thúc/i);
});

test("canonical save removes branching history and migrates deterministically", () => {
  const defaults = between("  function defaultWorldState()", "  function defaultState()");
  const normalization = between("  function normalizeState(input)", "  class AstralSaveStore");
  assert.match(defaults, /canonVersion: STORY_CANON_VERSION/);
  assert.match(defaults, /chapter: 1/);
  assert.match(defaults, /step: "cinematic"/);
  assert.match(defaults, /completedEvents: \[\]/);
  assert.doesNotMatch(source, /choiceHistory\s*:/);
  assert.match(normalization, /key !== "choiceHistory"/);
  assert.match(source, /recordStoryEvent\(`chapter:\$\{chapterNumber\}:complete`\)/);
});

test("future chapters and travel are locked by canonical progress", () => {
  assert.match(source, /isStoryChapterUnlocked\(chapterId\)/);
  assert.match(source, /button\.disabled = locked/);
  assert.match(source, /cinematic\.chapter > storyChapter/);
  assert.match(source, /Chương cũ chỉ dùng để xem lại/);
  assert.match(source, /if \(!this\.isStoryChapterUnlocked\(checkpoint\)\)/);
  assert.match(css, /button\.is-locked/);
  assert.match(css, /button:disabled/);
});

test("cinematics render in an isolated scene and validate the hero before playback", () => {
  const scene = between("    createCinematicScene()", "    openCinematicGallery(");
  assert.match(scene, /new THREE\.Scene\(\)/);
  assert.match(scene, /NexusEchoCinematicScene/);
  assert.match(scene, /waitingForSubject/);
  assert.match(scene, /validSubjectFrames < 2/);
  assert.match(scene, /triangles >= 500/);
  assert.match(scene, /frustum\.intersectsBox/);
  assert.match(scene, /projectedPixels/);
  assert.match(source, /const renderScene = this\.cinematicSequence\.active && this\.cinematicScene \? this\.cinematicScene : this\.scene/);
  assert.doesNotMatch(source, /group\.visible = zoneId === zone\.id \|\| zoneId === "central"/);
});

test("adaptive quality uses hysteresis, fixed scales and cached world work", () => {
  const fps = between("    applyAdaptiveQualityTier(tier)", "    resize()");
  assert.match(source, /RENDER_SCALE_STEPS = Object\.freeze\(\[1, 0\.85, 0\.7, 0\.6\]\)/);
  assert.match(fps, /this\.fpsEma \* 0\.82/);
  assert.match(fps, /this\.lowFpsWindows >= 3/);
  assert.match(fps, /this\.highFpsWindows >= 10/);
  assert.match(fps, />= 10000/);
  const streaming = between("    indexWorldRuntimeObjects()", "    updateWeatherAppearance()");
  assert.match(streaming, /shadowCastersByZone/);
  assert.doesNotMatch(streaming, /this\.world\.traverse\(\(object\) => \{[\s\S]*distance < shadowRadius/);
  assert.match(source, /gpuShader\.uniforms\.hhWeatherTime/);
});
