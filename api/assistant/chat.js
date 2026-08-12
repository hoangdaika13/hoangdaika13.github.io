const { createHash } = require("node:crypto");
const { clean, enforceRateLimit, withApi } = require("../../utils/platform");
const { requireAuth } = require("../../utils/auth-security");
const { GeminiKeyPool, canTryAnotherKey, parseGeminiKeys } = require("../../utils/gemini-key-pool");
const { normalizeOpenAIModel, parseOpenAIKeys, runOpenAIResponse } = require("../../utils/openai-provider");

let geminiPool = null;
let geminiSignature = "";
function pool() {
  const keys = parseGeminiKeys(process.env);
  const signature = keys.join("\u001f");
  if (!geminiPool || signature !== geminiSignature) {
    geminiPool = new GeminiKeyPool(keys, { maxAttempts: Math.min(4, Math.max(1, Number(process.env.GEMINI_MAX_KEY_ATTEMPTS) || 3)) });
    geminiSignature = signature;
  }
  return geminiPool;
}

const INSTRUCTION = `Bạn là Hikari H, trợ lý điều hành ngắn gọn của HH Platform.
Chỉ trả lời bằng tiếng Việt, tối đa 120 từ. Dùng duy nhất dữ liệu tổng hợp được cung cấp.
Không bịa tác vụ, bài học, trạng thái API hoặc nội dung riêng tư. Không trả về code, HTML, URL hay lệnh thực thi.
Không tuyên bố đã upload, đăng, xóa, gửi email, mua credit hoặc đổi quyền riêng tư.
Nếu người dùng yêu cầu hành động gây tác động bên ngoài, hãy nói rằng bạn chỉ có thể chuẩn bị preview và họ phải xác nhận ở công cụ tương ứng.
Các lệnh mở route đã được xử lý bằng whitelist phía client; câu trả lời này chỉ có tính giải thích.`;

async function runGemini(message, context) {
  const keyPool = pool();
  if (!keyPool.keys.length) return null;
  const model = clean(process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-flash-lite", 80);
  const candidates = keyPool.candidates();
  let lastError = null;
  for (const apiKey of candidates) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: `Dữ liệu tổng hợp: ${JSON.stringify(context)}\nYêu cầu: ${message}` }] }],
          generationConfig: { temperature: .35, maxOutputTokens: 320 }
        }),
        signal: AbortSignal.timeout(12000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(clean(data?.error?.message || `Gemini HTTP ${response.status}`, 240));
        error.status = response.status;
        throw error;
      }
      const reply = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
      if (!reply) throw Object.assign(new Error("Gemini không trả về nội dung."), { status: 502 });
      keyPool.reportSuccess(apiKey);
      return { reply: clean(reply, 1000), provider: "Gemini", model };
    } catch (error) {
      lastError = error;
      keyPool.reportFailure(apiKey, Number(error.status || 0), error.message);
      if (!canTryAnotherKey(Number(error.status || 0), error.message)) break;
    }
  }
  throw lastError || new Error("Gemini không phản hồi.");
}

async function runOpenAI(message, context, user) {
  const keys = parseOpenAIKeys(process.env);
  if (!keys.length) return null;
  const result = await runOpenAIResponse({
    apiKey: keys[0],
    model: normalizeOpenAIModel(process.env.OPENAI_ASSISTANT_MODEL),
    prompt: `Dữ liệu tổng hợp: ${JSON.stringify(context)}\nYêu cầu: ${message}`,
    instruction: INSTRUCTION,
    history: [],
    attachments: [],
    reasoningEffort: "low",
    useWebSearch: false,
    safetyIdentifier: createHash("sha256").update(`hikari:${user._id}`).digest("hex").slice(0, 64)
  });
  return { reply: clean(result.output, 1000), provider: "OpenAI", model: result.model };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Phương thức không được hỗ trợ." });
    const auth = await requireAuth(req, res, db);
    if (!auth) return;
    await enforceRateLimit(db, `hikari-chat:${auth.user._id}`, 45, 15 * 60 * 1000);
    const message = clean(body.message, 600);
    if (!message) return res.status(400).json({ error: "Yêu cầu đang trống." });
    const raw = body.context && typeof body.context === "object" ? body.context : {};
    const context = {
      taskCount: Math.max(0, Math.min(999, Number(raw.taskCount) || 0)),
      lessonDue: Math.max(0, Math.min(999, Number(raw.lessonDue) || 0)),
      unreadCount: Math.max(0, Math.min(999, Number(raw.unreadCount) || 0)),
      online: raw.online !== false,
      apiStatus: clean(raw.apiStatus, 80)
    };
    let result = null;
    const preferred = clean(process.env.HIKARI_AI_PROVIDER || "gemini", 20).toLowerCase();
    try { result = preferred === "openai" ? await runOpenAI(message, context, auth.user) : await runGemini(message, context); } catch {}
    if (!result) {
      try { result = preferred === "openai" ? await runGemini(message, context) : await runOpenAI(message, context, auth.user); } catch {}
    }
    if (!result) return res.status(503).json({ error: "AI đang ngoại tuyến. Các lệnh local vẫn hoạt động.", code: "ASSISTANT_AI_OFFLINE" });
    return res.status(200).json({ reply: result.reply, provider: result.provider, model: result.model, contextFields: Object.keys(context) });
  });
};
