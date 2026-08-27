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
  const router = read("script.js");
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
  assert.match(router, /workspaceOwnsMobileDock[\s\S]{0,420}?app-support-route/);
  assert.match(router, /workspaceOwnsMobileDock[\s\S]{0,900}?style\.setProperty\("visibility", "hidden", "important"\)/);
  assert.match(router, /workspaceOwnsMobileDock[\s\S]{0,1100}?style\.setProperty\("pointer-events", "none", "important"\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(client, /MISSION_DEFINITIONS[\s\S]*Bảo mật & An toàn/);
  assert.match(api, /Bảo mật & An toàn/);
  assert.match(router, /route !== "\/support"\) window\.HHSupportPage\?\.unmount\?\.\(\)/);
  assert.match(client, /drawerHost\.hidden = true/);
  assert.match(client, /drawerHost\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(client, /drawerHost\.hidden = false/);
  assert.match(client, /role", "dialog"/);
  assert.match(client, /activeSupportShell\?\.destroy\?\.\(\)/);
});

test("Support Galaxy live summary follows real form and PayOS state", () => {
  const client = read("support-platform.js");
  assert.match(client, /data-support-email[^\n]*addEventListener\("input", syncLiveSummary\)/);
  assert.match(client, /data-support-visibility[\s\S]*syncLiveSummary\(\)/);
  assert.match(client, /data-support-summary-state/);
  assert.match(client, /data-support-summary-edit/);
  assert.match(client, /stageMeta/);
  assert.match(client, /summarySubmit\.disabled = stage === "details" \? !providerReady : !hasDonation/);
  assert.match(client, /if \(flowStage === "details"\) \{ if \(!payOSAvailable\) return/);
  assert.doesNotMatch(client, /data-support-summary-amount|data-support-summary-privacy|data-support-summary-provider/);
  assert.match(client, /document\.body\?\.classList\.remove\("app-support-route"\)/);
});

test("Support Galaxy isolates legacy footer styles and responds to workspace width", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  assert.match(client, /mission\.shortLabel \|\| mission\.label/);
  assert.match(styles, /container-name:supportGalaxy;container-type:inline-size/);
  assert.match(styles, /@container supportGalaxy \(max-width:1100px\)/);
  assert.match(styles, /@container supportGalaxy \(max-width:820px\)/);
  assert.match(styles, /support-mission-orbit>\.support-goal>footer\{[^}]*padding:0/);
  assert.match(styles, /body\.app-support-route \.app-sidebar,body\.app-support-route #appMain/);
  assert.match(styles, /grid-column:1!important;grid-row:1!important/);
});

test("Support Galaxy payment motion is cinematic, controllable and QR-safe", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  for (const token of [
    "MOTION_STORAGE_KEY", "support-payos-cosmos", "support-receipt-stars",
    "--support-journey-progress", "data-payment-stage", "supportWormholeSpin",
    "supportCosmicSpark", "supportQrSealSpin", "supportReceiptStar"
  ]) assert.match(client + styles, new RegExp(token));
  assert.match(client, /localStorage\.setItem\(MOTION_STORAGE_KEY/);
  assert.match(styles, /support-payos-direct img\{[^}]*animation:none!important;transform:none!important;filter:none!important/);
  assert.match(styles, /support-payos-direct__halo\{[^}]*animation:supportQrAura/);
  assert.doesNotMatch(styles, /@keyframes supportQrAura\{[^}]*transform:/);
  assert.match(styles, /support-page\[data-effects=static\] \.support-payos-cosmos/);
  assert.match(styles, /support-page\[data-effects=cinematic\]/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test("Support Galaxy live summary avoids duplicated payment fields and animates status safely", () => {
  const client = read("support-platform.js");
  const styles = read("support-platform.css");
  for (const token of [
    "support-summary-state", "support-summary-actions", "supportSummaryOrbit",
    "supportSummaryMissionScan", "supportSummaryStateSweep", "data-summary-stage"
  ]) assert.match(client + styles, new RegExp(token));
  assert.match(styles, /support-summary-state\[data-tone=payment\]/);
  assert.match(styles, /support-summary-secondary\[hidden\]/);
  assert.match(styles, /support-live-summary:before/);
  assert.match(styles, /@keyframes supportSummaryStatePulse/);
});
