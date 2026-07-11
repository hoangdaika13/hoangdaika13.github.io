const { currentUser, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const ownerEmail = String(process.env.ADMIN_EMAIL || "nhhoang130803@gmail.com").toLowerCase();
    if (!user || String(user.email || "").toLowerCase() !== ownerEmail) return res.status(403).json({ error: "Chỉ chủ sở hữu được truy cập Admin Panel." });
    const names = ["users", "moduleRecords", "moduleActions", "tickets", "orders", "storageFiles", "notificationSubscriptions", "events"];
    const counts = {};
    await Promise.all(names.map(async (name) => {
      counts[name] = await db.collection(name).countDocuments();
    }));
    const recentEvents = await db.collection("events").find({}).sort({ createdAt: -1 }).limit(12).project({ type: 1, moduleId: 1, createdAt: 1 }).toArray();
    return res.status(200).json({ ok: true, counts, recentEvents, checkedAt: new Date() });
  });
};
