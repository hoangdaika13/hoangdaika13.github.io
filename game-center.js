(function () {
  "use strict";

  const SCHEMA = "hh.game.center.profile.v3";
  const STORAGE_KEY = SCHEMA;
  const LEGACY_STORAGE_KEY = "hh.game.center.profile.v2";
  const INTEGRATION_VERSION = 3;
  const API_PATH = "/api/games";
  const DEFAULT_TAB = "overview";

  const CATALOG = [
    {
      id: "astra-hh",
      title: "HH Astra Universe",
      short: "AU",
      route: "/entertainment/astra-hh",
      genre: "MMO RPG vũ trụ",
      color: "#61f4ff",
      status: "Highlight chính",
      description: "Khám phá thiên hà, chế tạo tàu, chiến đấu boss, khai khoáng, giao thương, xây căn cứ và co-op 2-10 người.",
      tags: ["MMO RPG", "Co-op", "Boss", "Crafting"],
      reward: { xp: 180, coins: 90 }
    },
    {
      id: "neon-drift",
      title: "Neon Drift",
      short: "ND",
      route: "/entertainment/arcade?game=neon-drift",
      genre: "Đua tàu tốc độ",
      color: "#ff63c7",
      status: "Arcade",
      description: "Boost, drift, né thiên thạch và săn kỷ lục hằng ngày.",
      tags: ["Speed", "Combo", "Rank"],
      reward: { xp: 70, coins: 28 }
    },
    {
      id: "galaxy-defense",
      title: "Galaxy Defense",
      short: "GD",
      route: "/entertainment/arcade?game=galaxy-defense",
      genre: "Thủ thành",
      color: "#ffe37a",
      status: "Arcade",
      description: "Đặt trụ plasma, nâng cấp laser và bảo vệ căn cứ trước các đợt tấn công.",
      tags: ["Tower", "Strategy", "Wave"],
      reward: { xp: 75, coins: 30 }
    },
    {
      id: "star-colony",
      title: "Star Colony",
      short: "SC",
      route: "/entertainment/arcade?game=star-colony",
      genre: "Xây dựng thuộc địa",
      color: "#74f2a9",
      status: "Arcade",
      description: "Quản lý oxy, dân cư, năng lượng, khai thác và mở rộng thuộc địa.",
      tags: ["Builder", "Economy", "Survival"],
      reward: { xp: 80, coins: 32 }
    },
    {
      id: "cipher-run",
      title: "Cipher Run",
      short: "CR",
      route: "/entertainment/arcade?game=cipher-run",
      genre: "Giải đố mật mã",
      color: "#a98bff",
      status: "Arcade",
      description: "Giải khóa hệ thống cổ đại bằng logic, pattern và phản xạ.",
      tags: ["Puzzle", "Code", "Logic"],
      reward: { xp: 65, coins: 26 }
    },
    {
      id: "survival-orbit",
      title: "Survival Orbit",
      short: "SO",
      route: "/entertainment/arcade?game=survival-orbit",
      genre: "Sinh tồn co-op",
      color: "#ff8a5b",
      status: "Sắp có phòng riêng",
      description: "Sửa trạm, chia vai trò, giữ oxy và sống sót qua bão mặt trời cùng đội 2-10 người.",
      tags: ["Co-op", "Role", "Survival"],
      reward: { xp: 95, coins: 38 }
    }
  ];

  const FEATURED_EVENTS = [
    {
      id: "event-astra-raid",
      title: "Astra Raid",
      subtitle: "Thử thách local",
      status: "Chưa có kết quả",
      duration: "Không giới hạn",
      description: "Hạ boss sự kiện để mở rương vàng, trail thiên thạch và skin tàu độc quyền.",
      reward: { coins: 140, xp: 220 }
    },
    {
      id: "event-neon-cup",
      title: "Neon Cup",
      subtitle: "Thử thách local",
      status: "Chưa có kết quả",
      duration: "Không giới hạn",
      description: "Đua time trial theo bảng xếp hạng, có thưởng season pass điểm tích lũy.",
      reward: { coins: 110, xp: 190 }
    }
  ];

  const DAILY_MISSIONS = [
    { id: "daily-login", title: "Điểm danh phi hành đoàn", target: 1, xp: 40, coins: 20, icon: "★" },
    { id: "daily-play-astra", title: "Chơi HH Astra Universe", target: 1, xp: 120, coins: 60, icon: "AU" },
    { id: "daily-open-chest", title: "Mở rương mỗi ngày", target: 1, xp: 60, coins: 30, icon: "CH" }
  ];

  const WEEKLY_MISSIONS = [
    { id: "weekly-xp", title: "Kiếm 600 XP trong tuần", target: 600, xp: 240, coins: 120, icon: "XP" },
    { id: "weekly-three-games", title: "Thử 3 game khác nhau", target: 3, xp: 180, coins: 90, icon: "3G" },
    { id: "weekly-craft", title: "Craft 2 vật phẩm", target: 2, xp: 160, coins: 80, icon: "CF" }
  ];

  const COLLECTIONS = [
    { id: "skin-lunar", type: "skin", title: "Lunar Ranger", price: 220, rarity: "Hiếm", color: "#61f4ff" },
    { id: "skin-ember", type: "skin", title: "Ember Nova", price: 260, rarity: "Epic", color: "#ff8a5b" },
    { id: "trail-starlight", type: "trail", title: "Starlight Wake", price: 160, rarity: "Hiếm", color: "#ffe37a" },
    { id: "frame-violet", type: "avatarFrame", title: "Violet Halo", price: 140, rarity: "Rare", color: "#a98bff" },
    { id: "pet-microbot", type: "pet", title: "Microbot", price: 180, rarity: "Rare", color: "#74f2a9" }
  ];

  const CRAFT_RECIPES = [
    { id: "craft-trail", title: "Craft trail", need: { coins: 80, material: 1 }, result: "trail-starlight" },
    { id: "craft-frame", title: "Craft frame", need: { coins: 60, material: 1 }, result: "frame-violet" },
    { id: "craft-pet", title: "Craft pet", need: { coins: 120, material: 2 }, result: "pet-microbot" }
  ];

  const BADGES = [
    { id: "captain", title: "Thuyền trưởng HH", text: "Đạt cấp 3 trong Game Center.", unlocked: false },
    { id: "astra-founder", title: "Astra Founder", text: "Vào HH Astra Universe lần đầu.", unlocked: false },
    { id: "weekly-runner", title: "Chuỗi tuần", text: "Hoàn thành một nhiệm vụ tuần.", unlocked: false },
    { id: "social-pilot", title: "Phi công đội", text: "Có bạn bè online.", unlocked: false },
    { id: "season-pass", title: "Season Free", text: "Mở đủ 5 cấp Season Pass free.", unlocked: false },
    { id: "collector", title: "Nhà sưu tầm", text: "Sở hữu 5 món inventory.", unlocked: false }
  ];

  // Friends, rooms and public ranks must come from a confirmed provider. Never seed
  // people that could be mistaken for live users.
  const DEFAULT_FRIENDS = [];

  let hostEl = null;
  let rootEl = null;
  let settings = {};
  let state = null;
  let rewardListener = null;
  let sessionListener = null;
  let toastTimer = null;
  let renderQueued = false;

  function initials(name) {
    return String(name || "HH")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HH";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanText(value, max = 120) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cleanId(value, fallback = "") {
    return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64) || fallback;
  }

  function safeNumber(value, min = 0, max = 999999999, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : fallback;
  }

  function connectionState(kind, status = "local", label = "") {
    const allowed = new Set(["local", "connecting", "connected", "error", "disconnected"]);
    const safeStatus = allowed.has(status) ? status : "local";
    const fallback = kind === "cloud" ? "Chỉ lưu trên thiết bị" : "Chưa kết nối realtime";
    return { status: safeStatus, label: cleanText(label || fallback, 120), provider: "", confirmed: false, updatedAt: new Date().toISOString() };
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function weekKey() {
    const date = new Date();
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return `${utc.getUTCFullYear()}-W${String(Math.ceil((((utc - yearStart) / 86400000) + 1) / 7)).padStart(2, "0")}`;
  }

  function seasonKey() {
    return `local-${todayKey().slice(0, 7)}`;
  }

  function loadLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // invalid local state should not block lobby
    }
    return null;
  }

  function defaultState() {
    const user = settings.currentUser || {};
    return {
      schema: SCHEMA,
      version: 3,
      player: {
        name: user.displayName || user.name || user.username || "Người chơi local",
        avatar: initials(user.displayName || user.name || "HH Gamer"),
        frame: "frame-violet",
        pet: "pet-microbot",
        skin: "skin-lunar",
        trail: "trail-starlight",
        favoriteGame: "HH Astra Universe",
        lastRoute: "/entertainment/astra-hh",
        lastGame: "HH Astra Universe",
        xp: 0,
        coins: 0,
        streak: 0
      },
      activeTab: DEFAULT_TAB,
      games: clone(CATALOG),
      missions: {
        daily: DAILY_MISSIONS.map((item) => ({ ...item, progress: 0 })),
        weekly: WEEKLY_MISSIONS.map((item) => ({ ...item, progress: 0 }))
      },
      dailyMissionDay: todayKey(),
      weeklyMissionWeek: weekKey(),
      events: clone(FEATURED_EVENTS),
      badges: clone(BADGES),
      inventory: [
        { id: "default-skin", type: "skin", title: "Genesis", rarity: "Starter", color: "#61f4ff" }
      ],
      equipment: { skin: "skin-lunar", trail: "trail-starlight", avatarFrame: "frame-violet", pet: "pet-microbot" },
      shopHistory: [],
      chest: { available: true, lastOpened: null, reward: null },
      dailyReward: { lastClaimedDay: "" },
      season: { id: seasonKey(), source: "local-device", level: 1, progress: 0, freeClaimed: [] },
      crafting: [],
      friends: clone(DEFAULT_FRIENDS),
      activity: [
        { time: "Hôm nay", text: "Mở Game Center và sẵn sàng nhận nhiệm vụ." },
        { time: "Tuần này", text: "HH Astra Universe đã trở thành highlight MMO RPG." }
      ],
      leaderboard: [{ name: cleanText(user.displayName || user.name || user.username || "Người chơi local"), level: 1, xp: 0, game: "Chưa có kết quả", scope: "device" }],
      leaderboardMeta: { source: "local-device", label: "Xếp hạng trên thiết bị này", confirmed: true, updatedAt: new Date().toISOString() },
      cloud: connectionState("cloud"),
      realtime: connectionState("realtime", "disconnected"),
      party: { mode: "local", status: "solo", roomCode: "", role: "player", members: [], spectators: [], updatedAt: new Date().toISOString() },
      spectator: { mode: "off", status: "idle", roomCode: "", gameId: "", updatedAt: new Date().toISOString() },
      replays: [],
      playedGames: [],
      history: []
    };
  }

  function normalizeState(saved) {
    const base = defaultState();
    if (!saved) return base;
    const legacy = saved.schema !== SCHEMA || Number(saved.version) !== 3;
    const inventory = Array.isArray(saved.inventory) && saved.inventory.length ? saved.inventory : base.inventory;
    const equipment = { ...base.equipment, ...(saved.equipment || {}) };
    const normalized = {
      ...base,
      ...saved,
      schema: SCHEMA,
      version: 3,
      player: { ...base.player, ...(saved.player || {}) },
      games: base.games,
      missions: {
        daily: mergeMissionList(base.missions.daily, saved.missions?.daily),
        weekly: mergeMissionList(base.missions.weekly, saved.missions?.weekly)
      },
      events: Array.isArray(saved.events) && saved.events.length ? saved.events : base.events,
      badges: mergeBadgeList(base.badges, saved.badges),
      inventory,
      equipment,
      shopHistory: Array.isArray(saved.shopHistory) ? saved.shopHistory : base.shopHistory,
      chest: { ...base.chest, ...(saved.chest || {}) },
      dailyReward: { ...base.dailyReward, ...(saved.dailyReward || {}) },
      season: {
        ...base.season,
        ...(saved.season || {}),
        freeClaimed: Array.isArray(saved.season?.freeClaimed) ? saved.season.freeClaimed : base.season.freeClaimed
      },
      crafting: Array.isArray(saved.crafting) ? saved.crafting : base.crafting,
      friends: !legacy && Array.isArray(saved.friends) ? saved.friends : base.friends,
      activity: Array.isArray(saved.activity) && saved.activity.length ? saved.activity : base.activity,
      leaderboard: !legacy && Array.isArray(saved.leaderboard) && saved.leaderboard.length ? saved.leaderboard : base.leaderboard,
      leaderboardMeta: legacy ? base.leaderboardMeta : { ...base.leaderboardMeta, ...(saved.leaderboardMeta || {}) },
      // A provider session is runtime-only. Reloading always starts disconnected.
      cloud: connectionState("cloud"),
      realtime: connectionState("realtime", "disconnected"),
      party: { ...base.party, ...(saved.party || {}), mode: saved.party?.mode === "local" ? "local" : "local", status: saved.party?.mode === "local" ? cleanText(saved.party?.status || "solo", 20) : "solo", members: Array.isArray(saved.party?.members) ? saved.party.members.slice(0, 10) : [] },
      spectator: { ...base.spectator, mode: "off", status: "idle", roomCode: "" },
      replays: Array.isArray(saved.replays) ? saved.replays.slice(0, 8) : [],
      playedGames: Array.isArray(saved.playedGames) ? saved.playedGames : base.playedGames,
      history: Array.isArray(saved.history) && saved.history.length ? saved.history : base.history
    };
    normalized.player.name = cleanText(normalized.player.name || base.player.name, 80);
    normalized.player.xp = safeNumber(normalized.player.xp, 0);
    normalized.player.coins = safeNumber(normalized.player.coins, 0);
    normalized.player.streak = safeNumber(normalized.player.streak, 0, 10000);
    normalized.leaderboard = normalized.leaderboard.slice(0, 100).map((entry) => ({
      name: cleanText(entry?.name || "Người chơi", 80),
      level: safeNumber(entry?.level, 1, 9999, 1),
      xp: safeNumber(entry?.xp ?? entry?.score, 0),
      game: cleanText(entry?.game || entry?.gameId || "Game HH", 80),
      scope: cleanText(entry?.scope || normalized.leaderboardMeta.source, 30)
    }));
    normalized.friends = normalized.friends.slice(0, 100).map((friend) => ({ name: cleanText(friend?.name, 80), status: cleanText(friend?.status, 100), online: friend?.online === true }));
    return normalized;
  }

  function mergeMissionList(baseList, savedList) {
    const savedMap = new Map((Array.isArray(savedList) ? savedList : []).map((item) => [item.id, item]));
    return baseList.map((item) => ({ ...item, ...(savedMap.get(item.id) || {}), progress: Number(savedMap.get(item.id)?.progress ?? item.progress ?? 0) }));
  }

  function mergeBadgeList(baseList, savedList) {
    const savedMap = new Map((Array.isArray(savedList) ? savedList : []).map((item) => [item.id, item]));
    return baseList.map((item) => ({ ...item, ...(savedMap.get(item.id) || {}) }));
  }

  function saveLocal() {
    if (!state) return;
    try {
      const persisted = clone(state);
      persisted.schema = SCHEMA;
      persisted.version = 3;
      persisted.cloud = connectionState("cloud");
      persisted.realtime = connectionState("realtime", "disconnected");
      if (persisted.party?.mode === "connected") persisted.party = defaultState().party;
      persisted.spectator = defaultState().spectator;
      persisted.history = (persisted.history || []).slice(0, 20);
      persisted.replays = (persisted.replays || []).slice(0, 8);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      state.cloud = { status: "error", label: "Không thể lưu local", updatedAt: new Date().toISOString() };
    }
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function showToast(message, kind = "info") {
    if (!document.body) return;
    let toast = document.querySelector(".gc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "gc-toast";
      document.body.appendChild(toast);
    }
    toast.dataset.kind = kind;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function addActivity(text) {
    state.activity.unshift({
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      text
    });
    state.activity = state.activity.slice(0, 10);
  }

  function xpForLevel(level) {
    return Math.max(0, Math.pow(level - 1, 2) * 120);
  }

  function levelFromXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
  }

  function levelProgress(xp) {
    const level = levelFromXp(xp);
    const min = xpForLevel(level);
    const max = xpForLevel(level + 1);
    return percent(xp - min, max - min);
  }

  function percent(progress, target) {
    if (!target) return 0;
    return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
  }

  function navigate(route) {
    if (typeof settings.navigate === "function") settings.navigate(route);
    else if (route) window.location.hash = `#${route}`;
  }

  function currentTabLabel(tab) {
    return {
      overview: "Tổng quan",
      library: "Thư viện",
      missions: "Nhiệm vụ",
      inventory: "Kho đồ",
      shop: "Cửa hàng",
      pass: "Season Pass",
      social: "Bạn bè",
      history: "Lịch sử"
    }[tab] || "Tổng quan";
  }

  function syncIndicator() {
    return {
      cloud: state?.cloud?.status || "local",
      realtime: state?.realtime?.status || "local"
    };
  }

  function isConfirmed(result, requireDurable = false) {
    return Boolean(result && result.confirmed === true && result.connected === true && (!requireDurable || result.durable === true));
  }

  function setLocalConnection(kind, label, status = "local") {
    state[kind] = connectionState(kind, status, label);
  }

  async function syncCloud(mode = "save") {
    if (!state) return false;
    const adapter = settings.cloudAdapter;
    if (!adapter || typeof adapter.connect !== "function") {
      setLocalConnection("cloud", "Chỉ lưu trên thiết bị · chưa cấu hình cloud adapter");
      scheduleRender();
      return false;
    }
    state.cloud = connectionState("cloud", "connecting", "Đang xác nhận cloud adapter...");
    scheduleRender();
    try {
      const confirmation = await adapter.connect({ schema: SCHEMA, version: 3, player: { name: state.player.name } });
      if (!isConfirmed(confirmation, true)) throw new Error("Cloud adapter chưa xác nhận lưu bền vững");
      const confirmedCloud = { status: "connected", label: `Đã kết nối ${cleanText(confirmation.provider || "cloud", 60)}`, provider: cleanText(confirmation.provider || "cloud", 60), confirmed: true, updatedAt: new Date().toISOString() };
      state.cloud = confirmedCloud;
      if (mode === "load") {
        if (typeof adapter.load === "function") {
          const result = await adapter.load({ key: STORAGE_KEY, schema: SCHEMA });
          if (result?.confirmed === true && result.data && typeof result.data === "object") state = normalizeState({ ...state, ...result.data });
        }
      } else {
        if (typeof adapter.save !== "function") throw new Error("Cloud adapter không hỗ trợ save");
        const result = await adapter.save({ key: STORAGE_KEY, schema: SCHEMA, version: 3, data: clone(state) });
        if (result?.confirmed !== true) throw new Error("Cloud adapter chưa xác nhận bản lưu");
      }
      state.cloud = confirmedCloud;
      saveLocal();
      scheduleRender();
      await refreshLeaderboard();
      return true;
    } catch (error) {
      setLocalConnection("cloud", `Chỉ lưu trên thiết bị · ${cleanText(error?.message || "cloud chưa xác nhận", 90)}`, "error");
      scheduleRender();
    }
    return false;
  }

  async function syncRealtime() {
    const adapter = settings.realtimeAdapter;
    if (!adapter || typeof adapter.connect !== "function") {
      setLocalConnection("realtime", "Chưa kết nối realtime · party local", "disconnected");
      scheduleRender();
      return false;
    }
    state.realtime = connectionState("realtime", "connecting", "Đang xác nhận realtime adapter...");
    scheduleRender();
    try {
      const result = await adapter.connect({ channel: "games", schema: SCHEMA });
      if (!isConfirmed(result)) throw new Error("Realtime adapter chưa xác nhận phiên");
      state.realtime = { status: "connected", label: `Đã kết nối ${cleanText(result.provider || "realtime", 60)}`, provider: cleanText(result.provider || "realtime", 60), confirmed: true, updatedAt: new Date().toISOString() };
      scheduleRender();
      return true;
    } catch (error) {
      setLocalConnection("realtime", `Chưa kết nối realtime · ${cleanText(error?.message || "không có xác nhận", 90)}`, "error");
      scheduleRender();
    }
    return false;
  }

  async function refreshLeaderboard() {
    const adapter = settings.cloudAdapter;
    if (state.cloud.status !== "connected" || typeof adapter?.leaderboard !== "function") return false;
    try {
      const result = await adapter.leaderboard({ season: state.season.id || "local-season", limit: 50 });
      if (result?.confirmed !== true || !Array.isArray(result.entries)) throw new Error("Bảng xếp hạng chưa được xác nhận");
      state.leaderboard = result.entries.slice(0, 50).map((entry) => ({ name: cleanText(entry.name, 80), level: safeNumber(entry.level, 1, 9999, 1), xp: safeNumber(entry.xp ?? entry.score, 0), game: cleanText(entry.game || entry.gameId, 80), scope: "provider" }));
      state.leaderboardMeta = { source: "provider", label: cleanText(result.label || "Bảng xếp hạng đã xác nhận", 100), confirmed: true, updatedAt: new Date().toISOString() };
      scheduleRender();
      return true;
    } catch (error) {
      state.leaderboardMeta = { source: "local-device", label: `Xếp hạng local · ${cleanText(error?.message || "provider lỗi", 80)}`, confirmed: true, updatedAt: new Date().toISOString() };
      updateLocalLeaderboard();
      scheduleRender();
      return false;
    }
  }

  function updateLocalLeaderboard() {
    if (state.leaderboardMeta.source !== "local-device") return;
    state.leaderboard = [{
      name: cleanText(state.player.name || "Người chơi local", 80),
      level: levelFromXp(state.player.xp),
      xp: safeNumber(state.player.xp, 0),
      game: cleanText(state.player.lastGame || "Game HH", 80),
      scope: "device"
    }];
  }

  function createLocalParty() {
    const code = `LOCAL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    state.party = {
      mode: "local",
      status: "waiting",
      roomCode: code,
      role: "host",
      members: [{ name: cleanText(state.player.name, 80), role: "host", local: true }],
      spectators: [],
      updatedAt: new Date().toISOString()
    };
    saveLocal();
    scheduleRender();
    showToast("Đã tạo party local trên thiết bị này.", "success");
  }

  async function createConnectedParty() {
    const adapter = settings.realtimeAdapter;
    if (state.realtime.status !== "connected" || state.realtime.confirmed !== true || typeof adapter?.createParty !== "function") {
      showToast("Chưa có realtime adapter được xác nhận. Bạn vẫn có thể tạo party local.", "warn");
      return false;
    }
    try {
      const result = await adapter.createParty({ gameId: "astra-hh", player: { name: state.player.name } });
      if (result?.confirmed !== true || !result.roomCode) throw new Error("Máy chủ chưa xác nhận phòng");
      state.party = { mode: "connected", status: cleanText(result.status || "waiting", 20), roomCode: cleanText(result.roomCode, 20), role: "host", members: Array.isArray(result.members) ? result.members.slice(0, 10) : [], spectators: [], updatedAt: new Date().toISOString() };
      scheduleRender();
      showToast(`Đã tạo phòng ${state.party.roomCode}.`, "success");
      return true;
    } catch (error) {
      showToast(cleanText(error?.message || "Không tạo được party.", 100), "error");
      return false;
    }
  }

  async function joinConnectedParty(roomCode, spectator = false) {
    const adapter = settings.realtimeAdapter;
    const method = spectator ? "spectate" : "joinParty";
    const code = cleanText(roomCode, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!code) {
      showToast("Nhập mã phòng hợp lệ.", "warn");
      return false;
    }
    if (state.realtime.status !== "connected" || state.realtime.confirmed !== true || typeof adapter?.[method] !== "function") {
      showToast("Chế độ này cần realtime adapter đã xác nhận.", "warn");
      return false;
    }
    try {
      const result = await adapter[method]({ roomCode: code, player: { name: state.player.name } });
      if (result?.confirmed !== true || cleanText(result.roomCode, 20) !== code) throw new Error("Máy chủ chưa xác nhận vào phòng");
      if (spectator) state.spectator = { mode: "connected", status: "watching", roomCode: code, gameId: cleanId(result.gameId, "astra-hh"), updatedAt: new Date().toISOString() };
      else state.party = { mode: "connected", status: cleanText(result.status || "waiting", 20), roomCode: code, role: "player", members: Array.isArray(result.members) ? result.members.slice(0, 10) : [], spectators: [], updatedAt: new Date().toISOString() };
      scheduleRender();
      showToast(spectator ? `Đang xem phòng ${code}.` : `Đã vào phòng ${code}.`, "success");
      return true;
    } catch (error) {
      showToast(cleanText(error?.message || "Không thể vào phòng.", 100), "error");
      return false;
    }
  }

  async function leaveParty() {
    if (state.party.mode === "connected" && typeof settings.realtimeAdapter?.leaveParty === "function") {
      try { await settings.realtimeAdapter.leaveParty({ roomCode: state.party.roomCode }); } catch { /* local UI can still leave */ }
    }
    state.party = defaultState().party;
    state.spectator = defaultState().spectator;
    saveLocal();
    scheduleRender();
  }

  function unlockBadges() {
    const level = levelFromXp(state.player.xp);
    const has = (id) => state.badges.find((badge) => badge.id === id);
    const unlock = (id, condition) => {
      const badge = has(id);
      if (badge && !badge.unlocked && condition) {
        badge.unlocked = true;
        addActivity(`Mở huy hiệu "${badge.title}".`);
      }
    };
    unlock("captain", level >= 3);
    unlock("astra-founder", state.playedGames.includes("astra-hh"));
    unlock("weekly-runner", state.missions.weekly.some((item) => item.progress >= item.target));
    unlock("social-pilot", state.friends.some((item) => item.online));
    unlock("season-pass", state.season.level >= 5);
    unlock("collector", state.inventory.length >= 5);
  }

  function missionById(id) {
    return state.missions.daily.concat(state.missions.weekly).find((item) => item.id === id);
  }

  function completeMission(id, amount = 1) {
    const mission = missionById(id);
    if (!mission) return false;
    const before = mission.progress >= mission.target;
    mission.progress = Math.min(mission.target, Math.max(0, Number(mission.progress || 0) + amount));
    if (!before && mission.progress >= mission.target) {
      rewardPlayer({ xp: mission.xp, coins: mission.coins, reason: `Hoàn thành nhiệm vụ ${cleanText(mission.title, 80)}.` });
      showToast(`Hoàn thành: ${mission.title}`, "success");
      return true;
    }
    return false;
  }

  function rewardPlayer(payload = {}) {
    const xp = safeNumber(payload.xp, 0, 100000, 0);
    const coins = safeNumber(payload.coins, 0, 100000, 0);
    if (!xp && !coins) return;
    state.player.xp += xp;
    state.player.coins += coins;
    if (payload.streak) state.player.streak += payload.streak;
    if (payload.reason) addActivity(payload.reason);
    if (payload.gameId) {
      const safeGameId = cleanId(payload.gameId, "astra-hh");
      const game = state.games.find((item) => item.id === safeGameId) || {
        id: safeGameId,
        title: cleanText(payload.gameTitle || safeGameId, 80),
        route: `/entertainment/arcade?game=${encodeURIComponent(safeGameId)}`
      };
      state.player.lastGame = game.title;
      state.player.lastRoute = game.route;
      if (!state.playedGames.includes(game.id)) {
        state.playedGames.push(game.id);
        completeMission("weekly-three-games", 1);
      }
      state.history.unshift({ id: game.id, title: game.title, playedAt: new Date().toISOString(), duration: safeNumber(payload.duration, 0, 1440, 0), score: safeNumber(payload.score, 0) });
      state.history = state.history.slice(0, 8);
      addActivity(`Nhận ${xp} XP từ ${game.title}.`);
      progressSeason(Math.max(1, Math.floor(xp / 5)));
    }
    if (payload.gameId === "astra-hh") completeMission("daily-play-astra", 1);
    completeMission("weekly-xp", xp);
    updateLocalLeaderboard();
    unlockBadges();
    saveLocal();
    syncCloud("save");
    scheduleRender();
    window.dispatchEvent(new CustomEvent("hh:game-center-updated", { detail: inspect() }));
  }

  function openGame(gameId) {
    const game = state.games.find((item) => item.id === gameId) || state.games[0];
    state.player.lastGame = game.title;
    state.player.lastRoute = game.route;
    state.history.unshift({ id: game.id, title: game.title, playedAt: new Date().toISOString(), duration: 0, score: 0, kind: "launch" });
    state.history = state.history.slice(0, 8);
    addActivity(`Mở ${game.title}. XP chỉ được cộng sau khi game gửi kết quả.`);
    saveLocal();
    navigate(game.route);
  }

  function continueLastGame() {
    const game = state.games.find((item) => item.title === state.player.lastGame) || state.games[0];
    openGame(game.id);
  }

  function openChest() {
    if (!state.chest.available) {
      showToast("Rương hôm nay đã mở rồi.", "warn");
      return;
    }
    const lootTable = [
      { type: "skin", id: "skin-lunar", title: "Skin Lunar Ranger" },
      { type: "trail", id: "trail-starlight", title: "Trail Starlight Wake" },
      { type: "avatarFrame", id: "frame-violet", title: "Avatar Frame Violet Halo" },
      { type: "pet", id: "pet-microbot", title: "Pet Microbot" }
    ];
    const item = lootTable[Math.floor(Math.random() * lootTable.length)];
    addInventory(item.id);
    state.chest.available = false;
    state.chest.lastOpened = new Date().toISOString();
    state.chest.reward = item.title;
    rewardPlayer({ xp: 80, coins: 40, reason: `Mở rương nhận ${item.title}.` });
    showToast(`Mở rương: ${item.title}`, "success");
  }

  function addInventory(itemId) {
    const item = COLLECTIONS.find((entry) => entry.id === itemId);
    if (!item) return;
    if (!state.inventory.some((owned) => owned.id === item.id)) {
      state.inventory.push({
        id: item.id,
        type: item.type,
        title: item.title,
        rarity: item.rarity,
        color: item.color,
        equipped: false
      });
      addActivity(`Nhận vật phẩm ${item.title}.`);
    }
  }

  function equipItem(itemId) {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) return;
    state.equipment[item.type] = item.id;
    state.player[item.type] = item.id;
    addActivity(`Trang bị ${item.title}.`);
    rewardPlayer({ xp: 15, coins: 5, reason: `Trang bị ${item.title}.` });
  }

  function buyItem(itemId) {
    const item = COLLECTIONS.find((entry) => entry.id === itemId);
    if (!item || state.player.coins < item.price) {
      showToast("Không đủ coin trong game.", "warn");
      return;
    }
    state.player.coins -= item.price;
    addInventory(item.id);
    state.shopHistory.unshift({ id: item.id, title: item.title, price: item.price, at: new Date().toISOString() });
    state.shopHistory = state.shopHistory.slice(0, 10);
    showToast(`Đã mua ${item.title}`, "success");
    saveLocal();
    scheduleRender();
  }

  function craft(recipeId) {
    const recipe = CRAFT_RECIPES.find((item) => item.id === recipeId);
    if (!recipe) return;
    const enoughCoins = state.player.coins >= recipe.need.coins;
    const enoughMaterials = state.player.inventoryMaterial >= recipe.need.material;
    if (!enoughCoins || !enoughMaterials) {
      state.player.inventoryMaterial = state.player.inventoryMaterial || 0;
      if (!enoughMaterials) {
        showToast("Thiếu nguyên liệu craft.", "warn");
        return;
      }
    }
    state.player.coins -= recipe.need.coins;
    state.player.inventoryMaterial = Math.max(0, (state.player.inventoryMaterial || 0) - recipe.need.material);
    addInventory(recipe.result);
    state.crafting.unshift({ id: recipe.id, title: recipe.title, at: new Date().toISOString() });
    state.crafting = state.crafting.slice(0, 6);
    rewardPlayer({ xp: 55, coins: 10, reason: `Craft ${recipe.title}.` });
    showToast(`Craft thành công: ${recipe.title}`, "success");
  }

  function claimDailyReward() {
    if (state.dailyReward.lastClaimedDay === todayKey()) {
      showToast("Bạn đã nhận daily reward hôm nay.", "warn");
      return;
    }
    state.dailyReward.lastClaimedDay = todayKey();
    state.chest.available = true;
    rewardPlayer({ xp: 60, coins: 50, streak: 1, reason: "Nhận daily reward." });
    showToast("Nhận daily reward thành công", "success");
  }

  function progressSeason(amount = 1) {
    state.season.progress += safeNumber(amount, 0, 100, 0);
    while (state.season.progress >= 100 && state.season.level < 5) {
      state.season.progress -= 100;
      state.season.level += 1;
      const claimId = `season-${state.season.level}`;
      if (!state.season.freeClaimed.includes(claimId)) {
        state.season.freeClaimed.push(claimId);
        state.player.xp += 90;
        state.player.coins += 35;
        addActivity(`Tự động nhận thưởng Season Free cấp ${state.season.level}.`);
      }
    }
  }

  function renderProgressBar(value) {
    return `<div class="gc-progress"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>`;
  }

  function renderGames() {
    return state.games.map((game) => `
      <article class="gc-card" style="--game-color:${game.color}">
        <div class="gc-card-icon">${escapeHtml(game.short)}</div>
        <p class="gc-pill">${escapeHtml(game.genre)} · ${escapeHtml(game.status)}</p>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.description)}</p>
        <div class="gc-card-foot">
          <span class="gc-pill">${game.tags.map((tag) => escapeHtml(tag)).join("</span><span class=\"gc-pill\">")}</span>
          <button class="gc-btn gc-btn-primary" type="button" data-gc-action="play" data-gc-play="${escapeHtml(game.id)}" data-id="${escapeHtml(game.id)}">Chơi</button>
        </div>
      </article>
    `).join("");
  }

  function renderMissions(list) {
    return list.map((mission) => `
      <div class="gc-mission">
        <div class="gc-mission-top">
          <div>
            <strong>${escapeHtml(mission.title)}</strong>
            <div class="gc-muted">${escapeHtml(mission.icon)} · ${mission.progress}/${mission.target}</div>
          </div>
          <span class="gc-pill">+${mission.xp} XP</span>
        </div>
        ${renderProgressBar(percent(mission.progress, mission.target))}
        <div class="gc-card-foot">
          <span class="gc-muted">+${mission.coins} coin</span>
          <button class="gc-btn" type="button" disabled>${mission.progress >= mission.target ? "Đã tự động nhận" : "Tự cập nhật khi chơi"}</button>
        </div>
      </div>
    `).join("");
  }

  function renderEvents() {
    return state.events.map((event) => `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>${escapeHtml(event.title)}</strong>
            <div class="gc-muted">${escapeHtml(event.subtitle)} · ${escapeHtml(event.duration)}</div>
          </div>
          <span class="gc-pill">${escapeHtml(event.status)}</span>
        </div>
        <span class="gc-muted">${escapeHtml(event.description)}</span>
        <button class="gc-btn" type="button" data-gc-action="reward-event" data-id="${escapeHtml(event.id)}" ${event.completed === true && event.claimed !== true ? "" : "disabled"}>${event.claimed === true ? "Đã nhận" : event.completed === true ? "Nhận kết quả đã xác nhận" : "Cần kết quả trận"}</button>
      </div>
    `).join("");
  }

  function renderLeaderboard() {
    const entries = state.leaderboard
      .slice()
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 6)
      .map((item, index) => `
        <div class="gc-rank">
          <span class="gc-rank-number">${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="gc-muted">Lv.${item.level} · ${escapeHtml(item.game)}</div>
          </div>
          <strong>${safeNumber(item.xp, 0).toLocaleString("vi-VN")}</strong>
        </div>
      `).join("");
    return entries || `<div class="gc-empty">Chưa có điểm thật để xếp hạng.</div>`;
  }

  function renderFriends() {
    const items = state.friends.map((friend) => `
      <div class="gc-friend">
        <div>
          <strong>${escapeHtml(friend.name)}</strong>
          <div class="gc-muted">${escapeHtml(friend.status)}</div>
        </div>
        <span class="gc-pill" style="color:${friend.online ? "var(--gc-green)" : "var(--gc-muted)"}">${friend.online ? "Online" : "Offline"}</span>
      </div>
    `).join("");
    return items || `<div class="gc-empty">Chưa có danh sách bạn bè từ nhà cung cấp đã xác nhận.</div>`;
  }

  function renderBadgeList() {
    return state.badges.map((badge) => `
      <div class="gc-badge ${badge.unlocked ? "" : "is-locked"}">
        <strong>${badge.unlocked ? "Đã mở" : "Đang khóa"} · ${escapeHtml(badge.title)}</strong>
        <span class="gc-muted">${escapeHtml(badge.text)}</span>
      </div>
    `).join("");
  }

  function renderInventory() {
    const items = state.inventory;
    return items.map((item) => `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div class="gc-muted">${escapeHtml(item.type)} · ${escapeHtml(item.rarity || "Standard")}</div>
          </div>
          <span class="gc-pill">${state.equipment[item.type] === item.id ? "Đang dùng" : "Inventory"}</span>
        </div>
        <div class="gc-card-foot">
          <span class="gc-muted">${escapeHtml(item.id)}</span>
          <button class="gc-btn" type="button" data-gc-action="equip" data-id="${escapeHtml(item.id)}">Trang bị</button>
        </div>
      </div>
    `).join("");
  }

  function renderShop() {
    return COLLECTIONS.map((item) => `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div class="gc-muted">${escapeHtml(item.type)} · ${escapeHtml(item.rarity)}</div>
          </div>
          <span class="gc-pill" style="color:${escapeHtml(item.color)}">${item.price} coin</span>
        </div>
        <div class="gc-card-foot">
          <span class="gc-muted">Dùng coin trong game בלבד</span>
          <button class="gc-btn gc-btn-primary" type="button" data-gc-action="buy" data-id="${escapeHtml(item.id)}">Mua</button>
        </div>
      </div>
    `).join("");
  }

  function renderCrafting() {
    return CRAFT_RECIPES.map((recipe) => `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>${escapeHtml(recipe.title)}</strong>
            <div class="gc-muted">${recipe.need.coins} coin · ${recipe.need.material} material</div>
          </div>
          <span class="gc-pill">Craft</span>
        </div>
        <button class="gc-btn" type="button" data-gc-action="craft" data-id="${escapeHtml(recipe.id)}">Craft ngay</button>
      </div>
    `).join("");
  }

  function renderHistory() {
    const entries = state.history.map((entry) => `
      <div class="gc-feed-item">
        <strong>${escapeHtml(entry.title)}</strong>
        <span class="gc-muted">${new Date(entry.playedAt).toLocaleString("vi-VN")} · ${entry.kind === "launch" ? "Đã mở game, chưa có kết quả" : `${safeNumber(entry.score, 0).toLocaleString("vi-VN")} điểm${entry.duration ? ` · ${safeNumber(entry.duration, 0)} phút` : ""}`}</span>
      </div>
    `).join("");
    return entries || `<div class="gc-empty">Chưa có lượt chơi hoàn tất trên thiết bị này.</div>`;
  }

  function renderSeason() {
    const level = state.season.level;
    const claimable = Math.floor(level);
    const claimed = state.season.freeClaimed.length;
    return `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>Season Free</strong>
            <div class="gc-muted">Cấp ${level} · Đã nhận ${claimed} phần thưởng</div>
          </div>
          <span class="gc-pill">${claimable >= 5 ? "Đầy" : "Đang mở"}</span>
        </div>
        ${renderProgressBar(state.season.progress)}
        <div class="gc-card-foot">
          <span class="gc-muted">Tiến độ season ${state.season.progress}%</span>
          <button class="gc-btn gc-btn-primary" type="button" disabled>Thưởng tự động theo XP thật</button>
        </div>
      </div>
    `;
  }

  function renderDailyReward() {
    const claimed = state.dailyReward.lastClaimedDay === todayKey();
    return `
      <div class="gc-feed-item">
        <div class="gc-mission-top">
          <div>
            <strong>Daily reward</strong>
            <div class="gc-muted">Mỗi ngày mở một lần</div>
          </div>
          <span class="gc-pill">${claimed ? "Đã nhận" : "Sẵn sàng"}</span>
        </div>
        <div class="gc-card-foot">
          <span class="gc-muted">${claimed ? "Hẹn mai quay lại" : "Nhận coin, XP và mở rương"}</span>
          <button class="gc-btn gc-btn-primary" type="button" data-gc-action="daily-reward">Nhận ngay</button>
        </div>
      </div>
    `;
  }

  function renderParty() {
    const party = state.party;
    const spectator = state.spectator;
    const connected = state.realtime.status === "connected" && state.realtime.confirmed === true;
    return `
      <div class="gc-party" aria-live="polite">
        <div class="gc-feed-item">
          <div class="gc-mission-top">
            <div>
              <strong>${party.status === "solo" ? "Chưa vào party" : `Party ${escapeHtml(party.roomCode)}`}</strong>
              <div class="gc-muted">${party.mode === "connected" ? "Phòng realtime đã được máy chủ xác nhận" : "Party local · chỉ tồn tại trên thiết bị này"}</div>
            </div>
            <span class="gc-pill">${escapeHtml(party.status)}</span>
          </div>
          <div class="gc-actions">
            <button class="gc-btn" type="button" data-gc-action="create-party-local">Tạo party local</button>
            <button class="gc-btn" type="button" data-gc-action="create-party-online" ${connected ? "" : "disabled"}>Tạo phòng realtime</button>
            ${party.status !== "solo" ? `<button class="gc-btn" type="button" data-gc-action="leave-party">Rời party</button>` : ""}
          </div>
        </div>
        <form class="gc-party-form" data-gc-party-form>
          <label for="gc-room-code">Mã phòng đã được máy chủ cấp</label>
          <div class="gc-party-fields">
            <input id="gc-room-code" name="roomCode" maxlength="20" autocomplete="off" placeholder="VD: HH13AB" ${connected ? "" : "disabled"}>
            <button class="gc-btn" type="submit" name="intent" value="join" ${connected ? "" : "disabled"}>Vào party</button>
            <button class="gc-btn" type="submit" name="intent" value="spectate" ${connected ? "" : "disabled"}>Xem với vai trò khán giả</button>
          </div>
        </form>
        <div class="gc-feed-item">
          <strong>Spectator mode</strong>
          <span class="gc-muted">${spectator.status === "watching" ? `Đang xem phòng ${escapeHtml(spectator.roomCode)}` : "Replay local nằm trong Arcade; xem phòng trực tiếp cần realtime adapter xác nhận."}</span>
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    const level = levelFromXp(state.player.xp);
    const nextXp = xpForLevel(level + 1);
    const currentXp = xpForLevel(level);
    const progress = percent(state.player.xp - currentXp, nextXp - currentXp);
    const onlineCount = state.friends.filter((friend) => friend.online).length;
    const openedChest = state.chest.reward ? `Rương gần nhất: ${state.chest.reward}` : "Rương chờ mở";
    const cloudText = `${state.cloud.label} · ${new Date(state.cloud.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    const realtimeText = `${state.realtime.label} · ${new Date(state.realtime.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;

    return `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-hero">
            <div class="gc-hero-main gc-glass">
              <div class="gc-hero-content">
                <div>
                  <span class="gc-kicker">Game Center · Mini Steam</span>
                  <h1 class="gc-title">HH Game <span>Universe</span></h1>
                  <p class="gc-subtitle">Hồ sơ game, thành tích, nhiệm vụ, sự kiện giới hạn, bạn bè online, daily reward, rương, inventory, crafting và shop coin.</p>
                  <div class="gc-actions">
                    <button class="gc-btn gc-btn-primary" type="button" data-gc-action="continue-last">Tiếp tục: ${escapeHtml(state.player.lastGame)}</button>
                    <button class="gc-btn" type="button" data-gc-action="open-chest">Mở rương</button>
                    <button class="gc-btn" type="button" data-gc-action="daily-reward">Nhận daily reward</button>
                  </div>
                </div>
                <div class="gc-orbit">
                  <div class="gc-orbit-ring"></div>
                  <div class="gc-orbit-ring"></div>
                  <div class="gc-planet">AU</div>
                  <div class="gc-planet">ND</div>
                  <div class="gc-planet">GD</div>
                  <div class="gc-planet">SC</div>
                  <div class="gc-sun">HH</div>
                </div>
              </div>
            </div>
            <aside class="gc-profile gc-glass">
              <div class="gc-profile-card">
                <div class="gc-avatar-row">
                  <div class="gc-avatar">${escapeHtml(state.player.avatar)}</div>
                  <div>
                    <h3>${escapeHtml(state.player.name)}</h3>
                    <div class="gc-muted">Game profile · ${escapeHtml(state.player.favoriteGame)}</div>
                  </div>
                </div>
                <div class="gc-level">
                  <div class="gc-mission-top"><strong>Cấp ${level}</strong><span>${state.player.xp.toLocaleString("vi-VN")} XP</span></div>
                  ${renderProgressBar(progress)}
                  <span class="gc-muted">Còn ${(nextXp - state.player.xp).toLocaleString("vi-VN")} XP để lên cấp.</span>
                </div>
                <div class="gc-stat-grid">
                  <div class="gc-mini-stat"><strong>${state.player.coins}</strong><span class="gc-muted">Coin</span></div>
                  <div class="gc-mini-stat"><strong>${state.player.streak}</strong><span class="gc-muted">Streak</span></div>
                  <div class="gc-mini-stat"><strong>${onlineCount}</strong><span class="gc-muted">Online</span></div>
                </div>
                <span class="gc-pill">${cloudText}</span>
                <span class="gc-pill">${realtimeText}</span>
                <span class="gc-pill">${openedChest}</span>
              </div>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head">
                <div>
                  <span class="gc-kicker">Game nổi bật</span>
                  <h2>Thư viện trò chơi</h2>
                </div>
                <div class="gc-actions" style="margin-top:0">
                  <button class="gc-btn" type="button" data-gc-action="tab" data-tab="library">Xem hết</button>
                  <button class="gc-btn" type="button" data-gc-action="sync">Đồng bộ</button>
                </div>
              </div>
              <div class="gc-card-grid">${renderGames()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Nhiệm vụ ngày</h2><span class="gc-pill">Daily</span></div>
                <div class="gc-missions">${renderMissions(state.missions.daily)}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Nhiệm vụ tuần</h2><span class="gc-pill">Weekly</span></div>
                <div class="gc-missions">${renderMissions(state.missions.weekly)}</div>
              </section>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head"><h2>Sự kiện giới hạn</h2><span class="gc-pill">Limited</span></div>
              <div class="gc-feed">${renderEvents()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Bạn bè online</h2><span class="gc-pill">API/local</span></div>
                <div class="gc-friends">${renderFriends()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Huy hiệu</h2><span class="gc-pill">${state.badges.filter((badge) => badge.unlocked).length}/${state.badges.length}</span></div>
                <div class="gc-badge-row">${renderBadgeList()}</div>
              </section>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head"><h2>Inventory</h2><span class="gc-pill">Equipment</span></div>
              <div class="gc-missions">${renderInventory()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Cửa hàng coin</h2><span class="gc-pill">Shop</span></div>
                <div class="gc-missions">${renderShop()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Crafting</h2><span class="gc-pill">Recipe</span></div>
                <div class="gc-missions">${renderCrafting()}</div>
              </section>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head"><h2>Season Pass free</h2><span class="gc-pill">Lv.${state.season.level}</span></div>
              <div class="gc-missions">${renderSeason()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Lịch sử chơi</h2><span class="gc-pill">History</span></div>
                <div class="gc-feed">${renderHistory()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Cloud & Realtime</h2><span class="gc-pill">${syncIndicator().cloud}</span></div>
                <div class="gc-feed">
                  <div class="gc-feed-item">
                    <strong>Cloud-save</strong>
                    <span class="gc-muted">${cloudText}</span>
                  </div>
                  <div class="gc-feed-item">
                    <strong>Realtime</strong>
                    <span class="gc-muted">${realtimeText}</span>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    `;
  }

  function renderLibrary() {
    const inventoryCount = state.inventory.length;
    return `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-section gc-glass">
            <div class="gc-section-head">
              <div>
                <span class="gc-kicker">Game Center · Library</span>
                <h2>Kho game và bộ sưu tập</h2>
              </div>
              <div class="gc-actions" style="margin-top:0">
                <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Tổng quan</button>
                <button class="gc-btn gc-btn-primary" type="button" data-gc-action="continue-last">Chơi tiếp</button>
              </div>
            </div>
            <div class="gc-card-grid">${renderGames()}</div>
            <div style="height:18px"></div>
            <div class="gc-grid">
              <div class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Inventory (${inventoryCount})</h2><span class="gc-pill">Owned</span></div>
                <div class="gc-missions">${renderInventory()}</div>
              </div>
              <div class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Shop coin</h2><span class="gc-pill">Only coin</span></div>
                <div class="gc-missions">${renderShop()}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderMissionsTab() {
    return `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head">
                <div>
                  <span class="gc-kicker">Missions</span>
                  <h2>Nhiệm vụ và sự kiện</h2>
                </div>
                <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
              </div>
              <div class="gc-missions">${renderMissions(state.missions.daily)}</div>
              <div style="height:14px"></div>
              <div class="gc-missions">${renderMissions(state.missions.weekly)}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Sự kiện giới hạn</h2><span class="gc-pill">Live</span></div>
                <div class="gc-feed">${renderEvents()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Daily reward</h2><span class="gc-pill">Free</span></div>
                <div class="gc-feed">${renderDailyReward()}</div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    `;
  }

  function renderSocialTab() {
    return `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head">
                <div>
                  <span class="gc-kicker">Party & spectator</span>
                  <h2>Phòng chơi có trạng thái xác minh</h2>
                </div>
                <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
              </div>
              ${renderParty()}
              <div style="height:14px"></div>
              <div class="gc-section-head"><h2>Bạn bè</h2><span class="gc-pill">${state.realtime.status === "connected" ? "Provider" : "Local"}</span></div>
              <div class="gc-friends">${renderFriends()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Lịch sử chơi</h2><span class="gc-pill">Recent</span></div>
                <div class="gc-feed">${renderHistory()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Bảng xếp hạng</h2><span class="gc-pill">${escapeHtml(state.leaderboardMeta.label)}</span></div>
                <div class="gc-leaderboard">${renderLeaderboard()}</div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    `;
  }

  function renderPassTab() {
    return `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head">
                <div>
                  <span class="gc-kicker">Season Pass</span>
                  <h2>Season Free và phần thưởng</h2>
                </div>
                <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
              </div>
              <div class="gc-missions">${renderSeason()}</div>
              <div style="height:14px"></div>
              <div class="gc-feed">${renderDailyReward()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Huy hiệu</h2><span class="gc-pill">Badge</span></div>
                <div class="gc-badge-row">${renderBadgeList()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Crafting</h2><span class="gc-pill">Recipes</span></div>
                <div class="gc-missions">${renderCrafting()}</div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    `;
  }

  function renderActiveTab() {
    switch (state.activeTab) {
      case "library":
        return renderLibrary();
      case "missions":
        return renderMissionsTab();
      case "inventory":
        return `
          <div class="hh-game-center">
            <div class="gc-shell">
              <section class="gc-grid">
                <main class="gc-section gc-glass">
                  <div class="gc-section-head">
                    <div>
                      <span class="gc-kicker">Inventory</span>
                      <h2>Trang bị và sưu tập</h2>
                    </div>
                    <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
                  </div>
                  <div class="gc-missions">${renderInventory()}</div>
                </main>
                <aside class="gc-side">
                  <section class="gc-section gc-glass">
                    <div class="gc-section-head"><h2>Shop coin</h2><span class="gc-pill">Only coin</span></div>
                    <div class="gc-missions">${renderShop()}</div>
                  </section>
                  <section class="gc-section gc-glass">
                    <div class="gc-section-head"><h2>Crafting</h2><span class="gc-pill">Forge</span></div>
                    <div class="gc-missions">${renderCrafting()}</div>
                  </section>
                </aside>
              </section>
            </div>
          </div>
        `;
      case "shop":
        return `
          <div class="hh-game-center">
            <div class="gc-shell">
              <section class="gc-grid">
                <main class="gc-section gc-glass">
                  <div class="gc-section-head">
                    <div>
                      <span class="gc-kicker">Shop</span>
                      <h2>Cửa hàng coin trong game</h2>
                    </div>
                    <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
                  </div>
                  <div class="gc-missions">${renderShop()}</div>
                </main>
                <aside class="gc-side">
                  <section class="gc-section gc-glass">
                    <div class="gc-section-head"><h2>Daily reward</h2><span class="gc-pill">Claim</span></div>
                    <div class="gc-feed">${renderDailyReward()}</div>
                  </section>
                  <section class="gc-section gc-glass">
                    <div class="gc-section-head"><h2>Rương</h2><span class="gc-pill">Chest</span></div>
                    <div class="gc-feed">
                      <div class="gc-feed-item">
                        <strong>${state.chest.reward ? state.chest.reward : "Rương chờ mở"}</strong>
                        <span class="gc-muted">${state.chest.available ? "Có thể mở ngay" : "Đã mở hôm nay"}</span>
                      </div>
                      <button class="gc-btn gc-btn-primary" type="button" data-gc-action="open-chest">Mở rương</button>
                    </div>
                  </section>
                </aside>
              </section>
            </div>
          </div>
        `;
      case "pass":
        return renderPassTab();
      case "social":
        return renderSocialTab();
      case "history":
        return `
          <div class="hh-game-center">
            <div class="gc-shell">
              <section class="gc-section gc-glass">
                <div class="gc-section-head">
                  <div>
                    <span class="gc-kicker">History</span>
                    <h2>Lịch sử chơi và tiếp tục đúng game</h2>
                  </div>
                  <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
                </div>
                <div class="gc-actions">
                  <button class="gc-btn gc-btn-primary" type="button" data-gc-action="continue-last">Tiếp tục đúng game gần nhất</button>
                  <button class="gc-btn" type="button" data-gc-action="open-chest">Mở rương</button>
                </div>
                <div style="height:14px"></div>
                <div class="gc-feed">${renderHistory()}</div>
              </section>
            </div>
          </div>
        `;
      default:
        return renderDashboard();
    }
  }

  function render() {
    if (!rootEl || !state) return;
    const level = levelFromXp(state.player.xp);
    const onlineCount = state.friends.filter((friend) => friend.online).length;
    const cloud = state.cloud;
    const realtime = state.realtime;
    const badgeCount = state.badges.filter((badge) => badge.unlocked).length;
    const page = renderActiveTab();

    rootEl.innerHTML = `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-shell-header gc-glass">
            <div>
              <span class="gc-kicker">Game Center · mini Steam</span>
              <h1 class="gc-shell-title">HH Game Universe</h1>
              <p class="gc-subtitle">Hồ sơ game, thành tích, nhiệm vụ ngày/tuần, event giới hạn, bạn bè online, lịch sử chơi, daily reward, rương, inventory, crafting và shop coin.</p>
            </div>
            <div class="gc-shell-meta">
              <span class="gc-pill">Lv.${level}</span>
              <span class="gc-pill">${state.player.xp.toLocaleString("vi-VN")} XP</span>
              <span class="gc-pill">${state.player.coins} coin</span>
              <span class="gc-pill">${onlineCount} online</span>
              <span class="gc-pill">${badgeCount} badge</span>
            </div>
          </section>

          <section class="gc-topbar gc-glass">
            <button class="gc-tab ${state.activeTab === "overview" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="overview">Tổng quan</button>
            <button class="gc-tab ${state.activeTab === "library" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="library">Thư viện</button>
            <button class="gc-tab ${state.activeTab === "missions" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="missions">Nhiệm vụ</button>
            <button class="gc-tab ${state.activeTab === "inventory" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="inventory">Inventory</button>
            <button class="gc-tab ${state.activeTab === "shop" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="shop">Shop</button>
            <button class="gc-tab ${state.activeTab === "pass" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="pass">Season Pass</button>
            <button class="gc-tab ${state.activeTab === "social" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="social">Party & xem</button>
            <button class="gc-tab ${state.activeTab === "history" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="history">Lịch sử</button>
            <div class="gc-shell-right">
              <span class="gc-pill gc-status-${cloud.status}">Cloud: ${escapeHtml(cloud.label)}</span>
              <span class="gc-pill gc-status-${realtime.status}">Realtime: ${escapeHtml(realtime.label)}</span>
            </div>
          </section>
          ${page}
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    rootEl.querySelectorAll("[data-gc-action]").forEach((button) => {
      button.addEventListener("click", onAction);
    });
    rootEl.querySelector("[data-gc-party-form]")?.addEventListener("submit", onPartySubmit);
  }

  function onPartySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = event.submitter;
    const code = form.elements.roomCode?.value || "";
    joinConnectedParty(code, submitter?.value === "spectate");
  }

  function onAction(event) {
    const button = event.currentTarget;
    const action = button.getAttribute("data-gc-action");
    const id = button.getAttribute("data-id");
    const tab = button.getAttribute("data-tab");

    if (action === "tab") {
      state.activeTab = tab || DEFAULT_TAB;
      saveLocal();
      scheduleRender();
      return;
    }
    if (action === "play") {
      openGame(id);
      return;
    }
    if (action === "continue-last") {
      continueLastGame();
      return;
    }
    if (action === "open-chest") {
      openChest();
      return;
    }
    if (action === "daily-reward") {
      claimDailyReward();
      return;
    }
    if (action === "sync") {
      syncCloud("save");
      syncRealtime();
      showToast("Đang yêu cầu adapter xác nhận kết nối...", "info");
      return;
    }
    if (action === "claim-mission") {
      showToast("Tiến độ nhiệm vụ chỉ tăng từ kết quả game thật.", "info");
      return;
    }
    if (action === "reward-event") {
      const eventItem = state.events.find((entry) => entry.id === id);
      if (!eventItem || eventItem.completed !== true || eventItem.claimed === true) {
        showToast("Cần kết quả sự kiện đã được game hoặc adapter xác nhận.", "warn");
        return;
      }
      eventItem.claimed = true;
      rewardPlayer({ xp: eventItem.reward.xp, coins: eventItem.reward.coins, reason: `Nhận thưởng từ sự kiện ${eventItem.title}.` });
      showToast(`Đã nhận thưởng sự kiện: ${eventItem.title}`, "success");
      return;
    }
    if (action === "equip") {
      equipItem(id);
      saveLocal();
      scheduleRender();
      return;
    }
    if (action === "buy") {
      buyItem(id);
      return;
    }
    if (action === "craft") {
      craft(id);
      return;
    }
    if (action === "claim-season") {
      showToast("Season chỉ tăng theo XP từ lượt chơi đã hoàn tất.", "info");
      return;
    }
    if (action === "create-party-local") {
      createLocalParty();
      return;
    }
    if (action === "create-party-online") {
      createConnectedParty();
      return;
    }
    if (action === "leave-party") {
      leaveParty();
    }
  }

  function mount(host, opts = {}) {
    if (!host) throw new Error("HHGameCenter.mount cần host element.");
    unmount();
    hostEl = host;
    settings = opts || {};
    state = normalizeState(loadLocal());
    if (typeof opts.navigate === "function") settings.navigate = opts.navigate;
    if (settings.currentUser) {
      state.player.name = settings.currentUser.displayName || settings.currentUser.name || state.player.name;
      state.player.avatar = initials(settings.currentUser.displayName || settings.currentUser.name || state.player.name);
    }
    if (state.activeTab == null) state.activeTab = DEFAULT_TAB;
    state.player.lastRoute ||= "/entertainment/astra-hh";
    state.player.lastGame ||= "HH Astra Universe";
    if (state.dailyMissionDay !== todayKey()) {
      state.dailyMissionDay = todayKey();
      state.missions.daily = DAILY_MISSIONS.map((item) => ({ ...item, progress: 0 }));
    }
    if (state.weeklyMissionWeek !== weekKey()) {
      state.weeklyMissionWeek = weekKey();
      state.missions.weekly = WEEKLY_MISSIONS.map((item) => ({ ...item, progress: 0 }));
    }
    if (state.season.id !== seasonKey() && state.season.source === "local-device") state.season = defaultState().season;
    state.lastVisit = state.lastVisit || todayKey();
    if (state.lastVisit !== todayKey()) {
      state.lastVisit = todayKey();
      state.player.streak += 1;
      completeMission("daily-login", 1);
    }
    completeMission("daily-login", 1);
    rewardListener = (event) => {
      const payload = event?.detail || {};
      const rawGameId = cleanId(payload.gameId || payload.game, "astra-hh");
      const game = state.games.find((item) => item.id === rawGameId);
      rewardPlayer({
        gameId: rawGameId,
        gameTitle: game?.title || cleanText(payload.gameTitle || rawGameId, 80),
        xp: safeNumber(payload.xp, 0, 100000, 0),
        coins: safeNumber(payload.coins, 0, 100000, 0),
        score: safeNumber(payload.score, 0),
        duration: safeNumber(payload.duration, 0, 1440, 0),
        reason: payload.reason ? cleanText(payload.reason, 160) : `Nhận kết quả từ ${game?.title || rawGameId}.`
      });
    };
    window.addEventListener("hh:game-reward", rewardListener);
    sessionListener = (event) => {
      const replay = event?.detail;
      if (!replay || replay.schema !== "hh.game.replay.v1") return;
      state.replays.unshift({ schema: "hh.game.replay.v1", gameId: cleanId(replay.gameId), score: safeNumber(replay.score, 0), duration: safeNumber(replay.duration, 0, 1440), createdAt: cleanText(replay.createdAt, 40) });
      state.replays = state.replays.slice(0, 8);
      saveLocal();
    };
    window.addEventListener("hh:game-session", sessionListener);
    saveLocal();
    hostEl.innerHTML = "";
    rootEl = document.createElement("div");
    rootEl.className = "hh-game-center-root";
    hostEl.appendChild(rootEl);
    render();
    syncCloud("load");
    syncRealtime();
    window.dispatchEvent(new CustomEvent("hh:game-center-ready", { detail: { games: state.games.length, inventory: state.inventory.length } }));
    window.dispatchEvent(new CustomEvent("hh:game-center-mounted", { detail: inspect() }));
  }

  function unmount() {
    if (rewardListener) window.removeEventListener("hh:game-reward", rewardListener);
    if (sessionListener) window.removeEventListener("hh:game-session", sessionListener);
    rewardListener = null;
    sessionListener = null;
    if (hostEl) hostEl.replaceChildren();
    hostEl = null;
    rootEl = null;
    settings = {};
  }

  function inspect() {
    return {
      mounted: Boolean(rootEl),
      tab: state?.activeTab || DEFAULT_TAB,
      schema: SCHEMA,
      version: INTEGRATION_VERSION,
      storageKey: STORAGE_KEY,
      player: state?.player || null,
      missions: state?.missions || null,
      inventory: state?.inventory || [],
      equipment: state?.equipment || {},
      cloud: state?.cloud || null,
      realtime: state?.realtime || null,
      leaderboard: { meta: state?.leaderboardMeta || null, entries: state?.leaderboard || [] },
      party: state?.party || null,
      spectator: state?.spectator || null,
      history: state?.history || [],
      games: state?.games?.map((game) => ({ id: game.id, route: game.route })) || []
    };
  }

  window.HHGameCenter = { mount, unmount, inspect };
})();
