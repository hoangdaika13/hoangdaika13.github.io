const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const learning = require("../galaxy-layer-one-learning.js");

const NOW = "2026-09-01T08:00:00.000Z";

function card(overrides = {}) {
  return {
    id: "card-1",
    front: "Chánh niệm là gì?",
    back: "Nhận biết rõ ràng điều đang xảy ra trong hiện tại.",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function deck(overrides = {}) {
  return {
    id: "deck-1",
    title: "Tiếng Việt và Phật học",
    cards: [
      card(),
      card({ id: "card-2", front: "Từ 'hello' nghĩa là gì?", back: "Xin chào" }),
      card({ id: "card-3", front: "Từ 'peace' nghĩa là gì?", back: "Bình an" }),
      card({ id: "card-4", front: "Từ 'learn' nghĩa là gì?", back: "Học" })
    ],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

test("UMD API and immutable constants are exposed without DOM dependencies", () => {
  assert.equal(global.HHGalaxyLayerOneLearning, learning);
  assert.ok(Object.isFrozen(learning));
  assert.ok(Object.isFrozen(learning.LIMITS));
  assert.equal(learning.SCHEMA_VERSION, 1);
});

test("flashcards and decks normalize Vietnamese UTF-8 into clone-safe bounded records", () => {
  const normalized = learning.normalizeDeck({
    title: "  Học tiếng Việt  ",
    language: "vi",
    tags: ["Ngôn ngữ", "ngôn ngữ", "  Việt Nam  "],
    cards: [{ front: "  Chú Đại Bi\r\n  ", back: "Tâm từ bi", hint: "\u202EKhông đảo chữ" }]
  }, { now: NOW });
  assert.equal(normalized.title, "Học tiếng Việt");
  assert.equal(normalized.cards[0].front, "Chú Đại Bi");
  assert.equal(normalized.cards[0].hint, "Không đảo chữ");
  assert.deepEqual(normalized.tags, ["Ngôn ngữ", "Việt Nam"]);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(normalized)));
  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
});

test("validation reports missing fields, duplicate explicit IDs and card limits", () => {
  const invalid = learning.validateFlashcard({ front: "", back: "Đáp án" }, { now: NOW });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors[0].code, "CARD_FRONT_REQUIRED");
  assert.ok(Object.isFrozen(invalid));
  assert.throws(() => learning.normalizeDeck({ title: "Trùng", cards: [card(), card()] }, { now: NOW }), { code: "DUPLICATE_CARD_ID" });
  assert.throws(() => learning.normalizeDeck({ title: "Quá lớn", cards: Array(learning.LIMITS.cardsPerDeck + 1).fill(card()) }, { now: NOW }), { code: "DECK_CARD_LIMIT" });
});

test("quiz generation is deterministic by seed and never invents a score", () => {
  const first = learning.createQuiz(deck(), { seed: "hạt-giống-42", count: 3, choiceCount: 3, now: NOW });
  const second = learning.createQuiz(deck(), { seed: "hạt-giống-42", count: 3, choiceCount: 3, now: NOW });
  const different = learning.createQuiz(deck(), { seed: "hạt-giống-khác", count: 3, choiceCount: 3, now: NOW });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.questions.map((question) => question.cardId), different.questions.map((question) => question.cardId));
  assert.equal("score" in first, false);
  assert.ok(Object.isFrozen(first.questions));
  assert.equal(first.questions.every((question) => question.choices.length === 3), true);

  const duplicateAnswers = deck({ cards: [card(), card({ id: "card-2", front: "Khác", back: card().back })] });
  const fallback = learning.createQuiz(duplicateAnswers, { seed: "duplicate", count: 2, mode: "multiple-choice", now: NOW });
  assert.equal(fallback.questions.every((question) => question.mode === "typing"), true, "duplicate answer text must never become an ambiguous choice");
});

test("quiz grading counts only submitted answers and emits real user activities", () => {
  const quiz = learning.createQuiz(deck(), { seed: "grade", count: 3, mode: "typing", now: NOW });
  const responses = [
    { questionId: quiz.questions[0].id, answer: quiz.questions[0].answer },
    { questionId: quiz.questions[1].id, answer: "Sai hoàn toàn" }
  ];
  const result = learning.gradeQuiz(quiz, responses, { at: NOW });
  assert.equal(result.answered, 2);
  assert.equal(result.correct, 1);
  assert.equal(result.unanswered, 1);
  assert.equal(result.scorePercent, 33);
  assert.equal(result.accuracyPercent, 50);
  assert.equal(result.activities.length, 2);
  assert.equal(result.activities.every((activity) => activity.userInitiated && activity.source === "user"), true);

  const untouched = learning.gradeQuiz(quiz, [], { at: NOW });
  assert.equal(untouched.scorePercent, null);
  assert.equal(untouched.accuracyPercent, null);
  assert.equal(untouched.activities.length, 0);
});

test("SM-2-like review scheduling is immutable, bounded and resets failed repetitions", () => {
  const original = card();
  const first = learning.applyReview(original, 5, { deckId: "deck-1", reviewedAt: NOW, now: NOW });
  assert.equal(first.card.schedule.repetitions, 1);
  assert.equal(first.card.schedule.intervalDays, 1);
  assert.equal(first.card.schedule.easeFactor, 2.6);
  assert.equal(first.card.schedule.dueAt, "2026-09-02T08:00:00.000Z");
  assert.equal(original.schedule, undefined, "input card must not be mutated");
  assert.equal(first.activity.userInitiated, true);

  const second = learning.applyReview(first.card, 5, { deckId: "deck-1", reviewedAt: "2026-09-02T08:00:00.000Z", now: NOW });
  assert.equal(second.card.schedule.intervalDays, 6);
  const failed = learning.applyReview(second.card, 1, { deckId: "deck-1", reviewedAt: "2026-09-08T08:00:00.000Z", now: NOW });
  assert.equal(failed.card.schedule.repetitions, 0);
  assert.equal(failed.card.schedule.intervalDays, 1);
  assert.equal(failed.card.schedule.lapses, 1);
  assert.ok(failed.card.schedule.easeFactor >= 1.3);
  assert.throws(() => learning.applyReview(original, 6, { reviewedAt: NOW }), { code: "REVIEW_QUALITY_INVALID" });
  assert.throws(() => learning.applyReview(original, 4, { reviewedAt: NOW }), { code: "REVIEW_DECK_REQUIRED" });
});

test("progress uses only explicit user activity and excludes every sample path", () => {
  const userDeck = deck();
  const sampleDeck = deck({ id: "sample-deck", title: "Bản mẫu", isSample: true });
  const reviewed = learning.applyReview(userDeck.cards[0], 4, { deckId: userDeck.id, reviewedAt: NOW, now: NOW });
  const importedLooking = { ...reviewed.activity, id: "activity-imported", cardId: "card-2", source: "import", userInitiated: true };
  const passive = { ...reviewed.activity, id: "activity-passive", cardId: "card-3", userInitiated: false };
  const sampleActivity = { ...reviewed.activity, id: "activity-sample", deckId: "sample-deck", isSample: true };
  const progress = learning.computeProgress({
    decks: [userDeck, sampleDeck],
    activities: [reviewed.activity, importedLooking, passive, sampleActivity]
  }, { now: "2026-09-03T08:00:00.000Z" });
  assert.equal(progress.totalDecks, 1);
  assert.equal(progress.totalCards, 4);
  assert.equal(progress.studiedCards, 1);
  assert.equal(progress.progressPercent, 25);
  assert.equal(progress.reviewCount, 1);
  assert.equal(progress.accuracyPercent, null);
  assert.equal(progress.byDeck.length, 1);
});

test("versioned export/import round-trips plain data and excludes samples by default", () => {
  const reviewed = learning.applyReview(deck().cards[0], 4, { deckId: "deck-1", reviewedAt: NOW, now: NOW });
  const json = learning.exportJSON({
    decks: [deck(), deck({ id: "sample", title: "Bản mẫu", isSample: true })],
    activities: [reviewed.activity]
  }, { exportedAt: NOW, now: NOW });
  const payload = JSON.parse(json);
  assert.equal(payload.schema, learning.SCHEMA);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.decks.length, 1);
  const imported = learning.importJSON(json, { now: NOW });
  assert.equal(imported.decks[0].title, "Tiếng Việt và Phật học");
  assert.equal(imported.activities.length, 1);
  assert.ok(Object.isFrozen(imported));
  assert.deepEqual(JSON.parse(JSON.stringify(imported)).decks, imported.decks);
});

test("imports fail closed for size, schema, versions, duplicate IDs and dangling activity", () => {
  assert.throws(() => learning.importJSON("{"), { code: "IMPORT_JSON_INVALID" });
  assert.throws(() => learning.importJSON(JSON.stringify({ schema: "wrong", schemaVersion: 1 })), { code: "IMPORT_SCHEMA_INVALID" });
  assert.throws(() => learning.importJSON(JSON.stringify({ schema: learning.SCHEMA, schemaVersion: 99, decks: [], activities: [] })), { code: "IMPORT_VERSION_UNSUPPORTED" });
  assert.throws(() => learning.importJSON(JSON.stringify({ schema: learning.SCHEMA, schemaVersion: 1 })), { code: "IMPORT_SHAPE_INVALID" });
  assert.throws(() => learning.importJSON(" ".repeat(learning.LIMITS.importBytes + 1)), { code: "IMPORT_TOO_LARGE" });

  const duplicate = { schema: learning.SCHEMA, schemaVersion: 1, decks: [deck(), deck()], activities: [] };
  assert.throws(() => learning.importJSON(duplicate, { now: NOW }), { code: "DUPLICATE_DECK_ID" });
  const dangling = {
    schema: learning.SCHEMA,
    schemaVersion: 1,
    decks: [deck()],
    activities: [{ id: "a", type: "review", deckId: "deck-1", cardId: "missing", at: NOW, source: "user", userInitiated: true, quality: 4 }]
  };
  assert.throws(() => learning.importJSON(dangling, { now: NOW }), { code: "ACTIVITY_REFERENCE_INVALID" });
});

test("prototype-shaped and executable-looking content remains inert text", () => {
  const malicious = JSON.parse(`{"schema":"${learning.SCHEMA}","schemaVersion":1,"decks":[{"id":"safe","title":"<img src=x onerror=alert(1)>","__proto__":{"polluted":true},"cards":[{"id":"c","front":"<script>alert(1)</script>","back":"Không thực thi"}]}],"activities":[]}`);
  const imported = learning.importJSON(malicious, { now: NOW });
  assert.equal({}.polluted, undefined);
  assert.equal(imported.decks[0].title, "<img src=x onerror=alert(1)>");
  assert.equal(imported.decks[0].cards[0].front, "<script>alert(1)</script>");
  assert.equal(Object.prototype.hasOwnProperty.call(imported.decks[0], "__proto__"), false);
});

test("source has no network, code execution or browser storage side effects", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "galaxy-layer-one-learning.js"), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|socket\.io/i);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\./);
  assert.doesNotMatch(source, /https?:\/\/[A-Za-z0-9]/);
});
