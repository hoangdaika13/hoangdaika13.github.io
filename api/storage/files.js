const { clean, currentUser, ownerFrom, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const collection = db.collection("storageFiles");
    if (req.method === "GET") {
      const rows = await collection.find({}, { projection: { content: 0 } }).sort({ createdAt: -1 }).limit(50).toArray();
      return res.status(200).json({ files: rows });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const content = clean(body.content, 50000);
    const doc = { name: clean(body.name || "untitled.txt", 180), mimeType: clean(body.mimeType || "text/plain", 120), size: Number(body.size || content.length || 0), content, note: "Chỉ lưu payload nhỏ. File lớn cần S3/R2/GridFS.", ...ownerFrom(user, body), createdAt: new Date() };
    const result = await collection.insertOne(doc);
    return res.status(200).json({ ok: true, file: { ...doc, _id: result.insertedId } });
  });
};
