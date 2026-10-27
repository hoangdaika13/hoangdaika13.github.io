"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../hh-school-assessments.js");
const clone = value => JSON.parse(JSON.stringify(value));
const blueprint = (changes = {}) => ({ id: "g6-math-check", title: "Kiểm tra nội bộ về số", gradeId: "grade-6", subjectId: "math", contentVersion: "2026.10-v1", durationMinutes: 1, sections: [{ id: "numbers", count: 2, outcomeIds: ["number-reasoning"] }], ...changes });
const question = (name, changes = {}) => ({ id: name, gradeId: "grade-6", subjectId: "math", outcomeId: "number-reasoning", familyId: "family-" + name, type: "short", cognitiveLevel: "thông hiểu", difficulty: 2, contentVersion: 3, prompt: "Lập luận tình huống " + name, answer: name, explanation: "Giải thích riêng của " + name, rubric: [{ criterion: "Lý do đúng", points: 1 }], ...changes });
const bank = () => ["one", "two", "three", "four", "five", "six"].map(name => question(name));
const create = (changes = {}) => A.createSession({ blueprint: blueprint(), bank: bank(), ownerId: "alice", learnerProfileId: "child-1", now: 1000, seed: "set-one", ...changes });
const grade = (q, value) => ({ correct: value === q.answer, score: value === q.answer ? 100 : 0, gradingStatus: "graded", explanation: q.explanation });

test("validates the authored blueprint and refuses invalid counts, filters and missing independent families", () => {
  assert.equal(A.validateBlueprint(blueprint(), bank()).ok, true);
  for (const b of [blueprint({ durationMinutes: 0 }), blueprint({ sections: [] }), blueprint({ sections: [{ id: "a", count: 81 }] }), blueprint({ sections: [{ id: "a", count: 1 }, { id: "a", count: 1 }] }), blueprint({ sections: [{ id: "a", count: 1, difficultyMin: 4, difficultyMax: 2 }] }), blueprint({ sections: [{ id: "a", count: 1, outcomeIds: [] }] })]) assert.equal(A.validateBlueprint(b, bank()).ok, false);
  const absent = A.validateBlueprint(blueprint(), [question("one")]);
  assert.equal(absent.ok, false); assert.equal(absent.code, "ASSESSMENT_INSUFFICIENT_BANK");
});

test("matrix selection satisfies overlapping requirements rather than greedily consuming a rare family", () => {
  const b = blueprint({ sections: [{ id: "broad", count: 1, outcomeIds: ["a", "b"] }, { id: "specific", count: 1, outcomeIds: ["a"] }] });
  const questions = A.selectQuestions([question("only-a", { outcomeId: "a" }), question("only-b", { outcomeId: "b" })], b, { seed: 1 });
  assert.equal(questions[0].id, "only-b"); assert.equal(questions[1].id, "only-a");
  assert.deepEqual(questions.map(q => q.assessmentSectionId), ["broad", "specific"]);
});

test("selection respects subject, grade, cognitive level, type and difficulty together", () => {
  const b = blueprint({ sections: [{ id: "reasoning", count: 1, outcomeIds: ["number-reasoning"], cognitiveLevels: ["vận dụng"], questionTypes: ["short"], difficultyMin: 3, difficultyMax: 4 }] });
  const questions = A.selectQuestions([question("wrong-level"), question("wrong-subject", { subjectId: "literature" }), question("wrong-grade", { gradeId: "grade-5" }), question("right", { cognitiveLevel: "vận dụng", difficulty: 3 })], b);
  assert.equal(questions.length, 1); assert.equal(questions[0].id, "right");
  assert.equal(A.validateBlueprint(b, [question("unknown-difficulty", { cognitiveLevel: "vận dụng", difficulty: undefined })]).ok, false);
});

test("two clones do not become independent questions by changing IDs or family labels", () => {
  const q = question("one"), same = { ...q, id: "clone", familyId: "new-family" };
  assert.equal(A.validateBlueprint(blueprint(), [q, same]).ok, false);
  const variants = [question("one", { familyId: "same-family" }), question("two", { familyId: "same-family" })];
  assert.equal(A.validateBlueprint(blueprint(), variants).ok, false);
});

test("reordering choices and offsetting the answer index does not create a second family", () => {
  const first = question("choice", { type: "single", prompt: "Chọn loài cây.", options: ["cây bàng", "viên đá"], answer: "0" });
  const reordered = { ...first, id: "reordered", familyId: "other-family", options: ["viên đá", "cây bàng"], answer: "1" };
  assert.equal(A.validateBlueprint(blueprint(), [first, reordered]).ok, false);
});

test("seeded selection is deterministic and a new equivalent set can exclude every prior family", () => {
  const first = A.selectQuestions(bank(), blueprint(), { seed: "first" });
  assert.deepEqual(first, A.selectQuestions(bank(), blueprint(), { seed: "first" }));
  const families = first.map(q => q.familyId);
  const next = A.selectQuestions(bank(), blueprint(), { seed: "next", excludeFamilyIds: families });
  assert.ok(next.every(q => !families.includes(q.familyId)));
  assert.ok(new Set(Array.from({ length: 20 }, (_, seed) => A.selectQuestions(bank(), blueprint(), { seed }).map(q => q.id).join(","))).size > 1);
});

test("excluding a family also excludes exact aliases linked through another family", () => {
  const original = question("one"), alias = { ...original, id: "alias", familyId: "alias-family" };
  const chosen = A.selectQuestions([original, alias, question("other")], blueprint({ sections: [{ id: "one", count: 1 }] }), { excludeFamilyIds: [original.familyId] });
  assert.equal(chosen[0].id, "other");
});

test("started questions, content version and rubric remain frozen when the source bank changes", () => {
  const source = bank(), b = blueprint(), session = create({ bank: source, blueprint: b });
  const old = JSON.stringify(session.questions), before = JSON.stringify(source);
  assert.equal(Object.isFrozen(session), true); assert.equal(Object.isFrozen(session.questions[0].rubric), true);
  source[0].prompt = "Đề khác"; source[0].rubric[0].criterion = "Thay tiêu chí"; b.contentVersion = "future-version";
  assert.equal(JSON.stringify(session.questions), old); assert.equal(session.blueprint.contentVersion, "2026.10-v1");
  assert.notEqual(JSON.stringify(source), before);
  assert.throws(() => { session.questions[0].answer = "changed"; }, TypeError);
});

test("all mutations return immutable JSON and preserve their source snapshot", () => {
  const session = create(), qid = session.questions[0].id, before = JSON.stringify(session);
  let next = A.answer(session, qid, { steps: ["lập luận", 2] }, 1500);
  next = A.flag(next, qid, true, 1600); next = A.navigate(next, 1, 1700);
  assert.equal(JSON.stringify(session), before); assert.deepEqual(next.answers[qid], { steps: ["lập luận", 2] });
  assert.deepEqual(next.flagged, [qid]); assert.equal(next.questionIndex, 1); assert.equal(next.timeSpentMs[qid], 700);
  assert.deepEqual(clone(next), next);
  assert.deepEqual(A.restoreSession(JSON.stringify(next), { ownerId: "alice", learnerProfileId: "child-1", now: 1700 }), next);
});

test("mock reload preserves wall-clock deadline and finalizes an expired answer exactly once", () => {
  let session = create({ mode: "mock" }); const qid = session.questions[0].id;
  session = A.answer(session, qid, session.questions[0].answer, 11000);
  const restored = A.restoreSession(JSON.stringify(session), { ownerId: "alice", learnerProfileId: "child-1", now: 31000, gradeQuestion: grade });
  assert.equal(restored.deadlineAt, 61000); assert.equal(A.remainingMs(restored, 31000), 30000);
  const expired = A.restoreSession(JSON.stringify(restored), { now: 70000, gradeQuestion: grade });
  assert.equal(expired.status, "submitted"); assert.equal(expired.submittedAt, 61000); assert.equal(expired.result.reason, "timeout");
  assert.equal(expired.elapsedMs, 60000); assert.equal(expired.result.percent, 50);
  assert.equal(A.submit(expired, { now: 90000, gradeQuestion() { throw Error("must not regrade"); } }), expired);
});

test("a late answer cannot slip into a mock at or after its deadline", () => {
  const session = create({ mode: "mock" }), question = session.questions[0];
  const expired = A.answer(session, question.id, question.answer, 61000, grade);
  assert.equal(expired.status, "submitted"); assert.deepEqual(expired.answers, {}); assert.equal(expired.result.percent, 0);
  assert.equal(A.answer(expired, question.id, question.answer, 61001), expired);
});

test("clock rollback cannot increase the saved remaining time", () => {
  const session = create({ mode: "mock" }), advanced = A.update(session, { type: "tick" }, { now: 21000 });
  const restored = A.restoreSession(JSON.stringify(advanced), { now: 10000 });
  assert.equal(A.remainingMs(restored, 10000), 40000); assert.equal(restored.lastClockAt, 21000); assert.equal(restored.startedAt, 1000);
});

test("practice pause freezes elapsed time but mock pause is explicitly forbidden", () => {
  const session = create(), paused = A.pause(session, 2000), waiting = A.restoreSession(JSON.stringify(paused), { now: 50000 });
  assert.equal(waiting.status, "paused"); assert.equal(waiting.elapsedMs, 1000); assert.equal(A.remainingMs(waiting, 50000), 59000);
  assert.throws(() => A.answer(waiting, waiting.questions[0].id, "answer", 50001), { code: "ASSESSMENT_PAUSED" });
  const resumed = A.resume(waiting, 50000), advanced = A.update(resumed, { type: "tick" }, { now: 51000 });
  assert.equal(advanced.elapsedMs, 2000);
  const mock = create({ mode: "mock" }), before = JSON.stringify(mock);
  assert.throws(() => A.pause(mock, 2000), { code: "ASSESSMENT_PAUSE_NOT_ALLOWED" }); assert.equal(JSON.stringify(mock), before);
});

test("practice time is advisory and does not silently terminate a long learning exercise", () => {
  const session = create(), late = A.answer(session, session.questions[0].id, "a", 99000);
  assert.equal(late.status, "active"); assert.equal(A.remainingMs(late, 99000), 0); assert.equal(A.view(late, { now: 99000 }).timeLimit, "advisory");
});

test("strict view and review withhold keys and solutions until submission", () => {
  const session = create({ mode: "mock" }), qid = session.questions[0].id;
  const before = A.view(session, { now: 1000 });
  for (const key of ["answer", "explanation", "rubric", "distractorRationale", "hintSteps"]) assert.equal(own(before.questions[0], key), false);
  assert.equal(before.result, null); assert.equal(before.resultType, "in-app-authored-assessment"); assert.equal(before.contentStatus, "draft");
  assert.throws(() => A.review(session, qid, { gradeQuestion: grade }), { code: "ASSESSMENT_REVIEW_LOCKED" });
  const submitted = A.submit(session, { now: 2000, gradeQuestion: grade });
  assert.equal(A.view(submitted, { now: 2000 }).questions[0].answer, session.questions[0].answer);
  assert.equal(A.review(submitted, qid).question.explanation, session.questions[0].explanation);
});

test("public questions do not leak new grading metadata or nested correct-option flags", () => {
  const questions = [question("private", { type: "single", options: [{ label: "A", correct: true }, { label: "B", correct: false }], answer: "0", internalAnswerDebug: "never present in public view", grading: { mode: "exact", answers: ["0"] }, publicRubric: [{ criterion: "Đưa ra lý do" }] })];
  const session = create({ bank: questions, blueprint: blueprint({ sections: [{ id: "one", count: 1 }] }), mode: "mock" });
  const q = A.view(session, { now: 1000 }).questions[0];
  assert.equal(q.grading, undefined); assert.equal(q.internalAnswerDebug, undefined);
  assert.deepEqual(q.options, [{ label: "A" }, { label: "B" }]);
  assert.deepEqual(q.publicRubric, [{ criterion: "Đưa ra lý do" }]);
});

test("a long but valid custom session ID still produces a bounded stable submission ID", () => {
  const session = create({ id: "x".repeat(160) });
  const submitted = A.submit(session, { now: 2000, gradeQuestion: grade });
  assert.ok(submitted.submissionId.length <= 160);
  assert.equal(A.restoreSession(JSON.stringify(submitted), { now: 3000 }).submissionId, submitted.submissionId);
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

test("practice review requires an independent attempt and preserves matching control labels", () => {
  const bank = [question("match", { type: "matching", answer: { river: "water", tree: "plant" }, options: ["water", "plant"] })];
  let session = create({ bank, blueprint: blueprint({ sections: [{ id: "matching", count: 1 }] }) });
  const qid = session.questions[0].id, publicQuestion = A.view(session, { now: 1000 }).questions[0];
  assert.deepEqual(publicQuestion.matchingKeys, ["river", "tree"]); assert.equal(own(publicQuestion, "answer"), false);
  assert.throws(() => A.review(session, qid), { code: "ASSESSMENT_ANSWER_REQUIRED" });
  session = A.answer(session, qid, { river: "water", tree: "plant" }, 1500);
  assert.deepEqual(A.review(session, qid, { gradeQuestion: () => ({ score: 100, correct: true }) }).question.answer, { river: "water", tree: "plant" });
});

test("partial credit, unanswered questions and pending essays are not fabricated into a final score", () => {
  const b = blueprint({ sections: [{ id: "mixed", count: 3 }] });
  let session = create({ blueprint: b, bank: [question("partial", { points: 2 }), question("essay", { type: "essay", points: 3 }), question("blank", { points: 1 })] });
  for (const q of session.questions) if (q.id !== "blank") session = A.answer(session, q.id, "work", 1500);
  const graded = A.submit(session, { now: 2000, gradeQuestion: q => q.type === "essay" ? { score: null, gradingStatus: "pending-review" } : { score: 50, correct: false, gradingStatus: "graded" } });
  assert.equal(graded.result.earnedPoints, 1); assert.equal(graded.result.maxPoints, 6); assert.equal(graded.result.pending, 1);
  assert.equal(graded.result.percent, null); assert.equal(graded.result.gradingStatus, "pending-review");
  assert.equal(graded.result.official, false); assert.equal(graded.result.byOutcome[0].pending, 1);
});

test("submit is idempotent and no answer, flag or navigation changes a submitted snapshot", () => {
  let session = create(); for (const q of session.questions) session = A.answer(session, q.id, q.answer, 2000);
  let calls = 0; const submitted = A.submit(session, { now: 3000, gradeQuestion(q, a) { calls++; return grade(q, a); } });
  assert.equal(calls, 2); assert.equal(submitted.result.percent, 100);
  for (const action of [{ type: "submit" }, { type: "answer", questionId: session.questions[0].id, value: "wrong" }, { type: "flag", questionId: session.questions[0].id }, { type: "navigate", index: 1 }]) assert.equal(A.update(submitted, action, { now: 5000, gradeQuestion() { throw Error("No second grading"); } }), submitted);
  assert.equal(A.restoreSession(JSON.stringify(submitted), { now: 5000 }).submissionId, submitted.submissionId);
});

test("bad graders cannot turn an active session into a fabricated successful submission", () => {
  let session = create(); session = A.answer(session, session.questions[0].id, "attempt", 1500);
  for (const invalid of [{ score: Infinity }, { score: -1 }, { score: 101 }, { correct: true }, Promise.resolve({ score: 100 })]) assert.throws(() => A.submit(session, { now: 2000, gradeQuestion: () => invalid }), { code: "ASSESSMENT_INVALID_GRADE" });
  assert.equal(session.status, "active"); assert.equal(session.result, null);
  const pending = A.submit(session, { now: 2000 }); assert.equal(pending.result.pending, 1); assert.equal(pending.result.percent, null);
});

test("existing code-output grader can omit its optional expected field without breaking submission", () => {
  const C = require("../hh-school-core.js");
  const q = question("code", { type: "code", expectedOutput: "5" }); delete q.answer;
  let session = create({ bank: [q], blueprint: blueprint({ sections: [{ id: "one", count: 1 }] }) });
  session = A.answer(session, "code", { output: "5" }, 1500);
  const submitted = A.submit(session, { now: 2000, gradeQuestion: C.gradeQuestion });
  assert.equal(submitted.result.percent, 100);
  assert.deepEqual(clone(submitted), submitted);
});

test("malformed answer, unknown question and out-of-bounds navigation leave the original untouched", () => {
  const session = create(), before = JSON.stringify(session), qid = session.questions[0].id;
  for (const value of [undefined, Infinity, new Date(), () => 1, "x".repeat(16001)]) assert.throws(() => A.answer(session, qid, value, 1500));
  assert.throws(() => A.answer(session, "foreign", "a", 1500)); assert.throws(() => A.navigate(session, 100, 1500));
  assert.throws(() => A.update(session, { type: "unknown" }, { now: 1500 }));
  assert.equal(JSON.stringify(session), before);
});

test("restore rejects future schema, changed frozen questions/deadline, wrong accounts and corruption without resetting", () => {
  const session = create({ mode: "mock" }), original = JSON.stringify(session);
  for (const corrupt of [{ ...clone(session), schemaVersion: 9 }, { ...clone(session), deadlineAt: 62000 }, { ...clone(session), answers: { foreign: "a" } }, { ...clone(session), questions: session.questions.slice(1) }]) assert.throws(() => A.restoreSession(corrupt, { now: 2000 }));
  const changed = clone(session); changed.questions[0].prompt = "Replacement";
  assert.throws(() => A.restoreSession(changed, { now: 2000 }), { code: "ASSESSMENT_SNAPSHOT_CHANGED" });
  assert.throws(() => A.restoreSession(session, { ownerId: "bob", now: 2000 }), { code: "ASSESSMENT_OWNER_MISMATCH" });
  assert.throws(() => A.restoreSession(session, { learnerProfileId: "child-2", now: 2000 }), { code: "ASSESSMENT_OWNER_MISMATCH" });
  assert.throws(() => A.restoreSession("{bad", { now: 2000 })); assert.equal(JSON.stringify(session), original);
});
