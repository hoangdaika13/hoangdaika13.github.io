require("dotenv").config();

const http = require("http");
const { randomUUID } = require("crypto");
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
const MAX_CALL_PARTICIPANTS = Math.max(2, Math.min(12, Number(process.env.MAX_CALL_PARTICIPANTS || 8)));
const STUN_URLS = (process.env.STUN_URLS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302").split(",").map((item) => item.trim()).filter(Boolean);
const ICE_SERVERS = [
  ...(STUN_URLS.length ? [{ urls: STUN_URLS }] : []),
  ...(process.env.TURN_URL ? [{
    urls: process.env.TURN_URL.split(",").map((item) => item.trim()).filter(Boolean),
    username: process.env.TURN_USERNAME || "",
    credential: process.env.TURN_CREDENTIAL || ""
  }] : [])
];
const activeCalls = new Map();
const activeAstraRooms = new Map();
const MAX_ASTRA_PLAYERS = Math.max(2, Math.min(12, Number(process.env.MAX_ASTRA_PLAYERS || 10)));
const ASTRA_WORLD = { width: 12000, height: 8000 };
const ASTRA_SHIPS = new Set(["asteria", "nomad", "aurora", "titan", "lumen", "odyssey"]);

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

function callSocketRoom(callId) {
  return `community:call:${callId}`;
}

function astraRoomCode(value) {
  return cleanString(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function astraSocketRoom(code) {
  return `astra:expedition:${code}`;
}

function createAstraCode() {
  let code = "";
  do code = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  while (activeAstraRooms.has(code));
  return code;
}

function publicAstraRoom(room) {
  return {
    code: room.code,
    name: room.name,
    seed: room.seed,
    sector: room.sector,
    visibility: room.visibility,
    hostId: room.hostId,
    players: [...room.players.values()].map((player) => ({
      socketId: player.socketId,
      user: player.user,
      ship: player.ship,
      state: player.state,
      joinedAt: player.joinedAt
    })),
    maxPlayers: MAX_ASTRA_PLAYERS,
    createdAt: room.createdAt
  };
}

function sanitizeAstraState(payload = {}, previous = {}) {
  const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  return {
    x: finite(payload.x, previous.x || 0, -ASTRA_WORLD.width / 2, ASTRA_WORLD.width / 2),
    y: finite(payload.y, previous.y || 0, -ASTRA_WORLD.height / 2, ASTRA_WORLD.height / 2),
    vx: finite(payload.vx, 0, -900, 900),
    vy: finite(payload.vy, 0, -900, 900),
    angle: finite(payload.angle, previous.angle || 0, -Math.PI * 8, Math.PI * 8),
    shield: finite(payload.shield, previous.shield ?? 100, 0, 300),
    hull: finite(payload.hull, previous.hull ?? 100, 0, 100),
    thrusting: Boolean(payload.thrusting),
    boosting: Boolean(payload.boosting),
    updatedAt: Date.now()
  };
}

function publicCall(call) {
  return {
    id: call.id,
    room: call.room,
    type: call.type,
    group: call.group,
    startedBy: call.startedBy,
    startedAt: call.startedAt,
    participants: [...call.participants.values()].map((item) => ({ socketId: item.socketId, user: item.user, media: item.media }))
  };
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
    { sub: String(user._id), email: user.email, name: user.name || user.displayName || "", ver: Number(user.tokenVersion || 0) },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "12h", issuer: "hh-platform", audience: "hh-web" }
  );
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"], issuer: "hh-platform", audience: "hh-web" });
    const collection = await users();
    const user = await collection.findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
    const disabled = ["deleted", "suspended", "locked", "banned"].includes(String(user?.status || "").toLowerCase());
    return user && !disabled && Number(payload.ver || 0) === Number(user.tokenVersion || 0) ? user : null;
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

app.get("/live", (_req, res) => {
  res.json({ ok: true, service: "hoangdaika13-realtime", transport: "socket.io" });
});

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

app.get("/api/realtime/ice", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  res.json({
    ok: true,
    iceServers: ICE_SERVERS,
    maxParticipants: MAX_CALL_PARTICIPANTS,
    endToEndEncryption: false,
    transportSecurity: "TLS when deployed behind HTTPS/WSS"
  });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.user = await verifyToken(token);
  next();
});

io.on("connection", async (socket) => {
  const auth = socket.handshake.auth || {};
  const consent = Boolean(auth.consent || socket.user?.consent);
  const guestId = cleanString(auth.anonymousId, 80).replace(/[^a-zA-Z0-9_-]/g, "") || socket.id;
  const astraIdentity = () => socket.user
    ? publicChatUser(socket.user)
    : { id: `guest:${guestId}`, name: cleanString(auth.astraName, 40) || `Phi công ${guestId.slice(-4).toUpperCase()}`, avatar: "", guest: true };
  let activeMessengerRoom = "";
  let activeAstraRoom = "";
  const activeCallIds = new Set();
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
  const emitAstraRoom = (code) => {
    const room = activeAstraRooms.get(code);
    if (room) io.to(astraSocketRoom(code)).emit("astra:room", publicAstraRoom(room));
  };
  const leaveAstraRoom = async (reason = "left") => {
    const code = activeAstraRoom;
    if (!code) return;
    const room = activeAstraRooms.get(code);
    activeAstraRoom = "";
    await socket.leave(astraSocketRoom(code));
    if (!room) return;
    room.players.delete(socket.id);
    socket.to(astraSocketRoom(code)).emit("astra:player:left", { socketId: socket.id, userId: String(socket.user?._id || ""), reason, updatedAt: Date.now() });
    if (!room.players.size) {
      activeAstraRooms.delete(code);
      return;
    }
    if (![...room.players.values()].some((player) => String(player.user.id) === room.hostId)) {
      room.hostId = String(room.players.values().next().value.user.id);
    }
    emitAstraRoom(code);
  };
  const leaveCall = async (callId, reason = "left") => {
    const call = activeCalls.get(callId);
    if (!call || !call.participants.has(socket.id)) return;
    call.participants.delete(socket.id);
    activeCallIds.delete(callId);
    await socket.leave(callSocketRoom(callId));
    io.to(callSocketRoom(callId)).emit("call:participant:left", { callId, socketId: socket.id, userId: String(socket.user?._id || ""), reason, updatedAt: new Date().toISOString() });
    if (!call.participants.size) {
      activeCalls.delete(callId);
      return;
    }
    if (call.startedById === String(socket.user?._id || "")) {
      const nextHost = call.participants.values().next().value;
      call.startedById = String(nextHost.user.id);
      call.startedBy = nextHost.user;
      io.to(callSocketRoom(callId)).emit("call:host", { callId, startedBy: call.startedBy });
    }
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

  const joinAstraRoom = async (room, payload, done) => {
    if (!room) return done({ ok: false, error: "Expedition unavailable" });
    if (room.players.size >= MAX_ASTRA_PLAYERS && !room.players.has(socket.id)) return done({ ok: false, error: "Expedition is full" });
    if (activeAstraRoom && activeAstraRoom !== room.code) await leaveAstraRoom("switched");
    const ship = ASTRA_SHIPS.has(payload.ship) ? payload.ship : "asteria";
    const slot = room.players.size;
    const initialState = sanitizeAstraState(payload.state);
    if (slot > 0 && Math.hypot(initialState.x, initialState.y) < 80) {
      initialState.x = Math.cos(slot / MAX_ASTRA_PLAYERS * Math.PI * 2) * (42 + slot * 4);
      initialState.y = Math.sin(slot / MAX_ASTRA_PLAYERS * Math.PI * 2) * (42 + slot * 4);
    }
    const player = {
      socketId: socket.id,
      user: astraIdentity(),
      ship,
      state: initialState,
      joinedAt: new Date().toISOString()
    };
    room.players.set(socket.id, player);
    activeAstraRoom = room.code;
    await socket.join(astraSocketRoom(room.code));
    socket.to(astraSocketRoom(room.code)).emit("astra:player:joined", player);
    emitAstraRoom(room.code);
    done({ ok: true, room: publicAstraRoom(room), selfSocketId: socket.id });
  };

  socket.on("astra:room:create", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      if (activeAstraRoom) await leaveAstraRoom("recreated");
      const code = createAstraCode();
      const identity = astraIdentity();
      const room = {
        code,
        name: cleanString(payload.name || `Expedition ${code}`, 48),
        sector: Math.max(0, Math.min(9999, Math.floor(Number(payload.sector || 0)))),
        visibility: payload.visibility === "public" ? "public" : "private",
        seed: Number.parseInt(code, 36) >>> 0,
        hostId: identity.id,
        players: new Map(),
        createdAt: new Date().toISOString(),
        lastWarpAt: 0
      };
      activeAstraRooms.set(code, room);
      await joinAstraRoom(room, payload, done);
    } catch (error) {
      done({ ok: false, error: error.message || "Unable to create expedition" });
    }
  });

  socket.on("astra:room:join", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      const code = astraRoomCode(payload.code);
      await joinAstraRoom(activeAstraRooms.get(code), payload, done);
    } catch (error) {
      done({ ok: false, error: error.message || "Unable to join expedition" });
    }
  });

  socket.on("astra:room:match", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      let room = [...activeAstraRooms.values()].find((item) => item.visibility === "public" && item.players.size < MAX_ASTRA_PLAYERS);
      if (!room) {
        const code = createAstraCode();
        room = { code, name: `Đội thám hiểm ${code}`, seed: Number.parseInt(code, 36) >>> 0, sector: Math.max(0, Math.floor(Number(payload.sector || 0))), visibility: "public", hostId: astraIdentity().id, players: new Map(), createdAt: new Date().toISOString(), lastWarpAt: 0 };
        activeAstraRooms.set(code, room);
      }
      await joinAstraRoom(room, payload, done);
    } catch (error) {
      done({ ok: false, error: error.message || "Matchmaking unavailable" });
    }
  });

  socket.on("astra:room:leave", async (_payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    await leaveAstraRoom("left");
    done({ ok: true });
  });

  socket.on("astra:state", (payload = {}) => {
    const room = activeAstraRooms.get(activeAstraRoom);
    const player = room?.players.get(socket.id);
    if (!room || !player) return;
    const now = Date.now();
    if (now - Number(socket.data.lastAstraState || 0) < 45) return;
    socket.data.lastAstraState = now;
    player.state = sanitizeAstraState(payload, player.state);
    socket.to(astraSocketRoom(room.code)).volatile.emit("astra:state", { socketId: socket.id, ship: player.ship, state: player.state });
  });

  socket.on("astra:ship", (payload = {}) => {
    const room = activeAstraRooms.get(activeAstraRoom);
    const player = room?.players.get(socket.id);
    if (!room || !player || !ASTRA_SHIPS.has(payload.ship)) return;
    player.ship = payload.ship;
    io.to(astraSocketRoom(room.code)).emit("astra:player:ship", { socketId: socket.id, ship: player.ship, updatedAt: Date.now() });
    emitAstraRoom(room.code);
  });

  socket.on("astra:action", (payload = {}) => {
    const room = activeAstraRooms.get(activeAstraRoom);
    const player = room?.players.get(socket.id);
    if (!room || !player) return;
    const type = cleanString(payload.type, 24);
    if (!["scan", "probe", "ping", "collect", "emote"].includes(type)) return;
    const now = Date.now();
    if (now - Number(socket.data.lastAstraAction || 0) < 220) return;
    socket.data.lastAstraAction = now;
    socket.to(astraSocketRoom(room.code)).emit("astra:action", { socketId: socket.id, type, targetId: cleanString(payload.targetId, 80), detail: cleanString(payload.detail, 120), updatedAt: now });
  });

  socket.on("astra:warp", (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    const room = activeAstraRooms.get(activeAstraRoom);
    if (!room || room.hostId !== astraIdentity().id) return done({ ok: false, error: "Only the expedition host can initiate warp" });
    const now = Date.now();
    if (now - room.lastWarpAt < 3000) return done({ ok: false, error: "Warp drive is cooling down" });
    room.lastWarpAt = now;
    room.sector = Math.max(room.sector + 1, Math.floor(Number(payload.sector || room.sector + 1)));
    room.players.forEach((player) => { player.state = sanitizeAstraState({ ...player.state, x: 0, y: 0, vx: 0, vy: 0 }, player.state); });
    io.to(astraSocketRoom(room.code)).emit("astra:warp", { sector: room.sector, hostId: room.hostId, updatedAt: now });
    done({ ok: true, sector: room.sector });
  });

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

  socket.on("call:config", (callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    if (!socket.user) return done({ ok: false, error: "Authentication required" });
    done({ ok: true, iceServers: ICE_SERVERS, maxParticipants: MAX_CALL_PARTICIPANTS, endToEndEncryption: false });
  });

  socket.on("call:start", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      if (!socket.user) return done({ ok: false, error: "Authentication required" });
      const now = Date.now();
      if (now - Number(socket.data.lastCallStart || 0) < 3000) return done({ ok: false, error: "Please wait before starting another call" });
      socket.data.lastCallStart = now;
      const slug = communityRoomSlug(payload.room);
      const room = await communityRoomFor(socket.user, slug);
      if (!room || !["direct", "group"].includes(room.kind)) return done({ ok: false, error: "Calls require a private or group conversation" });
      const existing = [...activeCalls.values()].find((item) => item.room === slug);
      if (existing) return done({ ok: true, existing: true, call: publicCall(existing), iceServers: ICE_SERVERS });
      const type = payload.type === "audio" ? "audio" : "video";
      const callId = randomUUID();
      const caller = publicChatUser(socket.user);
      const call = {
        id: callId,
        room: slug,
        type,
        group: room.kind === "group",
        startedBy: caller,
        startedById: String(socket.user._id),
        startedAt: new Date().toISOString(),
        participants: new Map()
      };
      call.participants.set(socket.id, { socketId: socket.id, user: caller, media: { mic: true, camera: type === "video", screen: false } });
      activeCalls.set(callId, call);
      activeCallIds.add(callId);
      await socket.join(callSocketRoom(callId));
      const event = { call: publicCall(call), caller, iceServers: ICE_SERVERS };
      for (const memberId of [...new Set((room.memberIds || []).map(String))]) {
        if (memberId !== String(socket.user._id)) io.to(`community:user:${memberId}`).emit("call:incoming", event);
      }
      socket.to(messengerSocketRoom(slug)).emit("call:incoming", event);
      done({ ok: true, call: publicCall(call), iceServers: ICE_SERVERS, maxParticipants: MAX_CALL_PARTICIPANTS });
    } catch (error) {
      done({ ok: false, error: error.message || "Unable to start call" });
    }
  });

  socket.on("call:join", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    try {
      if (!socket.user) return done({ ok: false, error: "Authentication required" });
      const callId = cleanString(payload.callId, 80);
      const call = activeCalls.get(callId);
      if (!call) return done({ ok: false, error: "Call is no longer active" });
      const room = await communityRoomFor(socket.user, call.room);
      if (!room || !["direct", "group"].includes(room.kind)) return done({ ok: false, error: "Call unavailable" });
      if (!call.participants.has(socket.id) && call.participants.size >= MAX_CALL_PARTICIPANTS) return done({ ok: false, error: "Call participant limit reached" });
      const participant = { socketId: socket.id, user: publicChatUser(socket.user), media: { mic: payload.mic !== false, camera: call.type === "video" && payload.camera !== false, screen: false } };
      const peers = [...call.participants.values()];
      call.participants.set(socket.id, participant);
      activeCallIds.add(callId);
      await socket.join(callSocketRoom(callId));
      socket.to(callSocketRoom(callId)).emit("call:participant:joined", { callId, participant });
      done({ ok: true, call: publicCall(call), peers, iceServers: ICE_SERVERS, maxParticipants: MAX_CALL_PARTICIPANTS });
    } catch (error) {
      done({ ok: false, error: error.message || "Unable to join call" });
    }
  });

  socket.on("call:signal", (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    const callId = cleanString(payload.callId, 80);
    const targetSocketId = cleanString(payload.targetSocketId, 120);
    const call = activeCalls.get(callId);
    const signal = payload.signal;
    if (!socket.user || !call?.participants.has(socket.id) || !call.participants.has(targetSocketId)) return done({ ok: false, error: "Invalid call signal" });
    if (!signal || JSON.stringify(signal).length > 64000) return done({ ok: false, error: "Signal payload rejected" });
    io.to(targetSocketId).emit("call:signal", { callId, fromSocketId: socket.id, from: publicChatUser(socket.user), signal });
    done({ ok: true });
  });

  socket.on("call:media", (payload = {}) => {
    const callId = cleanString(payload.callId, 80);
    const call = activeCalls.get(callId);
    const participant = call?.participants.get(socket.id);
    if (!socket.user || !participant) return;
    participant.media = { mic: payload.mic !== false, camera: Boolean(payload.camera), screen: Boolean(payload.screen) };
    socket.to(callSocketRoom(callId)).emit("call:participant:media", { callId, socketId: socket.id, media: participant.media });
  });

  socket.on("call:decline", (payload = {}) => {
    const callId = cleanString(payload.callId, 80);
    const call = activeCalls.get(callId);
    if (!socket.user || !call) return;
    for (const participant of call.participants.values()) {
      if (String(participant.user.id) === call.startedById) io.to(participant.socketId).emit("call:declined", { callId, user: publicChatUser(socket.user) });
    }
  });

  socket.on("call:leave", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    const callId = cleanString(payload.callId, 80);
    await leaveCall(callId, "left");
    done({ ok: true });
  });

  socket.on("call:end", async (payload = {}, callback) => {
    const done = typeof callback === "function" ? callback : () => {};
    const callId = cleanString(payload.callId, 80);
    const call = activeCalls.get(callId);
    if (!socket.user || !call?.participants.has(socket.id)) return done({ ok: false, error: "Call unavailable" });
    if (call.group && call.startedById !== String(socket.user._id)) return done({ ok: false, error: "Only the call host can end a group call" });
    io.to(callSocketRoom(callId)).emit("call:ended", { callId, endedBy: publicChatUser(socket.user), reason: cleanString(payload.reason || "ended", 80), updatedAt: new Date().toISOString() });
    for (const participant of call.participants.values()) {
      const peerSocket = io.sockets.sockets.get(participant.socketId);
      if (peerSocket) await peerSocket.leave(callSocketRoom(callId));
    }
    activeCalls.delete(callId);
    activeCallIds.delete(callId);
    done({ ok: true });
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
    await leaveAstraRoom("disconnected");
    await Promise.all([...activeCallIds].map((callId) => leaveCall(callId, "disconnected")));
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
