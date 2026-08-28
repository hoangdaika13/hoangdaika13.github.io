const test = require("node:test");
const assert = require("node:assert/strict");

const { createRealtimeCore, normalizeUrl } = require("../realtime-core.js");

class Emitter {
  constructor() { this.handlers = new Map(); }
  on(event, handler) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event).add(handler); return this; }
  off(event, handler) { this.handlers.get(event)?.delete(handler); return this; }
  fire(event, payload) { for (const handler of this.handlers.get(event) || []) handler(payload); }
}

class FakeSocket extends Emitter {
  constructor(ack = {}) {
    super();
    this.io = new Emitter();
    this.connected = false;
    this.recovered = false;
    this.ack = ack;
    this.emitted = [];
    this.connectCount = 0;
    this.disconnectCount = 0;
    this.volatile = this;
  }
  connect() { this.connectCount += 1; this.connected = true; this.fire("connect"); }
  disconnect() { this.disconnectCount += 1; this.connected = false; this.fire("disconnect", "io client disconnect"); }
  timeout() { return this; }
  emit(event, payload, callback) {
    this.emitted.push([event, payload]);
    if (callback) {
      const response = this.ack[event] || { ok: true };
      queueMicrotask(() => callback(null, response));
    }
    return this;
  }
}

function harness(socket) {
  const events = [];
  const scope = {
    location: { origin: "https://hoang8.com" },
    io: () => socket,
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    dispatchEvent(event) { events.push(event); }
  };
  return { scope, events };
}

test("normalizes only HTTPS and local HTTP realtime origins", () => {
  assert.equal(normalizeUrl("https://rt.example.com/path", { origin: "https://hoang8.com" }), "https://rt.example.com");
  assert.equal(normalizeUrl("http://127.0.0.1:4000/path", { origin: "https://hoang8.com" }), "http://127.0.0.1:4000");
  assert.equal(normalizeUrl("http://remote.example.com", { origin: "https://hoang8.com" }), "");
  assert.equal(normalizeUrl("javascript:alert(1)", { origin: "https://hoang8.com" }), "");
});

test("owns one socket, keeps scoped subscriptions and supports acknowledgements", async () => {
  const socket = new FakeSocket({ "room:join": { ok: true, room: "A" } });
  const { scope, events } = harness(socket);
  const core = createRealtimeCore(scope, { url: "https://rt.example.com", auth: () => ({ token: "user-token" }) });
  const received = [];
  const unsubscribe = core.subscribe("feature-a", "remote:update", (payload) => received.push(payload));

  assert.equal(await core.connect(), socket);
  assert.equal(await core.connect(), socket);
  assert.equal(socket.connectCount, 1);
  socket.fire("realtime:hello", { authenticated: true, capabilities: { workspace: true } });
  assert.equal(core.status().confirmed, true);
  assert.equal(core.status().capabilities.workspace, true);
  socket.fire("remote:update", { revision: 2 });
  assert.deepEqual(received, [{ revision: 2 }]);

  assert.deepEqual(await core.emit("room:join", { code: "A" }), { ok: true, room: "A" });
  await core.emit("cursor", { x: 1 }, { ack: false, volatile: true });
  assert.ok(socket.emitted.some(([event]) => event === "cursor"));
  assert.ok(events.some((event) => event.type === "hh:realtime-ready"));

  unsubscribe();
  socket.fire("remote:update", { revision: 3 });
  assert.equal(received.length, 1);
  core.dispose();
  assert.equal(socket.disconnectCount, 1);
});

test("rejects server acknowledgement failures and reports recovery state", async () => {
  const socket = new FakeSocket({ rejected: { ok: false, error: "Từ chối", code: "DENIED" } });
  socket.recovered = true;
  const { scope } = harness(socket);
  const core = createRealtimeCore(scope, { url: "https://rt.example.com" });
  await core.connect();
  assert.equal(core.status().state, "recovered");
  await assert.rejects(core.emit("rejected", {}), (error) => error.code === "DENIED" && /Từ chối/.test(error.message));
});
