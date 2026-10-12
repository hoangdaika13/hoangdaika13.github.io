"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const speech = require("../services/allToolSpeech"), gateway = require("../services/toolGateway");
const env = { GEMINI_API_KEY: "test-key-not-real" };
const audio = { data: Buffer.alloc(32, 1).toString("base64"), mimeType: "audio/wav" };
test("speech capability reports actual key configuration without leaking keys", () => {
  assert.ok(speech.speechStatus({}).every(row => !row.configured));
  assert.ok(speech.speechStatus(env).every(row => row.configured && row.consentRequired && !row.secretsExposed));
  assert.doesNotMatch(JSON.stringify(speech.speechStatus(env)), /test-key/);
  assert.equal(gateway.policyFor("text-to-speech", "synthesize", "ai").provider, "tts");
  assert.throws(() => gateway.policyFor("text-to-speech", "clone", "ai"), /không được/);
});
test("speech inline files are bounded and reject arbitrary network paths and MIME types", () => {
  assert.equal(speech.normalizeAudio({ audio }).mimeType, "audio/wav");
  assert.throws(() => speech.normalizeAudio({ audio: { url: "http://127.0.0.1/secret" } }), /URL/);
  assert.throws(() => speech.normalizeAudio({ audio: { ...audio, mimeType: "video/mp4" } }), /chưa được/);
  assert.throws(() => speech.normalizeAudio({ audio: { ...audio, data: "====" } }), /base64/);
  assert.throws(() => speech.normalizeAudio({ audio: { ...audio, data: Buffer.alloc(speech.AUDIO_LIMIT + 1).toString("base64") } }), error => error.code === "SPEECH_AUDIO_INVALID");
  assert.throws(() => speech.normalizeTTS({ text: "x".repeat(2001) }), /2.000/);
  assert.throws(() => speech.normalizeTTS({ text: "hello", voice: "voice_clone" }), /nhân bản/);
});
test("transcription sends one same provider request and returns text without invented timestamps", async () => {
  let calls = 0;
  const result = await speech.runSpeechToText({ audio, language: "vi-VN" }, { env, fetcher: async (url, options) => {
    calls++; assert.ok(url.endsWith("gemini-3.8-flash:generateContent")); assert.equal(options.headers["x-goog-api-key"], env.GEMINI_API_KEY);
    const body = JSON.parse(options.body); assert.equal(body.contents[0].parts[1].inlineData.data, audio.data); assert.match(body.contents[0].parts[0].text, /Do not translate or invent/);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hidden thoughts", thought: true }, { text: "Xin chào" }] } }] }));
  } });
  assert.equal(calls, 1); assert.equal(result.text, "Xin chào"); assert.equal(result.timestamps, false);
});
test("TTS delivers current-model WAV and converts legacy PCM to playable WAV", async () => {
  const wav = speech.pcmToWav(Buffer.alloc(48));
  for (const legacy of [false, true]) {
    const result = await speech.runTextToSpeech({ text: "Hello", voice: "Kore" }, { env: { ...env, ...(legacy ? { GEMINI_TTS_MODEL: "gemini-3.1-flash-tts-preview" } : {}) }, fetcher: async (_url, options) => {
      const config = JSON.parse(options.body).generationConfig.speechConfig.voiceConfig;
      assert.equal(legacy ? config.prebuiltVoiceConfig.voiceName : config.voice, "Kore");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: (legacy ? Buffer.alloc(48) : wav).toString("base64"), mimeType: legacy ? "audio/L16;codec=pcm;rate=24000" : "audio/wav" } }] } }] }));
    } });
    const bytes = Buffer.from(result.audio.data, "base64"); assert.equal(bytes.toString("ascii", 0, 4), "RIFF"); assert.equal(bytes.toString("ascii", 8, 12), "WAVE"); assert.equal(bytes.readUInt32LE(24), 24000); assert.equal(result.audio.mimeType, "audio/wav");
  }
});
test("speech quota failures do not retry, and unconfigured provider never calls fetch", async () => {
  let calls = 0; const fetcher = async () => { calls++; return new Response("{}", { status: 429 }); };
  await assert.rejects(speech.runSpeechToText({ audio }, { env, fetcher }), error => error.code === "AI_QUOTA_EXHAUSTED"); assert.equal(calls, 1);
  await assert.rejects(speech.runTextToSpeech({ text: "hello" }, { env: {}, fetcher }), error => error.code === "AI_PROVIDER_NOT_CONFIGURED"); assert.equal(calls, 1);
});
function endpointHarness(user = { _id: "test-owner" }) {
  let providerCalls = 0, jobUpdates = [];
  const module = { exports: {} };
  const platform = { clean: (value, max) => String(value || "").trim().slice(0, max), currentUser: async () => user, enforceRateLimit: async () => {}, withApi: async (req, res, handler) => { try { await handler({ db: {}, body: req.body || {} }); } catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); } } };
  const jobs = { ...gateway, createJob: async (_db, _user, policy) => ({ _id: "test-job", userId: user._id, toolId: policy.id }), updateJob: async (_db, job, state, patch) => { jobUpdates.push(patch); return { ...job, state, ...patch }; } };
  const adapter = { ...speech, runSpeechToText: async () => { providerCalls++; return { text: "Private transcript", provider: "gemini", model: "test" }; }, runTextToSpeech: async () => { providerCalls++; return { text: "Private transcript", audio, provider: "gemini", model: "test" }; } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../tool-api/ai.js"), "utf8"), { module, Buffer, process: { env: {} }, require: name => name.includes("platform") ? platform : name.includes("allToolSpeech") ? adapter : jobs });
  const send = async body => { const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } }; await module.exports({ method: "POST", body }, res); return res; };
  return { send, calls: () => providerCalls, updates: () => jobUpdates };
}
test("endpoint requires authenticated identity and explicit paid processing consent before provider calls", async () => {
  const missingAuth = endpointHarness(null), request = { toolId: "speech-to-text", action: "transcribe", input: { audio } };
  assert.equal((await missingAuth.send(request)).statusCode, 401); assert.equal(missingAuth.calls(), 0);
  const authenticated = endpointHarness(); assert.equal((await authenticated.send(request)).statusCode, 403); assert.equal(authenticated.calls(), 0);
  const result = await authenticated.send({ ...request, consent: { paidProcessing: true } }); assert.equal(result.statusCode, 200); assert.equal(result.data.result.text, "Private transcript"); assert.equal(authenticated.calls(), 1);
  assert.doesNotMatch(JSON.stringify(authenticated.updates()), /Private transcript/);
});
test("generated audio bytes and transcript are never persisted in gateway job records", async () => {
  const harness = endpointHarness(); const result = await harness.send({ toolId: "text-to-speech", action: "synthesize", input: { text: "Private transcript" }, consent: { paidProcessing: true } });
  assert.equal(result.statusCode, 200); assert.equal(harness.calls(), 1);
  assert.doesNotMatch(JSON.stringify(harness.updates()), /Private transcript|AQEBAQ/); assert.equal(harness.updates().at(-1).result.audioBytes, 32);
});
