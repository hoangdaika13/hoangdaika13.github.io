const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-vocabulary-10k.js"));
require(path.join(root, "japanese-vietnamese-pack.js"));
require(path.join(root, "japanese-learning.js"));
require(path.join(root, "japanese-os-v3.js"));
require(path.join(root, "japanese-vocabulary-v4.js"));
require(path.join(root, "japanese-sentence-bank-v5.js"));
require(path.join(root, "japanese-kanjivg-v5.js"));
require(path.join(root, "japanese-os-v4.js"));

test("HH Japanese OS V5 exposes the complete one-page active-learning workspace", () => {
  const os = globalThis.HHJapaneseOSV5;
  assert.equal(os.version, 5);
  assert.equal(globalThis.HHJapaneseOSV4, os, "V4 alias remains for old route integrations");
  assert.equal(globalThis.HHJapanese.osVersion, 5);
  assert.deepEqual(os.tabs.map((row) => row[0]), ["today", "paths", "practice", "lookup", "immersion", "progress"]);
  assert.deepEqual(os.paths.map((row) => row.id), ["jlpt", "jf", "life", "career"]);
  assert.equal(os.missions.length, 800);
  assert.equal(os.particleLabs.length, 8);
  assert.equal(os.conversations.length, 10);
  assert.equal(os.writingTasks.length, 8);
  assert.equal(os.immersion.length, 9);
  assert.equal("answer" in os.missions[0], false, "public mission metadata must not expose its model answer");
  assert.equal("expected" in os.conversations[0], false, "public conversation metadata must not expose its model answer");
  assert.equal("ok" in os.conversations[0].options[0], false, "public choices must not expose the grading key");
  assert.equal("sample" in os.writingTasks[0], false, "public writing metadata must not expose its sample answer");
  assert.equal("answer" in os.particleLabs[0].questions[0], false, "public particle metadata must not expose its answer");
});

test("the open dictionary pack stays honest and deduplicated", () => {
  const pack = globalThis.HHJapaneseVocabularyV4;
  assert.equal(pack.version, 4);
  assert.equal(pack.words.length, 30000);
  assert.equal(pack.checksum, "B2ECCB2500DE6255357FE27CCE474ECAA607D87F9991776A16FC7416F02CE33D");
  assert.match(pack.license, /EDRDG/);
  assert.match(pack.license, /CC BY-SA 4\.0/);
  assert.ok(pack.words.every((row) => row.word && row.kana && row.romaji && row.meaning && row.pos));
  assert.ok(pack.words.every((row) => row.reviewStatus === "source-derived" && row.meaningLanguage === "en"));
  assert.ok(pack.words.every((row) => row.level === "N?" && !row.jlptVerified && !row.pitchVerified));
  const words = globalThis.HHJapanese.words;
  assert.equal(words.length, 42301);
  assert.equal(new Set(words.map((row) => `${row.word}\u0000${row.kana || ""}`)).size, words.length);
  assert.ok(globalThis.HHJapanese.v5Packs.find((row) => row.id === "vi-core").count >= 3000);
});

test("V5 Sentence Bank provides 30,000 attributable records without unlicensed audio", () => {
  const pack = globalThis.HHJapaneseSentenceBankV5;
  assert.equal(pack.version, 5);
  assert.equal(pack.count, 30000);
  assert.equal(pack.checksum, "78DA0B12ADC30DE7534B611416B4CB331FC92A89A4D3B5B807A8449148D27367");
  assert.ok(pack.sentences.filter((row) => row.translationLanguage === "vie").length >= 6000);
  assert.ok(pack.sentences.every((row) => row.text && row.translation && row.author && row.license && row.translationAuthor && row.translationLicense));
  assert.ok(pack.sentences.every((row) => ["CC BY 2.0 FR", "CC0"].includes(row.license)));
  assert.ok(pack.sentences.every((row) => row.reviewStatus === "source-filtered" && row.audio === null));
});

test("V5 KanjiVG pack provides real stroke paths with ShareAlike metadata", () => {
  const pack = globalThis.HHJapaneseKanjiVGV5;
  assert.equal(pack.version, 5);
  assert.equal(pack.count, 2135);
  assert.equal(pack.checksum, "10EB3A3B340BEC50B1F1CF7D868148AA23D7E4B7A3EE38F01CACCD67B03F5C3F");
  assert.match(pack.license, /CC BY-SA 3\.0/);
  assert.equal(Object.keys(pack.characters).length, 2135);
  assert.ok(Object.values(pack.characters).every((row) => row.char && row.paths.length && row.paths.every((value) => /^m/i.test(value))));
});

test("V5 implements active vocabulary, sequential lessons, reader, shadowing and review governance", () => {
  const source = read("japanese-os-v4.js");
  for (const marker of [
    "hh.japanese.os.v5", "ownerId()", "learnerId()", "indexedDB.open", "new Worker", "SpeechRecognition",
    "MediaRecorder", "speechSynthesis", "LESSON PLAYER V5", "ACTIVE VOCABULARY", "PARTICLE LAB",
    "SMART READER V3", "KANJI WRITING V2", "REVIEW CONSOLE", "data-hhj5-save-dictation",
    "data-hhj5-review-word", "reviewed-local", "packHistory", "rollbackPack", "learningVocabulary",
    "curationVersion", "data-hhj5-lesson-listen", "data-hhj5-lesson-collocation", "Hoàn thành hoạt động trên",
    "Anki TSV", "text/tab-separated-values"
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const skill of ["recognition", "recall", "production"]) assert.match(source, new RegExp(skill));
  for (const status of ["new", "learning", "due", "hard", "mastered", "relearning"]) assert.match(source, new RegExp(status));
  assert.match(source, /Đây không phải điểm phát âm hoặc pitch accent/);
  assert.match(source, /Không tự gán pitch accent/);
  assert.match(source, /không phải điểm JLPT chính thức/i);
  assert.match(source, /publicRanking:false/);
});

test("V5 cockpit routes real next steps while keeping mission answers locked", () => {
  const source = read("japanese-os-v4.js");
  const css = read("japanese-os-v4.css");
  for (const marker of [
    "data-hhj6-next-step", "data-hhj6-vocab-level", "data-hhj6-vocab-topic",
    "data-hhj6-vocab-pos", "data-hhj6-open-word", "data-hhj6-next-mission",
    "data-hhj6-clear-vocab-filters", "followNextStep", "recordActivity",
    'levelFilter:"all"', 'topicFilter:"all"', 'posFilter:"all"'
  ]) assert.ok(source.includes(marker), `missing cockpit contract: ${marker}`);

  const pathStart = source.indexOf("function pathsView");
  const pathEnd = source.indexOf("function practiceView", pathStart);
  const pathView = source.slice(pathStart, pathEnd);
  assert.match(pathView, /<strong hidden aria-live="polite"><\/strong>/);
  assert.doesNotMatch(pathView, /selected\.answer/);
  assert.match(source, /answer\.textContent=mission\.answer/);
  assert.match(source, /listen\.dataset\.hhj4Speak=mission\.answer/);
  assert.match(source, /save\.dataset\.hhj4SaveSentence=mission\.answer/);
  assert.match(source, /recordActivity\("mission"/);
  assert.match(source, /recordActivity\("lesson"/);
  assert.match(source, /recordActivity\("mistake"/);
  assert.match(source, /row\.resolvedAt=new Date\(\)\.toISOString\(\)/);

  for (const className of [
    "hhj6-cockpit", "hhj6-flight-grid", "hhj6-operation-deck", "hhj6-quick-lane",
    "hhj6-vocab-radar", "hhj6-next-dock", "hhj6-dictionary-filters"
  ]) assert.match(css, new RegExp(`\\.${className}\\b`));
});

test("V5 delegates page scrolling to appMain and preserves per-room position across local renders", () => {
  const source = read("japanese-os-v4.js");
  const css = read("japanese-os-v4.css");
  assert.match(source, /function scrollRoot\(\)/);
  assert.match(source, /closest\?\.\("#appMain"\)/);
  assert.match(source, /nextRoot\.scrollTop=next==="view-start"/);
  assert.match(source, /scrollPositions\.set/);
  assert.match(source, /scrollPositions\.get/);
  assert.match(source, /captureMainScrollState/);
  assert.match(source, /restoreMainScrollState/);
  assert.match(source, /mount:mountSafe/);
  assert.doesNotMatch(source, /installJapaneseScrollGuard/);
  assert.match(css, /\.app-japanese-route #appMain\{[^}]*overflow-y:auto/);
  assert.match(css, /\.app-japanese-route \.app-workspace\{[^}]*overflow:visible/);
  assert.match(css, /\.app-japanese-route \.hhj4-main\{[^}]*overflow:visible/);
  assert.match(css, /touch-action:pan-y/);
  assert.match(css, /padding-bottom:max\(110px/);
  for (const contract of [
    /\.hhj4-list\{max-height:none;overflow:visible\}/,
    /\.hhj5-lesson>aside\{max-height:none;overflow:visible\}/,
    /\.hhj6-dictionary\{max-height:none;overflow:visible\}/
  ]) assert.match(css, contract, "mobile lesson content must delegate vertical scrolling to appMain");
});

test("V5 adds eleven real learning rooms, an accessible reader dialog and shared evidence", () => {
  const os = globalThis.HHJapaneseOSV5;
  const source = read("japanese-os-v4.js");
  const css = read("japanese-os-v4.css");
  assert.equal(os.rooms.length, 11);
  for (const room of ["dashboard", "path", "kana", "kanji", "vocabulary", "grammar", "listening-speaking", "reader", "standards", "culture", "review"]) {
    assert.ok(os.rooms.some((item) => item.id === room));
  }
  for (const marker of ["HHLanguageLearningCore", "data-hhj7-custom-text-dialog", "trapDialogFocus", "returnDialogFocus", "hhj7-kana-grid", "hhj7-culture-grid"]) {
    assert.match(source + css, new RegExp(marker));
  }
  assert.match(source, /function focusIdentity\(control\)/);
  assert.match(source, /occurrence:Math\.max\(0,same\.indexOf\(active\)\)/);
  assert.match(source, /history\?\.pushState/);
  assert.match(source, /completed:false,interactions:1/);
  assert.doesNotMatch(source, /score:1,completed:true,interactions:1,durationSeconds:3/);
  for (const color of ["#c64751", "#f7eedb", "#131722", "#e1bd70"]) assert.match(css, new RegExp(color));
  assert.match(css, /repeating-linear-gradient\(98deg/);
});

test("V5 records only truthful shared attempts and keeps room navigation in browser history", async () => {
  const japanese = globalThis.HHJapanese;
  const os = globalThis.HHJapaneseOSV5;
  const previous = {
    localStorage: globalThis.localStorage,
    location: globalThis.location,
    history: globalThis.history,
    addEventListener: globalThis.addEventListener,
    core: globalThis.HHLanguageLearningCore
  };
  const store = new Map();
  const calls = [];
  let pushed = "";
  const listeners = {};
  const host = {
    innerHTML: "",
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains() { return false; }
  };
  const target = (dataset) => {
    const button = { dataset, disabled: false, matches() { return false; }, querySelector() { return null; } };
    button.closest = (selector) => selector === "button" ? button : null;
    return button;
  };
  try {
    globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
    globalThis.location = { hash: "#/japanese/dashboard", pathname: "/", search: "" };
    globalThis.history = { state: null, pushState(_state, _title, url) { pushed = String(url); } };
    globalThis.addEventListener = () => {};
    globalThis.HHLanguageLearningCore = { recordEvidence(_language, _learner, evidence) { calls.push(evidence); } };
    japanese.mount(host, { view: "dashboard" });
    await listeners.click({ target: target({ hhj7Room: "culture" }) });
    assert.equal(pushed, "/#/japanese/culture");
    await listeners.click({ target: target({ hhj4MissionComplete: os.missions[0].id }) });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].completed, false);
    assert.equal("score" in calls[0], false);
    assert.equal(calls[0].xp, 0);
    assert.equal("durationSeconds" in calls[0], false);
  } finally {
    japanese.unmount();
    if (previous.localStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.localStorage;
    if (previous.location === undefined) delete globalThis.location; else globalThis.location = previous.location;
    if (previous.history === undefined) delete globalThis.history; else globalThis.history = previous.history;
    if (previous.addEventListener === undefined) delete globalThis.addEventListener; else globalThis.addEventListener = previous.addEventListener;
    if (previous.core === undefined) delete globalThis.HHLanguageLearningCore; else globalThis.HHLanguageLearningCore = previous.core;
  }
});

test("V5 normalizes damaged local state and consumes mission or lesson completion once", () => {
  const os = globalThis.HHJapaneseOSV5;
  const japanese = globalThis.HHJapanese;
  const storageKey = "hh.japanese.os.v5:guest:default";
  const validWord = os.words[0];
  const sentenceId = os.sentences[0].id;
  const missionId = os.missions[0].id;
  const now = new Date().toISOString();
  const store = new Map([[storageKey, JSON.stringify({
    activeTab: "broken-tab",
    path: "broken-path",
    family: null,
    cards: [null, {type:"word", ref:"stale-word"}, {type:"sentence", ref:sentenceId, payload:{correct:"例"}}],
    lesson: {wordIds:["stale-word"], index:999, step:999, curationVersion:1},
    missionProgress: {[missionId]:true, stale:{at:now}},
    reviewOverrides: {[validWord.id]:{word:"</h2><img src=x>", meaning:"Nghĩa an toàn", related:"not-an-array"}},
    reviewQueue: [{id:'"><img-src-x>', wordId:validWord.id, meaning:"x", status:"pending"}],
    offlinePacks: {"vi-core":{}},
    packHistory: [{}]
  })]]);
  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
  const previous = {
    localStorage: globalThis.localStorage,
    location: globalThis.location,
    addEventListener: globalThis.addEventListener
  };
  const makeHost = () => {
    const listeners = {};
    return {listeners, innerHTML:"", addEventListener:(type,handler)=>{listeners[type]=handler;}, querySelector:()=>null};
  };
  const makeButton = (dataset) => {
    const button = {dataset, disabled:false, matches:()=>false, querySelector:()=>null};
    button.closest = (selector) => selector === "button" ? button : null;
    return button;
  };

  try {
    globalThis.localStorage = localStorage;
    globalThis.location = {hash:"#/japanese/today", href:"https://example.test/"};
    globalThis.addEventListener = () => {};
    const host = makeHost();
    japanese.mount(host);
    const sanitized = JSON.parse(store.get(storageKey));
    assert.equal(sanitized.activeTab, "today");
    assert.equal(sanitized.path, "jf");
    assert.equal(sanitized.family.publicRanking, false);
    assert.ok(sanitized.cards.some((card) => card.type === "sentence" && card.ref === String(sentenceId)));
    assert.ok(!sanitized.cards.some((card) => card.ref === "stale-word"));
    assert.deepEqual(sanitized.missionProgress, {});
    assert.equal(sanitized.reviewOverrides[validWord.id].meaning, "Nghĩa an toàn");
    assert.equal("word" in sanitized.reviewOverrides[validWord.id], false);
    assert.deepEqual(sanitized.reviewOverrides[validWord.id].related, []);
    assert.deepEqual(sanitized.reviewQueue, []);
    assert.deepEqual(sanitized.packHistory, []);
    assert.doesNotMatch(host.innerHTML, /<img src=x>/);

    const missionButton = makeButton({hhj4MissionComplete:missionId});
    host.listeners.click({target:missionButton});
    const missionOnce = JSON.parse(store.get(storageKey));
    host.listeners.click({target:missionButton});
    const missionTwice = JSON.parse(store.get(storageKey));
    assert.equal(missionTwice.xp, missionOnce.xp);
    assert.equal(missionTwice.activityLog.filter((row) => row.type === "mission").length, 1);

    const lessonIds = os.words.slice(0,12).map((row) => row.id);
    missionTwice.lesson = {wordIds:lessonIds,index:11,step:7,answers:{},curationVersion:1};
    store.set(storageKey, JSON.stringify(missionTwice));
    const lessonHost = makeHost();
    japanese.mount(lessonHost);
    const lessonButton = makeButton({hhj5LessonStep:"next"});
    lessonHost.listeners.click({target:lessonButton});
    const lessonOnce = JSON.parse(store.get(storageKey));
    lessonHost.listeners.click({target:lessonButton});
    const lessonTwice = JSON.parse(store.get(storageKey));
    assert.equal(lessonTwice.xp, lessonOnce.xp);
    assert.equal(lessonTwice.activityLog.filter((row) => row.type === "lesson").length, 1);

    lessonTwice.activeTab = "practice";
    lessonTwice.practiceTool = "writing";
    lessonTwice.writingHistory = [];
    store.set(storageKey, JSON.stringify(lessonTwice));
    const writingHost = makeHost();
    japanese.mount(writingHost);
    const writingForm = {
      dataset: {task:"diary"},
      elements: {text:{value:"今日は日本語を勉強しました。"}},
      matches: (selector) => selector === "[data-hhj4-writing-form]",
      querySelector: () => null
    };
    const submitEvent = {target:writingForm, preventDefault:()=>{}};
    writingHost.listeners.submit(submitEvent);
    const writingOnce = JSON.parse(store.get(storageKey));
    writingHost.listeners.submit(submitEvent);
    const writingTwice = JSON.parse(store.get(storageKey));
    assert.equal(writingTwice.xp, writingOnce.xp);
    assert.equal(writingTwice.writingHistory.length, 1);
  } finally {
    japanese.unmount();
    if (previous.localStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.localStorage;
    if (previous.location === undefined) delete globalThis.location; else globalThis.location = previous.location;
    if (previous.addEventListener === undefined) delete globalThis.addEventListener; else globalThis.addEventListener = previous.addEventListener;
  }
});

test("V5 aborts active speech recognition and omits locked conversation actions before answering", async () => {
  const japanese = globalThis.HHJapanese;
  const storageKey = "hh.japanese.os.v5:guest:default";
  const store = new Map([[storageKey, JSON.stringify({activeTab:"practice", practiceTool:"conversation"})]]);
  const listeners = {};
  const host = {innerHTML:"", addEventListener:(type,handler)=>{listeners[type]=handler;}, querySelector:()=>null};
  const previous = {
    localStorage: globalThis.localStorage,
    location: globalThis.location,
    addEventListener: globalThis.addEventListener,
    SpeechRecognition: globalThis.SpeechRecognition,
    webkitSpeechRecognition: globalThis.webkitSpeechRecognition
  };
  let started = 0;
  let aborted = 0;
  class PendingRecognition {
    start() { started += 1; }
    abort() { aborted += 1; this.onerror?.({error:"aborted"}); }
  }
  const button = {dataset:{hhj4Record:"restaurant"}, disabled:false, textContent:"2. Nói lại", matches:()=>false, closest:(selector)=>selector === "button" ? button : null};

  try {
    globalThis.localStorage = {getItem:(key)=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))};
    globalThis.location = {hash:"#/japanese/practice", href:"https://example.test/"};
    globalThis.addEventListener = () => {};
    globalThis.SpeechRecognition = PendingRecognition;
    delete globalThis.webkitSpeechRecognition;
    japanese.mount(host);
    assert.doesNotMatch(host.innerHTML, /data-hhj4-speak=/, "locked conversation audio must not carry the model answer in DOM");
    const pending = listeners.click({target:button});
    assert.equal(started, 1);
    japanese.unmount();
    await pending;
    assert.equal(aborted, 1);
  } finally {
    japanese.unmount();
    if (previous.localStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.localStorage;
    if (previous.location === undefined) delete globalThis.location; else globalThis.location = previous.location;
    if (previous.addEventListener === undefined) delete globalThis.addEventListener; else globalThis.addEventListener = previous.addEventListener;
    if (previous.SpeechRecognition === undefined) delete globalThis.SpeechRecognition; else globalThis.SpeechRecognition = previous.SpeechRecognition;
    if (previous.webkitSpeechRecognition === undefined) delete globalThis.webkitSpeechRecognition; else globalThis.webkitSpeechRecognition = previous.webkitSpeechRecognition;
  }
});

test("V5 data provenance and browser assets are versioned and cached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("japanese-os-v4.css");
  for (const asset of ["japanese-vocabulary-v4.js?v=2", "japanese-sentence-bank-v5.js?v=1", "japanese-kanjivg-v5.js?v=1", "japanese-os-v4.css?v=10", "japanese-os-v4.js?v=12"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(loader, pattern);
    assert.match(worker, pattern);
    assert.match(index, pattern);
  }
  assert.match(worker, /japanese-search-worker\.js\?v=1/);
  assert.match(read("assets/japanese/NOTICE-OPEN-DATA-V4.md"), /EDRDG[\s\S]*Kaikki[\s\S]*KanjiVG[\s\S]*Tatoeba[\s\S]*Editorial review status/);
  assert.match(css, /height:calc\(100dvh/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("Japanese mobile constrains the implicit app grid column and keeps the room map usable", () => {
  const css = read("japanese-os-v4.css");
  assert.match(css, /\.hhj4-app\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.hhj6-cockpit\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.hhj6-priority\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.app-japanese-route \.hhj7-room-map\{display:flex;[^}]*overflow-x:auto/);
  assert.match(css, /\.app-japanese-route \.hhj7-room-map>button\{[^}]*flex:0 0 clamp/);
  assert.match(css, /@media\(min-width:761px\) and \(max-width:900px\)/);
});
