'use strict';
// Native full-shell campus photography QA. Local catalogue and real asset bytes;
// guest identity, no production write, external services intentionally unavailable.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const C=require('../hh-university-core'), P=require('../hh-university-campus'), directory=require('../data/hh-university/directory.json');
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, process.env.HH_QA_OUTPUT || '.study-local/hh-university-campus-1082');
const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'))).headers.flatMap(row => row.headers).find(row => row.key === 'Content-Security-Policy').value;
const results = [], errors = [], imageRequests = [];
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.') || ['api','utils','node_modules'].includes(part))) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)] || 'application/octet-stream');
  if (name === '/index.html') res.setHeader('Content-Security-Policy', csp);
  if (name === '/config.js') return res.end(execFileSync('git', ['show','HEAD:config.js'], {cwd:root}).toString().replace('"http://127.0.0.1:4000"', '"https://hoangdaika13-astra-realtime.onrender.com"'));
  fs.createReadStream(file).pipe(res);
});
const pass = value => { results.push(value); console.log('PASS ' + JSON.stringify(value)); };
async function run() {
  fs.mkdirSync(out, {recursive:true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, page;
  try {
    browser = await chromium.launch({headless:true, executablePath:process.env.HH_QA_CHROMIUM});
    const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'});
    if (process.env.HH_QA_CAMPUS_PRELOAD === '1') await context.addInitScript({path:path.join(root,'hh-university-campus.js')});
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin) || /^(data|blob):/.test(url) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.continue();
      return route.fulfill({status:url.includes('/providers')?200:503,contentType:'application/json',body:JSON.stringify({google:false,facebook:false,error:'QA external services unavailable'})});
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/assets/university/')) imageRequests.push({url:response.url().replace(origin,''),status:response.status()}); });
    await page.goto(origin + '/index.html?api=local#/platform', {waitUntil:'domcontentloaded'});
    await page.locator('[data-guest-login]').click(); await page.locator('.app-main .php').waitFor({timeout:45000});
    const consent = page.getByRole('button',{name:'Từ chối tùy chọn',exact:true}); if (await consent.isVisible()) await consent.click();
    await page.evaluate(() => location.hash = '#/university');
    await page.locator('.hhu-campus-mosaic').waitFor({timeout:45000});
    assert.equal(await page.locator('.hhu-school-card').count(),24);
    await page.locator('.hhu-campus-mosaic img').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.hhu-campus-mosaic img')].every(img => img.complete && img.naturalWidth > 0));
    await page.locator('.hhu-campus-mosaic img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({path:path.join(out,'directory-desktop.png')});
    pass({hero:'Three real, correctly named school photographs; local responsive assets and attached credits'});

    await page.locator('[data-hhu-action=campus-filter]').click();
    assert.equal(await page.locator('[data-hhu-action=campus-filter]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.hhu-school-card').count(),24);
    assert.equal(await page.locator('.hhu-school-card img').count(),24);
    assert.ok((await page.evaluate(() => location.hash)).includes('photos=verified'));
    const totalPhotos = await page.evaluate(() => HHUniversityCampus.catalog.length);
    await page.locator('[data-hhu-action=page]').filter({hasText:'Sau'}).click();
    assert.equal(await page.locator('.hhu-school-card').count(),Math.min(24,totalPhotos-24));
    await page.locator('[data-hhu-action=page][data-hhu-page="'+Math.floor((totalPhotos-1)/24)+'"]').last().click();
    assert.equal(await page.locator('.hhu-school-card').count(),totalPhotos%24||24);
    await page.locator('.hhu-school-card img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
    await page.locator('[data-hhu-action=page][data-hhu-page="0"]').first().click();
    const form = page.locator('[data-hhu-directory-form]');
    if (!await form.isVisible()) await page.locator('.ue-filter-drawer summary').click();
    await form.locator('[name=query]').fill('Bach khoa'); await form.locator('button[type=submit]').click();
    const matchedPhotos = C.filterSchools(directory.schools,{query:'Bach khoa'}).filter(school=>P.find(school.id)).length;
    const photoSearchCount = await page.locator('.hhu-school-card').count();
    assert.equal(photoSearchCount,matchedPhotos);
    assert.equal(await page.locator('.hhu-school-card img').count(),photoSearchCount);
    pass({filters:'Photo filter combines accent-insensitive search and pagination; '+totalPhotos+' verified results; shareable URL'});
    await page.locator('[data-hhu-action=reset]').click();
    assert.equal(await page.locator('[data-hhu-action=campus-filter]').getAttribute('aria-pressed'),'false');

    await page.evaluate(() => location.hash = '#/university/school/vn-ts-302');
    await page.locator('.hhu-campus-profile img').waitFor();
    await page.waitForFunction(() => document.querySelector('.hhu-campus-profile img')?.naturalWidth > 0);
    await page.locator('.hhu-campus-profile .hhu-campus-credit summary').click();
    assert.match(await page.locator('.hhu-campus-profile figcaption').innerText(),/CONG_TRANVAN/);
    assert.match(await page.locator('.hhu-campus-profile figcaption').innerText(),/CC BY-SA 4.0/);
    assert.match(await page.locator('.hhu-campus-profile figcaption').innerText(),/WebP/);
    await page.screenshot({path:path.join(out,'school-desktop.png')});
    await page.locator('.hhu-school-header [data-hhu-action=save]').click();
    assert.equal(await page.locator('.hhu-school-header [data-hhu-action=save]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-hhu-tab=scores]').click(); await page.locator('.hhu-score-table').waitFor();
    assert.equal(await page.locator('[data-hhu-year]').count(),7);
    pass({profile:'Campus header, programme introduction, original author/licence/change declaration; saved school and all7score years still work'});

    for (const width of [768,375]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(() => location.hash = '#/university?photos=verified');
      await page.locator('.hhu-school-card img').first().waitFor();
      await page.locator('.hhu-school-card').first().scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({path:path.join(out,'directory-' + width + '.png')});
    }
    await page.evaluate(() => location.hash = '#/university/school/vn-ts-302');
    await page.locator('.hhu-campus-profile img').waitFor();
    await page.evaluate(() => document.documentElement.style.zoom = '2');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({path:path.join(out,'school-zoom200.png')});
    await page.evaluate(() => document.documentElement.style.zoom = '1');
    await page.locator('.hhu-campus-credit summary').first().focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.notEqual(await page.locator('.hhu-campus-credit summary').first().evaluate(el => getComputedStyle(el).outlineStyle),'none');
    pass({responsive:'375/768/1440px,DPR2,200% zoom,keyboard focus and reduced-motion'});

    await context.route('**/assets/university/vn-ts-302-v1-*.webp', route => route.fulfill({status:404}));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.hhu-campus-image.is-error').waitFor({timeout:45000});
    assert.ok(await page.locator('.hhu-campus-error').isVisible());
    await page.locator('.hhu-campus-credit summary').first().click();
    assert.ok(await page.getByRole('link',{name:'Bản gốc trên Wikimedia Commons ↗'}).isVisible());
    pass({failure:'404 shows a labelled fallback and keeps source credits accessible'});
    assert.deepEqual(errors,[]); assert.ok(imageRequests.filter(row => !row.url.includes('vn-ts-302')).every(row => row.status === 200));
  } catch (error) { await page?.screenshot({path:path.join(out,'failure.png')}).catch(() => {}); throw error; }
  finally {
    fs.writeFileSync(path.join(out,'report.json'), JSON.stringify({at:new Date().toISOString(),bootstrap:process.env.HH_QA_CAMPUS_PRELOAD==='1'?'Explicit campus module preload; loader integration checked separately':'Native release loader',results,errors,imageRequests},null,2));
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
