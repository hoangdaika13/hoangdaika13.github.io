const test = require("node:test");
const assert = require("node:assert/strict");

const { decryptToken, encryptToken, publicConnection, sameOwner } = require("../utils/discordSecurity");

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
