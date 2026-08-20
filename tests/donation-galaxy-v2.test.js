const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Developer Support Galaxy renders verified-only core, mission map and constellation", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  assert.match(client, /data-support-core/);
  assert.match(client, /data-support-mission-list/);
  assert.match(client, /data-support-constellation-sky/);
  assert.match(client, /data-support-impact-list/);
  assert.match(client, /data-support-core-rays/);
  assert.match(client, /data-support-star/);
  assert.match(client, /data-support-mission-choice/);
  assert.match(styles, /\.support-core__sun/);
  assert.match(styles, /\.support-mission-card/);
  assert.match(styles, /\.support-star/);
  assert.match(styles, /\.support-impact__timeline/);
});

test("support payment and wallet carry mission, visibility, PDF, privacy and contribution contracts", () => {
  const client = read("support-platform.js");
  assert.match(client, /missionId: selectedMissionId/);
  assert.match(client, /data-support-visibility/);
  assert.match(client, /data-wallet-visibility/);
  assert.match(client, /data-wallet-message-delete/);
  assert.match(client, /wallet:refund:request/);
  assert.match(client, /wallet:preferences/);
  assert.match(client, /downloadReceiptPdf/);
  assert.match(client, /vendor\/pdf-lib\.min\.js/);
  assert.match(client, /contribution:create/);
  assert.match(client, /data-transparency-csv/);
  assert.match(client, /data-transparency-pdf/);
});

test("donation API derives public missions from verified data and separates admin roles", () => {
  const api = read("api/donations.js");
  assert.match(api, /MISSION_DEFINITIONS/);
  assert.match(api, /missionViews\(db, donations\)/);
  assert.match(api, /status: "verified"/);
  assert.match(api, /donationAdminRole/);
  assert.match(api, /DONATION_SUPPORT_OPERATOR_EMAILS/);
  assert.match(api, /DONATION_VIEWER_EMAILS/);
  assert.match(api, /supportImpactEvents/);
  assert.match(api, /supporterProfiles/);
  assert.match(api, /supportContributions/);
  assert.match(api, /donationAudit/);
  assert.match(api, /appendDonationAudit/);
  assert.match(api, /duplicateCandidate/);
  assert.match(api, /webhookState/);
  assert.match(api, /refund:reconcile/);
  assert.match(api, /providerReference/);
});

test("support assets are versioned and PDF output is cached for the route", () => {
  const loader = read("performance-loader.js");
  const sw = read("sw.js");
  const index = read("index.html");
  assert.match(loader, /support-platform\.css\?v=12/);
  assert.match(loader, /support-platform\.js\?v=19/);
  assert.match(sw, /support-platform\.css\?v=12/);
  assert.match(sw, /support-platform\.js\?v=19/);
  assert.match(sw, /vendor\/pdf-lib\.min\.js\?v=1\.17\.1/);
  assert.match(index, /performance-loader\.js\?v=400/);
});
