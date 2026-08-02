const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-learning.js"));

test("HH Japanese exposes a complete local-first learning workspace", () => {
  const api = globalThis.HHJapanese;
  assert.ok(api);
  assert.equal(api.views.length, 10);
  for (const view of ["dictionary", "kanji", "grammar", "reader", "jlpt", "notebook", "conversation", "tools", "progress"]) {
    assert.ok(api.views.some((item) => item.id === view), `missing ${view}`);
  }
  assert.ok(api.words.length >= 340);
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
  assert.deepEqual(plan.map((item) => item.view), ["dictionary", "reader", "jlpt"]);
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
  for (const asset of ["japanese-learning.css?v=3", "japanese-vocabulary-packs.js?v=1", "japanese-learning.js?v=4"]) {
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
    "không phải đề thi chính thức",
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
