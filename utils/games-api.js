const { ObjectId } = require("mongodb");
const { bodyOf, clean, currentUser, publicUser, setCors } = require("../utils/platform");

const memory = globalThis.__HH_GAME_CENTER_MEMORY__ || {
  dailyRewards: new Map(),
  friends: new Map(),
  idempotency: new Map(),
  presence: new Map(),
  profiles: new Map(),
  progress: new Map(),
  saves: new Map(),
  scores: new Map(),
  versions: new Map(),
  events: []
};
globalThis.__HH_GAME_CENTER_MEMORY__ = memory;

const MAX_JSON = 128 * 1024;
const MAX_SAVE_SLOTS = 3;
const MAX_SCORE_DELTA = 5000;
const SAVE_SLOTS = new Set(["main", "autosave", "checkpoint", "slot1", "slot2", "slot3"]);
const SECRET_KEYS = /password|token|secret|authorization|cookie|api[-_]?key|private[-_]?key/i;
const SERVER_DAILY_REWARD = Object.freeze({ xp: 250, coins: 100, items: ["daily-cache"] });
const DEFAULT_GAMES = Object.freeze([
  "astra-hh",
  "neon-drift",
  "galaxy-defense",
  "star-colony",
  "cipher-run",
  "asteroid-miner",
  "rhythm-reactor",
  "quiz-arena",
  "creative-sandbox",
  "space-chess",
  "survival-orbit",
  "galaxy-farm",
  "space-fishing",
  "mecha-arena",
  "planet-builder",
  "alien-pet",
  "dungeon-stars",
  "cosmic-card-battle",
  "astro-tycoon",
  "space-runner",
  "black-hole-escape",
  "nebula-puzzle",
  "boss-rush",
  "hh-astra-mmo"
]);

function number(value, min = 0, max = 999999999, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function jsonSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value || {}), "utf8");
  } catch {
    return MAX_JSON + 1;
  }
}

function safeObject(value, maxBytes = MAX_JSON) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (jsonSize(value) > maxBytes) {
    const error = new Error("Dữ liệu game vượt giới hạn cho phép.");
    error.statusCode = 413;
    throw error;
  }
  return value;
}

function stripSecrets(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => stripSecrets(item, depth + 1));
  if (typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SECRET_KEYS.test(key))
    .slice(0, 200)
    .map(([key, item]) => [key, stripSecrets(item, depth + 1)]));
}

function persistedObject(value, maxBytes = MAX_JSON) {
  return stripSecrets(safeObject(value, maxBytes));
}

function saveSlotOf(value) {
  const raw = clean(value || "main", 40).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "main";
  return raw === "default" ? "main" : raw;
}

function assertSaveSlot(slot) {
  if (!SAVE_SLOTS.has(slot)) {
    const error = new Error("Cloud save chỉ hỗ trợ tối đa 3 slot: main, autosave, checkpoint hoặc slot1-slot3.");
    error.statusCode = 422;
    throw error;
  }
  return slot;
}

function scoreRank(score) {
  if (score >= 50000) return "Huyền thoại";
  if (score >= 20000) return "Captain";
  if (score >= 10000) return "Explorer";
  if (score >= 5000) return "Phi công";
  return "Tân binh";
}

function validateScoreUpdate(current, body = {}) {
  const requested = body.score ?? body.data?.score;
  const deltaValue = body.delta ?? body.data?.delta;
  if (deltaValue !== undefined && deltaValue !== null) {
    const delta = number(deltaValue, 0, MAX_SCORE_DELTA, -1);
    if (delta < 0) {
      const error = new Error("Score delta không hợp lệ.");
      error.statusCode = 422;
      throw error;
    }
    return current + delta;
  }
  if (requested === undefined || requested === null) {
    const error = new Error("Thiếu score hoặc delta đã được server kiểm tra.");
    error.statusCode = 422;
    throw error;
  }
  const absolute = number(requested, 0, 999999999, -1);
  if (absolute < current || absolute - current > MAX_SCORE_DELTA) {
    const error = new Error("Score update vượt giới hạn server cho phép.");
    error.statusCode = 422;
    throw error;
  }
  return absolute;
}

function backendStatus(db) {
  return {
    mode: db ? "mongodb" : "memory-fallback",
    persistent: Boolean(db),
    configured: Boolean(process.env.MONGODB_URI),
    note: db
      ? "Dữ liệu Game Center đang lưu trong MongoDB."
      : "MongoDB chưa cấu hình hoặc tạm thời không khả dụng; dữ liệu chỉ lưu trong tiến trình hiện tại."
  };
}

function safeArray(value, maxItems = 500, maxText = 80) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, maxText)).filter(Boolean))].slice(0, maxItems);
}

function gameIdOf(value) {
  return clean(value || "astra-hh", 80).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60) || "astra-hh";
}

function anonymousIdOf(req, body = {}) {
  return clean(
    body.anonymousId ||
    req.query?.anonymousId ||
    req.headers["x-hh-anonymous-id"] ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "guest",
    160
  ).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120) || "guest";
}

function userKeyOf(user, req, body = {}) {
  return user?._id ? `user:${String(user._id)}` : `anon:${anonymousIdOf(req, body)}`;
}

function seasonOf(value) {
  const raw = clean(value, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (raw) return raw;
  const now = new Date();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-q${quarter}`;
}

function dayKeyOf(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function idempotencyKeyOf(req, body = {}) {
  return clean(req.headers["idempotency-key"] || body.idempotencyKey || "", 160).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120);
}

function publicPlayer(user, body = {}) {
  const profile = publicUser(user);
  return profile || {
    id: `guest:${clean(body.anonymousId, 80) || "local"}`,
    name: clean(body.name || body.playerName || "Người chơi HH", 80),
    avatar: clean(body.avatar, 500),
    provider: "guest",
    guest: true
  };
}

async function openDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const { database } = require("../utils/platform");
    return await database();
  } catch (error) {
    console.warn("Game Center Mongo fallback:", error?.message || error);
    return null;
  }
}

function memoryCollection(kind) {
  return memory[kind];
}

function ensureMemoryCollection(kind) {
  if (!memory[kind]) memory[kind] = new Map();
  return memory[kind];
}

async function upsertRecord(db, kind, query, value) {
  const now = new Date();
  const doc = { ...value, updatedAt: now };
  if (db) {
    const result = await db.collection("gameCenterRecords").findOneAndUpdate(
      { kind, ...query },
      { $set: doc, $setOnInsert: { kind, ...query, createdAt: now } },
      { upsert: true, returnDocument: "after" }
    );
    return result || { kind, ...query, ...doc, createdAt: now };
  }
  const key = JSON.stringify({ kind, ...query });
  const previous = ensureMemoryCollection(kind).get(key) || { kind, ...query, createdAt: now };
  const next = { ...previous, ...doc };
  ensureMemoryCollection(kind).set(key, next);
  return next;
}

async function findRecord(db, kind, query) {
  if (db) return db.collection("gameCenterRecords").findOne({ kind, ...query });
  return ensureMemoryCollection(kind).get(JSON.stringify({ kind, ...query })) || null;
}

async function listLeaderboard(db, gameId, limit, season) {
  if (db) {
    const rows = await db.collection("gameCenterRecords")
      .find({ kind: "scores", gameId, season }, { projection: { player: 1, score: 1, season: 1, level: 1, rank: 1, stats: 1, updatedAt: 1 } })
      .sort({ score: -1, updatedAt: 1 })
      .limit(limit)
      .toArray();
    return rows.map((item, index) => ({ position: index + 1, ...publicScore(item) }));
  }
  return [...memory.scores.values()]
    .filter((item) => item.gameId === gameId && item.season === season)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || new Date(a.updatedAt) - new Date(b.updatedAt))
    .slice(0, limit)
    .map((item, index) => ({ position: index + 1, ...publicScore(item) }));
}

function publicScore(item = {}) {
  return {
    player: item.player || { name: "Người chơi HH" },
    score: number(item.score),
    season: seasonOf(item.season),
    level: number(item.level, 1, 9999, 1),
    rank: clean(item.rank || "Tân binh", 60),
    stats: item.stats && typeof item.stats === "object" ? item.stats : {},
    integrity: item.integrity === "server-validated" ? "server-validated" : "unverified",
    updatedAt: item.updatedAt || new Date()
  };
}

async function runIdempotent(db, key, userKey, handler) {
  if (!key) return handler();
  const query = { key, userKey };
  if (db) {
    const existing = await db.collection("gameCenterIdempotency").findOne(query);
    if (existing) return { ...existing.response, idempotentReplay: true };
    const response = await handler();
    await db.collection("gameCenterIdempotency").insertOne({ ...query, response, createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    return response;
  }
  const cacheKey = JSON.stringify(query);
  const existing = memory.idempotency.get(cacheKey);
  if (existing) return { ...existing, idempotentReplay: true };
  const response = await handler();
  memory.idempotency.set(cacheKey, response);
  return response;
}

async function saveVersionedRecord(db, kind, query, value) {
  const previous = await findRecord(db, kind, query);
  const { serverVersion, ...recordValue } = value || {};
  const version = serverVersion
    ? Number(previous?.version || 0) + 1
    : Math.max(1, number(recordValue.version, 1, 999999999, Number(previous?.version || 0) + 1));
  if (previous?.version && version < Number(previous.version)) {
    const error = new Error("Phiên bản mới không được nhỏ hơn phiên bản hiện tại.");
    error.statusCode = 409;
    throw error;
  }
  const saved = await upsertRecord(db, kind, query, { ...recordValue, version, previousVersion: previous?.version || 0 });
  const versionDoc = {
    kind: "versions",
    resourceKind: kind,
    ...query,
    version,
    snapshot: saved,
    createdAt: new Date()
  };
  if (db) await db.collection("gameCenterRecordVersions").insertOne(versionDoc);
  else {
    const key = JSON.stringify({ kind, ...query });
    const list = memory.versions.get(key) || [];
    list.push(versionDoc);
    memory.versions.set(key, list.slice(-50));
  }
  return saved;
}

async function listVersions(db, kind, query, limit = 20) {
  if (db) {
    return db.collection("gameCenterRecordVersions")
      .find({ resourceKind: kind, ...query })
      .sort({ version: -1, createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  return (memory.versions.get(JSON.stringify({ kind, ...query })) || []).slice(-limit).reverse();
}

async function listSaveSlots(db, userKey, gameId) {
  if (db) {
    return db.collection("gameCenterRecords")
      .find({ kind: "saves", userKey, gameId }, { projection: { slot: 1, version: 1, checkpointId: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(MAX_SAVE_SLOTS)
      .toArray();
  }
  return [...memory.saves.values()]
    .filter((item) => item.userKey === userKey && item.gameId === gameId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, MAX_SAVE_SLOTS);
}

async function assertSaveSlotCapacity(db, userKey, gameId, slot) {
  const existing = await findRecord(db, "saves", { userKey, gameId, slot });
  if (existing) return;
  const slots = await listSaveSlots(db, userKey, gameId);
  const distinct = new Set(slots.map((item) => item.slot).filter(Boolean));
  if (distinct.size >= MAX_SAVE_SLOTS) {
    const error = new Error("Bạn đã dùng đủ 3 slot cloud save cho game này.");
    error.statusCode = 409;
    throw error;
  }
}

async function restoreSave(db, query, version) {
  const wanted = number(version, 1, 999999999, 0);
  if (!wanted) {
    const error = new Error("Thiếu version cần khôi phục.");
    error.statusCode = 422;
    throw error;
  }
  const versions = await listVersions(db, "saves", query, 50);
  const source = versions.find((item) => Number(item.version) === wanted);
  if (!source?.snapshot) {
    const error = new Error("Không tìm thấy bản cloud save cần khôi phục.");
    error.statusCode = 404;
    throw error;
  }
  return saveVersionedRecord(db, "saves", query, {
    ...source.snapshot,
    data: persistedObject(source.snapshot.data, MAX_JSON),
    restoredFromVersion: wanted,
    serverVersion: true
  });
}

async function storePresence(db, userKey, payload = {}) {
  const now = new Date();
  const value = {
    userKey,
    online: payload.online !== false,
    gameId: gameIdOf(payload.gameId || payload.queryGameId || payload.resourceGameId || payload.seasonGameId),
    roomCode: clean(payload.roomCode, 20),
    roomKind: clean(payload.roomKind, 20),
    activity: clean(payload.activity, 120),
    position: safeObject(payload.position, 1024),
    updatedAt: now
  };
  if (db) {
    await db.collection("gameCenterPresence").findOneAndUpdate(
      { userKey },
      { $set: value, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" }
    );
    return value;
  }
  ensureMemoryCollection("presence").set(userKey, value);
  return value;
}

async function listPresence(db, gameId, limit = 200) {
  if (db) {
    return db.collection("gameCenterPresence")
      .find(gameId ? { gameId } : {}, { projection: { userKey: 1, gameId: 1, roomCode: 1, roomKind: 1, activity: 1, position: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }
  return [...ensureMemoryCollection("presence").values()]
    .filter((item) => !gameId || item.gameId === gameId)
    .slice(0, limit);
}

async function friendsCollection(db) {
  if (!db) return null;
  return db.collection("gameCenterFriends");
}

function respond(res, status, payload) {
  const storage = memory.backendStatus || backendStatus(null);
  return res.status(status).json({
    ok: status < 400,
    backend: storage.mode === "mongodb" ? "mongodb" : "memory",
    persistence: storage.persistent,
    backendStatus: storage,
    ...payload
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const body = bodyOf(req);
    const db = await openDb();
    memory.backendStatus = backendStatus(db);
    const user = await currentUser(req);
    const userKey = userKeyOf(user, req, body);
    const player = publicPlayer(user, body);
    const resource = clean(req.query.resource || body.resource || "profile", 40).toLowerCase();
    const action = clean(req.query.action || body.action || "", 40).toLowerCase();
    const gameId = gameIdOf(req.query.gameId || body.gameId);
    const season = seasonOf(req.query.season || body.season);
    const idemKey = idempotencyKeyOf(req, body);

    if (req.method === "GET" && resource === "catalog") {
      return respond(res, 200, {
        games: DEFAULT_GAMES.map((id) => ({ id, realtime: true, cloudSave: true, leaderboard: true }))
      });
    }

    if (req.method === "GET" && resource === "leaderboard") {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
      return respond(res, 200, { gameId, season, items: await listLeaderboard(db, gameId, limit, season) });
    }

    if (req.method === "GET" && ["profile", "progress", "inventory", "equipment", "quests", "season", "cloud-save"].includes(resource)) {
      const kind = resource === "cloud-save" ? "saves" : resource === "profile" ? "profiles" : "progress";
      const query = resource === "profile"
        ? { userKey }
        : resource === "cloud-save"
          ? { userKey, gameId, slot: assertSaveSlot(saveSlotOf(req.query.slot || body.slot)) }
          : { userKey, gameId, season };
      if (resource === "cloud-save" && ["slots", "list"].includes(String(req.query.view || "").toLowerCase())) {
        return respond(res, 200, { resource, gameId, slots: await listSaveSlots(db, userKey, gameId) });
      }
      const record = await findRecord(db, kind, query);
      const versions = req.query.view === "versions" ? await listVersions(db, kind, query, Math.max(1, Math.min(50, Number(req.query.limit || 20)))) : null;
      return respond(res, 200, { resource, gameId, season, item: record || null, versions });
    }

    if (req.method === "GET" && resource === "friends") {
      const relation = db ? await friendsCollection(db) : null;
      if (relation) {
        const rows = await relation.find({ $or: [{ userKey }, { friendKey: userKey }] }).sort({ updatedAt: -1 }).limit(200).toArray();
        return respond(res, 200, { resource, friends: rows });
      }
      return respond(res, 200, { resource, friends: [...ensureMemoryCollection("friends").values()].filter((item) => item.userKey === userKey || item.friendKey === userKey) });
    }

    if (req.method === "GET" && resource === "presence") {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
      return respond(res, 200, { resource, gameId, presences: await listPresence(db, gameId, limit) });
    }

    if (req.method === "DELETE" && resource === "cloud-save") {
      const slot = assertSaveSlot(saveSlotOf(req.query.slot || body.slot));
      const query = { userKey, gameId, slot };
      let deleted = false;
      if (db) {
        const result = await db.collection("gameCenterRecords").deleteOne({ kind: "saves", ...query });
        await db.collection("gameCenterRecordVersions").deleteMany({ resourceKind: "saves", ...query });
        deleted = Boolean(result.deletedCount);
      } else {
        deleted = ensureMemoryCollection("saves").delete(JSON.stringify({ kind: "saves", ...query }));
        memory.versions.delete(JSON.stringify({ kind: "saves", ...query }));
      }
      return respond(res, 200, { resource, gameId, slot, deleted });
    }

    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return respond(res, 405, { error: "Method not allowed" });
    }

    const versionedKindMap = {
      profile: "profiles",
      progress: "progress",
      inventory: "inventory",
      equipment: "equipment",
      quests: "quests",
      season: "season"
    };
    const versionedResource = versionedKindMap[resource] || versionedKindMap[action];

    if (versionedResource === "inventory" && (body.items || body.currency)) {
      return respond(res, 403, {
        resource: "inventory",
        authoritative: false,
        error: "Inventory chỉ được thay đổi bởi server game; client không thể tự cấp item hoặc currency."
      });
    }

    if (versionedResource) {
      return respond(res, 200, {
        resource: versionedResource,
        item: await runIdempotent(db, idemKey, userKey, async () => {
          const payload = {
            player,
            displayName: clean(body.displayName || player.name, 80),
            avatar: clean(body.avatar || player.avatar, 500),
            version: number(body.version, 1, 999999999, 1)
          };
          if (versionedResource === "profiles") {
            payload.preferences = safeObject(body.preferences, 32 * 1024);
            payload.lastSeenAt = new Date();
            return saveVersionedRecord(db, versionedResource, { userKey }, payload);
          }
          const shared = {
            version: number(body.version, 1, 999999999, 1),
            xp: number(body.xp, 0, 999999999),
            level: number(body.level, 1, 9999, 1),
            stats: safeObject(body.stats, 64 * 1024),
            state: safeObject(body.state, 64 * 1024),
            meta: safeObject(body.meta, 32 * 1024),
            season
          };
          if (versionedResource === "progress") {
            shared.achievements = safeArray(body.achievements, 500);
            shared.badges = safeArray(body.badges, 300);
            shared.missions = safeObject(body.missions, 64 * 1024);
            shared.reportedInventory = persistedObject(body.inventory, 64 * 1024);
            shared.equipment = safeObject(body.equipment, 64 * 1024);
            shared.quests = safeObject(body.quests, 64 * 1024);
          }
          if (versionedResource === "inventory") {
            shared.items = safeObject(body.items, 64 * 1024);
            shared.currency = safeObject(body.currency, 16 * 1024);
          }
          if (versionedResource === "equipment") {
            shared.slots = safeObject(body.slots, 16 * 1024);
            shared.mods = safeObject(body.mods, 16 * 1024);
          }
          if (versionedResource === "quests") {
            shared.active = safeObject(body.active, 32 * 1024);
            shared.completed = safeArray(body.completed, 1000, 120);
          }
          if (versionedResource === "season") {
            shared.season = season;
            shared.progress = safeObject(body.progress, 32 * 1024);
            shared.reportedRewards = persistedObject(body.rewards, 32 * 1024);
          }
          return saveVersionedRecord(db, versionedResource, { userKey, gameId, season }, shared);
        })
      });
    }

    if (resource === "cloud-save" || resource === "restore" || action === "cloud-save" || action === "save" || action === "restore") {
      const slot = assertSaveSlot(saveSlotOf(body.slot));
      const query = { userKey, gameId, slot };
      if (action === "restore" || resource === "restore") {
        const restored = await runIdempotent(db, idemKey, userKey, () => restoreSave(db, query, body.version || body.restoreVersion));
        return respond(res, 200, { resource: "cloud-save", gameId, slot, restored: true, item: restored });
      }
      await assertSaveSlotCapacity(db, userKey, gameId, slot);
      const save = await runIdempotent(db, idemKey, userKey, async () => saveVersionedRecord(db, "saves", query, {
        player,
        serverVersion: true,
        checksum: clean(body.checksum, 160),
        checkpointId: clean(body.checkpointId || body.checkpoint, 80),
        checkpointLabel: clean(body.checkpointLabel, 120),
        data: persistedObject(body.data, MAX_JSON),
        season
      }));
      return respond(res, 200, { resource: "cloud-save", gameId, slot, item: save });
    }

    if (resource === "daily-reward" || action === "daily-reward" || action === "reward") {
      const dayKey = dayKeyOf();
      const rewardKey = JSON.stringify({ userKey, gameId, dayKey });
      const reward = db
        ? await db.collection("gameCenterDailyRewards").findOne({ userKey, gameId, dayKey })
        : memory.dailyRewards.get(rewardKey) || null;
      if (reward) return respond(res, 200, { resource: "daily-reward", claimed: true, reward, alreadyClaimed: true });
      const granted = {
        userKey,
        gameId,
        dayKey,
        reward: {
          ...SERVER_DAILY_REWARD,
          items: [...SERVER_DAILY_REWARD.items]
        },
        claimedAt: new Date().toISOString()
      };
      if (db) await db.collection("gameCenterDailyRewards").insertOne({ ...granted, createdAt: new Date() });
      else memory.dailyRewards.set(rewardKey, granted);
      return respond(res, 200, { resource: "daily-reward", claimed: true, reward: granted.reward, dayKey });
    }

    if (resource === "friends" || action === "friends") {
      if (!user) return respond(res, 401, { error: "Bạn cần đăng nhập để quản lý bạn bè." });
      const friendUserId = clean(body.friendUserId || body.userId, 160);
      const friendName = clean(body.friendName, 120);
      const mode = clean(body.mode || body.action || "add", 20).toLowerCase();
      if (!friendUserId && mode !== "list") return respond(res, 400, { error: "Thiếu người dùng bạn bè." });
      if (db) {
        const collection = await friendsCollection(db);
        if (mode === "remove") {
          const result = await collection.deleteOne({ userKey, friendKey: friendUserId });
          return respond(res, 200, { resource: "friends", removed: Boolean(result.deletedCount) });
        }
        if (mode === "accept") {
          const result = await collection.updateOne({ userKey, friendKey: friendUserId }, { $set: { status: "accepted", updatedAt: new Date() } }, { upsert: true });
          return respond(res, 200, { resource: "friends", updated: Boolean(result.upsertedCount || result.modifiedCount) });
        }
        if (mode === "list") {
          const friends = await collection.find({ $or: [{ userKey }, { friendKey: userKey }] }).sort({ updatedAt: -1 }).limit(200).toArray();
          return respond(res, 200, { resource: "friends", friends });
        }
        const record = await collection.findOneAndUpdate(
          { userKey, friendKey: friendUserId },
          { $set: { userKey, friendKey: friendUserId, friendName, status: mode === "request" ? "requested" : "accepted", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true, returnDocument: "after" }
        );
        return respond(res, 200, { resource: "friends", friend: record });
      }
      const store = ensureMemoryCollection("friends");
      const key = JSON.stringify({ userKey, friendKey: friendUserId });
      if (mode === "remove") {
        const removed = store.delete(key);
        return respond(res, 200, { resource: "friends", removed });
      }
      if (mode === "accept" || mode === "add" || mode === "request") {
        const next = { userKey, friendKey: friendUserId, friendName, status: mode === "request" ? "requested" : "accepted", createdAt: store.get(key)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
        store.set(key, next);
        return respond(res, 200, { resource: "friends", friend: next });
      }
      return respond(res, 200, { resource: "friends", friends: [...store.values()].filter((item) => item.userKey === userKey || item.friendKey === userKey) });
    }

    if (resource === "presence" || action === "presence") {
      if (!user && !body.online) return respond(res, 401, { error: "Bạn cần đăng nhập để cập nhật trạng thái." });
      const presence = await storePresence(db, userKey, { ...body, gameId });
      return respond(res, 200, { resource: "presence", presence });
    }

    if (resource === "score" || action === "score" || action === "leaderboard") {
      const previousScore = await findRecord(db, "scores", { userKey, gameId, season });
      const validatedScore = validateScoreUpdate(number(previousScore?.score, 0, 999999999, 0), body);
      const score = await runIdempotent(db, idemKey, userKey, async () => saveVersionedRecord(db, "scores", { userKey, gameId, season }, {
        player,
        score: validatedScore,
        level: Math.floor(validatedScore / 1000) + 1,
        rank: scoreRank(validatedScore),
        stats: persistedObject(body.stats || {}, 16 * 1024),
        integrity: "server-validated",
        season,
        serverVersion: true
      }));
      if (db) await db.collection("events").insertOne({ type: "game:center:score", gameId, userKey, season, score: score.score, createdAt: new Date() });
      else memory.events.push({ type: "game:center:score", gameId, userKey, season, score: score.score, createdAt: new Date() });
      return respond(res, 200, { resource: "score", gameId, season, item: publicScore(score), leaderboard: await listLeaderboard(db, gameId, 25, season) });
    }

    return respond(res, 400, { error: "Game Center resource không hợp lệ." });
  } catch (error) {
    const status = Number(error.statusCode || 500);
    console.error("Game Center API error:", error?.message || error);
    return respond(res, status >= 400 && status <= 500 ? status : 500, {
      error: status === 413 ? error.message : "Game Center API chưa xử lý được yêu cầu."
    });
  }
};
