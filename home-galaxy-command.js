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
    view: "advanced",
    infoTab: "overview",
    stars: 62,
    sound: false,
    pinned: ["home", "creative", "work", "learning", "japanese"],
    planets: ["home", "system", "creative", "music", "media", "graphic", "dev", "work", "communication", "entertainment", "analytics", "learning", "english", "japanese", "support"],
    widgets: ["weather", "performance", "memory", "network", "health", "sync"]
  });
  const PLANETS = Object.freeze([
    { id: "home", icon: "⌂", label: "Trang chủ", route: "/home", color: "#ffd76b", description: "Dải ngân hà hôm nay và tín hiệu quan trọng." },
    { id: "system", icon: "⚙", label: "Hệ thống", route: "/system", color: "#55f1ff", description: "Giao diện, quyền riêng tư, PWA và trạng thái hệ thống." },
    { id: "creative", icon: "✦", label: "Sáng tạo", route: "/create", color: "#ff59d6", description: "AI Center, nội dung, chiến dịch và quy trình sáng tạo." },
    { id: "music", icon: "♫", label: "Làm nhạc AI", route: "/music-ai", color: "#ffab63", description: "Sáng tác, phối khí, mix, master và xuất bản." },
    { id: "media", icon: "◈", label: "Media & Design", route: "/media-design", color: "#b8ff72", description: "Ảnh, video và dự án xuất bản đa phương tiện." },
    { id: "graphic", icon: "✺", label: "Thiết kế đồ họa", route: "/graphic-design", color: "#bf93ff", description: "Vector, typography, mockup và motion design." },
    { id: "dev", icon: "⌘", label: "DEV", route: "/dev-tools", color: "#58f3ff", description: "Công cụ lập trình, API, Git, dữ liệu và bảo mật." },
    { id: "work", icon: "□", label: "Công việc", route: "/work", color: "#ff6fcf", description: "Task, dự án, tiến độ và phiên tập trung." },
    { id: "communication", icon: "◌", label: "Giao tiếp", route: "/communication", color: "#67efbd", description: "Messenger, cộng đồng, thông báo và phòng trực tiếp." },
    { id: "entertainment", icon: "◉", label: "Game", route: "/entertainment", color: "#ffd26d", description: "Game Center, Arcade, Cinematic 3D và ASTRA Space." },
    { id: "analytics", icon: "↗", label: "Phân tích", route: "/analytics", color: "#72cbff", description: "Website Health, hiệu suất, Web Vitals và báo cáo." },
    { id: "learning", icon: "◫", label: "Học tập", route: "/learn", color: "#f899ff", description: "Lộ trình, bài ôn, lớp học và kho kiến thức." },
    { id: "english", icon: "E", label: "HH English", route: "/english", color: "#dfff7b", description: "CEFR, luyện nghe, phát âm và vốn từ." },
    { id: "japanese", icon: "日", label: "HH Japanese", route: "/japanese", color: "#ff896b", description: "JLPT/JF, Kanji, từ vựng và giao tiếp." },
    { id: "support", icon: "♥", label: "Ủng hộ HH", route: "/support", color: "#ff76b8", description: "Ủng hộ, phản hồi, roadmap và hỗ trợ." }
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
  const boundRoots = new WeakSet();
  let mountedHome = null;
  let root = null;
  let prefs = null;
  let observer = null;
  let globalBound = false;
  let refreshTimer = 0;
  let meteorTimer = 0;
  let audioContext = null;
  let updateQueued = false;
  let pointerFrame = 0;
  let pointerSample = null;
  let pointerBounds = null;
  let activePlanetId = "home";
  let activeInfoTab = "overview";
  let todayPage = 0;
  let mobilePane = "galaxy";

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
      view: ["basic", "advanced", "focus"].includes(saved.view) ? saved.view : DEFAULT_PREFS.view,
      infoTab: ["overview", "work", "learning", "website", "notifications", "progress"].includes(saved.infoTab) ? saved.infoTab : DEFAULT_PREFS.infoTab,
      stars: clamp(saved.stars ?? DEFAULT_PREFS.stars, 20, 100),
      sound: saved.sound === true,
      pinned: Array.isArray(saved.pinned)
        ? saved.pinned.filter((id) => PLANETS.some((planet) => planet.id === id)).slice(0, 5)
        : [...DEFAULT_PREFS.pinned],
      planets: Array.isArray(saved.planets) ? saved.planets.filter((id) => PLANETS.some((planet) => planet.id === id)) : [...DEFAULT_PREFS.planets],
      widgets: Array.isArray(saved.widgets) ? saved.widgets.filter((id) => WIDGETS.some((widget) => widget.id === id)) : [...DEFAULT_PREFS.widgets]
    };
  }

  prefs = readPrefs();
  activeInfoTab = prefs.infoTab;

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
    return `<button class="hgc-planet hgc-planet--${index + 1}" type="button" data-hgc-planet="${planet.id}" style="--planet-color:${planet.color};--planet-index:${index}" aria-pressed="${planet.id === activePlanetId}" aria-label="Chọn ${escapeHtml(planet.label)}: ${escapeHtml(planet.description)}">
      <span class="hgc-planet-sphere"><i>${planet.icon}</i><b></b><em></em></span>
      <strong>${escapeHtml(planet.label)}</strong>
      <small data-hgc-planet-count="${planet.id}">0 tín hiệu</small>
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
    const planetOptions = PLANETS.map((planet) => `<label><input type="checkbox" data-hgc-planet-toggle="${planet.id}" ${prefs.pinned.includes(planet.id) ? "checked" : ""}><span style="--setting-color:${planet.color}">${planet.icon}</span><b>${escapeHtml(planet.label)}</b></label>`).join("");
    const widgetOptions = WIDGETS.map((widget) => `<label><input type="checkbox" data-hgc-widget-toggle="${widget.id}" ${prefs.widgets.includes(widget.id) ? "checked" : ""}><span>${widget.icon}</span><b>${escapeHtml(widget.label)}</b></label>`).join("");
    return `<aside class="hgc-settings" data-hgc-settings hidden aria-label="Cá nhân hóa vũ trụ">
      <button class="hgc-settings-backdrop" type="button" data-hgc-settings-close aria-label="Đóng cá nhân hóa"></button>
      <section class="hgc-settings-panel" role="dialog" aria-modal="true" aria-labelledby="hgcSettingsTitle">
        <header><div><small>GALAXY CONTROL</small><h3 id="hgcSettingsTitle">Cá nhân hóa vũ trụ</h3></div><button type="button" data-hgc-settings-close aria-label="Đóng">×</button></header>
        <div class="hgc-setting-group"><span>Tinh vân</span><div class="hgc-choice-grid">${themeOptions}</div></div>
        <div class="hgc-setting-group"><span>Mức chuyển động</span><div class="hgc-choice-grid">${motionOptions}</div></div>
        <label class="hgc-range"><span>Mật độ sao <b data-hgc-star-value>${prefs.stars}%</b></span><input type="range" min="20" max="100" step="10" value="${prefs.stars}" data-hgc-stars></label>
        <label class="hgc-sound"><input type="checkbox" data-hgc-sound ${prefs.sound ? "checked" : ""}><span></span><b>Âm thanh không gian</b><small>Mặc định tắt · chỉ phát sau khi bạn tương tác</small></label>
        <div class="hgc-setting-group"><span>Quỹ đạo ghim · tối đa 5 hành tinh</span><div class="hgc-check-grid">${planetOptions}</div></div>
        <div class="hgc-setting-group"><span>Widget realtime hiển thị</span><div class="hgc-check-grid">${widgetOptions}</div></div>
        <footer><button type="button" data-hgc-reset>Khôi phục mặc định</button><button type="button" class="is-primary" data-hgc-settings-close>Hoàn tất</button></footer>
      </section>
    </aside>`;
  }

  function markup() {
    const nowPeriod = period();
    const viewButtons = [["basic", "Basic"], ["advanced", "Advanced"], ["focus", "Focus"]]
      .map(([id, label]) => `<button type="button" data-hgc-view-option="${id}" aria-pressed="${prefs.view === id}">${label}</button>`).join("");
    const infoTabs = [["overview", "Widgets"], ["work", "Công việc"], ["learning", "Học tập"], ["website", "Website"], ["notifications", "Thông báo"], ["progress", "Tiến độ"]]
      .map(([id, label]) => `<button type="button" role="tab" data-hgc-info-tab="${id}" aria-selected="${activeInfoTab === id}">${label}</button>`).join("");
    return `<section class="hgc hgc-v3 hgc-v4" data-hgc-root data-hgc-theme="${prefs.theme}" data-hgc-motion="${prefs.motion}" data-hgc-view="${prefs.view}" data-hgc-info="${activeInfoTab}" data-hgc-today-page="0" data-hgc-mobile-pane="${mobilePane}" data-hgc-period="${nowPeriod.id}">
      <div class="hgc-space" aria-hidden="true">
        <div class="hgc-prism-fog"></div>
        <div class="hgc-aurora-ribbons"><i></i><i></i><i></i></div>
        <div class="hgc-light-rays"><i></i><i></i><i></i></div>
        <div class="hgc-stars hgc-stars--far" data-hgc-stars-layer="far"></div>
        <div class="hgc-cosmic-dust" data-hgc-cosmic-dust></div>
        <div class="hgc-stars hgc-stars--near" data-hgc-stars-layer="near"></div>
        <div class="hgc-nebula"></div>
        <div class="hgc-lens-flare"><i></i><b></b><em></em></div>
        <div class="hgc-cursor-light"></div>
        <div class="hgc-meteors" data-hgc-meteors></div>
      </div>
      <header class="hgc-commandbar">
        <div class="hgc-commandbar-brand"><span>H</span><div><small>LIVING DESKTOP GALAXY V4</small><strong><b data-hgc-greeting>${nowPeriod.greeting}</b>, <i data-hgc-user>${escapeHtml(userName())}</i></strong></div></div>
        <button type="button" class="hgc-command-search" data-command-open><span>⌕</span><b>Tìm nhanh</b><kbd>Ctrl K</kbd></button>
        <div class="hgc-status-strip" aria-label="Trạng thái trực tiếp">
          <span><i>◷</i><b data-hlw-status="clock">--:--</b><small>Thời gian</small></span>
          <span><i>◒</i><b data-hlw-status="weather">Đang tải</b><small>Thời tiết</small></span>
          <span><i>↗</i><b data-hlw-status="http">Đang đo</b><small>HTTP latency</small></span>
          <span><i>✚</i><b data-hlw-status="api">Đang đo</b><small>Backend API</small></span>
          <span><i>⌁</i><b data-hlw-status="network">Online</b><small>Mạng</small></span>
          <span><i>◇</i><b data-hlw-status="notifications">0</b><small>Thông báo</small></span>
        </div>
        <div class="hgc-command-controls"><div class="hgc-view-switch" aria-label="Chế độ hiển thị">${viewButtons}</div><button type="button" data-hgc-motion-cycle title="Đổi mức chuyển động">◉ <span data-hgc-motion-label>Chuyển động</span></button><button type="button" data-hgc-settings-open aria-label="Cá nhân hóa">⚙</button></div>
      </header>

      <nav class="hgc-mobile-switcher" aria-label="Chuyển khu vực trang chủ"><button type="button" data-hgc-mobile-pane-option="today">Hôm nay</button><button type="button" data-hgc-mobile-pane-option="galaxy" aria-pressed="true">Thiên hà</button><button type="button" data-hgc-mobile-pane-option="info">Thông tin</button></nav>

      <main class="hgc-one-screen">
        <aside class="hgc-today-panel" aria-labelledby="hgcTodayTitle">
          <header><div><small>HÔM NAY</small><h2 id="hgcTodayTitle">Ưu tiên của bạn</h2></div><div><button type="button" data-hgc-today-step="-1" aria-label="Trang trước">←</button><b data-hgc-today-indicator>1/2</b><button type="button" data-hgc-today-step="1" aria-label="Trang sau">→</button></div></header>
          <div class="hgc-today-list">
            <button type="button" class="is-priority" data-hgc-today-card data-page="0" data-hgc-today="tasks" data-hgc-route="/work"><span>□</span><small>VIỆC ƯU TIÊN</small><strong data-hgc-today-title="tasks">0 việc cần làm</strong><em data-hgc-today-meta="tasks">Chưa có việc tồn đọng</em></button>
            <button type="button" data-hgc-today-card data-page="0" data-hgc-today="calendar" data-hgc-route="/work"><span>◷</span><small>LỊCH SẮP TỚI</small><strong data-hgc-today-title="calendar">Chưa có lịch gần</strong><em data-hgc-today-meta="calendar">Các mốc có ngày sẽ xuất hiện ở đây</em></button>
            <button type="button" data-hgc-today-card data-page="0" data-hgc-today="learning" data-hgc-route="/learn/review"><span>◫</span><small>HỌC ĐẾN HẠN</small><strong data-hgc-today-title="learning">0 bài đến hạn</strong><em data-hgc-today-meta="learning">Không có bài ôn đang chờ</em></button>
            <button type="button" data-hgc-today-card data-page="1" data-hgc-today="continue" data-hgc-route="/home"><span>◉</span><small>TIẾP TỤC LÀM</small><strong data-hgc-today-title="continue">Chưa có phiên gần đây</strong><em data-hgc-today-meta="continue">Mở một công cụ để lưu hành trình</em></button>
            <button type="button" data-hgc-today-card data-page="1" data-hgc-today="notifications" data-hgc-route="/communication/notifications"><span>◇</span><small>THÔNG BÁO</small><strong data-hgc-today-title="notifications">0 thông báo mới</strong><em data-hgc-today-meta="notifications">Hộp thư đã được xử lý</em></button>
          </div>
          <footer><button type="button" class="hgc-continue-main" data-hgc-continue-main data-hgc-route="/home"><span>▶</span><b>Tiếp tục công việc</b><small data-hgc-continue-label>Mở phiên gần nhất</small></button></footer>
        </aside>

        <section class="hgc-galaxy-panel" aria-labelledby="hgcGalaxyTitle">
          <header><div><small>THIÊN HÀ 15 MỤC</small><h2 id="hgcGalaxyTitle">Chọn hành tinh để bắt đầu</h2></div><div class="hgc-pinned-orbit" data-hgc-pinned-orbit aria-label="Năm hành tinh được ghim"></div></header>
          <div class="hgc-solar" data-hgc-solar aria-label="Mười lăm hành tinh chức năng">
            <div class="hgc-orbit hgc-orbit--1"></div><div class="hgc-orbit hgc-orbit--2"></div><div class="hgc-orbit hgc-orbit--3"></div><div class="hgc-orbit hgc-orbit--4"></div>
            <div class="hgc-orbit-particles" aria-hidden="true">${Array.from({ length: 12 }, (_, index) => `<i style="--orbit-particle:${index};--orbit-start:${index * 30}deg;--orbit-delay:${-(index * .7)}s;--orbit-tone:${PLANETS[index % PLANETS.length].color}"></i>`).join("")}</div>
            <div class="hgc-energy-lines" aria-hidden="true"></div><div class="hgc-scanner-ring" aria-hidden="true"><i></i></div><div class="hgc-focus-beam" aria-hidden="true"><i></i></div>
            <div class="hgc-sun" aria-label="Mặt trời chỉ huy H"><span>H</span><i></i><b></b><em></em></div><div class="hgc-plasma-arcs" aria-hidden="true"><i></i><b></b><em></em></div>
            <div class="hgc-sun-particles" data-hgc-sun-particles aria-hidden="true"></div><div class="hgc-planets">${PLANETS.map(planetMarkup).join("")}</div>
          </div>
          <div class="hgc-planet-inspector" data-hgc-planet-inspector style="--selected-color:${PLANETS[0].color}">
            <button type="button" data-hgc-planet-step="-1" aria-label="Hành tinh trước">←</button><span data-hgc-selected-icon>${PLANETS[0].icon}</span><div><small>HÀNH TINH ĐANG CHỌN</small><strong data-hgc-selected-title>${escapeHtml(PLANETS[0].label)}</strong><p data-hgc-selected-description>${escapeHtml(PLANETS[0].description)}</p></div><b data-hgc-selected-signals>Sẵn sàng</b><button type="button" data-hgc-pin-planet aria-pressed="${prefs.pinned.includes(PLANETS[0].id)}">☆ Ghim</button><button type="button" class="is-primary" data-hgc-planet-open data-hgc-route="${PLANETS[0].route}">Mở ngay</button><button type="button" data-hgc-planet-step="1" aria-label="Hành tinh sau">→</button>
          </div>
        </section>

        <aside class="hgc-info-center" aria-labelledby="hgcInfoTitle">
          <header><div><small>TRUNG TÂM THÔNG TIN</small><h2 id="hgcInfoTitle">Tín hiệu hữu ích</h2></div><b data-hgc-hero-status>Đang đồng bộ</b></header>
          <div class="hgc-info-tabs" role="tablist" aria-label="Nhóm thông tin">${infoTabs}</div>
          <div class="hgc-info-panels">
            <section data-hgc-info-panel="overview" role="tabpanel"><div data-hlw-host aria-label="Live Widget Rack"></div></section>
            <section data-hgc-info-panel="work" role="tabpanel" hidden><div class="hgc-info-summary"><strong data-hgc-work-count>0 việc</strong><span>Dữ liệu từ Project Center và Task</span></div><div class="hgc-info-list" data-hgc-info-list="work"></div><button type="button" data-hgc-route="/work">Mở trung tâm công việc →</button></section>
            <section data-hgc-info-panel="learning" role="tabpanel" hidden><div class="hgc-info-summary"><strong data-hgc-learning-count>0 bài ôn</strong><span>HH English và HH Japanese</span></div><div class="hgc-info-list" data-hgc-info-list="learning"></div><button type="button" data-hgc-route="/learn/review">Học nhanh 10 phút →</button></section>
            <section data-hgc-info-panel="website" role="tabpanel" hidden><div class="hgc-website-grid"><article><small>Hiệu năng</small><strong data-hgc-value="performance">Đang đo</strong><em data-hgc-meta="performance">FPS và độ trễ</em></article><article><small>Bộ nhớ</small><strong data-hgc-value="memory">Đang đọc</strong><em data-hgc-meta="memory">Heap tab</em></article><article><small>Mạng</small><strong data-hgc-value="network">Online</strong><em data-hgc-meta="network">Trình duyệt</em></article><article><small>Backend</small><strong data-hgc-value="health">Đang kiểm tra</strong><em data-hgc-meta="health">Website Health</em></article></div><button type="button" data-hgc-route="/analytics">Mở Website Health →</button></section>
            <section data-hgc-info-panel="notifications" role="tabpanel" hidden><div class="hgc-info-summary"><strong data-hgc-notification-count>0 thông báo</strong><span>Chỉ hiển thị mục chưa đọc</span></div><div class="hgc-info-list" data-hgc-info-list="notifications"></div><button type="button" data-hgc-route="/communication/notifications">Mở tất cả thông báo →</button></section>
            <section data-hgc-info-panel="progress" role="tabpanel" hidden><div class="hgc-constellation-map" aria-label="Tiến độ thực trên thiết bị"><svg viewBox="0 0 360 210" role="img" aria-label="Chòm sao tiến độ"><path d="M45 142 L132 42 L232 136 L322 54"/><path class="is-soft" d="M45 142 L232 136 M132 42 L322 54"/><g data-hgc-star="creative" transform="translate(45 142)"><circle r="8"/><text x="0" y="30">Sáng tạo</text><text class="value" x="0" y="-16">0%</text></g><g data-hgc-star="learning" transform="translate(132 42)"><circle r="8"/><text x="0" y="30">Học tập</text><text class="value" x="0" y="-16">0%</text></g><g data-hgc-star="work" transform="translate(232 136)"><circle r="8"/><text x="0" y="30">Công việc</text><text class="value" x="0" y="-16">0%</text></g><g data-hgc-star="entertainment" transform="translate(322 54)"><circle r="8"/><text x="0" y="30">Game</text><text class="value" x="0" y="-16">0%</text></g></svg></div><p class="hgc-truth-note">Tính từ hoạt động đã lưu thật trên thiết bị, không dùng xếp hạng giả.</p></section>
          </div>
        </aside>
      </main>

      <section class="hlw-event-bar" data-hlw-event-bar aria-label="Sự kiện trực tiếp gần đây"></section>

      <nav class="hgc-dock" aria-label="Dock trang chủ"><button type="button" data-hgc-route="/home"><i>⌂</i><b>Trang chủ</b></button><button type="button" class="is-create" data-hgc-quick-toggle><i>＋</i><b>Tạo mới</b></button><button type="button" data-hgc-info-open="overview"><i>✦</i><b>Widgets</b></button><button type="button" data-command-open><i>⌕</i><b>Tìm kiếm</b></button><button type="button" data-hgc-info-open="notifications"><i>◇</i><b>Thông báo</b><em data-hgc-dock-notifications hidden>0</em></button></nav>

      <aside class="hgc-quick-menu" data-hgc-quick-menu hidden><button type="button" data-hgc-quick-close aria-label="Đóng menu tạo mới"></button><section role="dialog" aria-modal="true" aria-labelledby="hgcQuickTitle"><header><div><small>QUICK ACTIONS</small><h2 id="hgcQuickTitle">Bạn muốn làm gì?</h2></div><button type="button" data-hgc-quick-close aria-label="Đóng">×</button></header><div><button type="button" data-hgc-route="/create/ai-center"><span>✦</span><b>Tạo nội dung AI</b><small>Ý tưởng, kịch bản và nội dung</small></button><button type="button" data-hgc-route="/davinci-resolve/youtube"><span>YT</span><b>Đăng video</b><small>Chọn kênh và upload</small></button><button type="button" data-hgc-route="/davinci-resolve/image-text"><span>TX</span><b>Chỉnh thumbnail</b><small>Chèn chữ và xuất hàng loạt</small></button><button type="button" data-hgc-route="/music-ai"><span>♫</span><b>Tạo nhạc</b><small>Music AI Studio</small></button><button type="button" data-hgc-route="/work"><span>□</span><b>Thêm công việc</b><small>Project và Task Center</small></button><button type="button" data-hgc-route="/learn/review"><span>◫</span><b>Học nhanh 10 phút</b><small>Bài ôn đang đến hạn</small></button><button type="button" data-hgc-quick-recent data-hgc-route="/home"><span>◉</span><b>Mở dự án gần nhất</b><small data-hgc-quick-recent-label>Chưa có phiên gần đây</small></button></div></section></aside>
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
    const dust = root.querySelector("[data-hgc-cosmic-dust]");
    if (dust) {
      const qualityCount = root.dataset.hgcQuality === "ultra" ? 36 : root.dataset.hgcQuality === "low" ? 10 : 22;
      const count = Math.max(8, Math.round(qualityCount * prefs.stars / 100));
      dust.innerHTML = Array.from({ length: count }, (_, index) => {
        const x = (index * 61 + 7) % 100;
        const y = (index * 43 + 19) % 100;
        const depth = 1 + index % 3;
        return `<i style="--dust-x:${x}%;--dust-y:${y}%;--dust-depth:${depth};--dust-delay:${-(index % 11) * .83}s"></i>`;
      }).join("");
    }
  }

  function detectQuality() {
    const memory = Number(navigator.deviceMemory || 4);
    const cores = Number(navigator.hardwareConcurrency || 4);
    const constrained = navigator.connection?.saveData === true || memory <= 2 || cores <= 2;
    const compact = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
    if (constrained || prefs.motion === "static") return "low";
    if (!compact && prefs.motion === "cinematic" && memory >= 8 && cores >= 8) return "ultra";
    return "balanced";
  }

  function renderPinnedOrbit() {
    const host = root?.querySelector("[data-hgc-pinned-orbit]");
    if (!host) return;
    host.innerHTML = prefs.pinned.map((id) => {
      const planet = PLANETS.find((item) => item.id === id);
      return planet ? `<button type="button" data-hgc-select-planet="${planet.id}" style="--pin-color:${planet.color}" aria-label="Chọn hành tinh ghim ${escapeHtml(planet.label)}"><span>${planet.icon}</span><b>${escapeHtml(planet.label)}</b></button>` : "";
    }).join("") || `<span class="hgc-pinned-empty">Ghim tối đa 5 hành tinh thường dùng</span>`;
  }

  function setInfoTab(id, persist = true) {
    if (!root || !["overview", "work", "learning", "website", "notifications", "progress"].includes(id)) return;
    activeInfoTab = id;
    root.dataset.hgcInfo = id;
    root.querySelectorAll("[data-hgc-info-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.hgcInfoTab === id)));
    root.querySelectorAll("[data-hgc-info-panel]").forEach((panel) => { panel.hidden = panel.dataset.hgcInfoPanel !== id; });
    if (persist) {
      prefs.infoTab = id;
      writeJson(PREF_KEY, prefs);
    }
  }

  function selectPlanet(id, focus = false) {
    const planet = PLANETS.find((item) => item.id === id) || PLANETS[0];
    if (!root || !planet) return;
    activePlanetId = planet.id;
    root.dataset.hgcSelectedPlanet = planet.id;
    root.querySelectorAll("[data-hgc-planet]").forEach((button) => {
      const selected = button.dataset.hgcPlanet === planet.id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (selected && focus) button.focus({ preventScroll: true });
    });
    const inspector = root.querySelector("[data-hgc-planet-inspector]");
    inspector?.style.setProperty("--selected-color", planet.color);
    setText("[data-hgc-selected-icon]", planet.icon);
    setText("[data-hgc-selected-title]", planet.label);
    setText("[data-hgc-selected-description]", planet.description);
    const signal = root.querySelector(`[data-hgc-planet-count="${planet.id}"]`)?.textContent || "Sẵn sàng";
    setText("[data-hgc-selected-signals]", signal);
    const open = root.querySelector("[data-hgc-planet-open]");
    if (open) open.dataset.hgcRoute = planet.route;
    const pin = root.querySelector("[data-hgc-pin-planet]");
    const pinned = prefs.pinned.includes(planet.id);
    if (pin) { pin.setAttribute("aria-pressed", String(pinned)); pin.textContent = pinned ? "★ Đã ghim" : "☆ Ghim"; }
    targetPlanet(root.querySelector(`[data-hgc-planet="${planet.id}"]`));
  }

  function stepPlanet(direction) {
    const index = Math.max(0, PLANETS.findIndex((planet) => planet.id === activePlanetId));
    selectPlanet(PLANETS[(index + direction + PLANETS.length) % PLANETS.length].id, true);
  }

  function applyPrefs() {
    if (!root) return;
    root.dataset.hgcTheme = prefs.theme;
    root.dataset.hgcMotion = prefs.motion;
    root.dataset.hgcView = prefs.view;
    root.dataset.hgcQuality = detectQuality();
    root.querySelectorAll("[data-hgc-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcTheme === prefs.theme)));
    root.querySelectorAll("[data-hgc-motion]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcMotion === prefs.motion)));
    root.querySelectorAll("[data-hgc-view-option]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcViewOption === prefs.view)));
    root.querySelectorAll("[data-hgc-widget]").forEach((node) => { node.hidden = !prefs.widgets.includes(node.dataset.hgcWidget); });
    const pinPositions = [[50, 27], [68, 41], [61, 65], [39, 65], [32, 41]];
    root.querySelectorAll("[data-hgc-planet]").forEach((node) => {
      const pinIndex = prefs.pinned.indexOf(node.dataset.hgcPlanet);
      node.classList.toggle("is-pinned", pinIndex >= 0);
      node.hidden = false;
      if (pinIndex >= 0) {
        node.style.setProperty("--hgc-pin-left", `${pinPositions[pinIndex][0]}%`);
        node.style.setProperty("--hgc-pin-top", `${pinPositions[pinIndex][1]}%`);
      } else {
        node.style.removeProperty("--hgc-pin-left");
        node.style.removeProperty("--hgc-pin-top");
      }
    });
    root.querySelectorAll("[data-hgc-planet-toggle]").forEach((input) => { input.checked = prefs.pinned.includes(input.dataset.hgcPlanetToggle); });
    setText("[data-hgc-motion-label]", ({ static: "Tĩnh", balanced: "Cân bằng", cinematic: "Điện ảnh" })[prefs.motion]);
    const starValue = root.querySelector("[data-hgc-star-value]");
    if (starValue) starValue.textContent = `${prefs.stars}%`;
    renderPinnedOrbit();
    setInfoTab(activeInfoTab, false);
    selectPlanet(activePlanetId);
    renderStars();
    scheduleMeteors();
    writeJson(PREF_KEY, prefs);
  }

  function setText(selector, value) {
    const text = String(value ?? "");
    root?.querySelectorAll(selector).forEach((node) => { if (node.textContent !== text) node.textContent = text; });
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
    const connectedRoot = document.querySelector("[data-hgc-root]");
    if (connectedRoot && connectedRoot !== root) { root = connectedRoot; pointerBounds = null; }
    if (!root) return;
    bindInteractiveRoot(root);
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
    updateLivingPanels();
  }

  function updateLivingPanels() {
    const todos = readJson(TODO_KEY, []);
    const projects = readJson(PROJECT_KEY, {});
    const communication = readJson(COMMUNICATION_KEY, {});
    const learning = readJson(LEARNING_KEY, {});
    const recent = readJson(RECENT_KEY, []);
    const projectTasks = Array.isArray(projects.tasks) ? projects.tasks : [];
    const allTasks = [...(Array.isArray(todos) ? todos : []), ...projectTasks];
    const pending = allTasks.filter((item) => item && !item.completed && item.status !== "done" && item.column !== "done");
    const completed = allTasks.filter((item) => item && (item.completed || item.status === "done" || item.column === "done")).length;
    const reviews = Array.isArray(learning.reviews) ? learning.reviews.filter((item) => item && !item.completed) : [];
    const unread = Array.isArray(communication.notifications) ? communication.notifications.filter((item) => item && !item.read) : [];
    const recentItems = Array.isArray(recent) ? recent : [];
    const renderList = (name, items, emptyText) => {
      const host = root?.querySelector(`[data-hgc-info-list="${name}"]`);
      if (!host) return;
      host.innerHTML = items.length ? items.slice(0, 3).map((item) => {
        const title = String(item?.title || item?.label || item?.name || "Mục chưa đặt tên").slice(0, 80);
        const rawDate = item?.dueAt || item?.dueDate || item?.deadline || item?.scheduledAt || item?.date;
        const timestamp = rawDate ? Date.parse(rawDate) : NaN;
        const meta = Number.isFinite(timestamp)
          ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp))
          : String(item?.status || item?.type || "Đang chờ").slice(0, 42);
        return `<article><span>${name === "work" ? "□" : name === "learning" ? "◫" : "◇"}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></div></article>`;
      }).join("") : `<p class="hgc-info-empty">${escapeHtml(emptyText)}</p>`;
    };
    const latest = recentItems[0];
    const latestText = typeof latest === "string" ? latest : latest?.title || latest?.label || latest?.route || "";
    const latestRoute = typeof latest === "object" && /^\/[a-z0-9/_-]+$/i.test(latest?.route || "") ? latest.route : "/home";
    setText('[data-hgc-today-title="continue"]', latestText ? String(latestText).slice(0, 62) : "Chưa có phiên gần đây");
    setText('[data-hgc-today-meta="continue"]', latestText ? "Tiếp tục đúng nơi bạn đã dừng" : "Mở một công cụ để lưu hành trình");
    const continueButton = root?.querySelector('[data-hgc-today="continue"]');
    if (continueButton) continueButton.dataset.hgcRoute = latestRoute;
    root?.querySelectorAll("[data-hgc-continue-main], [data-hgc-quick-recent]").forEach((button) => { button.dataset.hgcRoute = latestRoute; });
    setText("[data-hgc-continue-label]", latestText ? String(latestText).slice(0, 46) : "Mở phiên gần nhất");
    setText("[data-hgc-quick-recent-label]", latestText ? String(latestText).slice(0, 52) : "Chưa có phiên gần đây");
    setText('[data-hgc-today-title="tasks"]', `${pending.length} việc cần làm`);
    setText('[data-hgc-today-meta="tasks"]', pending[0]?.title ? String(pending[0].title).slice(0, 70) : "Hôm nay chưa có công việc tồn đọng");
    setText('[data-hgc-today-title="learning"]', `${reviews.length} bài đến hạn`);
    setText('[data-hgc-today-meta="learning"]', reviews[0]?.title ? String(reviews[0].title).slice(0, 70) : "Không có bài ôn đang chờ");
    setText('[data-hgc-today-title="notifications"]', `${unread.length} thông báo mới`);
    setText('[data-hgc-today-meta="notifications"]', unread[0]?.title ? String(unread[0].title).slice(0, 70) : "Hộp thư đã được xử lý");
    const scheduleSources = [
      ...pending,
      ...(Array.isArray(projects.milestones) ? projects.milestones : []),
      ...(Array.isArray(projects.events) ? projects.events : []),
      ...(Array.isArray(communication.calendar) ? communication.calendar : [])
    ];
    const nextSchedule = scheduleSources.map((item) => {
      const raw = item?.dueAt || item?.dueDate || item?.deadline || item?.scheduledAt || item?.date || item?.startAt;
      return { item, time: raw ? Date.parse(raw) : NaN };
    }).filter((entry) => Number.isFinite(entry.time) && entry.time >= Date.now() - 3600000).sort((a, b) => a.time - b.time)[0];
    setText('[data-hgc-today-title="calendar"]', nextSchedule?.item?.title ? String(nextSchedule.item.title).slice(0, 62) : "Chưa có lịch gần");
    setText('[data-hgc-today-meta="calendar"]', nextSchedule ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(nextSchedule.time)) : "Các mốc có ngày sẽ xuất hiện ở đây");
    const calendarCard = root?.querySelector('[data-hgc-today="calendar"]');
    if (calendarCard && /^\/[a-z0-9/_-]+$/i.test(nextSchedule?.item?.route || "")) calendarCard.dataset.hgcRoute = nextSchedule.item.route;
    setText("[data-hgc-today-date]", new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date()));
    setText("[data-hgc-status-tasks]", pending.length);
    setText("[data-hgc-status-notifications]", unread.length);
    setText("[data-hgc-work-count]", `${pending.length} việc`);
    setText("[data-hgc-learning-count]", `${reviews.length} bài ôn`);
    setText("[data-hgc-notification-count]", `${unread.length} thông báo`);
    renderList("work", pending, "Không có công việc tồn đọng.");
    renderList("learning", reviews, "Không có bài ôn đang chờ.");
    renderList("notifications", unread, "Không có thông báo chưa đọc.");
    const dockBadge = root?.querySelector("[data-hgc-dock-notifications]");
    if (dockBadge) { dockBadge.textContent = String(Math.min(99, unread.length)); dockBadge.hidden = unread.length === 0; }

    const text = JSON.stringify(recentItems).toLowerCase();
    const categoryScore = (terms) => Math.min(100, terms.reduce((sum, term) => sum + (text.split(term).length - 1) * 12, 0));
    const scores = {
      creative: categoryScore(["create", "creative", "ai", "media", "graphic"]),
      learning: Math.min(100, reviews.length * 8 + Object.keys(learning.progress || {}).length * 10),
      work: allTasks.length ? Math.round(completed / allTasks.length * 100) : 0,
      entertainment: categoryScore(["game", "astra", "entertainment", "arcade"])
    };
    Object.entries(scores).forEach(([name, score]) => {
      const star = root?.querySelector(`[data-hgc-star="${name}"]`);
      const value = star?.querySelector(".value");
      if (value) value.textContent = `${score}%`;
      star?.style.setProperty("--star-strength", String(.72 + score / 180));
    });
    selectPlanet(activePlanetId);
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
      home: recent.length,
      system: prefs.widgets.length,
      creative: (recentText.match(/ai|creative|creator/g) || []).length,
      music: (recentText.match(/music|composer|lyrics/g) || []).length,
      work: pending,
      media: mediaCount + (recentText.match(/media|design|photo|video/g) || []).length,
      graphic: (recentText.match(/graphic|vector|mockup/g) || []).length,
      dev: (recentText.match(/dev|api|git|code/g) || []).length,
      communication: unread,
      entertainment: (recentText.match(/game|astra|arcade/g) || []).length,
      learning: reviewItems,
      english: (recentText.match(/english|cefr/g) || []).length,
      japanese: (recentText.match(/japanese|jlpt/g) || []).length,
      support: (recentText.match(/support|donat/g) || []).length,
      analytics: document.querySelectorAll(".hhhf-health-overview strong").length ? 1 : 0,
    };
  }

  function updatePlanetSignals() {
    const counts = countStoredSignals();
    PLANETS.forEach((planet) => {
      const count = counts[planet.id] || 0;
      setText(`[data-hgc-planet-count="${planet.id}"]`, count ? `${count} tín hiệu` : "Sẵn sàng");
      root?.querySelector(`[data-hgc-planet="${planet.id}"]`)?.classList.toggle("has-signal", count > 0);
    });
    selectPlanet(activePlanetId);
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
    const activeLimit = root.dataset.hgcQuality === "ultra" ? 3 : root.dataset.hgcQuality === "low" ? 1 : 2;
    if (layer.childElementCount >= activeLimit) return;
    const meteor = document.createElement("i");
    const depths = root.dataset.hgcQuality === "low" ? ["far"] : ["far", "middle", "near"];
    const tones = ["cyan", "violet", "pink", "gold"];
    const depth = depths[Math.floor(Math.random() * depths.length)];
    const tone = kind === "notification" ? "pink" : tones[Math.floor(Math.random() * tones.length)];
    meteor.className = `is-${depth} is-${tone}${kind === "notification" ? " is-notification" : ""}`;
    meteor.style.setProperty("--meteor-y", `${8 + Math.random() * 72}%`);
    meteor.style.setProperty("--meteor-delay", `${Math.random() * .4}s`);
    meteor.style.setProperty("--meteor-scale", `${.7 + Math.random() * .85}`);
    meteor.style.setProperty("--meteor-drift", `${180 + Math.random() * 260}px`);
    layer.append(meteor);
    setTimeout(() => meteor.remove(), 2600);
  }

  function meteorShower() {
    if (!root || prefs.motion !== "cinematic" || root.dataset.hgcQuality !== "ultra" || document.hidden) return;
    [0, 260, 540].forEach((delay) => setTimeout(() => createMeteor("shower"), delay));
  }

  function scheduleMeteors() {
    clearTimeout(meteorTimer);
    if (prefs.motion === "static") return;
    const next = prefs.motion === "cinematic" ? 1500 + Math.random() * 2300 : 4200 + Math.random() * 5200;
    meteorTimer = setTimeout(() => {
      createMeteor();
      if (prefs.motion === "cinematic" && Math.random() > .56) setTimeout(() => createMeteor(), 420);
      if (Math.random() > .82) meteorShower();
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

  function openQuickMenu(open) {
    const menu = root?.querySelector("[data-hgc-quick-menu]");
    if (!menu) return;
    menu.hidden = !open;
    if (open) requestAnimationFrame(() => menu.querySelector("section button")?.focus());
  }

  function setTodayPage(page) {
    todayPage = ((Number(page) % 2) + 2) % 2;
    if (!root) return;
    root.dataset.hgcTodayPage = String(todayPage);
    setText("[data-hgc-today-indicator]", `${todayPage + 1}/2`);
  }

  function setMobilePane(pane) {
    if (!root || !["today", "galaxy", "info"].includes(pane)) return;
    mobilePane = pane;
    root.dataset.hgcMobilePane = pane;
    root.querySelectorAll("[data-hgc-mobile-pane-option]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hgcMobilePaneOption === pane)));
  }

  function onClick(event) {
    const settingsOpen = event.target.closest("[data-hgc-settings-open]");
    if (settingsOpen) return openSettings(true);
    if (event.target.closest("[data-hgc-settings-close]")) return openSettings(false);
    const theme = event.target.closest("button[data-hgc-theme]");
    if (theme) { prefs.theme = theme.dataset.hgcTheme; playTone(520); return applyPrefs(); }
    const motion = event.target.closest("button[data-hgc-motion]");
    if (motion) { prefs.motion = motion.dataset.hgcMotion; return applyPrefs(); }
    const view = event.target.closest("[data-hgc-view-option]");
    if (view) {
      prefs.view = view.dataset.hgcViewOption;
      if (prefs.view === "basic") { activeInfoTab = "overview"; prefs.infoTab = "overview"; }
      if (prefs.view === "focus") mobilePane = "galaxy";
      return applyPrefs();
    }
    if (event.target.closest("[data-hgc-motion-cycle]")) {
      const modes = ["static", "balanced", "cinematic"];
      prefs.motion = modes[(modes.indexOf(prefs.motion) + 1) % modes.length];
      return applyPrefs();
    }
    const infoTab = event.target.closest("[data-hgc-info-tab], [data-hgc-info-tab-link]");
    if (infoTab) return setInfoTab(infoTab.dataset.hgcInfoTab || infoTab.dataset.hgcInfoTabLink);
    const infoOpen = event.target.closest("[data-hgc-info-open]");
    if (infoOpen) { setMobilePane("info"); return setInfoTab(infoOpen.dataset.hgcInfoOpen); }
    const mobile = event.target.closest("[data-hgc-mobile-pane-option]");
    if (mobile) return setMobilePane(mobile.dataset.hgcMobilePaneOption);
    const todayStep = event.target.closest("[data-hgc-today-step]");
    if (todayStep) return setTodayPage(todayPage + Number(todayStep.dataset.hgcTodayStep || 0));
    if (event.target.closest("[data-hgc-quick-toggle]")) return openQuickMenu(true);
    if (event.target.closest("[data-hgc-quick-close]")) return openQuickMenu(false);
    const planetStep = event.target.closest("[data-hgc-planet-step]");
    if (planetStep) return stepPlanet(Number(planetStep.dataset.hgcPlanetStep || 0));
    const pinnedPlanet = event.target.closest("[data-hgc-select-planet]");
    if (pinnedPlanet) return selectPlanet(pinnedPlanet.dataset.hgcSelectPlanet, true);
    const planet = event.target.closest("[data-hgc-planet]");
    if (planet) return selectPlanet(planet.dataset.hgcPlanet);
    if (event.target.closest("[data-hgc-pin-planet]")) {
      const alreadyPinned = prefs.pinned.includes(activePlanetId);
      prefs.pinned = alreadyPinned ? prefs.pinned.filter((id) => id !== activePlanetId) : [...prefs.pinned.filter((id) => id !== activePlanetId), activePlanetId].slice(-5);
      notificationComet(alreadyPinned ? "Đã bỏ ghim hành tinh" : "Đã thêm vào quỹ đạo gần");
      return applyPrefs();
    }
    if (event.target.closest("[data-hgc-reset]")) {
      prefs = { ...DEFAULT_PREFS, pinned: [...DEFAULT_PREFS.pinned], planets: [...DEFAULT_PREFS.planets], widgets: [...DEFAULT_PREFS.widgets] };
      activeInfoTab = prefs.infoTab;
      activePlanetId = "home";
      mobilePane = "galaxy";
      writeJson(PREF_KEY, prefs);
      return mount(mountedHome, true);
    }
    const route = event.target.closest("[data-hgc-route]");
    if (route) { openQuickMenu(false); return navigate(route.dataset.hgcRoute); }
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
      prefs.pinned = event.target.checked ? [...prefs.pinned.filter((item) => item !== id), id].slice(-5) : prefs.pinned.filter((item) => item !== id);
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
    pointerSample = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!root || !pointerSample) return;
      pointerBounds ||= root.getBoundingClientRect();
      const x = clamp((pointerSample.x - pointerBounds.left) / pointerBounds.width, 0, 1);
      const y = clamp((pointerSample.y - pointerBounds.top) / Math.min(pointerBounds.height, innerHeight), 0, 1);
      root.style.setProperty("--hgc-pointer-x", `${x * 100}%`);
      root.style.setProperty("--hgc-pointer-y", `${y * 100}%`);
      root.style.setProperty("--hgc-parallax-x", `${(x - .5) * 18}px`);
      root.style.setProperty("--hgc-parallax-y", `${(y - .5) * 14}px`);
    });
  }

  function targetPlanet(planet) {
    const solar = root?.querySelector("[data-hgc-solar]");
    if (!solar || !planet) return;
    const solarRect = solar.getBoundingClientRect();
    const planetRect = planet.getBoundingClientRect();
    const targetX = planetRect.left - solarRect.left + planetRect.width / 2;
    const targetY = planetRect.top - solarRect.top + planetRect.height / 2;
    const centerX = solarRect.width / 2;
    const centerY = solarRect.height / 2;
    const distance = Math.hypot(targetX - centerX, targetY - centerY);
    const angle = Math.atan2(targetY - centerY, targetX - centerX) * 180 / Math.PI;
    solar.style.setProperty("--hgc-beam-length", `${distance}px`);
    solar.style.setProperty("--hgc-beam-angle", `${angle}deg`);
    solar.style.setProperty("--hgc-beam-color", planet.style.getPropertyValue("--planet-color") || "var(--hgc-cyan)");
    solar.classList.add("is-targeting");
  }

  function clearPlanetTarget(event) {
    if (event?.relatedTarget?.closest?.("[data-hgc-planet]")) return;
    root?.querySelector("[data-hgc-solar]")?.classList.remove("is-targeting");
  }

  function bindInteractiveRoot(node) {
    if (!node || boundRoots.has(node)) return;
    boundRoots.add(node);
    const adopt = () => { if (root !== node) { root = node; pointerBounds = null; } };
    node.addEventListener("click", (event) => { adopt(); onClick(event); });
    node.addEventListener("change", (event) => { adopt(); onChange(event); });
    node.addEventListener("input", (event) => { adopt(); onChange(event); });
    node.addEventListener("pointermove", (event) => { adopt(); onPointerMove(event); }, { passive: true });
    node.addEventListener("pointerover", (event) => { adopt(); targetPlanet(event.target.closest("[data-hgc-planet]")); }, { passive: true });
    node.addEventListener("pointerout", (event) => { adopt(); clearPlanetTarget(event); }, { passive: true });
    node.addEventListener("focusin", (event) => { adopt(); targetPlanet(event.target.closest("[data-hgc-planet]")); });
    node.addEventListener("focusout", (event) => { adopt(); clearPlanetTarget(event); });
    node.addEventListener("keydown", (event) => {
      adopt();
      if (event.key === "Escape") { openSettings(false); openQuickMenu(false); }
      if (!event.target.closest("input,textarea,select") && event.target.closest(".hgc-galaxy-panel") && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        stepPlanet(event.key === "ArrowRight" ? 1 : -1);
      }
    });
    node.dataset.hgcBound = "true";
  }

  function bind() {
    bindInteractiveRoot(root);
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
    addEventListener("resize", () => {
      pointerBounds = null;
      if (root) root.dataset.hgcQuality = detectQuality();
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      clearTimeout(meteorTimer);
      if (!document.hidden) scheduleMeteors();
    });
  }

  function observeHome() {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      const host = mountedHome?.querySelector("#homeGalaxyCommandRoot");
      const missionRoot = host?.querySelector?.("[data-hgc-root].hgm-active");
      if (missionRoot?.querySelector("[data-hgm-shell]")) {
        root = missionRoot;
        return;
      }
      if (host?.firstElementChild !== root || !root?.querySelector(".hgc-one-screen")) {
        setTimeout(() => mount(mountedHome, true), 90);
        return;
      }
      if (mutations.some((mutation) => mutation.target.closest?.("[data-hgc-root]"))) return;
      scheduleUpdate();
      const hasNew = mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.(".app-notice--new") || node.querySelector?.(".app-notice--new"))));
      if (hasNew) notificationComet("Có tín hiệu mới trong trung tâm thông báo");
    });
    observer.observe(mountedHome, { subtree: true, childList: true, characterData: true });
  }

  function syncMainState(active = !location.hash || /^#\/home(?:$|[/?])/.test(location.hash)) {
    const main = mountedHome?.closest(".app-main") || document.querySelector(".app-main");
    main?.classList.toggle("hgc-main-active", active);
    document.body.classList.toggle("hgc-home-active", active);
  }

  function mount(home = document.querySelector('[data-shell-view="home"]'), force = false) {
    const routeActive = !location.hash || /^#\/home(?:$|[/?])/.test(location.hash);
    if (!routeActive) { syncMainState(false); return false; }
    const host = home?.querySelector("#homeGalaxyCommandRoot");
    if (!host) return false;
    const missionRoot = host.querySelector("[data-hgc-root].hgm-active");
    if (missionRoot?.querySelector("[data-hgm-shell]")) {
      mountedHome = home;
      root = missionRoot;
      home.classList.add("hgc-active");
      syncMainState(true);
      return true;
    }
    if (!force && mountedHome === home && root?.isConnected) {
      syncMainState(true);
      updateLive();
      window.HHHomeLiveWidgets?.mount?.(root);
      return true;
    }
    clearInterval(refreshTimer);
    mountedHome = home;
    home.classList.add("hgc-active");
    syncMainState(true);
    host.innerHTML = markup();
    root = host.querySelector("[data-hgc-root]");
    pointerBounds = null;
    bind();
    applyPrefs();
    updateLive();
    setTimeout(() => window.HHHomeLiveWidgets?.mount?.(root, true), 0);
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
  addEventListener("hh:asset-group-ready", (event) => {
    if (event.detail?.group === "home-enhancements") setTimeout(() => mount(undefined, true), 140);
  });
  addEventListener("hashchange", () => {
    const active = !location.hash || /^#\/home(?:$|[/?])/.test(location.hash);
    syncMainState(active);
    if (active) scheduleMount();
  });
  addEventListener("storage", (event) => {
    if (event.key === PREF_KEY) { prefs = readPrefs(); activeInfoTab = prefs.infoTab; applyPrefs(); }
    scheduleUpdate();
  });

  window.HHHomeGalaxyCommand = Object.freeze({
    version: 4,
    mount,
    refresh: updateLive,
    preferences: () => ({ ...prefs, pinned: [...prefs.pinned], planets: [...prefs.planets], widgets: [...prefs.widgets] })
  });
})();
