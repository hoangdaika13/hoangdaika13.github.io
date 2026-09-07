(function initHHFocusRoom(global) {
  "use strict";

  const VERSION = 2;
  const ROUTE = "/focus-room";
  const STATE_PREFIX = "hh.focus-room.v2.";
  const LEGACY_KEY = "hh.galaxy.domain-views.v1";
  const LEGACY_STUDY_PREFIX = "hh.focus.study-room.v1";
  const DB_NAME = "hh-focus-room-media-v1";
  const DB_STORE = "scenes";
  const FALLBACK_IMAGE = "assets/focus-room/rainy-window.webp";
  const instances = new WeakMap();
  const mountedRoots = new Set();

  const CHANNELS = Object.freeze([
    { id: "rain", label: "Mưa nhẹ", icon: "☂", default: 0.52, type: "white", filter: "highpass", frequency: 1100 },
    { id: "heavy-rain", label: "Mưa lớn", icon: "☔", default: 0, type: "heavy-rain", filter: "bandpass", frequency: 820 },
    { id: "thunder", label: "Sấm xa", icon: "⌁", default: 0.1, type: "thunder", filter: "lowpass", frequency: 150 },
    { id: "wind", label: "Gió", icon: "≋", default: 0.16, type: "brown", filter: "lowpass", frequency: 620 },
    { id: "fire", label: "Lò sưởi", icon: "♨", default: 0.2, type: "fire", filter: "bandpass", frequency: 1700 },
    { id: "cafe", label: "Quán cà phê", icon: "☕", default: 0.12, type: "cafe", filter: "lowpass", frequency: 980 },
    { id: "keyboard", label: "Bàn phím", icon: "⌨", default: 0.08, type: "keyboard", filter: "highpass", frequency: 2300 },
    { id: "pages", label: "Lật sách", icon: "▤", default: 0, type: "pages", filter: "bandpass", frequency: 1450 },
    { id: "birds", label: "Chim rừng", icon: "♧", default: 0.1, type: "birds", filter: "bandpass", frequency: 3000 },
    { id: "ocean", label: "Sóng biển", icon: "≈", default: 0.2, type: "ocean", filter: "lowpass", frequency: 420 },
    { id: "stream", label: "Suối", icon: "⌇", default: 0.16, type: "stream", filter: "bandpass", frequency: 1350 },
    { id: "white", label: "White noise", icon: "W", default: 0, type: "white", filter: "allpass", frequency: 1000 },
    { id: "brown", label: "Brown noise", icon: "B", default: 0.08, type: "brown", filter: "lowpass", frequency: 520 },
    { id: "pink", label: "Pink noise", icon: "P", default: 0, type: "pink", filter: "lowpass", frequency: 1250 }
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
    scene("twilight-garden", "Phòng anime chạng vạng", "Minh họa", "Góc học anime nguyên bản, không nhân vật bản quyền, nhìn ra vườn đom đóm.", "illustrated", "fireflies", "assets/focus-room/twilight-garden.webp", ["birds", "stream"])
  ]);

  const MIX_PRESETS = Object.freeze({
    "deep-work": { label: "Deep Work", mix: { brown: 0.26, pink: 0.08, keyboard: 0.04 } },
    "rainy-night": { label: "Mưa đêm", mix: { rain: 0.62, thunder: 0.08, wind: 0.12, fire: 0.15 } },
    "quiet-cafe": { label: "Cà phê yên", mix: { cafe: 0.3, rain: 0.18, keyboard: 0.07 } },
    "green-morning": { label: "Rừng sớm", mix: { birds: 0.17, stream: 0.28, wind: 0.08 } },
    "ocean-flow": { label: "Sóng dịu", mix: { ocean: 0.38, wind: 0.1, pink: 0.05 } }
  });

  const TIMER_PRESETS = Object.freeze([
    { id: "classic", label: "Cổ điển", focus: 25, rest: 5, longRest: 15 },
    { id: "steady", label: "Ổn định", focus: 45, rest: 15, longRest: 20 },
    { id: "flow", label: "Flow", focus: 50, rest: 10, longRest: 20 },
    { id: "deep", label: "Deep Work", focus: 90, rest: 20, longRest: 30 }
  ]);

  function scene(id, title, time, description, category, effect, image, soundIds) {
    const mix = {};
    soundIds.forEach((soundId) => {
      const channel = CHANNELS.find((item) => item.id === soundId);
      mix[soundId] = channel ? channel.default : 0.1;
    });
    const performance = ["rain", "cafe-rain", "neon-rain", "snow"].includes(effect) ? "Cao" : ["ocean", "embers", "forest", "fireflies", "stars"].includes(effect) ? "Cân bằng" : "Tiết kiệm";
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
    return Object.fromEntries(CHANNELS.map((channel) => [channel.id, channel.id === "rain" ? 0.48 : channel.default]));
  }

  function createDefaultState() {
    const reduceMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    return {
      version: VERSION,
      scenes: { selected: "rainy-window", favorites: [], pinned: [], recent: ["rainy-window"], custom: [] },
      audio: { master: 0.5, mix: defaultMix(), presets: [] },
      timer: {
        phase: "focus", focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15,
        cycle: 1, cycles: 4, running: false, endsAt: 0, remaining: 1500,
        duration: 1500, startedAt: 0, sessionId: "", previousScene: ""
      },
      tasks: [],
      primaryTaskId: "",
      note: "",
      history: [],
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
      sceneId: cleanText(entry?.sceneId, 80)
    })).filter((entry) => entry.startedAt && entry.endedAt) : [];
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
    try { global.localStorage?.setItem(instance.storageKey, JSON.stringify(instance.state)); }
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
    return ({ scenes: "Không gian", sound: "Âm thanh", timer: "Hẹn giờ", tasks: "Công việc", notes: "Ghi chú", history: "Lịch sử", settings: "Cài đặt" })[panel] || "";
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
      ["cozy", "Ấm áp"], ["future", "Tương lai"], ["quiet", "Tối giản"], ["illustrated", "Minh họa"], ["custom", "Cá nhân"]
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

  function soundPanel(instance) {
    const audioActive = Boolean(instance.audio);
    return `<div class="hfr-panel-heading"><div><span>AMBIENT MIXER</span><h2>Âm thanh môi trường</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-audio-master">
        <button class="hfr-primary" type="button" data-hfr-action="audio-toggle" aria-pressed="${audioActive}">${audioActive ? "Tắt âm thanh" : "Bật âm thanh"}</button>
        <label><span>Âm lượng tổng <output data-hfr-master-output>${Math.round(instance.state.audio.master * 100)}%</output></span><input type="range" min="0" max="100" value="${Math.round(instance.state.audio.master * 100)}" data-hfr-master></label>
        <small data-hfr-audio-status>${instance.audioStatus}</small>
      </div>
      <div class="hfr-mix-presets">${Object.entries(MIX_PRESETS).map(([id, preset]) => `<button type="button" data-hfr-action="mix-preset" data-id="${id}">${escapeHtml(preset.label)}</button>`).join("")}</div>
      <div class="hfr-channel-grid">${CHANNELS.map((channel) => {
        const value = instance.state.audio.mix[channel.id];
        return `<label class="hfr-channel"><span><i>${channel.icon}</i><b>${escapeHtml(channel.label)}</b><output data-hfr-channel-output="${channel.id}">${Math.round(value * 100)}%</output></span><input type="range" min="0" max="100" value="${Math.round(value * 100)}" data-hfr-channel="${channel.id}"></label>`;
      }).join("")}</div>
      <form class="hfr-inline-form" data-hfr-mix-save><label><span>Tên preset</span><input name="name" maxlength="60" required placeholder="Ví dụ: Học đêm"></label><button type="submit">Lưu bản phối</button></form>
      <div class="hfr-saved-presets">${instance.state.audio.presets.length ? instance.state.audio.presets.map((preset) => `<span><button type="button" data-hfr-action="load-user-mix" data-id="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</button><button type="button" data-hfr-action="delete-user-mix" data-id="${escapeHtml(preset.id)}" aria-label="Xóa preset">×</button></span>`).join("") : `<small>Chưa có bản phối riêng.</small>`}</div>
      <p class="hfr-disclosure">Âm thanh được tạo cục bộ bằng Web Audio và chỉ chạy sau khi bạn bấm bật.</p>`;
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
    return `<div class="hfr-panel-heading"><div><span>SESSION TASKS</span><h2>Việc cần làm</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <form class="hfr-task-form" data-hfr-task-form><label><span>Nhiệm vụ mới</span><input name="title" maxlength="180" required placeholder="Bạn muốn hoàn thành việc gì?"></label><label><span>Mục tiêu</span><input name="target" type="number" min="1" max="20" value="1" required><small>phiên</small></label><button type="submit">Thêm</button></form>
      <div class="hfr-task-list">${tasks.length ? tasks.map((task, index) => instance.ui.editTaskId === task.id ? `<article class="hfr-task-edit-card"><form data-hfr-task-edit-form data-id="${escapeHtml(task.id)}"><label><span>Tên nhiệm vụ</span><input name="title" maxlength="180" value="${escapeHtml(task.title)}" required></label><label><span>Mục tiêu phiên</span><input name="target" type="number" min="1" max="20" value="${task.target}" required></label><div><button class="hfr-primary" type="submit">Lưu</button><button type="button" data-hfr-action="cancel-edit-task">Hủy</button></div></form></article>` : `<article class="${task.done ? "is-done" : ""}">
        <button type="button" data-hfr-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-pressed="${task.done}" aria-label="${task.done ? "Mở lại" : "Hoàn thành"}">${task.done ? "✓" : ""}</button>
        <button class="hfr-task-main" type="button" data-hfr-action="primary-task" data-id="${escapeHtml(task.id)}" aria-pressed="${instance.state.primaryTaskId === task.id}"><strong>${escapeHtml(task.title)}</strong><small>Mục tiêu ${task.target} phiên${instance.state.primaryTaskId === task.id ? " · đang tập trung" : ""}</small></button>
        <span><button type="button" data-hfr-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="Sửa nhiệm vụ">✎</button><button type="button" data-hfr-action="move-task" data-id="${escapeHtml(task.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Đưa lên">↑</button><button type="button" data-hfr-action="move-task" data-id="${escapeHtml(task.id)}" data-direction="1" ${index === tasks.length - 1 ? "disabled" : ""} aria-label="Đưa xuống">↓</button><button type="button" data-hfr-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="Xóa">×</button></span>
      </article>`).join("") : `<div class="hfr-empty"><span>✓</span><strong>Chưa có nhiệm vụ</strong><p>Thêm một việc cụ thể rồi chọn làm nhiệm vụ chính cho phiên.</p></div>`}</div>`;
  }

  function notesPanel(instance) {
    return `<div class="hfr-panel-heading"><div><span>QUICK NOTES</span><h2>Ghi chú phiên học</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <label class="hfr-note"><span>Ý tưởng, công thức hoặc điều cần nhớ</span><textarea data-hfr-note maxlength="10000" placeholder="Gõ ghi chú…">${escapeHtml(instance.state.note)}</textarea><small data-hfr-note-status>Đã lưu trên thiết bị</small></label>`;
  }

  function historyPanel(instance) {
    const today = localDay();
    const todayEntries = instance.state.history.filter((entry) => localDay(entry.endedAt) === today);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const weekEntries = instance.state.history.filter((entry) => entry.endedAt >= sevenDaysAgo);
    const todaySeconds = todayEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const weekSeconds = weekEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const taskProgress = new Map();
    instance.state.history.forEach((entry) => { if (entry.taskId) taskProgress.set(entry.taskId, (taskProgress.get(entry.taskId) || 0) + 1); });
    const targetTotal = instance.state.tasks.reduce((sum, task) => sum + task.target, 0);
    const reachedTotal = instance.state.tasks.reduce((sum, task) => sum + Math.min(task.target, taskProgress.get(task.id) || 0), 0);
    const targetRate = targetTotal ? Math.round(reachedTotal / targetTotal * 100) : 0;
    return `<div class="hfr-panel-heading"><div><span>TRUE HISTORY</span><h2>Lịch sử tập trung</h2></div><button type="button" data-hfr-action="close-panel" aria-label="Đóng bảng">×</button></div>
      <div class="hfr-stats"><article><strong>${todayEntries.length}</strong><span>phiên hôm nay</span></article><article><strong>${formatMinutes(todaySeconds)}</strong><span>hôm nay</span></article><article><strong>${formatMinutes(weekSeconds)}</strong><span>7 ngày gần nhất</span></article><article><strong>${targetRate}%</strong><span>mục tiêu nhiệm vụ</span></article></div>
      <div class="hfr-history-list">${instance.state.history.length ? [...instance.state.history].reverse().slice(0, 30).map((entry) => {
        const sceneItem = allScenes(instance).find((item) => item.id === entry.sceneId);
        return `<article><time datetime="${new Date(entry.endedAt).toISOString()}">${new Date(entry.endedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time><strong>${escapeHtml(entry.taskTitle || "Phiên tập trung")}</strong><small>${formatMinutes(entry.durationSeconds)} · ${escapeHtml(sceneItem?.title || "Không gian đã xóa")}</small></article>`;
      }).join("") : `<div class="hfr-empty"><span>◷</span><strong>Chưa có phiên hoàn thành</strong><p>Số liệu chỉ xuất hiện sau khi đồng hồ tập trung chạy hết.</p></div>`}</div>
      <button class="hfr-secondary" type="button" data-hfr-action="export-data">Xuất dữ liệu JSON</button>`;
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
      <section class="hfr-notification-card"><div><strong>Thông báo kết thúc phiên</strong><small>${notificationState}</small></div><button type="button" data-hfr-action="enable-notifications" ${!global.Notification || global.Notification.permission === "denied" ? "disabled" : ""}>Bật thông báo</button></section>
      <section class="hfr-shared-room"><span>PHÒNG HỌC CHUNG</span><strong>Chưa cấu hình</strong><p>Repository chưa có dịch vụ đồng bộ scene và Pomodoro dành riêng cho Focus Room. Không có thành viên hoặc phòng trực tuyến giả.</p></section>
      <section class="hfr-data-tools"><button type="button" data-hfr-action="export-data">Xuất JSON</button><label><input type="file" accept="application/json" data-hfr-import><span>Nhập JSON</span></label></section>`;
  }

  function settingToggle(name, title, description, checked) {
    return `<label><span>${escapeHtml(title)}<small>${escapeHtml(description)}</small></span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}></label>`;
  }

  function panelMarkup(instance) {
    const panel = instance.ui.panel;
    if (!panel) return "";
    const content = ({ scenes: scenePanel, sound: soundPanel, timer: timerPanel, tasks: tasksPanel, notes: notesPanel, history: historyPanel, settings: settingsPanel })[panel];
    return content ? content(instance) : "";
  }

  function render(instance) {
    const selected = currentScene(instance);
    const timer = instance.state.timer;
    const primaryTask = instance.state.tasks.find((task) => task.id === instance.state.primaryTaskId);
    const quality = effectiveQuality(instance);
    const activeMotion = motionEnabled(instance);
    const tabs = [
      ["scenes", "▧", "Không gian"], ["sound", "♫", "Âm thanh"], ["timer", "◷", "Hẹn giờ"],
      ["tasks", "✓", "Công việc"], ["notes", "✎", "Ghi chú"], ["history", "⌁", "Lịch sử"], ["settings", "⚙", "Cài đặt"]
    ];
    instance.root.innerHTML = `<section class="hfr-app${instance.ui.zen ? " is-zen" : ""}" data-hfr-root data-quality="${quality}" data-motion="${activeMotion ? "on" : "off"}">
      <section class="hfr-stage" data-hfr-effect="${escapeHtml(selected.effect)}" style="--hfr-accent:${selected.category === "nature" ? "#72f3bd" : selected.category === "cafe" || selected.category === "cozy" ? "#ffb46b" : selected.category === "future" ? "#7ee7ff" : "#c69cff"}">
        <div class="hfr-backdrop" aria-hidden="true" style="--hfr-placeholder:url(&quot;${escapeHtml(imageUrl(instance, selected, true))}&quot;)"><img src="${escapeHtml(imageUrl(instance, selected))}" alt="" decoding="async" fetchpriority="high" data-hfr-current-image data-hfr-fallback><span class="hfr-backdrop-shade"></span></div>
        <div class="hfr-effects" aria-hidden="true"><i class="hfr-fx hfr-fx--far"></i><i class="hfr-fx hfr-fx--mid"></i><i class="hfr-fx hfr-fx--near"></i><i class="hfr-fx hfr-fx--glow"></i></div>
        <header class="hfr-topbar">
          <div class="hfr-scene-title"><span>IMMERSIVE FOCUS SANCTUARY</span><strong>${escapeHtml(selected.title)}</strong><small>${escapeHtml(selected.description)}</small><div class="hfr-current-meta"><em>${escapeHtml(selected.soundStatus || "Ảnh cá nhân")}</em><em>${escapeHtml(selected.performance || "Theo thiết bị")}</em></div></div>
          <div class="hfr-top-actions">
            <span class="hfr-local-status">● Lưu cục bộ · ${instance.isGuest ? "Khách" : "Tài khoản hiện tại"}</span>
            <button type="button" data-hfr-action="motion-toggle" aria-pressed="${activeMotion}" title="Tạm dừng hoặc bật chuyển động">${activeMotion ? "Ⅱ Chuyển động" : "▶ Chuyển động"}</button>
            <button type="button" data-hfr-action="fullscreen" title="Toàn màn hình">⛶</button>
          </div>
        </header>
        <main class="hfr-focus-center">
          <section class="hfr-clock-card" aria-labelledby="hfr-clock-title">
            <span id="hfr-clock-title">${phaseLabel(timer.phase)}</span>
            <strong class="hfr-clock" data-hfr-clock role="timer" aria-live="off">${formatTimer(timer.remaining)}</strong>
            <small data-hfr-cycle>Vòng ${timer.cycle}/${timer.cycles}</small>
            <p data-hfr-primary-task>${primaryTask ? escapeHtml(primaryTask.title) : "Chọn một nhiệm vụ để bắt đầu"}</p>
            <div class="hfr-clock-progress"><i data-hfr-progress style="--hfr-progress:${Math.max(0, Math.min(1, timer.remaining / timer.duration))}"></i></div>
            <div class="hfr-clock-actions">
              <button class="hfr-primary" type="button" data-hfr-action="timer-toggle">${timer.running ? "Tạm dừng" : timer.remaining < timer.duration ? "Tiếp tục" : "Bắt đầu"}</button>
              <button type="button" data-hfr-action="timer-skip">Bỏ qua</button>
              <button type="button" data-hfr-action="timer-reset">Đặt lại</button>
            </div>
          </section>
        </main>
        <aside class="hfr-panel${instance.ui.panel ? " is-open" : ""}" aria-label="${escapeHtml(panelLabel(instance.ui.panel))}" ${instance.ui.panel ? "" : "hidden"}>${panelMarkup(instance)}</aside>
        <nav class="hfr-dock" aria-label="Công cụ phòng học">${tabs.map(([id, icon, label]) => `<button type="button" data-hfr-action="panel" data-panel="${id}" aria-pressed="${instance.ui.panel === id}"><i>${icon}</i><span>${label}</span></button>`).join("")}<button class="hfr-zen-button" type="button" data-hfr-action="zen" aria-pressed="${instance.ui.zen}"><i>◉</i><span>${instance.ui.zen ? "Thoát Zen" : "Zen"}</span></button></nav>
        <button class="hfr-zen-exit" type="button" data-hfr-action="zen">${instance.ui.zen ? "Thoát Zen" : ""}</button>
      </section>
      <div class="hfr-live" data-hfr-live role="status" aria-live="polite"></div>
      <div class="hfr-toast" data-hfr-toast role="status" aria-live="polite" hidden></div>
    </section>`;
    instance.root.dataset.hfrMounted = "true";
    syncTimerDom(instance);
    syncAudioDom(instance);
    setupParallax(instance);
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
          sceneId: instance.state.scenes.selected
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
  }

  function advancePhase(instance, skipped = false) {
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
  }

  function resetTimer(instance) {
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
  }

  function createNoiseBuffer(context, type) {
    const length = Math.max(1, Math.floor(context.sampleRate * 3));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (type === "brown" || type === "ocean" || type === "thunder") {
        brown = (brown + 0.02 * white) / 1.02;
        channel[index] = brown * (type === "thunder" && Math.random() > 0.999 ? 8 : 3.4);
      } else if (type === "heavy-rain") {
        channel[index] = white * 0.58 + (Math.random() > 0.992 ? white * 0.7 : 0);
      } else if (type === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852; b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
        channel[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      } else if (type === "fire" || type === "keyboard" || type === "pages" || type === "birds") {
        const chance = type === "birds" ? 0.998 : type === "pages" ? 0.997 : type === "keyboard" ? 0.993 : 0.988;
        channel[index] = Math.random() > chance ? white * 0.9 : white * 0.035;
      } else if (type === "cafe") channel[index] = white * 0.12 + Math.sin(index / 43) * 0.02;
      else if (type === "stream") channel[index] = white * (0.2 + Math.sin(index / 331) * 0.08);
      else channel[index] = white * 0.38;
    }
    return buffer;
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
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      CHANNELS.forEach((channel) => {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = createNoiseBuffer(context, channel.type);
        source.loop = true;
        filter.type = channel.filter;
        filter.frequency.value = channel.frequency;
        gain.gain.value = instance.state.audio.mix[channel.id] * phaseGain(instance);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        sources[channel.id] = { source, filter, gain };
      });
      instance.audio = { context, master, sources };
      master.gain.setTargetAtTime(instance.state.audio.master, context.currentTime, 0.12);
      Promise.resolve(context.resume()).then(() => {
        if (!instance.audio || instance.audio.context !== context) return;
        instance.audioStatus = "Đang phát · tạo cục bộ";
        syncAudioDom(instance);
        emitPlayback(true);
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
    if (!instance.audio) return;
    const now = instance.audio.context.currentTime;
    instance.audio.master.gain.setTargetAtTime(instance.state.audio.master, now, 0.08);
    CHANNELS.forEach((channel) => {
      const target = instance.state.audio.mix[channel.id] * phaseGain(instance);
      instance.audio.sources[channel.id]?.gain?.gain?.setTargetAtTime(target, now, 0.12);
    });
  }

  function stopAudio(instance) {
    const audio = instance.audio;
    if (!audio) return;
    instance.audio = null;
    Object.values(audio.sources).forEach((entry) => {
      try { entry.source.stop(); } catch {}
      try { entry.source.disconnect(); } catch {}
      try { entry.filter.disconnect(); } catch {}
      try { entry.gain.disconnect(); } catch {}
    });
    try { audio.master.disconnect(); } catch {}
    try { audio.context.close(); } catch {}
    instance.audioStatus = "Âm thanh đang tắt";
    emitPlayback(false);
    syncAudioDom(instance);
  }

  function emitPlayback(active) {
    try { global.dispatchEvent(new global.CustomEvent("hh:media-playback", { detail: { active, source: "hh-focus-room" } })); } catch {}
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

  function applyMix(instance, mix, message) {
    CHANNELS.forEach((channel) => { instance.state.audio.mix[channel.id] = clamp(mix?.[channel.id], 0, 1, 0); });
    writeState(instance);
    applyAudioGains(instance);
    render(instance);
    announce(instance, message);
  }

  function applyScene(instance, sceneId) {
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
      const preset = TIMER_PRESETS.find((item) => item.id === targetId);
      if (!preset) return;
      Object.assign(instance.state.timer, { focusMinutes: preset.focus, breakMinutes: preset.rest, longBreakMinutes: preset.longRest, phase: "focus", cycle: 1, running: false, endsAt: 0, startedAt: 0, sessionId: "", duration: preset.focus * 60, remaining: preset.focus * 60 });
      stopTimerLoop(instance); writeState(instance); render(instance); announce(instance, `Đã chọn ${preset.label}.`); return;
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
    if (action === "motion-toggle") {
      if (global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        instance.state.settings.motion = false;
        instance.state.settings.reducedMotion = true;
        writeState(instance); render(instance); announce(instance, "Thiết bị đang ưu tiên giảm chuyển động."); return;
      }
      instance.state.settings.motion = !instance.state.settings.motion;
      writeState(instance); render(instance); announce(instance, instance.state.settings.motion ? "Đã bật chuyển động." : "Đã tạm dừng chuyển động."); return;
    }
    if (action === "zen") { instance.ui.zen = !instance.ui.zen; instance.ui.panel = ""; render(instance); return; }
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
      instance.state.audio.master = clamp(event.target.value, 0, 100, 50) / 100;
      const output = instance.root.querySelector("[data-hfr-master-output]");
      if (output) output.textContent = `${Math.round(instance.state.audio.master * 100)}%`;
      writeState(instance); applyAudioGains(instance); return;
    }
    if (event.target.matches("[data-hfr-channel]")) {
      const channelId = event.target.dataset.hfrChannel;
      if (!Object.hasOwn(instance.state.audio.mix, channelId)) return;
      instance.state.audio.mix[channelId] = clamp(event.target.value, 0, 100, 0) / 100;
      const output = instance.root.querySelector(`[data-hfr-channel-output="${channelId}"]`);
      if (output) output.textContent = `${Math.round(instance.state.audio.mix[channelId] * 100)}%`;
      writeState(instance); applyAudioGains(instance); return;
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
    if (form.matches("[data-hfr-upload-form]")) {
      event.preventDefault();
      handleUpload(instance, form).catch((error) => announce(instance, cleanText(error?.message, 160), "error"));
      return;
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
      const data = new FormData(form);
      const timer = instance.state.timer;
      timer.focusMinutes = clamp(data.get("focus"), 1, 180, 25);
      timer.breakMinutes = clamp(data.get("rest"), 1, 60, 5);
      timer.longBreakMinutes = clamp(data.get("longRest"), 1, 90, 15);
      timer.cycles = Math.round(clamp(data.get("cycles"), 1, 20, 4));
      timer.phase = "focus"; timer.cycle = 1; timer.running = false; timer.endsAt = 0; timer.startedAt = 0; timer.sessionId = "";
      timer.duration = timer.focusMinutes * 60; timer.remaining = timer.duration;
      stopTimerLoop(instance); writeState(instance); render(instance); announce(instance, "Đã áp dụng chu kỳ tùy chỉnh."); return;
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
      instance.audio?.context?.suspend?.().catch?.(() => {});
    } else {
      reconcileTimer(instance);
      ensureTimerLoop(instance);
      setupParallax(instance);
      instance.audio?.context?.resume?.().catch?.(() => {});
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
      cleanup: [], objectUrls: new Map(), audio: null, audioStatus: "Âm thanh đang tắt",
      timerInterval: 0, pointerCleanup: null, toastTimer: 0, noteTimer: 0, notePending: false, searchTimer: 0, mediaStatus: ""
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
    addListener(instance, root, "error", (event) => handleImageError(instance, event), true);
    addListener(instance, global.document, "visibilitychange", () => handleVisibility(instance));
    addListener(instance, global, "storage", (event) => handleStorage(instance, event));
    addListener(instance, global.document, "fullscreenchange", () => {
      const app = instance.root.querySelector("[data-hfr-root]");
      if (app) app.dataset.fullscreen = global.document.fullscreenElement ? "true" : "false";
    });
    if (!safeRead(storageKey, null)) writeState(instance);
    hydrateCustomImages(instance);
    return {
      route: ROUTE,
      getState: () => JSON.parse(JSON.stringify(instance.state)),
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
    stopTimerLoop(instance);
    stopAudio(instance);
    instance.pointerCleanup?.();
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
    canHandle: (route) => String(route || "").split("?")[0] === ROUTE,
    mount,
    unmount,
    getState
  });

  global.HHFocusRoom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
