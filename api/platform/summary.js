const { withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const names = ["moduleRecords", "moduleActions", "tickets", "orders", "storageFiles", "notificationSubscriptions"];
    const counts = {};
    await Promise.all(names.map(async (name) => {
      counts[name] = await db.collection(name).countDocuments();
    }));
    return res.status(200).json({ ok: true, counts });
  });
};
