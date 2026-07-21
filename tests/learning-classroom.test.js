const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "learning-classroom.js"), "utf8");
const css = fs.readFileSync(path.join(root, "learning-classroom.css"), "utf8");
const learning = require("../learning-classroom.js");

function memoryStorage(seed) {
  const values = new Map(seed ? [[learning.STORAGE_KEY, JSON.stringify(seed)]] : []);
  return { values, getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}

function host() {
  const listeners = new Map();
  return {
    innerHTML: "",
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector() { return null; },
    listenerCount() { return listeners.size; }
  };
}

test("exports the five Learning Classroom workspaces through a small lifecycle API", () => {
  assert.equal(learning.VERSION, 1);
  assert.equal(learning.STORAGE_KEY, "hh.learning.classroom.v1");
  assert.deepEqual(learning.VIEWS, ["assessments", "certificates", "classroom", "study-together", "catch-up"]);
  assert.equal(learning.supports("classroom"), true);
  assert.equal(learning.supports("unknown"), false);
  assert.equal(typeof learning.mount, "function");
  assert.equal(typeof learning.unmount, "function");
  assert.equal(global.HHLearningClassroom, learning);
});

test("normalization bounds user content and never persists file bodies or verification claims", () => {
  const state = learning.normalizeState({
    currentUser: { id: "u1", name: "x".repeat(500), role: "admin" },
    certificates: [{ code: "HH-1", title: "Course", onlineVerified: true, verified: true }],
    submissions: [{ assignmentId: "a1", userId: "u1", text: "z".repeat(9000), fileMetadata: [{ name: "work.pdf", size: 99_000_000, body: "secret binary" }] }],
    whiteboards: { room: [{ color: "red", width: 500, points: [{ x: -1, y: 9000 }, { x: 2, y: 3 }] }] }
  });
  assert.equal(state.currentUser.role, "student");
  assert.equal(state.currentUser.name.length, 80);
  assert.equal(state.certificates[0].onlineVerified, false);
  assert.equal(state.certificates[0].localPreview, true);
  assert.equal(state.submissions[0].text.length, 5000);
  assert.deepEqual(Object.keys(state.submissions[0].fileMetadata[0]).sort(), ["lastModified", "name", "size", "type"]);
  assert.equal(state.submissions[0].fileMetadata[0].size, 10_000_000);
  assert.equal(state.whiteboards.room[0].color, "#53cbd6");
  assert.equal(state.whiteboards.room[0].width, 20);
});

test("creates every assessment type with shuffled bounded questions and timed defaults", () => {
  for (const type of learning.ASSESSMENT_TYPES) {
    const assessment = learning.createAssessment(type, { seed: "stable", questionCount: 6 });
    assert.equal(assessment.type, type);
    assert.equal(assessment.questions.length, 6);
    assert.ok(assessment.durationMinutes > 0);
    assert.equal(new Set(assessment.questions.map((item) => item.id)).size, 6);
  }
  assert.deepEqual(
    learning.shuffled([1, 2, 3, 4, 5], "same"),
    learning.shuffled([1, 2, 3, 4, 5], "same"),
    "question shuffle must be reproducible when a seed is supplied"
  );
});

test("grades objective questions immediately and leaves speaking or writing for rubric review", () => {
  const assessment = {
    questions: [
      { id: "a", kind: "choice", prompt: "A", options: ["yes", "no"], answer: "yes" },
      { id: "b", kind: "choice", prompt: "B", options: ["one", "two"], answer: "two" },
      { id: "c", kind: "rubric", prompt: "Write", rubric: "writing" }
    ]
  };
  const waiting = learning.gradeAssessment(assessment, { a: "yes", b: "one", c: "Draft" });
  assert.equal(waiting.autoScore, 50);
  assert.equal(waiting.needsRubric, true);
  const reviewed = learning.gradeAssessment(assessment, { a: "yes", b: "one", c: "Draft" }, { rubricScores: { c: 80 } });
  assert.equal(reviewed.score, 60);
  assert.equal(reviewed.needsRubric, false);
  assert.equal(reviewed.recommendedLevel, "B1");
});

test("assessment attempts retain answer history and certificate remains a local preview", () => {
  let state = learning.defaultState();
  const assessment = learning.createAssessment("lesson-quiz", { questionCount: 2, shuffle: false });
  assessment.questions = assessment.questions.filter((item) => item.kind === "choice").slice(0, 2);
  state.assessments = [assessment];
  const answers = Object.fromEntries(assessment.questions.map((question) => [question.id, question.answer]));
  const submitted = learning.submitAttempt(state, { assessmentId: assessment.id, answers, startedAt: new Date(Date.now() - 30_000).toISOString() });
  assert.equal(submitted.result.score, 100);
  assert.equal(submitted.attempt.status, "graded");
  assert.equal(submitted.state.attempts.length, 1);
  assert.ok(submitted.attempt.elapsedSeconds >= 29);

  const issued = learning.issueCertificate(submitted.state, { attemptId: submitted.attempt.id, title: "English Foundation" });
  assert.match(issued.certificate.code, /^HH-LOCAL-\d{8}-[A-Z0-9]+$/);
  assert.equal(issued.certificate.localPreview, true);
  assert.equal(issued.certificate.onlineVerified, false);
  assert.equal(issued.certificate.score, 100);
});

test("classroom permissions protect assignment and grading operations", () => {
  const created = learning.createClassroom(learning.defaultState(), { name: "English 101" });
  assert.equal(created.state.currentUser.role, "teacher");
  assert.equal(created.classroom.members[0].role, "teacher");

  const assignmentResult = learning.createAssignment(created.state, {
    classId: created.classroom.id,
    title: "Unit 1",
    instructions: "Write a short email.",
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    target: "group"
  });
  assert.equal(assignmentResult.assignment.title, "Unit 1");

  const studentState = learning.normalizeState({
    ...assignmentResult.state,
    currentUser: { id: "student-1", name: "Lan", role: "student" },
    classrooms: [{ ...created.classroom, members: [...created.classroom.members, { userId: "student-1", name: "Lan", role: "student", joinedAt: new Date().toISOString() }] }]
  });
  assert.throws(() => learning.createAssignment(studentState, { classId: created.classroom.id, title: "Forbidden" }), /Chỉ giáo viên/);

  const submitted = learning.submitAssignment(studentState, { assignmentId: assignmentResult.assignment.id, text: "My completed work", files: [{ name: "answer.pdf", type: "application/pdf", size: 2000, lastModified: 10, content: "must not persist" }] });
  assert.equal(submitted.submission.status, "submitted");
  assert.equal(submitted.submission.fileMetadata[0].name, "answer.pdf");
  assert.equal("content" in submitted.submission.fileMetadata[0], false);
  assert.throws(() => learning.gradeSubmission(submitted.state, { submissionId: submitted.submission.id, score: 90 }), /Chỉ giáo viên/);

  const teacherState = learning.normalizeState({ ...submitted.state, currentUser: { id: "local-user", name: "Teacher", role: "teacher" } });
  const graded = learning.gradeSubmission(teacherState, { submissionId: submitted.submission.id, score: 92, feedback: "Clear structure" });
  assert.equal(graded.submission.status, "graded");
  assert.equal(graded.submission.score, 92);
  assert.equal(graded.submission.feedback, "Clear structure");
});

test("join codes are honest about local scope and discussions require membership", () => {
  const created = learning.createClassroom(learning.defaultState(), { name: "Local Class" });
  const outsider = learning.normalizeState({ ...created.state, currentUser: { id: "s2", name: "Minh", role: "student" } });
  assert.throws(() => learning.addDiscussion(outsider, { classId: created.classroom.id, text: "Hello" }), /chưa tham gia/);
  assert.throws(() => learning.joinClassroom(outsider, { code: "MISSING" }), /Cần backend/);
  const joined = learning.joinClassroom(outsider, { code: created.classroom.code });
  const posted = learning.addDiscussion(joined.state, { classId: created.classroom.id, text: "Câu hỏi về bài tập" });
  assert.equal(posted.discussion.author, "Minh");
  assert.equal(posted.state.discussions.length, 1);
});

test("Study Together persists Pomodoro and bounded vector strokes without fake presence", () => {
  const created = learning.createStudyRoom(learning.defaultState(), { name: "Focus Lab" });
  assert.equal(created.room.mode, "local");
  let state = learning.updatePomodoro(created.state, "start", 1_000_000);
  assert.equal(state.pomodoro.running, true);
  state = learning.updatePomodoro(state, "pause", 1_010_000);
  assert.equal(state.pomodoro.running, false);
  assert.equal(state.pomodoro.remaining, 1490);
  state = learning.addWhiteboardStroke(state, created.room.id, { color: "#ff00aa", width: 4, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
  assert.equal(state.whiteboards[created.room.id].length, 1);
  assert.equal(state.whiteboards[created.room.id][0].points.length, 2);
});

test("catch-up is extractive, source-counted, and explicitly local", () => {
  const created = learning.createClassroom(learning.defaultState(), { name: "Career English" });
  const assignment = learning.createAssignment(created.state, { classId: created.classroom.id, title: "Interview practice", dueAt: new Date(Date.now() + 86_400_000).toISOString() });
  const discussed = learning.addDiscussion(assignment.state, { classId: created.classroom.id, text: "Prepare three STAR examples." });
  const catchUp = learning.buildCatchUp(discussed.state, created.classroom.id);
  assert.match(catchUp.summary, /Interview practice/);
  assert.match(catchUp.summary, /STAR examples/);
  assert.equal(catchUp.sourceCount, 2);
  assert.match(catchUp.method, /Trích xuất cục bộ/);
  assert.doesNotMatch(catchUp.method, /AI đã tạo|realtime/);
});

test("versioned store exports and imports only the Learning Classroom document", () => {
  const storage = memoryStorage();
  const store = learning.createStore(storage);
  store.update((state) => { state.currentUser.name = "Dung Nguyen"; return state; });
  assert.ok(storage.values.has(learning.STORAGE_KEY));
  const exported = store.export();
  assert.match(exported, /"format": "hh-learning-classroom"/);
  const second = learning.createStore(memoryStorage());
  assert.equal(second.import(exported).currentUser.name, "Dung Nguyen");
  assert.throws(() => second.import('{"format":"other"}'), /Không đúng định dạng/);
});

test("adapter hook fails honestly when no backend handles the request", async () => {
  learning.setAdapter(null);
  const scope = { CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }, dispatchEvent() { return true; } };
  await assert.rejects(learning.requestAdapter(scope, "sync", {}), /Chưa kết nối backend/);
  learning.setAdapter({ sync: ({ value }) => ({ value: value + 1 }) });
  assert.deepEqual(await learning.requestAdapter(scope, "sync", { value: 2 }), { value: 3 });
  learning.setAdapter(null);
});

test("mount renders all views, escapes user content, and cleans listeners", () => {
  const storage = memoryStorage();
  const scope = { localStorage: storage, FormData, CustomEvent: class CustomEvent {}, print() {} };
  for (const [view, tokens] of Object.entries({
    assessments: ["ASSESSMENT CENTER", "Đánh giá có lịch sử và rubric", "Tạo bài"],
    certificates: ["LOCAL CERTIFICATE PREVIEW", "Chưa xác minh online"],
    classroom: ["CLASSROOM · LOCAL MODE", "Tạo lớp", "Đồng bộ backend"],
    "study-together": ["STUDY TOGETHER · LOCAL ROOM", "Pomodoro", "Bảng trắng"],
    "catch-up": ["SMART CATCH-UP · EXTRACTIVE LOCAL", "không phải bản tóm tắt AI"]
  })) {
    const target = host();
    const controller = learning.mount(target, { view, scope, storage });
    for (const token of tokens) assert.ok(target.innerHTML.includes(token), `missing ${view} token: ${token}`);
    assert.equal(controller.view, view);
    assert.equal(target.listenerCount(), 2);
    learning.unmount();
    assert.equal(target.listenerCount(), 0);
    assert.equal(target.innerHTML, "");
  }

  const malicious = learning.normalizeState({ currentUser: { id: "u", name: '<img src=x onerror="boom">', role: "student" }, certificates: [{ code: "X", title: "<script>bad</script>", learner: "<svg>" }] });
  const target = host();
  learning.mount(target, { view: "certificates", scope, store: { get: () => malicious, set: (value) => value } });
  assert.doesNotMatch(target.innerHTML, /<img|<script>|<svg>/);
  assert.match(target.innerHTML, /&lt;script&gt;bad&lt;\/script&gt;/);
  learning.unmount();
});

test("source has no credentials and labels backend-dependent capabilities truthfully", () => {
  for (const token of [
    "hh:learning-classroom:adapter", "Chưa kết nối backend", "Xác minh công khai, chống sửa đổi và URL tra cứu cần backend",
    "Mã lớp chỉ hoạt động trên thiết bị này", "không phải bản tóm tắt AI", "fileMetadata", "teacher", "student", "setInterval", "recommendedLevel"
  ]) assert.ok(source.includes(token), `missing truthfulness contract: ${token}`);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|mongodb\+srv:|clientSecret\s*[:=]|password\s*[:=]/i);
  assert.doesNotMatch(source, /readAsDataURL|arrayBuffer\(\)|file\.text\(\)/);
});

test("stylesheet is scoped, responsive, focus-visible, printable, and reduced-motion aware", () => {
  for (const token of [
    ".hlc {", ".hlc-grid--assessment", ".hlc-class-layout", ".hlc-study-grid", ".hlc-whiteboard-wrap",
    ":focus-visible", "@media (max-width: 600px)", "@media (max-width: 390px)", "@media print", "prefers-reduced-motion: reduce", "min-width: 0"
  ]) assert.ok(css.includes(token), `missing CSS contract: ${token}`);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
  assert.doesNotMatch(css, /border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
