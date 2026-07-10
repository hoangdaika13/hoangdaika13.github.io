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

const allowedOrigins = [FRONTEND_URL, "http://127.0.0.1:4173", "http://localhost:4173"].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
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

app.get("/api/admin/events", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const collection = await events();
  const rows = await collection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  res.json({ events: rows });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.user = await verifyToken(token);
  next();
});

io.on("connection", async (socket) => {
  const auth = socket.handshake.auth || {};
  const consent = Boolean(auth.consent || socket.user?.consent);
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
