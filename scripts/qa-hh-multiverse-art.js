'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
module.exports = async function ({ page, out, pass, audit, audits }) {
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-hh-multiverse][aria-busy=true]'));
  const go = async route => { await page.evaluate(r => { location.hash = r; }, route); await page.locator('[data-hh-multiverse]').waitFor({ timeout: 45000 }); };
  const action = async (name, extra = '') => { await page.locator('[data-mv-action="' + name + '"]' + extra).first().click(); await settle(); };
  const category = kind => action('gallery-filter', '[data-kind="' + kind + '"]');
  const search = async (q = '', tone = 'all', theme = 'all') => { const form = page.locator('[data-mv-form=gallery-search]'); await form.locator('[name=q]').fill(q); await form.locator('[name=tone]').selectOption(tone); await form.locator('[name=theme]').selectOption(theme); await form.locator('button[type=submit]').click(); await settle(); };
  const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.mvg').waitFor({ timeout: 45000 }); await settle(); };
  const mount = async user => { await page.evaluate(user => HHMultiverse.mount(document.querySelector('[data-hh-multiverse-host]'), { route: '/multiverse/gallery?category=world', currentUser: user }), user); await page.locator('.mvg').waitFor({ timeout: 45000 }); await settle(); };
  const originalUser = await page.evaluate(() => HHAuthz.currentUser());
  const savedCollections = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hh.multiverse.art-collection.v1:')).map(k => [k, localStorage.getItem(k)])));
  let catalogue;
  try {
    await page.locator('.mv-topbar a[href="#/multiverse/gallery"]').click(); await page.locator('.mvg').waitFor();
    catalogue = await page.evaluate(() => ({ total: HHMultiverseArt.catalog.length, sizes: Object.fromEntries(['world', 'experience', 'portrait', 'scene'].map(k => [k, HHMultiverseArt.list(k).length])), pageSize: HHMultiverseGallery.PAGE_SIZE }));
    assert.equal(await page.locator('.mv-gallery-card').count(), Math.min(catalogue.pageSize, catalogue.total));
    const images = await page.evaluate(() => HHMultiverseArt.catalog.flatMap(a => a.widths.map(w => ({ url: HHMultiverseArt.url(a.id, w), width: w }))));
    const decoded = await page.evaluate(async images => {
      let cursor = 0; const output = [];
      // Four decoders bound peak bitmap memory while checking every published file.
      async function worker() { while (cursor < images.length) { const asset = images[cursor++], res = await fetch(asset.url); if (!res.ok) throw Error(asset.url + ' ' + res.status); const bitmap = await createImageBitmap(await res.blob()); output.push({ url: asset.url, width: bitmap.width, expected: asset.width, height: bitmap.height }); bitmap.close(); } }
      await Promise.all(Array.from({ length: 4 }, worker)); return output;
    }, images);
    assert.equal(decoded.length, images.length); assert.ok(decoded.every(x => x.width === x.expected && x.height > 0));
    await page.screenshot({ path: path.join(out, 'gallery-desktop.png') });
    const themes = await page.evaluate(() => HHAppTheme.themes);
    for (const palette of ['prism', 'aurora', 'sunset']) {
      await page.locator('[name=visualPalette]').selectOption(palette); assert.equal(await page.locator('.mv').getAttribute('data-palette'), palette);
      for (const theme of themes) { await page.evaluate(t => HHAppTheme.apply(t, { persist: false }), theme); audits.push(await audit(page, 'gallery-' + palette + '-' + theme)); }
      await page.evaluate(() => HHAppTheme.apply('aurora', { persist: false })); await page.screenshot({ path: path.join(out, 'gallery-' + palette + '.png') });
    }
    await reload(); assert.equal(await page.locator('.mv').getAttribute('data-palette'), 'sunset');

    await category('world'); assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.sizes.world);
    await search('MAT TRANG', 'cyan'); assert.equal(await page.locator('.mv-gallery-card').count(), 1); assert.equal(await page.locator('.mv-gallery-card').getAttribute('data-id'), 'moons');
    await search('MAT TRANG', 'pink'); assert.equal(await page.locator('.mv-gallery-card').count(), 0); assert.match(await page.locator('.mvg-empty').innerText(), /Chưa có ảnh phù hợp/);
    await search('MAT TRANG', 'cyan'); await action('gallery-favorite', '[data-id=moons]');
    assert.equal(await page.locator('[data-mv-action=gallery-favorite][data-id=moons]').getAttribute('aria-pressed'), 'true');
    const guestKey = await page.evaluate(user => HHMultiverseGallery.collectionKey(user), originalUser);
    assert.ok(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).favorites.includes('moons'), guestKey));
    await reload(); await action('gallery-favorites'); assert.equal(await page.locator('.mv-gallery-card').count(), 1); assert.equal(await page.locator('.mv-gallery-card').getAttribute('data-id'), 'moons');
    await action('gallery-favorites'); await search();

    await category('scene');
    assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.pageSize);
    const firstIds = await page.locator('.mv-gallery-card').evaluateAll(rows => rows.map(e => e.dataset.id));
    await action('gallery-page', '[data-page="2"]'); const secondIds = await page.locator('.mv-gallery-card').evaluateAll(rows => rows.map(e => e.dataset.id));
    assert.ok(secondIds.every(id => !firstIds.includes(id)));
    const last = Math.ceil(catalogue.sizes.scene / catalogue.pageSize);
    await action('gallery-page', '[data-page="' + last + '"]'); assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.sizes.scene % catalogue.pageSize || catalogue.pageSize);
    await search('', 'all', 'reef');
    assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.pageSize);
    assert.ok(await page.locator('.mv-gallery-card').evaluateAll(rows => rows.every(e => e.dataset.id.startsWith('scene-00'))));
    assert.match(await page.locator('[data-mvg-result]').innerText(), /100/);
    await page.screenshot({ path: path.join(out, 'gallery-scenes-reef.png') });
    await search('not-present-in-gallery-qa'); assert.equal(await page.locator('.mv-gallery-card').count(), 0); await search();

    await category('portrait'); assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.sizes.portrait);
    await action('open-art', '[data-id=portrait-0]'); await page.locator('.mv-art-dialog[open]').waitFor();
    assert.equal(await page.locator('.mv-art-dialog [data-art]').getAttribute('data-art'), 'portrait-0');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.mv-art-dialog [data-art]').getAttribute('data-art'), 'portrait-1');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('.mv-art-dialog [data-art]').getAttribute('data-art'), 'portrait-0');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('.mv-art-dialog [data-art]').getAttribute('data-art'), 'portrait-' + (catalogue.sizes.portrait - 1));
    await page.locator('.mv-art-dialog img').evaluate(img => img.decode()); await page.screenshot({ path: path.join(out, 'portrait-viewer.png') });
    const download = page.waitForEvent('download'); await page.locator('.mv-download-art').click(); const file = await download; await file.saveAs(path.join(out, 'art-download.webp')); assert.equal(fs.readFileSync(path.join(out, 'art-download.webp')).toString('ascii', 8, 12), 'WEBP');
    await page.keyboard.press('Escape'); await page.locator('.mv-art-dialog[open]').waitFor({ state: 'hidden' });
    assert.ok(await page.locator('[data-mv-action=open-art][data-id=portrait-0]').first().evaluate(e => e === document.activeElement));

    await category('world'); await action('open-art', '[data-id=moons]'); await action('art-create');
    await page.locator('[data-mv-form=create]').waitFor(); assert.match(await page.locator('[name=premise]').inputValue(), /Mặt Trăng/);
    await page.locator('[name=premise]').fill('Nếu thời gian trở thành tiền tệ?'); assert.equal(await page.locator('[data-mv-draft-art] [data-art]').getAttribute('data-art'), 'time');
    await page.locator('[name=visualPalette]').selectOption('aurora'); assert.equal(await page.locator('[name=premise]').inputValue(), 'Nếu thời gian trở thành tiền tệ?');
    await go('#/multiverse/gallery?category=world'); await page.locator('.mvg').waitFor(); await reload(); assert.equal(await page.locator('.mv-gallery-card').count(), catalogue.sizes.world); assert.equal(await page.locator('.mv').getAttribute('data-palette'), 'aurora');
    await page.locator('.mv-gallery-card[data-id=moons]').scrollIntoViewIfNeeded();
    await page.locator('.mv-gallery-card[data-id=moons] img').evaluate(img => { img.loading = 'eager'; img.removeAttribute('srcset'); img.src = './assets/multiverse/missing-qa-image.webp'; });
    await page.locator('.mv-gallery-card[data-id=moons] .mv-art-failed').waitFor({ timeout: 30000 }); assert.ok(await page.locator('.mv-gallery-card[data-id=moons]').evaluate(e => e.getBoundingClientRect().height > 200));
    for (const width of [768, 375]) {
      await page.setViewportSize({ width, height: 950 }); await reload(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); audits.push(await audit(page, 'gallery-' + width));
      await action('open-art'); await page.locator('.mv-art-dialog[open]').waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      for (const rect of await page.locator('.mv-art-dialog button,.mv-art-dialog a').evaluateAll(rows => rows.map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })))) assert.ok(rect.width >= 44 && rect.height >= 44);
      await page.locator('.mv-art-dialog img').evaluate(img => img.decode()); await page.screenshot({ path: path.join(out, 'viewer-' + width + '.png') }); await page.keyboard.press('Escape'); await page.screenshot({ path: path.join(out, 'gallery-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Explicit QA identities exercise the actual per-account controller/storage path.
    const memberA = { id: 'qa-art-member-a', role: 'member' }, memberB = { id: 'qa-art-member-b', role: 'member' };
    const guestValue = await page.evaluate(key => localStorage.getItem(key), guestKey);
    await mount(memberA); await action('gallery-favorites'); assert.equal(await page.locator('.mv-gallery-card').count(), 0); await action('gallery-favorites'); await action('gallery-favorite', '[data-id=moons]');
    await mount(memberB); await action('gallery-favorites'); assert.equal(await page.locator('.mv-gallery-card').count(), 0);
    await mount(memberA); await action('gallery-favorites'); assert.equal(await page.locator('.mv-gallery-card').count(), 1); assert.equal(await page.locator('.mv-gallery-card').getAttribute('data-id'), 'moons');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), guestKey), guestValue);
    const protectedUser = { id: 'qa-art-protected', role: 'member' };
    for (const raw of ['{"version":99,"favorites":["moons"]}', '{broken-json', '{"version":1,"favorites":"invalid"}']) {
      await page.evaluate(({ user, raw }) => localStorage.setItem(HHMultiverseGallery.collectionKey(user), raw), { user: protectedUser, raw });
      await mount(protectedUser); await action('gallery-favorite', '[data-id=moons]'); assert.equal(await page.locator('[data-mv-action=gallery-favorite][data-id=moons]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(user => localStorage.getItem(HHMultiverseGallery.collectionKey(user)), protectedUser), raw);
      assert.match(await page.locator('[data-mv-notice]').innerText(), /phiên|giữ nguyên/);
      await mount(protectedUser); assert.equal(await page.locator('[data-mv-action=gallery-favorite][data-id=moons]').getAttribute('aria-pressed'), 'false');
    }
    await mount(originalUser);
    const visual = await page.evaluate(user => { const key = HHMultiverseArt.preferenceKey(user), value = localStorage.getItem(key); localStorage.setItem(key, JSON.stringify({ version: 99, palette: 'sunset', compact: false })); return { key, value }; }, originalUser);
    await reload(); await page.locator('[name=visualPalette]').selectOption('sunset'); assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, visual.key), 99);
    await page.evaluate(({ key, value }) => { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }, visual);
    await action('open-art'); await page.evaluate(() => { location.hash = '#/platform'; }); await page.locator('.app-main .php').waitFor({ timeout: 45000 }); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.mv-art-dialog').count(), 0);
    await page.locator('[data-php-route="/multiverse"]').first().click(); await page.locator('.mv-hero').waitFor({ timeout: 45000 }); await page.locator('[name=visualPalette]').selectOption('prism');
    pass({ artwork: catalogue.total + ' original illustrations; all ' + decoded.length + ' responsive WebPs decoded', gallery: 'Search, accent folding, tone/theme/kind filters, empty state, scene pagination, favorites and per-account reload, keyboard viewer/download/focus return,375/768layouts', palettes: 'All3palettes across platform themes; reload and future preference protection', recovery: 'Corrupt/future collections are preserved while session favorites work;404 retains stable fallback; unmount removes modal/listener' });
  }
  finally {
    await page.evaluate(saved => { for (const key of Object.keys(localStorage).filter(k => k.startsWith('hh.multiverse.art-collection.v1:'))) if (!Object.hasOwn(saved, key)) localStorage.removeItem(key); for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value); }, savedCollections);
  }
};
