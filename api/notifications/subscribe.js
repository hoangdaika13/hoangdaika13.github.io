const { clean, currentUser, ownerFrom, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const doc = { channel: clean(body.channel || "email", 40), target: clean(body.target, 240), preferences: body.preferences || {}, active: true, note: "Cần provider key để gửi email/push/Discord/Telegram thật.", ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection("notificationSubscriptions").insertOne(doc);
    return res.status(200).json({ ok: true, subscription: { ...doc, _id: result.insertedId } });
  });
};
