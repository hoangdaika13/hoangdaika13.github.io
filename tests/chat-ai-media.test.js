"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { ObjectId } = require("mongodb");
const media = require("../chat-ai-media"), chat = require("../chat-ai-hub"), core = require("../utils/chat-ai-media");
const root = path.resolve(__dirname, ".."), read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVOUAAAAASUVORK5CYII=";
const body = () => ({ input: "Một góc học tập ấm áp", aspectRatio: "16:9", imageSize: "1K", acceptedCost: true, idempotencyKey: "test-request-unique-one" });
function fixture() {
  const rows = [], indexes = [], limits = []; let generated = 0, rejectProvider = false;
  const matches = (row, query) => Object.entries(query).every(([key, value]) => value?.$gt ? row[key] > value.$gt : String(row[key]) === String(value));
  const collection = { rows, async createIndex(keys, options) { indexes.push({ keys, options }); }, async findOne(query) { return rows.find((row) => matches(row, query)) || null; },
    async insertOne(row) { if (rows.some((item) => String(item.userId) === String(row.userId) && item.idempotencyHash === row.idempotencyHash)) throw Object.assign(new Error("duplicate"), { code: 11000 }); row._id = new ObjectId(); rows.push(row); return { insertedId: row._id }; },
    async updateOne(query, update) { const row = rows.find((item) => matches(item, query)); if (row) Object.assign(row, update.$set); } };
  const module = { exports: {} };
  vm.runInNewContext(read("utils/chat-ai-media.js"), { module, Buffer, Date, require: (name) => name === "./platform" ? {
    clean: (value, limit = 5000) => String(value || "").trim().slice(0, limit), currentUser: async (req) => req.user,
    isAdminUser: (user) => user?.admin === true, enforceRateLimit: async (...args) => limits.push(args.slice(1)),
    withApi: (req, res, fn) => fn({ db: { collection: () => collection }, body: req.body || {} })
  } : require(name) });
  const handler = module.exports.createHandler({ providerStatus: (user) => ({ providers: { image: { configured: user?.configured !== false, model: "test-image-model" } } }),
    generateImage: async (input, options) => { generated++; assert.equal(options.singleAttempt, true); if (rejectProvider) throw new Error("secret=private-provider-detail"); return { media: { kind: "image", mimeType: "image/png", data: png, model: "test-image-model" } }; } });
  const user = { _id: new ObjectId(), admin: true };
  const req = (action, input = body(), override = {}) => ({ method: action === "image-create" ? "POST" : "GET", query: { mediaAction: action }, user, body: input, ...override });
  const res = () => ({ statusCode: 200, headers: {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, setHeader(key, value) { this.headers[key] = value; }, end(bytes) { this.bytes = bytes; } });
  return { handler, req, res, rows, indexes, limits, user, generated: () => generated, failProvider: () => { rejectProvider = true; } };
}
test("media modes are separate from file analysis and private local bytes are never restored", () => {
  assert.equal(chat.modeRequestContract("image").requiresAttachment, false); assert.equal(chat.modeRequestContract("video").actionType, "video");
  assert.equal(chat.modeRequestContract("vision").requiresAttachment, true);
  const raw = { kind: "image", jobId: "64b64b64b64b64b64b64b641", status: "completed", data: png, outputUrl: "https://private.example", token: "secret", settings: { aspectRatio: "unsafe", imageSize: "4K" } };
  const normalized = media.normalizeMedia(raw); assert.equal(normalized.settings.aspectRatio, "16:9"); assert.equal(normalized.settings.imageSize, "1K");
  assert.equal(normalized.data, undefined); assert.equal(normalized.token, undefined); assert.equal(normalized.outputUrl, undefined);
  const state = chat.normalizeState({ sessions: [{ id: "one", messages: [{ role: "assistant", text: "result", media: raw }] }] });
  assert.equal(state.sessions[0].messages[0].media.jobId, raw.jobId);
});
test("render controls/results escape prompts and backend errors", () => {
  const runtime = { state: { mode: "image" }, mediaControl: { image: { configured: true, canCreate: true }, review: { kind: "image", prompt: '<img onerror="alert(1)">', costLabel: "Not free" } } };
  assert.doesNotMatch(media.controls(runtime), /<img onerror/);
  const html = media.messageMarkup({ id: "safe-id", media: { kind: "image", status: "failed", error: "<script>alert(1)</script>" } });
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});
test("only owned proxy paths can be built; no client-generated provider URLs", () => {
  const value = media.normalizeMedia({ kind: "video", jobId: "64b64b64b64b64b64b64b641", status: "completed" });
  assert.match(media.jobPath(value, true), /^\/api\/ai-video-remake\?action=download&id=/);
  assert.equal(media.normalizeMedia({ kind: "video", jobId: "https://evil.example" }).jobId, "");
  assert.equal(media.jobPath({ kind: "video", jobId: "", requestKey: "test-safe-key" }), "");
});
test("video requests have fixed server-known options, one variant and no authorization overrides", () => {
  const request = media.videoRequest("prompt", { aspectRatio: "file:", resolution: "8K", durationSeconds: 1000, apiKey: "private" });
  assert.equal(request.mode, "text-to-video"); assert.equal(request.variants, 1); assert.equal(request.resolution, "720p"); assert.equal(request.durationSeconds, 8);
  assert.equal(request.apiKey, undefined);
});
test("references require actual raster signatures, bounded input and rights acknowledgement", () => {
  const reference = { mimeType: "image/png", data: png };
  assert.throws(() => core.normalizeInput({ ...body(), referenceImages: [reference] }), /quyền sử dụng/);
  assert.equal(core.normalizeInput({ ...body(), referenceImages: [reference], rightsAttested: true }).referenceImages.length, 1);
  for (const data of ["<html>", Buffer.from("<html>bad</html>").toString("base64"), "x".repeat(2_100_004)]) assert.throws(() => core.normalizeInput({ ...body(), referenceImages: [{ mimeType: "image/png", data }], rightsAttested: true }));
  assert.throws(() => core.imageBytes({ mimeType: "image/svg+xml", data: png }));
});
test("guest, denied media role, missing configuration and missing cost consent make zero provider calls", async () => {
  const fx = fixture();
  for (const override of [{ user: null }, { user: { ...fx.user, admin: false } }, { user: { ...fx.user, configured: false } }, { body: { ...body(), acceptedCost: false } }]) await assert.rejects(fx.handler(fx.req("image-create", body(), override), fx.res()));
  assert.equal(fx.generated(), 0); assert.equal(fx.rows.length, 0);
});
test("a real handler stores one owner-scoped result and replays without another paid call", async () => {
  const fx = fixture(), first = fx.res(); await fx.handler(fx.req("image-create"), first);
  assert.equal(first.body.job.status, "completed"); assert.equal(first.body.job.output.ready, true); assert.equal(fx.rows.length, 1);
  assert.equal(JSON.stringify(first.body).includes(png), false); assert.equal(first.body.job.userId, undefined);
  const again = fx.res(); await fx.handler(fx.req("image-create"), again); assert.equal(again.body.idempotentReplay, true); assert.equal(fx.generated(), 1);
  await assert.rejects(fx.handler(fx.req("image-create", { ...body(), input: "Changed prompt" }), fx.res()), (error) => error.statusCode === 409);
  assert.equal(fx.generated(), 1);
  assert.ok(fx.indexes.some((item) => item.options.unique)); assert.ok(fx.indexes.some((item) => item.options.expireAfterSeconds === 0));
  assert.ok(fx.limits.some((item) => item[0].startsWith("music-media:") && item[1] === 12));
});
test("concurrent identical image submissions invoke provider only once", async () => {
  const fx = fixture(); await Promise.all([fx.handler(fx.req("image-create"), fx.res()), fx.handler(fx.req("image-create"), fx.res())]);
  assert.equal(fx.generated(), 1); assert.equal(fx.rows.length, 1);
});
test("read/download is owner-bound, expiring, and returns nosniff raster bytes", async () => {
  const fx = fixture(); await fx.handler(fx.req("image-create"), fx.res()); const id = String(fx.rows[0]._id);
  const request = fx.req("image-download", null, { query: { mediaAction: "image-download", id } }), output = fx.res(); await fx.handler(request, output);
  assert.equal(output.headers["X-Content-Type-Options"], "nosniff"); assert.equal(output.headers["Content-Type"], "image/png"); assert.equal(output.bytes.toString("base64"), png);
  await assert.rejects(fx.handler({ ...request, user: { _id: new ObjectId() } }, fx.res()), (error) => error.statusCode === 404);
  fx.rows[0].expiresAt = new Date(0); await assert.rejects(fx.handler(request, fx.res()), (error) => error.statusCode === 404);
});
test("provider timeout remains ambiguous, sanitized and never silently regenerated", async () => {
  const fx = fixture(); fx.failProvider(); const output = fx.res(); await fx.handler(fx.req("image-create"), output);
  assert.equal(output.body.job.status, "submission-unknown"); assert.equal(output.body.job.output.ready, false); assert.doesNotMatch(JSON.stringify(output.body), /private-provider-detail/);
  await fx.handler(fx.req("image-create"), fx.res()); assert.equal(fx.generated(), 1);
});
test("media lifecycle pauses hidden polling and releases fetches/Blob URLs on unmount", () => {
  const source = read("chat-ai-media.js"), hub = read("chat-ai-hub.js");
  assert.match(source, /if \(!scope\.document\.hidden\)/); assert.match(source, /AbortSignal\.any/); assert.match(source, /clearTimeout\(state.timer\)/);
  assert.match(source, /URL\.revokeObjectURL/); assert.match(hub, /instance\.mediaControl\?\.dispose/);
  assert.match(source, /revision !== state.revision/); assert.doesNotMatch(source, /autoplay|fake.*progress|api_key=/);
});
test("direct image/video requests cannot fall through text fallback and paid quote acceptance remains explicit", () => {
  const hub = read("chat-ai-hub.js"), source = read("chat-ai-media.js"), backend = read("api/modules/[moduleId]/actions.js");
  assert.match(hub, /\["image", "video"\]\.includes\(mode.id\)/); assert.doesNotMatch(hub, /=== "image" \? "vision"/);
  assert.match(backend, /req.query.moduleId === "chat-ai" && req.query.mediaAction/);
  assert.match(source, /data-chat-media-cost/); assert.match(source, /acceptedEstimate: true/); assert.match(source, /idempotencyKey: media.requestKey/);
  assert.match(source, /if \(runtime.incognito\) throw/); assert.doesNotMatch(source, /GEMINI_API_KEY|GOOGLE_AI_API_KEY/);
});
