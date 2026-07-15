const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { accessFor, requirePermission, rolesFor, writeAdminAudit } = require("./community-admin");

const USER_PROJECTION = Object.freeze({
  name: 1,
  email: 1,
  avatar: 1,
  provider: 1,
  lastProvider: 1,
  status: 1,
  systemRoles: 1,
  verifiedAt: 1,
  emailVerifiedAt: 1,
  consent: 1,
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: 1,
  suspendedUntil: 1
});

const ALLOWED_ROLES = new Set(["super_admin", "admin", "moderator", "support", "analyst"]);
const ALLOWED_USER_STATUS = new Set(["active", "locked", "suspended", "banned"]);
const CONTENT_COLLECTIONS = Object.freeze({ post: "communityPosts", story: "communityStories" });

function idOf(value) {
  try { return new ObjectId(String(value || "")); } catch { return null; }
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requiredReason(body) {
  const reason = clean(body.reason, 1000);
  if (reason.length < 5) {
    const error = new Error("Hãy nhập lý do rõ ràng, tối thiểu 5 ký tự.");
    error.statusCode = 400;
    throw error;
  }
  return reason;
}

function presentUser(user) {
  return {
    id: String(user._id),
    name: clean(user.name, 120),
    email: clean(user.email, 180),
    avatar: clean(user.avatar, 1200),
    provider: clean(user.lastProvider || user.provider || "local", 40),
    status: clean(user.status || "active", 30),
    roles: rolesFor(user),
    verified: Boolean(user.verifiedAt || user.emailVerifiedAt),
    consent: Boolean(user.consent),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    suspendedUntil: user.suspendedUntil || null
  };
}

function pageParams(query) {
  const limit = Math.max(10, Math.min(100, Number(query.limit || 30)));
  const page = Math.max(1, Math.min(10000, Number(query.page || 1)));
  return { limit, page, skip: (page - 1) * limit };
}

async function assertTargetAllowed(admin, target) {
  const actorRoles = rolesFor(admin);
  const targetRoles = rolesFor(target);
  if (!actorRoles.includes("owner") && targetRoles.some((role) => ["owner", "super_admin"].includes(role))) {
    const error = new Error("Chỉ chủ hệ thống có thể quản trị tài khoản đặc quyền này.");
    error.statusCode = 403;
    throw error;
  }
  if (String(admin._id) === String(target._id)) {
    const error = new Error("Không thể dùng thao tác này trên chính phiên quản trị đang hoạt động.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const admin = await currentUser(req);
    if (!admin) return res.status(401).json({ error: "Bạn cần đăng nhập để truy cập Community Admin." });
    const view = clean(req.query.view || "me", 40);
    const access = accessFor(admin);

    await Promise.all([
      db.collection("communityAdminAuditLogs").createIndex({ createdAt: -1 }),
      db.collection("communityAdminAuditLogs").createIndex({ adminId: 1, createdAt: -1 }),
      db.collection("communityFeatureFlags").createIndex({ key: 1 }, { unique: true }),
      db.collection("communitySystemConfig").createIndex({ key: 1 }, { unique: true }),
      db.collection("communityEmailTemplates").createIndex({ key: 1 }, { unique: true }),
      db.collection("communityModerationKeywords").createIndex({ value: 1 }, { unique: true })
    ]);

    if (req.method === "GET" && view === "me") {
      return res.status(200).json({ ok: true, access, user: presentUser(admin), privacy: { privateMessagesVisibleToAdmin: false, passwordsVisibleToAdmin: false } });
    }

    if (req.method === "GET" && view === "dashboard") {
      requirePermission(admin, "dashboard.view");
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activeSince = new Date(now.getTime() - 15 * 60 * 1000);
      const users = db.collection("users");
      const started = Date.now();
      await db.command({ ping: 1 });
      const databaseLatencyMs = Date.now() - started;
      const [totalUsers, activeUsers, newUsers, newPosts, newMessages, mediaUploads, pendingReports, lockedAccounts, groups, pages, events, marketplace, pendingJobs, failedJobs, recentErrors] = await Promise.all([
        users.countDocuments({ status: { $ne: "deleted" } }),
        users.countDocuments({ lastLoginAt: { $gte: activeSince }, status: { $nin: ["deleted", "locked", "suspended", "banned"] } }),
        users.countDocuments({ createdAt: { $gte: weekAgo } }),
        db.collection("communityPosts").countDocuments({ createdAt: { $gte: dayAgo }, deletedAt: { $exists: false } }),
        db.collection("communityMessages").countDocuments({ createdAt: { $gte: dayAgo } }),
        db.collection("communityMedia").countDocuments({ createdAt: { $gte: dayAgo } }),
        db.collection("communityReports").countDocuments({ status: "pending" }),
        users.countDocuments({ status: { $in: ["locked", "suspended", "banned"] } }),
        db.collection("communityGroups").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("communityPages").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("communityEvents").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("communityMarketplaceListings").countDocuments({ status: { $nin: ["deleted", "rejected"] } }),
        db.collection("communityQueueJobs").countDocuments({ status: { $in: ["queued", "running"] } }),
        db.collection("communityQueueJobs").countDocuments({ status: "failed" }),
        db.collection("events").find({ type: { $regex: /error|failure|exception/i } }, { projection: { type: 1, path: 1, detail: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(10).toArray()
      ]);
      return res.status(200).json({
        ok: true,
        metrics: { totalUsers, activeUsers, newUsers, newPosts, newMessages, mediaUploads, pendingReports, lockedAccounts, groups, pages, events, marketplace, pendingJobs, failedJobs },
        system: { api: "operational", database: "operational", databaseLatencyMs, queue: failedJobs ? "degraded" : "operational", generatedAt: now },
        recentErrors
      });
    }

    if (req.method === "GET" && view === "users") {
      requirePermission(admin, "users.view");
      const { limit, page, skip } = pageParams(req.query);
      const q = clean(req.query.q, 120);
      const status = clean(req.query.status, 30);
      const role = clean(req.query.role, 40);
      const filter = {
        ...(q ? { $or: [{ name: { $regex: escapeRegex(q), $options: "i" } }, { email: { $regex: escapeRegex(q), $options: "i" } }] } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(role && role !== "all" ? { systemRoles: role } : {})
      };
      const [rows, total] = await Promise.all([
        db.collection("users").find(filter, { projection: USER_PROJECTION }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        db.collection("users").countDocuments(filter)
      ]);
      return res.status(200).json({ ok: true, users: rows.map(presentUser), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    }

    if (req.method === "GET" && view === "user") {
      requirePermission(admin, "users.view");
      const userId = idOf(req.query.id);
      if (!userId) return res.status(400).json({ error: "Tài khoản không hợp lệ." });
      const [target, moderation] = await Promise.all([
        db.collection("users").findOne({ _id: userId }, { projection: USER_PROJECTION }),
        db.collection("communityAdminAuditLogs").find({ targetType: "user", targetId: String(userId) }, { projection: { action: 1, reason: 1, admin: 1, roles: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(50).toArray()
      ]);
      if (!target) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
      return res.status(200).json({ ok: true, user: presentUser(target), moderation, privacy: { password: "never_exposed", privateMessages: "not_available" } });
    }

    if (req.method === "GET" && ["reports", "appeals"].includes(view)) {
      requirePermission(admin, view === "reports" ? "reports.manage" : "appeals.manage");
      const { limit, page, skip } = pageParams(req.query);
      const collection = db.collection(view === "reports" ? "communityReports" : "communityAppeals");
      const status = clean(req.query.status || "pending", 30);
      const filter = status === "all" ? {} : { status };
      const [items, total] = await Promise.all([
        collection.find(filter, { projection: { privateMessage: 0, messageText: 0, evidenceBlob: 0 } }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        collection.countDocuments(filter)
      ]);
      return res.status(200).json({ ok: true, items: items.map((item) => ({ ...item, id: String(item._id), _id: undefined })), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    }

    if (req.method === "GET" && view === "content") {
      requirePermission(admin, "content.manage");
      const { limit, page, skip } = pageParams(req.query);
      const type = req.query.type === "story" ? "story" : "post";
      const collection = db.collection(CONTENT_COLLECTIONS[type]);
      const filter = req.query.status === "removed" ? { deletedAt: { $exists: true } } : { deletedAt: { $exists: false } };
      const rows = await collection.find(filter, { projection: { content: 1, author: 1, userId: 1, privacy: 1, mediaType: 1, createdAt: 1, updatedAt: 1, deletedAt: 1, moderation: 1 } }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
      return res.status(200).json({ ok: true, type, items: rows.map((item) => ({ ...item, id: String(item._id), _id: undefined })) });
    }

    if (req.method === "GET" && view === "audit") {
      requirePermission(admin, "audit.view");
      const { limit, page, skip } = pageParams(req.query);
      const q = clean(req.query.q, 120);
      const filter = q ? { $or: [{ action: { $regex: escapeRegex(q), $options: "i" } }, { targetId: { $regex: escapeRegex(q), $options: "i" } }, { "admin.email": { $regex: escapeRegex(q), $options: "i" } }] } : {};
      const [items, total] = await Promise.all([
        db.collection("communityAdminAuditLogs").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        db.collection("communityAdminAuditLogs").countDocuments(filter)
      ]);
      return res.status(200).json({ ok: true, items: items.map((item) => ({ ...item, id: String(item._id), _id: undefined })), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    }

    if (req.method === "GET" && view === "settings") {
      requirePermission(admin, "config.manage");
      const [config, flags, templates, keywords, categories] = await Promise.all([
        db.collection("communitySystemConfig").find({}).sort({ key: 1 }).toArray(),
        db.collection("communityFeatureFlags").find({}).sort({ key: 1 }).toArray(),
        db.collection("communityEmailTemplates").find({}, { projection: { key: 1, subject: 1, updatedAt: 1 } }).sort({ key: 1 }).toArray(),
        db.collection("communityModerationKeywords").find({}).sort({ value: 1 }).toArray(),
        db.collection("communityCategories").find({}).sort({ order: 1, name: 1 }).toArray()
      ]);
      return res.status(200).json({ ok: true, config, flags, templates, keywords, categories });
    }

    if (req.method === "GET" && view === "export") {
      requirePermission(admin, "reports.export");
      const [userCount, postCount, reportSummary, auditCount] = await Promise.all([
        db.collection("users").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("communityPosts").countDocuments({ deletedAt: { $exists: false } }),
        db.collection("communityReports").aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
        db.collection("communityAdminAuditLogs").countDocuments()
      ]);
      await writeAdminAudit(db, req, admin, { action: "report:export", targetType: "system", targetId: "community", reason: clean(req.query.reason || "Xuất báo cáo Community", 1000), before: null, after: { userCount, postCount, auditCount } });
      return res.status(200).json({ ok: true, exportedAt: new Date(), report: { userCount, postCount, reportSummary, auditCount }, privacy: { passwordsIncluded: false, privateMessagesIncluded: false } });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    await enforceRateLimit(db, `community:admin:${admin._id}`, 120, 10 * 60 * 1000);
    const action = clean(body.action, 60);

    if (["user:status", "user:verify", "user:revoke-sessions", "user:roles"].includes(action)) {
      requirePermission(admin, action === "user:roles" ? "users.roles" : action === "user:revoke-sessions" ? "sessions.revoke" : "users.moderate");
      const targetId = idOf(body.userId);
      const target = targetId ? await db.collection("users").findOne({ _id: targetId }, { projection: { ...USER_PROJECTION, tokenVersion: 1 } }) : null;
      if (!target) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
      await assertTargetAllowed(admin, target);
      const reason = requiredReason(body);
      const before = presentUser(target);
      const now = new Date();
      let update = {};
      if (action === "user:status") {
        const status = clean(body.status, 30);
        if (!ALLOWED_USER_STATUS.has(status)) return res.status(400).json({ error: "Trạng thái tài khoản không hợp lệ." });
        const suspendedUntil = status === "suspended" && body.suspendedUntil ? new Date(body.suspendedUntil) : null;
        update = { $set: { status, updatedAt: now, moderationReason: reason, ...(suspendedUntil && !Number.isNaN(suspendedUntil.getTime()) ? { suspendedUntil } : {}) }, ...(status !== "suspended" ? { $unset: { suspendedUntil: "" } } : {}) };
      }
      if (action === "user:verify") update = body.verified === false ? { $unset: { verifiedAt: "" }, $set: { updatedAt: now } } : { $set: { verifiedAt: now, updatedAt: now } };
      if (action === "user:revoke-sessions") update = { $inc: { tokenVersion: 1 }, $set: { sessionsRevokedAt: now, updatedAt: now } };
      if (action === "user:roles") {
        const nextRoles = [...new Set((Array.isArray(body.roles) ? body.roles : []).map((role) => clean(role, 40)).filter((role) => ALLOWED_ROLES.has(role)))];
        update = { $set: { systemRoles: nextRoles, updatedAt: now } };
      }
      await db.collection("users").updateOne({ _id: targetId }, update);
      if (action === "user:revoke-sessions") await db.collection("sessions").updateMany({ userId: targetId, endedAt: null }, { $set: { endedAt: now, revokedAt: now, revokedBy: admin._id } });
      const afterDoc = await db.collection("users").findOne({ _id: targetId }, { projection: USER_PROJECTION });
      const after = presentUser(afterDoc);
      await writeAdminAudit(db, req, admin, { action, targetType: "user", targetId: String(targetId), reason, before, after });
      return res.status(200).json({ ok: true, user: after });
    }

    if (["report:resolve", "appeal:resolve"].includes(action)) {
      requirePermission(admin, action === "report:resolve" ? "reports.manage" : "appeals.manage");
      const recordId = idOf(body.recordId);
      const collection = db.collection(action === "report:resolve" ? "communityReports" : "communityAppeals");
      const before = recordId ? await collection.findOne({ _id: recordId }) : null;
      if (!before) return res.status(404).json({ error: "Không tìm thấy hồ sơ kiểm duyệt." });
      const reason = requiredReason(body);
      const status = ["resolved", "rejected", "escalated"].includes(body.status) ? body.status : "resolved";
      const now = new Date();
      await collection.updateOne({ _id: recordId }, { $set: { status, resolution: clean(body.resolution, 1000), resolvedAt: now, resolvedBy: admin._id, updatedAt: now }, $push: { history: { status, reason, at: now, adminId: admin._id } } });
      const after = await collection.findOne({ _id: recordId });
      await writeAdminAudit(db, req, admin, { action, targetType: action.startsWith("report") ? "report" : "appeal", targetId: String(recordId), reason, before, after });
      return res.status(200).json({ ok: true, status });
    }

    if (action === "content:moderate") {
      requirePermission(admin, "content.manage");
      const type = body.targetType === "story" ? "story" : "post";
      const targetId = idOf(body.targetId);
      const collection = db.collection(CONTENT_COLLECTIONS[type]);
      const before = targetId ? await collection.findOne({ _id: targetId }) : null;
      if (!before) return res.status(404).json({ error: "Không tìm thấy nội dung." });
      const reason = requiredReason(body);
      const mode = ["remove", "restore", "limit"].includes(body.mode) ? body.mode : "remove";
      const now = new Date();
      const update = mode === "restore"
        ? { $unset: { deletedAt: "", moderation: "", distributionLimited: "" }, $set: { updatedAt: now } }
        : { $set: { ...(mode === "remove" ? { deletedAt: now } : { distributionLimited: true }), moderation: { mode, reason, adminId: admin._id, at: now }, updatedAt: now } };
      await collection.updateOne({ _id: targetId }, update);
      const after = await collection.findOne({ _id: targetId });
      await writeAdminAudit(db, req, admin, { action, targetType: type, targetId: String(targetId), reason, before, after });
      return res.status(200).json({ ok: true, mode });
    }

    const settingActions = {
      "keyword:update": { permission: "config.manage", collection: "communityModerationKeywords", key: "value" },
      "category:update": { permission: "config.manage", collection: "communityCategories", key: "key" },
      "config:update": { permission: "config.manage", collection: "communitySystemConfig", key: "key" },
      "feature-flag:update": { permission: "flags.manage", collection: "communityFeatureFlags", key: "key" },
      "email-template:update": { permission: "templates.manage", collection: "communityEmailTemplates", key: "key" }
    };
    const setting = settingActions[action];
    if (setting) {
      requirePermission(admin, setting.permission);
      const key = clean(body[setting.key] || body.key, 100).toLowerCase();
      if (!key) return res.status(400).json({ error: "Khóa cấu hình không hợp lệ." });
      const reason = requiredReason(body);
      const collection = db.collection(setting.collection);
      const before = await collection.findOne({ [setting.key]: key });
      const now = new Date();
      const payload = action === "email-template:update"
        ? { key, subject: clean(body.subject, 240), html: clean(body.html, 20000), enabled: body.enabled !== false, updatedAt: now, updatedBy: admin._id }
        : action === "feature-flag:update"
          ? { key, enabled: Boolean(body.enabled), rollout: Math.max(0, Math.min(100, Number(body.rollout || 0))), description: clean(body.description, 500), updatedAt: now, updatedBy: admin._id }
          : action === "keyword:update"
            ? { value: key, enabled: body.enabled !== false, severity: clean(body.severity || "review", 30), updatedAt: now, updatedBy: admin._id }
            : { key, name: clean(body.name, 160), value: body.value, enabled: body.enabled !== false, order: Number(body.order || 0), updatedAt: now, updatedBy: admin._id };
      await collection.updateOne({ [setting.key]: key }, { $set: payload, $setOnInsert: { createdAt: now } }, { upsert: true });
      const after = await collection.findOne({ [setting.key]: key });
      await writeAdminAudit(db, req, admin, { action, targetType: setting.collection, targetId: key, reason, before, after });
      return res.status(200).json({ ok: true, item: { ...after, id: String(after._id), _id: undefined } });
    }

    return res.status(400).json({ error: "Thao tác quản trị chưa được hỗ trợ." });
  });
};
