const { currentUser, setCors } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const user = await currentUser(req);
  return res.status(200).json({ user });
};
