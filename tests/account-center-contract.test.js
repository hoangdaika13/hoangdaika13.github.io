const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const accountApi = require("../utils/account-center-api").__test;

test("Account Center is a dedicated server-backed workspace", () => {
  const client = read("account-center.js");
  const loader = read("performance-loader.js");
  const router = read("script.js");
  assert.match(loader, /account-center\.css\?v=1/);
  assert.match(loader, /account-center\.js\?v=1/);
  assert.match(router, /HHAccountCenter\?\.mount/);
  assert.match(client, /\/api\/social\?view=profile/);
  assert.match(client, /profile:update/);
  assert.match(client, /privacy:update/);
  assert.doesNotMatch(client, /hh-user-dashboard/);
  assert.doesNotMatch(client, /state\.xp|\+\s*10/);
});

test("Security score uses explicit evidence and unknown states", async () => {
  const now = new Date();
  const auth = {
    user: {
      passwordHash: "hash",
      emailVerifiedAt: now,
      passwordSafety: { status: "unknown" },
      securityActivityReviewedAt: null,
      provider: "local"
    }
  };
  const score = await accountApi.securityScore(null, auth, [{ current: true, createdAt: now, suspicious: false }], [], { remaining: 0 }, []);
  assert.equal(score.state, "available");
  assert.equal(typeof score.value, "number");
  const password = score.checks.find((item) => item.id === "password-breach");
  assert.equal(password.status, "unknown");
  assert.equal(password.earned, 0);
  assert.ok(score.checks.every((item) => Number.isFinite(item.weight)));
});

test("Step-up expires and cannot silently fall back", () => {
  assert.equal(accountApi.recentAuthentication({ session: { createdAt: new Date() } }).valid, true);
  assert.equal(accountApi.recentAuthentication({ session: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } }).valid, false);
  assert.throws(
    () => accountApi.requireStepUp({ session: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } }),
    (error) => error.code === "STEP_UP_REQUIRED" && error.statusCode === 428
  );
});

test("Profile media validates MIME signature and size", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
  const accepted = accountApi.decodeImage({ mimeType: "image/jpeg", data: jpeg.toString("base64") });
  assert.equal(accepted.mimeType, "image/jpeg");
  assert.throws(
    () => accountApi.decodeImage({ mimeType: "image/png", data: jpeg.toString("base64") }),
    (error) => error.code === "IMAGE_SIGNATURE_INVALID"
  );
  assert.throws(
    () => accountApi.decodeImage({ mimeType: "image/svg+xml", data: Buffer.from("<svg/>").toString("base64") }),
    (error) => error.code === "IMAGE_TYPE_UNSUPPORTED"
  );
});

test("Recovery codes and private factors are never returned from storage", () => {
  const server = read("utils/account-center-api.js");
  const authServer = read("api/auth/[...action].js");
  const authClient = read("auth-platform.js");
  assert.match(server, /codeHash:\s*hmacHash/);
  assert.match(server, /project\(\{\s*codeHash:\s*0\s*\}\)/);
  assert.match(server, /project\(\{\s*publicKey:\s*0/);
  assert.match(server, /passwordHash:\s*undefined/);
  assert.match(server, /LAST_RECOVERY_METHOD/);
  assert.match(authServer, /recovery-code\/login/);
  assert.match(authServer, /findOneAndUpdate\([\s\S]*codeHash[\s\S]*usedAt:\s*null/);
  assert.match(authClient, /recoveryCodeLogin/);
  assert.match(authClient, /HH-\[A-F0-9\]/);
});

test("Revoked bearer sessions are rejected across APIs", () => {
  const platform = read("utils/platform.js");
  const auth = read("utils/auth-security.js");
  assert.match(platform, /tokenHash:\s*createHash\("sha256"\)\.update\(token\)/);
  assert.match(platform, /if \(!session\) return null/);
  assert.match(auth, /if \(!session\) return null/);
  assert.match(auth, /revokeReason:\s*"idle-timeout"/);
  assert.match(auth, /idleExpiresAt/);
  assert.match(auth, /newDevice:/);
  assert.match(read("utils/account-center-api.js"), /session:trust/);
});

test("Profile privacy is enforced for individual public fields", () => {
  const social = read("api/social.js");
  for (const field of ["bio", "city", "hometown", "workplace", "school", "website", "socialLinks", "interests", "languages"]) {
    assert.match(social, new RegExp(`${field}Visibility`));
  }
  assert.match(social, /fieldVisible\("city"/);
  assert.match(social, /fieldVisible\("socialLinks"/);
});

test("Account Center remains usable at 375px and respects reduced motion", () => {
  const css = read("account-center.css");
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.ac-nav \{[\s\S]*position:\s*fixed/);
});
