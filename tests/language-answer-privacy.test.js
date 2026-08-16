const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH English keeps grading keys out of pre-submit markup", () => {
  const files = ["english-learning.js", "english-learning-os.js", "english-learning-galaxy.js", "english-vocabulary.js"];
  files.forEach((file) => {
    const source = read(file);
    assert.doesNotMatch(source, /data-(?:answer|correct|explanation|expected)=/i, `${file} embeds an answer-bearing attribute`);
  });
  const main = read("english-learning.js");
  assert.match(main, /contextLocked = \["typed-recall", "audio-guess", "dictation", "cloze", "sentence-order", "word-family", "picture-vocabulary"\]/);
  assert.match(main, /Đáp án đang được khóa/);
  assert.match(main, /practiceTasksFor\(state\)\.find/);
  assert.match(main, /galaxyData\?\.buildChallenge\?\.\(mode, galaxyFilteredWords\(state\), state\.galaxyCursor\)/);
  assert.match(read("english-learning-os.js"), /const expectedQuestion = lessonQuestion\(lesson/);
  assert.match(read("english-vocabulary.js"), /normalizeStudio\(state\)\.lesson/);
  assert.match(read("english-learning-galaxy.js"), /const answer = current\?\.en/);
});

test("HH Japanese derives answers internally and locks every review card back", () => {
  const source = read("japanese-os-v4.js");
  assert.doesNotMatch(source, /data-(?:answer|correct|explanation|expected)=/i);
  assert.doesNotMatch(source, /data-hhj5-active-answer="\$\{item\.id===row\.id\?"correct":"wrong"\}"/);
  assert.match(source, /data-hhj5-active-answer="\$\{esc\(item\.id\)\}"/);
  assert.match(source, /expected=example\?particleNear/);
  assert.match(source, /data-hhj4-reveal-card/);
  assert.match(source, /<p hidden data-hhj4-card-answer="\$\{esc\(card\.id\)\}"><\/p>/);
  assert.match(source, /answer\.textContent=cardAnswer\(card\)/);
  assert.doesNotMatch(source, /<small>Đúng: \$\{esc\(row\.correct\)\}/);
  assert.match(source, /data-hhj4-reveal-mistake/);
  assert.match(source, /<p hidden data-hhj4-mistake-answer="\$\{esc\(row\.key\)\}"><\/p>/);
  assert.match(source, /answer\.textContent=`Đúng: \$\{row\.correct\}`/);
  assert.match(source, /guardPrematureAnswers\(\);setupPad/);
  assert.match(source, /Hiện câu mẫu sau khi tự trả lời/);
  assert.match(source, /writing\.placeholder="Viết câu trả lời của bạn/);
});

test("answer-safe assets are cache-busted in the lazy loader and worker", () => {
  const source = read("performance-loader.js") + read("sw.js");
  for (const asset of ["english-learning-galaxy.js?v=5", "english-vocabulary.js?v=2", "english-learning-os.js?v=7", "english-learning.js?v=28", "japanese-os-v4.js?v=7"]) {
    assert.match(source, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});
