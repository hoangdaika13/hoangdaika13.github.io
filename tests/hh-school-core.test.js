const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../hh-school-core.js");
const curriculum = require("../hh-school-curriculum.js");

const memoryStorage = () => { const map = new Map(); return { getItem: (key) => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };

test("state is isolated by authenticated owner and learner profile", () => {
  const storage = memoryStorage();
  const alice = core.createStore({ storage, currentUser: { id: "alice", roles: ["student"] }, profile: { id: "child-1", grade: 4 } });
  alice.update((state) => { state.profile.name = "Lan"; return state; });
  const bob = core.createStore({ storage, currentUser: { id: "bob", roles: ["student"] }, profile: { id: "child-1", grade: 4 } });
  assert.equal(alice.get().ownerId, "alice");
  assert.equal(bob.get().ownerId, "bob");
  assert.notEqual(bob.get().profile.name, "Lan");
  assert.match(core.storageKey("alice", "child-1"), /^hh\.school\.v1:alice:child-1$/);
});

test("one correct answer cannot mark a skill mastered", () => {
  const state = core.defaultState({ currentUser: { id: "learner" }, profile: { grade: 6 } });
  const lesson = curriculum.lessonForGrade(6);
  const first = core.recordAttempt(state, { lessonId: lesson.lessonId, question: lesson.questions[0], answer: lesson.questions[0].answer, responseMs: 8000 });
  assert.equal(first.result.correct, true);
  assert.equal(first.mastery.attempts, 1);
  assert.notEqual(first.mastery.state, "mastered");
  let next = first.state;
  for (let index = 0; index < 4; index += 1) next = core.recordAttempt(next, { lessonId: lesson.lessonId, question: lesson.questions[0], answer: lesson.questions[0].answer, responseMs: 5000 }, Date.now() + (index + 1) * 86400000).state;
  assert.ok(next.mastery[lesson.questions[0].skillId].repetitions >= 3);
});

test("grading supports short, single, boolean and multiple answers", () => {
  assert.equal(core.gradeQuestion({ type: "short", answer: "Hòa Bình" }, "hoa binh").correct, true);
  assert.equal(core.gradeQuestion({ type: "single", answer: "2" }, "2").correct, true);
  assert.equal(core.gradeQuestion({ type: "boolean", answer: "true" }, true).correct, true);
  assert.equal(core.gradeQuestion({ type: "multiple", answer: ["1", "3"] }, ["3", "1"]).correct, true);
});

test("role permissions separate student, parent, teacher, reviewer and admin", () => {
  assert.equal(core.can("student", "view-own"), true);
  assert.equal(core.can("student", "create-class"), false);
  assert.equal(core.can("parent", "view-linked"), true);
  assert.equal(core.can("teacher", "assign"), true);
  assert.equal(core.can("content-reviewer", "platform-admin"), false);
  assert.equal(core.can("platform-admin", "platform-admin"), true);
  assert.equal(core.roleFor({ id: "teacher-user", educationRole: "teacher" }), "teacher");
});

test("portable export/import and daily plan preserve real evidence", () => {
  const store = core.createStore({ storage: memoryStorage(), currentUser: { id: "u1" }, profile: { grade: 10 } });
  const payload = store.export();
  assert.equal(JSON.parse(payload).format, "hh-school");
  assert.equal(store.import(payload).profile.grade, 10);
  assert.ok(core.dailyPlan(store.get(), curriculum).nextLesson.lessonId);
  assert.throws(() => store.import('{"format":"other"}'), /định dạng/i);
});
