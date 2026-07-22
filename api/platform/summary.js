const { clean, currentUser, enforceRateLimit, isAdminUser, withApi } = require("../../utils/platform");

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const TELEMETRY_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const TELEMETRY_TYPES = new Set(["page_view", "route_change", "feature_open", "action", "error", "performance", "heartbeat", "session_start", "session_end", "diagnostic", "export", "refresh", "form_start", "form_submit", "form_validation", "control_change"]);

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
    valid: value.valid !== false
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

function readinessSnapshot({ databaseConnected = false } = {}) {
  const has = (...names) => names.every((name) => Boolean(String(process.env[name] || "").trim()));
  const gemini = Boolean(String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());
  const googleSearch = has("GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID");
  const youtube = Boolean(String(process.env.YOUTUBE_API_KEY || "").trim());
  const payos = has("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY");
  const email = has("RESEND_API_KEY", "EMAIL_FROM");
  const eleven = Boolean(String(process.env.ELEVENLABS_API_KEY || "").trim());
  const downloader = Boolean(String(process.env.VIDEO_DOWNLOADER_API_URL || "").trim());
  const objectStorage = has("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY");
  const missing = [];
  if (!email) missing.push({ id: "email-verification", label: "Xác minh email", connect: "Resend API + EMAIL_FROM đã xác minh" });
  if (!googleSearch) missing.push({ id: "google-search", label: "Google JSON Search", connect: "Google Custom Search JSON API + Engine ID" });
  if (!eleven) missing.push({ id: "elevenlabs", label: "Music/Sound AI", connect: "ELEVENLABS_API_KEY" });
  if (!downloader) missing.push({ id: "download-engine", label: "Download Center", connect: "VIDEO_DOWNLOADER_API_URL và khóa engine" });
  if (!objectStorage) missing.push({ id: "object-storage", label: "Cloud Storage file lớn", connect: "S3/R2 bucket và credentials server-side" });
  missing.push({ id: "realtime-server", label: "Realtime/Socket.io", connect: "Render cần MONGODB_URI và JWT_SECRET giống Vercel" });
  return {
    checkedAt: new Date(),
    database: { configured: Boolean(process.env.MONGODB_URI), connected: databaseConnected, database: process.env.MONGODB_DB || "hoangdaika13_site" },
    auth: {
      googleOAuth: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
      passkey: true,
      emailVerification: email,
      captcha: has("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY")
    },
    search: {
      googleConfigured: googleSearch,
      youtubeConfigured: youtube,
      provider: process.env.VERTEX_SEARCH_PROJECT_ID && process.env.VERTEX_SEARCH_APP_ID ? "vertex-ai-search" : googleSearch ? "programmable-search" : "none",
      note: googleSearch ? "Đã có khóa; cần live query để xác minh API đã được bật trong Google Cloud." : "Chưa có đủ cấu hình."
    },
    ai: { gemini: gemini, geminiKeySource: process.env.GEMINI_API_KEYS ? "gemini-pool" : process.env.GEMINI_API_KEY ? "gemini" : process.env.GOOGLE_AI_API_KEY ? "google-ai" : "none", elevenLabs: eleven },
    payments: { payos, donationReceiptEmail: email },
    storage: { metadata: true, smallTextPayload: true, objectStorage },
    download: { engine: downloader },
    realtime: { configuredInVercel: false, note: "Socket.io chạy ở Render, không nằm trong Vercel Function." },
    requiresConnection: missing
  };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
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
      const page = safeRoute(body.page || events[0]?.route || "/");
      const latest = events.at(-1) || null;
      const module = safeKey(body.module || latest?.module || page.split("/").filter(Boolean).at(-1) || "home", "home");
      const activityState = ["active", "idle", "background"].includes(body.activityState) ? body.activityState : "active";
      const device = ["desktop", "tablet", "mobile"].includes(body.device) ? body.device : "unknown";
      const browser = safeKey(body.browser, "browser").slice(0, 40);
      const viewport = safeKey(body.viewport, "unknown").slice(0, 40);
      const presenceState = { identity, kind: user ? "registered" : "guest", userId: user?._id || null, sessionId, lastSeenAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), page, module, activityState, activeSeconds: Math.max(0, Math.min(86400, Number(body.activeSeconds || 0))), device, browser, viewport, analyticsConsent };
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
      return res.status(200).json({ ok: true, acceptedEvents: events.length, online, activeWindowSeconds: ACTIVE_WINDOW_MS / 1000, checkedAt: now, policy: { restrictedFeatures: user && Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures.map((item) => clean(item, 100)).filter(Boolean).slice(0, 100) : [], disabledFeatures }, privacy: { interactionMetadataStored: true, rawKeystrokesStored: false, formValuesStored: false, promptBodiesStored: false, passwordsStored: false, tokensStored: false, privateMessagesStored: false, retentionDays: 30 } });
    }
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (req.query.view === "health") return res.status(200).json({ ok: true, health: readinessSnapshot({ databaseConnected: Boolean(db) }) });
    const user = await currentUser(req);
    if (!isAdminUser(user)) return res.status(403).json({ error: "Tài khoản không có quyền truy cập Admin Panel." });
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
