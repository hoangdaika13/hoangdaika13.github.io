"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { ObjectId } = require("mongodb");
const api = require("../utils/education-handler.js").__test;
const copy = value => value instanceof Date ? new Date(value) : value instanceof ObjectId ? new ObjectId(value) : Array.isArray(value) ? value.map(copy) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)])) : value;
function fixture() {
  const classId = new ObjectId(), assignmentId = new ObjectId(), teacher = { _id: "teacher", educationRole: "teacher", roles: [] }, student = { _id: "student", educationRole: "student", roles: [] };
  const assignment = { _id: assignmentId, classId, status: "assigned", dueAt: new Date(Date.now() + 86400000), targetLearnerProfileIds: [] }, records = [], audits = [];
  let beforeUpdate;
  const matches = (row, query) => Object.entries(query).every(([key, value]) => key === "$or" ? value.some(part => matches(row, part)) : value && typeof value === "object" && !(value instanceof ObjectId) && Object.hasOwn(value, "$exists") ? Object.hasOwn(row, key) === value.$exists : String(row[key]) === String(value));
  const db = { collection(name) {
    if (name === "education_assignments") return { async findOne(query) { return matches(assignment, query) ? copy(assignment) : null; } };
    if (name === "education_classes") return { async findOne(query) { const row = { _id: classId, teacherId: "teacher" }; return matches(row, query) ? copy(row) : null; } };
    if (name === "education_enrollments") return { async findOne(query) { return query.learnerOwnerId === "student" && query.learnerProfileId === "learner-1" && String(query.classId) === String(classId) ? { status: "active" } : null; } };
    if (name === "education_audit_logs") return { async insertOne(row) { audits.push(copy(row)); return { insertedId: new ObjectId() }; } };
    if (name === "education_submissions") return {
      async findOne(query) { return copy(records.find(row => matches(row, query)) || null); },
      async insertOne(row) { if (records.some(prior => String(prior.assignmentId) === String(row.assignmentId) && prior.learnerOwnerId === row.learnerOwnerId && prior.learnerProfileId === row.learnerProfileId)) throw Object.assign(Error("duplicate"), { code: 11000 }); const _id = new ObjectId(); records.push({ ...copy(row), _id }); return { insertedId: _id }; },
      async updateOne(query, mutation) { if (beforeUpdate) { const run = beforeUpdate; beforeUpdate = null; run(records); } const row = records.find(item => matches(item, query)); if (!row) return { modifiedCount: 0 }; Object.assign(row, copy(mutation.$set || {})); for (const key of Object.keys(mutation.$unset || {})) delete row[key]; for (const [key, value] of Object.entries(mutation.$push || {})) (row[key] ||= []).push(copy(value)); return { modifiedCount: 1 }; }
    };
    throw Error("Unexpected collection " + name);
  } };
  async function request(method, body, user = method === "PATCH" ? teacher : student) { const captured = { status: 0, body: null }, response = { status(code) { captured.status = code; return this; }, json(value) { captured.body = value; return value; } }; await api.submissions({ method, query: {} }, response, db, user, body); return captured; }
  return { db, records, audits, classId, assignmentId, teacher, student, request, race(fn) { beforeUpdate = fn; } };
}

test("assignment submit → teacher feedback → revision → regrade preserves paragraphs and all prior versions", async () => {
  const f = fixture(), base = { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1" };
  const initial = await f.request("POST", { ...base, expectedRevision: 0, answer: "Đoạn một.\n\nĐoạn hai." });
  assert.equal(initial.status, 200); assert.equal(initial.body.answerRevision, 1);
  assert.equal(f.records[0].answer, "Đoạn một.\n\nĐoạn hai.");
  const submissionId = String(f.records[0]._id);
  const feedback = await f.request("PATCH", { submissionId, answerRevision: 1, score: 70, feedback: "Cần thêm bằng chứng.\nGiữ ý chính.", requireRedo: true });
  assert.equal(feedback.status, 200); assert.equal(f.records[0].status, "redo-required");
  assert.equal(f.records[0].feedback, "Cần thêm bằng chứng.\nGiữ ý chính.");
  const revised = await f.request("POST", { ...base, expectedRevision: 1, answer: "Bản sửa có bằng chứng.\n\nKết luận." });
  assert.equal(revised.status, 200); assert.equal(revised.body.answerRevision, 2);
  assert.equal(f.records[0].score, undefined); assert.equal(f.records[0].history.length, 1);
  assert.equal(f.records[0].history[0].answer, "Đoạn một.\n\nĐoạn hai.");
  assert.equal(f.records[0].history[0].score, 70);
  const stale = await f.request("PATCH", { submissionId, answerRevision: 1, score: 0 });
  assert.equal(stale.status, 409); assert.equal(f.records[0].score, undefined);
  assert.equal((await f.request("PATCH", { submissionId, answerRevision: 2, score: 90, feedback: "Đã bổ sung." })).status, 200);
  assert.equal((await f.request("PATCH", { submissionId, answerRevision: 2, score: 95, feedback: "Điều chỉnh nhận xét." })).status, 200);
  assert.equal(f.records[0].history.length, 2); assert.equal(f.records[0].history[1].event, "prior-feedback"); assert.equal(f.records[0].history[1].score, 90);
  const staleRevision = await f.request("POST", { ...base, expectedRevision: 1, answer: "Bản từ tab cũ" });
  assert.equal(staleRevision.status, 409); assert.equal(f.records[0].answerRevision, 2);
});

test("atomic compare-and-set rejects a teacher request when the answer changes after it was read", async () => {
  const f = fixture(), base = { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1" };
  await f.request("POST", { ...base, expectedRevision: 0, answer: "Initial" });
  f.race(records => { records[0].answer = "New answer from another request"; records[0].answerRevision = 2; });
  const result = await f.request("PATCH", { submissionId: String(f.records[0]._id), answerRevision: 1, score: 20 });
  assert.equal(result.status, 409); assert.equal(f.records[0].answerRevision, 2); assert.equal(f.records[0].score, undefined);
});

test("concurrent first submissions create one version and stale resubmission cannot erase concurrent feedback", async () => {
  const f = fixture(), body = { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 0, answer: "Initial" };
  const first = await Promise.all([f.request("POST", body), f.request("POST", body)]);
  assert.deepEqual(first.map(item => item.status).sort(), [200, 409]); assert.equal(f.records.length, 1);
  f.race(records => { records[0].gradingRevision = 1; records[0].score = 80; records[0].feedback = "Concurrent teacher feedback"; });
  const revision = await f.request("POST", { ...body, expectedRevision: 1, answer: "Revision from stale read" });
  assert.equal(revision.status, 409); assert.equal(f.records[0].answer, "Initial"); assert.equal(f.records[0].feedback, "Concurrent teacher feedback");
});

test("real class and assignment handlers feed the same submission workflow through the shared QA database", async () => {
  const { createEducationMemoryDB } = require("./helpers/hh-school-memory-db.js"), db = createEducationMemoryDB(), teacher = { _id: "teacher", educationRole: "teacher", roles: [] }, student = { _id: "student", educationRole: "student", roles: [] };
  const run = async (handler, method, body, user, query = {}) => { const result = {}; const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return value; } }; await api[handler]({ method, query }, res, db, user, body); return result; };
  const created = await run("classes", "POST", { name: "QA class", grade: 6 }, teacher); assert.equal(created.status, 200);
  const classId = new ObjectId(created.body.item.id);
  await db.collection("education_enrollments").insertOne({ classId, learnerOwnerId: "student", learnerProfileId: "learner-1", status: "active" });
  const assigned = await run("assignments", "POST", { classId: String(classId), title: "Explain evidence", dueAt: new Date(Date.now() + 86400000).toISOString(), lessonIds: [] }, teacher); assert.equal(assigned.status, 200);
  const list = await run("assignments", "GET", {}, student, { learnerProfileId: "learner-1" }); assert.equal(list.body.items.length, 1);
  const submitted = await run("submissions", "POST", { assignmentId: assigned.body.item.id, learnerProfileId: "learner-1", expectedRevision: 0, answer: "My original evidence" }, student); assert.equal(submitted.status, 200);
  const returned = await run("submissions", "PATCH", { submissionId: submitted.body.submissionId, answerRevision: 1, score: 85, feedback: "Explain one limitation" }, teacher); assert.equal(returned.status, 200);
  const fetched = await run("submissions", "GET", {}, student, { learnerProfileId: "learner-1" }); assert.equal(fetched.body.items[0].score, 85);
});

test("teacher permission and learner enrollment are required before changing submissions", async () => {
  const f = fixture();
  await f.request("POST", { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 0, answer: "Own answer" });
  const id = String(f.records[0]._id), before = copy(f.records[0]);
  assert.equal((await f.request("PATCH", { submissionId: id, answerRevision: 1, score: 100 }, f.student)).status, 403);
  assert.equal((await f.request("PATCH", { submissionId: id, answerRevision: 1, score: 100 }, { _id: "other-teacher", educationRole: "teacher", roles: [] })).status, 403);
  assert.equal((await f.request("POST", { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 0, answer: "Intrusion" }, { _id: "other-student", educationRole: "student", roles: [] })).status, 403);
  assert.deepEqual(f.records[0], before);
});

test("new submissions require an explicit matching revision to grade while legacy revision-zero data remains compatible", async () => {
  const f = fixture();
  await f.request("POST", { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 0, answer: "Answer" });
  const submissionId = String(f.records[0]._id);
  assert.equal((await f.request("PATCH", { submissionId, score: 50 })).status, 409);
  assert.equal((await f.request("PATCH", { submissionId, answerRevision: 1, score: true })).status, 400);
  delete f.records[0].answerRevision; delete f.records[0].gradingRevision;
  assert.equal((await f.request("PATCH", { submissionId, score: 50 })).status, 200);
});

test("oversized version history is rejected without truncating or overwriting existing work", async () => {
  const f = fixture();
  await f.request("POST", { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 0, answer: "Keep this answer" });
  f.records[0].history = [{ event: "legacy-history", original: "x".repeat(14000000) }];
  const result = await f.request("POST", { assignmentId: String(f.assignmentId), learnerProfileId: "learner-1", expectedRevision: 1, answer: "Would replace" });
  assert.equal(result.status, 413); assert.equal(f.records[0].answer, "Keep this answer"); assert.equal(f.records[0].answerRevision, 1);
  assert.equal(f.records[0].history.length, 1); assert.equal(f.records[0].history[0].original.length, 14000000);
});
