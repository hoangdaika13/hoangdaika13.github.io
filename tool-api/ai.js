"use strict";

const { clean, currentUser, enforceRateLimit, withApi } = require("../utils/platform");
const { createJob, configuredProviders, policyFor, providerStatus, updateJob, jobPublic } = require("../services/toolGateway");

const SYSTEM_INSTRUCTIONS = Object.freeze({
  "ai-chat": "Bạn là trợ lý HH Platform. Trả lời rõ ràng, trung thực, không bịa nguồn và không yêu cầu bí mật của người dùng.",
  "prompt-optimizer": "Tối ưu prompt theo mục tiêu, giữ nguyên ý định, trả về prompt cải tiến và giải thích ngắn những thay đổi quan trọng.",
  "image-prompt-generator": "Tạo prompt hình ảnh giàu chi tiết về chủ thể, bố cục, ánh sáng, ống kính, phong cách và negative prompt. Không tạo nội dung vi phạm quyền riêng tư."
});

function geminiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || String(process.env.GEMINI_API_KEYS || "").split(",")[0] || "").trim();
}

async function runGemini(toolId, action, input) {
  const apiKey = geminiKey();
  if (!apiKey) {
    const error = new Error("Gemini chưa được cấu hình trên máy chủ.");
    error.statusCode = 503; error.code = "AI_PROVIDER_NOT_CONFIGURED"; throw error;
  }
  const prompt = clean(input?.prompt || input?.text, 16000);
  if (!prompt) {
    const error = new Error("Hãy nhập nội dung cần xử lý.");
    error.statusCode = 400; error.code = "AI_INPUT_REQUIRED"; throw error;
  }
  const model = /^[a-z0-9._-]+$/i.test(String(process.env.GEMINI_MODEL || "")) ? process.env.GEMINI_MODEL : "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS[toolId] }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: toolId === "ai-chat" ? 0.6 : 0.4, maxOutputTokens: 4096 }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Nhà cung cấp AI chưa thể xử lý yêu cầu.");
    error.statusCode = response.status === 429 ? 429 : 502;
    error.code = response.status === 429 ? "AI_QUOTA_EXHAUSTED" : "AI_PROVIDER_FAILED";
    throw error;
  }
  const text = (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
  if (!text) { const error = new Error("AI không trả về nội dung."); error.statusCode = 502; error.code = "AI_EMPTY_RESPONSE"; throw error; }
  return { text, model, provider: "gemini", action };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method === "GET") return res.status(200).json({ gateway: "ai", providers: providerStatus(), tools: Object.keys(SYSTEM_INSTRUCTIONS), secretsExposed: false });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng AI.", code: "AUTH_REQUIRED" });
    const policy = policyFor(body.toolId, body.action, "ai");
    if (policy.provider !== "gemini" || !SYSTEM_INSTRUCTIONS[policy.id]) return res.status(501).json({ error: `${policy.id} cần adapter nhà cung cấp riêng.`, code: "AI_ADAPTER_NOT_CONFIGURED", providers: configuredProviders() });
    await enforceRateLimit(db, `tool-ai:${user._id}:${policy.id}`, 30, 10 * 60 * 1000);
    let job = await createJob(db, user, policy, { inputBytes: Buffer.byteLength(JSON.stringify(body.input || {}), "utf8") });
    job = await updateJob(db, job, "running", { progress: 10 });
    try {
      const result = await runGemini(policy.id, policy.action, body.input || {});
      job = await updateJob(db, job, "success", { progress: 100, result });
      return res.status(200).json({ ok: true, job: jobPublic(job), result });
    } catch (error) {
      job = await updateJob(db, job, "error", { error: { code: error.code || "AI_FAILED", message: clean(error.message, 300) } });
      return res.status(Number(error.statusCode || 500)).json({ error: clean(error.message, 300), code: error.code || "AI_FAILED", job: jobPublic(job) });
    }
  });
};
