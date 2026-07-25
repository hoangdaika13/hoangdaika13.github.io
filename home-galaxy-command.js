(function () {
  "use strict";

  const PREF_KEY = "hh.home.galaxy.preferences.v1";
  const TODO_KEY = "hh.command-center.todos.v2";
  const RECENT_KEY = "hh.app-shell.recent";
  const PROJECT_KEY = "hh-project-center";
  const COMMUNICATION_KEY = "hh.communication.intelligence.v1";
  const LEARNING_KEY = "hh.learning.os.v1";
  const DEFAULT_PREFS = Object.freeze({
    theme: "neon",
    motion: "balanced",
    stars: 62,
    sound: false,
    planets: ["creative", "work", "media", "dev", "communication", "learning", "analytics", "system"],
    widgets: ["weather", "performance", "memory", "network", "health", "sync"]
  });
  const PLANETS = Object.freeze([
    { id: "creative", icon: "✦", label: "AI & Sáng tạo", route: "/create", color: "#ff59d6", description: "AI Center, nội dung, chiến dịch và quy trình sáng tạo." },
    { id: "work", icon: "□", label: "Công việc", route: "/work", color: "#baff62", description: "Task, dự án, tiến độ và phiên tập trung đang hoạt động." },
    { id: "media", icon: "◈", label: "Media & Design", route: "/media", color: "#a986ff", description: "Ảnh, video, thiết kế và các dự án xuất bản đa phương tiện." },
    { id: "dev", icon: "⌘", label: "DEV", route: "/dev", color: "#58f3ff", description: "Công cụ lập trình, API, Git, dữ liệu và bảo mật." },
    { id: "communication", icon: "◌", label: "Giao tiếp", route: "/communication", color: "#67efbd", description: "Messenger, cộng đồng, thông báo và phòng trực tiếp." },
    { id: "learning", icon: "◫", label: "Học tập", route: "/learn", color: "#ffbd5a", description: "Lộ trình học, bài ôn, lớp học và HH English." },
    { id: "analytics", icon: "↗", label: "Phân tích", route: "/analytics", color: "#ff7f9d", description: "Website Health, hiệu suất, Web Vitals và báo cáo." },
    { id: "system", icon: "⚙", label: "Hệ thống", route: "/settings", color: "#7ea8ff", description: "Giao diện, quyền riêng tư, PWA và trạng thái hệ thống." }
  ]);
  const WIDGETS = Object.freeze([
    { id: "weather", icon: "◒", label: "Thời tiết & AQI", target: ".dashboard-weather" },
    { id: "performance", icon: "⌁", label: "FPS & độ trễ", target: ".dashboard-device" },
    { id: "memory", icon: "◇", label: "Bộ nhớ & Disk", target: ".dashboard-device" },
    { id: "network", icon: "↗", label: "Mạng trực tiếp", target: ".hhhf-health" },
    { id: "health", icon: "✚", label: "Website Health", target: ".hhhf-health" },
    { id: "sync", icon: "◷", label: "Đồng bộ gần nhất", target: ".dashboard-weather" }
  ]);
  const histories = Object.fromEntries(WIDGETS.map((item) => [item.id, []]));
  let mountedHome = null;
  let root = null;
  let prefs = null;
  let observer = null;
  let globalBound = false;
  let refreshTimer = 0;
  let meteorTimer = 0;
  let audioContext = null;
  let updateQueued = false;

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "");
      return value == null ? fallback : value;
    } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function readPrefs() {
    const saved = readJson(PREF_KEY, {});
    return {
      theme: ["neon", "purple", "solar", "deep"].includes(saved.theme) ? saved.theme : DEFAULT_PREFS.theme,
      motion: ["static", "balanced", "cinematic"].includes(saved.motion) ? saved.motion : DEFAULT_PREFS.motion,
      stars: clamp(saved.stars ?? DEFAULT_PREFS.stars, 20, 100),
      sound: saved.sound === true,
      planets: Array.isArray(saved.planets) ? saved.planets.filter((id) => PLANETS.some((planet) => planet.id === id)) : [...DEFAULT_PREFS.planets],
      widgets: Array.isArray(saved.widgets) ? saved.widgets.filter((id) => WIDGETS.some((widget) => widget.id === id)) : [...DEFAULT_PREFS.widgets]
    };
  }

  prefs = readPrefs();

  function userName() {
    const account = readJson("hh-auth-user", {});
    return String(account.name || account.nickname || "Khách HH").trim().slice(0, 60);
  }

  function period() {
    const hour = new Date().getHours();
    if (hour < 5) return { id: "night", greeting: "Chào đêm muộn" };
    if (hour < 11) return { id: "morning", greeting: "Chào buổi sáng" };
    if (hour < 14) return { id: "noon", greeting: "Chào buổi trưa" };
    if (hour < 18) return { id: "afternoon", greeting: "Chào buổi chiều" };
    return { id: "evening", greeting: "Chào buổi tối" };
  }

  function widgetMarkup(widget) {
    return `<article class="hgc-live-card" data-hgc-widget="${widget.id}" style="--hgc-index:${WIDGETS.indexOf(widget)}">
      <button type="button" class="hgc-live-open" data-hgc-target="${escapeHtml(widget.target)}" aria-label="Mở chi tiết ${escapeHtml(widget.label)}">
        <span class="hgc-satellite-icon" aria-hidden="true"><i>${widget.icon}</i><b></b></span>
        <span class="hgc-live-copy"><small>${escapeHtml(widget.label)}</small><strong data-hgc-value="${widget.id}">Đang đồng bộ</strong><em data-hgc-meta="${widget.id}">Dữ liệu trình duyệt thực</em></span>
        <svg viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true"><polyline data-hgc-spark="${widget.id}" points="0,25 120,25"></polyline></svg>
      </button>
      <div class="hgc-live-detail" role="tooltip"><b data-hgc-detail-title="${widget.id}">${escapeHtml(widget.label)}</b><p data-hgc-detail="${widget.id}">Đang lấy dữ liệu mới nhất trong phiên này.</p><span>Chạm hoặc nhấn Enter để mở bảng chi tiết</span></div>
    </article>`;
  }

  function planetMarkup(planet, index) {
    return `<button class="hgc-planet hgc-planet--${index + 1}" type="button" data-hgc-planet="${planet.id}" data-hgc-route="${planet.route}" style="--planet-color:${planet.color};--planet-index:${index}" aria-label="${escapeHtml(planet.label)}: ${escapeHtml(planet.description)}">
      <span class="hgc-planet-sphere"><i>${planet.icon}</i><b></b><em></em></span>
      <strong>${escapeHtml(planet.label)}</strong>
      <small data-hgc-planet-count="${planet.id}">0 tín hiệu</small>
      <span class="hgc-planet-tip"><b>${escapeHtml(planet.label)}</b><em>${escapeHtml(planet.description)}</em><i>Nhấn để mở →</i></span>
    </button>`;
  }

  function preferenceMarkup() {
    const themeOptions = [
      ["neon", "Neon Galaxy"],
      ["purple", "Purple Galaxy"],
      ["solar", "Solar Fire"],
      ["deep", "Deep Space"]
    ].map(([value, label]) => `<button type="button" data-hgc-theme="${value}" aria-pressed="${prefs.theme === value}">${label}</button>`).join("");
    const motionOptions = [
      ["static", "Tĩnh"],
      ["balanced", "Cân bằng"],
      ["cinematic", "Điện ảnh"]
    ].map(([value, label]) => `<button type="button" data-hgc-motion="${value}" aria-pressed="${prefs.motion === value}">${label}</button>`).join("");
    const planetOptions = PLANETS.map((planet) => `<label><input type="checkbox" data-hgc-planet-toggle="${planet.id}" ${prefs.planets.includes(planet.id) ? "checked" : ""}><span style="--setting-color:${planet.color}">${planet.icon}</span><b>${escapeHtml(planet.label)}</b></label>`).join("");
    const widgetOptions = WIDGETS.map((widget) => `<label><input type="checkbox" data-hgc-widget-toggle="${widget.id}" ${prefs.widgets.includes(widget.id) ? "checked" : ""}><span>${widget.icon}</span><b>${escapeHtml(widget.label)}</b></label>`).join("");
    return `<aside class="hgc-settings" data-hgc-settings hidden aria-label="Cá nhân hóa vũ trụ">
      <button class="hgc-settings-backdrop" type="button" data-hgc-settings-close aria-label="Đóng cá nhân hóa"></button>
      <section class="hgc-settings-panel" role="dialog" aria-modal="true" aria-labelledby="hgcSettingsTitle">
        <header><div><small>GALAXY CONTROL</small><h3 id="hgcSettingsTitle">Cá nhân hóa vũ trụ</h3></div><button type="button" data-hgc-settings-close aria-label="Đóng">×</button></header>
        <div class="hgc-setting-group"><span>Tinh vân</span><div class="hgc-choice-grid">${themeOptions}</div></div>
        <div class="hgc-setting-group"><span>Mức chuyển động</span><div class="hgc-choice-grid">${motionOptions}</div></div>
        <label class="hgc-range"><span>Mật độ sao <b data-hgc-star-value>${prefs.stars}%</b></span><input type="range" min="20" max="100" step="10" value="${prefs.stars}" data-hgc-stars></label>
        <label class="hgc-sound"><input type="checkbox" data-hgc-sound ${prefs.sound ? "checked" : ""}><span></span><b>Âm thanh không gian</b><small>Mặc định tắt · chỉ phát sau khi bạn tương tác</small></label>
        <div class="hgc-setting-group"><span>Hành tinh được ghim</span><div class="hgc-check-grid">${planetOptions}</div></div>
        <div class="hgc-setting-group"><span>Widget realtime hiển thị</span><div class="hgc-check-grid">${widgetOptions}</div></div>
        <footer><button type="button" data-hgc-reset>Khôi phục mặc định</button><button type="button" class="is-primary" data-hgc-settings-close>Hoàn tất</button></footer>
      </section>
    </aside>`;
  }

  function markup() {
    const nowPeriod = period();
    return `<section class="hgc" data-hgc-root data-hgc-theme="${prefs.theme}" data-hgc-motion="${prefs.motion}" data-hgc-period="${nowPeriod.id}">
      <div class="hgc-space" aria-hidden="true"><div class="hgc-stars hgc-stars--far" data-hgc-stars-layer="far"></div><div class="hgc-stars hgc-stars--near" data-hgc-stars-layer="near"></div><div class="hgc-nebula"></div><div class="hgc-meteors" data-hgc-meteors></div></div>
      <section class="hgc-live" aria-labelledby="hgcLiveTitle">
        <header class="hgc-live-head">
          <div><span><i></i> LIVE ORBIT</span><h2 id="hgcLiveTitle">Tín hiệu đang chuyển động quanh bạn</h2><p>Dữ liệu thật từ thời tiết, tab trình duyệt, mạng và Website Health.</p></div>
          <div><b data-hgc-online>ONLINE</b><button type="button" data-hgc-settings-open>⚙ Cá nhân hóa</button></div>
        </header>
        <div class="hgc-live-deck" data-hgc-live-deck>${WIDGETS.map(widgetMarkup).join("")}</div>
      </section>
      <section class="hgc-activity" aria-label="Galaxy Activity Stream">
        <header><span>GALAXY ACTIVITY</span><b>REALTIME</b></header>
        <div class="hgc-activity-window"><div class="hgc-activity-track" data-hgc-activity></div></div>
      </section>
      <section class="hgc-hero" aria-labelledby="hgcHeroTitle">
        <div class="hgc-hero-copy">
          <span class="hgc-kicker"><i></i> HH GALAXY COMMAND</span>
          <h2 id="hgcHeroTitle"><span data-hgc-greeting>${nowPeriod.greeting}</span>, <b data-hgc-user>${escapeHtml(userName())}</b></h2>
          <p>Một mặt trời chỉ huy, tám hành tinh chức năng và mọi tín hiệu quan trọng trong cùng một vũ trụ.</p>
          <div class="hgc-hero-actions"><button type="button" class="is-primary" data-hgc-route="/create/ai-center">✦ Bắt đầu với AI</button><button type="button" data-command-open>⌕ Tìm mọi thứ</button><button type="button" data-hgc-settings-open>Điều chỉnh vũ trụ</button></div>
          <div class="hgc-hero-status"><span><i></i><b data-hgc-hero-status>Hệ thống đang đồng bộ</b></span><time data-hgc-clock>--:--:--</time></div>
        </div>
        <div class="hgc-solar" data-hgc-solar aria-label="Tám hành tinh chức năng">
          <div class="hgc-orbit hgc-orbit--1"></div><div class="hgc-orbit hgc-orbit--2"></div><div class="hgc-orbit hgc-orbit--3"></div><div class="hgc-orbit hgc-orbit--4"></div>
          <div class="hgc-energy-lines" aria-hidden="true"></div>
          <div class="hgc-sun" aria-label="Mặt trời chỉ huy H"><span>H</span><i></i><b></b><em></em></div>
          <div class="hgc-sun-particles" data-hgc-sun-particles aria-hidden="true"></div>
          <div class="hgc-planets">${PLANETS.map(planetMarkup).join("")}</div>
          <p>Rê chuột để dừng quỹ đạo · nhấn hành tinh để mở workspace</p>
        </div>
      </section>
      ${preferenceMarkup()}
      <div class="hgc-burst" data-hgc-burst aria-hidden="true"></div>
      <div class="hgc-notification-comet" data-hgc-notification-comet aria-hidden="true"><i></i><span>Thông báo mới</span></div>
    </section>`;
  }

  function renderStars() {
    if (!root) return;
    const total = Math.round(prefs.stars * .72);
    root.querySelectorAll("[data-hgc-stars-layer]").forEach((layer, layerIndex) => {
      const count = layerIndex ? total : Math.round(total * .62);
      layer.innerHTML = Array.from({ length: count }, (_, index) => {
        const x = (index * 47 + layerIndex * 13) % 100;
        const y = (index * 73 + layerIndex * 31) % 100;
        const size = layerIndex ? 1 + (index % 3) * .55 : .7 + (index % 2) * .45;
        const delay = -((index * 1.17) % 9);
        return `<i style="--star-x:${x}%;--star-y:${y}%;--star-size:${size}px;--star-delay:${delay}s"></i>`;
      }).join("");
    });
    const particles = root.querySelector("[data-hgc-sun-particles]");
    if (particles) particles.innerHTML = Array.from({ length: Math.max(10, Math.round(prefs.stars / 4)) }, (_, index) => `<i style="--particle-angle:${index * 37}deg;--particle-distance:${92 + index % 5 * 17}px;--particle-delay:${-(index % 9) * .7}s"></i>`).join("");
  }

  function applyPrefs() {
    if (!root) return;
    root.dataset.hgcTheme = prefs.theme;
    root.dataset.hgcMotion = prefs.motion;
    root.querySelectorAll("[data-hgc-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcTheme === prefs.theme)));
    root.querySelectorAll("[data-hgc-motion]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcMotion === prefs.motion)));
    root.querySelectorAll("[data-hgc-widget]").forEach((node) => { node.hidden = !prefs.widgets.includes(node.dataset.hgcWidget); });
    root.querySelectorAll("[data-hgc-planet]").forEach((node) => {
      const active = prefs.planets.includes(node.dataset.hgcPlanet);
      node.classList.toggle("is-pinned", active);
      node.hidden = !active;
    });
    const starValue = root.querySelector("[data-hgc-star-value]");
    if (starValue) starValue.textContent = `${prefs.stars}%`;
    renderStars();
    scheduleMeteors();
    writeJson(PREF_KEY, prefs);
  }

  function setText(selector, value) {
    const node = root?.querySelector(selector);
    const text = String(value ?? "");
    if (node && node.textContent !== text) node.textContent = text;
  }

  function parseNumber(value) {
    const match = String(value || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function setSpark(name, value) {
    const history = histories[name];
    if (!history) return;
    history.push(clamp(value, 0, 100));
    if (history.length > 18) history.shift();
    const data = [...Array(Math.max(0, 18 - history.length)).fill(history[0] || 0), ...history];
    const points = data.map((item, index) => `${(index / 17) * 120},${25 - item / 100 * 21}`).join(" ");
    const line = root?.querySelector(`[data-hgc-spark="${name}"]`);
    if (line && line.getAttribute("points") !== points) line.setAttribute("points", points);
  }

  function liveSnapshot() {
    const weatherCache = readJson("hh.dashboard.weather.v2", null);
    const cachedTemperature = weatherCache?.payload?.weather?.current?.temperature_2m;
    const cachedAqi = weatherCache?.payload?.air?.current?.us_aqi;
    const weatherValue = document.querySelector(".dashboard-weather-main strong")?.textContent?.trim()
      || (Number.isFinite(cachedTemperature) ? `${Math.round(cachedTemperature)}°C` : "Đang tải");
    const weatherMeta = document.querySelector(".dashboard-aqi strong")?.textContent?.trim()
      || (Number.isFinite(cachedAqi) ? `AQI ${Math.round(cachedAqi)}` : "AQI đang nối");
    const weatherDetail = document.querySelector(".dashboard-weather-main small")?.textContent?.trim()
      || (weatherCache?.location?.name ? `${weatherCache.location.name} · dữ liệu lưu an toàn trên thiết bị` : "Dự báo Open-Meteo đang được đồng bộ.");
    const fps = byId("dashboardGpuValue")?.textContent?.trim() || "Đang đo";
    const lag = byId("dashboardCpuValue")?.textContent?.trim() || "Đang đo";
    const fpsMeta = byId("dashboardGpuMeta")?.textContent?.trim() || "Khung hình thực trong tab";
    const memory = byId("dashboardRamValue")?.textContent?.trim() || "Đang đọc";
    const disk = byId("dashboardDiskValue")?.textContent?.trim() || "Đang đọc";
    const memoryMeta = byId("dashboardRamMeta")?.textContent?.trim() || "Bộ nhớ trình duyệt công bố";
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const networkValue = navigator.onLine ? (connection?.downlink ? `${connection.downlink} Mbps` : "Online") : "Offline";
    const networkMeta = connection?.effectiveType ? `${String(connection.effectiveType).toUpperCase()} · RTT ${connection.rtt ?? "?"} ms` : "Network Information được giới hạn";
    const healthValues = [...document.querySelectorAll(".hhhf-health-overview strong")].map((node) => node.textContent.trim());
    const healthValue = healthValues[1] || "Đang đo";
    const healthMeta = healthValues[2] ? `${healthValues[0] || "Website Health"} · ${healthValues[2]}` : "Đang kiểm tra endpoint";
    const updated = byId("dashboardWeatherUpdated")?.textContent?.trim() || "Đang đồng bộ";
    const now = new Date();
    return {
      weather: { value: weatherValue, meta: weatherMeta, detail: `${weatherDetail} · ${weatherMeta}`, score: clamp(parseNumber(weatherValue) + 35, 0, 100) },
      performance: { value: `${fps} · ${lag}`, meta: "FPS thực · độ trễ tab", detail: fpsMeta, score: clamp(parseNumber(fps) / 1.2, 0, 100) },
      memory: { value: `${memory} · ${disk}`, meta: "Heap tab · dữ liệu web", detail: memoryMeta, score: clamp(parseNumber(memory) * 2.5, 0, 100) },
      network: { value: networkValue, meta: networkMeta, detail: navigator.onLine ? "Trình duyệt xác nhận kết nối đang hoạt động." : "Trình duyệt đang báo mất kết nối.", score: navigator.onLine ? clamp((connection?.downlink || 8) * 8, 18, 100) : 0 },
      health: { value: healthValue, meta: healthMeta, detail: healthValues[3] ? `Lần đo gần nhất ${healthValues[3]}.` : "Website Health sẽ tự cập nhật trong nền.", score: healthValue.includes("/") ? clamp(parseNumber(healthValue) * 25, 0, 100) : 30 },
      sync: { value: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), meta: updated, detail: "Thời điểm trang chủ tổng hợp các nguồn dữ liệu gần nhất.", score: now.getSeconds() / 60 * 100 }
    };
  }

  function updateLive() {
    if (!root) return;
    const snapshot = liveSnapshot();
    Object.entries(snapshot).forEach(([name, item]) => {
      setText(`[data-hgc-value="${name}"]`, item.value);
      setText(`[data-hgc-meta="${name}"]`, item.meta);
      setText(`[data-hgc-detail="${name}"]`, item.detail);
      setSpark(name, item.score);
    });
    const nowPeriod = period();
    root.dataset.hgcPeriod = nowPeriod.id;
    setText("[data-hgc-greeting]", nowPeriod.greeting);
    setText("[data-hgc-user]", userName());
    setText("[data-hgc-clock]", new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setText("[data-hgc-online]", navigator.onLine ? "ONLINE" : "OFFLINE");
    setText("[data-hgc-hero-status]", navigator.onLine ? `Website ${snapshot.health.value} · ${snapshot.network.value}` : "Đang chờ kết nối mạng");
    updatePlanetSignals();
    updateActivity(snapshot);
  }

  function countStoredSignals() {
    const todos = readJson(TODO_KEY, []);
    const projects = readJson(PROJECT_KEY, {});
    const communication = readJson(COMMUNICATION_KEY, {});
    const learning = readJson(LEARNING_KEY, {});
    const recent = readJson(RECENT_KEY, []);
    const recentText = JSON.stringify(recent).toLowerCase();
    const mediaKeys = ["hh.media-design.page.v1", "hh-media-design-history", "hh.photo.pro.v2", "hh.resolve-web-studio.v1", "hh.video-editor.project.v1"];
    const mediaCount = mediaKeys.filter((key) => localStorage.getItem(key)).length;
    const projectTasks = Array.isArray(projects?.tasks) ? projects.tasks : [];
    const unread = Array.isArray(communication?.notifications) ? communication.notifications.filter((item) => item && !item.read).length : 0;
    const reviewItems = Array.isArray(learning?.reviews) ? learning.reviews.filter((item) => item && !item.completed).length : 0;
    const pending = [...(Array.isArray(todos) ? todos : []), ...projectTasks].filter((item) => item && !item.completed && item.status !== "done" && item.column !== "done").length;
    return {
      creative: (recentText.match(/ai|creative|creator/g) || []).length,
      work: pending,
      media: mediaCount + (recentText.match(/media|design|photo|video/g) || []).length,
      dev: (recentText.match(/dev|api|git|code/g) || []).length,
      communication: unread,
      learning: reviewItems,
      analytics: document.querySelectorAll(".hhhf-health-overview strong").length ? 1 : 0,
      system: prefs.widgets.length
    };
  }

  function updatePlanetSignals() {
    const counts = countStoredSignals();
    PLANETS.forEach((planet) => {
      const count = counts[planet.id] || 0;
      setText(`[data-hgc-planet-count="${planet.id}"]`, count ? `${count} tín hiệu` : "Sẵn sàng");
      root?.querySelector(`[data-hgc-planet="${planet.id}"]`)?.classList.toggle("has-signal", count > 0);
    });
  }

  function updateActivity(snapshot) {
    const todos = readJson(TODO_KEY, []);
    const recent = readJson(RECENT_KEY, []);
    const pending = (Array.isArray(todos) ? todos : []).filter((item) => item && !item.completed).length;
    const items = [
      { tone: "weather", icon: "◒", text: `${snapshot.weather.value} · ${snapshot.weather.meta}`, target: ".dashboard-weather" },
      { tone: "health", icon: "✚", text: `Website phản hồi ${snapshot.health.meta}`, target: ".hhhf-health" },
      { tone: "work", icon: "□", text: `${pending} công việc đang chờ xử lý`, route: "/work" },
      { tone: "recent", icon: "◷", text: `${Array.isArray(recent) ? recent.length : 0} công cụ trong lịch sử gần đây`, route: "/home" },
      { tone: "network", icon: "↗", text: `${snapshot.network.value} · ${snapshot.network.meta}`, target: ".hhhf-health" }
    ];
    const signature = JSON.stringify(items);
    const track = root?.querySelector("[data-hgc-activity]");
    if (!track || track.dataset.signature === signature) return;
    track.dataset.signature = signature;
    const row = items.map((item) => `<button type="button" class="is-${item.tone}" ${item.route ? `data-hgc-route="${item.route}"` : `data-hgc-target="${item.target}"`}><span>${item.icon}</span><b>${escapeHtml(item.text)}</b><i>→</i></button>`).join("");
    track.innerHTML = `${row}<span class="hgc-activity-copy" aria-hidden="true">${row.replaceAll('type="button"', 'type="button" tabindex="-1"')}</span>`;
  }

  function scheduleUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(() => {
      updateQueued = false;
      updateLive();
    });
  }

  function createMeteor(kind = "ambient") {
    if (!root || prefs.motion === "static" || document.hidden) return;
    const layer = root.querySelector("[data-hgc-meteors]");
    if (!layer) return;
    const meteor = document.createElement("i");
    meteor.className = kind === "notification" ? "is-notification" : "";
    meteor.style.setProperty("--meteor-y", `${8 + Math.random() * 72}%`);
    meteor.style.setProperty("--meteor-delay", `${Math.random() * .4}s`);
    meteor.style.setProperty("--meteor-scale", `${.7 + Math.random() * .85}`);
    layer.append(meteor);
    setTimeout(() => meteor.remove(), 2600);
  }

  function scheduleMeteors() {
    clearTimeout(meteorTimer);
    if (prefs.motion === "static") return;
    const next = prefs.motion === "cinematic" ? 1500 + Math.random() * 2300 : 4200 + Math.random() * 5200;
    meteorTimer = setTimeout(() => {
      createMeteor();
      if (prefs.motion === "cinematic" && Math.random() > .56) setTimeout(createMeteor, 420);
      scheduleMeteors();
    }, next);
  }

  function playTone(frequency = 520, duration = .055) {
    if (!prefs.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.035, audioContext.currentTime + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + .02);
    } catch {}
  }

  function burstAtPlanet(planet) {
    const burst = root?.querySelector("[data-hgc-burst]");
    if (!burst || !planet) return;
    const rootRect = root.getBoundingClientRect();
    const rect = planet.getBoundingClientRect();
    burst.style.setProperty("--burst-x", `${rect.left - rootRect.left + rect.width / 2}px`);
    burst.style.setProperty("--burst-y", `${rect.top - rootRect.top + rect.height / 2}px`);
    burst.innerHTML = Array.from({ length: 16 }, (_, index) => `<i style="--burst-angle:${index * 22.5}deg;--burst-color:${planet.style.getPropertyValue("--planet-color") || "#58f3ff"}"></i>`).join("");
    burst.classList.remove("is-active");
    requestAnimationFrame(() => burst.classList.add("is-active"));
    setTimeout(() => burst.classList.remove("is-active"), 720);
  }

  function notificationComet(message = "Thông báo mới") {
    if (!root || prefs.motion === "static") return;
    const comet = root.querySelector("[data-hgc-notification-comet]");
    if (!comet) return;
    const text = comet.querySelector("span");
    if (text) text.textContent = String(message).slice(0, 70);
    comet.classList.remove("is-active");
    requestAnimationFrame(() => comet.classList.add("is-active"));
    createMeteor("notification");
    setTimeout(() => comet.classList.remove("is-active"), 2800);
  }

  function navigate(route, trigger) {
    if (!/^\/[a-z0-9/_-]+$/i.test(route || "")) return;
    playTone(620, .08);
    if (trigger && prefs.motion !== "static") {
      trigger.classList.add("is-departing");
      burstAtPlanet(trigger);
      setTimeout(() => { location.hash = `#${route}`; trigger.classList.remove("is-departing"); }, 360);
    } else location.hash = `#${route}`;
  }

  function scrollToTarget(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    playTone(440);
    target.scrollIntoView({ behavior: prefs.motion === "static" ? "auto" : "smooth", block: "start" });
    target.classList.add("hgc-highlight");
    setTimeout(() => target.classList.remove("hgc-highlight"), 1200);
  }

  function openSettings(open) {
    const settings = root?.querySelector("[data-hgc-settings]");
    if (!settings) return;
    settings.hidden = !open;
    document.body.classList.toggle("hgc-settings-open", open);
    if (open) requestAnimationFrame(() => settings.querySelector("[data-hgc-settings-close]")?.focus());
  }

  function onClick(event) {
    const settingsOpen = event.target.closest("[data-hgc-settings-open]");
    if (settingsOpen) return openSettings(true);
    if (event.target.closest("[data-hgc-settings-close]")) return openSettings(false);
    const theme = event.target.closest("[data-hgc-theme]");
    if (theme) { prefs.theme = theme.dataset.hgcTheme; playTone(520); return applyPrefs(); }
    const motion = event.target.closest("[data-hgc-motion]");
    if (motion) { prefs.motion = motion.dataset.hgcMotion; return applyPrefs(); }
    if (event.target.closest("[data-hgc-reset]")) {
      prefs = { ...DEFAULT_PREFS, planets: [...DEFAULT_PREFS.planets], widgets: [...DEFAULT_PREFS.widgets] };
      writeJson(PREF_KEY, prefs);
      return mount(mountedHome, true);
    }
    const route = event.target.closest("[data-hgc-route]");
    if (route) return navigate(route.dataset.hgcRoute, route.closest("[data-hgc-planet]"));
    const planet = event.target.closest("[data-hgc-planet]");
    if (planet) return navigate(planet.dataset.hgcRoute, planet);
    const target = event.target.closest("[data-hgc-target]");
    if (target) return scrollToTarget(target.dataset.hgcTarget);
  }

  function onChange(event) {
    if (event.target.matches("[data-hgc-stars]")) {
      prefs.stars = clamp(event.target.value, 20, 100);
      return applyPrefs();
    }
    if (event.target.matches("[data-hgc-sound]")) {
      prefs.sound = event.target.checked;
      writeJson(PREF_KEY, prefs);
      if (prefs.sound) playTone(580, .09);
      return;
    }
    if (event.target.matches("[data-hgc-planet-toggle]")) {
      const id = event.target.dataset.hgcPlanetToggle;
      prefs.planets = event.target.checked ? [...new Set([...prefs.planets, id])] : prefs.planets.filter((item) => item !== id);
      return applyPrefs();
    }
    if (event.target.matches("[data-hgc-widget-toggle]")) {
      const id = event.target.dataset.hgcWidgetToggle;
      prefs.widgets = event.target.checked ? [...new Set([...prefs.widgets, id])] : prefs.widgets.filter((item) => item !== id);
      return applyPrefs();
    }
  }

  function onPointerMove(event) {
    if (!root || prefs.motion === "static" || matchMedia("(pointer: coarse)").matches) return;
    const rect = root.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / Math.min(rect.height, innerHeight), 0, 1);
    root.style.setProperty("--hgc-pointer-x", `${x * 100}%`);
    root.style.setProperty("--hgc-pointer-y", `${y * 100}%`);
    root.style.setProperty("--hgc-parallax-x", `${(x - .5) * 18}px`);
    root.style.setProperty("--hgc-parallax-y", `${(y - .5) * 14}px`);
  }

  function bind() {
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", onChange);
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") openSettings(false);
    });
    if (globalBound) return;
    globalBound = true;
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-todo-toggle]") && event.target.checked) {
        const workPlanet = root?.querySelector('[data-hgc-planet="work"]');
        burstAtPlanet(workPlanet);
        notificationComet("Hoàn thành một công việc");
      }
    });
    addEventListener("online", () => { updateLive(); notificationComet("Kết nối đã trở lại"); });
    addEventListener("offline", () => { updateLive(); notificationComet("Trình duyệt đang offline"); });
  }

  function observeHome() {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.target.closest?.("[data-hgc-root]"))) return;
      scheduleUpdate();
      const hasNew = mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.(".app-notice--new") || node.querySelector?.(".app-notice--new"))));
      if (hasNew) notificationComet("Có tín hiệu mới trong trung tâm thông báo");
    });
    observer.observe(mountedHome, { subtree: true, childList: true, characterData: true });
  }

  function mount(home = document.querySelector('[data-shell-view="home"]'), force = false) {
    const host = home?.querySelector("#homeGalaxyCommandRoot");
    if (!host) return false;
    if (!force && mountedHome === home && root?.isConnected) {
      updateLive();
      return true;
    }
    clearInterval(refreshTimer);
    mountedHome = home;
    home.classList.add("hgc-active");
    host.innerHTML = markup();
    root = host.querySelector("[data-hgc-root]");
    bind();
    applyPrefs();
    updateLive();
    observeHome();
    refreshTimer = setInterval(() => { if (!document.hidden) updateLive(); }, 2000);
    return true;
  }

  function scheduleMount() {
    requestAnimationFrame(() => requestAnimationFrame(() => mount()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleMount);
  else scheduleMount();
  addEventListener("hh:auth-change", scheduleMount);
  addEventListener("hh:workspace-open", scheduleMount);
  addEventListener("hh:assets-ready", (event) => { if (event.detail?.route === "/home") scheduleMount(); });
  addEventListener("hashchange", () => { if (location.hash.includes("/home")) scheduleMount(); });
  addEventListener("storage", (event) => {
    if (event.key === PREF_KEY) { prefs = readPrefs(); applyPrefs(); }
    scheduleUpdate();
  });

  window.HHHomeGalaxyCommand = Object.freeze({
    version: 1,
    mount,
    refresh: updateLive,
    preferences: () => ({ ...prefs, planets: [...prefs.planets], widgets: [...prefs.widgets] })
  });
})();
