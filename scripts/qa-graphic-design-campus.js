"use strict";
// Actual Chromium/editor checks. Backend/provider replies are unavailable doubles.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const repo = path.resolve(__dirname, ".."), output = path.join(repo, ".study-local/graphic-design-campus-1056");
const results = [], routes = [], pageErrors = [], cspErrors = [], publicErrors = [], backendDoubles = [];
const gitFile = (file, staged = false) => execFileSync("git", ["show", `${staged ? ":" : "HEAD:"}${file}`], { cwd: repo, maxBuffer: 10 * 1048576 });
const csp = JSON.parse(gitFile("vercel.json").toString()).headers.flatMap(row => row.headers).find(row => row.key === "Content-Security-Policy").value;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname), relative = name.slice(1);
  if (relative === "tests/fixtures/graphic-campus-probe.html") {
    res.setHeader("Content-Type", "text/html"); res.setHeader("Content-Security-Policy", csp);
    return res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Isolated real document API probe</title><body><main id="probe"></main><script src="/graphic-design-project-context.js"></script><script src="/graphic-design-universal.js"></script></body></html>');
  }
  const file = path.resolve(repo, "." + name);
  if (!file.startsWith(repo + path.sep) || name.split("/").some(part => part.startsWith(".") || ["api", "utils", "node_modules"].includes(part))) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  if (relative === "index.html") res.setHeader("Content-Security-Policy", csp);
  if (relative === "config.js") return res.end(gitFile(relative).toString().replace('"http://127.0.0.1:4000"', '"https://hoangdaika13-astra-realtime.onrender.com"'));
  if (["auth-platform.js", "auth-neon-gateway.css"].includes(relative)) return res.end(gitFile(relative));
  if (["index.html", "sw.js"].includes(relative) && process.env.HH_QA_STAGED_RELEASE === "1") return res.end(gitFile(relative, true));
  fs.createReadStream(file).pipe(res);
});
const pass = message => { results.push(message); console.log("PASS " + message); };
async function run() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const configure = async context => {
      context.on("page", page => {
        page.on("pageerror", error => { pageErrors.push(error.message); console.error(error.stack || error.message); });
        page.on("console", message => { if (message.type() === "error" && /Content Security Policy|THREE.WebGLProgram|VALIDATE_STATUS|ERROR:\s+0:/i.test(message.text())) { cspErrors.push(message.text()); console.error(message.text()); } });
        page.on("response", response => { if (response.url().startsWith(origin) && !response.url().includes("/api/") && response.status() >= 400) publicErrors.push(new URL(response.url()).pathname); });
      });
      await context.route("**/*", route => {
        const url = route.request().url();
        if (url.startsWith(origin) && !url.includes("/api/")) return route.continue();
        if (/^(blob|data):/.test(url) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.continue();
        const pathname = new URL(url).pathname; backendDoubles.push({ pathname, method: route.request().method() });
        return route.fulfill({ status: pathname.includes("/providers") ? 200 : 503, contentType: "application/json", body: JSON.stringify({ google: false, facebook: false, email: false, error: "Local Graphics QA: backend unavailable", code: "QA_UNCONFIGURED" }) });
      });
    };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", reducedMotion: "reduce" }); await configure(context);
    const page = await context.newPage();
    const go = async view => {
      await page.evaluate(id => location.hash = id ? "#/graphic-design/" + id : "#/graphic-design", view);
      await page.locator(`.graphic-design-studio[data-gd-view="${view || "overview"}"]`).waitFor({ timeout: 45000 });
      await page.locator("[data-gdc-theme]").waitFor();
    };
    await page.goto(origin + "/index.html?api=local#/platform", { waitUntil: "domcontentloaded" });
    await page.locator("[data-guest-login]").click(); await page.locator(".app-main .php").waitFor({ timeout: 45000 });
    const privacy = page.getByRole("button", { name: "Từ chối tùy chọn", exact: true }); if (await privacy.isVisible()) await privacy.click();
    await page.evaluate(() => { window.qaHeader = document.querySelector(".app-header"); window.qaSidebar = document.querySelector(".app-sidebar"); });
    await go("");
    assert.equal(await page.locator("[data-gd-open-project]").count(), 0, "Fresh guest must have no fictional projects");
    assert.equal(await page.locator("[data-gdc-count]").innerText(), "25 studio");
    assert.ok(await page.evaluate(() => qaHeader === document.querySelector(".app-header") && qaSidebar === document.querySelector(".app-sidebar")));
    pass("Guest → canonical Graphics hub retains Platform shell and shows zero fake projects with 25 real tool destinations");
    await page.locator('[data-gdc-search]').fill("typography"); assert.equal(await page.locator('[data-gdc-results] a').count(), 1);
    await page.locator('[data-gdc-search]').fill("khongcongcu-qa"); assert.equal(await page.locator('[data-gdc-results] a').count(), 0);
    await page.locator('[data-gdc-search]').fill("");
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      const dismiss = page.locator('.app-sidebar__mobile-title [data-sidebar-dismiss]');
      if (await dismiss.isVisible() && !await page.locator('body').evaluate(node => node.classList.contains('app-sidebar-collapsed'))) await dismiss.click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Hub document overflow " + width);
      await page.locator('[data-gdc-theme]').selectOption("aurora"); assert.equal(await page.locator('.graphic-design-studio').getAttribute('data-gd-palette'), "aurora");
      await page.locator('[data-gdc-focus]').click(); assert.equal(await page.locator('.graphic-design-studio').getAttribute('data-gd-focus'), "true");
      await page.locator('[data-gdc-focus]').click();
      await page.locator('[data-gdc-motion]').click(); assert.equal(await page.locator('.graphic-design-studio').getAttribute('data-gd-interface-motion'), "false");
      await page.locator('[data-gdc-reset]').click();
      await page.screenshot({ path: path.join(output, `hub-${width}.png`), fullPage: false });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => document.documentElement.style.zoom = "2");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Hub CSS zoom200 overflow");
    await page.locator('[data-gdc-theme]').selectOption("solar"); await page.evaluate(() => document.documentElement.style.zoom = "1");
    await page.emulateMedia({ forcedColors: "active" }); await page.keyboard.press("Tab"); await page.locator('[data-gdc-focus]').focus();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
    await page.emulateMedia({ forcedColors: "none" });
    pass("Finder/empty, themes, focus/reset, motion preference, 1440/768/375px, CSS zoom200 and forced-color keyboard controls work");
    // Create two real same-engine projects through actual hub controls.
    const createProject = async label => {
      await go(""); await page.locator('[data-gd-template="social"]').first().click();
      await page.locator('.graphic-design-studio[data-gd-view="quick-motion"]').waitFor();
      await page.locator('[data-qm-content="title"]').fill(label);
      await page.locator('[data-qm-content="title"]').blur();
      await page.waitForFunction(label => JSON.parse(HHGraphicProjectContext.resolve().engineStorage.getItem("hh.graphic-quick-motion.project.v1") || '{}').content?.title === label, label);
      return page.evaluate(() => HHGraphicProjectContext.resolve().projectId);
    };
    const firstProject = await createProject("first"), secondProject = await createProject("second"); assert.notEqual(firstProject, secondProject);
    await go(""); await page.locator(`[data-gd-open-project="${firstProject}"]`).click();
    await page.locator('.graphic-design-studio[data-gd-view="quick-motion"]').waitFor();
    assert.equal(await page.locator('[data-qm-content="title"]').inputValue(), "first");
    await page.reload({ waitUntil: "domcontentloaded" }); await page.locator('.graphic-design-studio[data-gd-view="quick-motion"]').waitFor({ timeout: 45000 });
    assert.equal(await page.evaluate(() => HHGraphicProjectContext.resolve().projectId), firstProject);
    assert.equal(await page.locator('[data-qm-content="title"]').inputValue(), "first");
    await page.evaluate(() => { window.qaHeader = document.querySelector(".app-header"); window.qaSidebar = document.querySelector(".app-sidebar"); });
    await page.goBack(); await page.locator('.graphic-design-studio[data-gd-view="overview"]').waitFor();
    await page.goForward(); await page.locator('.graphic-design-studio[data-gd-view="quick-motion"]').waitFor();
    const scoped = await page.evaluate(() => {
      const guest = HHGraphicProjectContext.resolve(), other = HHGraphicProjectContext.resolve({ accountId: "qa-other-account", projectId: guest.projectId });
      return { own: JSON.parse(guest.engineStorage.getItem("hh.graphic-quick-motion.project.v1")).content.title, other: other.engineStorage.getItem("hh.graphic-quick-motion.project.v1") };
    }); assert.deepEqual(scoped, { own: "first", other: null });
    pass("Two same-tool projects create different IDs, reopen/reload/Back/Forward retain selection, and explicit account context cannot read the other draft");
    const engineViews = ["workflow", "vector", "nondestructive", "typography", "effects", "quick-motion", "animation", "state-machine", "3d", "mockup", "character", "simulation", "prototype", "motion", "adaptive", "data", "components", "color", "projects", "collaboration", "review", "dev-ai", "export", "plugins", "performance", "composer"];
    for (const view of engineViews) {
      await go(view);
      await page.waitForFunction(() => {
        const host = document.querySelector('.gd-focused-workspace > div');
        return host && host.querySelector('button,input,canvas,svg') && !host.querySelector('.gd-engine-unavailable');
      }, null, { timeout: 45000 });
      if (view === "workflow") await page.locator('[data-gdw-vector] button').first().waitFor({ timeout: 45000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Workspace document overflow " + view);
      assert.ok(await page.evaluate(() => qaHeader === document.querySelector(".app-header") && qaSidebar === document.querySelector(".app-sidebar")));
      routes.push(view);
      if (["vector", "typography", "3d", "projects", "composer"].includes(view)) await page.screenshot({ path: path.join(output, `workspace-${view}.png`), fullPage: false });
    }
    pass("All25 dedicated workspace engines plus Workflow render actual controls without route errors or outer-shell changes");
    for (const view of engineViews) {
      await go(view); await page.setViewportSize({ width: 375, height: 900 });
      await page.waitForFunction(() => document.querySelector('.gd-focused-workspace > div')?.querySelector('button,input,canvas,svg'), null, { timeout: 45000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "375px workspace overflow " + view);
      if (["vector", "typography", "composer", "projects"].includes(view)) await page.screenshot({ path: path.join(output, `workspace-${view}-375.png`), fullPage: false });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    pass("All25workspace routes plus Workflow stay within375px without page-wide horizontal overflow");
    // A controlled IndexedDB timing double exercises the real Vector DOM/API
    // lifecycle. Original-asset tests below use real IndexedDB, not this double.
    const lifecyclePage = await context.newPage();
    await lifecyclePage.goto(origin + '/tests/fixtures/graphic-campus-probe.html');
    await lifecyclePage.addScriptTag({ url: origin + '/graphic-design-vector-core.js?v=3' });
    const vectorLifecycle = await lifecyclePage.evaluate(async () => {
      const api = HHGraphicVectorCore, originalIDB = Object.getOwnPropertyDescriptor(window, 'indexedDB');
      let openRequest, readTransaction, writes = [], restored = api.createDefaultProject(); restored.meta.name = 'Existing saved Vector';
      const database = { objectStoreNames: { contains: () => true }, close() {}, transaction(name, mode) {
        const tx = { objectStore() { return { get() { const request={result:restored};readTransaction=tx;return request; }, put(value) { writes.push(value.meta.name);queueMicrotask(()=>tx.oncomplete?.());return{result:value}; } }; } };
        return tx;
      } };
      const local = new Map(), storage={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)};
      Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){openRequest={result:database};return openRequest;}}});
      const host=document.createElement('div');document.body.append(host);
      let controller=api.mount(host,{storage});const busy=host.inert;
      api.unmount(host);openRequest.onsuccess();await Promise.resolve();await Promise.resolve();readTransaction.oncomplete();await controller.ready;
      const afterEarlyExit={writes:[...writes],empty:host.innerHTML==='',busy};
      controller=api.mount(host,{storage});openRequest.onsuccess();await Promise.resolve();await Promise.resolve();readTransaction.oncomplete();await controller.ready;
      const restoredName=controller.getProject().meta.name;const edited=controller.getProject();edited.meta.name='Explicit final edit';controller.setProject(edited);api.unmount(host);
      for(let i=0;i<12;i++)await Promise.resolve();
      if(originalIDB)Object.defineProperty(window,'indexedDB',originalIDB);host.remove();
      return {afterEarlyExit,restoredName,writes};
    });
    assert.deepEqual(vectorLifecycle,{afterEarlyExit:{writes:[],empty:true,busy:true},restoredName:'Existing saved Vector',writes:['Explicit final edit']});
    await lifecyclePage.close();
    // Control visibility/RAF delivery while the real Three module initializes;
    // this is a scheduling-race test, not a physical background-tab benchmark.
    const graphicsLifecycle = await context.newPage();await graphicsLifecycle.goto(origin + '/tests/fixtures/graphic-campus-probe.html');
    await graphicsLifecycle.addScriptTag({url:origin+'/graphic-design-3d.js?v=5'});
    await graphicsLifecycle.evaluate(()=>{
      window.qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>qaHidden});
      window.qaFrames=new Map();window.qaFrameId=0;
      window.requestAnimationFrame=callback=>{const id=++qaFrameId;qaFrames.set(id,callback);return id;};
      window.cancelAnimationFrame=id=>qaFrames.delete(id);
      const host=document.createElement('div');host.id='qa-three-lifecycle';document.body.append(host);
      window.qaThree=HHGraphic3D.mount(host,{storage:null});
      qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));
    });
    await graphicsLifecycle.waitForFunction(()=>!!window.qaThree?.getMetrics?.()||/dự phòng|fallback|không khả dụng/i.test(document.querySelector('[data-g3d-engine-badge]')?.textContent||''),null,{timeout:45000});
    const graphicsState=await graphicsLifecycle.evaluate(()=>{
      const active=qaFrames.size;qaThree.destroy();return{active,remaining:qaFrames.size,empty:document.querySelector('#qa-three-lifecycle').innerHTML===''};
    });
    assert.deepEqual(graphicsState,{active:1,remaining:0,empty:true});await graphicsLifecycle.close();
    pass('Controlled deferred-IndexedDB Vector restore never flushes default over saved data; explicit edits flush on exit; visibility during actual Three initialization owns one RAF and cleanup leaves zero');
    // Synthetic known pixels enter the real original-asset IndexedDB path. No
    // runtime storage, encoder or export API is mocked in this isolated fixture.
    const fixture = await context.newPage(); await fixture.goto(origin + "/tests/fixtures/graphic-campus-probe.html");
    await fixture.waitForFunction(() => !!window.HHGraphicDesignUniversal);
    const assetResult = await fixture.evaluate(async () => {
      const api = HHGraphicDesignUniversal, canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 512, 768); ctx.fillStyle = '#0000ff'; ctx.fillRect(512, 0, 512, 768);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const accountId = 'qa-original-account';
      const asset = await api.assetRecordFromBlob(blob, 'synthetic-original.png', 'qa-known-pixels', accountId);
      let doc = api.defaultDocument({ id: 'qa-original-document', name: 'Original resolution fixture' });
      doc.canvas.width = doc.frames[0].width = 1024; doc.canvas.height = doc.frames[0].height = 768; doc.layers = []; doc.assets = [];
      doc = api.operation(doc, 'add-asset', asset);
      doc = api.operation(doc, 'add-layer', { type: 'image', name: 'Known pixels', assetId: asset.id, frameId: doc.frames[0].id, x: 0, y: 0, width: 1024, height: 768, metadata: { dataUrl: asset.thumbnail } });
      const prepared = await api.prepareExportSVG(doc, { accountId });
      const img = new Image(), svgUrl = URL.createObjectURL(new Blob([prepared.svg], { type: 'image/svg+xml' }));
      img.src = svgUrl; await img.decode(); const rendered = document.createElement('canvas'); rendered.width = prepared.width; rendered.height = prepared.height;
      rendered.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(svgUrl);
      const png = await new Promise(resolve => rendered.toBlob(resolve, 'image/png')), decoded = await createImageBitmap(png);
      const pixels = rendered.getContext('2d');
      const packaged = await api.exportPackage(doc, { accountId });
      window.qaPortablePackage = packaged;
      return { original: [asset.width, asset.height], png: [decoded.width, decoded.height], left: [...pixels.getImageData(100, 100, 1, 1).data], right: [...pixels.getImageData(900, 100, 1, 1).data], package: packaged, assetId: asset.id, checksum: asset.checksum, dimensions: [prepared.width, prepared.height] };
    });
    assert.deepEqual(assetResult.original, [1024, 768]); assert.deepEqual(assetResult.png, [1024, 768]); assert.deepEqual(assetResult.dimensions, [1024, 768]);
    assert.deepEqual(assetResult.left, [255, 0, 0, 255]); assert.deepEqual(assetResult.right, [0, 0, 255, 255]);
    const clean = await browser.newContext({ serviceWorkers: 'block' }); await configure(clean);
    const importedPage = await clean.newPage(); await importedPage.goto(origin + '/tests/fixtures/graphic-campus-probe.html'); await importedPage.waitForFunction(() => !!window.HHGraphicDesignUniversal);
    const restored = await importedPage.evaluate(async ({ packaged, oldId, checksum }) => {
      const api = HHGraphicDesignUniversal, accountId = 'qa-import-account';
      const imported = await api.importPackage(packaged, { accountId, documentId: 'qa-import-document' });
      const asset = imported.assets[0], record = await api.getAssetBlob(asset.id, accountId);
      const decoded = await createImageBitmap(record.blob);
      const preflight = await api.exportPreflight(imported, { accountId });
      const crossAccount = await api.getAssetBlob(asset.id, 'other-account');
      return { id: imported.id, remapped: asset.id !== oldId, linked: imported.layers.some(layer => layer.assetId === asset.id), dimensions: [decoded.width, decoded.height], checksum: await api.checksumBlob(record.blob), expectedChecksum: checksum, ok: preflight.ok, crossAccount: !!crossAccount };
    }, { packaged: assetResult.package, oldId: assetResult.assetId, checksum: assetResult.checksum });
    assert.deepEqual(restored, { id: 'qa-import-document', remapped: true, linked: true, dimensions: [1024, 768], checksum: assetResult.checksum, expectedChecksum: assetResult.checksum, ok: true, crossAccount: false });
    await clean.close(); await fixture.close();
    pass("Real original1024×768 asset exports SVG→decodedPNG with exact known pixels; portablepackage imports into a clean browser context with remappedIDs, same checksum, full dimensions and account-isolated originals");
    assert.deepEqual(pageErrors, []); assert.deepEqual(cspErrors, []); assert.deepEqual(publicErrors, []);
    assert.ok(!backendDoubles.some(row => row.method === 'POST' && /\/api\/(ai|image|video|generate)/i.test(row.pathname)));
    pass("No uncaught JavaScript, shader/CSP or publicasset errors and no paidproviderPOST; backend unavailable is explicit test doubles only");
    await context.close();
  } catch (error) {
    for (const context of browser?.contexts() || []) for (const page of context.pages()) {
      console.error(await page.evaluate(() => ({ route: location.hash, view: document.querySelector('.graphic-design-studio')?.dataset.gdView, unavailable: [...document.querySelectorAll('.gd-engine-unavailable')].map(node => node.textContent), horizontal: [document.documentElement.scrollWidth, innerWidth] })).catch(() => 'Page unavailable'));
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: false }).catch(() => {});
    }
    throw error;
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results, routes, pageErrors, cspErrors, publicErrors, backendDoubles }, null, 2));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
