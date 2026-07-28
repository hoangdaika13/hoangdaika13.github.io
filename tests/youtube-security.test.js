const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  decryptToken,
  encryptToken,
  isBoundToken,
  ownedConnectionFilter,
  publicChannel,
  sameOwner
} = require("../utils/youtubeSecurity");

const previousKey = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = "youtube-security-test-key-with-at-least-32-characters";

test.after(() => {
  if (previousKey === undefined) delete process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  else process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = previousKey;
});

test("YouTube tokens are encrypted and bound to one HH owner and channel", () => {
  const owner = { userId: "user-a", channelId: "channel-a" };
  const encrypted = encryptToken("refresh-token-secret", owner);
  assert.equal(isBoundToken(encrypted), true);
  assert.equal(encrypted.includes("refresh-token-secret"), false);
  assert.equal(decryptToken(encrypted, owner), "refresh-token-secret");
  assert.throws(
    () => decryptToken(encrypted, { userId: "user-b", channelId: "channel-a" }),
    (error) => error.code === "YOUTUBE_TOKEN_INVALID"
  );
  assert.throws(
    () => decryptToken(encrypted, { userId: "user-a", channelId: "channel-b" }),
    (error) => error.code === "YOUTUBE_TOKEN_INVALID"
  );
});

test("Legacy ciphertext can be read once for server-side migration", () => {
  const secret = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update("legacy-token", "utf8"), cipher.final()]);
  const legacy = [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  assert.equal(isBoundToken(legacy), false);
  assert.equal(decryptToken(legacy, { userId: "user-a", channelId: "channel-a" }), "legacy-token");
});

test("Public channel data excludes ownership and token fields", () => {
  const source = {
    _id: "connection-id",
    userId: "private-user",
    channelId: "channel-a",
    channelTitle: "HH Channel",
    channelThumbnail: "https://example.test/avatar.png",
    subscribers: 12,
    videoCount: 3,
    accessToken: "secret-access",
    refreshToken: "secret-refresh",
    active: true
  };
  const visible = publicChannel(source);
  assert.deepEqual(Object.keys(visible).sort(), [
    "active", "connectedAt", "id", "subscribers", "thumbnail", "title", "updatedAt", "videos"
  ]);
  assert.equal(visible.id, "channel-a");
  assert.equal(JSON.stringify(visible).includes("secret"), false);
  assert.deepEqual(ownedConnectionFilter(source), {
    _id: "connection-id",
    userId: "private-user",
    channelId: "channel-a"
  });
  assert.equal(sameOwner("private-user", "private-user"), true);
  assert.equal(sameOwner("private-user", "other-user"), false);
});
