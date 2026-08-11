const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("auth thank-you email templates are Gmail-safe and have text fallbacks", () => {
  const source = read("utils/auth-emails.js");
  assert.ok(source.includes('role="presentation"'));
  assert.ok(source.includes("inline"));
  assert.ok(source.includes("welcomeEmail"));
  assert.ok(source.includes("loginThankYouEmail"));
  assert.ok(source.includes("text:"));
  assert.ok(source.includes("Asia/Ho_Chi_Minh"));
  assert.ok(source.includes("maskedIp"));
  assert.ok(source.includes("https://hoang8.com"));
});

test("auth API sends welcome mail on registration and login mail on every successful method", () => {
  const source = read("api/auth/[...action].js");
  assert.match(source, /sendWelcomeThankYou\(user/);
  assert.match(source, /sendLoginThankYou\(user, session, "password"\)/);
  assert.match(source, /sendLoginThankYou\(user, session, "passkey"\)/);
  assert.match(source, /sendLoginThankYou\(user, session, "qr"\)/);
  assert.match(source, /challenge\.isNewUser \? sendWelcomeThankYou/);
  assert.match(source, /sendLoginThankYou\(user, session, challenge\.provider/);
});

test("auth email delivery uses Resend idempotency and categorised tags", () => {
  const source = read("utils/auth-security.js");
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /Array\.isArray\(tags\)/);
  const auth = read("api/auth/[...action].js");
  assert.match(auth, /auth-welcome\//);
  assert.match(auth, /auth-login\//);
});
