"use strict";

const { currentUser, enforceRateLimit, withApi } = require("../utils/platform");
const { EVENT_TTL_MS, actorFingerprint, ensureIndexes, sanitizeEvent } = require("../services/toolGateway");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const event = sanitizeEvent(body);
    if (!event.consent) return res.status(403).json({ error: "Event chỉ được ghi khi người dùng đã đồng ý analytics.", code: "ANALYTICS_CONSENT_REQUIRED" });
    const actorHash = actorFingerprint(req, user);
    await enforceRateLimit(db, `tool-events:${actorHash}`, 120, 10 * 60 * 1000);
    await ensureIndexes(db);
    const now = new Date();
    await db.collection("toolEvents").insertOne({
      userId: user?._id || null, actorHash, name: event.name, toolId: event.toolId,
      properties: event.properties, schemaVersion: 1, createdAt: now,
      expiresAt: new Date(now.getTime() + EVENT_TTL_MS)
    });
    return res.status(202).json({ accepted: true, storedPrivateInput: false, schemaVersion: 1 });
  });
};
