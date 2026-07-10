const { bcrypt, clean, publicUser, signUser, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const name = clean(body.name, 120);
    const email = clean(body.email, 160).toLowerCase();
    const password = String(body.password || "");
    if (!name || !email || password.length < 8) {
      return res.status(400).json({ error: "Tên, email và mật khẩu tối thiểu 8 ký tự là bắt buộc." });
    }
    const users = db.collection("users");
    if (await users.findOne({ email })) return res.status(409).json({ error: "Email đã tồn tại." });
    const passwordHash = await bcrypt.hash(password, 12);
    const doc = { provider: "local", name, email, passwordHash, consent: Boolean(body.consent), createdAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date() };
    const result = await users.insertOne(doc);
    const user = await users.findOne({ _id: result.insertedId });
    return res.status(200).json({ token: signUser(user), user: publicUser(user) });
  });
};
