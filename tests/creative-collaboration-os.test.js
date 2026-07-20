const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "..", "creative-collaboration-os.js");
const cssPath = path.resolve(__dirname, "..", "creative-collaboration-os.css");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const creative = require(sourcePath);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function deterministicStore(options = {}) {
  let tick = 0;
  return creative.createStore({
    storage: Object.prototype.hasOwnProperty.call(options, "storage") ? options.storage : null,
    currentUser: options.currentUser || { id: "owner", name: "Owner", email: "private@example.com", accessToken: "secret" },
    now: () => new Date(Date.UTC(2026, 6, 20, 10, 0, tick++)).toISOString(),
    idFactory: (prefix) => `${prefix}-${++tick}`
  });
}

class FakeSocket {
  constructor() {
    this.connected = false;
    this.handlers = new Map();
    this.emitted = [];
    this.disconnected = false;
  }
  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
  }
  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }
  emit(event, payload) {
    this.emitted.push([event, payload]);
  }
  fire(event, payload) {
    for (const handler of this.handlers.get(event) || []) handler(payload);
  }
  disconnect() { this.disconnected = true; }
}

test("exposes the Creative Collaboration OS global and helper contract", () => {
  assert.equal(creative.VERSION, 1);
  assert.equal(creative.STORAGE_KEY, "hh.creative-collaboration.v1");
  assert.equal(creative.FORMAT, "hh-creative-collaboration-report");
  assert.deepEqual(creative.STATUSES, ["draft", "review", "approved", "published"]);
  for (const helper of ["createStore", "createSocketProtocol", "createRealtimeClient", "diffData", "canTransition", "mount", "unmount"]) {
    assert.equal(typeof creative[helper], "function", `${helper} should be exposed`);
  }
  assert.match(source, /globalScope\.HHCreativeCollaborationOS = api/);
  assert.equal(creative.normalizeSocketUrl("javascript:alert(1)"), "");
  assert.equal(creative.normalizeSocketUrl("http://remote.example.com"), "");
  assert.equal(creative.normalizeSocketUrl("http://127.0.0.1:4100/path"), "http://127.0.0.1:4100");
  assert.equal(creative.normalizeSocketUrl("https://realtime.example.com/path"), "https://realtime.example.com");
});

test("persists a bounded versioned local-first envelope", () => {
  const storage = memoryStorage();
  const store = deterministicStore({ storage });
  const state = JSON.parse(storage.value(creative.STORAGE_KEY));
  assert.equal(state.version, 1);
  assert.equal(state.projects.length, 1);
  assert.equal(store.getPersistence().key, creative.STORAGE_KEY);
  assert.equal(store.getPersistence().type, "localStorage");

  const reopened = creative.createStore({ storage, currentUser: { id: "owner", name: "Owner" } });
  assert.equal(reopened.getProject().title, "Chiến dịch Creative OS");
});

test("validates the Draft to Review to Approved to Published workflow", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  assert.equal(creative.canTransition("draft", "review"), true);
  assert.equal(creative.canTransition("draft", "approved"), false);
  assert.throws(() => store.transition(id, "approved"), { code: "INVALID_TRANSITION" });
  assert.equal(store.transition(id, "review").status, "review");
  assert.equal(store.transition(id, "approved").status, "approved");
  assert.equal(store.transition(id, "published").status, "published");
  assert.throws(() => store.transition(id, "draft"), { code: "INVALID_TRANSITION" });
});

test("request changes returns review work to an editable state with an audit reason", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  store.transition(id, "review");
  const updated = store.requestChanges(id, "  Chỉnh màu CTA và nhịp dựng  ");
  assert.equal(updated.status, "draft");
  assert.equal(updated.requestChanges.reason, "Chỉnh màu CTA và nhịp dựng");
  assert.equal(store.getAudit(id).at(-1).type, "review.changes-requested");
  assert.throws(() => store.requestChanges(id, "again"), { code: "INVALID_TRANSITION" });
});

test("approved and published projects lock content mutations", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  store.transition(id, "review");
  store.transition(id, "approved");
  assert.throws(() => store.updateSnapshots(id, { after: { data: { title: "Changed" } } }), { code: "REVIEW_LOCKED" });
  assert.throws(() => store.addTimelineChange(id, { path: "$.title", before: "A", after: "B" }), { code: "REVIEW_LOCKED" });
  store.requestChanges(id, "Cần mở lại");
  assert.doesNotThrow(() => store.addTimelineChange(id, { path: "$.title", before: "A", after: "B" }));
});

test("threads support frame, timecode, replies, resolve and approval gates", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  const thread = store.addThread(id, { frame: 42, timecode: "1:2:3:4", x: 2, y: -1, body: "Fix <b>title</b>" }, { id: "reviewer", name: "Reviewer" });
  assert.equal(thread.frame, 42);
  assert.equal(thread.timecode, "01:02:03:04");
  assert.equal(thread.x, 1);
  assert.equal(thread.y, 0);
  store.addReply(id, thread.id, { body: "Đã sửa" });
  store.transition(id, "review");
  assert.throws(() => store.transition(id, "approved"), { code: "OPEN_THREADS" });
  store.resolveThread(id, thread.id, true);
  assert.equal(store.transition(id, "approved").status, "approved");
  assert.equal(store.getProject(id).threads[0].replies.length, 1);
});

test("produces deterministic path-level before and after diffs", () => {
  const changes = creative.diffData(
    { title: "A", scenes: [{ id: "one", duration: 4 }], meta: { width: 100 } },
    { title: "B", scenes: [{ id: "one", duration: 6 }, { id: "two" }], meta: { width: 100, height: 50 } }
  );
  assert.deepEqual(changes.map((change) => [change.path, change.type]), [
    ["$.meta.height", "added"],
    ["$.scenes[0].duration", "changed"],
    ["$.scenes[1]", "added"],
    ["$.title", "changed"]
  ]);
  changes[0].after = "mutated";
  assert.equal(creative.diffData({ a: 1 }, { a: 2 })[0].after, 2);
});

test("enforces layer and scene lock ownership", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  const owner = { id: "owner", name: "Owner" };
  const peer = { id: "peer", name: "Peer" };
  const layerLock = store.acquireLock(id, { targetId: "headline", targetType: "layer" }, owner);
  assert.equal(layerLock.targetType, "layer");
  assert.throws(() => store.acquireLock(id, { targetId: "headline", targetType: "layer" }, peer), { code: "LOCK_CONFLICT" });
  assert.throws(() => store.releaseLock(id, layerLock.id, peer), { code: "LOCK_OWNER_REQUIRED" });
  assert.equal(store.releaseLock(id, layerLock.id, owner).targetId, "headline");
  assert.equal(store.acquireLock(id, { targetId: "scene-01", targetType: "scene" }, peer).targetType, "scene");
});

test("timeline changes can be accepted or rejected once and are audited", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  const first = store.addTimelineChange(id, { path: "$.timeline[0].duration", before: 8, after: 10, summary: "Tăng duration" });
  const second = store.addTimelineChange(id, { path: "$.timeline[1].muted", before: false, after: true, summary: "Tắt track" });
  assert.equal(store.decideTimelineChange(id, first.id, "accepted").status, "accepted");
  assert.equal(store.decideTimelineChange(id, second.id, "rejected").status, "rejected");
  assert.throws(() => store.decideTimelineChange(id, first.id, "rejected"), { code: "CHANGE_DECIDED" });
  const types = store.getAudit(id).map((entry) => entry.type);
  assert.ok(types.includes("collaboration.change-accepted"));
  assert.ok(types.includes("collaboration.change-rejected"));
});

test("remote echoes are idempotent and bounded change payloads are rejected", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  const peer = { id: "peer", name: "Peer", email: "private@example.com" };
  const message = { id: "remote-message-1", body: "Xin chào", user: peer };
  store.applyRemote(id, creative.SOCKET_EVENTS.CHAT, message);
  store.applyRemote(id, creative.SOCKET_EVENTS.CHAT, message);
  assert.equal(store.getProject(id).chat.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(store.getProject(id).chat[0].author, "email"), false);

  const change = { id: "remote-change-1", path: "$.timeline[0].duration", before: 4, after: 6, summary: "Kéo dài", user: peer };
  store.applyRemote(id, creative.SOCKET_EVENTS.CHANGE, change);
  store.applyRemote(id, creative.SOCKET_EVENTS.CHANGE, change);
  store.applyRemote(id, creative.SOCKET_EVENTS.DECISION, { changeId: change.id, decision: "accepted", user: peer });
  store.applyRemote(id, creative.SOCKET_EVENTS.DECISION, { changeId: change.id, decision: "accepted", user: peer });
  assert.equal(store.getProject(id).timelineChanges.length, 1);
  assert.equal(store.getProject(id).timelineChanges[0].status, "accepted");

  assert.throws(() => store.addTimelineChange(id, { path: "$.huge", before: "x".repeat(creative.LIMITS.changeBytes + 1), after: "small" }), { code: "CHANGE_TOO_LARGE" });
});

test("audit entries are ordered, linked and report output is escaped", () => {
  const store = deterministicStore();
  const id = store.getState().activeProjectId;
  const thread = store.addThread(id, { body: "<script>window.bad=true</script>", timecode: "00:00:01:00" }, { id: "x", name: "<b>Reviewer</b>" });
  store.resolveThread(id, thread.id, true);
  const audit = store.getAudit(id);
  assert.deepEqual(audit.map((entry) => entry.sequence), [1, 2]);
  assert.equal(audit[0].previousId, null);
  assert.equal(audit[1].previousId, audit[0].id);

  const html = store.exportReport(id, "html");
  assert.match(html, /&lt;script&gt;window\.bad=true&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>window\.bad=true<\/script>/);
  const json = JSON.parse(store.exportReport(id, "json"));
  assert.equal(json.format, creative.FORMAT);
  assert.equal(json.summary.openThreads, 0);
});

test("public user projection does not retain private fields", () => {
  const projected = creative.publicUser({
    id: "u1",
    name: "User",
    email: "secret@example.com",
    password: "nope",
    accessToken: "token",
    avatar: "https://example.com/avatar.png"
  });
  assert.deepEqual(Object.keys(projected), ["id", "name", "avatar", "color"]);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "email"), false);
  const protocol = creative.createSocketProtocol({ projectId: "p1", currentUser: { id: "u1", name: "User", email: "hidden@example.com" } });
  assert.equal(JSON.stringify(protocol.join()).includes("hidden@example.com"), false);
});

test("Socket.io protocol only reports realtime after a real connect and cleans up", async () => {
  const socket = new FakeSocket();
  const received = [];
  const client = creative.createRealtimeClient({
    socketUrl: "https://realtime.example.com",
    projectId: "project-1",
    currentUser: { id: "u1", name: "User", email: "private@example.com" },
    socketFactory: () => socket,
    onEvent: (event, payload) => received.push([event, payload])
  });
  assert.equal(client.getState().realtime, false);
  await client.connect();
  assert.equal(client.getState().mode, "connecting");
  socket.fire("connect");
  assert.equal(client.getState().realtime, true);
  assert.equal(client.getState().secure, true);
  const join = socket.emitted.find(([event]) => event === creative.SOCKET_EVENTS.JOIN);
  assert.ok(join);
  assert.equal(JSON.stringify(join[1]).includes("private@example.com"), false);
  assert.equal(client.emit(creative.SOCKET_EVENTS.CHAT, { body: "hello" }), true);
  socket.fire(creative.SOCKET_EVENTS.CHAT, { user: { id: "peer", name: "Peer", email: "hidden@example.com" }, payload: { body: "remote" } });
  assert.equal(received.at(-1)[0], creative.SOCKET_EVENTS.CHAT);
  assert.equal(received.at(-1)[1].body, "remote");
  assert.equal(received.at(-1)[1].user.id, "peer");
  assert.equal(Object.prototype.hasOwnProperty.call(received.at(-1)[1].user, "email"), false);
  socket.fire("disconnect", "transport close");
  assert.equal(client.getState().mode, "reconnecting");
  assert.equal(client.getState().realtime, false);
  client.dispose();
  assert.equal(socket.disconnected, true);
  for (const handlers of socket.handlers.values()) assert.equal(handlers.size, 0);
});

test("without Socket.io the module states local single-user mode truthfully", async () => {
  const client = creative.createRealtimeClient({ projectId: "local" });
  const state = await client.connect();
  assert.equal(state.mode, "local");
  assert.equal(state.realtime, false);
  assert.match(state.error, /cục bộ một người/i);
  assert.equal(client.emit(creative.SOCKET_EVENTS.CHAT, { body: "not sent" }), false);
  client.dispose();
});

test("UI contract includes both views, responsive keyboard controls and reduced motion", () => {
  for (const token of [
    "data-hh-creative-collaboration",
    "data-cco-view=\"review\"",
    "data-cco-view=\"collaboration\"",
    "data-cco-comment-form",
    "data-cco-chat-form",
    "data-cco-canvas",
    "data-cco-transition",
    "data-cco-change",
    "role=\"tablist\"",
    "aria-live=\"polite\"",
    "ArrowLeft",
    "ArrowRight",
    "Escape",
    "Cục bộ một người",
    "Không tuyên bố realtime khi chưa kết nối"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  for (const token of ["focus-visible", "@media (max-width: 390px)", "@media (prefers-reduced-motion: reduce)", ".cco-review-layout", ".cco-collab-layout"]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  assert.match(source, /escapeHtml\(thread\.body\)/);
  assert.match(source, /escapeHtml\(message\.body\)/);
  assert.doesNotMatch(source, /service[_-]?role|api[_-]?secret|private[_-]?key|mongodb\+srv|eval\s*\(|new Function/i);
});
