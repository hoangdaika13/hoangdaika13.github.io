(function () {
  "use strict";

  const STORAGE_KEY = "hh.game.center.profile.v1";
  const API_PATH = "/api/games";

  const GAME_LIBRARY = [
    {
      id: "astra-hh",
      title: "HH Astra Universe",
      short: "AU",
      route: "/entertainment/astra-hh",
      genre: "MMO RPG vũ trụ",
      color: "#61f4ff",
      status: "Đang phát triển realtime",
      description: "Khám phá thiên hà, chế tạo tàu, chiến đấu boss, khai khoáng, giao thương, xây căn cứ và co-op 2-10 người.",
      tags: ["MMO RPG", "Co-op", "Boss", "Crafting"],
      xpReward: 180
    },
    {
      id: "neon-drift",
      title: "Neon Drift",
      short: "ND",
      route: "/entertainment/arcade?game=neon-drift",
      genre: "Đua tàu tốc độ",
      color: "#ff63c7",
      status: "Arcade",
      description: "Lái tàu qua đường đua neon, boost năng lượng, né thiên thạch và săn kỷ lục hằng ngày.",
      tags: ["Speed", "Combo", "Rank"],
      xpReward: 70
    },
    {
      id: "galaxy-defense",
      title: "Galaxy Defense",
      short: "GD",
      route: "/entertainment/arcade?game=galaxy-defense",
      genre: "Thủ thành",
      color: "#ffe37a",
      status: "Arcade",
      description: "Đặt trụ plasma, nâng cấp laser và bảo vệ căn cứ trước các đợt tấn công ngoài hành tinh.",
      tags: ["Tower", "Strategy", "Wave"],
      xpReward: 75
    },
    {
      id: "star-colony",
      title: "Star Colony",
      short: "SC",
      route: "/entertainment/arcade?game=star-colony",
      genre: "Xây dựng thuộc địa",
      color: "#74f2a9",
      status: "Arcade",
      description: "Quản lý oxy, dân cư, năng lượng, khai thác và mở rộng thuộc địa trên hành tinh xa.",
      tags: ["Builder", "Economy", "Survival"],
      xpReward: 80
    },
    {
      id: "cipher-run",
      title: "Cipher Run",
      short: "CR",
      route: "/entertainment/arcade?game=cipher-run",
      genre: "Giải đố mật mã",
      color: "#a98bff",
      status: "Arcade",
      description: "Giải khóa hệ thống cổ đại bằng logic, pattern, mã hóa giả lập và phản xạ nhanh.",
      tags: ["Puzzle", "Code", "Logic"],
      xpReward: 65
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
      xpReward: 95
    }
  ];

  const DEFAULT_MISSIONS = [
    { id: "daily-login", type: "daily", title: "Điểm danh phi hành đoàn", target: 1, progress: 0, xp: 40 },
    { id: "play-astra", type: "daily", title: "Chơi HH Astra Universe", target: 1, progress: 0, xp: 120 },
    { id: "earn-xp", type: "weekly", title: "Kiếm 600 XP trong tuần", target: 600, progress: 0, xp: 240 },
    { id: "try-three-games", type: "weekly", title: "Thử 3 game khác nhau", target: 3, progress: 0, xp: 180 }
  ];

  const DEFAULT_BADGES = [
    { id: "captain", title: "Thuyền trưởng HH", text: "Đạt cấp 3 trong Game Center.", unlocked: false },
    { id: "astra-founder", title: "Astra Founder", text: "Vào HH Astra Universe lần đầu.", unlocked: false },
    { id: "weekly-runner", title: "Chuỗi tuần", text: "Hoàn thành một nhiệm vụ tuần.", unlocked: false },
    { id: "social-pilot", title: "Phi công đội", text: "Tham gia phòng hoặc co-op.", unlocked: false }
  ];

  const DEFAULT_LEADERBOARD = [
    { name: "Hoàng Đại Ka", level: 9, xp: 4200, game: "HH Astra Universe" },
    { name: "Astra Pilot", level: 7, xp: 3180, game: "Neon Drift" },
    { name: "Neon Maker", level: 6, xp: 2740, game: "Galaxy Defense" },
    { name: "Star Builder", level: 5, xp: 2180, game: "Star Colony" }
  ];

  const DEFAULT_FRIENDS = [
    { name: "Music Studio", status: "Đang trong lobby", online: true },
    { name: "AI Creator", status: "Đang chơi thử", online: true },
    { name: "Neon Member", status: "Offline 12 phút", online: false }
  ];

  let root = null;
  let options = {};
  let state = null;
  let rewardListener = null;
  let mountedHost = null;
  let toastTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getLevel(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
  }

  function xpForNext(level) {
    return Math.pow(level, 2) * 120;
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Corrupt local data should not block the game lobby.
    }
    return null;
  }

  function baseState() {
    const user = options.currentUser || {};
    return {
      player: {
        name: user.displayName || user.name || user.username || "Dũng Nguyễn",
        avatar: initials(user.displayName || user.name || "HH Gamer"),
        xp: 320,
        coins: 180,
        streak: 1,
        favoriteGame: "HH Astra Universe",
        lastRoute: "/entertainment/astra-hh",
        lastGame: "HH Astra Universe"
      },
      games: clone(GAME_LIBRARY),
      missions: clone(DEFAULT_MISSIONS),
      badges: clone(DEFAULT_BADGES),
      leaderboard: clone(DEFAULT_LEADERBOARD),
      friends: clone(DEFAULT_FRIENDS),
      activity: [
        { time: "Hôm nay", text: "Mở Game Center và sẵn sàng nhận nhiệm vụ." },
        { time: "Tuần này", text: "HH Astra Universe đã mở chế độ MMO RPG highlight." }
      ],
      cloud: { status: "local", label: "Đang dùng lưu local", updatedAt: new Date().toISOString() },
      lastVisit: todayKey(),
      playedGames: []
    };
  }

  function mergeState(saved) {
    const fallback = baseState();
    if (!saved) return fallback;
    return {
      ...fallback,
      ...saved,
      player: { ...fallback.player, ...(saved.player || {}) },
      games: fallback.games,
      missions: mergeById(fallback.missions, saved.missions),
      badges: mergeById(fallback.badges, saved.badges),
      leaderboard: Array.isArray(saved.leaderboard) && saved.leaderboard.length ? saved.leaderboard : fallback.leaderboard,
      friends: Array.isArray(saved.friends) && saved.friends.length ? saved.friends : fallback.friends,
      activity: Array.isArray(saved.activity) && saved.activity.length ? saved.activity : fallback.activity,
      cloud: { ...fallback.cloud, ...(saved.cloud || {}) },
      playedGames: Array.isArray(saved.playedGames) ? saved.playedGames : []
    };
  }

  function mergeById(base, saved) {
    const savedMap = new Map((Array.isArray(saved) ? saved : []).map((item) => [item.id, item]));
    return base.map((item) => ({ ...item, ...(savedMap.get(item.id) || {}) }));
  }

  function saveLocal() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      state.cloud = { status: "error", label: "Không thể lưu local", updatedAt: new Date().toISOString() };
    }
  }

  async function syncCloud(mode) {
    if (!options.apiBase || !state) return false;
    const base = String(options.apiBase).replace(/\/$/, "");
    try {
      if (mode === "load") {
        const response = await fetch(`${base}${API_PATH}/profile`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          if (data && data.profile) {
            state = mergeState({ ...state, ...data.profile, cloud: { status: "online", label: "Đã đồng bộ cloud", updatedAt: new Date().toISOString() } });
            saveLocal();
            render();
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
          render();
          return true;
        }
      }
    } catch {
      state.cloud = { status: "local", label: "Cloud chưa kết nối, vẫn lưu local", updatedAt: new Date().toISOString() };
      saveLocal();
    }
    return false;
  }

  function initials(name) {
    return String(name || "HH")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HH";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function percent(progress, target) {
    if (!target) return 0;
    return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
  }

  function navigate(route) {
    if (typeof options.navigate === "function") options.navigate(route);
    else if (route) window.location.hash = `#${route}`;
  }

  function addActivity(text) {
    state.activity.unshift({ time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }), text });
    state.activity = state.activity.slice(0, 8);
  }

  function completeProgress(missionId, amount) {
    const mission = state.missions.find((item) => item.id === missionId);
    if (!mission) return false;
    const wasDone = mission.progress >= mission.target;
    mission.progress = Math.min(mission.target, Math.max(0, mission.progress + amount));
    if (!wasDone && mission.progress >= mission.target) {
      state.player.xp += mission.xp;
      state.player.coins += Math.round(mission.xp / 4);
      addActivity(`Hoàn thành nhiệm vụ "${mission.title}" và nhận ${mission.xp} XP.`);
      showToast(`Nhiệm vụ hoàn thành: ${mission.title} +${mission.xp} XP`);
      unlockBadges();
      return true;
    }
    return false;
  }

  function unlockBadges() {
    const level = getLevel(state.player.xp);
    const unlock = (id, condition) => {
      const badge = state.badges.find((item) => item.id === id);
      if (badge && !badge.unlocked && condition) {
        badge.unlocked = true;
        addActivity(`Mở huy hiệu "${badge.title}".`);
      }
    };
    unlock("captain", level >= 3);
    unlock("astra-founder", state.playedGames.includes("astra-hh"));
    unlock("weekly-runner", state.missions.some((item) => item.type === "weekly" && item.progress >= item.target));
    unlock("social-pilot", state.friends.some((item) => item.online));
  }

  function applyReward(detail) {
    if (!state) return;
    const payload = detail && typeof detail === "object" ? detail : {};
    const gameId = String(payload.gameId || payload.game || "astra-hh");
    const game = state.games.find((item) => item.id === gameId) || state.games[0];
    const xp = Math.max(10, Number(payload.xp || game.xpReward || 50));
    const score = Math.max(0, Number(payload.score || 0));
    state.player.xp += xp;
    state.player.coins += Math.max(5, Math.round(xp / 5));
    state.player.lastGame = game.title;
    state.player.lastRoute = game.route;
    if (!state.playedGames.includes(game.id)) state.playedGames.push(game.id);
    completeProgress("earn-xp", xp);
    completeProgress("try-three-games", state.playedGames.length > 1 ? 1 : 0);
    if (game.id === "astra-hh") completeProgress("play-astra", 1);
    if (score > 0) {
      state.leaderboard.push({ name: state.player.name, level: getLevel(state.player.xp), xp: state.player.xp, game: game.title });
      state.leaderboard = state.leaderboard.sort((a, b) => b.xp - a.xp).slice(0, 10);
    }
    addActivity(`Nhận ${xp} XP từ ${game.title}.`);
    unlockBadges();
    saveLocal();
    syncCloud("save");
    render();
    showToast(`+${xp} XP từ ${game.title}`);
  }

  function startGame(gameId) {
    const game = state.games.find((item) => item.id === gameId) || state.games[0];
    state.player.lastGame = game.title;
    state.player.lastRoute = game.route;
    if (!state.playedGames.includes(game.id)) state.playedGames.push(game.id);
    if (state.lastVisit !== todayKey()) {
      state.lastVisit = todayKey();
      state.player.streak += 1;
      completeProgress("daily-login", 1);
    }
    if (game.id === "astra-hh") completeProgress("play-astra", 1);
    addActivity(`Mở ${game.title}.`);
    unlockBadges();
    saveLocal();
    syncCloud("save");
    render();
    navigate(game.route);
  }

  function quickReward() {
    window.dispatchEvent(new CustomEvent("hh:game-reward", {
      detail: { gameId: "astra-hh", xp: 90, score: 900, reason: "game-center-boost" }
    }));
  }

  function showToast(message) {
    if (!root) return;
    let toast = document.querySelector(".gc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "gc-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderGames() {
    return state.games.map((game) => `
      <article class="gc-card" style="--game-color:${game.color}">
        <div class="gc-card-icon">${escapeHtml(game.short)}</div>
        <p class="gc-pill">${escapeHtml(game.genre)} · ${escapeHtml(game.status)}</p>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.description)}</p>
        <div class="gc-card-foot">
          <span class="gc-pill">${game.tags.map(escapeHtml).join("</span><span class=\"gc-pill\">")}</span>
          <button class="gc-btn gc-btn-primary" type="button" data-gc-play="${escapeHtml(game.id)}">Chơi</button>
        </div>
      </article>
    `).join("");
  }

  function renderMissions(type) {
    const missions = state.missions.filter((mission) => mission.type === type);
    return missions.map((mission) => {
      const value = percent(mission.progress, mission.target);
      return `
        <div class="gc-mission">
          <div class="gc-mission-top">
            <strong>${escapeHtml(mission.title)}</strong>
            <span class="gc-pill">+${mission.xp} XP</span>
          </div>
          <div class="gc-progress"><span style="width:${value}%"></span></div>
          <span class="gc-muted">${mission.progress}/${mission.target} · ${value}% hoàn thành</span>
        </div>
      `;
    }).join("");
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
    return (state.friends.length ? state.friends : DEFAULT_FRIENDS).map((friend) => `
      <div class="gc-friend">
        <div>
          <strong>${escapeHtml(friend.name)}</strong>
          <div class="gc-muted">${escapeHtml(friend.status)}</div>
        </div>
        <span class="gc-pill" style="color:${friend.online ? "var(--gc-green)" : "var(--gc-muted)"}">${friend.online ? "Online" : "Offline"}</span>
      </div>
    `).join("");
  }

  function renderBadges() {
    return state.badges.map((badge) => `
      <div class="gc-badge ${badge.unlocked ? "" : "is-locked"}">
        <strong>${badge.unlocked ? "Đã mở" : "Đang khóa"} · ${escapeHtml(badge.title)}</strong>
        <span class="gc-muted">${escapeHtml(badge.text)}</span>
      </div>
    `).join("");
  }

  function renderActivity() {
    return state.activity.map((item) => `
      <div class="gc-feed-item">
        <strong>${escapeHtml(item.time)}</strong>
        <span class="gc-muted">${escapeHtml(item.text)}</span>
      </div>
    `).join("");
  }

  function render() {
    if (!root || !state) return;
    const level = getLevel(state.player.xp);
    const currentLevelFloor = xpForNext(level - 1);
    const next = xpForNext(level);
    const levelPercent = percent(state.player.xp - currentLevelFloor, next - currentLevelFloor);
    const onlineCount = state.friends.filter((friend) => friend.online).length;

    root.innerHTML = `
      <div class="hh-game-center">
        <div class="gc-shell">
          <section class="gc-hero">
            <div class="gc-hero-main gc-glass">
              <div class="gc-hero-content">
                <div>
                  <span class="gc-kicker">Game Center · Giải trí chỉ có game</span>
                  <h1 class="gc-title">HH Game <span>Universe</span></h1>
                  <p class="gc-subtitle">Sảnh game trung tâm cho HH: hồ sơ game, XP, huy hiệu, nhiệm vụ, bảng xếp hạng, bạn bè online và điểm nhấn MMO RPG HH Astra Universe.</p>
                  <div class="gc-actions">
                    <button class="gc-btn gc-btn-primary" type="button" data-gc-play="astra-hh">Vào HH Astra Universe</button>
                    <button class="gc-btn" type="button" data-gc-continue>Tiếp tục: ${escapeHtml(state.player.lastGame)}</button>
                    <button class="gc-btn" type="button" data-gc-boost>Nhận thưởng demo</button>
                  </div>
                </div>
                <div class="gc-orbit" aria-label="Các game quay quanh HH">
                  <div class="gc-orbit-ring"></div>
                  <div class="gc-orbit-ring"></div>
                  <div class="gc-planet">AI</div>
                  <div class="gc-planet">RPG</div>
                  <div class="gc-planet">COOP</div>
                  <div class="gc-planet">PVP</div>
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
                  <div class="gc-progress"><span style="width:${levelPercent}%"></span></div>
                  <span class="gc-muted">Còn ${Math.max(0, next - state.player.xp).toLocaleString("vi-VN")} XP để lên cấp.</span>
                </div>
                <div class="gc-stat-grid">
                  <div class="gc-mini-stat"><strong>${state.player.coins}</strong><span class="gc-muted">Xu HH</span></div>
                  <div class="gc-mini-stat"><strong>${state.player.streak}</strong><span class="gc-muted">Streak</span></div>
                  <div class="gc-mini-stat"><strong>${onlineCount}</strong><span class="gc-muted">Online</span></div>
                </div>
                <span class="gc-pill">${escapeHtml(state.cloud.label)} · ${new Date(state.cloud.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head">
                <div>
                  <span class="gc-kicker">Thư viện game</span>
                  <h2>Game nổi bật và MMO RPG</h2>
                </div>
                <button class="gc-btn" type="button" data-gc-sync>Đồng bộ</button>
              </div>
              <div class="gc-card-grid">${renderGames()}</div>
            </main>

            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Nhiệm vụ hôm nay</h2><span class="gc-pill">Daily</span></div>
                <div class="gc-missions">${renderMissions("daily")}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Tuần này</h2><span class="gc-pill">Weekly</span></div>
                <div class="gc-missions">${renderMissions("weekly")}</div>
              </section>
            </aside>
          </section>

          <section class="gc-grid">
            <main class="gc-section gc-glass">
              <div class="gc-section-head"><h2>Bảng xếp hạng</h2><span class="gc-pill">XP</span></div>
              <div class="gc-leaderboard">${renderLeaderboard()}</div>
            </main>
            <aside class="gc-side">
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Huy hiệu</h2><span class="gc-pill">${state.badges.filter((badge) => badge.unlocked).length}/${state.badges.length}</span></div>
                <div class="gc-badge-row">${renderBadges()}</div>
              </section>
              <section class="gc-section gc-glass">
                <div class="gc-section-head"><h2>Bạn bè online</h2><span class="gc-pill">API/local</span></div>
                <div class="gc-friends">${renderFriends()}</div>
              </section>
            </aside>
          </section>

          <section class="gc-section gc-glass" style="margin-top:18px">
            <div class="gc-section-head"><h2>Hoạt động gần đây</h2><span class="gc-pill">Cloud-save ready</span></div>
            <div class="gc-feed">${renderActivity()}</div>
          </section>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    root.querySelectorAll("[data-gc-play]").forEach((button) => {
      button.addEventListener("click", () => startGame(button.getAttribute("data-gc-play")));
    });
    root.querySelector("[data-gc-continue]")?.addEventListener("click", () => navigate(state.player.lastRoute || "/entertainment/astra-hh"));
    root.querySelector("[data-gc-boost]")?.addEventListener("click", quickReward);
    root.querySelector("[data-gc-sync]")?.addEventListener("click", async () => {
      state.cloud = { status: "syncing", label: "Đang đồng bộ...", updatedAt: new Date().toISOString() };
      render();
      const ok = await syncCloud("save");
      showToast(ok ? "Đã đồng bộ Game Center" : "Chưa có backend, đang lưu local");
    });
  }

  function mount(host, opts = {}) {
    if (!host) throw new Error("HHGameCenter.mount cần host element.");
    unmount();
    mountedHost = host;
    options = opts || {};
    if (typeof opts.navigate === "function") options.navigate = opts.navigate;
    root = document.createElement("div");
    root.className = "hh-game-center-root";
    mountedHost.replaceChildren(root);
    state = mergeState(readLocal());
    if (state.lastVisit !== todayKey()) {
      state.lastVisit = todayKey();
      completeProgress("daily-login", 1);
    }
    rewardListener = (event) => applyReward(event.detail);
    window.addEventListener("hh:game-reward", rewardListener);
    saveLocal();
    render();
    syncCloud("load");
    window.dispatchEvent(new CustomEvent("hh:game-center-mounted", { detail: inspect() }));
  }

  function unmount() {
    if (rewardListener) window.removeEventListener("hh:game-reward", rewardListener);
    rewardListener = null;
    if (mountedHost) mountedHost.replaceChildren();
    root = null;
    mountedHost = null;
    options = {};
  }

  function inspect() {
    return {
      mounted: Boolean(root),
      storageKey: STORAGE_KEY,
      player: state?.player || null,
      games: state?.games?.map((game) => ({ id: game.id, route: game.route })) || [],
      missions: state?.missions || [],
      cloud: state?.cloud || null
    };
  }

  window.HHGameCenter = { mount, unmount, inspect };
  window.dispatchEvent(new CustomEvent("hh:game-center-ready", { detail: { games: GAME_LIBRARY.length } }));
})();
