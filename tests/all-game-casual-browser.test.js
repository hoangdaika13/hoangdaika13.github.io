'use strict';

// Optional real-browser suite: no mocked engines, state injection, auth or backend.
// Set HH_QA_PLAYWRIGHT and HH_QA_CHROMIUM to run in the installed QA runtime.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const repo = path.resolve(__dirname, '..');
const enabled = Boolean(process.env.HH_QA_PLAYWRIGHT && process.env.HH_QA_CHROMIUM);
const catalog = require('../all-game-catalog.js').filter(game => game.bundle === 'pack-casual');
const canvasIds = new Set(['rhythm-tap', 'color-word', 'lock-timing', 'stack-tower', 'constellation-trace', 'pixel-painter', 'garden-care', 'cafe-orders']);

test('All Game casual pack: real host UI, controls, winning paths and accessibility', { skip: !enabled, timeout: 180000 }, async t => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All Game casual browser audit</title><link rel="stylesheet" href="/all-game.css"><body style="margin:0;background:#080e20"><main id="probe"></main><script src="/all-game-studio-catalog.js"></script><script src="/all-game-studio-core.js"></script><script src="/all-game-studio-art.js"></script><script src="/all-game-exp-catalog-play.js"></script><script src="/all-game-exp-catalog-lab.js"></script><script src="/all-game-exp-catalog-story.js"></script><script src="/all-game-expansion-catalog.js"></script><script src="/all-game-exp-art-play.js"></script><script src="/all-game-exp-art-lab.js"></script><script src="/all-game-exp-art-story.js"></script><script src="/all-game-expansion-art.js"></script><script src="/all-game-audio.js"></script><script src="/all-game-catalog.js"></script><script src="/all-game-scenes.js"></script><script src="/all-game.js"></script></body></html>');
    }
    if (!/^\/all-game(?:-[a-z-]+)?\.(?:js|css)$/.test(pathname)) return response.writeHead(404).end();
    const file = path.join(repo, pathname.slice(1));
    if (!fs.existsSync(file)) return response.writeHead(404).end();
    response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(7000);
  const output = path.join(repo, '.study-local/all-game-1058/casual-audit');
  fs.mkdirSync(output, { recursive: true });
  let serial = 0;
  const mount = async (id, start = true) => {
    await page.evaluate(({ id, serial }) => {
      window.auditController = HHAllGame.mount(document.querySelector('#probe'), { gameId: id, currentUser: { id: 'casual-browser-' + serial } });
    }, { id, serial: ++serial });
    await page.locator('[data-ag-start]:not([disabled])').waitFor();
    if (start) await page.locator('[data-ag-start]').click();
  };
  const state = () => page.evaluate(() => auditController.getState());
  const clickCell = index => page.locator('[data-ag-cell="' + index + '"]').click();
  try {
    await page.goto('http://127.0.0.1:' + server.address().port);
    await t.test('all 16 games expose usable controls and required visual cues at 375px', async () => {
      assert.equal(catalog.length, 16);
      for (const game of catalog) {
        await mount(game.id);
        const initial = await state();
        assert.equal(initial.status, 'playing', game.id);
        const canvas = page.locator('[data-ag-canvas]');
        assert.equal(await canvas.isVisible(), canvasIds.has(game.id), game.id + ': required canvas visibility');
        if (canvasIds.has(game.id)) {
          const box = await canvas.boundingBox();
          assert.ok(box.width >= 300 && box.height >= 190, game.id + ': cue canvas must be visible at mobile size');
          assert.ok(await canvas.evaluate(node => node.getContext('2d').getImageData(0, 0, node.width, node.height).data.some((value, index) => index % 4 === 3 && value > 0)), game.id + ': canvas must actually be drawn');
        }
        assert.equal(await page.locator('.ag-clock').isVisible(), Number.isFinite(initial.timeLeft), game.id + ': truthful clock visibility');
        if (Number.isFinite(initial.timeLeft)) assert.match(await page.locator('[data-ag-clock]').textContent(), /^\d+:\d{2}$/);
        assert.equal(await page.locator('[data-ag-clock]').getAttribute('aria-live'), null, 'clock must not announce every frame');
        assert.ok(await page.locator('[data-ag-cell]').count(), game.id + ': actual DOM inputs exist');
        await page.locator('[data-ag-pause]').click();
        const paused = await state();
        const frames = await page.evaluate(() => auditController.getFrameCount());
        await page.waitForTimeout(100);
        assert.deepEqual(await state(), paused, game.id + ': pause must freeze actual state');
        assert.equal(await page.evaluate(() => auditController.getFrameCount()), frames, game.id + ': no paused render loop');
        await page.locator('[data-ag-start]').click();
        await page.keyboard.press('Tab');
        await page.locator('[data-ag-cell]').first().focus();
        assert.ok(await page.locator('[data-ag-cell]').first().evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), game.id + ': keyboard focus');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), game.id + ': no horizontal page overflow');
      }
    });

    await t.test('Color Word renders the real ink cue and accessible equivalent without visible answer leakage', async () => {
      await mount('color-word');
      const current = await state();
      const info = await page.evaluate(() => HHAllGamePackCasual.games['color-word'].describe(auditController.getState()));
      const cue = page.locator('.ag-visual-cue');
      assert.equal(await cue.textContent(), info.visualCue.text);
      assert.equal(await cue.getAttribute('aria-label'), info.visualCue.label);
      assert.match(await cue.getAttribute('style'), /color:/);
      assert.notEqual(current.word, current.ink);
      const inkName = await page.locator('[data-ag-cell="' + current.ink + '"]').textContent();
      assert.equal((await page.locator('[data-ag-summary]').textContent()).includes(inkName), false, 'visible instruction must not reveal the correct ink choice');
      await clickCell(current.ink);
      assert.equal((await state()).round, current.round + 1);
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal(await cue.evaluate(node => getComputedStyle(node).forcedColorAdjust), 'none');
      await page.emulateMedia({ forcedColors: 'none' });
    });

    await t.test('Pixel Painter reaches a real win via palette, erase, paint and submit DOM controls', async () => {
      await mount('pixel-painter');
      assert.equal(await page.locator('[data-ag-difficulty]').isVisible(), false, 'fixed puzzle must not imply different difficulty');
      await clickCell(66);
      await clickCell(0);
      assert.equal((await state()).pixels[0], 2);
      await page.locator('[data-ag-cell="0"]').click({ button: 'right' });
      assert.equal((await state()).pixels[0], 0);
      const target = (await state()).target;
      for (const color of [1, 2, 3]) {
        await clickCell(64 + color);
        for (let index = 0; index < target.length; index++) if (target[index] === color) await clickCell(index);
      }
      assert.equal((await state()).status, 'playing', 'no automatic fake completion');
      await clickCell(68);
      assert.equal((await state()).status, 'won');
      assert.equal((await state()).score, 640);
      assert.match(await page.locator('[data-ag-curtain-title]').textContent(), /hoàn thành/i);
    });

    await t.test('Constellation completes three actual paths using the rendered star buttons', async () => {
      await mount('constellation-trace');
      for (let level = 0; level < 3; level++) {
        const order = (await state()).order;
        for (const index of order) await clickCell(index);
      }
      assert.equal((await state()).status, 'won');
      assert.equal((await state()).score, 480);
    });

    await t.test('Café Orders prepares and serves eight genuine recipes by DOM controls', async () => {
      await mount('cafe-orders');
      const recipes = [[0, 1], [2, 3, 4], [0, 1, 4], [2, 3, 5], [0, 5], [2, 1, 4]];
      await clickCell(0);
      await clickCell(6);
      assert.deepEqual((await state()).cup, []);
      for (let order = 0; order < 8; order++) {
        const current = await state();
        for (const ingredient of recipes[current.order]) await clickCell(ingredient);
        if (order === 3) await page.locator('[data-ag-control="action"]').click();
        else if (order === 6) { await page.locator('[data-ag-control="action"]').focus(); await page.keyboard.press('Enter'); }
        else await clickCell(7);
        assert.equal((await state()).served, order + 1);
      }
      assert.equal((await state()).status, 'won');
      assert.ok((await state()).score >= 800);
    });

    await t.test('200% zoom allows actual start, palette, answer and pause controls without clipping', async () => {
      const layoutFailures = [];
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.documentElement.style.zoom = '2');
        for (const id of ['pixel-painter', 'color-word', 'cafe-orders']) {
          await mount(id);
          const targets = id === 'pixel-painter' ? [65, 0, 68] : id === 'cafe-orders' ? [0, 6] : [(await state()).ink];
          for (const index of targets) {
            const control = page.locator('[data-ag-cell="' + index + '"]');
            await control.scrollIntoViewIfNeeded();
            const reachable = await control.evaluate(node => {
              const box = node.getBoundingClientRect();
              const x = box.left + box.width / 2, y = box.top + box.height / 2;
              const hit = document.elementFromPoint(x, y);
              return { hit: hit === node || node.contains(hit), width: box.width, height: box.height, clipped: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1, label: node.textContent, client: [node.clientWidth, node.clientHeight], scroll: [node.scrollWidth, node.scrollHeight] };
            });
            if (!reachable.hit || reachable.width < 24 || reachable.height < 24 || reachable.clipped) layoutFailures.push({ id, index, viewport: width, ...reachable });
            await control.click();
          }
          await page.locator('[data-ag-stage]').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, id + '-' + width + '-zoom200.png') });
          await page.locator('[data-ag-pause]').click();
          if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) {
            const overflow = await page.evaluate(() => [...document.querySelectorAll('#probe *')].filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.right > innerWidth + 1; }).slice(0, 12).map(node => ({ element: node.tagName, class: node.className, text: node.textContent.slice(0, 40), right: node.getBoundingClientRect().right })));
            layoutFailures.push({ id, width, pageOverflow: true, overflow });
          }
        }
      }
      await page.evaluate(() => document.documentElement.style.zoom = '1');
      assert.deepEqual(layoutFailures, [], 'Visible text and controls must remain usable at 200% zoom');
    });
    await t.test('unmount cancels render work and no browser exceptions occur', async () => {
      await mount('garden-care');
      await page.evaluate(() => HHAllGame.unmount());
      const frames = await page.evaluate(() => auditController.getFrameCount());
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => auditController.getFrameCount()), frames);
      assert.deepEqual(errors, []);
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
