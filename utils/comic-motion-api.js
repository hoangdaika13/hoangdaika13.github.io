"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { clean, enforceRateLimit } = require("./platform");
const { evaluateRights } = require("./comic-motion-rights");
const {
  sanitizeSeries, sanitizeChapter, sanitizeDescriptor, createHandoff, getHandoff, consumeHandoff
} = require("./comic-motion-library");
const {
  JOB_STATES, createBatchJobs, listJobs, getJob, publicJob, updateOwnedJob, deleteJob, getJobArtifacts, workerConfigured
} = require("./comic-motion-jobs");
const {
  workerHealth, dispatchWorkerJob, applyWorkerCallback, getWorkerManifest
} = require("./comic-motion-worker");
const { adapterFor } = require("./comic-motion-adapters");

const PUBLIC_WORKER_ACTIONS = new Set(["worker-job-callback"]);
const TRUSTED_OPEN_COMICS = Object.freeze({
  "github-open:pepper-and-carrot": Object.freeze({
    status: "allowed",
    licenseCode: "CC-BY-4.0",
    licenseVersion: "4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://github.com/ollm/OpenComic/tree/master/Pepper%20%26%20Carrot",
    author: "David Revoy",
    artist: "David Revoy",
    commercialUseAllowed: true,
    derivativesAllowed: true,
    redistributionAllowed: true,
    territory: "worldwide",
    attributionText: "Pepper & Carrot © David Revoy · CC BY 4.0 · bản mẫu từ ollm/OpenComic",
    evidenceId: "hh-open-catalog:pepper-and-carrot:v1",
    evidenceHash: createHash("sha256").update("https://github.com/ollm/OpenComic/tree/master/Pepper%20%26%20Carrot|CC-BY-4.0|David Revoy").digest("hex"),
    evidenceCapturedAt: new Date("2026-08-14T00:00:00.000Z"),
    reviewerId: "hh-open-catalog-v1",
    reviewStatus: "approved",
    reviewedAt: new Date("2026-08-14T00:00:00.000Z")
  })
});

function ownerIdOf(user) {
  return user?._id ? String(user._id) : "";
}

function fail(message, statusCode = 400, code = "COMIC_MOTION_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

async function audit(db, event) {
  const now = new Date();
  await db.collection("comicMotionAuditEvents").insertOne({ ...event, createdAt: now, updatedAt: now });
}

function isTrustedRightsRecord(record) {
  return Boolean(record && record.reviewStatus === "approved" && record.reviewerId && /^[a-f0-9]{64}$/i.test(String(record.evidenceHash || "")) && !record.revokedAt);
}

async function verifiedRightsFor(db, ownerId, series, chapters = []) {
  if (TRUSTED_OPEN_COMICS[series.id]) return TRUSTED_OPEN_COMICS[series.id];
  if (!chapters.length) return null;
  const records = await Promise.all(chapters.map((chapter) => db.collection("comicMotionRights").findOne({ ownerId: String(ownerId), seriesId: series.id, chapterId: chapter.id })));
  if (!records.every(isTrustedRightsRecord)) return null;
  const fingerprint = (record) => `${record.licenseCode}|${record.evidenceHash}|${record.revokedAt || ""}`;
  return records.every((record) => fingerprint(record) === fingerprint(records[0])) ? records[0] : null;
}

async function createVerifiedHandoff(db, ownerId, input) {
  const raw = input && typeof input === "object" ? input : {};
  const series = sanitizeSeries(raw.series || raw);
  const chapters = (Array.isArray(raw.chapters) ? raw.chapters : raw.chapter ? [raw.chapter] : []).map((chapter) => ({ id: clean(chapter.id || chapter.chapterId, 180) })).filter((chapter) => chapter.id);
  const trustedRights = await verifiedRightsFor(db, ownerId, series, chapters);
  return createHandoff(db, ownerId, { ...raw, rights: trustedRights || raw.rights }, { trustedReview: Boolean(trustedRights) });
}

async function enforceDailyQuota(db, ownerId, descriptor = null) {
  const maxJobs = Math.min(100, Math.max(1, Number(process.env.COMIC_MOTION_MAX_DAILY_JOBS) || 20));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const count = await db.collection("comicMotionJobs").countDocuments({ ownerId: String(ownerId), createdAt: { $gte: since } });
  const requestedJobs = Math.max(1, Number(descriptor?.chapters?.length) || 1);
  if (count + requestedJobs > maxJobs) fail(`Batch sẽ vượt giới hạn ${maxJobs} Comic Motion job trong ngày.`, 429, "COMIC_MOTION_DAILY_JOB_LIMIT");
  if (!descriptor) return;
  const rows = await db.collection("comicMotionJobs").find({ ownerId: String(ownerId), createdAt: { $gte: since } }).limit(500).toArray();
  const requestedMinutes = (descriptor.chapters || []).reduce((sum, chapter) => sum + Math.max(Number(chapter.estimatedPanelCount) || 0, Number(chapter.pageCount) || 1) * 4 / 60, 0);
  const maxMinutes = Number(process.env.COMIC_MOTION_MAX_DAILY_MINUTES) || 0;
  const usedMinutes = rows.reduce((sum, job) => sum + Number(job.estimatedDurationSeconds || 0) / 60, 0);
  if (maxMinutes > 0 && usedMinutes + requestedMinutes > maxMinutes) fail(`Batch vượt giới hạn ${maxMinutes} phút render mỗi ngày.`, 429, "COMIC_MOTION_DAILY_MINUTES_LIMIT");
  const maxUsd = Number(process.env.COMIC_MOTION_MAX_DAILY_USD) || 0;
  if (maxUsd > 0) {
    const usdPerMinute = Number(process.env.COMIC_MOTION_WORKER_USD_PER_MINUTE) || 0;
    if (!(usdPerMinute > 0)) fail("Đã bật giới hạn chi phí nhưng thiếu COMIC_MOTION_WORKER_USD_PER_MINUTE.", 503, "COMIC_MOTION_PRICING_MISSING");
    const usedUsd = rows.reduce((sum, job) => sum + Number(job.estimatedCostUsd || 0), 0);
    if (usedUsd + requestedMinutes * usdPerMinute > maxUsd) fail(`Batch vượt giới hạn ${maxUsd} USD mỗi ngày.`, 429, "COMIC_MOTION_DAILY_USD_LIMIT");
  }
}

async function dispatchAndRecordFailure(db, job) {
  try {
    return await dispatchWorkerJob(db, job);
  } catch (error) {
    await db.collection("comicMotionJobs").updateOne(
      { _id: job.id || job._id, ownerId: job.ownerId, status: "queued" },
      { $set: { status: "failed", currentStage: "failed", lastError: clean(error.message, 400), statusReason: "Worker không xác nhận nhận job.", updatedAt: new Date() } }
    );
    return null;
  }
}

async function createBatch(db, ownerId, body) {
  let descriptor;
  if (clean(body.handoffId, 180)) {
    const handoff = await consumeHandoff(db, ownerId, body.handoffId);
    descriptor = handoff.descriptor;
  } else {
    descriptor = sanitizeDescriptor(body.descriptor || body, ownerId);
  }
  descriptor.chapters = await Promise.all(descriptor.chapters.map(async (chapter) => {
    const registered = await db.collection("comicMotionRights").findOne({ ownerId: String(ownerId), seriesId: descriptor.series.id, chapterId: chapter.id });
    return { ...chapter, rights: registered || descriptor.rights };
  }));
  await enforceDailyQuota(db, ownerId, descriptor);
  const result = await createBatchJobs(db, ownerId, descriptor, {
    presetId: body.presetId,
    preset: body.preset,
    revision: body.revision,
    pageRanges: body.pageRanges,
    commercialMode: body.commercialMode !== false,
    priority: body.priority,
    secondsPerScene: body.secondsPerScene,
    requestId: body.requestId
  });
  if (result.workerConfigured) {
    const dispatchable = result.jobs.filter((job) => job.status === "queued" && !job.workerJobId).slice(0, 3);
    await Promise.all(dispatchable.map((job) => dispatchAndRecordFailure(db, { ...job, _id: job.id, ownerId: String(ownerId) })));
    result.jobs = await listJobs(db, ownerId, { batchId: result.batchId, limit: 100 });
  }
  return result;
}

async function presetAction(db, ownerId, action, body) {
  const collection = db.collection("comicMotionPresets");
  await collection.createIndex({ ownerId: 1, id: 1 }, { unique: true, name: "comic_motion_preset_owner_id" });
  if (action === "preset-list") {
    const rows = await collection.find({ ownerId: String(ownerId) }).sort({ updatedAt: -1 }).limit(100).toArray();
    return { presets: rows.map((row) => ({ ...row, _id: undefined })) };
  }
  if (action === "preset-delete") {
    const id = clean(body.id, 120);
    const result = await collection.deleteOne({ ownerId: String(ownerId), id });
    if (!result.deletedCount) fail("Preset không tồn tại trong tài khoản này.", 404, "COMIC_PRESET_NOT_FOUND");
    return { ok: true, id };
  }
  const preset = body.preset && typeof body.preset === "object" ? body.preset : {};
  const id = clean(preset.id || body.id || randomUUID(), 120).replace(/[^a-zA-Z0-9_.-]/g, "-");
  const format = ["16:9", "9:16", "1:1"].includes(preset.format) ? preset.format : "16:9";
  const mode = ["auto", "quick-review", "pro"].includes(preset.mode) ? preset.mode : "quick-review";
  const now = new Date();
  const record = {
    ownerId: String(ownerId), id, name: clean(preset.name || "Preset Comic Motion", 180),
    format, mode, camera: clean(preset.camera || "manga-cinematic", 80),
    subtitle: preset.subtitle !== false, watermark: preset.watermark === true,
    voiceProvider: clean(preset.voiceProvider || "browser", 60),
    isDefault: preset.isDefault === true, schemaVersion: 1, updatedAt: now
  };
  if (record.isDefault) await collection.updateMany({ ownerId: String(ownerId) }, { $set: { isDefault: false, updatedAt: now } });
  await collection.updateOne({ ownerId: String(ownerId), id }, { $set: record, $setOnInsert: { createdAt: now } }, { upsert: true });
  return { preset: record };
}

async function rightsCheck(db, ownerId, body) {
  const provider = clean(body.provider || body.series?.provider || body.series?.sourceType, 60).toLowerCase();
  const sourceType = clean(body.sourceType || body.series?.sourceType || provider, 80).toLowerCase();
  const seriesId = clean(body.seriesId || body.series?.id, 180);
  const chapterId = clean(body.chapterId || body.chapter?.id, 180);
  const existing = seriesId ? await db.collection("comicMotionRights").findOne({ ownerId: String(ownerId), seriesId, chapterId }) : null;
  const trusted = TRUSTED_OPEN_COMICS[seriesId] || (isTrustedRightsRecord(existing) ? existing : null);
  const rights = evaluateRights(trusted || body.rights || {}, {
    provider, sourceType, commercialMode: body.commercialMode !== false,
    requireEvidence: true, trustedReview: Boolean(trusted)
  });
  if (seriesId) {
    const now = new Date();
    await db.collection("comicMotionRights").updateOne(
      { ownerId: String(ownerId), seriesId, chapterId },
      { $set: trusted ? { ownerId: String(ownerId), seriesId, chapterId, provider, ...rights, updatedAt: now } : {
        ownerId: String(ownerId), learnerProfileId: clean(body.learnerProfileId, 180), workspaceId: clean(body.workspaceId, 180),
        seriesId, chapterId, provider, ...rights, reviewStatus: "submitted", reviewerId: "", reviewedAt: null, updatedAt: now
      }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  }
  return { rights };
}

async function revokeRights(db, ownerId, body) {
  const seriesId = clean(body.seriesId, 180);
  const chapterId = clean(body.chapterId, 180);
  if (!seriesId) fail("Thiếu seriesId để thu hồi quyền.");
  const now = new Date();
  await db.collection("comicMotionRights").updateMany({ ownerId: String(ownerId), seriesId, ...(chapterId ? { chapterId } : {}) }, { $set: { status: "denied", reviewStatus: "revoked", revokedAt: now, updatedAt: now } });
  await db.collection("comicMotionJobs").updateMany(
    { ownerId: String(ownerId), seriesId, ...(chapterId ? { chapterId } : {}), status: { $nin: ["completed", "cancelled", "failed", "blocked-rights"] } },
    { $set: { status: "blocked-rights", currentStage: "blocked-rights", statusReason: clean(body.reason || "Quyền sử dụng đã bị thu hồi.", 400), updatedAt: now } }
  );
  await db.collection("comicMotionArtifacts").updateMany({ ownerId: String(ownerId), seriesId, ...(chapterId ? { chapterId } : {}), hiddenAt: null }, { $set: { hiddenAt: now, updatedAt: now } });
  await audit(db, { type: "rights:revoked", ownerId: String(ownerId), seriesId, chapterId, provider: clean(body.provider, 60), reason: clean(body.reason, 400) });
  return { ok: true, seriesId, chapterId, revokedAt: now };
}

async function handleComicMotionApi(req, res, { db, body, user }) {
  if (req.method === "GET" && req.query.workerManifest) {
    const manifest = await getWorkerManifest(db, req.query.workerManifest);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).json({ ok: true, manifest });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const action = clean(body.action, 80);
  if (PUBLIC_WORKER_ACTIONS.has(action)) {
    const job = await applyWorkerCallback(db, req, body);
    return res.status(200).json({ ok: true, job });
  }
  const ownerId = ownerIdOf(user);
  if (!ownerId) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng Comic Motion Library Bridge.", code: "AUTH_REQUIRED" });
  await enforceRateLimit(db, `comic-motion-api:${ownerId}`, 240, 15 * 60 * 1000);

  if (action === "library-handoff-create") return res.status(201).json({ ok: true, handoff: await createVerifiedHandoff(db, ownerId, body.descriptor || body) });
  if (action === "library-handoff-get") return res.status(200).json({ ok: true, handoff: await getHandoff(db, ownerId, body.handoffId) });
  if (action === "library-handoff-consume") return res.status(200).json({ ok: true, handoff: await consumeHandoff(db, ownerId, body.handoffId) });
  if (action === "library-series-resolve") return res.status(200).json({ ok: true, series: sanitizeSeries(body.series || body) });
  if (action === "library-chapter-resolve") {
    const series = sanitizeSeries(body.series || {});
    const chapter = sanitizeChapter(body.chapter || body, series);
    return res.status(200).json({ ok: true, chapter, adapter: adapterFor({ series, chapters: [chapter] }).constructor.name });
  }
  if (action === "library-rights-check") return res.status(200).json({ ok: true, ...(await rightsCheck(db, ownerId, body)) });
  if (action === "library-rights-revoke") return res.status(200).json(await revokeRights(db, ownerId, body));
  if (action === "batch-job-create") return res.status(201).json({ ok: true, ...(await createBatch(db, ownerId, body)) });
  if (action === "batch-job-list") return res.status(200).json({ ok: true, jobs: await listJobs(db, ownerId, body) });
  if (action === "batch-job-get") return res.status(200).json({ ok: true, job: publicJob(await getJob(db, ownerId, body.jobId)) });
  if (action === "batch-job-pause") return res.status(200).json({ ok: true, job: await updateOwnedJob(db, ownerId, body.jobId, "pause") });
  if (action === "batch-job-cancel") return res.status(200).json({ ok: true, job: await updateOwnedJob(db, ownerId, body.jobId, "cancel") });
  if (action === "batch-job-delete") return res.status(200).json(await deleteJob(db, ownerId, body.jobId));
  if (action === "batch-job-artifacts") return res.status(200).json({ ok: true, ...(await getJobArtifacts(db, ownerId, body.jobId)) });
  if (["batch-job-resume", "batch-job-retry"].includes(action)) {
    const operation = action.endsWith("resume") ? "resume" : "retry";
    const job = await updateOwnedJob(db, ownerId, body.jobId, operation, { checkpoint: body.checkpoint, pageIndex: body.pageIndex });
    const dispatched = await dispatchAndRecordFailure(db, { ...job, _id: job.id, ownerId: String(ownerId) });
    return res.status(dispatched ? 200 : 502).json(dispatched ? { ok: true, job: dispatched } : { error: "Render Worker không xác nhận nhận job.", code: "WORKER_DISPATCH_FAILED" });
  }
  if (action === "batch-job-dispatch") {
    if (!workerConfigured()) fail("Render Worker chưa kết nối.", 503, "COMIC_MOTION_WORKER_NOT_CONFIGURED");
    const job = await getJob(db, ownerId, body.jobId);
    if (job.status !== "queued" || job.workerJobId) fail("Job không ở trạng thái chờ dispatch.", 409, "COMIC_JOB_TRANSITION_INVALID");
    const dispatched = await dispatchAndRecordFailure(db, job);
    if (!dispatched) fail("Render Worker không xác nhận nhận job.", 502, "WORKER_DISPATCH_FAILED");
    return res.status(200).json({ ok: true, job: dispatched });
  }
  if (action === "worker-health") return res.status(200).json({ ok: true, health: await workerHealth() });
  if (["preset-list", "preset-save", "preset-delete"].includes(action)) return res.status(200).json({ ok: true, ...(await presetAction(db, ownerId, action, body)) });

  fail(`Comic Motion action không được hỗ trợ: ${action || "(trống)"}.`, 400, "COMIC_MOTION_ACTION_INVALID");
}

module.exports = { handleComicMotionApi, __test: { ownerIdOf, enforceDailyQuota, rightsCheck, PUBLIC_WORKER_ACTIONS, JOB_STATES } };
