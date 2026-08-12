const crypto = require("node:crypto");

const TOKEN_VERSION = "v1";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function fail(message, statusCode = 401, code = "TIKTOK_TOKEN_INVALID") {
  return Object.assign(new Error(message), { statusCode, code });
}

function masterKey() {
  const secret = String(process.env.TIKTOK_TOKEN_ENCRYPTION_KEY || "");
  if (secret.length < 32) throw fail("Máy chủ chưa cấu hình khóa mã hóa TikTok riêng.", 503, "TIKTOK_ENCRYPTION_MISSING");
  return crypto.createHash("sha256").update(secret).digest();
}

function context(record) {
  const userId = String(record?.userId || "");
  const connectionId = String(record?.connectionId || record?.openId || "");
  if (!userId || !connectionId) throw fail("Không xác định được chủ sở hữu token TikTok.");
  return Buffer.from(`hh-tiktok:${TOKEN_VERSION}:${userId}:${connectionId}`, "utf8");
}

function encryptToken(value, record) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(context(record));
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [TOKEN_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptToken(value, record) {
  if (!value) return "";
  try {
    const [version, iv, tag, encrypted] = String(value).split(".");
    if (version !== TOKEN_VERSION || !iv || !tag || !encrypted) throw new Error("invalid");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(context(record));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error?.code === "TIKTOK_ENCRYPTION_MISSING") throw error;
    throw fail("Phiên TikTok đã hỏng hoặc không thuộc tài khoản HH hiện tại.");
  }
}

function publicConnection(record) {
  if (!record) return null;
  return {
    id: String(record.connectionId || ""), openId: String(record.openId || ""),
    displayName: String(record.displayName || "Tài khoản TikTok").slice(0, 180),
    username: String(record.username || "").slice(0, 120), avatarUrl: String(record.avatarUrl || "").slice(0, 1200),
    scopes: Array.isArray(record.scopes) ? record.scopes.slice(0, 30) : [], active: Boolean(record.active),
    status: String(record.status || "connected"), accessTokenExpiresAt: record.accessTokenExpiresAt || null,
    refreshTokenExpiresAt: record.refreshTokenExpiresAt || null, connectedAt: record.connectedAt || null, updatedAt: record.updatedAt || null
  };
}

function webhookToleranceSeconds() {
  const configured = Number(process.env.TIKTOK_WEBHOOK_TOLERANCE_SECONDS || DEFAULT_WEBHOOK_TOLERANCE_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  return Math.min(15 * 60, Math.max(60, Math.floor(configured)));
}

function parseWebhookSignature(value) {
  const parts = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  const parsed = {};
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const itemValue = part.slice(separator + 1).trim();
    if ((key === "t" || key === "s") && !parsed[key]) parsed[key] = itemValue;
  }
  return parsed;
}

function verifyWebhookSignature(rawBody, signatureHeader, now = Date.now()) {
  const secret = String(process.env.TIKTOK_WEBHOOK_SECRET || process.env.TIKTOK_CLIENT_SECRET || "");
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "");
  const parsed = parseWebhookSignature(signatureHeader);
  const timestamp = Number(parsed.t);
  if (!secret || !Number.isInteger(timestamp) || !/^[a-f0-9]{64}$/i.test(parsed.s || "")) {
    return { valid: false, reason: "malformed", timestamp: null };
  }
  if (Math.abs(Math.floor(Number(now) / 1000) - timestamp) > webhookToleranceSeconds()) {
    return { valid: false, reason: "expired", timestamp };
  }
  const expected = crypto.createHmac("sha256", secret).update(String(timestamp)).update(".").update(raw).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(parsed.s, "hex");
  const valid = expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
  return { valid, reason: valid ? "ok" : "signature", timestamp };
}

module.exports = {
  TOKEN_VERSION,
  context,
  decryptToken,
  encryptToken,
  parseWebhookSignature,
  publicConnection,
  verifyWebhookSignature,
  webhookToleranceSeconds
};
