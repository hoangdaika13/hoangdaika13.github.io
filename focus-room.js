(function initHHFocusRoom(global) {
  "use strict";

  const VERSION = 2;
  const ROUTE = "/focus-room";
  const REALTIME_SERVICE = "focus-room";
  const ROOM_CODE = /^[A-Z0-9]{6,12}$/;
  const STATE_PREFIX = "hh.focus-room.v2.";
  const LEGACY_KEY = "hh.galaxy.domain-views.v1";
  const LEGACY_STUDY_PREFIX = "hh.focus.study-room.v1";
  const DB_NAME = "hh-focus-room-media-v1";
  const DB_STORE = "scenes";
  const FALLBACK_IMAGE = "assets/focus-room/rainy-window.webp";
  const THREE_MODULE = "./vendor/three.module.min.js";
  const instances = new WeakMap();
  const mountedRoots = new Set();

  const MUSIC_TRACKS = Object.freeze([
    Object.freeze({
      id: "hh-lofi-calm", title: "Lo-fi HH dịu", artist: "Tạo cục bộ trên thiết bị", kind: "procedural",
      description: "Hòa âm 68 BPM, piano điện mềm và nhiễu đĩa rất nhẹ; không tải tệp ngoài.", license: "Âm thanh tổng hợp cục bộ", duration: 0
    }),
    Object.freeze({
      id: "bach-prelude-bwv848", title: "Prelude No. 3 · BWV 848", artist: "Kimiko Ishizaka", kind: "file",
      description: "Piano cổ điển sáng, nhịp đều cho một phiên học ngắn.", license: "CC0 1.0", duration: 75.44,
      src: "assets/focus-room/music/bach-prelude-bwv848-kimiko-ishizaka.mp3"
    }),
    Object.freeze({
      id: "bach-canon-bwv1080", title: "Canon Alla Ottava · BWV 1080", artist: "Kimiko Ishizaka", kind: "file",
      description: "Piano đối âm tĩnh, dài hơn cho đọc và ghi chú.", license: "CC0 1.0", duration: 138.72,
      src: "assets/focus-room/music/bach-canon-alla-ottava-kimiko-ishizaka.mp3"
    })
  ]);

  const PET_DEPTH_PROFILES = Object.freeze({
    "pet-rain": Object.freeze({ x: 0.17, y: 0.75, radiusX: 0.15, radiusY: 0.12, imageX: 0.21, pace: 0.74 }),
    "pet-sunroom": Object.freeze({ x: 0.31, y: 0.64, radiusX: 0.18, radiusY: 0.14, imageX: 0.34, pace: 0.66 }),
    "pet-fire": Object.freeze({ x: 0.21, y: 0.55, radiusX: 0.16, radiusY: 0.13, imageX: 0.23, pace: 0.7 }),
    "pet-garden": Object.freeze({ x: 0.82, y: 0.72, radiusX: 0.14, radiusY: 0.12, imageX: 0.79, pace: 0.68 }),
    "pet-river": Object.freeze({ x: 0.77, y: 0.61, radiusX: 0.15, radiusY: 0.13, imageX: 0.75, pace: 0.72 }),
    "pet-lake": Object.freeze({ x: 0.15, y: 0.62, radiusX: 0.15, radiusY: 0.14, imageX: 0.19, pace: 0.64 })
  });

  const CHANNELS = Object.freeze([
    { id: "rain", label: "Mưa nhẹ", icon: "☂", default: 0.48, type: "rain", filter: "highpass", frequency: 920, q: 0.2, trim: 0.34, drift: 0.035, depth: 0.045, pan: -0.08 },
    { id: "heavy-rain", label: "Mưa rào", icon: "☔", default: 0, type: "heavy-rain", filter: "bandpass", frequency: 760, q: 0.35, trim: 0.28, drift: 0.047, depth: 0.055, pan: 0.08 },
    { id: "thunder", label: "Sấm rất xa", icon: "⌁", default: 0.07, type: "thunder", filter: "lowpass", frequency: 185, q: 0.55, trim: 0.23, drift: 0.021, depth: 0.035, pan: -0.16 },
    { id: "wind", label: "Gió qua tán lá", icon: "≋", default: 0.14, type: "wind", filter: "lowpass", frequency: 680, q: 0.25, trim: 0.27, drift: 0.028, depth: 0.065, pan: 0.14 },
    { id: "fire", label: "Lửa tí tách", icon: "♨", default: 0.16, type: "fire", filter: "bandpass", frequency: 1380, q: 0.45, trim: 0.24, drift: 0.061, depth: 0.035, pan: 0.18 },
    { id: "cafe", label: "Quán cà phê xa", icon: "☕", default: 0.1, type: "cafe", filter: "lowpass", frequency: 1050, q: 0.3, trim: 0.22, drift: 0.026, depth: 0.045, pan: -0.12 },
    { id: "keyboard", label: "Bàn phím êm", icon: "⌨", default: 0.06, type: "keyboard", filter: "highpass", frequency: 1550, q: 0.2, trim: 0.18, drift: 0.073, depth: 0.025, pan: 0.1 },
    { id: "pages", label: "Giấy và lật sách", icon: "▤", default: 0, type: "pages", filter: "bandpass", frequency: 1180, q: 0.35, trim: 0.2, drift: 0.039, depth: 0.035, pan: -0.18 },
    { id: "birds", label: "Chim sớm ngoài xa", icon: "♧", default: 0.08, type: "birds", filter: "bandpass", frequency: 2550, q: 0.55, trim: 0.13, drift: 0.019, depth: 0.045, pan: 0.2 },
    { id: "ocean", label: "Sóng biển dịu", icon: "≈", default: 0.18, type: "ocean", filter: "lowpass", frequency: 560, q: 0.25, trim: 0.34, drift: 0.031, depth: 0.075, pan: -0.08 },
    { id: "stream", label: "Suối đá nhỏ", icon: "⌇", default: 0.14, type: "stream", filter: "bandpass", frequency: 1280, q: 0.3, trim: 0.27, drift: 0.043, depth: 0.055, pan: 0.12 },
    { id: "white", label: "White noise mềm", icon: "W", default: 0, type: "white", filter: "lowpass", frequency: 5200, q: 0.1, trim: 0.16, drift: 0.017, depth: 0.018, pan: 0 },
    { id: "brown", label: "Brown noise ấm", icon: "B", default: 0.06, type: "brown", filter: "lowpass", frequency: 640, q: 0.2, trim: 0.32, drift: 0.023, depth: 0.028, pan: 0 },
    { id: "pink", label: "Pink noise dịu", icon: "P", default: 0, type: "pink", filter: "lowpass", frequency: 1700, q: 0.2, trim: 0.21, drift: 0.02, depth: 0.024, pan: 0 },
    { id: "purr", label: "Mèo gừ êm", icon: "🐈", default: 0.055, type: "purr", filter: "lowpass", frequency: 310, q: 0.4, trim: 0.19, drift: 0.12, depth: 0.025, pan: -0.14 },
    { id: "pet-breath", label: "Thú cưng ngủ", icon: "🐾", default: 0.045, type: "pet-breath", filter: "lowpass", frequency: 520, q: 0.25, trim: 0.13, drift: 0.09, depth: 0.02, pan: 0.12 }
  ]);

  const SCENES = Object.freeze([
    scene("rainy-window", "Góc học ngày mưa", "Đêm", "Mưa trên kính, lò sưởi và ánh đèn vàng.", "night", "rain", "assets/focus-room/rainy-window.webp", ["rain", "heavy-rain", "fire"]),
    scene("library-night", "Thư viện đêm", "Đêm", "Thư viện gỗ ấm, cửa sổ mưa và khoảng lặng sâu.", "night", "rain", "assets/focus-room/library-night.webp", ["rain", "fire", "pages"]),
    scene("snow-cabin", "Cabin tuyết", "Thiên nhiên", "Cabin trên núi với tuyết rơi và lửa ấm.", "nature", "snow", "assets/focus-room/snow-cabin.webp", ["wind", "fire"]),
    scene("japanese-kissaten", "Kissaten Nhật Bản", "Cà phê", "Quán cà phê Nhật yên tĩnh trước bình minh.", "cafe", "cafe-rain", "assets/focus-room/japanese-kissaten.webp", ["rain", "cafe", "pages"]),
    scene("hanoi-rain-cafe", "Cà phê Hà Nội", "Cà phê", "Góc cà phê phin nhìn phố mưa dịu.", "cafe", "cafe-rain", "assets/focus-room/hanoi-rain-cafe.webp", ["rain", "heavy-rain", "cafe"]),
    scene("ocean-sunset", "Biển hoàng hôn", "Thiên nhiên", "Bàn học hướng biển trong ánh hoàng hôn.", "nature", "ocean", "assets/focus-room/ocean-sunset.webp", ["ocean", "wind"]),
    scene("fireside-cottage", "Nhà đá bên lửa", "Ấm áp", "Phòng đọc cổ điển với lò sưởi chân thật.", "cozy", "embers", "assets/focus-room/fireside-cottage.webp", ["fire", "wind"]),
    scene("forest-morning", "Rừng sớm", "Thiên nhiên", "Nhà học mở cạnh suối và sương sớm.", "nature", "forest", "assets/focus-room/forest-morning.webp", ["birds", "stream"]),
    scene("cyber-city", "Thành phố neon", "Tương lai", "Không gian tập trung nhìn thành phố mưa neon.", "future", "neon-rain", "assets/focus-room/cyber-city.webp", ["rain", "brown"]),
    scene("orbital-desk", "Bàn học quỹ đạo", "Tương lai", "Trạm quan sát yên tĩnh phía trên Trái Đất.", "future", "stars", "assets/focus-room/orbital-desk.webp", ["brown", "pink"]),
    scene("minimal-dark", "Phòng tối tối giản", "Tối giản", "Bàn học ít nhiễu với một vùng sáng ấm.", "quiet", "dust", "assets/focus-room/minimal-dark.webp", ["brown", "keyboard"]),
    scene("twilight-garden", "Phòng anime chạng vạng", "Minh họa", "Góc học anime nguyên bản, không nhân vật bản quyền, nhìn ra vườn đom đóm.", "illustrated", "fireflies", "assets/focus-room/twilight-garden.webp", ["birds", "stream"]),
    scene("rooftop-sunrise", "Sân thượng bình minh", "Bình minh", "Bàn gỗ trên sân thượng yên tĩnh khi thành phố vừa thức giấc.", "nature", "sunrise", "assets/focus-room/rooftop-sunrise.webp", ["birds", "wind"]),
    scene("rainy-greenhouse", "Nhà kính ngày mưa", "Ngày mưa", "Góc học giữa cây xanh, kính đọng nước và mưa rơi rất nhẹ.", "nature", "greenhouse", "assets/focus-room/rainy-greenhouse.webp", ["rain", "stream"]),
    scene("alpine-lake-dawn", "Hồ núi ban mai", "Bình minh", "Mặt hồ phẳng, sương sớm và ánh nắng đầu ngày trên núi.", "nature", "lake-mist", "assets/focus-room/alpine-lake-dawn.webp", ["wind", "stream", "birds"]),
    scene("university-reading-hall", "Đại sảnh đọc sách", "Học thuật", "Thư viện cổ sau giờ đóng cửa, đèn bàn ấm và bụi sáng lơ lửng.", "cozy", "light-shafts", "assets/focus-room/university-reading-hall.webp", ["pages", "brown"]),
    scene("nordic-cabin-morning", "Cabin Bắc Âu buổi sớm", "Buổi sáng", "Góc gỗ tối giản nhìn rừng thông, vịnh sương và tách trà ấm.", "cozy", "cabin-morning", "assets/focus-room/nordic-cabin-morning.webp", ["wind", "birds", "brown"]),
    scene("rice-terrace-veranda", "Hiên ruộng bậc thang", "Bình minh", "Hiên tre nhìn thung lũng xanh, nắng sớm và làn gió đồng dịu.", "nature", "terrace-breeze", "assets/focus-room/rice-terrace-veranda.webp", ["birds", "wind", "stream"]),
    scene("autumn-garden-room", "Phòng vườn mùa thu", "Chiều thu", "Phòng gỗ mở ra khu vườn lá đỏ, nắng chiều ấm và tĩnh.", "nature", "autumn-leaves", "assets/focus-room/autumn-garden-room.webp", ["birds", "wind", "stream"]),
    scene("moonlit-observatory", "Đài quan sát trăng", "Đêm", "Bàn học dưới mái vòm, ánh trăng lạnh và bầu trời sao yên tĩnh.", "night", "moonlight", "assets/focus-room/moonlit-observatory.webp", ["wind", "brown", "pink"]),
    scene("cat-rainy-attic", "Gác mái mưa cùng mèo", "Ngày mưa", "Mèo lông cam ngủ cạnh bàn gỗ, mưa mềm trên ô cửa và đèn vàng ấm.", "pets", "pet-rain", "assets/focus-room/cat-rainy-attic.webp", ["rain", "purr", "fire"]),
    scene("dog-sunroom", "Phòng nắng cùng cún", "Buổi sáng", "Cún retriever nghỉ trên thảm, rèm vải lay nhẹ và đồng cỏ ngập nắng.", "pets", "pet-sunroom", "assets/focus-room/dog-sunroom.webp", ["birds", "wind", "pet-breath"]),
    scene("cat-fireplace-library", "Thư viện lò sưởi cùng mèo", "Đêm", "Mèo xám nằm bên cửa sổ mưa, lửa ấm và căn phòng đọc thật tĩnh.", "pets", "pet-fire", "assets/focus-room/cat-fireplace-library.webp", ["rain", "fire", "purr"]),
    scene("dog-spring-veranda", "Hiên vườn xuân cùng cún", "Buổi sáng", "Cún nhỏ ngủ bên bàn học, nắng xuyên vườn và cánh hoa trôi chậm.", "pets", "pet-garden", "assets/focus-room/dog-spring-veranda.webp", ["birds", "wind", "pet-breath"]),
    scene("cat-riverside-blue-hour", "Nhà bên sông cùng mèo", "Chạng vạng", "Mèo mướp cuộn mình bên cửa, mưa bụi và ánh sông xanh dịu.", "pets", "pet-river", "assets/focus-room/cat-riverside-blue-hour.webp", ["rain", "stream", "purr"]),
    scene("puppy-lakeside-cabin", "Cabin hồ cùng cún nhỏ", "Bình minh", "Cún con ngủ trong ổ len, hồ sương và rừng thông đón nắng đầu ngày.", "pets", "pet-lake", "assets/focus-room/puppy-lakeside-cabin.webp", ["wind", "stream", "pet-breath"])
  ]);

  const MIX_PRESETS = Object.freeze({
    "deep-work": { label: "Tập trung sâu", mix: { brown: 0.24, pink: 0.07, keyboard: 0.035 } },
    "rainy-night": { label: "Mưa đêm êm", mix: { rain: 0.5, thunder: 0.045, wind: 0.08, fire: 0.11 } },
    "quiet-cafe": { label: "Cà phê xa", mix: { cafe: 0.22, rain: 0.14, keyboard: 0.04 } },
    "green-morning": { label: "Rừng ban mai", mix: { birds: 0.1, stream: 0.23, wind: 0.065 } },
    "ocean-flow": { label: "Sóng thở chậm", mix: { ocean: 0.31, wind: 0.065, pink: 0.04 } },
    "glasshouse": { label: "Nhà kính mưa", mix: { rain: 0.42, stream: 0.11, wind: 0.035 } },
    "warm-library": { label: "Thư viện ấm", mix: { pages: 0.08, fire: 0.08, brown: 0.12 } },
    "soft-silence": { label: "Tĩnh lặng mềm", mix: { brown: 0.12, pink: 0.045 } }
  });

  const TIMER_PRESETS = Object.freeze([
    { id: "classic", label: "Cổ điển", focus: 25, rest: 5, longRest: 15 },
    { id: "steady", label: "Ổn định", focus: 45, rest: 15, longRest: 20 },
    { id: "flow", label: "Flow", focus: 50, rest: 10, longRest: 20 },
    { id: "deep", label: "Deep Work", focus: 90, rest: 20, longRest: 30 }
  ]);

  const FOCUS_RITUALS = Object.freeze([
    Object.freeze({
      id: "rain-deep", name: "Mưa sâu 50 phút", description: "Mưa dịu, lo-fi và một chu kỳ Flow.",
      sceneId: "rainy-window", mixPreset: "rainy-night", musicId: "hh-lofi-calm", focus: 50, rest: 10, longRest: 20, cycles: 4
    }),
    Object.freeze({
      id: "library-reading", name: "Đọc sâu trong thư viện", description: "Giấy, nền nâu ấm và piano CC0.",
      sceneId: "university-reading-hall", mixPreset: "warm-library", musicId: "bach-canon-bwv1080", focus: 45, rest: 15, longRest: 20, cycles: 4
    }),
    Object.freeze({
      id: "green-morning", name: "Khởi động buổi sáng", description: "Rừng, chim xa và phiên 25 phút nhẹ.",
      sceneId: "forest-morning", mixPreset: "green-morning", musicId: "hh-lofi-calm", focus: 25, rest: 5, longRest: 15, cycles: 4
    })
  ]);

  function scene(id, title, time, description, category, effect, image, soundIds) {
    const mix = {};
    soundIds.forEach((soundId) => {
      const channel = CHANNELS.find((item) => item.id === soundId);
      mix[soundId] = channel ? channel.default : 0.1;
    });
    const performance = ["rain", "cafe-rain", "neon-rain", "snow", "greenhouse", "autumn-leaves", "pet-rain", "pet-fire", "pet-river"].includes(effect) ? "Cao" : ["ocean", "embers", "forest", "fireflies", "stars", "sunrise", "lake-mist", "light-shafts", "cabin-morning", "terrace-breeze", "moonlight", "pet-sunroom", "pet-garden", "pet-lake"].includes(effect) ? "Cân bằng" : "Tiết kiệm";
    return Object.freeze({ id, title, time, description, category, effect, image, thumb: image.replace("/focus-room/", "/focus-room/thumbs/"), mix, performance, soundStatus: soundIds.length ? `${soundIds.length} kênh gợi ý` : "Cảnh yên tĩnh" });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }

  function cleanText(value, maximum = 160) {
    return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function id(prefix = "hfr") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function accountFingerprint(options = {}) {
    const user = options.currentUser && typeof options.currentUser === "object" ? options.currentUser : {};
    const raw = cleanText(user.id || user._id || user.email || user.username || "guest", 180).toLowerCase();
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return raw === "guest" ? "guest" : `account-${(hash >>> 0).toString(36)}`;
  }

  function legacyAccountId(options = {}) {
    const user = options.currentUser && typeof options.currentUser === "object" ? options.currentUser : {};
    return cleanText(user._id || user.id || user.userId || user.email || "guest", 120)
      .replace(/[^a-z0-9@._-]/gi, "-") || "guest";
  }

  function timestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeRead(key, fallback = null) {
    try {
      const raw = global.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function defaultMix() {
    const mix = Object.fromEntries(CHANNELS.map((channel) => [channel.id, 0]));
    mix.rain = 0.46;
    mix.fire = 0.1;
    return mix;
  }

  function defaultLayout() {
    return {
      locked: true,
      clock: { x: 0, y: 0 },
      title: { x: 0, y: 0 },
      dock: { x: 0, y: 0 }
    };
  }

  function normalizeLayoutPoint(value) {
    const point = value && typeof value === "object" ? value : {};
    return { x: clamp(point.x, -1, 1, 0), y: clamp(point.y, -1, 1, 0) };
  }

  function createDefaultState() {
    const reduceMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    return {
      version: VERSION,
      scenes: { selected: "rainy-window", favorites: [], pinned: [], recent: ["rainy-window"], custom: [] },
      audio: {
        master: 0.5, mix: defaultMix(), presets: [],
        music: { selected: "hh-lofi-calm", volume: 0.28, loop: true }
      },
      timer: {
        phase: "focus", focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15,
        cycle: 1, cycles: 4, running: false, endsAt: 0, remaining: 1500,
        duration: 1500, startedAt: 0, sessionId: "", previousScene: ""
      },
      tasks: [],
      primaryTaskId: "",
      note: "",
      history: [],
      planning: {
        dailyGoalMinutes: 120,
        intention: "",
        rituals: [],
        distractions: []
      },
      layout: defaultLayout(),
      settings: {
        quality: "balanced", motion: !reduceMotion, reducedMotion: reduceMotion,
        dataSaver: false, autoStartBreak: false, autoStartFocus: false,
        sceneOnBreak: false, restScene: "ocean-sunset", notifications: false
      },
      updatedAt: Date.now()
    };
  }

  function legacyState() {
    const raw = safeRead(LEGACY_KEY, null);
    if (!raw || typeof raw !== "object") return null;
    const next = createDefaultState();
    const sceneMap = { rainy: "rainy-window", cafe: "hanoi-rain-cafe", cozy: "fireside-cottage", forest: "forest-morning", deep: "orbital-desk" };
    next.scenes.selected = sceneMap[raw.ambientScene] || next.scenes.selected;
    next.scenes.recent = [next.scenes.selected];
    next.timer.focusMinutes = clamp(raw.timerMinutes, 1, 180, 25);
    next.timer.remaining = next.timer.focusMinutes * 60;
    next.timer.duration = next.timer.remaining;
    if (raw.mix && typeof raw.mix === "object") {
      next.audio.mix.rain = clamp(raw.mix.rain, 0, 1, next.audio.mix.rain);
      next.audio.mix.wind = clamp(raw.mix.wind, 0, 1, next.audio.mix.wind);
      next.audio.mix.fire = clamp(raw.mix.fire, 0, 1, next.audio.mix.fire);
      next.audio.mix.brown = clamp(raw.mix.focus, 0, 1, next.audio.mix.brown);
    }
    return next;
  }

  function legacyStudyState(options = {}) {
    const raw = safeRead(`${LEGACY_STUDY_PREFIX}:${legacyAccountId(options)}`, null);
    if (!raw || typeof raw !== "object") return null;
    const next = createDefaultState();
    const oldSettings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const oldTimer = raw.timer && typeof raw.timer === "object" ? raw.timer : {};
    const oldSound = raw.sound && typeof raw.sound === "object" ? raw.sound : {};
    next.tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 100).map((task) => ({
      id: cleanText(task?.id, 100) || id("task"),
      title: cleanText(task?.title, 180),
      target: Math.round(clamp(task?.estimate, 1, 20, 1)),
      done: task?.done === true,
      createdAt: timestamp(task?.createdAt, Date.now())
    })).filter((task) => task.title);
    const taskIds = new Set(next.tasks.map((task) => task.id));
    next.primaryTaskId = taskIds.has(oldTimer.taskId) ? oldTimer.taskId : "";
    next.note = String(raw.note || "").slice(0, 10000);
    next.audio.mix.rain = clamp(oldSound.rain, 0, 1, next.audio.mix.rain);
    next.audio.mix.brown = clamp(oldSound.brown, 0, 1, next.audio.mix.brown);
    next.audio.mix.cafe = clamp(oldSound.cafe, 0, 1, next.audio.mix.cafe);
    next.timer.phase = oldTimer.mode === "focus" ? "focus" : oldTimer.mode === "long-break" ? "long-break" : "break";
    next.timer.focusMinutes = clamp(oldSettings.focusMinutes, 1, 180, 25);
    next.timer.breakMinutes = clamp(oldSettings.shortBreakMinutes, 1, 60, 5);
    next.timer.longBreakMinutes = clamp(oldSettings.longBreakMinutes, 1, 90, 15);
    next.timer.cycle = Math.max(1, Math.floor(Number(oldTimer.completedFocusCycles) || 0) + 1);
    next.timer.cycles = Math.round(clamp(oldSettings.longBreakEvery, 2, 12, 4));
    next.timer.duration = Math.round(clamp(oldTimer.durationSeconds, 60, 180 * 60, next.timer.focusMinutes * 60));
    next.timer.remaining = Math.round(clamp(oldTimer.remainingSeconds, 0, next.timer.duration, next.timer.duration));
    next.timer.endsAt = timestamp(oldTimer.endsAt, 0);
    next.timer.startedAt = timestamp(oldTimer.startedAt, 0);
    next.timer.running = oldTimer.status === "running" && next.timer.endsAt > Date.now();
    next.timer.sessionId = next.timer.running ? `legacy-${next.timer.startedAt || next.timer.endsAt}` : "";
    next.history = (Array.isArray(raw.history) ? raw.history : []).filter((entry) => entry?.mode === "focus").slice(-400).map((entry) => {
      const endedAt = timestamp(entry.completedAt, 0);
      const durationSeconds = Math.round(clamp(entry.durationSeconds, 1, 180 * 60, 1));
      const task = next.tasks.find((item) => item.id === entry.taskId);
      return {
        id: cleanText(entry.id, 100) || id("session"),
        startedAt: timestamp(entry.startedAt, Math.max(1, endedAt - durationSeconds * 1000)),
        endedAt,
        durationSeconds,
        taskId: task?.id || "",
        taskTitle: task?.title || "",
        sceneId: next.scenes.selected
      };
    }).filter((entry) => entry.endedAt > 0);
    next.settings.autoStartBreak = oldSettings.autoStartBreaks === true;
    next.settings.autoStartFocus = oldSettings.autoStartFocus === true;
    next.settings.reducedMotion = oldSettings.reducedMotion === true;
    next.settings.motion = oldSettings.reducedMotion !== true;
    next.updatedAt = timestamp(raw.updatedAt, Date.now());
    return next;
  }

  function normalizeState(raw) {
    const base = createDefaultState();
    const source = raw && typeof raw === "object" ? raw : {};
    const scenes = source.scenes && typeof source.scenes === "object" ? source.scenes : {};
    const audio = source.audio && typeof source.audio === "object" ? source.audio : {};
    const timer = source.timer && typeof source.timer === "object" ? source.timer : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const layout = source.layout && typeof source.layout === "object" ? source.layout : {};
    const planning = source.planning && typeof source.planning === "object" ? source.planning : {};
    const custom = Array.isArray(scenes.custom) ? scenes.custom.slice(0, 24).map((item) => ({
      id: cleanText(item?.id, 80),
      title: cleanText(item?.title, 80) || "Không gian cá nhân",
      createdAt: clamp(item?.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
    })).filter((item) => item.id) : [];
    const validSceneIds = new Set([...SCENES.map((item) => item.id), ...custom.map((item) => item.id)]);
    const normalizeIds = (value, maximum) => Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item, 80)).filter((item) => validSceneIds.has(item)))].slice(0, maximum) : [];
    const normalizedMix = defaultMix();
    CHANNELS.forEach((channel) => { normalizedMix[channel.id] = clamp(audio.mix?.[channel.id], 0, 1, normalizedMix[channel.id]); });
    const normalizedTimer = {
      phase: ["focus", "break", "long-break"].includes(timer.phase) ? timer.phase : "focus",
      focusMinutes: clamp(timer.focusMinutes, 1, 180, 25),
      breakMinutes: clamp(timer.breakMinutes, 1, 60, 5),
      longBreakMinutes: clamp(timer.longBreakMinutes, 1, 90, 15),
      cycle: Math.round(clamp(timer.cycle, 1, 20, 1)),
      cycles: Math.round(clamp(timer.cycles, 1, 20, 4)),
      running: timer.running === true && Number(timer.endsAt) > 0,
      endsAt: clamp(timer.endsAt, 0, Number.MAX_SAFE_INTEGER, 0),
      remaining: Math.round(clamp(timer.remaining, 0, 180 * 60, 25 * 60)),
      duration: Math.round(clamp(timer.duration, 1, 180 * 60, 25 * 60)),
      startedAt: clamp(timer.startedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      sessionId: cleanText(timer.sessionId, 100),
      previousScene: cleanText(timer.previousScene, 80)
    };
    const tasks = Array.isArray(source.tasks) ? source.tasks.slice(0, 100).map((task) => ({
      id: cleanText(task?.id, 100) || id("task"),
      title: cleanText(task?.title, 180),
      target: Math.round(clamp(task?.target, 1, 20, 1)),
      done: task?.done === true,
      createdAt: clamp(task?.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
    })).filter((task) => task.title) : [];
    const taskIds = new Set(tasks.map((task) => task.id));
    const history = Array.isArray(source.history) ? source.history.slice(-400).map((entry) => ({
      id: cleanText(entry?.id, 100) || id("session"),
      startedAt: clamp(entry?.startedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      endedAt: clamp(entry?.endedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      durationSeconds: Math.round(clamp(entry?.durationSeconds, 1, 180 * 60, 1)),
      taskId: cleanText(entry?.taskId, 100),
      taskTitle: cleanText(entry?.taskTitle, 180),
      sceneId: cleanText(entry?.sceneId, 80),
      intention: cleanText(entry?.intention, 240),
      distractionCount: Math.round(clamp(entry?.distractionCount, 0, 1000, 0))
    })).filter((entry) => entry.startedAt && entry.endedAt) : [];
    const rituals = Array.isArray(planning.rituals) ? planning.rituals.slice(0, 12).map((ritual) => ({
      id: cleanText(ritual?.id, 100) || id("ritual"),
      name: cleanText(ritual?.name, 60) || "Bộ tập trung",
      sceneId: validSceneIds.has(ritual?.sceneId) ? ritual.sceneId : base.scenes.selected,
      master: clamp(ritual?.master, 0, 1, base.audio.master),
      mix: Object.fromEntries(CHANNELS.map((channel) => [channel.id, clamp(ritual?.mix?.[channel.id], 0, 1, 0)])),
      music: {
        selected: MUSIC_TRACKS.some((track) => track.id === ritual?.music?.selected) ? ritual.music.selected : base.audio.music.selected,
        volume: clamp(ritual?.music?.volume, 0, 1, base.audio.music.volume),
        loop: ritual?.music?.loop !== false
      },
      timer: {
        focusMinutes: clamp(ritual?.timer?.focusMinutes, 1, 180, 25),
        breakMinutes: clamp(ritual?.timer?.breakMinutes, 1, 60, 5),
        longBreakMinutes: clamp(ritual?.timer?.longBreakMinutes, 1, 90, 15),
        cycles: Math.round(clamp(ritual?.timer?.cycles, 1, 20, 4))
      },
      createdAt: clamp(ritual?.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
    })) : [];
    const distractions = Array.isArray(planning.distractions) ? planning.distractions.slice(-500).map((entry) => ({
      id: cleanText(entry?.id, 100) || id("distraction"),
      label: cleanText(entry?.label, 60) || "Xao nhãng",
      note: cleanText(entry?.note, 180),
      createdAt: clamp(entry?.createdAt, 1, Number.MAX_SAFE_INTEGER, Date.now()),
      sessionId: cleanText(entry?.sessionId, 100),
      taskId: taskIds.has(entry?.taskId) ? entry.taskId : ""
    })) : [];
    return {
      version: VERSION,
      scenes: {
        selected: validSceneIds.has(scenes.selected) ? scenes.selected : base.scenes.selected,
        favorites: normalizeIds(scenes.favorites, 48),
        pinned: normalizeIds(scenes.pinned, 12),
        recent: normalizeIds(scenes.recent, 12),
        custom
      },
      audio: {
        master: clamp(audio.master, 0, 1, base.audio.master),
        mix: normalizedMix,
        music: {
          selected: MUSIC_TRACKS.some((track) => track.id === audio.music?.selected) ? audio.music.selected : base.audio.music.selected,
          volume: clamp(audio.music?.volume, 0, 1, base.audio.music.volume),
          loop: audio.music?.loop !== false
        },
        presets: Array.isArray(audio.presets) ? audio.presets.slice(0, 12).map((preset) => ({
          id: cleanText(preset?.id, 100) || id("mix"),
          name: cleanText(preset?.name, 60) || "Preset",
          mix: Object.fromEntries(CHANNELS.map((channel) => [channel.id, clamp(preset?.mix?.[channel.id], 0, 1, 0)]))
        })) : []
      },
      timer: normalizedTimer,
      tasks,
      primaryTaskId: taskIds.has(source.primaryTaskId) ? source.primaryTaskId : "",
      note: String(source.note || "").slice(0, 10000),
      history,
      planning: {
        dailyGoalMinutes: Math.round(clamp(planning.dailyGoalMinutes, 15, 720, base.planning.dailyGoalMinutes)),
        intention: cleanText(planning.intention, 240),
        rituals,
        distractions
      },
      layout: {
        locked: layout.locked !== false,
        clock: normalizeLayoutPoint(layout.clock),
        title: normalizeLayoutPoint(layout.title),
        dock: normalizeLayoutPoint(layout.dock)
      },
      settings: {
        quality: ["eco", "balanced", "high"].includes(settings.quality) ? settings.quality : base.settings.quality,
        motion: settings.motion !== false,
        reducedMotion: settings.reducedMotion === true,
        dataSaver: settings.dataSaver === true,
        autoStartBreak: settings.autoStartBreak === true,
        autoStartFocus: settings.autoStartFocus === true,
        sceneOnBreak: settings.sceneOnBreak === true,
        restScene: SCENES.some((item) => item.id === settings.restScene) ? settings.restScene : base.settings.restScene,
        notifications: settings.notifications === true && global.Notification?.permission === "granted"
      },
      updatedAt: clamp(source.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
    };
  }

  function readState(storageKey, options) {
    const stored = safeRead(storageKey, null);
    return normalizeState(stored || legacyStudyState(options) || legacyState() || createDefaultState());
  }

  function writeState(instance) {
    instance.state.version = VERSION;
    instance.state.updatedAt = Date.now();
    let persisted = instance.state;
    const personal = instance.sharedRoom?.personalSnapshot;
    if (instance.sharedRoom?.code && personal) {
      if (!instance.sharedRoom.syncScene) personal.sceneId = instance.state.scenes.selected;
      if (!instance.sharedRoom.syncTimer) personal.timer = JSON.parse(JSON.stringify(instance.state.timer));
      if (!instance.sharedRoom.syncAudio) personal.audio = { master: instance.state.audio.master, mix: { ...instance.state.audio.mix } };
      persisted = JSON.parse(JSON.stringify(instance.state));
      persisted.scenes.selected = personal.sceneId;
      persisted.timer = { ...personal.timer };
      persisted.audio.master = personal.audio.master;
      persisted.audio.mix = { ...personal.audio.mix };
    }
    try { global.localStorage?.setItem(instance.storageKey, JSON.stringify(persisted)); }
    catch (error) { announce(instance, "Không thể lưu dữ liệu trên thiết bị.", "error"); }
  }

  function effectiveQuality(instance) {
    if (instance.state.settings.dataSaver || instance.state.settings.reducedMotion) return "eco";
    const memory = Number(global.navigator?.deviceMemory || 0);
    const cores = Number(global.navigator?.hardwareConcurrency || 0);
    if ((memory && memory <= 4) || (cores && cores <= 4)) return instance.state.settings.quality === "high" ? "balanced" : instance.state.settings.quality;
    return instance.state.settings.quality;
  }

  function motionEnabled(instance) {
    return instance.state.settings.motion && !instance.state.settings.reducedMotion && !global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function allScenes(instance) {
    const custom = instance.state.scenes.custom.map((item) => ({
      ...item, time: "Cá nhân", description: "Ảnh do bạn lưu trên thiết bị này.", category: "custom",
      effect: "dust", image: instance.objectUrls.get(item.id) || "", thumb: instance.objectUrls.get(item.id) || "", mix: {}
    }));
    return [...SCENES, ...custom];
  }

  function currentScene(instance) {
    return allScenes(instance).find((item) => item.id === instance.state.scenes.selected) || SCENES[0];
  }

  function imageUrl(instance, targetScene, thumbnail = false) {
    if (!targetScene) return FALLBACK_IMAGE;
    if (targetScene.category === "custom") return targetScene.image || FALLBACK_IMAGE;
    if (thumbnail || effectiveQuality(instance) === "eco" || instance.state.settings.dataSaver) return targetScene.thumb;
    return targetScene.image;
  }

  function formatTimer(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function formatMinutes(seconds) {
    const minutes = Math.round((Number(seconds) || 0) / 60);
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }

  function localDay(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function phaseLabel(phase) {
    return phase === "focus" ? "Đang tập trung" : phase === "long-break" ? "Nghỉ dài" : "Nghỉ ngắn";
  }

  function panelLabel(panel) {
    return ({ plan: "Kế hoạch", scenes: "Không gian", sound: "Âm thanh", timer: "Hẹn giờ", tasks: "Công việc", notes: "Ghi chú", history: "Lịch sử", shared: "Phòng học chung", settings: "Cài đặt" })[panel] || "";
  }

  function focusSummary(instance) {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, reverseIndex) => {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - reverseIndex));
      return { key: localDay(date.getTime()), label: date.toLocaleDateString("vi-VN", { weekday: "short" }), seconds: 0, sessions: 0 };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));
    instance.state.history.forEach((entry) => {
      const day = byDay.get(localDay(entry.endedAt));
      if (!day) return;
      day.seconds += entry.durationSeconds;
      day.sessions += 1;
    });
    const todayKey = localDay();
    const today = byDay.get(todayKey) || { seconds: 0, sessions: 0 };
    const goalSeconds = instance.state.planning.dailyGoalMinutes * 60;
    const completedDays = new Set(instance.state.history.map((entry) => localDay(entry.endedAt)));
    const cursor = new Date(now);
    cursor.setHours(12, 0, 0, 0);
    if (!completedDays.has(localDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (completedDays.has(localDay(cursor.getTime())) && streak < 400) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    const todayDistractions = instance.state.planning.distractions.filter((entry) => localDay(entry.createdAt) === todayKey);
    return {
      days,
      todaySeconds: today.seconds,
      todaySessions: today.sessions,
      todayDistractions,
      goalProgress: Math.min(1, today.seconds / Math.max(60, goalSeconds)),
      remainingSeconds: Math.max(0, goalSeconds - today.seconds),
      streak
    };
  }

  function planPanel(instance) {
    const summary = focusSummary(instance);
    const timer = instance.state.timer;
    const recentDistractions = [...summary.todayDistractions].reverse().slice(0, 8);
    return `<div class="hfr-panel-heading"><div><span>DEEP FOCUS COMMAND</span><h2>Kế hoạch tập trung</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <section class="hfr-plan-hero">
        <div class="hfr-goal-ring" style="--hfr-goal:${summary.goalProgress}" aria-label="Đã hoàn thành ${Math.round(summary.goalProgress * 100)} phần trăm mục tiêu"><strong>${Math.round(summary.goalProgress * 100)}%</strong><span>mục tiêu ngày</span></div>
        <div><span>Hôm nay</span><strong>${formatMinutes(summary.todaySeconds)} · ${summary.todaySessions} phiên</strong><small>${summary.remainingSeconds ? `Còn ${formatMinutes(summary.remainingSeconds)} để đạt mục tiêu` : "Đã đạt mục tiêu hôm nay"} · chuỗi ${summary.streak} ngày</small></div>
      </section>
      <form class="hfr-plan-form" data-hfr-plan-form>
        <label><span>Mục tiêu mỗi ngày</span><span><input name="dailyGoal" type="number" min="15" max="720" step="5" value="${instance.state.planning.dailyGoalMinutes}" required><small>phút</small></span></label>
        <label><span>Ý định cho phiên hiện tại</span><textarea name="intention" maxlength="240" placeholder="Ví dụ: Hoàn thành phần mở đầu, không kiểm tra điện thoại…">${escapeHtml(instance.state.planning.intention)}</textarea></label>
        <div><button type="submit">Lưu kế hoạch</button><button class="hfr-primary" type="button" data-hfr-action="plan-timer-toggle">${timer.running ? "Tạm dừng phiên" : timer.remaining < timer.duration ? "Tiếp tục phiên" : "Bắt đầu phiên"}</button></div>
      </form>
      <section class="hfr-ritual-section">
        <div class="hfr-section-title"><div><strong>Nghi thức một chạm</strong><small>Đổi cảnh, âm thanh, nhạc và chu kỳ; không tự phát âm thanh.</small></div></div>
        <div class="hfr-ritual-grid">${FOCUS_RITUALS.map((ritual) => `<button type="button" data-hfr-action="apply-built-in-ritual" data-id="${ritual.id}"><i>◈</i><span><strong>${escapeHtml(ritual.name)}</strong><small>${escapeHtml(ritual.description)}</small></span></button>`).join("")}</div>
        <form class="hfr-inline-form" data-hfr-ritual-save><label><span>Lưu cấu hình hiện tại</span><input name="name" maxlength="60" required placeholder="Ví dụ: Ôn ngoại ngữ"></label><button type="submit">Lưu bộ</button></form>
        <div class="hfr-saved-rituals">${instance.state.planning.rituals.length ? instance.state.planning.rituals.map((ritual) => `<article><button type="button" data-hfr-action="apply-user-ritual" data-id="${escapeHtml(ritual.id)}"><strong>${escapeHtml(ritual.name)}</strong><small>${ritual.timer.focusMinutes}/${ritual.timer.breakMinutes} phút · ${escapeHtml(allScenes(instance).find((sceneItem) => sceneItem.id === ritual.sceneId)?.title || "Cảnh mặc định")}</small></button><button type="button" data-hfr-action="delete-user-ritual" data-id="${escapeHtml(ritual.id)}" aria-label="Xóa bộ tập trung">×</button></article>`).join("") : `<small>Chưa có bộ tập trung cá nhân.</small>`}</div>
      </section>
      <section class="hfr-distraction-section">
        <div class="hfr-section-title"><div><strong>Ghi nhận xao nhãng</strong><small>Chạm một lần để ghi thời điểm thật, không dừng đồng hồ.</small></div><em>${summary.todayDistractions.length} hôm nay</em></div>
        <div class="hfr-distraction-quick">${["Điện thoại", "Thông báo", "Ý nghĩ chen ngang", "Tiếng ồn"].map((label) => `<button type="button" data-hfr-action="log-distraction" data-value="${escapeHtml(label)}">+ ${escapeHtml(label)}</button>`).join("")}</div>
        <form class="hfr-inline-form" data-hfr-distraction-form><label><span>Ghi nhanh nguyên nhân khác</span><input name="note" maxlength="180" required placeholder="Điều gì vừa làm bạn mất tập trung?"></label><button type="submit">Ghi lại</button></form>
        <div class="hfr-distraction-log">${recentDistractions.length ? recentDistractions.map((entry) => `<article><span><strong>${escapeHtml(entry.label)}</strong><small>${new Date(entry.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</small></span><button type="button" data-hfr-action="delete-distraction" data-id="${escapeHtml(entry.id)}" aria-label="Xóa ghi nhận">×</button></article>`).join("") : `<small>Chưa ghi nhận xao nhãng hôm nay.</small>`}</div>
      </section>`;
  }

  function filteredScenes(instance) {
    const query = instance.ui.search.toLocaleLowerCase("vi");
    return allScenes(instance).filter((item) => {
      if (instance.ui.category === "recent" && !instance.state.scenes.recent.includes(item.id)) return false;
      if (!['all', 'recent'].includes(instance.ui.category) && item.category !== instance.ui.category) return false;
      if (instance.ui.favoritesOnly && !instance.state.scenes.favorites.includes(item.id)) return false;
      return !query || `${item.title} ${item.description} ${item.time}`.toLocaleLowerCase("vi").includes(query);
    }).sort((a, b) => {
      const pinA = instance.state.scenes.pinned.includes(a.id) ? 1 : 0;
      const pinB = instance.state.scenes.pinned.includes(b.id) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      if (instance.ui.category !== "recent") return 0;
      return instance.state.scenes.recent.indexOf(a.id) - instance.state.scenes.recent.indexOf(b.id);
    });
  }

  function scenePanel(instance) {
    const scenes = filteredScenes(instance);
    const categories = [
      ["all", "Tất cả"], ["recent", "Gần đây"], ["night", "Đêm"], ["nature", "Thiên nhiên"], ["cafe", "Cà phê"],
      ["cozy", "Ấm áp"], ["pets", "Thú cưng"], ["future", "Tương lai"], ["quiet", "Tối giản"], ["illustrated", "Minh họa"], ["custom", "Cá nhân"]
    ];
    return `<div class="hfr-panel-heading"><div><span>SCENE LIBRARY</span><h2>Không gian học tập</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-scene-tools">
        <label class="hfr-search"><span>⌕</span><input type="search" data-hfr-scene-search value="${escapeHtml(instance.ui.search)}" placeholder="Tìm không gian…" aria-label="Tìm không gian"></label>
        <button type="button" data-hfr-action="favorites-only" aria-pressed="${instance.ui.favoritesOnly}">♡ Yêu thích</button>
        <button type="button" data-hfr-action="scene-view" aria-label="Đổi kiểu hiển thị">${instance.ui.sceneView === "grid" ? "☷" : "▦"}</button>
      </div>
      <div class="hfr-chip-row" role="group" aria-label="Lọc chủ đề">${categories.map(([id, label]) => `<button type="button" data-hfr-action="scene-category" data-value="${id}" aria-pressed="${instance.ui.category === id}">${label}</button>`).join("")}</div>
      <div class="hfr-scene-grid hfr-scene-grid--${instance.ui.sceneView}">
        ${scenes.length ? scenes.map((item) => sceneCard(instance, item)).join("") : `<div class="hfr-empty"><span>⌕</span><strong>Không tìm thấy không gian</strong><p>Thử từ khóa hoặc bộ lọc khác.</p></div>`}
      </div>
      <form class="hfr-upload" data-hfr-upload-form>
        <div><strong>Không gian của bạn</strong><small>Ảnh JPG, PNG hoặc WebP · tối đa 10 MB · lưu theo tài khoản trên thiết bị.</small></div>
        <label><input type="file" name="scene" accept="image/jpeg,image/png,image/webp" required><span>+ Tải ảnh lên</span></label>
      </form>`;
  }

  function sceneCard(instance, item) {
    const selected = instance.state.scenes.selected === item.id;
    const favorite = instance.state.scenes.favorites.includes(item.id);
    const pinned = instance.state.scenes.pinned.includes(item.id);
    return `<article class="hfr-scene-card${selected ? " is-selected" : ""}">
      <button class="hfr-scene-preview" type="button" data-hfr-action="select-scene" data-id="${escapeHtml(item.id)}" aria-pressed="${selected}">
        <img src="${escapeHtml(imageUrl(instance, item, true))}" alt="" loading="lazy" decoding="async" data-hfr-fallback>
        <span>${escapeHtml(item.time)}</span><i>${selected ? "Đang dùng" : "Mở cảnh"}</i>
      </button>
      <div><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small><span class="hfr-scene-meta"><em>${escapeHtml(item.soundStatus || "Ảnh cá nhân")}</em><em>${escapeHtml(item.performance || "Theo thiết bị")}</em></span></span>
        <span class="hfr-card-actions">
          <button type="button" data-hfr-action="favorite-scene" data-id="${escapeHtml(item.id)}" aria-pressed="${favorite}" aria-label="${favorite ? "Bỏ yêu thích" : "Yêu thích"}">${favorite ? "♥" : "♡"}</button>
          <button type="button" data-hfr-action="pin-scene" data-id="${escapeHtml(item.id)}" aria-pressed="${pinned}" aria-label="${pinned ? "Bỏ ghim" : "Ghim"}">${pinned ? "◆" : "◇"}</button>
          ${item.category === "custom" ? `<button type="button" data-hfr-action="delete-custom-scene" data-id="${escapeHtml(item.id)}" aria-label="Xóa ảnh cá nhân">×</button>` : ""}
        </span>
      </div>
    </article>`;
  }

  function currentMusicTrack(instance) {
    return MUSIC_TRACKS.find((track) => track.id === instance.state.audio.music.selected) || MUSIC_TRACKS[0];
  }

  function musicIsPlaying(instance) {
    return Boolean(instance.music?.playing && !instance.music.suspendedByVisibility);
  }

  function formatPlaybackTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function soundPanel(instance) {
    const audioActive = Boolean(instance.audio);
    const music = currentMusicTrack(instance);
    const musicPlaying = musicIsPlaying(instance);
    const position = instance.music?.trackId === music.id ? Number(instance.music.position || 0) : 0;
    const duration = instance.music?.trackId === music.id ? Number(instance.music.duration || music.duration || 0) : Number(music.duration || 0);
    return `<div class="hfr-panel-heading"><div><span>AMBIENT MIXER</span><h2>Âm thanh môi trường</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-audio-master">
        <button class="hfr-primary" type="button" data-hfr-action="audio-toggle" aria-pressed="${audioActive}">${audioActive ? "Tắt âm thanh" : "Bật âm thanh"}</button>
        <label><span>Âm lượng tổng <output data-hfr-master-output>${Math.round(instance.state.audio.master * 100)}%</output></span><input type="range" min="0" max="100" value="${Math.round(instance.state.audio.master * 100)}" data-hfr-master></label>
        <small data-hfr-audio-status>${instance.audioStatus}</small>
      </div>
      <section class="hfr-music-player" aria-label="Nhạc học">
        <div class="hfr-music-heading"><div><span>NHẠC HỌC CỤC BỘ</span><strong>${escapeHtml(music.title)}</strong><small>${escapeHtml(music.artist)} · ${escapeHtml(music.license)}</small></div><button class="hfr-music-play" type="button" data-hfr-action="music-toggle" aria-pressed="${musicPlaying}">${musicPlaying ? "Ⅱ Tạm dừng" : "▶ Phát nhạc"}</button></div>
        <p>${escapeHtml(music.description)}</p>
        <div class="hfr-music-timeline">
          <span data-hfr-music-position>${music.kind === "procedural" ? "68 BPM" : formatPlaybackTime(position)}</span>
          <input type="range" min="0" max="${Math.max(1, Math.round(duration))}" step="1" value="${Math.min(Math.max(0, Math.round(position)), Math.max(1, Math.round(duration)))}" data-hfr-music-seek aria-label="Vị trí phát" ${music.kind === "procedural" ? "disabled" : ""}>
          <span data-hfr-music-duration>${music.kind === "procedural" ? "Lặp mềm" : formatPlaybackTime(duration)}</span>
        </div>
        <div class="hfr-music-controls"><label><span>Âm lượng nhạc <output data-hfr-music-volume-output>${Math.round(instance.state.audio.music.volume * 100)}%</output></span><input type="range" min="0" max="100" value="${Math.round(instance.state.audio.music.volume * 100)}" data-hfr-music-volume></label><button type="button" data-hfr-action="music-loop" aria-pressed="${instance.state.audio.music.loop}">↻ Lặp ${instance.state.audio.music.loop ? "bật" : "tắt"}</button></div>
        <small class="hfr-music-status" data-hfr-music-status>${escapeHtml(instance.musicStatus)}</small>
        <div class="hfr-music-library">${MUSIC_TRACKS.map((track) => `<button type="button" data-hfr-action="music-select" data-id="${track.id}" aria-pressed="${track.id === music.id}"><i>${track.kind === "procedural" ? "◌" : "♩"}</i><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)} · ${escapeHtml(track.license)}</small></span></button>`).join("")}</div>
      </section>
      <div class="hfr-mix-presets">${Object.entries(MIX_PRESETS).map(([id, preset]) => `<button type="button" data-hfr-action="mix-preset" data-id="${id}">${escapeHtml(preset.label)}</button>`).join("")}</div>
      <div class="hfr-channel-grid">${CHANNELS.map((channel) => {
        const value = instance.state.audio.mix[channel.id];
        return `<label class="hfr-channel"><span><i>${channel.icon}</i><b>${escapeHtml(channel.label)}</b><output data-hfr-channel-output="${channel.id}">${Math.round(value * 100)}%</output></span><input type="range" min="0" max="100" value="${Math.round(value * 100)}" data-hfr-channel="${channel.id}"></label>`;
      }).join("")}</div>
      <form class="hfr-inline-form" data-hfr-mix-save><label><span>Tên preset</span><input name="name" maxlength="60" required placeholder="Ví dụ: Học đêm"></label><button type="submit">Lưu bản phối</button></form>
      <div class="hfr-saved-presets">${instance.state.audio.presets.length ? instance.state.audio.presets.map((preset) => `<span><button type="button" data-hfr-action="load-user-mix" data-id="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</button><button type="button" data-hfr-action="delete-user-mix" data-id="${escapeHtml(preset.id)}" aria-label="Xóa preset">×</button></span>`).join("") : `<small>Chưa có bản phối riêng.</small>`}</div>
      <p class="hfr-disclosure">Môi trường và lo-fi được tạo cục bộ bằng Web Audio. Hai bản piano CC0 được lưu ngay trong website, không hotlink. Không âm thanh nào tự phát; nên bắt đầu ở âm lượng nhỏ.</p>`;
  }

  function timerPanel(instance) {
    const timer = instance.state.timer;
    return `<div class="hfr-panel-heading"><div><span>FOCUS CYCLES</span><h2>Hẹn giờ tập trung</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-timer-presets">${TIMER_PRESETS.map((preset) => `<button type="button" data-hfr-action="timer-preset" data-id="${preset.id}" aria-pressed="${timer.focusMinutes === preset.focus && timer.breakMinutes === preset.rest}"><strong>${preset.focus}/${preset.rest}</strong><small>${preset.label}</small></button>`).join("")}</div>
      <form class="hfr-timer-form" data-hfr-timer-form>
        <label><span>Tập trung</span><input type="number" name="focus" min="1" max="180" value="${timer.focusMinutes}" required><small>phút</small></label>
        <label><span>Nghỉ ngắn</span><input type="number" name="rest" min="1" max="60" value="${timer.breakMinutes}" required><small>phút</small></label>
        <label><span>Nghỉ dài</span><input type="number" name="longRest" min="1" max="90" value="${timer.longBreakMinutes}" required><small>phút</small></label>
        <label><span>Số vòng</span><input type="number" name="cycles" min="1" max="20" value="${timer.cycles}" required><small>vòng</small></label>
        <button type="submit">Áp dụng chu kỳ</button>
      </form>
      <div class="hfr-cycle-summary"><span>Hiện tại</span><strong>${phaseLabel(timer.phase)} · vòng ${timer.cycle}/${timer.cycles}</strong><small>Đồng hồ dựa trên thời điểm kết thúc nên không trôi khi tab bị ẩn.</small></div>`;
  }

  function tasksPanel(instance) {
    const tasks = instance.state.tasks;
    const completedByTask = new Map();
    instance.state.history.forEach((entry) => { if (entry.taskId) completedByTask.set(entry.taskId, (completedByTask.get(entry.taskId) || 0) + 1); });
    return `<div class="hfr-panel-heading"><div><span>SESSION TASKS</span><h2>Việc cần làm</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <form class="hfr-task-form" data-hfr-task-form><label><span>Nhiệm vụ mới</span><input name="title" maxlength="180" required placeholder="Bạn muốn hoàn thành việc gì?"></label><label><span>Mục tiêu</span><input name="target" type="number" min="1" max="20" value="1" required><small>phiên</small></label><button type="submit">Thêm</button></form>
      <div class="hfr-task-list">${tasks.length ? tasks.map((task, index) => instance.ui.editTaskId === task.id ? `<article class="hfr-task-edit-card"><form data-hfr-task-edit-form data-id="${escapeHtml(task.id)}"><label><span>Tên nhiệm vụ</span><input name="title" maxlength="180" value="${escapeHtml(task.title)}" required></label><label><span>Mục tiêu phiên</span><input name="target" type="number" min="1" max="20" value="${task.target}" required></label><div><button class="hfr-primary" type="submit">Lưu</button><button type="button" data-hfr-action="cancel-edit-task">Hủy</button></div></form></article>` : `<article class="${task.done ? "is-done" : ""}">
        <button type="button" data-hfr-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-pressed="${task.done}" aria-label="${task.done ? "Mở lại" : "Hoàn thành"}">${task.done ? "✓" : ""}</button>
        <button class="hfr-task-main" type="button" data-hfr-action="primary-task" data-id="${escapeHtml(task.id)}" aria-pressed="${instance.state.primaryTaskId === task.id}"><strong>${escapeHtml(task.title)}</strong><small>Đã hoàn thành ${completedByTask.get(task.id) || 0}/${task.target} phiên${instance.state.primaryTaskId === task.id ? " · đang tập trung" : ""}</small><i style="--hfr-task-progress:${Math.min(1, (completedByTask.get(task.id) || 0) / Math.max(1, task.target))}"></i></button>
        <span><button type="button" data-hfr-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="Sửa nhiệm vụ">✎</button><button type="button" data-hfr-action="move-task" data-id="${escapeHtml(task.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Đưa lên">↑</button><button type="button" data-hfr-action="move-task" data-id="${escapeHtml(task.id)}" data-direction="1" ${index === tasks.length - 1 ? "disabled" : ""} aria-label="Đưa xuống">↓</button><button type="button" data-hfr-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="Xóa">×</button></span>
      </article>`).join("") : `<div class="hfr-empty"><span>✓</span><strong>Chưa có nhiệm vụ</strong><p>Thêm một việc cụ thể rồi chọn làm nhiệm vụ chính cho phiên.</p></div>`}</div>`;
  }

  function notesPanel(instance) {
    return `<div class="hfr-panel-heading"><div><span>QUICK NOTES</span><h2>Ghi chú phiên học</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <label class="hfr-note"><span>Ý tưởng, công thức hoặc điều cần nhớ</span><textarea data-hfr-note maxlength="10000" placeholder="Gõ ghi chú…">${escapeHtml(instance.state.note)}</textarea><small data-hfr-note-status>Đã lưu trên thiết bị</small></label>`;
  }

  function historyPanel(instance) {
    const summary = focusSummary(instance);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const weekEntries = instance.state.history.filter((entry) => entry.endedAt >= sevenDaysAgo);
    const weekSeconds = weekEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const maxDaySeconds = Math.max(1, ...summary.days.map((day) => day.seconds));
    const taskProgress = new Map();
    instance.state.history.forEach((entry) => { if (entry.taskId) taskProgress.set(entry.taskId, (taskProgress.get(entry.taskId) || 0) + 1); });
    const targetTotal = instance.state.tasks.reduce((sum, task) => sum + task.target, 0);
    const reachedTotal = instance.state.tasks.reduce((sum, task) => sum + Math.min(task.target, taskProgress.get(task.id) || 0), 0);
    const targetRate = targetTotal ? Math.round(reachedTotal / targetTotal * 100) : 0;
    return `<div class="hfr-panel-heading"><div><span>TRUE HISTORY</span><h2>Lịch sử tập trung</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-stats"><article><strong>${summary.todaySessions}</strong><span>phiên hôm nay</span></article><article><strong>${formatMinutes(summary.todaySeconds)}</strong><span>hôm nay</span></article><article><strong>${formatMinutes(weekSeconds)}</strong><span>7 ngày gần nhất</span></article><article><strong>${targetRate}%</strong><span>mục tiêu nhiệm vụ</span></article></div>
      <section class="hfr-week-chart" aria-label="Thời gian tập trung bảy ngày gần nhất">${summary.days.map((day) => `<div><span title="${formatMinutes(day.seconds)}" style="--hfr-day:${day.seconds / maxDaySeconds}"><i></i></span><small>${escapeHtml(day.label)}</small></div>`).join("")}</section>
      <div class="hfr-history-list">${instance.state.history.length ? [...instance.state.history].reverse().slice(0, 30).map((entry) => {
        const sceneItem = allScenes(instance).find((item) => item.id === entry.sceneId);
        return `<article><time datetime="${new Date(entry.endedAt).toISOString()}">${new Date(entry.endedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time><strong>${escapeHtml(entry.taskTitle || entry.intention || "Phiên tập trung")}</strong><small>${formatMinutes(entry.durationSeconds)} · ${escapeHtml(sceneItem?.title || "Không gian đã xóa")}${entry.distractionCount ? ` · ${entry.distractionCount} lần xao nhãng` : ""}</small></article>`;
      }).join("") : `<div class="hfr-empty"><span>◷</span><strong>Chưa có phiên hoàn thành</strong><p>Số liệu chỉ xuất hiện sau khi đồng hồ tập trung chạy hết.</p></div>`}</div>
      <div class="hfr-history-export"><button type="button" data-hfr-action="export-history-csv">Xuất lịch sử CSV</button><button type="button" data-hfr-action="export-data">Sao lưu JSON</button></div>`;
  }

  function sharedRoomStatusLabel(instance) {
    const room = instance.sharedRoom;
    if (instance.isGuest) return "Cần đăng nhập";
    if (!global.HHRealtime) return "Realtime chưa sẵn sàng";
    return ({
      unconfigured: "Chưa cấu hình máy chủ",
      idle: "Sẵn sàng tạo hoặc tham gia",
      connecting: "Đang kết nối…",
      connected: "Đã đồng bộ realtime",
      reconnecting: "Đang kết nối lại…",
      error: "Không thể kết nối"
    })[room.status] || "Sẵn sàng";
  }

  function sharedRoomPanel(instance) {
    const room = instance.sharedRoom;
    const status = sharedRoomStatusLabel(instance);
    const signedOut = instance.isGuest;
    const unavailable = !global.HHRealtime || room.status === "unconfigured";
    if (!room.code) {
      return `<div class="hfr-panel-heading"><div><span>REALTIME STUDY ROOM</span><h2>Phòng học chung</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
        <section class="hfr-shared-hero" data-state="${escapeHtml(room.status)}"><i>◎</i><div><strong>${escapeHtml(status)}</strong><p>${signedOut ? "Đăng nhập để danh tính và quyền chủ phòng được xác minh an toàn." : unavailable ? "Máy chủ Socket.IO chưa khả dụng. Phòng cá nhân vẫn hoạt động bình thường." : "Tạo phòng riêng hoặc nhập mã do người học cùng gửi. Phòng không được công khai trong danh sách."}</p></div></section>
        ${room.message ? `<p class="hfr-shared-message" data-state="${escapeHtml(room.status)}">${escapeHtml(room.message)}</p>` : ""}
        <form class="hfr-shared-form" data-hfr-shared-create>
          <div><span>TẠO PHÒNG RIÊNG</span><strong>Bạn điều khiển cảnh và Pomodoro</strong></div>
          <label><span>Tên phòng</span><input name="name" maxlength="80" value="Cùng học tập trung" autocomplete="off" required></label>
          <button class="hfr-primary" type="submit" ${signedOut || unavailable || room.status === "connecting" ? "disabled" : ""}>Tạo phòng</button>
        </form>
        <form class="hfr-shared-form" data-hfr-shared-join>
          <div><span>THAM GIA BẰNG MÃ</span><strong>Mã gồm 6–12 ký tự</strong></div>
          <label><span>Mã phòng</span><input name="code" maxlength="12" pattern="[A-Za-z0-9]{6,12}" value="${escapeHtml(room.inviteCode || "")}" autocapitalize="characters" autocomplete="off" spellcheck="false" required></label>
          <button type="submit" ${signedOut || unavailable || room.status === "connecting" ? "disabled" : ""}>Vào phòng</button>
        </form>
        <section class="hfr-shared-privacy"><strong>Chỉ đồng bộ phần cần thiết</strong><p>Cảnh, trạng thái Pomodoro và phối âm được phép chia sẻ. Công việc, ghi chú, lịch sử, mục tiêu và tệp cá nhân không rời thiết bị.</p></section>`;
    }

    const members = room.members.length ? room.members : [];
    const role = room.role === "host" ? "Chủ phòng" : "Thành viên";
    return `<div class="hfr-panel-heading"><div><span>REALTIME STUDY ROOM</span><h2>${escapeHtml(room.name || "Phòng học chung")}</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <section class="hfr-shared-hero" data-state="${escapeHtml(room.status)}"><i>${room.status === "connected" ? "●" : "◌"}</i><div><strong>${escapeHtml(status)}</strong><p>${escapeHtml(role)} · ${members.length} thành viên được máy chủ xác nhận</p></div></section>
      ${room.message ? `<p class="hfr-shared-message" data-state="${escapeHtml(room.status)}">${escapeHtml(room.message)}</p>` : ""}
      <section class="hfr-room-code"><div><span>MÃ PHÒNG</span><strong>${escapeHtml(room.code)}</strong></div><button type="button" data-hfr-action="copy-room-code">Sao chép mã</button><button type="button" data-hfr-action="copy-room-link">Sao chép liên kết</button></section>
      <section class="hfr-shared-sync"><span>ĐỒNG BỘ TRÊN THIẾT BỊ NÀY</span>
        <label><span><strong>Không gian</strong><small>Đi theo cảnh do chủ phòng chọn.</small></span><input type="checkbox" data-hfr-shared-pref="scene" ${room.syncScene ? "checked" : ""} ${room.role === "host" ? "disabled title=\"Chủ phòng là nguồn đồng bộ\"" : ""}></label>
        <label><span><strong>Pomodoro</strong><small>Đi theo chạy, dừng và chuyển vòng.</small></span><input type="checkbox" data-hfr-shared-pref="timer" ${room.syncTimer ? "checked" : ""} ${room.role === "host" ? "disabled title=\"Chủ phòng là nguồn đồng bộ\"" : ""}></label>
        <label><span><strong>Phối âm môi trường</strong><small>Chỉ nhận mức âm lượng; không bao giờ tự phát.</small></span><input type="checkbox" data-hfr-shared-pref="audio" ${room.syncAudio ? "checked" : ""} ${room.role === "host" ? "disabled title=\"Chủ phòng là nguồn đồng bộ\"" : ""}></label>
      </section>
      <section class="hfr-room-members"><div><span>THÀNH VIÊN THẬT</span><small>${members.length}/16</small></div>${members.length ? members.map((member) => `<article${member.id === room.selfId ? " data-self=\"true\"" : ""}><i>${member.role === "host" ? "★" : "●"}</i><span><strong>${escapeHtml(member.name || "Thành viên HH")}</strong><small>${member.role === "host" ? "Chủ phòng" : "Thành viên"}${member.id === room.selfId ? " · Bạn" : ""}</small></span></article>`).join("") : `<p>Đang chờ máy chủ xác nhận danh sách…</p>`}</section>
      <section class="hfr-shared-privacy"><strong>${room.role === "host" ? "Bạn đang điều khiển phòng" : "Chủ phòng điều khiển nội dung chung"}</strong><p>${room.role === "host" ? "Thay đổi cảnh, hẹn giờ hoặc phối âm sẽ được gửi tới thành viên đã bật đồng bộ." : "Điều khiển cục bộ sẽ trở lại nguyên trạng sau khi bạn rời phòng."}</p></section>
      <button class="hfr-shared-leave" type="button" data-hfr-action="leave-shared-room">Rời phòng và trở lại phiên cá nhân</button>`;
  }

  function settingsPanel(instance) {
    const settings = instance.state.settings;
    const notificationState = !global.Notification ? "Trình duyệt không hỗ trợ" : global.Notification.permission === "granted" ? "Đã cấp quyền" : global.Notification.permission === "denied" ? "Đã bị chặn" : "Chưa cấp quyền";
    return `<div class="hfr-panel-heading"><div><span>COMFORT & PERFORMANCE</span><h2>Cài đặt phòng</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <form class="hfr-settings" data-hfr-settings-form>
        <label><span>Chất lượng hình ảnh<small>Tự giảm trên thiết bị yếu.</small></span><select name="quality"><option value="eco" ${settings.quality === "eco" ? "selected" : ""}>Tiết kiệm</option><option value="balanced" ${settings.quality === "balanced" ? "selected" : ""}>Cân bằng</option><option value="high" ${settings.quality === "high" ? "selected" : ""}>Cao</option></select></label>
        ${settingToggle("motion", "Chuyển động môi trường", "Parallax và hiệu ứng cảnh.", settings.motion)}
        ${settingToggle("reducedMotion", "Giảm chuyển động", "Ưu tiên giao diện tĩnh, dễ tập trung.", settings.reducedMotion)}
        ${settingToggle("dataSaver", "Tiết kiệm dữ liệu", "Dùng thumbnail thay ảnh lớn.", settings.dataSaver)}
        ${settingToggle("autoStartBreak", "Tự bắt đầu giờ nghỉ", "Bắt đầu sau khi hoàn thành phiên.", settings.autoStartBreak)}
        ${settingToggle("autoStartFocus", "Tự bắt đầu vòng tiếp", "Bắt đầu sau khi hết giờ nghỉ.", settings.autoStartFocus)}
        ${settingToggle("sceneOnBreak", "Đổi cảnh khi nghỉ", "Khôi phục cảnh học khi quay lại.", settings.sceneOnBreak)}
        <label><span>Cảnh nghỉ<small>Chỉ dùng khi bật đổi cảnh.</small></span><select name="restScene">${SCENES.map((item) => `<option value="${item.id}" ${settings.restScene === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></label>
        <button type="submit">Lưu cài đặt</button>
      </form>
      <section class="hfr-layout-settings">
        <div><strong>Bố cục tùy chỉnh</strong><small>Kéo đồng hồ, tên cảnh và thanh công cụ trên màn hình rộng. Khi phóng to hoặc dùng điện thoại, phòng tự trở về bố cục an toàn.</small></div>
        <div><button type="button" class="hfr-layout-edit-action" data-hfr-action="layout-edit" aria-pressed="${!instance.state.layout.locked}">${instance.state.layout.locked ? "Sắp xếp" : "Khóa bố cục"}</button><button type="button" data-hfr-action="layout-reset">Đặt lại vị trí</button></div>
      </section>
      <section class="hfr-notification-card"><div><strong>Thông báo kết thúc phiên</strong><small>${notificationState}</small></div><button type="button" data-hfr-action="enable-notifications" ${!global.Notification || global.Notification.permission === "denied" ? "disabled" : ""}>Bật thông báo</button></section>
      <section class="hfr-notification-card"><div><strong>Giữ màn hình sáng</strong><small data-hfr-wake-lock-status>${escapeHtml(instance.wakeLockStatus)}</small></div><button type="button" data-hfr-action="wake-lock-toggle" aria-pressed="${Boolean(instance.wakeLockWanted)}" ${global.navigator?.wakeLock?.request ? "" : "disabled"}>${instance.wakeLockWanted ? "Tắt" : "Bật"}</button></section>
      <section class="hfr-shortcuts"><strong>Phím tắt trong phòng</strong><div><kbd>Alt</kbd><kbd>Space</kbd><span>Bắt đầu / tạm dừng</span><kbd>Alt</kbd><kbd>1–9</kbd><span>Mở bảng công cụ</span><kbd>Alt</kbd><kbd>Z</kbd><span>Bật / tắt Zen</span><kbd>Esc</kbd><span></span><span>Đóng bảng đang mở</span></div></section>
      <section class="hfr-shared-room"><span>PHÒNG HỌC CHUNG</span><strong>${escapeHtml(sharedRoomStatusLabel(instance))}</strong><p>Đồng bộ scene và Pomodoro bằng Socket.IO; dữ liệu học cá nhân không được gửi đi.</p><button type="button" data-hfr-action="panel" data-panel="shared">Mở phòng học chung</button></section>
      <section class="hfr-data-tools"><button type="button" data-hfr-action="export-data">Xuất JSON</button><label><input type="file" accept="application/json" data-hfr-import><span>Nhập JSON</span></label></section>`;
  }

  function settingToggle(name, title, description, checked) {
    return `<label><span>${escapeHtml(title)}<small>${escapeHtml(description)}</small></span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}></label>`;
  }

  function panelMarkup(instance) {
    const panel = instance.ui.panel;
    if (!panel) return "";
    const content = ({ plan: planPanel, scenes: scenePanel, sound: soundPanel, timer: timerPanel, tasks: tasksPanel, notes: notesPanel, history: historyPanel, shared: sharedRoomPanel, settings: settingsPanel })[panel];
    return content ? content(instance) : "";
  }

  function render(instance) {
    teardownPetDepth(instance);
    const selected = currentScene(instance);
    const timer = instance.state.timer;
    const primaryTask = instance.state.tasks.find((task) => task.id === instance.state.primaryTaskId);
    const quality = effectiveQuality(instance);
    const activeMotion = motionEnabled(instance);
    const summary = focusSummary(instance);
    const tabs = [
      ["plan", "◎", "Kế hoạch"], ["scenes", "▧", "Không gian"], ["sound", "♫", "Âm thanh"], ["timer", "◷", "Hẹn giờ"],
      ["tasks", "✓", "Công việc"], ["notes", "✎", "Ghi chú"], ["history", "⌁", "Lịch sử"], ["shared", "◎", "Phòng chung"], ["settings", "⚙", "Cài đặt"]
    ];
    instance.root.innerHTML = `<section class="hfr-app${instance.ui.zen ? " is-zen" : ""}${instance.ui.panel ? " has-panel" : ""}" data-hfr-root data-quality="${quality}" data-motion="${activeMotion ? "on" : "off"}" data-layout-mode="${instance.state.layout.locked ? "locked" : "editing"}">
      <section class="hfr-stage" data-hfr-effect="${escapeHtml(selected.effect)}" style="--hfr-accent:${selected.category === "nature" ? "#72f3bd" : selected.category === "cafe" || selected.category === "cozy" ? "#ffb46b" : selected.category === "pets" ? "#ffb8c9" : selected.category === "future" ? "#7ee7ff" : "#c69cff"};--hfr-scene-image:url(&quot;${escapeHtml(imageUrl(instance, selected))}&quot;)">
        <div class="hfr-backdrop" aria-hidden="true" style="--hfr-placeholder:url(&quot;${escapeHtml(imageUrl(instance, selected, true))}&quot;)"><img src="${escapeHtml(imageUrl(instance, selected))}" alt="" decoding="async" fetchpriority="high" data-hfr-current-image data-hfr-fallback><span class="hfr-backdrop-shade"></span></div>
        <canvas class="hfr-pet-depth" data-hfr-pet-depth aria-hidden="true" hidden></canvas>
        <div class="hfr-effects" aria-hidden="true"><i class="hfr-fx hfr-fx--far"></i><i class="hfr-fx hfr-fx--mid"></i><i class="hfr-fx hfr-fx--near"></i><i class="hfr-fx hfr-fx--glow"></i></div>
        <header class="hfr-topbar">
          <div class="hfr-scene-title" data-hfr-layout-item="title"><button class="hfr-drag-handle" type="button" data-hfr-drag-handle="title" aria-label="Kéo tên cảnh để sắp xếp" title="Kéo để di chuyển · phím mũi tên để tinh chỉnh">⠿</button><span>IMMERSIVE FOCUS SANCTUARY</span><strong>${escapeHtml(selected.title)}</strong><small>${escapeHtml(selected.description)}</small><div class="hfr-current-meta"><em>${escapeHtml(selected.soundStatus || "Ảnh cá nhân")}</em><em>${escapeHtml(selected.performance || "Theo thiết bị")}</em></div></div>
          <div class="hfr-top-actions">
            <span class="hfr-local-status">● Lưu cục bộ · ${instance.isGuest ? "Khách" : "Tài khoản hiện tại"}</span>
            <button class="hfr-layout-toggle" type="button" data-hfr-action="layout-edit" aria-pressed="${!instance.state.layout.locked}" title="${instance.state.layout.locked ? "Mở chế độ kéo thả bố cục" : "Khóa vị trí các mục"}">${instance.state.layout.locked ? "⌖ Sắp xếp" : "🔒 Khóa"}</button>
            ${instance.state.layout.locked ? "" : `<button class="hfr-layout-reset" type="button" data-hfr-action="layout-reset" title="Đặt lại vị trí mặc định">↺ Đặt lại</button>`}
            <button type="button" data-hfr-action="motion-toggle" aria-pressed="${activeMotion}" title="Tạm dừng hoặc bật chuyển động">${activeMotion ? "Ⅱ Chuyển động" : "▶ Chuyển động"}</button>
            <button type="button" data-hfr-action="fullscreen" title="Toàn màn hình">⛶</button>
          </div>
        </header>
        <main class="hfr-focus-center">
          <section class="hfr-clock-card" data-hfr-layout-item="clock" aria-labelledby="hfr-clock-title">
            <button class="hfr-drag-handle" type="button" data-hfr-drag-handle="clock" aria-label="Kéo đồng hồ để sắp xếp" title="Kéo để di chuyển · phím mũi tên để tinh chỉnh">⠿</button>
            <span id="hfr-clock-title">${phaseLabel(timer.phase)}</span>
            <strong class="hfr-clock" data-hfr-clock role="timer" aria-live="off">${formatTimer(timer.remaining)}</strong>
            <small data-hfr-cycle>Vòng ${timer.cycle}/${timer.cycles}</small>
            <p data-hfr-primary-task>${primaryTask ? escapeHtml(primaryTask.title) : "Chọn một nhiệm vụ để bắt đầu"}</p>
            ${instance.state.planning.intention ? `<blockquote>${escapeHtml(instance.state.planning.intention)}</blockquote>` : ""}
            <div class="hfr-focus-signals"><span>${formatMinutes(summary.todaySeconds)} / ${instance.state.planning.dailyGoalMinutes} phút hôm nay</span><span>${summary.todayDistractions.length} lần xao nhãng</span></div>
            <div class="hfr-clock-progress"><i data-hfr-progress style="--hfr-progress:${Math.max(0, Math.min(1, timer.remaining / timer.duration))}"></i></div>
            <div class="hfr-clock-actions">
              <button class="hfr-primary" type="button" data-hfr-action="timer-toggle">${timer.running ? "Tạm dừng" : timer.remaining < timer.duration ? "Tiếp tục" : "Bắt đầu"}</button>
              <button type="button" data-hfr-action="timer-skip">Bỏ qua</button>
              <button type="button" data-hfr-action="timer-reset">Đặt lại</button>
            </div>
          </section>
        </main>
        <aside class="hfr-panel${instance.ui.panel ? " is-open" : ""}" aria-label="${escapeHtml(panelLabel(instance.ui.panel))}" ${instance.ui.panel ? "" : "hidden"}>${panelMarkup(instance)}</aside>
        <nav class="hfr-dock" data-hfr-layout-item="dock" aria-label="Công cụ phòng học"><button class="hfr-drag-handle hfr-drag-handle--dock" type="button" data-hfr-drag-handle="dock" aria-label="Kéo thanh công cụ để sắp xếp" title="Kéo để di chuyển · phím mũi tên để tinh chỉnh">⠿</button>${tabs.map(([id, icon, label]) => `<button type="button" data-hfr-action="panel" data-panel="${id}" aria-pressed="${instance.ui.panel === id}"><i>${icon}</i><span>${label}</span></button>`).join("")}<button class="hfr-zen-button" type="button" data-hfr-action="zen" aria-pressed="${instance.ui.zen}"><i>◉</i><span>${instance.ui.zen ? "Thoát Zen" : "Zen"}</span></button></nav>
        <button class="hfr-zen-exit" type="button" data-hfr-action="zen">${instance.ui.zen ? "Thoát Zen" : ""}</button>
      </section>
      <div class="hfr-live" data-hfr-live role="status" aria-live="polite"></div>
      <div class="hfr-toast" data-hfr-toast role="status" aria-live="polite" hidden></div>
    </section>`;
    instance.root.dataset.hfrMounted = "true";
    syncTimerDom(instance);
    syncAudioDom(instance);
    syncWakeLockDom(instance);
    setupLayout(instance);
    setupParallax(instance);
    setupPetDepth(instance, selected);
    preloadNextScene(instance);
  }

  function announce(instance, message, type = "success") {
    const live = instance.root.querySelector("[data-hfr-live]");
    const toast = instance.root.querySelector("[data-hfr-toast]");
    if (live) live.textContent = message;
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    global.clearTimeout(instance.toastTimer);
    instance.toastTimer = global.setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 2600);
  }

  function sharedMembers(value) {
    return (Array.isArray(value) ? value : []).slice(0, 16).map((member) => ({
      id: cleanText(member?.id, 100),
      name: cleanText(member?.name, 80) || "Thành viên HH",
      avatar: cleanText(member?.avatar, 500),
      role: member?.role === "host" ? "host" : "member"
    })).filter((member) => member.id);
  }

  function sharedFollowerControls(instance, preference, message = "Chủ phòng đang điều khiển mục này.") {
    const room = instance.sharedRoom;
    const property = `sync${preference[0].toUpperCase()}${preference.slice(1)}`;
    if (!room?.code || room.role === "host" || room[property] !== true) return false;
    announce(instance, `${message} Bạn có thể tắt đồng bộ trên thiết bị này để dùng riêng.`, "error");
    return true;
  }

  function capturePersonalSession(instance) {
    return {
      sceneId: instance.state.scenes.selected,
      timer: JSON.parse(JSON.stringify(instance.state.timer)),
      audio: { master: instance.state.audio.master, mix: { ...instance.state.audio.mix } }
    };
  }

  function sharedSnapshot(instance) {
    const timer = instance.state.timer;
    const selected = SCENES.some((sceneItem) => sceneItem.id === instance.state.scenes.selected)
      ? instance.state.scenes.selected
      : (instance.sharedRoom?.lastState?.sceneId || SCENES[0].id);
    const remaining = timer.running ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : timer.remaining;
    return {
      sceneId: selected,
      timer: {
        phase: timer.phase,
        focusMinutes: timer.focusMinutes,
        breakMinutes: timer.breakMinutes,
        longBreakMinutes: timer.longBreakMinutes,
        cycle: timer.cycle,
        cycles: timer.cycles,
        running: timer.running,
        duration: timer.duration,
        remaining
      },
      audio: {
        master: instance.state.audio.master,
        mix: Object.fromEntries(CHANNELS.map((channel) => [channel.id, instance.state.audio.mix[channel.id]]))
      }
    };
  }

  function refreshSharedPanel(instance) {
    if (instance.ui.panel !== "shared") return;
    const panel = instance.root.querySelector?.(".hfr-panel");
    if (panel) panel.innerHTML = sharedRoomPanel(instance);
  }

  function normalizeSharedTimer(value = {}) {
    const phase = ["focus", "break", "long-break"].includes(value.phase) ? value.phase : "focus";
    const focusMinutes = clamp(value.focusMinutes, 1, 180, 25);
    const breakMinutes = clamp(value.breakMinutes, 1, 60, 5);
    const longBreakMinutes = clamp(value.longBreakMinutes, 1, 90, 15);
    const cycles = Math.round(clamp(value.cycles, 1, 20, 4));
    const duration = Math.round(clamp(value.duration, 1, 180 * 60, (phase === "focus" ? focusMinutes : phase === "long-break" ? longBreakMinutes : breakMinutes) * 60));
    const endsAt = clamp(value.endsAt, 0, Number.MAX_SAFE_INTEGER, 0);
    const running = value.running === true && endsAt > Date.now();
    const remaining = running ? Math.max(0, Math.min(duration, Math.ceil((endsAt - Date.now()) / 1000))) : Math.round(clamp(value.remaining, 0, duration, duration));
    return {
      phase, focusMinutes, breakMinutes, longBreakMinutes,
      cycle: Math.round(clamp(value.cycle, 1, cycles, 1)), cycles,
      running, duration, remaining,
      endsAt: running ? endsAt : 0,
      startedAt: clamp(value.startedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      sessionId: running ? `shared-${cleanText(endsAt, 32)}` : "",
      previousScene: ""
    };
  }

  function applySharedState(instance, state, revision = 0) {
    const room = instance.sharedRoom;
    if (!room?.code || !state || typeof state !== "object") return;
    room.lastState = JSON.parse(JSON.stringify(state));
    room.revision = Math.max(room.revision, Number(revision) || 0);
    room.applying = true;
    if (room.syncScene && SCENES.some((sceneItem) => sceneItem.id === state.sceneId)) {
      instance.state.scenes.selected = state.sceneId;
      instance.state.scenes.recent = [state.sceneId, ...instance.state.scenes.recent.filter((sceneId) => sceneId !== state.sceneId)].slice(0, 12);
    }
    if (room.syncTimer && state.timer && typeof state.timer === "object") {
      stopTimerLoop(instance);
      instance.state.timer = normalizeSharedTimer(state.timer);
      ensureTimerLoop(instance);
    }
    if (room.syncAudio && state.audio && typeof state.audio === "object") {
      instance.state.audio.master = clamp(state.audio.master, 0, 1, instance.state.audio.master);
      CHANNELS.forEach((channel) => {
        instance.state.audio.mix[channel.id] = clamp(state.audio.mix?.[channel.id], 0, 1, instance.state.audio.mix[channel.id]);
      });
      applyAudioGains(instance);
    }
    room.applying = false;
    writeState(instance);
    render(instance);
  }

  function scheduleSharedSync(instance) {
    const room = instance.sharedRoom;
    if (!room?.code || room.role !== "host" || room.status !== "connected" || room.applying) return;
    global.clearTimeout(room.broadcastTimer);
    room.broadcastTimer = global.setTimeout(() => {
      room.broadcastTimer = 0;
      global.HHRealtime?.emit?.("workspace:room:state", { service: REALTIME_SERVICE, state: sharedSnapshot(instance) }, { timeout: 5000 }).then((response) => {
        room.revision = Math.max(room.revision, Number(response?.revision) || 0);
        room.status = "connected";
        room.message = "Thay đổi đã được máy chủ xác nhận.";
        refreshSharedPanel(instance);
      }).catch((error) => {
        room.status = global.HHRealtime?.socket?.()?.connected ? "error" : "reconnecting";
        room.message = cleanText(error?.message || "Không thể đồng bộ thay đổi.", 180);
        refreshSharedPanel(instance);
      });
    }, 100);
  }

  function waitForSharedConnection(socket) {
    if (socket?.connected) return Promise.resolve(socket);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        socket?.off?.("connect", connected);
        socket?.off?.("connect_error", failed);
        if (error) reject(error); else resolve(socket);
      };
      const connected = () => finish();
      const failed = (error) => finish(error || new Error("Không thể kết nối máy chủ realtime."));
      const timer = global.setTimeout(() => finish(new Error("Máy chủ realtime không phản hồi đúng hạn.")), 12_000);
      socket?.once?.("connect", connected);
      socket?.once?.("connect_error", failed);
    });
  }

  async function ensureSharedRealtime(instance) {
    if (instance.isGuest) throw Object.assign(new Error("Hãy đăng nhập để tạo hoặc tham gia phòng học chung."), { code: "AUTH_REQUIRED" });
    const realtime = global.HHRealtime;
    if (!realtime) throw new Error("Lõi realtime chưa được tải trên trang này.");
    if (realtime.status?.().state === "unconfigured" && global.HH_SOCKET_URL) {
      realtime.configure?.({
        url: global.HH_SOCKET_URL,
        auth: () => ({ token: global.HHAuthSession?.token?.() || "", page: global.location?.pathname || "" })
      });
    }
    const socket = await realtime.connect?.();
    if (!socket) throw new Error("Máy chủ realtime chưa được cấu hình hoặc đang ngoại tuyến.");
    return waitForSharedConnection(socket);
  }

  function enterSharedRoom(instance, response, options = {}) {
    const roomData = response?.room;
    const code = cleanText(roomData?.code, 12).toUpperCase();
    if (!ROOM_CODE.test(code)) throw new Error("Máy chủ trả về mã phòng không hợp lệ.");
    const room = instance.sharedRoom;
    room.personalSnapshot ||= capturePersonalSession(instance);
    room.code = code;
    room.name = cleanText(roomData?.name, 80) || "Phòng học chung";
    room.selfId = cleanText(response?.self?.id || room.selfId, 100);
    room.members = sharedMembers(roomData?.members);
    room.role = response?.self?.role === "host" ? "host" : "member";
    if (room.role === "host") {
      room.syncScene = true;
      room.syncTimer = true;
      room.syncAudio = true;
    }
    room.status = "connected";
    room.message = options.reconnecting ? "Đã kết nối lại và nhận trạng thái mới nhất." : "Máy chủ đã xác nhận bạn ở trong phòng.";
    applySharedState(instance, roomData?.state || {}, roomData?.revision);
    return room;
  }

  async function createSharedRoom(instance, name) {
    const room = instance.sharedRoom;
    room.status = "connecting";
    room.message = "Đang tạo phòng riêng…";
    refreshSharedPanel(instance);
    try {
      await ensureSharedRealtime(instance);
      const response = await global.HHRealtime.emit("workspace:room:create", {
        service: REALTIME_SERVICE,
        name: cleanText(name, 80) || "Cùng học tập trung",
        state: sharedSnapshot(instance)
      }, { timeout: 8000 });
      enterSharedRoom(instance, response);
      announce(instance, `Đã tạo phòng ${instance.sharedRoom.code}.`);
    } catch (error) {
      room.status = error?.code === "AUTH_REQUIRED" ? "error" : (global.HHRealtime?.status?.().state === "unconfigured" ? "unconfigured" : "error");
      room.message = cleanText(error?.message || "Không thể tạo phòng.", 180);
      refreshSharedPanel(instance);
      announce(instance, room.message, "error");
    }
  }

  async function joinSharedRoom(instance, code, options = {}) {
    const normalized = cleanText(code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!ROOM_CODE.test(normalized)) throw new Error("Mã phòng phải gồm 6–12 chữ cái hoặc chữ số.");
    const room = instance.sharedRoom;
    room.status = options.reconnecting ? "reconnecting" : "connecting";
    room.message = options.reconnecting ? "Đang vào lại phòng…" : "Đang xác minh mã phòng…";
    refreshSharedPanel(instance);
    try {
      await ensureSharedRealtime(instance);
      const response = await global.HHRealtime.emit("workspace:room:join", { service: REALTIME_SERVICE, code: normalized }, { timeout: 8000 });
      enterSharedRoom(instance, response, options);
      if (!options.silent) announce(instance, `Đã vào phòng ${normalized}.`);
    } catch (error) {
      room.status = "error";
      room.message = cleanText(error?.message || "Không thể tham gia phòng.", 180);
      if (options.reconnecting && room.personalSnapshot) restorePersonalSession(instance, { message: room.message, status: "error" });
      else refreshSharedPanel(instance);
      if (!options.silent) announce(instance, room.message, "error");
      throw error;
    }
  }

  function restorePersonalSession(instance, options = {}) {
    const room = instance.sharedRoom;
    const personal = room.personalSnapshot;
    global.clearTimeout(room.broadcastTimer);
    room.broadcastTimer = 0;
    if (personal) {
      stopTimerLoop(instance);
      if (allScenes(instance).some((sceneItem) => sceneItem.id === personal.sceneId)) instance.state.scenes.selected = personal.sceneId;
      instance.state.timer = JSON.parse(JSON.stringify(personal.timer));
      instance.state.audio.master = personal.audio.master;
      instance.state.audio.mix = { ...personal.audio.mix };
      applyAudioGains(instance);
      ensureTimerLoop(instance);
    }
    Object.assign(room, {
      code: "", name: "", selfId: "", role: "", members: [], revision: 0, lastState: null,
      personalSnapshot: null, status: options.status || "idle", message: options.message || "Đã rời phòng; phiên cá nhân được khôi phục nguyên trạng."
    });
    writeState(instance);
    if (options.render !== false) render(instance);
  }

  async function leaveSharedRoom(instance, options = {}) {
    const hadRoom = Boolean(instance.sharedRoom?.code);
    if (hadRoom && options.emit !== false) {
      try { await global.HHRealtime?.emit?.("workspace:room:leave", { service: REALTIME_SERVICE }, { timeout: 3000 }); }
      catch (_) { /* local exit must still complete while offline */ }
    }
    restorePersonalSession(instance, { render: options.render, message: options.message });
    if (hadRoom && !options.silent) announce(instance, "Đã rời phòng và khôi phục phiên cá nhân.");
  }

  function applySharedPreference(instance, preference, enabled) {
    const room = instance.sharedRoom;
    const personal = room.personalSnapshot;
    if (!room.code || room.role === "host" || !["scene", "timer", "audio"].includes(preference)) return;
    const property = `sync${preference[0].toUpperCase()}${preference.slice(1)}`;
    room[property] = enabled;
    if (enabled) return applySharedState(instance, room.lastState || {}, room.revision);
    room.applying = true;
    if (preference === "scene" && personal && allScenes(instance).some((sceneItem) => sceneItem.id === personal.sceneId)) instance.state.scenes.selected = personal.sceneId;
    if (preference === "timer" && personal) {
      stopTimerLoop(instance);
      instance.state.timer = JSON.parse(JSON.stringify(personal.timer));
      ensureTimerLoop(instance);
    }
    if (preference === "audio" && personal) {
      instance.state.audio.master = personal.audio.master;
      instance.state.audio.mix = { ...personal.audio.mix };
      applyAudioGains(instance);
    }
    room.applying = false;
    writeState(instance);
    render(instance);
    announce(instance, `Đã tắt đồng bộ ${preference === "scene" ? "không gian" : preference === "timer" ? "Pomodoro" : "phối âm"} trên thiết bị này.`);
  }

  async function copySharedText(instance, value, successMessage) {
    const text = String(value || "");
    if (!text) return;
    try {
      if (global.navigator?.clipboard?.writeText) await global.navigator.clipboard.writeText(text);
      else {
        const input = global.document?.createElement?.("textarea");
        if (!input) throw new Error("Clipboard unavailable");
        input.value = text;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        global.document.body?.appendChild?.(input);
        input.select();
        if (!global.document.execCommand?.("copy")) throw new Error("Copy rejected");
        input.remove();
      }
      announce(instance, successMessage);
    } catch { announce(instance, "Trình duyệt không cho phép sao chép tự động.", "error"); }
  }

  function setupSharedRealtime(instance) {
    const room = instance.sharedRoom;
    const realtimeState = global.HHRealtime?.status?.().state;
    room.status = instance.isGuest ? "error" : !global.HHRealtime || realtimeState === "unconfigured" ? "unconfigured" : realtimeState === "connected" || global.HHRealtime?.socket?.()?.connected ? "idle" : "idle";
    if (global.HHRealtime?.subscribe) {
      const scope = `focus-room-${instance.owner}`;
      instance.cleanup.push(global.HHRealtime.subscribe(scope, "workspace:room:presence", (payload = {}) => {
        if (payload.service !== REALTIME_SERVICE || !room.code || String(payload.code || "").toUpperCase() !== room.code) return;
        room.members = sharedMembers(payload.members);
        const self = room.members.find((member) => member.id === room.selfId);
        if (self) room.role = self.role;
        if (room.role === "host") room.syncScene = room.syncTimer = room.syncAudio = true;
        room.revision = Math.max(room.revision, Number(payload.revision) || 0);
        room.status = "connected";
        room.message = room.role === "host" ? "Bạn đang giữ quyền chủ phòng." : "Danh sách thành viên vừa được cập nhật.";
        refreshSharedPanel(instance);
      }));
      instance.cleanup.push(global.HHRealtime.subscribe(scope, "workspace:room:state", (payload = {}) => {
        if (payload.service !== REALTIME_SERVICE || !room.code || String(payload.code || "").toUpperCase() !== room.code) return;
        if (Number(payload.revision) < room.revision) return;
        room.status = "connected";
        room.message = "Đã nhận trạng thái mới nhất từ chủ phòng.";
        applySharedState(instance, payload.state, payload.revision);
      }));
      instance.cleanup.push(() => global.HHRealtime?.unsubscribeScope?.(scope));
    }
    addListener(instance, global, "hh:realtime-ready", () => {
      if (!room.code) { room.status = "idle"; room.message = "Máy chủ realtime đã sẵn sàng."; return refreshSharedPanel(instance); }
      void joinSharedRoom(instance, room.code, { reconnecting: true, silent: true }).catch(() => {});
    });
    addListener(instance, global, "hh:realtime-offline", () => {
      room.status = room.code ? "reconnecting" : "error";
      room.message = "Mất kết nối tạm thời; dữ liệu cá nhân vẫn an toàn trên thiết bị.";
      refreshSharedPanel(instance);
    });
    const Parameters = global.URLSearchParams;
    const invite = typeof Parameters === "function" && global.location?.hash
      ? new Parameters(String(global.location.hash).split("?")[1] || "").get("room")
      : "";
    const code = cleanText(invite, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (ROOM_CODE.test(code)) {
      room.inviteCode = code;
      instance.ui.panel = "shared";
      render(instance);
      if (!instance.isGuest) global.setTimeout(() => { void joinSharedRoom(instance, code, { silent: true }).catch(() => {}); }, 0);
    }
  }

  function syncTimerDom(instance) {
    const timer = instance.state.timer;
    if (timer.running) timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const clock = instance.root.querySelector("[data-hfr-clock]");
    const cycle = instance.root.querySelector("[data-hfr-cycle]");
    const progress = instance.root.querySelector("[data-hfr-progress]");
    const toggle = instance.root.querySelector('[data-hfr-action="timer-toggle"]');
    if (clock) clock.textContent = formatTimer(timer.remaining);
    if (cycle) cycle.textContent = `Vòng ${timer.cycle}/${timer.cycles}`;
    if (progress) progress.style.setProperty("--hfr-progress", String(Math.max(0, Math.min(1, timer.remaining / Math.max(1, timer.duration)))));
    if (toggle) toggle.textContent = timer.running ? "Tạm dừng" : timer.remaining < timer.duration ? "Tiếp tục" : "Bắt đầu";
  }

  function timerDuration(timer, phase = timer.phase) {
    if (phase === "focus") return Math.round(timer.focusMinutes * 60);
    if (phase === "long-break") return Math.round(timer.longBreakMinutes * 60);
    return Math.round(timer.breakMinutes * 60);
  }

  function completionLock(instance, sessionId) {
    if (!sessionId) return false;
    const lockKey = `${STATE_PREFIX}lock.${instance.owner}.${sessionId}`;
    const token = `${Date.now()}-${Math.random()}`;
    try {
      const current = safeRead(lockKey, null);
      if (current?.expiresAt > Date.now()) return false;
      global.localStorage?.setItem(lockKey, JSON.stringify({ token, expiresAt: Date.now() + 5000 }));
      return safeRead(lockKey, null)?.token === token;
    } catch {
      return true;
    }
  }

  function mergeStoredHistory(instance) {
    const stored = safeRead(instance.storageKey, null);
    if (!stored || typeof stored !== "object") return;
    const merged = new Map();
    normalizeState(stored).history.forEach((entry) => merged.set(entry.id, entry));
    instance.state.history.forEach((entry) => merged.set(entry.id, entry));
    instance.state.history = [...merged.values()].sort((a, b) => a.endedAt - b.endedAt).slice(-400);
  }

  function notifyCompletion(instance, message) {
    if (!instance.state.settings.notifications || global.Notification?.permission !== "granted") return;
    try { new global.Notification("HH Focus Room", { body: message, tag: "hh-focus-room-timer" }); } catch {}
  }

  function syncWakeLockDom(instance) {
    const button = instance.root.querySelector('[data-hfr-action="wake-lock-toggle"]');
    const status = instance.root.querySelector("[data-hfr-wake-lock-status]");
    if (button) {
      button.textContent = instance.wakeLockWanted ? "Tắt" : "Bật";
      button.setAttribute("aria-pressed", String(Boolean(instance.wakeLockWanted)));
    }
    if (status) status.textContent = instance.wakeLockStatus;
  }

  async function requestWakeLock(instance) {
    if (!global.navigator?.wakeLock?.request) {
      instance.wakeLockWanted = false;
      instance.wakeLockStatus = "Trình duyệt không hỗ trợ Screen Wake Lock";
      syncWakeLockDom(instance);
      return;
    }
    instance.wakeLockWanted = true;
    if (global.document?.hidden) {
      instance.wakeLockStatus = "Sẽ bật khi tab hiển thị";
      syncWakeLockDom(instance);
      return;
    }
    if (instance.wakeLock) return syncWakeLockDom(instance);
    instance.wakeLockStatus = "Đang yêu cầu…";
    syncWakeLockDom(instance);
    try {
      const sentinel = await global.navigator.wakeLock.request("screen");
      if (instances.get(instance.root) !== instance || !instance.wakeLockWanted) {
        try { await sentinel.release(); } catch {}
        return;
      }
      instance.wakeLock = sentinel;
      instance.wakeLockStatus = "Đang giữ màn hình sáng trong phiên này";
      sentinel.addEventListener?.("release", () => {
        if (instance.wakeLock !== sentinel) return;
        instance.wakeLock = null;
        instance.wakeLockStatus = instance.wakeLockWanted ? "Đã tạm nhả khi tab ẩn" : "Đã tắt";
        syncWakeLockDom(instance);
      });
      syncWakeLockDom(instance);
      announce(instance, "Đã bật giữ màn hình sáng.");
    } catch (error) {
      instance.wakeLock = null;
      instance.wakeLockWanted = false;
      instance.wakeLockStatus = `Không thể bật: ${cleanText(error?.message, 100)}`;
      syncWakeLockDom(instance);
      announce(instance, instance.wakeLockStatus, "error");
    }
  }

  function releaseWakeLock(instance, keepWanted = false) {
    const sentinel = instance.wakeLock;
    instance.wakeLock = null;
    instance.wakeLockWanted = keepWanted && instance.wakeLockWanted;
    instance.wakeLockStatus = instance.wakeLockWanted ? "Đã tạm nhả khi tab ẩn" : "Đã tắt";
    try { sentinel?.release?.(); } catch {}
    syncWakeLockDom(instance);
    if (!keepWanted && sentinel) announce(instance, "Đã tắt giữ màn hình sáng.");
  }

  function handleShortcut(instance, event) {
    if (event.defaultPrevented || event.isComposing) return;
    const element = event.target;
    if (element?.matches?.("input, textarea, select, [contenteditable='true']")) return;
    if (event.key === "Escape" && instance.ui.panel) {
      event.preventDefault();
      instance.ui.panel = "";
      render(instance);
      return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const key = String(event.key || "").toLowerCase();
    const panels = { "1": "plan", "2": "scenes", "3": "sound", "4": "timer", "5": "tasks", "6": "notes", "7": "history", "8": "shared", "9": "settings" };
    if (panels[key]) {
      event.preventDefault();
      instance.ui.panel = instance.ui.panel === panels[key] ? "" : panels[key];
      render(instance);
      return;
    }
    if (key === " " || event.code === "Space") {
      event.preventDefault();
      toggleTimer(instance);
      render(instance);
      return;
    }
    if (key === "z") {
      event.preventDefault();
      finishLayoutDrag(instance);
      instance.ui.zen = !instance.ui.zen;
      instance.ui.panel = "";
      render(instance);
    }
  }

  function applyPhaseScene(instance, enteringBreak) {
    if (!instance.state.settings.sceneOnBreak) return;
    if (enteringBreak) {
      instance.state.timer.previousScene = instance.state.scenes.selected;
      instance.state.scenes.selected = instance.state.settings.restScene;
    } else if (instance.state.timer.previousScene) {
      const previous = instance.state.timer.previousScene;
      if (allScenes(instance).some((item) => item.id === previous)) instance.state.scenes.selected = previous;
      instance.state.timer.previousScene = "";
    }
  }

  function completePhase(instance) {
    if (sharedFollowerControls(instance, "timer", "Đồng hồ chung đã về 00:00; đang chờ chủ phòng chuyển vòng.")) {
      instance.state.timer.running = false;
      instance.state.timer.endsAt = 0;
      instance.state.timer.remaining = 0;
      stopTimerLoop(instance);
      syncTimerDom(instance);
      return;
    }
    const timer = instance.state.timer;
    const completedPhase = timer.phase;
    timer.running = false;
    timer.endsAt = 0;
    stopTimerLoop(instance);
    if (completedPhase === "focus") {
      mergeStoredHistory(instance);
      if (completionLock(instance, timer.sessionId) && !instance.state.history.some((entry) => entry.id === timer.sessionId)) {
        const task = instance.state.tasks.find((item) => item.id === instance.state.primaryTaskId);
        instance.state.history.push({
          id: timer.sessionId || id("session"),
          startedAt: timer.startedAt || Date.now() - timer.duration * 1000,
          endedAt: Date.now(),
          durationSeconds: timer.duration,
          taskId: task?.id || "",
          taskTitle: task?.title || "",
          sceneId: instance.state.scenes.selected,
          intention: instance.state.planning.intention,
          distractionCount: instance.state.planning.distractions.filter((entry) => entry.sessionId === timer.sessionId).length
        });
        instance.state.history = instance.state.history.slice(-400);
      }
      const longBreak = timer.cycle % Math.max(1, timer.cycles) === 0;
      timer.phase = longBreak ? "long-break" : "break";
      applyPhaseScene(instance, true);
      timer.duration = timerDuration(timer);
      timer.remaining = timer.duration;
      timer.sessionId = "";
      timer.startedAt = 0;
      timer.running = instance.state.settings.autoStartBreak;
      notifyCompletion(instance, "Đã hoàn thành phiên tập trung. Đến giờ nghỉ.");
    } else {
      applyPhaseScene(instance, false);
      timer.phase = "focus";
      timer.cycle = timer.cycle >= timer.cycles ? 1 : timer.cycle + 1;
      timer.duration = timerDuration(timer);
      timer.remaining = timer.duration;
      timer.sessionId = "";
      timer.startedAt = 0;
      timer.running = instance.state.settings.autoStartFocus;
      notifyCompletion(instance, "Giờ nghỉ đã kết thúc. Sẵn sàng cho vòng tiếp theo.");
    }
    if (timer.running) {
      timer.sessionId = id(completedPhase === "focus" ? "break" : "session");
      timer.startedAt = Date.now();
      timer.endsAt = Date.now() + timer.remaining * 1000;
      ensureTimerLoop(instance);
    }
    applyAudioGains(instance);
    writeState(instance);
    render(instance);
    announce(instance, completedPhase === "focus" ? "Đã hoàn thành một phiên tập trung." : "Giờ nghỉ đã kết thúc.");
    scheduleSharedSync(instance);
  }

  function reconcileTimer(instance) {
    const timer = instance.state.timer;
    if (!timer.running) return syncTimerDom(instance);
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    if (timer.remaining <= 0) completePhase(instance);
    else syncTimerDom(instance);
  }

  function ensureTimerLoop(instance) {
    stopTimerLoop(instance);
    if (!instance.state.timer.running || global.document?.hidden) return;
    instance.timerInterval = global.setInterval(() => reconcileTimer(instance), 500);
  }

  function stopTimerLoop(instance) {
    if (instance.timerInterval) global.clearInterval(instance.timerInterval);
    instance.timerInterval = 0;
  }

  function toggleTimer(instance) {
    if (sharedFollowerControls(instance, "timer")) return;
    const timer = instance.state.timer;
    if (timer.running) {
      timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
      timer.running = false;
      timer.endsAt = 0;
      stopTimerLoop(instance);
    } else {
      if (timer.remaining <= 0) {
        timer.duration = timerDuration(timer);
        timer.remaining = timer.duration;
      }
      timer.running = true;
      timer.startedAt ||= Date.now();
      timer.sessionId ||= id(timer.phase === "focus" ? "session" : "break");
      timer.endsAt = Date.now() + timer.remaining * 1000;
      ensureTimerLoop(instance);
    }
    writeState(instance);
    syncTimerDom(instance);
    announce(instance, timer.running ? `${phaseLabel(timer.phase)} đã bắt đầu.` : "Đã tạm dừng đồng hồ.");
    scheduleSharedSync(instance);
  }

  function advancePhase(instance, skipped = false) {
    if (sharedFollowerControls(instance, "timer")) return;
    const timer = instance.state.timer;
    stopTimerLoop(instance);
    timer.running = false;
    timer.endsAt = 0;
    timer.sessionId = "";
    timer.startedAt = 0;
    if (timer.phase === "focus") {
      timer.phase = timer.cycle % timer.cycles === 0 ? "long-break" : "break";
      applyPhaseScene(instance, true);
    } else {
      applyPhaseScene(instance, false);
      timer.phase = "focus";
      timer.cycle = timer.cycle >= timer.cycles ? 1 : timer.cycle + 1;
    }
    timer.duration = timerDuration(timer);
    timer.remaining = timer.duration;
    applyAudioGains(instance);
    writeState(instance);
    render(instance);
    announce(instance, skipped ? `Đã chuyển sang ${phaseLabel(timer.phase).toLocaleLowerCase("vi")}.` : "Đã đặt lại chu kỳ.");
    scheduleSharedSync(instance);
  }

  function resetTimer(instance) {
    if (sharedFollowerControls(instance, "timer")) return;
    const timer = instance.state.timer;
    stopTimerLoop(instance);
    timer.running = false;
    timer.endsAt = 0;
    timer.sessionId = "";
    timer.startedAt = 0;
    timer.duration = timerDuration(timer);
    timer.remaining = timer.duration;
    writeState(instance);
    syncTimerDom(instance);
    announce(instance, "Đã đặt lại đồng hồ.");
    scheduleSharedSync(instance);
  }

  function createNoiseBuffer(context, type) {
    const sampleRate = Math.max(1, Number(context.sampleRate) || 44100);
    const duration = ({ thunder: 17.3, birds: 15.7, pages: 14.9, keyboard: 13.1, ocean: 12.7, purr: 16.1, "pet-breath": 18.7 })[type] || 11.3;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = context.createBuffer(1, length, sampleRate);
    const samples = buffer.getChannelData(0);
    let brown = 0;
    let pink0 = 0; let pink1 = 0; let pink2 = 0; let pink3 = 0; let pink4 = 0; let pink5 = 0; let pink6 = 0;
    let transient = 0;
    let slowDrift = 0;
    const decay = (seconds) => Math.exp(-1 / Math.max(1, sampleRate * seconds));
    const eventChance = (eventsPerSecond) => Math.min(0.08, eventsPerSecond / sampleRate);
    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.018 * white) / 1.018;
      slowDrift = slowDrift * 0.9997 + white * 0.0003;
      pink0 = 0.99886 * pink0 + white * 0.0555179;
      pink1 = 0.99332 * pink1 + white * 0.0750759;
      pink2 = 0.969 * pink2 + white * 0.153852;
      pink3 = 0.8665 * pink3 + white * 0.3104856;
      pink4 = 0.55 * pink4 + white * 0.5329522;
      pink5 = -0.7616 * pink5 - white * 0.016898;
      const pink = (pink0 + pink1 + pink2 + pink3 + pink4 + pink5 + pink6 + white * 0.5362) * 0.09;
      pink6 = white * 0.115926;
      let value = 0;

      if (type === "rain") {
        if (Math.random() < eventChance(7.5)) transient = Math.max(transient, 0.18 + Math.random() * 0.4);
        transient *= decay(0.018);
        const curtain = 0.16 + 0.035 * Math.sin(time * 0.71) + slowDrift * 0.18;
        value = white * curtain + pink * 0.075 + transient * white;
      } else if (type === "heavy-rain") {
        if (Math.random() < eventChance(12)) transient = Math.max(transient, 0.28 + Math.random() * 0.58);
        transient *= decay(0.028);
        const downpour = 0.25 + 0.055 * Math.sin(time * 0.59) + 0.035 * Math.sin(time * 1.37);
        value = white * downpour + pink * 0.14 + transient * white;
      } else if (type === "thunder") {
        const roll = [duration * 0.29, duration * 0.71].reduce((sum, center, rollIndex) => {
          const since = time - center;
          if (since < 0 || since > 4.8) return sum;
          return sum + Math.exp(-since * (0.72 + rollIndex * 0.17)) * (0.55 + 0.24 * Math.sin(since * 15) + 0.12 * Math.sin(since * 31));
        }, 0);
        value = brown * roll * 3.1 + pink * roll * 0.08 + brown * 0.018;
      } else if (type === "wind") {
        const gust = 0.16 + 0.095 * (0.5 + 0.5 * Math.sin(time * 0.43 + Math.sin(time * 0.17))) + Math.abs(slowDrift) * 0.32;
        value = brown * 2.35 * gust + pink * gust * 0.1;
      } else if (type === "fire") {
        if (Math.random() < eventChance(5.2)) transient = Math.max(transient, 0.22 + Math.random() * 0.7);
        transient *= decay(0.012 + Math.random() * 0.006);
        value = brown * 0.13 + pink * 0.028 + transient * (white * 0.75 + 0.18);
      } else if (type === "cafe") {
        const roomTone = 0.55 + 0.16 * Math.sin(time * 0.31) + 0.08 * Math.sin(time * 0.83);
        const distantVoices = Math.sin(time * 81 + Math.sin(time * 2.1)) * 0.018 + Math.sin(time * 127 + Math.sin(time * 1.3)) * 0.012;
        value = pink * 0.16 * roomTone + brown * 0.18 + distantVoices;
      } else if (type === "keyboard") {
        const cluster = Math.max(0, Math.sin(time * 0.91) + Math.sin(time * 0.37 + 1.4) - 0.42);
        if (cluster > 0 && Math.random() < eventChance(5.7 * Math.min(1, cluster))) transient = 0.35 + Math.random() * 0.5;
        transient *= decay(0.009);
        value = transient * (0.52 + white * 0.42) + white * 0.004;
      } else if (type === "pages") {
        const phase = time % 6.7;
        const rustle = phase > 3.8 && phase < 4.35 ? Math.sin((phase - 3.8) / 0.55 * Math.PI) : 0;
        value = pink * rustle * (0.32 + 0.2 * Math.sin(time * 43)) + white * rustle * 0.1 + white * 0.003;
      } else if (type === "birds") {
        const cycle = time % 7.9;
        const first = cycle > 1.1 && cycle < 1.42 ? Math.sin((cycle - 1.1) / 0.32 * Math.PI) : 0;
        const second = cycle > 4.8 && cycle < 5.28 ? Math.sin((cycle - 4.8) / 0.48 * Math.PI) : 0;
        const chirp = first * Math.sin(time * (2050 + 620 * cycle)) + second * Math.sin(time * (1680 + 410 * cycle));
        value = chirp * 0.22 + pink * 0.006;
      } else if (type === "ocean") {
        const swell = Math.pow(0.5 + 0.5 * Math.sin(time * 0.47 + 0.35 * Math.sin(time * 0.19)), 1.7);
        value = brown * (0.45 + swell * 1.9) + pink * swell * 0.12 + white * swell * 0.035;
      } else if (type === "stream") {
        if (Math.random() < eventChance(2.4)) transient = Math.max(transient, 0.08 + Math.random() * 0.18);
        transient *= decay(0.035);
        const flow = 0.18 + 0.045 * Math.sin(time * 0.91) + Math.abs(slowDrift) * 0.2;
        value = white * flow + pink * 0.14 + transient * white;
      } else if (type === "purr") {
        const breath = 0.62 + 0.22 * Math.sin(time * 1.37 + 0.25 * Math.sin(time * 0.19));
        const pulse = Math.sin(time * 25.4 * Math.PI * 2) * 0.085 + Math.sin(time * 50.8 * Math.PI * 2) * 0.025;
        value = pulse * breath + brown * 0.12 * breath + pink * 0.012;
      } else if (type === "pet-breath") {
        const inhale = Math.pow(Math.max(0, Math.sin(time * 0.72 * Math.PI)), 2.2);
        const chest = 0.13 + inhale * 0.24;
        value = brown * chest + pink * inhale * 0.035 + white * inhale * 0.008;
      } else if (type === "brown") value = brown * 3.2;
      else if (type === "pink") value = pink * 0.72;
      else value = white * 0.26;

      samples[index] = Math.max(-1, Math.min(1, value));
    }
    return buffer;
  }

  function createAudioVoice(audio, channel) {
    if (audio.sources[channel.id]) return audio.sources[channel.id];
    const { context } = audio;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const motion = context.createGain();
    const gain = context.createGain();
    const panner = context.createStereoPanner?.() || null;
    const lfo = context.createOscillator?.() || null;
    const lfoGain = lfo ? context.createGain() : null;
    source.buffer = createNoiseBuffer(context, channel.type);
    source.loop = true;
    filter.type = channel.filter;
    filter.frequency.value = channel.frequency;
    if (filter.Q) filter.Q.value = channel.q;
    motion.gain.value = 0.9;
    gain.gain.value = 0;
    if (panner?.pan) panner.pan.value = channel.pan;
    source.connect(filter);
    if (panner) {
      filter.connect(panner);
      panner.connect(motion);
    } else filter.connect(motion);
    motion.connect(gain);
    gain.connect(audio.input);
    if (lfo && lfoGain) {
      lfo.frequency.value = channel.drift;
      lfoGain.gain.value = channel.depth;
      lfo.connect(lfoGain);
      lfoGain.connect(motion.gain);
      lfo.start(Math.max(0, context.currentTime));
    }
    const offset = source.buffer?.duration ? Math.random() * source.buffer.duration * 0.82 : 0;
    source.start(Math.max(0, context.currentTime), offset);
    const voice = { source, filter, motion, gain, panner, lfo, lfoGain };
    audio.sources[channel.id] = voice;
    return voice;
  }

  function startAudio(instance) {
    if (instance.audio) return stopAudio(instance);
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextCtor) {
      instance.audioStatus = "Trình duyệt không hỗ trợ Web Audio.";
      render(instance);
      return;
    }
    instance.audioStatus = "Đang khởi động…";
    render(instance);
    let context;
    const sources = {};
    try {
      context = new AudioContextCtor();
      const input = context.createGain();
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor?.() || null;
      input.gain.value = 1;
      master.gain.value = 0;
      if (compressor) {
        compressor.threshold.value = -22;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.035;
        compressor.release.value = 0.42;
        input.connect(compressor);
        compressor.connect(master);
      } else input.connect(master);
      master.connect(context.destination);
      instance.audio = { context, input, compressor, master, sources };
      applyAudioGains(instance);
      Promise.resolve(context.resume()).then(() => {
        if (!instance.audio || instance.audio.context !== context) return;
        instance.audioStatus = "Đang phát · tạo cục bộ";
        syncAudioDom(instance);
        updatePlaybackSignal(instance);
        announce(instance, "Đã bật âm thanh môi trường.");
      }).catch((error) => {
        if (instance.audio?.context !== context) return;
        stopAudio(instance);
        instance.audioStatus = `Không thể phát: ${cleanText(error?.message, 120)}`;
        syncAudioDom(instance);
      });
    } catch (error) {
      try { context?.close?.(); } catch {}
      instance.audio = null;
      instance.audioStatus = `Không thể khởi tạo: ${cleanText(error?.message, 120)}`;
      syncAudioDom(instance);
    }
  }

  function phaseGain(instance) {
    return instance.state.timer.phase === "focus" ? 1 : 0.62;
  }

  function applyAudioGains(instance) {
    if (instance.audio) {
      const now = instance.audio.context.currentTime;
      const energy = CHANNELS.reduce((sum, channel) => {
        const level = instance.state.audio.mix[channel.id] * channel.trim;
        return sum + level * level;
      }, 0);
      const normalization = energy > 0.3025 ? 0.55 / Math.sqrt(energy) : 1;
      instance.audio.master.gain.setTargetAtTime(instance.state.audio.master * 0.86, now, 0.16);
      CHANNELS.forEach((channel) => {
        const target = instance.state.audio.mix[channel.id] * channel.trim * normalization * phaseGain(instance);
        const voice = target > 0.0008 ? createAudioVoice(instance.audio, channel) : instance.audio.sources[channel.id];
        voice?.gain?.gain?.setTargetAtTime(target, now, target ? 0.24 : 0.38);
      });
    }
    applyMusicGain(instance);
  }

  function stopAudio(instance) {
    const audio = instance.audio;
    if (!audio) return;
    instance.audio = null;
    Object.values(audio.sources).forEach((entry) => {
      try { entry.source.stop(); } catch {}
      try { entry.lfo?.stop(); } catch {}
      [entry.source, entry.filter, entry.panner, entry.motion, entry.gain, entry.lfo, entry.lfoGain].forEach((node) => {
        try { node?.disconnect?.(); } catch {}
      });
    });
    try { audio.input.disconnect(); } catch {}
    try { audio.compressor?.disconnect?.(); } catch {}
    try { audio.master.disconnect(); } catch {}
    try { audio.context.close(); } catch {}
    instance.audioStatus = "Âm thanh đang tắt";
    updatePlaybackSignal(instance);
    syncAudioDom(instance);
  }

  function emitPlayback(active) {
    try { global.dispatchEvent(new global.CustomEvent("hh:media-playback", { detail: { active, source: "hh-focus-room" } })); } catch {}
  }

  function updatePlaybackSignal(instance) {
    const active = Boolean(instance.audio && !global.document?.hidden) || musicIsPlaying(instance);
    if (instance.mediaActive === active) return;
    instance.mediaActive = active;
    emitPlayback(active);
  }

  function syncAudioDom(instance) {
    const button = instance.root.querySelector('[data-hfr-action="audio-toggle"]');
    const status = instance.root.querySelector("[data-hfr-audio-status]");
    if (button) {
      button.textContent = instance.audio ? "Tắt âm thanh" : "Bật âm thanh";
      button.setAttribute("aria-pressed", String(Boolean(instance.audio)));
    }
    if (status) status.textContent = instance.audioStatus;
  }

  function setAudioParam(parameter, value, time, rampTime = 0) {
    if (!parameter) return;
    try {
      if (rampTime > 0 && parameter.setTargetAtTime) parameter.setTargetAtTime(value, time, rampTime);
      else if (parameter.setValueAtTime) parameter.setValueAtTime(value, time);
      else parameter.value = value;
    } catch { parameter.value = value; }
  }

  function applyMusicGain(instance) {
    const runtime = instance.music;
    if (!runtime) return;
    const target = Math.min(1, instance.state.audio.master * instance.state.audio.music.volume * phaseGain(instance));
    if (runtime.kind === "file" && runtime.element) runtime.element.volume = target;
    if (runtime.kind === "procedural" && runtime.output?.gain) {
      setAudioParam(runtime.output.gain, target * 0.72, runtime.context.currentTime, 0.18);
    }
  }

  function syncMusicDom(instance) {
    const selected = currentMusicTrack(instance);
    const runtime = instance.music?.trackId === selected.id ? instance.music : null;
    const playing = musicIsPlaying(instance);
    const button = instance.root.querySelector('[data-hfr-action="music-toggle"]');
    const status = instance.root.querySelector("[data-hfr-music-status]");
    const seek = instance.root.querySelector("[data-hfr-music-seek]");
    const position = instance.root.querySelector("[data-hfr-music-position]");
    const duration = instance.root.querySelector("[data-hfr-music-duration]");
    if (button) {
      button.textContent = playing ? "Ⅱ Tạm dừng" : "▶ Phát nhạc";
      button.setAttribute("aria-pressed", String(playing));
    }
    if (status) status.textContent = instance.musicStatus;
    if (selected.kind === "file") {
      const current = Math.max(0, Number(runtime?.element?.currentTime ?? runtime?.position ?? 0));
      const total = Math.max(0, Number(runtime?.element?.duration || runtime?.duration || selected.duration || 0));
      if (seek) {
        seek.max = String(Math.max(1, Math.round(total)));
        seek.value = String(Math.min(Math.round(current), Math.max(1, Math.round(total))));
      }
      if (position) position.textContent = formatPlaybackTime(current);
      if (duration) duration.textContent = formatPlaybackTime(total);
    }
  }

  function scheduleLofiChord(runtime) {
    const progressions = [
      [48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 57]
    ];
    const notes = progressions[runtime.chordIndex % progressions.length];
    const start = runtime.nextChord;
    const duration = runtime.chordDuration * 0.94;
    notes.forEach((midi, noteIndex) => {
      const oscillator = runtime.context.createOscillator();
      const voiceGain = runtime.context.createGain();
      const pan = runtime.context.createStereoPanner?.() || null;
      oscillator.type = noteIndex % 2 ? "sine" : "triangle";
      const detune = Math.sin((runtime.chordIndex + 1) * (noteIndex + 2) * 0.71) * 2.2;
      setAudioParam(oscillator.frequency, 440 * Math.pow(2, (midi - 69) / 12), start);
      if (oscillator.detune) setAudioParam(oscillator.detune, detune, start);
      setAudioParam(voiceGain.gain, 0.0001, start);
      voiceGain.gain?.linearRampToValueAtTime?.(0.032 / Math.max(1, notes.length * 0.72), start + 0.16 + noteIndex * 0.018);
      voiceGain.gain?.setTargetAtTime?.(0.0001, start + duration * 0.58, duration * 0.19);
      if (pan?.pan) setAudioParam(pan.pan, (noteIndex - 1.5) * 0.12, start);
      oscillator.connect(voiceGain);
      if (pan) { voiceGain.connect(pan); pan.connect(runtime.filter); }
      else voiceGain.connect(runtime.filter);
      const nodes = [oscillator, voiceGain, pan].filter(Boolean);
      nodes.forEach((node) => runtime.nodes.add(node));
      oscillator.onended = () => {
        nodes.forEach((node) => { runtime.nodes.delete(node); try { node.disconnect?.(); } catch {} });
      };
      oscillator.start(start + noteIndex * 0.024);
      oscillator.stop(start + duration + 0.7);
    });
    runtime.chordIndex += 1;
    runtime.nextChord += runtime.chordDuration;
  }

  function pumpLofi(runtime) {
    if (!runtime.playing || runtime.suspendedByVisibility || runtime.disposed) return;
    const horizon = runtime.context.currentTime + 1.25;
    while (runtime.nextChord < horizon) scheduleLofiChord(runtime);
  }

  function startLofiScheduler(runtime) {
    if (!runtime || runtime.kind !== "procedural" || runtime.scheduler || runtime.disposed) return;
    runtime.nextChord = Math.max(runtime.nextChord, runtime.context.currentTime + 0.05);
    pumpLofi(runtime);
    runtime.scheduler = global.setInterval(() => pumpLofi(runtime), 380);
  }

  function stopLofiScheduler(runtime) {
    if (!runtime?.scheduler) return;
    global.clearInterval(runtime.scheduler);
    runtime.scheduler = 0;
  }

  function createVinylBed(runtime) {
    const sampleRate = Math.max(8000, Number(runtime.context.sampleRate) || 44100);
    const buffer = runtime.context.createBuffer(1, sampleRate * 4, sampleRate);
    const samples = buffer.getChannelData(0);
    let dust = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (Math.random() < 2.1 / sampleRate) dust = 0.12 + Math.random() * 0.22;
      dust *= 0.965;
      samples[index] = white * 0.008 + dust * white;
    }
    const source = runtime.context.createBufferSource();
    const filter = runtime.context.createBiquadFilter();
    const gain = runtime.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "bandpass";
    setAudioParam(filter.frequency, 2450, runtime.context.currentTime);
    if (filter.Q) setAudioParam(filter.Q, 0.42, runtime.context.currentTime);
    setAudioParam(gain.gain, 0.055, runtime.context.currentTime);
    source.connect(filter); filter.connect(gain); gain.connect(runtime.filter);
    source.start(runtime.context.currentTime);
    runtime.bed = { source, filter, gain };
  }

  function startProceduralMusic(instance, track) {
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Trình duyệt không hỗ trợ Web Audio.");
    const context = new AudioContextCtor();
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor?.() || null;
    filter.type = "lowpass";
    setAudioParam(filter.frequency, 3150, context.currentTime);
    if (filter.Q) setAudioParam(filter.Q, 0.34, context.currentTime);
    if (compressor) {
      compressor.threshold.value = -24; compressor.knee.value = 20; compressor.ratio.value = 3.5;
      compressor.attack.value = 0.045; compressor.release.value = 0.5;
      filter.connect(compressor); compressor.connect(output);
    } else filter.connect(output);
    output.connect(context.destination);
    const chordDuration = (60 / 68) * 4;
    const runtime = {
      kind: "procedural", trackId: track.id, context, output, filter, compressor, nodes: new Set(), bed: null,
      chordIndex: 0, chordDuration, nextChord: context.currentTime + 0.06, playing: true,
      suspendedByVisibility: false, disposed: false, scheduler: 0, position: 0, duration: 0
    };
    instance.music = runtime;
    createVinylBed(runtime);
    startLofiScheduler(runtime);
    applyMusicGain(instance);
    return Promise.resolve(context.resume?.());
  }

  function addMusicListener(runtime, type, listener) {
    runtime.element.addEventListener(type, listener);
    runtime.listeners.push([type, listener]);
  }

  function startFileMusic(instance, track) {
    if (typeof global.Audio !== "function") throw new Error("Trình duyệt không hỗ trợ phát nhạc cục bộ.");
    const element = new global.Audio();
    const runtime = {
      kind: "file", trackId: track.id, element, listeners: [], playing: true, suspendedByVisibility: false,
      disposed: false, position: 0, duration: track.duration || 0
    };
    instance.music = runtime;
    element.preload = "metadata";
    element.src = track.src;
    element.loop = instance.state.audio.music.loop;
    addMusicListener(runtime, "loadedmetadata", () => {
      runtime.duration = Number(element.duration) || track.duration || 0;
      instance.musicStatus = "Sẵn sàng · tệp cục bộ";
      syncMusicDom(instance);
    });
    addMusicListener(runtime, "timeupdate", () => {
      runtime.position = Number(element.currentTime) || 0;
      syncMusicDom(instance);
    });
    addMusicListener(runtime, "waiting", () => { instance.musicStatus = "Đang nạp nhạc cục bộ…"; syncMusicDom(instance); });
    addMusicListener(runtime, "playing", () => { instance.musicStatus = "Đang phát · tệp cục bộ CC0"; syncMusicDom(instance); });
    addMusicListener(runtime, "ended", () => {
      runtime.playing = false; runtime.position = 0;
      instance.musicStatus = "Đã phát xong";
      updatePlaybackSignal(instance); syncMusicDom(instance);
    });
    addMusicListener(runtime, "error", () => {
      runtime.playing = false;
      instance.musicStatus = "Không thể đọc tệp nhạc cục bộ.";
      updatePlaybackSignal(instance); syncMusicDom(instance);
    });
    applyMusicGain(instance);
    return Promise.resolve(element.play());
  }

  function destroyMusic(instance) {
    const runtime = instance.music;
    if (!runtime) return;
    instance.music = null;
    runtime.disposed = true;
    if (runtime.kind === "file") {
      try { runtime.element.pause(); } catch {}
      runtime.listeners?.forEach(([type, listener]) => runtime.element.removeEventListener(type, listener));
      try { runtime.element.removeAttribute("src"); runtime.element.load?.(); } catch {}
    } else {
      stopLofiScheduler(runtime);
      try { runtime.bed?.source?.stop(); } catch {}
      runtime.nodes?.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect?.(); } catch {} });
      [runtime.bed?.source, runtime.bed?.filter, runtime.bed?.gain, runtime.filter, runtime.compressor, runtime.output].forEach((node) => { try { node?.disconnect?.(); } catch {} });
      try { runtime.context.close?.(); } catch {}
    }
    updatePlaybackSignal(instance);
  }

  function startMusic(instance) {
    const track = currentMusicTrack(instance);
    if (instance.music && instance.music.trackId !== track.id) destroyMusic(instance);
    if (instance.music?.trackId === track.id) {
      instance.music.playing = true;
      instance.music.suspendedByVisibility = false;
      startLofiScheduler(instance.music);
      const resume = instance.music.kind === "file" ? instance.music.element.play() : instance.music.context.resume?.();
      instance.musicStatus = `Đang phát · ${track.kind === "file" ? "tệp cục bộ" : "lo-fi tạo cục bộ"}`;
      Promise.resolve(resume).then(() => { applyMusicGain(instance); updatePlaybackSignal(instance); syncMusicDom(instance); })
        .catch((error) => { instance.music.playing = false; instance.musicStatus = `Không thể phát: ${cleanText(error?.message, 100)}`; updatePlaybackSignal(instance); syncMusicDom(instance); });
      return;
    }
    instance.musicStatus = "Đang khởi động sau thao tác của bạn…";
    syncMusicDom(instance);
    try {
      const start = track.kind === "file" ? startFileMusic(instance, track) : startProceduralMusic(instance, track);
      Promise.resolve(start).then(() => {
        if (!instance.music || instance.music.trackId !== track.id) return;
        instance.musicStatus = `Đang phát · ${track.kind === "file" ? "tệp cục bộ CC0" : "lo-fi tạo cục bộ"}`;
        applyMusicGain(instance); updatePlaybackSignal(instance); syncMusicDom(instance);
        announce(instance, `Đang phát ${track.title}.`);
      }).catch((error) => {
        destroyMusic(instance);
        instance.musicStatus = `Không thể phát: ${cleanText(error?.message, 100)}`;
        syncMusicDom(instance);
      });
    } catch (error) {
      destroyMusic(instance);
      instance.musicStatus = `Không thể phát: ${cleanText(error?.message, 100)}`;
      syncMusicDom(instance);
    }
  }

  function pauseMusic(instance) {
    const runtime = instance.music;
    if (!runtime?.playing) return;
    runtime.playing = false;
    runtime.position = Number(runtime.element?.currentTime || runtime.position || 0);
    stopLofiScheduler(runtime);
    try { runtime.kind === "file" ? runtime.element.pause() : runtime.context.suspend?.(); } catch {}
    instance.musicStatus = "Đã tạm dừng · bấm phát để tiếp tục";
    updatePlaybackSignal(instance);
    syncMusicDom(instance);
  }

  function toggleMusic(instance) {
    if (instance.music?.trackId === currentMusicTrack(instance).id && instance.music.playing) pauseMusic(instance);
    else startMusic(instance);
  }

  function suspendMusicForVisibility(instance, hidden) {
    const runtime = instance.music;
    if (!runtime || !runtime.playing) return;
    runtime.suspendedByVisibility = hidden;
    if (hidden) {
      stopLofiScheduler(runtime);
      try { runtime.kind === "file" ? runtime.element.pause() : runtime.context.suspend?.(); } catch {}
      instance.musicStatus = "Tạm dừng khi tab đang ẩn";
      updatePlaybackSignal(instance); syncMusicDom(instance);
      return;
    }
    startLofiScheduler(runtime);
    const resume = runtime.kind === "file" ? runtime.element.play() : runtime.context.resume?.();
    Promise.resolve(resume).then(() => {
      instance.musicStatus = `Đang phát · ${runtime.kind === "file" ? "tệp cục bộ CC0" : "lo-fi tạo cục bộ"}`;
      updatePlaybackSignal(instance); syncMusicDom(instance);
    }).catch(() => {
      runtime.playing = false;
      instance.musicStatus = "Đã tạm dừng · bấm phát để tiếp tục";
      updatePlaybackSignal(instance); syncMusicDom(instance);
    });
  }

  function applyMix(instance, mix, message) {
    if (sharedFollowerControls(instance, "audio", "Chủ phòng đang điều khiển phối âm chung.")) return;
    CHANNELS.forEach((channel) => { instance.state.audio.mix[channel.id] = clamp(mix?.[channel.id], 0, 1, 0); });
    writeState(instance);
    applyAudioGains(instance);
    render(instance);
    announce(instance, message);
    scheduleSharedSync(instance);
  }

  function currentRitual(instance, name) {
    return {
      id: id("ritual"),
      name: cleanText(name, 60) || "Bộ tập trung",
      sceneId: instance.state.scenes.selected,
      master: instance.state.audio.master,
      mix: { ...instance.state.audio.mix },
      music: { ...instance.state.audio.music },
      timer: {
        focusMinutes: instance.state.timer.focusMinutes,
        breakMinutes: instance.state.timer.breakMinutes,
        longBreakMinutes: instance.state.timer.longBreakMinutes,
        cycles: instance.state.timer.cycles
      },
      createdAt: Date.now()
    };
  }

  function builtInRitual(ritual) {
    return ritual ? {
      name: ritual.name,
      sceneId: ritual.sceneId,
      master: 0.5,
      mix: MIX_PRESETS[ritual.mixPreset]?.mix || {},
      music: { selected: ritual.musicId, volume: 0.26, loop: true },
      timer: {
        focusMinutes: ritual.focus,
        breakMinutes: ritual.rest,
        longBreakMinutes: ritual.longRest,
        cycles: ritual.cycles
      }
    } : null;
  }

  function applyRitual(instance, ritual) {
    if (!ritual) return;
    if (sharedFollowerControls(instance, "scene") || sharedFollowerControls(instance, "timer") || sharedFollowerControls(instance, "audio")) return;
    if (instance.state.timer.running) {
      announce(instance, "Hãy tạm dừng phiên đang chạy trước khi đổi nghi thức.", "error");
      return;
    }
    const targetScene = allScenes(instance).find((item) => item.id === ritual.sceneId) || SCENES[0];
    const musicChanged = instance.state.audio.music.selected !== ritual.music.selected;
    if (musicChanged) destroyMusic(instance);
    instance.state.scenes.selected = targetScene.id;
    instance.state.scenes.recent = [targetScene.id, ...instance.state.scenes.recent.filter((sceneId) => sceneId !== targetScene.id)].slice(0, 12);
    instance.state.audio.master = clamp(ritual.master, 0, 1, 0.5);
    CHANNELS.forEach((channel) => { instance.state.audio.mix[channel.id] = clamp(ritual.mix?.[channel.id], 0, 1, 0); });
    instance.state.audio.music = {
      selected: MUSIC_TRACKS.some((track) => track.id === ritual.music?.selected) ? ritual.music.selected : MUSIC_TRACKS[0].id,
      volume: clamp(ritual.music?.volume, 0, 1, 0.26),
      loop: ritual.music?.loop !== false
    };
    Object.assign(instance.state.timer, {
      phase: "focus",
      focusMinutes: clamp(ritual.timer?.focusMinutes, 1, 180, 25),
      breakMinutes: clamp(ritual.timer?.breakMinutes, 1, 60, 5),
      longBreakMinutes: clamp(ritual.timer?.longBreakMinutes, 1, 90, 15),
      cycles: Math.round(clamp(ritual.timer?.cycles, 1, 20, 4)),
      cycle: 1,
      running: false,
      endsAt: 0,
      startedAt: 0,
      sessionId: "",
      previousScene: ""
    });
    instance.state.timer.duration = timerDuration(instance.state.timer);
    instance.state.timer.remaining = instance.state.timer.duration;
    applyAudioGains(instance);
    writeState(instance);
    render(instance);
    announce(instance, `Đã chuẩn bị ${ritual.name}; âm thanh chưa tự phát.`);
    scheduleSharedSync(instance);
  }

  function logDistraction(instance, label, note = "") {
    const timer = instance.state.timer;
    instance.state.planning.distractions.push({
      id: id("distraction"),
      label: cleanText(label, 60) || "Xao nhãng",
      note: cleanText(note, 180),
      createdAt: Date.now(),
      sessionId: timer.phase === "focus" ? timer.sessionId : "",
      taskId: instance.state.primaryTaskId
    });
    instance.state.planning.distractions = instance.state.planning.distractions.slice(-500);
    writeState(instance);
    render(instance);
    announce(instance, "Đã ghi nhận; đồng hồ vẫn tiếp tục chạy.");
  }

  function applyScene(instance, sceneId) {
    if (sharedFollowerControls(instance, "scene", "Chủ phòng đang điều khiển không gian chung.")) return;
    const target = allScenes(instance).find((item) => item.id === sceneId);
    if (!target) return;
    instance.state.scenes.selected = target.id;
    instance.state.scenes.recent = [target.id, ...instance.state.scenes.recent.filter((item) => item !== target.id)].slice(0, 12);
    if (target.mix && Object.keys(target.mix).length) {
      CHANNELS.forEach((channel) => { instance.state.audio.mix[channel.id] = clamp(target.mix[channel.id], 0, 1, 0); });
      applyAudioGains(instance);
    }
    writeState(instance);
    render(instance);
    announce(instance, `Đã mở ${target.title}.`);
    scheduleSharedSync(instance);
  }

  function toggleListValue(list, value, maximum = 48) {
    return list.includes(value) ? list.filter((item) => item !== value) : [value, ...list].slice(0, maximum);
  }

  function setupParallax(instance) {
    if (instance.pointerCleanup) instance.pointerCleanup();
    instance.pointerCleanup = null;
    const app = instance.root.querySelector("[data-hfr-root]");
    const stage = instance.root.querySelector(".hfr-stage");
    if (!app || !stage || app.dataset.motion !== "on" || app.dataset.quality !== "high") return;
    let frame = 0;
    let nextX = 0; let nextY = 0;
    const move = (event) => {
      const rect = stage.getBoundingClientRect();
      nextX = clamp((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5, -0.5, 0.5, 0);
      nextY = clamp((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5, -0.5, 0.5, 0);
      if (frame) return;
      frame = global.requestAnimationFrame(() => {
        frame = 0;
        stage.style.setProperty("--hfr-x", String(nextX));
        stage.style.setProperty("--hfr-y", String(nextY));
      });
    };
    stage.addEventListener("pointermove", move, { passive: true });
    instance.pointerCleanup = () => {
      stage.removeEventListener("pointermove", move);
      if (frame) global.cancelAnimationFrame(frame);
    };
  }

  function teardownPetDepth(instance) {
    instance.petDepthGeneration = (instance.petDepthGeneration || 0) + 1;
    const runtime = instance.petDepth;
    instance.petDepth = null;
    if (!runtime) return;
    global.cancelAnimationFrame?.(runtime.frame);
    runtime.observer?.disconnect?.();
    runtime.stage?.removeEventListener?.("pointermove", runtime.pointerMove);
    runtime.stage?.removeEventListener?.("pointerleave", runtime.pointerLeave);
    runtime.canvas?.removeEventListener?.("webglcontextlost", runtime.contextLost);
    try { runtime.geometry?.dispose?.(); } catch {}
    try { runtime.material?.dispose?.(); } catch {}
    try { runtime.texture?.dispose?.(); } catch {}
    try { runtime.renderer?.dispose?.(); } catch {}
    if (runtime.canvas) runtime.canvas.hidden = true;
    const app = instance.root.querySelector?.("[data-hfr-root]");
    if (app) delete app.dataset.petDepth;
  }

  async function setupPetDepth(instance, selected) {
    const profile = PET_DEPTH_PROFILES[selected.effect];
    const app = instance.root.querySelector?.("[data-hfr-root]");
    const stage = instance.root.querySelector?.(".hfr-stage");
    const canvas = instance.root.querySelector?.("[data-hfr-pet-depth]");
    const image = instance.root.querySelector?.("[data-hfr-current-image]");
    if (!profile || !app || !stage || !canvas || !image || global.document?.hidden) return;
    if (effectiveQuality(instance) !== "high" || !motionEnabled(instance) || instance.state.settings.dataSaver) return;
    if (typeof canvas.getContext !== "function" || typeof global.requestAnimationFrame !== "function") return;
    const generation = instance.petDepthGeneration;
    try {
      if (!image.complete || !image.naturalWidth) {
        await new Promise((resolve, reject) => {
          const loaded = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error("pet image unavailable")); };
          const cleanup = () => { image.removeEventListener("load", loaded); image.removeEventListener("error", failed); };
          image.addEventListener("load", loaded, { once: true });
          image.addEventListener("error", failed, { once: true });
        });
      }
      if (generation !== instance.petDepthGeneration || !canvas.isConnected) return;
      const THREE = await import(THREE_MODULE);
      if (generation !== instance.petDepthGeneration || !canvas.isConnected) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(1.5, Math.max(1, Number(global.devicePixelRatio) || 1)));
      renderer.setClearColor(0x000000, 0);
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      const texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const uniforms = {
        uTexture: { value: texture }, uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(1, 1) }, uImageSize: { value: new THREE.Vector2(image.naturalWidth || 1, image.naturalHeight || 1) },
        uPet: { value: new THREE.Vector2(profile.x, 1 - profile.y) }, uRadius: { value: new THREE.Vector2(profile.radiusX, profile.radiusY) },
        uImagePosition: { value: new THREE.Vector2(profile.imageX, 0.5) }, uPace: { value: profile.pace }
      };
      const material = new THREE.ShaderMaterial({
        uniforms, transparent: true, depthTest: false, depthWrite: false,
        vertexShader: `
          uniform float uTime; uniform vec2 uPointer; uniform vec2 uPet; uniform vec2 uRadius; uniform float uPace;
          varying vec2 vUv; varying float vPetMask;
          void main() {
            vUv = uv;
            vec2 delta = (uv - uPet) / uRadius;
            vPetMask = 1.0 - smoothstep(0.55, 1.12, length(delta));
            float breath = sin(uTime * uPace * 2.0) * 0.5 + sin(uTime * uPace * 0.73) * 0.22;
            vec3 transformed = position;
            transformed.z += vPetMask * (0.032 + breath * 0.009);
            transformed.x += vPetMask * (uPointer.x * 0.018 + breath * 0.0018);
            transformed.y += vPetMask * (uPointer.y * 0.012 + breath * 0.0024);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D uTexture; uniform vec2 uResolution; uniform vec2 uImageSize; uniform vec2 uImagePosition;
          varying vec2 vUv; varying float vPetMask;
          vec2 coverUv(vec2 uv) {
            float viewAspect = uResolution.x / max(1.0, uResolution.y);
            float imageAspect = uImageSize.x / max(1.0, uImageSize.y);
            vec2 visible = vec2(1.0);
            if (imageAspect > viewAspect) visible.x = viewAspect / imageAspect;
            else visible.y = imageAspect / viewAspect;
            return (vec2(1.0) - visible) * uImagePosition + uv * visible;
          }
          void main() {
            vec4 color = texture2D(uTexture, coverUv(vUv));
            float feather = smoothstep(0.0, 0.34, vPetMask);
            color.rgb *= 1.018;
            gl_FragColor = vec4(color.rgb, color.a * feather * 0.96);
          }`
      });
      const geometry = new THREE.PlaneGeometry(2, 2, 40, 28);
      const mesh = new THREE.Mesh(geometry, material);
      const scene3d = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
      camera.position.z = 3;
      scene3d.add(mesh);
      const runtime = {
        renderer, texture, material, geometry, mesh, camera, scene3d, stage, canvas, observer: null, frame: 0,
        pointerMove: null, pointerLeave: null, contextLost: null, targetX: 0, targetY: 0, pointerX: 0, pointerY: 0, lastRender: 0,
        startedAt: global.performance?.now?.() || Date.now()
      };
      instance.petDepth = runtime;
      const resize = () => {
        const rect = stage.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const planeHeight = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
        mesh.scale.set((planeHeight * camera.aspect) / 2, planeHeight / 2, 1);
        uniforms.uResolution.value.set(width, height);
      };
      runtime.pointerMove = (event) => {
        const rect = stage.getBoundingClientRect();
        runtime.targetX = clamp((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5, -0.5, 0.5, 0);
        runtime.targetY = clamp(0.5 - (event.clientY - rect.top) / Math.max(1, rect.height), -0.5, 0.5, 0);
      };
      runtime.pointerLeave = () => { runtime.targetX = 0; runtime.targetY = 0; };
      runtime.contextLost = (event) => { event.preventDefault?.(); teardownPetDepth(instance); };
      stage.addEventListener("pointermove", runtime.pointerMove, { passive: true });
      stage.addEventListener("pointerleave", runtime.pointerLeave, { passive: true });
      canvas.addEventListener("webglcontextlost", runtime.contextLost);
      if (global.ResizeObserver) {
        runtime.observer = new global.ResizeObserver(resize);
        runtime.observer.observe(stage);
      }
      resize();
      canvas.hidden = false;
      app.dataset.petDepth = "ready";
      const loop = (time) => {
        if (instance.petDepth !== runtime || global.document?.hidden || !motionEnabled(instance) || effectiveQuality(instance) !== "high") return;
        runtime.frame = global.requestAnimationFrame(loop);
        if (time - runtime.lastRender < 1000 / 30) return;
        runtime.lastRender = time;
        runtime.pointerX += (runtime.targetX - runtime.pointerX) * 0.055;
        runtime.pointerY += (runtime.targetY - runtime.pointerY) * 0.055;
        uniforms.uPointer.value.set(runtime.pointerX, runtime.pointerY);
        uniforms.uTime.value = Math.max(0, (time - runtime.startedAt) / 1000);
        renderer.render(scene3d, camera);
      };
      runtime.frame = global.requestAnimationFrame(loop);
    } catch {
      if (generation === instance.petDepthGeneration) {
        canvas.hidden = true;
        if (app) app.dataset.petDepth = "fallback";
      }
    }
  }

  function layoutItem(instance, name) {
    if (!["title", "clock", "dock"].includes(name)) return null;
    return instance.root.querySelector?.(`[data-hfr-layout-item="${name}"]`) || null;
  }

  function canUseFreeLayout(instance) {
    const stage = instance.root.querySelector?.(".hfr-stage");
    if (!stage?.getBoundingClientRect) return false;
    const rect = stage.getBoundingClientRect();
    return rect.width >= 840 && rect.height >= 620 && !instance.ui.zen;
  }

  function scheduleLayout(instance) {
    if (instance.layoutDrag) finishLayoutDrag(instance);
    global.cancelAnimationFrame?.(instance.layoutFrame);
    instance.layoutFrame = global.requestAnimationFrame?.(() => {
      instance.layoutFrame = 0;
      applyLayout(instance);
    }) || 0;
  }

  function layoutMeasurement(stage, item) {
    if (!stage?.getBoundingClientRect || !item?.getBoundingClientRect) return null;
    item.style.removeProperty("transform");
    const stageRect = stage.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const margin = 12;
    return {
      minX: stageRect.left + margin - itemRect.left,
      maxX: stageRect.right - margin - itemRect.right,
      minY: stageRect.top + margin - itemRect.top,
      maxY: stageRect.bottom - margin - itemRect.bottom
    };
  }

  function pixelFromLayoutPoint(point, bounds) {
    return {
      x: point.x >= 0 ? point.x * Math.max(0, bounds.maxX) : -point.x * Math.min(0, bounds.minX),
      y: point.y >= 0 ? point.y * Math.max(0, bounds.maxY) : -point.y * Math.min(0, bounds.minY)
    };
  }

  function layoutPointFromPixel(x, y, bounds) {
    const ratio = (value, minimum, maximum) => value >= 0
      ? (maximum > 0 ? value / maximum : 0)
      : (minimum < 0 ? value / -minimum : 0);
    return {
      x: clamp(ratio(x, bounds.minX, bounds.maxX), -1, 1, 0),
      y: clamp(ratio(y, bounds.minY, bounds.maxY), -1, 1, 0)
    };
  }

  function applyLayout(instance) {
    const app = instance.root.querySelector?.("[data-hfr-root]");
    const stage = instance.root.querySelector?.(".hfr-stage");
    if (!app || !stage) return;
    const supported = canUseFreeLayout(instance);
    app.dataset.layoutMode = supported ? (instance.state.layout.locked ? "locked" : "editing") : "compact";
    ["title", "clock", "dock"].forEach((name) => {
      const item = layoutItem(instance, name);
      if (!item) return;
      item.style.removeProperty("transform");
      if (!supported) return;
      const bounds = layoutMeasurement(stage, item);
      if (!bounds) return;
      const point = pixelFromLayoutPoint(instance.state.layout[name], bounds);
      item.style.transform = `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0)`;
    });
  }

  function setupLayout(instance) {
    instance.layoutObserver?.disconnect?.();
    instance.layoutObserver = null;
    applyLayout(instance);
    const stage = instance.root.querySelector?.(".hfr-stage");
    if (!stage || !global.ResizeObserver) return;
    const observer = new global.ResizeObserver(() => {
      if (instance.layoutDrag) return;
      scheduleLayout(instance);
    });
    observer.observe(stage);
    instance.layoutObserver = observer;
  }

  function handleLayoutPointerDown(instance, event) {
    const handle = event.target.closest?.("[data-hfr-drag-handle]");
    if (!handle || event.button > 0 || instance.state.layout.locked || !canUseFreeLayout(instance)) return;
    const name = cleanText(handle.dataset.hfrDragHandle, 20);
    const stage = instance.root.querySelector?.(".hfr-stage");
    const item = layoutItem(instance, name);
    const bounds = layoutMeasurement(stage, item);
    if (!stage || !item || !bounds) return;
    const start = pixelFromLayoutPoint(instance.state.layout[name], bounds);
    item.style.transform = `translate3d(${start.x.toFixed(2)}px, ${start.y.toFixed(2)}px, 0)`;
    instance.layoutDrag = {
      name, handle, item, stage, bounds, start,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    };
    stage.dataset.layoutDragging = name;
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  }

  function handleLayoutPointerMove(instance, event) {
    const drag = instance.layoutDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = clamp(drag.start.x + event.clientX - drag.clientX, drag.bounds.minX, drag.bounds.maxX, drag.start.x);
    const y = clamp(drag.start.y + event.clientY - drag.clientY, drag.bounds.minY, drag.bounds.maxY, drag.start.y);
    drag.item.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    instance.state.layout[drag.name] = layoutPointFromPixel(x, y, drag.bounds);
    event.preventDefault?.();
  }

  function finishLayoutDrag(instance, event) {
    const drag = instance.layoutDrag;
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
    drag.handle.releasePointerCapture?.(drag.pointerId);
    delete drag.stage.dataset.layoutDragging;
    instance.layoutDrag = null;
    writeState(instance);
    applyLayout(instance);
    announce(instance, `Đã lưu vị trí ${drag.name === "clock" ? "đồng hồ" : drag.name === "title" ? "tên cảnh" : "thanh công cụ"}.`);
  }

  function handleLayoutKeydown(instance, event) {
    const handle = event.target.closest?.("[data-hfr-drag-handle]");
    if (!handle || instance.state.layout.locked || !canUseFreeLayout(instance)) return;
    const name = cleanText(handle.dataset.hfrDragHandle, 20);
    if (!Object.hasOwn(instance.state.layout, name)) return;
    const step = event.shiftKey ? 0.12 : 0.035;
    const point = instance.state.layout[name];
    const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key === "Home") {
      instance.state.layout[name] = { x: 0, y: 0 };
    } else if (deltas[event.key]) {
      instance.state.layout[name] = {
        x: clamp(point.x + deltas[event.key][0], -1, 1, 0),
        y: clamp(point.y + deltas[event.key][1], -1, 1, 0)
      };
    } else if (event.key === "Escape") {
      instance.state.layout.locked = true;
      writeState(instance);
      render(instance);
      announce(instance, "Đã khóa bố cục.");
      event.preventDefault?.();
      return;
    } else return;
    writeState(instance);
    applyLayout(instance);
    event.preventDefault?.();
  }

  function resetLayout(instance) {
    const locked = instance.state.layout.locked;
    instance.state.layout = { ...defaultLayout(), locked };
    writeState(instance);
    render(instance);
    announce(instance, "Đã đưa các mục về vị trí mặc định.");
  }

  function preloadNextScene(instance) {
    if (effectiveQuality(instance) === "eco" || instance.state.settings.dataSaver) return;
    const selectedIndex = SCENES.findIndex((item) => item.id === instance.state.scenes.selected);
    const target = SCENES[(selectedIndex + 1 + SCENES.length) % SCENES.length];
    const preload = new Image();
    preload.decoding = "async";
    preload.src = target.image;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error("IndexedDB không khả dụng"));
      const request = global.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không thể mở kho ảnh"));
    });
  }

  async function putCustomImage(instance, metadata, blob) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put({ key: `${instance.owner}:${metadata.id}`, owner: instance.owner, id: metadata.id, blob, updatedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Không thể lưu ảnh"));
        tx.onabort = () => reject(tx.error || new Error("Lưu ảnh bị hủy"));
      });
    } finally { db.close(); }
  }

  async function getCustomImage(instance, sceneId) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(`${instance.owner}:${sceneId}`);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error || new Error("Không thể đọc ảnh"));
      });
    } finally { db.close(); }
  }

  async function deleteCustomImage(instance, sceneId) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(`${instance.owner}:${sceneId}`);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Không thể xóa ảnh"));
      });
    } finally { db.close(); }
  }

  async function hydrateCustomImages(instance) {
    for (const metadata of instance.state.scenes.custom) {
      try {
        const blob = await getCustomImage(instance, metadata.id);
        if (blob && instances.get(instance.root) === instance) instance.objectUrls.set(metadata.id, URL.createObjectURL(blob));
      } catch {
        instance.mediaStatus = "Không thể đọc một số ảnh cá nhân.";
      }
    }
    if (instances.get(instance.root) === instance) render(instance);
  }

  function moveTask(instance, taskId, direction) {
    const index = instance.state.tasks.findIndex((task) => task.id === taskId);
    const next = index + Math.sign(Number(direction));
    if (index < 0 || next < 0 || next >= instance.state.tasks.length) return;
    const [task] = instance.state.tasks.splice(index, 1);
    instance.state.tasks.splice(next, 0, task);
    writeState(instance);
    render(instance);
  }

  function downloadJson(instance) {
    const payload = {
      schema: "hh.focus-room.export",
      schemaVersion: VERSION,
      exportedAt: new Date().toISOString(),
      accountScope: instance.owner,
      note: "Ảnh nền cá nhân lưu trong IndexedDB không được nhúng vào JSON.",
      data: { ...instance.state, scenes: { ...instance.state.scenes, custom: [] } }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = `hh-focus-room-${localDay()}.json`;
    link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(instance, "Đã xuất dữ liệu Focus Room.");
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadHistoryCsv(instance) {
    const header = ["Bắt đầu", "Kết thúc", "Phút", "Nhiệm vụ", "Ý định", "Không gian", "Số lần xao nhãng"];
    const rows = instance.state.history.map((entry) => {
      const sceneItem = allScenes(instance).find((item) => item.id === entry.sceneId);
      return [
        new Date(entry.startedAt).toISOString(),
        new Date(entry.endedAt).toISOString(),
        Math.round(entry.durationSeconds / 60),
        entry.taskTitle,
        entry.intention,
        sceneItem?.title || "Không gian đã xóa",
        entry.distractionCount
      ];
    });
    const content = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = `hh-focus-history-${localDay()}.csv`;
    link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(instance, `Đã xuất ${rows.length} phiên sang CSV.`);
  }

  async function importJson(instance, file) {
    if (!file || file.size > 2 * 1024 * 1024) throw new Error("Tệp JSON phải nhỏ hơn 2 MB.");
    const parsed = JSON.parse(await file.text());
    if (parsed?.schema !== "hh.focus-room.export" || parsed?.schemaVersion !== VERSION || !parsed.data) throw new Error("Tệp không đúng định dạng Focus Room v2.");
    const custom = instance.state.scenes.custom;
    const selected = instance.state.scenes.selected;
    instance.state = normalizeState(parsed.data);
    instance.state.scenes.custom = custom;
    if (custom.some((item) => item.id === selected)) instance.state.scenes.selected = selected;
    writeState(instance);
    reconcileTimer(instance);
    ensureTimerLoop(instance);
    render(instance);
    announce(instance, "Đã nhập dữ liệu Focus Room.");
  }

  async function handleUpload(instance, form) {
    const file = form.elements.scene?.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Chỉ hỗ trợ JPG, PNG hoặc WebP.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh phải nhỏ hơn 10 MB.");
    const metadata = { id: id("custom"), title: cleanText(file.name.replace(/\.[^.]+$/, ""), 80) || "Không gian cá nhân", createdAt: Date.now() };
    await putCustomImage(instance, metadata, file);
    const objectUrl = URL.createObjectURL(file);
    instance.objectUrls.set(metadata.id, objectUrl);
    instance.state.scenes.custom.push(metadata);
    instance.state.scenes.selected = metadata.id;
    instance.state.scenes.recent = [metadata.id, ...instance.state.scenes.recent].slice(0, 12);
    writeState(instance);
    render(instance);
    announce(instance, "Đã lưu không gian cá nhân trên thiết bị.");
  }

  function handleClick(instance, event) {
    const target = event.target.closest?.("[data-hfr-action]");
    if (!target) return;
    const action = target.dataset.hfrAction;
    const targetId = cleanText(target.dataset.id, 100);
    if (action === "panel") {
      instance.ui.panel = instance.ui.panel === target.dataset.panel ? "" : target.dataset.panel;
      render(instance);
      return;
    }
    if (action === "close-panel") { instance.ui.panel = ""; render(instance); return; }
    if (action === "copy-room-code") { copySharedText(instance, instance.sharedRoom.code, "Đã sao chép mã phòng."); return; }
    if (action === "copy-room-link") {
      const location = global.location || {};
      const link = `${location.origin || ""}${location.pathname || "/"}#/focus-room?room=${encodeURIComponent(instance.sharedRoom.code)}`;
      copySharedText(instance, link, "Đã sao chép liên kết mời.");
      return;
    }
    if (action === "leave-shared-room") { void leaveSharedRoom(instance); return; }
    if (action === "plan-timer-toggle") { toggleTimer(instance); render(instance); return; }
    if (action === "apply-built-in-ritual") { applyRitual(instance, builtInRitual(FOCUS_RITUALS.find((ritual) => ritual.id === targetId))); return; }
    if (action === "apply-user-ritual") { applyRitual(instance, instance.state.planning.rituals.find((ritual) => ritual.id === targetId)); return; }
    if (action === "delete-user-ritual") {
      instance.state.planning.rituals = instance.state.planning.rituals.filter((ritual) => ritual.id !== targetId);
      writeState(instance); render(instance); announce(instance, "Đã xóa bộ tập trung."); return;
    }
    if (action === "log-distraction") { logDistraction(instance, target.dataset.value); return; }
    if (action === "delete-distraction") {
      instance.state.planning.distractions = instance.state.planning.distractions.filter((entry) => entry.id !== targetId);
      writeState(instance); render(instance); return;
    }
    if (action === "favorites-only") { instance.ui.favoritesOnly = !instance.ui.favoritesOnly; render(instance); return; }
    if (action === "scene-view") { instance.ui.sceneView = instance.ui.sceneView === "grid" ? "list" : "grid"; render(instance); return; }
    if (action === "scene-category") { instance.ui.category = target.dataset.value || "all"; render(instance); return; }
    if (action === "select-scene") { applyScene(instance, targetId); return; }
    if (action === "favorite-scene") {
      instance.state.scenes.favorites = toggleListValue(instance.state.scenes.favorites, targetId);
      writeState(instance); render(instance); return;
    }
    if (action === "pin-scene") {
      instance.state.scenes.pinned = toggleListValue(instance.state.scenes.pinned, targetId, 12);
      writeState(instance); render(instance); return;
    }
    if (action === "delete-custom-scene") {
      if (!instance.state.scenes.custom.some((item) => item.id === targetId)) return;
      deleteCustomImage(instance, targetId).then(() => {
        URL.revokeObjectURL(instance.objectUrls.get(targetId) || "");
        instance.objectUrls.delete(targetId);
        instance.state.scenes.custom = instance.state.scenes.custom.filter((item) => item.id !== targetId);
        instance.state.scenes.favorites = instance.state.scenes.favorites.filter((item) => item !== targetId);
        instance.state.scenes.pinned = instance.state.scenes.pinned.filter((item) => item !== targetId);
        instance.state.scenes.recent = instance.state.scenes.recent.filter((item) => item !== targetId);
        if (instance.state.scenes.selected === targetId) instance.state.scenes.selected = SCENES[0].id;
        writeState(instance); render(instance); announce(instance, "Đã xóa ảnh cá nhân.");
      }).catch((error) => announce(instance, cleanText(error?.message, 140), "error"));
      return;
    }
    if (action === "audio-toggle") { startAudio(instance); return; }
    if (action === "music-toggle") { toggleMusic(instance); return; }
    if (action === "music-select") {
      const track = MUSIC_TRACKS.find((item) => item.id === targetId);
      if (!track || track.id === instance.state.audio.music.selected) return;
      destroyMusic(instance);
      instance.state.audio.music.selected = track.id;
      instance.musicStatus = "Đã chọn · nhạc chỉ phát khi bạn bấm nút phát";
      writeState(instance); render(instance);
      announce(instance, `Đã chọn ${track.title}.`);
      return;
    }
    if (action === "music-loop") {
      instance.state.audio.music.loop = !instance.state.audio.music.loop;
      if (instance.music?.element) instance.music.element.loop = instance.state.audio.music.loop;
      writeState(instance); render(instance);
      announce(instance, instance.state.audio.music.loop ? "Đã bật lặp nhạc." : "Đã tắt lặp nhạc.");
      return;
    }
    if (action === "mix-preset") {
      const preset = MIX_PRESETS[targetId];
      if (preset) applyMix(instance, preset.mix, `Đã áp dụng ${preset.label}.`);
      return;
    }
    if (action === "load-user-mix") {
      const preset = instance.state.audio.presets.find((item) => item.id === targetId);
      if (preset) applyMix(instance, preset.mix, `Đã mở ${preset.name}.`);
      return;
    }
    if (action === "delete-user-mix") {
      instance.state.audio.presets = instance.state.audio.presets.filter((item) => item.id !== targetId);
      writeState(instance); render(instance); return;
    }
    if (action === "timer-preset") {
      if (sharedFollowerControls(instance, "timer")) return;
      const preset = TIMER_PRESETS.find((item) => item.id === targetId);
      if (!preset) return;
      Object.assign(instance.state.timer, { focusMinutes: preset.focus, breakMinutes: preset.rest, longBreakMinutes: preset.longRest, phase: "focus", cycle: 1, running: false, endsAt: 0, startedAt: 0, sessionId: "", duration: preset.focus * 60, remaining: preset.focus * 60 });
      stopTimerLoop(instance); writeState(instance); render(instance); announce(instance, `Đã chọn ${preset.label}.`); scheduleSharedSync(instance); return;
    }
    if (action === "timer-toggle") { toggleTimer(instance); return; }
    if (action === "timer-skip") { advancePhase(instance, true); return; }
    if (action === "timer-reset") { resetTimer(instance); return; }
    if (action === "toggle-task") {
      const task = instance.state.tasks.find((item) => item.id === targetId);
      if (task) task.done = !task.done;
      writeState(instance); render(instance); return;
    }
    if (action === "primary-task") {
      instance.state.primaryTaskId = instance.state.primaryTaskId === targetId ? "" : targetId;
      writeState(instance); render(instance); return;
    }
    if (action === "edit-task") { instance.ui.editTaskId = targetId; render(instance); return; }
    if (action === "cancel-edit-task") { instance.ui.editTaskId = ""; render(instance); return; }
    if (action === "move-task") { moveTask(instance, targetId, target.dataset.direction); return; }
    if (action === "delete-task") {
      instance.state.tasks = instance.state.tasks.filter((item) => item.id !== targetId);
      if (instance.state.primaryTaskId === targetId) instance.state.primaryTaskId = "";
      writeState(instance); render(instance); return;
    }
    if (action === "layout-edit") {
      if (instance.state.layout.locked && !canUseFreeLayout(instance)) {
        announce(instance, "Kéo thả khả dụng khi cửa sổ đủ rộng; ở mức phóng to hiện tại phòng đang dùng bố cục an toàn.", "error");
        return;
      }
      finishLayoutDrag(instance);
      instance.state.layout.locked = !instance.state.layout.locked;
      writeState(instance);
      render(instance);
      announce(instance, instance.state.layout.locked ? "Đã khóa bố cục." : "Có thể kéo các tay nắm để sắp xếp phòng.");
      return;
    }
    if (action === "layout-reset") { finishLayoutDrag(instance); resetLayout(instance); return; }
    if (action === "motion-toggle") {
      if (global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        instance.state.settings.motion = false;
        instance.state.settings.reducedMotion = true;
        writeState(instance); render(instance); announce(instance, "Thiết bị đang ưu tiên giảm chuyển động."); return;
      }
      instance.state.settings.motion = !instance.state.settings.motion;
      writeState(instance); render(instance); announce(instance, instance.state.settings.motion ? "Đã bật chuyển động." : "Đã tạm dừng chuyển động."); return;
    }
    if (action === "zen") { finishLayoutDrag(instance); instance.ui.zen = !instance.ui.zen; instance.ui.panel = ""; render(instance); return; }
    if (action === "fullscreen") {
      const stage = instance.root.querySelector(".hfr-stage");
      if (global.document.fullscreenElement) global.document.exitFullscreen?.();
      else stage?.requestFullscreen?.().catch?.(() => announce(instance, "Trình duyệt không cho phép toàn màn hình.", "error"));
      return;
    }
    if (action === "enable-notifications") {
      if (!global.Notification) return announce(instance, "Trình duyệt không hỗ trợ thông báo.", "error");
      global.Notification.requestPermission().then((permission) => {
        instance.state.settings.notifications = permission === "granted";
        writeState(instance); render(instance);
        announce(instance, permission === "granted" ? "Đã bật thông báo." : "Quyền thông báo chưa được cấp.", permission === "granted" ? "success" : "error");
      });
      return;
    }
    if (action === "wake-lock-toggle") {
      if (instance.wakeLockWanted) releaseWakeLock(instance);
      else requestWakeLock(instance);
      return;
    }
    if (action === "export-history-csv") { downloadHistoryCsv(instance); return; }
    if (action === "export-data") { downloadJson(instance); }
  }

  function handleInput(instance, event) {
    if (event.target.matches("[data-hfr-scene-search]")) {
      instance.ui.search = cleanText(event.target.value, 100);
      global.clearTimeout(instance.searchTimer);
      instance.searchTimer = global.setTimeout(() => {
        render(instance);
        const input = instance.root.querySelector("[data-hfr-scene-search]");
        input?.focus?.({ preventScroll: true });
        input?.setSelectionRange?.(input.value.length, input.value.length);
      }, 140);
      return;
    }
    if (event.target.matches("[data-hfr-master]")) {
      if (sharedFollowerControls(instance, "audio", "Chủ phòng đang điều khiển phối âm chung.")) { render(instance); return; }
      instance.state.audio.master = clamp(event.target.value, 0, 100, 50) / 100;
      const output = instance.root.querySelector("[data-hfr-master-output]");
      if (output) output.textContent = `${Math.round(instance.state.audio.master * 100)}%`;
      writeState(instance); applyAudioGains(instance); scheduleSharedSync(instance); return;
    }
    if (event.target.matches("[data-hfr-music-volume]")) {
      instance.state.audio.music.volume = clamp(event.target.value, 0, 100, 28) / 100;
      const output = instance.root.querySelector("[data-hfr-music-volume-output]");
      if (output) output.textContent = `${Math.round(instance.state.audio.music.volume * 100)}%`;
      writeState(instance); applyMusicGain(instance); return;
    }
    if (event.target.matches("[data-hfr-music-seek]")) {
      const runtime = instance.music;
      if (runtime?.kind !== "file" || !runtime.element) return;
      const maximum = Number(runtime.element.duration || runtime.duration || 0);
      const position = clamp(event.target.value, 0, Math.max(0, maximum), 0);
      try { runtime.element.currentTime = position; runtime.position = position; } catch {}
      syncMusicDom(instance); return;
    }
    if (event.target.matches("[data-hfr-channel]")) {
      if (sharedFollowerControls(instance, "audio", "Chủ phòng đang điều khiển phối âm chung.")) { render(instance); return; }
      const channelId = event.target.dataset.hfrChannel;
      if (!Object.hasOwn(instance.state.audio.mix, channelId)) return;
      instance.state.audio.mix[channelId] = clamp(event.target.value, 0, 100, 0) / 100;
      const output = instance.root.querySelector(`[data-hfr-channel-output="${channelId}"]`);
      if (output) output.textContent = `${Math.round(instance.state.audio.mix[channelId] * 100)}%`;
      writeState(instance); applyAudioGains(instance); scheduleSharedSync(instance); return;
    }
    if (event.target.matches("[data-hfr-note]")) {
      instance.state.note = String(event.target.value || "").slice(0, 10000);
      instance.notePending = true;
      const status = instance.root.querySelector("[data-hfr-note-status]");
      if (status) status.textContent = "Đang lưu…";
      global.clearTimeout(instance.noteTimer);
      instance.noteTimer = global.setTimeout(() => {
        writeState(instance);
        instance.notePending = false;
        if (status?.isConnected) status.textContent = "Đã lưu trên thiết bị";
      }, 350);
    }
  }

  function handleSubmit(instance, event) {
    const form = event.target;
    if (form.matches("[data-hfr-shared-create]")) {
      event.preventDefault();
      void createSharedRoom(instance, new FormData(form).get("name"));
      return;
    }
    if (form.matches("[data-hfr-shared-join]")) {
      event.preventDefault();
      void joinSharedRoom(instance, new FormData(form).get("code")).catch(() => {});
      return;
    }
    if (form.matches("[data-hfr-upload-form]")) {
      event.preventDefault();
      handleUpload(instance, form).catch((error) => announce(instance, cleanText(error?.message, 160), "error"));
      return;
    }
    if (form.matches("[data-hfr-plan-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      instance.state.planning.dailyGoalMinutes = Math.round(clamp(data.get("dailyGoal"), 15, 720, 120));
      instance.state.planning.intention = cleanText(data.get("intention"), 240);
      writeState(instance); render(instance); announce(instance, "Đã lưu mục tiêu và ý định phiên học."); return;
    }
    if (form.matches("[data-hfr-ritual-save]")) {
      event.preventDefault();
      const name = cleanText(new FormData(form).get("name"), 60);
      if (!name) return announce(instance, "Hãy đặt tên cho bộ tập trung.", "error");
      instance.state.planning.rituals.unshift(currentRitual(instance, name));
      instance.state.planning.rituals = instance.state.planning.rituals.slice(0, 12);
      writeState(instance); render(instance); announce(instance, "Đã lưu toàn bộ cấu hình hiện tại."); return;
    }
    if (form.matches("[data-hfr-distraction-form]")) {
      event.preventDefault();
      const note = cleanText(new FormData(form).get("note"), 180);
      if (!note) return announce(instance, "Hãy nhập nguyên nhân xao nhãng.", "error");
      logDistraction(instance, "Ghi chú", note); return;
    }
    if (form.matches("[data-hfr-task-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      const title = cleanText(data.get("title"), 180);
      if (!title) return announce(instance, "Hãy nhập tên nhiệm vụ.", "error");
      const task = { id: id("task"), title, target: Math.round(clamp(data.get("target"), 1, 20, 1)), done: false, createdAt: Date.now() };
      instance.state.tasks.push(task);
      if (!instance.state.primaryTaskId) instance.state.primaryTaskId = task.id;
      writeState(instance); render(instance); announce(instance, "Đã thêm nhiệm vụ."); return;
    }
    if (form.matches("[data-hfr-task-edit-form]")) {
      event.preventDefault();
      const task = instance.state.tasks.find((item) => item.id === cleanText(form.dataset.id, 100));
      const data = new FormData(form);
      const title = cleanText(data.get("title"), 180);
      if (!task || !title) return announce(instance, "Không thể lưu nhiệm vụ này.", "error");
      task.title = title;
      task.target = Math.round(clamp(data.get("target"), 1, 20, task.target));
      instance.ui.editTaskId = "";
      writeState(instance); render(instance); announce(instance, "Đã cập nhật nhiệm vụ."); return;
    }
    if (form.matches("[data-hfr-mix-save]")) {
      event.preventDefault();
      const name = cleanText(new FormData(form).get("name"), 60);
      if (!name) return announce(instance, "Hãy đặt tên bản phối.", "error");
      instance.state.audio.presets.unshift({ id: id("mix"), name, mix: { ...instance.state.audio.mix } });
      instance.state.audio.presets = instance.state.audio.presets.slice(0, 12);
      writeState(instance); render(instance); announce(instance, "Đã lưu bản phối."); return;
    }
    if (form.matches("[data-hfr-timer-form]")) {
      event.preventDefault();
      if (sharedFollowerControls(instance, "timer")) return;
      const data = new FormData(form);
      const timer = instance.state.timer;
      timer.focusMinutes = clamp(data.get("focus"), 1, 180, 25);
      timer.breakMinutes = clamp(data.get("rest"), 1, 60, 5);
      timer.longBreakMinutes = clamp(data.get("longRest"), 1, 90, 15);
      timer.cycles = Math.round(clamp(data.get("cycles"), 1, 20, 4));
      timer.phase = "focus"; timer.cycle = 1; timer.running = false; timer.endsAt = 0; timer.startedAt = 0; timer.sessionId = "";
      timer.duration = timer.focusMinutes * 60; timer.remaining = timer.duration;
      stopTimerLoop(instance); writeState(instance); render(instance); announce(instance, "Đã áp dụng chu kỳ tùy chỉnh."); scheduleSharedSync(instance); return;
    }
    if (form.matches("[data-hfr-settings-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      const settings = instance.state.settings;
      settings.quality = ["eco", "balanced", "high"].includes(data.get("quality")) ? data.get("quality") : "balanced";
      ["motion", "reducedMotion", "dataSaver", "autoStartBreak", "autoStartFocus", "sceneOnBreak"].forEach((name) => { settings[name] = data.get(name) === "on"; });
      settings.restScene = SCENES.some((item) => item.id === data.get("restScene")) ? data.get("restScene") : "ocean-sunset";
      writeState(instance); render(instance); announce(instance, "Đã lưu cài đặt.");
    }
  }

  function handleChange(instance, event) {
    if (event.target.matches("[data-hfr-shared-pref]")) {
      applySharedPreference(instance, cleanText(event.target.dataset.hfrSharedPref, 20), event.target.checked === true);
      return;
    }
    if (event.target.matches("[data-hfr-import]")) {
      const file = event.target.files?.[0];
      importJson(instance, file).catch((error) => announce(instance, cleanText(error?.message, 160), "error"));
    }
  }

  function handleImageError(instance, event) {
    const image = event.target;
    if (!image.matches?.("[data-hfr-fallback]") || image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = "true";
    image.src = FALLBACK_IMAGE;
    announce(instance, "Không thể tải cảnh đã chọn, đang dùng ảnh dự phòng.", "error");
  }

  function handleVisibility(instance) {
    const hidden = Boolean(global.document?.hidden);
    const app = instance.root.querySelector("[data-hfr-root]");
    if (app) app.dataset.visibility = hidden ? "hidden" : "visible";
    if (hidden) {
      stopTimerLoop(instance);
      instance.pointerCleanup?.();
      instance.pointerCleanup = null;
      teardownPetDepth(instance);
      instance.audio?.context?.suspend?.().catch?.(() => {});
      suspendMusicForVisibility(instance, true);
      releaseWakeLock(instance, true);
      updatePlaybackSignal(instance);
    } else {
      reconcileTimer(instance);
      ensureTimerLoop(instance);
      setupParallax(instance);
      setupPetDepth(instance, currentScene(instance));
      instance.audio?.context?.resume?.().then?.(() => updatePlaybackSignal(instance)).catch?.(() => {});
      suspendMusicForVisibility(instance, false);
      if (instance.wakeLockWanted) requestWakeLock(instance);
    }
  }

  function handleStorage(instance, event) {
    if (event.key !== instance.storageKey || !event.newValue) return;
    try {
      const incoming = normalizeState(JSON.parse(event.newValue));
      if (incoming.updatedAt <= instance.state.updatedAt) return;
      instance.state = incoming;
      reconcileTimer(instance);
      ensureTimerLoop(instance);
      render(instance);
      announce(instance, "Phiên đã được đồng bộ từ tab khác.");
    } catch {}
  }

  function addListener(instance, target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    instance.cleanup.push(() => target?.removeEventListener?.(type, listener, options));
  }

  function mount(root, options = {}) {
    if (!root || typeof root.replaceChildren !== "function") return false;
    unmount(root);
    const owner = accountFingerprint(options);
    const storageKey = `${STATE_PREFIX}${owner}`;
    const instance = {
      root, options, owner, storageKey, isGuest: options.currentUser?.guest === true || owner === "guest", state: readState(storageKey, options),
      ui: { panel: "", search: "", category: "all", favoritesOnly: false, sceneView: "grid", zen: false, editTaskId: "" },
      sharedRoom: {
        status: "idle", message: "", code: "", name: "", selfId: "", role: "", members: [], revision: 0,
        syncScene: true, syncTimer: true, syncAudio: false, lastState: null, personalSnapshot: null,
        applying: false, broadcastTimer: 0, inviteCode: ""
      },
      cleanup: [], objectUrls: new Map(), audio: null, audioStatus: "Âm thanh đang tắt",
      music: null, musicStatus: "Nhạc đang tắt · không tự phát", mediaActive: false,
      petDepth: null, petDepthGeneration: 0,
      wakeLock: null, wakeLockWanted: false,
      wakeLockStatus: global.navigator?.wakeLock?.request ? "Đang tắt" : "Trình duyệt không hỗ trợ Screen Wake Lock",
      timerInterval: 0, pointerCleanup: null, layoutObserver: null, layoutFrame: 0, layoutDrag: null,
      toastTimer: 0, noteTimer: 0, notePending: false, searchTimer: 0, mediaStatus: ""
    };
    instances.set(root, instance);
    mountedRoots.add(root);
    render(instance);
    reconcileTimer(instance);
    ensureTimerLoop(instance);
    addListener(instance, root, "click", (event) => handleClick(instance, event));
    addListener(instance, root, "input", (event) => handleInput(instance, event));
    addListener(instance, root, "submit", (event) => handleSubmit(instance, event));
    addListener(instance, root, "change", (event) => handleChange(instance, event));
    addListener(instance, root, "pointerdown", (event) => handleLayoutPointerDown(instance, event));
    addListener(instance, root, "pointermove", (event) => handleLayoutPointerMove(instance, event));
    addListener(instance, root, "pointerup", (event) => finishLayoutDrag(instance, event));
    addListener(instance, root, "pointercancel", (event) => finishLayoutDrag(instance, event));
    addListener(instance, root, "keydown", (event) => handleLayoutKeydown(instance, event));
    addListener(instance, global.document, "keydown", (event) => handleShortcut(instance, event));
    addListener(instance, root, "error", (event) => handleImageError(instance, event), true);
    addListener(instance, global.document, "visibilitychange", () => handleVisibility(instance));
    addListener(instance, global, "storage", (event) => handleStorage(instance, event));
    addListener(instance, global, "resize", () => scheduleLayout(instance));
    addListener(instance, global.visualViewport, "resize", () => scheduleLayout(instance));
    addListener(instance, global.document, "fullscreenchange", () => {
      const app = instance.root.querySelector("[data-hfr-root]");
      if (app) app.dataset.fullscreen = global.document.fullscreenElement ? "true" : "false";
    });
    setupSharedRealtime(instance);
    if (!safeRead(storageKey, null)) writeState(instance);
    hydrateCustomImages(instance);
    return {
      route: ROUTE,
      getState: () => JSON.parse(JSON.stringify(instance.state)),
      getSharedRoom: () => JSON.parse(JSON.stringify({ ...instance.sharedRoom, personalSnapshot: instance.sharedRoom.personalSnapshot ? "captured" : null })),
      createSharedRoom: (name) => createSharedRoom(instance, name),
      joinSharedRoom: (code) => joinSharedRoom(instance, code),
      leaveSharedRoom: () => leaveSharedRoom(instance),
      openPanel: (panel) => { instance.ui.panel = panelLabel(panel) ? panel : ""; render(instance); },
      unmount: () => unmount(root)
    };
  }

  function unmount(root) {
    if (!root) {
      [...mountedRoots].forEach((entry) => unmount(entry));
      return;
    }
    const instance = instances.get(root);
    if (!instance) return;
    if (instance.sharedRoom?.code) global.HHRealtime?.emit?.("workspace:room:leave", { service: REALTIME_SERVICE }, { timeout: 2000 }).catch(() => {});
    global.clearTimeout(instance.sharedRoom?.broadcastTimer);
    stopTimerLoop(instance);
    stopAudio(instance);
    releaseWakeLock(instance);
    destroyMusic(instance);
    teardownPetDepth(instance);
    finishLayoutDrag(instance);
    instance.pointerCleanup?.();
    instance.layoutObserver?.disconnect?.();
    global.cancelAnimationFrame?.(instance.layoutFrame);
    global.clearTimeout(instance.toastTimer);
    if (instance.notePending) writeState(instance);
    global.clearTimeout(instance.noteTimer);
    global.clearTimeout(instance.searchTimer);
    instance.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    instance.cleanup.splice(0).reverse().forEach((cleanup) => { try { cleanup(); } catch {} });
    instances.delete(root);
    mountedRoots.delete(root);
    root.replaceChildren();
    delete root.dataset.hfrMounted;
  }

  function getState(root) {
    const instance = instances.get(root);
    return instance ? JSON.parse(JSON.stringify(instance.state)) : null;
  }

  const api = Object.freeze({
    version: VERSION,
    route: ROUTE,
    scenes: SCENES,
    channels: CHANNELS,
    musicTracks: MUSIC_TRACKS,
    canHandle: (route) => String(route || "").split("?")[0] === ROUTE,
    mount,
    unmount,
    getState
  });

  global.HHFocusRoom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
