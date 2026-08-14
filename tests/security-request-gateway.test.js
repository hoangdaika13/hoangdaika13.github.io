const test = require("node:test");
const assert = require("node:assert/strict");

const platform = require("../utils/platform");
const passwordPolicy = require("../utils/password-policy");
const storage = require("../api/storage/files");
const platformSummary = require("../api/platform/summary");

test("parsed JSON bodies are limited by size and structural complexity", () => {
  assert.throws(
    () => platform.bodyOf({ headers: {}, body: { value: "x".repeat(2_000) } }, { maxBodyBytes: 1_024 }),
    (error) => error?.statusCode === 413 && error?.code === "BODY_TOO_LARGE"
  );
  assert.throws(
    () => platform.bodyOf({ headers: {}, body: { rows: Array.from({ length: 12 }, (_, index) => index) } }, { maxArrayLength: 10 }),
    (error) => error?.statusCode === 413 && error?.code === "BODY_ARRAY_TOO_LARGE"
  );
  let nested = { value: true };
  for (let index = 0; index < 8; index += 1) nested = { nested };
  assert.throws(
    () => platform.bodyOf({ headers: {}, body: nested }, { maxDepth: 5 }),
    (error) => error?.statusCode === 413 && error?.code === "BODY_TOO_DEEP"
  );
});

test("Mongo operators, dotted paths and prototype-pollution keys are rejected", () => {
  for (const body of [
    JSON.parse('{"__proto__":{"admin":true}}'),
    { filter: { $where: "sleep(1000)" } },
    { "profile.role": "owner" },
    { constructor: { prototype: { admin: true } } }
  ]) {
    assert.throws(
      () => platform.bodyOf({ headers: {}, body }),
      (error) => error?.statusCode === 400 && error?.code === "BODY_KEY_REJECTED"
    );
  }
  assert.equal(Object.prototype.admin, undefined);
});

test("Fetch Metadata blocks forged navigation while preserving allowlisted cross-site apps", () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://trusted.example";
  try {
    assert.doesNotThrow(() => platform.assertTrustedMutation({
      method: "POST",
      headers: { origin: "https://trusted.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }
    }));
    assert.throws(() => platform.assertTrustedMutation({
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }
    }), (error) => error?.statusCode === 403 && error?.code === "FETCH_METADATA_REJECTED");
    assert.throws(() => platform.assertTrustedMutation({
      method: "POST",
      headers: { origin: "https://trusted.example", "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }
    }), (error) => error?.statusCode === 403 && error?.code === "FETCH_METADATA_REJECTED");
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});

test("API responses carry traceable no-cache security headers", () => {
  const headers = {};
  const req = { headers: {} };
  platform.setCors(req, { setHeader(name, value) { headers[name] = value; } });
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(headers.Pragma, "no-cache");
  assert.equal(headers.Expires, "0");
  assert.equal(headers["X-XSS-Protection"], "0");
  assert.match(headers["X-Request-ID"], /^[0-9a-f-]{36}$/i);
  assert.equal(req.hhRequestId, headers["X-Request-ID"]);
});

test("password policy accepts passphrases and blocks weak/common credentials", () => {
  assert.equal(passwordPolicy.checkPassword("Mot cum mat khau rieng 2026!").valid, true);
  assert.equal(passwordPolicy.checkPassword("Short123!").code, "PASSWORD_TOO_SHORT");
  assert.equal(passwordPolicy.checkPassword("password1234").code, "PASSWORD_TOO_COMMON");
  assert.equal(passwordPolicy.checkPassword("a".repeat(12)).code, "PASSWORD_TOO_COMMON");
  assert.equal(passwordPolicy.checkPassword("🙂".repeat(19)).code, "PASSWORD_TOO_LONG");
});

test("private storage rejects executable and MIME-spoofed files", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert.equal(storage.__test.validateUpload("safe.png", "image/png", png), "image/png");
  assert.throws(() => storage.__test.validateUpload("attack.html", "text/html", Buffer.from("<script>")), (error) => error?.statusCode === 415);
  assert.throws(() => storage.__test.validateUpload("fake.png", "image/png", Buffer.from("not-a-png")), (error) => error?.code === "FILE_SIGNATURE_MISMATCH");
  assert.throws(() => storage.__test.validateUpload("photo.jpg", "image/png", png), (error) => error?.code === "FILE_EXTENSION_MISMATCH");
  assert.equal(storage.__test.safeStoredMime("text/html"), "application/octet-stream");
});

test("CSP reports discard URL queries and retain only bounded diagnostics", () => {
  const report = platformSummary.__test.safeCspReport({
    "csp-report": {
      "document-uri": "https://hoang8.com/private?token=must-not-survive#secret",
      "blocked-uri": "https://evil.example/payload.js?user=private",
      "effective-directive": "script-src-elem",
      "status-code": 200
    }
  });
  assert.equal(report.document, "https://hoang8.com/private");
  assert.equal(report.blocked, "https://evil.example/payload.js");
  assert.equal(report.effectiveDirective, "script-src-elem");
  assert.doesNotMatch(JSON.stringify(report), /must-not-survive|user=private|#secret/);
});
