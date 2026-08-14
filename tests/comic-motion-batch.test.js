"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryDb } = require("./helpers/comic-motion-memory-db");
const { createBatchJobs, getJob, updateOwnedJob, splitChapterParts, buildLicensePackFiles } = require("../utils/comic-motion-jobs");

function descriptor() {
  return {
    series: { id: "series-open", title: "Long Open Comic", provider: "open-comic", sourceType: "open-comic", sourceUrl: "https://example.com/open" },
    chapters: [{ id: "chapter-long", number: "12", title: "Long", pageCount: 100, estimatedPanelCount: 241, provider: "open-comic" }],
    rights: { licenseCode: "CC0-1.0", status: "allowed", derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true, sourceUrl: "https://example.com/open" },
    preset: { id: "youtube-16x9", format: "16:9", mode: "quick-review" }
  };
}

test("long chapters split into independent <=120-scene parts and duplicate jobs are reused", async () => {
  const db = new MemoryDb();
  const first = await createBatchJobs(db, "owner-a", descriptor(), { presetId: "youtube-16x9", revision: 1 });
  assert.equal(first.jobs.length, 1);
  assert.deepEqual(first.jobs[0].parts.map((part) => part.sceneCount), [120, 120, 1]);
  assert.equal(first.jobs[0].status, "draft");
  const second = await createBatchJobs(db, "owner-a", descriptor(), { presetId: "youtube-16x9", revision: 1 });
  assert.equal(second.duplicates, 1);
  assert.equal(second.jobs[0].id, first.jobs[0].id);
  assert.deepEqual(splitChapterParts(121).map((part) => part.sceneCount), [120, 1]);
});

test("pause/resume keeps durable checkpoint state and owner isolation", async () => {
  const db = new MemoryDb();
  const created = await createBatchJobs(db, "owner-a", descriptor(), {});
  const jobId = created.jobs[0].id;
  const paused = await updateOwnedJob(db, "owner-a", jobId, "pause");
  assert.equal(paused.status, "paused");
  assert.equal(paused.pausedFromStatus, "draft");
  const previous = { url: process.env.COMIC_MOTION_WORKER_URL, token: process.env.COMIC_MOTION_WORKER_TOKEN, secret: process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET, site: process.env.PUBLIC_SITE_URL };
  process.env.COMIC_MOTION_WORKER_URL = "https://worker.example.com";
  process.env.COMIC_MOTION_WORKER_TOKEN = "t".repeat(32);
  process.env.COMIC_MOTION_WORKER_CALLBACK_SECRET = "s".repeat(32);
  process.env.PUBLIC_SITE_URL = "https://hoang8.com";
  const resumed = await updateOwnedJob(db, "owner-a", jobId, "resume");
  assert.equal(resumed.status, "queued");
  await assert.rejects(() => getJob(db, "owner-b", jobId), (error) => error.statusCode === 404);
  Object.entries(previous).forEach(([key, value]) => { const name = ({ url: "COMIC_MOTION_WORKER_URL", token: "COMIC_MOTION_WORKER_TOKEN", secret: "COMIC_MOTION_WORKER_CALLBACK_SECRET", site: "PUBLIC_SITE_URL" })[key]; if (value === undefined) delete process.env[name]; else process.env[name] = value; });
});

test("License Pack contains provenance files and never serializes secrets", async () => {
  const db = new MemoryDb();
  const created = await createBatchJobs(db, "owner-a", descriptor(), {});
  const job = await getJob(db, "owner-a", created.jobs[0].id);
  job.rights.attributionText = "Open Comic · CC0";
  const pack = buildLicensePackFiles(job, [{ id: "artifact-1", type: "video", filename: "video.webm", checksum: "a".repeat(64) }]);
  for (const required of ["CREDITS.txt", "LICENSES.json", "SOURCE-MANIFEST.json", "CHECKSUMS.sha256", "storyboard.json", "youtube/title.txt"]) {
    assert.ok(Object.keys(pack.files).some((name) => name.endsWith(required)), required);
  }
  const serialized = JSON.stringify(pack);
  assert.doesNotMatch(serialized, /COMIC_MOTION_WORKER_TOKEN|Authorization|signedUrl|cookie/i);
});
