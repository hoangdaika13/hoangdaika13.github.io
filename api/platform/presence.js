const { clean, currentUser, withApi } = require("../_lib/platform");

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const visitorId = clean(body.visitorId, 160);
    const identity = user ? `user:${user._id}` : visitorId ? `guest:${visitorId}` : "";
    if (!identity) return res.status(400).json({ error: "Missing visitor identifier" });

    const now = new Date();
    await db.collection("presence").updateOne(
      { identity },
      { $set: { identity, kind: user ? "registered" : "guest", userId: user?._id || null, lastSeenAt: now, page: clean(body.page, 240) || "/" }, $setOnInsert: { firstSeenAt: now } },
      { upsert: true }
    );
    const online = await db.collection("presence").countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } });
    return res.status(200).json({ ok: true, online, activeWindowSeconds: ACTIVE_WINDOW_MS / 1000, checkedAt: now });
  });
};
