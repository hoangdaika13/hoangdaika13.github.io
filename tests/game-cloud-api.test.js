const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../utils/games-api");

function createResponse() {
  const response = {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
  return response;
}

async function call(method, query = {}, body = {}, headers = {}) {
  const req = {
    method,
    query,
    body,
    headers: { "x-hh-anonymous-id": "api-test-player", ...headers },
    socket: { remoteAddress: "127.0.0.1" }
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

test("Game Center API works without MongoDB for catalog and anonymous profile", async () => {
  const catalog = await call("GET", { resource: "catalog" });
  assert.equal(catalog.statusCode, 200);
  assert.equal(catalog.payload.ok, true);
  assert.ok(catalog.payload.games.some((game) => game.id === "hh-astra-mmo"));
  assert.equal(catalog.payload.backend, "memory");

  const saved = await call("POST", { resource: "profile" }, {
    displayName: "Tester",
    anonymousId: "api-test-player",
    preferences: { motion: "balanced", favoriteGame: "hh-astra-mmo" }
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.payload.item.displayName, "Tester");

  const loaded = await call("GET", { resource: "profile", anonymousId: "api-test-player" });
  assert.equal(loaded.statusCode, 200);
  assert.equal(loaded.payload.item.displayName, "Tester");
});

test("Game Center API stores progress, cloud save and leaderboard defensively", async () => {
  const progress = await call("POST", { resource: "progress", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    xp: 2400,
    level: 7,
    achievements: ["first-warp", "first-warp", "<unsafe>"],
    missions: { daily: ["mine", "trade"] },
    inventory: { crystals: 42 }
  });
  assert.equal(progress.statusCode, 200);
  assert.equal(progress.payload.item.level, 7);
  assert.equal(progress.payload.item.version, 1);
  assert.deepEqual(progress.payload.item.achievements.slice(0, 2), ["first-warp", "<unsafe>"]);

  const inventory = await call("POST", { resource: "inventory", gameId: "hh-astra-mmo", season: "alpha" }, {
    anonymousId: "api-test-player",
    version: 2,
    items: { ore: 10, relic: 1 },
    currency: { coins: 500 }
  });
  assert.equal(inventory.statusCode, 200);
  assert.equal(inventory.payload.item.version, 2);

  const cloudSave = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 3,
    data: { sector: "Orion", ship: { engine: 4, shield: 3 } }
  });
  assert.equal(cloudSave.statusCode, 200);
  assert.equal(cloudSave.payload.slot, "main");
  assert.equal(cloudSave.payload.item.version, 3);

  const replay = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 4,
    data: { sector: "Should not overwrite replay" }
  }, { "idempotency-key": "save-main-once" });
  const replayAgain = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 5,
    data: { sector: "Replay" }
  }, { "idempotency-key": "save-main-once" });
  assert.equal(replayAgain.payload.item.version, replay.payload.item.version);
  assert.equal(replayAgain.payload.item.idempotentReplay, true);

  const score = await call("POST", { resource: "score", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    playerName: "Astra Tester",
    season: "alpha",
    score: 9800,
    level: 7,
    rank: "Explorer"
  });
  assert.equal(score.statusCode, 200);
  assert.equal(score.payload.leaderboard[0].score, 9800);
  assert.equal(score.payload.leaderboard[0].season, "alpha");

  const leaderboard = await call("GET", { resource: "leaderboard", gameId: "hh-astra-mmo", season: "alpha" });
  assert.equal(leaderboard.statusCode, 200);
  assert.equal(leaderboard.payload.items[0].rank, "Explorer");
});

test("Game Center API grants daily rewards once and tracks presence", async () => {
  const reward = await call("POST", { resource: "daily-reward", gameId: "hh-astra-mmo" }, {
    anonymousId: "daily-player",
    coins: 777,
    xp: 333,
    items: ["crystal", "fuel"]
  });
  assert.equal(reward.statusCode, 200);
  assert.equal(reward.payload.claimed, true);
  assert.equal(reward.payload.reward.coins, 777);

  const rewardAgain = await call("POST", { resource: "daily-reward", gameId: "hh-astra-mmo" }, {
    anonymousId: "daily-player",
    coins: 1
  });
  assert.equal(rewardAgain.statusCode, 200);
  assert.equal(rewardAgain.payload.alreadyClaimed, true);

  const presence = await call("POST", { resource: "presence", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    online: true,
    activity: "Đang ở lobby",
    roomCode: "ABC123"
  });
  assert.equal(presence.statusCode, 200);
  assert.equal(presence.payload.presence.activity, "Đang ở lobby");

  const listed = await call("GET", { resource: "presence", gameId: "hh-astra-mmo" });
  assert.equal(listed.statusCode, 200);
  assert.ok(listed.payload.presences.some((item) => item.roomCode === "ABC123"));
});
