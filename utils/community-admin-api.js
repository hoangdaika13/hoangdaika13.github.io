const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { accessFor, hasPermission, requirePermission, rolesFor, writeAdminAudit } = require("./community-admin");

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
  suspendedUntil: 1,
  restrictedFeatures: 1
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
    suspendedUntil: user.suspendedUntil || null,
    restrictedFeatures: Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures.map((item) => clean(item, 100)).filter(Boolean).slice(0, 100) : []
  };
}

function presentActivity(item, profile) {
  return {
    id: String(item._id || item.eventId || ""),
    userId: item.userId ? String(item.userId) : "",
    kind: item.kind === "registered" ? "registered" : "guest",
    name: clean(profile?.name || (item.kind === "registered" ? "Tài khoản đã đăng nhập" : `Khách ${clean(item.sessionId, 12).slice(-6) || "ẩn danh"}`), 120),
    email: clean(profile?.email, 180),
    avatar: clean(profile?.avatar, 1200),
    sessionId: clean(item.sessionId, 100),
    type: clean(item.type, 40),
    route: clean(item.route || item.page || "/", 200),
    module: clean(item.module || "home", 100),
    action: clean(item.action || item.lastAction, 100),
    label: clean(item.label || item.lastAction, 100),
    meta: item.meta && typeof item.meta === "object" ? {
      form: clean(item.meta.form, 80), kind: clean(item.meta.kind, 40), fieldType: clean(item.meta.fieldType, 40),
      fieldCount: Math.max(0, Number(item.meta.fieldCount || 0)), lengthBucket: clean(item.meta.lengthBucket, 20),
      interactionBucket: clean(item.meta.interactionBucket, 20), durationBucket: clean(item.meta.durationBucket, 20), valid: item.meta.valid !== false
    } : null,
    activityState: clean(item.activityState || "active", 20),
    activeSeconds: Math.max(0, Number(item.activeSeconds || 0)),
    device: clean(item.device || "unknown", 40),
    browser: clean(item.browser || "browser", 40),
    viewport: clean(item.viewport || "unknown", 40),
    analyticsConsent: Boolean(item.analyticsConsent),
    firstSeenAt: item.firstSeenAt || null,
    lastSeenAt: item.lastSeenAt || item.createdAt || null,
    createdAt: item.createdAt || null
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
      db.collection("communityModerationKeywords").createIndex({ value: 1 }, { unique: true }),
      db.collection("telemetryEvents").createIndex({ createdAt: -1 }),
      db.collection("telemetryEvents").createIndex({ type: 1, createdAt: -1 }),
      db.collection("telemetryEvents").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("telemetryEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("presence").createIndex({ userId: 1, lastSeenAt: -1 })
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
      const presenceSince = new Date(now.getTime() - 2 * 60 * 1000);
      const users = db.collection("users");
      const started = Date.now();
      await db.command({ ping: 1 });
      const databaseLatencyMs = Date.now() - started;
      const [totalUsers, activeUsers, newUsers, newPosts, newMessages, mediaUploads, pendingReports, lockedAccounts, groups, pages, events, marketplace, pendingJobs, failedJobs, recentErrors, activePresence] = await Promise.all([
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
        db.collection("events").find({ type: { $regex: /error|failure|exception/i } }, { projection: { type: 1, path: 1, detail: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(10).toArray(),
        db.collection("presence").find({ lastSeenAt: { $gte: presenceSince } }, { projection: { kind: 1, userId: 1, page: 1, lastSeenAt: 1 } }).sort({ lastSeenAt: -1 }).limit(50).toArray()
      ]);
      const presenceUserIds = activePresence.filter((item) => item.userId).map((item) => item.userId);
      const presenceUsers = presenceUserIds.length
        ? await users.find({ _id: { $in: presenceUserIds } }, { projection: { name: 1, email: 1, avatar: 1 } }).toArray()
        : [];
      const presenceUserById = new Map(presenceUsers.map((item) => [String(item._id), item]));
      const activeVisitors = activePresence.map((item) => {
        const profile = item.userId ? presenceUserById.get(String(item.userId)) : null;
        return {
          kind: item.kind === "registered" ? "registered" : "guest",
          name: clean(profile?.name || (item.kind === "registered" ? "Tài khoản đã đăng nhập" : "Khách ẩn danh"), 120),
          email: clean(profile?.email, 180),
          avatar: clean(profile?.avatar, 1200),
          page: clean(item.page || "/", 240),
          lastSeenAt: item.lastSeenAt
        };
      });
      const onlineRegistered = activeVisitors.filter((item) => item.kind === "registered").length;
      return res.status(200).json({
        ok: true,
        metrics: { totalUsers, activeUsers, onlineVisitors: activeVisitors.length, onlineRegistered, newUsers, newPosts, newMessages, mediaUploads, pendingReports, lockedAccounts, groups, pages, events, marketplace, pendingJobs, failedJobs },
        system: { api: "operational", database: "operational", databaseLatencyMs, queue: failedJobs ? "degraded" : "operational", generatedAt: now },
        recentErrors,
        activeVisitors
      });
    }

    if (req.method === "GET" && view === "activity") {
      requirePermission(admin, "activity.view");
      const now = new Date();
      const since5 = new Date(now.getTime() - 5 * 60 * 1000);
      const since30 = new Date(now.getTime() - 30 * 60 * 1000);
      const telemetry = db.collection("telemetryEvents");
      const presence = db.collection("presence");
      const [presenceRows, timelineRows, active5Ids, active30Ids, eventCount30, formSubmits30, validationErrors30, topRoutes, topModules, topActions, riskRows] = await Promise.all([
        presence.find({ lastSeenAt: { $gte: since30 } }, { projection: { identity: 1, kind: 1, userId: 1, sessionId: 1, page: 1, module: 1, lastAction: 1, activityState: 1, activeSeconds: 1, device: 1, browser: 1, viewport: 1, analyticsConsent: 1, firstSeenAt: 1, lastSeenAt: 1 } }).sort({ lastSeenAt: -1 }).limit(200).toArray(),
        telemetry.find({ createdAt: { $gte: since30 } }, { projection: { identity: 1, kind: 1, userId: 1, sessionId: 1, type: 1, route: 1, module: 1, action: 1, label: 1, meta: 1, device: 1, browser: 1, viewport: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(200).toArray(),
        presence.distinct("identity", { lastSeenAt: { $gte: since5 } }),
        presence.distinct("identity", { lastSeenAt: { $gte: since30 } }),
        telemetry.countDocuments({ createdAt: { $gte: since30 } }),
        telemetry.countDocuments({ createdAt: { $gte: since30 }, type: "form_submit" }),
        telemetry.countDocuments({ createdAt: { $gte: since30 }, type: "form_validation" }),
        telemetry.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: "$route", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]).toArray(),
        telemetry.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: "$module", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]).toArray(),
        telemetry.aggregate([{ $match: { createdAt: { $gte: since30 }, type: { $ne: "heartbeat" } } }, { $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]).toArray(),
        telemetry.aggregate([{ $match: { createdAt: { $gte: since5 } } }, { $group: { _id: "$identity", userId: { $first: "$userId" }, sessionId: { $first: "$sessionId" }, events: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ["$type", "error"] }, 1, 0] } } } }, { $match: { $or: [{ events: { $gte: 80 } }, { errors: { $gte: 3 } }] } }, { $sort: { errors: -1, events: -1 } }, { $limit: 20 }]).toArray()
      ]);
      const userIds = [...new Map([...presenceRows, ...timelineRows].filter((item) => item.userId).map((item) => [String(item.userId), item.userId])).values()];
      const profiles = userIds.length ? await db.collection("users").find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1, avatar: 1 } }).toArray() : [];
      const profileById = new Map(profiles.map((item) => [String(item._id), item]));
      const activeSessions = presenceRows.map((item) => presentActivity(item, item.userId ? profileById.get(String(item.userId)) : null));
      const timeline = timelineRows.map((item) => presentActivity(item, item.userId ? profileById.get(String(item.userId)) : null));
      const riskSignals = riskRows.map((item) => ({
        identity: clean(item._id, 240), userId: item.userId ? String(item.userId) : "", sessionId: clean(item.sessionId, 100), events: Number(item.events || 0), errors: Number(item.errors || 0),
        level: Number(item.errors || 0) >= 5 || Number(item.events || 0) >= 160 ? "high" : "review",
        reason: Number(item.errors || 0) >= 3 ? "Nhiều lỗi trong 5 phút" : "Tần suất thao tác cao trong 5 phút"
      }));
      return res.status(200).json({
        ok: true,
        summary: { active5: active5Ids.length, active30: active30Ids.length, registered5: activeSessions.filter((item) => item.kind === "registered" && new Date(item.lastSeenAt) >= since5).length, consented30: activeSessions.filter((item) => item.analyticsConsent).length, eventCount30, formSubmits30, validationErrors30, riskCount: riskSignals.length },
        activeSessions, timeline, riskSignals,
        topRoutes: topRoutes.map((item) => ({ name: clean(item._id || "/", 200), count: Number(item.count || 0) })),
        topModules: topModules.map((item) => ({ name: clean(item._id || "home", 100), count: Number(item.count || 0) })),
        topActions: topActions.map((item) => ({ name: clean(item._id || "action", 100), count: Number(item.count || 0) })),
        generatedAt: now,
        privacy: { interactionMetadataVisible: true, formValuesVisible: false, promptBodiesVisible: false, passwordsVisible: false, tokensVisible: false, privateMessagesVisible: false, rawKeystrokesVisible: false, retentionDays: 30, consentRequiredForDetailedEvents: true }
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
      const [target, moderation, activity, sessions] = await Promise.all([
        db.collection("users").findOne({ _id: userId }, { projection: USER_PROJECTION }),
        db.collection("communityAdminAuditLogs").find({ targetType: "user", targetId: String(userId) }, { projection: { action: 1, reason: 1, admin: 1, roles: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(50).toArray(),
        hasPermission(admin, "activity.view") ? db.collection("telemetryEvents").find({ userId }, { projection: { sessionId: 1, type: 1, route: 1, module: 1, action: 1, label: 1, meta: 1, device: 1, browser: 1, viewport: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray() : [],
        hasPermission(admin, "activity.view") ? db.collection("presence").find({ userId }, { projection: { sessionId: 1, page: 1, module: 1, lastAction: 1, activityState: 1, activeSeconds: 1, device: 1, browser: 1, viewport: 1, analyticsConsent: 1, firstSeenAt: 1, lastSeenAt: 1 } }).sort({ lastSeenAt: -1 }).limit(20).toArray() : []
      ]);
      if (!target) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
      return res.status(200).json({ ok: true, user: presentUser(target), moderation, activity: activity.map((item) => presentActivity({ ...item, userId, kind: "registered" }, target)), sessions: sessions.map((item) => presentActivity({ ...item, userId, kind: "registered" }, target)), privacy: { password: "never_exposed", privateMessages: "not_available", formValues: "not_collected", keystrokes: "not_collected" } });
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

    if (["user:status", "user:verify", "user:revoke-sessions", "user:roles", "user:feature-access"].includes(action)) {
      requirePermission(admin, action === "user:roles" ? "users.roles" : action === "user:feature-access" ? "users.features" : action === "user:revoke-sessions" ? "sessions.revoke" : "users.moderate");
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
      if (action === "user:feature-access") {
        const restrictedFeatures = [...new Set((Array.isArray(body.restrictedFeatures) ? body.restrictedFeatures : []).map((item) => clean(item, 100).toLowerCase()).filter((item) => /^[a-z0-9][a-z0-9_.:-]{0,99}$/.test(item)))].slice(0, 100);
        update = { $set: { restrictedFeatures, featureAccessUpdatedAt: now, updatedAt: now } };
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
