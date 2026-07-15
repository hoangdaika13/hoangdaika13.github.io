(() => {
  "use strict";

  const STORAGE_KEY = "hh.astra-explorer.v1";
  const SAVE_VERSION = 1;
  const WORLD = { width: 4400, height: 3200 };
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const pad = (value) => String(Math.floor(Math.abs(value))).padStart(4, "0");
  const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value || 0)));
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const rest = value % 60;
    return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  };
  const hashText = (value) => {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
  const randomFrom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  };
  const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const SECTOR_PREFIXES = ["Nadir", "Lumen", "Aster", "Eos", "Vela", "Orion", "Cygnus", "Lyra", "Helios", "Zenith", "Caelum", "Nova"];
  const SECTOR_SUFFIXES = ["Rift", "Reach", "Drift", "Gate", "Veil", "Expanse", "Horizon", "Echo", "Crown", "Abyss"];
  const PLANET_PREFIXES = ["Kepler", "Aurelia", "Nyx", "Talos", "Ceres", "Ilyra", "Vesper", "Ophira", "Mira", "Solis", "Kaia", "Elara"];
  const PLANET_SUFFIXES = ["Prime", "b", "IV", "Haven", "Ember", "Azure", "Noctis", "Delta", "VII", "Terra"];
  const PLANET_TYPES = [
    { label: "Siêu Trái Đất", colors: ["#d9ffa4", "#4ccf91", "#174863"], note: "Bề mặt đá, tín hiệu nước lỏng và khí quyển giàu nitơ." },
    { label: "Hành tinh đại dương", colors: ["#b8fbff", "#39a9ff", "#173060"], note: "Đại dương toàn cầu phản xạ những dải cực quang điện." },
    { label: "Khổng lồ khí", colors: ["#fff0bb", "#e78558", "#633652"], note: "Các dải mây xoáy chứa hydro kim loại và bão vĩnh cửu." },
    { label: "Thế giới dung nham", colors: ["#fff0a4", "#ff6b3d", "#4b152c"], note: "Biển magma bao phủ bán cầu luôn hướng về ngôi sao." },
    { label: "Hành tinh băng", colors: ["#f3fbff", "#6ad7e7", "#244574"], note: "Lớp băng methane che giấu đại dương sâu hàng trăm kilomet." },
    { label: "Thế giới bóng tối", colors: ["#b59bff", "#51358d", "#15112f"], note: "Một hành tinh lang thang không sao chủ, chỉ sáng bởi sinh vật phát quang." }
  ];
  const ANOMALY_NAMES = ["Vết nứt lượng tử", "Mạch hấp dẫn", "Tàn dư HH-13", "Đám mây phản vật chất", "Cổng thời gian", "Tiếng vọng cổ đại"];
  const BEACON_MESSAGES = [
    "Tín hiệu thứ nhất: Chúng tôi không rời đi. Chúng tôi đã đi vào bên trong ánh sáng.",
    "Tín hiệu thứ hai: Mỗi hành tinh là một ký ức; bản đồ thật nằm trong người quan sát.",
    "Tín hiệu thứ ba: Đừng tin vùng tối không có sao. Nó đang nhìn lại.",
    "Tín hiệu thứ tư: Nguồn phát HH-13 chỉ mở khi bảy tiếng vọng cùng cộng hưởng.",
    "Tín hiệu thứ năm: Người lữ hành cuối cùng đã mang theo tọa độ của Trái Đất.",
    "Tín hiệu thứ sáu: Cánh cổng không dẫn tới nơi khác, mà dẫn tới một thời điểm khác.",
    "Tín hiệu thứ bảy: Hãy lựa chọn: trở về với câu trả lời, hoặc bước qua để trở thành câu hỏi."
  ];
  const RANKS = [
    [0, "Tân binh quỹ đạo"], [1200, "Trinh sát tinh vân"], [3500, "Hoa tiêu liên sao"],
    [8000, "Thợ săn dị thường"], [16000, "Sứ giả thiên hà"], [30000, "Huyền thoại HH-13"]
  ];
  const MISSION_TEMPLATES = [
    { type: "scan", title: "Bản đồ vùng chưa biết", description: "Phát xung scanner và ghi nhận các thiên thể mới.", target: 4, credits: 140, xp: 110, data: 30 },
    { type: "crystal", title: "Nhiên liệu cho bước nhảy", description: "Thu thập tinh thể Aether trôi nổi trong vành đai.", target: 8, credits: 180, xp: 130, data: 18 },
    { type: "planet", title: "Dấu hiệu của sự sống", description: "Tiếp cận và lấy mẫu từ các hành tinh đã quét.", target: 2, credits: 240, xp: 170, data: 55 },
    { type: "beacon", title: "Tiếng vọng HH-13", description: "Giải mã một đài phát cổ đại trong vùng sao.", target: 1, credits: 320, xp: 220, data: 90 },
    { type: "warp", title: "Vượt qua chân trời", description: "Thực hiện bước nhảy warp tới một vùng sao mới.", target: 1, credits: 260, xp: 190, data: 45 }
  ];
  const DAILY_GOALS = [
    { id: "scan", label: "Phát 3 xung quét", target: 3 },
    { id: "crystal", label: "Thu 8 Aether", target: 8 },
    { id: "warp", label: "Hoàn tất 1 bước nhảy", target: 1 }
  ];
  const HAZARDS = [
    { id: "calm", label: "Không gian tĩnh", description: "Điều kiện bay ổn định, cảm biến đạt độ chính xác tối đa.", rgb: "94,233,255", energy: 1, drag: 1, shieldDrain: 0 },
    { id: "ion", label: "Bão ion Lam Vũ", description: "Năng lượng hồi chậm nhưng scanner được khuếch đại bởi trường ion.", rgb: "109,135,255", energy: .7, drag: 1, shieldDrain: .035, scanBonus: 90 },
    { id: "solar", label: "Gió sao đỏ", description: "Dòng hạt tích điện bào mòn khiên; hãy di chuyển có chủ đích.", rgb: "255,105,92", energy: 1.15, drag: 1, shieldDrain: .075 },
    { id: "gravity", label: "Thủy triều hấp dẫn", description: "Không-thời gian đặc quánh làm tàu giảm quán tính nhanh hơn.", rgb: "189,126,255", energy: .95, drag: .972, shieldDrain: 0 },
    { id: "aether", label: "Sương Aether", description: "Tinh thể phát quang dày đặc, lò phản ứng và máy quét cộng hưởng.", rgb: "93,255,188", energy: 1.3, drag: 1, shieldDrain: 0, scanBonus: 45 }
  ];
  const FACTIONS = {
    archive: { name: "Hội Lưu Trữ", short: "KHOA HỌC", color: "#5ee9ff" },
    freelance: { name: "Phi Công Tự Do", short: "CỨU HỘ", color: "#9cff70" },
    echo: { name: "Dàn Hợp Xướng Echo", short: "BÍ ẨN", color: "#ff79bd" }
  };
  const RESEARCH_NODES = [
    { id: "pulse", name: "Xung tiết kiệm", description: "Giảm 2 năng lượng cho mỗi lần quét.", baseCost: 45, max: 3 },
    { id: "astrolabe", name: "Thiên bàn phổ rộng", description: "Tăng 70 đơn vị tầm scanner.", baseCost: 60, max: 3 },
    { id: "refinery", name: "Tinh luyện Aether", description: "Tăng hiệu suất thu hồi tinh thể.", baseCost: 70, max: 3 },
    { id: "nanites", name: "Nanite tự phục hồi", description: "Hồi chậm thân tàu ngoài va chạm.", baseCost: 85, max: 3 },
    { id: "warpCore", name: "Lõi warp gấp nếp", description: "Giảm 3% nhiên liệu cho bước nhảy.", baseCost: 95, max: 3 }
  ];
  const ARTIFACT_BLUEPRINTS = [
    { name: "La bàn bóng ma", effect: "warp", amount: 1, description: "Giảm tiêu hao nhiên liệu warp." },
    { name: "Lăng kính sao", effect: "score", amount: .04, description: "Tăng điểm cho mọi khám phá mới." },
    { name: "Vỏ cộng hưởng Echo", effect: "energy", amount: .45, description: "Tăng tốc độ hồi năng lượng." },
    { name: "Thấu kính Kepler", effect: "scanner", amount: 24, description: "Mở rộng trường quét thiên văn." },
    { name: "Mảnh giáp Odyssey", effect: "shield", amount: 4, description: "Tăng dung lượng khiên tối đa." },
    { name: "Hạt giống Aether", effect: "refinery", amount: .06, description: "Tăng xác suất tinh luyện thêm Aether." }
  ];

  const defaultState = () => ({
    version: SAVE_VERSION,
    sector: 0,
    score: 0,
    level: 1,
    xp: 0,
    credits: 240,
    crystals: 0,
    research: 0,
    ship: { x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2, fuel: 100, hull: 100, shield: 100, energy: 100 },
    upgrades: { engine: 1, scanner: 1, shield: 1, reactor: 1 },
    discoveries: [],
    collected: [],
    sampled: [],
    beacons: [],
    decoded: [],
    artifacts: [],
    achievements: [],
    mission: { cycle: 0, type: "scan", progress: 0 },
    daily: { date: localDateKey(), scan: 0, crystal: 0, warp: 0, claimed: false },
    streak: { count: 0, multiplier: 1, expiresAt: 0 },
    reputation: { archive: 0, freelance: 0, echo: 0 },
    researchNodes: { pulse: 0, astrolabe: 0, refinery: 0, nanites: 0, warpCore: 0 },
    stats: { scans: 0, distance: 0, sectors: 1, discoveries: 0, crystals: 0, artifacts: 0, encounters: 0, decodeWins: 0, playSeconds: 0 },
    logs: [{ time: Date.now(), text: "Tàu thám hiểm Asteria đã sẵn sàng tại Trạm HH." }],
    settings: { sound: true, reducedEffects: false, quality: "auto", calmReminder: true }
  });

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      ship: { ...base.ship, ...(raw.ship || {}) },
      upgrades: { ...base.upgrades, ...(raw.upgrades || {}) },
      mission: { ...base.mission, ...(raw.mission || {}) },
      daily: raw.daily?.date === localDateKey() ? { ...base.daily, ...raw.daily } : base.daily,
      streak: { ...base.streak, ...(raw.streak || {}), expiresAt: 0 },
      reputation: { ...base.reputation, ...(raw.reputation || {}) },
      researchNodes: { ...base.researchNodes, ...(raw.researchNodes || {}) },
      stats: { ...base.stats, ...(raw.stats || {}) },
      settings: { ...base.settings, ...(raw.settings || {}) },
      discoveries: Array.isArray(raw.discoveries) ? raw.discoveries.slice(-800) : [],
      collected: Array.isArray(raw.collected) ? raw.collected.slice(-1200) : [],
      sampled: Array.isArray(raw.sampled) ? raw.sampled.slice(-500) : [],
      beacons: Array.isArray(raw.beacons) ? raw.beacons.slice(-30) : [],
      decoded: Array.isArray(raw.decoded) ? raw.decoded.slice(-120) : [],
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(-24) : [],
      achievements: Array.isArray(raw.achievements) ? raw.achievements.slice(-40) : [],
      logs: Array.isArray(raw.logs) && raw.logs.length ? raw.logs.slice(0, 12) : base.logs
    };
  }

  function gameMarkup(hasProgress) {
    return `
      <section class="astra-game" data-astra-game tabindex="0" aria-label="ASTRA HH - game khám phá vũ trụ">
        <header class="astra-topbar">
          <div class="astra-brand"><span class="astra-brand__mark">AH</span><div><strong>ASTRA HH: Tín Hiệu Vô Tận</strong><small>Deep space expedition</small></div><span class="astra-live"><i></i> Online</span></div>
          <div class="astra-sector"><div><small>Vùng sao hiện tại</small><strong data-sector-name>Đang giải mã...</strong></div><span class="astra-hazard-chip" data-hazard-name>Không gian tĩnh</span><span class="astra-sector-coordinates" data-coordinates>X 0000 · Y 0000</span></div>
          <div class="astra-top-actions">
            <button class="astra-text-button" type="button" data-modal-open="guide">Hướng dẫn</button>
            <button class="astra-text-button" type="button" data-open-leaderboard>Bảng xếp hạng</button>
            <button class="astra-icon-button" type="button" data-action="photo" aria-label="Chụp ảnh không gian" title="Chế độ ảnh">◉</button>
            <button class="astra-icon-button is-active" type="button" data-action="sound" aria-label="Bật hoặc tắt âm thanh" title="Âm thanh">♪</button>
            <button class="astra-icon-button" type="button" data-action="fullscreen" aria-label="Toàn màn hình" title="Toàn màn hình">□</button>
            <button class="astra-icon-button" type="button" data-action="pause" aria-label="Tạm dừng" title="Tạm dừng">Ⅱ</button>
          </div>
        </header>

        <div class="astra-playfield">
          <aside class="astra-panel astra-panel--left" aria-label="Nhiệm vụ và hệ thống tàu">
            <section class="astra-panel-section">
              <header class="astra-card-head"><div><span class="astra-eyebrow">Nhiệm vụ hiện tại</span><h2 data-mission-title>Bản đồ vùng chưa biết</h2></div><b data-mission-count>0/4</b></header>
              <p class="astra-mission-copy" data-mission-description>Quét các tín hiệu chưa xác định.</p>
              <div class="astra-progress" data-mission-progress style="--progress:0%"><i></i></div>
              <div class="astra-mission-meta"><span>Phần thưởng</span><strong data-mission-reward>140 CR · 110 XP</strong></div>
            </section>
            <section class="astra-panel-section astra-daily">
              <header class="astra-card-head"><div><span class="astra-eyebrow">Expedition mỗi ngày</span><h3>Nhịp sao hôm nay</h3></div><b data-daily-status>0/3</b></header>
              <div class="astra-daily-goals" data-daily-goals></div>
              <p data-daily-reward>Hoàn tất cả ba: 350 CR · 80 DB · 1 cổ vật</p>
            </section>
            <section class="astra-panel-section">
              <header class="astra-card-head"><div><span class="astra-eyebrow">Asteria MK-I</span><h3>Hệ thống tàu</h3></div><b data-rank>Tân binh</b></header>
              <div class="astra-meters">
                <div class="astra-meter" data-meter="hull"><div class="astra-meter__label"><span>Thân tàu</span><strong>100%</strong></div><i><b style="--meter-color:#9cff70"></b></i></div>
                <div class="astra-meter" data-meter="shield"><div class="astra-meter__label"><span>Khiên</span><strong>100%</strong></div><i><b style="--meter-color:#5ee9ff"></b></i></div>
                <div class="astra-meter" data-meter="fuel"><div class="astra-meter__label"><span>Nhiên liệu</span><strong>100%</strong></div><i><b style="--meter-color:#ffc857"></b></i></div>
                <div class="astra-meter" data-meter="energy"><div class="astra-meter__label"><span>Năng lượng</span><strong>100%</strong></div><i><b style="--meter-color:#a984ff"></b></i></div>
              </div>
            </section>
            <section class="astra-panel-section">
              <header class="astra-card-head"><div><span class="astra-eyebrow">Khoang nhiệm vụ</span><h3>Tài nguyên</h3></div><b data-level>LV.1</b></header>
              <div class="astra-resources">
                <div class="astra-resource"><i>CR</i><div><small>Tín dụng</small><strong data-credits>240</strong></div></div>
                <div class="astra-resource"><i>◆</i><div><small>Aether</small><strong data-crystals>0</strong></div></div>
                <div class="astra-resource"><i>DB</i><div><small>Dữ liệu</small><strong data-research>0</strong></div></div>
                <div class="astra-resource"><i>XP</i><div><small>Kinh nghiệm</small><strong data-xp>0</strong></div></div>
              </div>
            </section>
            <section class="astra-panel-section">
              <header class="astra-card-head"><div><span class="astra-eyebrow">Nhật ký tàu</span><h3>Hoạt động gần đây</h3></div></header>
              <ul class="astra-log" data-log></ul>
            </section>
          </aside>

          <main class="astra-stage" data-astra-stage>
            <canvas data-astra-canvas aria-label="Không gian điều khiển tàu Asteria"></canvas>
            <div class="astra-vignette" aria-hidden="true"></div><div class="astra-crosshair" aria-hidden="true"></div>
            <div class="astra-flight-hud"><div class="astra-hud-left"><span class="astra-flight-mode" data-flight-mode>FLIGHT · CRUISE</span><span class="astra-streak" data-streak hidden>CHUỖI 1 · x1.0</span></div><div class="astra-flight-stats"><span>TỐC ĐỘ<strong data-speed>0 u/s</strong></span><span>HƯỚNG<strong data-heading>000°</strong></span></div></div>
            <section class="astra-target-card" data-target-card hidden><small data-target-type>Mục tiêu</small><strong data-target-name>Chưa có mục tiêu</strong><div class="astra-target__distance"><span data-target-note>Phát xung quét để nhận diện</span><b data-target-distance>-- u</b></div></section>
            <div class="astra-minimap"><canvas data-astra-minimap aria-label="Bản đồ vùng sao"></canvas><span>Nav-map</span></div>
            <div class="astra-controls" aria-label="Điều khiển tàu">
              <div class="astra-flight-controls"><button class="astra-control-button" type="button" data-hold="left">A<kbd>XOAY TRÁI</kbd></button><button class="astra-control-button" type="button" data-hold="thrust">W<kbd>TĂNG TỐC</kbd></button><button class="astra-control-button" type="button" data-hold="brake">S<kbd>PHANH</kbd></button><button class="astra-control-button" type="button" data-hold="right">D<kbd>XOAY PHẢI</kbd></button></div>
              <div class="astra-mobile-pad"><button class="astra-control-button" type="button" data-hold="left">◀</button><button class="astra-control-button" type="button" data-hold="thrust">▲</button><button class="astra-control-button" type="button" data-hold="right">▶</button></div>
              <div class="astra-action-controls"><button class="astra-control-button astra-control-button--primary" type="button" data-action="scan">QUÉT<kbd>SPACE</kbd></button><button class="astra-control-button" type="button" data-action="interact">TƯƠNG TÁC<kbd>E</kbd></button><button class="astra-control-button" type="button" data-action="autopilot">AUTO<kbd>Q</kbd></button><button class="astra-control-button" type="button" data-modal-open="map">BẢN ĐỒ<kbd>M</kbd></button><button class="astra-control-button astra-control-button--warp" type="button" data-action="warp">WARP<kbd data-warp-cost>25% FUEL</kbd></button></div>
            </div>

            <section class="astra-intro" data-intro>
              <div class="astra-intro__content">
                <div class="astra-intro__visual"><span class="astra-intro__planet"></span><span class="astra-intro__ship">➤</span></div>
                <div class="astra-intro__body"><span>Năm 2189 · Nhiệm vụ Asteria</span><h1>ASTRA HH<br><em>Tín Hiệu Vô Tận</em></h1><p>Một xung vô tuyến mang mã HH-13 vừa thức tỉnh sau 700 năm im lặng. Lái tàu Asteria qua những thế giới chưa ai đặt tên, giải mã các bài hát vũ trụ và quyết định tương lai của ba phe đang truy tìm bảy đài phát cổ đại.</p><div class="astra-intro__facts"><span><strong>Vũ trụ biến đổi</strong>Hiểm họa và sự kiện khác nhau</span><span><strong>Khám phá có chiều sâu</strong>Cổ vật, phe phái, nghiên cứu</span><span><strong>Thành tích online</strong>Đồng bộ điểm với tài khoản HH</span></div><div class="astra-intro__actions"><button class="astra-primary-button" type="button" data-start-game>${hasProgress ? "Tiếp tục hành trình" : "Khởi động Asteria"}</button><button class="astra-secondary-button" type="button" data-modal-open="guide">Cách chơi</button></div></div>
              </div>
            </section>

            <section class="astra-modal" data-modal="guide" hidden><div class="astra-modal__content"><header class="astra-modal__head"><div><span class="astra-eyebrow">Flight manual</span><h2>Cẩm nang phi công</h2></div><button type="button" data-modal-close aria-label="Đóng">×</button></header><div class="astra-guide-grid"><article><span>01 · DI CHUYỂN</span><strong>WASD / phím mũi tên</strong><p>W tăng tốc, A/D đổi hướng, S phanh. Giữ Shift để boost; Q bật autopilot tới mục tiêu.</p></article><article><span>02 · KHÁM PHÁ</span><strong>Space để phát xung quét</strong><p>Khám phá liên tiếp tạo chuỗi điểm. Hiểm họa từng vùng làm thay đổi scanner và hệ thống tàu.</p></article><article><span>03 · TƯƠNG TÁC</span><strong>E khi ở gần mục tiêu</strong><p>Lấy mẫu hành tinh, giải dạng sóng Echo, nghe dữ liệu thiên thể hoặc thu hồi cổ vật.</p></article><article><span>04 · TIẾN TRÌNH</span><strong>Lab và ba phe phái</strong><p>Dùng dữ liệu mở cây nghiên cứu; lựa chọn của bạn thay đổi uy tín với từng phe.</p></article><article><span>05 · WARP</span><strong>Chi phí giảm theo công nghệ</strong><p>Đi tới vùng sao kế tiếp để gặp sự kiện hiếm, hiểm họa mới và những mảnh truyện HH-13.</p></article><article><span>06 · DỮ LIỆU</span><strong>Tự động lưu trên thiết bị</strong><p>Điểm cao được đồng bộ an toàn với tài khoản HH khi backend khả dụng.</p></article></div></div></section>
            <section class="astra-modal" data-modal="map" hidden><div class="astra-modal__content"><header class="astra-modal__head"><div><span class="astra-eyebrow">Galactic navigation</span><h2>Bản đồ hành trình</h2></div><button type="button" data-modal-close aria-label="Đóng">×</button></header><div class="astra-map-grid" data-map-grid></div><button class="astra-primary-button" type="button" data-action="warp">Warp tới vùng kế tiếp · 25% nhiên liệu</button></div></section>
            <section class="astra-modal" data-modal="decode" hidden><div class="astra-modal__content astra-decode-modal"><header class="astra-modal__head"><div><span class="astra-eyebrow">Echo signal lab</span><h2>Giải mã tín hiệu HH-13</h2></div><button type="button" data-modal-close aria-label="Đóng">×</button></header><p class="astra-modal-copy">Chạm từng bộ cộng hưởng để khớp dạng sóng mục tiêu. Mỗi lần thử sai tiêu hao 4 năng lượng.</p><div class="astra-wave-target" data-decode-target></div><div class="astra-wave-controls" data-decode-controls></div><p class="astra-decode-feedback" data-decode-feedback>Đồng bộ bốn tần số để mở khóa dữ liệu.</p><button class="astra-primary-button" type="button" data-decode-submit>GIẢI MÃ TÍN HIỆU</button></div></section>
            <section class="astra-modal" data-modal="encounter" hidden><div class="astra-modal__content astra-encounter-modal"><header class="astra-modal__head"><div><span class="astra-eyebrow">Deep-space encounter</span><h2 data-encounter-title>Sự kiện vùng sâu</h2></div><button type="button" data-modal-close aria-label="Đóng">×</button></header><div class="astra-encounter-visual" data-encounter-visual>◇</div><p class="astra-modal-copy" data-encounter-copy></p><div class="astra-encounter-choices" data-encounter-choices></div></div></section>
          </main>

          <aside class="astra-panel astra-panel--right" aria-label="Máy quét, nâng cấp và nhật ký khám phá">
            <nav class="astra-tabbar" aria-label="Bảng điều khiển"><button class="is-active" type="button" data-tab="scanner">Scanner</button><button type="button" data-tab="ship">Tàu</button><button type="button" data-tab="lab">Lab</button><button type="button" data-tab="codex">Codex</button><button type="button" data-tab="ranking">Hạng</button></nav>
            <section class="astra-pane is-active" data-pane="scanner"><div class="astra-scanner-visual"><span class="astra-scanner-sweep"></span><i class="astra-scanner-center"></i></div><div class="astra-target-info" data-target-info><div><small>Không có mục tiêu</small><strong>Phát xung quét</strong><p>Scanner sẽ phân tích các vật thể trong vùng lân cận.</p></div></div></section>
            <section class="astra-pane" data-pane="ship"><header class="astra-card-head"><div><span class="astra-eyebrow">Shipyard</span><h3>Nâng cấp Asteria</h3></div><b data-ship-power>4 MOD</b></header><div class="astra-upgrades">${[["engine", "Động cơ Vector", "Tốc độ và gia tốc"], ["scanner", "Scanner Lượng tử", "Tầm quét và hồi chiêu"], ["shield", "Khiên Plasma", "Sức chịu va chạm"], ["reactor", "Lò phản ứng", "Dung lượng năng lượng"]].map(([id, name, description]) => `<article class="astra-upgrade"><span><strong>${name} · MK-<b data-upgrade-level="${id}">1</b></strong><small>${description}</small></span><button type="button" data-upgrade="${id}">120 CR</button></article>`).join("")}</div><div class="astra-service-actions"><button type="button" data-service="repair">Sửa thân tàu · 45 CR</button><button type="button" data-service="refuel">Nạp nhiên liệu · 5 ◆</button></div><label class="astra-quality"><span>Chất lượng đồ họa</span><select data-quality><option value="auto">Tự động 60 FPS</option><option value="ultra">Cực đẹp</option><option value="eco">Tiết kiệm</option></select></label></section>
            <section class="astra-pane" data-pane="lab"><header class="astra-card-head"><div><span class="astra-eyebrow">Research & factions</span><h3>Phòng nghiên cứu</h3></div><b data-artifact-count>0 ART</b></header><div class="astra-factions" data-factions></div><h4 class="astra-pane-title">Cây công nghệ</h4><div class="astra-research-tree" data-research-tree></div><h4 class="astra-pane-title">Kho cổ vật</h4><div class="astra-artifacts" data-artifacts></div></section>
            <section class="astra-pane" data-pane="codex"><header class="astra-card-head"><div><span class="astra-eyebrow">Discovery archive</span><h3>Nhật ký thiên hà</h3></div><b data-discovery-count>0</b></header><div class="astra-codex" data-codex></div></section>
            <section class="astra-pane" data-pane="ranking"><header class="astra-card-head"><div><span class="astra-eyebrow">Online pilots</span><h3>Bảng xếp hạng</h3></div><button class="astra-icon-button" type="button" data-refresh-ranking title="Làm mới">↻</button></header><p class="astra-online-status" data-online-status>Đang kết nối trạm chỉ huy...</p><ol class="astra-leaderboard" data-leaderboard></ol></section>
          </aside>
        </div>

        <footer class="astra-statusbar"><div><strong data-save-status>ĐÃ LƯU CỤC BỘ</strong><span data-session-time>00:00</span><span data-sector-progress>0 thiên thể đã nhận diện</span><span data-fps>60 FPS</span><span data-hazard-status>Không gian tĩnh</span></div><div><span>WASD Lái tàu</span><span>Q Autopilot</span><span>SPACE Quét</span><span>E Tương tác</span><span>M Bản đồ</span><span>P Tạm dừng</span></div></footer>
        <div class="astra-toast" data-toast role="status" aria-live="polite"></div>
      </section>`;
  }

  class AstraExplorer {
    constructor(host, options = {}) {
      this.host = host;
      this.apiBase = String(options.apiBase || window.HH_REALTIME_URL || "").replace(/\/$/, "");
      this.state = this.load();
      this.discovered = new Set(this.state.discoveries);
      this.collected = new Set(this.state.collected);
      this.sampled = new Set(this.state.sampled);
      this.decoded = new Set(this.state.decoded);
      this.input = { left: false, right: false, thrust: false, brake: false, boost: false };
      this.selectedId = "";
      this.objects = [];
      this.stars = [];
      this.trail = [];
      this.autopilot = false;
      this.autopilotThrust = false;
      this.pendingDecode = null;
      this.currentEncounter = null;
      this.running = false;
      this.paused = true;
      this.destroyed = false;
      this.zoom = 1;
      this.scanCooldown = 0;
      this.scanPulse = null;
      this.lastFrame = performance.now();
      this.lastUi = 0;
      this.lastSave = 0;
      this.lastSync = 0;
      this.damageCooldown = 0;
      this.lastTrailAt = 0;
      this.currentFps = 60;
      this.fpsFrames = 0;
      this.fpsWindowStarted = performance.now();
      this.adaptiveReduced = false;
      this.nextCalmReminder = (Math.floor(this.state.stats.playSeconds / 2700) + 1) * 2700;
      this.uiCache = Object.create(null);
      this.toastTimer = 0;
      this.cleanupTasks = [];
      this.timeouts = [];
      this.audioContext = null;
      this.host.innerHTML = gameMarkup(this.state.score > 0 || this.state.stats.playSeconds > 30);
      this.root = this.host.querySelector("[data-astra-game]");
      this.canvas = this.root.querySelector("[data-astra-canvas]");
      this.context = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
      this.minimap = this.root.querySelector("[data-astra-minimap]");
      this.minimapContext = this.minimap.getContext("2d");
      this.generateSector();
      this.bind();
      this.resize();
      this.updateUi(true);
      this.loadLeaderboard();
      this.frame = requestAnimationFrame((time) => this.loop(time));
    }

    load() {
      try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
      catch { return defaultState(); }
    }

    save({ sync = false } = {}) {
      this.state.version = SAVE_VERSION;
      this.state.discoveries = [...this.discovered].slice(-800);
      this.state.collected = [...this.collected].slice(-1200);
      this.state.sampled = [...this.sampled].slice(-500);
      this.state.decoded = [...this.decoded].slice(-120);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.lastSave = performance.now();
      const status = this.root?.querySelector("[data-save-status]");
      if (status) status.textContent = `ĐÃ LƯU · ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
      if (sync) this.syncScore();
    }

    listen(target, type, handler, options) {
      target?.addEventListener(type, handler, options);
      this.cleanupTasks.push(() => target?.removeEventListener(type, handler, options));
    }

    bind() {
      const keyMap = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "thrust", ArrowUp: "thrust", KeyS: "brake", ArrowDown: "brake" };
      this.listen(window, "keydown", (event) => {
        if (!this.root.isConnected || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)) return;
        if (keyMap[event.code]) { this.input[keyMap[event.code]] = true; event.preventDefault(); }
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.input.boost = true;
        if (event.repeat) return;
        if (event.code === "Space") { event.preventDefault(); this.scan(); }
        if (event.code === "KeyE") this.interact();
        if (event.code === "KeyQ") this.toggleAutopilot();
        if (event.code === "KeyM") this.openModal("map");
        if (event.code === "KeyF") this.capturePhoto();
        if (event.code === "KeyP") this.togglePause();
        if (event.code === "Escape") {
          if (this.root.querySelector("[data-modal]:not([hidden])")) this.closeModals();
          else this.togglePause();
        }
      });
      this.listen(window, "keyup", (event) => {
        if (keyMap[event.code]) this.input[keyMap[event.code]] = false;
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.input.boost = false;
      });
      this.listen(window, "blur", () => Object.keys(this.input).forEach((key) => { this.input[key] = false; }));
      this.listen(document, "visibilitychange", () => {
        if (document.hidden) { this.save(); this.paused = true; }
      });
      this.listen(window, "resize", () => this.resize(), { passive: true });

      this.root.querySelectorAll("[data-hold]").forEach((button) => {
        const start = (event) => { event.preventDefault(); this.input[button.dataset.hold] = true; button.classList.add("is-pressed"); this.root.focus({ preventScroll: true }); };
        const stop = () => { this.input[button.dataset.hold] = false; button.classList.remove("is-pressed"); };
        this.listen(button, "pointerdown", start);
        this.listen(button, "pointerup", stop);
        this.listen(button, "pointercancel", stop);
        this.listen(button, "pointerleave", stop);
      });

      this.listen(this.root, "click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "scan") this.scan();
        if (action === "interact") this.interact();
        if (action === "warp") this.warp();
        if (action === "pause") this.togglePause();
        if (action === "sound") this.toggleSound();
        if (action === "fullscreen") this.toggleFullscreen();
        if (action === "autopilot") this.toggleAutopilot();
        if (action === "photo") this.capturePhoto();
        if (action === "sonify") this.sonifyTarget();
        if (action === "decode") this.startDecode(this.selectedTarget());
        const start = event.target.closest("[data-start-game]");
        if (start) this.start();
        const modal = event.target.closest("[data-modal-open]");
        if (modal) this.openModal(modal.dataset.modalOpen);
        if (event.target.closest("[data-modal-close]")) this.closeModals();
        const tab = event.target.closest("[data-tab]");
        if (tab) this.openTab(tab.dataset.tab);
        const upgrade = event.target.closest("[data-upgrade]");
        if (upgrade) this.upgrade(upgrade.dataset.upgrade);
        const service = event.target.closest("[data-service]");
        if (service) this.service(service.dataset.service);
        const research = event.target.closest("[data-research-node]");
        if (research) this.unlockResearch(research.dataset.researchNode);
        const decodeSlot = event.target.closest("[data-decode-slot]");
        if (decodeSlot) this.cycleDecode(Number(decodeSlot.dataset.decodeSlot));
        if (event.target.closest("[data-decode-submit]")) this.submitDecode();
        const encounterChoice = event.target.closest("[data-encounter-choice]");
        if (encounterChoice) this.chooseEncounter(encounterChoice.dataset.encounterChoice);
        if (event.target.closest("[data-open-leaderboard]")) this.openTab("ranking");
        if (event.target.closest("[data-refresh-ranking]")) this.loadLeaderboard(true);
      });

      this.listen(this.root, "change", (event) => {
        const quality = event.target.closest("[data-quality]");
        if (quality) this.setQuality(quality.value);
      });

      this.listen(this.canvas, "wheel", (event) => {
        event.preventDefault();
        this.zoom = clamp(this.zoom + (event.deltaY > 0 ? -.08 : .08), .68, 1.32);
      }, { passive: false });
      this.listen(this.canvas, "pointerdown", (event) => {
        this.root.focus({ preventScroll: true });
        const rect = this.canvas.getBoundingClientRect();
        const worldX = this.state.ship.x + (event.clientX - rect.left - rect.width / 2) / this.zoom;
        const worldY = this.state.ship.y + (event.clientY - rect.top - rect.height / 2) / this.zoom;
        const match = this.objects.filter((item) => item.type !== "asteroid" && item.type !== "crystal" && this.discovered.has(item.id)).sort((a, b) => Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY))[0];
        if (match && Math.hypot(match.x - worldX, match.y - worldY) < match.radius + 34) { this.selectedId = match.id; this.updateUi(true); }
      });

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.root.querySelector("[data-astra-stage]"));
      this.cleanupTasks.push(() => this.resizeObserver.disconnect());
    }

    start() {
      this.root.querySelector("[data-intro]").hidden = true;
      this.closeModals();
      this.running = true;
      this.paused = false;
      this.root.focus({ preventScroll: true });
      if (this.state.settings.sound) this.ensureAudio();
      this.tone(420, .07, "sine", .035);
      this.tone(680, .12, "triangle", .025, .08);
      this.notify("Asteria đã rời bến. Chúc phi công một hành trình an toàn.");
    }

    togglePause() {
      if (!this.running) return this.start();
      this.paused = !this.paused;
      const button = this.root.querySelector('[data-action="pause"]');
      if (button) button.textContent = this.paused ? "▶" : "Ⅱ";
      this.notify(this.paused ? "Đã tạm dừng chuyến bay." : "Tiếp tục hành trình.");
    }

    toggleSound() {
      this.state.settings.sound = !this.state.settings.sound;
      const button = this.root.querySelector('[data-action="sound"]');
      button?.classList.toggle("is-active", this.state.settings.sound);
      if (this.state.settings.sound) { this.ensureAudio(); this.tone(620, .1, "sine", .035); }
      this.save();
      this.notify(this.state.settings.sound ? "Âm thanh đã bật." : "Âm thanh đã tắt.");
    }

    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else this.root.requestFullscreen?.().catch(() => this.notify("Trình duyệt không cho phép toàn màn hình.", true));
    }

    ensureAudio() {
      if (this.audioContext) return this.audioContext;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.audioContext = new AudioContext();
      return this.audioContext;
    }

    tone(frequency, duration = .1, type = "sine", gain = .025, delay = 0) {
      if (!this.state.settings.sound) return;
      const context = this.ensureAudio();
      if (!context) return;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
      volume.gain.setValueAtTime(.0001, context.currentTime + delay);
      volume.gain.exponentialRampToValueAtTime(gain, context.currentTime + delay + .012);
      volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + delay + duration);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration + .02);
    }

    getSectorSeed() {
      const date = new Date();
      const daySeed = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      return hashText(`HH-13:${daySeed}:${this.state.sector}`);
    }

    generateSector() {
      const random = randomFrom(this.getSectorSeed());
      const code = 1300 + this.state.sector * 17 + Math.floor(random() * 13);
      this.sectorName = `${pick(SECTOR_PREFIXES, random)} ${pick(SECTOR_SUFFIXES, random)} · ${code}`;
      this.hazard = pick(this.state.sector === 0 ? [HAZARDS[0], HAZARDS[0], HAZARDS[4]] : [...HAZARDS, HAZARDS[0]], random);
      this.objects = [];
      const starCount = this.state.settings.quality === "eco" ? 110 : this.state.settings.quality === "ultra" ? 245 : 180;
      this.stars = Array.from({ length: starCount }, () => ({ x: random(), y: random(), size: .35 + random() * 1.65, depth: .15 + random() * .85, hue: pick([188, 205, 226, 38, 282, 330], random) }));
      const point = (minimum = 260) => {
        let x;
        let y;
        do { x = (random() - .5) * (WORLD.width - 260); y = (random() - .5) * (WORLD.height - 260); }
        while (Math.hypot(x, y) < minimum);
        return { x, y };
      };
      const makeId = (type, index) => `${this.state.sector}:${type}:${index}`;
      const sunPoint = point(850);
      this.objects.push({ id: makeId("star", 0), type: "star", ...sunPoint, radius: 78 + random() * 42, name: `${pick(SECTOR_PREFIXES, random)}-${Math.floor(random() * 900)}`, color: pick(["#ffd27a", "#8eeaff", "#ff8c8c", "#c6a3ff"], random), discovered: true });
      for (let index = 0; index < 6; index += 1) {
        const planetType = pick(PLANET_TYPES, random);
        this.objects.push({ id: makeId("planet", index), type: "planet", ...point(420), radius: 30 + random() * 38, orbitalPeriod: 4 + random() * 520, temperature: -170 + random() * 680, name: `${pick(PLANET_PREFIXES, random)} ${pick(PLANET_SUFFIXES, random)}`, subtype: planetType.label, note: planetType.note, colors: planetType.colors, ring: random() > .63, phase: random() * TAU });
      }
      for (let index = 0; index < 5; index += 1) this.objects.push({ id: makeId("anomaly", index), type: "anomaly", ...point(360), radius: 23 + random() * 13, name: pick(ANOMALY_NAMES, random), subtype: "Dị thường không gian", note: "Cấu trúc năng lượng không tuân theo các mô hình vật lý đã biết.", phase: random() * TAU });
      for (let index = 0; index < 2; index += 1) this.objects.push({ id: makeId("beacon", index), type: "beacon", ...point(520), radius: 21, name: `Đài phát Echo-${String(this.state.sector * 2 + index + 1).padStart(2, "0")}`, subtype: "Di tích HH-13", note: "Một cấu trúc cổ đang phát xung ở tần số giống nhịp tim con người.", phase: random() * TAU });
      for (let index = 0; index < 3; index += 1) this.objects.push({ id: makeId("wreck", index), type: "wreck", ...point(360), radius: 18, name: `Tàu đắm ${pick(["Nomad", "Pioneer", "Kestrel", "Odyssey"], random)}-${Math.floor(random() * 99)}`, subtype: "Tín hiệu cứu hộ", note: "Con tàu không còn dấu hiệu sự sống nhưng khoang hàng vẫn nguyên vẹn.", phase: random() * TAU });
      for (let index = 0; index < 30; index += 1) this.objects.push({ id: makeId("crystal", index), type: "crystal", ...point(120), radius: 7 + random() * 4, phase: random() * TAU });
      for (let index = 0; index < 52; index += 1) this.objects.push({ id: makeId("asteroid", index), type: "asteroid", ...point(120), radius: 8 + random() * 17, vertices: 6 + Math.floor(random() * 4), phase: random() * TAU, spin: (random() - .5) * .3 });
      const tutorialSignals = [
        ["planet", 0, 330, -250],
        ["anomaly", 0, -280, -220],
        ["wreck", 0, 80, -430],
        ["beacon", 0, 860, 280]
      ];
      tutorialSignals.forEach(([type, index, x, y]) => {
        const item = this.objects.find((object) => object.id === makeId(type, index));
        if (item) { item.x = x; item.y = y; }
      });
      this.objects.filter((item) => item.type === "crystal").slice(0, 6).forEach((item, index) => {
        item.x = (index % 2 ? 26 : -26) + (index - 2) * 7;
        item.y = -100 - index * 74;
      });
      this.objects.filter((item) => item.type === "asteroid" && item.y < 80 && item.y > -560 && Math.abs(item.x) < 130).forEach((item) => { item.x += item.x < 0 ? -190 : 190; });
      this.selectedId = "";
      this.autopilot = false;
      this.autopilotThrust = false;
      this.trail.length = 0;
      this.buildBackground();
      this.updateUi(true);
    }

    buildBackground() {
      if (!this.viewWidth || !this.viewHeight) return;
      this.background = document.createElement("canvas");
      this.background.width = Math.max(1, Math.round(this.viewWidth));
      this.background.height = Math.max(1, Math.round(this.viewHeight));
      const context = this.background.getContext("2d");
      const base = context.createLinearGradient(0, 0, this.viewWidth, this.viewHeight);
      base.addColorStop(0, "#02040b"); base.addColorStop(.5, "#06101c"); base.addColorStop(1, "#02050d");
      context.fillStyle = base; context.fillRect(0, 0, this.viewWidth, this.viewHeight);
      const random = randomFrom(this.getSectorSeed() ^ 0x95f1);
      const nebula = [this.hazard?.rgb || "94,233,255", "94,233,255", "255,95,166", "169,132,255", "255,200,87"];
      for (let index = 0; index < 14; index += 1) {
        const x = random() * this.viewWidth;
        const y = random() * this.viewHeight;
        const radius = 90 + random() * Math.max(this.viewWidth, this.viewHeight) * .36;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${pick(nebula, random)},${.018 + random() * .035})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient; context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      if (this.hazard?.id !== "calm") {
        const wash = context.createLinearGradient(0, 0, this.viewWidth, this.viewHeight);
        wash.addColorStop(0, `rgba(${this.hazard.rgb},.045)`);
        wash.addColorStop(.5, "rgba(0,0,0,0)");
        wash.addColorStop(1, `rgba(${this.hazard.rgb},.025)`);
        context.fillStyle = wash;
        context.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }

    resize() {
      if (!this.canvas?.isConnected) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(420, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.viewWidth = width; this.viewHeight = height; this.dpr = dpr;
        this.buildBackground();
      }
    }

    missionTemplate() {
      const cycle = Math.max(0, Number(this.state.mission.cycle || 0));
      return MISSION_TEMPLATES[cycle % MISSION_TEMPLATES.length];
    }

    rank() {
      return RANKS.reduce((label, [score, name]) => this.state.score >= score ? name : label, RANKS[0][1]);
    }

    researchLevel(id) { return Number(this.state.researchNodes[id] || 0); }
    artifactBonus(effect) { return this.state.artifacts.reduce((sum, item) => sum + (item.effect === effect ? Number(item.amount || 0) : 0), 0); }
    maxShield() { return 100 + (this.state.upgrades.shield - 1) * 18 + this.artifactBonus("shield"); }
    maxEnergy() { return 100 + (this.state.upgrades.reactor - 1) * 22; }
    maxSpeed() { return 245 + this.state.upgrades.engine * 42; }
    scanRange() { return 390 + this.state.upgrades.scanner * 95 + this.researchLevel("astrolabe") * 70 + this.artifactBonus("scanner") + Number(this.hazard?.scanBonus || 0); }
    scanEnergyCost() { return Math.max(8, 18 - this.researchLevel("pulse") * 2); }
    warpCost() { return Math.max(10, Math.round(25 - this.researchLevel("warpCore") * 3 - this.artifactBonus("warp"))); }

    addScore(amount, useStreak = false) {
      const streakMultiplier = useStreak ? Number(this.state.streak.multiplier || 1) : 1;
      const artifactMultiplier = 1 + Math.min(.4, this.artifactBonus("score"));
      const total = Math.max(0, Math.round(Number(amount || 0) * streakMultiplier * artifactMultiplier));
      this.state.score += total;
      return total;
    }

    bumpStreak() {
      const now = performance.now();
      const streak = this.state.streak;
      streak.count = now < streak.expiresAt ? streak.count + 1 : 1;
      streak.multiplier = 1 + Math.min(2, Math.floor(streak.count / 3) * .25);
      streak.expiresAt = now + 12000;
    }

    dailyProgress(type, amount = 1) {
      if (this.state.daily.date !== localDateKey()) this.state.daily = { ...defaultState().daily };
      if (!DAILY_GOALS.some((goal) => goal.id === type)) return;
      this.state.daily[type] = Math.max(0, Number(this.state.daily[type] || 0) + amount);
      const complete = DAILY_GOALS.every((goal) => this.state.daily[goal.id] >= goal.target);
      if (!complete || this.state.daily.claimed) return;
      this.state.daily.claimed = true;
      this.state.credits += 350;
      this.state.research += 80;
      this.state.xp += 180;
      this.addScore(600);
      this.grantArtifact("Expedition hằng ngày");
      this.levelUp();
      this.log("Hoàn tất Expedition hằng ngày: Nhịp sao hôm nay.");
      this.notify("Expedition hoàn tất · +350 CR · +80 DB · cổ vật mới");
    }

    addReputation(faction, amount) {
      if (!Object.hasOwn(FACTIONS, faction)) return;
      this.state.reputation[faction] = Math.max(-50, Math.min(999, Number(this.state.reputation[faction] || 0) + amount));
    }

    reputationTier(value) {
      if (value >= 220) return "Tôn kính";
      if (value >= 100) return "Đồng minh";
      if (value >= 35) return "Tin cậy";
      if (value < 0) return "Dè chừng";
      return "Trung lập";
    }

    grantArtifact(source = "Không gian sâu") {
      const random = randomFrom(hashText(`${source}:${this.state.sector}:${this.state.stats.artifacts}:${Date.now()}`));
      const blueprint = pick(ARTIFACT_BLUEPRINTS, random);
      const roll = random();
      const rarity = roll > .96 ? "Huyền thoại" : roll > .78 ? "Sử thi" : roll > .42 ? "Hiếm" : "Lạ";
      const multiplier = { "Lạ": 1, "Hiếm": 1.35, "Sử thi": 1.8, "Huyền thoại": 2.5 }[rarity];
      const artifact = {
        id: `art-${Date.now()}-${Math.floor(random() * 9999)}`,
        name: blueprint.name,
        rarity,
        effect: blueprint.effect,
        amount: Math.round(blueprint.amount * multiplier * 100) / 100,
        description: blueprint.description,
        source,
        time: Date.now()
      };
      this.state.artifacts.unshift(artifact);
      this.state.artifacts = this.state.artifacts.slice(0, 24);
      this.state.stats.artifacts += 1;
      this.addScore(rarity === "Huyền thoại" ? 500 : rarity === "Sử thi" ? 280 : 140);
      this.unlockAchievement("artifact-hunter", "Nhà khảo cổ giữa các vì sao", this.state.stats.artifacts >= 5);
      this.log(`Thu hồi cổ vật ${rarity}: ${artifact.name}.`);
      return artifact;
    }

    unlockResearch(id) {
      const node = RESEARCH_NODES.find((item) => item.id === id);
      if (!node) return;
      const level = this.researchLevel(id);
      if (level >= node.max) return this.notify("Công nghệ đã đạt cấp tối đa.");
      const cost = node.baseCost * (level + 1);
      if (this.state.research < cost) return this.notify(`Cần ${cost} dữ liệu nghiên cứu.`, true);
      this.state.research -= cost;
      this.state.researchNodes[id] = level + 1;
      this.addScore(110);
      this.log(`Nghiên cứu ${node.name} đạt cấp ${level + 1}.`);
      this.tone(410, .09, "triangle", .02);
      this.tone(690, .16, "sine", .025, .08);
      this.notify(`${node.name} · cấp ${level + 1}/${node.max}`);
      this.save({ sync: true });
      this.updateUi(true);
    }

    loop(now) {
      if (this.destroyed) return;
      const dt = clamp((now - this.lastFrame) / 1000, 0, .034);
      this.lastFrame = now;
      this.fpsFrames += 1;
      if (now - this.fpsWindowStarted >= 1000) {
        this.currentFps = Math.round(this.fpsFrames * 1000 / (now - this.fpsWindowStarted));
        this.fpsFrames = 0;
        this.fpsWindowStarted = now;
        if (this.state.settings.quality === "auto") {
          if (this.currentFps < 43) this.adaptiveReduced = true;
          else if (this.currentFps > 56) this.adaptiveReduced = false;
        }
      }
      if (this.running && !this.paused && !document.hidden) this.update(dt, now);
      this.draw(now / 1000);
      if (now - this.lastUi > 140) { this.updateUi(); this.lastUi = now; }
      if (this.running && now - this.lastSave > 10000) this.save();
      this.frame = requestAnimationFrame((time) => this.loop(time));
    }

    update(dt, now) {
      const ship = this.state.ship;
      const rotation = 2.55 * dt;
      const manualInput = this.input.left || this.input.right || this.input.thrust || this.input.brake;
      if (manualInput && this.autopilot) this.autopilot = false;
      this.autopilotThrust = false;
      if (this.autopilot) {
        const target = this.selectedTarget();
        if (!target || !this.discovered.has(target.id)) this.autopilot = false;
        else {
          const targetAngle = Math.atan2(target.y - ship.y, target.x - ship.x);
          const difference = Math.atan2(Math.sin(targetAngle - ship.angle), Math.cos(targetAngle - ship.angle));
          ship.angle += clamp(difference, -rotation * 1.15, rotation * 1.15);
          const remaining = distance(target, ship) - target.radius;
          this.autopilotThrust = remaining > 150 && Math.abs(difference) < .55 && ship.fuel > .1;
          if (remaining <= 150) { ship.vx *= Math.pow(.1, dt); ship.vy *= Math.pow(.1, dt); }
        }
      }
      if (this.input.left) ship.angle -= rotation;
      if (this.input.right) ship.angle += rotation;
      const thrusting = this.input.thrust || this.autopilotThrust;
      const boosting = this.input.boost && ship.fuel > 1;
      if (thrusting && ship.fuel > .1) {
        const acceleration = (135 + this.state.upgrades.engine * 34) * (boosting ? 1.65 : 1);
        ship.vx += Math.cos(ship.angle) * acceleration * dt;
        ship.vy += Math.sin(ship.angle) * acceleration * dt;
        ship.fuel = Math.max(0, ship.fuel - dt * (boosting ? 1.25 : .46));
      } else ship.fuel = Math.min(100, ship.fuel + dt * .08 * this.state.upgrades.reactor);
      if (this.input.brake) { ship.vx *= Math.pow(.12, dt); ship.vy *= Math.pow(.12, dt); }
      const speed = Math.hypot(ship.vx, ship.vy);
      const maximum = this.maxSpeed() * (boosting ? 1.35 : 1);
      if (speed > maximum) { ship.vx = ship.vx / speed * maximum; ship.vy = ship.vy / speed * maximum; }
      ship.vx *= Math.pow(.985, dt * 60); ship.vy *= Math.pow(.985, dt * 60);
      if (this.hazard?.drag && this.hazard.drag < 1) { ship.vx *= Math.pow(this.hazard.drag, dt * 60); ship.vy *= Math.pow(this.hazard.drag, dt * 60); }
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      this.state.stats.distance += speed * dt;
      this.state.stats.playSeconds += dt;
      const halfWidth = WORLD.width / 2;
      const halfHeight = WORLD.height / 2;
      if (Math.abs(ship.x) > halfWidth) { ship.x = clamp(ship.x, -halfWidth, halfWidth); ship.vx *= -.38; this.notify("Biên vùng sao: dùng WARP để tiếp tục hành trình.", true); }
      if (Math.abs(ship.y) > halfHeight) { ship.y = clamp(ship.y, -halfHeight, halfHeight); ship.vy *= -.38; this.notify("Biên vùng sao: dùng WARP để tiếp tục hành trình.", true); }
      ship.energy = Math.min(this.maxEnergy(), ship.energy + dt * ((5.5 + this.state.upgrades.reactor * 1.6) * Number(this.hazard?.energy || 1) + this.artifactBonus("energy")));
      if (this.hazard?.shieldDrain && ship.shield > 0) ship.shield = Math.max(0, ship.shield - dt * this.hazard.shieldDrain);
      if (now > this.damageCooldown + 3500) ship.shield = Math.min(this.maxShield(), ship.shield + dt * (1.2 + this.state.upgrades.shield * .55));
      if (now > this.damageCooldown + 5000 && this.researchLevel("nanites") > 0) ship.hull = Math.min(100, ship.hull + dt * this.researchLevel("nanites") * .08);
      this.scanCooldown = Math.max(0, this.scanCooldown - dt);
      if (this.scanPulse) {
        this.scanPulse.radius += dt * 780;
        this.scanPulse.alpha = Math.max(0, 1 - this.scanPulse.radius / this.scanPulse.max);
        if (this.scanPulse.radius >= this.scanPulse.max) this.scanPulse = null;
      }
      if (this.state.streak.count && now > this.state.streak.expiresAt) this.state.streak = { count: 0, multiplier: 1, expiresAt: 0 };
      this.trail.forEach((particle) => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; });
      this.trail = this.trail.filter((particle) => particle.life > 0);
      if (thrusting && now - this.lastTrailAt > (this.adaptiveReduced || this.state.settings.quality === "eco" ? 75 : 38)) {
        const spread = Math.sin(now * .013) * 4;
        this.trail.push({ x: ship.x - Math.cos(ship.angle) * 18 + Math.cos(ship.angle + Math.PI / 2) * spread, y: ship.y - Math.sin(ship.angle) * 18 + Math.sin(ship.angle + Math.PI / 2) * spread, vx: -Math.cos(ship.angle) * 42 + ship.vx * .22, vy: -Math.sin(ship.angle) * 42 + ship.vy * .22, life: .62, maxLife: .62 });
        this.trail = this.trail.slice(-(this.state.settings.quality === "ultra" ? 72 : 44));
        this.lastTrailAt = now;
      }
      if (this.state.settings.calmReminder && this.state.stats.playSeconds >= this.nextCalmReminder) {
        this.nextCalmReminder += 2700;
        this.notify("Bạn đã bay 45 phút. Hãy nghỉ mắt và duỗi vai một chút nhé.");
      }
      this.handlePickups();
      this.handleCollisions(now, speed);
      this.updateTarget();
    }

    handlePickups() {
      for (const item of this.objects) {
        if (item.type !== "crystal" || this.collected.has(item.id) || distance(item, this.state.ship) > item.radius + 24) continue;
        this.collected.add(item.id);
        const bonusChance = this.researchLevel("refinery") * .08 + this.artifactBonus("refinery");
        const amount = Math.random() < bonusChance ? 2 : 1;
        this.bumpStreak();
        this.state.crystals += amount;
        this.addScore(18 * amount, true);
        this.state.stats.crystals += amount;
        this.advanceMission("crystal", amount);
        this.dailyProgress("crystal", amount);
        this.tone(760, .08, "triangle", .025);
        this.tone(1040, .09, "sine", .018, .06);
        this.log(`Thu hồi ${amount} tinh thể Aether${amount > 1 ? " nhờ bộ tinh luyện" : ""}.`);
      }
    }

    handleCollisions(now, speed) {
      if (now < this.damageCooldown) return;
      const hit = this.objects.find((item) => item.type === "asteroid" && distance(item, this.state.ship) < item.radius + 10);
      if (!hit || speed < 38) return;
      const damage = clamp(Math.round(speed / 18), 4, 22);
      this.damageCooldown = now + 950;
      if (this.state.ship.shield > 0) this.state.ship.shield = Math.max(0, this.state.ship.shield - damage);
      else this.state.ship.hull = Math.max(0, this.state.ship.hull - damage);
      this.state.ship.vx *= -.46; this.state.ship.vy *= -.46;
      this.tone(95, .18, "sawtooth", .04);
      this.notify(`Va chạm tiểu hành tinh · thiệt hại ${damage}`, true);
      if (this.state.ship.hull <= 0) this.rescue();
    }

    rescue() {
      this.state.ship = { ...this.state.ship, x: 0, y: 0, vx: 0, vy: 0, hull: 55, shield: 25, fuel: Math.max(30, this.state.ship.fuel) };
      this.state.credits = Math.max(0, this.state.credits - 80);
      this.state.score = Math.max(0, this.state.score - 120);
      this.log("Đội cứu hộ HH đã kéo Asteria về điểm neo. Phí cứu hộ: 80 CR.");
      this.notify("Asteria đã được cứu hộ và phục hồi khẩn cấp.", true);
      this.save({ sync: true });
    }

    scan() {
      if (!this.running) return this.start();
      if (this.paused) return this.notify("Tiếp tục chuyến bay trước khi quét.", true);
      if (this.scanCooldown > 0) return this.notify(`Scanner đang nạp lại · ${this.scanCooldown.toFixed(1)}s`, true);
      const energyCost = this.scanEnergyCost();
      if (this.state.ship.energy < energyCost) return this.notify("Không đủ năng lượng cho xung quét.", true);
      const range = this.scanRange();
      this.state.ship.energy -= energyCost;
      this.scanCooldown = Math.max(.8, 2.7 - this.state.upgrades.scanner * .24);
      this.scanPulse = { radius: 0, max: range, alpha: 1 };
      this.state.stats.scans += 1;
      this.dailyProgress("scan", 1);
      let found = 0;
      this.objects.forEach((item) => {
        if (["asteroid", "crystal"].includes(item.type) || this.discovered.has(item.id) || distance(item, this.state.ship) > range) return;
        this.discover(item);
        found += 1;
      });
      this.tone(220, .22, "sine", .025);
      this.tone(660, .36, "sine", .018, .08);
      this.notify(found ? `Scanner đã nhận diện ${found} tín hiệu mới.` : "Không có tín hiệu mới trong tầm quét.");
      this.updateTarget();
      this.save();
    }

    discover(item) {
      this.discovered.add(item.id);
      this.state.stats.discoveries += 1;
      this.bumpStreak();
      this.addScore(item.type === "beacon" ? 180 : item.type === "planet" ? 90 : 65, true);
      this.state.research += item.type === "beacon" ? 24 : 8;
      this.addReputation("archive", item.type === "planet" ? 3 : 1);
      this.advanceMission("scan", 1);
      this.unlockAchievement("first-discovery", "Ánh sáng đầu tiên", this.state.stats.discoveries >= 1);
      this.unlockAchievement("cartographer", "Nhà vẽ bản đồ", this.state.stats.discoveries >= 25);
      this.log(`Đã nhận diện ${item.name}.`);
    }

    updateTarget() {
      const selected = this.objects.find((item) => item.id === this.selectedId && this.discovered.has(item.id));
      if (selected && distance(selected, this.state.ship) < 1200) return;
      const target = this.objects.filter((item) => !["asteroid", "crystal", "star"].includes(item.type) && this.discovered.has(item.id)).sort((a, b) => distance(a, this.state.ship) - distance(b, this.state.ship))[0];
      this.selectedId = target && distance(target, this.state.ship) < 900 ? target.id : "";
    }

    interact() {
      if (!this.running) return this.start();
      const candidates = this.objects.filter((item) => !["asteroid", "crystal", "star"].includes(item.type) && this.discovered.has(item.id)).sort((a, b) => distance(a, this.state.ship) - distance(b, this.state.ship));
      const target = candidates[0];
      if (!target || distance(target, this.state.ship) > target.radius + 135) return this.notify("Hãy tiếp cận một mục tiêu đã quét để tương tác.", true);
      if (this.sampled.has(target.id)) return this.notify("Mục tiêu này đã được khai thác dữ liệu.");
      this.selectedId = target.id;
      if (target.type === "beacon" && !this.decoded.has(target.id)) return this.startDecode(target);
      this.resolveInteraction(target);
    }

    resolveInteraction(target) {
      if (!target || this.sampled.has(target.id)) return;
      this.sampled.add(target.id);
      const rewards = { planet: [70, 28], anomaly: [95, 46], beacon: [180, 85], wreck: [120, 18] }[target.type] || [50, 12];
      this.state.credits += rewards[0];
      this.state.research += rewards[1];
      this.bumpStreak();
      this.addScore(rewards[0] + rewards[1] * 2, true);
      if (target.type === "planet") this.advanceMission("planet", 1);
      if (target.type === "beacon") {
        this.advanceMission("beacon", 1);
        this.addReputation("echo", 18);
        const message = BEACON_MESSAGES[this.state.beacons.length % BEACON_MESSAGES.length];
        this.state.beacons.push({ id: target.id, name: target.name, message, time: Date.now() });
        this.log(message);
        this.unlockAchievement("echo-seven", "Người nghe tiếng vọng", this.state.beacons.length >= 7);
        this.grantArtifact("Đài phát Echo");
      } else {
        this.log(`Đã hoàn tất khảo sát ${target.name}: +${rewards[0]} CR, +${rewards[1]} DB.`);
        if (target.type === "planet") this.addReputation("archive", 8);
        if (target.type === "anomaly" && Math.random() < .6) this.grantArtifact("Dị thường lượng tử");
      }
      if (target.type === "wreck") {
        this.state.crystals += 3;
        this.state.ship.fuel = Math.min(100, this.state.ship.fuel + 14);
        this.addReputation("freelance", 10);
        if (Math.random() < .72) this.grantArtifact("Tàu đắm liên sao");
      }
      this.tone(520, .12, "triangle", .03);
      this.tone(820, .18, "sine", .02, .09);
      this.notify(`Khảo sát hoàn tất · +${rewards[0]} CR · +${rewards[1]} dữ liệu`);
      this.save({ sync: true });
      this.updateUi(true);
    }

    startDecode(target) {
      if (!target || target.type !== "beacon") return this.notify("Hãy chọn một đài phát Echo.", true);
      if (distance(target, this.state.ship) > target.radius + 150) return this.notify("Phải ở gần đài phát để giải mã.", true);
      if (this.decoded.has(target.id)) return this.resolveInteraction(target);
      const random = randomFrom(hashText(`decode:${target.id}`));
      this.pendingDecode = { targetId: target.id, pattern: Array.from({ length: 4 }, () => Math.floor(random() * 4)), values: [0, 0, 0, 0], attempts: 0 };
      this.renderDecode();
      this.openModal("decode");
      this.tone(180, .2, "sine", .018);
    }

    cycleDecode(index) {
      if (!this.pendingDecode || index < 0 || index > 3) return;
      this.pendingDecode.values[index] = (this.pendingDecode.values[index] + 1) % 4;
      this.renderDecode();
      this.tone(240 + this.pendingDecode.values[index] * 110, .06, "sine", .018);
    }

    renderDecode() {
      if (!this.pendingDecode) return;
      const glyphs = ["∿", "⌁", "◇", "✦"];
      const target = this.root.querySelector("[data-decode-target]");
      const controls = this.root.querySelector("[data-decode-controls]");
      if (target) target.innerHTML = this.pendingDecode.pattern.map((value, index) => `<span style="--wave:${value + 1}"><small>F${index + 1}</small><b>${glyphs[value]}</b></span>`).join("");
      if (controls) controls.innerHTML = this.pendingDecode.values.map((value, index) => `<button type="button" data-decode-slot="${index}" style="--wave:${value + 1}"><small>Kênh ${index + 1}</small><b>${glyphs[value]}</b><span>${220 + value * 110} Hz</span></button>`).join("");
    }

    submitDecode() {
      if (!this.pendingDecode) return;
      const solved = this.pendingDecode.pattern.every((value, index) => value === this.pendingDecode.values[index]);
      const feedback = this.root.querySelector("[data-decode-feedback]");
      if (!solved) {
        this.pendingDecode.attempts += 1;
        this.state.ship.energy = Math.max(0, this.state.ship.energy - 4);
        if (feedback) feedback.textContent = `Chưa cộng hưởng · lần thử ${this.pendingDecode.attempts}. So sánh hình sóng và thử lại.`;
        this.tone(105, .15, "sawtooth", .025);
        return;
      }
      const target = this.objects.find((item) => item.id === this.pendingDecode.targetId);
      this.decoded.add(this.pendingDecode.targetId);
      this.state.stats.decodeWins += 1;
      this.addReputation("echo", 12);
      this.addScore(240);
      this.pendingDecode = null;
      this.closeModals();
      this.tone(440, .12, "triangle", .03);
      this.tone(660, .16, "triangle", .026, .1);
      this.tone(990, .22, "sine", .02, .2);
      this.notify("Cộng hưởng hoàn tất · kênh HH-13 đã mở");
      this.resolveInteraction(target);
    }

    advanceMission(type, amount) {
      const mission = this.missionTemplate();
      if (mission.type !== type) return;
      this.state.mission.progress = Math.min(mission.target, Number(this.state.mission.progress || 0) + amount);
      if (this.state.mission.progress < mission.target) return;
      this.state.credits += mission.credits;
      this.state.research += mission.data;
      this.state.xp += mission.xp;
      this.state.score += mission.credits + mission.xp;
      this.log(`Hoàn thành nhiệm vụ “${mission.title}”.`);
      this.notify(`Nhiệm vụ hoàn tất · +${mission.credits} CR · +${mission.xp} XP`);
      this.levelUp();
      this.state.mission = { cycle: Number(this.state.mission.cycle || 0) + 1, type: MISSION_TEMPLATES[(Number(this.state.mission.cycle || 0) + 1) % MISSION_TEMPLATES.length].type, progress: 0 };
      this.save({ sync: true });
    }

    levelUp() {
      let threshold = 180 + this.state.level * 120;
      while (this.state.xp >= threshold) {
        this.state.xp -= threshold;
        this.state.level += 1;
        this.state.credits += 100;
        this.state.ship.hull = 100;
        this.state.ship.shield = this.maxShield();
        this.notify(`Thăng cấp phi công LV.${this.state.level} · nhận 100 CR`);
        this.tone(440, .12, "triangle", .03);
        this.tone(660, .14, "triangle", .025, .1);
        this.tone(880, .18, "sine", .02, .2);
        threshold = 180 + this.state.level * 120;
      }
    }

    unlockAchievement(id, title, condition) {
      if (!condition || this.state.achievements.some((item) => item.id === id)) return;
      this.state.achievements.push({ id, title, time: Date.now() });
      this.state.score += 150;
      this.notify(`Thành tích mở khóa · ${title}`);
    }

    warp() {
      if (!this.running) return this.start();
      const cost = this.warpCost();
      if (this.state.ship.fuel < cost) return this.notify(`Cần ít nhất ${cost}% nhiên liệu để kích hoạt warp.`, true);
      this.closeModals();
      this.state.ship.fuel -= cost;
      this.state.sector += 1;
      this.state.stats.sectors = Math.max(this.state.stats.sectors, this.state.sector + 1);
      this.addScore(220);
      this.state.ship.x = 0; this.state.ship.y = 0; this.state.ship.vx = 0; this.state.ship.vy = 0;
      this.advanceMission("warp", 1);
      this.dailyProgress("warp", 1);
      this.root.classList.add("is-warping");
      const timer = setTimeout(() => { if (!this.destroyed) { this.root.classList.remove("is-warping"); this.generateSector(); this.notify(`Đã tới ${this.sectorName}.`); this.maybeStartEncounter(); } }, 820);
      this.timeouts.push(timer);
      this.tone(110, .7, "sawtooth", .018);
      this.tone(880, .45, "sine", .025, .25);
      this.log(`Bước nhảy warp #${this.state.sector} đã hoàn tất.`);
      this.save({ sync: true });
    }

    maybeStartEncounter() {
      const random = randomFrom(hashText(`encounter:${this.state.sector}:${localDateKey()}`));
      if (this.state.sector > 1 && random() > .68) return;
      const encounters = [
        { id: "distress", icon: "SOS", title: "Con tàu không còn tiếng nói", copy: "Một tàu khảo sát quay chậm trong bóng tối. Bộ phát SOS vẫn chạy nhưng không có phản hồi từ khoang lái.", choices: [["rescue", "Kéo tàu về tuyến an toàn", "-8 nhiên liệu · uy tín cứu hộ"], ["salvage", "Mở khoang hàng", "Cổ vật · rủi ro danh tiếng"], ["mark", "Đánh dấu cho trạm HH", "+dữ liệu bản đồ"]] },
        { id: "leviathan", icon: "≈", title: "Sinh thể tinh vân đang hát", copy: "Dải khí trước mũi tàu co lại như một sinh vật. Quang phổ của nó lặp đúng bốn nốt từ tín hiệu HH-13.", choices: [["listen", "Lắng nghe trọn bài hát", "-20 năng lượng · uy tín Echo"], ["sample", "Lấy mẫu trường sinh học", "+80 dữ liệu · khiên chịu tải"], ["retreat", "Rời khỏi vùng cộng hưởng", "An toàn"]] },
        { id: "trader", icon: "◇", title: "Thương nhân không mang tên", copy: "Một phi thuyền bọc gương chào bạn bằng giọng nói của chính bạn và mở kho trao đổi chỉ trong 30 giây.", choices: [["trade", "Đổi 4 Aether lấy cổ vật", "Vật phẩm ngẫu nhiên"], ["fuel", "Mua 35% nhiên liệu", "-80 CR"], ["talk", "Trao đổi bản đồ sao", "+uy tín · +dữ liệu"]] },
        { id: "temporal", icon: "∞", title: "Cổng thời gian một chiều", copy: "Scanner thấy Asteria ở phía bên kia cổng, già hơn 40 năm và đang truyền về tọa độ chưa tồn tại.", choices: [["enter", "Bước qua nghịch lý", "Phần thưởng lớn · có rủi ro"], ["chart", "Chỉ ghi bản đồ trường", "+55 dữ liệu"], ["bypass", "Khóa tọa độ và rời đi", "An toàn"]] }
      ];
      this.currentEncounter = pick(encounters, random);
      this.state.stats.encounters += 1;
      const title = this.root.querySelector("[data-encounter-title]");
      const copy = this.root.querySelector("[data-encounter-copy]");
      const visual = this.root.querySelector("[data-encounter-visual]");
      const choices = this.root.querySelector("[data-encounter-choices]");
      if (title) title.textContent = this.currentEncounter.title;
      if (copy) copy.textContent = this.currentEncounter.copy;
      if (visual) visual.textContent = this.currentEncounter.icon;
      if (choices) choices.innerHTML = this.currentEncounter.choices.map(([id, label, note]) => `<button type="button" data-encounter-choice="${id}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(note)}</span></button>`).join("");
      this.openModal("encounter");
      this.tone(155, .32, "sine", .018);
    }

    chooseEncounter(choice) {
      if (!this.currentEncounter) return;
      let result = "Asteria tiếp tục hành trình.";
      if (choice === "rescue") {
        if (this.state.ship.fuel < 8) return this.notify("Không đủ 8% nhiên liệu để kéo tàu.", true);
        this.state.ship.fuel -= 8; this.state.credits += 190; this.state.xp += 110; this.addReputation("freelance", 24); this.addScore(280); result = "Đã cứu tàu khảo sát · +190 CR · +24 uy tín.";
      } else if (choice === "salvage") {
        this.grantArtifact("Khoang hàng vô chủ"); this.addReputation("freelance", -9); result = "Khoang hàng chứa một cổ vật, nhưng tín hiệu cứu hộ đã im lặng.";
      } else if (choice === "mark") {
        this.state.research += 38; this.addReputation("archive", 8); result = "Tọa độ cứu hộ đã chuyển về Trạm HH · +38 DB.";
      } else if (choice === "listen") {
        if (this.state.ship.energy < 20) return this.notify("Không đủ 20 năng lượng để giữ cộng hưởng.", true);
        this.state.ship.energy -= 20; this.state.research += 64; this.addReputation("echo", 22); this.grantArtifact("Bài hát tinh vân"); result = "Bạn đã ghi được bài hát không thuộc về loài người.";
      } else if (choice === "sample") {
        this.state.ship.shield = Math.max(0, this.state.ship.shield - 18); this.state.research += 80; this.addReputation("archive", 14); this.addScore(170); result = "Mẫu trường sinh học ổn định · +80 DB · -18 khiên.";
      } else if (choice === "retreat" || choice === "bypass") {
        this.addScore(25); result = "Quyết định thận trọng đã giữ Asteria nguyên vẹn.";
      } else if (choice === "trade") {
        if (this.state.crystals < 4) return this.notify("Cần 4 Aether để trao đổi.", true);
        this.state.crystals -= 4; this.grantArtifact("Thương nhân bọc gương"); result = "Giao dịch hoàn tất · một cổ vật mới đã vào kho.";
      } else if (choice === "fuel") {
        if (this.state.credits < 80) return this.notify("Không đủ 80 CR.", true);
        this.state.credits -= 80; this.state.ship.fuel = Math.min(100, this.state.ship.fuel + 35); result = "Bình warp đã được nạp thêm 35%.";
      } else if (choice === "talk") {
        this.state.research += 34; this.addReputation("freelance", 10); this.addReputation("echo", 5); result = "Bản đồ sao lạ đã được trao đổi · +34 DB.";
      } else if (choice === "enter") {
        const lucky = randomFrom(hashText(`paradox:${this.state.sector}:${this.state.score}`))() > .35;
        if (lucky) { this.state.credits += 420; this.state.research += 120; this.grantArtifact("Nghịch lý thời gian"); result = "Asteria trở về sớm hơn 11 giây cùng dữ liệu từ tương lai."; }
        else { this.state.ship.hull = Math.max(15, this.state.ship.hull - 24); this.state.research += 75; result = "Nghịch lý xé lớp giáp tàu, nhưng để lại bản đồ tương lai."; }
      } else if (choice === "chart") {
        this.state.research += 55; this.addReputation("archive", 10); result = "Trường thời gian đã được lập bản đồ · +55 DB.";
      }
      this.log(result);
      this.currentEncounter = null;
      this.closeModals();
      this.notify(result);
      this.levelUp();
      this.save({ sync: true });
      this.updateUi(true);
    }

    upgrade(id) {
      if (!Object.hasOwn(this.state.upgrades, id)) return;
      const current = this.state.upgrades[id];
      const cost = 80 + current * 70;
      if (this.state.credits < cost) return this.notify(`Cần ${cost} CR để nâng cấp module này.`, true);
      if (current >= 8) return this.notify("Module đã đạt cấp tối đa MK-8.");
      this.state.credits -= cost;
      this.state.upgrades[id] += 1;
      if (id === "shield") this.state.ship.shield = this.maxShield();
      if (id === "reactor") this.state.ship.energy = this.maxEnergy();
      this.state.score += 90;
      this.log(`Nâng cấp ${id.toUpperCase()} lên MK-${this.state.upgrades[id]}.`);
      this.tone(460, .09, "square", .02); this.tone(720, .13, "triangle", .02, .08);
      this.notify(`Nâng cấp hoàn tất · ${id.toUpperCase()} MK-${this.state.upgrades[id]}`);
      this.save({ sync: true });
      this.updateUi(true);
    }

    service(type) {
      if (type === "repair") {
        if (this.state.ship.hull >= 100) return this.notify("Thân tàu đang ở trạng thái tối ưu.");
        if (this.state.credits < 45) return this.notify("Không đủ 45 CR để sửa chữa.", true);
        this.state.credits -= 45; this.state.ship.hull = Math.min(100, this.state.ship.hull + 40);
        this.notify("Đã phục hồi 40% thân tàu.");
      }
      if (type === "refuel") {
        if (this.state.ship.fuel >= 100) return this.notify("Bình nhiên liệu đã đầy.");
        if (this.state.crystals < 5) return this.notify("Cần 5 tinh thể Aether để tinh chế nhiên liệu.", true);
        this.state.crystals -= 5; this.state.ship.fuel = Math.min(100, this.state.ship.fuel + 45);
        this.notify("Đã nạp thêm 45% nhiên liệu warp.");
      }
      this.tone(560, .11, "sine", .025);
      this.save(); this.updateUi(true);
    }

    toggleAutopilot() {
      if (!this.running) return this.start();
      if (!this.autopilot) {
        if (!this.selectedTarget()) this.updateTarget();
        if (!this.selectedTarget()) return this.notify("Hãy quét và chọn một mục tiêu trước khi bật autopilot.", true);
        this.autopilot = true;
        this.notify(`Autopilot đang dẫn tới ${this.selectedTarget().name}.`);
      } else {
        this.autopilot = false;
        this.autopilotThrust = false;
        this.notify("Autopilot đã tắt.");
      }
      this.updateUi(true);
    }

    sonifyTarget() {
      const target = this.selectedTarget();
      if (!target || !this.discovered.has(target.id)) return this.notify("Hãy chọn một thiên thể đã quét.", true);
      const context = this.ensureAudio();
      context?.resume?.().catch(() => {});
      const period = Number(target.orbitalPeriod || (hashText(target.id) % 480) + 8);
      const base = clamp(920 - Math.log2(period + 1) * 96, 170, 880);
      const intervals = target.type === "planet" ? [1, 1.25, 1.5, 2, 1.5, 1.25] : target.type === "beacon" ? [1, 1.5, 1.25, 2, 1.75, 2.5] : [1, 1.12, 1.42, 1.68, 1.2, 2.1];
      intervals.forEach((ratio, index) => this.tone(base * ratio, .2, index % 2 ? "triangle" : "sine", .018, index * .15));
      this.addReputation("archive", 1);
      this.notify(`Đang âm thanh hóa ${target.name} · chu kỳ ${period.toFixed(1)} ngày`);
    }

    capturePhoto() {
      if (!this.canvas) return;
      this.draw(performance.now() / 1000);
      this.canvas.toBlob((blob) => {
        if (!blob) return this.notify("Không thể xuất ảnh trên trình duyệt này.", true);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ASTRA-HH-${this.sectorName.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.notify("Ảnh không gian đã được xuất ở độ phân giải hiện tại.");
      }, "image/png");
    }

    setQuality(value) {
      if (!["auto", "ultra", "eco"].includes(value)) return;
      this.state.settings.quality = value;
      this.adaptiveReduced = value === "eco";
      const random = randomFrom(this.getSectorSeed() ^ 0x7a11);
      const targetCount = value === "eco" ? 110 : value === "ultra" ? 245 : 180;
      this.stars = Array.from({ length: targetCount }, () => ({ x: random(), y: random(), size: .35 + random() * 1.65, depth: .15 + random() * .85, hue: pick([188, 205, 226, 38, 282, 330], random) }));
      this.buildBackground();
      this.save();
      this.notify(value === "auto" ? "Đồ họa sẽ tự điều chỉnh để giữ chuyển động mượt." : value === "ultra" ? "Đã bật chất lượng Cực đẹp." : "Đã bật chế độ Tiết kiệm.");
      this.updateUi(true);
    }

    openTab(name) {
      this.root.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === name));
      this.root.querySelectorAll("[data-pane]").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.pane === name));
      if (name === "ranking") this.loadLeaderboard();
      if (window.matchMedia("(max-width: 940px)").matches) this.root.querySelector(`[data-pane="${name}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    openModal(name) {
      const modal = this.root.querySelector(`[data-modal="${name}"]`);
      if (!modal) return;
      if (name === "map") this.renderMap();
      modal.hidden = false;
      modal.querySelector("button")?.focus();
    }

    closeModals() { this.root.querySelectorAll("[data-modal]").forEach((modal) => { modal.hidden = true; }); }

    renderMap() {
      const grid = this.root.querySelector("[data-map-grid]");
      if (!grid) return;
      const sectors = [-1, 0, 1].map((offset) => Math.max(0, this.state.sector + offset));
      grid.innerHTML = sectors.map((sector) => {
        const random = randomFrom(hashText(`HH-13:map:${sector}`));
        const name = sector === this.state.sector ? this.sectorName : `${pick(SECTOR_PREFIXES, random)} ${pick(SECTOR_SUFFIXES, random)} · ${1300 + sector * 17}`;
        return `<article class="astra-map-node ${sector === this.state.sector ? "is-current" : ""}"><b>${escapeHtml(name)}</b><span>${sector < this.state.sector ? "Đã thám hiểm" : sector === this.state.sector ? "Vị trí hiện tại" : "Tín hiệu chưa xác định"}</span><i>${sector === this.state.sector ? "◎" : sector < this.state.sector ? "✓" : "?"}</i></article>`;
      }).join("");
    }

    log(text) {
      this.state.logs.unshift({ time: Date.now(), text: String(text).slice(0, 220) });
      this.state.logs = this.state.logs.slice(0, 10);
    }

    notify(message, warning = false) {
      const toast = this.root?.querySelector("[data-toast]");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.toggle("is-warn", warning);
      toast.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
    }

    selectedTarget() { return this.objects.find((item) => item.id === this.selectedId) || null; }

    updateUi(force = false) {
      if (!this.root?.isConnected) return;
      const ship = this.state.ship;
      const mission = this.missionTemplate();
      const set = (selector, value) => { const node = this.root.querySelector(selector); if (node && (force || node.textContent !== String(value))) node.textContent = value; };
      set("[data-sector-name]", this.sectorName);
      set("[data-hazard-name]", this.hazard?.label || "Không gian tĩnh");
      set("[data-hazard-status]", this.hazard?.label || "Không gian tĩnh");
      set("[data-fps]", `${this.currentFps} FPS${this.adaptiveReduced ? " · ADAPT" : ""}`);
      this.root.dataset.hazard = this.hazard?.id || "calm";
      set("[data-coordinates]", `X ${ship.x < 0 ? "-" : "+"}${pad(ship.x)} · Y ${ship.y < 0 ? "-" : "+"}${pad(ship.y)}`);
      set("[data-speed]", `${Math.round(Math.hypot(ship.vx, ship.vy))} u/s`);
      set("[data-heading]", `${String(Math.round(((ship.angle * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, "0")}°`);
      set("[data-flight-mode]", `FLIGHT · ${this.autopilot ? "AUTOPILOT" : this.input.boost ? "BOOST" : this.input.thrust ? "THRUST" : "CRUISE"}`);
      const streak = this.root.querySelector("[data-streak]");
      if (streak) { streak.hidden = !this.state.streak.count; streak.textContent = `CHUỖI ${this.state.streak.count} · x${Number(this.state.streak.multiplier || 1).toFixed(2)}`; }
      set("[data-mission-title]", mission.title);
      set("[data-mission-description]", mission.description);
      set("[data-mission-count]", `${this.state.mission.progress || 0}/${mission.target}`);
      set("[data-mission-reward]", `${mission.credits} CR · ${mission.xp} XP`);
      const missionProgress = this.root.querySelector("[data-mission-progress]");
      if (missionProgress) missionProgress.style.setProperty("--progress", `${clamp((this.state.mission.progress || 0) / mission.target * 100, 0, 100)}%`);
      set("[data-rank]", this.rank()); set("[data-level]", `LV.${this.state.level}`);
      set("[data-credits]", formatNumber(this.state.credits)); set("[data-crystals]", formatNumber(this.state.crystals));
      set("[data-research]", formatNumber(this.state.research)); set("[data-xp]", formatNumber(this.state.xp));
      set("[data-session-time]", formatTime(this.state.stats.playSeconds));
      set("[data-sector-progress]", `${this.objects.filter((item) => this.discovered.has(item.id)).length} thiên thể đã nhận diện`);
      const dailyDone = DAILY_GOALS.filter((goal) => this.state.daily[goal.id] >= goal.target).length;
      set("[data-daily-status]", this.state.daily.claimed ? "HOÀN TẤT" : `${dailyDone}/3`);
      set("[data-daily-reward]", this.state.daily.claimed ? "Phần thưởng hôm nay đã nhận · hẹn gặp lại ở nhịp sao kế tiếp." : "Hoàn tất cả ba: 350 CR · 80 DB · 1 cổ vật");
      const dailySignature = DAILY_GOALS.map((goal) => `${goal.id}:${this.state.daily[goal.id]}`).join("|") + this.state.daily.claimed;
      if (force || this.uiCache.daily !== dailySignature) {
        const goals = this.root.querySelector("[data-daily-goals]");
        if (goals) goals.innerHTML = DAILY_GOALS.map((goal) => { const value = Math.min(goal.target, Number(this.state.daily[goal.id] || 0)); return `<div class="${value >= goal.target ? "is-complete" : ""}"><span><b>${value >= goal.target ? "✓" : "○"}</b>${escapeHtml(goal.label)}</span><strong>${value}/${goal.target}</strong></div>`; }).join("");
        this.uiCache.daily = dailySignature;
      }
      const warpCost = this.warpCost();
      set("[data-warp-cost]", `${warpCost}% FUEL`);
      const mapWarp = this.root.querySelector('[data-modal="map"] [data-action="warp"]');
      if (mapWarp) mapWarp.textContent = `Warp tới vùng kế tiếp · ${warpCost}% nhiên liệu`;
      const meterValues = { hull: [ship.hull, 100], shield: [ship.shield, this.maxShield()], fuel: [ship.fuel, 100], energy: [ship.energy, this.maxEnergy()] };
      Object.entries(meterValues).forEach(([id, [value, maximum]]) => {
        const meter = this.root.querySelector(`[data-meter="${id}"]`);
        if (!meter) return;
        meter.querySelector("strong").textContent = `${Math.round(value)}/${Math.round(maximum)}`;
        meter.querySelector("b").style.setProperty("--value", `${clamp(value / maximum * 100, 0, 100)}%`);
      });
      this.root.querySelectorAll("[data-upgrade]").forEach((button) => {
        const id = button.dataset.upgrade;
        const level = this.state.upgrades[id];
        const cost = 80 + level * 70;
        button.textContent = level >= 8 ? "MAX" : `${cost} CR`;
        button.disabled = level >= 8 || this.state.credits < cost;
        set(`[data-upgrade-level="${id}"]`, level);
      });
      set("[data-ship-power]", `${Object.values(this.state.upgrades).reduce((sum, value) => sum + value, 0)} MOD`);
      set("[data-discovery-count]", this.state.stats.discoveries);
      set("[data-artifact-count]", `${this.state.artifacts.length} ART`);
      const quality = this.root.querySelector("[data-quality]");
      if (quality && quality.value !== this.state.settings.quality) quality.value = this.state.settings.quality;
      const target = this.selectedTarget();
      const targetCard = this.root.querySelector("[data-target-card]");
      if (target && this.discovered.has(target.id)) {
        targetCard.hidden = false;
        set("[data-target-type]", target.subtype || "Tín hiệu"); set("[data-target-name]", target.name);
        const targetDistance = Math.round(distance(target, ship));
        set("[data-target-note]", this.sampled.has(target.id) ? "Đã khảo sát" : targetDistance < target.radius + 135 ? "Nhấn E để tương tác" : this.autopilot ? "Autopilot đang tiếp cận" : "Tiếp cận để tương tác");
        set("[data-target-distance]", `${targetDistance} u`);
        const targetSignature = `${target.id}:${Math.round(targetDistance / 10)}:${this.sampled.has(target.id)}:${this.decoded.has(target.id)}:${this.autopilot}`;
        if (force || this.uiCache.target !== targetSignature) {
          const extra = target.type === "planet" ? `<p>Chu kỳ quỹ đạo ước tính: ${Number(target.orbitalPeriod || 0).toFixed(1)} ngày · ${Math.round(target.temperature || 0)}°C.</p>` : "";
          const decodeButton = target.type === "beacon" && !this.decoded.has(target.id) ? `<button type="button" data-action="decode">Giải mã Echo</button>` : "";
          this.root.querySelector("[data-target-info]").innerHTML = `<div><small>${escapeHtml(target.subtype || "Tín hiệu đã nhận diện")}</small><strong>${escapeHtml(target.name)}</strong><p>${escapeHtml(target.note || "Đang chờ dữ liệu phân tích chi tiết.")}</p>${extra}</div><div><small>Khoảng cách</small><strong>${targetDistance} đơn vị</strong><p>${this.sampled.has(target.id) ? "Khảo sát đã hoàn tất và lưu trong Codex." : "Tiếp cận mục tiêu và nhấn E để tiến hành khảo sát."}</p></div><div class="astra-target-actions"><button type="button" data-action="autopilot">${this.autopilot ? "Tắt autopilot" : "Dẫn đường tự động"}</button><button type="button" data-action="sonify">Nghe tín hiệu</button>${decodeButton}</div>`;
          this.uiCache.target = targetSignature;
        }
      } else {
        targetCard.hidden = true;
        if (force || this.uiCache.target !== "empty") this.root.querySelector("[data-target-info]").innerHTML = `<div><small>Không có mục tiêu</small><strong>Phát xung quét</strong><p>Scanner sẽ phân tích các vật thể trong vùng lân cận.</p></div><div><small>Điều kiện vùng sao</small><strong>${escapeHtml(this.hazard?.label || "Không gian tĩnh")}</strong><p>${escapeHtml(this.hazard?.description || "Điều kiện bay ổn định.")}</p></div>`;
        this.uiCache.target = "empty";
      }
      const log = this.root.querySelector("[data-log]");
      const logSignature = this.state.logs.slice(0, 6).map((entry) => `${entry.time}:${entry.text}`).join("|");
      if (log && (force || this.uiCache.log !== logSignature)) { log.innerHTML = this.state.logs.slice(0, 6).map((entry) => `<li><span><time>${new Date(entry.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time> ${escapeHtml(entry.text)}</span></li>`).join(""); this.uiCache.log = logSignature; }
      const codex = this.root.querySelector("[data-codex]");
      if (codex) {
        const known = this.objects.filter((item) => this.discovered.has(item.id)).slice(0, 8);
        const codexSignature = known.map((item) => `${item.id}:${this.sampled.has(item.id)}`).join("|");
        if (force || this.uiCache.codex !== codexSignature) { codex.innerHTML = known.length ? known.map((item) => `<article><span>${escapeHtml(item.subtype || item.type)} · ${this.sampled.has(item.id) ? "ĐÃ KHẢO SÁT" : "MỚI PHÁT HIỆN"}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.note || "Dữ liệu quang phổ đã được lưu vào kho nghiên cứu.")}</p></article>`).join("") : `<article><span>Kho dữ liệu trống</span><strong>Chưa có khám phá</strong><p>Phát xung scanner để ghi nhận thiên thể đầu tiên.</p></article>`; this.uiCache.codex = codexSignature; }
      }
      const factionSignature = JSON.stringify(this.state.reputation);
      if (force || this.uiCache.factions !== factionSignature) {
        const factions = this.root.querySelector("[data-factions]");
        if (factions) factions.innerHTML = Object.entries(FACTIONS).map(([id, faction]) => { const value = Number(this.state.reputation[id] || 0); return `<article style="--faction:${faction.color}"><span><b>${escapeHtml(faction.short)}</b><small>${escapeHtml(this.reputationTier(value))}</small></span><strong>${value} RP</strong><i style="--value:${clamp(value / 220 * 100, 0, 100)}%"></i></article>`; }).join("");
        this.uiCache.factions = factionSignature;
      }
      const researchSignature = `${this.state.research}:${JSON.stringify(this.state.researchNodes)}`;
      if (force || this.uiCache.research !== researchSignature) {
        const tree = this.root.querySelector("[data-research-tree]");
        if (tree) tree.innerHTML = RESEARCH_NODES.map((node) => { const level = this.researchLevel(node.id); const cost = node.baseCost * (level + 1); return `<article><span><strong>${escapeHtml(node.name)} · ${level}/${node.max}</strong><small>${escapeHtml(node.description)}</small></span><button type="button" data-research-node="${node.id}" ${level >= node.max || this.state.research < cost ? "disabled" : ""}>${level >= node.max ? "MAX" : `${cost} DB`}</button></article>`; }).join("");
        this.uiCache.research = researchSignature;
      }
      const artifactSignature = this.state.artifacts.map((item) => item.id).join("|");
      if (force || this.uiCache.artifacts !== artifactSignature) {
        const artifacts = this.root.querySelector("[data-artifacts]");
        if (artifacts) artifacts.innerHTML = this.state.artifacts.length ? this.state.artifacts.slice(0, 8).map((item) => `<article data-rarity="${escapeHtml(item.rarity)}"><i>◇</i><span><small>${escapeHtml(item.rarity)} · ${escapeHtml(item.source)}</small><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></span></article>`).join("") : `<p class="astra-empty-copy">Giải mã Echo, thám hiểm dị thường và xử lý sự kiện vùng sâu để tìm cổ vật.</p>`;
        this.uiCache.artifacts = artifactSignature;
      }
      const soundButton = this.root.querySelector('[data-action="sound"]');
      soundButton?.classList.toggle("is-active", this.state.settings.sound);
      const autopilotButton = this.root.querySelector('[data-action="autopilot"]');
      autopilotButton?.classList.toggle("is-pressed", this.autopilot);
      this.drawMinimap();
    }

    draw(time) {
      if (!this.context || !this.viewWidth || !this.viewHeight) return;
      const context = this.context;
      context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      context.drawImage(this.background, 0, 0, this.viewWidth, this.viewHeight);
      this.drawStars(context, time);
      this.drawSpaceWeather(context, time);
      this.drawGrid(context);
      this.drawTrail(context);
      const visible = this.objects.filter((item) => {
        if (item.type === "crystal" && this.collected.has(item.id)) return false;
        const point = this.screenPoint(item);
        return point.x > -130 && point.x < this.viewWidth + 130 && point.y > -130 && point.y < this.viewHeight + 130;
      });
      visible.filter((item) => item.type === "asteroid").forEach((item) => this.drawObject(context, item, time));
      visible.filter((item) => item.type !== "asteroid").forEach((item) => this.drawObject(context, item, time));
      if (this.scanPulse) {
        context.save();
        context.strokeStyle = `rgba(94,233,255,${this.scanPulse.alpha * .8})`;
        context.lineWidth = 2;
        context.shadowColor = "#5ee9ff"; context.shadowBlur = 18;
        context.beginPath(); context.arc(this.viewWidth / 2, this.viewHeight / 2, this.scanPulse.radius * this.zoom, 0, TAU); context.stroke();
        context.restore();
      }
      this.drawShip(context, time);
    }

    screenPoint(item) { return { x: this.viewWidth / 2 + (item.x - this.state.ship.x) * this.zoom, y: this.viewHeight / 2 + (item.y - this.state.ship.y) * this.zoom }; }

    drawStars(context, time) {
      for (const star of this.stars) {
        const x = ((star.x * this.viewWidth - this.state.ship.x * star.depth * .025) % this.viewWidth + this.viewWidth) % this.viewWidth;
        const y = ((star.y * this.viewHeight - this.state.ship.y * star.depth * .025) % this.viewHeight + this.viewHeight) % this.viewHeight;
        const twinkle = .55 + Math.sin(time * (1 + star.depth) + star.x * 30) * .25;
        context.fillStyle = `hsla(${star.hue},85%,84%,${twinkle})`;
        context.fillRect(x, y, star.size, star.size);
      }
    }

    drawSpaceWeather(context, time) {
      if (!this.hazard || this.hazard.id === "calm" || this.adaptiveReduced || this.state.settings.quality === "eco") return;
      context.save();
      context.strokeStyle = `rgba(${this.hazard.rgb},.12)`;
      context.lineWidth = 1;
      const speed = this.hazard.id === "solar" ? 190 : 80;
      for (let index = 0; index < 7; index += 1) {
        const x = ((index * 211 + time * speed) % (this.viewWidth + 260)) - 130;
        const y = ((index * 137 + time * speed * .24) % (this.viewHeight + 160)) - 80;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + 90, y + (this.hazard.id === "gravity" ? 46 : 16)); context.stroke();
      }
      context.restore();
    }

    drawTrail(context) {
      if (!this.trail.length) return;
      context.save();
      for (const particle of this.trail) {
        const point = this.screenPoint(particle);
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        context.fillStyle = `rgba(94,233,255,${alpha * .32})`;
        context.beginPath(); context.arc(point.x, point.y, 1.5 + alpha * 2.2, 0, TAU); context.fill();
      }
      context.restore();
    }

    drawGrid(context) {
      const spacing = 360 * this.zoom;
      const offsetX = ((-this.state.ship.x * this.zoom + this.viewWidth / 2) % spacing + spacing) % spacing;
      const offsetY = ((-this.state.ship.y * this.zoom + this.viewHeight / 2) % spacing + spacing) % spacing;
      context.save(); context.strokeStyle = "rgba(94,233,255,.032)"; context.lineWidth = 1;
      for (let x = offsetX; x < this.viewWidth; x += spacing) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, this.viewHeight); context.stroke(); }
      for (let y = offsetY; y < this.viewHeight; y += spacing) { context.beginPath(); context.moveTo(0, y); context.lineTo(this.viewWidth, y); context.stroke(); }
      context.restore();
    }

    drawObject(context, item, time) {
      const point = this.screenPoint(item);
      const radius = item.radius * this.zoom;
      context.save(); context.translate(point.x, point.y);
      if (item.type === "star") {
        const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 3.2);
        glow.addColorStop(0, item.color); glow.addColorStop(.18, `${item.color}bb`); glow.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = glow; context.beginPath(); context.arc(0, 0, radius * 3.2, 0, TAU); context.fill();
        context.fillStyle = "#fff8db"; context.shadowColor = item.color; context.shadowBlur = 28; context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.fill();
      } else if (item.type === "planet") {
        if (item.ring) { context.save(); context.rotate(-.24); context.scale(1, .32); context.strokeStyle = `${item.colors[0]}99`; context.lineWidth = Math.max(2, radius * .16); context.beginPath(); context.arc(0, 0, radius * 1.55, 0, TAU); context.stroke(); context.restore(); }
        const light = context.createRadialGradient(-radius * .32, -radius * .38, radius * .06, 0, 0, radius * 1.05);
        light.addColorStop(0, item.colors[0]); light.addColorStop(.48, item.colors[1]); light.addColorStop(1, item.colors[2]);
        context.fillStyle = light; context.shadowColor = item.colors[1]; context.shadowBlur = this.discovered.has(item.id) ? 24 : 8; context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.fill();
        context.fillStyle = "rgba(0,0,0,.22)"; context.beginPath(); context.arc(radius * .22, radius * .12, radius * .9, 0, TAU); context.fill();
      } else if (item.type === "anomaly") {
        context.rotate(time * .42 + item.phase); context.strokeStyle = this.discovered.has(item.id) ? "#a984ff" : "rgba(169,132,255,.25)"; context.lineWidth = 2; context.shadowColor = "#a984ff"; context.shadowBlur = 18;
        for (let ring = 1; ring <= 3; ring += 1) { context.beginPath(); for (let index = 0; index < 7; index += 1) { const angle = index / 7 * TAU + ring * .18; const size = radius * (.35 + ring * .25); const x = Math.cos(angle) * size; const y = Math.sin(angle) * size; index ? context.lineTo(x, y) : context.moveTo(x, y); } context.closePath(); context.stroke(); }
      } else if (item.type === "beacon") {
        context.rotate(time * .25 + item.phase); context.strokeStyle = "#ffc857"; context.fillStyle = "rgba(255,200,87,.14)"; context.lineWidth = 2; context.shadowColor = "#ffc857"; context.shadowBlur = 16; context.beginPath(); context.moveTo(0, -radius); context.lineTo(radius * .72, 0); context.lineTo(0, radius); context.lineTo(-radius * .72, 0); context.closePath(); context.fill(); context.stroke(); context.fillStyle = "#fff2bd"; context.fillRect(-2, -2, 4, 4);
      } else if (item.type === "wreck") {
        context.rotate(item.phase); context.strokeStyle = "#ff8a5b"; context.lineWidth = 2; context.shadowColor = "#ff5fa6"; context.shadowBlur = 9; context.beginPath(); context.moveTo(-radius, radius * .55); context.lineTo(radius, 0); context.lineTo(-radius * .55, -radius * .6); context.lineTo(-radius * .2, 0); context.closePath(); context.stroke();
      } else if (item.type === "crystal") {
        context.rotate(time + item.phase); context.fillStyle = "#78f7ff"; context.shadowColor = "#5ee9ff"; context.shadowBlur = 12; context.beginPath(); context.moveTo(0, -radius); context.lineTo(radius * .7, 0); context.lineTo(0, radius); context.lineTo(-radius * .7, 0); context.closePath(); context.fill();
      } else if (item.type === "asteroid") {
        context.rotate(item.phase + time * item.spin); context.fillStyle = "#263445"; context.strokeStyle = "#43566b"; context.lineWidth = 1; context.beginPath();
        for (let index = 0; index < item.vertices; index += 1) { const angle = index / item.vertices * TAU; const wobble = .72 + ((index * 17 + item.vertices) % 5) * .07; const x = Math.cos(angle) * radius * wobble; const y = Math.sin(angle) * radius * wobble; index ? context.lineTo(x, y) : context.moveTo(x, y); }
        context.closePath(); context.fill(); context.stroke();
      }
      context.restore();
      if (this.discovered.has(item.id) && !["asteroid", "crystal"].includes(item.type) && distance(item, this.state.ship) < 920) {
        context.save(); context.font = '700 8px "Be Vietnam Pro", sans-serif'; context.fillStyle = item.id === this.selectedId ? "#ffffff" : "rgba(194,218,235,.72)"; context.textAlign = "center"; context.fillText(item.name, point.x, point.y + radius + 18); context.restore();
      }
    }

    drawShip(context, time) {
      const ship = this.state.ship;
      const x = this.viewWidth / 2; const y = this.viewHeight / 2;
      context.save(); context.translate(x, y); context.rotate(ship.angle);
      if ((this.input.thrust || this.autopilotThrust) && ship.fuel > 0 && !this.paused) {
        const flame = 17 + Math.sin(time * 28) * 5 + (this.input.boost ? 13 : 0);
        const gradient = context.createLinearGradient(-8, 0, -flame - 10, 0); gradient.addColorStop(0, "#fff4ba"); gradient.addColorStop(.35, "#5ee9ff"); gradient.addColorStop(1, "rgba(169,132,255,0)"); context.fillStyle = gradient; context.shadowColor = "#5ee9ff"; context.shadowBlur = 15; context.beginPath(); context.moveTo(-9, -5); context.lineTo(-flame - 10, 0); context.lineTo(-9, 5); context.closePath(); context.fill();
      }
      context.shadowColor = "#5ee9ff"; context.shadowBlur = 18; context.fillStyle = "#dffbff"; context.strokeStyle = "#5ee9ff"; context.lineWidth = 1.4; context.beginPath(); context.moveTo(17, 0); context.lineTo(-10, 10); context.lineTo(-6, 3); context.lineTo(-13, 0); context.lineTo(-6, -3); context.lineTo(-10, -10); context.closePath(); context.fill(); context.stroke();
      context.fillStyle = "#ff5fa6"; context.beginPath(); context.arc(3, 0, 3, 0, TAU); context.fill();
      context.restore();
    }

    drawMinimap() {
      const rect = this.minimap.getBoundingClientRect();
      const width = Math.max(100, Math.round(rect.width * 2)); const height = Math.max(70, Math.round(rect.height * 2));
      if (this.minimap.width !== width || this.minimap.height !== height) { this.minimap.width = width; this.minimap.height = height; }
      const context = this.minimapContext;
      context.clearRect(0, 0, width, height); context.fillStyle = "rgba(1,6,13,.92)"; context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(94,233,255,.12)"; context.strokeRect(.5, .5, width - 1, height - 1);
      const mapPoint = (item) => ({ x: (item.x / WORLD.width + .5) * width, y: (item.y / WORLD.height + .5) * height });
      this.objects.forEach((item) => {
        if (!["planet", "anomaly", "beacon", "star"].includes(item.type) || (item.type !== "star" && !this.discovered.has(item.id))) return;
        const point = mapPoint(item); context.fillStyle = { planet: "#5ee9ff", anomaly: "#a984ff", beacon: "#ffc857", star: "#fff3b0" }[item.type]; context.beginPath(); context.arc(point.x, point.y, item.type === "star" ? 3 : 1.7, 0, TAU); context.fill();
      });
      const ship = mapPoint(this.state.ship); context.fillStyle = "#ff5fa6"; context.shadowColor = "#ff5fa6"; context.shadowBlur = 8; context.beginPath(); context.arc(ship.x, ship.y, 2.6, 0, TAU); context.fill(); context.shadowBlur = 0;
    }

    async loadLeaderboard(force = false) {
      if (this.loadingLeaderboard && !force) return;
      const list = this.root?.querySelector("[data-leaderboard]");
      const status = this.root?.querySelector("[data-online-status]");
      if (!list || !status) return;
      this.loadingLeaderboard = true; status.textContent = "Đang kết nối trạm chỉ huy...";
      try {
        if (!this.apiBase) throw new Error("Backend chưa sẵn sàng");
        const response = await fetch(`${this.apiBase}/api/modules/space-explorer/items?view=leaderboard`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không tải được bảng xếp hạng");
        const items = Array.isArray(data.items) ? data.items : [];
        status.textContent = items.length ? `${items.length} phi công · cập nhật trực tuyến` : "Chưa có điểm online. Hãy là phi công đầu tiên.";
        this.renderLeaderboard(items);
      } catch (error) {
        status.textContent = "Chế độ cục bộ · điểm sẽ đồng bộ khi máy chủ hoạt động";
        this.renderLeaderboard([]);
      } finally { this.loadingLeaderboard = false; }
    }

    renderLeaderboard(items) {
      const list = this.root.querySelector("[data-leaderboard]");
      const rows = items.length ? items : [{ position: 1, pilot: "Bạn · dữ liệu cục bộ", rank: this.rank(), score: this.state.score, sectors: this.state.stats.sectors }];
      list.innerHTML = rows.map((item, index) => `<li><b>${String(item.position || index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(item.pilot || "Phi công HH")}</strong><small>${escapeHtml(item.rank || "Tân binh")} · ${formatNumber(item.sectors || 1)} vùng sao</small></span><em>${formatNumber(item.score)}</em></li>`).join("");
    }

    async syncScore(force = false) {
      const now = Date.now();
      if (!force && now - this.lastSync < 45000) return;
      const token = localStorage.getItem("hh-auth-token") || "";
      if (!this.apiBase || !token || this.state.score <= 0) return;
      this.lastSync = now;
      try {
        const response = await fetch(`${this.apiBase}/api/modules/space-explorer/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: "ASTRA HH score", type: "score", data: { score: Math.round(this.state.score), rank: this.rank(), level: this.state.level, sectors: this.state.stats.sectors, discoveries: this.state.stats.discoveries, playSeconds: Math.round(this.state.stats.playSeconds) } })
        });
        if (!response.ok) throw new Error("Sync failed");
        const status = this.root?.querySelector("[data-save-status]");
        if (status) status.textContent = "ĐÃ ĐỒNG BỘ ONLINE";
      } catch { this.lastSync = 0; }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      cancelAnimationFrame(this.frame);
      clearTimeout(this.toastTimer);
      this.timeouts.forEach(clearTimeout);
      this.cleanupTasks.splice(0).forEach((cleanup) => cleanup());
      this.save({ sync: true });
      this.audioContext?.close?.().catch(() => {});
      this.host.innerHTML = "";
    }
  }

  let activeGame = null;
  window.HHSpaceExplorer = {
    mount(host, options = {}) {
      if (!(host instanceof Element)) return;
      activeGame?.destroy();
      activeGame = new AstraExplorer(host, options);
      return activeGame;
    },
    unmount() { activeGame?.destroy(); activeGame = null; },
    get active() { return activeGame; }
  };
  window.dispatchEvent(new CustomEvent("hh:space-explorer-ready"));
})();
