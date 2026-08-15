const GAME_ID = "astral-realms";
const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const WORLD_LIMIT = 188;
const MAX_SHARD_PLAYERS = 8;
const MAX_MOVE_SPEED = 8;
const ATTACK_COOLDOWN_MS = 320;
const SKILL_COOLDOWN_MS = 2600;
const INPUT_RATE_MS = 24;
const PK_RESPAWN_MS = 4000;
const PK_PROTECTION_MS = 8000;
const PK_SAFE_RADIUS = 6.5;
const WEAPON_COMBAT_PROFILES = Object.freeze({
  sword: { range: [3.2, 7.5, 10], damage: [24, 58, 120], cooldown: [320, 2600, 7200] },
  greatsword: { range: [3.8, 7, 9], damage: [32, 72, 146], cooldown: [620, 3200, 7800] },
  dualBlade: { range: [3, 6.4, 8], damage: [20, 54, 112], cooldown: [235, 2200, 6800] },
  spear: { range: [4.8, 8, 10], damage: [27, 64, 126], cooldown: [430, 2700, 7200] },
  hammer: { range: [3.7, 7.4, 9.5], damage: [34, 78, 154], cooldown: [680, 3400, 8200] },
  shield: { range: [2.9, 5.4, 7], damage: [18, 42, 94], cooldown: [420, 3100, 7600] },
  scythe: { range: [4.2, 8.5, 11], damage: [30, 70, 142], cooldown: [510, 3000, 7800] },
  bow: { range: [18, 22, 26], damage: [25, 62, 132], cooldown: [470, 2800, 7400] },
  staff: { range: [16, 21, 25], damage: [23, 68, 138], cooldown: [520, 3000, 7600] },
  gun: { range: [17, 21, 24], damage: [22, 58, 124], cooldown: [260, 2500, 7000] },
  pistol: { range: [15, 19, 22], damage: [21, 54, 116], cooldown: [250, 2300, 6800] },
  rifle: { range: [20, 24, 28], damage: [24, 62, 132], cooldown: [290, 2600, 7200] },
  shotgun: { range: [8, 11, 14], damage: [34, 78, 148], cooldown: [760, 3400, 8000] },
  sniper: { range: [30, 34, 38], damage: [46, 92, 176], cooldown: [1100, 3900, 8800] },
  heavy: { range: [19, 23, 27], damage: [40, 88, 168], cooldown: [980, 3800, 8600] },
  unarmed: { range: [2.5, 4.8, 6.5], damage: [19, 48, 104], cooldown: [280, 2200, 6600] }
});
const ZONE_CENTERS = Object.freeze([
  ["central", 0, 0, 31], ["aurora", -51, 20, 30], ["crimson", 52, 24, 30], ["void", 2, -62, 32],
  ["sky", -122, -48, 28], ["ocean", 122, -42, 30], ["station", -118, 90, 27], ["abyss", 124, 94, 31]
]);
const HUNT_MONSTER_LIBRARY = Object.freeze([
  ["big-alien", "station", "big", false], ["big-birb", "crimson", "big", false], ["big-bluedemon", "void", "big", true],
  ["big-bunny", "sky", "big", false], ["big-cactoro", "crimson", "big", false], ["big-demon", "void", "big", true],
  ["big-dino", "abyss", "big", false], ["big-fish", "ocean", "big", false], ["big-frog", "crimson", "big", false],
  ["big-monkroose", "void", "big", false], ["big-mushroomking", "sky", "big", true], ["big-ninja", "ocean", "big", false],
  ["big-orc-skull", "station", "big", true], ["big-orc", "abyss", "big", false], ["big-tribal", "aurora", "big", false],
  ["big-yeti", "aurora", "big", true], ["blob-alien", "station", "blob", false], ["blob-birb", "sky", "blob", false],
  ["blob-cactoro", "crimson", "blob", false], ["blob-cat", "station", "blob", false], ["blob-chicken", "abyss", "blob", false],
  ["blob-dog", "aurora", "blob", false], ["blob-fish", "ocean", "blob", false], ["blob-greenblob", "void", "blob", false],
  ["blob-greenspikyblob", "sky", "blob", false], ["blob-mushnub-evolved", "ocean", "blob", false], ["blob-mushnub", "station", "blob", false],
  ["blob-ninja", "abyss", "blob", false], ["blob-orc", "aurora", "blob", false], ["blob-pigeon", "crimson", "blob", false],
  ["blob-pinkblob", "void", "blob", false], ["blob-wizard", "sky", "blob", false], ["blob-yeti", "aurora", "blob", false],
  ["flying-alpaking-evolved", "sky", "flying", false], ["flying-alpaking", "sky", "flying", false], ["flying-armabee-evolved", "sky", "flying", false],
  ["flying-armabee", "sky", "flying", false], ["flying-demon", "void", "flying", false], ["flying-dragon-evolved", "sky", "flying", true],
  ["flying-dragon", "sky", "flying", false], ["flying-ghost-skull", "void", "flying", true], ["flying-ghost", "void", "flying", false],
  ["flying-glub-evolved", "sky", "flying", false], ["flying-glub", "sky", "flying", false], ["flying-goleling-evolved", "sky", "flying", true],
  ["flying-goleling", "sky", "flying", false], ["flying-hywirl", "sky", "flying", false], ["flying-pigeon", "sky", "flying", false],
  ["flying-squidle", "ocean", "flying", false], ["flying-tribal", "sky", "flying", false]
]);
const HUNT_ZONE_PROFILES = Object.freeze({
  aurora: ["aurora-wisp", 110], crimson: ["forge-hound", 150], void: ["void-stalker", 190], sky: ["sky-sentinel", 215],
  ocean: ["ocean-siren", 230], station: ["station-drone", 250], abyss: ["abyss-herald", 300]
});
const ELEMENTS = new Set(["plasma", "cryo", "void", "nature", "quantum", "solar"]);
const CHARACTER_PROFILES = Object.freeze({
  lyra: { element: "plasma", attackScale: 1, speedScale: 1, weaponClass: "sword" },
  cael: { element: "cryo", attackScale: 0.92, speedScale: 1.12, weaponClass: "rifle" },
  nyx: { element: "void", attackScale: 1.08, speedScale: 1.06, weaponClass: "dualBlade" },
  sol: { element: "solar", attackScale: 1.18, speedScale: 0.94, weaponClass: "greatsword" }
});
const APPEARANCE_VERSION = 3;
const APPEARANCE_BASE_MODELS = new Set(["human-adult-a01", "human-adult-b01"]);
const APPEARANCE_SKINS = new Set(["warm-04", "neutral-03", "cool-02", "deep-05"]);
const APPEARANCE_HAIRS = new Set(["astral-layered-07", "aurora-short-02", "void-long-04", "solar-braid-03"]);
const APPEARANCE_OUTFITS = new Set(["central-jacket-02", "combat-boots-01", "aurora-suit-01", "void-coat-01"]);
const SHARD_ZONES = Object.freeze(["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"]);
const SHARD_FACTIONS = new Set(["h-central", "aurora-keepers", "crimson-union", "void-cult", "astral-researchers", "free-travelers"]);
const APPEARANCE_MORPHS = new Set([
  "headLength", "foreheadHeight", "cheekboneWidth", "cheekFullness", "jawWidth", "jawAngle", "chinLength", "faceFullness",
  "eyeSize", "eyeSpacing", "eyeDepth", "upperLid", "lowerLid", "eyeAngle", "irisSize", "pupilSize", "eyeReflection", "eyeLeft", "eyeRight",
  "browShape", "browThickness", "browHeight", "browAngle",
  "noseBridge", "noseLength", "noseTip", "noseWing", "nostrilWidth", "noseProjection", "noseCurve",
  "mouthWidth", "upperLip", "lowerLip", "mouthCorner", "mouthProjection", "teethShape", "teethSize", "philtrum", "smileLine",
  "earSize", "earAngle", "earProtrusion", "earLobe", "earLeft", "earRight",
  "neckLength", "neckWidth", "shoulderWidth", "shoulderSlope", "clavicle",
  "armLength", "upperArm", "forearm", "handSize", "fingerLength", "armLeft", "armRight",
  "legLength", "thighSize", "calfSize", "kneeSize", "footSize", "legLeft", "legRight",
  "height", "torsoLength", "backWidth", "waist", "belly", "legTorsoRatio", "ribcage", "posture",
  "chestSize", "chestWidth", "chestFullness", "chestPosition", "chestSymmetry",
  "hipWidth", "gluteFullness", "gluteProjection", "waistHipRatio", "hipTilt",
  "muscle", "bodyFat", "tone", "abs", "bodyMass", "softness", "weightDistribution",
  "blink", "smile", "sad", "angry", "surprised", "pain", "cheekPuff", "squint", "mouthA", "mouthO"
]);

function sanitizeAppearance(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const morphs = {};
  if (source.morphs && typeof source.morphs === "object") {
    APPEARANCE_MORPHS.forEach((key) => {
      const value = Number(source.morphs[key]);
      if (Number.isFinite(value)) morphs[key] = clamp(value, 0, 1);
    });
  }
  const safeHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
  return {
    appearanceVersion: APPEARANCE_VERSION,
    baseModel: APPEARANCE_BASE_MODELS.has(source.baseModel) ? source.baseModel : "human-adult-a01",
    bodyPreset: clean(source.bodyPreset, 24) || "balanced",
    style: source.style === "human-cinematic" ? "human-cinematic" : "anime-realistic",
    symmetry: source.symmetry !== false,
    morphs,
    skin: APPEARANCE_SKINS.has(source.skin) ? source.skin : "warm-04",
    skinColor: safeHex(source.skinColor, "#ffd5c5"),
    eyeColor: safeHex(source.eyeColor, "#63efff"),
    hair: APPEARANCE_HAIRS.has(source.hair) ? source.hair : "astral-layered-07",
    hairColor: safeHex(source.hairColor, "#dffbff"),
    outfit: Array.isArray(source.outfit)
      ? [...new Set(source.outfit.filter((id) => APPEARANCE_OUTFITS.has(id)))].slice(0, 4)
      : ["central-jacket-02", "combat-boots-01"]
  };
}

function clamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function clean(value, max = 80) {
  return String(value || "").trim().slice(0, max);
}

function roomChannel(code) {
  return `game:center:${clean(code, 16).toUpperCase()}`;
}

function publicPlayer(player) {
  return {
    id: player.id,
    socketId: player.socketId,
    name: player.name,
    characterId: player.characterId,
    x: Number(player.x.toFixed(3)),
    z: Number(player.z.toFixed(3)),
    rotation: Number(player.rotation.toFixed(3)),
    health: Math.round(player.health),
    maxHealth: player.maxHealth,
    stamina: Math.round(player.stamina),
    element: player.element,
    appearance: player.appearance,
    action: player.action,
    animationState: player.action || (Math.hypot(player.move?.x || 0, player.move?.z || 0) > 0.05 ? "locomotion" : "idle"),
    normalizedTime: 0,
    locomotionVector: normalizedMove(player.move),
    facingYaw: Number(player.rotation || 0),
    aimPitch: 0,
    weaponId: clean(player.weaponClass || "unarmed", 80),
    actionSequenceId: clean(player.lastActionSequenceId, 100),
    combatState: player.action || "ready",
    expressionId: "neutral",
    serverTimestamp: Date.parse(player.updatedAt) || Date.now(),
    hunterPoints: Math.round(player.hunterPoints || 0),
    pk: {
      enabled: player.pk?.enabled === true,
      safeZone: player.pk?.safeZone === true,
      kills: Number(player.pk?.kills || 0),
      assists: Number(player.pk?.assists || 0),
      deaths: Number(player.pk?.deaths || 0),
      rating: Number(player.pk?.rating || 1000),
      protectionUntil: Number(player.pk?.protectionUntil || 0),
      duelWith: clean(player.pk?.duelWith, 100)
    },
    seq: player.seq,
    updatedAt: player.updatedAt
  };
}

function publicEnemy(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    x: Number(enemy.x.toFixed(3)),
    z: Number(enemy.z.toFixed(3)),
    health: Math.round(enemy.health),
    maxHealth: enemy.maxHealth,
    boss: enemy.boss,
    bossPhase: enemy.bossPhase,
    shield: Math.round(enemy.shield || 0),
    maxShield: enemy.maxShield || 0,
    weakPointOpen: Boolean(enemy.boss && enemy.bossPhase >= 2 && enemy.shield <= 0),
    defeated: enemy.health <= 0,
    respawnAt: enemy.respawnAt || 0,
    monsterId: enemy.monsterId || "",
    elite: enemy.elite === true,
    defeatedBy: enemy.defeatedBy || "",
    defeatEventId: enemy.defeatEventId || ""
  };
}

function makeEnemy(id, type, x, z, health, boss = false, options = {}) {
  return {
    id,
    type,
    x,
    z,
    homeX: x,
    homeZ: z,
    health,
    maxHealth: health,
    boss,
    bossPhase: boss ? 1 : 0,
    shield: boss ? 320 : 0,
    maxShield: boss ? 320 : 0,
    monsterId: clean(options.monsterId, 100),
    elite: options.elite === true,
    zoneId: clean(options.zoneId, 24) || shardZoneAt(x, z),
    defeatedBy: "",
    defeatEventId: "",
    respawnAt: 0,
    attackAt: 0,
    targetId: ""
  };
}

function createMonsterHuntEnemies() {
  const groups = new Map();
  HUNT_MONSTER_LIBRARY.forEach((entry) => {
    if (!groups.has(entry[1])) groups.set(entry[1], []);
    groups.get(entry[1]).push(entry);
  });
  const enemies = [];
  groups.forEach((entries, zoneId) => {
    entries.sort((left, right) => left[0].localeCompare(right[0]));
    const zone = ZONE_CENTERS.find(([id]) => id === zoneId);
    const [type, baseHealth] = HUNT_ZONE_PROFILES[zoneId];
    entries.forEach(([monsterId, , category, boss], index) => {
      const angle = (index / Math.max(1, entries.length)) * Math.PI * 2 + ((monsterId.length % 7) * 0.11);
      const radius = Math.min(zone[3] - 6, 10 + (index % 3) * 5.2);
      const x = zone[1] + Math.cos(angle) * radius;
      const z = zone[2] + Math.sin(angle) * radius;
      const chapterScale = 1 + Math.max(0, ZONE_CENTERS.findIndex(([id]) => id === zoneId)) * 0.12;
      const classScale = boss ? 3.2 : category === "big" ? 1.65 : category === "flying" ? 1.18 : 1;
      enemies.push(makeEnemy(`hunt-${monsterId}`, type, x, z, Math.round(baseHealth * chapterScale * classScale), boss, {
        monsterId, elite: category === "big", zoneId
      }));
    });
  });
  HUNT_MONSTER_LIBRARY.filter((entry) => !entry[3]).slice(0, 3).forEach(([monsterId, , category], index) => {
    enemies.push(makeEnemy(`hunter-trial-${index + 1}`, "aurora-wisp", 12 + index * 5, -13 - (index % 2) * 5, 105, false, {
      monsterId, elite: category === "big", zoneId: "central"
    }));
  });
  return enemies;
}

function createWorldState() {
  return {
    version: 1,
    zones: Object.fromEntries(SHARD_ZONES.map((id) => [id, {
      id,
      discovered: id === "central",
      restored: id === "central",
      core: id === "central" ? "stable" : id === "void" ? "sealed" : id === "crimson" ? "corrupted" : "unstable",
      resources: 100,
      updatedAt: new Date().toISOString()
    }])),
    activeEvent: null,
    eventLog: []
  };
}

function createShard(code, requestedMaxPlayers = 4) {
  return {
    code,
    maxPlayers: clamp(requestedMaxPlayers, 2, MAX_SHARD_PLAYERS),
    players: new Map(),
    enemies: new Map([
      makeEnemy("aurora-wisp-1", "aurora-wisp", -45, 19, 110),
      makeEnemy("aurora-wisp-2", "aurora-wisp", -57, 8, 110),
      makeEnemy("aurora-wisp-3", "aurora-wisp", -61, 29, 110),
      makeEnemy("forge-hound-1", "forge-hound", 47, 28, 150),
      makeEnemy("forge-hound-2", "forge-hound", 62, 14, 150),
      makeEnemy("void-stalker-1", "void-stalker", -7, -56, 190),
      makeEnemy("void-stalker-2", "void-stalker", 15, -57, 190),
      makeEnemy("sky-sentinel-1", "sky-sentinel", -116, -43, 210),
      makeEnemy("sky-sentinel-2", "sky-sentinel", -132, -53, 210),
      makeEnemy("ocean-siren-1", "ocean-siren", 114, -36, 225),
      makeEnemy("ocean-siren-2", "ocean-siren", 132, -48, 225),
      makeEnemy("station-drone-1", "station-drone", -110, 84, 245),
      makeEnemy("station-drone-2", "station-drone", -128, 96, 245),
      makeEnemy("abyss-herald-1", "abyss-herald", 115, 88, 290),
      makeEnemy("abyss-herald-2", "abyss-herald", 134, 100, 290),
      makeEnemy("nexus-warden", "nexus-warden", 8, -73, 1200, true),
      makeEnemy("dungeon-stalker-1", "void-stalker", 71, -67, 190),
      makeEnemy("dungeon-stalker-2", "void-stalker", 81, -64, 190),
      ...createMonsterHuntEnemies()
    ].map((enemy) => [enemy.id, enemy])),
    world: createWorldState(),
    duelInvites: new Map(),
    processedCombatEvents: new Map(),
    combatAudit: [],
    lastTickAt: Date.now(),
    lastSnapshotAt: 0,
    emptyAt: 0
  };
}

function applyWorldAction(shard, player, action = {}) {
  const type = clean(action.type, 24);
  if (!["start", "resolve", "pause"].includes(type)) return;
  if (type === "start") {
    if (shard.world.activeEvent) return;
    const zoneId = SHARD_ZONES.includes(action.zoneId) && action.zoneId !== "central" ? action.zoneId : "aurora";
    const factionId = SHARD_FACTIONS.has(action.factionId) ? action.factionId : "h-central";
    shard.world.activeEvent = {
      id: `shard-event-${Date.now().toString(36)}`,
      title: clean(action.title || `Giải phóng lõi ${zoneId}`, 120),
      detail: clean(action.detail || "Sự kiện do người chơi trong shard khởi tạo.", 240),
      zoneId,
      factionId,
      startedBy: player.id,
      progress: 0,
      target: factionId === "h-central" ? 3 : 2,
      startedAt: new Date().toISOString()
    };
    shard.world.eventLog = [...shard.world.eventLog, { ...shard.world.activeEvent, type: "started" }].slice(-40);
  } else if (type === "resolve" && shard.world.activeEvent && Number(shard.world.activeEvent.progress || 0) >= Number(shard.world.activeEvent.target || 3)) {
    const event = shard.world.activeEvent;
    const zone = shard.world.zones[event.zoneId];
    if (zone) {
      zone.discovered = true;
      zone.restored = true;
      zone.core = "restored";
      zone.resources = Math.min(100, Number(zone.resources || 0) + 20);
      zone.updatedAt = new Date().toISOString();
    }
    shard.world.eventLog = [...shard.world.eventLog, {
      id: `shard-event-${Date.now().toString(36)}`,
      type: "resolved",
      title: `Đã phục hồi ${event.zoneId}`,
      detail: `Sự kiện được ${player.name} xác nhận trong shard.`,
      zoneId: event.zoneId,
      factionId: event.factionId,
      createdAt: new Date().toISOString()
    }].slice(-40);
    shard.world.activeEvent = null;
  } else if (type === "pause") {
    shard.world.eventLog = [...shard.world.eventLog, {
      id: `shard-event-${Date.now().toString(36)}`,
      type: "paused",
      title: "Sự kiện được tạm dừng",
      detail: "Không thay đổi phần thưởng hoặc trạng thái lõi.",
      zoneId: shard.world.activeEvent?.zoneId || "",
      createdAt: new Date().toISOString()
    }].slice(-40);
    shard.world.activeEvent = null;
  }
  shard.world.version += 1;
}

function shardZoneAt(x, z) {
  let best = ["central", Infinity];
  ZONE_CENTERS.forEach(([id, cx, cz, radius]) => {
    const distance = Math.hypot(x - cx, z - cz);
    if (distance <= radius && distance < best[1]) best = [id, distance];
  });
  return best[0];
}

function isPkSafePosition(x, z) {
  const central = ZONE_CENTERS[0];
  if (Math.hypot(x - central[1], z - central[2]) <= central[3]) return true;
  return ZONE_CENTERS.slice(1).some(([, cx, cz]) => Math.hypot(x - cx, z - cz) <= PK_SAFE_RADIUS);
}

function publicPk(player) {
  return publicPlayer(player).pk;
}

function appendCombatAudit(shard, event) {
  shard.combatAudit = [...shard.combatAudit, {
    id: clean(event.id, 120),
    type: clean(event.type, 32),
    actorId: clean(event.actorId, 100),
    targetId: clean(event.targetId, 100),
    damage: Math.max(0, Math.round(event.damage || 0)),
    createdAt: new Date().toISOString()
  }].slice(-100);
}

function safeIdentity(socket, room) {
  const member = room?.members?.get(socket.id);
  const user = member?.user || socket.user || {};
  return {
    id: clean(user.id || user._id || socket.id, 100),
    name: clean(user.name || user.displayName || "Nhà du hành HH", 48)
  };
}

function normalizedMove(input = {}) {
  const x = clamp(input.x, -1, 1);
  const z = clamp(input.z, -1, 1);
  const length = Math.hypot(x, z);
  if (length <= 1) return { x, z };
  return { x: x / length, z: z / length };
}

function nearestLivingPlayer(shard, enemy) {
  let winner = null;
  let distance = Infinity;
  shard.players.forEach((player) => {
    if (player.health <= 0) return;
    const nextDistance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
    if (nextDistance < distance) {
      distance = nextDistance;
      winner = player;
    }
  });
  return { player: winner, distance };
}

function applyAttack(shard, player, input, now) {
  const action = clean(input.action, 24);
  if (!["attack", "skill", "ultimate"].includes(action)) return;
  const actionSequenceId = clean(input.actionSequenceId, 100);
  const combatMarker = clean(input.combatMarker, 32);
  if (!actionSequenceId || combatMarker !== "active_start") return;
  if (actionSequenceId && shard.processedCombatEvents.has(`sequence:${player.socketId}:${actionSequenceId}`)) return;
  const weaponClass = WEAPON_COMBAT_PROFILES[clean(input.weaponClass, 24)] ? clean(input.weaponClass, 24) : "sword";
  if (weaponClass !== player.weaponClass) return;
  const combat = WEAPON_COMBAT_PROFILES[weaponClass];
  const actionIndex = action === "attack" ? 0 : action === "skill" ? 1 : 2;
  const cooldown = combat.cooldown[actionIndex];
  const cooldownKey = action === "attack" ? "lastAttackAt" : action === "skill" ? "lastSkillAt" : "lastUltimateAt";
  if (now - Number(player[cooldownKey] || 0) < cooldown) return;

  const targetId = clean(input.targetId, 100);
  const enemy = shard.enemies.get(targetId);
  const targetPlayer = shard.players.get(targetId) || [...shard.players.values()].find((candidate) => candidate.id === targetId);
  const target = enemy || targetPlayer;
  if (!target || target === player || target.health <= 0) return;
  const range = combat.range[actionIndex];
  if (Math.hypot(target.x - player.x, target.z - player.z) > range) return;
  const eventId = `${player.socketId}:${actionSequenceId || player.seq}:${action}:${targetId}`;
  if (shard.processedCombatEvents.has(eventId)) return;
  if (targetPlayer) {
    const consent = player.pk?.enabled === true && targetPlayer.pk?.enabled === true;
    const duel = player.pk?.duelWith === targetPlayer.socketId && targetPlayer.pk?.duelWith === player.socketId;
    if ((!consent && !duel) || isPkSafePosition(player.x, player.z) || isPkSafePosition(targetPlayer.x, targetPlayer.z)) return;
    if (now < Number(player.pk?.protectionUntil || 0) || now < Number(targetPlayer.pk?.protectionUntil || 0)) return;
  }
  if (action === "ultimate" && Number(player.ultimate || 0) < 100) return;

  player[cooldownKey] = now;
  player.action = action;
  player.weaponClass = weaponClass;
  player.lastActionSequenceId = actionSequenceId;
  if (actionSequenceId) shard.processedCombatEvents.set(`sequence:${player.socketId}:${actionSequenceId}`, now);
  const profile = CHARACTER_PROFILES[player.characterId] || CHARACTER_PROFILES.lyra;
  let damage = Math.round(combat.damage[actionIndex] * profile.attackScale * (targetPlayer ? 0.72 : 1));
  shard.processedCombatEvents.set(eventId, now);
  if (action === "ultimate") player.ultimate = 0;
  else player.ultimate = clamp(Number(player.ultimate || 0) + (action === "attack" ? 8 : 15), 0, 100);

  if (enemy) {
    if (enemy.boss) {
      enemy.bossPhase = enemy.health / enemy.maxHealth > 0.66 ? 1 : enemy.health / enemy.maxHealth > 0.33 ? 2 : 3;
      if (enemy.bossPhase >= 2 && enemy.shield <= 0 && action !== "attack") damage = Math.round(damage * 1.35);
      if (enemy.shield > 0) {
        const absorbed = Math.min(enemy.shield, damage);
        enemy.shield -= absorbed;
        damage -= absorbed;
      }
    }
    enemy.health = Math.max(0, enemy.health - damage);
    if (!enemy.health) {
      enemy.respawnAt = now + (enemy.boss ? 120000 : 25000);
      enemy.defeatedBy = player.socketId;
      enemy.defeatEventId = eventId;
      player.hunterPoints = Math.max(0, Number(player.hunterPoints || 0) + (enemy.boss ? 700 : enemy.elite ? 260 : 110));
      const event = shard.world.activeEvent;
      if (event && event.zoneId === shardZoneAt(enemy.x, enemy.z)) {
        event.progress = Math.min(Number(event.target || 3), Number(event.progress || 0) + 1);
        shard.world.eventLog = [...shard.world.eventLog, {
          id: `shard-event-${Date.now().toString(36)}`,
          type: "progress",
          title: `${event.title} · ${event.progress}/${event.target}`,
          detail: `Sinh vật ${enemy.type} đã bị hạ.`,
          zoneId: event.zoneId,
          createdAt: new Date().toISOString()
        }].slice(-40);
        shard.world.version += 1;
      }
    }
  } else {
    targetPlayer.lastDamagers ||= {};
    targetPlayer.lastDamagers[player.socketId] = now;
    targetPlayer.health = Math.max(0, targetPlayer.health - damage);
    targetPlayer.action = "hit";
    appendCombatAudit(shard, { id: eventId, type: targetPlayer.health ? "pk-hit" : "pk-kill", actorId: player.socketId, targetId: targetPlayer.socketId, damage });
    if (!targetPlayer.health) {
      targetPlayer.respawnAt = now + PK_RESPAWN_MS;
      targetPlayer.pk.deaths += 1;
      targetPlayer.pk.rating = Math.max(0, targetPlayer.pk.rating - 12);
      player.pk.kills += 1;
      player.pk.rating += 16;
      const transfer = Math.min(50, Math.max(0, Math.round(Number(targetPlayer.hunterPoints || 0) * 0.05)));
      targetPlayer.hunterPoints = Math.max(0, Number(targetPlayer.hunterPoints || 0) - transfer);
      player.hunterPoints = Math.max(0, Number(player.hunterPoints || 0) + transfer);
      Object.entries(targetPlayer.lastDamagers).forEach(([socketId, at]) => {
        if (socketId === player.socketId || now - Number(at) > 10000) return;
        const assistant = shard.players.get(socketId);
        if (assistant) assistant.pk.assists += 1;
      });
      targetPlayer.lastDamagers = {};
    }
  }
}

function updateEnemies(shard, dt, now) {
  shard.enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      if (enemy.respawnAt && now >= enemy.respawnAt) {
        enemy.health = enemy.maxHealth;
        enemy.x = enemy.homeX;
        enemy.z = enemy.homeZ;
        enemy.respawnAt = 0;
        enemy.defeatedBy = "";
        enemy.defeatEventId = "";
        enemy.bossPhase = enemy.boss ? 1 : 0;
        enemy.shield = enemy.maxShield || 0;
      }
      return;
    }

    const nearest = nearestLivingPlayer(shard, enemy);
    const target = nearest.player;
    if (!target || nearest.distance > (enemy.boss ? 24 : 15)) {
      const homeDistance = Math.hypot(enemy.homeX - enemy.x, enemy.homeZ - enemy.z);
      if (homeDistance > 0.25) {
        enemy.x += ((enemy.homeX - enemy.x) / homeDistance) * dt * 1.5;
        enemy.z += ((enemy.homeZ - enemy.z) / homeDistance) * dt * 1.5;
      }
      return;
    }

    enemy.targetId = target.id;
    if (nearest.distance > 2.2) {
      const phaseSpeed = enemy.boss && enemy.bossPhase === 3 ? 2.9 : enemy.boss && enemy.bossPhase === 2 ? 2.5 : enemy.boss ? 2.1 : 2.8;
      const speed = phaseSpeed;
      enemy.x += ((target.x - enemy.x) / nearest.distance) * dt * speed;
      enemy.z += ((target.z - enemy.z) / nearest.distance) * dt * speed;
    } else if (now - enemy.attackAt >= (enemy.boss ? 1300 : 900)) {
      enemy.attackAt = now;
      target.health = Math.max(0, target.health - (enemy.boss ? (enemy.bossPhase === 3 ? 28 : enemy.bossPhase === 2 ? 25 : 22) : 11));
      target.action = "hit";
    }
  });
}

function registerAstralRealmsRealtime({ io, gameCenter } = {}) {
  if (!io || !gameCenter?.rooms || !gameCenter?.socketRoomById) {
    throw new Error("Astral Realms requires the shared game-room service.");
  }

  const shards = new Map();
  const getContext = (socket) => {
    const code = gameCenter.socketRoomById.get(socket.id);
    const room = code ? gameCenter.rooms.get(code) : null;
    if (!room || room.gameId !== GAME_ID || !room.members?.has(socket.id)) return null;
    const shard = shards.get(code) || createShard(code, room.maxPlayers);
    shards.set(code, shard);
    return { code, room, shard };
  };

  const snapshot = (shard) => ({
    ok: true,
    gameId: GAME_ID,
    room: shard.code,
    tick: Date.now(),
    serverTime: new Date().toISOString(),
    mode: "free-small-shard",
    maxPlayers: shard.maxPlayers,
    transport: "socket.io",
    integrity: "server-authoritative",
    players: [...shard.players.values()].map(publicPlayer),
    enemies: [...shard.enemies.values()].map(publicEnemy),
    combat: {
      policy: "opt-in-server-authoritative",
      safeZoneRadius: PK_SAFE_RADIUS,
      recent: shard.combatAudit.slice(-20)
    },
    world: {
      version: shard.world.version,
      zones: shard.world.zones,
      activeEvent: shard.world.activeEvent,
      eventLog: shard.world.eventLog.slice(-20)
    }
  });

  io.on("connection", (socket) => {
    socket.on("astral-realms:input", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const context = getContext(socket);
      if (!context) return done({ ok: false, error: "Bạn chưa ở trong phòng HH Astral Realms." });
      const now = Date.now();
      const identity = safeIdentity(socket, context.room);
      let player = context.shard.players.get(socket.id);
      if (!player) {
        player = {
          id: identity.id,
          socketId: socket.id,
          name: identity.name,
          characterId: "lyra",
          x: clamp(payload.spawn?.x, -WORLD_LIMIT, WORLD_LIMIT),
          z: clamp(payload.spawn?.z, -WORLD_LIMIT, WORLD_LIMIT),
          rotation: 0,
          health: 100,
          maxHealth: 100,
          stamina: 100,
          ultimate: 0,
          hunterPoints: 0,
          element: "plasma",
          weaponClass: CHARACTER_PROFILES.lyra.weaponClass,
          appearance: sanitizeAppearance(payload.appearance),
          action: "idle",
          respawnAt: 0,
          lastDamagers: {},
          pk: { enabled: false, safeZone: true, kills: 0, assists: 0, deaths: 0, rating: 1000, protectionUntil: now + PK_PROTECTION_MS, duelWith: "" },
          seq: 0,
          inputAt: 0,
          updatedAt: new Date().toISOString()
        };
        context.shard.players.set(socket.id, player);
      }
      if (now - player.inputAt < INPUT_RATE_MS) return done({ ok: true, throttled: true, seq: player.seq });

      player.inputAt = now;
      player.pk.safeZone = isPkSafePosition(player.x, player.z);
      player.seq = Math.max(player.seq, clamp(payload.seq, 0, Number.MAX_SAFE_INTEGER));
      player.move = normalizedMove(payload.move);
      player.sprint = payload.sprint === true;
      player.rotation = clamp(payload.rotation, -Math.PI * 4, Math.PI * 4);
      player.element = ELEMENTS.has(payload.element) ? payload.element : player.element;
      if (CHARACTER_PROFILES[payload.characterId]) {
        if (player.characterId !== payload.characterId) player.weaponClass = CHARACTER_PROFILES[payload.characterId].weaponClass;
        player.characterId = payload.characterId;
        player.element = CHARACTER_PROFILES[payload.characterId].element;
      }
      const equipWeaponClass = clean(payload.equipWeaponClass, 24);
      const equipSequenceId = clean(payload.equipSequenceId, 100);
      if (equipSequenceId && WEAPON_COMBAT_PROFILES[equipWeaponClass] && !context.shard.processedCombatEvents.has(`equip:${socket.id}:${equipSequenceId}`)) {
        player.weaponClass = equipWeaponClass;
        context.shard.processedCombatEvents.set(`equip:${socket.id}:${equipSequenceId}`, now);
      }
      if (payload.appearance && typeof payload.appearance === "object") {
        player.appearance = sanitizeAppearance(payload.appearance);
      }
      if (payload.worldAction && typeof payload.worldAction === "object") {
        applyWorldAction(context.shard, player, payload.worldAction);
      }
      player.updatedAt = new Date().toISOString();
      applyAttack(context.shard, player, payload, now);
      done({ ok: true, seq: player.seq, integrity: "server-authoritative" });
    });

    socket.on("astral-realms:pk", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const context = getContext(socket);
      const player = context?.shard.players.get(socket.id);
      if (!context || !player) return done({ ok: false, error: "Hãy vào shard và gửi trạng thái nhân vật trước." });
      const action = clean(payload.action, 24);
      const targetId = clean(payload.targetId, 100);
      if (action === "toggle") {
        const enabled = payload.enabled === true;
        player.pk.enabled = enabled;
        if (!enabled) {
          const other = player.pk.duelWith ? context.shard.players.get(player.pk.duelWith) : null;
          if (other) other.pk.duelWith = "";
          player.pk.duelWith = "";
        }
        appendCombatAudit(context.shard, { id: `pk-toggle:${socket.id}:${Date.now()}`, type: enabled ? "pk-enable" : "pk-disable", actorId: socket.id });
        return done({ ok: true, pk: publicPk(player), message: enabled ? "PK đã bật; chỉ người đã đồng ý mới có thể giao chiến." : "PK đã tắt." });
      }
      const target = context.shard.players.get(targetId);
      if (!target || target === player) return done({ ok: false, error: "Không tìm thấy người chơi PK hợp lệ." });
      if (action === "invite") {
        if (isPkSafePosition(player.x, player.z) || isPkSafePosition(target.x, target.z)) return done({ ok: false, error: "Không thể mời PK trong Safe Zone." });
        context.shard.duelInvites.set(target.socketId, { fromId: player.socketId, expiresAt: Date.now() + 30000 });
        io.to(target.socketId).emit("astral-realms:pk-event", { type: "invite", fromId: player.socketId, fromName: player.name });
        return done({ ok: true, message: "Đã gửi lời mời PK; chờ người chơi xác nhận." });
      }
      const invite = context.shard.duelInvites.get(socket.id);
      if (action === "accept") {
        if (!invite || invite.fromId !== target.socketId || invite.expiresAt < Date.now()) return done({ ok: false, error: "Lời mời PK đã hết hạn." });
        if (isPkSafePosition(player.x, player.z) || isPkSafePosition(target.x, target.z)) return done({ ok: false, error: "Hai người phải rời Safe Zone." });
        player.pk.enabled = true;
        target.pk.enabled = true;
        player.pk.duelWith = target.socketId;
        target.pk.duelWith = player.socketId;
        context.shard.duelInvites.delete(socket.id);
        io.to(target.socketId).emit("astral-realms:pk-event", { type: "accepted", message: `${player.name} đã chấp nhận PK.` });
        return done({ ok: true, pk: publicPk(player), message: "Đấu PK đã bắt đầu; server đang xác thực từng hit." });
      }
      if (action === "decline") {
        context.shard.duelInvites.delete(socket.id);
        io.to(target.socketId).emit("astral-realms:pk-event", { type: "declined", message: `${player.name} đã từ chối lời mời PK.` });
        return done({ ok: true, pk: publicPk(player), message: "Đã từ chối lời mời PK." });
      }
      done({ ok: false, error: "Thao tác PK không hợp lệ." });
    });

    socket.on("astral-realms:sync", (_payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const context = getContext(socket);
      if (!context) return done({ ok: false, error: "Không tìm thấy shard Astral Realms." });
      done(snapshot(context.shard));
    });

    socket.on("disconnect", () => {
      shards.forEach((shard) => {
        shard.duelInvites.delete(socket.id);
        shard.duelInvites.forEach((invite, targetId) => {
          if (invite.fromId === socket.id) shard.duelInvites.delete(targetId);
        });
        shard.players.forEach((player) => {
          if (player.pk?.duelWith === socket.id) player.pk.duelWith = "";
        });
        if (shard.players.delete(socket.id) && !shard.players.size) shard.emptyAt = Date.now();
      });
    });
  });

  const timer = setInterval(() => {
    const now = Date.now();
    shards.forEach((shard, code) => {
      if (!gameCenter.rooms.has(code) || (shard.emptyAt && now - shard.emptyAt > 120000)) {
        shards.delete(code);
        return;
      }
      const dt = Math.min(0.1, Math.max(0.001, (now - shard.lastTickAt) / 1000));
      shard.lastTickAt = now;
      shard.players.forEach((player) => {
        if (player.health <= 0) {
          if (player.respawnAt && now >= player.respawnAt) {
            player.health = player.maxHealth;
            player.stamina = 100;
            player.x = 0;
            player.z = 5;
            player.respawnAt = 0;
            player.action = "idle";
            player.pk.protectionUntil = now + PK_PROTECTION_MS;
            player.pk.safeZone = true;
          }
          return;
        }
        const move = player.move || { x: 0, z: 0 };
        const sprinting = player.sprint && player.stamina > 0;
        const profile = CHARACTER_PROFILES[player.characterId] || CHARACTER_PROFILES.lyra;
        const speed = (sprinting ? MAX_MOVE_SPEED : 5.2) * profile.speedScale;
        player.x = clamp(player.x + move.x * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        player.z = clamp(player.z + move.z * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        player.pk.safeZone = isPkSafePosition(player.x, player.z);
        player.stamina = clamp(player.stamina + (sprinting ? -22 : 14) * dt, 0, 100);
        if (!player.action || now - Math.max(player.lastAttackAt || 0, player.lastSkillAt || 0) > 500) player.action = "idle";
      });
      shard.duelInvites.forEach((invite, targetId) => {
        if (invite.expiresAt < now) shard.duelInvites.delete(targetId);
      });
      shard.processedCombatEvents.forEach((createdAt, eventId) => {
        if (now - createdAt > 15000) shard.processedCombatEvents.delete(eventId);
      });
      updateEnemies(shard, dt, now);
      if (now - shard.lastSnapshotAt >= SNAPSHOT_MS) {
        shard.lastSnapshotAt = now;
        io.to(roomChannel(code)).volatile.emit("astral-realms:snapshot", snapshot(shard));
      }
    });
  }, TICK_MS);
  timer.unref?.();

  return {
    shards,
    close() {
      clearInterval(timer);
      shards.clear();
    }
  };
}

module.exports = {
  GAME_ID,
  MAX_MOVE_SPEED,
  ATTACK_COOLDOWN_MS,
  registerAstralRealmsRealtime,
  _test: { applyAttack, createShard, createMonsterHuntEnemies, isPkSafePosition, publicPlayer, WEAPON_COMBAT_PROFILES }
};
