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
  assert.match(core.storageKey("alice", "child-1"), /^hh\.school\.v2:alice:child-1$/);
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

test("Assessment V2 grades structured responses and queues human-reviewed work", () => {
  assert.equal(core.gradeQuestion({ type: "matching", answer: { a: "1", b: "2" } }, { b: "2", a: "1" }).correct, true);
  assert.equal(core.gradeQuestion({ type: "order", answer: ["0", "1", "2"] }, ["2", "1", "0"]).correct, false);
  assert.equal(core.gradeQuestion({ type: "order", answer: ["0", "1", "2"] }, ["0", "1", "2"]).correct, true);
  assert.equal(core.gradeQuestion({ type: "scenario", acceptedKeywords: ["kiểm tra", "dữ kiện"] }, "Em kiểm tra lại dữ kiện").correct, true);
  const pending = core.gradeQuestion({ type: "essay", skillId: "write" }, "Bài viết gốc");
  assert.equal(pending.gradingStatus, "pending-review");
  assert.equal(pending.score, null);
  assert.equal(core.gradeQuestion({ type: "dictation", answer: "Em yêu trường em" }, "em yeu truong em").correct, true);
  assert.equal(core.gradeQuestion({ type: "code", expectedOutput: "5" }, { output: "5" }).correct, true);
  assert.equal(core.gradeQuestion({ type: "upload", skillId: "submit" }, { key: "device:file" }).gradingStatus, "pending-review");
  assert.equal(core.gradeQuestion({ type: "image-mark", skillId: "diagram" }, "góc trên trái").gradingStatus, "pending-review");
});

test("attempt evidence stores the complete assessment contract and pending submission", () => {
  const state = core.defaultState({ currentUser: { id: "learner" }, profile: { grade: 8 } });
  const question = { id: "q-rich", gradeId: "grade-8", subjectId: "science", skillId: "evidence", type: "essay", cognitiveLevel: "vận dụng", difficulty: 4, prompt: "Giải thích", answer: "", explanation: "Theo rubric", distractorRationale: { a: "nhầm dữ kiện" }, contentStatus: "checked", source: { sourceTitle: "HH original" }, rubric: ["bằng chứng"] };
  const result = core.recordAttempt(state, { lessonId: "g8-science", question, answer: "Bản gốc của em", responseMs: 42000, helpLevel: 1 });
  const attempt = result.state.attempts.at(-1);
  assert.equal(attempt.questionId, "q-rich");
  assert.equal(attempt.gradeId, "grade-8");
  assert.equal(attempt.subjectId, "science");
  assert.equal(attempt.cognitiveLevel, "vận dụng");
  assert.equal(attempt.difficulty, 4);
  assert.equal(attempt.explanation, "Theo rubric");
  assert.deepEqual(attempt.distractorRationale, { a: "nhầm dữ kiện" });
  assert.equal(result.state.submissions.length, 1);
  assert.equal(result.mastery.attempts, 0);
});

test("state merge rejects profiles outside owner scope and resolves evidence without overwrite", () => {
  const context = { currentUser: { id: "alice" }, profile: { id: "child-1", grade: 5 } };
  const local = core.defaultState(context); const server = core.defaultState(context);
  local.attempts.push({ id: "local-attempt" }); server.attempts.push({ id: "server-attempt" });
  const merged = core.mergeStates(local, server, context);
  assert.deepEqual(merged.attempts.map((item) => item.id).sort(), ["local-attempt", "server-attempt"]);
  assert.throws(() => core.mergeStates(local, { ...server, ownerId: "mallory" }, context), /hồ sơ khác nhau/i);
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

test("local state cannot elevate role and storage quota failure does not break learning", () => {
  const forged = core.defaultState({ currentUser: { id: "student-1", educationRole: "student" } });
  forged.role = "platform-admin";
  assert.equal(core.normalizeState(forged, { currentUser: { id: "student-1", educationRole: "student" } }).role, "student");
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const store = core.createStore({ storage, currentUser: { id: "student-1" } });
  assert.doesNotThrow(() => store.update((state) => { state.profile.name = "An"; return state; }));
  assert.equal(store.get().profile.name, "An");
});

test("learning streak follows the device calendar day instead of UTC", () => {
  const late = new Date(2026, 7, 23, 23, 59).getTime();
  const nextMorning = new Date(2026, 7, 24, 0, 1).getTime();
  const first = core.nextActivity({}, late);
  assert.equal(first.streak, 1);
  assert.equal(core.nextActivity(first, late + 30_000).streak, 1);
  const second = core.nextActivity(first, nextMorning);
  assert.equal(second.streak, 2);
  assert.notEqual(first.lastActiveDay, second.lastActiveDay);
});

test("mastery needs recall on separate local days and more than one question type", () => {
  const start = new Date(2026, 7, 20, 12).getTime();
  let evidence = {};
  for (let day = 0; day < 4; day += 1) evidence = core.nextMastery(evidence, { correct: true, responseMs: 2000, questionType: "single" }, start + day * 86400000);
  assert.notEqual(evidence.state, "mastered");
  evidence = core.nextMastery(evidence, { correct: true, responseMs: 2000, questionType: "short" }, start + 4 * 86400000);
  assert.equal(evidence.retrievalDays, 5);
  assert.equal(evidence.state, "mastered");
});

test("pending human-reviewed work preserves multiline original without storing an answer key", () => {
  const state = core.defaultState({ currentUser: { id: "writer" }, profile: { grade: 8 } });
  const question = { id: "essay-private", type: "essay", skillId: "writing", answer: "Bản mẫu riêng", prompt: "Viết đoạn văn", rubric: ["bằng chứng"] };
  const result = core.recordAttempt(state, { lessonId: "lesson", question, answer: "Dòng một\nDòng hai", responseMs: 1000 });
  const attempt = result.state.attempts.at(-1);
  assert.equal(attempt.answer, "Dòng một\nDòng hai");
  assert.equal(attempt.expectedAnswer, "");
});

test("linked learners with the same profile id keep distinct access keys", () => {
  const first = core.learnerProfile({ id: "learner-1", accessScope: "linked", linkId: "link-a", grade: null }, "parent");
  const second = core.learnerProfile({ id: "learner-1", accessScope: "linked", linkId: "link-b", grade: null }, "parent");
  assert.equal(first.id, second.id);
  assert.notEqual(first.accessKey, second.accessKey);
  assert.equal(first.grade, null);
});
