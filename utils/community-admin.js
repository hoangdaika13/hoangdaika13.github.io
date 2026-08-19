const crypto = require("crypto");
const { clean, isOwnerUser } = require("./platform");
const { scopeAllows, conditionsAllow } = require("./admin-control-plane");
let auditAppendTail = Promise.resolve();

const POWER_PERMISSIONS = Object.freeze([
  "permissions.simulate",
  "privileges.activate",
  "approvals.request",
  "approvals.approve",
  "roles.custom.manage",
  "roles.custom.assign",
  "identity.service-accounts.manage",
  "platform.deployments.view",
  "platform.production.promote",
  "platform.production.rollback",
  "platform.domains.manage",
  "platform.cron.manage",
  "platform.webhooks.manage",
  "platform.maintenance.manage",
  "security.waf.manage",
  "security.rate-limits.manage",
  "security.network-blocks.manage",
  "security.providers.disable",
  "security.secrets.rotate",
  "security.sessions.revoke-all",
  "database.health.view",
  "database.backup.request",
  "database.indexes.analyze",
  "database.migrations.request",
  "database.retention.manage",
  "database.restore.request",
  "payments.view",
  "payments.reconcile",
  "payments.webhooks.replay",
  "payments.lock",
  "payments.refunds.request",
  "payments.refunds.approve",
  "ai.providers.view",
  "ai.providers.manage",
  "ai.budgets.manage",
  "ai.queue.manage",
  "ai.fallback.manage",
  "content.bulk-manage",
  "content.publishing.lock",
  "observability.view",
  "observability.logs.view",
  "observability.traces.view",
  "observability.slo.manage",
  "observability.alerts.manage",
  "audit.network.view",
  "audit.access-review"
]);

const ROLE_PERMISSIONS = Object.freeze({
  owner: ["*"],
  super_admin: ["dashboard.view", "incidents.view", "incidents.manage", "security.view", "privacy.view", "activity.view", "users.view", "users.moderate", "users.roles", "users.features", "sessions.revoke", "content.manage", "reports.manage", "appeals.manage", "rights.view", "rights.review", "platform.view", "platform.manage", "growth.view", "config.manage", "flags.manage", "templates.manage", "audit.view", "reports.export", ...POWER_PERMISSIONS],
  admin: ["dashboard.view", "incidents.view", "incidents.manage", "security.view", "privacy.view", "activity.view", "users.view", "users.moderate", "users.features", "sessions.revoke", "content.manage", "reports.manage", "appeals.manage", "rights.view", "rights.review", "platform.view", "platform.manage", "growth.view", "config.manage", "flags.manage", "templates.manage", "audit.view", "reports.export"],
  security_admin: ["dashboard.view", "incidents.view", "incidents.manage", "security.view", "privacy.view", "activity.view", "users.view", "users.moderate", "sessions.revoke", "platform.view", "audit.view", "audit.network.view", "reports.export", "permissions.simulate", "privileges.activate", "approvals.request", "security.waf.manage", "security.rate-limits.manage", "security.network-blocks.manage", "security.providers.disable", "observability.view", "observability.logs.view", "observability.traces.view", "observability.alerts.manage"],
  release_manager: ["dashboard.view", "incidents.view", "platform.view", "platform.manage", "config.manage", "flags.manage", "audit.view", "reports.export", "permissions.simulate", "privileges.activate", "approvals.request", "platform.deployments.view", "platform.production.promote", "platform.production.rollback", "platform.cron.manage", "platform.webhooks.manage", "platform.maintenance.manage", "observability.view"],
  content_moderator: ["dashboard.view", "activity.view", "users.view", "content.manage", "reports.manage", "appeals.manage", "rights.view", "audit.view"],
  moderator: ["dashboard.view", "activity.view", "users.view", "content.manage", "reports.manage", "appeals.manage", "rights.view", "audit.view"],
  support: ["dashboard.view", "incidents.view", "users.view", "users.moderate", "reports.manage", "appeals.manage"],
  analyst: ["dashboard.view", "privacy.view", "activity.view", "users.view", "growth.view", "audit.view", "reports.export", "observability.view"]
});
const ROLE_RANK = Object.freeze({ owner: 60, super_admin: 50, admin: 40, security_admin: 30, release_manager: 30, content_moderator: 20, moderator: 20, support: 10, analyst: 10, member: 0 });

const CRITICAL_PERMISSIONS = new Set([
  "platform.production.rollback",
  "platform.domains.manage",
  "security.secrets.rotate",
  "security.sessions.revoke-all",
  "database.restore.request",
  "payments.refunds.approve"
]);
const ELEVATED_PERMISSIONS = new Set([
  ...POWER_PERMISSIONS.filter((permission) => !CRITICAL_PERMISSIONS.has(permission)),
  "users.roles",
  "config.manage",
  "flags.manage"
]);
const PERMISSION_LABELS = Object.freeze({
  "roles.custom.manage": "Tạo và sửa vai trò tùy chỉnh",
  "roles.custom.assign": "Gán vai trò tùy chỉnh",
  "identity.service-accounts.manage": "Quản lý service account và API token",
  "platform.production.promote": "Promote deployment production",
  "platform.production.rollback": "Rollback production",
  "platform.domains.manage": "Quản lý domain",
  "security.sessions.revoke-all": "Đăng xuất toàn bộ phiên",
  "security.secrets.rotate": "Yêu cầu xoay secret",
  "database.restore.request": "Yêu cầu khôi phục database",
  "payments.refunds.approve": "Phê duyệt hoàn tiền",
  "observability.slo.manage": "Quản lý SLO",
  "content.publishing.lock": "Khóa phát hành nội dung",
  "ai.budgets.manage": "Quản lý ngân sách AI",
  "rights.view": "Xem hồ sơ quyền Comic Motion",
  "rights.review": "Duyệt, từ chối và thu hồi quyền Comic Motion"
});
const allPermissionIds = [...new Set(Object.values(ROLE_PERMISSIONS).flat().filter((permission) => permission !== "*"))].sort();
const permissionGroup = (permission) => {
  const prefix = String(permission).split(".")[0];
  return ({
    identity: "Identity",
    users: "Identity",
    sessions: "Identity",
    roles: "Identity",
    permissions: "Identity",
    privileges: "Identity",
    approvals: "Identity",
    platform: "Platform",
    flags: "Platform",
    config: "Platform",
    templates: "Platform",
    security: "Security",
    incidents: "Security",
    privacy: "Security",
    database: "Database",
    payments: "PayOS",
    ai: "AI Providers",
    content: "Content",
    reports: "Content",
    appeals: "Content",
    rights: "Content",
    observability: "Observability",
    audit: "Observability",
    activity: "Observability",
    growth: "Growth",
    dashboard: "Mission Control"
  })[prefix] || "Platform";
};
const PERMISSION_CATALOG = Object.freeze(allPermissionIds.map((id) => Object.freeze({
  id,
  label: PERMISSION_LABELS[id] || id.split(".").map((part) => part.replace(/-/g, " ")).join(" · "),
  group: permissionGroup(id),
  tier: CRITICAL_PERMISSIONS.has(id) ? "critical" : ELEVATED_PERMISSIONS.has(id) ? "elevated" : "standing"
})));
const KNOWN_PERMISSIONS = new Set(PERMISSION_CATALOG.map((item) => item.id));

function normalizePermissions(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((permission) => clean(permission, 100).toLowerCase())
    .filter((permission) => KNOWN_PERMISSIONS.has(permission)))].slice(0, 120);
}

function simulatePermissions(current = [], requested = []) {
  const baseline = new Set(normalizePermissions(current));
  const selected = normalizePermissions(requested);
  const unknown = [...new Set((Array.isArray(requested) ? requested : []).map((item) => clean(item, 100).toLowerCase()).filter((item) => item && !KNOWN_PERMISSIONS.has(item)))];
  const newAccess = selected.filter((permission) => !baseline.has(permission));
  const critical = selected.filter((permission) => CRITICAL_PERMISSIONS.has(permission));
  const elevated = selected.filter((permission) => ELEVATED_PERMISSIONS.has(permission) && !CRITICAL_PERMISSIONS.has(permission));
  const conflicts = [];
  if (selected.includes("payments.refunds.approve") && !selected.includes("payments.reconcile")) conflicts.push("Nên cấp payments.reconcile trước quyền phê duyệt hoàn tiền.");
  if (selected.includes("platform.production.rollback") && !selected.includes("platform.deployments.view")) conflicts.push("Rollback cần quyền xem deployment để kiểm tra phiên bản.");
  if (selected.includes("security.waf.manage") && !selected.includes("security.view")) conflicts.push("Quản lý WAF cần quyền xem Security Center.");
  const riskScore = Math.min(100, critical.length * 28 + elevated.length * 9 + newAccess.length * 2);
  return { selected, newAccess, elevated, critical, unknown, conflicts, riskScore, valid: unknown.length === 0 && !selected.includes("*") };
}

function rolesFor(user) {
  if (!user) return [];
  const roles = new Set((Array.isArray(user.systemRoles) ? user.systemRoles : [])
    .map((role) => clean(role, 40).toLowerCase())
    .filter((role) => (ROLE_PERMISSIONS[role] || (/^custom:[a-z0-9][a-z0-9_-]{2,31}$/.test(role) && normalizePermissions(user.adminCustomPermissions).length)) && role !== "owner"));
  if (isOwnerUser(user)) roles.add("owner");
  return [...roles];
}

function highestRole(user) {
  const rank = (role) => ROLE_RANK[role] || (String(role).startsWith("custom:") ? 15 : 0);
  return rolesFor(user).sort((left, right) => rank(right) - rank(left))[0] || "member";
}

function canGrantRole(user, role) {
  const targetRank = ROLE_RANK[clean(role, 40).toLowerCase()];
  const actorRank = ROLE_RANK[highestRole(user)] || 0;
  return Number.isFinite(targetRank) && targetRank < actorRank && clean(role, 40).toLowerCase() !== "owner";
}

function accessFor(user) {
  const roles = rolesFor(user);
  const permissions = new Set([
    ...roles.flatMap((role) => ROLE_PERMISSIONS[role] || []),
    ...(roles.some((role) => role.startsWith("custom:")) ? normalizePermissions(user?.adminCustomPermissions) : [])
  ]);
  const permissionList = [...permissions];
  return {
    roles,
    permissions: permissionList,
    admin: roles.length > 0,
    tier: roles.includes("owner") ? "root" : roles.includes("super_admin") ? "super" : "delegated",
    permissionCount: permissionList.includes("*") ? "all" : permissionList.length
  };
}

function hasPermission(user, permission) {
  const { permissions } = accessFor(user);
  const globalGrant = (Array.isArray(user?.__adminPermissionGrants) ? user.__adminPermissionGrants : []).some((grant) => grant.status === "active" && grant.permission === permission && new Date(grant.expiresAt || "9999-12-31").getTime() > Date.now() && normalizeScopeForPermission(grant.scope));
  return permissions.includes("*") || permissions.includes(permission) || globalGrant;
}

function normalizeScopeForPermission(scope) {
  return !scope || scope.type === "global";
}

function requirePermission(user, permission) {
  if (!user) {
    const error = new Error("Bạn cần đăng nhập để truy cập ứng dụng quản trị.");
    error.statusCode = 401;
    throw error;
  }
  if (!hasPermission(user, permission)) {
    const error = new Error("Tài khoản không có quyền thực hiện thao tác quản trị này.");
    error.statusCode = 403;
    throw error;
  }
  return accessFor(user);
}

function auditSafe(value, depth = 0) {
  if (value == null || depth > 5) return value == null ? null : "[truncated]";
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => auditSafe(item, depth + 1));
  if (typeof value !== "object") return typeof value === "string" ? clean(value, 1000) : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|hash|token|secret|credential|privateMessage|messageText)/i.test(key)).slice(0, 120).map(([key, item]) => [key, auditSafe(item, depth + 1)]));
}

function hasPermissionForResource(user, permission, resource = {}, context = {}) {
  if (!user) return false;
  const required = clean(permission, 120);
  const access = accessFor(user);
  if (access.permissions.includes("*")) return true;
  const assignments = Array.isArray(user.__adminRoleAssignments) ? user.__adminRoleAssignments : [];
  const grants = Array.isArray(user.__adminPermissionGrants) ? user.__adminPermissionGrants : [];
  const definitions = new Map((Array.isArray(user.__adminRoleDefinitions) ? user.__adminRoleDefinitions : []).map((definition) => [definition.roleId, definition]));
  const roleAllows = assignments.some((assignment) => assignment.status === "active" && new Date(assignment.expiresAt || "9999-12-31").getTime() > Date.now() && (definitions.get(assignment.roleId)?.permissions || []).includes(required) && scopeAllows(assignment.scope, resource) && conditionsAllow(assignment.conditions || assignment.scope?.conditions || {}, context));
  const grantAllows = grants.some((grant) => grant.status === "active" && grant.permission === required && new Date(grant.expiresAt || "9999-12-31").getTime() > Date.now() && scopeAllows(grant.scope, resource) && conditionsAllow(grant.conditions || grant.scope?.conditions || {}, context));
  // Built-in roles are global unless a caller explicitly asks for an assignment
  // or grant-only permission. Legacy custom permissions remain global during the
  // migration window and are audited as such.
  const builtInAllows = rolesFor(user).some((role) => (ROLE_PERMISSIONS[role] || []).includes(required));
  const legacyAllows = Array.isArray(user.adminCustomPermissions) && normalizePermissions(user.adminCustomPermissions).includes(required) && !assignments.length && !grants.length;
  return builtInAllows || roleAllows || grantAllows || legacyAllows;
}

function maskAuditIp(value) {
  const ip = clean(value, 120);
  if (!ip) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:*`;
  return "masked";
}

function maskAuditUserAgent(value) {
  const agent = clean(value, 500);
  if (!agent) return "";
  const family = /edg\//i.test(agent) ? "Edge" : /chrome\//i.test(agent) ? "Chrome" : /firefox\//i.test(agent) ? "Firefox" : /safari\//i.test(agent) ? "Safari" : "Browser";
  return `${family} · metadata hidden`;
}

function auditHashPayload(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !["_id", "id", "recordHash"].includes(key)));
}

function auditRecordHash(record = {}) {
  return crypto.createHash("sha256").update(JSON.stringify(auditHashPayload(record))).digest("hex");
}

function verifyAuditChain(records = [], options = {}) {
  const ordered = [...records].sort((left, right) => {
    const leftSequence = Number(left.sequence || 0);
    const rightSequence = Number(right.sequence || 0);
    if (leftSequence && rightSequence && leftSequence !== rightSequence) return leftSequence - rightSequence;
    return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
  });
  const issues = [];
  ordered.forEach((record, index) => {
    if (!record?.recordHash || auditRecordHash(record) !== record.recordHash) issues.push({ index, type: "record-hash" });
    if (index > 0 && record.previousHash !== ordered[index - 1].recordHash) issues.push({ index, type: "chain-link" });
  });
  const total = Math.max(ordered.length, Number(options.total || ordered.length));
  const completeToHead = total === ordered.length;
  return {
    valid: issues.length === 0,
    checkedEntries: ordered.length,
    totalEntries: total,
    completeToHead,
    issues: issues.slice(0, 20),
    mode: "tamper-evident-sha256-chain",
    immutable: false,
    externalAnchor: false
  };
}

function presentAdminAuditRecord(record = {}, options = {}) {
  const safe = auditSafe(record);
  return {
    ...safe,
    id: String(record._id || record.id || ""),
    _id: undefined,
    ip: options.includeNetwork ? clean(record.ip, 120) : maskAuditIp(record.ip),
    userAgent: options.includeNetwork ? clean(record.userAgent, 500) : maskAuditUserAgent(record.userAgent),
    createdAt: record.createdAt || null,
    networkMetadataMasked: !options.includeNetwork
  };
}

function requestMeta(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sessionIdHash = bearer ? crypto.createHash("sha256").update(bearer).digest("hex").slice(0, 24) : "";
  return {
    ip: clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0], 120),
    userAgent: clean(req.headers["user-agent"], 500),
    requestId: clean(req.headers["x-request-id"] || crypto.randomUUID(), 160),
    correlationId: clean(req.headers["x-correlation-id"] || req.headers["x-request-id"] || crypto.randomUUID(), 160),
    sessionIdHash
  };
}

async function writeAdminAudit(db, req, admin, entry = {}) {
  const append = auditAppendTail.then(async () => {
    const now = new Date();
    const access = accessFor(admin);
    const previous = await db.collection("communityAdminAuditLogs").findOne({}, { projection: { recordHash: 1, sequence: 1 }, sort: { createdAt: -1, sequence: -1 } });
    const record = {
      eventId: crypto.randomUUID(),
      adminId: admin._id,
      admin: { id: String(admin._id), name: clean(admin.name, 120), email: clean(admin.email, 180) },
      roles: access.roles,
      actorRole: highestRole(admin),
      action: clean(entry.action, 100),
      targetType: clean(entry.targetType, 80),
      targetId: clean(entry.targetId, 160),
      reason: clean(entry.reason, 1000),
      policyVersion: clean(entry.policyVersion || "admin-control-plane-v1", 80),
      permission: clean(entry.permission, 160),
      resourceScope: auditSafe(entry.scope || null),
      decision: clean(entry.decision || "committed", 40),
      outcome: clean(entry.outcome || "success", 40),
      errorCode: clean(entry.errorCode, 100),
      durationMs: Math.max(0, Number(entry.durationMs || 0)),
      before: auditSafe(entry.before),
      after: auditSafe(entry.after),
      previousHash: clean(previous?.recordHash || "genesis", 128),
      sequence: Number(previous?.sequence || 0) + 1,
      integrityVersion: "sha256-chain-v2",
      ...requestMeta(req),
      createdAt: now
    };
    record.recordHash = auditRecordHash(record);
    await db.collection("communityAdminAuditLogs").insertOne(record);
    return record;
  });
  auditAppendTail = append.catch(() => undefined);
  return append;
}

module.exports = {
  CRITICAL_PERMISSIONS,
  ELEVATED_PERMISSIONS,
  PERMISSION_CATALOG,
  POWER_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  accessFor,
  auditRecordHash,
  auditSafe,
  canGrantRole,
  hasPermission,
  hasPermissionForResource,
  highestRole,
  normalizePermissions,
  presentAdminAuditRecord,
  requirePermission,
  rolesFor,
  simulatePermissions,
  verifyAuditChain,
  writeAdminAudit
};
