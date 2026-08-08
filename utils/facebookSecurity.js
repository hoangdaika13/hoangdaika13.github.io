const crypto = require("node:crypto");

const TOKEN_VERSION = "v2";
const LEGACY_VERSION = "v1";

function fail(message, code = "FACEBOOK_TOKEN_INVALID") {
  return Object.assign(new Error(message), { statusCode: 401, code });
}

function configuredSecrets() {
  return [
    String(process.env.META_TOKEN_ENCRYPTION_KEY || "").trim(),
    ...String(process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS || "").split(",").map((value) => value.trim())
  ].filter((value, index, values) => value.length >= 32 && values.indexOf(value) === index);
}

function keyRecord(secret) {
  return {
    id: crypto.createHash("sha256").update(`hh-meta-key:${secret}`).digest("hex").slice(0, 12),
    key: crypto.createHash("sha256").update(secret).digest()
  };
}

function keyRing() {
  const records = configuredSecrets().map(keyRecord);
  if (!records.length) {
    throw Object.assign(new Error("Máy chủ chưa cấu hình META_TOKEN_ENCRYPTION_KEY riêng cho token Meta."), {
      statusCode: 503,
      code: "META_ENCRYPTION_MISSING"
    });
  }
  return records;
}

function context(connection, version = TOKEN_VERSION) {
  const userId = String(connection?.userId || "");
  const pageId = String(connection?.pageId || "");
  if (!userId || !pageId) throw fail("Không xác định được chủ sở hữu token Meta.");
  return Buffer.from(`hh-meta-page:${version}:${userId}:${pageId}`, "utf8");
}

function encryptToken(value, connection) {
  if (!value) return "";
  const current = keyRing()[0];
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", current.key, iv);
  cipher.setAAD(context(connection));
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [TOKEN_VERSION, current.id, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptWithKey(parts, key, connection, version) {
  const [ivText, tagText, encryptedText] = parts;
  const iv = Buffer.from(ivText || "", "base64url");
  const tag = Buffer.from(tagText || "", "base64url");
  const encrypted = Buffer.from(encryptedText || "", "base64url");
  if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) throw fail("Token Meta không hợp lệ.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(context(connection, version));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function decryptToken(value, connection) {
  if (!value) return "";
  try {
    const parts = String(value).split(".");
    const ring = keyRing();
    if (parts[0] === TOKEN_VERSION && parts.length === 5) {
      const selected = ring.find((item) => item.id === parts[1]);
      if (!selected) throw fail("Không tìm thấy phiên bản khóa mã hóa của token Meta.", "FACEBOOK_TOKEN_KEY_UNAVAILABLE");
      return decryptWithKey(parts.slice(2), selected.key, connection, TOKEN_VERSION);
    }
    if (parts[0] === LEGACY_VERSION && parts.length === 4) {
      for (const item of ring) {
        try { return decryptWithKey(parts.slice(1), item.key, connection, LEGACY_VERSION); }
        catch {}
      }
    }
    throw fail("Token Meta không hợp lệ.");
  } catch (error) {
    if (String(error?.code || "").startsWith("FACEBOOK_TOKEN_")) throw error;
    throw fail("Phiên Meta đã hỏng hoặc không thuộc tài khoản HH hiện tại.");
  }
}

function isBoundToken(value) {
  return String(value || "").startsWith(`${TOKEN_VERSION}.`);
}

function ownedConnectionFilter(connection) {
  return { _id: connection?._id, userId: connection?.userId, pageId: connection?.pageId };
}

function sameOwner(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function publicPage(connection) {
  return connection ? {
    id: String(connection.pageId || ""),
    name: String(connection.pageName || "Facebook Page").slice(0, 180),
    category: String(connection.category || "").slice(0, 160),
    picture: String(connection.picture || "").slice(0, 1200),
    tasks: Array.isArray(connection.tasks) ? connection.tasks.map(String).slice(0, 30) : [],
    permissions: Array.isArray(connection.grantedPermissions) ? connection.grantedPermissions.map(String).slice(0, 30) : [],
    webhookSubscribed: Boolean(connection.webhookSubscribed),
    webhookFields: Array.isArray(connection.webhookFields) ? connection.webhookFields.map(String).slice(0, 12) : [],
    webhookSubscribedAt: connection.webhookSubscribedAt || null,
    active: Boolean(connection.active),
    connectedAt: connection.connectedAt || null,
    updatedAt: connection.updatedAt || null
  } : null;
}

module.exports = {
  TOKEN_VERSION,
  context,
  decryptToken,
  encryptToken,
  isBoundToken,
  ownedConnectionFilter,
  publicPage,
  sameOwner
};
