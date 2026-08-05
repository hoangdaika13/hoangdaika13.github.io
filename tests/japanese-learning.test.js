const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-vocabulary-10k.js"));
require(path.join(root, "japanese-learning.js"));

test("HH Japanese exposes a complete local-first learning workspace", () => {
  const api = globalThis.HHJapanese;
  assert.ok(api);
  assert.equal(api.views.length, 6);
  for (const view of ["dashboard", "learn", "dictionary", "notebook", "jlpt", "progress"]) {
    assert.ok(api.views.some((item) => item.id === view), `missing ${view}`);
  }
  assert.equal(api.courseUnits.length, 15);
  assert.equal(api.lessonWords(api.courseUnits[0]).length, 15);
  assert.equal(api.words.length, 10000);
  assert.ok(api.topics.length >= 15);
  assert.ok(api.kanji.length >= 15);
  assert.ok(api.grammar.length >= 15);
  assert.equal(api.readings.length, 5);
  for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
    assert.ok(api.words.filter((item) => item.level === level).length >= 15, `not enough words ${level}`);
    assert.ok(api.grammar.some((item) => item.level === level), `missing grammar ${level}`);
    assert.ok(api.readings.some((item) => item.level === level), `missing reading ${level}`);
  }
});

test("Japanese dictionary, Kana conversion and conjugation perform real local work", () => {
  const api = globalThis.HHJapanese;
  assert.equal(api.dictionarySearch("manabu")[0].word, "学ぶ");
  assert.ok(api.dictionarySearch("học hỏi").some((item) => item.word === "学ぶ"));
  assert.equal(api.romajiToHiragana("nihongo"), "にほんご");
  assert.equal(api.hiraganaToKatakana("にほんご"), "ニホンゴ");
  assert.equal(api.conjugateVerb("食べる").polite, "食べます");
  assert.equal(api.conjugateVerb("飲む").te, "飲んで");
  assert.equal(api.conjugateVerb("する").past, "した");
  assert.equal(api.scoreDictation("日本語を勉強します。", "日本語を勉強します"), 100);
  assert.ok(api.scoreDictation("日本語を勉強します。", "日本語を勉強する") < 100);
  const plan = api.dailyPlan({ level: "N5", saved: {}, reviews: {}, customWords: [], completedReadings: {}, testHistory: [] });
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map((item) => item.view), ["learn", "notebook", "reader"]);
});

test("guided Japanese learning includes SRS states and a deduplicated mistake notebook", () => {
  const api = globalThis.HHJapanese;
  const state = { saved: {}, reviews: {}, mistakes: [], dailyActivity: {}, customWords: [] };
  assert.equal(api.srsStatus(state, "w1"), "new");
  api.recordMistake(state, { type: "lesson", id: "w1", prompt: "日本", answer: "sai", correct: "Nhật Bản" });
  api.recordMistake(state, { type: "lesson", id: "w1", prompt: "日本", answer: "sai lần 2", correct: "Nhật Bản" });
  assert.equal(state.mistakes.length, 1);
  assert.equal(state.mistakes[0].count, 2);
});

test("HH Japanese is reachable, lazy-loaded, cached and responsive", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("japanese-learning.css");
  assert.match(script, /id: "japanese", label: "HH Japanese"/);
  assert.match(script, /route === "\/japanese" \|\| route\.startsWith\("\/japanese\/"\)/);
  assert.match(script, /window\.HHJapanese\?\.mount/);
  for (const asset of ["japanese-learning.css?v=8", "japanese-vocabulary-packs.js?v=1", "japanese-vocabulary-10k.js?v=1", "japanese-learning.js?v=8"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(loader, pattern);
    assert.match(worker, pattern);
    assert.match(index, pattern);
  }
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("Japanese learning labels unsupported browser features honestly", () => {
  const source = read("japanese-learning.js");
  for (const statement of [
    "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói",
    "Trình duyệt chưa hỗ trợ TextDetector OCR",
    "không tự tuyên bố nhận dạng chính xác",
    "không phải đề thi JLPT chính thức",
    "không tạo kết quả giả"
  ]) assert.match(source, new RegExp(statement));
  assert.match(source, /hh\.japanese\.state\.v1/);
  assert.match(source, /KanjiAPI\.dev/);
  assert.match(source, /JMdict\/KANJIDIC/);
  assert.match(source, /\/api\/search\/japanese/);
  assert.match(source, /data-hhj-dictation/);
  assert.match(source, /data-hhj-daily-goal/);
  assert.match(source, /customWords/);
  assert.match(source, /data-hhj-vocabulary-topic/);
  assert.match(source, /data-hhj-save-topic/);
  assert.match(source, /data-hhj-onboarding/);
  assert.match(source, /data-hhj-lesson-answer/);
  assert.match(source, /data-hhj-shadowing/);
  assert.match(source, /data-hhj-resolve-mistake/);
  assert.match(source, /data-hhj-subtitle-miner/);
});

test("Japanese thematic vocabulary pack is structured and searchable", () => {
  const pack = globalThis.HHJapaneseVocabularyPacks;
  const api = globalThis.HHJapanese;
  assert.ok(pack.words.length >= 300);
  assert.ok(pack.topics.includes("Ẩm thực"));
  assert.ok(pack.topics.includes("Công nghệ"));
  assert.ok(api.dictionarySearch("trí tuệ nhân tạo").some((item) => item.word === "人工知能"));
  assert.ok(api.dictionarySearch("shinkansen").some((item) => item.word === "新幹線"));
  for (const item of pack.words) {
    assert.ok(item.word && item.kana && item.meaning && item.pos && item.level && item.topic);
  }
});

test("JMdict compact pack brings the offline vocabulary total to exactly ten thousand", () => {
  const pack = globalThis.HHJapaneseVocabulary10K;
  const api = globalThis.HHJapanese;
  assert.equal(pack.words.length, 9640);
  assert.equal(pack.language, "eng");
  assert.equal(pack.dictVersion, "3.6.2");
  assert.equal(api.words.length, 10000);
  assert.ok(api.topics.includes("JMdict 10K"));
  assert.ok(api.words.some((item) => item.source === "JMdict 3.6.2" && item.meaningLanguage === "en"));
  assert.equal(new Set(api.words.map((item) => `${item.word}\u0000${item.kana}`)).size, 10000);
});
