const test = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const education = require("../utils/education-handler.js").__test;

const responseCapture = () => {
  const captured = { statusCode: 0, body: null };
  return {
    captured,
    response: {
      status(code) { captured.statusCode = code; return this; },
      json(body) { captured.body = body; return body; }
    }
  };
};

test("server normalization always derives education role from the signed-in user", () => {
  const user = { _id: "student-1", educationRole: "student", roles: [] };
  const state = education.sanitizeState({ role: "platform-admin", profile: { id: "learner-1", grade: 6 } }, user, "learner-1");
  assert.equal(state.role, "student");
  assert.equal(state.ownerId, "student-1");
});

test("linked access is resolved by the exact family link instead of a shared profile id", async () => {
  const linkA = new ObjectId(); const linkB = new ObjectId(); let progressLookups = 0;
  const db = { collection(name) { return { async findOne(query) {
    if (name === "education_progress") { progressLookups += 1; return { _id: new ObjectId() }; }
    if (name === "education_family_links" && String(query._id) === String(linkA)) return { _id: linkA, learnerOwnerId: "owner-a", learnerProfileId: "learner-1" };
    if (name === "education_family_links" && String(query._id) === String(linkB)) return { _id: linkB, learnerOwnerId: "owner-b", learnerProfileId: "learner-1" };
    return null;
  } }; } };
  const user = { _id: "parent", educationRole: "parent", roles: [] };
  const first = await education.canAccessLearner(db, user, "learner-1", "read-linked", String(linkA));
  const second = await education.canAccessLearner(db, user, "learner-1", "read-linked", String(linkB));
  assert.equal(first.learnerOwnerId, "owner-a");
  assert.equal(second.learnerOwnerId, "owner-b");
  assert.equal(progressLookups, 0);
});

test("Family Mode receives a redacted aggregate instead of answers or private state", async () => {
  const linkId = new ObjectId();
  const privateState = {
    attempts: [{ answer: "bài làm riêng", expectedAnswer: "đáp án" }], mistakes: [{ expected: "bí mật" }], reviews: [{ dueAt: new Date(0).toISOString() }],
    progress: { lesson: { status: "completed" } }, mastery: { skill: { score: 90 } }, aiSessions: [{ prompt: "riêng" }], familyProfiles: [{ name: "Khác" }], auditLogs: [{ event: "private" }]
  };
  const db = { collection(name) { return { async findOne(query) {
    if (name === "education_family_links") return { _id: linkId, learnerOwnerId: "child-owner", learnerProfileId: "learner-1" };
    if (name === "education_progress" && query.ownerId === "child-owner") return { state: privateState, revision: 4, updatedAt: new Date(), schemaVersion: 3 };
    return null;
  } }; } };
  const req = { method: "GET", query: { learnerProfileId: "learner-1", scope: "linked", accessId: String(linkId) } };
  const { response, captured } = responseCapture();
  await education.progress(req, response, db, { _id: "parent", educationRole: "parent", roles: [] }, {});
  assert.equal(captured.statusCode, 200);
  assert.deepEqual(captured.body.report, { attempts: 1, mistakes: 1, due: 1, completedLessons: 1, skills: 1, updatedAt: captured.body.report.updatedAt });
  assert.equal(Object.hasOwn(captured.body, "state"), false);
  assert.equal(JSON.stringify(captured.body).includes("đáp án"), false);
  assert.equal(JSON.stringify(captured.body).includes("bài làm riêng"), false);
});
