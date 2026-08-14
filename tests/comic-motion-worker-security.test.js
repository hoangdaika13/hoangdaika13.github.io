"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryDb } = require("./helpers/comic-motion-memory-db");
const { signRequest, verifySignedCallback, assertOutputUrl, workerHealth, manifestToken, verifyManifestToken, canWorkerTransition } = require("../utils/comic-motion-worker");

function withEnv(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve().then(run).finally(() => Object.entries(previous).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
}

test("signed callback accepts one fresh nonce and rejects replay or bad signature", async () => withEnv({
  COMIC_MOTION_WORKER_CALLBACK_SECRET: "s".repeat(40)
}, async () => {
  const db = new MemoryDb();
  const body = { action: "worker-job-callback", jobId: "job-1", status: "rendering", progress: 40 };
  const timestamp = Date.now();
  const nonce = "n".repeat(32);
  const path = "/api/modules/comic-motion/actions";
  const signature = signRequest({ method: "POST", path, timestamp, nonce, body });
  const req = { method: "POST", url: path, headers: { "x-hh-timestamp": String(timestamp), "x-hh-nonce": nonce, "x-hh-signature": signature } };
  await verifySignedCallback(db, req, body);
  await assert.rejects(() => verifySignedCallback(db, req, body), (error) => error.code === "WORKER_NONCE_REPLAY");
  const bad = { ...req, headers: { ...req.headers, "x-hh-nonce": "x".repeat(32), "x-hh-signature": "0".repeat(64) } };
  await assert.rejects(() => verifySignedCallback(db, bad, body), (error) => error.code === "WORKER_SIGNATURE_INVALID");
}));

test("worker artifacts are HTTPS and limited to configured output hosts", async () => withEnv({
  COMIC_MOTION_WORKER_URL: "https://render.example.com/api",
  COMIC_MOTION_WORKER_OUTPUT_HOSTS: "cdn.example.com"
}, async () => {
  assert.equal(assertOutputUrl("https://cdn.example.com/jobs/video.webm"), "https://cdn.example.com/jobs/video.webm");
  assert.equal(assertOutputUrl("https://render.example.com/output/video.webm"), "https://render.example.com/output/video.webm");
  assert.throws(() => assertOutputUrl("https://evil.example.net/video.webm"), (error) => error.code === "WORKER_OUTPUT_HOST_BLOCKED");
  assert.throws(() => assertOutputUrl("http://cdn.example.com/video.webm"), (error) => error.code === "WORKER_OUTPUT_HOST_BLOCKED");
}));

test("manifest token expires and missing worker is reported honestly", async () => withEnv({
  COMIC_MOTION_WORKER_CALLBACK_SECRET: "m".repeat(40)
}, async () => {
  const token = manifestToken("job-123", Date.now() + 5000, "nonce-manifest-1234567890");
  assert.equal(verifyManifestToken(token).jobId, "job-123");
  const expired = manifestToken("job-old", Date.now() - 1, "nonce-manifest-old-123456");
  assert.throws(() => verifyManifestToken(expired), (error) => error.code === "WORKER_MANIFEST_TOKEN_EXPIRED");
  const health = await workerHealth({});
  assert.equal(health.connected, false);
  assert.equal(health.status, "Chưa kết nối");
  assert.ok(health.missing.includes("COMIC_MOTION_WORKER_URL"));
}));

test("worker cannot move a completed job backwards or skip arbitrary stages", () => {
  assert.equal(canWorkerTransition("queued", "resolving"), true);
  assert.equal(canWorkerTransition("rendering", "completed"), true);
  assert.equal(canWorkerTransition("completed", "rendering"), false);
  assert.equal(canWorkerTransition("queued", "completed"), false);
});
