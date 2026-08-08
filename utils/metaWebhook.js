const crypto = require("node:crypto");
const { clean, database } = require("./platform");

const MAX_BODY = 1024 * 1024;

function headers(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Webhook body too large"), { statusCode: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function validSignature(buffer, signature) {
  const secret = String(process.env.META_APP_SECRET || "");
  const supplied = String(signature || "");
  if (!secret || !supplied.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(buffer).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function eventValue(change = {}) {
  const value = change.value && typeof change.value === "object" ? change.value : {};
  return {
    field: clean(change.field, 80),
    item: clean(value.item, 80),
    verb: clean(value.verb, 80),
    postId: clean(value.post_id, 180),
    commentId: clean(value.comment_id, 180),
    parentId: clean(value.parent_id, 180),
    messagePreview: clean(value.message, 500),
    senderIdHash: value.sender_id ? crypto.createHash("sha256").update(String(value.sender_id)).digest("hex") : ""
  };
}

async function storeEvents(db, payload, raw) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const entries = Array.isArray(payload.entry) ? payload.entry.slice(0, 100) : [];
  let accepted = 0;
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex] || {};
    const pageId = clean(entry.id, 100);
    if (!pageId) continue;
    const changes = Array.isArray(entry.changes) ? entry.changes.slice(0, 100) : [];
    const owners = await db.collection("facebookPageConnections").find({ pageId }, { projection: { userId: 1 } }).toArray();
    for (let changeIndex = 0; changeIndex < changes.length; changeIndex += 1) {
      const safe = eventValue(changes[changeIndex]);
      const eventKey = crypto.createHash("sha256").update(raw).update(`:${entryIndex}:${changeIndex}`).digest("hex");
      await db.collection("facebookWebhookEvents").updateOne({ eventKey }, { $setOnInsert: {
        eventKey, object: clean(payload.object, 40), pageId, ...safe,
        eventTime: entry.time ? new Date(Number(entry.time) * 1000) : now,
        receivedAt: now, expiresAt
      } }, { upsert: true });
      accepted += 1;
      const haystack = `${safe.messagePreview} ${safe.item} ${safe.verb}`.toLocaleLowerCase("vi");
      for (const owner of owners) {
        const rules = await db.collection("facebookAutomationRules").find({ userId: owner.userId, enabled: true, $or: [{ pageIds: { $size: 0 } }, { pageIds: pageId }] }).limit(100).toArray();
        for (const rule of rules) {
          if (!rule.keyword || !haystack.includes(String(rule.keyword).toLocaleLowerCase("vi"))) continue;
          await db.collection("facebookAutomationEvents").updateOne({ userId: owner.userId, ruleId: rule._id, eventKey }, { $setOnInsert: {
            userId: owner.userId, ruleId: rule._id, eventKey, pageId, field: safe.field,
            action: clean(rule.action || "notify", 30), label: clean(rule.label, 80), status: "matched",
            createdAt: now, expiresAt
          } }, { upsert: true });
        }
      }
    }
  }
  return accepted;
}

module.exports = async function metaWebhook(req, res) {
  headers(res);
  if (req.method === "GET") {
    const mode = clean(req.query?.["hub.mode"], 40);
    const token = clean(req.query?.["hub.verify_token"], 300);
    const challenge = clean(req.query?.["hub.challenge"], 500);
    if (mode === "subscribe" && token && token === String(process.env.META_WEBHOOK_VERIFY_TOKEN || "")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Webhook verification rejected." });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const raw = await rawBody(req);
    if (!validSignature(raw, req.headers["x-hub-signature-256"])) return res.status(401).json({ error: "Invalid Meta signature." });
    const payload = JSON.parse(raw.toString("utf8") || "{}");
    const db = await database();
    await Promise.all([
      db.collection("facebookWebhookEvents").createIndex({ eventKey: 1 }, { unique: true }),
      db.collection("facebookWebhookEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("facebookAutomationEvents").createIndex({ userId: 1, ruleId: 1, eventKey: 1 }, { unique: true }),
      db.collection("facebookAutomationEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);
    const accepted = await storeEvents(db, payload, raw);
    return res.status(200).json({ ok: true, accepted });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.statusCode === 413 ? "Webhook payload too large." : "Invalid webhook payload." });
  }
};

module.exports.config = { api: { bodyParser: false } };
module.exports.__test = Object.freeze({ eventValue, validSignature, MAX_BODY });
