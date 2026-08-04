const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const everyone = require(path.join(root, "english-for-everyone.js"));
const vocabulary = require(path.join(root, "english-vocabulary.js"));

test("HH English defines six independent age experience modes", () => {
  assert.deepEqual(everyone.ageModes.map((item) => item.id), ["little", "kids", "teens", "student", "adult", "senior"]);
  assert.equal(new Set(everyone.ageModes.map((item) => item.id)).size, 6);
  assert.ok(everyone.ageModes.every((item) => item.words >= item.minWords && item.minutes >= 5 && item.rate > 0));
  assert.deepEqual(everyone.cefrLevels, ["PRE-A1", "A1", "A2", "B1", "B2", "C1", "C2"]);
});

test("Universal Learner Profile keeps age, CEFR, goal and support independent", () => {
  const state = everyone.normalizeState({
    selectedLevel: "C1",
    universalProfile: { ageMode: "senior", level: "B2", goal: "travel", minutes: 12, dialect: "uk", support: { largeText: true, hearingSupport: true } }
  });
  assert.equal(state.universalProfile.ageMode, "senior");
  assert.equal(state.universalProfile.level, "B2");
  assert.equal(state.universalProfile.goal, "travel");
  assert.equal(state.universalProfile.dialect, "uk");
  assert.equal(state.universalProfile.support.largeText, true);
  assert.equal(state.universalProfile.support.hearingSupport, true);
});

test("Adaptive Lesson Player changes word count and speed by mode and real mistakes", () => {
  const little = everyone.lessonPolicy({ universalProfile: { ageMode: "little" }, galaxySession: { attempts: 0, correct: 0 } });
  const adult = everyone.lessonPolicy({ universalProfile: { ageMode: "adult" }, galaxySession: { attempts: 0, correct: 0 }, wordMastery: { recognize: { score: 70, attempts: 1, correct: 1 }, active: { score: 95, attempts: 3, correct: 3 } } });
  const strugglingAdult = everyone.lessonPolicy({ universalProfile: { ageMode: "adult" }, galaxySession: { attempts: 10, correct: 3 }, mistakeNotebook: Array.from({ length: 7 }, (_, index) => ({ word: `w${index}` })) });
  assert.equal(little.wordCount, 5);
  assert.equal(little.interaction, "listen-picture");
  assert.equal(little.tutorPolicy, "guided-only");
  assert.equal(adult.wordCount, 15);
  assert.equal(adult.recognitionVocabulary, 2);
  assert.equal(adult.activeVocabulary, 1);
  assert.equal(strugglingAdult.wordCount, 13);
  assert.equal(strugglingAdult.errorRate, 70);
  assert.equal(strugglingAdult.breakSuggested, true);
});

test("Vocabulary Lesson Player consumes the selected age policy", () => {
  globalThis.HHEnglishForEveryone = everyone;
  const words = Array.from({ length: 20 }, (_, index) => ({ term: `kidword${index}`, meaning: `nghĩa ${index}`, level: "A1", reviewed: true }));
  const lesson = vocabulary.buildLesson(words, { universalProfile: { ageMode: "little" }, galaxySession: { attempts: 0, correct: 0 } }, 15);
  assert.equal(lesson.words.length, 5);
});

test("Child modes force sensitive family permissions off until local guardian confirmation", () => {
  const state = everyone.normalizeState({ universalProfile: { ageMode: "kids" }, familyMode: { permissions: { aiTutor: true, recording: true, sharing: true, purchases: true } } });
  assert.equal(state.familyMode.enabled, true);
  assert.deepEqual(state.familyMode.permissions, { aiTutor: false, recording: false, sharing: false, purchases: false });
  const confirmed = everyone.normalizeState({ universalProfile: { ageMode: "kids" }, familyMode: { guardianStatus: "local-confirmed", permissions: { aiTutor: true, recording: true } } });
  assert.equal(confirmed.familyMode.permissions.aiTutor, true);
  assert.equal(confirmed.familyMode.permissions.recording, true);
});

test("Age-aware content metadata is explicit and filters reviewed content", () => {
  const entries = [
    { term: "apple", level: "A1", topic: "daily", meaning: "quả táo", reviewed: true },
    { term: "liability", level: "B2", topic: "law", meaning: "trách nhiệm pháp lý", reviewed: true }
  ];
  assert.deepEqual(everyone.contentForAge(entries, "little").map((item) => item.term), ["apple"]);
  assert.deepEqual(everyone.contentForAge(entries, "adult").map((item) => item.term), ["apple", "liability"]);
  const metadata = everyone.metadataForEntry(entries[0]);
  assert.equal(metadata.contentRating, "everyone");
  assert.equal(metadata.reviewStatus, "reviewed");
});

test("Family weekly report uses only persisted learning facts", () => {
  const now = Date.UTC(2026, 7, 4, 12);
  const report = everyone.weeklyReport({
    minutesByDay: { "2026-08-04": 12, "2026-08-03": 8, "2026-07-20": 99 },
    completed: { a: true, b: false, c: true }, savedWords: { one: {}, two: {} }, wordMastery: { one: { score: 95 }, two: { score: 60 } }
  }, now);
  assert.deepEqual(report, { minutes: 20, activeDays: 2, completedLessons: 2, savedWords: 2, mastered: 1 });
});

test("one-page family workspace exposes all requested content and accessibility contracts", () => {
  const source = fs.readFileSync(path.join(root, "english-for-everyone.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "english-for-everyone.css"), "utf8");
  const learning = fs.readFileSync(path.join(root, "english-learning.js"), "utf8");
  const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  for (const token of ["Universal Learner Profile", "Adaptive Lesson Player", "Phonics World", "Picture Vocabulary", "Story Adventure", "School English", "Exam Center", "Life English", "Career English", "Senior Conversation", "Family Challenge", "guided-only", "Không tin nhắn riêng", "Không quảng cáo cá nhân hóa", "WCAG-aware"]) assert.match(`${source}\n${css}`, new RegExp(token, "i"));
  assert.match(learning, /HH SMART START · 4 BƯỚC/);
  assert.match(learning, /data-hhe-onboarding-dot="4"/);
  assert.match(learning, /data-view="\$\{state\.activeView\}"[^>]*data-age-mode/);
  for (const asset of ["english-for-everyone.css?v=1", "english-for-everyone.js?v=2", "english-learning.js?v=22"]) assert.match(loader + serviceWorker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  assert.match(css, /height:calc\(100dvh - 180px\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /data-dyslexia/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
