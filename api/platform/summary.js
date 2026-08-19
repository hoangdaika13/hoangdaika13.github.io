const { clean, currentUser, database, enforceRateLimit, isAdminUser, setCors, withApi } = require("../../utils/platform");
const crypto = require("node:crypto");
const privacyConsentHandler = require("../../utils/privacy-consent-api");
const youtubePublisherHandler = require("../../utils/youtubePublisher");
const facebookPageManagerHandler = require("../../utils/facebookPageManager");
const tiktokCreatorManagerHandler = require("../../utils/tiktokCreatorManager");
const accountCenterHandler = require("../../utils/account-center-api");
const metaWebhookHandler = require("../../utils/metaWebhook");
const { quotaStatus, requireRoles } = require("../../services/apiGateway");
const { ObjectId } = require("mongodb");

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const TELEMETRY_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const TELEMETRY_TYPES = new Set(["page_view", "action", "error", "performance", "session_start", "session_end", "diagnostic", "export", "refresh", "form_start", "form_submit", "form_validation", "control_change", "experiment_exposure", "experiment_conversion", "conversion"]);

const MAX_JSON_BODY = 64 * 1024;
const CSP_REPORT_RETENTION_SECONDS = 30 * 24 * 60 * 60;

function hydrateJsonBody(req) {
  if (req.body !== undefined || !["POST", "PUT", "PATCH", "DELETE"].includes(String(req.method || "").toUpperCase())) {
    if (req.rawBody === undefined && Buffer.isBuffer(req.body)) req.rawBody = req.body;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks);
        req.rawBody = raw;
        req.body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
        resolve();
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function safeRoute(value) {
  const input = clean(value || "/", 300).split("?")[0];
  const route = input.includes("#") ? input.slice(input.indexOf("#") + 1) : input;
  return (route.startsWith("/") ? route : `/${route}`).replace(/[^\p{L}\p{N}/_.:-]/gu, "-").slice(0, 200) || "/";
}

function safeKey(value, fallback = "unknown") {
  return clean(value || fallback, 100).toLowerCase().replace(/[^a-z0-9_.:-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function safeTelemetryMeta(value = {}) {
  const enumValue = (input, allowed, fallback = "") => allowed.includes(input) ? input : fallback;
  return {
    form: safeKey(value.form, "form").slice(0, 80),
    kind: enumValue(safeKey(value.kind, "form"), ["form", "authentication", "prompt", "message", "search"], "form"),
    fieldType: enumValue(safeKey(value.fieldType, ""), ["", "text", "email", "number", "url", "search", "textarea", "select-one", "checkbox", "radio", "credential"], ""),
    fieldCount: Math.max(0, Math.min(100, Number(value.fieldCount || 0))),
    lengthBucket: enumValue(clean(value.lengthBucket, 20), ["", "empty", "1-20", "21-80", "81-240", "241-1000", "1000+"], ""),
    interactionBucket: enumValue(clean(value.interactionBucket, 20), ["", "none", "1-5", "6-20", "21-60", "60+"], ""),
    durationBucket: enumValue(clean(value.durationBucket, 20), ["", "0-5s", "6-30s", "31-120s", "2-10m", "10m+"], ""),
    valid: value.valid !== false,
    region: enumValue(clean(value.region, 30), ["", "top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"], ""),
    source: enumValue(clean(value.source, 20), ["", "direct", "internal", "search", "social", "referral"], ""),
    metric: enumValue(safeKey(value.metric, ""), ["", "lcp", "cls", "inp", "fcp", "ttfb", "load"], ""),
    value: Math.max(0, Math.min(600000, Number(value.value || 0))),
    rating: enumValue(clean(value.rating, 30), ["", "good", "needs-improvement", "poor", "unknown"], ""),
    errorKind: enumValue(clean(value.errorKind, 30), ["", "runtime", "resource", "unhandled-rejection"], ""),
    experimentId: safeKey(value.experimentId, "").slice(0, 64),
    variant: enumValue(clean(value.variant, 2).toUpperCase(), ["", "A", "B", "C", "D"], "")
  };
}

function safeTelemetryEvent(item, now) {
  const type = safeKey(item?.type, "event");
  if (!TELEMETRY_TYPES.has(type)) return null;
  const clientTime = new Date(item?.createdAt || now);
  return {
    eventId: clean(item?.id, 100),
    type,
    route: safeRoute(item?.route),
    module: safeKey(item?.module || "home", "home"),
    action: safeKey(item?.action || item?.actionKey || type, type),
    label: "",
    meta: safeTelemetryMeta(item?.meta),
    clientCreatedAt: Number.isNaN(clientTime.getTime()) ? now : clientTime,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TELEMETRY_RETENTION_SECONDS * 1000)
  };
}

function rolloutBucket(identity, key) {
  return [...`${identity}:${key}`].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7) % 100;
}

function safeCspLocation(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return clean(value, 500).split(/[?#]/)[0];
  }
}

function safeCspReport(body = {}) {
  const report = body["csp-report"] || body.body || body;
  const now = new Date();
  return {
    document: safeCspLocation(report["document-uri"] || report.documentURL),
    blocked: safeCspLocation(report["blocked-uri"] || report.blockedURL),
    effectiveDirective: safeKey(report["effective-directive"] || report.effectiveDirective, "unknown").slice(0, 100),
    violatedDirective: clean(report["violated-directive"] || report.violatedDirective, 200),
    disposition: ["enforce", "report"].includes(report.disposition) ? report.disposition : "enforce",
    statusCode: Math.max(0, Math.min(599, Number(report["status-code"] || report.statusCode || 0))),
    sourceFile: safeCspLocation(report["source-file"] || report.sourceFile),
    lineNumber: Math.max(0, Math.min(10_000_000, Number(report["line-number"] || report.lineNumber || 0))),
    createdAt: now,
    expiresAt: new Date(now.getTime() + CSP_REPORT_RETENTION_SECONDS * 1000)
  };
}

function safeIncident(input = {}) {
  const allowedKinds = new Set(["runtime-error", "unhandled-rejection", "session-sync", "health-check", "storage-inspection", "system-me"]);
  const kind = safeKey(input.kind, "runtime-error");
  return {
    kind: allowedKinds.has(kind) ? kind : "runtime-error",
    module: safeKey(input.module, "system").slice(0, 80),
    message: clean(input.message, 300).replace(/\bBearer\s+[\w.-]+|\b(?:sk|AIza|AQ\.)[-_.\w]{12,}|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[redacted]"),
    count: Math.max(1, Math.min(10000, Number(input.count || 1))),
    release: clean(input.release, 80),
    firstAt: new Date(input.firstAt || Date.now()),
    lastAt: new Date(input.lastAt || Date.now())
  };
}

const SYSTEM_JOB_SOURCES = new Set(["tool", "youtube", "tiktok", "facebook", "social"]);
const TERMINAL_JOB_STATES = new Set(["completed", "success", "failed", "error", "cancelled", "canceled", "published", "uploaded"]);
const objectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || "")) ? new ObjectId(String(value)) : null;

function publicSystemJob(input = {}, source = "tool") {
  const id = String(input._id || input.id || "");
  const status = clean(input.status || input.state || "unknown", 50).toLowerCase();
  let progress = Math.max(0, Math.min(100, Number(input.progress || 0)));
  if (!progress && Number(input.total || 0) > 0) progress = Math.round(Math.max(0, Number(input.completed || 0)) / Number(input.total) * 100);
  const controls = [];
  if (source === "tool" && !TERMINAL_JOB_STATES.has(status)) controls.push("cancel");
  if (source === "tiktok") {
    if (["ready", "uploading", "processing", "scheduled-internal"].includes(status)) controls.push("pause");
    if (status === "paused") controls.push("resume");
    if (["failed", "error"].includes(status)) controls.push("retry");
  }
  if (source === "media") {
    // External workers require a provider acknowledgement in Media Cloud. Only
    // local orchestration plans can be controlled safely from System Center.
    if (!input.remoteId && ["needs-worker", "queued", "running"].includes(status)) controls.push("pause", "cancel");
    if (!input.remoteId && status === "paused") controls.push("resume", "cancel");
    if (!input.remoteId && ["failed", "error"].includes(status)) controls.push("retry");
  }
  return {
    id,
    source,
    kind: clean(input.kind || input.action || input.toolId || "job", 80),
    label: clean(input.name || input.title || input.fileName || input.toolId || input.kind || input.action || `${source} job`, 180),
    status,
    progress,
    speed: clean(input.speed || "", 60),
    eta: clean(input.eta || input.estimatedTimeRemaining || "", 60),
    checkpoint: clean(input.checkpoint || input.processingStatus || input.providerStatus || "", 120),
    requestId: clean(input.requestId || input.providerReference || "", 160),
    updatedAt: input.updatedAt || input.createdAt || null,
    route: { tool: "/tools", youtube: "/davinci-resolve/youtube", tiktok: "/davinci-resolve/tiktok", facebook: "/davinci-resolve/facebook", social: "/social-media-tools", media: "/media-design", "ai-video": "/davinci-resolve/ai-video-remake" }[source] || "/system",
    projectId: input.projectId ? String(input.projectId) : "",
    controls
  };
}

async function systemUserSnapshot(db, user) {
  const projection = { accessToken: 0, refreshToken: 0, encryptedAccessToken: 0, encryptedRefreshToken: 0, tokenHash: 0, payload: 0, metadata: 0, result: 0, logs: 0, spec: 0 };
  const ownedMediaProjects = await db.collection("mediaProjects").find({ ownerId: user._id, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }, { projection: { _id: 1 } }).limit(300).toArray().catch(() => []);
  const ownedProjectIds = ownedMediaProjects.map(item => item._id);
  const [youtube, tiktok, facebook, toolJobs, youtubeJobs, tiktokJobs, facebookJobs, socialJobs, mediaJobs, aiVideoJobs, loginHistory] = await Promise.all([
    db.collection("youtubeConnections").find({ userId: user._id }, { projection }).sort({ active: -1, updatedAt: -1 }).limit(30).toArray().catch(() => []),
    db.collection("tiktokConnections").find({ userId: user._id }, { projection }).sort({ active: -1, updatedAt: -1 }).limit(30).toArray().catch(() => []),
    db.collection("facebookPageConnections").find({ userId: user._id }, { projection }).sort({ active: -1, updatedAt: -1 }).limit(50).toArray().catch(() => []),
    db.collection("toolJobs").find({ userId: user._id }, { projection }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    db.collection("youtubeBulkJobs").find({ userId: user._id }, { projection: { ...projection, results: 0 } }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    db.collection("tiktokJobs").find({ userId: user._id }, { projection }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    db.collection("facebookPublishJobs").find({ userId: user._id }, { projection: { ...projection, results: 0 } }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    db.collection("social_publish_jobs").find({ ownerId: user._id }, { projection }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    ownedProjectIds.length ? db.collection("mediaRenderJobs").find({ projectId: { $in: ownedProjectIds } }, { projection }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []) : [],
    db.collection("aiVideoRemakeJobs").find({ userId: user._id }, { projection: { ...projection, input: 0, rightsManifest: 0, estimate: 0 } }).sort({ updatedAt: -1 }).limit(40).toArray().catch(() => []),
    db.collection("loginEvents").find({ userId: user._id }, { projection: { userAgent: 0, ip: 0, userId: 0 } }).sort({ createdAt: -1 }).limit(12).toArray().catch(() => [])
  ]);
  const serverConfigured = {
    youtube: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
    facebook: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    gemini: Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  };
  const providerCard = (id, label, rows, route, scopeOf, expiryOf) => {
    const active = rows.find((row) => row.active) || rows[0];
    return {
      id, label, state: active ? "connected" : serverConfigured[id] ? "degraded" : "unconfigured",
      stateLabel: active ? `Đã kết nối ${rows.length}` : serverConfigured[id] ? "Server đã cấu hình · chưa có tài khoản" : "Chưa cấu hình",
      accountLabel: active ? clean(active.channelTitle || active.displayName || active.pageName || `${rows.length} tài khoản`, 180) : "",
      scopes: active ? scopeOf(active) : [], expiresAt: active ? expiryOf(active) : null, source: "server-vault-user-scoped", route
    };
  };
  const integrations = [
    providerCard("youtube", "YouTube", youtube, "/davinci-resolve/youtube", row => String(row.scopes || "").split(/\s+/).filter(Boolean).slice(0, 20), row => row.expiresAt || null),
    providerCard("tiktok", "TikTok", tiktok, "/davinci-resolve/tiktok", row => Array.isArray(row.scopes) ? row.scopes.slice(0, 20) : [], row => row.accessTokenExpiresAt || null),
    providerCard("facebook", "Facebook / Instagram", facebook, "/davinci-resolve/facebook", row => Array.isArray(row.grantedPermissions) ? row.grantedPermissions.slice(0, 20) : [], row => row.tokenExpiresAt || null),
    ...[["gemini", "Gemini", "/ai"], ["openai", "OpenAI", "/ai"], ["resend", "Resend / Email", "/system"]].map(([id, label, route]) => ({ id, label, state: serverConfigured[id] ? "degraded" : "unconfigured", stateLabel: serverConfigured[id] ? "Đã cấu hình · không live-probe trong request này" : "Chưa cấu hình", accountLabel: "Khóa được giữ phía server", scopes: [], expiresAt: null, source: "server-config-only", route }))
  ];
  const jobs = [
    ...toolJobs.map(item => publicSystemJob(item, "tool")), ...youtubeJobs.map(item => publicSystemJob(item, "youtube")),
    ...tiktokJobs.map(item => publicSystemJob(item, "tiktok")), ...facebookJobs.map(item => publicSystemJob(item, "facebook")), ...socialJobs.map(item => publicSystemJob(item, "social")),
    ...mediaJobs.map(item => publicSystemJob(item, "media")), ...aiVideoJobs.map(item => publicSystemJob(item, "ai-video"))
  ].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 100);
  return { integrations, jobs, loginHistory: loginHistory.map(item => ({ type: clean(item.type, 60), browser: clean(item.browser, 60), platform: clean(item.platform, 60), success: item.success !== false, reason: item.success === false ? clean(item.reason, 100) : "", createdAt: item.createdAt || null })) };
}

async function controlSystemJob(db, user, body) {
  const source = clean(body.source, 30).toLowerCase(); const control = clean(body.control, 20).toLowerCase(); const id = objectId(body.jobId);
  if (![...SYSTEM_JOB_SOURCES, "media", "ai-video"].includes(source) || !id || !["pause", "resume", "retry", "cancel"].includes(control)) { const error = new Error("Điều khiển tác vụ không hợp lệ."); error.statusCode = 400; throw error; }
  if (source === "tool" && control === "cancel") {
    const current = await db.collection("toolJobs").findOne({ _id: id, userId: user._id });
    if (!current) { const error = new Error("Tác vụ không thuộc tài khoản hiện tại."); error.statusCode = 404; throw error; }
    if (!TERMINAL_JOB_STATES.has(String(current.state || "").toLowerCase())) await db.collection("toolJobs").updateOne({ _id: id, userId: user._id }, { $set: { state: "cancelled", finishedAt: new Date(), updatedAt: new Date() } });
    return publicSystemJob({ ...current, state: "cancelled", updatedAt: new Date() }, source);
  }
  if (source === "tiktok") {
    const current = await db.collection("tiktokJobs").findOne({ _id: id, userId: user._id });
    if (!current) { const error = new Error("Tác vụ không thuộc tài khoản hiện tại."); error.statusCode = 404; throw error; }
    const next = control === "pause" ? "paused" : ["resume", "retry"].includes(control) ? "ready" : "";
    if (!next) { const error = new Error("TikTok job chưa hỗ trợ hủy từ System Center."); error.statusCode = 409; throw error; }
    await db.collection("tiktokJobs").updateOne({ _id: id, userId: user._id }, { $set: { status: next, updatedAt: new Date() }, ...(control === "retry" ? { $inc: { retryCount: 1 } } : {}) });
    return publicSystemJob({ ...current, status: next, updatedAt: new Date() }, source);
  }
  if (source === "media") {
    const current = await db.collection("mediaRenderJobs").findOne({ _id: id });
    const project = current ? await db.collection("mediaProjects").findOne({ _id: current.projectId, ownerId: user._id, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }, { projection: { _id: 1 } }) : null;
    if (!current || !project) { const error = new Error("Render job không thuộc tài khoản hiện tại."); error.statusCode = 404; throw error; }
    if (current.remoteId) { const error = new Error("Render đang do worker ngoài xử lý; hãy điều khiển trong Media module để backend nhận xác nhận từ worker."); error.statusCode = 409; throw error; }
    const next = { pause: "paused", resume: "queued", retry: "needs-worker", cancel: "canceled" }[control];
    await db.collection("mediaRenderJobs").updateOne({ _id: id, projectId: project._id }, { $set: { status: next, message: "System Center đã cập nhật kế hoạch local; chưa có external worker.", updatedAt: new Date() }, $push: { logs: { code: `SYSTEM_${control.toUpperCase()}`, message: "Không có external worker; cập nhật trạng thái điều phối.", at: new Date() } } });
    return publicSystemJob({ ...current, status: next, updatedAt: new Date() }, source);
  }
  if (source === "ai-video") {
    if (control === "retry") { const error = new Error("Retry AI Video cần quote mới và xác nhận rủi ro tính phí trùng trong module nguồn."); error.statusCode = 409; throw error; }
    const current = await db.collection("aiVideoRemakeJobs").findOne({ _id: id, userId: user._id });
    if (!current) { const error = new Error("AI Video job không thuộc tài khoản hiện tại."); error.statusCode = 404; throw error; }
    // Provider-aware control already exists in the dedicated service. System
    // Center refuses to fake provider acknowledgement and sends users there.
    const error = new Error("AI Video cần xác nhận điều khiển từ provider; hãy mở module nguồn để thực hiện an toàn."); error.statusCode = 409; throw error;
  }
  const error = new Error("Loại tác vụ này cần điều khiển trong module nguồn để giữ đúng checkpoint/provider."); error.statusCode = 409; throw error;
}

const DEFAULT_REALTIME_SERVER_URL = "https://hoangdaika13-astra-realtime.onrender.com";

async function realtimeReadiness() {
  const baseUrl = String(process.env.REALTIME_SERVER_URL || DEFAULT_REALTIME_SERVER_URL).trim().replace(/\/$/, "");
  if (!baseUrl) return { configured: false, connected: false, url: "", error: "missing-url" };
  const controller = new AbortController();
  const started = Date.now();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return {
      configured: true,
      connected: response.ok && data?.ok === true && data?.database?.connected === true,
      url: baseUrl,
      databaseConnected: data?.database?.connected === true,
      turnConfigured: data?.calls?.turnConfigured === true,
      latencyMs: Date.now() - started,
      checkedAt: data?.checkedAt || new Date()
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      url: baseUrl,
      latencyMs: Date.now() - started,
      error: error?.name === "AbortError" ? "timeout" : "unreachable"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function databaseReadiness() {
  if (!String(process.env.MONGODB_URI || "").trim()) return { configured: false, connected: false, latencyMs: null, checkedAt: new Date(), error: "not-configured" };
  const started = Date.now();
  let timeout;
  try {
    const db = await Promise.race([
      database(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("database-timeout")), 3500);
      })
    ]);
    await db.command({ ping: 1 });
    return { configured: true, connected: true, latencyMs: Date.now() - started, checkedAt: new Date(), error: "" };
  } catch (error) {
    return { configured: true, connected: false, latencyMs: Date.now() - started, checkedAt: new Date(), error: error?.message === "database-timeout" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

function readinessSnapshot({ databaseConnected = false, realtime = {} } = {}) {
  const databaseStatus = typeof databaseConnected === "object" ? databaseConnected : { configured: Boolean(process.env.MONGODB_URI), connected: Boolean(databaseConnected), latencyMs: null, checkedAt: new Date(), error: databaseConnected ? "" : "unreachable" };
  const publicDatabaseStatus = databaseStatus.configured
    ? { ...databaseStatus, database: process.env.MONGODB_DB || "hoangdaika13_site" }
    : { configured: false, connected: false, database: process.env.MONGODB_DB || "hoangdaika13_site" };
  const has = (...names) => names.every((name) => Boolean(String(process.env[name] || "").trim()));
  const gemini = Boolean(String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());
  const openai = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
  const facebook = has("META_APP_ID", "META_APP_SECRET");
  const googleJsonApi = has("GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID");
  const googleFreeCse = Boolean(String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim());
  const vertexSearch = has("VERTEX_SEARCH_PROJECT_ID", "VERTEX_SEARCH_APP_ID", "VERTEX_SEARCH_API_KEY");
  const googleSearch = googleJsonApi || googleFreeCse || vertexSearch;
  const youtube = Boolean(String(process.env.YOUTUBE_API_KEY || "").trim());
  const payos = has("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY");
  const email = has("RESEND_API_KEY", "EMAIL_FROM");
  const eleven = Boolean(String(process.env.ELEVENLABS_API_KEY || "").trim());
  const downloader = Boolean(String(process.env.VIDEO_DOWNLOADER_API_URL || "").trim());
  const vercelBlob = Boolean(String(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN || "").trim());
  const s3Storage = has("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY");
  const objectStorage = vercelBlob || s3Storage;
  const missing = [];
  if (!email) missing.push({ id: "email-verification", label: "Xác minh email", connect: "Resend API + EMAIL_FROM đã xác minh" });
  if (!googleSearch) missing.push({ id: "google-search", label: "Google Search", connect: "Google Search Engine ID hoặc Agent Search/Vertex" });
  if (!eleven) missing.push({ id: "elevenlabs", label: "Music/Sound AI", connect: "ELEVENLABS_API_KEY" });
  if (!downloader) missing.push({ id: "download-engine", label: "Download Center", connect: "VIDEO_DOWNLOADER_API_URL và khóa engine" });
  if (!objectStorage) missing.push({ id: "object-storage", label: "Cloud Storage file lớn", connect: "Vercel Blob hoặc S3/R2" });
  if (!realtime.connected) missing.push({ id: "realtime-server", label: "Realtime/Socket.io", connect: "Render cần online, kết nối MongoDB và dùng cùng JWT_SECRET với Vercel" });
  return {
    checkedAt: new Date(),
    database: publicDatabaseStatus,
    auth: {
      googleOAuth: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
      passkey: true,
      emailVerification: email,
      captcha: has("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY")
    },
    search: {
      googleConfigured: googleSearch,
      googleJsonApiConfigured: googleJsonApi,
      googleFreeCse,
      youtubeConfigured: youtube,
      provider: vertexSearch ? "vertex-ai-search" : googleFreeCse ? "programmable-search-element" : "none",
      note: vertexSearch
        ? "Agent Search/Vertex AI Search đã cấu hình."
        : googleFreeCse
          ? "Google Programmable Search Element miễn phí đang sẵn sàng; JSON API chỉ là đường tùy chọn."
          : "Chưa có đủ cấu hình."
    },
    ai: { gemini: gemini, openai, geminiKeySource: process.env.GEMINI_API_KEYS ? "gemini-pool" : process.env.GEMINI_API_KEY ? "gemini" : process.env.GOOGLE_AI_API_KEY ? "google-ai" : "none", elevenLabs: eleven },
    integrations: { openai, gemini, youtube, facebook, resend: email },
    payments: { payos, donationReceiptEmail: email },
    storage: { metadata: true, smallTextPayload: true, objectStorage, provider: vercelBlob ? "vercel-blob-private" : s3Storage ? "s3-compatible" : "mongodb" },
    download: { engine: downloader },
    realtime: {
      configured: Boolean(realtime.configured),
      connected: Boolean(realtime.connected),
      databaseConnected: Boolean(realtime.databaseConnected),
      turnConfigured: Boolean(realtime.turnConfigured),
      provider: "Render + Socket.IO",
      checkedAt: realtime.checkedAt || new Date(),
      error: realtime.error || ""
    },
    requiresConnection: missing,
    services: [
      { id: "frontend", label: "Website frontend", state: "online", detail: "Health route đang phản hồi", latencyMs: null, lastSuccessAt: new Date(), lastErrorAt: null, requestId: "", checkedAt: new Date(), source: "vercel-function" },
      { id: "api", label: "API Vercel", state: "online", detail: "Health handler đang chạy", latencyMs: null, lastSuccessAt: new Date(), lastErrorAt: null, requestId: "", checkedAt: new Date(), source: "server-handler" },
      { id: "database", label: "MongoDB", state: databaseStatus.connected ? "online" : databaseStatus.configured ? "offline" : "unconfigured", detail: databaseStatus.connected ? "Ping database thành công" : databaseStatus.error || "Chưa cấu hình", latencyMs: databaseStatus.latencyMs, lastSuccessAt: databaseStatus.connected ? databaseStatus.checkedAt : null, lastErrorAt: databaseStatus.connected ? null : databaseStatus.checkedAt, requestId: "", checkedAt: databaseStatus.checkedAt, source: "mongodb-ping" },
      { id: "realtime", label: "Realtime / WebSocket", state: realtime.connected ? "online" : realtime.configured ? "offline" : "unconfigured", detail: realtime.connected ? "HTTP health và database realtime đã xác nhận" : realtime.error || "Chưa cấu hình", latencyMs: Number(realtime.latencyMs || 0) || null, lastSuccessAt: realtime.connected ? realtime.checkedAt : null, lastErrorAt: realtime.connected ? null : realtime.checkedAt, requestId: "", checkedAt: realtime.checkedAt || new Date(), source: "realtime-http-health" },
      ...[["object-storage", "Object Storage", objectStorage], ["resend", "Resend / email", email], ["google-oauth", "Google OAuth", has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")], ["youtube", "YouTube", youtube], ["facebook", "Facebook", facebook], ["gemini", "Gemini", gemini], ["openai", "OpenAI", openai]].map(([id, label, configured]) => ({ id, label, state: configured ? "degraded" : "unconfigured", detail: configured ? "Đã cấu hình; health request này không gọi provider để tránh quota" : "Thiếu cấu hình server", latencyMs: null, lastSuccessAt: null, lastErrorAt: null, requestId: "", checkedAt: new Date(), source: "server-config-only" }))
    ]
  };
}

module.exports = async function handler(req, res) {
  if (String(req.query.accountCenter || "") === "1") return accountCenterHandler(req, res);
  if (String(req.query.facebookWebhook || "") === "1") return metaWebhookHandler(req, res);
  if (String(req.query.tiktokCreatorManager || "") === "1" && String(req.query.tiktokAction || req.query.action || "") === "webhook") {
    if (String(req.method || "").toUpperCase() !== "POST") return res.status(405).json({ error: "Method not allowed." });
    return tiktokCreatorManagerHandler(req, res);
  }
  try {
    await hydrateJsonBody(req);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.statusCode === 413 ? "Request body too large." : "Invalid JSON body." });
  }
  if (String(req.query.youtubePublisher || "") === "1") return youtubePublisherHandler(req, res);
  if (String(req.query.facebookPageManager || "") === "1") return facebookPageManagerHandler(req, res);
  if (String(req.query.tiktokCreatorManager || "") === "1") return tiktokCreatorManagerHandler(req, res);
  if (req.query.privacyRoute === "consent") return privacyConsentHandler(req, res);
  if (req.method === "GET" && req.query.view === "health") {
    setCors(req, res);
    const [databaseConnected, realtime] = await Promise.all([
      databaseReadiness(),
      realtimeReadiness()
    ]);
    return res.status(200).json({ ok: true, health: readinessSnapshot({ databaseConnected, realtime }) });
  }
  if (req.query.securityReport === "csp") {
    return withApi(req, res, async ({ db, body }) => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const forwardedIp = clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80);
      await enforceRateLimit(db, `csp-report:${forwardedIp}`, 60, 15 * 60 * 1000);
      await Promise.all([
        db.collection("securityCspReports").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("securityCspReports").createIndex({ effectiveDirective: 1, createdAt: -1 })
      ]);
      await db.collection("securityCspReports").insertOne({
        ...safeCspReport(body),
        requestId: clean(req.hhRequestId, 128),
        userAgentHash: crypto.createHash("sha256").update(clean(req.headers["user-agent"], 500)).digest("hex")
      });
      return res.status(204).end();
    }, { maxBodyBytes: 64 * 1024, maxDepth: 12, maxNodes: 1_000, maxArrayLength: 100 });
  }
  return withApi(req, res, async ({ db, body: parsedBody }) => {
    if (req.method === "POST" && req.query.view === "system-job-control") {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để điều khiển tác vụ.", code: "AUTH_REQUIRED" });
      await enforceRateLimit(db, `system-job-control:${user._id}`, 80, 15 * 60 * 1000);
      const job = await controlSystemJob(db, user, parsedBody || {});
      return res.status(200).json({ ok: true, confirmed: true, job, checkedAt: new Date(), privacy: { ownerIsolated: true, secretsReturned: false } });
    }
    if (req.method === "POST" && req.query.view === "system-incident-report") {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để gửi báo cáo lỗi.", code: "AUTH_REQUIRED" });
      await enforceRateLimit(db, `system-incident-report:${user._id}`, 20, 60 * 60 * 1000);
      if (parsedBody?.screenshotIncluded === true) return res.status(400).json({ error: "Screenshot chỉ được gửi qua luồng có consent riêng.", code: "SCREENSHOT_CONSENT_REQUIRED" });
      const incident = safeIncident(parsedBody?.incident);
      const requestId = `sys-${crypto.randomBytes(10).toString("hex")}`;
      await db.collection("systemUserIncidents").insertOne({ userId: user._id, requestId, ...incident, screenshotIncluded: false, status: "received", createdAt: new Date(), privacy: { secretScrubbed: true, fullEmailStored: false, cookieStored: false, screenshotStored: false } });
      return res.status(202).json({ ok: true, confirmed: true, requestId, status: "received", privacy: { ownerIsolated: true, secretScrubbed: true, screenshotIncluded: false } });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const user = await currentUser(req);
      const visitorId = clean(body.visitorId, 160);
      const sessionId = safeKey(body.sessionId, "default").slice(0, 100);
      const identity = user ? `user:${user._id}:session:${sessionId}` : visitorId ? `guest:${visitorId}:session:${sessionId}` : "";
      if (!identity) return res.status(400).json({ error: "Missing visitor identifier" });
      await enforceRateLimit(db, `telemetry:${identity}`, 80, 10 * 60 * 1000);
      const now = new Date();
      const analyticsConsent = body.analyticsConsent === true;
      const incoming = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
      const events = analyticsConsent ? incoming.map((item) => safeTelemetryEvent(item, now)).filter(Boolean) : [];
      const page = analyticsConsent ? safeRoute(body.page || events[0]?.route || "/") : "/private";
      const latest = events.at(-1) || null;
      const module = analyticsConsent ? safeKey(body.module || latest?.module || page.split("/").filter(Boolean).at(-1) || "home", "home") : "private";
      const activityState = ["active", "idle", "background"].includes(body.activityState) ? body.activityState : "active";
      const device = analyticsConsent && ["desktop", "tablet", "mobile"].includes(body.device) ? body.device : "unknown";
      const browser = analyticsConsent ? safeKey(body.browser, "browser").slice(0, 40) : "private";
      const viewport = analyticsConsent ? safeKey(body.viewport, "unknown").slice(0, 40) : "private";
      const presenceState = { identity, kind: user ? "registered" : "guest", userId: user?._id || null, sessionId, lastSeenAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), page, module, activityState, activeSeconds: analyticsConsent ? Math.max(0, Math.min(86400, Number(body.activeSeconds || 0))) : 0, device, browser, viewport, analyticsConsent };
      if (latest) presenceState.lastAction = clean(latest.label || latest.action, 100);
      await Promise.all([
        db.collection("presence").createIndex({ lastSeenAt: -1 }),
        db.collection("presence").createIndex({ userId: 1, lastSeenAt: -1 }),
        db.collection("presence").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("presence").updateMany({ expiresAt: { $exists: false } }, { $set: { expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }),
        db.collection("telemetryEvents").createIndex({ createdAt: -1 }),
        db.collection("telemetryEvents").createIndex({ type: 1, createdAt: -1 }),
        db.collection("telemetryEvents").createIndex({ userId: 1, createdAt: -1 }),
        db.collection("telemetryEvents").createIndex({ sessionId: 1, createdAt: -1 }),
        db.collection("telemetryEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      ]);
      await db.collection("presence").updateOne(
        { identity },
        { $set: presenceState, $setOnInsert: { firstSeenAt: now } },
        { upsert: true }
      );
      if (events.length) {
        await db.collection("telemetryEvents").insertMany(events.map((item) => ({ ...item, identity, kind: user ? "registered" : "guest", userId: user?._id || null, sessionId, device, browser, viewport })));
      }
      const [online, flags] = await Promise.all([
        db.collection("presence").countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } }),
        db.collection("communityFeatureFlags").find({}, { projection: { key: 1, enabled: 1, rollout: 1 } }).limit(200).toArray()
      ]);
      const disabledFeatures = flags.filter((flag) => !flag.enabled || rolloutBucket(identity, clean(flag.key, 100)) >= Math.max(0, Math.min(100, Number(flag.rollout || 0)))).map((flag) => clean(flag.key, 100)).filter(Boolean);
      return res.status(200).json({ ok: true, acceptedEvents: events.length, online, activeWindowSeconds: ACTIVE_WINDOW_MS / 1000, checkedAt: now, adapter: { confirmed: true, mode: "backend", provider: "mongodb", aggregateOnly: true }, policy: { restrictedFeatures: user && Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures.map((item) => clean(item, 100)).filter(Boolean).slice(0, 100) : [], disabledFeatures }, privacy: { interactionMetadataStored: analyticsConsent, presenceDetailStored: analyticsConsent, rawKeystrokesStored: false, formValuesStored: false, promptBodiesStored: false, passwordsStored: false, tokensStored: false, privateMessagesStored: false, errorMessagesStored: false, stackTracesStored: false, retentionDays: 30 } });
    }
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (req.query.view === "gateway-quotas") {
      const quotas = await quotaStatus(db);
      return res.status(200).json({ ok: true, confirmed: true, quotas, checkedAt: new Date(), privacy: { aggregateOnly: true, identitiesReturned: false, queriesStored: false, secretsReturned: false } });
    }
    const user = await currentUser(req);
    if (req.query.view === "system-me") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để xem Hệ thống cá nhân.", code: "AUTH_REQUIRED" });
      const snapshot = await systemUserSnapshot(db, user);
      return res.status(200).json({ ok: true, confirmed: true, ...snapshot, checkedAt: new Date(), privacy: { ownerIsolated: true, adminDataIncluded: false, tokensReturned: false, secretsReturned: false, payloadsReturned: false } });
    }
    if (req.query.view === "gateway-audit") {
      requireRoles(user, ["admin"]);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const summary = await db.collection("gatewayAuditLogs").aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { provider: "$provider", outcome: "$outcome" }, requests: { $sum: 1 }, units: { $sum: "$cost" } } },
        { $project: { _id: 0, provider: "$_id.provider", outcome: "$_id.outcome", requests: 1, units: 1 } },
        { $sort: { provider: 1, outcome: 1 } }
      ]).toArray();
      return res.status(200).json({ ok: true, confirmed: true, windowHours: 24, summary, privacy: { aggregateOnly: true, actorHashesReturned: false, queriesStored: false, secretsReturned: false } });
    }
    if (!isAdminUser(user)) return res.status(403).json({ error: "Tài khoản không có quyền truy cập Admin Panel." });
    if (req.query.view === "analytics") {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const [events5m, events30m, errors30m, online, topRoutes] = await Promise.all([
        db.collection("telemetryEvents").countDocuments({ createdAt: { $gte: fiveMinutesAgo } }),
        db.collection("telemetryEvents").countDocuments({ createdAt: { $gte: thirtyMinutesAgo } }),
        db.collection("telemetryEvents").countDocuments({ type: "error", createdAt: { $gte: thirtyMinutesAgo } }),
        db.collection("presence").countDocuments({ lastSeenAt: { $gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } }),
        db.collection("telemetryEvents").aggregate([
          { $match: { createdAt: { $gte: thirtyMinutesAgo }, type: "page_view" } },
          { $group: { _id: "$route", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, route: "$_id", count: 1 } }
        ]).toArray()
      ]);
      return res.status(200).json({
        ok: true,
        checkedAt: now,
        adapter: { confirmed: true, mode: "backend", provider: "mongodb", aggregateOnly: true },
        windows: { fiveMinutes: { events: events5m }, thirtyMinutes: { events: events30m, errors: errors30m } },
        online,
        topRoutes,
        privacy: { aggregateOnly: true, identitiesReturned: false, sessionsReturned: false, rawInputReturned: false, errorMessagesReturned: false }
      });
    }
    if (req.query.view === "users") {
      const rows = await db.collection("users")
        .find({}, { projection: { passwordHash: 0, providerId: 0, tokenVersion: 0 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      const activePresence = await db.collection("presence")
        .find({ kind: "registered", lastSeenAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } }, { projection: { userId: 1 } })
        .toArray();
      const onlineIds = new Set(activePresence.map((item) => String(item.userId || "")));
      const users = rows.map((item) => ({
        id: String(item._id), name: item.name || item.displayName || "Chưa đặt tên", email: item.email || "",
        provider: item.provider || item.lastProvider || "local", avatar: item.avatar || "",
        consent: Boolean(item.consent), createdAt: item.createdAt || null, lastLoginAt: item.lastLoginAt || null,
        online: onlineIds.has(String(item._id))
      }));
      return res.status(200).json({ ok: true, users, stats: { total: users.length, online: users.filter((item) => item.online).length, consented: users.filter((item) => item.consent).length }, checkedAt: new Date() });
    }
    const names = ["users", "moduleRecords", "moduleActions", "tickets", "orders", "storageFiles", "notificationSubscriptions", "events", "donations"];
    const counts = {};
    await Promise.all(names.map(async (name) => {
      counts[name] = await db.collection(name).countDocuments();
    }));
    const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const [onlineVisitors, onlineRegistered] = await Promise.all([
      db.collection("presence").countDocuments({ lastSeenAt: { $gte: activeSince } }),
      db.collection("presence").countDocuments({ lastSeenAt: { $gte: activeSince }, kind: "registered" })
    ]);
    const activePresence = await db.collection("presence")
      .find({ lastSeenAt: { $gte: activeSince } })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray();
    const userIds = activePresence.filter((item) => item.userId).map((item) => item.userId);
    const activeUsers = userIds.length
      ? await db.collection("users").find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1 } }).toArray()
      : [];
    const userById = new Map(activeUsers.map((item) => [String(item._id), item]));
    const activeVisitors = activePresence.map((item) => {
      const profile = item.userId ? userById.get(String(item.userId)) : null;
      return {
        kind: item.kind === "registered" ? "registered" : "guest",
        name: profile?.name || (item.kind === "registered" ? "Tài khoản đã đăng nhập" : "Khách ẩn danh"),
        email: profile?.email || "",
        page: item.page || "/",
        lastSeenAt: item.lastSeenAt
      };
    });
    const recentEvents = await db.collection("events").find({}).sort({ createdAt: -1 }).limit(12).project({ type: 1, moduleId: 1, createdAt: 1 }).toArray();
    return res.status(200).json({ ok: true, counts, audience: { registeredUsers: counts.users || 0, onlineVisitors, onlineRegistered, activeWindowSeconds: ACTIVE_WINDOW_MS / 1000, activeVisitors }, recentEvents, checkedAt: new Date() });
  });
};

module.exports.config = { api: { bodyParser: false } };

module.exports.__test = Object.freeze({ safeCspReport, safeTelemetryEvent, safeTelemetryMeta, safeRoute, TELEMETRY_TYPES });
