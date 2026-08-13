const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, isAdminUser, isOwnerUser, withApi } = require("./platform");
const { parseOpenAIKeys, runOpenAIResponse } = require("./openai-provider");

const ALLOWED_ROLES = new Set(["student", "parent", "teacher", "content-reviewer", "school-admin", "platform-admin"]);
const AI_ACTIONS = new Set(["hint", "simplify", "similar", "summarize", "socratic", "exam-review"]);
let indexReady = false;

function fail(statusCode, message, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; throw error; }
function id(value, fallback = "") { return clean(value, 100).replace(/[^a-zA-Z0-9._-]/g, "") || fallback; }
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
  ]);
  indexReady = true;
}
function publicId(value) { return value?._id ? String(value._id) : clean(value?.id, 100); }
function sanitizeState(input, user, profileId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "Trạng thái học tập không hợp lệ.", "EDUCATION_STATE_INVALID");
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, "utf8") > 280000) fail(413, "Trạng thái học tập vượt giới hạn 280 KB.", "EDUCATION_STATE_TOO_LARGE");
  const clone = JSON.parse(serialized);
  clone.schemaVersion = 1;
  clone.ownerId = String(user._id);
  clone.learnerProfileId = profileId;
  clone.updatedAt = new Date().toISOString();
  delete clone.roles;
  delete clone.access;
  return clone;
}
async function canAccessLearner(db, user, learnerProfileId, mode = "read-own") {
  const role = roleOf(user);
  if (role === "platform-admin" || isAdminUser(user)) return { allowed: true, scope: "platform-admin" };
  // A profile id is namespaced by the signed-in owner. Reading a missing own
  // profile is valid and returns an empty state, while never selecting another
  // owner's document from only a guessable learnerProfileId.
  if (mode === "read-own" || mode === "create-own") return { allowed: true, scope: "owner" };
  const own = await db.collection("education_progress").findOne({ ownerId: user._id, learnerProfileId }, { projection: { _id: 1 } });
  if (own) return { allowed: true, scope: "owner" };
  if (role === "parent") {
    const linked = await db.collection("education_enrollments").findOne({ learnerProfileId, parentIds: user._id, status: "active" }, { projection: { _id: 1, learnerOwnerId: 1 } });
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
    const access = await canAccessLearner(db, user, learnerProfileId);
    if (!access.allowed) return res.status(404).json({ error: "Không tìm thấy hồ sơ học sinh hoặc bạn không có quyền.", code: "LEARNER_NOT_FOUND" });
    const ownerId = access.learnerOwnerId || user._id;
    const item = await db.collection("education_progress").findOne({ ownerId, learnerProfileId }, { projection: { state: 1, updatedAt: 1, schemaVersion: 1 } });
    return res.status(200).json({ learnerProfileId, state: item?.state || null, updatedAt: item?.updatedAt || null, schemaVersion: item?.schemaVersion || 1 });
  }
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  const access = await canAccessLearner(db, user, learnerProfileId, "create-own");
  if (!access.allowed || !["owner", "platform-admin"].includes(access.scope)) return res.status(403).json({ error: "Chỉ chủ hồ sơ được đồng bộ trạng thái học tập.", code: "PROGRESS_WRITE_FORBIDDEN" });
  const state = sanitizeState(body.state, user, learnerProfileId);
  const now = new Date();
  await db.collection("education_progress").updateOne({ ownerId: user._id, learnerProfileId }, { $set: { state, updatedAt: now, schemaVersion: 1 }, $setOnInsert: { createdAt: now } }, { upsert: true });
  await audit(db, user, "education:progress:sync", { learnerProfileId });
  return res.status(200).json({ ok: true, learnerProfileId, updatedAt: now.toISOString() });
}

async function classes(req, res, db, user, body) {
  const role = roleOf(user);
  if (!["teacher", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Teacher Mode yêu cầu vai trò giáo viên hoặc quản trị trường.", code: "TEACHER_ROLE_REQUIRED" });
  const collection = db.collection("education_classes");
  if (req.method === "GET") {
    const filter = role === "platform-admin" ? {} : role === "school-admin" ? { $or: [{ adminIds: user._id }, { teacherId: user._id }] } : { teacherId: user._id };
    const items = await collection.find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
    return res.status(200).json({ items: items.map((item) => ({ id: publicId(item), name: item.name, grade: item.grade, code: item.code, studentCount: item.studentCount || 0, updatedAt: item.updatedAt })) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const name = clean(body.name, 80); const grade = Math.max(1, Math.min(12, Number(body.grade) || 1));
  if (!name) return res.status(400).json({ error: "Tên lớp là bắt buộc." });
  let code = id(body.code || Math.random().toString(36).slice(2, 8), "CLASS").toUpperCase().slice(0, 10);
  if (await collection.findOne({ code })) code = `${code.slice(0, 6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const now = new Date(); const doc = { name, grade, code, teacherId: user._id, adminIds: [], studentCount: 0, status: "active", createdAt: now, updatedAt: now, schemaVersion: 1 };
  const result = await collection.insertOne(doc); await audit(db, user, "education:class:create", { classId: String(result.insertedId), grade });
  return res.status(200).json({ ok: true, item: { id: String(result.insertedId), name, grade, code, studentCount: 0 } });
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
  const now = new Date(); const doc = { classId, teacherId: user._id, title, lessonIds: (body.lessonIds || []).map((item) => id(item)).filter(Boolean).slice(0, 50), dueAt, lockAnswers: body.lockAnswers !== false, status: "assigned", createdAt: now, updatedAt: now, schemaVersion: 1 };
  const result = await collection.insertOne(doc); await audit(db, user, "education:assignment:create", { assignmentId: String(result.insertedId), classId: String(classId) });
  return res.status(200).json({ ok: true, item: { ...doc, id: String(result.insertedId) } });
}

async function aiTutor(req, res, db, user, body) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `education-ai:${user._id}`, 25, 15 * 60 * 1000);
  const grade = Math.max(1, Math.min(12, Number(body.grade) || 1)); const action = clean(body.action, 40);
  if (!AI_ACTIONS.has(action)) return res.status(400).json({ error: "Hoạt động AI Tutor không hợp lệ." });
  if (grade <= 5 && !["hint", "simplify", "similar", "summarize"].includes(action)) return res.status(403).json({ error: "Học sinh lớp 1–5 chỉ dùng hoạt động AI có hướng dẫn." });
  const context = body.lessonContext && typeof body.lessonContext === "object" ? body.lessonContext : {};
  const title = clean(context.title, 160); const outcome = clean(context.outcome, 500); const method = (Array.isArray(context.method) ? context.method : []).map((item) => clean(item, 240)).filter(Boolean).slice(0, 8);
  if (!title || !outcome || !method.length) return res.status(400).json({ error: "AI Tutor cần ngữ cảnh bài học đã được phê duyệt." });
  const keys = parseOpenAIKeys(); if (!keys.length) return res.status(503).json({ error: "AI Tutor chưa được cấu hình trên máy chủ; bài học cục bộ vẫn dùng bình thường.", code: "AI_TUTOR_NOT_CONFIGURED" });
  const instruction = `Bạn là AI Tutor HH School an toàn cho học sinh lớp ${grade}. Chỉ dùng ngữ cảnh bài học được cung cấp. Hỏi gợi mở trước khi nêu đáp án; không bịa nguồn, tác giả, công thức hay dữ kiện. Không chẩn đoán y tế/tâm lý, không yêu cầu dữ liệu cá nhân. Trả lời tiếng Việt ngắn, phù hợp tuổi. Với action hint chỉ nêu một bước tiếp theo. Với similar tạo một bài tương đương và không giải ngay. Luôn nhắc đây là hỗ trợ học tập, không phải điểm chính thức.`;
  const prompt = JSON.stringify({ action, lesson: { title, outcome, method }, originalWork: clean(body.originalWork, 1200) });
  let result;
  try { result = await runOpenAIResponse({ apiKey: keys[0], model: process.env.OPENAI_EDUCATION_MODEL, prompt, instruction, history: [], attachments: [], reasoningEffort: "low", useWebSearch: false, safetyIdentifier: `education-${user._id}` }); }
  catch (error) { return res.status(Number(error.status || 502)).json({ error: clean(error.message, 300), code: clean(error.code, 80) || "AI_TUTOR_FAILED" }); }
  const now = new Date(); await db.collection("education_ai_sessions").insertOne({ ownerId: user._id, learnerProfileId: id(body.learnerProfileId, "learner-1"), lessonId: id(body.lessonId), grade, action, model: result.model, interactionId: result.interactionId, createdAt: now, schemaVersion: 1 });
  await audit(db, user, "education:ai-tutor", { lessonId: id(body.lessonId), grade, action });
  return res.status(200).json({ answer: result.output, sources: [{ title: `Bài học: ${title}`, lessonId: id(body.lessonId), type: "approved-lesson-context" }], model: result.model, canReport: true });
}

async function admin(req, res, db, user, body) {
  const role = roleOf(user); if (!["content-reviewer", "school-admin", "platform-admin"].includes(role)) return res.status(403).json({ error: "Bạn không có quyền kiểm duyệt nội dung." });
  const collection = db.collection("education_reviews");
  if (req.method === "GET") return res.status(200).json({ items: await collection.find({ status: { $in: ["proposed", "in-review"] } }).sort({ createdAt: 1 }).limit(300).toArray() });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const lessonId = id(body.lessonId); const note = clean(body.note, 1000); if (!lessonId || !note) return res.status(400).json({ error: "Mã bài học và đề xuất chỉnh sửa là bắt buộc." });
  const now = new Date(); const doc = { lessonId, note, status: "proposed", proposedBy: user._id, reviewerId: null, createdAt: now, updatedAt: now, schemaVersion: 1 };
  const result = await collection.insertOne(doc); await audit(db, user, "education:review:propose", { reviewId: String(result.insertedId), lessonId }); return res.status(200).json({ ok: true, id: String(result.insertedId) });
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req); if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng backend HH School.", code: "AUTH_REQUIRED" });
    await indexes(db); const resource = resourceOf(req);
    if (resource === "progress") return progress(req, res, db, user, body);
    if (resource === "classes") return classes(req, res, db, user, body);
    if (resource === "assignments") return assignments(req, res, db, user, body);
    if (resource === "ai-tutor") return aiTutor(req, res, db, user, body);
    if (resource === "admin") return admin(req, res, db, user, body);
    return res.status(404).json({ error: "HH School API resource không tồn tại." });
  });
};
