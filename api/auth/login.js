const { bcrypt, clean, publicUser, signUser, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const email = clean(body.email, 160).toLowerCase();
    const user = await db.collection("users").findOne({ email, provider: "local" });
    if (!user || !user.passwordHash || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) {
      return res.status(401).json({ error: "Sai email hoặc mật khẩu." });
    }
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    await db.collection("loginEvents").insertOne({ userId: user._id, type: "login", userAgent: clean(req.headers["user-agent"], 300), forwardedFor: clean(req.headers["x-forwarded-for"], 120), createdAt: new Date() });
    return res.status(200).json({ token: signUser(user), user: publicUser(user) });
  });
};
