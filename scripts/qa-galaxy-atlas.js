"use strict";
// Local procedural/WebGL and UI checks. Auth/provider replies are explicit doubles.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const repo = path.resolve(__dirname, ".."), output = path.join(repo, ".study-local/galaxy-atlas-1055"), results = [], graphics = [];
const baselineRef = process.env.HH_QA_BASE_REF || "40070ca5519cb0cbf79173c98f0cdb8880cbd679";
const gitFile = (file, staged = false, ref = "HEAD") => execFileSync("git", ["show", `${staged ? ":" : ref + ":"}${file}`], { cwd: repo, maxBuffer: 8 * 1048576 });
const baseline = new Set(["tests/fixtures/galaxy-graphics-qa.html", "galaxy-universe-renderer.mjs", "galaxy-workspace-renderer.mjs", "galaxy-celestial-materials.mjs", "galaxy-deep-space.mjs"]);
const csp = JSON.parse(gitFile("vercel.json").toString()).headers.flatMap(row => row.headers).find(row => row.key === "Content-Security-Policy").value;
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(new URL(req.url, "http://localhost").pathname), before = name.startsWith("/before/");
  if (before) name = name.slice(7);
  const file = path.resolve(repo, "." + name), relative = name.slice(1);
  if (!file.startsWith(repo + path.sep) || name.split("/").some(part => part.startsWith(".") || ["api", "utils", "node_modules"].includes(part))) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" })[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  if (relative === "index.html" || relative === "tests/fixtures/galaxy-graphics-qa.html") res.setHeader("Content-Security-Policy", csp);
  // Emulate the production hostname's already-allowlisted socket URL; its service
  // is still intercepted as unavailable, not connected or claimed as tested.
  if (relative === 'config.js') return res.end(gitFile(relative).toString().replace('"http://127.0.0.1:4000"', '"https://hoangdaika13-astra-realtime.onrender.com"'));
  // Serve the old inline fixture boot externally, too; do not weaken production CSP.
  if (before && relative === 'tests/fixtures/galaxy-graphics-boot.mjs') return res.end(gitFile('tests/fixtures/galaxy-graphics-qa.html', false, baselineRef).toString().match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  if (before && baseline.has(relative)) {
    const source = gitFile(relative, false, baselineRef);
    return res.end(relative.endsWith('.html') ? source.toString().replace(/<script type="module">[\s\S]*?<\/script>/, '<script type="module" src="galaxy-graphics-boot.mjs"></script>') : source);
  }
  // Keep the separate authentication work in progress out of this release check.
  if (["auth-platform.js", "auth-neon-gateway.css"].includes(relative)) return res.end(gitFile(relative));
  if (["index.html", "sw.js"].includes(relative) && process.env.HH_QA_STAGED_RELEASE === "1") return res.end(gitFile(relative, true));
  fs.createReadStream(file).pipe(res);
});
const pass = text => { results.push(text); console.log("PASS " + text); };
async function run() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", reducedMotion: "reduce" });
    const errors = [], shaderErrors = [], publicErrors = [], backendDoubles = [];
    context.on("page", page => {
      page.on("pageerror", error => { errors.push(error.message); console.error(error.stack || error.message); });
      page.on("console", message => { if (message.type() === "error" && /Content Security Policy|THREE.WebGLProgram|VALIDATE_STATUS|ERROR:\s+0:/i.test(message.text())) { shaderErrors.push(message.text()); console.error(message.text()); } });
      page.on("response", response => { if (response.url().startsWith(origin) && !response.url().includes("/api/") && response.status() >= 400) publicErrors.push(new URL(response.url()).pathname); });
    });
    await context.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(origin) && !url.includes("/api/")) return route.continue();
      if (/^(blob|data):/.test(url) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.continue();
      const pathname = new URL(url).pathname; backendDoubles.push({ pathname, method: route.request().method() });
      return route.fulfill({ status: pathname.includes("/providers") ? 200 : 503, contentType: "application/json", body: JSON.stringify({ google: false, facebook: false, email: false, error: "Local Galaxy QA: backend unavailable", code: "QA_UNCONFIGURED" }) });
    });
    const fixture = await context.newPage();
    for (const before of [true, false]) {
      await fixture.goto(origin + (before ? "/before" : "") + "/tests/fixtures/galaxy-graphics-qa.html?still=1");
      await fixture.locator("canvas[data-glu-webgl][data-frames]").waitFor({ timeout: 45000 }).catch(async error => { console.error(await fixture.evaluate(() => ({ status: document.querySelector('#status')?.textContent, canvases: [...document.querySelectorAll('canvas')].map(node => ({...node.dataset})), mime: document.contentType }))); throw error; });
      for (const id of ["map", "ai", "music", "video", "creator", "games", "dev", "learning", "community", "tools", "analytics", "settings"]) {
        if (id !== "map") { await fixture.locator("#route").selectOption(id); await fixture.locator("#scene canvas[data-frames]").waitFor({ timeout: 30000 }); }
        assert.equal(await fixture.locator("#scene canvas").count(), 1);
        const counters = await fixture.locator("#scene canvas").evaluate(node => ({ calls: +node.dataset.drawCalls, geometries: +node.dataset.geometries, quality: node.dataset.quality }));
        assert.ok(counters.calls > 0 && counters.geometries > 0); graphics.push({ before, id, ...counters });
        if (["map", "music", "learning"].includes(id)) await fixture.locator("#scene").screenshot({ path: path.join(output, `${id}-${before ? "before" : "after"}.png`) });
      }
    }
    for (const current of graphics.filter(row => !row.before)) { const old = graphics.find(row => row.before && row.id === current.id); assert.equal(current.calls, old.calls, current.id + " draw calls"); assert.equal(current.geometries, old.geometries, current.id + " geometries"); }
    pass("Real local WebGL under production CSP compiles map and all eleven worlds; same-camera before/after retain draw-call and geometry budgets");
    await fixture.locator("#route").selectOption("map"); await fixture.locator("canvas[data-glu-webgl][data-frames]").waitFor();
    for (const quality of ["economy", "balanced", "cinematic"]) { await fixture.locator("#quality").selectOption(quality); await fixture.waitForFunction(quality => document.querySelector("#scene canvas").dataset.quality === quality, quality); assert.equal(await fixture.locator("canvas").count(), 1); }
    await fixture.locator("#loss").click(); await fixture.waitForFunction(() => document.querySelector("#scene").dataset.state === "fallback");
    await fixture.locator("#retry").click(); await fixture.locator("canvas[data-glu-webgl][data-frames]").waitFor(); assert.equal(await fixture.locator("canvas").count(), 1);
    await fixture.locator("#route").selectOption("learning"); await fixture.locator("canvas[data-hgl1-workspace-webgl][data-frames]").waitFor();
    await fixture.locator("#loss").click(); await fixture.waitForFunction(() => document.querySelector("#scene").dataset.state === "fallback");
    await fixture.locator("#retry").click(); await fixture.locator("canvas[data-hgl1-workspace-webgl][data-frames]").waitFor();
    await fixture.locator("#destroy").click(); assert.equal(await fixture.locator("canvas").count(), 0);
    pass("Three quality tiers, actual map/workspace WebGL context loss, retry with one canvas and teardown with zero canvases"); await fixture.close();
    const page = await context.newPage();
    const revealWorkspace = async route => {
      const scene = page.locator(`[data-hgl1-workspace-3d][data-route="${route}"]`);
      await scene.waitFor({ timeout: 45000 });
      // IndexedDB hydration can synchronously replace/reinsert a just-mounted
      // scene. Re-resolve the locator after that bounded layout transition.
      for (let attempt = 0; attempt < 4; attempt++) {
        try { await scene.scrollIntoViewIfNeeded(); break; }
        catch (error) { if (attempt === 3 || !/not attached/i.test(error.message)) throw error; await page.waitForTimeout(100); }
      }
      await scene.locator('canvas[data-frames]').waitFor({ timeout: 45000 });
    };
    await page.goto(origin + "/index.html?api=local#/platform", { waitUntil: "domcontentloaded" });
    await page.locator("[data-guest-login]").click(); await page.locator(".app-main .php").waitFor({ timeout: 45000 });
    const privacy = page.getByRole("button", { name: "Từ chối tùy chọn", exact: true }); if (await privacy.isVisible()) await privacy.click();
    await page.evaluate(() => { window.qaHeader = document.querySelector(".app-header"); window.qaSidebar = document.querySelector(".app-sidebar"); });
    await page.locator('[data-sidebar-search]').fill('HH Galaxy');
    await page.locator('.app-sidebar [data-app-route="/galaxy"]:visible').first().click();
    await page.locator('[data-sidebar-search]').fill('');
    await page.locator("[data-glu]").waitFor({ timeout: 45000 }); await page.locator("[data-glu] canvas[data-frames]").waitFor({ timeout: 45000 });
    assert.match(page.url(), /#\/home$/); assert.equal(await page.locator("[data-glu-system-count]").innerText(), "11"); assert.equal(await page.locator("[data-glu-tool-count]").innerText(), "30");
    assert.equal(await page.locator("[data-glu] canvas").count(), 1);
    const shellStable = () => page.evaluate(() => qaHeader === document.querySelector(".app-header") && qaSidebar === document.querySelector(".app-sidebar"));
    assert.ok(await shellStable());
    await page.screenshot({ path: path.join(output, "atlas-desktop.png"), fullPage: false });
    await page.locator('[data-glu-select="/galaxy/music"]').click(); await page.locator('[data-glu-preview] h3').getByText("Music Planet", { exact: true }).waitFor();
    assert.equal(await page.locator('.glu-portrait').getAttribute('data-kind'), "gas");
    assert.equal(await page.locator('[data-glu]').evaluate(node => node.style.getPropertyValue('--glu-active-accent')), "#64ddce");
    await page.locator('[data-glu-system="music"]').click(); assert.equal(await page.locator('[data-glu-cards] [data-glu-select]').count(), 3);
    await page.locator('[data-glu-select]').first().click(); assert.equal(await page.locator('.glu-portrait').getAttribute('data-kind'), "gas");
    await page.locator('[data-glu-action="reset-camera"]').click(); assert.equal(await page.locator('[data-glu-cards] [data-glu-select]').count(), 3);
    await page.locator('[data-glu-action="overview"]').click(); await page.locator('[data-glu-quality]').focus();
    assert.equal(await page.locator('.glu-portrait').getAttribute('data-kind'), "sun");
    await page.locator('[data-glu-search]').fill("khong-co-diem-den-qa"); await page.getByText("Chưa có điểm đến phù hợp.", { exact: false }).waitFor(); await page.locator('[data-glu-action="clear-search"]').click();
    await page.locator('[data-glu-select]').first().focus(); await page.keyboard.press("End"); assert.equal(await page.evaluate(() => document.activeElement.dataset.gluSelect), "/galaxy/settings");
    pass("Guest → sidebar Galaxy preserves the Platform shell; registry counts, selected portrait/accent, child system, camera reset, search/empty and keyboard navigation are actual actions");
    await page.locator('[data-glu-select="/galaxy/music"]').click(); await page.locator('[data-glu-star="/galaxy/music"]').click(); await page.locator('[data-glu-filter="favorites"]').click();
    assert.equal(await page.locator('[data-glu-select="/galaxy/music"]').count(), 1);
    assert.ok(await page.evaluate(() => HHGalaxyCosmicStudio.readPreferences(localStorage).favorites.includes('/galaxy/music')), 'Favorite must be physically saved, not only rendered');
    await page.reload({ waitUntil: "domcontentloaded" }); await page.locator('[data-glu]').waitFor({ timeout: 45000 });
    await page.evaluate(() => { window.qaHeader = document.querySelector(".app-header"); window.qaSidebar = document.querySelector(".app-sidebar"); });
    await page.locator('[data-glu-filter="favorites"]').click();
    assert.equal(await page.locator('[data-glu-select="/galaxy/music"]').count(), 1); await page.locator('[data-glu-filter="all"]').click();
    await page.locator('[data-gcs-view="list"]').click(); assert.equal(await page.locator('[data-glu]').getAttribute("data-view"), "list");
    assert.equal(await page.locator('[data-glu-cards] a[data-glu-open]').count(), 11);
    await page.locator('[data-gcs-view="map"]').click(); await page.locator('[data-glu-scene]').scrollIntoViewIfNeeded(); await page.locator('[data-glu] canvas[data-frames]').waitFor();
    assert.ok(await page.evaluate(() => HHGalaxyCosmicStudio.readPreferences(localStorage).favorites.includes('/galaxy/music')), 'View changes must preserve the latest favorites');
    await page.emulateMedia({ reducedMotion: "no-preference" }); await page.locator('[data-glu-action="pause"]').click();
    assert.equal(await page.locator('[data-glu-action="pause"]').getAttribute("aria-pressed"), "true");
    await page.waitForTimeout(350); const paused = await page.locator('[data-glu] canvas').getAttribute("data-frames"); await page.waitForTimeout(180); assert.equal(await page.locator('[data-glu] canvas').getAttribute("data-frames"), paused);
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.locator('[data-glu-action="pause"]:disabled').waitFor();
    assert.equal(await page.locator('[data-glu-action="pause"]').isDisabled(), true);
    pass("Favorites recover after reload, list/map share actual routes, manual pause stops frames and reduced motion disables animation controls");
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 375) {
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-glu]').waitFor({ timeout: 45000 });
        await page.evaluate(() => { window.qaHeader = document.querySelector('.app-header'); window.qaSidebar = document.querySelector('.app-sidebar'); });
      }
      const dismissNavigation = page.locator('.app-sidebar__mobile-title [data-sidebar-dismiss]');
      if (await dismissNavigation.isVisible() && !await page.locator('body').evaluate(node => node.classList.contains('app-sidebar-collapsed'))) await dismissNavigation.click();
      if (width === 375) assert.ok(await page.locator('body').evaluate(node => node.classList.contains('app-sidebar-collapsed')), 'Mobile navigation can close without changing Galaxy');
      await page.locator('[data-glu-action="overview"]').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Document overflow " + width);
      await page.locator('[data-glu-filter="recent"]').scrollIntoViewIfNeeded(); assert.equal(await page.locator('[data-glu-filter="recent"]').isVisible(), true);
      assert.ok(await page.locator('.hgl1-main').evaluate(node => ['auto','scroll'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight && node.scrollTop > 0), 'Atlas uses a reachable scrolling workspace ' + width);
      const clear = page.locator('[data-glu-action="overview"]'); assert.ok((await clear.boundingBox()).height >= 44);
      await page.screenshot({ path: path.join(output, `atlas-${width}.png`), fullPage: false });
      await page.locator('.glu-intro').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `atlas-${width}-top.png`), fullPage: false });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => document.documentElement.style.zoom = "2");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Zoom200 overflow");
    await page.locator('[data-glu-filter="all"]').click(); await page.locator('[data-glu-select="/galaxy/learning"]').click(); assert.equal(await page.locator('.glu-portrait').getAttribute('data-kind'), "ocean");
    await page.evaluate(() => document.documentElement.style.zoom = "1");
    await page.emulateMedia({ forcedColors: "active" }); await page.locator('[data-glu-action="overview"]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('[data-glu-canvas]').evaluate(node => getComputedStyle(node).display), "none");
    await page.keyboard.press('Tab'); await page.locator('[data-glu-select]').first().focus(); assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
    await page.emulateMedia({ forcedColors: "none" });
    pass("Desktop/tablet/375px, reachable lower content, 44px controls, 200% CSS zoom, reduced motion and forced-color keyboard fallback");
    await page.evaluate(() => location.hash = "#/galaxy/ai"); await page.locator('[data-hgl1-ai-draft]').waitFor();
    await revealWorkspace('/galaxy/ai');
    const draftText = "Bản nháp riêng của Galaxy Atlas QA — không gửi provider";
    // Input/save/navigation in one turn reproduces the former pending-400ms
    // snapshot race; no provider is invoked by the local save action.
    await page.evaluate(text => {
      const input = document.querySelector('[data-hgl1-ai-draft]');
      input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-hgl1-action="save-ai-draft"]').click();
      location.hash = '#/galaxy/music';
    }, draftText);
    const worlds = ["music", "video", "creator", "games", "dev", "learning", "community", "tools", "analytics", "settings"];
    for (const world of worlds) { await page.evaluate(id => location.hash = "#/galaxy/" + id, world); await revealWorkspace('/galaxy/' + world); assert.equal(await page.locator('canvas[data-hgl1-workspace-webgl]').count(), 1); assert.ok(await shellStable()); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await page.evaluate(() => location.hash = "#/galaxy/ai"); await page.locator('[data-hgl1-ai-draft]').waitFor();
    assert.equal(await page.locator('[data-hgl1-ai-draft]').inputValue(), draftText);
    await page.reload({ waitUntil: "domcontentloaded" }); await page.locator('[data-hgl1-ai-draft]').waitFor({ timeout: 45000 }); assert.equal(await page.locator('[data-hgl1-ai-draft]').inputValue(), draftText);
    const savedDraft = page.locator('[data-hgl1-item]').filter({ hasText: draftText });
    await savedDraft.locator('[data-gwb="item-edit"]').click();
    assert.equal(await page.locator('.gwb-dialog textarea[name="description"]').inputValue(), draftText);
    await page.locator('.gwb-dialog button[value="cancel"]').click();
    await page.goBack(); await page.locator('.hh-galaxy-app[data-route="/galaxy/settings"]').waitFor(); await page.goForward(); await page.locator('[data-hgl1-ai-draft]').waitFor();
    await page.evaluate(() => location.hash = "#/platform"); await page.locator(".app-main .php").waitFor({ timeout: 45000 }); assert.equal(await page.locator('canvas[data-glu-webgl],canvas[data-hgl1-workspace-webgl]').count(), 0);
    pass("All eleven workspace scenes use one canvas inside the same shell; immediate save/navigation preserves AI tab draft and saved editable record after reload/Back/Forward without submission; returning Platform cleans Galaxy canvases");
    assert.deepEqual(errors, []); assert.deepEqual(shaderErrors, []); assert.deepEqual(publicErrors, []);
    assert.ok(!backendDoubles.some(row => row.pathname === '/api/ai' && row.method === 'POST'));
    pass("No uncaught JavaScript, shader/CSP or public-asset errors or paid provider submission; backend unavailable responses remain explicit doubles");
    await context.close();
  } catch (error) {
    for (const context of browser?.contexts() || []) for (const page of context.pages()) {
      console.error(await page.evaluate(() => ({ route: location.hash, atlas: !!document.querySelector('[data-glu]'), counts: [...document.querySelectorAll('[data-glu] canvas')].map(node => ({...node.dataset})) })).catch(() => 'Page unavailable'));
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: false }).catch(() => {});
    }
    throw error;
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ at: new Date().toISOString(), baselineRef, results, graphics }, null, 2));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
