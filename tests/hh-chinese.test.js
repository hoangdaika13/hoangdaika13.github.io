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
  assert.match(source, /CONSTELLATION ROADMAP/);
  assert.match(source, /data-hhc-stage/);
  assert.match(source, /data-hhc-detail-tab/);
  assert.match(source, /data-hhc-word-note/);
  assert.match(source, /canvas\.dataset\.hhcPoints = String\(points\)/);
  assert.match(source, /Hoàn tác xóa từ cá nhân/);
  assert.match(source, /vocabLearnedToday/);
  assert.match(source, /hhc-stroke-track is-collapsed/);
  assert.match(source, /BEGINNER_VIEWS/);
  assert.match(css, /\.hhc-today-dashboard/);
  assert.match(css, /\.hhc-onboarding-grid/);
  assert.match(css, /\.hhc-bottom-nav/);
  assert.match(css, /\.hhc-global-results/);
  assert.match(css, /\.hhc-v7\[data-motion="static"\]/);
  assert.match(css, /\.hhc-v7\[data-view="vocabulary"\]/);
  assert.match(css, /hhc-v8-pitch-wave/);
  assert.match(css, /hhc-v8-wave-ring/);
  assert.match(css, /hhc-learning-path-mini/);
  assert.match(css, /v9 zero-gray guarantee/);
  assert.match(css, /hhc-v9-glass-sheen/);
  assert.match(css, /font-size: clamp\(56px/);
});

test("HH Chinese interaction handlers persist real learning actions", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } };
  global.localStorage = storage;
  global.fetch = undefined;
  global.document = { addEventListener() {}, getElementById() { return null; }, scrollingElement: { scrollTop: 0 }, visibilityState: "visible" };
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const makeTarget = (dataset) => ({ dataset, value: "", textContent: "", closest() { return this; }, setAttribute() {}, matches(selector) { const match = selector.match(/\[data-([\w-]+)/); return match ? Object.prototype.hasOwnProperty.call(this.dataset, camel(match[1])) : selector === "button"; } });
  const mountScenario = (view, state, inputs = {}) => {
    storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify(Object.assign({ onboardingComplete: true, uiMode: "full" }, state));
    const listeners = {};
    const host = { innerHTML: "", addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, querySelector(selector) { return inputs[selector] || null; }, querySelectorAll() { return []; } };
    const api = chinese.mount(host, { view });
    return { api, fire(type, target) { (listeners[type] || []).forEach((listener) => listener({ target, key: "" })); } };
  };
  try {
    let scenario = mountScenario("pinyin", {});
    scenario.fire("click", makeTarget({ hhcTone: "3" }));
    assert.equal(scenario.api.state().tone, 3);

    scenario = mountScenario("vocabulary", {});
    scenario.fire("click", makeTarget({ hhcReveal: "" }));
    assert.equal(scenario.api.state().revealed, true);
    scenario.fire("click", makeTarget({ hhcGrade: "good" }));
    assert.equal(scenario.api.state().vocabLearnedToday, 1);

    scenario = mountScenario("grammar", {}, { "[data-hhc-grammar-answer]": { value: "我是学生。" } });
    scenario.fire("click", makeTarget({ hhcSubmitGrammar: "" }));
    assert.equal(scenario.api.state().grammarPracticeSubmitted, true);

    scenario = mountScenario("vocabulary", { personalDeck: [{ id: "cv-00001", hanzi: "学习", traditional: "學習", pinyin: "xue2 xi2", meaning: "học tập", level: "personal", source: "personal" }] });
    scenario.fire("click", makeTarget({ hhcRemoveWord: "cv-00001" }));
    assert.equal(scenario.api.state().personalDeck.length, 0);
    scenario.fire("click", makeTarget({ hhcUndoWord: "" }));
    assert.equal(scenario.api.state().personalDeck.length, 1);
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
  }
});

test("HH Chinese v11 exposes the complete Learning Cockpit experience", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const state = chinese.normalizeState({ onboardingComplete: true, view: "reading", pathwayLevel: 4, navGroup: "skills", lessonStep: 5, guideMode: "full", readerMode: true });
  assert.equal(state.navGroup, "skills");
  assert.equal(state.lessonStep, 5);
  assert.equal(state.guideMode, "full");
  assert.equal(state.readerMode, true);
  assert.match(source, /COCKPIT_GROUPS/);
  assert.match(source, /data-hhc-command-toggle/);
  assert.match(source, /data-hhc-command-search/);
  assert.match(source, /data-hhc-progress-toggle/);
  assert.match(source, /data-hhc-reader-toggle/);
  assert.match(source, /data-hhc-quick-review/);
  assert.match(source, /data-hhc-lesson-step/);
  assert.match(source, /hhc-mistake-drawer/);
  assert.match(source, /hhc-mini-player/);
  assert.match(source, /hhc-heatmap/);
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(css, /v11 Learning Cockpit/);
  assert.match(css, /\.hhc-v11\.is-reader-mode/);
  assert.match(css, /\.hhc-progress-inspector/);
  assert.match(css, /hhc-v11-pitch/);
  assert.match(css, /hhc-v11-stroke/);
  assert.match(css, /data-hsk="9"/);
  assert.match(loader, /hh-chinese\.css\?v=11/);
  assert.match(loader, /hh-chinese\.js\?v=11/);
  assert.match(worker, /hh-identity-portal-v746/);
  assert.match(worker, /hh-chinese\.css\?v=11/);
  assert.match(worker, /hh-chinese\.js\?v=11/);
});
