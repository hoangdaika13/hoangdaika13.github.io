"use strict";

const { createHash, createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { evaluateRights } = require("./comic-motion-rights");
const { JOB_STATES, publicJob } = require("./comic-motion-jobs");

const CALLBACK_TOLERANCE_SECONDS = 300;
const indexedDatabases = new WeakSet();
const PIPELINE_ORDER = ["queued", "resolving", "downloading", "analyzing", "ocr", "storyboard", "awaiting-review", "voice", "audio-mix", "rendering", "packaging", "completed"];

function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function configured(env = process.env) {
  const missing = [];
  if (!/^https:\/\//i.test(String(env.COMIC_MOTION_WORKER_URL || ""))) missing.push("COMIC_MOTION_WORKER_URL");
  if (String(env.COMIC_MOTION_WORKER_TOKEN || "").length < 24) missing.push("COMIC_MOTION_WORKER_TOKEN");
  if (String(env.COMIC_MOTION_WORKER_CALLBACK_SECRET || "").length < 32) missing.push("COMIC_MOTION_WORKER_CALLBACK_SECRET");
  if (!clean(env.PUBLIC_SITE_URL || env.FRONTEND_URL, 500)) missing.push("PUBLIC_SITE_URL");
  return { configured: missing.length === 0, missing };
}

function bodyHash(body) {
  const serialized = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body || {}));
  return createHash("sha256").update(serialized).digest("hex");
}

function signaturePayload(method, path, timestamp, nonce, hash) {
  return [String(method || "POST").toUpperCase(), String(path || "/"), String(timestamp || ""), String(nonce || ""), String(hash || "")].join("\n");
}

function signRequest({ method = "POST", path = "/", timestamp, nonce, body = {}, secret = process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET }) {
  if (String(secret || "").length < 32) throw Object.assign(new Error("COMIC_MOTION_WORKER_CALLBACK_SECRET chưa được cấu hình an toàn."), { statusCode: 503, code: "WORKER_SECRET_MISSING" });
  const hash = bodyHash(body);
  return createHmac("sha256", secret).update(signaturePayload(method, path, timestamp, nonce, hash)).digest("hex");
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || "")) || !/^[a-f0-9]{64}$/i.test(String(right || ""))) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function ensureNonceIndex(db) {
  if (!db || indexedDatabases.has(db)) return;
  await Promise.all([
    db.collection("comicMotionWorkerNonces").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "comic_motion_worker_nonce_ttl" }),
    db.collection("comicMotionWorkerNonces").createIndex({ nonceHash: 1 }, { unique: true, name: "comic_motion_worker_nonce_unique" })
  ]);
  indexedDatabases.add(db);
}

async function verifySignedCallback(db, req, rawBody) {
  const secret = String(process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET || "");
  if (secret.length < 32) throw Object.assign(new Error("Worker callback chưa được cấu hình."), { statusCode: 503, code: "WORKER_SECRET_MISSING" });
  const timestamp = clean(req.headers["x-hh-timestamp"], 40);
  const nonce = clean(req.headers["x-hh-nonce"], 180);
  const supplied = clean(req.headers["x-hh-signature"], 100).replace(/^sha256=/i, "");
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > CALLBACK_TOLERANCE_SECONDS * 1000) {
    throw Object.assign(new Error("Worker callback đã hết hạn."), { statusCode: 401, code: "WORKER_CALLBACK_EXPIRED" });
  }
  if (nonce.length < 24) throw Object.assign(new Error("Worker callback thiếu nonce hợp lệ."), { statusCode: 401, code: "WORKER_NONCE_INVALID" });
  const pathname = String(req.url || "/").split("?")[0] || "/";
  const expected = signRequest({ method: req.method, path: pathname, timestamp, nonce, body: rawBody, secret });
  if (!safeEqualHex(supplied, expected)) throw Object.assign(new Error("Chữ ký worker callback không hợp lệ."), { statusCode: 401, code: "WORKER_SIGNATURE_INVALID" });
  await ensureNonceIndex(db);
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  try {
    await db.collection("comicMotionWorkerNonces").insertOne({ nonceHash, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + CALLBACK_TOLERANCE_SECONDS * 2000) });
  } catch (error) {
    if (error?.code === 11000) throw Object.assign(new Error("Worker callback nonce đã được sử dụng."), { statusCode: 409, code: "WORKER_NONCE_REPLAY" });
    throw error;
  }
  return { timestamp: time, nonceHash };
}

function allowedOutputHosts(env = process.env) {
  const hosts = new Set(String(env.COMIC_MOTION_WORKER_OUTPUT_HOSTS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
  try { hosts.add(new URL(env.COMIC_MOTION_WORKER_URL).hostname.toLowerCase()); } catch {}
  return hosts;
}

function assertOutputUrl(value, env = process.env) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw Object.assign(new Error("Worker trả về output URL không hợp lệ."), { statusCode: 400, code: "WORKER_OUTPUT_URL_INVALID" }); }
  if (url.protocol !== "https:" || url.username || url.password || !allowedOutputHosts(env).has(url.hostname.toLowerCase())) {
    throw Object.assign(new Error("Output host của worker chưa nằm trong allowlist."), { statusCode: 403, code: "WORKER_OUTPUT_HOST_BLOCKED" });
  }
  url.hash = "";
  return url.href;
}

function canWorkerTransition(current, next) {
  if (current === next) return true;
  if (["completed", "cancelled", "blocked-rights"].includes(current)) return false;
  if (next === "failed") return !["draft", "paused"].includes(current);
  if (current === "retrying") return ["resolving", "downloading", "analyzing", "ocr", "storyboard", "voice", "audio-mix", "rendering", "packaging"].includes(next);
  const currentIndex = PIPELINE_ORDER.indexOf(current);
  const nextIndex = PIPELINE_ORDER.indexOf(next);
  return currentIndex >= 0 && nextIndex >= currentIndex && nextIndex <= currentIndex + 2;
}

function manifestToken(jobId, expiresAt, nonce = randomBytes(18).toString("base64url")) {
  const secret = String(process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET || "");
  if (secret.length < 32) throw Object.assign(new Error("Worker manifest secret chưa được cấu hình."), { statusCode: 503, code: "WORKER_SECRET_MISSING" });
  const payload = Buffer.from(JSON.stringify({ jobId: String(jobId), exp: Number(expiresAt), nonce })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`manifest:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

function verifyManifestToken(token) {
  const [payload, supplied] = String(token || "").split(".");
  const secret = String(process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET || "");
  if (!payload || !supplied || secret.length < 32) throw Object.assign(new Error("Worker manifest token không hợp lệ."), { statusCode: 401, code: "WORKER_MANIFEST_TOKEN_INVALID" });
  const expected = createHmac("sha256", secret).update(`manifest:${payload}`).digest("hex");
  if (!safeEqualHex(supplied, expected)) throw Object.assign(new Error("Worker manifest token không hợp lệ."), { statusCode: 401, code: "WORKER_MANIFEST_TOKEN_INVALID" });
  let value;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw Object.assign(new Error("Worker manifest token không hợp lệ."), { statusCode: 401, code: "WORKER_MANIFEST_TOKEN_INVALID" }); }
  if (!value.jobId || Number(value.exp) < Date.now()) throw Object.assign(new Error("Worker manifest token đã hết hạn."), { statusCode: 401, code: "WORKER_MANIFEST_TOKEN_EXPIRED" });
  return value;
}

function sanitizedWorkerManifest(job) {
  return {
    schemaVersion: 1,
    pipelineVersion: "comic-motion-batch-v1",
    jobId: String(job._id),
    ownerHash: job.ownerHash || createHash("sha256").update(`owner:${job.ownerId}`).digest("hex"),
    series: job.series,
    chapter: job.chapter,
    provider: job.provider,
    pageRange: job.pageRange,
    preset: job.preset,
    parts: job.parts,
    rights: job.rights,
    cleanReaderBlockedPages: job.chapter?.cleanReaderBlockedPages || []
  };
}

async function getWorkerManifest(db, token) {
  const value = verifyManifestToken(token);
  const job = await db.collection("comicMotionJobs").findOne({ _id: clean(value.jobId, 180) });
  if (!job) throw Object.assign(new Error("Worker job không tồn tại."), { statusCode: 404, code: "COMIC_JOB_NOT_FOUND" });
  const rights = evaluateRights(job.rights || {}, { provider: job.provider, sourceType: job.series?.sourceType, commercialMode: true });
  if (rights.status !== "allowed") throw Object.assign(new Error("Quyền chuyển thể không còn hợp lệ."), { statusCode: 403, code: "COMIC_RIGHTS_REVOKED" });
  return sanitizedWorkerManifest({ ...job, rights });
}

async function workerHealth(env = process.env) {
  const config = configured(env);
  if (!config.configured) return { connected: false, status: "Chưa kết nối", missing: config.missing, checkedAt: new Date().toISOString(), fallback: "Browser Renderer dùng cho preview/video ngắn." };
  let url;
  try { url = new URL(env.COMIC_MOTION_WORKER_URL); } catch { return { connected: false, status: "Chưa kết nối", missing: ["COMIC_MOTION_WORKER_URL"], checkedAt: new Date().toISOString() }; }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.COMIC_MOTION_WORKER_TOKEN}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { connected: false, status: "Không phản hồi hợp lệ", httpStatus: response.status, checkedAt: new Date().toISOString(), missing: [] };
    return { connected: true, status: "Đã kết nối", checkedAt: new Date().toISOString(), worker: { version: clean(payload.version, 80), ffmpeg: Boolean(payload.ffmpeg), queueDepth: Math.max(0, Number(payload.queueDepth) || 0) }, missing: [] };
  } catch (error) {
    return { connected: false, status: "Không thể kết nối", error: clean(error.message, 180), checkedAt: new Date().toISOString(), missing: [] };
  }
}

async function dispatchWorkerJob(db, job, env = process.env) {
  const config = configured(env);
  if (!config.configured) throw Object.assign(new Error(`Render Worker chưa kết nối. Thiếu: ${config.missing.join(", ")}`), { statusCode: 503, code: "COMIC_MOTION_WORKER_NOT_CONFIGURED" });
  const base = String(env.PUBLIC_SITE_URL || env.FRONTEND_URL).replace(/\/$/, "");
  const manifest = manifestToken(job._id, Date.now() + 15 * 60_000);
  const callbackPath = "/api/modules/comic-motion/actions";
  const requestBody = {
    jobId: String(job._id),
    ownerHash: createHash("sha256").update(`owner:${job.ownerId}`).digest("hex"),
    manifestUrl: `${base}${callbackPath}?workerManifest=${encodeURIComponent(manifest)}`,
    preset: job.preset,
    callbackUrl: `${base}${callbackPath}`,
    timestamp: Date.now(),
    nonce: randomBytes(24).toString("base64url")
  };
  const workerUrl = new URL(env.COMIC_MOTION_WORKER_URL);
  workerUrl.pathname = `${workerUrl.pathname.replace(/\/$/, "")}/jobs`;
  const signature = signRequest({ method: "POST", path: workerUrl.pathname, timestamp: requestBody.timestamp, nonce: requestBody.nonce, body: requestBody });
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.COMIC_MOTION_WORKER_TOKEN}`, "Content-Type": "application/json", "X-HH-Timestamp": String(requestBody.timestamp), "X-HH-Nonce": requestBody.nonce, "X-HH-Signature": signature },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !clean(payload.workerJobId || payload.id, 180)) throw Object.assign(new Error(`Worker không nhận job (HTTP ${response.status}).`), { statusCode: 502, code: "WORKER_DISPATCH_FAILED" });
  const workerJobId = clean(payload.workerJobId || payload.id, 180);
  const updated = await db.collection("comicMotionJobs").findOneAndUpdate(
    { _id: job._id, ownerId: job.ownerId, status: "queued" },
    { $set: { workerJobId, dispatchedAt: new Date(), updatedAt: new Date(), statusReason: "Worker đã xác nhận nhận job." } },
    { returnDocument: "after" }
  );
  return publicJob(updated || job);
}

async function applyWorkerCallback(db, req, body) {
  await verifySignedCallback(db, req, body);
  const jobId = clean(body.jobId, 180);
  const job = await db.collection("comicMotionJobs").findOne({ _id: jobId });
  if (!job) throw Object.assign(new Error("Worker job không tồn tại."), { statusCode: 404, code: "COMIC_JOB_NOT_FOUND" });
  if (job.workerJobId && clean(body.workerJobId, 180) !== job.workerJobId) throw Object.assign(new Error("Worker job ID không khớp."), { statusCode: 403, code: "WORKER_JOB_ID_MISMATCH" });
  const rights = evaluateRights(job.rights || {}, { provider: job.provider, sourceType: job.series?.sourceType, commercialMode: true });
  if (rights.status !== "allowed") {
    const blocked = await db.collection("comicMotionJobs").findOneAndUpdate({ _id: job._id }, { $set: { status: "blocked-rights", currentStage: "blocked-rights", rights, statusReason: rights.reasons[0], updatedAt: new Date() } }, { returnDocument: "after" });
    return publicJob(blocked);
  }
  const requestedStatus = clean(body.status, 40);
  if (!JOB_STATES.includes(requestedStatus) || ["draft", "blocked-rights"].includes(requestedStatus)) throw Object.assign(new Error("Worker status không hợp lệ."), { statusCode: 400, code: "WORKER_STATUS_INVALID" });
  if (!canWorkerTransition(job.status, requestedStatus)) throw Object.assign(new Error(`Worker transition ${job.status} → ${requestedStatus} không hợp lệ.`), { statusCode: 409, code: "WORKER_TRANSITION_INVALID" });
  const progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
  const set = { status: requestedStatus, currentStage: requestedStatus, progress: requestedStatus === "completed" ? 100 : progress, updatedAt: new Date(), lastError: requestedStatus === "failed" ? clean(body.error, 500) : "" };
  if (body.checkpoint && typeof body.checkpoint === "object") {
    set.checkpoints = [...(job.checkpoints || []), { stage: clean(body.checkpoint.stage || requestedStatus, 80), completedAt: new Date(), metadata: { page: Number(body.checkpoint.page) || undefined, part: Number(body.checkpoint.part) || undefined } }].slice(-30);
  }
  if (requestedStatus === "completed") {
    if (!Array.isArray(body.artifacts) || !body.artifacts.length) throw Object.assign(new Error("Worker không thể hoàn thành khi chưa có artifact."), { statusCode: 409, code: "WORKER_ARTIFACT_REQUIRED" });
    const artifacts = body.artifacts.slice(0, 30).map((artifact) => ({
      _id: randomBytes(18).toString("hex"), ownerId: job.ownerId, jobId: String(job._id),
      seriesId: job.seriesId, chapterId: job.chapterId, provider: job.provider,
      type: clean(artifact.type, 80), filename: clean(artifact.filename, 240),
      mimeType: clean(artifact.mimeType, 100), url: assertOutputUrl(artifact.url),
      checksum: /^[a-f0-9]{64}$/i.test(clean(artifact.checksum, 80)) ? clean(artifact.checksum, 80).toLowerCase() : "",
      bytes: Math.max(0, Number(artifact.bytes) || 0), hiddenAt: null, createdAt: new Date(), updatedAt: new Date()
    }));
    await db.collection("comicMotionArtifacts").insertMany(artifacts);
    set.completedAt = new Date();
  }
  const updated = await db.collection("comicMotionJobs").findOneAndUpdate({ _id: job._id, workerJobId: job.workerJobId }, { $set: set }, { returnDocument: "after" });
  await db.collection("comicMotionAuditEvents").insertOne({ type: "worker:callback", ownerId: job.ownerId, jobId: String(job._id), seriesId: job.seriesId, chapterId: job.chapterId, provider: job.provider, status: requestedStatus, createdAt: new Date(), updatedAt: new Date() });
  return publicJob(updated);
}

module.exports = {
  CALLBACK_TOLERANCE_SECONDS,
  configured,
  bodyHash,
  signaturePayload,
  signRequest,
  safeEqualHex,
  verifySignedCallback,
  allowedOutputHosts,
  assertOutputUrl,
  canWorkerTransition,
  manifestToken,
  verifyManifestToken,
  getWorkerManifest,
  workerHealth,
  dispatchWorkerJob,
  applyWorkerCallback
};
