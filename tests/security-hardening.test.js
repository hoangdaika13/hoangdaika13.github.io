const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("mutating browser requests must come from a trusted origin", () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://trusted.example";
  delete require.cache[require.resolve("../utils/platform")];
  const { __test } = require("../utils/platform");

  assert.doesNotThrow(() => __test.assertTrustedMutation({
    method: "POST",
    headers: { origin: "https://trusted.example", authorization: "Bearer token" }
  }));
  assert.throws(() => __test.assertTrustedMutation({
    method: "POST",
    headers: { origin: "https://evil.example", authorization: "Bearer token" }
  }), (error) => error?.statusCode === 403 && error?.code === "CSRF_ORIGIN_REJECTED");
  assert.throws(() => __test.assertTrustedMutation({
    method: "POST",
    headers: { origin: "https://evil.example" }
  }), (error) => error?.statusCode === 403);
  assert.doesNotThrow(() => __test.assertTrustedMutation({
    method: "POST",
    headers: { authorization: "Bearer server-client" }
  }));

  process.env.ALLOWED_ORIGINS = previous;
  delete require.cache[require.resolve("../utils/platform")];
});

test("security-sensitive storage and responses avoid raw identifiers and errors", () => {
  const platform = read("utils/platform.js");
  const votes = read("utils/votes.js");
  const auth = read("utils/auth-security.js");
  const vercel = read("vercel.json");

  assert.match(platform, /createHmac\("sha256", process\.env\.GATEWAY_AUDIT_SALT \|\| jwtSecret\(\)\)/);
  assert.match(platform, /Retry-After/);
  assert.match(votes, /enforceRateLimit/);
  assert.match(votes, /actorHash/);
  assert.match(votes, /createHmac\("sha256", secret\)/);
  assert.doesNotMatch(votes, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(votes, /error\.message/);
  assert.match(auth, /SESSION_COOKIE_SAMESITE \|\| "Lax"/);
  assert.match(auth, /HttpOnly; Secure; SameSite=\$\{sameSite\}; Priority=High/);
  assert.match(vercel, /X-Robots-Tag/);
  assert.match(vercel, /default-src 'none'; base-uri 'none'/);
  assert.match(vercel, /"Referrer-Policy", "value": "no-referrer"/);
  assert.match(vercel, /publickey-credentials-get=\(self\)/);
  assert.match(read("index.html"), /<meta name="referrer" content="no-referrer">/);
});

test("active document formats are downloaded instead of rendered inline", () => {
  const community = read("api/community.js");
  assert.doesNotMatch(community, /mimeType === "application\/pdf" \? "inline"/);
  assert.match(community, /\/\^\(image\|video\|audio\)\\\//);
});
