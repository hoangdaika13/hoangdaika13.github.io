(function (root) {
  "use strict";

  const GAME_ID = "astral-realms";
  const SCHEMA_VERSION = 1;
  const DB_NAME = "hh-astral-realms";
  const DB_VERSION = 1;
  const STORE_NAME = "saves";
  const STORAGE_FALLBACK = "hh.astral-realms.save.v1";
  const WORLD_LIMIT = 92;
  const AUTOSAVE_MS = 15000;
  const ELEMENTS = Object.freeze({
    plasma: { label: "Plasma", short: "PL", color: "#ff68c9" },
    cryo: { label: "Băng tinh", short: "BT", color: "#77d9ff" },
    void: { label: "Hư không", short: "HK", color: "#a17bff" },
    nature: { label: "Thiên nhiên", short: "TN", color: "#6ef2a8" },
    quantum: { label: "Lượng tử", short: "LT", color: "#5feeff" },
    solar: { label: "Nhật quang", short: "NQ", color: "#ffd36b" }
  });
  const ELEMENT_REACTIONS = Object.freeze({
    "cryo+plasma": { name: "Sốc nhiệt", multiplier: 1.55, color: "#ff9bd6" },
    "quantum+void": { name: "Sụp đổ lượng tử", multiplier: 1.75, color: "#b591ff" },
    "nature+solar": { name: "Tinh hoa nở rộ", multiplier: 1.35, heal: 8, color: "#baff8e" }
  });
  const ZONES = Object.freeze([
    { id: "central", name: "H-Central", x: 0, z: 0, radius: 31, color: "#6feeff", weather: "Trời quang", description: "Thành phố trung tâm và Training Arena." },
    { id: "aurora", name: "Aurora Vale", x: -51, z: 20, radius: 30, color: "#65f1c7", weather: "Mưa tinh thể", description: "Thung lũng cực quang với tinh thể Băng tinh." },
    { id: "crimson", name: "Crimson Forge", x: 52, z: 24, radius: 30, color: "#ff805f", weather: "Tro plasma", description: "Lò rèn cổ, dung nham và máy móc tha hóa." },
    { id: "void", name: "Void Garden", x: 2, z: -62, radius: 32, color: "#ae78ff", weather: "Bão hư không", description: "Khu rừng tím nơi Nexus Warden trú ngụ." }
  ]);
  const ITEMS = Object.freeze({
    "starter-blade": { id: "starter-blade", name: "Đoản kiếm H", type: "weapon", rarity: "Khởi đầu", description: "Vũ khí tiêu chuẩn của Nhà du hành H.", attack: 8 },
    "aurora-shard": { id: "aurora-shard", name: "Mảnh Aurora", type: "material", rarity: "Phổ thông", description: "Tinh thể lạnh thu được tại Aurora Vale." },
    "plasma-core": { id: "plasma-core", name: "Lõi Plasma", type: "material", rarity: "Hiếm", description: "Lõi năng lượng còn nóng của sinh vật Crimson." },
    "void-fiber": { id: "void-fiber", name: "Sợi Hư Không", type: "material", rarity: "Hiếm", description: "Vật chất bất ổn từ Void Garden." },
    "healing-tonic": { id: "healing-tonic", name: "Tinh dược hồi phục", type: "consumable", rarity: "Phổ thông", description: "Hồi 35 HP khi sử dụng.", heal: 35 },
    "astral-edge": { id: "astral-edge", name: "Astral Edge", type: "weapon", rarity: "Sử thi", description: "Lưỡi kiếm cộng hưởng với sáu nguyên tố.", attack: 22 }
  });
  const RECIPES = Object.freeze([
    { id: "healing-tonic", name: "Tinh dược hồi phục", result: "healing-tonic", amount: 1, requires: { "aurora-shard": 2 } },
    { id: "astral-edge", name: "Astral Edge", result: "astral-edge", amount: 1, requires: { "aurora-shard": 3, "plasma-core": 2, "void-fiber": 1 } }
  ]);
  const QUESTS = Object.freeze([
    { id: "awakening", title: "Tín hiệu thức tỉnh", description: "Nói chuyện với Navigator Luma tại H-Central.", type: "talk", target: 1, reward: { xp: 80 } },
    { id: "purify", title: "Thanh lọc Aurora", description: "Đánh bại 3 Tinh linh Aurora tha hóa.", type: "defeat", target: 3, enemy: "aurora-wisp", reward: { xp: 120, item: "aurora-shard", amount: 1 } },
    { id: "shards", title: "Mạch tinh thể", description: "Thu thập 3 Mảnh Aurora trong thung lũng.", type: "collect", target: 3, item: "aurora-shard", reward: { xp: 120 } },
    { id: "craft", title: "Dược phẩm tiền tuyến", description: "Chế tạo một Tinh dược hồi phục.", type: "craft", target: 1, recipe: "healing-tonic", reward: { xp: 140 } },
    { id: "gates", title: "Ba cổng thất lạc", description: "Kích hoạt cổng Aurora, Crimson và Void.", type: "gate", target: 3, reward: { xp: 180 } },
    { id: "warden", title: "Nexus Warden", description: "Đánh bại boss thế giới tại Void Garden.", type: "boss", target: 1, enemy: "nexus-warden", reward: { xp: 500, item: "astral-edge", amount: 1 } }
  ]);
  const ENEMY_ARCHETYPES = Object.freeze({
    "aurora-wisp": { name: "Tinh linh Aurora", health: 105, attack: 9, speed: 2.4, color: "#6cf6d0", element: "cryo", xp: 22, drop: "aurora-shard" },
    "forge-hound": { name: "Khuyển Plasma", health: 145, attack: 12, speed: 3.1, color: "#ff765d", element: "plasma", xp: 28, drop: "plasma-core" },
    "void-stalker": { name: "Bóng săn Hư Không", health: 185, attack: 15, speed: 2.8, color: "#a875ff", element: "void", xp: 36, drop: "void-fiber" },
    "nexus-warden": { name: "Nexus Warden", health: 1200, attack: 22, speed: 2.1, color: "#ff5e9f", element: "quantum", xp: 360, drop: "astral-edge", boss: true }
  });

  function clamp(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function bodyValue(rootElement, selector) {
    return String(rootElement?.querySelector(selector)?.value || "").trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "id") {
    if (root.crypto?.randomUUID) return `${prefix}-${root.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultQuestState() {
    return Object.fromEntries(QUESTS.map((quest, index) => [quest.id, {
      status: index === 0 ? "active" : "locked",
      progress: 0,
      completedAt: ""
    }]));
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      saveVersion: 1,
      updatedAt: nowIso(),
      createdAt: nowIso(),
      playTime: 0,
      worldTime: 8.2,
      player: {
        id: uid("traveler"),
        name: "Lyra H",
        level: 1,
        xp: 0,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        ultimate: 0,
        element: "plasma",
        x: 0,
        y: 1.2,
        z: 5,
        rotation: 0,
        checkpoint: "central",
        weapon: "starter-blade",
        skillPoints: 0
      },
      inventory: {
        "starter-blade": { quantity: 1, favorite: true, locked: true, acquiredAt: nowIso() }
      },
      quests: defaultQuestState(),
      checkpoints: { central: true, aurora: false, crimson: false, void: false },
      activatedGates: [],
      collectedNodes: [],
      defeated: {},
      skills: { plasmaDrive: 0, astralGuard: 0, staminaCore: 0 },
      settings: {
        quality: "auto",
        volume: 42,
        sound: true,
        cameraSensitivity: 55,
        reduceEffects: root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
      },
      stats: {
        totalDamage: 0,
        highestHit: 0,
        enemiesDefeated: 0,
        bossDefeated: 0,
        crafted: 0,
        distance: 0,
        deaths: 0
      },
      cloud: { status: "local", version: 0, updatedAt: "", error: "" },
      party: { roomCode: "", status: "local", members: [], integrity: "local-simulation" }
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    if (!input || typeof input !== "object") return base;
    const state = {
      ...base,
      ...input,
      player: { ...base.player, ...(input.player || {}) },
      inventory: input.inventory && typeof input.inventory === "object" ? input.inventory : base.inventory,
      quests: { ...base.quests, ...(input.quests || {}) },
      checkpoints: { ...base.checkpoints, ...(input.checkpoints || {}) },
      skills: { ...base.skills, ...(input.skills || {}) },
      settings: { ...base.settings, ...(input.settings || {}) },
      stats: { ...base.stats, ...(input.stats || {}) },
      cloud: { ...base.cloud, ...(input.cloud || {}) },
      party: { ...base.party, ...(input.party || {}) }
    };
    state.schemaVersion = SCHEMA_VERSION;
    state.player.health = clamp(state.player.health, 0, state.player.maxHealth || 100);
    state.player.stamina = clamp(state.player.stamina, 0, state.player.maxStamina || 100);
    state.player.x = clamp(state.player.x, -WORLD_LIMIT, WORLD_LIMIT);
    state.player.z = clamp(state.player.z, -WORLD_LIMIT, WORLD_LIMIT);
    state.activatedGates = Array.isArray(state.activatedGates) ? [...new Set(state.activatedGates)].slice(0, 8) : [];
    state.collectedNodes = Array.isArray(state.collectedNodes) ? [...new Set(state.collectedNodes)].slice(0, 200) : [];
    return state;
  }

  class AstralSaveStore {
    constructor() {
      this.db = null;
      this.fallback = false;
    }

    async open() {
      if (!root.indexedDB) {
        this.fallback = true;
        return this;
      }
      try {
        this.db = await new Promise((resolve, reject) => {
          const request = root.indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "slot" });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB."));
        });
      } catch {
        this.fallback = true;
      }
      return this;
    }

    async load(slot = "slot1") {
      if (this.fallback || !this.db) {
        try {
          const parsed = JSON.parse(root.localStorage?.getItem(STORAGE_FALLBACK) || "null");
          return parsed?.slot === slot ? parsed : null;
        } catch {
          return null;
        }
      }
      return new Promise((resolve) => {
        const request = this.db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(slot);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    }

    async save(data, slot = "slot1", label = "Autosave") {
      const previous = await this.load(slot);
      const version = Math.max(1, Number(previous?.version || 0) + 1);
      const history = [
        ...(Array.isArray(previous?.history) ? previous.history : []),
        ...(previous?.data ? [{ version: previous.version, updatedAt: previous.updatedAt, label: previous.label, data: previous.data }] : [])
      ].slice(-3);
      const record = {
        slot,
        version,
        label,
        updatedAt: nowIso(),
        data: clone(data),
        history
      };
      if (this.fallback || !this.db) {
        try {
          root.localStorage?.setItem(STORAGE_FALLBACK, JSON.stringify(record));
          return record;
        } catch (error) {
          throw new Error(`Không lưu được tiến trình trên thiết bị: ${error.message || error}`);
        }
      }
      return new Promise((resolve, reject) => {
        const request = this.db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error || new Error("Không ghi được IndexedDB."));
      });
    }

    async restore(version, slot = "slot1") {
      const current = await this.load(slot);
      const source = current?.history?.find((entry) => Number(entry.version) === Number(version));
      if (!source?.data) throw new Error("Không tìm thấy phiên bản lưu cần khôi phục.");
      return this.save(normalizeState(source.data), slot, `Khôi phục v${source.version}`);
    }

    async clear(slot = "slot1") {
      if (this.fallback || !this.db) {
        root.localStorage?.removeItem(STORAGE_FALLBACK);
        return;
      }
      await new Promise((resolve) => {
        const request = this.db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(slot);
        request.onsuccess = request.onerror = () => resolve();
      });
    }
  }

  class AstralRealmsGame {
    constructor(host, options = {}) {
      this.host = host;
      this.options = options;
      this.store = new AstralSaveStore();
      this.state = defaultState();
      this.savedRecord = null;
      this.root = null;
      this.THREE = null;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.clock = null;
      this.playerMesh = null;
      this.playerShadow = null;
      this.entities = new Map();
      this.enemies = new Map();
      this.collectibles = new Map();
      this.npcs = new Map();
      this.portals = new Map();
      this.remotePlayers = new Map();
      this.effects = [];
      this.keys = new Set();
      this.gamepads = [];
      this.touchMove = { x: 0, z: 0 };
      this.running = false;
      this.paused = true;
      this.destroyed = false;
      this.started = false;
      this.visible = document.visibilityState !== "hidden";
      this.lastFrameAt = performance.now();
      this.lastUiAt = 0;
      this.lastMinimapAt = 0;
      this.lastSaveAt = 0;
      this.lastNetworkAt = 0;
      this.lastAttackAt = 0;
      this.lastSkillAt = 0;
      this.lastUltimateAt = 0;
      this.lastDodgeAt = 0;
      this.invulnerableUntil = 0;
      this.combo = 0;
      this.comboUntil = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.gliding = false;
      this.cameraYaw = 0;
      this.cameraPitch = 0.58;
      this.cameraDistance = 12;
      this.draggingCamera = false;
      this.pointerStart = null;
      this.lockedTargetId = "";
      this.nearby = null;
      this.currentZone = ZONES[0];
      this.currentPanel = "";
      this.toastTimer = 0;
      this.frameHandle = 0;
      this.autosaveTimer = 0;
      this.fpsFrames = 0;
      this.fpsStartedAt = performance.now();
      this.fps = 0;
      this.renderScale = 1;
      this.dpsSamples = [];
      this.trainingActive = false;
      this.worldHoursPerSecond = 0.018;
      this.runtime = null;
      this.socket = options.socket || root.HHRealtimeSocket || null;
      this.room = null;
      this.authoritative = false;
      this.inputSeq = 0;
      this.audio = null;
      this.audioMaster = null;
      this.cleanup = [];
      this.renderShell();
    }

    renderShell() {
      this.host.innerHTML = `
        <section class="har-shell" data-har-shell data-quality="auto" aria-label="HH Astral Realms">
          <div class="har-stage" data-har-stage>
            <canvas data-har-world aria-label="Thế giới 3D HH Astral Realms"></canvas>
            <div class="har-crosshair" aria-hidden="true"></div>
          </div>

          <div class="har-topbar">
            <div class="har-brand">
              <div class="har-brand__core" aria-hidden="true">H</div>
              <div class="har-brand__copy"><strong>HH Astral Realms</strong><span>Action RPG · Vertical Slice</span></div>
            </div>
            <div class="har-live-orbit" aria-label="Trạng thái game realtime">
              <div class="har-signal" data-tone="cyan"><small>Khu vực</small><strong data-har-zone>H-Central</strong></div>
              <div class="har-signal" data-tone="amber"><small>Thời gian</small><strong data-har-time>08:12</strong></div>
              <div class="har-signal" data-tone="pink"><small>Thời tiết</small><strong data-har-weather>Trời quang</strong></div>
              <div class="har-signal" data-tone="lime"><small>Engine</small><strong data-har-fps>Chưa chạy</strong></div>
              <div class="har-signal" data-tone="cyan"><small>Máy chủ</small><strong data-har-server>LOCAL</strong></div>
            </div>
            <div class="har-top-actions">
              <button class="har-icon-button" type="button" data-har-panel="map" aria-label="Mở bản đồ">◇</button>
              <button class="har-icon-button" type="button" data-har-panel="party" aria-label="Mở tổ đội">◎</button>
              <button class="har-icon-button" type="button" data-har-fullscreen aria-label="Toàn màn hình">⛶</button>
              <button class="har-icon-button" type="button" data-har-pause aria-label="Tạm dừng">Ⅱ</button>
            </div>
          </div>

          <div class="har-team" aria-label="Đội hình">
            <button class="har-team-slot is-active" type="button" data-team-slot="1" aria-label="Lyra H">LH</button>
            <button class="har-team-slot" type="button" disabled title="Chưa mở khóa">02</button>
            <button class="har-team-slot" type="button" disabled title="Chưa mở khóa">03</button>
          </div>
          <div class="har-dps" data-har-dps>Training DPS · 0</div>

          <div class="har-minimap-wrap">
            <canvas width="276" height="276" data-har-minimap aria-label="Radar thiên hà"></canvas>
            <div class="har-minimap-label" data-har-minimap-label>H-Central</div>
          </div>

          <div class="har-boss" data-har-boss hidden>
            <strong data-har-boss-name>Nexus Warden</strong>
            <div class="har-meter har-meter--boss"><i data-har-boss-meter></i></div>
          </div>

          <div class="har-hud">
            <div class="har-player-card">
              <div class="har-player-row">
                <div class="har-avatar" data-level="1">LH</div>
                <div class="har-player-meta">
                  <strong data-har-player-name>Lyra H</strong>
                  <span data-har-player-meta>Nhà du hành · Plasma</span>
                  <div class="har-meter"><i data-har-health></i></div>
                  <div class="har-meter har-meter--stamina"><i data-har-stamina></i></div>
                  <div class="har-meter har-meter--xp"><i data-har-xp></i></div>
                </div>
              </div>
            </div>
            <div class="har-quest-card">
              <button type="button" data-har-panel="quests">
                <small>Nhiệm vụ đang theo dõi</small>
                <strong data-har-quest-title>Tín hiệu thức tỉnh</strong>
                <span data-har-quest-progress>Nói chuyện với Navigator Luma · 0/1</span>
              </button>
            </div>
          </div>

          <div class="har-action-dock" aria-label="Kỹ năng">
            <button class="har-action" type="button" data-har-action="dodge"><small>Q</small><strong>⇥</strong><i data-cooldown="dodge"></i></button>
            <button class="har-action har-action--attack" type="button" data-har-action="attack"><small>F</small><strong>⚔</strong><i data-cooldown="attack"></i></button>
            <button class="har-action" type="button" data-har-action="skill"><small>E</small><strong>✦</strong><i data-cooldown="skill"></i></button>
            <button class="har-action" type="button" data-har-action="ultimate"><small>R</small><strong>✺</strong><i data-cooldown="ultimate"></i></button>
            <button class="har-action" type="button" data-har-action="interact"><small>G</small><strong>◇</strong><i></i></button>
          </div>

          <div class="har-element-ring" aria-label="Lõi nguyên tố">
            ${Object.entries(ELEMENTS).map(([id, item]) => `<button class="har-element" type="button" data-element="${id}" aria-pressed="${id === "plasma"}" style="--element-color:${item.color}" title="${item.label}">${item.short}</button>`).join("")}
          </div>

          <div class="har-context-prompt" data-har-context hidden></div>

          <div class="har-touch" aria-label="Điều khiển cảm ứng">
            <div class="har-joystick" data-har-joystick><i></i></div>
            <div class="har-touch-actions">
              <button class="har-touch-action" type="button" data-touch-action="attack">⚔</button>
              <button class="har-touch-action" type="button" data-touch-action="jump">↑</button>
              <button class="har-touch-action" type="button" data-touch-action="skill">✦</button>
              <button class="har-touch-action" type="button" data-touch-action="dodge">⇥</button>
            </div>
          </div>

          <aside class="har-panel" data-har-panel-root aria-hidden="true">
            <header class="har-panel__head">
              <div><small data-har-panel-kicker>Holographic Console</small><h2 data-har-panel-title>Bản đồ</h2></div>
              <button class="har-icon-button" type="button" data-har-panel-close aria-label="Đóng bảng">×</button>
            </header>
            <div class="har-panel__body" data-har-panel-body></div>
          </aside>

          <section class="har-dialogue" data-har-dialogue hidden aria-live="polite">
            <small data-har-dialogue-role>Navigator</small>
            <h2 data-har-dialogue-name>Luma</h2>
            <p data-har-dialogue-text></p>
            <div class="har-dialogue__choices" data-har-dialogue-choices></div>
          </section>

          <div class="har-toast" data-har-toast role="status" aria-live="polite"></div>

          <section class="har-start" data-har-start>
            <div class="har-start-card">
              <div class="har-start-sun" aria-hidden="true">H</div>
              <small>H Galaxy · Original Action RPG</small>
              <h1>Astral Realms</h1>
              <p>Giải phóng những lõi năng lượng bị tha hóa, mở lại các cổng không gian và đối đầu Nexus Warden trong vertical slice 3D đầu tiên.</p>
              <div class="har-start-features">
                <div class="har-start-feature"><strong>04</strong>Khu vực liền mạch</div>
                <div class="har-start-feature"><strong>06</strong>Nhiệm vụ thật</div>
                <div class="har-start-feature"><strong>06</strong>Lõi nguyên tố</div>
                <div class="har-start-feature"><strong>1–4</strong>Co-op thử nghiệm</div>
              </div>
              <div class="har-start-actions">
                <button class="har-primary-button" type="button" data-har-continue>Tiếp tục hành trình</button>
                <button class="har-secondary-button" type="button" data-har-new>Tạo hành trình mới</button>
              </div>
              <div class="har-loading" data-har-loading hidden>
                <div class="har-loading__track"><i data-har-loading-bar></i></div>
                <span data-har-loading-text>Đang chuẩn bị cổng không gian...</span>
              </div>
              <div class="har-status-note" data-har-save-note>Đang kiểm tra tiến trình trên thiết bị...</div>
            </div>
          </section>
        </section>`;
      this.root = this.host.firstElementChild;
    }

    async init() {
      await this.store.open();
      this.savedRecord = await this.store.load("slot1");
      const note = this.root.querySelector("[data-har-save-note]");
      const continueButton = this.root.querySelector("[data-har-continue]");
      if (this.savedRecord?.data) {
        this.state = normalizeState(this.savedRecord.data);
        const date = new Date(this.savedRecord.updatedAt);
        note.textContent = `Có tiến trình v${this.savedRecord.version} · ${Number.isNaN(date.getTime()) ? "đã lưu trên thiết bị" : date.toLocaleString("vi-VN")}`;
        continueButton.textContent = "Tiếp tục hành trình";
      } else {
        note.textContent = this.store.fallback
          ? "IndexedDB không khả dụng · sẽ dùng bộ nhớ cục bộ dự phòng."
          : "Chưa có hành trình · bản mới sẽ được lưu bằng IndexedDB.";
        continueButton.textContent = "Bắt đầu hành trình";
      }
      this.bindShellEvents();
      return this;
    }

    setLoading(progress, message) {
      const panel = this.root.querySelector("[data-har-loading]");
      panel.hidden = false;
      panel.style.setProperty("--progress", `${clamp(progress, 0, 100)}%`);
      const text = this.root.querySelector("[data-har-loading-text]");
      if (text) text.textContent = message;
    }

    async startGame({ fresh = false } = {}) {
      if (this.started || this.destroyed) return;
      this.started = true;
      const continueButton = this.root.querySelector("[data-har-continue]");
      const newButton = this.root.querySelector("[data-har-new]");
      continueButton.disabled = true;
      newButton.disabled = true;
      try {
        if (fresh) {
          await this.store.clear("slot1");
          this.state = defaultState();
          this.savedRecord = null;
        } else if (this.savedRecord?.data) {
          this.state = normalizeState(this.savedRecord.data);
        }
        this.setLoading(12, "Đang kiểm tra trình duyệt và bộ nhớ đồ họa...");
        if (!this.supportsWebGL()) throw new Error("Trình duyệt không hỗ trợ WebGL. Hãy bật tăng tốc phần cứng hoặc dùng trình duyệt mới hơn.");
        this.setLoading(28, "Đang tải engine 3D cục bộ...");
        this.THREE = await import("./vendor/three.module.min.js");
        if (this.destroyed) return;
        this.setLoading(44, "Đang dựng H-Central và ba vùng hành tinh...");
        this.setupRenderer();
        this.createWorld();
        this.setLoading(67, "Đang triệu hồi nhân vật, sinh vật và Nexus Warden...");
        this.createActors();
        this.setLoading(82, "Đang khôi phục nhiệm vụ và kho đồ...");
        this.applyStateToWorld();
        this.initRuntime();
        this.initAudio();
        this.bindGameEvents();
        this.initRealtime();
        this.setLoading(96, "Đang đồng bộ checkpoint gần nhất...");
        this.running = true;
        this.paused = false;
        this.root.querySelector("[data-har-start]").hidden = true;
        this.runtime?.start?.({ gameId: GAME_ID, mode: this.authoritative ? "online" : "local" });
        this.autosaveTimer = root.setInterval(() => this.saveProgress("Autosave"), AUTOSAVE_MS);
        this.lastFrameAt = performance.now();
        this.frameHandle = requestAnimationFrame((time) => this.frame(time));
        this.updateUi(true);
        this.toast(this.savedRecord?.data ? "Đã khôi phục checkpoint gần nhất." : "Hành trình mới bắt đầu tại H-Central.", "success");
        this.syncCloud(false);
      } catch (error) {
        this.started = false;
        continueButton.disabled = false;
        newButton.disabled = false;
        const message = error?.message || "Không khởi động được game.";
        this.setLoading(0, message);
        this.root.querySelector("[data-har-loading-text]")?.classList.add("har-unsupported");
      }
    }

    supportsWebGL() {
      try {
        const probe = document.createElement("canvas");
        return Boolean(probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) || probe.getContext("webgl"));
      } catch {
        return false;
      }
    }

    setupRenderer() {
      const THREE = this.THREE;
      const canvas = this.root.querySelector("[data-har-world]");
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x050816);
      this.scene.fog = new THREE.FogExp2(0x071023, 0.0095);
      this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
      this.camera.position.set(0, 10, 14);
      const quality = this.state.settings.quality;
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !["low"].includes(quality),
        powerPreference: "high-performance",
        alpha: false
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.shadowMap.enabled = quality !== "low";
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.clock = new THREE.Clock();
      this.resize();
    }

    createWorld() {
      const THREE = this.THREE;
      this.world = new THREE.Group();
      this.world.name = "AstralOpenWorld";
      this.scene.add(this.world);

      const hemisphere = new THREE.HemisphereLight(0x9edcff, 0x10081e, 1.55);
      this.scene.add(hemisphere);
      this.hemisphereLight = hemisphere;

      const sun = new THREE.DirectionalLight(0xffe6bf, 2.15);
      sun.position.set(-24, 42, 18);
      sun.castShadow = this.renderer.shadowMap.enabled;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -75;
      sun.shadow.camera.right = 75;
      sun.shadow.camera.top = 75;
      sun.shadow.camera.bottom = -75;
      this.scene.add(sun);
      this.sunLight = sun;

      const hLight = new THREE.PointLight(0x69efff, 45, 60, 1.8);
      hLight.position.set(0, 10, 0);
      this.scene.add(hLight);
      this.hLight = hLight;

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(112, 96),
        new THREE.MeshStandardMaterial({ color: 0x091124, roughness: 0.93, metalness: 0.08 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.name = "AstralGround";
      this.world.add(ground);

      this.createStarfield();
      this.createZonePlatforms();
      this.createCentralCity();
      this.createAuroraVale();
      this.createCrimsonForge();
      this.createVoidGarden();
      this.createDungeon();
      this.createWeatherField();
    }

    createStarfield() {
      const THREE = this.THREE;
      const count = this.state.settings.reduceEffects ? 300 : 720;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const palette = [new THREE.Color(0x8cecff), new THREE.Color(0xff91da), new THREE.Color(0xc5a1ff), new THREE.Color(0xffde83)];
      for (let index = 0; index < count; index += 1) {
        const radius = 90 + Math.random() * 210;
        const angle = Math.random() * Math.PI * 2;
        const elevation = 18 + Math.random() * 110;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = elevation;
        positions[index * 3 + 2] = Math.sin(angle) * radius;
        const color = palette[index % palette.length];
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      this.starfield = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true })
      );
      this.scene.add(this.starfield);
    }

    createZonePlatforms() {
      const THREE = this.THREE;
      ZONES.forEach((zone) => {
        const color = new THREE.Color(zone.color);
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(zone.radius, zone.radius + 2.5, 1.15, 72),
          new THREE.MeshStandardMaterial({
            color: color.clone().multiplyScalar(0.16),
            emissive: color,
            emissiveIntensity: 0.09,
            roughness: 0.78,
            metalness: 0.18
          })
        );
        platform.position.set(zone.x, 0.45, zone.z);
        platform.receiveShadow = true;
        platform.userData.zoneId = zone.id;
        this.world.add(platform);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(zone.radius - 0.6, zone.radius, 96),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(zone.x, 1.04, zone.z);
        this.world.add(ring);

        this.addWorldLabel(zone.name, zone.x, 5.8, zone.z, zone.color, 1.15);
      });

      const paths = [
        [0, 0, -51, 20, "#5cf6df"],
        [0, 0, 52, 24, "#ff8667"],
        [0, 0, 2, -62, "#a879ff"]
      ];
      paths.forEach(([x1, z1, x2, z2, color]) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const path = new THREE.Mesh(
          new THREE.PlaneGeometry(4.2, length),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(0.14),
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.05,
            transparent: true,
            opacity: 0.68,
            roughness: 0.8
          })
        );
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.atan2(dz, dx) - Math.PI / 2;
        path.position.set((x1 + x2) / 2, 1.05, (z1 + z2) / 2);
        this.world.add(path);
      });
    }

    createCentralCity() {
      const THREE = this.THREE;
      const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0x152b47,
        emissive: 0x23546e,
        emissiveIntensity: 0.2,
        metalness: 0.62,
        roughness: 0.28
      });
      const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x72efff, transparent: true, opacity: 0.68 });

      const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 9, 2.4, 48), towerMaterial);
      coreBase.position.set(0, 2.1, 0);
      coreBase.castShadow = true;
      coreBase.receiveShadow = true;
      this.world.add(coreBase);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 32, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffc463,
          emissive: 0xff5fae,
          emissiveIntensity: 1.2,
          roughness: 0.18,
          metalness: 0.2
        })
      );
      core.position.set(0, 8.7, 0);
      core.userData.floatBase = 8.7;
      this.world.add(core);
      this.centralCore = core;

      const hLabel = this.addWorldLabel("H", 0, 9.3, 0, "#ffffff", 2.5);
      hLabel.userData.followCore = true;

      [10, 14].forEach((radius, index) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.08 + index * 0.03, 8, 96), glowMaterial.clone());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.25 + index * 0.18;
        ring.userData.spin = index ? -0.1 : 0.14;
        this.world.add(ring);
      });

      for (let index = 0; index < 9; index += 1) {
        const angle = (index / 9) * Math.PI * 2;
        const radius = index % 2 ? 20 : 24;
        const height = 4.5 + (index % 3) * 2.4;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.7, height, 8), towerMaterial);
        tower.position.set(Math.cos(angle) * radius, 1 + height / 2, Math.sin(angle) * radius);
        tower.castShadow = true;
        this.world.add(tower);
        const light = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.22, 8), glowMaterial.clone());
        light.position.set(tower.position.x, tower.position.y + height / 2 + 0.2, tower.position.z);
        this.world.add(light);
      }

      const trainingPad = new THREE.Mesh(
        new THREE.CylinderGeometry(6.2, 6.6, 0.65, 40),
        new THREE.MeshStandardMaterial({ color: 0x27233e, emissive: 0xffc25e, emissiveIntensity: 0.12, metalness: 0.35 })
      );
      trainingPad.position.set(17, 1.35, -10);
      this.world.add(trainingPad);
      this.addWorldLabel("Training Arena", 17, 4.2, -10, "#ffd36b", 0.9);

      const dummy = this.createCharacterMesh({ body: "#ffbd62", accent: "#fff2c5", scale: 0.9, label: "Training Core" });
      dummy.position.set(17, 2.2, -10);
      dummy.userData = { type: "training", id: "training-core", health: 999999, maxHealth: 999999 };
      this.world.add(dummy);
      this.entities.set("training-core", dummy);

      this.createNpc("luma", "Navigator Luma", -6, 3, "#6cf2ff");
      this.createNpc("forge-master", "Thợ rèn Kael", 8, 8, "#ffbb72");

      this.createPortal("central", "Cổng H-Central", 0, 18, "#6feeff", { checkpoint: "central" });
    }

    createAuroraVale() {
      const THREE = this.THREE;
      const material = new THREE.MeshStandardMaterial({
        color: 0x0d594f,
        emissive: 0x2ac8a5,
        emissiveIntensity: 0.16,
        roughness: 0.82
      });
      for (let index = 0; index < 34; index += 1) {
        const angle = (index / 34) * Math.PI * 2 + (index % 4) * 0.14;
        const radius = 8 + (index * 7) % 24;
        const height = 1.4 + (index % 6) * 0.72;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.45 + (index % 3) * 0.12, height, 5), material);
        crystal.position.set(-51 + Math.cos(angle) * radius, 1.05 + height / 2, 20 + Math.sin(angle) * radius);
        crystal.rotation.y = angle;
        this.world.add(crystal);
      }
      [
        ["aurora-node-1", -42, 13],
        ["aurora-node-2", -58, 26],
        ["aurora-node-3", -49, 34],
        ["aurora-node-4", -67, 13]
      ].forEach(([id, x, z]) => this.createCollectible(id, "aurora-shard", x, z, "#8dfff1"));
      this.createPortal("aurora", "Cổng Aurora", -38, 21, "#6ff5cd", { checkpoint: "aurora" });
    }

    createCrimsonForge() {
      const THREE = this.THREE;
      const metal = new THREE.MeshStandardMaterial({ color: 0x48231f, emissive: 0xff4b2f, emissiveIntensity: 0.11, metalness: 0.6, roughness: 0.38 });
      const lava = new THREE.MeshBasicMaterial({ color: 0xff5a32, transparent: true, opacity: 0.82 });
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2;
        const radius = 10 + (index % 4) * 5;
        const column = new THREE.Mesh(new THREE.BoxGeometry(2 + (index % 2), 3 + (index % 5) * 1.1, 2), metal);
        column.position.set(52 + Math.cos(angle) * radius, 2.5 + (index % 5) * 0.55, 24 + Math.sin(angle) * radius);
        column.rotation.y = angle;
        column.castShadow = true;
        this.world.add(column);
      }
      for (let index = 0; index < 8; index += 1) {
        const stream = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 10), lava.clone());
        stream.rotation.x = -Math.PI / 2;
        stream.rotation.z = (index / 8) * Math.PI * 2;
        stream.position.set(52 + Math.cos(stream.rotation.z) * 16, 1.11, 24 + Math.sin(stream.rotation.z) * 16);
        this.world.add(stream);
      }
      this.createPortal("crimson", "Cổng Crimson", 39, 24, "#ff8365", { checkpoint: "crimson" });
    }

    createVoidGarden() {
      const THREE = this.THREE;
      const trunk = new THREE.MeshStandardMaterial({ color: 0x24143e, emissive: 0x7a39cc, emissiveIntensity: 0.12, roughness: 0.7 });
      const crown = new THREE.MeshStandardMaterial({ color: 0x4d247d, emissive: 0xbb62ff, emissiveIntensity: 0.2, transparent: true, opacity: 0.86 });
      for (let index = 0; index < 28; index += 1) {
        const angle = (index / 28) * Math.PI * 2 + (index % 5) * 0.16;
        const radius = 9 + (index * 9) % 26;
        const height = 3 + (index % 4) * 1.1;
        const tree = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, height, 7), trunk);
        stem.position.y = height / 2;
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + (index % 3) * 0.3, 1), crown);
        leaves.position.y = height + 0.6;
        tree.add(stem, leaves);
        tree.position.set(2 + Math.cos(angle) * radius, 1.05, -62 + Math.sin(angle) * radius);
        this.world.add(tree);
      }
      this.createPortal("void", "Cổng Void", 2, -45, "#ac7aff", { checkpoint: "void" });
      this.createPortal("dungeon-entry", "Bí cảnh Hư Không", -12, -69, "#ff67ca", { dungeon: "nexus-depths" });
    }

    createDungeon() {
      const THREE = this.THREE;
      const arena = new THREE.Mesh(
        new THREE.CylinderGeometry(13, 15, 1.2, 56),
        new THREE.MeshStandardMaterial({ color: 0x170b2e, emissive: 0x6a2ca8, emissiveIntensity: 0.15, metalness: 0.34 })
      );
      arena.position.set(76, 0.5, -66);
      this.world.add(arena);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(10, 0.18, 10, 80),
        new THREE.MeshBasicMaterial({ color: 0xff66ca, transparent: true, opacity: 0.7 })
      );
      ring.position.set(76, 1.15, -66);
      ring.rotation.x = Math.PI / 2;
      ring.userData.spin = 0.2;
      this.world.add(ring);
      this.addWorldLabel("Nexus Depths · Dungeon", 76, 5.2, -66, "#ff78d3", 0.92);
      this.createPortal("dungeon-exit", "Trở về Void Garden", 76, -55, "#72eaff", { dungeonExit: true });
    }

    createWeatherField() {
      const THREE = this.THREE;
      const count = this.state.settings.reduceEffects ? 60 : 180;
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 55;
        positions[index * 3 + 1] = 2 + Math.random() * 20;
        positions[index * 3 + 2] = (Math.random() - 0.5) * 55;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      this.weatherField = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: 0.26, color: 0x79f7ff, transparent: true, opacity: 0.48 })
      );
      this.scene.add(this.weatherField);
    }

    addWorldLabel(text, x, y, z, color = "#ffffff", scale = 1) {
      const THREE = this.THREE;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = "800 42px Inter, Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowBlur = 18;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(10 * scale, 2.5 * scale, 1);
      this.world.add(sprite);
      return sprite;
    }

    createPortal(id, name, x, z, color, data = {}) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.17, 12, 64),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.5),
          emissive: new THREE.Color(color),
          emissiveIntensity: 1.2,
          metalness: 0.58,
          roughness: 0.2
        })
      );
      ring.rotation.y = Math.PI / 2;
      ring.userData.spin = 0.45;
      group.add(ring);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
      );
      inner.rotation.y = Math.PI / 2;
      group.add(inner);
      group.position.set(x, 3.2, z);
      group.userData = { type: "portal", id, name, ...data };
      this.world.add(group);
      this.portals.set(id, group);
      return group;
    }

    createCollectible(id, itemId, x, z, color) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.62),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.85,
          metalness: 0.35,
          roughness: 0.18
        })
      );
      crystal.castShadow = true;
      group.add(crystal);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.04, 8, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      group.position.set(x, 2.35, z);
      group.userData = { type: "collectible", id, itemId, floatBase: 2.35 };
      this.world.add(group);
      this.collectibles.set(id, group);
      return group;
    }

    createNpc(id, name, x, z, color) {
      const mesh = this.createCharacterMesh({ body: color, accent: "#f5fbff", scale: 0.88, label: name });
      mesh.position.set(x, 1.08, z);
      mesh.userData = { type: "npc", id, name };
      this.world.add(mesh);
      this.npcs.set(id, mesh);
      return mesh;
    }

    createCharacterMesh({ body = "#6deeff", accent = "#ff65c8", scale = 1 } = {}) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      group.scale.setScalar(scale);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: body, roughness: 0.42, metalness: 0.18 });
      const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3, roughness: 0.28 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.05, 7, 12), bodyMaterial);
      torso.position.y = 1.38;
      torso.castShadow = true;
      group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), accentMaterial);
      head.position.y = 2.48;
      head.castShadow = true;
      group.add(head);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.045, 8, 32), accentMaterial);
      halo.position.y = 2.78;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.64, 5, 8), bodyMaterial);
      const rightLeg = leftLeg.clone();
      leftLeg.position.set(-0.22, 0.42, 0);
      rightLeg.position.set(0.22, 0.42, 0);
      group.add(leftLeg, rightLeg);
      group.userData.parts = { leftLeg, rightLeg, torso, halo };
      return group;
    }

    createActors() {
      this.playerMesh = this.createCharacterMesh({ body: "#6ceeff", accent: "#ff72cf", scale: 1 });
      this.playerMesh.name = "LyraH";
      this.world.add(this.playerMesh);

      const weapon = new this.THREE.Mesh(
        new this.THREE.BoxGeometry(0.08, 1.55, 0.18),
        new this.THREE.MeshStandardMaterial({ color: 0xeafcff, emissive: 0x65eaff, emissiveIntensity: 0.72, metalness: 0.68, roughness: 0.18 })
      );
      weapon.position.set(0.62, 1.35, 0);
      weapon.rotation.z = -0.28;
      this.playerMesh.add(weapon);
      this.playerWeapon = weapon;

      const shadow = new this.THREE.Mesh(
        new this.THREE.CircleGeometry(0.78, 24),
        new this.THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 1.08;
      this.world.add(shadow);
      this.playerShadow = shadow;

      [
        ["aurora-wisp-1", "aurora-wisp", -45, 19],
        ["aurora-wisp-2", "aurora-wisp", -57, 8],
        ["aurora-wisp-3", "aurora-wisp", -61, 29],
        ["forge-hound-1", "forge-hound", 47, 28],
        ["forge-hound-2", "forge-hound", 62, 14],
        ["void-stalker-1", "void-stalker", -7, -56],
        ["void-stalker-2", "void-stalker", 15, -57],
        ["nexus-warden", "nexus-warden", 8, -73],
        ["dungeon-stalker-1", "void-stalker", 71, -67],
        ["dungeon-stalker-2", "void-stalker", 81, -64]
      ].forEach(([id, type, x, z]) => this.createEnemy(id, type, x, z));
    }

    createEnemy(id, type, x, z) {
      const THREE = this.THREE;
      const profile = ENEMY_ARCHETYPES[type];
      const scale = profile.boss ? 2.25 : type === "forge-hound" ? 1.15 : 1;
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(profile.color).multiplyScalar(0.55),
        emissive: new THREE.Color(profile.color),
        emissiveIntensity: profile.boss ? 0.7 : 0.35,
        roughness: 0.4,
        metalness: 0.2
      });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88 * scale, 1), material);
      body.position.y = 1.6 * scale;
      body.castShadow = true;
      group.add(body);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.19 * scale, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      eye.position.set(0, 1.68 * scale, 0.78 * scale);
      group.add(eye);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 * scale, 0.055 * scale, 8, 36),
        new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: 0.65 })
      );
      ring.position.y = 1.6 * scale;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      group.position.set(x, 1.05, z);
      group.userData = {
        type: "enemy",
        id,
        archetype: type,
        name: profile.name,
        health: profile.health,
        maxHealth: profile.health,
        attack: profile.attack,
        speed: profile.speed,
        element: profile.element,
        xp: profile.xp,
        drop: profile.drop,
        boss: Boolean(profile.boss),
        homeX: x,
        homeZ: z,
        lastAttackAt: 0,
        status: {},
        defeated: false,
        respawnAt: 0,
        floatBase: 1.05,
        body,
        ring
      };
      this.world.add(group);
      this.enemies.set(id, group);
      return group;
    }

    applyStateToWorld() {
      const player = this.state.player;
      this.playerMesh.position.set(player.x, player.y, player.z);
      this.playerMesh.rotation.y = player.rotation;
      this.playerShadow.position.set(player.x, 1.08, player.z);
      this.state.collectedNodes.forEach((id) => {
        const node = this.collectibles.get(id);
        if (node) node.visible = false;
      });
      Object.entries(this.state.defeated || {}).forEach(([id, record]) => {
        const enemy = this.enemies.get(id);
        if (!enemy || !record?.defeated) return;
        enemy.userData.health = 0;
        enemy.userData.defeated = true;
        enemy.userData.respawnAt = Number(record.respawnAt || 0);
        enemy.visible = false;
      });
      Object.keys(this.state.checkpoints).forEach((id) => {
        const portal = this.portals.get(id);
        if (portal) portal.userData.unlocked = Boolean(this.state.checkpoints[id]);
      });
      this.setElement(this.state.player.element, false);
      this.updateCamera(true);
    }

    listen(target, event, handler, options) {
      target?.addEventListener?.(event, handler, options);
      this.cleanup.push(() => target?.removeEventListener?.(event, handler, options));
    }

    bindShellEvents() {
      this.listen(this.root, "click", (event) => {
        const continueButton = event.target.closest("[data-har-continue]");
        if (continueButton) return this.startGame({ fresh: false });
        const newButton = event.target.closest("[data-har-new]");
        if (newButton) return this.startGame({ fresh: true });
        const panelButton = event.target.closest("[data-har-panel]");
        if (panelButton) return this.openPanel(panelButton.dataset.harPanel);
        if (event.target.closest("[data-har-panel-close]")) return this.closePanel();
        if (event.target.closest("[data-har-fullscreen]")) return this.toggleFullscreen();
        if (event.target.closest("[data-har-pause]")) return this.togglePause();
        const action = event.target.closest("[data-har-action]")?.dataset.harAction;
        if (action) return this.performAction(action);
        const element = event.target.closest("[data-element]")?.dataset.element;
        if (element) return this.setElement(element);
        const touchAction = event.target.closest("[data-touch-action]")?.dataset.touchAction;
        if (touchAction) return this.performAction(touchAction);
      });
    }

    bindGameEvents() {
      const canvas = this.root.querySelector("[data-har-world]");
      this.listen(root, "keydown", (event) => {
        if (!this.running || this.destroyed) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
        const handled = [
          "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
          "Space", "KeyF", "KeyE", "KeyR", "KeyQ", "KeyG", "KeyT", "Tab", "Escape",
          "KeyI", "KeyM", "KeyJ", "KeyK", "KeyP", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"
        ];
        if (handled.includes(event.code)) event.preventDefault();
        if (event.repeat && !["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
        this.keys.add(event.code);
        const actions = {
          KeyF: "attack",
          KeyE: "skill",
          KeyR: "ultimate",
          KeyQ: "dodge",
          KeyG: "interact",
          KeyT: "interact",
          Space: "jump",
          Tab: "lock"
        };
        if (actions[event.code]) this.performAction(actions[event.code]);
        if (event.code === "Escape") {
          if (!this.root.querySelector("[data-har-dialogue]").hidden) this.closeDialogue();
          else if (this.currentPanel) this.closePanel();
          else this.togglePause();
        }
        const panels = { KeyI: "inventory", KeyM: "map", KeyJ: "quests", KeyK: "skills", KeyP: "party" };
        if (panels[event.code]) this.openPanel(panels[event.code]);
        const elementIds = Object.keys(ELEMENTS);
        if (/^Digit[1-6]$/.test(event.code)) this.setElement(elementIds[Number(event.code.slice(-1)) - 1]);
      });
      this.listen(root, "keyup", (event) => this.keys.delete(event.code));
      this.listen(root, "blur", () => this.keys.clear());
      this.listen(root, "resize", () => this.resize());
      this.listen(document, "visibilitychange", () => {
        this.visible = document.visibilityState !== "hidden";
        if (!this.visible) {
          this.runtime?.pause?.({ gameId: GAME_ID, reason: "hidden-tab" });
          this.saveProgress("Ẩn tab");
        } else if (!this.paused) {
          this.lastFrameAt = performance.now();
          this.runtime?.resume?.({ gameId: GAME_ID });
        }
      });
      this.listen(root, "online", () => {
        this.toast("Đã có mạng. Đang kiểm tra máy chủ realtime...", "success");
        this.initRealtime();
        this.syncCloud(false);
      });
      this.listen(root, "offline", () => {
        this.authoritative = false;
        this.state.party.status = "offline";
        this.state.party.integrity = "local-simulation";
        this.updateConnectionUi();
      });

      this.listen(canvas, "contextmenu", (event) => event.preventDefault());
      this.listen(canvas, "pointerdown", (event) => {
        if (event.button === 2 || event.pointerType === "touch") {
          this.draggingCamera = true;
          this.pointerStart = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture?.(event.pointerId);
        } else if (event.button === 0) {
          this.attack("attack");
        }
      });
      this.listen(canvas, "pointermove", (event) => {
        if (!this.draggingCamera || !this.pointerStart) return;
        const sensitivity = clamp(this.state.settings.cameraSensitivity, 10, 100) / 100;
        this.cameraYaw -= (event.clientX - this.pointerStart.x) * 0.006 * sensitivity;
        this.cameraPitch = clamp(this.cameraPitch + (event.clientY - this.pointerStart.y) * 0.0035 * sensitivity, 0.18, 1.05);
        this.pointerStart = { x: event.clientX, y: event.clientY };
      });
      const stopCameraDrag = (event) => {
        this.draggingCamera = false;
        this.pointerStart = null;
        try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
      };
      this.listen(canvas, "pointerup", stopCameraDrag);
      this.listen(canvas, "pointercancel", stopCameraDrag);
      this.listen(canvas, "wheel", (event) => {
        event.preventDefault();
        this.cameraDistance = clamp(this.cameraDistance + Math.sign(event.deltaY) * 1.25, 6.5, 20);
      }, { passive: false });

      this.bindTouchJoystick();
    }

    bindTouchJoystick() {
      const joystick = this.root.querySelector("[data-har-joystick]");
      const nub = joystick?.querySelector("i");
      if (!joystick || !nub) return;
      let pointerId = null;
      const move = (event) => {
        if (pointerId !== event.pointerId) return;
        const rect = joystick.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const radius = rect.width * 0.32;
        const length = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, radius / length);
        const x = dx * scale;
        const y = dy * scale;
        nub.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        this.touchMove.x = clamp(x / radius, -1, 1);
        this.touchMove.z = clamp(-y / radius, -1, 1);
      };
      const end = (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        this.touchMove = { x: 0, z: 0 };
        nub.style.transform = "translate(-50%, -50%)";
      };
      this.listen(joystick, "pointerdown", (event) => {
        pointerId = event.pointerId;
        joystick.setPointerCapture?.(event.pointerId);
        move(event);
      });
      this.listen(joystick, "pointermove", move);
      this.listen(joystick, "pointerup", end);
      this.listen(joystick, "pointercancel", end);
    }

    performAction(action) {
      if (!this.running || this.paused || this.destroyed) return;
      if (action === "attack") this.attack("attack");
      else if (action === "skill") this.attack("skill");
      else if (action === "ultimate") this.attack("ultimate");
      else if (action === "dodge") this.dodge();
      else if (action === "jump") this.jumpOrGlide();
      else if (action === "interact") this.interact();
      else if (action === "lock") this.toggleTargetLock();
    }

    frame(time) {
      if (this.destroyed) return;
      const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameAt) / 1000));
      this.lastFrameAt = time;

      if (this.visible && this.renderer && this.scene && this.camera) {
        if (this.running && !this.paused && !this.menuPaused) {
          this.pollGamepad();
          this.updatePlayer(dt, time);
          if (!this.authoritative) this.updateEnemies(dt, time);
          this.updateWorld(dt, time);
          this.updateEffects(dt);
          this.updateNearby();
          this.sendRealtimeInput(time);
          this.state.playTime += dt;
          this.state.worldTime = (this.state.worldTime + dt * this.worldHoursPerSecond) % 24;
        }
        this.updateCamera(false, dt);
        this.renderer.render(this.scene, this.camera);
        this.trackFps(time);
        if (time - this.lastUiAt > 120) {
          this.lastUiAt = time;
          this.updateUi(false);
        }
        if (time - this.lastMinimapAt > 180) {
          this.lastMinimapAt = time;
          this.renderMinimap();
        }
      }
      this.frameHandle = requestAnimationFrame((next) => this.frame(next));
    }

    pollGamepad() {
      const pads = root.navigator?.getGamepads?.() || [];
      const pad = Array.from(pads).find(Boolean);
      if (!pad) {
        this.gamepadMove = { x: 0, z: 0 };
        return;
      }
      this.gamepadMove = {
        x: Math.abs(pad.axes[0] || 0) > 0.16 ? pad.axes[0] : 0,
        z: Math.abs(pad.axes[1] || 0) > 0.16 ? -(pad.axes[1] || 0) : 0
      };
      const current = pad.buttons.map((button) => button.pressed);
      const previous = this.gamepads[pad.index] || [];
      if (current[0] && !previous[0]) this.attack("attack");
      if (current[1] && !previous[1]) this.dodge();
      if (current[2] && !previous[2]) this.attack("skill");
      if (current[3] && !previous[3]) this.jumpOrGlide();
      if (current[4] && !previous[4]) this.interact();
      this.gamepads[pad.index] = current;
      const rightX = Math.abs(pad.axes[2] || 0) > 0.15 ? pad.axes[2] : 0;
      const rightY = Math.abs(pad.axes[3] || 0) > 0.15 ? pad.axes[3] : 0;
      this.cameraYaw -= rightX * 0.045;
      this.cameraPitch = clamp(this.cameraPitch + rightY * 0.025, 0.18, 1.05);
    }

    movementInput() {
      const keyboardX = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
      const keyboardZ = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
      const gamepad = this.gamepadMove || { x: 0, z: 0 };
      let x = clamp(keyboardX + this.touchMove.x + gamepad.x, -1, 1);
      let z = clamp(keyboardZ + this.touchMove.z + gamepad.z, -1, 1);
      const length = Math.hypot(x, z);
      if (length > 1) {
        x /= length;
        z /= length;
      }
      return { x, z, active: length > 0.03 };
    }

    updatePlayer(dt, time) {
      const input = this.movementInput();
      const player = this.state.player;
      const sprinting = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && input.active && player.stamina > 0;
      const staminaBonus = Number(this.state.skills.staminaCore || 0) * 10;
      player.maxStamina = 100 + staminaBonus;
      const speed = sprinting ? 8.2 : 5.35;
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      let dx = (forwardX * input.z + rightX * input.x) * speed * dt;
      let dz = (forwardZ * input.z + rightZ * input.x) * speed * dt;

      if (this.dodgeUntil && time < this.dodgeUntil) {
        dx *= 2.25;
        dz *= 2.25;
      }

      if (input.active) {
        const nextX = clamp(player.x + dx, -WORLD_LIMIT, WORLD_LIMIT);
        const nextZ = clamp(player.z + dz, -WORLD_LIMIT, WORLD_LIMIT);
        const traveled = Math.hypot(nextX - player.x, nextZ - player.z);
        player.x = nextX;
        player.z = nextZ;
        player.rotation = Math.atan2(dx, dz);
        this.playerMesh.rotation.y = player.rotation;
        this.state.stats.distance += traveled;
        const legs = this.playerMesh.userData.parts;
        if (legs) {
          const stride = Math.sin(time * (sprinting ? 0.018 : 0.012)) * 0.38;
          legs.leftLeg.rotation.x = stride;
          legs.rightLeg.rotation.x = -stride;
        }
      }

      if (sprinting) player.stamina = clamp(player.stamina - dt * 20, 0, player.maxStamina);
      else if (!this.gliding) player.stamina = clamp(player.stamina + dt * 15, 0, player.maxStamina);

      if (!this.isGrounded) {
        const gravity = this.gliding && player.stamina > 0 ? -5.2 : -18;
        this.verticalVelocity += gravity * dt;
        if (this.gliding) player.stamina = clamp(player.stamina - dt * 11, 0, player.maxStamina);
        if (player.stamina <= 0) this.gliding = false;
        player.y += this.verticalVelocity * dt;
        if (player.y <= 1.08) {
          player.y = 1.08;
          this.verticalVelocity = 0;
          this.isGrounded = true;
          this.gliding = false;
        }
      }

      this.playerMesh.position.set(player.x, player.y, player.z);
      this.playerShadow.position.set(player.x, 1.08, player.z);
      this.playerShadow.material.opacity = clamp(0.34 - (player.y - 1.08) * 0.028, 0.08, 0.34);
      const zone = this.zoneAt(player.x, player.z);
      if (zone.id !== this.currentZone.id) {
        this.currentZone = zone;
        this.toast(`${zone.name} · ${zone.weather}`);
        this.updateWeatherAppearance();
      }
      this.trainingActive = Math.hypot(player.x - 17, player.z + 10) < 7;
    }

    updateEnemies(dt, time) {
      const player = this.state.player;
      this.enemies.forEach((enemy) => {
        const data = enemy.userData;
        if (data.defeated) {
          if (data.respawnAt && Date.now() >= data.respawnAt && !(data.boss && this.state.quests.warden?.status === "completed")) {
            data.health = data.maxHealth;
            data.defeated = false;
            data.respawnAt = 0;
            enemy.position.set(data.homeX, data.floatBase, data.homeZ);
            enemy.visible = true;
            delete this.state.defeated[data.id];
          }
          return;
        }

        enemy.position.y = data.floatBase + Math.sin(time * 0.002 + data.homeX) * 0.2;
        data.ring.rotation.z += dt * (data.boss ? 0.9 : 1.5);
        const distance = Math.hypot(player.x - enemy.position.x, player.z - enemy.position.z);
        if (distance < (data.boss ? 25 : 14) && player.health > 0) {
          enemy.lookAt(player.x, enemy.position.y, player.z);
          if (distance > 2.1) {
            enemy.position.x += ((player.x - enemy.position.x) / distance) * data.speed * dt;
            enemy.position.z += ((player.z - enemy.position.z) / distance) * data.speed * dt;
          } else if (time - data.lastAttackAt > (data.boss ? 1250 : 900)) {
            data.lastAttackAt = time;
            this.damagePlayer(data.attack, data.name);
          }
        } else {
          const homeDistance = Math.hypot(data.homeX - enemy.position.x, data.homeZ - enemy.position.z);
          if (homeDistance > 0.3) {
            enemy.position.x += ((data.homeX - enemy.position.x) / homeDistance) * dt * 1.2;
            enemy.position.z += ((data.homeZ - enemy.position.z) / homeDistance) * dt * 1.2;
          }
        }
      });
    }

    updateWorld(dt, time) {
      if (this.starfield) this.starfield.rotation.y += dt * 0.0025;
      if (this.centralCore) {
        this.centralCore.position.y = this.centralCore.userData.floatBase + Math.sin(time * 0.0015) * 0.32;
        this.centralCore.rotation.y += dt * 0.28;
      }
      this.world.traverse((object) => {
        if (object.userData?.spin) object.rotation.z += dt * object.userData.spin;
      });
      this.collectibles.forEach((node) => {
        if (!node.visible) return;
        node.position.y = node.userData.floatBase + Math.sin(time * 0.002 + node.position.x) * 0.25;
        node.rotation.y += dt * 0.72;
      });
      this.portals.forEach((portal) => {
        portal.rotation.y += dt * 0.08;
      });

      const dayAmount = (Math.sin(((this.state.worldTime - 6) / 24) * Math.PI * 2) + 1) / 2;
      this.scene.background.setRGB(0.018 + dayAmount * 0.035, 0.026 + dayAmount * 0.04, 0.07 + dayAmount * 0.08);
      this.scene.fog.color.copy(this.scene.background);
      this.hemisphereLight.intensity = 0.85 + dayAmount * 1.2;
      this.sunLight.intensity = 0.45 + dayAmount * 2.15;
      this.hLight.intensity = 35 + (1 - dayAmount) * 25;

      if (this.weatherField) {
        this.weatherField.position.set(this.state.player.x, 0, this.state.player.z);
        const positions = this.weatherField.geometry.attributes.position.array;
        for (let index = 1; index < positions.length; index += 3) {
          positions[index] -= dt * (this.currentZone.id === "crimson" ? 1.1 : 3.2);
          if (positions[index] < 1) positions[index] = 18 + Math.random() * 8;
        }
        this.weatherField.geometry.attributes.position.needsUpdate = true;
      }
    }

    updateWeatherAppearance() {
      if (!this.weatherField) return;
      const colors = { central: 0x72eaff, aurora: 0x9effe9, crimson: 0xff8a62, void: 0xc087ff };
      this.weatherField.material.color.setHex(colors[this.currentZone.id] || colors.central);
      this.weatherField.material.opacity = this.currentZone.id === "central" ? 0.18 : 0.58;
    }

    updateEffects(dt) {
      this.effects = this.effects.filter((effect) => {
        effect.life -= dt;
        effect.mesh.scale.multiplyScalar(1 + dt * effect.grow);
        effect.mesh.material.opacity = clamp(effect.life / effect.maxLife, 0, 1) * effect.opacity;
        effect.mesh.rotation.y += dt * 3;
        if (effect.life <= 0) {
          effect.mesh.parent?.remove(effect.mesh);
          effect.mesh.geometry?.dispose?.();
          effect.mesh.material?.dispose?.();
          return false;
        }
        return true;
      });
    }

    zoneAt(x, z) {
      let nearest = ZONES[0];
      let best = Infinity;
      ZONES.forEach((zone) => {
        const distance = Math.hypot(x - zone.x, z - zone.z);
        if (distance < best) {
          best = distance;
          nearest = zone;
        }
      });
      if (Math.hypot(x - 76, z + 66) < 18) {
        return { id: "dungeon", name: "Nexus Depths", weather: "Nhiễu lượng tử", color: "#ff70cf", x: 76, z: -66, radius: 18 };
      }
      return nearest;
    }

    updateCamera(immediate = false, dt = 0.016) {
      if (!this.camera || !this.playerMesh) return;
      const player = this.state.player;
      const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
      const desired = new this.THREE.Vector3(
        player.x + Math.sin(this.cameraYaw) * horizontal,
        player.y + 2.2 + Math.sin(this.cameraPitch) * this.cameraDistance,
        player.z + Math.cos(this.cameraYaw) * horizontal
      );
      if (immediate) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(player.x, player.y + 1.35, player.z);
    }

    jumpOrGlide() {
      if (this.isGrounded) {
        this.isGrounded = false;
        this.verticalVelocity = 7.2;
        this.gliding = false;
        this.sound("jump");
      } else if (this.verticalVelocity < 2 && this.state.player.stamina > 4) {
        this.gliding = !this.gliding;
        this.toast(this.gliding ? "Đã mở cánh lượn Astral." : "Đã thu cánh lượn.");
      }
    }

    dodge() {
      const now = performance.now();
      if (now - this.lastDodgeAt < 900 || this.state.player.stamina < 18) return;
      this.lastDodgeAt = now;
      this.dodgeUntil = now + 230;
      this.invulnerableUntil = now + 310;
      this.state.player.stamina = clamp(this.state.player.stamina - 18, 0, this.state.player.maxStamina);
      this.spawnPulse(this.state.player.x, this.state.player.y + 0.6, this.state.player.z, ELEMENTS[this.state.player.element].color, 0.42, 2.8);
      this.sound("dodge");
    }

    toggleTargetLock() {
      if (this.lockedTargetId) {
        this.lockedTargetId = "";
        this.toast("Đã bỏ khóa mục tiêu.");
        return;
      }
      const target = this.findTarget(18);
      if (target) {
        this.lockedTargetId = target.userData.id;
        this.toast(`Đã khóa ${target.userData.name}.`);
      } else {
        this.toast("Không có mục tiêu trong phạm vi.");
      }
    }

    findTarget(range = 4.2) {
      const locked = this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      if (locked?.visible && !locked.userData.defeated) {
        const distance = Math.hypot(locked.position.x - this.state.player.x, locked.position.z - this.state.player.z);
        if (distance <= range) return locked;
      }
      let winner = null;
      let best = range;
      this.enemies.forEach((enemy) => {
        if (!enemy.visible || enemy.userData.defeated) return;
        const distance = Math.hypot(enemy.position.x - this.state.player.x, enemy.position.z - this.state.player.z);
        if (distance < best) {
          best = distance;
          winner = enemy;
        }
      });
      const training = this.entities.get("training-core");
      if (training) {
        const distance = Math.hypot(training.position.x - this.state.player.x, training.position.z - this.state.player.z);
        if (distance < best) winner = training;
      }
      return winner;
    }

    attack(kind = "attack") {
      if (!this.running || this.paused || this.state.player.health <= 0) return;
      const now = performance.now();
      const cooldowns = { attack: 320, skill: 2600, ultimate: 9500 };
      const last = kind === "attack" ? this.lastAttackAt : kind === "skill" ? this.lastSkillAt : this.lastUltimateAt;
      if (now - last < cooldowns[kind]) return;
      if (kind === "ultimate" && this.state.player.ultimate < 100) {
        this.toast("Tuyệt kỹ chưa đủ năng lượng.");
        return;
      }

      if (kind === "attack") {
        this.lastAttackAt = now;
        this.combo = now <= this.comboUntil ? (this.combo % 3) + 1 : 1;
        this.comboUntil = now + 760;
      } else if (kind === "skill") {
        this.lastSkillAt = now;
      } else {
        this.lastUltimateAt = now;
        this.state.player.ultimate = 0;
      }

      const range = kind === "attack" ? 4.1 : kind === "skill" ? 8 : 12;
      const target = this.findTarget(range);
      const element = this.state.player.element;
      const damageBase = kind === "attack"
        ? 22 + this.combo * 7
        : kind === "skill"
          ? 68 + Number(this.state.skills.plasmaDrive || 0) * 9
          : 155;
      this.swingAnimation(kind);
      this.spawnPulse(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, ELEMENTS[element].color, kind === "ultimate" ? 1.2 : 0.42, kind === "ultimate" ? 8 : 3.2);
      this.sound(kind);

      if (this.authoritative) {
        this.emitInput({ action: kind, targetId: target?.userData?.id || "", power: 1 });
      } else if (target) {
        this.damageTarget(target, damageBase, element, kind);
      }
    }

    swingAnimation(kind) {
      if (!this.playerWeapon) return;
      const base = kind === "ultimate" ? 1.6 : kind === "skill" ? 1.15 : 0.75;
      this.playerWeapon.rotation.x = -base;
      root.setTimeout(() => {
        if (this.playerWeapon) this.playerWeapon.rotation.x = 0;
      }, kind === "ultimate" ? 340 : 160);
    }

    damageTarget(target, baseDamage, element, kind) {
      if (target.userData.type === "training") {
        this.recordTrainingDamage(baseDamage);
        this.spawnHitEffect(target.position, ELEMENTS[element].color);
        return;
      }
      const data = target.userData;
      if (data.defeated) return;
      const weapon = ITEMS[this.state.player.weapon] || ITEMS["starter-blade"];
      let damage = baseDamage + Number(weapon.attack || 0);
      let reaction = null;
      const now = performance.now();
      Object.entries(data.status || {}).forEach(([status, appliedAt]) => {
        if (now - appliedAt > 6000 || status === element) return;
        const key = [status, element].sort().join("+");
        if (ELEMENT_REACTIONS[key]) reaction = ELEMENT_REACTIONS[key];
      });
      if (reaction) {
        damage *= reaction.multiplier;
        if (reaction.heal) this.state.player.health = clamp(this.state.player.health + reaction.heal, 0, this.state.player.maxHealth);
        this.toast(`${reaction.name} · ${Math.round(damage)} sát thương`, "success");
        this.spawnPulse(target.position.x, target.position.y + 1, target.position.z, reaction.color, 0.8, 4.4);
      }
      damage = Math.max(1, Math.round(damage));
      data.status[element] = now;
      data.health = Math.max(0, data.health - damage);
      this.state.stats.totalDamage += damage;
      this.state.stats.highestHit = Math.max(this.state.stats.highestHit, damage);
      this.state.player.ultimate = clamp(this.state.player.ultimate + (kind === "attack" ? 8 : 15), 0, 100);
      this.spawnHitEffect(target.position, ELEMENTS[element].color);
      if (!data.health) this.defeatEnemy(target);
    }

    recordTrainingDamage(damage) {
      const now = performance.now();
      this.dpsSamples.push({ at: now, damage });
      this.dpsSamples = this.dpsSamples.filter((sample) => now - sample.at <= 5000);
      const total = this.dpsSamples.reduce((sum, sample) => sum + sample.damage, 0);
      const first = this.dpsSamples[0]?.at || now;
      const seconds = Math.max(1, (now - first) / 1000);
      const dps = Math.round(total / seconds);
      const element = this.root.querySelector("[data-har-dps]");
      element.textContent = `Training DPS · ${dps} · Hit ${Math.round(damage)}`;
      element.classList.add("is-active");
    }

    defeatEnemy(enemy) {
      const data = enemy.userData;
      data.defeated = true;
      data.health = 0;
      data.respawnAt = Date.now() + (data.boss ? 120000 : 25000);
      enemy.visible = false;
      this.state.defeated[data.id] = { defeated: true, respawnAt: data.respawnAt, at: nowIso() };
      this.state.stats.enemiesDefeated += 1;
      if (data.boss) this.state.stats.bossDefeated += 1;
      this.grantXp(data.xp);
      if (data.drop && (!data.boss || this.state.quests.warden?.status !== "completed")) this.addItem(data.drop, 1, `${data.name} rơi vật phẩm`);
      this.progressQuest(data.boss ? "boss" : "defeat", 1, { enemy: data.archetype });
      this.spawnNova(enemy.position.x, enemy.position.y + 1, enemy.position.z, ENEMY_ARCHETYPES[data.archetype].color);
      this.toast(`Đã đánh bại ${data.name} · +${data.xp} XP`, "success");
      this.saveProgress("Chiến thắng");
    }

    damagePlayer(amount, source = "Sinh vật") {
      if (performance.now() < this.invulnerableUntil || this.state.player.health <= 0) return;
      const guard = 1 - Number(this.state.skills.astralGuard || 0) * 0.08;
      const damage = Math.max(1, Math.round(amount * guard));
      this.state.player.health = Math.max(0, this.state.player.health - damage);
      this.invulnerableUntil = performance.now() + 420;
      this.spawnPulse(this.state.player.x, this.state.player.y + 1, this.state.player.z, "#ff5e72", 0.35, 2.6);
      if (!this.state.player.health) this.playerDefeated(source);
    }

    playerDefeated(source) {
      this.state.stats.deaths += 1;
      this.paused = true;
      this.runtime?.gameover?.({ gameId: GAME_ID, outcome: "defeated", source });
      this.openPanel("defeated");
      this.saveProgress("Bị đánh bại");
    }

    revive() {
      const checkpoint = ZONES.find((zone) => zone.id === this.state.player.checkpoint) || ZONES[0];
      this.state.player.health = this.state.player.maxHealth;
      this.state.player.stamina = this.state.player.maxStamina;
      this.teleport(checkpoint.x, checkpoint.z + 5, checkpoint.name);
      this.paused = false;
      this.closePanel();
      this.runtime?.restart?.({ gameId: GAME_ID, checkpoint: checkpoint.id });
      this.toast(`Đã hồi sinh tại ${checkpoint.name}.`, "success");
    }

    spawnHitEffect(position, color) {
      const mesh = new this.THREE.Mesh(
        new this.THREE.RingGeometry(0.25, 0.58, 28),
        new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: this.THREE.DoubleSide, depthWrite: false })
      );
      mesh.position.copy(position);
      mesh.position.y += 1.3;
      mesh.lookAt(this.camera.position);
      this.scene.add(mesh);
      this.effects.push({ mesh, life: 0.32, maxLife: 0.32, grow: 5, opacity: 0.9 });
    }

    spawnPulse(x, y, z, color, life = 0.5, size = 3) {
      if (!this.THREE || this.state.settings.reduceEffects) return;
      const mesh = new this.THREE.Mesh(
        new this.THREE.RingGeometry(0.25, 0.38, 44),
        new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: this.THREE.DoubleSide, depthWrite: false })
      );
      mesh.position.set(x, y, z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(size / 3);
      this.scene.add(mesh);
      this.effects.push({ mesh, life, maxLife: life, grow: 2.7, opacity: 0.75 });
    }

    spawnNova(x, y, z, color) {
      this.spawnPulse(x, y, z, color, 0.9, 5.5);
      if (this.state.settings.reduceEffects) return;
      for (let index = 0; index < 4; index += 1) {
        const mesh = new this.THREE.Mesh(
          new this.THREE.TetrahedronGeometry(0.16, 0),
          new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        );
        mesh.position.set(x + (Math.random() - 0.5) * 1.5, y + Math.random() * 1.4, z + (Math.random() - 0.5) * 1.5);
        this.scene.add(mesh);
        this.effects.push({ mesh, life: 0.65, maxLife: 0.65, grow: 1.2, opacity: 0.85 });
      }
    }

    updateNearby() {
      const player = this.state.player;
      const candidates = [];
      const add = (object, range = 3.5) => {
        if (!object?.visible) return;
        const distance = Math.hypot(object.position.x - player.x, object.position.z - player.z);
        if (distance <= range) candidates.push({ object, distance });
      };
      this.npcs.forEach((npc) => add(npc, 3.6));
      this.collectibles.forEach((node) => add(node, 3.1));
      this.portals.forEach((portal) => add(portal, 4.6));
      add(this.entities.get("training-core"), 4.4);
      candidates.sort((left, right) => left.distance - right.distance);
      this.nearby = candidates[0]?.object || null;
      const prompt = this.root.querySelector("[data-har-context]");
      if (!this.nearby) {
        prompt.hidden = true;
        return;
      }
      const data = this.nearby.userData;
      const label = data.type === "npc"
        ? `G / T · Nói chuyện với ${data.name}`
        : data.type === "collectible"
          ? `G · Thu thập ${ITEMS[data.itemId]?.name || "vật phẩm"}`
          : data.type === "training"
            ? "F · Tấn công Training Core để đo DPS"
            : `G · ${data.name}`;
      prompt.textContent = label;
      prompt.hidden = false;
    }

    interact() {
      const target = this.nearby;
      if (!target) {
        this.toast("Không có đối tượng để tương tác.");
        return;
      }
      const data = target.userData;
      if (data.type === "npc") return this.openDialogue(data.id);
      if (data.type === "collectible") return this.collectNode(target);
      if (data.type === "portal") return this.activatePortal(target);
      if (data.type === "training") {
        this.trainingActive = true;
        this.dpsSamples = [];
        this.root.querySelector("[data-har-dps]").classList.add("is-active");
        this.toast("Training Arena đã bắt đầu · tấn công lõi để đo DPS.");
      }
    }

    collectNode(node) {
      if (!node.visible || this.state.collectedNodes.includes(node.userData.id)) return;
      node.visible = false;
      this.state.collectedNodes.push(node.userData.id);
      this.addItem(node.userData.itemId, 1, "Thu thập trong thế giới");
      this.progressQuest("collect", 1, { item: node.userData.itemId });
      this.sound("collect");
      this.saveProgress("Thu thập vật phẩm");
    }

    activatePortal(portal) {
      const data = portal.userData;
      if (data.dungeon) {
        this.teleport(76, -60, "Nexus Depths");
        this.toast("Đã vào Bí cảnh Hư Không · co-op tối đa 4 người.");
        return;
      }
      if (data.dungeonExit) {
        this.teleport(0, -56, "Void Garden");
        return;
      }
      const checkpoint = data.checkpoint;
      if (!checkpoint) return;
      const zone = ZONES.find((item) => item.id === checkpoint);
      if (!this.state.activatedGates.includes(checkpoint) && checkpoint !== "central") {
        this.state.activatedGates.push(checkpoint);
        this.state.checkpoints[checkpoint] = true;
        portal.userData.unlocked = true;
        this.progressQuest("gate", 1, { checkpoint });
        this.toast(`Đã kích hoạt cổng ${zone?.name || checkpoint}.`, "success");
        this.saveProgress("Kích hoạt cổng");
      } else {
        this.state.player.checkpoint = checkpoint;
        this.toast(`Checkpoint đã đặt tại ${zone?.name || checkpoint}.`);
      }
    }

    openDialogue(npcId) {
      const dialogue = this.root.querySelector("[data-har-dialogue]");
      const name = this.root.querySelector("[data-har-dialogue-name]");
      const role = this.root.querySelector("[data-har-dialogue-role]");
      const text = this.root.querySelector("[data-har-dialogue-text]");
      const choices = this.root.querySelector("[data-har-dialogue-choices]");
      dialogue.hidden = false;
      if (npcId === "luma") {
        name.textContent = "Navigator Luma";
        role.textContent = "H-Central Navigation Corps";
        const active = this.state.quests.awakening?.status === "active";
        text.textContent = active
          ? "Lõi H đã nhận diện cộng hưởng của bạn. Aurora Vale đang phát tín hiệu cầu cứu; hãy giúp tôi tái lập mạng cổng trước khi Hư Không lan tới thành phố."
          : "Các cổng đang phản hồi theo tiến trình của bạn. Nếu bị lạc, hãy mở Bản đồ và quay lại checkpoint đã kích hoạt.";
        choices.innerHTML = `
          ${active ? '<button class="har-primary-button" type="button" data-dialogue-action="accept">Tôi sẽ tới Aurora Vale</button>' : ""}
          <button class="har-secondary-button" type="button" data-dialogue-action="map">Mở bản đồ</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Rời đi</button>`;
      } else {
        name.textContent = "Thợ rèn Kael";
        role.textContent = "Astral Forge";
        text.textContent = "Tôi có thể ghép Mảnh Aurora, Lõi Plasma và Sợi Hư Không thành trang bị thật. Nguyên liệu thiếu sẽ được ghi rõ, không có vật phẩm mẫu.";
        choices.innerHTML = `
          <button class="har-primary-button" type="button" data-dialogue-action="craft">Mở chế tạo</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Để sau</button>`;
      }
      choices.onclick = (event) => {
        const action = event.target.closest("[data-dialogue-action]")?.dataset.dialogueAction;
        if (!action) return;
        if (action === "accept") {
          this.progressQuest("talk", 1, { npc: "luma" });
          this.closeDialogue();
        } else if (action === "map") {
          this.closeDialogue();
          this.openPanel("map");
        } else if (action === "craft") {
          this.closeDialogue();
          this.openPanel("craft");
        } else if (action === "close") this.closeDialogue();
      };
    }

    closeDialogue() {
      this.root.querySelector("[data-har-dialogue]").hidden = true;
    }

    progressQuest(type, amount = 1, meta = {}) {
      const quest = QUESTS.find((item) => {
        const status = this.state.quests[item.id];
        if (status?.status !== "active" || item.type !== type) return false;
        if (item.enemy && item.enemy !== meta.enemy) return false;
        if (item.item && item.item !== meta.item) return false;
        if (item.recipe && item.recipe !== meta.recipe) return false;
        return true;
      });
      if (!quest) return;
      const status = this.state.quests[quest.id];
      status.progress = clamp(status.progress + amount, 0, quest.target);
      if (status.progress >= quest.target) this.completeQuest(quest);
      this.updateUi(true);
    }

    completeQuest(quest) {
      const status = this.state.quests[quest.id];
      if (!status || status.status === "completed") return;
      status.status = "completed";
      status.completedAt = nowIso();
      if (quest.reward?.xp) this.grantXp(quest.reward.xp);
      if (quest.reward?.item) this.addItem(quest.reward.item, quest.reward.amount || 1, `Nhiệm vụ: ${quest.title}`);
      const index = QUESTS.findIndex((item) => item.id === quest.id);
      const next = QUESTS[index + 1];
      if (next && this.state.quests[next.id]?.status === "locked") this.state.quests[next.id].status = "active";
      this.spawnNova(this.state.player.x, this.state.player.y + 1, this.state.player.z, "#78efff");
      this.toast(`Hoàn thành: ${quest.title}`, "success");
      this.dispatchReward({ xp: quest.reward?.xp || 0, questId: quest.id });
      this.saveProgress(`Hoàn thành ${quest.title}`);
    }

    grantXp(amount) {
      this.state.player.xp += Math.max(0, Number(amount) || 0);
      let threshold = this.levelThreshold(this.state.player.level);
      while (this.state.player.xp >= threshold) {
        this.state.player.xp -= threshold;
        this.state.player.level += 1;
        this.state.player.skillPoints += 1;
        this.state.player.maxHealth += 8;
        this.state.player.health = this.state.player.maxHealth;
        threshold = this.levelThreshold(this.state.player.level);
        this.toast(`Thăng cấp ${this.state.player.level} · +1 điểm kỹ năng`, "success");
      }
    }

    levelThreshold(level) {
      return 120 + Math.max(0, Number(level) - 1) * 70;
    }

    addItem(itemId, amount = 1, source = "") {
      if (!ITEMS[itemId]) return false;
      const current = this.state.inventory[itemId] || { quantity: 0, favorite: false, locked: false, acquiredAt: nowIso() };
      current.quantity = Math.max(0, Number(current.quantity || 0) + Math.max(1, Number(amount) || 1));
      current.lastSource = source;
      this.state.inventory[itemId] = current;
      this.toast(`+${amount} ${ITEMS[itemId].name}`, "success");
      return true;
    }

    removeItems(requirements) {
      const enough = Object.entries(requirements).every(([id, amount]) => Number(this.state.inventory[id]?.quantity || 0) >= Number(amount));
      if (!enough) return false;
      Object.entries(requirements).forEach(([id, amount]) => {
        this.state.inventory[id].quantity -= Number(amount);
        if (this.state.inventory[id].quantity <= 0) delete this.state.inventory[id];
      });
      return true;
    }

    craft(recipeId) {
      const recipe = RECIPES.find((item) => item.id === recipeId);
      if (!recipe) return;
      if (!this.removeItems(recipe.requires)) {
        this.toast("Chưa đủ nguyên liệu để chế tạo.", "error");
        return;
      }
      this.addItem(recipe.result, recipe.amount, `Chế tạo: ${recipe.name}`);
      this.state.stats.crafted += 1;
      this.progressQuest("craft", 1, { recipe: recipe.id });
      this.sound("craft");
      this.saveProgress(`Chế tạo ${recipe.name}`);
      this.renderCurrentPanel();
    }

    useItem(itemId) {
      const item = ITEMS[itemId];
      const record = this.state.inventory[itemId];
      if (!item || !record?.quantity || item.type !== "consumable") return;
      if (this.state.player.health >= this.state.player.maxHealth) {
        this.toast("HP đang đầy.");
        return;
      }
      this.state.player.health = clamp(this.state.player.health + Number(item.heal || 0), 0, this.state.player.maxHealth);
      record.quantity -= 1;
      if (record.quantity <= 0) delete this.state.inventory[itemId];
      this.sound("heal");
      this.toast(`Đã dùng ${item.name}.`, "success");
      this.saveProgress("Dùng vật phẩm");
      this.renderCurrentPanel();
    }

    equipItem(itemId) {
      const item = ITEMS[itemId];
      const record = this.state.inventory[itemId];
      if (!item || !record?.quantity || item.type !== "weapon") return;
      this.state.player.weapon = itemId;
      this.toast(`Đã trang bị ${item.name}.`, "success");
      this.saveProgress("Đổi trang bị");
      this.renderCurrentPanel();
    }

    teleport(x, z, label = "điểm đến") {
      this.state.player.x = clamp(x, -WORLD_LIMIT, WORLD_LIMIT);
      this.state.player.z = clamp(z, -WORLD_LIMIT, WORLD_LIMIT);
      this.state.player.y = 1.08;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.gliding = false;
      this.playerMesh.position.set(this.state.player.x, this.state.player.y, this.state.player.z);
      this.updateCamera(true);
      this.closePanel();
      this.spawnPulse(this.state.player.x, this.state.player.y + 0.2, this.state.player.z, "#76eaff", 0.8, 5);
      this.toast(`Đã dịch chuyển tới ${label}.`);
      this.saveProgress(`Dịch chuyển ${label}`);
    }

    setElement(elementId, notify = true) {
      if (!ELEMENTS[elementId]) return;
      this.state.player.element = elementId;
      this.root.querySelectorAll("[data-element]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.element === elementId)));
      if (this.playerWeapon?.material) {
        this.playerWeapon.material.emissive.set(ELEMENTS[elementId].color);
        this.playerWeapon.material.color.set(ELEMENTS[elementId].color);
      }
      if (notify) this.toast(`Lõi ${ELEMENTS[elementId].label} đã đồng bộ.`);
      this.updateUi(true);
    }

    activeQuest() {
      return QUESTS.find((quest) => this.state.quests[quest.id]?.status === "active") || null;
    }

    updateUi(force = false) {
      if (!this.root || !this.started) return;
      const player = this.state.player;
      const levelTarget = this.levelThreshold(player.level);
      const setWidth = (selector, value) => {
        const element = this.root.querySelector(selector);
        if (element) element.style.setProperty("--value", `${clamp(value, 0, 100)}%`);
      };
      setWidth("[data-har-health]", (player.health / player.maxHealth) * 100);
      setWidth("[data-har-stamina]", (player.stamina / player.maxStamina) * 100);
      setWidth("[data-har-xp]", (player.xp / levelTarget) * 100);
      const avatar = this.root.querySelector(".har-avatar");
      avatar?.setAttribute("data-level", String(player.level));
      this.root.querySelector("[data-har-player-name]").textContent = player.name;
      this.root.querySelector("[data-har-player-meta]").textContent = `Nhà du hành · ${ELEMENTS[player.element].label} · ${Math.round(player.health)}/${player.maxHealth} HP`;
      this.root.querySelector("[data-har-zone]").textContent = this.currentZone.name;
      this.root.querySelector("[data-har-weather]").textContent = this.currentZone.weather;
      const hour = Math.floor(this.state.worldTime);
      const minute = Math.floor((this.state.worldTime % 1) * 60);
      this.root.querySelector("[data-har-time]").textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      this.root.querySelector("[data-har-fps]").textContent = this.fps ? `${this.fps} FPS · ${this.renderer?.capabilities?.isWebGL2 ? "WebGL2" : "WebGL"}` : "Đang đo";
      this.root.querySelector("[data-har-minimap-label]").textContent = this.currentZone.name;
      const activeQuest = this.activeQuest();
      this.root.querySelector("[data-har-quest-title]").textContent = activeQuest?.title || "Hành trình hiện tại đã hoàn tất";
      this.root.querySelector("[data-har-quest-progress]").textContent = activeQuest
        ? `${activeQuest.description} · ${this.state.quests[activeQuest.id].progress}/${activeQuest.target}`
        : "Khám phá thế giới và chuẩn bị cho nội dung tiếp theo.";

      const boss = [...this.enemies.values()].find((enemy) => enemy.userData.boss && enemy.visible && !enemy.userData.defeated);
      const bossDistance = boss ? Math.hypot(player.x - boss.position.x, player.z - boss.position.z) : Infinity;
      const bossBar = this.root.querySelector("[data-har-boss]");
      bossBar.hidden = !(boss && bossDistance < 28);
      if (!bossBar.hidden) {
        this.root.querySelector("[data-har-boss-name]").textContent = boss.userData.name;
        this.root.querySelector("[data-har-boss-meter]").style.setProperty("--value", `${(boss.userData.health / boss.userData.maxHealth) * 100}%`);
      }
      if (!this.trainingActive && (!this.dpsSamples.length || performance.now() - this.dpsSamples.at(-1).at > 8000)) {
        this.root.querySelector("[data-har-dps]").classList.remove("is-active");
      }
      this.updateCooldowns();
      this.updateConnectionUi();
      if (force && this.currentPanel) this.renderCurrentPanel();
    }

    updateCooldowns() {
      const now = performance.now();
      const values = {
        attack: Math.max(0, 320 - (now - this.lastAttackAt)),
        skill: Math.max(0, 2600 - (now - this.lastSkillAt)),
        ultimate: this.state.player.ultimate >= 100 ? 0 : Math.max(0, 9500 - (now - this.lastUltimateAt)),
        dodge: Math.max(0, 900 - (now - this.lastDodgeAt))
      };
      Object.entries(values).forEach(([id, remaining]) => {
        const element = this.root.querySelector(`[data-cooldown="${id}"]`);
        const button = element?.closest(".har-action");
        if (element) element.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : id === "ultimate" ? `${Math.round(this.state.player.ultimate)}%` : "";
        if (button) button.dataset.ready = String(remaining <= 0 && (id !== "ultimate" || this.state.player.ultimate >= 100));
      });
    }

    renderMinimap() {
      const canvas = this.root.querySelector("[data-har-minimap]");
      const context = canvas?.getContext("2d");
      if (!context) return;
      const width = canvas.width;
      const center = width / 2;
      const scale = width / 220;
      context.clearRect(0, 0, width, width);
      const gradient = context.createRadialGradient(center, center, 4, center, center, center);
      gradient.addColorStop(0, "rgba(20,46,76,.9)");
      gradient.addColorStop(1, "rgba(2,6,18,.96)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(center, center, center - 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(112,225,255,.15)";
      context.lineWidth = 1;
      [30, 60, 90].forEach((radius) => {
        context.beginPath();
        context.arc(center, center, radius * scale, 0, Math.PI * 2);
        context.stroke();
      });
      const map = (x, z) => [center + x * scale, center + z * scale];
      ZONES.forEach((zone) => {
        const [x, y] = map(zone.x, zone.z);
        context.fillStyle = `${zone.color}22`;
        context.strokeStyle = `${zone.color}88`;
        context.beginPath();
        context.arc(x, y, zone.radius * scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (this.state.checkpoints[zone.id]) {
          context.fillStyle = zone.color;
          context.fillRect(x - 2, y - 2, 4, 4);
        }
      });
      this.enemies.forEach((enemy) => {
        if (!enemy.visible || enemy.userData.defeated) return;
        const [x, y] = map(enemy.position.x, enemy.position.z);
        context.fillStyle = enemy.userData.boss ? "#ff4f79" : "#ff9278";
        context.beginPath();
        context.arc(x, y, enemy.userData.boss ? 4.2 : 2.4, 0, Math.PI * 2);
        context.fill();
      });
      this.collectibles.forEach((node) => {
        if (!node.visible) return;
        const [x, y] = map(node.position.x, node.position.z);
        context.fillStyle = "#ffdc78";
        context.fillRect(x - 1.5, y - 1.5, 3, 3);
      });
      this.remotePlayers.forEach((remote) => {
        const [x, y] = map(remote.position.x, remote.position.z);
        context.fillStyle = "#ff78d2";
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
      });
      const [px, py] = map(this.state.player.x, this.state.player.z);
      context.save();
      context.translate(px, py);
      context.rotate(-this.state.player.rotation);
      context.fillStyle = "#ffffff";
      context.shadowColor = "#68eeff";
      context.shadowBlur = 10;
      context.beginPath();
      context.moveTo(0, -6);
      context.lineTo(4.5, 5);
      context.lineTo(0, 3);
      context.lineTo(-4.5, 5);
      context.closePath();
      context.fill();
      context.restore();
      context.strokeStyle = "rgba(109,236,255,.6)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(center, center, center - 3, 0, Math.PI * 2);
      context.stroke();
    }

    trackFps(time) {
      this.fpsFrames += 1;
      const elapsed = time - this.fpsStartedAt;
      if (elapsed < 1000) return;
      this.fps = Math.round((this.fpsFrames * 1000) / elapsed);
      this.fpsFrames = 0;
      this.fpsStartedAt = time;
      if (this.state.settings.quality === "auto") {
        if (this.fps < 42 && this.renderScale > 0.62) this.renderScale = Math.max(0.62, this.renderScale - 0.1);
        else if (this.fps > 57 && this.renderScale < 1) this.renderScale = Math.min(1, this.renderScale + 0.05);
        this.renderer.setPixelRatio(Math.min(2, (root.devicePixelRatio || 1) * this.renderScale));
        if (this.starfield) this.starfield.material.opacity = this.fps < 38 ? 0.35 : 0.8;
        if (this.weatherField) this.weatherField.visible = this.fps >= 30 || this.currentZone.id !== "central";
      }
    }

    resize() {
      if (!this.renderer || !this.camera) return;
      const stage = this.root.querySelector("[data-har-stage]");
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      const qualityRatios = { low: 0.65, medium: 0.85, high: 1, auto: this.renderScale };
      const ratio = qualityRatios[this.state.settings.quality] ?? 1;
      this.renderer.setPixelRatio(Math.min(2, (root.devicePixelRatio || 1) * ratio));
      this.renderer.setSize(width, height, false);
    }

    openPanel(type) {
      if (!this.started && type !== "settings") return;
      this.currentPanel = type;
      const panel = this.root.querySelector("[data-har-panel-root]");
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      if (!this.authoritative && !["party", "settings"].includes(type)) this.menuPaused = true;
      this.renderCurrentPanel();
    }

    closePanel() {
      this.currentPanel = "";
      this.menuPaused = false;
      const panel = this.root.querySelector("[data-har-panel-root]");
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    }

    renderCurrentPanel() {
      if (!this.currentPanel) return;
      const body = this.root.querySelector("[data-har-panel-body]");
      const title = this.root.querySelector("[data-har-panel-title]");
      const kicker = this.root.querySelector("[data-har-panel-kicker]");
      const panel = this.root.querySelector("[data-har-panel-root]");
      const renderers = {
        map: () => this.renderMapPanel(),
        quests: () => this.renderQuestPanel(),
        inventory: () => this.renderInventoryPanel(),
        craft: () => this.renderCraftPanel(),
        skills: () => this.renderSkillsPanel(),
        party: () => this.renderPartyPanel(),
        settings: () => this.renderSettingsPanel(),
        paused: () => this.renderPausePanel(),
        defeated: () => this.renderDefeatedPanel()
      };
      const meta = {
        map: ["Bản đồ Astral", "Astral Navigation", "#6feeff"],
        quests: ["Nhiệm vụ", "Mission Constellation", "#a986ff"],
        inventory: ["Kho đồ", "Asset Vault", "#65f2ba"],
        craft: ["Astral Forge", "Crafting Station", "#ffaf67"],
        skills: ["Cây kỹ năng", "Resonance Matrix", "#ff70ce"],
        party: ["Co-op 1–4", "Realtime Shard", "#73eaff"],
        settings: ["Thiết lập", "Graphics & Controls", "#ffd36b"],
        paused: ["Tạm dừng", "Game Paused", "#a78bff"],
        defeated: ["Lõi năng lượng cạn", "Mission Interrupted", "#ff6d78"]
      }[this.currentPanel] || ["Astral Console", "Holographic Console", "#6feeff"];
      title.textContent = meta[0];
      kicker.textContent = meta[1];
      panel.style.setProperty("--panel-accent", meta[2]);
      body.innerHTML = renderers[this.currentPanel]?.() || "<p>Chưa có dữ liệu.</p>";
      this.bindPanelControls();
    }

    renderMapPanel() {
      return `
        <div class="har-section">
          <h3>Astral Open World</h3>
          <p>Chỉ các cổng đã kích hoạt mới có thể dịch chuyển. Vị trí và checkpoint được lưu thật trong tiến trình.</p>
        </div>
        <ul class="har-list">
          ${ZONES.map((zone) => {
            const unlocked = Boolean(this.state.checkpoints[zone.id]);
            const current = this.currentZone.id === zone.id;
            return `<li class="har-list-item ${current ? "is-active" : ""}">
              <div><strong style="color:${zone.color}">${escapeHtml(zone.name)}</strong><span>${escapeHtml(zone.description)}</span><small>${escapeHtml(zone.weather)} · ${unlocked ? "Cổng đã kích hoạt" : "Chưa khám phá cổng"}</small></div>
              <div class="har-list-item__actions"><button class="har-chip ${unlocked ? "is-active" : ""}" type="button" data-panel-action="teleport" data-zone="${zone.id}" ${unlocked ? "" : "disabled"}>${current ? "Hiện tại" : "Dịch chuyển"}</button></div>
            </li>`;
          }).join("")}
          <li class="har-list-item ${this.currentZone.id === "dungeon" ? "is-active" : ""}">
            <div><strong style="color:#ff78d2">Nexus Depths</strong><span>Bí cảnh chiến đấu nằm sau cổng Void Garden.</span><small>${this.state.checkpoints.void ? "Vào bằng cổng Bí cảnh" : "Cần mở cổng Void"}</small></div>
            <span class="har-chip">Dungeon</span>
          </li>
        </ul>`;
    }

    renderQuestPanel() {
      return `<ul class="har-list">${QUESTS.map((quest, index) => {
        const status = this.state.quests[quest.id];
        const labels = { locked: "Chưa mở", active: "Đang theo dõi", completed: "Hoàn thành" };
        return `<li class="har-list-item ${status.status === "active" ? "is-active" : ""}">
          <div><strong>${String(index + 1).padStart(2, "0")} · ${escapeHtml(quest.title)}</strong><span>${escapeHtml(quest.description)}</span><small>${labels[status.status]} · ${status.progress}/${quest.target}${status.completedAt ? ` · ${new Date(status.completedAt).toLocaleString("vi-VN")}` : ""}</small>
          ${status.status !== "locked" ? `<div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${(status.progress / quest.target) * 100}%"></i></div><output>${Math.round((status.progress / quest.target) * 100)}%</output></div>` : ""}</div>
          <span class="har-chip ${status.status === "completed" ? "is-active" : ""}">${labels[status.status]}</span>
        </li>`;
      }).join("")}</ul>`;
    }

    renderInventoryPanel() {
      const filter = this.inventoryFilter || "all";
      const sort = this.inventorySort || "recent";
      let entries = Object.entries(this.state.inventory).filter(([, record]) => Number(record.quantity || 0) > 0);
      if (filter !== "all") entries = entries.filter(([id]) => ITEMS[id]?.type === filter);
      entries.sort((left, right) => {
        if (sort === "name") return ITEMS[left[0]].name.localeCompare(ITEMS[right[0]].name, "vi");
        if (sort === "quantity") return Number(right[1].quantity) - Number(left[1].quantity);
        return new Date(right[1].acquiredAt || 0) - new Date(left[1].acquiredAt || 0);
      });
      return `
        <div class="har-form-row">
          <label class="har-field">Loại<select data-inventory-filter><option value="all">Tất cả</option><option value="weapon">Vũ khí</option><option value="material">Nguyên liệu</option><option value="consumable">Tiêu hao</option></select></label>
          <label class="har-field">Sắp xếp<select data-inventory-sort><option value="recent">Mới nhận</option><option value="name">Tên</option><option value="quantity">Số lượng</option></select></label>
        </div>
        <div class="har-section" style="margin-top:10px"><p>${entries.length ? `${entries.length} loại vật phẩm đang sở hữu.` : "Chưa có vật phẩm phù hợp bộ lọc."}</p></div>
        <ul class="har-list">${entries.map(([id, record]) => {
          const item = ITEMS[id];
          const equipped = this.state.player.weapon === id;
          return `<li class="har-list-item ${equipped ? "is-active" : ""}">
            <div><strong>${record.favorite ? "★ " : ""}${escapeHtml(item.name)} ×${record.quantity}</strong><span>${escapeHtml(item.description)}</span><small>${escapeHtml(item.rarity)} · ${escapeHtml(item.type)}${record.lastSource ? ` · ${escapeHtml(record.lastSource)}` : ""}</small></div>
            <div class="har-list-item__actions">
              <button class="har-chip" type="button" data-panel-action="favorite" data-item="${id}" aria-label="Yêu thích">${record.favorite ? "★" : "☆"}</button>
              <button class="har-chip" type="button" data-panel-action="lock-item" data-item="${id}" aria-label="Khóa">${record.locked ? "Khóa" : "Mở"}</button>
              ${item.type === "weapon" ? `<button class="har-chip ${equipped ? "is-active" : ""}" type="button" data-panel-action="equip" data-item="${id}">${equipped ? "Đang dùng" : "Trang bị"}</button>` : ""}
              ${item.type === "consumable" ? `<button class="har-chip is-active" type="button" data-panel-action="use" data-item="${id}">Dùng</button>` : ""}
            </div>
          </li>`;
        }).join("")}</ul>
        <div class="har-inline-actions"><button class="har-secondary-button" type="button" data-panel-action="open-craft">Mở chế tạo</button></div>`;
    }

    renderCraftPanel() {
      return `
        <div class="har-section"><h3>Chế tạo kiểm tra nguyên liệu thật</h3><p>Vật phẩm chỉ được thêm vào kho sau khi đã trừ đủ nguyên liệu. Toàn bộ thay đổi có autosave.</p></div>
        <ul class="har-list">${RECIPES.map((recipe) => {
          const requirements = Object.entries(recipe.requires);
          const ready = requirements.every(([id, amount]) => Number(this.state.inventory[id]?.quantity || 0) >= amount);
          return `<li class="har-list-item ${ready ? "is-active" : ""}">
            <div><strong>${escapeHtml(recipe.name)}</strong><span>${requirements.map(([id, amount]) => `${ITEMS[id].name} ${this.state.inventory[id]?.quantity || 0}/${amount}`).join(" · ")}</span><small>Kết quả: ${recipe.amount} × ${ITEMS[recipe.result].name}</small></div>
            <button class="har-chip ${ready ? "is-active" : ""}" type="button" data-panel-action="craft" data-recipe="${recipe.id}" ${ready ? "" : "disabled"}>${ready ? "Chế tạo" : "Thiếu vật liệu"}</button>
          </li>`;
        }).join("")}</ul>`;
    }

    renderSkillsPanel() {
      const skills = [
        ["plasmaDrive", "Astral Drive", "Tăng 9 sát thương kỹ năng mỗi cấp.", 3],
        ["astralGuard", "Astral Guard", "Giảm 8% sát thương nhận vào mỗi cấp.", 3],
        ["staminaCore", "Stamina Core", "Tăng 10 stamina tối đa mỗi cấp.", 4]
      ];
      return `
        <div class="har-section"><h3>${this.state.player.skillPoints} điểm kỹ năng khả dụng</h3><p>Điểm nhận khi thăng cấp. Nâng cấp tác động trực tiếp vào chiến đấu và được lưu cùng nhân vật.</p></div>
        <ul class="har-list">${skills.map(([id, name, description, max]) => {
          const level = Number(this.state.skills[id] || 0);
          const canUpgrade = this.state.player.skillPoints > 0 && level < max;
          return `<li class="har-list-item ${level ? "is-active" : ""}">
            <div><strong>${name} · ${level}/${max}</strong><span>${description}</span><div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${(level / max) * 100}%"></i></div><output>Lv.${level}</output></div></div>
            <button class="har-chip ${canUpgrade ? "is-active" : ""}" type="button" data-panel-action="upgrade-skill" data-skill="${id}" ${canUpgrade ? "" : "disabled"}>${level >= max ? "Tối đa" : "+ Nâng"}</button>
          </li>`;
        }).join("")}</ul>`;
    }

    renderPartyPanel() {
      const connected = Boolean(this.socket?.connected);
      const members = this.state.party.members || [];
      const roomCode = this.state.party.roomCode || "";
      const statusCopy = !navigator.onLine
        ? "Thiết bị đang ngoại tuyến. Game tiếp tục chạy bằng mô phỏng local."
        : !connected
          ? "Realtime server chưa kết nối. Không hiển thị người chơi hoặc phòng giả."
          : roomCode
            ? `${members.length || 1}/4 người · ${this.state.party.integrity === "server-authoritative" ? "chiến đấu do server xác nhận" : "đang chờ snapshot server"}`
            : "Máy chủ sẵn sàng. Tạo hoặc nhập mã phòng tối đa 4 người.";
      return `
        <div class="har-section"><h3>${roomCode ? `Phòng ${escapeHtml(roomCode)}` : "Co-op thử nghiệm"}</h3><p>${escapeHtml(statusCopy)}</p></div>
        ${roomCode ? `
          <ul class="har-list">${members.length ? members.map((member) => `<li class="har-list-item"><div><strong>${escapeHtml(member.user?.name || member.name || "Nhà du hành")}</strong><span>${escapeHtml(member.role || "player")} · ${member.ready ? "Sẵn sàng" : "Trong phòng"}</span></div><span class="har-chip ${member.ready ? "is-active" : ""}">${member.ready ? "Ready" : "Online"}</span></li>`).join("") : '<li class="har-list-item"><div><strong>Bạn đang ở trong phòng</strong><span>Đang chờ dữ liệu presence từ máy chủ.</span></div></li>'}</ul>
          <div class="har-form-row"><label class="har-field" style="grid-column:1/-1">Chat tổ đội<input type="text" maxlength="240" data-party-chat placeholder="Nhập tin nhắn thật cho thành viên phòng"></label></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="send-chat">Gửi</button><button class="har-secondary-button" type="button" data-panel-action="leave-party">Rời phòng</button></div>
          <div class="har-section" style="margin-top:10px"><h3>Hoạt động phòng</h3><p>${(this.partyMessages || []).length ? (this.partyMessages || []).slice(-6).map((message) => `${escapeHtml(message.user?.name || "HH")}: ${escapeHtml(message.body)}`).join("<br>") : "Chưa có tin nhắn."}</p></div>
        ` : `
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="create-party" ${connected ? "" : "disabled"}>Tạo phòng 4 người</button></div>
          <div class="har-form-row"><label class="har-field" style="grid-column:1/-1">Mã phòng<input type="text" maxlength="8" data-party-code placeholder="Ví dụ: H7K2Q9"></label></div>
          <div class="har-inline-actions"><button class="har-secondary-button" type="button" data-panel-action="join-party" ${connected ? "" : "disabled"}>Tham gia phòng</button></div>
        `}
        <div class="har-section" style="margin-top:10px"><p>Phiên bản này xác nhận vị trí, tốc độ, nhịp tấn công, HP quái và sát thương trên server khi phòng realtime hoạt động. Redis/PostgreSQL shard bền vững sẽ là giai đoạn MMO-lite tiếp theo.</p></div>`;
    }

    renderSettingsPanel() {
      const record = this.savedRecord;
      const histories = record?.history || [];
      return `
        <div class="har-section"><h3>Đồ họa và điều khiển</h3><p>Chế độ Auto tự giảm độ phân giải, sao và thời tiết nếu FPS thấp.</p>
          <div class="har-form-row">
            <label class="har-field">Chất lượng<select data-setting="quality"><option value="auto">Tự động theo FPS</option><option value="low">Thấp</option><option value="medium">Vừa</option><option value="high">Cao</option></select></label>
            <label class="har-field">Âm lượng<input type="range" min="0" max="100" value="${this.state.settings.volume}" data-setting="volume"></label>
            <label class="har-field">Độ nhạy camera<input type="range" min="10" max="100" value="${this.state.settings.cameraSensitivity}" data-setting="cameraSensitivity"></label>
            <label class="har-field">Hiệu ứng<select data-setting="reduceEffects"><option value="false">Đầy đủ</option><option value="true">Giảm chuyển động</option></select></label>
          </div>
        </div>
        <div class="har-section"><h3>Điều khiển</h3><p>WASD di chuyển · Shift chạy · Space nhảy/lượn · F đánh · Q né · E kỹ năng · R tuyệt kỹ · G/T tương tác · Tab khóa mục tiêu · chuột phải xoay camera.</p></div>
        <div class="har-section"><h3>Lưu tiến trình</h3><p>${record ? `Local v${record.version} · ${new Date(record.updatedAt).toLocaleString("vi-VN")} · ${this.state.cloud.status}` : "Chưa có bản lưu."}</p>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="manual-save">Lưu checkpoint</button><button class="har-secondary-button" type="button" data-panel-action="sync-cloud">Đồng bộ tài khoản</button></div>
        </div>
        <ul class="har-list">${histories.length ? histories.slice().reverse().map((history) => `<li class="har-list-item"><div><strong>Phiên bản ${history.version}</strong><span>${escapeHtml(history.label || "Autosave")} · ${new Date(history.updatedAt).toLocaleString("vi-VN")}</span></div><button class="har-chip" type="button" data-panel-action="restore-save" data-version="${history.version}">Khôi phục</button></li>`).join("") : '<li class="har-list-item"><div><strong>Chưa có lịch sử</strong><span>Ba phiên bản gần nhất sẽ xuất hiện tại đây.</span></div></li>'}</ul>
        ${this.cloudConflict ? `<div class="har-section"><h3>Xung đột cloud save</h3><p>Cloud v${this.cloudConflict.version} mới hơn bản local. Chọn bản muốn giữ.</p><div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="use-cloud">Dùng bản cloud</button><button class="har-secondary-button" type="button" data-panel-action="keep-local">Giữ bản local</button></div></div>` : ""}`;
    }

    renderPausePanel() {
      return `<div class="har-section"><h3>HH Astral Realms đang tạm dừng</h3><p>Thời gian chơi và AI cục bộ không tiếp tục khi tạm dừng hoặc tab bị ẩn.</p></div>
        <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="resume">Tiếp tục</button><button class="har-secondary-button" type="button" data-panel-action="open-inventory">Kho đồ</button><button class="har-secondary-button" type="button" data-panel-action="open-settings">Thiết lập</button><button class="har-secondary-button" type="button" data-panel-action="exit-game">Về Game Center</button></div>`;
    }

    renderDefeatedPanel() {
      return `<div class="har-section"><h3>Nhân vật đã bị đánh bại</h3><p>Không mất vật phẩm. Bạn có thể hồi sinh tại checkpoint ${escapeHtml(ZONES.find((zone) => zone.id === this.state.player.checkpoint)?.name || "H-Central")}.</p></div>
        <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="revive">Hồi sinh</button><button class="har-secondary-button" type="button" data-panel-action="restore-last">Khôi phục bản lưu</button></div>`;
    }

    bindPanelControls() {
      const body = this.root.querySelector("[data-har-panel-body]");
      body.onclick = (event) => {
        const button = event.target.closest("[data-panel-action]");
        if (!button || button.disabled) return;
        this.handlePanelAction(button.dataset.panelAction, button.dataset);
      };
      body.onchange = (event) => {
        if (event.target.matches("[data-inventory-filter]")) {
          this.inventoryFilter = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-inventory-sort]")) {
          this.inventorySort = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-setting]")) {
          const key = event.target.dataset.setting;
          let value = event.target.value;
          if (key === "reduceEffects") value = value === "true";
          if (["volume", "cameraSensitivity"].includes(key)) value = Number(value);
          this.state.settings[key] = value;
          if (key === "quality") {
            this.root.dataset.quality = value;
            this.renderer.shadowMap.enabled = value !== "low";
            this.resize();
          }
          if (key === "volume" && this.audioMaster) this.audioMaster.gain.value = value / 100 * 0.15;
          this.saveProgress("Thay đổi thiết lập");
        }
      };
      const setSelect = (selector, value) => {
        const element = body.querySelector(selector);
        if (element) element.value = String(value);
      };
      setSelect("[data-inventory-filter]", this.inventoryFilter || "all");
      setSelect("[data-inventory-sort]", this.inventorySort || "recent");
      setSelect('[data-setting="quality"]', this.state.settings.quality);
      setSelect('[data-setting="reduceEffects"]', this.state.settings.reduceEffects);
    }

    async handlePanelAction(action, data) {
      if (action === "teleport") {
        const zone = ZONES.find((item) => item.id === data.zone);
        if (zone && this.state.checkpoints[zone.id]) this.teleport(zone.x, zone.z + 5, zone.name);
      } else if (action === "favorite") {
        const record = this.state.inventory[data.item];
        if (record) record.favorite = !record.favorite;
        this.renderCurrentPanel();
      } else if (action === "lock-item") {
        const record = this.state.inventory[data.item];
        if (record) record.locked = !record.locked;
        this.renderCurrentPanel();
      } else if (action === "equip") this.equipItem(data.item);
      else if (action === "use") this.useItem(data.item);
      else if (action === "open-craft") this.openPanel("craft");
      else if (action === "craft") this.craft(data.recipe);
      else if (action === "upgrade-skill") this.upgradeSkill(data.skill);
      else if (action === "manual-save") await this.saveProgress("Checkpoint thủ công");
      else if (action === "sync-cloud") await this.syncCloud(true);
      else if (action === "restore-save") await this.restoreLocalVersion(Number(data.version));
      else if (action === "use-cloud") await this.useCloudConflict();
      else if (action === "keep-local") {
        this.cloudConflict = null;
        await this.syncCloud(true, true);
      } else if (action === "create-party") await this.createParty();
      else if (action === "join-party") await this.joinParty(bodyValue(this.root, "[data-party-code]"));
      else if (action === "leave-party") await this.leaveParty();
      else if (action === "send-chat") await this.sendPartyChat(bodyValue(this.root, "[data-party-chat]"));
      else if (action === "resume") this.togglePause(false);
      else if (action === "open-inventory") this.openPanel("inventory");
      else if (action === "open-settings") this.openPanel("settings");
      else if (action === "exit-game") root.location.hash = "#/entertainment";
      else if (action === "revive") this.revive();
      else if (action === "restore-last") {
        const record = await this.store.load("slot1");
        if (record?.data) {
          this.state = normalizeState(record.data);
          this.applyStateToWorld();
          this.revive();
        }
      }
    }

    upgradeSkill(skillId) {
      const max = { plasmaDrive: 3, astralGuard: 3, staminaCore: 4 }[skillId];
      if (!max || this.state.player.skillPoints <= 0 || Number(this.state.skills[skillId] || 0) >= max) return;
      this.state.skills[skillId] += 1;
      this.state.player.skillPoints -= 1;
      this.toast("Đã nâng kỹ năng.", "success");
      this.saveProgress("Nâng kỹ năng");
      this.renderCurrentPanel();
    }

    togglePause(force) {
      if (!this.running) return;
      const next = typeof force === "boolean" ? force : !this.paused;
      this.paused = next;
      if (next) {
        this.runtime?.pause?.({ gameId: GAME_ID, reason: "user" });
        this.openPanel("paused");
      } else {
        this.runtime?.resume?.({ gameId: GAME_ID });
        this.closePanel();
        this.lastFrameAt = performance.now();
      }
      const button = this.root.querySelector("[data-har-pause]");
      if (button) {
        button.textContent = next ? "▶" : "Ⅱ";
        button.setAttribute("aria-label", next ? "Tiếp tục" : "Tạm dừng");
      }
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await this.root.requestFullscreen();
        root.setTimeout(() => this.resize(), 50);
      } catch {
        this.toast("Trình duyệt không cho phép toàn màn hình.", "error");
      }
    }

    toast(message, tone = "info") {
      const element = this.root?.querySelector("[data-har-toast]");
      if (!element) return;
      clearTimeout(this.toastTimer);
      element.textContent = String(message || "").slice(0, 220);
      element.dataset.tone = tone;
      element.classList.add("is-visible");
      this.toastTimer = root.setTimeout(() => element.classList.remove("is-visible"), 2600);
    }

    initRuntime() {
      const runtime = root.HHGameRuntime;
      if (!runtime) return;
      try {
        this.runtime = typeof runtime.create === "function"
          ? runtime.create({
            gameId: GAME_ID,
            getState: () => this.snapshot(),
            autosave: false,
            maxPayloadBytes: 240000
          })
          : runtime;
        this.runtime?.register?.({ gameId: GAME_ID, getState: () => this.snapshot() });
      } catch (error) {
        this.runtime = null;
        this.toast(`Game Runtime chưa sẵn sàng: ${error.message || error}`, "error");
      }
    }

    snapshot() {
      const state = clone(this.state);
      state.updatedAt = nowIso();
      state.schemaVersion = SCHEMA_VERSION;
      return state;
    }

    async saveProgress(label = "Autosave") {
      if (this.destroyed || !this.started) return null;
      if (this.savingPromise) return this.savingPromise;
      this.state.updatedAt = nowIso();
      this.savingPromise = this.store.save(this.snapshot(), "slot1", label)
        .then((record) => {
          this.savedRecord = record;
          this.state.saveVersion = record.version;
          this.lastSaveAt = Date.now();
          this.runtime?.checkpoint?.(this.snapshot(), { slot: "slot1", label });
          return record;
        })
        .catch((error) => {
          this.toast(error.message || "Không lưu được tiến trình.", "error");
          return null;
        })
        .finally(() => {
          this.savingPromise = null;
        });
      return this.savingPromise;
    }

    async restoreLocalVersion(version) {
      try {
        const record = await this.store.restore(version, "slot1");
        this.savedRecord = record;
        this.state = normalizeState(record.data);
        this.applyStateToWorld();
        this.toast(`Đã khôi phục phiên bản ${version}.`, "success");
        this.renderCurrentPanel();
      } catch (error) {
        this.toast(error.message || "Không khôi phục được bản lưu.", "error");
      }
    }

    async cloudRequest(method, query, body) {
      const token = root.HHAuthSession?.token?.() || "";
      if (!token) throw new Error("Bạn cần đăng nhập để dùng cloud save.");
      const base = String(this.options.apiBase || root.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
      const params = new URLSearchParams({ service: "games", ...query });
      const response = await fetch(`${base}/api/social?${params.toString()}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Cloud save lỗi HTTP ${response.status}.`);
      return payload;
    }

    async syncCloud(manual = false, force = false) {
      if (!root.HHAuthSession?.token?.()) {
        this.state.cloud.status = "local";
        if (manual) this.toast("Chế độ khách chỉ lưu trên thiết bị. Hãy đăng nhập để đồng bộ.", "error");
        return false;
      }
      if (!navigator.onLine) {
        this.state.cloud.status = "offline";
        if (manual) this.toast("Thiết bị đang ngoại tuyến.", "error");
        return false;
      }
      try {
        await this.saveProgress("Trước khi đồng bộ");
        if (!force) {
          const remote = await this.cloudRequest("GET", { resource: "cloud-save", gameId: GAME_ID, slot: "slot1" });
          const remoteItem = remote.item;
          if (remoteItem?.data) {
            const remoteAt = Date.parse(remoteItem.data.updatedAt || remoteItem.updatedAt || 0);
            const localAt = Date.parse(this.state.updatedAt || this.savedRecord?.updatedAt || 0);
            const knownVersion = Number(this.state.cloud.version || 0);
            if (remoteAt > localAt + 1500 && Number(remoteItem.version || 0) > knownVersion) {
              this.cloudConflict = remoteItem;
              this.state.cloud = {
                status: "conflict",
                version: Number(remoteItem.version || 0),
                updatedAt: remoteItem.updatedAt || "",
                error: "Cloud save mới hơn bản local."
              };
              this.toast("Phát hiện xung đột cloud save. Mở Thiết lập để chọn bản.", "error");
              if (manual) this.openPanel("settings");
              return false;
            }
          }
        }
        const payload = await this.cloudRequest("POST", { resource: "cloud-save", gameId: GAME_ID }, {
          slot: "slot1",
          checkpointId: this.state.player.checkpoint,
          checkpointLabel: `Astral Realms · ${this.currentZone.name}`,
          checksum: this.stateChecksum(),
          data: this.snapshot()
        });
        this.state.cloud = {
          status: payload.item?.persistence === false ? "server-memory" : "synced",
          version: Number(payload.item?.version || 0),
          updatedAt: payload.item?.updatedAt || nowIso(),
          error: ""
        };
        this.cloudConflict = null;
        if (manual) this.toast(`Đã đồng bộ cloud v${this.state.cloud.version}.`, "success");
        this.renderCurrentPanel();
        return true;
      } catch (error) {
        this.state.cloud = { ...this.state.cloud, status: "local", error: error.message || "Đồng bộ thất bại" };
        if (manual) this.toast(error.message || "Không đồng bộ được cloud save.", "error");
        return false;
      }
    }

    stateChecksum() {
      const text = JSON.stringify({
        version: this.state.saveVersion,
        player: this.state.player,
        quests: this.state.quests,
        inventory: this.state.inventory
      });
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a-${(hash >>> 0).toString(16)}`;
    }

    async useCloudConflict() {
      if (!this.cloudConflict?.data) return;
      this.state = normalizeState(this.cloudConflict.data);
      this.state.cloud = {
        status: "synced",
        version: Number(this.cloudConflict.version || 0),
        updatedAt: this.cloudConflict.updatedAt || nowIso(),
        error: ""
      };
      this.cloudConflict = null;
      this.applyStateToWorld();
      await this.saveProgress("Khôi phục từ cloud");
      this.toast("Đã dùng tiến trình cloud.", "success");
      this.closePanel();
    }

    initRealtime() {
      const socket = this.options.socket || root.HHRealtimeSocket || this.socket;
      if (socket) this.attachSocket(socket);
      if (!this.realtimeReadyBound) {
        this.realtimeReadyBound = true;
        this.listen(root, "hh:realtime-ready", (event) => this.attachSocket(event.detail?.socket || root.HHRealtimeSocket));
        this.listen(root, "hh:realtime-offline", () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? "local" : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        });
      }
    }

    attachSocket(socket) {
      if (!socket || (this.socket === socket && this.socketBound)) {
        this.updateConnectionUi();
        return;
      }
      if (this.socket && this.socketBound) this.unbindSocket();
      this.socket = socket;
      this.socketBound = true;
      this.socketHandlers = {
        connect: () => {
          this.state.party.status = this.state.party.roomCode ? "room" : "ready";
          this.updateConnectionUi();
        },
        disconnect: () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? "local" : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        },
        room: (payload) => {
          if (payload?.code !== this.state.party.roomCode) return;
          this.room = payload;
          this.state.party.members = Array.isArray(payload.members) ? payload.members.slice(0, 4) : [];
          this.state.party.status = "room";
          if (this.currentPanel === "party") this.renderCurrentPanel();
        },
        presence: (payload) => {
          if (payload?.room !== this.state.party.roomCode) return;
          this.state.party.members = Array.isArray(payload.members) ? payload.members.slice(0, 4) : [];
          if (this.currentPanel === "party") this.renderCurrentPanel();
        },
        chat: (payload) => {
          if (payload?.room !== this.state.party.roomCode) return;
          this.partyMessages ||= [];
          this.partyMessages.push(payload);
          this.partyMessages = this.partyMessages.slice(-50);
          if (this.currentPanel === "party") this.renderCurrentPanel();
          this.toast(`${payload.user?.name || "HH"}: ${payload.body}`);
        },
        snapshot: (payload) => this.applyAuthoritativeSnapshot(payload)
      };
      socket.on?.("connect", this.socketHandlers.connect);
      socket.on?.("disconnect", this.socketHandlers.disconnect);
      socket.on?.("game:room", this.socketHandlers.room);
      socket.on?.("game:presence", this.socketHandlers.presence);
      socket.on?.("game:chat", this.socketHandlers.chat);
      socket.on?.("astral-realms:snapshot", this.socketHandlers.snapshot);
      this.updateConnectionUi();
    }

    unbindSocket() {
      if (!this.socket || !this.socketHandlers) return;
      this.socket.off?.("connect", this.socketHandlers.connect);
      this.socket.off?.("disconnect", this.socketHandlers.disconnect);
      this.socket.off?.("game:room", this.socketHandlers.room);
      this.socket.off?.("game:presence", this.socketHandlers.presence);
      this.socket.off?.("game:chat", this.socketHandlers.chat);
      this.socket.off?.("astral-realms:snapshot", this.socketHandlers.snapshot);
      this.socketBound = false;
      this.socketHandlers = null;
    }

    emitAck(event, payload, timeout = 8000) {
      return new Promise((resolve, reject) => {
        if (!this.socket?.connected) return reject(new Error("Realtime server chưa kết nối."));
        let settled = false;
        const timer = root.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Máy chủ realtime không phản hồi."));
        }, timeout);
        this.socket.emit(event, payload, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (response?.ok === false) reject(new Error(response.error || "Yêu cầu realtime thất bại."));
          else resolve(response || {});
        });
      });
    }

    async createParty() {
      try {
        const response = await this.emitAck("game:room:create", {
          gameId: GAME_ID,
          name: `Astral · ${this.state.player.name}`,
          visibility: "public",
          maxPlayers: 4,
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        });
        this.acceptRoom(response);
        this.toast(`Đã tạo phòng ${this.state.party.roomCode}.`, "success");
      } catch (error) {
        this.toast(error.message || "Không tạo được phòng.", "error");
      }
    }

    async joinParty(code) {
      if (!code) return this.toast("Hãy nhập mã phòng.", "error");
      try {
        const response = await this.emitAck("game:room:join", {
          code: code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        });
        if (response.room?.gameId !== GAME_ID) throw new Error("Phòng này không thuộc HH Astral Realms.");
        this.acceptRoom(response);
        this.toast(`Đã tham gia phòng ${this.state.party.roomCode}.`, "success");
      } catch (error) {
        this.toast(error.message || "Không tham gia được phòng.", "error");
      }
    }

    acceptRoom(response) {
      this.room = response.room || {};
      this.state.party.roomCode = String(this.room.code || "").toUpperCase();
      this.state.party.members = Array.isArray(this.room.members) ? this.room.members.slice(0, 4) : [];
      this.state.party.status = "room";
      this.state.party.integrity = "awaiting-server-snapshot";
      this.authoritative = false;
      this.emitInput({ spawn: { x: this.state.player.x, z: this.state.player.z } });
      this.renderCurrentPanel();
      this.updateConnectionUi();
    }

    async leaveParty() {
      try {
        if (this.socket?.connected && this.state.party.roomCode) await this.emitAck("game:room:leave", { code: this.state.party.roomCode });
      } catch {}
      this.state.party = { roomCode: "", status: this.socket?.connected ? "ready" : "local", members: [], integrity: "local-simulation" };
      this.authoritative = false;
      this.room = null;
      this.remotePlayers.forEach((mesh) => mesh.parent?.remove(mesh));
      this.remotePlayers.clear();
      this.toast("Đã rời phòng. Tiếp tục bằng mô phỏng local.");
      this.renderCurrentPanel();
    }

    async sendPartyChat(body) {
      if (!body) return;
      try {
        await this.emitAck("game:chat", { body, type: "text" });
        const input = this.root.querySelector("[data-party-chat]");
        if (input) input.value = "";
      } catch (error) {
        this.toast(error.message || "Không gửi được chat.", "error");
      }
    }

    emitInput(extra = {}) {
      if (!this.socket?.connected || !this.state.party.roomCode) return;
      const input = this.movementInput();
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      this.socket.emit("astral-realms:input", {
        seq: ++this.inputSeq,
        move: {
          x: forwardX * input.z + rightX * input.x,
          z: forwardZ * input.z + rightZ * input.x
        },
        sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
        rotation: this.state.player.rotation,
        element: this.state.player.element,
        spawn: { x: this.state.player.x, z: this.state.player.z },
        ...extra
      });
    }

    sendRealtimeInput(time) {
      if (!this.state.party.roomCode || !this.socket?.connected || time - this.lastNetworkAt < 50) return;
      this.lastNetworkAt = time;
      this.emitInput();
    }

    applyAuthoritativeSnapshot(payload) {
      if (!payload || payload.gameId !== GAME_ID || payload.room !== this.state.party.roomCode || payload.integrity !== "server-authoritative") return;
      this.authoritative = true;
      this.state.party.integrity = "server-authoritative";
      this.state.party.status = "playing";
      const self = (payload.players || []).find((player) => player.socketId === this.socket?.id);
      if (self) {
        const error = Math.hypot(self.x - this.state.player.x, self.z - this.state.player.z);
        const blend = error > 3 ? 1 : 0.22;
        this.state.player.x += (self.x - this.state.player.x) * blend;
        this.state.player.z += (self.z - this.state.player.z) * blend;
        this.state.player.health = self.health;
        this.state.player.stamina = self.stamina;
      }
      const activeRemoteIds = new Set();
      (payload.players || []).forEach((player) => {
        if (player.socketId === this.socket?.id) return;
        activeRemoteIds.add(player.socketId);
        let mesh = this.remotePlayers.get(player.socketId);
        if (!mesh) {
          mesh = this.createCharacterMesh({ body: "#ff72cf", accent: "#74efff", scale: 0.95 });
          mesh.userData = { type: "remote-player", id: player.socketId, name: player.name };
          this.world.add(mesh);
          this.remotePlayers.set(player.socketId, mesh);
        }
        mesh.position.lerp(new this.THREE.Vector3(player.x, 1.08, player.z), 0.35);
        mesh.rotation.y = player.rotation;
      });
      this.remotePlayers.forEach((mesh, id) => {
        if (!activeRemoteIds.has(id)) {
          mesh.parent?.remove(mesh);
          this.remotePlayers.delete(id);
        }
      });
      (payload.enemies || []).forEach((serverEnemy) => {
        const enemy = this.enemies.get(serverEnemy.id);
        if (!enemy) return;
        const wasAlive = enemy.userData.health > 0 && !enemy.userData.defeated;
        enemy.position.x += (serverEnemy.x - enemy.position.x) * 0.4;
        enemy.position.z += (serverEnemy.z - enemy.position.z) * 0.4;
        enemy.userData.health = serverEnemy.health;
        if (serverEnemy.defeated && wasAlive) this.defeatEnemy(enemy);
        else if (!serverEnemy.defeated && enemy.userData.defeated) {
          enemy.userData.defeated = false;
          enemy.userData.health = serverEnemy.health;
          enemy.visible = true;
        }
      });
      this.updateConnectionUi();
    }

    updateConnectionUi() {
      const label = this.root?.querySelector("[data-har-server]");
      if (!label) return;
      const state = !navigator.onLine
        ? { text: "OFFLINE", tone: "error" }
        : this.authoritative
          ? { text: `${this.state.party.roomCode} · SERVER`, tone: "online" }
          : this.socket?.connected
            ? { text: this.state.party.roomCode ? `${this.state.party.roomCode} · SYNC` : "REALTIME READY", tone: "ready" }
            : { text: "LOCAL", tone: "local" };
      label.textContent = state.text;
      label.dataset.state = state.tone;
    }

    initAudio() {
      if (!this.state.settings.sound) return;
      try {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if (!AudioContext) return;
        this.audio = new AudioContext();
        this.audioMaster = this.audio.createGain();
        this.audioMaster.gain.value = (this.state.settings.volume / 100) * 0.15;
        this.audioMaster.connect(this.audio.destination);
      } catch {
        this.audio = null;
        this.audioMaster = null;
      }
    }

    sound(kind) {
      if (!this.audio || !this.audioMaster || !this.state.settings.sound) return;
      if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
      const presets = {
        attack: [240, 0.08, "sawtooth"],
        skill: [420, 0.18, "sine"],
        ultimate: [130, 0.5, "sawtooth"],
        dodge: [620, 0.07, "triangle"],
        jump: [310, 0.09, "sine"],
        collect: [760, 0.16, "sine"],
        craft: [520, 0.3, "triangle"],
        heal: [660, 0.22, "sine"]
      };
      const [frequency, duration, type] = presets[kind] || [330, 0.1, "sine"];
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 1.35), this.audio.currentTime + duration);
      gain.gain.setValueAtTime(0.001, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, this.audio.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioMaster);
      oscillator.start();
      oscillator.stop(this.audio.currentTime + duration + 0.02);
    }

    dispatchReward(detail = {}) {
      document.dispatchEvent(new CustomEvent("hh:game-reward", {
        detail: {
          gameId: GAME_ID,
          gameTitle: "HH Astral Realms",
          xp: Math.max(0, Number(detail.xp || 0)),
          score: this.state.stats.totalDamage,
          level: this.state.player.level,
          source: "astral-realms",
          ...detail
        }
      }));
    }

    inspect() {
      return {
        mounted: true,
        gameId: GAME_ID,
        started: this.started,
        running: this.running,
        paused: this.paused,
        zone: this.currentZone?.id || "central",
        fps: this.fps,
        renderer: this.renderer?.capabilities?.isWebGL2 ? "WebGL2" : this.renderer ? "WebGL" : "not-started",
        authoritative: this.authoritative,
        roomCode: this.state.party.roomCode,
        saveVersion: this.savedRecord?.version || 0,
        player: {
          level: this.state.player.level,
          health: this.state.player.health,
          element: this.state.player.element
        },
        activeQuest: this.activeQuest()?.id || "",
        inventoryCount: Object.keys(this.state.inventory).length
      };
    }

    async destroy() {
      if (this.destroyed) return;
      if (this.started) await this.saveProgress("Rời game");
      this.destroyed = true;
      this.running = false;
      cancelAnimationFrame(this.frameHandle);
      clearInterval(this.autosaveTimer);
      clearTimeout(this.toastTimer);
      this.unbindSocket();
      this.cleanup.splice(0).forEach((dispose) => {
        try { dispose(); } catch {}
      });
      this.runtime?.destroy?.({ gameId: GAME_ID });
      if (this.scene) {
        this.scene.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
          else object.material?.dispose?.();
        });
      }
      this.renderer?.dispose?.();
      try { await this.audio?.close?.(); } catch {}
      this.host?.replaceChildren();
    }
  }

  let activeGame = null;

  async function mount(host, options = {}) {
    if (!host) throw new Error("HHAstralRealms.mount cần host element.");
    if (activeGame) await activeGame.destroy();
    activeGame = new AstralRealmsGame(host, options);
    await activeGame.init();
    return activeGame;
  }

  async function unmount() {
    if (!activeGame) return;
    await activeGame.destroy();
    activeGame = null;
  }

  function inspect() {
    if (!activeGame) return { mounted: false, gameId: GAME_ID };
    return activeGame.inspect();
  }

  const api = Object.freeze({ mount, unmount, inspect, GAME_ID, QUESTS, RECIPES, ELEMENT_REACTIONS });
  root.HHAstralRealms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
