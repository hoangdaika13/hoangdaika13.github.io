"use strict";

// Run against the local HH development server with HH_QA_BASE_URL.
// HH_QA_PLAYWRIGHT and HH_QA_CHROMIUM may point to an existing browser installation.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const { planets } = require("../data/auth-planets/catalog.json");
const origin = new URL(process.env.HH_QA_BASE_URL || "http://127.0.0.1:3000");
const solar = Object.entries(planets).filter(([, planet]) => planet.system === "sol");

async function center(target) {
  const rect = await target.boundingBox();
  assert.ok(rect && rect.width >= 43.9 && rect.height >= 43.9, "accessible planet target");
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

async function assertFullSky(page) {
  const bounds = await page.locator(".spiral-canvas").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return [
      Math.abs(rect.left),
      Math.abs(rect.top),
      Math.abs(rect.right - innerWidth),
      Math.abs(rect.bottom - innerHeight)
    ];
  });
  assert.ok(
    bounds.every((edge) => edge <= 1),
    "the sky must reach all four viewport edges: " + bounds
  );
}

function disableWebGL() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    if (this.classList.contains("spiral-canvas") && kind.startsWith("webgl")) return null;
    return original.call(this, kind, ...args);
  };
}

function observeSkyFrames() {
  window.skyFrameCount = 0;
  if (!window.WebGL2RenderingContext) return;
  const draw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) {
    if (this.canvas.classList.contains("spiral-canvas")) window.skyFrameCount++;
    return draw.apply(this, args);
  };
}

async function checkInterruptedDrag(page) {
  await page.locator(".spiral-view[data-renderer=three]").waitFor();
  await page.waitForFunction(() => window.skyFrameCount > 2);
  const rect = await page.locator(".spiral-view").boundingBox();
  await page.mouse.move(rect.x + 30, rect.y + 30);
  await page.mouse.down();
  // Headless Chromium does not emit OS focus changes when switching tabs.
  // Deliver that lifecycle event while a real pointer is still captured.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const before = await page.evaluate(() => window.skyFrameCount);
  await page.waitForFunction((count) => window.skyFrameCount > count + 1, before);
  await page.mouse.up();
  assert.equal(await page.locator(".spiral-facts").isVisible(), false);
}

async function checkPanSelection(page, context, mobile) {
  const pan = page.locator("[data-space-pan]");
  const stage = page.locator(".spiral-view");
  const saturn = page.locator("[data-hit=saturn]");
  await pan.click();
  await stage.scrollIntoViewIfNeeded();
  const rect = await stage.boundingBox();
  const [sx, sy] = await center(saturn);
  const x = rect.x + 30, y = rect.y + rect.height * 0.6;
  const touch = mobile ? await context.newCDPSession(page) : null;
  try {
    if (touch) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 20, y: y - 10 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 20, y - 10, { steps: 5 });
      await page.mouse.up();
    }
    await page.waitForFunction(([sx, sy]) => {
      const r = document.querySelector("[data-hit=saturn]").getBoundingClientRect();
      return Math.abs(r.x + r.width / 2 - sx - 20) < 1 && Math.abs(r.y + r.height / 2 - sy + 10) < 1;
    }, [sx, sy]);
    assert.equal(await page.locator(".spiral-facts").isVisible(), false, "panning must not select a body");
    const at = await center(saturn);
    if (mobile) await page.touchscreen.tap(...at);
    else await page.mouse.click(...at);
    await page.locator("[data-fact-content]:visible").waitFor();
    assert.equal(await page.locator("#space-fact-title").textContent(), "Sao Thổ");
    assert.equal(await pan.getAttribute("aria-pressed"), "true", "tap still selects in pan mode");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.dataset.hit === "saturn");
    if (touch) {
      await stage.focus();
      const box = await stage.boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const positions = () => page.locator("[data-hit=saturn],[data-hit=neptune]").evaluateAll((items) => {
        const [a, b] = items.map((item) => item.getBoundingClientRect());
        return Math.hypot(a.x - b.x, a.y - b.y);
      });
      const before = await positions();
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 48, y: cy, id: 1 }, { x: cx + 48, y: cy, id: 2 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => !document.querySelector(".spiral-facts").open);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const ratio = (await positions()) / before;
      assert.ok(ratio > 1.15 && ratio < 1.25, "pinch should zoom by about 1.2, got " + ratio);
      assert.equal(await page.locator("[data-space-spread]").inputValue(), "2.4", "zoom must keep orbit spread");
    }
    await pan.click();
    await page.locator("[data-space-fit]").click();
  } finally {
    await touch?.detach();
  }
}

async function check(browser, { mobile, reduced, poster }) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: reduced ? "reduce" : "no-preference",
    serviceWorkers: "block"
  });
  try {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin.origin) return route.abort();
      if (url.pathname.startsWith("/api/")) {
        const data = url.pathname.endsWith("/providers") ? { email: true, google: true } : { user: null };
        return route.fulfill({ json: data });
      }
      return route.continue();
    });
    if (poster) await context.addInitScript(disableWebGL);
    if (!mobile && !reduced && !poster) await context.addInitScript(observeSkyFrames);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/index.html?api=local", origin).href, { waitUntil: "domcontentloaded" });
    await page.locator("body.auth-locked:not(.hh-surface-pending) .spiral-card").waitFor();
    await page.locator("[data-banner-refuse]").click();
    await page.locator("[data-privacy-banner]").waitFor({ state: "hidden" });
    await assertFullSky(page);
    if (!mobile && !reduced && !poster) await checkInterruptedDrag(page);
    const email = page.locator("#gateLoginForm [name=email]");
    await email.fill("orbital-qa@example.test");
    assert.equal(
      await page.evaluate(() =>
        performance.getEntriesByType("resource").some((r) => r.name.includes("/auth-planets/"))
      ),
      false
    );
    await page.locator("[data-space-open]").click();
    const stage = page.locator(".spiral-view");
    if (poster) await page.locator("[data-spiral-motion]:disabled").waitFor();
    else {
      await page.locator(".spiral-view[data-renderer=three]").waitFor();
      if (!reduced) await page.locator("[data-spiral-motion]").click();
    }
    if (poster) {
      await page.locator("[data-hit=saturn]").waitFor();
      const labels = await page
        .locator("[data-body]:not([hidden]) span")
        .evaluateAll((items) =>
          items.filter((node) => getComputedStyle(node).visibility === "visible").map((node) => node.textContent)
        );
      assert.deepEqual(
        labels,
        solar.map(([, fact]) => fact.name)
      );
      const satellites = await page
        .locator(".orrery-moon:not([hidden])")
        .evaluateAll(
          (items) =>
            items.filter((node) => getComputedStyle(node).position === "absolute" && node.offsetWidth > 0).length
        );
      assert.equal(satellites, 2);
    }
    const spread = page.locator("[data-space-spread]");
    await spread.focus();
    await page.keyboard.press("End");
    assert.equal(await spread.inputValue(), "2.4");
    await page.locator("[data-space-fit]").click();
    const saturn = page.locator("[data-hit=saturn]");
    await saturn.waitFor();
    const [sx, sy] = await center(saturn);
    await page.mouse.move(sx - 40, sy + 6);
    await page.mouse.down();
    await page.mouse.move(sx, sy, { steps: 7 });
    await page.mouse.up();
    assert.equal(await page.locator(".spiral-facts").isVisible(), false);
    await page.locator("[data-space-fit]").click();
    for (const [id, fact] of solar) {
      const target = page.locator('[data-hit="' + id + '"]');
      const at = await center(target);
      if (mobile) await page.touchscreen.tap(...at);
      else await page.mouse.click(...at);
      await page.locator("[data-fact-content]:visible").waitFor();
      assert.equal(await page.locator("#space-fact-title").textContent(), fact.name);
      assert.equal(await page.locator("[data-fact-source]").getAttribute("href"), fact.source);
      await page.locator("[data-fact-image]").evaluate((image) => image.decode());
      assert.ok(await page.locator("[data-fact-close]").evaluate((node) => node === document.activeElement));
      await page.keyboard.press("Escape");
      await page.waitForFunction((id) => document.activeElement?.dataset.hit === id, id);
    }
    await checkPanSelection(page, context, mobile);
    await stage.focus();
    await page.keyboard.press("ArrowRight");
    await page.locator("[data-space-planet]").selectOption("saturn");
    await page.locator("[data-fact-close]").click();
    await page.waitForFunction(() => document.activeElement?.dataset.hit === "saturn");
    await page.locator("[data-space-overview]").click();
    await page.locator("[data-hit=sol]").waitFor();
    await page.locator("[data-hit=trappist]").waitFor();
    await page.locator("[data-space-login]").click();
    assert.equal(await page.locator("#space-controls").isVisible(), false);
    assert.ok(
      await page.locator('#gateLoginForm [name="password"]').evaluate((input) => input === document.activeElement)
    );
    assert.equal(await email.inputValue(), "orbital-qa@example.test");
    await assertFullSky(page);
    await page.locator('[data-auth-tab="register"]').click();
    await assertFullSky(page);
    await page.locator('[data-auth-tab="login"]').click();
    if (mobile) {
      const form = page.locator("#gateLoginForm");
      await form.locator('[name="password"]').fill("Local-demo-1234");
      await page.locator("[data-space-open]").click();
      await page.locator("[data-space-login]").click();
      assert.ok(await form.locator('[type="submit"]').evaluate((button) => button === document.activeElement));
      await email.fill("");
      await page.locator("[data-space-open]").click();
      await page.locator("[data-space-login]").click();
      assert.ok(
        await email.evaluate((input) => {
          const rect = input.getBoundingClientRect();
          return input === document.activeElement && rect.top >= 0 && rect.bottom <= innerHeight;
        })
      );
    }
    await page.locator("[data-auth-guest]").click();
    await page.waitForFunction(
      () => document.getElementById("authGate").hidden && sessionStorage.getItem("hh.auth.guest") === "1"
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HH_QA_CHROMIUM,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });
  try {
    for (const options of [
      { mobile: false, reduced: false, poster: false },
      { mobile: true, reduced: false, poster: false },
      { mobile: false, reduced: true, poster: false },
      { mobile: true, reduced: true, poster: true }
    ]) {
      await check(browser, options);
      console.log("PASS", options);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
