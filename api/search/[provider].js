const { clean, setCors } = require("../../utils/platform");

const GOOGLE_ENDPOINT = "https://customsearch.googleapis.com/customsearch/v1";
const VERTEX_SEARCH_ENDPOINT = "https://discoveryengine.googleapis.com/v1";
const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_PLAYLIST_ITEMS_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlistItems";
const rateBuckets = new Map();

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

function rateLimit(key, limit = 50, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.expiresAt <= now) {
    rateBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    const error = new Error("Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
    error.statusCode = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
  if (rateBuckets.size > 500) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.expiresAt <= now) rateBuckets.delete(bucketKey);
    }
  }
}

async function readJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HH-Platform-Search/1.0",
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(clean(data?.error?.message || "Dịch vụ tìm kiếm tạm thời không phản hồi.", 300));
      error.statusCode = response.status === 429 ? 429 : 502;
      error.code = response.status === 403 ? "API_ACCESS_DENIED" : "PROVIDER_ERROR";
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Dịch vụ tìm kiếm phản hồi quá chậm. Hãy thử lại.");
      timeoutError.statusCode = 504;
      timeoutError.code = "PROVIDER_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function vertexSearchConfig() {
  const projectId = String(process.env.VERTEX_SEARCH_PROJECT_ID || "").trim();
  const appId = String(process.env.VERTEX_SEARCH_APP_ID || "").trim();
  const apiKey = String(process.env.VERTEX_SEARCH_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || "").trim();
  const location = String(process.env.VERTEX_SEARCH_LOCATION || "global").trim() || "global";
  return {
    projectId,
    appId,
    apiKey,
    location,
    configured: Boolean(projectId && appId && apiKey)
  };
}

function configuredServices() {
  const vertex = vertexSearchConfig();
  const programmableSearch = Boolean(String(process.env.GOOGLE_SEARCH_API_KEY || "").trim() && String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim());
  return {
    google: vertex.configured || programmableSearch,
    googleProvider: vertex.configured ? "vertex-ai-search" : programmableSearch ? "programmable-search" : "none",
    youtube: Boolean(String(process.env.YOUTUBE_API_KEY || "").trim()),
    gemini: Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim()),
    geminiKeySource: process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.GOOGLE_AI_API_KEY
        ? "google-ai"
        : "none"
  };
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const nested = firstText(...value.map((item) => item?.content || item?.snippet || item?.text || item));
      if (nested) return nested;
    }
  }
  return "";
}

function displayHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function vertexSearch(req, query, config) {
  const kind = req.query.kind === "images" ? "images" : "web";
  if (kind === "images") {
    const error = new Error("Vertex AI Search chỉ tìm nội dung website; hãy mở Google Images để tìm ảnh toàn web.");
    error.statusCode = 400;
    error.code = "VERTEX_IMAGE_SEARCH_UNSUPPORTED";
    throw error;
  }

  const page = Math.max(1, Math.min(10, Number(req.query.page || 1)));
  const servingConfig = `projects/${config.projectId}/locations/${config.location}/collections/default_collection/engines/${config.appId}/servingConfigs/default_search`;
  const endpoint = `${VERTEX_SEARCH_ENDPOINT}/${servingConfig}:searchLite?key=${encodeURIComponent(config.apiKey)}`;
  const startedAt = Date.now();
  const data = await readJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      servingConfig,
      query,
      pageSize: 10,
      offset: (page - 1) * 10,
      languageCode: "vi",
      queryExpansionSpec: { condition: "AUTO" },
      spellCorrectionSpec: { mode: "AUTO" },
      contentSearchSpec: { snippetSpec: { returnSnippet: true } }
    })
  });

  const items = (data.results || []).map((result) => {
    const document = result.document || {};
    const derived = document.derivedStructData || document.structData || {};
    const url = firstText(derived.link, derived.url);
    const image = firstText(
      derived.image,
      derived.thumbnail,
      derived.images?.map((item) => item?.url || item?.src),
      derived.pagemap?.cse_thumbnail?.map((item) => item?.src)
    );
    return {
      title: clean(firstText(derived.title, derived.htmlTitle, document.id, url), 300),
      url: clean(url, 2000),
      displayUrl: clean(firstText(derived.displayLink, displayHost(url)), 300),
      snippet: clean(firstText(derived.snippets, derived.extractive_answers, derived.description), 800),
      image: clean(image, 2000),
      originalImage: "",
      mime: clean(firstText(derived.mimeType, derived.mime), 80),
      width: 0,
      height: 0
    };
  }).filter((item) => item.url);

  const total = Number(data.totalSize || items.length || 0);
  return {
    provider: "google",
    source: "vertex-ai-search",
    query,
    correctedQuery: clean(data.correctedQuery, 180),
    kind,
    page,
    total,
    searchTime: (Date.now() - startedAt) / 1000,
    hasPrevious: page > 1,
    hasNext: Boolean(data.nextPageToken) || total > page * 10,
    items
  };
}

function isoDuration(value) {
  const match = String(value || "").match(/^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/);
  if (!match) return "";
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0) + days * 24;
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return [hours, minutes, seconds]
    .filter((_, index) => hours || index > 0)
    .map((part, index) => String(part).padStart(index || hours ? 2 : 1, "0"))
    .join(":");
}

async function googleSearch(req, query) {
  const vertex = vertexSearchConfig();
  if (vertex.configured) return vertexSearch(req, query, vertex);

  const key = String(process.env.GOOGLE_SEARCH_API_KEY || "").trim();
  const cx = String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim();
  if (!key || !cx) return { notConfigured: true, required: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"] };

  const page = Math.max(1, Math.min(10, Number(req.query.page || 1)));
  const kind = req.query.kind === "images" ? "images" : "web";
  const safe = req.query.safe === "off" ? "off" : "active";
  const dateRestrict = /^(d|w|m|y)(1|7|30|90|365)$/.test(String(req.query.date || "")) ? String(req.query.date) : "";
  const allowedFiles = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
  const fileType = allowedFiles.has(String(req.query.file || "")) ? String(req.query.file) : "";
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: "10",
    start: String((page - 1) * 10 + 1),
    safe,
    hl: "vi",
    gl: "vn"
  });
  if (kind === "images") params.set("searchType", "image");
  if (dateRestrict) params.set("dateRestrict", dateRestrict);
  if (fileType && kind === "web") params.set("fileType", fileType);

  const data = await readJson(`${GOOGLE_ENDPOINT}?${params}`);
  const items = (data.items || []).map((item) => {
    const isImage = kind === "images";
    return {
      title: clean(item.title, 300),
      url: clean(isImage ? item.image?.contextLink || item.link : item.link, 2000),
      displayUrl: clean(item.displayLink, 300),
      snippet: clean(item.snippet, 800),
      image: clean(isImage ? item.link : item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src, 2000),
      originalImage: clean(isImage ? item.link : "", 2000),
      mime: clean(item.mime, 80),
      width: Number(item.image?.width || 0),
      height: Number(item.image?.height || 0)
    };
  });
  return {
    provider: "google",
    query,
    correctedQuery: clean(data.spelling?.correctedQuery, 180),
    kind,
    page,
    total: Number(data.searchInformation?.totalResults || 0),
    searchTime: Number(data.searchInformation?.searchTime || 0),
    hasPrevious: page > 1,
    hasNext: Boolean(data.queries?.nextPage?.length) && page < 10,
    items
  };
}

async function youtubeSearch(req, query) {
  const key = String(process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) return { notConfigured: true, required: ["YOUTUBE_API_KEY"] };

  const allowedOrders = new Set(["relevance", "date", "rating", "viewCount"]);
  const allowedDurations = new Set(["any", "short", "medium", "long"]);
  const allowedDefinitions = new Set(["any", "high", "standard"]);
  const allowedCaptions = new Set(["any", "closedCaption", "none"]);
  const allowedEvents = new Set(["any", "live", "upcoming", "completed"]);
  const allowedPublished = new Set(["any", "d1", "w1", "m1", "y1"]);
  const order = allowedOrders.has(req.query.order) ? req.query.order : "relevance";
  const duration = allowedDurations.has(req.query.duration) ? req.query.duration : "any";
  const definition = allowedDefinitions.has(req.query.definition) ? req.query.definition : "any";
  const caption = allowedCaptions.has(req.query.caption) ? req.query.caption : "any";
  const event = allowedEvents.has(req.query.event) ? req.query.event : "any";
  const published = allowedPublished.has(req.query.published) ? req.query.published : "any";
  const pageToken = clean(req.query.pageToken, 200);
  const params = new URLSearchParams({
    key,
    part: "snippet",
    type: "video",
    q: query,
    maxResults: "12",
    order,
    safeSearch: "moderate",
    relevanceLanguage: "vi",
    regionCode: "VN",
    videoEmbeddable: "true"
  });
  if (duration !== "any") params.set("videoDuration", duration);
  if (definition !== "any") params.set("videoDefinition", definition);
  if (caption !== "any") params.set("videoCaption", caption);
  if (event !== "any") params.set("eventType", event);
  if (published !== "any") {
    const ranges = { d1: 1, w1: 7, m1: 30, y1: 365 };
    const publishedAfter = new Date(Date.now() - ranges[published] * 86400000);
    params.set("publishedAfter", publishedAfter.toISOString());
  }
  if (pageToken) params.set("pageToken", pageToken);

  const searchData = await readJson(`${YOUTUBE_SEARCH_ENDPOINT}?${params}`);
  const ids = (searchData.items || []).map((item) => clean(item.id?.videoId, 32)).filter(Boolean);
  let details = new Map();
  if (ids.length) {
    const detailParams = new URLSearchParams({ key, part: "snippet,contentDetails,statistics,status", id: ids.join(",") });
    const detailData = await readJson(`${YOUTUBE_VIDEOS_ENDPOINT}?${detailParams}`);
    details = new Map((detailData.items || []).map((item) => [item.id, item]));
  }

  const items = (searchData.items || []).map((item) => {
    const id = clean(item.id?.videoId, 32);
    const detail = details.get(id) || {};
    const snippet = detail.snippet || item.snippet || {};
    return {
      id,
      title: clean(snippet.title, 300),
      channel: clean(snippet.channelTitle, 200),
      channelId: clean(snippet.channelId, 80),
      description: clean(snippet.description, 800),
      publishedAt: snippet.publishedAt || "",
      thumbnail: clean(snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url, 2000),
      duration: isoDuration(detail.contentDetails?.duration),
      views: Number(detail.statistics?.viewCount || 0),
      likes: Number(detail.statistics?.likeCount || 0),
      definition: clean(detail.contentDetails?.definition, 20),
      captions: detail.contentDetails?.caption === "true",
      embeddable: detail.status?.embeddable !== false,
      live: snippet.liveBroadcastContent === "live",
      upcoming: snippet.liveBroadcastContent === "upcoming"
    };
  }).filter((item) => item.id && item.embeddable);

  return {
    provider: "youtube",
    query,
    order,
    duration,
    definition,
    caption,
    event,
    published,
    total: Number(searchData.pageInfo?.totalResults || 0),
    nextPageToken: clean(searchData.nextPageToken, 200),
    previousPageToken: clean(searchData.prevPageToken, 200),
    items
  };
}

function youtubeIds(value, limit = 50) {
  return clean(value, 4000).split(",").map((item) => item.trim()).filter((item) => /^[A-Za-z0-9_-]{6,128}$/.test(item)).slice(0, limit);
}

async function youtubeResource(req, action) {
  const key = String(process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) return { notConfigured: true, required: ["YOUTUBE_API_KEY"] };
  if (action === "videos") {
    const ids = youtubeIds(req.query.id);
    if (!ids.length) return { invalid: "Hãy nhập ít nhất một video id hợp lệ." };
    const params = new URLSearchParams({ key, part: "snippet,contentDetails,statistics,status", id: ids.join(",") });
    const data = await readJson(`${YOUTUBE_VIDEOS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, pageInfo: data.pageInfo || {}, items: data.items || [] };
  }
  if (action === "channels") {
    const ids = youtubeIds(req.query.id);
    if (!ids.length) return { invalid: "Hãy nhập ít nhất một channel id hợp lệ." };
    const params = new URLSearchParams({ key, part: "snippet,contentDetails,statistics,brandingSettings", id: ids.join(",") });
    const data = await readJson(`${YOUTUBE_CHANNELS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, pageInfo: data.pageInfo || {}, items: data.items || [] };
  }
  if (action === "playlist-items") {
    const playlistId = youtubeIds(req.query.playlistId, 1)[0];
    if (!playlistId) return { invalid: "Hãy nhập playlistId hợp lệ." };
    const maxResults = String(Math.max(1, Math.min(50, Number(req.query.maxResults || 20))));
    const params = new URLSearchParams({ key, part: "snippet,contentDetails,status", playlistId, maxResults });
    const pageToken = clean(req.query.pageToken, 200);
    if (pageToken) params.set("pageToken", pageToken);
    const data = await readJson(`${YOUTUBE_PLAYLIST_ITEMS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, nextPageToken: clean(data.nextPageToken, 200), previousPageToken: clean(data.prevPageToken, 200), pageInfo: data.pageInfo || {}, items: data.items || [] };
  }
  return { invalid: "Tác vụ YouTube không được hỗ trợ." };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (String(req.query.health || "") === "1") {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      return res.status(200).json({ ok: true, services: configuredServices() });
    }

    const provider = clean(req.query.provider, 30).toLowerCase();
    const action = clean(req.query.action || "search", 40).toLowerCase();
    const query = clean(req.query.q, 180);
    if (!new Set(["google", "youtube"]).has(provider)) return res.status(404).json({ error: "Dịch vụ tìm kiếm không tồn tại." });
    if (provider === "google" && action !== "search") return res.status(400).json({ error: "Google Search chỉ hỗ trợ action=search." });
    if (action === "search" && !query) return res.status(400).json({ error: "Hãy nhập nội dung cần tìm." });

    rateLimit(`search:${provider}:${action}:${requestIp(req)}`, action === "search" ? 50 : 80);
    const result = provider === "google" ? await googleSearch(req, query) : action === "search" ? await youtubeSearch(req, query) : await youtubeResource(req, action);
    if (result.invalid) return res.status(400).json({ error: result.invalid });
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
  } catch (error) {
    console.error("Search API error", error?.message || error);
    return res.status(Number(error?.statusCode || 500)).json({
      error: clean(error?.message || "Máy chủ không thể xử lý yêu cầu.", 300),
      code: clean(error?.code || "SEARCH_FAILED", 80)
    });
  }
};
