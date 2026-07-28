const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Support Galaxy exposes the requested cosmic donation surfaces", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  const api = read("api/donations.js");
  for (const token of [
    "support-core-star", "data-support-scroll-donate", "data-support-progress-ring",
    "Moon Spark", "Comet Fuel", "Nebula Core", "Stellar Engine", "Galaxy Guardian", "Cosmic Patron",
    "support-wormhole", "data-payment-state-item", "support-hologram-envelope",
    "data-support-download-receipt-pdf", "data-support-download-card", "data-support-share-card",
    "support-impact-constellation", "support-supporter-galaxy", "data-supporter-filter",
    "support-mission-log", "data-support-theme", "data-support-effect", "prefers-reduced-motion"
  ]) assert.match(client + styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(api, /receiptSentAt: item\.receipt\?\.sentAt \|\| null/);
  assert.match(client, /Hệ thống không tự tạo dữ liệu giả/);
  assert.match(styles, /support-page\[data-effects=static\]/);
  assert.match(styles, /@media\(max-width:440px\)/);
});

test("Support Galaxy keeps private receipt actions behind a verified donation", () => {
  const client = read("support-platform.js");
  assert.match(client, /data-support-download-receipt-pdf.*currentDonation\?\.status === "verified"/s);
  assert.match(client, /data-support-download-card.*currentDonation\?\.status === "verified"/s);
  assert.match(client, /data-support-share-card.*currentDonation\?\.status === "verified"/s);
  assert.match(client, /Email được che một phần/);
});
