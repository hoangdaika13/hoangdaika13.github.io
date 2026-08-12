const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const security = require("../utils/tiktokSecurity");
const manager = require("../utils/tiktokCreatorManager");

function withEncryptionKey(run) {
  const previous = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = "tiktok-security-test-key-with-at-least-32-characters";
  try { return run(); }
  finally {
    if (previous === undefined) delete process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
    else process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = previous;
  }
}

test("TikTok token vault uses AES-256-GCM and binds ciphertext to owner plus connection", () => withEncryptionKey(() => {
  const owner = { userId: "owner-a", connectionId: "connection-a" };
  const encrypted = security.encryptToken("access-token-secret", owner);
  assert.match(encrypted, /^v1\./);
  assert.equal(encrypted.includes("access-token-secret"), false);
  assert.equal(security.decryptToken(encrypted, owner), "access-token-secret");
  assert.throws(() => security.decryptToken(encrypted, { userId: "owner-b", connectionId: "connection-a" }), (error) => error.code === "TIKTOK_TOKEN_INVALID");
  assert.throws(() => security.decryptToken(encrypted, { userId: "owner-a", connectionId: "connection-b" }), (error) => error.code === "TIKTOK_TOKEN_INVALID");
}));

test("token vault rejects missing keys and does not silently fall back to a shared secret", () => {
  const previous = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  delete process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  try {
    assert.throws(
      () => security.encryptToken("secret", { userId: "owner-a", connectionId: "connection-a" }),
      (error) => error.code === "TIKTOK_ENCRYPTION_MISSING" && error.statusCode === 503
    );
  } finally {
    if (previous !== undefined) process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("public serializers redact owner ids, access tokens, refresh tokens and upload URLs", () => {
  const visible = security.publicConnection({
    userId: "owner-private",
    connectionId: "connection-a",
    openId: "open-a",
    displayName: "Creator A",
    encryptedAccessToken: "access-secret",
    encryptedRefreshToken: "refresh-secret",
    encryptedUploadUrl: "upload-secret",
    active: true
  });
  assert.equal(visible.id, "connection-a");
  assert.equal(Object.hasOwn(visible, "userId"), false);
  assert.equal(Object.hasOwn(visible, "encryptedAccessToken"), false);
  assert.equal(Object.hasOwn(visible, "encryptedRefreshToken"), false);
  assert.equal(JSON.stringify(visible).includes("secret"), false);

  const job = manager.__test.publicJob({
    _id: "job-a",
    userId: "owner-private",
    connectionId: "connection-a",
    kind: "direct-post",
    status: "ready",
    payload: { title: "private draft" },
    encryptedUploadUrl: "upload-secret"
  });
  assert.equal(Object.hasOwn(job, "userId"), false);
  assert.equal(Object.hasOwn(job, "payload"), false);
  assert.equal(Object.hasOwn(job, "encryptedUploadUrl"), false);
});

test("OAuth state is random, hashed, expiring and atomically single-use", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /crypto\.randomBytes\((?:3[2-9]|[4-9]\d+)\)\.toString\("base64url"\)/);
  assert.match(source, /stateHash:\s*crypto\.createHash\("sha256"\)\.update\(rawState\)\.digest\("hex"\)/);
  assert.match(source, /expiresAt:\s*new Date\(Date\.now\(\) \+ 10 \* 60 \* 1000\)/);
  assert.match(source, /findOneAndDelete\(\{ stateHash, expiresAt:\s*\{ \$gt:\s*new Date\(\) \} \}\)/);
  assert.match(source, /createIndex\(\{ expiresAt:\s*1 \}, \{ expireAfterSeconds:\s*0 \}\)/);
});

test("normal Web Login Kit flow uses OAuth state and never sends an undefined PKCE verifier", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /AUTHORIZE_URL\s*=\s*"https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\/"/);
  assert.match(source, /response_type:\s*"code"/);
  assert.match(source, /redirect_uri:\s*callbackUrl\(req\)/);
  assert.doesNotMatch(source, /code_verifier\s*:/);
  assert.doesNotMatch(source, /code_challenge|codeChallenge/);
  assert.doesNotMatch(source, /single-use-pkce/i);
});

test("OAuth callback and every account operation enforce the current HH owner", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /String\(callbackUser\._id\) !== String\(state\.userId\)/);
  assert.match(source, /const query = \{ userId,/);
  for (const operation of ["findOne", "updateMany", "updateOne", "deleteOne"]) {
    assert.match(source, new RegExp(`${operation}\\([^\\n]{0,180}userId`));
  }
  assert.match(source, /snapshots\.find\(\{ userId:\s*user\._id \}\)/);
  assert.match(source, /projects\.find\(\{ userId:\s*user\._id \}\)/);
  assert.match(source, /audits\.find\(\{ userId:\s*user\._id \}\)/);
});

test("refresh rotates both tokens without trying to overwrite MongoDB immutable _id", () => {
  const source = read("utils/tiktokCreatorManager.js");
  const accessTokenBody = source.slice(source.indexOf("async function accessToken"), source.indexOf("function publicJob"));
  assert.match(accessTokenBody, /grant_type:\s*"refresh_token"/);
  assert.match(accessTokenBody, /encryptedAccessToken:\s*encryptToken\(tokens\.access_token/);
  assert.match(accessTokenBody, /encryptedRefreshToken:\s*encryptToken\(tokens\.refresh_token \|\| refreshToken/);
  assert.doesNotMatch(accessTokenBody, /const next\s*=\s*\{\s*\.\.\.record/);
  assert.doesNotMatch(accessTokenBody, /\$set:\s*record/);
  assert.match(accessTokenBody, /updateOne\(\{ _id:\s*record\._id, userId:\s*record\.userId \}/);
});

test("disconnect revokes with TikTok and deletes only the owner's selected connection", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /route === "connection\/disconnect"/);
  assert.match(source, /\/v2\/oauth\/revoke\//);
  assert.match(source, /connections\.deleteOne\(\{ _id:\s*record\._id, userId:\s*user\._id \}\)/);
  assert.match(source, /connection:revoked/);
});

test("publish preparation enforces conservative privacy and explicit consent", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /(?:if \(!privacy\)|mode === "direct" && !privacy)[\s\S]{0,160}TIKTOK_PRIVACY_REQUIRED/);
  assert.match(source, /(?:!auditConfigured\(\)|mode === "direct" && !auditConfigured\(\)) && privacy !== "SELF_ONLY"/);
  assert.match(source, /body\.confirmed !== true \|\| body\.previewed !== true/);
  assert.match(source, /body\.musicConfirmed !== true/);
  assert.match(source, /commentDisabled:\s*body\.commentEnabled !== true/);
  assert.match(source, /duetDisabled:\s*body\.duetEnabled !== true/);
  assert.match(source, /stitchDisabled:\s*body\.stitchEnabled !== true/);
  assert.match(source, /aigc:\s*body\.aigc === true/);
  assert.match(source, /brandOrganic:\s*ownBrand/);
  assert.match(source, /brandContent:\s*brandedContent/);
  assert.match(source, /TIKTOK_COMMERCIAL_DISCLOSURE_REQUIRED/);
  assert.match(source, /TIKTOK_BRANDED_PRIVACY_INVALID/);
});

test("publish initialization validates media type, size, duration and current Creator Info", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /video\/mp4/);
  assert.match(source, /video\/quicktime/);
  assert.match(source, /video\/webm/);
  assert.match(source, /4 \* 1024 \*\* 3/);
  assert.match(source, /duration|videoDuration/);
  assert.match(source, /max_video_post_duration_sec/);
  assert.match(source, /privacy_level_options/);
  assert.match(source, /comment_disabled/);
  assert.match(source, /duet_disabled/);
  assert.match(source, /stitch_disabled/);
  assert.match(source, /brand_content_toggle/);
  assert.match(source, /brand_organic_toggle/);
  assert.match(source, /totalChunkCount\s*=\s*Math\.max\(1, Math\.floor\(size \/ chunkSize\)\)/);
});

test("safe TikTok reads and status polling use bounded exponential backoff without retrying publish init blindly", () => {
  const source = read("utils/tiktokCreatorManager.js");
  assert.match(source, /backoff|retry/i);
  assert.match(source, /jitter|Math\.random|crypto\.randomInt/i);
  assert.match(source, /AbortSignal\.timeout/);
  assert.match(source, /status\/fetch/);
  assert.doesNotMatch(source, /retry[^\n]{0,120}(?:inbox\/video\/init|publish\/video\/init)/i);
});

test("webhook verification checks timestamped HMAC, rejects replay and deduplicates events", () => {
  const managerSource = read("utils/tiktokCreatorManager.js");
  const securitySource = read("utils/tiktokSecurity.js");
  const summarySource = read("api/platform/summary.js");
  assert.match(summarySource, /req\.rawBody/);
  assert.match(securitySource, /TIKTOK_CLIENT_SECRET|TIKTOK_WEBHOOK_SECRET/);
  assert.match(managerSource, /TikTok-Signature|tiktok-signature/i);
  assert.match(securitySource, /timingSafeEqual/);
  assert.match(securitySource, /createHmac\("sha256"/);
  assert.match(securitySource, /timestamp|parsed\.t/i);
  assert.match(securitySource, /5 \* 60|300/);
  assert.match(managerSource, /webhook/i);
  assert.match(managerSource, /publish_id/);
  assert.match(managerSource, /upsert|findOneAndUpdate|updateOne/i);
  assert.match(managerSource, /eventHash|eventId|idempot/i);
});

test("webhook HMAC binds the raw payload to the signing key and rejects expired or altered messages", () => {
  const previousClient = process.env.TIKTOK_CLIENT_SECRET;
  const previousWebhook = process.env.TIKTOK_WEBHOOK_SECRET;
  process.env.TIKTOK_CLIENT_SECRET = "client-secret-used-only-for-fallback-tests";
  process.env.TIKTOK_WEBHOOK_SECRET = "dedicated-webhook-signing-secret";
  try {
    const raw = Buffer.from('{"event":"post.publish.complete","content":"{\\"publish_id\\":\\"p1\\"}"}');
    const timestamp = 1786500000;
    const signature = crypto.createHmac("sha256", process.env.TIKTOK_WEBHOOK_SECRET).update(String(timestamp)).update(".").update(raw).digest("hex");
    assert.equal(security.verifyWebhookSignature(raw, `t=${timestamp},s=${signature}`, timestamp * 1000).valid, true);
    assert.equal(security.verifyWebhookSignature(Buffer.from(`${raw}x`), `t=${timestamp},s=${signature}`, timestamp * 1000).valid, false);
    assert.equal(security.verifyWebhookSignature(raw, `t=${timestamp},s=${signature}`, (timestamp + 301) * 1000).reason, "expired");
  } finally {
    if (previousClient === undefined) delete process.env.TIKTOK_CLIENT_SECRET; else process.env.TIKTOK_CLIENT_SECRET = previousClient;
    if (previousWebhook === undefined) delete process.env.TIKTOK_WEBHOOK_SECRET; else process.env.TIKTOK_WEBHOOK_SECRET = previousWebhook;
  }
});

test("manager test helpers are pure and keep untrusted navigation and scopes allowlisted", () => {
  assert.deepEqual(Array.from(manager.__test.BASE_SCOPES), ["user.info.basic"]);
  assert.deepEqual(Array.from(manager.__test.requiredScopes(["video.list", "unknown.scope"])), ["user.info.basic", "video.list"]);
  assert.equal(manager.__test.safeHash("#/davinci-resolve/tiktok?tab=publish"), "#/davinci-resolve/tiktok?tab=publish");
  assert.equal(manager.__test.safeHash("https://evil.example/steal"), "#/davinci-resolve/tiktok");
  assert.equal(manager.__test.safeHash("#/admin"), "#/davinci-resolve/tiktok");
  const previousRedirect = process.env.TIKTOK_REDIRECT_URI;
  process.env.TIKTOK_REDIRECT_URI = "https://evil.example/api/tiktok/oauth/callback";
  assert.equal(manager.__test.callbackUrl(), "https://hoang8.com/api/tiktok/oauth/callback");
  if (previousRedirect === undefined) delete process.env.TIKTOK_REDIRECT_URI; else process.env.TIKTOK_REDIRECT_URI = previousRedirect;
  const randomA = crypto.randomBytes(32).toString("hex");
  const randomB = crypto.randomBytes(32).toString("hex");
  assert.notEqual(randomA, randomB);
});
