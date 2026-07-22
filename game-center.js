(function () {
  "use strict";

  const STORAGE_KEY = "hh.game.center.profile.v2";
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
      subtitle: "Sự kiện giới hạn",
      status: "Đang mở",
      duration: "Còn 3 ngày",
      description: "Hạ boss sự kiện để mở rương vàng, trail thiên thạch và skin tàu độc quyền.",
      reward: { coins: 140, xp: 220 }
    },
    {
      id: "event-neon-cup",
      title: "Neon Cup",
      subtitle: "Giải đấu tuần",
      status: "Mở đăng ký",
      duration: "Bắt đầu thứ Sáu",
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

  const DEFAULT_FRIENDS = [
    { name: "Music Studio", status: "Đang trong lobby", online: true },
    { name: "AI Creator", status: "Đang chơi thử", online: true },
    { name: "Neon Member", status: "Offline 12 phút", online: false },
    { name: "Team Collab", status: "Đang co-op", online: true }
  ];

  let hostEl = null;
  let rootEl = null;
  let settings = {};
  let state = null;
  let rewardListener = null;
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

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // invalid local state should not block lobby
    }
    return null;
  }

  function defaultState() {
    const user = settings.currentUser || {};
    return {
      version: 2,
      player: {
        name: user.displayName || user.name || user.username || "Dũng Nguyễn",
        avatar: initials(user.displayName || user.name || "HH Gamer"),
        frame: "frame-violet",
        pet: "pet-microbot",
        skin: "skin-lunar",
        trail: "trail-starlight",
        favoriteGame: "HH Astra Universe",
        lastRoute: "/entertainment/astra-hh",
        lastGame: "HH Astra Universe",
        xp: 420,
        coins: 260,
        streak: 2
      },
      activeTab: DEFAULT_TAB,
      games: clone(CATALOG),
      missions: {
        daily: DAILY_MISSIONS.map((item) => ({ ...item, progress: item.id === "daily-login" ? 1 : 0 })),
        weekly: WEEKLY_MISSIONS.map((item) => ({ ...item, progress: 0 }))
      },
      events: clone(FEATURED_EVENTS),
      badges: clone(BADGES),
      inventory: [
        { id: "default-skin", type: "skin", title: "Genesis", rarity: "Starter", color: "#61f4ff" }
      ],
      equipment: { skin: "skin-lunar", trail: "trail-starlight", avatarFrame: "frame-violet", pet: "pet-microbot" },
      shopHistory: [],
      chest: { available: true, lastOpened: null, reward: null },
      season: { level: 1, progress: 0, freeClaimed: [] },
      crafting: [],
      friends: clone(DEFAULT_FRIENDS),
      activity: [
        { time: "Hôm nay", text: "Mở Game Center và sẵn sàng nhận nhiệm vụ." },
        { time: "Tuần này", text: "HH Astra Universe đã trở thành highlight MMO RPG." }
      ],
      leaderboard: [
        { name: "Hoàng Đại Ka", level: 9, xp: 4200, game: "HH Astra Universe" },
        { name: "Astra Pilot", level: 7, xp: 3180, game: "Neon Drift" },
        { name: "Neon Maker", level: 6, xp: 2740, game: "Galaxy Defense" },
        { name: "Star Builder", level: 5, xp: 2180, game: "Star Colony" }
      ],
      cloud: { status: "local", label: "Đang dùng lưu local", updatedAt: new Date().toISOString() },
      realtime: { status: "local", label: "Realtime chưa kết nối", updatedAt: new Date().toISOString() },
      playedGames: ["astra-hh"],
      history: [{ id: "astra-hh", title: "HH Astra Universe", playedAt: new Date().toISOString(), duration: 12 }]
    };
  }

  function normalizeState(saved) {
    const base = defaultState();
    if (!saved) return base;
    const inventory = Array.isArray(saved.inventory) && saved.inventory.length ? saved.inventory : base.inventory;
    const equipment = { ...base.equipment, ...(saved.equipment || {}) };
    return {
      ...base,
      ...saved,
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
      season: {
        ...base.season,
        ...(saved.season || {}),
        freeClaimed: Array.isArray(saved.season?.freeClaimed) ? saved.season.freeClaimed : base.season.freeClaimed
      },
      crafting: Array.isArray(saved.crafting) ? saved.crafting : base.crafting,
      friends: Array.isArray(saved.friends) && saved.friends.length ? saved.friends : base.friends,
      activity: Array.isArray(saved.activity) && saved.activity.length ? saved.activity : base.activity,
      leaderboard: Array.isArray(saved.leaderboard) && saved.leaderboard.length ? saved.leaderboard : base.leaderboard,
      cloud: { ...base.cloud, ...(saved.cloud || {}) },
      realtime: { ...base.realtime, ...(saved.realtime || {}) },
      playedGames: Array.isArray(saved.playedGames) ? saved.playedGames : base.playedGames,
      history: Array.isArray(saved.history) && saved.history.length ? saved.history : base.history
    };
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  async function syncCloud(mode) {
    if (!settings.apiBase || !state) return false;
    const base = String(settings.apiBase).replace(/\/$/, "");
    try {
      if (mode === "load") {
        const response = await fetch(`${base}${API_PATH}/profile`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          if (data && data.profile) {
            state = normalizeState({ ...state, ...data.profile, cloud: { status: "online", label: "Đã đồng bộ cloud", updatedAt: new Date().toISOString() } });
            saveLocal();
            scheduleRender();
            return true;
          }
        }
      } else {
        const response = await fetch(`${base}${API_PATH}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ profile: state })
        });
        if (response.ok) {
          state.cloud = { status: "online", label: "Đã lưu cloud", updatedAt: new Date().toISOString() };
          saveLocal();
          scheduleRender();
          return true;
        }
      }
    } catch {
      state.cloud = { status: "local", label: "Cloud chưa kết nối, vẫn lưu local", updatedAt: new Date().toISOString() };
      saveLocal();
    }
    return false;
  }

  async function syncRealtime() {
    if (!settings.socketUrl) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const response = await fetch(String(settings.socketUrl).replace(/\/$/, ""), { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        state.realtime = { status: "online", label: "Realtime sẵn sàng", updatedAt: new Date().toISOString() };
        saveLocal();
        scheduleRender();
        return true;
      }
    } catch {
      state.realtime = { status: "local", label: "Realtime fallback local", updatedAt: new Date().toISOString() };
      saveLocal();
    }
    return false;
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
      rewardPlayer({ xp: mission.xp, coins: mission.coins, source: `Nhiệm vụ ${mission.title}` });
      showToast(`Hoàn thành: ${mission.title}`, "success");
      return true;
    }
    return false;
  }

  function rewardPlayer(payload = {}) {
    const xp = Math.max(0, Number(payload.xp || 0));
    const coins = Math.max(0, Number(payload.coins || 0));
    if (!xp && !coins) return;
    state.player.xp += xp;
    state.player.coins += coins;
    if (payload.streak) state.player.streak += payload.streak;
    if (payload.reason) addActivity(payload.reason);
    if (payload.gameId) {
      const game = state.games.find((item) => item.id === payload.gameId) || state.games[0];
      state.player.lastGame = game.title;
      state.player.lastRoute = game.route;
      if (!state.playedGames.includes(game.id)) state.playedGames.push(game.id);
      state.history.unshift({ id: game.id, title: game.title, playedAt: new Date().toISOString(), duration: 12 });
      state.history = state.history.slice(0, 8);
      addActivity(`Nhận ${xp} XP từ ${game.title}.`);
    }
    if (payload.gameId === "astra-hh") completeMission("daily-play-astra", 1);
    completeMission("weekly-xp", xp);
    unlockBadges();
    saveLocal();
    syncCloud("save");
    scheduleRender();
    window.dispatchEvent(new CustomEvent("hh:game-center-updated", { detail: inspect() }));
  }

  function openGame(gameId) {
    const game = state.games.find((item) => item.id === gameId) || state.games[0];
    rewardPlayer({
      gameId: game.id,
      xp: Math.max(12, game.reward.xp / 3),
      coins: Math.max(6, Math.round(game.reward.coins / 3)),
      reason: `Mở ${game.title}.`
    });
    state.player.lastGame = game.title;
    state.player.lastRoute = game.route;
    completeMission("daily-login", 1);
    if (game.id === "astra-hh") completeMission("daily-play-astra", 1);
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
    const key = `hh.game.center.daily.${todayKey()}`;
    if (localStorage.getItem(key)) {
      showToast("Bạn đã nhận daily reward hôm nay.", "warn");
      return;
    }
    localStorage.setItem(key, "1");
    state.chest.available = true;
    rewardPlayer({ xp: 60, coins: 50, streak: 1, reason: "Nhận daily reward." });
    showToast("Nhận daily reward thành công", "success");
  }

  function progressSeason(amount = 1) {
    state.season.progress += amount;
    while (state.season.progress >= 100 && state.season.level < 5) {
      state.season.progress -= 100;
      state.season.level += 1;
      const claimId = `season-${state.season.level}`;
      if (!state.season.freeClaimed.includes(claimId)) state.season.freeClaimed.push(claimId);
      rewardPlayer({ xp: 90, coins: 35, reason: `Mở cấp Season Pass free ${state.season.level}.` });
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
          <button class="gc-btn" type="button" data-gc-action="claim-mission" data-id="${escapeHtml(mission.id)}">Nhận</button>
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
        <button class="gc-btn" type="button" data-gc-action="reward-event" data-id="${escapeHtml(event.id)}">Nhận thưởng sự kiện</button>
      </div>
    `).join("");
  }

  function renderLeaderboard() {
    return state.leaderboard
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
          <strong>${Number(item.xp).toLocaleString("vi-VN")}</strong>
        </div>
      `).join("");
  }

  function renderFriends() {
    return state.friends.map((friend) => `
      <div class="gc-friend">
        <div>
          <strong>${escapeHtml(friend.name)}</strong>
          <div class="gc-muted">${escapeHtml(friend.status)}</div>
        </div>
        <span class="gc-pill" style="color:${friend.online ? "var(--gc-green)" : "var(--gc-muted)"}">${friend.online ? "Online" : "Offline"}</span>
      </div>
    `).join("");
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
    return state.history.map((entry) => `
      <div class="gc-feed-item">
        <strong>${escapeHtml(entry.title)}</strong>
        <span class="gc-muted">${new Date(entry.playedAt).toLocaleString("vi-VN")} · ${entry.duration} phút</span>
      </div>
    `).join("");
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
          <button class="gc-btn gc-btn-primary" type="button" data-gc-action="claim-season">Nhận cấp</button>
        </div>
      </div>
    `;
  }

  function renderDailyReward() {
    const key = `hh.game.center.daily.${todayKey()}`;
    const claimed = Boolean(localStorage.getItem(key));
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
                  <span class="gc-kicker">Friends</span>
                  <h2>Bạn bè online và lịch sử chơi</h2>
                </div>
                <button class="gc-btn" type="button" data-gc-action="tab" data-tab="overview">Quay lại</button>
              </div>
              <div class="gc-friends">${renderFriends()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Lịch sử chơi</h2><span class="gc-pill">Recent</span></div>
                <div class="gc-feed">${renderHistory()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Bảng xếp hạng</h2><span class="gc-pill">Top</span></div>
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
            <button class="gc-tab ${state.activeTab === "social" ? "is-active" : ""}" type="button" data-gc-action="tab" data-tab="social">Bạn bè</button>
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
      state.cloud = { status: "syncing", label: "Đang đồng bộ...", updatedAt: new Date().toISOString() };
      state.realtime = { status: "syncing", label: "Đang ping realtime...", updatedAt: new Date().toISOString() };
      saveLocal();
      scheduleRender();
      syncCloud("save");
      syncRealtime();
      showToast("Đang đồng bộ cloud/realtime...", "info");
      return;
    }
    if (action === "claim-mission") {
      const mission = missionById(id);
      if (!mission) return;
      if (mission.progress < mission.target) {
        const delta = mission.target === 1 ? 1 : Math.max(1, Math.round(mission.target / 2));
        if (completeMission(id, delta)) progressSeason(20);
        else {
          mission.progress = Math.min(mission.target, mission.progress + delta);
          saveLocal();
          scheduleRender();
          showToast(`Đã cộng tiến độ cho ${mission.title}`, "info");
        }
      } else {
        showToast("Nhiệm vụ này đã hoàn thành.", "warn");
      }
      return;
    }
    if (action === "reward-event") {
      const eventItem = state.events.find((entry) => entry.id === id);
      if (!eventItem) return;
      rewardPlayer({ xp: eventItem.reward.xp, coins: eventItem.reward.coins, reason: `Nhận thưởng từ sự kiện ${eventItem.title}.` });
      progressSeason(15);
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
      progressSeason(25);
      saveLocal();
      scheduleRender();
      showToast("Season Pass đã tiến thêm", "success");
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
    state.lastVisit = state.lastVisit || todayKey();
    if (state.lastVisit !== todayKey()) {
      state.lastVisit = todayKey();
      state.player.streak += 1;
      completeMission("daily-login", 1);
    }
    rewardListener = (event) => {
      const payload = event?.detail || {};
      const game = state.games.find((item) => item.id === String(payload.gameId || payload.game || "astra-hh")) || state.games[0];
      rewardPlayer({
        gameId: game.id,
        xp: Number(payload.xp || game.reward.xp),
        coins: Number(payload.coins || game.reward.coins),
        reason: payload.reason ? String(payload.reason) : `Nhận thưởng từ ${game.title}.`
      });
    };
    window.addEventListener("hh:game-reward", rewardListener);
    state.cloud = { ...state.cloud, label: state.cloud.label || "Đang dùng lưu local" };
    state.realtime = { ...state.realtime, label: state.realtime.label || "Realtime fallback local" };
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
    rewardListener = null;
    if (hostEl) hostEl.replaceChildren();
    hostEl = null;
    rootEl = null;
    settings = {};
  }

  function inspect() {
    return {
      mounted: Boolean(rootEl),
      tab: state?.activeTab || DEFAULT_TAB,
      storageKey: STORAGE_KEY,
      player: state?.player || null,
      missions: state?.missions || null,
      inventory: state?.inventory || [],
      equipment: state?.equipment || {},
      cloud: state?.cloud || null,
      realtime: state?.realtime || null,
      history: state?.history || [],
      games: state?.games?.map((game) => ({ id: game.id, route: game.route })) || []
    };
  }

  window.HHGameCenter = { mount, unmount, inspect };
})();
