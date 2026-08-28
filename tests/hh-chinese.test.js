"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chinese = require(path.join(root, "hh-chinese.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("HH Chinese exposes a local-first HSK workspace with core skills", () => {
  assert.equal(chinese.VERSION, 2);
  assert.equal(chinese.WORDS.length, 40);
  assert.equal(chinese.LARGE_CATALOG_COUNT, 50000);
  assert.match(chinese.LARGE_CATALOG_URL, /cvdict-50k\.json\.gz$/);
  assert.equal(chinese.VIEWS.length, 19);
  for (const view of ["path", "pinyin", "vocabulary", "hanzi", "reading", "grammar", "speaking", "exam", "dictionary", "conversation", "writing", "hanzi-observatory", "reading-nebula", "translation", "idiom", "vietnamese", "culture", "review"]) {
    assert.equal(chinese.supports(view), true);
  }
});

test("HH Chinese v12 adds complete curriculum layers with honest capability gates", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  assert.equal(chinese.TONE_PAIR_DRILLS.length, 6);
  assert.equal(chinese.RADICAL_GUIDES.length, 12);
  assert.equal(chinese.MEASURE_WORDS.length, 12);
  assert.equal(chinese.MEASURE_WORD_DRILLS.length, 4);
  assert.equal(chinese.CULTURE_NOTES.length, 8);
  assert.equal(chinese.supports("path"), true);
  assert.equal(chinese.supports("culture"), true);
  assert.equal(chinese.supports("review"), true);
  const normalized = chinese.normalizeState({ view: "review", tonePairIndex: 999, measureWordIndex: -2, cultureFilter: "invalid", reviewMode: "invalid" });
  assert.equal(normalized.tonePairIndex, chinese.TONE_PAIR_DRILLS.length - 1);
  assert.equal(normalized.measureWordIndex, 0);
  assert.equal(normalized.cultureFilter, "all");
  assert.equal(normalized.reviewMode, "due");
  assert.deepEqual(Object.keys(chinese.browserCapabilityStatus()).sort(), ["handwriting", "recognition", "synthesis"]);
  assert.match(source, /TONE PAIR LAB/);
  assert.match(source, /MEASURE WORD LAB/);
  assert.match(source, /RADICAL STARTER LIBRARY/);
  assert.match(source, /CULTURE IN CONTEXT/);
  assert.match(source, /REVIEW CENTER/);
  assert.match(source, /không phải điểm phát âm/);
  assert.match(source, /HH Chinese không phát audio giả/);
  assert.match(source, /HHLanguageLearningCore/);
  assert.match(source, /recordCoreEvidence/);
  assert.match(source, /reviewCoreCard/);
  assert.match(css, /v12 curriculum rooms/);
  assert.match(css, /hhc-tone-pair-lab/);
  assert.match(css, /hhc-measure-word-lab/);
  assert.match(css, /hhc-radical-library/);
  assert.match(css, /hhc-culture-grid/);
  assert.match(css, /hhc-review-mode-grid/);
  assert.match(css, /scrollbar-gutter:stable/);
});

test("HH Chinese uses a restrained vermilion, antique-gold, ink and ivory surface", () => {
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  for (const marker of ["TRUNG TÂM HÁN NGỮ", "BẢN ĐỒ KỸ NĂNG", "Grammar Lab", "Speaking Lab", "DEEP READING"]) assert.match(source, new RegExp(marker));
  for (const marker of ["Chinese heritage surface", "#160d0a", "#e0b75e", "#fff4d7", "hhc-heritage-seal"]) assert.match(css, new RegExp(marker));
  assert.doesNotMatch(source, /MANDARIN GALAXY|SKILL CONSTELLATION|会话银河|星际词典/);
});

test("HH Chinese v12 mounts every new curriculum room as functional content", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  global.localStorage = { getItem() { return JSON.stringify({ onboardingComplete: true, uiMode: "full", pathwayLevel: 3 }); }, setItem() {} };
  global.document = { addEventListener() {}, visibilityState: "visible" };
  try {
    for (const [view, marker] of [["path", "CHINESE PATH"], ["culture", "CULTURE IN CONTEXT"], ["review", "REVIEW CENTER"], ["pinyin", "TONE PAIR LAB"], ["grammar", "MEASURE WORD LAB"], ["hanzi-observatory", "RADICAL STARTER LIBRARY"]]) {
      const host = { innerHTML: "", addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
      chinese.mount(host, { view });
      assert.match(host.innerHTML, new RegExp(marker));
    }
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
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

test("HH Chinese reports real evidence and SRS ratings to the shared learning core when present", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const previousCore = global.HHLanguageLearningCore;
  const calls = { evidence: [], review: [] };
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } };
  global.localStorage = storage;
  global.fetch = undefined;
  global.document = { addEventListener() {}, getElementById() { return null; }, scrollingElement: { scrollTop: 0 }, visibilityState: "visible" };
  global.HHLanguageLearningCore = {
    recordEvidence(language, learner, input) { calls.evidence.push({ language, learner, input }); return { duplicate: false, completed: input.completed }; },
    reviewCard(language, learner, cardId, grade) { calls.review.push({ language, learner, cardId, grade }); return { cardId, lastRating: grade }; }
  };
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const target = (dataset) => ({ dataset, closest() { return this; }, matches(selector) { const match = selector.match(/\[data-([\w-]+)/); return match ? Object.prototype.hasOwnProperty.call(this.dataset, camel(match[1])) : selector === "button"; } });
  try {
    storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify({ onboardingComplete: true, uiMode: "full", view: "vocabulary", revealed: true });
    const listeners = {};
    const host = { innerHTML: "", addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, querySelector() { return null; }, querySelectorAll() { return []; } };
    chinese.mount(host, { view: "vocabulary" });
    (listeners.click || []).forEach((listener) => listener({ target: target({ hhcGrade: "good", hhcWord: "cn-001" }) }));
    assert.equal(calls.review.length, 1);
    assert.equal(calls.review[0].language, "chinese");
    assert.equal(calls.review[0].grade, "good");
    assert.equal(calls.evidence.length, 1);
    assert.equal(calls.evidence[0].input.kind, "review");
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
    global.HHLanguageLearningCore = previousCore;
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
  assert.match(worker, /hh-identity-portal-v822/);
  assert.match(worker, /hh-chinese\.css\?v=11/);
  assert.match(worker, /hh-chinese\.js\?v=11/);
});

test("HH Chinese preserves best streak and advances a local-day streak only once per goal day", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } };
  const localDay = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const target = (dataset) => ({ dataset, closest() { return this; }, matches(selector) { const match = selector.match(/\[data-([\w-]+)/); return match ? Object.prototype.hasOwnProperty.call(this.dataset, camel(match[1])) : selector === "button"; } });
  const mount = (state) => {
    storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify(Object.assign({ onboardingComplete: true, uiMode: "full", view: "pinyin" }, state));
    const listeners = {}, host = { innerHTML: "", addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, querySelector() { return null; }, querySelectorAll() { return []; } };
    const api = chinese.mount(host, { view: "pinyin" });
    return { api, fire(dataset) { (listeners.click || []).forEach((listener) => listener({ target: target(dataset) })); } };
  };
  global.localStorage = storage;
  global.fetch = undefined;
  global.document = { addEventListener() {}, getElementById() { return null; }, scrollingElement: { scrollTop: 0 }, visibilityState: "visible" };
  try {
    assert.equal(chinese.normalizeState({ streak: 7, bestStreak: 12 }).bestStreak, 12);
    let scenario = mount({ dailyGoal: 1, studyDay: localDay(-1), todayReviews: 1, lastGoalDay: localDay(-1), streak: 3, bestStreak: 5 });
    scenario.fire({ hhcToneOption: "0" });
    scenario.fire({ hhcSubmitTone: "" });
    assert.equal(scenario.api.state().streak, 4);
    assert.equal(scenario.api.state().bestStreak, 5);
    assert.equal(scenario.api.state().lastGoalDay, localDay(0));
    scenario.fire({ hhcToneTrainerOption: "0" });
    scenario.fire({ hhcSubmitToneTrainer: "" });
    assert.equal(scenario.api.state().streak, 4, "a second exercise on the same goal day must not extend the streak");

    chinese.unmount();
    scenario = mount({ dailyGoal: 1, studyDay: localDay(-3), todayReviews: 1, lastGoalDay: localDay(-3), streak: 4, bestStreak: 6 });
    scenario.fire({ hhcToneOption: "0" });
    scenario.fire({ hhcSubmitTone: "" });
    assert.equal(scenario.api.state().streak, 1, "a calendar-day gap resets the active streak");
    assert.equal(scenario.api.state().bestStreak, 6, "the historical record survives a reset");
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
  }
});

test("HH Chinese keeps dictionary and idiom focus, caret and workspace scroll through rerenders", async () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const previousRaf = global.requestAnimationFrame;
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } };
  const documentStub = { activeElement: null, addEventListener() {}, getElementById() { return null; }, visibilityState: "visible" };
  const makeHost = (attribute) => {
    const listeners = {}, chrome = { classList: { add() {}, remove() {}, toggle() {} } };
    const host = {
      ownerDocument: documentStub,
      _html: "",
      _input: null,
      _scroller: null,
      addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
      querySelector(selector) { if (selector === ".hhc-workspace-scroll" || selector === ".hhc-workspace") return this._scroller; if (selector === `[${attribute}]`) return this._input; if (selector === "[data-hh-chinese]") return chrome; return null; },
      querySelectorAll() { return []; },
      contains(element) { return Boolean(element && element._host === this); },
      fire(type, target) { (listeners[type] || []).forEach((listener) => listener({ target, key: "" })); }
    };
    Object.defineProperty(host, "innerHTML", {
      get() { return this._html; },
      set(markup) {
        if (documentStub.activeElement && documentStub.activeElement._host === this) documentStub.activeElement = null;
        this._html = String(markup);
        this._scroller = { scrollTop: 0, scrollLeft: 0 };
        const match = new RegExp(`${attribute}[^>]*value="([^"]*)"`).exec(this._html), value = match ? match[1] : "";
        this._input = {
          _host: this, value, selectionStart: 0, selectionEnd: 0, selectionDirection: "none", scrollTop: 0, scrollLeft: 0,
          hasAttribute(name) { return name === attribute; }, getAttribute(name) { return name === attribute ? "" : null; },
          matches(selector) { return selector.includes(attribute); }, focus() { documentStub.activeElement = this; },
          setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
        };
      }
    });
    return host;
  };
  global.document = documentStub;
  global.localStorage = storage;
  global.fetch = undefined;
  global.requestAnimationFrame = (callback) => { callback(); return 1; };
  try {
    for (const [view, attribute, stateKey] of [["dictionary", "data-hhc-dictionary-input", "dictionaryQuery"], ["idiom", "data-hhc-idiom-input", "idiomQuery"]]) {
      storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify({ onboardingComplete: true, uiMode: "full", view });
      const host = makeHost(attribute), api = chinese.mount(host, { view }), before = host._input;
      before.value = "abcdef"; before.selectionStart = 2; before.selectionEnd = 5; before.selectionDirection = "forward"; before.scrollTop = 9; before.focus();
      host._scroller.scrollTop = 321; host._scroller.scrollLeft = 17;
      host.fire("input", before);
      await new Promise((resolve) => setTimeout(resolve, 170));
      assert.notEqual(host._input, before);
      assert.equal(documentStub.activeElement, host._input, `${view} input should regain focus`);
      assert.deepEqual([host._input.selectionStart, host._input.selectionEnd], [2, 5]);
      assert.deepEqual([host._scroller.scrollTop, host._scroller.scrollLeft], [321, 17]);
      assert.equal(api.state()[stateKey], "abcdef");
      chinese.unmount();
    }
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
    global.requestAnimationFrame = previousRaf;
  }
});

test("Deep Reading summary state is isolated from Translation Lab and resets per article", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } };
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const target = (dataset, value = "") => ({ dataset, value, closest() { return this; }, matches(selector) { const match = selector.match(/\[data-([\w-]+)/); return match ? Object.prototype.hasOwnProperty.call(this.dataset, camel(match[1])) : selector === "button"; } });
  global.localStorage = storage;
  global.fetch = undefined;
  global.document = { addEventListener() {}, getElementById() { return null; }, scrollingElement: { scrollTop: 0 }, visibilityState: "visible" };
  try {
    storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify({ onboardingComplete: true, uiMode: "full", view: "reading-nebula", translationInput: "bản dịch cũ", translationSubmitted: true });
    const listeners = {}, host = { innerHTML: "", addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, querySelector() { return null; }, querySelectorAll() { return []; } };
    const api = chinese.mount(host, { view: "reading-nebula" });
    const fire = (type, input) => (listeners[type] || []).forEach((listener) => listener({ target: input, key: "" }));
    fire("input", target({ hhcReadingSummary: "" }, "Đây là một bản tóm tắt đủ dài để kiểm tra trạng thái riêng của bài đọc chuyên sâu."));
    fire("click", target({ hhcSubmitNebula: "" }));
    assert.equal(api.state().readingSummarySubmitted, true);
    assert.equal(api.state().translationInput, "bản dịch cũ");
    assert.equal(api.state().translationSubmitted, true);
    fire("click", target({ hhcReadingNebula: "1" }));
    assert.equal(api.state().readingSummaryInput, "");
    assert.equal(api.state().readingSummarySubmitted, false);
    assert.equal(api.state().readingSummaryScore, null);
    assert.equal(api.state().translationInput, "bản dịch cũ", "changing a reading must not erase Translation Lab work");
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
  }
});

test("Lesson completion requires and consumes evidence from a real exercise", () => {
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const previousFetch = global.fetch;
  const previousCore = global.HHLanguageLearningCore;
  const storage = { data: {}, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; } }, evidence = [];
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const target = (dataset) => ({ dataset, textContent: "", closest() { return this; }, matches(selector) { const match = selector.match(/\[data-([\w-]+)/); return match ? Object.prototype.hasOwnProperty.call(this.dataset, camel(match[1])) : selector === "button"; } });
  global.localStorage = storage;
  global.fetch = undefined;
  global.document = { addEventListener() {}, getElementById() { return null; }, scrollingElement: { scrollTop: 0 }, visibilityState: "visible" };
  global.HHLanguageLearningCore = { recordEvidence(language, learner, input) { evidence.push(input); return { duplicate: false, completed: input.completed }; }, reviewCard() { return {}; } };
  try {
    storage.data[chinese.STORAGE_KEY + ":guest"] = JSON.stringify({ onboardingComplete: true, uiMode: "full", view: "pinyin", lessonStep: 1 });
    const listeners = {}, host = { innerHTML: "", addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, querySelector() { return null; }, querySelectorAll() { return []; } };
    const api = chinese.mount(host, { view: "pinyin" }), click = (dataset) => (listeners.click || []).forEach((listener) => listener({ target: target(dataset) }));
    for (let step = 2; step <= 6; step += 1) click({ hhcLessonStep: String(step) });
    click({ hhcFinishLesson: "" });
    assert.equal(evidence.length, 0, "clicking the visual steps alone is not completion evidence");
    assert.equal(api.state().view, "pinyin");
    click({ hhcToneOption: "0" });
    click({ hhcSubmitTone: "" });
    assert.ok(api.state().lessonProofs["pinyin:1"]);
    click({ hhcLessonStep: "6" });
    click({ hhcFinishLesson: "" });
    assert.equal(evidence.filter((item) => item.kind === "lesson").length, 1);
    assert.equal(api.state().view, "dashboard");
    assert.equal(api.state().lessonProofs["pinyin:1"], undefined);
    click({ hhcFinishLesson: "" });
    assert.equal(evidence.filter((item) => item.kind === "lesson").length, 1, "one exercise proof can only complete one lesson");
  } finally {
    chinese.unmount();
    global.document = previousDocument;
    global.localStorage = previousStorage;
    global.fetch = previousFetch;
    global.HHLanguageLearningCore = previousCore;
  }
});

test("HH Chinese v13 loads active assets and its heritage overrides win over legacy cosmic surfaces", () => {
  const css = read("hh-chinese.css");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /hh-chinese\.css\?v=13/);
  assert.match(loader, /hh-chinese\.js\?v=13/);
  assert.match(worker, /hh-chinese\.css\?v=13/);
  assert.match(worker, /hh-chinese\.js\?v=13/);
  assert.match(css, /--hhc-hsk:#e4b859;--hhc-hsk-rgb:228,184,89/);
  for (const selector of ["hhc-cockpit-topbar", "hhc-cockpit-sidebar", "hhc-cockpit-actionbar", "hhc-command-palette", "hhc-drawer", "hhc-mini-player", "hhc-toast", "hhc-progress-ring"]) {
    assert.match(css, new RegExp(`hh-chinese\\.hhc-v11 \\.${selector}[^}]+!important`));
  }
  assert.match(css, /is-reader-mode \.hhc-workspace-scroll[^}]+#24130f[^}]+!important/);
  assert.match(css, /is-exam-focus \.hhc-workspace[^}]+#2b1712[^}]+!important/);
});
