"use strict";

const { createHash } = require("node:crypto");
const { clean, enforceRateLimit } = require("../utils/platform");

const JOB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EVENT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key|card|cvv|prompt|message|content|query|text|form|keystroke)/i;
const TOOL_POLICIES = Object.freeze({
  "widget-marketplace": { runtime: "server", actions: ["list", "install", "disable", "remove", "rate"], auth: true },
  "plugin-system": { runtime: "server", actions: ["inspect", "install", "enable", "disable", "remove"], auth: true },
  "speech-to-text": { runtime: "ai", actions: ["transcribe"], auth: true, provider: "speech" },
  "ai-chat": { runtime: "ai", actions: ["send", "retry"], auth: true, provider: "gemini" },
  "prompt-optimizer": { runtime: "ai", actions: ["optimize", "compare"], auth: true, provider: "gemini" },
  "image-prompt-generator": { runtime: "ai", actions: ["generate", "variation"], auth: true, provider: "gemini" },
  "ocr": { runtime: "ai", actions: ["recognize"], auth: true, provider: "vision" },
  "realtime-notifications": { runtime: "integration", actions: ["status", "subscribe", "unsubscribe"], auth: true, provider: "web-push" }
});

let indexesReady = false;

function safeMeta(value, depth = 0) {
  if (value == null || depth > 5) return value == null ? null : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return clean(value, 500);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeMeta(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value !== "object") return undefined;
  return Object.entries(value).slice(0, 100).reduce((safe, [key, item]) => {
    const safeKey = clean(key, 60);
    if (!safeKey || SENSITIVE_KEY.test(safeKey)) return safe;
    const safeValue = safeMeta(item, depth + 1);
    if (safeValue !== undefined) safe[safeKey] = safeValue;
    return safe;
  }, {});
}

function publicPolicy(policy) {
  return { runtime: policy.runtime, actions: [...policy.actions], auth: policy.auth !== false, provider: policy.provider || null };
}

function policyFor(toolId, action, runtime) {
  const id = clean(toolId, 80).toLowerCase();
  const operation = clean(action, 40).toLowerCase();
  const policy = TOOL_POLICIES[id];
  if (!policy || (runtime && policy.runtime !== runtime)) {
    const error = new Error("Tool gateway không hỗ trợ công cụ này.");
    error.statusCode = 404;
    error.code = "TOOL_NOT_ALLOWLISTED";
    throw error;
  }
  if (!policy.actions.includes(operation)) {
    const error = new Error("Thao tác không được Tool gateway cho phép.");
    error.statusCode = 400;
    error.code = "TOOL_ACTION_NOT_ALLOWED";
    throw error;
  }
  return { id, action: operation, ...policy };
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("toolJobs").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("toolJobs").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("toolFiles").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("toolEvents").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("toolEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
  indexesReady = true;
}

function jobPublic(job) {
  if (!job) return null;
  return {
    id: String(job._id), toolId: job.toolId, action: job.action, state: job.state,
    progress: Number(job.progress || 0), result: safeMeta(job.result), error: safeMeta(job.error),
    createdAt: job.createdAt, updatedAt: job.updatedAt, finishedAt: job.finishedAt || null
  };
}

async function createJob(db, user, policy, metadata = {}) {
  await ensureIndexes(db);
  const now = new Date();
  const doc = {
    userId: user._id, toolId: policy.id, action: policy.action, runtime: policy.runtime,
    state: "queued", progress: 0, metadata: safeMeta(metadata), createdAt: now, updatedAt: now,
    expiresAt: new Date(now.getTime() + JOB_TTL_MS)
  };
  const result = await db.collection("toolJobs").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function updateJob(db, job, state, update = {}) {
  const now = new Date();
  const allowed = new Set(["queued", "running", "success", "error", "cancelled"]);
  if (!allowed.has(state)) throw new Error("Invalid job state");
  const patch = { state, updatedAt: now, ...safeMeta(update) };
  if (["success", "error", "cancelled"].includes(state)) patch.finishedAt = now;
  await db.collection("toolJobs").updateOne({ _id: job._id, userId: job.userId }, { $set: patch });
  return { ...job, ...patch };
}

async function listJobs(db, user, limit = 30) {
  await ensureIndexes(db);
  const rows = await db.collection("toolJobs").find({ userId: user._id }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 30))).toArray();
  return rows.map(jobPublic);
}

async function findJob(db, user, id) {
  const { ObjectId } = require("mongodb");
  if (!/^[a-f0-9]{24}$/i.test(String(id || ""))) return null;
  return db.collection("toolJobs").findOne({ _id: new ObjectId(String(id)), userId: user._id });
}

async function cancelJob(db, user, id) {
  const job = await findJob(db, user, id);
  if (!job) return null;
  if (["success", "error", "cancelled"].includes(job.state)) return jobPublic(job);
  return jobPublic(await updateJob(db, job, "cancelled"));
}

async function executeServerTool(db, user, policy, input = {}) {
  await enforceRateLimit(db, `tool:${user._id}:${policy.id}:${policy.action}`, 60, 10 * 60 * 1000);
  const job = await createJob(db, user, policy, { source: "tool-runtime" });
  let current = await updateJob(db, job, "running", { progress: 10 });
  try {
    let result;
    if (policy.id === "widget-marketplace" && policy.action === "list") {
      result = { widgets: [], source: "server", message: "Marketplace đã kết nối; chưa có widget được duyệt." };
    } else if (policy.id === "plugin-system" && policy.action === "inspect") {
      const manifest = input.manifest && typeof input.manifest === "object" ? input.manifest : {};
      result = {
        valid: Boolean(clean(manifest.id, 80) && clean(manifest.version, 30)),
        id: clean(manifest.id, 80), version: clean(manifest.version, 30),
        permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map((value) => clean(value, 60)).filter(Boolean).slice(0, 30) : [],
        sandboxRequired: true
      };
    } else {
      const error = new Error("Thao tác cần bộ cài/marketplace được quản trị phê duyệt.");
      error.statusCode = 501;
      error.code = "TOOL_ADAPTER_NOT_CONFIGURED";
      throw error;
    }
    current = await updateJob(db, current, "success", { progress: 100, result });
    return jobPublic(current);
  } catch (error) {
    current = await updateJob(db, current, "error", { error: { code: error.code || "TOOL_EXECUTION_FAILED", message: clean(error.message, 300) } });
    error.job = jobPublic(current);
    throw error;
  }
}

function configuredProviders() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    speech: Boolean(process.env.SPEECH_API_URL && process.env.SPEECH_API_KEY),
    vision: Boolean(process.env.VISION_API_URL && process.env.VISION_API_KEY),
    "web-push": Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  };
}

function providerStatus() {
  const configured = configuredProviders();
  return Object.entries(configured).map(([provider, ready]) => ({ provider, configured: ready, secretsExposed: false }));
}

function actorFingerprint(req, user) {
  const ip = String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0].trim();
  const salt = String(process.env.TOOL_EVENT_SALT || process.env.JWT_SECRET || "hh-tool-event-local");
  return createHash("sha256").update(`${salt}:${user?._id || ip}`).digest("hex").slice(0, 32);
}

function sanitizeEvent(body = {}) {
  const name = clean(body.name, 80).toLowerCase();
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(name)) {
    const error = new Error("Tên event không hợp lệ.");
    error.statusCode = 400;
    error.code = "EVENT_NAME_INVALID";
    throw error;
  }
  return { name, toolId: clean(body.toolId, 80), properties: safeMeta(body.properties || {}), consent: body.consent === true };
}

module.exports = Object.freeze({ JOB_TTL_MS, EVENT_TTL_MS, TOOL_POLICIES, safeMeta, publicPolicy, policyFor, ensureIndexes, jobPublic, createJob, updateJob, listJobs, findJob, cancelJob, executeServerTool, configuredProviders, providerStatus, actorFingerprint, sanitizeEvent });
