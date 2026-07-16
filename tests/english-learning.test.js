const test = require("node:test");
const assert = require("node:assert/strict");
const { courses, scheduleReview, scoreAnswers, levelFromScore, normalize } = require("../english-learning.js");

test("A0 curriculum contains five units and fifteen complete lessons", () => {
  assert.equal(courses.length, 5);
  const lessons = courses.flatMap((unit) => unit.lessons);
  assert.equal(lessons.length, 15);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 15);
  lessons.forEach((lesson) => {
    assert.ok(lesson.canDo.length > 20);
    assert.ok(lesson.grammar.length > 20);
    assert.ok(lesson.dialogue.includes("\n"));
    assert.ok(lesson.vocabulary.length >= 8 && lesson.vocabulary.length <= 15);
    assert.equal(lesson.exercises.length, 5);
    lesson.exercises.forEach((exercise) => {
      assert.ok(exercise.answer);
      assert.ok(exercise.explanation.length > 20);
    });
  });
});

test("review scheduler advances and resets intervals", () => {
  const now = Date.UTC(2026, 6, 16);
  const first = scheduleReview({}, "good", now);
  assert.equal(first.interval, 1);
  assert.equal(first.repetitions, 1);
  const second = scheduleReview(first, "easy", now + 86400000);
  assert.equal(second.interval, 3);
  assert.equal(second.repetitions, 2);
  const forgotten = scheduleReview(second, "again", now + 2 * 86400000);
  assert.equal(forgotten.interval, 1);
  assert.equal(forgotten.repetitions, 0);
  assert.equal(forgotten.lapses, 1);
});

test("placement scoring and answer normalization are deterministic", () => {
  const questions = [["", "", [], 0], ["", "", [], 1], ["", "", [], 2]];
  assert.equal(scoreAnswers(questions, [0, 1, 0]), 2);
  assert.equal(levelFromScore(20), "A0");
  assert.equal(levelFromScore(50), "A1");
  assert.equal(levelFromScore(85), "A2");
  assert.equal(normalize("  Hello,   World! "), "hello world");
});
