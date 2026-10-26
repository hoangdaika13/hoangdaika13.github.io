'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

test('campaign store atomically preserves nested future schemas and corrupt checkpoints', {
  skip: !process.env.HH_QA_PLAYWRIGHT,
  timeout: 30000
}, async () => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const source = fs.readFileSync(path.resolve(__dirname, '../all-game-campaign-store.js'));
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/store.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/store.js' ? source : '<!doctype html><script src="/store.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : {}) });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    const result = await page.evaluate(async () => {
      const S = HHAllGameCampaignStore, store = S.create(), owner = 'same-account', id = 'snake';
      const progress = { version: 1, gameId: id, contentVersion: 1, completed: {}, flags: {} };
      const state = { id, status: 'playing', campaign: { version: 1, gameId: id, mission: 'm1', contentVersion: 1 } };
      if (!(await store.saveProgress(owner, id, progress)).ok) throw Error('Initial valid progress');
      if (!(await store.saveCheckpoint(owner, id, 'm1', 1, state)).ok) throw Error('Initial valid checkpoint');
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(S.DB, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const put = (kind, value) => new Promise((resolve, reject) => {
        const tx = db.transaction(kind, 'readwrite');
        tx.objectStore(kind).put(value);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      const get = kind => new Promise((resolve, reject) => {
        const tx = db.transaction(kind), request = tx.objectStore(kind).get(S.key(owner, id));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // The older store instance stays open while a newer tab changes only its
      // inner schema. Checking just the row's envelope would destroy this save.
      const future = { version: 1, key: S.key(owner, id), owner, id, progress: { ...progress, version: 9, unknown: 'preserve-future-payload' }, updatedAt: 1 };
      await put('progress', future);
      const futureRead = await store.read(owner, id);
      const futureWrite = await store.saveProgress(owner, id, progress);
      const futurePreserved = JSON.stringify(await get('progress')) === JSON.stringify(future);

      let corruptProgressPreserved = 0;
      for (const changed of [{ contentVersion: 'future' }, { contentVersion: 0 }, { contentVersion: NaN }, { completed: [] }, { completed: null }, { flags: [] }, { flags: null }]) {
        const corruptProgress = { ...future, progress: { ...progress, ...changed } };
        await put('progress', corruptProgress);
        if ((await store.read(owner, id)).code !== 'corrupt') throw Error('Malformed progress was accepted');
        if ((await store.saveProgress(owner, id, progress)).ok) throw Error('Malformed progress was overwritten');
        if ((await store.list(owner)).value.length) throw Error('Malformed progress was listed');
        if (JSON.stringify(await get('progress')) !== JSON.stringify(corruptProgress)) throw Error('Malformed progress was changed');
        if ((await store.saveProgress(owner, 'invalid', { ...progress, gameId: 'invalid', ...changed })).ok) throw Error('Malformed outgoing progress was accepted');
        corruptProgressPreserved++;
      }

      // A same-schema snapshot with another mission cannot be offered as a
      // resume point, overwritten, deleted, or silently removed by LRU pruning.
      const corrupt = { version: 1, key: S.key(owner, id), owner, id, missionId: 'm1', contentVersion: 1, state: { ...state, campaign: { ...state.campaign, mission: 'm2' } }, updatedAt: 2 };
      await put('checkpoints', corrupt);
      const corruptRead = await store.read(owner, id, 'checkpoints');
      const corruptWrite = await store.saveCheckpoint(owner, id, 'm1', 1, state);
      const corruptDelete = await store.saveCheckpoint(owner, id, 'm1', 1, null);
      for (let i = 0; i < 34; i++) {
        const nextId = 'valid-' + i;
        if (!(await store.saveCheckpoint(owner, nextId, 'm1', 1, { id: nextId, status: 'playing' })).ok) throw Error('Valid LRU write');
      }
      const listed = await store.list(owner, 'checkpoints');
      const corruptPreserved = JSON.stringify(await get('checkpoints')) === JSON.stringify(corrupt);

      // An invalid caller cannot write a mismatched game or mission either.
      const wrongProgress = await store.saveProgress(owner, 'other', progress);
      const wrongCheckpoint = await store.saveCheckpoint(owner, 'other', 'm1', 1, { ...state, id: 'other' });
      db.close();
      store.close();
      return { futureRead, futureWrite, futurePreserved, corruptProgressPreserved, corruptRead, corruptWrite, corruptDelete, corruptPreserved, visibleCheckpoints: listed.value.length, listedCorrupt: listed.value.some(row => row.id === id), wrongProgress, wrongCheckpoint };
    });
    assert.equal(result.futureRead.code, 'version');
    assert.equal(result.futureWrite.ok, false);
    assert.equal(result.futurePreserved, true);
    assert.equal(result.corruptProgressPreserved, 7);
    assert.equal(result.corruptRead.code, 'corrupt');
    assert.equal(result.corruptWrite.ok, false);
    assert.equal(result.corruptDelete.ok, false);
    assert.equal(result.corruptPreserved, true);
    assert.equal(result.visibleCheckpoints, 32);
    assert.equal(result.listedCorrupt, false);
    assert.equal(result.wrongProgress.ok, false);
    assert.equal(result.wrongCheckpoint.ok, false);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('campaign story keeps keyboard focus when choices or pause state rerender', {
  skip: !process.env.HH_QA_PLAYWRIGHT,
  timeout: 30000
}, async () => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const files = ['core', 'store', 'ui'];
  const server = http.createServer((request, response) => {
    const file = files.find(name => request.url === '/' + name + '.js');
    response.setHeader('Content-Type', file ? 'text/javascript' : 'text/html');
    response.end(file ? fs.readFileSync(path.resolve(__dirname, '../all-game-campaign-' + file + '.js')) : '<!doctype html><main id="root"><div class="ag-workspace"><div class="ag-stage-scroll"><canvas data-ag-canvas tabindex="0"></canvas></div><div class="ag-summary"></div></div></main>' + files.map(name => '<script src="/' + name + '.js"></script>').join(''));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : {}) });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate(() => {
      const base = { create: () => ({ id: 'test-game', status: 'playing' }), step: state => state, describe: () => ({}), draw() {} };
      const missions = Array.from({ length: 24 }, (_, i) => ({ id: 'm' + i, title: 'Mission ' + i, objective: 'Goal', mechanicIntroduced: 'Choice', setup: {}, chapter: 'c' }));
      window.HHAllGameCampaignArcade = { games: { 'test-game': { id: 'test-game', model: 'puzzle', missions, chapters: [{ id: 'c', title: 'Chapter' }], createEngine: () => base } } };
      window.session = { started: true, paused: false, state: { status: 'playing' } };
      window.description = { story: { text: 'First question', choices: [{ id: 'stay', label: 'Stay' }, { id: 'leave', label: 'Leave' }] } };
      const ok = async () => ({ ok: true });
      window.ui = HHAllGameCampaignUI.mount({ root: document.querySelector('#root'), entry: { id: 'test-game', bundle: 'arcade' }, owner: 'test', baseEngine: base, store: { read: ok, saveProgress: ok, saveCheckpoint: ok }, bridge: { pause() {}, activate() {}, getDifficulty: () => 'normal', send(action) { window.lastAction = action; description.story.text = 'Your choice changed the next scene'; ui.renderState(description, session); } } });
    });
    await page.locator('[data-ag-journey]').click();
    await page.locator('[data-ag-mission-id]:not([disabled])').first().click();
    await page.evaluate(() => ui.renderState(description, session));
    await page.locator('[data-ag-story-choice="stay"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.agStoryChoice), 'stay');
    assert.deepEqual(await page.evaluate(() => lastAction), { type: 'command', id: 'story-stay' });
    await page.evaluate(() => { session.paused = true; ui.renderState(description, session); });
    assert.equal(await page.locator('[data-ag-story-toggle]').evaluate(node => document.activeElement === node), true);
    await page.evaluate(() => { session.paused = false; ui.renderState(description, session); });
    assert.equal(await page.locator('[data-ag-story-toggle]').evaluate(node => document.activeElement === node), true);
    await page.locator('[data-ag-canvas]').focus();
    await page.evaluate(() => { description.story.text = 'Updated while playing'; ui.renderState(description, session); });
    assert.equal(await page.locator('[data-ag-canvas]').evaluate(node => document.activeElement === node), true);
    await page.locator('[data-ag-story-choice="stay"]').focus();
    await page.evaluate(() => ui.renderState({}, session));
    assert.equal(await page.locator('[data-ag-canvas]').evaluate(node => document.activeElement === node), true);
    await page.evaluate(() => ui.destroy());
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
