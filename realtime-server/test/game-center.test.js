const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const port = 4321;
const serverUrl = `http://127.0.0.1:${port}`;

function emitAck(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} acknowledgement timed out`)), 5000);
    socket.emit(event, payload, (response = {}) => {
      clearTimeout(timer);
      response.ok ? resolve(response) : reject(new Error(response.error || `${event} failed`));
    });
  });
}

function once(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} event timed out`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connectPlayer(id, name) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      auth: { anonymousId: id, gameName: name, consent: false },
      transports: ["websocket"]
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

test("Game Center realtime rooms support 2-10 player presence, chat, ready and score sync", { timeout: 20000 }, async (t) => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_URL: "http://127.0.0.1:4173",
      ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      MAX_GAME_PLAYERS: "10",
      MONGODB_URI: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const sockets = [];
  t.after(() => {
    sockets.forEach((socket) => socket.close());
    child.kill();
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime server did not start")), 5000);
    child.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("Realtime server listening")) return;
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => reject(new Error(`Realtime server exited with code ${code}`)));
  });

  const [one, two] = await Promise.all([
    connectPlayer("game-player-one", "Game Player One"),
    connectPlayer("game-player-two", "Game Player Two")
  ]);
  sockets.push(one, two);

  const created = await emitAck(one, "game:room:create", {
    gameId: "hh-astra-mmo",
    name: "Astra MMO Party",
    visibility: "private",
    maxPlayers: 10
  });
  assert.match(created.room.code, /^[A-Z0-9]{6}$/);
  assert.equal(created.room.maxPlayers, 10);
  assert.equal(created.room.members[0].role, "host");

  const joinedEvent = once(one, "game:member:joined");
  const joined = await emitAck(two, "game:room:join", { code: created.room.code, gameId: "hh-astra-mmo" });
  assert.equal(joined.room.members.length, 2);
  assert.equal((await joinedEvent).member.user.name, "Game Player Two");

  const chatEvent = once(one, "game:chat");
  await emitAck(two, "game:chat", { body: "Sẵn sàng khám phá thiên hà!" });
  assert.match((await chatEvent).body, /thiên hà/);

  const readyFromOne = once(two, "game:ready");
  const readyOne = await emitAck(one, "game:ready", { ready: true });
  assert.equal(readyOne.allReady, false);
  assert.equal((await readyFromOne).ready, true);

  const readyFromTwo = once(one, "game:ready");
  const readyTwo = await emitAck(two, "game:ready", { ready: true });
  assert.equal(readyTwo.allReady, true);
  assert.equal((await readyFromTwo).allReady, true);

  const startEvent = once(two, "game:start");
  await emitAck(one, "game:start", { seed: 138200312 });
  assert.equal((await startEvent).gameId, "hh-astra-mmo");

  const stateEvent = once(two, "game:state");
  one.emit("game:state", { state: { x: 44, y: -12, map: "Orion" } });
  assert.equal((await stateEvent).state.map, "Orion");

  const scoreEvent = once(one, "game:score");
  const score = await emitAck(two, "game:score", { score: 20260, level: 9, rank: "Captain" });
  assert.equal(score.score.value, 20260);
  assert.equal((await scoreEvent).score.rank, "Captain");

  const leftEvent = once(one, "game:member:left");
  await emitAck(two, "game:room:leave");
  assert.equal((await leftEvent).socketId, two.id);
});
