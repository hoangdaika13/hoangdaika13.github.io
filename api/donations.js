const { ObjectId } = require("mongodb");
const { PayOS } = require("@payos/node");
const QRCode = require("qrcode");
const { randomUUID } = require("crypto");
const { clean, currentUser, enforceRateLimit, isAdminUser, ownerFrom, withApi } = require("../utils/platform");
const votesHandler = require("../utils/votes");

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 1000000000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const RECEIPT_LEASE_MS = 2 * 60 * 1000;
let payOSClient;

function payOSReady() {
  return Boolean(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY);
}

function payOS() {
  if (!payOSReady()) return null;
  if (!payOSClient) {
    payOSClient = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY
    });
  }
  return payOSClient;
}

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

function makeOrderCode() {
  return Number(`${Date.now()}${Math.floor(10 + Math.random() * 90)}`);
}

function refundAdapterReady() {
  return Boolean(process.env.DONATION_REFUND_VERIFY_URL && process.env.DONATION_REFUND_VERIFY_TOKEN);
}

async function verifyRefundWithAdapter(donation) {
  if (!refundAdapterReady()) return { confirmed: false, status: "not_configured" };
  const response = await fetch(String(process.env.DONATION_REFUND_VERIFY_URL), {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.DONATION_REFUND_VERIFY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reference: donation.reference, orderCode: donation.payosOrderCode, paymentReference: donation.payosTransactionReference, amount: donation.amount })
  });
  const result = await response.json().catch(() => ({}));
  const amountMatches = Number(result.amount) === Number(donation.amount);
  const providerReference = clean(result.providerReference || result.reference, 160);
  if (!response.ok || result.confirmed !== true || result.status !== "refunded" || !amountMatches || !providerReference) {
    return { confirmed: false, status: response.ok ? "pending_provider" : "adapter_error" };
  }
  return { confirmed: true, status: "confirmed", providerReference, provider: clean(result.provider || "refund-adapter", 80) };
}

function validEmail(value) {
  const email = clean(value, 160).toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : "";
}

function maskEmail(value) {
  const email = validEmail(value);
  if (!email) return "";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
}

function receiptReady() {
  return Boolean(process.env.RESEND_API_KEY && (process.env.DONATION_FROM_EMAIL || process.env.EMAIL_FROM));
}

function createReceiptEmailAdapter() {
  return {
    provider: "resend",
    configured: receiptReady(),
    async send({ recipient, message, donationId }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `donation-thanks/${String(donationId)}`
        },
        body: JSON.stringify({
          from: String(process.env.DONATION_FROM_EMAIL || process.env.EMAIL_FROM),
          to: [recipient], subject: message.subject, html: message.html, text: message.text,
          ...(process.env.DONATION_REPLY_TO ? { reply_to: String(process.env.DONATION_REPLY_TO) } : {}),
          tags: [{ name: "category", value: "donation_receipt" }]
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new Error(clean(result.message || result.error || `Email provider HTTP ${response.status}`, 240));
      return { provider: "resend", providerId: clean(result.id, 160) };
    }
  };
}

function receiptView(item, includeError = false) {
  const receipt = item?.receipt || {};
  return {
    status: receipt.sentAt ? "sent" : clean(receipt.status || (item?.status === "verified" ? "pending" : "waiting_payment"), 40),
    recipient: receipt.recipientMasked || maskEmail(item?.email),
    sentAt: receipt.sentAt || null,
    receiptId: item?.reference ? `HH-RCP-${item.reference}` : "",
    ...(includeError ? { attempts: Number(receipt.attempts || 0), lastError: clean(receipt.lastError, 240) } : {})
  };
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function receiptEmail(donation) {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://nhhoang13all.xyz").replace(/\/$/, "");
  const name = clean(donation.donorName || "bạn", 100);
  const amount = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(donation.amount) || 0);
  const paidAt = new Date(donation.verifiedAt || Date.now()).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "long", timeStyle: "short" });
  const receiptId = `HH-RCP-${donation.reference}`;
  const subject = `Cảm ơn bạn đã ủng hộ Nhhoang · ${donation.reference}`;
  const text = `Xin chào ${name},\n\nNhhoang chân thành cảm ơn bạn đã ủng hộ HH Platform.\n\nSố tiền: ${amount}\nMã giao dịch: ${donation.reference}\nMã xác nhận: ${receiptId}\nXác nhận lúc: ${paidAt}\n\nSự ủng hộ của bạn giúp duy trì máy chủ, dịch vụ AI và các công cụ miễn phí cho cộng đồng.\n\nXem dự án: ${siteUrl}/#/support\n\nĐây là thư xác nhận ủng hộ, không phải hóa đơn tài chính.`;
  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#080c12;color:#eef4f8;font-family:Inter,Segoe UI,Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Nhhoang đã xác nhận khoản ủng hộ ${htmlEscape(amount)} của bạn.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080c12;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #293849;border-radius:18px;overflow:hidden;background:#111923"><tr><td style="padding:28px;background:linear-gradient(135deg,#25122c,#112a31)"><div style="font-size:12px;letter-spacing:2px;color:#69e8e4;font-weight:800">HH PLATFORM · DONATION CONFIRMED</div><h1 style="margin:12px 0 6px;font-size:30px;line-height:1.15;color:#fff">Cảm ơn ${htmlEscape(name)}!</h1><p style="margin:0;color:#b8c7d2;line-height:1.6">Khoản ủng hộ của bạn đã được máy chủ xác minh thành công.</p></td></tr><tr><td style="padding:26px"><div style="padding:20px;border:1px solid #314354;border-radius:14px;background:#0b121a"><div style="font-size:12px;color:#8fa1af">SỐ TIỀN ỦNG HỘ</div><div style="margin-top:6px;font-size:32px;font-weight:900;color:#f6dd68">${htmlEscape(amount)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;color:#c5d0d8;font-size:14px"><tr><td style="padding:7px 0;color:#8193a2">Mã giao dịch</td><td align="right" style="font-weight:700">${htmlEscape(donation.reference)}</td></tr><tr><td style="padding:7px 0;color:#8193a2">Mã xác nhận</td><td align="right" style="font-weight:700">${htmlEscape(receiptId)}</td></tr><tr><td style="padding:7px 0;color:#8193a2">Thời gian</td><td align="right">${htmlEscape(paidAt)}</td></tr></table></div><p style="margin:22px 0;color:#b7c4ce;line-height:1.7">Sự ủng hộ của bạn giúp Nhhoang duy trì máy chủ, dịch vụ AI và tiếp tục phát triển các công cụ miễn phí cho cộng đồng.</p><p style="margin:24px 0"><a href="${htmlEscape(siteUrl)}/#/support" style="display:inline-block;padding:13px 20px;border-radius:10px;background:linear-gradient(135deg,#f2d85f,#5de0dd);color:#071014;text-decoration:none;font-weight:900">Xem trang tri ân</a></p><p style="margin:0;color:#718391;font-size:12px;line-height:1.6">Email được gửi tự động sau khi giao dịch được xác minh. Đây là thư xác nhận ủng hộ, không phải hóa đơn tài chính.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

async function sendDonationThankYou(db, donations, donation, trigger = "payment_verified") {
  if (!donation || donation.status !== "verified") return { status: "waiting_payment" };
  const recipient = validEmail(donation.email);
  if (!recipient) {
    await donations.updateOne({ _id: donation._id, "receipt.sentAt": { $exists: false } }, { $set: { "receipt.status": "missing_email", "receipt.lastError": "Email người ủng hộ không hợp lệ.", "receipt.updatedAt": new Date() } });
    return { status: "missing_email" };
  }
  const emailAdapter = createReceiptEmailAdapter();
  if (!emailAdapter.configured) {
    await donations.updateOne({ _id: donation._id, "receipt.sentAt": { $exists: false } }, { $set: { "receipt.status": "not_configured", "receipt.recipientMasked": maskEmail(recipient), "receipt.updatedAt": new Date() } });
    return { status: "not_configured", recipient: maskEmail(recipient) };
  }

  const now = new Date();
  const leaseId = randomUUID();
  const claimed = await donations.findOneAndUpdate(
    {
      _id: donation._id,
      status: "verified",
      "receipt.sentAt": { $exists: false },
      $or: [
        { "receipt.status": { $exists: false } },
        { "receipt.status": { $in: ["waiting_payment", "pending", "failed", "not_configured", "missing_email"] } },
        { "receipt.leaseUntil": { $lte: now } }
      ]
    },
    {
      $set: {
        "receipt.status": "sending",
        "receipt.leaseId": leaseId,
        "receipt.leaseUntil": new Date(now.getTime() + RECEIPT_LEASE_MS),
        "receipt.lastAttemptAt": now,
        "receipt.recipientMasked": maskEmail(recipient),
        "receipt.trigger": clean(trigger, 60)
      },
      $inc: { "receipt.attempts": 1 },
      $unset: { "receipt.lastError": "" }
    },
    { returnDocument: "after", includeResultMetadata: false }
  );
  if (!claimed) {
    const current = await donations.findOne({ _id: donation._id }, { projection: { receipt: 1, email: 1, reference: 1, status: 1 } });
    return receiptView(current);
  }

  try {
    const message = receiptEmail(claimed);
    const delivery = await emailAdapter.send({ recipient, message, donationId: claimed._id });
    const sentAt = new Date();
    await donations.updateOne(
      { _id: claimed._id, "receipt.leaseId": leaseId },
      { $set: { "receipt.status": "sent", "receipt.sentAt": sentAt, "receipt.provider": delivery.provider, "receipt.providerId": delivery.providerId, "receipt.updatedAt": sentAt }, $unset: { "receipt.leaseId": "", "receipt.leaseUntil": "", "receipt.lastError": "" } }
    );
    await db.collection("events").updateOne(
      { type: "donation:receipt_sent", recordId: claimed._id },
      { $setOnInsert: { type: "donation:receipt_sent", recordId: claimed._id, recipientMasked: maskEmail(recipient), provider: "resend", createdAt: sentAt } },
      { upsert: true }
    );
    return { status: "sent", recipient: maskEmail(recipient), sentAt, receiptId: `HH-RCP-${claimed.reference}` };
  } catch (error) {
    const failedAt = new Date();
    await donations.updateOne(
      { _id: claimed._id, "receipt.leaseId": leaseId },
      { $set: { "receipt.status": "failed", "receipt.lastError": clean(error?.message || "Không thể gửi email.", 240), "receipt.updatedAt": failedAt }, $unset: { "receipt.leaseId": "", "receipt.leaseUntil": "" } }
    );
    return { status: "failed", recipient: maskEmail(recipient) };
  }
}

async function reconcilePayOSStatus(db, donations, donation) {
  if (!donation || !["pending", "submitted"].includes(donation.status) || !donation.payosOrderCode || !payOSReady()) return donation;
  let payment;
  try { payment = await payOS().paymentRequests.get(Number(donation.payosOrderCode)); }
  catch { return donation; }
  if (payment?.status !== "PAID" || Number(payment.amount) !== Number(donation.amount) || Number(payment.amountPaid) !== Number(donation.amount)) return donation;
  const transaction = (Array.isArray(payment.transactions) ? payment.transactions : []).find(item => Number(item.amount) === Number(donation.amount));
  const providerReference = clean(transaction?.reference, 120);
  if (!providerReference) return donation;
  const verifiedAt = new Date();
  const result = await donations.updateOne(
    { _id: donation._id, status: { $in: ["pending", "submitted"] }, amount: Number(payment.amount) },
    { $set: { status: "verified", verifiedAt, updatedAt: verifiedAt, paymentMethod: "payos_vietqr", payosTransactionReference: providerReference, payosTransactionTime: clean(transaction.transactionDateTime, 80) }, $push: { history: { status: "verified", source: "payos_status_adapter", providerReference, at: verifiedAt } } }
  );
  if (!result.modifiedCount) return donations.findOne({ _id: donation._id });
  await db.collection("events").updateOne(
    { type: "donation:payos_verified", providerReference },
    { $setOnInsert: { type: "donation:payos_verified", providerReference, recordId: donation._id, amount: donation.amount, source: "status_adapter", createdAt: verifiedAt } },
    { upsert: true }
  );
  const verified = await donations.findOne({ _id: donation._id });
  await sendDonationThankYou(db, donations, verified, "payos_status_adapter");
  return donations.findOne({ _id: donation._id });
}

async function notificationSubscriptionHandler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để đăng ký thông báo." });
    const allowed = ["email", "push", "discord", "telegram", "in-app"];
    const channel = clean(body.channel || "email", 40);
    if (!allowed.includes(channel)) return res.status(400).json({ error: "Kênh thông báo không hợp lệ." });
    const doc = {
      channel,
      target: clean(body.target, 240),
      preferences: body.preferences || {},
      active: true,
      note: "Cần provider key để gửi email, push, Discord hoặc Telegram thật.",
      ...ownerFrom(user, body),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("notificationSubscriptions").insertOne(doc);
    return res.status(200).json({ ok: true, subscription: { ...doc, _id: result.insertedId } });
  });
}

module.exports = async function handler(req, res) {
  if (String(req.query.resource || "") === "votes") return votesHandler(req, res);
  if (String(req.query.resource || "") === "notification-subscribe") return notificationSubscriptionHandler(req, res);
  return withApi(req, res, async ({ db, body }) => {
    const donations = db.collection("donations");
    await Promise.all([
      donations.createIndex({ reference: 1 }, { unique: true }),
      donations.createIndex({ payosOrderCode: 1 }, { unique: true, sparse: true }),
      donations.createIndex({ payosTransactionReference: 1 }, { unique: true, sparse: true }),
      donations.createIndex({ status: 1, verifiedAt: -1 }),
      donations.createIndex({ userId: 1, createdAt: -1 }),
      donations.createIndex({ createdAt: -1 })
    ]);
    const user = await currentUser(req);
    const isOwner = isAdminUser(user);

    if (req.method === "POST" && String(req.query.provider || "") === "payos") {
      if (!payOSReady()) return res.status(503).json({ error: "payOS chưa được cấu hình." });
      let payment;
      try {
        payment = await payOS().webhooks.verify(body);
      } catch {
        return res.status(400).json({ error: "Chữ ký webhook payOS không hợp lệ." });
      }
      if (body.success !== true || String(payment.code || "") !== "00") {
        return res.status(200).json({ success: true, ignored: true });
      }
      const orderCode = Number(payment.orderCode || 0);
      const donation = orderCode ? await donations.findOne({ payosOrderCode: orderCode }) : null;
      if (!donation) return res.status(200).json({ success: true });
      if (Number(payment.amount) !== Number(donation.amount)) return res.status(409).json({ error: "Số tiền webhook không khớp giao dịch." });
      const now = new Date();
      const providerReference = clean(payment.reference || `payos:${orderCode}`, 120);
      await donations.updateOne(
        { _id: donation._id, status: { $in: ["pending", "submitted"] } },
        { $set: { status: "verified", verifiedAt: now, updatedAt: now, paymentMethod: "payos_vietqr", payosPaymentLinkId: clean(payment.paymentLinkId, 100), payosTransactionReference: providerReference, payosTransactionTime: clean(payment.transactionDateTime, 80) }, $push: { history: { status: "verified", source: "payos_webhook", providerReference, at: now } } }
      );
      await db.collection("events").updateOne(
        { type: "donation:payos_verified", providerReference },
        { $setOnInsert: { type: "donation:payos_verified", providerReference, recordId: donation._id, amount: donation.amount, createdAt: now } },
        { upsert: true }
      );
      const verifiedDonation = await donations.findOne({ _id: donation._id });
      const receipt = await sendDonationThankYou(db, donations, verifiedDonation, "payos_webhook");
      return res.status(200).json({ success: true, receipt: { status: receipt.status } });
    }

    if (req.method === "GET") {
      const lookupId = objectId(req.query.id);
      const lookupReference = clean(req.query.reference, 40);
      if (lookupId && lookupReference) {
        let item = await donations.findOne({ _id: lookupId, reference: lookupReference });
        if (!item) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
        item = await reconcilePayOSStatus(db, donations, item);
        return res.status(200).json({ donation: { id: String(item._id), reference: item.reference, amount: item.amount, status: item.status, paymentMethod: item.paymentMethod, verifiedAt: item.verifiedAt || null, refundedAt: item.refundedAt || null, refund: item.refund ? { status: clean(item.refund.status, 40), providerReference: clean(item.refund.providerReference, 160) } : null, receipt: receiptView(item) } });
      }
      if (String(req.query.history || "") === "1") {
        if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để xem lịch sử ủng hộ của mình." });
        const items = await donations.find({ userId: user._id }, { projection: { email: 0, donorName: 0, message: 0, payosCheckoutUrl: 0, payosAccountNumber: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
        return res.status(200).json({ donations: items.map(item => ({ id: String(item._id), reference: item.reference, amount: item.amount, status: item.status, createdAt: item.createdAt, verifiedAt: item.verifiedAt || null, refundedAt: item.refundedAt || null, refund: item.refund ? { status: clean(item.refund.status, 40), providerReference: clean(item.refund.providerReference, 160) } : null, receipt: receiptView(item) })) });
      }
      if (String(req.query.admin || "") === "1") {
        if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được quản lý giao dịch ủng hộ." });
        const items = await donations.find({}).sort({ createdAt: -1 }).limit(200).toArray();
        return res.status(200).json({
          owner: true,
          donations: items.map((item) => ({
            id: String(item._id), reference: item.reference, donorName: item.donorName,
            email: item.email, amount: item.amount, message: item.message,
            anonymous: Boolean(item.anonymous), status: item.status, paymentMethod: item.paymentMethod,
            payosOrderCode: item.payosOrderCode || null, payosTransactionReference: item.payosTransactionReference || "",
            transferTime: item.transferTime || null, createdAt: item.createdAt,
            submittedAt: item.submittedAt || null, verifiedAt: item.verifiedAt || null,
            refundedAt: item.refundedAt || null, refund: item.refund || null, history: (item.history || []).slice(-20),
            receipt: receiptView(item, true)
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
        paymentProviders: { payos: payOSReady(), receiptEmail: receiptReady(), refundReconciliation: refundAdapterReady() },
        checkedAt: new Date()
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "payos:create", 40);

    if (action === "payos:create") {
      const ip = clean(String(req.headers["x-forwarded-for"] || "").split(",")[0], 80) || "unknown";
      await enforceRateLimit(db, `donation:create:${user?._id || ip}`, 12, 60 * 60 * 1000);
      const amount = amountOf(body.amount);
      if (!amount) return res.status(400).json({ error: "Số tiền ủng hộ phải từ 1.000đ đến 1.000.000.000đ." });
      const donorName = clean(body.donorName || user?.name || "Thành viên HH", 100);
      const email = validEmail(body.email || user?.email);
      if (!donorName) return res.status(400).json({ error: "Hãy nhập tên người ủng hộ." });
      if (!email) return res.status(400).json({ error: "Hãy nhập email hợp lệ để nhận thư cảm ơn và mã xác nhận." });
      const reference = makeReference();
      if (!payOSReady()) return res.status(503).json({ error: "Kênh VietQR payOS tạm thời chưa sẵn sàng. Vui lòng thử lại sau." });
      const payosOrderCode = makeOrderCode();
      const doc = {
        userId: user?._id || null, reference, donorName, email, amount,
        message: clean(body.message, 500), anonymous: Boolean(body.anonymous),
        status: "pending", paymentMethod: "payos_vietqr",
        receipt: { status: "waiting_payment", recipientMasked: maskEmail(email), attempts: 0 },
        payosOrderCode,
        history: [{ status: "pending", source: "payos_create", at: new Date() }],
        createdAt: new Date(), updatedAt: new Date()
      };
      const result = await donations.insertOne(doc);
      await db.collection("events").insertOne({ type: "donation:intent", userId: user?._id || null, recordId: result.insertedId, createdAt: new Date() });
      const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://nhhoang13all.xyz").replace(/\/$/, "");
      try {
        const payment = await payOS().paymentRequests.create({
          orderCode: payosOrderCode,
          amount,
          description: reference,
          items: [{ name: "Ủng hộ HH Platform", quantity: 1, price: amount }],
          buyerName: donorName,
          ...(email ? { buyerEmail: email } : {}),
          cancelUrl: `${siteUrl}/`,
          returnUrl: `${siteUrl}/`,
          expiredAt: Math.floor(Date.now() / 1000) + 30 * 60
        });
        let qrImage = "";
        try {
          if (payment.qrCode) qrImage = await QRCode.toDataURL(String(payment.qrCode), { width: 560, margin: 2, errorCorrectionLevel: "M", color: { dark: "#07131c", light: "#ffffff" } });
        } catch { /* The official payOS checkout remains available as a fallback. */ }
        await donations.updateOne({ _id: result.insertedId }, { $set: { payosPaymentLinkId: payment.paymentLinkId, payosCheckoutUrl: payment.checkoutUrl, payosAccountNumber: payment.accountNumber, updatedAt: new Date() } });
        return res.status(201).json({ ok: true, donation: { id: String(result.insertedId), reference, amount, status: doc.status, paymentMethod: doc.paymentMethod }, payos: { checkoutUrl: payment.checkoutUrl, paymentLinkId: payment.paymentLinkId, qrImage, expiresIn: 1800 } });
      } catch (error) {
        await donations.updateOne({ _id: result.insertedId }, { $set: { status: "payment_error", paymentError: clean(error?.message, 300), updatedAt: new Date() } });
        return res.status(502).json({ error: "payOS chưa thể tạo VietQR. Vui lòng thử lại sau." });
      }
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
      if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được đối soát giao dịch." });
      const id = objectId(body.id);
      const nextStatus = ["rejected", "pending"].includes(body.status) ? body.status : "";
      if (!id || !nextStatus) return res.status(400).json({ error: "Trạng thái không hợp lệ." });
      const changedAt = new Date();
      const update = { status: nextStatus, adminNote: clean(body.adminNote, 500), updatedAt: changedAt, verifiedAt: null };
      const result = await donations.updateOne({ _id: id, status: { $in: ["pending", "submitted", "rejected"] } }, { $set: update, $push: { history: { status: nextStatus, source: "owner_review", at: changedAt } } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
      await db.collection("events").insertOne({ type: `donation:${nextStatus}`, userId: user._id, recordId: id, createdAt: new Date() });
      const updatedDonation = await donations.findOne({ _id: id });
      const receipt = receiptView(updatedDonation);
      return res.status(200).json({ ok: true, status: nextStatus, receipt: { status: receipt.status } });
    }

    if (action === "refund:request") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được yêu cầu đối soát hoàn tiền." });
      const id = objectId(body.id);
      const reason = clean(body.reason, 500);
      if (!id || reason.length < 5) return res.status(400).json({ error: "Cần giao dịch và lý do hoàn tiền hợp lệ." });
      const requestedAt = new Date();
      const result = await donations.updateOne(
        { _id: id, status: "verified", refund: { $exists: false } },
        { $set: { refund: { status: "pending_provider", amount: null, reason, requestedAt, requestedBy: user._id }, updatedAt: requestedAt }, $push: { history: { status: "refund_requested", source: "owner", at: requestedAt } } }
      );
      if (!result.modifiedCount) return res.status(409).json({ error: "Giao dịch không thể tạo yêu cầu hoàn tiền ở trạng thái hiện tại." });
      return res.status(202).json({ ok: true, confirmed: false, refund: { status: "pending_provider" } });
    }

    if (action === "refund:reconcile") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được đối soát hoàn tiền." });
      const id = objectId(body.id);
      const donation = id ? await donations.findOne({ _id: id, status: "verified", "refund.status": { $ne: "confirmed" } }) : null;
      if (!donation) return res.status(404).json({ error: "Không tìm thấy yêu cầu hoàn tiền đang chờ." });
      await enforceRateLimit(db, `donation:refund-reconcile:${id}`, 20, 60 * 60 * 1000);
      const confirmation = await verifyRefundWithAdapter(donation);
      if (confirmation.confirmed !== true) {
        await donations.updateOne({ _id: id, status: "verified" }, { $set: { "refund.status": confirmation.status, "refund.checkedAt": new Date(), updatedAt: new Date() } });
        return res.status(409).json({ error: confirmation.status === "not_configured" ? "Adapter hoàn tiền phía máy chủ chưa được cấu hình." : "Provider chưa xác nhận hoàn tiền.", confirmed: false, refund: { status: confirmation.status } });
      }
      const refundedAt = new Date();
      await donations.updateOne(
        { _id: id, status: "verified" },
        { $set: { status: "refunded", refundedAt, updatedAt: refundedAt, refund: { ...donation.refund, status: "confirmed", amount: donation.amount, provider: confirmation.provider, providerReference: confirmation.providerReference, confirmedAt: refundedAt, checkedAt: refundedAt } }, $push: { history: { status: "refunded", source: "refund_adapter", providerReference: confirmation.providerReference, at: refundedAt } } }
      );
      await db.collection("events").updateOne({ type: "donation:refund_confirmed", providerReference: confirmation.providerReference }, { $setOnInsert: { type: "donation:refund_confirmed", providerReference: confirmation.providerReference, recordId: id, amount: donation.amount, createdAt: refundedAt } }, { upsert: true });
      return res.status(200).json({ ok: true, confirmed: true, status: "refunded", refund: { status: "confirmed", providerReference: confirmation.providerReference } });
    }

    if (action === "receipt:retry") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ chủ sở hữu được gửi lại thư xác nhận." });
      const id = objectId(body.id);
      if (!id) return res.status(400).json({ error: "Giao dịch không hợp lệ." });
      await enforceRateLimit(db, `donation:receipt-retry:${id}`, 5, 60 * 60 * 1000);
      const donation = await donations.findOne({ _id: id });
      if (!donation) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
      if (donation.status !== "verified") return res.status(409).json({ error: "Chỉ gửi thư sau khi giao dịch đã được xác nhận." });
      const receipt = await sendDonationThankYou(db, donations, donation, "owner_retry");
      return res.status(200).json({ ok: receipt.status === "sent", receipt });
    }

    return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
  });
};

module.exports.__test = Object.freeze({ amountOf, maskEmail, createReceiptEmailAdapter, refundAdapterReady, verifyRefundWithAdapter, reconcilePayOSStatus });
