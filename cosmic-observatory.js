(function initHHCosmicObservatory(global) {
  "use strict";

  const API_BASE = "/api/cosmic";
  const STORAGE_KEY = "hh.cosmic-observatory.settings.v1";
  const DB_NAME = "hh.cosmic-observatory";
  const DB_VERSION = 1;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const LUNAR_DISTANCE_AU = 0.00256955529;
  const AU_KM = 149_597_870.7;
  const VIEW_ALIASES = Object.freeze({ "solar-system": "solar-system", "live-sky": "live-sky", "universe-map": "universe-map", missions: "missions", asteroids: "asteroids", exoplanets: "exoplanets", earth: "earth", "space-weather": "space-weather", media: "media", tours: "tours", planner: "planner", "data-center": "data-center", overview: "overview" });
  const VIEWS = Object.freeze({
    overview: { title: "Đài Quan sát Vũ trụ HH", eyebrow: "COSMIC OBSERVATORY", description: "Khám phá Hệ Mặt Trời, bầu trời, tiểu hành tinh và tư liệu NASA bằng dữ liệu có nguồn." },
    "solar-system": { title: "Hệ Mặt Trời 3D", eyebrow: "MISSION CONTROL", description: "Vị trí thiên thể được tính theo thời gian; tỉ lệ hiển thị luôn được ghi rõ." },
    "live-sky": { title: "Bầu trời tại vị trí của bạn", eyebrow: "LIVE SKY", description: "Bản đồ chân trời tính từ vị trí, ngày giờ và múi giờ thiết bị." },
    "universe-map": { title: "Vũ trụ đa bước sóng", eyebrow: "MULTI-WAVELENGTH", description: "Cửa ngõ tới dữ liệu HiPS và WorldWide Telescope có attribution." },
    missions: { title: "Nhiệm vụ không gian", eyebrow: "MISSION TIMELINE", description: "Tra cứu nhiệm vụ từ nguồn chính thức; không mô phỏng telemetry giả." },
    asteroids: { title: "Asteroid Watch", eyebrow: "JPL CNEOS", description: "Các lần tiếp cận gần theo JPL CAD, kèm khoảng cách, tốc độ và độ bất định." },
    exoplanets: { title: "Ngoại hành tinh", eyebrow: "NASA EXOPLANET ARCHIVE", description: "Khám phá các thế giới đã công bố từ NASA Exoplanet Archive." },
    earth: { title: "Trái Đất từ không gian", eyebrow: "EARTH EVENTS", description: "Sự kiện tự nhiên EONET có thời gian cập nhật và nguồn rõ ràng." },
    "space-weather": { title: "Thời tiết không gian", eyebrow: "NASA DONKI", description: "Sự kiện Mặt Trời được phân biệt rõ quan sát và dự báo." },
    media: { title: "Thư viện NASA", eyebrow: "NASA MEDIA", description: "Tìm ảnh, video và âm thanh, luôn giữ metadata và attribution từng mục." },
    tours: { title: "Hành trình dẫn dắt", eyebrow: "COSMIC TOURS", description: "Các lộ trình khám phá ngắn, không tự phát âm thanh khi chưa được phép." },
    planner: { title: "Lập kế hoạch quan sát", eyebrow: "OBSERVATION PLANNER", description: "Tìm thiên thể có thể quan sát theo vị trí và giờ địa phương." },
    "data-center": { title: "Dữ liệu & ghi công", eyebrow: "TRUST CENTER", description: "Xem nguồn, kiểu dữ liệu, cache, giấy phép và kiểm soát dữ liệu cá nhân." }
  });
  const NAV_ITEMS = Object.freeze([
    ["overview", "Tổng quan", "✦"], ["solar-system", "Hệ Mặt Trời", "◎"], ["live-sky", "Bầu trời", "⌖"],
    ["asteroids", "Tiểu hành tinh", "◆"], ["media", "NASA Media", "▣"], ["exoplanets", "Ngoại hành tinh", "◉"],
    ["earth", "Trái Đất", "◍"], ["space-weather", "Thời tiết vũ trụ", "☀"], ["universe-map", "Vũ trụ sâu", "∞"],
    ["missions", "Nhiệm vụ", "↗"], ["tours", "Cosmic Tours", "▷"], ["planner", "Kế hoạch", "◫"], ["data-center", "Nguồn dữ liệu", "✓"]
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
    return id === "overview" ? "/cosmic-observatory" : `/cosmic-observatory/${id}`;
  }

  function shellMarkup(view) {
    const meta = VIEWS[view];
    return `<section class="cosmic-observatory" data-cosmic-app data-view="${escapeHtml(view)}">
      <div class="cosmic-space" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="cosmic-topbar">
        <a class="cosmic-brand" href="#/cosmic-observatory" aria-label="Về tổng quan Đài Quan sát Vũ trụ HH"><span>✦</span><div><small>HH PLATFORM</small><strong>Cosmic Observatory</strong></div></a>
        <nav class="cosmic-quick-nav" aria-label="Không gian thiên văn">${NAV_ITEMS.slice(0, 8).map(([id, label]) => `<a href="#${viewRoute(id)}" class="${id === view ? "is-active" : ""}" ${id === view ? 'aria-current="page"' : ""}>${escapeHtml(label)}</a>`).join("")}</nav>
        <a class="cosmic-data-link" href="#/cosmic-observatory/data-center">Nguồn dữ liệu <span>✓</span></a>
      </header>
      <div class="cosmic-layout">
        <aside class="cosmic-rail" aria-label="Điều hướng Đài quan sát">${NAV_ITEMS.map(([id, label, icon]) => `<a href="#${viewRoute(id)}" title="${escapeHtml(label)}" class="${id === view ? "is-active" : ""}" ${id === view ? 'aria-current="page"' : ""}><i>${escapeHtml(icon)}</i><span>${escapeHtml(label)}</span></a>`).join("")}</aside>
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
    host.innerHTML = `<section class="cosmic-hero">
      <div class="cosmic-hero-copy"><span class="cosmic-kicker">DỮ LIỆU THẬT · KHÔNG GIAN TƯƠNG TÁC</span><h2>Chạm vào vũ trụ,<br><em>hiểu điều bạn đang thấy.</em></h2><p>Điều khiển thời gian Hệ Mặt Trời, dựng bầu trời theo vị trí thiết bị và khám phá dữ liệu NASA/JPL có provenance rõ ràng.</p><div><a class="cosmic-primary" href="#/cosmic-observatory/solar-system">Khám phá vũ trụ <span>→</span></a><a class="cosmic-secondary" href="#/cosmic-observatory/live-sky">Bầu trời tối nay</a></div><small>Mỗi con số đều ghi nguồn, đơn vị, thời điểm và kiểu dữ liệu.</small></div>
      <div class="cosmic-hero-orbit" aria-hidden="true"><div class="cosmic-sun"></div>${[1,2,3,4].map((n) => `<i style="--orbit:${n}"><b></b></i>`).join("")}<span>HH</span></div>
    </section>
    <section class="cosmic-today-grid" aria-label="Dữ liệu mới">
      <article><span>TIẾP CẬN GẦN</span><strong data-home-asteroid>Đang kết nối JPL…</strong><small data-home-asteroid-note>Không thay bằng số liệu giả nếu nguồn lỗi.</small></article>
      <article class="cosmic-media-highlight"><span>NASA MEDIA</span><strong data-home-media>Đang mở thư viện…</strong><small data-home-media-note>Ảnh có nguồn và ghi công.</small></article>
      <article><span>PHIÊN GẦN NHẤT</span><strong>${escapeHtml(settings.lastView ? VIEWS[settings.lastView]?.title || "Đài quan sát" : "Chưa có phiên")}</strong><small>${settings.updatedAt ? `Lưu ${formatDate(settings.updatedAt)}` : "Bắt đầu để lưu tiến trình cục bộ."}</small></article>
    </section>
    <section class="cosmic-section-heading"><div><span>12 KHÔNG GIAN ĐỘC LẬP</span><h2>Chọn cách bạn muốn khám phá</h2></div><a href="#/cosmic-observatory/data-center">Kiểm tra nguồn dữ liệu →</a></section>
    <section class="cosmic-workspace-grid">
      ${workspaceCard("solar-system", "◎", "P0 · COMPUTED", "Xoay, zoom, theo dõi thiên thể và tua thời gian bằng Astronomy Engine.")}
      ${workspaceCard("live-sky", "⌖", "P0 · OBSERVER", "Bản đồ chân trời theo tọa độ, ngày giờ và múi giờ thiết bị.")}
      ${workspaceCard("asteroids", "◆", "P0 · JPL CNEOS", "Các lần tiếp cận gần từ JPL CAD, không tạo cảnh báo giật gân.")}
      ${workspaceCard("media", "▣", "P0 · NASA", "Tìm ảnh, video, audio và lưu yêu thích trong IndexedDB.")}
      ${workspaceCard("exoplanets", "◉", "P1 · NASA TAP", "Lọc các thế giới ngoài Hệ Mặt Trời theo số đo đã công bố.")}
      ${workspaceCard("earth", "◍", "P1 · EONET", "Theo dõi các sự kiện tự nhiên đang được NASA tổng hợp.")}
      ${workspaceCard("space-weather", "☀", "P1 · DONKI", "Solar flare, CME và bão địa từ có thời gian cập nhật.")}
      ${workspaceCard("universe-map", "∞", "P1 · WWT / HiPS", "Mở bản đồ bầu trời đa bước sóng bằng công cụ chính thức.")}
      ${workspaceCard("missions", "↗", "P1 · OFFICIAL", "Cửa ngõ mission chính thức; không hiển thị telemetry mô phỏng như dữ liệu sống.")}
      ${workspaceCard("tours", "▷", "P2 · EDUCATION", "Hành trình học ngắn sử dụng các workspace khoa học sẵn có.")}
      ${workspaceCard("planner", "◫", "P2 · COMPUTED", "Lập kế hoạch quan sát dựa trên độ cao thiên thể.")}
      ${workspaceCard("data-center", "✓", "TRUST CENTER", "Nguồn, cache, giấy phép, export/import và dữ liệu cá nhân.")}
    </section>`;
    const asteroidLabel = host.querySelector("[data-home-asteroid]");
    const asteroidNote = host.querySelector("[data-home-asteroid-note]");
    const mediaLabel = host.querySelector("[data-home-media]");
    const mediaNote = host.querySelector("[data-home-media-note]");
    const end = new Date(); end.setDate(end.getDate() + 3);
    Promise.allSettled([
      fetchCosmic("asteroids", { start: localDay(), end: localDay(end), distance: 0.1 }),
      fetchCosmic("media", { q: "nebula", type: "image", page: 1 })
    ]).then(([asteroidResult, mediaResult]) => {
      if (!active || !host.isConnected) return;
      if (asteroidResult.status === "fulfilled") {
        const records = asteroidResult.value.data?.records || [];
        asteroidLabel.textContent = records.length ? `${records.length} lượt trong 3 ngày` : "Không có lượt trong bộ lọc";
        asteroidNote.innerHTML = `${sourceBadge(asteroidResult.value)} · cập nhật ${formatDate(asteroidResult.value.fetchedAt)}`;
      } else { asteroidLabel.textContent = "JPL tạm thời không phản hồi"; asteroidNote.textContent = asteroidResult.reason?.message || "Hãy thử lại sau."; }
      if (mediaResult.status === "fulfilled") {
        const item = mediaResult.value.data?.items?.[0];
        mediaLabel.textContent = item?.title || "Thư viện đã kết nối";
        mediaNote.innerHTML = `${sourceBadge(mediaResult.value)} · ${formatNumber(mediaResult.value.data?.totalHits, 0)} kết quả`;
        const image = safeUrl(item?.previewUrl);
        if (image) host.querySelector(".cosmic-media-highlight")?.style.setProperty("--cosmic-media-image", `url("${image.replace(/\"/g, "%22")}")`);
      } else { mediaLabel.textContent = "NASA Media tạm thời không phản hồi"; mediaNote.textContent = mediaResult.reason?.message || "Hãy thử lại sau."; }
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
      const planetData = PLANETS.map((planet) => {
        try { return { planet, vector: Astronomy.HelioVector(Astronomy.Body?.[planet.id] || planet.id, date) }; }
        catch { return { planet, vector: { x: planet.orbit, y: 0, z: 0 } }; }
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
    const saved = getSettings();
    let simulationDate = saved.solarDate ? new Date(saved.solarDate) : new Date();
    if (!Number.isFinite(simulationDate.getTime())) simulationDate = new Date();
    let speed = Number(saved.solarSpeed || 1);
    let scaleMode = ["scientific", "educational", "cinematic"].includes(saved.solarScale) ? saved.solarScale : "educational";
    let selected = saved.solarTarget || "Earth";
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

  function renderUniverseMap(host) {
    host.innerHTML = `<section class="cosmic-external-explorer"><div class="cosmic-external-visual"><span>∞</span><i></i><i></i><i></i></div><div><span>WORLDWIDE TELESCOPE · HiPS</span><h2>Bầu trời đa bước sóng cần engine chuyên dụng</h2><p>HH không sao chép Stellarium hoặc ESASky. Phiên này mở công cụ WorldWide Telescope chính thức trong tab riêng để giữ attribution, hiệu năng và quyền sử dụng đúng nguồn.</p><div><a class="cosmic-primary" href="https://worldwidetelescope.org/webclient/" target="_blank" rel="noopener">Mở WorldWide Telescope ↗</a><a class="cosmic-secondary" href="https://sky.esa.int/esasky/" target="_blank" rel="noopener">Mở ESASky ↗</a></div><dl><div><dt>Trạng thái</dt><dd>Liên kết chính thức</dd></div><div><dt>Không nhúng mã AGPL</dt><dd>Đã tuân thủ</dd></div><div><dt>Dữ liệu giả</dt><dd>Không sử dụng</dd></div></dl></div></section>`;
  }

  function renderMissions(host) {
    const missions = [
      ["NASA Eyes", "Theo dõi mission và Hệ Mặt Trời bằng sản phẩm chính thức của NASA.", "https://eyes.nasa.gov/apps/solar-system/"],
      ["JPL Mission Directory", "Danh mục nhiệm vụ của Jet Propulsion Laboratory.", "https://www.jpl.nasa.gov/missions/"],
      ["NASA Missions", "Tra cứu nhiệm vụ và chương trình không gian NASA.", "https://www.nasa.gov/missions/"],
      ["Deep Space Network", "Trạng thái liên lạc DSN công khai từ NASA/JPL.", "https://eyes.nasa.gov/dsn/dsn.html"]
    ];
    host.innerHTML = `<section class="cosmic-directory"><div class="cosmic-notice is-info">HH chỉ hiển thị liên kết mission chính thức ở giai đoạn này; chưa dựng vị trí realtime nếu không có telemetry đã xác minh.</div><div>${missions.map(([title, description, url]) => `<a href="${url}" target="_blank" rel="noopener"><span>↗</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><small>Nguồn chính thức · Mở tab mới</small></a>`).join("")}</div></section>`;
  }

  function renderTours(host) {
    const tours = [["Hệ Mặt Trời trong 3 phút", "Bắt đầu từ Trái Đất và quan sát vị trí các hành tinh.", "/cosmic-observatory/solar-system"], ["Bầu trời tối nay", "Dựng đường chân trời tại vị trí thiết bị.", "/cosmic-observatory/live-sky"], ["Vật thể đi ngang Trái Đất", "Hiểu đúng khoảng cách và độ bất định trong JPL CAD.", "/cosmic-observatory/asteroids"], ["Vũ trụ qua ảnh NASA", "Khám phá media kèm NASA ID và attribution.", "/cosmic-observatory/media"]];
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
    host.querySelector("[data-cosmic-export]").addEventListener("click", () => exportData().then(() => announce("Đã xuất dữ liệu Cosmic Observatory.")));
    host.querySelector("[data-cosmic-import]").addEventListener("change", (event) => importData(event.target.files?.[0]).then(() => { announce("Đã nhập dữ liệu hợp lệ."); renderDataCenter(host); }).catch((error) => announce(error.message)));
    host.querySelector("[data-cosmic-clear-cache]").addEventListener("click", async () => { const entries = await dbAll("cache"); await Promise.all(entries.map((entry) => dbDelete("cache", entry.key))); announce(`Đã dọn ${entries.length} bản cache thiên văn.`); });
  }

  function renderView(host, view) {
    if (view === "overview") return renderOverview(host);
    if (view === "solar-system") return renderSolarSystem(host);
    if (view === "live-sky") return renderLiveSky(host);
    if (view === "asteroids") return renderAsteroids(host);
    if (view === "media") return renderMedia(host);
    if (view === "exoplanets") return renderExoplanets(host);
    if (view === "earth") return renderEarth(host);
    if (view === "space-weather") return renderSpaceWeather(host);
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
    saveSettings({ lastView: view });
    renderView(host.querySelector("[data-cosmic-view-host]"), view);
    requestAnimationFrame(() => host.querySelector(".cosmic-main")?.focus({ preventScroll: true }));
    return true;
  }

  global.HHCosmicObservatory = Object.freeze({
    version: 1,
    views: VIEWS,
    supports: (view) => Boolean(VIEW_ALIASES[String(view || "overview").toLowerCase()]),
    normalizeView,
    mount,
    unmount,
    dataTypes: Object.freeze(["observed", "computed", "predicted", "interpolated", "illustrative"])
  });
})(window);
