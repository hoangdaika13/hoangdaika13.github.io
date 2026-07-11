const { bodyOf, clean, currentUser, ownerFrom, setCors, withApi } = require("../../_lib/platform");

const downloadHosts = ["youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch", "instagram.com", "twitter.com", "x.com", "reddit.com", "vimeo.com", "soundcloud.com", "twitch.tv", "pinterest.com", "tumblr.com", "bilibili.com"];

function supportedDownloadUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return ["https:", "http:"].includes(url.protocol) && downloadHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch { return false; }
}

async function downloadCenterAction(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ configured: Boolean(process.env.VIDEO_DOWNLOADER_API_URL), providers: downloadHosts });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng trình tải." });
  const body = bodyOf(req);
  if (!supportedDownloadUrl(body.url)) return res.status(400).json({ error: "Link không hợp lệ hoặc nền tảng chưa được hỗ trợ." });
  const endpoint = String(process.env.VIDEO_DOWNLOADER_API_URL || "").replace(/\/$/, "");
  if (!endpoint) return res.status(503).json({ error: "Máy chủ tải media chưa được cấu hình.", code: "DOWNLOADER_NOT_CONFIGURED" });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json", ...(process.env.VIDEO_DOWNLOADER_API_KEY ? { Authorization: `Api-Key ${process.env.VIDEO_DOWNLOADER_API_KEY}` } : {}) },
      body: JSON.stringify({
        url: body.url,
        downloadMode: ["auto", "audio", "mute"].includes(body.downloadMode) ? body.downloadMode : "auto",
        videoQuality: ["max", "2160", "1080", "720", "480", "360"].includes(String(body.videoQuality)) ? String(body.videoQuality) : "1080",
        audioFormat: "mp3",
        audioBitrate: ["320", "256", "128"].includes(String(body.audioBitrate)) ? String(body.audioBitrate) : "128",
        filenameStyle: "pretty",
        youtubeVideoContainer: "mp4"
      }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "error") return res.status(502).json({ error: data.error?.code || data.error || "Không thể xử lý link này." });
    return res.status(200).json(data);
  } catch (error) { return res.status(502).json({ error: `Máy chủ tải không phản hồi: ${error.message}` }); }
}

function aiCenterOutput(input) {
  return [
    "HH Cloud AI đã phân tích yêu cầu.", "", `Yêu cầu: ${input || "Chưa có nội dung"}`, "",
    "Hướng xử lý đề xuất:", "1. Xác định mục tiêu và đầu ra cần đạt.", "2. Chia nhiệm vụ thành các bước có thể kiểm tra.",
    "3. Bổ sung ví dụ, giới hạn và tiêu chí chất lượng.", "4. Tự kiểm tra kết quả trước khi sử dụng.", "",
    `Prompt nâng cấp: Hãy đóng vai chuyên gia phù hợp và thực hiện yêu cầu sau: ${input}. Trả lời có cấu trúc, nêu giả định, đưa ví dụ cụ thể và kết thúc bằng checklist hành động.`, "",
    "Phiên này đã được lưu vào lịch sử tài khoản."
  ].join("\n");
}

module.exports = async function handler(req, res) {
  if (req.query.moduleId === "download-center") return downloadCenterAction(req, res);
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleActions");
    if (req.method === "GET") {
      const actions = await collection.find({ moduleId }).sort({ createdAt: -1 }).limit(100).toArray();
      return res.status(200).json({ moduleId, actions });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const input = clean(body.input, 8000);
    const actionType = clean(body.actionType || "run", 80);
    const output = moduleId === "ai-center" && actionType === "chat"
      ? aiCenterOutput(input)
      : [`Backend đã nhận tác vụ cho ${moduleId}.`, "", `Tác vụ: ${actionType}`, `Dữ liệu: ${input || "Không có dữ liệu"}`, "", "Dữ liệu đã được lưu vào MongoDB."].join("\n");
    const doc = { moduleId, actionType, input, output, meta: body.meta || {}, ...ownerFrom(user, body), createdAt: new Date() };
    const result = await collection.insertOne(doc);
    await db.collection("events").insertOne({ type: "module:action", moduleId, actionType, actionId: result.insertedId, createdAt: new Date() });
    return res.status(200).json({ ok: true, action: { ...doc, _id: result.insertedId } });
  });
};
