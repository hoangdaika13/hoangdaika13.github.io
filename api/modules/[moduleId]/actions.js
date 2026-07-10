const { clean, currentUser, ownerFrom, withApi } = require("../../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleActions");

    if (req.method === "GET") {
      const actions = await collection.find({ moduleId }).sort({ createdAt: -1 }).limit(100).toArray();
      return res.status(200).json({ moduleId, actions });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const input = clean(body.input, 8000);
    const actionType = clean(body.actionType || "run", 80);
    const output = [
      `Backend đã nhận action cho ${moduleId}.`,
      "",
      `Action: ${actionType}`,
      `Input: ${input || "Không có input"}`,
      "",
      "Dữ liệu đã lưu MongoDB. Có thể thay output này bằng AI/API chuyên biệt sau."
    ].join("\n");
    const doc = { moduleId, actionType, input, output, meta: body.meta || {}, ...ownerFrom(user, body), createdAt: new Date() };
    const result = await collection.insertOne(doc);
    await db.collection("events").insertOne({ type: "module:action", moduleId, actionType, actionId: result.insertedId, createdAt: new Date() });
    return res.status(200).json({ ok: true, action: { ...doc, _id: result.insertedId } });
  });
};
