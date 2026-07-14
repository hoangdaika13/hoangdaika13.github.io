(function () {
  "use strict";

  const NOTES_KEY = "hh.dashboard.sticky-notes.v1";
  const WEATHER_KEY = "hh.dashboard.weather.v1";
  const WEATHER_LOCATION_KEY = "hh.dashboard.weather-location.v1";
  const noteColors = ["#fff17a", "#75f2d0", "#ff91d9", "#9cb8ff", "#ffb56f", "#c8ff78"];
  const graphs = { cpu: [], ram: [], disk: [], gpu: [] };
  let initialized = false;
  let weatherLocation = { name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 };
  let lastFrame = performance.now();
  let frameCount = 0;
  let fps = 60;
  let lastFpsSample = performance.now();
  let expectedTick = performance.now() + 1000;
  let tabLag = 0;

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** index)).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
  };

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function userName() {
    try {
      const name = JSON.parse(localStorage.getItem("hh-auth-user") || "{}").name || "";
      return name.split(/\s+/).filter(Boolean).slice(-2).join(" ") || "bạn";
    } catch { return "bạn"; }
  }

  function updateClock() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 5 ? "Chào đêm muộn" : hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    const moment = hour < 6 ? "Một khoảng lặng tốt để tập trung" : hour < 12 ? "Bắt đầu ngày mới thật nhiều năng lượng" : hour < 18 ? "Giữ nhịp sáng tạo cho buổi chiều" : "Khép ngày bằng một ý tưởng hay";
    const clock = byId("shellClock");
    const date = byId("shellDate");
    const greetingNode = byId("dashboardGreeting");
    if (clock) clock.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (date) date.textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (greetingNode) greetingNode.textContent = `${greeting}, ${userName()}`;
    if (byId("dashboardMoment")) byId("dashboardMoment").textContent = moment;
    if (byId("dashboardPeriod")) byId("dashboardPeriod").textContent = `${Intl.DateTimeFormat().resolvedOptions().timeZone || "Giờ địa phương"}`;
  }

  function weatherInfo(code, isDay = true) {
    const table = [
      [[0], isDay ? "☀" : "☾", "Trời quang"],
      [[1, 2], "◒", "Ít mây"],
      [[3], "☁", "Nhiều mây"],
      [[45, 48], "≋", "Sương mù"],
      [[51, 53, 55, 56, 57], "≋", "Mưa phùn"],
      [[61, 63, 65, 66, 67, 80, 81, 82], "☂", "Có mưa"],
      [[71, 73, 75, 77, 85, 86], "✧", "Có tuyết"],
      [[95, 96, 99], "ϟ", "Dông" ]
    ];
    const item = table.find(([codes]) => codes.includes(Number(code))) || [[], "🌡️", "Thời tiết"];
    return { icon: item[1], label: item[2] };
  }

  function aqiInfo(value) {
    const aqi = Number(value) || 0;
    if (aqi <= 50) return { label: "Tốt", color: "#75f2b1" };
    if (aqi <= 100) return { label: "Trung bình", color: "#f5df66" };
    if (aqi <= 150) return { label: "Kém cho nhóm nhạy cảm", color: "#ffb35c" };
    if (aqi <= 200) return { label: "Không lành mạnh", color: "#ff718b" };
    if (aqi <= 300) return { label: "Rất không lành mạnh", color: "#c987ff" };
    return { label: "Nguy hại", color: "#a65b72" };
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  function renderWeather(payload, location, cached = false) {
    const currentNode = byId("dashboardWeatherCurrent");
    const forecastNode = byId("dashboardForecast");
    if (!currentNode || !forecastNode) return;
    const weather = payload.weather;
    const air = payload.air;
    const current = weather.current || {};
    const daily = weather.daily || {};
    const info = weatherInfo(current.weather_code, Boolean(current.is_day));
    const aqi = aqiInfo(air.current?.us_aqi);
    const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--";
    const sunset = daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--";
    const moonAge = ((Date.now() / 86400000 - 6.75) % 29.53059 + 29.53059) % 29.53059;
    const moon = moonAge < 1.85 ? "Trăng mới" : moonAge < 7.38 ? "Lưỡi liềm" : moonAge < 9.23 ? "Bán nguyệt" : moonAge < 14.77 ? "Trăng khuyết" : moonAge < 16.61 ? "Trăng tròn" : moonAge < 22.15 ? "Khuyết dần" : moonAge < 23.99 ? "Hạ huyền" : "Lưỡi liềm cuối";
    const uv = Math.round(daily.uv_index_max?.[0] ?? 0);
    currentNode.innerHTML = `<div class="dashboard-weather-main"><span class="dashboard-weather-icon">${info.icon}</span><div><h4>${escapeHtml(location.name)}</h4><strong>${Math.round(current.temperature_2m ?? 0)}°C</strong><small>${escapeHtml(info.label)} · Cảm giác ${Math.round(current.apparent_temperature ?? 0)}°</small></div></div><div class="dashboard-aqi" style="--aqi-color:${aqi.color}"><span>CHẤT LƯỢNG KHÔNG KHÍ</span><strong>AQI ${Math.round(air.current?.us_aqi ?? 0)}</strong><small>${escapeHtml(aqi.label)} · PM2.5 ${Math.round(air.current?.pm2_5 ?? 0)} · PM10 ${Math.round(air.current?.pm10 ?? 0)} µg/m³</small></div><div class="dashboard-weather-details"><span><b>${Math.round(current.relative_humidity_2m ?? 0)}%</b>Độ ẩm</span><span><b>${Math.round(current.wind_speed_10m ?? 0)} km/h</b>Gió</span><span><b>${Math.round(current.surface_pressure ?? 0)} hPa</b>Áp suất</span><span><b>${uv}</b>UV cao nhất</span><span><b>${sunrise}</b>Bình minh</span><span><b>${sunset}</b>Hoàng hôn</span><span><b>${escapeHtml(moon)}</b>Pha Mặt Trăng</span></div>`;
    const days = Array.isArray(daily.time) ? daily.time.slice(0, 7) : [];
    forecastNode.innerHTML = days.map((date, index) => {
      const dayInfo = weatherInfo(daily.weather_code?.[index], true);
      const label = index === 0 ? "Hôm nay" : new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", { weekday: "short" });
      return `<article><span>${escapeHtml(label)}</span><b title="${escapeHtml(dayInfo.label)}">${dayInfo.icon}</b><strong>${Math.round(daily.temperature_2m_max?.[index] ?? 0)}° / ${Math.round(daily.temperature_2m_min?.[index] ?? 0)}°</strong><small>☂ ${Math.round(daily.precipitation_probability_max?.[index] ?? 0)}%</small></article>`;
    }).join("");
    const updated = byId("dashboardWeatherUpdated");
    if (updated) updated.textContent = `${cached ? "Dữ liệu lưu gần nhất" : "Cập nhật"} · ${new Date(payload.savedAt || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    const city = byId("dashboardWeatherCity");
    if (city) city.value = location.name;
  }

  function renderWeatherError(message) {
    const current = byId("dashboardWeatherCurrent");
    const forecast = byId("dashboardForecast");
    if (current) current.innerHTML = `<div class="dashboard-widget-error"><strong>Chưa tải được thời tiết</strong><span>${escapeHtml(message)}</span><button type="button" data-weather-retry>Thử lại</button></div>`;
    if (forecast) forecast.innerHTML = "";
  }

  async function loadWeather(location = weatherLocation, force = false) {
    weatherLocation = location;
    writeJson(WEATHER_LOCATION_KEY, location);
    const cached = readJson(WEATHER_KEY, null);
    if (!force && cached?.payload && cached?.location && Date.now() - cached.savedAt < 30 * 60 * 1000 && Math.abs(cached.location.latitude - location.latitude) < .01 && Math.abs(cached.location.longitude - location.longitude) < .01) {
      renderWeather(cached.payload, cached.location, true);
      return;
    }
    const current = byId("dashboardWeatherCurrent");
    if (current) current.innerHTML = `<div class="dashboard-widget-skeleton"></div>`;
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max", timezone: "auto", forecast_days: "7" });
    const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    airUrl.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, current: "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone", timezone: "auto", forecast_days: "7" });
    try {
      const [weather, air] = await Promise.all([fetchJson(weatherUrl), fetchJson(airUrl)]);
      const payload = { weather, air, savedAt: Date.now() };
      writeJson(WEATHER_KEY, { payload, location, savedAt: Date.now() });
      renderWeather(payload, location);
    } catch (error) {
      if (cached?.payload) renderWeather(cached.payload, cached.location || location, true);
      else renderWeatherError(error.name === "AbortError" ? "Yêu cầu quá thời gian. Hãy thử lại." : "Kiểm tra kết nối mạng rồi thử lại.");
    }
  }

  async function searchCity(query) {
    if (query.trim().length < 2) return;
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: query.trim(), count: "1", language: "vi", format: "json" });
    try {
      const data = await fetchJson(url);
      const result = data.results?.[0];
      if (!result) throw new Error("Không tìm thấy thành phố");
      await loadWeather({ name: [result.name, result.admin1, result.country].filter(Boolean).slice(0, 2).join(", "), latitude: result.latitude, longitude: result.longitude }, true);
    } catch (error) { renderWeatherError(error.message || "Không tìm thấy địa điểm phù hợp."); }
  }

  function useLocation() {
    if (!navigator.geolocation) return renderWeatherError("Trình duyệt không hỗ trợ định vị.");
    const button = byId("dashboardUseLocation");
    if (button) button.textContent = "…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (button) button.textContent = "⌖";
        loadWeather({ name: "Vị trí của bạn", latitude: position.coords.latitude, longitude: position.coords.longitude }, true);
      },
      () => { if (button) button.textContent = "⌖"; renderWeatherError("Bạn chưa cho phép truy cập vị trí. Có thể tìm thành phố bằng ô phía trên."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  function defaultNotes() {
    return [
      { id: crypto.randomUUID?.() || `note-${Date.now()}-1`, text: "# Ý tưởng hôm nay\nHoàn thiện một tính năng thật tốt.", color: noteColors[0], x: 22, y: 26, rotate: -1.2, pinned: true, tags: "ý tưởng", reminder: "", updatedAt: Date.now() },
      { id: crypto.randomUUID?.() || `note-${Date.now()}-2`, text: "## Việc cần làm\n- [ ] Kiểm tra dự án\n- [ ] Trả lời tin nhắn", color: noteColors[1], x: 266, y: 72, rotate: 1.1, pinned: false, tags: "công việc", reminder: "", updatedAt: Date.now() },
      { id: crypto.randomUUID?.() || `note-${Date.now()}-3`, text: "**Prompt hay:**\nVai trò + mục tiêu + đầu vào + định dạng kết quả.", color: noteColors[2], x: 510, y: 32, rotate: -.5, pinned: false, tags: "ai,prompt", reminder: "", updatedAt: Date.now() }
    ];
  }

  let notes = [];
  function saveNotes() { writeJson(NOTES_KEY, notes); }

  function markdown(text) {
    return escapeHtml(text)
      .replace(/^###\s+(.+)$/gm, "<h6>$1</h6>")
      .replace(/^##\s+(.+)$/gm, "<h5>$1</h5>")
      .replace(/^#\s+(.+)$/gm, "<h4>$1</h4>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- \[x\]\s+(.+)$/gim, '<label><input type="checkbox" checked disabled> $1</label>')
      .replace(/^- \[ \]\s+(.+)$/gim, '<label><input type="checkbox" disabled> $1</label>')
      .replace(/^-\s+(.+)$/gm, "<span>• $1</span>")
      .replace(/\n/g, "<br>");
  }

  function renderNotes() {
    const board = byId("dashboardStickyBoard");
    if (!board) return;
    const ordered = [...notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    board.innerHTML = ordered.map((note, index) => {
      const words = note.text.trim() ? note.text.trim().split(/\s+/).length : 0;
      return `<article class="dashboard-sticky-note ${note.pinned ? "is-pinned" : ""}" data-note-id="${escapeHtml(note.id)}" data-note-search="${escapeHtml(`${note.text} ${note.tags || ""}`.toLowerCase())}" style="--note-color:${escapeHtml(note.color)};--note-rotate:${Number(note.rotate || 0)}deg;left:${Math.max(0, Number(note.x) || 0)}px;top:${Math.max(0, Number(note.y) || 0)}px"><header data-note-drag><span>${note.pinned ? "PIN" : "NOTE"} ${String(index + 1).padStart(2, "0")}</span><div><button type="button" data-note-checklist title="Thêm checklist" aria-label="Thêm checklist">☑</button><button type="button" data-note-preview title="Xem Markdown" aria-label="Xem Markdown">M</button><button type="button" data-note-pin title="Ghim" aria-label="Ghim ghi chú">${note.pinned ? "★" : "☆"}</button><button type="button" data-note-color title="Đổi màu" aria-label="Đổi màu">◐</button><button type="button" data-note-delete title="Xóa" aria-label="Xóa ghi chú">×</button></div></header><textarea aria-label="Nội dung ghi chú" placeholder="Markdown, checklist hoặc ý tưởng..." ${note.preview ? "hidden" : ""}>${escapeHtml(note.text)}</textarea><div class="dashboard-note-preview" ${note.preview ? "" : "hidden"}>${markdown(note.text)}</div><footer><div><span>${words} từ · ${note.text.length} ký tự</span><span>${new Date(note.updatedAt || Date.now()).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span></div><details><summary>Tag & nhắc lịch</summary><label>Tag<input data-note-tags value="${escapeHtml(note.tags || "")}" placeholder="ý tưởng, công việc"></label><label>Nhắc<input data-note-reminder type="datetime-local" value="${escapeHtml(note.reminder || "")}"></label></details></footer></article>`;
    }).join("");
  }

  function addNote() {
    const board = byId("dashboardStickyBoard");
    const offset = (notes.length * 37) % Math.max(80, (board?.clientWidth || 700) - 240);
    notes.push({ id: crypto.randomUUID?.() || `note-${Date.now()}`, text: "", color: noteColors[notes.length % noteColors.length], x: 20 + offset, y: 20 + ((notes.length * 43) % 110), rotate: (notes.length % 3 - 1) * .8, pinned: false, tags: "", reminder: "", preview: false, updatedAt: Date.now() });
    saveNotes();
    renderNotes();
    requestAnimationFrame(() => byId("dashboardStickyBoard")?.querySelector(`[data-note-id="${notes.at(-1).id}"] textarea`)?.focus());
  }

  function wireNotes() {
    const board = byId("dashboardStickyBoard");
    if (!board) return;
    notes = readJson(NOTES_KEY, null) || defaultNotes();
    saveNotes();
    renderNotes();
    byId("dashboardAddSticky")?.addEventListener("click", addNote);
    board.addEventListener("input", (event) => {
      const card = event.target.closest("[data-note-id]");
      if (!card) return;
      const note = notes.find((item) => item.id === card.dataset.noteId);
      if (!note) return;
      if (event.target.tagName === "TEXTAREA") note.text = event.target.value;
      if (event.target.matches("[data-note-tags]")) note.tags = event.target.value;
      if (event.target.matches("[data-note-reminder]")) note.reminder = event.target.value;
      note.updatedAt = Date.now();
      saveNotes();
    });
    board.addEventListener("click", (event) => {
      const card = event.target.closest("[data-note-id]");
      if (!card) return;
      const index = notes.findIndex((item) => item.id === card.dataset.noteId);
      if (index < 0) return;
      if (event.target.closest("[data-note-delete]")) { notes.splice(index, 1); saveNotes(); renderNotes(); }
      if (event.target.closest("[data-note-color]")) { notes[index].color = noteColors[(noteColors.indexOf(notes[index].color) + 1) % noteColors.length]; notes[index].updatedAt = Date.now(); saveNotes(); renderNotes(); }
      if (event.target.closest("[data-note-pin]")) { notes[index].pinned = !notes[index].pinned; notes[index].updatedAt = Date.now(); saveNotes(); renderNotes(); }
      if (event.target.closest("[data-note-preview]")) { notes[index].preview = !notes[index].preview; saveNotes(); renderNotes(); }
      if (event.target.closest("[data-note-checklist]")) { notes[index].text += `${notes[index].text ? "\n" : ""}- [ ] `; notes[index].preview = false; notes[index].updatedAt = Date.now(); saveNotes(); renderNotes(); requestAnimationFrame(() => board.querySelector(`[data-note-id="${notes[index].id}"] textarea`)?.focus()); }
    });

    byId("dashboardNoteSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      board.querySelectorAll("[data-note-id]").forEach((card) => { card.hidden = Boolean(query && !card.dataset.noteSearch.includes(query)); });
    });
    byId("dashboardNoteExport")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), notes }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `hh-sticky-notes-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    byId("dashboardNoteImport")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!Array.isArray(payload.notes)) throw new Error();
        notes = payload.notes.filter((note) => note && typeof note.text === "string").slice(0, 30);
        saveNotes();
        renderNotes();
      } catch { window.dispatchEvent(new CustomEvent("hh:toast", { detail: { title: "Không nhập được ghi chú", message: "Tệp JSON không đúng định dạng HH Sticky Notes." } })); }
      event.target.value = "";
    });
    const checkNoteReminders = () => {
      let changed = false;
      notes.forEach((note) => {
        if (note.reminder && !note.reminded && new Date(note.reminder).getTime() <= Date.now()) {
          note.reminded = true;
          changed = true;
          window.dispatchEvent(new CustomEvent("hh:toast", { detail: { title: "Nhắc ghi chú", message: note.text.split("\n")[0] || "Đến giờ xem lại ghi chú.", icon: "◇" } }));
        }
      });
      if (changed) saveNotes();
    };
    checkNoteReminders();
    setInterval(checkNoteReminders, 30000);
    board.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-note-drag]") || event.target.closest("button") || matchMedia("(max-width: 860px)").matches) return;
      const card = event.target.closest("[data-note-id]");
      const note = notes.find((item) => item.id === card?.dataset.noteId);
      if (!card || !note) return;
      event.preventDefault();
      card.setPointerCapture(event.pointerId);
      card.dataset.dragging = "true";
      const boardRect = board.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offsetX = event.clientX - cardRect.left;
      const offsetY = event.clientY - cardRect.top;
      const move = (moveEvent) => {
        note.x = clamp(moveEvent.clientX - boardRect.left - offsetX, 0, Math.max(0, board.clientWidth - card.offsetWidth));
        note.y = clamp(moveEvent.clientY - boardRect.top - offsetY, 0, Math.max(0, board.clientHeight - card.offsetHeight));
        card.style.left = `${note.x}px`;
        card.style.top = `${note.y}px`;
      };
      const up = () => {
        card.dataset.dragging = "false";
        note.updatedAt = Date.now();
        saveNotes();
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", up);
        card.removeEventListener("pointercancel", up);
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerup", up);
      card.addEventListener("pointercancel", up);
    });
  }

  function rendererName() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "WebGL không khả dụng";
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || "WebGL GPU";
    } catch { return "GPU được bảo vệ"; }
  }

  function pushGraph(name, value) {
    const values = graphs[name];
    values.push(clamp(Number(value) || 0, 0, 100));
    if (values.length > 24) values.shift();
    const padded = [...Array(Math.max(0, 24 - values.length)).fill(values[0] || 0), ...values];
    const points = padded.map((item, index) => `${(index / 23) * 120},${29 - (item / 100) * 25}`).join(" ");
    const graph = byId(`dashboard${name[0].toUpperCase()}${name.slice(1)}Graph`);
    if (graph) graph.setAttribute("points", points);
  }

  function trackFps(timestamp) {
    frameCount += 1;
    if (timestamp - lastFpsSample >= 1000) {
      fps = Math.round((frameCount * 1000) / (timestamp - lastFpsSample));
      frameCount = 0;
      lastFpsSample = timestamp;
    }
    lastFrame = timestamp;
    requestAnimationFrame(trackFps);
  }

  async function updateDeviceStats() {
    const cores = navigator.hardwareConcurrency || 0;
    const cpuScore = clamp(tabLag * 3.2, 2, 100);
    if (byId("dashboardCpuValue")) byId("dashboardCpuValue").textContent = cores ? `${cores} luồng` : `${Math.round(tabLag)} ms`;
    if (byId("dashboardCpuMeta")) byId("dashboardCpuMeta").textContent = `Độ trễ tab ${Math.round(tabLag)} ms`;
    pushGraph("cpu", cpuScore);

    const memory = performance.memory;
    const usedHeap = memory?.usedJSHeapSize || 0;
    const heapLimit = memory?.jsHeapSizeLimit || 0;
    const deviceMemory = navigator.deviceMemory;
    if (byId("dashboardRamValue")) byId("dashboardRamValue").textContent = usedHeap ? formatBytes(usedHeap) : (deviceMemory ? `~${deviceMemory} GB` : "Riêng tư");
    if (byId("dashboardRamMeta")) byId("dashboardRamMeta").textContent = usedHeap ? `Heap tab · máy ~${deviceMemory || "?"} GB` : "Trình duyệt không cung cấp heap";
    pushGraph("ram", heapLimit ? (usedHeap / heapLimit) * 100 : (deviceMemory ? 32 : 18));

    try {
      const storage = await navigator.storage?.estimate?.();
      const usage = storage?.usage || 0;
      const quota = storage?.quota || 0;
      if (byId("dashboardDiskValue")) byId("dashboardDiskValue").textContent = formatBytes(usage);
      if (byId("dashboardDiskMeta")) byId("dashboardDiskMeta").textContent = quota ? `Hạn mức ${formatBytes(quota)}` : "Storage API bị giới hạn";
      pushGraph("disk", quota ? (usage / quota) * 100 : 0);
    } catch {
      if (byId("dashboardDiskValue")) byId("dashboardDiskValue").textContent = "Riêng tư";
    }

    if (byId("dashboardGpuValue")) byId("dashboardGpuValue").textContent = `${fps} FPS`;
    pushGraph("gpu", clamp((fps / 60) * 100, 0, 100));
  }

  function wireDeviceStats() {
    const gpu = rendererName();
    if (byId("dashboardGpuMeta")) byId("dashboardGpuMeta").textContent = gpu;
    requestAnimationFrame(trackFps);
    setInterval(() => {
      const now = performance.now();
      tabLag = Math.max(0, now - expectedTick);
      expectedTick = now + 1000;
    }, 1000);
    updateDeviceStats();
    setInterval(updateDeviceStats, 2200);
  }

  function wireWeather() {
    weatherLocation = readJson(WEATHER_LOCATION_KEY, weatherLocation);
    byId("dashboardWeatherSearch")?.addEventListener("submit", (event) => {
      event.preventDefault();
      searchCity(byId("dashboardWeatherCity")?.value || "");
    });
    byId("dashboardUseLocation")?.addEventListener("click", useLocation);
    document.addEventListener("click", (event) => { if (event.target.closest("[data-weather-retry]")) loadWeather(weatherLocation, true); });
    loadWeather(weatherLocation);
    setInterval(() => loadWeather(weatherLocation, true), 30 * 60 * 1000);
  }

  function init() {
    if (initialized || !byId("dashboardStickyBoard")) return;
    initialized = true;
    updateClock();
    setInterval(updateClock, 1000);
    wireWeather();
    wireNotes();
    wireDeviceStats();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("auth-unlocked")) init();
  });
  else if (document.body.classList.contains("auth-unlocked")) init();
  window.addEventListener("hh:auth-change", () => {
    if (document.body.classList.contains("auth-unlocked")) init();
  });
  window.addEventListener("hh:command-center-sync", () => {
    if (!initialized || !byId("dashboardStickyBoard")) return;
    notes = readJson(NOTES_KEY, notes);
    renderNotes();
  });
  window.addEventListener("hashchange", () => {
    if (!location.hash.includes("/home")) return;
    requestAnimationFrame(() => {
      if (!byId("dashboardStickyBoard")) return;
      notes = readJson(NOTES_KEY, notes);
      renderNotes();
    });
  });
})();
