(function () {
  "use strict";

  const SCHEMA = "hh.arcade.galaxy.v3";
  const STORE = SCHEMA;
  const LEGACY_STORE = "hh.arcade.galaxy.v2";
  const LEVEL_SCHEMA = "hh.creator.level.v1";
  const REPLAY_SCHEMA = "hh.game.replay.v1";
  const INTEGRATION_VERSION = 4;
  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 540;
  const MAX_PARTICLES = 180;
  const COMBO_WINDOW = 2.4;
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
    easy: { id: "easy", label: "Dễ", speed: 0.78, target: 0.72, lives: 5, reward: 0.8 },
    normal: { id: "normal", label: "Thường", speed: 1, target: 1, lives: 3, reward: 1 },
    hard: { id: "hard", label: "Khó", speed: 1.26, target: 1.3, lives: 2, reward: 1.45 }
  };
  const MODE_STATUS = {
    runner: ["Tốc độ", "Cổng"], shooter: ["Hỏa lực", "Wave"], colony: ["Năng lượng", "Module"],
    cipher: ["Chuỗi", "Bảo mật"], clicker: ["Mũi khoan", "Quặng"], rhythm: ["Nhịp", "Độ chính xác"],
    quiz: ["Câu hỏi", "Đáp án đúng"], sandbox: ["Vật thể", "Checkpoint"], board: ["Lượt", "Ô kiểm soát"],
    survival: ["Cứu hộ", "Oxy"], farm: ["Mùa vụ", "Thu hoạch"], fishing: ["Độ sâu", "Cá hiếm"],
    arena: ["Giáp", "Wave"], builder: ["Sinh quyển", "Ổn định"], pet: ["Tình cảm", "Tiến hóa"],
    dungeon: ["Phòng", "Máu"], card: ["Năng lượng", "Khiên"], tycoon: ["Lợi nhuận", "Công trình"],
    escape: ["Khoảng cách", "Lực hút"], match: ["Cặp ghép", "Chuỗi"], boss: ["Boss HP", "Hỏa lực"]
  };
  const ACTION_INFO = {
    solar: ["Tấm quang năng", "Tăng mạnh điện · 25 coin"], mine: ["Mỏ thiên thạch", "Tạo quặng · 35 coin"], farm: ["Bio Farm", "Tạo lương thực · 30 coin"], shield: ["Lá chắn", "Giữ ổn định · 50 coin"],
    seed: ["Gieo hạt", "Khởi tạo mùa vụ · 18 coin"], water: ["Tưới", "Tăng 24% sinh trưởng · 12 coin"], harvest: ["Thu hoạch", "Mở khi cây đạt 70%"], lab: ["Gene Lab", "Tăng 42% sinh trưởng · 44 coin"],
    cast: ["Thả câu", "Câu thường · 12 năng lượng"], scan: ["Quét đàn cá", "Tăng cơ hội cá hiếm · 6 NL"], bait: ["Mồi hiếm", "Cá hiếm +20% · 18 NL"], net: ["Lưới sao", "Bắt 3 cá · 24 NL"],
    core: ["Lõi", "Mở rộng hành tinh · 20 coin"], ocean: ["Biển", "Tăng sinh quyển · 24 coin"], forest: ["Rừng", "Tạo lương thực · 24 coin"], city: ["Thành phố", "Tăng thu nhập · 42 coin"],
    feed: ["Cho ăn", "Tăng tình cảm và tâm trạng"], play: ["Chơi", "Tăng mạnh tâm trạng"], train: ["Huấn luyện", "Tăng kỹ năng và điểm"], evolve: ["Tiến hóa", "Cần tối thiểu 100 tình cảm"],
    slash: ["Kiếm plasma", "74% vượt phòng"], magic: ["Phép sao", "88% · tốn 18 mana"], loot: ["Mở rương", "Rủi ro cao, thưởng lớn"], heal: ["Hồi phục", "Tốn 24 mana · +1 mạng"],
    shop: ["Cửa hàng", "Thu nhập ổn định · 35 coin"], hotel: ["Khách sạn", "Tăng trưởng cao · 75 coin"], dock: ["Bến tàu", "Hub thương mại · 95 coin"], ad: ["Quảng cáo", "Tăng traffic · 20 coin"]
  };
  const ENGINE_GROUPS = {
    action: new Set(["neon-drift", "galaxy-defense", "asteroid-miner", "rhythm-reactor", "mecha-arena", "space-runner", "black-hole-escape", "boss-rush"]),
    strategy: new Set(["star-colony", "galaxy-defense", "planet-builder", "astro-tycoon", "galaxy-farm"]),
    puzzle: new Set(["cipher-run", "quiz-arena", "space-chess", "nebula-puzzle", "cosmic-card-battle", "dungeon-stars"]),
    simulation: new Set(["creative-sandbox", "space-fishing", "alien-pet", "survival-orbit"])
  };
  const GAME_RULES = {
    "neon-drift": { goal: 620, time: 85, objective: "Né cổng plasma và đạt đủ điểm trước khi hết giờ.", tutorial: ["Dùng WASD hoặc phím mũi tên để lái.", "Nhặt tinh thể sáng để tăng combo.", "Va chạm làm mất mạng; hết mạng là thua."] },
    "galaxy-defense": { goal: 720, time: 100, objective: "Bảo vệ cổng thiên hà và tiêu diệt các đợt tấn công.", tutorial: ["Di chuyển bằng WASD hoặc phím mũi tên.", "Nhấn Space, chạm canvas hoặc nút Hành động để bắn.", "Để quá nhiều kẻ địch vượt cổng sẽ làm mất mạng."] },
    "star-colony": { goal: 8, time: 120, objective: "Xây 8 module và giữ nguồn điện trên 0.", tutorial: ["Chọn module để xây thuộc địa.", "Mỗi module tiêu tốn tài nguyên.", "Cân bằng điện, lương thực và coin để chiến thắng."] },
    "cipher-run": { goal: 7, time: 90, objective: "Giải chuỗi mã tăng dần đến cấp 7.", tutorial: ["Ghi nhớ chuỗi ký tự hiện tại.", "Nhấn các nút theo đúng thứ tự.", "Sai mã sẽ mất một mạng và xóa lượt nhập."] },
    "asteroid-miner": { goal: 520, time: 75, objective: "Khai thác đủ quặng hiếm trước khi hết giờ.", tutorial: ["Bấm trực tiếp lên thiên thạch.", "Thiên thạch cứng cần nhiều lần khoan.", "Duy trì combo để nhận thưởng cao hơn."] },
    "rhythm-reactor": { goal: 680, time: 90, objective: "Giữ nhịp lò phản ứng và đạt đủ điểm.", tutorial: ["Nhấn Space khi nốt đi qua vạch vàng.", "Perfect beat làm tăng combo.", "Bỏ lỡ hoặc lệch nhịp sẽ làm mất mạng."] },
    "quiz-arena": { goal: 6, time: 100, objective: "Trả lời đúng ít nhất 6/8 câu.", tutorial: ["Đọc câu hỏi và chọn một đáp án.", "Mỗi câu sai làm mất một mạng.", "Hoàn thành 8 câu để nhận kết quả."] },
    "creative-sandbox": { goal: 1, time: 0, objective: "Tạo màn có điểm xuất phát, coin và đích rồi chạy thử.", tutorial: ["Chọn vật thể rồi bấm lên canvas.", "Lưu màn trước khi chạy thử.", "Thu thập coin và đến đích để hoàn tất."] },
    "space-chess": { goal: 360, time: 120, objective: "Chiếm các ô chiến lược và đạt mục tiêu điểm.", tutorial: ["Chọn quân cờ, sau đó chọn ô đích.", "Ô trống để di chuyển, ô có quân để chiếm.", "Đạt đủ điểm trước khi hết giờ."] },
    "survival-orbit": { goal: 70, time: 70, objective: "Sống sót trên trạm quỹ đạo đến hết thời gian.", tutorial: ["Di chuyển để tránh mảnh vỡ.", "Tinh thể sáng hồi năng lượng và cho điểm.", "Giữ ít nhất một mạng cho đến khi cứu hộ tới."] },
    "galaxy-farm": { goal: 8, time: 120, objective: "Trồng và thu hoạch 8 lô tinh vân.", tutorial: ["Gieo hạt và tưới trước khi thu hoạch.", "Gene Lab tăng hiệu quả nhưng tốn nhiều tài nguyên.", "Thu hoạch đủ 8 lượt để thắng."] },
    "space-fishing": { goal: 430, time: 100, objective: "Câu đủ sinh vật sao và duy trì năng lượng.", tutorial: ["Mỗi lần thả câu tiêu hao năng lượng.", "Chờ thanh năng lượng hồi phục khi cần.", "Cá hiếm cho nhiều điểm hơn."] },
    "mecha-arena": { goal: 760, time: 105, objective: "Hạ mecha đối thủ và bảo toàn giáp.", tutorial: ["Di chuyển bằng WASD hoặc phím mũi tên.", "Nhấn Space để khai hỏa.", "Hạ nhiều mecha liên tiếp để tăng combo."] },
    "planet-builder": { goal: 8, time: 120, objective: "Hoàn thiện hành tinh với 8 thành phần.", tutorial: ["Thêm lõi, biển, rừng và thành phố.", "Mỗi thành phần tiêu hao tài nguyên.", "Xây đủ 8 thành phần để kích hoạt hành tinh."] },
    "alien-pet": { goal: 125, time: 100, objective: "Tăng tình cảm cho pet và tiến hóa an toàn.", tutorial: ["Cho ăn và chơi để tăng tình cảm.", "Huấn luyện cho điểm cao hơn.", "Tiến hóa khi tình cảm đủ cao."] },
    "dungeon-stars": { goal: 6, time: 120, objective: "Vượt qua 6 phòng dungeon và còn ít nhất một mạng.", tutorial: ["Chọn đánh, phép, hồi phục hoặc mở rương.", "Mỗi phòng có thể xuất hiện bẫy.", "Vượt 6 phòng để chiến thắng."] },
    "cosmic-card-battle": { goal: 1, time: 120, objective: "Hạ HP đối thủ trước khi bạn hết HP.", tutorial: ["Nova Strike gây sát thương.", "Shield Bloom tạo khiên bảo vệ.", "Comet Draw hồi năng lượng và tấn công."] },
    "astro-tycoon": { goal: 9, time: 130, objective: "Xây 9 công trình và giữ trạm sinh lời.", tutorial: ["Cửa hàng và quảng cáo có chi phí thấp.", "Khách sạn và bến tàu cho tăng trưởng cao.", "Đầu tư đúng thời điểm để không cạn tài nguyên."] },
    "space-runner": { goal: 720, time: 90, objective: "Chạy qua đường hầm sao và đạt đủ điểm.", tutorial: ["Di chuyển bằng WASD, phím mũi tên hoặc nút cảm ứng.", "Tránh vật cản màu hồng.", "Thu thập vật phẩm sáng để tăng combo."] },
    "black-hole-escape": { goal: 560, time: 75, objective: "Thoát khỏi hố đen và giữ năng lượng trên 0.", tutorial: ["Liên tục di chuyển sang phải để thoát lực hút.", "Né mảnh vỡ và nhặt tinh thể.", "Hết năng lượng là thua."] },
    "nebula-puzzle": { goal: 10, time: 120, objective: "Ghép 10 cặp tinh vân cùng loại.", tutorial: ["Chọn hai ô có cùng biểu tượng.", "Cặp đúng sẽ biến thành sao rỗng.", "Ghép đủ 10 cặp để hoàn tất bản đồ."] },
    "boss-rush": { goal: 1, time: 120, objective: "Hạ boss trước khi hết mạng hoặc thời gian.", tutorial: ["Di chuyển liên tục để né đạn.", "Nhấn Space để bắn và phản công.", "Thanh máu boss nằm phía trên canvas."] }
  };

  const questions = [
    { q: "Hành tinh đỏ là?", a: "Sao Hỏa", choices: ["Sao Hỏa", "Sao Kim", "Sao Thủy"] },
    { q: "CSS dùng để?", a: "Tạo giao diện", choices: ["Tạo giao diện", "Nấu ăn", "Sạc pin"] },
    { q: "BPM trong nhạc là?", a: "Nhịp mỗi phút", choices: ["Nhịp mỗi phút", "Độ sáng", "Dung lượng"] },
    { q: "XP trong game thường dùng để?", a: "Tăng cấp", choices: ["Tăng cấp", "Xóa game", "Tắt màn hình"] },
    { q: "WebGL chủ yếu dùng để?", a: "Đồ họa tăng tốc", choices: ["Đồ họa tăng tốc", "Gửi email", "Nén âm thanh"] },
    { q: "Quỹ đạo là đường chuyển động quanh?", a: "Một thiên thể", choices: ["Một thiên thể", "Bàn phím", "Tệp ZIP"] },
    { q: "Checkpoint giúp người chơi?", a: "Tiếp tục tiến độ", choices: ["Tiếp tục tiến độ", "Tắt mạng", "Đổi màn hình"] },
    { q: "FPS cao và ổn định thường giúp?", a: "Chuyển động mượt", choices: ["Chuyển động mượt", "Pin nặng hơn", "Ảnh nhỏ hơn"] },
    { q: "Combo tăng khi nào?", a: "Thực hiện đúng liên tiếp", choices: ["Thực hiện đúng liên tiếp", "Luôn đứng yên", "Thoát game"] },
    { q: "Năng lượng mặt trời là nguồn?", a: "Tái tạo", choices: ["Tái tạo", "Hóa thạch", "Không tồn tại"] },
    { q: "Phím phổ biến để tạm dừng game?", a: "Escape", choices: ["Escape", "Caps Lock", "Print Screen"] },
    { q: "Chế độ reduced motion dành cho?", a: "Giảm chuyển động", choices: ["Giảm chuyển động", "Tăng âm lượng", "Xóa dữ liệu"] }
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
  let gamepadJustPressed = new Set();
  let gamepadPhysicalButtons = new Set();
  let gamepadMonitorRaf = 0;
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
  const fullscreenHandler = () => updateFullscreenLabel();
  const visibilityHandler = () => {
    if (document.visibilityState !== "hidden" || gameState.phase !== "playing") return;
    paused = true;
    gameState.phase = "paused";
    gameState.message = "Đã tự tạm dừng vì tab không còn hiển thị.";
    keys.clear();
    gamepadButtons.clear();
    gamepadJustPressed.clear();
    saveCheckpoint(true);
    cancelAnimationFrame(raf);
    callRuntimeBridge("pause", { reason: "hidden" });
    renderStatus();
    renderOverlay();
  };

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
      progress: clamp((gameState.score || 0) / Math.max(1, gameState.target || targetFor()), 0, 1),
      combo: gameState.combo || 1,
      intensity: Number((gameState.intensity || 1).toFixed(2)),
      effects: effectsEnabled() ? "full" : "reduced",
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
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
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
    if (points > 0) {
      gameState.combo = gameState.comboClock > 0 ? clamp((gameState.combo || 1) + 1, 1, 12) : 1;
      gameState.comboClock = COMBO_WINDOW;
    } else {
      gameState.combo = 1;
      gameState.comboClock = 0;
    }
    gameState.message = reason || gameState.message;
    const p = gameState.player || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    gameFeel(points > 0 ? (points >= 60 ? "reward" : "hit") : "damage", p.x, p.y - 24, points ? `${points > 0 ? "+" : ""}${Math.round(points)}` : "");
    if (points > 0) playTone(points >= 60 ? "reward" : "action");
  }

  function effectsEnabled() {
    const reducedByOs = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !saveData.settings?.reducedEffects && !reducedByOs;
  }

  function gameFeel(kind = "hit", x = WORLD_WIDTH / 2, y = WORLD_HEIGHT / 2, label = "") {
    if (!gameState.particles) return;
    const colors = { hit: "#67f2ff", reward: "#ffe66f", damage: "#ff6f91", perfect: "#7cffb2" };
    const color = colors[kind] || game().color;
    const count = effectsEnabled() ? (kind === "reward" ? 18 : kind === "damage" ? 14 : 9) : 3;
    for (let i = 0; i < count && gameState.particles.length < MAX_PARTICLES; i += 1) {
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(45, kind === "reward" ? 230 : 150);
      gameState.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rnd(0.25, 0.72), maxLife: 0.72, size: rnd(2, 6), color });
    }
    if (label) gameState.floaters.push({ x, y, text: cleanText(label, 20), life: 0.78, color });
    gameState.shake = Math.max(gameState.shake || 0, kind === "damage" ? 8 : kind === "reward" ? 4 : 2.2);
    gameState.flash = Math.max(gameState.flash || 0, kind === "damage" ? 0.34 : 0.14);
  }

  function registerDamage(reason = "Va chạm", x = gameState.player?.x, y = gameState.player?.y) {
    if ((gameState.hitCooldown || 0) > 0) return false;
    gameState.lives = Math.max(0, (gameState.lives || 0) - 1);
    gameState.hitCooldown = 0.72;
    gameState.message = reason;
    gameState.combo = 1;
    gameState.comboClock = 0;
    gameFeel("damage", x, y, "-1 mạng");
    playTone("loss");
    return true;
  }

  function updateGameFeel(dt) {
    gameState.hitCooldown = Math.max(0, (gameState.hitCooldown || 0) - dt);
    gameState.comboClock = Math.max(0, (gameState.comboClock || 0) - dt);
    if (gameState.comboClock <= 0) gameState.combo = 1;
    gameState.shake = Math.max(0, (gameState.shake || 0) - dt * 24);
    gameState.flash = Math.max(0, (gameState.flash || 0) - dt * 1.9);
    gameState.intensity = clamp(1 + gameState.timer / 75 + Math.max(0, gameState.combo - 1) * 0.025, 1, 2.35);
    gameState.particles.forEach((item) => {
      item.life -= dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= 0.975;
      item.vy = item.vy * 0.975 + 32 * dt;
    });
    gameState.particles = gameState.particles.filter((item) => item.life > 0).slice(-MAX_PARTICLES);
    gameState.floaters.forEach((item) => { item.life -= dt; item.y -= 34 * dt; });
    gameState.floaters = gameState.floaters.filter((item) => item.life > 0).slice(-24);
    gameState.trails.forEach((item) => { item.life -= dt; });
    gameState.trails = gameState.trails.filter((item) => item.life > 0).slice(-48);

    const progress = clamp((gameState.score || 0) / Math.max(1, gameState.target || 1), 0, 1);
    const step = Math.floor(progress * 4);
    if (step > (gameState.checkpointStep || 0) && step < 4) {
      gameState.checkpointStep = step;
      saveCheckpoint(true);
      gameFeel("perfect", gameState.player?.x || 480, gameState.player?.y || 270, `${step * 25}%`);
      gameState.message = `Checkpoint ${step}/4 đã lưu.`;
    }
  }

  function drawGameFeel() {
    gameState.trails.forEach((item) => {
      ctx.globalAlpha = clamp(item.life / 0.34, 0, 0.46);
      drawCircle(item.x, item.y, item.r || 7, item.color || game().color, false);
    });
    gameState.particles.forEach((item) => {
      ctx.globalAlpha = clamp(item.life / item.maxLife, 0, 1);
      drawCircle(item.x, item.y, item.size, item.color, false);
    });
    ctx.globalAlpha = 1;
    gameState.floaters.forEach((item) => {
      ctx.globalAlpha = clamp(item.life / 0.78, 0, 1);
      ctx.fillStyle = item.color;
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(item.text, item.x, item.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
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
    const baseXp = Math.max(10, Math.round((gameState.score || 0) / 9) + (gameState.level || 1) * 4) * difficultyFor().reward;
    const xp = Math.max(2, Math.round(baseXp * (result === "win" ? 1 : result === "quit" ? 0.35 : 0.2)));
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
    gameFeel(result === "win" ? "reward" : result === "quit" ? "hit" : "damage", WORLD_WIDTH / 2, WORLD_HEIGHT / 2, result === "win" ? "MISSION COMPLETE" : result === "quit" ? "ĐÃ LƯU" : "ROUND OVER");
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
      enemyBullets: [],
      particles: [],
      trails: [],
      floaters: [],
      shake: 0,
      flash: 0,
      hitCooldown: 0,
      comboClock: 0,
      checkpointStep: 0,
      intensity: 1,
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
      gameState.modeData.lanes = [170, 380, 590, 800];
      gameState.modeData.hits = 0;
      gameState.modeData.misses = 0;
    }
    if (g.mode === "match") {
      const symbols = ["✦", "◆", "●", "▲", "⬢", "☾", "✧", "◈", "◎", "◇"];
      gameState.slots = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
      gameState.modeData.matches = 0;
    }
    if (g.mode === "board") {
      gameState.slots = ["HH", "", "DR", "", "AI", "", "SB", "", "", "", "", "", "★", "", "", "", "", "SB", "", "", "AI", "", "DR", "", "HH"];
      gameState.modeData.turn = 1;
      gameState.modeData.captures = 0;
    }
    if (g.mode === "card") {
      gameState.modeData.hand = ["Nova Strike", "Shield Bloom", "Comet Draw"];
      gameState.modeData.enemyHp = 160;
      gameState.modeData.playerHp = 130;
      gameState.modeData.energy = 3;
      gameState.modeData.shield = 0;
      gameState.modeData.turn = 1;
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
    if (g.mode === "farm") {
      gameState.modeData = { planted: 0, watered: 0, harvested: 0, season: 1 };
      gameState.resources.coins = 180;
    }
    if (g.mode === "fishing") gameState.modeData = { depth: 1, caught: 0, rare: 0, scanned: false };
    if (g.mode === "pet") gameState.modeData = { mood: 72, stage: 1, fed: 0, trained: 0 };
    if (g.mode === "dungeon") gameState.modeData = { room: 1, mana: 100, shield: 0 };
    if (["colony", "builder", "tycoon"].includes(g.mode)) {
      gameState.modeData = { stability: 100, income: 0, streak: 0 };
      gameState.resources.coins = g.mode === "tycoon" ? 220 : 180;
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
    if (running && !paused) return;
    if (tutorialVisible) {
      renderStatus();
      return;
    }
    if (gameState.phase === "result") resetGame();
    if (!sessionStartedAt) {
      sessionStartedAt = Date.now();
      replayFrames = [];
      captureReplayFrame(true);
      if (game().mode === "cipher") gameState.modeData.revealUntil = Date.now() + 3200;
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
    if (!sessionStartedAt) {
      sessionStartedAt = Date.now();
      if (game().mode === "cipher") gameState.modeData.revealUntil = Date.now() + 3200;
    }
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
    gamepadJustPressed.clear();
    if (!navigator.getGamepads) {
      gamepadButtons.clear();
      return null;
    }
    const pad = Array.from(navigator.getGamepads()).find(Boolean);
    if (!pad) {
      gamepadButtons.clear();
      return null;
    }
    const nextKeys = new Set();
    if (Math.abs(pad.axes?.[0] || 0) > 0.35) nextKeys.add((pad.axes[0] > 0 ? "ArrowRight" : "ArrowLeft"));
    if (Math.abs(pad.axes?.[1] || 0) > 0.35) nextKeys.add((pad.axes[1] > 0 ? "ArrowDown" : "ArrowUp"));
    if (pad.buttons?.[0]?.pressed) nextKeys.add(" ");
    nextKeys.forEach((key) => {
      if (!gamepadButtons.has(key)) gamepadJustPressed.add(key);
    });
    gamepadButtons = nextKeys;
    return pad;
  }

  function activateFromGamepad() {
    if (settingsVisible) return;
    if (tutorialVisible) {
      tutorialVisible = false;
      saveData.tutorials[active] = true;
      persist();
      render();
    }
    gamepadButtons.delete(" ");
    gamepadJustPressed.delete(" ");
    if (gameState.phase === "paused") resume();
    else if (gameState.phase === "ready" || gameState.phase === "result") start();
  }

  function monitorGamepad() {
    if (!root) return;
    const pad = pollGamepad();
    const pressed = new Set();
    (pad?.buttons || []).forEach((button, index) => {
      if (button?.pressed || button?.value > 0.55) pressed.add(index);
    });
    const rising = (index) => pressed.has(index) && !gamepadPhysicalButtons.has(index);
    if (rising(9)) {
      if (gameState.phase === "playing" || gameState.phase === "paused") pause();
      else activateFromGamepad();
    } else if (rising(0) && gameState.phase !== "playing") {
      activateFromGamepad();
    }
    gamepadPhysicalButtons = pressed;
    gamepadMonitorRaf = requestAnimationFrame(monitorGamepad);
  }

  function keyActive(...values) {
    return values.some((value) => keys.has(value) || gamepadButtons.has(value));
  }

  function consumeActionPress() {
    const keyboardPressed = keys.has(" ") || keys.has("Spacebar");
    const gamepadPressed = gamepadJustPressed.has(" ");
    keys.delete(" ");
    keys.delete("Spacebar");
    gamepadJustPressed.delete(" ");
    return keyboardPressed || gamepadPressed;
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
    updateGameFeel(dt);
    const g = game();
    if (["runner", "escape", "survival"].includes(g.mode)) updateRunner(dt, g.mode);
    else if (["shooter", "arena", "boss"].includes(g.mode)) updateShooter(dt, g.mode);
    else if (g.mode === "rhythm") updateRhythm(dt);
    else if (g.mode === "clicker") gameState.score += dt * 2;
    else if (g.mode === "sandbox") updateSandbox(dt);
    else if (["colony", "farm", "builder", "pet", "tycoon", "fishing"].includes(g.mode)) updateSim(dt, g.mode);
    gameState.modeData.nextLevelAt ||= 14;
    if (gameState.timer >= gameState.modeData.nextLevelAt) {
      gameState.level += 1;
      gameState.modeData.nextLevelAt += clamp(16 - gameState.level * 0.35, 8, 16);
      gameFeel("reward", WORLD_WIDTH / 2, 92, `LEVEL ${gameState.level}`);
      gameState.message = `Độ khó tăng · Level ${gameState.level}`;
    }
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
    else if (["clicker", "runner", "escape", "rhythm", "shooter", "arena"].includes(mode) && gameState.score >= target) finishRound("Đạt mục tiêu game", "win");
  }

  function updateRunner(dt, mode) {
    const p = gameState.player;
    gameState.modeData.dash = Math.max(0, (gameState.modeData.dash || 0) - dt);
    gameState.modeData.dashCooldown = Math.max(0, (gameState.modeData.dashCooldown || 0) - dt);
    if (consumeActionPress() && gameState.modeData.dashCooldown <= 0) {
      gameState.modeData.dash = 0.42;
      gameState.modeData.dashCooldown = 1.5;
      gameFeel("perfect", p.x, p.y, "BOOST");
    }
    const boost = gameState.modeData.dash > 0 ? 1.78 : 1;
    const speed = (mode === "escape" ? 250 : 310) * difficultyFor().speed * boost;
    movePlayer(dt, speed);
    if (effectsEnabled() && Math.random() < dt * 32) gameState.trails.push({ x: p.x - 17, y: p.y + rnd(-5, 5), r: rnd(3, 8), life: 0.34, color: game().color });
    if (mode === "escape") {
      p.x -= (60 + gameState.level * 8) * dt;
      gameState.energy -= dt * 2.5;
      if (p.x < 6) gameState.energy = 0;
    }
    gameState.objects.forEach((obj) => {
      obj.x -= (120 + gameState.level * 18) * dt * obj.vx * 0.55 * gameState.intensity;
      if (obj.x < -40) Object.assign(obj, hazard(0), { x: 940 + rnd(0, 180) });
      if (Math.hypot(obj.x - p.x, obj.y - p.y) < obj.r + p.r) {
        if (obj.type === "reward") addScore(38 * gameState.combo, "Nhặt tinh thể.");
        else if (gameState.modeData.dash > 0) addScore(24, "Xuyên cổng bằng boost.");
        else if (registerDamage("Va chạm cổng plasma.", p.x, p.y)) gameState.score = Math.max(0, gameState.score - 20);
        Object.assign(obj, hazard(0), { x: 940 + rnd(0, 180) });
      }
    });
    gameState.score += dt * (mode === "escape" ? 11 : 8);
  }

  function updateShooter(dt, mode) {
    const p = gameState.player;
    movePlayer(dt, (mode === "arena" ? 240 : 210) * difficultyFor().speed);
    gameState.modeData.fireCooldown = Math.max(0, (gameState.modeData.fireCooldown || 0) - dt);
    if (keyActive(" ", "Spacebar") && gameState.modeData.fireCooldown <= 0) {
      gameState.modeData.fireCooldown = mode === "arena" ? 0.13 : 0.18;
      gameState.bullets.push({ x: p.x + 18, y: p.y, vx: mode === "boss" ? 650 : 560, r: mode === "arena" ? 5 : 4, life: 1.8 });
      if (effectsEnabled()) gameState.trails.push({ x: p.x + 14, y: p.y, r: 5, life: 0.2, color: "#ffe66f" });
    }
    gameState.bullets.forEach((bullet) => {
      bullet.x += bullet.vx * dt;
      bullet.life -= dt;
      if (effectsEnabled() && Math.random() < dt * 24) gameState.trails.push({ x: bullet.x - 8, y: bullet.y, r: 2.4, life: 0.22, color: "#ffe66f" });
    });
    gameState.enemies.forEach((mob) => {
      mob.x -= (60 + gameState.level * 8) * dt * mob.vx * gameState.intensity;
      mob.y += Math.sin(gameState.timer * 3 + mob.x * 0.01) * dt * 40;
      mob.shot = (mob.shot || rnd(0.6, 2.2)) - dt;
      if (mob.shot <= 0 && mob.x < 900) {
        mob.shot = rnd(1.1, 2.5) / difficultyFor().speed;
        const angle = Math.atan2(p.y - mob.y, p.x - mob.x);
        gameState.enemyBullets.push({ x: mob.x - mob.r, y: mob.y, vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190, r: 5, life: 5 });
      }
      if (mob.x < -20) {
        mob.x = 940 + rnd(0, 140);
        mob.y = rnd(60, 430);
        registerDamage("Một mục tiêu đã vượt tuyến phòng thủ.", 42, mob.y);
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
        registerDamage("Va chạm mecha đối thủ.", p.x, p.y);
        mob.x = 930;
      }
    });
    gameState.enemyBullets.forEach((bullet) => {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (Math.hypot(bullet.x - p.x, bullet.y - p.y) < bullet.r + p.r) {
        bullet.dead = true;
        registerDamage("Trúng đạn plasma.", p.x, p.y);
      }
    });
    gameState.enemyBullets = gameState.enemyBullets.filter((bullet) => !bullet.dead && bullet.life > 0 && bullet.x > -30 && bullet.y > -30 && bullet.y < 570);
    gameState.bullets = gameState.bullets.filter((bullet) => !bullet.dead && bullet.x < 980 && bullet.life > 0);
    gameState.enemies = gameState.enemies.filter((mob) => {
      if (mob.hp > 0) return true;
      addScore(mode === "boss" ? 45 : 32, "Hạ mục tiêu.");
      return false;
    });
    while (gameState.enemies.length < (mode === "boss" ? 5 : Math.min(12, 4 + gameState.level))) gameState.enemies.push(enemy(gameState.enemies.length));
    if (mode === "boss" && gameState.bossHp <= 0) finishRound("Đã hạ boss");
  }

  function updateRhythm(dt) {
    gameState.spawn -= dt;
    if (gameState.spawn <= 0) {
      gameState.spawn = rnd(0.48, 0.78) / clamp(gameState.intensity, 1, 1.65);
      const lane = Math.floor(rnd(0, 4));
      gameState.objects.push({ x: gameState.modeData.lanes?.[lane] || 170 + lane * 210, lane, y: -20, r: 16, vy: (158 + gameState.level * 10) * difficultyFor().speed });
    }
    gameState.objects.forEach((note) => note.y += note.vy * dt);
    if (consumeActionPress()) {
      const target = gameState.objects.find((note) => Math.abs(note.y - gameState.modeData.hitLine) < 34);
      if (target) {
        target.dead = true;
        const offset = Math.abs(target.y - gameState.modeData.hitLine);
        gameState.modeData.hits += 1;
        addScore((offset < 12 ? 48 : 30) * gameState.combo, offset < 12 ? "Perfect beat." : "Good beat.");
        gameFeel(offset < 12 ? "perfect" : "hit", target.x, target.y, offset < 12 ? "PERFECT" : "GOOD");
      } else {
        gameState.modeData.misses += 1;
        registerDamage("Lệch nhịp reactor.", WORLD_WIDTH / 2, gameState.modeData.hitLine);
        gameState.score = Math.max(0, gameState.score - 8);
      }
    }
    gameState.objects = gameState.objects.filter((note) => {
      if (note.dead) return false;
      if (note.y > 500) {
        gameState.modeData.misses += 1;
        registerDamage("Bỏ lỡ nhịp reactor.", note.x, gameState.modeData.hitLine);
        return false;
      }
      return true;
    });
  }

  function updateSim(dt, mode) {
    const r = gameState.resources;
    if (mode === "pet") {
      r.love = clamp(r.love - dt * 0.8, 0, 150);
      gameState.modeData.mood = clamp((gameState.modeData.mood || 70) - dt * 0.16, 0, 100);
      gameState.score += dt * Math.max(1, r.love / 18);
    } else if (mode === "fishing") {
      gameState.energy = clamp(gameState.energy + dt * 2, 0, 120);
      gameState.modeData.depth = clamp((gameState.modeData.depth || 1) + dt * 0.08, 1, 99);
      gameState.score += dt * 1.2;
    } else if (mode === "farm") {
      gameState.modeData.growth = clamp((gameState.modeData.growth || 0) + (gameState.modeData.watered || 0) * dt * 1.7, 0, 100);
      r.food = clamp(r.food + (gameState.modeData.harvested || 0) * dt * 0.08, 0, 9999);
      r.coins = clamp(r.coins + (gameState.modeData.harvested || 0) * dt * 0.18, 0, 9999);
      gameState.score += dt * (1 + (gameState.modeData.harvested || 0));
    } else {
      r.coins = clamp(r.coins + dt * (2 + gameState.slots.length), 0, 9999);
      r.power = clamp(r.power - dt * 0.8 + gameState.slots.length * dt * 0.2, 0, 180);
      gameState.modeData.income = Math.round(2 + gameState.slots.length * 1.8);
      gameState.modeData.stability = clamp((gameState.modeData.stability || 100) + (r.power > 12 ? dt * 0.25 : -dt * 7), 0, 100);
      if (gameState.modeData.stability <= 0) gameState.energy = Math.max(0, gameState.energy - dt * 22);
      gameState.score += dt * (3 + gameState.slots.length);
    }
  }

  function movePlayer(dt, speed) {
    const p = gameState.player;
    const x = (keyActive("ArrowRight", "d", "D") ? 1 : 0) - (keyActive("ArrowLeft", "a", "A") ? 1 : 0);
    const y = (keyActive("ArrowDown", "s", "S") ? 1 : 0) - (keyActive("ArrowUp", "w", "W") ? 1 : 0);
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
    else if (mode === "farm") farmAction(value);
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
    gameState.resources.power = clamp(gameState.resources.power + (action === "solar" || action === "core" ? 24 : -4), 0, 180);
    gameState.resources.food = clamp(gameState.resources.food + (action === "farm" || action === "forest" ? 14 : -1), 0, 9999);
    gameState.modeData.streak = (gameState.modeData.streak || 0) + 1;
    addScore(cost * 2, message);
  }

  function farmAction(action) {
    const data = gameState.modeData;
    const r = gameState.resources;
    if (action === "seed") {
      if (r.coins < 18) { gameState.message = "Cần 18 coin để gieo hạt."; return; }
      r.coins -= 18;
      data.planted += 1;
      data.growth = Math.max(0, data.growth || 0);
      gameState.slots.push({ action: "seed", at: Date.now() });
      addScore(24, "Đã gieo hạt tinh vân.");
    } else if (action === "water") {
      if (!data.planted) { gameState.message = "Hãy gieo hạt trước khi tưới."; return; }
      if (r.coins < 12) { gameState.message = "Không đủ coin cho hệ tưới."; return; }
      r.coins -= 12;
      data.watered = clamp((data.watered || 0) + 1, 0, data.planted);
      data.growth = clamp((data.growth || 0) + 24, 0, 100);
      addScore(30, "Cây đang phát sáng và lớn lên.");
    } else if (action === "harvest") {
      if ((data.growth || 0) < 70 || !data.planted) { gameState.message = `Mùa vụ mới đạt ${Math.round(data.growth || 0)}%.`; return; }
      data.harvested += data.planted;
      r.food += data.planted * 22;
      r.coins += data.planted * 16;
      addScore(65 * data.planted, `Thu hoạch ${data.planted} cụm sao.`);
      data.planted = 0; data.watered = 0; data.growth = 0; data.season += 1;
    } else if (action === "lab") {
      if (r.coins < 44) { gameState.message = "Gene Lab cần 44 coin."; return; }
      r.coins -= 44;
      data.growth = clamp((data.growth || 0) + 42, 0, 100);
      addScore(58, "Gene Lab tăng tốc mùa vụ.");
    }
    gameState.slots = Array.from({ length: data.harvested || 0 }, (_, index) => ({ action: "harvest", at: index })).slice(0, 20);
  }

  function petAction(action) {
    const data = gameState.modeData;
    if (action === "evolve" && gameState.resources.love < 100) {
      gameState.message = `Cần 100 tình cảm để tiến hóa · hiện có ${Math.round(gameState.resources.love)}.`;
      return;
    }
    const gain = { feed: 18, play: 25, train: 35, evolve: 32 }[action] || 12;
    gameState.resources.love = clamp(gameState.resources.love + gain, 0, 150);
    data.mood = clamp((data.mood || 70) + (action === "feed" ? 14 : action === "play" ? 22 : 8), 0, 100);
    if (action === "feed") data.fed += 1;
    if (action === "train") data.trained += 1;
    if (action === "evolve") data.stage += 1;
    addScore(gain * 2, action === "evolve" ? `Pet tiến hóa cấp ${data.stage}.` : "Pet vui hơn.");
  }

  function dungeonAction(action) {
    const data = gameState.modeData;
    if (action === "heal") {
      if (data.mana < 24) { gameState.message = "Không đủ mana để hồi phục."; return; }
      data.mana -= 24;
      gameState.lives = Math.min(difficultyFor().lives, gameState.lives + 1);
      addScore(20, "Hồi phục tại đài sao.");
      return;
    }
    if (action === "magic" && data.mana < 18) { gameState.message = "Không đủ mana."; return; }
    if (action === "magic") data.mana -= 18;
    const roll = Math.random();
    const success = action === "magic" ? 0.88 : action === "slash" ? 0.74 : action === "loot" ? 0.62 : 0.7;
    if (roll < success) {
      addScore({ slash: 42, magic: 56, loot: 70, heal: 28 }[action] || 35, "Qua phòng dungeon.");
      gameState.slots.push(action);
      data.room = gameState.slots.length + 1;
      data.mana = clamp(data.mana + 7, 0, 100);
    } else {
      registerDamage("Dính bẫy sao trong dungeon.", 480, 270);
      gameState.score = Math.max(0, gameState.score - 12);
    }
  }

  function fishingAction(action) {
    const data = gameState.modeData;
    if (action === "scan") {
      if (gameState.energy < 6) { gameState.message = "Cần hồi năng lượng để quét."; return; }
      gameState.energy -= 6;
      data.scanned = true;
      data.depth = clamp(data.depth + 4, 1, 99);
      addScore(16, "Đã phát hiện đàn cá lượng tử.");
      return;
    }
    const cost = action === "net" ? 24 : action === "bait" ? 18 : 12;
    if (gameState.energy < cost) { gameState.message = "Cần hồi năng lượng."; return; }
    gameState.energy -= cost;
    const chance = 0.2 + (data.scanned ? 0.18 : 0) + (action === "bait" ? 0.2 : action === "net" ? 0.1 : 0);
    const rare = Math.random() < chance;
    const amount = action === "net" ? 3 : 1;
    data.caught += amount;
    if (rare) data.rare += 1;
    data.scanned = false;
    addScore((rare ? 110 : 36) * amount, rare ? "Câu được cá lượng tử hiếm." : `Thu được ${amount} cá sao.`);
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
      data.revealUntil = Date.now() + 2600;
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
    if (gameState.slots[index] === "☆") return;
    if (gameState.selected === null) {
      gameState.selected = index;
      return;
    }
    const a = gameState.selected;
    const b = index;
    if (a !== b && gameState.slots[a] === gameState.slots[b]) {
      gameState.slots[a] = "☆";
      gameState.slots[b] = "☆";
      gameState.modeData.matches = (gameState.modeData.matches || 0) + 1;
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
      const distance = Math.abs(Math.floor(from / 5) - Math.floor(index / 5)) + Math.abs((from % 5) - (index % 5));
      if (distance !== 1) {
        gameState.selected = null;
        gameState.message = "Chỉ được di chuyển sang ô kề cạnh.";
        return;
      }
      if (!gameState.slots[index]) {
        gameState.slots[index] = gameState.slots[from];
        gameState.slots[from] = "";
        addScore(22, "Di chuyển chiến thuật.");
      } else if (from !== index) {
        gameState.slots[index] = gameState.slots[from];
        gameState.slots[from] = "";
        gameState.modeData.captures = (gameState.modeData.captures || 0) + 1;
        addScore(85, "Chiếm ô.");
      }
      gameState.modeData.turn = (gameState.modeData.turn || 1) + 1;
      gameState.selected = null;
    }
  }

  function cardAction(action) {
    const data = gameState.modeData;
    const cost = { strike: 2, shield: 1, draw: 0 }[action] ?? 1;
    if (data.energy < cost) { gameState.message = "Không đủ năng lượng cho lá bài này."; return; }
    data.energy -= cost;
    const damage = { strike: 38, shield: 0, draw: 18 }[action] || 24;
    if (action === "shield") data.shield = clamp((data.shield || 0) + 28, 0, 60);
    else data.enemyHp -= damage;
    if (action === "draw") data.energy = clamp(data.energy + 2, 0, 5);
    const retaliation = Math.max(6, 21 - gameState.combo);
    const absorbed = Math.min(data.shield || 0, retaliation);
    data.shield -= absorbed;
    data.playerHp -= retaliation - absorbed;
    data.energy = clamp(data.energy + 1, 0, 5);
    data.turn += 1;
    addScore(action === "shield" ? 18 : damage * 2, "Lượt bài vũ trụ.");
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
    if (keyActive("ArrowLeft", "a", "A")) player.x -= speed;
    if (keyActive("ArrowRight", "d", "D")) player.x += speed;
    if (keyActive("ArrowUp", "w", "W")) player.y -= speed;
    if (keyActive("ArrowDown", "s", "S")) player.y += speed;
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

  function worldViewport(width, height) {
    const safeWidth = Math.max(1, Number(width) || WORLD_WIDTH);
    const safeHeight = Math.max(1, Number(height) || WORLD_HEIGHT);
    const scale = Math.min(safeWidth / WORLD_WIDTH, safeHeight / WORLD_HEIGHT);
    return {
      scale,
      x: (safeWidth - WORLD_WIDTH * scale) / 2,
      y: (safeHeight - WORLD_HEIGHT * scale) / 2
    };
  }

  function draw() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const cssWidth = rect.width || WORLD_WIDTH;
    const cssHeight = rect.height || WORLD_HEIGHT;
    const viewport = worldViewport(cssWidth, cssHeight);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    const shake = effectsEnabled() ? clamp(gameState.shake || 0, 0, 9) : 0;
    if (shake) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
    const w = WORLD_WIDTH;
    const h = WORLD_HEIGHT;
    drawBackground(w, h);
    const mode = game().mode;
    if (["runner", "escape", "survival"].includes(mode)) drawRunner(w, h, mode);
    else if (["shooter", "arena", "boss"].includes(mode)) drawShooter(w, h, mode);
    else if (mode === "clicker") drawClicker();
    else if (mode === "rhythm") drawRhythm(w, h);
    else if (["sandbox", "builder"].includes(mode)) drawSandbox();
    else drawPanelPreview(w, h);
    if ((gameState.flash || 0) > 0) {
      ctx.fillStyle = `rgba(255,92,133,${clamp(gameState.flash, 0, 0.22)})`;
      ctx.fillRect(0, 0, w, h);
    }
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, w * 0.66);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    drawGameFeel();
    drawHud();
    ctx.restore();
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
    if (quality !== "low" && !saveData.settings?.reducedEffects) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const nebula = ctx.createLinearGradient(0, h, w, 0);
      nebula.addColorStop(0, "rgba(103,242,255,.02)");
      nebula.addColorStop(0.46, `${game().color}22`);
      nebula.addColorStop(1, "rgba(255,99,201,.03)");
      ctx.fillStyle = nebula;
      ctx.beginPath();
      ctx.ellipse(w * 0.58, h * 0.48, w * 0.42, h * 0.16, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const starCount = quality === "low" || saveData.settings?.reducedEffects ? 28 : quality === "medium" ? 52 : 80;
    for (let i = 0; i < starCount; i += 1) {
      ctx.globalAlpha = 0.18 + (i % 5) * 0.08;
      ctx.fillStyle = i % 7 ? "#67f2ff" : "#ff63c9";
      const depth = i % 3 + 1;
      ctx.fillRect((i * 97 + t * 18 * depth) % w, (i * 43 + Math.sin(t * 0.3 + i) * depth) % h, depth === 3 ? 2.4 : 1.4, depth === 3 ? 2.4 : 1.4);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(103,242,255,.055)";
    ctx.lineWidth = 1;
    for (let y = 360; y < h; y += 34) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = -w; x <= w * 2; x += 74) {
      ctx.beginPath(); ctx.moveTo(w / 2, 330); ctx.lineTo(x, h); ctx.stroke();
    }
  }

  function drawRunner(w) {
    const p = gameState.player;
    ctx.strokeStyle = "rgba(103,242,255,.14)";
    ctx.lineWidth = 2;
    [120, 270, 420].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
    if (effectsEnabled() && running) {
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      for (let i = 0; i < 16; i += 1) {
        const x = (i * 83 - gameState.timer * 360 * gameState.intensity) % (w + 120);
        const y = 40 + (i * 73) % 450;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 44, y); ctx.stroke();
      }
    }
    gameState.objects.forEach((obj) => {
      if (obj.type === "reward") {
        ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(gameState.timer * 2.5); ctx.strokeStyle = "#ffe66f"; ctx.lineWidth = 4;
        ctx.strokeRect(-obj.r * 0.65, -obj.r * 0.65, obj.r * 1.3, obj.r * 1.3); ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(255,99,201,.45)"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r + 7 + Math.sin(gameState.timer * 4 + obj.x) * 3, 0, Math.PI * 2); ctx.stroke();
        drawCircle(obj.x, obj.y, obj.r, "#ff63c9");
      }
    });
    ctx.globalAlpha = gameState.hitCooldown > 0 && Math.floor(gameState.timer * 16) % 2 ? 0.35 : 1;
    drawShip(p.x, p.y, game().color);
    ctx.globalAlpha = 1;
    if (game().mode === "escape") {
      const hole = ctx.createRadialGradient(16, p.y, 8, 16, p.y, 112);
      hole.addColorStop(0, "#000"); hole.addColorStop(.45, "rgba(32,5,58,.96)"); hole.addColorStop(.72, "rgba(181,140,255,.72)"); hole.addColorStop(1, "rgba(181,140,255,0)");
      ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(16, p.y, 115, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d7b3ff"; ctx.font = "900 13px system-ui"; ctx.fillText("HỐ ĐEN", 24, 42);
    } else if (game().mode === "survival") {
      ctx.strokeStyle = "rgba(157,255,251,.42)"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(820, 270, 96 + Math.sin(gameState.timer) * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(157,255,251,.16)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(820, 270, 132, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#9dfffb"; ctx.font = "900 13px system-ui";
      ctx.fillText(`CỨU HỘ ${Math.max(0, Math.ceil(gameState.timeLimit - gameState.timer))}s`, 754, 270);
    }
  }

  function drawShooter() {
    const mode = game().mode;
    gameState.enemies.forEach((mob, index) => {
      ctx.save(); ctx.translate(mob.x, mob.y); ctx.rotate(gameState.timer * (index % 2 ? 1 : -1));
      ctx.strokeStyle = mode === "boss" ? "#ff4f5e" : "#ff8b5d"; ctx.lineWidth = 3;
      ctx.strokeRect(-mob.r, -mob.r, mob.r * 2, mob.r * 2); ctx.restore();
      drawCircle(mob.x, mob.y, Math.max(5, mob.r * 0.48), mode === "boss" ? "#ff4f5e" : "#ff8b5d");
    });
    gameState.enemyBullets.forEach((bullet) => drawCircle(bullet.x, bullet.y, bullet.r, "#ff63c9"));
    gameState.bullets.forEach((bullet) => {
      ctx.strokeStyle = "rgba(255,230,111,.58)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bullet.x - 22, bullet.y); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      drawCircle(bullet.x, bullet.y, bullet.r, "#ffe66f");
    });
    ctx.globalAlpha = gameState.hitCooldown > 0 && Math.floor(gameState.timer * 16) % 2 ? 0.35 : 1;
    drawShip(gameState.player.x, gameState.player.y, "#67f2ff");
    ctx.globalAlpha = 1;
    if (mode === "boss") {
      const pulse = 46 + Math.sin(gameState.timer * 3) * 5;
      ctx.strokeStyle = "rgba(255,79,94,.5)"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(820, 270, pulse, 0, Math.PI * 2); ctx.stroke();
      drawCircle(820, 270, 27, "#ff4f5e");
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(320, 28, 300, 10);
      ctx.fillStyle = "#ff4f5e";
      const maxBoss = 220 + gameState.level * 40;
      ctx.fillRect(320, 28, clamp(gameState.bossHp / maxBoss, 0, 1) * 300, 10);
    }
  }

  function drawClicker() {
    gameState.objects.forEach((obj, index) => {
      ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(gameState.timer * 0.08 * (index % 2 ? 1 : -1));
      ctx.fillStyle = obj.hp > 1 ? "#5f5365" : "#ffe66f";
      ctx.strokeStyle = obj.hp > 1 ? "#a48cae" : "#fff4ad"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let point = 0; point < 9; point += 1) {
        const angle = point / 9 * Math.PI * 2;
        const radius = obj.r * (0.78 + ((point * 7 + index) % 4) * 0.08);
        const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius;
        if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#07101a";
      ctx.font = "800 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(obj.hp, obj.x, obj.y + 4);
      ctx.textAlign = "left";
    });
  }

  function drawRhythm(w) {
    const line = gameState.modeData.hitLine || 430;
    const lanes = gameState.modeData.lanes || [170, 380, 590, 800];
    lanes.forEach((x, index) => {
      ctx.fillStyle = index % 2 ? "rgba(255,99,201,.035)" : "rgba(103,242,255,.035)";
      ctx.fillRect(x - 92, 42, 184, line - 42);
      ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.lineWidth = 1;
      ctx.strokeRect(x - 92, 42, 184, line - 42);
    });
    ctx.strokeStyle = "#ffe66f";
    ctx.shadowColor = "#ffe66f"; ctx.shadowBlur = 15; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(46, line);
    ctx.lineTo(w - 46, line);
    ctx.stroke();
    ctx.shadowBlur = 0;
    gameState.objects.forEach((note) => {
      const proximity = 1 - clamp(Math.abs(note.y - line) / 180, 0, 1);
      drawCircle(note.x, note.y, note.r + proximity * 5, note.lane % 2 ? "#ff63c9" : "#67f2ff");
    });
  }

  function drawSandbox() {
    if (game().mode === "builder") {
      const actions = new Set((gameState.slots || []).map((item) => item.action));
      const cx = 480; const cy = 274;
      ctx.strokeStyle = "rgba(103,242,255,.18)"; ctx.lineWidth = 2;
      [142, 186].forEach((radius) => { ctx.beginPath(); ctx.ellipse(cx, cy, radius * 1.7, radius * 0.45, -0.16, 0, Math.PI * 2); ctx.stroke(); });
      const planet = ctx.createRadialGradient(cx - 52, cy - 58, 12, cx, cy, 145);
      planet.addColorStop(0, "#dfffa1"); planet.addColorStop(.45, actions.has("forest") ? "#4fbf67" : "#596b7a"); planet.addColorStop(.72, actions.has("ocean") ? "#2789d8" : "#303e58"); planet.addColorStop(1, "#10172d");
      ctx.fillStyle = planet; ctx.beginPath(); ctx.arc(cx, cy, actions.has("core") ? 138 : 105, 0, Math.PI * 2); ctx.fill();
      if (actions.has("city")) {
        for (let i = 0; i < 18; i += 1) {
          const angle = i / 18 * Math.PI * 2; const radius = 82 + (i % 3) * 12;
          drawCircle(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 3, "#ffe66f");
        }
      }
      ctx.fillStyle = "#eef8ff"; ctx.font = "900 20px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`ỔN ĐỊNH ${Math.round(gameState.modeData.stability || 100)}%`, cx, 472); ctx.textAlign = "left";
      return;
    }
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
    const mode = game().mode;
    const t = gameState.timer || 0;
    ctx.save();
    if (mode === "colony" || mode === "tycoon") {
      const cx = 480; const cy = 280;
      ctx.strokeStyle = `${game().color}66`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, 300, 112, -0.08, 0, Math.PI * 2); ctx.stroke();
      drawCircle(cx, cy, 70, mode === "colony" ? "#7cffb2" : "#6fffc6");
      const slots = gameState.slots || [];
      const total = Math.max(4, slots.length);
      Array.from({ length: total }).forEach((_, index) => {
        const angle = t * 0.18 + index / total * Math.PI * 2;
        const x = cx + Math.cos(angle) * 270; const y = cy + Math.sin(angle) * 104;
        drawCircle(x, y, slots[index] ? 14 : 7, slots[index] ? "#ffe66f" : "rgba(255,255,255,.18)");
      });
      ctx.fillStyle = "#07101a"; ctx.fillRect(382, 250, 196, 60);
      ctx.fillStyle = "#eef8ff"; ctx.font = "900 17px system-ui"; ctx.textAlign = "center";
      ctx.fillText(mode === "colony" ? "COLONY CORE" : "TYCOON HUB", cx, 276);
      ctx.fillStyle = "#7cffb2"; ctx.font = "800 13px system-ui";
      ctx.fillText(`+${gameState.modeData.income || 0} coin/s · ${gameState.slots.length} module`, cx, 298);
    } else if (mode === "farm") {
      const data = gameState.modeData;
      const growth = clamp(data.growth || 0, 0, 100);
      ctx.fillStyle = "rgba(73,149,102,.12)"; ctx.fillRect(80, 105, 800, 330);
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const x = 140 + col * 96; const y = 176 + row * 94;
          ctx.strokeStyle = "rgba(147,255,117,.2)"; ctx.beginPath(); ctx.moveTo(x - 30, y + 24); ctx.lineTo(x + 30, y + 24); ctx.stroke();
          if (col + row * 8 < data.planted) {
            ctx.strokeStyle = "#93ff75"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, y + 20 - growth * .52); ctx.stroke();
            drawCircle(x, y + 18 - growth * .52, 5 + growth * .08, "#ffe66f");
          }
        }
      }
      drawGauge(250, 464, 460, 16, growth / 100, "#93ff75", `Mùa ${data.season || 1} · Sinh trưởng ${Math.round(growth)}%`);
    } else if (mode === "fishing") {
      const water = ctx.createLinearGradient(0, 90, 0, h);
      water.addColorStop(0, "rgba(102,217,255,.05)"); water.addColorStop(1, "rgba(12,52,102,.68)");
      ctx.fillStyle = water; ctx.fillRect(0, 90, w, h - 90);
      ctx.strokeStyle = "#66d9ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(230, 110); ctx.quadraticCurveTo(480, 180, 520, 360); ctx.stroke();
      drawCircle(520, 360, 9, gameState.modeData.scanned ? "#ffe66f" : "#eef8ff");
      for (let i = 0; i < 15; i += 1) {
        const x = (i * 83 + t * (18 + i % 3 * 9)) % 900 + 30; const y = 180 + (i * 47) % 270;
        ctx.fillStyle = i % 5 ? "rgba(102,217,255,.62)" : "#ffe66f";
        ctx.beginPath(); ctx.ellipse(x, y, 12 + i % 4 * 2, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#eef8ff"; ctx.font = "900 18px system-ui"; ctx.fillText(`ĐỘ SÂU ${Math.round(gameState.modeData.depth || 1)} · ĐÃ CÂU ${gameState.modeData.caught || 0}`, 36, 64);
    } else if (mode === "pet") {
      const mood = clamp(gameState.modeData.mood || 0, 0, 100);
      const cx = 480; const cy = 270 + Math.sin(t * 2) * 8;
      ctx.fillStyle = "rgba(255,159,229,.08)"; ctx.beginPath(); ctx.ellipse(cx, 380, 230, 60, 0, 0, Math.PI * 2); ctx.fill();
      drawCircle(cx, cy, 92, "#ff9fe5");
      drawCircle(cx - 34, cy - 15, 13, "#07101a"); drawCircle(cx + 34, cy - 15, 13, "#07101a");
      ctx.strokeStyle = "#07101a"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy + 18, 30, 0.15, Math.PI - .15); ctx.stroke();
      for (let i = 0; i < (gameState.modeData.stage || 1); i += 1) {
        ctx.strokeStyle = "#ffe66f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 112 + i * 14, t + i, t + i + 2.4); ctx.stroke();
      }
      drawGauge(260, 448, 440, 15, mood / 100, "#ff9fe5", `Tâm trạng ${Math.round(mood)}% · Tiến hóa ${gameState.modeData.stage || 1}`);
    } else if (mode === "dungeon") {
      ctx.strokeStyle = "rgba(215,179,255,.22)"; ctx.lineWidth = 4;
      for (let i = 0; i < 7; i += 1) {
        const size = 440 - i * 52; ctx.strokeRect((w - size) / 2, 72 + i * 24, size, 360 - i * 42);
      }
      drawCircle(480, 272, 48, "#d7b3ff");
      ctx.fillStyle = "#eef8ff"; ctx.font = "900 24px system-ui"; ctx.textAlign = "center"; ctx.fillText(`PHÒNG ${gameState.modeData.room || 1}`, 480, 280);
      ctx.font = "800 14px system-ui"; ctx.fillStyle = "#c7a2ff"; ctx.fillText(`Mana ${Math.round(gameState.modeData.mana || 0)} · Mạng ${gameState.lives}`, 480, 330);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "900 28px system-ui"; ctx.textAlign = "center";
      ctx.fillText(game().title, w / 2, h / 2 - 10);
      ctx.font = "700 15px system-ui"; ctx.fillStyle = "rgba(238,248,255,.64)";
      ctx.fillText("Dùng các nút tác vụ để hoàn thành nhiệm vụ.", w / 2, h / 2 + 24);
    }
    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawGauge(x, y, width, height, ratio, color, label) {
    ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillRect(x, y, width * clamp(ratio, 0, 1), height); ctx.shadowBlur = 0;
    ctx.fillStyle = "#eef8ff"; ctx.font = "800 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, x + width / 2, y - 10); ctx.textAlign = "left";
  }

  function drawHud() {
    const progress = clamp((gameState.score || 0) / Math.max(1, gameState.target || 1), 0, 1);
    const timeLeft = gameState.timeLimit ? Math.max(0, Math.ceil(gameState.timeLimit - gameState.timer)) : null;
    ctx.fillStyle = "rgba(4,8,16,.82)";
    ctx.fillRect(12, 12, 338, 72);
    ctx.fillStyle = "#eef8ff";
    ctx.font = "900 14px system-ui";
    ctx.fillText(`SCORE ${Math.floor(gameState.score || 0)}   COMBO x${gameState.combo || 1}`, 26, 35);
    ctx.fillStyle = "#9bb7c9";
    ctx.fillText(`LEVEL ${gameState.level || 1}   MẠNG ${gameState.lives ?? 3}   NL ${Math.floor(gameState.energy ?? 100)}${timeLeft === null ? "" : `   ${timeLeft}s`}`, 26, 57);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(26, 68, 304, 5);
    ctx.fillStyle = game().color; ctx.fillRect(26, 68, 304 * progress, 5);
    if ((gameState.combo || 1) > 2) {
      ctx.fillStyle = "rgba(4,8,16,.8)"; ctx.fillRect(760, 16, 182, 50);
      ctx.fillStyle = "#ffe66f"; ctx.font = "1000 23px system-ui"; ctx.textAlign = "right";
      ctx.fillText(`x${gameState.combo} COMBO`, 928, 47); ctx.textAlign = "left";
    }
  }

  function drawCircle(x, y, r, color, glow = true) {
    ctx.save();
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
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
    const viewport = worldViewport(rect.width, rect.height);
    pointer = {
      x: clamp((event.clientX - rect.left - viewport.x) / viewport.scale, 0, WORLD_WIDTH),
      y: clamp((event.clientY - rect.top - viewport.y) / viewport.scale, 0, WORLD_HEIGHT),
      down: event.type !== "pointerup" && event.type !== "pointercancel"
    };
    const mode = game().mode;
    if (event.type === "pointerup" || event.type === "pointercancel") {
      keys.delete(" ");
      return;
    }
    if (event.type === "pointerdown") {
      canvas.setPointerCapture?.(event.pointerId);
      if (["shooter", "arena", "boss", "rhythm"].includes(mode)) keys.add(" ");
      if (mode === "clicker") clickAsteroid(pointer.x, pointer.y);
      if (mode === "sandbox") placeSandboxObject(sandboxTool, pointer.x, pointer.y);
      if (mode === "builder") gameState.message = "Chọn Lõi, Biển, Rừng hoặc Thành phố để xây đúng tài nguyên.";
    }
  }

  function clickAsteroid(x, y) {
    if (gameState.phase !== "playing") {
      gameState.message = "Bấm Chơi trước khi khai thác asteroid.";
      renderStatus();
      return;
    }
    const hit = gameState.objects.find((obj) => Math.hypot(obj.x - x, obj.y - y) < obj.r + 8);
    if (!hit) return;
    hit.hp -= 1;
    gameFeel("hit", hit.x, hit.y, "DRILL");
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
      return `<div class="ag-card ag-span ag-puzzle-stage"><div class="ag-puzzle-head"><span>Firewall cấp ${seq.length}</span><span>${gameState.lives} mạng</span></div><h4>Ghi nhớ và nhập đúng chuỗi</h4><p class="ag-code" aria-label="Chuỗi mã hiện tại">${seq.join(" ")}</p><p>Đã nhập: <b>${input.join(" ") || "Chưa nhập"}</b> · ${input.length}/${seq.length}</p><div class="ag-grid">${["H", "A", "S", "T", "R", "13"].map((x) => `<button data-ag-action="cipher" data-value="${x}" class="ag-tile">${x}</button>`).join("")}</div></div>`;
    }
    if (mode === "quiz") {
      const data = gameState.modeData;
      const q = questions[(data.question || 0) % questions.length];
      return `<div class="ag-card ag-span ag-puzzle-stage"><div class="ag-puzzle-head"><span>Câu ${Math.min(8, (data.question || 0) + 1)}/8</span><span>Đúng ${data.correct || 0}</span></div><div class="ag-question-meter"><i style="width:${clamp((data.question || 0) / 8 * 100, 0, 100)}%"></i></div><h4>${q.q}</h4><div class="ag-grid">${q.choices.map((choice, index) => `<button data-ag-action="quiz" data-value="${index}" class="ag-tile">${choice}</button>`).join("")}</div></div>`;
    }
    if (mode === "match") {
      return `<div class="ag-card ag-span ag-puzzle-stage"><div class="ag-puzzle-head"><span>Nebula Puzzle</span><span>${gameState.modeData.matches || 0}/10 cặp</span></div><div class="ag-board">${gameState.slots.map((cell, index) => `<button data-ag-action="match" data-value="${index}" ${cell === "☆" ? "disabled" : ""} class="ag-cell ${cell === "☆" ? "is-matched" : ""} ${gameState.selected === index ? "is-selected" : ""}">${cell}</button>`).join("")}</div></div>`;
    }
    if (mode === "board") {
      return `<div class="ag-card ag-span ag-puzzle-stage"><div class="ag-puzzle-head"><span>Space Chess · Lượt ${gameState.modeData.turn || 1}</span><span>${gameState.modeData.captures || 0} lần chiếm</span></div><div class="ag-board ag-chess-board">${gameState.slots.map((cell, index) => `<button data-ag-action="board" data-value="${index}" class="ag-cell ${cell ? "has-piece" : ""} ${gameState.selected === index ? "is-selected" : ""}">${cell}</button>`).join("")}</div><p>Chọn quân rồi di chuyển sang ô kề cạnh. Chiếm quân để tăng điểm nhanh.</p></div>`;
    }
    if (mode === "card") {
      const data = gameState.modeData;
      return `<div class="ag-card ag-span ag-card-arena"><div class="ag-versus"><div><small>BẠN · HP</small><b>${Math.max(0, data.playerHp)}</b><i style="--hp:${clamp(data.playerHp / 130, 0, 1)}"></i></div><strong>VS</strong><div><small>ĐỐI THỦ · HP</small><b>${Math.max(0, data.enemyHp)}</b><i style="--hp:${clamp(data.enemyHp / 160, 0, 1)}"></i></div></div><p>Năng lượng <b>${data.energy}/5</b> · Khiên <b>${data.shield || 0}</b> · Lượt ${data.turn || 1}</p><div class="ag-grid">${[["strike", "Nova Strike · 2 NL"], ["shield", "Shield Bloom · 1 NL"], ["draw", "Comet Draw · +NL"]].map(([id, label]) => `<button data-ag-action="card" data-value="${id}" class="ag-tile">${label}</button>`).join("")}</div></div>`;
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
    const status = modeTelemetry(mode);
    return `<div class="ag-mode-dashboard">
      <div class="ag-mode-telemetry">${status.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></span>`).join("")}</div>
      <div class="ag-panel">${(actionsByMode[mode] || []).map(([id, label]) => {
        const info = ACTION_INFO[id] || [label, `Tác vụ riêng của ${game().title}`];
        return `<div class="ag-card" style="--card-accent:${game().color}"><span class="ag-card-signal" aria-hidden="true"></span><h4>${escapeHtml(info[0])}</h4><p>${escapeHtml(info[1])}</p><button data-ag-action="${mode}" data-value="${id}">Kích hoạt</button></div>`;
      }).join("")}</div>
      <canvas class="ag-canvas ag-mini-canvas" data-ag-canvas tabindex="0" aria-label="Mô phỏng trực quan ${escapeHtml(game().title)}"></canvas>
    </div>`;
  }

  function modeTelemetry(mode) {
    const labels = MODE_STATUS[mode] || ["Tiến độ", "Tài nguyên"];
    const data = gameState.modeData || {};
    const values = {
      colony: [`${Math.round(gameState.resources.power)}%`, `${gameState.slots.length}/${gameState.target}`],
      farm: [`${Math.round(data.growth || 0)}%`, `${data.harvested || 0}/${gameState.target}`],
      fishing: [`${Math.round(data.depth || 1)}m`, `${data.rare || 0} hiếm`],
      builder: [`${Math.round(data.stability || 100)}%`, `${gameState.slots.length}/${gameState.target}`],
      pet: [`${Math.round(gameState.resources.love)}`, `Cấp ${data.stage || 1}`],
      dungeon: [`${data.room || 1}/${gameState.target}`, `${gameState.lives} mạng`],
      tycoon: [`+${data.income || 0}/s`, `${gameState.slots.length}/${gameState.target}`]
    }[mode] || [`${Math.round(gameState.score)}`, `${Math.round(gameState.energy)}%`];
    return [[labels[0], String(values[0])], [labels[1], String(values[1])], ["Tài nguyên", `${Math.round(gameState.resources.coins)} coin`], ["Checkpoint", `${Math.round(clamp(gameState.score / Math.max(1, gameState.target), 0, 1) * 100)}%`]];
  }

  function overlayMarkup() {
    const rule = ruleFor();
    if (tutorialVisible) {
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-tutorial-title">
        <div class="ag-modal ag-tutorial">
          <p class="ag-kicker">${engineFor().toUpperCase()} ENGINE</p>
          <h3 id="ag-tutorial-title">Hướng dẫn ${escapeHtml(game().title)}</h3>
          <p>${escapeHtml(rule.objective)}</p>
          <ol>${rule.tutorial.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-tutorial-start>Bắt đầu</button><button type="button" data-ag-tutorial-skip>Bỏ qua lần sau</button></div>
        </div>
      </div>`;
    }
    if (settingsVisible) {
      const settings = saveData.settings || {};
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-settings-title">
        <div class="ag-modal">
          <p class="ag-kicker">GAME SETTINGS</p>
          <h3 id="ag-settings-title">Cài đặt phiên chơi</h3>
          <label class="ag-setting-row">Độ khó<select data-ag-setting="difficulty">${Object.values(DIFFICULTIES).map((item) => `<option value="${item.id}" ${settings.difficulty === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
          <label class="ag-setting-row">Âm lượng<input type="range" min="0" max="1" step="0.05" value="${settings.volume ?? 0.55}" data-ag-setting="volume"><output data-ag-volume>${Math.round((settings.volume ?? 0.55) * 100)}%</output></label>
          <label class="ag-setting-check"><input type="checkbox" data-ag-setting="muted" ${settings.muted ? "checked" : ""}> Tắt âm thanh</label>
          <label class="ag-setting-check"><input type="checkbox" data-ag-setting="reducedEffects" ${settings.reducedEffects ? "checked" : ""}> Giảm hiệu ứng</label>
          <label class="ag-setting-row">Chất lượng<select data-ag-setting="quality">${["auto", "low", "medium", "high"].map((item) => `<option value="${item}" ${settings.quality === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          <p class="ag-help">FPS hiện tại: <b data-ag-modal-fps>${Math.round(fpsValue)}</b>. Gamepad được tự nhận diện nếu trình duyệt hỗ trợ.</p>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-settings-close>Đóng</button></div>
        </div>
      </div>`;
    }
    if (runtimeError) {
      return `<div class="ag-overlay" role="alertdialog" aria-modal="true" aria-labelledby="ag-error-title">
        <div class="ag-modal ag-error">
          <p class="ag-kicker">RUNTIME ERROR</p>
          <h3 id="ag-error-title">Game gặp sự cố</h3>
          <p>${escapeHtml(runtimeError.message)}</p>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-runtime-retry>Thử lại</button><button type="button" data-ag-runtime-dismiss>Đóng</button></div>
        </div>
      </div>`;
    }
    if (gameState.phase === "result") {
      const won = gameState.outcome === "win";
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-result-title">
        <div class="ag-modal ag-result ${won ? "is-win" : "is-loss"}">
          <p class="ag-kicker">${won ? "MISSION COMPLETE" : "ROUND OVER"}</p>
          <h3 id="ag-result-title">${won ? "Chiến thắng" : "Kết thúc lượt chơi"}</h3>
          <p>${escapeHtml(gameState.resultReason || gameState.message || "")}</p>
          <div class="ag-result-grid"><b>${Math.floor(gameState.score || 0)}<small>Score</small></b><b>${Math.round((gameState.level || 1) * difficultyFor().reward * 10)}<small>XP</small></b><b>${gameState.performance?.fps || 60}<small>FPS</small></b></div>
          <div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-result-restart>Chơi lại</button><button type="button" data-ag-result-close>Về danh sách</button></div>
        </div>
      </div>`;
    }
    if (gameState.phase === "paused") {
      return `<div class="ag-overlay" role="dialog" aria-modal="true" aria-labelledby="ag-pause-title">
        <div class="ag-modal"><p class="ag-kicker">PAUSED</p><h3 id="ag-pause-title">Tạm dừng</h3><p>Checkpoint đã được lưu trên thiết bị. Bạn có thể tiếp tục hoặc chơi lại.</p><div class="ag-modal-actions"><button type="button" class="is-primary" data-ag-resume>Tiếp tục</button><button type="button" data-ag-result-restart>Chơi lại</button></div></div>
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
    const overlay = slot.querySelector(".ag-overlay");
    const shell = root.querySelector(".hh-arcade");
    Array.from(shell?.children || []).forEach((child) => {
      if (child === slot) return;
      child.inert = Boolean(overlay);
      if (overlay) child.setAttribute("aria-hidden", "true");
      else child.removeAttribute("aria-hidden");
    });
    if (!overlay) {
      slot.onkeydown = null;
      if (gameState.phase === "playing") canvas?.focus({ preventScroll: true });
      return;
    }
    const modal = overlay.querySelector(".ag-modal");
    if (modal) modal.tabIndex = -1;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const initialFocus = overlay.querySelector(focusableSelector) || modal;
    initialFocus?.focus({ preventScroll: true });
    slot.onkeydown = (event) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(overlay.querySelectorAll(focusableSelector)).filter((item) => !item.hidden);
      if (!focusable.length) {
        event.preventDefault();
        modal?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
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
      network: root.querySelector("[data-ag-network]"),
      progress: root.querySelector("[data-ag-progress]")
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
    if (nodes.progress) nodes.progress.style.width = `${clamp((gameState.score || 0) / Math.max(1, gameState.target || 1) * 100, 0, 100)}%`;
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
          <button type="button" data-ag-fullscreen aria-label="Mở game toàn màn hình">⛶</button>
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
                <button type="button" data-ag-end>Kết thúc lượt</button>
                ${canContinue() && gameState.phase === "ready" ? `<button type="button" data-ag-continue>Khôi phục</button>` : ""}
                <label class="ag-inline-select">Độ khó<select data-ag-difficulty>${Object.values(DIFFICULTIES).map((item) => `<option value="${item.id}" ${difficultyFor().id === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
              </div>
            </div>
            <div class="ag-playfield" data-ag-playfield>${playfieldMarkup()}</div>
            ${["runner", "shooter", "rhythm", "survival", "arena", "escape", "boss", "sandbox"].includes(g.mode) ? `<div class="ag-touch" aria-label="Điều khiển cảm ứng">
              <button type="button" data-ag-key="ArrowLeft" aria-label="Trái">←</button><button type="button" data-ag-key="ArrowUp" aria-label="Lên">↑</button><button type="button" data-ag-key="ArrowDown" aria-label="Xuống">↓</button><button type="button" data-ag-key="ArrowRight" aria-label="Phải">→</button><button type="button" data-ag-key=" ">Hành động</button>
            </div>` : ""}
          </main>
          <aside class="ag-side">
            <button class="ag-fav ${favs.has(g.id) ? "is-active" : ""}" data-ag-favorite>${favs.has(g.id) ? "Đã yêu thích" : "Yêu thích"}</button>
            <h3>Trạng thái</h3>
            <p><b data-ag-status>${replay.active ? "Replay local" : paused ? "Sẵn sàng" : "Đang chơi"}</b></p>
            <p><span class="ag-mode-label">Lưu local · ${SCHEMA}</span></p>
            <p class="ag-objective"><b>Mục tiêu</b><br>${escapeHtml(ruleFor().objective)}</p>
            <button type="button" data-ag-replay ${latestReplay() ? "" : "disabled"}>Xem replay local gần nhất</button>
            <div class="ag-progress" aria-label="Tiến độ mục tiêu"><span data-ag-progress style="width:${clamp((gameState.score || 0) / Math.max(1, gameState.target || 1) * 100, 0, 100)}%"></span></div>
            <h3>Gần đây</h3>
            <div class="ag-log">${(saveData.recent || []).slice(0, 6).map((id) => `<div>${gameById(id).title}: ${saveData[id]?.high || 0}</div>`).join("") || "<div>Chưa có lượt chơi.</div>"}</div>
            <h3>Nhiệm vụ</h3>
            <div class="ag-mission-list"><span>Hôm nay: ${saveData.missions?.dailyPlays || 0}/3 lượt</span><span>Thắng: ${saveData.missions?.dailyWins || 0}/1</span><span>Tuần: ${saveData.missions?.weeklyScore || 0} điểm</span></div>
            <h3>Mẹo điều khiển</h3>
            <p id="ag-keyboard-help">WASD/phím mũi tên để di chuyển · Space hành động/boost · P hoặc Esc tạm dừng · R chơi lại · Enter bắt đầu. Có cảm ứng và gamepad.</p>
          </aside>
        </div>
        <div class="ag-overlay-slot" data-ag-overlay>${overlayMarkup()}</div>
      </section>`;
    bindDom();
    bindPlayfield();
    draw();
    updateFullscreenLabel();
  }

  function bindDom() {
    root.querySelectorAll("[data-ag-game]").forEach((button) => button.addEventListener("click", () => {
      saveCheckpoint(true);
      stopLoop();
      active = button.dataset.agGame;
      syncActiveRoute(active);
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
      const caret = event.target.selectionStart ?? query.length;
      render();
      const nextSearch = root?.querySelector("[data-ag-search]");
      nextSearch?.focus({ preventScroll: true });
      nextSearch?.setSelectionRange?.(caret, caret);
    });
    root.querySelector("[data-ag-start]")?.addEventListener("click", () => { start(); canvas?.focus(); });
    root.querySelector("[data-ag-pause]")?.addEventListener("click", pause);
    root.querySelector("[data-ag-reset]")?.addEventListener("click", restart);
    root.querySelector("[data-ag-end]")?.addEventListener("click", () => finishRound("Đã kết thúc lượt chơi", "quit"));
    root.querySelector("[data-ag-favorite]")?.addEventListener("click", () => toggleFavorite(active));
    root.querySelector("[data-ag-replay]")?.addEventListener("click", startLocalReplay);
    root.querySelector("[data-ag-continue]")?.addEventListener("click", continueSavedGame);
    root.querySelector("[data-ag-settings]")?.addEventListener("click", () => {
      settingsVisible = true;
      tutorialVisible = false;
      renderOverlay();
    });
    root.querySelector("[data-ag-fullscreen]")?.addEventListener("click", toggleFullscreen);
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
      canvas.addEventListener("pointercancel", canvasPointer);
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

  function syncActiveRoute(gameId) {
    if (!window.location?.hash?.startsWith("#/entertainment/arcade")) return;
    const nextHash = `#/entertainment/arcade/${encodeURIComponent(gameId)}`;
    if (window.location.hash === nextHash) return;
    window.history?.replaceState?.(window.history.state, document.title, `${window.location.pathname}${window.location.search}${nextHash}`);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root?.requestFullscreen) await root.requestFullscreen();
      else throw new Error("Thiết bị không hỗ trợ toàn màn hình.");
    } catch (error) {
      gameState.message = cleanText(error?.message || "Không thể mở toàn màn hình.", 120);
      renderStatus();
    }
  }

  function updateFullscreenLabel() {
    const button = root?.querySelector("[data-ag-fullscreen]");
    if (!button) return;
    const activeFullscreen = document.fullscreenElement === root;
    button.setAttribute("aria-label", activeFullscreen ? "Thoát toàn màn hình" : "Mở game toàn màn hình");
    button.title = activeFullscreen ? "Thoát toàn màn hình" : "Mở toàn màn hình";
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
    if ((event.key === "p" || event.key === "P") && sessionStartedAt) { event.preventDefault(); pause(); return; }
    if ((event.key === "r" || event.key === "R") && sessionStartedAt) { event.preventDefault(); restart(); return; }
    if (event.key === "Enter" && gameState.phase === "ready") { event.preventDefault(); start(); return; }
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
    root.addEventListener("keyup", keyUp);
    active = games.some((item) => item.id === options.initialGameId) ? options.initialGameId : active;
    saveData = load();
    ensureMissionWindow();
    runtimeBridge = createRuntimeBridge();
    networkOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    document.addEventListener("fullscreenchange", fullscreenHandler);
    resetGame();
    tutorialVisible = !saveData.tutorials[active];
    settingsVisible = false;
    render();
    updateFullscreenLabel();
    gamepadMonitorRaf = requestAnimationFrame(monitorGamepad);
    window.dispatchEvent(new CustomEvent("hh:game-arcade-ready", { detail: inspect() }));
    return inspect();
  }

  function destroy() {
    saveCheckpoint(true);
    stopLoop();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(gamepadMonitorRaf);
    gamepadMonitorRaf = 0;
    keys.clear();
    gamepadButtons.clear();
    gamepadJustPressed.clear();
    gamepadPhysicalButtons.clear();
    if (audioContext && typeof audioContext.close === "function") audioContext.close().catch(() => {});
    audioContext = null;
    callRuntimeBridge("destroy");
  }

  function unmount() {
    destroy();
    window.removeEventListener("online", onlineHandler);
    window.removeEventListener("offline", offlineHandler);
    document.removeEventListener("visibilitychange", visibilityHandler);
    document.removeEventListener("fullscreenchange", fullscreenHandler);
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
