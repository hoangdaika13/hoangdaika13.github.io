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
  assert.ok(catalog.payload.games.length >= 22);
  assert.ok(catalog.payload.games.some((game) => game.id === "hh-astra-mmo"));
  assert.equal(catalog.payload.backend, "memory");
  assert.equal(catalog.payload.persistence, false);
  assert.equal(catalog.payload.backendStatus.mode, "memory-fallback");

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
  assert.equal(inventory.statusCode, 403);
  assert.equal(inventory.payload.authoritative, false);

  const cloudSave = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 3,
    data: { sector: "Orion", ship: { engine: 4, shield: 3 } }
  });
  assert.equal(cloudSave.statusCode, 200);
  assert.equal(cloudSave.payload.slot, "main");
  assert.equal(cloudSave.payload.item.version, 1);
  assert.equal(cloudSave.payload.item.checkpointId, "");

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

  const restored = await call("POST", { resource: "cloud-save", action: "restore", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 1
  });
  assert.equal(restored.statusCode, 200);
  assert.equal(restored.payload.restored, true);
  assert.equal(restored.payload.item.restoredFromVersion, 1);

  await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "autosave",
    data: { sector: "Lumen" }
  });
  await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "checkpoint",
    checkpointId: "chapter-1",
    data: { sector: "Orion" }
  });
  const fourthSlot = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "slot1",
    data: { sector: "Should be rejected" }
  });
  assert.equal(fourthSlot.statusCode, 409);

  const score = await call("POST", { resource: "score", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    playerName: "Astra Tester",
    season: "alpha",
    delta: 5000,
    level: 9999,
    rank: "Impossible"
  });
  assert.equal(score.statusCode, 200);
  assert.equal(score.payload.leaderboard[0].score, 5000);
  assert.equal(score.payload.leaderboard[0].season, "alpha");
  assert.equal(score.payload.item.level, 6);
  assert.equal(score.payload.item.rank, "Phi công");
  assert.equal(score.payload.item.integrity, "server-validated");

  const impossibleScore = await call("POST", { resource: "score", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    score: 999999
  });
  assert.equal(impossibleScore.statusCode, 422);

  const leaderboard = await call("GET", { resource: "leaderboard", gameId: "hh-astra-mmo", season: "alpha" });
  assert.equal(leaderboard.statusCode, 200);
  assert.equal(leaderboard.payload.items[0].rank, "Phi công");
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
  assert.equal(reward.payload.reward.coins, 100);
  assert.equal(reward.payload.reward.xp, 250);

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

test("Game Center API deletes one cloud slot without touching the others", async () => {
  const anonymousId = "delete-slot-player";
  for (const slot of ["slot1", "slot2"]) {
    const saved = await call("POST", { resource: "cloud-save", gameId: "game-center" }, {
      anonymousId,
      slot,
      data: { slot }
    }, { "x-hh-anonymous-id": anonymousId });
    assert.equal(saved.statusCode, 200);
  }

  const removed = await call("DELETE", { resource: "cloud-save", gameId: "game-center", slot: "slot1" }, {}, {
    "x-hh-anonymous-id": anonymousId
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.payload.deleted, true);

  const first = await call("GET", { resource: "cloud-save", gameId: "game-center", slot: "slot1" }, {}, {
    "x-hh-anonymous-id": anonymousId
  });
  const second = await call("GET", { resource: "cloud-save", gameId: "game-center", slot: "slot2" }, {}, {
    "x-hh-anonymous-id": anonymousId
  });
  assert.equal(first.payload.item, null);
  assert.equal(second.payload.item.data.slot, "slot2");
});
