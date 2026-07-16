const test = require("node:test");
const assert = require("node:assert/strict");
const { courses, courseLevels, careerCategories, careerTracks, placementQuestions, scheduleReview, scoreAnswers, levelFromScore, normalize } = require("../english-learning.js");

test("CEFR curriculum contains seven levels and sixty-nine complete lessons", () => {
  assert.deepEqual(courseLevels.map((level) => level.id), ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
  assert.equal(courseLevels[0].units.length, 5);
  assert.equal(courseLevels[0].units.flatMap((unit) => unit.lessons).length, 15);
  courseLevels.slice(1).forEach((level) => {
    assert.equal(level.units.length, 3, `${level.id} unit count`);
    assert.equal(level.units.flatMap((unit) => unit.lessons).length, 9, `${level.id} lesson count`);
  });
  assert.equal(courses.length, 23);
  const lessons = courses.flatMap((unit) => unit.lessons);
  assert.equal(lessons.length, 69);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 69);
  lessons.forEach((lesson) => {
    assert.ok(["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(lesson.level));
    assert.ok(lesson.canDo.length > 20);
    assert.ok(lesson.grammar.length > 20);
    assert.ok(lesson.dialogue.length > 40);
    assert.ok(lesson.vocabulary.length >= 8 && lesson.vocabulary.length <= 15);
    assert.equal(lesson.exercises.length, 5);
    lesson.exercises.forEach((exercise) => {
      assert.ok(exercise.answer);
      assert.ok(exercise.explanation.length > 20);
    });
  });
});

test("Career English provides thirty-six seven-day industry tracks", () => {
  assert.equal(careerCategories.length, 10);
  assert.equal(careerTracks.length, 36);
  assert.equal(careerTracks.reduce((sum, track) => sum + track.lessons.length, 0), 252);
  assert.equal(careerTracks.reduce((sum, track) => sum + track.vocabulary.length, 0), 864);
  assert.ok(new Set(careerTracks.flatMap((track) => track.vocabulary.map((word) => word[0].toLowerCase()))).size >= 700);
  careerTracks.forEach((track) => {
    assert.equal(track.lessons.length, 7, `${track.id} lesson count`);
    assert.equal(track.vocabulary.length, 24, `${track.id} vocabulary count`);
    assert.ok(careerCategories.some((category) => category.id === track.category));
    assert.ok(track.project.length > 40);
    track.lessons.forEach((lesson, index) => {
      assert.equal(lesson.trackId, track.id);
      assert.equal(lesson.day, index + 1);
      assert.equal(lesson.vocabulary.length, 8);
      assert.equal(lesson.exercises.length, 5);
      assert.ok(lesson.canDo.length > 35);
      assert.ok(lesson.dialogue.includes("\n"));
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
  assert.equal(placementQuestions.length, 28);
  assert.equal(levelFromScore(10), "A0");
  assert.equal(levelFromScore(20), "A1");
  assert.equal(levelFromScore(40), "A2");
  assert.equal(levelFromScore(55), "B1");
  assert.equal(levelFromScore(70), "B2");
  assert.equal(levelFromScore(82), "C1");
  assert.equal(levelFromScore(95), "C2");
  assert.equal(normalize("  Hello,   World! "), "hello world");
});
