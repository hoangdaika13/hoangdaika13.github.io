const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const os = require(path.join(root, "english-learning-os.js"));

test("Learning OS exposes exactly five primary destinations and keeps tools secondary", () => {
  assert.deepEqual(os.mainNavigation.map(([id]) => id), ["dashboard", "pathways", "practice-hub", "explore", "progress"]);
  assert.equal(os.tools.length, 9);
  assert.ok(os.tools.some((item) => item.view === "mistakes"));
  assert.ok(os.tools.some((item) => item.view === "speaking"));
});

test("legacy mistakes migrate without duplication and preserve repeat evidence", () => {
  const state = os.normalizeState({
    mistakeNotebook: [
      { word: "make homework", mode: "vocabulary", expected: "do homework", answer: "make homework" },
      { word: "make homework", mode: "vocabulary", expected: "do homework", answer: "make homework" }
    ]
  });
  assert.equal(state.learningOS.schemaVersion, 3);
  assert.equal(state.learningOS.mistakeRecords.length, 1);
  assert.equal(state.learningOS.mistakeRecords[0].occurrences, 2);
  assert.ok(state.learningOS.migration.legacyImportedAt);
});

test("active vocabulary requires recognition, recall, production and delayed evidence", () => {
  assert.equal(os.activeVocabularyStage({ score: 70, attempts: 2, correct: 2 }), "recall");
  assert.equal(os.activeVocabularyStage({ score: 95, attempts: 5, correct: 5, productionSuccesses: 0, delayedRecalls: 2 }), "recall");
  assert.equal(os.activeVocabularyStage({ score: 95, attempts: 5, correct: 4, productionSuccesses: 1, delayedRecalls: 1 }), "active");
});

test("today model derives mission, SRS and repeated error from persisted facts", () => {
  const now = Date.now();
  const state = os.normalizeState({
    selectedLevel: "A1",
    completed: {},
    reviewQueue: { hello: { type: "word", dueAt: new Date(now - 1000).toISOString() }, later: { type: "sentence", dueAt: new Date(now + 86400000).toISOString() } },
    mistakeNotebook: [{ word: "I am agree", mode: "grammar", expected: "I agree", occurrences: 3 }]
  });
  const lesson = { id: "a1-1", title: "Agree politely", canDo: "Đồng ý lịch sự", minutes: 10 };
  const model = os.todayModel(state, { selectedLevelId: () => "A1", nextLessonFor: () => lesson });
  assert.equal(model.nextLesson.id, "a1-1");
  assert.equal(model.due.length, 1);
  assert.equal(model.mistake.prompt, "I am agree");
  assert.match(model.mode.label, /Bài chuẩn/);
});

test("all OS views render real controls and truthful state labels", () => {
  const base = os.normalizeState({ selectedLevel: "A0", completed: {}, reviewQueue: {}, wordMastery: {}, mistakeNotebook: [] });
  const context = {
    selectedLevelId: () => "A0",
    nextLessonFor: () => ({ id: "a0-1", title: "Hello", canDo: "Chào hỏi", minutes: 10, vocabulary: [["hello", "/həˈloʊ/", "xin chào", "Hello, Lan."]], exercises: [{ prompt: "hello nghĩa là gì?", answer: "xin chào", options: ["xin chào", "tạm biệt"] }] }),
    allLessons: [], levelOrder: ["A0"]
  };
  const markers = {
    dashboard: ["DAILY CAN-DO MISSION", "SRS ĐẾN HẠN", "N\\+1 INPUT", "MỘT LỖI CẦN SỬA", "TIẾP TỤC GẦN ĐÂY"],
    pathways: ["FOUR PARALLEL PATHS", "Foundation", "Communication", "Academic & Exams", "Life & Career"],
    "practice-hub": ["DELIBERATE PRACTICE", "Active Vocabulary", "Error Clinic"],
    explore: ["TOOLS, NOT DISTRACTIONS", "Xuất JSON", "Xuất CSV", "In / lưu PDF"],
    mistakes: ["MISTAKE NOTEBOOK", "Không có lỗi"]
  };
  for (const [activeView, expected] of Object.entries(markers)) {
    const html = os.renderView({ ...base, activeView, learningOS: { ...base.learningOS } }, context);
    expected.forEach((marker) => assert.match(html, new RegExp(marker)));
  }
});

test("guided player has twelve sequential steps and never marks skip as complete", () => {
  assert.equal(os.lessonSteps.length, 12);
  const lesson = { id: "lesson-1", title: "Introduce yourself", canDo: "Tự giới thiệu", level: "A0", dialogue: "Lan: Hello, I am Lan.", vocabulary: [["hello", "/həˈloʊ/", "xin chào", "Hello."]], exercises: [{ prompt: "Chọn nghĩa", answer: "xin chào", options: ["xin chào", "tạm biệt"] }] };
  const state = os.normalizeState({ activeView: "lesson", activeLesson: lesson.id });
  const html = os.renderView(state, { getLesson: () => lesson, allLessons: [lesson] });
  assert.match(html, /data-hheo-player="lesson-1"/);
  assert.match(html, /BƯỚC 1\/12/);
  assert.match(html, /Checkpoint tự lưu sau mỗi bước/);
  assert.match(html, /data-hheo-step-skip/);
});

test("learning cockpit groups the guided player into six purposeful visual layers", () => {
  assert.deepEqual(os.learningPhases.map((item) => item.id), ["input", "decode", "recall", "speak", "create", "master"]);
  assert.equal(os.phaseForStep("context").id, "input");
  assert.equal(os.phaseForStep("shadow").id, "speak");
  assert.equal(os.phaseForStep("summary").id, "master");
  const lesson = { id: "layered-lesson", title: "Layered practice", canDo: "Đi từng lớp", level: "A1", dialogue: "Hello there.", vocabulary: [["hello", "", "xin chào", "Hello there."]], exercises: [{ prompt: "Chọn nghĩa", answer: "xin chào", options: ["xin chào", "tạm biệt"] }] };
  const html = os.renderView(os.normalizeState({ activeView: "lesson", activeLesson: lesson.id }), { getLesson: () => lesson, allLessons: [lesson] });
  assert.match(html, /hheo-phase-rail/);
  assert.match(html, /hheo-player-atmosphere/);
  assert.match(html, /TIẾP THEO ·/);
  assert.match(html, /Checkpoint tự lưu/);
});

test("wrong production feedback keeps the expected answer out of the rendered response", () => {
  const source = fs.readFileSync(path.join(root, "english-learning-os.js"), "utf8");
  assert.match(source, /Đáp án vẫn được khóa/);
  assert.doesNotMatch(source, /Phương án: \$\{esc\(expected\)\}/);
});

test("checkpoint mutation survives normalization and moves to the next step", () => {
  const state = os.normalizeState({ activeView: "lesson", activeLesson: "lesson-1" });
  os.completeCurrentStep(state, "lesson-1");
  const checkpoint = os.currentCheckpoint(state, "lesson-1");
  assert.equal(checkpoint.step, 1);
  assert.deepEqual(checkpoint.completedSteps, ["context"]);
  assert.deepEqual(checkpoint.skippedSteps, []);
});

test("asset loader, offline cache, scoped storage and responsive accessibility are wired", () => {
  const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const client = fs.readFileSync(path.join(root, "english-learning.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "english-learning-os.css"), "utf8");
  for (const asset of ["english-learning-os.css?v=3", "english-learning-os.js?v=7", "english-learning.js?v=28"]) assert.match(loader + worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  for (const contract of ["STORAGE_PREFIX", "ownerId", "learnerProfileId", "scopedStorageKey", "credentials: \"include\"", "LEARNING_REVISION_CONFLICT"]) assert.match(client + fs.readFileSync(path.join(root, "services", "englishLearningSync.js"), "utf8"), new RegExp(contract));
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media print/);
});
