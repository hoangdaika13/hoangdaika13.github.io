(function initHHComicReaderHub(global) {
  "use strict";

  const STORAGE_KEY = "hh-comic-reader-state-v1";
  const DB_NAME = "hh-comic-reader-library-v1";
  const DB_VERSION = 1;
  const STORE = "series";
  const OTRUYEN_CDN = "https://img.otruyenapi.com";
  const OTRUYEN_PROXY_PATH = "/api/modules/comic-reader/actions";
  const MANGADEX_PROXY_PATH = "/api/modules/comic-reader/actions";
  const OTRUYEN_PAGES_PER_VIEW = 3;
  const GENRES = ["Tất cả", "Hành động", "Phiêu lưu", "Fantasy", "Đời thường", "Bí ẩn", "Hài hước", "Lãng mạn", "Sci-fi", "Webtoon"];
  const PALETTES = [
    ["#172d52", "#6ee7ff", "#a970ff"], ["#3d1838", "#ff7fb8", "#ffbd6c"], ["#143a35", "#65e8ad", "#76b9ff"],
    ["#40251d", "#ff9a5f", "#ffd66e"], ["#241943", "#8f7dff", "#ff73c9"], ["#142f43", "#5ed5ff", "#83ffc9"]
  ];

  let host = null;
  let root = null;
  let keyHandler = null;
  let imageErrorHandler = null;
  let readerObserver = null;
  const blobUrls = new Set();
  const preloadedPageUrls = new Set();

  const state = {
    catalog: [],
    view: "home",
    activeSeriesId: "",
    activeChapterId: "",
    readerMode: "scroll",
    readerPage: 0,
    readerWidth: "fit",
    readerTheme: "dark",
    query: "",
    genre: "Tất cả",
    sort: "smart",
    catalogPage: 1,
    catalogFilter: "all",
    genreExpanded: false,
    follows: new Set(),
    blockedPages: new Set(),
    bookmarks: [],
    recentSeries: [],
    progress: {},
    importing: false,
    remoteGenres: [],
    remoteGenreSlugs: new Map(),
    remote: { loading: false, page: 0, perPage: 72, total: 0, hasMore: true, context: "latest", error: "" },
    mangadex: { loading: false, offset: 0, limit: 48, total: 0, hasMore: true, context: "latest", error: "" }
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const naturalCompare = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
  const slugify = (value) => String(value || "truyen").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "truyen";
  const timeAgo = (timestamp) => {
    const elapsed = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    if (elapsed < 60000) return "vừa xong";
    if (elapsed < 3600000) return `${Math.max(1, Math.floor(elapsed / 60000))} phút trước`;
    const hours = Math.floor(elapsed / 3600000);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days} ngày trước` : `${Math.floor(days / 30)} tháng trước`;
  };
  const stripHtml = (value) => String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  const chapterNumberValue = (value) => {
    const match = String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
    return match ? Math.max(0, Number(match[0]) || 0) : /oneshot|one-shot/i.test(String(value || "")) ? 1 : 0;
  };
  const seriesChapterCount = (series) => {
    if (Number(series?.chapterTotal) > 0) return Number(series.chapterTotal);
    if (Number(series?.chapterCountEstimate) > 0) return Number(series.chapterCountEstimate);
    return Math.max(Number(series?.chapters?.length || 0), ...((series?.chapters || []).map((chapter) => chapterNumberValue(chapter.number))));
  };
  const activityTier = (series) => {
    const ageDays = Math.max(0, (Date.now() - Number(series?.updatedAt || 0)) / 86400000);
    return ageDays <= 2 ? 0 : ageDays <= 7 ? 1 : ageDays <= 30 ? 2 : ageDays <= 90 ? 3 : 4;
  };
  const chapterBand = (count) => Number(count) >= 10 ? 0 : Number(count) > 0 ? 1 : 2;
  const smartCatalogCompare = (a, b) => {
    const aChapters = seriesChapterCount(a); const bChapters = seriesChapterCount(b);
    const bandDifference = chapterBand(aChapters) - chapterBand(bChapters);
    if (bandDifference) return bandDifference;
    const aActive = a.status === "Đang cập nhật"; const bActive = b.status === "Đang cập nhật";
    if (aActive !== bActive) return aActive ? -1 : 1;
    const freshness = activityTier(a) - activityTier(b);
    if (freshness) return freshness;
    if (bChapters !== aChapters) return bChapters - aChapters;
    return Number(b.updatedAt || 0) - Number(a.updatedAt || 0) || naturalCompare(a.title, b.title);
  };
  const coverUrl = (thumb, domain = OTRUYEN_CDN) => {
    const value = String(thumb || "");
    if (/^https?:\/\//i.test(value)) return value;
    return `${String(domain || OTRUYEN_CDN).replace(/\/$/, "")}/uploads/comics/${value.replace(/^\/+/, "")}`;
  };

  function mapRemoteSeries(entry, domain = OTRUYEN_CDN) {
    const latestRows = Array.isArray(entry?.chaptersLatest) ? entry.chaptersLatest : [];
    const latest = [...latestRows].sort((a, b) => chapterNumberValue(b?.chapter_name) - chapterNumberValue(a?.chapter_name))[0];
    const number = String(latest?.chapter_name || "1");
    const chapterCountEstimate = Math.max(0, ...latestRows.map((chapter) => chapterNumberValue(chapter?.chapter_name)));
    return {
      id: `otruyen:${entry.slug}`,
      title: String(entry.name || "Truyện chưa đặt tên"),
      altTitles: Array.isArray(entry.origin_name) ? entry.origin_name.filter(Boolean) : [],
      author: "Đang cập nhật",
      cover: coverUrl(entry.thumb_url, domain),
      genres: Array.isArray(entry.category) ? entry.category.map((category) => String(category.name || "")).filter(Boolean) : [],
      status: entry.status === "completed" ? "Đã hoàn thành" : entry.status === "pending" ? "Tạm dừng" : "Đang cập nhật",
      description: "Nhấn vào truyện để tải mô tả và toàn bộ danh sách chương từ OTruyen API.",
      rating: 4.5,
      views: 0,
      updatedAt: Date.parse(entry.updatedAt) || Date.now(),
      chapters: latest ? [{ id: `otruyen:${entry.slug}:chapter:${number}`, number, title: String(latest.chapter_title || ""), updatedAt: Date.parse(entry.updatedAt) || Date.now(), pages: [], apiUrl: String(latest.chapter_api_data || "") }] : [],
      chapterCountEstimate,
      sourceType: "otruyen",
      sourceLabel: "OTruyen · LIVE",
      remoteSlug: String(entry.slug || ""),
      chaptersLoaded: false,
      rights: "Dữ liệu hiển thị trực tiếp từ backend OTruyen"
    };
  }

  async function fetchOTruyen(action, parameters = {}) {
    const base = String(global.HH_API_ORIGIN || global.location?.origin || "").replace(/\/$/, "");
    const url = new URL(`${base}${OTRUYEN_PROXY_PATH}`);
    url.searchParams.set("provider", "otruyen");
    url.searchParams.set("action", action);
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    const response = await fetch(url, { method: "GET", credentials: "include", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `Backend OTruyen phản hồi HTTP ${response.status}`);
    return payload;
  }

  async function loadRemoteGenres() {
    try {
      const payload = await fetchOTruyen("genres");
      const data = payload.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      state.remoteGenres = items.map((item) => String(item.name || "")).filter(Boolean);
      state.remoteGenreSlugs = new Map(items.map((item) => [String(item.name || ""), String(item.slug || "")]));
      if (root?.isConnected) render();
    } catch {}
  }

  async function loadRemoteCatalog({ page = 1, reset = false } = {}) {
    if (state.remote.loading) return;
    state.remote.loading = true;
    state.remote.error = "";
    if (root?.isConnected) render();
    try {
      const genreSlug = state.remoteGenreSlugs.get(state.genre) || "";
      const upstreamFirstPage = (Math.max(1, Number(page) || 1) - 1) * OTRUYEN_PAGES_PER_VIEW + 1;
      const payloads = await Promise.all(Array.from({ length: OTRUYEN_PAGES_PER_VIEW }, (_, index) => fetchOTruyen("catalog", { page: upstreamFirstPage + index, q: state.query.trim(), genre: genreSlug, sort: state.sort, filter: state.catalogFilter })));
      const data = payloads[0]?.data || {};
      const domain = data.APP_DOMAIN_CDN_IMAGE || OTRUYEN_CDN;
      const unique = new Map(payloads.flatMap((payload) => payload?.data?.items || []).map((item) => [String(item.slug || ""), item]));
      const mapped = [...unique.values()].map((item) => mapRemoteSeries(item, domain));
      if (reset) {
        const incomingIds = new Set(mapped.map((series) => series.id));
        state.catalog = state.catalog.filter((series) => series.sourceType !== "otruyen" || state.follows.has(series.id) || state.progress[series.id] || incomingIds.has(series.id));
      }
      mergeCatalog(mapped);
      const pagination = data.params?.pagination || {};
      state.remote.page = Math.max(1, Number(page) || 1);
      state.remote.perPage = Number(pagination.totalItemsPerPage || 24) * OTRUYEN_PAGES_PER_VIEW;
      state.remote.total = Number(pagination.totalItems || mapped.length);
      state.remote.hasMore = state.remote.page * state.remote.perPage < state.remote.total;
      state.remote.context = state.query.trim().length >= 2 ? "search" : state.genre !== "Tất cả" ? "genre" : "latest";
    } catch (error) {
      state.remote.error = error.message || "Không thể kết nối backend OTruyen";
      notify(state.remote.error, "error");
    } finally {
      state.remote.loading = false;
      if (root?.isConnected) render();
    }
  }

  async function ensureRemoteSeriesDetails(series) {
    if (!series || series.sourceType !== "otruyen" || series.chaptersLoaded) return series;
    const payload = await fetchOTruyen("series", { id: series.remoteSlug });
    const data = payload.data || {};
    const item = data.item;
    if (!item) throw new Error("Không tìm thấy thông tin truyện trên OTruyen");
    const chapterMap = new Map();
    (item.chapters || []).forEach((server) => (server.server_data || []).forEach((chapter, index) => {
      const number = String(chapter.chapter_name || index + 1);
      if (!chapterMap.has(number)) chapterMap.set(number, {
        id: `otruyen:${item.slug}:chapter:${number}`,
        number,
        title: String(chapter.chapter_title || ""),
        updatedAt: Date.parse(item.updatedAt) || Date.now(),
        pages: [],
        apiUrl: String(chapter.chapter_api_data || "")
      });
    }));
    const chapters = [...chapterMap.values()].sort((a, b) => naturalCompare(String(a.number), String(b.number)));
    Object.assign(series, {
      title: String(item.name || series.title),
      altTitles: Array.isArray(item.origin_name) ? item.origin_name.filter(Boolean) : [],
      author: Array.isArray(item.author) ? item.author.filter(Boolean).join(", ") || "Đang cập nhật" : String(item.author || "Đang cập nhật"),
      cover: coverUrl(item.thumb_url, data.APP_DOMAIN_CDN_IMAGE),
      genres: Array.isArray(item.category) ? item.category.map((category) => String(category.name || "")).filter(Boolean) : series.genres,
      status: item.status === "completed" ? "Đã hoàn thành" : item.status === "pending" ? "Tạm dừng" : "Đang cập nhật",
      description: stripHtml(item.content) || series.description,
      updatedAt: Date.parse(item.updatedAt) || series.updatedAt,
      chapters,
      chapterTotal: chapters.length,
      chapterCountEstimate: chapters.length,
      chaptersLoaded: true
    });
    return series;
  }

  async function ensureRemoteChapterPages(chapter) {
    if (!chapter || chapter.pages?.length || !chapter.apiUrl) return chapter;
    const payload = await fetchOTruyen("pages", { url: chapter.apiUrl });
    const data = payload?.data;
    const item = data?.item;
    if (!item?.chapter_path || !Array.isArray(item.chapter_image)) throw new Error("Chapter chưa có danh sách ảnh");
    const base = String(data.domain_cdn || "").replace(/\/$/, "");
    const pages = [...item.chapter_image].sort((a, b) => Number(a.image_page) - Number(b.image_page)).map((image) => `${base}/${String(item.chapter_path).replace(/^\/+|\/+$/g, "")}/${String(image.image_file).replace(/^\/+/, "")}`);
    const cleaned = await cleanRemotePages(pages);
    chapter.pages = cleaned.pages.filter((url) => !state.blockedPages.has(url));
    chapter.filteredPages = cleaned.filtered + (cleaned.pages.length - chapter.pages.length);
    return chapter;
  }

  function mangaDexStatus(value) {
    if (value === "completed") return "Đã hoàn thành";
    if (value === "hiatus" || value === "cancelled") return "Tạm dừng";
    return "Đang cập nhật";
  }

  function mapMangaDexSeries(entry, index = 0) {
    const remoteId = String(entry?.id || "");
    return {
      id: `mangadex:${remoteId}`,
      title: String(entry?.title || "Truyện chưa đặt tên"),
      altTitles: Array.isArray(entry?.altTitles) ? entry.altTitles.filter(Boolean) : [],
      author: String(entry?.author || "Đang cập nhật"),
      cover: String(entry?.cover || makeCover(entry?.title || "MangaDex", index)),
      genres: ["MangaDex", ...(Array.isArray(entry?.tags) ? entry.tags : [])].filter(Boolean),
      status: mangaDexStatus(entry?.status),
      description: String(entry?.description || "Dữ liệu truyện được phát trực tiếp từ MangaDex."),
      rating: 4.5,
      views: 0,
      updatedAt: Date.parse(entry?.updatedAt) || Date.now(),
      chapterCountEstimate: Math.max(0, Number(entry?.chapterCountEstimate) || chapterNumberValue(entry?.lastChapter)),
      chapters: [],
      sourceType: "mangadex",
      sourceLabel: "MangaDex · LIVE",
      sourceUrl: String(entry?.sourceUrl || (remoteId ? `https://mangadex.org/title/${remoteId}` : "")),
      remoteId,
      contentRating: String(entry?.contentRating || "safe"),
      chaptersLoaded: false,
      rights: "Phát trực tiếp từ MangaDex · ghi nguồn nhóm dịch theo từng chương"
    };
  }

  async function fetchMangaDex(action, parameters = {}) {
    const base = String(global.HH_API_ORIGIN || global.location?.origin || "").replace(/\/$/, "");
    const url = new URL(`${base}${MANGADEX_PROXY_PATH}`);
    url.searchParams.set("provider", "mangadex");
    url.searchParams.set("action", action);
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    const response = await fetch(url, { method: "GET", credentials: "include", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `MangaDex gateway phản hồi HTTP ${response.status}`);
    return payload;
  }

  async function loadMangaDexCatalog({ offset = 0, reset = false } = {}) {
    if (state.mangadex.loading) return;
    if (reset && state.mangadex.total > 0 && offset >= state.mangadex.total) {
      state.catalog = state.catalog.filter((series) => series.sourceType !== "mangadex" || state.follows.has(series.id) || state.progress[series.id]);
      state.mangadex.offset = offset;
      state.mangadex.hasMore = false;
      if (root?.isConnected) render();
      return;
    }
    state.mangadex.loading = true;
    state.mangadex.error = "";
    if (root?.isConnected) render();
    try {
      const payload = await fetchMangaDex("catalog", { offset, limit: state.mangadex.limit, q: state.query.trim(), sort: state.sort, filter: state.catalogFilter, catalogVersion: 2 });
      const mapped = (payload.items || []).map(mapMangaDexSeries);
      if (reset) {
        const incomingIds = new Set(mapped.map((series) => series.id));
        state.catalog = state.catalog.filter((series) => series.sourceType !== "mangadex" || state.follows.has(series.id) || state.progress[series.id] || incomingIds.has(series.id));
      }
      mergeCatalog(mapped);
      state.mangadex.offset = Number(payload.offset || offset);
      state.mangadex.limit = Number(payload.limit || state.mangadex.limit);
      state.mangadex.total = Number(payload.total || mapped.length);
      state.mangadex.hasMore = state.mangadex.offset + state.mangadex.limit < state.mangadex.total;
      state.mangadex.context = state.query.trim().length >= 2 ? "search" : "latest";
    } catch (error) {
      state.mangadex.error = error.message || "Không thể kết nối MangaDex";
    } finally {
      state.mangadex.loading = false;
      if (root?.isConnected) render();
    }
  }

  async function ensureMangaDexSeriesDetails(series) {
    if (!series || series.sourceType !== "mangadex" || series.chaptersLoaded) return series;
    const payload = await fetchMangaDex("series", { id: series.remoteId });
    const detail = payload.series || {};
    const chapters = (payload.chapters || []).map((entry) => ({
      id: `mangadex:chapter:${entry.id}`,
      remoteChapterId: String(entry.id || ""),
      number: String(entry.number || "Oneshot"),
      title: [String(entry.title || "").trim(), entry.group ? `Nhóm dịch: ${entry.group}` : ""].filter(Boolean).join(" · "),
      group: String(entry.group || "Nhóm dịch chưa xác định"),
      sourceUrl: String(entry.sourceUrl || ""),
      updatedAt: Date.parse(entry.publishAt || entry.updatedAt) || Date.now(),
      pages: []
    })).sort((a, b) => naturalCompare(String(a.number), String(b.number)) || a.updatedAt - b.updatedAt);
    Object.assign(series, {
      title: String(detail.title || series.title),
      altTitles: Array.isArray(detail.altTitles) ? detail.altTitles.filter(Boolean) : series.altTitles,
      author: String(detail.author || series.author),
      cover: String(detail.cover || series.cover),
      genres: ["MangaDex", ...(Array.isArray(detail.tags) ? detail.tags : [])].filter(Boolean),
      status: mangaDexStatus(detail.status),
      description: String(detail.description || series.description),
      updatedAt: Date.parse(detail.updatedAt) || series.updatedAt,
      sourceUrl: String(detail.sourceUrl || series.sourceUrl),
      contentRating: String(detail.contentRating || series.contentRating),
      chapters,
      chapterTotal: Number(payload.chapterTotal || chapters.length),
      chapterCountEstimate: Number(payload.chapterTotal || chapters.length),
      chaptersLoaded: true
    });
    return series;
  }

  async function ensureMangaDexChapterPages(chapter) {
    if (!chapter || chapter.pages?.length || !chapter.remoteChapterId) return chapter;
    const payload = await fetchMangaDex("pages", { id: chapter.remoteChapterId });
    chapter.pages = (Array.isArray(payload.pages) ? payload.pages : []).filter((url) => /^https:\/\//i.test(url) && !state.blockedPages.has(url));
    chapter.pageQuality = String(payload.quality || "data-saver");
    if (!chapter.pages.length) throw new Error("Chapter MangaDex chưa có ảnh đọc.");
    return chapter;
  }

  function imageRatio(url) {
    return new Promise((resolve) => {
      const image = new Image();
      const done = (value) => { clearTimeout(timer); image.onload = null; image.onerror = null; resolve(value); };
      const timer = setTimeout(() => done(null), 7000);
      image.onload = () => done(image.naturalWidth ? image.naturalHeight / image.naturalWidth : null);
      image.onerror = () => done(null);
      image.referrerPolicy = "no-referrer";
      image.src = url;
    });
  }

  async function cleanRemotePages(pages) {
    if (!Array.isArray(pages) || pages.length < 5) return { pages: pages || [], filtered: 0 };
    const leadingCount = Math.min(5, pages.length);
    const trailingStart = Math.max(leadingCount, pages.length - 2);
    const indexes = [...Array.from({ length: leadingCount }, (_, index) => index), ...Array.from({ length: pages.length - trailingStart }, (_, index) => trailingStart + index)];
    const ratios = new Map(await Promise.all(indexes.map(async (index) => [index, await imageRatio(pages[index])])));
    const storyIsLongForm = [...ratios.entries()].some(([index, ratio]) => index >= 3 && index < leadingCount && Number(ratio) >= 2.05);
    if (!storyIsLongForm) return { pages, filtered: 0 };
    const baselineRatios = [...ratios.entries()].filter(([index, ratio]) => index >= 2 && index < leadingCount && Number(ratio) >= 2.05).map(([, ratio]) => Number(ratio)).sort((a, b) => a - b);
    const storyBaseline = baselineRatios[Math.floor(baselineRatios.length / 2)] || 3;
    let start = 0;
    while (start < Math.min(4, pages.length - 1)) {
      const ratio = Number(ratios.get(start));
      if (!(ratio > 0) || ratio >= 1.72 && ratio <= storyBaseline * 1.22) break;
      start += 1;
    }
    let end = pages.length;
    while (end > start + 1 && end > pages.length - 2 && Number(ratios.get(end - 1)) > 0 && Number(ratios.get(end - 1)) < 1.72) end -= 1;
    return { pages: pages.slice(start, end), filtered: start + pages.length - end };
  }

  function svgUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function makeCover(title, index) {
    const [base, glow, accent] = PALETTES[index % PALETTES.length];
    const safe = escapeHtml(title);
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${accent}"/><stop offset="1" stop-color="#07111d"/></linearGradient><radialGradient id="r"><stop stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
      <rect width="600" height="850" fill="url(#g)"/><circle cx="450" cy="230" r="240" fill="url(#r)"/><path d="M0 650 Q140 500 300 650 T600 610 V850 H0Z" fill="#071019" opacity=".78"/><path d="M105 665 Q190 385 300 235 Q390 380 502 665" fill="none" stroke="${glow}" stroke-width="8" opacity=".52"/><circle cx="300" cy="315" r="72" fill="#fff" opacity=".15"/><text x="50" y="720" fill="white" font-family="Arial,sans-serif" font-size="48" font-weight="800">${safe}</text><text x="52" y="766" fill="${glow}" font-family="Arial,sans-serif" font-size="18" letter-spacing="5">HH ORIGINALS</text></svg>`);
  }

  function loadLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.follows = new Set(saved.follows || []);
      state.progress = saved.progress || {};
      state.readerMode = saved.readerMode === "page" ? "page" : "scroll";
      state.readerWidth = ["compact", "fit", "wide"].includes(saved.readerWidth) ? saved.readerWidth : "fit";
      state.readerTheme = ["dark", "black", "paper"].includes(saved.readerTheme) ? saved.readerTheme : "dark";
      state.blockedPages = new Set(Array.isArray(saved.blockedPages) ? saved.blockedPages.slice(-500) : []);
      state.bookmarks = Array.isArray(saved.bookmarks) ? saved.bookmarks.filter((entry) => entry?.seriesId && entry?.chapterId && Number.isFinite(Number(entry.page))).slice(-200) : [];
      state.recentSeries = Array.isArray(saved.recentSeries) ? saved.recentSeries.filter((entry) => entry?.id && entry?.title && (entry?.sourceType === "otruyen" && entry?.remoteSlug || entry?.sourceType === "mangadex" && entry?.remoteId)).slice(-30) : [];
    } catch {}
  }

  function saveLocalState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ follows: [...state.follows], progress: state.progress, readerMode: state.readerMode, readerWidth: state.readerWidth, readerTheme: state.readerTheme, blockedPages: [...state.blockedPages].slice(-500), bookmarks: state.bookmarks.slice(-200), recentSeries: state.recentSeries.slice(-20) })); } catch {}
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return resolve(null);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(record) {
    const db = await openDatabase();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function dbGetAll() {
    const db = await openDatabase();
    if (!db) return [];
    const result = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }

  function toObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    blobUrls.add(url);
    return url;
  }

  function hydrateStoredSeries(record) {
    const series = { ...record };
    series.chapters = (record.chapters || []).map((chapter) => ({ ...chapter, pages: (chapter.pages || []).map((page) => page instanceof Blob ? toObjectUrl(page) : page) }));
    if (series.cover instanceof Blob) series.cover = toObjectUrl(series.cover);
    return series;
  }

  async function loadImportedSeries() {
    try {
      const imported = (await dbGetAll()).map(hydrateStoredSeries);
      const known = new Set(state.catalog.map((series) => series.id));
      imported.forEach((series) => { if (!known.has(series.id)) state.catalog.push(series); });
      if (root?.isConnected) render();
    } catch {}
  }

  function activeSeries() { return state.catalog.find((series) => series.id === state.activeSeriesId) || null; }
  function activeChapter() { return activeSeries()?.chapters?.find((chapter) => chapter.id === state.activeChapterId) || null; }
  function bookmarkKey(seriesId, chapterId, page) { return `${seriesId}::${chapterId}::${Number(page) || 0}`; }
  function isCurrentPageBookmarked() {
    const chapter = activeChapter();
    return Boolean(chapter && state.bookmarks.some((entry) => bookmarkKey(entry.seriesId, entry.chapterId, entry.page) === bookmarkKey(state.activeSeriesId, chapter.id, state.readerPage)));
  }
  function rememberSeries(series, chapter) {
    if (!series || !["otruyen", "mangadex"].includes(series.sourceType)) return;
    const isMangaDex = series.sourceType === "mangadex";
    const snapshot = {
      id: series.id, title: series.title, altTitles: series.altTitles || [], author: series.author || "Đang cập nhật", cover: series.cover,
      genres: series.genres || [], status: series.status || "Đang cập nhật", description: series.description || "", rating: Number(series.rating || 4.5),
      views: Number(series.views || 0), updatedAt: Number(series.updatedAt || Date.now()), sourceType: series.sourceType, sourceLabel: series.sourceLabel || (isMangaDex ? "MangaDex · LIVE" : "OTruyen · LIVE"),
      chapterCountEstimate: seriesChapterCount(series), chapterTotal: Number(series.chapterTotal || 0),
      remoteSlug: series.remoteSlug || "", remoteId: series.remoteId || "", sourceUrl: series.sourceUrl || "", contentRating: series.contentRating || "", chaptersLoaded: false,
      chapters: chapter ? [{ id: chapter.id, number: chapter.number, title: chapter.title || "", group: chapter.group || "", sourceUrl: chapter.sourceUrl || "", updatedAt: chapter.updatedAt || Date.now(), pages: [], apiUrl: chapter.apiUrl || "", remoteChapterId: chapter.remoteChapterId || "" }] : []
    };
    state.recentSeries = [...state.recentSeries.filter((entry) => entry.id !== snapshot.id), snapshot].slice(-30);
  }
  function syncDeepLink(series, chapter, page = null) {
    if (!global.history?.replaceState || !global.location || !series) return;
    const url = new URL(global.location.href);
    if (series.sourceType === "otruyen") {
      url.searchParams.set("comicSeries", series.remoteSlug);
      url.searchParams.delete("comicOpen");
      url.searchParams.delete("comicMangaDex");
    } else if (series.sourceType === "github-open") {
      url.searchParams.set("comicOpen", series.id);
      url.searchParams.delete("comicSeries");
      url.searchParams.delete("comicMangaDex");
    } else if (series.sourceType === "mangadex") {
      url.searchParams.set("comicMangaDex", series.remoteId);
      url.searchParams.delete("comicSeries");
      url.searchParams.delete("comicOpen");
    } else return;
    if (chapter) url.searchParams.set("comicChapter", String(series.sourceType === "mangadex" ? chapter.remoteChapterId || chapter.id : chapter.number)); else url.searchParams.delete("comicChapter");
    if (chapter && page !== null) url.searchParams.set("comicPage", String(Math.max(0, Number(page) || 0) + 1)); else url.searchParams.delete("comicPage");
    global.history.replaceState(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function clearDeepLink() {
    if (!global.history?.replaceState || !global.location) return;
    const url = new URL(global.location.href);
    url.searchParams.delete("comicSeries"); url.searchParams.delete("comicOpen"); url.searchParams.delete("comicMangaDex"); url.searchParams.delete("comicChapter"); url.searchParams.delete("comicPage");
    global.history.replaceState(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function availableGenres() { return ["Tất cả", ...new Set([...GENRES.slice(1), ...state.remoteGenres, ...state.catalog.flatMap((series) => Array.isArray(series.genres) ? series.genres : [])])]; }
  function sidebarGenres() {
    const genres = availableGenres();
    if (state.genreExpanded || genres.length <= 15) return genres;
    const visible = genres.slice(0, 15);
    if (!visible.includes(state.genre)) visible.push(state.genre);
    return visible;
  }

  function catalogPageCount() {
    const remotePages = Math.ceil(Math.max(0, state.remote.total) / Math.max(1, state.remote.perPage || 24));
    const mangaDexPages = Math.ceil(Math.max(0, state.mangadex.total) / Math.max(1, state.mangadex.limit || 24));
    return Math.max(1, remotePages, mangaDexPages);
  }

  function catalogTotal() {
    const openCount = state.catalogPage === 1 && !state.query && state.genre === "Tất cả" ? state.catalog.filter((series) => !["otruyen", "mangadex"].includes(series.sourceType)).length : 0;
    return Math.max(0, state.remote.total) + Math.max(0, state.mangadex.total) + openCount;
  }

  async function loadCatalogPage(page = 1) {
    const maximum = catalogPageCount();
    const target = clamp(Math.round(Number(page) || 1), 1, maximum);
    state.catalogPage = target;
    const offset = (target - 1) * state.mangadex.limit;
    if (root?.isConnected) render();
    return Promise.allSettled([
      loadRemoteCatalog({ page: target, reset: true }),
      loadMangaDexCatalog({ offset, reset: true })
    ]);
  }

  function visibleCatalog() {
    const query = state.query.trim().toLocaleLowerCase();
    let result = state.catalog.filter((series) => state.genre === "Tất cả" || series.genres?.includes(state.genre));
    if (state.catalogPage > 1 && !query && state.genre === "Tất cả" && state.catalogFilter !== "followed") {
      result = result.filter((series) => ["otruyen", "mangadex"].includes(series.sourceType) || state.follows.has(series.id) || state.progress[series.id]);
    }
    if (query) result = result.filter((series) => `${series.title} ${series.author} ${(series.altTitles || []).join(" ")} ${(series.genres || []).join(" ")}`.toLocaleLowerCase().includes(query));
    if (state.catalogFilter === "completed") result = result.filter((series) => series.status === "Đã hoàn thành");
    else if (state.catalogFilter === "ongoing") result = result.filter((series) => series.status !== "Đã hoàn thành");
    else if (state.catalogFilter === "followed") result = result.filter((series) => state.follows.has(series.id));
    result.sort((a, b) => {
      if (state.sort === "az") return naturalCompare(a.title, b.title);
      if (state.sort === "za") return naturalCompare(b.title, a.title);
      if (state.sort === "popular") return b.rating - a.rating || smartCatalogCompare(a, b);
      if (state.sort === "chapters") {
        const aCount = seriesChapterCount(a); const bCount = seriesChapterCount(b);
        return chapterBand(aCount) - chapterBand(bCount) || bCount - aCount || Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
      }
      if (state.sort === "updated") return Number(b.updatedAt || 0) - Number(a.updatedAt || 0) || seriesChapterCount(b) - seriesChapterCount(a);
      return smartCatalogCompare(a, b);
    });
    return result;
  }

  function formatViews(value) {
    const number = Number(value || 0);
    return number >= 1000000 ? `${(number / 1000000).toFixed(1)}M` : number >= 1000 ? `${Math.round(number / 1000)}K` : String(number);
  }

  function notify(message, tone = "info") {
    const tray = root?.querySelector("[data-cr-toast]");
    if (!tray) return;
    const toast = document.createElement("div");
    toast.className = `cr-toast is-${tone}`;
    toast.textContent = message;
    tray.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => { toast.classList.remove("is-visible"); setTimeout(() => toast.remove(), 220); }, 3300);
  }

  function seriesCard(series) {
    const latest = series.chapters?.at(-1);
    const chapterCount = seriesChapterCount(series);
    const progress = state.progress[series.id];
    const resumeChapterId = progress?.chapterId || latest?.id || "";
    const followed = state.follows.has(series.id);
    return `<article class="cr-series-card" data-series="${escapeHtml(series.id)}">
      <div class="cr-cover"><img src="${escapeHtml(series.cover)}" alt="Bìa ${escapeHtml(series.title)}" loading="lazy" referrerpolicy="no-referrer"><span>${series.sourceType === "github-open" ? "OPEN" : series.sourceType === "mangadex" ? "MDX" : series.status === "Đã hoàn thành" ? "FULL" : "NEW"}</span><button type="button" class="cr-card-follow${followed ? " is-active" : ""}" data-follow="${escapeHtml(series.id)}" aria-label="${followed ? "Bỏ theo dõi" : "Theo dõi"} ${escapeHtml(series.title)}">${followed ? "♥" : "♡"}</button>${progress ? `<i style="--p:${clamp(progress.percent || 0, 0, 100)}%"></i>` : ""}</div>
      <div class="cr-card-copy"><strong>${escapeHtml(series.title)}</strong><p>${escapeHtml((series.genres || []).slice(0, 2).join(" · "))}</p><div><button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(resumeChapterId)}">${progress ? `Đọc tiếp · ${progress.percent || 0}%` : `Ch. ${latest?.number || chapterCount || "?"}`}</button><small>${chapterCount ? `${chapterCount.toLocaleString("vi-VN")} chap · ` : "Chưa rõ số chap · "}${timeAgo(latest?.updatedAt || series.updatedAt)}</small></div></div>
    </article>`;
  }

  function continueShelf() {
    const rows = Object.entries(state.progress).sort(([, a], [, b]) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).map(([seriesId, progress]) => ({ series: state.catalog.find((entry) => entry.id === seriesId), progress })).filter((entry) => entry.series).slice(0, 8);
    if (!rows.length) return "";
    return `<section class="cr-continue-shelf"><header><div><strong>Tiếp tục đọc</strong><small>Quay lại đúng chapter và trang gần nhất</small></div><button type="button" data-nav="history">Xem lịch sử →</button></header><div>${rows.map(({ series, progress }) => `<button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(progress.chapterId)}" data-page-target="${Math.max(0, Number(progress.page) || 0)}"><img src="${escapeHtml(series.cover)}" alt="" referrerpolicy="no-referrer"><span><strong>${escapeHtml(series.title)}</strong><small>${progress.percent || 0}% · ${timeAgo(progress.updatedAt)}</small><i style="--p:${clamp(progress.percent || 0, 0, 100)}%"></i></span></button>`).join("")}</div></section>`;
  }

  function catalogPagination() {
    const pages = catalogPageCount();
    const page = clamp(state.catalogPage, 1, pages);
    const busy = state.remote.loading || state.mangadex.loading;
    return `<footer class="cr-pagination" aria-label="Phân trang toàn bộ kho truyện">
      <button type="button" data-catalog-page="1"${page <= 1 || busy ? " disabled" : ""} aria-label="Trang đầu">«</button>
      <button type="button" data-catalog-page="${page - 1}"${page <= 1 || busy ? " disabled" : ""} aria-label="Trang trước">‹</button>
      <label>Trang <input type="number" min="1" max="${pages}" value="${page}" data-catalog-page-input aria-label="Nhập số trang"> / ${pages.toLocaleString("vi-VN")}</label>
      <button type="button" data-catalog-page="${page + 1}"${page >= pages || busy ? " disabled" : ""} aria-label="Trang sau">›</button>
      <button type="button" data-catalog-page="${pages}"${page >= pages || busy ? " disabled" : ""} aria-label="Trang cuối">»</button>
      <span>${busy ? "Backend đang tải trang…" : `${catalogTotal().toLocaleString("vi-VN")} truyện có thể duyệt · tối đa 72 OTruyen + 48 MangaDex mỗi trang`}</span>
    </footer>`;
  }

  function homeView() {
    const visible = visibleCatalog();
    const hero = visible[0] || state.catalog[0];
    const rankings = [...state.catalog].sort((a, b) => seriesChapterCount(b) - seriesChapterCount(a) || smartCatalogCompare(a, b)).slice(0, 7);
    return `<div class="cr-home">
      <section class="cr-hero" style="--hero-cover:url('${escapeHtml(hero?.cover || "")}')">
        <div class="cr-hero-copy"><span>HH COMICS · ORIGINAL & LICENSED</span><h1>${escapeHtml(hero?.title || "Thư viện truyện của bạn")}</h1><p>${escapeHtml(hero?.description || "Nhập catalog hoặc CBZ để bắt đầu đọc.")}</p><div>${hero ? `<button type="button" class="is-primary" data-read="${escapeHtml(hero.id)}" data-chapter="${escapeHtml(state.progress[hero.id]?.chapterId || hero.chapters?.[0]?.id || "")}">▶ Đọc ngay</button><button type="button" data-series="${escapeHtml(hero.id)}">Xem chi tiết</button>` : ""}</div></div>
        <div class="cr-hero-cover">${hero ? `<img src="${escapeHtml(hero.cover)}" alt="" referrerpolicy="no-referrer">` : ""}</div>
      </section>
      ${continueShelf()}
      <nav class="cr-discovery-tabs" aria-label="Lọc kho truyện"><button type="button" data-catalog-filter="all"${state.catalogFilter === "all" ? ' class="is-active"' : ""}>Tất cả</button><button type="button" data-catalog-filter="ongoing"${state.catalogFilter === "ongoing" ? ' class="is-active"' : ""}>Đang cập nhật</button><button type="button" data-catalog-filter="completed"${state.catalogFilter === "completed" ? ' class="is-active"' : ""}>Hoàn thành</button><button type="button" data-catalog-filter="followed"${state.catalogFilter === "followed" ? ' class="is-active"' : ""}>Đang theo dõi · ${state.follows.size}</button><span>${state.remote.loading || state.mangadex.loading ? "Đang đồng bộ dữ liệu…" : "OTruyen · MangaDex · GitHub Open"}</span></nav>
      <div class="cr-home-grid">
        <section class="cr-catalog-section"><header><div><strong>${state.query || state.genre !== "Tất cả" ? "Kết quả tìm kiếm" : state.sort === "az" ? "Tên truyện A–Z" : state.sort === "za" ? "Tên truyện Z–A" : state.sort === "popular" ? "Phổ biến" : state.sort === "chapters" ? "Nhiều chap nhất" : state.sort === "updated" ? "Mới cập nhật" : "Cập nhật mạnh · nhiều chap"}</strong><small>${visible.length.toLocaleString("vi-VN")} truyện ở trang ${state.catalogPage.toLocaleString("vi-VN")}${state.remote.total ? ` · ${state.remote.total.toLocaleString("vi-VN")} OTruyen` : ""}${state.mangadex.total ? ` · ${state.mangadex.total.toLocaleString("vi-VN")} MangaDex tiếng Việt` : ""}</small></div><select data-sort aria-label="Sắp xếp toàn bộ kho truyện"><option value="smart">Ưu tiên cập nhật & nhiều chap</option><option value="chapters">Nhiều chap → ít chap</option><option value="updated">Mới cập nhật</option><option value="popular">Phổ biến</option><option value="az">Tên A–Z</option><option value="za">Tên Z–A</option></select></header>
          <div class="cr-series-grid">${visible.length ? visible.map(seriesCard).join("") : `<div class="cr-empty"><span>⌕</span><strong>Không tìm thấy truyện</strong><small>Thử từ khóa hoặc thể loại khác.</small></div>`}</div>
          ${catalogPagination()}
          ${state.remote.error || state.mangadex.error ? `<footer class="cr-load-more"><span>${escapeHtml([state.remote.error, state.mangadex.error].filter(Boolean).join(" · "))}</span></footer>` : ""}
        </section>
        <aside class="cr-ranking"><header><strong>Top nhiều chap</strong><span>Đang cập nhật</span></header>${rankings.map((series, index) => `<button type="button" data-series="${escapeHtml(series.id)}"><b>${String(index + 1).padStart(2, "0")}</b><img src="${escapeHtml(series.cover)}" alt=""><span><strong>${escapeHtml(series.title)}</strong><small>${seriesChapterCount(series).toLocaleString("vi-VN")} chap · ${timeAgo(series.updatedAt)}</small></span></button>`).join("")}</aside>
      </div>
    </div>`;
  }

  function detailView(series) {
    if (!series) return homeView();
    const followed = state.follows.has(series.id);
    const progress = state.progress[series.id];
    return `<div class="cr-detail">
      <button type="button" class="cr-back" data-nav="home">← Trở lại kho truyện</button>
      <section class="cr-detail-hero"><img src="${escapeHtml(series.cover)}" alt="Bìa ${escapeHtml(series.title)}" referrerpolicy="no-referrer"><div><span>${escapeHtml(series.sourceType === "original" ? "HH ORIGINALS" : series.sourceType === "otruyen" ? "OTRUYEN · LIVE" : series.sourceType === "mangadex" ? "MANGADEX · LIVE" : series.sourceType === "github-open" ? `GITHUB OPEN · ${series.license || "OPEN"}` : "THƯ VIỆN ĐÃ NHẬP")}</span><h1>${escapeHtml(series.title)}</h1><p class="cr-detail-author">Tác giả: <strong>${escapeHtml(series.author || "Đang cập nhật")}</strong></p><div class="cr-tags">${(series.genres || []).map((genre) => `<button type="button" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join("")}</div><p>${escapeHtml(series.description || "Chưa có mô tả.")}</p><div class="cr-detail-actions"><button type="button" class="is-primary" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(progress?.chapterId || series.chapters?.[0]?.id || "")}"${series.chapters?.length || series.chaptersLoaded === false ? "" : " disabled"}>▶ ${progress ? "Đọc tiếp" : "Đọc từ đầu"}</button><button type="button" data-follow="${escapeHtml(series.id)}">${followed ? "✓ Đang theo dõi" : "♡ Theo dõi"}</button></div><dl><div><dt>Trạng thái</dt><dd>${escapeHtml(series.status || "Đang cập nhật")}</dd></div><div><dt>Đánh giá</dt><dd>★ ${Number(series.rating || 4.5).toFixed(1)}</dd></div><div><dt>Nguồn</dt><dd>${escapeHtml(series.sourceLabel || series.rights || "HH Comics")}</dd></div><div><dt>Số chương</dt><dd>${series.chaptersLoaded === false ? "Đang tải…" : series.chapterTotal && series.chapterTotal > series.chapters.length ? `${series.chapters.length}/${series.chapterTotal} mới nhất` : series.chapters?.length || 0}</dd></div></dl></div></section>
      <section class="cr-chapters"><header><div><strong>Danh sách chương</strong><small>${series.chapters?.length || 0} chương · lưu tiến độ tự động</small></div><input type="search" placeholder="Tìm chương…" data-chapter-search></header><div data-chapter-list>${[...(series.chapters || [])].reverse().map((chapter) => `<button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(chapter.id)}"><span><strong>Chương ${chapter.number}</strong><small>${escapeHtml(chapter.title || "")}</small></span><i>${timeAgo(chapter.updatedAt)}</i><b>${progress?.chapterId === chapter.id ? "Đang đọc" : "Đọc →"}</b></button>`).join("")}</div></section>
    </div>`;
  }

  function libraryView(kind) {
    const ids = kind === "follows" ? [...state.follows] : Object.keys(state.progress).sort((a, b) => state.progress[b].updatedAt - state.progress[a].updatedAt);
    const series = ids.map((id) => state.catalog.find((entry) => entry.id === id)).filter(Boolean);
    return `<div class="cr-library-view"><header><div><span>${kind === "follows" ? "♡" : "◷"}</span><div><h1>${kind === "follows" ? "Truyện đang theo dõi" : "Lịch sử đọc"}</h1><p>Dữ liệu riêng trên thiết bị này.</p></div></div><button type="button" data-nav="home">Khám phá truyện</button></header><div class="cr-series-grid">${series.length ? series.map(seriesCard).join("") : `<div class="cr-empty"><span>${kind === "follows" ? "♡" : "◷"}</span><strong>Chưa có truyện</strong><small>${kind === "follows" ? "Bấm Theo dõi tại trang chi tiết." : "Tiến độ xuất hiện sau khi bạn đọc một chương."}</small></div>`}</div></div>`;
  }

  function bookmarkView() {
    const rows = [...state.bookmarks].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return `<div class="cr-library-view cr-bookmark-view"><header><div><span>★</span><div><h1>Dấu trang</h1><p>${rows.length} vị trí đã lưu trên thiết bị này.</p></div></div><button type="button" data-nav="home">Khám phá truyện</button></header><div class="cr-bookmark-list">${rows.length ? rows.map((entry) => `<button type="button" data-read="${escapeHtml(entry.seriesId)}" data-chapter="${escapeHtml(entry.chapterId)}" data-page-target="${Math.max(0, Number(entry.page) || 0)}"><img src="${escapeHtml(entry.cover || "")}" alt="" referrerpolicy="no-referrer"><span><strong>${escapeHtml(entry.title || "Truyện đã lưu")}</strong><small>Chương ${escapeHtml(entry.chapterNumber || "?")} · Trang ${Number(entry.page || 0) + 1}</small></span><i>${timeAgo(entry.updatedAt)}</i><b>Đọc →</b></button>`).join("") : `<div class="cr-empty"><span>★</span><strong>Chưa có dấu trang</strong><small>Khi đang đọc, bấm biểu tượng ngôi sao để lưu đúng vị trí.</small></div>`}</div></div>`;
  }

  function sourceView() {
    const openSources = Array.isArray(global.HHOpenComicSources) ? global.HHOpenComicSources : [];
    const openPages = openSources.reduce((total, entry) => total + Number(entry.pages || 0), 0);
    return `<div class="cr-source-view"><header><span>＋</span><div><h1>Thêm kho truyện của bạn</h1><p>Nhập nội dung do bạn sở hữu hoặc nguồn/API có quyền phân phối.</p></div></header><div class="cr-source-grid">
      <button type="button" data-genre="Nguồn mở"><b>GitHub Open Library · ${openSources.length} bộ</b><span>${openPages.toLocaleString("vi-VN")} trang có license rõ ràng; fan-art và file phụ đã được loại khỏi catalog.</span><i>Xem kho nguồn mở →</i></button>
      <button type="button" data-action="mangadex-refresh"><b>MangaDex tiếng Việt · ${state.mangadex.total ? state.mangadex.total.toLocaleString("vi-VN") : "đang kết nối"} truyện</b><span>Nguồn được TruyenDex sử dụng: chỉ lấy nội dung safe/suggestive, ghi nhóm dịch và phát ảnh trực tiếp khi mở chương.</span><i>${state.mangadex.loading ? "Đang đồng bộ…" : "Đồng bộ MangaDex →"}</i></button>
      <button type="button" data-action="import-cbz"><b>CBZ / ZIP</b><span>Mỗi file thành một bộ truyện; ảnh được lưu offline trong IndexedDB.</span><i>Chọn file →</i></button>
      <button type="button" data-action="import-json"><b>Catalog JSON</b><span>Nhập series, chương, ảnh và metadata theo manifest.</span><i>Chọn JSON →</i></button>
      <button type="button" data-action="sample-json"><b>Tải JSON mẫu</b><span>Schema sẵn để kết nối website hoặc CMS thuộc quyền của bạn.</span><i>Tải mẫu →</i></button>
      <button type="button" data-action="remote-refresh"><b>Backend OTruyen · ${state.remote.total ? `${state.remote.total.toLocaleString("vi-VN")} truyện` : "đang kết nối"}</b><span>Backend HH phân trang toàn kho, tìm kiếm và tải chi tiết thật; ảnh chỉ tải khi người dùng mở chương.</span><i>${state.remote.loading ? "Đang đồng bộ…" : "Kiểm tra backend →"}</i></button>
      <section><b>API / Feed được cấp phép</b><span>Dùng endpoint HTTPS có CORS và trả về cùng schema catalog.</span><div><input type="url" placeholder="https://your-domain.com/comics.json" data-feed-url><button type="button" data-action="import-feed">Kết nối</button></div></section>
    </div><aside><strong>Nguyên tắc nguồn</strong><p>HH Comics không tự vượt CAPTCHA, anti-bot, hotlink protection hoặc crawl hàng loạt website bên thứ ba. Bạn vẫn có thể nhập catalog/API của chính mình và đọc trực tiếp trên web.</p></aside></div>`;
  }

  function readerView(series, chapter) {
    if (!series || !chapter) return detailView(series);
    const chapters = series.chapters || [];
    const chapterIndex = chapters.findIndex((entry) => entry.id === chapter.id);
    const pages = chapter.pages || [];
    const bookmarked = isCurrentPageBookmarked();
    state.readerPage = clamp(state.readerPage, 0, Math.max(0, pages.length - 1));
    return `<div class="cr-reader is-${state.readerMode} width-${state.readerWidth} theme-${state.readerTheme}" data-reader>
      <header class="cr-reader-bar"><button type="button" class="cr-reader-back" data-series="${escapeHtml(series.id)}" aria-label="Trở về trang truyện">←</button><div><strong>${escapeHtml(series.title)}</strong><small>Chương ${chapter.number} · <span data-reader-page-label>Trang ${state.readerPage + 1}/${pages.length}</span>${chapter.filteredPages ? ` · Clean Reader đã ẩn ${chapter.filteredPages} trang` : ""}</small></div><button type="button" class="cr-reader-chapter-button" data-action="reader-chapters" aria-expanded="false">☰ Chương</button><select data-reader-chapter aria-label="Chọn chương">${chapters.map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === chapter.id ? " selected" : ""}>Chương ${entry.number}</option>`).join("")}</select><div class="cr-reader-modes"><button type="button" data-reader-mode="scroll"${state.readerMode === "scroll" ? ' class="is-active"' : ""}>Cuộn dọc</button><button type="button" data-reader-mode="page"${state.readerMode === "page" ? ' class="is-active"' : ""}>Từng trang</button></div><button type="button" data-action="reader-bookmark" class="${bookmarked ? "is-bookmarked" : ""}" aria-label="${bookmarked ? "Bỏ dấu trang" : "Đánh dấu trang này"}">${bookmarked ? "★" : "☆"}</button><button type="button" data-action="reader-share" aria-label="Sao chép liên kết">↗</button><button type="button" data-action="reader-settings" aria-label="Cài đặt trình đọc" aria-expanded="false">⚙</button><button type="button" data-action="reader-fullscreen" aria-label="Toàn màn hình">⛶</button></header>
      <aside class="cr-reader-settings" hidden><header><strong>Cài đặt đọc</strong><small>Được lưu trên thiết bị này</small></header><label>Độ rộng trang<div>${[["compact","Gọn"],["fit","Vừa màn hình"],["wide","Rộng"]].map(([value,label]) => `<button type="button" data-reader-width="${value}"${state.readerWidth === value ? ' class="is-active"' : ""}>${label}</button>`).join("")}</div></label><label>Nền đọc<div>${[["dark","Tối"],["black","Đen"],["paper","Giấy"]].map(([value,label]) => `<button type="button" data-reader-theme="${value}"${state.readerTheme === value ? ' class="is-active"' : ""}>${label}</button>`).join("")}</div></label><button type="button" class="cr-clean-page" data-action="reader-hide-page">Ẩn vĩnh viễn trang quảng cáo đang xem</button><p>Clean Reader tự loại trang quảng bá ngắn ở đầu/cuối chapter. Phím tắt: ← → đổi trang/chương · M đổi chế độ · F toàn màn hình · Esc trở về.</p></aside>
      <aside class="cr-reader-chapters" hidden><header><strong>${chapters.length} chương</strong><button type="button" data-action="reader-chapters">×</button></header><div>${[...chapters].reverse().map((entry) => `<button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(entry.id)}"${entry.id === chapter.id ? ' class="is-active"' : ""}><span>Chương ${entry.number}</span><small>${escapeHtml(entry.title || "")}</small></button>`).join("")}</div></aside>
      <main class="cr-reader-pages" data-reader-pages>${state.readerMode === "scroll" ? pages.map((page, index) => `<figure data-page="${index}"><img src="${escapeHtml(page)}" data-reader-image data-original-src="${escapeHtml(page)}" alt="Trang ${index + 1}" loading="${index < 3 ? "eager" : "lazy"}" referrerpolicy="no-referrer"><button type="button" class="cr-image-retry" data-action="reader-retry-image" hidden>↻ Thử tải lại</button><figcaption>${index + 1} / ${pages.length}</figcaption></figure>`).join("") : `<figure data-page="${state.readerPage}"><img src="${escapeHtml(pages[state.readerPage] || "")}" data-reader-image data-original-src="${escapeHtml(pages[state.readerPage] || "")}" alt="Trang ${state.readerPage + 1}" referrerpolicy="no-referrer"><button type="button" class="cr-image-retry" data-action="reader-retry-image" hidden>↻ Thử tải lại</button><figcaption>${state.readerPage + 1} / ${pages.length}</figcaption></figure>`}</main>
      <button type="button" class="cr-tap-zone is-prev" data-reader-nav="prev" aria-label="Trang trước"></button><button type="button" class="cr-tap-zone is-next" data-reader-nav="next" aria-label="Trang sau"></button>
      <button type="button" class="cr-reader-top" data-action="reader-top" aria-label="Lên đầu chương">↑</button>
      <footer><button type="button" data-reader-nav="prev"${state.readerMode === "page" && state.readerPage > 0 ? "" : chapterIndex > 0 ? "" : " disabled"}>← ${state.readerMode === "page" && state.readerPage > 0 ? "Trang trước" : "Chương trước"}</button><div><span data-reader-progress>${Math.round((state.readerPage + 1) / Math.max(1, pages.length) * 100)}%</span><input type="range" min="1" max="${Math.max(1, pages.length)}" value="${state.readerPage + 1}" data-reader-page-slider aria-label="Nhảy tới trang"><small data-reader-slider-label>${state.readerPage + 1}/${pages.length}</small></div><button type="button" data-reader-nav="next"${state.readerMode === "page" && state.readerPage < pages.length - 1 ? "" : chapterIndex < chapters.length - 1 ? "" : " disabled"}>${state.readerMode === "page" && state.readerPage < pages.length - 1 ? "Trang sau" : "Chương sau"} →</button></footer>
    </div>`;
  }

  function shellHtml(content) {
    return `<section class="cr-app${state.view === "reader" ? " is-reader-focus" : ""}">
      <header class="cr-topbar"><button type="button" class="cr-logo" data-nav="home"><span>CR</span><div><strong>HH Comics</strong><small>Đọc truyện online</small></div></button><label class="cr-search"><span>⌕</span><input type="search" value="${escapeHtml(state.query)}" placeholder="Tìm tên truyện, tác giả, thể loại…" data-search></label><nav><button type="button" data-nav="history">◷ Lịch sử</button><button type="button" data-nav="bookmarks">★ Dấu trang <i>${state.bookmarks.length}</i></button><button type="button" data-nav="follows">♡ Theo dõi <i>${state.follows.size}</i></button><button type="button" class="is-primary" data-nav="sources">＋ Thêm truyện</button></nav><input hidden type="file" accept=".cbz,.zip,application/zip" multiple data-cbz-input><input hidden type="file" accept=".json,application/json" data-json-input></header>
      <div class="cr-layout"><aside class="cr-sidebar"><strong>Khám phá</strong><button type="button" data-nav="home" class="${state.view === "home" ? "is-active" : ""}">⌂ Trang chủ</button><button type="button" data-nav="follows" class="${state.view === "follows" ? "is-active" : ""}">♡ Theo dõi</button><button type="button" data-nav="bookmarks" class="${state.view === "bookmarks" ? "is-active" : ""}">★ Dấu trang</button><button type="button" data-nav="history" class="${state.view === "history" ? "is-active" : ""}">◷ Lịch sử</button><strong>Thể loại</strong>${sidebarGenres().map((genre) => `<button type="button" data-genre="${escapeHtml(genre)}" class="${state.genre === genre && state.view === "home" ? "is-active" : ""}">${escapeHtml(genre)}</button>`).join("")}${availableGenres().length > 15 ? `<button type="button" class="cr-genre-more" data-action="genre-more">${state.genreExpanded ? "Thu gọn thể loại ↑" : `Xem thêm ${availableGenres().length - 15} thể loại ↓`}</button>` : ""}<footer><button type="button" data-nav="sources">＋ Quản lý nguồn</button><small>${catalogTotal().toLocaleString("vi-VN")} truyện toàn kho · trang ${state.catalogPage.toLocaleString("vi-VN")}</small></footer></aside><main class="cr-content">${content}</main></div>
      <div class="cr-toast-tray" data-cr-toast></div><div class="cr-importing" data-importing hidden><i></i><strong>Đang nhập truyện…</strong><span>Không đóng trang cho đến khi hoàn tất.</span></div>
    </section>`;
  }

  function render() {
    if (!host) return;
    if (readerObserver) { readerObserver.disconnect(); readerObserver = null; }
    let content;
    if (state.view === "detail") content = detailView(activeSeries());
    else if (state.view === "reader") content = readerView(activeSeries(), activeChapter());
    else if (state.view === "follows" || state.view === "history") content = libraryView(state.view);
    else if (state.view === "bookmarks") content = bookmarkView();
    else if (state.view === "sources") content = sourceView();
    else content = homeView();
    host.innerHTML = shellHtml(content);
    root = host.firstElementChild;
    const sort = root.querySelector("[data-sort]");
    if (sort) sort.value = state.sort;
    bindInputs();
    if (state.view === "reader") { restoreReaderPosition(); preloadAdjacentPages(activeChapter(), state.readerPage); }
  }

  function setImporting(active) {
    state.importing = active;
    setLoadingOverlay(active, "Đang nhập truyện…", "Không đóng trang cho đến khi hoàn tất.");
  }

  function setLoadingOverlay(active, title = "Đang xử lý…", detail = "Vui lòng chờ trong giây lát.") {
    const overlay = root?.querySelector("[data-importing]");
    if (!overlay) return;
    const strong = overlay.querySelector("strong");
    const span = overlay.querySelector("span");
    if (strong) strong.textContent = title;
    if (span) span.textContent = detail;
    overlay.hidden = !active;
  }

  function normalizeCatalog(data, sourceLabel = "Catalog JSON") {
    const rows = Array.isArray(data) ? data : data?.series;
    if (!Array.isArray(rows)) throw new Error("Catalog cần có mảng series.");
    return rows.slice(0, 5000).map((entry, index) => {
      if (!entry?.title || !Array.isArray(entry.chapters)) throw new Error(`Series ${index + 1} thiếu title hoặc chapters.`);
      const id = String(entry.id || `feed-${slugify(entry.title)}-${index}`);
      const chapters = entry.chapters.slice(0, 5000).map((chapter, chapterIndex) => ({
        id: String(chapter.id || `${id}-c${chapterIndex + 1}`), number: Number(chapter.number ?? chapterIndex + 1), title: String(chapter.title || ""), updatedAt: Date.parse(chapter.updatedAt) || Date.now(), pages: (chapter.pages || []).filter((url) => typeof url === "string" && /^(https?:|blob:|data:)/.test(url)).slice(0, 1000)
      })).filter((chapter) => chapter.pages.length);
      return { id, title: String(entry.title), altTitles: entry.altTitles || [], author: String(entry.author || "Đang cập nhật"), cover: String(entry.cover || chapters[0]?.pages[0] || makeCover(entry.title, index)), genres: Array.isArray(entry.genres) ? entry.genres.map(String) : [], status: String(entry.status || "Đang cập nhật"), description: String(entry.description || ""), rating: clamp(entry.rating || 4.5, 0, 5), views: Math.max(0, Number(entry.views || 0)), updatedAt: Date.parse(entry.updatedAt) || Date.now(), chapters, chapterTotal: chapters.length, chapterCountEstimate: chapters.length, sourceType: "feed", rights: String(entry.rights || sourceLabel) };
    }).filter((series) => series.chapters.length);
  }

  function mergeCatalog(seriesList) {
    const map = new Map(state.catalog.map((series) => [series.id, series]));
    seriesList.forEach((series) => {
      const existing = map.get(series.id);
      if (existing?.sourceType === "otruyen" && existing.chaptersLoaded && !series.chaptersLoaded) {
        Object.assign(existing, { cover: series.cover || existing.cover, updatedAt: series.updatedAt || existing.updatedAt, status: series.status || existing.status, chapterCountEstimate: series.chapterCountEstimate || existing.chapterCountEstimate || seriesChapterCount(existing) });
      } else map.set(series.id, series);
    });
    state.catalog = [...map.values()];
  }

  async function importJsonFile(file) {
    setImporting(true);
    try {
      const series = normalizeCatalog(JSON.parse(await file.text()), file.name);
      mergeCatalog(series);
      state.view = "home";
      render();
      notify(`Đã nhập ${series.length} bộ truyện từ JSON.`, "success");
    } catch (error) { notify(error.message || "Không thể nhập JSON.", "error"); }
    finally { setImporting(false); }
  }

  async function importFeed() {
    const input = root.querySelector("[data-feed-url]");
    const url = input?.value?.trim();
    if (!url || !/^https:\/\//i.test(url)) return notify("Hãy nhập endpoint HTTPS hợp lệ.", "error");
    setImporting(true);
    try {
      const response = await fetch(url, { method: "GET", credentials: "omit", mode: "cors", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Nguồn phản hồi HTTP ${response.status}`);
      const series = normalizeCatalog(await response.json(), new URL(url).hostname);
      mergeCatalog(series);
      state.view = "home";
      render();
      notify(`Đã kết nối ${series.length} bộ truyện.`, "success");
    } catch (error) { notify(error.message || "Không thể kết nối feed. Kiểm tra CORS.", "error"); }
    finally { setImporting(false); }
  }

  async function importCbz(files) {
    if (!global.JSZip) return notify("Engine ZIP chưa sẵn sàng.", "error");
    setImporting(true);
    let added = 0;
    try {
      for (const file of Array.from(files || []).slice(0, 100)) {
        const zip = await global.JSZip.loadAsync(file, { checkCRC32: true });
        const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name)).sort((a, b) => naturalCompare(a.name, b.name));
        if (!entries.length) continue;
        const blobs = [];
        for (const entry of entries.slice(0, 2000)) blobs.push(await entry.async("blob"));
        const title = file.name.replace(/\.(cbz|zip)$/i, "");
        const id = `local-${slugify(title)}-${file.size}-${file.lastModified}`;
        const record = { id, title, altTitles: [], author: "Thư viện của bạn", cover: blobs[0], genres: ["Thư viện cá nhân"], status: "Đã nhập", description: `Được nhập từ ${file.name}.`, rating: 5, views: 0, updatedAt: Date.now(), sourceType: "local", rights: "Nội dung do người dùng nhập", chapters: [{ id: `${id}-chapter-1`, number: 1, title: "Chương 1", updatedAt: Date.now(), pages: blobs }] };
        await dbPut(record);
        mergeCatalog([hydrateStoredSeries(record)]);
        added += 1;
      }
      state.view = "home";
      render();
      notify(`Đã nhập và lưu offline ${added} bộ truyện.`, "success");
    } catch (error) { notify(error.message || "Không thể giải nén CBZ/ZIP.", "error"); }
    finally { setImporting(false); }
  }

  function downloadSampleJson() {
    const sample = { format: "hh-comic-catalog", version: 1, series: [{ id: "my-comic", title: "Tên truyện", author: "Tác giả", cover: "https://your-domain.com/cover.jpg", genres: ["Fantasy"], status: "Đang cập nhật", description: "Mô tả", rights: "Tên giấy phép hoặc chủ sở hữu", chapters: [{ id: "chapter-1", number: 1, title: "Khởi đầu", updatedAt: new Date().toISOString(), pages: ["https://your-domain.com/chapter-1/page-001.jpg"] }] }] };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "hh-comics-catalog-sample.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function openSeries(id) {
    state.activeSeriesId = id;
    state.view = "detail";
    render();
    const series = activeSeries();
    syncDeepLink(series, null);
    if (series?.sourceType === "otruyen" && !series.chaptersLoaded) {
      state.remote.loading = true;
      try {
        await ensureRemoteSeriesDetails(series);
      } catch (error) {
        notify(error.message || "Không thể tải chi tiết truyện.", "error");
      } finally {
        state.remote.loading = false;
        if (root?.isConnected && state.activeSeriesId === id) render();
      }
    }
    if (series?.sourceType === "mangadex" && !series.chaptersLoaded) {
      state.mangadex.loading = true;
      try {
        await ensureMangaDexSeriesDetails(series);
      } catch (error) {
        notify(error.message || "Không thể tải chi tiết MangaDex.", "error");
      } finally {
        state.mangadex.loading = false;
        if (root?.isConnected && state.activeSeriesId === id) render();
      }
    }
  }

  async function openReader(seriesId, chapterId, requestedPage = null) {
    const series = state.catalog.find((entry) => entry.id === seriesId);
    if (series?.sourceType === "otruyen" && !series.chaptersLoaded) {
      state.remote.loading = true;
      try { await ensureRemoteSeriesDetails(series); }
      catch (error) { state.remote.loading = false; return notify(error.message || "Không thể tải danh sách chương.", "error"); }
      state.remote.loading = false;
    }
    if (series?.sourceType === "mangadex" && !series.chaptersLoaded) {
      state.mangadex.loading = true;
      try { await ensureMangaDexSeriesDetails(series); }
      catch (error) { state.mangadex.loading = false; return notify(error.message || "Không thể tải danh sách chương MangaDex.", "error"); }
      state.mangadex.loading = false;
    }
    const chapter = series?.chapters?.find((entry) => entry.id === chapterId) || series?.chapters?.[0];
    if (!series || !chapter) return notify("Chương này chưa có ảnh.", "error");
    if (series.sourceType === "otruyen" && !chapter.pages?.length) {
      state.remote.loading = true;
      setLoadingOverlay(true, `Đang chuẩn bị Chương ${chapter.number}…`, "Clean Reader đang loại trang quảng cáo trước khi hiển thị nội dung truyện.");
      try { await ensureRemoteChapterPages(chapter); }
      catch (error) { return notify(error.message || "Không thể tải ảnh chapter.", "error"); }
      finally { state.remote.loading = false; setLoadingOverlay(false); }
    }
    if (series.sourceType === "mangadex" && !chapter.pages?.length) {
      state.mangadex.loading = true;
      setLoadingOverlay(true, `Đang chuẩn bị Chương ${chapter.number}…`, `Đang lấy ảnh data-saver và ghi nguồn ${chapter.group || "nhóm dịch"} từ MangaDex.`);
      try { await ensureMangaDexChapterPages(chapter); }
      catch (error) { return notify(error.message || "Không thể tải ảnh MangaDex.", "error"); }
      finally { state.mangadex.loading = false; setLoadingOverlay(false); }
    }
    if (!chapter.pages?.length) return notify("Chapter này chưa có ảnh.", "error");
    state.activeSeriesId = series.id;
    state.activeChapterId = chapter.id;
    const explicitPage = Number(requestedPage);
    state.readerPage = Number.isFinite(explicitPage) && explicitPage >= 0 ? clamp(explicitPage, 0, Math.max(0, chapter.pages.length - 1)) : state.progress[series.id]?.chapterId === chapter.id ? clamp(state.progress[series.id].page, 0, Math.max(0, chapter.pages.length - 1)) : 0;
    state.view = "reader";
    rememberSeries(series, chapter);
    updateProgress(state.readerPage);
    render();
  }

  function updateProgress(page) {
    const series = activeSeries(); const chapter = activeChapter(); if (!series || !chapter) return;
    state.readerPage = clamp(page, 0, Math.max(0, chapter.pages.length - 1));
    state.progress[series.id] = { chapterId: chapter.id, page: state.readerPage, percent: Math.round((state.readerPage + 1) / Math.max(1, chapter.pages.length) * 100), updatedAt: Date.now() };
    saveLocalState();
    const label = root?.querySelector("[data-reader-progress]"); if (label) label.textContent = `${state.progress[series.id].percent}%`;
    const pageLabel = root?.querySelector("[data-reader-page-label]"); if (pageLabel) pageLabel.textContent = `Trang ${state.readerPage + 1}/${chapter.pages.length}`;
    const slider = root?.querySelector("[data-reader-page-slider]"); if (slider) slider.value = String(state.readerPage + 1);
    const sliderLabel = root?.querySelector("[data-reader-slider-label]"); if (sliderLabel) sliderLabel.textContent = `${state.readerPage + 1}/${chapter.pages.length}`;
    const bookmarkButton = root?.querySelector('[data-action="reader-bookmark"]');
    if (bookmarkButton) { const saved = isCurrentPageBookmarked(); bookmarkButton.textContent = saved ? "★" : "☆"; bookmarkButton.classList.toggle("is-bookmarked", saved); bookmarkButton.setAttribute("aria-label", saved ? "Bỏ dấu trang" : "Đánh dấu trang này"); }
    rememberSeries(series, chapter);
    syncDeepLink(series, chapter, state.readerPage);
    preloadAdjacentPages(chapter, state.readerPage);
  }

  function readerNavigate(direction) {
    const series = activeSeries(); const chapter = activeChapter(); if (!series || !chapter) return;
    if (state.readerMode === "page") {
      const nextPage = state.readerPage + direction;
      if (nextPage >= 0 && nextPage < chapter.pages.length) { state.readerPage = nextPage; updateProgress(nextPage); return render(); }
    }
    const index = series.chapters.findIndex((entry) => entry.id === chapter.id) + direction;
    if (index >= 0 && index < series.chapters.length) openReader(series.id, series.chapters[index].id);
  }

  function preloadAdjacentPages(chapter, page) {
    [page - 1, page + 1, page + 2].forEach((index) => {
      const url = chapter?.pages?.[index];
      if (!url || preloadedPageUrls.has(url)) return;
      preloadedPageUrls.add(url);
      const image = new Image(); image.referrerPolicy = "no-referrer"; image.decoding = "async"; image.src = url;
      if (preloadedPageUrls.size > 18) preloadedPageUrls.delete(preloadedPageUrls.values().next().value);
    });
  }

  function toggleBookmark() {
    const series = activeSeries(); const chapter = activeChapter(); if (!series || !chapter) return;
    const key = bookmarkKey(series.id, chapter.id, state.readerPage);
    const index = state.bookmarks.findIndex((entry) => bookmarkKey(entry.seriesId, entry.chapterId, entry.page) === key);
    if (index >= 0) { state.bookmarks.splice(index, 1); saveLocalState(); updateProgress(state.readerPage); return notify("Đã bỏ dấu trang."); }
    state.bookmarks.push({ seriesId: series.id, chapterId: chapter.id, chapterNumber: chapter.number, page: state.readerPage, title: series.title, cover: series.cover, updatedAt: Date.now() });
    state.bookmarks = state.bookmarks.slice(-200); saveLocalState(); updateProgress(state.readerPage); notify("Đã lưu đúng chapter và trang hiện tại.", "success");
  }

  async function restoreDeepLink() {
    if (!global.location) return;
    const params = new URL(global.location.href).searchParams;
    const openId = String(params.get("comicOpen") || "").trim();
    const mangaDexId = String(params.get("comicMangaDex") || "").trim();
    const chapterNumber = params.get("comicChapter");
    const page = Math.max(0, Number(params.get("comicPage") || 1) - 1);
    if (mangaDexId) {
      if (!/^[0-9a-f-]{36}$/i.test(mangaDexId)) return notify("MangaDex series ID không hợp lệ.", "error");
      let mangaDexSeries = state.catalog.find((entry) => entry.sourceType === "mangadex" && entry.remoteId === mangaDexId);
      if (!mangaDexSeries) {
        mangaDexSeries = mapMangaDexSeries({ id: mangaDexId, title: "Đang tải truyện MangaDex…", tags: ["MangaDex"], sourceUrl: `https://mangadex.org/title/${mangaDexId}` });
        mergeCatalog([mangaDexSeries]);
      }
      setLoadingOverlay(true, "Đang mở MangaDex…", "Đang khôi phục đúng bản dịch, chapter và trang đã chia sẻ.");
      try {
        await ensureMangaDexSeriesDetails(mangaDexSeries);
        const mangaDexChapter = mangaDexSeries.chapters.find((entry) => entry.remoteChapterId === String(chapterNumber) || entry.id === String(chapterNumber)) || mangaDexSeries.chapters[0];
        if (chapterNumber && mangaDexChapter) await openReader(mangaDexSeries.id, mangaDexChapter.id, page); else await openSeries(mangaDexSeries.id);
      } catch (error) { notify(error.message || "Không thể mở liên kết MangaDex.", "error"); }
      finally { setLoadingOverlay(false); }
      return;
    }
    if (openId) {
      const openCatalogSeries = state.catalog.find((entry) => entry.sourceType === "github-open" && entry.id === openId);
      if (!openCatalogSeries) return notify("Nguồn truyện mở này không còn trong catalog.", "error");
      const openChapter = openCatalogSeries.chapters.find((entry) => String(entry.number) === String(chapterNumber)) || openCatalogSeries.chapters[0];
      if (chapterNumber && openChapter) await openReader(openCatalogSeries.id, openChapter.id, page); else await openSeries(openCatalogSeries.id);
      return;
    }
    const slug = String(params.get("comicSeries") || "").trim();
    if (!slug || !/^[a-z0-9-]{1,160}$/i.test(slug)) return;
    let series = state.catalog.find((entry) => entry.remoteSlug === slug);
    if (!series) {
      series = { id: `otruyen:${slug}`, title: "Đang tải truyện…", altTitles: [], author: "Đang cập nhật", cover: makeCover("HH Comics", 0), genres: [], status: "Đang cập nhật", description: "", rating: 4.5, views: 0, updatedAt: Date.now(), chapters: [], sourceType: "otruyen", sourceLabel: "OTruyen API", remoteSlug: slug, chaptersLoaded: false };
      mergeCatalog([series]);
    }
    setLoadingOverlay(true, "Đang mở liên kết truyện…", "Đang khôi phục đúng chapter và trang đã chia sẻ.");
    try {
      await ensureRemoteSeriesDetails(series);
      const chapter = series.chapters.find((entry) => String(entry.number) === String(chapterNumber)) || series.chapters[0];
      if (chapterNumber && chapter) await openReader(series.id, chapter.id, page); else await openSeries(series.id);
    } catch (error) { notify(error.message || "Không thể mở liên kết truyện.", "error"); }
    finally { setLoadingOverlay(false); }
  }

  function setupReaderObserver() {
    if (state.readerMode !== "scroll" || !("IntersectionObserver" in global)) return;
    readerObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) updateProgress(Number(visible.target.dataset.page || 0));
    }, { root: root.querySelector("[data-reader-pages]"), threshold: [0.45, 0.72] });
    root.querySelectorAll("[data-page]").forEach((page) => readerObserver.observe(page));
  }

  function restoreReaderPosition() {
    if (state.readerMode !== "scroll" || state.readerPage <= 0) return setupReaderObserver();
    const readerPages = root?.querySelector("[data-reader-pages]");
    const target = root?.querySelector(`[data-page="${state.readerPage}"]`);
    if (!readerPages || !target) return setupReaderObserver();
    const renderRoot = root;
    const align = () => {
      if (root !== renderRoot || !target.isConnected) return false;
      readerPages.scrollTop = Math.max(0, target.offsetTop - readerPages.offsetTop);
      return true;
    };
    align();
    const precedingImages = [...readerPages.querySelectorAll("[data-page] [data-reader-image]")].slice(0, state.readerPage + 1);
    const imagesReady = Promise.all(precedingImages.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    Promise.race([imagesReady, new Promise((resolve) => global.setTimeout(resolve, 3500))]).then(() => {
      if (!align()) return;
      global.requestAnimationFrame(() => {
        if (!align()) return;
        global.requestAnimationFrame(() => { if (root === renderRoot) setupReaderObserver(); });
      });
    });
  }

  function bindInputs() {
    const cbzInput = root.querySelector("[data-cbz-input]");
    const jsonInput = root.querySelector("[data-json-input]");
    cbzInput.addEventListener("change", () => { importCbz(cbzInput.files); cbzInput.value = ""; });
    jsonInput.addEventListener("change", () => { if (jsonInput.files[0]) importJsonFile(jsonInput.files[0]); jsonInput.value = ""; });
    root.querySelectorAll("[data-chapter-list] [data-read]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openReader(button.dataset.read, button.dataset.chapter);
    }));
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]");
    const nav = event.target.closest("[data-nav]");
    const read = event.target.closest("[data-read]");
    const series = event.target.closest("[data-series]");
    const genre = event.target.closest("[data-genre]");
    const follow = event.target.closest("[data-follow]");
    const catalogFilter = event.target.closest("[data-catalog-filter]");
    const catalogPage = event.target.closest("[data-catalog-page]");
    const mode = event.target.closest("[data-reader-mode]");
    const readerWidth = event.target.closest("[data-reader-width]");
    const readerTheme = event.target.closest("[data-reader-theme]");
    const readerNav = event.target.closest("[data-reader-nav]");
    if (read) { event.stopPropagation(); return openReader(read.dataset.read, read.dataset.chapter, read.dataset.pageTarget === undefined ? null : Number(read.dataset.pageTarget)); }
    if (follow) { event.stopPropagation(); const id = follow.dataset.follow; state.follows.has(id) ? state.follows.delete(id) : state.follows.add(id); saveLocalState(); return render(); }
    if (catalogPage) return loadCatalogPage(Number(catalogPage.dataset.catalogPage));
    if (series) return openSeries(series.dataset.series);
    if (catalogFilter) {
      state.catalogFilter = catalogFilter.dataset.catalogFilter; state.view = "home"; state.catalogPage = 1; clearDeepLink();
      return state.catalogFilter === "followed" ? render() : loadCatalogPage(1);
    }
    if (genre) {
      state.genre = genre.dataset.genre; state.query = ""; state.view = "home"; clearDeepLink(); render();
      state.catalogPage = 1;
      return loadCatalogPage(1);
    }
    if (nav) { state.view = nav.dataset.nav; clearDeepLink(); if (state.view === "home") { state.query = ""; state.genre = "Tất cả"; } return render(); }
    if (mode) { state.readerMode = mode.dataset.readerMode; saveLocalState(); return render(); }
    if (readerWidth) {
      state.readerWidth = readerWidth.dataset.readerWidth;
      saveLocalState();
      const reader = root.querySelector("[data-reader]");
      reader?.classList.remove("width-compact", "width-fit", "width-wide");
      reader?.classList.add(`width-${state.readerWidth}`);
      root.querySelectorAll("[data-reader-width]").forEach((button) => button.classList.toggle("is-active", button === readerWidth));
      return;
    }
    if (readerTheme) {
      state.readerTheme = readerTheme.dataset.readerTheme;
      saveLocalState();
      const reader = root.querySelector("[data-reader]");
      reader?.classList.remove("theme-dark", "theme-black", "theme-paper");
      reader?.classList.add(`theme-${state.readerTheme}`);
      root.querySelectorAll("[data-reader-theme]").forEach((button) => button.classList.toggle("is-active", button === readerTheme));
      return;
    }
    if (readerNav) return readerNavigate(readerNav.dataset.readerNav === "prev" ? -1 : 1);
    if (!action) return;
    if (action.dataset.action === "import-cbz") root.querySelector("[data-cbz-input]").click();
    else if (action.dataset.action === "import-json") root.querySelector("[data-json-input]").click();
    else if (action.dataset.action === "sample-json") downloadSampleJson();
    else if (action.dataset.action === "import-feed") importFeed();
    else if (action.dataset.action === "remote-more") loadCatalogPage(state.catalogPage + 1);
    else if (action.dataset.action === "remote-refresh") loadCatalogPage(1);
    else if (action.dataset.action === "mangadex-refresh") { state.catalogPage = 1; loadMangaDexCatalog({ offset: 0, reset: true }); }
    else if (action.dataset.action === "genre-more") { state.genreExpanded = !state.genreExpanded; render(); }
    else if (action.dataset.action === "reader-settings") {
      const panel = root.querySelector(".cr-reader-settings");
      const button = root.querySelector('[data-action="reader-settings"]');
      if (panel) panel.hidden = !panel.hidden;
      if (button && panel) button.setAttribute("aria-expanded", String(!panel.hidden));
    }
    else if (action.dataset.action === "reader-chapters") {
      const panel = root.querySelector(".cr-reader-chapters");
      const button = root.querySelector('.cr-reader-bar [data-action="reader-chapters"]');
      if (panel) panel.hidden = !panel.hidden;
      if (button && panel) button.setAttribute("aria-expanded", String(!panel.hidden));
    }
    else if (action.dataset.action === "reader-top") root.querySelector("[data-reader-pages]")?.scrollTo({ top: 0, behavior: "smooth" });
    else if (action.dataset.action === "reader-bookmark") toggleBookmark();
    else if (action.dataset.action === "reader-share") {
      const shareUrl = global.location?.href || "";
      if (!shareUrl || !global.navigator?.clipboard?.writeText) return notify("Trình duyệt chưa hỗ trợ sao chép liên kết.", "error");
      global.navigator.clipboard.writeText(shareUrl).then(() => notify("Đã sao chép liên kết đúng chapter và trang.", "success")).catch(() => notify("Không thể sao chép liên kết.", "error"));
    }
    else if (action.dataset.action === "reader-retry-image") {
      const figure = action.closest("figure"); const image = figure?.querySelector("[data-reader-image]"); const original = image?.dataset.originalSrc;
      if (!image || !original) return;
      figure.classList.remove("is-error"); action.hidden = true;
      image.src = /^https?:/i.test(original) ? `${original}${original.includes("?") ? "&" : "?"}hhRetry=${Date.now()}` : original;
    }
    else if (action.dataset.action === "reader-hide-page") {
      const chapter = activeChapter();
      const url = chapter?.pages?.[state.readerPage];
      if (!url || chapter.pages.length <= 1) return notify("Không thể ẩn trang cuối cùng của chapter.", "error");
      state.blockedPages.add(url);
      chapter.pages.splice(state.readerPage, 1);
      chapter.filteredPages = Number(chapter.filteredPages || 0) + 1;
      state.readerPage = clamp(state.readerPage, 0, chapter.pages.length - 1);
      saveLocalState();
      render();
      notify("Đã ẩn trang quảng cáo khỏi trình đọc.", "success");
    }
    else if (action.dataset.action === "reader-fullscreen") root.querySelector("[data-reader]")?.requestFullscreen?.();
  }

  function handleInput(event) {
    if (event.target.matches("[data-search]")) {
      state.query = event.target.value; state.genre = "Tất cả"; state.view = "home"; clearDeepLink();
      clearTimeout(handleInput.timer);
      handleInput.timer = setTimeout(() => {
        render();
        state.catalogPage = 1;
        loadCatalogPage(1);
      }, state.query.trim().length >= 2 ? 420 : 180);
    }
    else if (event.target.matches("[data-sort]")) { state.sort = event.target.value; state.catalogPage = 1; loadCatalogPage(1); }
    else if (event.target.matches("[data-catalog-page-input]") && event.type === "change") loadCatalogPage(Number(event.target.value));
    else if (event.target.matches("[data-reader-chapter]")) openReader(state.activeSeriesId, event.target.value);
    else if (event.target.matches("[data-reader-page-slider]")) {
      const page = clamp(Number(event.target.value) - 1, 0, Math.max(0, activeChapter()?.pages?.length - 1));
      const sliderLabel = root.querySelector("[data-reader-slider-label]"); if (sliderLabel) sliderLabel.textContent = `${page + 1}/${activeChapter()?.pages?.length || 0}`;
      if (event.type === "change") {
        if (state.readerMode === "scroll") root.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else { state.readerPage = page; updateProgress(page); render(); }
      }
    }
    else if (event.target.matches("[data-chapter-search]")) {
      const query = event.target.value.toLocaleLowerCase();
      root.querySelectorAll("[data-chapter-list]>button").forEach((button) => button.hidden = !button.textContent.toLocaleLowerCase().includes(query));
    }
  }

  function mount(target) {
    if (!target) return;
    unmount();
    host = target;
    loadLocalState();
    state.catalog = [];
    mergeCatalog(Array.isArray(global.HHOpenComicCatalog) ? global.HHOpenComicCatalog : []);
    mergeCatalog(state.recentSeries.map((series) => ({ ...series, chapters: (series.chapters || []).map((chapter) => ({ ...chapter, pages: [] })), chaptersLoaded: false })));
    state.catalogPage = 1;
    state.remote = { loading: false, page: 0, perPage: 24, total: 0, hasMore: true, context: "latest", error: "" };
    state.mangadex = { loading: false, offset: 0, limit: 24, total: 0, hasMore: true, context: "latest", error: "" };
    state.remoteGenres = [];
    state.remoteGenreSlugs = new Map();
    state.view = "home";
    host.addEventListener("click", handleClick);
    host.addEventListener("input", handleInput);
    host.addEventListener("change", handleInput);
    imageErrorHandler = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches("[data-reader-image]")) return;
      const figure = image.closest("figure"); if (!figure) return;
      figure.classList.add("is-error"); const retry = figure.querySelector(".cr-image-retry"); if (retry) retry.hidden = false;
    };
    host.addEventListener("error", imageErrorHandler, true);
    keyHandler = (event) => {
      if (!root?.isConnected || event.target instanceof Element && event.target.matches("input,textarea,select,[contenteditable]")) return;
      if (state.view === "reader" && event.key === "ArrowLeft") readerNavigate(-1);
      else if (state.view === "reader" && event.key === "ArrowRight") readerNavigate(1);
      else if (state.view === "reader" && event.key.toLocaleLowerCase() === "m") { state.readerMode = state.readerMode === "scroll" ? "page" : "scroll"; saveLocalState(); render(); }
      else if (state.view === "reader" && event.key.toLocaleLowerCase() === "f") root.querySelector("[data-reader]")?.requestFullscreen?.();
      else if (state.view === "reader" && event.key.toLocaleLowerCase() === "b") toggleBookmark();
      else if (event.key === "Escape" && state.view === "reader") openSeries(state.activeSeriesId);
    };
    global.addEventListener("keydown", keyHandler);
    render();
    loadImportedSeries();
    loadRemoteGenres();
    loadCatalogPage(1).then(restoreDeepLink);
    global.dispatchEvent(new CustomEvent("hh:comic-reader-ready"));
  }

  function unmount() {
    if (readerObserver) readerObserver.disconnect();
    readerObserver = null;
    if (keyHandler) global.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.clear();
    preloadedPageUrls.clear();
    if (host) { host.removeEventListener("click", handleClick); host.removeEventListener("input", handleInput); host.removeEventListener("change", handleInput); if (imageErrorHandler) host.removeEventListener("error", imageErrorHandler, true); host.replaceChildren(); }
    imageErrorHandler = null;
    host = null;
    root = null;
  }

  global.HHComicReaderHub = Object.freeze({ mount, unmount, version: "2.0.0" });
})(window);
