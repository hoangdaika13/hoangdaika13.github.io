"use strict";
// Real renderers and real DOM input; isolated local storage, no live account.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const root = path.resolve(__dirname, ".."), output = path.join(root, ".study-local/all-game-color-1060");
const results = [], errors = [];
let browser, page;
async function mount(id) {
  await page.evaluate(id => {
    window.qaController = HHAllGame.mount(document.querySelector("#probe"), {
      gameId: id, currentUser: { id: "color-qa" },
      storage: { getItem: key => qaStorage.get(key) || null, setItem: (key, value) => qaStorage.set(key, value) }
    });
  }, id);
  if (id) await page.locator("[data-ag-start]:not([disabled])").waitFor();
}
async function noOverflow(label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ": horizontal overflow");
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
    page.on("pageerror", e => errors.push(e.message));
    await page.setContent('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#080f25"><main id="probe"></main></body></html>');
    await page.addStyleTag({ path: path.join(root, "all-game.css") });
    for (const file of ["all-game-catalog.js", "all-game-scenes.js", "all-game-arcade.js", "all-game-puzzles.js", "all-game-adventure.js", "all-game-pack-puzzles.js", "all-game-pack-arcade.js", "all-game-pack-casual.js", "all-game.js"]) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(() => { window.qaStorage = new Map(); });
    await mount();
    assert.equal(await page.locator(".ag-card").count(), 59);
    assert.equal(await page.locator(".ag-card [data-game-art]").count(), 59);
    const duplicateIDs = await page.locator("[id]").evaluateAll(nodes => nodes.map(n => n.id).filter((id, i, ids) => ids.indexOf(id) !== i));
    assert.deepEqual(duplicateIDs, []);
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await noOverflow("Library " + width);
      await page.screenshot({ path: path.join(output, "library-" + width + ".png"), fullPage: false });
    }
    await page.locator('[data-ag-filter-category="Thư giãn"]').click();
    assert.equal(await page.locator("[data-ag-category]").inputValue(), "Thư giãn");
    assert.ok(await page.locator(".ag-card").count() > 0);
    await page.locator("[data-ag-category]").selectOption("Thể thao");
    assert.equal(await page.locator('[data-ag-filter-category="Thể thao"]').getAttribute("aria-pressed"), "true");
    await page.locator("[data-ag-search]").fill("khong-co-game");
    assert.ok(await page.locator(".ag-empty").isVisible());
    await page.locator("[data-ag-clear-filters]").click();
    assert.equal(await page.locator(".ag-card").count(), 59);
    await page.locator("[data-ag-only-favorites]").click();
    assert.ok(await page.locator(".ag-empty").isVisible());
    await page.locator("[data-ag-clear-filters]").click();
    await page.locator('[data-ag-favorite="memory"]').click();
    await page.locator("[data-ag-only-favorites]").click();
    assert.equal(await page.locator(".ag-card").count(), 1);
    await mount();
    assert.equal(await page.locator('[data-ag-favorite="memory"]').getAttribute("aria-pressed"), "true");
    results.push({ library: "59 unique gameplay illustrations, synchronized filters, empty recovery and favorite persistence" });
    const entries = await page.evaluate(() => HHAllGame.CATALOG.map(g => ({ id: g.id, bundle: g.bundle })));
    const limit = Number(process.env.HH_QA_ALL_GAME_LIMIT) || entries.length;
    for (const entry of entries.slice(0, limit)) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await mount(entry.id);
      assert.ok(await page.locator(".ag-entry-art [data-game-art]").isVisible());
      const layouts = [];
      for (const width of [1440, 768, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        await noOverflow(entry.id + " ready " + width);
        await page.locator("[data-ag-start]").click();
        assert.equal(await page.locator("[data-ag-curtain]").isHidden(), true);
        await page.locator("[data-ag-pause]").click();
        assert.equal(await page.locator(".all-game").getAttribute("data-result"), "paused");
        await page.locator("[data-ag-start]").click();
        assert.equal(await page.locator("[data-ag-curtain]").isHidden(), true);
        const cell = page.locator('[data-ag-cell][aria-disabled="false"]').first();
        if (await cell.count()) {
          await cell.focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Enter");
        } else if (entry.id === "merge") {
          await page.locator('[data-ag-control="right"]').click();
        } else if (await page.locator("[data-ag-canvas]").isVisible()) {
          await page.locator("[data-ag-canvas]").focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Space");
          await page.keyboard.up("Space");
        }
        await noOverflow(entry.id + " playing " + width);
        if (await page.locator('[data-ag-stage][data-mode="painted-board"]').count()) {
          const alignment = await page.evaluate(() => {
            const canvas = document.querySelector("[data-ag-canvas]").getBoundingClientRect();
            const board = document.querySelector("[data-ag-board]"), rect = board.getBoundingClientRect();
            const columns = Number(getComputedStyle(board).getPropertyValue("--ag-columns"));
            const rows = Math.ceil(board.children.length / columns), size = Math.min(700 / columns, 460 / rows);
            const expected = { left: canvas.left + (720 - size * columns) / 2 / 720 * canvas.width,
              top: canvas.top + (480 - size * rows) / 2 / 480 * canvas.height,
              width: size * columns / 720 * canvas.width, height: size * rows / 480 * canvas.height };
            return { delta: Math.max(...Object.keys(expected).map(key => Math.abs(expected[key] - rect[key]))) };
          });
          assert.ok(alignment.delta < 2, entry.id + ": Canvas and touch grid align at " + width + "px (" + alignment.delta + ")");
        }
        assert.notEqual(await page.locator("[data-ag-curtain-title]").textContent(), "Game đã dừng an toàn");
        const controls = await page.locator(".ag-controls button:not([hidden]),.ag-touch button:not([hidden])").evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().height > 0).map(n => n.getBoundingClientRect().height));
        assert.ok(controls.every(height => height >= 44), entry.id + " comfortable touch controls");
        if (width !== 768) await page.locator(".ag-stage-panel").screenshot({ path: path.join(output, entry.id + "-" + width + ".png") });
        layouts.push(width);
        await page.locator("[data-ag-restart]").click();
        assert.equal(await page.locator("[data-ag-curtain]").isHidden(), true);
        assert.equal(await page.evaluate(() => qaController.getState().status), "playing");
        await page.locator("[data-ag-pause]").click();
      }
      await page.evaluate(() => { window.qaOldController = qaController; window.qaOldFrames = qaController.getFrameCount(); HHAllGame.unmount(); });
      await page.waitForTimeout(35);
      assert.equal(await page.evaluate(() => qaOldController.getFrameCount()), await page.evaluate(() => qaOldFrames));
      results.push({ id: entry.id, bundle: entry.bundle, layouts, flow: "start, input, pause, resume, restart, unmount" });
      console.log("PASS " + entry.id + " · desktop/tablet/375 · lifecycle");
    }
    if (limit === entries.length) {
      // Check DPR2 pointer mapping at the real canvas target coordinate.
      await mount("target-range");
      await page.locator("[data-ag-start]").click();
      const target = await page.evaluate(() => qaController.getState().targets[0]);
      const rect = await page.locator("[data-ag-canvas]").boundingBox();
      const prior = await page.evaluate(() => qaController.getState().score);
      await page.mouse.click(rect.x + target.x / 720 * rect.width, rect.y + target.y / 480 * rect.height);
      assert.ok(await page.evaluate(() => qaController.getState().score) > prior);
      // Win and loss are obtained through actual game inputs, then rendered by the host.
      await mount("lights-out"); await page.locator("[data-ag-start]").click();
      const solution = await page.evaluate(() => qaController.getState().solution);
      for (const index of solution) {
        if (await page.evaluate(() => qaController.getState().status) === "won") break;
        await page.locator('[data-ag-cell="' + index + '"]').click();
      }
      assert.equal(await page.locator(".all-game").getAttribute("data-result"), "won");
      assert.equal(await page.locator("[data-ag-result-metrics]").isVisible(), true);
      assert.equal(await page.locator("[data-ag-result-score]").textContent(), await page.locator("[data-ag-score]").textContent());
      await page.screenshot({ path: path.join(output, "win-375.png"), fullPage: true });
      await page.locator("[data-ag-start]").click();
      await mount("mines"); await page.locator("[data-ag-start]").click();
      await page.locator('[data-ag-cell="0"]').click();
      const mine = await page.evaluate(() => qaController.getState().board.findIndex(cell => cell.mine));
      await page.locator('[data-ag-cell="' + mine + '"]').click();
      assert.equal(await page.locator(".all-game").getAttribute("data-result"), "lost");
      await page.screenshot({ path: path.join(output, "loss-375.png"), fullPage: true });
      await mount("merge"); await page.locator("[data-ag-start]").click();
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      await noOverflow("Zoom 200%");
      await page.evaluate(() => { document.documentElement.style.zoom = ""; });
      await page.emulateMedia({ forcedColors: "active" });
      await page.keyboard.press("Tab");
      await page.locator("[data-ag-pause]").focus();
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
      results.push({ outcomes: "real win/loss, honest score metrics, DPR2 pointer, 200% zoom, forced-color focus" });
    }
    assert.deepEqual(errors, []);
    console.log("PASS library + " + Math.min(limit, entries.length) + " game checks; no JavaScript errors");
  } catch (error) {
    await page?.screenshot({ path: path.join(output, "failure.png"), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
    await browser?.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
