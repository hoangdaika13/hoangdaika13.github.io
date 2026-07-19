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
  assert.match(api, /sendDonationThankYou\(db, donations, updatedDonation, "owner_verified"\)/);
});

test("receipt delivery is idempotent, leased and private", () => {
  const api = read("api/donations.js");
  assert.match(api, /"receipt\.sentAt": \{ \$exists: false \}/);
  assert.match(api, /"receipt\.leaseId": leaseId/);
  assert.match(api, /"Idempotency-Key": `donation-thanks\/\$\{String\(claimed\._id\)\}`/);
  assert.match(api, /recipientMasked: maskEmail/);
  assert.doesNotMatch(api, /RESEND_API_KEY[^\n]*(json|send|status)/i);
});

test("support UI requires email and exposes an embedded payOS journey", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  const html = read("index.html");
  const api = read("api/donations.js");
  assert.match(client, /data-support-email[^>]+required/);
  assert.match(client, /data-support-step="payment"/);
  assert.match(client, /data-support-step="verify"/);
  assert.match(client, /data-support-step="email"/);
  assert.match(client, /data-support-receipt-status/);
  assert.match(client, /data-support-receipt-retry/);
  assert.match(html, /https:\/\/cdn\.payos\.vn\/payos-checkout\/v1\/stable\/payos-initialize\.js/);
  assert.match(client, /ELEMENT_ID: "hh-payos-embedded"/);
  assert.match(client, /embedded: true/);
  assert.match(client, /action: "payos:create"/);
  assert.match(client, /showStage\("payment"\)/);
  assert.match(client, /showStage\("verify"\)/);
  assert.match(client, /scrollRoot\.scrollTop - 128/);
  assert.match(client, /data-support-payos-amount/);
  assert.match(client, /data-support-payos-countdown/);
  assert.match(styles, /\.support-payos-workspace\{[^}]*grid-template-columns/);
  assert.match(styles, /\.support-payos-embed\{[^}]*height:500px/);
  assert.doesNotMatch(client, /20223021|VietQR ACB|img\.vietqr\.io|data-support-method="manual"/);
  assert.doesNotMatch(api, /paymentProviders: \{ manual: true/);
});
