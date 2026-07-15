const { ObjectId } = require("mongodb");
const { clean, currentUser, ownerFrom, withApi } = require("../../../utils/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleRecords");
    const user = await currentUser(req);
    const ownerEmail = String(process.env.ADMIN_EMAIL || "nhhoang130803@gmail.com").toLowerCase();
    const isAdmin = Boolean(user && String(user.email || "").toLowerCase() === ownerEmail);

    if (moduleId === "space-explorer" && req.method === "GET" && req.query.view === "leaderboard") {
      const scores = await collection.find(
        { moduleId, type: "score" },
        { projection: { "user.name": 1, "data.score": 1, "data.rank": 1, "data.level": 1, "data.sectors": 1, "data.discoveries": 1, updatedAt: 1 } }
      ).sort({ "data.score": -1, updatedAt: 1 }).limit(20).toArray();
      return res.status(200).json({
        moduleId,
        items: scores.map((item, index) => ({
          position: index + 1,
          pilot: clean(item.user?.name || "Phi công HH", 80),
          score: Math.max(0, Number(item.data?.score || 0)),
          rank: clean(item.data?.rank || "Tân binh", 40),
          level: Math.max(1, Number(item.data?.level || 1)),
          sectors: Math.max(0, Number(item.data?.sectors || 0)),
          discoveries: Math.max(0, Number(item.data?.discoveries || 0)),
          updatedAt: item.updatedAt
        }))
      });
    }

    if (moduleId === "referral-affiliate" && req.method === "GET" && req.query.code) {
      const code = clean(req.query.code, 40);
      const clicks = await collection.countDocuments({ moduleId, type: "click", "data.code": code });
      const leads = await collection.countDocuments({ moduleId, type: "lead", "data.code": code });
      return res.status(200).json({ moduleId, code, stats: { clicks, leads } });
    }

    if (!user && !(moduleId === "referral-affiliate" && req.method === "POST" && body.type === "click")) {
      return res.status(401).json({ error: "Bạn cần đăng nhập để đồng bộ dữ liệu module." });
    }
    const ownership = isAdmin ? {} : { userId: user?._id };

    if (moduleId === "space-explorer" && req.method === "POST" && body.type === "score") {
      const number = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
      const data = {
        score: number(body.data?.score, 0, 999999999),
        rank: clean(body.data?.rank || "Tân binh", 40),
        level: number(body.data?.level, 1, 999),
        sectors: number(body.data?.sectors, 0, 99999),
        discoveries: number(body.data?.discoveries, 0, 999999),
        playSeconds: number(body.data?.playSeconds, 0, 315360000)
      };
      const now = new Date();
      await collection.updateOne(
        { moduleId, type: "score", userId: user._id },
        { $set: { title: clean(user.name || "Phi công HH", 180), data, user: ownerFrom(user).user, updatedAt: now }, $setOnInsert: { moduleId, type: "score", userId: user._id, createdAt: now } },
        { upsert: true }
      );
      await db.collection("events").insertOne({ type: "game:score:sync", moduleId, userId: user._id, score: data.score, createdAt: now });
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "GET") {
      const limit = moduleId === "chat-app" ? 300 : 100;
      const items = await collection.find({ moduleId, ...ownership }).sort({ createdAt: -1 }).limit(limit).toArray();
      return res.status(200).json({ moduleId, items });
    }

    if (["PATCH", "DELETE"].includes(req.method)) {
      if (!ObjectId.isValid(String(req.query.id || ""))) return res.status(400).json({ error: "Bản ghi không hợp lệ." });
      const query = { _id: new ObjectId(req.query.id), moduleId, ...ownership };
      if (req.method === "DELETE") {
        const result = await collection.deleteOne(query);
        if (!result.deletedCount) return res.status(404).json({ error: "Không tìm thấy bản ghi hoặc bạn không có quyền." });
        return res.status(200).json({ ok: true });
      }
      const nextData = body.data && typeof body.data === "object" ? body.data : {};
      if (JSON.stringify(nextData).length > 64000) return res.status(413).json({ error: "Dữ liệu vượt giới hạn 64 KB." });
      const result = await collection.findOneAndUpdate(query, { $set: { title: clean(body.title, 180), type: clean(body.type || "note", 80), data: nextData, updatedAt: new Date() } }, { returnDocument: "after" });
      if (!result) return res.status(404).json({ error: "Không tìm thấy bản ghi hoặc bạn không có quyền." });
      return res.status(200).json({ ok: true, item: result });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const data = body.data && typeof body.data === "object" ? body.data : {};
    if (JSON.stringify(data).length > 64000) return res.status(413).json({ error: "Dữ liệu vượt giới hạn 64 KB." });
    const doc = { moduleId, title: clean(body.title, 180), type: clean(body.type || "note", 80), data, ...ownerFrom(user, body), createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    await db.collection("events").insertOne({ type: "module:item:create", moduleId, recordId: result.insertedId, createdAt: new Date() });
    return res.status(200).json({ ok: true, item: { ...doc, _id: result.insertedId } });
  });
};
