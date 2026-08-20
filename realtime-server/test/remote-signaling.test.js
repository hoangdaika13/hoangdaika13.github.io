"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  registerRemoteSignaling,
  normalizeCode,
  normalizeSignal,
  SESSION_TTL_MS,
  MAX_VIEWERS,
  MAX_PENDING,
  MAX_SIGNAL_BYTES,
  PENDING_TTL_MS,
  RECOVERY_TTL_MS
} = require("../src/remote-signaling");

class FakeSocket {
  constructor(id, origin = "") {
    this.id = id;
    this.connected = true;
    this.data = {};
    this.handlers = new Map();
    this.outgoing = [];
    this.rooms = new Set();
    this.handshake = { headers: { origin } };
  }
  on(event, handler) { this.handlers.set(event, handler); }
  emit(event, payload) { this.outgoing.push({ event, payload }); }
  async join(room) { this.rooms.add(room); }
  async leave(room) { this.rooms.delete(room); }
  disconnect() { this.connected = false; this.disconnected = true; }
  async trigger(event, payload = {}) {
    return new Promise((resolve, reject) => {
      const handler = this.handlers.get(event);
      if (!handler) return reject(new Error(`Missing handler ${event}`));
      let callbackCalled = false;
      const callback = (result) => { callbackCalled = true; resolve(result); };
      Promise.resolve(handler(payload, callback)).then(() => {
        if (!callbackCalled && event === "disconnect") resolve(undefined);
      }).catch(reject);
    });
  }
}

class FakeIO {
  constructor() {
    this.connectionHandler = null;
    this.outgoing = [];
    this.sockets = { sockets: new Map() };
  }
  on(event, handler) { if (event === "connection") this.connectionHandler = handler; }
  connect(socket) { this.sockets.sockets.set(socket.id, socket); this.connectionHandler(socket); }
  to(target) { return { emit: (event, payload) => this.outgoing.push({ target, event, payload }) }; }
  in(room) {
    return { fetchSockets: async () => [...this.sockets.sockets.values()].filter((socket) => socket.rooms.has(room)) };
  }
}

test("Remote signaling constants stay intentionally bounded", () => {
  assert.equal(normalizeCode("ab-cd 2345"), "ABCD2345");
  assert.equal(SESSION_TTL_MS, 15 * 60 * 1000);
  assert.equal(MAX_VIEWERS, 1);
  assert.equal(MAX_PENDING, 8);
  assert.equal(MAX_SIGNAL_BYTES, 96_000);
  assert.equal(PENDING_TTL_MS, 60_000);
  assert.equal(RECOVERY_TTL_MS, 45_000);
  assert.deepEqual(normalizeSignal({ type: "offer", description: { type: "offer", sdp: "v=0" }, secret: "drop-me" }), { type: "offer", description: { type: "offer", sdp: "v=0" } });
  assert.equal(normalizeSignal({ type: "offer", description: { type: "answer", sdp: "v=0" } }), null);
  assert.equal(normalizeSignal({ type: "candidate", candidate: null }), null);
});

test("Host creates, viewer requests, host approves and only paired peers can signal", async () => {
  const io = new FakeIO();
  const iceServers = [{ urls: "stun:example.test" }];
  registerRemoteSignaling({ io, iceServers });
  const host = new FakeSocket("host-1");
  const viewer = new FakeSocket("viewer-1");
  const stranger = new FakeSocket("stranger-1");
  io.connect(host);
  io.connect(viewer);
  io.connect(stranger);

  const created = await host.trigger("remote:session:create", { name: "PC", device: "Windows" });
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-Z2-9]{8}$/);
  assert.match(created.pin, /^\d{6}$/);
  assert.ok(created.hostToken.length >= 24);

  const denied = await viewer.trigger("remote:session:join", { code: created.code, pin: "999999" });
  assert.equal(denied.ok, false);

  const requested = await viewer.trigger("remote:session:join", { code: created.code, pin: created.pin, name: "Phone", device: "Android" });
  assert.equal(requested.ok, true);
  assert.equal(requested.pending, true);
  assert.ok(io.outgoing.some((item) => item.target === host.id && item.event === "remote:join:requested"));

  const approved = await host.trigger("remote:session:approve", {
    code: created.code,
    hostToken: created.hostToken,
    requestId: requested.requestId,
    accept: true
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.accepted, true);
  assert.ok(viewer.outgoing.some((item) => item.event === "remote:join:approved"));

  const signaled = await host.trigger("remote:signal", {
    code: created.code,
    targetSocketId: viewer.id,
    signal: { type: "offer", description: { type: "offer", sdp: "v=0" } }
  });
  assert.equal(signaled.ok, true);

  const blocked = await stranger.trigger("remote:signal", {
    code: created.code,
    targetSocketId: host.id,
    signal: { type: "offer", description: { type: "offer", sdp: "v=0" } }
  });
  assert.equal(blocked.ok, false);
});

test("Host cannot join its own session and a session accepts one approved viewer", async () => {
  const io = new FakeIO();
  registerRemoteSignaling({ io });
  const host = new FakeSocket("host");
  const first = new FakeSocket("first");
  const second = new FakeSocket("second");
  io.connect(host);
  io.connect(first);
  io.connect(second);
  const created = await host.trigger("remote:session:create");
  const selfJoin = await host.trigger("remote:session:join", { code: created.code, pin: created.pin });
  assert.equal(selfJoin.ok, false);
  const request = await first.trigger("remote:session:join", { code: created.code, pin: created.pin });
  await host.trigger("remote:session:approve", { code: created.code, hostToken: created.hostToken, requestId: request.requestId, accept: true });
  const full = await second.trigger("remote:session:join", { code: created.code, pin: created.pin });
  assert.equal(full.ok, false);
  assert.match(full.error, /đủ người xem/i);
});

test("Host can lock joins, revoke a viewer and viewer can recover with an ephemeral token", async () => {
  const io = new FakeIO();
  registerRemoteSignaling({ io });
  const host = new FakeSocket("host");
  const viewer = new FakeSocket("viewer");
  const newcomer = new FakeSocket("newcomer");
  io.connect(host);
  io.connect(viewer);
  io.connect(newcomer);
  const created = await host.trigger("remote:session:create");
  const locked = await host.trigger("remote:session:lock", { code: created.code, hostToken: created.hostToken, locked: true });
  assert.equal(locked.locked, true);
  const blocked = await newcomer.trigger("remote:session:join", { code: created.code, pin: created.pin });
  assert.match(blocked.error, /khóa/i);
  await host.trigger("remote:session:lock", { code: created.code, hostToken: created.hostToken, locked: false });
  const request = await viewer.trigger("remote:session:join", { code: created.code, pin: created.pin });
  await host.trigger("remote:session:approve", { code: created.code, hostToken: created.hostToken, requestId: request.requestId, accept: true });
  const approvedEvent = viewer.outgoing.find((item) => item.event === "remote:join:approved");
  assert.ok(approvedEvent.payload.reconnectToken);
  await viewer.trigger("disconnect");
  const recovered = new FakeSocket("viewer-recovered");
  io.connect(recovered);
  const recovery = await recovered.trigger("remote:session:recover", { code: created.code, reconnectToken: approvedEvent.payload.reconnectToken });
  assert.equal(recovery.recovered, true);
  assert.ok(recovered.outgoing.some((item) => item.event === "remote:join:approved" && item.payload.recovered));
  const revoked = await host.trigger("remote:session:revoke", { code: created.code, hostToken: created.hostToken, targetSocketId: recovered.id });
  assert.equal(revoked.revoked, true);
  assert.ok(recovered.outgoing.some((item) => item.event === "remote:session:revoked"));
});

test("Remote signaling rejects browser origins outside the explicit allowlist", () => {
  const io = new FakeIO();
  registerRemoteSignaling({ io, allowedOrigins: ["https://hoang8.com"] });
  const trusted = new FakeSocket("trusted", "https://hoang8.com");
  const rejected = new FakeSocket("rejected", "https://evil.example");
  io.connect(trusted);
  io.connect(rejected);
  assert.equal(trusted.disconnected, undefined);
  assert.equal(rejected.disconnected, true);
  assert.ok(rejected.outgoing.some((item) => item.event === "remote:error"));
});
