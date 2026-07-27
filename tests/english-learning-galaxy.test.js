const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const galaxy = require("../english-learning-galaxy.js");
const source = fs.readFileSync(path.join(__dirname, "..", "english-learning-galaxy.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "english-learning-galaxy.css"), "utf8");

test("English Learning Galaxy exposes real listening and reading routes", () => {
  assert.deepEqual(galaxy.VIEWS, ["dashboard", "listening", "reading", "listen-read"]);
  assert.equal(galaxy.listeningLibrary.length, 7);
  assert.equal(galaxy.readingLibrary.length, 7);
  assert.deepEqual(galaxy.listeningLibrary.map((item) => item.level), ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
  assert.deepEqual(galaxy.readingLibrary.map((item) => item.level), ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
});

test("every listening and reading item has assessable content", () => {
  galaxy.listeningLibrary.forEach((item) => {
    assert.ok(item.sentences.length >= 3, item.id);
    assert.equal(item.questions.length, 3, item.id);
    assert.deepEqual(item.questions.map((question) => question[0]), ["main", "detail", "inference"]);
  });
  galaxy.readingLibrary.forEach((item) => {
    assert.ok(item.paragraphs.length >= 3, item.id);
    assert.equal(item.questions.length, 3, item.id);
  });
});

test("virtual listening timeline is stable and seekable", () => {
  const rows = galaxy.timedSentences(galaxy.listeningLibrary[0], 0.85);
  assert.equal(rows[0].start, 0);
  assert.ok(rows.every((row) => row.end > row.start));
  assert.ok(rows.slice(1).every((row, index) => row.start === rows[index].end));
});

test("galaxy state migration preserves progress without fake activity", () => {
  const fresh = galaxy.defaultState();
  assert.deepEqual(fresh.galaxy.activity, []);
  assert.deepEqual(fresh.galaxy.listeningProgress, {});
  assert.deepEqual(fresh.galaxy.readingProgress, {});
  const merged = galaxy.mergeState(
    { ...fresh, galaxy: fresh.galaxy },
    { galaxy: { selectedListeningId: "listen-b1-tech", listeningProgress: { "listen-b1-tech": { position: 12 } } } }
  );
  assert.equal(merged.galaxy.selectedListeningId, "listen-b1-tech");
  assert.equal(merged.galaxy.listeningProgress["listen-b1-tech"].position, 12);
});

test("galaxy implementation includes functional controls and accessible responsive styling", () => {
  for (const token of [
    "data-hheg-action=\"play\"", "data-hheg-action=\"pause\"", "data-hheg-action=\"back\"",
    "data-hheg-action=\"forward\"", "data-hheg-action=\"ab-a\"", "data-hheg-action=\"ab-b\"",
    "data-hheg-dictation", "data-hheg-reading-scroll", "data-hheg-reading-notes",
    "data-hheg-coach", "hh:home-galaxy-preferences-applied", "visibilityState"
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.hheg-planet/);
});
