const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const assets = path.join(root, "assets", "english-vocabulary");
const vocabulary = require(path.join(root, "english-vocabulary.js"));
const worker = require(path.join(root, "english-vocabulary-worker.js"));
const manifest = JSON.parse(fs.readFileSync(path.join(assets, "manifest.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(assets, "search-index.json"), "utf8"));

test("English vocabulary ships thirty thousand unique checksum-locked ESDB terms", () => {
  assert.equal(manifest.actual.termIndex, 30000);
  assert.equal(index.count, 30000);
  assert.equal(index.terms.length, 30000);
  assert.equal(new Set(index.terms).size, 30000);
  assert.equal(manifest.packs.length, 6);
  assert.equal(manifest.packs.reduce((sum, pack) => sum + pack.count, 0), 30000);
  manifest.packs.forEach((pack) => {
    const bytes = fs.readFileSync(path.join(root, pack.file));
    assert.equal(bytes.length, pack.bytes);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), pack.sha256);
    const payload = JSON.parse(bytes.toString("utf8"));
    assert.equal(payload.items.length, 5000);
    assert.equal(payload.verification, "term-index");
    assert.equal(payload.level, null);
    assert.ok(payload.items.every((row) => row.length === 2 && row[0] && row[1]));
  });
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(assets, "search-index.json"))).digest("hex"), manifest.index.sha256);
  assert.match(fs.readFileSync(path.join(assets, "ESDB-Copyright.txt"), "utf8"), /Permission to use, copy, modify, distribute, and sell/);
});

test("term index never invents Vietnamese meanings or CEFR classifications", () => {
  assert.equal(manifest.quality.meaning, "not-assigned");
  assert.equal(manifest.quality.cefr, "not-assigned");
  for (const pack of manifest.packs) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, pack.file), "utf8"));
    assert.ok(payload.items.every((row) => typeof row[0] === "string" && typeof row[1] === "string"));
    assert.ok(payload.items.every((row) => row.length === 2));
  }
});

test("Vocabulary Explorer search is bounded and runs identically in its worker fallback", () => {
  const sample = ["affect", "effect", "after", "afternoon", "before", "decision"];
  assert.deepEqual(vocabulary.searchTerms(sample, "af", 3).map((item) => item.term), ["affect", "after", "afternoon"]);
  assert.deepEqual(worker.search(sample, "af", 3).map((item) => item.term), ["affect", "after", "afternoon"]);
  assert.equal(vocabulary.searchTerms(index.terms, "tion", 120).length, 120);
});

test("Lesson Player creates fifteen sequential words and adapts down to ten after repeated mistakes", () => {
  const words = Array.from({ length: 20 }, (_, indexValue) => ({ term: `word${indexValue}`, meaning: `nghĩa ${indexValue}`, level: "A1", example: `Example ${indexValue}.`, reviewed: true }));
  const normal = vocabulary.buildLesson(words, { galaxySession: { attempts: 0 }, mistakeNotebook: [], wordMastery: {}, savedWords: {}, reviewQueue: {} }, 15);
  assert.equal(normal.words.length, 15);
  assert.equal(normal.current, 0);
  assert.equal(normal.step, 0);
  const adaptive = vocabulary.buildLesson(words, { galaxySession: { attempts: 10 }, mistakeNotebook: Array.from({ length: 6 }, (_, indexValue) => ({ word: `word${indexValue}` })), wordMastery: {}, savedWords: {}, reviewQueue: {} }, 15);
  assert.equal(adaptive.words.length, 10);
  assert.equal(vocabulary.lessonSteps.length, 7);
});

test("personal deck policy uses local days, a bounded goal and explicit lesson sources", () => {
  const now = new Date(2026, 7, 23, 12, 0, 0).getTime();
  const words = [
    { term: "hello", meaning: "xin chào", level: "A0", reviewed: true },
    { term: "deadline", meaning: "hạn chót", level: "A2", reviewed: true },
    { term: "journey", meaning: "hành trình", level: "A1", reviewed: true }
  ];
  const state = {
    vocabularyStudio: { dailyGoal: 5, deckLimit: 100 },
    savedWords: {
      hello: { word: "hello", savedAt: new Date(now - 1000).toISOString() },
      deadline: { word: "deadline", savedAt: new Date(now - 2000).toISOString() }
    },
    reviewQueue: {
      hello: { dueAt: new Date(now - 1000).toISOString() },
      deadline: { dueAt: new Date("2999-01-01T00:00:00.000Z").toISOString() }
    },
    wordMastery: {}, mistakeNotebook: [], galaxySession: { attempts: 0 }
  };
  const policy = vocabulary.deckPolicy(state, now);
  assert.equal(policy.dailyGoal, 5);
  assert.equal(policy.addedToday, 2);
  assert.equal(policy.due, 1);
  assert.equal(policy.remaining, 3);
  assert.equal(vocabulary.buildDeckLesson(words, state, "deck", 5).words.length, 2);
  assert.deepEqual(vocabulary.buildDeckLesson(words, state, "due", 5).words.map((item) => item.term), ["hello"]);
});

test("personal dictionary import export and reading coverage stay local and deterministic", () => {
  const csv = '"decision","quyết định","We made a decision."\n"deadline","hạn chót","Meet the deadline."';
  const rows = vocabulary.parseImport(csv, "csv");
  assert.equal(rows.length, 2);
  assert.match(vocabulary.exportRows(rows, "anki"), /decision\tquyết định/);
  const report = vocabulary.coverageReport("We made a decision before the deadline", ["we", "made", "a", "decision", "the"]);
  assert.equal(report.unique, 7);
  assert.equal(report.known, 5);
  assert.equal(report.percent, 71);
  assert.deepEqual(report.unknown, ["before", "deadline"]);
});

test("one-page vocabulary studio exposes explorer, lesson, labs, privacy and lazy storage contracts", () => {
  const source = fs.readFileSync(path.join(root, "english-vocabulary.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "english-vocabulary.css"), "utf8");
  const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  for (const token of ["Vocabulary Explorer", "lessonSize", "Word Family Map", "Confusing Words Lab", "Phrasal Verb Builder", "Collocation Trainer", "Minimal Pairs", "Mistake Notebook", "Cloze Story", "Personal Dictionary", "READING COVERAGE", "indexedDB", "checksum", "Web Worker"]) assert.match(`${source}\n${css}`, new RegExp(token, "i"));
  for (const asset of ["english-vocabulary.css?v=1", "english-vocabulary.js?v=2", "english-vocabulary-worker.js?v=1", "assets/english-vocabulary/manifest.json"]) {
    assert.match(loader + serviceWorker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.doesNotMatch(serviceWorker, /assets\/english-vocabulary\/esdb-01\.json/);
  assert.match(source, /packCount\.textContent = `\$\{instance\.manifest\.packs\.length\} pack khả dụng`/);
  assert.match(fs.readFileSync(path.join(root, "english-learning.css"), "utf8"), /data-view="galaxy"[^}]*\.hhe-route-dock\{display:none\}/);
  assert.match(css, /height:calc\(100dvh - 180px\)/);
  assert.match(css, /@media\(min-width:621px\) and \(max-width:1000px\)/);
  assert.match(css, /grid-template-rows:130px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
