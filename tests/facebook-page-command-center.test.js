const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Facebook Page Command Center is reachable from Tool and lazy-loaded", () => {
  const shell = read("script.js");
  const loader = read("performance-loader.js");
  assert.match(shell, /id:\s*"facebook"[\s\S]{0,240}route:\s*"\/davinci-resolve\/facebook"/);
  assert.match(shell, /HHFacebookPageCommandCenter\?\.mount/);
  assert.match(shell, /hh:facebook-page-command-center-ready/);
  assert.match(loader, /facebook-page-command-center\.css\?v=1/);
  assert.match(loader, /facebook-page-command-center\.js\?v=2/);
});

test("Meta backend is routed, owner-isolated and stores encrypted Page tokens", () => {
  const vercel = read("vercel.json");
  const api = read("utils/facebookPageManager.js");
  const security = read("utils/facebookSecurity.js");
  assert.match(vercel, /\/api\/facebook\/:facebookAction\*/);
  assert.match(api, /facebookPageConnections/);
  assert.match(api, /\{\s*userId,\s*pageId:/);
  assert.match(api, /encryptToken\(page\.access_token/);
  assert.match(api, /decryptToken\(record\.accessToken/);
  assert.match(security, /aes-256-gcm/);
  assert.match(security, /setAAD\(context\(connection\)\)/);
  assert.doesNotMatch(read("facebook-page-command-center.js"), /META_APP_SECRET\s*=|META_TOKEN_ENCRYPTION_KEY\s*=/);
});

test("Bulk Page creation is represented honestly as a setup workflow", () => {
  const client = read("facebook-page-command-center.js");
  const api = require(path.join(root, "utils/facebookPageManager.js"));
  assert.equal(api.__test.MAX_SETUP_IMPORT, 500);
  assert.equal(api.__test.MAX_BATCH_PUBLISH, 20);
  assert.match(client, /Meta không cung cấp endpoint tạo Facebook Page mới/);
  assert.match(client, /Batch Page Setup/);
  assert.match(client, /setups\/import/);
  assert.doesNotMatch(client, /autoCreatePage|create_page|captchaSolver/i);
});

test("Meta permissions cover real Page management without requesting messaging by default", () => {
  const api = require(path.join(root, "utils/facebookPageManager.js"));
  for (const permission of ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_engagement", "read_insights"]) {
    assert.ok(api.__test.PERMISSIONS.includes(permission));
  }
  assert.ok(!api.__test.PERMISSIONS.includes("pages_messaging"));
});

test("one-page workspace and mobile layout avoid horizontal overflow", () => {
  const css = read("facebook-page-command-center.css");
  assert.match(css, /height:\s*min\(100%,\s*calc\(100vh - 132px\)\)/);
  assert.match(css, /grid-template-columns:\s*232px minmax\(0, 1fr\) 286px/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /overflow-x:\s*auto/);
});

test("Text on Image keeps export controls visible and includes gentle fonts", () => {
  const client = read("image-text-studio.js");
  const css = read("image-text-studio.css");
  for (const font of ["EB Garamond", "Spectral", "Fraunces", "Prata", "Marcellus", "Italiana", "Josefin Sans", "Quicksand", "Manrope"]) assert.match(client, new RegExp(font));
  assert.match(css, /\.its-exportbar\{position:relative;z-index:8/);
  assert.match(css, /overflow-x:auto;overflow-y:hidden/);
  assert.match(css, /@media\(max-height:760px\)/);
});

test("campaign workflow, Page groups and per-Page overrides are real backend capabilities", () => {
  const apiSource = read("utils/facebookPageManager.js");
  const client = read("facebook-page-command-center.js");
  const api = require(path.join(root, "utils/facebookPageManager.js"));
  const draft = api.__test.campaignDoc({ name: "August", pageIds: ["1", "2"], message: "Hello", status: "review", overrides: [{ pageId: "2", message: "Hello Page 2" }] }, "owner");
  assert.equal(draft.status, "review");
  assert.equal(draft.overrides.length, 1);
  assert.match(apiSource, /FACEBOOK_CAMPAIGN_NOT_APPROVED/);
  assert.match(apiSource, /campaigns\/stage/);
  assert.match(apiSource, /groups\/save/);
  assert.match(apiSource, /automations\/save/);
  assert.match(client, /Campaign & Approval Center/);
  assert.match(client, /Chỉnh riêng từng Page/);
  assert.match(client, /Automation & Webhook Center/);
});

test("Meta webhook verifies raw-body signatures before storing bounded events", () => {
  const webhook = require(path.join(root, "utils/metaWebhook.js"));
  const crypto = require("node:crypto");
  const previous = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "test-secret-for-signature-contract";
  try {
    const body = Buffer.from(JSON.stringify({ object: "page", entry: [] }));
    const signature = `sha256=${crypto.createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex")}`;
    assert.equal(webhook.__test.validSignature(body, signature), true);
    assert.equal(webhook.__test.validSignature(body, "sha256=bad"), false);
    assert.equal(webhook.config.api.bodyParser, false);
    assert.equal(webhook.__test.MAX_BODY, 1024 * 1024);
  } finally {
    if (previous === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previous;
  }
  const source = read("utils/metaWebhook.js");
  assert.match(source, /x-hub-signature-256/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /expireAfterSeconds/);
  assert.doesNotMatch(source, /access_token|pageAccessToken/);
});
