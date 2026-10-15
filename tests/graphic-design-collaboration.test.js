const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(__dirname, "..", "graphic-design-collaboration.js");
const source = fs.readFileSync(sourcePath, "utf8");
const collaboration = require(sourcePath);

test("exposes the scoped HHGraphicCollaboration mount and unmount API", () => {
  assert.equal(typeof collaboration.mount, "function");
  assert.equal(typeof collaboration.unmount, "function");
  assert.equal(collaboration.VERSION, 1);
  assert.match(source, /globalScope\.HHGraphicCollaboration = api/);
  assert.match(source, /data-hh-design-collaboration/);
});

test("supports the complete design collaboration protocol", () => {
  for (const event of [
    "design:room:create", "design:room:join", "design:room:leave", "design:presence",
    "design:cursor", "design:selection", "design:permission:set", "design:comment:add",
    "design:comment:resolve", "design:lock:acquire", "design:lock:release",
    "design:version:create", "design:branch:create", "design:review:create", "design:review:update"
  ]) assert.match(source, new RegExp(event.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /options\.socketUrl \|\| globalScope\.HH_SOCKET_URL \|\| globalScope\.HH_REALTIME_URL/);
  assert.match(source, /HHRealtimeSocket/);
  assert.match(source, /socket\.io\/socket\.io\.js/);
  assert.match(source, /loadSocketClient/);
});

test("fallback is explicitly read-only and guests remain clearly labeled", () => {
  const fallback = collaboration.createFallbackRoom({ id: "guest:test", name: "Khách thử (chưa đăng nhập)", guest: true });
  assert.equal(fallback.code, "LOCAL");
  assert.equal(fallback.persistence, "local-readonly");
  assert.equal(fallback.members[0].role, "viewer");
  assert.equal(fallback.limits.comments, 0);
  assert.match(source, /chưa đăng nhập/);
  assert.match(source, /Không tuyên bố mã hóa đầu cuối/);
});

test("renders Vietnamese accessible and responsive collaboration controls", () => {
  for (const token of ["Tạo phòng thiết kế", "Ghim bình luận", "Ghi nhận mốc metadata", "Yêu cầu duyệt", "Đang online", "role=\"application\"", "aria-live=\"polite\""]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /@media\(max-width:760px\)/);
  assert.match(source, /@media\(max-width:480px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /focus-visible/);
});

test("document context uses real current-frame layers and content fingerprint, not simulated timestamps", () => {
  const document = { id: "d-one", name: "Actual design", activeFrameId: "frame-a", frames: [{ id: "frame-a", width: 1000, height: 500 }], layers: [{ id: "actual", frameId: "frame-a", name: "My text", type: "text", fill: "#ABCDEF" }, { id: "other", frameId: "frame-b" }] };
  const first = collaboration.documentContext(document);
  assert.equal(first.documentSync, false);
  assert.deepEqual(first.layers.map((item) => item.id), ["actual"]);
  assert.equal(first.layers[0].label, "My text");
  assert.equal(first.fingerprint, collaboration.documentContext(structuredClone(document)).fingerprint);
  const changed = structuredClone(document); changed.layers[0].name = "Edited";
  assert.notEqual(first.fingerprint, collaboration.documentContext(changed).fingerprint);
  assert.equal(collaboration.documentContext(null), null);
});

test("normalizes canvas coordinates for realtime cursors and pinned comments", () => {
  const node = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) };
  assert.deepEqual(collaboration.positionFromEvent({ clientX: 110, clientY: 70 }, node), { x: 50, y: 50 });
  assert.deepEqual(collaboration.positionFromEvent({ clientX: -500, clientY: 900 }, node), { x: 0, y: 100 });
});

test("only reports realtime after a confirmed WebSocket transport", () => {
  assert.equal(collaboration.isWebSocketConfirmed({ connected: false, transport: "websocket" }), false);
  assert.equal(collaboration.isWebSocketConfirmed({ connected: true, transport: "polling" }), false);
  assert.equal(collaboration.isWebSocketConfirmed({ connected: true, io: { engine: { transport: { name: "websocket" } } } }), true);
  assert.equal(collaboration.isWebSocketConfirmed({ connected: true, realtimeConfirmed: true }), true);
});

test("sanitizes server room payloads and keeps an append-only audit chain", () => {
  const room = collaboration.normalizeRoom({
    code: "ROOM<script>", name: "  Demo\u0000  ", persistence: "memory",
    members: [{ socketId: "s1", role: "admin", user: { id: "u1", name: "<img onerror=1>" }, cursor: { x: 999, y: -4, color: "javascript:red" } }],
    comments: [{ id: "c1", body: "hello\u0000", x: 999, y: -1 }]
  });
  assert.equal(room.code.length <= 12, true);
  assert.equal(room.members[0].role, "viewer");
  assert.deepEqual(room.members[0].cursor, { x: 100, y: 0, color: "#62d7e7" });
  assert.equal(room.comments[0].body, "hello");

  let tick = 0;
  const audit = collaboration.createAuditTrail({ now: () => new Date(1700000000000 + tick++ * 1000) });
  const first = audit.append("room.joined", { id: "u1" }, { code: "ROOM" });
  const second = audit.append("lock.acquired", { id: "u1" }, { layerId: "hero" });
  assert.equal(first.sequence, 1);
  assert.equal(second.previousId, first.id);
  const copy = audit.list();
  copy[0].details.code = "mutated";
  assert.equal(audit.list()[0].details.code, "ROOM");
});

test("unmount during deferred socket-client loading never reads a new session token or creates a late socket", async () => {
  let pendingScript, socketCreates = 0, tokenReads = 0;
  const document = { getElementById: () => ({}), querySelector: () => null, createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild(script) { pendingScript = script; } } };
  const scope = { document, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} }, HHAuthSession: { token() { tokenReads += 1; return "new-session-token"; } } };
  vm.runInNewContext(source, scope);
  const root = { innerHTML: "", querySelector: () => null, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {}, replaceChildren() { this.innerHTML = ""; } };
  const controller = scope.HHGraphicCollaboration.mount(root, { socketUrl: "https://realtime.example.invalid" });
  assert.ok(pendingScript, "client script is genuinely waiting for load");
  controller.unmount();
  scope.io = () => { socketCreates += 1; return { on() {}, off() {}, disconnect() {} }; };
  pendingScript.onload();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(socketCreates, 0);
  assert.equal(tokenReads, 0);
  assert.equal(root.innerHTML, "");
});
