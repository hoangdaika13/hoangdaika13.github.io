const { clean, enforceRateLimit } = require("./platform");

const API = "https://otruyenapi.com/v1/api";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUEST_TIMEOUT_MS = 12_000;

function fail(message, statusCode = 400, code = "OTRUYEN_REQUEST_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

function catalogRequest(query) {
  const page = Math.min(5_000, Math.max(1, Number(query.page) || 1));
  const q = clean(query.q, 120);
  const genre = clean(query.genre, 80).toLowerCase();
  const filter = ["all", "ongoing", "completed"].includes(query.filter) ? query.filter : "all";
  const sort = ["updated", "popular", "az", "za"].includes(query.sort) ? query.sort : "updated";
  let basePath;
  const params = new URLSearchParams({ page: String(page) });
  if (q.length >= 2) { basePath = "/tim-kiem"; params.set("keyword", q); }
  else if (genre && SLUG.test(genre)) basePath = `/the-loai/${encodeURIComponent(genre)}`;
  else if (filter === "completed") basePath = "/danh-sach/hoan-thanh";
  else if (filter === "ongoing") basePath = "/danh-sach/dang-phat-hanh";
  else basePath = "/danh-sach/truyen-moi";
  if (sort === "az" || sort === "za") {
    params.set("sort_field", "name");
    params.set("sort_type", sort === "az" ? "asc" : "desc");
  } else if (sort === "popular") {
    params.set("sort_field", "views");
    params.set("sort_type", "desc");
  } else {
    params.set("sort_field", "updatedAt");
    params.set("sort_type", "desc");
  }
  return { path: `${basePath}?${params}`, page, q, genre, filter, sort };
}

async function upstream(path) {
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
    fail(error?.name === "AbortError" ? "Nguồn OTruyen phản hồi quá chậm." : "Không thể kết nối nguồn OTruyen.", 502, "OTRUYEN_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) fail(`Nguồn OTruyen phản hồi HTTP ${response.status}.`, response.status === 429 ? 429 : 502, "OTRUYEN_HTTP_ERROR");
  const payload = await response.json().catch(() => null);
  if (!payload || payload.status !== "success" || !payload.data) fail("Nguồn OTruyen trả về dữ liệu không hợp lệ.", 502, "OTRUYEN_RESPONSE_INVALID");
  return payload.data;
}

function allowedChapterUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    const allowedHost = hostname === "otruyenapi.com" || hostname.endsWith(".otruyencdn.com");
    return url.protocol === "https:"
      && allowedHost
      && /^\/v1\/api\/chapter\/[a-z0-9-]+\/?$/i.test(url.pathname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

async function chapterPages(query) {
  const chapterUrl = clean(query.url, 900);
  if (!allowedChapterUrl(chapterUrl)) fail("URL chapter OTruyen không hợp lệ hoặc không được phép.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(chapterUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/json", "User-Agent": "hoang8.com-HH-Comics/1.0" }
    });
  } catch (error) {
    fail(error?.name === "AbortError" ? "Máy chủ chapter phản hồi quá chậm." : "Không thể kết nối máy chủ chapter.", 502, "OTRUYEN_CHAPTER_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) fail(`Máy chủ chapter phản hồi HTTP ${response.status}.`, response.status === 429 ? 429 : 502, "OTRUYEN_CHAPTER_HTTP_ERROR");
  const payload = await response.json().catch(() => null);
  const data = payload?.data;
  if (!data?.item?.chapter_path || !Array.isArray(data.item.chapter_image)) fail("Chapter chưa có danh sách ảnh hợp lệ.", 502, "OTRUYEN_CHAPTER_INVALID");
  return { provider: "otruyen", backend: true, data };
}

function sortItems(items, sort) {
  const rows = Array.isArray(items) ? [...items] : [];
  if (sort === "az" || sort === "za") rows.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi", { numeric: true, sensitivity: "base" }) * (sort === "za" ? -1 : 1));
  else if (sort === "popular") rows.sort((a, b) => Number(b?.view || b?.views || 0) - Number(a?.view || a?.views || 0));
  else rows.sort((a, b) => Date.parse(b?.updatedAt || 0) - Date.parse(a?.updatedAt || 0));
  return rows;
}

async function catalog(query) {
  const request = catalogRequest(query);
  const data = await upstream(request.path);
  return {
    provider: "otruyen",
    sourceUrl: "https://otruyenapi.com/",
    backend: true,
    backendSort: request.sort,
    page: request.page,
    data: { ...data, items: sortItems(data.items, request.sort) }
  };
}

async function series(query) {
  const id = clean(query.id, 100).toLowerCase();
  if (!SLUG.test(id)) fail("Mã truyện OTruyen không hợp lệ.");
  return { provider: "otruyen", backend: true, data: await upstream(`/truyen-tranh/${encodeURIComponent(id)}`) };
}

async function genres() {
  return { provider: "otruyen", backend: true, data: await upstream("/the-loai") };
}

async function handleOTruyenSource(req, res, { db }) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `otruyen-public:${requestIp(req)}`, 300, 15 * 60 * 1000);
  const action = clean(req.query.action || "catalog", 30);
  let result;
  if (action === "catalog") result = await catalog(req.query);
  else if (action === "series") result = await series(req.query);
  else if (action === "genres") result = await genres();
  else if (action === "pages") result = await chapterPages(req.query);
  else fail("Tác vụ OTruyen không được hỗ trợ.");
  res.setHeader("Cache-Control", action === "series" ? "public, s-maxage=300, stale-while-revalidate=600" : "public, s-maxage=180, stale-while-revalidate=300");
  return res.status(200).json({ ok: true, ...result });
}

module.exports = { handleOTruyenSource, catalogRequest, sortItems, allowedChapterUrl, chapterPages, SLUG };
