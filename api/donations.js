const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./_lib/platform");
const votesHandler = require("./_lib/votes");

const OWNER_DEFAULT = "nhhoang130803@gmail.com";
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 1000000000;

function objectId(value) {
  try { return new ObjectId(String(value || "")); } catch { return null; }
}

function amountOf(value) {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT ? amount : 0;
}

function publicDonation(item) {
  return {
    id: String(item._id),
    reference: item.reference,
    name: item.anonymous ? "Người ủng hộ ẩn danh" : clean(item.donorName || "Thành viên HH", 100),
    amount: item.amount,
    message: clean(item.message, 500),
    anonymous: Boolean(item.anonymous),
    verifiedAt: item.verifiedAt,
    createdAt: item.createdAt
  };
}

function makeReference() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HH${date}${random}`;
}

module.exports = async function handler(req, res) {
  if (String(req.query.resource || "") === "votes") return votesHandler(req, res);
  return withApi(req, res, async ({ db, body }) => {
    const donations = db.collection("donations");
    await Promise.all([
      donations.createIndex({ reference: 1 }, { unique: true }),
      donations.createIndex({ status: 1, verifiedAt: -1 }),
      donations.createIndex({ createdAt: -1 })
    ]);
    const user = await currentUser(req);
    const ownerEmail = String(process.env.ADMIN_EMAIL || OWNER_DEFAULT).toLowerCase();
    const isOwner = Boolean(user && String(user.email || "").toLowerCase() === ownerEmail);

    if (req.method === "GET") {
      if (String(req.query.admin || "") === "1") {
        if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được quản lý giao dịch ủng hộ." });
        const items = await donations.find({}).sort({ createdAt: -1 }).limit(200).toArray();
        return res.status(200).json({
          owner: true,
          donations: items.map((item) => ({
            id: String(item._id), reference: item.reference, donorName: item.donorName,
            email: item.email, amount: item.amount, message: item.message,
            anonymous: Boolean(item.anonymous), status: item.status,
            transferTime: item.transferTime || null, createdAt: item.createdAt,
            submittedAt: item.submittedAt || null, verifiedAt: item.verifiedAt || null
          }))
        });
      }

      const goal = Math.max(100000, Number(process.env.DONATION_GOAL || 10000000));
      const [summary, recent, monthly, leaderboard] = await Promise.all([
        donations.aggregate([{ $match: { status: "verified" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, average: { $avg: "$amount" } } }]).next(),
        donations.find({ status: "verified" }).sort({ verifiedAt: -1 }).limit(30).toArray(),
        donations.aggregate([{ $match: { status: "verified", verifiedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).next(),
        donations.aggregate([
          { $match: { status: "verified", anonymous: { $ne: true } } },
          { $group: { _id: "$donorName", amount: { $sum: "$amount" }, donations: { $sum: 1 } } },
          { $sort: { amount: -1, donations: -1 } },
          { $limit: 8 }
        ]).toArray()
      ]);
      const verified = recent.map(publicDonation);
      return res.status(200).json({
        goal,
        stats: { total: summary?.total || 0, count: summary?.count || 0, average: Math.round(summary?.average || 0), monthlyTotal: monthly?.total || 0, monthlyCount: monthly?.count || 0 },
        recent: verified.slice(0, 12),
        leaderboard: leaderboard.map((item) => ({ name: clean(item._id || "Thành viên HH", 100), amount: item.amount, donations: item.donations })),
        checkedAt: new Date()
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "create", 40);

    if (action === "create") {
      const ip = clean(String(req.headers["x-forwarded-for"] || "").split(",")[0], 80) || "unknown";
      await enforceRateLimit(db, `donation:create:${user?._id || ip}`, 12, 60 * 60 * 1000);
      const amount = amountOf(body.amount);
      if (!amount) return res.status(400).json({ error: "Số tiền ủng hộ phải từ 1.000đ đến 1.000.000.000đ." });
      const donorName = clean(body.donorName || user?.name || "Thành viên HH", 100);
      const email = clean(body.email || user?.email, 160).toLowerCase();
      if (!donorName) return res.status(400).json({ error: "Hãy nhập tên người ủng hộ." });
      const reference = makeReference();
      const doc = {
        userId: user?._id || null, reference, donorName, email, amount,
        message: clean(body.message, 500), anonymous: Boolean(body.anonymous),
        status: "pending", paymentMethod: "vietcombank_transfer",
        createdAt: new Date(), updatedAt: new Date()
      };
      const result = await donations.insertOne(doc);
      await db.collection("events").insertOne({ type: "donation:intent", userId: user?._id || null, recordId: result.insertedId, createdAt: new Date() });
      return res.status(201).json({ ok: true, donation: { id: String(result.insertedId), reference, amount, status: doc.status }, bank: { name: "Vietcombank", accountName: "NGUYEN HUY HOANG", accountNumber: "1030351658" } });
    }

    if (action === "submit") {
      const id = objectId(body.id);
      const reference = clean(body.reference, 40);
      if (!id || !reference) return res.status(400).json({ error: "Giao dịch không hợp lệ." });
      const selector = { _id: id, reference, status: { $in: ["pending", "submitted"] } };
      if (user) selector.$or = [{ userId: user._id }, { email: String(user.email || "").toLowerCase() }];
      const result = await donations.updateOne(selector, { $set: { status: "submitted", transferTime: body.transferTime ? new Date(body.transferTime) : new Date(), submittedAt: new Date(), updatedAt: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy yêu cầu ủng hộ phù hợp." });
      return res.status(200).json({ ok: true, status: "submitted", message: "Đã gửi thông báo chuyển khoản để chủ sở hữu đối chiếu." });
    }

    if (action === "admin:update") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được xác nhận giao dịch." });
      const id = objectId(body.id);
      const nextStatus = ["verified", "rejected", "pending"].includes(body.status) ? body.status : "";
      if (!id || !nextStatus) return res.status(400).json({ error: "Trạng thái không hợp lệ." });
      const update = { status: nextStatus, adminNote: clean(body.adminNote, 500), updatedAt: new Date() };
      if (nextStatus === "verified") update.verifiedAt = new Date();
      else update.verifiedAt = null;
      const result = await donations.updateOne({ _id: id }, { $set: update });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
      await db.collection("events").insertOne({ type: `donation:${nextStatus}`, userId: user._id, recordId: id, createdAt: new Date() });
      return res.status(200).json({ ok: true, status: nextStatus });
    }

    return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
  });
};
