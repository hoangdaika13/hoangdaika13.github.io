const test = require("node:test");
const assert = require("node:assert/strict");

const { decryptToken, encryptToken, publicConnection, sameOwner } = require("../utils/discordSecurity");
const { __test: managerTest } = require("../utils/discordManager");

const previousKey = process.env.DISCORD_TOKEN_ENCRYPTION_KEY;
process.env.DISCORD_TOKEN_ENCRYPTION_KEY = "discord-security-test-key-with-at-least-32-characters";

test.after(() => {
  if (previousKey === undefined) delete process.env.DISCORD_TOKEN_ENCRYPTION_KEY;
  else process.env.DISCORD_TOKEN_ENCRYPTION_KEY = previousKey;
});

test("Discord tokens use AES-GCM and are bound to the HH owner and Discord identity", () => {
  const owner = { userId: "hh-user-a", discordUserId: "123456789012345678" };
  const encrypted = encryptToken("discord-refresh-secret", owner);
  assert.equal(encrypted.includes("discord-refresh-secret"), false);
  assert.equal(decryptToken(encrypted, owner), "discord-refresh-secret");
  assert.throws(() => decryptToken(encrypted, { ...owner, userId: "hh-user-b" }), (error) => error.code === "DISCORD_TOKEN_INVALID");
  assert.throws(() => decryptToken(encrypted, { ...owner, discordUserId: "223456789012345678" }), (error) => error.code === "DISCORD_TOKEN_INVALID");
});

test("Public Discord connection never exposes server-side credentials", () => {
  const visible = publicConnection({
    _id: "connection-id", userId: "private-owner", discordUserId: "123456789012345678", username: "hh-user", globalName: "HH User", avatarHash: "avatar",
    encryptedAccessToken: "secret-access", encryptedRefreshToken: "secret-refresh", scopes: ["identify", "guilds"], active: true
  });
  const serialized = JSON.stringify(visible);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("private-owner"), false);
  assert.equal(visible.discordUserId, "123456789012345678");
  assert.equal(sameOwner("owner", "owner"), true);
  assert.equal(sameOwner("owner", "other"), false);
});

test("Discord 2.0 validates file signatures and grants only feature permissions", () => {
  const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
  const file = managerTest.attachmentBuffer({ filename: "ảnh.png", contentType: "image/png", base64: png.toString("base64") });
  assert.equal(file.contentType, "image/png");
  assert.equal(file.buffer.equals(png), true);
  assert.throws(() => managerTest.attachmentBuffer({ filename: "bad.txt", contentType: "text/plain", base64: "%%%=" }), (error) => error.code === "DISCORD_ATTACHMENT_INVALID");
  assert.throws(() => managerTest.attachmentBuffer({ filename: "fake.pdf", contentType: "application/pdf", base64: png.toString("base64") }), (error) => error.code === "DISCORD_ATTACHMENT_SIGNATURE_REJECTED");
  const permissions = BigInt(managerTest.BOT_PERMISSIONS);
  for (const bit of [6n, 10n, 11n, 14n, 15n, 16n, 35n, 38n]) assert.ok(permissions & (1n << bit), `missing permission bit ${bit}`);
  for (const dangerous of [1n, 2n, 3n, 4n, 5n, 7n, 28n]) assert.equal(Boolean(permissions & (1n << dangerous)), false, `dangerous permission bit ${dangerous}`);
});

test("Discord 2.0 constrains reactions and public thread names", () => {
  assert.equal(managerTest.safeEmoji("✨"), "✨");
  assert.equal(managerTest.safeEmoji("party:123456789012345678"), "party:123456789012345678");
  assert.throws(() => managerTest.safeEmoji("x".repeat(130)), (error) => error.code === "DISCORD_EMOJI_INVALID");
  assert.equal(managerTest.safeThreadName("  Chủ đề mới  "), "Chủ đề mới");
  assert.throws(() => managerTest.safeThreadName("x"), (error) => error.code === "DISCORD_THREAD_NAME_INVALID");
});
