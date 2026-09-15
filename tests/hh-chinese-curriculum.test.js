"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const curriculum = require(path.join(root, "hh-chinese-curriculum.js"));
const chinese = require(path.join(root, "hh-chinese.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const unique = (rows) => new Set(rows.map((row) => row.id)).size === rows.length;

test("HH Chinese v14 publishes a bounded nine-level authored curriculum", () => {
  assert.equal(curriculum.VERSION, 1);
  assert.equal(curriculum.LEVEL_PACKS.length, 9);
  assert.deepEqual(curriculum.LEVEL_PACKS.map((pack) => pack.level), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(curriculum.VOCABULARY.length, 42);
  assert.equal(unique(curriculum.VOCABULARY), true);
  for (const word of curriculum.VOCABULARY) {
    assert.match(word.id, /^cnc-\d{3}$/);
    assert.ok(word.hanzi && word.pinyin && word.meaning && word.example && word.exampleVi);
    assert.equal(word.editorialStatus, curriculum.EDITORIAL_STATUS);
    assert.equal(word.reviewedAt, "2026-09-15");
    assert.equal(word.source, "HH Chinese curriculum v1");
  }
  assert.equal(curriculum.SOURCES.some((source) => source.id === "cvdict" && /CC BY-SA 4\.0/.test(source.license)), true);
});

test("HH Chinese v14 merges every practice collection without duplicating identifiers", () => {
  const expected = {
    CATALOG_WORDS: 100,
    GRAMMAR: 27,
    GRAMMAR_PRACTICE: 21,
    READINGS: 10,
    READING_QUESTIONS: 10,
    DICTATION_ITEMS: 10,
    EXAM_ITEMS: 18,
    CONVERSATION_SCENARIOS: 12,
    WRITING_PROMPTS: 9,
    DEEP_READINGS: 9,
    IDIOMS: 12,
    TONE_PAIR_DRILLS: 10,
    PRONUNCIATION_CONTRASTS: 8,
    VIETNAMESE_MODULES: 13
  };
  for (const [key, count] of Object.entries(expected)) {
    assert.equal(chinese[key].length, count, key);
    assert.equal(unique(chinese[key]), true, `${key} identifiers must be unique`);
  }
  for (const item of chinese.GRAMMAR_PRACTICE) {
    assert.ok(typeof item.answer === "string" && item.answer.length > 0);
  }
  for (const rows of [chinese.READING_QUESTIONS, chinese.EXAM_ITEMS, chinese.TONE_PAIR_DRILLS, chinese.PRONUNCIATION_CONTRASTS, chinese.VIETNAMESE_MODULES]) {
    for (const item of rows) {
      assert.ok(Array.isArray(item.options) && item.options.length >= 2);
      assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.options.length);
    }
  }
});

test("HH Chinese v14 migrates the old schedule and preserves new curriculum word state", () => {
  const legacy = chinese.CATALOG_WORDS.slice(0, 58).map((word, index) => ({
    id: word.id,
    dueAt: index,
    interval: index === 0 ? 3 : 0,
    reps: index === 0 ? 4 : 0,
    lapses: index === 0 ? 1 : 0
  }));
  const state = chinese.normalizeState({
    onboardingComplete: true,
    due: legacy,
    wordNotes: { "cnc-059": "ghi chú mới" },
    recentWords: ["cnc-059", "cn-001"],
    translationDirection: "zh-vi"
  });
  assert.equal(state.due.length, 100);
  assert.deepEqual(state.due[0], legacy[0]);
  assert.equal(state.due.find((card) => card.id === "cnc-100").reps, 0);
  assert.equal(state.wordNotes["cnc-059"], "ghi chú mới");
  assert.deepEqual(state.recentWords, ["cnc-059", "cn-001"]);
  assert.equal(state.translationDirection, "zh-vi");
});

test("HH Chinese v14 assessment helpers stay transparent and accept authored variants", () => {
  const grammar = { answer: "我明天去北京。", alternatives: ["明天我去北京。"] };
  assert.equal(chinese.bestAnswerScore(grammar, "明天我去北京"), 100);
  const writing = chinese.writingAssessment("我每天学习中文，因为我想和朋友交流。", {
    target: "viết một câu có 因为",
    rubric: ["Nêu thói quen", "Dùng 因为"]
  });
  assert.equal(writing.checks.length, 4);
  assert.ok(writing.score >= 50 && writing.score <= 100);
  const shortScore = chinese.scoreReadingSummary({ text: "小王每天学习中文，因为他想去北京工作。" }, "小王学习");
  const coveredScore = chinese.scoreReadingSummary({ text: "小王每天学习中文，因为他想去北京工作。" }, "小王每天学习中文，因为他想去北京工作。");
  assert.ok(coveredScore > shortScore);
});

test("HH Chinese v15 ships functional Vietnamese labs and the unified neon cosmic surface", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const notice = read("assets/chinese/NOTICE.md");
  for (const marker of ["VIETNAMESE EAR LAB", "CHINESE FOR VIETNAMESE", "Dịch hai chiều", "data-hhc-submit-contrast", "data-hhc-submit-vietnamese", "data-hhc-translation-direction", "persisted.lastSrsMutation"] ) {
    assert.match(source, new RegExp(marker));
  }
  for (const marker of ["v14 curriculum expansion", "v15 Cosmic Creative Studio", "hhc-curriculum-coverage", "hhc-pronunciation-contrast", "hhc-vietnamese-module-tabs", "hhc-writing-checks", "focus-visible", "prefers-reduced-motion", "min-width:821px", "hhc-v14.is-progress-open > .hhc-cockpit-grid", "hhc-v15", "--hhc-cyan:#5de7ff", "hhc-v15-star-drift"]) {
    assert.match(css, new RegExp(marker));
  }
  assert.match(source, /hhc-v15/);
  assert.match(loader, /hh-chinese-curriculum\.js\?v=1/);
  assert.match(loader, /hh-chinese\.css\?v=15/);
  assert.match(worker, /hh-identity-portal-v1014/);
  assert.match(worker, /hh-chinese-curriculum\.js\?v=1/);
  assert.match(worker, /hh-chinese\.css\?v=15/);
  assert.match(worker, /hh-chinese\.js\?v=15/);
  assert.match(index, /Release v1014 HH Chinese Cosmic Creative Studio/);
  assert.match(index, /performance-loader\.js\?v=673/);
  assert.match(notice, /hh-authored-needs-linguist-review/);
  assert.match(notice, /No external code, audio, images or third-party curriculum data were copied/);
});
