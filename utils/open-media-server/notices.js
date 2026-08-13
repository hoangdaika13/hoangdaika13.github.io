const { createHmac, randomBytes } = require("crypto");
const { ObjectId } = require("mongodb");
const {
  clean,
  currentUser,
  enforceRateLimit,
  isAdminUser,
  withApi
} = require("../platform");

const PUBLIC_COPYRIGHT_EMAIL = "nhhoang130803@gmail.com";
const NOTICE_TYPES = new Set(["copyright", "privacy-publicity", "trademark", "license-metadata", "other"]);
const NOTICE_STATUSES = new Set(["received", "triage", "suspended", "rejected", "resolved"]);
const STATUS_TRANSITIONS = Object.freeze({
  received: new Set(["triage", "suspended", "rejected"]),
  triage: new Set(["suspended", "rejected", "resolved"]),
  suspended: new Set(["triage", "rejected", "resolved"]),
  rejected: new Set(["triage"]),
  resolved: new Set(["triage"])
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
let indexesReady = false;

function allowedOrigins() {
  return new Set([
    "https://hoang8.com",
    "https://www.hoang8.com",
    ...String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(","),
    process.env.PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""
  ].map((value) => String(value || "").trim().replace(/\/$/, "")).filter(Boolean));
}

function requestOrigin(req) {
  const origin = clean(req.headers?.origin, 500).replace(/\/$/, "");
  if (origin) return origin;
  try { return new URL(clean(req.headers?.referer, 1200)).origin; }
  catch { return ""; }
}

function assertSameOrigin(req) {
  const origin = requestOrigin(req);
  if (origin && allowedOrigins().has(origin)) return;
  const error = new Error("Biểu mẫu chỉ chấp nhận yêu cầu gửi trực tiếp từ website hoang8.com.");
  error.statusCode = 403;
  error.code = "OPEN_MEDIA_ORIGIN_REJECTED";
  throw error;
}

function validReportedUrl(value) {
  try {
    const parsed = new URL(clean(value, 1600));
    if (parsed.protocol !== "https:") return "";
    const origins = allowedOrigins();
    return origins.has(parsed.origin) ? parsed.href.slice(0, 1600) : "";
  } catch { return ""; }
}

function requestIp(req) {
  return clean(String(req.headers?.["x-forwarded-for"] || "").split(",")[0] || req.headers?.["x-real-ip"], 100);
}

function auditFingerprint(value) {
  const secret = String(process.env.OPEN_MEDIA_AUDIT_SALT || process.env.GATEWAY_AUDIT_SALT || "");
  if (secret.length < 32 || !value) return null;
  return createHmac("sha256", secret).update(`open-media-notice:${value}`).digest("hex");
}

function caseId(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `OM-${date}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function normalizedNotice(body) {
  const claimantName = clean(body.claimantName, 160);
  const email = clean(body.email, 254).toLowerCase();
  const noticeType = clean(body.noticeType, 40).toLowerCase();
  const reportedItemId = clean(body.reportedItemId, 160);
  const reportedUrl = validReportedUrl(body.reportedUrl);
  const doc = {
    noticeType,
    claimantName,
    email,
    organization: clean(body.organization, 200),
    country: clean(body.country, 80),
    originalWork: clean(body.originalWork, 3000),
    rightsBasis: clean(body.rightsBasis, 3000),
    reportedItemId,
    reportedUrl,
    description: clean(body.description, 6000),
    requestedAction: clean(body.requestedAction, 1000),
    electronicSignature: clean(body.electronicSignature, 160),
    goodFaith: body.goodFaith === true,
    accuracyConfirmed: body.accuracyConfirmed === true,
    authorityConfirmed: body.authorityConfirmed === true
  };
  const errors = [];
  if (!NOTICE_TYPES.has(doc.noticeType)) errors.push("Loại thông báo không hợp lệ.");
  if (claimantName.length < 2) errors.push("Cần nhập họ tên người gửi.");
  if (!EMAIL_RE.test(email)) errors.push("Email liên hệ không hợp lệ.");
  if (doc.originalWork.length < 10) errors.push("Cần mô tả tác phẩm hoặc quyền hợp pháp.");
  if (!reportedItemId && !reportedUrl) errors.push("Cần chọn nội dung hoặc cung cấp đường dẫn trên hoang8.com.");
  if (doc.description.length < 30) errors.push("Cần mô tả chi tiết nội dung bị ảnh hưởng.");
  if (doc.rightsBasis.length < 10) errors.push("Cần nêu căn cứ quyền hoặc quan hệ với chủ sở hữu.");
  if (doc.electronicSignature.length < 2) errors.push("Cần ký tên điện tử.");
  if (!doc.goodFaith || !doc.accuracyConfirmed || !doc.authorityConfirmed) errors.push("Cần xác nhận đầy đủ các cam kết pháp lý.");
  return { doc, errors };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function headerSafe(value) {
  return clean(value, 180).replace(/[\r\n]+/g, " ");
}

async function sendNotification(notice) {
  const apiKey = String(process.env.RESEND_API_KEY || "");
  const from = String(process.env.COPYRIGHT_FROM_EMAIL || process.env.EMAIL_FROM || "");
  const recipient = String(process.env.COPYRIGHT_EMAIL || PUBLIC_COPYRIGHT_EMAIL);
  if (!apiKey || !from || !recipient) return { status: "not-configured", retryable: true, attemptedAt: new Date() };
  const send = async (message, idempotencyKey) => {
    let lastCode = "provider-error";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ from, ...message }) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.id) return { sent: true, providerId: clean(payload.id, 200) };
        lastCode = `resend-${response.status}`;
        if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
      } catch (error) { lastCode = error?.name === "AbortError" ? "timeout" : "provider-error"; }
      finally { clearTimeout(timer); }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    return { sent: false, code: lastCode };
  };
  const admin = await send({ to: [recipient], reply_to: notice.email, subject: `[${notice.caseId}] Thông báo ${headerSafe(notice.noticeType)} về Open Media`, html: `<h2>Thông báo quyền mới</h2><p><strong>Mã hồ sơ:</strong> ${escapeHtml(notice.caseId)}</p><p><strong>Người gửi:</strong> ${escapeHtml(notice.claimantName)} (${escapeHtml(notice.email)})</p><p><strong>Nội dung:</strong> ${escapeHtml(notice.reportedItemId || notice.reportedUrl)}</p><p><strong>Tác phẩm/quyền:</strong> ${escapeHtml(notice.originalWork)}</p><p><strong>Căn cứ:</strong> ${escapeHtml(notice.rightsBasis)}</p><p><strong>Mô tả:</strong> ${escapeHtml(notice.description)}</p><p>Hồ sơ đã được lưu trong MongoDB. Không khôi phục nội dung tự động.</p>` }, `open-media/admin/${notice.caseId}`);
  const claimant = await send({ to: [notice.email], reply_to: recipient, subject: `[${notice.caseId}] HH Platform đã nhận thông báo quyền`, html: `<h2>HH Platform đã nhận thông báo của bạn</h2><p>Xin chào ${escapeHtml(notice.claimantName)},</p><p>Hồ sơ <strong>${escapeHtml(notice.caseId)}</strong> đã được lưu an toàn và chuyển vào hàng kiểm tra. Việc tiếp nhận không đồng nghĩa với quyết định cuối cùng.</p><p>Nội dung được báo: ${escapeHtml(notice.reportedItemId || notice.reportedUrl)}</p><p>Nếu cần bổ sung bằng chứng, hãy trả lời email này và giữ nguyên mã hồ sơ.</p>` }, `open-media/claimant/${notice.caseId}`);
  return { status: admin.sent ? (claimant.sent ? "sent" : "admin-sent") : "failed", admin, claimant, retryable: !admin.sent || !claimant.sent, attemptedAt: new Date() };
}

async function retryNotifications(req, res, db) {
  const secret = String(process.env.CRON_SECRET || ""); const authorization = String(req.headers?.authorization || "");
  if (!secret || authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Cron không được xác thực." });
  const collection = db.collection("openMediaNotices"); const rows = await collection.find({ "notification.retryable": true, "notificationAttempts": { $lt: 8 } }).sort({ updatedAt: 1 }).limit(25).toArray();
  let sent = 0;
  for (const notice of rows) { const notification = await sendNotification(notice); await collection.updateOne({ _id: notice._id }, { $set: { notification, updatedAt: new Date() }, $inc: { notificationAttempts: 1 }, $push: { history: { status: notice.status, at: new Date(), actor: "notification-recovery", notificationStatus: notification.status } } }); if (notification.status === "sent") sent += 1; }
  return res.status(200).json({ ok: true, checked: rows.length, sent });
}

async function ensureIndexes(collection) {
  if (indexesReady) return;
  await Promise.all([
    collection.createIndex({ caseId: 1 }, { unique: true }),
    collection.createIndex({ status: 1, createdAt: -1 }),
    collection.createIndex({ reportedItemId: 1, createdAt: -1 })
  ]);
  indexesReady = true;
}

async function postNotice(req, res, db, body) {
  assertSameOrigin(req);
  if (!/^application\/json(?:;|$)/i.test(String(req.headers?.["content-type"] || ""))) {
    return res.status(415).json({ error: "Biểu mẫu cần gửi ở định dạng JSON." });
  }
  if (clean(body.website, 200)) return res.status(202).json({ ok: true, status: "received" });
  const { doc, errors } = normalizedNotice(body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  const ip = requestIp(req);
  await enforceRateLimit(db, `open-media-notice:ip:${ip || "unknown"}`, 5, 60 * 60 * 1000);
  await enforceRateLimit(db, `open-media-notice:email:${doc.email}`, 3, 60 * 60 * 1000);
  const collection = db.collection("openMediaNotices");
  await ensureIndexes(collection);
  const user = await currentUser(req);
  const now = new Date();
  const notice = {
    ...doc,
    caseId: caseId(now),
    status: "received",
    submittedByUserId: user?._id || null,
    networkFingerprint: auditFingerprint(ip),
    userAgent: clean(req.headers?.["user-agent"], 500),
    notification: { status: "pending", retryable: true }, notificationAttempts: 0,
    history: [{ status: "received", at: now, actor: "claimant" }],
    createdAt: now,
    updatedAt: now
  };
  const result = await collection.insertOne(notice);
  const notification = await sendNotification(notice);
  await collection.updateOne({ _id: result.insertedId }, { $set: { notification, updatedAt: new Date() }, $inc: { notificationAttempts: 1 } });
  return res.status(201).json({
    ok: true,
    caseId: notice.caseId,
    status: notice.status,
    notificationStatus: notification.status,
    contact: String(process.env.COPYRIGHT_EMAIL || PUBLIC_COPYRIGHT_EMAIL),
    message: "Thông báo đã được lưu. Nội dung sẽ không được tự động khôi phục nếu bị tạm ẩn trong quá trình xem xét."
  });
}

async function getNotices(req, res, db) {
  const user = await currentUser(req);
  if (!user || !isAdminUser(user)) return res.status(403).json({ error: "Bạn không có quyền xem hồ sơ khiếu nại." });
  const status = clean(req.query?.status, 30);
  const query = status && NOTICE_STATUSES.has(status) ? { status } : {};
  const rows = await db.collection("openMediaNotices").find(query).sort({ createdAt: -1 }).limit(100).toArray();
  return res.status(200).json({ notices: rows.map((row) => ({ ...row, networkFingerprint: undefined, userAgent: undefined })) });
}

async function patchNotice(req, res, db, body) {
  assertSameOrigin(req);
  const user = await currentUser(req);
  if (!user || !isAdminUser(user)) return res.status(403).json({ error: "Bạn không có quyền cập nhật hồ sơ khiếu nại." });
  const id = clean(req.query?.id, 80);
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Mã hồ sơ không hợp lệ." });
  const collection = db.collection("openMediaNotices");
  const current = await collection.findOne({ _id: new ObjectId(id) });
  if (!current) return res.status(404).json({ error: "Không tìm thấy hồ sơ." });
  const nextStatus = clean(body.status, 30);
  if (!NOTICE_STATUSES.has(nextStatus) || !STATUS_TRANSITIONS[current.status]?.has(nextStatus)) {
    return res.status(409).json({ error: "Chuyển trạng thái không hợp lệ." });
  }
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      $set: { status: nextStatus, updatedAt: now },
      $push: { history: { status: nextStatus, at: now, actorUserId: user._id, note: clean(body.note, 1000) } }
    },
    { returnDocument: "after" }
  );
  if (!result) return res.status(409).json({ error: "Hồ sơ vừa được cập nhật ở nơi khác. Vui lòng tải lại." });
  if (nextStatus === "suspended" && current.reportedItemId) {
    await db.collection("openMediaRestrictions").updateOne(
      { itemId: current.reportedItemId },
      {
        $set: {
          itemId: current.reportedItemId,
          blocked: true,
          reasonCode: "rights-notice",
          activeCaseId: current.caseId,
          blockedAt: now,
          blockedByUserId: user._id,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now },
        $push: { history: { action: "suspend", caseId: current.caseId, at: now, actorUserId: user._id } }
      },
      { upsert: true }
    );
  }
  return res.status(200).json({ ok: true, notice: { ...result, networkFingerprint: undefined, userAgent: undefined } });
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method === "POST") return postNotice(req, res, db, body);
    if (req.method === "GET" && clean(req.query?.cron, 60) === "notification-recovery") return retryNotifications(req, res, db);
    if (req.method === "GET") return getNotices(req, res, db);
    if (req.method === "PATCH") return patchNotice(req, res, db, body);
    return res.status(405).json({ error: "Method not allowed" });
  });
};

module.exports.__test = Object.freeze({
  PUBLIC_COPYRIGHT_EMAIL,
  allowedOrigins,
  assertSameOrigin,
  validReportedUrl,
  normalizedNotice,
  auditFingerprint,
  caseId,
  headerSafe,
  sendNotification,
  STATUS_TRANSITIONS
});
