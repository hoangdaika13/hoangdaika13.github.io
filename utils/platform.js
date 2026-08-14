// Shared server runtime. Kept outside /api so Vercel never counts it as a function.
const { createHash, createHmac, randomUUID } = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "hoangdaika13_site";
let cachedClient;
let rateLimitIndexReady = false;

const ADMIN_ROLES = new Set(["owner", "super_admin", "admin", "moderator", "support", "analyst"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Keep enough room for a 3 MiB file encoded as base64 while staying below the
// serverless platform request ceiling.
const DEFAULT_BODY_LIMIT = 4_400_000;
const DEFAULT_BODY_COMPLEXITY = Object.freeze({
  maxDepth: 24,
  maxNodes: 20_000,
  maxArrayLength: 5_000,
  maxObjectKeys: 1_000,
  maxKeyLength: 160
});
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

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

function isGoogleVerifiedIdentity(user) {
  const provider = String(user?.lastProvider || user?.provider || "").trim().toLowerCase();
  return Boolean(
    user?.googleVerifiedAt
    || user?.verifiedProviders?.google
    || (provider === "google" && isVerifiedIdentity(user))
  );
}

function isOwnerUser(user) {
  if (!user) return false;
  if (adminUserIds().has(String(user._id || user.id || ""))) return true;
  return isOwnerEmail(user.email) && isGoogleVerifiedIdentity(user);
}

function isAdminUser(user) {
  if (!user) return false;
  if (isOwnerUser(user)) return true;
  return [
    ...(Array.isArray(user.systemRoles) ? user.systemRoles : []),
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role
  ]
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
    "https://hoang8.com",
    "https://www.hoang8.com",
    "https://hoangdaika13.github.io",
    "https://hoangdaika13-github-io.vercel.app",
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
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Origin-Agent-Cluster", "?1");
  const requestId = randomUUID();
  req.hhRequestId = requestId;
  res.setHeader("X-Request-ID", requestId);
}

function assertTrustedMutation(req) {
  if (!MUTATING_METHODS.has(String(req.method || "").toUpperCase())) return;
  const origin = String(req.headers.origin || "").trim();
  const referer = String(req.headers.referer || "").trim();
  let refererOrigin = "";
  try { refererOrigin = new URL(referer).origin; } catch {}
  const browserOrigin = origin || (referer ? refererOrigin || "__invalid_referer__" : "");
  const trustedBrowserOrigin = Boolean(browserOrigin && allowedOrigins().includes(browserOrigin));
  const fetchSite = String(req.headers["sec-fetch-site"] || "").trim().toLowerCase();
  const fetchMode = String(req.headers["sec-fetch-mode"] || "").trim().toLowerCase();
  const fetchDest = String(req.headers["sec-fetch-dest"] || "").trim().toLowerCase();
  const documentDestination = new Set(["document", "iframe", "frame", "object", "embed"]).has(fetchDest);
  if ((fetchSite === "cross-site" && !trustedBrowserOrigin) || fetchMode === "navigate" || documentDestination) {
    const error = new Error("Yêu cầu trình duyệt không có ngữ cảnh tin cậy.");
    error.statusCode = 403;
    error.code = "FETCH_METADATA_REJECTED";
    throw error;
  }
  if (trustedBrowserOrigin) return;
  if (!browserOrigin && !requestCookie(req, "hh_session")) return;
  const error = new Error("Yêu cầu đăng nhập không có nguồn tin cậy.");
  error.statusCode = 403;
  error.code = "CSRF_ORIGIN_REJECTED";
  throw error;
}

function requestError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertSafeJson(value, options = {}) {
  const limits = { ...DEFAULT_BODY_COMPLEXITY, ...options };
  const stack = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop();
    nodes += 1;
    if (nodes > limits.maxNodes) throw requestError("Request body is too complex", 413, "BODY_TOO_COMPLEX");
    if (current.depth > limits.maxDepth) throw requestError("Request body nesting is too deep", 413, "BODY_TOO_DEEP");
    if (current.value === null || typeof current.value !== "object") continue;
    const prototype = Object.getPrototypeOf(current.value);
    if (Buffer.isBuffer(current.value) || (!Array.isArray(current.value) && prototype !== Object.prototype && prototype !== null)) {
      throw requestError("Request body contains an unsupported value", 400, "BODY_VALUE_UNSUPPORTED");
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > limits.maxArrayLength) throw requestError("Request array is too large", 413, "BODY_ARRAY_TOO_LARGE");
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], depth: current.depth + 1 });
      }
      continue;
    }
    const keys = Object.keys(current.value);
    if (keys.length > limits.maxObjectKeys) throw requestError("Request object has too many fields", 413, "BODY_OBJECT_TOO_LARGE");
    for (const key of keys) {
      const normalizedKey = String(key).toLowerCase();
      if (key.length > limits.maxKeyLength || UNSAFE_OBJECT_KEYS.has(normalizedKey) || key.startsWith("$") || key.includes(".")) {
        throw requestError("Request body contains an unsafe field name", 400, "BODY_KEY_REJECTED");
      }
      stack.push({ value: current.value[key], depth: current.depth + 1 });
    }
  }
  return value;
}

function bodyOf(req, options = {}) {
  const maxBodyBytes = Math.max(1024, Math.min(Number(options.maxBodyBytes) || DEFAULT_BODY_LIMIT, DEFAULT_BODY_LIMIT));
  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw requestError("Request body too large", 413, "BODY_TOO_LARGE");
  }
  let parsed = req.body;
  if (typeof parsed === "string") {
    if (Buffer.byteLength(parsed, "utf8") > maxBodyBytes) throw requestError("Request body too large", 413, "BODY_TOO_LARGE");
    try { parsed = JSON.parse(parsed || "{}"); }
    catch { throw requestError("Request body is not valid JSON", 400, "BODY_JSON_INVALID"); }
  }
  if (parsed === undefined || parsed === null || parsed === "") parsed = {};
  let serialized;
  try { serialized = JSON.stringify(parsed); }
  catch { throw requestError("Request body is not serializable", 400, "BODY_VALUE_UNSUPPORTED"); }
  if (Buffer.byteLength(serialized || "", "utf8") > maxBodyBytes) throw requestError("Request body too large", 413, "BODY_TOO_LARGE");
  return assertSafeJson(parsed, options);
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
  const roles = new Set([
    ...(Array.isArray(user.systemRoles) ? user.systemRoles : []),
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role
  ]
    .map((role) => clean(role, 40).toLowerCase())
    .filter((role) => ADMIN_ROLES.has(role) && role !== "owner"));
  const owner = isOwnerUser(user);
  const admin = owner || roles.size > 0;
  const googleVerified = isGoogleVerifiedIdentity(user);
  if (owner) roles.add("owner");
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
    educationRole: ["student", "parent", "teacher", "content-reviewer", "school-admin", "platform-admin"].includes(clean(user.educationRole, 40).toLowerCase())
      ? clean(user.educationRole, 40).toLowerCase()
      : "student",
    verified: Boolean(user.verifiedAt || user.emailVerifiedAt),
    access: {
      admin,
      owner,
      identityVerified: googleVerified,
      identityProvider: googleVerified ? "google" : ""
    }
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

async function withApi(req, res, handler, options = {}) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    assertTrustedMutation(req);
    return await handler({ db: await database(), body: bodyOf(req, options) });
  } catch (error) {
    console.error("API error", error?.message || error);
    const explicitStatus = Number(error?.statusCode || 0);
    if (explicitStatus >= 400 && explicitStatus <= 503 && explicitStatus !== 429) {
      return res.status(explicitStatus).json({ error: clean(error.message, 300), code: clean(error.code, 80) || undefined });
    }
    if (error?.statusCode === 429) {
      if (Number.isFinite(error.retryAfter)) res.setHeader("Retry-After", String(Math.max(1, Math.ceil(error.retryAfter))));
      return res.status(429).json({ error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." });
    }
    if (error?.message === "Request body too large") return res.status(413).json({ error: "Yêu cầu vượt quá giới hạn cho phép." });
    return res.status(500).json({ error: "Máy chủ không thể xử lý yêu cầu." });
  }
}

async function enforceRateLimit(db, key, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = new Date();
  const bucket = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const keyHash = createHmac("sha256", process.env.GATEWAY_AUDIT_SALT || jwtSecret())
    .update(`rate-limit:${clean(key, 300)}`)
    .digest("hex");
  if (!rateLimitIndexReady) {
    await db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    rateLimitIndexReady = true;
  }
  const result = await db.collection("rateLimits").findOneAndUpdate(
    { _id: `${keyHash}:${bucket.toISOString()}` },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: now, expiresAt: new Date(bucket.getTime() + windowMs * 2) } },
    { upsert: true, returnDocument: "after" }
  );
  if (Number(result?.count || 0) > limit) {
    const error = new Error("Rate limit exceeded");
    error.statusCode = 429;
    error.retryAfter = Math.ceil((bucket.getTime() + windowMs - now.getTime()) / 1000);
    throw error;
  }
}

module.exports = {
  adminEmails,
  adminUserIds,
  assertTrustedMutation,
  bcrypt,
  bodyOf,
  clean,
  currentUser,
  database,
  enforceRateLimit,
  isOwnerUser,
  isAdminUser,
  isOwnerEmail,
  isGoogleVerifiedIdentity,
  ownerFrom,
  publicUser,
  setCors,
  signOAuthState,
  signUser,
  verifyOAuthState,
  withApi,
  __test: Object.freeze({ allowedOrigins, assertSafeJson, assertTrustedMutation, requestCookie })
};
