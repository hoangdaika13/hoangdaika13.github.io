const { ObjectId } = require("mongodb");
const { bodyOf, clean, currentUser, publicUser, setCors } = require("../utils/platform");

const memory = globalThis.__HH_GAME_CENTER_MEMORY__ || {
  profiles: new Map(),
  progress: new Map(),
  saves: new Map(),
  scores: new Map(),
  events: []
};
globalThis.__HH_GAME_CENTER_MEMORY__ = memory;

const MAX_JSON = 128 * 1024;
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
  const previous = memoryCollection(kind).get(key) || { kind, ...query, createdAt: now };
  const next = { ...previous, ...doc };
  memoryCollection(kind).set(key, next);
  return next;
}

async function findRecord(db, kind, query) {
  if (db) return db.collection("gameCenterRecords").findOne({ kind, ...query });
  return memoryCollection(kind).get(JSON.stringify({ kind, ...query })) || null;
}

async function listLeaderboard(db, gameId, limit) {
  if (db) {
    const rows = await db.collection("gameCenterRecords")
      .find({ kind: "scores", gameId }, { projection: { player: 1, score: 1, level: 1, rank: 1, stats: 1, updatedAt: 1 } })
      .sort({ score: -1, updatedAt: 1 })
      .limit(limit)
      .toArray();
    return rows.map((item, index) => ({ position: index + 1, ...publicScore(item) }));
  }
  return [...memory.scores.values()]
    .filter((item) => item.gameId === gameId)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || new Date(a.updatedAt) - new Date(b.updatedAt))
    .slice(0, limit)
    .map((item, index) => ({ position: index + 1, ...publicScore(item) }));
}

function publicScore(item = {}) {
  return {
    player: item.player || { name: "Người chơi HH" },
    score: number(item.score),
    level: number(item.level, 1, 9999, 1),
    rank: clean(item.rank || "Tân binh", 60),
    stats: item.stats && typeof item.stats === "object" ? item.stats : {},
    updatedAt: item.updatedAt || new Date()
  };
}

function respond(res, status, payload) {
  return res.status(status).json({
    ok: status < 400,
    backend: process.env.MONGODB_URI ? "mongodb-or-memory-fallback" : "memory",
    ...payload
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const body = bodyOf(req);
    const db = await openDb();
    const user = await currentUser(req);
    const userKey = userKeyOf(user, req, body);
    const player = publicPlayer(user, body);
    const resource = clean(req.query.resource || body.resource || "profile", 40).toLowerCase();
    const action = clean(req.query.action || body.action || "", 40).toLowerCase();
    const gameId = gameIdOf(req.query.gameId || body.gameId);

    if (req.method === "GET" && resource === "catalog") {
      return respond(res, 200, {
        games: DEFAULT_GAMES.map((id) => ({ id, realtime: true, cloudSave: true, leaderboard: true }))
      });
    }

    if (req.method === "GET" && resource === "leaderboard") {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
      return respond(res, 200, { gameId, items: await listLeaderboard(db, gameId, limit) });
    }

    if (req.method === "GET" && ["profile", "progress", "cloud-save"].includes(resource)) {
      const kind = resource === "cloud-save" ? "saves" : resource === "profile" ? "profiles" : "progress";
      const query = resource === "profile" ? { userKey } : { userKey, gameId };
      const record = await findRecord(db, kind, query);
      return respond(res, 200, { resource, gameId, item: record || null });
    }

    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return respond(res, 405, { error: "Method not allowed" });
    }

    if (resource === "profile" || action === "profile") {
      const preferences = safeObject(body.preferences, 32 * 1024);
      const profile = await upsertRecord(db, "profiles", { userKey }, {
        player,
        displayName: clean(body.displayName || player.name, 80),
        avatar: clean(body.avatar || player.avatar, 500),
        preferences,
        lastSeenAt: new Date()
      });
      return respond(res, 200, { resource: "profile", item: profile });
    }

    if (resource === "progress" || action === "progress") {
      const progress = await upsertRecord(db, "progress", { userKey, gameId }, {
        player,
        xp: number(body.xp, 0, 999999999),
        level: number(body.level, 1, 9999, 1),
        achievements: Array.isArray(body.achievements) ? [...new Set(body.achievements.map((item) => clean(item, 80)).filter(Boolean))].slice(0, 500) : [],
        badges: Array.isArray(body.badges) ? [...new Set(body.badges.map((item) => clean(item, 80)).filter(Boolean))].slice(0, 300) : [],
        missions: safeObject(body.missions, 64 * 1024),
        inventory: safeObject(body.inventory, 64 * 1024),
        stats: safeObject(body.stats, 64 * 1024)
      });
      return respond(res, 200, { resource: "progress", gameId, item: progress });
    }

    if (resource === "cloud-save" || action === "cloud-save" || action === "save") {
      const slot = clean(body.slot || "default", 40).replace(/[^a-zA-Z0-9_-]/g, "") || "default";
      const save = await upsertRecord(db, "saves", { userKey, gameId, slot }, {
        player,
        version: number(body.version, 1, 999999, 1),
        checksum: clean(body.checksum, 160),
        data: safeObject(body.data, MAX_JSON)
      });
      return respond(res, 200, { resource: "cloud-save", gameId, slot, item: save });
    }

    if (resource === "score" || action === "score" || action === "leaderboard") {
      const score = await upsertRecord(db, "scores", { userKey, gameId }, {
        player,
        score: number(body.score ?? body.data?.score),
        level: number(body.level ?? body.data?.level, 1, 9999, 1),
        rank: clean(body.rank || body.data?.rank || "Tân binh", 60),
        stats: safeObject(body.stats || body.data || {}, 64 * 1024)
      });
      if (db) await db.collection("events").insertOne({ type: "game:center:score", gameId, userKey, score: score.score, createdAt: new Date() });
      else memory.events.push({ type: "game:center:score", gameId, userKey, score: score.score, createdAt: new Date() });
      return respond(res, 200, { resource: "score", gameId, item: publicScore(score), leaderboard: await listLeaderboard(db, gameId, 25) });
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
