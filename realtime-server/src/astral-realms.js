const GAME_ID = "astral-realms";
const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const WORLD_LIMIT = 92;
const MAX_MOVE_SPEED = 8;
const ATTACK_COOLDOWN_MS = 320;
const SKILL_COOLDOWN_MS = 2600;
const INPUT_RATE_MS = 24;
const ELEMENTS = new Set(["plasma", "cryo", "void", "nature", "quantum", "solar"]);
const CHARACTER_PROFILES = Object.freeze({
  lyra: { element: "plasma", attackScale: 1, speedScale: 1 },
  cael: { element: "cryo", attackScale: 0.92, speedScale: 1.12 },
  nyx: { element: "void", attackScale: 1.08, speedScale: 1.06 },
  sol: { element: "solar", attackScale: 1.18, speedScale: 0.94 }
});
const APPEARANCE_VERSION = 3;
const APPEARANCE_BASE_MODELS = new Set(["human-adult-a01", "human-adult-b01"]);
const APPEARANCE_SKINS = new Set(["warm-04", "neutral-03", "cool-02", "deep-05"]);
const APPEARANCE_HAIRS = new Set(["astral-layered-07", "aurora-short-02", "void-long-04", "solar-braid-03"]);
const APPEARANCE_OUTFITS = new Set(["central-jacket-02", "combat-boots-01", "aurora-suit-01", "void-coat-01"]);
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
    respawnAt: enemy.respawnAt || 0
  };
}

function makeEnemy(id, type, x, z, health, boss = false) {
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
    respawnAt: 0,
    attackAt: 0,
    targetId: ""
  };
}

function createShard(code) {
  return {
    code,
    players: new Map(),
    enemies: new Map([
      makeEnemy("aurora-wisp-1", "aurora-wisp", -45, 19, 110),
      makeEnemy("aurora-wisp-2", "aurora-wisp", -57, 8, 110),
      makeEnemy("aurora-wisp-3", "aurora-wisp", -61, 29, 110),
      makeEnemy("forge-hound-1", "forge-hound", 47, 28, 150),
      makeEnemy("forge-hound-2", "forge-hound", 62, 14, 150),
      makeEnemy("void-stalker-1", "void-stalker", -7, -56, 190),
      makeEnemy("void-stalker-2", "void-stalker", 15, -57, 190),
      makeEnemy("nexus-warden", "nexus-warden", 8, -73, 1200, true),
      makeEnemy("dungeon-stalker-1", "void-stalker", 71, -67, 190),
      makeEnemy("dungeon-stalker-2", "void-stalker", 81, -64, 190)
    ].map((enemy) => [enemy.id, enemy])),
    lastTickAt: Date.now(),
    lastSnapshotAt: 0,
    emptyAt: 0
  };
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
  const cooldown = action === "attack" ? ATTACK_COOLDOWN_MS : SKILL_COOLDOWN_MS;
  const cooldownKey = action === "attack" ? "lastAttackAt" : "lastSkillAt";
  if (now - Number(player[cooldownKey] || 0) < cooldown) return;

  const target = shard.enemies.get(clean(input.targetId, 100));
  if (!target || target.health <= 0) return;
  const range = action === "attack" ? 3.2 : action === "skill" ? 7.5 : 10;
  if (Math.hypot(target.x - player.x, target.z - player.z) > range) return;

  player[cooldownKey] = now;
  player.action = action;
  const base = action === "attack" ? 24 : action === "skill" ? 58 : 120;
  const profile = CHARACTER_PROFILES[player.characterId] || CHARACTER_PROFILES.lyra;
  let damage = Math.round(base * profile.attackScale * clamp(input.power || 1, 0.75, 1.25));
  if (target.boss) {
    target.bossPhase = target.health / target.maxHealth > 0.66 ? 1 : target.health / target.maxHealth > 0.33 ? 2 : 3;
    if (target.bossPhase >= 2 && target.shield <= 0 && action !== "attack") damage = Math.round(damage * 1.35);
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, damage);
      target.shield -= absorbed;
      damage -= absorbed;
    }
  }
  target.health = Math.max(0, target.health - damage);
  if (!target.health) target.respawnAt = now + (target.boss ? 120000 : 25000);
}

function updateEnemies(shard, dt, now) {
  shard.enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      if (enemy.respawnAt && now >= enemy.respawnAt) {
        enemy.health = enemy.maxHealth;
        enemy.x = enemy.homeX;
        enemy.z = enemy.homeZ;
        enemy.respawnAt = 0;
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
    const shard = shards.get(code) || createShard(code);
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
    maxPlayers: 4,
    transport: "socket.io",
    integrity: "server-authoritative",
    players: [...shard.players.values()].map(publicPlayer),
    enemies: [...shard.enemies.values()].map(publicEnemy)
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
          element: "plasma",
          appearance: sanitizeAppearance(payload.appearance),
          action: "idle",
          seq: 0,
          inputAt: 0,
          updatedAt: new Date().toISOString()
        };
        context.shard.players.set(socket.id, player);
      }
      if (now - player.inputAt < INPUT_RATE_MS) return done({ ok: true, throttled: true, seq: player.seq });

      player.inputAt = now;
      player.seq = Math.max(player.seq, clamp(payload.seq, 0, Number.MAX_SAFE_INTEGER));
      player.move = normalizedMove(payload.move);
      player.sprint = payload.sprint === true;
      player.rotation = clamp(payload.rotation, -Math.PI * 4, Math.PI * 4);
      player.element = ELEMENTS.has(payload.element) ? payload.element : player.element;
      if (CHARACTER_PROFILES[payload.characterId]) {
        player.characterId = payload.characterId;
        player.element = CHARACTER_PROFILES[payload.characterId].element;
      }
      if (payload.appearance && typeof payload.appearance === "object") {
        player.appearance = sanitizeAppearance(payload.appearance);
      }
      player.updatedAt = new Date().toISOString();
      applyAttack(context.shard, player, payload, now);
      done({ ok: true, seq: player.seq, integrity: "server-authoritative" });
    });

    socket.on("astral-realms:sync", (_payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const context = getContext(socket);
      if (!context) return done({ ok: false, error: "Không tìm thấy shard Astral Realms." });
      done(snapshot(context.shard));
    });

    socket.on("disconnect", () => {
      shards.forEach((shard) => {
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
        const move = player.move || { x: 0, z: 0 };
        const sprinting = player.sprint && player.stamina > 0;
        const profile = CHARACTER_PROFILES[player.characterId] || CHARACTER_PROFILES.lyra;
        const speed = (sprinting ? MAX_MOVE_SPEED : 5.2) * profile.speedScale;
        player.x = clamp(player.x + move.x * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        player.z = clamp(player.z + move.z * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        player.stamina = clamp(player.stamina + (sprinting ? -22 : 14) * dt, 0, 100);
        if (!player.action || now - Math.max(player.lastAttackAt || 0, player.lastSkillAt || 0) > 500) player.action = "idle";
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
  registerAstralRealmsRealtime
};
