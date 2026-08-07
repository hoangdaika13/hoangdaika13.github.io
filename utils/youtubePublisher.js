const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const {
  decryptToken,
  encryptToken,
  isBoundToken,
  ownedConnectionFilter,
  publicChannel,
  sameOwner
} = require("./youtubeSecurity");
const { quotaStatus } = require("../services/apiGateway");

const YOUTUBE_ORIGIN = "https://www.googleapis.com";
const OAUTH_ORIGIN = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const IDENTITY_SCOPES = Object.freeze(["openid", "email", "profile"]);
const YOUTUBE_SCOPE = Object.freeze({
  upload: "https://www.googleapis.com/auth/youtube.upload",
  manage: "https://www.googleapis.com/auth/youtube.force-ssl",
  analytics: "https://www.googleapis.com/auth/yt-analytics.readonly"
});
const PERMISSION_SCOPE_PRESETS = Object.freeze({
  upload: Object.freeze([...IDENTITY_SCOPES, YOUTUBE_SCOPE.upload]),
  manage: Object.freeze([...IDENTITY_SCOPES, YOUTUBE_SCOPE.manage]),
  analytics: Object.freeze([...IDENTITY_SCOPES, YOUTUBE_SCOPE.analytics]),
  creator: Object.freeze([...IDENTITY_SCOPES, YOUTUBE_SCOPE.upload, YOUTUBE_SCOPE.manage])
});
const CHANNEL_VAULT_LIMIT = 100;
const BULK_CHANNEL_LIMIT = 20;
const BULK_TASK_LIMIT = 100;
const VIDEO_QUEUE_LIMIT = 10;
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "application/octet-stream"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/png"]);
const DEFAULT_QUOTA_COSTS = Object.freeze({
  "dashboard:read": 5,
  "videos:list": 3,
  "analytics:read": 2,
  "analytics:retention": 2,
  "comments:list": 1,
  "comments:reply": 50,
  "comments:moderate": 50,
  "videos:update": 50,
  "videos:delete": 50,
  "captions:list": 50,
  "captions:upload": 400,
  "live:list": 1,
  "live:create": 100,
  "live:transition": 50,
  "upload:create": 100,
  "thumbnail:upload": 50
});
const AI_DISCLOSURES = new Set(["yes", "no", "unreviewed"]);
const RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;

function fail(message, statusCode = 400, code = "YOUTUBE_PUBLISHER_ERROR") {
  return Object.assign(new Error(message), { statusCode, code });
}

function routeOf(req) {
  const value = req.query.youtubeAction ?? req.query.action;
  if (Array.isArray(value)) return value.map((part) => clean(part, 80)).filter(Boolean).join("/");
  if (typeof value === "string" && value) return value;
  return String(req.url || "").split("?")[0].split("/").filter(Boolean).slice(2).join("/");
}

function appOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

function callbackUrl(req) {
  return process.env.YOUTUBE_CALLBACK_URL || `${appOrigin(req)}/api/youtube/oauth/callback`;
}

function allowedFrontends() {
  return new Set([
    "https://hoang8.com",
    "https://www.hoang8.com",
    "https://hoangdaika13.github.io",
    process.env.FRONTEND_URL || "",
    process.env.PUBLIC_SITE_URL || "",
    ...String(process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim())
  ].filter(Boolean));
}

function safeFrontend(value) {
  const fallback = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://hoang8.com";
  try {
    const url = new URL(String(value || fallback));
    return allowedFrontends().has(url.origin) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

function quotaCosts() {
  try {
    const configured = JSON.parse(process.env.YOUTUBE_QUOTA_COSTS_JSON || "{}");
    return { ...DEFAULT_QUOTA_COSTS, ...(configured && typeof configured === "object" ? configured : {}) };
  } catch {
    return { ...DEFAULT_QUOTA_COSTS };
  }
}

function quotaCost(action) {
  return Math.max(0, Number(quotaCosts()[action] || 0));
}

function aiDisclosureOf(value, fallback = "unreviewed") {
  const normalized = clean(value, 24).toLowerCase();
  return AI_DISCLOSURES.has(normalized) ? normalized : fallback;
}

function authTokenFromRequest(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (bearer) return bearer;
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== "hh_session") continue;
    try { return decodeURIComponent(cookie.slice(separator + 1).trim()); }
    catch { return cookie.slice(separator + 1).trim(); }
  }
  return "";
}

async function requireRecentAuthentication(db, req, user) {
  const token = authTokenFromRequest(req);
  const tokenHash = token ? crypto.createHash("sha256").update(token).digest("hex") : "";
  const session = tokenHash ? await db.collection("authSessions").findOne({
    userId: user._id,
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }, { projection: { createdAt: 1, type: 1 } }) : null;
  const authenticatedAt = session?.createdAt ? new Date(session.createdAt) : null;
  if (!authenticatedAt || !Number.isFinite(authenticatedAt.getTime()) || Date.now() - authenticatedAt.getTime() > RECENT_AUTH_WINDOW_MS) {
    throw fail("Phiên đăng nhập đã cũ. Hãy xác thực lại bằng Passkey hoặc đăng nhập lại trước khi xóa video.", 401, "AUTH_RECENT_REQUIRED");
  }
  return { authenticatedAt, method: clean(session.type || "session", 40) };
}

function permissionPreset(value) {
  const id = ["upload", "manage", "analytics", "creator"].includes(value) ? value : "creator";
  return { id, scopes: [...PERMISSION_SCOPE_PRESETS[id]] };
}

function grantedScopes(connection) {
  return new Set(String(connection?.scopes || "").split(/\s+/).filter(Boolean));
}

function hasYoutubePermission(connection, permission) {
  const scope = YOUTUBE_SCOPE[permission];
  return Boolean(scope && grantedScopes(connection).has(scope));
}

function requireYoutubePermission(connection, permission) {
  if (!hasYoutubePermission(connection, permission)) {
    throw fail(`Kênh chưa cấp quyền YouTube ${permission}. Hãy kết nối lại với quyền phù hợp.`, 403, "YOUTUBE_SCOPE_REQUIRED");
  }
}

function maskedEmail(value) {
  const email = clean(value, 254).toLowerCase();
  const [name, domain] = email.split("@");
  if (!name || !domain) return "Tài khoản Google";
  return `${name.slice(0, 1)}${name.length > 1 ? "***" : ""}@${domain}`;
}

function googleAccountKey(subject) {
  const secret = String(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  if (!subject || secret.length < 32) return "";
  return crypto.createHmac("sha256", secret).update(String(subject)).digest("hex");
}

async function writeAudit(db, entry) {
  const action = clean(entry.action, 100);
  const record = {
    userId: entry.userId,
    channelId: clean(entry.channelId, 120),
    action,
    targetId: clean(entry.targetId, 160),
    status: ["started", "completed", "failed", "cancelled"].includes(entry.status) ? entry.status : "completed",
    quotaCost: Number.isFinite(Number(entry.quotaCost)) ? Math.max(0, Number(entry.quotaCost)) : quotaCost(action),
    source: clean(entry.source || "youtube-creator-os", 80),
    detail: clean(entry.detail, 300),
    createdAt: new Date()
  };
  await db.collection("youtubeAudits").insertOne(record);
  await db.collection("youtubeConnections").updateOne(
    { userId: entry.userId, channelId: record.channelId },
    { $set: { lastApiAt: record.createdAt } }
  );
  return record;
}

function publicAudit(item) {
  return {
    id: String(item._id || ""),
    action: clean(item.action, 100),
    targetId: clean(item.targetId, 160),
    status: clean(item.status, 30),
    quotaCost: Math.max(0, Number(item.quotaCost || 0)),
    detail: clean(item.detail, 300),
    createdAt: item.createdAt || null
  };
}

async function observedQuota(db, userId, channelId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db.collection("youtubeAudits").find({
    userId,
    channelId,
    createdAt: { $gte: start },
    status: { $in: ["started", "completed"] }
  }).sort({ createdAt: -1 }).limit(500).toArray();
  const used = rows.reduce((sum, item) => sum + Math.max(0, Number(item.quotaCost || 0)), 0);
  const dailyLimit = Math.max(0, Number(process.env.YOUTUBE_QUOTA_DAILY_LIMIT || 0));
  const buckets = {};
  rows.forEach((item) => {
    const bucket = String(item.action || "").split(":")[0] || "other";
    buckets[bucket] = (buckets[bucket] || 0) + Math.max(0, Number(item.quotaCost || 0));
  });
  return {
    source: "HH observed API ledger",
    exactGoogleBalance: false,
    used,
    dailyLimit: dailyLimit || null,
    remaining: dailyLimit ? Math.max(0, dailyLimit - used) : null,
    buckets,
    resetAt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    note: dailyLimit
      ? "Ước tính từ thao tác HH đã ghi nhận; Google Console là nguồn quyết định."
      : "Đã ghi mức dùng quan sát; chưa cấu hình hạn mức Google Cloud cho dự án."
  };
}

function normalizePublishProject(value, current = {}) {
  const input = value && typeof value === "object" ? value : {};
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const captions = Array.isArray(input.captions) ? input.captions : [];
  const thumbnails = Array.isArray(input.thumbnails) ? input.thumbnails : [];
  const approvals = input.approvals && typeof input.approvals === "object" ? input.approvals : {};
  const publishAt = metadata.publishAt ? new Date(metadata.publishAt) : null;
  return {
    title: clean(input.title || current.title || "Dự án xuất bản", 160),
    sourceProjectId: clean(input.sourceProjectId, 160),
    sourceAssetId: clean(input.sourceAssetId, 160),
    videoId: clean(input.videoId, 40),
    renderStatus: ["idle", "queued", "processing", "completed", "failed", "cancelled"].includes(input.renderStatus)
      ? input.renderStatus
      : "idle",
    metadata: {
      title: clean(metadata.title, 100),
      description: clean(metadata.description, 5000),
      tags: normalizedTags(metadata.tags),
      privacyStatus: ["private", "unlisted", "public"].includes(metadata.privacyStatus) ? metadata.privacyStatus : "private",
      publishAt: publishAt && Number.isFinite(publishAt.getTime()) ? publishAt : null,
      playlistId: clean(metadata.playlistId, 120)
    },
    thumbnails: thumbnails.slice(0, 3).map((item, index) => ({
      id: clean(item?.id || `variant-${index + 1}`, 120),
      variant: ["A", "B", "C"].includes(item?.variant) ? item.variant : ["A", "B", "C"][index],
      assetId: clean(item?.assetId, 160),
      status: ["draft", "approved"].includes(item?.status) ? item.status : "draft"
    })),
    captions: captions.slice(0, 30).map((item) => ({
      language: clean(item?.language, 24),
      name: clean(item?.name, 160),
      status: ["draft", "approved", "uploaded"].includes(item?.status) ? item.status : "draft",
      captionId: clean(item?.captionId, 120)
    })),
    rightsManifest: {
      confirmed: Boolean(input.rightsManifest?.confirmed),
      assetCount: Math.max(0, Number(input.rightsManifest?.assetCount || 0)),
      missingLicenseCount: Math.max(0, Number(input.rightsManifest?.missingLicenseCount || 0))
    },
    approvals: {
      metadata: Boolean(approvals.metadata),
      thumbnail: Boolean(approvals.thumbnail),
      captions: Boolean(approvals.captions),
      publish: Boolean(approvals.publish)
    },
    automation: {
      enabled: Boolean(input.automation?.enabled),
      approvalGate: input.automation?.approvalGate !== false,
      stage: clean(input.automation?.stage || "draft", 40),
      idempotencyKey: clean(input.automation?.idempotencyKey, 160)
    },
    updatedAt: new Date()
  };
}

async function ensureIndex(collection, keys, options = {}) {
  try {
    await collection.createIndex(keys, options);
  } catch (error) {
    const compatibleExistingIndex = ["IndexKeySpecsConflict", "IndexOptionsConflict"].includes(error?.codeName)
      || /already exists with a different name/i.test(String(error?.message || ""));
    if (!compatibleExistingIndex) throw error;
  }
}

async function googleJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(26000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || `Google API HTTP ${response.status}`;
    throw fail(message, response.status === 401 ? 401 : Math.min(response.status, 503), clean(data?.error?.status, 80) || "GOOGLE_API_ERROR");
  }
  return data;
}

async function googleIdentity(accessToken) {
  const profile = await googleJson(USERINFO_ENDPOINT, { headers: youtubeHeaders(accessToken) });
  const key = googleAccountKey(profile.sub);
  if (!key) throw fail("Không xác minh được tài khoản Google đã cấp quyền.", 401, "GOOGLE_IDENTITY_INVALID");
  return {
    googleAccountKey: key,
    googleAccountHint: maskedEmail(profile.email),
    googleEmailVerified: profile.email_verified !== false
  };
}

async function revokeRawGoogleToken(token) {
  if (!token) return false;
  try {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: String(token) }),
      signal: AbortSignal.timeout(12000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function revokeConnectionToken(connection) {
  if (!connection) return false;
  try {
    const token = connection.refreshToken
      ? decryptToken(connection.refreshToken, connection)
      : decryptToken(connection.accessToken, connection);
    return revokeRawGoogleToken(token);
  } catch {
    return false;
  }
}

async function refreshAccessToken(connection, connections) {
  const now = Date.now();
  if (connection.accessToken && Number(connection.expiresAt || 0) > now + 90_000) {
    const accessToken = decryptToken(connection.accessToken, connection);
    if (!isBoundToken(connection.accessToken) || (connection.refreshToken && !isBoundToken(connection.refreshToken))) {
      const migrated = {
        accessToken: encryptToken(accessToken, connection),
        ...(connection.refreshToken ? { refreshToken: encryptToken(decryptToken(connection.refreshToken, connection), connection) } : {}),
        updatedAt: new Date()
      };
      await connections.updateOne(ownedConnectionFilter(connection), { $set: migrated });
      Object.assign(connection, migrated);
    }
    return accessToken;
  }
  const refreshToken = decryptToken(connection.refreshToken, connection);
  if (!refreshToken) throw fail("YouTube chưa cấp refresh token. Hãy kết nối lại kênh.", 401, "YOUTUBE_RECONNECT_REQUIRED");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(18000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw fail(data.error_description || "Không làm mới được quyền YouTube.", 401, "YOUTUBE_REFRESH_FAILED");
  const update = {
    accessToken: encryptToken(data.access_token, connection),
    refreshToken: encryptToken(refreshToken, connection),
    expiresAt: now + Number(data.expires_in || 3600) * 1000,
    updatedAt: new Date()
  };
  await connections.updateOne(ownedConnectionFilter(connection), { $set: update });
  Object.assign(connection, update);
  return data.access_token;
}

async function connectionFor(db, user, channelId = "") {
  const collection = db.collection("youtubeConnections");
  const owned = { userId: user._id, ...(channelId ? { channelId: clean(channelId, 120) } : {}) };
  const connection = channelId
    ? await collection.findOne(owned)
    : await collection.findOne({ ...owned, active: true })
      || await collection.findOne(owned, { sort: { updatedAt: -1 } });
  if (!connection) throw fail("Bạn chưa kết nối kênh YouTube.", 409, "YOUTUBE_NOT_CONNECTED");
  return connection;
}

async function ownedConnectionsForIds(db, user, channelIds, options = {}) {
  const max = Math.max(1, Math.min(CHANNEL_VAULT_LIMIT, Number(options.max || BULK_CHANNEL_LIMIT)));
  const ids = [...new Set((Array.isArray(channelIds) ? channelIds : []).map((id) => clean(id, 120)).filter(Boolean))];
  if (!ids.length) throw fail("Hãy chọn ít nhất một kênh YouTube.", 400, "YOUTUBE_CHANNEL_SELECTION_REQUIRED");
  if (ids.length > max) throw fail(`Mỗi lần xử lý tối đa ${max} kênh để bảo vệ quota và chống đăng nhầm.`, 400, "YOUTUBE_BULK_LIMIT");
  const rows = await db.collection("youtubeConnections").find({ userId: user._id, channelId: { $in: ids } }).toArray();
  if (rows.length !== ids.length) throw fail("Danh sách có kênh không thuộc tài khoản HH hiện tại.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
  const byId = new Map(rows.map((row) => [String(row.channelId), row]));
  return ids.map((id) => byId.get(id));
}

function publicOwnedChannel(connection) {
  const channel = publicChannel(connection);
  if (!channel) return null;
  const scopes = new Set(String(connection?.scopes || "").split(/\s+/).filter(Boolean));
  return {
    ...channel,
    account: {
      key: clean(connection.googleAccountKey, 64).slice(0, 16),
      hint: clean(connection.googleAccountHint || "Tài khoản Google", 254)
    },
    permissionPreset: clean(connection.permissionPreset || "legacy", 30),
    permissions: {
      upload: scopes.has(YOUTUBE_SCOPE.upload),
      manage: scopes.has(YOUTUBE_SCOPE.manage),
      analytics: scopes.has(YOUTUBE_SCOPE.analytics)
    },
    playlists: (Array.isArray(connection?.playlists) ? connection.playlists : []).slice(0, 50).map((playlist) => ({
      id: clean(playlist?.id, 120),
      title: clean(playlist?.title, 180),
      privacy: clean(playlist?.privacy, 30)
    })).filter((playlist) => playlist.id),
    statistics: {
      subscribers: Number(connection?.subscribers || 0),
      videos: Number(connection?.videoCount || 0),
      views: Number(connection?.views || 0)
    },
    profile: {
      description: clean(connection?.channelDescription, 1000),
      customUrl: clean(connection?.channelCustomUrl, 160),
      bannerUrl: clean(connection?.channelBannerUrl, 1200),
      country: clean(connection?.channelCountry, 2),
      defaultLanguage: clean(connection?.channelDefaultLanguage, 12),
      keywords: clean(connection?.channelKeywords, 500),
      trailerVideoId: clean(connection?.channelTrailerVideoId, 40),
      moderateComments: Boolean(connection?.channelModerateComments),
      madeForKids: Boolean(connection?.channelMadeForKids)
    },
    token: {
      expiresAt: connection?.expiresAt ? new Date(Number(connection.expiresAt)) : null,
      healthy: Boolean(connection?.refreshToken)
    },
    lastApiAt: connection?.lastApiAt || null
  };
}

function publicConnection(connection, allConnections = []) {
  const scopes = new Set(String(connection?.scopes || "").split(/\s+/).filter(Boolean));
  return {
    connected: Boolean(connection),
    visibility: "private",
    accountIsolated: true,
    channel: publicOwnedChannel(connection),
    channels: allConnections.map(publicOwnedChannel),
    connectedAt: connection?.connectedAt || null,
    updatedAt: connection?.updatedAt || null,
    expiresAt: connection?.expiresAt ? new Date(Number(connection.expiresAt)) : null,
    lastApiAt: connection?.lastApiAt || null,
    scopeNames: [...scopes].map((scope) => scope.split("/").pop()).filter(Boolean),
    permissions: {
      read: Boolean(connection),
      upload: scopes.has(YOUTUBE_SCOPE.upload),
      manage: scopes.has(YOUTUBE_SCOPE.manage),
      analytics: scopes.has(YOUTUBE_SCOPE.analytics)
    },
    oauth: {
      granular: true,
      preset: clean(connection?.permissionPreset || "legacy", 30),
      exactGrantedScopes: [...scopes].filter((scope) => scope.startsWith("https://www.googleapis.com/auth/")),
      availablePresets: Object.fromEntries(Object.entries(PERMISSION_SCOPE_PRESETS).map(([id, values]) => [id, values.filter((scope) => scope.startsWith("https://www.googleapis.com/auth/"))]))
    }
  };
}

function safeReturnHash(value) {
  const route = clean(value, 220);
  return /^#\/(?:davinci-resolve\/youtube|music-ai\/youtube-publisher)(?:[/?#].*)?$/.test(route)
    ? route
    : "#/davinci-resolve/youtube";
}

function youtubeHeaders(accessToken, json = false) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

function queryUrl(path, params = {}) {
  const url = new URL(path, YOUTUBE_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function youtubeJson(accessToken, path, params = {}, options = {}) {
  return googleJson(queryUrl(path, params), {
    ...options,
    headers: {
      ...youtubeHeaders(accessToken, Boolean(options.body)),
      ...(options.headers || {})
    }
  });
}

async function analyticsJson(accessToken, params = {}) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return googleJson(url.toString(), { headers: youtubeHeaders(accessToken) });
}

function isoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizedVideo(item) {
  const partsTotal = Number(item?.processingDetails?.processingProgress?.partsTotal || 0);
  const partsProcessed = Number(item?.processingDetails?.processingProgress?.partsProcessed || 0);
  const youtubeSyntheticFlag = item?.status?.containsSyntheticMedia === true;
  return {
    id: clean(item?.id, 40),
    title: clean(item?.snippet?.title, 160),
    description: clean(item?.snippet?.description, 5000),
    tags: Array.isArray(item?.snippet?.tags) ? item.snippet.tags.map((tag) => clean(tag, 120)).slice(0, 60) : [],
    categoryId: clean(item?.snippet?.categoryId, 8),
    defaultLanguage: clean(item?.snippet?.defaultLanguage, 24),
    defaultAudioLanguage: clean(item?.snippet?.defaultAudioLanguage, 24),
    publishedAt: item?.snippet?.publishedAt || null,
    scheduledAt: item?.status?.publishAt || null,
    privacyStatus: clean(item?.status?.privacyStatus, 24),
    uploadStatus: clean(item?.status?.uploadStatus, 30),
    processingStatus: clean(item?.processingDetails?.processingStatus, 30),
    processingProgress: partsTotal ? `${partsProcessed}/${partsTotal} phần` : clean(item?.processingDetails?.processingProgress?.timeLeftMs ? `Còn khoảng ${Math.ceil(Number(item.processingDetails.processingProgress.timeLeftMs) / 1000)} giây` : "", 80),
    failureReason: clean(item?.status?.failureReason, 80),
    rejectionReason: clean(item?.status?.rejectionReason, 80),
    madeForKids: Boolean(item?.status?.selfDeclaredMadeForKids || item?.status?.madeForKids),
    containsSyntheticMedia: youtubeSyntheticFlag,
    aiDisclosure: youtubeSyntheticFlag ? "yes" : "unreviewed",
    aiDisclosureSource: youtubeSyntheticFlag ? "youtube-status" : "unknown",
    embeddable: item?.status?.embeddable !== false,
    license: item?.status?.license === "creativeCommon" ? "creativeCommon" : "youtube",
    publicStatsViewable: item?.status?.publicStatsViewable !== false,
    duration: clean(item?.contentDetails?.duration, 40),
    definition: clean(item?.contentDetails?.definition, 20),
    captionAvailable: String(item?.contentDetails?.caption || "false") === "true",
    hasCustomThumbnail: Boolean(item?.contentDetails?.hasCustomThumbnail),
    licensedContent: Boolean(item?.contentDetails?.licensedContent),
    ageRestricted: item?.contentDetails?.contentRating?.ytRating === "ytAgeRestricted",
    projection: clean(item?.contentDetails?.projection, 20),
    paidProductPlacement: Boolean(item?.paidProductPlacementDetails?.hasPaidProductPlacement),
    recordingDate: item?.recordingDetails?.recordingDate || null,
    fileDetails: item?.fileDetails ? {
      fileName: clean(item.fileDetails.fileName, 240),
      fileSize: Number(item.fileDetails.fileSize || 0),
      container: clean(item.fileDetails.container, 40),
      videoCodec: clean(item.fileDetails.videoStreams?.[0]?.codec, 80),
      audioCodec: clean(item.fileDetails.audioStreams?.[0]?.codec, 80),
      width: Number(item.fileDetails.videoStreams?.[0]?.widthPixels || 0),
      height: Number(item.fileDetails.videoStreams?.[0]?.heightPixels || 0),
      frameRate: Number(item.fileDetails.videoStreams?.[0]?.frameRateFps || 0)
    } : null,
    suggestions: {
      errors: (item?.suggestions?.processingErrors || []).map((value) => clean(value, 120)).slice(0, 20),
      warnings: (item?.suggestions?.processingWarnings || []).map((value) => clean(value, 120)).slice(0, 20),
      hints: (item?.suggestions?.processingHints || []).map((value) => clean(value, 120)).slice(0, 20)
    },
    checks: {
      copyright: { available: false, status: "unavailable", detail: "YouTube Data API không cung cấp kết quả Studio Copyright Checks." },
      adSuitability: { available: false, status: "unavailable", detail: "Chỉ hiển thị khi YouTube cung cấp nguồn dữ liệu được phép." }
    },
    thumbnail: clean(item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url, 800),
    views: Number(item?.statistics?.viewCount || 0),
    likes: Number(item?.statistics?.likeCount || 0),
    comments: Number(item?.statistics?.commentCount || 0)
  };
}

async function recentVideos(accessToken) {
  const channels = await youtubeJson(accessToken, "/youtube/v3/channels", {
    part: "contentDetails",
    mine: "true"
  });
  const uploadsId = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];
  const playlist = await youtubeJson(accessToken, "/youtube/v3/playlistItems", {
    part: "contentDetails",
    playlistId: uploadsId,
    maxResults: 50
  });
  const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const videos = await youtubeJson(accessToken, "/youtube/v3/videos", {
    part: "snippet,status,statistics,processingDetails,contentDetails",
    id: ids.join(",")
  });
  return (videos.items || []).map(normalizedVideo);
}

function normalizedComment(item) {
  const top = item?.snippet?.topLevelComment || item;
  const snippet = top?.snippet || {};
  return {
    id: clean(top?.id || item?.id, 120),
    threadId: clean(item?.id, 120),
    videoId: clean(snippet.videoId, 40),
    author: clean(snippet.authorDisplayName, 120),
    avatar: clean(snippet.authorProfileImageUrl, 800),
    text: clean(snippet.textDisplay || snippet.textOriginal, 1600),
    publishedAt: snippet.publishedAt || null,
    updatedAt: snippet.updatedAt || null,
    likeCount: Number(snippet.likeCount || 0),
    replyCount: Number(item?.snippet?.totalReplyCount || 0),
    moderationStatus: clean(snippet.moderationStatus || "published", 40)
  };
}

async function recentComments(accessToken, channelId) {
  const data = await youtubeJson(accessToken, "/youtube/v3/commentThreads", {
    part: "snippet",
    allThreadsRelatedToChannelId: channelId,
    order: "time",
    maxResults: 30,
    textFormat: "plainText"
  });
  return (data.items || []).map(normalizedComment);
}

async function recentVideoComments(accessToken, videoId) {
  const data = await youtubeJson(accessToken, "/youtube/v3/commentThreads", {
    part: "snippet,replies",
    videoId,
    order: "time",
    maxResults: 50,
    textFormat: "plainText"
  });
  return (data.items || []).map((item) => ({
    ...normalizedComment(item),
    replies: (item.replies?.comments || []).map(normalizedComment).slice(0, 20)
  }));
}

function normalizedBroadcast(item) {
  return {
    id: clean(item?.id, 120),
    title: clean(item?.snippet?.title, 160),
    description: clean(item?.snippet?.description, 1000),
    scheduledStartTime: item?.snippet?.scheduledStartTime || null,
    actualStartTime: item?.snippet?.actualStartTime || null,
    actualEndTime: item?.snippet?.actualEndTime || null,
    lifeCycleStatus: clean(item?.status?.lifeCycleStatus, 40),
    privacyStatus: clean(item?.status?.privacyStatus, 24),
    recordingStatus: clean(item?.status?.recordingStatus, 40),
    liveChatId: clean(item?.snippet?.liveChatId, 120)
  };
}

async function broadcasts(accessToken) {
  const data = await youtubeJson(accessToken, "/youtube/v3/liveBroadcasts", {
    part: "id,snippet,status",
    broadcastStatus: "all",
    mine: "true",
    maxResults: 20
  });
  return (data.items || []).map(normalizedBroadcast);
}

function analyticsRows(data) {
  const headers = (data.columnHeaders || []).map((item) => item.name);
  return (data.rows || []).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

async function channelAnalytics(accessToken, options = {}) {
  const endDate = options.endDate || isoDay(Date.now() - 24 * 60 * 60 * 1000);
  const startDate = options.startDate || isoDay(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const query = {
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
    ...(options.videoId
      ? {
          filters: `video==${clean(options.videoId, 40)}`,
          metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments"
        }
      : {})
  };
  const [trendData, totalData] = await Promise.all([
    analyticsJson(accessToken, { ...query, dimensions: "day", sort: "day" }),
    analyticsJson(accessToken, query)
  ]);
  const rows = analyticsRows(trendData);
  const totals = analyticsRows(totalData)[0] || {};
  return { startDate, endDate, rows, totals };
}

async function retentionAnalytics(accessToken, videoId, options = {}) {
  const id = clean(videoId, 40);
  if (!/^[\w-]{6,20}$/.test(id)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
  const endDate = options.endDate || isoDay(Date.now() - 24 * 60 * 60 * 1000);
  const startDate = options.startDate || isoDay(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const data = await analyticsJson(accessToken, {
    ids: "channel==MINE",
    startDate,
    endDate,
    dimensions: "elapsedVideoTimeRatio",
    metrics: "audienceWatchRatio,relativeRetentionPerformance",
    filters: `video==${id}`,
    sort: "elapsedVideoTimeRatio"
  });
  return {
    startDate,
    endDate,
    points: analyticsRows(data).slice(0, 100).map((item) => ({
      ratio: Math.max(0, Math.min(1, Number(item.elapsedVideoTimeRatio || 0))),
      audienceWatchRatio: Math.max(0, Number(item.audienceWatchRatio || 0)),
      relativeRetentionPerformance: Number(item.relativeRetentionPerformance || 0)
    }))
  };
}

async function videoComparisonAnalytics(accessToken, options = {}) {
  const endDate = options.endDate || isoDay(Date.now() - 24 * 60 * 60 * 1000);
  const startDate = options.startDate || isoDay(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const data = await analyticsJson(accessToken, {
    ids: "channel==MINE",
    startDate,
    endDate,
    dimensions: "video",
    metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
    sort: "-views",
    maxResults: 10
  });
  return { startDate, endDate, rows: analyticsRows(data).slice(0, 10) };
}

async function settledResult(work, fallback, warnings, label) {
  try {
    return await work();
  } catch (error) {
    warnings.push({ source: label, code: clean(error.code, 80), message: clean(error.message, 220) });
    return fallback;
  }
}

async function channelBundle(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [channels, playlists] = await Promise.all([
    googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/channels?part=snippet,statistics,brandingSettings,status&mine=true`, { headers }),
    googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/playlists?part=snippet,status&mine=true&maxResults=50`, { headers })
  ]);
  const channel = channels.items?.[0];
  if (!channel) throw fail("Tài khoản Google này chưa có kênh YouTube.", 409, "YOUTUBE_CHANNEL_MISSING");
  return {
    channel: {
      channelId: channel.id,
      channelTitle: clean(channel.snippet?.title, 160),
      channelThumbnail: clean(channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url, 800),
      channelDescription: clean(channel.snippet?.description || channel.brandingSettings?.channel?.description, 1000),
      channelCustomUrl: clean(channel.snippet?.customUrl, 160),
      channelBannerUrl: clean(channel.brandingSettings?.image?.bannerExternalUrl, 1200),
      channelCountry: clean(channel.brandingSettings?.channel?.country || channel.snippet?.country, 2),
      channelDefaultLanguage: clean(channel.brandingSettings?.channel?.defaultLanguage || channel.snippet?.defaultLanguage, 12),
      channelKeywords: clean(channel.brandingSettings?.channel?.keywords, 500),
      channelTrailerVideoId: clean(channel.brandingSettings?.channel?.unsubscribedTrailer, 40),
      channelModerateComments: Boolean(channel.brandingSettings?.channel?.moderateComments),
      channelMadeForKids: Boolean(channel.status?.madeForKids || channel.status?.selfDeclaredMadeForKids),
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      videoCount: Number(channel.statistics?.videoCount || 0),
      views: Number(channel.statistics?.viewCount || 0)
    },
    playlists: (playlists.items || []).map((item) => ({ id: item.id, title: clean(item.snippet?.title, 180), privacy: clean(item.status?.privacyStatus, 30) }))
  };
}

function normalizedTags(value) {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");
  const unique = [...new Set(tags.map((item) => clean(item, 60)).filter(Boolean))].slice(0, 30);
  while (unique.join(",").length > 480) unique.pop();
  return unique;
}

function publicChannelSettings(channel) {
  return {
    id: clean(channel?.id, 120),
    title: clean(channel?.snippet?.title || channel?.brandingSettings?.channel?.title, 160),
    description: clean(channel?.snippet?.description || channel?.brandingSettings?.channel?.description, 1000),
    customUrl: clean(channel?.snippet?.customUrl, 160),
    thumbnail: clean(channel?.snippet?.thumbnails?.medium?.url || channel?.snippet?.thumbnails?.default?.url, 800),
    bannerUrl: clean(channel?.brandingSettings?.image?.bannerExternalUrl, 1200),
    country: clean(channel?.brandingSettings?.channel?.country || channel?.snippet?.country, 2),
    defaultLanguage: clean(channel?.brandingSettings?.channel?.defaultLanguage || channel?.snippet?.defaultLanguage, 12),
    keywords: clean(channel?.brandingSettings?.channel?.keywords, 500),
    trailerVideoId: clean(channel?.brandingSettings?.channel?.unsubscribedTrailer, 40),
    moderateComments: Boolean(channel?.brandingSettings?.channel?.moderateComments),
    madeForKids: Boolean(channel?.status?.madeForKids || channel?.status?.selfDeclaredMadeForKids)
  };
}

function uploadMetadata(body) {
  const title = clean(body.title, 100);
  if (!title) throw fail("Tiêu đề video đang trống.", 400, "YOUTUBE_TITLE_REQUIRED");
  const categoryId = /^\d{1,3}$/.test(String(body.categoryId || "")) ? String(body.categoryId) : "10";
  const privacyStatus = ["private", "unlisted", "public"].includes(body.privacyStatus) ? body.privacyStatus : "private";
  const publishAt = body.publishAt ? new Date(body.publishAt) : null;
  if (publishAt && (!Number.isFinite(publishAt.getTime()) || publishAt.getTime() < Date.now() + 60_000)) {
    throw fail("Lịch phát phải ở tương lai ít nhất một phút.", 400, "YOUTUBE_SCHEDULE_INVALID");
  }
  const aiDisclosure = aiDisclosureOf(body.aiDisclosure, body.containsSyntheticMedia === true ? "yes" : body.containsSyntheticMedia === false ? "no" : "unreviewed");
  const status = {
    privacyStatus: publishAt ? "private" : privacyStatus,
    selfDeclaredMadeForKids: Boolean(body.madeForKids),
    license: body.license === "creativeCommon" ? "creativeCommon" : "youtube",
    embeddable: body.embeddable !== false,
    publicStatsViewable: body.publicStatsViewable !== false
  };
  if (aiDisclosure !== "unreviewed") status.containsSyntheticMedia = aiDisclosure === "yes";
  if (publishAt) status.publishAt = publishAt.toISOString();
  const resource = {
    snippet: {
      title,
      description: clean(body.description, 5000),
      tags: normalizedTags(body.tags),
      categoryId,
      defaultLanguage: clean(body.defaultLanguage || "vi", 12)
    },
    status,
    paidProductPlacementDetails: {
      hasPaidProductPlacement: Boolean(body.hasPaidProductPlacement)
    }
  };
  if (body.recordingDate) {
    const recording = new Date(body.recordingDate);
    if (Number.isFinite(recording.getTime())) resource.recordingDetails = { recordingDate: recording.toISOString() };
  }
  return resource;
}

async function initiateResumable(accessToken, body) {
  const size = Number(body.fileSize || 0);
  const mimeType = clean(body.mimeType, 100).toLowerCase();
  if (!Number.isSafeInteger(size) || size <= 0 || size > 256 * 1024 * 1024 * 1024) throw fail("Kích thước video không hợp lệ.");
  if (!VIDEO_MIME.has(mimeType) && !mimeType.startsWith("video/")) throw fail("Định dạng video không được hỗ trợ.");
  const resource = uploadMetadata(body);
  const params = new URLSearchParams({ uploadType: "resumable", part: Object.keys(resource).join(","), notifySubscribers: body.notifySubscribers === false ? "false" : "true" });
  const response = await fetch(`${YOUTUBE_ORIGIN}/upload/youtube/v3/videos?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": mimeType
    },
    body: JSON.stringify(resource),
    signal: AbortSignal.timeout(26000)
  });
  const data = await response.json().catch(() => ({}));
  const uploadUrl = response.headers.get("location");
  if (!response.ok || !uploadUrl) throw fail(data?.error?.message || "YouTube không tạo được phiên upload.", response.status || 502, "YOUTUBE_SESSION_FAILED");
  return { uploadUrl, resource };
}

async function initiateThumbnail(accessToken, videoId, body) {
  const size = Number(body.fileSize || 0);
  const mimeType = clean(body.mimeType, 80).toLowerCase();
  if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.");
  if (!IMAGE_MIME.has(mimeType) || size <= 0 || size > 2 * 1024 * 1024) throw fail("Thumbnail phải là JPG/PNG và không quá 2 MB.");
  const response = await fetch(`${YOUTUBE_ORIGIN}/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": mimeType
    },
    signal: AbortSignal.timeout(18000)
  });
  const data = await response.json().catch(() => ({}));
  const uploadUrl = response.headers.get("location");
  if (!response.ok || !uploadUrl) throw fail(data?.error?.message || "Không tạo được phiên tải thumbnail.", response.status || 502, "YOUTUBE_THUMBNAIL_SESSION_FAILED");
  return uploadUrl;
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const route = routeOf(req);
    const connections = db.collection("youtubeConnections");
    const states = db.collection("youtubeOauthStates");
    const uploads = db.collection("youtubeUploads");
    const audits = db.collection("youtubeAudits");
    const projects = db.collection("youtubePublishProjects");
    const commentDrafts = db.collection("youtubeCommentDrafts");
    const bulkJobs = db.collection("youtubeBulkJobs");
    const videoDeclarations = db.collection("youtubeVideoDeclarations");
    const destructiveActions = db.collection("youtubeDestructiveActions");
    const videoTombstones = db.collection("youtubeVideoTombstones");
    await Promise.all([
      ensureIndex(connections, { userId: 1, channelId: 1 }, { unique: true, sparse: true }),
      ensureIndex(connections, { userId: 1, active: 1, updatedAt: -1 }),
      ensureIndex(uploads, { userId: 1, channelId: 1, createdAt: -1 }),
      ensureIndex(uploads, { userId: 1, channelId: 1, taskKey: 1, metadataVersion: 1 }),
      ensureIndex(audits, { userId: 1, channelId: 1, createdAt: -1 }),
      ensureIndex(projects, { userId: 1, channelId: 1 }, { unique: true }),
      ensureIndex(commentDrafts, { userId: 1, channelId: 1, createdAt: -1 }),
      ensureIndex(bulkJobs, { userId: 1, idempotencyKey: 1 }, { unique: true }),
      ensureIndex(bulkJobs, { userId: 1, createdAt: -1 }),
      ensureIndex(videoDeclarations, { userId: 1, channelId: 1, videoId: 1 }, { unique: true }),
      ensureIndex(destructiveActions, { userId: 1, idempotencyKey: 1 }, { unique: true }),
      ensureIndex(videoTombstones, { userId: 1, channelId: 1, videoId: 1, deletedAt: -1 }),
      ensureIndex(states, { expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);

    if (route === "oauth/callback" && req.method === "GET") {
      const rawState = clean(req.query.state, 180);
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const state = await states.findOne({ stateHash, expiresAt: { $gt: new Date() } });
      const frontend = safeFrontend(state?.returnTo);
      const returnHash = safeReturnHash(state?.returnHash);
      if (state && req.query.code) {
        const callbackUser = await currentUser(req);
        if (!callbackUser || !sameOwner(callbackUser._id, state.userId)) {
          await states.deleteOne({ _id: state._id });
          return res.redirect(`${frontend}/?youtubeError=${encodeURIComponent("Phiên HH không khớp với người đã bắt đầu kết nối YouTube.")}${returnHash}`);
        }
      }
      if (!state || !req.query.code) return res.redirect(`${frontend}/?youtubeError=${encodeURIComponent("Phiên kết nối YouTube đã hết hạn.")}${returnHash}`);
      await states.deleteOne({ _id: state._id });
      let grantedTokenForCleanup = "";
      try {
        const tokenResponse = await fetch(TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: clean(req.query.code, 2000),
            client_id: process.env.GOOGLE_CLIENT_ID || "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
            redirect_uri: callbackUrl(req),
            grant_type: "authorization_code"
          }),
          signal: AbortSignal.timeout(18000)
        });
        const tokens = await tokenResponse.json().catch(() => ({}));
        grantedTokenForCleanup = tokens.refresh_token || tokens.access_token || "";
        if (!tokenResponse.ok || !tokens.access_token) throw fail(tokens.error_description || "Google từ chối kết nối YouTube.", 401);
        const [bundle, identity] = await Promise.all([
          channelBundle(tokens.access_token),
          googleIdentity(tokens.access_token)
        ]);
        const previous = await connections.findOne({ userId: state.userId, channelId: bundle.channel.channelId });
        if (!previous) {
          const channelCount = await connections.countDocuments({ userId: state.userId }, { limit: CHANNEL_VAULT_LIMIT + 1 });
          if (channelCount >= CHANNEL_VAULT_LIMIT) throw fail(`Kho kênh đã đạt giới hạn ${CHANNEL_VAULT_LIMIT}. Hãy ngắt một kênh cũ trước khi thêm kênh mới.`, 409, "YOUTUBE_CHANNEL_VAULT_LIMIT");
        }
        const ownerContext = { userId: state.userId, channelId: bundle.channel.channelId };
        const refreshToken = tokens.refresh_token || (previous?.refreshToken ? decryptToken(previous.refreshToken, previous) : "");
        if (!refreshToken) throw fail("Google chưa cấp quyền truy cập ngoại tuyến. Hãy kết nối lại và chấp thuận quyền.", 401);
        const now = new Date();
        await connections.updateMany({ userId: state.userId }, { $set: { active: false } });
        await connections.updateOne({ userId: state.userId, channelId: bundle.channel.channelId }, { $set: {
          userId: state.userId,
          active: true,
          accessToken: encryptToken(tokens.access_token, ownerContext),
          refreshToken: encryptToken(refreshToken, ownerContext),
          expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
          scopes: clean(tokens.scope || (state.requestedScopes || []).join(" "), 1200),
          permissionPreset: clean(state.permissionPreset || "creator", 30),
          ...identity,
          ...bundle.channel,
          playlists: bundle.playlists,
          connectedAt: previous?.connectedAt || now,
          updatedAt: now
        } }, { upsert: true });
        await writeAudit(db, {
          userId: state.userId,
          channelId: bundle.channel.channelId,
          action: "channel:connect",
          targetId: bundle.channel.channelId,
          status: "completed",
          quotaCost: 0
        });
        grantedTokenForCleanup = "";
        return res.redirect(`${frontend}/?youtubeConnected=1${returnHash}`);
      } catch (error) {
        await revokeRawGoogleToken(grantedTokenForCleanup);
        return res.redirect(`${frontend}/?youtubeError=${encodeURIComponent(clean(error.message, 180))}${returnHash}`);
      }
    }

    const user = await currentUser(req);
    if (!user) throw fail("Đăng nhập HH Platform để dùng YouTube Publisher.", 401, "AUTH_REQUIRED");
    const routeLimit = route === "videos/delete" ? 12 : route === "bulk/upload/sessions" ? 240 : route === "upload/session" ? 24 : route === "upload/progress" ? 1200 : 160;
    await enforceRateLimit(db, `youtube:${route}:${user._id}`, routeLimit, 15 * 60 * 1000);

    if (route === "oauth/start" && req.method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw fail("Google OAuth chưa được cấu hình trên Vercel.", 503, "GOOGLE_OAUTH_NOT_CONFIGURED");
      const rawState = crypto.randomBytes(36).toString("base64url");
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const requested = permissionPreset(clean(body.permissionPreset, 30));
      await states.insertOne({
        stateHash,
        userId: user._id,
        permissionPreset: requested.id,
        requestedScopes: requested.scopes,
        returnTo: safeFrontend(body.returnTo),
        returnHash: safeReturnHash(body.returnHash),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      const authUrl = new URL(OAUTH_ORIGIN);
      authUrl.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl(req),
        response_type: "code",
        scope: requested.scopes.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent select_account",
        state: rawState
      });
      return res.status(200).json({
        authorizeUrl: authUrl.toString(),
        callbackUrl: callbackUrl(req),
        permissionPreset: requested.id,
        requestedScopes: requested.scopes.filter((scope) => scope.startsWith("https://www.googleapis.com/auth/"))
      });
    }

    if (route === "status" && req.method === "GET") {
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).limit(CHANNEL_VAULT_LIMIT).toArray();
      const connection = allConnections.find((item) => item.active) || allConnections[0] || null;
      const history = connection
        ? await uploads.find({ userId: user._id, channelId: connection.channelId }).sort({ createdAt: -1 }).limit(20).toArray()
        : [];
      return res.status(200).json({
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        callbackUrl: callbackUrl(req),
        ...publicConnection(connection, allConnections),
        bulk: {
          enabled: true,
          maxChannelsPerJob: BULK_CHANNEL_LIMIT,
          maxChannelsInVault: CHANNEL_VAULT_LIMIT,
          maxVideosPerQueue: VIDEO_QUEUE_LIMIT,
          maxTasksPerBatch: BULK_TASK_LIMIT,
          defaultPrivacy: "private",
          publicRequiresManualReview: true
        },
        verificationReadiness: {
          scopeModel: "granular-least-privilege",
          sourceAccountImpactRequired: true,
          consentScreenMustShowAllServices: true,
          privacyPolicyUrl: `${safeFrontend(process.env.PUBLIC_SITE_URL)}/privacy.html#google-api-data`,
          exactSubmittedScopes: [YOUTUBE_SCOPE.upload, YOUTUBE_SCOPE.manage],
          analyticsScopeRequiresSeparateApproval: true
        },
        playlists: connection?.playlists || [],
        history: history.map((item) => ({
          id: String(item._id),
          videoId: item.videoId || "",
          title: item.title,
          fileName: item.fileName,
          status: item.status,
          privacyStatus: item.privacyStatus,
          publishAt: item.publishAt || null,
          bytesUploaded: Number(item.bytesUploaded || 0),
          totalBytes: Number(item.totalBytes || item.fileSize || 0),
          speedBps: Number(item.speedBps || 0),
          etaSeconds: Number(item.etaSeconds || 0),
          processingStatus: item.processingStatus || "",
          createdAt: item.createdAt,
          completedAt: item.completedAt || null,
          error: item.error || ""
        }))
      });
    }

    if (route === "channels/overview" && req.method === "GET") {
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).limit(CHANNEL_VAULT_LIMIT).toArray();
      const grouped = new Map();
      allConnections.forEach((connection) => {
        const accountKey = clean(connection.googleAccountKey || "legacy", 64).slice(0, 16) || "legacy";
        if (!grouped.has(accountKey)) grouped.set(accountKey, {
          key: accountKey,
          hint: clean(connection.googleAccountHint || "Tài khoản Google đã kết nối", 254),
          channels: []
        });
        grouped.get(accountKey).channels.push(publicOwnedChannel(connection));
      });
      return res.status(200).json({
        ok: true,
        confirmed: true,
        visibility: "owner-only",
        ownerIsolated: true,
        accounts: [...grouped.values()],
        channels: allConnections.map(publicOwnedChannel),
        limits: {
          maxChannelsPerBulkJob: BULK_CHANNEL_LIMIT,
          maxChannelsInVault: CHANNEL_VAULT_LIMIT,
          maxVideosPerQueue: VIDEO_QUEUE_LIMIT,
          maxTasksPerBatch: BULK_TASK_LIMIT
        },
        syncedAt: new Date()
      });
    }

    if (route === "channels/refresh-bulk" && req.method === "POST") {
      const selectedConnections = await ownedConnectionsForIds(db, user, body.channelIds);
      const results = await Promise.all(selectedConnections.map(async (connection) => {
        try {
          const accessToken = await refreshAccessToken(connection, connections);
          const bundle = await channelBundle(accessToken);
          if (String(bundle.channel.channelId) !== String(connection.channelId)) throw fail("Google trả về kênh không khớp kết nối sở hữu.", 409, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
          const updatedAt = new Date();
          await connections.updateOne(ownedConnectionFilter(connection), { $set: { ...bundle.channel, playlists: bundle.playlists, lastApiAt: updatedAt, updatedAt } });
          return { channelId: connection.channelId, ok: true, syncedAt: updatedAt };
        } catch (error) {
          return { channelId: connection.channelId, ok: false, error: clean(error.message, 180) };
        }
      }));
      await writeAudit(db, {
        userId: user._id,
        channelId: selectedConnections[0]?.channelId || "fleet",
        action: "channels:refresh-bulk",
        status: results.some((item) => !item.ok) ? "partial" : "completed",
        detail: `${results.filter((item) => item.ok).length}/${results.length}`
      });
      return res.status(200).json({ ok: true, confirmed: true, results, syncedAt: new Date() });
    }

    if (route === "channel/settings" && ["GET", "POST"].includes(req.method)) {
      const connection = await connectionFor(db, user, clean(body.channelId || req.query?.channelId, 120));
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const currentResult = await youtubeJson(accessToken, "/youtube/v3/channels", { part: "snippet,brandingSettings,status", id: connection.channelId });
      const current = currentResult.items?.[0];
      if (!current || String(current.id) !== String(connection.channelId)) throw fail("YouTube không trả về đúng kênh thuộc tài khoản này.", 409, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
      if (req.method === "GET" || body.operation === "read") return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, profile: publicChannelSettings(current) });

      const previous = current.brandingSettings?.channel || {};
      const countryInput = clean(body.country, 2).toUpperCase();
      const brandingChannel = {
        title: clean(current.snippet?.title || previous.title, 100),
        description: clean(body.description, 1000),
        keywords: clean(body.keywords, 500),
        defaultLanguage: clean(body.defaultLanguage, 12),
        unsubscribedTrailer: clean(body.trailerVideoId, 40),
        moderateComments: body.moderateComments === true,
        ...(countryInput ? { country: countryInput } : {})
      };
      const updated = await youtubeJson(accessToken, "/youtube/v3/channels", { part: "brandingSettings" }, {
        method: "PUT",
        body: JSON.stringify({ id: connection.channelId, brandingSettings: { channel: brandingChannel } })
      });
      const updatedChannel = { ...current, ...updated, snippet: current.snippet, brandingSettings: { ...current.brandingSettings, ...(updated?.brandingSettings || {}), channel: updated?.brandingSettings?.channel || brandingChannel } };
      const profile = publicChannelSettings(updatedChannel);
      const updatedAt = new Date();
      await connections.updateOne(ownedConnectionFilter(connection), { $set: {
        channelDescription: profile.description,
        channelCountry: profile.country,
        channelDefaultLanguage: profile.defaultLanguage,
        channelKeywords: profile.keywords,
        channelTrailerVideoId: profile.trailerVideoId,
        channelModerateComments: profile.moderateComments,
        lastApiAt: updatedAt,
        updatedAt
      } });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "channel:settings-update", targetId: connection.channelId, status: "completed", quotaCost: 50, detail: "brandingSettings.channel" });
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, profile, updatedAt });
    }

    if (route === "channels/observatory" && req.method === "GET") {
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).limit(CHANNEL_VAULT_LIMIT).toArray();
      const [recentUploads, pendingDrafts] = await Promise.all([
        uploads.find({ userId: user._id }).sort({ createdAt: -1 }).limit(2000).toArray(),
        commentDrafts.find({ userId: user._id, status: "draft" }).sort({ createdAt: -1 }).limit(2000).toArray()
      ]);
      const uploadsByChannel = new Map();
      recentUploads.forEach((upload) => {
        const id = String(upload.channelId || "");
        if (!uploadsByChannel.has(id)) uploadsByChannel.set(id, []);
        uploadsByChannel.get(id).push(upload);
      });
      const draftsByChannel = new Map();
      pendingDrafts.forEach((draft) => {
        const id = String(draft.channelId || "");
        draftsByChannel.set(id, (draftsByChannel.get(id) || 0) + 1);
      });
      const rows = allConnections.map((connection) => {
        const channelUploads = uploadsByChannel.get(String(connection.channelId)) || [];
        const latest = channelUploads[0] || null;
        return {
          channel: publicOwnedChannel(connection),
          uploads: {
            pending: channelUploads.filter((item) => ["uploading", "processing"].includes(item.status)).length,
            failed: channelUploads.filter((item) => ["error", "failed"].includes(item.status)).length,
            completed: channelUploads.filter((item) => ["uploaded", "scheduled", "private", "unlisted", "completed"].includes(item.status)).length,
            latest: latest ? {
              id: String(latest._id),
              videoId: clean(latest.videoId, 30),
              title: clean(latest.title || latest.fileName, 160),
              status: clean(latest.status, 40),
              progress: Number(latest.totalBytes || latest.fileSize || 0) > 0
                ? Math.min(100, Number(latest.bytesUploaded || 0) / Number(latest.totalBytes || latest.fileSize) * 100)
                : 0,
              updatedAt: latest.updatedAt || latest.createdAt || null
            } : null
          },
          unansweredDrafts: Number(draftsByChannel.get(String(connection.channelId)) || 0),
          syncedAt: connection.updatedAt || connection.connectedAt || null
        };
      });
      return res.status(200).json({
        ok: true,
        confirmed: true,
        ownerIsolated: true,
        summary: {
          channels: rows.length,
          uploadReady: rows.filter((row) => row.channel?.permissions?.upload && row.channel?.token?.healthy).length,
          pendingUploads: rows.reduce((sum, row) => sum + row.uploads.pending, 0),
          failedUploads: rows.reduce((sum, row) => sum + row.uploads.failed, 0),
          unansweredDrafts: rows.reduce((sum, row) => sum + row.unansweredDrafts, 0),
          subscribers: rows.reduce((sum, row) => sum + Number(row.channel?.statistics?.subscribers || 0), 0),
          views: rows.reduce((sum, row) => sum + Number(row.channel?.statistics?.views || 0), 0)
        },
        channels: rows,
        limits: {
          maxChannelsInVault: CHANNEL_VAULT_LIMIT,
          maxChannelsPerBulkJob: BULK_CHANNEL_LIMIT,
          maxVideosPerQueue: VIDEO_QUEUE_LIMIT,
          maxTasksPerBatch: BULK_TASK_LIMIT
        },
        syncedAt: new Date()
      });
    }

    if (route === "bulk/preflight" && req.method === "POST") {
      const action = ["upload", "manage", "analytics"].includes(body.action) ? body.action : "upload";
      const selectedConnections = await ownedConnectionsForIds(db, user, body.channelIds, { max: CHANNEL_VAULT_LIMIT });
      const submittedTasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 1000);
      const unreviewedAiTasks = submittedTasks.filter((item) => aiDisclosureOf(item?.aiDisclosure) === "unreviewed");
      const aiPublishBlockedTasks = unreviewedAiTasks.filter((item) => ["public", "schedule"].includes(clean(item?.desiredPrivacyStatus, 24)));
      const rows = selectedConnections.map((connection) => {
        const permissionReady = hasYoutubePermission(connection, action === "manage" ? "manage" : action);
        return {
          channel: publicOwnedChannel(connection),
          permissionReady,
          refreshTokenReady: Boolean(connection.refreshToken),
          ready: permissionReady && Boolean(connection.refreshToken),
          reasons: [
            ...(!permissionReady ? [`missing-${action}-scope`] : []),
            ...(!connection.refreshToken ? ["missing-refresh-token"] : [])
          ]
        };
      });
      const estimatedAction = action === "upload" ? "upload:create" : action === "manage" ? "videos:update" : "analytics:read";
      return res.status(200).json({
        ok: true,
        confirmed: true,
        action,
        ready: rows.every((item) => item.ready),
        channels: rows,
        estimatedQuota: quotaCost(estimatedAction) * rows.length,
        quotaSource: "HH configurable quota ledger; Google Cloud Console remains authoritative",
        approvalRequired: true,
        publicPublishingAllowed: false,
        aiReview: {
          reviewed: submittedTasks.length - unreviewedAiTasks.length,
          unreviewed: unreviewedAiTasks.length,
          publishBlocked: aiPublishBlockedTasks.length,
          privateUploadAllowed: true
        }
      });
    }

    if (route === "bulk/jobs" && req.method === "GET") {
      const jobs = await bulkJobs.find({ userId: user._id }).sort({ createdAt: -1 }).limit(120).toArray();
      return res.status(200).json({
        ok: true,
        confirmed: true,
        jobs: jobs.map((job) => ({
          id: String(job._id),
          action: clean(job.action, 40),
          status: clean(job.status, 40),
          channelIds: Array.isArray(job.channelIds) ? job.channelIds.map((id) => clean(id, 120)) : [],
          results: Array.isArray(job.results) ? job.results.map((item) => ({
            channelId: clean(item.channelId, 120),
            uploadId: clean(item.uploadId, 80),
            status: clean(item.status, 40),
            videoId: clean(item.videoId, 30),
            taskKey: clean(item.taskKey, 390),
            videoFingerprint: clean(item.videoFingerprint, 260),
            fileName: clean(item.fileName, 240),
            checksum: clean(item.checksum, 80),
            metadataVersion: clean(item.metadataVersion, 80),
            error: clean(item.error, 180)
          })) : [],
          createdAt: job.createdAt || null,
          updatedAt: job.updatedAt || null
        }))
      });
    }

    if (route === "bulk/publish/approve" && req.method === "POST") {
      if (body.approved !== true) throw fail("Cần xác nhận trước khi thay đổi lịch hoặc quyền hiển thị.", 409, "YOUTUBE_PUBLISH_APPROVAL_REQUIRED");
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!record?.videoId) throw fail("Video chưa tải xong hoặc chưa có Video ID.", 409, "YOUTUBE_VIDEO_PENDING");
      const connection = await connectionFor(db, user, record.channelId);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const desiredPublishAt = record.desiredPublishAt ? new Date(record.desiredPublishAt) : null;
      if (desiredPublishAt && (!Number.isFinite(desiredPublishAt.getTime()) || desiredPublishAt.getTime() <= Date.now() + 60_000)) {
        throw fail("Lịch đăng không còn hợp lệ; hãy đặt lại thời gian trong tương lai.", 409, "YOUTUBE_SCHEDULE_INVALID");
      }
      const aiDisclosure = aiDisclosureOf(record.aiDisclosure);
      if (desiredPublishAt && aiDisclosure === "unreviewed") {
        throw fail("Video chưa được khai báo nội dung AI. Hãy chọn Có hoặc Không trước khi lên lịch.", 409, "YOUTUBE_AI_DISCLOSURE_REQUIRED");
      }
      const desiredPrivacyStatus = record.desiredPrivacyStatus === "unlisted" ? "unlisted" : "private";
      const current = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "status,processingDetails", id: record.videoId });
      const video = current.items?.[0];
      if (!video) throw fail("Không tìm thấy video trên đúng kênh sở hữu.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
      if (video.processingDetails?.processingStatus !== "succeeded") throw fail("YouTube chưa xử lý xong video; chưa thể áp lịch hoặc quyền hiển thị.", 409, "YOUTUBE_PROCESSING_PENDING");
      const nextStatus = {
        privacyStatus: desiredPublishAt ? "private" : desiredPrivacyStatus,
        license: video.status?.license === "creativeCommon" ? "creativeCommon" : "youtube",
        embeddable: video.status?.embeddable !== false,
        publicStatsViewable: video.status?.publicStatsViewable !== false,
        selfDeclaredMadeForKids: Boolean(video.status?.selfDeclaredMadeForKids)
      };
      if (aiDisclosure !== "unreviewed") nextStatus.containsSyntheticMedia = aiDisclosure === "yes";
      if (desiredPublishAt) nextStatus.publishAt = desiredPublishAt.toISOString();
      else delete nextStatus.publishAt;
      await youtubeJson(accessToken, "/youtube/v3/videos", { part: "status" }, {
        method: "PUT",
        body: JSON.stringify({ id: record.videoId, status: nextStatus })
      });
      const approvedAt = new Date();
      await uploads.updateOne(
        { _id: record._id, userId: user._id, channelId: record.channelId },
        { $set: { status: desiredPublishAt ? "scheduled" : desiredPrivacyStatus, privacyStatus: desiredPrivacyStatus, publishAt: desiredPublishAt, approvedAt, updatedAt: approvedAt } }
      );
      if (record.bulkJobId) {
        await bulkJobs.updateOne(
          { _id: record.bulkJobId, userId: user._id, "results.uploadId": uploadId },
          { $set: { "results.$.status": desiredPublishAt ? "scheduled" : desiredPrivacyStatus, "results.$.videoId": record.videoId, updatedAt: approvedAt } }
        );
      }
      await writeAudit(db, {
        userId: user._id,
        channelId: record.channelId,
        action: "upload:approve-publish",
        targetId: record.videoId,
        status: "completed",
        detail: desiredPublishAt ? desiredPublishAt.toISOString() : desiredPrivacyStatus
      });
      return res.status(200).json({ ok: true, confirmed: true, videoId: record.videoId, status: desiredPublishAt ? "scheduled" : desiredPrivacyStatus, publishAt: desiredPublishAt });
    }

    if (route === "bulk/upload/sessions" && req.method === "POST") {
      if (body.approved !== true || body.rightsConfirmed !== true) {
        throw fail("Bulk upload cần xác nhận phê duyệt và quyền sử dụng nội dung.", 409, "YOUTUBE_BULK_APPROVAL_REQUIRED");
      }
      const privacyStatus = ["private", "unlisted"].includes(body.privacyStatus) ? body.privacyStatus : "private";
      if (body.privacyStatus === "public") throw fail("Bulk upload không tự chuyển Public. Hãy duyệt từng kênh sau khi YouTube xử lý xong.", 409, "YOUTUBE_BULK_PUBLIC_BLOCKED");
      const queueVideoCount = Math.max(1, Number(body.queueVideoCount || 1));
      if (queueVideoCount > VIDEO_QUEUE_LIMIT) throw fail(`Mỗi kênh chỉ nhận tối đa ${VIDEO_QUEUE_LIMIT} video trong một đợt.`, 400, "YOUTUBE_VIDEO_QUEUE_LIMIT");
      const idempotencyKey = clean(body.idempotencyKey, 160);
      if (!/^[a-zA-Z0-9_-]{16,160}$/.test(idempotencyKey)) throw fail("Idempotency key không hợp lệ.", 400, "YOUTUBE_IDEMPOTENCY_INVALID");
      const selectedConnections = await ownedConnectionsForIds(db, user, body.channelIds);
      selectedConnections.forEach((connection) => requireYoutubePermission(connection, "upload"));
      const selectedChannelIds = new Set(selectedConnections.map((connection) => String(connection.channelId)));
      const submittedChannels = (Array.isArray(body.channels) ? body.channels : []).slice(0, BULK_CHANNEL_LIMIT);
      if (submittedChannels.some((item) => !selectedChannelIds.has(clean(item?.channelId, 120)))) {
        throw fail("Metadata chứa kênh không thuộc danh sách đã chọn.", 403, "YOUTUBE_CHANNEL_NOT_OWNED");
      }
      const channelPayloads = new Map(submittedChannels.map((item) => {
        const channelId = clean(item?.channelId, 120);
        const desiredPublishAtValue = clean(item?.desiredPublishAt, 40);
        const desiredPublishAtDate = desiredPublishAtValue ? new Date(desiredPublishAtValue) : null;
        if (desiredPublishAtValue && (!Number.isFinite(desiredPublishAtDate.getTime()) || desiredPublishAtDate.getTime() <= Date.now() + 60_000)) {
          throw fail("Lịch đăng của một kênh không hợp lệ hoặc đã ở trong quá khứ.", 400, "YOUTUBE_SCHEDULE_INVALID");
        }
        return [channelId, {
          title: clean(item?.title || body.title, 100),
          description: clean(item?.description ?? body.description, 5000),
          tags: normalizedTags(item?.tags ?? body.tags),
          categoryId: /^\d{1,3}$/.test(String(item?.categoryId || "")) ? String(item.categoryId) : clean(body.categoryId || "22", 8),
          defaultLanguage: clean(item?.defaultLanguage || body.defaultLanguage || "vi", 12),
          playlistId: clean(item?.playlistId, 120),
          desiredPublishAt: desiredPublishAtDate,
          desiredPrivacyStatus: desiredPublishAtDate ? "schedule" : item?.desiredPrivacyStatus === "unlisted" ? "unlisted" : "private",
          privacyStatus: ["private", "unlisted"].includes(item?.privacyStatus) ? item.privacyStatus : privacyStatus,
          aiDisclosure: aiDisclosureOf(item?.aiDisclosure ?? body.aiDisclosure),
          taskKey: clean(item?.taskKey || `${clean(item?.videoFingerprint || body.videoFingerprint, 260)}::${channelId}`, 390),
          videoFingerprint: clean(item?.videoFingerprint || body.videoFingerprint, 260),
          metadataVersion: clean(item?.metadataVersion || body.metadataVersion, 80),
          checksum: clean(item?.checksum || body.checksum, 80)
        }];
      }).filter(([channelId]) => channelId));
      const existing = await bulkJobs.findOne({ userId: user._id, idempotencyKey });
      if (existing) {
        const records = await uploads.find({ userId: user._id, bulkJobId: existing._id }).toArray();
        const sessions = [];
        for (const record of records) {
          const connection = selectedConnections.find((item) => String(item.channelId) === String(record.channelId));
          if (!connection || !record.uploadSession || !["uploading", "error"].includes(record.status)) continue;
          sessions.push({
            channelId: record.channelId,
            channelTitle: connection.channelTitle,
            uploadId: String(record._id),
            uploadUrl: decryptToken(record.uploadSession, connection),
            chunkSize: 8 * 1024 * 1024,
            bytesUploaded: Number(record.bytesUploaded || 0),
            taskKey: clean(record.taskKey, 390),
            videoFingerprint: clean(record.videoFingerprint, 260),
            fileName: clean(record.fileName, 240),
            checksum: clean(record.checksum, 80),
            metadataVersion: clean(record.metadataVersion, 80)
          });
        }
        return res.status(200).json({ ok: true, confirmed: true, reused: true, bulkJobId: String(existing._id), status: existing.status, sessions });
      }
      const now = new Date();
      const job = {
        userId: user._id,
        idempotencyKey,
        action: "upload",
        status: "creating-sessions",
        channelIds: selectedConnections.map((connection) => connection.channelId),
        privacyStatus,
        results: [],
        createdAt: now,
        updatedAt: now
      };
      const jobInsert = await bulkJobs.insertOne(job);
      const results = await Promise.all(selectedConnections.map(async (connection) => {
        try {
          const accessToken = await refreshAccessToken(connection, connections);
          const channelPayload = channelPayloads.get(String(connection.channelId)) || {
            title: clean(body.title, 100),
            description: clean(body.description, 5000),
            tags: normalizedTags(body.tags),
            categoryId: clean(body.categoryId || "22", 8),
            defaultLanguage: clean(body.defaultLanguage || "vi", 12),
            playlistId: "",
            desiredPublishAt: null,
            desiredPrivacyStatus: privacyStatus,
            privacyStatus,
            aiDisclosure: aiDisclosureOf(body.aiDisclosure),
            taskKey: clean(`${clean(body.videoFingerprint, 260)}::${connection.channelId}`, 390),
            videoFingerprint: clean(body.videoFingerprint, 260),
            metadataVersion: clean(body.metadataVersion, 80),
            checksum: clean(body.checksum, 80)
          };
          if (!channelPayload.title) throw fail("Tiêu đề của kênh đang trống.", 400, "YOUTUBE_CHANNEL_TITLE_REQUIRED");
          const duplicate = channelPayload.taskKey && channelPayload.metadataVersion ? await uploads.findOne({
            userId: user._id,
            channelId: connection.channelId,
            taskKey: channelPayload.taskKey,
            metadataVersion: channelPayload.metadataVersion,
            status: { $in: ["processing", "uploaded", "scheduled", "private", "unlisted", "published", "completed"] }
          }) : null;
          if (duplicate) return { channelId: connection.channelId, channelTitle: connection.channelTitle, uploadId: String(duplicate._id), videoId: clean(duplicate.videoId, 40), taskKey: channelPayload.taskKey, videoFingerprint: channelPayload.videoFingerprint, fileName: clean(duplicate.fileName, 240), checksum: channelPayload.checksum, metadataVersion: channelPayload.metadataVersion, status: clean(duplicate.status, 40), reused: true };
          const session = await initiateResumable(accessToken, { ...body, ...channelPayload, privacyStatus: channelPayload.privacyStatus, publishAt: "", notifySubscribers: false });
          const record = {
            userId: user._id,
            channelId: connection.channelId,
            bulkJobId: jobInsert.insertedId,
            title: session.resource.snippet.title,
            fileName: clean(body.fileName, 240),
            fileSize: Number(body.fileSize),
            mimeType: clean(body.mimeType, 100),
            privacyStatus: channelPayload.privacyStatus,
            publishAt: null,
            desiredPublishAt: channelPayload.desiredPublishAt,
            desiredPrivacyStatus: channelPayload.desiredPrivacyStatus,
            playlistId: channelPayload.playlistId,
            taskKey: channelPayload.taskKey,
            videoFingerprint: channelPayload.videoFingerprint,
            metadataVersion: channelPayload.metadataVersion,
            checksum: channelPayload.checksum,
            aiDisclosure: channelPayload.aiDisclosure,
            aiDeclaredAt: channelPayload.aiDisclosure === "unreviewed" ? null : new Date(),
            aiDeclaredBy: channelPayload.aiDisclosure === "unreviewed" ? "" : String(user._id),
            idempotencyKey,
            status: "uploading",
            uploadSession: encryptToken(session.uploadUrl, connection),
            bytesUploaded: 0,
            totalBytes: Number(body.fileSize),
            speedBps: 0,
            etaSeconds: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const inserted = await uploads.insertOne(record);
          await writeAudit(db, {
            userId: user._id,
            channelId: connection.channelId,
            action: "upload:create",
            targetId: String(inserted.insertedId),
            status: "started",
            detail: `Bulk ${idempotencyKey}`
          });
          return {
            channelId: connection.channelId,
            channelTitle: connection.channelTitle,
            uploadId: String(inserted.insertedId),
            uploadUrl: session.uploadUrl,
            chunkSize: 8 * 1024 * 1024,
            taskKey: channelPayload.taskKey,
            videoFingerprint: channelPayload.videoFingerprint,
            fileName: record.fileName,
            checksum: channelPayload.checksum,
            metadataVersion: channelPayload.metadataVersion,
            status: "uploading"
          };
        } catch (error) {
          return { channelId: connection.channelId, channelTitle: connection.channelTitle, status: "failed", error: clean(error.message, 180) };
        }
      }));
      const storedResults = results.map(({ uploadUrl, channelTitle, chunkSize, ...item }) => item);
      const jobStatus = results.some((item) => item.status === "uploading") ? "sessions-ready" : "failed";
      await bulkJobs.updateOne({ _id: jobInsert.insertedId, userId: user._id }, { $set: { status: jobStatus, results: storedResults, updatedAt: new Date() } });
      return res.status(201).json({
        ok: true,
        confirmed: true,
        bulkJobId: String(jobInsert.insertedId),
        status: jobStatus,
        privacyStatus,
        sessions: results.filter((item) => item.status === "uploading"),
        failures: results.filter((item) => item.status === "failed"),
        reused: results.filter((item) => item.reused)
      });
    }

    if (route === "audit" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      const rows = await audits.find({ userId: user._id, channelId: connection.channelId })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      return res.status(200).json({
        ok: true,
        confirmed: true,
        audit: rows.map(publicAudit),
        quota: await observedQuota(db, user._id, connection.channelId),
        syncedAt: new Date()
      });
    }

    if (route === "project" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      const project = await projects.findOne({ userId: user._id, channelId: connection.channelId });
      return res.status(200).json({ ok: true, confirmed: true, project: project ? {
        id: String(project._id),
        title: project.title,
        sourceProjectId: project.sourceProjectId || "",
        sourceAssetId: project.sourceAssetId || "",
        videoId: project.videoId || "",
        renderStatus: project.renderStatus || "idle",
        metadata: project.metadata || {},
        thumbnails: project.thumbnails || [],
        captions: project.captions || [],
        rightsManifest: project.rightsManifest || {},
        approvals: project.approvals || {},
        automation: project.automation || {},
        updatedAt: project.updatedAt || null
      } : null });
    }

    if (route === "project" && req.method === "PUT") {
      const connection = await connectionFor(db, user);
      const current = await projects.findOne({ userId: user._id, channelId: connection.channelId });
      const project = normalizePublishProject(body.project, current || {});
      await projects.updateOne(
        { userId: user._id, channelId: connection.channelId },
        {
          $set: { ...project, userId: user._id, channelId: connection.channelId },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "project:update",
        status: "completed",
        detail: project.title
      });
      return res.status(200).json({ ok: true, confirmed: true, project });
    }

    if (route === "dashboard" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      const accessToken = await refreshAccessToken(connection, connections);
      const warnings = [];
      const analyticsPermission = hasYoutubePermission(connection, "analytics");
      if (!analyticsPermission) warnings.push({
        source: "analytics",
        code: "YOUTUBE_SCOPE_REQUIRED",
        message: "Kênh chưa cấp quyền yt-analytics.readonly; các chức năng YouTube Data API vẫn hoạt động."
      });
      const [videos, analytics, comments, live, quotas, pendingUploads, auditRows, creatorProject, quotaLedger] = await Promise.all([
        settledResult(() => recentVideos(accessToken), [], warnings, "videos"),
        analyticsPermission ? settledResult(() => channelAnalytics(accessToken), null, warnings, "analytics") : Promise.resolve(null),
        settledResult(() => recentComments(accessToken, connection.channelId), [], warnings, "comments"),
        settledResult(() => broadcasts(accessToken), [], warnings, "live"),
        settledResult(async () => (await quotaStatus(db)).find((item) => item.provider === "youtube") || null, null, warnings, "quota"),
        uploads.find({
          userId: user._id,
          channelId: connection.channelId,
          status: { $in: ["uploading", "processing", "error"] }
        }).sort({ updatedAt: -1 }).limit(20).toArray(),
        audits.find({ userId: user._id, channelId: connection.channelId }).sort({ createdAt: -1 }).limit(30).toArray(),
        projects.findOne({ userId: user._id, channelId: connection.channelId }),
        observedQuota(db, user._id, connection.channelId)
      ]);
      await Promise.allSettled(videos.map((video) => {
        const processingStatus = video.processingStatus || "";
        const nextStatus = processingStatus === "succeeded"
          ? "uploaded"
          : processingStatus === "terminated"
            ? "error"
            : processingStatus
              ? "processing"
              : "";
        if (!nextStatus) return Promise.resolve();
        return uploads.updateMany(
          { userId: user._id, channelId: connection.channelId, videoId: video.id, status: { $in: ["uploaded", "processing"] } },
          { $set: { status: nextStatus, processingStatus, updatedAt: new Date(), ...(nextStatus === "uploaded" ? { completedAt: new Date() } : {}) } }
        );
      }));
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "dashboard:read",
        status: "completed"
      });
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).toArray();
      return res.status(200).json({
        ok: true,
        confirmed: true,
        ...publicConnection(connection, allConnections),
        videos,
        analytics,
        comments,
        live,
        quota: quotas,
        quotaLedger,
        audit: auditRows.map(publicAudit),
        project: creatorProject ? {
          id: String(creatorProject._id),
          title: creatorProject.title,
          sourceProjectId: creatorProject.sourceProjectId || "",
          sourceAssetId: creatorProject.sourceAssetId || "",
          videoId: creatorProject.videoId || "",
          renderStatus: creatorProject.renderStatus || "idle",
          metadata: creatorProject.metadata || {},
          thumbnails: creatorProject.thumbnails || [],
          captions: creatorProject.captions || [],
          rightsManifest: creatorProject.rightsManifest || {},
          approvals: creatorProject.approvals || {},
          automation: creatorProject.automation || {},
          updatedAt: creatorProject.updatedAt || null
        } : null,
        uploads: pendingUploads.map((item) => ({
          id: String(item._id),
          videoId: item.videoId || "",
          title: item.title,
          fileName: item.fileName,
          status: item.status,
          privacyStatus: item.privacyStatus,
          publishAt: item.publishAt || null,
          bytesUploaded: Number(item.bytesUploaded || 0),
          totalBytes: Number(item.totalBytes || item.fileSize || 0),
          speedBps: Number(item.speedBps || 0),
          etaSeconds: Number(item.etaSeconds || 0),
          processingStatus: item.processingStatus || "",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          error: item.error || ""
        })),
        warnings,
        syncedAt: new Date()
      });
    }

    if (route === "videos" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      return res.status(200).json({ ok: true, confirmed: true, videos: await recentVideos(accessToken), syncedAt: new Date() });
    }

    if (route === "content/library" && req.method === "POST") {
      const requestedChannelId = clean(body.channelId, 120);
      const owned = requestedChannelId
        ? [await connectionFor(db, user, requestedChannelId)]
        : await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).limit(CHANNEL_VAULT_LIMIT).toArray();
      const channelIds = owned.map((connection) => connection.channelId);
      const uploadRows = await uploads.find({ userId: user._id, deletedAt: { $exists: false }, ...(requestedChannelId ? { channelId: requestedChannelId } : { channelId: { $in: channelIds } }) })
        .sort({ updatedAt: -1 }).limit(1000).toArray();
      const declarationRows = channelIds.length ? await videoDeclarations.find({ userId: user._id, channelId: { $in: channelIds } }).limit(2000).toArray() : [];
      const declarationMap = new Map(declarationRows.map((item) => [`${item.channelId}::${item.videoId}`, item]));
      const channelMap = new Map(owned.map((connection) => [String(connection.channelId), connection]));
      const items = uploadRows.map((item) => {
        const connection = channelMap.get(String(item.channelId));
        const declaration = declarationMap.get(`${item.channelId}::${item.videoId}`);
        const aiDisclosure = aiDisclosureOf(declaration?.aiDisclosure || item.aiDisclosure);
        return {
          id: String(item._id),
          uploadId: String(item._id),
          channelId: clean(item.channelId, 120),
          channelTitle: clean(connection?.channelTitle, 160),
          channelThumbnail: clean(connection?.channelThumbnail, 800),
          videoId: clean(item.videoId, 40),
          title: clean(item.title || item.fileName, 160),
          fileName: clean(item.fileName, 240),
          fileSize: Number(item.fileSize || item.totalBytes || 0),
          checksum: clean(item.checksum, 80),
          videoFingerprint: clean(item.videoFingerprint, 260),
          metadataVersion: clean(item.metadataVersion, 80),
          taskKey: clean(item.taskKey, 390),
          status: clean(item.status, 40),
          privacyStatus: clean(item.privacyStatus || "private", 24),
          scheduledAt: item.publishAt || item.desiredPublishAt || null,
          publishAt: item.publishAt || null,
          processingStatus: clean(item.processingStatus, 40),
          processingProgress: clean(item.processingProgress, 80),
          definition: clean(item.definition, 20),
          uploadStatus: clean(item.uploadStatus, 40),
          thumbnail: clean(item.thumbnail, 800),
          failureReason: clean(item.failureReason, 80),
          rejectionReason: clean(item.rejectionReason, 80),
          containsSyntheticMedia: aiDisclosure === "yes",
          aiDisclosure,
          aiDisclosureSource: aiDisclosure === "unreviewed" ? "unknown" : "user-declared",
          aiDeclaredAt: declaration?.declaredAt || item.aiDeclaredAt || null,
          bytesUploaded: Number(item.bytesUploaded || 0),
          totalBytes: Number(item.totalBytes || item.fileSize || 0),
          speedBps: Number(item.speedBps || 0),
          etaSeconds: Number(item.etaSeconds || 0),
          progress: Number(item.totalBytes || item.fileSize || 0) > 0 ? Math.min(100, Number(item.bytesUploaded || 0) / Number(item.totalBytes || item.fileSize) * 100) : 0,
          error: clean(item.error, 400),
          metrics: { views: Number(item.views || 0), likes: Number(item.likes || 0), comments: Number(item.comments || 0) },
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null
        };
      });
      const liveConnection = requestedChannelId ? owned[0] : owned.find((connection) => connection.active) || owned[0];
      if (liveConnection && hasYoutubePermission(liveConnection, "manage")) {
        try {
          const accessToken = await refreshAccessToken(liveConnection, connections);
          const liveVideos = await recentVideos(accessToken);
          liveVideos.forEach((video) => {
            const existing = items.find((item) => item.channelId === String(liveConnection.channelId) && item.videoId === video.id);
            const declaration = declarationMap.get(`${liveConnection.channelId}::${video.id}`);
            const aiDisclosure = declaration ? aiDisclosureOf(declaration.aiDisclosure) : video.aiDisclosure;
            const merged = {
              ...video,
              id: existing?.id || `${liveConnection.channelId}:${video.id}`,
              uploadId: existing?.uploadId || "",
              channelId: String(liveConnection.channelId),
              channelTitle: clean(liveConnection.channelTitle, 160),
              status: video.processingStatus === "terminated" ? "error" : video.processingStatus && video.processingStatus !== "succeeded" ? "processing" : video.scheduledAt ? "scheduled" : video.privacyStatus === "public" ? "published" : "uploaded",
              metrics: { views: video.views, likes: video.likes, comments: video.comments },
              containsSyntheticMedia: aiDisclosure === "yes",
              aiDisclosure,
              aiDisclosureSource: declaration && aiDisclosure !== "unreviewed" ? "user-declared" : video.aiDisclosureSource,
              aiDeclaredAt: declaration?.declaredAt || null,
              updatedAt: existing?.updatedAt || video.publishedAt
            };
            if (existing) Object.assign(existing, merged); else items.push(merged);
          });
        } catch {}
      }
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, items: items.sort((left, right) => new Date(right.updatedAt || right.publishedAt || 0) - new Date(left.updatedAt || left.publishedAt || 0)), syncedAt: new Date() });
    }

    if (route === "content/processing/refresh" && req.method === "POST") {
      const requestedChannelId = clean(body.channelId, 120);
      if (requestedChannelId) await connectionFor(db, user, requestedChannelId);
      const records = await uploads.find({ userId: user._id, ...(requestedChannelId ? { channelId: requestedChannelId } : {}), videoId: { $type: "string", $ne: "" }, status: { $in: ["processing", "uploaded", "scheduled", "private", "unlisted"] } }).sort({ updatedAt: -1 }).limit(500).toArray();
      const byChannel = new Map();
      records.forEach((record) => {
        const key = String(record.channelId);
        if (!byChannel.has(key)) byChannel.set(key, []);
        byChannel.get(key).push(record);
      });
      let refreshed = 0;
      const failures = [];
      for (const [channelId, channelRecords] of byChannel) {
        try {
          const connection = await connectionFor(db, user, channelId);
          requireYoutubePermission(connection, "manage");
          const accessToken = await refreshAccessToken(connection, connections);
          for (let offset = 0; offset < channelRecords.length; offset += 50) {
            const chunk = channelRecords.slice(offset, offset + 50);
            const data = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet,status,statistics,processingDetails,contentDetails", id: chunk.map((record) => record.videoId).join(",") });
            for (const video of data.items || []) {
              const normalized = normalizedVideo(video);
              const status = normalized.processingStatus === "terminated" ? "error" : normalized.processingStatus && normalized.processingStatus !== "succeeded" ? "processing" : normalized.scheduledAt ? "scheduled" : normalized.privacyStatus === "public" ? "published" : normalized.privacyStatus || "uploaded";
              await uploads.updateMany({ userId: user._id, channelId: connection.channelId, videoId: normalized.id }, { $set: { status, processingStatus: normalized.processingStatus, processingProgress: normalized.processingProgress, definition: normalized.definition, uploadStatus: normalized.uploadStatus, privacyStatus: normalized.privacyStatus, publishAt: normalized.scheduledAt ? new Date(normalized.scheduledAt) : null, failureReason: normalized.failureReason, rejectionReason: normalized.rejectionReason, views: normalized.views, likes: normalized.likes, comments: normalized.comments, thumbnail: normalized.thumbnail, updatedAt: new Date() } });
              refreshed += 1;
            }
          }
        } catch (error) { failures.push({ channelId, error: clean(error.message, 180) }); }
      }
      await writeAudit(db, { userId: user._id, channelId: requestedChannelId || "fleet", action: "content:processing-refresh", status: failures.length ? "partial" : "completed", detail: `${refreshed} video` });
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, refreshed, failures, syncedAt: new Date() });
    }

    if (route === "video/details" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "manage");
      const videoId = clean(body.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const accessToken = await refreshAccessToken(connection, connections);
      const [data, captions, auditRows, declaration, uploadRecord] = await Promise.all([
        youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet,status,statistics,processingDetails,contentDetails,paidProductPlacementDetails,recordingDetails,fileDetails,suggestions", id: videoId }),
        youtubeJson(accessToken, "/youtube/v3/captions", { part: "id,snippet", videoId }).catch(() => ({ items: [] })),
        audits.find({ userId: user._id, channelId: connection.channelId, targetId: videoId }).sort({ createdAt: -1 }).limit(30).toArray(),
        videoDeclarations.findOne({ userId: user._id, channelId: connection.channelId, videoId }),
        uploads.findOne({ userId: user._id, channelId: connection.channelId, videoId }, { sort: { updatedAt: -1 }, projection: { aiDisclosure: 1, aiDeclaredAt: 1 } })
      ]);
      const video = data.items?.[0];
      if (!video) throw fail("Không tìm thấy video trên đúng kênh sở hữu.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:details", targetId: videoId, status: "completed" });
      const normalized = normalizedVideo(video);
      const aiDisclosure = declaration || uploadRecord ? aiDisclosureOf(declaration?.aiDisclosure || uploadRecord?.aiDisclosure) : normalized.aiDisclosure;
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, video: { ...normalized, channelId: String(connection.channelId), channelTitle: connection.channelTitle, containsSyntheticMedia: aiDisclosure === "yes", aiDisclosure, aiDisclosureSource: aiDisclosure !== "unreviewed" && (declaration || uploadRecord) ? "user-declared" : normalized.aiDisclosureSource, aiDeclaredAt: declaration?.declaredAt || uploadRecord?.aiDeclaredAt || null }, captions: (captions.items || []).map((item) => ({ id: clean(item.id, 120), name: clean(item.snippet?.name, 160), language: clean(item.snippet?.language, 24), status: clean(item.snippet?.status, 40) })), audit: auditRows.map(publicAudit) });
    }

    if (route === "video/analytics" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "analytics");
      const videoId = clean(body.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const accessToken = await refreshAccessToken(connection, connections);
      const owned = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet", id: videoId });
      if (String(owned.items?.[0]?.snippet?.channelId || "") !== String(connection.channelId)) throw fail("Video không thuộc kênh đã chọn.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
      const analytics = await channelAnalytics(accessToken, { videoId });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "analytics:video", targetId: videoId, status: "completed", quotaCost: quotaCost("analytics:read") });
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, videoId, analytics, syncedAt: new Date() });
    }

    if (route === "video/comments" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "manage");
      const videoId = clean(body.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const accessToken = await refreshAccessToken(connection, connections);
      const owned = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet", id: videoId });
      if (String(owned.items?.[0]?.snippet?.channelId || "") !== String(connection.channelId)) throw fail("Video không thuộc kênh đã chọn.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
      const comments = await recentVideoComments(accessToken, videoId);
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, videoId, comments, syncedAt: new Date() });
    }

    if (route === "analytics" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "analytics");
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(req.query.videoId, 40);
      const analytics = await channelAnalytics(accessToken, {
        videoId,
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.startDate || "")) ? req.query.startDate : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate || "")) ? req.query.endDate : undefined
      });
      return res.status(200).json({ ok: true, confirmed: true, analytics, videoId, syncedAt: new Date() });
    }

    if (route === "analytics/retention" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "analytics");
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(req.query.videoId, 40);
      const retention = await retentionAnalytics(accessToken, videoId, {
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.startDate || "")) ? req.query.startDate : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate || "")) ? req.query.endDate : undefined
      });
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "analytics:retention",
        targetId: videoId,
        status: "completed"
      });
      return res.status(200).json({ ok: true, confirmed: true, videoId, retention, syncedAt: new Date() });
    }

    if (route === "analytics/comparison" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "analytics");
      const accessToken = await refreshAccessToken(connection, connections);
      const comparison = await videoComparisonAnalytics(accessToken, {
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.startDate || "")) ? req.query.startDate : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate || "")) ? req.query.endDate : undefined
      });
      return res.status(200).json({ ok: true, confirmed: true, comparison, syncedAt: new Date() });
    }

    if (route === "comments" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const comments = await recentComments(accessToken, connection.channelId);
      return res.status(200).json({ ok: true, confirmed: true, comments, syncedAt: new Date() });
    }

    if (route === "comments/drafts" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      const drafts = await commentDrafts.find({ userId: user._id, channelId: connection.channelId })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      return res.status(200).json({
        ok: true,
        confirmed: true,
        drafts: drafts.map((item) => ({
          id: String(item._id),
          parentId: item.parentId,
          text: item.text,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          sentAt: item.sentAt || null
        }))
      });
    }

    if (route === "comments/drafts" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      const parentId = clean(body.parentId, 120);
      const text = clean(body.text, 10000);
      if (!parentId || !text) throw fail("Bình luận hoặc nội dung bản nháp đang trống.", 400, "YOUTUBE_COMMENT_INVALID");
      const now = new Date();
      const result = await commentDrafts.insertOne({
        userId: user._id,
        channelId: connection.channelId,
        parentId,
        text,
        status: "draft",
        createdAt: now,
        updatedAt: now
      });
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "comments:draft",
        targetId: parentId,
        status: "completed"
      });
      return res.status(201).json({ ok: true, confirmed: true, draft: { id: String(result.insertedId), parentId, text, status: "draft", createdAt: now } });
    }

    if (route === "comments/drafts/send" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const draftId = clean(body.draftId, 80);
      if (!ObjectId.isValid(draftId) || body.approved !== true) {
        throw fail("Bản nháp chưa được người dùng duyệt.", 400, "YOUTUBE_COMMENT_APPROVAL_REQUIRED");
      }
      const draft = await commentDrafts.findOne({ _id: new ObjectId(draftId), userId: user._id, channelId: connection.channelId, status: "draft" });
      if (!draft) throw fail("Không tìm thấy bản nháp của kênh hiện tại.", 404, "YOUTUBE_COMMENT_DRAFT_NOT_FOUND");
      const accessToken = await refreshAccessToken(connection, connections);
      const data = await youtubeJson(accessToken, "/youtube/v3/comments", { part: "snippet" }, {
        method: "POST",
        body: JSON.stringify({ snippet: { parentId: draft.parentId, textOriginal: draft.text } })
      });
      const sentAt = new Date();
      await commentDrafts.updateOne(
        { _id: draft._id, userId: user._id, channelId: connection.channelId },
        { $set: { status: "sent", sentAt, updatedAt: sentAt } }
      );
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "comments:reply",
        targetId: draft.parentId,
        status: "completed"
      });
      return res.status(201).json({ ok: true, confirmed: true, comment: normalizedComment(data), sentAt });
    }

    if (route === "comments/reply" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const parentId = clean(body.parentId, 120);
      const textOriginal = clean(body.text, 10000);
      if (!parentId || !textOriginal) throw fail("Bình luận hoặc nội dung trả lời đang trống.", 400, "YOUTUBE_COMMENT_INVALID");
      const data = await youtubeJson(accessToken, "/youtube/v3/comments", { part: "snippet" }, {
        method: "POST",
        body: JSON.stringify({ snippet: { parentId, textOriginal } })
      });
      await db.collection("events").insertOne({ type: "youtube:comment-replied", userId: user._id, commentId: parentId, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "comments:reply", targetId: parentId, status: "completed" });
      return res.status(201).json({ ok: true, confirmed: true, comment: normalizedComment(data), syncedAt: new Date() });
    }

    if (route === "comments/moderate" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const id = clean(body.id, 120);
      const moderationStatus = ["published", "heldForReview", "rejected"].includes(body.moderationStatus)
        ? body.moderationStatus
        : "";
      if (!id || !moderationStatus) throw fail("Trạng thái kiểm duyệt không hợp lệ.", 400, "YOUTUBE_MODERATION_INVALID");
      await youtubeJson(accessToken, "/youtube/v3/comments/setModerationStatus", {
        id,
        moderationStatus,
        banAuthor: body.banAuthor === true ? "true" : "false"
      }, { method: "POST" });
      await db.collection("events").insertOne({ type: "youtube:comment-moderated", userId: user._id, commentId: id, moderationStatus, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "comments:moderate", targetId: id, status: "completed", detail: moderationStatus });
      return res.status(200).json({ ok: true, confirmed: true, id, moderationStatus });
    }

    if (route === "videos/update" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(body.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const current = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet,status,statistics,processingDetails,contentDetails", id: videoId });
      const video = current.items?.[0];
      if (!video) throw fail("Không tìm thấy video trên đúng kênh sở hữu.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
      if (String(video.snippet?.channelId || "") !== String(connection.channelId)) throw fail("Video không thuộc kênh đã chọn.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
      const existingDeclaration = await videoDeclarations.findOne({ userId: user._id, channelId: connection.channelId, videoId });
      const explicitAiDisclosure = body.aiDisclosure !== undefined
        ? aiDisclosureOf(body.aiDisclosure)
        : body.containsSyntheticMedia !== undefined ? (body.containsSyntheticMedia === true ? "yes" : "no") : null;
      const aiDisclosure = explicitAiDisclosure || aiDisclosureOf(existingDeclaration?.aiDisclosure, video.status?.containsSyntheticMedia === true ? "yes" : "unreviewed");
      const snippet = {
        ...video.snippet,
        title: clean(body.title || video.snippet.title, 100),
        description: clean(body.description ?? video.snippet.description, 5000),
        tags: body.tags === undefined ? video.snippet.tags : normalizedTags(body.tags),
        categoryId: /^\d{1,3}$/.test(String(body.categoryId || "")) ? String(body.categoryId) : video.snippet.categoryId,
        defaultLanguage: clean(body.defaultLanguage || video.snippet.defaultLanguage, 24) || undefined
      };
      const requestedPrivacy = ["private", "unlisted", "public", "schedule"].includes(body.privacyStatus) ? body.privacyStatus : "";
      const publishAt = body.publishAt ? new Date(body.publishAt) : null;
      const recordingDate = body.recordingDate === undefined ? null : body.recordingDate ? new Date(body.recordingDate) : "clear";
      if (recordingDate && recordingDate !== "clear" && !Number.isFinite(recordingDate.getTime())) throw fail("Ngày quay video không hợp lệ.", 400, "YOUTUBE_RECORDING_DATE_INVALID");
      if (["public", "schedule"].includes(requestedPrivacy) && body.approved !== true) throw fail("Cần người dùng duyệt trước khi Public hoặc lên lịch.", 409, "YOUTUBE_PUBLISH_APPROVAL_REQUIRED");
      if (["public", "schedule"].includes(requestedPrivacy) && aiDisclosure === "unreviewed") throw fail("Hãy khai báo Có hoặc Không cho nội dung AI trước khi Public hoặc lên lịch.", 409, "YOUTUBE_AI_DISCLOSURE_REQUIRED");
      if (requestedPrivacy === "schedule" && (!publishAt || !Number.isFinite(publishAt.getTime()) || publishAt.getTime() <= Date.now() + 60_000)) throw fail("Lịch đăng phải ở tương lai.", 400, "YOUTUBE_SCHEDULE_INVALID");
      const shouldUpdateStatus = Boolean(requestedPrivacy || explicitAiDisclosure !== null || body.madeForKids !== undefined);
      const nextStatus = shouldUpdateStatus ? {
        privacyStatus: requestedPrivacy === "schedule" ? "private" : requestedPrivacy || video.status?.privacyStatus || "private",
        license: body.license === "creativeCommon" ? "creativeCommon" : body.license === "youtube" ? "youtube" : video.status?.license === "creativeCommon" ? "creativeCommon" : "youtube",
        embeddable: body.embeddable === undefined ? video.status?.embeddable !== false : Boolean(body.embeddable),
        publicStatsViewable: body.publicStatsViewable === undefined ? video.status?.publicStatsViewable !== false : Boolean(body.publicStatsViewable),
        selfDeclaredMadeForKids: body.madeForKids === undefined ? Boolean(video.status?.selfDeclaredMadeForKids) : Boolean(body.madeForKids),
        ...(requestedPrivacy === "schedule" ? { publishAt: publishAt.toISOString() } : {})
      } : null;
      if (nextStatus) nextStatus.containsSyntheticMedia = aiDisclosure === "unreviewed" ? Boolean(video.status?.containsSyntheticMedia) : aiDisclosure === "yes";
      const recordingDetails = recordingDate === null ? null : recordingDate === "clear" ? {} : { recordingDate: recordingDate.toISOString() };
      const parts = ["snippet", ...(nextStatus ? ["status"] : []), ...(recordingDetails ? ["recordingDetails"] : [])].join(",");
      const updated = await youtubeJson(accessToken, "/youtube/v3/videos", { part: parts }, {
        method: "PUT",
        body: JSON.stringify({ id: videoId, snippet, ...(nextStatus ? { status: nextStatus } : {}), ...(recordingDetails ? { recordingDetails } : {}) })
      });
      const playlistId = clean(body.playlistId, 120);
      if (playlistId) await youtubeJson(accessToken, "/youtube/v3/playlistItems", { part: "snippet" }, { method: "POST", body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }) });
      await db.collection("events").insertOne({ type: "youtube:metadata-updated", userId: user._id, videoId, createdAt: new Date() });
      if (explicitAiDisclosure !== null) {
        await videoDeclarations.updateOne(
          { userId: user._id, channelId: connection.channelId, videoId },
          { $set: { userId: user._id, channelId: connection.channelId, videoId, aiDisclosure, declaredBy: String(user._id), declaredAt: new Date(), source: "user" } },
          { upsert: true }
        );
      }
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: explicitAiDisclosure !== null ? "videos:ai-disclosure" : requestedPrivacy === "schedule" ? "videos:schedule" : "videos:update", targetId: videoId, status: "completed", detail: explicitAiDisclosure !== null ? `AI=${aiDisclosure}; ${clean(body.metadataVersion, 80)}` : clean(body.metadataVersion, 80) });
      const normalized = normalizedVideo({ ...video, ...(updated.items?.[0] || {}), snippet, ...(nextStatus ? { status: nextStatus } : {}), ...(recordingDetails ? { recordingDetails } : {}) });
      Object.assign(normalized, { containsSyntheticMedia: aiDisclosure === "yes", aiDisclosure, aiDisclosureSource: aiDisclosure === "unreviewed" ? "unknown" : "user-declared" });
      const uploadSet = { title: snippet.title, metadataVersion: clean(body.metadataVersion, 80), aiDisclosure, aiDeclaredAt: explicitAiDisclosure !== null ? new Date() : undefined, aiDeclaredBy: explicitAiDisclosure !== null ? String(user._id) : undefined, updatedAt: new Date() };
      Object.keys(uploadSet).forEach((key) => uploadSet[key] === undefined && delete uploadSet[key]);
      if (nextStatus) Object.assign(uploadSet, { privacyStatus: nextStatus.privacyStatus, publishAt: nextStatus.publishAt ? new Date(nextStatus.publishAt) : null, status: nextStatus.publishAt ? "scheduled" : nextStatus.privacyStatus || "uploaded" });
      await uploads.updateMany({ userId: user._id, channelId: connection.channelId, videoId }, { $set: uploadSet });
      const auditRows = await audits.find({ userId: user._id, channelId: connection.channelId, targetId: videoId }).sort({ createdAt: -1 }).limit(30).toArray();
      return res.status(200).json({ ok: true, confirmed: true, video: { ...normalized, channelId: String(connection.channelId), channelTitle: connection.channelTitle }, audit: auditRows.map(publicAudit) });
    }

    if (route === "videos/delete" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "manage");
      const videoId = clean(body.videoId, 40);
      const idempotencyKey = clean(body.idempotencyKey, 160);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      if (body.approved !== true) throw fail("Cần xác nhận rõ ràng trước khi xóa video.", 409, "YOUTUBE_DELETE_APPROVAL_REQUIRED");
      if (!/^[a-zA-Z0-9_-]{16,160}$/.test(idempotencyKey)) throw fail("Idempotency key xóa không hợp lệ.", 400, "YOUTUBE_IDEMPOTENCY_INVALID");
      const recentAuth = await requireRecentAuthentication(db, req, user);
      const previousAction = await destructiveActions.findOne({ userId: user._id, idempotencyKey });
      if (previousAction?.status === "completed" && String(previousAction.channelId) === String(connection.channelId) && String(previousAction.videoId) === videoId) {
        return res.status(200).json({ ok: true, confirmed: true, reused: true, deleted: true, recoverable: false, providerStatus: 204, videoId, deletedAt: previousAction.completedAt || null });
      }
      if (previousAction) throw fail("Yêu cầu xóa này đã được sử dụng. Hãy mở lại xác nhận để tạo yêu cầu mới.", 409, "YOUTUBE_DELETE_IDEMPOTENCY_USED");
      const accessToken = await refreshAccessToken(connection, connections);
      const current = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet,status", id: videoId });
      const video = current.items?.[0];
      if (!video) throw fail("Không tìm thấy video trên đúng kênh sở hữu.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
      if (String(video.snippet?.channelId || "") !== String(connection.channelId)) throw fail("Video không thuộc kênh đã chọn.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
      const confirmation = clean(body.confirmation, 160);
      if (confirmation !== "DELETE" && confirmation !== clean(video.snippet?.title, 160)) {
        throw fail("Hãy nhập DELETE hoặc chính xác tiêu đề video để xác nhận.", 400, "YOUTUBE_DELETE_CONFIRMATION_INVALID");
      }
      const startedAt = new Date();
      try {
        await destructiveActions.insertOne({ userId: user._id, channelId: connection.channelId, videoId, idempotencyKey, action: "videos:delete", status: "started", authenticatedAt: recentAuth.authenticatedAt, authMethod: recentAuth.method, startedAt });
      } catch (error) {
        if (Number(error?.code) === 11000) throw fail("Yêu cầu xóa đang được xử lý hoặc đã hoàn thành.", 409, "YOUTUBE_DELETE_IN_PROGRESS");
        throw error;
      }
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:delete", targetId: videoId, status: "started", quotaCost: 0, detail: "Đã xác nhận; chuẩn bị gọi YouTube" }).catch(() => {});
      try {
        await youtubeJson(accessToken, "/youtube/v3/videos", { id: videoId }, { method: "DELETE" });
      } catch (error) {
        const failedAt = new Date();
        await destructiveActions.updateOne({ userId: user._id, idempotencyKey, status: "started" }, { $set: { status: "failed", errorCode: clean(error.code, 80), failedAt } });
        await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:delete", targetId: videoId, status: "failed", quotaCost: quotaCost("videos:delete"), detail: clean(error.message, 300) });
        throw error;
      }
      const deletedAt = new Date();
      const localRecords = await Promise.allSettled([
        destructiveActions.updateOne({ userId: user._id, idempotencyKey, status: "started" }, { $set: { status: "completed", providerStatus: 204, completedAt: deletedAt } }),
        videoTombstones.insertOne({ userId: user._id, channelId: connection.channelId, videoId, title: clean(video.snippet?.title, 160), thumbnail: clean(video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url, 800), privacyStatus: clean(video.status?.privacyStatus, 24), idempotencyKey, providerStatus: 204, recoverable: false, deletedAt }),
        uploads.updateMany({ userId: user._id, channelId: connection.channelId, videoId }, { $set: { status: "deleted", deletedAt, updatedAt: deletedAt }, $unset: { uploadSession: "" } }),
        db.collection("events").insertOne({ type: "youtube:video-deleted", userId: user._id, channelId: connection.channelId, videoId, createdAt: deletedAt }),
        writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:delete", targetId: videoId, status: "completed", quotaCost: quotaCost("videos:delete"), detail: "YouTube HTTP 204; không thể khôi phục" })
      ]);
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, deleted: true, recoverable: false, providerStatus: 204, videoId, deletedAt, tombstoneRecorded: localRecords[1]?.status === "fulfilled" });
    }

    if (route === "content/schedule/bulk" && req.method === "POST") {
      if (body.approved !== true) throw fail("Cần xác nhận trước khi gửi lịch hàng loạt.", 409, "YOUTUBE_PUBLISH_APPROVAL_REQUIRED");
      const submitted = (Array.isArray(body.items) ? body.items : []).slice(0, 20);
      if (!submitted.length) throw fail("Danh sách lịch đang trống.", 400, "YOUTUBE_SCHEDULE_EMPTY");
      const results = await Promise.all(submitted.map(async (item) => {
        const channelId = clean(item?.channelId, 120);
        const videoId = clean(item?.videoId, 40);
        try {
          const connection = await connectionFor(db, user, channelId);
          requireYoutubePermission(connection, "manage");
          if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
          const publishAt = new Date(item.publishAt);
          if (!Number.isFinite(publishAt.getTime()) || publishAt.getTime() <= Date.now() + 60_000) throw fail("Lịch đăng phải ở tương lai.", 400, "YOUTUBE_SCHEDULE_INVALID");
          const accessToken = await refreshAccessToken(connection, connections);
          const current = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet,status", id: videoId });
          const video = current.items?.[0];
          if (!video) throw fail("Không tìm thấy video trên kênh sở hữu.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
          if (String(video.snippet?.channelId || "") !== String(connection.channelId)) throw fail("Video không thuộc kênh đã chọn.", 403, "YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH");
          if (video.status?.privacyStatus !== "private") throw fail("Chỉ video Private và chưa từng xuất bản mới được xếp lịch.", 409, "YOUTUBE_SCHEDULE_PRIVATE_REQUIRED");
          const [declaration, uploadRecord] = await Promise.all([
            videoDeclarations.findOne({ userId: user._id, channelId: connection.channelId, videoId }),
            uploads.findOne({ userId: user._id, channelId: connection.channelId, videoId }, { sort: { updatedAt: -1 }, projection: { aiDisclosure: 1 } })
          ]);
          const aiDisclosure = aiDisclosureOf(declaration?.aiDisclosure || uploadRecord?.aiDisclosure);
          if (aiDisclosure === "unreviewed") throw fail("Video chưa khai báo nội dung AI; chưa thể lên lịch.", 409, "YOUTUBE_AI_DISCLOSURE_REQUIRED");
          const status = { privacyStatus: "private", license: video.status?.license === "creativeCommon" ? "creativeCommon" : "youtube", embeddable: video.status?.embeddable !== false, publicStatsViewable: video.status?.publicStatsViewable !== false, selfDeclaredMadeForKids: Boolean(video.status?.selfDeclaredMadeForKids), containsSyntheticMedia: aiDisclosure === "yes", publishAt: publishAt.toISOString() };
          await youtubeJson(accessToken, "/youtube/v3/videos", { part: "status" }, { method: "PUT", body: JSON.stringify({ id: videoId, status }) });
          await uploads.updateMany({ userId: user._id, channelId: connection.channelId, videoId }, { $set: { status: "scheduled", privacyStatus: "private", publishAt, updatedAt: new Date() } });
          await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:schedule", targetId: videoId, status: "completed", detail: `${publishAt.toISOString()} · ${clean(body.timezone, 80)}` });
          return { ok: true, channelId, videoId, publishAt };
        } catch (error) {
          return { ok: false, channelId, videoId, error: clean(error.message, 180), code: clean(error.code, 80) };
        }
      }));
      return res.status(200).json({ ok: true, confirmed: true, ownerIsolated: true, results, succeeded: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length });
    }

    if (route === "captions" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(req.query.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const data = await youtubeJson(accessToken, "/youtube/v3/captions", { part: "id,snippet", videoId });
      const captions = (data.items || []).map((item) => ({
        id: clean(item.id, 120),
        name: clean(item.snippet?.name, 160),
        language: clean(item.snippet?.language, 24),
        trackKind: clean(item.snippet?.trackKind, 40),
        status: clean(item.snippet?.status, 40),
        isDraft: Boolean(item.snippet?.isDraft),
        lastUpdated: item.snippet?.lastUpdated || null
      }));
      return res.status(200).json({ ok: true, confirmed: true, captions, syncedAt: new Date() });
    }

    if (route === "captions/upload" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(body.videoId, 40);
      const language = clean(body.language || "vi", 24);
      const name = clean(body.name || `HH ${language}`, 160);
      const format = body.format === "vtt" ? "vtt" : "srt";
      const content = String(body.content || "");
      if (!/^[\w-]{6,20}$/.test(videoId) || !content.trim() || Buffer.byteLength(content) > 512 * 1024) {
        throw fail("Caption không hợp lệ hoặc lớn hơn 512 KB.", 400, "YOUTUBE_CAPTION_INVALID");
      }
      const boundary = `hh-caption-${crypto.randomBytes(12).toString("hex")}`;
      const metadata = JSON.stringify({ snippet: { videoId, language, name, isDraft: Boolean(body.isDraft) } });
      const multipart = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Type: ${format === "vtt" ? "text/vtt" : "application/x-subrip"}; charset=UTF-8\r\n\r\n${content}\r\n`),
        Buffer.from(`--${boundary}--\r\n`)
      ]);
      const data = await googleJson(queryUrl("/upload/youtube/v3/captions", { part: "snippet", uploadType: "multipart" }), {
        method: "POST",
        headers: {
          ...youtubeHeaders(accessToken),
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(multipart.length)
        },
        body: multipart
      });
      await db.collection("events").insertOne({ type: "youtube:caption-uploaded", userId: user._id, videoId, language, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "captions:upload", targetId: videoId, status: "completed", detail: language });
      return res.status(201).json({ ok: true, confirmed: true, captionId: clean(data.id, 120), status: clean(data.snippet?.status, 40) });
    }

    if (route === "live" && req.method === "GET") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      return res.status(200).json({ ok: true, confirmed: true, broadcasts: await broadcasts(accessToken), syncedAt: new Date() });
    }

    if (route === "live/create" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const title = clean(body.title, 100);
      const scheduledStartTime = new Date(body.scheduledStartTime);
      if (!title || !Number.isFinite(scheduledStartTime.getTime()) || scheduledStartTime.getTime() < Date.now() + 60_000) {
        throw fail("Tên livestream hoặc thời gian bắt đầu không hợp lệ.", 400, "YOUTUBE_LIVE_INVALID");
      }
      const privacyStatus = ["private", "unlisted", "public"].includes(body.privacyStatus) ? body.privacyStatus : "private";
      let broadcast = null;
      let stream = null;
      try {
        stream = await youtubeJson(accessToken, "/youtube/v3/liveStreams", { part: "snippet,cdn,status" }, {
          method: "POST",
          body: JSON.stringify({
            snippet: { title: `${title} · HH Stream` },
            cdn: { ingestionType: "rtmp", resolution: clean(body.resolution || "1080p", 20), frameRate: clean(body.frameRate || "30fps", 20) },
            contentDetails: { isReusable: false }
          })
        });
        broadcast = await youtubeJson(accessToken, "/youtube/v3/liveBroadcasts", { part: "snippet,status,contentDetails" }, {
          method: "POST",
          body: JSON.stringify({
            snippet: { title, description: clean(body.description, 5000), scheduledStartTime: scheduledStartTime.toISOString() },
            status: { privacyStatus, selfDeclaredMadeForKids: Boolean(body.madeForKids) },
            contentDetails: { enableAutoStart: false, enableAutoStop: false, enableDvr: true, recordFromStart: true }
          })
        });
        await youtubeJson(accessToken, "/youtube/v3/liveBroadcasts/bind", {
          part: "id,contentDetails",
          id: broadcast.id,
          streamId: stream.id
        }, { method: "POST" });
      } catch (error) {
        await Promise.allSettled([
          broadcast?.id
            ? youtubeJson(accessToken, "/youtube/v3/liveBroadcasts", { id: broadcast.id }, { method: "DELETE" })
            : Promise.resolve(),
          stream?.id
            ? youtubeJson(accessToken, "/youtube/v3/liveStreams", { id: stream.id }, { method: "DELETE" })
            : Promise.resolve()
        ]);
        throw error;
      }
      await db.collection("events").insertOne({ type: "youtube:live-created", userId: user._id, broadcastId: broadcast.id, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "live:create", targetId: broadcast.id, status: "completed" });
      return res.status(201).json({
        ok: true,
        confirmed: true,
        broadcast: normalizedBroadcast(broadcast),
        stream: {
          id: clean(stream.id, 120),
          status: clean(stream.status?.streamStatus, 40),
          ingestionAddress: clean(stream.cdn?.ingestionInfo?.ingestionAddress, 800),
          streamName: clean(stream.cdn?.ingestionInfo?.streamName, 800)
        }
      });
    }

    if (route === "live/transition" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "manage");
      const accessToken = await refreshAccessToken(connection, connections);
      const id = clean(body.id, 120);
      const broadcastStatus = ["testing", "live", "complete"].includes(body.broadcastStatus) ? body.broadcastStatus : "";
      if (!id || !broadcastStatus) throw fail("Trạng thái livestream không hợp lệ.", 400, "YOUTUBE_LIVE_TRANSITION_INVALID");
      const data = await youtubeJson(accessToken, "/youtube/v3/liveBroadcasts/transition", {
        part: "id,snippet,status",
        id,
        broadcastStatus
      }, { method: "POST" });
      await db.collection("events").insertOne({ type: `youtube:live-${broadcastStatus}`, userId: user._id, broadcastId: id, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "live:transition", targetId: id, status: "completed", detail: broadcastStatus });
      return res.status(200).json({ ok: true, confirmed: true, broadcast: normalizedBroadcast(data) });
    }

    if (route === "channel/refresh" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      const accessToken = await refreshAccessToken(connection, connections);
      const bundle = await channelBundle(accessToken);
      await connections.updateOne(ownedConnectionFilter(connection), { $set: { ...bundle.channel, playlists: bundle.playlists, updatedAt: new Date() } });
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).toArray();
      return res.status(200).json({ ...publicConnection({ ...connection, ...bundle.channel }, allConnections), playlists: bundle.playlists });
    }

    if (route === "channel/select" && req.method === "POST") {
      const channelId = clean(body.channelId, 120);
      const selected = await connections.findOne({ userId: user._id, channelId });
      if (!selected) throw fail("Kênh YouTube không tồn tại trong tài khoản HH này.", 404, "YOUTUBE_CHANNEL_NOT_FOUND");
      await connections.updateMany({ userId: user._id }, { $set: { active: false } });
      await connections.updateOne(ownedConnectionFilter(selected), { $set: { active: true, updatedAt: new Date() } });
      await writeAudit(db, { userId: user._id, channelId, action: "channel:select", targetId: channelId, status: "completed", quotaCost: 0 });
      const refreshed = await connections.findOne(ownedConnectionFilter(selected));
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).toArray();
      return res.status(200).json({ ...publicConnection(refreshed, allConnections), playlists: refreshed.playlists || [] });
    }

    if (route === "disconnect" && req.method === "POST") {
      const active = await connectionFor(db, user);
      const providerRevoked = await revokeConnectionToken(active);
      await connections.deleteOne(ownedConnectionFilter(active));
      const fallback = await connections.findOne({ userId: user._id }, { sort: { updatedAt: -1 } });
      if (fallback) await connections.updateOne(ownedConnectionFilter(fallback), { $set: { active: true, updatedAt: new Date() } });
      await db.collection("events").insertOne({
        type: "youtube:connection-disconnected",
        userId: user._id,
        channelId: active.channelId,
        providerRevoked,
        createdAt: new Date()
      });
      await writeAudit(db, {
        userId: user._id,
        channelId: active.channelId,
        action: "channel:disconnect",
        targetId: active.channelId,
        status: "completed",
        quotaCost: 0,
        detail: providerRevoked ? "Google token revoked" : "Connection removed"
      });
      return res.status(200).json({ ok: true, providerRevoked });
    }

    if (route === "upload/session" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      requireYoutubePermission(connection, "upload");
      const accessToken = await refreshAccessToken(connection, connections);
      const session = await initiateResumable(accessToken, body);
      const aiDisclosure = aiDisclosureOf(body.aiDisclosure);
      const record = {
        userId: user._id,
        channelId: connection.channelId,
        title: session.resource.snippet.title,
        fileName: clean(body.fileName, 240),
        fileSize: Number(body.fileSize),
        mimeType: clean(body.mimeType, 100),
        privacyStatus: session.resource.status.privacyStatus,
        publishAt: session.resource.status.publishAt || null,
        playlistId: clean(body.playlistId, 120),
        aiDisclosure,
        aiDeclaredAt: aiDisclosure === "unreviewed" ? null : new Date(),
        aiDeclaredBy: aiDisclosure === "unreviewed" ? "" : String(user._id),
        status: "uploading",
        uploadSession: encryptToken(session.uploadUrl, connection),
        bytesUploaded: 0,
        totalBytes: Number(body.fileSize),
        speedBps: 0,
        etaSeconds: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await uploads.insertOne(record);
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "upload:create",
        targetId: String(result.insertedId),
        status: "started",
        detail: record.fileName
      });
      return res.status(201).json({ uploadId: String(result.insertedId), uploadUrl: session.uploadUrl, chunkSize: 8 * 1024 * 1024 });
    }

    if (route === "upload/resume" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id, status: { $in: ["uploading", "error", "paused"] } });
      if (!record?.uploadSession) throw fail("Phiên upload không còn khả dụng. Hãy tạo phiên mới.", 404, "YOUTUBE_UPLOAD_SESSION_EXPIRED");
      const connection = await connectionFor(db, user, record.channelId);
      const uploadUrl = decryptToken(record.uploadSession, connection);
      let bytesUploaded = Number(record.bytesUploaded || 0);
      let completedVideoId = "";
      try {
        const accessToken = await refreshAccessToken(connection, connections);
        const probe = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Length": "0",
            "Content-Range": `bytes */${Number(record.totalBytes || record.fileSize || 0)}`
          },
          signal: AbortSignal.timeout(18000)
        });
        if (probe.status === 308) {
          const match = String(probe.headers.get("range") || "").match(/bytes=0-(\d+)/i);
          if (match) bytesUploaded = Number(match[1]) + 1;
        } else if ([200, 201].includes(probe.status)) {
          const payload = await probe.json().catch(() => ({}));
          completedVideoId = clean(payload.id, 40);
          if (completedVideoId) bytesUploaded = Number(record.totalBytes || record.fileSize || bytesUploaded);
        }
      } catch {}
      await uploads.updateOne(
        { _id: record._id, userId: user._id, channelId: record.channelId },
        { $set: { status: completedVideoId ? "processing" : "uploading", bytesUploaded, ...(completedVideoId ? { videoId: completedVideoId } : {}), error: "", updatedAt: new Date() } }
      );
      if (record.bulkJobId) await bulkJobs.updateOne({ _id: record.bulkJobId, userId: user._id, "results.uploadId": uploadId }, { $set: { "results.$.status": completedVideoId ? "processing" : "uploading", status: completedVideoId ? "processing" : "uploading", updatedAt: new Date() } });
      return res.status(200).json({
        ok: true,
        confirmed: true,
        uploadId,
        uploadUrl,
        chunkSize: 8 * 1024 * 1024,
        bytesUploaded,
        totalBytes: Number(record.totalBytes || record.fileSize || 0),
        complete: Boolean(completedVideoId),
        videoId: completedVideoId
      });
    }

    if (route === "upload/reconcile" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id, status: { $in: ["uploading", "error"] } });
      if (!record) throw fail("Không tìm thấy phiên upload cần đối chiếu.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      if (Number(record.bytesUploaded || 0) < Number(record.totalBytes || record.fileSize || 0)) {
        throw fail("YouTube chưa nhận đủ dữ liệu video.", 409, "YOUTUBE_UPLOAD_INCOMPLETE");
      }

      const connection = await connectionFor(db, user, record.channelId);
      requireYoutubePermission(connection, "upload");
      const accessToken = await refreshAccessToken(connection, connections);
      const candidates = await recentVideos(accessToken);
      const createdAt = new Date(record.createdAt || 0).getTime();
      const expectedTitle = clean(record.title, 160);
      const match = candidates
        .filter((video) => video.title === expectedTitle)
        .filter((video) => !createdAt || new Date(video.publishedAt || 0).getTime() >= createdAt - 10 * 60 * 1000)
        .sort((left, right) => new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))[0];
      if (!match?.id) throw fail("Video đã tải xong nhưng YouTube vẫn đang lập chỉ mục. Hãy thử lại sau ít phút.", 409, "YOUTUBE_VIDEO_PENDING");

      await writeAudit(db, {
        userId: user._id,
        channelId: record.channelId,
        action: "upload:reconcile",
        targetId: match.id,
        status: "completed",
        quotaCost: 4,
        detail: record.title
      });
      return res.status(200).json({ ok: true, confirmed: true, videoId: match.id, url: `https://youtu.be/${match.id}` });
    }

    if (route === "upload/pause" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!record) throw fail("Không tìm thấy phiên upload của tài khoản hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      const connection = await connectionFor(db, user, record.channelId);
      const pausedAt = new Date();
      const result = await uploads.updateOne({ _id: record._id, userId: user._id, channelId: connection.channelId, status: { $in: ["uploading", "error"] } }, { $set: { status: "paused", pausedAt, updatedAt: pausedAt } });
      if (!result.matchedCount && record.status !== "paused") throw fail("Phiên upload không ở trạng thái có thể tạm dừng.", 409, "YOUTUBE_UPLOAD_NOT_PAUSABLE");
      if (record.bulkJobId) await bulkJobs.updateOne({ _id: record.bulkJobId, userId: user._id, "results.uploadId": uploadId }, { $set: { "results.$.status": "paused", status: "paused", updatedAt: pausedAt } });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "upload:pause", targetId: uploadId, status: "completed" });
      return res.status(200).json({ ok: true, confirmed: true, pausedAt });
    }

    if (route === "upload/progress" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const uploadRecord = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!uploadRecord) throw fail("Không tìm thấy phiên upload của tài khoản hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      const connection = await connectionFor(db, user, uploadRecord.channelId);
      const totalBytes = Math.max(0, Number(body.totalBytes || 0));
      const bytesUploaded = Math.max(0, Math.min(totalBytes || Number.MAX_SAFE_INTEGER, Number(body.bytesUploaded || 0)));
      const speedBps = Math.max(0, Number(body.speedBps || 0));
      const etaSeconds = Math.max(0, Number(body.etaSeconds || 0));
      const result = await uploads.updateOne(
        { _id: new ObjectId(uploadId), userId: user._id, channelId: connection.channelId, status: { $in: ["uploading", "processing"] } },
        { $set: { bytesUploaded, totalBytes, speedBps, etaSeconds, updatedAt: new Date() } }
      );
      if (!result.matchedCount) throw fail("Không tìm thấy phiên upload của kênh hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      return res.status(200).json({ ok: true, confirmed: true, bytesUploaded, totalBytes, speedBps, etaSeconds });
    }

    if (route === "upload/cancel" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const uploadRecord = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!uploadRecord) throw fail("Không tìm thấy phiên upload của tài khoản hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      const connection = await connectionFor(db, user, uploadRecord.channelId);
      const cancelledAt = new Date();
      const result = await uploads.updateOne(
        { _id: new ObjectId(uploadId), userId: user._id, channelId: connection.channelId, status: { $in: ["uploading", "processing", "error", "paused"] } },
        { $set: { status: "cancelled", cancelledAt, updatedAt: cancelledAt }, $unset: { uploadSession: "" } }
      );
      if (!result.matchedCount) throw fail("Không tìm thấy phiên upload của kênh hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
      if (uploadRecord.bulkJobId) await bulkJobs.updateOne({ _id: uploadRecord.bulkJobId, userId: user._id, "results.uploadId": uploadId }, { $set: { "results.$.status": "cancelled", status: "partial", updatedAt: cancelledAt } });
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "upload:cancel",
        targetId: uploadId,
        status: "cancelled"
      });
      return res.status(200).json({ ok: true, confirmed: true, cancelledAt });
    }

    if (route === "thumbnail/session" && req.method === "POST") {
      const connection = await connectionFor(db, user, clean(body.channelId, 120));
      requireYoutubePermission(connection, "upload");
      const accessToken = await refreshAccessToken(connection, connections);
      const uploadUrl = await initiateThumbnail(accessToken, clean(body.videoId, 30), body);
      await writeAudit(db, {
        userId: user._id,
        channelId: connection.channelId,
        action: "thumbnail:upload",
        targetId: clean(body.videoId, 30),
        status: "started"
      });
      return res.status(201).json({ uploadUrl });
    }

    if (route === "upload/complete" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      const videoId = clean(body.videoId, 30);
      if (!ObjectId.isValid(uploadId) || !/^[\w-]{6,20}$/.test(videoId)) throw fail("Kết quả upload không hợp lệ.");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!record) throw fail("Không tìm thấy phiên upload.", 404);
      const connection = await connectionFor(db, user, record.channelId);
      requireYoutubePermission(connection, "upload");
      const accessToken = await refreshAccessToken(connection, connections);
      const video = await googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/videos?part=snippet,status,processingDetails&id=${encodeURIComponent(videoId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!video.items?.[0]) throw fail("YouTube chưa trả về video vừa upload.", 409, "YOUTUBE_VIDEO_PENDING");
      const playlistId = clean(body.playlistId || record.playlistId, 120);
      let playlistAdded = false;
      if (playlistId) {
        await googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/playlistItems?part=snippet`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } })
        });
        playlistAdded = true;
      }
      const completedAt = new Date();
      const processingStatus = clean(video.items[0].processingDetails?.processingStatus || "processing", 40);
      await uploads.updateOne(
        { _id: record._id, userId: user._id, channelId: record.channelId },
        { $set: {
          videoId,
          status: processingStatus === "succeeded" ? "uploaded" : processingStatus === "terminated" ? "error" : "processing",
          processingStatus,
          bytesUploaded: Number(record.fileSize || 0),
          totalBytes: Number(record.fileSize || 0),
          speedBps: 0,
          etaSeconds: 0,
          playlistAdded,
          completedAt,
          updatedAt: completedAt
        }, $unset: { uploadSession: "" } }
      );
      if (record.bulkJobId) {
        const bulkRecords = await uploads.find({ userId: user._id, bulkJobId: record.bulkJobId }).toArray();
        const results = bulkRecords.map((item) => ({
          channelId: item.channelId,
          uploadId: String(item._id),
          status: String(item._id) === String(record._id) ? (processingStatus === "terminated" ? "failed" : "uploaded") : item.status,
          videoId: String(item._id) === String(record._id) ? videoId : clean(item.videoId, 30),
          taskKey: clean(item.taskKey, 390),
          videoFingerprint: clean(item.videoFingerprint, 260),
          fileName: clean(item.fileName, 240),
          checksum: clean(item.checksum, 80),
          metadataVersion: clean(item.metadataVersion, 80),
          error: clean(item.error, 180)
        }));
        const pending = results.some((item) => ["uploading", "sessions-ready"].includes(item.status));
        const failed = results.filter((item) => ["error", "failed"].includes(item.status)).length;
        await bulkJobs.updateOne(
          { _id: record.bulkJobId, userId: user._id },
          { $set: { status: pending ? "uploading" : failed === results.length ? "failed" : failed ? "partial" : "uploaded", results, updatedAt: completedAt } }
        );
      }
      await db.collection("events").insertOne({
        type: "music-ai:youtube-upload",
        userId: user._id,
        channelId: record.channelId,
        videoId,
        createdAt: completedAt
      });
      await writeAudit(db, {
        userId: user._id,
        channelId: record.channelId,
        action: "upload:create",
        targetId: videoId,
        status: "completed",
        quotaCost: 0,
        detail: record.title
      });
      return res.status(200).json({ ok: true, videoId, url: `https://youtu.be/${videoId}`, playlistAdded, processingStatus });
    }

    if (route === "upload/error" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (ObjectId.isValid(uploadId)) {
        const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
        if (record) {
          await uploads.updateOne(
            { _id: record._id, userId: user._id, channelId: record.channelId },
            { $set: { status: "error", error: clean(body.error, 400), updatedAt: new Date() } }
          );
          if (record.bulkJobId) {
            const bulkRecords = await uploads.find({ userId: user._id, bulkJobId: record.bulkJobId }).toArray();
            const failedCount = bulkRecords.filter((item) => item.status === "error" || String(item._id) === String(record._id)).length;
            await bulkJobs.updateOne(
              { _id: record.bulkJobId, userId: user._id },
              { $set: { status: failedCount === bulkRecords.length ? "failed" : "partial", updatedAt: new Date() } }
            );
          }
          await writeAudit(db, {
            userId: user._id,
            channelId: record.channelId,
            action: "upload:error",
            targetId: uploadId,
            status: "failed",
            quotaCost: 0,
            detail: clean(body.error, 300)
          });
        }
      }
      return res.status(200).json({ ok: true });
    }

    throw fail("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  });
};
