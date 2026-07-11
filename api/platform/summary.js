const { clean, currentUser, withApi } = require("../_lib/platform");

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
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
    }
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const ownerEmail = String(process.env.ADMIN_EMAIL || "nhhoang130803@gmail.com").toLowerCase();
    if (!user || String(user.email || "").toLowerCase() !== ownerEmail) return res.status(403).json({ error: "Chỉ chủ sở hữu được truy cập Admin Panel." });
    const names = ["users", "moduleRecords", "moduleActions", "tickets", "orders", "storageFiles", "notificationSubscriptions", "events"];
    const counts = {};
    await Promise.all(names.map(async (name) => {
      counts[name] = await db.collection(name).countDocuments();
    }));
    const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const [onlineVisitors, onlineRegistered] = await Promise.all([
      db.collection("presence").countDocuments({ lastSeenAt: { $gte: activeSince } }),
      db.collection("presence").countDocuments({ lastSeenAt: { $gte: activeSince }, kind: "registered" })
    ]);
    const activePresence = await db.collection("presence")
      .find({ lastSeenAt: { $gte: activeSince } })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray();
    const userIds = activePresence.filter((item) => item.userId).map((item) => item.userId);
    const activeUsers = userIds.length
      ? await db.collection("users").find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1 } }).toArray()
      : [];
    const userById = new Map(activeUsers.map((item) => [String(item._id), item]));
    const activeVisitors = activePresence.map((item) => {
      const profile = item.userId ? userById.get(String(item.userId)) : null;
      return {
        kind: item.kind === "registered" ? "registered" : "guest",
        name: profile?.name || (item.kind === "registered" ? "Tài khoản đã đăng nhập" : "Khách ẩn danh"),
        email: profile?.email || "",
        page: item.page || "/",
        lastSeenAt: item.lastSeenAt
      };
    });
    const recentEvents = await db.collection("events").find({}).sort({ createdAt: -1 }).limit(12).project({ type: 1, moduleId: 1, createdAt: 1 }).toArray();
    return res.status(200).json({ ok: true, counts, audience: { registeredUsers: counts.users || 0, onlineVisitors, onlineRegistered, activeWindowSeconds: ACTIVE_WINDOW_MS / 1000, activeVisitors }, recentEvents, checkedAt: new Date() });
  });
};
