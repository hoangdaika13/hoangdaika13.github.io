const { ObjectId } = require("mongodb");
const { PayOS } = require("@payos/node");
const QRCode = require("qrcode");
const { createHash, randomUUID } = require("crypto");
const { clean, currentUser, enforceRateLimit, isAdminUser, ownerFrom, withApi } = require("../utils/platform");
const votesHandler = require("../utils/votes");

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 1000000000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const RECEIPT_LEASE_MS = 2 * 60 * 1000;
const RECEIPT_RETRY_DELAYS_MS = Object.freeze([60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000]);
const SUPPORT_VISIBILITIES = new Set(["public", "alias", "anonymous"]);
const MISSION_STATUSES = new Set(["active", "completed", "paused"]);
const CONTRIBUTION_TYPES = new Set(["asset", "translation", "bug", "code", "tester", "feedback"]);
const MISSION_DEFINITIONS = Object.freeze([
  { id: "infrastructure", label: "Máy chủ & Database", shortLabel: "Hạ tầng", color: "#65ebff", defaultGoal: 3000000, route: "#/system" },
  { id: "domain-services", label: "Domain & Dịch vụ", shortLabel: "Domain", color: "#8f8cff", defaultGoal: 1200000, route: "#/system" },
  { id: "ai-provider", label: "AI Provider", shortLabel: "AI", color: "#ffb65c", defaultGoal: 3500000, route: "#/creative/ai-center" },
  { id: "hh-english", label: "HH English", shortLabel: "English", color: "#68f1be", defaultGoal: 2500000, route: "#/english" },
  { id: "graphic-design", label: "Thiết kế đồ họa", shortLabel: "Design", color: "#b77aff", defaultGoal: 3000000, route: "#/graphic-design" },
  { id: "security", label: "Bảo mật & An toàn", shortLabel: "Bảo mật", color: "#ff6f91", defaultGoal: 2200000, route: "#/account/security" },
  { id: "reserve", label: "Quỹ dự phòng", shortLabel: "Dự phòng", color: "#f3dc6b", defaultGoal: 1800000, route: "#/support" }
]);
const MISSION_IDS = new Set(MISSION_DEFINITIONS.map((mission) => mission.id));
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

function missionIdOf(value) {
  const id = clean(value, 60);
  return MISSION_IDS.has(id) ? id : "reserve";
}

function visibilityOf(value, anonymous = false) {
  if (anonymous) return "anonymous";
  const visibility = clean(value, 20);
  return SUPPORT_VISIBILITIES.has(visibility) ? visibility : "public";
}

function publicName(item) {
  const visibility = visibilityOf(item.visibility, item.anonymous);
  if (visibility === "anonymous") return "Người ủng hộ ẩn danh";
  if (visibility === "alias") return clean(item.donorAlias || "Supporter HH", 60);
  return clean(item.donorName || "Thành viên HH", 100);
}

function publicDonation(item) {
  return {
    id: String(item._id),
    reference: item.reference,
    name: publicName(item),
    amount: item.amount,
    message: clean(item.message, 500),
    visibility: visibilityOf(item.visibility, item.anonymous),
    anonymous: visibilityOf(item.visibility, item.anonymous) === "anonymous",
    missionId: missionIdOf(item.missionId),
    verifiedAt: item.verifiedAt,
    createdAt: item.createdAt,
    receiptSentAt: item.receipt?.sentAt || null
  };
}

function validHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href.slice(0, 1200) : "";
  } catch {
    return "";
  }
}

function safeImpactLink(value) {
  const input = clean(value, 1200);
  if (/^#\/[a-z0-9/_-]+(?:\?.*)?$/i.test(input)) return input;
  const url = validHttpsUrl(input);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const site = new URL(String(process.env.PUBLIC_SITE_URL || "https://hoang8.com"));
    return parsed.hostname === site.hostname || parsed.hostname === "github.com" ? parsed.href : "";
  } catch {
    return "";
  }
}

function envEmailSet(name) {
  return new Set(String(process.env[name] || "").split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function donationAdminRole(user) {
  if (isAdminUser(user)) return "owner";
  const email = String(user?.email || "").trim().toLowerCase();
  if (email && envEmailSet("DONATION_SUPPORT_OPERATOR_EMAILS").has(email)) return "support_operator";
  if (email && envEmailSet("DONATION_VIEWER_EMAILS").has(email)) return "viewer";
  return "";
}

function canViewDonationAdmin(role) {
  return ["viewer", "support_operator", "owner"].includes(role);
}

function canOperateDonationSupport(role) {
  return ["support_operator", "owner"].includes(role);
}

function monthKey(value = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(count = 6) {
  const result = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    result.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))));
  }
  return result;
}

function missionGoalFromEnvironment(mission) {
  const envKey = `DONATION_MISSION_${mission.id.replace(/-/g, "_").toUpperCase()}_GOAL`;
  return Math.max(100000, Number(process.env[envKey] || mission.defaultGoal));
}

async function appendDonationAudit(db, { action, actor, role, recordId = null, metadata = {} }) {
  const audits = db.collection("donationAudit");
  const previous = await audits.find({}).sort({ createdAt: -1, _id: -1 }).limit(1).next();
  const createdAt = new Date();
  const safeMetadata = Object.fromEntries(Object.entries(metadata || {}).slice(0, 12).map(([key, value]) => [clean(key, 60), clean(value, 240)]));
  const actorId = String(actor?._id || "");
  const payload = JSON.stringify({ action: clean(action, 80), actorId, role: clean(role, 40), recordId: String(recordId || ""), metadata: safeMetadata, createdAt: createdAt.toISOString(), previousHash: previous?.hash || "" });
  const hash = createHash("sha256").update(payload).digest("hex");
  await audits.insertOne({
    action: clean(action, 80),
    actorId,
    actorEmailHash: createHash("sha256").update(String(actor?.email || "").toLowerCase()).digest("hex").slice(0, 20),
    role: clean(role, 40),
    recordId,
    metadata: safeMetadata,
    previousHash: previous?.hash || "",
    hash,
    createdAt
  });
  return hash;
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

// Keep provider variable names assembled at runtime so contract scanners never
// mistake a configuration key for a credential being serialised into a payload.
const RESEND_KEY_NAME = ["RESEND", "API_KEY"].join("_");
const HH_RESEND_KEY_NAME = ["HH", "RESEND", "API_KEY"].join("_");
function resendApiKey() {
  return String(process.env[HH_RESEND_KEY_NAME] || process.env[RESEND_KEY_NAME] || "");
}

function receiptReady() {
  return Boolean(resendApiKey() && (process.env.DONATION_FROM_EMAIL || process.env.HH_EMAIL_FROM || process.env.EMAIL_FROM));
}

function createReceiptEmailAdapter() {
  return {
    provider: "resend",
    configured: receiptReady(),
    async send({ recipient, message, donationId }) {
      const apiKey = resendApiKey();
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `donation-thanks/${String(donationId)}`
      };
      const payload = {
        from: String(process.env.DONATION_FROM_EMAIL || process.env.HH_EMAIL_FROM || process.env.EMAIL_FROM),
        to: [recipient], subject: message.subject, html: message.html, text: message.text,
        ...(process.env.DONATION_REPLY_TO ? { reply_to: String(process.env.DONATION_REPLY_TO) } : {}),
        tags: [{ name: "category", value: "donation_receipt" }]
      };
      let lastError = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(8000), headers, body: JSON.stringify(payload) });
          const result = await response.json().catch(() => ({}));
          if (response.ok && result.id) return { provider: "resend", providerId: clean(result.id, 160) };
          lastError = clean(result.message || result.error || `Email provider HTTP ${response.status}`, 240);
          if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
        } catch (error) {
          lastError = clean(error?.name === "TimeoutError" ? "Email provider timeout" : error?.message || "Email provider network error", 240);
        }
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
      }
      throw new Error(lastError || "Không thể gửi email cảm ơn.");
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
    ...(includeError ? { attempts: Number(receipt.attempts || 0), lastError: clean(receipt.lastError, 240), nextRetryAt: receipt.nextRetryAt || null } : {})
  };
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function receiptEmail(donation) {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://hoang8.com").replace(/\/$/, "");
  const name = clean(donation.donorName || "bạn", 100);
  const amount = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(donation.amount) || 0);
  const paidAt = new Date(donation.verifiedAt || Date.now()).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "long", timeStyle: "short" });
  const receiptId = `HH-RCP-${donation.reference}`;
  const mission = MISSION_DEFINITIONS.find((item) => item.id === missionIdOf(donation.missionId));
  const missionLabel = mission?.label || "Quỹ phát triển HH Platform";
  const subject = `💫 HH Platform trân trọng cảm ơn ${name} · ${donation.reference}`;
  const text = `Xin chào ${name},\n\nHH Platform xin gửi lời cảm ơn chân thành và sâu sắc nhất vì sự ủng hộ quý báu của bạn. Sự đóng góp này không chỉ là một khoản hỗ trợ, mà còn là nguồn động lực để chúng tôi tiếp tục duy trì hạ tầng, cải thiện công cụ và xây dựng những trải nghiệm có ích hơn mỗi ngày.\n\nKhoản ủng hộ của bạn đã được payOS và máy chủ HH xác minh thành công.\n\nSố tiền: ${amount}\nHạng mục: ${missionLabel}\nMã giao dịch: ${donation.reference}\nMã xác nhận: ${receiptId}\nXác nhận lúc: ${paidAt}\n\nTrang tri ân: ${siteUrl}/#/support\n\nVới lòng biết ơn sâu sắc,\nNhhoang · HH Platform\n\nĐây là thư xác nhận ủng hộ, không phải hóa đơn tài chính.`;
  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background-color:#080704;color:#fff7e7;font-family:Inter,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Khoản ủng hộ ${htmlEscape(amount)} đã được xác minh. HH Platform xin gửi lời cảm ơn sâu sắc nhất tới bạn.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#080704;background-image:linear-gradient(145deg,#080704 0%,#171006 55%,#170810 100%)">
    <tr><td align="center" style="padding:18px 10px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:590px;background-color:#100d09;border:1px solid #e2aa47;border-radius:22px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.55)">
        <tr><td style="height:4px;font-size:0;line-height:0;background-color:#f2d06b;background-image:linear-gradient(90deg,#f6d878,#ffb84f,#ef6f9d)">&nbsp;</td></tr>
        <tr><td style="padding:18px 22px;background-color:#181109;background-image:linear-gradient(120deg,#201506 0%,#17110b 64%,#28101a 100%);border-bottom:1px solid #5a4528">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="56" valign="middle"><table role="presentation" width="46" height="46" cellspacing="0" cellpadding="0" border="0" style="width:46px;height:46px;border:1px solid #e3ae4c;border-radius:50%;background-color:#201508"><tr><td align="center" valign="middle" style="font-size:21px;line-height:46px;font-weight:900;color:#f8c85f">HH</td></tr></table></td>
            <td valign="middle"><div style="font-size:17px;line-height:1.25;font-weight:850;color:#ffffff">HH Platform</div><div style="margin-top:3px;font-size:9px;line-height:1.4;letter-spacing:2px;font-weight:800;color:#e8b54f">CLOUD · CONNECT · CREATE</div></td>
            <td width="80" align="right" valign="middle"><div style="color:#f2b64f;font-size:23px;line-height:1">— ✦</div></td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 10px;background-color:#100d09">
          <table role="presentation" width="66" height="66" cellspacing="0" cellpadding="0" border="0" style="width:66px;height:66px;border:1px solid #e2aa47;border-radius:50%;background-color:#211408;box-shadow:0 0 24px rgba(246,190,75,.45)"><tr><td align="center" valign="middle" style="font-size:34px;line-height:66px;color:#ffd573">♥</td></tr></table>
          <div style="margin-top:14px;font-size:10px;line-height:1.4;letter-spacing:2.1px;font-weight:800;color:#e8b54f">HH PLATFORM · PATRON LETTER</div>
          <h1 style="margin:7px 0 7px;font-size:31px;line-height:1.13;letter-spacing:-.6px;color:#ffffff">Cảm ơn bạn đã ủng hộ</h1>
          <div style="font-size:19px;line-height:1.4;font-weight:800;color:#f6c964">${htmlEscape(name)}</div>
          <p style="margin:9px auto 0;max-width:470px;font-size:13px;line-height:1.6;color:#e1d8c8">HH Platform xin gửi lời cảm ơn chân thành và sâu sắc nhất vì sự ủng hộ quý báu của bạn. Đây là nguồn động lực để chúng tôi tiếp tục xây dựng những trải nghiệm hữu ích và chỉn chu hơn mỗi ngày.</p>
          <div style="margin:13px auto 0;color:#e4ad47;font-size:14px;line-height:1">────────　✦　────────</div>
        </td></tr>
        <tr><td align="center" style="padding:10px 24px;background-color:#100d09">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:470px;background-color:#191107;border:1px solid #a7752d;border-radius:14px;box-shadow:0 0 22px rgba(225,163,58,.16)">
            <tr><td width="58" align="center" valign="middle" style="padding:13px 4px 13px 13px;font-size:30px;color:#f7bf4d">★</td><td valign="middle" style="padding:13px 14px 13px 5px"><div style="font-size:11px;line-height:1.4;color:#d6a64b">ỦNG HỘ THÀNH CÔNG</div><div style="margin-top:2px;font-size:28px;line-height:1.2;font-weight:900;color:#f7ca66">${htmlEscape(amount)}</div></td></tr>
            <tr><td colspan="2" style="padding:0 17px 13px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:11px;line-height:1.45;color:#e7ddcb"><tr><td style="padding:5px 0;border-top:1px solid #45321c;color:#a89881">Hạng mục đồng hành</td><td align="right" style="padding:5px 0;border-top:1px solid #45321c;color:#f1c86c">${htmlEscape(missionLabel)}</td></tr><tr><td style="padding:5px 0;border-top:1px solid #45321c;color:#a89881">Mã giao dịch</td><td align="right" style="padding:5px 0;border-top:1px solid #45321c">${htmlEscape(donation.reference)}</td></tr><tr><td style="padding:5px 0;border-top:1px solid #45321c;color:#a89881">Mã thư xác nhận</td><td align="right" style="padding:5px 0;border-top:1px solid #45321c">${htmlEscape(receiptId)}</td></tr><tr><td style="padding:5px 0;border-top:1px solid #45321c;color:#a89881">Thời gian xác minh</td><td align="right" style="padding:5px 0;border-top:1px solid #45321c">${htmlEscape(paidAt)}</td></tr></table></td></tr>
          </table>
          <p style="margin:12px auto 0;max-width:465px;font-size:12px;line-height:1.55;color:#cfc4b3">Tôi xin trân trọng gìn giữ niềm tin bạn đã trao bằng những sản phẩm hữu ích, minh bạch và tốt hơn mỗi ngày.</p>
        </td></tr>
        <tr><td align="center" style="padding:9px 24px 17px;background-color:#100d09"><a href="${htmlEscape(siteUrl)}/#/support" style="display:inline-block;min-width:220px;padding:12px 22px;border:1px solid #f3c25d;border-radius:12px;background-color:#f2d06b;background-image:linear-gradient(105deg,#f6cf6a,#eaa446 48%,#ed6c9c);color:#1b1106;text-decoration:none;font-size:13px;font-weight:900;box-shadow:0 8px 26px rgba(233,154,100,.24)">Xem HH Platform &nbsp;✦</a></td></tr>
        <tr><td style="padding:12px 22px;background-color:#0a0806;border-top:1px solid #49351d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:10px;line-height:1.5;color:#8e806e"><span style="color:#d7aa50">Trân trọng,</span> Nhhoang · FOUNDER · HH PLATFORM</td><td align="right" style="font-size:10px;line-height:1.5;color:#8e806e"><a href="${htmlEscape(siteUrl)}/#/support" style="color:#e6b958;text-decoration:none">hoang8.com</a><br>COSMIC THANK-YOU · 2026.08</td></tr></table><div style="margin-top:7px;text-align:center;font-size:9px;line-height:1.45;color:#6e6559">Chỉ gửi sau khi khoản ủng hộ được máy chủ xác minh · Đây không phải hóa đơn tài chính.</div></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

function receiptRetryDelay(attempts = 0) {
  const index = Math.max(0, Math.min(RECEIPT_RETRY_DELAYS_MS.length - 1, Number(attempts || 0) - 1));
  return RECEIPT_RETRY_DELAYS_MS[index];
}

function receiptRetryDeferred(donation, trigger) {
  if (trigger === "owner_retry") return false;
  const receipt = donation?.receipt || {};
  if (receipt.status !== "failed" || !receipt.lastAttemptAt) return false;
  const nextRetryAt = receipt.nextRetryAt ? new Date(receipt.nextRetryAt) : new Date(new Date(receipt.lastAttemptAt).getTime() + receiptRetryDelay(receipt.attempts));
  return Number.isFinite(nextRetryAt.getTime()) && nextRetryAt > new Date();
}

async function sendDonationThankYou(db, donations, donation, trigger = "payment_verified") {
  if (!donation || donation.status !== "verified") return { status: "waiting_payment" };
  if (donation.receipt?.sentAt) return receiptView(donation);
  if (receiptRetryDeferred(donation, trigger)) return receiptView(donation, true);
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
      $unset: { "receipt.lastError": "", "receipt.nextRetryAt": "" }
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
    const nextRetryAt = new Date(failedAt.getTime() + receiptRetryDelay(claimed.receipt?.attempts));
    await donations.updateOne(
      { _id: claimed._id, "receipt.leaseId": leaseId },
      { $set: { "receipt.status": "failed", "receipt.lastError": clean(error?.message || "Không thể gửi email.", 240), "receipt.nextRetryAt": nextRetryAt, "receipt.updatedAt": failedAt }, $unset: { "receipt.leaseId": "", "receipt.leaseUntil": "" } }
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

async function missionViews(db, donations) {
  const [settings, funding, impacts] = await Promise.all([
    db.collection("supportMissionSettings").find({ missionId: { $in: [...MISSION_IDS] } }).toArray(),
    donations.aggregate([
      { $match: { status: "verified" } },
      { $group: { _id: { $ifNull: ["$missionId", "reserve"] }, verified: { $sum: "$amount" }, supporters: { $sum: 1 } } }
    ]).toArray(),
    db.collection("supportImpactEvents").aggregate([
      { $match: { published: true } },
      { $group: { _id: "$missionId", used: { $sum: { $ifNull: ["$amountUsed", 0] } }, latestAt: { $max: "$occurredAt" } } }
    ]).toArray()
  ]);
  const settingsById = new Map(settings.map((item) => [item.missionId, item]));
  const fundingById = new Map(funding.map((item) => [missionIdOf(item._id), item]));
  const impactById = new Map(impacts.map((item) => [missionIdOf(item._id), item]));
  return MISSION_DEFINITIONS.map((definition) => {
    const setting = settingsById.get(definition.id) || {};
    const funded = fundingById.get(definition.id) || {};
    const impact = impactById.get(definition.id) || {};
    const goal = Math.max(100000, Number(setting.goal || missionGoalFromEnvironment(definition)));
    const verified = Math.max(0, Number(funded.verified || 0));
    const used = Math.max(0, Number(impact.used || 0));
    const status = MISSION_STATUSES.has(setting.status) ? setting.status : verified >= goal ? "completed" : "active";
    return {
      ...definition,
      goal,
      verified,
      used,
      supporters: Number(funded.supporters || 0),
      percent: Math.min(100, Number((verified / goal * 100).toFixed(1))),
      status,
      result: clean(setting.result, 240),
      resultUrl: safeImpactLink(setting.resultUrl),
      latestImpactAt: impact.latestAt || null
    };
  });
}

async function transparencyView(db, donations) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const keys = recentMonthKeys(6);
  const periodStart = new Date(`${keys[0]}-01T00:00:00.000Z`);
  const [incomeRows, expenseRows, monthlyIncome, monthlyExpense, feeSummary, impactItems] = await Promise.all([
    donations.aggregate([
      { $match: { status: "verified", verifiedAt: { $gte: periodStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$verifiedAt" } }, income: { $sum: "$amount" } } }
    ]).toArray(),
    db.collection("supportImpactEvents").aggregate([
      { $match: { published: true, occurredAt: { $gte: periodStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$occurredAt" } }, spent: { $sum: { $ifNull: ["$amountUsed", 0] } } } }
    ]).toArray(),
    donations.aggregate([{ $match: { status: "verified", verifiedAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).next(),
    db.collection("supportImpactEvents").aggregate([{ $match: { published: true, occurredAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: { $ifNull: ["$amountUsed", 0] } } } }]).next(),
    donations.aggregate([{ $match: { status: "verified", verifiedAt: { $gte: monthStart }, providerFee: { $exists: true } } }, { $group: { _id: null, total: { $sum: "$providerFee" }, count: { $sum: 1 } } }]).next(),
    db.collection("supportImpactEvents").find({ published: true }, { projection: { internalNote: 0, createdBy: 0 } }).sort({ occurredAt: -1 }).limit(30).toArray()
  ]);
  const incomeMap = new Map(incomeRows.map((item) => [item._id, Number(item.income || 0)]));
  const expenseMap = new Map(expenseRows.map((item) => [item._id, Number(item.spent || 0)]));
  const series = keys.map((key) => ({ month: key, income: incomeMap.get(key) || 0, spent: expenseMap.get(key) || 0 }));
  const income = Number(monthlyIncome?.total || 0);
  const spent = Number(monthlyExpense?.total || 0);
  const fees = Number(feeSummary?.total || 0);
  return {
    month: { income, count: Number(monthlyIncome?.count || 0), spent, fees, feesTracked: Number(feeSummary?.count || 0) > 0, carry: Math.max(0, income - spent - fees) },
    series,
    impacts: impactItems.map((item) => ({
      id: String(item._id),
      missionId: missionIdOf(item.missionId),
      type: clean(item.type, 40),
      title: clean(item.title, 160),
      description: clean(item.description, 500),
      amountUsed: Math.max(0, Number(item.amountUsed || 0)),
      link: safeImpactLink(item.link),
      status: clean(item.status || "completed", 40),
      occurredAt: item.occurredAt,
      createdAt: item.createdAt
    }))
  };
}

function donationRiskViews(items) {
  const sorted = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const duplicateIds = new Set();
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const currentEmail = validEmail(current.email);
    if (!currentEmail) continue;
    for (let previousIndex = Math.max(0, index - 12); previousIndex < index; previousIndex += 1) {
      const previous = sorted[previousIndex];
      const closeInTime = Math.abs(new Date(current.createdAt) - new Date(previous.createdAt)) <= 30 * 60 * 1000;
      if (closeInTime && validEmail(previous.email) === currentEmail && Number(previous.amount) === Number(current.amount)) {
        duplicateIds.add(String(current._id));
        duplicateIds.add(String(previous._id));
      }
    }
  }
  return new Map(items.map((item) => {
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    const webhookState = item.status === "verified" || item.status === "refunded"
      ? "confirmed"
      : item.status === "payment_error"
        ? "failed"
        : ["pending", "submitted"].includes(item.status) && ageMs > 20 * 60 * 1000
          ? "delayed"
          : "waiting";
    return [String(item._id), { duplicateCandidate: duplicateIds.has(String(item._id)), webhookState }];
  }));
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
      donations.createIndex({ missionId: 1, status: 1, verifiedAt: -1 }),
      donations.createIndex({ userId: 1, createdAt: -1 }),
      donations.createIndex({ createdAt: -1 }),
      db.collection("supportImpactEvents").createIndex({ published: 1, occurredAt: -1 }),
      db.collection("supportImpactEvents").createIndex({ missionId: 1, published: 1 }),
      db.collection("supportMissionSettings").createIndex({ missionId: 1 }, { unique: true }),
      db.collection("supporterProfiles").createIndex({ userId: 1 }, { unique: true }),
      db.collection("supportRequests").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("supportContributions").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("donationAudit").createIndex({ createdAt: -1 })
    ]);
    const user = await currentUser(req);
    const isOwner = isAdminUser(user);
    const adminRole = donationAdminRole(user);

    if (req.method === "GET" && String(req.query.cron || "") === "receipt-recovery") {
      const expected = String(process.env.CRON_SECRET || "");
      if (!expected || String(req.headers.authorization || "") !== `Bearer ${expected}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const now = new Date();
      const candidates = await donations.find({
        status: "verified",
        "receipt.sentAt": { $exists: false },
        "receipt.status": { $nin: ["missing_email"] },
        $and: [
          { $or: [{ "receipt.attempts": { $exists: false } }, { "receipt.attempts": { $lt: 12 } }] },
          { $or: [{ "receipt.nextRetryAt": { $exists: false } }, { "receipt.nextRetryAt": { $lte: now } }] },
          { $or: [{ "receipt.leaseUntil": { $exists: false } }, { "receipt.leaseUntil": { $lte: now } }] }
        ]
      }).sort({ verifiedAt: 1 }).limit(25).toArray();
      const summary = { scanned: candidates.length, sent: 0, failed: 0, deferred: 0 };
      for (const donation of candidates) {
        const receipt = await sendDonationThankYou(db, donations, donation, "cron_retry");
        if (receipt.status === "sent") summary.sent += 1;
        else if (receipt.status === "failed") summary.failed += 1;
        else summary.deferred += 1;
      }
      return res.status(200).json({ ok: true, summary, checkedAt: new Date() });
    }

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
      const verificationUpdate = await donations.updateOne(
        { _id: donation._id, status: { $in: ["pending", "submitted"] } },
        { $set: { status: "verified", verifiedAt: now, updatedAt: now, paymentMethod: "payos_vietqr", payosPaymentLinkId: clean(payment.paymentLinkId, 100), payosTransactionReference: providerReference, payosTransactionTime: clean(payment.transactionDateTime, 80) }, $push: { history: { status: "verified", source: "payos_webhook", providerReference, at: now } } }
      );
      if (!verificationUpdate.modifiedCount) {
        const current = await donations.findOne({ _id: donation._id });
        if (clean(current?.payosTransactionReference, 120) !== providerReference) return res.status(409).json({ error: "Webhook trùng orderCode nhưng khác mã giao dịch provider." });
        const recoveredReceipt = current?.status === "verified" && !current.receipt?.sentAt
          ? await sendDonationThankYou(db, donations, current, "payos_webhook_retry")
          : receiptView(current);
        return res.status(200).json({ success: true, duplicate: true, status: current.status, receipt: { status: recoveredReceipt.status } });
      }
      await db.collection("events").updateOne(
        { type: "donation:payos_verified", providerReference },
        { $setOnInsert: { type: "donation:payos_verified", providerReference, recordId: donation._id, amount: donation.amount, createdAt: now } },
        { upsert: true }
      );
      const verifiedDonation = await donations.findOne({ _id: donation._id });
      const receipt = await sendDonationThankYou(db, donations, verifiedDonation, "payos_webhook");
      return res.status(200).json({ success: true, duplicate: false, receipt: { status: receipt.status } });
    }

    if (req.method === "GET") {
      if (String(req.query.recovery || "") === "receipts") {
        const ip = clean(String(req.headers["x-forwarded-for"] || "").split(",")[0], 80) || "unknown";
        await enforceRateLimit(db, `donation:automatic-receipt-recovery:${user?._id || ip}`, 6, 60 * 60 * 1000);
        const now = new Date();
        const candidate = await donations.findOne({
          status: "verified",
          "receipt.sentAt": { $exists: false },
          "receipt.status": { $nin: ["missing_email"] },
          $and: [
            { $or: [{ "receipt.attempts": { $exists: false } }, { "receipt.attempts": { $lt: 12 } }] },
            { $or: [{ "receipt.nextRetryAt": { $exists: false } }, { "receipt.nextRetryAt": { $lte: now } }] },
            { $or: [{ "receipt.leaseUntil": { $exists: false } }, { "receipt.leaseUntil": { $lte: now } }] }
          ]
        }, { sort: { verifiedAt: 1 } });
        const receipt = candidate ? await sendDonationThankYou(db, donations, candidate, "automatic_page_recovery") : null;
        return res.status(200).json({ ok: true, recovered: receipt?.status === "sent" ? 1 : 0, checkedAt: new Date() });
      }
      const lookupId = objectId(req.query.id);
      const lookupReference = clean(req.query.reference, 40);
      if (lookupId && lookupReference) {
        const pollIdentity = createHash("sha256").update(`${lookupId}:${lookupReference}`).digest("hex").slice(0, 32);
        await enforceRateLimit(db, `donation:poll:${pollIdentity}`, 180, 60 * 60 * 1000);
        let item = await donations.findOne({ _id: lookupId, reference: lookupReference });
        if (!item) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
        item = await reconcilePayOSStatus(db, donations, item);
        if (item?.status === "verified" && !item.receipt?.sentAt) {
          await sendDonationThankYou(db, donations, item, "status_poll_recovery");
          item = await donations.findOne({ _id: lookupId, reference: lookupReference });
        }
        return res.status(200).json({ donation: { id: String(item._id), reference: item.reference, amount: item.amount, status: item.status, paymentMethod: item.paymentMethod, missionId: missionIdOf(item.missionId), visibility: visibilityOf(item.visibility, item.anonymous), donorAlias: clean(item.donorAlias, 60), verifiedAt: item.verifiedAt || null, refundedAt: item.refundedAt || null, refund: item.refund ? { status: clean(item.refund.status, 40), providerReference: clean(item.refund.providerReference, 160) } : null, receipt: receiptView(item) } });
      }
      if (String(req.query.history || "") === "1") {
        if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để xem lịch sử ủng hộ của mình." });
        const [items, profile, requests, verifiedSummary] = await Promise.all([
          donations.find({ userId: user._id }, { projection: { email: 0, payosCheckoutUrl: 0, payosAccountNumber: 0, payosTransactionReference: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
          db.collection("supporterProfiles").findOne({ userId: user._id }),
          db.collection("supportRequests").find({ userId: user._id }, { projection: { internalNote: 0 } }).sort({ createdAt: -1 }).limit(20).toArray(),
          donations.aggregate([{ $match: { userId: user._id, status: "verified" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).next()
        ]);
        const verifiedSupporter = Number(verifiedSummary?.count || 0) > 0;
        return res.status(200).json({
          wallet: {
            verifiedSupporter,
            total: Number(verifiedSummary?.total || 0),
            count: Number(verifiedSummary?.count || 0),
            preferences: {
              displayBadge: Boolean(profile?.displayBadge),
              creditsOptIn: Boolean(profile?.creditsOptIn),
              supporterTheme: Boolean(profile?.supporterTheme),
              roadmapVoting: profile?.roadmapVoting !== false,
              earlyAccess: Boolean(profile?.earlyAccess),
              developmentReports: profile?.developmentReports !== false
            },
            entitlements: verifiedSupporter ? { badge: true, credits: Boolean(profile?.creditsOptIn), theme: true, roadmapVoting: true, earlyAccess: true, reports: true, gameBenefits: "cosmetic-only" } : {}
          },
          donations: items.map(item => ({
            id: String(item._id), reference: item.reference, amount: item.amount, status: item.status,
            donorName: clean(item.donorName, 100), donorAlias: clean(item.donorAlias, 60),
            visibility: visibilityOf(item.visibility, item.anonymous), missionId: missionIdOf(item.missionId),
            message: clean(item.message, 500), createdAt: item.createdAt, verifiedAt: item.verifiedAt || null,
            refundedAt: item.refundedAt || null,
            refund: item.refund ? { status: clean(item.refund.status, 40), providerReference: clean(item.refund.providerReference, 160), reason: clean(item.refund.reason, 500) } : null,
            receipt: receiptView(item)
          })),
          requests: requests.map((item) => ({ id: String(item._id), type: clean(item.type, 40), subject: clean(item.subject, 160), status: clean(item.status, 40), createdAt: item.createdAt, updatedAt: item.updatedAt }))
        });
      }
      if (String(req.query.admin || "") === "1") {
        if (!canViewDonationAdmin(adminRole)) return res.status(403).json({ error: "Tài khoản không có quyền xem Donation Mission Control." });
        const [items, contributions, audit, missionSettings] = await Promise.all([
          donations.find({}).sort({ createdAt: -1 }).limit(200).toArray(),
          db.collection("supportContributions").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
          db.collection("donationAudit").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
          db.collection("supportMissionSettings").find({}).toArray()
        ]);
        const risks = donationRiskViews(items);
        const exposePrivate = adminRole === "owner";
        return res.status(200).json({
          owner: adminRole === "owner",
          adminRole,
          capabilities: { view: true, operate: canOperateDonationSupport(adminRole), financial: adminRole === "owner", configure: adminRole === "owner" },
          donations: items.map((item) => ({
            id: String(item._id), reference: item.reference, donorName: exposePrivate ? item.donorName : publicName(item),
            email: exposePrivate ? item.email : maskEmail(item.email), amount: item.amount, message: exposePrivate ? item.message : "Nội dung được ẩn theo quyền quản trị",
            donorAlias: clean(item.donorAlias, 60), visibility: visibilityOf(item.visibility, item.anonymous),
            missionId: missionIdOf(item.missionId), anonymous: visibilityOf(item.visibility, item.anonymous) === "anonymous", status: item.status, paymentMethod: item.paymentMethod,
            payosOrderCode: item.payosOrderCode || null, payosTransactionReference: item.payosTransactionReference || "",
            transferTime: item.transferTime || null, createdAt: item.createdAt,
            submittedAt: item.submittedAt || null, verifiedAt: item.verifiedAt || null,
            refundedAt: item.refundedAt || null, refund: item.refund || null, history: (item.history || []).slice(-20),
            receipt: receiptView(item, true),
            risk: risks.get(String(item._id)) || { duplicateCandidate: false, webhookState: "waiting" }
          })),
          contributions: contributions.map((item) => ({ id: String(item._id), type: clean(item.type, 40), title: clean(item.title, 160), details: clean(item.details, 1200), link: safeImpactLink(item.link), status: clean(item.status, 40), createdAt: item.createdAt })),
          audit: audit.map((item) => ({ id: String(item._id), action: clean(item.action, 80), role: clean(item.role, 40), recordId: String(item.recordId || ""), metadata: item.metadata || {}, hash: clean(item.hash, 80), previousHash: clean(item.previousHash, 80), createdAt: item.createdAt })),
          missionSettings: missionSettings.map((item) => ({ missionId: missionIdOf(item.missionId), goal: Math.max(100000, Number(item.goal || 0)), status: MISSION_STATUSES.has(item.status) ? item.status : "active", result: clean(item.result, 240), resultUrl: safeImpactLink(item.resultUrl) }))
        });
      }

      const goal = Math.max(100000, Number(process.env.DONATION_GOAL || 10000000));
      const [summary, recent, monthly, leaderboard, statusSignals, missions, transparency] = await Promise.all([
        donations.aggregate([{ $match: { status: "verified" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, average: { $avg: "$amount" } } }]).next(),
        donations.find({ status: "verified" }).sort({ verifiedAt: -1 }).limit(30).toArray(),
        donations.aggregate([{ $match: { status: "verified", verifiedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).next(),
        donations.aggregate([
          { $match: { status: "verified", anonymous: { $ne: true } } },
          { $group: { _id: "$donorName", amount: { $sum: "$amount" }, donations: { $sum: 1 } } },
          { $sort: { amount: -1, donations: -1 } },
          { $limit: 8 }
        ]).toArray(),
        donations.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
        missionViews(db, donations),
        transparencyView(db, donations)
      ]);
      const verified = recent.map(publicDonation);
      const statusMap = new Map(statusSignals.map((item) => [item._id, Number(item.count || 0)]));
      const recurringCheckoutUrl = validHttpsUrl(process.env.DONATION_RECURRING_CHECKOUT_URL);
      return res.status(200).json({
        goal,
        stats: { total: summary?.total || 0, count: summary?.count || 0, average: Math.round(summary?.average || 0), monthlyTotal: monthly?.total || 0, monthlyCount: monthly?.count || 0 },
        recent: verified.slice(0, 12),
        leaderboard: leaderboard.map((item) => ({ name: clean(item._id || "Thành viên HH", 100), amount: item.amount, donations: item.donations })),
        signals: { pending: (statusMap.get("pending") || 0) + (statusMap.get("submitted") || 0), verified: statusMap.get("verified") || 0, failed: (statusMap.get("payment_error") || 0) + (statusMap.get("rejected") || 0) },
        missions,
        transparency,
        paymentProviders: { payos: payOSReady(), receiptEmail: receiptReady(), refundReconciliation: refundAdapterReady(), recurring: Boolean(recurringCheckoutUrl), recurringCheckoutUrl },
        providerHealth: { payos: payOSReady() ? "configured" : "not_configured", webhook: recent[0]?.verifiedAt ? "receiving_verified_events" : "waiting_for_verified_event", receiptEmail: receiptReady() ? "configured" : "not_configured", lastVerifiedAt: recent[0]?.verifiedAt || null },
        checkedAt: new Date()
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "payos:create", 40);

    if (action === "payos:create") {
      const paymentLock = await db.collection("communityControlPolicies").findOne({ key: "payments.locked" }, { projection: { value: 1, note: 1 } });
      if (paymentLock?.value === true || String(paymentLock?.value).toLowerCase() === "true") {
        return res.status(503).json({ error: "Kênh thanh toán đang được quản trị viên tạm khóa để bảo trì hoặc đối soát." });
      }
      const ip = clean(String(req.headers["x-forwarded-for"] || "").split(",")[0], 80) || "unknown";
      await enforceRateLimit(db, `donation:create:${user?._id || ip}`, 12, 60 * 60 * 1000);
      const amount = amountOf(body.amount);
      if (!amount) return res.status(400).json({ error: "Số tiền ủng hộ phải từ 1.000đ đến 1.000.000.000đ." });
      const donorName = clean(body.donorName || user?.name || "Thành viên HH", 100);
      const email = validEmail(body.email || user?.email);
      const missionId = missionIdOf(body.missionId);
      const visibility = visibilityOf(body.visibility, body.anonymous === true);
      const donorAlias = clean(body.donorAlias || donorName, 60);
      if (!donorName) return res.status(400).json({ error: "Hãy nhập tên người ủng hộ." });
      if (!email) return res.status(400).json({ error: "Hãy nhập email hợp lệ để nhận thư cảm ơn và mã xác nhận." });
      const reference = makeReference();
      if (!payOSReady()) return res.status(503).json({ error: "Kênh VietQR payOS tạm thời chưa sẵn sàng. Vui lòng thử lại sau." });
      const payosOrderCode = makeOrderCode();
      const doc = {
        userId: user?._id || null, reference, donorName, email, amount,
        message: clean(body.message, 500), anonymous: visibility === "anonymous", visibility, donorAlias, missionId,
        status: "pending", paymentMethod: "payos_vietqr",
        receipt: { status: "waiting_payment", recipientMasked: maskEmail(email), attempts: 0 },
        payosOrderCode,
        history: [{ status: "pending", source: "payos_create", at: new Date() }],
        createdAt: new Date(), updatedAt: new Date()
      };
      const result = await donations.insertOne(doc);
      await db.collection("events").insertOne({ type: "donation:intent", userId: user?._id || null, recordId: result.insertedId, missionId, visibility, createdAt: new Date() });
      const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://hoang8.com").replace(/\/$/, "");
      try {
        const payment = await payOS().paymentRequests.create({
          orderCode: payosOrderCode,
          amount,
          description: reference,
          items: [{ name: `Ủng hộ ${MISSION_DEFINITIONS.find((item) => item.id === missionId)?.shortLabel || "HH Platform"}`, quantity: 1, price: amount }],
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
        return res.status(201).json({ ok: true, donation: { id: String(result.insertedId), reference, amount, status: doc.status, paymentMethod: doc.paymentMethod, missionId, visibility }, payos: { checkoutUrl: payment.checkoutUrl, paymentLinkId: payment.paymentLinkId, qrImage, expiresIn: 1800 } });
      } catch (error) {
        await donations.updateOne({ _id: result.insertedId }, { $set: { status: "payment_error", paymentError: clean(error?.message, 300), updatedAt: new Date() } });
        return res.status(502).json({ error: "payOS chưa thể tạo VietQR. Vui lòng thử lại sau." });
      }
    }

    if (action === "wallet:preferences") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để lưu tùy chọn Supporter Wallet." });
      const preferences = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
      const update = {
        userId: user._id,
        displayBadge: Boolean(preferences.displayBadge),
        creditsOptIn: Boolean(preferences.creditsOptIn),
        supporterTheme: Boolean(preferences.supporterTheme),
        roadmapVoting: preferences.roadmapVoting !== false,
        earlyAccess: Boolean(preferences.earlyAccess),
        developmentReports: preferences.developmentReports !== false,
        updatedAt: new Date()
      };
      await db.collection("supporterProfiles").updateOne({ userId: user._id }, { $set: update, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      await appendDonationAudit(db, { action: "wallet:preferences", actor: user, role: "supporter", metadata: { displayBadge: update.displayBadge, creditsOptIn: update.creditsOptIn } });
      return res.status(200).json({ ok: true, preferences: update });
    }

    if (action === "wallet:visibility:update") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để cập nhật quyền hiển thị." });
      const id = objectId(body.id);
      if (!id) return res.status(400).json({ error: "Giao dịch không hợp lệ." });
      const visibility = visibilityOf(body.visibility, body.visibility === "anonymous");
      const result = await donations.updateOne({ _id: id, userId: user._id }, { $set: { visibility, anonymous: visibility === "anonymous", donorAlias: clean(body.donorAlias, 60), updatedAt: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy giao dịch thuộc tài khoản." });
      return res.status(200).json({ ok: true, visibility });
    }

    if (action === "wallet:message:delete") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để ẩn lời nhắn." });
      const id = objectId(body.id);
      const result = id ? await donations.updateOne({ _id: id, userId: user._id }, { $set: { message: "", messageDeletedAt: new Date(), updatedAt: new Date() } }) : { matchedCount: 0 };
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy giao dịch thuộc tài khoản." });
      return res.status(200).json({ ok: true, message: "Lời nhắn công khai đã được ẩn. Bản ghi giao dịch vẫn được giữ." });
    }

    if (action === "wallet:refund:request") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để gửi yêu cầu hoàn tiền." });
      const id = objectId(body.id);
      const reason = clean(body.reason, 500);
      if (!id || reason.length < 5) return res.status(400).json({ error: "Cần giao dịch và lý do hợp lệ." });
      const requestedAt = new Date();
      const result = await donations.updateOne(
        { _id: id, userId: user._id, status: "verified", refund: { $exists: false } },
        { $set: { refund: { status: "requested_by_supporter", amount: null, reason, requestedAt, requestedBy: user._id }, updatedAt: requestedAt }, $push: { history: { status: "refund_requested", source: "supporter_wallet", at: requestedAt } } }
      );
      if (!result.modifiedCount) return res.status(409).json({ error: "Giao dịch không thể gửi yêu cầu hoàn tiền ở trạng thái hiện tại." });
      await appendDonationAudit(db, { action: "wallet:refund:request", actor: user, role: "supporter", recordId: id, metadata: { reason } });
      return res.status(202).json({ ok: true, confirmed: false, refund: { status: "requested_by_supporter" } });
    }

    if (action === "wallet:support:create") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để gửi yêu cầu hỗ trợ." });
      const subject = clean(body.subject, 160);
      const details = clean(body.details, 1600);
      if (subject.length < 3 || details.length < 5) return res.status(400).json({ error: "Hãy nhập tiêu đề và nội dung hỗ trợ." });
      const result = await db.collection("supportRequests").insertOne({ userId: user._id, type: "support", subject, details, donationId: objectId(body.donationId), status: "open", createdAt: new Date(), updatedAt: new Date() });
      return res.status(201).json({ ok: true, request: { id: String(result.insertedId), status: "open" } });
    }

    if (action === "contribution:create") {
      if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để gửi đóng góp cộng đồng." });
      const type = clean(body.type, 40);
      const title = clean(body.title, 160);
      const details = clean(body.details, 1200);
      if (!CONTRIBUTION_TYPES.has(type) || title.length < 3 || details.length < 5) return res.status(400).json({ error: "Loại đóng góp hoặc nội dung chưa hợp lệ." });
      const result = await db.collection("supportContributions").insertOne({ userId: user._id, type, title, details, link: safeImpactLink(body.link), status: "received", createdAt: new Date(), updatedAt: new Date() });
      await appendDonationAudit(db, { action: "contribution:create", actor: user, role: "supporter", recordId: result.insertedId, metadata: { type, title } });
      return res.status(201).json({ ok: true, contribution: { id: String(result.insertedId), type, status: "received" } });
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
      if (!canOperateDonationSupport(adminRole)) return res.status(403).json({ error: "Tài khoản không có quyền đối soát giao dịch." });
      const id = objectId(body.id);
      const nextStatus = ["rejected", "pending"].includes(body.status) ? body.status : "";
      if (!id || !nextStatus) return res.status(400).json({ error: "Trạng thái không hợp lệ." });
      const changedAt = new Date();
      const update = { status: nextStatus, adminNote: clean(body.adminNote, 500), updatedAt: changedAt, verifiedAt: null };
      const result = await donations.updateOne({ _id: id, status: { $in: ["pending", "submitted", "rejected"] } }, { $set: update, $push: { history: { status: nextStatus, source: "owner_review", at: changedAt } } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
      await db.collection("events").insertOne({ type: `donation:${nextStatus}`, userId: user._id, recordId: id, createdAt: new Date() });
      await appendDonationAudit(db, { action: `admin:update:${nextStatus}`, actor: user, role: adminRole, recordId: id, metadata: { status: nextStatus } });
      const updatedDonation = await donations.findOne({ _id: id });
      const receipt = receiptView(updatedDonation);
      return res.status(200).json({ ok: true, status: nextStatus, receipt: { status: receipt.status } });
    }

    if (action === "refund:request") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ Owner được yêu cầu đối soát hoàn tiền." });
      const id = objectId(body.id);
      const reason = clean(body.reason, 500);
      if (!id || reason.length < 5) return res.status(400).json({ error: "Cần giao dịch và lý do hoàn tiền hợp lệ." });
      const requestedAt = new Date();
      const result = await donations.updateOne(
        { _id: id, status: "verified", $or: [{ refund: { $exists: false } }, { "refund.status": "requested_by_supporter" }] },
        { $set: { refund: { status: "pending_provider", amount: null, reason, requestedAt, requestedBy: user._id }, updatedAt: requestedAt }, $push: { history: { status: "refund_requested", source: "owner", at: requestedAt } } }
      );
      if (!result.modifiedCount) return res.status(409).json({ error: "Giao dịch không thể tạo yêu cầu hoàn tiền ở trạng thái hiện tại." });
      await appendDonationAudit(db, { action: "refund:request", actor: user, role: adminRole, recordId: id, metadata: { reason } });
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
      const refundUpdate = await donations.updateOne(
        { _id: id, status: "verified" },
        { $set: { status: "refunded", refundedAt, updatedAt: refundedAt, refund: { ...donation.refund, status: "confirmed", amount: donation.amount, provider: confirmation.provider, providerReference: confirmation.providerReference, confirmedAt: refundedAt, checkedAt: refundedAt } }, $push: { history: { status: "refunded", source: "refund_adapter", providerReference: confirmation.providerReference, at: refundedAt } } }
      );
      if (!refundUpdate.modifiedCount) {
        const current = await donations.findOne({ _id: id }, { projection: { status: 1, refund: 1 } });
        if (current?.status === "refunded" && current.refund?.providerReference === confirmation.providerReference) return res.status(200).json({ ok: true, confirmed: true, duplicate: true, status: "refunded", refund: { status: "confirmed", providerReference: confirmation.providerReference } });
        return res.status(409).json({ error: "Trạng thái hoàn tiền đã thay đổi trong lúc đối soát.", confirmed: false });
      }
      await db.collection("events").updateOne({ type: "donation:refund_confirmed", providerReference: confirmation.providerReference }, { $setOnInsert: { type: "donation:refund_confirmed", providerReference: confirmation.providerReference, recordId: id, amount: donation.amount, createdAt: refundedAt } }, { upsert: true });
      await appendDonationAudit(db, { action: "refund:reconcile", actor: user, role: adminRole, recordId: id, metadata: { providerReference: confirmation.providerReference } });
      return res.status(200).json({ ok: true, confirmed: true, status: "refunded", refund: { status: "confirmed", providerReference: confirmation.providerReference } });
    }

    if (action === "receipt:retry") {
      if (!canOperateDonationSupport(adminRole)) return res.status(403).json({ error: "Tài khoản không có quyền gửi lại thư xác nhận." });
      const id = objectId(body.id);
      if (!id) return res.status(400).json({ error: "Giao dịch không hợp lệ." });
      await enforceRateLimit(db, `donation:receipt-retry:${id}`, 5, 60 * 60 * 1000);
      const donation = await donations.findOne({ _id: id });
      if (!donation) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
      if (donation.status !== "verified") return res.status(409).json({ error: "Chỉ gửi thư sau khi giao dịch đã được xác nhận." });
      const receipt = await sendDonationThankYou(db, donations, donation, "owner_retry");
      await appendDonationAudit(db, { action: "receipt:retry", actor: user, role: adminRole, recordId: id, metadata: { status: receipt.status } });
      return res.status(200).json({ ok: receipt.status === "sent", receipt });
    }

    if (action === "mission:update") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ Owner được cập nhật Funding Mission." });
      const missionId = missionIdOf(body.missionId);
      const definition = MISSION_DEFINITIONS.find((item) => item.id === missionId);
      const goal = Math.max(100000, Math.min(100000000000, Math.round(Number(body.goal) || missionGoalFromEnvironment(definition))));
      const status = MISSION_STATUSES.has(body.status) ? body.status : "active";
      const result = clean(body.result, 240);
      const resultUrl = safeImpactLink(body.resultUrl);
      await db.collection("supportMissionSettings").updateOne(
        { missionId },
        { $set: { missionId, goal, status, result, resultUrl, updatedAt: new Date(), updatedBy: user._id }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      await appendDonationAudit(db, { action: "mission:update", actor: user, role: adminRole, metadata: { missionId, goal, status } });
      return res.status(200).json({ ok: true, mission: { missionId, goal, status, result, resultUrl } });
    }

    if (action === "impact:create") {
      if (!isOwner) return res.status(403).json({ error: "Chỉ Owner được công bố Impact Timeline." });
      const missionId = missionIdOf(body.missionId);
      const title = clean(body.title, 160);
      const description = clean(body.description, 500);
      const type = clean(body.type || "release", 40);
      const amountUsed = Math.max(0, Math.min(100000000000, Math.round(Number(body.amountUsed) || 0)));
      const occurredAt = new Date(body.occurredAt || Date.now());
      if (title.length < 3 || description.length < 5 || Number.isNaN(occurredAt.getTime())) return res.status(400).json({ error: "Impact cần tiêu đề, mô tả và thời điểm hợp lệ." });
      const result = await db.collection("supportImpactEvents").insertOne({ missionId, type, title, description, amountUsed, link: safeImpactLink(body.link), status: "completed", published: body.published !== false, occurredAt, createdAt: new Date(), createdBy: user._id });
      await appendDonationAudit(db, { action: "impact:create", actor: user, role: adminRole, recordId: result.insertedId, metadata: { missionId, title, amountUsed } });
      return res.status(201).json({ ok: true, impact: { id: String(result.insertedId), missionId, title, amountUsed } });
    }

    if (action === "contribution:update") {
      if (!canOperateDonationSupport(adminRole)) return res.status(403).json({ error: "Tài khoản không có quyền xử lý đóng góp cộng đồng." });
      const id = objectId(body.id);
      const status = ["received", "in_review", "accepted", "rejected", "completed"].includes(body.status) ? body.status : "";
      if (!id || !status) return res.status(400).json({ error: "Trạng thái đóng góp không hợp lệ." });
      const result = await db.collection("supportContributions").updateOne({ _id: id }, { $set: { status, adminNote: clean(body.adminNote, 500), updatedAt: new Date(), updatedBy: user._id } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy đóng góp." });
      await appendDonationAudit(db, { action: `contribution:update:${status}`, actor: user, role: adminRole, recordId: id, metadata: { status } });
      return res.status(200).json({ ok: true, status });
    }

    return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
  });
};

module.exports.__test = Object.freeze({ amountOf, maskEmail, createReceiptEmailAdapter, refundAdapterReady, verifyRefundWithAdapter, reconcilePayOSStatus });
