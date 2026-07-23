const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("auth polish follows the active flow and reports meaningful readiness", () => {
  const source = read("auth-form-motion.js");
  assert.match(source, /auth-readiness-output/);
  assert.match(source, /dataset\.authView\s*\|\|\s*"login"/);
  assert.match(source, /login[\s\S]+register[\s\S]+recovery[\s\S]+verify-email[\s\S]+qr/);
  assert.match(source, /--auth-readiness/);
  assert.match(source, /requestAnimationFrame\(syncReadiness\)/);
});

test("readiness feedback is visual-only and never persists credentials", () => {
  const source = read("auth-form-motion.js");
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /console\.(?:log|debug|info).*password/i);
  assert.match(source, /aria-hidden/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
});

test("mode-aware motion is responsive, accessible and versioned", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const css = read("auth-form-motion.css");
  assert.match(`${html}\n${loader}`, /auth-form-motion\.css\?v=4/);
  assert.match(loader, /auth-form-motion\.js\?v=3/);
  assert.match(worker, /auth-form-motion\.css\?v=4/);
  assert.match(worker, /auth-form-motion\.js\?v=3/);
  assert.match(css, /data-auth-view="register"/);
  assert.match(css, /@media \(max-width:\s*560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("password-manager autofill refreshes progress without exposing values", () => {
  const source = read("auth-form-motion.js");
  const css = read("auth-form-motion.css");
  assert.match(source, /animationName === "afm-autofill-detected"/);
  assert.match(source, /\[500, 1400, 3200\]/);
  assert.match(css, /input:-webkit-autofill/);
  assert.match(css, /@keyframes afm-autofill-detected/);
});
