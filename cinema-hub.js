(function cinemaHubModule(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHCinemaHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createCinemaHub(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const MANIFEST_URL = "/assets/open-media/curated-films-v1.json";
  const STORAGE_SCHEMA = "hh.cinema.hub.v1";
  const LICENSE_URLS = Object.freeze({
    "PDM-1.0": "https://creativecommons.org/publicdomain/mark/1.0/",
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC-BY-2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/"
  });
  const ALLOWED_LICENSES = new Set(Object.keys(LICENSE_URLS));
  const VIEW_MODES = new Set(["all", "continue", "favorites", "history"]);
  const SORT_MODES = new Set(["featured", "newest", "oldest", "az", "duration"]);
  const MAX_HISTORY = 50;

  const FALLBACK_ITEMS = Object.freeze([
    {
      id: "sintel", kind: "film", title: "Sintel", originalTitle: "Sintel",
      creator: "Blender Foundation", year: 2010, durationSeconds: 888,
      genres: ["Hoạt hình", "Phiêu lưu", "Kỳ ảo"], languages: ["Tiếng Anh"],
      description: "Một nữ chiến binh trẻ băng qua vùng đất khắc nghiệt để tìm lại người bạn rồng đã mất.",
      poster: "https://archive.org/services/img/Sintel",
      source: { provider: "Blender Open Movies", landingUrl: "https://studio.blender.org/films/sintel/", playbackMirror: "Internet Archive" },
      rights: { licenseCode: "CC-BY-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", attributionText: "© Blender Foundation | durian.blender.org — CC BY 3.0", verifiedAt: "2026-08-10", commercialAllowed: true, derivativesAllowed: true },
      playback: { type: "video", url: "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4", mimeType: "video/mp4" }
    },
    {
      id: "great-train-robbery-1903", kind: "film", title: "The Great Train Robbery", originalTitle: "The Great Train Robbery",
      creator: "Edwin S. Porter / Edison Manufacturing Company", year: 1903, durationSeconds: 701,
      genres: ["Kinh điển", "Viễn Tây", "Phim câm"], languages: ["Phim câm"],
      description: "Tác phẩm điện ảnh thời kỳ đầu kể về một vụ cướp tàu và cuộc truy đuổi những tên cướp.",
      poster: "https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00000765/00000765.gif",
      source: { provider: "Library of Congress", landingUrl: "https://www.loc.gov/item/00694220/" },
      rights: { licenseCode: "PDM-1.0", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", attributionText: "Library of Congress, Motion Picture, Broadcasting and Recorded Sound Division", verifiedAt: "2026-08-10", commercialAllowed: true, derivativesAllowed: true },
      playback: { type: "video", url: "https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00000765/00000765.mp4", mimeType: "video/mp4" }
    },
    {
      id: "le-voyage-dans-la-lune", kind: "film", title: "Chuyến du hành lên Mặt Trăng", originalTitle: "Le Voyage dans la Lune",
      creator: "Georges Méliès", year: 1902, durationSeconds: 766,
      genres: ["Kinh điển", "Khoa học viễn tưởng", "Phim câm"], languages: ["Phim câm"],
      description: "Kiệt tác kỳ ảo tiên phong đưa một nhóm nhà thiên văn lên Mặt Trăng bằng một viên đạn khổng lồ.",
      poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Le_Voyage_dans_la_Lune_%281902%29.webm/960px--Le_Voyage_dans_la_Lune_%281902%29.webm.jpg",
      source: { provider: "Wikimedia Commons", landingUrl: "https://commons.wikimedia.org/wiki/File:Le_Voyage_dans_la_Lune_(1902).webm" },
      rights: { licenseCode: "PDM-1.0", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", attributionText: "Le Voyage dans la Lune — Georges Méliès — Wikimedia Commons", verifiedAt: "2026-08-10", commercialAllowed: true, derivativesAllowed: true },
      playback: { type: "video", url: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Le_Voyage_dans_la_Lune_%281902%29.webm", mimeType: "video/webm" }
    }
  ]);

  let activeRuntime = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeUrl(value) {
    const input = String(value || "").trim();
    if (!/^https:\/\//i.test(input)) return "";
    try {
      const parsed = new URL(input);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
    } catch (_error) { return ""; }
  }

  function validVerificationDate(value) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
    return text <= new Date().toISOString().slice(0, 10);
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours} giờ ${String(minutes).padStart(2, "0")} phút`;
    return `${Math.max(1, minutes)} phút`;
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function encodeOwnerToken(value) {
    const normalized = String(value || "local").normalize("NFKC").trim().toLocaleLowerCase("en-US") || "local";
    return encodeURIComponent(normalized);
  }

  function resolveOwnerId(options = {}) {
    let profile = options.currentUser && typeof options.currentUser === "object" ? options.currentUser : null;
    if (!profile) {
      try { profile = globalScope.HHAuthz?.currentUser?.() || null; } catch (_error) { profile = null; }
    }
    if (!profile) {
      try { profile = JSON.parse(globalScope.localStorage?.getItem("hh-auth-user") || "null"); } catch (_error) { profile = null; }
    }
    return encodeOwnerToken(options.ownerId || profile?.ownerId || profile?.id || profile?.sub || profile?.email || "local");
  }

  function storageKey(ownerId) {
    return `${STORAGE_SCHEMA}:${ownerId || "local"}`;
  }

  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const favorites = [...new Set((Array.isArray(raw.favorites) ? raw.favorites : []).map(String))].slice(0, 500);
    const history = (Array.isArray(raw.history) ? raw.history : []).filter((entry) => entry && entry.id).map((entry) => ({
      id: String(entry.id), viewedAt: String(entry.viewedAt || new Date(0).toISOString())
    })).slice(0, MAX_HISTORY);
    const progress = {};
    Object.entries(raw.progress && typeof raw.progress === "object" ? raw.progress : {}).forEach(([id, entry]) => {
      if (!entry || typeof entry !== "object") return;
      progress[String(id)] = {
        position: clamp(entry.position, 0, 172800, 0),
        duration: clamp(entry.duration, 0, 172800, 0),
        updatedAt: String(entry.updatedAt || ""),
        completed: Boolean(entry.completed)
      };
    });
    return {
      version: VERSION,
      favorites,
      history,
      progress,
      selectedId: String(raw.selectedId || ""),
      view: VIEW_MODES.has(raw.view) ? raw.view : "all",
      source: String(raw.source || "all"),
      license: String(raw.license || "all"),
      genre: String(raw.genre || "all"),
      sort: SORT_MODES.has(raw.sort) ? raw.sort : "featured"
    };
  }

  function readState(storage, ownerId) {
    try { return normalizeState(JSON.parse(storage?.getItem(storageKey(ownerId)) || "null")); }
    catch (_error) { return normalizeState(null); }
  }

  function writeState(runtime) {
    try { runtime.storage?.setItem(storageKey(runtime.ownerId), JSON.stringify(runtime.state)); }
    catch (_error) { /* localStorage can be blocked; the current session still works. */ }
  }

  function fallbackLicenseAllowed(item) {
    return Boolean(
      item && item.kind === "film" && item.id && item.title &&
      ALLOWED_LICENSES.has(item.rights?.licenseCode) &&
      safeUrl(item.rights?.licenseUrl) === LICENSE_URLS[item.rights?.licenseCode] &&
      validVerificationDate(item.rights?.verifiedAt) &&
      item.rights?.commercialAllowed === true && item.rights?.derivativesAllowed === true &&
      safeUrl(item.source?.landingUrl) &&
      item.playback?.type === "video" && safeUrl(item.playback?.url)
    );
  }

  function validateCatalogItem(item) {
    const validator = globalScope.HHOpenMediaRights?.validateItem;
    if (typeof validator === "function") {
      try {
        const verdict = validator(item);
        if (verdict === false) return false;
        if (verdict === true) return true;
        if (verdict && typeof verdict === "object") {
          if (verdict.ok === false || verdict.valid === false || verdict.allowed === false || verdict.publishable === false || verdict.publish === false || verdict.status === "rejected") return false;
          if (verdict.ok === true || verdict.valid === true || verdict.allowed === true || verdict.publishable === true || verdict.publish === true || verdict.status === "published") return true;
        }
        return false;
      } catch (_error) { return false; }
    }
    return fallbackLicenseAllowed(item);
  }

  function normalizeCatalog(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!validateCatalogItem(item) || seen.has(String(item.id))) return false;
      seen.add(String(item.id));
      return true;
    }).map((item) => ({
      ...clone(item),
      id: String(item.id),
      title: String(item.title),
      genres: Array.isArray(item.genres) ? item.genres.map(String) : [],
      languages: Array.isArray(item.languages) ? item.languages.map(String) : [],
      year: Number(item.year) || 0,
      durationSeconds: Number(item.durationSeconds) || 0
    }));
  }

  async function loadCatalog(options, signal) {
    if (Array.isArray(options.catalog)) return { items: normalizeCatalog(options.catalog), source: "options", error: "" };
    const fetcher = options.fetch || globalScope.fetch;
    if (typeof fetcher !== "function") return { items: normalizeCatalog(FALLBACK_ITEMS), source: "fallback", error: "Không thể tải danh mục trực tuyến; đang dùng bộ phim dự phòng đã kiểm duyệt." };
    try {
      const response = await fetcher(options.manifestUrl || MANIFEST_URL, { signal, credentials: "same-origin", cache: "no-cache" });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
      const payload = await response.json();
      const items = normalizeCatalog(payload?.items);
      if (!items.length) throw new Error("Danh mục không có nội dung vượt qua kiểm tra giấy phép");
      return { items, source: "manifest", error: "" };
    } catch (error) {
      if (signal?.aborted) return { items: [], source: "aborted", error: "" };
      return { items: normalizeCatalog(FALLBACK_ITEMS), source: "fallback", error: `Nguồn danh mục tạm gián đoạn (${error?.message || "không xác định"}). Đang dùng bộ phim dự phòng đã kiểm duyệt.` };
    }
  }

  function getProgress(runtime, id) {
    return runtime.state.progress[id] || { position: 0, duration: 0, completed: false, updatedAt: "" };
  }

  function progressRatio(runtime, item) {
    const entry = getProgress(runtime, item.id);
    const duration = entry.duration || item.durationSeconds || 0;
    return duration > 0 ? clamp(entry.position / duration, 0, 1, 0) : 0;
  }

  function isContinuable(runtime, item) {
    const entry = getProgress(runtime, item.id);
    const ratio = progressRatio(runtime, item);
    return !entry.completed && entry.position >= 15 && ratio > 0.01 && ratio < 0.96;
  }

  function filteredCatalog(runtime) {
    const query = runtime.query.trim().toLocaleLowerCase("vi");
    const historyIds = new Map(runtime.state.history.map((entry, index) => [entry.id, index]));
    let items = runtime.catalog.filter((item) => {
      if (runtime.state.view === "favorites" && !runtime.state.favorites.includes(item.id)) return false;
      if (runtime.state.view === "continue" && !isContinuable(runtime, item)) return false;
      if (runtime.state.view === "history" && !historyIds.has(item.id)) return false;
      if (runtime.state.source !== "all" && item.source.provider !== runtime.state.source) return false;
      if (runtime.state.license !== "all" && item.rights.licenseCode !== runtime.state.license) return false;
      if (runtime.state.genre !== "all" && !item.genres.includes(runtime.state.genre)) return false;
      if (!query) return true;
      return [item.title, item.originalTitle, item.creator, item.description, item.genres.join(" "), item.source.provider]
        .join(" ").toLocaleLowerCase("vi").includes(query);
    });
    if (runtime.state.view === "history") items.sort((a, b) => (historyIds.get(a.id) ?? 999) - (historyIds.get(b.id) ?? 999));
    else if (runtime.state.sort === "newest") items.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "vi"));
    else if (runtime.state.sort === "oldest") items.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "vi"));
    else if (runtime.state.sort === "az") items.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    else if (runtime.state.sort === "duration") items.sort((a, b) => b.durationSeconds - a.durationSeconds);
    return items;
  }

  function licenseLabel(code) {
    if (code === "PDM-1.0") return "Public Domain";
    if (code === "CC0-1.0") return "CC0";
    return code.replace(/-/g, " ");
  }

  function sourceOptions(runtime) {
    return [...new Set(runtime.catalog.map((item) => item.source.provider))].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function licenseOptions(runtime) {
    return [...new Set(runtime.catalog.map((item) => item.rights.licenseCode))].sort();
  }

  function genreOptions(runtime) {
    return [...new Set(runtime.catalog.flatMap((item) => item.genres))].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function renderShell(runtime) {
    runtime.host.innerHTML = `<section class="cinema-hub" data-cinema-hub aria-label="Rạp phim nội dung mở">
      <header class="cinema-topbar">
        <div class="cinema-brand"><span class="cinema-brand__mark" aria-hidden="true">H</span><div><small>HH OPEN CINEMA</small><h2>Phim</h2></div><span class="cinema-safe-badge" title="Chỉ hiển thị nội dung qua bộ lọc giấy phép">✓ Bản quyền mở</span></div>
        <label class="cinema-search"><span aria-hidden="true">⌕</span><input type="search" data-cinema-search autocomplete="off" placeholder="Tìm phim, đạo diễn, thể loại…" aria-label="Tìm trong kho phim"></label>
        <div class="cinema-topbar__stats"><strong data-cinema-total>0</strong><span>phim đã kiểm duyệt</span></div>
      </header>
      <div class="cinema-toolbar" aria-label="Lọc danh mục phim">
        <div class="cinema-tabs" role="tablist" aria-label="Thư viện cá nhân">
          <button type="button" role="tab" data-cinema-view="all">Khám phá</button>
          <button type="button" role="tab" data-cinema-view="continue">Xem tiếp</button>
          <button type="button" role="tab" data-cinema-view="favorites">Yêu thích</button>
          <button type="button" role="tab" data-cinema-view="history">Lịch sử</button>
        </div>
        <div class="cinema-filters">
          <label><span>Nguồn</span><select data-cinema-filter="source" aria-label="Lọc theo nguồn"></select></label>
          <label><span>Giấy phép</span><select data-cinema-filter="license" aria-label="Lọc theo giấy phép"></select></label>
          <label><span>Thể loại</span><select data-cinema-filter="genre" aria-label="Lọc theo thể loại"></select></label>
          <label><span>Sắp xếp</span><select data-cinema-filter="sort" aria-label="Sắp xếp phim"><option value="featured">Nổi bật</option><option value="newest">Mới → cũ</option><option value="oldest">Cũ → mới</option><option value="az">A → Z</option><option value="duration">Dài nhất</option></select></label>
        </div>
      </div>
      <main class="cinema-workspace">
        <section class="cinema-theater" aria-label="Trình phát phim">
          <div class="cinema-player" data-cinema-player></div>
          <div class="cinema-now" data-cinema-now></div>
          <div class="cinema-rights" data-cinema-rights></div>
        </section>
        <aside class="cinema-library" aria-label="Danh sách phim">
          <header><div><small>THƯ VIỆN</small><strong data-cinema-result-count>0 phim</strong></div><button type="button" data-cinema-clear-history title="Xóa lịch sử xem">Xóa lịch sử</button></header>
          <div class="cinema-card-list" data-cinema-list></div>
        </aside>
      </main>
      <footer class="cinema-footer"><span><i aria-hidden="true"></i> Không quảng cáo chen vào player · Không tự phát âm thanh</span><span class="cinema-shortcuts"><kbd>Space</kbd> phát/dừng <kbd>←</kbd><kbd>→</kbd> ±10 giây <kbd>P</kbd> PiP <kbd>F</kbd> toàn màn hình</span></footer>
      <div class="cinema-toast" data-cinema-toast role="status" aria-live="polite" hidden></div>
    </section>`;
    runtime.root = runtime.host.querySelector("[data-cinema-hub]");
  }

  function updateToolbar(runtime) {
    const source = runtime.root.querySelector('[data-cinema-filter="source"]');
    const license = runtime.root.querySelector('[data-cinema-filter="license"]');
    const genre = runtime.root.querySelector('[data-cinema-filter="genre"]');
    const sort = runtime.root.querySelector('[data-cinema-filter="sort"]');
    source.innerHTML = `<option value="all">Tất cả nguồn</option>${sourceOptions(runtime).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    license.innerHTML = `<option value="all">Mọi giấy phép</option>${licenseOptions(runtime).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(licenseLabel(value))}</option>`).join("")}`;
    genre.innerHTML = `<option value="all">Mọi thể loại</option>${genreOptions(runtime).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    source.value = sourceOptions(runtime).includes(runtime.state.source) ? runtime.state.source : "all";
    license.value = licenseOptions(runtime).includes(runtime.state.license) ? runtime.state.license : "all";
    genre.value = genreOptions(runtime).includes(runtime.state.genre) ? runtime.state.genre : "all";
    sort.value = SORT_MODES.has(runtime.state.sort) ? runtime.state.sort : "featured";
    runtime.root.querySelectorAll("[data-cinema-view]").forEach((button) => {
      const active = button.dataset.cinemaView === runtime.state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    runtime.root.querySelector("[data-cinema-total]").textContent = String(runtime.catalog.length);
  }

  function cardMarkup(runtime, item) {
    const favorite = runtime.state.favorites.includes(item.id);
    const progress = getProgress(runtime, item.id);
    const ratio = progressRatio(runtime, item);
    const selected = runtime.selectedId === item.id;
    return `<article class="cinema-card ${selected ? "is-selected" : ""}" data-cinema-card="${escapeHtml(item.id)}">
      <button type="button" class="cinema-card__open" data-cinema-select="${escapeHtml(item.id)}" aria-label="Mở ${escapeHtml(item.title)}">
        <span class="cinema-card__poster"><img src="${escapeHtml(safeUrl(item.poster))}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>${escapeHtml(licenseLabel(item.rights.licenseCode))}</i>${ratio > 0 ? `<b style="--progress:${Math.round(ratio * 100)}%"></b>` : ""}</span>
        <span class="cinema-card__copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(String(item.year))} · ${escapeHtml(formatDuration(item.durationSeconds))}</small><em>${escapeHtml(item.genres.slice(0, 2).join(" · "))}</em>${isContinuable(runtime, item) ? `<span>Tiếp tục từ ${escapeHtml(formatClock(progress.position))}</span>` : ""}</span>
      </button>
      <button type="button" class="cinema-card__favorite ${favorite ? "is-active" : ""}" data-cinema-favorite="${escapeHtml(item.id)}" aria-label="${favorite ? "Bỏ khỏi" : "Thêm vào"} yêu thích" aria-pressed="${favorite}">${favorite ? "★" : "☆"}</button>
    </article>`;
  }

  function renderCatalog(runtime) {
    const items = filteredCatalog(runtime);
    const list = runtime.root.querySelector("[data-cinema-list]");
    runtime.root.querySelector("[data-cinema-result-count]").textContent = `${items.length} phim`;
    runtime.root.querySelector("[data-cinema-clear-history]").hidden = runtime.state.view !== "history" || !runtime.state.history.length;
    list.innerHTML = items.length ? items.map((item) => cardMarkup(runtime, item)).join("") : `<div class="cinema-empty"><span aria-hidden="true">◌</span><strong>Chưa có phim phù hợp</strong><p>Hãy đổi bộ lọc hoặc từ khóa. Nội dung không rõ giấy phép sẽ không được hiển thị.</p><button type="button" data-cinema-reset>Làm mới bộ lọc</button></div>`;
  }

  function selectedItem(runtime) {
    return runtime.catalog.find((item) => item.id === runtime.selectedId) || runtime.catalog[0] || null;
  }

  function playerMarkup(item) {
    if (!item) return `<div class="cinema-player-empty"><span>◌</span><strong>Chưa có nguồn phim an toàn</strong><p>Không mục nào vượt qua bộ kiểm tra giấy phép.</p></div>`;
    const playbackUrl = safeUrl(item.playback.url);
    const poster = safeUrl(item.poster);
    return `<video data-cinema-video controls playsinline preload="metadata" poster="${escapeHtml(poster)}" aria-label="Đang phát ${escapeHtml(item.title)}"><source src="${escapeHtml(playbackUrl)}" type="${escapeHtml(item.playback.mimeType || "video/mp4")}">Trình duyệt của bạn không hỗ trợ phát video.</video><div class="cinema-player-fallback" data-cinema-player-error hidden><strong>Nguồn phim tạm thời không tải được</strong><p>Tiến độ của bạn vẫn được giữ. Bạn có thể thử lại hoặc mở bản gốc.</p><div><button type="button" data-cinema-retry>Thử lại</button><a href="${escapeHtml(safeUrl(item.source.landingUrl))}" target="_blank" rel="noopener noreferrer">Mở tại nguồn ↗</a></div></div>`;
  }

  function nowMarkup(runtime, item) {
    if (!item) return "";
    const favorite = runtime.state.favorites.includes(item.id);
    const progress = getProgress(runtime, item.id);
    return `<div class="cinema-now__heading"><div><span class="cinema-license-pill" data-license="${escapeHtml(item.rights.licenseCode)}">${escapeHtml(licenseLabel(item.rights.licenseCode))}</span><span>${escapeHtml(String(item.year))}</span><span>${escapeHtml(formatDuration(item.durationSeconds))}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : item.creator)}</p></div>
      <div class="cinema-now__actions">
        <button type="button" data-cinema-player-action="rewind" title="Lùi 10 giây">↶ 10</button>
        <button type="button" data-cinema-player-action="pip" title="Picture-in-Picture">▣ PiP</button>
        <button type="button" data-cinema-player-action="fullscreen" title="Toàn màn hình">⛶</button>
        <button type="button" class="${favorite ? "is-favorite" : ""}" data-cinema-favorite="${escapeHtml(item.id)}" aria-pressed="${favorite}">${favorite ? "★ Đã lưu" : "☆ Yêu thích"}</button>
        ${progress.completed ? `<span class="cinema-completed">✓ Đã xem xong</span>` : ""}
      </div>`;
  }

  function rightsMarkup(item) {
    if (!item) return "";
    return `<div class="cinema-description"><p>${escapeHtml(item.description)}</p><div>${item.genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}</div></div>
      <details class="cinema-rights-card"><summary><span><i aria-hidden="true">✓</i><b>Nguồn & giấy phép đã xác minh</b></span><small>Kiểm tra ${escapeHtml(item.rights.verifiedAt)}</small></summary>
        <div class="cinema-rights-card__body"><table class="cinema-rights-table"><tbody>
          <tr><th>Nguồn</th><td>${escapeHtml(item.source.provider)}</td></tr>
          <tr><th>Tác giả</th><td>${escapeHtml(item.creator)}</td></tr>
          <tr><th>Giấy phép</th><td><strong>${escapeHtml(licenseLabel(item.rights.licenseCode))}</strong></td></tr>
          <tr><th>Cho phép</th><td>${item.rights.commercialAllowed ? "Phân phối và sử dụng thương mại" : "Chỉ phi thương mại"}${item.rights.derivativesAllowed ? " · Cho phép chỉnh sửa" : " · Không phái sinh"}</td></tr>
          <tr><th>Ghi công</th><td>${escapeHtml(item.rights.attributionText)}</td></tr>
        </tbody></table><div class="cinema-rights-links"><a href="${escapeHtml(safeUrl(item.source.landingUrl))}" target="_blank" rel="noopener noreferrer">Trang nguồn ↗</a><a href="${escapeHtml(safeUrl(item.rights.licenseUrl))}" target="_blank" rel="noopener noreferrer">Đọc giấy phép ↗</a></div></div>
      </details>`;
  }

  function bindPlayer(runtime, item) {
    const video = runtime.root.querySelector("[data-cinema-video]");
    runtime.video = video || null;
    if (!video) return;
    const showError = () => {
      const fallback = runtime.root.querySelector("[data-cinema-player-error]");
      if (fallback) fallback.hidden = false;
      runtime.root.querySelector("[data-cinema-player]")?.classList.add("has-error");
    };
    const restore = () => {
      const entry = getProgress(runtime, item.id);
      const duration = Number(video.duration) || item.durationSeconds || 0;
      if (!entry.completed && entry.position >= 5 && entry.position < duration - 8) {
        try { video.currentTime = Math.min(entry.position, Math.max(0, duration - 3)); } catch (_error) { /* Metadata may not be seekable yet. */ }
      }
      updateMediaSession(runtime, item);
    };
    const saveProgress = (completed = false) => {
      const now = Date.now();
      if (!completed && now - runtime.lastProgressWrite < 4000) return;
      runtime.lastProgressWrite = now;
      const duration = Number(video.duration) || item.durationSeconds || 0;
      const position = completed ? duration : Number(video.currentTime) || 0;
      runtime.state.progress[item.id] = { position, duration, updatedAt: new Date().toISOString(), completed };
      writeState(runtime);
      updateCardProgress(runtime, item.id);
    };
    addPlayerListener(runtime, video, "loadedmetadata", restore);
    addPlayerListener(runtime, video, "error", showError);
    addPlayerListener(runtime, video, "play", () => {
      addHistory(runtime, item.id);
      runtime.root.querySelector("[data-cinema-player]")?.classList.add("is-playing");
    });
    addPlayerListener(runtime, video, "pause", () => {
      saveProgress(false);
      runtime.root.querySelector("[data-cinema-player]")?.classList.remove("is-playing");
    });
    addPlayerListener(runtime, video, "timeupdate", () => saveProgress(false));
    addPlayerListener(runtime, video, "ended", () => {
      saveProgress(true);
      renderNow(runtime, item);
      renderCatalog(runtime);
      toast(runtime, "Đã hoàn thành phim. Tiến độ được lưu trên thiết bị.", "success");
    });
  }

  function renderNow(runtime, item) {
    runtime.root.querySelector("[data-cinema-now]").innerHTML = nowMarkup(runtime, item);
  }

  function renderPlayer(runtime, item) {
    if (runtime.video) persistCurrentProgress(runtime);
    clearPlayerListeners(runtime);
    runtime.video?.pause?.();
    runtime.video = null;
    runtime.root.querySelector("[data-cinema-player]").innerHTML = playerMarkup(item);
    renderNow(runtime, item);
    runtime.root.querySelector("[data-cinema-rights]").innerHTML = rightsMarkup(item);
    bindPlayer(runtime, item);
  }

  function persistCurrentProgress(runtime) {
    const video = runtime.video;
    const item = selectedItem(runtime);
    if (!video || !item || !Number.isFinite(Number(video.currentTime))) return;
    const duration = Number(video.duration) || item.durationSeconds || 0;
    const old = getProgress(runtime, item.id);
    runtime.state.progress[item.id] = {
      position: Number(video.currentTime) || old.position || 0,
      duration,
      updatedAt: new Date().toISOString(),
      completed: old.completed || Boolean(video.ended)
    };
    writeState(runtime);
  }

  function updateCardProgress(runtime, id) {
    const item = runtime.catalog.find((entry) => entry.id === id);
    const card = runtime.root.querySelector(`[data-cinema-card="${cssEscape(id)}"]`);
    if (!item || !card) return;
    const replacement = runtime.document.createElement("div");
    replacement.innerHTML = cardMarkup(runtime, item);
    card.replaceWith(replacement.firstElementChild);
  }

  function cssEscape(value) {
    if (globalScope.CSS?.escape) return globalScope.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function addHistory(runtime, id) {
    runtime.state.history = [{ id, viewedAt: new Date().toISOString() }, ...runtime.state.history.filter((entry) => entry.id !== id)].slice(0, MAX_HISTORY);
    writeState(runtime);
  }

  function selectFilm(runtime, id, options = {}) {
    const item = runtime.catalog.find((entry) => entry.id === id);
    if (!item || runtime.selectedId === id && !options.force) return;
    persistCurrentProgress(runtime);
    runtime.selectedId = id;
    runtime.state.selectedId = id;
    addHistory(runtime, id);
    renderPlayer(runtime, item);
    renderCatalog(runtime);
    writeState(runtime);
    if (options.focusPlayer) runtime.root.querySelector("[data-cinema-player]")?.focus?.({ preventScroll: true });
  }

  function toggleFavorite(runtime, id) {
    const set = new Set(runtime.state.favorites);
    const added = !set.has(id);
    if (added) set.add(id); else set.delete(id);
    runtime.state.favorites = [...set];
    writeState(runtime);
    renderCatalog(runtime);
    renderNow(runtime, selectedItem(runtime));
    toast(runtime, added ? "Đã thêm vào phim yêu thích." : "Đã bỏ khỏi phim yêu thích.", "success");
  }

  async function playerAction(runtime, action) {
    const video = runtime.video;
    const stage = runtime.root.querySelector("[data-cinema-player]");
    if (action === "fullscreen") {
      try {
        if (runtime.document.fullscreenElement) await runtime.document.exitFullscreen?.();
        else await stage?.requestFullscreen?.();
      } catch (_error) { toast(runtime, "Trình duyệt chưa cho phép mở toàn màn hình.", "warning"); }
      return;
    }
    if (!video) {
      toast(runtime, "Điều khiển này chỉ dùng với trình phát video trực tiếp.", "warning");
      return;
    }
    if (action === "toggle") {
      try { if (video.paused) await video.play(); else video.pause(); }
      catch (_error) { toast(runtime, "Nhấn nút Play trong trình phát để cấp quyền phát video.", "warning"); }
    } else if (action === "rewind") video.currentTime = Math.max(0, video.currentTime - 10);
    else if (action === "forward") video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    else if (action === "mute") video.muted = !video.muted;
    else if (action === "pip") {
      if (!runtime.document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== "function") {
        toast(runtime, "Trình duyệt này chưa hỗ trợ Picture-in-Picture.", "warning");
        return;
      }
      try {
        if (runtime.document.pictureInPictureElement) await runtime.document.exitPictureInPicture();
        else await video.requestPictureInPicture();
      } catch (_error) { toast(runtime, "Không thể mở Picture-in-Picture cho nguồn phim này.", "warning"); }
    }
  }

  function updateMediaSession(runtime, item) {
    const mediaSession = globalScope.navigator?.mediaSession;
    if (!mediaSession) return;
    try {
      if (typeof globalScope.MediaMetadata === "function") {
        mediaSession.metadata = new globalScope.MediaMetadata({ title: item.title, artist: item.creator, album: "HH Open Cinema", artwork: safeUrl(item.poster) ? [{ src: safeUrl(item.poster) }] : [] });
      }
      mediaSession.setActionHandler("play", () => runtime.video?.play?.());
      mediaSession.setActionHandler("pause", () => runtime.video?.pause?.());
      mediaSession.setActionHandler("seekbackward", () => playerAction(runtime, "rewind"));
      mediaSession.setActionHandler("seekforward", () => playerAction(runtime, "forward"));
    } catch (_error) { /* Some browsers expose only part of Media Session. */ }
  }

  function clearMediaSession() {
    const mediaSession = globalScope.navigator?.mediaSession;
    if (!mediaSession) return;
    ["play", "pause", "seekbackward", "seekforward"].forEach((action) => {
      try { mediaSession.setActionHandler(action, null); } catch (_error) { /* Optional API. */ }
    });
  }

  function toast(runtime, text, tone = "info") {
    const node = runtime.root?.querySelector("[data-cinema-toast]");
    if (!node) return;
    node.textContent = String(text || "");
    node.dataset.tone = tone;
    node.hidden = false;
    globalScope.clearTimeout?.(runtime.toastTimer);
    runtime.toastTimer = globalScope.setTimeout?.(() => { if (node.isConnected) node.hidden = true; }, 3600);
  }

  function resetFilters(runtime) {
    runtime.query = "";
    runtime.state.view = "all";
    runtime.state.source = "all";
    runtime.state.license = "all";
    runtime.state.genre = "all";
    runtime.state.sort = "featured";
    const search = runtime.root.querySelector("[data-cinema-search]");
    if (search) search.value = "";
    updateToolbar(runtime);
    renderCatalog(runtime);
    writeState(runtime);
  }

  function addListener(runtime, target, type, listener, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    runtime.listeners.push(() => target.removeEventListener(type, listener, options));
  }

  function addPlayerListener(runtime, target, type, listener, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    runtime.playerListeners.push(() => target.removeEventListener(type, listener, options));
  }

  function clearPlayerListeners(runtime) {
    runtime.playerListeners.splice(0).forEach((remove) => { try { remove(); } catch (_error) { /* noop */ } });
  }

  function bindEvents(runtime) {
    addListener(runtime, runtime.root, "click", (event) => {
      const select = event.target.closest("[data-cinema-select]");
      if (select) { selectFilm(runtime, select.dataset.cinemaSelect, { focusPlayer: false }); return; }
      const favorite = event.target.closest("[data-cinema-favorite]");
      if (favorite) { toggleFavorite(runtime, favorite.dataset.cinemaFavorite); return; }
      const view = event.target.closest("[data-cinema-view]");
      if (view) {
        runtime.state.view = VIEW_MODES.has(view.dataset.cinemaView) ? view.dataset.cinemaView : "all";
        updateToolbar(runtime); renderCatalog(runtime); writeState(runtime); return;
      }
      const action = event.target.closest("[data-cinema-player-action]");
      if (action) { playerAction(runtime, action.dataset.cinemaPlayerAction); return; }
      if (event.target.closest("[data-cinema-retry]")) { renderPlayer(runtime, selectedItem(runtime)); return; }
      if (event.target.closest("[data-cinema-reset]")) { resetFilters(runtime); return; }
      if (event.target.closest("[data-cinema-clear-history]")) {
        runtime.state.history = [];
        writeState(runtime); renderCatalog(runtime); toast(runtime, "Đã xóa lịch sử xem trên thiết bị.", "success");
      }
    });
    addListener(runtime, runtime.root, "input", (event) => {
      if (!event.target.matches("[data-cinema-search]")) return;
      runtime.query = String(event.target.value || "").slice(0, 120);
      renderCatalog(runtime);
    });
    addListener(runtime, runtime.root, "change", (event) => {
      const key = event.target.dataset.cinemaFilter;
      if (!key) return;
      if (key === "sort") runtime.state.sort = SORT_MODES.has(event.target.value) ? event.target.value : "featured";
      else if (["source", "license", "genre"].includes(key)) runtime.state[key] = String(event.target.value || "all");
      renderCatalog(runtime); writeState(runtime);
    });
    addListener(runtime, runtime.document, "keydown", (event) => {
      if (!runtime.root?.isConnected || event.ctrlKey || event.metaKey || event.altKey) return;
      const interactive = event.target?.closest?.("input, textarea, select, button, a, summary, [role='button'], [contenteditable='true']");
      if (interactive) return;
      const key = String(event.key || "").toLowerCase();
      if (key === " " || key === "k") { event.preventDefault(); playerAction(runtime, "toggle"); }
      else if (key === "arrowleft") { event.preventDefault(); playerAction(runtime, "rewind"); }
      else if (key === "arrowright") { event.preventDefault(); playerAction(runtime, "forward"); }
      else if (key === "p") { event.preventDefault(); playerAction(runtime, "pip"); }
      else if (key === "f") { event.preventDefault(); playerAction(runtime, "fullscreen"); }
      else if (key === "m") { event.preventDefault(); playerAction(runtime, "mute"); }
      else if (key === "/") { event.preventDefault(); focusSearch(); }
    });
    addListener(runtime, globalScope, "hh:cinema-focus-search", () => focusSearch());
    addListener(runtime, runtime.document, "visibilitychange", () => {
      if (runtime.document.hidden && runtime.video && !runtime.video.paused) runtime.video.pause();
    });
  }

  function resolveHost(target) {
    if (target?.nodeType === 1) return target;
    if (typeof target === "string") return globalScope.document?.querySelector?.(target) || null;
    return null;
  }

  async function mount(target, options = {}) {
    unmount();
    const host = resolveHost(target);
    if (!host) throw new Error("HHCinemaHub.mount cần một phần tử host hợp lệ.");
    const documentRef = host.ownerDocument || globalScope.document;
    const controller = typeof globalScope.AbortController === "function" ? new globalScope.AbortController() : new AbortController();
    const runtime = {
      host,
      root: null,
      document: documentRef,
      options,
      controller,
      listeners: [],
      playerListeners: [],
      storage: options.storage || globalScope.localStorage,
      ownerId: resolveOwnerId(options),
      state: null,
      catalog: [],
      selectedId: "",
      query: "",
      video: null,
      manifestSource: "loading",
      catalogError: "",
      lastProgressWrite: 0,
      toastTimer: 0
    };
    runtime.state = readState(runtime.storage, runtime.ownerId);
    activeRuntime = runtime;
    documentRef.body?.classList.add("app-cinema-route");
    renderShell(runtime);
    const loading = runtime.root.querySelector("[data-cinema-list]");
    loading.innerHTML = `<div class="cinema-loading"><i></i><strong>Đang kiểm tra nguồn và giấy phép…</strong><span>Chỉ nội dung vượt qua whitelist mới được hiển thị.</span></div>`;
    const loaded = await loadCatalog(options, controller.signal);
    if (activeRuntime !== runtime || controller.signal.aborted) return null;
    runtime.catalog = loaded.items;
    runtime.manifestSource = loaded.source;
    runtime.catalogError = loaded.error;
    runtime.selectedId = runtime.catalog.some((item) => item.id === runtime.state.selectedId) ? runtime.state.selectedId : runtime.catalog[0]?.id || "";
    runtime.state.selectedId = runtime.selectedId;
    updateToolbar(runtime);
    renderCatalog(runtime);
    renderPlayer(runtime, selectedItem(runtime));
    bindEvents(runtime);
    writeState(runtime);
    if (loaded.error) toast(runtime, loaded.error, "warning");
    return Object.freeze({ unmount, inspect, focusSearch });
  }

  function unmount() {
    const runtime = activeRuntime;
    if (!runtime) return false;
    persistCurrentProgress(runtime);
    runtime.video?.pause?.();
    clearPlayerListeners(runtime);
    runtime.controller?.abort?.();
    runtime.listeners.splice(0).forEach((remove) => { try { remove(); } catch (_error) { /* noop */ } });
    globalScope.clearTimeout?.(runtime.toastTimer);
    clearMediaSession();
    runtime.document?.body?.classList.remove("app-cinema-route");
    runtime.host.innerHTML = "";
    activeRuntime = null;
    return true;
  }

  function focusSearch() {
    const input = activeRuntime?.root?.querySelector("[data-cinema-search]");
    if (!input) return false;
    input.focus({ preventScroll: true });
    input.select?.();
    return true;
  }

  function inspect() {
    const runtime = activeRuntime;
    if (!runtime) return { version: VERSION, mounted: false, route: "/cinema", catalogCount: 0 };
    return {
      version: VERSION,
      mounted: true,
      route: "/cinema",
      ownerId: runtime.ownerId,
      manifestSource: runtime.manifestSource,
      catalogError: runtime.catalogError,
      catalogCount: runtime.catalog.length,
      selectedId: runtime.selectedId,
      query: runtime.query,
      filters: { view: runtime.state.view, source: runtime.state.source, license: runtime.state.license, genre: runtime.state.genre, sort: runtime.state.sort },
      favorites: [...runtime.state.favorites],
      historyCount: runtime.state.history.length,
      continueCount: runtime.catalog.filter((item) => isContinuable(runtime, item)).length,
      playback: runtime.video ? { type: "video", paused: runtime.video.paused, currentTime: Number(runtime.video.currentTime) || 0 } : { type: selectedItem(runtime)?.playback?.type || "none", paused: true, currentTime: 0 }
    };
  }

  return Object.freeze({
    VERSION,
    MANIFEST_URL,
    STORAGE_SCHEMA,
    ALLOWED_LICENSES,
    escapeHtml,
    safeUrl,
    formatDuration,
    normalizeState,
    fallbackLicenseAllowed,
    validateCatalogItem,
    normalizeCatalog,
    mount,
    unmount,
    inspect,
    focusSearch
  });
});
