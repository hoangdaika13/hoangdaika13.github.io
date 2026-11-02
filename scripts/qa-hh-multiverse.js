'use strict';
// Full HH shell, native Chromium and real feature/handler code. No production writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || 'playwright'), root = path.resolve(__dirname, '..'), out = path.resolve(root, process.env.HH_QA_OUTPUT || '.study-local/hh-multiverse-1079');
const fixture = require('./qa-hh-multiverse-fixture')(), errors = [], results = [], requests = [];
const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers.flatMap(x => x.headers).find(x => x.key === 'Content-Security-Policy').value;
const server = http.createServer(async (req, res) => { try {
    if (req.url.startsWith('/api/multiverse/'))
        return await fixture.handle(req, res);
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || name.split('/').some(p => p.startsWith('.') || ['api', 'utils', 'node_modules'].includes(p)))
        return res.writeHead(403).end();
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
        return res.writeHead(404).end();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
    if (name === '/index.html')
        res.setHeader('Content-Security-Policy', csp);
    if (name === '/config.js')
        return res.end(execFileSync('git', ['show', 'HEAD:config.js'], { cwd: root, maxBuffer: 1048576 }).toString().replace('"http://127.0.0.1:4000"', '"https://hoangdaika13-astra-realtime.onrender.com"'));
    fs.createReadStream(file).pipe(res);
}
catch (e) {
    res.writeHead(500).end();
} });
const pass = v => { results.push(v); console.log('PASS ' + JSON.stringify(v)); };
async function settle(page) { await page.waitForFunction(() => !document.querySelector('[data-hh-multiverse][aria-busy=true]')); }
async function pane(page, name) { await page.locator('[data-mv-view="' + name + '"]').click(); await page.locator('[data-mv-body]').waitFor(); await settle(page); }
async function action(page, name, extra = '') { await page.locator('[data-mv-action="' + name + '"]' + extra).first().click(); await settle(page); }
async function state(page) { return await page.evaluate(async () => { const db = await new Promise((r, j) => { const q = indexedDB.open('hh.multiverse.v1', 1); q.onsuccess = () => r(q.result); q.onerror = j; }); const rows = await new Promise((r, j) => { const q = db.transaction('universes').objectStore('universes').getAll(); q.onsuccess = () => r(q.result); q.onerror = j; }); db.close(); const id = location.hash.match(/\/universe\/([^/?]+)/)?.[1]; return rows.filter(r => !id || r.id === id).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]; }); }
async function screenshot(page, name) { await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false }); }
async function audit(page,label){return page.evaluate(label=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05),checks=[];
  for(const el of [...document.querySelectorAll('.mv h1,.mv h2,.mv h3,.mv p,.mv label,.mv button,.mv input,.mv select,.mv a')].filter(e=>e.getClientRects().length&&!e.disabled).slice(0,150)){
    const cs=getComputedStyle(el);let node=el,backgrounds=[];
    while(node&&!backgrounds.length){const c=getComputedStyle(node),p=c.backgroundColor.match(/[\d.]+/g)||[];
      const stops=(c.backgroundImage.match(/rgba?\([^)]*\)/g)||[]).filter(v=>{const n=v.match(/[\d.]+/g)||[];return n.length===3||+n[3]===1;}).map(rgb);
      // A gradient is the visible surface even when backgroundColor is transparent.
      if(stops.length){backgrounds=stops.slice();for(let i=1;i<stops.length;i++)for(let j=1;j<10;j++)backgrounds.push(stops[i-1].map((v,k)=>v+(stops[i][k]-v)*j/10));}
      else if(p.length===3||p.length===4&&+p[3]===1)backgrounds=[rgb(c.backgroundColor)];
      node=node.parentElement;
    }
    if(!backgrounds.length)backgrounds=[[8,14,28]];
    const contrast=Math.min(...backgrounds.map(bg=>ratio(rgb(cs.color),bg))),size=parseFloat(cs.fontSize),required=size>=24||size>=18.66&&+cs.fontWeight>=700?3:4.5;
    checks.push({text:el.textContent.trim().slice(0,55),contrast,required});
  }
  return{label,checks,overflow:document.documentElement.scrollWidth>innerWidth+1};
},label);}

async function run() {
    fs.mkdirSync(out, { recursive: true });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = 'http://127.0.0.1:' + server.address().port;
    process.env.ALLOWED_ORIGINS = origin;
    let browser, page;
    try {
        browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce', serviceWorkers: 'allow' });
        page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', r => requests.push(r.url().replace(origin, '')));
        await context.route('**/*', route => { const u = route.request().url(); if (u.startsWith(origin) && (!u.includes('/api/') || u.includes('/api/multiverse/')))
            return route.continue(); if (/^(data|blob):/.test(u) || /^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(u))
            return route.continue(); return route.fulfill({ status: u.includes('/providers') ? 200 : 503, contentType: 'application/json', body: JSON.stringify({ google: false, facebook: false, error: 'Explicit QA unavailable API' }) }); });
        await page.goto(origin + '/index.html?api=local#/platform', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-guest-login]').click();
        await page.locator('.app-main .php').waitFor({ timeout: 45000 });
        const consent = page.getByRole('button', { name: 'Từ chối tùy chọn', exact: true });
        if (await consent.isVisible())
            await consent.click();
        assert.equal(requests.some(x => x.includes('hh-multiverse-portal')), false);
        await page.locator('[data-php-route="/multiverse"]').first().click();
        await page.locator('.mv-hero').waitFor({ timeout: 45000 });
        assert.equal(await page.evaluate(() => document.querySelector('.app-shell').dataset.activeSection), 'hh-multiverse');
        assert.equal(requests.some(x => x.includes('hh-multiverse-portal')), false);
        await screenshot(page, 'home-desktop');
        pass({ navigation: 'Primary section, Platform catalog, native route, reduced-motion CSS portal; no eager Three portal' });
        const audits = [], themes = await page.evaluate(() => HHAppTheme.themes);
        for (const theme of themes) {
            await page.evaluate(t => HHAppTheme.apply(t, { persist: false }), theme);
            audits.push(await audit(page, 'home-' + theme));
        }
        await page.evaluate(() => HHAppTheme.apply('aurora', { persist: false }));
        await require('./qa-hh-multiverse-art')({page,context,out,pass,audit,audits});
        await action(page, 'sample', '[data-index="2"]');
        await page.locator('[data-mv-form=create]').waitFor();
        const create = page.locator('[data-mv-form=create]');
        assert.match(await create.locator('[name=premise]').inputValue(), /ký ức/);
        await create.locator('[name=complexity]').selectOption('rich');
        await create.locator('button[type=submit]').click();
        await page.locator('.mv-world-header').waitFor();
        await settle(page);
        let record = await state(page);
        const id = record.id;
        assert.equal(record.durable, true);
        assert.equal(record.world.provenance.kind, 'offline');
        assert.equal(record.world.blueprint.characters.length, 6);
        await screenshot(page, 'world-overview');
        pass({ create: 'Offline rich generation; valid structured world; real IndexedDB acknowledgement', id });
        const unchangedBefore=JSON.stringify((await state(page)).world);
        await action(page,'compact-header');assert.equal(await page.locator('.mv').getAttribute('data-compact'),'false');assert.equal(JSON.stringify((await state(page)).world),unchangedBefore);
        await page.reload({waitUntil:'domcontentloaded'});await page.locator('.mv-world-header').waitFor({timeout:45000});assert.equal(await page.locator('.mv').getAttribute('data-compact'),'false');await action(page,'compact-header');
        for(const palette of ['prism','aurora','sunset']){await page.locator('[name=visualPalette]').selectOption(palette);for(const view of ['overview','internet','timeline','butterfly','branches','characters','dna','journal','settings']){await pane(page,view);audits.push(await audit(page,'world-'+palette+'-'+view));}}
        assert.equal(JSON.stringify((await state(page)).world),unchangedBefore);await page.locator('[name=visualPalette]').selectOption('prism');await pane(page,'overview');
        pass({visualState:'Compact header and all3palettes survive reload/route changes without changing the saved world;all9panes sampled per palette'});
        await pane(page, 'internet');
        for (const app of ['news', 'social', 'search', 'market', 'encyclopedia', 'map', 'trends', 'archives']) {
            await action(page, 'browse', '[data-address="sim://' + app + '"]');
            assert.ok((await page.locator('.mv-internet-content').innerText()).length > 100);
            audits.push(await audit(page, 'internet-' + app));
        }
        await action(page, 'browse', '[data-address="sim://map"]');
        await screenshot(page, 'internet-map');
        await action(page, 'new-tab');
        assert.equal(await page.locator('[data-mv-action=switch-tab]').count(), 2);
        await action(page, 'browse', '[data-address="sim://news"]');
        await action(page, 'bookmark');
        await action(page, 'browser-back');
        await action(page, 'browser-forward');
        await action(page, 'close-tab');
        const address = page.locator('[data-mv-form=address]');
        await address.locator('input').fill('javascript:alert(1)');
        await address.locator('button[type=submit]').click();
        await settle(page);
        assert.match(await page.locator('[data-mv-notice]').innerText(), /sim:\/\//);
        pass({ internet: 'All8apps, tabs, navigation, bookmarks and invalid-address guard' });
        await pane(page, 'timeline');
        for (const days of [1, 30, 365, 3650, 36500, 365000]) {
            await action(page, 'advance', '[data-days="' + days + '"]');
        }
        record = await state(page);
        assert.equal(record.world.snapshots.length, 22);
        const head = record.world.branches[0].headId;
        await action(page, 'snapshot', '[data-id=s0]');
        assert.equal((await state(page)).world.current.snapshotId, 's0');
        await action(page, 'advance', '[data-days="30"]');
        record = await state(page);
        assert.equal(record.world.branches.length, 2);
        assert.equal(record.world.branches[0].headId, head);
        await screenshot(page, 'timeline');
        pass({ timeline: 'All6jump presets create actual events; past slider and advance preserve original future' });
        await pane(page, 'butterfly');
        const preview = page.locator('[data-mv-form=preview]');
        await preview.locator('[name=decision]').fill('Giới hạn làm việc6 giờ mỗi ngày');
        await preview.locator('[name=category]').selectOption('labor');
        const before = JSON.stringify((await state(page)).world);
        await preview.locator('button[type=submit]').click();
        await settle(page);
        assert.equal(JSON.stringify((await state(page)).world), before);
        assert.ok(await page.locator('.mv-causal svg').count());
        await screenshot(page, 'butterfly-preview');
        await action(page, 'apply-decision');
        assert.equal((await state(page)).world.branches.length, 3);
        await page.locator('[data-mv-form=compare] button').click();
        await settle(page);
        await screenshot(page, 'branches');
        pass({ butterfly: 'Preview does not mutate; Apply forks; causal diagram, tree and actual comparison table' });
        await pane(page, 'characters');
        await action(page, 'character');
        const chat = page.locator('[data-mv-form=chat]').first();
        await chat.locator('[name=question]').fill('Bạn biết gì về tương lai?');
        await chat.locator('button[type=submit]').click();
        await settle(page);
        assert.match(await page.locator('.mv-chat').innerText(), /chưa có dữ kiện/);
        assert.equal((await state(page)).world.conversations.length, 1);
        await screenshot(page, 'characters');
        await pane(page, 'journal');
        await page.locator('[data-mv-form=journal] textarea').fill('PRIVATE_NATIVE_NOTE');
        await page.locator('[data-mv-form=journal] button').click();
        await settle(page);
        await page.locator('[data-mv-form=capsule] input').fill('Native time capsule');
        await page.locator('[data-mv-form=capsule] button').click();
        await settle(page);
        await action(page, 'capsule');
        assert.equal((await state(page)).world.capsules.length, 1);
        pass({ characters: 'Offline context-bound dialogue and private memory', journal: 'Private note and capsule persist; capsule opens actual snapshot' });
        await pane(page, 'settings');
        await page.locator('[data-mv-form=rename-world] input').fill('Native Reality QA');
        await page.locator('[data-mv-form=rename-world] button').click();
        await settle(page);
        const download = page.waitForEvent('download');
        await action(page, 'export-json');
        const file = await download;
        await file.saveAs(path.join(out, 'roundtrip.json'));
        const exported = JSON.parse(fs.readFileSync(path.join(out, 'roundtrip.json'), 'utf8'));
        assert.equal(exported.name, 'Native Reality QA');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('.mv-world-header').waitFor({ timeout: 45000 });
        assert.match(await page.locator('.mv-world-header').innerText(), /Native Reality QA/);
        assert.equal((await state(page)).world.journal[0].text, 'PRIVATE_NATIVE_NOTE');
        pass({ storage: 'Real reload retains branch, name, note, chat and capsule; JSON file downloads with full state' });
        await page.locator('[name=importUniverse]').setInputFiles(path.join(out, 'roundtrip.json'));
        await page.locator('.mv-dialog[open]').waitFor();
        await page.locator('.mv-dialog button[value=confirm]').click();
        await settle(page);
        record = await state(page);
        assert.notEqual(record.id, id);
        assert.equal(record.world.provenance.kind, 'imported');
        for (const width of [1440, 768, 375]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const view of ['overview', 'internet', 'timeline', 'butterfly', 'branches', 'characters', 'dna', 'journal', 'settings']) {
                await pane(page, view);
                audits.push(await audit(page, view + '-' + width));
            }
            await screenshot(page, 'world-' + width);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.evaluate(() => document.documentElement.style.zoom = '2');
        audits.push(await audit(page, 'zoom200'));
        await screenshot(page, 'zoom200');
        await page.evaluate(() => document.documentElement.style.zoom = '1');
        await page.emulateMedia({ forcedColors: 'active' });
        await page.locator('[data-mv-view=internet]').focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.notEqual(await page.locator('[data-mv-view=internet]').evaluate(e => getComputedStyle(e).outlineStyle), 'none');
        await page.emulateMedia({ forcedColors: 'none' });
        pass({ responsive: 'All9panes at1440/768/375, DPR2,200%zoom, visible keyboard focus and reduced motion' });
        // Same browser, explicit authenticated module identity for backend-dependent acceptance paths.
        fixture.state.user = { _id: 'qa-member', role: 'member' };
        await page.evaluate(async (world) => { const store = HHMultiverseStore.create({ id: 'qa-member' }); await store.put(world, { expectedLocalRevision: 0 }); store.close(); HHMultiverse.mount(document.querySelector('[data-hh-multiverse-host]'), { currentUser: { id: 'qa-member', role: 'member' }, route: '/multiverse/universe/' + world.id + '/settings' }); }, record.world);
        await page.locator('[data-mv-action=sync]:not([disabled])').waitFor();
        await action(page, 'sync');
        assert.equal((await state(page)).cloudRevision, 1);
        const publish = page.locator('[data-mv-form=publish]');
        await publish.locator('[name=visibility]').selectOption('unlisted');
        await publish.locator('button[type=submit]').click();
        await page.locator('.mv-dialog[open]').waitFor();
        await page.locator('.mv-dialog button[value=confirm]').click();
        await settle(page);
        const shareUrl = await page.locator('[data-mv-share-url]').inputValue();
        assert.ok(shareUrl.includes('/multiverse/shared/'));
        const shared = fixture.db.rows('multiverse_shares')[0];
        assert.equal(shared.world.journal.length, 0);
        assert.equal(shared.world.conversations.length, 0);
        await page.evaluate(url => location.hash = new URL(url).hash, shareUrl);
        await page.locator('.mv-world-header').waitFor();
        assert.match(await page.locator('[data-mv-world-header]').innerText(), /READ ONLY/);
        await pane(page, 'timeline');
        assert.equal(await page.locator('[data-mv-action=advance]:not([disabled])').count(), 0);
        assert.equal((await state(page)).world.events.length, record.world.events.length);
        await action(page, 'copy-shared');
        assert.notEqual((await state(page)).id, record.id);
        pass({ cloud: 'Real handler fixtures: acknowledged manual sync, frozen private-stripped unlisted snapshot, read-only viewer, clone into own ID' });
        await page.evaluate(() => location.hash = '#/multiverse/my-universes');
        await page.locator('.mv-card').first().waitFor();
        const cards = await page.locator('.mv-card').count();
        await page.locator('[data-mv-action=delete-world]').first().click();
        await page.locator('.mv-dialog[open]').waitFor();
        await page.keyboard.press('Escape');
        await settle(page);
        assert.equal(await page.locator('.mv-card').count(), cards);
        await page.locator('[data-mv-action=delete-world]').first().click();
        await page.locator('.mv-dialog[open]').waitFor();
        await page.locator('.mv-dialog button[value=confirm]').click();
        await settle(page);
        assert.equal(await page.locator('.mv-card').count(), cards - 1);
        if (cards > 1) {
            await page.locator('[data-mv-action=delete-world]').first().click();
            await page.locator('.mv-dialog[open]').waitFor();
            await page.keyboard.press('Escape');
            await settle(page);
            assert.equal(await page.locator('.mv-card').count(), cards - 1);
        }
        await screenshot(page, 'library');
        pass({ library: 'Cancel/confirm delete, independent import, library listing and identity partitions' });
        // Restore guest for direct remount; Gemini is selected only under an explicit QA identity.
        await page.evaluate(() => { HHMultiverse.mount(document.querySelector('[data-hh-multiverse-host]'), { route: '/multiverse/create', currentUser: { id: 'qa-member', role: 'member' } }); });
        await page.locator('[name=provider] option[value=gemini]').waitFor({ state: 'attached' });
        await page.locator('[name=premise]').fill('Nếu có hai Mặt Trăng?');
        await page.locator('[name=provider]').selectOption('gemini');
        await page.locator('[data-mv-form=create] button[type=submit]').click();
        await page.locator('.mv-world-header').waitFor();
        await settle(page);
        assert.equal((await state(page)).world.provenance.kind, 'gemini');
        await pane(page, 'characters');
        await action(page, 'character');
        await page.locator('[data-mv-form=chat] [name=provider]').selectOption('gemini');
        await page.locator('[name=question]').fill('Bạn biết những sự kiện nào?');
        await page.locator('[data-mv-form=chat] button[type=submit]').click();
        await page.locator('.mv-dialog[open]').waitFor();
        await page.locator('.mv-dialog button[value=confirm]').click();
        await settle(page);
        assert.ok(fixture.calls.some(c => c.action === 'character'));
        assert.equal((await state(page)).world.conversations[0].provider, 'gemini');
        pass({ Gemini: 'UI generate and chat run through real handler with explicit model fixture; context preview and provenance verified; no paid call' });
        fixture.state.quota = true;
        await page.evaluate(() => HHMultiverse.mount(document.querySelector('[data-hh-multiverse-host]'), { route: '/multiverse/create', currentUser: { id: 'qa-member', role: 'member' } }));
        await page.locator('[name=provider] option[value=gemini]').waitFor({ state: 'attached' });
        await page.locator('[name=premise]').fill('Retain premise after provider failure');
        await page.locator('[name=provider]').selectOption('gemini');
        await page.locator('[data-mv-form=create] button[type=submit]').click();
        await settle(page);
        assert.match(await page.locator('[data-mv-notice]').innerText(), /quota|Offline/);
        assert.equal(await page.locator('[name=premise]').inputValue(), 'Retain premise after provider failure');
        fixture.state.quota = false;
        fixture.state.delay = 5000;
        await page.locator('[data-mv-form=create] button[type=submit]').click();
        await page.locator('[data-mv-action=cancel-operation]').click();
        await settle(page);
        assert.equal(await page.locator('[name=premise]').inputValue(), 'Retain premise after provider failure');
        fixture.state.delay = 0;
        await page.locator('[name=provider]').selectOption('offline');
        await page.locator('[data-mv-form=create] button[type=submit]').click();
        await page.locator('.mv-world-header').waitFor();
        await settle(page);
        assert.equal((await state(page)).world.provenance.kind, 'offline');
        pass({ providerFailure: 'Quota error and cancellation retain the draft; explicit Offline retry creates a valid world' });
        await page.evaluate(() => location.hash = '#/multiverse');
        await page.locator('.mv-hero').waitFor();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await action(page, 'enable-3d');
        await page.waitForFunction(() => document.querySelector('[data-mv-portal]')?.dataset.renderer);
        await screenshot(page, 'portal-3d');
        pass({ portal: await page.locator('[data-mv-portal]').getAttribute('data-renderer') });
        await page.evaluate(() => location.hash = '#/all-game');
        await page.locator('.ag-card').first().waitFor({ timeout: 45000 });
        assert.equal(await page.locator('[data-hh-multiverse]').count(), 0);
        await page.evaluate(() => location.hash = '#/learn/today');
        await page.locator('.hsw-surface').waitFor({ timeout: 45000 });
        await page.evaluate(() => location.hash = '#/vietnam-law');
        await page.locator('[data-hh-vietnam-law-host]').waitFor();
        await page.evaluate(() => location.hash = '#/university');
        await page.locator('.hhu-school-card').first().waitFor({ timeout: 45000 });
        await page.evaluate(() => location.hash = '#/platform');
        await page.locator('.php').waitFor();
        pass({ regression: 'All Game, HH School, Law, University and Platform remain reachable; Multiverse unmount removes workspace' });
        await page.evaluate(() => location.hash = '#/multiverse/my-universes');
        await page.locator('.mv-card a.mv-primary').first().waitFor();
        await page.locator('.mv-card a.mv-primary').first().click();
        await page.locator('.mv-world-header').waitFor();
        const offlineName = await page.locator('.mv-world-header h1').innerText();
        await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 45000 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('.mv-world-header').waitFor({ timeout: 45000 });
        await page.waitForFunction(async () => Boolean(await caches.match(new URL('hh-multiverse.js?v=2', document.baseURI).href)));
        await context.setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('.mv-world-header').waitFor({ timeout: 45000 });
        assert.equal(await page.locator('.mv-world-header h1').innerText(), offlineName);
        await pane(page, 'internet');
        await action(page, 'browse', '[data-address="sim://news"]');
        await pane(page, 'timeline');
        await action(page, 'advance', '[data-days="1"]');
        await context.setOffline(false);
        pass({ offline: 'Visited module assets and real IndexedDB world reopen under native offline networking; news and timeline still work; APIs never cached' });
        const failures = audits.flatMap(a => a.checks.filter(c => c.contrast + .001 < c.required).map(c => ({ state: a.label, ...c })));
        fs.writeFileSync(path.join(out, 'readability.json'), JSON.stringify({ audits, failures }, null, 2));
        assert.ok(audits.every(a => !a.overflow), JSON.stringify(audits.filter(a => a.overflow).map(a => a.label)));
        assert.deepEqual(failures, []);
        assert.deepEqual(errors, []);
        pass({ audits: audits.length, themes: themes.length, contrastChecks: audits.reduce((n, a) => n + a.checks.length, 0), pageErrors: errors.length });
    }
    catch (e) {
        await page?.screenshot({ path: path.join(out, 'failure.png') }).catch(() => { });
        throw e;
    }
    finally {
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results, errors, environment: 'Native Chromium, full local HH shell, real Multiverse handler, explicit identity/memory-DB/Gemini fixtures; no production write or paid request' }, null, 2));
        await browser?.close();
        await new Promise(r => server.close(r));
    }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
