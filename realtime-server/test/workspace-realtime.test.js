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

  const focusCreated = await emitAck(host, "workspace:room:create", {
    service: "focus-room",
    name: "Cùng học buổi tối",
    state: {
      sceneId: "library-night",
      timer: { phase: "focus", focusMinutes: 50, breakMinutes: 10, cycles: 4, cycle: 1, duration: 3000, remaining: 2940, running: true },
      audio: { master: 0.42, mix: { rain: 0.3, brown: 0.2, unknown: 1 } },
      tasks: [{ title: "Không được truyền" }],
      note: "Dữ liệu riêng"
    }
  });
  assert.equal(focusCreated.ok, true);
  assert.deepEqual(Object.keys(focusCreated.room.state).sort(), ["audio", "sceneId", "timer", "updatedAt"]);
  assert.equal(focusCreated.room.state.sceneId, "library-night");
  assert.equal(focusCreated.room.state.timer.focusMinutes, 50);
  assert.equal(focusCreated.room.state.audio.mix.unknown, undefined);
  assert.equal(focusCreated.room.state.note, undefined);
  assert.equal(focusCreated.room.state.tasks, undefined);

  const focusJoined = await emitAck(peer, "workspace:room:join", { service: "focus-room", code: focusCreated.room.code });
  assert.equal(focusJoined.ok, true);
  const deniedFocusScene = await emitAck(peer, "workspace:room:event", { service: "focus-room", type: "scene:set", data: { sceneId: "ocean-sunset" } });
  assert.equal(deniedFocusScene.code, "HOST_REQUIRED");
  const deniedFocusState = await emitAck(peer, "workspace:room:state", { service: "focus-room", state: { sceneId: "ocean-sunset" } });
  assert.equal(deniedFocusState.code, "HOST_REQUIRED");

  const focusStatePromise = waitFor(peer, "workspace:room:state", (payload) => payload.service === "focus-room" && payload.state.sceneId === "ocean-sunset");
  const focusStateAck = await emitAck(host, "workspace:room:state", {
    service: "focus-room",
    state: {
      sceneId: "OCEAN-SUNSET",
      timer: { phase: "break", focusMinutes: 45, breakMinutes: 15, cycles: 3, cycle: 2, duration: 900, remaining: 600, running: false },
      audio: { master: 3, mix: { ocean: -1, pink: 0.15 } },
      history: [{ duration: 999 }]
    }
  });
  assert.equal(focusStateAck.ok, true);
  const focusState = await focusStatePromise;
  assert.equal(focusState.state.sceneId, "ocean-sunset");
  assert.equal(focusState.state.timer.phase, "break");
  assert.equal(focusState.state.timer.remaining, 600);
  assert.equal(focusState.state.audio.master, 1);
  assert.equal(focusState.state.audio.mix.ocean, 0);
  assert.equal(focusState.state.history, undefined);

  const transferPromise = waitFor(peer, "workspace:room:presence", (payload) => payload.service === "focus-room" && payload.members.some((member) => member.role === "host"));
  await emitAck(host, "workspace:room:leave", { service: "focus-room" });
  const transferred = await transferPromise;
  assert.equal(transferred.members.find((member) => member.role === "host")?.id, focusJoined.self.id);
  const transferredHostUpdate = await emitAck(peer, "workspace:room:state", { service: "focus-room", state: focusState.state });
  assert.equal(transferredHostUpdate.ok, true);

  assert.equal((await emitAck(host, "workspace:resource:join", { service: "team-board", resourceId: "board-1" })).ok, true);
  assert.equal((await emitAck(peer, "workspace:resource:join", { service: "team-board", resourceId: "board-1" })).ok, true);
  const invalidationPromise = waitFor(peer, "workspace:resource:event", (payload) => payload.resourceId === "board-1");
  const invalidated = await emitAck(host, "workspace:resource:event", { service: "team-board", resourceId: "board-1", type: "invalidate", data: { action: "update-task", taskId: "task-1" } });
  assert.equal(invalidated.ok, true);
  assert.equal((await invalidationPromise).data.taskId, "task-1");
  const deniedResource = await emitAck(peer, "workspace:resource:join", { service: "team-board", resourceId: "private-board" });
  assert.equal(deniedResource.code, "ACCESS_DENIED");
  assert.equal(registry.capabilities.roomDiscovery, "disabled");
  assert.ok(registry.capabilities.services.includes("focus-room"));
});
