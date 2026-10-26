'use strict';

// Optional actual-browser audit. Engines and host are unmodified; all game state
// reads are observational and every play action goes through real DOM input.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const repo = path.resolve(__dirname, '..');
const enabled = Boolean(process.env.HH_QA_PLAYWRIGHT);
const catalog = require('../all-game.js').CATALOG.filter(game => ['arcade', 'pack-arcade'].includes(game.bundle));
const actionGames = new Set(['breakout', 'star-guard', 'paddle-duel', 'sky-glider', 'road-rush', 'asteroid-drift', 'gravity-flip', 'ball-balance', 'jump-tower', 'laser-dash', 'orbit-collect', 'shield-defense', 'target-range', 'penalty-kick', 'mini-golf', 'basket-shot']);

test('All Game arcade: actual browser controls, winning rounds and lifecycle', { skip: !enabled, timeout: 180000 }, async t => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All Game arcade audit</title><link rel="stylesheet" href="/all-game.css"></head><body style="margin:0;background:#080e20"><main id="probe"></main><script src="/all-game-studio-catalog.js"></script><script src="/all-game-studio-core.js"></script><script src="/all-game-studio-art.js"></script><script src="/all-game-exp-catalog-play.js"></script><script src="/all-game-exp-catalog-lab.js"></script><script src="/all-game-exp-catalog-story.js"></script><script src="/all-game-expansion-catalog.js"></script><script src="/all-game-exp-art-play.js"></script><script src="/all-game-exp-art-lab.js"></script><script src="/all-game-exp-art-story.js"></script><script src="/all-game-expansion-art.js"></script><script src="/all-game-audio.js"></script><script src="/all-game-catalog.js"></script><script src="/all-game-scenes.js"></script><script src="/all-game.js"></script></body></html>');
    }
    if (!/^\/all-game(?:-[a-z-]+)?\.(?:js|css)$/.test(pathname)) return response.writeHead(404).end();
    const file = path.join(repo, pathname.slice(1));
    if (!fs.existsSync(file)) return response.writeHead(404).end();
    response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : {}) });
    const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    let serial = 0;
    const mount = async id => {
      await page.evaluate(({ id, owner }) => {
        window.arcadeAuditOwner = owner;
        window.arcadeAuditController = HHAllGame.mount(document.querySelector('#probe'), { gameId: id, currentUser: { id: owner } });
      }, { id, owner: 'arcade-browser-' + (++serial) });
      await page.locator('[data-ag-start]:not([disabled])').waitFor();
      await page.locator('[data-ag-start]').click();
      await page.locator('[data-ag-canvas]').scrollIntoViewIfNeeded();
      await page.locator('[data-ag-canvas]').focus();
    };
    const state = () => page.evaluate(() => arcadeAuditController.getState());
    const canvasPoint = async (x, y) => {
      const box = await page.locator('[data-ag-canvas]').boundingBox();
      return { x: box.x + x / 720 * box.width, y: box.y + y / 480 * box.height };
    };
    const samples = {
      snake: ['ArrowUp', s => s.queuedDirection, (a, b) => b === 'up' && a !== b],
      breakout: ['ArrowLeft', s => s.paddle.x, (a, b) => b < a],
      'star-guard': ['ArrowLeft', s => s.player.x, (a, b) => b < a],
      'paddle-duel': ['ArrowDown', s => s.player.y, (a, b) => b > a],
      'sky-glider': ['Space', s => s.player.vy, (a, b) => b < 0],
      'meteor-dodge': ['ArrowLeft', s => s.player.x, (a, b) => b < a],
      'coin-catcher': ['ArrowLeft', s => s.player.x, (a, b) => b < a],
      'road-rush': ['ArrowLeft', s => s.lane, (a, b) => b < a],
      'river-cross': ['ArrowUp', s => s.player.row, (a, b) => b < a],
      'asteroid-drift': ['ArrowUp', s => s.player.vy, (a, b) => b < a],
      'gravity-flip': ['Space', s => s.gravity, (a, b) => b === -a],
      'ball-balance': ['ArrowRight', s => s.player.vx, (a, b) => b > a],
      'jump-tower': ['Space', s => s.player.vy, (a, b) => b < 0],
      'laser-dash': ['ArrowRight', s => s.player.x, (a, b) => b > a],
      'orbit-collect': ['ArrowUp', s => s.player.radius, (a, b) => b < a],
      'shield-defense': ['ArrowRight', s => s.player.angle, (a, b) => b > a],
      'target-range': ['ArrowLeft', s => s.player.x, (a, b) => b < a],
      'penalty-kick': ['ArrowLeft', s => s.aim.x, (a, b) => b < a],
      'mini-golf': ['ArrowLeft', s => s.angle, (a, b) => b < a],
      'basket-shot': ['ArrowUp', s => s.power, (a, b) => b > a]
    };
    await t.test('20 games draw distinct playable scenes, respond to keyboard, and pause/cleanup at 375px and desktop', async () => {
      assert.equal(catalog.length, 20);
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const game of catalog) {
          await mount(game.id);
          const canvas = page.locator('[data-ag-canvas]');
          assert.equal(await canvas.isVisible(), true, game.id + ': visible canvas');
          assert.equal(await page.locator('[data-ag-board]').isHidden(), true, game.id + ': no duplicate board');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, game.id + ': no horizontal overflow at ' + width);
          assert.equal(await page.locator('[data-ag-control="action"]').isVisible(), actionGames.has(game.id), game.id + ': advertised action is reachable on mobile');
          const pixels = await canvas.evaluate(node => {
            const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
            const colors = new Set();
            for (let i = 0; i < data.length; i += 128) if (data[i + 3]) colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
            return colors.size;
          });
          assert.ok(pixels > 24, game.id + ': actual rendered scenery, not a blank canvas');
          const [key, read, changed] = samples[game.id], before = read(await state());
          await canvas.focus();
          await page.keyboard.down(key); await page.waitForTimeout(65); await page.keyboard.up(key);
          assert.ok(changed(before, read(await state())), game.id + ': keyboard changes the relevant engine state');
          await canvas.focus(); await page.keyboard.press('Escape');
          assert.match(await page.locator('[data-ag-game-status]').textContent(), /Tạm dừng/);
          const paused = await state(), frames = await page.evaluate(() => arcadeAuditController.getFrameCount());
          await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); await page.waitForTimeout(80);
          assert.deepEqual(await state(), paused, game.id + ': pause blocks game input and ticking');
          assert.equal(await page.evaluate(() => arcadeAuditController.getFrameCount()), frames, game.id + ': no render loop while paused');
          await page.locator('[data-ag-start]').click();
          const idle = await page.evaluate(id => {
            const engine = (window.HHAllGameArcade?.games[id] || window.HHAllGamePackArcade?.games[id]);
            return engine.describe(arcadeAuditController.getState()).needsFrame === false;
          }, game.id);
          if (idle) {
            const idleFrames = await page.evaluate(() => arcadeAuditController.getFrameCount());
            await page.waitForTimeout(60);
            assert.equal(await page.evaluate(() => arcadeAuditController.getFrameCount()), idleFrames, game.id + ': resumed aim waits without RAF');
            await canvas.focus(); await page.keyboard.press('Space');
            await page.waitForFunction(previous => arcadeAuditController.getFrameCount() > previous, idleFrames);
          } else await page.waitForFunction(previous => arcadeAuditController.getFrameCount() > previous, frames);
          const oldFrames = await page.evaluate(() => { HHAllGame.unmount(); return arcadeAuditController.getFrameCount(); });
          await page.waitForTimeout(60);
          assert.equal(await page.evaluate(() => arcadeAuditController.getFrameCount()), oldFrames, game.id + ': renderer cleaned after unmount');
          assert.equal(await page.locator('[data-ag-canvas]').count(), 0, game.id + ': canvas removed after unmount');
        }
      }
    });
    await t.test('mobile action buttons actually brake, dash, reverse orbit and expand the shield', async () => {
      await page.setViewportSize({ width: 375, height: 900 });
      const holdAction = async () => {
        const action = page.locator('[data-ag-control="action"]');
        await action.scrollIntoViewIfNeeded();
        const box = await action.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down(); await page.waitForTimeout(100);
      };
      await mount('road-rush');
      await page.locator('[data-ag-control="action"]').scrollIntoViewIfNeeded();
      const roadBefore = await state();
      await holdAction(); const roadAfter = await state(); await page.mouse.up();
      assert.ok((roadAfter.progress - roadBefore.progress) / (roadAfter.time - roadBefore.time) < 130, 'holding the mobile action applies the real 70m/s brake, not the normal165m/s speed');
      await mount('ball-balance');
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(80); await page.keyboard.up('ArrowRight');
      await holdAction();
      assert.equal((await state()).actionHeld, true, 'mobile hold reaches the physics braking action');
      const speedBefore = (await state()).player.vx; await page.waitForTimeout(100); const speedAfter = (await state()).player.vx;
      assert.ok(speedAfter < speedBefore * 0.8, 'held brake rapidly reduces real momentum');
      await page.mouse.up();
      for (const [id, property, expected] of [['laser-dash', 'dash', value => value > 0], ['orbit-collect', 'direction', value => value === -1], ['shield-defense', 'burst', value => value > 0]]) {
        await mount(id); await page.locator('[data-ag-control="action"]').click();
        assert.ok(expected((await state())[property]), id + ': touch action reaches its actual mechanic');
      }
    });
    await t.test('Orbit Collect mobile radius controls reach a real crystal; aiming/thrust directions stay available', async () => {
      await page.setViewportSize({ width: 375, height: 900 });
      for (const id of ['penalty-kick', 'asteroid-drift', 'orbit-collect']) {
        await mount(id);
        for (const direction of ['up', 'down', 'left', 'right']) {
          assert.equal(await page.locator('[data-ag-control="' + direction + '"]').isVisible(), true, id + ': required mobile direction ' + direction + ' is available');
        }
      }
      const initialRadius = (await state()).player.radius;
      await page.locator('[data-ag-control="up"]').click();
      const smallerRadius = (await state()).player.radius;
      assert.ok(smallerRadius < initialRadius, 'real Up button contracts the orbit');
      await page.locator('[data-ag-control="down"]').click();
      assert.ok((await state()).player.radius > smallerRadius, 'real Down button expands the orbit');
      for (let attempt = 0; attempt < 40 && (await state()).progress === 0; attempt += 1) {
        const current = await state(), target = current.stars[0];
        const angle = Math.atan2(Math.sin(target.angle - current.player.angle), Math.cos(target.angle - current.player.angle));
        const direction = current.player.radius > target.radius + 6 ? 'up' : current.player.radius < target.radius - 6 ? 'down' : angle > 0 ? 'right' : 'left';
        await page.locator('[data-ag-control="' + direction + '"]').click();
      }
      const result = await state();
      assert.ok(result.progress >= 1, 'the previously unreachable inner crystal is collectible with actual mobile controls');
      assert.equal(result.stars[0].taken, true); assert.ok(result.score >= 100);
    });
    await t.test('Target Range: fifteen natural target spawns won by actual canvas clicks, without injected state', async () => {
      await page.setViewportSize({ width: 375, height: 900 });
      await mount('target-range');
      const initial = await state(), center = await canvasPoint(initial.targets[0].x, initial.targets[0].y);
      await page.mouse.move(center.x, center.y);
      assert.equal((await state()).progress, 0, 'hover aims without shooting');
      let iterations = 0;
      while ((await state()).status === 'playing' && iterations++ < 20) {
        await page.waitForFunction(() => arcadeAuditController.getState().targets.length > 0 || arcadeAuditController.getState().status !== 'playing');
        const current = await state();
        if (current.status !== 'playing') break;
        const target = current.targets[0], point = await canvasPoint(target.x, target.y);
        await page.mouse.click(point.x, point.y);
        assert.equal((await state()).progress, current.progress + 1, 'real target click increments actual score');
      }
      const result = await state();
      assert.equal(result.status, 'won'); assert.equal(result.progress, 15); assert.equal(result.misses, 0);
      assert.ok(result.time > 15 && result.time < 35, 'targets arrive through real RAF time');
      assert.match(await page.locator('[data-ag-curtain-title]').textContent(), /hoàn thành/i);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(HHAllGame.keyFor(arcadeAuditOwner))).bests['target-range']);
      assert.equal(saved.wins, 1); assert.equal(saved.plays, 1); assert.equal(saved.score, 1500);
    });
    await t.test('Penalty Kick: pointer aiming and keyboard shots complete the real three-goal round', async () => {
      await mount('penalty-kick');
      for (let shot = 0; shot < 3; shot += 1) {
        await page.waitForFunction(() => { const s = arcadeAuditController.getState(); return !s.flight && s.cooldown <= 0; });
        const aim = await canvasPoint(155, 75);
        await page.mouse.click(aim.x, aim.y);
        assert.equal((await state()).attempts, shot, 'click only aims, does not take an unrequested shot');
        await page.keyboard.press('Space');
        await page.waitForFunction(previous => arcadeAuditController.getState().progress > previous || arcadeAuditController.getState().status !== 'playing', shot);
        assert.equal((await state()).progress, shot + 1);
      }
      const result = await state();
      assert.equal(result.status, 'won'); assert.equal(result.progress, 3); assert.equal(result.attempts, 3);
    });
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
