const test = require("node:test");
const assert = require("node:assert/strict");
const { registerPlayRealtime } = require("../src/play-realtime");

class FakeIO {
  constructor() { this.handlers = {}; this.emitted = []; }
  on(event, handler) { this.handlers[event] = handler; }
  to(room) { return { emit: (event, payload) => this.emitted.push({ room, event, payload }) }; }
}

class FakeSocket {
  constructor(id, user = null) { this.id = id; this.user = user; this.handlers = {}; this.rooms = new Set(); }
  on(event, handler) { this.handlers[event] = handler; }
  async join(room) { this.rooms.add(room); }
  async leave(room) { this.rooms.delete(room); }
  emit(event, payload, callback) { this.lastEmit = { event, payload }; if (callback) callback({ ok: true }); }
  async trigger(event, payload = {}) { return this.handlers[event]?.(payload, (response) => { this.response = response; }); }
}

test("HH Play realtime requires authentication and keeps room discovery private", async () => {
  const io = new FakeIO();
  const adapter = registerPlayRealtime({ io, maxRooms: 5, maxMembers: 4 });
  const guest = new FakeSocket("guest");
  await io.handlers.connection(guest);
  await guest.trigger("play:room:create", { name: "Không được" });
  assert.equal(guest.response.ok, false);
  assert.equal(guest.response.code, "AUTH_REQUIRED");
  assert.equal(adapter.rooms.size, 0);
});

test("Authenticated host and player receive authoritative presence", async () => {
  const io = new FakeIO();
  const adapter = registerPlayRealtime({ io, maxRooms: 5, maxMembers: 4 });
  const host = new FakeSocket("host", { _id: "u-host", name: "Host" });
  const player = new FakeSocket("player", { _id: "u-player", name: "Player" });
  await io.handlers.connection(host); await io.handlers.connection(player);
  await host.trigger("play:room:create", { name: "Arena", game: "quiz", maxMembers: 3 });
  assert.equal(host.response.ok, true);
  const code = host.response.room.code;
  await player.trigger("play:room:join", { code, role: "host" });
  assert.equal(player.response.ok, true);
  assert.equal(player.response.self.role, "player");
  assert.equal(player.response.room.members.length, 2);
  assert.equal(adapter.rooms.get(code).members.size, 2);
  await host.trigger("play:room:state", { state: { phase: "playing", score: 4 } });
  assert.equal(host.response.ok, true);
  assert.equal(adapter.rooms.get(code).state.score, 4);
  await player.trigger("play:room:state", { state: { score: 999 } });
  assert.equal(player.response.ok, false);
  assert.equal(player.response.code, "HOST_REQUIRED");
  await player.trigger("play:room:event", { type: "watch:control", data: { action: "toggle" } });
  assert.equal(player.response.ok, false);
  assert.equal(player.response.code, "HOST_REQUIRED");
});
