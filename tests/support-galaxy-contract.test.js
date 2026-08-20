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

test("Support Galaxy composes one viewport with real drawers and mobile sheets", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  const api = read("api/donations.js");
  for (const token of [
    "composeOneScreenWorkspace", "support-one-screen-grid", "support-mission-orbit",
    "support-central-workspace", "support-workspace-scroll", "support-live-summary",
    "support-drawer-host", "data-support-drawer-open", "data-support-summary-toggle",
    "support-dock-mobile", "app-support-route", "data-support-open-fallback"
  ]) assert.match(client + styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(styles, /body\.app-support-route #appMain[\s\S]*?overflow:hidden!important/);
  assert.match(styles, /\.support-workspace-scroll\{[^}]*overflow-y:auto/);
  assert.match(styles, /\.support-drawer__content\{[^}]*overflow-x:hidden;overflow-y:auto/);
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*support-dock-mobile/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(client, /MISSION_DEFINITIONS[\s\S]*Bảo mật & An toàn/);
  assert.match(api, /Bảo mật & An toàn/);
});

test("Support Galaxy live summary follows real form and PayOS state", () => {
  const client = read("support-platform.js");
  assert.match(client, /data-support-email[^\n]*addEventListener\("input", syncLiveSummary\)/);
  assert.match(client, /data-support-visibility[\s\S]*syncLiveSummary\(\)/);
  assert.match(client, /summarySubmit\.disabled = !providerReady/);
  assert.match(client, /if \(!payOSAvailable\) return/);
  assert.match(client, /document\.body\?\.classList\.remove\("app-support-route"\)/);
});
