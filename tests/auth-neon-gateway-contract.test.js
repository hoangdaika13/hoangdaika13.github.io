const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Neon Gateway assets are wired into the application shell", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  assert.match(html, /auth-neon-gateway\.css\?v=1/);
  assert.match(html, /auth-neon-gateway\.js\?v=1/);
  assert.match(worker, /auth-neon-gateway\.css\?v=1/);
  assert.match(worker, /auth-neon-gateway\.js\?v=1/);
  assert.match(html, /data-auth-motion-toggle/);
  assert.match(html, /class="auth-gateway-scene"/);
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
});
