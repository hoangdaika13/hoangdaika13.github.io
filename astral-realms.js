(function (root) {
  "use strict";

  const GAME_ID = "astral-realms";
  const SCHEMA_VERSION = 3;
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
  const CHARACTERS = Object.freeze({
    lyra: {
      id: "lyra", name: "Lyra H", role: "Astral Vanguard", element: "plasma", short: "LH",
      body: "#43dfff", accent: "#ff69cc", hair: "#dffbff", eyes: "#63efff",
      attackScale: 1, speedScale: 1, description: "Kiếm sĩ cân bằng, tạo nhịp Plasma liên hoàn."
    },
    cael: {
      id: "cael", name: "Cael Aurora", role: "Cryo Ranger", element: "cryo", short: "CA",
      body: "#5d86ff", accent: "#8ff7ff", hair: "#e5ecff", eyes: "#8aeaff",
      attackScale: 0.92, speedScale: 1.12, description: "Xạ thủ Băng tinh nhanh, kiểm soát mục tiêu từ xa."
    },
    nyx: {
      id: "nyx", name: "Nyx Veyra", role: "Void Dancer", element: "void", short: "NV",
      body: "#6d43b8", accent: "#d66cff", hair: "#27174b", eyes: "#ff7de4",
      attackScale: 1.08, speedScale: 1.06, description: "Vũ công Hư không gây sát thương bùng nổ và dịch chuyển."
    },
    sol: {
      id: "sol", name: "Sol Riven", role: "Solar Guardian", element: "solar", short: "SR",
      body: "#d47433", accent: "#ffd96a", hair: "#fff2c4", eyes: "#ffbd58",
      attackScale: 1.18, speedScale: 0.94, description: "Hộ vệ Nhật quang có đòn nặng và khả năng hồi phục."
    }
  });
  const CHARACTER_ORDER = Object.freeze(Object.keys(CHARACTERS));
  const APPEARANCE_VERSION = 3;
  const APPEARANCE_GROUPS = Object.freeze([
    { id: "face", label: "Khuôn mặt", focus: "head", controls: [["headLength", "Chiều dài đầu"], ["foreheadHeight", "Chiều cao trán"], ["cheekboneWidth", "Gò má"], ["cheekFullness", "Độ đầy má"], ["jawWidth", "Độ rộng hàm"], ["jawAngle", "Góc hàm"], ["chinLength", "Chiều dài cằm"], ["faceFullness", "Độ đầy khuôn mặt"]] },
    { id: "eyes", label: "Mắt", focus: "head", controls: [["eyeSize", "Kích thước mắt"], ["eyeSpacing", "Khoảng cách mắt"], ["eyeDepth", "Độ sâu mắt"], ["upperLid", "Mí trên"], ["lowerLid", "Mí dưới"], ["eyeAngle", "Góc mắt"], ["irisSize", "Kích thước tròng"], ["pupilSize", "Kích thước đồng tử"], ["eyeReflection", "Phản chiếu mắt"], ["eyeLeft", "Mắt trái"], ["eyeRight", "Mắt phải"]] },
    { id: "brows", label: "Lông mày", focus: "head", controls: [["browShape", "Hình dáng"], ["browThickness", "Độ dày"], ["browHeight", "Chiều cao"], ["browAngle", "Góc nghiêng"]] },
    { id: "nose", label: "Mũi", focus: "head", controls: [["noseBridge", "Sống mũi"], ["noseLength", "Chiều dài"], ["noseTip", "Đầu mũi"], ["noseWing", "Cánh mũi"], ["nostrilWidth", "Lỗ mũi"], ["noseProjection", "Độ nhô"], ["noseCurve", "Độ cong"]] },
    { id: "mouth", label: "Miệng", focus: "head", controls: [["mouthWidth", "Độ rộng miệng"], ["upperLip", "Môi trên"], ["lowerLip", "Môi dưới"], ["mouthCorner", "Khóe miệng"], ["mouthProjection", "Độ nhô"], ["teethShape", "Hình răng"], ["teethSize", "Kích thước răng"], ["philtrum", "Nhân trung"], ["smileLine", "Rãnh cười"]] },
    { id: "ears", label: "Tai", focus: "head", controls: [["earSize", "Kích thước tai"], ["earAngle", "Góc tai"], ["earProtrusion", "Độ vểnh"], ["earLobe", "Dái tai"], ["earLeft", "Tai trái"], ["earRight", "Tai phải"]] },
    { id: "shoulders", label: "Cổ & vai", focus: "upper", controls: [["neckLength", "Chiều dài cổ"], ["neckWidth", "Độ rộng cổ"], ["shoulderWidth", "Độ rộng vai"], ["shoulderSlope", "Độ dốc vai"], ["clavicle", "Xương quai xanh"]] },
    { id: "arms", label: "Tay", focus: "upper", controls: [["armLength", "Chiều dài tay"], ["upperArm", "Bắp tay"], ["forearm", "Cẳng tay"], ["handSize", "Bàn tay"], ["fingerLength", "Ngón tay"], ["armLeft", "Tay trái"], ["armRight", "Tay phải"]] },
    { id: "legs", label: "Chân", focus: "lower", controls: [["legLength", "Chiều dài chân"], ["thighSize", "Đùi"], ["calfSize", "Bắp chân"], ["kneeSize", "Đầu gối"], ["footSize", "Bàn chân"], ["legLeft", "Chân trái"], ["legRight", "Chân phải"]] },
    { id: "torso", label: "Thân người", focus: "body", controls: [["height", "Chiều cao"], ["torsoLength", "Chiều dài thân"], ["backWidth", "Độ rộng lưng"], ["waist", "Vòng eo"], ["belly", "Bụng"], ["legTorsoRatio", "Tỷ lệ chân–thân"], ["ribcage", "Lồng ngực"], ["posture", "Tư thế"]] },
    { id: "chest", label: "Ngực", focus: "upper", controls: [["chestSize", "Kích thước"], ["chestWidth", "Độ rộng"], ["chestFullness", "Độ đầy"], ["chestPosition", "Vị trí"], ["chestSymmetry", "Độ cân đối"]] },
    { id: "hips", label: "Hông & mông", focus: "lower", controls: [["hipWidth", "Độ rộng hông"], ["gluteFullness", "Độ đầy"], ["gluteProjection", "Độ nhô"], ["waistHipRatio", "Tỷ lệ eo–hông"], ["hipTilt", "Độ nghiêng hông"]] },
    { id: "body", label: "Cơ thể", focus: "body", controls: [["muscle", "Lượng cơ"], ["bodyFat", "Lượng mỡ"], ["tone", "Độ săn chắc"], ["abs", "Cơ bụng"], ["bodyMass", "Khối lượng cơ thể"], ["softness", "Độ mềm mô"], ["weightDistribution", "Phân bố hình thể"]] },
    { id: "expression", label: "Biểu cảm", focus: "head", defaultValue: 0, controls: [["blink", "Chớp mắt"], ["smile", "Vui"], ["sad", "Buồn"], ["angry", "Tức giận"], ["surprised", "Bất ngờ"], ["pain", "Đau"], ["cheekPuff", "Má phồng"], ["squint", "Nheo mắt"], ["mouthA", "Âm A"], ["mouthO", "Âm O"]] }
  ]);
  const APPEARANCE_CONTROL_MAP = Object.freeze(Object.fromEntries(
    APPEARANCE_GROUPS.flatMap((group) => group.controls.map(([id, label]) => [id, { id, label, group: group.id, defaultValue: group.defaultValue ?? 0.5 }]))
  ));
  const APPEARANCE_ASSETS = Object.freeze({
    baseModels: ["human-adult-a01", "human-adult-b01"],
    skins: ["warm-04", "neutral-03", "cool-02", "deep-05"],
    hairs: ["astral-layered-07", "aurora-short-02", "void-long-04", "solar-braid-03"],
    outfits: ["central-jacket-02", "combat-boots-01", "aurora-suit-01", "void-coat-01"]
  });
  const APPEARANCE_PRESETS = Object.freeze({
    balanced: { label: "Cân bằng", bodyPreset: "balanced", morphs: {} },
    athletic: { label: "Thể thao", bodyPreset: "athletic", morphs: { shoulderWidth: 0.62, upperArm: 0.61, thighSize: 0.6, calfSize: 0.58, muscle: 0.68, tone: 0.72, bodyFat: 0.36, abs: 0.64 } },
    soft: { label: "Mềm mại", bodyPreset: "soft", morphs: { cheekFullness: 0.62, faceFullness: 0.58, shoulderWidth: 0.45, waist: 0.47, chestFullness: 0.61, hipWidth: 0.6, gluteFullness: 0.62, softness: 0.7, muscle: 0.38 } },
    heroic: { label: "Anh hùng", bodyPreset: "heroic", morphs: { height: 0.67, jawWidth: 0.58, shoulderWidth: 0.7, chestWidth: 0.65, chestSize: 0.6, backWidth: 0.64, muscle: 0.72, posture: 0.7 } },
    agile: { label: "Nhanh nhẹn", bodyPreset: "agile", morphs: { height: 0.54, shoulderWidth: 0.48, armLength: 0.58, legLength: 0.66, waist: 0.43, bodyMass: 0.38, muscle: 0.54, tone: 0.66 } }
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

  function defaultAppearanceRecipe(characterId = "lyra") {
    const profile = CHARACTERS[characterId] || CHARACTERS.lyra;
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: "human-adult-a01",
      bodyPreset: "balanced",
      style: "anime-realistic",
      symmetry: true,
      advanced: false,
      morphs: Object.fromEntries(Object.values(APPEARANCE_CONTROL_MAP).map((control) => [control.id, control.defaultValue])),
      skin: "warm-04",
      skinColor: "#ffd5c5",
      eyeColor: profile.eyes,
      hair: "astral-layered-07",
      hairColor: profile.hair,
      outfit: ["central-jacket-02", "combat-boots-01"],
      decals: { freckles: 0, scars: 0, moles: 0, makeup: 0, tattoos: 0 },
      updatedAt: nowIso()
    };
  }

  function normalizeAppearanceRecipe(input, characterId = "lyra") {
    const base = defaultAppearanceRecipe(characterId);
    const recipe = input && typeof input === "object" ? input : {};
    const morphs = Object.fromEntries(Object.values(APPEARANCE_CONTROL_MAP).map((control) => [
      control.id,
      Number.isFinite(Number(recipe.morphs?.[control.id])) ? clamp(recipe.morphs[control.id], 0, 1) : control.defaultValue
    ]));
    const validHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
    return {
      ...base,
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: APPEARANCE_ASSETS.baseModels.includes(recipe.baseModel) ? recipe.baseModel : base.baseModel,
      bodyPreset: APPEARANCE_PRESETS[recipe.bodyPreset] ? recipe.bodyPreset : base.bodyPreset,
      style: ["human-cinematic", "anime-realistic"].includes(recipe.style) ? recipe.style : base.style,
      symmetry: recipe.symmetry !== false,
      advanced: recipe.advanced === true,
      morphs,
      skin: APPEARANCE_ASSETS.skins.includes(recipe.skin) ? recipe.skin : base.skin,
      skinColor: validHex(recipe.skinColor, base.skinColor),
      eyeColor: validHex(recipe.eyeColor, base.eyeColor),
      hair: APPEARANCE_ASSETS.hairs.includes(recipe.hair) ? recipe.hair : base.hair,
      hairColor: validHex(recipe.hairColor, base.hairColor),
      outfit: Array.isArray(recipe.outfit)
        ? [...new Set(recipe.outfit.filter((id) => APPEARANCE_ASSETS.outfits.includes(id)))].slice(0, 4)
        : base.outfit,
      decals: Object.fromEntries(Object.keys(base.decals).map((id) => [
        id,
        Number.isFinite(Number(recipe.decals?.[id])) ? clamp(recipe.decals[id], 0, 1) : base.decals[id]
      ])),
      updatedAt: typeof recipe.updatedAt === "string" ? recipe.updatedAt.slice(0, 40) : nowIso()
    };
  }

  function compactAppearanceRecipe(recipe, characterId = "lyra") {
    const normalized = normalizeAppearanceRecipe(recipe, characterId);
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: normalized.baseModel,
      bodyPreset: normalized.bodyPreset,
      style: normalized.style,
      symmetry: normalized.symmetry,
      morphs: Object.fromEntries(Object.entries(normalized.morphs).map(([id, value]) => [id, Number(value.toFixed(3))])),
      skin: normalized.skin,
      skinColor: normalized.skinColor,
      eyeColor: normalized.eyeColor,
      hair: normalized.hair,
      hairColor: normalized.hairColor,
      outfit: normalized.outfit.slice(0, 4),
      decals: Object.fromEntries(Object.entries(normalized.decals).map(([id, value]) => [id, Number(value.toFixed(3))]))
    };
  }

  function appearanceFingerprint(recipe, characterId = "lyra") {
    return JSON.stringify(compactAppearanceRecipe(recipe, characterId));
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
      roster: {
        activeId: "lyra",
        unlocked: [...CHARACTER_ORDER],
        members: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
          level: 1,
          health: 100,
          maxHealth: 100,
          ultimate: 0
        }]))
      },
      appearance: {
        recipes: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, defaultAppearanceRecipe(id)])),
        savedPresets: [],
        lastSavedAt: ""
      },
      inventory: {
        "starter-blade": { quantity: 1, favorite: true, locked: true, acquiredAt: nowIso() }
      },
      quests: defaultQuestState(),
      checkpoints: { central: true, aurora: false, crimson: false, void: false },
      activatedGates: [],
      collectedNodes: [],
      puzzles: {},
      defeated: {},
      skills: { plasmaDrive: 0, astralGuard: 0, staminaCore: 0 },
      settings: {
        quality: "auto",
        renderStyle: "realistic",
        rendererMode: "auto",
        dynamicResolution: true,
        shadows: "high",
        postFx: true,
        weatherDensity: 80,
        cameraShake: 65,
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
      roster: {
        ...base.roster,
        ...(input.roster || {}),
        members: { ...base.roster.members, ...(input.roster?.members || {}) }
      },
      appearance: {
        recipes: Object.fromEntries(CHARACTER_ORDER.map((id) => [
          id,
          normalizeAppearanceRecipe(input.appearance?.recipes?.[id], id)
        ])),
        savedPresets: Array.isArray(input.appearance?.savedPresets)
          ? input.appearance.savedPresets.slice(-12).map((preset) => ({
            id: String(preset?.id || uid("look")).slice(0, 80),
            name: String(preset?.name || "Ngoại hình").slice(0, 40),
            characterId: CHARACTERS[preset?.characterId] ? preset.characterId : "lyra",
            recipe: normalizeAppearanceRecipe(preset?.recipe, preset?.characterId),
            createdAt: String(preset?.createdAt || nowIso()).slice(0, 40)
          }))
          : [],
        lastSavedAt: String(input.appearance?.lastSavedAt || "").slice(0, 40)
      },
      inventory: input.inventory && typeof input.inventory === "object" ? input.inventory : base.inventory,
      quests: { ...base.quests, ...(input.quests || {}) },
      checkpoints: { ...base.checkpoints, ...(input.checkpoints || {}) },
      puzzles: input.puzzles && typeof input.puzzles === "object" ? input.puzzles : base.puzzles,
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
    if (!["auto", "low", "medium", "high", "cinematic"].includes(state.settings.quality)) state.settings.quality = "auto";
    if (!["realistic", "cinematic", "anime"].includes(state.settings.renderStyle)) state.settings.renderStyle = "realistic";
    if (!["auto", "webgpu", "webgl"].includes(state.settings.rendererMode)) state.settings.rendererMode = "auto";
    state.settings.dynamicResolution = state.settings.dynamicResolution !== false;
    state.settings.weatherDensity = clamp(state.settings.weatherDensity, 0, 100);
    state.settings.cameraShake = clamp(state.settings.cameraShake, 0, 100);
    if (!CHARACTERS[state.roster.activeId]) state.roster.activeId = "lyra";
    state.roster.unlocked = Array.isArray(state.roster.unlocked)
      ? state.roster.unlocked.filter((id) => CHARACTERS[id]).slice(0, CHARACTER_ORDER.length)
      : [...CHARACTER_ORDER];
    if (!state.roster.unlocked.length) state.roster.unlocked = ["lyra"];
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
      this.rendererBackend = "webgl2";
      this.webgpuAvailable = Boolean(root.navigator?.gpu);
      this.clock = null;
      this.playerMesh = null;
      this.playerShadow = null;
      this.characterMeshes = new Map();
      this.toonGradient = null;
      this.activeAnimation = "idle";
      this.animationBlend = 0;
      this.characterSwitchAt = 0;
      this.entities = new Map();
      this.enemies = new Map();
      this.collectibles = new Map();
      this.npcs = new Map();
      this.portals = new Map();
      this.remotePlayers = new Map();
      this.effects = [];
      this.environmentActors = [];
      this.streamingGroups = new Map();
      this.puzzleNodes = new Map();
      this.cloudLayers = [];
      this.waterSurfaces = [];
      this.climbables = [];
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
      this.hitStopUntil = 0;
      this.invulnerableUntil = 0;
      this.combo = 0;
      this.comboUntil = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.gliding = false;
      this.isSwimming = false;
      this.isClimbing = false;
      this.cameraYaw = 0;
      this.cameraPitch = 0.58;
      this.cameraDistance = 12;
      this.cameraShake = 0;
      this.cameraFovTarget = 58;
      this.cinematicTarget = null;
      this.photoMode = false;
      this.photoSettings = { fov: 48, exposure: 1.08, time: 8.2, weather: "auto", hideUi: true };
      this.draggingCamera = false;
      this.pointerStart = null;
      this.lockedTargetId = "";
      this.nearby = null;
      this.currentZone = ZONES[0];
      this.currentPanel = "";
      this.appearanceGroup = "face";
      this.appearanceHistory = [];
      this.appearanceFuture = [];
      this.appearanceCompareRecipe = null;
      this.appearanceDirty = true;
      this.appearanceFocus = "";
      this.toastTimer = 0;
      this.frameHandle = 0;
      this.autosaveTimer = 0;
      this.fpsFrames = 0;
      this.fpsStartedAt = performance.now();
      this.fps = 0;
      this.renderScale = 1;
      this.dynamicResolution = 1;
      this.lastStreamingAt = 0;
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
            <div class="har-postfx" aria-hidden="true"></div>
            <div class="har-crosshair" aria-hidden="true"></div>
          </div>

          <div class="har-topbar">
            <div class="har-brand">
              <div class="har-brand__core" aria-hidden="true">H</div>
              <div class="har-brand__copy"><strong>HH Astral Realms</strong><span>Anime Open World · Visual V2</span></div>
            </div>
            <div class="har-live-orbit" aria-label="Trạng thái game realtime">
              <div class="har-signal" data-tone="cyan"><small>Khu vực</small><strong data-har-zone>H-Central</strong></div>
              <div class="har-signal" data-tone="amber"><small>Thời gian</small><strong data-har-time>08:12</strong></div>
              <div class="har-signal" data-tone="pink"><small>Thời tiết</small><strong data-har-weather>Trời quang</strong></div>
              <div class="har-signal" data-tone="lime"><small>Engine</small><strong data-har-fps>Chưa chạy</strong></div>
              <div class="har-signal" data-tone="violet"><small>Renderer</small><strong data-har-renderer>Đang dò GPU</strong></div>
              <div class="har-signal" data-tone="cyan"><small>Máy chủ</small><strong data-har-server>LOCAL</strong></div>
            </div>
            <div class="har-top-actions">
              <button class="har-icon-button" type="button" data-har-panel="map" aria-label="Mở bản đồ">◇</button>
              <button class="har-icon-button" type="button" data-har-photo aria-label="Mở Photo Mode">◉</button>
              <button class="har-icon-button" type="button" data-har-panel="party" aria-label="Mở tổ đội">◎</button>
              <button class="har-icon-button" type="button" data-har-fullscreen aria-label="Toàn màn hình">⛶</button>
              <button class="har-icon-button" type="button" data-har-pause aria-label="Tạm dừng">Ⅱ</button>
            </div>
          </div>

          <div class="har-team" aria-label="Đội hình">
            ${CHARACTER_ORDER.map((id, index) => {
              const profile = CHARACTERS[id];
              return `<button class="har-team-slot ${index === 0 ? "is-active" : ""}" type="button" data-team-slot="${index + 1}" data-character="${id}" aria-label="Đổi sang ${profile.name}" style="--character-color:${profile.accent}"><strong>${profile.short}</strong><span>${profile.name}</span><small>${ELEMENTS[profile.element].label}</small></button>`;
            }).join("")}
            <button class="har-team-preview" type="button" data-har-panel="characters">Hồ sơ đội</button>
          </div>
          <div class="har-dps" data-har-dps>Training DPS · 0</div>

          <div class="har-minimap-wrap">
            <canvas width="276" height="276" data-har-minimap aria-label="Radar thiên hà"></canvas>
            <div class="har-minimap-label" data-har-minimap-label>H-Central</div>
          </div>

          <div class="har-boss" data-har-boss hidden>
            <div><strong data-har-boss-name>Nexus Warden</strong><small data-har-boss-phase>PHASE I · Astral Shell</small></div>
            <div class="har-meter har-meter--boss"><i data-har-boss-meter></i></div>
          </div>

          <section class="har-photo" data-har-photo-ui hidden aria-label="Photo Mode">
            <header><div><small>ASTRAL LENS</small><strong>Photo Mode</strong></div><button type="button" data-photo-action="close" aria-label="Đóng Photo Mode">×</button></header>
            <label>Góc nhìn <input type="range" min="28" max="80" value="48" data-photo-setting="fov"></label>
            <label>Phơi sáng <input type="range" min="65" max="150" value="108" data-photo-setting="exposure"></label>
            <label>Thời gian <input type="range" min="0" max="24" step="0.1" value="8.2" data-photo-setting="time"></label>
            <label>Thời tiết <select data-photo-setting="weather"><option value="auto">Theo khu vực</option><option value="clear">Trời quang</option><option value="aurora">Cực quang</option><option value="storm">Bão tinh thể</option><option value="embers">Tro plasma</option></select></label>
            <div class="har-photo__actions"><button type="button" data-photo-action="toggle-ui">Ẩn/hiện HUD</button><button class="is-primary" type="button" data-photo-action="capture">Chụp PNG</button></div>
          </section>

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
        if (!this.supportsRenderer()) throw new Error("Trình duyệt không hỗ trợ WebGL hoặc WebGPU. Hãy bật tăng tốc phần cứng hoặc dùng trình duyệt mới hơn.");
        this.setLoading(28, "Đang chọn WebGPU hoặc WebGL2 phù hợp với thiết bị...");
        const wantsWebGPU = this.state.settings.rendererMode !== "webgl"
          && this.webgpuAvailable
          && this.state.settings.quality !== "low";
        if (wantsWebGPU) {
          try {
            this.THREE = await import("./vendor/three.webgpu.min.js");
            this.rendererBackend = "webgpu";
          } catch {
            this.THREE = await import("./vendor/three.module.min.js");
            this.rendererBackend = "webgl2";
          }
        } else {
          this.THREE = await import("./vendor/three.module.min.js");
          this.rendererBackend = "webgl2";
        }
        if (this.destroyed) return;
        this.setLoading(44, `Đang khởi tạo ${this.rendererBackend.toUpperCase()} và toon pipeline...`);
        await this.setupRenderer();
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

    supportsRenderer() {
      try {
        const probe = document.createElement("canvas");
        return Boolean(root.navigator?.gpu || probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) || probe.getContext("webgl"));
      } catch {
        return false;
      }
    }

    async setupRenderer() {
      let THREE = this.THREE;
      const canvas = this.root.querySelector("[data-har-world]");
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x050816);
      this.scene.fog = new THREE.FogExp2(0x071023, 0.0095);
      this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
      this.camera.position.set(0, 10, 14);
      const quality = this.state.settings.quality;
      try {
        if (this.rendererBackend === "webgpu" && THREE.WebGPURenderer) {
          this.renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: !["low"].includes(quality),
            powerPreference: "high-performance",
            alpha: false
          });
          await this.renderer.init();
        } else {
          this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !["low"].includes(quality),
            powerPreference: "high-performance",
            alpha: false
          });
        }
      } catch (error) {
        if (this.rendererBackend !== "webgpu") throw error;
        this.THREE = await import("./vendor/three.module.min.js");
        THREE = this.THREE;
        this.rendererBackend = "webgl2";
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050816);
        this.scene.fog = new THREE.FogExp2(0x071023, 0.0095);
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
        this.camera.position.set(0, 10, 14);
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: !["low"].includes(quality),
          powerPreference: "high-performance",
          alpha: false
        });
      }
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = quality === "cinematic" ? 1.18 : 1.04;
      if ("physicallyCorrectLights" in this.renderer) this.renderer.physicallyCorrectLights = true;
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = quality !== "low";
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
      }
      this.root.dataset.renderer = this.rendererBackend;
      const rendererLabel = this.root.querySelector("[data-har-renderer]");
      if (rendererLabel) rendererLabel.textContent = this.rendererBackend === "webgpu" ? "WEBGPU · TSL" : "WEBGL2 · FALLBACK";
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
      sun.castShadow = Boolean(this.renderer.shadowMap?.enabled);
      const shadowSize = quality === "cinematic" ? 2048 : quality === "high" ? 1536 : quality === "medium" ? 1024 : 768;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
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

      const fill = new THREE.DirectionalLight(0x9bbdff, 0.55);
      fill.position.set(28, 18, -34);
      this.scene.add(fill);
      this.fillLight = fill;
      const rim = new THREE.DirectionalLight(0xff74c8, 0.72);
      rim.position.set(-18, 15, -42);
      this.scene.add(rim);
      this.rimLight = rim;

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(112, 96),
        new THREE.MeshPhysicalMaterial({
          color: 0x091124,
          roughness: 0.88,
          metalness: 0.12,
          clearcoat: 0.18,
          clearcoatRoughness: 0.55
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.name = "AstralGround";
      this.world.add(ground);

      this.createToonGradient();
      this.createAtmosphere();
      this.createStarfield();
      this.createZonePlatforms();
      this.createCentralCity();
      this.createAuroraVale();
      this.createCrimsonForge();
      this.createVoidGarden();
      this.createDungeon();
      this.createWater();
      this.createInstancedNature();
      this.createElementalPuzzles();
      this.createWeatherField();
    }

    createToonGradient() {
      const THREE = this.THREE;
      const data = new Uint8Array([
        28, 28, 34, 255,
        92, 96, 118, 255,
        178, 188, 215, 255,
        255, 255, 255, 255
      ]);
      const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      this.toonGradient = texture;
    }

    createAtmosphere() {
      const THREE = this.THREE;
      const skyGeometry = new THREE.SphereGeometry(280, 40, 24);
      const skyPositions = skyGeometry.attributes.position;
      const skyColors = new Float32Array(skyPositions.count * 3);
      const horizon = new THREE.Color(0x33205c);
      const zenith = new THREE.Color(0x061027);
      const lower = new THREE.Color(0x12091f);
      for (let index = 0; index < skyPositions.count; index += 1) {
        const y = skyPositions.getY(index) / 280;
        const color = y >= 0
          ? horizon.clone().lerp(zenith, clamp(y, 0, 1))
          : horizon.clone().lerp(lower, clamp(-y, 0, 1));
        skyColors[index * 3] = color.r;
        skyColors[index * 3 + 1] = color.g;
        skyColors[index * 3 + 2] = color.b;
      }
      skyGeometry.setAttribute("color", new THREE.BufferAttribute(skyColors, 3));
      this.skyDome = new THREE.Mesh(
        skyGeometry,
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
      );
      this.scene.add(this.skyDome);

      this.sunDisc = new THREE.Mesh(
        new THREE.SphereGeometry(5.2, 28, 20),
        new THREE.MeshBasicMaterial({ color: 0xffdf8b, fog: false })
      );
      this.scene.add(this.sunDisc);
      this.moonDisc = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.8, fog: false })
      );
      this.scene.add(this.moonDisc);

      const cloudMaterial = new THREE.MeshToonMaterial({
        color: 0x9e95d5,
        gradientMap: this.toonGradient,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      });
      const cloudCount = this.state.settings.reduceEffects ? 7 : 16;
      for (let index = 0; index < cloudCount; index += 1) {
        const cloud = new THREE.Group();
        const puffs = 3 + (index % 3);
        for (let part = 0; part < puffs; part += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(2.6 + (part % 2) * 1.4, 12, 8),
            cloudMaterial
          );
          puff.position.set(part * 3.2 - puffs * 1.2, Math.sin(part) * 0.8, Math.cos(part) * 1.2);
          puff.scale.y = 0.42;
          cloud.add(puff);
        }
        const angle = (index / cloudCount) * Math.PI * 2;
        const radius = 55 + (index % 4) * 18;
        cloud.position.set(Math.cos(angle) * radius, 22 + (index % 5) * 4.2, Math.sin(angle) * radius);
        cloud.userData = { atmosphere: "cloud", drift: 0.25 + (index % 4) * 0.08 };
        this.scene.add(cloud);
        this.cloudLayers.push(cloud);
      }

      this.auroraVeil = new THREE.Mesh(
        new THREE.TorusGeometry(76, 1.2, 8, 128),
        new THREE.MeshBasicMaterial({
          color: 0x63f6d2,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false
        })
      );
      this.auroraVeil.rotation.x = Math.PI / 2.8;
      this.auroraVeil.position.set(-35, 48, 18);
      this.scene.add(this.auroraVeil);
    }

    createWater() {
      const THREE = this.THREE;
      const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x3fdacb,
        emissive: 0x0c6d75,
        emissiveIntensity: 0.2,
        roughness: 0.18,
        metalness: 0.06,
        transparent: true,
        opacity: 0.72,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        side: THREE.DoubleSide
      });
      const auroraLake = new THREE.Mesh(new THREE.CircleGeometry(13.5, 72), waterMaterial);
      auroraLake.rotation.x = -Math.PI / 2;
      auroraLake.position.set(-51, 1.12, 20);
      auroraLake.receiveShadow = true;
      auroraLake.userData = { water: true, baseY: 1.12, zoneId: "aurora" };
      this.world.add(auroraLake);
      this.waterSurfaces.push(auroraLake);

      const forgeLava = new THREE.Mesh(
        new THREE.CircleGeometry(8.2, 64),
        new THREE.MeshToonMaterial({
          color: 0xff5b2e,
          emissive: 0xff321a,
          emissiveIntensity: 1.35,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.86
        })
      );
      forgeLava.rotation.x = -Math.PI / 2;
      forgeLava.position.set(52, 1.13, 24);
      forgeLava.userData = { water: true, baseY: 1.13, zoneId: "crimson", lava: true };
      this.world.add(forgeLava);
      this.waterSurfaces.push(forgeLava);
    }

    createInstancedNature() {
      const THREE = this.THREE;
      const quality = this.state.settings.quality;
      const density = quality === "low" ? 0.35 : quality === "medium" ? 0.62 : quality === "cinematic" ? 1.25 : 1;
      const seeded = (index, salt = 0) => {
        const value = Math.sin(index * 91.733 + salt * 17.17) * 43758.5453;
        return value - Math.floor(value);
      };
      const makeGroup = (zoneId) => {
        const group = new THREE.Group();
        group.name = `Stream:${zoneId}`;
        group.userData.zoneId = zoneId;
        this.world.add(group);
        this.streamingGroups.set(zoneId, group);
        return group;
      };

      const auroraGroup = makeGroup("aurora");
      const grassCount = Math.max(40, Math.round(240 * density));
      const grass = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.075, 0.82, 3),
        new THREE.MeshToonMaterial({ color: 0x4ce0a5, gradientMap: this.toonGradient, roughness: 0.88 }),
        grassCount
      );
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < grassCount; index += 1) {
        const angle = seeded(index, 1) * Math.PI * 2;
        const radius = 14 + seeded(index, 2) * 15;
        const scale = 0.7 + seeded(index, 3) * 1.1;
        matrix.compose(
          new THREE.Vector3(-51 + Math.cos(angle) * radius, 1.42, 20 + Math.sin(angle) * radius),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), seeded(index, 4) * Math.PI),
          new THREE.Vector3(scale, scale, scale)
        );
        grass.setMatrixAt(index, matrix);
      }
      grass.instanceMatrix.needsUpdate = true;
      grass.castShadow = quality === "cinematic";
      auroraGroup.add(grass);

      const rockProfiles = [
        ["central", 0, 0, 54, 0x33546d],
        ["aurora", -51, 20, 46, 0x267764],
        ["crimson", 52, 24, 48, 0x6d3128],
        ["void", 2, -62, 52, 0x4f2c76]
      ];
      rockProfiles.forEach(([zoneId, centerX, centerZ, baseCount, color], profileIndex) => {
        const group = this.streamingGroups.get(zoneId) || makeGroup(zoneId);
        const count = Math.max(14, Math.round(baseCount * density));
        const rocks = new THREE.InstancedMesh(
          new THREE.IcosahedronGeometry(0.72, 0),
          new THREE.MeshToonMaterial({ color, gradientMap: this.toonGradient, roughness: 0.92 }),
          count
        );
        for (let index = 0; index < count; index += 1) {
          const angle = seeded(index, profileIndex + 7) * Math.PI * 2;
          const radius = 7 + seeded(index, profileIndex + 11) * 21;
          const sx = 0.45 + seeded(index, 15) * 1.6;
          matrix.compose(
            new THREE.Vector3(centerX + Math.cos(angle) * radius, 1.18 + sx * 0.18, centerZ + Math.sin(angle) * radius),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(seeded(index, 18), seeded(index, 19) * Math.PI, seeded(index, 20))),
            new THREE.Vector3(sx, sx * (0.7 + seeded(index, 21)), sx)
          );
          rocks.setMatrixAt(index, matrix);
        }
        rocks.instanceMatrix.needsUpdate = true;
        rocks.castShadow = quality === "high" || quality === "cinematic";
        rocks.receiveShadow = true;
        group.add(rocks);
      });
    }

    createElementalPuzzles() {
      const puzzles = [
        ["aurora-resonance", "Aurora Resonance", -64, 20, "cryo", "#77d9ff"],
        ["forge-ignition", "Forge Ignition", 57, 35, "plasma", "#ff765d"],
        ["void-lattice", "Void Lattice", -4, -73, "void", "#b17aff"]
      ];
      puzzles.forEach(([id, name, x, z, requiredElement, color]) => {
        const THREE = this.THREE;
        const group = new THREE.Group();
        const solved = Boolean(this.state.puzzles[id]?.solved);
        for (let index = 0; index < 3; index += 1) {
          const angle = (index / 3) * Math.PI * 2;
          const pylon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.52, 2.8, 6),
            new THREE.MeshToonMaterial({
              color: solved ? color : 0x243047,
              emissive: color,
              emissiveIntensity: solved ? 0.85 : 0.16,
              gradientMap: this.toonGradient
            })
          );
          pylon.position.set(Math.cos(angle) * 1.8, 1.4, Math.sin(angle) * 1.8);
          group.add(pylon);
        }
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.72, 1),
          new THREE.MeshToonMaterial({
            color,
            emissive: color,
            emissiveIntensity: solved ? 1.4 : 0.36,
            gradientMap: this.toonGradient
          })
        );
        core.position.y = 1.8;
        core.userData.weakPoint = true;
        group.add(core);
        group.position.set(x, 1.08, z);
        group.userData = { type: "puzzle", id, name, requiredElement, color, solved, core };
        this.world.add(group);
        this.puzzleNodes.set(id, group);
      });
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
        this.climbables.push({ object: tower, radius: 2.6, top: 1 + height });
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
        this.climbables.push({ object: tree, radius: 0.9, top: 1.05 + height + 1.2 });
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
      const qualityMultiplier = this.state.settings.quality === "low" ? 0.45 : this.state.settings.quality === "medium" ? 0.72 : this.state.settings.quality === "cinematic" ? 1.45 : 1;
      const count = Math.max(24, Math.round((this.state.settings.reduceEffects ? 60 : 180) * qualityMultiplier * clamp(this.state.settings.weatherDensity, 0, 100) / 80));
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

    createAnimeCharacterMesh(profile, scale = 1) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      group.name = `Character:${profile.id}`;
      group.scale.setScalar(scale);
      const realistic = this.state.settings.renderStyle !== "anime";

      const toon = (color, options = {}) => {
        const material = new THREE.MeshToonMaterial({
        color,
        gradientMap: this.toonGradient,
        emissive: options.emissive || 0x000000,
        emissiveIntensity: options.emissiveIntensity || 0,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1
        });
        material.userData.astralSurface = true;
        return material;
      };
      const surface = (color, options = {}) => {
        if (!realistic) return toon(color, options);
        const Physical = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
        const material = new Physical({
          color,
          roughness: options.roughness ?? 0.44,
          metalness: options.metalness ?? 0.08,
          clearcoat: options.clearcoat ?? 0.22,
          clearcoatRoughness: options.clearcoatRoughness ?? 0.32,
          sheen: options.sheen ?? 0.16,
          emissive: options.emissive || 0x000000,
          emissiveIntensity: options.emissiveIntensity || 0,
          transparent: Boolean(options.transparent),
          opacity: options.opacity ?? 1,
          side: options.side
        });
        material.userData.astralSurface = true;
        return material;
      };
      const skinMaterial = surface(0xffd5c5, { roughness: 0.58, sheen: 0.42 });
      const bodyMaterial = surface(profile.body, { emissive: profile.body, emissiveIntensity: 0.06, roughness: 0.36, clearcoat: 0.42 });
      const accentMaterial = surface(profile.accent, { emissive: profile.accent, emissiveIntensity: 0.24, roughness: 0.25, clearcoat: 0.62 });
      const hairMaterial = surface(profile.hair, { emissive: profile.accent, emissiveIntensity: 0.035, roughness: 0.3, clearcoat: 0.48, sheen: 0.52 });
      const darkMaterial = surface(0x16162c, { roughness: 0.5, metalness: 0.22 });
      skinMaterial.userData.materialRole = "skin";
      hairMaterial.userData.materialRole = "hair";
      const outlineMaterial = realistic
        ? new THREE.MeshBasicMaterial({ color: 0x100d20, transparent: true, opacity: 0, depthWrite: false })
        : new THREE.MeshBasicMaterial({ color: 0x100d20, side: THREE.BackSide });
      outlineMaterial.userData.astralOutline = true;

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.92, 8, 14), bodyMaterial);
      torso.position.y = 1.45;
      torso.scale.set(0.95, 1, 0.68);
      torso.castShadow = true;
      group.add(torso);
      const torsoOutline = new THREE.Mesh(torso.geometry, outlineMaterial);
      torsoOutline.position.copy(torso.position);
      torsoOutline.scale.copy(torso.scale).multiplyScalar(1.045);
      group.add(torsoOutline);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), skinMaterial);
      head.position.y = 2.52;
      head.scale.set(0.92, 1.08, 0.9);
      head.castShadow = true;
      group.add(head);
      const headOutline = new THREE.Mesh(head.geometry, outlineMaterial);
      headOutline.position.copy(head.position);
      headOutline.scale.copy(head.scale).multiplyScalar(1.045);
      group.add(headOutline);

      const faceShadow = new THREE.Mesh(
        new THREE.SphereGeometry(0.405, 20, 14, 0, Math.PI, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xb86f86, transparent: true, opacity: 0.12, depthWrite: false })
      );
      faceShadow.position.set(0.04, 2.49, -0.07);
      faceShadow.rotation.y = Math.PI;
      faceShadow.scale.set(0.92, 1.05, 0.9);
      group.add(faceShadow);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.38, 14), skinMaterial);
      neck.position.set(0, 2.08, 0);
      neck.castShadow = true;
      group.add(neck);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 12), skinMaterial);
      nose.position.set(0, 2.43, -0.43);
      nose.rotation.x = -Math.PI / 2;
      nose.scale.set(0.72, 1, 0.78);
      group.add(nose);
      const mouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 14, 8),
        surface(0xb94f68, { roughness: 0.34, clearcoat: 0.2 })
      );
      mouth.position.set(0, 2.29, -0.405);
      mouth.scale.set(1, 0.22, 0.25);
      group.add(mouth);
      const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 9), skinMaterial);
      const rightEar = leftEar.clone();
      leftEar.position.set(-0.415, 2.51, 0);
      rightEar.position.set(0.415, 2.51, 0);
      leftEar.scale.set(0.42, 1, 0.55);
      rightEar.scale.copy(leftEar.scale);
      group.add(leftEar, rightEar);

      const eyeMaterial = surface(profile.eyes, {
        roughness: 0.08,
        metalness: 0.14,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        emissive: profile.eyes,
        emissiveIntensity: realistic ? 0.18 : 0.08
      });
      const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
      const eyes = [];
      [-0.15, 0.15].forEach((x) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), eyeMaterial);
        eye.position.set(x, 2.56, -0.385);
        eye.scale.set(0.72, 1.15, 0.36);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), eyeGlow);
        shine.position.set(-0.012, 0.018, -0.05);
        eye.add(shine);
        group.add(eye);
        eyes.push(eye);
      });
      eyeMaterial.userData.materialRole = "eyes";
      const browMaterial = surface(profile.hair, { roughness: 0.42 });
      browMaterial.userData.materialRole = "hair";
      const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), browMaterial);
      const rightBrow = leftBrow.clone();
      leftBrow.position.set(-0.15, 2.68, -0.397);
      rightBrow.position.set(0.15, 2.68, -0.397);
      leftBrow.rotation.z = -0.08;
      rightBrow.rotation.z = 0.08;
      group.add(leftBrow, rightBrow);

      const hair = new THREE.Group();
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.455, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMaterial);
      hairCap.scale.set(1.02, 1.08, 1.04);
      hair.add(hairCap);
      for (let index = 0; index < (realistic ? 11 : 7); index += 1) {
        const lock = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.82 + (index % 3) * 0.18, realistic ? 8 : 5), hairMaterial);
        const angle = ((index - 3) / 7) * Math.PI * 1.25;
        lock.position.set(Math.sin(angle) * 0.36, -0.22 - (index % 2) * 0.08, Math.cos(angle) * 0.32);
        lock.rotation.z = Math.sin(angle) * 0.18;
        lock.userData.secondaryMotion = 0.035 + (index % 3) * 0.012;
        hair.add(lock);
      }
      hair.position.set(0, 2.67, 0.02);
      group.add(hair);

      const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.74, 5, 8), bodyMaterial);
      const rightArm = leftArm.clone();
      leftArm.position.set(-0.55, 1.48, 0);
      rightArm.position.set(0.55, 1.48, 0);
      leftArm.rotation.z = -0.06;
      rightArm.rotation.z = 0.06;
      group.add(leftArm, rightArm);
      const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 9), skinMaterial);
      const rightHand = leftHand.clone();
      leftHand.position.set(-0.55, 0.95, 0);
      rightHand.position.set(0.55, 0.95, 0);
      leftHand.scale.set(0.72, 1.18, 0.55);
      rightHand.scale.copy(leftHand.scale);
      group.add(leftHand, rightHand);

      const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.74, 5, 8), darkMaterial);
      const rightLeg = leftLeg.clone();
      leftLeg.position.set(-0.22, 0.46, 0);
      rightLeg.position.set(0.22, 0.46, 0);
      group.add(leftLeg, rightLeg);
      const leftFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.22, 5, 8), darkMaterial);
      const rightFoot = leftFoot.clone();
      leftFoot.position.set(-0.22, 0.02, -0.1);
      rightFoot.position.set(0.22, 0.02, -0.1);
      leftFoot.rotation.x = Math.PI / 2;
      rightFoot.rotation.x = Math.PI / 2;
      group.add(leftFoot, rightFoot);

      const coat = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.92, 8, 1, true), accentMaterial);
      coat.position.y = 1.05;
      coat.rotation.y = Math.PI / 8;
      group.add(coat);

      const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.2, 1, 3),
        toon(profile.accent, { transparent: true, opacity: 0.82, emissive: profile.accent, emissiveIntensity: 0.2 })
      );
      cape.position.set(0, 1.5, 0.34);
      cape.rotation.x = 0.12;
      group.add(cape);

      const wingMaterial = new THREE.MeshBasicMaterial({
        color: profile.accent,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.72), wingMaterial);
      const rightWing = leftWing.clone();
      leftWing.position.set(-0.8, 1.72, 0.34);
      rightWing.position.set(0.8, 1.72, 0.34);
      leftWing.rotation.set(-0.15, 0.28, -0.25);
      rightWing.rotation.set(-0.15, -0.28, 0.25);
      leftWing.visible = false;
      rightWing.visible = false;
      group.add(leftWing, rightWing);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), accentMaterial);
      halo.position.y = 2.98;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);

      const weaponAnchor = new THREE.Group();
      weaponAnchor.position.set(0.58, 1.45, 0);
      group.add(weaponAnchor);

      group.userData.parts = {
        leftLeg, rightLeg, leftArm, rightArm, torso, head, hair, cape, halo, eyes,
        faceShadow, weaponAnchor, leftWing, rightWing, neck, nose, mouth, leftEar, rightEar,
        leftBrow, rightBrow, leftHand, rightHand, leftFoot, rightFoot, coat
      };
      group.userData.characterId = profile.id;
      group.userData.renderStyle = this.state.settings.renderStyle;
      this.applyAppearanceToMesh(group, this.state.appearance?.recipes?.[profile.id] || defaultAppearanceRecipe(profile.id), profile.id);
      return group;
    }

    applyNamedMorphTargets(mesh, recipe) {
      const candidates = Object.values(APPEARANCE_CONTROL_MAP)
        .map((control) => ({
          ...control,
          value: recipe.morphs[control.id],
          delta: Math.abs(recipe.morphs[control.id] - control.defaultValue)
        }))
        .filter((control) => control.delta > 0.015)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 20);
      let supportedTargets = 0;
      mesh.traverse((object) => {
        const dictionary = object.morphTargetDictionary;
        const influences = object.morphTargetInfluences;
        if (!dictionary || !influences) return;
        Object.values(dictionary).forEach((index) => {
          if (Number.isInteger(index) && index < influences.length) influences[index] = 0;
        });
        candidates.forEach((control) => {
          const centered = control.value - control.defaultValue;
          const aliases = [
            [control.id, control.value],
            [`AR_${control.id}`, control.value],
            [`${control.id}Positive`, Math.max(0, centered * 2)],
            [`${control.id}Negative`, Math.max(0, -centered * 2)]
          ];
          aliases.forEach(([name, value]) => {
            const index = dictionary[name];
            if (!Number.isInteger(index) || index >= influences.length) return;
            influences[index] = clamp(value, 0, 1);
            supportedTargets += 1;
          });
        });
      });
      mesh.userData.activeMorphs = candidates.map((control) => control.id);
      return supportedTargets;
    }

    applyAppearanceToMesh(mesh, inputRecipe, characterId = "lyra") {
      if (!mesh?.userData?.parts) return;
      const recipe = normalizeAppearanceRecipe(inputRecipe, characterId);
      const parts = mesh.userData.parts;
      const morph = (id) => recipe.morphs[id] ?? APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5;
      const delta = (id) => morph(id) - (APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5);
      const symmetric = recipe.symmetry || !recipe.advanced;
      const side = (leftId, rightId, wanted) => {
        if (!symmetric) return morph(wanted === "left" ? leftId : rightId);
        return (morph(leftId) + morph(rightId)) / 2;
      };

      const torsoLift = delta("torsoLength") * 0.34 + delta("height") * 0.22;
      const legLift = delta("legLength") * 0.36 + delta("legTorsoRatio") * 0.2;
      const headLift = torsoLift + legLift;
      const shoulder = 0.55 + delta("shoulderWidth") * 0.32;
      const hip = 0.22 + delta("hipWidth") * 0.22;
      const bodyDepth = 0.68 + delta("belly") * 0.22 + delta("bodyMass") * 0.14;
      const torsoWidth = 0.95 + delta("backWidth") * 0.22 + delta("chestWidth") * 0.2 - delta("waist") * 0.08;
      const torsoHeight = 1 + delta("torsoLength") * 0.42 + delta("height") * 0.16;
      parts.torso.scale.set(torsoWidth, torsoHeight, bodyDepth);
      parts.torso.position.y = 1.45 + legLift * 0.72;
      parts.torso.rotation.x = delta("posture") * -0.08;

      const headWidth = 0.92 + delta("cheekboneWidth") * 0.17 + delta("jawWidth") * 0.13 + delta("faceFullness") * 0.12;
      const headHeight = 1.08 + delta("headLength") * 0.22 + delta("foreheadHeight") * 0.1 - delta("faceFullness") * 0.04;
      const headDepth = 0.9 + delta("cheekFullness") * 0.16 + delta("faceFullness") * 0.1;
      parts.head.scale.set(headWidth, headHeight, headDepth);
      parts.head.position.y = 2.52 + headLift;
      parts.faceShadow.position.y = 2.49 + headLift;
      parts.faceShadow.scale.set(headWidth, headHeight * 0.98, headDepth);

      parts.neck.position.y = 2.08 + legLift + torsoLift * 0.45;
      parts.neck.scale.set(
        1 + delta("neckWidth") * 0.5,
        1 + delta("neckLength") * 0.5,
        1 + delta("neckWidth") * 0.36
      );

      const eyeSpacing = 0.15 + delta("eyeSpacing") * 0.11;
      const eyeSize = 1 + delta("eyeSize") * 0.62;
      const eyeDepth = -0.385 - delta("eyeDepth") * 0.055;
      parts.eyes.forEach((eye, index) => {
        const eyeSide = index === 0 ? side("eyeLeft", "eyeRight", "left") : side("eyeLeft", "eyeRight", "right");
        eye.position.set(index === 0 ? -eyeSpacing : eyeSpacing, 2.56 + headLift, eyeDepth);
        eye.scale.set(0.72 * eyeSize * (0.88 + eyeSide * 0.24), 1.15 * eyeSize * (0.86 + morph("upperLid") * 0.16), 0.36);
        eye.userData.baseScaleY = eye.scale.y;
        eye.rotation.z = (index === 0 ? -1 : 1) * delta("eyeAngle") * 0.28;
      });
      const irisScale = 0.78 + morph("irisSize") * 0.34;
      parts.eyes.forEach((eye) => {
        eye.children.forEach((shine) => shine.scale.setScalar(0.7 + morph("eyeReflection") * 0.7));
        eye.scale.x *= irisScale;
      });

      parts.nose.position.set(0, 2.43 + headLift, -0.43 - delta("noseProjection") * 0.08);
      parts.nose.scale.set(
        0.58 + morph("noseWing") * 0.34,
        0.78 + morph("noseLength") * 0.42,
        0.62 + morph("noseTip") * 0.32
      );
      parts.mouth.position.set(0, 2.29 + headLift - delta("chinLength") * 0.035, -0.405 - delta("mouthProjection") * 0.04);
      parts.mouth.scale.set(
        0.62 + morph("mouthWidth") * 0.76,
        0.12 + (morph("upperLip") + morph("lowerLip")) * 0.15,
        0.22 + morph("mouthProjection") * 0.08
      );
      const earSize = 0.7 + morph("earSize") * 0.58;
      [["leftEar", -1, "left"], ["rightEar", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const ear = parts[partId];
        const perSide = side("earLeft", "earRight", wanted);
        ear.position.set(direction * (0.415 + delta("earProtrusion") * 0.08), 2.51 + headLift, 0);
        ear.scale.set(0.32 + morph("earProtrusion") * 0.2, earSize * (0.85 + perSide * 0.2), 0.44 + morph("earLobe") * 0.18);
        ear.rotation.z = direction * delta("earAngle") * 0.32;
      });
      parts.leftBrow.position.set(-eyeSpacing, 2.68 + headLift + delta("browHeight") * 0.08, -0.397);
      parts.rightBrow.position.set(eyeSpacing, 2.68 + headLift + delta("browHeight") * 0.08, -0.397);
      parts.leftBrow.scale.set(0.75 + morph("browShape") * 0.5, 0.55 + morph("browThickness"), 1);
      parts.rightBrow.scale.copy(parts.leftBrow.scale);
      parts.leftBrow.rotation.z = -0.08 - delta("browAngle") * 0.34;
      parts.rightBrow.rotation.z = 0.08 + delta("browAngle") * 0.34;

      const armLength = 1 + delta("armLength") * 0.45 + delta("height") * 0.08;
      [["leftArm", -1, "left"], ["rightArm", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const arm = parts[partId];
        const perSide = side("armLeft", "armRight", wanted);
        arm.position.set(direction * shoulder, 1.48 + legLift + torsoLift * 0.45, 0);
        arm.scale.set(0.78 + morph("upperArm") * 0.44, armLength * (0.9 + perSide * 0.2), 0.78 + morph("upperArm") * 0.36);
      });
      [["leftHand", -1, "left"], ["rightHand", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const hand = parts[partId];
        const perSide = side("armLeft", "armRight", wanted);
        hand.position.set(direction * shoulder, 0.95 + legLift + torsoLift * 0.2 - delta("armLength") * 0.22, 0);
        hand.scale.setScalar((0.72 + morph("handSize") * 0.38) * (0.9 + perSide * 0.18));
      });

      const legLength = 1 + delta("legLength") * 0.48 + delta("height") * 0.12 + delta("legTorsoRatio") * 0.18;
      [["leftLeg", -1, "left"], ["rightLeg", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const leg = parts[partId];
        const perSide = side("legLeft", "legRight", wanted);
        leg.position.set(direction * hip, 0.46 + legLift * 0.3, 0);
        leg.scale.set(0.78 + morph("thighSize") * 0.44, legLength * (0.9 + perSide * 0.2), 0.78 + morph("thighSize") * 0.38);
      });
      [["leftFoot", -1, "left"], ["rightFoot", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const foot = parts[partId];
        const perSide = side("legLeft", "legRight", wanted);
        foot.position.set(direction * hip, 0.02, -0.1 - delta("footSize") * 0.07);
        foot.scale.setScalar((0.76 + morph("footSize") * 0.42) * (0.9 + perSide * 0.16));
      });

      parts.coat.position.y = 1.05 + legLift * 0.72;
      parts.coat.scale.set(
        0.88 + morph("hipWidth") * 0.26 + morph("chestSize") * 0.1,
        0.92 + delta("torsoLength") * 0.2,
        0.86 + morph("gluteProjection") * 0.24 + morph("belly") * 0.12
      );
      parts.cape.position.y = 1.5 + legLift + torsoLift * 0.4;
      parts.hair.position.y = 2.67 + headLift;
      parts.hair.scale.set(headWidth, headHeight * 0.96, headDepth);
      parts.halo.position.y = 2.98 + headLift;
      parts.weaponAnchor.position.set(shoulder + 0.03, 1.45 + legLift + torsoLift * 0.42, 0);

      mesh.traverse((object) => {
        const material = object.material;
        if (!material?.color) return;
        if (material.userData?.materialRole === "skin") material.color.set(recipe.skinColor);
        if (material.userData?.materialRole === "hair") material.color.set(recipe.hairColor);
        if (material.userData?.materialRole === "eyes") {
          material.color.set(recipe.eyeColor);
          if ("clearcoat" in material) material.clearcoat = 0.55 + morph("eyeReflection") * 0.45;
        }
      });

      const supportedTargets = this.applyNamedMorphTargets(mesh, recipe);
      mesh.userData.appearance = compactAppearanceRecipe(recipe, characterId);
      mesh.userData.appearanceFingerprint = appearanceFingerprint(recipe, characterId);
      mesh.userData.appearanceCapability = supportedTargets ? "gltf-morph-targets" : "procedural-fallback";
      mesh.userData.visualHeight = 1 + delta("height") * 0.12;
      mesh.userData.gameplayCollider = { radius: 0.48, height: 2.95 };
    }

    applyCorrectiveMorphs(mesh) {
      if (!mesh?.userData?.parts) return;
      const parts = mesh.userData.parts;
      const values = {
        correctiveShoulder: clamp((Math.abs(parts.leftArm.rotation.x) + Math.abs(parts.rightArm.rotation.x)) * 0.45, 0, 1),
        correctiveHip: clamp((Math.abs(parts.leftLeg.rotation.x) + Math.abs(parts.rightLeg.rotation.x)) * 0.4, 0, 1),
        correctiveElbow: clamp(Math.max(Math.abs(parts.leftArm.rotation.z), Math.abs(parts.rightArm.rotation.z)) * 0.6, 0, 1),
        correctiveKnee: clamp(Math.max(Math.abs(parts.leftLeg.rotation.x), Math.abs(parts.rightLeg.rotation.x)) * 0.7, 0, 1),
        correctiveChest: clamp(Math.abs(parts.torso.rotation.z) * 2.5, 0, 1)
      };
      mesh.traverse((object) => {
        const dictionary = object.morphTargetDictionary;
        const influences = object.morphTargetInfluences;
        if (!dictionary || !influences) return;
        Object.entries(values).forEach(([name, value]) => {
          const index = dictionary[name];
          if (Number.isInteger(index) && index < influences.length) influences[index] = value;
        });
      });
      mesh.userData.correctives = values;
    }

    createPlayerWeapon(profile) {
      const THREE = this.THREE;
      const weapon = new THREE.Group();
      const weaponSurface = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({
          color: 0xf2fbff,
          emissive: profile.accent,
          emissiveIntensity: 0.86,
          gradientMap: this.toonGradient
        })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({
          color: 0xf2fbff,
          emissive: profile.accent,
          emissiveIntensity: 0.62,
          roughness: 0.16,
          metalness: 0.82,
          clearcoat: 0.7
        });
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, profile.id === "sol" ? 1.75 : 1.52, 0.18),
        weaponSurface
      );
      blade.position.y = 0.45;
      weapon.add(blade);
      const guardMaterial = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.55, gradientMap: this.toonGradient })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.34, roughness: 0.22, metalness: 0.72, clearcoat: 0.58 });
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.09, 0.14),
        guardMaterial
      );
      guard.position.y = -0.31;
      weapon.add(guard);
      weapon.rotation.z = -0.28;
      return weapon;
    }

    createActors() {
      CHARACTER_ORDER.forEach((id) => {
        const profile = CHARACTERS[id];
        const mesh = this.createAnimeCharacterMesh(profile, 1);
        const weapon = this.createPlayerWeapon(profile);
        mesh.userData.parts.weaponAnchor.add(weapon);
        mesh.userData.weapon = weapon;
        mesh.visible = id === this.state.roster.activeId;
        this.world.add(mesh);
        this.characterMeshes.set(id, mesh);
      });
      this.playerMesh = this.characterMeshes.get(this.state.roster.activeId) || this.characterMeshes.get("lyra");
      this.playerWeapon = this.playerMesh.userData.weapon;
      const activeProfile = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      this.state.player.name = activeProfile.name;
      this.state.player.element = activeProfile.element;

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
      const material = new THREE.MeshToonMaterial({
        color: new THREE.Color(profile.color).multiplyScalar(0.55),
        emissive: new THREE.Color(profile.color),
        emissiveIntensity: profile.boss ? 0.7 : 0.35,
        gradientMap: this.toonGradient
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
      eye.userData.weakPoint = Boolean(profile.boss);
      if (profile.boss) eye.visible = false;
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
        baseAttack: profile.attack,
        speed: profile.speed,
        baseSpeed: profile.speed,
        element: profile.element,
        xp: profile.xp,
        drop: profile.drop,
        boss: Boolean(profile.boss),
        bossPhase: 1,
        weakPoint: eye,
        shield: profile.boss ? 320 : 0,
        maxShield: profile.boss ? 320 : 0,
        homeX: x,
        homeZ: z,
        lastAttackAt: 0,
        lastSpecialAt: 0,
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
      const activeId = CHARACTERS[this.state.roster.activeId] ? this.state.roster.activeId : "lyra";
      const activeProfile = CHARACTERS[activeId];
      this.characterMeshes.forEach((mesh, id) => {
        mesh.visible = id === activeId;
        mesh.position.set(player.x, player.y, player.z);
        mesh.rotation.y = player.rotation;
      });
      this.playerMesh = this.characterMeshes.get(activeId) || this.playerMesh;
      this.playerWeapon = this.playerMesh?.userData?.weapon || this.playerWeapon;
      player.name = activeProfile.name;
      player.element = activeProfile.element;
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
      this.puzzleNodes.forEach((puzzle, id) => {
        const solved = Boolean(this.state.puzzles[id]?.solved);
        puzzle.userData.solved = solved;
        puzzle.children.forEach((child) => {
          if (!child.material) return;
          child.material.emissiveIntensity = solved ? 1.1 : 0.18;
        });
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
        const teamButton = event.target.closest("[data-character]");
        if (teamButton) return this.switchCharacter(teamButton.dataset.character);
        if (event.target.closest("[data-har-photo]")) return this.togglePhotoMode();
        const photoAction = event.target.closest("[data-photo-action]")?.dataset.photoAction;
        if (photoAction === "close") return this.togglePhotoMode(false);
        if (photoAction === "toggle-ui") {
          this.photoSettings.hideUi = !this.photoSettings.hideUi;
          this.root.classList.toggle("is-photo-clean", this.photoSettings.hideUi);
          return;
        }
        if (photoAction === "capture") return this.capturePhoto();
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
      this.listen(this.root, "input", (event) => {
        const key = event.target?.dataset?.photoSetting;
        if (!key) return;
        let value = event.target.value;
        if (["fov", "exposure", "time"].includes(key)) value = Number(value);
        this.photoSettings[key] = value;
        if (key === "fov" && this.camera) {
          this.camera.fov = value;
          this.camera.updateProjectionMatrix();
        } else if (key === "exposure" && this.renderer) {
          this.renderer.toneMappingExposure = value / 100;
        } else if (key === "time") {
          this.state.worldTime = value;
          this.updateWorld(0, performance.now());
        } else if (key === "weather") {
          this.updateWeatherAppearance();
        }
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
          "KeyI", "KeyM", "KeyJ", "KeyK", "KeyP", "KeyC", "KeyO", "Digit1", "Digit2", "Digit3", "Digit4"
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
        if (event.code === "KeyC") this.openPanel("characters");
        if (event.code === "KeyO") this.togglePhotoMode();
        if (/^Digit[1-4]$/.test(event.code)) this.switchCharacter(CHARACTER_ORDER[Number(event.code.slice(-1)) - 1]);
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
      if (!this.running || this.paused || this.photoMode || this.destroyed) return;
      if (action === "attack") this.attack("attack");
      else if (action === "skill") this.attack("skill");
      else if (action === "ultimate") this.attack("ultimate");
      else if (action === "dodge") this.dodge();
      else if (action === "jump") this.jumpOrGlide();
      else if (action === "interact") this.interact();
      else if (action === "lock") this.toggleTargetLock();
    }

    switchCharacter(characterId) {
      const profile = CHARACTERS[characterId];
      if (!profile || !this.state.roster.unlocked.includes(characterId)) return;
      if (!this.running || this.photoMode || this.state.player.health <= 0) return;
      const now = performance.now();
      if (now - this.characterSwitchAt < 650 || characterId === this.state.roster.activeId) return;

      const previousId = this.state.roster.activeId;
      const previousMember = this.state.roster.members[previousId];
      if (previousMember) {
        previousMember.health = this.state.player.health;
        previousMember.maxHealth = this.state.player.maxHealth;
        previousMember.ultimate = this.state.player.ultimate;
      }

      const nextMember = this.state.roster.members[characterId] || { health: 100, maxHealth: 100, ultimate: 0, level: 1 };
      this.state.roster.members[characterId] = nextMember;
      this.state.roster.activeId = characterId;
      this.state.player.name = profile.name;
      this.state.player.element = profile.element;
      this.state.player.health = clamp(nextMember.health, 1, nextMember.maxHealth || 100);
      this.state.player.maxHealth = Number(nextMember.maxHealth || 100);
      this.state.player.ultimate = clamp(nextMember.ultimate, 0, 100);

      this.characterMeshes.forEach((mesh, id) => {
        mesh.visible = id === characterId;
        mesh.position.set(this.state.player.x, this.state.player.y, this.state.player.z);
        mesh.rotation.y = this.state.player.rotation;
      });
      this.playerMesh = this.characterMeshes.get(characterId);
      this.playerWeapon = this.playerMesh.userData.weapon;
      this.characterSwitchAt = now;
      this.combo = 0;
      this.setElement(profile.element, false);
      this.root.querySelectorAll("[data-character]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.character === characterId);
      });
      this.spawnNova(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, profile.accent);
      this.cameraShake = Math.max(this.cameraShake, 0.2);
      this.sound("collect");
      this.toast(`${profile.name} · ${profile.role}`, "success");
      this.updateUi(true);
    }

    updateCharacterAnimation(dt, time, input, sprinting) {
      const parts = this.playerMesh?.userData?.parts;
      if (!parts) return;
      const moving = Boolean(input?.active);
      const targetAnimation = !this.isGrounded
        ? (this.gliding ? "glide" : "air")
        : moving
          ? (sprinting ? "sprint" : "run")
          : "idle";
      if (targetAnimation !== this.activeAnimation) {
        this.activeAnimation = targetAnimation;
        this.animationBlend = 0;
      }
      this.animationBlend = clamp(this.animationBlend + dt * 6, 0, 1);
      const speed = sprinting ? 0.02 : moving ? 0.013 : 0.0022;
      const stride = moving ? Math.sin(time * speed) * (sprinting ? 0.62 : 0.42) : Math.sin(time * speed) * 0.045;
      const armStride = moving ? -stride * 0.82 : Math.sin(time * 0.0017) * 0.035;
      parts.leftLeg.rotation.x += (stride - parts.leftLeg.rotation.x) * this.animationBlend;
      parts.rightLeg.rotation.x += (-stride - parts.rightLeg.rotation.x) * this.animationBlend;
      parts.leftArm.rotation.x += (armStride - parts.leftArm.rotation.x) * this.animationBlend;
      parts.rightArm.rotation.x += (-armStride - parts.rightArm.rotation.x) * this.animationBlend;
      parts.torso.rotation.z = moving ? Math.sin(time * speed * 0.5) * 0.035 : Math.sin(time * 0.0013) * 0.018;
      parts.head.rotation.y = Math.sin(time * 0.00065) * (moving ? 0.025 : 0.08);
      parts.hair.rotation.x = 0.02 + Math.sin(time * 0.003) * (moving ? 0.055 : 0.025);
      parts.hair.children.forEach((lock, index) => {
        if (!lock.userData.secondaryMotion) return;
        lock.rotation.x = Math.sin(time * 0.0024 + index * 0.7) * lock.userData.secondaryMotion * (sprinting ? 2.2 : moving ? 1.35 : 0.65);
      });
      parts.eyes.forEach((eye, index) => {
        eye.rotation.y = clamp((this.cameraYaw - this.state.player.rotation) * 0.08, -0.16, 0.16);
        eye.rotation.x = Math.sin(time * 0.0008 + index) * 0.025;
      });
      const blink = Math.max(0, Math.sin(time * 0.00115) > 0.985 ? 1 : 0);
      parts.eyes.forEach((eye) => {
        eye.scale.y = (eye.userData.baseScaleY || eye.scale.y) * (1 - blink * 0.72);
      });
      parts.cape.rotation.x = (sprinting ? 0.72 : this.gliding ? 0.48 : moving ? 0.32 : 0.12) + Math.sin(time * 0.004) * 0.04;
      parts.halo.rotation.z += dt * 0.7;
      parts.leftWing.visible = this.gliding;
      parts.rightWing.visible = this.gliding;
      if (this.gliding) {
        parts.leftWing.rotation.z = -0.28 + Math.sin(time * 0.003) * 0.06;
        parts.rightWing.rotation.z = 0.28 - Math.sin(time * 0.003) * 0.06;
      }
      this.applyCorrectiveMorphs(this.playerMesh);
    }

    togglePhotoMode(force) {
      if (!this.running || !this.camera) return;
      const next = typeof force === "boolean" ? force : !this.photoMode;
      this.photoMode = next;
      this.menuPaused = next;
      this.root.classList.toggle("is-photo-mode", next);
      this.root.classList.toggle("is-photo-clean", next && this.photoSettings.hideUi);
      const panel = this.root.querySelector("[data-har-photo-ui]");
      if (panel) panel.hidden = !next;
      if (next) {
        this.photoSettings.time = this.state.worldTime;
        this.photoSettings.fov = this.camera.fov;
        this.photoSettings.exposure = Math.round(this.renderer.toneMappingExposure * 100);
        this.root.querySelector('[data-photo-setting="time"]').value = String(this.photoSettings.time);
        this.root.querySelector('[data-photo-setting="fov"]').value = String(this.photoSettings.fov);
        this.root.querySelector('[data-photo-setting="exposure"]').value = String(this.photoSettings.exposure);
        this.toast("Photo Mode · kéo chuột để chọn góc máy.");
      } else {
        this.cameraFovTarget = 58;
        this.camera.fov = 58;
        this.camera.updateProjectionMatrix();
        this.renderer.toneMappingExposure = 1.08;
        this.root.classList.remove("is-photo-clean");
      }
    }

    capturePhoto() {
      const canvas = this.renderer?.domElement;
      if (!canvas) return;
      this.renderer.render(this.scene, this.camera);
      canvas.toBlob((blob) => {
        if (!blob) {
          this.toast("Thiết bị không tạo được ảnh PNG.", "error");
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `hh-astral-realms-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        anchor.click();
        root.setTimeout(() => URL.revokeObjectURL(url), 1500);
        this.toast("Đã lưu ảnh Photo Mode.", "success");
      }, "image/png");
    }

    frame(time) {
      if (this.destroyed) return;
      const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameAt) / 1000));
      this.lastFrameAt = time;

      if (this.visible && this.renderer && this.scene && this.camera) {
        if (this.running && !this.paused && !this.menuPaused && time >= this.hitStopUntil) {
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
      const character = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      const sprinting = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && input.active && player.stamina > 0;
      const staminaBonus = Number(this.state.skills.staminaCore || 0) * 10;
      player.maxStamina = 100 + staminaBonus;
      const inAuroraLake = Math.hypot(player.x + 51, player.z - 20) < 12.6 && player.y < 1.8;
      this.isSwimming = inAuroraLake;
      const climbTarget = this.climbables.find((entry) => {
        const distance = Math.hypot(player.x - entry.object.position.x, player.z - entry.object.position.z);
        return distance <= entry.radius + 0.75 && player.y < entry.top;
      });
      this.isClimbing = Boolean(
        climbTarget
        && this.keys.has("Space")
        && player.stamina > 0
        && !this.isSwimming
      );
      const speed = (this.isSwimming ? 3.25 : sprinting ? 8.2 : 5.35) * character.speedScale;
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

      if (this.isClimbing) {
        this.isGrounded = false;
        this.gliding = false;
        this.verticalVelocity = 0;
        player.y = Math.min(climbTarget.top, player.y + dt * 2.8);
        player.stamina = clamp(player.stamina - dt * 18, 0, player.maxStamina);
      } else if (this.isSwimming) {
        this.isGrounded = false;
        this.gliding = false;
        this.verticalVelocity = 0;
        player.y = 1.36 + Math.sin(time * 0.003) * 0.06;
        if (input.active) player.stamina = clamp(player.stamina - dt * 5.5, 0, player.maxStamina);
      } else if (sprinting) player.stamina = clamp(player.stamina - dt * 20, 0, player.maxStamina);
      else if (!this.gliding) player.stamina = clamp(player.stamina + dt * 15, 0, player.maxStamina);

      if (!this.isGrounded && !this.isClimbing && !this.isSwimming) {
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
      this.characterMeshes.forEach((mesh, id) => {
        if (id === this.state.roster.activeId) return;
        mesh.position.set(player.x, player.y, player.z);
        mesh.rotation.y = player.rotation;
      });
      this.updateCharacterAnimation(dt, time, input, sprinting);
      this.root.classList.toggle("is-swimming", this.isSwimming);
      this.root.classList.toggle("is-climbing", this.isClimbing);
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
        if (data.boss) this.updateBossPhase(enemy, distance, time);
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

    updateBossPhase(enemy, distance, time) {
      const data = enemy.userData;
      const ratio = data.health / data.maxHealth;
      const nextPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      if (nextPhase !== data.bossPhase) {
        data.bossPhase = nextPhase;
        data.speed = data.baseSpeed * (nextPhase === 2 ? 1.24 : nextPhase === 3 ? 1.52 : 1);
        data.attack = Math.round(data.baseAttack * (nextPhase === 2 ? 1.25 : nextPhase === 3 ? 1.55 : 1));
        data.weakPoint.visible = nextPhase >= 2;
        this.cinematicTarget = { object: enemy, until: performance.now() + 1250, phase: nextPhase };
        this.cameraShake = Math.max(this.cameraShake, 0.9);
        this.spawnPulse(enemy.position.x, 1.2, enemy.position.z, nextPhase === 2 ? "#ffc565" : "#ff507e", 1.1, 8.5);
        this.toast(`Nexus Warden · Phase ${nextPhase}${nextPhase === 2 ? " · Weak Point mở" : nextPhase === 3 ? " · Void Overdrive" : ""}`, "error");
      }

      if (nextPhase >= 2 && time - data.lastSpecialAt > (nextPhase === 3 ? 2600 : 3900)) {
        data.lastSpecialAt = time;
        this.spawnPulse(enemy.position.x, 1.15, enemy.position.z, nextPhase === 3 ? "#ff4f8f" : "#b37aff", 0.9, nextPhase === 3 ? 9.5 : 6.5);
        this.cameraShake = Math.max(this.cameraShake, nextPhase === 3 ? 0.72 : 0.42);
        if (distance < (nextPhase === 3 ? 8.5 : 6.2)) this.damagePlayer(nextPhase === 3 ? 26 : 16, "Nexus shockwave");
      }
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
      this.remotePlayers.forEach((remote) => {
        const target = remote.userData.targetPosition;
        if (!target) return;
        const blend = Math.min(1, dt * 14);
        remote.position.lerp(target, blend);
        if (Number.isFinite(remote.userData.targetRotation)) {
          const delta = Math.atan2(Math.sin(remote.userData.targetRotation - remote.rotation.y), Math.cos(remote.userData.targetRotation - remote.rotation.y));
          remote.rotation.y += delta * blend;
        }
        const parts = remote.userData.parts;
        if (parts?.leftLeg && parts?.rightLeg) {
          const stride = Math.sin(time * 0.012 + remote.position.x * 0.2) * 0.08;
          parts.leftLeg.rotation.x = stride;
          parts.rightLeg.rotation.x = -stride;
        }
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
      const celestialAngle = (this.state.worldTime / 24) * Math.PI * 2 - Math.PI / 2;
      if (this.sunDisc) this.sunDisc.position.set(Math.cos(celestialAngle) * 150, Math.sin(celestialAngle) * 115, -90);
      if (this.moonDisc) this.moonDisc.position.set(Math.cos(celestialAngle + Math.PI) * 150, Math.sin(celestialAngle + Math.PI) * 110, -82);
      if (this.sunLight) this.sunLight.position.set(
        Math.cos(celestialAngle) * 58,
        Math.max(8, Math.sin(celestialAngle) * 68),
        Math.sin(celestialAngle * 0.7) * 38
      );
      this.scene.background.setRGB(0.018 + dayAmount * 0.035, 0.026 + dayAmount * 0.04, 0.07 + dayAmount * 0.08);
      this.scene.fog.color.copy(this.scene.background);
      this.hemisphereLight.intensity = 0.85 + dayAmount * 1.2;
      this.sunLight.intensity = 0.45 + dayAmount * 2.15;
      this.hLight.intensity = 35 + (1 - dayAmount) * 25;
      if (this.fillLight) this.fillLight.intensity = 0.28 + dayAmount * 0.45;
      if (this.rimLight) this.rimLight.intensity = 0.38 + (1 - dayAmount) * 0.52;
      if (this.skyDome) {
        this.skyDome.material.color.set(dayAmount > 0.4 ? 0x8fa9d8 : 0x524084);
        this.skyDome.material.color.multiplyScalar(0.42 + dayAmount * 0.58);
      }
      if (this.auroraVeil) {
        this.auroraVeil.rotation.z += dt * 0.018;
        this.auroraVeil.material.opacity = (1 - dayAmount) * 0.18 + (this.currentZone.id === "aurora" ? 0.09 : 0.02);
      }
      this.cloudLayers.forEach((cloud) => {
        cloud.rotation.y += dt * 0.006;
        cloud.position.x += dt * cloud.userData.drift;
        if (cloud.position.x > 115) cloud.position.x = -115;
      });
      this.waterSurfaces.forEach((water, index) => {
        water.position.y = water.userData.baseY + Math.sin(time * 0.0017 + index) * 0.035;
        water.rotation.z += dt * (water.userData.lava ? 0.035 : -0.012);
        water.material.emissiveIntensity = water.userData.lava
          ? 1.15 + Math.sin(time * 0.003) * 0.25
          : 0.16 + Math.sin(time * 0.0015) * 0.06;
      });
      this.puzzleNodes.forEach((puzzle) => {
        const core = puzzle.userData.core;
        core.rotation.y += dt * (puzzle.userData.solved ? 1.5 : 0.45);
        core.position.y = 1.8 + Math.sin(time * 0.002 + puzzle.position.x) * 0.18;
      });
      if (time - this.lastStreamingAt > 550) {
        this.lastStreamingAt = time;
        this.updateWorldStreaming();
      }

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

    updateWorldStreaming() {
      const player = this.state.player;
      const quality = this.state.settings.quality;
      const visibleRadius = quality === "low" ? 46 : quality === "medium" ? 63 : 86;
      this.streamingGroups.forEach((group, zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!zone) return;
        const distance = Math.hypot(player.x - zone.x, player.z - zone.z);
        group.visible = distance <= visibleRadius || zoneId === this.currentZone.id;
      });
      const shadowRadius = quality === "cinematic" ? 58 : quality === "high" ? 42 : 24;
      this.world.traverse((object) => {
        if (!object.isMesh || object === this.playerMesh || object.userData?.boss) return;
        if (object.userData.baseCastShadow === undefined) object.userData.baseCastShadow = Boolean(object.castShadow);
        const distance = Math.hypot(player.x - object.position.x, player.z - object.position.z);
        object.castShadow = Boolean(object.userData.baseCastShadow && this.renderer.shadowMap?.enabled && distance < shadowRadius);
      });
    }

    updateWeatherAppearance() {
      if (!this.weatherField) return;
      const colors = { central: 0x72eaff, aurora: 0x9effe9, crimson: 0xff8a62, void: 0xc087ff };
      const override = this.photoMode ? this.photoSettings.weather : "auto";
      const mode = override === "auto"
        ? this.currentZone.id
        : ({ clear: "central", aurora: "aurora", storm: "aurora", embers: "crimson" }[override] || this.currentZone.id);
      this.weatherField.material.color.setHex(colors[mode] || colors.central);
      const density = clamp(this.state.settings.weatherDensity, 0, 100) / 100;
      this.weatherField.material.opacity = override === "clear"
        ? 0.04
        : (mode === "central" ? 0.16 : mode === "aurora" && override === "storm" ? 0.82 : 0.58) * density;
      this.weatherField.material.size = mode === "crimson" ? 0.34 : mode === "aurora" ? 0.24 : 0.18;
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
      let desired = new this.THREE.Vector3(
        player.x + Math.sin(this.cameraYaw) * horizontal,
        player.y + 2.2 + Math.sin(this.cameraPitch) * this.cameraDistance,
        player.z + Math.cos(this.cameraYaw) * horizontal
      );
      const focus = new this.THREE.Vector3(player.x, player.y + 1.35, player.z);
      if (this.currentPanel === "creator") {
        const focusOffset = { head: 1.1, upper: 0.62, body: 0.88, lower: 0.28 }[this.appearanceFocus] ?? 0.88;
        focus.set(player.x, player.y + focusOffset, player.z);
        const creatorDistance = clamp(this.cameraDistance, 6.5, 12);
        const creatorHorizontal = Math.cos(this.cameraPitch) * creatorDistance;
        desired.set(
          player.x + Math.sin(this.cameraYaw) * creatorHorizontal,
          player.y + focusOffset + Math.sin(this.cameraPitch) * creatorDistance,
          player.z + Math.cos(this.cameraYaw) * creatorHorizontal
        );
      }
      desired = this.updateCinematicCamera(desired, focus, dt);
      if (!this.photoMode) {
        const colliderObjects = this.climbables.map((entry) => entry.object).filter(Boolean);
        if (colliderObjects.length) {
          this.cameraRaycaster ||= new this.THREE.Raycaster();
          const direction = desired.clone().sub(focus);
          const distance = direction.length();
          direction.normalize();
          this.cameraRaycaster.set(focus, direction);
          this.cameraRaycaster.far = distance;
          const hit = this.cameraRaycaster.intersectObjects(colliderObjects, true)[0];
          if (hit && hit.distance < distance) desired = focus.clone().add(direction.multiplyScalar(Math.max(2.2, hit.distance - 0.55)));
        }
      }
      if (this.cameraShake > 0.001 && !this.state.settings.reduceEffects) {
        const intensity = this.cameraShake * clamp(this.state.settings.cameraShake, 0, 100) / 100;
        desired.x += (Math.random() - 0.5) * intensity;
        desired.y += (Math.random() - 0.5) * intensity * 0.55;
        desired.z += (Math.random() - 0.5) * intensity;
        this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
      }
      if (immediate) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      const locked = this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      if (locked?.visible && !locked.userData.defeated && !this.photoMode) {
        const targetFocus = locked.position.clone();
        targetFocus.y += 1.2;
        focus.lerp(targetFocus, 0.38);
      }
      this.camera.lookAt(focus);
      if (!this.photoMode) {
        this.cameraFovTarget = this.activeAnimation === "sprint" ? 64 : this.lockedTargetId ? 60 : 58;
        this.camera.fov += (this.cameraFovTarget - this.camera.fov) * (1 - Math.pow(0.015, dt));
        this.camera.updateProjectionMatrix();
      }
    }

    updateCinematicCamera(desired, focus, dt) {
      const cinematic = this.cinematicTarget;
      if (!cinematic || performance.now() >= cinematic.until || !cinematic.object) {
        this.cinematicTarget = null;
        return desired;
      }
      const targetPosition = cinematic.object.getWorldPosition
        ? cinematic.object.getWorldPosition(new this.THREE.Vector3())
        : cinematic.object.position.clone();
      const progress = clamp((cinematic.until - performance.now()) / 1250, 0, 1);
      const side = cinematic.phase === 3 ? -1 : 1;
      const cinematicPosition = targetPosition.clone().add(new this.THREE.Vector3(6.5 * side, 4.2 + progress * 1.5, 7.2));
      focus.lerp(targetPosition.clone().add(new this.THREE.Vector3(0, 1.4, 0)), 0.65);
      return desired.lerp(cinematicPosition, clamp(dt * 7.5, 0, 0.82));
    }

    jumpOrGlide() {
      if (this.isSwimming) {
        this.isSwimming = false;
        this.isGrounded = false;
        this.verticalVelocity = 5.4;
        this.state.player.y += 0.18;
        this.sound("jump");
        return;
      }
      if (this.isClimbing) {
        this.isClimbing = false;
        this.isGrounded = false;
        this.verticalVelocity = 4.6;
        this.state.player.y += 0.14;
        return;
      }
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
      if (!this.running || this.paused || this.menuPaused || this.photoMode || this.state.player.health <= 0) return;
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
      const characterId = this.state.roster.activeId;
      const damageBase = kind === "attack"
        ? 22 + this.combo * 7
        : kind === "skill"
          ? 68 + Number(this.state.skills.plasmaDrive || 0) * 9
          : 155;
      this.swingAnimation(kind);
      this.spawnPulse(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, ELEMENTS[element].color, kind === "ultimate" ? 1.2 : 0.42, kind === "ultimate" ? 8 : 3.2);
      this.sound(kind);
      this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 0.95 : kind === "skill" ? 0.42 : 0.18);
      if (kind === "ultimate") this.cinematicTarget = { object: target || this.playerMesh, until: now + 780, phase: 0 };
      if (kind === "skill" && characterId === "nyx" && target) {
        const distance = Math.hypot(target.position.x - this.state.player.x, target.position.z - this.state.player.z) || 1;
        this.state.player.x = target.position.x - ((target.position.x - this.state.player.x) / distance) * 2.2;
        this.state.player.z = target.position.z - ((target.position.z - this.state.player.z) / distance) * 2.2;
        this.spawnPulse(this.state.player.x, this.state.player.y + 0.6, this.state.player.z, "#bd72ff", 0.55, 3.8);
      }
      if (kind === "ultimate" && characterId === "sol") {
        this.state.player.health = clamp(this.state.player.health + 34, 0, this.state.player.maxHealth);
      }

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
      const character = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      let damage = (baseDamage + Number(weapon.attack || 0)) * character.attackScale;
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
      if (data.boss && data.bossPhase >= 2 && data.weakPoint?.visible && kind !== "attack") {
        damage = Math.round(damage * 1.35);
        this.toast(`WEAK POINT · ${damage} sát thương`, "success");
      }
      let absorbed = 0;
      if (data.boss && data.shield > 0) {
        absorbed = Math.min(data.shield, damage);
        data.shield = Math.max(0, data.shield - absorbed);
        damage -= absorbed;
        if (!data.shield) {
          this.spawnNova(target.position.x, target.position.y + 1.5, target.position.z, "#ffd36b");
          this.cameraShake = Math.max(this.cameraShake, 0.75);
          this.toast("Astral Shell đã vỡ · Weak Point chuẩn bị mở!", "success");
        }
      }
      data.status[element] = now;
      data.health = Math.max(0, data.health - damage);
      const dealt = damage + absorbed;
      this.hitStopUntil = performance.now() + (kind === "ultimate" ? 95 : kind === "skill" ? 62 : 38);
      this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 1 : kind === "skill" ? 0.48 : 0.25);
      this.state.stats.totalDamage += dealt;
      this.state.stats.highestHit = Math.max(this.state.stats.highestHit, dealt);
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
      this.puzzleNodes.forEach((puzzle) => add(puzzle, 4.2));
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
          : data.type === "puzzle"
            ? data.solved
              ? `${data.name} · Đã cộng hưởng`
              : `G · Kích hoạt ${data.name} bằng ${ELEMENTS[data.requiredElement]?.label || "đúng nguyên tố"}`
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
      if (data.type === "puzzle") return this.activatePuzzle(target);
      if (data.type === "training") {
        this.trainingActive = true;
        this.dpsSamples = [];
        this.root.querySelector("[data-har-dps]").classList.add("is-active");
        this.toast("Training Arena đã bắt đầu · tấn công lõi để đo DPS.");
      }
    }

    activatePuzzle(puzzle) {
      const data = puzzle.userData;
      if (data.solved) {
        this.toast(`${data.name} đã được kích hoạt.`);
        return;
      }
      if (this.state.player.element !== data.requiredElement) {
        this.toast(`Cần cộng hưởng ${ELEMENTS[data.requiredElement]?.label || data.requiredElement}. Hãy đổi nhân vật hoặc lõi nguyên tố.`, "error");
        return;
      }
      data.solved = true;
      this.state.puzzles[data.id] = { solved: true, solvedAt: nowIso(), characterId: this.state.roster.activeId };
      puzzle.children.forEach((child) => {
        if (child.material) child.material.emissiveIntensity = 1.15;
      });
      this.spawnNova(puzzle.position.x, puzzle.position.y + 1.5, puzzle.position.z, data.color);
      this.addItem("aurora-shard", 1, `Giải ${data.name}`);
      this.grantXp(70);
      this.toast(`${data.name} đã cộng hưởng · +70 XP`, "success");
      this.saveProgress("Giải elemental puzzle");
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
      this.playerWeapon?.traverse?.((object) => {
        if (!object.material) return;
        object.material.emissive?.set?.(ELEMENTS[elementId].color);
        object.material.color?.set?.(ELEMENTS[elementId].color);
      });
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
      this.root.querySelector("[data-har-fps]").textContent = this.fps ? `${this.fps} FPS · scale ${Math.round(this.renderScale * 100)}%` : "Đang đo";
      this.root.querySelector("[data-har-renderer]").textContent = this.rendererBackend === "webgpu" ? "WEBGPU · TSL" : "WEBGL2 · FALLBACK";
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
        this.root.querySelector("[data-har-boss-phase]").textContent = `PHASE ${boss.userData.bossPhase} · ${boss.userData.shield > 0 ? `ASTRAL SHELL ${Math.round(boss.userData.shield)}` : "WEAK POINT OPEN"}`;
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
      if (this.state.settings.quality === "auto" && this.state.settings.dynamicResolution !== false) {
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
      const qualityRatios = { low: 0.58, medium: 0.82, high: 1, cinematic: 1, auto: this.renderScale };
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
        characters: () => this.renderCharactersPanel(),
        creator: () => this.renderCharacterCreatorPanel(),
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
        characters: ["Đội hình Astral", "Character Observatory", "#ff78d2"],
        creator: ["Character Creator", "Appearance Observatory", "#71efff"],
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

    renderCharactersPanel() {
      const activeId = this.state.roster.activeId;
      return `
        <div class="har-section"><h3>Đội hình bốn nhân vật nguyên bản</h3><p>Đổi nhanh bằng phím 1–4 hoặc bấm thẻ nhân vật. Mỗi nhân vật có nguyên tố, tốc độ, hệ số sát thương và thanh tuyệt kỹ riêng.</p></div>
        <ul class="har-character-list">${CHARACTER_ORDER.map((id, index) => {
          const profile = CHARACTERS[id];
          const member = this.state.roster.members[id] || {};
          const active = id === activeId;
          return `<li class="har-character-card ${active ? "is-active" : ""}" style="--character-color:${profile.accent}">
            <div class="har-character-card__avatar"><strong>${profile.short}</strong><span>${ELEMENTS[profile.element].short}</span></div>
            <div><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.role)}</span><small>${escapeHtml(profile.description)}</small><small>Lv.${member.level || 1} · ${Math.round(member.health || 100)}/${member.maxHealth || 100} HP · ${ELEMENTS[profile.element].label}</small></div>
            <button class="har-chip ${active ? "is-active" : ""}" type="button" data-panel-action="switch-character" data-character="${id}">${active ? "Đang dùng" : `Đổi [${index + 1}]`}</button>
          </li>`;
        }).join("")}</ul>
        <div class="har-section"><h3>Hồ sơ hình ảnh</h3><p>Recipe ngoại hình được lưu theo từng nhân vật, dùng cho preset, multiplayer và model GLB/VRM khi asset được kết nối.</p>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="open-character-creator">Mở Character Creator</button></div>
        </div>`;
    }

    activeAppearanceRecipe() {
      const id = this.state.roster.activeId;
      this.state.appearance ||= { recipes: {}, savedPresets: [], lastSavedAt: "" };
      this.state.appearance.recipes[id] ||= defaultAppearanceRecipe(id);
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(this.state.appearance.recipes[id], id);
      return this.state.appearance.recipes[id];
    }

    renderCharacterCreatorPanel() {
      const id = this.state.roster.activeId;
      const profile = CHARACTERS[id] || CHARACTERS.lyra;
      const recipe = this.activeAppearanceRecipe();
      const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup) || APPEARANCE_GROUPS[0];
      const mesh = this.characterMeshes.get(id);
      const capability = mesh?.userData?.appearanceCapability === "gltf-morph-targets"
        ? "GLB morph target đang hoạt động"
        : "Procedural fallback · chờ GLB/VRM asset";
      const saved = this.state.appearance.savedPresets || [];
      return `
        <div class="har-creator">
          <div class="har-creator__hero">
            <div><small>CHARACTER CREATOR · ${escapeHtml(profile.name)}</small><h3>${recipe.style === "human-cinematic" ? "Human Cinematic" : "Anime Realistic"}</h3><p>${escapeHtml(capability)} · collider gameplay giữ cố định để multiplayer công bằng.</p></div>
            <span class="har-chip ${capability.startsWith("GLB") ? "is-active" : ""}">${capability.startsWith("GLB") ? "MORPH READY" : "FALLBACK"}</span>
          </div>
          <div class="har-creator__toolbar">
            <label class="har-field">Model nền<select data-appearance-setting="baseModel">${APPEARANCE_ASSETS.baseModels.map((value) => `<option value="${value}" ${recipe.baseModel === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Preset cơ thể<select data-appearance-setting="bodyPreset">${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<option value="${value}" ${recipe.bodyPreset === value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
            <label class="har-field">Phong cách<select data-appearance-setting="style"><option value="anime-realistic" ${recipe.style === "anime-realistic" ? "selected" : ""}>Anime Realistic</option><option value="human-cinematic" ${recipe.style === "human-cinematic" ? "selected" : ""}>Human Cinematic</option></select></label>
          </div>
          <div class="har-creator__options">
            <label><input type="checkbox" data-appearance-setting="symmetry" ${recipe.symmetry ? "checked" : ""}> Chỉnh đối xứng</label>
            <label><input type="checkbox" data-appearance-setting="advanced" ${recipe.advanced ? "checked" : ""}> Chế độ nâng cao trái–phải</label>
            <label class="har-creator__color">Da <input type="color" value="${recipe.skinColor}" data-appearance-setting="skinColor"></label>
            <label class="har-creator__color">Mắt <input type="color" value="${recipe.eyeColor}" data-appearance-setting="eyeColor"></label>
            <label class="har-creator__color">Tóc <input type="color" value="${recipe.hairColor}" data-appearance-setting="hairColor"></label>
          </div>
          <div class="har-creator__tabs" role="tablist" aria-label="Nhóm ngoại hình">
            ${APPEARANCE_GROUPS.map((item) => `<button type="button" class="${item.id === group.id ? "is-active" : ""}" data-appearance-group="${item.id}" role="tab" aria-selected="${item.id === group.id}">${item.label}</button>`).join("")}
          </div>
          <div class="har-creator__sliders">
            ${group.controls.map(([controlId, label]) => {
              const control = APPEARANCE_CONTROL_MAP[controlId];
              const value = recipe.morphs[controlId] ?? control.defaultValue;
              return `<label class="har-appearance-slider"><span>${escapeHtml(label)}<output data-appearance-output="${controlId}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-appearance-morph="${controlId}" aria-label="${escapeHtml(label)}"></label>`;
            }).join("")}
          </div>
          <div class="har-creator__actions">
            <button class="har-secondary-button" type="button" data-panel-action="appearance-undo" ${this.appearanceHistory.length ? "" : "disabled"}>↶ Hoàn tác</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-redo" ${this.appearanceFuture.length ? "" : "disabled"}>↷ Làm lại</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-random">Ngẫu nhiên có kiểm soát</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-reset">Khôi phục</button>
            <input class="har-creator__name" type="text" maxlength="40" data-appearance-name placeholder="Tên preset">
            <button class="har-primary-button" type="button" data-panel-action="appearance-save">Lưu preset</button>
          </div>
          <div class="har-section har-creator__presets"><h3>Preset đã lưu</h3><div class="har-inline-actions">${saved.length ? saved.slice().reverse().map((preset) => `<button class="har-chip" type="button" data-panel-action="appearance-load-preset" data-preset-id="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</button>`).join("") : "<span>Chưa có preset ngoại hình.</span>"}</div></div>
          <div class="har-section har-creator__note"><p>Thanh trượt dùng recipe chuẩn hóa. Khi asset GLB/VRM có morph target, game tự chuyển sang morph thật; hiện tại model procedural hiển thị fallback trung thực và không thay đổi hitbox.</p></div>
        </div>`;
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
        : this.state.party.status === "reconnecting"
          ? "Đang kết nối lại shard miễn phí. Không hiển thị người chơi giả."
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

    refreshCharacterMaterials() {
      const replaceMesh = (oldMesh, profile, scale, metadata = {}) => {
        const parent = oldMesh.parent || this.world;
        const next = this.createAnimeCharacterMesh(profile, scale);
        next.position.copy(oldMesh.position);
        next.rotation.copy(oldMesh.rotation);
        next.visible = oldMesh.visible;
        next.userData = { ...oldMesh.userData, ...next.userData, characterId: profile.id, renderStyle: this.state.settings.renderStyle, ...metadata };
        if (!metadata.remote) {
          const weapon = this.createPlayerWeapon(profile);
          next.userData.parts.weaponAnchor.add(weapon);
          next.userData.weapon = weapon;
        }
        parent.add(next);
        parent.remove(oldMesh);
        oldMesh.traverse((object) => {
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => material.dispose?.());
        });
        return next;
      };
      this.characterMeshes.forEach((mesh, id) => {
        const profile = CHARACTERS[id];
        if (profile) this.characterMeshes.set(id, replaceMesh(mesh, profile, 1));
      });
      this.remotePlayers.forEach((mesh, id) => {
        const profile = CHARACTERS[mesh.userData.characterId] || CHARACTERS.lyra;
        this.remotePlayers.set(id, replaceMesh(mesh, profile, 0.92, { remote: true, id }));
      });
      this.playerMesh = this.characterMeshes.get(this.state.roster.activeId) || this.characterMeshes.get("lyra");
      this.playerWeapon = this.playerMesh?.userData.weapon || null;
      this.toast(`Đã áp dụng phong cách ${this.state.settings.renderStyle === "anime" ? "Anime Toon" : this.state.settings.renderStyle === "cinematic" ? "Cinematic PBR" : "Realistic PBR"}.`, "success");
    }

    recordAppearanceChange(beforeRecipe) {
      const id = this.state.roster.activeId;
      const after = appearanceFingerprint(this.activeAppearanceRecipe(), id);
      if (appearanceFingerprint(beforeRecipe, id) === after) return;
      this.appearanceHistory.push(normalizeAppearanceRecipe(beforeRecipe, id));
      this.appearanceHistory = this.appearanceHistory.slice(-30);
      this.appearanceFuture = [];
      this.appearanceDirty = true;
      this.state.appearance.lastSavedAt = nowIso();
      this.saveProgress("Cập nhật ngoại hình");
    }

    updateAppearanceDraft(key, value) {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      if (!this.appearanceInputStart) this.appearanceInputStart = clone(recipe);
      if (key in recipe.morphs) recipe.morphs[key] = clamp(value, 0, 1);
      else if (["symmetry", "advanced"].includes(key)) recipe[key] = Boolean(value);
      else if (["baseModel", "bodyPreset", "style", "skinColor", "eyeColor", "hairColor"].includes(key)) recipe[key] = value;
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(id), recipe, id);
      this.appearanceDirty = true;
    }

    commitAppearanceDraft() {
      if (!this.appearanceInputStart) return;
      const before = this.appearanceInputStart;
      this.appearanceInputStart = null;
      this.recordAppearanceChange(before);
    }

    applyAppearancePreset(presetId) {
      const preset = APPEARANCE_PRESETS[presetId];
      if (!preset) return;
      const before = clone(this.activeAppearanceRecipe());
      const recipe = this.activeAppearanceRecipe();
      recipe.bodyPreset = presetId;
      Object.entries(preset.morphs).forEach(([id, value]) => {
        if (id in recipe.morphs) recipe.morphs[id] = value;
      });
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(this.state.roster.activeId), recipe, this.state.roster.activeId);
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    randomAppearance() {
      const before = clone(this.activeAppearanceRecipe());
      const recipe = this.activeAppearanceRecipe();
      const seed = Math.floor(Math.random() * 0xffffff);
      this.appearanceSeed = seed;
      Object.values(APPEARANCE_CONTROL_MAP).forEach((control, index) => {
        if (control.group === "expression") return;
        const wave = Math.sin(seed * 0.001 + index * 1.73) * 0.5 + 0.5;
        recipe.morphs[control.id] = Number((0.28 + wave * 0.44).toFixed(3));
      });
      recipe.bodyPreset = "balanced";
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(this.state.roster.activeId), recipe, this.state.roster.activeId);
      this.recordAppearanceChange(before);
      this.toast("Đã tạo ngoại hình ngẫu nhiên có kiểm soát.", "success");
      this.renderCurrentPanel();
    }

    resetAppearance() {
      const before = clone(this.activeAppearanceRecipe());
      const id = this.state.roster.activeId;
      this.state.appearance.recipes[id] = defaultAppearanceRecipe(id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    undoAppearance() {
      const id = this.state.roster.activeId;
      const previous = this.appearanceHistory.pop();
      if (!previous) return;
      this.appearanceFuture.push(clone(this.activeAppearanceRecipe()));
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(previous, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      this.appearanceDirty = true;
      this.saveProgress("Hoàn tác ngoại hình");
      this.renderCurrentPanel();
    }

    redoAppearance() {
      const id = this.state.roster.activeId;
      const next = this.appearanceFuture.pop();
      if (!next) return;
      this.appearanceHistory.push(clone(this.activeAppearanceRecipe()));
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(next, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      this.appearanceDirty = true;
      this.saveProgress("Làm lại ngoại hình");
      this.renderCurrentPanel();
    }

    saveAppearancePreset(name = "") {
      const id = this.state.roster.activeId;
      const recipe = clone(this.activeAppearanceRecipe());
      const preset = {
        id: uid("look"),
        name: String(name || `${CHARACTERS[id]?.name || "Nhân vật"} · ${this.state.appearance.savedPresets.length + 1}`).slice(0, 40),
        characterId: id,
        recipe,
        createdAt: nowIso()
      };
      this.state.appearance.savedPresets = [...(this.state.appearance.savedPresets || []), preset].slice(-12);
      this.state.appearance.lastSavedAt = nowIso();
      this.saveProgress("Lưu preset ngoại hình");
      this.toast(`Đã lưu preset “${preset.name}”.`, "success");
      this.renderCurrentPanel();
    }

    loadAppearancePreset(presetId) {
      const preset = (this.state.appearance.savedPresets || []).find((item) => item.id === presetId);
      if (!preset) return;
      const before = clone(this.activeAppearanceRecipe());
      const id = this.state.roster.activeId;
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(preset.recipe, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    renderSettingsPanel() {
      const record = this.savedRecord;
      const histories = record?.history || [];
      return `
        <div class="har-section"><h3>Đồ họa và điều khiển</h3><p>Chế độ Auto tự giảm độ phân giải, sao và thời tiết nếu FPS thấp.</p>
          <div class="har-form-row">
            <label class="har-field">Chất lượng<select data-setting="quality"><option value="auto">Tự động theo FPS</option><option value="low">Tiết kiệm</option><option value="medium">Vừa</option><option value="high">Cao</option><option value="cinematic">Điện ảnh</option></select></label>
            <label class="har-field">Renderer<select data-setting="rendererMode"><option value="auto">Auto · WebGPU/WebGL2</option><option value="webgpu">Ưu tiên WebGPU</option><option value="webgl">WebGL2 ổn định</option></select></label>
            <label class="har-field">Phong cách hình ảnh<select data-setting="renderStyle"><option value="realistic">Realistic PBR</option><option value="cinematic">Cinematic PBR</option><option value="anime">Anime Toon</option></select></label>
            <label class="har-field">Dynamic resolution<select data-setting="dynamicResolution"><option value="true">Bật theo FPS</option><option value="false">Khóa độ phân giải</option></select></label>
            <label class="har-field">Âm lượng<input type="range" min="0" max="100" value="${this.state.settings.volume}" data-setting="volume"></label>
            <label class="har-field">Độ nhạy camera<input type="range" min="10" max="100" value="${this.state.settings.cameraSensitivity}" data-setting="cameraSensitivity"></label>
            <label class="har-field">Rung camera<input type="range" min="0" max="100" value="${this.state.settings.cameraShake}" data-setting="cameraShake"></label>
            <label class="har-field">Mật độ thời tiết<input type="range" min="0" max="100" value="${this.state.settings.weatherDensity}" data-setting="weatherDensity"></label>
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
        const groupButton = event.target.closest("[data-appearance-group]");
        if (groupButton) {
          this.appearanceGroup = groupButton.dataset.appearanceGroup || "face";
          const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup);
          this.appearanceFocus = group?.focus || "";
          this.renderCurrentPanel();
          return;
        }
        const button = event.target.closest("[data-panel-action]");
        if (!button || button.disabled) return;
        this.handlePanelAction(button.dataset.panelAction, button.dataset);
      };
      body.oninput = (event) => {
        const morph = event.target.closest("[data-appearance-morph]");
        const setting = event.target.closest("[data-appearance-setting]");
        if (morph) {
          const value = Number(morph.value);
          this.updateAppearanceDraft(morph.dataset.appearanceMorph, value);
          const output = body.querySelector(`[data-appearance-output="${morph.dataset.appearanceMorph}"]`);
          if (output) output.textContent = String(Math.round(value * 100));
        } else if (setting && ["color", "range"].includes(setting.type)) {
          this.updateAppearanceDraft(setting.dataset.appearanceSetting, setting.value);
        }
      };
      body.onchange = (event) => {
        if (event.target.matches("[data-inventory-filter]")) {
          this.inventoryFilter = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-inventory-sort]")) {
          this.inventorySort = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-appearance-morph]")) {
          this.commitAppearanceDraft();
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-appearance-setting]")) {
          const setting = event.target.dataset.appearanceSetting;
          const value = setting === "symmetry" || setting === "advanced" ? event.target.checked : event.target.value;
          if (setting === "bodyPreset") {
            this.applyAppearancePreset(value);
          } else {
            this.updateAppearanceDraft(setting, value);
            this.commitAppearanceDraft();
            this.renderCurrentPanel();
          }
        } else if (event.target.matches("[data-setting]")) {
          const key = event.target.dataset.setting;
          let value = event.target.value;
          if (["reduceEffects", "dynamicResolution", "postFx"].includes(key)) value = value === "true";
          if (["volume", "cameraSensitivity", "cameraShake", "weatherDensity"].includes(key)) value = Number(value);
          this.state.settings[key] = value;
          if (key === "quality") {
            this.root.dataset.quality = value;
            if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = value !== "low";
            this.resize();
          }
          if (key === "weatherDensity") this.updateWeatherAppearance();
          if (key === "rendererMode") this.toast("Renderer sẽ áp dụng ở lần mở game kế tiếp.");
          if (key === "renderStyle") this.refreshCharacterMaterials();
          if (key === "dynamicResolution") this.dynamicResolution = value ? this.renderScale : 1;
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
      setSelect('[data-setting="rendererMode"]', this.state.settings.rendererMode);
      setSelect('[data-setting="renderStyle"]', this.state.settings.renderStyle);
      setSelect('[data-setting="dynamicResolution"]', this.state.settings.dynamicResolution);
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
      else if (action === "switch-character") this.switchCharacter(data.character);
      else if (action === "open-character-creator") this.openPanel("creator");
      else if (action === "appearance-undo") this.undoAppearance();
      else if (action === "appearance-redo") this.redoAppearance();
      else if (action === "appearance-random") this.randomAppearance();
      else if (action === "appearance-reset") this.resetAppearance();
      else if (action === "appearance-save") this.saveAppearancePreset(bodyValue(this.root, "[data-appearance-name]"));
      else if (action === "appearance-load-preset") this.loadAppearancePreset(data.presetId);
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
          if (this.state.party.roomCode) this.rejoinPartyAfterReconnect();
        },
        connectError: () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? "reconnecting" : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        },
        disconnect: () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? (this.state.party.roomCode ? "reconnecting" : "local") : "offline";
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
      socket.on?.("connect_error", this.socketHandlers.connectError);
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
      this.socket.off?.("connect_error", this.socketHandlers.connectError);
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

    async rejoinPartyAfterReconnect() {
      if (this.rejoiningParty || !this.socket?.connected || !this.state.party.roomCode) return;
      this.rejoiningParty = true;
      const code = this.state.party.roomCode;
      try {
        const response = await this.emitAck("game:room:join", {
          code,
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        }, 6000);
        if (response.room?.gameId !== GAME_ID) throw new Error("Phòng đã chuyển sang game khác.");
        this.acceptRoom(response);
        this.toast(`Đã kết nối lại phòng ${code}.`, "success");
      } catch {
        this.state.party.roomCode = "";
        this.state.party.members = [];
        this.state.party.status = "ready";
        this.authoritative = false;
        this.room = null;
        this.updateConnectionUi();
        if (this.currentPanel === "party") this.renderCurrentPanel();
      } finally {
        this.rejoiningParty = false;
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
      const includeAppearance = Boolean(extra.appearance || this.appearanceDirty || extra.spawn);
      const payload = {
        seq: ++this.inputSeq,
        move: {
          x: forwardX * input.z + rightX * input.x,
          z: forwardZ * input.z + rightZ * input.x
        },
        sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
        rotation: this.state.player.rotation,
        element: this.state.player.element,
        characterId: this.state.roster.activeId,
        spawn: { x: this.state.player.x, z: this.state.player.z },
        ...(includeAppearance ? { appearance: compactAppearanceRecipe(this.activeAppearanceRecipe(), this.state.roster.activeId) } : {}),
        ...extra
      };
      this.socket.emit("astral-realms:input", payload);
      if (includeAppearance) this.appearanceDirty = false;
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
        if (CHARACTERS[self.characterId] && self.characterId !== this.state.roster.activeId) this.switchCharacter(self.characterId);
        if (ELEMENTS[self.element] && self.element !== this.state.player.element) this.setElement(self.element, false);
      }
      const activeRemoteIds = new Set();
      (payload.players || []).forEach((player) => {
        if (player.socketId === this.socket?.id) return;
        activeRemoteIds.add(player.socketId);
        let mesh = this.remotePlayers.get(player.socketId);
        const profile = CHARACTERS[player.characterId] || CHARACTERS.lyra;
        if (mesh && mesh.userData.characterId !== profile.id) {
          mesh.parent?.remove(mesh);
          this.remotePlayers.delete(player.socketId);
          mesh = null;
        }
        if (!mesh) {
          mesh = this.createAnimeCharacterMesh(profile, 0.92);
          mesh.userData = { ...mesh.userData, type: "remote-player", id: player.socketId, name: player.name, characterId: profile.id };
          mesh.userData.targetPosition = new this.THREE.Vector3(player.x, 1.08, player.z);
          mesh.userData.targetRotation = player.rotation;
          this.world.add(mesh);
          this.remotePlayers.set(player.socketId, mesh);
        }
        if (player.appearance) {
          const remoteAppearance = normalizeAppearanceRecipe(player.appearance, profile.id);
          if (mesh.userData.appearanceFingerprint !== appearanceFingerprint(remoteAppearance, profile.id)) {
            this.applyAppearanceToMesh(mesh, remoteAppearance, profile.id);
          }
        }
        mesh.userData.targetPosition.set(player.x, 1.08, player.z);
        mesh.userData.targetRotation = player.rotation;
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
        if (serverEnemy.boss) {
          enemy.userData.bossPhase = serverEnemy.bossPhase || enemy.userData.bossPhase;
          enemy.userData.shield = serverEnemy.shield ?? enemy.userData.shield;
          if (enemy.userData.weakPoint) enemy.userData.weakPoint.visible = Boolean(serverEnemy.weakPointOpen);
        }
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
        renderer: this.renderer ? this.rendererBackend.toUpperCase() : "not-started",
        authoritative: this.authoritative,
        roomCode: this.state.party.roomCode,
        saveVersion: this.savedRecord?.version || 0,
        player: {
          level: this.state.player.level,
          health: this.state.player.health,
          element: this.state.player.element,
          characterId: this.state.roster.activeId,
          characters: this.state.roster.unlocked.slice(),
          swimming: this.isSwimming,
          climbing: this.isClimbing
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

  const api = Object.freeze({ mount, unmount, inspect, GAME_ID, QUESTS, RECIPES, ELEMENT_REACTIONS, CHARACTERS });
  root.HHAstralRealms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
