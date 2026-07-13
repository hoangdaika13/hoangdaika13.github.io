const { currentUser, withApi } = require("../_lib/platform");

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const owner = await currentUser(req);
    const ownerEmail = String(process.env.ADMIN_EMAIL || "nhhoang130803@gmail.com").toLowerCase();
    if (!owner || String(owner.email || "").toLowerCase() !== ownerEmail) {
      return res.status(403).json({ error: "Chỉ chủ sở hữu được xem danh sách tài khoản." });
    }

    const rows = await db.collection("users")
      .find({}, { projection: { passwordHash: 0, providerId: 0, tokenVersion: 0 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const activePresence = await db.collection("presence")
      .find({ kind: "registered", lastSeenAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } }, { projection: { userId: 1 } })
      .toArray();
    const onlineIds = new Set(activePresence.map((item) => String(item.userId || "")));

    const users = rows.map((user) => ({
      id: String(user._id),
      name: user.name || user.displayName || "Chưa đặt tên",
      email: user.email || "",
      provider: user.provider || "local",
      avatar: user.avatar || "",
      consent: Boolean(user.consent),
      createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null,
      online: onlineIds.has(String(user._id))
    }));

    return res.status(200).json({
      ok: true,
      users,
      stats: {
        total: users.length,
        online: users.filter((user) => user.online).length,
        consented: users.filter((user) => user.consent).length
      },
      checkedAt: new Date()
    });
  });
};
