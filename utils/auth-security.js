const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { clean, currentUser, publicUser } = require("./platform");

const SESSION_COOKIE = "hh_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const REMEMBER_TTL_SECONDS = 30 * 24 * 60 * 60;
let indexesReady = false;

function secret() {
  const value = String(process.env.JWT_SECRET || "");
  if (value.length < 32) throw new Error("Server security configuration is incomplete");
  return value;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((row) => row.trim()).filter(Boolean).map((row) => {
    const index = row.indexOf("=");
    if (index < 0) return [row, ""];
    try { return [row.slice(0, index), decodeURIComponent(row.slice(index + 1))]; }
    catch { return [row.slice(0, index), ""]; }
  }));
}

function appendCookie(res, value) {
  const previous = res.getHeader("Set-Cookie");
  const rows = previous ? (Array.isArray(previous) ? previous : [previous]) : [];
  res.setHeader("Set-Cookie", [...rows, value]);
}

function setSessionCookie(res, token, maxAge = SESSION_TTL_SECONDS) {
  appendCookie(res, `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/; HttpOnly; Secure; SameSite=None`);
}

function clearSessionCookie(res) {
  setSessionCookie(res, "", 0);
}

function tokenHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function hmacHash(value, purpose = "auth") {
  return crypto.createHmac("sha256", process.env.AUTH_OTP_SECRET || secret()).update(`${purpose}:${String(value || "")}`).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function clientIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80);
}

function deviceInfo(req) {
  const userAgent = clean(req.headers["user-agent"], 500);
  const lowered = userAgent.toLowerCase();
  const platform = /android/.test(lowered) ? "Android" : /iphone|ipad/.test(lowered) ? "iOS" : /windows/.test(lowered) ? "Windows" : /macintosh|mac os/.test(lowered) ? "macOS" : /linux/.test(lowered) ? "Linux" : "Unknown";
  const browser = /edg\//.test(lowered) ? "Edge" : /firefox\//.test(lowered) ? "Firefox" : /chrome\//.test(lowered) ? "Chrome" : /safari\//.test(lowered) ? "Safari" : "Unknown";
  return { ip: clientIp(req), userAgent, platform, browser, label: `${browser} · ${platform}` };
}

function signSession(user, ttlSeconds) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name || "", ver: Number(user.tokenVersion || 0) },
    secret(),
    { algorithm: "HS256", expiresIn: ttlSeconds, issuer: "hh-platform", audience: "hh-web" }
  );
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("authSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("authSessions").createIndex({ userId: 1, revokedAt: 1, createdAt: -1 }),
    db.collection("authChallenges").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("authChallenges").createIndex({ type: 1, lookup: 1, consumedAt: 1 }),
    db.collection("passkeys").createIndex({ credentialId: 1 }, { unique: true }),
    db.collection("passkeys").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("loginEvents").createIndex({ userId: 1, createdAt: -1 })
  ]);
  indexesReady = true;
}

async function createSession(db, user, req, options = {}) {
  await ensureIndexes(db);
  const ttlSeconds = options.remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
  const token = signSession(user, ttlSeconds);
  const now = new Date();
  const device = deviceInfo(req);
  const session = {
    sessionId: randomToken(18), userId: user._id, tokenHash: tokenHash(token),
    type: clean(options.type || "password", 40), device, createdAt: now,
    lastSeenAt: now, expiresAt: new Date(now.getTime() + ttlSeconds * 1000), revokedAt: null
  };
  await db.collection("authSessions").insertOne(session);
  return { ...session, token, ttlSeconds };
}

async function authenticate(req, db) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cookieToken = parseCookies(req)[SESSION_COOKIE] || "";
  const token = bearer || cookieToken;
  if (!token) return null;
  const forwarded = { ...req, headers: { ...req.headers, authorization: `Bearer ${token}` } };
  const user = await currentUser(forwarded);
  if (!user) return null;
  await ensureIndexes(db);
  const hash = tokenHash(token);
  const session = await db.collection("authSessions").findOne({ tokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (cookieToken && !session) return null;
  if (session) await db.collection("authSessions").updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  return { user, token, session, via: bearer ? "bearer" : "cookie" };
}

async function requireAuth(req, res, db) {
  const auth = await authenticate(req, db);
  if (!auth) {
    res.status(401).json({ error: "Bạn cần đăng nhập để tiếp tục.", code: "AUTH_REQUIRED" });
    return null;
  }
  return auth;
}

async function recordLoginEvent(db, user, req, type, extra = {}) {
  const now = new Date();
  const device = deviceInfo(req);
  await db.collection("loginEvents").insertOne({ userId: user._id, type: clean(type, 60), ...device, success: extra.success !== false, reason: clean(extra.reason, 100), createdAt: now });
}

async function sendSecurityEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { configured: false, provider: null };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text })
    });
    if (!response.ok) return { configured: true, delivered: false, provider: "resend" };
    const result = await response.json();
    return { configured: true, delivered: true, provider: "resend", id: clean(result.id, 120) };
  } catch {
    return { configured: true, delivered: false, provider: "resend" };
  }
}

function webauthnServer() {
  try { return require("@simplewebauthn/server"); }
  catch {
    const error = new Error("Passkey chưa khả dụng vì máy chủ thiếu @simplewebauthn/server.");
    error.statusCode = 503;
    error.code = "PASSKEY_DEPENDENCY_MISSING";
    throw error;
  }
}

function expectedWebAuthn(req) {
  const host = clean(req.headers["x-forwarded-host"] || req.headers.host, 240).split(":")[0];
  const rpID = clean(process.env.PASSKEY_RP_ID || host, 240);
  const origins = String(process.env.PASSKEY_ORIGINS || process.env.PASSKEY_ORIGIN || `https://${host}`).split(",").map((value) => value.trim()).filter(Boolean);
  return { rpID, expectedOrigin: origins.length === 1 ? origins[0] : origins };
}

function objectId(value) {
  try { return new ObjectId(String(value || "")); } catch { return null; }
}

function authPublicUser(user) {
  const base = publicUser(user);
  if (!base) return null;
  return {
    ...base,
    nickname: clean(user.nickname, 80),
    interests: (Array.isArray(user.interests) ? user.interests : []).map((item) => clean(item, 60)).filter(Boolean).slice(0, 20),
    creativeColor: /^#[0-9a-f]{6}$/i.test(String(user.creativeColor || "")) ? String(user.creativeColor).toUpperCase() : "#62D7E7"
  };
}

function authResponse(user, session) {
  return { token: session.token, user: authPublicUser(user), session: { id: session.sessionId, expiresAt: session.expiresAt, device: session.device } };
}

module.exports = {
  REMEMBER_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  appendCookie,
  authPublicUser,
  authResponse,
  authenticate,
  clearSessionCookie,
  clientIp,
  createSession,
  deviceInfo,
  ensureIndexes,
  expectedWebAuthn,
  hmacHash,
  objectId,
  parseCookies,
  randomToken,
  recordLoginEvent,
  requireAuth,
  safeEqual,
  sendSecurityEmail,
  setSessionCookie,
  tokenHash,
  webauthnServer
};
