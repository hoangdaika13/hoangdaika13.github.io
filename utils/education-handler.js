const { ObjectId } = require("mongodb");
const { createHash, randomBytes } = require("crypto");
const { clean, currentUser, enforceRateLimit, isOwnerUser, withApi } = require("./platform");
const { parseOpenAIKeys, runOpenAIResponse } = require("./openai-provider");

const ALLOWED_ROLES = new Set(["student", "parent", "teacher", "content-reviewer", "school-admin", "platform-admin"]);
const AI_ACTIONS = new Set(["hint", "simplify", "similar", "summarize", "socratic", "exam-review", "flashcards", "rubric", "report"]);
let indexReady = false;

function fail(statusCode, message, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; throw error; }
function id(value, fallback = "") { return clean(value, 100).replace(/[^a-zA-Z0-9._-]/g, "") || fallback; }
function tokenHash(value) { return createHash("sha256").update(String(value || "")).digest("hex"); }
function invitationToken(bytes = 18) { return randomBytes(bytes).toString("base64url"); }
function objectId(value, message = "Mã bản ghi không hợp lệ.") { if (!ObjectId.isValid(String(value || ""))) fail(400, message, "EDUCATION_ID_INVALID"); return new ObjectId(String(value)); }
function roleOf(user) {
  if (isOwnerUser(user)) return "platform-admin";
  const role = [...(user.roles || []), user.educationRole].map((item) => clean(item, 40).toLowerCase()).find((item) => ALLOWED_ROLES.has(item));
  return role || "student";
}
function resourceOf(req) {
  if (req.query.educationResource) return clean(req.query.educationResource, 60).toLowerCase();
  const direct = Array.isArray(req.query.resource) ? req.query.resource[0] : req.query.resource;
  if (direct) return clean(direct, 60).toLowerCase();
  return clean(String(req.url || "").split("?")[0].split("/").filter(Boolean).slice(-1)[0], 60).toLowerCase();
}
async function indexes(db) {
  if (indexReady) return;
  await Promise.all([
    db.collection("education_progress").createIndex({ ownerId: 1, learnerProfileId: 1 }, { unique: true, name: "education_progress_owner_profile" }),
    db.collection("education_classes").createIndex({ teacherId: 1, updatedAt: -1 }, { name: "education_classes_teacher" }),
    db.collection("education_classes").createIndex({ code: 1 }, { unique: true, name: "education_classes_code" }),
    db.collection("education_enrollments").createIndex({ learnerOwnerId: 1, learnerProfileId: 1, classId: 1 }, { unique: true, name: "education_enrollment_unique" }),
    db.collection("education_assignments").createIndex({ classId: 1, dueAt: 1 }, { name: "education_assignments_class_due" }),
    db.collection("education_ai_sessions").createIndex({ ownerId: 1, learnerProfileId: 1, createdAt: -1 }, { name: "education_ai_owner_profile" }),
    db.collection("education_audit_logs").createIndex({ actorId: 1, createdAt: -1 }, { name: "education_audit_actor" }),
    db.collection("education_reviews").createIndex({ status: 1, createdAt: 1 }, { name: "education_review_status" })
    ,db.collection("education_family_links").createIndex({ tokenHash: 1 }, { unique: true, sparse: true, name: "education_family_token" })
    ,db.collection("education_family_links").createIndex({ parentId: 1, status: 1 }, { name: "education_family_parent" })
    ,db.collection("education_submissions").createIndex({ assignmentId: 1, learnerOwnerId: 1, learnerProfileId: 1 }, { unique: true, name: "education_submission_unique" })
    ,db.collection("education_content_versions").createIndex({ contentId: 1, version: -1 }, { unique: true, name: "education_content_version" })
    ,db.collection("education_content_versions").createIndex({ checksum: 1, status: 1 }, { name: "education_content_duplicate" })
  ]);
  indexReady = true;
}
function publicId(value) { return value?._id ? String(value._id) : clean(value?.id, 100); }
function sanitizeState(input, user, profileId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "Trạng thái học tập không hợp lệ.", "EDUCATION_STATE_INVALID");
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, "utf8") > 280000) fail(413, "Trạng thái học tập vượt giới hạn 280 KB.", "EDUCATION_STATE_TOO_LARGE");
  const clone = JSON.parse(serialized);
  clone.schemaVersion = 2;
  clone.ownerId = String(user._id);
  clone.learnerProfileId = profileId;
  clone.updatedAt = new Date().toISOString();
  delete clone.roles;
  delete clone.access;
  return clone;
}
async function canAccessLearner(db, user, learnerProfileId, mode = "read-own") {
  const role = roleOf(user);
  if (role === "platform-admin") return { allowed: true, scope: "platform-admin" };
  // A profile id is namespaced by the signed-in owner. Reading a missing own
  // profile is valid and returns an empty state, while never selecting another
  // owner's document from only a guessable learnerProfileId.
  if (mode === "read-own" || mode === "create-own") return { allowed: true, scope: "owner" };
  const own = await db.collection("education_progress").findOne({ ownerId: user._id, learnerProfileId }, { projection: { _id: 1 } });
  if (own) return { allowed: true, scope: "owner" };
  if (role === "parent") {
    const linked = await db.collection("education_family_links").findOne({ learnerProfileId, parentId: user._id, status: "active" }, { projection: { _id: 1, learnerOwnerId: 1 } });
    if (linked) return { allowed: true, scope: "parent", learnerOwnerId: linked.learnerOwnerId };
  }
  if (role === "teacher") {
    const linked = await db.collection("education_enrollments").findOne({ learnerProfileId, teacherIds: user._id, status: "active" }, { projection: { _id: 1, learnerOwnerId: 1 } });
    if (linked) return { allowed: true, scope: "teacher", learnerOwnerId: linked.learnerOwnerId };
  }
  return { allowed: false };
}
async function audit(db, user, event, detail = {}) {
  await db.collection("education_audit_logs").insertOne({ actorId: user._id, actorRole: roleOf(user), event: clean(event, 100), detail, createdAt: new Date(), schemaVersion: 1 });
}

async function progress(req, res, db, user, body) {
  const learnerProfileId = id(req.query.learnerProfileId || body.learnerProfileId, "learner-1");
  if (req.method === "GET") {
    const access = await canAccessLearner(db, user, learnerProfileId, req.query.scope === "linked" ? "read-linked" : "read-own");
    if (!access.allowed) return res.status(404).json({ error: "Không tìm thấy hồ sơ học sinh hoặc bạn không có quyền.", code: "LEARNER_NOT_FOUND" });
    const ownerId = access.learnerOwnerId || user._id;
    const item = await db.collection("education_progress").findOne({ ownerId, learnerProfileId }, { projection: { state: 1, revision: 1, updatedAt: 1, schemaVersion: 1 } });
    return res.status(200).json({ learnerProfileId, state: item?.state || null, revision: Number(item?.revision || 0), updatedAt: item?.updatedAt || null, schemaVersion: item?.schemaVersion || 2 });
  }
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  const access = await canAccessLearner(db, user, learnerProfileId, "create-own");
  if (!access.allowed || !["owner", "platform-admin"].includes(access.scope)) return res.status(403).json({ error: "Chỉ chủ hồ sơ được đồng bộ trạng thái học tập.", code: "PROGRESS_WRITE_FORBIDDEN" });
  const existing = await db.collection("education_progress").findOne({ ownerId: user._id, learnerProfileId }, { projection: { revision: 1, state: 1, updatedAt: 1 } });
  const baseRevision = Math.max(0, Number(body.baseRevision ?? body.state?.serverRevision ?? 0));
  const serverRevision = Number(existing?.revision || 0);
  if (existing && baseRevision !== serverRevision) return res.status(409).json({ error: "Tiến độ trên máy chủ đã mới hơn. Hãy chọn giữ bản local, bản server hoặc hợp nhất.", code: "PROGRESS_CONFLICT", conflict: { serverState: existing.state, serverRevision, serverUpdatedAt: existing.updatedAt } });
  const state = sanitizeState(body.state, user, learnerProfileId); const revision = serverRevision + 1; state.serverRevision = revision;
  const now = new Date();
  await db.collection("education_progress").updateOne({ ownerId: user._id, learnerProfileId }, { $set: { state, revision, updatedAt: now, schemaVersion: 2 }, $setOnInsert: { createdAt: now } }, { upsert: true });
  await audit(db, user, "education:progress:sync", { learnerProfileId, revision });
  return res.status(200).json({ ok: true, learnerProfileId, revision, updatedAt: now.toISOString() });
}

async function teacherClass(db, user, classId, role = roleOf(user)) {
  const _id = objectId(classId, "Lớp không hợp lệ.");
  const scope = role === "platform-admin" ? {} : role === "school-admin" ? { $or: [{ teacherId: user._id }, { adminIds: user._id }] } : { teacherId: user._id };
  return db.collection("education_classes").findOne({ _id, ...scope });
}

async function classes(req, res, db, user, body) {
  const role = roleOf(user);
  if (!["teacher", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Teacher Mode yêu cầu vai trò giáo viên hoặc quản trị trường.", code: "TEACHER_ROLE_REQUIRED" });
  const collection = db.collection("education_classes");
  if (req.method === "GET") {
    const filter = role === "platform-admin" ? {} : role === "school-admin" ? { $or: [{ adminIds: user._id }, { teacherId: user._id }] } : { teacherId: user._id };
    const items = await collection.find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
    return res.status(200).json({ items: items.map((item) => ({ id: publicId(item), name: item.name, grade: item.grade, studentCount: item.studentCount || 0, inviteActive: Boolean(item.inviteCodeHash && item.inviteExpiresAt > new Date()), inviteExpiresAt: item.inviteExpiresAt || null, updatedAt: item.updatedAt })) });
  }
  if (req.method === "POST") {
    const name = clean(body.name, 80); const grade = Math.max(1, Math.min(12, Number(body.grade) || 1)); if (!name) return res.status(400).json({ error: "Tên lớp là bắt buộc." });
    const inviteCode = invitationToken(9); const now = new Date(); const inviteExpiresAt = new Date(now.getTime() + 7 * 86400000);
    const doc = { name, grade, teacherId: user._id, adminIds: [], studentCount: 0, inviteCodeHash: tokenHash(inviteCode), inviteExpiresAt, inviteVersion: 1, status: "active", createdAt: now, updatedAt: now, schemaVersion: 2 };
    const result = await collection.insertOne(doc); await audit(db, user, "education:class:create", { classId: String(result.insertedId), grade });
    return res.status(200).json({ ok: true, item: { id: String(result.insertedId), name, grade, inviteCode, inviteExpiresAt, studentCount: 0 } });
  }
  if (req.method === "PATCH") {
    const doc = await teacherClass(db, user, body.classId, role); if (!doc) return res.status(403).json({ error: "Bạn không được sửa lớp này." });
    const action = clean(body.action, 40); const update = { updatedAt: new Date() }; let inviteCode = null;
    if (action === "rotate-invite") { inviteCode = invitationToken(9); update.inviteCodeHash = tokenHash(inviteCode); update.inviteExpiresAt = new Date(Date.now() + Math.min(30, Math.max(1, Number(body.days) || 7)) * 86400000); update.inviteVersion = Number(doc.inviteVersion || 0) + 1; }
    else if (action === "disable-invite") { update.inviteCodeHash = null; update.inviteExpiresAt = new Date(0); }
    else { if (body.name) update.name = clean(body.name, 80); if (body.grade) update.grade = Math.max(1, Math.min(12, Number(body.grade))); }
    await collection.updateOne({ _id: doc._id }, { $set: update }); await audit(db, user, `education:class:${action || "update"}`, { classId: String(doc._id) });
    return res.status(200).json({ ok: true, inviteCode, inviteExpiresAt: update.inviteExpiresAt || doc.inviteExpiresAt });
  }
  if (req.method === "DELETE") { const doc = await teacherClass(db, user, req.query.classId || body.classId, role); if (!doc) return res.status(403).json({ error: "Bạn không được lưu trữ lớp này." }); await collection.updateOne({ _id: doc._id }, { $set: { status: "archived", inviteCodeHash: null, inviteExpiresAt: new Date(0), updatedAt: new Date() } }); await audit(db, user, "education:class:archive", { classId: String(doc._id) }); return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: "Method not allowed" });
}

async function enrollments(req, res, db, user, body) {
  const collection = db.collection("education_enrollments"); const learnerProfileId = id(body.learnerProfileId || req.query.learnerProfileId, "learner-1");
  if (req.method === "GET") { const items = await collection.find({ learnerOwnerId: user._id, learnerProfileId, status: "active" }).sort({ createdAt: -1 }).limit(100).toArray(); return res.status(200).json({ items: items.map((item) => ({ id: publicId(item), classId: String(item.classId), joinedAt: item.createdAt })) }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `education-join:${user._id}`, 10, 15 * 60 * 1000);
  const classDoc = await db.collection("education_classes").findOne({ inviteCodeHash: tokenHash(clean(body.inviteCode, 100)), inviteExpiresAt: { $gt: new Date() }, status: "active" });
  if (!classDoc) return res.status(400).json({ error: "Mã mời không hợp lệ hoặc đã hết hạn.", code: "CLASS_INVITE_INVALID" });
  const now = new Date(); const result = await collection.updateOne({ learnerOwnerId: user._id, learnerProfileId, classId: classDoc._id }, { $set: { status: "active", teacherIds: [classDoc.teacherId], updatedAt: now, schemaVersion: 2 }, $setOnInsert: { createdAt: now } }, { upsert: true });
  if (result.upsertedCount) await db.collection("education_classes").updateOne({ _id: classDoc._id }, { $inc: { studentCount: 1 }, $set: { updatedAt: now } });
  await audit(db, user, "education:class:join", { classId: String(classDoc._id), learnerProfileId }); return res.status(200).json({ ok: true, classId: String(classDoc._id), className: classDoc.name });
}

async function assignments(req, res, db, user, body) {
  const collection = db.collection("education_assignments"); const role = roleOf(user);
  if (req.method === "GET") {
    const learnerProfileId = id(req.query.learnerProfileId, "learner-1");
    if (["teacher", "school-admin", "platform-admin"].includes(role) && req.query.classId) {
      if (!ObjectId.isValid(String(req.query.classId))) return res.status(400).json({ error: "Lớp không hợp lệ." });
      const classId = new ObjectId(String(req.query.classId)); const classDoc = await db.collection("education_classes").findOne({ _id: classId, ...(role === "platform-admin" ? {} : { $or: [{ teacherId: user._id }, { adminIds: user._id }] }) });
      if (!classDoc) return res.status(403).json({ error: "Bạn không được xem lớp này." });
      return res.status(200).json({ items: await collection.find({ classId }).sort({ dueAt: 1 }).limit(200).toArray() });
    }
    const enrollment = await db.collection("education_enrollments").find({ learnerOwnerId: user._id, learnerProfileId, status: "active" }, { projection: { classId: 1 } }).toArray();
    const classIds = enrollment.map((item) => item.classId);
    const items = classIds.length ? await collection.find({ classId: { $in: classIds } }).sort({ dueAt: 1 }).limit(200).toArray() : [];
    return res.status(200).json({ items });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!["teacher", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Chỉ giáo viên được giao bài." });
  if (!ObjectId.isValid(String(body.classId || ""))) return res.status(400).json({ error: "Lớp không hợp lệ." });
  const classId = new ObjectId(String(body.classId));
  const classDoc = await db.collection("education_classes").findOne({ _id: classId, ...(role === "platform-admin" ? {} : { $or: [{ teacherId: user._id }, { adminIds: user._id }] }) });
  if (!classDoc) return res.status(403).json({ error: "Bạn không được giao bài cho lớp này." });
  const title = clean(body.title, 120); if (!title) return res.status(400).json({ error: "Tiêu đề bài giao là bắt buộc." });
  const dueAt = new Date(body.dueAt); if (!Number.isFinite(dueAt.getTime())) return res.status(400).json({ error: "Hạn nộp không hợp lệ." });
  const now = new Date(); const doc = { classId, teacherId: user._id, title, lessonIds: (body.lessonIds || []).map((item) => id(item)).filter(Boolean).slice(0, 50), targetLearnerProfileIds: (body.targetLearnerProfileIds || []).map((item) => id(item)).filter(Boolean).slice(0, 100), dueAt, lockAnswers: body.lockAnswers !== false, status: "assigned", createdAt: now, updatedAt: now, schemaVersion: 2 };
  const result = await collection.insertOne(doc); await audit(db, user, "education:assignment:create", { assignmentId: String(result.insertedId), classId: String(classId) });
  return res.status(200).json({ ok: true, item: { ...doc, id: String(result.insertedId) } });
}

async function submissions(req, res, db, user, body) {
  const role = roleOf(user); const collection = db.collection("education_submissions");
  if (req.method === "GET") {
    if (["teacher", "school-admin", "platform-admin"].includes(role) && req.query.classId) {
      const classDoc = await teacherClass(db, user, req.query.classId, role); if (!classDoc) return res.status(403).json({ error: "Bạn không được xem bài nộp của lớp này." });
      const assignmentIds = (await db.collection("education_assignments").find({ classId: classDoc._id }, { projection: { _id: 1 } }).toArray()).map((item) => item._id);
      return res.status(200).json({ items: await collection.find({ assignmentId: { $in: assignmentIds } }).sort({ submittedAt: -1 }).limit(300).toArray() });
    }
    const learnerProfileId = id(req.query.learnerProfileId, "learner-1"); return res.status(200).json({ items: await collection.find({ learnerOwnerId: user._id, learnerProfileId }).sort({ updatedAt: -1 }).limit(200).toArray() });
  }
  if (req.method === "POST") {
    const assignmentId = objectId(body.assignmentId, "Bài giao không hợp lệ."); const learnerProfileId = id(body.learnerProfileId, "learner-1");
    const assignment = await db.collection("education_assignments").findOne({ _id: assignmentId, status: "assigned" }); if (!assignment) return res.status(404).json({ error: "Không tìm thấy bài giao." });
    const enrolled = await db.collection("education_enrollments").findOne({ learnerOwnerId: user._id, learnerProfileId, classId: assignment.classId, status: "active" }); if (!enrolled) return res.status(403).json({ error: "Bạn không thuộc lớp nhận bài này." });
    const answer = clean(body.answer, 12000); if (!answer) return res.status(400).json({ error: "Bài làm đang trống." }); const now = new Date(); const status = now > assignment.dueAt ? "submitted-late" : "submitted";
    await collection.updateOne({ assignmentId, learnerOwnerId: user._id, learnerProfileId }, { $set: { answer, status, submittedAt: now, updatedAt: now, schemaVersion: 2 }, $setOnInsert: { createdAt: now } }, { upsert: true }); await audit(db, user, "education:submission:submit", { assignmentId: String(assignmentId), learnerProfileId, status }); return res.status(200).json({ ok: true, status });
  }
  if (req.method === "PATCH") {
    if (!["teacher", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Chỉ giáo viên được chấm bài." });
    const submission = await collection.findOne({ _id: objectId(body.submissionId, "Bài nộp không hợp lệ.") }); if (!submission) return res.status(404).json({ error: "Không tìm thấy bài nộp." });
    const assignment = await db.collection("education_assignments").findOne({ _id: submission.assignmentId }); const classDoc = assignment && await teacherClass(db, user, assignment.classId, role); if (!classDoc) return res.status(403).json({ error: "Bạn không được chấm bài này." });
    const score = Math.max(0, Math.min(100, Number(body.score))); const feedback = clean(body.feedback, 3000); const status = body.requireRedo ? "redo-required" : "returned"; const now = new Date();
    await collection.updateOne({ _id: submission._id }, { $set: { score, feedback, rubricScores: Array.isArray(body.rubricScores) ? body.rubricScores.slice(0, 20) : [], status, gradedBy: user._id, gradedAt: now, updatedAt: now } }); await audit(db, user, "education:submission:grade", { submissionId: String(submission._id), score, status }); return res.status(200).json({ ok: true, status, score });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

async function family(req, res, db, user, body) {
  const role = roleOf(user); const collection = db.collection("education_family_links");
  if (req.method === "GET") { const filter = role === "parent" ? { parentId: user._id, status: "active" } : { learnerOwnerId: user._id, status: "active" }; const items = await collection.find(filter).sort({ updatedAt: -1 }).limit(50).toArray(); return res.status(200).json({ items: items.map((item) => ({ id: publicId(item), learnerProfileId: item.learnerProfileId, learnerName: item.learnerName, relationship: item.relationship, expiresAt: item.expiresAt, status: item.status })) }); }
  if (req.method === "POST") {
    const action = clean(body.action, 40); const now = new Date();
    if (action === "create-invite") { const learnerProfileId = id(body.learnerProfileId, "learner-1"); const progressDoc = await db.collection("education_progress").findOne({ ownerId: user._id, learnerProfileId }); if (!progressDoc) return res.status(404).json({ error: "Hãy đồng bộ hồ sơ học sinh trước khi tạo lời mời." }); const token = invitationToken(); const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); await collection.insertOne({ tokenHash: tokenHash(token), learnerOwnerId: user._id, learnerProfileId, learnerName: clean(body.learnerName, 80), relationship: clean(body.relationship || "parent", 40), status: "pending", expiresAt, createdAt: now, updatedAt: now, schemaVersion: 2 }); await audit(db, user, "education:family:invite-create", { learnerProfileId, expiresAt }); return res.status(200).json({ ok: true, token, expiresAt }); }
    if (action === "accept-invite") { if (role !== "parent" && role !== "platform-admin") return res.status(403).json({ error: "Tài khoản cần vai trò phụ huynh để liên kết hồ sơ." }); const link = await collection.findOne({ tokenHash: tokenHash(clean(body.token, 200)), status: "pending", expiresAt: { $gt: now } }); if (!link) return res.status(400).json({ error: "Lời mời không hợp lệ hoặc đã hết hạn." }); await collection.updateOne({ _id: link._id }, { $set: { parentId: user._id, status: "active", acceptedAt: now, updatedAt: now }, $unset: { tokenHash: "" } }); await db.collection("education_enrollments").updateMany({ learnerOwnerId: link.learnerOwnerId, learnerProfileId: link.learnerProfileId, status: "active" }, { $addToSet: { parentIds: user._id } }); await audit(db, user, "education:family:invite-accept", { learnerProfileId: link.learnerProfileId }); return res.status(200).json({ ok: true, learnerProfileId: link.learnerProfileId }); }
    return res.status(400).json({ error: "Hành động Family Mode không hợp lệ." });
  }
  if (req.method === "DELETE") { const linkId = objectId(req.query.id || body.id, "Liên kết không hợp lệ."); const query = role === "parent" ? { _id: linkId, parentId: user._id } : { _id: linkId, learnerOwnerId: user._id }; const result = await collection.updateOne(query, { $set: { status: "revoked", revokedAt: new Date(), updatedAt: new Date() } }); if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy liên kết được phép thu hồi." }); await audit(db, user, "education:family:revoke", { linkId: String(linkId) }); return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: "Method not allowed" });
}

async function aiTutor(req, res, db, user, body) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `education-ai:${user._id}`, 25, 15 * 60 * 1000);
  const grade = Math.max(1, Math.min(12, Number(body.grade) || 1)); const action = clean(body.action, 40);
  if (!AI_ACTIONS.has(action)) return res.status(400).json({ error: "Hoạt động AI Tutor không hợp lệ." });
  if (action === "report") { const now = new Date(); await db.collection("education_ai_sessions").insertOne({ ownerId: user._id, learnerProfileId: id(body.learnerProfileId, "learner-1"), lessonId: id(body.lessonId), action, reportReason: clean(body.reason, 500), status: "reported", createdAt: now, schemaVersion: 2 }); await audit(db, user, "education:ai-report", { lessonId: id(body.lessonId) }); return res.status(200).json({ ok: true, reportedAt: now.toISOString() }); }
  if (grade <= 5 && !["hint", "simplify", "similar", "summarize", "flashcards"].includes(action)) return res.status(403).json({ error: "Học sinh lớp 1–5 chỉ dùng hoạt động AI có hướng dẫn." });
  const context = body.lessonContext && typeof body.lessonContext === "object" ? body.lessonContext : {};
  const title = clean(context.title, 160); const outcome = clean(context.outcome, 500); const method = (Array.isArray(context.method) ? context.method : []).map((item) => clean(item, 240)).filter(Boolean).slice(0, 8);
  if (!title || !outcome || !method.length) return res.status(400).json({ error: "AI Tutor cần ngữ cảnh bài học đã được phê duyệt." });
  const keys = parseOpenAIKeys(); if (!keys.length) return res.status(503).json({ error: "AI Tutor chưa được cấu hình trên máy chủ; bài học cục bộ vẫn dùng bình thường.", code: "AI_TUTOR_NOT_CONFIGURED" });
  const instruction = `Bạn là AI Tutor HH School an toàn cho học sinh lớp ${grade}. Chỉ dùng ngữ cảnh bài học được cung cấp. Hỏi gợi mở trước khi nêu đáp án; không bịa nguồn, tác giả, công thức hay dữ kiện. Không chẩn đoán y tế/tâm lý, không yêu cầu dữ liệu cá nhân. Trả lời tiếng Việt ngắn, phù hợp tuổi. Với action hint chỉ nêu một bước tiếp theo. Với similar tạo một bài tương đương và không giải ngay. Luôn nhắc đây là hỗ trợ học tập, không phải điểm chính thức.`;
  const prompt = JSON.stringify({ action, lesson: { title, outcome, method }, originalWorkSummary: clean(body.originalWork, 1200), rubric: Array.isArray(body.rubric) ? body.rubric.slice(0, 12).map((item) => clean(item, 200)) : [] });
  let result;
  try { result = await runOpenAIResponse({ apiKey: keys[0], model: process.env.OPENAI_EDUCATION_MODEL, prompt, instruction, history: [], attachments: [], reasoningEffort: "low", useWebSearch: false, safetyIdentifier: `education-${user._id}` }); }
  catch (error) { return res.status(Number(error.status || 502)).json({ error: clean(error.message, 300), code: clean(error.code, 80) || "AI_TUTOR_FAILED" }); }
  const now = new Date(); await db.collection("education_ai_sessions").insertOne({ ownerId: user._id, learnerProfileId: id(body.learnerProfileId, "learner-1"), lessonId: id(body.lessonId), grade, action, model: result.model, interactionId: result.interactionId, createdAt: now, schemaVersion: 1 });
  await audit(db, user, "education:ai-tutor", { lessonId: id(body.lessonId), grade, action });
  return res.status(200).json({ answer: result.output, disclaimer: "Phản hồi AI chỉ hỗ trợ học tập, không phải điểm chính thức.", sources: [{ title: `Bài học: ${title}`, lessonId: id(body.lessonId), type: "approved-lesson-context" }], model: result.model, canReport: true });
}

async function admin(req, res, db, user, body) {
  const role = roleOf(user); if (!["content-reviewer", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Bạn không có quyền kiểm duyệt nội dung." });
  const collection = db.collection("education_reviews");
  if (req.method === "GET") {
    const view = clean(req.query.view, 40);
    if (view === "content") return res.status(200).json({ items: await db.collection("education_content_versions").find({ status: { $ne: "deleted" } }).sort({ updatedAt: -1 }).limit(300).toArray() });
    if (view === "duplicates") {
      const items = await db.collection("education_content_versions").aggregate([{ $match: { status: { $ne: "deleted" } } }, { $group: { _id: "$checksum", count: { $sum: 1 }, contentIds: { $addToSet: "$contentId" } } }, { $match: { count: { $gt: 1 } } }, { $limit: 100 }]).toArray();
      return res.status(200).json({ items });
    }
    return res.status(200).json({ items: await collection.find({ status: { $in: ["proposed", "in-review"] } }).sort({ createdAt: 1 }).limit(300).toArray() });
  }
  if (req.method === "PATCH") {
    if (clean(body.action, 30) === "update-draft") {
      const contentId = id(body.contentId); const latest = await db.collection("education_content_versions").findOne({ contentId }, { sort: { version: -1 } }); if (!latest) return res.status(404).json({ error: "Không tìm thấy nội dung nháp." });
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {}; const serialized = JSON.stringify(payload); if (Buffer.byteLength(serialized, "utf8") > 120000) return res.status(413).json({ error: "Nội dung nháp vượt giới hạn 120 KB." });
      const now = new Date(); const version = Number(latest.version || 0) + 1; const doc = { ...latest, _id: undefined, version, title: clean(body.title || latest.title, 160), payload, checksum: tokenHash(serialized), status: "draft", contentStatus: "machine_generated", updatedBy: user._id, updatedAt: now, createdAt: now };
      const result = await db.collection("education_content_versions").insertOne(doc); await audit(db, user, "education:content:update-draft", { contentId, version }); return res.status(200).json({ ok: true, item: { ...doc, id: String(result.insertedId) } });
    }
    if (!["school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Reviewer chỉ được đề xuất, không được xuất bản." });
    const reviewId = objectId(body.reviewId, "Phiếu duyệt không hợp lệ."); const action = clean(body.action, 30); const allowed = new Set(["reviewed", "approved", "unpublished", "rolled-back"]); if (!allowed.has(action)) return res.status(400).json({ error: "Trạng thái xuất bản không hợp lệ." });
    const now = new Date(); const result = await collection.updateOne({ _id: reviewId }, { $set: { status: action, reviewerId: user._id, reviewedAt: now, updatedAt: now } }); if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy phiếu duyệt." }); await audit(db, user, `education:review:${action}`, { reviewId: String(reviewId) }); return res.status(200).json({ ok: true, status: action });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (clean(body.action, 30) === "create-draft") {
    const title = clean(body.title, 160); if (!title) return res.status(400).json({ error: "Tên nội dung nháp là bắt buộc." });
    const kind = new Set(["curriculum", "lesson", "question", "source", "license"]).has(clean(body.kind, 30)) ? clean(body.kind, 30) : "lesson";
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {}; const serialized = JSON.stringify(payload); if (Buffer.byteLength(serialized, "utf8") > 120000) return res.status(413).json({ error: "Nội dung nháp vượt giới hạn 120 KB." });
    const contentId = id(body.contentId || `${kind}-${Date.now()}`); const now = new Date(); const doc = { contentId, kind, title, payload, sourceUrl: clean(body.sourceUrl, 500), licenseCode: clean(body.licenseCode, 60), checksum: tokenHash(serialized), version: 1, status: "draft", contentStatus: "machine_generated", createdBy: user._id, updatedBy: user._id, createdAt: now, updatedAt: now, schemaVersion: 2 };
    const result = await db.collection("education_content_versions").insertOne(doc); await audit(db, user, "education:content:create-draft", { contentId, kind }); return res.status(200).json({ ok: true, item: { ...doc, id: String(result.insertedId) } });
  }
  const lessonId = id(body.lessonId); const note = clean(body.note, 1000); if (!lessonId || !note) return res.status(400).json({ error: "Mã bài học và đề xuất chỉnh sửa là bắt buộc." });
  const now = new Date(); const doc = { lessonId, note, status: "proposed", proposedBy: user._id, reviewerId: null, createdAt: now, updatedAt: now, schemaVersion: 1 };
  const result = await collection.insertOne(doc); await audit(db, user, "education:review:propose", { reviewId: String(result.insertedId), lessonId }); return res.status(200).json({ ok: true, id: String(result.insertedId) });
}

async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req); if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng backend HH School.", code: "AUTH_REQUIRED" });
    await indexes(db); const resource = resourceOf(req);
    if (resource === "progress") return progress(req, res, db, user, body);
    if (resource === "classes") return classes(req, res, db, user, body);
    if (resource === "enrollments") return enrollments(req, res, db, user, body);
    if (resource === "assignments") return assignments(req, res, db, user, body);
    if (resource === "submissions") return submissions(req, res, db, user, body);
    if (resource === "family") return family(req, res, db, user, body);
    if (resource === "ai-tutor") return aiTutor(req, res, db, user, body);
    if (resource === "admin") return admin(req, res, db, user, body);
    return res.status(404).json({ error: "HH School API resource không tồn tại." });
  });
}
handler.__test = { roleOf, tokenHash, sanitizeState, canAccessLearner };
module.exports = handler;
