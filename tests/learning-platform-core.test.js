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
  assert.equal(good.repetitions, 1);
  assert.equal(good.history.length, 1);
  assert.equal(good.history[0].rating, "good");
});

test("skill graph and adaptive path explain recommendations without locking CEFR", () => {
  const state = core.defaultState();
  state.profile.level = "B1";
  state.profile.career = "technology";
  state.mastery.writing = { ...state.mastery.writing, attempts: 5, correct: 2, accuracy: 40, score: 35, state: "review" };
  const graph = core.buildSkillGraph(state);
  assert.equal(graph.nodes.length, core.skills.length);
  assert.ok(graph.edges.some((edge) => edge.source === "writing" && edge.target === "project"));
  assert.equal(graph.recommendationOnly, true);
  const path = core.buildAdaptivePath(state, { trackId: "technology", now: Date.UTC(2026, 6, 22) });
  assert.deepEqual(path.levels, core.levels);
  assert.equal(path.deterministic, true);
  assert.ok(path.recommendation.lesson);
  assert.match(path.reason, /weak-skill/);
});

test("mistake notebook aggregates repeats and keeps bounded local explanations", () => {
  const first = core.recordMistake(core.defaultState(), { skillId: "grammar", prompt: "He go", answer: "He goes", userAnswer: "He go", explanation: "Third-person singular" }, Date.UTC(2026, 6, 21));
  const second = core.recordMistake(first.state, { skillId: "grammar", prompt: "He go", answer: "He goes", userAnswer: "He go again" }, Date.UTC(2026, 6, 22));
  assert.equal(second.created, false);
  assert.equal(second.mistake.occurrences, 2);
  assert.equal(second.state.mistakes.length, 1);
  const insights = core.mistakeInsights(second.state, Date.UTC(2026, 6, 22));
  assert.equal(insights.bySkill.grammar, 2);
  assert.equal(insights.repeated[0].occurrences, 2);
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

test("practice projects persist bounded evidence and feed the daily plan", () => {
  const created = core.createProject(core.defaultState(), { trackId: "technology", level: "B1", title: "<Demo>", skills: ["project", "writing", "bad"] }, Date.UTC(2026, 6, 21));
  assert.equal(created.project.trackId, "technology");
  assert.deepEqual(created.project.skills, ["project", "writing"]);
  assert.equal(created.project.stages.length, 5);
  const updated = core.updateProjectStage(created.state, created.project.id, "brief", { completed: true, evidence: "A real brief" }, Date.UTC(2026, 6, 22));
  assert.equal(updated.project.stages[0].status, "done");
  assert.equal(updated.progress.completed, 1);
  assert.equal(core.buildDailyPlan(updated.state).nextProject.project.id, created.project.id);
});
