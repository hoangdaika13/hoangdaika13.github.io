const { clean, currentUser, ownerFrom, withApi } = require("../../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleRecords");

    if (req.method === "GET") {
      const items = await collection.find({ moduleId }).sort({ createdAt: -1 }).limit(100).toArray();
      return res.status(200).json({ moduleId, items });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const doc = { moduleId, title: clean(body.title, 180), type: clean(body.type || "note", 80), data: body.data || {}, ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    await db.collection("events").insertOne({ type: "module:item:create", moduleId, recordId: result.insertedId, createdAt: new Date() });
    return res.status(200).json({ ok: true, item: { ...doc, _id: result.insertedId } });
  });
};
