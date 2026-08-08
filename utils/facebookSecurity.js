const crypto = require("node:crypto");

const TOKEN_VERSION = "v1";

function fail(message, code = "FACEBOOK_TOKEN_INVALID") {
  return Object.assign(new Error(message), { statusCode: 401, code });
}

function masterKey() {
  const secret = String(process.env.META_TOKEN_ENCRYPTION_KEY || process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  if (secret.length < 32) {
    throw Object.assign(new Error("Máy chủ chưa cấu hình khóa mã hóa token Meta."), {
      statusCode: 503,
      code: "META_ENCRYPTION_MISSING"
    });
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function context(connection) {
  const userId = String(connection?.userId || "");
  const pageId = String(connection?.pageId || "");
  if (!userId || !pageId) throw fail("Không xác định được chủ sở hữu token Meta.");
  return Buffer.from(`hh-meta-page:${TOKEN_VERSION}:${userId}:${pageId}`, "utf8");
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
    if (version !== TOKEN_VERSION || !iv || !tag || !encrypted) throw fail("Token Meta không hợp lệ.");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(context(connection));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error?.code === "FACEBOOK_TOKEN_INVALID") throw error;
    throw fail("Phiên Meta đã hỏng hoặc không thuộc tài khoản hiện tại.");
  }
}

function publicPage(connection) {
  return connection ? {
    id: String(connection.pageId || ""),
    name: String(connection.pageName || "Facebook Page").slice(0, 180),
    category: String(connection.category || "").slice(0, 160),
    picture: String(connection.picture || "").slice(0, 1200),
    tasks: Array.isArray(connection.tasks) ? connection.tasks.map(String).slice(0, 30) : [],
    active: Boolean(connection.active),
    connectedAt: connection.connectedAt || null,
    updatedAt: connection.updatedAt || null
  } : null;
}

module.exports = { decryptToken, encryptToken, publicPage };
