const { clean, currentUser, enforceRateLimit, withApi } = require("../utils/platform");

const MAX_STATE_BYTES = 1_500_000;
const PROFILE_ID = /^[a-zA-Z0-9_-]{1,72}$/;
const SENSITIVE_KEY = /(?:password|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key)/i;
const ALLOWED_TOP_LEVEL = new Set([
  "version", "activeView", "activeLesson", "completed", "attempts", "savedWords", "reviewQueue", "xp", "streak", "dailyGoal", "studyDays", "minutesByDay",
  "placement", "placementRewarded", "selectedLevel", "selectedCareer", "careerSurvey", "careerSurveyRewarded", "favoriteCareers", "writingDraft", "writingDrafts",
  "writingHistory", "practice", "practiceByLevel", "galaxyTopic", "galaxyLevel", "galaxyPackStatus", "galaxyMode", "galaxyCursor", "galaxySession", "wordMastery",
  "mistakeNotebook", "modeStats", "vocabularyStudio", "onboarding", "learnerProfile", "careerProfile", "settings", "speakingScenario", "speakingAttempts",
  "speakingRoleplays", "universalProfile", "familyMode", "everyoneStudio", "galaxy", "learningOS", "learnerProfileId"
]);

function profileIdOf(input) {
  const value = clean(input || "default", 72);
  if (!PROFILE_ID.test(value)) {
    const error = new Error("Hồ sơ người học không hợp lệ.");
    error.statusCode = 400;
    error.code = "LEARNER_PROFILE_INVALID";
    throw error;
  }
  return value;
}

function boundedClone(value, depth = 0) {
  if (depth > 20) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return value.slice(0, 12_000);
  if (Array.isArray(value)) return value.slice(0, 2000).map((item) => boundedClone(item, depth + 1));
  if (!value || typeof value !== "object") return null;
  const output = {};
  Object.entries(value).slice(0, 2000).forEach(([key, item]) => {
    if (SENSITIVE_KEY.test(key) || key.startsWith("$") || key.includes(".") || ["__proto__", "prototype", "constructor", "ownerId", "userId"].includes(key)) return;
    output[key.slice(0, 120)] = boundedClone(item, depth + 1);
  });
  return output;
}

function sanitizeLearningState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Dữ liệu học tập không hợp lệ.");
    error.statusCode = 400;
    error.code = "LEARNING_STATE_INVALID";
    throw error;
  }
  const state = {};
  Object.entries(input).forEach(([key, value]) => { if (ALLOWED_TOP_LEVEL.has(key)) state[key] = boundedClone(value); });
  const bytes = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (bytes > MAX_STATE_BYTES) {
    const error = new Error("Dữ liệu học tập vượt quá giới hạn đồng bộ.");
    error.statusCode = 413;
    error.code = "LEARNING_STATE_TOO_LARGE";
    throw error;
  }
  state.version = Math.max(1, Math.min(10, Number(state.version) || 1));
  state.learnerProfileId = profileIdOf(state.learnerProfileId || "default");
  return state;
}

function publicDocument(row) {
  return row ? {
    learnerProfileId: row.learnerProfileId,
    revision: Number(row.revision) || 0,
    updatedAt: row.updatedAt,
    state: row.state
  } : null;
}

async function ensureIndexes(db) {
  const collection = db.collection("englishLearningStates");
  await collection.createIndex({ ownerId: 1, learnerProfileId: 1 }, { unique: true });
  await db.collection("englishLearningAudit").createIndex({ ownerId: 1, createdAt: -1 });
  return collection;
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để đồng bộ HH English.", code: "AUTH_REQUIRED" });
    const ownerId = String(user._id);
    const profileId = profileIdOf(req.method === "GET" || req.method === "DELETE" ? req.query?.learnerProfileId : body.learnerProfileId || body.state?.learnerProfileId);
    await enforceRateLimit(db, `english-learning:${ownerId}:${req.method}`, req.method === "GET" ? 120 : 45, 60 * 1000);
    const collection = await ensureIndexes(db);

    if (req.method === "GET") {
      const row = await collection.findOne({ ownerId, learnerProfileId: profileId }, { projection: { _id: 0, ownerId: 0, clientMutationId: 0 } });
      if (!row) return res.status(404).json({ error: "Chưa có dữ liệu đồng bộ cho hồ sơ này.", code: "LEARNING_STATE_NOT_FOUND" });
      return res.status(200).json({ ok: true, ...publicDocument(row) });
    }

    if (req.method === "PUT" && clean(req.query?.action, 30) === "sync") {
      const state = sanitizeLearningState({ ...(body.state || {}), learnerProfileId: profileId });
      const clientRevision = Math.max(0, Number(body.revision) || 0);
      const clientMutationId = clean(body.clientMutationId, 160);
      if (!clientMutationId) return res.status(400).json({ error: "Thiếu mã chống gửi trùng.", code: "IDEMPOTENCY_KEY_REQUIRED" });
      const current = await collection.findOne({ ownerId, learnerProfileId: profileId });
      if (current?.clientMutationId === clientMutationId) return res.status(200).json({ ok: true, duplicate: true, revision: current.revision, updatedAt: current.updatedAt });
      if (current && clientRevision !== Number(current.revision || 0)) {
        return res.status(409).json({ error: "Dữ liệu máy chủ đã thay đổi. HH giữ bản cục bộ và chờ bạn tải lại trước khi ghi đè.", code: "LEARNING_REVISION_CONFLICT", revision: Number(current.revision) || 0, updatedAt: current.updatedAt });
      }
      const now = new Date(); const revision = clientRevision + 1;
      const filter = current ? { ownerId, learnerProfileId: profileId, revision: clientRevision } : { ownerId, learnerProfileId: profileId };
      const update = {
        $set: { state, revision, clientMutationId, updatedAt: now },
        $setOnInsert: { ownerId, learnerProfileId: profileId, createdAt: now }
      };
      const result = await collection.updateOne(filter, update, { upsert: !current });
      if (current && !result.matchedCount) return res.status(409).json({ error: "Có thay đổi đồng thời. Hãy đồng bộ lại.", code: "LEARNING_REVISION_CONFLICT" });
      await db.collection("englishLearningAudit").insertOne({ ownerId, learnerProfileId: profileId, action: "state.synced", revision, clientMutationId, createdAt: now });
      return res.status(200).json({ ok: true, revision, updatedAt: now.toISOString() });
    }

    if (req.method === "DELETE") {
      const confirmation = clean(req.headers["x-hh-confirm-delete"], 40);
      if (confirmation !== profileId) return res.status(400).json({ error: "Thiếu xác nhận xóa đúng hồ sơ.", code: "DELETE_CONFIRMATION_REQUIRED" });
      const result = await collection.deleteOne({ ownerId, learnerProfileId: profileId });
      await db.collection("englishLearningAudit").insertOne({ ownerId, learnerProfileId: profileId, action: "state.deleted", createdAt: new Date() });
      return res.status(200).json({ ok: true, deleted: result.deletedCount === 1 });
    }

    res.setHeader("Allow", "GET, PUT, DELETE, OPTIONS");
    return res.status(405).json({ error: "Phương thức không được hỗ trợ." });
  }, { maxBodyBytes: 1_700_000, maxArrayLength: 2500, maxNodes: 80_000 });
};

module.exports.__test = Object.freeze({ profileIdOf, boundedClone, sanitizeLearningState, publicDocument, ALLOWED_TOP_LEVEL, MAX_STATE_BYTES });
