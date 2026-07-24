const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("privacy choices are explicit, reversible and marketing stays disabled", () => {
  const client = read("privacy-consent-center.js");
  const styles = read("privacy-consent-center.css");
  const endpoint = read("utils/privacy-consent-api.js");

  assert.match(client, /data-banner-accept/);
  assert.match(client, /data-banner-refuse/);
  assert.match(client, /data-banner-customize/);
  assert.match(client, /hh-banner-options/);
  assert.match(client, /data-privacy-reset/);
  assert.match(client, /necessary:\s*true/);
  assert.match(client, /marketing:\s*false/);
  assert.match(styles, /bottom:calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /max-height:calc\(100dvh - 100px - env\(safe-area-inset-bottom\)\)/);
  assert.match(endpoint, /necessary:\s*true/);
  assert.match(endpoint, /marketing:\s*false/);
  assert.match(endpoint, /privacyConsentEvents/);
  assert.match(endpoint, /expireAfterSeconds:\s*0/);
});

test("consent audit hashes guest identity and never stores raw tracking secrets", () => {
  const endpoint = read("utils/privacy-consent-api.js");

  assert.match(endpoint, /createHash\("sha256"\)/);
  assert.match(endpoint, /rawCookieValuesStored:\s*false/);
  assert.match(endpoint, /rawVisitorIdStored:\s*false/);
  assert.match(endpoint, /rawIpStored:\s*false/);
  assert.doesNotMatch(endpoint, /cookieValue\s*:/);
  assert.doesNotMatch(endpoint, /password\s*:/);
  assert.doesNotMatch(endpoint, /token\s*:/);
  assert.doesNotMatch(endpoint, /forwardedFor\s*:/);
});

test("telemetry stores only anonymous presence until analytics is granted", () => {
  const client = read("insights-pro.js");
  const backend = read("api/platform/summary.js");

  assert.match(client, /if \(analyticsAllowed\(\)\)/);
  assert.match(client, /hh:privacy-changed/);
  assert.match(backend, /analyticsConsent \? safeRoute/);
  assert.match(backend, /: "\/private"/);
  assert.match(backend, /presenceDetailStored:\s*analyticsConsent/);
  assert.match(backend, /rawKeystrokesStored:\s*false/);
  assert.match(backend, /formValuesStored:\s*false/);
  assert.match(backend, /privateMessagesStored:\s*false/);
});

test("admin privacy center exposes inventory and consent summaries only", () => {
  const api = read("utils/community-admin-api.js");
  const client = read("community-admin.js");
  const permissions = read("utils/community-admin.js");

  assert.match(api, /view === "privacy"/);
  assert.match(api, /maskedEmail/);
  assert.match(api, /privacyConsentEvents/);
  assert.match(client, /Privacy & Consent/);
  assert.match(client, /Ranh giới quản trị/);
  assert.match(permissions, /privacy\.view/);
  assert.doesNotMatch(client, /document\.cookie/);
});

test("privacy API reuses the platform function to stay inside the Vercel Hobby limit", () => {
  const vercel = read("vercel.json");
  const summary = read("api/platform/summary.js");

  assert.match(vercel, /\/api\/privacy\/consent/);
  assert.match(vercel, /privacyRoute=consent/);
  assert.match(summary, /privacyConsentHandler/);
});
