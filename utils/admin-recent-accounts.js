"use strict";

// Administrative read model: explicit projections only; never return auth tokens.
const { ObjectId } = require("mongodb");
const { createHash } = require("crypto");
const { hasPermissionForResource, rolesFor, requirePermission, writeAdminAudit } = require("./community-admin");
const { enforceRateLimit } = require("./platform");

const USER_FIELDS = { name: 1, email: 1, avatar: 1, systemRoles: 1, adminCustomPermissions: 1, status: 1, provider: 1, lastProvider: 1, lastLoginAt: 1, createdAt: 1, sessionsRevokedAt: 1, suspendedUntil: 1, restrictedFeatures: 1, verifiedAt: 1, emailVerifiedAt: 1 };
const SESSION_FIELDS = { sessionId: 1, userId: 1, type: 1, device: 1, createdAt: 1, lastSeenAt: 1, idleExpiresAt: 1, expiresAt: 1, revokedAt: 1, revokeReason: 1, remember: 1 };
const EVENT_FIELDS = { type: 1, success: 1, reason: 1, browser: 1, platform: 1, kind: 1, region: 1, ip: 1, suspicious: 1, newDevice: 1, createdAt: 1 };
const EXPORT_FIELDS = ["id", "name", "email", "roles", "status", "provider", "lastLoginAt", "lastActivityAt", "activeSessions", "failedLogins", "securitySignals", "workspace", "device", "browser", "platform", "region", "ip", "sessionState"];
const text = (v, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : "";
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const regex = (v) => ({ $regex: text(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
const iso = (v) => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toISOString() : null;
const integer = (v, fallback, min, max) => Number.isFinite(Number(v)) && v !== "" && v != null ? Math.max(min, Math.min(max, Math.floor(Number(v)))) : fallback;

function allowed(admin, permission, resource = {}) { return hasPermissionForResource(admin, permission, resource); }
function requireAccess(admin, permission, resource = {}) {
  requirePermission(admin, permission);
  if (!allowed(admin, permission, resource)) throw error("Bạn không có quyền quản trị trong phạm vi này.", 403);
}
function maskIp(v) {
  const value = text(v, 80);
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return value.split(".").slice(0, 2).join(".") + ".*.*";
  if (/^[a-f\d:]+$/i.test(value) && value.includes(":")) return value.split(":").slice(0, 2).join(":") + ":…";
  return "Chưa xác định";
}
function sessionState(s, user = {}, now = new Date()) {
  if (["locked", "banned", "suspended", "deleted"].includes(user.status)) return "blocked";
  if (s.revokedAt) return s.revokeReason === "logout" ? "logged-out" : s.revokeReason === "idle-timeout" ? "expired" : "revoked";
  if (user.sessionsRevokedAt && new Date(s.createdAt) <= new Date(user.sessionsRevokedAt)) return "revoked";
  const idle = s.idleExpiresAt || new Date(new Date(s.lastSeenAt || s.createdAt).getTime() + (s.remember ? 604800000 : 7200000));
  if (!iso(s.expiresAt) || !iso(idle) || new Date(s.expiresAt) <= now || new Date(idle) <= now) return "expired";
  return "active";
}
function publicSession(s, user, currentId, now) {
  const d = s.device && typeof s.device === "object" ? s.device : {};
  return { id: text(s.sessionId, 180), current: s.sessionId === currentId, state: sessionState(s, user, now), provider: text(s.type, 40), device: text(d.kind), browser: text(d.browser), platform: text(d.platform), region: text(d.region), ip: maskIp(d.ip), createdAt: iso(s.createdAt), lastSeenAt: iso(s.lastSeenAt), expiresAt: iso(s.expiresAt), idleExpiresAt: iso(s.idleExpiresAt), revokedAt: iso(s.revokedAt), reason: text(s.revokeReason) };
}
function normalizeQuery(input = {}, now = new Date()) {
  const range = ["today", "7", "30", "custom", "all"].includes(input.range) ? input.range : "30";
  const offset = integer(input.tz, 0, -840, 840);
  let from = null, to = now;
  if (range === "today") { const local = new Date(now.getTime() - offset * 60000); from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + offset * 60000); }
  if (["7", "30"].includes(range)) from = new Date(now.getTime() - Number(range) * 86400000);
  if (range === "custom") {
    from = new Date(input.from); to = new Date(input.to);
    if (!iso(from) || !iso(to) || to < from || to - from > 366 * 86400000) throw error("Khoảng thời gian không hợp lệ (tối đa 366 ngày).");
  }
  const choose = (key, values, fallback = "all") => values.includes(input[key]) ? input[key] : fallback;
  return { q: text(input.q), workspace: text(input.workspace, 100), device: text(input.device, 60), region: text(input.region, 80), provider: text(input.provider, 40), role: text(input.role, 40), status: choose("status", ["active", "locked", "banned", "suspended", "all"]), state: choose("state", ["active", "expired", "revoked", "logged-out", "blocked", "unknown", "all"]), signal: choose("signal", ["failed", "security", "multiple", "review", "all"]), activity: choose("activity", ["recent", "inactive", "all"]), sort: choose("sort", ["login", "activity", "sessions", "failures"], "login"), page: integer(input.page, 1, 1, 10000), limit: integer(input.limit, 20, 10, 50), range, from, to };
}

function accountPipeline(q, canActivity, now = new Date()) {
  const match = {};
  if (q.status !== "all") match.status = q.status === "active" ? { $in: ["active", null] } : q.status;
  if (q.role && q.role !== "all") match.systemRoles = q.role === "member" ? { $in: [[], null] } : q.role;
  if (q.from) match.lastLoginAt = { $gte: q.from, $lte: q.to };
  if (q.q) match.$or = [{ name: regex(q.q) }, { email: regex(q.q) }, ...(ObjectId.isValid(q.q) ? [{ _id: new ObjectId(q.q) }] : [])];
  const activeExpression = { $and: [
    { $eq: [{ $ifNull: ["$revokedAt", null] }, null] }, { $gt: ["$expiresAt", now] },
    { $gt: [{ $ifNull: ["$idleExpiresAt", { $add: [{ $ifNull: ["$lastSeenAt", "$createdAt"] }, { $cond: ["$remember", 604800000, 7200000] }] }] }, now] },
    { $gt: ["$createdAt", { $ifNull: ["$$revoked", new Date(0)] }] }
  ] };
  const pipeline = [{ $match: match }, { $project: USER_FIELDS },
    { $lookup: { from: "authSessions", let: { user: "$_id", revoked: "$sessionsRevokedAt" }, pipeline: [
      { $match: { $expr: { $eq: ["$userId", "$$user"] } } }, { $project: SESSION_FIELDS }, { $sort: { lastSeenAt: -1, _id: -1 } },
      { $group: { _id: null, active: { $sum: { $cond: [activeExpression, 1, 0] } }, latest: { $first: "$$ROOT" } } }
    ], as: "sessionFacts" } },
    { $lookup: { from: "loginEvents", let: { user: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$userId", "$$user"] }, createdAt: { $gte: q.from || new Date(now.getTime() - 30 * 86400000), $lte: q.to } } },
      { $group: { _id: null, failed: { $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] } }, security: { $sum: { $cond: [{ $or: [{ $eq: ["$suspicious", true] }, { $eq: ["$newDevice", true] }] }, 1, 0] } }, logins: { $sum: { $cond: [{ $and: [{ $ne: ["$success", false] }, { $in: ["$type", ["login", "google-login", "passkey-login", "qr-login", "recovery-code-login", "register"]] }] }, 1, 0] } } } }
    ], as: "eventFacts" } },
    { $lookup: { from: "adminAccountReviews", localField: "_id", foreignField: "userId", as: "reviewFacts" } }
  ];
  if (canActivity) pipeline.push({ $lookup: { from: "presence", let: { user: "$_id" }, pipeline: [
    { $match: { $expr: { $eq: ["$userId", "$$user"] }, analyticsConsent: true } }, { $sort: { lastSeenAt: -1, _id: -1 } }, { $limit: 1 }, { $project: { _id: 0, module: 1, lastSeenAt: 1 } }
  ], as: "presenceFacts" } });
  pipeline.push({ $set: { latestSession: { $arrayElemAt: ["$sessionFacts.latest", 0] }, activeSessions: { $cond: [{ $in: ["$status", ["locked", "banned", "suspended", "deleted"]] }, 0, { $ifNull: [{ $arrayElemAt: ["$sessionFacts.active", 0] }, 0] }] }, failedLogins: { $ifNull: [{ $arrayElemAt: ["$eventFacts.failed", 0] }, 0] }, securitySignals: { $ifNull: [{ $arrayElemAt: ["$eventFacts.security", 0] }, 0] }, loginCount: { $ifNull: [{ $arrayElemAt: ["$eventFacts.logins", 0] }, 0] }, review: { $ifNull: [{ $arrayElemAt: ["$reviewFacts.review", 0] }, false] }, workspace: canActivity ? { $ifNull: [{ $arrayElemAt: ["$presenceFacts.module", 0] }, ""] } : "" } });
  pipeline.push({ $set: { provider: { $ifNull: ["$lastProvider", { $ifNull: ["$provider", "local"] }] }, lastActivityAt: { $max: ["$latestSession.lastSeenAt", ...(canActivity ? [{ $arrayElemAt: ["$presenceFacts.lastSeenAt", 0] }] : [])] }, sessionState: { $switch: { branches: [
    { case: { $in: ["$status", ["locked", "banned", "suspended", "deleted"]] }, then: "blocked" },
    { case: { $gt: ["$activeSessions", 0] }, then: "active" },
    { case: { $eq: [{ $type: "$latestSession" }, "missing"] }, then: "unknown" },
    { case: { $eq: ["$latestSession.revokeReason", "logout"] }, then: "logged-out" },
    { case: { $eq: ["$latestSession.revokeReason", "idle-timeout"] }, then: "expired" },
    { case: { $or: [{ $ne: [{ $ifNull: ["$latestSession.revokedAt", null] }, null] }, { $lte: ["$latestSession.createdAt", { $ifNull: ["$sessionsRevokedAt", new Date(0)] }] }] }, then: "revoked" }
  ], default: "expired" } } } });
  const filter = {};
  if (q.provider && q.provider !== "all") filter.provider = q.provider;
  if (q.workspace) filter.workspace = regex(q.workspace);
  if (q.device) filter.$or = ["kind", "browser", "platform"].map(k => ({ [`latestSession.device.${k}`]: regex(q.device) }));
  if (q.region) filter["latestSession.device.region"] = regex(q.region);
  if (q.state !== "all") filter.sessionState = q.state;
  if (q.signal === "failed") filter.failedLogins = { $gt: 0 };
  if (q.signal === "security") filter.securitySignals = { $gt: 0 };
  if (q.signal === "multiple") filter.activeSessions = { $gt: 1 };
  if (q.signal === "review") filter.review = true;
  if (q.activity !== "all") filter.lastActivityAt = q.activity === "recent" ? { $gte: new Date(now - 300000) } : { $not: { $gte: new Date(now - 300000) } };
  pipeline.push({ $match: filter });
  return pipeline;
}
function presentAccount(row) {
  const d = row.latestSession?.device || {};
  return { id: String(row._id), name: text(row.name), email: text(row.email, 254), roles: rolesFor(row), status: text(row.status) || "active", provider: text(row.provider), lastLoginAt: iso(row.lastLoginAt), lastActivityAt: iso(row.lastActivityAt), createdAt: iso(row.createdAt), activeSessions: row.activeSessions || 0, failedLogins: row.failedLogins || 0, securitySignals: row.securitySignals || 0, loginCount: row.loginCount || 0, workspace: text(row.workspace, 100), review: row.review === true, sessionState: row.sessionState || "unknown", device: text(d.kind), browser: text(d.browser), platform: text(d.platform), region: text(d.region), ip: maskIp(d.ip), expiresAt: iso(row.latestSession?.expiresAt) };
}
async function listAccounts(db, admin, input, exportMode = false) {
  requireAccess(admin, "users.view");
  const q = normalizeQuery(input);
  const canActivity = allowed(admin, "activity.view");
  if (q.workspace && !canActivity) throw error("Cần quyền xem hoạt động để lọc workspace.", 403);
  const sort = { [{ login: "lastLoginAt", activity: "lastActivityAt", sessions: "activeSessions", failures: "failedLogins" }[q.sort]]: -1, _id: -1 };
  const pipeline = accountPipeline(q, canActivity);
  pipeline.push({ $facet: {
    users: [{ $sort: sort }, { $skip: exportMode ? 0 : (q.page - 1) * q.limit }, { $limit: exportMode ? 1001 : q.limit }],
    totals: [{ $group: { _id: null, accounts: { $sum: 1 }, sessions: { $sum: "$activeSessions" }, failures: { $sum: "$failedLogins" }, signals: { $sum: "$securitySignals" }, logins: { $sum: "$loginCount" } } }]
  } });
  const [result = {}] = await db.collection("users").aggregate(pipeline, { maxTimeMS: 8000 }).toArray();
  const total = result.totals?.[0]?.accounts || 0;
  if (exportMode && total > 1000) throw error("Có hơn 1.000 tài khoản. Hãy thu hẹp bộ lọc trước khi xuất.");
  return { ok: true, users: (result.users || []).map(presentAccount), summary: result.totals?.[0] || { accounts: 0, sessions: 0, failures: 0, signals: 0, logins: 0 }, pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) }, generatedAt: new Date().toISOString(), canActivity, note: "Phiên đang mở không đồng nghĩa đang online. Lịch sử phụ thuộc thời hạn lưu; workspace chỉ hiện khi đã đồng ý analytics. Guest không phải tài khoản đăng nhập. Với phạm vi tất cả, thống kê sự kiện lấy 30 ngày gần nhất." };
}
function csvCell(value) {
  let v = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
async function handleAccounts(req, res, { db, admin, body, hydrateAdminAccess, assertTargetAllowed }) {
  const view = text(req.query.view);
  if (req.method === "GET" && view === "accounts-recent") return res.status(200).json(await listAccounts(db, admin, req.query));
  requireAccess(admin, "users.view");
  if (req.method === "POST" && view === "accounts-export") {
    requireAccess(admin, "reports.export");
    await enforceRateLimit(db, `admin-accounts-export:${admin._id}`, 10, 600000);
    const fields = [...new Set((Array.isArray(body.fields) ? body.fields : EXPORT_FIELDS).filter(v => EXPORT_FIELDS.includes(v)))];
    if (!fields.length) throw error("Chọn ít nhất một trường hợp lệ.");
    const data = await listAccounts(db, admin, body.query || {}, true);
    const selected = Array.isArray(body.ids) ? body.ids.filter(v => typeof v === "string" && ObjectId.isValid(v)).slice(0, 50) : [];
    if (Array.isArray(body.ids) && body.ids.length && !selected.length) throw error("Danh sách tài khoản đã chọn không hợp lệ.");
    const rows = data.users.filter(row => !selected.length || selected.includes(row.id)).map(row => Object.fromEntries(fields.map(k => [k, row[k]])));
    await writeAdminAudit(db, req, admin, { action: "accounts:export", targetType: "report", targetId: "recent-accounts", reason: "Xuất dữ liệu quản trị đã lọc", after: { count: rows.length, fields, format: body.format === "csv" ? "csv" : "json" } });
    const content = body.format === "csv" ? "\uFEFF" + [fields.map(csvCell).join(","), ...rows.map(row => fields.map(k => csvCell(row[k])).join(","))].join("\r\n") : JSON.stringify({ generatedAt: data.generatedAt, accounts: rows }, null, 2);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, content, count: rows.length });
  }
  const userId = text(req.method === "GET" ? req.query.id : body.userId, 24);
  if (!ObjectId.isValid(userId)) throw error("HH ID không hợp lệ.");
  const target = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: USER_FIELDS });
  if (!target) throw error("Không tìm thấy tài khoản.", 404);
  if (req.method === "GET" && view === "accounts-detail") {
    const canActivity = allowed(admin, "activity.view");
    const canModerate = allowed(admin, "users.moderate");
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const [events, sessions, audit, activity, notes, review, current] = await Promise.all([
      db.collection("loginEvents").find({ userId: target._id }, { projection: EVENT_FIELDS }).sort({ createdAt: -1 }).limit(100).toArray(),
      db.collection("authSessions").find({ userId: target._id }, { projection: SESSION_FIELDS }).sort({ lastSeenAt: -1 }).limit(100).toArray(),
      allowed(admin, "audit.view") ? db.collection("communityAdminAuditLogs").find({ targetType: "user", targetId: userId }, { projection: { action: 1, reason: 1, admin: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(50).toArray() : [],
      // The ingestion endpoint persists events only after analytics consent;
      // older records intentionally have no analyticsConsent field.
      canActivity ? db.collection("telemetryEvents").find({ userId: target._id }, { projection: { module: 1, type: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray() : [],
      canModerate ? db.collection("adminAccountNotes").find({ userId: target._id }, { projection: { text: 1, authorId: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(50).toArray() : [],
      db.collection("adminAccountReviews").findOne({ userId: target._id }, { projection: { review: 1 } }),
      bearer ? db.collection("authSessions").findOne({ tokenHash: createHash("sha256").update(bearer).digest("hex"), userId: admin._id }, { projection: { sessionId: 1 } }) : null
    ]);
    await hydrateAdminAccess(db, target);
    let canManage = true;
    try { await assertTargetAllowed(admin, target); } catch { canManage = false; }
    return res.status(200).json({ ok: true, user: { ...presentAccount(target), roles: rolesFor(target), restrictedFeatures: target.restrictedFeatures || [] }, canManage, canActivity, review: review?.review === true,
      verified: Boolean(target.verifiedAt || target.emailVerifiedAt), events: events.map(e => ({ id: String(e._id), type: text(e.type), success: e.success !== false, reason: text(e.reason), browser: text(e.browser), platform: text(e.platform), region: text(e.region), ip: maskIp(e.ip), suspicious: e.suspicious === true, newDevice: e.newDevice === true, createdAt: iso(e.createdAt) })),
      sessions: sessions.map(s => publicSession(s, target, current?.sessionId, new Date())),
      audit: audit.map(e => ({ id: String(e._id), action: text(e.action), reason: text(e.reason, 1000), admin: text(e.admin?.name), createdAt: iso(e.createdAt) })),
      activity: activity.map(e => ({ id: String(e._id), module: text(e.module), type: text(e.type), createdAt: iso(e.createdAt) })),
      notes: notes.map(e => ({ id: String(e._id), text: text(e.text, 1000), authorId: String(e.authorId), createdAt: iso(e.createdAt) })) });
  }
  if (req.method === "POST" && view === "accounts-manage") {
    if (body.action === "sessions:revoke-others") {
      requireAccess(admin, "sessions.revoke", { accountId: userId });
      if (String(admin._id) !== userId) throw error("Thao tác này chỉ dành cho các phiên khác của chính Admin.", 403);
      const reason = text(body.reason, 1000);
      if (reason.length < 5) throw error("Nhập lý do ít nhất 5 ký tự.");
      await enforceRateLimit(db, `admin-session-others:${admin._id}`, 10, 600000);
      const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!bearer) throw error("Không xác định được phiên Admin hiện tại.", 401);
      const hash = createHash("sha256").update(bearer).digest("hex");
      const current = await db.collection("authSessions").findOne({ userId: admin._id, tokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } }, { projection: { _id: 1 } });
      if (!current) throw error("Phiên Admin đã hết hiệu lực.", 401);
      const result = await db.collection("authSessions").updateMany({ userId: admin._id, _id: { $ne: current._id }, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: admin._id, revokeReason: "admin-revoked-others" } });
      await writeAdminAudit(db, req, admin, { action: "session:revoke-others", targetType: "user", targetId: userId, reason, after: { revoked: result.modifiedCount, currentSessionPreserved: true } });
      return res.status(200).json({ ok: true, revoked: result.modifiedCount });
    }
    requireAccess(admin, "users.moderate", { accountId: userId });
    await hydrateAdminAccess(db, target);
    await assertTargetAllowed(admin, target);
    await enforceRateLimit(db, `admin-account-notes:${admin._id}`, 30, 600000);
    const reason = text(body.reason, 1000);
    if (reason.length < 5) throw error("Nhập lý do ít nhất 5 ký tự.");
    const action = text(body.action);
    let after;
    if (action === "note:add") {
      const value = text(body.text, 1000);
      if (!value) throw error("Ghi chú không được để trống.");
      const result = await db.collection("adminAccountNotes").insertOne({ userId: target._id, authorId: admin._id, text: value, createdAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000) });
      after = { noteId: String(result.insertedId), added: true };
    } else if (action === "note:delete") {
      if (!ObjectId.isValid(text(body.noteId, 24))) throw error("Ghi chú không hợp lệ.");
      const result = await db.collection("adminAccountNotes").deleteOne({ _id: new ObjectId(body.noteId), userId: target._id, authorId: admin._id });
      if (!result.deletedCount) throw error("Chỉ có thể xóa ghi chú do chính bạn tạo, nếu ghi chú vẫn tồn tại.", 403);
      after = { noteId: body.noteId, deleted: true };
    } else if (action === "review:set") {
      after = { review: body.review === true };
      await db.collection("adminAccountReviews").updateOne({ userId: target._id }, { $set: { ...after, updatedAt: new Date(), adminId: admin._id } }, { upsert: true });
    } else throw error("Thao tác không được hỗ trợ.");
    await writeAdminAudit(db, req, admin, { action: `accounts:${action}`, targetType: "user", targetId: userId, reason, after });
    return res.status(200).json({ ok: true, ...after });
  }
  throw error("Phương thức không được hỗ trợ.", 405);
}

module.exports = { handleAccounts, normalizeQuery, accountPipeline, presentAccount, sessionState, publicSession, maskIp, csvCell, listAccounts, requireAccess, EXPORT_FIELDS };
