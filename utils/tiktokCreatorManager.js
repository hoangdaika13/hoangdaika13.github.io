const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { decryptToken, encryptToken, publicConnection, verifyWebhookSignature } = require("./tiktokSecurity");

const API_ORIGIN = "https://open.tiktokapis.com";
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const DEFAULT_CALLBACK_URL = "https://hoang8.com/api/tiktok/oauth/callback";
const BASE_SCOPES = Object.freeze(["user.info.basic"]);
const OPTIONAL_SCOPES = Object.freeze(["user.info.profile", "user.info.stats", "video.list", "video.upload", "video.publish"]);
const ALL_SCOPES = Object.freeze([...BASE_SCOPES, ...OPTIONAL_SCOPES]);
const ALLOWED_VIDEO_MIME = Object.freeze(["video/mp4", "video/quicktime", "video/webm"]);
const TERMINAL_PROVIDER_STATUSES = new Set(["PUBLISH_COMPLETE", "SEND_TO_USER_INBOX", "PUBLICLY_AVAILABLE", "FAILED"]);
const WEBHOOK_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const STATUS = Object.freeze({ local: "Dùng ngay · xử lý cục bộ", connection: "Cần kết nối TikTok", consent: "Cần người dùng cấp quyền", audit: "Cần TikTok duyệt scope", private: "Chỉ đăng riêng tư khi chưa audit", business: "Cần TikTok for Business", shop: "Cần TikTok Shop Partner", unsupported: "Chưa được API chính thức hỗ trợ" });

function fail(message, statusCode = 400, code = "TIKTOK_MANAGER_ERROR") { return Object.assign(new Error(message), { statusCode, code }); }
function routeOf(req) { const value = req.query.tiktokAction ?? req.query.action; return Array.isArray(value) ? value.map((item) => clean(item, 80)).join("/") : clean(value, 240); }
function appOrigin(req) { return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`; }
function callbackUrl() {
  try {
    const url = new URL(String(process.env.TIKTOK_REDIRECT_URI || DEFAULT_CALLBACK_URL));
    const origins = new Set(["https://hoang8.com", "https://www.hoang8.com", process.env.PUBLIC_SITE_URL, process.env.FRONTEND_URL].filter(Boolean).map((value) => { try { return new URL(value).origin; } catch { return ""; } }).filter(Boolean));
    if (url.protocol === "https:" && origins.has(url.origin) && url.pathname === "/api/tiktok/oauth/callback" && !url.search && !url.hash) return url.toString();
  } catch {}
  return DEFAULT_CALLBACK_URL;
}
function encryptionConfigured() { return String(process.env.TIKTOK_TOKEN_ENCRYPTION_KEY || "").length >= 32; }
function auditConfigured() { return String(process.env.TIKTOK_CONTENT_POSTING_AUDITED || "").toLowerCase() === "true"; }
function safeHash(value) { const hash = clean(value || "#/davinci-resolve/tiktok", 240); return /^#\/davinci-resolve\/tiktok(?:[/?].*)?$/.test(hash) ? hash : "#/davinci-resolve/tiktok"; }
function safeFrontend(value) { try { const url = new URL(String(value || "https://hoang8.com")); return new Set(["https://hoang8.com", "https://www.hoang8.com", process.env.PUBLIC_SITE_URL, process.env.FRONTEND_URL].filter(Boolean)).has(url.origin) ? url.origin : "https://hoang8.com"; } catch { return "https://hoang8.com"; } }
function requiredScopes(input) { const requested = new Set(Array.isArray(input) ? input : []); return ALL_SCOPES.filter((scope) => requested.has(scope) || BASE_SCOPES.includes(scope)); }
function connectionHint(req, body = {}) { return clean(body.connectionId || req.query.connectionId || "none", 120) || "none"; }
function rateLimitKey(userId, connectionId, route) { return `tiktok:${String(userId)}:${clean(connectionId || "none", 120)}:${clean(route || "unknown", 160)}`; }
function rawBodyBuffer(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  return null;
}
function readRawBody(req, maxBytes = 1024 * 1024) {
  const existing = rawBodyBuffer(req);
  if (existing) return existing.length <= maxBytes ? Promise.resolve(existing) : Promise.reject(fail("Webhook quá lớn.", 413, "TIKTOK_WEBHOOK_TOO_LARGE"));
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    req.on("data", (chunk) => { if (settled) return; size += chunk.length; if (size > maxBytes) { settled = true; reject(fail("Webhook quá lớn.", 413, "TIKTOK_WEBHOOK_TOO_LARGE")); req.destroy(); } else chunks.push(chunk); });
    req.on("end", () => { if (!settled) resolve(Buffer.concat(chunks)); });
    req.on("error", (error) => { if (!settled) reject(error); });
  });
}
function safeProviderStatus(value) {
  let status = clean(value || "PROCESSING", 80).toUpperCase();
  if (status === "FAILED") return status;
  if (status === "SEND_TO_USER_INBOX") return status;
  if (status === "PUBLISH_COMPLETE") return status;
  if (status === "PUBLICLY_AVAILABLE") return status;
  if (status === "PUBLISHING") status = "PROCESSING";
  return /^[A-Z0-9_]{1,80}$/.test(status) ? status : "PROCESSING";
}
function statusProgress(status, current = 0) { return status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX" || status === "PUBLICLY_AVAILABLE" ? 100 : status === "FAILED" ? Number(current || 0) : Math.max(2, Number(current || 0)); }
function retryDelayMs(attempt = 0) { return Math.min(60000, 1500 * (2 ** Math.min(5, Math.max(0, Number(attempt || 0))))) + crypto.randomInt(250, 1251); }
function retryAfterMilliseconds(value) {
  const text = clean(value, 120);
  if (!text) return 0;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(60000, seconds * 1000);
  const date = new Date(text).getTime();
  return Number.isFinite(date) ? Math.min(60000, Math.max(0, date - Date.now())) : 0;
}
function retryAfterSeconds(error) {
  const numeric = Number(error?.retryAfter || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.ceil(numeric) : 0;
}
function parseWebhookContent(value) { if (value && typeof value === "object") return value; try { return JSON.parse(String(value || "{}")); } catch { return {}; } }
function webhookEventKey(payload) { return crypto.createHash("sha256").update(JSON.stringify([payload?.client_key || "", payload?.event || "", payload?.create_time || 0, payload?.user_openid || "", payload?.content || ""])).digest("hex"); }
function requireDirectPrivacy(mode, privacy) { if (!privacy) { if (mode === "direct") throw fail("Bạn phải tự chọn quyền riêng tư sau khi xem preview.", 400, "TIKTOK_PRIVACY_REQUIRED"); } return privacy; }

async function tiktok(path, token, options = {}) {
  const url = new URL(`${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`);
  if (url.origin !== API_ORIGIN) throw fail("TikTok API URL không nằm trong allowlist.", 400, "TIKTOK_SSRF_REJECTED");
  Object.entries(options.query || {}).forEach(([key, value]) => value !== undefined && value !== "" && url.searchParams.set(key, String(value)));
  const attempts = options.retrySafe === true || (options.method || "GET") === "GET" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try { response = await fetch(url, { method: options.method || "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(25000) }); }
    catch { if (attempt + 1 < attempts) { await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt))); continue; } throw fail("Không thể kết nối TikTok API.", 502, "TIKTOK_API_UNREACHABLE"); }
    const data = await response.json().catch(() => ({}));
    if (response.ok && (!data.error?.code || data.error.code === "ok")) return data;
    const error = fail(clean(data.error?.message || `TikTok API HTTP ${response.status}`, 300), response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400, clean(data.error?.code || "TIKTOK_API_ERROR", 100));
    const retryAfterMs = retryAfterMilliseconds(response.headers.get("retry-after"));
    if (response.status === 429 && retryAfterMs > 0) error.retryAfter = Math.ceil(retryAfterMs / 1000);
    if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) { const delay = Math.min(60000, Math.max(retryDelayMs(attempt), retryAfterMs)); await new Promise((resolve) => setTimeout(resolve, delay)); continue; }
    throw error;
  }
  throw fail("Không thể kết nối TikTok API.", 502, "TIKTOK_API_UNREACHABLE");
}

async function tokenRequest(params) {
  const response = await fetch(`${API_ORIGIN}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-store" }, body: new URLSearchParams(params), signal: AbortSignal.timeout(25000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw fail(clean(data.error_description || data.error || "TikTok không cấp token.", 250), 401, "TIKTOK_TOKEN_EXCHANGE_FAILED");
  return data;
}

async function ownedConnection(db, userId, connectionId = "") {
  const query = { userId, ...(connectionId ? { connectionId: clean(connectionId, 120) } : { active: true }) };
  const record = await db.collection("tiktokConnections").findOne(query);
  if (!record) throw fail("Tài khoản TikTok chưa kết nối hoặc không thuộc tài khoản HH hiện tại.", 404, "TIKTOK_CONNECTION_NOT_FOUND");
  return record;
}

async function accessToken(db, record) {
  if (new Date(record.accessTokenExpiresAt || 0).getTime() > Date.now() + 120000) return decryptToken(record.encryptedAccessToken, record);
  const refreshToken = decryptToken(record.encryptedRefreshToken, record);
  const tokens = await tokenRequest({ client_key: process.env.TIKTOK_CLIENT_KEY || "", client_secret: process.env.TIKTOK_CLIENT_SECRET || "", grant_type: "refresh_token", refresh_token: refreshToken });
  const next = { encryptedAccessToken: encryptToken(tokens.access_token, record), encryptedRefreshToken: encryptToken(tokens.refresh_token || refreshToken, record), accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 86400) * 1000), refreshTokenExpiresAt: new Date(Date.now() + Number(tokens.refresh_expires_in || 31536000) * 1000), scopes: String(tokens.scope || record.scopes?.join(",") || "").split(",").filter(Boolean), updatedAt: new Date() };
  await db.collection("tiktokConnections").updateOne({ _id: record._id, userId: record.userId }, { $set: next });
  return tokens.access_token;
}

function publicJob(item) { return { id: String(item._id), connectionId: item.connectionId || "", kind: item.kind, status: item.status, progress: Number(item.progress || 0), scheduledFor: item.scheduledFor || null, requiresConfirmation: item.requiresConfirmation !== false, confirmedAt: item.confirmedAt || null, providerReference: item.providerReference || "", error: item.error || "", createdAt: item.createdAt, updatedAt: item.updatedAt }; }
async function audit(db, userId, action, detail = {}) { await db.collection("tiktokAuditEvents").insertOne({ userId, actorId: userId, action: clean(action, 100), target: clean(detail.target, 100), result: clean(detail.result || "ok", 40), redactedMetadata: { kind: clean(detail.kind, 80), status: clean(detail.status, 80) }, createdAt: new Date() }); }

module.exports = async function tiktokCreatorManager(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const route = routeOf(req);
    const connections = db.collection("tiktokConnections"), states = db.collection("tiktokOauthStates"), jobs = db.collection("tiktokJobs"), snapshots = db.collection("tiktokSnapshots"), projects = db.collection("tiktokProjects"), audits = db.collection("tiktokAuditEvents"), webhookEvents = db.collection("tiktokWebhookEvents");
    await Promise.all([connections.createIndex({ userId: 1, connectionId: 1 }, { unique: true }), states.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), jobs.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true }), snapshots.createIndex({ userId: 1, capturedAt: -1 }), projects.createIndex({ userId: 1, updatedAt: -1 }), audits.createIndex({ userId: 1, createdAt: -1 })]);

    if (route === "webhook" && req.method === "POST") {
      if (!process.env.TIKTOK_CLIENT_SECRET) throw fail("TikTok webhook chưa được cấu hình.", 503, "TIKTOK_WEBHOOK_NOT_CONFIGURED");
      const raw = await readRawBody(req);
      const verified = verifyWebhookSignature(raw, req.headers["tiktok-signature"] || req.headers["TikTok-Signature"]);
      if (!verified.valid) throw fail(verified.reason === "expired" ? "TikTok webhook đã quá hạn." : "Chữ ký TikTok webhook không hợp lệ.", 401, verified.reason === "expired" ? "TIKTOK_WEBHOOK_EXPIRED" : "TIKTOK_WEBHOOK_SIGNATURE_INVALID");
      let payload;
      try { payload = JSON.parse(raw.toString("utf8") || "{}"); } catch { throw fail("TikTok webhook không phải JSON hợp lệ.", 400, "TIKTOK_WEBHOOK_JSON_INVALID"); }
      if (clean(payload.client_key, 200) !== clean(process.env.TIKTOK_CLIENT_KEY, 200)) throw fail("TikTok webhook không thuộc ứng dụng này.", 401, "TIKTOK_WEBHOOK_CLIENT_MISMATCH");
      const event = clean(payload.event, 100), content = parseWebhookContent(payload.content), eventKey = webhookEventKey(payload), now = new Date();
      await Promise.all([webhookEvents.createIndex({ eventKey: 1 }, { unique: true }), webhookEvents.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })]);
      const inserted = await webhookEvents.updateOne({ eventKey }, { $setOnInsert: { eventKey, event, userOpenId: clean(payload.user_openid, 160), providerReference: clean(content.publish_id || content.share_id, 160), createTime: new Date(Number(payload.create_time || verified.timestamp) * 1000), receivedAt: now, expiresAt: new Date(now.getTime() + WEBHOOK_RETENTION_MS) } }, { upsert: true });
      const duplicate = !inserted.upsertedCount;
      const publishId = clean(content.publish_id || content.share_id, 160);
      if (publishId && event.startsWith("post.publish.")) {
        const status = event === "post.publish.publicly_available" ? "publicly_available" : event === "post.publish.complete" ? "publish_complete" : event === "post.publish.inbox_delivered" ? "send_to_user_inbox" : event === "post.publish.failed" ? "failed" : "processing";
        const progress = status === "failed" ? 0 : status === "processing" ? 2 : 100;
        const matchingConnection = payload.user_openid ? await connections.findOne({ openId: clean(payload.user_openid, 160) }, { projection: { userId: 1, connectionId: 1 } }) : null;
        if (matchingConnection) await jobs.updateOne({ providerReference: publishId, userId: matchingConnection.userId, connectionId: matchingConnection.connectionId }, { $set: { status, progress, error: status === "failed" ? clean(content.reason || content.fail_reason, 240) : "", checkpoint: "webhook", lastProviderEventAt: now, updatedAt: now } });
      }
      if (event === "authorization.removed" && payload.user_openid) await connections.updateMany({ openId: clean(payload.user_openid, 160) }, { $set: { active: false, status: "revoked", encryptedAccessToken: "", encryptedRefreshToken: "", updatedAt: now } });
      await webhookEvents.updateOne({ eventKey }, { $set: { processedAt: new Date() } });
      return res.status(200).json({ ok: true, duplicate });
    }

    if (route === "oauth/callback" && req.method === "GET") {
      const rawState = clean(req.query.state, 250), stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const consumed = rawState ? await states.findOneAndDelete({ stateHash, expiresAt: { $gt: new Date() } }) : null;
      const state = consumed?.value || consumed, frontend = safeFrontend(state?.returnTo), returnHash = safeHash(state?.returnHash);
      if (!state) return res.redirect(`${frontend}/?tiktokError=${encodeURIComponent("Phiên kết nối TikTok đã hết hạn.")}${returnHash}`);
      const callbackUser = await currentUser(req);
      if (!callbackUser || String(callbackUser._id) !== String(state.userId)) return res.redirect(`${frontend}/?tiktokError=${encodeURIComponent("Tài khoản HH không khớp với người bắt đầu kết nối.")}${returnHash}`);
      if (req.query.error || !req.query.code) return res.redirect(`${frontend}/?tiktokError=${encodeURIComponent(clean(req.query.error_description || "TikTok đã hủy cấp quyền.", 180))}${returnHash}`);
      try {
        const tokens = await tokenRequest({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, code: clean(req.query.code, 2000), grant_type: "authorization_code", redirect_uri: callbackUrl(req) });
        const connectionId = crypto.createHash("sha256").update(String(tokens.open_id)).digest("hex").slice(0, 32), owner = { userId: state.userId, connectionId };
        const profile = await tiktok("/v2/user/info/", tokens.access_token, { query: { fields: "open_id,union_id,avatar_url,display_name,username,bio_description,is_verified,follower_count,following_count,likes_count,video_count" } });
        const userData = profile.data?.user || {};
        await connections.updateMany({ userId: state.userId }, { $set: { active: false } });
        await connections.updateOne(owner, { $set: { ...owner, openId: clean(tokens.open_id, 120), displayName: clean(userData.display_name, 180), username: clean(userData.username, 120), avatarUrl: clean(userData.avatar_url, 1200), scopes: String(tokens.scope || "").split(",").filter(Boolean), encryptedAccessToken: encryptToken(tokens.access_token, owner), encryptedRefreshToken: encryptToken(tokens.refresh_token, owner), accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 86400) * 1000), refreshTokenExpiresAt: new Date(Date.now() + Number(tokens.refresh_expires_in || 31536000) * 1000), active: true, status: "connected", connectedAt: new Date(), updatedAt: new Date() } }, { upsert: true });
        await audit(db, state.userId, "connection:created", { target: connectionId });
        return res.redirect(`${frontend}/?tiktokConnected=1${returnHash}`);
      } catch (error) { return res.redirect(`${frontend}/?tiktokError=${encodeURIComponent(clean(error.message, 180))}${returnHash}`); }
    }

    const user = await currentUser(req);
    if (!user) throw fail("Đăng nhập HH Platform để sử dụng TikTok Creator Galaxy.", 401, "AUTH_REQUIRED");
    let rateConnectionId = connectionHint(req, body);
    const rateJobId = clean(body.jobId || req.query.jobId, 24);
    if (rateConnectionId === "none" && ObjectId.isValid(rateJobId)) {
      const rateJob = await jobs.findOne({ _id: new ObjectId(rateJobId), userId: user._id }, { projection: { connectionId: 1 } });
      rateConnectionId = clean(rateJob?.connectionId || "none", 120) || "none";
    }
    await enforceRateLimit(db, rateLimitKey(user._id, rateConnectionId, route), route === "publish/status" ? 90 : route.startsWith("publish") ? 30 : 120, 15 * 60 * 1000);

    if (route === "oauth/start" && req.method === "POST") {
      if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) throw fail("TikTok Login Kit chưa được cấu hình trên Vercel.", 503, "TIKTOK_OAUTH_NOT_CONFIGURED");
      if (!encryptionConfigured()) throw fail("Thiếu TIKTOK_TOKEN_ENCRYPTION_KEY riêng tối thiểu 32 ký tự.", 503, "TIKTOK_ENCRYPTION_MISSING");
      const rawState = crypto.randomBytes(36).toString("base64url"), scopes = requiredScopes(body.scopes);
      await states.insertOne({ stateHash: crypto.createHash("sha256").update(rawState).digest("hex"), userId: user._id, scopes, returnTo: safeFrontend(body.returnTo), returnHash: safeHash(body.returnHash), createdAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
      const url = new URL(AUTHORIZE_URL); url.search = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, scope: scopes.join(","), response_type: "code", redirect_uri: callbackUrl(req), state: rawState });
      return res.status(200).json({ authorizeUrl: url.toString(), callbackUrl: callbackUrl(req), scopes });
    }

    if (route === "status" && req.method === "GET") {
      const [records, jobRows, snapshotRows, projectRows, auditRows] = await Promise.all([connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).limit(30).toArray(), jobs.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).toArray(), snapshots.find({ userId: user._id }).sort({ capturedAt: -1 }).limit(100).toArray(), projects.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(50).toArray(), audits.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).toArray()]);
      return res.status(200).json({ configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && encryptionConfigured()), audited: auditConfigured(), callbackUrl: callbackUrl(req), webhook: { configured: Boolean(process.env.TIKTOK_WEBHOOK_SECRET || process.env.TIKTOK_CLIENT_SECRET), callbackUrl: `${appOrigin(req)}/api/tiktok/webhook`, signature: "TikTok-Signature", idempotent: true }, connections: records.map(publicConnection), jobs: jobRows.map(publicJob), snapshots: snapshotRows.map((item) => ({ id: String(item._id), connectionId: item.connectionId || "", snapshotType: item.snapshotType, metrics: item.metrics || {}, capturedAt: item.capturedAt, source: item.source, sourceStatus: item.sourceStatus })), projects: projectRows.map((item) => ({ id: String(item._id), title: item.title, aigc: Boolean(item.aigc), updatedAt: item.updatedAt })), audits: auditRows.map((item) => ({ id: String(item._id), action: item.action, target: item.target, result: item.result, createdAt: item.createdAt })), statuses: STATUS, scopes: ALL_SCOPES, security: { ownerIsolation: true, tokenVault: encryptionConfigured() ? "AES-256-GCM" : "missing", tokenDelivery: "server-only", oauthState: "single-use-state", directPostConsent: "required" }, providers: { loginKit: Boolean(process.env.TIKTOK_CLIENT_KEY), contentPosting: Boolean(process.env.TIKTOK_CLIENT_KEY), business: Boolean(process.env.TIKTOK_BUSINESS_APP_ID && process.env.TIKTOK_BUSINESS_APP_SECRET), shop: Boolean(process.env.TIKTOK_SHOP_APP_KEY && process.env.TIKTOK_SHOP_APP_SECRET) } });
    }

    if (route === "connection/select" && req.method === "POST") { const record = await ownedConnection(db, user._id, body.connectionId); await connections.updateMany({ userId: user._id }, { $set: { active: false } }); await connections.updateOne({ _id: record._id, userId: user._id }, { $set: { active: true, updatedAt: new Date() } }); return res.status(200).json({ ok: true, connection: publicConnection({ ...record, active: true }) }); }
    if (route === "connection/disconnect" && req.method === "POST") { const record = await ownedConnection(db, user._id, body.connectionId); const token = await accessToken(db, record).catch(() => ""); if (token) await fetch(`${API_ORIGIN}/v2/oauth/revoke/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY || "", client_secret: process.env.TIKTOK_CLIENT_SECRET || "", token }), signal: AbortSignal.timeout(15000) }).catch(() => {}); await connections.deleteOne({ _id: record._id, userId: user._id }); await audit(db, user._id, "connection:revoked", { target: record.connectionId }); return res.status(200).json({ ok: true }); }
    if (route === "profile" && req.method === "GET") { const record = await ownedConnection(db, user._id, req.query.connectionId); const token = await accessToken(db, record); const profile = await tiktok("/v2/user/info/", token, { query: { fields: "open_id,avatar_url,display_name,username,bio_description,is_verified,follower_count,following_count,likes_count,video_count" } }); return res.status(200).json({ profile: profile.data?.user || {} }); }
    if (route === "videos" && req.method === "GET") { const record = await ownedConnection(db, user._id, req.query.connectionId); if (!record.scopes?.includes("video.list")) throw fail("Tài khoản chưa cấp scope video.list.", 403, "TIKTOK_SCOPE_REQUIRED"); const token = await accessToken(db, record); const videos = await tiktok("/v2/video/list/", token, { method: "POST", query: { fields: "id,title,video_description,duration,cover_image_url,embed_link,view_count,like_count,comment_count,share_count,create_time" }, body: { max_count: Math.min(20, Math.max(1, Number(req.query.limit || 20))) }, retrySafe: true }); return res.status(200).json(videos); }
    if (route === "creator-info" && req.method === "GET") { const record = await ownedConnection(db, user._id, req.query.connectionId); if (!record.scopes?.includes("video.publish")) throw fail("Tài khoản chưa cấp scope video.publish.", 403, "TIKTOK_SCOPE_REQUIRED"); await enforceRateLimit(db, rateLimitKey(user._id, record.connectionId, "provider:creator-info"), 30, 60 * 1000); const token = await accessToken(db, record); const info = await tiktok("/v2/post/publish/creator_info/query/", token, { method: "POST", body: {}, retrySafe: true }); return res.status(200).json({ creator: info.data || {}, audited: auditConfigured(), fetchedAt: new Date() }); }
    if (route === "snapshot/import" && req.method === "POST") { const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []; if (!rows.length) throw fail("Snapshot không có dữ liệu."); const doc = { userId: user._id, connectionId: clean(body.connectionId, 120), snapshotType: clean(body.snapshotType || "trend", 80), metrics: { rows }, capturedAt: new Date(), source: clean(body.source || "user-import", 80), sourceStatus: "user-provided" }; const result = await snapshots.insertOne(doc); await audit(db, user._id, "snapshot:import", { target: String(result.insertedId), kind: doc.snapshotType }); return res.status(201).json({ ok: true, id: String(result.insertedId) }); }
    if (route === "project/save" && req.method === "POST") { const id = clean(body.id, 24); const previous = ObjectId.isValid(id) ? await projects.findOne({ _id: new ObjectId(id), userId: user._id }) : null; const doc = { userId: user._id, title: clean(body.title || "Dự án TikTok", 180), script: clean(body.script, 8000), captions: clean(body.captions, 8000), rights: { owned: body.rights?.owned === true, musicConfirmed: body.rights?.musicConfirmed === true }, aigc: body.aigc === true, updatedAt: new Date(), createdAt: previous?.createdAt || new Date() }; if (previous) await projects.updateOne({ _id: previous._id, userId: user._id }, { $set: doc }); else { const result = await projects.insertOne(doc); doc._id = result.insertedId; } return res.status(200).json({ ok: true, project: { id: String(previous?._id || doc._id), title: doc.title, aigc: doc.aigc, updatedAt: doc.updatedAt } }); }
    if (route === "publish/prepare" && req.method === "POST") { const record = await ownedConnection(db, user._id, body.connectionId); const mode = body.mode === "draft" ? "draft" : "direct", privacy = clean(body.privacyLevel, 80), commercialContent = body.commercialContent === true, ownBrand = commercialContent && body.ownBrand === true, brandedContent = commercialContent && body.brandedContent === true; if (mode === "direct" && !privacy) throw fail("Bạn phải tự chọn quyền riêng tư sau khi xem preview.", 400, "TIKTOK_PRIVACY_REQUIRED"); if (mode === "direct" && !auditConfigured() && privacy !== "SELF_ONLY") throw fail("Ứng dụng chưa qua Content Posting audit nên chỉ được chọn SELF_ONLY.", 403, "TIKTOK_AUDIT_PRIVATE_ONLY"); if (commercialContent && !ownBrand && !brandedContent) throw fail("Nội dung thương mại phải chọn loại công bố.", 400, "TIKTOK_COMMERCIAL_DISCLOSURE_REQUIRED"); if (brandedContent && privacy === "SELF_ONLY") throw fail("Nội dung tài trợ không thể đặt ở chế độ Chỉ mình tôi.", 400, "TIKTOK_BRANDED_PRIVACY_INVALID"); if (body.confirmed !== true || body.previewed !== true) throw fail("Phải xem preview và xác nhận rõ ràng trước khi truyền dữ liệu.", 400, "TIKTOK_CONFIRMATION_REQUIRED"); if (body.musicConfirmed !== true || (brandedContent && body.brandedPolicyConfirmed !== true)) throw fail("Bạn phải xác nhận Music Usage và Branded Content Policy khi áp dụng.", 400, "TIKTOK_MUSIC_CONFIRMATION_REQUIRED"); const idempotencyKey = clean(body.idempotencyKey || crypto.randomUUID(), 120); const job = { userId: user._id, connectionId: record.connectionId, kind: mode === "draft" ? "upload-draft" : "direct-post", status: body.scheduledFor ? "scheduled-internal" : "ready", progress: 0, checkpoint: "validated", retryCount: 0, idempotencyKey, scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null, requiresConfirmation: true, confirmedAt: new Date(), payload: { title: clean(body.title, 2200), privacyLevel: privacy, commentDisabled: body.commentEnabled !== true, duetDisabled: body.duetEnabled !== true, stitchDisabled: body.stitchEnabled !== true, aigc: body.aigc === true, brandOrganic: ownBrand, brandContent: brandedContent, mediaType: clean(body.mediaType || "video", 20), uploadSource: clean(body.uploadSource || "FILE_UPLOAD", 30) }, createdAt: new Date(), updatedAt: new Date() }; const result = await jobs.updateOne({ userId: user._id, idempotencyKey }, { $setOnInsert: job }, { upsert: true }); const saved = await jobs.findOne({ userId: user._id, idempotencyKey }); await audit(db, user._id, "publish:prepared", { target: String(saved._id), kind: job.kind, status: job.status }); return res.status(result.upsertedCount ? 201 : 200).json({ ok: true, job: publicJob(saved), note: body.scheduledFor ? "Đây là lịch nội bộ; TikTok không cung cấp trường scheduling chung trong Direct Post API." : "Đã xác nhận, sẵn sàng truyền khi người dùng bắt đầu." }); }
    if (route === "publish/init" && req.method === "POST") {
      const id = clean(body.jobId, 24); if (!ObjectId.isValid(id)) throw fail("Tác vụ không hợp lệ.");
      const job = await jobs.findOne({ _id: new ObjectId(id), userId: user._id }); if (!job || !job.confirmedAt) throw fail("Tác vụ chưa được chủ tài khoản xác nhận.", 403, "TIKTOK_CONFIRMATION_REQUIRED");
      const record = await ownedConnection(db, user._id, job.connectionId), requiredScope = job.kind === "upload-draft" ? "video.upload" : "video.publish";
      if (!record.scopes?.includes(requiredScope)) throw fail(`Tài khoản chưa cấp scope ${requiredScope}.`, 403, "TIKTOK_SCOPE_REQUIRED");
      const size = Math.max(0, Number(body.videoSize || 0)); if (!size || size > 4 * 1024 ** 3) throw fail("Video phải có kích thước hợp lệ và không quá 4 GB.");
      const mimeType = clean(body.mimeType || body.videoMime || body.contentType, 80).toLowerCase();
      if (!ALLOWED_VIDEO_MIME.includes(mimeType)) throw fail("MIME video không được TikTok hỗ trợ.", 400, "TIKTOK_VIDEO_MIME_INVALID");
      const durationSeconds = Number(body.durationSeconds ?? body.videoDuration ?? body.duration ?? 0);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 600) throw fail("Thời lượng video phải hợp lệ và không quá 10 phút.", 400, "TIKTOK_VIDEO_DURATION_INVALID");
      const minChunk = 5 * 1024 ** 2, maxChunk = 64 * 1024 ** 2;
      const chunkSize = size < minChunk ? size : Math.min(size, maxChunk, Math.max(minChunk, Number(body.chunkSize || 16 * 1024 ** 2)));
      const totalChunkCount = Math.max(1, Math.floor(size / chunkSize));
      const sourceInfo = { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunkCount };
      const token = await accessToken(db, record);
      await enforceRateLimit(db, rateLimitKey(user._id, record.connectionId, "provider:publish-init"), 6, 60 * 1000);
      let creatorData = {};
      let result;
      if (job.kind === "upload-draft") result = await tiktok("/v2/post/publish/inbox/video/init/", token, { method: "POST", body: { source_info: sourceInfo } });
      else {
        const creator = await tiktok("/v2/post/publish/creator_info/query/", token, { method: "POST", body: {}, retrySafe: true });
        creatorData = creator.data || {};
        const maxDuration = Number(creatorData.max_video_post_duration_sec || 0);
        if (!Number.isFinite(maxDuration) || maxDuration <= 0) throw fail("TikTok chưa trả về giới hạn thời lượng Creator Info hợp lệ.", 502, "TIKTOK_CREATOR_INFO_INVALID");
        if (durationSeconds > maxDuration) throw fail(`Video vượt thời lượng tối đa ${maxDuration} giây của tài khoản.`, 400, "TIKTOK_VIDEO_DURATION_EXCEEDED");
        const allowedPrivacy = Array.isArray(creatorData.privacy_level_options) ? creatorData.privacy_level_options : [];
        if (!allowedPrivacy.includes(job.payload.privacyLevel)) throw fail("Quyền riêng tư đã chọn không còn được creator cho phép.", 400, "TIKTOK_PRIVACY_STALE");
        result = await tiktok("/v2/post/publish/video/init/", token, { method: "POST", body: { post_info: { title: job.payload.title, privacy_level: job.payload.privacyLevel, disable_comment: job.payload.commentDisabled || creatorData.comment_disabled === true, disable_duet: job.payload.duetDisabled || creatorData.duet_disabled === true, disable_stitch: job.payload.stitchDisabled || creatorData.stitch_disabled === true, brand_content_toggle: job.payload.brandContent === true, brand_organic_toggle: job.payload.brandOrganic === true, is_aigc: job.payload.aigc === true }, source_info: sourceInfo } });
      }
      const uploadUrl = clean(result.data?.upload_url, 1000), publishId = clean(result.data?.publish_id, 120);
      if (!/^https:\/\/[^/]*tiktokapis\.com\//i.test(uploadUrl)) throw fail("TikTok không trả về upload URL hợp lệ.", 502, "TIKTOK_UPLOAD_URL_INVALID");
      await jobs.updateOne({ _id: job._id, userId: user._id }, { $set: { status: "uploading", checkpoint: "initialized", providerReference: publishId, encryptedUploadUrl: encryptToken(uploadUrl, record), uploadExpiresAt: new Date(Date.now() + 60 * 60 * 1000), progress: 1, videoSize: size, mimeType, durationSeconds, chunkSize, totalChunkCount, nextStatusPollAt: new Date(Date.now() + retryDelayMs(0)), statusPollAttempts: 0, updatedAt: new Date() } });
      await audit(db, user._id, "publish:initialized", { target: String(job._id), kind: job.kind });
      return res.status(200).json({ ok: true, uploadUrl, publishId, chunkSize, totalChunkCount, expiresIn: 3600, allowedMime: ALLOWED_VIDEO_MIME });
    }
    if (route === "publish/status" && req.method === "GET") {
      const id = clean(req.query.jobId, 24); if (!ObjectId.isValid(id)) throw fail("Tác vụ không hợp lệ.");
      const job = await jobs.findOne({ _id: new ObjectId(id), userId: user._id }); if (!job?.providerReference) throw fail("Tác vụ chưa được TikTok khởi tạo.", 404);
      const currentProviderStatus = safeProviderStatus(job.status);
      if (TERMINAL_PROVIDER_STATUSES.has(currentProviderStatus)) return res.status(200).json({ job: publicJob(job), provider: { status: currentProviderStatus }, cached: true, terminal: true });
      const nextPollAt = new Date(job.nextStatusPollAt || 0);
      if (nextPollAt.getTime() > Date.now()) {
        const retryAfter = Math.max(1, Math.ceil((nextPollAt.getTime() - Date.now()) / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(200).json({ job: publicJob(job), provider: { status: currentProviderStatus }, cached: true, retryAfter });
      }
      const record = await ownedConnection(db, user._id, job.connectionId), token = await accessToken(db, record);
      let result;
      try { result = await tiktok("/v2/post/publish/status/fetch/", token, { method: "POST", body: { publish_id: job.providerReference }, retrySafe: true }); }
      catch (error) {
        if (error.statusCode !== 429 && error.statusCode < 500) throw error;
        const attempts = Number(job.statusPollAttempts || 0) + 1;
        const delay = Math.max(retryDelayMs(attempts), retryAfterSeconds(error) * 1000);
        await jobs.updateOne({ _id: job._id, userId: user._id }, { $set: { nextStatusPollAt: new Date(Date.now() + delay), statusPollAttempts: attempts, lastStatusError: clean(error.code || "TIKTOK_STATUS_RETRY", 100), updatedAt: new Date() } });
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(delay / 1000))));
        return res.status(202).json({ job: publicJob(job), provider: { status: currentProviderStatus }, cached: true, retryAfter: Math.ceil(delay / 1000) });
      }
      const status = safeProviderStatus(result.data?.status), attempts = Number(job.statusPollAttempts || 0) + 1;
      const next = { status: status.toLowerCase(), progress: statusProgress(status, job.progress), error: clean(result.data?.fail_reason, 240), statusPollAttempts: attempts, lastProviderStatusAt: new Date(), nextStatusPollAt: TERMINAL_PROVIDER_STATUSES.has(status) ? null : new Date(Date.now() + retryDelayMs(attempts)), updatedAt: new Date() };
      await jobs.updateOne({ _id: job._id, userId: user._id }, { $set: next, $unset: { lastStatusError: "" } });
      return res.status(200).json({ job: publicJob({ ...job, ...next }), provider: result.data || {}, cached: false, terminal: TERMINAL_PROVIDER_STATUSES.has(status) });
    }
    if (route === "publish/progress" && req.method === "POST") {
      const id = clean(body.jobId, 24); if (!ObjectId.isValid(id)) throw fail("Tác vụ không hợp lệ.");
      const job = await jobs.findOne({ _id: new ObjectId(id), userId: user._id }); if (!job) throw fail("Tác vụ không thuộc tài khoản hiện tại.", 404);
      const progress = Math.max(Number(job.progress || 0), Math.min(99, Math.max(1, Number(body.progress || 1))));
      const checkpoint = clean(body.checkpoint || "uploading", 80), status = checkpoint === "uploaded" ? "processing" : "uploading";
      await jobs.updateOne({ _id: job._id, userId: user._id }, { $set: { progress, checkpoint, status, updatedAt: new Date() } });
      return res.status(200).json({ ok: true, progress, checkpoint, status });
    }
    if (route === "publish/control" && req.method === "POST") { const id = clean(body.jobId, 24); if (!ObjectId.isValid(id)) throw fail("Tác vụ không hợp lệ."); const job = await jobs.findOne({ _id: new ObjectId(id), userId: user._id }); if (!job) throw fail("Tác vụ không thuộc tài khoản hiện tại.", 404); const action = clean(body.control, 20); const status = action === "pause" ? "paused" : action === "resume" ? "ready" : action === "retry" ? "ready" : ""; if (!status) throw fail("Điều khiển không hợp lệ."); await jobs.updateOne({ _id: job._id, userId: user._id }, { $set: { status, updatedAt: new Date() }, ...(action === "retry" ? { $inc: { retryCount: 1 } } : {}) }); return res.status(200).json({ ok: true, status }); }
    throw fail("TikTok route không tồn tại.", 404, "TIKTOK_ROUTE_NOT_FOUND");
  });
};

module.exports.__test = Object.freeze({ ALL_SCOPES, BASE_SCOPES, OPTIONAL_SCOPES, ALLOWED_VIDEO_MIME, STATUS, requiredScopes, safeHash, callbackUrl, publicJob, auditConfigured, retryDelayMs, retryAfterMilliseconds, parseWebhookContent, webhookEventKey, rateLimitKey, statusProgress });
