const { createHash, randomUUID } = require("crypto");

const SCOPE_TYPES = Object.freeze(new Set([
  "global", "workspace", "module", "account", "provider", "content-source", "resource-owner", "environment"
]));

const ADAPTER_DEFINITIONS = Object.freeze([
  { id: "vercel", label: "Vercel API", requiredEnv: ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID"], readOnly: false },
  { id: "cloudflare", label: "Cloudflare API", requiredEnv: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"], readOnly: false },
  { id: "payos", label: "PayOS", requiredEnv: ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"], readOnly: false },
  { id: "mongodb", label: "MongoDB Atlas", requiredEnv: ["MONGODB_URI"], readOnly: false },
  { id: "gemini", label: "Gemini API", requiredEnv: ["GEMINI_API_KEY"], readOnly: false },
  { id: "resend", label: "Resend email", requiredEnv: ["RESEND_API_KEY", "EMAIL_FROM"], readOnly: false },
  { id: "youtube", label: "YouTube API", requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"], readOnly: false },
  { id: "tiktok", label: "TikTok API", requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], readOnly: false },
  { id: "comic-worker", label: "Comic Motion Worker", requiredEnv: ["COMIC_MOTION_WORKER_URL"], readOnly: false },
  { id: "background-worker", label: "Background Worker", requiredEnv: ["QUEUE_WORKER_URL"], readOnly: false }
]);

function clean(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function idOf(value) {
  return clean(value, 180);
}

function normalizeScope(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const type = SCOPE_TYPES.has(clean(source.type, 40).toLowerCase()) ? clean(source.type, 40).toLowerCase() : "global";
  const list = (key) => [...new Set((Array.isArray(source[key]) ? source[key] : source[key] ? [source[key]] : [])
    .map((item) => clean(item, 180)).filter(Boolean))].slice(0, 100);
  return {
    type,
    workspaceIds: list("workspaceIds"),
    moduleIds: list("moduleIds"),
    accountIds: list("accountIds"),
    providerIds: list("providerIds"),
    contentSourceIds: list("contentSourceIds"),
    ownerIds: list("ownerIds"),
    environmentIds: list("environmentIds")
  };
}

function scopeAllows(scope, resource = {}) {
  const normalized = normalizeScope(scope);
  if (normalized.type === "global") return true;
  const values = {
    workspace: idOf(resource.workspaceId),
    module: idOf(resource.moduleId || resource.module),
    account: idOf(resource.accountId),
    provider: idOf(resource.providerId || resource.provider),
    "content-source": idOf(resource.contentSourceId || resource.sourceId),
    "resource-owner": idOf(resource.ownerId),
    environment: idOf(resource.environmentId || resource.environment)
  };
  const key = {
    workspace: "workspaceIds",
    module: "moduleIds",
    account: "accountIds",
    provider: "providerIds",
    "content-source": "contentSourceIds",
    "resource-owner": "ownerIds",
    environment: "environmentIds"
  }[normalized.type];
  if (!key || !values[normalized.type]) return false;
  return normalized[key].includes(values[normalized.type]);
}

function conditionsAllow(conditions = {}, context = {}) {
  const now = new Date(context.now || Date.now());
  if (conditions.expiresAt && new Date(conditions.expiresAt).getTime() <= now.getTime()) return false;
  if (conditions.startsAt && new Date(conditions.startsAt).getTime() > now.getTime()) return false;
  if (Array.isArray(conditions.allowedEnvironments) && conditions.allowedEnvironments.length
    && !conditions.allowedEnvironments.includes(clean(context.environment, 80))) return false;
  if (Array.isArray(conditions.allowedMethods) && conditions.allowedMethods.length
    && !conditions.allowedMethods.includes(clean(context.method, 20).toUpperCase())) return false;
  if (conditions.requirePasskey && context.passkeyVerified !== true) return false;
  if (conditions.requireStepUp && context.stepUpVerified !== true) return false;
  return true;
}

function roleRank(role, ranks = {}) {
  const key = clean(role, 80).toLowerCase();
  return Number(ranks[key] || (key.startsWith("custom:") ? 15 : 0));
}

function assertCanAdministerTarget(actor, target, ranks = {}) {
  const actorId = idOf(actor?._id || actor?.id);
  const targetId = idOf(target?._id || target?.id);
  if (actorId && targetId && actorId === targetId) {
    const error = new Error("Không thể thực hiện thao tác quản trị trên chính tài khoản đang hoạt động.");
    error.statusCode = 400;
    error.code = "SELF_ADMIN_ACTION_BLOCKED";
    throw error;
  }
  const actorRoles = Array.isArray(actor?.systemRoles) ? actor.systemRoles : [];
  const targetRoles = Array.isArray(target?.systemRoles) ? target.systemRoles : [];
  const actorRank = Math.max(0, ...actorRoles.map((role) => roleRank(role, ranks)));
  const targetRank = Math.max(0, ...targetRoles.map((role) => roleRank(role, ranks)));
  if (targetRank > 0 && actorRank <= targetRank) {
    const error = new Error("Bạn không thể quản trị tài khoản có quyền ngang hoặc cao hơn mình.");
    error.statusCode = 403;
    error.code = "TARGET_PRIVILEGE_TOO_HIGH";
    throw error;
  }
  return true;
}

function effectivePermissions({ roles = [], assignments = [], definitions = [], legacyPermissions = [], rolePermissions = {} } = {}) {
  // Definitions are versioned.  Consumers must never depend on Mongo sort order
  // or accidentally grant an older definition when the array contains several
  // versions of the same role.
  const definitionMap = new Map();
  const definitionVersions = new Map();
  for (const item of Array.isArray(definitions) ? definitions : []) {
    const roleId = clean(item.roleId, 120);
    if (!roleId) continue;
    const previous = definitionMap.get(roleId);
    if (!previous || Number(item.version || 0) > Number(previous.version || 0)
      || (Number(item.version || 0) === Number(previous.version || 0) && new Date(item.updatedAt || 0) > new Date(previous.updatedAt || 0))) {
      definitionMap.set(roleId, item);
    }
    definitionVersions.set(`${roleId}:${Number(item.version || 1)}`, item);
  }
  const permissions = new Set((Array.isArray(legacyPermissions) ? legacyPermissions : []).map((item) => clean(item, 120)).filter(Boolean));
  for (const role of roles) {
    const builtIn = Array.isArray(rolePermissions[role]) ? rolePermissions[role] : [];
    for (const permission of builtIn) permissions.add(clean(permission, 120));
    const definition = definitionMap.get(clean(role, 120));
    if (definition?.status === "disabled" || definition?.status === "deprecated") continue;
    for (const permission of Array.isArray(definition?.permissions) ? definition.permissions : []) permissions.add(clean(permission, 120));
  }
  for (const assignment of assignments) {
    if (assignment.status && assignment.status !== "active") continue;
    if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() <= Date.now()) continue;
    const assignmentRoleId = clean(assignment.roleId, 120);
    const definition = definitionVersions.get(`${assignmentRoleId}:${Number(assignment.roleVersion || 1)}`) || definitionMap.get(assignmentRoleId);
    if (definition?.status === "disabled" || definition?.status === "deprecated") continue;
    for (const permission of Array.isArray(definition?.permissions) ? definition.permissions : []) permissions.add(clean(permission, 120));
  }
  return [...permissions].filter(Boolean).slice(0, 500);
}

function authorize({ actor, action, resource = {}, context = {}, permission, permissions = [], scope = {}, roleRanks = {} } = {}) {
  const requiredPermission = clean(permission || action, 160);
  const granted = new Set((Array.isArray(permissions) ? permissions : []).map((item) => clean(item, 160)));
  const hasPermission = granted.has("*") || granted.has(requiredPermission);
  const allowedScope = scopeAllows(scope, resource);
  const allowedConditions = conditionsAllow(scope.conditions || {}, context);
  const allowed = Boolean(actor && hasPermission && allowedScope && allowedConditions);
  return {
    allowed,
    code: allowed ? "ALLOWED" : !actor ? "AUTH_REQUIRED" : !hasPermission ? "RBAC_DENIED" : !allowedScope ? "SCOPE_DENIED" : "CONDITION_DENIED",
    reason: allowed ? "allowed" : !actor ? "Cần đăng nhập." : !hasPermission ? `Thiếu quyền ${requiredPermission}.` : !allowedScope ? "Resource nằm ngoài phạm vi được cấp." : "Điều kiện quyền không thỏa mãn.",
    requiredPermission,
    role: Array.isArray(actor?.systemRoles) ? actor.systemRoles[0] || "member" : "member",
    scope: normalizeScope(scope),
    policyVersion: "admin-control-plane-v1",
    targetRank: Math.max(0, ...(Array.isArray(resource.targetRoles) ? resource.targetRoles : []).map((role) => roleRank(role, roleRanks)))
  };
}

function safeAdapterState(definition, env = process.env, persisted = {}) {
  const configured = definition.requiredEnv.every((key) => Boolean(String(env[key] || "").trim()));
  const saved = persisted && typeof persisted === "object" ? persisted : {};
  const lastCheckedAt = saved.lastCheckedAt || null;
  const checkedAtMs = lastCheckedAt ? new Date(lastCheckedAt).getTime() : 0;
  const stale = !Number.isFinite(checkedAtMs) || Date.now() - checkedAtMs > 24 * 60 * 60 * 1000;
  return {
    id: definition.id,
    label: definition.label,
    configured,
    state: saved.state || (configured ? "configured" : "not_configured"),
    readOnly: Boolean(definition.readOnly),
    requiredEnv: definition.requiredEnv.slice(),
    lastCheckedAt,
    stale,
    lastErrorCode: clean(saved.lastErrorCode, 100),
    verifiedWrite: saved.verifiedWrite === true,
    canExecute: configured && saved.verifiedWrite === true && saved.state === "write_ready",
    healthCheckMode: "configuration-only"
  };
}

function adapterRegistry(env = process.env, persisted = []) {
  const state = new Map((Array.isArray(persisted) ? persisted : []).map((item) => [clean(item.id, 80), item]));
  return ADAPTER_DEFINITIONS.map((definition) => safeAdapterState(definition, env, state.get(definition.id)));
}

function redactAdapterResult(value, depth = 0) {
  if (depth > 4 || value == null) return value == null ? null : "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactAdapterResult(item, depth + 1));
  if (typeof value !== "object") return typeof value === "string" ? clean(value, 500) : value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(token|secret|password|authorization|credential|private|prompt|message)/i.test(key))
    .slice(0, 80)
    .map(([key, item]) => [key, redactAdapterResult(item, depth + 1)]));
}

function idempotencyKey(input = {}) {
  const value = [input.actorId, input.action, input.resourceId, input.scopeId, input.requestId].map((item) => clean(item, 180)).join(":");
  return createHash("sha256").update(value || randomUUID()).digest("hex");
}

module.exports = Object.freeze({
  ADAPTER_DEFINITIONS,
  SCOPE_TYPES,
  assertCanAdministerTarget,
  adapterRegistry,
  authorize,
  conditionsAllow,
  effectivePermissions,
  idempotencyKey,
  normalizeScope,
  redactAdapterResult,
  safeAdapterState,
  scopeAllows
});
