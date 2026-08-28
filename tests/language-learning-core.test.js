const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = require(path.join(root, "language-learning-core.js"));
const source = fs.readFileSync(path.join(root, "language-learning-core.js"), "utf8");

test("shared language core uses the device calendar instead of UTC", () => {
  assert.equal(core.localDay(new Date(2026, 7, 27, 0, 5, 0)), "2026-08-27");
  assert.equal(core.dayDistance("2026-08-27", "2026-08-28"), 1);
});

test("completion requires real interaction evidence and XP is idempotent", () => {
  core.clearProfile("english", "learner-a");
  assert.throws(() => core.recordEvidence("english", "learner-a", {
    activityId: "lesson-a1-1", evidenceId: "page-open", kind: "open", completed: true, score: 1, interactions: 1, durationSeconds: 20
  }), /interaction kind/);

  const incomplete = core.recordEvidence("english", "learner-a", {
    activityId: "lesson-a1-1", evidenceId: "attempt-1", kind: "lesson", completed: true, score: .9, interactions: 0, durationSeconds: 20, xp: 25
  });
  assert.equal(incomplete.completed, false);
  assert.equal(incomplete.profile.xp, 0);

  const completed = core.recordEvidence("english", "learner-a", {
    activityId: "lesson-a1-1", evidenceId: "attempt-2", kind: "quiz", completed: true, score: .9, interactions: 8, durationSeconds: 45, xp: 25
  });
  assert.equal(completed.completed, true);
  assert.equal(completed.profile.xp, 25);
  assert.equal(completed.profile.streak, 1);

  const duplicate = core.recordEvidence("english", "learner-a", {
    activityId: "lesson-a1-1", evidenceId: "attempt-2", kind: "quiz", completed: true, score: 1, interactions: 8, durationSeconds: 45, xp: 500
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.profile.xp, 25);
});

test("profiles remain isolated by language and learner", () => {
  core.clearProfile("japanese", "learner-a");
  core.clearProfile("chinese", "learner-b");
  core.recordEvidence("japanese", "learner-a", {
    activityId: "kana-1", evidenceId: "jp-1", kind: "review", completed: true, score: 1, interactions: 5, durationSeconds: 15
  });
  assert.equal(core.readProfile("japanese", "learner-a").xp, 10);
  assert.equal(core.readProfile("chinese", "learner-b").xp, 0);
});

test("bounded SRS scheduling returns due cards deterministically", () => {
  core.clearProfile("chinese", "srs-user");
  const start = new Date(2026, 7, 27, 12, 0, 0);
  const review = core.reviewCard("chinese", "srs-user", "hsk-hao", "good", start);
  assert.equal(review.interval, 1);
  assert.equal(review.due, "2026-08-28");
  assert.equal(core.dueCards("chinese", "srs-user", start).length, 0);
  assert.equal(core.dueCards("chinese", "srs-user", new Date(2026, 7, 28, 12, 0, 0))[0].cardId, "hsk-hao");
});

test("portable profiles and checkpoints are scoped and validated", () => {
  core.clearProfile("english", "portable");
  core.recordEvidence("english", "portable", {
    activityId: "reader-1", evidenceId: "read-1", kind: "read", completed: true, score: .8, interactions: 3, durationSeconds: 90
  });
  const checkpoint = core.createCheckpoint("english", "portable");
  assert.match(checkpoint.id, /^cp-/);
  const payload = core.exportProfile("english", "portable");
  assert.equal(payload.kind, "hh-language-learning-profile");
  assert.throws(() => core.importProfile("japanese", "portable", payload), /scope/);
  assert.equal(core.importProfile("english", "portable", JSON.stringify(payload)).xp, 10);
  assert.equal(core.restoreCheckpoint("english", "portable", checkpoint.id).xp, 10);
});

test("legacy completion and review queue data migrate into schema v2", () => {
  const migrated = core.migrateProfile({
    schemaVersion: 0,
    completed: ["kana-01"],
    lastActiveDay: "2026-08-26",
    reviewQueue: [{ id: "kana-a", reps: 2, interval: 3, ease: 2.4, due: "2026-08-29", rating: "good" }]
  }, "japanese", "legacy-user");
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.completedActivities["kana-01"].evidenceId, "migration-kana-01");
  assert.equal(migrated.reviews["kana-a"].repetitions, 2);
  assert.equal(migrated.reviews["kana-a"].lastRating, "good");
  const hostile = core.migrateProfile({ completed: { __proto__: true, constructor: true } }, "japanese", "legacy-user");
  assert.equal(Object.hasOwn(hostile.completedActivities, "constructor"), false);
});

test("large learning content is IndexedDB-backed, bounded and secret-safe", async () => {
  assert.match(source, /indexedDB\.open\(DATABASE_NAME/);
  assert.match(source, /8 \* 1024 \* 1024/);
  assert.match(source, /password\|passphrase\|secret\|token\|api/);
  await assert.rejects(() => core.putLarge("english", "learner", "pack", "unsafe", { apiKey: "never-store-me" }), /Sensitive fields/);
  const result = await core.putLarge("english", "learner", "pack", "safe", { units: ["a1", "a2"] });
  assert.deepEqual(result, { persisted: false, fallback: "memory" });
  assert.deepEqual(await core.getLarge("english", "learner", "pack", "safe"), { units: ["a1", "a2"] });
  assert.equal(await core.deleteLarge("english", "learner", "pack", "safe"), false);
});
