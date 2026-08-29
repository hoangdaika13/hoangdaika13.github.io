"use strict";

const ALLOWED_SOURCES = new Set([
  "asteroids",
  "earth-events",
  "exoplanets",
  "horizons",
  "media",
  "space-weather"
]);
const HORIZONS_TARGETS = Object.freeze({
  mercury: "199", venus: "299", earth: "399", moon: "301", mars: "499",
  jupiter: "599", saturn: "699", uranus: "799", neptune: "899", pluto: "999"
});
const WEATHER_TYPES = new Set(["FLR", "CME", "GST", "SEP"]);
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 80;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const memoryCache = new Map();
const rateBuckets = new Map();

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value, max = 160) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isoDay(value, fallback) {
  const raw = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : fallback;
}

function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function boundedDateRange(query, maxDays = 31) {
  const today = new Date().toISOString().slice(0, 10);
  const start = isoDay(first(query.start || query["date-min"]), today);
  let end = isoDay(first(query.end || query["date-max"]), addDays(start, 7));
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (endTime < startTime || endTime - startTime > maxDays * 86_400_000) end = addDays(start, maxDays);
  return { start, end };
}

function numberParam(value, fallback, min, max) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function clientId(req) {
  const forwarded = cleanText(req.headers?.["x-forwarded-for"], 180).split(",")[0].trim();
  return forwarded || cleanText(req.socket?.remoteAddress || "anonymous", 120);
}

function enforceRateLimit(req) {
  const now = Date.now();
  const id = clientId(req);
  const bucket = rateBuckets.get(id);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(id, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function setHeaders(res, cacheSeconds = 60) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", `public, max-age=${Math.min(60, cacheSeconds)}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`);
  res.setHeader("Vary", "Accept-Encoding");
}

function send(res, status, payload, cacheSeconds = 0) {
  setHeaders(res, cacheSeconds);
  res.status(status).json(payload);
}

async function fetchJson(url, options = {}) {
  const ttl = Math.max(10_000, Number(options.ttl || 300_000));
  const cacheKey = String(url);
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { value: cached.value, cacheStatus: "memory-hit" };

  let lastError;
  for (let attempt = 0; attempt < Math.max(1, Number(options.retries || 2)); attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(2_000, Number(options.timeout || 9_000)));
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "HH-Cosmic-Observatory/1.0 (hoang8.com)" },
        signal: controller.signal
      });
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_RESPONSE_BYTES) throw new Error("Upstream response is too large.");
      if (!response.ok) {
        const error = new Error(`Upstream returned ${response.status}.`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("Upstream response is too large.");
      const value = JSON.parse(text);
      memoryCache.set(cacheKey, { value, expiresAt: Date.now() + ttl });
      return { value, cacheStatus: "upstream" };
    } catch (error) {
      lastError = error;
      if (!error.retryable && error.name !== "AbortError") break;
      if (attempt + 1 < Math.max(1, Number(options.retries || 2))) {
        await new Promise((resolve) => setTimeout(resolve, 160 * (2 ** attempt) + Math.floor(Math.random() * 90)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  if (cached) return { value: cached.value, cacheStatus: "stale-memory" };
  throw lastError || new Error("Không thể kết nối nguồn dữ liệu.");
}

function envelope({ sourceName, sourceUrl, cacheStatus, data, observedAt = null, validFor = null, coordinateFrame = null, timeScale = "UTC", units = null, uncertainty = null, attribution, usagePolicy, dataQuality = "official-upstream", dataType = "observed" }) {
  return {
    ok: true,
    sourceName,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    observedAt,
    validFor,
    coordinateFrame,
    timeScale,
    units,
    uncertainty,
    attribution,
    usagePolicy,
    cacheStatus,
    dataQuality,
    dataType,
    data
  };
}

function rowsFromFields(payload) {
  const fields = Array.isArray(payload?.fields) ? payload.fields.map(String) : [];
  return (Array.isArray(payload?.data) ? payload.data : []).map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
}

async function asteroids(query) {
  const { start, end } = boundedDateRange(query, 31);
  const distanceAu = numberParam(query.distance, 0.2, 0.001, 0.5);
  const url = new URL("https://ssd-api.jpl.nasa.gov/cad.api");
  url.searchParams.set("date-min", start);
  url.searchParams.set("date-max", end);
  url.searchParams.set("dist-max", String(distanceAu));
  url.searchParams.set("diameter", "true");
  url.searchParams.set("fullname", "true");
  url.searchParams.set("sort", "date");
  const result = await fetchJson(url, { ttl: 15 * 60_000 });
  const records = rowsFromFields(result.value).slice(0, 180).map((item) => ({
    designation: cleanText(item.des, 80),
    name: cleanText(item.fullname || item.des, 140),
    closeApproach: cleanText(item.cd, 40),
    distanceAu: Number(item.dist),
    distanceMinAu: Number(item.dist_min),
    distanceMaxAu: Number(item.dist_max),
    relativeVelocityKps: Number(item.v_rel),
    absoluteMagnitude: Number(item.h),
    diameterKm: Number(item.diameter),
    orbitReference: cleanText(item.orbit_id, 60)
  })).filter((item) => item.name && Number.isFinite(item.distanceAu));
  return envelope({
    sourceName: "JPL CNEOS Close-Approach Data",
    sourceUrl: url.toString(),
    cacheStatus: result.cacheStatus,
    validFor: { start, end },
    coordinateFrame: "close-approach solution reported by JPL CNEOS",
    units: { distance: "au", velocity: "km/s", diameter: "km" },
    uncertainty: "Khoảng dist_min–dist_max khi nguồn cung cấp; feed CAD không tự suy ra xác suất va chạm.",
    attribution: "NASA/JPL-Caltech CNEOS",
    usagePolicy: "https://ssd-api.jpl.nasa.gov/doc/cad.html",
    data: { count: records.length, records }
  });
}

async function media(query) {
  const q = cleanText(first(query.q) || "nebula", 100) || "nebula";
  const page = numberParam(query.page, 1, 1, 25);
  const allowedTypes = new Set(["image", "video", "audio"]);
  const requestedType = cleanText(first(query.type), 20);
  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  if (allowedTypes.has(requestedType)) url.searchParams.set("media_type", requestedType);
  const result = await fetchJson(url, { ttl: 30 * 60_000 });
  const items = (result.value?.collection?.items || []).slice(0, 36).map((item) => {
    const data = item?.data?.[0] || {};
    const preview = (item?.links || []).find((link) => ["preview", "thumbnail"].includes(link?.rel)) || item?.links?.[0] || {};
    return {
      nasaId: cleanText(data.nasa_id, 100),
      title: cleanText(data.title, 220),
      description: cleanText(data.description || data.description_508, 1200),
      mediaType: cleanText(data.media_type, 20),
      dateCreated: cleanText(data.date_created, 40),
      center: cleanText(data.center, 80),
      photographer: cleanText(data.photographer || data.secondary_creator, 160),
      keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 16).map((keyword) => cleanText(keyword, 60)) : [],
      previewUrl: /^https:\/\//.test(preview.href || "") ? preview.href : "",
      assetEndpoint: cleanText(item.href, 300)
    };
  }).filter((item) => item.nasaId && item.title);
  return envelope({
    sourceName: "NASA Image and Video Library",
    sourceUrl: url.toString(),
    cacheStatus: result.cacheStatus,
    units: null,
    attribution: "NASA Image and Video Library; quyền sử dụng phải được kiểm tra theo từng mục.",
    usagePolicy: "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf",
    data: { query: q, page, totalHits: Number(result.value?.collection?.metadata?.total_hits || items.length), items }
  });
}

async function exoplanets(query) {
  const q = cleanText(first(query.q), 80).toLocaleLowerCase("en");
  const adql = "select top 120 pl_name,hostname,disc_year,discoverymethod,pl_rade,pl_bmasse,pl_orbper,pl_eqt,sy_dist from pscomppars where pl_name is not null order by disc_year desc";
  const url = new URL("https://exoplanetarchive.ipac.caltech.edu/TAP/sync");
  url.searchParams.set("query", adql);
  url.searchParams.set("format", "json");
  const result = await fetchJson(url, { ttl: 6 * 60 * 60_000, timeout: 12_000 });
  const records = (Array.isArray(result.value) ? result.value : []).map((item) => ({
    name: cleanText(item.pl_name, 140), host: cleanText(item.hostname, 140), discoveryYear: Number(item.disc_year),
    discoveryMethod: cleanText(item.discoverymethod, 100), radiusEarth: Number(item.pl_rade), massEarth: Number(item.pl_bmasse),
    orbitalPeriodDays: Number(item.pl_orbper), equilibriumTemperatureK: Number(item.pl_eqt), distanceParsec: Number(item.sy_dist)
  })).filter((item) => item.name && (!q || `${item.name} ${item.host} ${item.discoveryMethod}`.toLocaleLowerCase("en").includes(q))).slice(0, 60);
  return envelope({
    sourceName: "NASA Exoplanet Archive",
    sourceUrl: url.toString(),
    cacheStatus: result.cacheStatus,
    coordinateFrame: "catalogue fields; see archive column definitions",
    units: { radius: "Earth radii", mass: "Earth masses", period: "days", temperature: "K", distance: "pc" },
    uncertainty: "Các trường trống hoặc giới hạn đo không được tự suy diễn.",
    attribution: "NASA Exoplanet Science Institute / Caltech IPAC",
    usagePolicy: "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html",
    data: { count: records.length, records }
  });
}

async function earthEvents(query) {
  const limit = numberParam(query.limit, 60, 1, 100);
  const url = new URL("https://eonet.gsfc.nasa.gov/api/v3/events");
  url.searchParams.set("status", cleanText(query.status, 12) === "closed" ? "closed" : "open");
  url.searchParams.set("limit", String(limit));
  const result = await fetchJson(url, { ttl: 20 * 60_000 });
  const events = (result.value?.events || []).slice(0, limit).map((event) => ({
    id: cleanText(event.id, 80), title: cleanText(event.title, 180), description: cleanText(event.description, 500),
    categories: (event.categories || []).slice(0, 6).map((category) => ({ id: cleanText(category.id, 60), title: cleanText(category.title, 100) })),
    closed: cleanText(event.closed, 40) || null,
    geometry: (event.geometry || []).slice(-6).map((entry) => ({ date: cleanText(entry.date, 40), type: cleanText(entry.type, 30), coordinates: Array.isArray(entry.coordinates) ? entry.coordinates.slice(0, 3).map(Number) : [] }))
  })).filter((event) => event.id && event.title);
  return envelope({
    sourceName: "NASA EONET v3",
    sourceUrl: url.toString(),
    cacheStatus: result.cacheStatus,
    observedAt: events[0]?.geometry?.at(-1)?.date || null,
    coordinateFrame: "GeoJSON longitude/latitude where applicable",
    units: { coordinates: "degrees" },
    uncertainty: "EONET aggregates event reports and can update after the event begins.",
    attribution: "NASA Earth Observatory Natural Event Tracker",
    usagePolicy: "https://eonet.gsfc.nasa.gov/docs/v3",
    data: { count: events.length, events }
  });
}

async function spaceWeather(query) {
  const { start, end } = boundedDateRange(query, 30);
  const type = WEATHER_TYPES.has(cleanText(query.type, 8).toUpperCase()) ? cleanText(query.type, 8).toUpperCase() : "FLR";
  const apiKey = cleanText(process.env.NASA_API_KEY || "DEMO_KEY", 160);
  const url = new URL(`https://api.nasa.gov/DONKI/${type}`);
  url.searchParams.set("startDate", start);
  url.searchParams.set("endDate", end);
  url.searchParams.set("api_key", apiKey);
  const publicUrl = new URL(url);
  publicUrl.searchParams.set("api_key", "SERVER_SIDE_KEY");
  const result = await fetchJson(url, { ttl: 15 * 60_000 });
  const records = (Array.isArray(result.value) ? result.value : []).slice(0, 100).map((item) => ({
    id: cleanText(item.flrID || item.activityID || item.gstID || item.sepID || item.cmeID, 120),
    beginTime: cleanText(item.beginTime || item.startTime, 50),
    peakTime: cleanText(item.peakTime, 50),
    endTime: cleanText(item.endTime, 50),
    classType: cleanText(item.classType, 40),
    sourceLocation: cleanText(item.sourceLocation, 80),
    activeRegionNum: Number(item.activeRegionNum),
    link: /^https:\/\//.test(item.link || "") ? item.link : ""
  }));
  return envelope({
    sourceName: `NASA DONKI ${type}`,
    sourceUrl: publicUrl.toString(),
    cacheStatus: result.cacheStatus,
    validFor: { start, end },
    coordinateFrame: null,
    units: null,
    uncertainty: "Sự kiện DONKI có thể được hiệu chỉnh sau khi công bố.",
    attribution: "NASA Space Weather Database Of Notifications, Knowledge, Information",
    usagePolicy: "https://api.nasa.gov/",
    data: { type, count: records.length, records }
  });
}

async function horizons(query) {
  const targetKey = cleanText(first(query.target) || "mars", 20).toLowerCase();
  const target = HORIZONS_TARGETS[targetKey];
  if (!target) throw Object.assign(new Error("Thiên thể Horizons không nằm trong danh sách cho phép."), { statusCode: 400 });
  const { start, end } = boundedDateRange(query, 62);
  const stepDays = Math.round(numberParam(query.step, 1, 1, 7));
  const url = new URL("https://ssd.jpl.nasa.gov/api/horizons.api");
  const params = {
    format: "json", COMMAND: `'${target}'`, EPHEM_TYPE: "VECTORS", CENTER: "'500@10'",
    START_TIME: `'${start}'`, STOP_TIME: `'${end}'`, STEP_SIZE: `'${stepDays} d'`,
    OUT_UNITS: "'AU-D'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'"
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const result = await fetchJson(url, { ttl: 12 * 60 * 60_000, timeout: 14_000 });
  return envelope({
    sourceName: "JPL Horizons",
    sourceUrl: url.toString(),
    cacheStatus: result.cacheStatus,
    validFor: { start, end, stepDays },
    coordinateFrame: "J2000 ecliptic/equinox unless the returned Horizons header states otherwise",
    timeScale: "TDB as returned by Horizons vector table",
    units: { distance: "au", time: "day" },
    uncertainty: "See Horizons result header and target solution metadata.",
    attribution: "NASA/JPL Solar System Dynamics",
    usagePolicy: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
    dataType: "computed",
    data: { target: targetKey, rawResult: cleanText(result.value?.result, 800_000), signature: result.value?.signature || null }
  });
}

const handlers = { asteroids, media, exoplanets, "earth-events": earthEvents, "space-weather": spaceWeather, horizons };

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, error: "Chỉ hỗ trợ GET." });
  }
  if (!enforceRateLimit(req)) return send(res, 429, { ok: false, error: "Bạn đang gửi yêu cầu quá nhanh. Vui lòng thử lại sau một phút." });
  const source = cleanText(first(req.query?.cosmicSource || req.query?.source), 30).toLowerCase();
  if (!ALLOWED_SOURCES.has(source)) return send(res, 404, { ok: false, error: "Nguồn dữ liệu không được hỗ trợ." });
  try {
    const payload = await handlers[source](req.query || {});
    return send(res, 200, payload, source === "exoplanets" ? 21_600 : 300);
  } catch (error) {
    const status = Number(error.statusCode) || (error.name === "AbortError" ? 504 : 502);
    return send(res, status, {
      ok: false,
      error: status === 400 ? cleanText(error.message, 240) : "Nguồn thiên văn tạm thời không phản hồi. Không có dữ liệu giả được thay thế.",
      source,
      retryable: status >= 500,
      fetchedAt: new Date().toISOString()
    });
  }
}

handler._test = Object.freeze({ ALLOWED_SOURCES, HORIZONS_TARGETS, boundedDateRange, cleanText, envelope, rowsFromFields });

module.exports = handler;
