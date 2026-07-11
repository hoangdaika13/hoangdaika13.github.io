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
    const output = [
      `Backend đã nhận action cho ${moduleId}.`,
      "",
      `Action: ${actionType}`,
      `Input: ${input || "Không có input"}`,
      "",
      "Dữ liệu đã lưu MongoDB. Có thể thay output này bằng AI/API chuyên biệt sau."
    ].join("\n");
    const doc = { moduleId, actionType, input, output, meta: body.meta || {}, ...ownerFrom(user, body), createdAt: new Date() };
    const result = await collection.insertOne(doc);
    await db.collection("events").insertOne({ type: "module:action", moduleId, actionType, actionId: result.insertedId, createdAt: new Date() });
    return res.status(200).json({ ok: true, action: { ...doc, _id: result.insertedId } });
  });
};
