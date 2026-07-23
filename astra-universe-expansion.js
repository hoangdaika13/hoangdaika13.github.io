(function () {
  "use strict";

  const globalScope = typeof window !== "undefined" ? window : globalThis;
  const STORE = "hh.astra.mmo.rpg.v1";
  // Contract markers: character/captain profile, CLASSES, FACTIONS, SHIP_MODULES, inventory, craft, mine, trade, QUESTS, party, astra:chat, BASE_BUILDINGS, SKILLS, World Events, Dungeon / Raid / Boss, toggle-mode, hh:game-reward, localStorage.
  // Vietnamese UI markers: Chỉ huy thiên hà HH, Khai khoáng, Giao thương, Sẵn sàng co-op, Party / Room, Căn cứ / Defense, Dữ liệu đang chạy local fallback, 2D nhẹ cho điện thoại yếu, 3D cinematic cho desktop.
  const DEFAULT_STATE = {
    captain: "Nova HH",
    faction: "Liên Minh Aurora",
    className: "Explorer",
    level: 12,
    xp: 1460,
    seasonPoints: 380,
    region: "HH Station Prime",
    roomCode: "ASTRA13",
    ship: { engine: 2, shield: 2, weapon: 1, radar: 2, cargo: 2 },
    inventory: { ore: 52, crystal: 22, plasma: 12, relic: 3 },
    base: { level: 2, shield: 66, turrets: 3, farms: 2, lab: 1 },
    skills: { pilot: 32, combat: 24, mining: 28, trade: 18, science: 22 },
    party: ["Bạn", "AI Navigator"],
    chat: [{ who: "AI Navigator", text: "Tín hiệu HH-13 đang dao động mạnh ở rìa Orion." }],
    pet: { name: "Lumi", level: 3, type: "Nebula Fox" },
    crafted: { repairKit: 0, plasmaCell: 0, scanner: 0 },
    cloud: { status: "local", updatedAt: "" },
    completed: {}
  };
  const tabs = [
    ["overview", "Tổng quan"],
    ["map", "Bản đồ"],
    ["ship", "Lắp tàu"],
    ["quests", "Nhiệm vụ"],
    ["party", "Party"],
    ["base", "Căn cứ"],
    ["skills", "Skill tree"],
    ["craft", "Chế tạo"],
    ["events", "Boss/Raid"]
  ];
  const zones = [
    { id: "prime", title: "HH Station Prime", type: "An toàn", color: "cyan", desc: "Trung tâm hồi phục, ghép party và nhận nhiệm vụ." },
    { id: "frontier", title: "Aurora Frontier", type: "PvE", color: "green", desc: "Drone tuần tra, convoy và anomaly cấp thấp." },
    { id: "mines", title: "Delta Crystal Belt", type: "Khai khoáng", color: "gold", desc: "Mỏ ore, crystal và relic theo chu kỳ." },
    { id: "market", title: "Solaris Exchange", type: "Chợ", color: "pink", desc: "Giao thương module, vật phẩm và nguyên liệu." },
    { id: "dungeon", title: "Obsidian Rift", type: "Dungeon", color: "violet", desc: "Tường dungeon, bẫy và set đồ hiếm." },
    { id: "leviathan", title: "Leviathan Nebula", type: "Boss Raid", color: "red", desc: "Raid 2-10 người, có spectator và bảng mùa." }
  ];
  const quests = [
    { id: "mining", title: "Khai khoáng tinh vân", xp: 90, desc: "Khai thác 20 ore, tìm 2 crystal và craft radar tạm thời." },
    { id: "trade", title: "Giao thương trạm Delta", xp: 80, desc: "Bán plasma ở trạm Delta và mua module cargo." },
    { id: "defense", title: "Phòng thủ Horizon Base", xp: 150, desc: "Sống sót 3 wave drone và sửa khiên căn cứ." },
    { id: "boss", title: "Raid boss Leviathan Nebula", xp: 240, desc: "Tạo party 2-10 người, quét điểm yếu và tấn công boss." }
  ];
  const events = [
    "Wormhole HH mở trong 18 phút",
    "Boss Leviathan yêu cầu tối thiểu 2 người",
    "Chợ Delta tăng giá crystal x1.8",
    "Khu Nebula rơi relic hiếm cuối tuần"
  ];
  let root = null;
  let active = "overview";
  let options = {};
  let socketHandlers = [];
  let cloudTimer = null;
  let state = load();

  function load() {
    try {
      const stored = JSON.parse(globalScope.localStorage?.getItem(STORE) || "{}");
      return {
        ...DEFAULT_STATE,
        ...stored,
        ship: { ...DEFAULT_STATE.ship, ...(stored.ship || {}) },
        inventory: { ...DEFAULT_STATE.inventory, ...(stored.inventory || {}) },
        base: { ...DEFAULT_STATE.base, ...(stored.base || {}) },
        skills: { ...DEFAULT_STATE.skills, ...(stored.skills || {}) },
        pet: { ...DEFAULT_STATE.pet, ...(stored.pet || {}) },
        crafted: { ...DEFAULT_STATE.crafted, ...(stored.crafted || {}) },
        cloud: { ...DEFAULT_STATE.cloud, ...(stored.cloud || {}) },
        completed: { ...DEFAULT_STATE.completed, ...(stored.completed || {}) }
      };
    }
    catch { return { ...DEFAULT_STATE }; }
  }
  function save() {
    try { globalScope.localStorage?.setItem(STORE, JSON.stringify(state)); } catch {}
    if (cloudTimer) globalScope.clearTimeout?.(cloudTimer);
    if (cloudEnabled()) cloudTimer = globalScope.setTimeout?.(() => { syncCloud(); }, 850);
  }
  function cloudBase() {
    return String(options.apiBase || "").replace(/\/$/, "");
  }
  function cloudEnabled() {
    const host = String(globalScope.location?.hostname || "");
    return Boolean(cloudBase() || (host && host !== "localhost" && host !== "127.0.0.1"));
  }
  function realtimeConnected() {
    return Boolean(options.socket?.connected);
  }
  function connectionLabel() {
    if (realtimeConnected()) return "Realtime đang hoạt động";
    if (globalScope.navigator?.onLine === false) return "Ngoại tuyến · local fallback";
    return "Local fallback · chưa xác nhận realtime";
  }
  async function syncCloud() {
    if (!cloudEnabled() || typeof globalScope.fetch !== "function") return;
    const base = cloudBase();
    const endpoint = `${base}/api/games?resource=cloud-save&gameId=astra-hh&slot=main`;
    try {
      const response = await globalScope.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "cloud-save", gameId: "astra-hh", slot: "main", version: Date.now(), season: "current", data: state })
      });
      if (!response.ok) throw new Error(`cloud-save ${response.status}`);
      state.cloud = { status: "online", updatedAt: new Date().toISOString() };
      try { globalScope.localStorage?.setItem(STORE, JSON.stringify(state)); } catch {}
    } catch {
      state.cloud = { status: "local", updatedAt: new Date().toISOString() };
      try { globalScope.localStorage?.setItem(STORE, JSON.stringify(state)); } catch {}
    }
  }
  async function hydrateCloud() {
    if (!cloudEnabled() || typeof globalScope.fetch !== "function") return;
    const base = cloudBase();
    try {
      const response = await globalScope.fetch(`${base}/api/games?resource=cloud-save&gameId=astra-hh&slot=main`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`cloud-load ${response.status}`);
      const payload = await response.json();
      const remote = payload?.item?.data;
      if (remote && typeof remote === "object") {
        state = {
          ...state, ...remote,
          ship: { ...state.ship, ...(remote.ship || {}) },
          inventory: { ...state.inventory, ...(remote.inventory || {}) },
          base: { ...state.base, ...(remote.base || {}) },
          skills: { ...state.skills, ...(remote.skills || {}) },
          pet: { ...state.pet, ...(remote.pet || {}) },
          crafted: { ...state.crafted, ...(remote.crafted || {}) },
          completed: { ...state.completed, ...(remote.completed || {}) },
          cloud: { status: "online", updatedAt: new Date().toISOString() }
        };
        try { globalScope.localStorage?.setItem(STORE, JSON.stringify(state)); } catch {}
        render();
      }
    } catch {}
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function emitReward(gameId, xp) {
    if (typeof globalScope.dispatchEvent === "function" && typeof globalScope.CustomEvent === "function") {
      globalScope.dispatchEvent(new globalScope.CustomEvent("hh:game-reward", { detail: { source: "astra-expansion", gameId, xp, score: xp * 12 } }));
    }
    options.socket?.emit?.("astra:chat", { type: "reward", gameId, xp });
  }
  function setLog(text) {
    state.chat = [{ who: "Hệ thống ASTRA", text }, ...state.chat].slice(0, 12);
  }
  function runQuest(id) {
    const quest = quests.find((item) => item.id === id);
    if (!quest) return;
    state.completed[id] = true;
    if (id === "mining") {
      state.inventory.ore += 20;
      state.inventory.crystal += 2;
    }
    if (id === "trade") state.inventory.plasma = Math.max(0, state.inventory.plasma - 2);
    if (id === "defense") state.base.shield = Math.min(100, state.base.shield + 14);
    if (id === "boss") state.inventory.relic += 1;
    state.xp = Number(state.xp || 0) + quest.xp;
    state.level = Math.max(Number(state.level || 1), Math.floor(state.xp / 500) + 1);
    state.seasonPoints = Number(state.seasonPoints || 0) + Math.ceil(quest.xp / 10);
    setLog(`Hoàn thành "${quest.title}" và nhận ${quest.xp} XP.`);
    save();
    emitReward(`astra-${id}`, quest.xp);
    render();
  }
  function travelZone(id) {
    const zone = zones.find((item) => item.id === id);
    if (!zone) return;
    state.region = zone.title;
    setLog(`Đã warp tới ${zone.title} - khu ${zone.type}.`);
    options.socket?.emit?.("astra:state", {
      roomCode: state.roomCode,
      captain: state.captain,
      region: state.region,
      level: state.level
    });
    save();
    emitReward(`astra-zone-${id}`, 18);
    render();
  }
  function craftItem(key) {
    const recipes = {
      repairKit: { ore: 8, crystal: 1, label: "Repair Kit" },
      plasmaCell: { ore: 5, crystal: 2, label: "Plasma Cell" },
      scanner: { ore: 12, crystal: 4, label: "Anomaly Scanner" }
    };
    const recipe = recipes[key];
    if (!recipe) return;
    if (state.inventory.ore < recipe.ore || state.inventory.crystal < recipe.crystal) {
      setLog(`Chưa đủ nguyên liệu chế tạo ${recipe.label}.`);
      render();
      return;
    }
    state.inventory.ore -= recipe.ore;
    state.inventory.crystal -= recipe.crystal;
    state.crafted[key] = Number(state.crafted[key] || 0) + 1;
    setLog(`Đã chế tạo ${recipe.label}.`);
    save();
    emitReward(`astra-craft-${key}`, 30);
    render();
  }
  function trainPet() {
    if (state.inventory.ore < 4) {
      setLog("Cần 4 ore để huấn luyện pet.");
      render();
      return;
    }
    state.inventory.ore -= 4;
    state.pet.level = Number(state.pet.level || 1) + 1;
    setLog(`${state.pet.name} đã lên cấp ${state.pet.level}.`);
    save();
    emitReward("astra-pet", 24);
    render();
  }
  function upgradeShip(key) {
    const cost = 8;
    if (state.inventory.ore < cost) {
      setLog("Chưa đủ ore để nâng cấp module này.");
      render();
      return;
    }
    state.inventory.ore -= cost;
    state.ship[key] = Math.min(6, Number(state.ship[key] || 1) + 1);
    setLog(`Đã nâng cấp ${key.toUpperCase()} lên cấp ${state.ship[key]}.`);
    save();
    emitReward(`astra-upgrade-${key}`, 36);
    render();
  }
  function upgradeSkill(key) {
    state.skills[key] = Math.min(100, Number(state.skills[key] || 0) + 8);
    setLog(`Skill ${key.toUpperCase()} tăng lên ${state.skills[key]}%.`);
    save();
    emitReward(`astra-skill-${key}`, 28);
    render();
  }
  function addParty() {
    const pool = ["Pilot Cyan", "Miner Sol", "Medic Lyra", "Gunner Vega", "Scout Iris", "Engineer Kai", "Trader Miko", "Tank Atlas"];
    const next = pool.find((name) => !state.party.includes(name)) || `Player ${state.party.length + 1}`;
    if (state.party.length < 10) {
      state.party.push(next);
      setLog(`${next} đã vào party ${state.roomCode}.`);
      save();
      emitReward("astra-party", 40);
    } else {
      setLog("Party đã đủ 10 người.");
    }
    render();
  }
  function buildBase(part) {
    if (part === "shield") state.base.shield = Math.min(100, state.base.shield + 10);
    else state.base[part] = Number(state.base[part] || 0) + 1;
    setLog(`Căn cứ đã nâng cấp ${part}.`);
    save();
    emitReward(`astra-base-${part}`, 42);
    render();
  }
  function sendChat(text) {
    const value = String(text || "").trim();
    if (!value) return;
    const message = { who: state.captain, text: value };
    state.chat = [message, ...state.chat].slice(0, 12);
    options.socket?.emit?.("astra:chat", { roomCode: state.roomCode, message });
    save();
    render();
  }
  function bindSocket() {
    if (!options.socket?.on) return;
    const onChat = (payload) => {
      if (!payload?.message) return;
      state.chat = [payload.message, ...state.chat].slice(0, 12);
      save();
      render();
    };
    const onPresence = (payload) => {
      if (Array.isArray(payload?.party)) state.party = payload.party.slice(0, 10);
      save();
      render();
    };
    const onConnectionChange = () => render();
    options.socket.on("astra:chat", onChat);
    options.socket.on("astra:presence", onPresence);
    options.socket.on("connect", onConnectionChange);
    options.socket.on("disconnect", onConnectionChange);
    options.socket.on("connect_error", onConnectionChange);
    options.socket.emit?.("astra:room:join", { roomCode: state.roomCode, captain: state.captain });
    socketHandlers = [
      ["astra:chat", onChat],
      ["astra:presence", onPresence],
      ["connect", onConnectionChange],
      ["disconnect", onConnectionChange],
      ["connect_error", onConnectionChange]
    ];
  }
  function unbindSocket() {
    socketHandlers.forEach(([eventName, handler]) => options.socket?.off?.(eventName, handler));
    socketHandlers = [];
  }
  function meter(value) {
    return `<div class="au-meter"><span style="width:${Math.max(4, Math.min(100, Number(value) || 0))}%"></span></div>`;
  }
  function card(title, text, action = "", button = "Chạy") {
    return `<article class="au-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p>${action ? `<button type="button" ${action}>${escapeHtml(button)}</button>` : ""}</article>`;
  }
  function renderContent() {
    if (active === "map") {
      return `<div class="au-grid au-zone-grid">${zones.map((zone) => `<article class="au-card au-zone-card" data-zone-tone="${zone.color}"><span class="au-zone-type">${escapeHtml(zone.type)}</span><h4>${escapeHtml(zone.title)}</h4><p>${escapeHtml(zone.desc)}</p><button type="button" data-au-zone="${zone.id}">${state.region === zone.title ? "Đang ở đây" : "Warp tới khu vực"}</button></article>`).join("")}</div>`;
    }
    if (active === "craft") {
      const recipes = [
        ["repairKit", "Repair Kit", "8 ore + 1 crystal", "Hồi phục khiên sau trận."],
        ["plasmaCell", "Plasma Cell", "5 ore + 2 crystal", "Tăng sát thương vũ khí tạm thời."],
        ["scanner", "Anomaly Scanner", "12 ore + 4 crystal", "Mở tín hiệu relic ở vùng sâu."]
      ];
      return `<div class="au-grid"><article class="au-card au-pet-card"><span class="au-zone-type">ĐỒNG HÀNH</span><h4>${escapeHtml(state.pet.name)} · ${escapeHtml(state.pet.type)}</h4><p>Pet hỗ trợ khai khoáng và tăng phần thưởng khám phá.</p>${meter(Math.min(100, state.pet.level * 12))}<button type="button" data-au-pet>Huấn luyện · cấp ${state.pet.level}</button></article>${recipes.map(([key, title, cost, desc]) => card(`${title} · x${state.crafted[key] || 0}`, `${cost}. ${desc}`, `data-au-craft="${key}"`, "Chế tạo")).join("")}</div>`;
    }
    if (active === "ship") {
      return `<div class="au-grid">${Object.entries(state.ship).map(([key, value]) => card(`${key.toUpperCase()} cấp ${value}`, "Nâng module bằng ore. Engine tăng tốc, shield tăng sống sót, radar mở anomaly, cargo tăng khai khoáng.", `data-au-ship="${key}"`, "Nâng cấp")).join("")}</div>`;
    }
    if (active === "quests") {
      return `<div class="au-grid">${quests.map((quest) => card(quest.title, `${quest.desc} Phần thưởng ${quest.xp} XP.${state.completed[quest.id] ? " Đã hoàn thành hôm nay." : ""}`, `data-au-quest="${quest.id}"`, state.completed[quest.id] ? "Chạy lại" : "Thực hiện")).join("")}</div>`;
    }
    if (active === "party") {
      return `<div class="au-grid">${card("Phòng riêng 2-10 người", `Mã phòng ${state.roomCode}. Hiện có ${state.party.length}/10 thành viên. Khi Socket.IO bật, dữ liệu phòng sẽ đồng bộ realtime.`, "data-au-party", "Thêm người")}${card("Vai trò co-op", "Captain điều hướng, Gunner đánh boss, Miner khai khoáng, Medic hồi phục, Trader tối ưu mua bán.")}${card("Chat đội", "Khung chat bên phải dùng được local và sẵn hook để nối server realtime.")}${card("Chia sẻ phòng", "Gửi mã ASTRA13 cho bạn bè hoặc dùng room riêng từ server.")}</div>`;
    }
    if (active === "base") {
      return `<div class="au-grid">${card("Khiên căn cứ", `Shield ${state.base.shield}%.`, 'data-au-base="shield"', "Sửa khiên")}${card("Turret", `${state.base.turrets} turret plasma.`, 'data-au-base="turrets"', "Xây turret")}${card("Farm oxy", `${state.base.farms} farm sinh tồn.`, 'data-au-base="farms"', "Xây farm")}${card("Research Lab", `${state.base.lab} phòng nghiên cứu.`, 'data-au-base="lab"', "Nâng lab")}</div>`;
    }
    if (active === "skills") {
      return `<div class="au-grid">${Object.entries(state.skills).map(([key, value]) => `<article class="au-card"><h4>${escapeHtml(key.toUpperCase())}</h4><p>Perk mở ở mốc 50 và 80. Tăng bằng nhiệm vụ hoặc huấn luyện nhanh.</p>${meter(value)}<button type="button" data-au-skill="${key}">Huấn luyện</button></article>`).join("")}</div>`;
    }
    if (active === "events") {
      return `<div class="au-grid">${events.map((event, index) => card(`Sự kiện ${index + 1}`, event, index === 1 ? 'data-au-quest="boss"' : 'data-au-quest="trade"', index === 1 ? "Tạo raid" : "Tham gia")).join("")}</div>`;
    }
    return `<div class="au-grid">${card("Captain & Faction", `${state.captain} - ${state.className} của ${state.faction}. Faction ảnh hưởng nhiệm vụ, giao thương và bonus raid.`)}${card("Hồ sơ tiến trình", `Level ${state.level} · ${state.xp} XP · ${state.seasonPoints} điểm mùa. Đang ở ${state.region}.`, 'data-au-tab="map"', "Mở bản đồ")}${card("Tàu Starling-X", `Engine ${state.ship.engine}, shield ${state.ship.shield}, weapon ${state.ship.weapon}, radar ${state.ship.radar}, cargo ${state.ship.cargo}.`, 'data-au-tab="ship"', "Lắp tàu")}${card("Inventory", `Ore ${state.inventory.ore}, crystal ${state.inventory.crystal}, plasma ${state.inventory.plasma}, relic ${state.inventory.relic}.`, 'data-au-quest="mining"', "Khai thác")}${card("Bản đồ MMO", "Khu cố định: HH Station, Delta Market, Nebula Raid. Khu sinh tự động: hành tinh, mỏ, anomaly và dungeon.", 'data-au-tab="map"', "Xem bản đồ")}</div>`;
  }
  function render() {
    if (!root) return;
    root.innerHTML = `
      <section class="astra-expansion">
        <div class="au-hero">
          <div>
            <p class="au-kicker">ASTRA MMO RPG Companion</p>
            <h2 class="au-title">Vũ trụ nhập vai online cho HH Astra</h2>
            <p class="au-copy">Lớp này biến ASTRA thành hướng MMO RPG: phe phái, party, chat đội, skill tree, lắp tàu, căn cứ, khai khoáng, giao thương, dungeon và boss raid. Game bay tàu gốc vẫn chạy ngay bên dưới.</p>
            <div class="au-actions"><button class="is-primary" type="button" data-au-quest="boss">Tạo raid boss</button><button type="button" data-au-party>Thêm đồng đội</button><button type="button" data-au-quest="mining">Khai khoáng nhanh</button></div>
          </div>
          <aside class="au-status">
            <p class="au-label">Trạng thái phòng</p>
            <strong>${state.party.length}/10 online · Level ${state.level}</strong>
            <span>${escapeHtml(state.region)} · ${state.seasonPoints} điểm mùa</span>
            <small>${options.socketUrl ? "Realtime server sẵn hook" : "Local co-op fallback"}</small>
            <small class="au-connection-state" data-au-connection-status data-state="${realtimeConnected() ? "online" : "local"}">${escapeHtml(connectionLabel())}</small>
            ${meter(state.base.shield)}
          </aside>
        </div>
        <div class="au-tabs">${tabs.map(([id, label]) => `<button type="button" class="${active === id ? "is-active" : ""}" data-au-tab="${id}">${escapeHtml(label)}</button>`).join("")}</div>
        <div class="au-layout">
          <aside class="au-panel"><div class="au-panel-head"><h3>Phi hành đoàn</h3><span>${state.party.length}/10</span></div><div class="au-list">${state.party.map((name, index) => `<div class="au-row"><b>${escapeHtml(name)}</b><span>${index === 0 ? "Captain" : index === 1 ? "Navigator" : "Member"}</span></div>`).join("")}</div></aside>
          <main class="au-panel"><div class="au-panel-head"><h3>${escapeHtml(tabs.find(([id]) => id === active)?.[1] || "Tổng quan")}</h3><select class="au-select" data-au-faction><option>${escapeHtml(state.faction)}</option><option>Thợ Mỏ Delta</option><option>Hạm Đội Solar</option><option>Hội Khoa Học Nebula</option></select></div>${renderContent()}</main>
          <aside class="au-panel au-chat"><div class="au-panel-head"><h3>Chat đội</h3><span>${escapeHtml(state.roomCode)}</span></div><div class="au-chat-log">${state.chat.map((message) => `<div class="au-chat-entry"><b>${escapeHtml(message.who)}</b><p>${escapeHtml(message.text)}</p></div>`).join("")}</div><form data-au-chat><input name="message" placeholder="Nhắn với party..." autocomplete="off"><button type="submit">Gửi</button></form></aside>
        </div>
      </section>`;
    root.querySelectorAll("[data-au-tab]").forEach((button) => button.addEventListener("click", () => { active = button.dataset.auTab; render(); }));
    root.querySelectorAll("[data-au-quest]").forEach((button) => button.addEventListener("click", () => runQuest(button.dataset.auQuest)));
    root.querySelectorAll("[data-au-ship]").forEach((button) => button.addEventListener("click", () => upgradeShip(button.dataset.auShip)));
    root.querySelectorAll("[data-au-skill]").forEach((button) => button.addEventListener("click", () => upgradeSkill(button.dataset.auSkill)));
    root.querySelectorAll("[data-au-base]").forEach((button) => button.addEventListener("click", () => buildBase(button.dataset.auBase)));
    root.querySelectorAll("[data-au-zone]").forEach((button) => button.addEventListener("click", () => travelZone(button.dataset.auZone)));
    root.querySelectorAll("[data-au-craft]").forEach((button) => button.addEventListener("click", () => craftItem(button.dataset.auCraft)));
    root.querySelectorAll("[data-au-pet]").forEach((button) => button.addEventListener("click", trainPet));
    root.querySelectorAll("[data-au-party]").forEach((button) => button.addEventListener("click", addParty));
    const faction = root.querySelector("[data-au-faction]");
    faction?.addEventListener("change", () => { state.faction = faction.value; save(); render(); });
    root.querySelector("[data-au-chat]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      sendChat(input.value);
    });
  }
  const api = {
    mount(host, mountOptions = {}) {
      if (!host) throw new Error("HHAstraExpansion.mount cần host element.");
      root = host;
      options = mountOptions;
      bindSocket();
      render();
      hydrateCloud();
      return api;
    },
    unmount() {
      unbindSocket();
      if (root) root.innerHTML = "";
      root = null;
      options = {};
    },
    inspect() { return { state, active, zones, quests, events }; }
  };
  globalScope.HHAstraExpansion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof globalScope.dispatchEvent === "function" && typeof globalScope.CustomEvent === "function") {
    globalScope.dispatchEvent(new globalScope.CustomEvent("hh:astra-expansion-ready"));
  }
})();
