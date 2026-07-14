const { ObjectId } = require("mongodb");
const { clean, currentUser, ownerFrom, withApi } = require("../../utils/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const collection = db.collection("tickets");
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng Helpdesk." });
    const ownerEmail = String(process.env.ADMIN_EMAIL || "nhhoang130803@gmail.com").toLowerCase();
    const isAdmin = String(user.email || "").toLowerCase() === ownerEmail;
    const ownership = isAdmin ? {} : { userId: user._id };
    if (req.method === "GET") {
      const rows = await collection.find(ownership).sort({ createdAt: -1 }).limit(50).toArray();
      return res.status(200).json({ tickets: rows });
    }
    if (req.method === "PATCH") {
      if (!ObjectId.isValid(String(req.query.id || ""))) return res.status(400).json({ error: "Ticket không hợp lệ." });
      const status = clean(body.status, 20);
      if (!["open", "pending", "closed"].includes(status)) return res.status(400).json({ error: "Trạng thái không hợp lệ." });
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(req.query.id), ...ownership },
        { $set: { status, updatedAt: new Date(), ...(isAdmin && body.assignee ? { assignee: clean(body.assignee, 160) } : {}) }, $push: { history: { status, by: String(user._id), at: new Date() } } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "Không tìm thấy ticket hoặc bạn không có quyền." });
      return res.status(200).json({ ok: true, ticket: result });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const doc = { subject: clean(body.subject, 180), message: clean(body.message, 8000), email: clean(body.email || user.email, 160), status: "open", priority: ["normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal", history: [{ status: "open", by: String(user._id), at: new Date() }], ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    if (!doc.subject || !doc.message) return res.status(400).json({ error: "Subject and message are required." });
    const result = await collection.insertOne(doc);
    return res.status(200).json({ ok: true, ticket: { ...doc, _id: result.insertedId } });
  });
};
