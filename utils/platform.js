// Shared server runtime. Kept outside /api so Vercel never counts it as a function.
const { createHash } = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "hoangdaika13_site";
let cachedClient;
let rateLimitIndexReady = false;

const ADMIN_ROLES = new Set(["owner", "super_admin", "admin", "moderator", "support", "analyst"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function adminEmails() {
  return new Set([
    ...String(process.env.ADMIN_EMAIL || "").split(","),
    ...String(process.env.ADMIN_EMAILS || "").split(",")
  ].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));
}

function adminUserIds() {
  return new Set(String(process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => String(id || "").trim())
    .filter((id) => /^[a-f0-9]{24}$/i.test(id)));
}

function isOwnerEmail(email) {
  return adminEmails().has(String(email || "").trim().toLowerCase());
}

function isVerifiedIdentity(user) {
  return Boolean(user?.emailVerifiedAt || user?.verifiedAt);
}

function isOwnerUser(user) {
  if (!user) return false;
  if (adminUserIds().has(String(user._id || user.id || ""))) return true;
  return isOwnerEmail(user.email) && isVerifiedIdentity(user);
}

function isAdminUser(user) {
  if (!user) return false;
  if (isOwnerUser(user)) return true;
  return (Array.isArray(user.systemRoles) ? user.systemRoles : [])
    .some((role) => ADMIN_ROLES.has(clean(role, 40).toLowerCase()) && clean(role, 40).toLowerCase() !== "owner");
}

function jwtSecret() {
  const secret = String(process.env.JWT_SECRET || "");
  if (secret.length < 32) {
    const error = new Error("Server security configuration is incomplete");
    error.statusCode = 503;
    error.code = "SECURITY_CONFIG_MISSING";
    throw error;
  }
  return secret;
}

async function database() {
  if (!uri) throw new Error("Missing MONGODB_URI");
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  return cachedClient.db(dbName);
}

function allowedOrigins() {
  return [...new Set([
    "https://nhhoang13all.xyz",
    "https://www.nhhoang13all.xyz",
    "https://hoangdaika13.github.io",
    "https://hoangdaika13githubio.vercel.app",
    ...String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(",").map((v) => v.trim())
  ].filter(Boolean))];
}

function setCors(req, res) {
  const allowed = allowedOrigins();
  const origin = String(req.headers.origin || "");
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-HH-CSRF");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Origin-Agent-Cluster", "?1");
}

function assertTrustedMutation(req) {
  if (!MUTATING_METHODS.has(String(req.method || "").toUpperCase())) return;
  const authorization = String(req.headers.authorization || "").trim();
  if (authorization) return;
  if (!requestCookie(req, "hh_session")) return;
  const origin = String(req.headers.origin || "").trim();
  const referer = String(req.headers.referer || "").trim();
  let refererOrigin = "";
  try { refererOrigin = new URL(referer).origin; } catch {}
  if (allowedOrigins().includes(origin) || allowedOrigins().includes(refererOrigin)) return;
  const error = new Error("Yêu cầu đăng nhập không có nguồn tin cậy.");
  error.statusCode = 403;
  error.code = "CSRF_ORIGIN_REJECTED";
  throw error;
}

function bodyOf(req) {
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > 64 * 1024) throw new Error("Request body too large");
    return JSON.parse(req.body || "{}");
  }
  return req.body || {};
}

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function signUser(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name || "", ver: Number(user.tokenVersion || 0) },
    jwtSecret(),
    { algorithm: "HS256", expiresIn: "12h", issuer: "hh-platform", audience: "hh-web" }
  );
}

function requestCookie(req, name) {
  const encoded = String(req.headers?.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!encoded) return "";
  try { return decodeURIComponent(encoded.slice(name.length + 1)); }
  catch { return ""; }
}

function signOAuthState(provider, returnTo, nonce) {
  return jwt.sign(
    { type: "oauth", provider, returnTo, nonce },
    jwtSecret(),
    { algorithm: "HS256", expiresIn: "10m", issuer: "hh-platform", audience: "hh-oauth" }
  );
}

function verifyOAuthState(state, provider) {
  try {
    const value = jwt.verify(String(state || ""), jwtSecret(), { algorithms: ["HS256"], issuer: "hh-platform", audience: "hh-oauth" });
    return value?.type === "oauth" && value.provider === provider ? value : null;
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  const roles = new Set((Array.isArray(user.systemRoles) ? user.systemRoles : [])
    .map((role) => clean(role, 40).toLowerCase())
    .filter((role) => ADMIN_ROLES.has(role) && role !== "owner"));
  if (isOwnerUser(user)) roles.add("owner");
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    provider: user.lastProvider || user.provider || "local",
    avatar: user.avatar || "",
    nickname: user.nickname || "",
    creativeColor: user.creativeColor || "#f05caf",
    interests: Array.isArray(user.interests) ? user.interests.map((item) => clean(item, 80)).filter(Boolean).slice(0, 24) : [],
    emailVerified: Boolean(user.emailVerifiedAt || user.verifiedAt),
    lastLoginAt: user.lastLoginAt || null,
    lastSeenAt: user.lastSeenAt || null,
    consent: Boolean(user.consent),
    restrictedFeatures: Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures.map((item) => clean(item, 100)).filter(Boolean).slice(0, 100) : [],
    roles: [...roles],
    verified: Boolean(user.verifiedAt || user.emailVerifiedAt)
  };
}

async function currentUser(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cookieToken = requestCookie(req, "hh_session");
  const token = bearer || cookieToken;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"], issuer: "hh-platform", audience: "hh-web" });
    const db = await database();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
    const disabled = ["deleted", "suspended", "locked", "banned"].includes(String(user?.status || "").toLocaleLowerCase("en-US"));
    if (!user || disabled || Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) return null;
    if (cookieToken && !bearer) {
      const session = await db.collection("authSessions").findOne({
        tokenHash: createHash("sha256").update(cookieToken).digest("hex"),
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      }, { projection: { _id: 1 } });
      if (!session) return null;
    }
    return user;
  } catch {
    return null;
  }
}

function ownerFrom(user, body = {}) {
  return user
    ? { userId: user._id, user: publicUser(user) }
    : { anonymousId: clean(body.anonymousId, 160), user: null };
}

async function withApi(req, res, handler) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    assertTrustedMutation(req);
    return await handler({ db: await database(), body: bodyOf(req) });
  } catch (error) {
    console.error("API error", error?.message || error);
    const explicitStatus = Number(error?.statusCode || 0);
    if (explicitStatus >= 400 && explicitStatus <= 503 && explicitStatus !== 429) {
      return res.status(explicitStatus).json({ error: clean(error.message, 300), code: clean(error.code, 80) || undefined });
    }
    if (error?.statusCode === 429) return res.status(429).json({ error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." });
    if (error?.message === "Request body too large") return res.status(413).json({ error: "Yêu cầu vượt quá giới hạn cho phép." });
    return res.status(500).json({ error: "Máy chủ không thể xử lý yêu cầu." });
  }
}

async function enforceRateLimit(db, key, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = new Date();
  const bucket = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  if (!rateLimitIndexReady) {
    await db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    rateLimitIndexReady = true;
  }
  const result = await db.collection("rateLimits").findOneAndUpdate(
    { _id: `${clean(key, 300)}:${bucket.toISOString()}` },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: now, expiresAt: new Date(bucket.getTime() + windowMs * 2) } },
    { upsert: true, returnDocument: "after" }
  );
  if (Number(result?.count || 0) > limit) {
    const error = new Error("Rate limit exceeded");
    error.statusCode = 429;
    throw error;
  }
}

module.exports = {
  adminEmails,
  adminUserIds,
  bcrypt,
  bodyOf,
  clean,
  currentUser,
  database,
  enforceRateLimit,
  isOwnerUser,
  isAdminUser,
  isOwnerEmail,
  ownerFrom,
  publicUser,
  setCors,
  signOAuthState,
  signUser,
  verifyOAuthState,
  withApi
};
