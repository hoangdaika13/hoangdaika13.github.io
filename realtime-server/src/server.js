require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { Strategy: FacebookStrategy } = require("passport-facebook");
const { MongoClient, ObjectId } = require("mongodb");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4173";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "hoangdaika13_site";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const allowedOrigins = [...new Set([
  FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()),
  "http://127.0.0.1:4173",
  "http://localhost:4173"
].filter(Boolean))];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(passport.initialize());

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }
});

let client;
async function db() {
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(MONGODB_DB);
}

const users = () => db().then((database) => database.collection("users"));
const sessions = () => db().then((database) => database.collection("sessions"));
const events = () => db().then((database) => database.collection("events"));
const moduleRecords = () => db().then((database) => database.collection("moduleRecords"));
const moduleActions = () => db().then((database) => database.collection("moduleActions"));
const tickets = () => db().then((database) => database.collection("tickets"));
const orders = () => db().then((database) => database.collection("orders"));
const storageFiles = () => db().then((database) => database.collection("storageFiles"));
const notificationSubscriptions = () => db().then((database) => database.collection("notificationSubscriptions"));
const communityMessages = () => db().then((database) => database.collection("communityMessages"));
const communityChatRooms = () => db().then((database) => database.collection("communityChatRooms"));
const DEFAULT_COMMUNITY_CHAT_ROOMS = new Set(["general", "creator", "projects", "support"]);

const seedProducts = [
  { id: "hh-voice-lite", title: "HH Voice Studio Lite", price: 0, currency: "VND", type: "download" },
  { id: "kich-ban-ai-source", title: "Kich ban AI Source", price: 0, currency: "VND", type: "source" },
  { id: "portfolio-membership", title: "Creator Membership", price: 99000, currency: "VND", type: "membership" }
];

function cleanString(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function communityRoomSlug(value) {
  return cleanString(value, 60)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function communityRoomFor(user, slug) {
  if (!user || !slug) return null;
  if (DEFAULT_COMMUNITY_CHAT_ROOMS.has(slug)) return { slug, kind: "channel", visibility: "public", memberIds: [] };
  return (await communityChatRooms()).findOne({
    slug,
    $or: [{ visibility: "public" }, { ownerId: user._id }, { memberIds: user._id }]
  }, { projection: { slug: 1, kind: 1, visibility: 1, ownerId: 1, memberIds: 1 } });
}

function messengerSocketRoom(slug) {
  return `community:chat:${slug}`;
}

function readBearer(req) {
  return (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

async function currentUser(req) {
  return verifyToken(readBearer(req));
}

function ownerFrom(user, fallback = {}) {
  return user
    ? { userId: user._id, user: publicUser(user) }
    : { anonymousId: cleanString(fallback.anonymousId, 160), user: null };
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function signUser(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name || user.displayName || "" },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const collection = await users();
    return collection.findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name || user.displayName || "",
    email: user.email || "",
    provider: user.provider || "local",
    avatar: user.avatar || "",
    consent: Boolean(user.consent)
  };
}

function publicChatUser(user) {
  const profile = publicUser(user);
  return profile ? { id: profile.id, name: profile.name, avatar: profile.avatar } : null;
}

async function upsertOAuthUser(profile, provider) {
  const collection = await users();
  const email = profile.emails?.[0]?.value || "";
  const providerId = profile.id;
  const existing = await collection.findOne({
    $or: [
      { provider, providerId },
      ...(email ? [{ email }] : [])
    ]
  });
  const payload = {
    provider,
    providerId,
    email,
    displayName: profile.displayName || email,
    name: profile.displayName || email,
    avatar: profile.photos?.[0]?.value || "",
    updatedAt: new Date(),
    lastLoginAt: new Date()
  };
  if (existing) {
    await collection.updateOne({ _id: existing._id }, { $set: payload });
    return collection.findOne({ _id: existing._id });
  }
  const result = await collection.insertOne({ ...payload, consent: false, createdAt: new Date() });
  return collection.findOne({ _id: result.insertedId });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      done(null, await upsertOAuthUser(profile, "google"));
    } catch (error) {
      done(error);
    }
  }));
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || "/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "emails", "photos"]
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      done(null, await upsertOAuthUser(profile, "facebook"));
    } catch (error) {
      done(error);
    }
  }));
}

app.get("/health", async (_req, res) => {
  await db();
  res.json({ ok: true, service: "hoangdaika13-realtime" });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, consent } = req.body || {};
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: "Ten, email va mat khau toi thieu 8 ky tu la bat buoc." });
  }
  const collection = await users();
  const normalizedEmail = String(email).trim().toLowerCase();
  const existed = await collection.findOne({ email: normalizedEmail });
  if (existed) return res.status(409).json({ error: "Email da ton tai." });
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await collection.insertOne({
    provider: "local",
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    consent: Boolean(consent),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date()
  });
  const user = await collection.findOne({ _id: result.insertedId });
  res.json({ token: signUser(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const collection = await users();
  const user = await collection.findOne({ email: String(email || "").trim().toLowerCase(), provider: "local" });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Sai email hoac mat khau." });
  }
  await collection.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  res.json({ token: signUser(user), user: publicUser(user) });
});

app.get("/api/auth/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await verifyToken(token);
  res.json({ user: publicUser(user) });
});

app.get("/api/auth/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(501).json({ error: "Google OAuth chua cau hinh." });
  passport.authenticate("google", { scope: ["profile", "email"], state: req.query.returnTo || FRONTEND_URL })(req, res, next);
});

app.get("/api/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: FRONTEND_URL }), (req, res) => {
  const token = signUser(req.user);
  res.redirect(`${FRONTEND_URL}?authToken=${encodeURIComponent(token)}#account`);
});

app.get("/api/auth/facebook", (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID) return res.status(501).json({ error: "Facebook OAuth chua cau hinh." });
  passport.authenticate("facebook", { scope: ["email"], state: req.query.returnTo || FRONTEND_URL })(req, res, next);
});

app.get("/api/auth/facebook/callback", passport.authenticate("facebook", { session: false, failureRedirect: FRONTEND_URL }), (req, res) => {
  const token = signUser(req.user);
  res.redirect(`${FRONTEND_URL}?authToken=${encodeURIComponent(token)}#account`);
});

app.get("/api/platform/summary", async (_req, res) => {
  const [recordCount, actionCount, ticketCount, orderCount, fileCount] = await Promise.all([
    (await moduleRecords()).countDocuments(),
    (await moduleActions()).countDocuments(),
    (await tickets()).countDocuments(),
    (await orders()).countDocuments(),
    (await storageFiles()).countDocuments()
  ]);
  res.json({
    ok: true,
    counts: { records: recordCount, actions: actionCount, tickets: ticketCount, orders: orderCount, files: fileCount },
    products: seedProducts
  });
});

app.get("/api/modules/:moduleId/items", async (req, res) => {
  const moduleId = cleanString(req.params.moduleId, 120);
  const rows = await (await moduleRecords()).find({ moduleId }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ moduleId, items: rows });
});

app.post("/api/modules/:moduleId/items", async (req, res) => {
  const user = await currentUser(req);
  const moduleId = cleanString(req.params.moduleId, 120);
  const payload = {
    moduleId,
    title: cleanString(req.body?.title, 180),
    type: cleanString(req.body?.type || "note", 80),
    data: req.body?.data || {},
    ...ownerFrom(user, req.body),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await (await moduleRecords()).insertOne(payload);
  await (await events()).insertOne({ type: "module:item:create", moduleId, recordId: result.insertedId, createdAt: new Date() });
  res.json({ ok: true, item: { ...payload, _id: result.insertedId } });
});

app.get("/api/modules/:moduleId/actions", async (req, res) => {
  const moduleId = cleanString(req.params.moduleId, 120);
  const rows = await (await moduleActions()).find({ moduleId }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ moduleId, actions: rows });
});

app.post("/api/modules/:moduleId/actions", async (req, res) => {
  const user = await currentUser(req);
  const moduleId = cleanString(req.params.moduleId, 120);
  const input = cleanString(req.body?.input, 8000);
  const actionType = cleanString(req.body?.actionType || "run", 80);
  const output = [
    `Backend action accepted for ${moduleId}.`,
    "",
    `Action: ${actionType}`,
    `Input: ${input || "No input"}`,
    "",
    "Stored in MongoDB. A specialized worker/API can replace this generic output later."
  ].join("\n");
  const payload = {
    moduleId,
    actionType,
    input,
    output,
    meta: req.body?.meta || {},
    ...ownerFrom(user, req.body),
    createdAt: new Date()
  };
  const result = await (await moduleActions()).insertOne(payload);
  await (await events()).insertOne({ type: "module:action", moduleId, actionType, actionId: result.insertedId, createdAt: new Date() });
  res.json({ ok: true, action: { ...payload, _id: result.insertedId } });
});

app.get("/api/store/products", (_req, res) => {
  res.json({ products: seedProducts });
});

app.post("/api/store/orders", async (req, res) => {
  const user = await currentUser(req);
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 20) : [];
  const payload = {
    items,
    customer: {
      name: cleanString(req.body?.customer?.name, 120),
      email: cleanString(req.body?.customer?.email, 160),
      phone: cleanString(req.body?.customer?.phone, 40)
    },
    status: "pending_manual_payment",
    paymentNote: "No real payment has been captured. Connect Stripe/PayPal/MoMo/VNPay before charging users.",
    ...ownerFrom(user, req.body),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await (await orders()).insertOne(payload);
  await (await events()).insertOne({ type: "store:order:create", orderId: result.insertedId, createdAt: new Date() });
  res.json({ ok: true, order: { ...payload, _id: result.insertedId } });
});

app.post("/api/helpdesk/tickets", async (req, res) => {
  const user = await currentUser(req);
  const payload = {
    subject: cleanString(req.body?.subject, 180),
    message: cleanString(req.body?.message, 8000),
    email: cleanString(req.body?.email, 160),
    status: "open",
    priority: cleanString(req.body?.priority || "normal", 40),
    ...ownerFrom(user, req.body),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  if (!payload.subject || !payload.message) return res.status(400).json({ error: "Subject and message are required." });
  const result = await (await tickets()).insertOne(payload);
  await (await events()).insertOne({ type: "helpdesk:ticket:create", ticketId: result.insertedId, createdAt: new Date() });
  res.json({ ok: true, ticket: { ...payload, _id: result.insertedId } });
});

app.get("/api/helpdesk/tickets", async (req, res) => {
  const user = await currentUser(req);
  const query = user ? { userId: user._id } : { anonymousId: cleanString(req.query.anonymousId, 160) };
  const rows = await (await tickets()).find(query).sort({ createdAt: -1 }).limit(50).toArray();
  res.json({ tickets: rows });
});

app.post("/api/storage/files", async (req, res) => {
  const user = await currentUser(req);
  const content = cleanString(req.body?.content, 50000);
  const payload = {
    name: cleanString(req.body?.name || "untitled.txt", 180),
    mimeType: cleanString(req.body?.mimeType || "text/plain", 120),
    size: Number(req.body?.size || content.length || 0),
    content,
    note: "This endpoint stores small text/base64 payloads only. Use S3/R2/GridFS for large production files.",
    ...ownerFrom(user, req.body),
    createdAt: new Date()
  };
  const result = await (await storageFiles()).insertOne(payload);
  await (await events()).insertOne({ type: "storage:file:create", fileId: result.insertedId, createdAt: new Date() });
  res.json({ ok: true, file: { ...payload, _id: result.insertedId } });
});

app.get("/api/storage/files", async (req, res) => {
  const user = await currentUser(req);
  const query = user ? { userId: user._id } : { anonymousId: cleanString(req.query.anonymousId, 160) };
  const rows = await (await storageFiles()).find(query, { projection: { content: 0 } }).sort({ createdAt: -1 }).limit(50).toArray();
  res.json({ files: rows });
});

app.post("/api/notifications/subscribe", async (req, res) => {
  const user = await currentUser(req);
  const payload = {
    channel: cleanString(req.body?.channel || "email", 40),
    target: cleanString(req.body?.target, 240),
    preferences: req.body?.preferences || {},
    active: true,
    note: "Email/push/Discord/Telegram delivery needs provider keys before real sending.",
    ...ownerFrom(user, req.body),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await (await notificationSubscriptions()).insertOne(payload);
  res.json({ ok: true, subscription: { ...payload, _id: result.insertedId } });
});

app.get("/api/admin/events", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const collection = await events();
  const rows = await collection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  res.json({ events: rows });
});

app.get("/api/admin/overview", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const database = await db();
  const names = ["users", "sessions", "events", "moduleRecords", "moduleActions", "tickets", "orders", "storageFiles", "notificationSubscriptions"];
  const counts = {};
  await Promise.all(names.map(async (name) => {
    counts[name] = await database.collection(name).countDocuments();
  }));
  res.json({ counts, generatedAt: new Date() });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.user = await verifyToken(token);
  next();
});

io.on("connection", async (socket) => {
  const auth = socket.handshake.auth || {};
  const consent = Boolean(auth.consent || socket.user?.consent);
  let activeMessengerRoom = "";
  if (socket.user) {
    socket.join(`community:user:${String(socket.user._id)}`);
    socket.join("community:all");
  }
  const emitMessengerPresence = async (slug) => {
    if (!slug) return;
    const roomName = messengerSocketRoom(slug);
    const members = await io.in(roomName).fetchSockets();
    const onlineUsers = [...new Map(members.filter((item) => item.user).map((item) => [String(item.user._id), publicChatUser(item.user)])).values()];
    io.to(roomName).emit("messenger:presence", { room: slug, online: members.length, users: onlineUsers, updatedAt: new Date().toISOString() });
  };
  const session = {
    socketId: socket.id,
    anonymousId: auth.anonymousId || "",
    userId: socket.user?._id || null,
    user: socket.user ? publicUser(socket.user) : null,
    page: auth.page || "",
    referrer: auth.referrer || "",
    consent,
    userAgent: socket.handshake.headers["user-agent"] || "",
    startedAt: new Date(),
    lastSeenAt: new Date(),
    endedAt: null
  };
  if (consent || socket.user) {
    await (await sessions()).insertOne(session);
    await (await events()).insertOne({ type: "visit:start", session, createdAt: new Date() });
  }
  io.emit("site:stats", { online: io.engine.clientsCount });

  socket.on("messenger:room:join", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      if (!socket.user) return done({ ok: false, error: "Authentication required" });
      const slug = communityRoomSlug(payload.room || "general") || "general";
      const room = await communityRoomFor(socket.user, slug);
      if (!room) return done({ ok: false, error: "Room unavailable" });
      if (activeMessengerRoom && activeMessengerRoom !== slug) {
        const previous = activeMessengerRoom;
        await socket.leave(messengerSocketRoom(previous));
        emitMessengerPresence(previous).catch(() => {});
      }
      activeMessengerRoom = slug;
      await socket.join(messengerSocketRoom(slug));
      await emitMessengerPresence(slug);
      done({ ok: true, room: slug });
    } catch (error) {
      done({ ok: false, error: error.message || "Realtime room failed" });
    }
  });

  socket.on("messenger:room:leave", async (payload = {}) => {
    const slug = communityRoomSlug(payload.room || activeMessengerRoom);
    if (!slug) return;
    await socket.leave(messengerSocketRoom(slug));
    if (activeMessengerRoom === slug) activeMessengerRoom = "";
    emitMessengerPresence(slug).catch(() => {});
  });

  socket.on("messenger:typing", (payload = {}) => {
    if (!socket.user) return;
    const slug = communityRoomSlug(payload.room);
    if (!slug || slug !== activeMessengerRoom || !socket.rooms.has(messengerSocketRoom(slug))) return;
    socket.to(messengerSocketRoom(slug)).emit("messenger:typing", {
      room: slug,
      active: Boolean(payload.active),
      user: publicChatUser(socket.user),
      updatedAt: new Date().toISOString()
    });
  });

  socket.on("messenger:changed", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      if (!socket.user) return done({ ok: false, error: "Authentication required" });
      const now = Date.now();
      if (now - Number(socket.data.lastMessengerSignal || 0) < 150) return done({ ok: false, error: "Too many signals" });
      socket.data.lastMessengerSignal = now;
      const slug = communityRoomSlug(payload.room);
      const room = await communityRoomFor(socket.user, slug);
      if (!room) return done({ ok: false, error: "Room unavailable" });
      const messageId = cleanString(payload.messageId, 80);
      const message = messageId && ObjectId.isValid(messageId)
        ? await (await communityMessages()).findOne({ _id: new ObjectId(messageId), room: slug }, { projection: { _id: 1, room: 1, userId: 1, updatedAt: 1 } })
        : null;
      const type = cleanString(payload.type || "update", 30);
      if (!message && type !== "room:update") return done({ ok: false, error: "Message unavailable" });
      let recipients = io.to(messengerSocketRoom(slug));
      if (DEFAULT_COMMUNITY_CHAT_ROOMS.has(slug)) {
        recipients = recipients.to("community:all");
      } else {
        const ids = [...new Set([room.ownerId, ...(room.memberIds || [])].filter(Boolean).map(String))];
        ids.forEach((id) => { recipients = recipients.to(`community:user:${id}`); });
      }
      recipients.emit("messenger:changed", {
        room: slug,
        messageId: message ? String(message._id) : "",
        type,
        actor: publicChatUser(socket.user),
        updatedAt: new Date().toISOString()
      });
      done({ ok: true });
    } catch (error) {
      done({ ok: false, error: error.message || "Realtime signal failed" });
    }
  });

  socket.on("page:event", async (payload = {}) => {
    if (!consent && !socket.user) return;
    await (await events()).insertOne({
      type: payload.type || "page:event",
      userId: socket.user?._id || null,
      anonymousId: auth.anonymousId || "",
      path: payload.path || "",
      detail: payload.detail || {},
      createdAt: new Date()
    });
  });

  socket.on("disconnect", async () => {
    if (activeMessengerRoom) emitMessengerPresence(activeMessengerRoom).catch(() => {});
    if (consent || socket.user) {
      await (await sessions()).updateOne({ socketId: socket.id }, { $set: { endedAt: new Date(), lastSeenAt: new Date() } });
      await (await events()).insertOne({ type: "visit:end", socketId: socket.id, createdAt: new Date() });
    }
    io.emit("site:stats", { online: Math.max(0, io.engine.clientsCount) });
  });
});

server.listen(PORT, () => {
  console.log(`Realtime server listening on ${PORT}`);
});
