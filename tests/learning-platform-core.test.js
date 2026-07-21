const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../learning-platform-core.js");

test("Learning Core exposes complete level, skill and career catalogs", () => {
  assert.deepEqual(core.levels, ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
  assert.equal(core.skills.length, 7);
  assert.ok(core.tracks.length >= 16);
  assert.ok(core.lessons.length >= core.tracks.length * core.levels.length);
});

test("state normalization bounds untrusted profile and preserves one mastery graph", () => {
  const state = core.normalizeState({ profile: { level: "Z9", dailyMinutes: 9999, career: "unknown", focusSkills: ["speaking", "bad"] }, mastery: { speaking: { attempts: 4, correct: 3, score: 82 } } });
  assert.equal(state.profile.level, "A0");
  assert.equal(state.profile.dailyMinutes, 120);
  assert.deepEqual(state.profile.focusSkills, ["speaking"]);
  assert.equal(Object.keys(state.mastery).length, core.skills.length);
  assert.equal(state.mastery.speaking.accuracy, 75);
});

test("daily plan always returns continue, review, test, goals and weak skills", () => {
  const state = core.defaultState();
  state.reviews.push({ id: "r1", prompt: "hello", answer: "xin chào", dueAt: new Date(0).toISOString(), skillId: "vocabulary", trackId: "communication" });
  const plan = core.buildDailyPlan(state);
  assert.ok(plan.continueLesson);
  assert.equal(plan.reviewsDue.length, 1);
  assert.equal(plan.quickTest.questions, 5);
  assert.equal(plan.goal.targetMinutes, 15);
  assert.equal(plan.weakSkills.length, 3);
});

test("adaptive review scheduling responds to all four ratings", () => {
  const card = { intervalDays: 4, stability: 3, difficulty: 3, lapses: 0 };
  const again = core.scheduleReview(card, "again", 0, 90);
  const hard = core.scheduleReview(card, "hard", 0, 90);
  const good = core.scheduleReview(card, "good", 0, 90);
  const easy = core.scheduleReview(card, "easy", 0, 90);
  assert.equal(again.intervalDays, 0);
  assert.ok(hard.intervalDays < good.intervalDays);
  assert.ok(good.intervalDays < easy.intervalDays);
  assert.equal(again.lapses, 1);
});

test("study records update streak, daily goal, mastery and lesson progress", () => {
  const state = core.recordStudy(core.defaultState(0), { type: "lesson", lessonId: "communication-a0-01", minutes: 8, score: 90, xp: 25, skills: ["speaking"] }, Date.UTC(2026, 6, 21));
  assert.equal(state.daily.minutes, 8);
  assert.equal(state.daily.lessons, 1);
  assert.equal(state.streak.count, 1);
  assert.equal(state.progress["communication-a0-01"].status, "completed");
  assert.equal(state.mastery.speaking.attempts, 1);
});

test("portable export strips runtime data and import validates format", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const store = core.createStore(storage);
  store.update((state) => { state.profile.name = "Lan"; return state; });
  const payload = store.export();
  assert.equal(JSON.parse(payload).format, "hh-learning");
  assert.equal(store.import(payload).profile.name, "Lan");
  assert.throws(() => store.import('{"format":"other"}'), /định dạng/i);
});

test("certificate codes are deterministic for learner, title and day", () => {
  const state = core.defaultState();
  state.profile.name = "Minh";
  const first = core.certificateFor(state, "Communication A1", Date.UTC(2026, 6, 21));
  const second = core.certificateFor(state, "Communication A1", Date.UTC(2026, 6, 21));
  assert.equal(first.code, second.code);
  assert.match(first.code, /^HH-20260721-/);
  assert.equal(first.verified, false);
});
