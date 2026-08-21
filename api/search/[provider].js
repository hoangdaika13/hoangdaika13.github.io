const { clean, setCors } = require("../../utils/platform");
const youtubePublisherHandler = require("../../utils/youtubePublisher");
const { beginGateway } = require("../../services/apiGateway");

const GOOGLE_ENDPOINT = "https://customsearch.googleapis.com/customsearch/v1";
const VERTEX_SEARCH_ENDPOINT = "https://discoveryengine.googleapis.com/v1";
const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_PLAYLIST_ITEMS_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlistItems";
const YOUTUBE_PLAYLISTS_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlists";
const YOUTUBE_CATEGORIES_ENDPOINT = "https://www.googleapis.com/youtube/v3/videoCategories";
const YOUTUBE_COMMENTS_ENDPOINT = "https://www.googleapis.com/youtube/v3/commentThreads";
const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const JISHO_ENDPOINT = "https://jisho.org/api/v1/search/words";

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

function boundedJapaneseList(value, limit = 12, itemLimit = 180) {
  return (Array.isArray(value) ? value : []).map((item) => clean(item, itemLimit)).filter(Boolean).slice(0, limit);
}

function normalizeJapaneseEntry(entry, index) {
  const japanese = Array.isArray(entry?.japanese) ? entry.japanese : [];
  const primary = japanese.find((item) => item?.word) || japanese[0] || {};
  const senses = (Array.isArray(entry?.senses) ? entry.senses : []).slice(0, 5);
  const word = clean(primary.word || entry?.slug || primary.reading, 80);
  const reading = clean(primary.reading, 80);
  if (!word && !reading) return null;
  return {
    id: `jisho-${index + 1}`,
    word: word || reading,
    reading,
    definitions: boundedJapaneseList(senses.flatMap((sense) => sense?.english_definitions || []), 12, 120),
    partsOfSpeech: boundedJapaneseList(senses.flatMap((sense) => sense?.parts_of_speech || []), 8, 120),
    jlpt: boundedJapaneseList(entry?.jlpt, 5, 20).map((item) => item.replace(/^jlpt-/i, "").toUpperCase()),
    common: entry?.is_common === true,
    source: "JMdict via Jisho"
  };
}

async function japaneseSearch(query) {
  const params = new URLSearchParams({ keyword: query });
  const data = await readJson(`${JISHO_ENDPOINT}?${params}`);
  return {
    ok: true,
    provider: "japanese",
    query,
    items: (Array.isArray(data?.data) ? data.data : []).slice(0, 12).map(normalizeJapaneseEntry).filter(Boolean),
    source: "JMdict via Jisho",
    note: "Nghĩa trực tuyến hiện do nguồn cung cấp bằng tiếng Anh."
  };
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
  const freeCse = Boolean(String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim());
  const geminiPool = Boolean(String(process.env.GEMINI_API_KEYS || "").trim());
  return {
    google: vertex.configured || programmableSearch || freeCse,
    googleProvider: vertex.configured ? "vertex-ai-search" : programmableSearch ? "programmable-search" : freeCse ? "programmable-search-element" : "none",
    googleFreeCse: freeCse,
    youtube: Boolean(String(process.env.YOUTUBE_API_KEY || "").trim()),
    googleBooks: true,
    googlePlaces: Boolean(String(process.env.GOOGLE_PLACES_API_KEY || "").trim()),
    googleDrivePicker: Boolean(String(process.env.GOOGLE_DRIVE_PICKER_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || "").trim() && String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim()),
    cloudTranslation: Boolean(String(process.env.GOOGLE_TRANSLATION_API_KEY || "").trim()),
    japanese: true,
    gemini: geminiPool || Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim()),
    geminiKeySource: process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.GOOGLE_AI_API_KEY
        ? "google-ai"
        : geminiPool
          ? "gemini-pool"
        : "none"
  };
}

function serverProviderConfigured(provider) {
  if (provider === "japanese") return true;
  if (provider === "youtube") return Boolean(String(process.env.YOUTUBE_API_KEY || "").trim());
  const vertex = vertexSearchConfig();
  return vertex.configured || Boolean(String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim());
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

function googleSearchElementFallback(req, query) {
  const kind = req.query.kind === "images" ? "images" : "web";
  const searchParams = new URLSearchParams({ q: query });
  if (kind === "images") searchParams.set("tbm", "isch");
  return {
    provider: "google",
    source: "programmable-search-element",
    fallback: true,
    query,
    kind,
    page: 1,
    total: 0,
    searchTime: 0,
    hasPrevious: false,
    hasNext: false,
    items: [],
    searchUrl: `https://www.google.com/search?${searchParams}`
  };
}

async function googleSearch(req, query) {
  const vertex = vertexSearchConfig();
  if (vertex.configured) return vertexSearch(req, query, vertex);

  const key = String(process.env.GOOGLE_SEARCH_API_KEY || "").trim();
  const cx = String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim();
  if (!cx) return { notConfigured: true, required: ["GOOGLE_SEARCH_ENGINE_ID"] };
  if (!key) return googleSearchElementFallback(req, query);

  const page = Math.max(1, Math.min(10, Number(req.query.page || 1)));
  const kind = req.query.kind === "images" ? "images" : "web";
  const safe = req.query.safe === "off" ? "off" : "active";
  const dateRestrict = /^(d|w|m|y)(1|7|30|90|365)$/.test(String(req.query.date || "")) ? String(req.query.date) : "";
  const allowedFiles = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
  const fileType = allowedFiles.has(String(req.query.file || "")) ? String(req.query.file) : "";
  const requestedSite = clean(req.query.site, 253).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const site = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(requestedSite) ? requestedSite : "";
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
  if (site && kind === "web") params.set("siteSearch", site);

  let data;
  try {
    data = await readJson(`${GOOGLE_ENDPOINT}?${params}`);
  } catch (error) {
    if (error?.code === "API_ACCESS_DENIED") return googleSearchElementFallback(req, query);
    throw error;
  }
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
  const allowedSafe = new Set(["none", "moderate", "strict"]);
  const allowedRegions = new Set(["VN", "US", "GB", "JP", "KR"]);
  const allowedLanguages = new Set(["vi", "en", "ja", "ko"]);
  const order = allowedOrders.has(req.query.order) ? req.query.order : "relevance";
  const duration = allowedDurations.has(req.query.duration) ? req.query.duration : "any";
  const definition = allowedDefinitions.has(req.query.definition) ? req.query.definition : "any";
  const caption = allowedCaptions.has(req.query.caption) ? req.query.caption : "any";
  const event = allowedEvents.has(req.query.event) ? req.query.event : "any";
  const published = allowedPublished.has(req.query.published) ? req.query.published : "any";
  const safe = allowedSafe.has(req.query.safe) ? req.query.safe : "moderate";
  const region = allowedRegions.has(req.query.region) ? req.query.region : "VN";
  const language = allowedLanguages.has(req.query.language) ? req.query.language : "vi";
  const pageToken = clean(req.query.pageToken, 200);
  const params = new URLSearchParams({
    key,
    part: "snippet",
    type: "video",
    q: query,
    maxResults: "12",
    order,
    safeSearch: safe,
    relevanceLanguage: language,
    regionCode: region,
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
    safe,
    region,
    language,
    total: Number(searchData.pageInfo?.totalResults || 0),
    nextPageToken: clean(searchData.nextPageToken, 200),
    previousPageToken: clean(searchData.prevPageToken, 200),
    items
  };
}

function normalizeBook(item) {
  const info = item?.volumeInfo || {};
  const access = item?.accessInfo || {};
  return {
    id: clean(item?.id, 120),
    title: clean(info.title, 300),
    subtitle: clean(info.subtitle, 300),
    authors: (Array.isArray(info.authors) ? info.authors : []).map((author) => clean(author, 120)).filter(Boolean).slice(0, 12),
    publisher: clean(info.publisher, 200),
    publishedDate: clean(info.publishedDate, 40),
    description: clean(info.description, 2000),
    categories: (Array.isArray(info.categories) ? info.categories : []).map((category) => clean(category, 120)).filter(Boolean).slice(0, 12),
    pageCount: Math.max(0, Number(info.pageCount || 0)),
    rating: Math.max(0, Number(info.averageRating || 0)),
    ratingsCount: Math.max(0, Number(info.ratingsCount || 0)),
    language: clean(info.language, 20),
    thumbnail: clean(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail, 2000).replace(/^http:/, "https:"),
    isbn: (Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : []).map((entry) => clean(entry?.identifier, 40)).filter(Boolean),
    previewLink: access?.viewability && access.viewability !== "NO_PAGES" ? clean(info.previewLink, 2000) : "",
    infoLink: clean(info.infoLink, 2000)
  };
}

async function googleResource(req, action) {
  if (action === "capabilities") return { provider: "google", action, services: configuredServices() };
  if (action === "books") {
    const query = clean(req.query.q, 180);
    if (!query) return { invalid: "Hãy nhập tên sách, tác giả hoặc ISBN." };
    const params = new URLSearchParams({ q: query, maxResults: String(Math.max(1, Math.min(30, Number(req.query.maxResults || 20)))), printType: "books", projection: "lite", langRestrict: clean(req.query.language || "vi", 10) });
    const startIndex = Math.max(0, Math.min(500, Number(req.query.startIndex || 0)));
    params.set("startIndex", String(startIndex));
    const data = await readJson(`${GOOGLE_BOOKS_ENDPOINT}?${params}`);
    return { provider: "google", action, query, total: Number(data.totalItems || 0), startIndex, items: (Array.isArray(data.items) ? data.items : []).map(normalizeBook).filter((item) => item.id && item.title) };
  }
  if (action === "places") {
    const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
    if (!apiKey) return { notConfigured: true, required: ["GOOGLE_PLACES_API_KEY", "Google Places billing"] };
    const textQuery = clean(req.query.q, 180);
    if (!textQuery) return { invalid: "Hãy nhập địa điểm cần tìm." };
    const body = { textQuery, languageCode: clean(req.query.language || "vi", 10), regionCode: clean(req.query.region || "VN", 4), maxResultCount: Math.max(1, Math.min(20, Number(req.query.maxResults || 12))) };
    const latitude = Number(req.query.latitude), longitude = Number(req.query.longitude), radius = Math.max(100, Math.min(50000, Number(req.query.radius || 5000)));
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) body.locationBias = { circle: { center: { latitude, longitude }, radius } };
    const data = await readJson(GOOGLE_PLACES_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.websiteUri,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.primaryType" }, body: JSON.stringify(body) });
    return { provider: "google", action, query: textQuery, items: (Array.isArray(data.places) ? data.places : []).map((place) => ({ id: clean(place.id, 160), name: clean(place.displayName?.text, 300), address: clean(place.formattedAddress, 500), mapsUrl: clean(place.googleMapsUri, 2000), website: clean(place.websiteUri, 2000), rating: Number(place.rating || 0), ratings: Number(place.userRatingCount || 0), priceLevel: clean(place.priceLevel, 40), openNow: place.currentOpeningHours?.openNow, type: clean(place.primaryType, 80) })) };
  }
  return { invalid: "Không gian Google này chưa được hỗ trợ trên máy chủ." };
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
  if (action === "resource-search") {
    const query = clean(req.query.q, 180);
    if (!query) return { invalid: "Hãy nhập nội dung cần tìm." };
    const type = new Set(["video", "channel", "playlist"]).has(req.query.type) ? req.query.type : "video";
    const params = new URLSearchParams({ key, part: "snippet", q: query, type, maxResults: String(Math.max(1, Math.min(25, Number(req.query.maxResults || 18)))), safeSearch: "moderate", regionCode: clean(req.query.region || "VN", 4), relevanceLanguage: clean(req.query.language || "vi", 10) });
    const pageToken = clean(req.query.pageToken, 200); if (pageToken) params.set("pageToken", pageToken);
    const data = await readJson(`${YOUTUBE_SEARCH_ENDPOINT}?${params}`);
    return { provider: "youtube", action, type, query, quotaCost: 100, nextPageToken: clean(data.nextPageToken, 200), previousPageToken: clean(data.prevPageToken, 200), total: Number(data.pageInfo?.totalResults || 0), items: (Array.isArray(data.items) ? data.items : []).map((item) => ({ id: clean(item.id?.videoId || item.id?.channelId || item.id?.playlistId, 128), resourceType: type, title: clean(item.snippet?.title, 300), description: clean(item.snippet?.description, 1000), channel: clean(item.snippet?.channelTitle, 200), channelId: clean(item.snippet?.channelId, 128), publishedAt: clean(item.snippet?.publishedAt, 40), thumbnail: clean(item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url, 2000) })).filter((item) => item.id) };
  }
  if (action === "popular") {
    const region = /^[A-Z]{2}$/.test(String(req.query.region || "")) ? String(req.query.region) : "VN";
    const params = new URLSearchParams({ key, part: "snippet,contentDetails,statistics,status", chart: "mostPopular", regionCode: region, maxResults: String(Math.max(1, Math.min(25, Number(req.query.maxResults || 18)))) });
    const categoryId = clean(req.query.categoryId, 12); if (/^\d{1,4}$/.test(categoryId)) params.set("videoCategoryId", categoryId);
    const data = await readJson(`${YOUTUBE_VIDEOS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, region, categoryId, quotaCost: 1, items: (Array.isArray(data.items) ? data.items : []).map((item) => ({ id: clean(item.id, 128), title: clean(item.snippet?.title, 300), channel: clean(item.snippet?.channelTitle, 200), channelId: clean(item.snippet?.channelId, 128), description: clean(item.snippet?.description, 1000), publishedAt: clean(item.snippet?.publishedAt, 40), thumbnail: clean(item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url, 2000), duration: isoDuration(item.contentDetails?.duration), views: Number(item.statistics?.viewCount || 0), likes: Number(item.statistics?.likeCount || 0), definition: clean(item.contentDetails?.definition, 20), captions: item.contentDetails?.caption === "true", embeddable: item.status?.embeddable !== false })).filter((item) => item.id && item.embeddable) };
  }
  if (action === "categories") {
    const region = /^[A-Z]{2}$/.test(String(req.query.region || "")) ? String(req.query.region) : "VN";
    const params = new URLSearchParams({ key, part: "snippet", regionCode: region });
    const data = await readJson(`${YOUTUBE_CATEGORIES_ENDPOINT}?${params}`);
    return { provider: "youtube", action, region, quotaCost: 1, items: (Array.isArray(data.items) ? data.items : []).filter((item) => item.snippet?.assignable !== false).map((item) => ({ id: clean(item.id, 12), title: clean(item.snippet?.title, 100) })) };
  }
  if (action === "playlists") {
    const ids = youtubeIds(req.query.id);
    if (!ids.length) return { invalid: "Hãy nhập playlist id hợp lệ." };
    const params = new URLSearchParams({ key, part: "snippet,contentDetails,status", id: ids.join(",") });
    const data = await readJson(`${YOUTUBE_PLAYLISTS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, quotaCost: 1, pageInfo: data.pageInfo || {}, items: data.items || [] };
  }
  if (action === "comments") {
    const videoId = youtubeIds(req.query.videoId, 1)[0];
    if (!videoId) return { invalid: "Hãy nhập video id hợp lệ." };
    const params = new URLSearchParams({ key, part: "snippet", videoId, textFormat: "plainText", order: req.query.order === "time" ? "time" : "relevance", maxResults: String(Math.max(1, Math.min(50, Number(req.query.maxResults || 20)))) });
    const data = await readJson(`${YOUTUBE_COMMENTS_ENDPOINT}?${params}`);
    return { provider: "youtube", action, videoId, quotaCost: 1, publicDataOnly: true, nextPageToken: clean(data.nextPageToken, 200), items: (Array.isArray(data.items) ? data.items : []).map((item) => { const comment = item.snippet?.topLevelComment?.snippet || {}; return { id: clean(item.id, 128), author: clean(comment.authorDisplayName, 200), avatar: clean(comment.authorProfileImageUrl, 2000), text: clean(comment.textDisplay, 2000), likes: Number(comment.likeCount || 0), publishedAt: clean(comment.publishedAt, 40), replyCount: Number(item.snippet?.totalReplyCount || 0) }; }) };
  }
  return { invalid: "Tác vụ YouTube không được hỗ trợ." };
}

module.exports = async function handler(req, res) {
  if (clean(req.query.provider, 30).toLowerCase() === "youtube-publisher") {
    return youtubePublisherHandler(req, res);
  }
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let gateway = null;
  try {
    if (String(req.query.health || "") === "1") {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      return res.status(200).json({ ok: true, services: configuredServices() });
    }

    const provider = clean(req.query.provider, 30).toLowerCase();
    const action = clean(req.query.action || "search", 40).toLowerCase();
    const query = clean(req.query.q, 180);
    if (!new Set(["google", "youtube", "japanese"]).has(provider)) return res.status(404).json({ error: "Dịch vụ tìm kiếm không tồn tại." });
    const googleActions = new Set(["search", "capabilities", "books", "places"]);
    if (provider === "japanese" && action !== "search") return res.status(400).json({ error: "Japanese Dictionary chỉ hỗ trợ action=search." });
    if (provider === "google" && !googleActions.has(action)) return res.status(400).json({ error: "Tác vụ Google không được hỗ trợ." });
    if (action === "search" && !query) return res.status(400).json({ error: "Hãy nhập nội dung cần tìm." });
    const resourceCanRunWithoutSearchProvider = provider === "google" && new Set(["capabilities", "books", "places"]).has(action);
    if (!resourceCanRunWithoutSearchProvider && !serverProviderConfigured(provider)) {
      return res.status(503).json({
        error: `${provider === "google" ? "Google Search" : "YouTube Search"} chưa được kết nối trên máy chủ.`,
        code: "SEARCH_NOT_CONFIGURED", provider,
        required: provider === "google" ? ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"] : ["YOUTUBE_API_KEY"]
      });
    }

    if (provider === "japanese") {
      const result = await japaneseSearch(query);
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json(result);
    }

    gateway = await beginGateway(req, res, { provider, action });
    const result = provider === "google" ? action === "search" ? await googleSearch(req, query) : await googleResource(req, action) : action === "search" ? await youtubeSearch(req, query) : await youtubeResource(req, action);
    if (result.invalid) return res.status(400).json({ error: result.invalid });
    if (result.notConfigured) {
      return res.status(503).json({
        error: `${provider === "google" ? "Google Search" : "YouTube Search"} chưa được kết nối trên máy chủ.`,
        code: "SEARCH_NOT_CONFIGURED",
        provider,
        required: result.required
      });
    }
    await gateway.complete("success", 200);
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json(result);
  } catch (error) {
    await gateway?.complete("failed", Number(error?.statusCode || 500), clean(error?.code || "SEARCH_FAILED", 80)).catch(() => {});
    console.error("Search API error", error?.message || error);
    return res.status(Number(error?.statusCode || 500)).json({
      error: clean(error?.message || "Máy chủ không thể xử lý yêu cầu.", 300),
      code: clean(error?.code || "SEARCH_FAILED", 80)
    });
  }
};

module.exports.__test = Object.freeze({ normalizeJapaneseEntry, japaneseSearch });
