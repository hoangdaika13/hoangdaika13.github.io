const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Neon Gateway assets are wired into the application shell", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  assert.match(html, /auth-neon-gateway\.css\?v=4/);
  assert.match(html, /auth-neon-gateway\.js\?v=3/);
  assert.match(worker, /auth-neon-gateway\.css\?v=4/);
  assert.match(worker, /auth-neon-gateway\.js\?v=3/);
  assert.match(html, /data-auth-motion-toggle/);
  assert.match(html, /class="auth-gateway-scene"/);
  assert.match(html, /class="auth-solar-system"/);
  assert.equal((html.match(/auth-planet-orbit--/g) || []).length, 4);
});

test("login showcase exposes the four product workflows without Facebook auth", () => {
  const html = read("index.html");
  for (const id of ["ai", "music", "english", "analytics"]) {
    assert.match(html, new RegExp(`data-auth-demo="${id}"`));
  }
  assert.doesNotMatch(html, /data-oauth-provider="facebook"/i);
  assert.match(html, /data-oauth-provider="google"/i);
});

test("registration keeps the eight-character password contract", () => {
  const html = read("index.html");
  assert.match(html, /minlength="8"[^>]*data-register-password/);
  assert.match(html, /name="confirmPassword"[^>]*minlength="8"/);
  assert.doesNotMatch(html, /minlength="15"/);
});

test("gateway supports state, performance fallback and reduced motion", () => {
  const script = read("auth-neon-gateway.js");
  const css = read("auth-neon-gateway.css");
  assert.match(script, /data-auth-state|authState/);
  assert.match(script, /fps < 45/);
  assert.match(script, /hh\.auth\.motion\.v1/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /data-motion-level="off"/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /gateway-planet-orbit/);
  assert.match(css, /html\.hh-page-hidden/);
  assert.doesNotMatch(css, /is-gateway-opening \.auth-solar-system[\s\S]{0,160}scale\((?:[2-9]|1\.[1-9])/);
  assert.match(css, /data-auth-state="success"[\s\S]{0,260}animation:\s*none/);
  assert.doesNotMatch(script, /classList\.add\("is-gateway-opening"\)/);
});

test("session startup always releases the login gate and home extras are deferred", () => {
  const auth = read("auth-platform.js");
  const loader = read("performance-loader.js");
  assert.match(auth, /SESSION_VISUAL_TIMEOUT/);
  assert.match(auth, /finishSessionCheck/);
  assert.match(auth, /api\("\/api\/auth\/me", \{ timeout: 6500 \}\)/);
  assert.match(auth, /\.catch\(\(error\) => \{[\s\S]*?Không thể khởi tạo phiên đăng nhập/);
  assert.match(loader, /"home-enhancements"/);
  assert.match(loader, /scheduleHomeEnhancements/);
  assert.match(loader, /requestIdleCallback/);
  assert.match(loader, /reduce\([\s\S]*?loadScript/);
});
