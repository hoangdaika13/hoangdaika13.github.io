(function bootstrapHHCinematicGameArcade(global) {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_SCHEMA = "hh.cinematic.arcade.v1";
  const CAMERA_MODES = ["chase", "shoulder", "flight", "lock-on", "orbit", "broadcast", "cinematic"];
  const QUALITY_LEVELS = {
    low: { pixelRatio: 1, stars: 420, shadows: false, antialias: false, power: "low-power" },
    medium: { pixelRatio: 1.25, stars: 850, shadows: true, antialias: true, power: "default" },
    high: { pixelRatio: 1.75, stars: 1500, shadows: true, antialias: true, power: "high-performance" }
  };
  const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const GAME_DEFINITIONS = [
    {
      id: "neon-skyline-rush",
      name: "Neon Skyline Rush",
      genre: "Đua phản lực",
      icon: "NV",
      color: "#31efff",
      accent: "#1677ff",
      objective: "Xuyên qua 10 cổng lượng tử trước khi thời gian kết thúc.",
      controls: "Lái bằng WASD, Shift tăng tốc và Space phóng xung lực.",
      goal: 10,
      time: 82,
      reward: 180,
      camera: "chase"
    },
    {
      id: "mecha-frontier",
      name: "Mecha Frontier",
      genre: "Bắn súng máy chiến",
      icon: "MS",
      color: "#ff477e",
      accent: "#ff9f43",
      objective: "Tiêu diệt 14 drone chiến đấu và giữ giáp còn hoạt động.",
      controls: "Di chuyển bằng WASD, Space khai hỏa, Shift lướt né.",
      goal: 14,
      time: 105,
      reward: 240,
      camera: "shoulder"
    },
    {
      id: "dragon-sky",
      name: "Dragon Sky",
      genre: "Phiêu lưu bay",
      icon: "DS",
      color: "#b8ff5b",
      accent: "#36d399",
      objective: "Bay qua 12 vòng gió và phá tan các thiên thạch cản đường.",
      controls: "Điều hướng bằng WASD, Space phun lửa, Shift tăng tốc.",
      goal: 12,
      time: 95,
      reward: 220,
      camera: "flight"
    },
    {
      id: "titan-protocol",
      name: "Titan Protocol",
      genre: "Săn đại boss",
      icon: "TE",
      color: "#ffca5c",
      accent: "#ff5e3a",
      objective: "Phá lõi Titan trước khi cơn nhật thực nuốt trọn đấu trường.",
      controls: "Luôn di chuyển để né đạn, Space bắn và Shift tăng tốc.",
      goal: 1,
      time: 125,
      reward: 360,
      camera: "lock-on"
    },
    {
      id: "crystal-expedition",
      name: "Crystal Expedition",
      genre: "Khám phá hành tinh",
      icon: "CF",
      color: "#bd8cff",
      accent: "#6857ff",
      objective: "Thu thập 15 tinh thể cổ và tránh các vệ binh bóng tối.",
      controls: "Di chuyển bằng WASD, Space quét radar, Shift chạy nhanh.",
      goal: 15,
      time: 115,
      reward: 250,
      camera: "orbit"
    },
    {
      id: "hoverball-arena",
      name: "Hoverball Arena",
      genre: "Thể thao tương lai",
      icon: "HN",
      color: "#ff70dd",
      accent: "#755cff",
      objective: "Đẩy lõi năng lượng vào khung thành đối thủ 3 lần.",
      controls: "Lái bằng WASD, Space va chạm tăng lực, Shift tăng tốc.",
      goal: 3,
      time: 120,
      reward: 280,
      camera: "broadcast"
    }
  ];

  let instance = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min, max) => min + Math.random() * (max - min);
  const gameById = (id) => GAME_DEFINITIONS.find((game) => game.id === id) || GAME_DEFINITIONS[0];
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  function safeObject(value, depth = 0, seen = new Set()) {
    if (value == null || typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value !== "object" || depth > 5 || seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) {
      const output = value.slice(0, 80).map((item) => safeObject(item, depth + 1, seen));
      seen.delete(value);
      return output;
    }
    const output = {};
    Object.keys(value).slice(0, 80).forEach((key) => {
      if (BLOCKED_KEYS.has(key)) return;
      const clean = safeObject(value[key], depth + 1, seen);
      if (clean !== undefined) output[key.slice(0, 100)] = clean;
    });
    seen.delete(value);
    return output;
  }

  function resolveOwnerId(options) {
    const candidates = [
      options && options.ownerId,
      options && options.user && (options.user.uid || options.user.id),
      options && options.currentUser && (options.currentUser.uid || options.currentUser.id),
      global.HHAuthState && global.HHAuthState.user && (global.HHAuthState.user.uid || global.HHAuthState.user.id),
      global.firebaseAuth && global.firebaseAuth.currentUser && global.firebaseAuth.currentUser.uid
    ];
    const known = candidates.find((item) => typeof item === "string" && item.trim());
    if (known) return known.trim().replace(/[^a-zA-Z0-9_.:@-]/g, "_").slice(0, 96);
    try {
      const key = `${STORAGE_SCHEMA}.anonymousOwner`;
      let guest = global.sessionStorage && global.sessionStorage.getItem(key);
      if (!guest) {
        const randomPart = global.crypto && typeof global.crypto.randomUUID === "function"
          ? global.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        guest = `guest-${randomPart}`;
        if (global.sessionStorage) global.sessionStorage.setItem(key, guest);
      }
      return guest;
    } catch (error) {
      return "guest-session";
    }
  }

  function storageKey(ownerId) {
    return `${STORAGE_SCHEMA}:${encodeURIComponent(ownerId)}`;
  }

  function loadProgress(ownerId) {
    const fallback = { version: 1, games: {}, totalCoins: 0, totalXp: 0, updatedAt: "" };
    try {
      const raw = global.localStorage && global.localStorage.getItem(storageKey(ownerId));
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
      const games = {};
      Object.keys(parsed.games || {}).forEach((id) => {
        if (!GAME_DEFINITIONS.some((game) => game.id === id) || BLOCKED_KEYS.has(id)) return;
        const item = parsed.games[id] || {};
        games[id] = {
          wins: clamp(item.wins, 0, 999999),
          plays: clamp(item.plays, 0, 999999),
          bestScore: clamp(item.bestScore, 0, 99999999),
          bestTime: clamp(item.bestTime, 0, 999999)
        };
      });
      return {
        version: 1,
        games,
        totalCoins: clamp(parsed.totalCoins, 0, 999999999),
        totalXp: clamp(parsed.totalXp, 0, 999999999),
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt.slice(0, 40) : ""
      };
    } catch (error) {
      return fallback;
    }
  }

  function saveProgress(runtime) {
    if (!runtime) return;
    runtime.progress.updatedAt = new Date().toISOString();
    try {
      if (global.localStorage) {
        global.localStorage.setItem(storageKey(runtime.ownerId), JSON.stringify(safeObject(runtime.progress)));
      }
    } catch (error) {
      runtime.storageAvailable = false;
    }
  }

  function detectQuality() {
    const memory = Number(global.navigator && global.navigator.deviceMemory) || 4;
    const cores = Number(global.navigator && global.navigator.hardwareConcurrency) || 4;
    const narrow = Math.min(global.innerWidth || 1280, global.innerHeight || 720) < 700;
    if (memory <= 2 || cores <= 2 || narrow) return "low";
    if (memory >= 8 && cores >= 8) return "high";
    return "medium";
  }

  function supportsWebGL() {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
        || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
      if (!context) return false;
      const extension = context.getExtension("WEBGL_lose_context");
      if (extension) extension.loseContext();
      return true;
    } catch (error) {
      return false;
    }
  }

  function addListener(runtime, target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    runtime.listeners.push(() => target.removeEventListener(eventName, handler, options));
  }

  function resolveHost(target) {
    if (target && target.nodeType === 1) return target;
    if (typeof target === "string") return document.querySelector(target);
    return null;
  }

  function renderShell(runtime) {
    const games = GAME_DEFINITIONS.map((game) => {
      const record = runtime.progress.games[game.id] || {};
      return `<button class="cga-game-card${game.id === runtime.gameId ? " is-active" : ""}" type="button" data-cga-game="${escapeHtml(game.id)}" aria-pressed="${game.id === runtime.gameId}" style="--cga-game-color:${escapeHtml(game.color)}">
        <span class="cga-game-icon" style="--cga-game-color:${escapeHtml(game.color)}">${escapeHtml(game.icon)}</span>
        <span class="cga-game-copy"><strong>${escapeHtml(game.name)}</strong><small>${escapeHtml(game.genre)}</small></span>
        <span class="cga-game-record">${record.wins ? `${record.wins} thắng` : "Mới"}</span>
      </button>`;
    }).join("");
    const qualityOptions = ["auto", "high", "medium", "low"].map((quality) => {
      const labels = { auto: "Tự động", high: "Điện ảnh", medium: "Cân bằng", low: "Hiệu năng" };
      return `<option value="${quality}"${runtime.qualityPreference === quality ? " selected" : ""}>${labels[quality]}</option>`;
    }).join("");

    runtime.root.innerHTML = `<section class="cga-app" data-cga-phase="loading" aria-label="Trung tâm game điện ảnh 3D">
      <header class="cga-topbar">
        <div class="cga-brand"><span class="cga-brand-mark">H</span><span><strong>Cinematic Arcade</strong><small>REAL-TIME 3D ENGINE</small></span></div>
        <div class="cga-live-strip" aria-live="polite"><span class="cga-live-dot"></span><span data-cga-status>Đang khởi tạo động cơ 3D…</span></div>
        <div class="cga-wallet"><span><small>ENERGY COINS</small><strong data-cga-coins>${runtime.progress.totalCoins}</strong></span><span><small>GALAXY XP</small><strong data-cga-xp>${runtime.progress.totalXp}</strong></span></div>
      </header>
      <div class="cga-workspace">
        <aside class="cga-catalog" aria-label="Danh sách game">
          <div class="cga-panel-heading"><span><small>GAME LIBRARY</small><strong>Chọn thế giới</strong></span><em>${GAME_DEFINITIONS.length} GAME</em></div>
          <div class="cga-game-list">${games}</div>
        </aside>
        <main class="cga-stage" aria-label="Sân chơi 3D">
          <div class="cga-canvas-shell" data-cga-canvas-shell tabindex="0" aria-label="Game 3D. Dùng WASD hoặc phím mũi tên để điều khiển.">
            <div class="cga-canvas-host" data-cga-canvas></div>
            <div class="cga-vignette" aria-hidden="true"></div>
            <div class="cga-hud cga-hud-top">
              <div class="cga-hud-title"><small data-cga-genre></small><strong data-cga-title></strong></div>
              <div class="cga-hud-stats">
                <span><small>THỜI GIAN</small><strong data-cga-time>--:--</strong></span>
                <span><small>MỤC TIÊU</small><strong data-cga-objective-count>0/0</strong></span>
                <span><small>ĐIỂM</small><strong data-cga-score>0</strong></span>
              </div>
            </div>
            <div class="cga-health" aria-label="Sinh lực"><span data-cga-health></span></div>
            <div class="cga-crosshair" aria-hidden="true"><i></i><i></i></div>
            <div class="cga-camera-badge"><span>CAM</span><strong data-cga-camera>CHASE</strong></div>
            <div class="cga-message" data-cga-message aria-live="assertive" hidden></div>
            <div class="cga-start-overlay" data-cga-overlay>
              <span class="cga-kicker" data-cga-overlay-kicker>SẴN SÀNG TRIỂN KHAI</span>
              <h2 data-cga-overlay-title></h2>
              <p data-cga-overlay-copy></p>
              <button class="cga-primary" type="button" data-cga-action="start">Bắt đầu nhiệm vụ</button>
              <small>WASD / Mũi tên · Space hành động · Shift tăng tốc · C đổi camera · Esc tạm dừng</small>
            </div>
            <div class="cga-touch-controls" data-cga-touch aria-label="Điều khiển cảm ứng">
              <div class="cga-touch-pad">
                <button type="button" data-cga-key="ArrowUp" aria-label="Đi lên">▲</button>
                <button type="button" data-cga-key="ArrowLeft" aria-label="Sang trái">◀</button>
                <button type="button" data-cga-key="ArrowDown" aria-label="Đi xuống">▼</button>
                <button type="button" data-cga-key="ArrowRight" aria-label="Sang phải">▶</button>
              </div>
              <div class="cga-touch-actions">
                <button type="button" data-cga-key="ShiftLeft" aria-label="Tăng tốc">BOOST</button>
                <button type="button" data-cga-action="fire" aria-label="Hành động">ACTION</button>
              </div>
            </div>
          </div>
          <div class="cga-stage-footer">
            <span data-cga-tip>Đang tải thế giới…</span>
            <div class="cga-stage-actions">
              <button type="button" data-cga-action="camera">Đổi camera <kbd>C</kbd></button>
              <button type="button" data-cga-action="pause">Tạm dừng <kbd>Esc</kbd></button>
              <button type="button" data-cga-action="restart">Chơi lại</button>
            </div>
          </div>
        </main>
        <aside class="cga-inspector" aria-label="Nhiệm vụ và thiết lập">
          <div class="cga-mission-card">
            <span class="cga-eyebrow">NHIỆM VỤ ĐANG CHỌN</span>
            <h3 data-cga-mission-title></h3>
            <p data-cga-mission-copy></p>
            <div class="cga-progress-row"><span>Tiến độ</span><strong data-cga-progress-label>0%</strong></div>
            <div class="cga-progress"><span data-cga-progress></span></div>
            <div class="cga-reward"><span>Phần thưởng tối đa</span><strong data-cga-reward></strong></div>
          </div>
          <div class="cga-control-card">
            <div class="cga-panel-heading"><span><small>FLIGHT DECK</small><strong>Điều khiển</strong></span></div>
            <div class="cga-key-grid"><span><kbd>WASD</kbd><small>Di chuyển</small></span><span><kbd>SPACE</kbd><small>Hành động</small></span><span><kbd>SHIFT</kbd><small>Tăng tốc</small></span><span><kbd>C</kbd><small>Camera</small></span></div>
            <p data-cga-controls></p>
          </div>
          <div class="cga-settings-card">
            <div class="cga-setting"><label for="cga-quality">Chất lượng hình ảnh</label><select id="cga-quality" data-cga-quality>${qualityOptions}</select></div>
            <div class="cga-setting"><span>FPS thời gian thực</span><strong data-cga-fps>--</strong></div>
            <div class="cga-setting"><span>Đồ họa đang dùng</span><strong data-cga-quality-label>--</strong></div>
            <div class="cga-setting"><span>Giảm chuyển động</span><strong data-cga-motion>${runtime.reducedMotion ? "Bật" : "Tắt"}</strong></div>
          </div>
        </aside>
      </div>
    </section>`;

    const query = (selector) => runtime.root.querySelector(selector);
    runtime.ui = {
      app: query(".cga-app"), canvasShell: query("[data-cga-canvas-shell]"), canvasHost: query("[data-cga-canvas]"),
      status: query("[data-cga-status]"), coins: query("[data-cga-coins]"), xp: query("[data-cga-xp]"),
      title: query("[data-cga-title]"), genre: query("[data-cga-genre]"), time: query("[data-cga-time]"),
      count: query("[data-cga-objective-count]"), score: query("[data-cga-score]"), health: query("[data-cga-health]"),
      camera: query("[data-cga-camera]"), message: query("[data-cga-message]"), overlay: query("[data-cga-overlay]"),
      overlayKicker: query("[data-cga-overlay-kicker]"), overlayTitle: query("[data-cga-overlay-title]"),
      overlayCopy: query("[data-cga-overlay-copy]"), tip: query("[data-cga-tip]"), missionTitle: query("[data-cga-mission-title]"),
      missionCopy: query("[data-cga-mission-copy]"), progressLabel: query("[data-cga-progress-label]"),
      progress: query("[data-cga-progress]"), reward: query("[data-cga-reward]"), controls: query("[data-cga-controls]"),
      fps: query("[data-cga-fps]"), qualityLabel: query("[data-cga-quality-label]"), quality: query("[data-cga-quality]")
    };
  }

  function showFallback(runtime, reason) {
    runtime.phase = "error";
    runtime.root.innerHTML = `<section class="cga-app cga-fallback" role="alert">
      <div class="cga-fallback-planet" aria-hidden="true"><span>H</span></div>
      <span class="cga-eyebrow">KHÔNG THỂ KHỞI TẠO WEBGL</span>
      <h2>Thiết bị chưa bật tăng tốc đồ họa 3D</h2>
      <p>${escapeHtml(reason || "Trình duyệt không cung cấp WebGL cho trang này.")}</p>
      <ol><li>Bật Hardware Acceleration trong trình duyệt.</li><li>Cập nhật driver card đồ họa.</li><li>Mở lại trang bằng Chrome, Edge hoặc Firefox mới nhất.</li></ol>
      <button class="cga-primary" type="button" data-cga-action="reload">Thử khởi tạo lại</button>
    </section>`;
    const reload = runtime.root.querySelector('[data-cga-action="reload"]');
    if (reload) addListener(runtime, reload, "click", () => mount(runtime.host, runtime.options));
  }

  async function loadThree(runtime) {
    if (!supportsWebGL()) throw new Error("WebGL/WebGL2 không khả dụng hoặc đang bị trình duyệt chặn.");
    return import("./vendor/three.module.min.js");
  }

  function makeMaterial(runtime, color, options = {}) {
    const THREE = runtime.THREE;
    const parameters = {
      color,
      emissive: options.emissive || color,
      emissiveIntensity: options.emissiveIntensity == null ? 0.18 : options.emissiveIntensity,
      metalness: options.metalness == null ? 0.72 : options.metalness,
      roughness: options.roughness == null ? 0.28 : options.roughness,
      transparent: Boolean(options.transparent),
      opacity: options.opacity == null ? 1 : options.opacity
    };
    if (options.side != null) parameters.side = options.side;
    const material = new THREE.MeshStandardMaterial(parameters);
    return material;
  }

  function mesh(runtime, geometry, material, parent) {
    const object = new runtime.THREE.Mesh(geometry, material);
    object.castShadow = runtime.quality.shadows;
    object.receiveShadow = runtime.quality.shadows;
    (parent || runtime.world).add(object);
    return object;
  }

  function createGlowSprite(runtime, color, size = 2) {
    const THREE = runtime.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,.95)");
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size, size);
    sprite.userData.cgaTexture = texture;
    return sprite;
  }

  function createRenderer(runtime) {
    const THREE = runtime.THREE;
    const config = runtime.quality;
    const renderer = new THREE.WebGLRenderer({ antialias: config.antialias, alpha: false, powerPreference: config.power });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, config.pixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = config.shadows;
    if (config.shadows) renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "cga-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    runtime.ui.canvasHost.appendChild(renderer.domElement);
    runtime.renderer = renderer;
    bindRendererLifecycle(runtime, renderer);
    runtime.scene = new THREE.Scene();
    runtime.scene.background = new THREE.Color(0x02040d);
    runtime.scene.fog = new THREE.FogExp2(0x050716, 0.018);
    runtime.camera = new THREE.PerspectiveCamera(58, 1, 0.08, 420);
    runtime.camera.position.set(0, 7, 14);
    runtime.cameraLook = new THREE.Vector3();
    runtime.cameraSmoothedLook = new THREE.Vector3();
    runtime.cameraDesired = new THREE.Vector3();
    runtime.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => resize(runtime)) : null;
    if (runtime.resizeObserver) runtime.resizeObserver.observe(runtime.ui.canvasHost);
    resize(runtime);
  }

  function bindRendererLifecycle(runtime, renderer) {
    const onContextLost = (event) => {
      event.preventDefault();
      if (runtime.destroyed || renderer !== runtime.renderer) return;
      runtime.contextLost = true;
      if (runtime.phase === "running") togglePause(runtime, true);
      toast(runtime, "Kết nối GPU bị gián đoạn. Hãy tải lại thế giới.");
    };
    const onContextRestored = () => {
      if (runtime.destroyed || renderer !== runtime.renderer) return;
      mount(runtime.host, runtime.options);
    };
    addListener(runtime, renderer.domElement, "webglcontextlost", onContextLost);
    addListener(runtime, renderer.domElement, "webglcontextrestored", onContextRestored);
  }

  function resize(runtime) {
    if (!runtime || !runtime.renderer || !runtime.ui.canvasHost) return;
    const rect = runtime.ui.canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    runtime.camera.aspect = width / height;
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.setSize(width, height, false);
  }

  function addLights(runtime, game) {
    const THREE = runtime.THREE;
    runtime.scene.add(new THREE.HemisphereLight(0x8abfff, 0x11091f, 1.2));
    const key = new THREE.DirectionalLight(game.color, 3.4);
    key.position.set(12, 22, 8);
    key.castShadow = runtime.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(runtime.qualityPreference === "high" ? 2048 : 1024, runtime.qualityPreference === "high" ? 2048 : 1024);
      key.shadow.camera.left = key.shadow.camera.bottom = -34;
      key.shadow.camera.right = key.shadow.camera.top = 34;
    }
    runtime.scene.add(key);
    const rim = new THREE.PointLight(game.accent, 18, 70, 1.7);
    rim.position.set(-16, 9, -12);
    runtime.scene.add(rim);
  }

  function createStarfield(runtime, game) {
    const THREE = runtime.THREE;
    const count = runtime.quality.stars;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = new THREE.Color(game.color);
    for (let index = 0; index < count; index += 1) {
      const radius = random(55, 190);
      const angle = random(0, Math.PI * 2);
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = random(7, 90);
      positions[index * 3 + 2] = Math.sin(angle) * radius;
      const brightness = random(0.45, 1);
      colors[index * 3] = lerp(1, tint.r, 0.42) * brightness;
      colors[index * 3 + 1] = lerp(1, tint.g, 0.42) * brightness;
      colors[index * 3 + 2] = lerp(1, tint.b, 0.42) * brightness;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: runtime.qualityPreference === "low" ? 0.35 : 0.52, vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    points.userData.cgaDecor = { spin: 0.002 };
    runtime.scene.add(points);
    runtime.decor.push(points);
  }

  function createArena(runtime, game) {
    const THREE = runtime.THREE;
    const group = new THREE.Group();
    group.name = "cga-world";
    runtime.scene.add(group);
    runtime.world = group;
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x070a18, emissive: new THREE.Color(game.accent).multiplyScalar(0.06), metalness: 0.78, roughness: 0.35 });
    const floor = mesh(runtime, new THREE.CylinderGeometry(34, 37, 1.2, 80), floorMaterial, group);
    floor.position.y = -0.75;
    floor.receiveShadow = runtime.quality.shadows;
    const grid = new THREE.GridHelper(68, 34, game.color, 0x18203b);
    grid.position.y = -0.1;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    group.add(grid);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: game.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    [18, 27, 34].forEach((radius, index) => {
      const ring = mesh(runtime, new THREE.TorusGeometry(radius, 0.055 + index * 0.018, 8, 140), ringMaterial.clone(), group);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.06;
    });
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const tower = mesh(runtime, new THREE.BoxGeometry(0.35, random(1.2, 4.5), 0.35), makeMaterial(runtime, game.accent, { emissiveIntensity: 1.1 }), group);
      tower.position.set(Math.cos(angle) * 33, tower.geometry.parameters.height / 2 - 0.1, Math.sin(angle) * 33);
    }
  }

  function createShip(runtime, game, style) {
    const THREE = runtime.THREE;
    const group = new THREE.Group();
    const primary = makeMaterial(runtime, game.color, { emissiveIntensity: 0.42, metalness: 0.86, roughness: 0.18 });
    const dark = makeMaterial(runtime, 0x101526, { emissive: game.accent, emissiveIntensity: 0.08, roughness: 0.22 });
    if (style === "mecha") {
      const torso = mesh(runtime, new THREE.BoxGeometry(1.25, 1.65, 0.8), dark, group);
      torso.position.y = 1.8;
      const chest = mesh(runtime, new THREE.OctahedronGeometry(0.56, 0), primary, group);
      chest.position.set(0, 1.9, -0.44);
      [-1, 1].forEach((side) => {
        const shoulder = mesh(runtime, new THREE.SphereGeometry(0.42, 14, 10), primary, group);
        shoulder.position.set(side * 0.95, 2.25, 0);
        const arm = mesh(runtime, new THREE.BoxGeometry(0.38, 1.35, 0.38), dark, group);
        arm.position.set(side * 1.03, 1.35, 0);
        const leg = mesh(runtime, new THREE.BoxGeometry(0.48, 1.55, 0.62), dark, group);
        leg.position.set(side * 0.43, 0.45, 0);
      });
      const head = mesh(runtime, new THREE.BoxGeometry(0.7, 0.55, 0.65), primary, group);
      head.position.y = 2.95;
      const visor = mesh(runtime, new THREE.BoxGeometry(0.5, 0.12, 0.07), makeMaterial(runtime, 0xffffff, { emissive: game.color, emissiveIntensity: 3 }), group);
      visor.position.set(0, 3, -0.36);
    } else if (style === "dragon") {
      const body = mesh(runtime, new THREE.SphereGeometry(0.7, 18, 12), primary, group);
      body.scale.set(1, 0.65, 2.25);
      body.position.y = 1.3;
      const head = mesh(runtime, new THREE.ConeGeometry(0.55, 1.5, 7), primary, group);
      head.rotation.x = -Math.PI / 2;
      head.position.set(0, 1.45, -1.9);
      [-1, 1].forEach((side) => {
        const wing = mesh(runtime, new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 3.2, 0.25, 1.3), new THREE.Vector3(side * 1.35, 0.05, -0.9)
        ]), new THREE.MeshBasicMaterial({ color: game.color, side: THREE.DoubleSide, transparent: true, opacity: 0.72 }), group);
        wing.position.y = 1.7;
        wing.userData.cgaWing = side;
        runtime.animators.push(wing);
      });
      for (let index = 0; index < 5; index += 1) {
        const tail = mesh(runtime, new THREE.ConeGeometry(0.38 - index * 0.05, 1.1, 7), primary, group);
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 1.2, 1.7 + index * 0.65);
      }
      group.position.y = 1.8;
    } else {
      const hull = mesh(runtime, new THREE.ConeGeometry(0.8, 3.5, 8), primary, group);
      hull.rotation.x = -Math.PI / 2;
      hull.position.y = 0.7;
      const cockpit = mesh(runtime, new THREE.SphereGeometry(0.52, 18, 12), makeMaterial(runtime, 0x8fdcff, { emissive: 0x319fff, emissiveIntensity: 0.75, transparent: true, opacity: 0.9 }), group);
      cockpit.scale.set(0.85, 0.62, 1.1);
      cockpit.position.set(0, 1.15, -0.3);
      [-1, 1].forEach((side) => {
        const wing = mesh(runtime, new THREE.BoxGeometry(2.2, 0.12, 1.25), dark, group);
        wing.position.set(side * 1.12, 0.58, 0.55);
        wing.rotation.y = side * 0.12;
        const engine = mesh(runtime, new THREE.CylinderGeometry(0.2, 0.34, 0.85, 14), primary, group);
        engine.rotation.x = Math.PI / 2;
        engine.position.set(side * 0.72, 0.58, 1.48);
        const glow = createGlowSprite(runtime, game.color, 1.5);
        glow.position.set(side * 0.72, 0.58, 2);
        group.add(glow);
      });
    }
    group.rotation.order = "YXZ";
    return group;
  }

  function addEntity(runtime, type, object, options = {}) {
    const entity = {
      type,
      mesh: object,
      radius: options.radius == null ? 1 : options.radius,
      velocity: options.velocity || new runtime.THREE.Vector3(),
      health: options.health == null ? 1 : options.health,
      maxHealth: options.health == null ? 1 : options.health,
      value: options.value == null ? 1 : options.value,
      cooldown: options.cooldown || 0,
      age: 0,
      ttl: options.ttl || 0,
      alive: true,
      data: options.data || {}
    };
    runtime.entities.push(entity);
    return entity;
  }

  function spawnCollectible(runtime, type, position, color, value = 1) {
    const THREE = runtime.THREE;
    let object;
    if (type === "gate" || type === "ring") {
      object = mesh(runtime, new THREE.TorusGeometry(type === "gate" ? 2 : 1.55, 0.18, 10, 34), makeMaterial(runtime, color, { emissiveIntensity: 2.2 }), runtime.world);
      object.rotation.x = Math.PI / 2;
    } else {
      object = mesh(runtime, new THREE.OctahedronGeometry(0.72, 1), makeMaterial(runtime, color, { emissiveIntensity: 2.5 }), runtime.world);
      const glow = createGlowSprite(runtime, color, 3.2);
      object.add(glow);
    }
    object.position.copy(position);
    runtime.animators.push(object);
    return addEntity(runtime, type, object, { radius: type === "gate" ? 2.1 : 1.15, value });
  }

  function spawnEnemy(runtime, position, color, health = 2, type = "enemy") {
    const THREE = runtime.THREE;
    const group = new THREE.Group();
    const core = mesh(runtime, new THREE.IcosahedronGeometry(type === "guardian" ? 0.85 : 0.65, 1), makeMaterial(runtime, color, { emissiveIntensity: 1.1 }), group);
    const ring = mesh(runtime, new THREE.TorusGeometry(type === "guardian" ? 1.1 : 0.88, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }), group);
    ring.rotation.x = Math.PI / 2;
    group.position.copy(position);
    runtime.world.add(group);
    runtime.animators.push(ring);
    return addEntity(runtime, type, group, { radius: type === "guardian" ? 1.15 : 0.9, health, cooldown: random(0.2, 1.8) });
  }

  function spawnObstacle(runtime, position, color, radius = 1.25) {
    const THREE = runtime.THREE;
    const rock = mesh(runtime, new THREE.DodecahedronGeometry(radius, 1), makeMaterial(runtime, 0x25233a, { emissive: color, emissiveIntensity: 0.16, roughness: 0.78 }), runtime.world);
    rock.position.copy(position);
    rock.rotation.set(random(0, 3), random(0, 3), random(0, 3));
    runtime.animators.push(rock);
    return addEntity(runtime, "obstacle", rock, { radius: radius * 0.85, value: 1 });
  }

  function randomArenaPosition(runtime, minRadius = 7, maxRadius = 29, y = 0.8) {
    const angle = random(0, Math.PI * 2);
    const radius = random(minRadius, maxRadius);
    return new runtime.THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }

  function createGameWorld(runtime) {
    disposeWorld(runtime);
    runtime.entities = [];
    runtime.animators = [];
    runtime.decor = [];
    runtime.projectiles = [];
    runtime.effects = [];
    runtime.game = gameById(runtime.gameId);
    runtime.elapsed = 0;
    runtime.timeLeft = runtime.game.time;
    runtime.score = 0;
    runtime.objective = 0;
    runtime.health = 100;
    runtime.damageCooldown = 0;
    runtime.actionCooldown = 0;
    runtime.boostEnergy = 100;
    runtime.boss = null;
    runtime.ball = null;
    runtime.enemyScore = 0;
    runtime.radarUntil = 0;
    runtime.cameraMode = runtime.game.camera || "chase";
    runtime.orbitAngle = 0;
    runtime.cameraShake = 0;
    runtime.phase = "ready";
    runtime.ui.app.dataset.cgaPhase = "ready";
    runtime.scene.clear();
    runtime.scene.background.set(0x02040d);
    runtime.scene.fog.color.set(runtime.game.id === "dragon-sky" ? 0x132140 : 0x050716);
    addLights(runtime, runtime.game);
    createStarfield(runtime, runtime.game);
    createArena(runtime, runtime.game);
    runtime.player = {
      mesh: createShip(runtime, runtime.game, runtime.game.id === "mecha-frontier" || runtime.game.id === "crystal-expedition" ? "mecha" : runtime.game.id === "dragon-sky" ? "dragon" : "ship"),
      velocity: new runtime.THREE.Vector3(),
      direction: new runtime.THREE.Vector3(0, 0, -1),
      radius: runtime.game.id === "dragon-sky" ? 1.35 : 1.05,
      yaw: 0
    };
    runtime.world.add(runtime.player.mesh);
    runtime.player.mesh.position.set(0, runtime.game.id === "dragon-sky" ? 3.1 : 0, 8);

    if (runtime.gameId === "neon-skyline-rush") setupRacer(runtime);
    else if (runtime.gameId === "mecha-frontier") setupMecha(runtime);
    else if (runtime.gameId === "dragon-sky") setupDragon(runtime);
    else if (runtime.gameId === "titan-protocol") setupBoss(runtime);
    else if (runtime.gameId === "crystal-expedition") setupExplorer(runtime);
    else setupHoverball(runtime);
    updateStaticUi(runtime);
    updateHud(runtime, true);
    showReadyOverlay(runtime);
    runtime.ui.status.textContent = `${runtime.game.name} đã sẵn sàng`;
    runtime.ui.canvasShell.focus({ preventScroll: true });
  }

  function setupRacer(runtime) {
    const colors = [runtime.game.color, runtime.game.accent, "#b8ff5b", "#ff70dd"];
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + 0.25;
      spawnCollectible(runtime, "gate", new runtime.THREE.Vector3(Math.cos(angle) * 23, 1.6, Math.sin(angle) * 23), colors[index % colors.length]);
    }
    for (let index = 0; index < 15; index += 1) spawnObstacle(runtime, randomArenaPosition(runtime, 8, 28, 1), "#ff3864", random(0.65, 1.5));
  }

  function setupMecha(runtime) {
    for (let index = 0; index < 7; index += 1) spawnEnemy(runtime, randomArenaPosition(runtime, 11, 27, 0.9), index % 2 ? runtime.game.color : runtime.game.accent, 3);
    for (let index = 0; index < 8; index += 1) spawnObstacle(runtime, randomArenaPosition(runtime, 8, 28, 1), "#38184a", random(0.6, 1.2));
  }

  function setupDragon(runtime) {
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      spawnCollectible(runtime, "ring", new runtime.THREE.Vector3(Math.cos(angle) * random(17, 25), random(2.8, 5.2), Math.sin(angle) * random(17, 25)), runtime.game.color);
    }
    for (let index = 0; index < 12; index += 1) spawnObstacle(runtime, randomArenaPosition(runtime, 9, 29, random(2.2, 5.5)), "#ff7038", random(0.7, 1.55));
  }

  function setupBoss(runtime) {
    const THREE = runtime.THREE;
    const group = new THREE.Group();
    const core = mesh(runtime, new THREE.IcosahedronGeometry(2.6, 2), makeMaterial(runtime, runtime.game.color, { emissiveIntensity: 1.4, metalness: 0.92 }), group);
    const ring = mesh(runtime, new THREE.TorusGeometry(4.1, 0.3, 10, 48), makeMaterial(runtime, runtime.game.accent, { emissiveIntensity: 2 }), group);
    ring.rotation.x = Math.PI / 2;
    const ring2 = ring.clone();
    ring2.rotation.set(Math.PI / 3, 0, Math.PI / 4);
    group.add(ring2);
    group.position.set(0, 4.5, -15);
    runtime.world.add(group);
    runtime.animators.push(ring, ring2, core);
    runtime.boss = addEntity(runtime, "boss", group, { radius: 3.2, health: 520, cooldown: 1.4 });
    for (let index = 0; index < 10; index += 1) spawnObstacle(runtime, randomArenaPosition(runtime, 11, 30, 1), "#ff6b42", random(0.7, 1.35));
  }

  function setupExplorer(runtime) {
    for (let index = 0; index < 15; index += 1) spawnCollectible(runtime, "crystal", randomArenaPosition(runtime, 7, 28, 0.9), index % 3 ? runtime.game.color : runtime.game.accent);
    for (let index = 0; index < 6; index += 1) spawnEnemy(runtime, randomArenaPosition(runtime, 13, 29, 0.85), "#ff3d77", 4, "guardian");
  }

  function setupHoverball(runtime) {
    const THREE = runtime.THREE;
    const ballMesh = mesh(runtime, new THREE.IcosahedronGeometry(1.15, 2), makeMaterial(runtime, runtime.game.color, { emissiveIntensity: 2.1 }), runtime.world);
    ballMesh.position.set(0, 1.2, 0);
    ballMesh.add(createGlowSprite(runtime, runtime.game.color, 4.5));
    runtime.ball = addEntity(runtime, "ball", ballMesh, { radius: 1.25, health: 999, data: { friction: 0.986 } });
    const goalMaterial = new THREE.MeshBasicMaterial({ color: runtime.game.accent, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    [-1, 1].forEach((side) => {
      const goal = mesh(runtime, new THREE.TorusGeometry(4.2, 0.24, 10, 42, Math.PI), goalMaterial.clone(), runtime.world);
      goal.rotation.set(Math.PI / 2, 0, side > 0 ? Math.PI : 0);
      goal.position.set(0, 0.2, side * 28);
    });
    runtime.ai = createShip(runtime, { color: "#ff4e77", accent: "#ffb347" }, "ship");
    runtime.ai.position.set(0, 0, -16);
    runtime.ai.scale.setScalar(0.9);
    runtime.world.add(runtime.ai);
    runtime.aiVelocity = new THREE.Vector3();
  }

  function showReadyOverlay(runtime) {
    runtime.ui.overlay.hidden = false;
    runtime.ui.overlayKicker.textContent = "SẴN SÀNG TRIỂN KHAI";
    runtime.ui.overlayTitle.textContent = runtime.game.name;
    runtime.ui.overlayCopy.textContent = runtime.game.objective;
    const button = runtime.ui.overlay.querySelector('[data-cga-action="start"]');
    if (button) button.textContent = "Bắt đầu nhiệm vụ";
  }

  function updateStaticUi(runtime) {
    const game = runtime.game;
    runtime.ui.title.textContent = game.name;
    runtime.ui.genre.textContent = game.genre;
    runtime.ui.missionTitle.textContent = game.name;
    runtime.ui.missionCopy.textContent = game.objective;
    runtime.ui.controls.textContent = game.controls;
    runtime.ui.tip.textContent = game.controls;
    runtime.ui.reward.textContent = `${game.reward} coin + XP`;
    runtime.ui.camera.textContent = runtime.cameraMode.toUpperCase();
    runtime.ui.qualityLabel.textContent = runtime.resolvedQuality === "high" ? "Điện ảnh" : runtime.resolvedQuality === "medium" ? "Cân bằng" : "Hiệu năng";
    runtime.root.querySelectorAll("[data-cga-game]").forEach((button) => {
      const active = button.dataset.cgaGame === runtime.gameId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setPhase(runtime, phase) {
    runtime.phase = phase;
    runtime.ui.app.dataset.cgaPhase = phase;
  }

  function startGame(runtime) {
    if (!runtime || runtime.destroyed) return;
    if (runtime.phase === "paused") {
      setPhase(runtime, "running");
      runtime.autoPaused = false;
      runtime.ui.overlay.hidden = true;
      runtime.ui.status.textContent = "Nhiệm vụ đang diễn ra";
      runtime.ui.canvasShell.focus({ preventScroll: true });
      return;
    }
    if (runtime.phase === "won" || runtime.phase === "lost") createGameWorld(runtime);
    setPhase(runtime, "running");
    runtime.autoPaused = false;
    runtime.ui.overlay.hidden = true;
    runtime.ui.status.textContent = "Nhiệm vụ đang diễn ra";
    const record = runtime.progress.games[runtime.gameId] || { wins: 0, plays: 0, bestScore: 0, bestTime: 0 };
    record.plays += 1;
    runtime.progress.games[runtime.gameId] = record;
    saveProgress(runtime);
    runtime.ui.canvasShell.focus({ preventScroll: true });
  }

  function togglePause(runtime, force) {
    if (!runtime || !["running", "paused"].includes(runtime.phase)) return;
    const shouldPause = typeof force === "boolean" ? force : runtime.phase === "running";
    setPhase(runtime, shouldPause ? "paused" : "running");
    runtime.ui.overlay.hidden = !shouldPause;
    if (shouldPause) {
      runtime.ui.overlayKicker.textContent = "TẠM DỪNG AN TOÀN";
      runtime.ui.overlayTitle.textContent = "Nhiệm vụ đang tạm dừng";
      runtime.ui.overlayCopy.textContent = "Tiến trình được giữ nguyên. Nhấn tiếp tục khi bạn sẵn sàng.";
      const button = runtime.ui.overlay.querySelector('[data-cga-action="start"]');
      if (button) button.textContent = "Tiếp tục";
    }
    runtime.ui.status.textContent = shouldPause ? "Đã tạm dừng" : "Nhiệm vụ đang diễn ra";
  }

  function cycleCamera(runtime) {
    const index = CAMERA_MODES.indexOf(runtime.cameraMode);
    runtime.cameraMode = CAMERA_MODES[(index + 1) % CAMERA_MODES.length];
    runtime.ui.camera.textContent = runtime.cameraMode.toUpperCase();
    const labels = {
      chase: "bám đuổi",
      shoulder: "qua vai",
      flight: "bay tự do",
      "lock-on": "khóa mục tiêu",
      orbit: "quỹ đạo",
      broadcast: "truyền hình",
      cinematic: "điện ảnh"
    };
    toast(runtime, `Camera: ${labels[runtime.cameraMode] || runtime.cameraMode}`);
  }

  function toast(runtime, message) {
    runtime.ui.message.textContent = String(message).slice(0, 160);
    runtime.ui.message.hidden = false;
    clearTimeout(runtime.messageTimer);
    runtime.messageTimer = global.setTimeout(() => {
      if (runtime && runtime.ui && runtime.ui.message) runtime.ui.message.hidden = true;
    }, runtime.reducedMotion ? 1200 : 2200);
  }

  function isControlTarget(target) {
    if (!target || !target.tagName) return false;
    return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName) || target.isContentEditable;
  }

  function bindControls(runtime) {
    const onKeyDown = (event) => {
      if (isControlTarget(event.target) && !runtime.ui.canvasShell.contains(event.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      if (event.code === "Escape") {
        event.preventDefault();
        togglePause(runtime);
        return;
      }
      if (event.code === "KeyC" && !event.repeat) cycleCamera(runtime);
      if (event.code === "Space" && !event.repeat) performAction(runtime);
      runtime.keys.add(event.code);
    };
    const onKeyUp = (event) => runtime.keys.delete(event.code);
    const onVisibility = () => {
      if (document.hidden && runtime.phase === "running") {
        runtime.autoPaused = true;
        togglePause(runtime, true);
      }
    };
    const onClick = (event) => {
      const gameButton = event.target.closest("[data-cga-game]");
      if (gameButton && runtime.root.contains(gameButton)) {
        selectGame(runtime, gameButton.dataset.cgaGame);
        return;
      }
      const action = event.target.closest("[data-cga-action]");
      if (!action || !runtime.root.contains(action)) return;
      const name = action.dataset.cgaAction;
      if (name === "start") startGame(runtime);
      else if (name === "pause") togglePause(runtime);
      else if (name === "restart") createGameWorld(runtime);
      else if (name === "camera") cycleCamera(runtime);
      else if (name === "fire") performAction(runtime);
    };
    const onPointerDown = (event) => {
      const keyButton = event.target.closest("[data-cga-key]");
      if (!keyButton || !runtime.root.contains(keyButton)) return;
      event.preventDefault();
      runtime.keys.add(keyButton.dataset.cgaKey);
      keyButton.setPointerCapture && keyButton.setPointerCapture(event.pointerId);
      keyButton.classList.add("is-pressed");
    };
    const releasePointer = (event) => {
      const keyButton = event.target && event.target.closest ? event.target.closest("[data-cga-key]") : null;
      if (keyButton) {
        runtime.keys.delete(keyButton.dataset.cgaKey);
        keyButton.classList.remove("is-pressed");
      } else if (event.type === "blur") runtime.keys.clear();
    };
    const onQuality = () => changeQuality(runtime, runtime.ui.quality.value);
    const onPointerMove = (event) => {
      if (!runtime.pointerDown || runtime.cameraMode !== "orbit") return;
      runtime.orbitAngle += event.movementX * 0.004;
      runtime.orbitPitch = clamp(runtime.orbitPitch + event.movementY * 0.002, -0.35, 0.65);
    };
    addListener(runtime, global, "keydown", onKeyDown, { passive: false });
    addListener(runtime, global, "keyup", onKeyUp);
    addListener(runtime, global, "blur", releasePointer);
    addListener(runtime, document, "visibilitychange", onVisibility);
    addListener(runtime, runtime.root, "click", onClick);
    addListener(runtime, runtime.root, "pointerdown", onPointerDown, { passive: false });
    addListener(runtime, runtime.root, "pointerup", releasePointer);
    addListener(runtime, runtime.root, "pointercancel", releasePointer);
    addListener(runtime, runtime.ui.quality, "change", onQuality);
    addListener(runtime, runtime.ui.canvasShell, "pointerdown", () => { runtime.pointerDown = true; });
    addListener(runtime, global, "pointerup", () => { runtime.pointerDown = false; runtime.keys.clear(); });
    addListener(runtime, runtime.ui.canvasShell, "pointermove", onPointerMove);
  }

  function selectGame(runtime, gameId) {
    if (!GAME_DEFINITIONS.some((game) => game.id === gameId) || gameId === runtime.gameId) return;
    runtime.gameId = gameId;
    createGameWorld(runtime);
  }

  function changeQuality(runtime, preference) {
    if (!QUALITY_LEVELS[preference] && preference !== "auto") return;
    runtime.qualityPreference = preference;
    runtime.resolvedQuality = preference === "auto" ? detectQuality() : preference;
    runtime.quality = QUALITY_LEVELS[runtime.resolvedQuality];
    try { global.localStorage && global.localStorage.setItem(`${STORAGE_SCHEMA}.quality`, preference); } catch (error) { /* Optional preference. */ }
    const selectedGame = runtime.gameId;
    initializeGraphics(runtime).then(() => {
      runtime.gameId = selectedGame;
      createGameWorld(runtime);
      toast(runtime, "Đã áp dụng chất lượng đồ họa mới");
    }).catch((error) => showFallback(runtime, error.message));
  }

  async function initializeGraphics(runtime) {
    if (!runtime.THREE) runtime.THREE = await loadThree(runtime);
    if (runtime.renderer) {
      if (runtime.resizeObserver) runtime.resizeObserver.disconnect();
      disposeWorld(runtime);
      runtime.renderer.dispose();
      runtime.renderer.domElement.remove();
      runtime.renderer = null;
    }
    runtime.contextLost = false;
    createRenderer(runtime);
  }

  function inputAxis(runtime, positiveCodes, negativeCodes) {
    const positive = positiveCodes.some((key) => runtime.keys.has(key)) ? 1 : 0;
    const negative = negativeCodes.some((key) => runtime.keys.has(key)) ? 1 : 0;
    return positive - negative;
  }

  function updatePlayer(runtime, dt) {
    const THREE = runtime.THREE;
    const horizontal = inputAxis(runtime, ["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]);
    const vertical = inputAxis(runtime, ["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
    const boosting = runtime.keys.has("ShiftLeft") || runtime.keys.has("ShiftRight");
    const baseSpeed = runtime.gameId === "neon-skyline-rush" ? 14 : runtime.gameId === "dragon-sky" ? 12 : runtime.gameId === "hoverball-arena" ? 10 : 8.5;
    const boost = boosting && runtime.boostEnergy > 1 ? 1.65 : 1;
    if (boosting && runtime.boostEnergy > 0) runtime.boostEnergy = Math.max(0, runtime.boostEnergy - dt * 24);
    else runtime.boostEnergy = Math.min(100, runtime.boostEnergy + dt * 13);
    const target = new THREE.Vector3(horizontal, 0, -vertical);
    if (target.lengthSq() > 0) {
      target.normalize();
      runtime.player.direction.lerp(target, 1 - Math.exp(-dt * 10)).normalize();
    }
    target.multiplyScalar(baseSpeed * boost);
    const damping = 1 - Math.exp(-dt * (boost > 1 ? 7 : 10));
    runtime.player.velocity.lerp(target, damping);
    runtime.player.mesh.position.addScaledVector(runtime.player.velocity, dt);
    const radial = Math.hypot(runtime.player.mesh.position.x, runtime.player.mesh.position.z);
    if (radial > 31.5) {
      runtime.player.mesh.position.x *= 31.5 / radial;
      runtime.player.mesh.position.z *= 31.5 / radial;
      runtime.player.velocity.multiplyScalar(-0.25);
    }
    if (runtime.player.direction.lengthSq() > 0.1) {
      const desiredYaw = Math.atan2(-runtime.player.direction.x, -runtime.player.direction.z);
      let delta = desiredYaw - runtime.player.mesh.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      runtime.player.mesh.rotation.y += delta * Math.min(1, dt * 9);
      runtime.player.yaw = runtime.player.mesh.rotation.y;
    }
    const speed = runtime.player.velocity.length();
    const bankTarget = -horizontal * (runtime.gameId === "mecha-frontier" || runtime.gameId === "crystal-expedition" ? 0.08 : 0.28);
    runtime.player.mesh.rotation.z = lerp(runtime.player.mesh.rotation.z, bankTarget, Math.min(1, dt * 7));
    if (runtime.gameId === "dragon-sky") runtime.player.mesh.position.y = 3.3 + Math.sin(runtime.elapsed * 2.4) * 0.42 + clamp(vertical, -1, 1) * 0.35;
    else runtime.player.mesh.position.y = Math.sin(runtime.elapsed * 3.4) * 0.08;
    runtime.player.mesh.userData.cgaSpeed = speed;
  }

  function performAction(runtime) {
    if (!runtime || runtime.phase !== "running" || runtime.actionCooldown > 0) return;
    if (runtime.gameId === "crystal-expedition") {
      runtime.radarUntil = runtime.elapsed + 3.5;
      runtime.actionCooldown = 4.5;
      pulseEffect(runtime, runtime.player.mesh.position, runtime.game.color, 8);
      toast(runtime, "Radar lượng tử đã đánh dấu tinh thể gần nhất");
      return;
    }
    if (runtime.gameId === "hoverball-arena") {
      runtime.actionCooldown = 1.1;
      runtime.player.velocity.addScaledVector(runtime.player.direction, 8);
      pulseEffect(runtime, runtime.player.mesh.position, runtime.game.color, 3.5);
      return;
    }
    if (runtime.gameId === "neon-skyline-rush") {
      runtime.actionCooldown = 2.3;
      runtime.player.velocity.addScaledVector(runtime.player.direction, 12);
      pulseEffect(runtime, runtime.player.mesh.position, runtime.game.color, 3);
      return;
    }
    fireProjectile(runtime, false, runtime.gameId === "dragon-sky" ? 2.1 : 1);
    runtime.actionCooldown = runtime.gameId === "titan-protocol" ? 0.22 : runtime.gameId === "dragon-sky" ? 0.46 : 0.32;
  }

  function fireProjectile(runtime, hostile, scale = 1, origin, direction) {
    const THREE = runtime.THREE;
    const color = hostile ? "#ff315e" : runtime.game.color;
    const bolt = mesh(runtime, new THREE.CapsuleGeometry(0.11 * scale, 0.72 * scale, 4, 8), makeMaterial(runtime, color, { emissiveIntensity: 3, roughness: 0.1 }), runtime.world);
    bolt.rotation.x = Math.PI / 2;
    const start = origin ? origin.clone() : runtime.player.mesh.position.clone();
    start.y += hostile ? 0 : runtime.gameId === "dragon-sky" ? 1 : 0.8;
    bolt.position.copy(start);
    const autoAim = !hostile && runtime.gameId === "titan-protocol" && runtime.boss && runtime.boss.alive
      ? runtime.boss.mesh.position.clone().sub(start)
      : runtime.player.direction;
    const velocity = direction ? direction.clone().normalize() : autoAim.clone().normalize();
    velocity.multiplyScalar(hostile ? 11 : runtime.gameId === "dragon-sky" ? 22 : 25);
    const entity = addEntity(runtime, hostile ? "enemy-projectile" : "projectile", bolt, { radius: 0.35 * scale, velocity, ttl: hostile ? 5 : 3.5, value: hostile ? 12 : (runtime.gameId === "titan-protocol" ? 13 : 1) });
    runtime.projectiles.push(entity);
  }

  function pulseEffect(runtime, position, color, maxScale) {
    const ring = mesh(runtime, new runtime.THREE.TorusGeometry(1, 0.08, 8, 36), new runtime.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: runtime.THREE.AdditiveBlending }), runtime.world);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.15;
    runtime.effects.push({ mesh: ring, age: 0, ttl: 0.65, maxScale });
  }

  function hitPlayer(runtime, amount, message) {
    if (runtime.damageCooldown > 0 || runtime.phase !== "running") return;
    runtime.health = Math.max(0, runtime.health - amount);
    runtime.damageCooldown = 0.75;
    runtime.cameraShake = runtime.reducedMotion ? 0 : Math.min(1, amount / 30);
    toast(runtime, message || `Giáp giảm ${amount}%`);
    pulseEffect(runtime, runtime.player.mesh.position, "#ff315e", 3);
    if (runtime.health <= 0) finishGame(runtime, false, "Giáp chiến đấu đã cạn năng lượng.");
  }

  function distanceCollision(a, b, radius) {
    return a.distanceToSquared(b) <= radius * radius;
  }

  function removeEntity(runtime, entity) {
    if (!entity || !entity.alive) return;
    entity.alive = false;
    if (entity.mesh && entity.mesh.parent) entity.mesh.parent.remove(entity.mesh);
    disposeObject(entity.mesh);
  }

  function updateGame(runtime, dt) {
    runtime.elapsed += dt;
    runtime.timeLeft = Math.max(0, runtime.timeLeft - dt);
    runtime.damageCooldown = Math.max(0, runtime.damageCooldown - dt);
    runtime.actionCooldown = Math.max(0, runtime.actionCooldown - dt);
    updatePlayer(runtime, dt);
    if (runtime.keys.has("Space") && runtime.actionCooldown <= 0) performAction(runtime);
    if (runtime.gameId === "neon-skyline-rush") updateRacer(runtime, dt);
    else if (runtime.gameId === "mecha-frontier") updateMecha(runtime, dt);
    else if (runtime.gameId === "dragon-sky") updateDragon(runtime, dt);
    else if (runtime.gameId === "titan-protocol") updateBoss(runtime, dt);
    else if (runtime.gameId === "crystal-expedition") updateExplorer(runtime, dt);
    else updateHoverball(runtime, dt);
    updateProjectiles(runtime, dt);
    updateEffects(runtime, dt);
    if (runtime.timeLeft <= 0 && runtime.phase === "running") finishGame(runtime, false, "Thời gian nhiệm vụ đã kết thúc.");
  }

  function updateRacer(runtime, dt) {
    const playerPosition = runtime.player.mesh.position;
    runtime.entities.forEach((entity) => {
      if (!entity.alive) return;
      if (entity.type === "gate" && distanceCollision(playerPosition, entity.mesh.position, runtime.player.radius + entity.radius)) {
        removeEntity(runtime, entity);
        runtime.objective += 1;
        runtime.score += 120 + Math.round(runtime.player.velocity.length() * 4);
        pulseEffect(runtime, playerPosition, runtime.game.color, 5);
        toast(runtime, `Cổng lượng tử ${runtime.objective}/${runtime.game.goal}`);
        if (runtime.objective >= runtime.game.goal) finishGame(runtime, true);
      } else if (entity.type === "obstacle" && distanceCollision(playerPosition, entity.mesh.position, runtime.player.radius + entity.radius)) {
        hitPlayer(runtime, 18, "Va chạm thiên thạch: giáp -18%");
        runtime.player.velocity.multiplyScalar(-0.35);
      }
    });
    runtime.score += dt * runtime.player.velocity.length() * 0.4;
  }

  function updateMecha(runtime, dt) {
    const enemies = runtime.entities.filter((entity) => entity.alive && entity.type === "enemy");
    enemies.forEach((enemy) => {
      const direction = runtime.player.mesh.position.clone().sub(enemy.mesh.position);
      const distance = direction.length();
      direction.normalize();
      enemy.mesh.position.addScaledVector(direction, dt * (distance > 9 ? 2.4 : -0.7));
      enemy.mesh.rotation.y += dt * 1.6;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0 && distance < 22) {
        fireProjectile(runtime, true, 1, enemy.mesh.position, direction);
        enemy.cooldown = random(1.6, 3.1);
      }
      if (distance < enemy.radius + runtime.player.radius) hitPlayer(runtime, 12, "Drone va vào giáp máy chiến");
    });
    if (enemies.length < 5 && runtime.objective < runtime.game.goal && runtime.entities.filter((entity) => entity.alive && entity.type === "enemy").length < 5) {
      spawnEnemy(runtime, randomArenaPosition(runtime, 18, 29, 0.9), Math.random() > 0.5 ? runtime.game.color : runtime.game.accent, runtime.objective > 7 ? 4 : 3);
    }
  }

  function updateDragon(runtime, dt) {
    const playerPosition = runtime.player.mesh.position;
    runtime.entities.forEach((entity) => {
      if (!entity.alive) return;
      if (entity.type === "ring" && distanceCollision(playerPosition, entity.mesh.position, runtime.player.radius + entity.radius)) {
        removeEntity(runtime, entity);
        runtime.objective += 1;
        runtime.score += 145;
        toast(runtime, `Vòng gió ${runtime.objective}/${runtime.game.goal}`);
        if (runtime.objective >= runtime.game.goal) finishGame(runtime, true);
      } else if (entity.type === "obstacle" && distanceCollision(playerPosition, entity.mesh.position, runtime.player.radius + entity.radius)) {
        hitPlayer(runtime, 15, "Cánh rồng va vào thiên thạch");
      }
    });
  }

  function updateBoss(runtime, dt) {
    const boss = runtime.boss;
    if (!boss || !boss.alive) return;
    boss.mesh.position.x = Math.sin(runtime.elapsed * 0.48) * 14;
    boss.mesh.position.z = -15 + Math.cos(runtime.elapsed * 0.31) * 4;
    boss.mesh.rotation.y += dt * 0.42;
    boss.cooldown -= dt;
    if (boss.cooldown <= 0) {
      const direction = runtime.player.mesh.position.clone().sub(boss.mesh.position).normalize();
      const spread = boss.health < boss.maxHealth * 0.45 ? [-0.22, 0, 0.22] : [0];
      spread.forEach((angle) => {
        const shotDirection = direction.clone().applyAxisAngle(new runtime.THREE.Vector3(0, 1, 0), angle);
        fireProjectile(runtime, true, boss.health < boss.maxHealth * 0.45 ? 1.35 : 1, boss.mesh.position, shotDirection);
      });
      boss.cooldown = boss.health < boss.maxHealth * 0.45 ? 0.9 : 1.55;
    }
    runtime.objective = Math.round((1 - boss.health / boss.maxHealth) * 100);
  }

  function updateExplorer(runtime, dt) {
    const playerPosition = runtime.player.mesh.position;
    runtime.entities.forEach((entity) => {
      if (!entity.alive) return;
      if (entity.type === "crystal") {
        const close = distanceCollision(playerPosition, entity.mesh.position, runtime.player.radius + entity.radius);
        entity.mesh.scale.setScalar(runtime.elapsed < runtime.radarUntil ? 1.35 + Math.sin(runtime.elapsed * 8) * 0.12 : 1);
        if (close) {
          removeEntity(runtime, entity);
          runtime.objective += 1;
          runtime.score += 160;
          toast(runtime, `Tinh thể cổ ${runtime.objective}/${runtime.game.goal}`);
          if (runtime.objective >= runtime.game.goal) finishGame(runtime, true);
        }
      } else if (entity.type === "guardian") {
        const direction = playerPosition.clone().sub(entity.mesh.position);
        const distance = direction.length();
        if (distance < (runtime.elapsed < runtime.radarUntil ? 10 : 16)) entity.mesh.position.addScaledVector(direction.normalize(), dt * 2.35);
        if (distance < entity.radius + runtime.player.radius) hitPlayer(runtime, 14, "Vệ binh bóng tối đã chạm vào bạn");
      }
    });
  }

  function updateHoverball(runtime, dt) {
    const ball = runtime.ball;
    if (!ball || !ball.alive) return;
    ball.mesh.position.addScaledVector(ball.velocity, dt);
    ball.velocity.multiplyScalar(Math.pow(ball.data.friction, dt * 60));
    ball.mesh.rotation.x += ball.velocity.z * dt * 0.45;
    ball.mesh.rotation.z -= ball.velocity.x * dt * 0.45;
    if (Math.abs(ball.mesh.position.x) > 29) {
      ball.mesh.position.x = Math.sign(ball.mesh.position.x) * 29;
      ball.velocity.x *= -0.72;
    }
    const playerDistance = runtime.player.mesh.position.distanceTo(ball.mesh.position);
    if (playerDistance < runtime.player.radius + ball.radius) {
      const impulse = ball.mesh.position.clone().sub(runtime.player.mesh.position).setY(0).normalize();
      const actionBoost = runtime.actionCooldown > 0.75 ? 14 : 7;
      ball.velocity.addScaledVector(impulse, actionBoost + runtime.player.velocity.length() * 0.6);
    }
    const aiTarget = ball.mesh.position.clone();
    aiTarget.z = Math.min(-2, ball.mesh.position.z - 1.8);
    const aiDirection = aiTarget.sub(runtime.ai.position).setY(0);
    if (aiDirection.lengthSq() > 0.2) runtime.aiVelocity.lerp(aiDirection.normalize().multiplyScalar(7), 1 - Math.exp(-dt * 6));
    runtime.ai.position.addScaledVector(runtime.aiVelocity, dt);
    runtime.ai.position.x = clamp(runtime.ai.position.x, -25, 25);
    runtime.ai.position.z = clamp(runtime.ai.position.z, -27, -2);
    if (runtime.ai.position.distanceTo(ball.mesh.position) < 2.3) {
      const impulse = ball.mesh.position.clone().sub(runtime.ai.position).setY(0).normalize();
      ball.velocity.addScaledVector(impulse, 9);
    }
    if (ball.mesh.position.z < -29.2) scoreHoverball(runtime, true);
    else if (ball.mesh.position.z > 29.2) scoreHoverball(runtime, false);
  }

  function scoreHoverball(runtime, playerScored) {
    if (playerScored) {
      runtime.objective += 1;
      runtime.score += 350;
      toast(runtime, `NOVA GOAL! ${runtime.objective}/${runtime.game.goal}`);
      if (runtime.objective >= runtime.game.goal) {
        finishGame(runtime, true);
        return;
      }
    } else {
      runtime.enemyScore += 1;
      hitPlayer(runtime, 24, `Đối thủ ghi bàn · Tỷ số ${runtime.objective}-${runtime.enemyScore}`);
      if (runtime.enemyScore >= 3) {
        finishGame(runtime, false, "Đối thủ đã ghi đủ ba bàn.");
        return;
      }
    }
    runtime.ball.mesh.position.set(0, 1.2, 0);
    runtime.ball.velocity.set(0, 0, playerScored ? 2 : -2);
    runtime.player.mesh.position.set(0, 0, 9);
    runtime.ai.position.set(0, 0, -16);
  }

  function updateProjectiles(runtime, dt) {
    runtime.projectiles.forEach((projectile) => {
      if (!projectile.alive) return;
      projectile.age += dt;
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      if (projectile.ttl && projectile.age >= projectile.ttl) {
        removeEntity(runtime, projectile);
        return;
      }
      if (projectile.type === "enemy-projectile") {
        if (distanceCollision(projectile.mesh.position, runtime.player.mesh.position, projectile.radius + runtime.player.radius)) {
          removeEntity(runtime, projectile);
          hitPlayer(runtime, projectile.value, "Trúng đạn năng lượng của đối thủ");
        }
        return;
      }
      const targets = runtime.entities.filter((entity) => entity.alive && ["enemy", "guardian", "boss", "obstacle"].includes(entity.type));
      const hit = targets.find((target) => distanceCollision(projectile.mesh.position, target.mesh.position, projectile.radius + target.radius));
      if (!hit) return;
      removeEntity(runtime, projectile);
      if (hit.type === "obstacle" && runtime.gameId === "dragon-sky") {
        removeEntity(runtime, hit);
        runtime.score += 35;
        pulseEffect(runtime, hit.mesh.position, runtime.game.accent, 4);
        return;
      }
      if (!["enemy", "guardian", "boss"].includes(hit.type)) return;
      hit.health -= projectile.value;
      pulseEffect(runtime, hit.mesh.position, runtime.game.color, 2.6);
      if (hit.health <= 0) {
        removeEntity(runtime, hit);
        if (hit.type === "boss") {
          runtime.objective = 1;
          runtime.score += 2400;
          finishGame(runtime, true);
        } else if (runtime.gameId === "mecha-frontier") {
          runtime.objective += 1;
          runtime.score += 180;
          toast(runtime, `Drone bị phá hủy ${runtime.objective}/${runtime.game.goal}`);
          if (runtime.objective >= runtime.game.goal) finishGame(runtime, true);
        } else runtime.score += 80;
      }
    });
    runtime.projectiles = runtime.projectiles.filter((entity) => entity.alive);
    runtime.entities = runtime.entities.filter((entity) => entity.alive);
  }

  function updateEffects(runtime, dt) {
    runtime.effects.forEach((effect) => {
      effect.age += dt;
      const ratio = clamp(effect.age / effect.ttl, 0, 1);
      effect.mesh.scale.setScalar(lerp(0.2, effect.maxScale, ratio));
      effect.mesh.material.opacity = 1 - ratio;
      if (ratio >= 1) {
        if (effect.mesh.parent) effect.mesh.parent.remove(effect.mesh);
        disposeObject(effect.mesh);
      }
    });
    runtime.effects = runtime.effects.filter((effect) => effect.age < effect.ttl);
  }

  function animateDecor(runtime, dt) {
    runtime.decor.forEach((object) => {
      if (object.userData.cgaDecor) object.rotation.y += dt * object.userData.cgaDecor.spin;
    });
    runtime.animators.forEach((object, index) => {
      if (!object || !object.parent) return;
      if (object.userData.cgaWing) object.rotation.z = object.userData.cgaWing * (0.16 + Math.sin(runtime.elapsed * 7) * 0.18);
      else {
        object.rotation.y += dt * (0.35 + (index % 4) * 0.12);
        if (object.userData && !object.userData.cgaNoFloat) object.position.y += Math.sin(runtime.elapsed * 2 + index) * dt * 0.018;
      }
    });
  }

  function updateCamera(runtime, dt) {
    if (!runtime.player || !runtime.camera) return;
    const THREE = runtime.THREE;
    const playerPosition = runtime.player.mesh.position;
    const forward = runtime.player.direction.clone().setY(0).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    if (runtime.cameraMode === "chase") {
      runtime.cameraDesired.copy(playerPosition).addScaledVector(forward, -9).add(new THREE.Vector3(0, runtime.gameId === "dragon-sky" ? 5.2 : 6.2, 0));
      runtime.cameraLook.copy(playerPosition).addScaledVector(forward, 4).add(new THREE.Vector3(0, 1.1, 0));
    } else if (runtime.cameraMode === "shoulder") {
      runtime.cameraDesired.copy(playerPosition).addScaledVector(forward, -5.4).addScaledVector(right, 2.1).add(new THREE.Vector3(0, 3.8, 0));
      runtime.cameraLook.copy(playerPosition).addScaledVector(forward, 9).add(new THREE.Vector3(0, 1.7, 0));
    } else if (runtime.cameraMode === "flight") {
      runtime.cameraDesired.copy(playerPosition).addScaledVector(forward, -12).add(new THREE.Vector3(0, 3.6, 0));
      runtime.cameraLook.copy(playerPosition).addScaledVector(forward, 8).add(new THREE.Vector3(0, 0.8, 0));
    } else if (runtime.cameraMode === "lock-on") {
      const target = runtime.boss && runtime.boss.alive ? runtime.boss.mesh.position : playerPosition.clone().addScaledVector(forward, 12);
      runtime.cameraDesired.copy(playerPosition).addScaledVector(forward, -6.5).addScaledVector(right, 4.2).add(new THREE.Vector3(0, 5.2, 0));
      runtime.cameraLook.copy(target).lerp(playerPosition, 0.18);
    } else if (runtime.cameraMode === "orbit") {
      runtime.orbitAngle += dt * (runtime.pointerDown ? 0 : 0.13);
      const radius = 14;
      runtime.cameraDesired.set(playerPosition.x + Math.cos(runtime.orbitAngle) * radius, playerPosition.y + 7 + Math.sin(runtime.orbitPitch || 0) * 5, playerPosition.z + Math.sin(runtime.orbitAngle) * radius);
      runtime.cameraLook.copy(playerPosition).add(new THREE.Vector3(0, 1.2, 0));
    } else if (runtime.cameraMode === "broadcast") {
      const subject = runtime.ball && runtime.ball.alive
        ? playerPosition.clone().lerp(runtime.ball.mesh.position, 0.68)
        : playerPosition;
      runtime.cameraDesired.set(subject.x + 18, 20, subject.z + 20);
      runtime.cameraLook.copy(subject).add(new THREE.Vector3(0, 0.7, 0));
    } else {
      const cinematicTime = runtime.elapsed * 0.18;
      runtime.cameraDesired.set(playerPosition.x + Math.cos(cinematicTime) * 16, playerPosition.y + 5.5 + Math.sin(cinematicTime * 1.7) * 2, playerPosition.z + Math.sin(cinematicTime) * 16);
      runtime.cameraLook.copy(playerPosition).addScaledVector(forward, 2.5).add(new THREE.Vector3(0, 1, 0));
    }
    const cameraDamping = 1 - Math.exp(-dt * (runtime.cameraMode === "cinematic" ? 2.4 : 5.5));
    runtime.camera.position.lerp(runtime.cameraDesired, cameraDamping);
    if (runtime.cameraShake > 0 && !runtime.reducedMotion) {
      runtime.camera.position.x += random(-runtime.cameraShake, runtime.cameraShake) * 0.3;
      runtime.camera.position.y += random(-runtime.cameraShake, runtime.cameraShake) * 0.2;
      runtime.cameraShake = Math.max(0, runtime.cameraShake - dt * 2.6);
    }
    runtime.cameraSmoothedLook.lerp(runtime.cameraLook, 1 - Math.exp(-dt * 7));
    runtime.camera.lookAt(runtime.cameraSmoothedLook);
  }

  function updateHud(runtime, force = false) {
    if (!force && runtime.hudAccumulator < 0.08) return;
    runtime.hudAccumulator = 0;
    const minutes = Math.floor(runtime.timeLeft / 60);
    const seconds = Math.max(0, Math.ceil(runtime.timeLeft % 60));
    runtime.ui.time.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const current = runtime.gameId === "titan-protocol" && runtime.boss ? Math.max(0, Math.round(runtime.boss.maxHealth - runtime.boss.health)) : runtime.objective;
    const goal = runtime.gameId === "titan-protocol" && runtime.boss ? runtime.boss.maxHealth : runtime.game.goal;
    runtime.ui.count.textContent = `${current}/${goal}`;
    runtime.ui.score.textContent = Math.round(runtime.score).toLocaleString("vi-VN");
    runtime.ui.health.style.width = `${clamp(runtime.health, 0, 100)}%`;
    runtime.ui.health.parentElement.setAttribute("aria-valuenow", String(Math.round(runtime.health)));
    const progress = clamp(goal ? current / goal : 0, 0, 1);
    runtime.ui.progress.style.width = `${progress * 100}%`;
    runtime.ui.progressLabel.textContent = `${Math.round(progress * 100)}%`;
  }

  function finishGame(runtime, won, reason) {
    if (!runtime || !["running", "paused"].includes(runtime.phase)) return;
    setPhase(runtime, won ? "won" : "lost");
    runtime.ui.overlay.hidden = false;
    runtime.ui.overlayKicker.textContent = won ? "NHIỆM VỤ HOÀN THÀNH" : "NHIỆM VỤ THẤT BẠI";
    runtime.ui.overlayTitle.textContent = won ? "Chiến thắng điện ảnh!" : "Hãy tái triển khai";
    runtime.ui.overlayCopy.textContent = won ? `Bạn đã hoàn thành ${runtime.game.name} với ${Math.round(runtime.score).toLocaleString("vi-VN")} điểm.` : (reason || "Mục tiêu chưa được hoàn thành.");
    const button = runtime.ui.overlay.querySelector('[data-cga-action="start"]');
    if (button) button.textContent = "Chơi lại";
    runtime.ui.status.textContent = won ? "Nhiệm vụ hoàn thành" : "Nhiệm vụ thất bại";
    if (won) grantReward(runtime);
  }

  function grantReward(runtime) {
    const timeBonus = Math.round(runtime.timeLeft * 0.7);
    const healthBonus = Math.round(runtime.health * 0.45);
    const coins = runtime.game.reward + timeBonus + healthBonus;
    const xp = Math.round(coins * 1.35 + runtime.score * 0.03);
    const record = runtime.progress.games[runtime.gameId] || { wins: 0, plays: 1, bestScore: 0, bestTime: 0 };
    record.wins += 1;
    record.bestScore = Math.max(record.bestScore || 0, Math.round(runtime.score));
    record.bestTime = Math.max(record.bestTime || 0, Math.round(runtime.timeLeft));
    runtime.progress.games[runtime.gameId] = record;
    runtime.progress.totalCoins += coins;
    runtime.progress.totalXp += xp;
    saveProgress(runtime);
    runtime.ui.coins.textContent = runtime.progress.totalCoins.toLocaleString("vi-VN");
    runtime.ui.xp.textContent = runtime.progress.totalXp.toLocaleString("vi-VN");
    const currentCard = runtime.root.querySelector(`[data-cga-game="${runtime.gameId}"] .cga-game-record`);
    if (currentCard) currentCard.textContent = `${record.wins} thắng`;
    const detail = safeObject({
      schema: STORAGE_SCHEMA,
      version: VERSION,
      ownerId: runtime.ownerId,
      gameId: runtime.gameId,
      gameName: runtime.game.name,
      coins,
      xp,
      score: Math.round(runtime.score),
      completedAt: new Date().toISOString()
    });
    try {
      const event = new CustomEvent("hh:game-reward", { detail });
      document.dispatchEvent(event);
      global.dispatchEvent(new CustomEvent("hh:game-reward", { detail }));
    } catch (error) { /* Older test DOMs may not support CustomEvent. */ }
  }

  function frame(runtime, now) {
    if (!runtime || runtime.destroyed || instance !== runtime) return;
    runtime.raf = global.requestAnimationFrame((timestamp) => frame(runtime, timestamp));
    const dt = Math.min(0.05, Math.max(0.001, (now - runtime.lastFrame) / 1000 || 0.016));
    runtime.lastFrame = now;
    runtime.hudAccumulator += dt;
    runtime.fpsAccumulator += dt;
    runtime.fpsFrames += 1;
    if (runtime.fpsAccumulator >= 1) {
      runtime.fps = Math.round(runtime.fpsFrames / runtime.fpsAccumulator);
      runtime.ui.fps.textContent = `${runtime.fps} FPS`;
      runtime.fpsFrames = 0;
      runtime.fpsAccumulator = 0;
    }
    if (runtime.phase === "running" && !document.hidden && !runtime.contextLost) updateGame(runtime, dt);
    if (runtime.phase !== "paused") animateDecor(runtime, runtime.reducedMotion ? dt * 0.35 : dt);
    updateCamera(runtime, dt);
    updateHud(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function disposeObject(object) {
    if (!object || typeof object.traverse !== "function") return;
    object.traverse((child) => {
      if (child.geometry && typeof child.geometry.dispose === "function") child.geometry.dispose();
      const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
      materials.forEach((material) => {
        Object.keys(material).forEach((key) => {
          const value = material[key];
          if (value && value.isTexture && typeof value.dispose === "function") value.dispose();
        });
        if (typeof material.dispose === "function") material.dispose();
      });
      if (child.userData && child.userData.cgaTexture && typeof child.userData.cgaTexture.dispose === "function") child.userData.cgaTexture.dispose();
    });
  }

  function disposeWorld(runtime) {
    if (!runtime || !runtime.scene) return;
    const children = runtime.scene.children.slice();
    children.forEach((child) => {
      runtime.scene.remove(child);
      disposeObject(child);
    });
    runtime.entities = [];
    runtime.projectiles = [];
    runtime.effects = [];
    runtime.animators = [];
    runtime.decor = [];
  }

  async function mount(target, options = {}) {
    unmount();
    const host = resolveHost(target);
    if (!host) throw new Error("HHCinematicGameArcade.mount cần một phần tử hoặc selector hợp lệ.");
    const root = document.createElement("div");
    root.className = "cga-root";
    host.replaceChildren(root);
    let savedQuality = "auto";
    try { savedQuality = global.localStorage && global.localStorage.getItem(`${STORAGE_SCHEMA}.quality`) || "auto"; } catch (error) { /* Use auto. */ }
    if (!QUALITY_LEVELS[savedQuality] && savedQuality !== "auto") savedQuality = "auto";
    const ownerId = resolveOwnerId(options);
    const runtime = {
      host,
      root,
      options: safeObject(options) || {},
      ownerId,
      progress: loadProgress(ownerId),
      storageAvailable: true,
      gameId: GAME_DEFINITIONS.some((game) => game.id === options.gameId) ? options.gameId : GAME_DEFINITIONS[0].id,
      qualityPreference: savedQuality,
      resolvedQuality: savedQuality === "auto" ? detectQuality() : savedQuality,
      quality: null,
      reducedMotion: Boolean(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches),
      phase: "loading",
      keys: new Set(),
      listeners: [],
      entities: [],
      animators: [],
      decor: [],
      projectiles: [],
      effects: [],
      cameraMode: "chase",
      orbitAngle: Math.PI * 0.5,
      orbitPitch: 0,
      lastFrame: performance.now(),
      hudAccumulator: 0,
      fpsAccumulator: 0,
      fpsFrames: 0,
      fps: 0,
      destroyed: false,
      contextLost: false,
      pointerDown: false,
      messageTimer: 0,
      raf: 0
    };
    runtime.quality = QUALITY_LEVELS[runtime.resolvedQuality];
    instance = runtime;
    renderShell(runtime);
    try {
      runtime.THREE = await loadThree(runtime);
      if (instance !== runtime || runtime.destroyed) return null;
      createRenderer(runtime);
      bindControls(runtime);
      createGameWorld(runtime);
      runtime.lastFrame = performance.now();
      runtime.raf = global.requestAnimationFrame((timestamp) => frame(runtime, timestamp));
      return inspect();
    } catch (error) {
      if (instance === runtime && !runtime.destroyed) showFallback(runtime, error && error.message ? error.message : "Không tải được engine Three.js.");
      return inspect();
    }
  }

  function unmount() {
    const runtime = instance;
    if (!runtime) return;
    runtime.destroyed = true;
    if (runtime.raf) global.cancelAnimationFrame(runtime.raf);
    clearTimeout(runtime.messageTimer);
    runtime.listeners.splice(0).forEach((remove) => {
      try { remove(); } catch (error) { /* Listener may already be gone. */ }
    });
    if (runtime.resizeObserver) runtime.resizeObserver.disconnect();
    disposeWorld(runtime);
    if (runtime.renderer) {
      runtime.renderer.dispose();
      if (typeof runtime.renderer.forceContextLoss === "function") runtime.renderer.forceContextLoss();
      if (runtime.renderer.domElement) runtime.renderer.domElement.remove();
    }
    runtime.keys.clear();
    if (runtime.root && runtime.root.parentNode) runtime.root.remove();
    instance = null;
  }

  function inspect() {
    if (!instance) return { mounted: false, version: VERSION, games: GAME_DEFINITIONS.map((game) => game.id) };
    return safeObject({
      mounted: true,
      version: VERSION,
      ownerId: instance.ownerId,
      gameId: instance.gameId,
      phase: instance.phase,
      cameraMode: instance.cameraMode,
      qualityPreference: instance.qualityPreference,
      resolvedQuality: instance.resolvedQuality,
      reducedMotion: instance.reducedMotion,
      score: Math.round(instance.score || 0),
      objective: instance.objective || 0,
      health: Math.round(instance.health || 0),
      timeLeft: Math.round(instance.timeLeft || 0),
      fps: instance.fps || 0,
      entityCount: instance.entities.length,
      storageAvailable: instance.storageAvailable,
      progress: instance.progress,
      games: GAME_DEFINITIONS.map((game) => ({ id: game.id, name: game.name, genre: game.genre, goal: game.goal }))
    });
  }

  if (typeof window !== "undefined") {
    window.HHCinematicGameArcade = Object.freeze({ mount, unmount, inspect });
  } else {
    global.HHCinematicGameArcade = Object.freeze({ mount, unmount, inspect });
  }
})(typeof window !== "undefined" ? window : globalThis);
