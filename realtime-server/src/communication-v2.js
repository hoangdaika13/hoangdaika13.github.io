"use strict";

const { randomUUID } = require("crypto");

const DEFAULT_CHANNELS = new Set(["general", "creator", "projects", "support"]);
const MODERATION_ROLES = new Set(["owner", "admin", "moderator"]);
const ALLOWED_PRESENCE = new Set(["online", "away", "busy", "dnd", "offline"]);
const ALLOWED_MESSAGE_TYPES = new Set(["text", "image", "video", "audio", "voice", "file", "link", "location", "poll", "event", "sticker", "gif"]);

const boundedText = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
const channelSlug = (value) => boundedText(value || "general", 80).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "general";
const socketRoom = (channel) => `comm:v2:${channel}`;
const publicIdentity = (user, fallback = {}) => ({
  id: String(user?._id || user?.id || fallback.id || ""),
  name: boundedText(user?.name || fallback.name || "Thành viên HH", 80),
  avatar: boundedText(user?.avatar || fallback.avatar || "", 600),
  role: boundedText(user?.role || fallback.role || "member", 24).toLowerCase()
});

function normalizeMessage(payload = {}, actor = {}) {
  const type = ALLOWED_MESSAGE_TYPES.has(payload.type) ? payload.type : "text";
  const content = boundedText(payload.content, type === "text" ? 8000 : 2000);
  const attachment = payload.attachment && typeof payload.attachment === "object" ? {
    name: boundedText(payload.attachment.name, 180),
    url: boundedText(payload.attachment.url, 1200),
    mime: boundedText(payload.attachment.mime, 120),
    size: Math.max(0, Math.min(250 * 1024 * 1024, Number(payload.attachment.size) || 0))
  } : null;
  if (!content && !attachment && !["location", "poll", "event", "sticker"].includes(type)) throw new Error("Tin nhắn không có nội dung.");
  return {
    id: randomUUID(),
    channel: channelSlug(payload.channel),
    clientId: boundedText(payload.clientId, 100),
    type,
    content,
    attachment,
    replyTo: boundedText(payload.replyTo, 100),
    metadata: payload.metadata && typeof payload.metadata === "object" ? JSON.parse(JSON.stringify(payload.metadata).slice(0, 12000)) : {},
    actor,
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
    reactions: {},
    receipts: { sent: [actor.id], delivered: [], read: [] }
  };
}

function createRateLimiter({ windowMs = 10_000, max = 30 } = {}) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    const bucket = buckets.get(key) || { start: now, count: 0 };
    if (now - bucket.start >= windowMs) { bucket.start = now; bucket.count = 0; }
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket.count <= max;
  };
}

function capabilityDescriptor(options = {}) {
  return {
    protocol: "hh-communication-v2",
    realtime: "Socket.IO/WebSocket",
    persistence: options.hasMongo ? "MongoDB" : "unavailable",
    presence: "in-memory",
    redis: options.hasRedis ? "configured" : "unavailable",
    objectStorage: options.hasObjectStorage ? "configured" : "unavailable",
    calls: "existing call:* WebRTC signaling",
    ice: "configured by /api/realtime/ice",
    transportSecurity: "TLS/WSS is provided by the deployment proxy",
    endToEndEncryption: false
  };
}

function registerCommunicationV2({ app, io, getDb, getCurrentUser, hasMongo = false, hasRedis = false, hasObjectStorage = false } = {}) {
  if (!app || !io) throw new Error("Communication v2 requires Express app and Socket.IO server.");
  const presence = new Map();
  const joinedBySocket = new Map();
  const memoryChannels = new Map([...DEFAULT_CHANNELS].map((slug) => [slug, { slug, name: slug, privacy: "public", ownerId: "system", memberIds: [] }]));
  const allowSignal = createRateLimiter({ windowMs: 10_000, max: 45 });
  const allowWrite = createRateLimiter({ windowMs: 10_000, max: 18 });
  const capabilities = capabilityDescriptor({ hasMongo, hasRedis, hasObjectStorage });

  const collection = async (name) => {
    if (!hasMongo || typeof getDb !== "function") return null;
    return (await getDb()).collection(name);
  };
  const emitPresence = (channel = "") => {
    const users = [...presence.values()].filter((item) => !channel || item.channels.includes(channel));
    const payload = { online: users.filter((item) => item.status !== "offline").length, users, updatedAt: new Date().toISOString() };
    if (channel) io.to(socketRoom(channel)).emit("comm:presence:list", { ...payload, channel });
    else io.emit("comm:presence:list", payload);
  };
  const ack = (callback, payload) => { if (typeof callback === "function") callback(payload); };
  const authenticated = (socket, callback) => {
    if (socket.user) return true;
    ack(callback, { ok: false, error: "Authentication required" });
    return false;
  };
  const rateGuard = (socket, callback, kind, limiter, message) => {
    if (!authenticated(socket, callback)) return false;
    if (limiter(`${socket.id}:${kind}`)) return true;
    ack(callback, { ok: false, error: message || "Too many requests" });
    return false;
  };
  const isModerator = (user) => MODERATION_ROLES.has(String(user?.role || "member").toLowerCase());
  const channelFor = async (slug) => {
    if (hasMongo) {
      const channels = await collection("communicationChannelsV2");
      const stored = await channels.findOne({ slug });
      if (stored) return stored;
    }
    return memoryChannels.get(slug) || null;
  };
  const canAccessChannel = async (slug, user) => {
    const channel = await channelFor(slug);
    if (!channel) return false;
    if (channel.privacy === "public" || isModerator(user)) return true;
    const userId = String(user?._id || user?.id || "");
    return String(channel.ownerId || "") === userId || (channel.memberIds || []).map(String).includes(userId);
  };

  app.get("/api/communication/capabilities", (_req, res) => res.json({ ok: true, capabilities }));
  app.get("/api/communication/messages", async (req, res) => {
    try {
      const user = typeof getCurrentUser === "function" ? await getCurrentUser(req) : null;
      if (!user) return res.status(401).json({ ok: false, error: "Authentication required" });
      if (!hasMongo) return res.status(503).json({ ok: false, error: "Message persistence is not configured.", capabilities });
      const messages = await collection("communicationMessagesV2");
      const channel = channelSlug(req.query.channel);
      if (!(await canAccessChannel(channel, user))) return res.status(403).json({ ok: false, error: "Channel unavailable" });
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
      const before = req.query.before ? new Date(req.query.before) : null;
      const query = { channel, ...(before && !Number.isNaN(before.valueOf()) ? { createdAt: { $lt: before } } : {}) };
      const rows = await messages.find(query).sort({ createdAt: -1 }).limit(limit + 1).toArray();
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit).reverse().map((row) => ({ ...row, _id: String(row._id), createdAt: row.createdAt?.toISOString?.() || row.createdAt }));
      res.json({ ok: true, channel, items, cursor: hasMore ? items[0]?.createdAt || null : null, hasMore });
    } catch (error) { res.status(500).json({ ok: false, error: error.message || "Unable to load messages" }); }
  });

  io.on("connection", (socket) => {
    const actor = publicIdentity(socket.user, { id: `guest:${socket.id}`, name: "Khách HH" });
    const joined = new Set();
    joinedBySocket.set(socket.id, joined);
    if (socket.user) presence.set(actor.id, { ...actor, status: "online", activity: "", lastActiveAt: new Date().toISOString(), channels: [] });

    socket.on("comm:capabilities", (callback) => ack(callback, { ok: true, capabilities }));
    socket.on("comm:presence:update", (payload = {}, callback) => {
      if (!rateGuard(socket, callback, "presence", allowSignal, "Too many presence updates")) return;
      const current = presence.get(actor.id) || { ...actor, channels: [] };
      const status = ALLOWED_PRESENCE.has(payload.status) ? payload.status : "online";
      const next = { ...current, status, activity: boundedText(payload.activity, 80), lastActiveAt: new Date().toISOString(), channels: [...joined] };
      presence.set(actor.id, next);
      emitPresence();
      ack(callback, { ok: true, presence: next });
    });
    socket.on("comm:presence:list", (payload = {}, callback) => {
      const channel = payload.channel ? channelSlug(payload.channel) : "";
      const users = [...presence.values()].filter((item) => !channel || item.channels.includes(channel));
      ack(callback, { ok: true, users, updatedAt: new Date().toISOString() });
    });
    socket.on("comm:channel:create", async (payload = {}, callback) => {
      try {
        if (!rateGuard(socket, callback, "channel-create", allowWrite, "Bạn đang tạo kênh quá nhanh.")) return;
        const slug = channelSlug(payload.slug || payload.name);
        if (!slug || DEFAULT_CHANNELS.has(slug) || await channelFor(slug)) return ack(callback, { ok: false, error: "Tên kênh đã tồn tại." });
        const privacy = ["public", "private", "shared"].includes(payload.privacy) ? payload.privacy : "private";
        const channel = { slug, name: boundedText(payload.name || slug, 100), description: boundedText(payload.description, 600), privacy, ownerId: actor.id, memberIds: [...new Set((Array.isArray(payload.memberIds) ? payload.memberIds : []).map((id) => boundedText(id, 100)).filter(Boolean))], createdAt: new Date() };
        if (hasMongo) await (await collection("communicationChannelsV2")).insertOne(channel);
        else memoryChannels.set(slug, channel);
        ack(callback, { ok: true, channel: { ...channel, createdAt: channel.createdAt.toISOString() }, persisted: hasMongo });
      } catch (error) { ack(callback, { ok: false, error: error.message || "Unable to create channel" }); }
    });
    socket.on("comm:channel:join", async (payload = {}, callback) => {
      if (!authenticated(socket, callback)) return;
      const channel = channelSlug(payload.channel);
      if (!(await canAccessChannel(channel, socket.user))) return ack(callback, { ok: false, error: "Channel unavailable" });
      await socket.join(socketRoom(channel));
      joined.add(channel);
      const current = presence.get(actor.id); if (current) current.channels = [...joined];
      emitPresence(channel);
      ack(callback, { ok: true, channel });
    });
    socket.on("comm:channel:leave", async (payload = {}, callback) => {
      const channel = channelSlug(payload.channel);
      await socket.leave(socketRoom(channel));
      joined.delete(channel);
      const current = presence.get(actor.id); if (current) current.channels = [...joined];
      emitPresence(channel);
      ack(callback, { ok: true, channel });
    });
    socket.on("comm:typing", (payload = {}) => {
      if (!socket.user || !allowSignal(`${socket.id}:typing`)) return;
      const channel = channelSlug(payload.channel);
      if (!joined.has(channel)) return;
      socket.to(socketRoom(channel)).volatile.emit("comm:typing", { channel, actor, active: payload.active !== false, updatedAt: new Date().toISOString() });
    });
    socket.on("comm:message:send", async (payload = {}, callback) => {
      try {
        if (!authenticated(socket, callback)) return;
        if (!allowWrite(`${socket.id}:message`)) return ack(callback, { ok: false, error: "Bạn đang gửi quá nhanh." });
        const message = normalizeMessage(payload, actor);
        if (!joined.has(message.channel) && !DEFAULT_CHANNELS.has(message.channel)) return ack(callback, { ok: false, error: "Hãy tham gia kênh trước khi gửi." });
        const messages = await collection("communicationMessagesV2");
        if (messages) { const result = await messages.insertOne(message); message._id = String(result.insertedId); }
        io.to(socketRoom(message.channel)).emit("comm:message", { ...message, createdAt: message.createdAt.toISOString() });
        ack(callback, { ok: true, message: { ...message, createdAt: message.createdAt.toISOString() }, persisted: Boolean(messages) });
      } catch (error) { ack(callback, { ok: false, error: error.message || "Unable to send message" }); }
    });
    socket.on("comm:message:ack", async (payload = {}, callback) => {
      if (!rateGuard(socket, callback, "receipt", allowSignal, "Too many receipt updates")) return;
      const channel = channelSlug(payload.channel);
      const messageId = boundedText(payload.messageId, 100);
      const state = ["delivered", "read"].includes(payload.state) ? payload.state : "delivered";
      io.to(socketRoom(channel)).emit("comm:message:receipt", { channel, messageId, state, userId: actor.id, updatedAt: new Date().toISOString() });
      ack(callback, { ok: true });
    });
    socket.on("comm:notification", (payload = {}, callback) => {
      if (!rateGuard(socket, callback, "notification", allowSignal, "Too many notifications")) return;
      const notification = { id: randomUUID(), source: boundedText(payload.source, 60), title: boundedText(payload.title, 160), body: boundedText(payload.body, 500), route: boundedText(payload.route, 300), actor, createdAt: new Date().toISOString() };
      const targetId = boundedText(payload.targetUserId, 100);
      if (targetId) io.to(`community:user:${targetId}`).emit("comm:notification", notification);
      else socket.emit("comm:notification", notification);
      ack(callback, { ok: true, notification });
    });
    socket.on("comm:room:sync", (payload = {}, callback) => {
      if (!rateGuard(socket, callback, "sync", allowSignal, "Too many room updates")) return;
      const channel = channelSlug(payload.channel);
      if (!joined.has(channel)) return ack(callback, { ok: false, error: "Room unavailable" });
      const state = payload.state && typeof payload.state === "object" ? JSON.parse(JSON.stringify(payload.state).slice(0, 16000)) : {};
      socket.to(socketRoom(channel)).emit("comm:room:sync", { channel, state, actor, updatedAt: new Date().toISOString() });
      ack(callback, { ok: true });
    });
    socket.on("comm:canvas:op", (payload = {}, callback) => {
      if (!rateGuard(socket, callback, "canvas", allowWrite, "Too many canvas operations")) return;
      const channel = channelSlug(payload.channel);
      if (!joined.has(channel)) return ack(callback, { ok: false, error: "Canvas unavailable" });
      const operation = { id: randomUUID(), type: boundedText(payload.type, 50), targetId: boundedText(payload.targetId, 100), value: payload.value && typeof payload.value === "object" ? JSON.parse(JSON.stringify(payload.value).slice(0, 12000)) : boundedText(payload.value, 2000), actor, createdAt: new Date().toISOString() };
      io.to(socketRoom(channel)).emit("comm:canvas:op", { channel, operation });
      ack(callback, { ok: true, operation });
    });
    socket.on("comm:moderation:report", async (payload = {}, callback) => {
      try {
        if (!rateGuard(socket, callback, "report", allowWrite, "Too many reports")) return;
        const report = { id: randomUUID(), targetType: boundedText(payload.targetType, 40), targetId: boundedText(payload.targetId, 120), reason: boundedText(payload.reason, 120), detail: boundedText(payload.detail, 1600), reporter: actor, status: "pending", createdAt: new Date() };
        if (!report.targetId || !report.reason) return ack(callback, { ok: false, error: "Thiếu đối tượng hoặc lý do báo cáo." });
        const reports = await collection("communicationReports"); if (reports) await reports.insertOne(report);
        io.to("comm:v2:moderators").emit("comm:moderation:report", { ...report, createdAt: report.createdAt.toISOString() });
        ack(callback, { ok: true, report: { ...report, createdAt: report.createdAt.toISOString() }, persisted: Boolean(reports) });
      } catch (error) { ack(callback, { ok: false, error: error.message || "Unable to report" }); }
    });
    socket.on("comm:moderation:audit", async (payload = {}, callback) => {
      try {
        if (!authenticated(socket, callback) || !isModerator(socket.user)) return ack(callback, { ok: false, error: "Moderator permission required" });
        const entry = { id: randomUUID(), action: boundedText(payload.action, 80), targetType: boundedText(payload.targetType, 40), targetId: boundedText(payload.targetId, 120), reason: boundedText(payload.reason, 800), before: payload.before || null, after: payload.after || null, actor, ip: boundedText(socket.handshake.address, 120), userAgent: boundedText(socket.handshake.headers["user-agent"], 500), createdAt: new Date() };
        const audits = await collection("communicationAuditLogs"); if (audits) await audits.insertOne(entry);
        ack(callback, { ok: true, entry: { ...entry, createdAt: entry.createdAt.toISOString() }, persisted: Boolean(audits) });
      } catch (error) { ack(callback, { ok: false, error: error.message || "Unable to write audit log" }); }
    });
    if (isModerator(socket.user)) socket.join("comm:v2:moderators");
    socket.on("disconnect", () => {
      joinedBySocket.delete(socket.id);
      if (socket.user) { presence.delete(actor.id); emitPresence(); }
    });
  });

  return { capabilities, presence, joinedBySocket };
}

module.exports = { registerCommunicationV2, capabilityDescriptor, createRateLimiter, normalizeMessage, channelSlug, publicIdentity };
