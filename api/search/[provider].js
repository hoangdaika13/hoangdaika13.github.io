const { clean, enforceRateLimit, withApi } = require("../_lib/platform");

const GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const YOUTUBE_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

async function readJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(clean(data?.error?.message || "Dịch vụ tìm kiếm đang bận.", 300));
      error.statusCode = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function googleSearch(req, query) {
  const key = String(process.env.GOOGLE_SEARCH_API_KEY || "").trim();
  const cx = String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim();
  if (!key || !cx) return { notConfigured: true, required: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"] };

  const page = Math.max(1, Math.min(10, Number(req.query.page || 1)));
  const kind = req.query.kind === "images" ? "images" : "web";
  const params = new URLSearchParams({ key, cx, q: query, num: "10", start: String((page - 1) * 10 + 1), safe: "active", hl: "vi", gl: "vn" });
  if (kind === "images") params.set("searchType", "image");
  const data = await readJson(`${GOOGLE_ENDPOINT}?${params}`);
  const items = (data.items || []).map((item) => ({
    title: clean(item.title, 300),
    url: clean(item.link, 2000),
    displayUrl: clean(item.displayLink, 300),
    snippet: clean(item.snippet, 800),
    image: clean(item.image?.thumbnailLink || item.pagemap?.cse_thumbnail?.[0]?.src, 2000),
    width: Number(item.image?.width || 0),
    height: Number(item.image?.height || 0)
  }));
  return { provider: "google", query, kind, page, total: Number(data.searchInformation?.totalResults || 0), items };
}

async function youtubeSearch(req, query) {
  const key = String(process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) return { notConfigured: true, required: ["YOUTUBE_API_KEY"] };

  const allowedOrders = new Set(["relevance", "date", "rating", "viewCount"]);
  const allowedDurations = new Set(["any", "short", "medium", "long"]);
  const order = allowedOrders.has(req.query.order) ? req.query.order : "relevance";
  const duration = allowedDurations.has(req.query.duration) ? req.query.duration : "any";
  const params = new URLSearchParams({
    key,
    part: "snippet",
    type: "video",
    q: query,
    maxResults: "18",
    order,
    safeSearch: "moderate",
    relevanceLanguage: "vi",
    regionCode: "VN"
  });
  if (duration !== "any") params.set("videoDuration", duration);
  const data = await readJson(`${YOUTUBE_ENDPOINT}?${params}`);
  const items = (data.items || []).map((item) => ({
    id: clean(item.id?.videoId, 32),
    title: clean(item.snippet?.title, 300),
    channel: clean(item.snippet?.channelTitle, 200),
    description: clean(item.snippet?.description, 800),
    publishedAt: item.snippet?.publishedAt || "",
    thumbnail: clean(item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url, 2000)
  })).filter((item) => item.id);
  return { provider: "youtube", query, order, duration, items, nextPageToken: clean(data.nextPageToken, 200) };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const provider = clean(req.query.provider, 30).toLowerCase();
    const query = clean(req.query.q, 180);
    if (!query) return res.status(400).json({ error: "Hãy nhập nội dung cần tìm." });
    if (!new Set(["google", "youtube"]).has(provider)) return res.status(404).json({ error: "Dịch vụ tìm kiếm không tồn tại." });

    await enforceRateLimit(db, `search:${provider}:${requestIp(req)}`, 40, 10 * 60 * 1000);
    const result = provider === "google" ? await googleSearch(req, query) : await youtubeSearch(req, query);
    if (result.notConfigured) {
      return res.status(503).json({
        error: `${provider === "google" ? "Google Search" : "YouTube Search"} chưa được kết nối trên máy chủ.`,
        code: "SEARCH_NOT_CONFIGURED",
        provider,
        required: result.required
      });
    }
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json(result);
  });
};
