const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-vocabulary-10k.js"));
require(path.join(root, "japanese-vietnamese-pack.js"));
require(path.join(root, "japanese-learning.js"));
require(path.join(root, "japanese-os-v3.js"));

test("HH Japanese OS V3 exposes the complete Can-do learning system", () => {
  const os = globalThis.HHJapaneseOSV3;
  assert.equal(os.version, 3);
  assert.equal(globalThis.HHJapanese.osVersion, 3);
  assert.deepEqual(os.tabs.map(row => row[0]), ["today", "missions", "vocabulary", "reader", "grammar", "mora", "kanji", "jlpt", "life", "progress"]);
  assert.ok(os.missions.length >= 5);
  assert.ok(os.contrasts.length >= 7);
  assert.ok(os.mora.length >= 6);
  assert.equal(os.life.length, 10);
});

test("the Vietnamese source pack expands usable vocabulary without relabelling JMdict", () => {
  const pack = globalThis.HHJapaneseVietnamesePack;
  assert.ok(pack.words.length >= 2000);
  assert.equal(pack.license, "CC BY-SA 4.0 / GFDL");
  assert.ok(pack.words.every(row => row.meaningLanguage === "vi" && row.reviewStatus === "source-derived"));
  assert.ok(pack.words.some(row => row.word === "道" && row.meaning.includes("đường")));
  assert.equal(globalThis.HHJapaneseOSV3.quality(pack.words[0]).jlpt, false);
});

test("data quality never invents Vietnamese, JLPT or pitch metadata", () => {
  const os = globalThis.HHJapaneseOSV3;
  const reference = globalThis.HHJapanese.words.find(row => row.meaningLanguage === "en");
  const curated = globalThis.HHJapanese.words.find(row => row.id === "w1");
  assert.equal(os.quality(reference).tone, "reference");
  assert.equal(os.quality(reference).jlpt, false);
  assert.notEqual(os.quality(curated).tone, "reference");
  assert.match(read("japanese-os-v3.js"), /Pitch accent: chưa có nguồn được cấp phép/);
  assert.match(read("japanese-os-v3.js"), /Không tự dịch hoặc tự gán JLPT/);
  assert.match(read("japanese-os-v3.js"), /Không tự gán JLPT\/pitch/);
});

test("Japanese OS V3 persists per owner and implements real browser capabilities", () => {
  const source = read("japanese-os-v3.js");
  for (const contract of [
    "hh.japanese.os.v3", "ownerId", "indexedDB.open", "SpeechRecognition", "speechSynthesis",
    "data-hhj3-mission-check", "data-hhj3-reader-word", "data-hhj3-grammar-check",
    "data-hhj3-record", "data-hhj3-test", "data-hhj3-offline", "data-hhj3-tutor-form"
  ]) assert.match(source, new RegExp(contract.replace(/[.?]/g, "\\$&")));
  assert.match(source, /Trình duyệt chưa hỗ trợ/);
  assert.match(source, /không phải điểm phát âm/);
});

test("V3 assets are lazy loaded, offline cached and responsive", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const css = read("japanese-os-v3.css");
  for (const asset of ["japanese-vietnamese-pack.js?v=1", "japanese-os-v3.css?v=4", "japanese-os-v3.js?v=2"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(loader, pattern);
    assert.match(worker, pattern);
    assert.match(index, pattern);
  }
  assert.match(css, /height:calc\(100dvh/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("JLPT and JF progress remain independent and the simulator is honestly labelled", () => {
  const source = read("japanese-os-v3.js");
  assert.match(source, /JLPT Knowledge Map/);
  assert.match(source, /JF\/CEFR Can-do Map/);
  assert.match(source, /không quy đổi sai/i);
  assert.match(source, /Không tuyên bố .* tương đương tuyệt đối/);
  assert.match(source, /NỘI DUNG TỰ BIÊN SOẠN/);
  assert.match(source, /ước tính luyện tập/);
  assert.match(source, /Full Mock Test/);
});

test("six age experience modes and child tutor guardrails are present", () => {
  const source = read("japanese-os-v3.js");
  for (const label of ["Little Kids", "Kids", "Teens", "Students", "Adults", "Senior"]) assert.match(source, new RegExp(label));
  assert.match(source, /không mở chat tự do/i);
  assert.match(source, /Gia sư có giới hạn/);
  assert.match(source, /Giữ nguyên câu gốc/);
});
