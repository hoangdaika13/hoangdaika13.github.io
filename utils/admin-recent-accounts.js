"use strict";

// Administrative read model: explicit projections only; never return auth tokens.
const { ObjectId } = require("mongodb");
const { createHash } = require("crypto");
const { hasPermissionForResource, rolesFor, requirePermission, writeAdminAudit, accessFor } = require("./community-admin");
const { normalizeScope } = require("./admin-control-plane");
const { enforceRateLimit } = require("./platform");

const USER_FIELDS = { name: 1, email: 1, avatar: 1, systemRoles: 1, adminCustomPermissions: 1, status: 1, provider: 1, lastProvider: 1, lastLoginAt: 1, createdAt: 1, updatedAt: 1, sessionsRevokedAt: 1, suspendedUntil: 1, moderationReason: 1, restrictedFeatures: 1, verifiedAt: 1, emailVerifiedAt: 1, passwordChangedAt: 1, providerChangedAt: 1, consent: 1, consentPreferences: 1, consentUpdatedAt: 1 };
const SESSION_FIELDS = { sessionId: 1, userId: 1, type: 1, device: 1, createdAt: 1, lastSeenAt: 1, idleExpiresAt: 1, expiresAt: 1, revokedAt: 1, revokedBy: 1, revokeReason: 1, remember: 1 };
const EVENT_FIELDS = { type: 1, provider: 1, success: 1, reason: 1, browser: 1, platform: 1, kind: 1, region: 1, ip: 1, suspicious: 1, newDevice: 1, createdAt: 1 };
const EXPORT_FIELDS = ["id", "name", "email", "roles", "status", "provider", "lastLoginAt", "lastActivityAt", "activeSessions", "failedLogins", "securitySignals", "workspace", "device", "browser", "platform", "region", "ip", "sessionState"];
const text = (v, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : "";
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const regex = (v) => ({ $regex: text(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
const iso = (v) => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toISOString() : null;
const integer = (v, fallback, min, max) => Number.isFinite(Number(v)) && v !== "" && v != null ? Math.max(min, Math.min(max, Math.floor(Number(v)))) : fallback;

function allowed(admin, permission, resource = {}) { return hasPermissionForResource(admin, permission, resource); }
function requireAccess(admin, permission, resource = {}) {
  if (!Object.keys(resource).length) requirePermission(admin, permission);
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
  return { id: text(s.sessionId, 180), current: s.sessionId === currentId, state: sessionState(s, user, now), provider: text(s.type, 40), device: text(d.kind), browser: text(d.browser), platform: text(d.platform), region: text(d.region), ip: maskIp(d.ip), createdAt: iso(s.createdAt), lastSeenAt: iso(s.lastSeenAt), expiresAt: iso(s.expiresAt), idleExpiresAt: iso(s.idleExpiresAt), revokedAt: iso(s.revokedAt), revokedBy: String(s.revokedBy || ""), reason: text(s.revokeReason) };
}
const PROFILE_SECTIONS = ["overview", "security", "sessions", "workspace", "access", "support", "audit", "notes", "privacy"];
function publicAccess(item = {}) {
  return { id: String(item._id || ""), roleId: text(item.roleId), roleVersion: integer(item.roleVersion, 1, 1, 100000), permission: text(item.permission, 160), status: item.status === "active" && item.expiresAt && new Date(item.expiresAt) <= new Date() ? "expired" : text(item.status) || "active", scope: normalizeScope(item.scope), grantedBy: String(item.grantedBy || ""), reason: text(item.reason, 500), grantedAt: iso(item.grantedAt), expiresAt: iso(item.expiresAt), revokedAt: iso(item.revokedAt) };
}
function publicReview(item = {}) {
  return { review: item.review === true, priority: ["low", "normal", "high", "urgent"].includes(item.priority) ? item.priority : "normal", assigneeId: String(item.assigneeId || ""), reason: text(item.reason, 500), reviewAt: iso(item.reviewAt), updatedAt: iso(item.updatedAt), adminId: String(item.adminId || "") };
}
async function profileData(db, admin, target, req, hydrateAdminAccess, assertTargetAllowed) {
  const section = text(req.query.section);
  if (section && !PROFILE_SECTIONS.includes(section)) throw error("Mục hồ sơ không hợp lệ.");
  const wants = (...sections) => !section || sections.includes(section);
  const resource = { accountId: String(target._id) };
  const canRoles = allowed(admin, "users.roles", resource), canNotes = allowed(admin, "users.moderate", resource), canAudit = allowed(admin, "audit.view", resource), canSupport = allowed(admin, "reports.manage", resource);
  const analyticsConsent = target.consentPreferences?.analytics ?? (typeof target.consent === "boolean" ? target.consent : null);
  const canActivity = allowed(admin, "activity.view", resource) && analyticsConsent === true;
  const read = (name, projection, limit, sort = { createdAt: -1 }, extra = {}) => db.collection(name).find({ userId: target._id, ...extra }, { projection, maxTimeMS: 5000 }).sort(sort).limit(limit).toArray();
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const [events, sessions, audit, activity, notes, review, assignments, grants, tickets, supportRequests, current, presence] = await Promise.all([
    wants("overview", "security") ? read("loginEvents", EVENT_FIELDS, 100) : [],
    wants("overview", "sessions") ? read("authSessions", SESSION_FIELDS, 100, { lastSeenAt: -1 }) : [],
    wants("audit") && canAudit ? db.collection("communityAdminAuditLogs").find({ $or: [{ targetType: "user", targetId: String(target._id) }, { targetType: "role-assignment", "after.userId": String(target._id) }, { targetType: "role-assignment", "before.userId": String(target._id) }] }, { projection: { action: 1, reason: 1, admin: 1, createdAt: 1, outcome: 1 }, maxTimeMS: 5000 }).sort({ createdAt: -1 }).limit(50).toArray() : [],
    wants("workspace") && canActivity ? read("telemetryEvents", { module: 1, type: 1, createdAt: 1 }, 100) : [],
    wants("notes") && canNotes ? read("adminAccountNotes", { text: 1, authorId: 1, createdAt: 1, updatedAt: 1, expiresAt: 1 }, 50, { createdAt: -1 }, { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }) : [],
    wants("overview", "notes") && canNotes ? db.collection("adminAccountReviews").findOne({ userId: target._id }, { projection: { review: 1, priority: 1, assigneeId: 1, reason: 1, reviewAt: 1, adminId: 1, updatedAt: 1 } }) : null,
    wants("access") && canRoles ? read("communityRoleAssignments", { roleId: 1, roleVersion: 1, status: 1, scope: 1, grantedBy: 1, reason: 1, grantedAt: 1, expiresAt: 1, revokedAt: 1 }, 100, { grantedAt: -1 }) : [],
    wants("access") && canRoles ? read("communityAccessGrants", { permission: 1, status: 1, scope: 1, grantedBy: 1, reason: 1, grantedAt: 1, expiresAt: 1, revokedAt: 1 }, 100, { grantedAt: -1 }) : [],
    wants("support") && canSupport ? read("tickets", { status: 1, priority: 1, createdAt: 1, updatedAt: 1 }, 30) : [],
    wants("support") && canSupport ? read("supportRequests", { status: 1, createdAt: 1, updatedAt: 1 }, 30) : [],
    wants("sessions") && bearer ? db.collection("authSessions").findOne({ tokenHash: createHash("sha256").update(bearer).digest("hex"), userId: admin._id }, { projection: { sessionId: 1 } }) : null,
    wants("overview") && canActivity ? read("presence", { module: 1, lastSeenAt: 1 }, 1, { lastSeenAt: -1 }, { analyticsConsent: true }) : []
  ]);
  // Hydration preserves existing role policy; all permission evaluation stays on the server.
  await hydrateAdminAccess(db, target);
  let canManage = true;
  try { await assertTargetAllowed(admin, target); } catch { canManage = false; }
  const sessionRows = sessions.map(s => publicSession(s, target, current?.sessionId, new Date()));
  const eventRows = events.map(e => ({ id: String(e._id), type: text(e.type), provider: text(e.provider || e.type), success: e.success !== false, reason: text(e.reason), browser: text(e.browser), platform: text(e.platform), device: text(e.kind), region: text(e.region), ip: maskIp(e.ip), suspicious: e.suspicious === true, newDevice: e.newDevice === true, createdAt: iso(e.createdAt) }));
  const latest = sessions[0];
  const activityTimes = [iso(latest?.lastSeenAt), iso(presence[0]?.lastSeenAt)].filter(Boolean).sort();
  const facts = { ...target, latestSession: latest, provider: target.lastProvider || target.provider || latest?.type, activeSessions: sessionRows.filter(s => s.state === "active").length, failedLogins: eventRows.filter(e => !e.success).length, securitySignals: eventRows.filter(e => e.suspicious || e.newDevice).length, lastActivityAt: activityTimes.at(-1), workspace: presence[0]?.module, sessionState: sessionRows.some(s => s.state === "active") ? "active" : sessionRows[0]?.state || "unknown" };
  const effectivePermissions = canRoles ? [...new Set([...accessFor(target).permissions, ...(target.__adminPermissionGrants || []).map(g => g.permission)])].filter(p => p === "*" || allowed(target, p)).slice(0, 500) : [];
  return { ok: true, section: section || "all", generatedAt: new Date().toISOString(), user: { ...presentAccount(facts), roles: rolesFor(target), restrictedFeatures: target.restrictedFeatures || [], moderationReason: text(target.moderationReason, 500), suspendedUntil: iso(target.suspendedUntil), updatedAt: iso(target.updatedAt), passwordChangedAt: iso(target.passwordChangedAt), providerChangedAt: iso(target.providerChangedAt) }, canManage, canActivity, canRoles, canNotes, canAudit, canSupport, activityReason: !allowed(admin, "activity.view", resource) ? "Không có quyền xem hoạt động." : "Người dùng chưa cho phép hiển thị hoạt động chi tiết.", verified: Boolean(target.verifiedAt || target.emailVerifiedAt), review: review?.review === true, reviewDetail: canNotes ? publicReview(review || {}) : null, events: eventRows, sessions: sessionRows, roleAssignments: assignments.map(publicAccess), accessGrants: grants.map(publicAccess), effectivePermissions, audit: audit.map(e => ({ id: String(e._id), action: text(e.action), reason: text(e.reason, 1000), admin: text(e.admin?.name), outcome: text(e.outcome), createdAt: iso(e.createdAt) })), activity: activity.map(e => ({ id: String(e._id), module: text(e.module), type: text(e.type), createdAt: iso(e.createdAt) })), notes: notes.map(e => ({ id: String(e._id), text: text(e.text, 1000), authorId: String(e.authorId), createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt), expiresAt: iso(e.expiresAt) })), support: [...tickets.map(e => ({ ...e, source: "Helpdesk" })), ...supportRequests.map(e => ({ ...e, source: "Hỗ trợ" }))].map(e => ({ id: String(e._id), source: e.source, status: text(e.status), priority: text(e.priority), createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt) })), privacy: { analyticsConsent, personalizationConsent: target.consentPreferences?.personalization ?? null, updatedAt: iso(target.consentUpdatedAt), maskedNetwork: true, privateContentVisible: false }, limits: { events: 100, sessions: 100, notes: 50, audit: 50, support: 60 } };
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
  if (req.method === "POST" && view === "accounts-export") {
    requireAccess(admin, "users.view");
    requireAccess(admin, "reports.export");
    await enforceRateLimit(db, `admin-accounts-export:${admin._id}`, 10, 600000);
    const fields = [...new Set((Array.isArray(body.fields) ? body.fields : EXPORT_FIELDS).filter(v => EXPORT_FIELDS.includes(v)))];
    if (!fields.length) throw error("Chọn ít nhất một trường hợp lệ.");
    const data = await listAccounts(db, admin, body.query || {}, true);
    const selected = Array.isArray(body.ids) ? body.ids.filter(v => typeof v === "string" && ObjectId.isValid(v)).slice(0, 50) : [];
    if (Array.isArray(body.ids) && body.ids.length && !selected.length) throw error("Danh sách tài khoản đã chọn không hợp lệ.");
    const rows = data.users.filter(row => !selected.length || selected.includes(row.id)).map(row => Object.fromEntries(fields.map(k => [k, row[k]])));
    const filter = normalizeQuery(body.query || {});
    await writeAdminAudit(db, req, admin, { action: "accounts:export", targetType: "report", targetId: "recent-accounts", reason: "Xuất dữ liệu quản trị đã lọc", after: { count: rows.length, fields, format: body.format === "csv" ? "csv" : "json", filter: { range: filter.range, from: iso(filter.from), to: iso(filter.to), status: filter.status, state: filter.state, role: filter.role, provider: filter.provider, workspace: filter.workspace, signal: filter.signal, activity: filter.activity, sort: filter.sort, searchApplied: Boolean(filter.q), selectedCount: selected.length } } });
    const content = body.format === "csv" ? "\uFEFF" + [fields.map(csvCell).join(","), ...rows.map(row => fields.map(k => csvCell(row[k])).join(","))].join("\r\n") : JSON.stringify({ generatedAt: data.generatedAt, accounts: rows }, null, 2);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, content, count: rows.length });
  }
  const userId = text(req.method === "GET" ? req.query.id : body.userId, 180);
  if (!ObjectId.isValid(userId)) throw error("HH ID không hợp lệ.");
  requireAccess(admin, "users.view", { accountId: userId });
  const target = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: USER_FIELDS });
  if (!target) throw error("Không tìm thấy tài khoản.", 404);
  if (req.method === "POST" && view === "accounts-profile-export") {
    requireAccess(admin, "reports.export", { accountId: userId });
    await enforceRateLimit(db, `admin-accounts-export:${admin._id}`, 10, 600000);
    const data = await profileData(db, admin, target, { ...req, query: {} }, hydrateAdminAccess, assertTargetAllowed);
    const { user, events, sessions, activity, roleAssignments, accessGrants, effectivePermissions, notes, reviewDetail, audit, support, privacy, generatedAt, limits } = data;
    const records = events.length + sessions.length + activity.length + roleAssignments.length + accessGrants.length + notes.length + audit.length + support.length;
    await writeAdminAudit(db, req, admin, { action: "accounts:profile-export", targetType: "user", targetId: userId, reason: "Xuất hồ sơ quản trị theo quyền hiện tại", after: { format: "json", records, limits } });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, content: JSON.stringify({ generatedAt, user, events, sessions, activity, roleAssignments, accessGrants, effectivePermissions, notes, reviewDetail, audit, support, privacy, limits }, null, 2), count: records });
  }
  if (req.method === "GET" && view === "accounts-detail") return res.status(200).json(await profileData(db, admin, target, req, hydrateAdminAccess, assertTargetAllowed));
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
      if (/(?:password|mật khẩu|otp|api.?key|token|secret)\s*[:=]/i.test(value)) throw error("Không ghi thông tin đăng nhập hoặc mã bí mật vào ghi chú.");
      const result = await db.collection("adminAccountNotes").insertOne({ userId: target._id, authorId: admin._id, text: value, createdAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000) });
      after = { noteId: String(result.insertedId), added: true };
    } else if (action === "note:edit") {
      const noteId = text(body.noteId, 180), value = text(body.text, 1000);
      if (!ObjectId.isValid(noteId) || !value) throw error("Ghi chú hoặc nội dung không hợp lệ.");
      if (/(?:password|mật khẩu|otp|api.?key|token|secret)\s*[:=]/i.test(value)) throw error("Không ghi thông tin đăng nhập hoặc mã bí mật vào ghi chú.");
      const result = await db.collection("adminAccountNotes").updateOne({ _id: new ObjectId(noteId), userId: target._id, authorId: admin._id, $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }, { $set: { text: value, updatedAt: new Date() } });
      if (!result.matchedCount && !result.modifiedCount) throw error("Chỉ có thể sửa ghi chú của chính bạn nếu ghi chú vẫn tồn tại.", 403);
      after = { noteId, updated: true };
    } else if (action === "note:delete") {
      if (!ObjectId.isValid(text(body.noteId, 24))) throw error("Ghi chú không hợp lệ.");
      const result = await db.collection("adminAccountNotes").deleteOne({ _id: new ObjectId(body.noteId), userId: target._id, authorId: admin._id });
      if (!result.deletedCount) throw error("Chỉ có thể xóa ghi chú do chính bạn tạo, nếu ghi chú vẫn tồn tại.", 403);
      after = { noteId: body.noteId, deleted: true };
    } else if (action === "review:set") {
      const priority = ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal";
      const assigneeId = text(body.assigneeId, 180), reviewAt = body.reviewAt ? iso(body.reviewAt) : null;
      if (body.reviewAt && (!reviewAt || new Date(reviewAt) <= new Date())) throw error("Chọn thời điểm xem lại trong tương lai.");
      if (assigneeId) {
        if (!ObjectId.isValid(assigneeId)) throw error("HH ID người phụ trách không hợp lệ.");
        const assignee = await db.collection("users").findOne({ _id: new ObjectId(assigneeId) }, { projection: { email: 1, systemRoles: 1, adminCustomPermissions: 1, status: 1 } });
        if (!assignee || !rolesFor(assignee).length || ["locked", "suspended", "banned", "deleted"].includes(assignee.status)) throw error("Người phụ trách phải là tài khoản quản trị còn hoạt động.");
      }
      after = { review: body.review === true, priority, assigneeId, reviewAt, reason };
      await db.collection("adminAccountReviews").updateOne({ userId: target._id }, { $set: { ...after, updatedAt: new Date(), adminId: admin._id } }, { upsert: true });
    } else throw error("Thao tác không được hỗ trợ.");
    await writeAdminAudit(db, req, admin, { action: `accounts:${action}`, targetType: "user", targetId: userId, reason, after });
    return res.status(200).json({ ok: true, ...after });
  }
  throw error("Phương thức không được hỗ trợ.", 405);
}

module.exports = { handleAccounts, normalizeQuery, accountPipeline, presentAccount, sessionState, publicSession, maskIp, csvCell, listAccounts, requireAccess, EXPORT_FIELDS };
