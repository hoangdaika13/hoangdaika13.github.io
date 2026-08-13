const test = require("node:test");
const assert = require("node:assert/strict");
const curriculum = require("../hh-school-curriculum.js");

test("HH School publishes all twelve grade structures with deterministic packs", () => {
  assert.equal(curriculum.GRADES.length, 12);
  assert.deepEqual(curriculum.GRADES.map((grade) => grade.number), [1,2,3,4,5,6,7,8,9,10,11,12]);
  for (const grade of curriculum.GRADES) {
    assert.ok(grade.subjects.length >= 8, `grade ${grade.number} subject list`);
    const first = curriculum.packForGrade(grade.number);
    const second = curriculum.packForGrade(grade.number);
    assert.equal(first.checksum, second.checksum);
    assert.equal(first.grade.number, grade.number);
    assert.ok(first.lessons.length >= 4);
    assert.equal(new Set(first.lessons.map((lesson) => lesson.lessonId)).size, first.lessons.length);
    assert.ok(new Set(first.lessons.map((lesson) => lesson.subjectId)).size >= 4);
    assert.ok(first.lessons.every((lesson) => lesson.questions.length >= 3 && lesson.steps.length === 10));
    assert.ok(first.lessons.every((lesson) => ["checked", "reviewed", "approved"].includes(lesson.contentStatus)));
  }
});

test("grade subject rules reflect primary, lower secondary and high-school choices", () => {
  const grade1 = curriculum.gradeBy(1).subjects.map((item) => item.id);
  const grade3 = curriculum.gradeBy(3).subjects.map((item) => item.id);
  const grade6 = curriculum.gradeBy(6).subjects;
  const grade10 = curriculum.gradeBy(10);
  assert.ok(grade1.includes("vietnamese") && grade1.includes("nature-society"));
  assert.ok(grade3.includes("foreign-1") && grade3.includes("informatics-technology"));
  assert.deepEqual(grade6.find((item) => item.id === "natural-science").strands, ["Vật lí", "Hóa học", "Sinh học"]);
  assert.ok(grade10.subjects.some((item) => item.id === "history" && !item.optional));
  assert.equal(grade10.highSchoolElectives.length, 9);
  assert.deepEqual(curriculum.highElectives.map((item) => item.id), ["geography", "economics-law", "physics", "chemistry", "biology", "technology", "informatics", "music", "art"]);
});

test("content registry is explicit about original versus reference-only material", () => {
  const pack = curriculum.packForGrade(5);
  assert.equal(curriculum.SOURCE.licenseCode, "REFERENCE_ONLY");
  assert.equal(curriculum.ORIGINAL.licenseCode, "HH-ORIGINAL");
  assert.equal(curriculum.SOURCE.allowedToModify, false);
  assert.equal(curriculum.ORIGINAL.allowedToModify, true);
  assert.ok(pack.lessons.every((lesson) => lesson.source.sourceTitle && lesson.source.licenseCode));
  assert.ok(curriculum.search("so thap phan", 5).some((lesson) => lesson.gradeId === "grade-5"));
});
