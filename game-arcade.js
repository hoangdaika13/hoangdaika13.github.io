(function () {
  "use strict";

  const SCHEMA = "hh.arcade.galaxy.v3";
  const STORE = SCHEMA;
  const LEGACY_STORE = "hh.arcade.galaxy.v2";
  const LEVEL_SCHEMA = "hh.creator.level.v1";
  const REPLAY_SCHEMA = "hh.game.replay.v1";
  const INTEGRATION_VERSION = 3;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const rnd = (min, max) => min + Math.random() * (max - min);

  const games = [
    ["neon-drift", "Neon Drift", "Đua tàu né cổng plasma", "Đua", "runner", "ND", "#67f2ff"],
    ["galaxy-defense", "Galaxy Defense", "Thủ thành chống wave ngoài hành tinh", "Chiến đấu", "shooter", "GD", "#ff6f91"],
    ["star-colony", "Star Colony", "Xây thuộc địa cân bằng tài nguyên", "Mô phỏng", "colony", "SC", "#7cffb2"],
    ["cipher-run", "Cipher Run", "Giải mã hệ thống bỏ hoang", "Giải đố", "cipher", "CR", "#c7a2ff"],
    ["asteroid-miner", "Asteroid Miner", "Khai thác và craft module", "Khai thác", "clicker", "AM", "#ffe66f"],
    ["rhythm-reactor", "Rhythm Reactor", "Bấm theo nhịp reactor", "Âm nhạc", "rhythm", "RR", "#ff63c9"],
    ["quiz-arena", "Quiz Arena", "Đấu kiến thức nhanh", "Quiz", "quiz", "QA", "#8affdf"],
    ["creative-sandbox", "Creative Sandbox", "Xây tàu, map và hành tinh", "Sáng tạo", "sandbox", "CS", "#79a7ff"],
    ["space-chess", "Space Chess", "Cờ chiến thuật kỹ năng", "Chiến thuật", "board", "SX", "#ffc857"],
    ["survival-orbit", "Survival Orbit", "Sinh tồn trên trạm quỹ đạo", "Sinh tồn", "survival", "SO", "#9dfffb"],
    ["galaxy-farm", "Galaxy Farm", "Trồng cây tinh vân và thu hoạch sao", "Mô phỏng", "farm", "GF", "#93ff75"],
    ["space-fishing", "Space Fishing", "Câu cá lượng tử trong vành đai sao", "Thư giãn", "fishing", "SF", "#66d9ff"],
    ["mecha-arena", "Mecha Arena", "Đấu robot trong đấu trường thiên hà", "Chiến đấu", "arena", "MA", "#ff8b5d"],
    ["planet-builder", "Planet Builder", "Ghép lõi, biển, rừng và thành phố", "Sáng tạo", "builder", "PB", "#b6ff6b"],
    ["alien-pet", "Alien Pet", "Nuôi thú ngoài hành tinh biết tiến hóa", "Nuôi pet", "pet", "AP", "#ff9fe5"],
    ["dungeon-stars", "Dungeon Stars", "Rogue-lite qua hầm ngục sao", "Phiêu lưu", "dungeon", "DS", "#d7b3ff"],
    ["cosmic-card-battle", "Cosmic Card Battle", "Đấu bài năng lượng vũ trụ", "Thẻ bài", "card", "CB", "#ffd36a"],
    ["astro-tycoon", "Astro Tycoon", "Kinh doanh trạm không gian", "Tycoon", "tycoon", "AT", "#6fffc6"],
    ["space-runner", "Space Runner", "Chạy vô tận qua đường hầm sao", "Đua", "runner", "SR", "#86b7ff"],
    ["black-hole-escape", "Black Hole Escape", "Thoát lực hút hố đen", "Sinh tồn", "escape", "BH", "#b58cff"],
    ["nebula-puzzle", "Nebula Puzzle", "Ghép cụm tinh vân cùng màu", "Giải đố", "match", "NP", "#ff7fda"],
    ["boss-rush", "Boss Rush", "Đánh boss liên tục, né đạn và phản công", "Boss", "boss", "BR", "#ff4f5e"]
  ].map(([id, title, desc, category, mode, icon, color]) => ({ id, title, desc, category, mode, icon, color }));

  const RUNTIME_SCHEMA = "hh.arcade.runtime.v1";
  const DIFFICULTIES = {
    easy: { id: "easy", label: "De", speed: 0.78, target: 0.72, lives: 5, reward: 0.8 },
    normal: { id: "normal", label: "Thuong", speed: 1, target: 1, lives: 3, reward: 1 },
    hard: { id: "hard", label: "Kho", speed: 1.26, target: 1.3, lives: 2, reward: 1.45 }
  };
  const ENGINE_GROUPS = {
    action: new Set(["neon-drift", "galaxy-defense", "asteroid-miner", "rhythm-reactor", "mecha-arena", "space-runner", "black-hole-escape", "boss-rush"]),
    strategy: new Set(["star-colony", "galaxy-defense", "planet-builder", "astro-tycoon", "galaxy-farm"]),
    puzzle: new Set(["cipher-run", "quiz-arena", "space-chess", "nebula-puzzle", "cosmic-card-battle", "dungeon-stars"]),
    simulation: new Set(["creative-sandbox", "space-fishing", "alien-pet", "survival-orbit"])
  };
  const GAME_RULES = {
    "neon-drift": { goal: 620, time: 85, objective: "Ne cong plasma va dat du diem truoc khi het gio.", tutorial: ["WASD hoac phim mui ten de lai.", "Nhat tinh the sang de tang combo.", "Va cham lam mat mang; het mang la thua."] },
    "galaxy-defense": { goal: 720, time: 100, objective: "Bao ve cong thien ha va tieu diet cac wave.", tutorial: ["Di chuyen bang WASD hoac phim mui ten.", "Space, cham canvas hoac nut Hanh dong de ban.", "De qua nhieu ke dich vuot cong se lam mat mang."] },
    "star-colony": { goal: 8, time: 120, objective: "Xay 8 module va giu nguon dien tren 0.", tutorial: ["Chon module de xay thuoc dia.", "Moi module tieu ton tai nguyen.", "Can bang dien, luong thuc va coin de chien thang."] },
    "cipher-run": { goal: 7, time: 90, objective: "Giai chuoi ma tang dan den cap 7.", tutorial: ["Ghi nho chuoi ky tu hien tai.", "Nhan cac nut theo dung thu tu.", "Sai ma se mat mot mang va xoa luot nhap."] },
    "asteroid-miner": { goal: 520, time: 75, objective: "Khai thac du quang hiem truoc khi het gio.", tutorial: ["Bam truc tiep len asteroid.", "Asteroid cung can nhieu lan khoan.", "Duy tri combo de nhan thuong cao hon."] },
    "rhythm-reactor": { goal: 680, time: 90, objective: "Giu nhip reactor va dat du diem.", tutorial: ["Bam Space khi not di qua vach vang.", "Perfect beat tang combo.", "Bo lo hoac lech nhip lam mat mang."] },
    "quiz-arena": { goal: 6, time: 100, objective: "Tra loi dung it nhat 6/8 cau.", tutorial: ["Doc cau hoi va chon mot dap an.", "Moi cau sai lam mat mot mang.", "Hoan thanh 8 cau de nhan ket qua."] },
    "creative-sandbox": { goal: 1, time: 0, objective: "Tao level co spawn, coin va goal, sau do chay thu.", tutorial: ["Chon vat the roi bam len canvas.", "Luu level truoc khi chay thu.", "Thu thap coin va den goal de hoan tat."] },
    "space-chess": { goal: 360, time: 120, objective: "Chiem cac o chien luoc va dat muc tieu diem.", tutorial: ["Chon quan co, sau do chon o dich.", "O trong la di chuyen, o co quan la chiem.", "Dat du diem truoc khi het gio."] },
    "survival-orbit": { goal: 70, time: 70, objective: "Song sot tren tram quy dao den het thoi gian.", tutorial: ["Di chuyen de tranh manh vo.", "Tinh the sang hoi nang luong va cho diem.", "Giu it nhat mot mang cho den khi cuu ho toi."] },
    "galaxy-farm": { goal: 8, time: 120, objective: "Trong va thu hoach 8 lo tinh van.", tutorial: ["Gieo hat va tuoi truoc khi thu hoach.", "Gene Lab tang hieu qua nhung ton nhieu tai nguyen.", "Thu hoach du 8 luot de thang."] },
    "space-fishing": { goal: 430, time: 100, objective: "Cau du sinh vat sao va duy tri nang luong.", tutorial: ["Moi lan tha cau tieu hao nang luong.", "Cho thanh nang luong hoi phuc khi can.", "Ca hiem cho nhieu diem hon."] },
    "mecha-arena": { goal: 760, time: 105, objective: "Ha mecha doi thu va bao toan giap.", tutorial: ["Di chuyen bang WASD hoac phim mui ten.", "Space de khai hoa.", "Ha nhieu mecha lien tiep de tang combo."] },
    "planet-builder": { goal: 8, time: 120, objective: "Hoan thien hanh tinh voi 8 thanh phan.", tutorial: ["Them loi, bien, rung va thanh pho.", "Moi thanh phan tieu hao tai nguyen.", "Xay du 8 thanh phan de kich hoat hanh tinh."] },
    "alien-pet": { goal: 125, time: 100, objective: "Tang tinh cam cho pet va tien hoa an toan.", tutorial: ["Cho an va choi de tang tinh cam.", "Huan luyen cho diem cao hon.", "Tien hoa khi tinh cam du cao."] },
    "dungeon-stars": { goal: 6, time: 120, objective: "Vuot qua 6 phong dungeon va con it nhat mot mang.", tutorial: ["Chon danh, phep, hoi mau hoac mo ruong.", "Moi phong co the xuat hien bay.", "Vuot 6 phong de thang."] },
    "cosmic-card-battle": { goal: 1, time: 120, objective: "Ha HP doi thu truoc khi ban het HP.", tutorial: ["Nova Strike gay sat thuong.", "Shield Bloom tang HP.", "Comet Draw tao luot tan cong can bang."] },
    "astro-tycoon": { goal: 9, time: 130, objective: "Xay 9 cong trinh va giu tram sinh loi.", tutorial: ["Cua hang va quang cao re hon.", "Khach san va ben tau cho tang truong cao.", "Dau tu dung thoi diem de khong can tai nguyen."] },
    "space-runner": { goal: 720, time: 90, objective: "Chay qua duong ham sao va dat du diem.", tutorial: ["Di chuyen bang WASD, phim mui ten hoac nut cam ung.", "Tranh vat can mau hong.", "Thu thap vat pham sang de tang combo."] },
    "black-hole-escape": { goal: 560, time: 75, objective: "Thoat khoi ho den va giu nang luong tren 0.", tutorial: ["Lien tuc di chuyen sang phai de thoat luc hut.", "Ne manh vo va nhat tinh the.", "Het nang luong la thua."] },
    "nebula-puzzle": { goal: 10, time: 120, objective: "Ghep 10 cap tinh van cung loai.", tutorial: ["Chon hai o co cung bieu tuong.", "Cap dung se bien thanh sao rong.", "Ghep du 10 cap de hoan tat ban do."] },
    "boss-rush": { goal: 1, time: 120, objective: "Ha boss truoc khi het mang hoac thoi gian.", tutorial: ["Di chuyen lien tuc de ne.", "Space de ban va phan cong.", "Thanh mau boss nam phia tren canvas."] }
  };

  const questions = [
    { q: "Hành tinh đỏ là?", a: "Sao Hỏa", choices: ["Sao Hỏa", "Sao Kim", "Sao Thủy"] },
    { q: "CSS dùng để?", a: "Tạo giao diện", choices: ["Tạo giao diện", "Nấu ăn", "Sạc pin"] },
    { q: "BPM trong nhạc là?", a: "Nhịp mỗi phút", choices: ["Nhịp mỗi phút", "Độ sáng", "Dung lượng"] },
    { q: "XP trong game thường dùng để?", a: "Tăng cấp", choices: ["Tăng cấp", "Xóa game", "Tắt màn hình"] }
  ];

  let hostNode = null;
  let root = null;
  let opts = {};
  let active = "neon-drift";
  let running = false;
  let paused = true;
  let raf = 0;
  let last = 0;
  let canvas = null;
  let ctx = null;
  let keys = new Set();
  let pointer = { x: 0, y: 0, down: false };
  let filter = "Tất cả";
  let query = "";
  let saveData = load();
  let gameState = {};
  let sessionStartedAt = 0;
  let replayFrames = [];
  let replay = { active: false, frames: [], index: 0, startedAt: 0 };
  let sandboxTool = "spawn";
  let runtimeError = null;
  let tutorialVisible = false;
  let settingsVisible = false;
  let gamepadButtons = new Set();
  let networkOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  let fpsSamples = [];
  let fpsValue = 60;
  let frameCounter = 0;
  let frameWindowStartedAt = 0;
  let checkpointAt = 0;
  let audioContext = null;
  let runtimeBridge = null;
  const onlineHandler = () => handleNetworkChange(true);
  const offlineHandler = () => handleNetworkChange(false);

  function engineFor(gameId = active) {
    if (ENGINE_GROUPS.action.has(gameId)) return "action";
    if (ENGINE_GROUPS.strategy.has(gameId)) return "strategy";
    if (ENGINE_GROUPS.puzzle.has(gameId)) return "puzzle";
    return "simulation";
  }

  function ruleFor(gameId = active) {
    return GAME_RULES[gameId] || { goal: 500, time: 90, objective: "Hoan thanh muc tieu cua game.", tutorial: ["Bat dau de choi.", "Tam dung khi can.", "Dat muc tieu truoc khi het luot."] };
  }

  function difficultyFor(id = saveData?.settings?.difficulty) {
    return DIFFICULTIES[id] || DIFFICULTIES.normal;
  }

  function targetFor(gameId = active) {
    return Math.max(1, Math.round((ruleFor(gameId).goal || 1) * difficultyFor().target));
  }

  function runtimeStatus() {
    const bridgeStatus = runtimeBridge && typeof runtimeBridge.inspect === "function" ? runtimeBridge.inspect() : null;
    return {
      schema: RUNTIME_SCHEMA,
      engine: engineFor(),
      phase: gameState.phase || "ready",
      outcome: gameState.outcome || null,
      difficulty: difficultyFor().id,
      target: targetFor(),
      fps: Math.round(fpsValue),
      quality: saveData.settings?.quality || "auto",
      online: networkOnline,
      saveMode: bridgeStatus?.cloud === true ? "cloud-confirmed" : "local-device",
      runtimeBridge: Boolean(runtimeBridge)
    };
  }

  function cleanText(value, max = 120) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cleanId(value, fallback = "") {
    return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64) || fallback;
  }

  function finite(value, min = 0, max = 999999999, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : fallback;
  }

  function createLevel(name = "Màn chơi mới") {
    return { schema: LEVEL_SCHEMA, id: `level-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: cleanText(name, 60) || "Màn chơi mới", width: 960, height: 540, objects: [], updatedAt: new Date().toISOString() };
  }

  function sanitizeLevel(level) {
    const allowed = new Set(["spawn", "goal", "platform", "hazard", "coin", "ship", "planet", "gate", "station"]);
    return {
      schema: LEVEL_SCHEMA,
      id: cleanId(level?.id, `level-${Date.now().toString(36)}`),
      name: cleanText(level?.name || "Màn chơi", 60),
      width: 960,
      height: 540,
      objects: (Array.isArray(level?.objects) ? level.objects : []).slice(0, 160).map((item) => ({ type: allowed.has(item?.type) ? item.type : "platform", x: finite(item?.x, 24, 936, 120), y: finite(item?.y, 24, 516, 220) })),
      updatedAt: cleanText(level?.updatedAt || new Date().toISOString(), 40)
    };
  }

  function sanitizeCheckpoint(value, gameId) {
    if (!value || typeof value !== "object") return null;
    const modeData = value.modeData && typeof value.modeData === "object" ? value.modeData : {};
    return {
      schema: RUNTIME_SCHEMA,
      gameId,
      savedAt: finite(value.savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      difficulty: DIFFICULTIES[value.difficulty] ? value.difficulty : "normal",
      score: finite(value.score, 0),
      combo: finite(value.combo, 1, 12, 1),
      level: finite(value.level, 1, 9999, 1),
      lives: finite(value.lives, 0, 99, 3),
      energy: finite(value.energy, 0, 150, 100),
      timer: finite(value.timer, 0, 60 * 60, 0),
      player: { x: finite(value.player?.x, 0, 960, 120), y: finite(value.player?.y, 0, 540, 230), vx: 0, vy: 0, r: 16 },
      resources: {
        ore: finite(value.resources?.ore, 0, 99999, 60),
        food: finite(value.resources?.food, 0, 99999, 40),
        power: finite(value.resources?.power, 0, 99999, 70),
        coins: finite(value.resources?.coins, 0, 99999, 80),
        love: finite(value.resources?.love, 0, 150, 45)
      },
      slots: (Array.isArray(value.slots) ? value.slots : []).slice(0, 160).map((item) => typeof item === "object" ? { ...item } : cleanText(item, 24)),
      modeData: JSON.parse(JSON.stringify(modeData))
    };
  }

  function normalizeSave(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    const levelList = Array.isArray(data.sandbox?.levels) ? data.sandbox.levels.map(sanitizeLevel).slice(0, 24) : [];
    if (!levelList.length) levelList.push(createLevel("Creator Starter"));
    const next = {
      schema: SCHEMA,
      version: 3,
      totalXp: finite(data.totalXp, 0),
      settings: {
        difficulty: DIFFICULTIES[data.settings?.difficulty] ? data.settings.difficulty : "normal",
        volume: finite(data.settings?.volume, 0, 1, 0.55),
        muted: Boolean(data.settings?.muted),
        reducedEffects: Boolean(data.settings?.reducedEffects),
        quality: ["auto", "low", "medium", "high"].includes(data.settings?.quality) ? data.settings.quality : "auto"
      },
      tutorials: Object.fromEntries(games.map((item) => [item.id, Boolean(data.tutorials?.[item.id])])),
      achievements: (Array.isArray(data.achievements) ? data.achievements : []).map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 120),
      checkpoints: Object.fromEntries(games.map((item) => [item.id, sanitizeCheckpoint(data.checkpoints?.[item.id], item.id)]).filter(([, value]) => value)),
      history: (Array.isArray(data.history) ? data.history : []).slice(0, 80).map((item) => ({
        gameId: games.some((gameItem) => gameItem.id === item?.gameId) ? item.gameId : games[0].id,
        score: finite(item?.score, 0),
        outcome: ["win", "loss", "quit"].includes(item?.outcome) ? item.outcome : "quit",
        difficulty: DIFFICULTIES[item?.difficulty] ? item.difficulty : "normal",
        duration: finite(item?.duration, 0, 60 * 60, 0),
        at: finite(item?.at, 0, Number.MAX_SAFE_INTEGER, 0)
      })),
      missions: {
        day: cleanText(data.missions?.day, 16) || new Date().toISOString().slice(0, 10),
        dailyPlays: finite(data.missions?.dailyPlays, 0, 9999, 0),
        dailyWins: finite(data.missions?.dailyWins, 0, 9999, 0),
        weeklyScore: finite(data.missions?.weeklyScore, 0, 99999999, 0)
      },
      favorites: (Array.isArray(data.favorites) ? data.favorites : []).map((id) => cleanId(id)).filter((id) => games.some((item) => item.id === id)).slice(0, games.length),
      recent: (Array.isArray(data.recent) ? data.recent : []).map((id) => cleanId(id)).filter((id) => games.some((item) => item.id === id)).slice(0, 8),
      sandbox: { schema: LEVEL_SCHEMA, activeLevelId: cleanId(data.sandbox?.activeLevelId, levelList[0].id), levels: levelList },
      replays: (Array.isArray(data.replays) ? data.replays : []).filter((item) => item?.schema === REPLAY_SCHEMA).slice(0, 5).map((item) => ({
        schema: REPLAY_SCHEMA,
        id: cleanId(item.id, `replay-${Date.now().toString(36)}`),
        gameId: games.some((gameItem) => gameItem.id === item.gameId) ? item.gameId : games[0].id,
        gameTitle: cleanText(item.gameTitle, 80),
        score: finite(item.score, 0),
        duration: finite(item.duration, 0, 1440, 0),
        createdAt: cleanText(item.createdAt, 40),
        frames: (Array.isArray(item.frames) ? item.frames : []).slice(0, 180).map((frame) => ({ at: finite(frame.at, 0, 60 * 60 * 1000, 0), score: finite(frame.score, 0), combo: finite(frame.combo, 1, 12, 1), level: finite(frame.level, 1, 9999, 1), lives: finite(frame.lives, 0, 99, 0), energy: finite(frame.energy, 0, 100, 0), player: { x: finite(frame.player?.x, 0, 960, 120), y: finite(frame.player?.y, 0, 540, 230) } }))
      }))
    };
    games.forEach((item) => {
      const record = data[item.id];
      if (!record || typeof record !== "object") return;
      next[item.id] = {
        high: finite(record.high, 0),
        level: finite(record.level, 1, 9999, 1),
        plays: finite(record.plays, 0, 100000, 0),
        wins: finite(record.wins, 0, 100000, 0),
        coins: finite(record.coins, 0, 99999999, 0),
        last: finite(record.last, 0, Number.MAX_SAFE_INTEGER, 0)
      };
    });
    return next;
  }

  function load() {
    try {
      return normalizeSave(JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(LEGACY_STORE) || "{}"));
    } catch (_) {
      return normalizeSave({});
    }
  }

  function persist() {
    try {
      saveData.schema = SCHEMA;
      saveData.version = 3;
      localStorage.setItem(STORE, JSON.stringify(normalizeSave(saveData)));
    } catch (_) {
      /* Local save can be unavailable in embedded privacy contexts. */
    }
  }

  function ensureMissionWindow() {
    const today = new Date().toISOString().slice(0, 10);
    if (saveData.missions?.day === today) return;
    saveData.missions = { day: today, dailyPlays: 0, dailyWins: 0, weeklyScore: saveData.missions?.weeklyScore || 0 };
    persist();
  }

  function createRuntimeBridge() {
    const external = window.HHGameRuntime;
    if (!external) return null;
    try {
      if (typeof external.create === "function") {
        return external.create({
          id: "arcade-galaxy",
          namespace: "arcade",
          schema: RUNTIME_SCHEMA,
          games: games.map((item) => item.id),
          getState: () => createCheckpoint(),
          autosaveSlot: "slot-1"
        }) || null;
      }
      if (typeof external.mount === "function") {
        return external.mount({ namespace: "arcade", schema: RUNTIME_SCHEMA }) || external;
      }
      return typeof external.inspect === "function" ? external : null;
    } catch (error) {
      runtimeError = { code: "runtime-bridge", message: cleanText(error?.message || "HHGameRuntime unavailable.", 160), at: Date.now() };
      return null;
    }
  }

  function callRuntimeBridge(method, payload = {}) {
    if (!runtimeBridge || typeof runtimeBridge[method] !== "function") return false;
    try {
      runtimeBridge[method]({ gameId: active, ...payload });
      return true;
    } catch (error) {
      runtimeError = { code: `bridge-${method}`, message: cleanText(error?.message || "Runtime bridge error.", 160), at: Date.now() };
      return false;
    }
  }

  function safeClone(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function game() {
    return games.find((item) => item.id === active) || games[0];
  }

  function activeLevel() {
    const levels = saveData.sandbox?.levels || [];
    return levels.find((item) => item.id === saveData.sandbox.activeLevelId) || levels[0];
  }

  function recordRecent(id) {
    saveData.recent = [id, ...(saveData.recent || []).filter((item) => item !== id)].slice(0, 8);
    persist();
  }

  function toggleFavorite(id) {
    const list = new Set(saveData.favorites || []);
    if (list.has(id)) list.delete(id);
    else list.add(id);
    saveData.favorites = Array.from(list);
    persist();
    render();
  }

  function ensureAudioContext() {
    if (saveData.settings?.muted || (saveData.settings?.volume || 0) <= 0) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      audioContext ||= new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    } catch (_) {
      return null;
    }
  }

  function playTone(kind = "action") {
    const audio = ensureAudioContext();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const frequencies = { action: 420, reward: 720, win: 880, loss: 180, error: 140 };
    oscillator.frequency.value = frequencies[kind] || frequencies.action;
    oscillator.type = kind === "loss" || kind === "error" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(Math.max(0.001, (saveData.settings?.volume || 0.55) * 0.08), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.13);
  }

  function createCheckpoint() {
    return sanitizeCheckpoint({
      schema: RUNTIME_SCHEMA,
      gameId: active,
      savedAt: Date.now(),
      difficulty: difficultyFor().id,
      score: gameState.score,
      combo: gameState.combo,
      level: gameState.level,
      lives: gameState.lives,
      energy: gameState.energy,
      timer: gameState.timer,
      player: gameState.player,
      resources: gameState.resources,
      slots: gameState.slots,
      modeData: gameState.modeData
    }, active);
  }

  function saveCheckpoint(force = false) {
    if (!sessionStartedAt || replay.active || gameState.phase === "result") return false;
    const now = Date.now();
    if (!force && now - checkpointAt < 5000) return false;
    checkpointAt = now;
    saveData.checkpoints[active] = createCheckpoint();
    persist();
    callRuntimeBridge("save", { slot: "main", checkpoint: saveData.checkpoints[active] });
    return true;
  }

  function canContinue(gameId = active) {
    return Boolean(saveData.checkpoints?.[gameId]);
  }

  function applyCheckpoint(checkpoint) {
    const saved = sanitizeCheckpoint(checkpoint, active);
    if (!saved) return false;
    saveData.settings.difficulty = saved.difficulty;
    gameState.score = saved.score;
    gameState.combo = saved.combo;
    gameState.level = saved.level;
    gameState.lives = saved.lives;
    gameState.energy = saved.energy;
    gameState.timer = saved.timer;
    gameState.player = { ...gameState.player, ...saved.player };
    gameState.resources = { ...gameState.resources, ...saved.resources };
    gameState.slots = safeClone(saved.slots, []);
    gameState.modeData = { ...gameState.modeData, ...safeClone(saved.modeData, {}) };
    gameState.phase = "paused";
    gameState.message = "Da khoi phuc checkpoint tren thiet bi.";
    sessionStartedAt = Date.now() - Math.round(saved.timer * 1000);
    return true;
  }

  function continueSavedGame() {
    stopLoop();
    resetGame();
    if (!applyCheckpoint(saveData.checkpoints?.[active])) {
      gameState.message = "Khong co checkpoint hop le de tiep tuc.";
      render();
      return;
    }
    tutorialVisible = false;
    render();
    resume();
  }

  function updateMissions(outcome, score) {
    ensureMissionWindow();
    saveData.missions.dailyPlays += 1;
    if (outcome === "win") saveData.missions.dailyWins += 1;
    saveData.missions.weeklyScore += Math.max(0, Math.round(score || 0));
  }

  function unlockAchievements(outcome) {
    const unlocked = [];
    const record = saveData[active] || {};
    if ((record.plays || 0) + 1 === 1) unlocked.push(`${active}:first-flight`);
    if (outcome === "win") unlocked.push(`${active}:first-win`);
    if ((gameState.combo || 1) >= 8) unlocked.push(`${active}:combo-8`);
    if ((gameState.lives || 0) >= difficultyFor().lives && outcome === "win") unlocked.push(`${active}:untouched`);
    unlocked.forEach((id) => {
      if (!saveData.achievements.includes(id)) saveData.achievements.push(id);
    });
    return unlocked;
  }

  function recordHistory(outcome) {
    const item = {
      gameId: active,
      score: Math.floor(gameState.score || 0),
      outcome,
      difficulty: difficultyFor().id,
      duration: Math.max(0, Math.round(gameState.timer || 0)),
      at: Date.now()
    };
    saveData.history = [item, ...(saveData.history || [])].slice(0, 80);
    window.dispatchEvent(new CustomEvent("hh:game-history", { detail: { source: "arcade", ...item } }));
  }

  function addScore(points, reason) {
    gameState.score = Math.max(0, Math.round((gameState.score || 0) + points));
    gameState.combo = points > 0 ? clamp((gameState.combo || 1) + 1, 1, 12) : 1;
    gameState.message = reason || gameState.message;
    if (points > 0) playTone(points >= 60 ? "reward" : "action");
  }

  function emitReward(xp, outcome = "win") {
    window.dispatchEvent(new CustomEvent("hh:game-reward", {
      detail: {
        source: "arcade",
        gameId: active,
        gameTitle: game().title,
        score: Math.floor(gameState.score || 0),
        xp: Math.floor(xp || 0),
        outcome,
        difficulty: difficultyFor().id,
        duration: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000))
      }
    }));
  }

  function captureReplayFrame(force = false) {
    if (!sessionStartedAt || replay.active) return;
    const at = Date.now() - sessionStartedAt;
    if (!force && replayFrames.length && at - replayFrames[replayFrames.length - 1].at < 500) return;
    replayFrames.push({
      at,
      score: Math.floor(gameState.score || 0),
      combo: finite(gameState.combo, 1, 12, 1),
      level: finite(gameState.level, 1, 9999, 1),
      lives: finite(gameState.lives, 0, 99, 0),
      energy: finite(gameState.energy, 0, 100, 0),
      player: { x: finite(gameState.player?.x, 0, 960, 120), y: finite(gameState.player?.y, 0, 540, 230) }
    });
    replayFrames = replayFrames.slice(-180);
  }

  function saveReplay() {
    captureReplayFrame(true);
    if (!replayFrames.length) return null;
    const item = {
      schema: REPLAY_SCHEMA,
      id: `replay-${Date.now().toString(36)}`,
      gameId: active,
      gameTitle: game().title,
      score: Math.floor(gameState.score || 0),
      duration: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000)),
      createdAt: new Date().toISOString(),
      frames: replayFrames.slice(0, 180)
    };
    saveData.replays = [item, ...(saveData.replays || []).filter((entry) => entry.gameId !== active)].slice(0, 5);
    window.dispatchEvent(new CustomEvent("hh:game-session", { detail: { ...item, frames: undefined } }));
    return item;
  }

  function legacyFinishRound(reason = "Đã lưu lượt chơi") {
    if (!sessionStartedAt || (gameState.score || 0) <= 0) {
      gameState.message = "Cần thực sự chơi và ghi điểm trước khi lưu kết quả.";
      renderStatus();
      return;
    }
    const id = active;
    const xp = Math.max(10, Math.round((gameState.score || 0) / 9) + (gameState.level || 1) * 4);
    running = false;
    paused = true;
    cancelAnimationFrame(raf);
    saveData[id] = {
      high: Math.max(saveData[id]?.high || 0, Math.floor(gameState.score || 0)),
      level: Math.max(saveData[id]?.level || 1, gameState.level || 1),
      plays: (saveData[id]?.plays || 0) + 1,
      last: Date.now()
    };
    saveData.totalXp = (saveData.totalXp || 0) + xp;
    saveReplay();
    recordRecent(id);
    persist();
    gameState.message = `${reason}. +${xp} XP`;
    emitReward(xp);
    render();
  }

  function finishRound(reason = "Đã lưu lượt chơi", outcome) {
    if (!sessionStartedAt) {
      gameState.message = "Cần bắt đầu lượt chơi trước khi lưu kết quả.";
      renderStatus();
      return;
    }
    const result = outcome || (/Thua|thua|hết|Hết|kết thúc/i.test(String(reason)) ? "loss" : "win");
    const id = active;
    const xp = Math.max(10, Math.round((gameState.score || 0) / 9) + (gameState.level || 1) * 4) * difficultyFor().reward;
    running = false;
    paused = true;
    gameState.phase = "result";
    gameState.outcome = result;
    gameState.resultReason = reason;
    cancelAnimationFrame(raf);
    saveData[id] = {
      high: Math.max(saveData[id]?.high || 0, Math.floor(gameState.score || 0)),
      level: Math.max(saveData[id]?.level || 1, gameState.level || 1),
      plays: (saveData[id]?.plays || 0) + 1,
      wins: (saveData[id]?.wins || 0) + (result === "win" ? 1 : 0),
      coins: (saveData[id]?.coins || 0) + Math.max(0, Math.round(xp)),
      last: Date.now()
    };
    saveData.totalXp = (saveData.totalXp || 0) + xp;
    updateMissions(result, gameState.score);
    const unlocked = unlockAchievements(result);
    recordHistory(result);
    saveReplay();
    recordRecent(id);
    delete saveData.checkpoints[active];
    persist();
    gameState.message = `${reason}. +${Math.round(xp)} XP`;
    if (unlocked.length) gameState.message += ` Achievement: ${unlocked.length}`;
    emitReward(xp, result);
    playTone(result === "win" ? "win" : "loss");
    callRuntimeBridge("complete", { outcome: result, score: gameState.score, xp });
    render();
  }

  function resetGame() {
    const g = game();
    const level = Math.max(1, saveData[g.id]?.level || 1);
    const difficulty = difficultyFor();
    gameState = {
      score: 0,
      combo: 1,
      level,
      lives: difficulty.lives,
      energy: 100,
      timer: 0,
      spawn: 0,
      message: "Sẵn sàng.",
      phase: "ready",
      outcome: null,
      resultReason: "",
      target: targetFor(g.id),
      timeLimit: ruleFor(g.id).time ? Math.round(ruleFor(g.id).time / difficulty.speed) : 0,
      performance: { fps: 60, quality: saveData.settings?.quality || "auto" },
      player: { x: 120, y: 230, vx: 0, vy: 0, r: 16 },
      objects: [],
      bullets: [],
      enemies: [],
      resources: { ore: 60, food: 40, power: 70, coins: 80, love: 45 },
      slots: [],
      selected: null,
      bossHp: 220 + level * 40,
      modeData: {}
    };
    replay = { active: false, frames: [], index: 0, startedAt: 0 };
    replayFrames = [];
    sessionStartedAt = 0;
    checkpointAt = 0;
    runtimeError = null;
    seedMode();
  }

  function seedMode() {
    const g = game();
    if (["runner", "escape", "survival"].includes(g.mode)) {
      gameState.objects = Array.from({ length: 14 }, (_, index) => hazard(index));
    }
    if (["shooter", "arena", "boss"].includes(g.mode)) {
      gameState.enemies = Array.from({ length: 5 }, (_, index) => enemy(index));
    }
    if (g.mode === "clicker") {
      gameState.objects = Array.from({ length: 12 }, (_, index) => asteroid(index));
    }
    if (g.mode === "rhythm") {
      gameState.objects = [];
      gameState.modeData.hitLine = 430;
    }
    if (g.mode === "match") {
      gameState.slots = Array.from({ length: 25 }, () => pick(["✦", "◆", "●", "▲"]));
    }
    if (g.mode === "board") {
      gameState.slots = ["HH", "", "DR", "", "AI", "", "SB", "", "", "", "", "", "★", "", "", "", "", "SB", "", "", "AI", "", "DR", "", "HH"];
    }
    if (g.mode === "card") {
      gameState.modeData.hand = ["Nova Strike", "Shield Bloom", "Comet Draw"];
      gameState.modeData.enemyHp = 160;
      gameState.modeData.playerHp = 130;
    }
    if (g.mode === "cipher") {
      gameState.modeData.sequence = Array.from({ length: 4 }, () => pick(["H", "A", "S", "T", "R", "13"]));
      gameState.modeData.input = [];
    }
    if (g.mode === "quiz") {
      gameState.modeData.question = 0;
      gameState.modeData.correct = 0;
    }
    if (["colony", "farm", "builder", "pet", "dungeon", "tycoon", "fishing", "sandbox"].includes(g.mode)) {
      gameState.slots = [];
    }
    if (g.mode === "sandbox") gameState.slots = (activeLevel()?.objects || []).map((item) => ({ ...item }));
  }

  function hazard(index) {
    return { x: 280 + index * 85 + rnd(0, 80), y: rnd(50, 430), r: rnd(10, 24), type: Math.random() > 0.68 ? "reward" : "hazard", vx: rnd(1.8, 4.5) };
  }

  function asteroid(index) {
    return { x: 90 + (index % 4) * 150, y: 90 + Math.floor(index / 4) * 100, r: rnd(18, 34), hp: 1 + Math.floor(Math.random() * 4), type: "ore" };
  }

  function enemy(index) {
    return { x: 680 + index * 60, y: rnd(70, 420), r: 15, hp: 2 + Math.floor(index / 2), vx: rnd(0.8, 2.4) };
  }

  function start() {
    if (replay.active) return;
    if (tutorialVisible) {
      renderStatus();
      return;
    }
    if (gameState.phase === "result") resetGame();
    if (!sessionStartedAt) {
      sessionStartedAt = Date.now();
      replayFrames = [];
      captureReplayFrame(true);
    }
    if (!running) last = performance.now();
    running = true;
    paused = false;
    gameState.phase = "playing";
    gameState.outcome = null;
    runtimeError = null;
    ensureAudioContext();
    callRuntimeBridge("start", { difficulty: difficultyFor().id });
    loop();
    renderStatus();
  }

  function pause() {
    if (!sessionStartedAt || gameState.phase === "ready" || gameState.phase === "tutorial" || gameState.phase === "result") return;
    paused = !paused;
    if (!paused) {
      last = performance.now();
      gameState.phase = "playing";
      callRuntimeBridge("resume");
      loop();
    } else {
      gameState.phase = "paused";
      saveCheckpoint(true);
      callRuntimeBridge("pause");
    }
    renderStatus();
    renderOverlay();
  }

  function resume() {
    if (gameState.phase === "result") {
      resetGame();
    }
    tutorialVisible = false;
    if (!sessionStartedAt) sessionStartedAt = Date.now();
    running = true;
    paused = false;
    gameState.phase = "playing";
    last = performance.now();
    callRuntimeBridge("resume");
    loop();
    renderStatus();
    renderOverlay();
  }

  function restart() {
    stopLoop();
    resetGame();
    tutorialVisible = false;
    render();
    start();
  }

  function stopLoop() {
    running = false;
    paused = true;
    replay.active = false;
    cancelAnimationFrame(raf);
    if (gameState.phase === "playing") gameState.phase = "paused";
  }

  function loop(time = performance.now()) {
    if (!running || paused) return;
    const dt = clamp((time - last) / 1000, 0, 0.04);
    last = time;
    try {
      pollGamepad();
      update(dt);
      saveCheckpoint();
      captureReplayFrame();
      draw();
      updatePerformance(dt);
      renderStatus();
    } catch (error) {
      runtimeError = { code: "runtime-loop", message: cleanText(error?.message || "Game runtime error.", 180), at: Date.now() };
      stopLoop();
      gameState.phase = "error";
      gameState.message = "Runtime gap. Retry to continue this game.";
      playTone("error");
      render();
      return;
    }
    if (!running || paused) return;
    raf = requestAnimationFrame(loop);
  }

  function pollGamepad() {
    if (!navigator.getGamepads) return;
    const pad = Array.from(navigator.getGamepads()).find(Boolean);
    if (!pad) return;
    const nextKeys = new Set();
    if (Math.abs(pad.axes?.[0] || 0) > 0.35) nextKeys.add((pad.axes[0] > 0 ? "ArrowRight" : "ArrowLeft"));
    if (Math.abs(pad.axes?.[1] || 0) > 0.35) nextKeys.add((pad.axes[1] > 0 ? "ArrowDown" : "ArrowUp"));
    if (pad.buttons?.[0]?.pressed) nextKeys.add(" ");
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].forEach((key) => {
      if (nextKeys.has(key)) keys.add(key);
      else if (gamepadButtons.has(key)) keys.delete(key);
    });
    gamepadButtons = nextKeys;
  }

  function updatePerformance(dt) {
    const currentFps = dt > 0 ? 1 / dt : 60;
    fpsSamples.push(currentFps);
    fpsSamples = fpsSamples.slice(-30);
    fpsValue = fpsSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, fpsSamples.length);
    gameState.performance.fps = Math.round(fpsValue);
    if (saveData.settings.quality === "auto") {
      gameState.performance.quality = fpsValue < 38 ? "low" : fpsValue < 52 ? "medium" : "high";
    } else {
      gameState.performance.quality = saveData.settings.quality;
    }
    if (frameWindowStartedAt === 0) frameWindowStartedAt = Date.now();
    frameCounter += 1;
    if (Date.now() - frameWindowStartedAt > 1000) {
      frameWindowStartedAt = Date.now();
      frameCounter = 0;
    }
  }

  function latestReplay(gameId = active) {
    return (saveData.replays || []).find((item) => item.gameId === gameId && Array.isArray(item.frames) && item.frames.length);
  }

  function startLocalReplay() {
    const item = latestReplay();
    if (!item) return;
    stopLoop();
    replay = { active: true, frames: item.frames, index: 0, startedAt: performance.now() };
    paused = false;
    gameState.message = "Đang xem replay local · không phải spectator realtime.";
    raf = requestAnimationFrame(replayLoop);
    renderStatus();
  }

  function replayLoop(time) {
    if (!replay.active) return;
    const elapsed = time - replay.startedAt;
    while (replay.index + 1 < replay.frames.length && replay.frames[replay.index + 1].at <= elapsed) replay.index += 1;
    const frame = replay.frames[replay.index];
    if (frame) {
      gameState.score = finite(frame.score, 0);
      gameState.combo = finite(frame.combo, 1, 12, 1);
      gameState.level = finite(frame.level, 1, 9999, 1);
      gameState.lives = finite(frame.lives, 0, 99, 0);
      gameState.energy = finite(frame.energy, 0, 100, 0);
      gameState.player = { ...gameState.player, x: finite(frame.player?.x, 0, 960, 120), y: finite(frame.player?.y, 0, 540, 230) };
      draw();
      renderStatus();
    }
    if (replay.index >= replay.frames.length - 1) {
      replay.active = false;
      paused = true;
      gameState.message = "Replay local đã kết thúc.";
      renderStatus();
      return;
    }
    raf = requestAnimationFrame(replayLoop);
  }

  function update(dt) {
    gameState.timer += dt;
    const g = game();
    if (["runner", "escape", "survival"].includes(g.mode)) updateRunner(dt, g.mode);
    else if (["shooter", "arena", "boss"].includes(g.mode)) updateShooter(dt, g.mode);
    else if (g.mode === "rhythm") updateRhythm(dt);
    else if (g.mode === "clicker") gameState.score += dt * 2;
    else if (g.mode === "sandbox") updateSandbox(dt);
    else if (["colony", "farm", "builder", "pet", "tycoon", "fishing"].includes(g.mode)) updateSim(dt, g.mode);
    if (gameState.timer > 12 + gameState.level * 3) gameState.level += 1;
    if (gameState.lives <= 0 || gameState.energy <= 0) {
      finishRound("Lượt chơi kết thúc", "loss");
      return;
    }
    if (gameState.timeLimit && gameState.timer >= gameState.timeLimit) {
      finishRound(gameState.score >= gameState.target ? "Hoàn thành mục tiêu" : "Hết thời gian", gameState.score >= gameState.target ? "win" : "loss");
      return;
    }
    checkObjectives();
  }

  function checkObjectives() {
    if (gameState.phase !== "playing") return;
    const mode = game().mode;
    const target = gameState.target || targetFor();
    if (mode === "cipher" && (gameState.modeData.sequence?.length || 0) >= target) finishRound("Giải mã thành công", "win");
    else if (mode === "quiz" && gameState.modeData.question >= 8) finishRound(gameState.modeData.correct >= target ? "Quiz Arena hoàn thành" : "Quiz Arena chưa đạt", gameState.modeData.correct >= target ? "win" : "loss");
    else if (mode === "match" && gameState.slots.length && gameState.slots.every((slot) => slot === "☆")) finishRound("Ghép tinh vân thành công", "win");
    else if (mode === "board" && gameState.score >= target) finishRound("Chiếm ô chiến lược thành công", "win");
    else if (mode === "card" && gameState.modeData.enemyHp <= 0) finishRound("Thắng trận thẻ bài", "win");
    else if (mode === "pet" && gameState.resources.love >= target) finishRound("Pet tiến hóa", "win");
    else if (mode === "dungeon" && gameState.slots.length >= target) finishRound("Vượt dungeon thành công", "win");
    else if (mode === "sandbox" && gameState.slots.some((item) => item.type === "goal") && gameState.score >= target) finishRound("Hoàn tất level Creator Sandbox", "win");
    else if (["colony", "farm", "builder", "tycoon"].includes(mode) && gameState.slots.length >= target) finishRound("Hoàn thành mục tiêu mô phỏng", "win");
    else if (mode === "fishing" && gameState.score >= target) finishRound("Hoàn thành chuyến câu", "win");
    else if (["clicker", "runner", "escape", "survival", "rhythm", "shooter", "arena", "boss"].includes(mode) && gameState.score >= target) finishRound("Đạt mục tiêu game", "win");
  }

  function updateRunner(dt, mode) {
    const p = gameState.player;
    const speed = (mode === "escape" ? 250 : 310) * difficultyFor().speed;
    movePlayer(dt, speed);
    if (mode === "escape") {
      p.x -= (60 + gameState.level * 12) * dt;
      gameState.energy -= dt * 2.5;
    }
    gameState.objects.forEach((obj) => {
      obj.x -= (120 + gameState.level * 22) * dt * obj.vx * 0.55;
      if (obj.x < -40) Object.assign(obj, hazard(0), { x: 940 + rnd(0, 180) });
      if (Math.hypot(obj.x - p.x, obj.y - p.y) < obj.r + p.r) {
        if (obj.type === "reward") addScore(38 * gameState.combo, "Nhặt tinh thể.");
        else {
          gameState.lives -= 1;
          addScore(-20, "Va chạm.");
        }
        Object.assign(obj, hazard(0), { x: 940 + rnd(0, 180) });
      }
    });
    gameState.score += dt * (mode === "escape" ? 11 : 8);
  }

  function updateShooter(dt, mode) {
    const p = gameState.player;
    movePlayer(dt, (mode === "arena" ? 240 : 210) * difficultyFor().speed);
    if (keys.has(" ") || keys.has("Spacebar")) {
      keys.delete(" ");
      gameState.bullets.push({ x: p.x + 16, y: p.y, vx: 520, r: 4 });
    }
    gameState.bullets.forEach((bullet) => bullet.x += bullet.vx * dt);
    gameState.enemies.forEach((mob) => {
      mob.x -= (60 + gameState.level * 9) * dt * mob.vx;
      mob.y += Math.sin(gameState.timer * 3 + mob.x * 0.01) * dt * 40;
      if (mob.x < -20) {
        mob.x = 940 + rnd(0, 140);
        mob.y = rnd(60, 430);
        gameState.lives -= 1;
      }
      gameState.bullets.forEach((bullet) => {
        if (!bullet.dead && Math.hypot(bullet.x - mob.x, bullet.y - mob.y) < bullet.r + mob.r) {
          bullet.dead = true;
          mob.hp -= mode === "boss" ? 1 : 2;
          addScore(18, "Bắn trúng.");
          if (mode === "boss") gameState.bossHp -= 16;
        }
      });
      if (Math.hypot(mob.x - p.x, mob.y - p.y) < mob.r + p.r) {
        gameState.lives -= 1;
        mob.x = 930;
      }
    });
    gameState.bullets = gameState.bullets.filter((bullet) => !bullet.dead && bullet.x < 980);
    gameState.enemies = gameState.enemies.filter((mob) => {
      if (mob.hp > 0) return true;
      addScore(mode === "boss" ? 45 : 32, "Hạ mục tiêu.");
      return false;
    });
    while (gameState.enemies.length < (mode === "boss" ? 6 : 5 + gameState.level)) gameState.enemies.push(enemy(gameState.enemies.length));
    if (mode === "boss" && gameState.bossHp <= 0) finishRound("Đã hạ boss");
  }

  function updateRhythm(dt) {
    gameState.spawn -= dt;
    if (gameState.spawn <= 0) {
      gameState.spawn = rnd(0.45, 0.82);
      gameState.objects.push({ x: rnd(80, 860), y: -20, r: 16, vy: (160 + gameState.level * 12) * difficultyFor().speed });
    }
    gameState.objects.forEach((note) => note.y += note.vy * dt);
    if (keys.has(" ") || keys.has("Spacebar")) {
      keys.delete(" ");
      const target = gameState.objects.find((note) => Math.abs(note.y - gameState.modeData.hitLine) < 34);
      if (target) {
        target.dead = true;
        addScore(35 * gameState.combo, "Perfect beat.");
      } else {
        gameState.lives -= 1;
        addScore(-8, "Lệch nhịp.");
      }
    }
    gameState.objects = gameState.objects.filter((note) => {
      if (note.dead) return false;
      if (note.y > 500) {
        gameState.lives -= 1;
        return false;
      }
      return true;
    });
  }

  function updateSim(dt, mode) {
    const r = gameState.resources;
    if (mode === "pet") {
      r.love = clamp(r.love - dt * 0.8, 0, 150);
      gameState.score += dt * Math.max(1, r.love / 18);
    } else if (mode === "fishing") {
      gameState.energy = clamp(gameState.energy + dt * 2, 0, 120);
      gameState.score += dt * 3;
    } else {
      r.coins = clamp(r.coins + dt * (2 + gameState.slots.length), 0, 9999);
      r.power = clamp(r.power - dt * 0.8 + gameState.slots.length * dt * 0.2, 0, 180);
      gameState.score += dt * (3 + gameState.slots.length);
    }
  }

  function movePlayer(dt, speed) {
    const p = gameState.player;
    const x = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    const y = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    p.vx = (p.vx + x * speed * dt) * 0.86;
    p.vy = (p.vy + y * speed * dt) * 0.86;
    p.x = clamp(p.x + p.vx, 24, 930);
    p.y = clamp(p.y + p.vy, 30, 500);
  }

  function panelAction(action, value) {
    if (replay.active) return;
    if (tutorialVisible) return;
    if (game().mode !== "sandbox" && gameState.phase !== "playing") {
      gameState.message = "Bam Choi de bat dau luot choi.";
      renderStatus();
      renderOverlay();
      return;
    }
    if (!sessionStartedAt) {
      sessionStartedAt = Date.now();
      replayFrames = [];
      captureReplayFrame(true);
    }
    playTone("action");
    const mode = game().mode;
    if (mode === "colony") buildResource(value, { solar: 25, mine: 35, farm: 30, shield: 50 }, "Xây module thuộc địa");
    else if (mode === "farm") buildResource(value, { seed: 18, water: 12, harvest: 0, lab: 44 }, "Nông trại thiên hà");
    else if (mode === "builder") buildResource(value, { core: 20, ocean: 24, forest: 24, city: 42 }, "Đã ghép hành tinh");
    else if (mode === "pet") petAction(value);
    else if (mode === "dungeon") dungeonAction(value);
    else if (mode === "tycoon") buildResource(value, { shop: 35, hotel: 75, dock: 95, ad: 20 }, "Đầu tư trạm");
    else if (mode === "fishing") fishingAction(value);
    else if (mode === "cipher") cipherAction(value);
    else if (mode === "quiz") quizAction(Number(value));
    else if (mode === "match") matchAction(Number(value));
    else if (mode === "board") boardAction(Number(value));
    else if (mode === "card") cardAction(value || action);
    else if (mode === "sandbox") sandboxAction(value || action);
    renderPlayfield();
    renderStatus();
    draw();
  }

  function buildResource(action, costs, message) {
    const cost = costs[action] ?? 20;
    if (action === "harvest") {
      addScore(70 + gameState.slots.length * 8, "Thu hoạch sao.");
      gameState.resources.food += 24;
      return;
    }
    if ((gameState.resources.coins || 0) < cost && (gameState.resources.ore || 0) < cost) {
      gameState.message = "Chưa đủ tài nguyên.";
      return;
    }
    if (gameState.resources.coins >= cost) gameState.resources.coins -= cost;
    else gameState.resources.ore -= cost;
    gameState.slots.push({ action, at: Date.now() });
    addScore(cost * 2, message);
  }

  function petAction(action) {
    const gain = { feed: 18, play: 25, train: 35, evolve: 80 }[action] || 12;
    gameState.resources.love = clamp(gameState.resources.love + gain, 0, 150);
    addScore(gain * 2, action === "evolve" ? "Pet tiến hóa." : "Pet vui hơn.");
  }

  function dungeonAction(action) {
    const roll = Math.random();
    if (roll > 0.25) {
      addScore({ slash: 42, magic: 56, loot: 70, heal: 28 }[action] || 35, "Qua phòng dungeon.");
      gameState.slots.push(action);
    } else {
      gameState.lives -= 1;
      addScore(-12, "Bẫy sao.");
    }
  }

  function fishingAction(action) {
    if (gameState.energy < 12) {
      gameState.message = "Cần hồi năng lượng.";
      return;
    }
    gameState.energy -= 12;
    const rare = Math.random() > 0.7;
    addScore(rare ? 120 : 38, rare ? "Câu được cá lượng tử hiếm." : "Câu được cá sao.");
  }

  function cipherAction(value) {
    const data = gameState.modeData;
    data.input.push(value);
    const index = data.input.length - 1;
    if (data.sequence[index] !== value) {
      gameState.lives -= 1;
      data.input = [];
      addScore(-10, "Sai mã.");
    } else if (data.input.length === data.sequence.length) {
      addScore(90 + data.sequence.length * 8, "Mở khóa thành công.");
      data.sequence.push(pick(["H", "A", "S", "T", "R", "13"]));
      data.input = [];
    }
  }

  function quizAction(index) {
    const data = gameState.modeData;
    const q = questions[data.question % questions.length];
    if (q.choices[index] === q.a) {
      data.correct += 1;
      addScore(80, "Đúng.");
    } else {
      gameState.lives -= 1;
      addScore(-10, "Sai.");
    }
    data.question += 1;
    if (data.question >= 8) finishRound(data.correct >= targetFor() ? "Hoàn thành Quiz Arena" : "Quiz Arena chưa đạt mục tiêu", data.correct >= targetFor() ? "win" : "loss");
  }

  function matchAction(index) {
    if (gameState.selected === null) {
      gameState.selected = index;
      return;
    }
    const a = gameState.selected;
    const b = index;
    if (a !== b && gameState.slots[a] === gameState.slots[b]) {
      gameState.slots[a] = "☆";
      gameState.slots[b] = "☆";
      addScore(65, "Ghép tinh vân.");
    } else {
      addScore(-5, "Chưa khớp.");
    }
    gameState.selected = null;
  }

  function boardAction(index) {
    if (gameState.selected === null && gameState.slots[index]) {
      gameState.selected = index;
      return;
    }
    if (gameState.selected !== null) {
      const from = gameState.selected;
      if (!gameState.slots[index]) {
        gameState.slots[index] = gameState.slots[from];
        gameState.slots[from] = "";
        addScore(22, "Di chuyển chiến thuật.");
      } else if (from !== index) {
        gameState.slots[index] = gameState.slots[from];
        gameState.slots[from] = "";
        addScore(85, "Chiếm ô.");
      }
      gameState.selected = null;
    }
  }

  function cardAction(action) {
    const data = gameState.modeData;
    const damage = { strike: 38, shield: 12, draw: 22 }[action] || 24;
    if (action === "shield") data.playerHp += 25;
    else data.enemyHp -= damage;
    data.playerHp -= Math.max(5, 20 - gameState.combo);
    addScore(damage * 2, "Lượt bài vũ trụ.");
    if (data.enemyHp <= 0) finishRound("Thắng trận thẻ bài");
    if (data.playerHp <= 0) {
      gameState.lives = 0;
      finishRound("Thua trận thẻ bài");
    }
  }

  function sandboxAction(action) {
    const index = gameState.slots.length;
    placeSandboxObject(action, 100 + (index % 7) * 110, 100 + Math.floor(index / 7) * 90);
  }

  function updateSandbox(dt) {
    const player = gameState.player;
    const speed = 150 * dt;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) player.x -= speed;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) player.x += speed;
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) player.y -= speed;
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) player.y += speed;
    player.x = clamp(player.x, 18, 942);
    player.y = clamp(player.y, 18, 522);
    gameState.slots.forEach((item) => {
      if (Math.hypot(item.x - player.x, item.y - player.y) > 28) return;
      if (item.type === "coin") {
        item.type = "collected";
        addScore(50, "Đã nhặt coin trong level.");
      } else if (item.type === "hazard") {
        gameState.lives = Math.max(0, gameState.lives - 1);
        player.x = 120;
        player.y = 230;
      } else if (item.type === "goal" && gameState.score > 0) finishRound("Hoàn tất level Creator Sandbox");
    });
    gameState.slots = gameState.slots.filter((item) => item.type !== "collected");
  }

  function placeSandboxObject(type, x, y) {
    if (replay.active || running || game().mode !== "sandbox" || gameState.slots.length >= 160) return;
    const allowed = new Set(["spawn", "goal", "platform", "hazard", "coin", "ship", "planet", "gate", "station"]);
    const safeType = allowed.has(type) ? type : "platform";
    gameState.slots.push({ type: safeType, x: finite(x, 24, 936, 120), y: finite(y, 24, 516, 220) });
    gameState.message = `Đã đặt ${safeType}. Lưu level để giữ thay đổi.`;
    draw();
    renderStatus();
  }

  function saveActiveLevel() {
    const level = activeLevel();
    if (!level) return;
    const nameInput = root?.querySelector("[data-ag-level-name]");
    level.name = cleanText(nameInput?.value || level.name, 60) || "Màn chơi";
    level.objects = gameState.slots.map((item) => ({ type: item.type, x: finite(item.x, 24, 936, 120), y: finite(item.y, 24, 516, 220) })).slice(0, 160);
    level.updatedAt = new Date().toISOString();
    persist();
    gameState.message = `Đã lưu ${level.name} trên thiết bị.`;
    renderStatus();
  }

  function createNewLevel() {
    const level = createLevel(`Màn chơi ${(saveData.sandbox.levels || []).length + 1}`);
    saveData.sandbox.levels = [level, ...(saveData.sandbox.levels || [])].slice(0, 24);
    saveData.sandbox.activeLevelId = level.id;
    gameState.slots = [];
    persist();
    render();
  }

  function clearActiveLevel() {
    gameState.slots = [];
    gameState.message = "Đã dọn canvas; bấm Lưu level để xác nhận.";
    draw();
    renderStatus();
  }

  function testActiveLevel() {
    saveActiveLevel();
    gameState.score = 0;
    gameState.player = { ...gameState.player, x: gameState.slots.find((item) => item.type === "spawn")?.x || 120, y: gameState.slots.find((item) => item.type === "spawn")?.y || 230 };
    gameState.message = "Đang test level local. Phím mũi tên để di chuyển.";
    start();
  }

  function exportActiveLevel() {
    saveActiveLevel();
    const level = sanitizeLevel(activeLevel());
    const blob = new Blob([JSON.stringify(level, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${cleanId(level.name, "hh-level")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function draw() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width || 960;
    const h = rect.height || 540;
    drawBackground(w, h);
    const mode = game().mode;
    if (["runner", "escape", "survival"].includes(mode)) drawRunner(w, h, mode);
    else if (["shooter", "arena", "boss"].includes(mode)) drawShooter(w, h, mode);
    else if (mode === "clicker") drawClicker();
    else if (mode === "rhythm") drawRhythm(w, h);
    else if (["sandbox", "builder"].includes(mode)) drawSandbox();
    else drawPanelPreview(w, h);
    drawHud();
  }

  function drawBackground(w, h) {
    const g = ctx.createRadialGradient(w * 0.48, h * 0.42, 10, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, "rgba(103,242,255,.16)");
    g.addColorStop(0.42, "rgba(255,99,201,.08)");
    g.addColorStop(1, "rgba(4,7,14,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const t = gameState.timer || 0;
    const quality = gameState.performance?.quality || "high";
    const starCount = quality === "low" || saveData.settings?.reducedEffects ? 28 : quality === "medium" ? 52 : 80;
    for (let i = 0; i < starCount; i += 1) {
      ctx.globalAlpha = 0.18 + (i % 5) * 0.08;
      ctx.fillStyle = i % 7 ? "#67f2ff" : "#ff63c9";
      ctx.fillRect((i * 97 + t * 28 * (i % 3 + 1)) % w, (i * 43) % h, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawRunner(w) {
    const p = gameState.player;
    gameState.objects.forEach((obj) => drawCircle(obj.x, obj.y, obj.r, obj.type === "reward" ? "#ffe66f" : "#ff63c9"));
    drawShip(p.x, p.y, game().color);
    if (game().mode === "escape") {
      ctx.strokeStyle = "rgba(181,140,255,.7)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(8, p.y, 85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#b58cff";
      ctx.fillText("Hố đen", 26, 44);
    }
    if (p.x < 30) p.x = w - 80;
  }

  function drawShooter() {
    gameState.enemies.forEach((mob) => drawCircle(mob.x, mob.y, mob.r, game().mode === "boss" ? "#ff4f5e" : "#ff8b5d"));
    gameState.bullets.forEach((bullet) => drawCircle(bullet.x, bullet.y, bullet.r, "#ffe66f"));
    drawShip(gameState.player.x, gameState.player.y, "#67f2ff");
    if (game().mode === "boss") {
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(320, 28, 300, 10);
      ctx.fillStyle = "#ff4f5e";
      ctx.fillRect(320, 28, clamp(gameState.bossHp / 340, 0, 1) * 300, 10);
    }
  }

  function drawClicker() {
    gameState.objects.forEach((obj) => {
      drawCircle(obj.x, obj.y, obj.r, obj.hp > 1 ? "#8c7350" : "#ffe66f");
      ctx.fillStyle = "#07101a";
      ctx.font = "800 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(obj.hp, obj.x, obj.y + 4);
      ctx.textAlign = "left";
    });
  }

  function drawRhythm(w) {
    const line = gameState.modeData.hitLine || 430;
    ctx.strokeStyle = "#ffe66f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(46, line);
    ctx.lineTo(w - 46, line);
    ctx.stroke();
    gameState.objects.forEach((note) => drawCircle(note.x, note.y, note.r, "#ff63c9"));
  }

  function drawSandbox() {
    const colors = { spawn: "#7cffb2", goal: "#ffe66f", platform: "#79a7ff", hazard: "#ff6f91", coin: "#ffc857", ship: "#67f2ff", planet: "#b6ff6b", gate: "#c7a2ff", station: "#ff9fe5" };
    (gameState.slots || []).forEach((item, index) => {
      drawCircle(item.x || 120 + index * 42, item.y || 220, item.type === "platform" ? 22 : 16, colors[item.type] || "#67f2ff");
      ctx.fillStyle = "#eef8ff";
      ctx.font = "700 10px system-ui";
      ctx.fillText(cleanText(item.type, 12), (item.x || 120) - 18, (item.y || 220) + 30);
    });
    if (running || replay.active) drawShip(gameState.player.x, gameState.player.y, "#eef8ff");
  }

  function drawPanelPreview(w, h) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "900 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(game().title, w / 2, h / 2 - 10);
    ctx.font = "700 15px system-ui";
    ctx.fillStyle = "rgba(238,248,255,.64)";
    ctx.fillText("Dùng các nút tác vụ bên dưới để chơi mode này.", w / 2, h / 2 + 24);
    ctx.textAlign = "left";
  }

  function drawHud() {
    ctx.fillStyle = "rgba(4,8,16,.72)";
    ctx.fillRect(12, 12, 310, 54);
    ctx.fillStyle = "#eef8ff";
    ctx.font = "900 14px system-ui";
    ctx.fillText(`Score ${Math.floor(gameState.score || 0)}   Combo x${gameState.combo || 1}`, 26, 34);
    ctx.fillStyle = "#9bb7c9";
    ctx.fillText(`Level ${gameState.level || 1}   Mạng ${gameState.lives ?? 3}   Năng lượng ${Math.floor(gameState.energy ?? 100)}`, 26, 56);
  }

  function drawCircle(x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShip(x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, -13);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-18, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function canvasPointer(event) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) * (960 / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (540 / Math.max(1, rect.height)),
      down: event.type !== "pointerup"
    };
    const mode = game().mode;
    if (event.type === "pointerdown") {
      if (["shooter", "arena", "boss", "rhythm"].includes(mode)) keys.add(" ");
      if (mode === "clicker") clickAsteroid(pointer.x, pointer.y);
      if (mode === "sandbox") placeSandboxObject(sandboxTool, pointer.x, pointer.y);
      if (mode === "builder") {
        gameState.slots.push({ type: "platform", x: pointer.x, y: pointer.y });
        addScore(24, "Đặt vật thể.");
        draw();
      }
    }
  }

  function clickAsteroid(x, y) {
    const hit = gameState.objects.find((obj) => Math.hypot(obj.x - x, obj.y - y) < obj.r + 8);
    if (!hit) return;
    hit.hp -= 1;
    addScore(12, "Khoan asteroid.");
    if (hit.hp <= 0) {
      addScore(70, "Nhận quặng hiếm.");
      Object.assign(hit, asteroid(0), { x: rnd(80, 860), y: rnd(80, 440) });
    }
    draw();
    renderStatus();
  }

  function filteredGames() {
    return games.filter((item) => {
      const favorite = (saveData.favorites || []).includes(item.id);
      const recent = (saveData.recent || []).includes(item.id);
      const matchFilter = filter === "Tất cả" || item.category === filter || (filter === "Yêu thích" && favorite) || (filter === "Gần đây" && recent);
      const text = `${item.title} ${item.desc} ${item.category}`.toLowerCase();
      return matchFilter && text.includes(query.toLowerCase().trim());
    });
  }

  function categories() {
    return ["Tất cả", "Yêu thích", "Gần đây", ...Array.from(new Set(games.map((item) => item.category)))];
  }

  function playfieldMarkup() {
    const mode = game().mode;
    if (["runner", "shooter", "clicker", "rhythm", "survival", "arena", "escape", "boss"].includes(mode)) {
      return `<canvas class="ag-canvas" data-ag-canvas tabindex="0" aria-label="Màn chơi ${escapeHtml(game().title)}" aria-describedby="ag-keyboard-help"></canvas>`;
    }
    if (mode === "cipher") {
      const seq = gameState.modeData.sequence || [];
      const input = gameState.modeData.input || [];
      return `<div class="ag-card ag-span"><h4>Mã hiện tại</h4><p class="ag-code">${seq.join(" ")}</p><p>Đã nhập: ${input.join(" ") || "..."}</p><div class="ag-grid">${["H", "A", "S", "T", "R", "13"].map((x) => `<button data-ag-action="cipher" data-value="${x}" class="ag-tile">${x}</button>`).join("")}</div></div>`;
    }
    if (mode === "quiz") {
      const data = gameState.modeData;
      const q = questions[(data.question || 0) % questions.length];
      return `<div class="ag-card ag-span"><h4>${q.q}</h4><div class="ag-grid">${q.choices.map((choice, index) => `<button data-ag-action="quiz" data-value="${index}" class="ag-tile">${choice}</button>`).join("")}</div><p>Đúng: ${data.correct || 0}/${data.question || 0}</p></div>`;
    }
    if (mode === "match") {
      return `<div class="ag-card ag-span"><h4>Nebula Puzzle</h4><div class="ag-board">${gameState.slots.map((cell, index) => `<button data-ag-action="match" data-value="${index}" class="ag-cell ${gameState.selected === index ? "is-selected" : ""}">${cell}</button>`).join("")}</div></div>`;
    }
    if (mode === "board") {
      return `<div class="ag-card ag-span"><h4>Space Chess</h4><div class="ag-board">${gameState.slots.map((cell, index) => `<button data-ag-action="board" data-value="${index}" class="ag-cell ${gameState.selected === index ? "is-selected" : ""}">${cell}</button>`).join("")}</div></div>`;
    }
    if (mode === "card") {
      const data = gameState.modeData;
      return `<div class="ag-card ag-span"><h4>Cosmic Card Battle</h4><p>Bạn: ${data.playerHp} HP - Đối thủ: ${data.enemyHp} HP</p><div class="ag-grid">${[["strike", "Nova Strike"], ["shield", "Shield Bloom"], ["draw", "Comet Draw"]].map(([id, label]) => `<button data-ag-action="card" data-value="${id}" class="ag-tile">${label}</button>`).join("")}</div></div>`;
    }
    if (mode === "sandbox") {
      const level = activeLevel();
      const palette = [["spawn", "Điểm xuất phát"], ["goal", "Đích"], ["platform", "Bệ"], ["hazard", "Bẫy"], ["coin", "Coin"], ["ship", "Tàu"], ["planet", "Hành tinh"], ["gate", "Cổng"], ["station", "Trạm"]];
      return `
        <section class="ag-creator" aria-labelledby="ag-creator-title">
          <div class="ag-creator-head">
            <div><p class="ag-kicker">${LEVEL_SCHEMA}</p><h4 id="ag-creator-title">Creator Sandbox</h4></div>
            <label>Tên màn chơi<input data-ag-level-name maxlength="60" value="${escapeHtml(level?.name || "Màn chơi")}"></label>
          </div>
          <fieldset class="ag-palette"><legend>Chọn vật thể, rồi bấm lên canvas</legend>${palette.map(([id, label]) => `<button type="button" data-ag-sandbox-tool="${id}" class="${sandboxTool === id ? "is-active" : ""}" aria-pressed="${sandboxTool === id}">${label}</button>`).join("")}</fieldset>
          <div class="ag-creator-actions">
            <button type="button" data-ag-level-save>Lưu level</button>
            <button type="button" data-ag-level-test>Test level</button>
            <button type="button" data-ag-level-new>Màn mới</button>
            <button type="button" data-ag-level-clear>Dọn canvas</button>
            <button type="button" data-ag-level-export>Xuất JSON</button>
            <span>${gameState.slots.length}/160 vật thể · local</span>
          </div>
          <canvas class="ag-canvas" data-ag-canvas tabindex="0" aria-label="Canvas tạo màn ${escapeHtml(level?.name || "Màn chơi")}" aria-describedby="ag-creator-help"></canvas>
          <p id="ag-creator-help" class="ag-help">Bàn phím: Tab để chọn công cụ; Enter/Space để kích hoạt; trên canvas dùng phím mũi tên khi test. Level chỉ lưu local cho đến khi có cloud adapter được xác nhận.</p>
        </section>`;
    }
    const actionsByMode = {
      colony: [["solar", "Solar"], ["mine", "Mỏ"], ["farm", "Farm"], ["shield", "Lá chắn"]],
      farm: [["seed", "Gieo hạt"], ["water", "Tưới"], ["harvest", "Thu hoạch"], ["lab", "Gene Lab"]],
      fishing: [["cast", "Thả câu"], ["scan", "Quét đàn cá"], ["bait", "Mồi hiếm"], ["net", "Lưới sao"]],
      builder: [["core", "Lõi"], ["ocean", "Biển"], ["forest", "Rừng"], ["city", "Thành phố"]],
      pet: [["feed", "Cho ăn"], ["play", "Chơi"], ["train", "Huấn luyện"], ["evolve", "Tiến hóa"]],
      dungeon: [["slash", "Đánh"], ["magic", "Phép"], ["loot", "Mở rương"], ["heal", "Hồi máu"]],
      tycoon: [["shop", "Cửa hàng"], ["hotel", "Khách sạn"], ["dock", "Bến tàu"], ["ad", "Quảng cáo"]],
      sandbox: [["ship", "Tàu"], ["planet", "Hành tinh"], ["gate", "Cổng"], ["station", "Trạm"]]
    };
    return `<div class="ag-panel">${(actionsByMode[mode] || []).map(([id, label]) => `<div class="ag-card"><h4>${label}</h4><p>Tác vụ riêng của ${game().title}. Tài nguyên và điểm tăng theo lượt.</p><button data-ag-action="${mode}" data-value="${id}">Dùng</button></div>`).join("")}</div><canvas class="ag-canvas ag-mini-canvas" data-ag-canvas tabindex="0"></canvas>`;
  }

  function overlayMarkup() {
    const rule = ruleFor();
    if (tutorialVisible) {
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-tutorial-title">
        <div class="ag-modal ag-tutorial">
          <p class="ag-kicker">${engineFor().toUpperCase()} ENGINE</p>
          <h3 id="ag-tutorial-title">Huong dan ${escapeHtml(game().title)}</h3>
          <p>${escapeHtml(rule.objective)}</p>
          <ol>${rule.tutorial.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-tutorial-start>Bat dau</button><button type="button" data-ag-tutorial-skip>Bo qua lan sau</button></div>
        </div>
      </div>`;
    }
    if (settingsVisible) {
      const settings = saveData.settings || {};
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-settings-title">
        <div class="ag-modal">
          <p class="ag-kicker">GAME SETTINGS</p>
          <h3 id="ag-settings-title">Cai dat phien choi</h3>
          <label class="ag-setting-row">Do kho<select data-ag-setting="difficulty">${Object.values(DIFFICULTIES).map((item) => `<option value="${item.id}" ${settings.difficulty === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
          <label class="ag-setting-row">Am luong<input type="range" min="0" max="1" step="0.05" value="${settings.volume ?? 0.55}" data-ag-setting="volume"><output data-ag-volume>${Math.round((settings.volume ?? 0.55) * 100)}%</output></label>
          <label class="ag-setting-check"><input type="checkbox" data-ag-setting="muted" ${settings.muted ? "checked" : ""}> Tat am thanh</label>
          <label class="ag-setting-check"><input type="checkbox" data-ag-setting="reducedEffects" ${settings.reducedEffects ? "checked" : ""}> Giam hieu ung</label>
          <label class="ag-setting-row">Chat luong<select data-ag-setting="quality">${["auto", "low", "medium", "high"].map((item) => `<option value="${item}" ${settings.quality === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          <p class="ag-help">FPS hien tai: <b data-ag-modal-fps>${Math.round(fpsValue)}</b>. Gamepad duoc tu nhan dien neu trinh duyet ho tro.</p>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-settings-close>Dong</button></div>
        </div>
      </div>`;
    }
    if (runtimeError) {
      return `<div class="ag-overlay" role="alertdialog" aria-modal="true" aria-labelledby="ag-error-title">
        <div class="ag-modal ag-error">
          <p class="ag-kicker">RUNTIME ERROR</p>
          <h3 id="ag-error-title">Game gap su co</h3>
          <p>${escapeHtml(runtimeError.message)}</p>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-runtime-retry>Thu lai</button><button type="button" data-ag-runtime-dismiss>Dong</button></div>
        </div>
      </div>`;
    }
    if (gameState.phase === "result") {
      const won = gameState.outcome === "win";
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-result-title">
        <div class="ag-modal ag-result ${won ? "is-win" : "is-loss"}">
          <p class="ag-kicker">${won ? "MISSION COMPLETE" : "ROUND OVER"}</p>
          <h3 id="ag-result-title">${won ? "Chien thang" : "Ket thuc luot choi"}</h3>
          <p>${escapeHtml(gameState.resultReason || gameState.message || "")}</p>
          <div class="ag-result-grid"><b>${Math.floor(gameState.score || 0)}<small>Score</small></b><b>${Math.round((gameState.level || 1) * difficultyFor().reward * 10)}<small>XP</small></b><b>${gameState.performance?.fps || 60}<small>FPS</small></b></div>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-result-restart>Choi lai</button><button type="button" data-ag-result-close>Ve danh sach</button></div>
        </div>
      </div>`;
    }
    if (gameState.phase === "paused") {
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-pause-title">
        <div class="ag-modal"><p class="ag-kicker">PAUSED</p><h3 id="ag-pause-title">Tam dung</h3><p>Checkpoint da duoc luu tren thiet bi. Ban co the tiep tuc hoac choi lai.</p><div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-resume>Tiep tuc</button><button type="button" data-ag-result-restart>Choi lai</button></div></div>
      </div>`;
    }
    return "";
  }

  function renderOverlay() {
    const slot = root?.querySelector("[data-ag-overlay]");
    if (!slot) return;
    slot.innerHTML = overlayMarkup();
    slot.querySelector("[data-ag-tutorial-start]")?.addEventListener("click", () => {
      saveData.tutorials[active] = true;
      tutorialVisible = false;
      persist();
      playTone("action");
      renderOverlay();
      resume();
    });
    slot.querySelector("[data-ag-tutorial-skip]")?.addEventListener("click", () => {
      saveData.tutorials[active] = true;
      tutorialVisible = false;
      persist();
      renderOverlay();
    });
    slot.querySelector("[data-ag-settings-close]")?.addEventListener("click", () => {
      settingsVisible = false;
      renderOverlay();
    });
    slot.querySelector("[data-ag-result-restart]")?.addEventListener("click", restart);
    slot.querySelector("[data-ag-result-close]")?.addEventListener("click", () => {
      stopLoop();
      resetGame();
      tutorialVisible = false;
      render();
    });
    slot.querySelector("[data-ag-resume]")?.addEventListener("click", resume);
    slot.querySelector("[data-ag-runtime-retry]")?.addEventListener("click", () => {
      runtimeError = null;
      restart();
    });
    slot.querySelector("[data-ag-runtime-dismiss]")?.addEventListener("click", () => {
      runtimeError = null;
      renderOverlay();
    });
    slot.querySelectorAll("[data-ag-setting]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.agSetting;
        saveData.settings[key] = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
        if (key === "volume") {
          const output = slot.querySelector("[data-ag-volume]");
          if (output) output.textContent = `${Math.round(Number(input.value) * 100)}%`;
        }
        if (key === "difficulty") {
          stopLoop();
          resetGame();
        }
        persist();
        draw();
      });
    });
    slot.querySelector("[data-ag-setting='difficulty']")?.addEventListener("change", () => {
      settingsVisible = false;
      tutorialVisible = !saveData.tutorials[active];
      render();
    });
  }

  function setDifficulty(value) {
    if (!DIFFICULTIES[value]) return;
    saveData.settings.difficulty = value;
    persist();
    restart();
  }

  function renderStatus() {
    if (!root) return;
    const nodes = {
      score: root.querySelector("[data-ag-score]"),
      combo: root.querySelector("[data-ag-combo]"),
      level: root.querySelector("[data-ag-level]"),
      status: root.querySelector("[data-ag-status]"),
      message: root.querySelector("[data-ag-message]"),
      phase: root.querySelector("[data-ag-phase]"),
      fps: root.querySelector("[data-ag-fps]"),
      target: root.querySelector("[data-ag-target]"),
      save: root.querySelector("[data-ag-save]"),
      network: root.querySelector("[data-ag-network]")
    };
    if (nodes.score) nodes.score.textContent = Math.floor(gameState.score || 0);
    if (nodes.combo) nodes.combo.textContent = `x${gameState.combo || 1}`;
    if (nodes.level) nodes.level.textContent = gameState.level || 1;
    if (nodes.status) nodes.status.textContent = replay.active ? "Replay local" : paused ? (running ? "Tạm dừng" : "Sẵn sàng") : "Đang chơi";
    if (nodes.message) nodes.message.textContent = gameState.message || "Sẵn sàng.";
    if (nodes.phase) nodes.phase.textContent = gameState.phase || "ready";
    if (nodes.fps) nodes.fps.textContent = `${Math.round(fpsValue)} FPS`;
    if (nodes.target) nodes.target.textContent = `${Math.floor(gameState.score || 0)} / ${gameState.target || targetFor()}`;
    if (nodes.save) nodes.save.textContent = networkOnline && opts.cloudConfirmed === true ? "Cloud confirmed" : "Local device";
    if (nodes.network) nodes.network.textContent = networkOnline ? "Online" : "Offline";
  }

  function renderPlayfield() {
    const node = root?.querySelector("[data-ag-playfield]");
    if (!node) return;
    node.innerHTML = playfieldMarkup();
    bindPlayfield();
  }

  function render() {
    if (!root) return;
    const g = game();
    const favs = new Set(saveData.favorites || []);
    root.innerHTML = `
      <section class="hh-arcade" style="--ag-active:${g.color}">
        <header class="ag-hero">
          <div>
            <p class="ag-kicker">Arcade Galaxy - 22 playable modes</p>
            <h2>${g.title}</h2>
            <p>${g.desc}. ${escapeHtml(ruleFor().objective)} Điểm, XP và checkpoint được lưu theo phiên.</p>
          </div>
          <div class="ag-score">
            <div>Score<b data-ag-score>${Math.floor(gameState.score || 0)}</b></div>
            <div>Combo<b data-ag-combo>x${gameState.combo || 1}</b></div>
            <div>Level<b data-ag-level>${gameState.level || 1}</b></div>
            <div>Tổng XP<b>${saveData.totalXp || 0}</b></div>
          </div>
        </header>
        <div class="ag-runtime-toolbar" aria-label="Trạng thái runtime">
          <span class="ag-runtime-chip"><b>${engineFor().toUpperCase()}</b> engine</span>
          <span class="ag-runtime-chip">Mục tiêu <b data-ag-target>0 / ${gameState.target || targetFor()}</b></span>
          <span class="ag-runtime-chip">Phase <b data-ag-phase>${gameState.phase || "ready"}</b></span>
          <span class="ag-runtime-chip"><b data-ag-network>${networkOnline ? "Online" : "Offline"}</b></span>
          <span class="ag-runtime-chip" data-ag-save>${opts.cloudConfirmed === true ? "Cloud confirmed" : "Local device"}</span>
          <span class="ag-runtime-chip" data-ag-fps>60 FPS</span>
          <button type="button" data-ag-settings>Cài đặt</button>
        </div>
        <div class="ag-toolbar">
          <input data-ag-search aria-label="Tìm game Arcade" value="${escapeHtml(query)}" placeholder="Tìm game, thể loại, mode...">
          <div class="ag-filters">${categories().map((cat) => `<button class="${filter === cat ? "is-active" : ""}" data-ag-filter="${cat}">${cat}</button>`).join("")}</div>
        </div>
        <div class="ag-layout">
          <nav class="ag-menu" aria-label="Danh sách game Arcade">
            ${filteredGames().map((item) => `
              <button class="ag-game-button ${active === item.id ? "is-active" : ""}" type="button" data-ag-game="${item.id}" style="--game-color:${item.color}">
                <span class="ag-icon">${item.icon}</span>
                <span><h3>${item.title}</h3><small>${item.category} - ${item.desc}</small><em>${engineFor(item.id)} · ${canContinue(item.id) ? "Continue" : "New"}</em></span>
                <b>${saveData[item.id]?.high || 0}</b>
              </button>`).join("") || `<div class="ag-empty">Không tìm thấy game phù hợp.</div>`}
          </nav>
          <main class="ag-stage">
            <div class="ag-stage-head">
              <div><p class="ag-kicker">${g.icon} - ${g.category} - ${g.mode}</p><h3>${g.title}</h3><p data-ag-message aria-live="polite">${gameState.message || "Sẵn sàng."}</p></div>
              <div class="ag-controls">
                <button class="is-primary" type="button" data-ag-start>${gameState.phase === "paused" ? "Tiếp tục" : "Chơi"}</button>
                <button type="button" data-ag-pause>Tạm dừng</button>
                <button type="button" data-ag-reset>Chơi lại</button>
                <button type="button" data-ag-end>Lưu điểm & XP</button>
                ${canContinue() && gameState.phase === "ready" ? `<button type="button" data-ag-continue>Khôi phục</button>` : ""}
                <label class="ag-inline-select">Độ khó<select data-ag-difficulty>${Object.values(DIFFICULTIES).map((item) => `<option value="${item.id}" ${difficultyFor().id === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
              </div>
            </div>
            <div class="ag-playfield" data-ag-playfield>${playfieldMarkup()}</div>
            <div class="ag-touch" aria-label="Điều khiển cảm ứng">
              <button type="button" data-ag-key="ArrowLeft" aria-label="Trái">←</button><button type="button" data-ag-key="ArrowUp" aria-label="Lên">↑</button><button type="button" data-ag-key="ArrowDown" aria-label="Xuống">↓</button><button type="button" data-ag-key="ArrowRight" aria-label="Phải">→</button><button type="button" data-ag-key=" ">Bắn/Beat</button>
            </div>
          </main>
          <aside class="ag-side">
            <button class="ag-fav ${favs.has(g.id) ? "is-active" : ""}" data-ag-favorite>${favs.has(g.id) ? "Đã yêu thích" : "Yêu thích"}</button>
            <h3>Trạng thái</h3>
            <p><b data-ag-status>${replay.active ? "Replay local" : paused ? "Sẵn sàng" : "Đang chơi"}</b></p>
            <p><span class="ag-mode-label">Lưu local · ${SCHEMA}</span></p>
            <p class="ag-objective"><b>Mục tiêu</b><br>${escapeHtml(ruleFor().objective)}</p>
            <button type="button" data-ag-replay ${latestReplay() ? "" : "disabled"}>Xem replay local gần nhất</button>
            <div class="ag-progress"><span style="width:${clamp((gameState.score || 0) % 100, 0, 100)}%"></span></div>
            <h3>Gần đây</h3>
            <div class="ag-log">${(saveData.recent || []).slice(0, 6).map((id) => `<div>${gameById(id).title}: ${saveData[id]?.high || 0}</div>`).join("") || "<div>Chưa có lượt chơi.</div>"}</div>
            <h3>Nhiệm vụ</h3>
            <div class="ag-mission-list"><span>Hôm nay: ${saveData.missions?.dailyPlays || 0}/3 lượt</span><span>Thắng: ${saveData.missions?.dailyWins || 0}/1</span><span>Tuần: ${saveData.missions?.weeklyScore || 0} điểm</span></div>
            <h3>Mẹo điều khiển</h3>
            <p id="ag-keyboard-help">WASD/phím mũi tên, Space, cảm ứng hoặc gamepad. Canvas có focus để nhận phím. Hết mạng chỉ ảnh hưởng dịch vụ cloud/realtime; chơi local vẫn tiếp tục.</p>
          </aside>
        </div>
        <div class="ag-overlay-slot" data-ag-overlay>${overlayMarkup()}</div>
      </section>`;
    bindDom();
    bindPlayfield();
    draw();
  }

  function bindDom() {
    root.querySelectorAll("[data-ag-game]").forEach((button) => button.addEventListener("click", () => {
      stopLoop();
      active = button.dataset.agGame;
      recordRecent(active);
      resetGame();
      tutorialVisible = !saveData.tutorials[active];
      settingsVisible = false;
      render();
    }));
    root.querySelectorAll("[data-ag-filter]").forEach((button) => button.addEventListener("click", () => {
      filter = button.dataset.agFilter;
      render();
    }));
    root.querySelector("[data-ag-search]")?.addEventListener("input", (event) => {
      query = event.target.value;
      render();
    });
    root.querySelector("[data-ag-start]")?.addEventListener("click", () => { start(); canvas?.focus(); });
    root.querySelector("[data-ag-pause]")?.addEventListener("click", pause);
    root.querySelector("[data-ag-reset]")?.addEventListener("click", restart);
    root.querySelector("[data-ag-end]")?.addEventListener("click", () => finishRound("Đã nhận thưởng"));
    root.querySelector("[data-ag-favorite]")?.addEventListener("click", () => toggleFavorite(active));
    root.querySelector("[data-ag-replay]")?.addEventListener("click", startLocalReplay);
    root.querySelector("[data-ag-continue]")?.addEventListener("click", continueSavedGame);
    root.querySelector("[data-ag-settings]")?.addEventListener("click", () => {
      settingsVisible = true;
      tutorialVisible = false;
      renderOverlay();
    });
    root.querySelector("[data-ag-difficulty]")?.addEventListener("change", (event) => setDifficulty(event.target.value));
    root.querySelectorAll("[data-ag-key]").forEach((button) => {
      button.addEventListener("pointerdown", () => keys.add(button.dataset.agKey));
      button.addEventListener("pointerup", () => keys.delete(button.dataset.agKey));
      button.addEventListener("pointerleave", () => keys.delete(button.dataset.agKey));
      button.addEventListener("pointercancel", () => keys.delete(button.dataset.agKey));
    });
    renderOverlay();
  }

  function bindPlayfield() {
    canvas = root.querySelector("[data-ag-canvas]");
    ctx = canvas?.getContext("2d") || null;
    if (canvas) {
      canvas.addEventListener("pointerdown", canvasPointer);
      canvas.addEventListener("pointermove", canvasPointer);
      canvas.addEventListener("pointerup", canvasPointer);
      canvas.addEventListener("keydown", keyDown);
      canvas.addEventListener("keyup", keyUp);
      canvas.addEventListener("blur", () => keys.clear());
    }
    root.querySelectorAll("[data-ag-action]").forEach((button) => {
      button.addEventListener("click", () => panelAction(button.dataset.agAction, button.dataset.value));
    });
    root.querySelectorAll("[data-ag-sandbox-tool]").forEach((button) => button.addEventListener("click", () => {
      sandboxTool = cleanId(button.dataset.agSandboxTool, "platform");
      renderPlayfield();
    }));
    root.querySelector("[data-ag-level-save]")?.addEventListener("click", saveActiveLevel);
    root.querySelector("[data-ag-level-test]")?.addEventListener("click", testActiveLevel);
    root.querySelector("[data-ag-level-new]")?.addEventListener("click", createNewLevel);
    root.querySelector("[data-ag-level-clear]")?.addEventListener("click", clearActiveLevel);
    root.querySelector("[data-ag-level-export]")?.addEventListener("click", exportActiveLevel);
  }

  function gameById(id) {
    return games.find((item) => item.id === id) || games[0];
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function keyDown(event) {
    if (replay.active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (settingsVisible) {
        settingsVisible = false;
        renderOverlay();
      } else if (tutorialVisible) {
        tutorialVisible = false;
        saveData.tutorials[active] = true;
        persist();
        renderOverlay();
      } else {
        pause();
      }
      return;
    }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return;
    keys.add(event.key);
    if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
  }

  function keyUp(event) {
    keys.delete(event.key);
  }

  function handleNetworkChange(online) {
    networkOnline = online;
    gameState.message = online ? "Da ket noi lai mang. Local session van an toan." : "Dang offline. Tiep tuc choi local, cloud/realtime se thu lai sau.";
    renderStatus();
  }

  function mount(host, options = {}) {
    if (!host) throw new Error("HHGameArcade.mount(host) requires a host element.");
    unmount();
    hostNode = host;
    opts = options;
    root = document.createElement("div");
    root.className = "hh-arcade-root";
    hostNode.appendChild(root);
    root.addEventListener("keydown", keyDown);
    active = options.initialGameId || active;
    saveData = load();
    ensureMissionWindow();
    runtimeBridge = createRuntimeBridge();
    networkOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    resetGame();
    tutorialVisible = !saveData.tutorials[active];
    settingsVisible = false;
    render();
    window.dispatchEvent(new CustomEvent("hh:game-arcade-ready", { detail: inspect() }));
    return inspect();
  }

  function destroy() {
    stopLoop();
    cancelAnimationFrame(raf);
    keys.clear();
    gamepadButtons.clear();
    callRuntimeBridge("destroy");
  }

  function unmount() {
    destroy();
    window.removeEventListener("online", onlineHandler);
    window.removeEventListener("offline", offlineHandler);
    callRuntimeBridge("unmount");
    if (root?.parentNode) root.parentNode.removeChild(root);
    root = null;
    hostNode = null;
    canvas = null;
    ctx = null;
    keys = new Set();
    runtimeBridge = null;
    tutorialVisible = false;
    settingsVisible = false;
  }

  function inspect() {
    return {
      mounted: Boolean(root),
      schema: SCHEMA,
      version: INTEGRATION_VERSION,
      active,
      currentGame: active,
      running,
      paused,
      games: games.map((item) => ({ ...item, high: saveData[item.id]?.high || 0, favorite: (saveData.favorites || []).includes(item.id) })),
      totalGames: games.length,
      score: Math.floor(gameState.score || 0),
      xp: saveData.totalXp || 0,
      runtime: runtimeStatus(),
      engine: engineFor(),
      difficulty: difficultyFor().id,
      canContinue: canContinue(),
      history: saveData.history || [],
      achievements: saveData.achievements || [],
      missions: saveData.missions || {},
      recent: saveData.recent || [],
      favorites: saveData.favorites || [],
      spectator: { mode: replay.active ? "local-replay" : "off", replayCount: (saveData.replays || []).length },
      creator: { schema: LEVEL_SCHEMA, activeLevelId: saveData.sandbox?.activeLevelId || "", levels: (saveData.sandbox?.levels || []).map((level) => ({ id: level.id, name: level.name, objects: level.objects.length })) },
      options: { hasSocket: Boolean(opts.socket), hasApiBase: Boolean(opts.apiBase) }
    };
  }

  window.HHGameArcade = { mount, unmount, inspect };
})();
