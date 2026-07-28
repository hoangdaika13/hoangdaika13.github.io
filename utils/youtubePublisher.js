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
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly"
];
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
  "captions:list": 50,
  "captions:upload": 400,
  "live:list": 1,
  "live:create": 100,
  "live:transition": 50,
  "upload:create": 100,
  "thumbnail:upload": 50
});

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
    "https://nhhoang13all.xyz",
    "https://www.nhhoang13all.xyz",
    "https://hoangdaika13.github.io",
    process.env.FRONTEND_URL || "",
    process.env.PUBLIC_SITE_URL || "",
    ...String(process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim())
  ].filter(Boolean));
}

function safeFrontend(value) {
  const fallback = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://nhhoang13all.xyz";
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

function publicConnection(connection, allConnections = []) {
  const scopes = new Set(String(connection?.scopes || "").split(/\s+/).filter(Boolean));
  return {
    connected: Boolean(connection),
    visibility: "private",
    accountIsolated: true,
    channel: publicChannel(connection),
    channels: allConnections.map(publicChannel),
    connectedAt: connection?.connectedAt || null,
    updatedAt: connection?.updatedAt || null,
    expiresAt: connection?.expiresAt ? new Date(Number(connection.expiresAt)) : null,
    lastApiAt: connection?.lastApiAt || null,
    scopeNames: [...scopes].map((scope) => scope.split("/").pop()).filter(Boolean),
    permissions: {
      read: Boolean(connection),
      upload: scopes.has("https://www.googleapis.com/auth/youtube.upload"),
      manage: scopes.has("https://www.googleapis.com/auth/youtube.force-ssl"),
      analytics: scopes.has("https://www.googleapis.com/auth/yt-analytics.readonly")
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
  return {
    id: clean(item?.id, 40),
    title: clean(item?.snippet?.title, 160),
    description: clean(item?.snippet?.description, 1000),
    publishedAt: item?.snippet?.publishedAt || null,
    scheduledAt: item?.status?.publishAt || null,
    privacyStatus: clean(item?.status?.privacyStatus, 24),
    uploadStatus: clean(item?.status?.uploadStatus, 30),
    processingStatus: clean(item?.processingDetails?.processingStatus, 30),
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
    maxResults: 12
  });
  const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const videos = await youtubeJson(accessToken, "/youtube/v3/videos", {
    part: "snippet,status,statistics,processingDetails",
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
    googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/channels?part=snippet,statistics&mine=true`, { headers }),
    googleJson(`${YOUTUBE_ORIGIN}/youtube/v3/playlists?part=snippet,status&mine=true&maxResults=50`, { headers })
  ]);
  const channel = channels.items?.[0];
  if (!channel) throw fail("Tài khoản Google này chưa có kênh YouTube.", 409, "YOUTUBE_CHANNEL_MISSING");
  return {
    channel: {
      channelId: channel.id,
      channelTitle: clean(channel.snippet?.title, 160),
      channelThumbnail: clean(channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url, 800),
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      videoCount: Number(channel.statistics?.videoCount || 0)
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

function uploadMetadata(body) {
  const title = clean(body.title, 100);
  if (!title) throw fail("Tiêu đề video đang trống.", 400, "YOUTUBE_TITLE_REQUIRED");
  const categoryId = /^\d{1,3}$/.test(String(body.categoryId || "")) ? String(body.categoryId) : "10";
  const privacyStatus = ["private", "unlisted", "public"].includes(body.privacyStatus) ? body.privacyStatus : "private";
  const publishAt = body.publishAt ? new Date(body.publishAt) : null;
  if (publishAt && (!Number.isFinite(publishAt.getTime()) || publishAt.getTime() < Date.now() + 60_000)) {
    throw fail("Lịch phát phải ở tương lai ít nhất một phút.", 400, "YOUTUBE_SCHEDULE_INVALID");
  }
  const status = {
    privacyStatus: publishAt ? "private" : privacyStatus,
    selfDeclaredMadeForKids: Boolean(body.madeForKids),
    containsSyntheticMedia: Boolean(body.containsSyntheticMedia),
    license: body.license === "creativeCommon" ? "creativeCommon" : "youtube",
    embeddable: body.embeddable !== false,
    publicStatsViewable: body.publicStatsViewable !== false
  };
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
    await Promise.all([
      ensureIndex(connections, { userId: 1, channelId: 1 }, { unique: true, sparse: true }),
      ensureIndex(connections, { userId: 1, active: 1, updatedAt: -1 }),
      ensureIndex(uploads, { userId: 1, channelId: 1, createdAt: -1 }),
      ensureIndex(audits, { userId: 1, channelId: 1, createdAt: -1 }),
      ensureIndex(projects, { userId: 1, channelId: 1 }, { unique: true }),
      ensureIndex(commentDrafts, { userId: 1, channelId: 1, createdAt: -1 }),
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
        const bundle = await channelBundle(tokens.access_token);
        const previous = await connections.findOne({ userId: state.userId, channelId: bundle.channel.channelId });
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
          scopes: clean(tokens.scope, 1200),
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
    const routeLimit = route === "upload/session" ? 12 : route === "upload/progress" ? 360 : 80;
    await enforceRateLimit(db, `youtube:${route}:${user._id}`, routeLimit, 15 * 60 * 1000);

    if (route === "oauth/start" && req.method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw fail("Google OAuth chưa được cấu hình trên Vercel.", 503, "GOOGLE_OAUTH_NOT_CONFIGURED");
      const rawState = crypto.randomBytes(36).toString("base64url");
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      await states.insertOne({
        stateHash,
        userId: user._id,
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
        scope: SCOPES.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent select_account",
        state: rawState
      });
      return res.status(200).json({ authorizeUrl: authUrl.toString(), callbackUrl: callbackUrl(req) });
    }

    if (route === "status" && req.method === "GET") {
      const allConnections = await connections.find({ userId: user._id }).sort({ active: -1, updatedAt: -1 }).toArray();
      const connection = allConnections.find((item) => item.active) || allConnections[0] || null;
      const history = connection
        ? await uploads.find({ userId: user._id, channelId: connection.channelId }).sort({ createdAt: -1 }).limit(20).toArray()
        : [];
      return res.status(200).json({
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        callbackUrl: callbackUrl(req),
        ...publicConnection(connection, allConnections),
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
      const [videos, analytics, comments, live, quotas, pendingUploads, auditRows, creatorProject, quotaLedger] = await Promise.all([
        settledResult(() => recentVideos(accessToken), [], warnings, "videos"),
        settledResult(() => channelAnalytics(accessToken), null, warnings, "analytics"),
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
      const accessToken = await refreshAccessToken(connection, connections);
      return res.status(200).json({ ok: true, confirmed: true, videos: await recentVideos(accessToken), syncedAt: new Date() });
    }

    if (route === "analytics" && req.method === "GET") {
      const connection = await connectionFor(db, user);
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
      const accessToken = await refreshAccessToken(connection, connections);
      const comparison = await videoComparisonAnalytics(accessToken, {
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.startDate || "")) ? req.query.startDate : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate || "")) ? req.query.endDate : undefined
      });
      return res.status(200).json({ ok: true, confirmed: true, comparison, syncedAt: new Date() });
    }

    if (route === "comments" && req.method === "GET") {
      const connection = await connectionFor(db, user);
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
      const connection = await connectionFor(db, user);
      const accessToken = await refreshAccessToken(connection, connections);
      const videoId = clean(body.videoId, 40);
      if (!/^[\w-]{6,20}$/.test(videoId)) throw fail("Video ID không hợp lệ.", 400, "YOUTUBE_VIDEO_INVALID");
      const current = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet", id: videoId });
      const video = current.items?.[0];
      if (!video) throw fail("Không tìm thấy video trên kênh đang kết nối.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
      const snippet = {
        ...video.snippet,
        title: clean(body.title || video.snippet.title, 100),
        description: clean(body.description ?? video.snippet.description, 5000),
        tags: body.tags === undefined ? video.snippet.tags : normalizedTags(body.tags),
        categoryId: /^\d{1,3}$/.test(String(body.categoryId || "")) ? String(body.categoryId) : video.snippet.categoryId
      };
      const updated = await youtubeJson(accessToken, "/youtube/v3/videos", { part: "snippet" }, {
        method: "PUT",
        body: JSON.stringify({ id: videoId, snippet })
      });
      await db.collection("events").insertOne({ type: "youtube:metadata-updated", userId: user._id, videoId, createdAt: new Date() });
      await writeAudit(db, { userId: user._id, channelId: connection.channelId, action: "videos:update", targetId: videoId, status: "completed" });
      return res.status(200).json({ ok: true, confirmed: true, video: normalizedVideo(updated.items?.[0] || { id: videoId, snippet }) });
    }

    if (route === "captions" && req.method === "GET") {
      const connection = await connectionFor(db, user);
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
      const accessToken = await refreshAccessToken(connection, connections);
      return res.status(200).json({ ok: true, confirmed: true, broadcasts: await broadcasts(accessToken), syncedAt: new Date() });
    }

    if (route === "live/create" && req.method === "POST") {
      const connection = await connectionFor(db, user);
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
      const accessToken = await refreshAccessToken(connection, connections);
      const session = await initiateResumable(accessToken, body);
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
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id, status: { $in: ["uploading", "error"] } });
      if (!record?.uploadSession) throw fail("Phiên upload không còn khả dụng. Hãy tạo phiên mới.", 404, "YOUTUBE_UPLOAD_SESSION_EXPIRED");
      const connection = await connectionFor(db, user, record.channelId);
      const uploadUrl = decryptToken(record.uploadSession, connection);
      await uploads.updateOne(
        { _id: record._id, userId: user._id, channelId: record.channelId },
        { $set: { status: "uploading", error: "", updatedAt: new Date() } }
      );
      return res.status(200).json({
        ok: true,
        confirmed: true,
        uploadId,
        uploadUrl,
        chunkSize: 8 * 1024 * 1024,
        bytesUploaded: Number(record.bytesUploaded || 0),
        totalBytes: Number(record.totalBytes || record.fileSize || 0)
      });
    }

    if (route === "upload/progress" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
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
      const connection = await connectionFor(db, user);
      const uploadId = clean(body.uploadId, 80);
      if (!ObjectId.isValid(uploadId)) throw fail("Phiên upload không hợp lệ.", 400, "YOUTUBE_UPLOAD_INVALID");
      const cancelledAt = new Date();
      const result = await uploads.updateOne(
        { _id: new ObjectId(uploadId), userId: user._id, channelId: connection.channelId, status: { $in: ["uploading", "processing", "error"] } },
        { $set: { status: "cancelled", cancelledAt, updatedAt: cancelledAt }, $unset: { uploadSession: "" } }
      );
      if (!result.matchedCount) throw fail("Không tìm thấy phiên upload của kênh hiện tại.", 404, "YOUTUBE_UPLOAD_NOT_FOUND");
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
      const connection = await connectionFor(db, user);
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
