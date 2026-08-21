(function initHHSearchPlatform(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHSearchPlatform = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHSearchPlatform(scope) {
  "use strict";

  const API_BASE = String(scope?.HH_API_BASE || scope?.HH_REALTIME_URL || "").replace(/\/$/, "");
  const GOOGLE_CSE_ID = String(scope?.HH_GOOGLE_CSE_ID || "").trim();
  const KEYS = Object.freeze({
    searches: "hh.search-watch.history",
    webSaved: "hh.search-watch.web-saved",
    recent: "hh.search-watch.youtube-recent",
    favorites: "hh.search-watch.youtube-favorites",
    queue: "hh.search-watch.youtube-queue",
    playlists: "hh.youtube-hub.playlists.v1",
    preferences: "hh.search-watch.preferences",
    pending: "hh.search-platform.pending.v1",
    queryPresets: "hh.google-hub.query-presets.v1",
    searchSessions: "hh.google-hub.search-sessions.v1",
    researchProjects: "hh.search-platform.research-projects.v1",
    playback: "hh.youtube-hub.playback.v1",
    bookmarks: "hh.youtube-hub.bookmarks.v1",
    creatorPlans: "hh.youtube-hub.creator-plans.v1",
    bookshelves: "hh.google-hub.bookshelves.v1",
    trips: "hh.google-hub.trips.v1",
    translations: "hh.google-hub.translations.v1"
  });
  const LIMITS = Object.freeze({ searches: 40, webSaved: 300, recent: 60, favorites: 200, queue: 120, playlists: 60, queryPresets: 40, searchSessions: 60, researchProjects: 40, bookmarks: 500, creatorPlans: 120, bookshelves: 200, trips: 200, translations: 300 });
  const volatileStore = new Map();
  const activeRequests = new Map();
  const responseCache = new Map();
  const requestStats = { calls: 0, cacheHits: 0, cancelled: 0, failed: 0, lastLatency: 0, lastSuccessAt: "" };
  let csePromise = null;

  const cleanText = (value, limit = 300) => String(value ?? "").trim().slice(0, limit);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function readJson(key, fallback) {
    try {
      const raw = scope?.localStorage?.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch { /* Fall through to the per-session store. */ }
    return clone(volatileStore.has(key) ? volatileStore.get(key) : fallback);
  }

  function writeJson(key, value, detail = {}) {
    volatileStore.set(key, clone(value));
    try { scope?.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
    scope?.dispatchEvent?.(new CustomEvent("hh:search-platform-change", { detail: { key, ...detail } }));
    return value;
  }

  function readArray(key) {
    const value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function normalizeVideo(video) {
    const id = cleanText(video?.id, 128);
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) return null;
    return {
      id,
      title: cleanText(video?.title || `Video YouTube ${id}`, 300),
      channel: cleanText(video?.channel || "YouTube", 200),
      channelId: cleanText(video?.channelId, 100),
      description: cleanText(video?.description, 800),
      thumbnail: cleanText(video?.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 2000),
      publishedAt: cleanText(video?.publishedAt, 40),
      duration: cleanText(video?.duration, 30),
      views: Math.max(0, Number(video?.views || 0)),
      likes: Math.max(0, Number(video?.likes || 0)),
      definition: cleanText(video?.definition, 20),
      captions: video?.captions === true,
      live: video?.live === true,
      upcoming: video?.upcoming === true
    };
  }

  function parseYouTubeId(value) {
    const input = cleanText(value, 2000);
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
      if (/^youtube(?:-nocookie)?\.com$/i.test(host)) {
        if (url.searchParams.get("v")) return cleanText(url.searchParams.get("v"), 32);
        const parts = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) return cleanText(parts[1], 32);
      }
    } catch { /* Search text, not a URL. */ }
    return "";
  }

  function parsePlaylistId(value) {
    const input = cleanText(value, 2000);
    try {
      const id = new URL(input).searchParams.get("list") || "";
      return /^[A-Za-z0-9_-]{10,128}$/.test(id) ? id : "";
    } catch {
      return /^[A-Za-z0-9_-]{10,128}$/.test(input) ? input : "";
    }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN", { notation: Number(value) > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "";
    try { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
    catch { return ""; }
  }

  function faviconFor(url) {
    try { return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(new URL(url).origin)}&sz=64`; }
    catch { return ""; }
  }

  function list(kind) {
    const key = KEYS[kind];
    return key ? clone(readArray(key)) : [];
  }

  function preferences() {
    const value = readJson(KEYS.preferences, {});
    return {
      privacyShield: value.privacyShield !== false,
      autoplayQueue: value.autoplayQueue === true,
      loopQueue: value.loopQueue === true,
      playerRate: [0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(value.playerRate)) ? Number(value.playerRate) : 1,
      googleSafe: value.googleSafe !== false,
      privateGoogle: value.privateGoogle === true,
      domainBlacklist: Array.isArray(value.domainBlacklist) ? value.domainBlacklist.map((item) => cleanText(item, 253)).filter(Boolean).slice(0, 100) : [],
      domainWhitelist: Array.isArray(value.domainWhitelist) ? value.domainWhitelist.map((item) => cleanText(item, 253)).filter(Boolean).slice(0, 100) : []
    };
  }

  function updatePreferences(patch) {
    return writeJson(KEYS.preferences, { ...preferences(), ...(patch || {}) }, { kind: "preferences" });
  }

  function rememberSearch(provider, query) {
    const cleanQuery = cleanText(query, 180);
    if (!cleanQuery) return list("searches");
    if (provider !== "youtube" && preferences().privateGoogle) return list("searches");
    const item = { provider: provider === "youtube" ? "youtube" : "google", query: cleanQuery, at: new Date().toISOString() };
    const items = readArray(KEYS.searches).filter((entry) => !(entry?.provider === item.provider && entry?.query === item.query));
    return writeJson(KEYS.searches, [item, ...items].slice(0, LIMITS.searches), { kind: "searches" });
  }

  function toggleWebSaved(item) {
    const url = cleanText(item?.url, 2000);
    if (!/^https?:\/\//i.test(url)) return false;
    const items = readArray(KEYS.webSaved);
    const exists = items.some((entry) => entry.url === url);
    const safeItem = {
      title: cleanText(item?.title || url, 300), url, displayUrl: cleanText(item?.displayUrl, 300),
      snippet: cleanText(item?.snippet, 800), image: cleanText(item?.image, 2000), savedAt: new Date().toISOString(),
      folder: cleanText(item?.folder || "Chưa phân loại", 80), tags: Array.isArray(item?.tags) ? item.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 12) : [],
      notes: cleanText(item?.notes, 1200), read: item?.read === true, sourceText: cleanText(item?.sourceText || item?.snippet, 4000)
    };
    writeJson(KEYS.webSaved, exists ? items.filter((entry) => entry.url !== url) : [safeItem, ...items].slice(0, LIMITS.webSaved), { kind: "webSaved" });
    return !exists;
  }

  function updateWebSaved(url, patch = {}) {
    const target = cleanText(url, 2000);
    const items = readArray(KEYS.webSaved);
    const index = items.findIndex((item) => item?.url === target);
    if (index < 0) return null;
    const current = items[index];
    items[index] = {
      ...current,
      folder: cleanText(patch.folder ?? current.folder ?? "Chưa phân loại", 80),
      tags: Array.isArray(patch.tags) ? patch.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 12) : current.tags || [],
      notes: cleanText(patch.notes ?? current.notes, 1200),
      read: patch.read == null ? current.read === true : patch.read === true
    };
    writeJson(KEYS.webSaved, items, { kind: "webSaved" });
    return clone(items[index]);
  }

  function saveRecord(kind, record, { idPrefix = kind, limit = LIMITS[kind] || 100 } = {}) {
    if (!KEYS[kind]) return null;
    const safe = { ...clone(record || {}), id: cleanText(record?.id, 120) || uid(idPrefix), updatedAt: new Date().toISOString() };
    if (!safe.createdAt) safe.createdAt = safe.updatedAt;
    const items = readArray(KEYS[kind]).filter((item) => item?.id !== safe.id);
    writeJson(KEYS[kind], [safe, ...items].slice(0, limit), { kind });
    return clone(safe);
  }

  function removeRecord(kind, id) {
    if (!KEYS[kind]) return false;
    const safeId = cleanText(id, 120);
    const items = readArray(KEYS[kind]);
    const next = items.filter((item) => item?.id !== safeId);
    if (next.length === items.length) return false;
    writeJson(KEYS[kind], next, { kind });
    return true;
  }

  function saveQueryPreset(preset) {
    return saveRecord("queryPresets", { ...preset, name: cleanText(preset?.name || preset?.query || "Truy vấn", 80), query: cleanText(preset?.query, 600), filters: clone(preset?.filters || {}) }, { idPrefix: "query" });
  }

  function saveSearchSession(searchSession) {
    return saveRecord("searchSessions", {
      ...searchSession, name: cleanText(searchSession?.name || searchSession?.query || "Phiên nghiên cứu", 100), query: cleanText(searchSession?.query, 600), filters: clone(searchSession?.filters || {}),
      results: (Array.isArray(searchSession?.results) ? searchSession.results : []).slice(0, 50).map((item) => ({ title: cleanText(item?.title, 300), url: cleanText(item?.url, 2000), displayUrl: cleanText(item?.displayUrl, 300), snippet: cleanText(item?.snippet, 1000) }))
    }, { idPrefix: "session" });
  }

  function saveResearchProject(project) {
    return saveRecord("researchProjects", {
      ...project, name: cleanText(project?.name || "Dự án nghiên cứu", 100),
      sources: (Array.isArray(project?.sources) ? project.sources : []).slice(0, 200).map((source) => ({ id: cleanText(source?.id, 120) || uid("source"), type: cleanText(source?.type || "website", 30), title: cleanText(source?.title, 300), url: cleanText(source?.url, 2000), note: cleanText(source?.note, 1200), timestamp: Math.max(0, Number(source?.timestamp || 0)), addedAt: source?.addedAt || new Date().toISOString() }))
    }, { idPrefix: "research" });
  }

  function playbackFor(videoId) {
    const id = cleanText(videoId, 128);
    return clone(readJson(KEYS.playback, {})[id] || { videoId: id, seconds: 0, duration: 0, updatedAt: "" });
  }

  function savePlayback(videoId, seconds, duration = 0) {
    const id = cleanText(videoId, 128);
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) return null;
    const all = readJson(KEYS.playback, {});
    all[id] = { videoId: id, seconds: Math.max(0, Number(seconds || 0)), duration: Math.max(0, Number(duration || 0)), updatedAt: new Date().toISOString() };
    const entries = Object.values(all).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 300);
    writeJson(KEYS.playback, Object.fromEntries(entries.map((item) => [item.videoId, item])), { kind: "playback" });
    return clone(all[id]);
  }

  function addBookmark(videoId, bookmark = {}) {
    const id = cleanText(videoId, 128);
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) return null;
    return saveRecord("bookmarks", { videoId: id, seconds: Math.max(0, Number(bookmark.seconds || 0)), label: cleanText(bookmark.label || "Mốc đáng nhớ", 100), note: cleanText(bookmark.note, 1200), color: cleanText(bookmark.color || "rose", 20), personalChapter: bookmark.personalChapter !== false }, { idPrefix: "mark" });
  }

  function bookmarksFor(videoId) { return list("bookmarks").filter((item) => item?.videoId === cleanText(videoId, 128)).sort((a, b) => Number(a.seconds) - Number(b.seconds)); }

  function queueInsert(video, position = "later") {
    const safeVideo = normalizeVideo(video);
    if (!safeVideo) return [];
    const items = readArray(KEYS.queue).filter((item) => item?.id !== safeVideo.id);
    if (position === "next") items.unshift(safeVideo); else items.push(safeVideo);
    return writeJson(KEYS.queue, items.slice(0, LIMITS.queue), { kind: "queue" });
  }

  function dedupeQueue() {
    const seen = new Set();
    return writeJson(KEYS.queue, readArray(KEYS.queue).filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id)), { kind: "queue" });
  }

  function shuffleQueue(seed = Date.now()) {
    let value = Number(seed) || Date.now();
    const random = () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
    const items = readArray(KEYS.queue);
    for (let index = items.length - 1; index > 0; index -= 1) { const next = Math.floor(random() * (index + 1)); [items[index], items[next]] = [items[next], items[index]]; }
    return writeJson(KEYS.queue, items, { kind: "queue" });
  }

  function isVideoIn(kind, id) {
    return list(kind).some((item) => item.id === id);
  }

  function toggleVideo(kind, video) {
    if (!["favorites", "queue"].includes(kind)) return false;
    const safeVideo = normalizeVideo(video);
    if (!safeVideo) return false;
    const items = readArray(KEYS[kind]);
    const exists = items.some((entry) => entry.id === safeVideo.id);
    const next = exists ? items.filter((entry) => entry.id !== safeVideo.id) : kind === "queue" ? [...items, safeVideo] : [safeVideo, ...items];
    const limited = kind === "queue" ? next.slice(-LIMITS.queue) : next.slice(0, LIMITS[kind]);
    writeJson(KEYS[kind], limited, { kind });
    return !exists;
  }

  function rememberVideo(video) {
    if (preferences().privacyShield) return list("recent");
    const safeVideo = normalizeVideo(video);
    if (!safeVideo) return list("recent");
    const items = readArray(KEYS.recent).filter((entry) => entry.id !== safeVideo.id);
    return writeJson(KEYS.recent, [safeVideo, ...items].slice(0, LIMITS.recent), { kind: "recent" });
  }

  function reorderQueue(from, to) {
    const items = readArray(KEYS.queue);
    const start = Number(from), end = Number(to);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start >= items.length || end >= items.length || start === end) return items;
    const [item] = items.splice(start, 1);
    items.splice(end, 0, item);
    return writeJson(KEYS.queue, items, { kind: "queue" });
  }

  function clear(kind) {
    if (!KEYS[kind] || kind === "preferences") return [];
    return writeJson(KEYS[kind], [], { kind });
  }

  function clearSearches(provider) {
    const normalized = provider === "youtube" ? "youtube" : "google";
    const next = readArray(KEYS.searches).filter((item) => item?.provider !== normalized);
    return writeJson(KEYS.searches, next, { kind: "searches" });
  }

  function playlists() {
    return list("playlists").map((playlist) => ({ ...playlist, videos: Array.isArray(playlist.videos) ? playlist.videos.map(normalizeVideo).filter(Boolean) : [] }));
  }

  function createPlaylist(name) {
    const label = cleanText(name, 80);
    if (!label) return null;
    const items = playlists();
    const playlist = { id: uid("playlist"), name: label, videos: [], createdAt: new Date().toISOString() };
    writeJson(KEYS.playlists, [playlist, ...items].slice(0, LIMITS.playlists), { kind: "playlists" });
    return clone(playlist);
  }

  function addToPlaylist(playlistId, video) {
    const safeVideo = normalizeVideo(video);
    if (!safeVideo) return false;
    const items = playlists();
    const playlist = items.find((entry) => entry.id === playlistId);
    if (!playlist) return false;
    if (!playlist.videos.some((entry) => entry.id === safeVideo.id)) playlist.videos.push(safeVideo);
    playlist.videos = playlist.videos.slice(-80);
    writeJson(KEYS.playlists, items, { kind: "playlists" });
    return true;
  }

  function updatePlaylist(playlistId, patch = {}) {
    const items = playlists();
    const playlist = items.find((entry) => entry.id === cleanText(playlistId, 120));
    if (!playlist) return null;
    if (patch.name != null) playlist.name = cleanText(patch.name, 80) || playlist.name;
    if (patch.cover != null) playlist.cover = cleanText(patch.cover, 2000);
    if (Array.isArray(patch.videos)) playlist.videos = patch.videos.map(normalizeVideo).filter(Boolean).slice(0, 120);
    playlist.updatedAt = new Date().toISOString();
    writeJson(KEYS.playlists, items, { kind: "playlists" });
    return clone(playlist);
  }

  function deletePlaylist(playlistId) {
    const id = cleanText(playlistId, 120);
    const items = playlists();
    const next = items.filter((entry) => entry.id !== id);
    if (next.length === items.length) return false;
    writeJson(KEYS.playlists, next, { kind: "playlists" });
    return true;
  }

  function duplicatePlaylist(playlistId) {
    const sourcePlaylist = playlists().find((entry) => entry.id === cleanText(playlistId, 120));
    if (!sourcePlaylist) return null;
    const copy = { ...sourcePlaylist, id: uid("playlist"), name: `${sourcePlaylist.name} · bản sao`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeJson(KEYS.playlists, [copy, ...playlists()].slice(0, LIMITS.playlists), { kind: "playlists" });
    return clone(copy);
  }

  async function request(provider, params, options = {}) {
    if (!API_BASE) throw Object.assign(new Error("Backend chưa được khai báo trong config.js."), { code: "BACKEND_NOT_CONFIGURED" });
    const query = params instanceof URLSearchParams ? params.toString() : String(params || "");
    const requestKey = cleanText(options.key || `${provider}:${query}`, 1200);
    const cacheKey = `${provider}?${query}`;
    const cached = responseCache.get(cacheKey);
    if (options.cache !== false && cached && Date.now() - cached.at < Math.max(0, Number(options.ttl || 45000))) { requestStats.cacheHits += 1; return clone(cached.data); }
    if (options.cancelPrevious !== false && activeRequests.has(requestKey)) { activeRequests.get(requestKey).abort(); requestStats.cancelled += 1; }
    const controller = new AbortController();
    activeRequests.set(requestKey, controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    const startedAt = scope?.performance?.now?.() || Date.now();
    requestStats.calls += 1;
    try {
      const response = await fetch(`${API_BASE}/api/search/${provider}?${query}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(cleanText(data.error || "Dịch vụ tìm kiếm chưa phản hồi.", 400)), { code: data.code || `HTTP_${response.status}` });
      requestStats.lastLatency = Math.round((scope?.performance?.now?.() || Date.now()) - startedAt);
      requestStats.lastSuccessAt = new Date().toISOString();
      if (options.cache !== false) responseCache.set(cacheKey, { at: Date.now(), data: clone(data) });
      return data;
    } catch (error) {
      requestStats.failed += error?.name === "AbortError" ? 0 : 1;
      if (error?.name === "AbortError") throw Object.assign(new Error("Đã hủy yêu cầu hoặc dịch vụ phản hồi quá chậm."), { code: "PROVIDER_CANCELLED" });
      throw error;
    } finally { clearTimeout(timer); if (activeRequests.get(requestKey) === controller) activeRequests.delete(requestKey); }
  }

  function cancelRequest(key) {
    const requestKey = cleanText(key, 1200);
    const controller = activeRequests.get(requestKey);
    if (!controller) return false;
    controller.abort(); activeRequests.delete(requestKey); requestStats.cancelled += 1; return true;
  }

  function technicalStatus() { return { ...requestStats, active: activeRequests.size, cached: responseCache.size }; }

  async function health() {
    try { return await request("google", new URLSearchParams({ health: "1" })); }
    catch (error) { return { ok: false, error: error.message, services: {} }; }
  }

  async function searchGoogle(query, filters = {}) {
    const cleanQuery = cleanText(query, 180);
    if (!cleanQuery) throw Object.assign(new Error("Hãy nhập nội dung cần tìm."), { code: "EMPTY_QUERY" });
    rememberSearch("google", cleanQuery);
    const params = new URLSearchParams({
      q: cleanQuery,
      kind: filters.kind === "images" ? "images" : "web",
      page: String(Math.max(1, Math.min(10, Number(filters.page || 1)))),
      date: cleanText(filters.date, 10),
      file: cleanText(filters.file, 10),
      site: cleanText(filters.site, 253),
      safe: filters.safe === false ? "off" : "active"
    });
    return request("google", params, { key: "google-search", ttl: 45000 });
  }

  async function searchYouTube(query, filters = {}) {
    const cleanQuery = cleanText(query, 180);
    if (!cleanQuery) throw Object.assign(new Error("Hãy nhập video cần tìm."), { code: "EMPTY_QUERY" });
    rememberSearch("youtube", cleanQuery);
    const directId = parseYouTubeId(cleanQuery);
    if (directId) return { provider: "youtube", query: cleanQuery, direct: true, total: 1, items: [normalizeVideo({ id: directId })] };
    const params = new URLSearchParams({ q: cleanQuery });
    const safeFilters = {
      order: ["relevance", "date", "rating", "viewCount"].includes(filters.order) ? filters.order : "relevance",
      duration: ["any", "short", "medium", "long"].includes(filters.duration) ? filters.duration : "any",
      definition: ["any", "high", "standard"].includes(filters.definition) ? filters.definition : "any",
      caption: ["any", "closedCaption", "none"].includes(filters.caption) ? filters.caption : "any",
      event: ["any", "live", "upcoming", "completed"].includes(filters.event) ? filters.event : "any",
      published: ["any", "d1", "w1", "m1", "y1"].includes(filters.published) ? filters.published : "any",
      safe: ["none", "moderate", "strict"].includes(filters.safe) ? filters.safe : "moderate",
      region: ["VN", "US", "GB", "JP", "KR"].includes(filters.region) ? filters.region : "VN",
      language: ["vi", "en", "ja", "ko"].includes(filters.language) ? filters.language : "vi",
      pageToken: cleanText(filters.pageToken, 200)
    };
    Object.entries(safeFilters).forEach(([key, value]) => params.set(key, value));
    const data = await request("youtube", params, { key: "youtube-search", ttl: 60000 });
    data.items = (Array.isArray(data.items) ? data.items : []).map(normalizeVideo).filter(Boolean);
    return data;
  }

  async function searchYouTubeResource(action, params = {}) {
    const query = new URLSearchParams({ action: cleanText(action, 40) });
    Object.entries(params || {}).forEach(([key, value]) => { if (value != null && String(value).trim()) query.set(key, cleanText(value, 1000)); });
    return request("youtube", query, { key: `youtube-resource:${action}`, ttl: 60000 });
  }

  async function searchGoogleResource(action, params = {}) {
    const query = new URLSearchParams({ action: cleanText(action, 40) });
    Object.entries(params || {}).forEach(([key, value]) => { if (value != null && String(value).trim()) query.set(key, cleanText(value, 1000)); });
    return request("google", query, { key: `google-resource:${action}`, ttl: 120000 });
  }

  async function importPlaylist(value) {
    const playlistId = parsePlaylistId(value);
    if (!playlistId) throw Object.assign(new Error("Hãy nhập liên kết hoặc ID playlist hợp lệ."), { code: "INVALID_PLAYLIST" });
    const data = await request("youtube", new URLSearchParams({ action: "playlist-items", playlistId, maxResults: "50" }));
    const videos = (Array.isArray(data.items) ? data.items : []).map((item) => normalizeVideo({
      id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      title: item.snippet?.title,
      channel: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle,
      description: item.snippet?.description,
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
      publishedAt: item.snippet?.publishedAt
    })).filter((video) => video && !["Private video", "Deleted video"].includes(video.title));
    const existing = readArray(KEYS.queue);
    const merged = [...existing, ...videos.filter((video) => !existing.some((item) => item.id === video.id))].slice(-LIMITS.queue);
    writeJson(KEYS.queue, merged, { kind: "queue" });
    return { playlistId, added: merged.length - existing.length, total: merged.length, videos };
  }

  function savePending(provider, query = "") {
    try { scope?.sessionStorage?.setItem(KEYS.pending, JSON.stringify({ provider, query: cleanText(query, 180), at: Date.now() })); } catch {}
  }

  function consumePending(provider) {
    try {
      const value = JSON.parse(scope?.sessionStorage?.getItem(KEYS.pending) || "null");
      if (!value || value.provider !== provider || Date.now() - Number(value.at || 0) > 30000) return null;
      scope.sessionStorage.removeItem(KEYS.pending);
      return { provider, query: cleanText(value.query, 180) };
    } catch { return null; }
  }

  function loadGoogleCse() {
    if (!GOOGLE_CSE_ID) return Promise.reject(Object.assign(new Error("Google Search Engine ID chưa được cấu hình."), { code: "GOOGLE_CSE_NOT_CONFIGURED" }));
    if (scope.google?.search?.cse?.element) return Promise.resolve(scope.google.search.cse.element);
    if (csePromise) return csePromise;
    csePromise = new Promise((resolve, reject) => {
      let script = document.querySelector("script[data-hh-google-cse]");
      const started = Date.now();
      const waitForApi = () => {
        if (scope.google?.search?.cse?.element) return resolve(scope.google.search.cse.element);
        if (Date.now() - started > 10000) return reject(Object.assign(new Error("Google Search Element chưa khởi tạo."), { code: "GOOGLE_CSE_LOAD_FAILED" }));
        setTimeout(waitForApi, 120);
      };
      if (!script) {
        script = document.createElement("script");
        script.async = true;
        script.dataset.hhGoogleCse = "true";
        script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(GOOGLE_CSE_ID)}`;
        script.onerror = () => reject(Object.assign(new Error("Không tải được Google Search Element."), { code: "GOOGLE_CSE_LOAD_FAILED" }));
        document.head.append(script);
      }
      waitForApi();
    }).catch((error) => { csePromise = null; throw error; });
    return csePromise;
  }

  async function renderGoogleCse(container, query) {
    if (!container) throw new Error("Thiếu vùng hiển thị Google Search.");
    const elementApi = await loadGoogleCse();
    container.replaceChildren();
    const node = document.createElement("div");
    const name = uid("hh-google-cse");
    node.id = name;
    container.append(node);
    elementApi.render({ div: name, tag: "searchresults-only", gname: name, attributes: { linkTarget: "_blank", safeSearch: preferences().googleSafe ? "active" : "off" } });
    const element = elementApi.getElement(name);
    if (!element?.execute) throw Object.assign(new Error("Google Search Element chưa sẵn sàng."), { code: "GOOGLE_CSE_RENDER_FAILED" });
    element.execute(cleanText(query, 180));
    return name;
  }

  return Object.freeze({
    version: "2.0.0", KEYS, API_BASE, GOOGLE_CSE_ID, cleanText, formatNumber, formatDate, faviconFor,
    list, clear, clearSearches, preferences, updatePreferences, rememberSearch, toggleWebSaved, isVideoIn, toggleVideo,
    updateWebSaved, saveRecord, removeRecord, saveQueryPreset, saveSearchSession, saveResearchProject,
    playbackFor, savePlayback, addBookmark, bookmarksFor, queueInsert, dedupeQueue, shuffleQueue,
    rememberVideo, reorderQueue, playlists, createPlaylist, addToPlaylist, updatePlaylist, deletePlaylist, duplicatePlaylist, parseYouTubeId, parsePlaylistId,
    normalizeVideo, health, searchGoogle, searchYouTube, searchYouTubeResource, searchGoogleResource, importPlaylist, savePending, consumePending,
    cancelRequest, technicalStatus, renderGoogleCse
  });
});
