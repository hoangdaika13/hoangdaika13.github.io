const { bodyOf, currentUser, setCors } = require("../_lib/platform");

const supportedHosts = [
  "youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch",
  "instagram.com", "twitter.com", "x.com", "reddit.com", "vimeo.com",
  "soundcloud.com", "twitch.tv", "pinterest.com", "tumblr.com", "bilibili.com"
];

function isSupportedUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return supportedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({ configured: Boolean(process.env.VIDEO_DOWNLOADER_API_URL), providers: supportedHosts });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng trình tải." });

  const body = bodyOf(req);
  if (!isSupportedUrl(body.url)) return res.status(400).json({ error: "Link không hợp lệ hoặc nền tảng chưa được hỗ trợ." });

  const endpoint = String(process.env.VIDEO_DOWNLOADER_API_URL || "").replace(/\/$/, "");
  if (!endpoint) {
    return res.status(503).json({
      error: "Máy chủ tải media chưa được cấu hình.",
      code: "DOWNLOADER_NOT_CONFIGURED"
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(process.env.VIDEO_DOWNLOADER_API_KEY ? { Authorization: `Api-Key ${process.env.VIDEO_DOWNLOADER_API_KEY}` } : {})
      },
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
  } catch (error) {
    return res.status(502).json({ error: `Máy chủ tải không phản hồi: ${error.message}` });
  }
};
