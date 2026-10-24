'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const host = require('../all-game.js');
const scenes = require('../all-game-scenes.js');
const puzzlePacks = { puzzles: require('../all-game-puzzles.js'), 'pack-puzzles': require('../all-game-pack-puzzles.js') };

test('independent audit: all twenty puzzle destinations have matching rules, scene profiles and accessible cells', () => {
  for (const entry of host.CATALOG.filter(entry => entry.bundle in puzzlePacks)) {
    const engine = puzzlePacks[entry.bundle].games[entry.id]; assert.ok(engine, entry.id);
    assert.ok(scenes.profiles[entry.id], entry.id + ' has a scene');
    const state = engine.create({ seed: 'integration-audit' }), description = engine.describe(state);
    assert.ok(description.cells.length > 0); assert.equal(new Set(description.cells.map(cell => cell.index)).size, description.cells.length);
    for (const cell of description.cells) assert.ok(String(cell.description || cell.label).length > 0, entry.id + ' names every cell');
    if (entry.undo) assert.deepEqual(engine.step(engine.step(state, { type: 'cell', index: 0 }), { type: 'reset-level' }), state, entry.id + ' advertised reset works');
  }
});

const useBrowser = !!process.env.HH_QA_PLAYWRIGHT;
test('independent browser audit: DOM puzzle clues, color alternatives, focus and responsive layouts', { skip: !useBrowser }, async () => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const browser = await chromium.launch({ headless: true, ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main id="root"></main></body></html>');
    await page.addStyleTag({ path: path.join(root, 'all-game.css') });
    for (const file of ['all-game-studio-catalog.js', 'all-game-exp-catalog-play.js', 'all-game-exp-catalog-lab.js', 'all-game-exp-catalog-story.js', 'all-game-expansion-catalog.js', 'all-game-exp-art-play.js', 'all-game-exp-art-lab.js', 'all-game-exp-art-story.js', 'all-game-expansion-art.js', 'all-game-audio.js', 'all-game-studio-core.js', 'all-game-studio-art.js', 'all-game-scenes.js', 'all-game-catalog.js', 'all-game-puzzles.js', 'all-game-pack-puzzles.js', 'all-game-adventure.js', 'all-game.js']) await page.addScriptTag({ path: path.join(root, file) });
    const entries = host.CATALOG.filter(entry => entry.bundle in puzzlePacks);
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const entry of entries) {
        await page.evaluate(id => { window.__auditController = HHAllGame.mount(document.querySelector('#root'), { gameId: id, storage: { getItem: () => null, setItem: () => {} }, currentUser: { id: 'audit-' + id } }); }, entry.id);
        await page.waitForSelector('[data-ag-start]:not([disabled])'); await page.click('[data-ag-start]');
        const result = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, count: document.querySelectorAll('[data-ag-cell]').length, cells: Array.from(document.querySelectorAll('[data-ag-cell]'), node => ({ name: node.getAttribute('aria-label'), text: node.textContent, clipped: node.scrollHeight > node.clientHeight + 2 })) }));
        assert.equal(result.horizontal, false, entry.id + ' horizontal overflow at ' + width); assert.ok(result.count > 0);
        assert.ok(result.cells.every(cell => cell.name.length > 0), entry.id + ' every control has an accessible name');
        if (entry.id === 'towers-hanoi') { assert.ok(result.cells[0].text.includes('A:')); assert.equal(result.cells[0].clipped, false, 'complete stack is visible'); }
        if (entry.id === 'color-flood') assert.ok(result.cells.every(cell => /^[1-5]$/.test(cell.text)), 'colors have visible non-color alternatives');
        if (entry.id === 'nonogram') assert.match(await page.locator('[data-ag-summary]').textContent(), /Hàng:.*Cột:/, 'all real row/column clues are available');
      }
    }
    // Actual keyboard controls use the focused DOM cell, not a stale engine selection.
    await page.evaluate(() => { window.__auditController = HHAllGame.mount(document.querySelector('#root'), { gameId: 'memory', storage: null, currentUser: { id: 'audit-keyboard' } }); });
    await page.waitForSelector('[data-ag-start]:not([disabled])'); await page.click('[data-ag-start]');
    await page.locator('[data-ag-cell="0"]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => __auditController.getState().open), [1]);
    await page.evaluate(() => { window.__auditController = HHAllGame.mount(document.querySelector('#root'), { gameId: 'nonogram', storage: null, currentUser: { id: 'audit-nonogram-focus' } }); });
    await page.waitForSelector('[data-ag-start]:not([disabled])'); await page.click('[data-ag-start]');
    await page.locator('[data-ag-cell="0"]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.agCell), '0', 'updating clues retains keyboard focus');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.agCell), '1');
    // A complete Hanoi run uses only real DOM controls; ended-game Undo reopens it.
    await page.evaluate(() => { window.__auditController = HHAllGame.mount(document.querySelector('#root'), { gameId: 'towers-hanoi', storage: { getItem: () => null, setItem: () => {} }, currentUser: { id: 'audit-hanoi' } }); });
    await page.waitForSelector('[data-ag-start]:not([disabled])'); await page.click('[data-ag-start]');
    const count = await page.evaluate(() => __auditController.getState().count), plan = [];
    function hanoi(n, from, to, spare) { if (!n) return; hanoi(n - 1, from, spare, to); plan.push([from, to]); hanoi(n - 1, spare, to, from); }
    hanoi(count, 0, 2, 1);
    for (const [from, to] of plan) { await page.locator('[data-ag-cell="' + from + '"]').click(); await page.locator('[data-ag-cell="' + to + '"]').click(); }
    assert.equal(await page.evaluate(() => __auditController.getState().status), 'won');
    assert.match(await page.locator('[data-ag-curtain-title]').textContent(), /hoàn thành/i);
    await page.locator('[data-ag-undo]').click(); assert.equal(await page.evaluate(() => __auditController.getState().status), 'playing');
    assert.equal(await page.locator('[data-ag-curtain]').isHidden(), true);
    // A broken renderer is a controlled fault injection, not a simulated gameplay pass.
    await page.evaluate(() => { window.__auditController = HHAllGame.mount(document.querySelector('#root'), { gameId: 'block-drop', storage: null, currentUser: { id: 'audit-safe-failure' } }); });
    await page.waitForSelector('[data-ag-start]:not([disabled])'); await page.click('[data-ag-start]');
    await page.evaluate(() => { window.auditOriginalDraw = HHAllGameAdventure.games['block-drop'].draw; HHAllGameAdventure.games['block-drop'].draw = () => { throw Error('controlled QA render failure'); }; });
    await page.locator('[data-ag-canvas]').focus(); await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('[data-ag-start]').isDisabled(), true); assert.match(await page.locator('[data-ag-curtain-title]').textContent(), /dừng an toàn/);
    const failedFrames = await page.evaluate(() => __auditController.getFrameCount()); await page.waitForTimeout(80); assert.equal(await page.evaluate(() => __auditController.getFrameCount()), failedFrames);
    await page.evaluate(() => { HHAllGame.unmount(); HHAllGameAdventure.games['block-drop'].draw = auditOriginalDraw; });
    assert.equal(await page.locator('#root').evaluate(node => node.childElementCount), 0);
    assert.deepEqual(errors, []);
    await page.close();
  } finally { await browser.close(); }
});
