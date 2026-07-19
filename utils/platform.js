// Shared server runtime. Kept outside /api so Vercel never counts it as a function.
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "hoangdaika13_site";
let cachedClient;
let rateLimitIndexReady = false;

const DEFAULT_ADMIN_EMAILS = Object.freeze([
  "nhhoang130803@gmail.com",
  "dungnguyen29082000@gmail.com"
]);
const ADMIN_ROLES = new Set(["owner", "super_admin", "admin", "moderator", "support", "analyst"]);

function adminEmails() {
  return new Set([
    ...DEFAULT_ADMIN_EMAILS,
    ...String(process.env.ADMIN_EMAIL || "").split(","),
    ...String(process.env.ADMIN_EMAILS || "").split(",")
  ].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));
}

function isOwnerEmail(email) {
  return adminEmails().has(String(email || "").trim().toLowerCase());
}

function isAdminUser(user) {
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;
  return (Array.isArray(user.systemRoles) ? user.systemRoles : [])
    .some((role) => ADMIN_ROLES.has(clean(role, 40).toLowerCase()));
}

function jwtSecret() {
  const secret = String(process.env.JWT_SECRET || "");
  if (secret.length < 32) throw new Error("Server security configuration is incomplete");
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

function setCors(req, res) {
  const allowed = [...new Set([
    "https://nhhoang13all.xyz",
    "https://www.nhhoang13all.xyz",
    "https://hoangdaika13.github.io",
    "https://hoangdaika13githubio.vercel.app",
    ...String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(",").map((v) => v.trim())
  ].filter(Boolean))];
  const origin = String(req.headers.origin || "");
  if (origin && allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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
  const roles = new Set((Array.isArray(user.systemRoles) ? user.systemRoles : []).map((role) => clean(role, 40)).filter(Boolean));
  if (isOwnerEmail(user.email)) roles.add("owner");
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    provider: user.lastProvider || user.provider || "local",
    avatar: user.avatar || "",
    consent: Boolean(user.consent),
    restrictedFeatures: Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures.map((item) => clean(item, 100)).filter(Boolean).slice(0, 100) : [],
    roles: [...roles],
    verified: Boolean(user.verifiedAt || user.emailVerifiedAt)
  };
}

async function currentUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"], issuer: "hh-platform", audience: "hh-web" });
    const db = await database();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
    const disabled = ["deleted", "suspended", "locked", "banned"].includes(String(user?.status || "").toLocaleLowerCase("en-US"));
    return user && !disabled && Number(payload.ver || 0) === Number(user.tokenVersion || 0) ? user : null;
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
  bcrypt,
  bodyOf,
  clean,
  currentUser,
  database,
  enforceRateLimit,
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
