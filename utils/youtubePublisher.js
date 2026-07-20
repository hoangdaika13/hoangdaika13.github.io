const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");

const YOUTUBE_ORIGIN = "https://www.googleapis.com";
const OAUTH_ORIGIN = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl"
];
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "application/octet-stream"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/png"]);

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

function encryptionKey() {
  const secret = String(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  if (secret.length < 32) throw fail("Máy chủ chưa cấu hình khóa mã hóa YouTube.", 503, "YOUTUBE_ENCRYPTION_MISSING");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value) {
  if (!value) return "";
  try {
    const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw fail("Phiên YouTube đã hỏng hoặc hết hiệu lực. Hãy kết nối lại kênh.", 401, "YOUTUBE_TOKEN_INVALID");
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

async function refreshAccessToken(connection, connections) {
  const now = Date.now();
  if (connection.accessToken && Number(connection.expiresAt || 0) > now + 90_000) return decrypt(connection.accessToken);
  const refreshToken = decrypt(connection.refreshToken);
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
  const update = { accessToken: encrypt(data.access_token), expiresAt: now + Number(data.expires_in || 3600) * 1000, updatedAt: new Date() };
  await connections.updateOne({ _id: connection._id }, { $set: update });
  Object.assign(connection, update);
  return data.access_token;
}

async function connectionFor(db, user) {
  const connection = await db.collection("youtubeConnections").findOne({ userId: user._id });
  if (!connection) throw fail("Bạn chưa kết nối kênh YouTube.", 409, "YOUTUBE_NOT_CONNECTED");
  return connection;
}

function publicConnection(connection) {
  return {
    connected: Boolean(connection),
    channel: connection ? {
      id: connection.channelId || "",
      title: connection.channelTitle || "Kênh YouTube",
      thumbnail: connection.channelThumbnail || "",
      subscribers: Number(connection.subscribers || 0),
      videos: Number(connection.videoCount || 0)
    } : null,
    connectedAt: connection?.connectedAt || null,
    updatedAt: connection?.updatedAt || null
  };
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

    if (route === "oauth/callback" && req.method === "GET") {
      const rawState = clean(req.query.state, 180);
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const state = await states.findOne({ stateHash, expiresAt: { $gt: new Date() } });
      const frontend = safeFrontend(state?.returnTo);
      if (!state || !req.query.code) return res.redirect(`${frontend}/?youtubeError=${encodeURIComponent("Phiên kết nối YouTube đã hết hạn.")}#/music-ai/youtube-publisher`);
      await states.deleteOne({ _id: state._id });
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
        if (!tokenResponse.ok || !tokens.access_token) throw fail(tokens.error_description || "Google từ chối kết nối YouTube.", 401);
        const previous = await connections.findOne({ userId: state.userId });
        const refreshToken = tokens.refresh_token || (previous?.refreshToken ? decrypt(previous.refreshToken) : "");
        if (!refreshToken) throw fail("Google chưa cấp quyền truy cập ngoại tuyến. Hãy kết nối lại và chấp thuận quyền.", 401);
        const bundle = await channelBundle(tokens.access_token);
        const now = new Date();
        await connections.updateOne({ userId: state.userId }, { $set: {
          userId: state.userId,
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(refreshToken),
          expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
          scopes: clean(tokens.scope, 1200),
          ...bundle.channel,
          playlists: bundle.playlists,
          connectedAt: previous?.connectedAt || now,
          updatedAt: now
        } }, { upsert: true });
        return res.redirect(`${frontend}/?youtubeConnected=1#/music-ai/youtube-publisher`);
      } catch (error) {
        return res.redirect(`${frontend}/?youtubeError=${encodeURIComponent(clean(error.message, 180))}#/music-ai/youtube-publisher`);
      }
    }

    const user = await currentUser(req);
    if (!user) throw fail("Đăng nhập HH Platform để dùng YouTube Publisher.", 401, "AUTH_REQUIRED");
    await enforceRateLimit(db, `youtube:${route}:${user._id}`, route === "upload/session" ? 12 : 40, 15 * 60 * 1000);

    if (route === "oauth/start" && req.method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw fail("Google OAuth chưa được cấu hình trên Vercel.", 503, "GOOGLE_OAUTH_NOT_CONFIGURED");
      await states.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      const rawState = crypto.randomBytes(36).toString("base64url");
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      await states.insertOne({ stateHash, userId: user._id, returnTo: safeFrontend(body.returnTo), createdAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
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
      const connection = await connections.findOne({ userId: user._id });
      const history = await uploads.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).toArray();
      return res.status(200).json({
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        callbackUrl: callbackUrl(req),
        ...publicConnection(connection),
        playlists: connection?.playlists || [],
        history: history.map((item) => ({ id: String(item._id), videoId: item.videoId || "", title: item.title, fileName: item.fileName, status: item.status, privacyStatus: item.privacyStatus, publishAt: item.publishAt || null, createdAt: item.createdAt, completedAt: item.completedAt || null, error: item.error || "" }))
      });
    }

    if (route === "channel/refresh" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      const accessToken = await refreshAccessToken(connection, connections);
      const bundle = await channelBundle(accessToken);
      await connections.updateOne({ _id: connection._id }, { $set: { ...bundle.channel, playlists: bundle.playlists, updatedAt: new Date() } });
      return res.status(200).json({ ...publicConnection({ ...connection, ...bundle.channel }), playlists: bundle.playlists });
    }

    if (route === "disconnect" && req.method === "POST") {
      await connections.deleteOne({ userId: user._id });
      return res.status(200).json({ ok: true });
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
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await uploads.insertOne(record);
      return res.status(201).json({ uploadId: String(result.insertedId), uploadUrl: session.uploadUrl, chunkSize: 8 * 1024 * 1024 });
    }

    if (route === "thumbnail/session" && req.method === "POST") {
      const connection = await connectionFor(db, user);
      const accessToken = await refreshAccessToken(connection, connections);
      const uploadUrl = await initiateThumbnail(accessToken, clean(body.videoId, 30), body);
      return res.status(201).json({ uploadUrl });
    }

    if (route === "upload/complete" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      const videoId = clean(body.videoId, 30);
      if (!ObjectId.isValid(uploadId) || !/^[\w-]{6,20}$/.test(videoId)) throw fail("Kết quả upload không hợp lệ.");
      const record = await uploads.findOne({ _id: new ObjectId(uploadId), userId: user._id });
      if (!record) throw fail("Không tìm thấy phiên upload.", 404);
      const connection = await connectionFor(db, user);
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
      await uploads.updateOne({ _id: record._id }, { $set: { videoId, status: "uploaded", playlistAdded, completedAt, updatedAt: completedAt } });
      await db.collection("events").insertOne({ type: "music-ai:youtube-upload", userId: user._id, videoId, createdAt: completedAt });
      return res.status(200).json({ ok: true, videoId, url: `https://youtu.be/${videoId}`, playlistAdded, processingStatus: video.items[0].processingDetails?.processingStatus || "processing" });
    }

    if (route === "upload/error" && req.method === "POST") {
      const uploadId = clean(body.uploadId, 80);
      if (ObjectId.isValid(uploadId)) await uploads.updateOne({ _id: new ObjectId(uploadId), userId: user._id }, { $set: { status: "error", error: clean(body.error, 400), updatedAt: new Date() } });
      return res.status(200).json({ ok: true });
    }

    throw fail("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  });
};
