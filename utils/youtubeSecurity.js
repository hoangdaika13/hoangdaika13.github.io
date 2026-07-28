const crypto = require("node:crypto");

const TOKEN_VERSION = "v2";

function securityError(message, code = "YOUTUBE_TOKEN_INVALID") {
  return Object.assign(new Error(message), { statusCode: 401, code });
}

function masterKey() {
  const secret = String(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  if (secret.length < 32) {
    throw Object.assign(new Error("Máy chủ chưa cấu hình khóa mã hóa YouTube."), {
      statusCode: 503,
      code: "YOUTUBE_ENCRYPTION_MISSING"
    });
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function tokenContext(connection) {
  const userId = String(connection?.userId || "");
  const channelId = String(connection?.channelId || "");
  if (!userId || !channelId) throw securityError("Không xác định được chủ sở hữu token YouTube.");
  return Buffer.from(`hh-youtube-token:${TOKEN_VERSION}:${userId}:${channelId}`, "utf8");
}

function encryptToken(value, connection) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(tokenContext(connection));
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function decryptLegacyToken(value) {
  const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv?.length || !tag?.length || !encrypted?.length) throw securityError("Token YouTube không hợp lệ.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function decryptToken(value, connection) {
  if (!value) return "";
  try {
    const parts = String(value).split(".");
    if (parts[0] !== TOKEN_VERSION) return decryptLegacyToken(value);
    if (parts.length !== 4) throw securityError("Token YouTube không hợp lệ.");
    const [, ivText, tagText, encryptedText] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivText, "base64url"));
    decipher.setAAD(tokenContext(connection));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    if (error?.code === "YOUTUBE_TOKEN_INVALID") throw error;
    throw securityError("Phiên YouTube đã hỏng hoặc không thuộc tài khoản hiện tại.");
  }
}

function isBoundToken(value) {
  return String(value || "").startsWith(`${TOKEN_VERSION}.`);
}

function ownedConnectionFilter(connection) {
  return {
    _id: connection?._id,
    userId: connection?.userId,
    channelId: connection?.channelId
  };
}

function sameOwner(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function publicChannel(connection) {
  if (!connection) return null;
  return {
    id: String(connection.channelId || ""),
    title: String(connection.channelTitle || "Kênh YouTube").slice(0, 180),
    thumbnail: String(connection.channelThumbnail || "").slice(0, 1000),
    subscribers: Math.max(0, Number(connection.subscribers || 0)),
    videos: Math.max(0, Number(connection.videoCount || 0)),
    active: Boolean(connection.active),
    connectedAt: connection.connectedAt || null,
    updatedAt: connection.updatedAt || null
  };
}

module.exports = {
  decryptToken,
  encryptToken,
  isBoundToken,
  ownedConnectionFilter,
  publicChannel,
  sameOwner,
  tokenContext
};
