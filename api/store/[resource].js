const { clean, currentUser, ownerFrom, setCors, withApi } = require("../../utils/platform");

const TOOL_GATEWAYS = Object.freeze({
  tools: require("../../tool-api/tools"),
  jobs: require("../../tool-api/jobs"),
  files: require("../../tool-api/files"),
  ai: require("../../tool-api/ai"),
  integrations: require("../../tool-api/integrations"),
  events: require("../../tool-api/events")
});

const products = [
  { id: "hh-voice-lite", title: "HH Voice Studio Lite", price: 0, currency: "VND", type: "download" },
  { id: "kich-ban-ai-source", title: "Kich ban AI Source", price: 0, currency: "VND", type: "source" },
  { id: "portfolio-membership", title: "Creator Membership", price: 99000, currency: "VND", type: "membership" }
];

module.exports = async function handler(req, res) {
  const gateway = clean(req.query?.gateway, 30).toLocaleLowerCase("en-US");
  if (gateway && TOOL_GATEWAYS[gateway]) return TOOL_GATEWAYS[gateway](req, res);
  const resource = clean(req.query?.resource, 30).toLocaleLowerCase("en-US");

  if (resource === "products") {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return res.status(200).json({ products });
  }

  if (resource === "orders") {
    return withApi(req, res, async ({ db, body }) => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để tạo đơn hàng." });
      const doc = {
        items: Array.isArray(body.items) ? body.items.slice(0, 20) : [],
        customer: {
          name: clean(body.customer?.name, 120),
          email: clean(body.customer?.email, 160),
          phone: clean(body.customer?.phone, 40)
        },
        status: "pending_manual_payment",
        paymentNote: "Chưa thu tiền thật. Cần kết nối Stripe, PayPal, MoMo hoặc VNPay trước khi thanh toán.",
        ...ownerFrom(user, body),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await db.collection("orders").insertOne(doc);
      return res.status(200).json({ ok: true, order: { ...doc, _id: result.insertedId } });
    });
  }

  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(404).json({ error: "Không tìm thấy tài nguyên Store." });
};
