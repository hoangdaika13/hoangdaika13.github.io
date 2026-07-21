"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilityDescriptor, createRateLimiter, normalizeMessage, channelSlug, publicIdentity } = require("../src/communication-v2");

test("capability descriptor does not overclaim infrastructure or E2EE", () => {
  const local = capabilityDescriptor({ hasMongo: false, hasRedis: false, hasObjectStorage: false });
  assert.equal(local.persistence, "unavailable");
  assert.equal(local.redis, "unavailable");
  assert.equal(local.objectStorage, "unavailable");
  assert.equal(local.endToEndEncryption, false);
  assert.match(local.transportSecurity, /TLS\/WSS/);
  const configured = capabilityDescriptor({ hasMongo: true, hasRedis: true, hasObjectStorage: true });
  assert.equal(configured.persistence, "MongoDB");
  assert.equal(configured.redis, "configured");
});

test("messages are bounded, typed and contain delivery receipts", () => {
  const actor = publicIdentity({ id: "u-1", name: "Huy Hoàng", role: "member" });
  const message = normalizeMessage({ channel: "Nhóm Sáng Tạo", type: "text", content: "x".repeat(9000), clientId: "client-1" }, actor);
  assert.equal(message.channel, "nh-m-s-ng-t-o");
  assert.equal(message.content.length, 8000);
  assert.deepEqual(message.receipts.sent, ["u-1"]);
  assert.equal(message.type, "text");
  assert.throws(() => normalizeMessage({ type: "text", content: "" }, actor), /không có nội dung/);
});

test("channel slug and identities reject unbounded input", () => {
  assert.equal(channelSlug(" General / News "), "general-news");
  const user = publicIdentity({ id: "1", name: "a".repeat(200), avatar: "b".repeat(900), role: "ADMIN" });
  assert.equal(user.name.length, 80);
  assert.equal(user.avatar.length, 600);
  assert.equal(user.role, "admin");
});

test("rate limiter resets by window and bounds bursts", async () => {
  const allow = createRateLimiter({ windowMs: 20, max: 2 });
  assert.equal(allow("socket"), true);
  assert.equal(allow("socket"), true);
  assert.equal(allow("socket"), false);
  await new Promise((resolve) => setTimeout(resolve, 24));
  assert.equal(allow("socket"), true);
});
