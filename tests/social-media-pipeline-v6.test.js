"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const pipeline = require("../social-media-pipeline.js");

const SHA_A = "a".repeat(64);
const FIXED_DATE = "2026-08-13T10:00:00.000Z";
const clock = () => new Date(FIXED_DATE);

function imageMeta(overrides = {}) {
  return { kind: "image", width: 2400, height: 1600, mimeType: "image/jpeg", size: 4_000_000, ...overrides };
}

function videoAsset(overrides = {}) {
  return { id: "asset-video", name: "launch.mp4", sha256: SHA_A, mimeType: "video/mp4", size: 200 * 1024 * 1024, ...overrides };
}

function confirmedAsset(overrides = {}) {
  return {
    id: "asset-image",
    name: "campaign.jpg",
    sha256: SHA_A,
    mimeType: "image/jpeg",
    size: 4_000_000,
    sourceType: "user-upload",
    rightsConfirmed: true,
    commercialUseConfirmed: true,
    thirdPartyElementsReviewed: true,
    rightsConfirmedAt: FIXED_DATE,
    rightsEvidence: [{ type: "contract", url: "https://example.test/rights/1" }],
    ...overrides
  };
}

test("V6 exposes rich platform targets and validates MIME/size before browser work", () => {
  assert.equal(pipeline.SCHEMA_VERSION, 6);
  assert.ok(pipeline.TARGETS.length >= 10);
  assert.ok(pipeline.TARGETS.every((target) => target.platform && target.width && target.height && target.safeArea));

  const valid = pipeline.validateMediaFile({ name: "photo.jpg", type: "image/jpeg", size: 1000 });
  assert.equal(valid.valid, true);
  assert.equal(valid.kind, "image");

  const unsupported = pipeline.validateMediaFile({ name: "vector.svg", type: "image/svg+xml", size: 1000 });
  assert.equal(unsupported.valid, true);

  const document = pipeline.validateMediaFile({ name: "captions.csv", type: "text/csv", size: 1000 });
  assert.equal(document.valid, true);
  assert.equal(document.kind, "document");

  const executable = pipeline.validateMediaFile({ name: "unsafe.exe", type: "application/x-msdownload", size: 1000 });
  assert.equal(executable.valid, false);
  assert.ok(executable.errors.some((issue) => issue.code === "mime-unsupported"));

  const largeVideo = pipeline.validateMediaFile({ name: "movie.mp4", type: "video/mp4; codecs=avc1.640028,mp4a.40.2", size: 80 * 1024 * 1024 });
  assert.equal(largeVideo.offloadRequired, true);
  assert.deepEqual(largeVideo.codecs, ["avc1.640028", "mp4a.40.2"]);
  assert.ok(largeVideo.warnings.some((issue) => issue.code === "worker-required"));
});

test("metadata normalization reports dimensions, orientation, codec and missing probe fields honestly", () => {
  const meta = pipeline.normalizeMediaMetadata({ kind: "video", width: 1920, height: 1080, duration: 10.1256, fps: 29.97, mimeType: "video/mp4; codecs=avc1", size: 9000 });
  assert.equal(meta.orientation, "landscape");
  assert.equal(meta.ratio, 1.7778);
  assert.equal(meta.duration, 10.126);
  assert.equal(meta.frameCountEstimate, 303);
  assert.deepEqual(meta.codecs, ["avc1"]);
  assert.equal(meta.probeRequired, false);

  const incomplete = pipeline.normalizeMediaMetadata({ kind: "video", width: 1080, height: 1920, duration: 4, mimeType: "video/mp4" });
  const issues = pipeline.metadataIssues(incomplete);
  assert.equal(incomplete.probeRequired, true);
  assert.ok(issues.some((issue) => issue.code === "fps-probe-required"));
  assert.ok(issues.some((issue) => issue.code === "codec-probe-required"));
});

test("crop and resize planning supports normalized crop, focal cover, contain and offsets", () => {
  const crop = pipeline.normalizeCrop({ unit: "normalized", x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, 2000, 1000);
  assert.deepEqual(crop, { x: 200, y: 200, width: 1000, height: 500, unit: "pixel" });

  const cover = pipeline.calculateDrawPlan({ width: 2000, height: 1000 }, "instagram-post", { fit: "cover", focalX: 1 });
  assert.equal(cover.source.height, 1000);
  assert.equal(cover.source.width, 800);
  assert.equal(cover.source.x, 1200);
  assert.deepEqual(cover.destination, { x: 0, y: 0, width: 1080, height: 1350 });

  const contain = pipeline.calculateDrawPlan({ width: 2000, height: 1000 }, "instagram-post", { fit: "contain", offsetX: 10 });
  assert.equal(contain.destination.width, 1080);
  assert.equal(contain.destination.height, 540);
  assert.equal(contain.destination.x, 10);
  assert.equal(contain.destination.y, 405);
});

test("batch variant plan de-duplicates targets and carries output/safe-zone instructions", () => {
  const targets = [pipeline.TARGETS[0], pipeline.TARGETS[0], pipeline.TARGETS[2]];
  const plan = pipeline.buildBatchVariantPlan(imageMeta(), targets, { type: "image/webp", quality: 0.8, focalY: 0.25 });
  assert.equal(plan.variants.length, 2);
  assert.equal(plan.options.quality, 0.8);
  assert.ok(plan.totalPixels > 0);
  assert.ok(plan.variants.every((item) => item.output.extension === "webp" && item.safeZone.width > 0 && item.draw.source.width > 0));
});

test("safe-zone validation identifies every overflowing edge", () => {
  const target = pipeline.TARGETS.find((item) => item.id === "tiktok");
  const zone = pipeline.safeZone(target);
  assert.deepEqual({ top: zone.top, right: zone.right, bottom: zone.bottom, left: zone.left }, { top: 120, right: 80, bottom: 260, left: 80 });

  const valid = pipeline.validateSafeZone({ x: zone.x, y: zone.y, width: zone.width, height: zone.height }, target);
  assert.equal(valid.valid, true);
  const invalid = pipeline.validateSafeZone({ unit: "normalized", x: 0, y: 0, width: 1, height: 1 }, target);
  assert.deepEqual(invalid.violations, ["left", "top", "right", "bottom"]);
});

test("compression helpers report actual saving without overclaiming larger output", () => {
  assert.deepEqual(pipeline.estimateCompression(1000, 600), { inputBytes: 1000, outputBytes: 600, savedBytes: 400, ratio: 0.6, savingPercent: 40 });
  assert.deepEqual(pipeline.estimateCompression(1000, 1200), { inputBytes: 1000, outputBytes: 1200, savedBytes: 0, ratio: 1.2, savingPercent: 0 });
  const options = pipeline.normalizeVariantOptions({ type: "image/webp", quality: 5, fit: "invalid" });
  assert.equal(options.quality, 1);
  assert.equal(options.fit, "cover");
});

test("SHA-256 and dedup helpers detect checksum duplicates deterministically", async () => {
  assert.equal(await pipeline.checksumSha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const first = { id: "a", name: "A.JPG", size: 100, mimeType: "image/jpeg", sha256: SHA_A };
  const duplicate = { id: "b", name: "copy.jpg", size: 100, mimeType: "image/jpeg", sha256: SHA_A.toUpperCase() };
  const unique = { id: "c", name: "other.jpg", size: 100, mimeType: "image/jpeg", sha256: "b".repeat(64) };
  assert.equal(pipeline.findDuplicateAsset([first], duplicate), first);
  const result = pipeline.deduplicateAssets([first, duplicate, unique]);
  assert.deepEqual(result.unique.map((item) => item.id), ["a", "c"]);
  assert.equal(result.duplicates[0].duplicateOf.id, "a");
});

test("rights manifest requires ownership, commercial permission and third-party review", () => {
  const validManifest = pipeline.rightsManifest(confirmedAsset(), imageMeta(), "owner-1", "workspace-1", { clock });
  assert.equal(validManifest.confirmedAt, FIXED_DATE);
  assert.equal(validManifest.schemaVersion, 6);
  assert.equal(pipeline.validateRightsManifest(validManifest).valid, true);
  assert.equal(pipeline.assertRightsManifest(validManifest), validManifest);

  const invalidManifest = pipeline.rightsManifest(confirmedAsset({ commercialUseConfirmed: false, thirdPartyElementsReviewed: false }), imageMeta(), "owner-1", "workspace-1", { clock });
  const validation = pipeline.validateRightsManifest(invalidManifest);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((issue) => issue.code === "commercial-use-unconfirmed"));
  assert.ok(validation.errors.some((issue) => issue.code === "third-party-review-required"));
  assert.throws(() => pipeline.assertRightsManifest(invalidManifest), { code: "RIGHTS_MANIFEST_INVALID" });
});

test("large video is always handed to a dedicated worker and explicitly blocked on Vercel", () => {
  const asset = videoAsset();
  const meta = { kind: "video", width: 3840, height: 2160, duration: 180, mimeType: "video/mp4", size: asset.size };
  const decision = pipeline.offloadDecision(asset, meta, { operation: "transcode" });
  assert.equal(decision.required, true);
  assert.ok(decision.reasons.includes("video-size"));
  assert.ok(decision.reasons.includes("video-duration"));
  assert.ok(decision.reasons.includes("video-resolution"));
  assert.equal(pipeline.shouldOffload(asset, meta, { operation: "transcode" }), true);

  const job = pipeline.createMediaJob({ asset, metadata: meta, clock });
  const handoff = pipeline.createWorkerHandoff(job, { clock, sourceUrl: "https://object-storage.test/signed-source" });
  assert.equal(handoff.mode, "dedicated-media-worker");
  assert.equal(handoff.constraints.allowVercelExecution, false);
  assert.equal(handoff.security.secretsInPayload, false);
  assert.match(handoff.note, /Không truyền video lớn xuyên request Vercel/);
  assert.throws(() => pipeline.assertWorkerEnvironment(job, { VERCEL: "1" }), { code: "VERCEL_MEDIA_PROCESSING_BLOCKED" });
  assert.equal(pipeline.assertWorkerEnvironment(job, { runtime: "dedicated-worker" }), true);
});

test("media job state machine supports progress, pause/resume, failure and bounded retry", () => {
  let job = pipeline.createMediaJob({ asset: videoAsset(), metadata: { kind: "video", width: 1920, height: 1080, duration: 60, mimeType: "video/mp4", size: 200 * 1024 * 1024 }, maxAttempts: 1, clock });
  job = pipeline.transitionMediaJob(job, "handoff", { clock });
  job = pipeline.transitionMediaJob(job, "upload", { clock });
  job = pipeline.transitionMediaJob(job, "progress", { progress: 35, clock });
  job = pipeline.pauseMediaJob(job, { clock });
  assert.equal(job.status, pipeline.JOB_STATUS.PAUSED);
  assert.equal(job.resumeFrom, pipeline.JOB_STATUS.UPLOADING);
  job = pipeline.resumeMediaJob(job, { clock });
  assert.equal(job.status, pipeline.JOB_STATUS.UPLOADING);
  job = pipeline.transitionMediaJob(job, "start", { clock });
  job = pipeline.transitionMediaJob(job, "fail", { code: "FFMPEG_EXIT", message: "worker exit", clock });
  assert.equal(job.error.retryable, true);
  job = pipeline.retryMediaJob(job, { clock });
  assert.equal(job.status, pipeline.JOB_STATUS.RETRYING);
  assert.equal(job.attempt, 1);
  job = pipeline.transitionMediaJob(job, "start", { clock });
  job = pipeline.transitionMediaJob(job, "complete", { clock });
  assert.equal(job.status, pipeline.JOB_STATUS.COMPLETED);
  assert.equal(job.progress, 100);
  assert.throws(() => pipeline.pauseMediaJob(job, { clock }), /không hợp lệ/);

  let exhausted = pipeline.createMediaJob({ asset: videoAsset(), metadata: { kind: "video", width: 1, height: 1, duration: 1, mimeType: "video/mp4" }, maxAttempts: 1, clock });
  exhausted = pipeline.transitionMediaJob(exhausted, "fail", { clock });
  exhausted = pipeline.retryMediaJob(exhausted, { clock });
  exhausted = pipeline.transitionMediaJob(exhausted, "fail", { clock });
  assert.throws(() => pipeline.retryMediaJob(exhausted, { clock }), { code: "MEDIA_JOB_RETRY_EXHAUSTED" });
});

test("memory checkpoint adapter supports create, monotonic update and isolated resume", async () => {
  const storage = pipeline.createMemoryCheckpointStore();
  const asset = confirmedAsset();
  const created = await pipeline.createCheckpoint({ asset, meta: imageMeta(), ownerId: "owner-1", workspaceId: "workspace-1", storage, clock });
  assert.equal(created.state, "ready");
  assert.equal(created.progress, 15);
  assert.equal(created.workerHandoff, null);

  const updated = await pipeline.updateCheckpoint(created.id, { progress: 70, state: "paused", resumeState: "generating-variants" }, { storage, ownerId: "owner-1", workspaceId: "workspace-1", clock });
  assert.equal(updated.progress, 70);
  const cannotGoBack = await pipeline.updateCheckpoint(created.id, { progress: 10 }, { storage, ownerId: "owner-1", workspaceId: "workspace-1", clock });
  assert.equal(cannotGoBack.progress, 70);

  const resumed = await pipeline.resumeCheckpoint(created.id, { storage, ownerId: "owner-1", workspaceId: "workspace-1", clock });
  assert.equal(resumed.state, "generating-variants");
  assert.equal(resumed.resumeCount, 1);
  await assert.rejects(() => pipeline.resumeCheckpoint(created.id, { storage, ownerId: "other-owner", workspaceId: "workspace-1", clock }), /không thuộc owner/);
  assert.equal((await storage.list({ ownerId: "owner-1", workspaceId: "workspace-1" })).length, 1);
});

test("pipeline plan includes every production gate and refuses unconfirmed rights", () => {
  const ready = pipeline.buildMediaPipelinePlan({ asset: confirmedAsset(), metadata: imageMeta(), ownerId: "owner-1", workspaceId: "workspace-1" });
  assert.equal(ready.ready, true);
  assert.ok(ready.phases.includes("webp-compression"));
  assert.ok(ready.phases.includes("export-or-queue"));

  const video = pipeline.buildMediaPipelinePlan({ asset: videoAsset({ rightsConfirmed: false }), metadata: { kind: "video", width: 1920, height: 1080, duration: 30, mimeType: "video/mp4", size: 200 * 1024 * 1024 }, ownerId: "owner-1", workspaceId: "workspace-1" });
  assert.equal(video.ready, false);
  assert.ok(video.phases.includes("poster-frame"));
  assert.ok(video.phases.includes("worker-transcode"));
  assert.ok(video.phases.includes("await-rights-confirmation"));
  assert.equal(video.execution.mode, "dedicated-media-worker");
});

test("DOM-dependent operations fail with an explicit capability code in Node", async () => {
  const documentMeta = await pipeline.inspectFile(new Blob(["caption,platform\nHello,Instagram"], { type: "text/csv" }));
  assert.equal(documentMeta.kind, "document");
  assert.equal(documentMeta.mimeType, "text/csv");
  await assert.rejects(() => pipeline.inspectImage({ type: "image/jpeg", size: 1 }), { code: "UNSUPPORTED_BROWSER_CAPABILITY" });
  await assert.rejects(() => pipeline.posterFrame({ type: "video/mp4", size: 1 }), { code: "UNSUPPORTED_BROWSER_CAPABILITY" });
});
