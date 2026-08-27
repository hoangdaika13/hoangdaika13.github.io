const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function browserContext(ownerId = "owner-a") {
  const storage = new Map();
  const window = {
    HHAuthz: { currentUser: () => ({ id: ownerId }) },
    HHAuthSession: { token: () => "" },
    location: {
      origin: "https://hoang8.com",
      pathname: "/",
      search: "",
      hash: "#/davinci-resolve/tiktok",
      assign() {}
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    dispatchEvent() {},
    addEventListener() {},
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" }
  };
  const context = {
    window,
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
    Blob,
    URL,
    Intl,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new Error("Network access is forbidden in this test"); }
  };
  return { context, window, storage };
}

function loadClientModules(ownerId = "owner-a") {
  const runtime = browserContext(ownerId);
  for (const file of [
    "services/tiktokCreatorCore.js",
    "services/tiktokCreatorConnections.js",
    "services/tiktokCreatorPublishing.js",
    "services/tiktokCreatorAnalytics.js"
  ]) vm.runInNewContext(read(file), runtime.context, { filename: file });
  return runtime;
}

function loadPublishingWithFetch(fetchImpl) {
  const calls = [];
  const window = {
    HHTikTokCreatorConnections: { request: async (path, options) => { calls.push({ path, options }); return {}; } },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    setTimeout,
    clearTimeout
  };
  const context = {
    window,
    Blob,
    DOMException,
    Date,
    Math,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(read("services/tiktokCreatorPublishing.js"), context, { filename: "services/tiktokCreatorPublishing.js" });
  return { publishing: window.HHTikTokCreatorPublishing, calls };
}

test("TikTok Creator Galaxy is reachable as one routed tool using the existing API function", () => {
  const shell = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const rewrites = read("vercel.json");
  const summary = read("api/platform/summary.js");

  assert.match(shell, /id:\s*"tiktok"[\s\S]{0,260}route:\s*"\/davinci-resolve\/tiktok"/);
  assert.match(shell, /resolveView === "tiktok"[\s\S]{0,100}HHTikTokCreatorGalaxy\?\.mount/);
  for (const asset of [
    "tiktok-creator-galaxy.css",
    "services/tiktokCreatorCore.js",
    "services/tiktokCreatorConnections.js",
    "services/tiktokCreatorPublishing.js",
    "services/tiktokCreatorAnalytics.js",
    "tiktok-creator-galaxy.js"
  ]) {
    assert.match(loader, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(rewrites, /"source":\s*"\/api\/tiktok\/:tiktokAction\*"[\s\S]{0,180}"destination":\s*"\/api\/platform\/summary\?tiktokCreatorManager=1&tiktokAction=:tiktokAction"/);
  assert.match(summary, /require\("\.\.\/\.\.\/utils\/tiktokCreatorManager"\)/);
  assert.match(summary, /tiktokCreatorManagerHandler\(req, res\)/);
  assert.equal(fs.existsSync(path.join(root, "api", "tiktok.js")), false, "TikTok must not consume a separate Vercel function");
  assert.equal(fs.existsSync(path.join(root, "api", "tiktok")), false, "TikTok must stay behind api/platform/summary.js");
});

test("the product map contains exactly eighteen workspaces grouped into six hubs", () => {
  const { window } = loadClientModules();
  const core = window.HHTikTokCreatorCore;
  assert.equal(core.HUBS.length, 6);
  assert.equal(core.WORKSPACES.length, 18);
  assert.deepEqual(Array.from(core.HUBS, (item) => item.id), ["discover", "create", "publish", "engage", "commerce", "platform"]);
  assert.deepEqual(Array.from(core.WORKSPACES, (item) => item.id), [
    "trends", "seo", "analytics", "competitors", "video", "ai-video", "script", "voice", "scheduler",
    "community", "shop", "affiliate", "products", "live", "ads", "influencers", "developer", "media"
  ]);
  assert.ok(core.WORKSPACES.every((item) => core.HUBS.some((hub) => hub.id === item.hub)));
  assert.ok(core.WORKSPACES.every((item) => Object.hasOwn(core.STATUS, item.status)));
});

test("local drafts are owner-scoped and never leak into another HH profile", () => {
  const { window, storage } = loadClientModules("owner-a");
  const core = window.HHTikTokCreatorCore;
  const stateA = core.defaultState();
  stateA.workspace = "script";
  stateA.scripts.push({ id: "private-script-a" });
  core.saveState(stateA);

  assert.match(core.storageKey(), /^hh\.tiktok-creator-galaxy\.v\d+:owner-a$/);
  window.HHAuthz.currentUser = () => ({ id: "owner-b" });
  const stateB = core.loadState();
  assert.equal(stateB.ownerId, "owner-b");
  assert.equal(stateB.workspace, "trends");
  assert.equal(stateB.scripts.length, 0);
  assert.equal(storage.has(core.storageKey("owner-a")), true);
  assert.notEqual(core.storageKey("owner-a"), core.storageKey("owner-b"));
});

test("local research, SEO, scripts, subtitles and analytics are deterministic and explain their source", () => {
  const { window } = loadClientModules();
  const core = window.HHTikTokCreatorCore;
  const analytics = window.HHTikTokCreatorAnalytics;
  const rows = core.parseImport("name,views,previous_views,posts,relevance\nMua he,2500,1000,40,90", "trend.csv");
  const ranked = analytics.analyzeTrends(rows);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].source, "user-import");
  assert.ok(ranked[0].score >= 0 && ranked[0].score <= 100);

  const brief = core.buildSeoBrief("cach lam video", "nguoi moi");
  assert.ok(Array.isArray(brief.longTail));
  assert.match(brief.note, /c.{0,4}c b.{0,4}|local|TikTok/i);
  const script = core.buildScript({ topic: "meo quay video", duration: 30 });
  assert.equal(script.source, "local-deterministic");
  assert.equal(script.aigc, true);

  const cues = core.parseSubtitles("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nXin chao\n\n00:00:02.000 --> 00:00:04.000\nHH Platform");
  assert.equal(cues.length, 2);
  assert.match(core.subtitlesToSrt(cues), /00:00:00,000 --> 00:00:02,000/);
  assert.match(core.subtitlesToVtt(cues), /^WEBVTT/);
});

test("publisher defaults are conservative and require preview, privacy, music rights and final consent", () => {
  const { window } = loadClientModules();
  const publishing = window.HHTikTokCreatorPublishing;
  assert.ok(publishing.PRIVACY_LEVELS.some((item) => item.id === "SELF_ONLY"));

  const base = {
    connectionId: "connection-a",
    mode: "direct",
    privacyLevel: "SELF_ONLY",
    previewed: true,
    musicConfirmed: true,
    confirmed: true,
    commentEnabled: false,
    duetEnabled: false,
    stitchEnabled: false,
    aigc: true
  };
  assert.deepEqual(Array.from(publishing.validate(base, { audited: false })), []);
  assert.ok(publishing.validate({ ...base, privacyLevel: "" }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, previewed: false }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, musicConfirmed: false }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, confirmed: false }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, privacyLevel: "PUBLIC_TO_EVERYONE" }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, commercialContent: true }, { audited: false }).length > 0);
  assert.ok(publishing.validate({ ...base, commercialContent: true, brandedContent: true }, { audited: true }).some((error) => /tài trợ|Chỉ mình/i.test(error)));
});

test("scheduler and Direct Post UI do not silently publish or choose privacy for the user", () => {
  const client = read("tiktok-creator-galaxy.js");
  const publishing = read("services/tiktokCreatorPublishing.js");
  const server = read("utils/tiktokCreatorManager.js");

  assert.match(client, /L.{0,4}ch n.{0,4}i b.{0,4}|Lịch nội bộ/iu);
  assert.match(client, /kh.{0,4}ng ph.{0,4}i TikTok Scheduling API|không phải TikTok Scheduling API/iu);
  assert.match(client, /name="privacyLevel"[\s\S]{0,260}<option value="">/);
  assert.doesNotMatch(client, /name="privacyLevel"[\s\S]{0,260}<option value="" selected/);
  for (const field of ["commentEnabled", "duetEnabled", "stitchEnabled"]) {
    const element = new RegExp(`type="checkbox" name="${field}"(?![^>]*checked)[^>]*>`);
    assert.match(client, element);
  }
  for (const field of ["previewed", "musicConfirmed", "confirmed"]) assert.match(client, new RegExp(`name="${field}"[^>]*required`));
  assert.match(client, /name="aigc"/);
  for (const field of ["commercialContent", "ownBrand", "brandedContent", "brandedPolicyConfirmed"]) assert.match(client, new RegExp(`name="${field}"`));
  assert.match(client, /Music Usage Confirmation/);
  assert.match(client, /Branded Content Policy/);
  assert.match(server, /is_aigc:\s*job\.payload\.aigc === true/);
  assert.match(server, /scheduled-internal/);
  assert.doesNotMatch(publishing, /setInterval\([^)]*publish|auto.?publish/i);
});

test("real Content Posting flow exposes Creator Info, upload initialization, progress and status polling", () => {
  const client = read("tiktok-creator-galaxy.js");
  const publishing = read("services/tiktokCreatorPublishing.js");
  const server = read("utils/tiktokCreatorManager.js");
  for (const capability of ["creatorInfo", "initialize", "upload", "status"]) {
    assert.match(publishing, new RegExp(capability, "i"));
  }
  assert.match(publishing, /Content-Range/);
  assert.match(publishing, /file\.slice|\.slice\(start/);
  assert.doesNotMatch(publishing, /["']Content-Length["']/i, "Browsers must calculate Content-Length for Blob uploads");
  assert.match(publishing, /mimeType:\s*file\.type/);
  assert.match(publishing, /durationSeconds:\s*Number\(durationSeconds/);
  assert.match(client, /data-media="publish"|data-publish-video|accept="video\//);
  assert.match(client, /privacy_level_options|max_video_post_duration_sec|creatorInfo/);
  assert.match(client, /upload.{0,20}progress|progress.{0,20}upload|Ti.{0,4}n tr.{0,4}nh/iu);
  assert.match(client, /duration:\s*Number\(publishMedia\?\.duration/);
  assert.match(server, /\/v2\/post\/publish\/creator_info\/query\//);
  assert.match(server, /\/v2\/post\/publish\/inbox\/video\/init\//);
  assert.match(server, /\/v2\/post\/publish\/video\/init\//);
  assert.match(server, /\/v2\/post\/publish\/status\/fetch\//);
  assert.match(server, /Math\.floor\(size \/ chunkSize\)/);
});

test("chunk uploader makes the last declared chunk consume every trailing byte", () => {
  const publishing = read("services/tiktokCreatorPublishing.js");
  assert.match(publishing, /index === declaredCount - 1 \? total/);
  assert.match(publishing, /uploaded !== total/);
  assert.match(publishing, /uploaded \/ total/);
  assert.match(publishing, /Content-Range/);
});

test("chunk upload behavior sends exactly the declared chunks and merges the remainder into the last one", async () => {
  const requests = [];
  const { publishing } = loadPublishingWithFetch(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200 };
  });
  const file = new Blob([Buffer.alloc(25)], { type: "video/mp4" });
  await publishing.upload(file, {
    uploadUrl: "https://open-upload.tiktokapis.com/video/abc",
    chunkSize: 10,
    totalChunkCount: 2,
    publishId: "publish-a"
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.body.size, 10);
  assert.equal(requests[1].options.body.size, 15);
  assert.equal(requests[0].options.headers["Content-Range"], "bytes 0-9/25");
  assert.equal(requests[1].options.headers["Content-Range"], "bytes 10-24/25");
  assert.equal(Object.hasOwn(requests[0].options.headers, "Content-Length"), false);
});

test("all unavailable capabilities have honest provider gates rather than fabricated controls", () => {
  const core = read("services/tiktokCreatorCore.js");
  const client = read("tiktok-creator-galaxy.js");
  for (const status of ["connection", "consent", "audit", "private", "business", "shop", "unsupported"]) {
    assert.match(core, new RegExp(`${status}:\\s*\\{`));
  }
  assert.match(client, /TikTok for Business/);
  assert.match(client, /Shop Partner/);
  assert.match(client, /Ch.{0,4}a c.{0,4}u h.{0,4}nh|Chưa cấu hình/iu);
  assert.match(client, /Kh.{0,4}ng scrape TikTok|Không scrape TikTok/iu);
  assert.match(client, /Kh.{0,4}ng cung c.{0,4}p TikTok downloader|Không cung cấp TikTok downloader/iu);
  assert.match(client, /x.{0,4}a watermark|xóa watermark/iu);

  const forbiddenActions = /data-action="[^"]*(?:scrape|cookie|captcha|follower-bot|view-bot|bulk-dm|bulk-comment|download-tiktok|remove-watermark)[^"]*"/i;
  assert.doesNotMatch(client, forbiddenActions);
  assert.doesNotMatch(client, /document\.cookie|puppeteer|playwright|selenium/i);
});

test("client bundles contain no TikTok app secrets or provider tokens", () => {
  const clients = [
    "tiktok-creator-galaxy.js",
    "services/tiktokCreatorCore.js",
    "services/tiktokCreatorConnections.js",
    "services/tiktokCreatorPublishing.js",
    "services/tiktokCreatorAnalytics.js"
  ].map(read).join("\n");
  assert.doesNotMatch(clients, /TIKTOK_CLIENT_SECRET\s*=|TIKTOK_TOKEN_ENCRYPTION_KEY\s*=|TIKTOK_WEBHOOK_SECRET\s*=/);
  assert.doesNotMatch(clients, /client_secret\s*:/);
  assert.doesNotMatch(clients, /encryptedAccessToken|encryptedRefreshToken/);
  assert.doesNotMatch(clients, /access_token|refresh_token/);
});

test("service worker bypasses API and authorized requests instead of caching private TikTok data", () => {
  const worker = read("sw.js");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /request\.headers\.has\("authorization"\)/i);
  assert.match(worker, /if \(url\.origin !== self\.location\.origin \|\| isPrivateRequest \|\| bypassShellCache\)[\s\S]{0,160}fetch\(request\)/);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*(?:\/api\/|isPrivateRequest)/);
});

test("375x812 mobile layout is bounded, keyboard-visible and motion-safe", () => {
  const css = read("tiktok-creator-galaxy.css");
  assert.match(css, /@media\s*\(max-width:\s*(?:640|600|390)px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /overflow-x:\s*(?:auto|hidden)/);
  assert.match(css, /max-width:\s*390px/);
});
