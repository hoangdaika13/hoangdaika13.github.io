const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Messenger client actions are implemented by the Community API", () => {
  const client = read("community-platform-v2.js");
  const api = read("api/community.js");
  const actions = [
    "message:direct", "message:read", "message:conversation:preference",
    "message:conversation:block", "message:conversation:report", "message:room:create",
    "message:room:update", "message:room:leave", "message:room:member",
    "message:room:role", "message:room:transfer", "message:create", "message:edit",
    "message:delete:self", "message:delete:all", "message:react", "message:pin",
    "message:forward"
  ];
  actions.forEach((action) => {
    assert.match(client, new RegExp(action.replaceAll(":", "\\:")), `client missing ${action}`);
    assert.match(api, new RegExp(action.replaceAll(":", "\\:")), `API missing ${action}`);
  });
  assert.match(api, /MESSAGE_PAGE_SIZE/);
  assert.match(api, /expiresAt.*expireAfterSeconds/s);
});

test("WebRTC client and signaling server share the call protocol", () => {
  const client = read("community-calls.js");
  const server = read("realtime-server/src/server.js");
  ["call:start", "call:join", "call:signal", "call:media", "call:decline", "call:leave", "call:end"].forEach((event) => {
    assert.ok(client.includes(event), `call client missing ${event}`);
    assert.ok(server.includes(event), `signaling server missing ${event}`);
  });
  assert.match(client, /RTCPeerConnection/);
  assert.match(client, /getDisplayMedia/);
  assert.match(server, /STUN_URLS/);
});

test("Admin app enforces RBAC, audit metadata and privacy boundaries", () => {
  const api = read("utils/community-admin-api.js");
  const communityApi = read("api/community.js");
  const vercel = read("vercel.json");
  const permissions = read("utils/community-admin.js");
  assert.match(api, /requirePermission/);
  assert.match(communityApi, /communityAdminHandler/);
  assert.match(vercel, /\/api\/community-admin/);
  assert.match(api, /privateMessagesVisibleToAdmin:\s*false/);
  assert.match(api, /passwordsVisibleToAdmin:\s*false/);
  ["adminId", "action", "targetType", "targetId", "reason", "before", "after", "ip", "userAgent", "createdAt"].forEach((field) => {
    assert.match(permissions, new RegExp(`\\b${field}\\b`), `audit log missing ${field}`);
  });
  assert.doesNotMatch(api, /passwordHash:\s*1/);
  assert.doesNotMatch(api, /privateMessage:\s*1/);
});

test("Security headers permit calls without claiming E2EE", () => {
  const config = JSON.parse(read("vercel.json"));
  const headers = JSON.stringify(config.headers || []);
  const serviceWorker = read("sw.js");
  assert.match(headers, /camera=\(self\)/);
  assert.match(headers, /microphone=\(self\)/);
  assert.match(read("community-platform-v2.js"), /Mã hóa đầu cuối chưa được bật/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /headers\.has\("authorization"\)/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
});
