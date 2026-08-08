(function () {
  "use strict";

  const BASE_KEY = "hh.home.live-widgets.v1";
  const INTRO_KEY = "hh.home.live-widgets.v4-intro";
  const WEATHER_KEY = "hh.dashboard.weather.v2";
  const WEATHER_LOCATION_KEY = "hh.dashboard.weather-location.v1";
  const TODO_KEY = "hh.command-center.todos.v2";
  const PROJECT_KEY = "hh-project-center";
  const COMMUNICATION_KEY = "hh.communication.intelligence.v1";
  const LEARNING_KEY = "hh.learning.os.v1";
  const DEFAULT_LAYOUT = ["clock", "weather", "network", "system", "calendar", "apps"];
  const WIDGETS = Object.freeze([
    { id: "clock", icon: "◷", label: "Bộ đồng hồ", tone: "#65e8ff" },
    { id: "weather", icon: "◒", label: "Weather Station", tone: "#ffd76b" },
    { id: "network", icon: "↗", label: "Network Meter", tone: "#73f2bd" },
    { id: "system", icon: "⌁", label: "Trạng thái tab", tone: "#bc8cff" },
    { id: "calendar", icon: "▦", label: "Lịch mini", tone: "#ff78ca" },
    { id: "apps", icon: "✦", label: "Ứng dụng mini", tone: "#ff9e63" },
    { id: "notes", icon: "▤", label: "Sticky Notes", tone: "#ffe56d" },
    { id: "pomodoro", icon: "◉", label: "Pomodoro", tone: "#ff786f" },
    { id: "media", icon: "♫", label: "Media mini", tone: "#7da7ff" },
    { id: "jobs", icon: "⇣", label: "Tác vụ đang chạy", tone: "#9af06f" }
  ]);
  const THEMES = ["aero", "classic", "neon", "crt", "minimal", "cyber"];
  const SIZES = ["small", "medium", "large"];
  const events = [];
  const listeners = [];
  const timers = new Map();
  const latencyHistory = [];
  const apiHistory = [];
  const sessionNetwork = { checks: 0, successes: 0, startedAt: Date.now() };
  let root = null;
  let host = null;
  let prefs = null;
  let page = 0;
  let activePanel = "";
  let activeMini = "notes";
  let healthPayload = null;
  let websocket = null;
  let websocketState = { state: "unavailable", lastHeartbeat: 0, error: "" };
  let fpsFrame = 0;
  let fpsCount = 0;
  let fpsStarted = performance.now();
  let tabLagExpected = performance.now() + 1000;
  let battery = null;
  let recorder = null;
  let recorderChunks = [];
  let audioObjectUrl = "";
  let draggedId = "";
  const live = {
    now: new Date(), fps: 0, tabLag: 0, heap: null, storage: null, serviceWorker: "Đang kiểm tra",
    http: null, api: null, networkStatus: navigator.onLine ? "Đang đo" : "Mất kết nối", weather: null,
    jobs: { running: 0, queued: 0, failed: 0, done: 0, comicUpdates: 0 }, integrations: {}
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const readJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || ""); return value == null ? fallback : value; } catch { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };
  const ownerId = () => {
    const user = readJson("hh-auth-user", {}) || {};
    return String(user.id || user._id || user.sub || user.email || "guest").toLowerCase().replace(/[^a-z0-9@._-]/g, "-").slice(0, 120) || "guest";
  };
  const storageKey = () => `${BASE_KEY}:${ownerId()}`;
  const notesKey = () => `${BASE_KEY}.notes:${ownerId()}`;
  const calendarKey = () => `${BASE_KEY}.calendar:${ownerId()}`;

  function normalizePrefs(source = {}) {
    const layout = Array.isArray(source.layout) ? source.layout.filter((id, index, list) => WIDGETS.some((item) => item.id === id) && list.indexOf(id) === index).slice(0, 6) : [...DEFAULT_LAYOUT];
    return {
      layout: layout.length ? layout : [...DEFAULT_LAYOUT],
      theme: THEMES.includes(source.theme) ? source.theme : "aero",
      opacity: clamp(source.opacity || 88, 55, 100),
      locked: source.locked === true,
      collapsed: Array.isArray(source.collapsed) ? source.collapsed.filter((id) => WIDGETS.some((item) => item.id === id)) : [],
      sizes: Object.fromEntries(WIDGETS.map((item) => [item.id, SIZES.includes(source.sizes?.[item.id]) ? source.sizes[item.id] : "medium"])),
      clockStyle: ["flip", "analog", "led", "world"].includes(source.clockStyle) ? source.clockStyle : "flip",
      tickSound: false,
      saveData: source.saveData === true,
      eventPaused: source.eventPaused === true
    };
  }

  function loadPrefs() { prefs = normalizePrefs(readJson(storageKey(), {})); }
  function savePrefs() { writeJson(storageKey(), prefs); }
  function widget(id) { return WIDGETS.find((item) => item.id === id) || WIDGETS[0]; }
  function setTimer(name, callback, delay) { clearInterval(timers.get(name)); const id = setInterval(callback, delay); timers.set(name, id); }
  function stopTimers() { timers.forEach((id) => clearInterval(id)); timers.clear(); cancelAnimationFrame(fpsFrame); fpsFrame = 0; }

  function addEvent(text, tone = "cyan", route = "") {
    if (events.some((item) => item.text === text && Date.now() - item.at < 15000)) return;
    events.unshift({ id: `${Date.now()}-${Math.random()}`, at: Date.now(), text: String(text).slice(0, 120), tone, route });
    events.splice(10);
    if (!prefs?.eventPaused) renderEvents();
  }

  function weatherInfo(code, isDay = true) {
    const rows = [[[0], isDay ? "☀" : "☾", "Trời quang"], [[1, 2], "◒", "Ít mây"], [[3], "☁", "Nhiều mây"], [[45, 48], "≋", "Sương mù"], [[51, 53, 55, 56, 57], "≋", "Mưa phùn"], [[61, 63, 65, 66, 67, 80, 81, 82], "☂", "Có mưa"], [[71, 73, 75, 77, 85, 86], "✧", "Có tuyết"], [[95, 96, 99], "ϟ", "Dông"]];
    const item = rows.find(([codes]) => codes.includes(Number(code))) || [[], "◒", "Thời tiết"];
    return { icon: item[1], label: item[2] };
  }

  function aqiLabel(value) {
    const aqi = Number(value);
    if (!Number.isFinite(aqi)) return "Chưa có AQI";
    if (aqi <= 50) return "Tốt";
    if (aqi <= 100) return "Trung bình";
    if (aqi <= 150) return "Kém cho nhóm nhạy cảm";
    if (aqi <= 200) return "Không lành mạnh";
    if (aqi <= 300) return "Rất không lành mạnh";
    return "Nguy hại";
  }

  async function fetchJson(url, timeoutMs = 6500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function refreshWeather(force = false) {
    const cached = readJson(WEATHER_KEY, null);
    const age = Date.now() - Number(cached?.savedAt || cached?.payload?.savedAt || 0);
    if (cached?.payload?.weather) live.weather = cached;
    if (!force && cached?.payload?.weather && age < 10 * 60 * 1000) { refreshWidgetBodies(["weather"]); updateTopbar(); return; }
    const location = readJson(WEATHER_LOCATION_KEY, null) || cached?.location || { name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 };
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure", hourly: "temperature_2m,precipitation_probability,weather_code", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max", timezone: "auto", forecast_days: "7" });
    const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    airUrl.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, current: "us_aqi,pm2_5,pm10", timezone: "auto" });
    try {
      const [weather, air] = await Promise.all([fetchJson(weatherUrl), fetchJson(airUrl).catch(() => cached?.payload?.air || null)]);
      const savedAt = Date.now();
      live.weather = { payload: { weather, air, savedAt }, location, savedAt };
      writeJson(WEATHER_KEY, live.weather);
      addEvent(`Thời tiết ${location.name} đã cập nhật`, "weather");
    } catch (error) {
      if (!live.weather) addEvent(error?.name === "AbortError" ? "Nguồn thời tiết phản hồi chậm" : "Chưa kết nối được nguồn thời tiết", "warning");
    }
    refreshWidgetBodies(["weather"]); updateTopbar();
    if (activePanel === "weather") renderPanel();
  }

  function requestLocation() {
    if (!navigator.geolocation) return addEvent("Trình duyệt không hỗ trợ định vị", "warning");
    navigator.geolocation.getCurrentPosition((position) => {
      writeJson(WEATHER_LOCATION_KEY, { name: "Vị trí của bạn", latitude: position.coords.latitude, longitude: position.coords.longitude });
      refreshWeather(true);
    }, () => addEvent("Bạn chưa cho phép lấy vị trí; vẫn dùng thành phố đã lưu", "warning"), { timeout: 10000, maximumAge: 600000 });
  }

  function latencyStatus(value) {
    if (!navigator.onLine || value == null) return { label: "Mất kết nối", tone: "offline" };
    if (value < 180) return { label: "Tốt", tone: "good" };
    if (value < 450) return { label: "Bình thường", tone: "normal" };
    return { label: "Chậm", tone: "slow" };
  }

  async function timedFetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 6000);
    const started = performance.now();
    try {
      let response = await fetch(url, { method: options.method || "GET", cache: "no-store", signal: controller.signal, headers: { Accept: options.accept || "application/json" } });
      if (response.status === 405 && options.method === "HEAD") response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = options.json ? await response.json() : null;
      return { ok: true, ms: Math.round(performance.now() - started), data };
    } catch (error) { return { ok: false, ms: null, error: error?.name === "AbortError" ? "timeout" : String(error?.message || "unreachable") }; }
    finally { clearTimeout(timeout); }
  }

  async function probeNetwork() {
    if (document.hidden) return;
    const separator = location.pathname.includes("?") ? "&" : "?";
    const httpUrl = `${location.pathname || "/"}${separator}hlw_probe=${Date.now()}`;
    const [http, api] = await Promise.all([
      timedFetch(httpUrl, { method: "HEAD", accept: "text/html" }),
      timedFetch(`/api/health?hlw_probe=${Date.now()}`, { json: true, timeout: 8500 })
    ]);
    const previousState = live.networkStatus;
    live.http = http;
    live.api = api;
    sessionNetwork.checks += 1;
    if (http.ok) sessionNetwork.successes += 1;
    latencyHistory.push(http.ms);
    apiHistory.push(api.ms);
    if (latencyHistory.length > 12) latencyHistory.shift();
    if (apiHistory.length > 12) apiHistory.shift();
    const status = latencyStatus(http.ms);
    live.networkStatus = status.label;
    if (api.ok && api.data?.health) {
      healthPayload = api.data.health;
      live.integrations = healthPayload.integrations || {
        openai: healthPayload.ai?.openai, gemini: healthPayload.ai?.gemini,
        youtube: healthPayload.search?.youtubeConfigured, resend: healthPayload.auth?.emailVerification
      };
      connectWebSocket(healthPayload.realtime?.url);
    }
    if (previousState && previousState !== live.networkStatus) addEvent(`Kết nối chuyển sang ${live.networkStatus}`, status.tone === "good" ? "network" : "warning");
    if (!api.ok) addEvent("Backend Health chưa phản hồi", "error", "/analytics");
    refreshWidgetBodies(["network", "system", "jobs"]);
    updateTopbar();
    updatePlanetSignals();
    if (["network", "system", "jobs"].includes(activePanel)) renderPanel();
  }

  function connectWebSocket(baseUrl) {
    if (!baseUrl || websocket?.readyState === WebSocket.OPEN || websocket?.readyState === WebSocket.CONNECTING) return;
    try {
      const url = new URL(baseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/socket.io/";
      url.search = "EIO=4&transport=websocket";
      websocketState = { state: "connecting", lastHeartbeat: 0, error: "" };
      websocket = new WebSocket(url);
      websocket.addEventListener("open", () => { websocketState.state = "connected"; websocketState.lastHeartbeat = Date.now(); refreshWidgetBodies(["network"]); });
      websocket.addEventListener("message", (event) => {
        websocketState.lastHeartbeat = Date.now();
        if (event.data === "2") websocket.send("3");
        refreshWidgetBodies(["network"]);
      });
      websocket.addEventListener("close", () => { websocketState.state = "disconnected"; websocket = null; refreshWidgetBodies(["network"]); });
      websocket.addEventListener("error", () => { websocketState.error = "WebSocket không khả dụng"; });
    } catch { websocketState = { state: "unavailable", lastHeartbeat: 0, error: "URL realtime không hợp lệ" }; }
  }

  async function refreshSystem() {
    if (document.hidden) return;
    live.heap = performance.memory ? { used: performance.memory.usedJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null;
    try { live.storage = await navigator.storage?.estimate?.() || null; } catch { live.storage = null; }
    live.serviceWorker = !navigator.serviceWorker ? "Không hỗ trợ" : navigator.serviceWorker.controller ? "Đang điều khiển" : "Chưa kích hoạt";
    if (!battery && navigator.getBattery) {
      try {
        battery = await navigator.getBattery();
        const updateBattery = () => { refreshWidgetBodies(["system"]); updateTopbar(); };
        battery.addEventListener("levelchange", updateBattery);
        battery.addEventListener("chargingchange", updateBattery);
      } catch { battery = null; }
    }
    refreshJobs();
    refreshWidgetBodies(["system", "jobs"]);
    if (["system", "jobs"].includes(activePanel)) renderPanel();
  }

  function countStatuses(value, result, depth = 0) {
    if (!value || depth > 5) return;
    if (Array.isArray(value)) return value.slice(0, 500).forEach((item) => countStatuses(item, result, depth + 1));
    if (typeof value !== "object") return;
    const status = String(value.status || value.state || "").toLowerCase();
    if (["running", "uploading", "rendering", "processing", "downloading"].includes(status)) result.running += 1;
    else if (["queued", "pending", "waiting"].includes(status)) result.queued += 1;
    else if (["error", "failed", "cancelled"].includes(status)) result.failed += 1;
    else if (["done", "complete", "completed", "published"].includes(status)) result.done += 1;
    if (Number(value.newCount) > 0) result.comicUpdates += Number(value.newCount);
    Object.values(value).slice(0, 80).forEach((item) => countStatuses(item, result, depth + 1));
  }

  function refreshJobs() {
    const result = { running: 0, queued: 0, failed: 0, done: 0, comicUpdates: 0 };
    const prefixes = ["hh.video-batch-factory.v2", "hh.comic-motion-studio.v1", "hh.comic-motion-task-center.v1", "hh.youtube-creator-galaxy.v2"];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (!prefixes.some((prefix) => key.startsWith(prefix))) continue;
      countStatuses(readJson(key, null), result);
    }
    const previous = live.jobs;
    live.jobs = result;
    if (previous && previous.running > 0 && result.running === 0 && result.done > previous.done) addEvent("Tác vụ nền đã hoàn tất", "success");
    if (result.comicUpdates > (previous?.comicUpdates || 0)) addEvent(`Có ${result.comicUpdates} chương truyện mới`, "comic", "/entertainment/comics");
    updatePlanetSignals();
  }

  function startFps() {
    cancelAnimationFrame(fpsFrame);
    fpsStarted = performance.now(); fpsCount = 0;
    const sample = (time) => {
      if (!document.hidden) {
        fpsCount += 1;
        if (time - fpsStarted >= 1000) { live.fps = Math.round(fpsCount * 1000 / (time - fpsStarted)); fpsCount = 0; fpsStarted = time; refreshWidgetBodies(["system"]); }
      } else { fpsStarted = time; fpsCount = 0; }
      fpsFrame = requestAnimationFrame(sample);
    };
    fpsFrame = requestAnimationFrame(sample);
  }

  function tick() {
    keepHomeAnchored();
    const now = performance.now();
    live.tabLag = Math.max(0, Math.round(now - tabLagExpected));
    tabLagExpected = now + 1000;
    live.now = new Date();
    updateTopbar();
    refreshWidgetBodies(["clock", "calendar", "pomodoro"]);
    if (activePanel === "clock" || activePanel === "pomodoro") {
      const preview = host?.querySelector(".hlw-clock-preview");
      if (preview) preview.innerHTML = clockBody();
    }
    updateMiniTimers();
  }

  function readCounts() {
    const todos = readJson(TODO_KEY, []);
    const projects = readJson(PROJECT_KEY, {});
    const communication = readJson(COMMUNICATION_KEY, {});
    const learning = readJson(LEARNING_KEY, {});
    const tasks = [...(Array.isArray(todos) ? todos : []), ...(Array.isArray(projects.tasks) ? projects.tasks : [])].filter((item) => item && !item.completed && item.status !== "done" && item.column !== "done");
    const due = tasks.filter((item) => { const date = Date.parse(item.dueAt || item.dueDate || item.deadline || ""); return Number.isFinite(date) && date < Date.now() + 86400000; }).length;
    const unread = Array.isArray(communication.notifications) ? communication.notifications.filter((item) => item && !item.read).length : 0;
    const reviews = Array.isArray(learning.reviews) ? learning.reviews.filter((item) => item && !item.completed).length : 0;
    return { tasks: tasks.length, due, unread, reviews };
  }

  function updatePlanetSignals() {
    if (!root) return;
    const counts = readCounts();
    const backendBad = live.api && !live.api.ok;
    const mapping = {
      work: { active: counts.due > 0, className: "hlw-signal-deadline", text: `${counts.due} việc gần hạn` },
      communication: { active: counts.unread > 0, className: "hlw-signal-notice", text: `${counts.unread} thông báo mới` },
      analytics: { active: backendBad, className: "hlw-signal-error", text: "Backend cần kiểm tra" },
      learning: { active: counts.reviews > 0, className: "hlw-signal-learning", text: `${counts.reviews} bài đến hạn` },
      media: { active: live.jobs.running > 0, className: "hlw-signal-running", text: `${live.jobs.running} tác vụ đang chạy` },
      entertainment: { active: live.jobs.comicUpdates > 0, className: "hlw-signal-comic", text: `${live.jobs.comicUpdates} chương mới` }
    };
    Object.entries(mapping).forEach(([id, signal]) => {
      const planet = root.querySelector(`[data-hgc-planet="${id}"]`);
      if (!planet) return;
      ["hlw-signal-deadline", "hlw-signal-notice", "hlw-signal-error", "hlw-signal-learning", "hlw-signal-running", "hlw-signal-comic"].forEach((name) => planet.classList.remove(name));
      if (signal.active) planet.classList.add(signal.className);
      let badge = planet.querySelector("[data-hlw-planet-badge]");
      if (signal.active && !badge) { badge = document.createElement("span"); badge.dataset.hlwPlanetBadge = ""; planet.append(badge); }
      if (badge) { badge.hidden = !signal.active; badge.textContent = signal.active ? signal.text : ""; }
    });
    root.dataset.hlwBackend = backendBad ? "degraded" : "ok";
    root.dataset.hlwJobs = live.jobs.running > 0 ? "running" : "idle";
  }

  function chartPoints(values, width = 210, height = 42) {
    const safe = values.map((value) => Number.isFinite(value) ? value : 0);
    const max = Math.max(500, ...safe, 1);
    return safe.map((value, index) => `${safe.length < 2 ? 0 : index / (safe.length - 1) * width},${height - clamp(value / max, 0, 1) * (height - 4)}`).join(" ");
  }

  function clockBody() {
    const time = live.now;
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");
    if (prefs.clockStyle === "analog") return `<div class="hlw-analog" style="--hour:${(time.getHours() % 12) * 30 + time.getMinutes() / 2}deg;--minute:${time.getMinutes() * 6}deg;--second:${time.getSeconds() * 6}deg"><i></i><b></b><em></em><span></span></div><small>${hh}:${mm}:${ss} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}</small>`;
    if (prefs.clockStyle === "led") return `<strong class="hlw-led">${hh}:${mm}<i>:${ss}</i></strong><small>LED bảy đoạn · giờ địa phương</small>`;
    if (prefs.clockStyle === "world") return `<div class="hlw-world"><span><b>${hh}:${mm}</b>Bangkok</span><span><b>${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(time)}</b>Tokyo</span><span><b>${new Intl.DateTimeFormat("vi-VN", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(time)}</b>London</span></div>`;
    return `<div class="hlw-flip"><span>${hh}</span><i>:</i><span>${mm}</span><b>${ss}</b></div><small>${time.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long" })}</small>`;
  }

  function weatherBody() {
    const record = live.weather || readJson(WEATHER_KEY, null);
    const current = record?.payload?.weather?.current;
    if (!current) return `<div class="hlw-empty"><b>Chưa có thời tiết</b><small>Đang kết nối Open‑Meteo</small></div>`;
    const info = weatherInfo(current.weather_code, Boolean(current.is_day));
    const aqi = record?.payload?.air?.current?.us_aqi;
    const rain = record?.payload?.weather?.daily?.precipitation_probability_max?.[0];
    return `<div class="hlw-weather-now"><span>${info.icon}</span><div><strong>${Math.round(current.temperature_2m)}°</strong><b>${escapeHtml(info.label)}</b><small>${escapeHtml(record.location?.name || "Địa điểm đã lưu")}</small></div><ul><li>Cảm giác <b>${Math.round(current.apparent_temperature ?? current.temperature_2m)}°</b></li><li>Mưa <b>${Math.round(rain || 0)}%</b></li><li>AQI <b>${Number.isFinite(Number(aqi)) ? Math.round(aqi) : "--"}</b></li></ul></div>`;
  }

  function networkBody() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const status = latencyStatus(live.http?.ms);
    const heartbeatAge = websocketState.lastHeartbeat ? Math.round((Date.now() - websocketState.lastHeartbeat) / 1000) : null;
    return `<div class="hlw-network"><div><strong>${live.http?.ms != null ? `${live.http.ms} ms` : "-- ms"}</strong><span class="is-${status.tone}">${status.label}</span></div><svg viewBox="0 0 210 42" preserveAspectRatio="none" aria-label="Độ trễ HTTP 60 giây"><polyline points="${chartPoints(latencyHistory)}"></polyline></svg><small>HTTP · API ${live.api?.ms != null ? `${live.api.ms} ms` : "--"} · WebSocket ${websocketState.state === "connected" ? `live${heartbeatAge != null ? ` ${heartbeatAge}s` : ""}` : websocketState.state}</small><small>${connection?.effectiveType ? String(connection.effectiveType).toUpperCase() : "Loại mạng không xác định"}${connection?.downlink ? ` · ${connection.downlink} Mbps công bố` : ""}</small></div>`;
  }

  function systemBody() {
    const heap = live.heap ? `${formatBytes(live.heap.used)} / ${formatBytes(live.heap.limit)}` : "Không hỗ trợ";
    const storage = live.storage ? `${formatBytes(live.storage.usage)} / ${formatBytes(live.storage.quota)}` : "Đang đọc";
    return `<div class="hlw-system-grid"><span><b>${live.fps || "--"}</b>FPS tab</span><span><b>${live.tabLag} ms</b>Độ trễ tab</span><span><b>${escapeHtml(heap)}</b>JS heap</span><span><b>${escapeHtml(storage)}</b>Web storage</span></div>`;
  }

  function calendarBody() {
    const now = live.now;
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cells = [...Array((first.getDay() + 6) % 7).fill(0), ...Array.from({ length: days }, (_, index) => index + 1)];
    return `<div class="hlw-calendar"><header><b>${now.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</b><span>${now.getDate()}</span></header><div>${["T2", "T3", "T4", "T5", "T6", "T7", "CN", ...cells].map((day, index) => `<i class="${Number(day) === now.getDate() && index > 6 ? "is-today" : ""}">${day || ""}</i>`).join("")}</div></div>`;
  }

  function appsBody() {
    return `<div class="hlw-app-shortcuts">${[["notes", "▤", "Ghi chú"], ["calculator", "±", "Máy tính"], ["pomodoro", "◉", "Pomodoro"], ["timer", "⌛", "Timer"], ["media", "♫", "Nhạc"], ["recorder", "●", "Ghi âm"]].map(([id, icon, label]) => `<button type="button" data-hlw-mini="${id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div>`;
  }

  function notesBody() {
    const value = readJson(notesKey(), { text: "" });
    return `<div class="hlw-note-preview"><b>${escapeHtml(value.text?.trim().split("\n")[0] || "Ghi chú nhanh")}</b><small>${value.text ? escapeHtml(value.text.slice(0, 90)) : "Bấm để viết; tự lưu theo tài khoản."}</small></div>`;
  }

  function pomodoroBody() {
    const state = readJson(`${BASE_KEY}.pomodoro:${ownerId()}`, { duration: 1500, endAt: 0, running: false });
    const left = state.running ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : state.duration;
    return `<div class="hlw-pomodoro"><strong data-hlw-pomodoro-time>${formatDuration(left)}</strong><small>${state.running ? "Đang tập trung" : "Sẵn sàng 25 phút"}</small></div>`;
  }

  function jobsBody() {
    const jobs = live.jobs;
    return `<div class="hlw-jobs"><span><b>${jobs.running}</b>Đang chạy</span><span><b>${jobs.queued}</b>Chờ</span><span><b>${jobs.failed}</b>Lỗi</span><span><b>${jobs.done}</b>Xong</span>${jobs.comicUpdates ? `<small>${jobs.comicUpdates} chương truyện mới</small>` : ""}</div>`;
  }

  function mediaBody() { return `<div class="hlw-media"><span>♫</span><div><b>Mini player & ghi âm</b><small>Chỉ mở file hoặc microphone khi bạn chủ động chọn.</small></div></div>`; }

  function widgetBody(id) {
    if (id === "clock") return clockBody();
    if (id === "weather") return weatherBody();
    if (id === "network") return networkBody();
    if (id === "system") return systemBody();
    if (id === "calendar") return calendarBody();
    if (id === "apps") return appsBody();
    if (id === "notes") return notesBody();
    if (id === "pomodoro") return pomodoroBody();
    if (id === "jobs") return jobsBody();
    return mediaBody();
  }

  function cardMarkup(id) {
    const item = widget(id);
    const collapsed = prefs.collapsed.includes(id);
    return `<article class="hlw-card is-${prefs.sizes[id]}${collapsed ? " is-collapsed" : ""}" data-hlw-card="${id}" draggable="${!prefs.locked}" style="--hlw-tone:${item.tone}"><header><button type="button" class="hlw-drag" data-hlw-drag aria-label="Kéo đổi vị trí" ${prefs.locked ? "disabled" : ""}>⠿</button><span>${item.icon}</span><div><small>LIVE WIDGET</small><strong>${escapeHtml(item.label)}</strong></div><button type="button" data-hlw-size aria-label="Đổi kích thước">${prefs.sizes[id] === "small" ? "S" : prefs.sizes[id] === "large" ? "L" : "M"}</button><button type="button" data-hlw-collapse aria-label="Thu gọn">${collapsed ? "+" : "−"}</button><button type="button" data-hlw-open="${id}" aria-label="Mở rộng">↗</button></header><div class="hlw-card-body" data-hlw-body="${id}">${widgetBody(id)}</div></article>`;
  }

  function renderDeck() {
    const deck = host?.querySelector("[data-hlw-deck]");
    if (!deck) return;
    const pageCount = Math.max(1, Math.ceil(prefs.layout.length / 2));
    page = clamp(page, 0, pageCount - 1);
    const ids = prefs.layout.slice(page * 2, page * 2 + 2);
    deck.innerHTML = ids.map(cardMarkup).join("");
    const indicator = host.querySelector("[data-hlw-page]");
    if (indicator) indicator.textContent = `${page + 1}/${pageCount}`;
    host.querySelectorAll("[data-hlw-step]").forEach((button) => { button.disabled = pageCount <= 1; });
  }

  function refreshWidgetBodies(ids = prefs?.layout || []) {
    if (!host || !prefs) return;
    ids.forEach((id) => host.querySelectorAll(`[data-hlw-body="${id}"]`).forEach((node) => { node.innerHTML = widgetBody(id); }));
  }

  function shellMarkup() {
    return `<section class="hlw" data-hlw-root data-hlw-theme="${prefs.theme}" style="--hlw-opacity:${prefs.opacity / 100}">
      <header class="hlw-toolbar"><div><small>LIVE WIDGET RACK</small><strong>Dữ liệu đang hoạt động</strong></div><span data-hlw-live-dot>LIVE</span><button type="button" data-hlw-step="-1" aria-label="Trang trước">←</button><b data-hlw-page>1/3</b><button type="button" data-hlw-step="1" aria-label="Trang sau">→</button><button type="button" data-hlw-settings aria-label="Cài đặt Widget Rack">⚙</button></header>
      <div class="hlw-deck" data-hlw-deck></div>
      <footer><button type="button" data-hlw-add>＋ Thêm widget</button><button type="button" data-hlw-lock>${prefs.locked ? "🔒 Đã khóa" : "◇ Khóa bố cục"}</button></footer>
      <aside class="hlw-panel" data-hlw-panel hidden></aside>
      <aside class="hlw-picker" data-hlw-picker hidden></aside>
    </section>`;
  }

  function panelHeader(title, subtitle = "") { return `<header><button type="button" data-hlw-panel-close aria-label="Đóng">←</button><div><small>${escapeHtml(subtitle)}</small><h3>${escapeHtml(title)}</h3></div><button type="button" data-hlw-panel-close aria-label="Đóng">×</button></header>`; }

  function weatherPanel() {
    const record = live.weather || readJson(WEATHER_KEY, null);
    const weather = record?.payload?.weather;
    const current = weather?.current;
    if (!current) return `${panelHeader("Weather Station", "OPEN‑METEO")}<div class="hlw-panel-empty"><p>Chưa có dữ liệu thời tiết.</p><button type="button" data-hlw-weather-refresh>Kết nối lại</button></div>`;
    const daily = weather.daily || {};
    const air = record?.payload?.air?.current || {};
    const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--";
    const sunset = daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--";
    const start = Math.max(0, weather.hourly?.time?.findIndex((value) => Date.parse(value) >= Date.now()) || 0);
    const hours = (weather.hourly?.time || []).slice(start, start + 6).map((value, index) => ({ value, temp: weather.hourly.temperature_2m?.[start + index], rain: weather.hourly.precipitation_probability?.[start + index], code: weather.hourly.weather_code?.[start + index] }));
    return `${panelHeader("Weather Station", record.location?.name || "Địa điểm đã lưu")}<div class="hlw-weather-hero">${weatherBody()}</div><div class="hlw-detail-grid"><span><b>${Math.round(current.relative_humidity_2m || 0)}%</b>Độ ẩm</span><span><b>${Math.round(current.wind_speed_10m || 0)} km/h</b>Gió</span><span><b>${Math.round(daily.uv_index_max?.[0] || 0)}</b>UV</span><span><b>${sunrise}</b>Bình minh</span><span><b>${sunset}</b>Hoàng hôn</span><span><b>${Number.isFinite(Number(air.us_aqi)) ? Math.round(air.us_aqi) : "--"}</b>${escapeHtml(aqiLabel(air.us_aqi))}</span></div><div class="hlw-hourly">${hours.map((hour) => `<span><small>${new Date(hour.value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small><b>${weatherInfo(hour.code).icon}</b><strong>${Math.round(hour.temp || 0)}°</strong><em>☂ ${Math.round(hour.rain || 0)}%</em></span>`).join("")}</div><footer><button type="button" data-hlw-location>⌖ Vị trí của tôi</button><button type="button" data-hlw-weather-refresh>↻ Làm mới</button></footer>`;
  }

  function networkPanel() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const uptime = sessionNetwork.checks ? Math.round(sessionNetwork.successes / sessionNetwork.checks * 100) : 0;
    return `${panelHeader("Network & Latency", "HTTP / API / WEBSOCKET")}<div class="hlw-network-summary"><span><small>Độ trễ HTTP</small><strong>${live.http?.ms != null ? `${live.http.ms} ms` : "--"}</strong><em>${latencyStatus(live.http?.ms).label}</em></span><span><small>Độ trễ API</small><strong>${live.api?.ms != null ? `${live.api.ms} ms` : "--"}</strong><em>${live.api?.ok ? "Phản hồi" : "Gián đoạn"}</em></span><span><small>WebSocket heartbeat</small><strong>${websocketState.state === "connected" ? "LIVE" : "--"}</strong><em>${escapeHtml(websocketState.state)}</em></span></div><div class="hlw-big-chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="${chartPoints(latencyHistory, 300, 100)}"></polyline><polyline class="is-api" points="${chartPoints(apiHistory, 300, 100)}"></polyline></svg><span>60 giây gần nhất · HTTP xanh · API tím</span></div><div class="hlw-detail-list"><span><b>Tốc độ trình duyệt công bố</b><em>${connection?.downlink ? `${connection.downlink} Mbps` : "Không hỗ trợ"}</em></span><span><b>Loại mạng</b><em>${connection?.effectiveType ? String(connection.effectiveType).toUpperCase() : "Không xác định"}</em></span><span><b>RTT trình duyệt công bố</b><em>${Number.isFinite(connection?.rtt) ? `${connection.rtt} ms` : "Không hỗ trợ"}</em></span><span><b>Uptime trong phiên</b><em>${uptime}% · ${sessionNetwork.successes}/${sessionNetwork.checks}</em></span></div><p class="hlw-truth">Trình duyệt đo HTTP/WebSocket, không phải ICMP ping như Command Prompt.</p><footer><button type="button" data-hlw-network-refresh>↻ Đo ngay</button></footer>`;
  }

  function integrationRows() {
    const rows = [["OpenAI", live.integrations.openai], ["Gemini", live.integrations.gemini], ["YouTube", live.integrations.youtube], ["Facebook", live.integrations.facebook], ["Resend", live.integrations.resend]];
    return rows.map(([name, state]) => `<span><b>${name}</b><em class="${state === true ? "is-on" : state === false ? "is-off" : ""}">${state === true ? "Đã cấu hình" : state === false ? "Chưa cấu hình" : "Backend chưa công bố"}</em></span>`).join("");
  }

  function systemPanel() {
    return `${panelHeader("System Monitor", "DỮ LIỆU TRÌNH DUYỆT THẬT")}<div class="hlw-system-hero">${systemBody()}</div><div class="hlw-detail-list"><span><b>Service Worker / PWA</b><em>${escapeHtml(live.serviceWorker)}</em></span><span><b>Pin</b><em>${battery ? `${Math.round(battery.level * 100)}%${battery.charging ? " · đang sạc" : ""}` : "Không hỗ trợ"}</em></span><span><b>Tác vụ nền</b><em>${live.jobs.running} chạy · ${live.jobs.queued} chờ</em></span><span><b>Realtime server</b><em>${healthPayload?.realtime?.connected ? "Đã kết nối" : healthPayload ? "Gián đoạn" : "Đang đo"}</em></span></div><h4>Trạng thái tích hợp backend</h4><div class="hlw-integrations">${integrationRows()}</div><p class="hlw-truth">FPS, heap và độ trễ chỉ thuộc tab website này; không phải CPU/RAM toàn máy.</p>`;
  }

  function clockPanel() {
    return `${panelHeader("Clock Studio", "FLIP · ANALOG · LED · WORLD")}<div class="hlw-clock-preview">${clockBody()}</div><div class="hlw-clock-styles">${[["flip", "Flip"], ["analog", "Analog"], ["led", "LED"], ["world", "Thế giới"]].map(([id, label]) => `<button type="button" data-hlw-clock-style="${id}" aria-pressed="${prefs.clockStyle === id}">${label}</button>`).join("")}</div><div class="hlw-mini-tabs">${[["pomodoro", "Pomodoro"], ["timer", "Timer"], ["stopwatch", "Stopwatch"], ["countdown", "Sự kiện"]].map(([id, label]) => `<button type="button" data-hlw-mini="${id}">${label}</button>`).join("")}</div><div data-hlw-inline-mini>${miniMarkup(activeMini)}</div>`;
  }

  function formatDuration(seconds) { const safe = Math.max(0, Math.ceil(Number(seconds) || 0)); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }
  function timerState(name, defaults) { return readJson(`${BASE_KEY}.${name}:${ownerId()}`, defaults); }
  function saveTimerState(name, value) { writeJson(`${BASE_KEY}.${name}:${ownerId()}`, value); }

  function miniMarkup(id) {
    if (id === "notes") {
      const note = readJson(notesKey(), { text: "", color: "yellow" });
      return `<section class="hlw-mini-app"><header><span>▤</span><div><b>Sticky Notes</b><small>Tự lưu theo tài khoản</small></div></header><textarea data-hlw-note maxlength="4000" placeholder="Viết ghi chú nhanh…">${escapeHtml(note.text || "")}</textarea><div class="hlw-note-colors">${["yellow", "mint", "pink", "blue"].map((color) => `<button type="button" data-hlw-note-color="${color}" class="is-${color}" aria-label="Màu ${color}"></button>`).join("")}</div></section>`;
    }
    if (id === "calculator") return `<section class="hlw-mini-app"><header><span>±</span><div><b>Máy tính nhanh</b><small>Phép tính cục bộ</small></div></header><output data-hlw-calc-output>0</output><div class="hlw-calc">${["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "⌫", "="].map((key) => `<button type="button" data-hlw-calc="${key}">${key}</button>`).join("")}</div></section>`;
    if (id === "pomodoro") {
      const state = timerState("pomodoro", { duration: 1500, endAt: 0, running: false });
      const left = state.running ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : state.duration;
      return `<section class="hlw-mini-app"><header><span>◉</span><div><b>Pomodoro</b><small>25 phút tập trung · 5 phút nghỉ</small></div></header><strong class="hlw-timer-display" data-hlw-timer-display="pomodoro">${formatDuration(left)}</strong><div class="hlw-mini-actions"><button type="button" data-hlw-timer-action="pomodoro:start">${state.running ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-hlw-timer-action="pomodoro:reset">Đặt lại</button><button type="button" data-hlw-timer-action="pomodoro:break">Nghỉ 5 phút</button></div></section>`;
    }
    if (id === "timer") {
      const state = timerState("timer", { duration: 300, endAt: 0, running: false });
      const left = state.running ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : state.duration;
      return `<section class="hlw-mini-app"><header><span>⌛</span><div><b>Timer</b><small>Đếm ngược</small></div></header><strong class="hlw-timer-display" data-hlw-timer-display="timer">${formatDuration(left)}</strong><label>Số phút<input type="number" min="1" max="1440" value="${Math.max(1, Math.round(state.duration / 60))}" data-hlw-timer-minutes></label><div class="hlw-mini-actions"><button type="button" data-hlw-timer-action="timer:start">${state.running ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-hlw-timer-action="timer:reset">Đặt lại</button></div></section>`;
    }
    if (id === "stopwatch") {
      const state = timerState("stopwatch", { elapsed: 0, startedAt: 0, running: false });
      const elapsed = state.running ? state.elapsed + Date.now() - state.startedAt : state.elapsed;
      return `<section class="hlw-mini-app"><header><span>◷</span><div><b>Stopwatch</b><small>Bấm giờ chính xác trong phiên</small></div></header><strong class="hlw-timer-display" data-hlw-stopwatch>${formatDuration(elapsed / 1000)}</strong><div class="hlw-mini-actions"><button type="button" data-hlw-stopwatch-action="toggle">${state.running ? "Dừng" : "Bắt đầu"}</button><button type="button" data-hlw-stopwatch-action="reset">Đặt lại</button></div></section>`;
    }
    if (id === "countdown") {
      const event = readJson(calendarKey(), { title: "Deadline tiếp theo", at: "" });
      const seconds = event.at ? Math.max(0, Math.ceil((Date.parse(event.at) - Date.now()) / 1000)) : 0;
      return `<section class="hlw-mini-app"><header><span>▦</span><div><b>Đếm ngược sự kiện</b><small>Lưu trên thiết bị</small></div></header><strong class="hlw-countdown" data-hlw-countdown>${event.at ? `${Math.floor(seconds / 86400)} ngày · ${formatDuration(seconds % 86400)}` : "Chưa đặt"}</strong><label>Tên sự kiện<input type="text" maxlength="80" value="${escapeHtml(event.title || "")}" data-hlw-event-title></label><label>Thời gian<input type="datetime-local" value="${escapeHtml(event.at || "")}" data-hlw-event-at></label><button type="button" data-hlw-event-save>Lưu sự kiện</button></section>`;
    }
    if (id === "media") return `<section class="hlw-mini-app"><header><span>♫</span><div><b>Trình phát nhạc mini</b><small>File chỉ ở trên máy bạn</small></div></header><label class="hlw-file">Chọn audio<input type="file" accept="audio/*" data-hlw-audio-file></label><audio controls data-hlw-audio ${audioObjectUrl ? `src="${escapeHtml(audioObjectUrl)}"` : ""}></audio></section>`;
    if (id === "recorder") return `<section class="hlw-mini-app"><header><span>●</span><div><b>Ghi âm nhanh</b><small>Microphone chỉ bật sau khi bạn bấm</small></div></header><div class="hlw-mini-actions"><button type="button" data-hlw-record="start" ${recorder?.state === "recording" ? "disabled" : ""}>Bắt đầu ghi</button><button type="button" data-hlw-record="stop" ${recorder?.state !== "recording" ? "disabled" : ""}>Dừng</button></div><audio controls data-hlw-recorded></audio><p class="hlw-truth">Bản ghi không tự tải lên máy chủ.</p></section>`;
    if (id === "jobs") return `<section class="hlw-mini-app"><header><span>⇣</span><div><b>Tác vụ nền</b><small>Upload · download · render đã lưu thật</small></div></header>${jobsBody()}<button type="button" data-hlw-route="/davinci-resolve">Mở trung tâm công cụ</button></section>`;
    return `<section class="hlw-mini-app"><p>Chọn một ứng dụng mini.</p></section>`;
  }

  function appsPanel() { return `${panelHeader("Mini Apps", "MỞ TẠI CHỖ · KHÔNG CHUYỂN TRANG")}<div class="hlw-app-menu">${[["notes", "▤", "Sticky Notes"], ["calculator", "±", "Máy tính"], ["pomodoro", "◉", "Pomodoro"], ["timer", "⌛", "Timer"], ["stopwatch", "◷", "Stopwatch"], ["countdown", "▦", "Sự kiện"], ["media", "♫", "Nhạc mini"], ["recorder", "●", "Ghi âm"], ["jobs", "⇣", "Tác vụ"]].map(([id, icon, label]) => `<button type="button" data-hlw-mini="${id}" aria-pressed="${activeMini === id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div><div data-hlw-inline-mini>${miniMarkup(activeMini)}</div>`; }

  function calendarPanel() { return `${panelHeader("Lịch mini", "THÁNG NÀY")}<div class="hlw-calendar-large">${calendarBody()}</div><div data-hlw-inline-mini>${miniMarkup("countdown")}</div>`; }
  function jobsPanel() { return `${panelHeader("Tác vụ đang chạy", "DỮ LIỆU CỤC BỘ THẬT")}<div class="hlw-jobs-large">${jobsBody()}</div><div class="hlw-detail-list"><span><b>Video Batch Factory</b><em>Đọc hàng đợi theo tài khoản</em></span><span><b>Comic Motion Studio</b><em>Render queue và chương mới</em></span><span><b>YouTube Creator</b><em>Chỉ hiển thị trạng thái đã lưu, không đọc token</em></span></div><button type="button" data-hlw-route="/davinci-resolve">Mở Tool Center</button>`; }

  function renderPanel() {
    const panel = host?.querySelector("[data-hlw-panel]");
    if (!panel) return;
    if (!activePanel) { panel.hidden = true; panel.innerHTML = ""; return; }
    panel.hidden = false;
    if (activePanel === "weather") panel.innerHTML = weatherPanel();
    else if (activePanel === "network") panel.innerHTML = networkPanel();
    else if (activePanel === "system") panel.innerHTML = systemPanel();
    else if (activePanel === "clock" || activePanel === "pomodoro") panel.innerHTML = clockPanel();
    else if (activePanel === "calendar") panel.innerHTML = calendarPanel();
    else if (activePanel === "jobs") panel.innerHTML = jobsPanel();
    else if (activePanel === "notes") { activeMini = "notes"; panel.innerHTML = appsPanel(); }
    else if (activePanel === "media") { activeMini = "media"; panel.innerHTML = appsPanel(); }
    else panel.innerHTML = appsPanel();
  }

  function renderPicker() {
    const picker = host?.querySelector("[data-hlw-picker]");
    if (!picker) return;
    picker.hidden = false;
    picker.innerHTML = `${panelHeader("Cá nhân hóa Widget Rack", "TỐI ĐA 6 WIDGET")}<div class="hlw-picker-grid">${WIDGETS.map((item) => `<label><input type="checkbox" data-hlw-widget-toggle="${item.id}" ${prefs.layout.includes(item.id) ? "checked" : ""} ${!prefs.layout.includes(item.id) && prefs.layout.length >= 6 ? "disabled" : ""}><span style="--hlw-tone:${item.tone}">${item.icon}</span><b>${escapeHtml(item.label)}</b></label>`).join("")}</div><label class="hlw-select">Theme<select data-hlw-theme>${[["aero", "Aero Glass"], ["classic", "Classic Gadget"], ["neon", "Neon Galaxy"], ["crt", "Retro CRT"], ["minimal", "Minimal Dark"], ["cyber", "Cyberpunk"]].map(([id, label]) => `<option value="${id}" ${prefs.theme === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="hlw-range">Độ trong suốt <b>${prefs.opacity}%</b><input type="range" min="55" max="100" value="${prefs.opacity}" data-hlw-opacity></label><div class="hlw-picker-actions"><button type="button" data-hlw-reset>Khôi phục mặc định</button><button type="button" data-hlw-picker-close>Hoàn tất</button></div>`;
  }

  function renderEvents() {
    const bar = root?.querySelector("[data-hlw-event-bar]");
    if (!bar) return;
    const items = events.length ? events : [{ at: Date.now(), text: "Đang chờ tín hiệu live đầu tiên", tone: "cyan", route: "" }];
    bar.innerHTML = `<span><i></i> LIVE EVENT STREAM</span><div>${items.slice(0, 8).map((item) => `<button type="button" class="is-${item.tone}" ${item.route ? `data-hlw-route="${escapeHtml(item.route)}"` : ""}><time>${new Date(item.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><b>${escapeHtml(item.text)}</b></button>`).join("")}</div><button type="button" data-hlw-events-pause aria-pressed="${prefs?.eventPaused === true}">${prefs?.eventPaused ? "▶" : "Ⅱ"}</button>`;
    bar.classList.toggle("is-paused", prefs?.eventPaused === true);
  }

  function updateTopbar() {
    if (!root) return;
    const record = live.weather || readJson(WEATHER_KEY, null);
    const current = record?.payload?.weather?.current;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const values = {
      clock: live.now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      weather: current ? `${Math.round(current.temperature_2m)}° · ${weatherInfo(current.weather_code, current.is_day).label}` : "Đang tải",
      http: live.http?.ms != null ? `${live.http.ms} ms` : navigator.onLine ? "Đang đo" : "Offline",
      api: live.api?.ms != null ? `${live.api.ms} ms` : live.api && !live.api.ok ? "Gián đoạn" : "Đang đo",
      network: connection?.effectiveType ? `${String(connection.effectiveType).toUpperCase()}${connection.downlink ? ` · ${connection.downlink} Mbps` : ""}` : navigator.onLine ? "Online" : "Offline",
      notifications: String(readCounts().unread)
    };
    Object.entries(values).forEach(([key, value]) => root.querySelectorAll(`[data-hlw-status="${key}"]`).forEach((node) => { node.textContent = value; }));
  }

  function updateMiniTimers() {
    const pomodoro = timerState("pomodoro", { duration: 1500, endAt: 0, running: false });
    const timer = timerState("timer", { duration: 300, endAt: 0, running: false });
    [["pomodoro", pomodoro], ["timer", timer]].forEach(([name, state]) => {
      const left = state.running ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : state.duration;
      root?.querySelectorAll(`[data-hlw-timer-display="${name}"]`).forEach((node) => { node.textContent = formatDuration(left); });
      if (state.running && left === 0) { state.running = false; state.duration = name === "pomodoro" ? 1500 : state.duration; saveTimerState(name, state); addEvent(`${name === "pomodoro" ? "Pomodoro" : "Timer"} đã hoàn tất`, "success"); }
    });
    const stopwatch = timerState("stopwatch", { elapsed: 0, startedAt: 0, running: false });
    const elapsed = stopwatch.running ? stopwatch.elapsed + Date.now() - stopwatch.startedAt : stopwatch.elapsed;
    root?.querySelectorAll("[data-hlw-stopwatch]").forEach((node) => { node.textContent = formatDuration(elapsed / 1000); });
    const event = readJson(calendarKey(), { title: "", at: "" });
    const seconds = event.at ? Math.max(0, Math.ceil((Date.parse(event.at) - Date.now()) / 1000)) : 0;
    root?.querySelectorAll("[data-hlw-countdown]").forEach((node) => { node.textContent = event.at ? `${Math.floor(seconds / 86400)} ngày · ${formatDuration(seconds % 86400)}` : "Chưa đặt"; });
  }

  function calculate(expression) {
    const source = String(expression).replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
    if (!/^[\d+\-*/().\s]+$/.test(source)) throw new Error("Biểu thức không hợp lệ");
    const tokens = source.match(/\d*\.?\d+|[()+\-*/]/g) || [];
    const output = []; const operators = []; const priority = { "+": 1, "-": 1, "*": 2, "/": 2 };
    tokens.forEach((token) => {
      if (/\d/.test(token[0])) output.push(Number(token));
      else if (token === "(") operators.push(token);
      else if (token === ")") { while (operators.length && operators.at(-1) !== "(") output.push(operators.pop()); if (operators.pop() !== "(") throw new Error("Thiếu ngoặc"); }
      else { while (operators.length && priority[operators.at(-1)] >= priority[token]) output.push(operators.pop()); operators.push(token); }
    });
    while (operators.length) output.push(operators.pop());
    const stack = [];
    output.forEach((token) => { if (typeof token === "number") stack.push(token); else { const b = stack.pop(); const a = stack.pop(); if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Biểu thức không hợp lệ"); stack.push(token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : a / b); } });
    if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error("Không thể tính");
    return Math.round(stack[0] * 1e10) / 1e10;
  }

  function handleTimerAction(value) {
    const [name, action] = String(value).split(":");
    const defaults = name === "pomodoro" ? { duration: 1500, endAt: 0, running: false } : { duration: 300, endAt: 0, running: false };
    const state = timerState(name, defaults);
    if (action === "start") {
      if (state.running) { state.duration = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)); state.running = false; }
      else { state.endAt = Date.now() + state.duration * 1000; state.running = true; }
    } else if (action === "break") { state.duration = 300; state.endAt = Date.now() + 300000; state.running = true; }
    else { state.duration = name === "pomodoro" ? 1500 : clamp(host?.querySelector("[data-hlw-timer-minutes]")?.value || 5, 1, 1440) * 60; state.running = false; state.endAt = 0; }
    saveTimerState(name, state); renderPanel(); refreshWidgetBodies(["pomodoro"]);
  }

  async function handleRecording(action) {
    if (action === "start") {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return addEvent("Trình duyệt không hỗ trợ ghi âm", "warning");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorderChunks = [];
        recorder = new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", (event) => { if (event.data.size) recorderChunks.push(event.data); });
        recorder.addEventListener("stop", () => {
          stream.getTracks().forEach((track) => track.stop());
          if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
          audioObjectUrl = URL.createObjectURL(new Blob(recorderChunks, { type: recorder.mimeType || "audio/webm" }));
          const audio = host?.querySelector("[data-hlw-recorded]"); if (audio) audio.src = audioObjectUrl;
          addEvent("Bản ghi âm đã sẵn sàng trên thiết bị", "success"); renderPanel();
        });
        recorder.start(); renderPanel();
      } catch { addEvent("Không mở được microphone; hãy kiểm tra quyền trình duyệt", "warning"); }
    } else if (recorder?.state === "recording") recorder.stop();
  }

  function navigate(route) { if (/^\/[a-z0-9/_-]+$/i.test(route || "")) location.hash = `#${route}`; }

  function keepHomeAnchored() {
    const home = root?.closest?.('[data-shell-view="home"]');
    if (home?.scrollTop) home.scrollTop = 0;
  }

  function onClick(event) {
    keepHomeAnchored();
    requestAnimationFrame(keepHomeAnchored);
    const step = event.target.closest("[data-hlw-step]");
    if (step) { const count = Math.max(1, Math.ceil(prefs.layout.length / 2)); page = (page + Number(step.dataset.hlwStep) + count) % count; return renderDeck(); }
    if (event.target.closest("[data-hlw-settings], [data-hlw-add]")) return renderPicker();
    if (event.target.closest("[data-hlw-picker-close]")) { const picker = host.querySelector("[data-hlw-picker]"); picker.hidden = true; picker.innerHTML = ""; return; }
    if (event.target.closest("[data-hlw-panel-close]")) { activePanel = ""; return renderPanel(); }
    const open = event.target.closest("[data-hlw-open]"); if (open) { activePanel = open.dataset.hlwOpen; return renderPanel(); }
    const mini = event.target.closest("[data-hlw-mini]"); if (mini) { activeMini = mini.dataset.hlwMini; if (!activePanel) activePanel = "apps"; return renderPanel(); }
    const card = event.target.closest("[data-hlw-card]");
    if (event.target.closest("[data-hlw-collapse]") && card) { const id = card.dataset.hlwCard; prefs.collapsed = prefs.collapsed.includes(id) ? prefs.collapsed.filter((item) => item !== id) : [...prefs.collapsed, id]; savePrefs(); return renderDeck(); }
    if (event.target.closest("[data-hlw-size]") && card) { const id = card.dataset.hlwCard; prefs.sizes[id] = SIZES[(SIZES.indexOf(prefs.sizes[id]) + 1) % SIZES.length]; savePrefs(); return renderDeck(); }
    if (event.target.closest("[data-hlw-lock]")) { prefs.locked = !prefs.locked; savePrefs(); host.innerHTML = shellMarkup(); renderDeck(); renderEvents(); updateTopbar(); return; }
    if (event.target.closest("[data-hlw-reset]")) { prefs = normalizePrefs({}); savePrefs(); page = 0; const picker = host.querySelector("[data-hlw-picker]"); picker.hidden = true; picker.innerHTML = ""; root.dataset.hlwTheme = prefs.theme; root.style.setProperty("--hlw-opacity", prefs.opacity / 100); return renderDeck(); }
    if (event.target.closest("[data-hlw-location]")) return requestLocation();
    if (event.target.closest("[data-hlw-weather-refresh]")) return refreshWeather(true);
    if (event.target.closest("[data-hlw-network-refresh]")) return probeNetwork();
    const clockStyle = event.target.closest("[data-hlw-clock-style]"); if (clockStyle) { prefs.clockStyle = clockStyle.dataset.hlwClockStyle; savePrefs(); refreshWidgetBodies(["clock"]); return renderPanel(); }
    const timerAction = event.target.closest("[data-hlw-timer-action]"); if (timerAction) return handleTimerAction(timerAction.dataset.hlwTimerAction);
    const stopwatchAction = event.target.closest("[data-hlw-stopwatch-action]");
    if (stopwatchAction) { const state = timerState("stopwatch", { elapsed: 0, startedAt: 0, running: false }); if (stopwatchAction.dataset.hlwStopwatchAction === "reset") Object.assign(state, { elapsed: 0, startedAt: 0, running: false }); else if (state.running) { state.elapsed += Date.now() - state.startedAt; state.running = false; } else { state.startedAt = Date.now(); state.running = true; } saveTimerState("stopwatch", state); return renderPanel(); }
    const calc = event.target.closest("[data-hlw-calc]");
    if (calc) { const output = host.querySelector("[data-hlw-calc-output]"); const key = calc.dataset.hlwCalc; if (!output) return; if (key === "C") output.value = output.textContent = "0"; else if (key === "⌫") output.value = output.textContent = String(output.value || output.textContent).slice(0, -1) || "0"; else if (key === "=") { try { output.value = output.textContent = String(calculate(output.value || output.textContent)); } catch { output.value = output.textContent = "Lỗi"; } } else { const current = output.value || output.textContent; output.value = output.textContent = current === "0" || current === "Lỗi" ? key : `${current}${key}`; } return; }
    if (event.target.closest("[data-hlw-event-save]")) { const title = host.querySelector("[data-hlw-event-title]")?.value.trim().slice(0, 80) || "Sự kiện"; const at = host.querySelector("[data-hlw-event-at]")?.value || ""; writeJson(calendarKey(), { title, at }); addEvent(`Đã lưu lịch: ${title}`, "calendar"); return renderPanel(); }
    const record = event.target.closest("[data-hlw-record]"); if (record) return handleRecording(record.dataset.hlwRecord);
    const pause = event.target.closest("[data-hlw-events-pause]"); if (pause) { prefs.eventPaused = !prefs.eventPaused; savePrefs(); return renderEvents(); }
    const route = event.target.closest("[data-hlw-route]"); if (route) return navigate(route.dataset.hlwRoute);
  }

  function onInput(event) {
    if (event.target.matches("[data-hlw-note]")) { const saved = readJson(notesKey(), { color: "yellow" }); writeJson(notesKey(), { ...saved, text: event.target.value, updatedAt: Date.now() }); refreshWidgetBodies(["notes"]); }
    if (event.target.matches("[data-hlw-opacity]")) { prefs.opacity = clamp(event.target.value, 55, 100); root.style.setProperty("--hlw-opacity", prefs.opacity / 100); const label = event.target.closest("label")?.querySelector("b"); if (label) label.textContent = `${prefs.opacity}%`; savePrefs(); }
    if (event.target.matches("[data-hlw-timer-minutes]")) { const state = timerState("timer", { duration: 300, endAt: 0, running: false }); if (!state.running) { state.duration = clamp(event.target.value, 1, 1440) * 60; saveTimerState("timer", state); updateMiniTimers(); } }
  }

  function onChange(event) {
    if (event.target.matches("[data-hlw-theme]")) { prefs.theme = THEMES.includes(event.target.value) ? event.target.value : "aero"; root.dataset.hlwTheme = prefs.theme; savePrefs(); }
    if (event.target.matches("[data-hlw-widget-toggle]")) { const id = event.target.dataset.hlwWidgetToggle; if (event.target.checked && !prefs.layout.includes(id) && prefs.layout.length < 6) prefs.layout.push(id); else if (!event.target.checked) prefs.layout = prefs.layout.filter((item) => item !== id); if (!prefs.layout.length) prefs.layout = ["clock"]; page = Math.min(page, Math.ceil(prefs.layout.length / 2) - 1); savePrefs(); renderDeck(); renderPicker(); }
    if (event.target.matches("[data-hlw-audio-file]")) { const file = event.target.files?.[0]; if (!file) return; if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl); audioObjectUrl = URL.createObjectURL(file); const audio = host.querySelector("[data-hlw-audio]"); if (audio) { audio.src = audioObjectUrl; audio.play().catch(() => {}); } }
  }

  function bind() {
    host.addEventListener("click", onClick);
    host.addEventListener("input", onInput);
    host.addEventListener("change", onChange);
    host.addEventListener("dragstart", (event) => { const card = event.target.closest("[data-hlw-card]"); if (!card || prefs.locked) return event.preventDefault(); draggedId = card.dataset.hlwCard; event.dataTransfer?.setData("text/plain", draggedId); });
    host.addEventListener("dragover", (event) => { if (draggedId && event.target.closest("[data-hlw-card]")) event.preventDefault(); });
    host.addEventListener("drop", (event) => { const target = event.target.closest("[data-hlw-card]")?.dataset.hlwCard; if (!draggedId || !target || draggedId === target) return; event.preventDefault(); const from = prefs.layout.indexOf(draggedId); const to = prefs.layout.indexOf(target); prefs.layout.splice(to, 0, prefs.layout.splice(from, 1)[0]); draggedId = ""; savePrefs(); renderDeck(); });
    const eventBar = root.querySelector("[data-hlw-event-bar]");
    const onEventBarClick = (event) => {
      const pause = event.target.closest("[data-hlw-events-pause]");
      if (pause) { prefs.eventPaused = !prefs.eventPaused; savePrefs(); renderEvents(); return; }
      const route = event.target.closest("[data-hlw-route]");
      if (route) navigate(route.dataset.hlwRoute);
    };
    listeners.push([window, "online", () => { addEvent("Kết nối mạng đã trở lại", "success"); probeNetwork(); }], [window, "offline", () => { live.networkStatus = "Mất kết nối"; addEvent("Trình duyệt đang offline", "error"); updateTopbar(); refreshWidgetBodies(["network"]); }], [document, "visibilitychange", onVisibility], [window, "storage", onStorage]);
    if (eventBar) listeners.push([eventBar, "click", onEventBarClick]);
    listeners.forEach(([target, name, handler]) => target.addEventListener(name, handler));
  }

  function onStorage(event) { if (!event.key || event.key.startsWith("hh.")) { refreshJobs(); refreshWidgetBodies(); updatePlanetSignals(); } }
  function onVisibility() {
    if (document.hidden) { timers.forEach((id) => clearInterval(id)); timers.clear(); if (websocket) { websocket.close(); websocket = null; } return; }
    startScheduler(); probeNetwork(); refreshWeather(); refreshSystem();
  }

  function startScheduler() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const slow = prefs.saveData || connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    stopTimers();
    startFps();
    tabLagExpected = performance.now() + 1000;
    setTimer("clock", tick, 1000);
    setTimer("network", probeNetwork, slow ? 16000 : 8000);
    setTimer("system", refreshSystem, slow ? 60000 : 30000);
    setTimer("weather", refreshWeather, slow ? 30 * 60 * 1000 : 12 * 60 * 1000);
  }

  function unmount() {
    stopTimers();
    if (websocket) websocket.close(); websocket = null;
    listeners.splice(0).forEach(([target, name, handler]) => target.removeEventListener(name, handler));
    host = null; root = null;
  }

  function mount(galaxyRoot = document.querySelector("[data-hgc-root]"), force = false) {
    const nextHost = galaxyRoot?.querySelector("[data-hlw-host]");
    if (!galaxyRoot || !nextHost) return false;
    if (!force && root === galaxyRoot && host === nextHost && host.querySelector("[data-hlw-root]")) return true;
    if (host && host !== nextHost) unmount();
    root = galaxyRoot; host = nextHost; loadPrefs();
    host.innerHTML = shellMarkup();
    bind();
    const introKey = `${INTRO_KEY}:${ownerId()}`;
    if (!localStorage.getItem(introKey)) {
      root.querySelector('[data-hgc-info-tab="overview"]')?.click();
      try { localStorage.setItem(introKey, new Date().toISOString()); } catch {}
    }
    renderDeck(); renderEvents(); updateTopbar(); updatePlanetSignals();
    addEvent("Living Desktop Galaxy V4 đã sẵn sàng", "success");
    live.weather = readJson(WEATHER_KEY, null);
    refreshWeather(); refreshSystem(); probeNetwork(); startScheduler();
    root.dataset.hlwMounted = "true";
    return true;
  }

  const scheduleMount = () => requestAnimationFrame(() => mount());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleMount, { once: true }); else scheduleMount();
  addEventListener("hh:assets-ready", (event) => { if (event.detail?.route === "/home") setTimeout(scheduleMount, 60); });
  addEventListener("hh:asset-group-ready", (event) => { if (event.detail?.group === "home-enhancements") setTimeout(scheduleMount, 180); });
  addEventListener("hashchange", () => { if (/^#\/home(?:$|[/?])/.test(location.hash) || !location.hash) setTimeout(scheduleMount, 60); else stopTimers(); });

  window.HHHomeLiveWidgets = Object.freeze({ version: 4, mount, refresh: () => { refreshWeather(); refreshSystem(); return probeNetwork(); }, snapshot: () => ({ ...live, latencyHistory: [...latencyHistory], apiHistory: [...apiHistory] }) });
})();
