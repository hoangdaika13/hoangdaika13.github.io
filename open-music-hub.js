(function initHHOpenMusicHub(global) {
  "use strict";

  const VERSION = "1.0.0";
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
  const MAX_HISTORY = 60;

  let host = null;
  let root = null;
  let audio = null;
  let abortController = null;
  let pendingSeek = 0;
  let lastProgressWrite = 0;
  let statusTimer = 0;
  let manifestRequest = 0;
  let mediaSessionBound = false;
  let ownerScope = "guest";
  let storageKey = `${STORAGE_PREFIX}:guest`;
  const trackErrors = new Set();
  const fallbackTracks = new Set();

  const state = {
    tracks: [],
    rejected: [],
    manifest: null,
    loading: false,
    error: "",
    view: "discover",
    query: "",
    license: "all",
    genre: "all",
    currentTrackId: "",
    queue: [],
    queueIndex: -1,
    favorites: new Set(),
    history: [],
    progress: {},
    shuffle: false,
    repeat: "off",
    volume: 0.82,
    muted: false,
    queueOpen: false
  };

  function resetRuntimeState() {
    state.tracks = [];
    state.rejected = [];
    state.manifest = null;
    state.loading = false;
    state.error = "";
    state.view = "discover";
    state.query = "";
    state.license = "all";
    state.genre = "all";
    state.currentTrackId = "";
    state.queue = [];
    state.queueIndex = -1;
    state.favorites = new Set();
    state.history = [];
    state.progress = {};
    state.shuffle = false;
    state.repeat = "off";
    state.volume = 0.82;
    state.muted = false;
    state.queueOpen = false;
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
      state.queue = Array.isArray(value.queue) ? value.queue.map(String).slice(0, 200) : [];
      state.favorites = new Set(Array.isArray(value.favorites) ? value.favorites.map(String) : []);
      state.history = Array.isArray(value.history) ? value.history.filter((row) => row && row.id).slice(0, MAX_HISTORY) : [];
      state.progress = value.progress && typeof value.progress === "object" ? value.progress : {};
      state.shuffle = Boolean(value.shuffle);
      state.repeat = REPEAT_MODES.includes(value.repeat) ? value.repeat : "off";
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
        queue: state.queue.slice(0, 200),
        favorites: [...state.favorites],
        history: state.history.slice(0, MAX_HISTORY),
        progress: state.progress,
        shuffle: state.shuffle,
        repeat: state.repeat,
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
    return Boolean(
      String(item?.id || "").trim() &&
      String(item?.title || "").trim() &&
      String(item?.creator || "").trim() &&
      item?.kind === "track" &&
      item?.playback?.type === "audio" &&
      ALLOWED_LICENSES.has(code) &&
      String(rights.licenseUrl || "") === ALLOWED_LICENSE_URLS[code] &&
      String(rights.attributionText || "").trim() &&
      isValidPastOrPresentDate(rights.verifiedAt) &&
      rights.commercialAllowed === true &&
      rights.derivativesAllowed === true &&
      isStrictHttpsUrl(rights.licenseUrl) &&
      isStrictHttpsUrl(item?.source?.landingUrl) &&
      isStrictHttpsUrl(item?.playback?.url)
    );
  }

  function validateRights(item) {
    const rightsApi = global.HHOpenMediaRights;
    if (!rightsApi?.validateItem) return fallbackRightsValidation(item);
    try {
      const result = rightsApi.validateItem(item);
      if (typeof result === "boolean") return result;
      if (result && typeof result === "object") {
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
        landingUrl: String(item.source.landingUrl)
      },
      rights: {
        licenseCode: String(item.rights.licenseCode),
        licenseUrl: String(item.rights.licenseUrl),
        attributionText: String(item.rights.attributionText || `${item.title} — ${item.creator}`),
        verifiedAt: String(item.rights.verifiedAt || ""),
        commercialAllowed: true,
        derivativesAllowed: true
      },
      playback: {
        type: "audio",
        url: String(item.playback.url),
        fallbackUrl: isStrictHttpsUrl(item.playback.fallbackUrl) ? String(item.playback.fallbackUrl) : String(item.playback.url)
      }
    };
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
    const show = state.view === "discover" && !state.query && state.license === "all" && state.genre === "all" && rows.length;
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
  }

  function renderQueue() {
    const node = root?.querySelector("[data-omh-queue]");
    const count = root?.querySelector("[data-omh-queue-count]");
    if (!node) return;
    const rows = state.queue.map(trackById).filter(Boolean);
    if (count) count.textContent = String(rows.length);
    node.innerHTML = rows.length ? rows.map((track, index) => `<div class="omh-queue-item${index === state.queueIndex ? " is-active" : ""}">
      <button type="button" data-play="${escapeHtml(track.id)}" data-queue-index="${index}">${visualMarkup(track, true)}<span><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.creator)}</small></span><time>${formatTime(track.durationSeconds)}</time></button>
      <button type="button" data-action="queue-remove" data-index="${index}" aria-label="Xóa khỏi hàng đợi">×</button>
    </div>`).join("") : `<p class="omh-queue-empty">Hàng đợi đang trống. Bấm <b>＋</b> trên một bản nhạc để thêm.</p>`;
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
      <section class="omh-rights-card">
        <header><span>✓</span><div><b>${escapeHtml(licenseLabel(track.rights.licenseCode))}</b><small>Đã kiểm tra ${escapeHtml(track.rights.verifiedAt)}</small></div></header>
        <p>${escapeHtml(track.rights.attributionText)}</p>
        <div><a href="${escapeHtml(track.rights.licenseUrl)}" target="_blank" rel="noopener noreferrer">Xem giấy phép ↗</a><a href="${escapeHtml(track.source.landingUrl)}" target="_blank" rel="noopener noreferrer">Nguồn gốc ↗</a></div>
      </section>
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

  function loadTrack(trackId, autoplay = true, options = {}) {
    const track = trackById(trackId);
    if (!track || !audio) return;
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
      persist();
      renderPlayer();
    } else if (action === "queue-toggle") {
      state.queueOpen = !state.queueOpen;
      renderPlayer();
    } else if (action === "queue-close") {
      state.queueOpen = false;
      renderPlayer();
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

  function bindAudioEvents() {
    if (!audio) return;
    audio.volume = state.volume;
    audio.muted = state.muted;
    audio.addEventListener("loadedmetadata", () => {
      if (pendingSeek > 0 && Number.isFinite(audio.duration) && pendingSeek < audio.duration - 3) audio.currentTime = pendingSeek;
      pendingSeek = 0;
      renderPlaybackClock();
      updateMediaPosition();
    }, { signal: abortController.signal });
    audio.addEventListener("timeupdate", () => {
      renderPlaybackClock();
      savePlaybackProgress(false);
      updateMediaPosition();
    }, { signal: abortController.signal });
    audio.addEventListener("play", () => {
      try { if (global.navigator?.mediaSession) global.navigator.mediaSession.playbackState = "playing"; } catch {}
      renderPlayer();
      renderLibrary();
    }, { signal: abortController.signal });
    audio.addEventListener("pause", () => {
      savePlaybackProgress(true);
      try { if (global.navigator?.mediaSession) global.navigator.mediaSession.playbackState = "paused"; } catch {}
      renderPlayer();
      renderLibrary();
    }, { signal: abortController.signal });
    audio.addEventListener("ended", () => nextTrack(true), { signal: abortController.signal });
    audio.addEventListener("error", () => {
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
      const accepted = [];
      const rejected = [];
      const ids = new Set();
      manifest.items.forEach((item) => {
        const normalized = normalizeTrack(item);
        if (!normalized || ids.has(normalized.id)) rejected.push({ id: String(item?.id || "unknown"), reason: normalized ? "duplicate" : "rights" });
        else { ids.add(normalized.id); accepted.push(normalized); }
      });
      if (!accepted.length) throw new Error("Rights Guard không tìm thấy bản nhạc nào đủ điều kiện phát.");
      if (requestId !== manifestRequest || !root) return;
      state.manifest = manifest;
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
        </div>
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
          <section class="omh-queue-section"><header><div><strong>Hàng đợi</strong><small>Phát liên tục, không tải trước audio</small></div><span data-omh-queue-count>0</span></header><div class="omh-queue" data-omh-queue></div></section>
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
          <button type="button" data-action="current-favorite" aria-label="Yêu thích">♥</button>
          <button type="button" data-action="mute" aria-label="Tắt âm thanh">🔊</button>
          <input type="range" data-omh-volume min="0" max="1" step="0.02" value="0.82" aria-label="Âm lượng">
          <button type="button" data-action="queue-toggle" aria-label="Mở hàng đợi">☷</button>
        </div>
      </footer>
      <audio data-omh-audio preload="metadata"></audio>
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
    root.addEventListener("click", onClick, { signal: abortController.signal });
    root.addEventListener("input", onInput, { signal: abortController.signal });
    root.addEventListener("change", onChange, { signal: abortController.signal });
    root.addEventListener("keydown", onKeydown, { signal: abortController.signal });
    bindAudioEvents();
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
    abortController?.abort();
    unbindMediaSession();
    if (host && root && root.parentNode === host) host.replaceChildren();
    host = null;
    root = null;
    audio = null;
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
      muted: state.muted,
      view: state.view,
      query: state.query,
      license: state.license,
      genre: state.genre,
      favoriteCount: state.favorites.size,
      historyCount: state.history.length
    });
  }

  const api = Object.freeze({ mount, unmount, inspect, focusSearch, version: VERSION });
  global.HHOpenMusicHub = api;
  global.HHMusicLibrary = api;
})(typeof window !== "undefined" ? window : globalThis);
