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

test("V5 data provenance and browser assets are versioned and cached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("japanese-os-v4.css");
  for (const asset of ["japanese-vocabulary-v4.js?v=2", "japanese-sentence-bank-v5.js?v=1", "japanese-kanjivg-v5.js?v=1", "japanese-os-v4.css?v=2", "japanese-os-v4.js?v=7"]) {
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
