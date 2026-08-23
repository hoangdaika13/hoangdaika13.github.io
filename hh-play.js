(function () {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_KEY = "hh.play.profile.v1";
  const DAY_KEY = () => new Date().toISOString().slice(0, 10);

  const VIEWS = [
    { id: "today", icon: "✦", title: "Hôm nay", note: "Nhiệm vụ và chơi nhanh", color: "#ffd86b" },
    { id: "arcade", icon: "▣", title: "Arcade Galaxy", note: "Trò chơi dùng được ngay", color: "#63eaff" },
    { id: "party", icon: "◎", title: "Party Room", note: "Phòng riêng và quyền truy cập", color: "#ff68c7" },
    { id: "watch", icon: "▶", title: "Watch Party", note: "Hàng đợi video có nguồn", color: "#ff6578" },
    { id: "story", icon: "⌁", title: "Story Universe", note: "Truyện lựa chọn nhiều nhánh", color: "#aa82ff" },
    { id: "escape", icon: "⌾", title: "Escape Room", note: "Mật mã và gợi ý ba cấp", color: "#ffb45f" },
    { id: "rhythm", icon: "♫", title: "Rhythm Arena", note: "Bắt nhịp với Web Audio", color: "#ff62d1" },
    { id: "pet", icon: "◇", title: "HH Virtual Pet", note: "Chăm sóc không gây áp lực", color: "#70f0b0" },
    { id: "chill", icon: "☂", title: "Chill Rooms", note: "Âm cảnh và Pomodoro", color: "#67b7ff" },
    { id: "quiz", icon: "?", title: "Quiz Arena", note: "Đố vui có giải thích", color: "#ffe05e" }
  ];

  const ARCADE_GAMES = [
    { id: "snake", icon: "S", title: "Neon Snake", type: "canvas", desc: "Thu thập tinh thể và tránh chạm thân." },
    { id: "dodge", icon: "A", title: "Asteroid Dodge", type: "canvas", desc: "Lái phi thuyền né mưa thiên thạch." },
    { id: "breaker", icon: "B", title: "Light Breaker", type: "canvas", desc: "Phá tường ánh sáng bằng phản xạ." },
    { id: "shooter", icon: "↟", title: "Star Shooter", type: "canvas", desc: "Bảo vệ cổng sao trước từng wave." },
    { id: "memory", icon: "M", title: "Memory Constellation", type: "dom", desc: "Ghép các cặp chòm sao giống nhau." },
    { id: "reaction", icon: "R", title: "Reaction Pulse", type: "dom", desc: "Đo phản xạ sau tín hiệu an toàn." },
    { id: "elements", icon: "4", title: "Element 2048", type: "dom", desc: "Hợp nhất nguyên tố để tạo lõi 2048." },
    { id: "sudoku", icon: "9", title: "Solar Sudoku", type: "dom", desc: "Hoàn thành bảng số 4 × 4 ngắn gọn." },
    { id: "word", icon: "W", title: "Word Orbit", type: "dom", desc: "Sắp chữ thành từ đúng theo gợi ý." },
    { id: "tower", icon: "T", title: "Tower Tactics", type: "dom", desc: "Phân phối năng lượng để giữ ba tuyến." }
  ];

  const QUIZ = [
    { q: "Hành tinh nào được gọi là Hành tinh Đỏ?", choices: ["Sao Kim", "Sao Hỏa", "Sao Thủy"], answer: 1, why: "Ôxít sắt trên bề mặt làm Sao Hỏa có màu đỏ đặc trưng." },
    { q: "Âm thanh truyền nhanh nhất trong môi trường nào?", choices: ["Chất rắn", "Không khí", "Chân không"], answer: 0, why: "Các hạt trong chất rắn liên kết gần nhau nên truyền dao động nhanh hơn." },
    { q: "CSS chủ yếu dùng để làm gì?", choices: ["Lưu mật khẩu", "Tạo kiểu giao diện", "Nén video"], answer: 1, why: "CSS mô tả cách trình bày và bố cục của tài liệu web." },
    { q: "Nhạc ở 120 BPM có bao nhiêu nhịp mỗi phút?", choices: ["60", "100", "120"], answer: 2, why: "BPM là viết tắt của beats per minute – số nhịp trong một phút." },
    { q: "Thủ đô của Việt Nam là thành phố nào?", choices: ["Hà Nội", "Huế", "Đà Nẵng"], answer: 0, why: "Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam." },
    { q: "Cổng nào thường dùng cho website HTTPS?", choices: ["21", "80", "443"], answer: 2, why: "HTTPS theo mặc định sử dụng cổng TCP 443." },
    { q: "Thiên thể nào quay quanh Trái Đất?", choices: ["Mặt Trăng", "Sao Mộc", "Mặt Trời"], answer: 0, why: "Mặt Trăng là vệ tinh tự nhiên của Trái Đất." },
    { q: "Phím nào thường dùng để tạm dừng trò chơi?", choices: ["Escape", "Caps Lock", "Print Screen"], answer: 0, why: "Escape thường được trò chơi dùng để mở menu tạm dừng." }
  ];

  const STORY = {
    intro: { title: "Ga cuối của Ánh Sao", text: "Bạn tỉnh dậy trên một đoàn tàu đang dừng giữa khoảng không. Trước mặt là hai toa còn phát sáng.", choices: [["Vào toa lưu trữ", "archive"], ["Đi tới buồng lái", "cockpit"]] },
    archive: { title: "Kho ký ức", text: "Một bản đồ cũ cho thấy đoàn tàu chỉ có đủ năng lượng để mở một trong hai cổng dịch chuyển.", choices: [["Mang bản đồ tới buồng lái", "map"], ["Tìm nguồn điện dự phòng", "battery"]] },
    cockpit: { title: "Buồng lái im lặng", text: "Máy điều hướng yêu cầu một tọa độ. Bạn có thể tin vào tín hiệu lạ hoặc quay lại tìm bản đồ.", choices: [["Theo tín hiệu lạ", "signal"], ["Quay lại kho lưu trữ", "archive"]] },
    map: { title: "Tọa độ quê nhà", text: "Bản đồ và máy lái khớp nhau. Cánh cổng xanh mở ra con đường trở về Trái Đất.", end: "Kết thúc: Người tìm đường" },
    battery: { title: "Khu vườn ngủ quên", text: "Nguồn điện dự phòng đánh thức một khu vườn sinh học. Bạn chọn ở lại để gìn giữ sự sống cuối cùng trên tàu.", end: "Kết thúc: Người giữ mầm xanh" },
    signal: { title: "Lời chào từ xa", text: "Tín hiệu dẫn tới một trạm cứu hộ. Những người sống sót khác đã chờ bạn từ rất lâu.", end: "Kết thúc bí mật: Cuộc hội ngộ" }
  };

  const ESCAPE_STAGES = [
    { title: "Khóa quỹ đạo", clue: "Dãy số: 2 · 4 · 8 · 16 · ?", answer: "32", hints: ["Mỗi số liên quan trực tiếp đến số trước.", "Mỗi bước nhân đôi.", "16 × 2 = 32."] },
    { title: "Bảng chữ đảo", clue: "Sắp xếp lại: A S O", answer: "SAO", hints: ["Đó là vật thể phát sáng trên trời.", "Từ có ba chữ cái và bắt đầu bằng S.", "Đáp án là SAO."] },
    { title: "Mã màu", clue: "Cyan + Magenta trong hệ màu ánh sáng gần với màu nào: XANH / TIM / VANG?", answer: "TIM", hints: ["Đây không phải hệ màu sơn truyền thống.", "Cyan và magenta cùng chia sẻ thành phần xanh lam.", "Nhập TIM, không cần dấu."] }
  ];

  const WORDS = [
    { word: "HANHTINH", clue: "Một thiên thể quay quanh ngôi sao" },
    { word: "AMNHAC", clue: "Nghệ thuật tổ chức âm thanh" },
    { word: "SANGTAO", clue: "Tạo ra điều mới mẻ" },
    { word: "PHANXA", clue: "Khả năng đáp lại tín hiệu nhanh" }
  ];

  let host = null;
  let root = null;
  let options = {};
  let state = null;
  let noticeTimer = 0;
  let arcade = null;
  let rhythm = null;
  let audio = null;
  let pomodoroTimer = 0;
  let pomodoroRemaining = 0;
  let memoryState = null;
  let reactionTimer = 0;
  let reactionState = { phase: "idle", startedAt: 0, best: 0 };
  let elementBoard = [];
  let towerState = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clean = (value, max = 100) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const randomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

  function defaultState() {
    return {
      schema: STORAGE_KEY,
      version: VERSION,
      view: "today",
      xp: 0,
      streak: 1,
      lastVisit: DAY_KEY(),
      sessions: 0,
      scores: {},
      favorites: ["snake", "memory"],
      recent: [],
      daily: { day: DAY_KEY(), played: 0, quiz: 0, social: 0, claimed: false },
      party: { rooms: [], activeCode: "", mode: "local-only" },
      watch: { queue: [], current: "" },
      story: { node: "intro", history: [], slots: [null, null, null] },
      escape: { stage: 0, hints: 0, completed: false },
      pet: { type: "dragon", name: "Lumi", hunger: 76, happy: 72, energy: 84, xp: 0, level: 1, lastCare: Date.now() },
      chill: { scene: "rain", rain: 55, wind: 20, fire: 0, piano: 0, minutes: 25 },
      quiz: { index: 0, score: 0, answered: false, selected: -1, completed: false },
      settings: { motion: "balanced", sound: true, inspector: true, safeChat: true }
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return base;
      const merged = {
        ...base, ...saved,
        scores: { ...base.scores, ...(saved.scores || {}) },
        daily: { ...base.daily, ...(saved.daily || {}) },
        party: { ...base.party, ...(saved.party || {}) },
        watch: { ...base.watch, ...(saved.watch || {}) },
        story: { ...base.story, ...(saved.story || {}) },
        escape: { ...base.escape, ...(saved.escape || {}) },
        pet: { ...base.pet, ...(saved.pet || {}) },
        chill: { ...base.chill, ...(saved.chill || {}) },
        quiz: { ...base.quiz, ...(saved.quiz || {}) },
        settings: { ...base.settings, ...(saved.settings || {}) }
      };
      if (!VIEWS.some((view) => view.id === merged.view)) merged.view = "today";
      if (merged.daily.day !== DAY_KEY()) merged.daily = { day: DAY_KEY(), played: 0, quiz: 0, social: 0, claimed: false };
      merged.party.rooms = (Array.isArray(merged.party.rooms) ? merged.party.rooms : []).slice(0, 12).map((room) => ({
        code: String(room?.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
        name: clean(room?.name || "Phòng HH Play", 48),
        privacy: ["invite", "private", "public-draft"].includes(room?.privacy) ? room.privacy : "invite",
        limit: clamp(room?.limit, 2, 8),
        permissions: { chat: room?.permissions?.chat === true, control: room?.permissions?.control === true, spectate: room?.permissions?.spectate === true },
        createdAt: Number.isFinite(Number(room?.createdAt)) ? Number(room.createdAt) : Date.now(),
        provider: "local-device"
      })).filter((room) => room.code.length === 6);
      merged.watch.queue = (Array.isArray(merged.watch.queue) ? merged.watch.queue : []).slice(0, 24).map((item) => ({ id: /^[A-Za-z0-9_-]{11}$/.test(item?.id || "") ? item.id : "", title: clean(item?.title, 80), addedAt: Number(item?.addedAt) || Date.now(), source: "youtube-nocookie" })).filter((item) => item.id);
      merged.watch.current = /^[A-Za-z0-9_-]{11}$/.test(merged.watch.current || "") ? merged.watch.current : "";
      merged.story.node = STORY[merged.story.node] ? merged.story.node : "intro";
      merged.story.history = (Array.isArray(merged.story.history) ? merged.story.history : []).filter((id) => STORY[id]).slice(-20);
      merged.pet.name = clean(merged.pet.name || "Lumi", 20);
      merged.chill.scene = ["rain", "cafe", "forest", "fire", "ocean"].includes(merged.chill.scene) ? merged.chill.scene : "rain";
      merged.story.slots = Array.isArray(merged.story.slots) ? merged.story.slots.slice(0, 3) : [null, null, null];
      while (merged.story.slots.length < 3) merged.story.slots.push(null);
      return merged;
    } catch {
      return base;
    }
  }

  function save() {
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function viewMeta(id = state?.view) {
    return VIEWS.find((item) => item.id === id) || VIEWS[0];
  }

  function missionProgress() {
    const completed = Number(state.daily.played >= 1) + Number(state.daily.quiz >= 1) + Number(state.daily.social >= 1);
    return { completed, percent: Math.round(completed / 3 * 100) };
  }

  function setView(next, updateHash = true) {
    if (!VIEWS.some((item) => item.id === next)) next = "today";
    cleanupRuntime();
    state.view = next;
    save();
    if (updateHash && location.hash !== `#/play/${next}`) history.replaceState({}, document.title, `${location.pathname}${location.search}#/play/${next}`);
    render();
  }

  function render() {
    if (!host || !state) return;
    const meta = viewMeta();
    root = document.createElement("section");
    root.className = "hh-play";
    root.dataset.view = state.view;
    root.dataset.motion = state.settings.motion;
    root.style.setProperty("--hhp-view", meta.color);
    root.innerHTML = `
      <div class="hhp-ambient" aria-hidden="true">${Array.from({ length: 14 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}<b></b><em></em></div>
      ${topbar(meta)}
      <div class="hhp-grid">
        ${sidebar()}
        <main class="hhp-stage" aria-live="polite"><div class="hhp-stage-scroll">${renderView()}</div></main>
        ${inspector(meta)}
      </div>
      ${actionbar(meta)}
      ${mobileNav()}
      <div class="hhp-toast" role="status" aria-live="polite" hidden></div>`;
    host.replaceChildren(root);
    bind();
    activateViewRuntime();
  }

  function topbar(meta) {
    const progress = missionProgress();
    return `<header class="hhp-topbar">
      <button class="hhp-brand" type="button" data-play-view="today" aria-label="Về HH Play hôm nay"><i>HP</i><span><small>ENTERTAINMENT OS</small><strong>HH Play</strong></span></button>
      <label class="hhp-search"><span>⌕</span><input type="search" data-play-search placeholder="Tìm trò chơi, phòng hoặc trải nghiệm…" autocomplete="off"><kbd>Ctrl K</kbd></label>
      <div class="hhp-top-actions">
        <button type="button" data-play-view="today"><i>${progress.completed}/3</i><span>Nhiệm vụ ngày</span></button>
        <button type="button" data-play-inspector-toggle aria-pressed="${state.settings.inspector}"><i>◎</i><span>Tóm tắt</span></button>
        <div class="hhp-profile"><i>${esc(initials())}</i><span><small>Cấp ${level()}</small><strong>${state.xp} XP</strong></span></div>
      </div>
    </header>`;
  }

  function sidebar() {
    return `<aside class="hhp-sidebar" aria-label="Danh mục HH Play"><header><span>KHÁM PHÁ</span><small>10 trải nghiệm</small></header><nav>${VIEWS.map((item) => `<button type="button" data-play-view="${item.id}" class="${item.id === state.view ? "is-active" : ""}" style="--item:${item.color}"><i>${item.icon}</i><span><strong>${item.title}</strong><small>${item.note}</small></span><b>›</b></button>`).join("")}</nav><footer><span>● Local-first</span><small>Không giả người online</small></footer></aside>`;
  }

  function inspector(meta) {
    const progress = missionProgress();
    const best = Object.values(state.scores).reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    return `<aside class="hhp-inspector ${state.settings.inspector ? "is-open" : ""}" aria-label="Tóm tắt HH Play"><header><span>TÓM TẮT</span><button type="button" data-play-inspector-toggle aria-label="Đóng tóm tắt">×</button></header><section class="hhp-now"><i style="--now:${meta.color}">${meta.icon}</i><div><small>Đang mở</small><strong>${meta.title}</strong><span>${meta.note}</span></div></section><div class="hhp-stat-grid"><article><small>Cấp</small><strong>${level()}</strong></article><article><small>XP</small><strong>${state.xp}</strong></article><article><small>Kỷ lục</small><strong>${best}</strong></article><article><small>Chuỗi</small><strong>${state.streak} ngày</strong></article></div><section class="hhp-mission-mini"><header><strong>Nhiệm vụ hôm nay</strong><span>${progress.percent}%</span></header><div><i style="width:${progress.percent}%"></i></div><ul><li class="${state.daily.played ? "is-done" : ""}">Chơi một trò</li><li class="${state.daily.quiz ? "is-done" : ""}">Trả lời Quiz</li><li class="${state.daily.social ? "is-done" : ""}">Tạo phòng local</li></ul></section><section class="hhp-trust"><strong>Riêng tư mặc định</strong><p>Điểm, pet, phòng nháp và hàng đợi chỉ lưu trên thiết bị này. Không công khai hồ sơ nếu bạn chưa chủ động chia sẻ.</p></section></aside>`;
  }

  function actionbar(meta) {
    const primary = ({ today: ["arcade", "Chơi ngay"], arcade: ["arcade-start", "Bắt đầu"], party: ["party-focus", "Tạo phòng"], watch: ["watch-focus", "Thêm video"], story: ["story-reset", "Chơi lại truyện"], escape: ["escape-focus", "Nhập mật mã"], rhythm: ["rhythm-start", "Bắt đầu nhịp"], pet: ["pet-play", "Chơi với pet"], chill: ["chill-toggle", "Bật âm cảnh"], quiz: ["quiz-next", "Câu tiếp theo"] })[state.view] || ["today", "Về Hôm nay"];
    return `<footer class="hhp-actionbar"><div><button type="button" data-play-action="exit">⌂ <span>Thoát</span></button><button type="button" data-play-action="invite">↗ <span>Mời bạn</span></button><button type="button" data-play-action="settings">⚙ <span>Cài đặt</span></button><button type="button" data-play-action="fullscreen">⛶ <span>Toàn màn hình</span></button><button type="button" data-play-action="restart">↻ <span>Chơi lại</span></button></div><span><i style="background:${meta.color}"></i>${meta.title}</span><button class="hhp-primary" type="button" data-play-action="${primary[0]}">${primary[1]} →</button></footer>`;
  }

  function mobileNav() {
    const items = [VIEWS[0], VIEWS[1], VIEWS[2], VIEWS[8]];
    return `<nav class="hhp-mobile-nav">${items.map((item) => `<button type="button" data-play-view="${item.id}" class="${item.id === state.view ? "is-active" : ""}"><i>${item.icon}</i><span>${item.title.split(" ")[0]}</span></button>`).join("")}<button type="button" data-play-mobile-more><i>•••</i><span>Thêm</span></button></nav>`;
  }

  function renderView() {
    if (state.view === "today") return todayView();
    if (state.view === "arcade") return arcadeView();
    if (state.view === "party") return partyView();
    if (state.view === "watch") return watchView();
    if (state.view === "story") return storyView();
    if (state.view === "escape") return escapeView();
    if (state.view === "rhythm") return rhythmView();
    if (state.view === "pet") return petView();
    if (state.view === "chill") return chillView();
    return quizView();
  }

  function heading(kicker, title, text, badge = "") {
    return `<header class="hhp-view-head"><div><span>${kicker}</span><h2>${title}</h2><p>${text}</p></div>${badge ? `<b>${badge}</b>` : ""}</header>`;
  }

  function todayView() {
    const progress = missionProgress();
    const recent = state.recent.map((id) => ARCADE_GAMES.find((game) => game.id === id)).filter(Boolean).slice(0, 4);
    return `<section class="hhp-view hhp-today">${heading("DAILY ENTERTAINMENT", "Một điểm bắt đầu, nhiều cách để vui", "Chọn nhiệm vụ ngắn phù hợp hoặc tiếp tục trải nghiệm gần nhất.", `${state.streak} ngày`) }
      <article class="hhp-hero-card"><div class="hhp-hero-orbit" aria-hidden="true"><i></i><i></i><i></i><b>PLAY</b></div><div><small>GỢI Ý TIẾP THEO · 3–5 PHÚT</small><h3>${state.daily.played ? "Thử một nhánh truyện mới" : "Neon Snake đang chờ bạn"}</h3><p>${state.daily.played ? "Mỗi lựa chọn được lưu trên thiết bị và có thể quay lại bằng ba ô lưu riêng." : "Điều khiển bằng phím mũi tên hoặc nút cảm ứng; không cần tải thêm tài nguyên."}</p><button type="button" data-play-view="${state.daily.played ? "story" : "arcade"}">${state.daily.played ? "Mở Story Universe" : "Chơi ngay"} →</button></div></article>
      <div class="hhp-daily-grid"><article><header><i>▣</i><span><strong>Chơi một trò</strong><small>Arcade hoặc Rhythm</small></span><b>${state.daily.played ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.played ? 100 : 0}%"></i></div></article><article><header><i>?</i><span><strong>Trả lời Quiz</strong><small>Một câu có giải thích</small></span><b>${state.daily.quiz ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.quiz ? 100 : 0}%"></i></div></article><article><header><i>◎</i><span><strong>Tạo phòng local</strong><small>Chuẩn bị quyền trước khi chia sẻ</small></span><b>${state.daily.social ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.social ? 100 : 0}%"></i></div></article></div>
      <div class="hhp-section-title"><div><span>TIẾN ĐỘ HÔM NAY</span><strong>${progress.completed}/3 hoàn thành</strong></div><div class="hhp-progress"><i style="width:${progress.percent}%"></i></div>${progress.completed === 3 ? `<button type="button" data-play-claim ${state.daily.claimed ? "disabled" : ""}>${state.daily.claimed ? "Đã nhận huy hiệu" : "Nhận huy hiệu ngày"}</button>` : ""}</div>
      <section class="hhp-quick-grid">${(recent.length ? recent : ARCADE_GAMES.slice(0, 4)).map((game, index) => `<button type="button" data-game="${game.id}" style="--game:${["#63eaff", "#ff68c7", "#aa82ff", "#70f0b0"][index]}"><i>${game.icon}</i><span><strong>${game.title}</strong><small>${game.desc}</small></span><b>${state.scores[game.id] || 0}</b></button>`).join("")}</section>
    </section>`;
  }

  function arcadeView() {
    const selected = ARCADE_GAMES.find((game) => game.id === state.arcadeGame) || ARCADE_GAMES[0];
    state.arcadeGame = selected.id;
    return `<section class="hhp-view hhp-arcade">${heading("ARCADE GALAXY", "10 thử thách có luật chơi riêng", "Điểm và kỷ lục được lưu cục bộ. Trò đang chạy tự tạm dừng khi tab bị ẩn.", `${ARCADE_GAMES.length} trò`) }
      <div class="hhp-game-filmstrip">${ARCADE_GAMES.map((game) => `<button type="button" data-game="${game.id}" class="${game.id === selected.id ? "is-active" : ""}"><i>${game.icon}</i><span><strong>${game.title}</strong><small>Kỷ lục ${state.scores[game.id] || 0}</small></span></button>`).join("")}</div>
      <article class="hhp-game-cockpit"><header><div><small>${selected.type === "canvas" ? "CANVAS ARCADE" : "QUICK CHALLENGE"}</small><h3>${selected.title}</h3><p>${selected.desc}</p></div><nav><button type="button" data-arcade-pause>Tạm dừng</button><button type="button" data-arcade-reset>Đặt lại</button></nav></header><div class="hhp-game-stage" data-arcade-stage>${arcadeStage(selected)}</div><footer><span>Điểm <strong data-arcade-score>0</strong></span><span>Kỷ lục <strong>${state.scores[selected.id] || 0}</strong></span><span data-arcade-status>Sẵn sàng</span><div class="hhp-touch-controls"><button data-play-key="left">←</button><button data-play-key="action">●</button><button data-play-key="right">→</button></div></footer></article>
    </section>`;
  }

  function arcadeStage(game) {
    if (game.type === "canvas") return `<canvas width="720" height="400" data-arcade-canvas aria-label="${esc(game.title)}"></canvas><div class="hhp-game-overlay"><strong>${game.title}</strong><p>${game.desc}</p><button type="button" data-arcade-start>Bắt đầu</button></div>`;
    if (game.id === "memory") return `<div class="hhp-memory" data-memory-board></div>`;
    if (game.id === "reaction") return `<button class="hhp-reaction" type="button" data-reaction-pad><strong>Nhấn để chuẩn bị</strong><span>Chờ tín hiệu đổi màu rồi nhấn nhanh nhất</span></button>`;
    if (game.id === "elements") return `<div class="hhp-elements" data-elements-board></div><div class="hhp-game-inline-actions"><button type="button" data-element-move="left">←</button><button type="button" data-element-move="up">↑</button><button type="button" data-element-move="down">↓</button><button type="button" data-element-move="right">→</button></div>`;
    if (game.id === "sudoku") return sudokuMarkup();
    if (game.id === "word") return wordMarkup();
    return towerMarkup();
  }

  function partyView() {
    const rooms = state.party.rooms;
    const active = rooms.find((room) => room.code === state.party.activeCode);
    return `<section class="hhp-view hhp-party">${heading("PARTY ROOM", "Tạo phòng với quyền riêng tư rõ ràng", "Bản này chuẩn bị phòng và mã mời trên thiết bị. Chỉ báo online sau khi có máy chủ realtime xác nhận.", "LOCAL-FIRST")}
      <div class="hhp-split"><form class="hhp-panel hhp-party-form" data-party-form><header><i>◎</i><div><h3>Tạo phòng mới</h3><p>Không có thành viên giả hoặc phòng công khai giả.</p></div></header><label><span>Tên phòng</span><input name="name" maxlength="48" required placeholder="Ví dụ: Tối nay chơi Quiz"></label><div class="hhp-form-row"><label><span>Quyền xem</span><select name="privacy"><option value="invite">Chỉ người có mã</option><option value="private">Chỉ mình tôi</option><option value="public-draft">Công khai sau khi kết nối server</option></select></label><label><span>Số người tối đa</span><select name="limit"><option>2</option><option>4</option><option>6</option><option>8</option></select></label></div><fieldset><legend>Quyền thành viên</legend><label><input name="chat" type="checkbox" checked> Chat</label><label><input name="control" type="checkbox"> Điều khiển nội dung</label><label><input name="spectate" type="checkbox" checked> Người xem</label></fieldset><button class="hhp-submit" type="submit">Tạo mã phòng →</button></form>
      <section class="hhp-panel hhp-room-console"><header><div><small>PHÒNG ĐANG CHỌN</small><h3>${active ? esc(active.name) : "Chưa tạo phòng"}</h3></div>${active ? `<button type="button" data-party-copy="${active.code}">Sao chép mã</button>` : ""}</header>${active ? `<div class="hhp-room-code"><span>MÃ MỜI</span><strong>${active.code}</strong><small>${privacyLabel(active.privacy)} · tối đa ${active.limit} người</small></div><ul class="hhp-room-permissions"><li><span>Chat</span><b>${active.permissions.chat ? "Cho phép" : "Tắt"}</b></li><li><span>Điều khiển</span><b>${active.permissions.control ? "Cho phép" : "Chủ phòng"}</b></li><li><span>Người xem</span><b>${active.permissions.spectate ? "Cho phép" : "Tắt"}</b></li><li><span>Realtime</span><b class="is-local">Chưa kết nối</b></li></ul><div class="hhp-room-actions"><button type="button" data-route-link="/communication/live-room">Mở Live Room</button><button type="button" data-party-delete="${active.code}">Xóa phòng</button></div>` : `<div class="hhp-empty"><i>◎</i><strong>Chưa có phòng cục bộ</strong><p>Tạo phòng để kiểm tra quyền và nhận mã mời. Kết nối thật cần signaling server được xác thực.</p></div>`}</section></div>
      <section class="hhp-room-list"><header><strong>Phòng trên thiết bị này</strong><span>${rooms.length}/12</span></header>${rooms.length ? rooms.map((room) => `<button type="button" data-party-select="${room.code}" class="${room.code === state.party.activeCode ? "is-active" : ""}"><i>${room.code.slice(0, 2)}</i><span><strong>${esc(room.name)}</strong><small>${privacyLabel(room.privacy)} · ${new Date(room.createdAt).toLocaleString("vi-VN")}</small></span><b>${room.code}</b></button>`).join("") : `<p>Chưa có dữ liệu phòng.</p>`}</section>
    </section>`;
  }

  function watchView() {
    const current = state.watch.queue.find((item) => item.id === state.watch.current) || state.watch.queue[0];
    return `<section class="hhp-view hhp-watch">${heading("WATCH PARTY", "Hàng đợi xem chung minh bạch nguồn", "Chỉ nhúng video YouTube bằng youtube-nocookie.com; HH Play không tải lại hoặc lưu bản sao video.", "PRIVACY MODE")}
      <form class="hhp-watch-form" data-watch-form><label><span>URL YouTube</span><input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…"></label><label><span>Tên hiển thị</span><input name="title" maxlength="80" placeholder="Tự lấy Video ID nếu để trống"></label><button type="submit">Thêm vào hàng đợi</button></form>
      <div class="hhp-watch-layout"><article class="hhp-player">${current ? `<div class="hhp-embed"><iframe src="https://www.youtube-nocookie.com/embed/${current.id}?rel=0" title="${esc(current.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><header><div><small>ĐANG PHÁT CỤC BỘ</small><h3>${esc(current.title)}</h3><p>Video ID: ${current.id}</p></div><button type="button" data-route-link="/youtube">Mở YouTube Center</button></header>` : `<div class="hhp-empty hhp-empty--player"><i>▶</i><strong>Chưa có video</strong><p>Dán liên kết YouTube hợp lệ để tạo hàng đợi.</p></div>`}</article><aside class="hhp-queue"><header><strong>Hàng đợi</strong><span>${state.watch.queue.length}</span></header>${state.watch.queue.length ? state.watch.queue.map((item, index) => `<article class="${item.id === current?.id ? "is-active" : ""}"><button type="button" data-watch-select="${item.id}"><i>${index + 1}</i><span><strong>${esc(item.title)}</strong><small>${item.id}</small></span></button><button type="button" data-watch-remove="${item.id}" aria-label="Xóa">×</button></article>`).join("") : `<p>Hàng đợi trống.</p>`}</aside></div>
      <div class="hhp-sync-note"><i>i</i><p><strong>Đồng bộ phòng chưa bật.</strong> Trạng thái phát hiện chỉ ở thiết bị này. Khi backend realtime được cấu hình, phòng phải xác thực chủ phòng và quyền điều khiển trước khi đồng bộ.</p></div>
    </section>`;
  }

  function storyView() {
    const node = STORY[state.story.node] || STORY.intro;
    return `<section class="hhp-view hhp-story">${heading("INTERACTIVE STORY", "Mỗi lựa chọn mở một nhánh khác", "Ba ô lưu giữ nguyên đường đi trên thiết bị; không cần tài khoản.", `${state.story.history.length + 1} cảnh`)}
      <div class="hhp-story-layout"><article class="hhp-story-book"><div class="hhp-book-spine"></div><header><span>CHƯƠNG ${state.story.history.length + 1}</span><h3>${node.title}</h3></header><p>${node.text}</p>${node.end ? `<div class="hhp-story-end"><i>✦</i><strong>${node.end}</strong><button type="button" data-story-reset>Đọc lại từ đầu</button></div>` : `<div class="hhp-story-choices">${node.choices.map(([label, next], index) => `<button type="button" data-story-choice="${next}"><i>${index + 1}</i><span>${label}</span><b>→</b></button>`).join("")}</div>`}</article><aside class="hhp-story-map"><header><strong>Bản đồ nhánh</strong><span>Local</span></header><div class="hhp-branch-map">${[...state.story.history, state.story.node].map((id, index) => `<span><i>${index + 1}</i><b>${esc(STORY[id]?.title || id)}</b></span>`).join("")}</div><section><strong>Ô lưu</strong>${state.story.slots.map((slot, index) => `<article><span><b>Ô ${index + 1}</b><small>${slot ? esc(STORY[slot.node]?.title || slot.node) : "Trống"}</small></span><div><button type="button" data-story-save="${index}">Lưu</button>${slot ? `<button type="button" data-story-load="${index}">Mở</button>` : ""}</div></article>`).join("")}</section></aside></div>
    </section>`;
  }

  function escapeView() {
    const current = ESCAPE_STAGES[state.escape.stage] || ESCAPE_STAGES.at(-1);
    return `<section class="hhp-view hhp-escape">${heading("ESCAPE ROOM", state.escape.completed ? "Cổng đã được mở" : current.title, "Giải lần lượt ba khóa. Gợi ý tăng dần và không làm mất tiến trình.", `${Math.min(state.escape.stage, 3)}/3 khóa`)}
      <div class="hhp-escape-room"><div class="hhp-lock-visual ${state.escape.completed ? "is-open" : ""}" aria-hidden="true"><i></i><b>${state.escape.completed ? "✓" : state.escape.stage + 1}</b><span></span></div><article>${state.escape.completed ? `<small>ESCAPE COMPLETE</small><h3>Bạn đã mở Cổng Bình Minh</h3><p>Ba mảnh khóa đã khớp. Thành tích được lưu cục bộ trên thiết bị.</p><button type="button" data-escape-reset>Chơi lại phòng</button>` : `<small>MẢNH KHÓA ${state.escape.stage + 1}</small><h3>${current.clue}</h3><form data-escape-form><label><span>Câu trả lời</span><input name="answer" maxlength="30" autocomplete="off" required placeholder="Nhập đáp án…"></label><button type="submit">Xác nhận</button></form><div class="hhp-hint-box"><header><strong>Gợi ý ${state.escape.hints}/3</strong><button type="button" data-escape-hint ${state.escape.hints >= 3 ? "disabled" : ""}>Mở gợi ý</button></header>${state.escape.hints ? `<ol>${current.hints.slice(0, state.escape.hints).map((hint) => `<li>${hint}</li>`).join("")}</ol>` : `<p>Hãy thử tự giải trước. Gợi ý không trừ điểm.</p>`}</div>`}</article></div>
      <div class="hhp-lock-progress">${ESCAPE_STAGES.map((stage, index) => `<span class="${index < state.escape.stage || state.escape.completed ? "is-done" : index === state.escape.stage ? "is-active" : ""}"><i>${index < state.escape.stage || state.escape.completed ? "✓" : index + 1}</i><b>${stage.title}</b></span>`).join("")}</div>
    </section>`;
  }

  function rhythmView() {
    return `<section class="hhp-view hhp-rhythm">${heading("RHYTHM ARENA", "Bắt nhịp bằng âm thanh tạo cục bộ", "Nhấn Space hoặc nút TAP sát nhịp phát sáng. Âm thanh chỉ bắt đầu sau thao tác của bạn.", `Best ${state.scores.rhythm || 0}`)}
      <article class="hhp-rhythm-stage"><div class="hhp-rhythm-orbit" data-rhythm-orbit aria-hidden="true"><i></i><i></i><i></i><b>♫</b></div><div class="hhp-rhythm-score"><span data-rhythm-label>Sẵn sàng</span><strong data-rhythm-score>0</strong><small>điểm nhịp</small></div><div class="hhp-beat-track" data-rhythm-track>${Array.from({ length: 12 }, (_, index) => `<i style="--beat:${index}"></i>`).join("")}</div><button class="hhp-tap" type="button" data-rhythm-tap>TAP</button><footer><span>Space / chạm</span><span>100 BPM</span><span>12 nhịp</span></footer></article>
      <div class="hhp-rhythm-guide"><article><i>1</i><span><strong>Nghe nhịp mẫu</strong><small>Click phát bằng Web Audio</small></span></article><article><i>2</i><span><strong>Nhấn đúng thời điểm</strong><small>Perfect · Good · Miss</small></span></article><article><i>3</i><span><strong>Xem độ chính xác</strong><small>Không ghi microphone</small></span></article></div>
    </section>`;
  }

  function petView() {
    const pet = state.pet;
    const evolution = pet.level >= 5 ? "Tinh linh trưởng thành" : pet.level >= 3 ? "Tinh linh sao" : "Rồng ánh sáng nhỏ";
    return `<section class="hhp-view hhp-pet">${heading("HH VIRTUAL PET", `${pet.name} · Cấp ${pet.level}`, "Pet không mất hoặc bị phạt nặng khi bạn nghỉ. Mọi chỉ số chỉ lưu trên thiết bị.", evolution)}
      <div class="hhp-pet-layout"><article class="hhp-pet-room"><div class="hhp-pet-aurora" aria-hidden="true"></div><div class="hhp-pet-creature" data-pet-creature><i></i><b>◇</b><span></span></div><div class="hhp-pet-bubble">${pet.hunger < 35 ? "Mình hơi đói…" : pet.energy < 30 ? "Mình muốn nghỉ một chút." : pet.happy > 85 ? "Hôm nay thật tuyệt!" : "Chơi cùng mình nhé!"}</div><footer><button type="button" data-pet="feed">🍎 <span>Cho ăn</span></button><button type="button" data-pet="play">✦ <span>Chơi</span></button><button type="button" data-pet="train">⌁ <span>Huấn luyện</span></button><button type="button" data-pet="rest">☾ <span>Nghỉ</span></button></footer></article><aside class="hhp-pet-panel"><header><div><small>HỒ SƠ PET</small><h3>${pet.name}</h3></div><button type="button" data-pet-rename>Đổi tên</button></header>${meter("No bụng", pet.hunger, "#ffcc66")}${meter("Vui vẻ", pet.happy, "#ff68c7")}${meter("Năng lượng", pet.energy, "#63eaff")}<div class="hhp-pet-xp"><span>Tiến hóa tiếp theo</span><div><i style="width:${pet.xp % 100}%"></i></div><b>${pet.xp % 100}/100 XP</b></div><p>Không có mua vật phẩm, loot box hoặc cơ chế ép quay lại. Chăm sóc chỉ nhằm tạo niềm vui nhẹ nhàng.</p></aside></div>
    </section>`;
  }

  function chillView() {
    const chill = state.chill;
    const sceneNames = { rain: "Mưa bên cửa sổ", cafe: "Quán cà phê đêm", forest: "Rừng đom đóm", fire: "Lửa trại", ocean: "Bờ biển" };
    return `<section class="hhp-view hhp-chill" data-chill-scene="${chill.scene}">${heading("CHILL ROOMS", sceneNames[chill.scene] || "Không gian thư giãn", "Âm cảnh được tạo trong trình duyệt; không tải nhạc có bản quyền và không tự phát âm thanh.", "LOCAL AUDIO")}
      <div class="hhp-chill-scenes">${Object.entries(sceneNames).map(([id, title]) => `<button type="button" data-chill-scene="${id}" class="${id === chill.scene ? "is-active" : ""}"><i>${({ rain: "☂", cafe: "☕", forest: "✦", fire: "△", ocean: "≈" })[id]}</i><span>${title}</span></button>`).join("")}</div>
      <div class="hhp-chill-layout"><article class="hhp-chill-window"><div class="hhp-weather" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--drop:${index}"></i>`).join("")}</div><div class="hhp-chill-clock"><small>PHIÊN TẬP TRUNG</small><strong data-pomodoro-time>${formatTime(pomodoroRemaining || chill.minutes * 60)}</strong><span data-pomodoro-status>Chưa bắt đầu</span><div><button type="button" data-pomodoro="start">Bắt đầu</button><button type="button" data-pomodoro="reset">Đặt lại</button></div></div></article><aside class="hhp-mixer"><header><strong>Ambient Mixer</strong><button type="button" data-chill-toggle>${audio?.ambient ? "Tắt âm cảnh" : "Bật âm cảnh"}</button></header>${range("Mưa", "rain", chill.rain, "#63eaff")}${range("Gió", "wind", chill.wind, "#a982ff")}${range("Lửa", "fire", chill.fire, "#ff9a5f")}${range("Piano nhẹ", "piano", chill.piano, "#ff68c7")}<label class="hhp-minutes"><span>Pomodoro</span><select data-chill-minutes>${[15, 25, 45, 60].map((value) => `<option value="${value}" ${value === chill.minutes ? "selected" : ""}>${value} phút</option>`).join("")}</select></label></aside></div>
    </section>`;
  }

  function quizView() {
    const quiz = state.quiz;
    const item = QUIZ[quiz.index % QUIZ.length];
    return `<section class="hhp-view hhp-quiz">${heading("QUIZ ARENA", quiz.completed ? "Hoàn thành lượt đố vui" : `Câu ${quiz.index + 1}/${QUIZ.length}`, "Mỗi đáp án đều có giải thích. Không dùng câu hỏi cộng đồng chưa kiểm duyệt.", `${quiz.score} điểm`)}
      <article class="hhp-quiz-card">${quiz.completed ? `<div class="hhp-quiz-result"><i>?</i><small>KẾT QUẢ</small><strong>${quiz.score}/${QUIZ.length}</strong><p>${quiz.score >= 6 ? "Phản xạ kiến thức rất tốt!" : "Bạn có thể chơi lại để xem toàn bộ phần giải thích."}</p><button type="button" data-quiz-reset>Chơi lại</button></div>` : `<header><span>CHỦ ĐỀ HỖN HỢP</span><div><i style="width:${(quiz.index + 1) / QUIZ.length * 100}%"></i></div></header><h3>${item.q}</h3><div class="hhp-quiz-choices">${item.choices.map((choice, index) => `<button type="button" data-quiz-answer="${index}" class="${quiz.answered ? index === item.answer ? "is-correct" : index === quiz.selected ? "is-wrong" : "" : ""}" ${quiz.answered ? "disabled" : ""}><i>${String.fromCharCode(65 + index)}</i><span>${choice}</span></button>`).join("")}</div>${quiz.answered ? `<div class="hhp-answer-note"><i>${quiz.selected === item.answer ? "✓" : "i"}</i><p><strong>${quiz.selected === item.answer ? "Chính xác" : `Đáp án: ${item.choices[item.answer]}`}</strong>${item.why}</p></div><button class="hhp-quiz-next" type="button" data-quiz-next>${quiz.index === QUIZ.length - 1 ? "Xem kết quả" : "Câu tiếp theo"} →</button>` : ""}`}</article>
      <div class="hhp-quiz-modes"><button class="is-active"><i>⚡</i><span><strong>Chơi nhanh</strong><small>8 câu trên thiết bị</small></span></button><button type="button" data-route-link="/communication/live-room"><i>◎</i><span><strong>Đấu cùng bạn</strong><small>Mở Live Room để kết nối thật</small></span></button><button type="button" data-quiz-report><i>!</i><span><strong>Báo lỗi câu hỏi</strong><small>Lưu ghi chú cục bộ</small></span></button></div>
    </section>`;
  }

  function meter(label, value, color) { return `<div class="hhp-meter"><span><b>${label}</b><small>${Math.round(value)}%</small></span><div><i style="width:${value}%;background:${color}"></i></div></div>`; }
  function range(label, key, value, color) { return `<label class="hhp-mix-row"><span><b>${label}</b><small data-mix-value="${key}">${value}%</small></span><input type="range" min="0" max="100" value="${value}" data-mix="${key}" style="--mix:${color}"></label>`; }
  function initials() { const name = options.currentUser?.displayName || options.currentUser?.name || "HH"; return String(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
  function level() { return Math.max(1, Math.floor(state.xp / 250) + 1); }
  function privacyLabel(value) { return ({ invite: "Chỉ người có mã", private: "Chỉ mình tôi", "public-draft": "Chờ server xác nhận" })[value] || "Riêng tư"; }
  function formatTime(seconds) { const value = Math.max(0, Math.round(seconds)); return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

  function bind() {
    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
    root.addEventListener("input", handleInput);
    root.addEventListener("change", handleChange);
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointerup", handlePointerUp);
    root.querySelector("[data-play-search]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") runSearch(event.currentTarget.value); });
    root.querySelector("[data-play-mobile-more]")?.addEventListener("click", (event) => { event.stopPropagation(); root.classList.toggle("is-mobile-menu-open"); });
  }

  function handleClick(event) {
    const viewButton = event.target.closest("button[data-play-view]");
    if (viewButton) return setView(viewButton.dataset.playView);
    const gameButton = event.target.closest("[data-game]");
    if (gameButton) { state.arcadeGame = gameButton.dataset.game; state.recent = [state.arcadeGame, ...state.recent.filter((id) => id !== state.arcadeGame)].slice(0, 6); save(); return setView("arcade"); }
    const route = event.target.closest("[data-route-link]")?.dataset.routeLink;
    if (route) { location.hash = `#${route}`; return; }
    if (event.target.closest("[data-play-inspector-toggle]")) { state.settings.inspector = !state.settings.inspector; save(); return render(); }
    if (event.target.closest("[data-play-mobile-more]")) { root.classList.toggle("is-mobile-menu-open"); return; }
    const action = event.target.closest("[data-play-action]")?.dataset.playAction;
    if (action) return handleAction(action);
    if (event.target.closest("[data-play-claim]")) { state.daily.claimed = true; state.xp += 75; save(); render(); return toast("Đã nhận huy hiệu ngày và 75 XP cục bộ."); }
    if (event.target.closest("[data-arcade-start]")) return startCanvasGame();
    if (event.target.closest("[data-arcade-pause]")) return toggleArcadePause();
    if (event.target.closest("[data-arcade-reset]")) return resetArcadeChallenge();
    const memoryCard = event.target.closest("[data-memory-card]"); if (memoryCard) return flipMemory(Number(memoryCard.dataset.memoryCard));
    if (event.target.closest("[data-reaction-pad]")) return reactionTap();
    const elementMove = event.target.closest("[data-element-move]")?.dataset.elementMove; if (elementMove) return moveElements(elementMove);
    if (event.target.closest("[data-sudoku-check]")) return checkSudoku();
    if (event.target.closest("[data-word-check]")) return checkWord();
    if (event.target.closest("[data-word-next]")) { state.wordIndex = ((state.wordIndex || 0) + 1) % WORDS.length; save(); return render(); }
    const towerLane = event.target.closest("[data-tower-lane]")?.dataset.towerLane; if (towerLane !== undefined) return towerAction(Number(towerLane));
    const roomSelect = event.target.closest("[data-party-select]")?.dataset.partySelect; if (roomSelect) { state.party.activeCode = roomSelect; save(); return render(); }
    const roomDelete = event.target.closest("[data-party-delete]")?.dataset.partyDelete; if (roomDelete) { state.party.rooms = state.party.rooms.filter((room) => room.code !== roomDelete); state.party.activeCode = state.party.rooms[0]?.code || ""; save(); return render(); }
    const roomCopy = event.target.closest("[data-party-copy]")?.dataset.partyCopy; if (roomCopy) return copyText(roomCopy, "Đã sao chép mã phòng.");
    const watchSelect = event.target.closest("[data-watch-select]")?.dataset.watchSelect; if (watchSelect) { state.watch.current = watchSelect; save(); return render(); }
    const watchRemove = event.target.closest("[data-watch-remove]")?.dataset.watchRemove; if (watchRemove) { state.watch.queue = state.watch.queue.filter((item) => item.id !== watchRemove); if (state.watch.current === watchRemove) state.watch.current = state.watch.queue[0]?.id || ""; save(); return render(); }
    const storyChoice = event.target.closest("[data-story-choice]")?.dataset.storyChoice; if (storyChoice) { state.story.history.push(state.story.node); state.story.node = storyChoice; save(); return render(); }
    if (event.target.closest("[data-story-reset]")) return resetStory();
    const saveSlot = event.target.closest("[data-story-save]")?.dataset.storySave; if (saveSlot !== undefined) { state.story.slots[Number(saveSlot)] = { node: state.story.node, history: [...state.story.history], savedAt: Date.now() }; save(); render(); return toast("Đã lưu nhánh truyện."); }
    const loadSlot = event.target.closest("[data-story-load]")?.dataset.storyLoad; if (loadSlot !== undefined) { const slot = state.story.slots[Number(loadSlot)]; if (slot) { state.story.node = slot.node; state.story.history = [...slot.history]; save(); render(); } return; }
    if (event.target.closest("[data-escape-hint]")) { state.escape.hints = clamp(state.escape.hints + 1, 0, 3); save(); return render(); }
    if (event.target.closest("[data-escape-reset]")) { state.escape = { stage: 0, hints: 0, completed: false }; save(); return render(); }
    if (event.target.closest("[data-rhythm-tap]")) return tapRhythm();
    const petAction = event.target.closest("[data-pet]")?.dataset.pet; if (petAction) return carePet(petAction);
    if (event.target.closest("[data-pet-rename]")) return openRenamePet();
    const chillScene = event.target.closest("button[data-chill-scene]")?.dataset.chillScene; if (chillScene) { state.chill.scene = chillScene; save(); return render(); }
    if (event.target.closest("[data-chill-toggle]")) return toggleChillAudio();
    const timerAction = event.target.closest("[data-pomodoro]")?.dataset.pomodoro; if (timerAction) return handlePomodoro(timerAction);
    const quizAnswer = event.target.closest("[data-quiz-answer]")?.dataset.quizAnswer; if (quizAnswer !== undefined) return answerQuiz(Number(quizAnswer));
    if (event.target.closest("[data-quiz-next]")) return nextQuiz();
    if (event.target.closest("[data-quiz-reset]")) { state.quiz = { index: 0, score: 0, answered: false, selected: -1, completed: false }; save(); return render(); }
    if (event.target.closest("[data-quiz-report]")) return openQuizReport();
    if (event.target.closest("[data-hhp-dialog-close]")) event.target.closest(".hhp-dialog-host")?.remove();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (event.target.matches("[data-party-form]")) {
      const form = new FormData(event.target); const code = randomCode();
      const room = { code, name: clean(form.get("name"), 48) || "Phòng HH Play", privacy: clean(form.get("privacy"), 20), limit: clamp(form.get("limit"), 2, 8), permissions: { chat: form.has("chat"), control: form.has("control"), spectate: form.has("spectate") }, createdAt: Date.now(), provider: "local-device" };
      state.party.rooms.unshift(room); state.party.rooms = state.party.rooms.slice(0, 12); state.party.activeCode = code; state.daily.social = 1; state.xp += 20; save(); render(); return toast("Đã tạo phòng cục bộ. Chưa có người online giả.");
    }
    if (event.target.matches("[data-watch-form]")) {
      const form = new FormData(event.target); const id = youtubeId(form.get("url"));
      if (!id) return toast("Chỉ chấp nhận liên kết YouTube hợp lệ.", true);
      const title = clean(form.get("title"), 80) || `YouTube · ${id}`;
      if (!state.watch.queue.some((item) => item.id === id)) state.watch.queue.push({ id, title, addedAt: Date.now(), source: "youtube-nocookie" });
      state.watch.current = id; save(); render(); return toast("Đã thêm vào hàng đợi cục bộ.");
    }
    if (event.target.matches("[data-escape-form]")) {
      const answer = clean(new FormData(event.target).get("answer"), 30).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const expected = ESCAPE_STAGES[state.escape.stage]?.answer;
      if (answer !== expected) return toast("Mật mã chưa đúng. Bạn có thể mở gợi ý.", true);
      state.escape.stage += 1; state.escape.hints = 0;
      if (state.escape.stage >= ESCAPE_STAGES.length) { state.escape.completed = true; state.xp += 90; markPlayed("escape", 300); }
      save(); render(); return toast(state.escape.completed ? "Cổng đã mở!" : "Đúng! Mảnh khóa tiếp theo đã xuất hiện.");
    }
  }

  function handleInput(event) {
    const mix = event.target.dataset.mix;
    if (mix) { state.chill[mix] = clamp(event.target.value, 0, 100); root.querySelector(`[data-mix-value="${mix}"]`).textContent = `${state.chill[mix]}%`; updateAudioGains(); save(); }
  }

  function handleChange(event) {
    if (event.target.matches("[data-chill-minutes]")) { state.chill.minutes = clamp(event.target.value, 5, 120); pomodoroRemaining = state.chill.minutes * 60; save(); updatePomodoroUI(); }
  }

  function handlePointerDown(event) {
    const key = event.target.closest("[data-play-key]")?.dataset.playKey;
    if (!key || !arcade) return;
    arcade.keys.add(key === "left" ? "ArrowLeft" : key === "right" ? "ArrowRight" : "Space");
  }
  function handlePointerUp(event) {
    const key = event.target.closest("[data-play-key]")?.dataset.playKey;
    if (!key || !arcade) return;
    arcade.keys.delete(key === "left" ? "ArrowLeft" : key === "right" ? "ArrowRight" : "Space");
  }

  function handleAction(action) {
    if (action === "exit") { location.hash = "#/home"; return; }
    if (action === "invite") { const code = state.party.activeCode; return copyText(code || location.href, code ? "Đã sao chép mã phòng." : "Đã sao chép liên kết HH Play."); }
    if (action === "settings") return openSettings();
    if (action === "fullscreen") return toggleFullscreen();
    if (action === "restart") return restartCurrent();
    if (action === "arcade") return setView("arcade");
    if (action === "arcade-start") return startArcadePrimary();
    if (action === "party-focus") return root.querySelector("[data-party-form] input")?.focus();
    if (action === "watch-focus") return root.querySelector("[data-watch-form] input")?.focus();
    if (action === "story-reset") return resetStory();
    if (action === "escape-focus") return root.querySelector("[data-escape-form] input")?.focus();
    if (action === "rhythm-start") return startRhythm();
    if (action === "pet-play") return carePet("play");
    if (action === "chill-toggle") return toggleChillAudio();
    if (action === "quiz-next") return state.quiz.answered ? nextQuiz() : toast("Hãy chọn một đáp án trước.");
  }

  function activateViewRuntime() {
    if (state.view === "arcade") setupArcadeStage();
    if (state.view === "rhythm") window.addEventListener("keydown", rhythmKeydown);
    if (state.view === "chill") { pomodoroRemaining ||= state.chill.minutes * 60; updatePomodoroUI(); }
    applyPetRest();
  }

  function cleanupRuntime() {
    if (arcade?.raf) cancelAnimationFrame(arcade.raf);
    if (towerState?.timer) clearInterval(towerState.timer);
    towerState = null;
    arcade = null;
    clearTimeout(reactionTimer);
    if (rhythm?.raf) cancelAnimationFrame(rhythm.raf);
    rhythm = null;
    window.removeEventListener("keydown", arcadeKeydown);
    window.removeEventListener("keyup", arcadeKeyup);
    window.removeEventListener("keydown", rhythmKeydown);
  }

  function setupArcadeStage() {
    const game = ARCADE_GAMES.find((item) => item.id === state.arcadeGame) || ARCADE_GAMES[0];
    if (game.type === "canvas") setupCanvas(game.id);
    else if (game.id === "memory") setupMemory();
    else if (game.id === "reaction") updateReaction();
    else if (game.id === "elements") setupElements();
    else if (game.id === "tower") setupTower();
  }

  function startArcadePrimary() {
    const game = ARCADE_GAMES.find((item) => item.id === state.arcadeGame) || ARCADE_GAMES[0];
    if (game.type === "canvas") startCanvasGame();
    else if (game.id === "reaction") reactionTap();
    else toast("Thử thách đã sẵn sàng trong vùng chơi.");
  }

  function setupCanvas(mode) {
    const canvas = root.querySelector("[data-arcade-canvas]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    arcade = { mode, canvas, ctx, running: false, paused: true, score: 0, lives: 3, keys: new Set(), last: 0, spawn: 0, tick: 0, player: { x: 360, y: 350 }, objects: [], bullets: [], bricks: [], snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: { x: 20, y: 10 }, ball: { x: 360, y: 270, vx: 190, vy: -210 }, paddle: 360 };
    if (mode === "breaker") arcade.bricks = Array.from({ length: 36 }, (_, index) => ({ x: 58 + index % 9 * 68, y: 45 + Math.floor(index / 9) * 30, alive: true }));
    drawCanvasGame();
    window.addEventListener("keydown", arcadeKeydown);
    window.addEventListener("keyup", arcadeKeyup);
  }

  function startCanvasGame() {
    if (!arcade) return;
    if (!arcade.running) setupCanvas(arcade.mode);
    arcade.running = true; arcade.paused = false; arcade.last = performance.now();
    root.querySelector(".hhp-game-overlay")?.classList.add("is-hidden");
    updateArcadeStatus("Đang chơi");
    arcade.raf = requestAnimationFrame(canvasLoop);
  }

  function toggleArcadePause() {
    if (!arcade?.running) return startCanvasGame();
    arcade.paused = !arcade.paused;
    updateArcadeStatus(arcade.paused ? "Đã tạm dừng" : "Đang chơi");
    if (!arcade.paused) { arcade.last = performance.now(); arcade.raf = requestAnimationFrame(canvasLoop); }
  }

  function resetArcadeChallenge() { cleanupRuntime(); render(); }

  function arcadeKeydown(event) {
    if (!arcade || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) return;
    event.preventDefault();
    const key = event.key === " " ? "Space" : event.key;
    arcade.keys.add(key);
    if (arcade.mode === "snake") {
      const dirs = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const next = dirs[key]; if (next && !(next.x === -arcade.dir.x && next.y === -arcade.dir.y)) arcade.nextDir = next;
    }
    if (key === "Space" && arcade.mode === "shooter") fireBullet();
  }
  function arcadeKeyup(event) { if (arcade) arcade.keys.delete(event.key === " " ? "Space" : event.key); }

  function canvasLoop(now) {
    if (!arcade?.running || arcade.paused) return;
    const dt = Math.min(0.033, (now - arcade.last) / 1000 || 0); arcade.last = now;
    updateCanvasGame(dt, now); drawCanvasGame();
    if (arcade?.running && !arcade.paused) arcade.raf = requestAnimationFrame(canvasLoop);
  }

  function updateCanvasGame(dt, now) {
    if (arcade.mode === "snake") return updateSnake(now);
    const move = (arcade.keys.has("ArrowRight") ? 1 : 0) - (arcade.keys.has("ArrowLeft") ? 1 : 0);
    arcade.player.x = clamp(arcade.player.x + move * 330 * dt, 24, 696);
    if (arcade.mode === "breaker") return updateBreaker(dt);
    arcade.spawn -= dt;
    if (arcade.spawn <= 0) {
      arcade.spawn = arcade.mode === "shooter" ? 0.72 : 0.48;
      arcade.objects.push({ x: 25 + Math.random() * 670, y: -20, r: 10 + Math.random() * 14, speed: 100 + Math.random() * 130 });
    }
    arcade.objects.forEach((object) => { object.y += object.speed * dt; });
    if (arcade.mode === "shooter") {
      arcade.bullets.forEach((bullet) => { bullet.y -= 430 * dt; });
      for (const bullet of arcade.bullets) for (const enemy of arcade.objects) if (!enemy.hit && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.r + 5) { enemy.hit = true; bullet.hit = true; arcade.score += 25; }
      arcade.bullets = arcade.bullets.filter((bullet) => !bullet.hit && bullet.y > -20);
      arcade.objects = arcade.objects.filter((object) => !object.hit);
    }
    arcade.objects.forEach((object) => {
      if (!object.hit && object.y > 326 && Math.abs(object.x - arcade.player.x) < object.r + 18) { object.hit = true; arcade.lives -= 1; }
      if (object.y > 430) { if (arcade.mode === "dodge") arcade.score += 8; object.hit = true; }
    });
    arcade.objects = arcade.objects.filter((object) => !object.hit);
    if (arcade.lives <= 0) endArcade(false);
    else if (arcade.score >= (arcade.mode === "shooter" ? 500 : 320)) endArcade(true);
    updateArcadeScore();
  }

  function updateSnake(now) {
    if (now - arcade.tick < 105) return;
    arcade.tick = now; arcade.dir = arcade.nextDir;
    const head = { x: arcade.snake[0].x + arcade.dir.x, y: arcade.snake[0].y + arcade.dir.y };
    if (head.x < 0 || head.x >= 36 || head.y < 0 || head.y >= 20 || arcade.snake.some((part) => part.x === head.x && part.y === head.y)) return endArcade(false);
    arcade.snake.unshift(head);
    if (head.x === arcade.food.x && head.y === arcade.food.y) { arcade.score += 20; arcade.food = { x: Math.floor(Math.random() * 36), y: Math.floor(Math.random() * 20) }; }
    else arcade.snake.pop();
    if (arcade.score >= 300) endArcade(true);
    updateArcadeScore();
  }

  function updateBreaker(dt) {
    arcade.paddle = arcade.player.x;
    const ball = arcade.ball; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < 9 || ball.x > 711) ball.vx *= -1;
    if (ball.y < 9) ball.vy = Math.abs(ball.vy);
    if (ball.y > 350 && ball.y < 374 && Math.abs(ball.x - arcade.paddle) < 70 && ball.vy > 0) { ball.vy = -Math.abs(ball.vy); ball.vx += (ball.x - arcade.paddle) * 2; }
    arcade.bricks.forEach((brick) => { if (brick.alive && Math.abs(ball.x - brick.x) < 31 && Math.abs(ball.y - brick.y) < 12) { brick.alive = false; ball.vy *= -1; arcade.score += 15; } });
    if (ball.y > 420) { arcade.lives -= 1; Object.assign(ball, { x: 360, y: 270, vx: 190, vy: -210 }); }
    if (arcade.bricks.every((brick) => !brick.alive)) endArcade(true);
    else if (arcade.lives <= 0) endArcade(false);
    updateArcadeScore();
  }

  function fireBullet() { if (arcade?.running && arcade.mode === "shooter" && arcade.bullets.length < 8) arcade.bullets.push({ x: arcade.player.x, y: 330 }); }

  function drawCanvasGame() {
    if (!arcade) return;
    const { ctx, canvas } = arcade;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); gradient.addColorStop(0, "#07112a"); gradient.addColorStop(1, "#150827"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(99,234,255,.22)"; for (let i = 0; i < 70; i += 1) ctx.fillRect((i * 97) % 720, (i * 53) % 400, i % 3 + 1, i % 3 + 1);
    if (arcade.mode === "snake") {
      ctx.fillStyle = "#63eaff"; arcade.snake.forEach((part, index) => { ctx.globalAlpha = Math.max(.3, 1 - index * .035); ctx.fillRect(part.x * 20 + 2, part.y * 20 + 2, 16, 16); }); ctx.globalAlpha = 1; ctx.fillStyle = "#ff68c7"; ctx.beginPath(); ctx.arc(arcade.food.x * 20 + 10, arcade.food.y * 20 + 10, 7, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (arcade.mode === "breaker") {
      arcade.bricks.forEach((brick, index) => { if (!brick.alive) return; ctx.fillStyle = ["#63eaff", "#aa82ff", "#ff68c7", "#ffd86b"][Math.floor(index / 9)]; ctx.fillRect(brick.x - 29, brick.y - 9, 58, 18); });
      ctx.fillStyle = "#63eaff"; ctx.fillRect(arcade.paddle - 62, 360, 124, 12); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(arcade.ball.x, arcade.ball.y, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "#63eaff"; ctx.beginPath(); ctx.moveTo(arcade.player.x, 330); ctx.lineTo(arcade.player.x - 17, 370); ctx.lineTo(arcade.player.x, 360); ctx.lineTo(arcade.player.x + 17, 370); ctx.closePath(); ctx.fill();
      arcade.objects.forEach((object) => { ctx.fillStyle = arcade.mode === "shooter" ? "#ff6578" : "#aa82ff"; ctx.beginPath(); ctx.arc(object.x, object.y, object.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#ffd86b"; arcade.bullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 14));
    }
    ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.font = "700 13px system-ui"; ctx.fillText(`Điểm ${arcade.score} · Mạng ${arcade.lives}`, 16, 24);
  }

  function endArcade(win) {
    if (!arcade?.running) return;
    arcade.running = false; arcade.paused = true;
    markPlayed(arcade.mode, arcade.score);
    updateArcadeStatus(win ? "Hoàn thành!" : "Kết thúc");
    const overlay = root.querySelector(".hhp-game-overlay"); if (overlay) { overlay.classList.remove("is-hidden"); overlay.querySelector("strong").textContent = win ? "Thử thách hoàn thành" : "Lượt chơi kết thúc"; overlay.querySelector("p").textContent = `Điểm: ${arcade.score}. Kỷ lục đã được lưu trên thiết bị.`; overlay.querySelector("button").textContent = "Chơi lại"; }
  }

  function updateArcadeScore() { const element = root?.querySelector("[data-arcade-score]"); if (element && arcade) element.textContent = Math.round(arcade.score); }
  function updateArcadeStatus(text) { const element = root?.querySelector("[data-arcade-status]"); if (element) element.textContent = text; }
  function markPlayed(id, score = 0) { state.scores[id] = Math.max(Number(state.scores[id]) || 0, Math.round(score)); state.daily.played = 1; state.sessions += 1; state.xp += Math.max(5, Math.min(60, Math.round(score / 10))); state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 6); save(); }

  function setupMemory() {
    const symbols = ["✦", "☾", "◇", "◎", "△", "♫", "⌁", "◈"];
    memoryState = { cards: [...symbols, ...symbols].sort(() => Math.random() - .5).map((symbol, index) => ({ symbol, id: index, open: false, matched: false })), open: [], moves: 0, locked: false };
    drawMemory();
  }
  function drawMemory() { const board = root?.querySelector("[data-memory-board]"); if (!board || !memoryState) return; board.innerHTML = memoryState.cards.map((card, index) => `<button type="button" data-memory-card="${index}" class="${card.open || card.matched ? "is-open" : ""} ${card.matched ? "is-matched" : ""}"><i>?</i><b>${card.symbol}</b></button>`).join(""); updateArcadeScoreValue(memoryState.moves); }
  function flipMemory(index) {
    const card = memoryState?.cards[index]; if (!card || card.open || card.matched || memoryState.locked) return;
    card.open = true; memoryState.open.push(index); drawMemory();
    if (memoryState.open.length < 2) return;
    memoryState.moves += 1; const [a, b] = memoryState.open.map((id) => memoryState.cards[id]);
    if (a.symbol === b.symbol) { a.matched = b.matched = true; memoryState.open = []; if (memoryState.cards.every((item) => item.matched)) { const score = Math.max(100, 600 - memoryState.moves * 20); markPlayed("memory", score); toast(`Hoàn thành trong ${memoryState.moves} lượt.`); } drawMemory(); }
    else { memoryState.locked = true; setTimeout(() => { a.open = b.open = false; memoryState.open = []; memoryState.locked = false; drawMemory(); }, 650); }
  }

  function reactionTap() {
    const now = performance.now();
    if (reactionState.phase === "idle" || reactionState.phase === "done") {
      reactionState.phase = "waiting"; updateReaction(); clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => { reactionState.phase = "ready"; reactionState.startedAt = performance.now(); updateReaction(); tone(740, .08); }, 900 + Math.random() * 2200); return;
    }
    if (reactionState.phase === "waiting") { clearTimeout(reactionTimer); reactionState.phase = "idle"; updateReaction("Quá sớm! Nhấn để thử lại."); return; }
    if (reactionState.phase === "ready") { const ms = Math.round(now - reactionState.startedAt); reactionState.phase = "done"; reactionState.best = reactionState.best ? Math.min(reactionState.best, ms) : ms; const score = Math.max(50, 900 - ms); markPlayed("reaction", score); updateReaction(`${ms} ms · tốt nhất ${reactionState.best} ms`); }
  }
  function updateReaction(message = "") { const pad = root?.querySelector("[data-reaction-pad]"); if (!pad) return; pad.dataset.phase = reactionState.phase; const strong = pad.querySelector("strong"); const span = pad.querySelector("span"); if (strong) strong.textContent = reactionState.phase === "waiting" ? "Chờ…" : reactionState.phase === "ready" ? "NHẤN NGAY!" : reactionState.phase === "done" ? "Đã ghi kết quả" : "Nhấn để chuẩn bị"; if (span) span.textContent = message || (reactionState.phase === "waiting" ? "Đừng nhấn trước khi chuyển sang màu xanh" : "Chờ tín hiệu đổi màu rồi nhấn nhanh nhất"); }

  function setupElements() { if (!elementBoard.length) { elementBoard = Array(16).fill(0); addElement(); addElement(); } drawElements(); }
  function addElement() { const empty = elementBoard.map((value, index) => value ? -1 : index).filter((index) => index >= 0); if (empty.length) elementBoard[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < .86 ? 2 : 4; }
  function moveElements(direction) {
    if (!elementBoard.length) setupElements(); const before = elementBoard.join(","); let score = 0;
    const lines = direction === "left" || direction === "right" ? Array.from({ length: 4 }, (_, row) => [0, 1, 2, 3].map((col) => row * 4 + col)) : Array.from({ length: 4 }, (_, col) => [0, 1, 2, 3].map((row) => row * 4 + col));
    if (direction === "right" || direction === "down") lines.forEach((line) => line.reverse());
    lines.forEach((line) => { const values = line.map((index) => elementBoard[index]).filter(Boolean); const merged = []; for (let i = 0; i < values.length; i += 1) { if (values[i] === values[i + 1]) { merged.push(values[i] * 2); score += values[i] * 2; i += 1; } else merged.push(values[i]); } while (merged.length < 4) merged.push(0); line.forEach((index, i) => { elementBoard[index] = merged[i]; }); });
    if (before !== elementBoard.join(",")) addElement();
    state.elementScore = (state.elementScore || 0) + score; if (Math.max(...elementBoard) >= 2048) markPlayed("elements", state.elementScore); save(); drawElements();
  }
  function drawElements() { const board = root?.querySelector("[data-elements-board]"); if (!board) return; board.innerHTML = elementBoard.map((value) => `<span data-value="${value}">${value || ""}</span>`).join(""); updateArcadeScoreValue(state.elementScore || 0); }

  function sudokuMarkup() { const puzzle = [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1]; return `<div class="hhp-sudoku">${puzzle.map((value, index) => value ? `<b>${value}</b>` : `<input inputmode="numeric" maxlength="1" data-sudoku="${index}" aria-label="Ô số ${index + 1}">`).join("")}</div><button class="hhp-inline-submit" type="button" data-sudoku-check>Kiểm tra bảng</button>`; }
  function checkSudoku() { const solution = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1]; const inputs = [...root.querySelectorAll("[data-sudoku]")]; let valid = true; inputs.forEach((input) => { const ok = Number(input.value) === solution[Number(input.dataset.sudoku)]; input.classList.toggle("is-error", !ok); valid = valid && ok; }); if (!valid) return toast("Một số ô chưa đúng.", true); markPlayed("sudoku", 420); toast("Solar Sudoku hoàn thành!"); }

  function wordMarkup() { const item = WORDS[(state.wordIndex || 0) % WORDS.length]; const scrambled = item.word.split("").sort((a, b) => (a.charCodeAt(0) * 7 % 13) - (b.charCodeAt(0) * 7 % 13)).join(" · "); return `<div class="hhp-word"><small>GỢI Ý: ${item.clue}</small><strong>${scrambled}</strong><label><span>Từ của bạn</span><input data-word-input autocomplete="off" maxlength="20"></label><div><button type="button" data-word-check>Kiểm tra</button><button type="button" data-word-next>Từ khác</button></div></div>`; }
  function checkWord() { const item = WORDS[(state.wordIndex || 0) % WORDS.length]; const answer = clean(root.querySelector("[data-word-input]")?.value, 20).normalize("NFD").replace(/[\u0300-\u036f\s]/g, "").toUpperCase(); if (answer !== item.word) return toast("Chưa đúng, hãy xem lại các chữ cái.", true); markPlayed("word", 250); toast("Ghép từ chính xác!"); }

  function towerMarkup() { return `<div class="hhp-tower" data-tower-board>${[0, 1, 2].map((lane) => `<button type="button" data-tower-lane="${lane}"><i></i><span>Tuyến ${lane + 1}</span><b data-tower-hp="${lane}">100</b></button>`).join("")}</div><p class="hhp-tower-note">Chạm tuyến yếu nhất để chuyển 18 năng lượng phòng thủ. Giữ cả ba tuyến qua 12 wave.</p>`; }
  function setupTower() { towerState = { hp: [100, 100, 100], energy: 100, wave: 0, timer: setInterval(() => { if (!towerState || state.view !== "arcade" || state.arcadeGame !== "tower") return; towerState.wave += 1; const lane = Math.floor(Math.random() * 3); towerState.hp[lane] = Math.max(0, towerState.hp[lane] - (12 + Math.floor(Math.random() * 18))); towerState.energy = Math.min(100, towerState.energy + 8); drawTower(); if (towerState.hp.some((hp) => hp <= 0)) { clearInterval(towerState.timer); toast("Một tuyến đã thất thủ. Hãy đặt lại để thử lại.", true); } else if (towerState.wave >= 12) { clearInterval(towerState.timer); markPlayed("tower", towerState.hp.reduce((a, b) => a + b, 0)); toast("Đã giữ vững 12 wave!"); } }, 1600) }; drawTower(); }
  function towerAction(lane) { if (!towerState || towerState.energy < 18) return toast("Chưa đủ năng lượng.", true); towerState.energy -= 18; towerState.hp[lane] = Math.min(100, towerState.hp[lane] + 30); drawTower(); }
  function drawTower() { if (!towerState) return; towerState.hp.forEach((hp, lane) => { const element = root?.querySelector(`[data-tower-hp="${lane}"]`); if (element) element.textContent = `${Math.round(hp)}%`; }); updateArcadeScoreValue(towerState.wave * 25); updateArcadeStatus(`Wave ${towerState.wave}/12 · NL ${towerState.energy}`); }
  function updateArcadeScoreValue(value) { const target = root?.querySelector("[data-arcade-score]"); if (target) target.textContent = Math.round(value); }

  function youtubeId(value) { const text = String(value || "").trim(); try { const url = new URL(text); if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)) return ""; const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1); return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : ""; } catch { return ""; } }
  function resetStory() { state.story.node = "intro"; state.story.history = []; save(); render(); }

  function startRhythm() {
    if (rhythm?.running) return;
    ensureAudioContext(); const start = performance.now() + 900; const interval = 600; rhythm = { running: true, start, interval, taps: [], score: 0, judged: new Set(), raf: 0 };
    for (let index = 0; index < 12; index += 1) scheduleTone((start - performance.now()) / 1000 + index * interval / 1000, index % 4 === 0 ? 660 : 440);
    root.querySelector("[data-rhythm-label]").textContent = "Chuẩn bị…"; rhythm.raf = requestAnimationFrame(rhythmLoop);
  }
  function rhythmLoop(now) { if (!rhythm?.running) return; const elapsed = now - rhythm.start; const active = Math.floor((elapsed + 110) / rhythm.interval); root?.querySelectorAll("[data-rhythm-track] i").forEach((beat, index) => beat.classList.toggle("is-active", index === active)); if (elapsed > rhythm.interval * 12 + 500) { rhythm.running = false; markPlayed("rhythm", rhythm.score); const label = root.querySelector("[data-rhythm-label]"); if (label) label.textContent = "Hoàn thành"; return; } rhythm.raf = requestAnimationFrame(rhythmLoop); }
  function tapRhythm() { if (!rhythm?.running) return startRhythm(); const now = performance.now(); const index = Math.round((now - rhythm.start) / rhythm.interval); if (index < 0 || index >= 12 || rhythm.judged.has(index)) return; rhythm.judged.add(index); const delta = Math.abs(now - (rhythm.start + index * rhythm.interval)); const points = delta <= 80 ? 100 : delta <= 160 ? 60 : delta <= 260 ? 25 : 0; rhythm.score += points; const label = root.querySelector("[data-rhythm-label]"); if (label) label.textContent = points === 100 ? "PERFECT" : points === 60 ? "GOOD" : points ? "OK" : "MISS"; const score = root.querySelector("[data-rhythm-score]"); if (score) score.textContent = rhythm.score; root.querySelector("[data-rhythm-orbit]")?.classList.add("is-hit"); setTimeout(() => root?.querySelector("[data-rhythm-orbit]")?.classList.remove("is-hit"), 130); }
  function rhythmKeydown(event) { if (event.code === "Space" && state?.view === "rhythm") { event.preventDefault(); tapRhythm(); } }

  function ensureAudioContext() { if (!audio?.context) { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return null; audio = { context: new Context(), sources: [], gains: {} }; } if (audio.context.state === "suspended") audio.context.resume(); return audio.context; }
  function tone(frequency, duration = .05) { const context = ensureAudioContext(); if (!context || !state.settings.sound) return; const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration); }
  function scheduleTone(delay, frequency) { const context = ensureAudioContext(); if (!context || !state.settings.sound) return; const time = context.currentTime + Math.max(0, delay); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.07, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + .08); oscillator.connect(gain).connect(context.destination); oscillator.start(time); oscillator.stop(time + .09); }

  function applyPetRest() { if (!state?.pet) return; const elapsedHours = Math.min(24, Math.max(0, (Date.now() - state.pet.lastCare) / 3600000)); if (elapsedHours < 1) return; state.pet.hunger = clamp(state.pet.hunger - elapsedHours * 1.2, 20, 100); state.pet.happy = clamp(state.pet.happy - elapsedHours * .45, 25, 100); state.pet.energy = clamp(state.pet.energy + elapsedHours * 2.5, 0, 100); state.pet.lastCare = Date.now(); save(); }
  function carePet(action) { const pet = state.pet; const changes = { feed: [26, 5, -2, 12], play: [-5, 24, -12, 18], train: [-8, 8, -18, 26], rest: [-2, 2, 30, 8] }[action]; if (!changes) return; pet.hunger = clamp(pet.hunger + changes[0], 0, 100); pet.happy = clamp(pet.happy + changes[1], 0, 100); pet.energy = clamp(pet.energy + changes[2], 0, 100); pet.xp += changes[3]; pet.level = Math.floor(pet.xp / 100) + 1; pet.lastCare = Date.now(); state.daily.played = 1; save(); render(); root?.querySelector("[data-pet-creature]")?.classList.add("is-happy"); }
  function openRenamePet() { openDialog("Đổi tên pet", `<form data-rename-pet><label><span>Tên mới</span><input name="name" maxlength="20" value="${esc(state.pet.name)}" required></label><button type="submit">Lưu tên</button></form>`); root.querySelector("[data-rename-pet]")?.addEventListener("submit", (event) => { event.preventDefault(); state.pet.name = clean(new FormData(event.target).get("name"), 20) || "Lumi"; save(); render(); }); }

  function toggleChillAudio() { if (audio?.ambient) { stopAmbient(); render(); return; } const context = ensureAudioContext(); if (!context) return toast("Trình duyệt chưa hỗ trợ Web Audio.", true); const master = context.createGain(); master.gain.value = .55; master.connect(context.destination); const createNoise = (filterType, frequency, key) => { const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1; const source = context.createBufferSource(); source.buffer = buffer; source.loop = true; const filter = context.createBiquadFilter(); filter.type = filterType; filter.frequency.value = frequency; const gain = context.createGain(); gain.gain.value = 0; source.connect(filter).connect(gain).connect(master); source.start(); audio.sources.push(source); audio.gains[key] = gain; };
    createNoise("lowpass", 1100, "rain"); createNoise("lowpass", 340, "wind"); createNoise("bandpass", 2100, "fire");
    const piano = context.createOscillator(); const pianoGain = context.createGain(); piano.type = "sine"; piano.frequency.value = 220; pianoGain.gain.value = 0; piano.connect(pianoGain).connect(master); piano.start(); audio.sources.push(piano); audio.gains.piano = pianoGain; audio.ambient = true; updateAudioGains(); render(); }
  function updateAudioGains() { if (!audio?.ambient) return; ["rain", "wind", "fire", "piano"].forEach((key) => { const gain = audio.gains[key]; if (gain) gain.gain.setTargetAtTime((state.chill[key] / 100) * (key === "piano" ? .035 : .12), audio.context.currentTime, .08); }); }
  function stopAmbient() { if (!audio) return; audio.sources.forEach((source) => { try { source.stop(); } catch {} }); audio.sources = []; audio.gains = {}; audio.ambient = false; }
  function handlePomodoro(action) { if (action === "reset") { clearInterval(pomodoroTimer); pomodoroTimer = 0; pomodoroRemaining = state.chill.minutes * 60; updatePomodoroUI("Đã đặt lại"); return; } if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = 0; updatePomodoroUI("Đã tạm dừng"); return; } if (!pomodoroRemaining) pomodoroRemaining = state.chill.minutes * 60; pomodoroTimer = setInterval(() => { pomodoroRemaining -= 1; updatePomodoroUI("Đang tập trung"); if (pomodoroRemaining <= 0) { clearInterval(pomodoroTimer); pomodoroTimer = 0; tone(660, .2); state.xp += 20; save(); updatePomodoroUI("Hoàn thành"); } }, 1000); updatePomodoroUI("Đang tập trung"); }
  function updatePomodoroUI(status) { const time = root?.querySelector("[data-pomodoro-time]"); const label = root?.querySelector("[data-pomodoro-status]"); if (time) time.textContent = formatTime(pomodoroRemaining || state.chill.minutes * 60); if (label && status) label.textContent = status; const button = root?.querySelector('[data-pomodoro="start"]'); if (button) button.textContent = pomodoroTimer ? "Tạm dừng" : "Bắt đầu"; }

  function answerQuiz(index) { if (state.quiz.answered) return; const item = QUIZ[state.quiz.index]; state.quiz.selected = index; state.quiz.answered = true; if (index === item.answer) state.quiz.score += 1; state.daily.quiz = 1; state.xp += index === item.answer ? 15 : 5; save(); render(); }
  function nextQuiz() { if (!state.quiz.answered && !state.quiz.completed) return toast("Hãy chọn một đáp án trước."); if (state.quiz.index >= QUIZ.length - 1) state.quiz.completed = true; else { state.quiz.index += 1; state.quiz.answered = false; state.quiz.selected = -1; } save(); render(); }
  function openQuizReport() { openDialog("Báo lỗi câu hỏi", `<form data-quiz-report-form><p>Ghi chú được lưu cục bộ; không tự gửi ra ngoài.</p><label><span>Mô tả vấn đề</span><textarea name="message" maxlength="500" required></textarea></label><button type="submit">Lưu ghi chú</button></form>`); root.querySelector("[data-quiz-report-form]")?.addEventListener("submit", (event) => { event.preventDefault(); const message = clean(new FormData(event.target).get("message"), 500); const reports = JSON.parse(localStorage.getItem("hh.play.quiz-reports.v1") || "[]"); reports.push({ question: state.quiz.index, message, createdAt: Date.now() }); localStorage.setItem("hh.play.quiz-reports.v1", JSON.stringify(reports.slice(-30))); event.target.closest(".hhp-dialog-host")?.remove(); toast("Đã lưu ghi chú cục bộ."); }); }

  function restartCurrent() { if (state.view === "arcade") return resetArcadeChallenge(); if (state.view === "story") return resetStory(); if (state.view === "escape") { state.escape = { stage: 0, hints: 0, completed: false }; } if (state.view === "quiz") state.quiz = { index: 0, score: 0, answered: false, selected: -1, completed: false }; save(); render(); }
  function runSearch(query) { const term = clean(query, 80).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); if (!term) return; const results = [...VIEWS.map((item) => ({ id: item.id, title: item.title, note: item.note, icon: item.icon, color: item.color, kind: "view" })), ...ARCADE_GAMES.map((item) => ({ ...item, note: item.desc, color: "#63eaff", kind: "game" }))].filter((item) => `${item.title} ${item.note}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term)); root.querySelector(".hhp-stage-scroll").innerHTML = `<section class="hhp-view hhp-search-results">${heading("TÌM KIẾM", `Kết quả cho “${esc(query)}”`, "Bấm một kết quả để mở trực tiếp.", `${results.length} kết quả`)}<div>${results.length ? results.map((item) => `<button type="button" ${item.kind === "game" ? `data-game="${item.id}"` : `data-play-view="${item.id}"`} style="--result:${item.color}"><i>${item.icon}</i><span><strong>${item.title}</strong><small>${item.note}</small></span><b>→</b></button>`).join("") : `<p>Không tìm thấy. Thử “game”, “nhịp”, “phòng”, “pet” hoặc “quiz”.</p>`}</div></section>`; }
  function openSettings() { openDialog("Cài đặt HH Play", `<form data-play-settings><label><span>Mức chuyển động</span><select name="motion"><option value="static" ${state.settings.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.settings.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.settings.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label><label class="hhp-check"><input type="checkbox" name="sound" ${state.settings.sound ? "checked" : ""}><span>Cho phép âm thanh sau thao tác</span></label><label class="hhp-check"><input type="checkbox" name="inspector" ${state.settings.inspector ? "checked" : ""}><span>Hiện bảng tóm tắt</span></label><label class="hhp-check"><input type="checkbox" name="safeChat" ${state.settings.safeChat ? "checked" : ""}><span>Bộ lọc chat an toàn mặc định</span></label><button type="submit">Áp dụng</button></form>`); root.querySelector("[data-play-settings]")?.addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.target); state.settings.motion = clean(form.get("motion"), 20); state.settings.sound = form.has("sound"); state.settings.inspector = form.has("inspector"); state.settings.safeChat = form.has("safeChat"); save(); render(); }); }
  function openDialog(title, content) { root.querySelector(".hhp-dialog-host")?.remove(); root.insertAdjacentHTML("beforeend", `<div class="hhp-dialog-host"><button type="button" data-hhp-dialog-close aria-label="Đóng"></button><section class="hhp-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button type="button" data-hhp-dialog-close>×</button></header>${content}</section></div>`); }
  function toggleFullscreen() { if (document.fullscreenElement) return document.exitFullscreen?.(); root.requestFullscreen?.().catch(() => toast("Trình duyệt không cho phép toàn màn hình.", true)); }
  async function copyText(text, message) { try { await navigator.clipboard.writeText(String(text)); toast(message); } catch { toast("Không thể truy cập clipboard. Hãy sao chép thủ công.", true); } }
  function toast(message, error = false) { const target = root?.querySelector(".hhp-toast"); if (!target) return; clearTimeout(noticeTimer); target.hidden = false; target.classList.toggle("is-error", error); target.textContent = message; noticeTimer = setTimeout(() => { if (target) target.hidden = true; }, 2800); }

  function mount(target, config = {}) {
    if (!target) return;
    unmount(); host = target; options = config; state = loadState();
    const requested = clean(config.view, 30); if (VIEWS.some((view) => view.id === requested)) state.view = requested;
    render();
    document.addEventListener("visibilitychange", visibilityHandler);
    document.addEventListener("keydown", globalKeydown);
  }
  function globalKeydown(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && root) { event.preventDefault(); root.querySelector("[data-play-search]")?.focus(); } }
  function visibilityHandler() { if (document.hidden) { if (arcade?.running) { arcade.paused = true; cancelAnimationFrame(arcade.raf); updateArcadeStatus("Tự tạm dừng vì tab bị ẩn"); } if (rhythm?.running) { rhythm.running = false; cancelAnimationFrame(rhythm.raf); } } }
  function unmount() { cleanupRuntime(); clearInterval(pomodoroTimer); pomodoroTimer = 0; stopAmbient(); document.removeEventListener("visibilitychange", visibilityHandler); document.removeEventListener("keydown", globalKeydown); if (host) host.replaceChildren(); host = null; root = null; options = {}; }

  window.HHPlay = Object.freeze({ mount, unmount, version: VERSION, views: VIEWS.map((view) => view.id), inspect: () => state ? { version: VERSION, view: state.view, source: "local-device", rooms: state.party.rooms.length, queue: state.watch.queue.length, level: level() } : null });
})();
