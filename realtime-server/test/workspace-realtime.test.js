"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Server } = require("socket.io");
const { io: Client } = require("socket.io-client");
const { registerWorkspaceRealtime } = require("../src/workspace-realtime");

const emitAck = (socket, event, payload) => new Promise((resolve, reject) => {
  socket.timeout(2500).emit(event, payload, (error, response) => error ? reject(error) : resolve(response));
});

const waitFor = (socket, event, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timeout waiting for ${event}`)); }, 2500);
  const handler = (payload) => {
    if (!predicate(payload)) return;
    clearTimeout(timer);
    socket.off(event, handler);
    resolve(payload);
  };
  socket.on(event, handler);
});

const connect = (url, userId = "") => new Promise((resolve, reject) => {
  const socket = Client(url, { transports: ["websocket"], auth: { userId }, reconnection: false, forceNew: true });
  socket.once("connect", () => resolve(socket));
  socket.once("connect_error", reject);
});

test("workspace realtime authenticates, bounds room events and protects team resources", async (t) => {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => {
    const id = String(socket.handshake.auth?.userId || "");
    socket.user = id ? { _id: id, name: `User ${id}`, avatar: "https://example.com/avatar.png" } : null;
    next();
  });
  const registry = registerWorkspaceRealtime({
    io,
    verifyResourceAccess: async ({ service, resourceId, user }) => service === "team-board" && resourceId === "board-1" && user?._id
      ? { role: user._id === "host" ? "owner" : "editor" }
      : null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => io.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  });

  const guest = await connect(url); sockets.push(guest);
  const guestCreate = await emitAck(guest, "workspace:room:create", { service: "dharma-circle", name: "Guest" });
  assert.equal(guestCreate.ok, false);
  assert.equal(guestCreate.code, "AUTH_REQUIRED");

  const host = await connect(url, "host"); sockets.push(host);
  const peer = await connect(url, "peer"); sockets.push(peer);
  const created = await emitAck(host, "workspace:room:create", {
    service: "dharma-circle",
    name: "Đọc Kinh",
    alias: "Thiện Tâm",
    state: { scriptureId: "lang-nghiem", sharedNotes: [] }
  });
  assert.equal(created.ok, true);
  assert.match(created.room.code, /^[A-Z0-9]{6}$/);
  assert.equal(created.self.name, "Thiện Tâm");
  assert.equal(created.self.avatar, "");

  const presencePromise = waitFor(host, "workspace:room:presence", (payload) => payload.code === created.room.code && payload.members.length === 2);
  const joined = await emitAck(peer, "workspace:room:join", { service: "dharma-circle", code: created.room.code, alias: "An Nhiên" });
  assert.equal(joined.ok, true);
  const presence = await presencePromise;
  assert.deepEqual(new Set(presence.members.map((member) => member.name)), new Set(["Thiện Tâm", "An Nhiên"]));

  const notePromise = waitFor(peer, "workspace:room:event", (payload) => payload.type === "note:add");
  const note = await emitAck(host, "workspace:room:event", { service: "dharma-circle", type: "note:add", data: { body: "  Giữ tâm sáng  ", ignored: "x".repeat(4000) } });
  assert.equal(note.ok, true);
  assert.equal(note.data.body, "Giữ tâm sáng");
  assert.equal((await notePromise).data.body, "Giữ tâm sáng");

  const badEvent = await emitAck(peer, "workspace:room:event", { service: "dharma-circle", type: "room:list", data: {} });
  assert.equal(badEvent.code, "EVENT_REJECTED");
  const hugeEvent = await emitAck(peer, "workspace:room:event", { service: "dharma-circle", type: "note:add", data: { body: "x".repeat(20 * 1024) } });
  assert.equal(hugeEvent.code, "EVENT_TOO_LARGE");

  const musicHost = await emitAck(host, "workspace:room:create", { service: "music-jam", state: { jam: { bpm: 96 } } });
  await emitAck(peer, "workspace:room:join", { service: "music-jam", code: musicHost.room.code });
  const deniedTransport = await emitAck(peer, "workspace:room:event", { service: "music-jam", type: "transport:set", data: { playing: true } });
  assert.equal(deniedTransport.code, "HOST_REQUIRED");
  const bounded = await emitAck(peer, "workspace:room:event", { service: "music-jam", type: "param:update", data: { jam: { bpm: 999, density: -30, instrument: "invalid" } } });
  assert.deepEqual(bounded.data.jam, { density: 0, bpm: 200 });

  assert.equal((await emitAck(host, "workspace:resource:join", { service: "team-board", resourceId: "board-1" })).ok, true);
  assert.equal((await emitAck(peer, "workspace:resource:join", { service: "team-board", resourceId: "board-1" })).ok, true);
  const invalidationPromise = waitFor(peer, "workspace:resource:event", (payload) => payload.resourceId === "board-1");
  const invalidated = await emitAck(host, "workspace:resource:event", { service: "team-board", resourceId: "board-1", type: "invalidate", data: { action: "update-task", taskId: "task-1" } });
  assert.equal(invalidated.ok, true);
  assert.equal((await invalidationPromise).data.taskId, "task-1");
  const deniedResource = await emitAck(peer, "workspace:resource:join", { service: "team-board", resourceId: "private-board" });
  assert.equal(deniedResource.code, "ACCESS_DENIED");
  assert.equal(registry.capabilities.roomDiscovery, "disabled");
});
