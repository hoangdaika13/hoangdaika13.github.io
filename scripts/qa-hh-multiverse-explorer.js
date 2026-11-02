'use strict';
// Called by the full-shell native Chromium QA after a world (or share) is open.
// The supplied world is the exact saved/shared snapshot, never a fabricated UI model.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const E = require('../hh-multiverse-engine'), X = require('../hh-multiverse-explorer');

module.exports = async function ({ page, world, readOnly = false, out, pass = () => {}, audit, audits = [] }) {
  assert.ok(world?.current?.snapshotId, 'Explorer QA requires the world that is currently open.');
  const prefix = readOnly ? 'explorer-shared' : 'explorer', originalHash = await page.evaluate(() => location.hash);
  const viewport = page.viewportSize(), originalZoom = await page.evaluate(() => document.documentElement.style.zoom);
  const expected = X.trend(world), expectedRows = X.entities(world), n = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-hh-multiverse][aria-busy=true]'));
  const pane = async name => { await page.locator('[data-mv-view="' + name + '"]').click(); await settle(); };
  const action = async (name, extra = '') => { await page.locator('.mvx [data-mv-action="' + name + '"]' + extra).first().click(); await settle(); };
  const screenshot = async name => { if (out) { fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: path.join(out, prefix + '-' + name + '.png') }); } };
  const checkHistory = async () => {
    const lines = await page.locator('.mvx-history polyline').evaluateAll(rows => rows.map(e => e.getAttribute('points').trim().split(/\s+/).length));
    assert.deepEqual(lines, [expected.points.length, expected.points.length, expected.points.length, expected.points.length]);
    assert.equal(await page.locator('.mvx-history circle').count(), expected.points.length * 4);
    const rows = await page.locator('.mvx-history tbody tr').evaluateAll(rows => rows.map(tr => [...tr.cells].map(c => c.textContent.trim())));
    assert.deepEqual(rows, expected.comparisons.map(r => [r.label, n(r.first), n(r.current), (r.delta > 0 ? '+' : '') + n(r.delta)]));
    assert.equal(expected.last.snapshotId, world.current.snapshotId);
    assert.deepEqual(expected.points.map(p => p.snapshotId), E.lineage(world, world.current.snapshotId).map(s => s.id));
  };
  const search = async (q, kind) => {
    const form = page.locator('[data-mv-form="explorer-search"]');
    await form.locator('[name=q]').fill(q); await form.locator('[name=kind]').selectOption(kind);
    await form.locator('button[type=submit]').click(); await settle();
  };
  try {
    await pane('explorer'); await page.locator('.mvx').waitFor();
    assert.equal(await page.locator('.mvx-place-buttons button').count(), world.blueprint.locations.length);
    await checkHistory();
    const target = world.blueprint.locations.find(l => l.id === world.blueprint.characters[0].locationId);
    await search(target.name, 'location');
    assert.equal(await page.locator('.mvx-results article').count(), X.entities(world, { query: target.name, kind: 'location' }).length);
    await action('explorer-location', '[data-id="' + target.id + '"]');
    assert.equal(await page.locator('.mvx-location-heading h2').first().innerText(), target.name);
    assert.equal(await page.locator('.mvx-status').getAttribute('data-status'), E.snapshot(world).locations[target.id]);
    await search('no-result-for-native-explorer-qa-9613', 'all');
    assert.equal(await page.locator('.mvx-results article').count(), 0);
    assert.match(await page.locator('.mvx-search-panel').innerText(), /Không có kết quả phù hợp/);
    await search('', 'character'); assert.equal(await page.locator('.mvx-results article').count(), world.blueprint.characters.length);
    await search('', 'all'); assert.equal(await page.locator('.mvx-results article').count(), expectedRows.length);

    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await action('explorer-reset');
      assert.equal(await page.locator('[data-mv-action=explorer-zoom][data-delta="-0.25"]').isDisabled(), true);
      for (let step = 0; step < 8; step++) await action('explorer-zoom', '[data-delta="0.25"]');
      assert.match(await page.locator('.mvx-map-toolbar output').innerText(), /300%/);
      assert.equal(await page.locator('[data-mv-action=explorer-zoom][data-delta="0.25"]').isDisabled(), true);
      const region = page.locator('.mvx-map-scroll');
      await region.evaluate(el => { el.scrollLeft = 0; }); await region.focus(); await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.mvx-map-scroll').scrollLeft > 0);
      assert.notEqual(await region.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      await action('explorer-reset');
      assert.match(await page.locator('.mvx-map-toolbar output').innerText(), /100%/);
      const sizes = await page.locator('.mvx button,.mvx input,.mvx select').evaluateAll(rows => rows.filter(e => e.getClientRects().length).map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, text: e.textContent.slice(0, 25) })));
      for (const rect of sizes) assert.ok(rect.width >= 44 && rect.height >= 44, JSON.stringify(rect));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), prefix + ' overflow at ' + width);
      await checkHistory();
      if (audit) audits.push(await audit(page, prefix + '-' + width));
      await screenshot(String(width));
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), prefix + ' overflow at 200%');
    if (audit) audits.push(await audit(page, prefix + '-zoom200'));
    await screenshot('zoom200');
    await page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, originalZoom);

    await action('character', '[data-id="' + world.blueprint.characters[0].id + '"]');
    await page.locator('[data-mv-view=characters][aria-current=page]').waitFor();
    await page.goBack(); await page.locator('.mvx').waitFor(); await settle(); await checkHistory();
    if (readOnly) {
      assert.match(await page.evaluate(() => location.hash), /^#\/multiverse\/shared\//);
      assert.equal(await page.locator('.mvx [data-mv-action=advance],.mvx [data-mv-action=apply-decision],.mvx [data-mv-action=buy]').count(), 0);
      assert.match(await page.locator('.mv-world-header').innerText(), /READ ONLY/);
    }
    pass({ [prefix]: 'Real search/type filters/empty results, current location status, zoom bounds, keyboard map pan, browser back, 44px controls, 375px/desktop/200% layouts', ancestorSnapshots: expected.points.length, comparisonMetrics: expected.comparisons.length, readOnly });
  }
  finally {
    await page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, originalZoom).catch(() => {});
    if (viewport) await page.setViewportSize(viewport);
    if (await page.evaluate(() => location.hash) !== originalHash) {
      await page.evaluate(hash => { location.hash = hash; }, originalHash);
      await page.locator('.mv-world-header').waitFor(); await settle();
    }
  }
};
