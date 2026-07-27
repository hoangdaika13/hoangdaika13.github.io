const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const port = 4322;
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

function connectPlayer() {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      auth: {
        anonymousId: "astral-authoritative-player",
        gameName: "Astral Explorer",
        consent: false
      },
      transports: ["websocket"]
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

test("HH Astral Realms limits movement and resolves combat on the authoritative server", { timeout: 20000 }, async (t) => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_URL: "http://127.0.0.1:4173",
      ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      MONGODB_URI: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let socket;
  t.after(() => {
    socket?.close();
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

  socket = await connectPlayer();
  const room = await emitAck(socket, "game:room:create", {
    gameId: "astral-realms",
    name: "Authoritative Astral Shard",
    visibility: "private",
    maxPlayers: 4
  });
  assert.match(room.room.code, /^[A-Z0-9]{6}$/);

  const firstInput = await emitAck(socket, "astral-realms:input", {
    seq: 1,
    spawn: { x: -45, z: 19 },
    move: { x: 999, z: 999 },
    sprint: true,
    element: "plasma",
    action: "attack",
    targetId: "aurora-wisp-1",
    power: 999
  });
  assert.equal(firstInput.integrity, "server-authoritative");

  await emitAck(socket, "astral-realms:input", {
    seq: 2,
    move: { x: 999, z: 999 },
    sprint: true,
    action: "attack",
    targetId: "aurora-wisp-1",
    power: 999
  });
  await new Promise((resolve) => setTimeout(resolve, 220));

  const snapshot = await emitAck(socket, "astral-realms:sync");
  assert.equal(snapshot.integrity, "server-authoritative");
  assert.equal(snapshot.gameId, "astral-realms");
  assert.equal(snapshot.players.length, 1);
  assert.equal(snapshot.players[0].socketId, socket.id);
  assert.equal(snapshot.players[0].characterId, "lyra");
  assert.ok(Math.hypot(snapshot.players[0].x + 45, snapshot.players[0].z - 19) < 2.5);

  const target = snapshot.enemies.find((enemy) => enemy.id === "aurora-wisp-1");
  assert.ok(target);
  assert.equal(target.health, 80);
  const boss = snapshot.enemies.find((enemy) => enemy.id === "nexus-warden");
  assert.equal(boss.bossPhase, 1);
  assert.equal(boss.maxShield, 320);
});
