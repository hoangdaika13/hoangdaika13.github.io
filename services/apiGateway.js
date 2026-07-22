"use strict";

const { createHash } = require("crypto");
const { clean, currentUser, database, enforceRateLimit, isAdminUser, setCors } = require("../utils/platform");

const AUDIT_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const QUOTA_RETENTION_SECONDS = 3 * 24 * 60 * 60;
const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key|card|cvv|query|searchTerm)/i;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let indexesReady = false;

function redact(value, depth = 0) {
  if (depth > 5 || value == null) return value == null ? null : undefined;
  if (["string", "boolean"].includes(typeof value)) return typeof value === "string" ? clean(value, 500) : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redact(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value !== "object") return undefined;
  return Object.entries(value).slice(0, 100).reduce((result, [key, item]) => {
    const safeKey = clean(key, 80);
    if (!safeKey || SENSITIVE_KEY.test(safeKey)) return result;
    const safeValue = redact(item, depth + 1);
    if (safeValue !== undefined) result[safeKey] = safeValue;
    return result;
  }, {});
}

function requestCookie(req, name) {
  const part = String(req?.headers?.cookie || "").split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return part ? part.slice(name.length + 1) : "";
}

function trustedOrigins() {
  return new Set([
    "https://nhhoang13all.xyz",
    "https://www.nhhoang13all.xyz",
    "https://hoangdaika13.github.io",
    "https://hoangdaika13githubio.vercel.app",
    ...String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(",").map(value => value.trim())
  ].filter(Boolean));
}

function assertCsrf(req) {
  if (SAFE_METHODS.has(String(req?.method || "GET").toUpperCase())) return true;
  if (!requestCookie(req, "hh_session")) return true;
  const origin = clean(req.headers?.origin, 300);
  let refererOrigin = "";
  try { refererOrigin = new URL(String(req.headers?.referer || "")).origin; } catch { /* Missing referer is rejected below. */ }
  if (trustedOrigins().has(origin) || trustedOrigins().has(refererOrigin)) return true;
  const error = new Error("Yêu cầu dùng cookie phiên không có nguồn CSRF tin cậy.");
  error.statusCode = 403;
  error.code = "CSRF_ORIGIN_REJECTED";
  throw error;
}

function requireRoles(user, allowed = []) {
  if (!allowed.length) return true;
  if (!user) {
    const error = new Error("Bạn cần đăng nhập để tiếp tục.");
    error.statusCode = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  if (isAdminUser(user) && allowed.includes("admin")) return true;
  const roles = new Set((Array.isArray(user.systemRoles) ? user.systemRoles : []).map(role => clean(role, 40).toLowerCase()));
  if (allowed.some(role => roles.has(role))) return true;
  const error = new Error("Tài khoản không có quyền thực hiện tác vụ này.");
  error.statusCode = 403;
  error.code = "RBAC_DENIED";
  throw error;
}

function fingerprint(req, user) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "guest").split(",")[0].trim();
  const identity = user?._id ? `user:${user._id}` : `guest:${forwarded}`;
  const salt = String(process.env.GATEWAY_AUDIT_SALT || process.env.JWT_SECRET || "hh-gateway-local-salt");
  return createHash("sha256").update(`${salt}:${identity}`).digest("hex").slice(0, 32);
}

function positiveInt(value, fallback, max = 10000000) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(max, number) : fallback;
}

function providerPolicy(provider, action = "search") {
  const id = clean(provider, 30).toLowerCase();
  const operation = clean(action || "search", 40).toLowerCase();
  if (id === "google") return {
    provider: id, action: operation, cost: 1,
    dailyLimit: positiveInt(process.env.GOOGLE_SEARCH_GATEWAY_DAILY_LIMIT, 100),
    rateLimit: positiveInt(process.env.GOOGLE_SEARCH_GATEWAY_RATE_LIMIT, 50, 10000),
    windowMs: 10 * 60 * 1000
  };
  if (id === "youtube") {
    const cost = operation === "search" ? 101 : 1;
    return {
      provider: id, action: operation, cost,
      dailyLimit: positiveInt(process.env.YOUTUBE_GATEWAY_DAILY_LIMIT, 10000),
      rateLimit: positiveInt(process.env.YOUTUBE_GATEWAY_RATE_LIMIT, operation === "search" ? 40 : 80, 10000),
      windowMs: 10 * 60 * 1000
    };
  }
  const error = new Error("Provider gateway không được hỗ trợ.");
  error.statusCode = 404;
  error.code = "GATEWAY_PROVIDER_UNKNOWN";
  throw error;
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("gatewayQuotaUsage").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("gatewayQuotaUsage").createIndex({ provider: 1, day: 1 }),
    db.collection("gatewayAuditLogs").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("gatewayAuditLogs").createIndex({ provider: 1, createdAt: -1 })
  ]);
  indexesReady = true;
}

async function reserveQuota(db, policy) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const id = `${policy.provider}:${day}`;
  const collection = db.collection("gatewayQuotaUsage");
  await collection.updateOne(
    { _id: id },
    { $setOnInsert: { provider: policy.provider, day, used: 0, createdAt: now, expiresAt: new Date(now.getTime() + QUOTA_RETENTION_SECONDS * 1000) } },
    { upsert: true }
  );
  const reserved = await collection.updateOne(
    { _id: id, used: { $lte: Math.max(0, policy.dailyLimit - policy.cost) } },
    { $inc: { used: policy.cost }, $set: { limit: policy.dailyLimit, updatedAt: now } }
  );
  if (!reserved.modifiedCount) {
    const error = new Error(`HH Gateway đã chạm hạn mức ${policy.provider} trong ngày.`);
    error.statusCode = 429;
    error.code = "GATEWAY_QUOTA_EXHAUSTED";
    throw error;
  }
  const usage = await collection.findOne({ _id: id }, { projection: { used: 1, limit: 1, day: 1 } });
  return { provider: policy.provider, day, used: Number(usage?.used || 0), limit: policy.dailyLimit, remaining: Math.max(0, policy.dailyLimit - Number(usage?.used || 0)), cost: policy.cost, source: "hh-gateway" };
}

async function writeAudit(db, entry) {
  const now = new Date();
  const safe = redact(entry) || {};
  await db.collection("gatewayAuditLogs").insertOne({
    provider: clean(safe.provider, 30), action: clean(safe.action, 40), outcome: ["success", "failed"].includes(safe.outcome) ? safe.outcome : "failed",
    statusCode: Math.max(100, Math.min(599, Number(safe.statusCode || 500))), cost: Math.max(0, Number(safe.cost || 0)),
    actorKind: safe.actorKind === "user" ? "user" : "guest", actorHash: clean(safe.actorHash, 64), errorCode: clean(safe.errorCode, 80),
    durationMs: Math.max(0, Math.min(120000, Number(safe.durationMs || 0))), createdAt: now,
    expiresAt: new Date(now.getTime() + AUDIT_RETENTION_SECONDS * 1000)
  });
}

async function beginGateway(req, res, options = {}) {
  setCors(req, res);
  assertCsrf(req);
  const db = options.db || await database();
  await ensureIndexes(db);
  const user = options.user === undefined ? await currentUser(req) : options.user;
  if (options.requireAuth && !user) requireRoles(null, ["member"]);
  requireRoles(user, options.roles || []);
  const policy = providerPolicy(options.provider, options.action);
  const actorHash = fingerprint(req, user);
  await enforceRateLimit(db, `gateway:${policy.provider}:${policy.action}:${actorHash}`, policy.rateLimit, policy.windowMs);
  const quota = await reserveQuota(db, policy);
  res?.setHeader?.("X-HH-Gateway-Quota-Limit", String(quota.limit));
  res?.setHeader?.("X-HH-Gateway-Quota-Remaining", String(quota.remaining));
  res?.setHeader?.("X-HH-Gateway-Quota-Source", quota.source);
  const startedAt = Date.now();
  let completed = false;
  return {
    db, user, policy, quota,
    async complete(outcome = "success", statusCode = 200, errorCode = "") {
      if (completed) return;
      completed = true;
      await writeAudit(db, { provider: policy.provider, action: policy.action, outcome, statusCode, cost: policy.cost, actorKind: user ? "user" : "guest", actorHash, errorCode, durationMs: Date.now() - startedAt });
    }
  };
}

async function quotaStatus(db = null) {
  const activeDb = db || await database();
  await ensureIndexes(activeDb);
  const day = new Date().toISOString().slice(0, 10);
  const policies = [providerPolicy("google", "search"), providerPolicy("youtube", "search")];
  const rows = await activeDb.collection("gatewayQuotaUsage").find({ day }, { projection: { provider: 1, used: 1, limit: 1 } }).toArray();
  const byProvider = new Map(rows.map(row => [row.provider, row]));
  return policies.map(policy => {
    const row = byProvider.get(policy.provider);
    const used = Number(row?.used || 0);
    return { provider: policy.provider, day, used, limit: policy.dailyLimit, remaining: Math.max(0, policy.dailyLimit - used), source: "hh-gateway", note: "Lượt đã đi qua HH Gateway; không phải số dư từ Google Console." };
  });
}

module.exports = Object.freeze({ AUDIT_RETENTION_SECONDS, redact, assertCsrf, requireRoles, fingerprint, providerPolicy, reserveQuota, writeAudit, beginGateway, quotaStatus });
