const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Neon Gateway assets are wired into the application shell", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  assert.match(html, /auth-neon-gateway\.css\?v=9/);
  assert.match(html, /auth-h-galaxy\.css\?v=12/);
  assert.match(read("auth-neon-gateway.js"), /auth-h-galaxy\.js\?v=14/);
  assert.match(read("auth-neon-gateway.js"), /auth-living-galaxy-3d\.js\?v=16/);
  assert.match(html, /auth-neon-gateway\.js\?v=29/);
  assert.match(worker, /auth-neon-gateway\.css\?v=9/);
  assert.match(worker, /auth-h-galaxy\.css\?v=12/);
  assert.match(worker, /auth-h-galaxy\.js\?v=14/);
  assert.match(worker, /auth-living-galaxy-3d\.js\?v=16/);
  assert.match(worker, /auth-neon-gateway\.js\?v=29/);
  assert.doesNotMatch(html, /auth-creative-universe\.css/);
  assert.match(read("performance-loader.js"), /"auth-effects":\s*\{[\s\S]{0,520}?styles:\s*\[\],[\s\S]{0,80}?scripts:\s*\[\]/);
  assert.match(html, /data-auth-motion-toggle/);
  assert.match(html, /class="auth-gateway-scene"/);
  assert.doesNotMatch(html, /class="auth-solar-system"/);
  assert.equal([...html.matchAll(/data-hh-planet="\d+"/g)].length, 25);
});

test("login galaxy replaces the old showcase and keeps Google-only auth", () => {
  const html = read("index.html");
  for (const id of ["home", "creative", "music", "media", "graphic", "dev", "work", "communication", "analytics", "learning", "english", "japanese", "system", "support"]) {
    assert.match(html, new RegExp(`data-hh-galaxy-key="${id}"`));
  }
  assert.doesNotMatch(html, /data-hh-galaxy-key="(?:entertainment|character)"/);
  assert.doesNotMatch(html, /auth-feature-showcase|auth-benefits/);
  assert.doesNotMatch(html, /data-oauth-provider="facebook"/i);
  assert.match(html, /data-oauth-provider="google"/i);
});

test("registration keeps the hardened twelve-character password contract", () => {
  const html = read("index.html");
  assert.match(html, /minlength="12"[^>]*data-register-password/);
  assert.match(html, /name="confirmPassword"[^>]*minlength="12"/);
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
  assert.match(css, /html\.hh-page-hidden/);
  assert.match(css, /data-auth-state="success"[\s\S]{0,260}animation:\s*none/);
  assert.doesNotMatch(script, /classList\.add\("is-gateway-opening"\)/);
  assert.match(css, /data-auth-viewport-mode="single"/);
  assert.match(css, /display:\s*flex\s*!important/);
});

test("session startup releases the login gate while home enhancements load after paint", () => {
  const auth = read("auth-platform.js");
  const loader = read("performance-loader.js");
  assert.match(auth, /SESSION_VISUAL_TIMEOUT/);
  assert.match(auth, /finishSessionCheck/);
  assert.match(auth, /api\("\/api\/auth\/me\?compact=1", \{ timeout: 5000 \}\)/);
  assert.match(auth, /\.catch\(\(error\) => \{[\s\S]*?Không thể khởi tạo phiên đăng nhập/);
  assert.match(loader, /"home-enhancements"/);
  assert.match(loader, /if \(value === "\/home"\) return \[\]/);
  assert.match(loader, /scheduleHomeEnhancements/);
  assert.match(loader, /requestIdleCallback/);
  assert.match(loader, /reduce\([\s\S]*?loadScript/);
});
