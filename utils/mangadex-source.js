const { clean, enforceRateLimit } = require("./platform");

const API = "https://api.mangadex.org";
const COVER_CDN = "https://uploads.mangadex.org/covers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 12_000;
const ALLOWED_RATINGS = new Set(["safe", "suggestive"]);

function fail(message, statusCode = 400, code = "MANGADEX_REQUEST_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

function firstText(value, fallback = "") {
  if (!value || typeof value !== "object") return fallback;
  for (const key of ["vi", "en", "ja-ro", "ja", "ko-ro", "ko", "zh-hk", "zh"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return Object.values(value).find((entry) => typeof entry === "string" && entry.trim())?.trim() || fallback;
}

function relationship(entity, type) {
  return (Array.isArray(entity?.relationships) ? entity.relationships : []).find((entry) => entry?.type === type) || null;
}

function isAllowedRating(value) {
  return ALLOWED_RATINGS.has(String(value || "").toLowerCase());
}

function assertAllowedSeries(entity) {
  if (!isAllowedRating(entity?.attributes?.contentRating)) {
    fail("Truyện MangaDex này nằm ngoài bộ lọc nội dung của HH Comics.", 403, "MANGADEX_CONTENT_BLOCKED");
  }
}

function coverOf(entity) {
  const cover = relationship(entity, "cover_art");
  const fileName = clean(cover?.attributes?.fileName, 300);
  return fileName && UUID.test(entity?.id) ? `${COVER_CDN}/${entity.id}/${encodeURIComponent(fileName)}.512.jpg` : "";
}

function mapSeries(entity) {
  const attributes = entity?.attributes || {};
  const author = relationship(entity, "author");
  const altTitles = (Array.isArray(attributes.altTitles) ? attributes.altTitles : []).map((entry) => firstText(entry)).filter(Boolean);
  const title = firstText(attributes.title, "Truyện chưa đặt tên");
  return {
    id: clean(entity?.id, 80),
    title,
    altTitles: [...new Set(altTitles.filter((entry) => entry !== title))].slice(0, 24),
    author: clean(author?.attributes?.name || "Đang cập nhật", 200),
    cover: coverOf(entity),
    description: firstText(attributes.description, "Dữ liệu truyện được phát trực tiếp từ MangaDex."),
    status: clean(attributes.status, 40),
    year: Number(attributes.year) || null,
    contentRating: clean(attributes.contentRating || "safe", 40),
    tags: (Array.isArray(attributes.tags) ? attributes.tags : []).map((tag) => firstText(tag?.attributes?.name)).filter(Boolean).slice(0, 30),
    updatedAt: clean(attributes.updatedAt, 80),
    latestUploadedChapter: clean(attributes.latestUploadedChapter, 80),
    lastChapter: clean(attributes.lastChapter, 40),
    chapterCountEstimate: Math.max(0, Number(String(attributes.lastChapter || "").replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] || 0)),
    sourceUrl: UUID.test(entity?.id) ? `https://mangadex.org/title/${entity.id}` : ""
  };
}

function mapChapter(entity) {
  const attributes = entity?.attributes || {};
  const group = relationship(entity, "scanlation_group");
  return {
    id: clean(entity?.id, 80),
    volume: clean(attributes.volume, 40),
    number: clean(attributes.chapter || "Oneshot", 40),
    title: clean(attributes.title, 240),
    translatedLanguage: clean(attributes.translatedLanguage, 20),
    pages: Math.max(0, Number(attributes.pages) || 0),
    publishAt: clean(attributes.publishAt || attributes.readableAt || attributes.createdAt, 80),
    updatedAt: clean(attributes.updatedAt, 80),
    group: clean(group?.attributes?.name || "Nhóm dịch chưa xác định", 200),
    sourceUrl: UUID.test(entity?.id) ? `https://mangadex.org/chapter/${entity.id}` : ""
  };
}

async function mangaDexJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "hoang8.com-HH-Comics/1.0" }
    });
  } catch (error) {
    fail(error?.name === "AbortError" ? "MangaDex phản hồi quá chậm." : "Không thể kết nối MangaDex.", 502, "MANGADEX_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) fail(`MangaDex phản hồi HTTP ${response.status}.`, response.status === 429 ? 429 : 502, "MANGADEX_HTTP_ERROR");
  const payload = await response.json().catch(() => null);
  if (!payload || payload.result === "error") fail("MangaDex trả về dữ liệu không hợp lệ.", 502, "MANGADEX_RESPONSE_INVALID");
  return payload;
}

function catalogPath(query) {
  const limit = Math.min(48, Math.max(4, Number(query.limit) || 24));
  const offset = Math.min(10_000, Math.max(0, Number(query.offset) || 0));
  const title = clean(query.q, 120);
  const sort = ["smart", "chapters", "updated", "popular", "az", "za"].includes(query.sort) ? query.sort : "smart";
  const filter = ["all", "ongoing", "completed"].includes(query.filter) ? query.filter : "all";
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), hasAvailableChapters: "true" });
  if (sort === "az" || sort === "za") params.set("order[title]", sort === "az" ? "asc" : "desc");
  else if (sort === "popular") params.set("order[followedCount]", "desc");
  else params.set("order[latestUploadedChapter]", "desc");
  params.append("availableTranslatedLanguage[]", "vi");
  params.append("includes[]", "cover_art");
  params.append("includes[]", "author");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  if (filter === "completed") params.append("status[]", "completed");
  else if (filter === "ongoing") params.append("status[]", "ongoing");
  if (title) params.set("title", title);
  return { path: `/manga?${params}`, limit, offset, sort, filter };
}

async function catalog(query) {
  const request = catalogPath(query);
  const payload = await mangaDexJson(request.path);
  const items = (Array.isArray(payload.data) ? payload.data : []).filter((entry) => isAllowedRating(entry?.attributes?.contentRating)).map(mapSeries).filter((entry) => UUID.test(entry.id));
  if (request.sort === "chapters") items.sort((a, b) => { const aShort = a.chapterCountEstimate > 0 && a.chapterCountEstimate < 10; const bShort = b.chapterCountEstimate > 0 && b.chapterCountEstimate < 10; return aShort !== bShort ? aShort ? 1 : -1 : b.chapterCountEstimate - a.chapterCountEstimate || Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0); });
  else if (request.sort === "smart") items.sort((a, b) => { const aShort = a.chapterCountEstimate > 0 && a.chapterCountEstimate < 10; const bShort = b.chapterCountEstimate > 0 && b.chapterCountEstimate < 10; const aActive = a.status === "ongoing"; const bActive = b.status === "ongoing"; return aShort !== bShort ? aShort ? 1 : -1 : aActive !== bActive ? aActive ? -1 : 1 : b.chapterCountEstimate - a.chapterCountEstimate || Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0); });
  return {
    provider: "mangadex",
    sourceUrl: "https://mangadex.org/",
    total: Math.max(0, Number(payload.total) || 0),
    offset: Math.max(0, Number(payload.offset) || request.offset),
    limit: Math.max(1, Number(payload.limit) || request.limit),
    items
  };
}

async function series(query) {
  const id = clean(query.id, 80);
  if (!UUID.test(id)) fail("MangaDex series ID không hợp lệ.");
  const mangaParams = new URLSearchParams();
  mangaParams.append("includes[]", "cover_art");
  mangaParams.append("includes[]", "author");
  mangaParams.append("includes[]", "artist");
  const feedParams = new URLSearchParams({ limit: "100", offset: "0", includeFutureUpdates: "0", includeEmptyPages: "0", includeExternalUrl: "0", "order[volume]": "desc", "order[chapter]": "desc" });
  feedParams.append("translatedLanguage[]", "vi");
  feedParams.append("includes[]", "scanlation_group");
  const [manga, feed] = await Promise.all([
    mangaDexJson(`/manga/${id}?${mangaParams}`),
    mangaDexJson(`/manga/${id}/feed?${feedParams}`)
  ]);
  assertAllowedSeries(manga.data);
  return {
    provider: "mangadex",
    series: mapSeries(manga.data),
    chapterTotal: Math.max(0, Number(feed.total) || 0),
    chapters: (Array.isArray(feed.data) ? feed.data : []).map(mapChapter).filter((entry) => UUID.test(entry.id) && entry.pages > 0)
  };
}

async function chapterPages(query) {
  const id = clean(query.id, 80);
  if (!UUID.test(id)) fail("MangaDex chapter ID không hợp lệ.");
  const chapterParams = new URLSearchParams();
  chapterParams.append("includes[]", "manga");
  const chapter = await mangaDexJson(`/chapter/${id}?${chapterParams}`);
  if (chapter.data?.attributes?.translatedLanguage !== "vi") {
    fail("HH Comics chỉ phát chương MangaDex tiếng Việt.", 403, "MANGADEX_LANGUAGE_BLOCKED");
  }
  const manga = relationship(chapter.data, "manga");
  assertAllowedSeries(manga);
  const payload = await mangaDexJson(`/at-home/server/${id}?forcePort443=true`);
  const baseUrl = clean(payload.baseUrl, 1000).replace(/\/$/, "");
  const hash = clean(payload.chapter?.hash, 200);
  const files = Array.isArray(payload.chapter?.dataSaver) && payload.chapter.dataSaver.length
    ? payload.chapter.dataSaver
    : Array.isArray(payload.chapter?.data) ? payload.chapter.data : [];
  if (!/^https:\/\//i.test(baseUrl) || !hash || !files.length) fail("Chapter MangaDex chưa có ảnh đọc.", 404, "MANGADEX_PAGES_EMPTY");
  return {
    provider: "mangadex",
    chapterId: id,
    quality: payload.chapter?.dataSaver?.length ? "data-saver" : "data",
    pages: files.slice(0, 500).map((file) => `${baseUrl}/${payload.chapter?.dataSaver?.length ? "data-saver" : "data"}/${encodeURIComponent(hash)}/${encodeURIComponent(clean(file, 300))}`)
  };
}

async function handleMangaDexSource(req, res, { db }) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `mangadex-public:${requestIp(req)}`, 240, 15 * 60 * 1000);
  const action = clean(req.query.action || "catalog", 30);
  let result;
  if (action === "catalog") result = await catalog(req.query);
  else if (action === "series") result = await series(req.query);
  else if (action === "pages") result = await chapterPages(req.query);
  else fail("MangaDex action không được hỗ trợ.");
  res.setHeader("Cache-Control", action === "pages" ? "public, s-maxage=180, stale-while-revalidate=120" : "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json({ ok: true, policy: { languages: ["vi"], contentRatings: ["safe", "suggestive"], storesImages: false, attributionRequired: true }, ...result });
}

module.exports = { handleMangaDexSource, mapSeries, mapChapter, catalogPath, isAllowedRating, UUID };
