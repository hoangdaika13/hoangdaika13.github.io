const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const port = 4328;
const serverUrl = `http://127.0.0.1:${port}`;

function emitResponse(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} acknowledgement timed out`)), 5000);
    socket.emit(event, payload, (response = {}) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function emitAck(socket, event, payload = {}) {
  const response = await emitResponse(socket, event, payload);
  if (!response.ok) throw new Error(response.error || `${event} failed`);
  return response;
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

function connectDesigner(id, name) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      auth: { anonymousId: id, designName: name, consent: false },
      transports: ["websocket"]
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

test("design collaboration enforces roles and synchronizes presence, locks, comments, branches and disconnect", { timeout: 25000 }, async (t) => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_URL: "http://127.0.0.1:4173",
      ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      MONGODB_URI: "",
      DESIGN_LOCK_TTL: "7000"
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
    child.stderr.on("data", (chunk) => reject(new Error(String(chunk))));
    child.once("exit", (code) => reject(new Error(`Realtime server exited with code ${code}`)));
  });

  const [owner, teammate] = await Promise.all([
    connectDesigner("design-owner", "Chủ thiết kế"),
    connectDesigner("design-teammate", "Cộng tác viên")
  ]);
  sockets.push(owner, teammate);

  const created = await emitAck(owner, "design:room:create", { name: "HH Creative Review" });
  assert.match(created.room.code, /^[A-Z0-9]{8}$/);
  assert.equal(created.identity.guest, true);
  assert.equal(created.identity.authenticated, false);
  assert.match(created.identity.name, /chưa đăng nhập/);
  assert.equal(created.room.members[0].role, "owner");
  assert.equal(created.room.persistence, "memory");
  assert.doesNotMatch(JSON.stringify(created), /password|authorization|token|email/i);

  const presenceEvent = once(owner, "design:presence");
  const joined = await emitAck(teammate, "design:room:join", { code: created.room.code });
  assert.equal(joined.room.members.length, 2);
  assert.equal(joined.room.members.find((member) => member.user.id === joined.identity.id).role, "viewer");
  const presence = await presenceEvent;
  assert.equal(presence.members.length, 2);

  const deniedComment = await emitResponse(teammate, "design:comment:add", { body: "Chưa có quyền", x: 30, y: 40 });
  assert.equal(deniedComment.ok, false);
  assert.match(deniedComment.error, /quyền bình luận/i);

  await emitAck(owner, "design:permission:set", { userId: joined.identity.id, role: "commenter" });
  const commentEvent = once(owner, "design:comment:added");
  const commentResult = await emitAck(teammate, "design:comment:add", {
    body: "Cần tăng khoảng trắng ở tiêu đề",
    x: 128,
    y: 72,
    artboardId: "hero",
    layerId: "heading"
  });
  assert.equal((await commentEvent).comment.id, commentResult.comment.id);
  assert.equal(commentResult.comment.user.guest, true);
  assert.equal(commentResult.comment.x, 128);

  const deniedLock = await emitResponse(teammate, "design:lock:acquire", { layerId: "heading" });
  assert.equal(deniedLock.ok, false);
  assert.match(deniedLock.error, /quyền chỉnh sửa/i);

  await emitAck(owner, "design:permission:set", { userId: joined.identity.id, role: "editor" });
  const lockEvent = once(owner, "design:lock:acquired");
  const acquired = await emitAck(teammate, "design:lock:acquire", { layerId: "heading", ttl: 7000 });
  assert.equal((await lockEvent).lock.layerId, "heading");
  assert.equal(acquired.lock.user.id, joined.identity.id);
  const conflicting = await emitResponse(owner, "design:lock:acquire", { layerId: "heading" });
  assert.equal(conflicting.ok, false);
  assert.match(conflicting.error, /đang được/i);
  await emitAck(teammate, "design:lock:release", { layerId: "heading" });

  const branchEvent = once(owner, "design:branch:created");
  const branchResult = await emitAck(teammate, "design:branch:create", { name: "hero-refresh" });
  assert.equal((await branchEvent).branch.id, branchResult.branch.id);
  const version = await emitAck(teammate, "design:version:create", {
    label: "Hero approved draft",
    branchId: branchResult.branch.id,
    projectHash: "sha256:test-only"
  });
  assert.equal(version.version.branchId, branchResult.branch.id);
  const review = await emitAck(teammate, "design:review:create", { branchId: branchResult.branch.id, title: "Duyệt hero" });
  const approved = await emitAck(owner, "design:review:update", { reviewId: review.review.id, status: "approved", response: "Đạt" });
  assert.equal(approved.review.status, "approved");

  const leftEvent = once(owner, "design:member:left");
  teammate.close();
  const left = await leftEvent;
  assert.equal(left.user.id, joined.identity.id);
  assert.equal(left.reason, "disconnected");
});
