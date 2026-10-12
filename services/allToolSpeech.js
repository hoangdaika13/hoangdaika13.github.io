"use strict";

// Original bounded REST adapters, based on Google's documented Generate Content API.
const AUDIO_LIMIT = 2 * 1024 * 1024;
const VOICES = Object.freeze(["Kore", "Puck", "Zephyr", "Charon", "Aoede", "Leda"]);
const FORMATS = new Set(["audio/wav", "audio/mp3", "audio/mpeg", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/m4a", "audio/l16", "audio/opus", "audio/webm"]);
function fail(message, statusCode = 400, code = "SPEECH_INPUT_INVALID") { const error = new Error(message); Object.assign(error, { statusCode, code }); throw error; }
function apiKey(env) { return String(env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || String(env.GEMINI_API_KEYS || "").split(",")[0] || "").trim(); }
function modelName(value, fallback) { return /^[a-z0-9._-]{1,100}$/i.test(value || "") ? value : fallback; }
function speechStatus(env = process.env) {
  const configured = Boolean(apiKey(env));
  return [
    { provider: "speech", configured, model: modelName(env.GEMINI_SPEECH_MODEL, "gemini-3.8-flash"), maxAudioBytes: AUDIO_LIMIT, consentRequired: true, secretsExposed: false },
    { provider: "tts", configured, model: modelName(env.GEMINI_TTS_MODEL, "gemini-3.8-flash-lite-tts"), voices: [...VOICES], maxTextLength: 2000, consentRequired: true, secretsExposed: false }
  ];
}
function decodeAudio(data, limit = AUDIO_LIMIT) {
  if (typeof data !== "string" || !data.length || data.length > Math.ceil(limit / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) fail("Dữ liệu âm thanh base64 không hợp lệ hoặc vượt 2 MB.", 413, "SPEECH_AUDIO_INVALID");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length < 12 || bytes.length > limit || bytes.toString("base64") !== data) fail("Tệp âm thanh rỗng, không hợp lệ hoặc quá lớn.", 413, "SPEECH_AUDIO_INVALID");
  return bytes;
}
function normalizeAudio(input) {
  if (!input?.audio || typeof input.audio !== "object" || Array.isArray(input.audio) || Object.keys(input.audio).some(key => !["data", "mimeType"].includes(key))) fail("Chỉ nhận tệp âm thanh inline; không nhận URL hoặc đường dẫn máy chủ.");
  let mimeType = String(input.audio.mimeType || "").toLowerCase().split(";")[0].trim();
  if (mimeType === "audio/x-wav") mimeType = "audio/wav";
  if (mimeType === "audio/mp4") mimeType = "audio/m4a";
  if (!FORMATS.has(mimeType)) fail("Định dạng âm thanh chưa được hỗ trợ.", 415, "SPEECH_FORMAT_UNSUPPORTED");
  const bytes = decodeAudio(input.audio.data);
  const language = String(input.language || "").trim();
  if (language && !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(language)) fail("Mã ngôn ngữ không hợp lệ.");
  return { mimeType, data: bytes.toString("base64"), language };
}
function normalizeTTS(input) {
  if (typeof input?.text !== "string" || !input.text.trim() || input.text.length > 2000) fail("Nhập từ 1 đến 2.000 ký tự để tạo giọng đọc.");
  const voice = input.voice || "Kore";
  if (!VOICES.includes(voice)) fail("Hãy chọn giọng được hỗ trợ; không nhận ID giọng nhân bản.");
  return { text: input.text.trim(), voice };
}
async function generate(model, body, { env = process.env, fetcher = globalThis.fetch } = {}) {
  const secret = apiKey(env);
  if (!secret) fail("Gemini chưa được cấu hình trên máy chủ.", 503, "AI_PROVIDER_NOT_CONFIGURED");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": secret }, body: JSON.stringify(body), signal: controller.signal, redirect: "error" });
    if (!response.ok) fail("Nhà cung cấp chưa xử lý được âm thanh; kiểm tra cấu hình hoặc hạn mức. Không tự thử lại.", response.status === 429 ? 429 : 502, response.status === 429 ? "AI_QUOTA_EXHAUSTED" : "AI_PROVIDER_FAILED");
    let payload;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4 * 1024 * 1024) { await reader.cancel(); fail("Kết quả quá lớn; hãy xử lý đoạn ngắn hơn.", 502, "SPEECH_OUTPUT_TOO_LARGE"); } chunks.push(Buffer.from(value)); } }
      finally { reader.releaseLock(); }
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } else payload = await response.json();
    return payload;
  } catch (error) {
    if (error.statusCode) throw error;
    fail(error.name === "AbortError" ? "Yêu cầu âm thanh quá thời gian; không tự gọi lại để tránh tính phí trùng." : "Không đọc được kết quả từ nhà cung cấp âm thanh.", 502, error.name === "AbortError" ? "SPEECH_TIMEOUT" : "SPEECH_PROVIDER_RESPONSE_INVALID");
  } finally { clearTimeout(timer); }
}
async function runSpeechToText(input, options = {}) {
  const audio = normalizeAudio(input), env = options.env || process.env;
  const model = modelName(env.GEMINI_SPEECH_MODEL, "gemini-3.8-flash");
  const payload = await generate(model, { contents: [{ role: "user", parts: [
    { text: `Transcribe only the actual audible speech verbatim in its original language${audio.language ? ` (language hint: ${audio.language})` : ""}. Do not translate or invent speech, speakers or timestamps. Use [inaudible] for uncertain words. Return only the transcript; return an empty string when there is no speech.` },
    { inlineData: { mimeType: audio.mimeType, data: audio.data } }
  ] }], generationConfig: { temperature: 0, maxOutputTokens: 4096 } }, options);
  const text = (payload.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(part => part.text || "").join("\n").trim();
  if (!text) fail("Không nhận được lời nói rõ ràng. Hãy kiểm tra bản ghi.", 422, "SPEECH_EMPTY_TRANSCRIPT");
  if (text.length > 24000) fail("Bản chép lời quá dài; hãy chia tệp thành đoạn ngắn.", 502, "SPEECH_OUTPUT_TOO_LARGE");
  return { text, language: audio.language || null, provider: "gemini", model, timestamps: false };
}
function pcmToWav(bytes, rate = 24000) {
  if (bytes.length % 2 || !Number.isInteger(rate) || rate < 8000 || rate > 48000) fail("Kết quả PCM không hợp lệ.", 502, "SPEECH_OUTPUT_INVALID");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + bytes.length, 4); header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([header, bytes]);
}
async function runTextToSpeech(input, options = {}) {
  const { text, voice } = normalizeTTS(input), env = options.env || process.env;
  const model = modelName(env.GEMINI_TTS_MODEL, "gemini-3.8-flash-lite-tts");
  const voiceConfig = /^gemini-3\.8-/.test(model) ? { voice } : { prebuiltVoiceConfig: { voiceName: voice } };
  const payload = await generate(model, { contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig } } }, options);
  const part = payload.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data)?.inlineData;
  if (!part) fail("Nhà cung cấp không trả về âm thanh.", 502, "SPEECH_EMPTY_AUDIO");
  let bytes = decodeAudio(part.data, AUDIO_LIMIT - 44);
  if (/^audio\/(?:wav|x-wav)(?:;|$)/i.test(part.mimeType || "")) {
    if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") fail("Dữ liệu WAV không đúng định dạng.", 502, "SPEECH_OUTPUT_INVALID");
  } else if (/^audio\/(?:L16|pcm)(?:;|$)/i.test(part.mimeType || "")) {
    if (!/(?:^|;)\s*codec=pcm(?:;|$)/i.test(part.mimeType || "") && !/^audio\/pcm/i.test(part.mimeType)) fail("Không nhận PCM không xác định codec.", 502, "SPEECH_OUTPUT_INVALID");
    const rate = /(?:^|;)\s*rate=(\d+)(?:;|$)/i.exec(part.mimeType)?.[1];
    bytes = pcmToWav(bytes, rate ? Number(rate) : 24000);
  } else fail("Nhà cung cấp trả về định dạng âm thanh không hỗ trợ.", 502, "SPEECH_OUTPUT_INVALID");
  return { audio: { data: bytes.toString("base64"), mimeType: "audio/wav" }, text, voice, provider: "gemini", model };
}
module.exports = Object.freeze({ AUDIO_LIMIT, VOICES, speechStatus, normalizeAudio, normalizeTTS, runSpeechToText, runTextToSpeech, pcmToWav });
