(function initHHOpenMusicHub(global) {
  "use strict";

  const VERSION = "2.0.0";
  const MANIFEST_URL = "/assets/open-media/curated-music-v1.json";
  const STORAGE_PREFIX = "hh.open-music-hub.v1";
  const ALLOWED_LICENSE_URLS = Object.freeze({
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "PDM-1.0": "https://creativecommons.org/publicdomain/mark/1.0/",
    "CC-BY-2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/"
  });
  const ALLOWED_LICENSES = new Set(Object.keys(ALLOWED_LICENSE_URLS));
  const DEFAULT_PALETTE = Object.freeze(["#5ee7ff", "#755cff", "#ff6da8"]);
  const REPEAT_MODES = ["off", "all", "one"];
  const CROSSFADE_VALUES = [0, 3, 5, 8];
  const REQUIRED_MUSIC_LAYERS = ["composition", "performance", "masterRecording", "artwork"];
  const MAX_HISTORY = 60;

  let host = null;
  let root = null;
  let audio = null;
  let standbyAudio = null;
  let abortController = null;
  let pendingSeek = 0;
  let lastProgressWrite = 0;
  let statusTimer = 0;
  let manifestRequest = 0;
  let mediaSessionBound = false;
  let crossfadeTimer = 0;
  let crossfadeInFlight = false;
  let crossfadeSourceId = "";
  let ownerScope = "guest";
  let storageKey = `${STORAGE_PREFIX}:guest`;
  const trackErrors = new Set();
  const fallbackTracks = new Set();

  const state = {
    tracks: [],
    rejected: [],
    rightsRegistryOnline: false,
    emergencyBlockCount: 0,
    manifest: null,
    loading: false,
    error: "",
    view: "discover",
    query: "",
    license: "all",
    genre: "all",
    mood: "all",
    creatorMode: false,
    currentTrackId: "",
    queue: [],
    queueIndex: -1,
    favorites: new Set(),
    history: [],
    progress: {},
    shuffle: false,
    repeat: "off",
    crossfadeSeconds: 5,
    volume: 0.82,
    muted: false,
    queueOpen: false,
    rightsOpen: false
  };

  function resetRuntimeState() {
    state.tracks = [];
    state.rejected = [];
    state.rightsRegistryOnline = false;
    state.emergencyBlockCount = 0;
    state.manifest = null;
    state.loading = false;
    state.error = "";
    state.view = "discover";
    state.query = "";
    state.license = "all";
    state.genre = "all";
    state.mood = "all";
    state.creatorMode = false;
    state.currentTrackId = "";
    state.queue = [];
    state.queueIndex = -1;
    state.favorites = new Set();
    state.history = [];
    state.progress = {};
    state.shuffle = false;
    state.repeat = "off";
    state.crossfadeSeconds = 5;
    state.volume = 0.82;
    state.muted = false;
    state.queueOpen = false;
    state.rightsOpen = false;
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();
  const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
  };
  const formatRelativeTime = (timestamp) => {
    const elapsed = Math.max(0, Date.now() - Number(timestamp || 0));
    if (elapsed < 60000) return "vừa nghe";
    if (elapsed < 3600000) return `${Math.max(1, Math.floor(elapsed / 60000))} phút trước`;
    if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)} giờ trước`;
    return `${Math.floor(elapsed / 86400000)} ngày trước`;
  };
  const licenseLabel = (code) => ({
    "CC0-1.0": "CC0 1.0",
    "PDM-1.0": "Public Domain",
    "CC-BY-3.0": "CC BY 3.0",
    "CC-BY-4.0": "CC BY 4.0",
    "CC-BY-SA-3.0": "CC BY-SA 3.0",
    "CC-BY-SA-4.0": "CC BY-SA 4.0"
  }[code] || code || "Chưa rõ");
  const repeatLabel = (mode) => mode === "one" ? "Lặp 1" : mode === "all" ? "Lặp tất cả" : "Tắt lặp";

  function encodeOwnerIdentity(value) {
    let encoded = "";
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      encoded += text.charCodeAt(index).toString(16).padStart(4, "0");
    }
    return encoded;
  }

  function resolveOwnerScope(options = {}) {
    let user = options.currentUser && typeof options.currentUser === "object" ? options.currentUser : null;
    if (!user) {
      try { user = global.HHAuthz?.currentUser?.() || null; } catch {}
    }
    if (!user) {
      try { user = JSON.parse(global.localStorage?.getItem("hh-auth-user") || "null"); } catch {}
    }
    const candidates = [
      ["owner", user?.ownerId],
      ["id", user?.id],
      ["sub", user?.sub],
      ["email", user?.email]
    ];
    const selected = candidates.find(([, value]) => String(value ?? "").trim());
    if (!selected) return "guest";
    const [field, value] = selected;
    return `${field}-${encodeOwnerIdentity(String(value))}`;
  }

  function readPersistedState() {
    try {
      const value = JSON.parse(global.localStorage?.getItem(storageKey) || "{}");
      state.view = ["discover", "favorites", "history"].includes(value.view) ? value.view : "discover";
      state.currentTrackId = String(value.currentTrackId || "");
      state.mood = String(value.mood || "all");
      state.queue = Array.isArray(value.queue) ? value.queue.map(String).slice(0, 200) : [];
      state.favorites = new Set(Array.isArray(value.favorites) ? value.favorites.map(String) : []);
      state.history = Array.isArray(value.history) ? value.history.filter((row) => row && row.id).slice(0, MAX_HISTORY) : [];
      state.progress = value.progress && typeof value.progress === "object" ? value.progress : {};
      state.shuffle = Boolean(value.shuffle);
      state.repeat = REPEAT_MODES.includes(value.repeat) ? value.repeat : "off";
      state.crossfadeSeconds = CROSSFADE_VALUES.includes(Number(value.crossfadeSeconds)) ? Number(value.crossfadeSeconds) : 5;
      state.creatorMode = Boolean(value.creatorMode);
      state.volume = clamp(value.volume ?? 0.82, 0, 1);
      state.muted = Boolean(value.muted);
    } catch {
      // A damaged local preference must never block the player.
    }
  }

  function persist() {
    try {
      const payload = {
        schema: 1,
        view: state.view,
        currentTrackId: state.currentTrackId,
        mood: state.mood,
        queue: state.queue.slice(0, 200),
        favorites: [...state.favorites],
        history: state.history.slice(0, MAX_HISTORY),
        progress: state.progress,
        shuffle: state.shuffle,
        repeat: state.repeat,
        crossfadeSeconds: state.crossfadeSeconds,
        creatorMode: state.creatorMode,
        volume: state.volume,
        muted: state.muted,
        updatedAt: Date.now()
      };
      global.localStorage?.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Private mode and storage quotas are non-fatal.
    }
  }

  function isStrictHttpsUrl(value) {
    try {
      const parsed = new global.URL(String(value || ""));
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }

  function isValidPastOrPresentDate(value) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return text <= today;
  }

  function fallbackRightsValidation(item) {
    const rights = item?.rights || {};
    const code = String(rights.licenseCode || "");
    const layers = rights.layers && typeof rights.layers === "object" ? rights.layers : {};
    const evidence = rights.evidence && typeof rights.evidence === "object" ? rights.evidence : {};
    const layerReady = REQUIRED_MUSIC_LAYERS.every((key) => {
      const layer = layers[key];
      return layer && (layer.status === "cleared" || (layer.status === "not-applicable" && String(layer.reason || "").trim()));
    });
    const metadataHashReady = /^sha256:[a-f0-9]{64}$/i.test(String(evidence.metadataChecksum || ""));
    const mediaEvidenceReady = evidence.mediaChecksumStatus === "verified"
      ? /^(?:sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/i.test(String(evidence.mediaChecksum || ""))
      : evidence.mediaChecksumStatus === "unavailable" && evidence.mediaChecksum == null && rights.rehostAllowed === false && rights.downloadAllowed === false;
    return Boolean(
      String(item?.id || "").trim() &&
      String(item?.title || "").trim() &&
      String(item?.creator || "").trim() &&
      String(item?.source?.itemId || "").trim() &&
      item?.kind === "track" &&
      item?.playback?.type === "audio" &&
      ALLOWED_LICENSES.has(code) &&
      String(rights.licenseUrl || "") === ALLOWED_LICENSE_URLS[code] &&
      String(rights.attributionText || "").trim() &&
      isValidPastOrPresentDate(rights.verifiedAt) &&
      rights.commercialAllowed === true &&
      rights.derivativesAllowed === true &&
      typeof rights.shareAlike === "boolean" &&
      rights.reviewStatus === "published" &&
      rights.rightsBasis === "cc-license" &&
      rights.streamAllowed === true &&
      typeof rights.syncAllowed === "boolean" &&
      Array.isArray(rights.territories) && rights.territories.includes("WORLDWIDE") &&
      layerReady && metadataHashReady && mediaEvidenceReady && String(evidence.sourceAuthority || "").trim() &&
      isStrictHttpsUrl(rights.licenseUrl) &&
      isStrictHttpsUrl(item?.source?.landingUrl) &&
      isStrictHttpsUrl(item?.playback?.url)
    );
  }

  function validateRights(item) {
    const rightsApi = global.HHOpenMediaRights;
    if (!rightsApi?.validateGovernanceItem) return fallbackRightsValidation(item);
    try {
      const result = rightsApi.validateGovernanceItem(item, { territory: "WORLDWIDE" });
      if (typeof result === "boolean") return result;
      if (result && typeof result === "object") {
        if ("publiclyAvailable" in result) return result.publiclyAvailable === true;
        if ("publishable" in result) return result.publishable === true && item?.rights?.reviewStatus === "published";
        if ("valid" in result) return result.valid === true;
        if ("ok" in result) return result.ok === true;
        if ("allowed" in result) return result.allowed === true;
      }
      return Boolean(result);
    } catch {
      return false;
    }
  }

  function normalizeCssColor(value) {
    const text = String(value || "").trim();
    if (!text || text.length > 64) return null;
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return text.toLowerCase();

    const rgb = text.match(/^(rgb|rgba)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i);
    if (rgb) {
      const channels = rgb.slice(2, 5).map(Number);
      const alpha = rgb[5] == null ? null : Number(rgb[5]);
      const expectsAlpha = rgb[1].toLowerCase() === "rgba";
      if (expectsAlpha === (alpha != null) && channels.every((channel) => channel >= 0 && channel <= 255) && (alpha == null || (alpha >= 0 && alpha <= 1))) {
        return alpha == null
          ? `rgb(${channels.join(", ")})`
          : `rgba(${channels.join(", ")}, ${alpha})`;
      }
    }

    const hsl = text.match(/^(hsl|hsla)\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i);
    if (hsl) {
      const hue = Number(hsl[2]);
      const saturation = Number(hsl[3]);
      const lightness = Number(hsl[4]);
      const alpha = hsl[5] == null ? null : Number(hsl[5]);
      const expectsAlpha = hsl[1].toLowerCase() === "hsla";
      if (expectsAlpha === (alpha != null) && Number.isFinite(hue) && saturation >= 0 && saturation <= 100 && lightness >= 0 && lightness <= 100 && (alpha == null || (alpha >= 0 && alpha <= 1))) {
        const normalizedHue = ((hue % 360) + 360) % 360;
        return alpha == null
          ? `hsl(${normalizedHue}, ${saturation}%, ${lightness}%)`
          : `hsla(${normalizedHue}, ${saturation}%, ${lightness}%, ${alpha})`;
      }
    }
    return null;
  }

  function sanitizePalette(value) {
    const supplied = Array.isArray(value) ? value.slice(0, 3).map(normalizeCssColor) : [];
    return DEFAULT_PALETTE.map((fallback, index) => supplied[index] || fallback);
  }

  function normalizeTrack(item) {
    if (!validateRights(item)) return null;
    const colors = sanitizePalette(item.colors);
    return {
      id: String(item.id),
      kind: "track",
      title: String(item.title || "Bản nhạc chưa đặt tên"),
      creator: String(item.creator || "Nghệ sĩ chưa rõ"),
      album: String(item.album || "Open Music"),
      genres: Array.isArray(item.genres) ? item.genres.map(String).filter(Boolean) : [],
      moods: Array.isArray(item.moods) ? item.moods.map(String).filter(Boolean) : [],
      durationSeconds: Math.max(0, Number(item.durationSeconds) || 0),
      featured: Boolean(item.featured),
      colors,
      source: {
        provider: String(item.source.provider || "Nguồn mở"),
        landingUrl: String(item.source.landingUrl),
        itemId: String(item.source.itemId || "")
      },
      rights: {
        licenseCode: String(item.rights.licenseCode),
        licenseUrl: String(item.rights.licenseUrl),
        attributionText: String(item.rights.attributionText || `${item.title} — ${item.creator}`),
        verifiedAt: String(item.rights.verifiedAt || ""),
        reviewStatus: String(item.rights.reviewStatus || ""),
        rightsBasis: String(item.rights.rightsBasis || ""),
        jurisdiction: String(item.rights.jurisdiction || ""),
        territories: Array.isArray(item.rights.territories) ? item.rights.territories.map(String) : [],
        commercialAllowed: item.rights.commercialAllowed === true,
        derivativesAllowed: item.rights.derivativesAllowed === true,
        streamAllowed: item.rights.streamAllowed === true,
        rehostAllowed: item.rights.rehostAllowed === true,
        downloadAllowed: item.rights.downloadAllowed === true,
        syncAllowed: item.rights.syncAllowed === true,
        shareAlike: item.rights.shareAlike === true,
        layers: Object.fromEntries(REQUIRED_MUSIC_LAYERS.map((key) => [key, { ...(item.rights.layers?.[key] || {}) }])),
        evidence: { ...(item.rights.evidence || {}) },
        flags: { ...(item.rights.flags || {}) }
      },
      playback: {
        type: "audio",
        url: String(item.playback.url),
        fallbackUrl: isStrictHttpsUrl(item.playback.fallbackUrl) ? String(item.playback.fallbackUrl) : String(item.playback.url)
      }
    };
  }

  function isCreatorReady(track) {
    const rights = track?.rights || {};
    return rights.reviewStatus === "published" &&
      rights.commercialAllowed === true &&
      rights.derivativesAllowed === true &&
      rights.syncAllowed === true &&
      REQUIRED_MUSIC_LAYERS.every((key) => ["cleared", "not-applicable"].includes(rights.layers?.[key]?.status));
  }

  function trackById(id) {
    return state.tracks.find((track) => track.id === id) || null;
  }

  function currentTrack() {
    return trackById(state.currentTrackId) || state.tracks[0] || null;
  }

  function genres() {
    return [...new Set(state.tracks.flatMap((track) => track.genres))].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function moods() {
    return [...new Set(state.tracks.flatMap((track) => track.moods))].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function filteredTracks() {
    const query = normalizeText(state.query);
    let rows = state.tracks.slice();
    if (state.view === "favorites") rows = rows.filter((track) => state.favorites.has(track.id));
    if (state.view === "history") {
      const order = new Map(state.history.map((entry, index) => [entry.id, index]));
      rows = rows.filter((track) => order.has(track.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
    }
    if (query) {
      rows = rows.filter((track) => normalizeText([track.title, track.creator, track.album, ...track.genres, ...track.moods].join(" ")).includes(query));
    }
    if (state.license !== "all") {
      rows = rows.filter((track) => state.license === "CC-BY" ? /^CC-BY-\d/.test(track.rights.licenseCode) : track.rights.licenseCode === state.license);
    }
    if (state.genre !== "all") rows = rows.filter((track) => track.genres.includes(state.genre));
    if (state.mood !== "all") rows = rows.filter((track) => track.moods.includes(state.mood));
    if (state.creatorMode) rows = rows.filter(isCreatorReady);
    if (state.view !== "history") {
      rows.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, "vi"));
    }
    return rows;
  }

  function paletteStyle(track) {
    const colors = sanitizePalette(track?.colors);
    return `--omh-c1:${colors[0]};--omh-c2:${colors[1]};--omh-c3:${colors[2]}`;
  }

  function visualMarkup(track, compact = false) {
    return `<span class="omh-cover${compact ? " is-compact" : ""}" style="${paletteStyle(track)}" aria-hidden="true"><i></i><b>♫</b><em></em></span>`;
  }

  function status(message, tone = "info") {
    const node = root?.querySelector("[data-omh-status]");
    if (!node) return;
    global.clearTimeout(statusTimer);
    node.textContent = String(message || "");
    node.dataset.tone = tone;
    node.classList.toggle("is-visible", Boolean(message));
    if (message) statusTimer = global.setTimeout(() => node.classList.remove("is-visible"), tone === "error" ? 7000 : 3200);
  }

  function renderSidebar() {
    const node = root?.querySelector("[data-omh-sidebar]");
    if (!node) return;
    const favoriteCount = state.tracks.filter((track) => state.favorites.has(track.id)).length;
    const historyCount = state.tracks.filter((track) => state.history.some((entry) => entry.id === track.id)).length;
    node.innerHTML = `
      <section class="omh-nav-group" aria-label="Thư viện nhạc">
        <small>THƯ VIỆN</small>
        <button type="button" data-view="discover" class="${state.view === "discover" ? "is-active" : ""}"><span>✦</span><b>Khám phá</b><em>${state.tracks.length}</em></button>
        <button type="button" data-view="favorites" class="${state.view === "favorites" ? "is-active" : ""}"><span>♥</span><b>Yêu thích</b><em>${favoriteCount}</em></button>
        <button type="button" data-view="history" class="${state.view === "history" ? "is-active" : ""}"><span>◷</span><b>Đã nghe</b><em>${historyCount}</em></button>
      </section>
      <section class="omh-nav-group omh-license-guide">
        <small>GIẤY PHÉP ĐƯỢC DUYỆT</small>
        <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer"><i class="cc0"></i><span><b>CC0 / Public Domain</b><em>Tự do sử dụng</em></span></a>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"><i class="by"></i><span><b>CC BY</b><em>Cần ghi công</em></span></a>
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer"><i class="sa"></i><span><b>CC BY-SA</b><em>Ghi công + chia sẻ tương tự</em></span></a>
      </section>
      <footer><span>✓</span><p><b>Rights Guard đang bật</b><small>NC, ND và giấy phép chưa rõ bị loại tự động.</small></p></footer>`;
  }

  function emptyMarkup() {
    const title = state.view === "favorites" ? "Chưa có bản nhạc yêu thích" : state.view === "history" ? "Bạn chưa nghe bản nhạc nào" : "Không tìm thấy bản nhạc phù hợp";
    return `<div class="omh-empty"><span>♫</span><h3>${title}</h3><p>Đổi từ khóa hoặc bộ lọc để xem lại toàn bộ kho nhạc mở.</p><button type="button" data-action="clear-filters">Xóa bộ lọc</button></div>`;
  }

  function cardMarkup(track) {
    const progress = clamp(state.progress[track.id]?.position || 0, 0, track.durationSeconds || Infinity);
    const progressPercent = track.durationSeconds ? clamp((progress / track.durationSeconds) * 100, 0, 100) : 0;
    const active = track.id === state.currentTrackId;
    const failed = trackErrors.has(track.id);
    return `<article class="omh-track-card${active ? " is-current" : ""}${failed ? " is-error" : ""}" data-track-card="${escapeHtml(track.id)}">
      <button type="button" class="omh-card-play" data-play="${escapeHtml(track.id)}" aria-label="Phát ${escapeHtml(track.title)}">
        ${visualMarkup(track)}
        <span class="omh-card-play-icon">${active && audio && !audio.paused ? "❚❚" : "▶"}</span>
        ${progressPercent > 0 ? `<i class="omh-card-progress" style="--progress:${progressPercent}%"></i>` : ""}
      </button>
      <div class="omh-card-copy">
        <div class="omh-card-heading"><span class="omh-license-badge" data-license="${escapeHtml(track.rights.licenseCode)}">${escapeHtml(licenseLabel(track.rights.licenseCode))}</span><time>${formatTime(track.durationSeconds)}</time></div>
        <h3 title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</h3>
        <p title="${escapeHtml(track.creator)}">${escapeHtml(track.creator)}</p>
        <div class="omh-card-tags">${track.genres.slice(0, 2).map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}</div>
        <footer>
          <a href="${escapeHtml(track.source.landingUrl)}" target="_blank" rel="noopener noreferrer" title="Mở nguồn gốc">Nguồn</a>
          <a href="${escapeHtml(track.rights.licenseUrl)}" target="_blank" rel="noopener noreferrer" title="Xem giấy phép">Giấy phép</a>
          <button type="button" data-action="favorite" data-id="${escapeHtml(track.id)}" class="${state.favorites.has(track.id) ? "is-active" : ""}" aria-label="${state.favorites.has(track.id) ? "Bỏ yêu thích" : "Thêm yêu thích"}">♥</button>
          <button type="button" data-action="queue-add" data-id="${escapeHtml(track.id)}" aria-label="Thêm vào hàng đợi">＋</button>
        </footer>
      </div>
    </article>`;
  }

  function renderHero(rows) {
    const node = root?.querySelector("[data-omh-hero]");
    if (!node) return;
    const show = state.view === "discover" && !state.query && state.license === "all" && state.genre === "all" && state.mood === "all" && !state.creatorMode && rows.length;
    if (!show) {
      node.hidden = true;
      node.innerHTML = "";
      return;
    }
    const featured = rows.find((track) => track.featured && track.id !== state.currentTrackId) || rows[0];
    node.hidden = false;
    node.style.cssText = paletteStyle(featured);
    node.innerHTML = `<div class="omh-hero-art">${visualMarkup(featured)}</div><div class="omh-hero-copy"><span>OPEN MUSIC PICK</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.creator)} · ${escapeHtml(featured.genres.join(" / "))}</p><div><button type="button" data-play="${escapeHtml(featured.id)}">▶ Nghe ngay</button><button type="button" data-action="queue-add" data-id="${escapeHtml(featured.id)}">＋ Hàng đợi</button></div><small><b>${escapeHtml(licenseLabel(featured.rights.licenseCode))}</b> · ${escapeHtml(featured.rights.attributionText)}</small></div>`;
  }

  function renderLibrary() {
    const grid = root?.querySelector("[data-omh-grid]");
    const count = root?.querySelector("[data-omh-result-count]");
    const heading = root?.querySelector("[data-omh-library-title]");
    if (!grid || !count || !heading) return;
    if (state.loading) {
      heading.textContent = "Đang tải kho nhạc mở";
      count.textContent = "Đang xác minh giấy phép…";
      grid.innerHTML = `<div class="omh-loading"><i></i><strong>Đang nạp âm thanh được cấp phép</strong><span>Rights Guard sẽ loại mọi nội dung NC, ND hoặc chưa rõ giấy phép.</span></div>`;
      renderHero([]);
      return;
    }
    if (state.error) {
      heading.textContent = "Kho nhạc tạm thời chưa sẵn sàng";
      count.textContent = "Không thể nạp manifest";
      grid.innerHTML = `<div class="omh-empty is-error"><span>!</span><h3>Không tải được danh mục nhạc</h3><p>${escapeHtml(state.error)}</p><button type="button" data-action="retry-manifest">Thử tải lại</button><a href="https://commons.wikimedia.org/wiki/Category:Open_music" target="_blank" rel="noopener noreferrer">Mở Wikimedia Commons</a></div>`;
      renderHero([]);
      return;
    }
    const rows = filteredTracks();
    heading.textContent = state.view === "favorites" ? "Nhạc bạn yêu thích" : state.view === "history" ? "Nghe gần đây" : "Kho nhạc được kiểm duyệt";
    count.textContent = `${rows.length} / ${state.tracks.length} bản · ${state.rejected.length ? `${state.rejected.length} mục bị Rights Guard loại` : "100% có nguồn"}`;
    grid.innerHTML = rows.length ? rows.map(cardMarkup).join("") : emptyMarkup();
    renderHero(rows);
  }

  function renderFilters() {
    const genreSelect = root?.querySelector("[data-omh-genre]");
    if (!genreSelect) return;
    const options = [`<option value="all">Tất cả thể loại</option>`, ...genres().map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`)].join("");
    if (genreSelect.innerHTML !== options) genreSelect.innerHTML = options;
    genreSelect.value = genres().includes(state.genre) ? state.genre : "all";
    const licenseSelect = root.querySelector("[data-omh-license]");
    if (licenseSelect) licenseSelect.value = state.license;
    const search = root.querySelector("[data-omh-search]");
    if (search && search.value !== state.query) search.value = state.query;
    const moodSelect = root.querySelector("[data-omh-mood]");
    if (moodSelect) {
      const moodOptions = [`<option value="all">Tất cả cảm xúc</option>`, ...moods().map((mood) => `<option value="${escapeHtml(mood)}">${escapeHtml(mood)}</option>`)].join("");
      if (moodSelect.innerHTML !== moodOptions) moodSelect.innerHTML = moodOptions;
      moodSelect.value = moods().includes(state.mood) ? state.mood : "all";
    }
    const creatorMode = root.querySelector('[data-action="creator-mode"]');
    if (creatorMode) {
      creatorMode.classList.toggle("is-active", state.creatorMode);
      creatorMode.setAttribute("aria-pressed", String(state.creatorMode));
    }
    const crossfade = root.querySelector("[data-omh-crossfade]");
    if (crossfade) crossfade.value = String(state.crossfadeSeconds);
  }

  function renderQueue() {
    const node = root?.querySelector("[data-omh-queue]");
    const count = root?.querySelector("[data-omh-queue-count]");
    if (!node) return;
    const rows = state.queue.map(trackById).filter(Boolean);
    if (count) count.textContent = String(rows.length);
    node.innerHTML = rows.length ? rows.map((track, index) => `<div class="omh-queue-item${index === state.queueIndex ? " is-active" : ""}">
      <button type="button" data-play="${escapeHtml(track.id)}" data-queue-index="${index}">${visualMarkup(track, true)}<span><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.creator)}</small></span><time>${formatTime(track.durationSeconds)}</time></button>
      <span class="omh-queue-actions"><button type="button" data-action="queue-up" data-index="${index}" aria-label="Đưa lên trước" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="queue-down" data-index="${index}" aria-label="Đưa xuống sau" ${index === rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-action="queue-remove" data-index="${index}" aria-label="Xóa khỏi hàng đợi">×</button></span>
    </div>`).join("") : `<p class="omh-queue-empty">Hàng đợi đang trống. Bấm <b>＋</b> trên một bản nhạc để thêm.</p>`;
  }

  const layerLabel = (key) => ({
    composition: "Tác phẩm",
    performance: "Biểu diễn",
    masterRecording: "Bản ghi master",
    artwork: "Ảnh bìa"
  }[key] || key);

  function rightsPanelMarkup(track) {
    const rights = track.rights;
    const evidence = rights.evidence || {};
    const creatorReady = isCreatorReady(track);
    const layerRows = REQUIRED_MUSIC_LAYERS.map((key) => {
      const layer = rights.layers?.[key] || {};
      const ready = ["cleared", "not-applicable"].includes(layer.status);
      return `<li class="${ready ? "is-cleared" : "is-blocked"}"><span>${ready ? "✓" : "!"}</span><b>${escapeHtml(layerLabel(key))}</b><em>${escapeHtml(layer.status === "not-applicable" ? "Không áp dụng" : layer.status === "cleared" ? "Đã xác minh" : "Chưa đủ bằng chứng")}</em></li>`;
    }).join("");
    const checksumLabel = evidence.mediaChecksumStatus === "verified"
      ? `${escapeHtml(evidence.mediaChecksumAlgorithm || "hash")} · ${escapeHtml(evidence.checksumScope || "media")}`
      : "Nguồn không công bố checksum; không lưu lại hoặc cho tải file";
    return `<section class="omh-rights-card${state.rightsOpen ? " is-open" : ""}">
      <header><span>✓</span><div><b>${escapeHtml(licenseLabel(rights.licenseCode))}</b><small>Đã kiểm tra ${escapeHtml(rights.verifiedAt)} · ${escapeHtml(rights.reviewStatus)}</small></div></header>
      <p>${escapeHtml(rights.attributionText)}</p>
      <div class="omh-rights-summary"><span>${creatorReady ? "Creator Mode: đủ điều kiện" : "Chỉ nghe trực tuyến"}</span><span>${escapeHtml((rights.territories || []).join(", ") || "Chưa rõ lãnh thổ")}</span></div>
      <div class="omh-rights-actions"><button type="button" data-action="rights-toggle" aria-expanded="${state.rightsOpen}">${state.rightsOpen ? "Thu gọn hồ sơ" : "Quyền & TASL"}</button><button type="button" data-action="license-pack">Xuất License Pack</button></div>
      <div class="omh-rights-details" ${state.rightsOpen ? "" : "hidden"}>
        <dl class="omh-tasl"><div><dt>T · Title</dt><dd>${escapeHtml(track.title)}</dd></div><div><dt>A · Author</dt><dd>${escapeHtml(track.creator)}</dd></div><div><dt>S · Source</dt><dd>${escapeHtml(track.source.provider)}</dd></div><div><dt>L · License</dt><dd>${escapeHtml(licenseLabel(rights.licenseCode))}</dd></div></dl>
        <ul class="omh-rights-layers">${layerRows}</ul>
        <p class="omh-evidence-note"><b>Bằng chứng:</b> ${checksumLabel}. Content ID vẫn có thể nhận nhầm; gói xuất không thay thế tư vấn pháp lý.</p>
      </div>
      <nav><a href="${escapeHtml(rights.licenseUrl)}" target="_blank" rel="noopener noreferrer">Giấy phép ↗</a><a href="${escapeHtml(track.source.landingUrl)}" target="_blank" rel="noopener noreferrer">Nguồn gốc ↗</a><a href="#/copyright">Bản quyền & khiếu nại</a></nav>
    </section>`;
  }

  function safeFilename(value, fallback = "open-music") {
    const cleaned = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "")
      .slice(0, 80);
    return cleaned || fallback;
  }

  function createLicensePack(track) {
    const rights = track.rights;
    const evidence = rights.evidence || {};
    const credits = [
      "HH OPEN MUSIC — LICENSE PACK",
      "",
      `Title: ${track.title}`,
      `Author: ${track.creator}`,
      `Source: ${track.source.landingUrl}`,
      `License: ${rights.licenseCode} — ${rights.licenseUrl}`,
      `Attribution: ${rights.attributionText}`,
      `Territories: ${(rights.territories || []).join(", ") || "not recorded"}`,
      `Verified: ${rights.verifiedAt}`,
      rights.shareAlike ? "ShareAlike: Có — bản phái sinh phải tuân thủ điều kiện chia sẻ tương tự của giấy phép." : "ShareAlike: Không.",
      "",
      "Lưu ý: Gói này ghi lại bằng chứng đang có tại thời điểm xuất. Nó không bảo đảm nền tảng Content ID sẽ không nhận nhầm và không thay thế tư vấn pháp lý."
    ].join("\r\n");
    const json = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: `HH Open Music ${VERSION}`,
      item: {
        id: track.id,
        title: track.title,
        creator: track.creator,
        source: { ...track.source },
        license: { code: rights.licenseCode, url: rights.licenseUrl, attributionText: rights.attributionText },
        permissions: {
          commercial: rights.commercialAllowed,
          derivatives: rights.derivativesAllowed,
          stream: rights.streamAllowed,
          rehost: rights.rehostAllowed,
          download: rights.downloadAllowed,
          sync: rights.syncAllowed,
          shareAlike: rights.shareAlike
        },
        governance: {
          reviewStatus: rights.reviewStatus,
          rightsBasis: rights.rightsBasis,
          jurisdiction: rights.jurisdiction,
          territories: [...rights.territories],
          layers: Object.fromEntries(REQUIRED_MUSIC_LAYERS.map((key) => [key, { ...rights.layers[key] }]))
        },
        evidence: { ...evidence },
        contentIdEvidence: {
          sourceUrl: track.source.landingUrl,
          licenseUrl: rights.licenseUrl,
          verifiedAt: rights.verifiedAt,
          metadataChecksum: evidence.metadataChecksum || null,
          mediaChecksum: evidence.mediaChecksum || null,
          mediaChecksumStatus: evidence.mediaChecksumStatus || "unavailable",
          checksumScope: evidence.checksumScope || "remote-playback",
          notice: "Human review required before submitting a Content ID dispute."
        }
      },
      credits,
      copyrightContact: `${global.location?.origin || ""}/#/copyright`
    };
    return { json, credits };
  }

  function downloadBlob(blob, filename) {
    if (!global.document || !global.URL?.createObjectURL) return false;
    const href = global.URL.createObjectURL(blob);
    const link = global.document.createElement("a");
    link.href = href;
    link.download = filename;
    link.hidden = true;
    global.document.body.append(link);
    link.click();
    link.remove();
    global.setTimeout(() => global.URL.revokeObjectURL(href), 1000);
    return true;
  }

  async function exportLicensePack(track) {
    if (!track) return;
    const pack = createLicensePack(track);
    const base = `${safeFilename(track.title)}-license-pack`;
    try {
      if (typeof global.JSZip === "function") {
        const zip = new global.JSZip();
        zip.file("LICENSES.json", JSON.stringify(pack.json, null, 2));
        zip.file("CREDITS.txt", pack.credits);
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        downloadBlob(blob, `${base}.zip`);
        status("Đã xuất ZIP gồm LICENSES.json và CREDITS.txt.", "success");
        return;
      }
      downloadBlob(new Blob([JSON.stringify(pack.json, null, 2)], { type: "application/json;charset=utf-8" }), `${base}.json`);
      global.setTimeout(() => downloadBlob(new Blob([pack.credits], { type: "text/plain;charset=utf-8" }), `${base}-CREDITS.txt`), 180);
      status("Đã xuất LICENSES.json và CREDITS.txt.", "success");
    } catch {
      status("Không thể tạo License Pack trên trình duyệt này.", "error");
    }
  }

  function renderNowPlaying() {
    const node = root?.querySelector("[data-omh-now]");
    if (!node) return;
    const track = currentTrack();
    if (!track) {
      node.innerHTML = `<div class="omh-now-empty"><span>♫</span><h3>Chọn một bản nhạc</h3><p>Player sẽ hiển thị đầy đủ nguồn và giấy phép tại đây.</p></div>`;
      renderQueue();
      return;
    }
    const errored = trackErrors.has(track.id);
    node.innerHTML = `<div class="omh-now-cover" style="${paletteStyle(track)}">${visualMarkup(track)}<i></i></div>
      <section class="omh-now-copy">
        <span>ĐANG CHỌN</span><h2>${escapeHtml(track.title)}</h2><p>${escapeHtml(track.creator)}</p>
        <div class="omh-now-tags">${[...track.moods, ...track.genres].slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </section>
      ${rightsPanelMarkup(track)}
      ${errored ? `<section class="omh-playback-error"><b>Không thể phát luồng âm thanh này.</b><p>Bạn có thể thử file gốc hoặc mở trang nguồn.</p><div><button type="button" data-action="retry-track">Thử file gốc</button><a href="${escapeHtml(track.source.landingUrl)}" target="_blank" rel="noopener noreferrer">Mở nguồn</a></div></section>` : ""}`;
    renderQueue();
  }

  function renderPlaybackClock() {
    if (!root || !audio) return;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : currentTrack()?.durationSeconds || 0;
    const seek = root.querySelector("[data-omh-seek]");
    if (seek) {
      seek.max = String(Math.max(1, duration));
      seek.value = String(clamp(current, 0, Math.max(1, duration)));
      seek.style.setProperty("--seek", `${duration ? clamp((current / duration) * 100, 0, 100) : 0}%`);
      seek.setAttribute("aria-valuetext", `${formatTime(current)} trên ${formatTime(duration)}`);
    }
    const currentNode = root.querySelector("[data-omh-current-time]");
    const durationNode = root.querySelector("[data-omh-duration]");
    if (currentNode) currentNode.textContent = formatTime(current);
    if (durationNode) durationNode.textContent = formatTime(duration);
  }

  function renderPlayer() {
    if (!root) return;
    const track = currentTrack();
    const info = root.querySelector("[data-omh-player-track]");
    const play = root.querySelector('[data-action="toggle-play"]');
    const favorite = root.querySelector('[data-action="current-favorite"]');
    const shuffle = root.querySelector('[data-action="shuffle"]');
    const repeat = root.querySelector('[data-action="repeat"]');
    const mute = root.querySelector('[data-action="mute"]');
    const volume = root.querySelector("[data-omh-volume]");
    if (info) info.innerHTML = track ? `${visualMarkup(track, true)}<span><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.creator)} · ${escapeHtml(licenseLabel(track.rights.licenseCode))}</small></span>` : `<span><b>Chưa chọn nhạc</b><small>Chọn một bản trong thư viện</small></span>`;
    if (play) {
      play.textContent = audio && !audio.paused ? "❚❚" : "▶";
      play.setAttribute("aria-label", audio && !audio.paused ? "Tạm dừng" : "Phát");
    }
    if (favorite) {
      favorite.classList.toggle("is-active", Boolean(track && state.favorites.has(track.id)));
      favorite.disabled = !track;
    }
    if (shuffle) {
      shuffle.classList.toggle("is-active", state.shuffle);
      shuffle.setAttribute("aria-pressed", String(state.shuffle));
    }
    if (repeat) {
      repeat.classList.toggle("is-active", state.repeat !== "off");
      repeat.dataset.mode = state.repeat;
      repeat.textContent = state.repeat === "one" ? "↻¹" : "↻";
      repeat.setAttribute("aria-label", repeatLabel(state.repeat));
      repeat.title = repeatLabel(state.repeat);
    }
    if (mute) {
      mute.textContent = state.muted || state.volume === 0 ? "🔇" : state.volume < 0.5 ? "🔉" : "🔊";
      mute.setAttribute("aria-label", state.muted ? "Bật âm thanh" : "Tắt âm thanh");
    }
    if (volume) {
      volume.value = String(state.volume);
      volume.style.setProperty("--volume", `${state.volume * 100}%`);
    }
    root.classList.toggle("is-queue-open", state.queueOpen);
    renderPlaybackClock();
  }

  function renderAll() {
    renderFilters();
    renderSidebar();
    renderLibrary();
    renderNowPlaying();
    renderPlayer();
  }

  function updateHistory(trackId) {
    state.history = [{ id: trackId, at: Date.now() }, ...state.history.filter((entry) => entry.id !== trackId)].slice(0, MAX_HISTORY);
  }

  function ensureQueue(trackId, sourceRows = filteredTracks()) {
    const validQueue = state.queue.filter((id) => trackById(id));
    state.queue = validQueue;
    let index = state.queue.indexOf(trackId);
    if (index < 0) {
      const ids = sourceRows.map((track) => track.id);
      state.queue = ids.includes(trackId) ? ids : [...validQueue, trackId];
      index = state.queue.indexOf(trackId);
    }
    state.queueIndex = Math.max(0, index);
  }

  function savePlaybackProgress(force = false) {
    const track = currentTrack();
    if (!track || !audio || !Number.isFinite(audio.currentTime)) return;
    const now = Date.now();
    if (!force && now - lastProgressWrite < 5000) return;
    lastProgressWrite = now;
    const duration = Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds;
    state.progress[track.id] = { position: Math.max(0, audio.currentTime), duration: Math.max(0, duration || 0), updatedAt: now };
    persist();
  }

  function updateMediaSession(track) {
    const mediaSession = global.navigator?.mediaSession;
    if (!mediaSession || !track) return;
    try {
      if (typeof global.MediaMetadata === "function") {
        mediaSession.metadata = new global.MediaMetadata({ title: track.title, artist: track.creator, album: `${track.album} · ${licenseLabel(track.rights.licenseCode)}` });
      }
    } catch {
      // Some browsers expose Media Session partially.
    }
  }

  function updateMediaPosition() {
    const mediaSession = global.navigator?.mediaSession;
    if (!mediaSession?.setPositionState || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: clamp(audio.currentTime, 0, audio.duration) });
    } catch {}
  }

  function cancelCrossfade() {
    global.clearInterval(crossfadeTimer);
    crossfadeTimer = 0;
    crossfadeInFlight = false;
    if (audio) audio.volume = state.volume;
    if (standbyAudio) {
      standbyAudio.pause();
      standbyAudio.volume = state.volume;
    }
  }

  function autoNextQueueIndex() {
    if (!state.queue.length || state.repeat === "one") return -1;
    if (state.shuffle && state.queue.length > 1) {
      let index = state.queueIndex;
      while (index === state.queueIndex) index = Math.floor(Math.random() * state.queue.length);
      return index;
    }
    const index = state.queueIndex + 1;
    if (index < state.queue.length) return index;
    return state.repeat === "all" ? 0 : -1;
  }

  async function crossfadeTo(index, outgoing) {
    if (crossfadeInFlight || !standbyAudio || !outgoing || outgoing !== audio) return;
    const track = trackById(state.queue[index]);
    if (!track) return;
    crossfadeInFlight = true;
    crossfadeSourceId = state.currentTrackId;
    const incoming = standbyAudio;
    incoming.pause();
    incoming.src = track.playback.url;
    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.muted = state.muted;
    try {
      const promise = incoming.play();
      if (promise?.then) await promise;
    } catch {
      incoming.removeAttribute("src");
      incoming.load();
      incoming.volume = state.volume;
      crossfadeInFlight = false;
      return;
    }

    savePlaybackProgress(true);
    audio = incoming;
    standbyAudio = outgoing;
    state.queueIndex = index;
    state.currentTrackId = track.id;
    updateHistory(track.id);
    updateMediaSession(track);
    persist();
    renderAll();

    const durationMs = Math.max(400, state.crossfadeSeconds * 1000);
    const startedAt = Date.now();
    global.clearInterval(crossfadeTimer);
    crossfadeTimer = global.setInterval(() => {
      const progress = clamp((Date.now() - startedAt) / durationMs, 0, 1);
      incoming.volume = state.volume * progress;
      outgoing.volume = state.volume * (1 - progress);
      if (progress >= 1) {
        global.clearInterval(crossfadeTimer);
        crossfadeTimer = 0;
        outgoing.pause();
        outgoing.removeAttribute("src");
        try { outgoing.load(); } catch {}
        outgoing.volume = state.volume;
        incoming.volume = state.volume;
        crossfadeInFlight = false;
      }
    }, 50);
  }

  function maybeStartCrossfade(element) {
    if (!state.crossfadeSeconds || crossfadeInFlight || element !== audio || element.paused || !Number.isFinite(element.duration)) return;
    if (state.currentTrackId === crossfadeSourceId) return;
    const remaining = element.duration - element.currentTime;
    if (remaining <= 0 || remaining > state.crossfadeSeconds) return;
    const nextIndex = autoNextQueueIndex();
    if (nextIndex >= 0) crossfadeTo(nextIndex, element);
  }

  function loadTrack(trackId, autoplay = true, options = {}) {
    const track = trackById(trackId);
    if (!track || !audio) return;
    cancelCrossfade();
    crossfadeSourceId = "";
    savePlaybackProgress(true);
    ensureQueue(track.id, options.sourceRows || filteredTracks());
    state.currentTrackId = track.id;
    const savedPosition = clamp(state.progress[track.id]?.position || 0, 0, Math.max(0, track.durationSeconds - 4));
    pendingSeek = options.restart ? 0 : savedPosition;
    fallbackTracks.delete(track.id);
    trackErrors.delete(track.id);
    audio.src = track.playback.url;
    audio.load();
    updateMediaSession(track);
    if (autoplay) {
      updateHistory(track.id);
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch((error) => {
        status(error?.name === "NotAllowedError" ? "Trình duyệt cần bạn bấm Phát để bắt đầu âm thanh." : "Không thể bắt đầu phát bản nhạc này.", "error");
        renderPlayer();
      });
    }
    persist();
    renderAll();
  }

  function togglePlay() {
    if (!audio || !state.tracks.length) return;
    if (!currentTrack()) return loadTrack(state.tracks[0].id, true);
    if (!audio.src) return loadTrack(currentTrack().id, true);
    if (audio.paused) {
      updateHistory(currentTrack().id);
      audio.play().catch(() => status("Không thể phát. Hãy thử lại hoặc mở nguồn gốc.", "error"));
    } else {
      audio.pause();
    }
  }

  function nextTrack(fromEnded = false) {
    if (!state.queue.length) state.queue = filteredTracks().map((track) => track.id);
    if (!state.queue.length) return;
    if (fromEnded && state.repeat === "one") return loadTrack(state.currentTrackId, true, { restart: true });
    let index;
    if (state.shuffle && state.queue.length > 1) {
      do index = Math.floor(Math.random() * state.queue.length); while (index === state.queueIndex);
    } else {
      index = state.queueIndex + 1;
      if (index >= state.queue.length) {
        if (fromEnded && state.repeat === "off") {
          audio.pause();
          audio.currentTime = 0;
          renderPlayer();
          return;
        }
        index = 0;
      }
    }
    state.queueIndex = index;
    loadTrack(state.queue[index], true, { sourceRows: state.queue.map(trackById).filter(Boolean), restart: true });
  }

  function previousTrack() {
    if (!audio || !state.queue.length) return;
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      renderPlaybackClock();
      return;
    }
    const index = state.shuffle ? Math.floor(Math.random() * state.queue.length) : (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    state.queueIndex = index;
    loadTrack(state.queue[index], true, { sourceRows: state.queue.map(trackById).filter(Boolean), restart: true });
  }

  function toggleFavorite(trackId) {
    if (!trackById(trackId)) return;
    if (state.favorites.has(trackId)) {
      state.favorites.delete(trackId);
      status("Đã bỏ khỏi mục Yêu thích.");
    } else {
      state.favorites.add(trackId);
      status("Đã lưu vào mục Yêu thích.", "success");
    }
    persist();
    renderSidebar();
    renderLibrary();
    renderPlayer();
  }

  function addToQueue(trackId) {
    if (!trackById(trackId)) return;
    if (!state.queue.includes(trackId)) state.queue.push(trackId);
    if (state.queueIndex < 0) state.queueIndex = Math.max(0, state.queue.indexOf(state.currentTrackId));
    persist();
    renderQueue();
    status("Đã thêm vào hàng đợi.", "success");
  }

  function retryTrackWithFallback() {
    const track = currentTrack();
    if (!track || !audio) return;
    trackErrors.delete(track.id);
    fallbackTracks.add(track.id);
    audio.src = track.playback.fallbackUrl;
    audio.load();
    audio.play().catch(() => status("File gốc cũng không phát được. Hãy mở trang nguồn.", "error"));
    renderNowPlaying();
    status("Đang thử phát file gốc…");
  }

  function clearFilters() {
    state.query = "";
    state.license = "all";
    state.genre = "all";
    state.mood = "all";
    state.creatorMode = false;
    if (state.view !== "discover") state.view = "discover";
    renderAll();
    focusSearch();
  }

  function onClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      state.view = viewButton.dataset.view;
      persist();
      renderSidebar();
      renderLibrary();
      return;
    }
    const playButton = event.target.closest("[data-play]");
    if (playButton) {
      const id = playButton.dataset.play;
      const queueIndex = Number(playButton.dataset.queueIndex);
      if (id === state.currentTrackId && audio?.src) togglePlay();
      else {
        if (Number.isInteger(queueIndex) && queueIndex >= 0) state.queueIndex = queueIndex;
        loadTrack(id, true);
      }
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "toggle-play") togglePlay();
    else if (action === "next") nextTrack(false);
    else if (action === "previous") previousTrack();
    else if (action === "favorite") toggleFavorite(actionButton.dataset.id);
    else if (action === "current-favorite" && currentTrack()) toggleFavorite(currentTrack().id);
    else if (action === "queue-add") addToQueue(actionButton.dataset.id);
    else if (action === "queue-remove") {
      const index = Number(actionButton.dataset.index);
      if (index >= 0 && index < state.queue.length) {
        state.queue.splice(index, 1);
        if (index < state.queueIndex) state.queueIndex -= 1;
        else if (index === state.queueIndex) state.queueIndex = Math.min(state.queueIndex, state.queue.length - 1);
        persist();
        renderQueue();
      }
    } else if (action === "queue-up" || action === "queue-down") {
      const index = Number(actionButton.dataset.index);
      const targetIndex = action === "queue-up" ? index - 1 : index + 1;
      if (index >= 0 && targetIndex >= 0 && index < state.queue.length && targetIndex < state.queue.length) {
        [state.queue[index], state.queue[targetIndex]] = [state.queue[targetIndex], state.queue[index]];
        state.queueIndex = state.queue.indexOf(state.currentTrackId);
        persist();
        renderQueue();
      }
    } else if (action === "queue-clear") {
      state.queue = state.currentTrackId ? [state.currentTrackId] : [];
      state.queueIndex = state.queue.length ? 0 : -1;
      persist();
      renderQueue();
      status("Đã dọn hàng đợi.");
    } else if (action === "shuffle") {
      state.shuffle = !state.shuffle;
      persist();
      renderPlayer();
      status(state.shuffle ? "Đã bật phát ngẫu nhiên." : "Đã tắt phát ngẫu nhiên.");
    } else if (action === "repeat") {
      state.repeat = REPEAT_MODES[(REPEAT_MODES.indexOf(state.repeat) + 1) % REPEAT_MODES.length];
      persist();
      renderPlayer();
      status(repeatLabel(state.repeat));
    } else if (action === "mute") {
      state.muted = !state.muted;
      audio.muted = state.muted;
      if (standbyAudio) standbyAudio.muted = state.muted;
      persist();
      renderPlayer();
    } else if (action === "queue-toggle") {
      state.queueOpen = !state.queueOpen;
      renderPlayer();
    } else if (action === "queue-close") {
      state.queueOpen = false;
      renderPlayer();
    } else if (action === "creator-mode") {
      state.creatorMode = !state.creatorMode;
      persist();
      renderFilters();
      renderLibrary();
      status(state.creatorMode ? "Creator Mode chỉ hiện bản nhạc đủ quyền thương mại, phái sinh, đồng bộ và bốn lớp quyền." : "Đã tắt Creator Mode.", state.creatorMode ? "success" : "info");
    } else if (action === "rights-toggle") {
      state.rightsOpen = !state.rightsOpen;
      renderNowPlaying();
    } else if (action === "license-pack") {
      exportLicensePack(currentTrack());
    } else if (action === "clear-filters") clearFilters();
    else if (action === "retry-manifest") loadManifest();
    else if (action === "retry-track") retryTrackWithFallback();
    else if (action === "clear-history") {
      state.history = [];
      persist();
      renderSidebar();
      renderLibrary();
      status("Đã xóa lịch sử nghe.");
    } else if (action === "play-featured") {
      const rows = filteredTracks();
      if (rows.length) {
        state.queue = rows.map((track) => track.id);
        state.queueIndex = 0;
        loadTrack(rows[0].id, true, { sourceRows: rows, restart: true });
      }
    }
  }

  function onInput(event) {
    if (event.target.matches("[data-omh-search]")) {
      state.query = event.target.value.slice(0, 120);
      renderLibrary();
    } else if (event.target.matches("[data-omh-seek]")) {
      if (audio && Number.isFinite(Number(event.target.value))) {
        audio.currentTime = clamp(event.target.value, 0, Number.isFinite(audio.duration) ? audio.duration : currentTrack()?.durationSeconds || 0);
        renderPlaybackClock();
      }
    } else if (event.target.matches("[data-omh-volume]")) {
      state.volume = clamp(event.target.value, 0, 1);
      state.muted = false;
      audio.volume = state.volume;
      audio.muted = false;
      if (standbyAudio && !crossfadeInFlight) standbyAudio.volume = state.volume;
      if (standbyAudio) standbyAudio.muted = false;
      persist();
      renderPlayer();
    }
  }

  function onChange(event) {
    if (event.target.matches("[data-omh-license]")) {
      state.license = event.target.value;
      renderLibrary();
    } else if (event.target.matches("[data-omh-genre]")) {
      state.genre = event.target.value;
      renderLibrary();
    } else if (event.target.matches("[data-omh-mood]")) {
      state.mood = event.target.value;
      renderLibrary();
    } else if (event.target.matches("[data-omh-crossfade]")) {
      const value = Number(event.target.value);
      state.crossfadeSeconds = CROSSFADE_VALUES.includes(value) ? value : 0;
      persist();
      status(state.crossfadeSeconds ? `Crossfade ${state.crossfadeSeconds} giây đã bật.` : "Đã tắt crossfade.");
    }
  }

  function onKeydown(event) {
    if (!root?.contains(event.target)) return;
    const editable = event.target.matches("input, select, textarea, button, a, [contenteditable='true']");
    if (event.code === "Space" && !editable) {
      event.preventDefault();
      togglePlay();
    } else if (event.key.toLowerCase() === "k" && !editable) {
      event.preventDefault();
      focusSearch();
    } else if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      nextTrack(false);
    } else if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      previousTrack();
    } else if (event.key === "Escape" && state.queueOpen) {
      state.queueOpen = false;
      renderPlayer();
    }
  }

  function bindAudioEvents(mediaElement) {
    if (!mediaElement) return;
    mediaElement.volume = state.volume;
    mediaElement.muted = state.muted;
    mediaElement.addEventListener("loadedmetadata", () => {
      if (mediaElement !== audio) return;
      if (pendingSeek > 0 && Number.isFinite(mediaElement.duration) && pendingSeek < mediaElement.duration - 3) mediaElement.currentTime = pendingSeek;
      pendingSeek = 0;
      renderPlaybackClock();
      updateMediaPosition();
    }, { signal: abortController.signal });
    mediaElement.addEventListener("timeupdate", () => {
      if (mediaElement !== audio) return;
      renderPlaybackClock();
      savePlaybackProgress(false);
      updateMediaPosition();
      maybeStartCrossfade(mediaElement);
    }, { signal: abortController.signal });
    mediaElement.addEventListener("play", () => {
      if (mediaElement !== audio) return;
      try { if (global.navigator?.mediaSession) global.navigator.mediaSession.playbackState = "playing"; } catch {}
      renderPlayer();
      renderLibrary();
    }, { signal: abortController.signal });
    mediaElement.addEventListener("pause", () => {
      if (mediaElement !== audio) return;
      savePlaybackProgress(true);
      try { if (global.navigator?.mediaSession) global.navigator.mediaSession.playbackState = "paused"; } catch {}
      renderPlayer();
      renderLibrary();
    }, { signal: abortController.signal });
    mediaElement.addEventListener("ended", () => { if (mediaElement === audio) nextTrack(true); }, { signal: abortController.signal });
    mediaElement.addEventListener("error", () => {
      if (mediaElement !== audio) return;
      const track = currentTrack();
      if (!track) return;
      trackErrors.add(track.id);
      renderNowPlaying();
      renderLibrary();
      renderPlayer();
      status(fallbackTracks.has(track.id) ? "File gốc không phát được. Hãy mở trang nguồn để kiểm tra." : "Luồng MP3 đang lỗi. Bạn có thể thử file gốc.", "error");
    }, { signal: abortController.signal });
  }

  function bindMediaSession() {
    const mediaSession = global.navigator?.mediaSession;
    if (!mediaSession?.setActionHandler) return;
    const handlers = {
      play: () => audio?.play().catch(() => {}),
      pause: () => audio?.pause(),
      previoustrack: previousTrack,
      nexttrack: () => nextTrack(false),
      seekbackward: (details) => { if (audio) audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10)); },
      seekforward: (details) => { if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10)); },
      seekto: (details) => { if (audio && Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime; }
    };
    Object.entries(handlers).forEach(([name, handler]) => {
      try { mediaSession.setActionHandler(name, handler); } catch {}
    });
    mediaSessionBound = true;
  }

  function unbindMediaSession() {
    if (!mediaSessionBound || !global.navigator?.mediaSession?.setActionHandler) return;
    ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"].forEach((name) => {
      try { global.navigator.mediaSession.setActionHandler(name, null); } catch {}
    });
    mediaSessionBound = false;
  }

  async function loadRightsOverrides() {
    try {
      const response = await global.fetch("/api/open-media/rights", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: abortController.signal
      });
      if (!response.ok) throw new Error(`rights-registry-${response.status}`);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.records) ? payload.records : [];
      const records = new Map();
      rows.forEach((row) => {
        const id = String(row?.id || row?.itemId || "").trim();
        if (id) records.set(id, row);
      });
      return { online: true, records };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { online: false, records: new Map() };
    }
  }

  function isEmergencyBlocked(item, record) {
    if (!record) return false;
    const statusValue = String(record.reviewStatus || record.status || "").trim().toLowerCase();
    return record.available === false || record.publiclyAvailable === false || ["quarantine", "review", "suspended", "taken_down", "blocked"].includes(statusValue);
  }

  async function loadManifest() {
    if (!root) return;
    const requestId = ++manifestRequest;
    state.loading = true;
    state.error = "";
    renderLibrary();
    try {
      const response = await global.fetch(MANIFEST_URL, { headers: { Accept: "application/json" }, cache: "no-cache", signal: abortController.signal });
      if (!response.ok) throw new Error(`Máy chủ phản hồi HTTP ${response.status}.`);
      const manifest = await response.json();
      if (!manifest || !Array.isArray(manifest.items)) throw new Error("Manifest không đúng định dạng.");
      const registry = await loadRightsOverrides();
      const accepted = [];
      const rejected = [];
      const ids = new Set();
      manifest.items.forEach((item) => {
        const emergencyRecord = registry.records.get(String(item?.id || ""));
        if (isEmergencyBlocked(item, emergencyRecord)) {
          rejected.push({ id: String(item?.id || "unknown"), reason: "emergency-suspension" });
          return;
        }
        const normalized = normalizeTrack(item);
        if (!normalized || ids.has(normalized.id)) rejected.push({ id: String(item?.id || "unknown"), reason: normalized ? "duplicate" : "rights" });
        else { ids.add(normalized.id); accepted.push(normalized); }
      });
      if (!accepted.length) throw new Error("Rights Guard không tìm thấy bản nhạc nào đủ điều kiện phát.");
      if (requestId !== manifestRequest || !root) return;
      state.manifest = manifest;
      state.rightsRegistryOnline = registry.online;
      state.emergencyBlockCount = rejected.filter((item) => item.reason === "emergency-suspension").length;
      state.tracks = accepted;
      state.rejected = rejected;
      state.queue = state.queue.filter((id) => ids.has(id));
      state.favorites = new Set([...state.favorites].filter((id) => ids.has(id)));
      state.history = state.history.filter((entry) => ids.has(entry.id));
      if (!ids.has(state.currentTrackId)) state.currentTrackId = accepted[0].id;
      if (!state.queue.length) state.queue = filteredTracks().map((track) => track.id);
      state.queueIndex = Math.max(0, state.queue.indexOf(state.currentTrackId));
      state.loading = false;
      persist();
      renderAll();
      loadTrack(state.currentTrackId, false);
    } catch (error) {
      if (error?.name === "AbortError" || requestId !== manifestRequest) return;
      state.loading = false;
      state.error = error?.message || "Không thể tải kho nhạc.";
      renderLibrary();
      status(state.error, "error");
    }
  }

  function shellMarkup() {
    return `<section class="omh-app" data-open-music-app tabindex="-1">
      <header class="omh-topbar">
        <div class="omh-brand"><span><i></i>♫</span><div><small>HH OPEN MEDIA</small><strong>Nhạc</strong></div></div>
        <label class="omh-search"><span>⌕</span><input type="search" data-omh-search placeholder="Tìm bài, nghệ sĩ, thể loại…" autocomplete="off" aria-label="Tìm kiếm trong kho nhạc"><kbd>K</kbd></label>
        <div class="omh-top-filters">
          <label><span class="sr-only">Giấy phép</span><select data-omh-license aria-label="Lọc theo giấy phép"><option value="all">Mọi giấy phép</option><option value="CC0-1.0">CC0</option><option value="PDM-1.0">Public Domain</option><option value="CC-BY">CC BY</option><option value="CC-BY-SA-4.0">CC BY-SA</option></select></label>
          <label><span class="sr-only">Thể loại</span><select data-omh-genre aria-label="Lọc theo thể loại"><option value="all">Tất cả thể loại</option></select></label>
          <label><span class="sr-only">Cảm xúc</span><select data-omh-mood aria-label="Lọc theo cảm xúc"><option value="all">Tất cả cảm xúc</option></select></label>
        </div>
        <button type="button" class="omh-creator-mode" data-action="creator-mode" aria-pressed="false" title="Chỉ hiện nhạc đủ quyền dùng trong video"><span>✦</span> Creator</button>
        <button type="button" class="omh-queue-toggle" data-action="queue-toggle" aria-label="Mở hàng đợi">☷ <span data-omh-queue-count>0</span></button>
      </header>
      <div class="omh-workspace">
        <aside class="omh-sidebar" data-omh-sidebar></aside>
        <main class="omh-library">
          <section class="omh-hero" data-omh-hero hidden></section>
          <header class="omh-library-head"><div><small>CURATED · LICENSE VERIFIED</small><h1 data-omh-library-title>Kho nhạc được kiểm duyệt</h1></div><div><span data-omh-result-count>0 bản</span><button type="button" data-action="play-featured">▶ Phát danh sách</button><button type="button" data-action="clear-history" title="Xóa lịch sử">Xóa lịch sử</button></div></header>
          <div class="omh-grid" data-omh-grid></div>
        </main>
        <aside class="omh-now-panel">
          <header><div><small>NOW PLAYING</small><strong>Thông tin bản nhạc</strong></div><button type="button" data-action="queue-close" aria-label="Đóng hàng đợi">×</button></header>
          <div class="omh-now" data-omh-now></div>
          <section class="omh-queue-section"><header><div><strong>Hàng đợi</strong><small>Phát liên tục, không tải trước audio</small></div><div><button type="button" data-action="queue-clear">Dọn</button><span data-omh-queue-count>0</span></div></header><div class="omh-queue" data-omh-queue></div></section>
        </aside>
      </div>
      <footer class="omh-player">
        <div class="omh-player-track" data-omh-player-track><span><b>Chưa chọn nhạc</b><small>Chọn một bản trong thư viện</small></span></div>
        <div class="omh-player-center">
          <div class="omh-player-controls">
            <button type="button" data-action="shuffle" aria-label="Phát ngẫu nhiên" aria-pressed="false">⤨</button>
            <button type="button" data-action="previous" aria-label="Bản trước">|◀</button>
            <button type="button" class="is-main" data-action="toggle-play" aria-label="Phát">▶</button>
            <button type="button" data-action="next" aria-label="Bản tiếp">▶|</button>
            <button type="button" data-action="repeat" aria-label="Tắt lặp" data-mode="off">↻</button>
          </div>
          <div class="omh-timeline"><time data-omh-current-time>0:00</time><input type="range" data-omh-seek min="0" max="1" value="0" step="0.1" aria-label="Vị trí phát"><time data-omh-duration>0:00</time></div>
        </div>
        <div class="omh-player-actions">
          <label class="omh-crossfade"><span>Crossfade</span><select data-omh-crossfade aria-label="Thời gian crossfade"><option value="0">Tắt</option><option value="3">3s</option><option value="5">5s</option><option value="8">8s</option></select></label>
          <button type="button" data-action="current-favorite" aria-label="Yêu thích">♥</button>
          <button type="button" data-action="mute" aria-label="Tắt âm thanh">🔊</button>
          <input type="range" data-omh-volume min="0" max="1" step="0.02" value="0.82" aria-label="Âm lượng">
          <button type="button" data-action="queue-toggle" aria-label="Mở hàng đợi">☷</button>
        </div>
      </footer>
      <audio data-omh-audio preload="metadata"></audio>
      <audio data-omh-audio-standby preload="metadata"></audio>
      <div class="omh-status" data-omh-status role="status" aria-live="polite"></div>
    </section>`;
  }

  function mount(target, options = {}) {
    if (!target || typeof target.replaceChildren !== "function") throw new TypeError("HHOpenMusicHub.mount cần một phần tử host hợp lệ.");
    unmount();
    ownerScope = resolveOwnerScope(options);
    storageKey = `${STORAGE_PREFIX}:${ownerScope}`;
    host = target;
    readPersistedState();
    const wrapper = global.document.createElement("div");
    wrapper.innerHTML = shellMarkup();
    root = wrapper.firstElementChild;
    host.replaceChildren(root);
    abortController = new global.AbortController();
    audio = root.querySelector("[data-omh-audio]");
    standbyAudio = root.querySelector("[data-omh-audio-standby]");
    root.addEventListener("click", onClick, { signal: abortController.signal });
    root.addEventListener("input", onInput, { signal: abortController.signal });
    root.addEventListener("change", onChange, { signal: abortController.signal });
    root.addEventListener("keydown", onKeydown, { signal: abortController.signal });
    bindAudioEvents(audio);
    bindAudioEvents(standbyAudio);
    bindMediaSession();
    renderAll();
    loadManifest();
    return root;
  }

  function unmount() {
    manifestRequest += 1;
    global.clearTimeout(statusTimer);
    savePlaybackProgress(true);
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      try { audio.load(); } catch {}
    }
    if (standbyAudio) {
      standbyAudio.pause();
      standbyAudio.removeAttribute("src");
      try { standbyAudio.load(); } catch {}
    }
    cancelCrossfade();
    abortController?.abort();
    unbindMediaSession();
    if (host && root && root.parentNode === host) host.replaceChildren();
    host = null;
    root = null;
    audio = null;
    standbyAudio = null;
    abortController = null;
    resetRuntimeState();
    ownerScope = "guest";
    storageKey = `${STORAGE_PREFIX}:guest`;
    trackErrors.clear();
    fallbackTracks.clear();
  }

  function focusSearch() {
    const input = root?.querySelector("[data-omh-search]");
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  function inspect() {
    return Object.freeze({
      version: VERSION,
      mounted: Boolean(root?.isConnected),
      manifestUrl: MANIFEST_URL,
      ownerScope,
      storageKey,
      trackCount: state.tracks.length,
      rejectedCount: state.rejected.length,
      filteredCount: state.tracks.length ? filteredTracks().length : 0,
      currentTrackId: state.currentTrackId,
      queueCount: state.queue.length,
      queueIndex: state.queueIndex,
      playing: Boolean(audio && !audio.paused),
      shuffle: state.shuffle,
      repeat: state.repeat,
      crossfadeSeconds: state.crossfadeSeconds,
      crossfadeInFlight,
      muted: state.muted,
      view: state.view,
      query: state.query,
      license: state.license,
      genre: state.genre,
      mood: state.mood,
      creatorMode: state.creatorMode,
      creatorReadyCount: state.tracks.filter(isCreatorReady).length,
      rightsRegistryOnline: state.rightsRegistryOnline,
      emergencyBlockCount: state.emergencyBlockCount,
      favoriteCount: state.favorites.size,
      historyCount: state.history.length
    });
  }

  const api = Object.freeze({ mount, unmount, inspect, focusSearch, version: VERSION });
  global.HHOpenMusicHub = api;
  global.HHMusicLibrary = api;
})(typeof window !== "undefined" ? window : globalThis);
