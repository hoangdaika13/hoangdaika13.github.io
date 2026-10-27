"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../hh-school-core.js");
const context = { currentUser: { id: "learner" }, profile: { id: "child-1", grade: 6 } };
const copy = value => JSON.parse(JSON.stringify(value));
const memoryStorage = () => { const rows = new Map(); return { getItem: key => rows.get(key) || null, setItem: (key, value) => rows.set(key, value), rows }; };

test("numeric grading accepts equivalent fractions and configured tolerance without evaluating code", () => {
  const question = { type: "numeric", answer: "1/2", grading: { tolerance: .001 } };
  assert.equal(core.gradeQuestion(question, "0,5").correct, true);
  assert.equal(core.gradeQuestion(question, "2 / 4").correct, true);
  assert.equal(core.gradeQuestion(question, "0.5009").correct, true);
  assert.equal(core.gradeQuestion(question, "0.502").correct, false);
  for (const answer of ["1/0", "Infinity", "2+2", "Math.random()", "", "0.5 cm"]) assert.equal(core.gradeQuestion(question, answer).correct, false, answer);
  assert.equal(core.gradeQuestion({ type: "short", answer: "1/2" }, ".5").correct, false, "numeric comparison is explicitly configured");
  assert.equal(core.gradeQuestion({ ...question, grading: { tolerance: Infinity } }, "1000").gradingStatus, "pending-review");
});

test("units and conversions are accepted only by the authored numeric rule", () => {
  const question = { type: "numeric", answer: 2, grading: { unit: "m", unitRequired: true, acceptedUnits: { cm: .01, mét: 1 } } };
  assert.equal(core.gradeQuestion(question, "200 cm").correct, true);
  assert.equal(core.gradeQuestion(question, { value: 2, unit: "m" }).correct, true);
  assert.equal(core.gradeQuestion(question, "2 mét").correct, true);
  assert.equal(core.gradeQuestion(question, "2").correct, false);
  assert.equal(core.gradeQuestion(question, "2 cm").correct, false);
  assert.equal(core.gradeQuestion(question, "2 km").correct, false);
  assert.equal(core.gradeQuestion({ type: "numeric", answer: 3, grading: { unit: "m²", acceptedUnits: ["m2"] } }, "3 m2").correct, true);
  assert.equal(core.gradeQuestion({ ...question, answer: "200 cm" }, "2 m").correct, true);
});

test("Vietnamese dictation preserves accents and canonical Unicode while ordinary search-like text can normalize", () => {
  const question = { type: "dictation", answer: "Em yêu trường em" };
  assert.equal(core.gradeQuestion(question, "Em yêu trường em".normalize("NFD")).correct, true);
  assert.equal(core.gradeQuestion(question, "em yeu truong em").correct, false);
  assert.equal(core.gradeQuestion(question, "Em yếu trường em").correct, false);
  assert.equal(core.gradeQuestion({ type: "short", answer: "Hòa Bình" }, "hoa binh").correct, true);
  assert.equal(core.gradeQuestion({ ...question, grading: { mode: "orthography", caseSensitive: true } }, "em yêu trường em").correct, false);
});

test("partial multiple-choice marks are explicit and penalize incorrect extra selections", () => {
  const question = { type: "multiple", answer: ["a", "b"] };
  assert.equal(core.gradeQuestion(question, ["a"]).score, 0);
  assert.equal(core.gradeQuestion({ ...question, grading: { partialCredit: true } }, ["a"]).score, 50);
  assert.equal(core.gradeQuestion({ ...question, grading: { partialCredit: true } }, ["a", "x"]).score, 0);
  assert.equal(core.gradeQuestion(question, ["b", "a", "a"]).score, 100);
});

test("matching keys preserve Vietnamese Unicode and cannot collide through ID sanitization", () => {
  const question = { type: "matching", answer: { cột: "1" } };
  assert.equal(core.gradeQuestion(question, { ct: "1" }).correct, false);
  assert.equal(core.gradeQuestion(question, { ["cột".normalize("NFD")]: "1" }).correct, true);
  assert.equal(core.gradeQuestion({ type: "matching", answer: { "a:b": "c" } }, { a: "b:c" }).correct, false);
  assert.equal(core.gradeQuestion({ type: "matching", answer: JSON.parse('{"__proto__":"1"}') }, {}).gradingStatus, "pending-review");
});

test("keyword matching cannot grade essays or certify scenario understanding", () => {
  for (const type of ["scenario", "essay", "project", "upload"]) {
    const result = core.gradeQuestion({ type, skillId: "reason", acceptedKeywords: ["dữ kiện"], rubric: ["Giải thích bằng chứng"] }, "dữ kiện");
    assert.equal(result.correct, null);
    assert.equal(result.score, null);
    assert.equal(result.gradingStatus, "pending-review");
    assert.equal(result.received, false);
    assert.match(result.explanation, /thiết bị.*tự đối chiếu/);
    assert.doesNotMatch(result.explanation, /đã.*giáo viên/i);
  }
});

test("repeated Next marks navigation only and cannot create completion, attempts or mastery", () => {
  let state = core.defaultState(context);
  for (let step = 0; step < 10; step++) state = core.recordLessonStep(state, "lesson", { step, completed: step === 9 });
  assert.equal(state.progress.lesson.navigationComplete, true);
  assert.equal(state.progress.lesson.status, "viewed");
  assert.deepEqual(state.mastery, {});
  assert.equal(state.attempts.length, 0);
  assert.equal(core.lessonEvidence(state, "lesson").mastered, false);
  state = core.recordLessonStep(state, "lesson", { step: "lab", kind: "activity" });
  assert.equal(core.lessonEvidence(state, "lesson").status, "activity");
});

test("mastery requires independent reviewed question families, unaided delayed recall and more than one response type", () => {
  const start = Date.UTC(2026, 9, 1, 12);
  let repeated = {}, verified = {};
  for (let day = 0; day < 5; day++) {
    repeated = core.nextMastery(repeated, { correct: true, familyId: "same", questionType: day % 2 ? "short" : "single" }, start + day * 86400000);
    for (let family = 0; family < 3; family++) verified = core.nextMastery(verified, { correct: true, familyId: "family-" + family, questionType: family % 2 ? "short" : "single" }, start + day * 86400000);
  }
  assert.notEqual(repeated.state, "mastered");
  assert.equal(repeated.distinctFamilies, 1);
  assert.equal(verified.state, "mastered");
  assert.equal(verified.distinctFamilies, 3);
  assert.equal(verified.delayedFamilies, 3);
  let helped = {};
  for (let i = 0; i < 12; i++) helped = core.nextMastery(helped, { correct: true, familyId: "f-" + i % 3, questionType: i % 2 ? "short" : "single", helpLevel: 1 }, start + i * 86400000);
  assert.notEqual(helped.state, "mastered");
  assert.equal(helped.distinctFamilies, 0);
});

test("draft and legacy checked questions record real practice without certifying mastery", () => {
  let state = core.defaultState(context);
  const start = Date.UTC(2026, 9, 1, 12);
  for (let day = 0; day < 4; day++) for (let i = 0; i < 3; i++) state = core.recordAttempt(state, { lessonId: "lesson", question: { id: "q-" + i, type: i % 2 ? "short" : "single", skillId: "skill", contentStatus: i % 2 ? "draft" : "checked", answer: "2" }, answer: "2" }, start + day * 86400000).state;
  assert.equal(state.attempts.length, 12);
  assert.equal(state.mastery.skill.evidenceScope, "practice-only");
  assert.ok(state.mastery.skill.provisionalCertainty > 0);
  assert.notEqual(state.mastery.skill.state, "mastered");
  assert.equal(core.lessonEvidence(state, "lesson").status, "checked");
});

test("normalization and merging retain multi-year progress and history beyond the former destructive caps", () => {
  const state = core.defaultState(context);
  for (let i = 0; i < 2200; i++) { state.progress["lesson-" + i] = { status: "viewed" }; state.mastery["skill-" + i] = { score: i % 100 }; state.attempts.push({ id: "a-" + i }); state.mistakes.push({ id: "m-" + i, questionId: "q-" + i }); }
  const normalized = core.normalizeState(state, context);
  assert.equal(Object.keys(normalized.progress).length, 2200);
  assert.equal(Object.keys(normalized.mastery).length, 2200);
  assert.equal(normalized.attempts.length, 2200);
  assert.equal(normalized.mistakes.length, 2200);
  const extra = core.defaultState(context); extra.attempts.push({ id: "later" });
  assert.equal(core.mergeStates(normalized, extra, context).attempts.length, 2201);
});

test("workspace merge keeps both note histories and an already submitted exam over a later active snapshot", () => {
  const local = core.defaultState(context), server = core.defaultState(context);
  local.updatedAt = "2026-10-26T12:00:00Z"; server.updatedAt = "2026-10-25T12:00:00Z";
  local.studyWorkspace.notes.first = { text: "Latest", updatedAt: local.updatedAt };
  server.studyWorkspace.notes.second = { text: "Other tab", updatedAt: server.updatedAt };
  local.studyWorkspace.examSessions.exam = { status: "active", lastClockAt: 300 };
  server.studyWorkspace.examSessions.exam = { status: "submitted", submittedAt: 200, result: { score: 70 } };
  const merged = core.mergeStates(local, server, context);
  assert.equal(merged.studyWorkspace.notes.first.text, "Latest");
  assert.equal(merged.studyWorkspace.notes.second.text, "Other tab");
  assert.equal(merged.studyWorkspace.examSessions.exam.status, "submitted");
  assert.throws(() => core.normalizeState({ ...local, studyWorkspace: { version: 9 } }, context), /phiên bản/i);
  assert.throws(() => core.normalizeState({ ...local, studyWorkspace: { version: 1, examSessions: { exam: { remaining: Infinity } } } }, context), /JSON/);
});

test("classroom drafts converge with server IDs by assignment and learner without collapsing other learners or rubric work", () => {
  const local = core.defaultState(context), server = core.defaultState(context), early = "2026-10-26T10:00:00Z", later = "2026-10-26T11:00:00Z";
  server.submissions = [{ assignmentId: "assignment", learnerProfileId: "child-1", answer: "Old idless draft", status: "draft-device", updatedAt: early }, { id: "server-id", assignmentId: "assignment", learnerOwnerId: "learner", learnerProfileId: "child-1", answerRevision: 1, answer: "Submitted answer", status: "submitted", updatedAt: early }, { id: "other-profile", assignmentId: "assignment", learnerProfileId: "child-2", answer: "Other learner", updatedAt: later }, { id: "essay", attemptId: "attempt", lessonId: "writing", status: "self-review", answer: "Original rubric work" }];
  local.submissions = [{ id: "server-id", assignmentId: "assignment", learnerProfileId: "child-1", answerRevision: 1, answer: "New unsent draft", status: "draft-device", updatedAt: later }];
  const merged = core.mergeStates(local, server, context);
  assert.equal(merged.submissions.length, 3);
  assert.equal(merged.submissions.filter(row => row.assignmentId === "assignment" && row.learnerProfileId === "child-1").length, 1);
  assert.equal(merged.submissions.find(row => row.learnerProfileId === "child-1").answer, "New unsent draft");
  assert.equal(merged.submissions.find(row => row.learnerProfileId === "child-2").answer, "Other learner");
  assert.equal(merged.submissions.find(row => row.id === "essay").answer, "Original rubric work");
  const equalTime = core.defaultState(context), olderGrade = core.defaultState(context);
  equalTime.submissions = [{ id: "same", assignmentId: "same-assignment", answerRevision: 2, gradingRevision: 1, answer: "answer", score: 70, status: "returned", updatedAt: later }];
  olderGrade.submissions = [{ ...equalTime.submissions[0], gradingRevision: 2, score: 90 }];
  assert.equal(core.mergeStates(equalTime, olderGrade, context).submissions[0].score, 90, "same timestamps cannot downgrade a newer grading revision");
  equalTime.submissions[0] = { ...equalTime.submissions[0], status: "draft-device", answer: "unsent draft" };
  assert.equal(core.mergeStates(equalTime, olderGrade, context).submissions[0].answer, "unsent draft", "equal-time local draft remains available to the learner");
});

test("quota failure is visible while the current learning state remains in memory", () => {
  const store = core.createStore({ ...context, offline: null, storage: { getItem: () => null, setItem() { throw Error("quota exhausted"); } } });
  store.update(state => { state.profile.name = "An"; });
  assert.equal(store.get().profile.name, "An");
  assert.equal(store.getPersistence().status, "error");
  assert.match(store.getPersistence().error, /quota/);
});

test("full IndexedDB archive is acknowledged before a bounded local projection replaces large history", async () => {
  const storage = memoryStorage(); let full = null;
  const offline = { async loadProfile() { return full ? { state: copy(full) } : null; }, async saveProfile(owner, profile, state) { assert.equal(owner, "learner"); assert.equal(profile, "child-1"); full = copy(state); } };
  const store = core.createStore({ ...context, storage, offline });
  assert.equal(store.getPersistence().status, "loading");
  assert.throws(() => store.update(() => {}), /khôi phục/);
  await store.ready;
  store.update(state => { for (let i = 0; i < 1200; i++) state.attempts.push({ id: "attempt-" + i, answer: "a".repeat(1000) }); state.studyWorkspace.notes.lesson = { text: "Retain original note", updatedAt: state.updatedAt }; state.studyWorkspace.examSessions.exam = { id: "exam", status: "submitted", result: { score: 70 } }; });
  assert.equal((await store.whenSaved()).status, "saved-device");
  assert.equal(full.attempts.length, 1200);
  const compact = JSON.parse(storage.getItem(core.storageKey("learner", "child-1")));
  assert.equal(compact.storageArchive.required, true);
  assert.equal(compact.attempts.length, 100);
  assert.equal(compact.studyWorkspace.notes.lesson, undefined);
  assert.ok(JSON.stringify(compact).length < 750000);
  const reopened = core.createStore({ ...context, storage, offline }); await reopened.ready;
  assert.equal(reopened.get().attempts.length, 1200);
  assert.equal(reopened.get().studyWorkspace.notes.lesson.text, "Retain original note");
  assert.equal(reopened.get().studyWorkspace.examSessions.exam.result.score, 70);
});

test("corrupt or future local saves stay protected and a cross-account import cannot replace progress", () => {
  const storage = memoryStorage(), key = core.storageKey("learner", "child-1"), future = JSON.stringify({ ...core.defaultState(context), schemaVersion: 9 });
  storage.setItem(key, future);
  const store = core.createStore({ ...context, storage, offline: null });
  assert.equal(store.getPersistence().status, "protected");
  assert.throws(() => store.update(() => {}), /phiên bản/i);
  assert.throws(() => store.export(), error => error.code === "STATE_PROTECTED");
  assert.equal(store.getRecoveryData().format, "hh-school-recovery");
  assert.equal(store.getRecoveryData().localRaw, future);
  assert.equal(storage.getItem(key), future);
  const clean = core.createStore({ ...context, storage: memoryStorage(), offline: null });
  const other = core.defaultState({ currentUser: { id: "other" }, profile: context.profile });
  assert.throws(() => clean.import(JSON.stringify({ format: "hh-school", data: other })), /không thuộc/);
  assert.equal(clean.get().ownerId, "learner");
});

test("protected archive recovery exports the untouched JSON record and labels unsupported binary data honestly", async () => {
  const future = { key: "learner:child-1", archiveVersion: 9, ownerId: "learner", learnerProfileId: "child-1", state: { ...core.defaultState(context), schemaVersion: 9, unknownFutureField: "preserve exactly" } };
  const offline = { async loadProfile() { throw Object.assign(Error("Future archive"), { code: "STATE_VERSION_UNSUPPORTED", recoveryRecord: future }); }, async saveProfile() { throw Error("Must not write protected archive"); } };
  const store = core.createStore({ ...context, storage: memoryStorage(), offline }); await store.ready;
  assert.equal(store.getPersistence().status, "protected");
  assert.throws(() => store.export(), error => error.code === "STATE_PROTECTED");
  assert.deepEqual(JSON.parse(store.getRecoveryData().archiveRaw), future);
  assert.equal(store.getRecoveryData().archiveUnavailable, false);
  offline.loadProfile = async () => { throw Object.assign(Error("Future binary archive"), { code: "STATE_VERSION_UNSUPPORTED", recoveryRecord: { ...future, media: new Date() } }); };
  const binary = core.createStore({ ...context, storage: memoryStorage(), offline }); await binary.ready;
  assert.equal(binary.getRecoveryData().archiveRaw, null);
  assert.equal(binary.getRecoveryData().archiveUnavailable, true);
});

test("daily plan can honestly return no lesson when no content is published", () => {
  const state = core.defaultState(context);
  const plan = core.dailyPlan(state, { packForGrade: () => ({ lessons: [] }) });
  assert.equal(plan.nextLesson, null);
});

test("malformed workspace/history is protected and profile changes cannot mix another learner's current state", () => {
  const state = core.defaultState(context);
  assert.throws(() => core.normalizeState({ ...state, progress: [] }, context), /chưa hợp lệ/);
  assert.throws(() => core.normalizeState({ ...state, studyWorkspace: { version: 1, notes: [] } }, context), /chưa hợp lệ/);
  const store = core.createStore({ ...context, storage: memoryStorage(), offline: null });
  assert.throws(() => store.update(draft => { draft.profile.id = "child-2"; }), /kho riêng/);
  assert.equal(store.get().learnerProfileId, "child-1");
});
