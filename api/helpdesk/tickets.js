const { clean, currentUser, ownerFrom, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const collection = db.collection("tickets");
    if (req.method === "GET") {
      const rows = await collection.find({}).sort({ createdAt: -1 }).limit(50).toArray();
      return res.status(200).json({ tickets: rows });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const doc = { subject: clean(body.subject, 180), message: clean(body.message, 8000), email: clean(body.email, 160), status: "open", priority: clean(body.priority || "normal", 40), ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    if (!doc.subject || !doc.message) return res.status(400).json({ error: "Subject and message are required." });
    const result = await collection.insertOne(doc);
    return res.status(200).json({ ok: true, ticket: { ...doc, _id: result.insertedId } });
  });
};
