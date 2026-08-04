const test = require("node:test");
const assert = require("node:assert/strict");
const galaxy = require("../english-galaxy.js");

test("English Galaxy indexes CEFR and career vocabulary into lazy packs", () => {
  const stats = galaxy.stats();
  assert.ok(stats.unique >= 1400);
  assert.equal(galaxy.packs.length, 7);
  assert.equal(galaxy.packs[0].level, "A0");
  assert.ok(galaxy.packs[0].count >= 20);
  assert.ok(stats.targets.general >= 5000);
  assert.ok(galaxy.topicSystems.length >= 7);
});

test("English Galaxy exposes nineteen transparent practice modes", () => {
  assert.equal(galaxy.learningModes.length, 19);
  assert.equal(new Set(galaxy.learningModes.map((item) => item.id)).size, 19);
  const modes = ["flashcards", "typed-recall", "audio-guess", "cloze", "matching", "sentence-order", "collocation", "confusables", "dictation", "shadowing", "mini-story", "role-play", "speed-review", "mistakes", "word-family", "picture-vocabulary", "phrasal-verbs", "idioms", "minimal-pairs"];
  assert.deepEqual(galaxy.learningModes.map((item) => item.id), modes);
  const challenge = galaxy.buildChallenge("typed-recall", galaxy.catalog, 0);
  assert.equal(challenge.type, "text");
  assert.ok(challenge.answer);
  assert.equal(galaxy.buildChallenge("flashcards", galaxy.catalog, 0).type, "flashcard");
  assert.equal(galaxy.buildChallenge("phrasal-verbs", galaxy.catalog, 0).word.term, "bring up");
  assert.equal(galaxy.buildChallenge("idioms", galaxy.catalog, 0).word.term, "a piece of cake");
  assert.deepEqual(galaxy.buildChallenge("minimal-pairs", galaxy.catalog, 0).options, ["ship", "sheep"]);
});
