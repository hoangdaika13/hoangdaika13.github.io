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

test("support UI requires email and exposes a live confirmation journey", () => {
  const client = read("support-platform.js");
  assert.match(client, /data-support-email[^>]+required/);
  assert.match(client, /data-support-step="payment"/);
  assert.match(client, /data-support-step="verify"/);
  assert.match(client, /data-support-step="email"/);
  assert.match(client, /data-support-receipt-status/);
  assert.match(client, /data-support-receipt-retry/);
  assert.match(client, /Email cảm ơn chỉ gửi sau khi chủ sở hữu xác nhận/);
});
