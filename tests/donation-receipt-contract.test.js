const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("donation receipts are sent only after verified server-side payment", () => {
  const api = read("api/donations.js");
  assert.match(api, /payOS\(\)\.webhooks\.verify\(body\)/);
  assert.match(api, /Number\(payment\.amount\) !== Number\(donation\.amount\)/);
  assert.match(api, /donation\.status !== "verified"/);
  assert.match(api, /sendDonationThankYou\(db, donations, verifiedDonation, "payos_webhook"\)/);
  assert.match(api, /paymentRequests\.get\(Number\(donation\.payosOrderCode\)\)/);
  assert.match(api, /payment\?\.status !== "PAID"/);
  assert.match(api, /Number\(payment\.amountPaid\) !== Number\(donation\.amount\)/);
  assert.doesNotMatch(api, /owner_verified|\["verified", "rejected", "pending"\]/);
});

test("receipt delivery is idempotent, leased and private", () => {
  const api = read("api/donations.js");
  assert.match(api, /"receipt\.sentAt": \{ \$exists: false \}/);
  assert.match(api, /"receipt\.leaseId": leaseId/);
  assert.match(api, /createReceiptEmailAdapter/);
  assert.match(api, /"Idempotency-Key": `donation-thanks\/\$\{String\(donationId\)\}`/);
  assert.match(api, /recipientMasked: maskEmail/);
  assert.doesNotMatch(api, /RESEND_API_KEY[^\n]*(json|send|status)/i);
});

test("support UI requires email and exposes an embedded payOS journey", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const api = read("api/donations.js");
  assert.match(client, /data-support-email[^>]+required/);
  assert.match(client, /data-support-step="payment"/);
  assert.match(client, /data-support-step="verify"/);
  assert.match(client, /data-support-step="email"/);
  assert.match(client, /data-support-receipt-status/);
  assert.match(client, /data-support-receipt-retry/);
  assert.match(`${html}\n${loader}`, /https:\/\/cdn\.payos\.vn\/payos-checkout\/v1\/stable\/payos-initialize\.js/);
  assert.match(client, /ELEMENT_ID: "hh-payos-embedded"/);
  assert.match(client, /embedded: true/);
  assert.match(client, /data-support-payos-qr-image/);
  assert.match(client, /showDirectQr/);
  assert.match(api, /QRCode\.toDataURL\(String\(payment\.qrCode\)/);
  assert.match(api, /paymentLinkId: payment\.paymentLinkId, qrImage/);
  assert.match(client, /action: "payos:create"/);
  assert.match(client, /showStage\("payment"\)/);
  assert.match(client, /showStage\("verify"\)/);
  assert.match(client, /scrollRoot\.scrollTop - 128/);
  assert.match(client, /data-support-payos-amount/);
  assert.match(client, /data-support-payos-countdown/);
  assert.match(styles, /\.support-payos-workspace\{[^}]*grid-template-columns/);
  assert.match(styles, /\.support-payos-direct img\{[^}]*width:min\(380px/);
  assert.match(styles, /\.support-payos-embed\{[^}]*height:500px/);
  assert.doesNotMatch(client, /20223021|VietQR ACB|img\.vietqr\.io|data-support-method="manual"/);
  assert.doesNotMatch(api, /paymentProviders: \{ manual: true/);
});

test("support pending state and embedded adapter are versioned and never treat SDK success as payment confirmation", async () => {
  const support = require("../support-platform.js");
  assert.equal(support.STORAGE_KEY, "hh.support.pending.v2");
  const pending = support.normalizePending({ id: "d1", reference: "HH1", amount: 50000, checkoutUrl: "https://pay.payos.vn/x", apiToken: "bad" });
  assert.equal(pending.version, 2);
  assert.equal("apiToken" in pending, false);
  assert.equal(support.normalizePending({ id: "d1", reference: "HH1", checkoutUrl: "javascript:bad" }), null);
  assert.equal(support.normalizePending({ id: "d1", reference: "HH1", checkoutUrl: "https://evil.example/looks-like-payos" }), null);
  let accepted = 0;
  let opened = 0;
  const adapter = support.createPayOSCheckoutAdapter({
    location: { pathname: "/", origin: "https://hh.example" },
    PayOSCheckout: { usePayOS(options) { options.onSuccess(); return { open() { opened += 1; } }; } }
  }, 10);
  await adapter.open({ checkoutUrl: "https://pay.payos.vn/x", onProviderAccepted: () => { accepted += 1; } });
  assert.equal(opened, 1);
  assert.equal(accepted, 1, "SDK callback only advances to backend verification");
  const source = read("support-platform.js");
  assert.match(source, /Chưa báo thành công: đang chờ backend/);
});

test("support lifecycle never calls a refund confirmed without provider evidence", () => {
  const support = require("../support-platform.js");
  const verified = support.donationLifecycle({ status: "verified", receipt: { status: "sent" } });
  assert.equal(verified.paymentConfirmed, true);
  assert.equal(verified.steps.find((step) => step.id === "receipt").state, "done");
  const incompleteRefund = support.donationLifecycle({ status: "refunded", refund: { status: "confirmed" } });
  assert.equal(incompleteRefund.refundConfirmed, false);
  const confirmedRefund = support.donationLifecycle({ status: "refunded", refund: { status: "confirmed", providerReference: "rf-1" } });
  assert.equal(confirmedRefund.refundConfirmed, true);
  assert.equal(confirmedRefund.source, "backend-status-only");
});

test("history is self-scoped and refunds require a confirmed server adapter", () => {
  const api = read("api/donations.js");
  const client = read("support-platform.js");
  assert.match(api, /find\(\{ userId: user\._id \}/);
  assert.match(api, /action === "refund:request"/);
  assert.match(api, /action === "refund:reconcile"/);
  assert.match(api, /result\.confirmed !== true \|\| result\.status !== "refunded"/);
  assert.match(api, /confirmation\.confirmed !== true/);
  assert.match(api, /status: "refunded"/);
  assert.match(client, /data-support-history-list/);
  assert.match(client, /data-support-refund-reconcile/);
});
