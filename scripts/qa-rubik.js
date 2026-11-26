"use strict";

// HH_QA_BASE_URL points to a hosted copy or the local static server.
// Only the guest flow is exercised. Account and consent writes are isolated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const origin = new URL(process.env.HH_QA_BASE_URL || "http://127.0.0.1:3000");
const output = path.resolve(process.env.HH_QA_OUTPUT || "artifacts/rubik");
fs.mkdirSync(output, { recursive: true });

function site(route = "") {
  const url = new URL(origin);
  if (url.hostname === "127.0.0.1") url.searchParams.set("api", "local");
  url.hash = route;
  return url.href;
}

async function guest(page) {
  await page.locator("body.auth-locked:not(.hh-surface-pending) .spiral-card").waitFor();
  if (await page.locator("[data-banner-refuse]").isVisible()) await page.locator("[data-banner-refuse]").click();
  await page.locator("[data-auth-guest]").click();
  await page.locator("body.auth-unlocked:not(.hh-surface-pending)").waitFor();
}

async function go(page, route, selector) {
  if (new URL(page.url()).hash !== "#" + route) {
    const previous = await page.$(".rb");
    try {
      await page.evaluate((value) => { location.hash = value; }, route);
      if (previous) await page.waitForFunction((workspace) => !workspace.isConnected, previous);
    } finally {
      await previous?.dispose();
    }
  }
  await page.locator(selector).first().waitFor();
}

async function openFromSidebar(page) {
  const toggle = page.locator('[data-sidebar-section-toggle="entertainment"]');
  if (!(await toggle.isVisible()) || await page.locator("body").evaluate((body) => body.classList.contains("app-sidebar-collapsed"))) {
    await page.locator(".app-header [data-shell-toggle]").click();
  }
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  const target = page.locator('#sidebar-section-entertainment [data-app-route="/rubik"]');
  assert.equal(await target.count(), 1);
  await target.click();
  await page.locator(".rb-hero").waitFor();
}

async function clip(video) {
  const result = await video.evaluate(async (node) => {
    await node.play();
    const info = { width: node.videoWidth, duration: node.duration, played: node.currentTime };
    node.pause();
    return info;
  });
  assert.ok(result.width >= 160 && result.duration > 1);
  return result;
}

async function noOverflow(page) {
  const dimensions = await page.locator(".rb").evaluate((node) => [node.clientWidth, node.scrollWidth]);
  assert.ok(dimensions[1] <= dimensions[0] + 1, "Rubik workspace overflow " + dimensions);
}

async function dragCube(page, stage, volume, mobile) {
  await stage.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  assert.ok(bounds?.width > 48 && bounds.height > 48);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const route = page.url();
  const before = await volume.evaluate((element) => element.style.transform);
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (const offset of [12, 28, 42]) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + offset, y: y + 8 }] });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 42, y + 8, { steps: 4 });
    await page.mouse.up();
  }
  assert.notEqual(await volume.evaluate((element) => element.style.transform), before, "drag must rotate the live cube");
  assert.equal(page.url(), route, "drag on a card must not open another route");
  assert.equal(await page.evaluate(() => getSelection()?.toString() || ""), "", "drag must not select card text");
  assert.equal(await page.locator(".rb-dialog[open]").count(), 0, "drag must keep the cube inline");
}

async function formulaGallery(page, mobile) {
  await go(page, "/rubik/cong-thuc?group=basic", "select[data-filter='group']");
  assert.equal(await page.locator("select[data-filter='group']").inputValue(), "basic");
  const cards = page.locator(".rb-case-card");
  const count = await cards.count();
  assert.ok(count >= 6, "the beginner formula gallery should show its published cases");
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await card.locator("[data-rb-case-model] .rubik-cube-stage").waitFor();
    assert.equal(await card.locator("[data-rb-case-model] .rubik-cube-cell").count(), 54, "beginner card must show its inline 3×3 cube");
  }
  await noOverflow(page);

  await page.locator("[data-filter='group']").selectOption("oll");
  await page.locator("[data-filter='query']").fill("OLL 27");
  const model = page.locator("[data-rb-case-model='oll-27']");
  await model.scrollIntoViewIfNeeded();
  await dragCube(page, model.locator(".rubik-cube-stage"), model.locator(".rubik-cube-volume"), mobile);
  const card = cards.filter({ has: model });
  await card.screenshot({ path: path.join(output, mobile ? "inline-oll27-mobile.png" : "inline-oll27-desktop.png") });
  await card.locator(".rb-case[href$='/oll-27']").click();
  await page.locator("[data-rb-case-player] .rubik-cube-stage").waitFor();
  await page.locator("[data-rb-case-player] [data-player='next']").click();
  await page.locator("[data-rb-case-player] [aria-current='step']").waitFor();
}

async function variantGallery(page, mobile) {
  for (const [puzzle, id] of [["pyraminx", "py-tip"], ["megaminx", "minx-eo-1"], ["skewb", "skewb-sledge"]]) {
    const target = "[data-rb-case-model='" + id + "']";
    await go(page, "/rubik/cong-thuc?puzzle=" + puzzle, target);
    await page.locator(target).scrollIntoViewIfNeeded();
    await page.waitForFunction((selector) => {
      const player = document.querySelector(selector + " twisty-player");
      const wrapper = player?.shadow?.querySelector("twisty-3d-scene-wrapper");
      const vantage = wrapper?.shadow?.querySelector("twisty-3d-vantage");
      const canvas = vantage?.shadow?.querySelector("canvas");
      const bounds = canvas?.getBoundingClientRect();
      return bounds?.width > 64 && bounds.height > 64 && canvas.width > 64 && canvas.height > 64;
    }, target);
  }

  for (const [puzzle, id, part] of [
    ["square1", "sq1-cut-right", ".rb-variant-square-plane"],
    ["clock", "clock-ur", ".rb-variant-clock-face"]
  ]) {
    const target = "[data-rb-case-model='" + id + "']";
    await go(page, "/rubik/cong-thuc?puzzle=" + puzzle, target);
    const model = page.locator(target);
    await model.scrollIntoViewIfNeeded();
    await model.locator(part).first().waitFor();
    await dragCube(page, model.locator(".rb-variant-stage"), model.locator(".rb-variant-scene"), mobile);
    await noOverflow(page);
  }
}

async function innerLayer9x9(page) {
  await go(page, "/rubik/mo-phong?puzzle=9x9x9", ".rb-board .rubik-cube-cell");
  assert.equal(await page.locator("select[data-rb-puzzle]").inputValue(), "9x9x9");
  const snapshot = (cells) => cells.map((cell) => cell.dataset.color).join("");
  const stickers = ".rb-board .rubik-cube-cell";
  assert.equal(await page.locator(stickers).count(), 486);
  const initial = await page.locator(stickers).evaluateAll(snapshot);
  await page.locator(".rb-move-controls > summary").click();
  await page.locator("[data-rb-move-kind]").selectOption("inner");
  await page.locator("[data-rb-move-face]").selectOption("R");
  await page.locator("[data-rb-move-depth]").selectOption("8");
  await page.locator("[data-move='8R']").click();
  assert.match(await page.locator(".rb-player-status").textContent(), /1 nước/);
  await page.waitForFunction(({ stickers, initial }) => !document.querySelector(".rubik-cube-turn") &&
    [...document.querySelectorAll(stickers)].map((cell) => cell.dataset.color).join("") !== initial, { stickers, initial });
  await page.locator("[data-player='back']").click();
  assert.equal(await page.locator(stickers).evaluateAll(snapshot), initial);
  await noOverflow(page);
}

async function check(browser, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 960 }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: mobile ? "reduce" : "no-preference", serviceWorkers: "block",
    ...(process.env.HH_QA_VIDEO && !mobile ? { recordVideo: { dir: output, size: { width: 1280, height: 848 } } } : {})
  });
  let video;
  try {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin.origin && ["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
      if (url.origin === origin.origin && url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, json: { ok: true } });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(site(), { waitUntil: "domcontentloaded" });
    await guest(page);
    await openFromSidebar(page);
    await page.waitForTimeout(1100); // The shell finishes its own route transition.
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, mobile ? "mobile.png" : "desktop.png") });
    await page.getByRole("link", { name: "Tôi chưa biết giải" }).click();
    await page.locator(".rb h2").filter({ hasText: "đọc ký hiệu" }).waitFor();
    await page.locator("[data-rb-compare] figure").first().waitFor();
    assert.equal(await page.locator("[data-rb-compare] figure").count(), 2);
    assert.deepEqual(await page.locator("[data-rb-compare] .rb-turn-arrow").allTextContents(), ["↻", "↺"]);
    await page.locator(".rb-step-stills summary").click();
    assert.equal(await page.locator(".rb-step-stills[open] figure").count(), 2);
    await clip(page.locator(".rb video").first());
    assert.equal(await page.locator('.rb video track[srclang="vi"]').count(), 1);
    await page.locator(".rb video").scrollIntoViewIfNeeded();
    if (process.env.HH_QA_VIDEO && !mobile) {
      await page.locator(".rb video").evaluate((node) => node.play());
      await page.waitForTimeout(1700);
    }
    await page.locator("[data-rb-video]").click();
    const original = await page.locator(".rb-video a[href*='youtube.com/watch']").getAttribute("href");
    const embedded = new URL(await page.locator(".rb iframe").getAttribute("src"));
    assert.equal(embedded.origin, "https://www.youtube-nocookie.com");
    assert.equal(embedded.pathname, "/embed/" + new URL(original).searchParams.get("v"));
    await page.locator("[data-rb-compare-move]").first().click();
    await page.locator(".rb [data-player='next']").click();
    await page.locator(".rb [aria-current='step']").waitFor();
    await page.locator("[data-rb-complete]").click();
    await page.locator("[data-rb-live]").filter({ hasText: "Đã lưu" }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-rb-complete][aria-pressed='true']").waitFor();
    await page.locator("[data-rb-compare] .rb-net").first().waitFor();
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, mobile ? "lesson-mobile.png" : "lesson-desktop.png") });

    await formulaGallery(page, mobile);
    await page.locator("[data-rb-case-compare] .rb-net").first().waitFor();
    await page.locator("[data-rb-enlarge]").first().click();
    await page.locator(".rb-dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-rb-favorite]").click();
    await page.locator("[data-rb-review]").selectOption("known");
    await page.locator("[data-rb-local-clip]").click();
    await clip(page.locator(".rb video"));
    await page.locator("[data-rb-variant]").selectOption("1");
    assert.match(await page.locator("[data-rb-formula]").textContent(), /y'/);

    await variantGallery(page, mobile);
    await innerLayer9x9(page);

    await go(page, "/rubik/mo-phong?puzzle=mirror", "[data-player='mode']");
    assert.match(await page.locator(".rb select[data-rb-puzzle] option:checked").textContent(), /Mirror/);
    await page.locator(".rb [data-move='R']").click();
    assert.match(await page.locator(".rb-player-status").textContent(), /1 nước/);
    await page.locator(".rb [data-player='back']").click();
    assert.match(await page.locator(".rb-player-status").textContent(), /đã về trạng thái giải/);
    await page.locator(".rb [data-player='mode']").click();
    assert.match(await page.locator(".rb [data-player='mode']").textContent(), /3D/);

    await go(page, "/rubik/giai-khoi", "[data-tile]");
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    assert.match(await page.locator("[data-solver-note]").textContent(), /chưa tô/);
    await page.locator("[data-fill]").click();
    await page.locator("[data-palette='U']").click();
    await page.locator("[data-tile='9']").click();
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    await page.locator("[data-solver-note]").filter({ hasText: /màu|không hợp lệ/ }).waitFor();
    await page.locator("[data-which]").selectOption("scramble");
    await page.locator("[data-scramble-form] textarea").fill("R U2 F' L D2 B");
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    await page.locator("[data-solver-note]").filter({ hasText: "Đã kiểm tra lời giải" }).waitFor({ timeout: 40000 });
    await page.locator("[data-rb-solver-player] .rb-board").waitFor();
    await noOverflow(page);

    await go(page, "/rubik/luyen-tap", "[data-answer]");
    await page.locator("[data-answer]").first().click();
    await page.locator("[data-trainer-feedback]").filter({ hasText: /Đúng|Chưa đúng/ }).waitFor();
    await page.locator("[data-rb-answer-review] figure").first().waitFor();

    await go(page, "/rubik/cong-thuc/mirror-align-top", "[data-rb-case-compare] img");
    const mirrorStills = await page.locator("[data-rb-case-compare] img").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => image.decode()));
      return images.map((image) => image.naturalWidth);
    });
    assert.ok(mirrorStills.length === 2 && mirrorStills.every((width) => width >= 320));
    await page.locator("[data-rb-enlarge]").first().click();
    await page.locator(".rb-dialog[open] img").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-rb-local-clip]").click();
    await clip(page.locator(".rb video"));
    await page.screenshot({ path: path.join(output, mobile ? "mirror-mobile.png" : "mirror-desktop.png") });

    await go(page, "/rubik/cong-thuc/py-tip", "[data-rb-case-compare] img");
    await page.getByRole("link", { name: "Tự xoay ca này" }).click();
    await page.locator('[data-turn-practice] [data-special-move="u"]').click();
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /1\/1/);
    await page.locator("[data-rb-demo]").click();
    await page.locator("[data-rb-review-player] twisty-player").waitFor();
    await page.locator("[data-exercise]").selectOption("recall");
    await page.locator("[data-recall]").fill("u u u u");
    await page.locator("[data-recall]").press("Enter");
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /2\/2/);
    await page.locator("[data-recall]").press("Enter");
    await noOverflow(page);

    await go(page, "/rubik/luyen-tap?puzzle=square1&case=sq1-cut-right", "[data-turn-practice] [data-special-move]");
    await page.locator('[data-turn-practice] [data-special-move="/"]').click();
    await page.locator("[data-turn-practice] .rb-player-status").filter({ hasText: "chắn đường cắt" }).waitFor();
    await page.locator('[data-turn-practice] [data-special-move="(-1,0)"]').click();
    await page.locator('[data-turn-practice] [data-special-move="/"]').click();
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    await page.locator("[data-exercise]").selectOption("recall");
    await page.locator("[data-recall]").fill("(-1,0) / / /");
    await page.locator("[data-recall]").press("Enter");
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /2\/2/);

    await go(page, "/rubik/luyen-tap?puzzle=4x4x4&case=parity4-pll", "[data-turn-practice] [data-move='2R2']");
    assert.ok(await page.locator("[data-turn-practice] [data-move='Uw2']").isVisible());

    await go(page, "/rubik/dong-ho", "[data-clock]");
    await page.waitForFunction(() => !document.querySelector(".rb [data-start]").disabled);
    await page.locator("[data-clock]").focus();
    await page.keyboard.press("Space");
    await page.locator("[data-start]").filter({ hasText: "Dừng và lưu" }).waitFor();
    await page.waitForTimeout(280);
    await page.keyboard.press("Space");
    await page.locator(".rb-timer-list li").first().waitFor();
    await page.locator("[data-penalty]").selectOption("+2");
    assert.ok(parseFloat((await page.locator(".rb-timer-list strong").textContent()).replace(",", ".")) >= 2);

    await go(page, "/rubik/tien-trinh", ".rb-coverage");
    await page.locator(".rb").getByRole("link", { name: "OLL 27" }).waitFor();
    assert.equal(await page.locator(".rb-coverage").count(), 14);
    for (const name of ["Rubik 8×8", "Rubik 9×9"]) {
      assert.equal(await page.locator(".rb-coverage > summary").filter({ hasText: name }).count(), 1);
    }
    await noOverflow(page);
    assert.deepEqual(errors, []);
    video = page.video();
    console.log("PASS", mobile ? "mobile 375px, cảm ứng giả lập, giảm chuyển động" : "desktop", "sidebar, video, thư viện 3D kéo xoay ngay trên thẻ, 2D/3D, lớp trong 9×9, bộ giải, luyện tập, đồng hồ và tải lại");
  } finally {
    await context.close();
    if (video) await video.saveAs(path.join(output, "luot-hoc.webm"));
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.HH_QA_CHROMIUM,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking"]
  });
  try {
    await check(browser, false);
    await check(browser, true);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
