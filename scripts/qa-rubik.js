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
  await page.evaluate((value) => { location.hash = value; }, route);
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
    await page.locator(".rb-comparisons figure").first().waitFor();
    assert.equal(await page.locator(".rb-comparisons figure").count(), 2);
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
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, mobile ? "lesson-mobile.png" : "lesson-desktop.png") });

    await go(page, "/rubik/cong-thuc", "[data-filter='query']");
    await page.locator("[data-filter='group']").selectOption("oll");
    await page.locator("[data-filter='query']").fill("OLL 27");
    await page.locator(".rb-case[href$='/oll-27']").click();
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
    await page.locator("[data-trainer-feedback]").filter({ hasText: /Đúng|Hãy thử lại/ }).waitFor();

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
    assert.equal(await page.locator(".rb-coverage").count(), 12);
    await noOverflow(page);
    assert.deepEqual(errors, []);
    video = page.video();
    console.log("PASS", mobile ? "mobile 375px, cảm ứng giả lập, giảm chuyển động" : "desktop", "sidebar, video, thư viện, 2D/3D, bộ giải, luyện tập, đồng hồ và tải lại");
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
