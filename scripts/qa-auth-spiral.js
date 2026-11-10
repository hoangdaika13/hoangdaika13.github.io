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
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/index.html?api=local", origin).href, { waitUntil: "domcontentloaded" });
    await page.locator("body.auth-locked:not(.hh-surface-pending) .spiral-card").waitFor();
    await page.locator("[data-banner-refuse]").click();
    await page.locator("[data-privacy-banner]").waitFor({ state: "hidden" });
    await assertFullSky(page);
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
