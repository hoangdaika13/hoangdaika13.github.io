const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const security = require(path.join(root, "utils/facebookSecurity.js"));
const manager = require(path.join(root, "utils/facebookPageManager.js"));

test("Meta token vault binds ciphertext to exactly one HH owner and Page", () => {
  const previous = process.env.META_TOKEN_ENCRYPTION_KEY;
  const previousKeys = process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  process.env.META_TOKEN_ENCRYPTION_KEY = "facebook-test-current-key-32-characters-minimum";
  delete process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  try {
    const owner = { userId: "owner-a", pageId: "page-a" };
    const encrypted = security.encryptToken("page-access-token-secret", owner);
    assert.equal(security.isBoundToken(encrypted), true);
    assert.equal(encrypted.includes("page-access-token-secret"), false);
    assert.equal(security.decryptToken(encrypted, owner), "page-access-token-secret");
    assert.throws(() => security.decryptToken(encrypted, { userId: "owner-b", pageId: "page-a" }), /không thuộc|hỏng/i);
    assert.throws(() => security.decryptToken(encrypted, { userId: "owner-a", pageId: "page-b" }), /không thuộc|hỏng/i);
  } finally {
    if (previous === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
    else process.env.META_TOKEN_ENCRYPTION_KEY = previous;
    if (previousKeys === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    else process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS = previousKeys;
  }
});

test("Meta token vault supports controlled key rotation without weakening ownership binding", () => {
  const previous = process.env.META_TOKEN_ENCRYPTION_KEY;
  const previousKeys = process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  const owner = { userId: "owner-a", pageId: "page-a" };
  try {
    process.env.META_TOKEN_ENCRYPTION_KEY = "facebook-old-key-32-characters-for-rotation";
    delete process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    const encrypted = security.encryptToken("rotating-token", owner);
    process.env.META_TOKEN_ENCRYPTION_KEY = "facebook-new-key-32-characters-for-rotation";
    process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS = "facebook-old-key-32-characters-for-rotation";
    assert.equal(security.decryptToken(encrypted, owner), "rotating-token");
  } finally {
    if (previous === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
    else process.env.META_TOKEN_ENCRYPTION_KEY = previous;
    if (previousKeys === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    else process.env.META_TOKEN_ENCRYPTION_KEY_PREVIOUS = previousKeys;
  }
});

test("public Facebook payloads omit owner identity, encrypted tokens and Meta identity hashes", () => {
  const page = security.publicPage({ userId: "owner-a", pageId: "page-a", pageName: "Page A", accessToken: "secret", metaIdentityHash: "hash" });
  assert.equal(page.id, "page-a");
  assert.equal(Object.hasOwn(page, "userId"), false);
  assert.equal(Object.hasOwn(page, "accessToken"), false);
  assert.equal(Object.hasOwn(page, "metaIdentityHash"), false);
  const job = manager.__test.publicJob({ _id: "job-a", userId: "owner-a", campaignId: "campaign-a", status: "completed", total: 1, completed: 1 });
  assert.equal(Object.hasOwn(job, "userId"), false);
  assert.equal(Object.hasOwn(job, "campaignId"), false);
});

test("OAuth state is atomically consumed and secrets are exchanged in a POST body", () => {
  const source = read("utils/facebookPageManager.js");
  assert.match(source, /findOneAndDelete\(\{ stateHash, expiresAt:/);
  assert.match(source, /method:\s*"POST"[\s\S]{0,240}application\/x-www-form-urlencoded/);
  assert.doesNotMatch(source, /tokenUrl\.search/);
  assert.match(source, /META_TOKEN_ENCRYPTION_KEY/);
  assert.match(source, /FACEBOOK_PAGE_OWNERSHIP_REQUIRED/);
  assert.match(source, /url\.hostname\.toLowerCase\(\) !== "graph\.facebook\.com"/);
});

test("Facebook browser drafts and selected Page ids are owner-scoped", () => {
  const client = read("facebook-page-command-center.js");
  assert.match(client, /function currentIdentityId\(\)/);
  assert.match(client, /`\$\{STORAGE_KEY\}:\$\{currentIdentityId\(\)\}`/);
  assert.match(client, /saved\?\.ownerId === base\.ownerId/);
  assert.match(client, /ACCOUNT SECURITY/);
  assert.doesNotMatch(client, /META_APP_SECRET\s*=|META_TOKEN_ENCRYPTION_KEY\s*=/);
});
