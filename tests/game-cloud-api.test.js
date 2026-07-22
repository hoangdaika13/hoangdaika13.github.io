const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/games");

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

async function call(method, query = {}, body = {}) {
  const req = {
    method,
    query,
    body,
    headers: { "x-hh-anonymous-id": "api-test-player" },
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
  assert.deepEqual(progress.payload.item.achievements.slice(0, 2), ["first-warp", "<unsafe>"]);

  const cloudSave = await call("POST", { resource: "cloud-save", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    slot: "main",
    version: 3,
    data: { sector: "Orion", ship: { engine: 4, shield: 3 } }
  });
  assert.equal(cloudSave.statusCode, 200);
  assert.equal(cloudSave.payload.slot, "main");

  const score = await call("POST", { resource: "score", gameId: "hh-astra-mmo" }, {
    anonymousId: "api-test-player",
    playerName: "Astra Tester",
    score: 9800,
    level: 7,
    rank: "Explorer"
  });
  assert.equal(score.statusCode, 200);
  assert.equal(score.payload.leaderboard[0].score, 9800);

  const leaderboard = await call("GET", { resource: "leaderboard", gameId: "hh-astra-mmo" });
  assert.equal(leaderboard.statusCode, 200);
  assert.equal(leaderboard.payload.items[0].rank, "Explorer");
});
