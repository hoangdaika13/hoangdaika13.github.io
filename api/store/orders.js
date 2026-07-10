const { clean, currentUser, ownerFrom, withApi } = require("../_lib/platform");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const doc = {
      items: Array.isArray(body.items) ? body.items.slice(0, 20) : [],
      customer: { name: clean(body.customer?.name, 120), email: clean(body.customer?.email, 160), phone: clean(body.customer?.phone, 40) },
      status: "pending_manual_payment",
      paymentNote: "Chưa thu tiền thật. Cần Stripe/PayPal/MoMo/VNPay trước khi thanh toán thật.",
      ...ownerFrom(user, body),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("orders").insertOne(doc);
    return res.status(200).json({ ok: true, order: { ...doc, _id: result.insertedId } });
  });
};
