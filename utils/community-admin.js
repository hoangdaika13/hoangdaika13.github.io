const { clean, isOwnerEmail } = require("./platform");

const ROLE_PERMISSIONS = Object.freeze({
  owner: ["*"],
  super_admin: ["dashboard.view", "users.view", "users.moderate", "users.roles", "sessions.revoke", "content.manage", "reports.manage", "appeals.manage", "config.manage", "flags.manage", "templates.manage", "audit.view", "reports.export"],
  admin: ["dashboard.view", "users.view", "users.moderate", "sessions.revoke", "content.manage", "reports.manage", "appeals.manage", "config.manage", "flags.manage", "templates.manage", "audit.view", "reports.export"],
  moderator: ["dashboard.view", "users.view", "content.manage", "reports.manage", "appeals.manage", "audit.view"],
  support: ["dashboard.view", "users.view", "reports.manage", "appeals.manage"],
  analyst: ["dashboard.view", "users.view", "audit.view", "reports.export"]
});

function rolesFor(user) {
  if (!user) return [];
  const roles = new Set((Array.isArray(user.systemRoles) ? user.systemRoles : []).map((role) => clean(role, 40).toLowerCase()).filter((role) => ROLE_PERMISSIONS[role]));
  if (isOwnerEmail(user.email)) roles.add("owner");
  return [...roles];
}

function accessFor(user) {
  const roles = rolesFor(user);
  const permissions = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || []));
  return { roles, permissions: [...permissions], admin: roles.length > 0 };
}

function hasPermission(user, permission) {
  const { permissions } = accessFor(user);
  return permissions.includes("*") || permissions.includes(permission);
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
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => auditSafe(item, depth + 1));
  if (typeof value !== "object") return typeof value === "string" ? clean(value, 1000) : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|hash|token|secret|credential|privateMessage|messageText)/i.test(key)).slice(0, 120).map(([key, item]) => [key, auditSafe(item, depth + 1)]));
}

function requestMeta(req) {
  return {
    ip: clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0], 120),
    userAgent: clean(req.headers["user-agent"], 500)
  };
}

async function writeAdminAudit(db, req, admin, entry = {}) {
  const now = new Date();
  const access = accessFor(admin);
  const record = {
    adminId: admin._id,
    admin: { id: String(admin._id), name: clean(admin.name, 120), email: clean(admin.email, 180) },
    roles: access.roles,
    action: clean(entry.action, 100),
    targetType: clean(entry.targetType, 80),
    targetId: clean(entry.targetId, 160),
    reason: clean(entry.reason, 1000),
    before: auditSafe(entry.before),
    after: auditSafe(entry.after),
    ...requestMeta(req),
    createdAt: now
  };
  await db.collection("communityAdminAuditLogs").insertOne(record);
  return record;
}

module.exports = { ROLE_PERMISSIONS, accessFor, hasPermission, requirePermission, rolesFor, writeAdminAudit };
