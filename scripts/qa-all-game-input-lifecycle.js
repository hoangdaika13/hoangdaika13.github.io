'use strict';
// Native Chromium touch events; game state is only read, never replaced.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || 'playwright');
const repo = path.resolve(__dirname, '..');
const out = path.resolve(repo, process.env.HH_QA_OUTPUT || '.study-local/all-game-input-lifecycle');
const assets = ['all-game-studio-catalog', 'all-game-studio-core', 'all-game-studio-art', 'all-game-exp-catalog-play', 'all-game-exp-catalog-lab', 'all-game-exp-catalog-story', 'all-game-expansion-catalog', 'all-game-exp-art-play', 'all-game-exp-art-lab', 'all-game-exp-art-story', 'all-game-expansion-art', 'all-game-audio', 'all-game-catalog', 'all-game-scenes', 'all-game-campaign-catalog', 'all-game-campaign-core', 'all-game-campaign-store', 'all-game-campaign-ui', 'all-game'];
const csp = JSON.parse(fs.readFileSync(path.join(repo, 'vercel.json'), 'utf8')).headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  res.setHeader('Cache-Control', 'no-store');
  if (name === '/probe.html') {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', csp);
    return res.end('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/all-game.css"></head><body style="margin:0;background:#091229"><main id="probe"></main>' + assets.map(a => '<script src="/' + a + '.js"></script>').join('') + '</body></html>');
  }
  const file = path.resolve(repo, '.' + name);
  if (!file.startsWith(repo + path.sep) || name.split('/').some(p => p.startsWith('.') || ['api', 'utils', 'node_modules'].includes(p))) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', path.extname(file) === '.css' ? 'text/css' : 'text/javascript');
  fs.createReadStream(file).pipe(res);
});

async function run() {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [], errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/probe.html');
    const cdp = await page.context().newCDPSession(page);
    async function mount(id) {
      await page.evaluate(id => { window.qaController = HHAllGame.mount(document.querySelector('#probe'), { gameId: id, currentUser: { id: 'native-input-' + id } }); }, id);
      await page.locator('[data-ag-start]:not([disabled])').waitFor();
      await page.locator('[data-ag-start]').click();
    }
    const state = () => page.evaluate(() => qaController.getState());
    async function swipe(from, to, cancel = false) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8, id: 1 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(40);
    }
    await mount('merge');
    const board = page.locator('[data-ag-board]');
    await board.scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.qaPointerEvents = []; for (const type of ['pointerdown', 'pointerup', 'pointercancel']) document.querySelector('[data-ag-board]').addEventListener(type, e => qaPointerEvents.push({ type: e.type, pointerId: e.pointerId })); });
    // Start from the actual fresh random board, choose a vertical direction that
    // necessarily moves one of its two tiles. No near-win state or seed injection.
    let before = await state();
    const tiles = before.board || before.grid;
    assert(Array.isArray(tiles), 'Merge exposes its native board');
    const flat = tiles.flat();
    const down = flat.some((v, i) => v && i < 12);
    const bounds = await board.boundingBox();
    const from = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * (down ? .25 : .75) };
    const to = { x: from.x, y: from.y + (down ? 100 : -100) };
    await swipe(from, to);
    const after = await state();
    const events = await page.evaluate(() => qaPointerEvents);
    results.push({ id: 'merge', input: 'native vertical touch swipe', beforeMoves: before.moves, afterMoves: after.moves, events });
    await page.screenshot({ path: path.join(out, 'merge-mobile.png') });
    if (process.env.HH_QA_OBSERVE !== '1') assert(after.moves > before.moves, 'Vertical touch swipe must move Merge tiles rather than scroll/cancel');
    await board.scrollIntoViewIfNeeded();
    const b = await board.boundingBox();
    before = await state();
    await swipe({ x: b.x + b.width * .25, y: b.y + b.height / 2 }, { x: b.x + b.width * .75, y: b.y + b.height / 2 }, true);
    assert.deepEqual(await state(), before, 'Cancelled touch swipe must not commit a Merge move');
    results.push({ id: 'merge', input: 'cancelled native touch', unchanged: true });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width * .25, y: b.y + b.height / 2, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width * .65, y: b.y + b.height / 2, id: 1 }] });
    await page.keyboard.press('p');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('[data-ag-start]').click();
    assert.deepEqual(await state(), before, 'Pausing midway through touch cannot commit a stale swipe after resume');
    results.push({ id: 'merge', input: 'pause mid touch and resume', unchanged: true });
    await page.locator('[data-ag-board-zoom]').click();
    const zoomTouchAction = await board.evaluate(e => getComputedStyle(e).touchAction);
    if (process.env.HH_QA_OBSERVE !== '1') assert.equal(zoomTouchAction, 'pan-x pan-y', 'Zoomed board retains browser pan access');
    results.push({ id: 'merge', input: 'zoomed board', touchAction: zoomTouchAction });
    await page.locator('[data-ag-board-zoom]').click();
    before = await state();
    const boardValues = (before.board || before.grid).flat();
    const direction = boardValues.some((v, i) => v && i >= 4) ? 'up' : 'down';
    // Assistive technologies can invoke the semantic button's click without
    // pointerdown or a gameplay key event. It must still perform one action.
    await page.locator('[data-ag-control="' + direction + '"]').evaluate(button => button.click());
    const clicked = await state();
    results.push({ id: 'merge', input: 'assistive click-only D-pad activation', beforeMoves: before.moves, afterMoves: clicked.moves });
    if (process.env.HH_QA_OBSERVE !== '1') assert.equal(clicked.moves, before.moves + 1, 'Semantic D-pad click must perform one move without pointerdown');
    const nextDirection = (clicked.board || clicked.grid).flat().some((v, i) => v && i >= 4) ? 'up' : 'down';
    await page.locator('[data-ag-control="' + nextDirection + '"]').focus();
    await page.keyboard.press('Enter');
    assert.equal((await state()).moves, clicked.moves + 1, 'D-pad Enter activates exactly once after click accessibility support');
    results.push({ id: 'merge', input: 'D-pad Enter', movesAdded: 1 });
    await mount('pottery-wheel');
    const canvas = page.locator('[data-ag-canvas]');
    await canvas.scrollIntoViewIfNeeded();
    const rect = await canvas.boundingBox();
    await page.mouse.move(rect.x + rect.width * .65, rect.y + rect.height * .25);
    await page.mouse.down();
    assert.equal((await state()).dragging, true, 'Native pointer starts pottery drag');
    await page.keyboard.press('p');
    await page.mouse.up();
    await page.locator('[data-ag-start]').click();
    before = await state();
    await canvas.scrollIntoViewIfNeeded();
    const resumed = await canvas.boundingBox();
    await page.mouse.move(resumed.x + resumed.width * .75, resumed.y + resumed.height * .45);
    const hovered = await state();
    results.push({ id: 'pottery-wheel', input: 'pause mid drag / release / resume / hover', draggingBeforeHover: before.dragging, radiiChanged: JSON.stringify(hovered.radii) !== JSON.stringify(before.radii) });
    if (process.env.HH_QA_OBSERVE !== '1') {
      assert.equal(before.dragging, false, 'Pausing must terminate the active pottery drag');
      assert.deepEqual(hovered.radii, before.radii, 'Hover after resume cannot silently keep a released pottery drag');
    }
    await page.locator('[data-ag-board-zoom]').click();
    await canvas.scrollIntoViewIfNeeded();
    const zoomRect = await canvas.boundingBox();
    const left = Math.max(zoomRect.x + 10, 40), right = Math.min(zoomRect.x + zoomRect.width - 10, 335);
    const py = Math.max(zoomRect.y + 15, Math.min(zoomRect.y + zoomRect.height * .3, 750));
    const primary = { x: left, y: py, id: 7 }, secondary = { x: right, y: py + 20, id: 8 };
    await canvas.evaluate(element => { window.qaZoomTouchEvents = []; for (const type of ['pointerdown', 'pointerup', 'pointercancel']) element.addEventListener(type, e => qaZoomTouchEvents.push({ type: e.type, isPrimary: e.isPrimary })); });
    before = await state();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary, secondary] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [secondary] });
    assert.deepEqual(await page.evaluate(() => qaZoomTouchEvents.filter(e => e.type === 'pointerup').map(e => e.isPrimary)), [false], 'Native browser released only the secondary touch');
    assert.deepEqual(await state(), before, 'Releasing a secondary finger cannot commit the primary zoomed tap');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(await page.evaluate(() => qaZoomTouchEvents.filter(e => e.type === 'pointerup').map(e => e.isPrimary)), [false, true], 'Primary touch ends after the ignored secondary release');
    assert.equal((await state()).dragging, false, 'Final zoomed tap always releases pottery drag');
    results.push({ id: 'pottery-wheel', input: 'zoomed two-finger secondary release', secondaryReleaseUnchanged: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors }, null, 2));
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
