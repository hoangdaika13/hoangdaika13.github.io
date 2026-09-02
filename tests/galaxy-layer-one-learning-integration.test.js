const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const learning = require("../galaxy-layer-one-learning.js");
const layerOne = require("../galaxy-layer-one.js");

const NOW = "2026-09-01T08:00:00.000Z";

function learningState() {
  return learning.normalizeState({
    decks: [{
      id: "deck-real",
      title: "Bộ thẻ người dùng",
      description: "Dữ liệu học thật",
      cards: [
        { id: "card-one", front: "Chánh niệm là gì?", back: "Nhận biết hiện tại", createdAt: NOW, updatedAt: NOW },
        { id: "card-two", front: "Hello", back: "Xin chào", createdAt: NOW, updatedAt: NOW }
      ],
      createdAt: NOW,
      updatedAt: NOW
    }],
    activities: []
  }, { now: NOW });
}

test("Learning Star renders real deck/card CRUD, review, quiz and versioned transfer controls", () => {
  const state = learningState();
  const quiz = learning.createQuiz(state.decks[0], { seed: "integration", count: 2, mode: "typing", now: NOW });
  const markup = layerOne.viewMarkup("/galaxy/learning", {}, {
    learningStatus: "ready",
    learningState: state,
    learningSelectedDeckId: "deck-real",
    learningQuiz: quiz
  });

  for (const token of [
    "data-hgl1-learning-deck-form",
    "data-hgl1-learning-deck-edit-form",
    "data-hgl1-learning-card-form",
    "data-hgl1-learning-quiz-form",
    "data-hgl1-learning-quiz-answer-form",
    "data-hgl1-action=\"reveal-learning-card\"",
    "data-hgl1-action=\"export-learning-data\"",
    "data-hgl1-action=\"trigger-learning-import\""
  ]) assert.match(markup, new RegExp(token));

  assert.match(markup, /Bộ thẻ người dùng/);
  assert.match(markup, /Chánh niệm là gì/);
  assert.match(markup, /Tiến độ thật/);
  assert.match(markup, /aria-label="Chọn tệp dữ liệu Learning Star"/);
});

test("Learning integration persists one bounded state record in the large-content engine", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "galaxy-layer-one.js"), "utf8");
  assert.match(source, /engine\.get\("\/galaxy\/learning",\s*LEARNING_RECORD_ID\)/);
  assert.match(source, /active\.contentStorage\.put\("\/galaxy\/learning",\s*LEARNING_RECORD_ID/);
  assert.match(source, /api\.normalizeState\(nextState/);
  assert.match(source, /api\.applyReview\(card,\s*quality/);
  assert.match(source, /api\.createQuiz\(deck/);
  assert.match(source, /api\.gradeQuiz\(runtime\.learningQuiz/);
  assert.match(source, /globalScope\.confirm\("Xóa bộ thẻ/);
  assert.match(source, /globalScope\.confirm\("Xóa thẻ/);
});

test("Learning import merges without deleting current decks or counting sample progress", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "galaxy-layer-one.js"), "utf8");
  assert.match(source, /mergeLearningStates\(active\.learningState,\s*imported\)/);
  assert.match(source, /dữ liệu hiện tại được giữ lại/);

  const sample = learning.normalizeDeck({
    id: "sample",
    title: "Bản mẫu",
    isSample: true,
    cards: [{ id: "sample-card", front: "Mẫu", back: "Không tính" }]
  }, { now: NOW });
  const progress = learning.computeProgress({ decks: learningState().decks.concat([sample]), activities: [] }, { now: NOW });
  assert.equal(progress.totalDecks, 1);
  assert.equal(progress.totalCards, 2);
});
