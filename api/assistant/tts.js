const { clean, enforceRateLimit, withApi } = require("../../utils/platform");
const { requireAuth } = require("../../utils/auth-security");
const { parseOpenAIKeys } = require("../../utils/openai-provider");

const ALLOWED_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]);

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Phương thức không được hỗ trợ." });
    const auth = await requireAuth(req, res, db);
    if (!auth) return;
    await enforceRateLimit(db, `hikari-tts:${auth.user._id}`, 30, 15 * 60 * 1000);
    const apiKey = parseOpenAIKeys(process.env)[0];
    if (!apiKey) return res.status(503).json({ error: "Cloud TTS chưa được cấu hình; hãy dùng giọng trình duyệt miễn phí.", code: "TTS_NOT_CONFIGURED" });
    const text = clean(body.text, 900);
    if (!text) return res.status(400).json({ error: "Nội dung đọc đang trống." });
    const voice = ALLOWED_VOICES.has(clean(body.voice, 30)) ? clean(body.voice, 30) : "coral";
    const speed = Math.min(1.5, Math.max(.65, Number(body.speed) || 1));
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: clean(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", 80),
        input: text,
        voice,
        instructions: "Speak in natural, warm Vietnamese as a concise futuristic virtual assistant. Do not add words.",
        response_format: "mp3",
        speed
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: clean(data?.error?.message || `TTS HTTP ${response.status}`, 240) });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(audio);
  });
};
