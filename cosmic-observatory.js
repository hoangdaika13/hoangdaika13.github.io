(function initHHCosmicObservatory(global) {
  "use strict";

  const API_BASE = "/api/cosmic";
  const STORAGE_KEY = "hh.cosmic-observatory.settings.v1";
  const DB_NAME = "hh.cosmic-observatory";
  const DB_VERSION = 1;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const LUNAR_DISTANCE_AU = 0.00256955529;
  const AU_KM = 149_597_870.7;
  const VIEW_ALIASES = Object.freeze({
    "solar-system": "solar-system", "live-sky": "live-sky", observatory: "observatory", dsn: "dsn",
    asteroids: "asteroids", surfaces: "surfaces", exoplanets: "exoplanets", earth: "earth",
    "space-weather": "space-weather", timeline: "timeline", learning: "learning", media: "media",
    "universe-map": "universe-map", missions: "missions", tours: "tours", planner: "planner",
    "data-center": "data-center", overview: "overview"
  });
  const VIEWS = Object.freeze({
    overview: { title: "Vũ trụ HH", eyebrow: "HH UNIVERSE", description: "Trung tâm khám phá Hệ Mặt Trời, bầu trời, nhiệm vụ, ngoại hành tinh và dữ liệu khoa học có nguồn." },
    "solar-system": { title: "Hệ Mặt Trời 3D", eyebrow: "MISSION CONTROL", description: "Vị trí thiên thể được tính theo thời gian; tỉ lệ hiển thị luôn được ghi rõ." },
    "live-sky": { title: "Bầu trời tại vị trí của bạn", eyebrow: "LIVE SKY", description: "Bản đồ chân trời tính từ vị trí, ngày giờ và múi giờ thiết bị." },
    observatory: { title: "Đài quan sát", eyebrow: "OBSERVATION STATION", description: "Lập phiên quan sát, lưu mục tiêu, thiết bị và ghi chú khoa học trên thiết bị." },
    dsn: { title: "Liên lạc không gian DSN", eyebrow: "DEEP SPACE NETWORK", description: "Cửa ngõ tới trạng thái liên lạc được NASA/JPL công bố; không tạo tín hiệu trực tuyến giả." },
    surfaces: { title: "Bề mặt hành tinh", eyebrow: "PLANETARY TREK", description: "Khám phá cổng địa hình chính thức và tính khoảng cách bề mặt theo tọa độ đã chọn." },
    "universe-map": { title: "Vũ trụ đa bước sóng", eyebrow: "MULTI-WAVELENGTH", description: "Cửa ngõ tới dữ liệu HiPS và WorldWide Telescope có attribution." },
    missions: { title: "Flight Director", eyebrow: "JPL HORIZONS", description: "Tính và tua vector quỹ đạo từ JPL Horizons; trạng thái nguồn, hệ tọa độ và đơn vị luôn hiển thị rõ." },
    asteroids: { title: "Asteroid Watch", eyebrow: "JPL CNEOS", description: "Các lần tiếp cận gần theo JPL CAD, kèm khoảng cách, tốc độ và độ bất định." },
    exoplanets: { title: "Ngoại hành tinh", eyebrow: "NASA EXOPLANET ARCHIVE", description: "Khám phá các thế giới đã công bố từ NASA Exoplanet Archive." },
    earth: { title: "Trái Đất từ không gian", eyebrow: "EARTH EVENTS", description: "Sự kiện tự nhiên EONET có thời gian cập nhật và nguồn rõ ràng." },
    "space-weather": { title: "Thời tiết không gian", eyebrow: "NASA DONKI", description: "Sự kiện Mặt Trời được phân biệt rõ quan sát và dự báo." },
    timeline: { title: "Dòng thời gian Vũ trụ", eyebrow: "13,8 TỶ NĂM", description: "Khám phá các mốc lớn từ Vũ trụ sơ khai đến Hệ Mặt Trời và hiện tại." },
    learning: { title: "Phòng học thiên văn", eyebrow: "COSMIC LEARNING LAB", description: "Bài học ngắn, câu hỏi kiểm tra và tiến độ được lưu cục bộ." },
    media: { title: "Thư viện NASA", eyebrow: "NASA MEDIA", description: "Tìm ảnh, video và âm thanh, luôn giữ metadata và attribution từng mục." },
    tours: { title: "Hành trình dẫn dắt", eyebrow: "COSMIC TOURS", description: "Các lộ trình khám phá ngắn, không tự phát âm thanh khi chưa được phép." },
    planner: { title: "Lập kế hoạch quan sát", eyebrow: "OBSERVATION PLANNER", description: "Tìm thiên thể có thể quan sát theo vị trí và giờ địa phương." },
    "data-center": { title: "Dữ liệu & ghi công", eyebrow: "TRUST CENTER", description: "Xem nguồn, kiểu dữ liệu, cache, giấy phép và kiểm soát dữ liệu cá nhân." }
  });
  const NAV_ITEMS = Object.freeze([
    ["overview", "Trung tâm", "✦"], ["solar-system", "Hệ Mặt Trời", "◎"], ["live-sky", "Bầu trời", "⌖"],
    ["observatory", "Đài quan sát", "◫"], ["missions", "Nhiệm vụ", "↗"], ["dsn", "DSN", "⌁"],
    ["asteroids", "Tiểu hành tinh", "◆"], ["surfaces", "Bề mặt", "◒"], ["exoplanets", "Ngoại hành tinh", "◉"],
    ["earth", "Trái Đất", "◍"], ["space-weather", "Thời tiết", "☀"], ["timeline", "Dòng thời gian", "⌛"],
    ["learning", "Phòng học", "◇"], ["media", "Media", "▣"], ["universe-map", "Bản đồ sâu", "∞"],
    ["tours", "Tours", "▷"], ["planner", "Kế hoạch", "◫"], ["data-center", "Dữ liệu", "✓"]
  ]);
  const SEARCH_ITEMS = Object.freeze([
    ["solar-system", "Hệ Mặt Trời 3D", "hành tinh mặt trời mặt trăng sao chổi quỹ đạo tua thời gian"],
    ["live-sky", "Bầu trời đêm", "ngôi sao chòm sao vị trí chân trời quan sát tối nay"],
    ["observatory", "Đài quan sát", "kính thiên văn phiên quan sát mục tiêu ghi chú"],
    ["missions", "Nhiệm vụ không gian", "tàu vũ trụ nasa jpl mission flight director"],
    ["dsn", "Liên lạc không gian DSN", "deep space network anten tín hiệu tàu vũ trụ"],
    ["asteroids", "Tiểu hành tinh và sao chổi", "asteroid comet cneos tiếp cận gần trái đất"],
    ["surfaces", "Bề mặt hành tinh", "địa hình mặt trăng sao hỏa đo khoảng cách trek"],
    ["exoplanets", "Ngoại hành tinh", "exoplanet kepler tess hệ sao vùng ở được"],
    ["earth", "Trái Đất từ không gian", "eonet vệ tinh thiên tai khí hậu"],
    ["space-weather", "Thời tiết không gian", "bão mặt trời cme cực quang donki"],
    ["timeline", "Dòng thời gian Vũ trụ", "big bang thiên hà sao hệ mặt trời 13,8 tỷ năm"],
    ["learning", "Phòng học thiên văn", "bài học câu hỏi quiz giáo dục"],
    ["media", "Thư viện ảnh và video", "nasa ảnh video âm thanh thư viện"],
    ["universe-map", "Bản đồ Vũ trụ sâu", "thiên hà tinh vân đa bước sóng hips wwt esasky"],
    ["data-center", "Trung tâm dữ liệu và nguồn", "nguồn ghi công cache xuất nhập riêng tư"]
  ]);
  const PLANETS = Object.freeze([
    { id: "Mercury", vi: "Sao Thủy", color: [0.72, 0.68, 0.62], size: 7, orbit: 0.387 },
    { id: "Venus", vi: "Sao Kim", color: [1, 0.72, 0.34], size: 10, orbit: 0.723 },
    { id: "Earth", vi: "Trái Đất", color: [0.22, 0.68, 1], size: 11, orbit: 1 },
    { id: "Mars", vi: "Sao Hỏa", color: [1, 0.34, 0.18], size: 9, orbit: 1.524 },
    { id: "Jupiter", vi: "Sao Mộc", color: [1, 0.72, 0.5], size: 18, orbit: 5.203 },
    { id: "Saturn", vi: "Sao Thổ", color: [1, 0.88, 0.55], size: 16, orbit: 9.537 },
    { id: "Uranus", vi: "Sao Thiên Vương", color: [0.4, 0.93, 1], size: 13, orbit: 19.19 },
    { id: "Neptune", vi: "Sao Hải Vương", color: [0.25, 0.4, 1], size: 13, orbit: 30.07 },
    { id: "Pluto", vi: "Sao Diêm Vương", color: [0.8, 0.68, 0.58], size: 6, orbit: 39.48 }
  ]);
  const SKY_BODIES = Object.freeze([
    ["Sun", "Mặt Trời", "#ffd268"], ["Moon", "Mặt Trăng", "#e9efff"], ["Mercury", "Sao Thủy", "#b8b2aa"],
    ["Venus", "Sao Kim", "#ffd188"], ["Mars", "Sao Hỏa", "#ff7759"], ["Jupiter", "Sao Mộc", "#ffc995"],
    ["Saturn", "Sao Thổ", "#ffe2a0"], ["Uranus", "Sao Thiên Vương", "#75edf3"], ["Neptune", "Sao Hải Vương", "#728cff"]
  ]);
  const BRIGHT_STARS = Object.freeze([
    ["Sirius", 6.7525, -16.7161, 1.0], ["Canopus", 6.3992, -52.6957, 0.85], ["Arcturus", 14.261, 19.1825, 0.8],
    ["Vega", 18.6156, 38.7837, 0.8], ["Capella", 5.2782, 45.998, 0.72], ["Rigel", 5.2423, -8.2016, 0.7],
    ["Procyon", 7.655, 5.225, 0.66], ["Betelgeuse", 5.9195, 7.4071, 0.65], ["Achernar", 1.6286, -57.2368, 0.62],
    ["Altair", 19.8464, 8.8683, 0.62], ["Aldebaran", 4.5987, 16.5093, 0.58], ["Spica", 13.4199, -11.1613, 0.58],
    ["Antares", 16.4901, -26.432, 0.55], ["Pollux", 7.7553, 28.0262, 0.52], ["Fomalhaut", 22.9608, -29.6222, 0.5],
    ["Polaris", 2.5303, 89.2641, 0.48]
  ]);
  const SOURCES = Object.freeze([
    ["JPL Horizons", "Quỹ đạo và ephemeris", "https://ssd-api.jpl.nasa.gov/doc/horizons.html", "computed"],
    ["JPL CNEOS Close-Approach Data", "Tiếp cận gần tiểu hành tinh/sao chổi", "https://ssd-api.jpl.nasa.gov/doc/cad.html", "observed"],
    ["NASA Image and Video Library", "Ảnh, video và âm thanh", "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf", "observed"],
    ["NASA Exoplanet Archive", "Danh mục ngoại hành tinh TAP", "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html", "observed"],
    ["NASA EONET v3", "Sự kiện tự nhiên Trái Đất", "https://eonet.gsfc.nasa.gov/docs/v3", "observed"],
    ["NASA DONKI", "Sự kiện thời tiết không gian", "https://api.nasa.gov/", "observed"],
    ["Astronomy Engine", "Tính vị trí thiên thể trong trình duyệt", "https://github.com/cosinekitty/astronomy", "computed"],
    ["WorldWide Telescope", "Engine và dữ liệu HiPS", "https://docs.worldwidetelescope.org/webgl-reference/latest/", "observed"]
  ]);

  let active = null;
  let databasePromise = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function safeUrl(value) {
    try { const url = new URL(String(value || ""), location.origin); return url.protocol === "https:" || url.origin === location.origin ? url.toString() : ""; } catch { return ""; }
  }

  function localDay(date = new Date()) {
    const year = date.getFullYear();
    return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function localDateTimeValue(date = new Date()) {
    return `${localDay(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatNumber(value, digits = 2) {
    return Number.isFinite(Number(value)) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(Number(value)) : "Chưa có";
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date) : escapeHtml(value || "Chưa có");
  }

  function foldText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  }

  function getSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" && value.version === 1 ? value : { version: 1 };
    } catch { return { version: 1 }; }
  }

  function saveSettings(patch) {
    const next = { ...getSettings(), ...patch, version: 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function openDatabase() {
    if (!global.indexedDB) return Promise.reject(new Error("IndexedDB không được hỗ trợ."));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
        if (!db.objectStoreNames.contains("bookmarks")) db.createObjectStore("bookmarks", { keyPath: "id" });
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được Cosmic Database."));
    });
    return databasePromise;
  }

  async function dbRead(store, key) {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch { return null; }
  }

  async function dbWrite(store, value) {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).put(value);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      return true;
    } catch { return false; }
  }

  async function dbDelete(store, key) {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).delete(key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      return true;
    } catch { return false; }
  }

  async function dbAll(store) {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error);
      });
    } catch { return []; }
  }

  function registerCleanup(callback) {
    if (active && typeof callback === "function") active.cleanups.push(callback);
    return callback;
  }

  function controller() {
    const instance = new AbortController();
    if (active) active.controllers.add(instance);
    return instance;
  }

  async function fetchCosmic(source, params = {}, options = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== "" && value !== null && value !== undefined) search.set(key, String(value)); });
    const cacheKey = `${source}?${search}`;
    const abortController = options.controller || controller();
    const timeout = setTimeout(() => abortController.abort(), options.timeout || 12_000);
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(source)}?${search}`, { headers: { Accept: "application/json" }, signal: abortController.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Nguồn trả về mã ${response.status}.`);
      if (!SOURCES.some(([name]) => name === payload.sourceName) && !String(payload.sourceName || "").startsWith("NASA DONKI")) throw new Error("Nguồn dữ liệu không nằm trong registry tin cậy.");
      await dbWrite("cache", { key: cacheKey, savedAt: Date.now(), payload });
      return payload;
    } catch (error) {
      const cached = await dbRead("cache", cacheKey);
      if (cached?.payload && Date.now() - Number(cached.savedAt || 0) < (options.maxStaleMs || 24 * 60 * 60_000)) {
        return { ...cached.payload, cacheStatus: "client-stale", staleReason: error.message };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      active?.controllers.delete(abortController);
    }
  }

  function sourceBadge(payload) {
    const stale = String(payload?.cacheStatus || "").includes("stale");
    return `<span class="cosmic-source-badge${stale ? " is-stale" : ""}"><i></i>${escapeHtml(payload?.sourceName || "Chưa có nguồn")} · ${stale ? "cache cũ" : escapeHtml(payload?.dataType || "dữ liệu")}</span>`;
  }

  function notice(host, message, tone = "info") {
    if (!host) return;
    host.innerHTML = `<div class="cosmic-notice is-${escapeHtml(tone)}" role="status">${escapeHtml(message)}</div>`;
  }

  function viewRoute(id) {
    return id === "overview" ? "/universe" : `/universe/${id}`;
  }

  function shellMarkup(view) {
    const meta = VIEWS[view];
    return `<section class="cosmic-observatory" data-cosmic-app data-view="${escapeHtml(view)}">
      <div class="cosmic-space" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="cosmic-topbar">
        <a class="cosmic-brand" href="#/universe" aria-label="Về Trung tâm Vũ trụ HH"><span>✦</span><div><small>HH PLATFORM</small><strong>HH Universe</strong></div></a>
        <nav class="cosmic-quick-nav" aria-label="Không gian thiên văn">${NAV_ITEMS.slice(0, 8).map(([id, label]) => `<a href="#${viewRoute(id)}" class="${id === view ? "is-active" : ""}" ${id === view ? 'aria-current="page"' : ""}>${escapeHtml(label)}</a>`).join("")}</nav>
        <a class="cosmic-data-link" href="#/universe/data-center">Nguồn dữ liệu <span>✓</span></a>
      </header>
      <div class="cosmic-layout">
        <aside class="cosmic-rail" aria-label="Điều hướng Vũ trụ HH">${NAV_ITEMS.map(([id, label, icon]) => `<a href="#${viewRoute(id)}" title="${escapeHtml(label)}" class="${id === view ? "is-active" : ""}" ${id === view ? 'aria-current="page"' : ""}><i>${escapeHtml(icon)}</i><span>${escapeHtml(label)}</span></a>`).join("")}</aside>
        <main class="cosmic-main" tabindex="-1">
          <header class="cosmic-view-heading"><div><span>${escapeHtml(meta.eyebrow)}</span><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.description)}</p></div><div class="cosmic-truth-legend" aria-label="Chú thích kiểu dữ liệu"><span data-kind="observed">Quan sát</span><span data-kind="computed">Tính toán</span><span data-kind="illustrative">Minh họa</span></div></header>
          <div data-cosmic-view-host></div>
        </main>
      </div>
      <div class="cosmic-live-region" aria-live="polite" aria-atomic="true" data-cosmic-live></div>
    </section>`;
  }

  function announce(message) {
    const live = active?.root?.querySelector("[data-cosmic-live]");
    if (live) live.textContent = message;
  }

  function workspaceCard(id, icon, tag, description, status = "Dữ liệu có nguồn") {
    const meta = VIEWS[id];
    return `<a class="cosmic-workspace-card" href="#${viewRoute(id)}"><span class="cosmic-workspace-icon">${icon}</span><div><small>${escapeHtml(tag)}</small><h2>${escapeHtml(meta.title)}</h2><p>${escapeHtml(description)}</p><footer><span><i></i>${escapeHtml(status)}</span><b>Mở →</b></footer></div></a>`;
  }

  async function renderOverview(host) {
    const settings = getSettings();
    const resumeView = settings.lastView && settings.lastView !== "overview" && VIEWS[settings.lastView] ? settings.lastView : "solar-system";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Múi giờ thiết bị";
    host.innerHTML = `<section class="cosmic-hero">
      <div class="cosmic-hero-copy"><span class="cosmic-kicker">HH UNIVERSE · DỮ LIỆU CÓ NGUỒN</span><h2>Bước vào Vũ trụ,<br><em>hiểu điều bạn đang thấy.</em></h2><p>Điều khiển thời gian Hệ Mặt Trời, dựng bầu trời theo vị trí thiết bị và khám phá dữ liệu NASA/JPL với provenance rõ ràng.</p><div><a class="cosmic-primary" href="#${viewRoute(resumeView)}">Tiếp tục khám phá <span>→</span></a></div><small>Điểm đến tiếp theo: ${escapeHtml(VIEWS[resumeView].title)} · Không tạo telemetry hoặc trạng thái trực tuyến giả.</small></div>
      <div class="cosmic-hero-orbit" aria-hidden="true"><div class="cosmic-sun"></div>${[1,2,3,4].map((n) => `<i style="--orbit:${n}"><b></b></i>`).join("")}<span>HH</span></div>
    </section>
    <section class="cosmic-universe-search" aria-label="Tìm kiếm trong Vũ trụ HH">
      <form data-universe-search><label><span>Tìm hành tinh, ngôi sao, nhiệm vụ hoặc công cụ</span><input type="search" name="q" maxlength="80" autocomplete="off" placeholder="Ví dụ: Sao Hỏa, DSN, ngoại hành tinh…"></label><button type="submit">Khám phá</button></form>
      <div class="cosmic-search-results" data-universe-search-results aria-live="polite" hidden></div>
    </section>
    <section class="cosmic-today-grid cosmic-today-grid--command" aria-label="Trung tâm Vũ trụ hôm nay">
      <article><span>BẦU TRỜI TẠI THIẾT BỊ</span><strong>${escapeHtml(new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date()))}</strong><small>${escapeHtml(timeZone)} · <a href="#/universe/live-sky">Mở bản đồ theo vị trí</a></small></article>
      <article><span>TIẾP CẬN GẦN</span><strong data-home-asteroid>Đang kết nối JPL…</strong><small data-home-asteroid-note>Không thay bằng số liệu giả nếu nguồn lỗi.</small></article>
      <article><span>BỘ SƯU TẬP</span><strong data-home-bookmarks>Đang đọc dữ liệu…</strong><small>Bookmark được lưu trong IndexedDB trên thiết bị.</small></article>
      <article><span>HÀNH TRÌNH GẦN NHẤT</span><strong>${escapeHtml(VIEWS[resumeView].title)}</strong><small>${settings.updatedAt ? `Lưu ${formatDate(settings.updatedAt)}` : "Bắt đầu để lưu tiến trình cục bộ."}</small></article>
    </section>
    <section class="cosmic-section-heading"><div><span>15 KHÔNG GIAN CỐT LÕI</span><h2>Chọn cách bạn muốn khám phá</h2></div><a href="#/universe/data-center">Kiểm tra nguồn dữ liệu →</a></section>
    <section class="cosmic-workspace-grid">
      ${workspaceCard("solar-system", "◎", "P0 · COMPUTED", "Xoay, zoom, theo dõi thiên thể và tua thời gian bằng Astronomy Engine.")}
      ${workspaceCard("live-sky", "⌖", "P0 · OBSERVER", "Bản đồ chân trời theo tọa độ, ngày giờ và múi giờ thiết bị.")}
      ${workspaceCard("observatory", "◫", "LOCAL-FIRST", "Lập phiên quan sát, lưu mục tiêu, thiết bị và nhật ký riêng.")}
      ${workspaceCard("missions", "↗", "OFFICIAL SOURCES", "Theo dõi nhiệm vụ qua các cổng chính thức, không dựng telemetry giả.")}
      ${workspaceCard("dsn", "⌁", "NASA/JPL", "Mở trạng thái liên lạc Deep Space Network được nguồn công bố.")}
      ${workspaceCard("asteroids", "◆", "P0 · JPL CNEOS", "Các lần tiếp cận gần từ JPL CAD, không tạo cảnh báo giật gân.")}
      ${workspaceCard("surfaces", "◒", "NASA TREKS", "Chọn thiên thể, mở địa hình chính thức và đo cung bề mặt.")}
      ${workspaceCard("exoplanets", "◉", "P1 · NASA TAP", "Lọc các thế giới ngoài Hệ Mặt Trời theo số đo đã công bố.")}
      ${workspaceCard("earth", "◍", "P1 · EONET", "Theo dõi các sự kiện tự nhiên đang được NASA tổng hợp.")}
      ${workspaceCard("space-weather", "☀", "P1 · DONKI", "Solar flare, CME và bão địa từ có thời gian cập nhật.")}
      ${workspaceCard("timeline", "⌛", "SCIENCE STORY", "Dòng thời gian từ Vũ trụ sơ khai đến hiện tại, kèm nguồn đọc thêm.")}
      ${workspaceCard("learning", "◇", "LEARNING LAB", "Bài học ngắn, quiz có phản hồi và tiến độ cục bộ.")}
      ${workspaceCard("media", "▣", "NASA MEDIA", "Tìm ảnh, video, audio và lưu yêu thích trong IndexedDB.")}
      ${workspaceCard("universe-map", "∞", "WWT / HiPS", "Mở bản đồ bầu trời đa bước sóng bằng công cụ chính thức.")}
      ${workspaceCard("data-center", "✓", "TRUST CENTER", "Nguồn, cache, giấy phép, export/import và dữ liệu cá nhân.")}
    </section>`;
    const searchForm = host.querySelector("[data-universe-search]");
    const searchResults = host.querySelector("[data-universe-search-results]");
    const renderSearch = () => {
      const query = foldText(new FormData(searchForm).get("q"));
      if (!query) { searchResults.hidden = true; searchResults.innerHTML = ""; return []; }
      const matches = SEARCH_ITEMS.filter(([, label, keywords]) => foldText(`${label} ${keywords}`).includes(query)).slice(0, 8);
      searchResults.hidden = false;
      searchResults.innerHTML = matches.length ? matches.map(([id, label]) => `<a href="#${viewRoute(id)}"><span>${escapeHtml(label)}</span><small>${escapeHtml(VIEWS[id].description)}</small><b>→</b></a>`).join("") : '<p>Không tìm thấy không gian phù hợp. Hãy thử “Sao Hỏa”, “DSN” hoặc “ngoại hành tinh”.</p>';
      return matches;
    };
    searchForm.addEventListener("input", renderSearch);
    searchForm.addEventListener("submit", (event) => { event.preventDefault(); const matches = renderSearch(); if (matches.length === 1) location.hash = `#${viewRoute(matches[0][0])}`; });
    const asteroidLabel = host.querySelector("[data-home-asteroid]");
    const asteroidNote = host.querySelector("[data-home-asteroid-note]");
    const bookmarkLabel = host.querySelector("[data-home-bookmarks]");
    const end = new Date(); end.setDate(end.getDate() + 3);
    Promise.allSettled([
      fetchCosmic("asteroids", { start: localDay(), end: localDay(end), distance: 0.1 }),
      dbAll("bookmarks")
    ]).then(([asteroidResult, bookmarkResult]) => {
      if (!active || !host.isConnected) return;
      if (asteroidResult.status === "fulfilled") {
        const records = asteroidResult.value.data?.records || [];
        asteroidLabel.textContent = records.length ? `${records.length} lượt trong 3 ngày` : "Không có lượt trong bộ lọc";
        asteroidNote.innerHTML = `${sourceBadge(asteroidResult.value)} · cập nhật ${formatDate(asteroidResult.value.fetchedAt)}`;
      } else { asteroidLabel.textContent = "JPL tạm thời không phản hồi"; asteroidNote.textContent = asteroidResult.reason?.message || "Hãy thử lại sau."; }
      bookmarkLabel.textContent = bookmarkResult.status === "fulfilled" ? `${bookmarkResult.value.length} mục đã lưu` : "Chưa đọc được bộ sưu tập";
    });
  }

  class SolarRenderer {
    constructor(stage, onSelect) {
      this.stage = stage;
      this.canvas = stage.querySelector("[data-solar-gl]");
      this.overlay = stage.querySelector("[data-solar-overlay]");
      this.ctx = this.overlay.getContext("2d");
      this.gl = this.canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "high-performance" });
      this.onSelect = onSelect;
      this.yaw = -0.38;
      this.pitch = 0.72;
      this.zoom = 1;
      this.points = [];
      this.drag = null;
      this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
      this.resizeObserver?.observe(stage);
      this.windowResize = () => this.resize();
      if (!this.resizeObserver) global.addEventListener("resize", this.windowResize);
      this.resize();
      if (this.gl) {
        try { this.initGl(); }
        catch { this.gl = null; }
      }
      this.bind();
    }

    initGl() {
      const gl = this.gl;
      const vertex = `#version 300 es\nin vec2 a_position;in vec4 a_color;in float a_size;out vec4 v_color;void main(){gl_Position=vec4(a_position,0.0,1.0);gl_PointSize=a_size;v_color=a_color;}`;
      const fragment = `#version 300 es\nprecision mediump float;in vec4 v_color;out vec4 outColor;void main(){outColor=v_color;}`;
      const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
      this.program = gl.createProgram();
      gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(this.program);
      this.buffer = gl.createBuffer();
      this.locations = { position: gl.getAttribLocation(this.program, "a_position"), color: gl.getAttribLocation(this.program, "a_color"), size: gl.getAttribLocation(this.program, "a_size") };
    }

    bind() {
      const down = (event) => { this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch }; this.overlay.setPointerCapture?.(event.pointerId); };
      const move = (event) => {
        if (!this.drag) return;
        this.yaw = this.drag.yaw + (event.clientX - this.drag.x) * 0.006;
        this.pitch = Math.max(0.15, Math.min(1.35, this.drag.pitch + (event.clientY - this.drag.y) * 0.004));
      };
      const up = (event) => {
        if (!this.drag) return;
        const moved = Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y);
        this.drag = null;
        if (moved < 8) {
          const rect = this.overlay.getBoundingClientRect();
          const point = this.points.find((item) => Math.hypot(item.px - (event.clientX - rect.left), item.py - (event.clientY - rect.top)) <= Math.max(14, item.size));
          if (point) this.onSelect?.(point.planet);
        }
      };
      const wheel = (event) => { event.preventDefault(); this.zoom = Math.max(0.55, Math.min(3.5, this.zoom * (event.deltaY > 0 ? 0.9 : 1.1))); };
      this.overlay.addEventListener("pointerdown", down);
      this.overlay.addEventListener("pointermove", move);
      this.overlay.addEventListener("pointerup", up);
      this.overlay.addEventListener("pointercancel", up);
      this.overlay.addEventListener("wheel", wheel, { passive: false });
      this.cleanup = () => {
        this.resizeObserver?.disconnect();
        global.removeEventListener("resize", this.windowResize);
        this.overlay.removeEventListener("pointerdown", down); this.overlay.removeEventListener("pointermove", move); this.overlay.removeEventListener("pointerup", up); this.overlay.removeEventListener("pointercancel", up); this.overlay.removeEventListener("wheel", wheel);
        if (this.gl) { this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
      };
    }

    resize() {
      const rect = this.stage.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      [this.canvas, this.overlay].forEach((canvas) => { canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; });
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    radialScale(radius, mode) {
      if (mode === "scientific") return radius / 40;
      if (mode === "cinematic") return Math.sqrt(radius / 40);
      return Math.log1p(radius * 3) / Math.log1p(120);
    }

    project(vector, mode, rect) {
      const radius = Math.hypot(vector.x, vector.y, vector.z) || 0;
      const scaledRadius = this.radialScale(radius, mode) * Math.min(rect.width, rect.height) * 0.44 * this.zoom;
      const normalized = radius ? { x: vector.x / radius, y: vector.y / radius, z: vector.z / radius } : { x: 0, y: 0, z: 0 };
      const x1 = normalized.x * Math.cos(this.yaw) - normalized.z * Math.sin(this.yaw);
      const z1 = normalized.x * Math.sin(this.yaw) + normalized.z * Math.cos(this.yaw);
      const y1 = normalized.y * Math.cos(this.pitch) - z1 * Math.sin(this.pitch);
      const z2 = normalized.y * Math.sin(this.pitch) + z1 * Math.cos(this.pitch);
      const perspective = 1 / (1 + z2 * 0.18);
      return { x: rect.width / 2 + x1 * scaledRadius * perspective, y: rect.height / 2 + y1 * scaledRadius * perspective, depth: z2 };
    }

    draw(date, mode, selectedId) {
      const rect = this.stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const Astronomy = global.Astronomy;
      const planetData = PLANETS.flatMap((planet) => {
        try { return { planet, vector: Astronomy.HelioVector(Astronomy.Body?.[planet.id] || planet.id, date) }; }
        catch { return []; }
      });
      const projected = planetData.map((item) => ({ ...item, screen: this.project(item.vector, mode, rect) }));
      this.points = projected.map((item) => ({ planet: item.planet, px: item.screen.x, py: item.screen.y, size: item.planet.size }));
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      if (this.gl) this.drawGl(rect, projected, mode);
      else this.drawCanvas(rect, projected, mode);
      this.ctx.font = "600 12px system-ui";
      this.ctx.textBaseline = "middle";
      projected.forEach(({ planet, screen }) => {
        this.ctx.fillStyle = planet.id === selectedId ? "#fff2aa" : "rgba(232,244,255,.86)";
        this.ctx.fillText(planet.vi, screen.x + planet.size + 6, screen.y);
        if (planet.id === selectedId) { this.ctx.strokeStyle = "#ffe36d"; this.ctx.lineWidth = 1.5; this.ctx.beginPath(); this.ctx.arc(screen.x, screen.y, planet.size + 7, 0, Math.PI * 2); this.ctx.stroke(); }
      });
      this.ctx.fillStyle = "#fff1a8"; this.ctx.font = "700 13px system-ui"; this.ctx.fillText("Mặt Trời", rect.width / 2 + 20, rect.height / 2);
    }

    drawGl(rect, projected, mode) {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      const stride = 7 * 4;
      gl.enableVertexAttribArray(this.locations.position); gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.locations.color); gl.vertexAttribPointer(this.locations.color, 4, gl.FLOAT, false, stride, 2 * 4);
      gl.enableVertexAttribArray(this.locations.size); gl.vertexAttribPointer(this.locations.size, 1, gl.FLOAT, false, stride, 6 * 4);
      const toClip = (point) => [point.x / rect.width * 2 - 1, 1 - point.y / rect.height * 2];
      PLANETS.forEach((planet) => {
        const vertices = [];
        for (let index = 0; index <= 100; index += 1) {
          const angle = index / 100 * Math.PI * 2;
          const point = this.project({ x: Math.cos(angle) * planet.orbit, y: 0, z: Math.sin(angle) * planet.orbit }, mode, rect);
          vertices.push(...toClip(point), 0.28, 0.5, 0.78, 0.38, 1);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW); gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 7);
      });
      const bodies = [0, 0, 1, 0.76, 0.2, 1, 28];
      projected.forEach(({ planet, screen }) => bodies.push(...toClip(screen), ...planet.color, 0.98, planet.size * Math.min(2, global.devicePixelRatio || 1)));
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bodies), gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, bodies.length / 7);
    }

    drawCanvas(rect, projected, mode) {
      const ctx = this.ctx;
      PLANETS.forEach((planet) => {
        ctx.strokeStyle = "rgba(96,170,240,.24)"; ctx.beginPath();
        for (let index = 0; index <= 100; index += 1) {
          const angle = index / 100 * Math.PI * 2;
          const point = this.project({ x: Math.cos(angle) * planet.orbit, y: 0, z: Math.sin(angle) * planet.orbit }, mode, rect);
          if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      });
      ctx.fillStyle = "#ffd84f"; ctx.shadowColor = "#ffb300"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(rect.width / 2, rect.height / 2, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      projected.forEach(({ planet, screen }) => { ctx.fillStyle = `rgb(${planet.color.map((value) => Math.round(value * 255)).join(",")})`; ctx.beginPath(); ctx.arc(screen.x, screen.y, Math.max(3, planet.size / 2), 0, Math.PI * 2); ctx.fill(); });
    }
  }

  function renderSolarSystem(host) {
    if (!global.Astronomy?.HelioVector) return notice(host, "Astronomy Engine chưa tải được; không dùng quỹ đạo giả để thay thế.", "error");
    const engine = global.HHUniverseSolar3D;
    if (!engine?.mount || !engine?.getState || !engine?.unmount) return renderLegacySolarSystem(host);
    const saved = getSettings();
    const simulationDate = saved.solarDate ? new Date(saved.solarDate) : new Date();
    const safeDate = Number.isFinite(simulationDate.getTime()) ? simulationDate : new Date();
    const selectedBody = String(saved.solarTarget || "earth").toLowerCase();
    const quality = ["low", "medium", "high"].includes(saved.solarQuality) ? saved.solarQuality : "medium";
    try {
      engine.mount(host, {
        astronomy: global.Astronomy,
        time: safeDate,
        selectedBody,
        quality,
        playing: false,
        labels: saved.solarLabels !== false,
        speed: Number(saved.solarSpeed || 1),
        scaleMode: saved.solarScale,
        camera: saved.solarCamera
      });
    } catch (error) {
      engine.unmount?.();
      console.warn("HH Universe Solar 3D could not mount; using the local compatibility renderer.", error);
      return renderLegacySolarSystem(host);
    }
    const persist = () => {
      const state = engine.getState();
      if (!state?.mounted) return;
      saveSettings({
        solarDate: state.time instanceof Date && Number.isFinite(state.time.getTime()) ? state.time.toISOString() : safeDate.toISOString(),
        solarTarget: state.selectedBody,
        solarSpeed: state.speed,
        solarScale: state.scaleMode,
        solarQuality: state.quality,
        solarLabels: state.labels,
        solarCamera: state.camera
      });
    };
    const saveWhenHidden = () => { if (document.hidden) persist(); };
    document.addEventListener("visibilitychange", saveWhenHidden);
    registerCleanup(() => {
      document.removeEventListener("visibilitychange", saveWhenHidden);
      persist();
      engine.unmount();
    });
  }

  function renderLegacySolarSystem(host) {
    if (!global.Astronomy?.HelioVector) return notice(host, "Astronomy Engine chưa tải được; không dùng quỹ đạo giả để thay thế.", "error");
    const saved = getSettings();
    let simulationDate = saved.solarDate ? new Date(saved.solarDate) : new Date();
    if (!Number.isFinite(simulationDate.getTime())) simulationDate = new Date();
    let speed = Number(saved.solarSpeed || 1);
    let scaleMode = ["scientific", "educational", "cinematic"].includes(saved.solarScale) ? saved.solarScale : "educational";
    let selected = PLANETS.find((item) => item.id.toLowerCase() === String(saved.solarTarget || "Earth").toLowerCase())?.id || "Earth";
    let paused = true;
    host.innerHTML = `<section class="cosmic-control-deck">
      <div class="cosmic-toolbar" aria-label="Điều khiển mô phỏng"><button type="button" data-solar-play aria-pressed="false">▶ Tiếp tục</button><label>Ngày giờ thiết bị<input type="datetime-local" data-solar-date value="${localDateTimeValue(simulationDate)}"></label><button type="button" data-solar-now>Về hiện tại</button><label>Tốc độ<select data-solar-speed>${[1,10,100,1000].map((value) => `<option value="${value}" ${value === speed ? "selected" : ""}>${value}×</option>`).join("")}</select></label><label>Tỉ lệ<select data-solar-scale><option value="scientific" ${scaleMode === "scientific" ? "selected" : ""}>Khoa học</option><option value="educational" ${scaleMode === "educational" ? "selected" : ""}>Giáo dục</option><option value="cinematic" ${scaleMode === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label></div>
      <div class="cosmic-solar-grid"><div class="cosmic-solar-stage" data-solar-stage tabindex="0" aria-label="Mô hình Hệ Mặt Trời. Kéo để xoay, lăn để zoom, bấm vào hành tinh để xem thông tin."><canvas data-solar-gl aria-hidden="true"></canvas><canvas data-solar-overlay></canvas><div class="cosmic-stage-labels"><span data-kind="computed">Vị trí tính toán</span><span data-kind="illustrative">Kích thước hiển thị minh họa</span><b data-renderer-label>WebGL2</b></div></div><aside class="cosmic-inspector" data-solar-inspector></aside></div>
      <footer class="cosmic-provenance"><div>${sourceBadge({ sourceName: "Astronomy Engine", dataType: "computed" })}<span data-solar-time></span></div><p>Vị trí nhật tâm được tính trong trình duyệt. Bán kính điểm, màu và tỉ lệ giáo dục/điện ảnh là minh họa; chế độ khoa học giữ quan hệ khoảng cách theo AU.</p></footer>
    </section>`;
    const stage = host.querySelector("[data-solar-stage]");
    const timeLabel = host.querySelector("[data-solar-time]");
    const inspector = host.querySelector("[data-solar-inspector]");
    const renderer = new SolarRenderer(stage, (planet) => { selected = planet.id; saveSettings({ solarTarget: selected }); updateInspector(); });
    host.querySelector("[data-renderer-label]").textContent = renderer.gl ? "WebGL2" : "Canvas Lite";
    const updateInspector = () => {
      const planet = PLANETS.find((item) => item.id === selected) || PLANETS[2];
      let vector;
      try { vector = global.Astronomy.HelioVector(global.Astronomy.Body?.[planet.id] || planet.id, simulationDate); } catch { vector = null; }
      const distance = vector ? Math.hypot(vector.x, vector.y, vector.z) : NaN;
      inspector.innerHTML = `<span>ĐANG THEO DÕI</span><h2>${escapeHtml(planet.vi)}</h2><small>${escapeHtml(planet.id)}</small><dl><div><dt>Khoảng cách tới Mặt Trời</dt><dd>${formatNumber(distance, 4)} AU</dd></div><div><dt>Ước đổi</dt><dd>${formatNumber(distance * AU_KM, 0)} km</dd></div><div><dt>Bán trục lớn tham chiếu</dt><dd>${formatNumber(planet.orbit, 3)} AU</dd></div><div><dt>Kiểu dữ liệu</dt><dd>Tính toán</dd></div></dl><p>Khoảng cách tức thời được tính từ vector nhật tâm; giao diện không gọi API ở từng frame.</p>`;
    };
    updateInspector();
    let previous = performance.now();
    let raf = 0;
    const frame = (now) => {
      const delta = Math.min(100, now - previous); previous = now;
      if (!paused && !document.hidden) simulationDate = new Date(simulationDate.getTime() + delta * speed * 86.4);
      renderer.draw(simulationDate, scaleMode, selected);
      timeLabel.textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium" }).format(simulationDate);
      if (!paused && Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)) updateInspector();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const play = host.querySelector("[data-solar-play]");
    play.addEventListener("click", () => { paused = !paused; play.setAttribute("aria-pressed", String(!paused)); play.textContent = paused ? "▶ Tiếp tục" : "Ⅱ Tạm dừng"; announce(paused ? "Đã tạm dừng thời gian" : "Đang chạy thời gian mô phỏng"); });
    host.querySelector("[data-solar-now]").addEventListener("click", () => { simulationDate = new Date(); host.querySelector("[data-solar-date]").value = localDateTimeValue(simulationDate); updateInspector(); });
    host.querySelector("[data-solar-date]").addEventListener("change", (event) => { const next = new Date(event.target.value); if (Number.isFinite(next.getTime())) { simulationDate = next; saveSettings({ solarDate: simulationDate.toISOString() }); updateInspector(); } });
    host.querySelector("[data-solar-speed]").addEventListener("change", (event) => { speed = Number(event.target.value) || 1; saveSettings({ solarSpeed: speed }); });
    host.querySelector("[data-solar-scale]").addEventListener("change", (event) => { scaleMode = event.target.value; saveSettings({ solarScale: scaleMode }); announce(`Đã chuyển sang tỉ lệ ${event.target.selectedOptions[0].textContent}`); });
    registerCleanup(() => { cancelAnimationFrame(raf); renderer.cleanup?.(); });
  }

  function skyPoint(azimuth, altitude, rect) {
    const radius = Math.min(rect.width, rect.height) * 0.43;
    const radial = Math.max(0, Math.min(1.08, (90 - altitude) / 90)) * radius;
    const angle = (azimuth - 90) * Math.PI / 180;
    return { x: rect.width / 2 + Math.cos(angle) * radial, y: rect.height / 2 + Math.sin(angle) * radial, inside: altitude >= 0 };
  }

  function renderLiveSky(host, plannerMode = false) {
    if (!global.Astronomy?.Equator) return notice(host, "Astronomy Engine chưa tải được; không dựng bản đồ bầu trời bằng dữ liệu giả.", "error");
    const settings = getSettings();
    let latitude = Number.isFinite(Number(settings.latitude)) ? Number(settings.latitude) : 10.8231;
    let longitude = Number.isFinite(Number(settings.longitude)) ? Number(settings.longitude) : 106.6297;
    let date = new Date();
    let nightMode = Boolean(settings.nightMode);
    host.innerHTML = `<section class="cosmic-sky-shell${nightMode ? " is-night-mode" : ""}">
      <div class="cosmic-toolbar"><label>Vĩ độ<input type="number" min="-90" max="90" step="0.0001" value="${latitude}" data-sky-lat></label><label>Kinh độ<input type="number" min="-180" max="180" step="0.0001" value="${longitude}" data-sky-lon></label><button type="button" data-sky-location>⌖ Dùng vị trí của tôi</button><label>Ngày giờ<input type="datetime-local" value="${localDateTimeValue(date)}" data-sky-date></label><button type="button" data-sky-night aria-pressed="${nightMode}">Night Mode</button><button type="button" data-sky-fullscreen>Toàn màn hình</button></div>
      <div class="cosmic-sky-grid"><div class="cosmic-sky-stage" data-sky-stage><canvas data-sky-canvas role="img" aria-label="Bản đồ chân trời có lưới phương vị và các thiên thể đang ở trên đường chân trời"></canvas><div class="cosmic-stage-labels"><span data-kind="computed">Altitude/Azimuth tính toán</span><span data-kind="illustrative">Kích thước điểm minh họa</span></div></div><aside class="cosmic-sky-list"><header><span>${plannerMode ? "KẾ HOẠCH QUAN SÁT" : "TRÊN ĐƯỜNG CHÂN TRỜI"}</span><h2 data-sky-location-label>${formatNumber(latitude, 4)}°, ${formatNumber(longitude, 4)}°</h2></header><div data-sky-list></div></aside></div>
      <footer class="cosmic-provenance"><div>${sourceBadge({ sourceName: "Astronomy Engine", dataType: "computed" })}<span data-sky-time></span></div><p>Tọa độ hành tinh được tính cho vị trí và thời gian đã chọn. Tọa độ sao sáng là catalogue J2000 tích hợp; kích thước điểm là minh họa.</p></footer>
    </section>`;
    const canvas = host.querySelector("[data-sky-canvas]");
    const stage = host.querySelector("[data-sky-stage]");
    const ctx = canvas.getContext("2d");
    const list = host.querySelector("[data-sky-list]");
    const resize = () => { const rect = stage.getBoundingClientRect(); const dpr = Math.min(2, global.devicePixelRatio || 1); canvas.width = Math.max(1, rect.width * dpr); canvas.height = Math.max(1, rect.height * dpr); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); };
    const calculateBodies = () => {
      const observer = new global.Astronomy.Observer(latitude, longitude, 0);
      return SKY_BODIES.map(([id, vi, color]) => {
        try {
          const equator = global.Astronomy.Equator(global.Astronomy.Body?.[id] || id, date, observer, true, true);
          const horizon = global.Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");
          return { id, vi, color, altitude: horizon.altitude, azimuth: horizon.azimuth, ra: equator.ra, dec: equator.dec };
        } catch { return null; }
      }).filter(Boolean);
    };
    const draw = () => {
      const rect = stage.getBoundingClientRect(); if (!rect.width) return;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const radius = Math.min(rect.width, rect.height) * 0.43; const cx = rect.width / 2; const cy = rect.height / 2;
      const skyGradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, radius); skyGradient.addColorStop(0, nightMode ? "#220006" : "#091b45"); skyGradient.addColorStop(1, nightMode ? "#050001" : "#020612");
      ctx.fillStyle = skyGradient; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = nightMode ? "rgba(255,70,70,.25)" : "rgba(116,196,255,.22)"; ctx.lineWidth = 1;
      [30, 60, 90].forEach((alt) => { const r = (90 - alt) / 90 * radius; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
      for (let az = 0; az < 360; az += 30) { const angle = (az - 90) * Math.PI / 180; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius); ctx.stroke(); }
      ctx.fillStyle = nightMode ? "#ff7a7a" : "#d9efff"; ctx.font = "700 12px system-ui"; [[0,"B"],[90,"Đ"],[180,"N"],[270,"T"]].forEach(([az,label]) => { const point = skyPoint(az, 0, rect); ctx.fillText(label, point.x - 4, point.y + 4); });
      const observer = new global.Astronomy.Observer(latitude, longitude, 0);
      BRIGHT_STARS.forEach(([name, ra, dec, brightness]) => {
        try { const horizon = global.Astronomy.Horizon(date, observer, ra, dec, "normal"); if (horizon.altitude < 0) return; const point = skyPoint(horizon.azimuth, horizon.altitude, rect); ctx.fillStyle = nightMode ? `rgba(255,100,100,${brightness})` : `rgba(235,247,255,${brightness})`; ctx.beginPath(); ctx.arc(point.x, point.y, 1.2 + brightness * 1.6, 0, Math.PI * 2); ctx.fill(); if (brightness > .7) { ctx.font = "500 10px system-ui"; ctx.fillText(name, point.x + 5, point.y - 4); } } catch {}
      });
      const bodies = calculateBodies();
      bodies.filter((body) => body.altitude >= 0).forEach((body) => { const point = skyPoint(body.azimuth, body.altitude, rect); ctx.shadowColor = body.color; ctx.shadowBlur = 16; ctx.fillStyle = nightMode ? "#ff5555" : body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.id === "Sun" || body.id === "Moon" ? 7 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = nightMode ? "#ff8c8c" : "#fff"; ctx.font = "600 11px system-ui"; ctx.fillText(body.vi, point.x + 9, point.y); });
      const visible = bodies.filter((body) => body.altitude >= 0).sort((a, b) => b.altitude - a.altitude);
      list.innerHTML = visible.map((body) => `<article><i style="--body-color:${escapeHtml(body.color)}"></i><div><strong>${escapeHtml(body.vi)}</strong><small>${formatNumber(body.altitude, 1)}° cao · phương vị ${formatNumber(body.azimuth, 1)}°</small></div><span>${body.altitude >= 30 ? "Tốt" : "Thấp"}</span></article>`).join("") || '<div class="cosmic-empty">Không có hành tinh chính trên đường chân trời trong thời điểm đã chọn.</div>';
      host.querySelector("[data-sky-time]").textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium", timeZoneName: "short" }).format(date);
      host.querySelector("[data-sky-location-label]").textContent = `${formatNumber(latitude, 4)}°, ${formatNumber(longitude, 4)}°`;
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(stage);
    if (!observer) global.addEventListener("resize", resize);
    registerCleanup(() => { observer?.disconnect(); global.removeEventListener("resize", resize); });
    host.querySelector("[data-sky-lat]").addEventListener("change", (event) => { latitude = Math.max(-90, Math.min(90, Number(event.target.value) || 0)); saveSettings({ latitude }); draw(); });
    host.querySelector("[data-sky-lon]").addEventListener("change", (event) => { longitude = Math.max(-180, Math.min(180, Number(event.target.value) || 0)); saveSettings({ longitude }); draw(); });
    host.querySelector("[data-sky-date]").addEventListener("change", (event) => { const next = new Date(event.target.value); if (Number.isFinite(next.getTime())) { date = next; draw(); } });
    host.querySelector("[data-sky-night]").addEventListener("click", (event) => { nightMode = !nightMode; event.currentTarget.setAttribute("aria-pressed", String(nightMode)); host.firstElementChild.classList.toggle("is-night-mode", nightMode); saveSettings({ nightMode }); draw(); });
    host.querySelector("[data-sky-fullscreen]").addEventListener("click", () => stage.requestFullscreen?.().catch(() => announce("Trình duyệt không cho phép toàn màn hình.")));
    host.querySelector("[data-sky-location]").addEventListener("click", () => {
      if (!navigator.geolocation) return announce("Thiết bị không hỗ trợ định vị.");
      announce("Đang xin quyền vị trí…");
      navigator.geolocation.getCurrentPosition((position) => { latitude = position.coords.latitude; longitude = position.coords.longitude; host.querySelector("[data-sky-lat]").value = latitude.toFixed(4); host.querySelector("[data-sky-lon]").value = longitude.toFixed(4); saveSettings({ latitude, longitude }); draw(); announce("Đã cập nhật bầu trời theo vị trí thiết bị."); }, (error) => announce(`Không lấy được vị trí: ${error.message}`), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
    });
    resize();
  }

  async function renderAsteroids(host) {
    const end = new Date(); end.setDate(end.getDate() + 7);
    host.innerHTML = `<section class="cosmic-data-workspace"><form class="cosmic-filter-bar" data-asteroid-form><label>Từ ngày<input type="date" name="start" value="${localDay()}"></label><label>Đến ngày<input type="date" name="end" value="${localDay(end)}"></label><label>Khoảng cách tối đa<select name="distance"><option value="0.05">0,05 AU</option><option value="0.1">0,10 AU</option><option value="0.2" selected>0,20 AU</option><option value="0.5">0,50 AU</option></select></label><button class="cosmic-primary" type="submit">Cập nhật từ JPL</button></form><div class="cosmic-result-meta" data-asteroid-meta></div><div data-asteroid-results><div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div></div></section>`;
    const form = host.querySelector("[data-asteroid-form]");
    const results = host.querySelector("[data-asteroid-results]");
    const meta = host.querySelector("[data-asteroid-meta]");
    const load = async () => {
      const data = Object.fromEntries(new FormData(form));
      results.innerHTML = `<div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div>`;
      try {
        const payload = await fetchCosmic("asteroids", data);
        if (!host.isConnected) return;
        const records = payload.data?.records || [];
        meta.innerHTML = `<div>${sourceBadge(payload)}<strong>${records.length} lượt tiếp cận</strong><span>Cập nhật ${formatDate(payload.fetchedAt)}</span></div><p>“Tiếp cận gần” không đồng nghĩa sắp va chạm. JPL CAD không cung cấp cờ nguy hiểm trong feed này.</p>`;
        results.innerHTML = records.length ? `<div class="cosmic-asteroid-grid">${records.map((item) => {
          const lunar = item.distanceAu / LUNAR_DISTANCE_AU;
          const uncertainty = Number.isFinite(item.distanceMaxAu) && Number.isFinite(item.distanceMinAu) ? Math.abs(item.distanceMaxAu - item.distanceMinAu) : NaN;
          return `<article><header><span>${escapeHtml(item.designation)}</span><small>${escapeHtml(item.orbitReference || "Không có orbit id")}</small></header><h2>${escapeHtml(item.name)}</h2><time>${escapeHtml(item.closeApproach)}</time><dl><div><dt>Khoảng cách</dt><dd>${formatNumber(item.distanceAu, 6)} AU</dd></div><div><dt>Lunar distance</dt><dd>${formatNumber(lunar, 2)} LD</dd></div><div><dt>Tốc độ tương đối</dt><dd>${formatNumber(item.relativeVelocityKps, 2)} km/s</dd></div><div><dt>Đường kính</dt><dd>${Number.isFinite(item.diameterKm) ? `${formatNumber(item.diameterKm, 3)} km` : "Chưa có"}</dd></div><div><dt>Biên khoảng cách</dt><dd>${Number.isFinite(uncertainty) ? `±${formatNumber(uncertainty / 2, 7)} AU` : "Nguồn không cung cấp"}</dd></div></dl><footer><span data-kind="observed">JPL CAD</span><a href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(item.designation)}" target="_blank" rel="noopener">Xem SBDB ↗</a></footer></article>`;
        }).join("")}</div>` : '<div class="cosmic-empty">Không có lượt tiếp cận trong phạm vi đã chọn. Đây là kết quả thật của bộ lọc, không phải lỗi.</div>';
        announce(`Đã tải ${records.length} lượt tiếp cận từ JPL.`);
      } catch (error) { meta.innerHTML = ""; notice(results, error.message, "error"); }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
    load();
  }

  function openMediaDialog(item, trigger) {
    const existing = document.querySelector("[data-cosmic-media-dialog]"); existing?.remove();
    const dialog = document.createElement("dialog"); dialog.className = "cosmic-media-dialog"; dialog.dataset.cosmicMediaDialog = "";
    const image = safeUrl(item.previewUrl);
    dialog.innerHTML = `<form method="dialog"><button aria-label="Đóng">×</button></form>${image ? `<img src="${escapeHtml(image)}" alt="">` : '<div class="cosmic-media-placeholder">NASA</div>'}<div><span>${escapeHtml(item.mediaType || "media")} · ${escapeHtml(item.center || "NASA")}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description || "Nguồn không cung cấp mô tả.")}</p><dl><div><dt>NASA ID</dt><dd>${escapeHtml(item.nasaId)}</dd></div><div><dt>Ngày tạo</dt><dd>${formatDate(item.dateCreated)}</dd></div><div><dt>Tác giả</dt><dd>${escapeHtml(item.photographer || "Chưa được nguồn ghi")}</dd></div></dl><footer><button type="button" data-media-favorite>☆ Lưu yêu thích</button><a href="https://images.nasa.gov/details/${encodeURIComponent(item.nasaId)}" target="_blank" rel="noopener">Mở tại NASA ↗</a></footer></div>`;
    document.body.append(dialog); dialog.showModal(); dialog.querySelector("[data-media-favorite]").addEventListener("click", async (event) => { await dbWrite("bookmarks", { id: `media:${item.nasaId}`, type: "media", savedAt: Date.now(), item }); event.currentTarget.textContent = "★ Đã lưu"; announce(`Đã lưu ${item.title}.`); });
    dialog.addEventListener("close", () => { dialog.remove(); trigger?.focus?.(); }, { once: true });
    dialog.addEventListener("cancel", () => setTimeout(() => trigger?.focus?.(), 0), { once: true });
  }

  async function renderMedia(host) {
    host.innerHTML = `<section class="cosmic-data-workspace"><form class="cosmic-filter-bar cosmic-media-search" data-media-form><label class="is-wide">Tìm trong NASA Media<input name="q" type="search" value="nebula" maxlength="100" placeholder="Ví dụ: Mars, nebula, Apollo…"></label><label>Loại<select name="type"><option value="">Tất cả</option><option value="image" selected>Ảnh</option><option value="video">Video</option><option value="audio">Âm thanh</option></select></label><button class="cosmic-primary" type="submit">Tìm từ NASA</button><button type="button" data-media-saved>Đã lưu</button></form><div class="cosmic-result-meta" data-media-meta></div><div data-media-results><div class="cosmic-skeleton-grid">${"<i></i>".repeat(8)}</div></div></section>`;
    const form = host.querySelector("[data-media-form]"); const results = host.querySelector("[data-media-results]"); const meta = host.querySelector("[data-media-meta]");
    const renderItems = (items, payload = null) => {
      meta.innerHTML = payload ? `<div>${sourceBadge(payload)}<strong>${formatNumber(payload.data?.totalHits, 0)} kết quả cho “${escapeHtml(payload.data?.query)}”</strong><span>Cập nhật ${formatDate(payload.fetchedAt)}</span></div><p>Quyền sử dụng phải được kiểm tra theo từng mục; HH giữ nguyên NASA ID và attribution.</p>` : `<div><span class="cosmic-source-badge"><i></i>IndexedDB cục bộ</span><strong>${items.length} mục đã lưu</strong></div>`;
      results.innerHTML = items.length ? `<div class="cosmic-media-grid">${items.map((item, index) => { const image = safeUrl(item.previewUrl); return `<button type="button" data-media-index="${index}">${image ? `<img loading="lazy" decoding="async" src="${escapeHtml(image)}" alt="">` : '<span class="cosmic-media-placeholder">NASA</span>'}<div><small>${escapeHtml(item.mediaType || "media")} · ${escapeHtml(item.center || "NASA")}</small><strong>${escapeHtml(item.title)}</strong><span>${item.dateCreated ? formatDate(item.dateCreated) : "Không ghi ngày"}</span></div></button>`; }).join("")}</div>` : '<div class="cosmic-empty">Không có nội dung phù hợp. Hãy đổi từ khóa hoặc loại media.</div>';
      results.querySelectorAll("[data-media-index]").forEach((button) => button.addEventListener("click", () => openMediaDialog(items[Number(button.dataset.mediaIndex)], button)));
    };
    const load = async () => {
      const data = Object.fromEntries(new FormData(form)); results.innerHTML = `<div class="cosmic-skeleton-grid">${"<i></i>".repeat(8)}</div>`;
      try { const payload = await fetchCosmic("media", data); if (host.isConnected) { renderItems(payload.data?.items || [], payload); announce(`Đã tải kết quả NASA Media cho ${payload.data?.query}.`); } }
      catch (error) { meta.innerHTML = ""; notice(results, error.message, "error"); }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
    host.querySelector("[data-media-saved]").addEventListener("click", async () => { const saved = await dbAll("bookmarks"); renderItems(saved.filter((item) => item.type === "media").map((entry) => entry.item)); });
    load();
  }

  async function renderExoplanets(host) {
    host.innerHTML = `<section class="cosmic-data-workspace"><form class="cosmic-filter-bar" data-exo-form><label class="is-wide">Tên hành tinh, hệ sao hoặc phương pháp<input type="search" name="q" maxlength="80" placeholder="Ví dụ: TOI, transit, Kepler"></label><button class="cosmic-primary" type="submit">Tra NASA Archive</button></form><div class="cosmic-result-meta" data-exo-meta></div><div data-exo-results><div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div></div></section>`;
    const form = host.querySelector("[data-exo-form]"); const meta = host.querySelector("[data-exo-meta]"); const results = host.querySelector("[data-exo-results]");
    const load = async () => { results.innerHTML = `<div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div>`; try { const payload = await fetchCosmic("exoplanets", Object.fromEntries(new FormData(form)), { maxStaleMs: 7 * 24 * 60 * 60_000 }); const records = payload.data?.records || []; meta.innerHTML = `<div>${sourceBadge(payload)}<strong>${records.length} kết quả</strong><span>${formatDate(payload.fetchedAt)}</span></div><p>Giá trị “Chưa có” được giữ nguyên; HH không tự suy diễn số đo còn thiếu.</p>`; results.innerHTML = records.length ? `<div class="cosmic-exoplanet-grid">${records.map((item) => `<article><span>${escapeHtml(item.discoveryMethod || "Chưa rõ phương pháp")}</span><h2>${escapeHtml(item.name)}</h2><small>Hệ ${escapeHtml(item.host || "chưa ghi")} · ${Number.isFinite(item.discoveryYear) ? item.discoveryYear : "chưa ghi năm"}</small><dl><div><dt>Bán kính</dt><dd>${formatNumber(item.radiusEarth, 2)} R⊕</dd></div><div><dt>Khối lượng</dt><dd>${formatNumber(item.massEarth, 2)} M⊕</dd></div><div><dt>Chu kỳ</dt><dd>${formatNumber(item.orbitalPeriodDays, 2)} ngày</dd></div><div><dt>Nhiệt độ cân bằng</dt><dd>${formatNumber(item.equilibriumTemperatureK, 0)} K</dd></div></dl><footer><span data-kind="observed">CATALOGUE</span><small>Không khẳng định có sự sống</small></footer></article>`).join("")}</div>` : '<div class="cosmic-empty">Không tìm thấy kết quả trong batch mới nhất.</div>'; } catch (error) { meta.innerHTML = ""; notice(results, error.message, "error"); } };
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); }); load();
  }

  async function renderEarth(host) {
    host.innerHTML = `<section class="cosmic-data-workspace"><div class="cosmic-earth-hero"><div class="cosmic-earth-globe" aria-hidden="true"><i></i></div><div><span>NASA EONET V3</span><h2>Sự kiện tự nhiên đang mở</h2><p>EONET là bộ tổng hợp sự kiện và có thể cập nhật sau khi sự kiện bắt đầu; đây không phải camera trực tiếp.</p><button type="button" class="cosmic-primary" data-earth-refresh>Cập nhật</button></div></div><div class="cosmic-result-meta" data-earth-meta></div><div data-earth-results><div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div></div></section>`;
    const meta = host.querySelector("[data-earth-meta]"); const results = host.querySelector("[data-earth-results]");
    const load = async () => { results.innerHTML = `<div class="cosmic-skeleton-grid">${"<i></i>".repeat(6)}</div>`; try { const payload = await fetchCosmic("earth-events", { status: "open", limit: 60 }); const events = payload.data?.events || []; meta.innerHTML = `<div>${sourceBadge(payload)}<strong>${events.length} sự kiện mở</strong><span>${formatDate(payload.fetchedAt)}</span></div>`; results.innerHTML = events.length ? `<div class="cosmic-event-grid">${events.map((event) => { const latest = event.geometry?.at(-1); const coordinates = latest?.coordinates || []; return `<article><span>${escapeHtml(event.categories?.[0]?.title || "Sự kiện tự nhiên")}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.description || "EONET không cung cấp mô tả chi tiết trong bản ghi này.")}</p><footer><time>${latest?.date ? formatDate(latest.date) : "Chưa có thời gian"}</time><small>${coordinates.length >= 2 ? `${formatNumber(coordinates[1], 3)}°, ${formatNumber(coordinates[0], 3)}°` : "Không có tọa độ điểm"}</small></footer></article>`; }).join("")}</div>` : '<div class="cosmic-empty">EONET không trả về sự kiện mở trong lần cập nhật này.</div>'; } catch (error) { meta.innerHTML = ""; notice(results, error.message, "error"); } };
    host.querySelector("[data-earth-refresh]").addEventListener("click", load); load();
  }

  async function renderSpaceWeather(host) {
    const end = localDay(); const startDate = new Date(); startDate.setDate(startDate.getDate() - 14);
    host.innerHTML = `<section class="cosmic-data-workspace"><form class="cosmic-filter-bar" data-weather-form><label>Loại sự kiện<select name="type"><option value="FLR">Solar flare</option><option value="CME">CME</option><option value="GST">Geomagnetic storm</option><option value="SEP">Solar energetic particle</option></select></label><label>Từ ngày<input type="date" name="start" value="${localDay(startDate)}"></label><label>Đến ngày<input type="date" name="end" value="${end}"></label><button type="submit" class="cosmic-primary">Tra DONKI</button></form><div class="cosmic-result-meta" data-weather-meta></div><div data-weather-results><div class="cosmic-skeleton-grid">${"<i></i>".repeat(5)}</div></div></section>`;
    const form = host.querySelector("[data-weather-form]"); const meta = host.querySelector("[data-weather-meta]"); const results = host.querySelector("[data-weather-results]");
    const load = async () => { results.innerHTML = `<div class="cosmic-skeleton-grid">${"<i></i>".repeat(5)}</div>`; try { const payload = await fetchCosmic("space-weather", Object.fromEntries(new FormData(form))); const records = payload.data?.records || []; meta.innerHTML = `<div>${sourceBadge(payload)}<strong>${records.length} sự kiện ${escapeHtml(payload.data?.type)}</strong><span>${formatDate(payload.fetchedAt)}</span></div><p>DONKI có thể hiệu chỉnh sự kiện sau khi công bố; HH không suy diễn cảnh báo cá nhân.</p>`; results.innerHTML = records.length ? `<div class="cosmic-event-grid">${records.map((item) => `<article><span>${escapeHtml(payload.data?.type)}</span><h2>${escapeHtml(item.classType || item.id || "Sự kiện DONKI")}</h2><p>${escapeHtml(item.sourceLocation || "Nguồn không ghi vị trí hoạt động")}</p><footer><time>${item.beginTime ? formatDate(item.beginTime) : "Chưa có giờ bắt đầu"}</time>${safeUrl(item.link) ? `<a href="${escapeHtml(safeUrl(item.link))}" target="_blank" rel="noopener">Nguồn ↗</a>` : ""}</footer></article>`).join("")}</div>` : '<div class="cosmic-empty">Không có sự kiện loại này trong khoảng ngày đã chọn.</div>'; } catch (error) { meta.innerHTML = ""; notice(results, error.message, "error"); } };
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); }); load();
  }

  async function renderObservatory(host) {
    const sessions = (await dbAll("sessions")).filter((item) => item?.type === "observation").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
    const renderSessions = (items) => items.length ? `<div class="cosmic-observation-list">${items.map((item) => `<article><div><span>${escapeHtml(item.target || "Mục tiêu chưa đặt")}</span><h2>${escapeHtml(item.title || "Phiên quan sát")}</h2><p>${escapeHtml(item.notes || "Không có ghi chú.")}</p></div><dl><div><dt>Thời gian</dt><dd>${formatDate(item.scheduledAt || item.createdAt)}</dd></div><div><dt>Thiết bị</dt><dd>${escapeHtml(item.equipment || "Mắt thường")}</dd></div></dl><button type="button" data-observation-delete="${escapeHtml(item.id)}" aria-label="Xóa phiên ${escapeHtml(item.title || "quan sát")}">Xóa</button></article>`).join("")}</div>` : '<div class="cosmic-empty">Chưa có phiên quan sát. Hãy tạo phiên đầu tiên ở biểu mẫu bên cạnh.</div>';
    host.innerHTML = `<section class="cosmic-observatory-workspace"><div class="cosmic-observation-intro"><span>LOCAL-FIRST OBSERVATION LOG</span><h2>Chuẩn bị một đêm quan sát có mục tiêu</h2><p>Thông tin được lưu trong IndexedDB trên thiết bị. Vị trí chỉ được dùng khi bạn chủ động cấp quyền trong Bầu trời đêm.</p><div><a class="cosmic-secondary" href="#/universe/live-sky">Kiểm tra bầu trời tối nay</a><a class="cosmic-secondary" href="#/universe/planner">Mở công cụ lập kế hoạch</a></div></div><form class="cosmic-observation-form" data-observation-form><label>Tên phiên<input name="title" maxlength="80" required placeholder="Ví dụ: Quan sát Sao Mộc"></label><label>Mục tiêu<input name="target" maxlength="80" required placeholder="Hành tinh, sao hoặc thiên thể"></label><label>Thời gian<input name="scheduledAt" type="datetime-local" value="${localDateTimeValue()}"></label><label>Thiết bị<select name="equipment"><option>Mắt thường</option><option>Ống nhòm</option><option>Kính thiên văn khúc xạ</option><option>Kính thiên văn phản xạ</option><option>Thiết bị khác</option></select></label><label class="is-wide">Ghi chú<textarea name="notes" maxlength="800" rows="4" placeholder="Điều kiện mây, hướng nhìn, mục tiêu cần kiểm tra…"></textarea></label><button type="submit" class="cosmic-primary">Lưu phiên quan sát</button></form></section><section class="cosmic-section-heading"><div><span>NHẬT KÝ CỤC BỘ</span><h2>Các phiên gần đây</h2></div><small>Tối đa hiển thị 50 phiên mới nhất</small></section><div data-observation-list>${renderSessions(sessions)}</div>`;
    const listHost = host.querySelector("[data-observation-list]");
    const refresh = async () => {
      const items = (await dbAll("sessions")).filter((item) => item?.type === "observation").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
      listHost.innerHTML = renderSessions(items);
    };
    host.querySelector("[data-observation-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const title = String(values.title || "").trim().slice(0, 80);
      const target = String(values.target || "").trim().slice(0, 80);
      if (!title || !target) return announce("Hãy nhập tên phiên và mục tiêu quan sát.");
      await dbWrite("sessions", { id: `observation-${Date.now()}`, type: "observation", title, target, scheduledAt: String(values.scheduledAt || "").slice(0, 32), equipment: String(values.equipment || "Mắt thường").slice(0, 80), notes: String(values.notes || "").trim().slice(0, 800), createdAt: new Date().toISOString() });
      event.currentTarget.reset();
      event.currentTarget.elements.scheduledAt.value = localDateTimeValue();
      await refresh();
      announce("Đã lưu phiên quan sát trên thiết bị.");
    });
    listHost.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-observation-delete]");
      if (!button) return;
      await dbDelete("sessions", button.dataset.observationDelete);
      await refresh();
      announce("Đã xóa phiên quan sát theo yêu cầu.");
    });
  }

  function renderDsn(host) {
    const stations = [
      ["Goldstone", "California, Hoa Kỳ", "DSS"],
      ["Madrid", "Tây Ban Nha", "MDSCC"],
      ["Canberra", "Australia", "CDSCC"]
    ];
    host.innerHTML = `<section class="cosmic-dsn-hero"><div class="cosmic-dsn-visual" aria-hidden="true"><i></i><i></i><b>DSN</b></div><div><span>NASA/JPL OFFICIAL STATUS</span><h2>Nghe cách Trái Đất giữ liên lạc với không gian sâu</h2><p>HH Universe không sao chép hoặc suy đoán luồng telemetry. Nút dưới đây mở DSN Now của NASA/JPL, nơi trạng thái anten và tàu vũ trụ được nguồn chính thức cập nhật.</p><a class="cosmic-primary" href="https://eyes.nasa.gov/dsn/dsn.html" target="_blank" rel="noopener">Mở DSN Now chính thức ↗</a><small data-kind="observed">Trạng thái trực tiếp chỉ được xem tại nguồn NASA/JPL</small></div></section><section class="cosmic-station-grid">${stations.map(([name, locationName, code]) => `<article><span>${escapeHtml(code)}</span><h2>${escapeHtml(name)}</h2><p>${escapeHtml(locationName)}</p><small>Một trong ba khu phức hợp tạo vùng phủ quanh Trái Đất.</small></article>`).join("")}</section><div class="cosmic-notice is-info">Nếu nguồn chính thức không tải được, HH giữ thông báo lỗi hoặc liên kết thử lại; không thay bằng anten, tàu hay số liệu giả.</div>`;
  }

  function renderSurfaces(host) {
    const bodies = Object.freeze({ Moon: ["Mặt Trăng", 1737.4], Mars: ["Sao Hỏa", 3389.5], Mercury: ["Sao Thủy", 2439.7], Ceres: ["Ceres", 469.7], Vesta: ["Vesta", 262.7], Europa: ["Europa", 1560.8] });
    host.innerHTML = `<section class="cosmic-surface-workspace"><div class="cosmic-surface-map" aria-hidden="true"><i></i><span>PLANETARY<br>TREK</span></div><div><span>NASA SOLAR SYSTEM TREKS</span><h2>Địa hình hành tinh có nguồn</h2><p>Mở cổng NASA để xem lớp ảnh và địa hình nhiệm vụ. Máy tính bên dưới dùng bán kính trung bình và công thức haversine để ước tính cung ngắn nhất giữa hai tọa độ; đây không phải khoảng cách đi bộ qua địa hình.</p><a class="cosmic-primary" href="https://trek.nasa.gov/" target="_blank" rel="noopener">Mở NASA Solar System Treks ↗</a></div></section><form class="cosmic-surface-calculator" data-surface-form><label>Thiên thể<select name="body">${Object.entries(bodies).map(([id, [label]]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("")}</select></label><fieldset><legend>Điểm A</legend><label>Vĩ độ<input name="latA" type="number" min="-90" max="90" step="0.0001" value="0"></label><label>Kinh độ<input name="lonA" type="number" min="-180" max="180" step="0.0001" value="0"></label></fieldset><fieldset><legend>Điểm B</legend><label>Vĩ độ<input name="latB" type="number" min="-90" max="90" step="0.0001" value="1"></label><label>Kinh độ<input name="lonB" type="number" min="-180" max="180" step="0.0001" value="1"></label></fieldset><button type="submit" class="cosmic-primary">Tính khoảng cách cung</button><output data-surface-result aria-live="polite">Nhập hai tọa độ để bắt đầu.</output></form>`;
    host.querySelector("[data-surface-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const numbers = ["latA", "lonA", "latB", "lonB"].map((key) => Number(values[key]));
      const valid = numbers.every(Number.isFinite) && Math.abs(numbers[0]) <= 90 && Math.abs(numbers[2]) <= 90 && Math.abs(numbers[1]) <= 180 && Math.abs(numbers[3]) <= 180;
      const output = event.currentTarget.querySelector("[data-surface-result]");
      if (!valid || !bodies[values.body]) { output.textContent = "Tọa độ không hợp lệ."; return; }
      const [latA, lonA, latB, lonB] = numbers.map((value) => value * Math.PI / 180);
      const deltaLat = latB - latA; const deltaLon = lonB - lonA;
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
      const distance = 2 * bodies[values.body][1] * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
      output.innerHTML = `<strong>${formatNumber(distance, 2)} km</strong><span data-kind="computed">Tính toán · bán kính trung bình ${formatNumber(bodies[values.body][1], 1)} km</span>`;
    });
  }

  function renderTimeline(host) {
    const events = [
      ["13,8 tỷ năm trước", "Vũ trụ sơ khai", "Vật chất, bức xạ và không-thời gian tiến hóa từ trạng thái rất nóng và đậm đặc.", "Giá trị tuổi là ước lượng khoa học."],
      ["Hơn 13 tỷ năm trước", "Những thế hệ sao đầu tiên", "Các ngôi sao sớm bắt đầu tạo ra nhiều nguyên tố nặng hơn hydro và heli.", "Thời điểm chính xác còn được nghiên cứu."],
      ["Khoảng 4,6 tỷ năm trước", "Hệ Mặt Trời hình thành", "Mặt Trời và các thiên thể cùng hình thành từ đám mây khí bụi tiền hành tinh.", "Mốc xấp xỉ."],
      ["Khoảng 4,54 tỷ năm trước", "Trái Đất hình thành", "Hành tinh tiếp tục biến đổi qua địa chất, khí quyển và sự sống.", "Mốc xấp xỉ."],
      ["Hiện tại", "Kỷ nguyên quan sát", "Kính thiên văn và tàu vũ trụ mở rộng phần Vũ trụ con người có thể đo đạc.", "Dữ liệu tiếp tục được cập nhật."]
    ];
    host.innerHTML = `<section class="cosmic-timeline-intro"><span>COSMIC HISTORY</span><h2>Từ Vũ trụ sơ khai đến bầu trời hôm nay</h2><p>Các mốc thời gian dưới đây được trình bày theo quy mô gần đúng. Chúng không phải đồng hồ đếm tuyệt đối và luôn cần đọc cùng nguồn khoa học.</p><a class="cosmic-secondary" href="https://science.nasa.gov/universe/" target="_blank" rel="noopener">Đọc thêm tại NASA Science ↗</a></section><ol class="cosmic-universe-timeline">${events.map(([time, title, description, note], index) => `<li style="--timeline-index:${index}"><span>${escapeHtml(time)}</span><article><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><small data-kind="illustrative">${escapeHtml(note)}</small></article></li>`).join("")}</ol>`;
  }

  function renderLearning(host) {
    const questions = [
      { question: "Nguồn nào phù hợp để lấy ephemeris và vector quỹ đạo?", options: ["NASA Media", "JPL Horizons", "EONET"], answer: 1, explanation: "JPL Horizons cung cấp ephemeris, vector trạng thái và phần tử quỹ đạo." },
      { question: "Dữ liệu 'computed' trong HH Universe có nghĩa gì?", options: ["Kết quả từ mô hình/tính toán", "Tín hiệu trực tiếp", "Dữ liệu do người dùng đo"], answer: 0, explanation: "Computed là kết quả tính từ mô hình đã nêu nguồn, không phải quan sát trực tiếp." },
      { question: "DSN dùng để làm gì?", options: ["Theo dõi thời tiết mặt đất", "Liên lạc với tàu vũ trụ", "Phát video thương mại"], answer: 1, explanation: "Deep Space Network hỗ trợ liên lạc và theo dõi nhiều nhiệm vụ không gian." },
      { question: "Khoảng cách haversine trong Bề mặt hành tinh biểu diễn gì?", options: ["Đường thẳng xuyên tâm", "Cung ngắn nhất trên mặt cầu", "Đường đi tránh núi"], answer: 1, explanation: "Đó là cung ngắn nhất trên mô hình cầu, không tính địa hình." },
      { question: "Khi nguồn NASA tạm lỗi, HH Universe phải làm gì?", options: ["Tạo số thay thế", "Giữ lỗi/cache có nhãn rõ", "Hiển thị trạng thái online giả"], answer: 1, explanation: "Ứng dụng chỉ dùng cache còn hạn với nhãn rõ hoặc báo lỗi; không bịa dữ liệu." }
    ];
    const settings = getSettings();
    host.innerHTML = `<section class="cosmic-learning-summary"><div><span>MICRO LEARNING</span><h2>5 câu để đọc dữ liệu Vũ trụ đúng cách</h2><p>Làm bài không cần tài khoản. Kết quả tốt nhất chỉ được lưu cục bộ trong thiết bị này.</p></div><strong>${Number.isFinite(Number(settings.learningBest)) ? `${Number(settings.learningBest)}/5` : "Chưa làm"}<small>Kỷ lục cá nhân</small></strong></section><form class="cosmic-learning-quiz" data-learning-quiz>${questions.map((item, questionIndex) => `<fieldset><legend><span>0${questionIndex + 1}</span>${escapeHtml(item.question)}</legend>${item.options.map((option, optionIndex) => `<label><input type="radio" name="question-${questionIndex}" value="${optionIndex}" required><span>${escapeHtml(option)}</span></label>`).join("")}<p data-learning-explanation="${questionIndex}" hidden></p></fieldset>`).join("")}<button type="submit" class="cosmic-primary">Chấm bài</button><output data-learning-result aria-live="polite"></output></form>`;
    host.querySelector("[data-learning-quiz]").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      let score = 0;
      questions.forEach((item, index) => {
        const selected = Number(data.get(`question-${index}`));
        const correct = selected === item.answer;
        if (correct) score += 1;
        const explanation = event.currentTarget.querySelector(`[data-learning-explanation="${index}"]`);
        explanation.hidden = false;
        explanation.className = correct ? "is-correct" : "is-incorrect";
        explanation.textContent = `${correct ? "Đúng." : `Chưa đúng. Đáp án: ${item.options[item.answer]}.`} ${item.explanation}`;
      });
      const best = Math.max(score, Number(getSettings().learningBest || 0));
      saveSettings({ learningBest: best, learningLastScore: score, learningCompletedAt: new Date().toISOString() });
      event.currentTarget.querySelector("[data-learning-result]").innerHTML = `<strong>${score}/5</strong><span>${score === 5 ? "Bạn đã hoàn thành xuất sắc." : "Hãy xem giải thích và thử lại khi sẵn sàng."}</span>`;
      announce(`Kết quả Phòng học thiên văn: ${score} trên 5 câu.`);
    });
  }

  function renderUniverseMap(host) {
    host.innerHTML = `<section class="cosmic-external-explorer"><div class="cosmic-external-visual"><span>∞</span><i></i><i></i><i></i></div><div><span>WORLDWIDE TELESCOPE · HiPS</span><h2>Bầu trời đa bước sóng cần engine chuyên dụng</h2><p>HH không sao chép Stellarium hoặc ESASky. Phiên này mở công cụ WorldWide Telescope chính thức trong tab riêng để giữ attribution, hiệu năng và quyền sử dụng đúng nguồn.</p><div><a class="cosmic-primary" href="https://worldwidetelescope.org/webclient/" target="_blank" rel="noopener">Mở WorldWide Telescope ↗</a><a class="cosmic-secondary" href="https://sky.esa.int/esasky/" target="_blank" rel="noopener">Mở ESASky ↗</a></div><dl><div><dt>Trạng thái</dt><dd>Liên kết chính thức</dd></div><div><dt>Không nhúng mã AGPL</dt><dd>Đã tuân thủ</dd></div><div><dt>Dữ liệu giả</dt><dd>Không sử dụng</dd></div></dl></div></section>`;
  }

  async function renderMissions(host) {
    const targetOptions = [
      ["mercury", "Sao Thủy"], ["venus", "Sao Kim"], ["earth", "Trái Đất"], ["moon", "Mặt Trăng"],
      ["mars", "Sao Hỏa"], ["jupiter", "Sao Mộc"], ["saturn", "Sao Thổ"], ["uranus", "Sao Thiên Vương"],
      ["neptune", "Sao Hải Vương"], ["pluto", "Sao Diêm Vương"]
    ];
    const targetLabels = Object.fromEntries(targetOptions);
    const settings = getSettings();
    const start = localDay();
    const endDate = new Date(); endDate.setDate(endDate.getDate() + 14);
    const end = localDay(endDate);
    const missions = [
      ["NASA Eyes", "Theo dõi mission và Hệ Mặt Trời bằng sản phẩm chính thức của NASA.", "https://eyes.nasa.gov/apps/solar-system/"],
      ["JPL Horizons", "Tạo ephemeris, vector trạng thái và phần tử quỹ đạo theo thời gian.", "https://ssd.jpl.nasa.gov/horizons/app.html#/"],
      ["JPL Mission Directory", "Danh mục nhiệm vụ của Jet Propulsion Laboratory.", "https://www.jpl.nasa.gov/missions/"],
      ["NASA Missions", "Tra cứu nhiệm vụ và chương trình không gian NASA.", "https://www.nasa.gov/missions/"],
      ["Deep Space Network", "Trạng thái liên lạc DSN công khai từ NASA/JPL.", "https://eyes.nasa.gov/dsn/dsn.html"]
    ];
    const options = targetOptions.map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
    host.innerHTML = `<section class="cosmic-flight-director">
      <form class="cosmic-filter-bar cosmic-flight-form" data-flight-form>
        <label>Thiên thể chính<select name="target">${options}</select></label>
        <label>So sánh<select name="compareTarget"><option value="">Không so sánh</option>${options}</select></label>
        <label>Ngày bắt đầu<input type="date" name="start" value="${start}" min="1950-01-01" max="2050-12-31" required></label>
        <label>Ngày kết thúc<input type="date" name="end" value="${end}" min="1950-01-02" max="2050-12-31" required></label>
        <label>Bước thời gian<select name="step"><option value="1">1 ngày</option><option value="2">2 ngày</option><option value="3">3 ngày</option><option value="7">7 ngày</option></select></label>
        <button type="submit" class="cosmic-primary">Tải vector JPL</button>
      </form>
      <div class="cosmic-flight-status" data-flight-status aria-live="polite"><div class="cosmic-notice is-info">Chọn thiên thể và khoảng ngày để tạo hành trình. Đây là ephemeris được tính bởi JPL Horizons, không phải telemetry tàu vũ trụ trực tiếp.</div></div>
    </section>
    <section class="cosmic-directory cosmic-mission-directory"><div class="cosmic-notice is-info">Dùng các cổng chính thức dưới đây cho mô phỏng nhiệm vụ, danh mục tàu và liên lạc trực tiếp. HH không thay nguồn lỗi bằng trạng thái giả.</div><div>${missions.map(([title, description, url]) => `<a href="${url}" target="_blank" rel="noopener"><span>↗</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><small>Nguồn chính thức · Mở tab mới</small></a>`).join("")}</div></section>`;
    const form = host.querySelector("[data-flight-form]");
    const status = host.querySelector("[data-flight-status]");
    form.elements.target.value = targetLabels[settings.flightTarget] ? settings.flightTarget : "mars";
    form.elements.compareTarget.value = targetLabels[settings.flightCompareTarget] ? settings.flightCompareTarget : "earth";
    form.elements.step.value = ["1", "2", "3", "7"].includes(String(settings.flightStep)) ? String(settings.flightStep) : "1";
    let playbackTimer = 0;
    let currentDatasets = [];
    const stopPlayback = () => { if (playbackTimer) global.clearInterval(playbackTimer); playbackTimer = 0; };
    const stopWhenHidden = () => {
      if (!document.hidden) return;
      stopPlayback();
      const playButton = status.querySelector("[data-flight-play]");
      if (playButton) playButton.textContent = "Phát hành trình";
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    registerCleanup(() => { stopPlayback(); document.removeEventListener("visibilitychange", stopWhenHidden); });
    const projectRecords = (datasets) => {
      const all = datasets.flatMap((dataset) => dataset.records);
      const extent = Math.max(0.0001, ...all.map((record) => Math.hypot(record.positionAu.x, record.positionAu.y)));
      return datasets.map((dataset) => ({ ...dataset, points: dataset.records.map((record) => ({ x: 400 + record.positionAu.x / extent * 330, y: 240 - record.positionAu.y / extent * 200 })) }));
    };
    const renderFlight = (datasets, payloads) => {
      currentDatasets = projectRecords(datasets);
      const maxIndex = Math.max(0, Math.min(...currentDatasets.map((dataset) => dataset.records.length)) - 1);
      const colors = ["#65e8ff", "#ff84d6"];
      status.innerHTML = `<div class="cosmic-flight-grid">
        <div class="cosmic-flight-stage">
          <svg viewBox="0 0 800 480" role="img" aria-label="Đường vector nhật tâm do JPL Horizons tính toán">
            <defs><radialGradient id="flightSun"><stop stop-color="#fffbd0"/><stop offset=".3" stop-color="#ffd45e"/><stop offset="1" stop-color="#ff7738" stop-opacity=".1"/></radialGradient></defs>
            <g class="cosmic-flight-gridlines">${[80,160,240,320].map((radius) => `<circle cx="400" cy="240" r="${radius}"/>`).join("")}<path d="M40 240H760M400 24V456"/></g>
            <circle class="cosmic-flight-sun" cx="400" cy="240" r="20" fill="url(#flightSun)"/>
            ${currentDatasets.map((dataset, index) => `<polyline points="${dataset.points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}" style="--flight-color:${colors[index]}"/><circle data-flight-marker="${index}" cx="${dataset.points[0].x}" cy="${dataset.points[0].y}" r="8" style="--flight-color:${colors[index]}"/><text data-flight-label="${index}" x="${dataset.points[0].x + 13}" y="${dataset.points[0].y - 12}" fill="${colors[index]}">${escapeHtml(dataset.label)}</text>`).join("")}
          </svg>
          <div class="cosmic-flight-legend">${currentDatasets.map((dataset, index) => `<span><i style="--flight-color:${colors[index]}"></i>${escapeHtml(dataset.label)}</span>`).join("")}<small data-kind="illustrative">Phép chiếu 2D nhật tâm · không đúng tỉ lệ kích thước</small></div>
        </div>
        <aside class="cosmic-flight-inspector">
          <span>FLIGHT DIRECTOR</span><h2 data-flight-date>—</h2>
          <div class="cosmic-flight-metrics" data-flight-metrics></div>
          <label>Thời điểm trong bảng<input type="range" min="0" max="${maxIndex}" value="0" step="1" data-flight-range></label>
          <div><button type="button" class="cosmic-secondary" data-flight-play>Phát hành trình</button><button type="button" class="cosmic-secondary" data-flight-csv>Xuất CSV</button></div>
        </aside>
      </div>
      <div class="cosmic-provenance"><div>${sourceBadge(payloads[0])}<span>${escapeHtml(payloads[0].coordinateFrame || "JPL Horizons frame")}</span></div><p>API ${escapeHtml(payloads[0].data?.apiVersion || "không ghi phiên bản")} · ${escapeHtml(payloads[0].timeScale || "TDB")} · tải ${formatDate(payloads[0].fetchedAt)} · ${escapeHtml(payloads[0].cacheStatus || "upstream")}</p></div>`;
      const range = status.querySelector("[data-flight-range]");
      const play = status.querySelector("[data-flight-play]");
      const update = (index) => {
        const safeIndex = Math.max(0, Math.min(maxIndex, Number(index) || 0));
        range.value = String(safeIndex);
        currentDatasets.forEach((dataset, datasetIndex) => {
          const point = dataset.points[safeIndex];
          const marker = status.querySelector(`[data-flight-marker="${datasetIndex}"]`);
          const label = status.querySelector(`[data-flight-label="${datasetIndex}"]`);
          marker.setAttribute("cx", point.x); marker.setAttribute("cy", point.y);
          label.setAttribute("x", point.x + 13); label.setAttribute("y", point.y - 12);
        });
        const primary = currentDatasets[0].records[safeIndex];
        const speedKms = primary.speedAuPerDay * AU_KM / 86_400;
        const comparison = currentDatasets[1]?.records[safeIndex];
        const separation = comparison ? Math.hypot(primary.positionAu.x - comparison.positionAu.x, primary.positionAu.y - comparison.positionAu.y, primary.positionAu.z - comparison.positionAu.z) : null;
        status.querySelector("[data-flight-date]").textContent = primary.calendar || `JD ${formatNumber(primary.julianDate, 5)}`;
        status.querySelector("[data-flight-metrics]").innerHTML = `<article><span>Khoảng cách tới Mặt Trời</span><strong>${formatNumber(primary.distanceAu, 6)} AU</strong><small>${formatNumber(primary.distanceAu * AU_KM, 0)} km</small></article><article><span>Vận tốc vector</span><strong>${formatNumber(speedKms, 3)} km/s</strong><small>${formatNumber(primary.speedAuPerDay, 8)} AU/ngày</small></article>${comparison ? `<article><span>Cách ${escapeHtml(currentDatasets[1].label)}</span><strong>${formatNumber(separation, 6)} AU</strong><small>${formatNumber(separation * AU_KM, 0)} km</small></article>` : ""}<article><span>Julian Date</span><strong>${formatNumber(primary.julianDate, 5)}</strong><small>Dữ liệu thời gian ${escapeHtml(payloads[0].timeScale || "TDB")}</small></article>`;
      };
      range.addEventListener("input", () => { stopPlayback(); play.textContent = "Phát hành trình"; update(range.value); });
      play.addEventListener("click", () => {
        if (playbackTimer) { stopPlayback(); play.textContent = "Phát hành trình"; return; }
        play.textContent = "Tạm dừng";
        playbackTimer = global.setInterval(() => {
          const next = Number(range.value) >= maxIndex ? 0 : Number(range.value) + 1;
          update(next);
        }, 700);
      });
      status.querySelector("[data-flight-csv]").addEventListener("click", () => {
        const rows = [["target", "calendar", "julianDate", "xAu", "yAu", "zAu", "vxAuDay", "vyAuDay", "vzAuDay", "distanceAu"]];
        currentDatasets.forEach((dataset) => dataset.records.forEach((record) => rows.push([dataset.id, record.calendar, record.julianDate, record.positionAu.x, record.positionAu.y, record.positionAu.z, record.velocityAuPerDay.x, record.velocityAuPerDay.y, record.velocityAuPerDay.z, record.distanceAu])));
        const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hh-flight-director-${localDay()}.csv`; anchor.click(); global.setTimeout(() => URL.revokeObjectURL(url), 0);
      });
      update(0);
    };
    const load = async () => {
      stopPlayback();
      const values = Object.fromEntries(new FormData(form));
      if (values.target === values.compareTarget) { notice(status, "Hai thiên thể so sánh phải khác nhau.", "error"); return; }
      const startTime = Date.parse(`${values.start}T00:00:00Z`); const endTime = Date.parse(`${values.end}T00:00:00Z`);
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime || endTime - startTime > 62 * 86_400_000) { notice(status, "Khoảng ngày phải hợp lệ, tối đa 62 ngày.", "error"); return; }
      status.innerHTML = `<div class="cosmic-flight-loading"><i></i><strong>Đang nhận vector từ JPL Horizons…</strong><small>Không có dữ liệu mô phỏng thay thế nếu nguồn lỗi.</small></div>`;
      try {
        const ids = [values.target, values.compareTarget].filter(Boolean);
        const payloads = await Promise.all(ids.map((target) => fetchCosmic("horizons", { target, start: values.start, end: values.end, step: values.step }, { timeout: 16_000, maxStaleMs: 24 * 60 * 60_000 })));
        if (!host.isConnected) return;
        const datasets = payloads.map((payload, index) => ({ id: ids[index], label: targetLabels[ids[index]], records: payload.data?.records || [] }));
        if (datasets.some((dataset) => !dataset.records.length)) throw new Error("JPL Horizons không trả về đủ bản ghi vector.");
        saveSettings({ flightTarget: values.target, flightCompareTarget: values.compareTarget, flightStep: values.step });
        renderFlight(datasets, payloads);
        announce(`Đã tải ${datasets.reduce((total, dataset) => total + dataset.records.length, 0)} vector JPL Horizons.`);
      } catch (error) { notice(status, error.message, "error"); }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
    load();
  }

  function renderTours(host) {
    const tours = [["Hệ Mặt Trời trong 3 phút", "Bắt đầu từ Trái Đất và quan sát vị trí các hành tinh.", "/universe/solar-system"], ["Bầu trời tối nay", "Dựng đường chân trời tại vị trí thiết bị.", "/universe/live-sky"], ["Vật thể đi ngang Trái Đất", "Hiểu đúng khoảng cách và độ bất định trong JPL CAD.", "/universe/asteroids"], ["Vũ trụ qua ảnh NASA", "Khám phá media kèm NASA ID và attribution.", "/universe/media"]];
    host.innerHTML = `<section class="cosmic-tour-grid">${tours.map(([title, description, route], index) => `<a href="#${route}"><span>0${index + 1}</span><div><small>TOUR CÓ DỮ LIỆU NGUỒN</small><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><b>Bắt đầu →</b></div></a>`).join("")}</section>`;
  }

  async function exportData() {
    const payload = { schema: "hh.cosmic-observatory", version: 1, exportedAt: new Date().toISOString(), settings: getSettings(), bookmarks: await dbAll("bookmarks"), sessions: await dbAll("sessions") };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hh-cosmic-${localDay()}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importData(file) {
    if (!file || file.size > MAX_IMPORT_BYTES) throw new Error("File nhập phải nhỏ hơn 2 MB.");
    const payload = JSON.parse(await file.text());
    if (payload?.schema !== "hh.cosmic-observatory" || payload?.version !== 1 || !payload.settings || typeof payload.settings !== "object") throw new Error("File không đúng schema HH Cosmic Observatory v1.");
    saveSettings({ ...payload.settings, version: 1 });
    for (const bookmark of Array.isArray(payload.bookmarks) ? payload.bookmarks.slice(0, 500) : []) if (typeof bookmark?.id === "string") await dbWrite("bookmarks", { ...bookmark, id: bookmark.id.slice(0, 180) });
    for (const session of Array.isArray(payload.sessions) ? payload.sessions.slice(0, 100) : []) if (typeof session?.id === "string") await dbWrite("sessions", { ...session, id: session.id.slice(0, 180) });
  }

  async function renderDataCenter(host) {
    const bookmarks = await dbAll("bookmarks");
    host.innerHTML = `<section class="cosmic-trust-center"><div class="cosmic-trust-summary"><article><span>NGUỒN ĐÃ ĐĂNG KÝ</span><strong>${SOURCES.length}</strong><small>Không có proxy URL tùy ý</small></article><article><span>BOOKMARK CỤC BỘ</span><strong>${bookmarks.length}</strong><small>IndexedDB trên thiết bị</small></article><article><span>SCHEMA</span><strong>v1</strong><small>Có validate khi nhập</small></article><article><span>SECRET FRONTEND</span><strong>0</strong><small>API key chỉ ở server</small></article></div><div class="cosmic-source-table" role="table" aria-label="Nguồn dữ liệu"><div role="row"><span role="columnheader">Nguồn</span><span role="columnheader">Mục đích</span><span role="columnheader">Kiểu</span><span role="columnheader">Tài liệu</span></div>${SOURCES.map(([name, purpose, url, kind]) => `<div role="row"><strong role="cell">${escapeHtml(name)}</strong><span role="cell">${escapeHtml(purpose)}</span><span role="cell" data-kind="${kind}">${escapeHtml(kind)}</span><a role="cell" href="${url}" target="_blank" rel="noopener">Mở ↗</a></div>`).join("")}</div><section class="cosmic-data-controls"><div><span>KIỂM SOÁT DỮ LIỆU</span><h2>Xuất, nhập và dọn cache</h2><p>File xuất không chứa API key, token đăng nhập hoặc cache response từ NASA/JPL.</p></div><div><button type="button" data-cosmic-export>Xuất dữ liệu</button><label class="cosmic-file-button">Nhập dữ liệu<input type="file" accept="application/json,.json" data-cosmic-import></label><button type="button" data-cosmic-clear-cache>Dọn cache thiên văn</button></div></section><div class="cosmic-data-dictionary"><span data-kind="observed"><b>Quan sát</b>Dữ liệu do nguồn công bố.</span><span data-kind="computed"><b>Tính toán</b>Kết quả từ mô hình thiên văn.</span><span data-kind="predicted"><b>Dự báo</b>Có thể thay đổi khi nguồn cập nhật.</span><span data-kind="interpolated"><b>Nội suy</b>Giá trị giữa các mốc nguồn.</span><span data-kind="illustrative"><b>Minh họa</b>Chỉ phục vụ hiển thị.</span></div></section>`;
    host.querySelector("[data-cosmic-export]").addEventListener("click", () => exportData().then(() => announce("Đã xuất dữ liệu Vũ trụ HH.")));
    host.querySelector("[data-cosmic-import]").addEventListener("change", (event) => importData(event.target.files?.[0]).then(() => { announce("Đã nhập dữ liệu hợp lệ."); renderDataCenter(host); }).catch((error) => announce(error.message)));
    host.querySelector("[data-cosmic-clear-cache]").addEventListener("click", async () => { const entries = await dbAll("cache"); await Promise.all(entries.map((entry) => dbDelete("cache", entry.key))); announce(`Đã dọn ${entries.length} bản cache thiên văn.`); });
  }

  function renderView(host, view) {
    if (view === "overview") return renderOverview(host);
    if (view === "solar-system") return renderSolarSystem(host);
    if (view === "live-sky") return renderLiveSky(host);
    if (view === "observatory") return renderObservatory(host);
    if (view === "dsn") return renderDsn(host);
    if (view === "asteroids") return renderAsteroids(host);
    if (view === "surfaces") return renderSurfaces(host);
    if (view === "media") return renderMedia(host);
    if (view === "exoplanets") return renderExoplanets(host);
    if (view === "earth") return renderEarth(host);
    if (view === "space-weather") return renderSpaceWeather(host);
    if (view === "timeline") return renderTimeline(host);
    if (view === "learning") return renderLearning(host);
    if (view === "universe-map") return renderUniverseMap(host);
    if (view === "missions") return renderMissions(host);
    if (view === "tours") return renderTours(host);
    if (view === "planner") return renderLiveSky(host, true);
    if (view === "data-center") return renderDataCenter(host);
    return renderOverview(host);
  }

  function normalizeView(value) {
    return VIEW_ALIASES[String(value || "").toLowerCase()] || "overview";
  }

  function unmount() {
    if (!active) return;
    active.controllers.forEach((item) => item.abort());
    active.cleanups.splice(0).forEach((cleanup) => { try { cleanup(); } catch {} });
    document.querySelector("[data-cosmic-media-dialog]")?.close?.();
    active.root?.classList.remove("is-mounted");
    active = null;
  }

  function mount(host, options = {}) {
    if (!(host instanceof Element)) return false;
    unmount();
    const view = normalizeView(options.view);
    active = { host, root: null, view, controllers: new Set(), cleanups: [] };
    host.innerHTML = shellMarkup(view);
    active.root = host.querySelector("[data-cosmic-app]");
    active.root.classList.add("is-mounted");
    saveSettings(view === "overview" ? { lastOpenedAt: new Date().toISOString() } : { lastView: view, lastRoute: viewRoute(view) });
    renderView(host.querySelector("[data-cosmic-view-host]"), view);
    requestAnimationFrame(() => host.querySelector(".cosmic-main")?.focus({ preventScroll: true }));
    return true;
  }

  const universeApi = Object.freeze({
    version: 4,
    productName: "HH Universe",
    canonicalRoute: "/universe",
    legacyRoute: "/cosmic-observatory",
    views: VIEWS,
    supports: (view) => Boolean(VIEW_ALIASES[String(view || "overview").toLowerCase()]),
    normalizeView,
    mount,
    unmount,
    dataTypes: Object.freeze(["observed", "computed", "predicted", "interpolated", "illustrative"])
  });
  global.HHUniverse = universeApi;
  global.HHCosmicObservatory = universeApi;
})(window);
