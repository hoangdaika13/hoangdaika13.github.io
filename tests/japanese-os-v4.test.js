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
require(path.join(root, "japanese-os-v4.js"));

test("HH Japanese OS V4 exposes the six-area one-page learning workspace", () => {
  const os = globalThis.HHJapaneseOSV4;
  assert.equal(os.version, 4);
  assert.equal(globalThis.HHJapanese.osVersion, 4);
  assert.deepEqual(os.tabs.map((row) => row[0]), ["today", "paths", "practice", "lookup", "immersion", "progress"]);
  assert.deepEqual(os.paths.map((row) => row.id), ["jlpt", "jf", "life", "career"]);
  assert.equal(os.missions.length, 400);
  assert.equal(os.conversations.length, 10);
  assert.equal(os.writingTasks.length, 8);
  assert.equal(os.immersion.length, 8);
});

test("the open V4 source pack adds thirty thousand honest JMdict entries", () => {
  const pack = globalThis.HHJapaneseVocabularyV4;
  assert.equal(pack.version, 4);
  assert.equal(pack.dictDate, "2026-08-03");
  assert.equal(pack.words.length, 30000);
  assert.equal(pack.checksum, "B2ECCB2500DE6255357FE27CCE474ECAA607D87F9991776A16FC7416F02CE33D");
  assert.match(pack.license, /EDRDG/);
  assert.match(pack.license, /CC BY-SA 4\.0/);
  assert.deepEqual(pack.packs.map((row) => row.id), ["general", "life", "business", "career", "collocation", "onomatopoeia", "keigo", "counter"]);
  assert.ok(pack.words.every((row) => row.word && row.kana && row.romaji && row.meaning && row.pos));
  assert.ok(pack.words.every((row) => row.reviewStatus === "source-derived" && row.meaningLanguage === "en"));
  assert.ok(pack.words.every((row) => row.level === "N?" && !row.jlptVerified && !row.pitchVerified));
  assert.ok(pack.words.some((row) => row.packId === "onomatopoeia"));
  assert.ok(pack.words.some((row) => row.packId === "keigo"));
  assert.ok(pack.words.some((row) => row.packId === "career" && row.domains.length));
});

test("V4 merges the packs into a deduplicated forty-two-thousand-entry dictionary", () => {
  const words = globalThis.HHJapanese.words;
  assert.ok(words.length >= 42300 && words.length <= 50000);
  assert.equal(new Set(words.map((row) => `${row.word}\u0000${row.kana || ""}`)).size, words.length);
  assert.ok(globalThis.HHJapanese.v4Packs.find((row) => row.id === "vi-core").count >= 3000);
  assert.equal(globalThis.HHJapanese.missionCount, 400);
});

test("V4 implements real SRS, speech, writing, immersion, teacher and family workflows", () => {
  const source = read("japanese-os-v4.js");
  for (const marker of [
    "hh.japanese.os.v4", "ownerId()", "learnerId()", "indexedDB.open", "new Worker", "SpeechRecognition",
    "speechSynthesis", "data-hhj4-record", "data-hhj4-writing-form", "data-hhj4-rate", "data-hhj4-reader-word",
    "data-hhj4-class-form", "data-hhj4-family", "data-hhj4-profile-form", "Anki TSV", "text/tab-separated-values"
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const status of ["new", "learning", "due", "hard", "mastered", "relearning"]) assert.match(source, new RegExp(status));
  assert.match(source, /không phải điểm phát âm tuyệt đối/i);
  assert.match(source, /Không tự gán pitch accent/i);
  assert.match(source, /không phải điểm JLPT chính thức/i);
  assert.match(source, /publicRanking:false/);
});

test("V4 data provenance and browser assets are versioned and cached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("japanese-os-v4.css");
  for (const asset of ["japanese-vocabulary-v4.js?v=2", "japanese-os-v4.css?v=1", "japanese-os-v4.js?v=2"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(loader, pattern);
    assert.match(worker, pattern);
    assert.match(index, pattern);
  }
  assert.match(worker, /japanese-search-worker\.js\?v=1/);
  assert.match(read("assets/japanese/NOTICE-OPEN-DATA-V4.md"), /EDRDG[\s\S]*Kaikki[\s\S]*KanjiVG[\s\S]*Tatoeba/);
  assert.match(css, /height:calc\(100dvh/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
