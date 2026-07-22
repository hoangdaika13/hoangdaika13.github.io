const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "media-production-workflow.js"), "utf8");
const css = fs.readFileSync(path.join(root, "media-production-workflow.css"), "utf8");
const page = fs.readFileSync(path.join(root, "media-design-page.js"), "utf8");
const media = require(path.join(root, "media-production-workflow.js"));

test("publishes a versioned hh.* state contract and bounds persisted state", () => {
  assert.equal(media.SCHEMA, "hh.media-production.v1");
  assert.equal(media.STATE_KEY, "hh.media-production.v1");
  assert.equal(media.TIMELINE_SCHEMA, "hh.media-timeline.v1");
  assert.equal(media.VERSION, 1);
  assert.equal(globalThis.HHMediaProductionWorkflow, media);

  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = media.createStateStore(storage);
  const state = store.save({ activePanel: "review", reviews: [{ timecode: "00:00:01:00", author: "<Admin>", text: "<img onerror=1>" }] });
  assert.equal(state.activePanel, "review");
  assert.equal(JSON.parse(values.get(media.STATE_KEY)).schema, media.SCHEMA);
  assert.equal(store.load().reviews[0].text, "<img onerror=1>");
  assert.equal(media.escapeHtml(store.load().reviews[0].text), "&lt;img onerror=1&gt;");
  assert.equal(media.normalizeState({ reviews: [{ timecode: "bad", text: "Recovered" }] }).reviews[0].timecode, "00:00:00:00");
});

test("timecode parsing is frame-aware and rejects malformed review positions", () => {
  assert.equal(media.timecodeToSeconds("00:01:02:15", 30), 62.5);
  assert.equal(media.secondsToTimecode(62.5, 30), "00:01:02:15");
  assert.throws(() => media.timecodeToSeconds("00:61:00:00", 30), /giới hạn/);
  assert.throws(() => media.timecodeToSeconds("javascript:alert(1)", 30), /HH:MM:SS:FF/);
});

test("timeline edits stay non-destructive and preserve source asset references", () => {
  let timeline = media.normalizeTimeline({ id: "cut", fps: 30 });
  timeline = media.applyTimelineEdit(timeline, { type: "add-clip", clip: { id: "hero", assetId: "master-video", name: "Master.mov", sourceIn: 10, sourceOut: 30, start: 2 } });
  assert.equal(timeline.revision, 2);
  assert.equal(timeline.clips[0].assetId, "master-video");

  timeline = media.applyTimelineEdit(timeline, { type: "trim", clipId: "hero", sourceIn: 12, sourceOut: 28 });
  assert.equal(timeline.clips[0].assetId, "master-video");
  assert.equal(timeline.clips[0].sourceIn, 12);
  assert.match(timeline.history.at(-1).detail, /media nguồn không đổi/);

  timeline = media.applyTimelineEdit(timeline, { type: "split", clipId: "hero", at: 10 });
  assert.equal(timeline.clips.length, 2);
  assert.ok(timeline.clips.every((clip) => clip.assetId === "master-video"));
  assert.equal(timeline.clips[0].sourceOut, timeline.clips[1].sourceIn);

  timeline = media.applyTimelineEdit(timeline, { type: "effect", clipId: timeline.clips[1].id, effect: { type: "color", params: { exposure: 0.2 } } });
  assert.equal(timeline.clips[1].effects[0].type, "color");
  assert.equal(timeline.clips[1].assetId, "master-video");
});

test("timeline versions snapshot review state and restore as a new revision", () => {
  let state = media.normalizeState({
    timeline: { id: "cut", revision: 4, clips: [{ id: "hero", assetId: "master", sourceIn: 0, sourceOut: 12 }] },
    reviews: [{ timecode: "00:00:02:00", author: "QA", text: "Giữ nhịp này" }]
  });
  state = media.createTimelineVersion(state, { id: "approved-cut", label: "Bản duyệt nội bộ", note: "Trước khi đổi hook" });
  assert.equal(state.versions.length, 1);
  assert.equal(state.versions[0].timeline.revision, 4);
  assert.equal(state.versions[0].reviews[0].text, "Giữ nhịp này");

  state.timeline = media.applyTimelineEdit(state.timeline, { type: "trim", clipId: "hero", sourceIn: 2, sourceOut: 8 });
  state.reviews = [];
  const restored = media.restoreTimelineVersion(state, "approved-cut");
  assert.equal(restored.timeline.revision, 6);
  assert.equal(restored.timeline.clips[0].sourceIn, 0);
  assert.equal(restored.reviews[0].text, "Giữ nhịp này");
  assert.equal(restored.versions.length, 1);
  assert.match(restored.timeline.history.at(-1).detail, /khôi phục/i);
  assert.throws(() => media.restoreTimelineVersion(restored, "missing"), /phiên bản/i);
});

test("proxy jobs never claim success without an output Blob", async () => {
  const asset = { id: "video", name: "master.mp4", blob: new Blob(["source"], { type: "video/mp4" }) };
  const unavailable = await media.runProxyJob(asset, null);
  assert.equal(unavailable.status, "needs-adapter");
  assert.match(unavailable.message, /Chưa có tệp proxy nào/);

  const invalid = await media.runProxyJob(asset, { async proxyVideo() { return { status: "ok" }; } });
  assert.equal(invalid.status, "failed");

  const completed = await media.runProxyJob(asset, { async proxyVideo() { return new Blob(["proxy"], { type: "video/webm" }); } });
  assert.equal(completed.status, "completed");
  assert.equal(await completed.output.text(), "proxy");
});

test("transcription uses an explicit adapter and exports real segments as WebVTT", async () => {
  const asset = { id: "audio", name: "voice.wav", blob: new Blob(["wave"], { type: "audio/wav" }) };
  const unavailable = await media.runTranscriptionJob(asset, null, { language: "vi", fps: 30 });
  assert.equal(unavailable.status, "needs-adapter");
  assert.match(unavailable.message, /Không tạo phụ đề giả/);

  const completed = await media.runTranscriptionJob(asset, {
    async transcribe() { return { segments: [{ start: 0.5, end: 2, text: "Xin chào", confidence: 0.94 }] }; }
  }, { language: "vi", fps: 30 });
  assert.equal(completed.status, "completed");
  assert.equal(completed.segments.length, 1);
  assert.match(media.toWebVtt(completed.segments), /00:00:00\.500 --> 00:00:02\.000/);
  assert.match(media.toWebVtt(completed.segments), /Xin chào/);
});

test("batch image jobs distinguish real output, unsupported capability and adapter failure", async () => {
  const file = new Blob(["pixels"], { type: "image/png" });
  Object.defineProperty(file, "name", { value: "hero.png" });
  const completed = await media.runImageBatch([file], { operation: "resize", width: 640, height: 640 }, {
    async transformImage() { return new Blob(["webp-output"], { type: "image/webp" }); }
  });
  assert.equal(completed[0].status, "completed");
  assert.equal(await completed[0].output.text(), "webp-output");

  const unsupported = await media.runImageBatch([file], { operation: "resize" }, null, {});
  assert.equal(unsupported[0].status, "unsupported");

  const failed = await media.runImageBatch([file], {}, { async transformImage() { throw new Error("encoder crash"); } });
  assert.equal(failed[0].status, "failed");
  assert.match(failed[0].message, /encoder crash/);
});

test("server render adapter mirrors remote states and requires output URL for completion", async () => {
  const requests = [];
  const responses = [
    { id: "remote-1", status: "queued", progress: 0.1 },
    { id: "remote-1", status: "running", progress: 0.6 },
    { id: "remote-1", status: "completed", progress: 1, outputUrl: "https://cdn.example.test/render.webm" }
  ];
  const adapter = media.createServerRenderAdapter({
    endpoint: "https://render.example.test/api",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const body = responses.shift();
      return { ok: true, status: 200, async json() { return body; } };
    }
  });
  let job = await media.enqueueRenderJob(adapter, { projectId: "project", name: "Launch", preset: "web-1080p", timeline: {} });
  assert.equal(job.status, "queued");
  assert.equal(job.remoteId, "remote-1");
  job = await media.refreshRenderJob(adapter, job);
  assert.equal(job.status, "running");
  job = await media.refreshRenderJob(adapter, job);
  assert.equal(job.status, "completed");
  assert.equal(job.outputUrl, "https://cdn.example.test/render.webm");
  assert.equal(requests[0].init.method, "POST");
  assert.match(requests[0].init.body, /hh\.media-production\.v1/);
  assert.throws(() => media.createServerRenderAdapter({ endpoint: "http://render.example.test", fetchImpl() {} }), /HTTPS/);

  const dishonest = media.createServerRenderAdapter({ endpoint: "https://render.example.test", fetchImpl: async () => ({ ok: true, status: 200, async json() { return { id: "x", status: "completed" }; } }) });
  const rejected = await media.enqueueRenderJob(dishonest, { timeline: {} });
  assert.equal(rejected.status, "failed");
  assert.match(rejected.message, /thiếu output URL/);

  const cancelAdapter = media.createServerRenderAdapter({ endpoint: "https://render.example.test", fetchImpl: async () => ({ ok: true, status: 200, async json() { return { id: "remote-2", status: "canceled", message: "Stopped" }; } }) });
  const canceled = await media.cancelRenderJob(cancelAdapter, { id: "local", remoteId: "remote-2", status: "running" });
  assert.equal(canceled.status, "canceled");
  assert.equal(canceled.message, "Stopped");

  const unsafeOutput = media.createServerRenderAdapter({ endpoint: "https://render.example.test", fetchImpl: async () => ({ ok: true, status: 200, async json() { return { id: "x", status: "completed", outputUrl: "javascript:alert(1)" }; } }) });
  const unsafeRejected = await media.enqueueRenderJob(unsafeOutput, { timeline: {} });
  assert.equal(unsafeRejected.status, "failed");
});

test("Media & Design integration exposes the workflow with accessible responsive UI", () => {
  assert.match(page, /id: "production-workflow"/);
  assert.match(page, /HHMediaProductionWorkflow\?\.mount/);
  assert.match(page, /HHMediaProductionWorkflow\?\.unmount/);
  for (const token of ["Media Bin dùng chung", "Timeline không phá hủy", "Transcription & subtitle", "Review theo khung hình", "Render queue phía máy chủ", "Lịch sử phiên bản timeline", "data-hmpw-create-version", "data-hmpw-restore-version", "role=\"tab\"", "aria-live=\"polite\""]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /grid-template-columns: 1fr/);
});
