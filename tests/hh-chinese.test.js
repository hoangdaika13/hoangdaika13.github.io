"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chinese = require(path.join(root, "hh-chinese.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("HH Chinese exposes a local-first HSK workspace with core skills", () => {
  assert.equal(chinese.VERSION, 1);
  assert.equal(chinese.WORDS.length, 40);
  assert.equal(chinese.LARGE_CATALOG_COUNT, 50000);
  assert.match(chinese.LARGE_CATALOG_URL, /cvdict-50k\.json\.gz$/);
  assert.equal(chinese.VIEWS.length, 16);
  for (const view of ["pinyin", "vocabulary", "hanzi", "reading", "grammar", "speaking", "exam", "dictionary", "conversation", "writing", "hanzi-observatory", "reading-nebula", "translation", "idiom", "vietnamese"]) {
    assert.equal(chinese.supports(view), true);
  }
});

test("Chinese SRS scheduling is deterministic and bounded", () => {
  const card = { id: "cn-001", dueAt: 0, interval: 0, reps: 0, lapses: 0 };
  assert.equal(chinese.scheduleReview(card, "again", 0).interval, 0);
  assert.equal(chinese.scheduleReview(card, "good", 0).interval, 2);
  assert.equal(chinese.scheduleReview(card, "easy", 0).interval, 6);
  assert.equal(chinese.scheduleReview(card, "again", 0).lapses, 1);
});

test("HH Chinese protects answer flow and labels browser capabilities honestly", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const notice = read("assets/chinese/NOTICE.md");
  assert.match(source, /Đáp án đang ở sau màn sương/);
  assert.match(source, /SpeechRecognition/);
  assert.match(source, /HSK 3\.0/);
  assert.match(css, /\.hh-orbit-scene|\.hhc-orbit-scene/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(script, /id: "chinese", label: "HH Chinese"/);
  assert.match(script, /route === "\/chinese"/);
  assert.match(loader, /hh-chinese\.css\?v=1/);
  assert.match(loader, /hh-chinese\.js\?v=1/);
  assert.match(worker, /hh-chinese\.css\?v=1/);
  assert.match(worker, /hh-chinese\.js\?v=1/);
  assert.match(notice, /chinesetest\.cn\/HSK/);
  assert.match(notice, /CC-CEDICT/);
});

test("Vietnamese pathway starts at zero and reaches the HSK 9 destination honestly", () => {
  assert.equal(chinese.CATALOG_WORDS.length, 58);
  assert.equal(chinese.EXTENDED_WORDS.length, 18);
  assert.equal(chinese.HSK_PATHWAY[0].id, "zero");
  assert.equal(chinese.HSK_PATHWAY.at(-1).level, 9);
  const beginner = chinese.normalizeState({ onboardingComplete: false, entryLevel: "zero", pathwayLevel: 0 });
  const advanced = chinese.normalizeState({ onboardingComplete: true, entryLevel: "returning", level: "7-9", pathwayLevel: 9 });
  assert.equal(beginner.onboardingComplete, false);
  assert.equal(beginner.targetLevel, "9");
  assert.equal(advanced.level, "7-9");
  assert.equal(advanced.pathwayLevel, 9);
  assert.equal(advanced.due.length, 58);
});

test("HH Chinese includes active-recall practice labs without leaking answers", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  assert.match(source, /SENTENCE BUILDER/);
  assert.match(source, /DICTATION ORBIT/);
  assert.match(source, /COMPREHENSION CHECK/);
  assert.match(source, /data-hhc-check-recall/);
  assert.match(source, /data-hhc-submit-grammar/);
  assert.match(source, /data-hhc-submit-dictation/);
  assert.match(source, /data-hhc-submit-reading-check/);
  assert.match(css, /hhc-practice-feedback/);
});

test("HH Chinese ships a provenance-labelled lazy 50k lookup catalog", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const notice = read("assets/chinese/NOTICE.md");
  const meta = JSON.parse(read("assets/chinese/cvdict-50k.meta.json"));
  assert.equal(meta.count, 50000);
  assert.ok(meta.compressedBytes > 1000000);
  assert.match(meta.sha256, /^[a-f0-9]{64}$/);
  assert.match(meta.source, /ph0ngp\/CVDICT/);
  assert.match(meta.sourceLicense, /CC BY-SA 4\.0/);
  assert.match(source, /cvdict-50k\.json\.gz/);
  assert.match(source, /DecompressionStream/);
  assert.match(source, /Không thể tải catalog mở rộng/);
  assert.match(source, /CVDICT · Chinese–Vietnamese/);
  assert.match(source, /largeCatalog: null/);
  assert.match(css, /\.hhc-catalog-status/);
  assert.match(css, /hhc-spectrum-scan/);
  assert.match(css, /--hhc-muted: #c7c9ff/);
  assert.match(notice, /exactly 50,000/);
  assert.match(notice, /CC BY-SA 4\.0/);
});

test("HH Chinese keeps personal study words bounded and adds focused learning rooms", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const personal = chinese.normalizeState({ onboardingComplete: true, personalDeck: [{ id: "cv-00001", hanzi: "学习", traditional: "學習", pinyin: "xue2 xi2", meaning: "học tập", pos: "động từ" }], due: [{ id: "cv-00001", lapses: 3 }] });
  assert.equal(personal.personalDeck.length, 1);
  assert.equal(personal.due.some((row) => row.id === "cv-00001"), true);
  assert.match(source, /Đưa vào bộ học/);
  assert.match(source, /TONE_TRAINER/);
  assert.match(source, /CONVERSATION_SCENARIOS/);
  assert.match(source, /runLearningAI/);
  assert.match(source, /Xuất Anki/);
  assert.match(css, /hhc-mission-15/);
  assert.match(css, /hhc-tone-trainer/);
  assert.match(css, /hhc-word-detail/);
  assert.match(css, /prefers-reduced-motion/);
});

test("HH Chinese v7 gives beginners a focused route and preserves the full workspace", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const beginner = chinese.normalizeState({ onboardingComplete: true, uiMode: "beginner", pathwayLevel: 0, goalLevel: "9", motionMode: "balanced" });
  const full = chinese.normalizeState({ onboardingComplete: true, uiMode: "full", pathwayLevel: 9, motionMode: "cinematic" });
  assert.equal(beginner.uiMode, "beginner");
  assert.equal(beginner.goalLevel, "9");
  assert.equal(beginner.motionMode, "balanced");
  assert.equal(full.uiMode, "full");
  assert.equal(full.motionMode, "cinematic");
  assert.match(source, /CHƯƠNG TRÌNH BẢY NGÀY ĐẦU TIÊN/);
  assert.match(source, /Hướng dẫn viên HH/);
  assert.match(source, /data-hhc-global-search/);
  assert.match(source, /data-hhc-script/);
  assert.match(source, /data-hhc-detail-tab/);
  assert.match(source, /data-hhc-word-note/);
  assert.match(source, /BEGINNER_VIEWS/);
  assert.match(css, /\.hhc-today-dashboard/);
  assert.match(css, /\.hhc-onboarding-grid/);
  assert.match(css, /\.hhc-bottom-nav/);
  assert.match(css, /\.hhc-global-results/);
  assert.match(css, /\.hhc-v7\[data-motion="static"\]/);
  assert.match(css, /\.hhc-v7\[data-view="vocabulary"\]/);
  assert.match(css, /font-size: clamp\(56px/);
});
