const { clean, enforceRateLimit } = require("./platform");

const WIKIBOOKS_API = "https://vi.wikibooks.org/w/api.php";
const LICENSE = Object.freeze({
  code: "CC-BY-SA-4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution: "Các tác giả Wikibooks tiếng Việt · CC BY-SA 4.0"
});

function fail(message, statusCode = 400, code = "OPEN_BOOKS_REQUEST_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

function catalogUrl(query = {}) {
  const q = clean(query.q, 120);
  const limit = Math.min(40, Math.max(8, Number(query.limit) || 24));
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", utf8: "1", redirects: "1",
    prop: "extracts|info", exintro: "1", explaintext: "1", exchars: "420", inprop: "url"
  });
  if (q.length >= 2) {
    params.set("generator", "search");
    params.set("gsrsearch", q);
    params.set("gsrnamespace", "0");
    params.set("gsrlimit", String(limit));
  } else {
    params.set("generator", "categorymembers");
    params.set("gcmtitle", "Thể loại:Sách");
    params.set("gcmnamespace", "0");
    params.set("gcmlimit", String(limit));
    params.set("gcmtype", "page");
  }
  return { url: `${WIKIBOOKS_API}?${params}`, q, limit };
}

async function catalog(query = {}) {
  const request = catalogUrl(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response;
  try {
    response = await fetch(request.url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "hoang8.com-HH-Open-Books/1.0" }
    });
  } catch (error) {
    fail(error?.name === "AbortError" ? "Wikibooks phản hồi quá chậm." : "Không thể kết nối Wikibooks tiếng Việt.", 502, "OPEN_BOOKS_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) fail(`Wikibooks phản hồi HTTP ${response.status}.`, 502, "OPEN_BOOKS_HTTP_ERROR");
  const payload = await response.json().catch(() => null);
  if (!payload?.query || payload?.error) fail("Wikibooks trả về dữ liệu không hợp lệ.", 502, "OPEN_BOOKS_RESPONSE_INVALID");
  const items = (Array.isArray(payload.query.pages) ? payload.query.pages : []).filter((page) => page?.pageid && /^https:\/\/vi\.wikibooks\.org\/wiki\//i.test(page.fullurl || "")).map((page) => ({
    id: String(page.pageid),
    title: clean(page.title, 240),
    description: clean(page.extract || "Sách và tài liệu học tập mở trên Wikibooks tiếng Việt.", 700),
    sourceUrl: page.fullurl,
    updatedAt: null,
    language: "vi",
    format: "Sách mở",
    genres: ["Sách mở", "Giáo dục", "Kiến thức"],
    license: LICENSE
  }));
  return {
    provider: "wikibooks-vi",
    sourceUrl: "https://vi.wikibooks.org/",
    storesContent: false,
    storesImages: false,
    total: items.length,
    items,
    license: LICENSE
  };
}

async function handleOpenBooksSource(req, res, { db }) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await enforceRateLimit(db, `open-books-public:${requestIp(req)}`, 180, 15 * 60 * 1000);
  const action = clean(req.query.action || "catalog", 30);
  if (action !== "catalog") fail("Tác vụ sách mở không được hỗ trợ.");
  const result = await catalog(req.query);
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");
  return res.status(200).json({ ok: true, policy: { mode: "official-api-metadata", fullTextStored: false, worldwideLicenseRequired: true }, ...result });
}

module.exports = { handleOpenBooksSource, catalogUrl, catalog, LICENSE, WIKIBOOKS_API };
