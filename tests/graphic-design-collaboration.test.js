const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  for (const token of ["Tạo phòng thiết kế", "Ghim bình luận", "Tạo phiên bản", "Yêu cầu duyệt", "Đang online", "role=\"application\"", "aria-live=\"polite\""]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /@media\(max-width:760px\)/);
  assert.match(source, /@media\(max-width:480px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /focus-visible/);
});

test("normalizes canvas coordinates for realtime cursors and pinned comments", () => {
  const node = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) };
  assert.deepEqual(collaboration.positionFromEvent({ clientX: 110, clientY: 70 }, node), { x: 50, y: 50 });
  assert.deepEqual(collaboration.positionFromEvent({ clientX: -500, clientY: 900 }, node), { x: 0, y: 100 });
});
