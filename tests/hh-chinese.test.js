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
  assert.equal(chinese.VIEWS.length, 9);
  for (const view of ["pinyin", "vocabulary", "hanzi", "reading", "grammar", "speaking", "exam", "dictionary"]) {
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
