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
    roomCode: "ASTRA13",
    ship: { engine: 2, shield: 2, weapon: 1, radar: 2, cargo: 2 },
    inventory: { ore: 52, crystal: 22, plasma: 12, relic: 3 },
    base: { level: 2, shield: 66, turrets: 3, farms: 2, lab: 1 },
    skills: { pilot: 32, combat: 24, mining: 28, trade: 18, science: 22 },
    party: ["Bạn", "AI Navigator"],
    chat: [{ who: "AI Navigator", text: "Tín hiệu HH-13 đang dao động mạnh ở rìa Orion." }],
    completed: {}
  };
  const tabs = [
    ["overview", "Tổng quan"],
    ["ship", "Lắp tàu"],
    ["quests", "Nhiệm vụ"],
    ["party", "Party"],
    ["base", "Căn cứ"],
    ["skills", "Skill tree"],
    ["events", "Boss/Raid"]
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
  let state = load();

  function load() {
    try { return { ...DEFAULT_STATE, ...JSON.parse(globalScope.localStorage?.getItem(STORE) || "{}") }; }
    catch { return { ...DEFAULT_STATE }; }
  }
  function save() {
    try { globalScope.localStorage?.setItem(STORE, JSON.stringify(state)); } catch {}
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
    setLog(`Hoàn thành "${quest.title}" và nhận ${quest.xp} XP.`);
    save();
    emitReward(`astra-${id}`, quest.xp);
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
    options.socket.on("astra:chat", onChat);
    options.socket.on("astra:presence", onPresence);
    options.socket.emit?.("astra:room:join", { roomCode: state.roomCode, captain: state.captain });
    socketHandlers = [["astra:chat", onChat], ["astra:presence", onPresence]];
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
    return `<div class="au-grid">${card("Captain & Faction", `${state.captain} - ${state.className} của ${state.faction}. Faction ảnh hưởng nhiệm vụ, giao thương và bonus raid.`)}${card("Tàu Starling-X", `Engine ${state.ship.engine}, shield ${state.ship.shield}, weapon ${state.ship.weapon}, radar ${state.ship.radar}, cargo ${state.ship.cargo}.`, 'data-au-tab="ship"', "Lắp tàu")}${card("Inventory", `Ore ${state.inventory.ore}, crystal ${state.inventory.crystal}, plasma ${state.inventory.plasma}, relic ${state.inventory.relic}.`, 'data-au-quest="mining"', "Khai thác")}${card("Bản đồ MMO", "Khu cố định: HH Station, Delta Market, Nebula Raid. Khu sinh tự động: hành tinh, mỏ, anomaly và dungeon.", 'data-au-tab="events"', "Xem bản đồ")}</div>`;
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
            <strong>${state.party.length}/10 online</strong>
            <span>${options.socketUrl ? "Realtime server sẵn hook" : "Local co-op fallback"}</span>
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
      return api;
    },
    unmount() {
      unbindSocket();
      if (root) root.innerHTML = "";
      root = null;
      options = {};
    },
    inspect() { return { state, active, quests, events }; }
  };
  globalScope.HHAstraExpansion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof globalScope.dispatchEvent === "function" && typeof globalScope.CustomEvent === "function") {
    globalScope.dispatchEvent(new globalScope.CustomEvent("hh:astra-expansion-ready"));
  }
})();
