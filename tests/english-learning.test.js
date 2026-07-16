const test = require("node:test");
const assert = require("node:assert/strict");
const { courses, courseLevels, careerCategories, careerTracks, placementQuestions, scheduleReview, scoreAnswers, levelFromScore, normalize, buildSmartPlan, beginnerChecklist, selectCareerVocabulary, personalizeCareerLesson } = require("../english-learning.js");

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

test("Career English provides sixty-four adaptive seven-day industry tracks", () => {
  assert.equal(careerCategories.length, 10);
  assert.equal(careerTracks.length, 64);
  assert.equal(careerTracks.reduce((sum, track) => sum + track.lessons.length, 0), 448);
  assert.ok(careerTracks.reduce((sum, track) => sum + track.vocabulary.length, 0) >= 2000);
  assert.ok(new Set(careerTracks.flatMap((track) => track.vocabulary.map((word) => word[0].toLowerCase()))).size >= 1200);
  careerTracks.forEach((track) => {
    assert.equal(track.lessons.length, 7, `${track.id} lesson count`);
    assert.ok(track.vocabulary.length >= 28, `${track.id} vocabulary count`);
    assert.ok(careerCategories.some((category) => category.id === track.category));
    assert.ok(track.project.length > 40);
    assert.ok(Array.isArray(track.roles));
    assert.equal(typeof track.skillProfile, "object");
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

test("career selector changes vocabulary and exercises for different learner profiles", () => {
  const track = careerTracks.find((item) => item.id === "software-development");
  assert.ok(track);
  const foundationState = {
    selectedCareer: track.id,
    careerProfile: { roleStage: "student", skillFocus: "reading", intensity: "foundation" }
  };
  const leadershipState = {
    selectedCareer: track.id,
    careerProfile: { roleStage: "manager", skillFocus: "speaking", intensity: "advanced" }
  };
  const foundationWords = selectCareerVocabulary(foundationState, track.id, 1, 8);
  const leadershipWords = selectCareerVocabulary(leadershipState, track.id, 1, 8);
  assert.equal(foundationWords.length, 8);
  assert.equal(leadershipWords.length, 8);
  assert.notDeepEqual(foundationWords.map((word) => word[0]), leadershipWords.map((word) => word[0]));

  const foundationLesson = personalizeCareerLesson(foundationState, track.lessons[0]);
  const leadershipLesson = personalizeCareerLesson(leadershipState, track.lessons[0]);
  assert.equal(foundationLesson.id, leadershipLesson.id);
  assert.equal(foundationLesson.exercises.length, 5);
  assert.equal(leadershipLesson.exercises.length, 5);
  assert.notEqual(foundationLesson.dialogue, leadershipLesson.dialogue);
  assert.match(leadershipLesson.adaptiveRationale, /Quản lý/);
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

test("smart plan guides a new learner and prioritizes due review", () => {
  const now = Date.UTC(2026, 6, 16, 8);
  const fresh = buildSmartPlan({}, now);
  assert.equal(fresh.levelId, "A0");
  assert.equal(fresh.tasks[0].type, "setup");
  assert.equal(fresh.readiness, 0);

  const personalized = {
    onboarding: { completed: true, dismissed: false, rewarded: true },
    learnerProfile: { confidence: "basic", focusSkill: "writing", needsPlacement: false },
    selectedLevel: "A1",
    dailyGoal: 20,
    settings: { goal: "Học tập và thi cử" },
    savedWords: { hello: { word: "hello" } },
    reviewQueue: { hello: { dueAt: "2026-07-15T08:00:00.000Z" } },
    minutesByDay: { "2026-07-16": 5 }
  };
  const plan = buildSmartPlan(personalized, now);
  assert.equal(plan.levelId, "A1");
  assert.equal(plan.dueWords, 1);
  assert.equal(plan.remainingMinutes, 15);
  assert.equal(plan.weakSkill, "writing");
  assert.equal(plan.tasks[0].type, "review");
  assert.ok(plan.tasks.some((task) => task.type === "lesson"));

  const checklist = beginnerChecklist(personalized, now);
  assert.equal(checklist.length, 5);
  assert.equal(checklist[0].done, true);
  assert.equal(checklist[1].done, false);
});
