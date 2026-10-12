"use strict";
// Full workspace UI with explicit API/media doubles; never invokes paid providers.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const repo = path.resolve(__dirname, ".."), output = path.join(repo, ".study-local/chat-ai-media-qa");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVOUAAAAASUVORK5CYII=", "base64");
const imageId = "64b64b64b64b64b64b64b641", videoId = "64b64b64b64b64b64b64b642", quoteId = "64b64b64b64b64b64b64b643";
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname), file = path.resolve(repo, "." + name);
  if (!file.startsWith(repo + path.sep) || name.split("/").some((part) => part.startsWith(".") || ["api", "utils", "node_modules"].includes(part))) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader("Content-Type", ({ ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" })[path.extname(file)] || "application/octet-stream"); fs.createReadStream(file).pipe(res);
});
async function main() {
  fs.mkdirSync(output, { recursive: true }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, results = [], errors = [], calls = [];
  let browser, mediaEnabled = true, videoCompleted = false, imageFailure = false;
  const pass = (name) => { results.push(name); console.log(`PASS ${name}`); };
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
    const ctx = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await ctx.route("**/api/**", async (route) => {
      const request = route.request(), url = new URL(request.url()), body = request.method() === "POST" ? request.postDataJSON() : {};
      calls.push({ pathname: url.pathname, query: url.search, body });
      const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname === "/api/ai-video-remake") {
        const action = url.searchParams.get("action") || body.action;
        if (action === "capabilities") return json({ capabilities: { modes: { "text-to-video": { supported: mediaEnabled } }, billing: { canCreate: mediaEnabled, reason: "QA backend not configured" }, limits: { directVeoDurationsSeconds: [4,6,8], directVeoAspectRatios: ["16:9", "9:16"], directVeoResolutions: ["720p"] } } });
        if (action === "estimate") return json({ supported: true, quote: { id: quoteId, expiresAt: new Date(Date.now() + 60_000).toISOString() }, estimate: { pricingConfigured: true, amount: 0.4, currency: "USD", disclaimer: "QA quote double, not real provider price." } });
        if (action === "create-job") return json({ job: { id: videoId, status: "submitted", output: { ready: false } } });
        if (action === "status") return json({ job: { id: videoId, status: videoCompleted ? "completed" : "running", output: { ready: videoCompleted } } });
        if (action === "cancel") return json({ job: { id: videoId, status: "cancel-requested", output: { ready: false } } });
        if (action === "download") return route.fulfill({ contentType: "video/mp4", body: Buffer.from("QA transport bytes; not real provider playback") });
      }
      const action = url.searchParams.get("mediaAction");
      if (action === "capabilities") return json({ image: { configured: mediaEnabled, canCreate: mediaEnabled, message: "QA unavailable/permission state" } });
      if (action === "image-create") return json({ job: { id: imageId, status: imageFailure ? "submission-unknown" : "completed", expiresAt: new Date(Date.now() + 86400000).toISOString(), output: { ready: !imageFailure }, error: imageFailure ? "Provider outcome unknown (QA double)" : null } });
      if (action === "image-status") return json({ job: { id: imageId, status: "completed", output: { ready: true } } });
      if (action === "image-download") return route.fulfill({ contentType: "image/png", body: png });
      if (request.method() === "GET") return json({ providers: { gemini: { configured: true, availableKeyCount: 1 } }, actions: [] });
      return json({ action: { provider: "gemini", output: "QA text response, not a live model", model: "qa-model" } });
    });
    const page = await ctx.newPage(); page.on("pageerror", (error) => errors.push(error.message));
    const go = async () => { await page.goto(`${origin}/tests/fixtures/chat-ai-media.html`); await page.waitForFunction(() => HHChatAI.inspect().mounted); };
    const creations = () => calls.filter((call) => call.query.includes("image-create") || call.body.action === "create-job");
    const submit = async (kind, prompt) => {
      await page.locator(`[data-chat-ai-mode="${kind}"]`).click(); await page.locator("[data-chat-ai-input]").fill(prompt);
      await page.locator("[data-chat-ai-input]").press("Enter"); await page.locator("[data-chat-media-confirm]").waitFor();
    };
    const confirm = async () => { await page.locator("[data-chat-media-cost]").check(); await page.locator("[data-chat-media-rights]").check(); await page.locator("[data-chat-media-confirm]").click(); await page.waitForFunction(() => !HHChatAI.inspect().busy); };
    await go(); await page.locator('[data-chat-ai-mode="image"]').click(); await page.waitForFunction(() => !document.querySelector(".chat-media-controls")?.textContent.includes("Đang kiểm tra"));
    assert.equal(creations().length, 0); pass("mount/capability discovery never generates paid media automatically");
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await page.locator("[data-chat-ai-input]").isVisible(), true);
      await page.screenshot({ path: path.join(output, `image-controls-${width}.png`), fullPage: true }); pass(`${width}px image settings remain reachable without horizontal overflow`);
    }
    await submit("image", "Góc học tập thư giãn dưới trời sao");
    await page.locator("[data-chat-media-confirm]").click(); assert.equal(creations().length, 0); pass("unchecked cost/rights cannot submit an image");
    await confirm(); assert.equal(creations().length, 1);
    await page.screenshot({ path: path.join(output, "image-result.png"), fullPage: true });
    await page.locator("[data-chat-media-view]").click(); await page.waitForFunction(() => document.querySelector(".chat-media-result img")?.naturalWidth === 1);
    const downloadEvent = page.waitForEvent("download"); await page.locator("[data-chat-media-download]").click(); assert.match((await downloadEvent).suggestedFilename(), /\.png$/);
    pass("confirmed image renders owned raster Blob and downloads actual PNG bytes (API double)");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(HHChatAI.storageKey("owner-a"))));
    assert.equal(saved.sessions[0].messages.at(-1).media.jobId, imageId); assert.equal(JSON.stringify(saved).includes(png.toString("base64")), false); assert.equal(JSON.stringify(saved).includes("blob:"), false);
    pass("per-account history persists job metadata, not raster bytes or Blob URLs");
    await page.reload(); await page.locator("[data-chat-media-view]").waitFor(); assert.equal(creations().length, 1);
    await page.locator("[data-chat-media-view]").click(); await page.waitForFunction(() => document.querySelector(".chat-media-result img")?.naturalWidth === 1);
    pass("reload reopens existing image without creating another paid request");
    await submit("video", "Camera chậm qua một thành phố neon ấm áp"); assert.equal(creations().length, 1);
    assert.match(await page.locator(".chat-media-review").innerText(), /0.4 USD/); await confirm();
    const createdVideo = creations().at(-1).body; assert.equal(createdVideo.quoteId, quoteId); assert.equal(createdVideo.acceptedEstimate, true); assert.ok(createdVideo.idempotencyKey);
    pass("video is submitted only after matching server quote and explicit acceptance");
    videoCompleted = true; await page.locator("[data-chat-media-check]").last().click(); await page.waitForFunction(() => document.querySelectorAll("[data-chat-media-view]").length === 2);
    await page.locator("[data-chat-media-view]").last().click(); await page.locator("video[controls]").waitFor(); assert.equal(await page.locator("video[controls]").count(), 1); assert.equal(await page.locator("video[autoplay]").count(), 0);
    pass("video status comes from backend and preview is opt-in, controlled and never autoplay (transport double, not playback evidence)");
    await page.evaluate(() => mountChatQA("owner-b")); assert.equal(await page.locator("[data-chat-media-view]").count(), 0);
    await page.evaluate(() => mountChatQA("owner-a")); assert.equal(await page.locator("[data-chat-media-view]").count(), 2); pass("switching accounts does not mix media/chat history");
    imageFailure = true; await submit("image", "Ảnh thử trường hợp mất kết nối"); await confirm();
    assert.match(await page.locator(".chat-media-result").last().innerText(), /Chưa xác nhận/);
    const afterFailure = creations().length; await page.reload(); assert.equal(creations().length, afterFailure); pass("ambiguous provider outcome persists honestly and does not silently regenerate on reload");
    imageFailure = false;
    await page.locator('[data-chat-ai-mode="chat"]').click(); await page.locator("[data-chat-ai-input]").fill("/image Chỉnh góc học tập sang ánh sáng hoàng hôn");
    await page.locator("[data-chat-ai-files]").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await page.locator("[data-chat-ai-input]").press("Enter"); await page.locator("[data-chat-media-confirm]").waitFor();
    await confirm(); const referenceRequest = creations().at(-1).body;
    assert.equal(referenceRequest.referenceImages.length, 1); assert.equal(referenceRequest.referenceImages[0].data, png.toString("base64")); assert.equal(referenceRequest.rightsAttested, true);
    assert.equal(await page.locator('[data-chat-ai-hub]').getAttribute("data-active-mode"), "image");
    assert.equal(await page.locator("[data-chat-ai-stop]").isVisible(), false);
    const privateState = await page.evaluate(() => localStorage.getItem(HHChatAI.storageKey("owner-a"))); assert.equal(privateState.includes(png.toString("base64")), false);
    pass("/image creates rather than analyzes; reference is attested, submitted once, not retained in local history and idle Stop stays hidden");
    const afterReference = creations().length;
    mediaEnabled = false; await page.reload(); await page.locator('[data-chat-ai-mode="image"]').click(); await page.locator("[data-chat-ai-input]").fill("Không được gửi khi thiếu cấu hình"); await page.locator("[data-chat-ai-input]").press("Enter");
    assert.equal(await page.locator("[data-chat-media-confirm]").count(), 0); assert.equal(creations().length, afterReference); pass("unavailable/denied media cannot fall back to fake generated content");
    await page.evaluate(() => HHChatAI.unmount()); assert.equal(await page.locator("[data-chat-ai-hub]").count(), 1); // shell may stay; listeners/requests are detached.
    const count = calls.length; await page.waitForTimeout(1100); assert.equal(calls.length, count); assert.equal(await page.evaluate(() => HHChatAI.inspect().mounted), false); pass("unmount detaches workspace and initiates no more requests");
    assert.deepEqual(errors, []); pass("no page JavaScript errors");
    console.log(JSON.stringify({ passed: results.length, creates: creations().length, output, evidence: "Local UI + API/media doubles only; no paid Gemini/Veo call." }));
  } finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
