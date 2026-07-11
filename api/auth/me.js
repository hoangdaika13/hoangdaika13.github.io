const { currentUser, database, setCors } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const user = await currentUser(req);
  if (!user) return res.status(200).json({ user: null, loginHistory: [] });
  const db = await database();
  const loginHistory = await db.collection("loginEvents").find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).project({ userAgent: 1, forwardedFor: 1, createdAt: 1 }).toArray();
  return res.status(200).json({ user: { id: String(user._id), name: user.name || "", email: user.email || "", provider: user.provider || "local", avatar: user.avatar || "", consent: Boolean(user.consent) }, loginHistory });
};
