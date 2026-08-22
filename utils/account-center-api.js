const crypto = require("crypto");
const { put } = require("@vercel/blob");
const {
  bcrypt,
  clean,
  enforceRateLimit,
  withApi
} = require("./platform");
const {
  authenticate,
  clearSessionCookie,
  ensureIndexes: ensureAuthIndexes,
  hmacHash,
  sendSecurityEmail,
  tokenHash
} = require("./auth-security");
const { checkPassword } = require("./password-policy");

const STEP_UP_TTL_MS = 10 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
let indexesReady;

function apiError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function emailHtmlText(value) {
  return clean(value, 180).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function maskIp(value) {
  const ip = clean(value, 80);
  if (!ip) return "Không xác định";
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean);
    return `${groups.slice(0, 3).join(":") || "::"}:••••`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.•••.•••` : "Đã ẩn";
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function recentAuthentication(auth) {
  if (!auth?.session) return { valid: false, at: null, method: "unknown" };
  const reauthenticatedAt = safeDate(auth.session.reauthenticatedAt);
  const createdAt = safeDate(auth.session.createdAt);
  const at = reauthenticatedAt && (!createdAt || reauthenticatedAt > createdAt) ? reauthenticatedAt : createdAt;
  return {
    valid: Boolean(at && Date.now() - at.getTime() <= STEP_UP_TTL_MS),
    at,
    method: reauthenticatedAt && at === reauthenticatedAt ? "password-step-up" : clean(auth.session.type || "session", 40)
  };
}

function requireStepUp(auth) {
  const recent = recentAuthentication(auth);
  if (!recent.valid) {
    throw apiError(428, "Hãy xác thực lại trước khi thực hiện thao tác nhạy cảm này.", "STEP_UP_REQUIRED");
  }
  return recent;
}

function sessionPayload(row, currentHash) {
  const risk = row.riskStatus === "suspicious" || row.suspicious === true;
  return {
    id: clean(row.sessionId, 120),
    type: clean(row.type || "password", 40),
    device: {
      label: clean(row.device?.label || "Thiết bị", 120),
      browser: clean(row.device?.browser || "Không xác định", 60),
      platform: clean(row.device?.platform || "Không xác định", 60),
      kind: clean(row.device?.kind || (/mobile|android|iphone/i.test(row.device?.userAgent || "") ? "Điện thoại" : "Máy tính"), 40),
      region: clean(row.device?.region || row.region || "Chưa xác định", 100),
      ipMasked: maskIp(row.device?.ip)
    },
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    current: Boolean(currentHash && row.tokenHash === currentHash),
    trusted: row.trusted === true,
    suspicious: risk
  };
}

function loginEventPayload(row) {
  return {
    id: String(row._id || ""),
    type: clean(row.type || "login", 60),
    success: row.success !== false,
    reason: clean(row.reason, 100),
    method: /passkey/i.test(row.type || "") ? "Passkey" : /google/i.test(row.type || "") ? "Google" : /reset/i.test(row.type || "") ? "Khôi phục" : "Mật khẩu",
    device: clean(row.label || `${row.browser || "Thiết bị"} · ${row.platform || ""}`, 120),
    browser: clean(row.browser || "Không xác định", 60),
    platform: clean(row.platform || "Không xác định", 60),
    ipMasked: maskIp(row.ip),
    region: clean(row.region || "Chưa xác định", 100),
    createdAt: row.createdAt,
    newDevice: Boolean(row.newDevice),
    suspicious: Boolean(row.suspicious || row.riskStatus === "suspicious")
  };
}

function passkeyPayload(row) {
  return {
    id: clean(row.credentialId, 1000),
    name: clean(row.name || "Passkey", 80),
    transports: (Array.isArray(row.transports) ? row.transports : []).map((item) => clean(item, 30)).filter(Boolean),
    deviceType: clean(row.deviceType || row.aaguid || "Thiết bị hỗ trợ WebAuthn", 100),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  };
}

async function ensureIndexes(db) {
  await ensureAuthIndexes(db);
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection("accountPreferences").createIndex({ userId: 1 }, { unique: true }),
      db.collection("accountRecoveryCodes").createIndex({ userId: 1, revokedAt: 1, usedAt: 1 }),
      db.collection("accountRecoveryCodes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("accountAudit").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("accountProfileHistory").createIndex({ userId: 1, expiresAt: 1 }),
      db.collection("accountProfileHistory").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  return indexesReady;
}

async function audit(db, auth, action, detail = {}) {
  await db.collection("accountAudit").insertOne({
    userId: auth.user._id,
    sessionId: auth.session?.sessionId || null,
    action: clean(action, 80),
    detail: {
      label: clean(detail.label, 180),
      targetId: clean(detail.targetId, 160),
      fields: (Array.isArray(detail.fields) ? detail.fields : []).map((item) => clean(item, 60)).filter(Boolean).slice(0, 40)
    },
    createdAt: new Date()
  });
}

async function recoveryStatus(db, userId) {
  const rows = await db.collection("accountRecoveryCodes").find({
    userId,
    revokedAt: null,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  }, { projection: { createdAt: 1 } }).toArray();
  return {
    remaining: rows.length,
    generatedAt: rows.reduce((latest, row) => !latest || new Date(row.createdAt) > new Date(latest) ? row.createdAt : latest, null)
  };
}

function scoreCheck(id, label, weight, status, reason, action = "") {
  return { id, label, weight, status, earned: status === "safe" ? weight : 0, reason, action };
}

async function securityScore(db, auth, sessions, passkeys, recovery, loginEvents) {
  const user = auth.user;
  const current = sessions.find((item) => item.current);
  const recentFailures = loginEvents.filter((item) => item.success === false && Date.now() - new Date(item.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
  const suspiciousSessions = sessions.filter((item) => item.suspicious);
  const methods = [
    user.passwordHash ? "password" : "",
    /google/i.test(user.provider || user.lastProvider || "") ? "google" : "",
    passkeys.length ? "passkey" : "",
    recovery.remaining ? "recovery-codes" : ""
  ].filter(Boolean);
  const passwordSafety = user.passwordSafety?.status || "unknown";
  const lastReviewedAt = safeDate(user.securityActivityReviewedAt);
  const checks = [
    scoreCheck("email", "Email đã xác minh", 15, user.emailVerifiedAt || user.verifiedAt ? "safe" : "attention", user.emailVerifiedAt || user.verifiedAt ? "Email đăng nhập đã có bằng chứng xác minh." : "Email chưa hoàn tất xác minh.", "verify-email"),
    scoreCheck("passkey", "Có Passkey chống phishing", 20, passkeys.length ? "safe" : "attention", passkeys.length ? `Đã đăng ký ${passkeys.length} Passkey.` : "Chưa có Passkey trên tài khoản.", "passkeys"),
    scoreCheck("recovery-methods", "Có ít nhất hai cách khôi phục", 15, methods.length >= 2 ? "safe" : "attention", methods.length >= 2 ? `Có ${methods.length} phương thức độc lập.` : "Cần thêm Passkey hoặc mã khôi phục.", "recovery"),
    scoreCheck("suspicious-session", "Không có phiên đáng ngờ", 10, suspiciousSessions.length || recentFailures.length >= 3 ? "attention" : "safe", suspiciousSessions.length ? `${suspiciousSessions.length} phiên cần kiểm tra.` : recentFailures.length >= 3 ? "Có nhiều lần đăng nhập thất bại gần đây." : "Không phát hiện tín hiệu phiên đáng ngờ."),
    scoreCheck("password-breach", "Mật khẩu không có trong dữ liệu rò rỉ", 15, !user.passwordHash ? "not_applicable" : passwordSafety === "safe" ? "safe" : passwordSafety === "compromised" ? "attention" : "unknown", !user.passwordHash ? "Tài khoản này không dùng mật khẩu HH." : passwordSafety === "safe" ? "Đã kiểm tra bằng k-anonymity; không tìm thấy trong tập dữ liệu rò rỉ tại thời điểm kiểm tra." : passwordSafety === "compromised" ? "Mật khẩu đã xuất hiện trong dữ liệu rò rỉ; hãy đổi ngay." : "Chưa kiểm tra mật khẩu hiện tại.", "password-check"),
    scoreCheck("activity-review", "Đã kiểm tra hoạt động gần đây", 10, lastReviewedAt && Date.now() - lastReviewedAt.getTime() < 30 * 24 * 60 * 60 * 1000 ? "safe" : "attention", lastReviewedAt ? `Lần kiểm tra cuối: ${lastReviewedAt.toISOString()}.` : "Bạn chưa xác nhận đã xem lịch sử đăng nhập.", "history"),
    scoreCheck("recovery-codes", "Có mã khôi phục dùng một lần", 10, recovery.remaining ? "safe" : "attention", recovery.remaining ? `Còn ${recovery.remaining} mã chưa dùng.` : "Chưa tạo mã khôi phục.", "recovery"),
    scoreCheck("session-freshness", "Phiên đăng nhập còn mới", 5, current && Date.now() - new Date(current.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000 ? "safe" : current ? "attention" : "unknown", current ? "Phiên hiện tại được máy chủ xác nhận." : "Không thể đối chiếu phiên hiện tại.", "sessions")
  ];
  const applicable = checks.filter((item) => item.status !== "not_applicable");
  const max = applicable.reduce((sum, item) => sum + item.weight, 0);
  const earned = applicable.reduce((sum, item) => sum + item.earned, 0);
  return {
    state: "available",
    value: max ? Math.round((earned / max) * 100) : null,
    earned,
    max,
    checkedAt: new Date(),
    checks
  };
}

function defaultNotifications() {
  return {
    securityEmail: true,
    newDeviceEmail: true,
    productEmail: false,
    learningReminders: true,
    inAppUpdates: true
  };
}

function workspaceSettingsDefaults() {
  return {
    schemaVersion: 2,
    appearance: { theme: "cosmic", accent: "#72e7ff", glow: "#b176ff", font: "modern", textZoom: 100, fontWeight: "regular", radius: "soft", glassOpacity: 72, shadow: "balanced", density: "comfortable" },
    layout: { sidebarCollapsed: false, sidebarAutoHide: false, sidebarWidth: 248, showSidebarLabels: true, advancedMode: false, pinnedRoutes: ["/home", "/chat-ai"], breadcrumb: "standard", searchPosition: "header", fullscreenWorkspace: false },
    motion: { level: "balanced", particles: 50, glowIntensity: 55, bloom: 40, speed: 100, autoReduce: true, pauseHidden: true, portalSound: false },
    accessibility: { reducedMotion: false, highContrast: false, underlineLinks: false, focusRing: true, colorVision: "default" },
    locale: { language: "vi", timezone: "Asia/Bangkok", dateFormat: "dd/mm/yyyy", timeFormat: "24h", weekStart: "monday", voice: "vi-female" },
    performance: { graphics: "auto", maxFps: 60, pixelRatio: 1.5, dataSaver: false, disableMobileVideo: true },
    notifications: { email: true, browser: false, inApp: true, security: true, learning: true, publishing: true, system: true, quietEnabled: false, quietStart: "22:00", quietEnd: "07:00" },
    security: { autoLockMinutes: 0, privacyShield: false },
    data: { syncScope: "device" }
  };
}

function normalizeWorkspaceSettings(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const defaults = workspaceSettingsDefaults();
  const group = (name) => source[name] && typeof source[name] === "object" && !Array.isArray(source[name]) ? source[name] : {};
  const appearance = group("appearance"), layout = group("layout"), motion = group("motion"), accessibility = group("accessibility"), locale = group("locale"), performance = group("performance"), notifications = group("notifications"), security = group("security"), data = group("data");
  const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
  const boolValue = (value, fallback) => typeof value === "boolean" ? value : fallback;
  const numberValue = (value, minimum, maximum, fallback) => Number.isFinite(Number(value)) ? Math.max(minimum, Math.min(maximum, Number(value))) : fallback;
  const colorValue = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
  const timeValue = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
  const allowedRoutes = ["/home", "/chat-ai", "/work", "/learn", "/fortune", "/music-ai", "/social-media-tools", "/settings/account/profile"];
  return {
    schemaVersion: 2,
    appearance: {
      theme: enumValue(appearance.theme, ["cosmic", "midnight", "aurora", "light"], defaults.appearance.theme),
      accent: colorValue(appearance.accent, defaults.appearance.accent), glow: colorValue(appearance.glow, defaults.appearance.glow),
      font: enumValue(appearance.font, ["modern", "clean", "rounded", "mono"], defaults.appearance.font),
      textZoom: numberValue(appearance.textZoom, 90, 150, defaults.appearance.textZoom),
      fontWeight: enumValue(appearance.fontWeight, ["regular", "medium", "bold"], defaults.appearance.fontWeight),
      radius: enumValue(appearance.radius, ["sharp", "soft", "round"], defaults.appearance.radius),
      glassOpacity: numberValue(appearance.glassOpacity, 35, 96, defaults.appearance.glassOpacity),
      shadow: enumValue(appearance.shadow, ["off", "balanced", "deep"], defaults.appearance.shadow),
      density: enumValue(appearance.density, ["comfortable", "compact", "spacious"], defaults.appearance.density)
    },
    layout: {
      sidebarCollapsed: boolValue(layout.sidebarCollapsed, defaults.layout.sidebarCollapsed), sidebarAutoHide: boolValue(layout.sidebarAutoHide, defaults.layout.sidebarAutoHide),
      sidebarWidth: numberValue(layout.sidebarWidth, 216, 320, defaults.layout.sidebarWidth), showSidebarLabels: boolValue(layout.showSidebarLabels, defaults.layout.showSidebarLabels),
      advancedMode: boolValue(layout.advancedMode, defaults.layout.advancedMode),
      pinnedRoutes: [...new Set((Array.isArray(layout.pinnedRoutes) ? layout.pinnedRoutes : defaults.layout.pinnedRoutes).filter((route) => allowedRoutes.includes(route)))].slice(0, 5),
      breadcrumb: enumValue(layout.breadcrumb, ["standard", "compact", "hidden"], defaults.layout.breadcrumb),
      searchPosition: enumValue(layout.searchPosition, ["header", "start", "compact"], defaults.layout.searchPosition),
      fullscreenWorkspace: boolValue(layout.fullscreenWorkspace, defaults.layout.fullscreenWorkspace)
    },
    motion: {
      level: enumValue(motion.level, ["static", "balanced", "cinematic"], defaults.motion.level),
      particles: numberValue(motion.particles, 0, 100, defaults.motion.particles), glowIntensity: numberValue(motion.glowIntensity, 0, 100, defaults.motion.glowIntensity),
      bloom: numberValue(motion.bloom, 0, 100, defaults.motion.bloom), speed: numberValue(motion.speed, 50, 150, defaults.motion.speed),
      autoReduce: boolValue(motion.autoReduce, defaults.motion.autoReduce), pauseHidden: boolValue(motion.pauseHidden, defaults.motion.pauseHidden),
      portalSound: boolValue(motion.portalSound, defaults.motion.portalSound)
    },
    accessibility: {
      reducedMotion: boolValue(accessibility.reducedMotion, defaults.accessibility.reducedMotion), highContrast: boolValue(accessibility.highContrast, defaults.accessibility.highContrast),
      underlineLinks: boolValue(accessibility.underlineLinks, defaults.accessibility.underlineLinks), focusRing: boolValue(accessibility.focusRing, defaults.accessibility.focusRing),
      colorVision: enumValue(accessibility.colorVision, ["default", "protanopia", "deuteranopia", "tritanopia", "monochrome"], defaults.accessibility.colorVision)
    },
    locale: {
      language: enumValue(locale.language, ["vi", "en"], defaults.locale.language), timezone: enumValue(locale.timezone, ["Asia/Bangkok", "Asia/Tokyo", "Europe/London", "America/New_York", "UTC"], defaults.locale.timezone),
      dateFormat: enumValue(locale.dateFormat, ["dd/mm/yyyy", "yyyy-mm-dd", "mm/dd/yyyy"], defaults.locale.dateFormat), timeFormat: enumValue(locale.timeFormat, ["24h", "12h"], defaults.locale.timeFormat),
      weekStart: enumValue(locale.weekStart, ["monday", "sunday"], defaults.locale.weekStart), voice: enumValue(locale.voice, ["vi-female", "vi-male", "system"], defaults.locale.voice)
    },
    performance: {
      graphics: enumValue(performance.graphics, ["auto", "low", "balanced", "high"], defaults.performance.graphics), maxFps: numberValue(performance.maxFps, 24, 120, defaults.performance.maxFps),
      pixelRatio: numberValue(performance.pixelRatio, .75, 2, defaults.performance.pixelRatio), dataSaver: boolValue(performance.dataSaver, defaults.performance.dataSaver), disableMobileVideo: boolValue(performance.disableMobileVideo, defaults.performance.disableMobileVideo)
    },
    notifications: {
      email: boolValue(notifications.email, defaults.notifications.email), browser: boolValue(notifications.browser, defaults.notifications.browser), inApp: boolValue(notifications.inApp, defaults.notifications.inApp),
      security: boolValue(notifications.security, defaults.notifications.security), learning: boolValue(notifications.learning, defaults.notifications.learning), publishing: boolValue(notifications.publishing, defaults.notifications.publishing), system: boolValue(notifications.system, defaults.notifications.system),
      quietEnabled: boolValue(notifications.quietEnabled, defaults.notifications.quietEnabled), quietStart: timeValue(notifications.quietStart, defaults.notifications.quietStart), quietEnd: timeValue(notifications.quietEnd, defaults.notifications.quietEnd)
    },
    security: {
      autoLockMinutes: enumValue(Number(security.autoLockMinutes), [0, 15, 30, 60], defaults.security.autoLockMinutes),
      privacyShield: boolValue(security.privacyShield, defaults.security.privacyShield)
    },
    data: { syncScope: enumValue(data.syncScope, ["device", "account"], defaults.data.syncScope) }
  };
}

async function summary(db, auth) {
  const currentHash = tokenHash(auth.token);
  const [sessionRows, passkeyRows, loginRows, preferences, recovery, audits, profile, profileHistory] = await Promise.all([
    db.collection("authSessions").find({ userId: auth.user._id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).limit(50).toArray(),
    db.collection("passkeys").find({ userId: auth.user._id }).sort({ createdAt: -1 }).project({ publicKey: 0 }).toArray(),
    db.collection("loginEvents").find({ userId: auth.user._id }).sort({ createdAt: -1 }).limit(40).project({ userAgent: 0 }).toArray(),
    db.collection("accountPreferences").findOne({ userId: auth.user._id }),
    recoveryStatus(db, auth.user._id),
    db.collection("accountAudit").find({ userId: auth.user._id }).sort({ createdAt: -1 }).limit(40).toArray(),
    db.collection("communityProfiles").findOne({ userId: auth.user._id, status: { $ne: "deleted" } }),
    db.collection("accountProfileHistory").find({ userId: auth.user._id, expiresAt: { $gt: new Date() }, undoneAt: null }).sort({ createdAt: -1 }).limit(1).toArray()
  ]);
  const sessions = sessionRows.map((row) => sessionPayload(row, currentHash));
  const passkeys = passkeyRows.map(passkeyPayload);
  const loginHistory = loginRows.map(loginEventPayload);
  const completionFields = [auth.user.name, auth.user.avatar, profile?.username, profile?.bio, profile?.city, profile?.workplace, profile?.languages?.length, profile?.interests?.length];
  const profileCompletion = Math.round(completionFields.filter(Boolean).length / completionFields.length * 100);
  return {
    ok: true,
    user: {
      id: String(auth.user._id),
      name: clean(auth.user.name || "Thành viên HH", 100),
      email: clean(auth.user.email, 160),
      avatar: clean(auth.user.avatar, 1200),
      provider: clean(auth.user.provider || auth.user.lastProvider || "local", 40),
      emailVerifiedAt: auth.user.emailVerifiedAt || auth.user.verifiedAt || null,
      createdAt: auth.user.createdAt,
      deletionScheduledAt: auth.user.deletionScheduledAt || null
    },
    profileCompletion,
    securityScore: await securityScore(db, auth, sessions, passkeys, recovery, loginHistory),
    sessions,
    passkeys,
    recovery,
    loginHistory,
    notifications: { ...defaultNotifications(), ...(preferences?.notifications || {}) },
    workspaceSettings: preferences?.workspaceSettings ? normalizeWorkspaceSettings(preferences.workspaceSettings) : null,
    workspaceSettingsUpdatedAt: preferences?.workspaceSettingsUpdatedAt || null,
    audit: audits.map((item) => ({ id: String(item._id), action: clean(item.action, 80), label: clean(item.detail?.label, 180), createdAt: item.createdAt })),
    undoProfile: profileHistory[0] ? { id: String(profileHistory[0]._id), expiresAt: profileHistory[0].expiresAt } : null,
    stepUp: { ...recentAuthentication(auth), expiresInSeconds: recentAuthentication(auth).valid ? Math.max(0, Math.floor((STEP_UP_TTL_MS - (Date.now() - recentAuthentication(auth).at.getTime())) / 1000)) : 0 },
    capabilities: {
      passkey: true,
      imageStorage: Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || "").trim()),
      accountExport: true,
      accountDeletion: true
    }
  };
}

async function breachedPasswordCount(password) {
  const sha1 = crypto.createHash("sha1").update(String(password), "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "HH-Account-Center" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const match = text.split(/\r?\n/).map((line) => line.split(":"))
      .find(([hashSuffix]) => hashSuffix === suffix);
    return { state: "checked", count: match ? Number(match[1] || 0) : 0 };
  } catch {
    return { state: "unavailable", count: null };
  } finally {
    clearTimeout(timer);
  }
}

async function stepUpPassword(db, auth, body) {
  if (!auth.session) throw apiError(409, "Không xác định được phiên hiện tại.", "CURRENT_SESSION_UNKNOWN");
  if (!auth.user.passwordHash || String(auth.user.provider || "").toLowerCase() !== "local") {
    throw apiError(409, "Tài khoản này cần đăng nhập lại bằng Google hoặc Passkey để xác thực.", "RELOGIN_REQUIRED");
  }
  const matched = await bcrypt.compare(String(body.password || ""), auth.user.passwordHash);
  if (!matched) throw apiError(401, "Mật khẩu hiện tại không đúng.", "STEP_UP_FAILED");
  const now = new Date();
  await Promise.all([
    db.collection("authSessions").updateOne({ _id: auth.session._id, userId: auth.user._id }, { $set: { reauthenticatedAt: now } }),
    audit(db, auth, "security.step_up", { label: "Xác thực lại bằng mật khẩu" })
  ]);
  return { ok: true, verifiedAt: now, expiresIn: Math.floor(STEP_UP_TTL_MS / 1000) };
}

function recoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    return `HH-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

async function generateRecoveryCodes(db, auth) {
  requireStepUp(auth);
  const codes = recoveryCodes();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RECOVERY_CODE_TTL_MS);
  await db.collection("accountRecoveryCodes").updateMany({ userId: auth.user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "regenerated" } });
  await db.collection("accountRecoveryCodes").insertMany(codes.map((code, index) => ({
    userId: auth.user._id,
    codeHash: hmacHash(`${auth.user._id}:${code}`, "account-recovery-code"),
    index,
    createdAt: now,
    expiresAt,
    usedAt: null,
    revokedAt: null
  })));
  await audit(db, auth, "recovery_codes.generated", { label: `${codes.length} mã dùng một lần` });
  return { ok: true, codes, createdAt: now, expiresAt, message: "Các mã này chỉ hiển thị một lần. Hãy lưu ở nơi an toàn." };
}

async function renamePasskey(db, auth, body) {
  const credentialId = clean(body.credentialId, 1000);
  const name = clean(body.name, 80);
  if (name.length < 2) throw apiError(400, "Tên Passkey cần ít nhất 2 ký tự.", "PASSKEY_NAME_INVALID");
  const result = await db.collection("passkeys").updateOne({ userId: auth.user._id, credentialId }, { $set: { name, updatedAt: new Date() } });
  if (!result.matchedCount) throw apiError(404, "Không tìm thấy Passkey.", "PASSKEY_NOT_FOUND");
  await audit(db, auth, "passkey.renamed", { label: name, targetId: credentialId });
  return { ok: true, name };
}

async function revokePasskey(db, auth, body) {
  requireStepUp(auth);
  const credentialId = clean(body.credentialId, 1000);
  const [passkeyCount, recovery, credential] = await Promise.all([
    db.collection("passkeys").countDocuments({ userId: auth.user._id }),
    recoveryStatus(db, auth.user._id),
    db.collection("passkeys").findOne({ userId: auth.user._id, credentialId }, { projection: { name: 1 } })
  ]);
  if (!credential) throw apiError(404, "Không tìm thấy Passkey.", "PASSKEY_NOT_FOUND");
  const hasAlternative = Boolean(auth.user.passwordHash || /google/i.test(auth.user.provider || auth.user.lastProvider || "") || recovery.remaining);
  if (passkeyCount <= 1 && !hasAlternative) {
    throw apiError(409, "Hãy tạo mã khôi phục hoặc phương thức đăng nhập thay thế trước khi xóa Passkey cuối cùng.", "LAST_RECOVERY_METHOD");
  }
  await db.collection("passkeys").deleteOne({ userId: auth.user._id, credentialId });
  await Promise.all([
    audit(db, auth, "passkey.removed", { label: credential.name || "Passkey", targetId: credentialId }),
    sendSecurityEmail({
      to: auth.user.email,
      subject: "Passkey đã bị xóa khỏi tài khoản HH",
      html: `<p>Passkey <strong>${emailHtmlText(credential.name || "Passkey")}</strong> vừa bị xóa khỏi tài khoản của bạn.</p><p>Nếu không phải bạn, hãy đăng nhập và thu hồi các phiên ngay.</p>`,
      text: `Passkey ${clean(credential.name || "Passkey", 80)} vừa bị xóa khỏi tài khoản HH. Nếu không phải bạn, hãy thu hồi các phiên ngay.`
    })
  ]);
  return { ok: true };
}

async function updateNotifications(db, auth, body) {
  const allowed = Object.keys(defaultNotifications());
  const input = body.notifications && typeof body.notifications === "object" ? body.notifications : {};
  const notifications = {};
  for (const key of allowed) if (typeof input[key] === "boolean") notifications[key] = input[key];
  if (!Object.keys(notifications).length) throw apiError(400, "Không có tùy chọn thông báo hợp lệ.", "NOTIFICATION_INPUT_INVALID");
  await db.collection("accountPreferences").updateOne({ userId: auth.user._id }, { $set: { userId: auth.user._id, ...Object.fromEntries(Object.entries(notifications).map(([key, value]) => [`notifications.${key}`, value])), updatedAt: new Date() } }, { upsert: true });
  await audit(db, auth, "notifications.updated", { fields: Object.keys(notifications), label: "Tùy chọn thông báo tài khoản" });
  return { ok: true, notifications };
}

async function updateWorkspaceSettings(db, auth, body) {
  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) throw apiError(400, "Cấu hình workspace không hợp lệ.", "WORKSPACE_SETTINGS_INVALID");
  const settings = normalizeWorkspaceSettings(body.settings);
  const updatedAt = new Date();
  await db.collection("accountPreferences").updateOne(
    { userId: auth.user._id },
    { $set: { userId: auth.user._id, workspaceSettings: settings, workspaceSettingsUpdatedAt: updatedAt, updatedAt } },
    { upsert: true }
  );
  await audit(db, auth, "workspace.settings_updated", { label: settings.data.syncScope, schemaVersion: settings.schemaVersion });
  return { ok: true, settings, updatedAt };
}

async function sendWorkspaceTestNotification(db, auth) {
  await enforceRateLimit(db, `settings-notification-test:${auth.user._id}`, 3, 10 * 60 * 1000);
  const delivery = await sendSecurityEmail({
    to: auth.user.email,
    subject: "HH Platform · Thông báo thử thành công",
    html: `<div style="font-family:Arial,sans-serif;padding:24px;background:#090d1d;color:#eef4ff;border-radius:16px"><p style="color:#72e7ff;font-size:12px;font-weight:800;letter-spacing:1px">HH SETTINGS STUDIO</p><h2 style="margin:8px 0">Kênh email đang hoạt động</h2><p style="color:#b9c5df;line-height:1.6">Đây là thông báo thử bạn vừa chủ động gửi từ phần Cài đặt. Không có thay đổi bảo mật nào được thực hiện.</p></div>`,
    text: "HH Settings Studio: Kênh thông báo email đang hoạt động. Đây là thông báo thử bạn vừa chủ động gửi.",
    idempotencyKey: `settings-test-${auth.user._id}-${Math.floor(Date.now() / 60000)}`,
    tags: [{ name: "category", value: "settings-test" }]
  });
  await audit(db, auth, "workspace.notification_tested", { label: delivery.delivered ? "email-delivered" : delivery.reason || "email-unavailable" });
  return { ok: true, delivered: delivery.delivered === true, provider: delivery.provider, reason: delivery.reason || null };
}

async function revokeSession(db, auth, body) {
  const sessionId = clean(body.sessionId, 120);
  const result = await db.collection("authSessions").updateOne({ userId: auth.user._id, sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: body.notMe ? "reported-not-me" : "account-center" } });
  if (!result.matchedCount) throw apiError(404, "Không tìm thấy phiên đăng nhập.", "SESSION_NOT_FOUND");
  await audit(db, auth, body.notMe ? "session.reported" : "session.revoked", { targetId: sessionId, label: body.notMe ? "Người dùng báo không nhận ra phiên" : "Thu hồi một phiên" });
  if (auth.session?.sessionId === sessionId) clearSessionCookie(body.__response || {});
  return { ok: true, currentRevoked: auth.session?.sessionId === sessionId };
}

async function revokeOtherSessions(db, auth) {
  requireStepUp(auth);
  if (!auth.session?.sessionId) throw apiError(409, "Không xác định được phiên hiện tại.", "CURRENT_SESSION_UNKNOWN");
  const result = await db.collection("authSessions").updateMany({ userId: auth.user._id, sessionId: { $ne: auth.session.sessionId }, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: "revoke-other-sessions" } });
  await audit(db, auth, "sessions.revoked_others", { label: `${Number(result.modifiedCount || 0)} phiên` });
  return { ok: true, revoked: Number(result.modifiedCount || 0) };
}

async function trustSession(db, auth, body) {
  requireStepUp(auth);
  const sessionId = clean(body.sessionId, 120);
  const trusted = body.trusted === true;
  const result = await db.collection("authSessions").updateOne(
    { userId: auth.user._id, sessionId, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { trusted, trustedAt: trusted ? new Date() : null, trustedBySessionId: trusted ? auth.session.sessionId : null } }
  );
  if (!result.matchedCount) throw apiError(404, "Không tìm thấy phiên đăng nhập.", "SESSION_NOT_FOUND");
  await audit(db, auth, trusted ? "session.trusted" : "session.untrusted", { targetId: sessionId, label: trusted ? "Đánh dấu thiết bị tin cậy" : "Bỏ trạng thái tin cậy" });
  return { ok: true, trusted };
}

async function passwordSafetyCheck(db, auth, body) {
  if (!auth.user.passwordHash) throw apiError(409, "Tài khoản này không dùng mật khẩu HH.", "PASSWORD_NOT_CONFIGURED");
  const matched = await bcrypt.compare(String(body.password || ""), auth.user.passwordHash);
  if (!matched) throw apiError(401, "Mật khẩu hiện tại không đúng.", "PASSWORD_INVALID");
  const result = await breachedPasswordCount(body.password);
  const now = new Date();
  const status = result.state === "unavailable" ? "unknown" : result.count > 0 ? "compromised" : "safe";
  await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { passwordSafety: { status, checkedAt: now, breachCount: result.count }, updatedAt: now } });
  await audit(db, auth, "password.safety_checked", { label: status });
  return { ok: true, status, count: result.count, checkedAt: now };
}

async function updatePassword(db, auth, body) {
  requireStepUp(auth);
  if (!auth.user.passwordHash) throw apiError(409, "Tài khoản này chưa hỗ trợ đổi mật khẩu trực tiếp.", "PASSWORD_NOT_CONFIGURED");
  const password = String(body.newPassword || "");
  const policy = checkPassword(password);
  if (!policy.valid) throw apiError(400, policy.message, policy.code);
  const breach = await breachedPasswordCount(password);
  if (breach.state === "checked" && breach.count > 0) throw apiError(400, "Mật khẩu mới đã xuất hiện trong dữ liệu rò rỉ. Hãy chọn mật khẩu khác.", "PASSWORD_COMPROMISED");
  const now = new Date();
  await Promise.all([
    db.collection("users").updateOne({ _id: auth.user._id }, { $set: { passwordHash: await bcrypt.hash(password, 13), passwordSafety: { status: breach.state === "checked" ? "safe" : "unknown", checkedAt: now, breachCount: breach.count }, updatedAt: now } }),
    db.collection("authSessions").updateMany({ userId: auth.user._id, sessionId: { $ne: auth.session.sessionId }, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "password-changed" } }),
    audit(db, auth, "password.changed", { label: "Đã đổi mật khẩu và thu hồi các phiên khác" }),
    sendSecurityEmail({ to: auth.user.email, subject: "Mật khẩu HH đã được thay đổi", html: "<p>Mật khẩu tài khoản HH của bạn vừa được thay đổi. Các phiên khác đã bị thu hồi.</p>", text: "Mật khẩu tài khoản HH của bạn vừa được thay đổi. Các phiên khác đã bị thu hồi." })
  ]);
  return { ok: true };
}

async function requestEmailChange(db, auth, body) {
  requireStepUp(auth);
  const newEmail = clean(body.email, 160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(newEmail)) throw apiError(400, "Email mới không hợp lệ.", "EMAIL_INVALID");
  if (newEmail === String(auth.user.email || "").toLowerCase()) throw apiError(409, "Email mới trùng với email hiện tại.", "EMAIL_UNCHANGED");
  if (await db.collection("users").findOne({ email: newEmail, _id: { $ne: auth.user._id } }, { projection: { _id: 1 } })) throw apiError(409, "Email này đã được sử dụng.", "EMAIL_TAKEN");
  const code = String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  await db.collection("authChallenges").insertOne({ type: "account-email-change", lookup: String(auth.user._id), secretHash: hmacHash(`${auth.user._id}:${newEmail}:${code}`, "account-email-change"), newEmail, createdAt: now, expiresAt: new Date(now.getTime() + 15 * 60 * 1000), consumedAt: null });
  const delivery = await sendSecurityEmail({ to: newEmail, subject: "Xác minh email mới cho tài khoản HH", html: `<p>Mã xác minh email mới của bạn:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p>Mã hết hạn sau 15 phút.</p>`, text: `Mã xác minh email mới HH: ${code}. Mã hết hạn sau 15 phút.` });
  if (!delivery.delivered) throw apiError(503, "Không thể gửi mã đến email mới. Hãy thử lại sau.", "EMAIL_DELIVERY_FAILED");
  await audit(db, auth, "email.change_requested", { label: newEmail });
  return { ok: true, delivery: "sent" };
}

async function confirmEmailChange(db, auth, body) {
  requireStepUp(auth);
  const newEmail = clean(body.email, 160).toLowerCase();
  const code = clean(body.code, 12);
  const challenge = await db.collection("authChallenges").findOne({ type: "account-email-change", lookup: String(auth.user._id), newEmail, consumedAt: null, expiresAt: { $gt: new Date() } }, { sort: { createdAt: -1 } });
  if (!challenge || challenge.secretHash !== hmacHash(`${auth.user._id}:${newEmail}:${code}`, "account-email-change")) throw apiError(400, "Mã xác minh không đúng hoặc đã hết hạn.", "EMAIL_CODE_INVALID");
  const now = new Date();
  await Promise.all([
    db.collection("users").updateOne({ _id: auth.user._id }, { $set: { email: newEmail, emailVerifiedAt: now, updatedAt: now }, $inc: { tokenVersion: 1 } }),
    db.collection("authChallenges").updateOne({ _id: challenge._id }, { $set: { consumedAt: now } }),
    db.collection("authSessions").updateMany({ userId: auth.user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "email-changed" } }),
    audit(db, auth, "email.changed", { label: newEmail }),
    sendSecurityEmail({ to: auth.user.email, subject: "Email đăng nhập HH đã được thay đổi", html: `<p>Email đăng nhập tài khoản HH vừa đổi sang <strong>${emailHtmlText(newEmail)}</strong>.</p><p>Nếu không phải bạn, hãy liên hệ hỗ trợ ngay.</p>`, text: `Email đăng nhập HH vừa đổi sang ${newEmail}. Nếu không phải bạn, hãy liên hệ hỗ trợ ngay.` })
  ]);
  clearSessionCookie(body.__response);
  return { ok: true, email: newEmail, signedOut: true };
}

function decodeImage(body) {
  const mimeType = clean(body.mimeType, 80).toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw apiError(415, "Chỉ hỗ trợ JPEG, PNG, WebP hoặc AVIF.", "IMAGE_TYPE_UNSUPPORTED");
  const encoded = String(body.data || "").replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw apiError(400, "Dữ liệu ảnh không hợp lệ.", "IMAGE_DATA_INVALID");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_PROFILE_IMAGE_BYTES) throw apiError(413, "Ảnh hồ sơ sau nén phải nhỏ hơn 2 MB.", "IMAGE_TOO_LARGE");
  const valid = mimeType === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mimeType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : mimeType === "image/webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        : bytes.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(bytes.toString("ascii", 8, 32));
  if (!valid) throw apiError(415, "Chữ ký tệp không khớp định dạng ảnh.", "IMAGE_SIGNATURE_INVALID");
  return { bytes, mimeType };
}

async function uploadProfileImage(db, auth, body) {
  if (!String(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || "").trim()) throw apiError(503, "Kho ảnh hồ sơ chưa được cấu hình.", "PROFILE_STORAGE_UNAVAILABLE");
  await enforceRateLimit(db, `account-image:${auth.user._id}`, 20, 60 * 60 * 1000);
  const kind = body.kind === "cover" ? "cover" : "avatar";
  const { bytes, mimeType } = decodeImage(body);
  const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
  const blob = await put(`profiles/${String(auth.user._id)}/${kind}-${Date.now()}.${extension}`, bytes, { access: "public", addRandomSuffix: true, contentType: mimeType, cacheControlMaxAge: 31536000 });
  const url = clean(blob.url, 1200);
  if (kind === "avatar") await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { avatar: url, updatedAt: new Date() } });
  else await db.collection("communityProfiles").updateOne({ userId: auth.user._id, status: { $ne: "deleted" } }, { $set: { cover: url, updatedAt: new Date() } });
  await audit(db, auth, `profile.${kind}_updated`, { label: mimeType });
  return { ok: true, kind, url };
}

async function exportAccount(db, auth) {
  requireStepUp(auth);
  const [profile, preferences, sessions, loginHistory, passkeys, recovery, auditRows, socialActivity] = await Promise.all([
    db.collection("communityProfiles").findOne({ userId: auth.user._id }),
    db.collection("accountPreferences").findOne({ userId: auth.user._id }),
    db.collection("authSessions").find({ userId: auth.user._id }).project({ tokenHash: 0 }).toArray(),
    db.collection("loginEvents").find({ userId: auth.user._id }).project({ userAgent: 0 }).toArray(),
    db.collection("passkeys").find({ userId: auth.user._id }).project({ publicKey: 0, credentialId: 0 }).toArray(),
    db.collection("accountRecoveryCodes").find({ userId: auth.user._id }).project({ codeHash: 0 }).toArray(),
    db.collection("accountAudit").find({ userId: auth.user._id }).sort({ createdAt: -1 }).limit(500).toArray(),
    db.collection("communityActivity").find({ ownerId: auth.user._id }).sort({ createdAt: -1 }).limit(1000).toArray()
  ]);
  await audit(db, auth, "account.exported", { label: "Bản xuất JSON đầy đủ" });
  return {
    ok: true,
    exportedAt: new Date(),
    schema: "hh-account-export.v1",
    account: { ...auth.user, _id: String(auth.user._id), passwordHash: undefined, tokenVersion: undefined, passwordSafety: auth.user.passwordSafety ? { ...auth.user.passwordSafety, breachCount: undefined } : undefined },
    profile,
    preferences,
    sessions,
    loginHistory,
    passkeys,
    recovery,
    audit: auditRows,
    socialActivity
  };
}

async function scheduleDeletion(db, auth, body) {
  requireStepUp(auth);
  if (String(body.confirm || "").trim().toUpperCase() !== "DELETE") throw apiError(400, "Nhập DELETE để xác nhận yêu cầu xóa tài khoản.", "DELETE_CONFIRMATION_REQUIRED");
  const now = new Date();
  const deletionScheduledAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await audit(db, auth, "account.deletion_scheduled", { label: deletionScheduledAt.toISOString() });
  await Promise.all([
    db.collection("users").updateOne({ _id: auth.user._id }, { $set: { status: "pending_deletion", deletionRequestedAt: now, deletionScheduledAt, updatedAt: now }, $inc: { tokenVersion: 1 } }),
    db.collection("authSessions").updateMany({ userId: auth.user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "account-deletion-requested" } }),
    sendSecurityEmail({ to: auth.user.email, subject: "Yêu cầu xóa tài khoản HH đã được ghi nhận", html: `<p>Tài khoản của bạn được lên lịch xóa sau ngày <strong>${deletionScheduledAt.toISOString().slice(0, 10)}</strong>.</p><p>Bạn có thể đăng nhập lại trước thời điểm đó để hủy yêu cầu.</p>`, text: `Tài khoản HH được lên lịch xóa ngày ${deletionScheduledAt.toISOString()}. Bạn có thể đăng nhập lại để hủy yêu cầu.` })
  ]);
  clearSessionCookie(body.__response || {});
  return { ok: true, deletionScheduledAt, signedOut: true };
}

async function cancelDeletion(db, auth) {
  if (!auth.user.deletionScheduledAt) throw apiError(409, "Tài khoản không có yêu cầu xóa đang chờ.", "DELETION_NOT_PENDING");
  await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { status: "active", deletionScheduledAt: null, deletionRequestedAt: null, updatedAt: new Date() } });
  await audit(db, auth, "account.deletion_cancelled", { label: "Đã hủy yêu cầu xóa" });
  return { ok: true };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const auth = await authenticate(req, db);
    if (!auth) return res.status(401).json({ error: "Bạn cần đăng nhập để mở Trung tâm tài khoản.", code: "AUTH_REQUIRED" });
    const privateUser = await db.collection("users").findOne({ _id: auth.user._id });
    if (!privateUser) return res.status(401).json({ error: "Tài khoản không còn tồn tại.", code: "AUTH_REQUIRED" });
    auth.user = privateUser;
    await ensureIndexes(db);
    if (req.method === "GET") return res.status(200).json(await summary(db, auth));
    if (req.method !== "POST") return res.status(405).json({ error: "Phương thức không được hỗ trợ." });
    await enforceRateLimit(db, `account-center:${auth.user._id}`, 100, 10 * 60 * 1000);
    const action = clean(body.action, 80).toLowerCase();
    body.__response = res;
    if (action === "step-up:password") return res.status(200).json(await stepUpPassword(db, auth, body));
    if (action === "recovery:generate") return res.status(201).json(await generateRecoveryCodes(db, auth));
    if (action === "passkey:rename") return res.status(200).json(await renamePasskey(db, auth, body));
    if (action === "passkey:revoke") return res.status(200).json(await revokePasskey(db, auth, body));
    if (action === "notifications:update") return res.status(200).json(await updateNotifications(db, auth, body));
    if (action === "settings:update") return res.status(200).json(await updateWorkspaceSettings(db, auth, body));
    if (action === "settings:test-notification") return res.status(200).json(await sendWorkspaceTestNotification(db, auth));
    if (action === "session:revoke") return res.status(200).json(await revokeSession(db, auth, body));
    if (action === "session:trust") return res.status(200).json(await trustSession(db, auth, body));
    if (action === "sessions:revoke-others") return res.status(200).json(await revokeOtherSessions(db, auth));
    if (action === "activity:reviewed") {
      const now = new Date();
      await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { securityActivityReviewedAt: now, updatedAt: now } });
      await audit(db, auth, "security.activity_reviewed", { label: "Đã xem lịch sử đăng nhập" });
      return res.status(200).json({ ok: true, reviewedAt: now });
    }
    if (action === "password:safety-check") return res.status(200).json(await passwordSafetyCheck(db, auth, body));
    if (action === "password:update") return res.status(200).json(await updatePassword(db, auth, body));
    if (action === "email:request") return res.status(202).json(await requestEmailChange(db, auth, body));
    if (action === "email:confirm") return res.status(200).json(await confirmEmailChange(db, auth, body));
    if (action === "profile:image") return res.status(201).json(await uploadProfileImage(db, auth, body));
    if (action === "account:export") return res.status(200).json(await exportAccount(db, auth));
    if (action === "account:delete") return res.status(202).json(await scheduleDeletion(db, auth, body));
    if (action === "account:cancel-delete") return res.status(200).json(await cancelDeletion(db, auth));
    throw apiError(400, "Thao tác Account Center không hợp lệ.", "ACCOUNT_ACTION_INVALID");
  }, { maxBodyBytes: 3 * 1024 * 1024, maxDepth: 18, maxNodes: 5000, maxArrayLength: 1000 });
};

module.exports.__test = Object.freeze({
  maskIp,
  recentAuthentication,
  requireStepUp,
  securityScore,
  decodeImage,
  normalizeWorkspaceSettings,
  workspaceSettingsDefaults
});
