const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const port = 4317;
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

function connectPilot(id, name) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      auth: { anonymousId: id, astraName: name, consent: false },
      transports: ["websocket"]
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

test("two ASTRA pilots share a room, movement and actions over Socket.io", { timeout: 20000 }, async (t) => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_URL: "http://127.0.0.1:4173",
      ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      MAX_ASTRA_PLAYERS: "10",
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
    connectPilot("integration-pilot-one", "Astra Pilot One"),
    connectPilot("integration-pilot-two", "Astra Pilot Two")
  ]);
  sockets.push(one, two);

  const created = await emitAck(one, "astra:room:create", { name: "Integration Expedition", visibility: "private", ship: "asteria" });
  assert.match(created.room.code, /^[A-Z0-9]{6}$/);
  assert.equal(created.room.players[0].user.guest, true);

  const joined = await emitAck(two, "astra:room:join", { code: created.room.code, ship: "aurora" });
  assert.equal(joined.room.players.length, 2);
  assert.equal(joined.room.maxPlayers, 10);

  const stateEvent = once(two, "astra:state");
  one.emit("astra:state", { x: 123, y: -77, vx: 8, vy: 4, angle: 1.2, shield: 92, hull: 100, thrusting: true });
  const state = await stateEvent;
  assert.equal(state.socketId, one.id);
  assert.equal(state.state.x, 123);
  assert.equal(state.state.y, -77);

  const actionEvent = once(one, "astra:action");
  two.emit("astra:action", { type: "scan", targetId: "planet-test", detail: "survey" });
  const action = await actionEvent;
  assert.equal(action.socketId, two.id);
  assert.equal(action.type, "scan");

  const leftEvent = once(one, "astra:player:left");
  await emitAck(two, "astra:room:leave");
  assert.equal((await leftEvent).socketId, two.id);
});
