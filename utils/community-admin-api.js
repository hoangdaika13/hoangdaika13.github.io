const { ObjectId } = require("mongodb");
const { adminEmails, adminUserIds, clean, currentUser, enforceRateLimit, isOwnerUser, withApi } = require("./platform");
const {
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  accessFor,
  canGrantRole,
  hasPermission,
  highestRole,
  normalizePermissions,
  requirePermission,
  rolesFor,
  simulatePermissions,
  writeAdminAudit
} = require("./community-admin");

const USER_PROJECTION = Object.freeze({
  name: 1,
  email: 1,
  avatar: 1,
  provider: 1,
  lastProvider: 1,
  googleVerifiedAt: 1,
  status: 1,
  systemRoles: 1,
  adminCustomPermissions: 1,
  verifiedAt: 1,
  emailVerifiedAt: 1,
  consent: 1,
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: 1,
  suspendedUntil: 1,
  restrictedFeatures: 1
});

const ALLOWED_ROLES = new Set(["super_admin", "admin", "security_admin", "release_manager", "content_moderator", "moderator", "support", "analyst"]);
const ALLOWED_USER_STATUS = new Set(["active", "locked", "suspended", "banned"]);
const INCIDENT_STATUSES = new Set(["new", "investigating", "mitigated", "resolved"]);
const JOB_ACTIONS = new Set(["pause", "retry", "cancel", "duplicate"]);
const CONTENT_COLLECTIONS = Object.freeze({ post: "communityPosts", story: "communityStories" });
const PRIVILEGE_DURATIONS = new Set([15, 30, 60]);
const CONTROL_ACTIONS = Object.freeze([
  { id: "platform.maintenance", group: "Platform", label: "Bật/tắt Maintenance Mode", permission: "platform.maintenance.manage", tier: "elevated", adapter: "internal" },
  { id: "platform.promote", group: "Platform", label: "Promote deployment", permission: "platform.production.promote", tier: "elevated", adapter: "vercel" },
  { id: "platform.rollback", group: "Platform", label: "Rollback production", permission: "platform.production.rollback", tier: "critical", adapter: "vercel" },
  { id: "platform.domain", group: "Platform", label: "Thay đổi domain", permission: "platform.domains.manage", tier: "critical", adapter: "vercel" },
  { id: "platform.cron", group: "Platform", label: "Quản lý cron", permission: "platform.cron.manage", tier: "elevated", adapter: "vercel" },
  { id: "platform.webhook", group: "Platform", label: "Quản lý webhook", permission: "platform.webhooks.manage", tier: "elevated", adapter: "internal" },
  { id: "security.logout-all", group: "Security", label: "Đăng xuất toàn bộ phiên", permission: "security.sessions.revoke-all", tier: "critical", adapter: "internal" },
  { id: "security.waf", group: "Security", label: "Quản lý WAF", permission: "security.waf.manage", tier: "elevated", adapter: "cloudflare" },
  { id: "security.rate-limit", group: "Security", label: "Quản lý rate limit", permission: "security.rate-limits.manage", tier: "elevated", adapter: "internal" },
  { id: "security.network-block", group: "Security", label: "Chặn IP/quốc gia", permission: "security.network-blocks.manage", tier: "elevated", adapter: "cloudflare" },
  { id: "security.rotate-secret", group: "Security", label: "Yêu cầu xoay secret", permission: "security.secrets.rotate", tier: "critical", adapter: "manual" },
  { id: "database.backup", group: "Database", label: "Yêu cầu backup", permission: "database.backup.request", tier: "elevated", adapter: "mongodb" },
  { id: "database.indexes", group: "Database", label: "Phân tích index", permission: "database.indexes.analyze", tier: "elevated", adapter: "internal" },
  { id: "database.migration", group: "Database", label: "Yêu cầu migration", permission: "database.migrations.request", tier: "elevated", adapter: "manual" },
  { id: "database.restore", group: "Database", label: "Yêu cầu khôi phục", permission: "database.restore.request", tier: "critical", adapter: "manual" },
  { id: "payos.reconcile", group: "PayOS", label: "Đối soát PayOS", permission: "payments.reconcile", tier: "elevated", adapter: "payos" },
  { id: "payos.webhook-replay", group: "PayOS", label: "Phát lại webhook", permission: "payments.webhooks.replay", tier: "elevated", adapter: "payos" },
  { id: "payos.lock", group: "PayOS", label: "Khóa thanh toán", permission: "payments.lock", tier: "elevated", adapter: "internal" },
  { id: "payos.refund", group: "PayOS", label: "Phê duyệt hoàn tiền", permission: "payments.refunds.approve", tier: "critical", adapter: "payos-refund" },
  { id: "ai.provider", group: "AI Providers", label: "Bật/tắt AI provider", permission: "ai.providers.manage", tier: "elevated", adapter: "internal" },
  { id: "ai.budget", group: "AI Providers", label: "Đặt ngân sách AI", permission: "ai.budgets.manage", tier: "elevated", adapter: "internal" },
  { id: "ai.fallback", group: "AI Providers", label: "Đổi fallback provider", permission: "ai.fallback.manage", tier: "elevated", adapter: "internal" },
  { id: "content.bulk", group: "Content", label: "Moderation hàng loạt", permission: "content.bulk-manage", tier: "elevated", adapter: "internal" },
  { id: "content.lock-publishing", group: "Content", label: "Khóa xuất bản", permission: "content.publishing.lock", tier: "elevated", adapter: "internal" },
  { id: "observability.slo", group: "Observability", label: "Quản lý SLO", permission: "observability.slo.manage", tier: "elevated", adapter: "internal" },
  { id: "observability.alert", group: "Observability", label: "Tạo quy tắc cảnh báo", permission: "observability.alerts.manage", tier: "elevated", adapter: "internal" }
]);
const CONTROL_ACTION_BY_ID = new Map(CONTROL_ACTIONS.map((item) => [item.id, item]));
let adminIndexesPromise = null;

function ensureAdminIndexes(db) {
  if (!adminIndexesPromise) {
    adminIndexesPromise = Promise.all([
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
      db.collection("presence").createIndex({ userId: 1, lastSeenAt: -1 }),
      db.collection("privacyConsentEvents").createIndex({ createdAt: -1 }),
      db.collection("privacyConsentEvents").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("privacyConsentEvents").createIndex({ identityHash: 1, createdAt: -1 }),
      db.collection("privacyConsentEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("communityIncidents").createIndex({ signalKey: 1 }, { unique: true }),
      db.collection("communityIncidents").createIndex({ status: 1, updatedAt: -1 }),
      db.collection("communityQueueJobs").createIndex({ status: 1, updatedAt: -1 }),
      db.collection("communityCustomAdminRoles").createIndex({ key: 1 }, { unique: true }),
      db.collection("communityPrivilegeActivations").createIndex({ adminId: 1, expiresAt: -1 }),
      db.collection("communityPrivilegeActivations").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("communityApprovalRequests").createIndex({ status: 1, createdAt: -1 }),
      db.collection("communityApprovalRequests").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("communityControlPolicies").createIndex({ key: 1 }, { unique: true })
    ]).catch((error) => {
      adminIndexesPromise = null;
      throw error;
    });
  }
  return adminIndexesPromise;
}

function idOf(value) {
  try { return new ObjectId(String(value || "")); } catch { return null; }
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskedEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 1)}${name.length > 1 ? "***" : ""}@${domain}`;
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

function isPrivilegedAdmin(user) {
  return isOwnerUser(user) || ["owner", "super_admin"].includes(highestRole(user));
}

function recentGoogleVerification(user, now = new Date()) {
  const provider = clean(user?.lastProvider || user?.provider, 40).toLowerCase();
  const verifiedAt = new Date(user?.googleVerifiedAt || 0);
  const ageMs = now.getTime() - verifiedAt.getTime();
  return provider === "google" && !Number.isNaN(verifiedAt.getTime()) && ageMs >= 0 && ageMs <= 30 * 60 * 1000;
}

async function privilegeState(db, admin, now = new Date()) {
  const activation = await db.collection("communityPrivilegeActivations").findOne({
    adminId: admin._id,
    status: "active",
    expiresAt: { $gt: now }
  }, { sort: { expiresAt: -1 } });
  const expiresAt = activation?.expiresAt || null;
  return {
    active: Boolean(activation),
    tier: activation?.tier || "standing",
    activatedAt: activation?.activatedAt || null,
    expiresAt,
    minutesRemaining: expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000)) : 0,
    googleReauthRecent: recentGoogleVerification(admin, now),
    allowedDurations: [...PRIVILEGE_DURATIONS],
    requiresReason: true
  };
}

async function requireElevation(db, admin) {
  const state = await privilegeState(db, admin);
  if (!state.active) {
    const error = new Error("Hãy kích hoạt quyền nâng cao tạm thời trước khi thực hiện thao tác này.");
    error.statusCode = 403;
    error.code = "ADMIN_ELEVATION_REQUIRED";
    throw error;
  }
  return state;
}

function adapterStates() {
  return {
    internal: { connected: true, label: "HH control plane" },
    mongodb: { connected: Boolean(process.env.MONGODB_URI), label: "MongoDB Atlas" },
    payos: { connected: envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"), label: "PayOS" },
    "payos-refund": { connected: Boolean(process.env.PAYOS_REFUND_STATUS_URL && process.env.PAYOS_REFUND_ADAPTER_SECRET), label: "PayOS refund adapter" },
    vercel: { connected: Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID), label: "Vercel API" },
    cloudflare: { connected: Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID), label: "Cloudflare API" },
    manual: { connected: false, label: "Runbook thủ công" }
  };
}

function controlCapabilities(admin) {
  const adapters = adapterStates();
  return CONTROL_ACTIONS.map((item) => ({
    ...item,
    allowed: hasPermission(admin, item.permission),
    connected: Boolean(adapters[item.adapter]?.connected),
    adapterLabel: adapters[item.adapter]?.label || item.adapter,
    execution: item.tier === "critical" ? "two-person-approval" : "temporary-elevation"
  }));
}

function safeControlInput(body = {}) {
  const target = clean(body.target, 160);
  const value = typeof body.value === "boolean" || typeof body.value === "number"
    ? body.value
    : clean(body.value, 240);
  return {
    target,
    value,
    note: clean(body.note, 500)
  };
}

function presentApproval(item = {}) {
  return {
    id: String(item._id || ""),
    actionId: clean(item.actionId, 100),
    label: clean(item.label, 180),
    group: clean(item.group, 80),
    tier: clean(item.tier, 30),
    status: clean(item.status, 40),
    requestedBy: { id: String(item.requestedBy?.id || ""), email: clean(item.requestedBy?.email, 180), name: clean(item.requestedBy?.name, 120) },
    approvals: Array.isArray(item.approvals) ? item.approvals.slice(0, 4).map((approval) => ({ id: String(approval.id || ""), email: clean(approval.email, 180), at: approval.at || null })) : [],
    requiredApprovals: Math.max(2, Number(item.requiredApprovals || 2)),
    input: safeControlInput(item.input),
    reason: clean(item.reason, 1000),
    result: item.result && typeof item.result === "object" ? {
      status: clean(item.result.status, 60),
      detail: clean(item.result.detail, 500),
      affected: Math.max(0, Number(item.result.affected || 0))
    } : null,
    createdAt: item.createdAt || null,
    expiresAt: item.expiresAt || null,
    completedAt: item.completedAt || null
  };
}

function approvalForAdmin(item, admin) {
  return {
    ...presentApproval(item),
    canApprove: item.status === "pending"
      && isPrivilegedAdmin(admin)
      && !(item.approvals || []).some((approval) => String(approval.id) === String(admin._id))
  };
}

async function executeControlAction(db, admin, capability, input, now = new Date()) {
  const adapter = adapterStates()[capability.adapter] || { connected: false, label: capability.adapter };
  if (!adapter.connected) return { status: "approved_waiting_adapter", detail: `${adapter.label} chưa được kết nối; yêu cầu đã được phê duyệt nhưng chưa chạy.`, affected: 0 };
  if (capability.id === "security.logout-all") {
    const [sessions, users] = await Promise.all([
      db.collection("authSessions").updateMany({ revokedAt: null }, { $set: { revokedAt: now, revokeReason: "admin-global-revoke", revokedBy: admin._id } }),
      db.collection("users").updateMany({ status: { $nin: ["deleted", "banned"] } }, { $inc: { tokenVersion: 1 }, $set: { sessionsRevokedAt: now } })
    ]);
    return { status: "executed", detail: "Đã thu hồi toàn bộ phiên đăng nhập hợp lệ.", affected: Number(sessions.modifiedCount || 0) + Number(users.modifiedCount || 0) };
  }
  if (capability.id === "database.indexes") {
    const indexes = await db.collection("users").indexes();
    return { status: "executed", detail: `Đã kiểm tra ${indexes.length} index trên collection users.`, affected: indexes.length };
  }
  const policyKeys = {
    "platform.maintenance": "maintenance.mode",
    "platform.webhook": `webhook.${input.target || "default"}`,
    "security.rate-limit": `rate-limit.${input.target || "global"}`,
    "payos.lock": "payments.locked",
    "ai.provider": `ai.provider.${input.target || "default"}.enabled`,
    "ai.budget": `ai.budget.${input.target || "global"}`,
    "ai.fallback": "ai.provider.fallback",
    "content.lock-publishing": "content.publishing.locked",
    "observability.slo": `observability.slo.${input.target || "platform"}`,
    "observability.alert": `observability.alert.${input.target || "default"}`
  };
  const key = policyKeys[capability.id];
  if (key) {
    await db.collection("communityControlPolicies").updateOne(
      { key },
      { $set: { key, value: input.value, note: input.note, updatedAt: now, updatedBy: admin._id }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    return { status: "policy_recorded", detail: "Chính sách đã được lưu trong HH control plane và ghi audit.", affected: 1 };
  }
  return { status: "approved_waiting_adapter", detail: `${adapter.label} cần runbook thực thi riêng; không có thay đổi giả lập.`, affected: 0 };
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

function envReady(...names) {
  return names.every((name) => Boolean(String(process.env[name] || "").trim()));
}

function statusFromCount(count, warningAt = 1, criticalAt = 10) {
  const value = Number(count || 0);
  return value >= criticalAt ? "critical" : value >= warningAt ? "warning" : "operational";
}

function safeIncident(item = {}) {
  return {
    signalKey: clean(item.signalKey, 100),
    title: clean(item.title, 180),
    description: clean(item.description, 500),
    severity: ["critical", "high", "medium", "low"].includes(item.severity) ? item.severity : "low",
    source: clean(item.source || "system", 80),
    targetType: clean(item.targetType || "system", 80),
    targetId: clean(item.targetId || "platform", 160),
    suggestedAction: clean(item.suggestedAction, 500),
    metric: Math.max(0, Number(item.metric || 0)),
    status: INCIDENT_STATUSES.has(item.status) ? item.status : "new",
    assignee: clean(item.assignee, 180),
    resolution: clean(item.resolution, 1000),
    detectedAt: item.detectedAt || item.createdAt || null,
    updatedAt: item.updatedAt || null,
    timeline: Array.isArray(item.timeline) ? item.timeline.slice(-20).map((entry) => ({
      status: INCIDENT_STATUSES.has(entry.status) ? entry.status : "new",
      note: clean(entry.note, 500),
      admin: clean(entry.admin, 180),
      at: entry.at || null
    })) : []
  };
}

async function detectedFindings(db, now = new Date()) {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [failedLogins, failedJobs, staleReports, paymentErrors, apiErrors] = await Promise.all([
    db.collection("loginEvents").countDocuments({ success: false, createdAt: { $gte: dayAgo } }),
    db.collection("communityQueueJobs").countDocuments({ status: "failed" }),
    db.collection("communityReports").countDocuments({ status: { $in: ["pending", "escalated"] }, createdAt: { $lt: dayAgo } }),
    db.collection("donations").countDocuments({ status: "payment_error", updatedAt: { $gte: dayAgo } }),
    db.collection("events").countDocuments({ type: { $regex: /error|failure|exception/i }, createdAt: { $gte: hourAgo } })
  ]);
  const findings = [];
  const add = (condition, finding) => { if (condition) findings.push({ ...finding, status: "new", assignee: "", resolution: "", detectedAt: now, updatedAt: now, timeline: [] }); };
  add(failedLogins >= 5, {
    signalKey: "auth.failed-logins",
    title: "Nhiều lần đăng nhập thất bại",
    description: `${failedLogins} lần đăng nhập thất bại trong 24 giờ.`,
    severity: failedLogins >= 20 ? "critical" : "high",
    source: "Authentication",
    targetType: "auth",
    targetId: "login-events",
    metric: failedLogins,
    suggestedAction: "Kiểm tra thiết bị, trình duyệt và tài khoản liên quan; thu hồi phiên nếu phát hiện bất thường."
  });
  add(failedJobs > 0, {
    signalKey: "queue.failed-jobs",
    title: "Background job đang thất bại",
    description: `${failedJobs} tác vụ cần Retry, Cancel hoặc điều tra provider.`,
    severity: failedJobs >= 5 ? "high" : "medium",
    source: "Queue",
    targetType: "queue",
    targetId: "communityQueueJobs",
    metric: failedJobs,
    suggestedAction: "Mở Platform & Release, xem lỗi đã làm sạch rồi retry từng tác vụ."
  });
  add(staleReports > 0, {
    signalKey: "trust.report-sla",
    title: "Báo cáo sắp hoặc đã quá SLA",
    description: `${staleReports} báo cáo chưa được xử lý sau 24 giờ.`,
    severity: staleReports >= 10 ? "high" : "medium",
    source: "Content & Trust",
    targetType: "report",
    targetId: "communityReports",
    metric: staleReports,
    suggestedAction: "Phân công người xử lý và ghi rõ kết luận trong audit log."
  });
  add(paymentErrors > 0, {
    signalKey: "payos.payment-errors",
    title: "Giao dịch PayOS cần đối soát",
    description: `${paymentErrors} giao dịch phát sinh lỗi thanh toán trong 24 giờ.`,
    severity: "high",
    source: "PayOS",
    targetType: "payment",
    targetId: "donations",
    metric: paymentErrors,
    suggestedAction: "Kiểm tra webhook, orderCode và trạng thái trên payOS; không sửa giao dịch khi chưa đối chiếu provider."
  });
  add(apiErrors > 0, {
    signalKey: "api.recent-errors",
    title: "API ghi nhận lỗi gần đây",
    description: `${apiErrors} sự kiện lỗi trong 60 phút.`,
    severity: apiErrors >= 10 ? "high" : "medium",
    source: "API",
    targetType: "service",
    targetId: "api",
    metric: apiErrors,
    suggestedAction: "Mở log liên quan, kiểm tra deployment gần nhất và provider đang suy giảm."
  });

  const configurationFindings = [
    ["config.google-oauth", "Google OAuth chưa đủ cấu hình", "Authentication", "high", envReady("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), "Bổ sung GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên môi trường triển khai."],
    ["config.admin-allowlist", "Danh sách Super Admin chưa được cấu hình", "Identity & Access", "critical", adminEmails().size + adminUserIds().size > 0, "Cấu hình ADMIN_EMAILS hoặc ADMIN_USER_IDS trên server."],
    ["config.captcha", "Adaptive CAPTCHA chưa được kết nối", "Security", "medium", envReady("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"), "Kết nối Cloudflare Turnstile để giảm brute-force."],
    ["config.payos", "PayOS webhook chưa sẵn sàng", "PayOS", "medium", envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"), "Cấu hình đủ ba khóa payOS và URL webhook production."],
    ["config.storage", "Object storage chưa được kết nối", "Storage", "low", Boolean(process.env.BLOB_READ_WRITE_TOKEN || envReady("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")), "Kết nối Vercel Blob hoặc S3/R2 cho media dung lượng lớn."]
  ];
  configurationFindings.forEach(([signalKey, title, source, severity, configured, suggestedAction]) => add(!configured, {
    signalKey,
    title,
    description: "Kiểm tra cấu hình runtime cho production.",
    severity,
    source,
    targetType: "configuration",
    targetId: signalKey.replace("config.", ""),
    metric: 1,
    suggestedAction
  }));

  const signalKeys = findings.map((item) => item.signalKey);
  const overrides = signalKeys.length
    ? await db.collection("communityIncidents").find({ signalKey: { $in: signalKeys } }).toArray()
    : [];
  const overrideByKey = new Map(overrides.map((item) => [item.signalKey, item]));
  return findings.map((finding) => safeIncident({ ...finding, ...(overrideByKey.get(finding.signalKey) || {}), title: finding.title, description: finding.description, severity: finding.severity, source: finding.source, targetType: finding.targetType, targetId: finding.targetId, suggestedAction: finding.suggestedAction, metric: finding.metric, detectedAt: finding.detectedAt }));
}

function runtimeServices({ databaseLatencyMs = 0, failedJobs = 0 } = {}) {
  const objectStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN || envReady("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"));
  return [
    { id: "frontend", name: "Frontend", detail: process.env.VERCEL_ENV ? `Vercel ${process.env.VERCEL_ENV}` : "Static application", status: "operational", latencyMs: 0 },
    { id: "api", name: "Serverless API", detail: "API nội bộ phản hồi", status: "operational", latencyMs: 0 },
    { id: "database", name: "MongoDB", detail: `${Math.max(0, Number(databaseLatencyMs || 0))} ms`, status: Number(databaseLatencyMs || 0) > 800 ? "warning" : "operational", latencyMs: Math.max(0, Number(databaseLatencyMs || 0)) },
    { id: "auth", name: "Google Authentication", detail: envReady("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") ? "OAuth đã cấu hình" : "Thiếu cấu hình", status: envReady("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") ? "operational" : "critical", latencyMs: 0 },
    { id: "storage", name: "Object Storage", detail: objectStorage ? "Kho file lớn đã kết nối" : "Đang dùng MongoDB cho dữ liệu nhỏ", status: objectStorage ? "operational" : "warning", latencyMs: 0 },
    { id: "queue", name: "Background Queue", detail: failedJobs ? `${failedJobs} tác vụ lỗi` : "Không có tác vụ lỗi", status: statusFromCount(failedJobs, 1, 5), latencyMs: 0 },
    { id: "cron", name: "Cron Scheduler", detail: process.env.CRON_SECRET ? "Đã bảo vệ bằng secret" : "Chưa xác nhận cấu hình", status: process.env.CRON_SECRET ? "operational" : "warning", latencyMs: 0 },
    { id: "payos", name: "PayOS Webhook", detail: envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY") ? "VietQR sẵn sàng" : "Thiếu cấu hình", status: envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY") ? "operational" : "warning", latencyMs: 0 }
  ];
}

function pageParams(query) {
  const limit = Math.max(10, Math.min(100, Number(query.limit || 30)));
  const page = Math.max(1, Math.min(10000, Number(query.page || 1)));
  return { limit, page, skip: (page - 1) * limit };
}

async function assertTargetAllowed(admin, target) {
  const actorRole = highestRole(admin);
  const targetRole = highestRole(target);
  const actorRank = ROLE_RANK[actorRole] || (String(actorRole).startsWith("custom:") ? 15 : 0);
  const targetRank = ROLE_RANK[targetRole] || (String(targetRole).startsWith("custom:") ? 15 : 0);
  if (targetRank > 0 && actorRank <= targetRank) {
    const error = new Error("Bạn không thể quản trị tài khoản có quyền ngang hoặc cao hơn mình.");
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

    if (req.method === "GET" && view === "me") {
      return res.status(200).json({ ok: true, access, privilege: await privilegeState(db, admin), user: presentUser(admin), privacy: { privateMessagesVisibleToAdmin: false, passwordsVisibleToAdmin: false } });
    }

    // Index creation is initialization work. Do not block every read-only
    // admin screen on repeated createIndex round trips.
    const indexesReady = ensureAdminIndexes(db);
    if (req.method !== "GET") await indexesReady;
    else indexesReady.catch((error) => console.error("Admin index initialization failed", error?.message || error));

    if (req.method === "GET" && view === "mission") {
      requirePermission(admin, "dashboard.view");
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const presenceSince = new Date(now.getTime() - 2 * 60 * 1000);
      const databaseStartedAt = Date.now();
      await db.command({ ping: 1 });
      const databaseLatencyMs = Date.now() - databaseStartedAt;
      const [findings, totalUsers, onlineVisitors, pendingReports, pendingAppeals, failedJobs, pendingJobs, recentChanges] = await Promise.all([
        detectedFindings(db, now),
        db.collection("users").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("presence").countDocuments({ lastSeenAt: { $gte: presenceSince } }),
        db.collection("communityReports").countDocuments({ status: { $in: ["pending", "escalated"] } }),
        db.collection("communityAppeals").countDocuments({ status: { $in: ["pending", "escalated"] } }),
        db.collection("communityQueueJobs").countDocuments({ status: "failed" }),
        db.collection("communityQueueJobs").countDocuments({ status: { $in: ["queued", "running", "paused"] } }),
        db.collection("communityAdminAuditLogs").find({}, { projection: { action: 1, targetType: 1, targetId: 1, admin: 1, reason: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(8).toArray()
      ]);
      const services = runtimeServices({ databaseLatencyMs, failedJobs });
      const openFindings = findings.filter((item) => item.status !== "resolved");
      const severityWeight = { critical: 24, high: 14, medium: 7, low: 3 };
      const servicePenalty = services.reduce((sum, item) => sum + (item.status === "critical" ? 12 : item.status === "warning" ? 4 : 0), 0);
      const healthScore = Math.max(0, Math.min(100, 100 - servicePenalty - openFindings.reduce((sum, item) => sum + (severityWeight[item.severity] || 0), 0)));
      const targetView = (finding) => finding.source === "Content & Trust" ? "trust" : finding.source === "Queue" ? "platform" : finding.source === "PayOS" ? "growth" : "security";
      const actionQueue = openFindings
        .sort((left, right) => (severityWeight[right.severity] || 0) - (severityWeight[left.severity] || 0))
        .slice(0, 12)
        .map((finding) => ({
          id: finding.signalKey,
          title: finding.title,
          description: finding.suggestedAction,
          severity: finding.severity,
          source: finding.source,
          status: finding.status,
          assignee: finding.assignee,
          targetView: targetView(finding)
        }));
      return res.status(200).json({
        ok: true,
        access,
        privilege: await privilegeState(db, admin, now),
        healthScore,
        generatedAt: now,
        metrics: {
          totalUsers,
          onlineVisitors,
          openIncidents: openFindings.length,
          criticalIncidents: openFindings.filter((item) => item.severity === "critical").length,
          pendingTrust: pendingReports + pendingAppeals,
          pendingJobs,
          failedJobs
        },
        services,
        actionQueue,
        continueIncident: actionQueue[0] || null,
        recentChanges: recentChanges.map((item) => ({
          id: String(item._id),
          action: clean(item.action, 100),
          targetType: clean(item.targetType, 80),
          targetId: clean(item.targetId, 160),
          admin: clean(item.admin?.name || item.admin?.email || "Admin", 180),
          reason: clean(item.reason, 300),
          createdAt: item.createdAt || null
        })),
        deployment: {
          provider: process.env.VERCEL ? "Vercel" : "Local/Custom",
          environment: clean(process.env.VERCEL_ENV || "production", 40),
          commitSha: clean(process.env.VERCEL_GIT_COMMIT_SHA, 80),
          commitMessage: clean(process.env.VERCEL_GIT_COMMIT_MESSAGE, 240),
          url: clean(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL, 300)
        },
        privacy: { secretsReturned: false, rawLogsReturned: false, privateMessagesReturned: false }
      });
    }

    if (req.method === "GET" && view === "identity") {
      requirePermission(admin, "users.view");
      const now = new Date();
      const [users, totalUsers, activeSessions, customRoles, pendingApprovals, lastAccessReview] = await Promise.all([
        db.collection("users").find({ status: { $ne: "deleted" } }, { projection: USER_PROJECTION }).sort({ lastLoginAt: -1, createdAt: -1 }).limit(12).toArray(),
        db.collection("users").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("authSessions").countDocuments({ revokedAt: null, expiresAt: { $gt: now } }),
        db.collection("communityCustomAdminRoles").find({}, { projection: { key: 1, name: 1, description: 1, permissions: 1, updatedAt: 1 } }).sort({ name: 1 }).limit(100).toArray(),
        db.collection("communityApprovalRequests").find({ status: "pending", expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(20).toArray(),
        db.collection("communityAccessReviews").findOne({}, { sort: { completedAt: -1 } })
      ]);
      const roleLabels = {
        owner: "Super Admin (Owner)",
        super_admin: "Super Admin",
        admin: "Administrator",
        security_admin: "Security Admin",
        release_manager: "Release Manager",
        content_moderator: "Content Moderator",
        moderator: "Moderator",
        support: "Support",
        analyst: "Analyst"
      };
      return res.status(200).json({
        ok: true,
        metrics: {
          totalUsers,
          activeSessions,
          administrators: await db.collection("users").countDocuments({ systemRoles: { $in: [...ALLOWED_ROLES] } }),
          lockedAccounts: await db.collection("users").countDocuments({ status: { $in: ["locked", "suspended", "banned"] } })
        },
        users: users.map(presentUser),
        privilege: await privilegeState(db, admin, now),
        roles: Object.entries(ROLE_PERMISSIONS).map(([id, permissions]) => ({
          id,
          label: roleLabels[id] || id,
          permissions: permissions.slice(),
          permissionCount: permissions.includes("*") ? "all" : permissions.length
        })),
        customRoles: customRoles.map((item) => ({
          id: String(item._id),
          key: clean(item.key, 40),
          name: clean(item.name, 120),
          description: clean(item.description, 500),
          permissions: normalizePermissions(item.permissions),
          simulation: simulatePermissions([], item.permissions),
          updatedAt: item.updatedAt || null
        })),
        permissionCatalog: PERMISSION_CATALOG,
        pendingApprovals: pendingApprovals.map((item) => approvalForAdmin(item, admin)),
        accessReview: {
          lastCompletedAt: lastAccessReview?.completedAt || null,
          nextDueAt: lastAccessReview?.completedAt ? new Date(new Date(lastAccessReview.completedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : now,
          due: !lastAccessReview || new Date(lastAccessReview.completedAt).getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000,
          customRoleCount: customRoles.length
        },
        policy: {
          ownerSource: "server-environment",
          googleVerificationRequired: true,
          ownerCount: adminEmails().size + adminUserIds().size,
          equalOrHigherRoleProtection: true,
          reasonRequiredForSensitiveActions: true,
          temporaryElevationMinutes: [...PRIVILEGE_DURATIONS],
          criticalActionApprovals: 2,
          immutableAuditChain: true
        }
      });
    }

    if (req.method === "GET" && view === "control-plane") {
      requirePermission(admin, "dashboard.view");
      const now = new Date();
      const [approvals, policies, databaseCollections] = await Promise.all([
        db.collection("communityApprovalRequests").find({ status: { $in: ["pending", "approved_waiting_adapter"] }, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(30).toArray(),
        db.collection("communityControlPolicies").find({}, { projection: { key: 1, value: 1, note: 1, updatedAt: 1 } }).sort({ key: 1 }).limit(100).toArray(),
        db.listCollections({}, { nameOnly: true }).toArray()
      ]);
      const adapters = adapterStates();
      return res.status(200).json({
        ok: true,
        access,
        privilege: await privilegeState(db, admin, now),
        capabilities: controlCapabilities(admin),
        adapters: Object.entries(adapters).map(([id, item]) => ({ id, ...item })),
        approvals: approvals.map((item) => approvalForAdmin(item, admin)),
        policies: policies.map((item) => ({ id: String(item._id), key: clean(item.key, 120), value: typeof item.value === "string" ? clean(item.value, 240) : item.value, note: clean(item.note, 500), updatedAt: item.updatedAt || null })),
        infrastructure: {
          services: runtimeServices(),
          databaseCollections: databaseCollections.length,
          productionDomain: clean(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "hoang8.com", 300),
          environment: clean(process.env.VERCEL_ENV || "production", 40)
        },
        privacy: { secretsReturned: false, tokensReturned: false, privateDataReturned: false }
      });
    }

    if (req.method === "GET" && view === "incidents") {
      requirePermission(admin, "incidents.view");
      const findings = await detectedFindings(db, new Date());
      return res.status(200).json({
        ok: true,
        findings,
        summary: {
          total: findings.length,
          critical: findings.filter((item) => item.severity === "critical" && item.status !== "resolved").length,
          high: findings.filter((item) => item.severity === "high" && item.status !== "resolved").length,
          medium: findings.filter((item) => item.severity === "medium" && item.status !== "resolved").length,
          low: findings.filter((item) => item.severity === "low" && item.status !== "resolved").length,
          investigating: findings.filter((item) => item.status === "investigating").length,
          resolved: findings.filter((item) => item.status === "resolved").length
        },
        severityOrder: ["critical", "high", "medium", "low"],
        workflow: ["new", "investigating", "mitigated", "resolved"],
        privacy: { evidenceSanitized: true, secretsReturned: false, rawIpReturned: false }
      });
    }

    if (req.method === "GET" && view === "platform") {
      requirePermission(admin, "platform.view");
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const databaseStartedAt = Date.now();
      await db.command({ ping: 1 });
      const databaseLatencyMs = Date.now() - databaseStartedAt;
      const [jobs, flags, gatewayUsage, failedJobs] = await Promise.all([
        db.collection("communityQueueJobs").find({}, { projection: { payload: 0, secret: 0, token: 0 } }).sort({ updatedAt: -1, createdAt: -1 }).limit(60).toArray(),
        db.collection("communityFeatureFlags").find({}, { projection: { key: 1, enabled: 1, rollout: 1, description: 1, updatedAt: 1 } }).sort({ key: 1 }).toArray(),
        db.collection("gatewayAuditLogs").aggregate([
          { $match: { createdAt: { $gte: dayAgo } } },
          { $group: { _id: { provider: "$provider", outcome: "$outcome" }, requests: { $sum: 1 }, units: { $sum: "$cost" } } },
          { $project: { _id: 0, provider: "$_id.provider", outcome: "$_id.outcome", requests: 1, units: 1 } },
          { $sort: { provider: 1, outcome: 1 } }
        ]).toArray(),
        db.collection("communityQueueJobs").countDocuments({ status: "failed" })
      ]);
      const services = runtimeServices({ databaseLatencyMs, failedJobs });
      const providerState = (configured, detail) => ({ configured: Boolean(configured), status: configured ? "operational" : "not-configured", detail });
      return res.status(200).json({
        ok: true,
        privilege: await privilegeState(db, admin, now),
        generatedAt: now,
        services,
        deployment: {
          provider: process.env.VERCEL ? "Vercel" : "Local/Custom",
          environment: clean(process.env.VERCEL_ENV || "production", 40),
          region: clean(process.env.VERCEL_REGION, 40),
          commitSha: clean(process.env.VERCEL_GIT_COMMIT_SHA, 80),
          commitMessage: clean(process.env.VERCEL_GIT_COMMIT_MESSAGE, 240),
          productionUrl: clean(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL, 300)
        },
        providers: {
          payos: providerState(envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"), "VietQR và webhook"),
          googleOAuth: providerState(envReady("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), "Đăng nhập Google"),
          email: providerState(envReady("RESEND_API_KEY", "EMAIL_FROM"), "Email giao dịch"),
          youtube: providerState(Boolean(process.env.YOUTUBE_API_KEY), "YouTube Data API"),
          openai: providerState(Boolean(process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY), "OpenAI Responses API"),
          gemini: providerState(Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY), "Google AI"),
          objectStorage: providerState(Boolean(process.env.BLOB_READ_WRITE_TOKEN || envReady("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")), "Vercel Blob hoặc S3/R2")
        },
        jobs: jobs.map((item) => ({
          id: String(item._id),
          type: clean(item.type || item.kind || "background-job", 100),
          status: clean(item.status || "queued", 30),
          provider: clean(item.provider || "internal", 80),
          attempts: Math.max(0, Number(item.attempts || 0)),
          progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
          sanitizedError: clean(item.sanitizedError || item.errorCode, 240),
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null
        })),
        flags: flags.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        gatewayUsage,
        capabilities: {
          pause: true,
          retry: true,
          cancel: true,
          duplicate: true,
          rollbackRequiresGoogleReauthentication: true,
          rootControls: controlCapabilities(admin).filter((item) => ["Platform", "Database", "AI Providers", "PayOS"].includes(item.group))
        },
        privacy: { jobPayloadsReturned: false, providerSecretsReturned: false }
      });
    }

    if (req.method === "GET" && view === "growth") {
      requirePermission(admin, "growth.view");
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const onlineSince = new Date(now.getTime() - 2 * 60 * 1000);
      const [online, totalUsers, newUsers7d, events30d, pageViews30d, formStarts30d, formSubmits30d, conversions30d, topRoutes, userCohorts, paymentSummary, aiUsage] = await Promise.all([
        db.collection("presence").countDocuments({ lastSeenAt: { $gte: onlineSince } }),
        db.collection("users").countDocuments({ status: { $ne: "deleted" } }),
        db.collection("users").countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: "deleted" } }),
        db.collection("telemetryEvents").countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        db.collection("telemetryEvents").countDocuments({ type: "page_view", createdAt: { $gte: thirtyDaysAgo } }),
        db.collection("telemetryEvents").countDocuments({ type: "form_start", createdAt: { $gte: thirtyDaysAgo } }),
        db.collection("telemetryEvents").countDocuments({ type: "form_submit", createdAt: { $gte: thirtyDaysAgo } }),
        db.collection("telemetryEvents").countDocuments({ type: { $in: ["conversion", "experiment_conversion"] }, createdAt: { $gte: thirtyDaysAgo } }),
        db.collection("telemetryEvents").aggregate([
          { $match: { type: "page_view", createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: "$route", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray(),
        db.collection("users").aggregate([
          { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $ne: "deleted" } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]).toArray(),
        db.collection("donations").aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
          { $sort: { _id: 1 } }
        ]).toArray(),
        db.collection("gatewayAuditLogs").aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: "$provider", requests: { $sum: 1 }, units: { $sum: "$cost" }, failures: { $sum: { $cond: [{ $eq: ["$outcome", "error"] }, 1, 0] } } } },
          { $sort: { requests: -1 } }
        ]).toArray()
      ]);
      const submitRate = formStarts30d ? Math.round(formSubmits30d / formStarts30d * 1000) / 10 : 0;
      return res.status(200).json({
        ok: true,
        generatedAt: now,
        metrics: { online, totalUsers, newUsers7d, events30d, pageViews30d, formStarts30d, formSubmits30d, conversions30d, submitRate },
        funnel: [
          { id: "page_view", label: "Lượt xem", value: pageViews30d },
          { id: "form_start", label: "Bắt đầu biểu mẫu", value: formStarts30d },
          { id: "form_submit", label: "Gửi thành công", value: formSubmits30d },
          { id: "conversion", label: "Chuyển đổi", value: conversions30d }
        ],
        topRoutes: topRoutes.map((item) => ({ name: clean(item._id || "/", 200), count: Number(item.count || 0) })),
        cohorts: userCohorts.map((item) => ({ date: clean(item._id, 20), users: Number(item.count || 0) })),
        payments: {
          configured: envReady("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"),
          byStatus: paymentSummary.map((item) => ({ status: clean(item._id || "unknown", 30), count: Number(item.count || 0), amount: Number(item.amount || 0) })),
          privateFieldsReturned: false
        },
        aiUsage: aiUsage.map((item) => ({ provider: clean(item._id || "unknown", 80), requests: Number(item.requests || 0), units: Number(item.units || 0), failures: Number(item.failures || 0) })),
        searchConsole: {
          configured: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SEARCH_CONSOLE_TOKEN)),
          property: clean(process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY, 240),
          note: process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY ? "Property đã khai báo; cần adapter hợp lệ để đồng bộ số liệu." : "Chưa kết nối Search Console."
        },
        privacy: { aggregateOnly: true, identitiesReturned: false, paymentDetailsReturned: false, rawPromptsReturned: false }
      });
    }

    if (req.method === "GET" && view === "privacy") {
      requirePermission(admin, "privacy.view");
      const now = new Date();
      const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const consent = db.collection("privacyConsentEvents");
      const [total, analytics, personalization, denied, recent] = await Promise.all([
        consent.countDocuments({ createdAt: { $gte: since30 } }),
        consent.countDocuments({ createdAt: { $gte: since30 }, "preferences.analytics": true }),
        consent.countDocuments({ createdAt: { $gte: since30 }, "preferences.personalization": true }),
        consent.countDocuments({ createdAt: { $gte: since30 }, "preferences.analytics": false, "preferences.personalization": false }),
        consent.find({ createdAt: { $gte: since30 } }).sort({ createdAt: -1 }).limit(60).toArray()
      ]);
      const userIds = recent.map((item) => item.userId).filter(Boolean);
      const users = userIds.length ? await db.collection("users").find({ _id: { $in: userIds } }, { projection: { email: 1 } }).toArray() : [];
      const usersById = new Map(users.map((user) => [String(user._id), user]));
      return res.status(200).json({
        ok: true,
        policyVersion: "privacy-v1-2026-07",
        metrics: { decisions30d: total, analyticsGranted30d: analytics, personalizationGranted30d: personalization, declinedOptional30d: denied },
        inventory: [
          { name: "hh_session", type: "Cookie", category: "Thiết yếu", purpose: "Phiên đăng nhập", readableByJavaScript: false, retention: "Tối đa 12 giờ" },
          { name: "hh-consent-preferences.v1", type: "Local storage", category: "Thiết yếu", purpose: "Nhớ lựa chọn quyền riêng tư", readableByJavaScript: true, retention: "Trên thiết bị" },
          { name: "hh-tracking-consent", type: "Local storage", category: "Phân tích", purpose: "Bật/tắt telemetry đã làm sạch", readableByJavaScript: true, retention: "Trên thiết bị" }
        ],
        recent: recent.map((item) => ({
          kind: item.kind === "registered" ? "registered" : "guest",
          subject: item.userId && usersById.get(String(item.userId)) ? maskedEmail(usersById.get(String(item.userId)).email) : `Khách ${String(item.identityHash || "").slice(-6) || "ẩn danh"}`,
          analytics: Boolean(item.preferences?.analytics), personalization: Boolean(item.preferences?.personalization), marketing: false,
          source: clean(item.source || "privacy-center", 40), createdAt: item.createdAt || null
        }))
      });
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
        access,
        metrics: { totalUsers, activeUsers, onlineVisitors: activeVisitors.length, onlineRegistered, newUsers, newPosts, newMessages, mediaUploads, pendingReports, lockedAccounts, groups, pages, events, marketplace, pendingJobs, failedJobs },
        system: { api: "operational", database: "operational", databaseLatencyMs, queue: failedJobs ? "degraded" : "operational", generatedAt: now },
        recentErrors,
        activeVisitors
      });
    }

    if (req.method === "GET" && view === "security") {
      requirePermission(admin, "security.view");
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [activeSessions, failedLogins24h, lockedAccounts, recentSecurityEvents, auditEvents7d] = await Promise.all([
        db.collection("authSessions").countDocuments({ revokedAt: null, expiresAt: { $gt: now } }),
        db.collection("loginEvents").countDocuments({ success: false, createdAt: { $gte: dayAgo } }),
        db.collection("users").countDocuments({ status: { $in: ["locked", "suspended", "banned"] } }),
        db.collection("loginEvents").find({}, { projection: { userId: 1, type: 1, success: 1, reason: 1, platform: 1, browser: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(30).toArray(),
        db.collection("communityAdminAuditLogs").countDocuments({ createdAt: { $gte: weekAgo } })
      ]);
      return res.status(200).json({
        ok: true,
        privilege: await privilegeState(db, admin, now),
        emergencyCapabilities: controlCapabilities(admin).filter((item) => item.group === "Security"),
        posture: {
          ownerAllowlistConfigured: adminEmails().size > 0 || adminUserIds().size > 0,
          ownerEmailCount: adminEmails().size,
          ownerIdCount: adminUserIds().size,
          jwtConfigured: String(process.env.JWT_SECRET || "").length >= 32,
          otpSecretConfigured: String(process.env.AUTH_OTP_SECRET || "").length >= 32,
          captchaConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY),
          securityEmailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
          passkeyConfigured: Boolean(process.env.PASSKEY_RP_ID && (process.env.PASSKEY_ORIGINS || process.env.PASSKEY_ORIGIN)),
          originPolicyConfigured: Boolean(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN)
        },
        metrics: { activeSessions, failedLogins24h, lockedAccounts, auditEvents7d },
        recentSecurityEvents: recentSecurityEvents.map((item) => ({ ...item, id: String(item._id), _id: undefined, userId: item.userId ? String(item.userId) : "" })),
        privacy: { passwordsVisibleToAdmin: false, privateMessagesVisibleToAdmin: false, secretsVisibleToAdmin: false },
        generatedAt: now
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
      const actor = clean(req.query.actor, 180);
      const actionFilter = clean(req.query.action, 100);
      const target = clean(req.query.target, 160);
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      const filter = {
        ...(q ? { $or: [{ action: { $regex: escapeRegex(q), $options: "i" } }, { targetId: { $regex: escapeRegex(q), $options: "i" } }, { "admin.email": { $regex: escapeRegex(q), $options: "i" } }] } : {}),
        ...(actor ? { "admin.email": { $regex: escapeRegex(actor), $options: "i" } } : {}),
        ...(actionFilter ? { action: { $regex: escapeRegex(actionFilter), $options: "i" } } : {}),
        ...(target ? { targetId: { $regex: escapeRegex(target), $options: "i" } } : {}),
        ...((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime())) ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { $gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { $lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } : {})
          }
        } : {})
      };
      const [items, total] = await Promise.all([
        db.collection("communityAdminAuditLogs").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        db.collection("communityAdminAuditLogs").countDocuments(filter)
      ]);
      return res.status(200).json({
        ok: true,
        items: items.map((item) => ({ ...item, id: String(item._id), _id: undefined })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        integrity: { mode: "sha256-chain-v1", chainedEntries: items.filter((item) => item.recordHash && item.previousHash).length, secretsIncluded: false }
      });
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

    if (action === "privilege:activate") {
      requirePermission(admin, "privileges.activate");
      if (!isPrivilegedAdmin(admin)) return res.status(403).json({ error: "Chỉ Super Admin được kích hoạt quyền nâng cao." });
      const reason = requiredReason(body);
      const durationMinutes = Number(body.durationMinutes || 30);
      if (!PRIVILEGE_DURATIONS.has(durationMinutes)) return res.status(400).json({ error: "Thời hạn nâng quyền chỉ được chọn 15, 30 hoặc 60 phút." });
      if (!recentGoogleVerification(admin)) {
        return res.status(403).json({
          error: "Cần đăng nhập lại bằng Google trong 30 phút gần nhất trước khi nâng quyền.",
          code: "GOOGLE_REAUTH_REQUIRED",
          reauthUrl: "/api/auth/google"
        });
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
      await db.collection("communityPrivilegeActivations").updateMany({ adminId: admin._id, status: "active" }, { $set: { status: "expired", endedAt: now } });
      const activation = {
        adminId: admin._id,
        tier: "elevated",
        reason,
        activatedAt: now,
        expiresAt,
        status: "active",
        googleVerifiedAt: admin.googleVerifiedAt || null,
        createdAt: now
      };
      await db.collection("communityPrivilegeActivations").insertOne(activation);
      await writeAdminAudit(db, req, admin, { action, targetType: "admin-privilege", targetId: String(admin._id), reason, before: { tier: "standing" }, after: { tier: "elevated", durationMinutes, expiresAt } });
      return res.status(200).json({ ok: true, privilege: await privilegeState(db, admin, now) });
    }

    if (action === "permission:simulate") {
      requirePermission(admin, "permissions.simulate");
      const simulation = simulatePermissions(body.currentPermissions, body.permissions);
      return res.status(200).json({ ok: true, simulation, catalog: PERMISSION_CATALOG, mutationPerformed: false });
    }

    if (action === "custom-role:save") {
      requirePermission(admin, "roles.custom.manage");
      await requireElevation(db, admin);
      const reason = requiredReason(body);
      const key = clean(body.key, 32).toLowerCase();
      if (!/^[a-z][a-z0-9_-]{2,31}$/.test(key)) return res.status(400).json({ error: "Mã vai trò phải gồm 3–32 ký tự chữ thường, số, gạch ngang hoặc gạch dưới." });
      const name = clean(body.name, 120);
      if (name.length < 3) return res.status(400).json({ error: "Tên vai trò cần ít nhất 3 ký tự." });
      const simulation = simulatePermissions([], [...(Array.isArray(body.permissions) ? body.permissions : []), "dashboard.view"]);
      if (!simulation.valid || simulation.selected.length === 0) return res.status(400).json({ error: "Danh sách quyền không hợp lệ hoặc đang trống.", simulation });
      const collection = db.collection("communityCustomAdminRoles");
      const before = await collection.findOne({ key });
      const now = new Date();
      const role = {
        key,
        roleId: `custom:${key}`,
        name,
        description: clean(body.description, 500),
        permissions: simulation.selected,
        riskScore: simulation.riskScore,
        updatedAt: now,
        updatedBy: admin._id
      };
      await collection.updateOne({ key }, { $set: role, $setOnInsert: { createdAt: now, createdBy: admin._id } }, { upsert: true });
      const after = await collection.findOne({ key });
      await writeAdminAudit(db, req, admin, { action, targetType: "custom-role", targetId: key, reason, before, after });
      return res.status(200).json({ ok: true, role: { ...role, id: String(after._id) }, simulation });
    }

    if (action === "access-review:complete") {
      requirePermission(admin, "audit.access-review");
      await requireElevation(db, admin);
      const reason = requiredReason(body);
      const now = new Date();
      const administrators = await db.collection("users").find({ $or: [{ systemRoles: { $exists: true, $ne: [] } }, { adminCustomPermissions: { $exists: true, $ne: [] } }] }, { projection: USER_PROJECTION }).toArray();
      const summary = {
        administratorCount: administrators.filter((user) => rolesFor(user).length > 0).length,
        customRoleAssignments: administrators.filter((user) => rolesFor(user).some((role) => role.startsWith("custom:"))).length,
        lockedAdministrators: administrators.filter((user) => ["locked", "suspended", "banned"].includes(user.status)).length
      };
      const result = await db.collection("communityAccessReviews").insertOne({ completedBy: admin._id, completedAt: now, reason, summary, createdAt: now });
      await writeAdminAudit(db, req, admin, { action, targetType: "access-review", targetId: String(result.insertedId), reason, before: null, after: summary });
      return res.status(200).json({ ok: true, summary, completedAt: now });
    }

    if (action === "control:execute") {
      const capability = CONTROL_ACTION_BY_ID.get(clean(body.actionId, 100));
      if (!capability) return res.status(400).json({ error: "Điều khiển Root Console không hợp lệ." });
      requirePermission(admin, capability.permission);
      if (capability.tier === "critical") return res.status(409).json({ error: "Thao tác tối quan trọng phải được tạo thành yêu cầu phê duyệt hai người.", code: "TWO_PERSON_APPROVAL_REQUIRED" });
      await requireElevation(db, admin);
      const reason = requiredReason(body);
      const input = safeControlInput(body);
      const now = new Date();
      const result = await executeControlAction(db, admin, capability, input, now);
      await writeAdminAudit(db, req, admin, { action: `${action}:${capability.id}`, targetType: "control-plane", targetId: input.target || capability.id, reason, before: null, after: { capability: capability.id, input, result } });
      return res.status(200).json({ ok: true, capability: capability.id, result });
    }

    if (action === "approval:request") {
      requirePermission(admin, "approvals.request");
      if (!isPrivilegedAdmin(admin)) return res.status(403).json({ error: "Chỉ Super Admin được tạo yêu cầu tối quan trọng." });
      await requireElevation(db, admin);
      const capability = CONTROL_ACTION_BY_ID.get(clean(body.actionId, 100));
      if (!capability || capability.tier !== "critical") return res.status(400).json({ error: "Hành động này không thuộc tầng phê duyệt kép." });
      requirePermission(admin, capability.permission);
      const reason = requiredReason(body);
      const input = safeControlInput(body);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const request = {
        actionId: capability.id,
        label: capability.label,
        group: capability.group,
        tier: capability.tier,
        adapter: capability.adapter,
        permission: capability.permission,
        input,
        reason,
        status: "pending",
        requestedBy: { id: admin._id, email: clean(admin.email, 180), name: clean(admin.name, 120) },
        approvals: [{ id: admin._id, email: clean(admin.email, 180), at: now }],
        requiredApprovals: 2,
        createdAt: now,
        expiresAt
      };
      const result = await db.collection("communityApprovalRequests").insertOne(request);
      await writeAdminAudit(db, req, admin, { action, targetType: "critical-request", targetId: String(result.insertedId), reason, before: null, after: { actionId: capability.id, approvals: 1, requiredApprovals: 2, input } });
      return res.status(201).json({ ok: true, approval: presentApproval({ ...request, _id: result.insertedId }) });
    }

    if (["approval:approve", "approval:reject"].includes(action)) {
      requirePermission(admin, "approvals.approve");
      if (!isPrivilegedAdmin(admin)) return res.status(403).json({ error: "Chỉ Super Admin được quyết định yêu cầu tối quan trọng." });
      await requireElevation(db, admin);
      const reason = requiredReason(body);
      const requestId = idOf(body.requestId);
      const collection = db.collection("communityApprovalRequests");
      const before = requestId ? await collection.findOne({ _id: requestId, status: "pending", expiresAt: { $gt: new Date() } }) : null;
      if (!before) return res.status(404).json({ error: "Yêu cầu không tồn tại, đã xử lý hoặc đã hết hạn." });
      if ((before.approvals || []).some((approval) => String(approval.id) === String(admin._id))) return res.status(409).json({ error: "Cần một Super Admin khác phê duyệt yêu cầu này." });
      const now = new Date();
      if (action === "approval:reject") {
        await collection.updateOne({ _id: requestId, status: "pending" }, { $set: { status: "rejected", rejectedAt: now, rejectedBy: admin._id, rejectionReason: reason } });
        const after = await collection.findOne({ _id: requestId });
        await writeAdminAudit(db, req, admin, { action, targetType: "critical-request", targetId: String(requestId), reason, before: presentApproval(before), after: presentApproval(after) });
        return res.status(200).json({ ok: true, approval: presentApproval(after) });
      }
      const capability = CONTROL_ACTION_BY_ID.get(before.actionId);
      if (!capability) return res.status(409).json({ error: "Capability của yêu cầu không còn hợp lệ." });
      const approvals = [...(before.approvals || []), { id: admin._id, email: clean(admin.email, 180), at: now }];
      const execution = approvals.length >= Number(before.requiredApprovals || 2)
        ? await executeControlAction(db, admin, capability, before.input || {}, now)
        : null;
      const status = execution?.status === "approved_waiting_adapter" ? "approved_waiting_adapter" : execution ? "executed" : "pending";
      await collection.updateOne({ _id: requestId, status: "pending" }, { $set: { approvals, status, result: execution, ...(execution ? { completedAt: now, completedBy: admin._id } : {}) } });
      const after = await collection.findOne({ _id: requestId });
      await writeAdminAudit(db, req, admin, { action, targetType: "critical-request", targetId: String(requestId), reason, before: presentApproval(before), after: presentApproval(after) });
      return res.status(200).json({ ok: true, approval: presentApproval(after) });
    }

    if (action === "incident:update") {
      requirePermission(admin, "incidents.manage");
      const signalKey = clean(body.signalKey, 100).toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.:-]{2,99}$/.test(signalKey)) return res.status(400).json({ error: "Mã incident không hợp lệ." });
      const status = clean(body.status, 30).toLowerCase();
      if (!INCIDENT_STATUSES.has(status)) return res.status(400).json({ error: "Trạng thái incident không hợp lệ." });
      const reason = requiredReason(body);
      const collection = db.collection("communityIncidents");
      const before = await collection.findOne({ signalKey });
      const now = new Date();
      const assignee = clean(body.assignee || admin.email, 180);
      const resolution = clean(body.resolution, 1000);
      const timelineEntry = { status, note: reason, admin: clean(admin.email, 180), at: now };
      await collection.updateOne(
        { signalKey },
        {
          $set: { signalKey, status, assignee, resolution, updatedAt: now, updatedBy: admin._id },
          $setOnInsert: { createdAt: now },
          $push: { timeline: { $each: [timelineEntry], $slice: -50 } }
        },
        { upsert: true }
      );
      const after = await collection.findOne({ signalKey });
      await writeAdminAudit(db, req, admin, { action, targetType: "incident", targetId: signalKey, reason, before, after });
      return res.status(200).json({ ok: true, incident: safeIncident(after) });
    }

    if (action === "queue-job:update") {
      requirePermission(admin, "platform.manage");
      const operation = clean(body.operation, 30).toLowerCase();
      if (!JOB_ACTIONS.has(operation)) return res.status(400).json({ error: "Thao tác queue không hợp lệ." });
      const jobId = idOf(body.jobId);
      const collection = db.collection("communityQueueJobs");
      const before = jobId ? await collection.findOne({ _id: jobId }, { projection: { payload: 0, secret: 0, token: 0 } }) : null;
      if (!before) return res.status(404).json({ error: "Không tìm thấy background job." });
      const reason = requiredReason(body);
      const now = new Date();
      let targetId = String(jobId);
      if (operation === "duplicate") {
        const duplicate = { ...before };
        delete duplicate._id;
        delete duplicate.error;
        delete duplicate.sanitizedError;
        duplicate.status = "queued";
        duplicate.progress = 0;
        duplicate.attempts = 0;
        duplicate.sourceJobId = jobId;
        duplicate.createdAt = now;
        duplicate.updatedAt = now;
        duplicate.adminReason = reason;
        const result = await collection.insertOne(duplicate);
        targetId = String(result.insertedId);
      } else {
        const status = operation === "pause" ? "paused" : operation === "cancel" ? "cancelled" : "queued";
        const update = {
          $set: {
            status,
            updatedAt: now,
            adminReason: reason,
            adminOperation: operation,
            ...(operation === "retry" ? { progress: 0, retryRequestedAt: now } : {}),
            ...(operation === "cancel" ? { cancelledAt: now } : {}),
            ...(operation === "pause" ? { pausedAt: now } : {})
          },
          ...(operation === "retry" ? { $inc: { attempts: 1 } } : {})
        };
        await collection.updateOne({ _id: jobId }, update);
      }
      const after = await collection.findOne({ _id: idOf(targetId) }, { projection: { payload: 0, secret: 0, token: 0 } });
      await writeAdminAudit(db, req, admin, { action: `queue-job:${operation}`, targetType: "queue-job", targetId, reason, before, after });
      return res.status(200).json({ ok: true, operation, jobId: targetId });
    }

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
        const requestedRoles = [...new Set((Array.isArray(body.roles) ? body.roles : []).map((role) => clean(role, 40).toLowerCase()).filter(Boolean))];
        const customRoleIds = requestedRoles.filter((role) => role.startsWith("custom:"));
        const builtInRoles = requestedRoles.filter((role) => !role.startsWith("custom:"));
        if (builtInRoles.some((role) => !ALLOWED_ROLES.has(role)) || customRoleIds.some((role) => !/^custom:[a-z][a-z0-9_-]{2,31}$/.test(role))) return res.status(400).json({ error: "Vai trò quản trị không hợp lệ." });
        if (builtInRoles.some((role) => !canGrantRole(admin, role))) return res.status(403).json({ error: "Bạn không thể cấp vai trò ngang hoặc cao hơn quyền hiện tại." });
        if (customRoleIds.length) {
          requirePermission(admin, "roles.custom.assign");
          await requireElevation(db, admin);
        }
        const customKeys = customRoleIds.map((role) => role.slice("custom:".length));
        const customRoles = customKeys.length ? await db.collection("communityCustomAdminRoles").find({ key: { $in: customKeys } }).toArray() : [];
        if (customRoles.length !== customKeys.length) return res.status(400).json({ error: "Một hoặc nhiều vai trò tùy chỉnh không còn tồn tại." });
        const adminCustomPermissions = normalizePermissions(customRoles.flatMap((role) => role.permissions || []));
        const nextRoles = requestedRoles;
        update = { $set: { systemRoles: nextRoles, adminCustomPermissions, updatedAt: now } };
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
