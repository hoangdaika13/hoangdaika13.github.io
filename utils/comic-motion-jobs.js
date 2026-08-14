"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { evaluateRights, rightsFingerprint } = require("./comic-motion-rights");

const JOB_STATES = Object.freeze([
  "draft", "rights-check", "queued", "resolving", "downloading", "analyzing", "ocr",
  "storyboard", "awaiting-review", "voice", "audio-mix", "rendering", "packaging",
  "completed", "paused", "retrying", "failed", "cancelled", "blocked-rights"
]);
const TERMINAL_STATES = new Set(["completed", "failed", "cancelled", "blocked-rights"]);
const ACTIVE_STATES = new Set(["queued", "resolving", "downloading", "analyzing", "ocr", "storyboard", "voice", "audio-mix", "rendering", "packaging", "retrying"]);
const MAX_SCENES_PER_PART = 120;
const indexedDatabases = new WeakSet();

function limitNumber(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
}

const LIMITS = Object.freeze({
  chapters: limitNumber("COMIC_MOTION_MAX_BATCH_CHAPTERS", 100, 1, 100),
  pages: limitNumber("COMIC_MOTION_MAX_BATCH_PAGES", 2000, 1, 2000),
  pagesPerChapter: 500,
  scenesPerPart: MAX_SCENES_PER_PART
});

function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function stableHash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function splitChapterParts(sceneCount, pageCount = 0) {
  const totalScenes = Math.max(1, Math.min(2000, Number(sceneCount) || Number(pageCount) || 1));
  const parts = [];
  for (let start = 0, index = 1; start < totalScenes; start += MAX_SCENES_PER_PART, index += 1) {
    const count = Math.min(MAX_SCENES_PER_PART, totalScenes - start);
    parts.push({ index, label: `Part ${index}`, sceneStart: start + 1, sceneEnd: start + count, sceneCount: count, status: "draft", progress: 0, artifactId: "" });
  }
  return parts;
}

function normalizePageRange(chapter, input = {}) {
  const available = Math.max(1, Math.min(LIMITS.pagesPerChapter, Number(chapter.pageCount) || LIMITS.pagesPerChapter));
  const requested = input.pageRanges?.[chapter.id] || chapter.pageRange || {};
  const start = Math.max(1, Math.min(available, Number(requested.start) || 1));
  const end = Math.max(start, Math.min(available, Number(requested.end) || available));
  return { start, end, pageCount: end - start + 1 };
}

function idempotencyKey(ownerId, seriesId, chapterId, pageRange, presetId, revision = 1) {
  return stableHash([String(ownerId), seriesId, chapterId, pageRange.start, pageRange.end, presetId, revision].join("|"));
}

function publicJob(job) {
  if (!job) return null;
  const output = { ...job, id: String(job._id || job.id || "") };
  delete output._id;
  delete output.workerRequest;
  delete output.callbackSignature;
  delete output.ownerHash;
  return output;
}

async function ensureJobIndexes(db) {
  if (!db || indexedDatabases.has(db)) return;
  await Promise.all([
    db.collection("comicMotionJobs").createIndex({ ownerId: 1, createdAt: -1 }, { name: "comic_motion_job_owner_created" }),
    db.collection("comicMotionJobs").createIndex({ ownerId: 1, status: 1, updatedAt: -1 }, { name: "comic_motion_job_owner_status" }),
    db.collection("comicMotionJobs").createIndex({ ownerId: 1, seriesId: 1, chapterId: 1 }, { name: "comic_motion_job_owner_chapter" }),
    db.collection("comicMotionJobs").createIndex({ ownerId: 1, idempotencyKey: 1 }, { unique: true, name: "comic_motion_job_idempotency" }),
    db.collection("comicMotionArtifacts").createIndex({ ownerId: 1, jobId: 1, createdAt: -1 }, { name: "comic_motion_artifact_owner_job" }),
    db.collection("comicMotionAuditEvents").createIndex({ ownerId: 1, createdAt: -1 }, { name: "comic_motion_audit_owner_created" })
  ]);
  indexedDatabases.add(db);
}

function workerMissing(env = process.env) {
  const missing = [];
  if (!/^https:\/\//i.test(String(env.COMIC_MOTION_WORKER_URL || ""))) missing.push("COMIC_MOTION_WORKER_URL");
  if (String(env.COMIC_MOTION_WORKER_TOKEN || "").length < 24) missing.push("COMIC_MOTION_WORKER_TOKEN");
  if (String(env.COMIC_MOTION_WORKER_CALLBACK_SECRET || "").length < 32) missing.push("COMIC_MOTION_WORKER_CALLBACK_SECRET");
  if (!/^https:\/\//i.test(String(env.PUBLIC_SITE_URL || env.FRONTEND_URL || ""))) missing.push("PUBLIC_SITE_URL");
  return missing;
}

function workerConfigured(env = process.env) {
  return workerMissing(env).length === 0;
}

function validateBatch(descriptor, input = {}) {
  const chapters = Array.isArray(descriptor?.chapters) ? descriptor.chapters : [];
  if (!chapters.length) throw Object.assign(new Error("Batch chưa có chương."), { statusCode: 400, code: "COMIC_BATCH_EMPTY" });
  if (chapters.length > LIMITS.chapters) throw Object.assign(new Error(`Tối đa ${LIMITS.chapters} chương mỗi batch.`), { statusCode: 413, code: "COMIC_BATCH_CHAPTER_LIMIT" });
  let totalPages = 0;
  const ranges = new Map();
  for (const chapter of chapters) {
    const range = normalizePageRange(chapter, input);
    if (range.pageCount > LIMITS.pagesPerChapter) throw Object.assign(new Error(`Chương ${chapter.number || chapter.id} vượt ${LIMITS.pagesPerChapter} trang.`), { statusCode: 413, code: "COMIC_CHAPTER_PAGE_LIMIT" });
    totalPages += range.pageCount;
    ranges.set(chapter.id, range);
  }
  if (totalPages > LIMITS.pages) throw Object.assign(new Error(`Batch vượt giới hạn ${LIMITS.pages} trang.`), { statusCode: 413, code: "COMIC_BATCH_PAGE_LIMIT" });
  return { chapters, ranges, totalPages };
}

async function createBatchJobs(db, ownerId, descriptor, input = {}) {
  await ensureJobIndexes(db);
  const { chapters, ranges, totalPages } = validateBatch(descriptor, input);
  const presetId = clean(input.presetId || descriptor.preset?.id || "youtube-16x9", 120);
  const revision = Math.max(1, Math.min(999, Number(input.revision) || 1));
  const batchId = randomUUID();
  const now = new Date();
  const results = [];
  const configured = workerConfigured();
  for (const chapter of chapters) {
    const range = ranges.get(chapter.id);
    const key = idempotencyKey(ownerId, descriptor.series.id, chapter.id, range, presetId, revision);
    const existing = await db.collection("comicMotionJobs").findOne({ ownerId: String(ownerId), idempotencyKey: key });
    if (existing) {
      results.push({ job: publicJob(existing), duplicate: true });
      continue;
    }
    const chapterRights = evaluateRights(chapter.rights || descriptor.rights || {}, {
      provider: chapter.provider || descriptor.series.provider,
      sourceType: descriptor.series.sourceType,
      commercialMode: input.commercialMode !== false
    });
    const sceneCount = Math.max(range.pageCount, Math.min(2000, Number(chapter.estimatedPanelCount) || range.pageCount));
    const allowed = chapterRights.status === "allowed";
    const status = !allowed ? "blocked-rights" : configured ? "queued" : "draft";
    const job = {
      _id: randomUUID(),
      schemaVersion: 1,
      ownerId: String(ownerId),
      learnerProfileId: clean(descriptor.learnerProfileId, 180),
      workspaceId: clean(descriptor.workspaceId, 180),
      batchId,
      seriesId: descriptor.series.id,
      chapterId: chapter.id,
      provider: chapter.provider || descriptor.series.provider,
      series: descriptor.series,
      chapter,
      rights: chapterRights,
      rightsFingerprint: rightsFingerprint(chapterRights),
      presetId,
      preset: { ...(descriptor.preset || {}), ...(input.preset || {}) },
      revision,
      pageRange: range,
      pageCount: range.pageCount,
      sceneCount,
      parts: splitChapterParts(sceneCount, range.pageCount),
      status,
      statusReason: !allowed ? chapterRights.reasons[0] : configured ? "Đang chờ Render Worker nhận job." : "Cần kết nối Render Worker trước khi chạy batch dài.",
      blocker: !allowed ? { code: chapterRights.reasonCode, missing: [] } : configured ? null : {
        code: "COMIC_MOTION_WORKER_NOT_CONFIGURED",
        missing: workerMissing()
      },
      progress: 0,
      currentStage: status,
      failedPages: [],
      checkpoints: [],
      priority: Math.max(0, Math.min(10, Number(input.priority) || 5)),
      order: results.length,
      idempotencyKey: key,
      requestId: clean(input.requestId, 160) || randomUUID(),
      workerJobId: "",
      lastError: "",
      estimatedDurationSeconds: Math.ceil(sceneCount * Math.max(2, Number(input.secondsPerScene) || 4)),
      estimatedBytes: Math.ceil(sceneCount * 1_500_000),
      estimatedCostUsd: Number(process.env.COMIC_MOTION_WORKER_USD_PER_MINUTE) > 0
        ? Math.round((sceneCount * Math.max(2, Number(input.secondsPerScene) || 4) / 60) * Number(process.env.COMIC_MOTION_WORKER_USD_PER_MINUTE) * 10000) / 10000
        : null,
      createdAt: now,
      updatedAt: now
    };
    try {
      await db.collection("comicMotionJobs").insertOne(job);
      await db.collection("comicMotionAuditEvents").insertOne({
        type: "job:created", ownerId: String(ownerId), seriesId: job.seriesId, chapterId: job.chapterId,
        provider: job.provider, jobId: job._id, batchId, status, createdAt: now, updatedAt: now
      });
      results.push({ job: publicJob(job), duplicate: false });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const raced = await db.collection("comicMotionJobs").findOne({ ownerId: String(ownerId), idempotencyKey: key });
      results.push({ job: publicJob(raced), duplicate: true });
    }
  }
  return { batchId, totalPages, jobs: results.map((entry) => entry.job), duplicates: results.filter((entry) => entry.duplicate).length, workerConfigured: configured };
}

async function listJobs(db, ownerId, query = {}) {
  await ensureJobIndexes(db);
  const filter = { ownerId: String(ownerId) };
  if (JOB_STATES.includes(query.status)) filter.status = query.status;
  if (clean(query.seriesId, 180)) filter.seriesId = clean(query.seriesId, 180);
  if (clean(query.batchId, 180)) filter.batchId = clean(query.batchId, 180);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  const jobs = await db.collection("comicMotionJobs").find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
  return jobs.map(publicJob);
}

async function getJob(db, ownerId, jobId) {
  await ensureJobIndexes(db);
  const job = await db.collection("comicMotionJobs").findOne({ _id: clean(jobId, 180), ownerId: String(ownerId) });
  if (!job) throw Object.assign(new Error("Không tìm thấy job trong tài khoản này."), { statusCode: 404, code: "COMIC_JOB_NOT_FOUND" });
  return job;
}

async function audit(db, event) {
  const now = new Date();
  await db.collection("comicMotionAuditEvents").insertOne({ ...event, createdAt: now, updatedAt: now });
}

async function updateOwnedJob(db, ownerId, jobId, action, extra = {}) {
  const current = await getJob(db, ownerId, jobId);
  const now = new Date();
  let nextStatus = current.status;
  const set = { updatedAt: now };
  if (action === "pause") {
    if (!ACTIVE_STATES.has(current.status) && current.status !== "draft") throw Object.assign(new Error("Job hiện tại không thể tạm dừng."), { statusCode: 409, code: "COMIC_JOB_TRANSITION_INVALID" });
    nextStatus = "paused";
    set.pausedFromStatus = current.status;
  } else if (action === "resume") {
    if (current.status !== "paused" && current.status !== "draft") throw Object.assign(new Error("Chỉ có thể tiếp tục job đang tạm dừng hoặc chờ worker."), { statusCode: 409, code: "COMIC_JOB_TRANSITION_INVALID" });
    if (!workerConfigured()) throw Object.assign(new Error(`Render Worker chưa kết nối. Thiếu: ${workerMissing().join(", ")}.`), { statusCode: 503, code: "COMIC_MOTION_WORKER_NOT_CONFIGURED" });
    nextStatus = "queued";
    set.statusReason = "Đã đưa lại vào hàng đợi worker từ checkpoint gần nhất.";
    set.blocker = null;
  } else if (action === "retry") {
    if (!["failed", "paused", "draft"].includes(current.status)) throw Object.assign(new Error("Job hiện tại chưa ở trạng thái có thể thử lại."), { statusCode: 409, code: "COMIC_JOB_TRANSITION_INVALID" });
    if (!workerConfigured()) throw Object.assign(new Error("Render Worker chưa kết nối."), { statusCode: 503, code: "COMIC_MOTION_WORKER_NOT_CONFIGURED" });
    nextStatus = "retrying";
    set.lastError = "";
    set.retryFromCheckpoint = clean(extra.checkpoint || current.checkpoints?.at(-1)?.stage || "rights-check", 80);
    if (Number.isInteger(Number(extra.pageIndex))) {
      const pageIndex = Number(extra.pageIndex);
      set.retryPageIndex = pageIndex;
      set.failedPages = (current.failedPages || []).filter((page) => Number(page.index) !== pageIndex);
    }
  } else if (action === "cancel") {
    if (TERMINAL_STATES.has(current.status)) throw Object.assign(new Error("Job đã kết thúc và không thể hủy lại."), { statusCode: 409, code: "COMIC_JOB_TRANSITION_INVALID" });
    nextStatus = "cancelled";
    set.cancelledAt = now;
  } else {
    throw Object.assign(new Error("Thao tác job không hợp lệ."), { statusCode: 400, code: "COMIC_JOB_ACTION_INVALID" });
  }
  set.status = nextStatus;
  set.currentStage = nextStatus;
  const job = await db.collection("comicMotionJobs").findOneAndUpdate(
    { _id: current._id, ownerId: String(ownerId), status: current.status },
    { $set: set },
    { returnDocument: "after" }
  );
  if (!job) throw Object.assign(new Error("Job vừa thay đổi; hãy tải lại trạng thái."), { statusCode: 409, code: "COMIC_JOB_CONCURRENT_UPDATE" });
  await audit(db, { type: `job:${action}`, ownerId: String(ownerId), jobId: current._id, seriesId: current.seriesId, chapterId: current.chapterId, provider: current.provider, status: nextStatus });
  return publicJob(job);
}

async function deleteJob(db, ownerId, jobId) {
  const current = await getJob(db, ownerId, jobId);
  if (!TERMINAL_STATES.has(current.status)) throw Object.assign(new Error("Chỉ xóa job đã kết thúc, lỗi, hủy hoặc bị chặn quyền."), { statusCode: 409, code: "COMIC_JOB_DELETE_ACTIVE" });
  await db.collection("comicMotionJobs").deleteOne({ _id: current._id, ownerId: String(ownerId) });
  await audit(db, { type: "job:deleted", ownerId: String(ownerId), jobId: current._id, seriesId: current.seriesId, chapterId: current.chapterId, provider: current.provider, status: current.status });
  return { ok: true, id: String(current._id) };
}

function slug(value) {
  return clean(value, 180).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "comic";
}

function buildLicensePackFiles(job, artifacts = []) {
  const rights = job.rights || {};
  const chapterNumber = String(job.chapter?.number || "001").padStart(3, "0");
  const root = `${slug(job.series?.title)}/chapter-${slug(chapterNumber)}/`;
  const safeArtifacts = artifacts.map((artifact) => ({ id: String(artifact._id || artifact.id || ""), type: clean(artifact.type, 80), filename: clean(artifact.filename, 240), checksum: clean(artifact.checksum, 80), createdAt: artifact.createdAt }));
  const sourceManifest = {
    schemaVersion: 1,
    pipelineVersion: "comic-motion-batch-v1",
    jobId: String(job._id || job.id || ""),
    projectRevision: job.revision,
    series: job.series,
    chapter: job.chapter,
    provider: job.provider,
    pageRange: job.pageRange,
    pageChecksums: Array.isArray(job.pageChecksums) ? job.pageChecksums : [],
    resolvedAt: job.checkpoints?.find((checkpoint) => checkpoint.stage === "resolving")?.completedAt || null,
    rights,
    attribution: rights.attributionText || "",
    artifacts: safeArtifacts
  };
  const licenses = { schemaVersion: 1, jobId: sourceManifest.jobId, license: rights, shareAlikeRequired: Boolean(rights.shareAlikeRequired) };
  const credits = [
    `Tác phẩm: ${job.series?.title || ""}`,
    `Chương: ${job.chapter?.number || ""} ${job.chapter?.title || ""}`.trim(),
    `Tác giả: ${rights.author || job.series?.author || "Chưa xác định"}`,
    `Họa sĩ: ${rights.artist || job.series?.artist || "Chưa xác định"}`,
    rights.translator ? `Dịch giả: ${rights.translator}` : "",
    rights.scanlationGroup ? `Nhóm dịch: ${rights.scanlationGroup}` : "",
    `Nguồn: ${rights.sourceUrl || job.series?.sourceUrl || ""}`,
    `Giấy phép: ${rights.licenseCode || "UNKNOWN"} ${rights.licenseUrl || ""}`.trim(),
    rights.attributionText ? `Ghi công: ${rights.attributionText}` : ""
  ].filter(Boolean).join("\n");
  const checksumLines = safeArtifacts.filter((artifact) => artifact.checksum && artifact.filename).map((artifact) => `${artifact.checksum}  ${artifact.filename}`).join("\n");
  const title = `${job.series?.title || "Comic"} – Chương ${job.chapter?.number || ""}`.trim();
  return {
    root,
    files: {
      [`${root}CREDITS.txt`]: credits,
      [`${root}LICENSES.json`]: JSON.stringify(licenses, null, 2),
      [`${root}SOURCE-MANIFEST.json`]: JSON.stringify(sourceManifest, null, 2),
      [`${root}CHECKSUMS.sha256`]: checksumLines,
      [`${root}storyboard.json`]: JSON.stringify(job.storyboard || { status: "not-generated", scenes: [] }, null, 2),
      [`${root}youtube/title.txt`]: title,
      [`${root}youtube/description.txt`]: `${title}\n\n${rights.attributionText || credits}`,
      [`${root}youtube/tags.txt`]: (job.series?.genres || []).join(", "),
      [`${root}youtube/chapters.txt`]: job.youtubeChapters || "00:00 Mở đầu"
    }
  };
}

async function getJobArtifacts(db, ownerId, jobId) {
  const job = await getJob(db, ownerId, jobId);
  const artifacts = await db.collection("comicMotionArtifacts").find({ ownerId: String(ownerId), jobId: String(job._id), hiddenAt: null }).sort({ createdAt: -1 }).limit(100).toArray();
  await audit(db, { type: "artifact:license-pack", ownerId: String(ownerId), jobId: String(job._id), seriesId: job.seriesId, chapterId: job.chapterId, provider: job.provider, status: job.status });
  return { job: publicJob(job), artifacts: artifacts.map((artifact) => ({ ...artifact, _id: undefined, id: String(artifact._id || "") })), licensePack: buildLicensePackFiles(job, artifacts) };
}

module.exports = {
  JOB_STATES,
  TERMINAL_STATES,
  ACTIVE_STATES,
  MAX_SCENES_PER_PART,
  LIMITS,
  stableHash,
  splitChapterParts,
  normalizePageRange,
  idempotencyKey,
  publicJob,
  workerConfigured,
  workerMissing,
  ensureJobIndexes,
  createBatchJobs,
  listJobs,
  getJob,
  updateOwnedJob,
  deleteJob,
  buildLicensePackFiles,
  getJobArtifacts
};
