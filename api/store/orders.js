const { clean, currentUser, ownerFrom, withApi } = require("../../utils/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để tạo đơn hàng." });
    const doc = {
      items: Array.isArray(body.items) ? body.items.slice(0, 20) : [],
      customer: { name: clean(body.customer?.name, 120), email: clean(body.customer?.email, 160), phone: clean(body.customer?.phone, 40) },
      status: "pending_manual_payment",
      paymentNote: "Chưa thu tiền thật. Cần kết nối Stripe, PayPal, MoMo hoặc VNPay trước khi thanh toán.",
      ...ownerFrom(user, body),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("orders").insertOne(doc);
    return res.status(200).json({ ok: true, order: { ...doc, _id: result.insertedId } });
  });
};
