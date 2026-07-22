const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("login repair stylesheet loads last and keeps the primary form compact", () => {
  const html = read("index.html");
  const css = read("auth-login-repair.css");
  assert.match(html, /motion-comfort\.css[^>]+>\s*<link rel="stylesheet" href="auth-login-repair\.css\?v=1"/);
  assert.match(css, /data-auth-view="login"[^}]+#gateLoginForm/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.hh-consent-banner\[data-privacy-banner\]/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]+\.auth-gate-brand[\s\S]+display:\s*none/);
});

test("auth runtime publishes the active view for responsive layout", () => {
  const runtime = read("auth-platform.js");
  const experience = read("auth-experience.js");
  assert.match(runtime, /gate\.dataset\.authView = "login"/);
  assert.match(runtime, /gate\.dataset\.authView = name/);
  assert.match(runtime, /Bước 2\/3 · Hoàn thiện hồ sơ hiển thị/);
  assert.match(runtime, /Khôi phục mật khẩu bằng email đã xác minh/);
  assert.match(experience, /if \(!window\.HHAuthPlatform\?\.init\)/);
});

test("Google OAuth bootstraps on the configured callback origin", () => {
  const api = read("api/auth/[...action].js");
  assert.match(api, /const callbackOrigin = new URL\(redirectUri\)\.origin/);
  assert.match(api, /if \(callbackOrigin !== requestOrigin\)/);
  assert.match(api, /new URL\(`\/api\/auth\/\$\{provider\}`,[^)]*callbackOrigin\)/);
});
