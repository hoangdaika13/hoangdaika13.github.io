const crypto = require("node:crypto");

const TOKEN_VERSION = "v1";

function fail(message, code = "DISCORD_TOKEN_INVALID") {
  return Object.assign(new Error(message), { statusCode: 401, code });
}

function masterKey() {
  const secret = String(process.env.DISCORD_TOKEN_ENCRYPTION_KEY || "");
  if (secret.length < 32) {
    throw Object.assign(new Error("Máy chủ chưa cấu hình khóa mã hóa Discord."), {
      statusCode: 503,
      code: "DISCORD_ENCRYPTION_MISSING"
    });
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function context(connection) {
  const userId = String(connection?.userId || "");
  const discordUserId = String(connection?.discordUserId || "pending");
  if (!userId) throw fail("Không xác định được chủ sở hữu kết nối Discord.");
  return Buffer.from(`hh-discord:${TOKEN_VERSION}:${userId}:${discordUserId}`, "utf8");
}

function encryptToken(value, connection) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(context(connection));
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [TOKEN_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptToken(value, connection) {
  if (!value) return "";
  try {
    const [version, iv, tag, encrypted] = String(value).split(".");
    if (version !== TOKEN_VERSION || !iv || !tag || !encrypted) throw fail("Token Discord không hợp lệ.");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(context(connection));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error?.code === "DISCORD_TOKEN_INVALID") throw error;
    throw fail("Phiên Discord đã hỏng hoặc không thuộc tài khoản HH hiện tại.");
  }
}

function publicConnection(connection) {
  if (!connection) return null;
  const avatar = connection.avatarHash
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(connection.discordUserId)}/${encodeURIComponent(connection.avatarHash)}.png?size=128`
    : "";
  return {
    id: String(connection._id || ""),
    discordUserId: String(connection.discordUserId || ""),
    username: String(connection.globalName || connection.username || "Discord user").slice(0, 100),
    handle: String(connection.username || "").slice(0, 100),
    avatar,
    scopes: Array.isArray(connection.scopes) ? connection.scopes.slice(0, 20) : [],
    connectedAt: connection.connectedAt || null,
    updatedAt: connection.updatedAt || null,
    active: connection.active !== false
  };
}

function sameOwner(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

module.exports = { decryptToken, encryptToken, publicConnection, sameOwner, __test: Object.freeze({ context }) };
