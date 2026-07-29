const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");

test("Story V2 migrates bounded truth metrics, interludes and companion beliefs", () => {
  assert.match(source, /const STORY_VERSION\s*=\s*2/);
  for (const [token, pattern] of [
    ["STORY_INTERLUDES", /STORY_INTERLUDES/],
    ["STORY_TESTIMONIES", /STORY_TESTIMONIES/],
    ["migrateStoryV2Metrics", /migrateStoryV2Metrics/],
    ["identityIntegrity", /identityIntegrity/],
    ["memoryDebt", /memoryDebt/],
    ["causalityPressure", /causalityPressure/],
    ["interludes", /interludes/],
    ["beliefs", /beliefs/],
    ["freeWill", /freeWill/],
    ["coreOrder", /coreOrder/],
    ["playerIsThreat", /playerIsThreat/],
    ["aionMayBeRight", /aionMayBeRight/],
    ["condition status", /storyCondition(?:Status|Met)/],
    ["storyInterludeStatus", /storyInterludeStatus/],
    ["storyTestimonyStatus", /storyTestimonyStatus/],
    ["apply story metrics", /applyStory(?:ChoiceMetrics|Metrics)/],
    ["apply companion beliefs", /applyCompanion(?:BeliefShift|Beliefs)/],
    ["refreshStoryInterludes", /refreshStoryInterludes/],
    ["view story interlude", /(?:viewStoryInterlude|markStoryInterludeViewed)/]
  ]) assert.match(source, pattern, `missing Story V2 contract ${token}`);

  const migrationStart = source.indexOf("function migrateStoryV2Metrics");
  assert.ok(migrationStart >= 0, "Story V2 needs a pure migration helper");
  const migrationEnd = source.indexOf("\n  function ", migrationStart + 10);
  const migration = source.slice(migrationStart, migrationEnd > migrationStart ? migrationEnd : migrationStart + 5000);
  for (const metric of ["identityIntegrity", "memoryDebt", "causalityPressure"]) {
    assert.match(
      migration,
      new RegExp(`${metric}[\\s\\S]{0,240}clamp\\([\\s\\S]{0,180},\\s*0,\\s*100\\)`),
      `${metric} must migrate into 0..100`
    );
  }
});

test("Story V2 exposes readable metrics, conflicting testimony and conditional interludes", () => {
  for (const label of [
    "STORY V2",
    "Toàn vẹn danh tính",
    "Nợ ký ức",
    "Áp lực nhân quả",
    "Interlude Revelations",
    "Lời khai mâu thuẫn",
    "Điều kiện mở"
  ]) assert.ok(source.includes(label), `missing Story V2 UI label ${label}`);
});

test("Story V2 recovers voice authorization and preserves cycle recognition", () => {
  assert.match(source, /voice-authorization/);
  assert.match(source, /voiceAuthorizationRecovered/);
  assert.match(source, /playerAuthorizedErasure/);
  assert.match(source, /aionRecognizesCycle/);
});
