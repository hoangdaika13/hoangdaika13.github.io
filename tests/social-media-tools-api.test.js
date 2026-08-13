"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const handler = require("../utils/social-media-handler.js");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("public account and job serializers do not expose OAuth secrets", () => {
  const source = { _id:"x", provider:"facebook", accessToken:"secret", refreshToken:"secret2", tokenCiphertext:"cipher", displayName:"Page", status:"connected" };
  const output = handler.__test.publicAccount(source); assert.equal(output.accessToken, undefined); assert.equal(output.refreshToken, undefined); assert.equal(output.tokenCiphertext, undefined);
  assert.equal(handler.__test.publicJob({ _id:"j", state:"failed", reason:"closed" }).reason, "closed");
});

test("queue transitions, idempotency and webhook signatures are deterministic", () => {
  assert.equal(handler.__test.transition("scheduled", "pause"), "approved"); assert.equal(handler.__test.transition("failed", "retry"), "retry-scheduled"); assert.equal(handler.__test.transition("published", "retry"), "");
  const crypto = require("node:crypto"), payload="1.{\"eventId\":\"e\"}", secret="test-secret", signature=crypto.createHmac("sha256",secret).update(payload).digest("hex");
  assert.equal(handler.__test.validSignature(payload,signature,secret),true); assert.equal(handler.__test.validSignature(payload,"0".repeat(64),secret),false);
  assert.equal(handler.__test.hash("same"),handler.__test.hash("same"));
});

test("API is owner/workspace scoped, rate limited and fail-closed", () => {
  const source=read("utils/social-media-handler.js");
  assert.match(source,/ownerId: user\._id, workspaceId/); assert.match(source,/enforceRateLimit/); assert.match(source,/SOCIAL_WEBHOOK_NOT_CONFIGURED/); assert.match(source,/provider-api-not-connected/); assert.match(source,/duplicatePrevented/);
  assert.doesNotMatch(source,/instagram\.com\/[^\s]+fetch|cookie\s*:/i);
});

test("single dynamic Vercel function routes all Social Media resources", () => {
  const vercel=JSON.parse(read("vercel.json")); const functions=Object.keys(vercel.functions); assert.ok(functions.length<=12); assert.deepEqual(functions,["api/**/*.js"]);
  assert.ok(vercel.rewrites.some((item)=>item.source==="/api/social-media/:resource")); assert.ok(vercel.rewrites.some((item)=>item.source==="/api/social-media/webhooks/:provider"));
  assert.match(read("api/modules/[moduleId]/actions.js"),/handleSocialMedia/);
});

test("route, lazy loader, service worker and UI behavior are integrated", () => {
  const script=read("script.js"), loader=read("performance-loader.js"), sw=read("sw.js"), ui=read("social-media-tools.js"), css=read("social-media-tools.css");
  const uiV2=read("social-media-tools-v2.js"), cssV2=read("social-media-tools-v2.css");
  assert.match(script,/route: "\/social-media-tools"/); assert.match(script,/HHSocialMediaTools\.mount/); assert.match(loader,/social-media-tools-core\.js\?v=2/); assert.match(sw,/social-media-tools-v2\.js\?v=1/);
  assert.match(ui,/BẢN MÔ PHỎNG/); assert.match(ui,/data-smt-job-action/); assert.match(ui,/JSZip/); assert.match(ui,/sanitizedAsset/); assert.match(ui,/oembed/); assert.match(ui,/provider-worker-required|Xuất thủ công/);
  assert.match(css,/@media\(max-width:700px\)/); assert.match(css,/focus-visible/); assert.match(css,/prefers-reduced-motion/);
  assert.match(uiV2,/data-smt2-group/); assert.match(uiV2,/data-smt2-favorite/); assert.match(uiV2,/settingsMarkup/); assert.match(uiV2,/startOAuth/); assert.match(uiV2,/hh\.social\.oauth\.pending/); assert.match(uiV2,/BẢN MÔ PHỎNG/);
  assert.match(uiV2,/groupForTool/);
  assert.match(cssV2,/\.smt2-tool-list/); assert.match(cssV2,/@media\(max-width:720px\)/); assert.match(cssV2,/focus-visible/); assert.match(cssV2,/prefers-reduced-motion/);
});

test("provider connections reuse the real encrypted owner-scoped vaults", () => {
  const backend=read("utils/social-media-handler.js"), facebook=read("utils/facebookPageManager.js");
  assert.match(backend,/facebookPageConnections/); assert.match(backend,/tiktokConnections/); assert.match(backend,/youtubeConnections/);
  assert.match(backend,/projection = \{ accessToken: 0, refreshToken: 0/); assert.match(backend,/autoSynced: true/); assert.match(backend,/providers/);
  assert.doesNotMatch(backend,/facebookConnections|tiktokCreatorConnections/);
  assert.match(facebook,/instagram_business_account/); assert.match(facebook,/instagram_content_publish/); assert.match(facebook,/instagram_manage_comments/);
  assert.match(facebook,/social-media-tools/); assert.match(read("utils/tiktokCreatorManager.js"),/social-media-tools/); assert.match(read("utils/youtubePublisher.js"),/social-media-tools/);
});
