const { clean, currentUser, ownerFrom, withApi } = require("../../utils/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để đăng ký thông báo." });
    const allowed = ["email", "push", "discord", "telegram", "in-app"];
    const channel = clean(body.channel || "email", 40);
    if (!allowed.includes(channel)) return res.status(400).json({ error: "Kênh thông báo không hợp lệ." });
    const doc = { channel, target: clean(body.target, 240), preferences: body.preferences || {}, active: true, note: "Cần provider key để gửi email, push, Discord hoặc Telegram thật.", ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection("notificationSubscriptions").insertOne(doc);
    return res.status(200).json({ ok: true, subscription: { ...doc, _id: result.insertedId } });
  });
};
