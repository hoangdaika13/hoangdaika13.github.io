"use strict";
// Run against the real local shell; backend requests are isolated from live accounts.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");

const root = path.resolve(__dirname, "..");
const baseline = process.env.HH_QA_BASELINE === "1";
const output = path.join(root, ".study-local", "sidebar-navigation-1059", baseline ? "before" : "after");
const csp = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"))
  .headers.flatMap((entry) => entry.headers).find((entry) => entry.key === "Content-Security-Policy").value;
const errors = [], results = [];
let browser, page;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + name);
  if (!file.startsWith(root + path.sep) || name.split("/").some((part) => part.startsWith(".") || ["api", "utils", "node_modules"].includes(part))) {
    return res.writeHead(403).end();
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", ({
    ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
    ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2"
  })[path.extname(file)] || "application/octet-stream");
  if (name === "/index.html") res.setHeader("Content-Security-Policy", csp);
  if (name === "/config.js") {
    return res.end(fs.readFileSync(file, "utf8").replace('"http://127.0.0.1:4000"', '"https://hoangdaika13-astra-realtime.onrender.com"'));
  }
  fs.createReadStream(file).pipe(res);
});
const toggle = () => page.locator('[data-sidebar-section-toggle="entertainment"]');
const items = () => page.locator('#sidebar-section-entertainment > [data-nav-item-route] > [data-app-route]');
const pass = (label) => { results.push(label); console.log("PASS " + label); };

async function openSidebar() {
  if (await page.locator("body").evaluate((body) => body.classList.contains("app-sidebar-collapsed"))) {
    await page.locator(".app-header [data-shell-toggle]").click();
  }
  if (await toggle().getAttribute("aria-expanded") === "false") await toggle().click();
  await page.waitForTimeout(400);
}

async function geometry() {
  return page.evaluate(() => {
    const submenu = document.querySelector("#sidebar-section-entertainment");
    const rect = submenu.getBoundingClientRect();
    return {
      height: rect.height, scrollHeight: submenu.scrollHeight,
      rows: [...submenu.querySelectorAll(":scope > [data-nav-item-route]")].filter((row) => !row.hidden).map((row) => {
        const label = row.querySelector("b"), rowRect = row.getBoundingClientRect();
        return {
          route: row.dataset.navItemRoute, label: label.textContent,
          inside: rowRect.top >= rect.top - 1 && rowRect.bottom <= rect.bottom + 1,
          labelFits: label.scrollHeight <= label.clientHeight + 1 && label.scrollWidth <= label.clientWidth + 1
        };
      })
    };
  });
}

async function checkItems(label) {
  const state = await geometry();
  assert.equal(state.rows.length, 9, label + ": all nine entertainment functions remain listed");
  assert.ok(state.rows.every((row) => row.inside && row.labelFits), label + ": clipped function\n" + JSON.stringify(state));
  for (let index = 0; index < await items().count(); index++) {
    // Playwright checks actual scrolling, clipping and pointer hit targets without navigating.
    await items().nth(index).click({ trial: true, timeout: 5000 });
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ": page overflow");
  await page.locator(".app-sidebar").screenshot({ path: path.join(output, label + ".png") });
  pass(label + ": all nine functions fit, full labels wrap and every button can be reached");
}

async function checkKeyboard() {
  await toggle().focus();
  const routes = await items().evaluateAll((buttons) => buttons.map((button) => button.dataset.appRoute));
  for (const route of routes) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.appRoute), route, "Tab reaches each function in order");
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
    if (route !== routes.at(-1)) await page.keyboard.press("Tab"); // Each row has a separate pin button.
  }
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.hash === "#/fortune");
  await page.locator("#appCosmicLoader").waitFor({ state: "hidden", timeout: 45000 });
  pass("Keyboard Tab reaches all nine functions; Enter opens the last function, Xem bói");
  await page.evaluate(() => { location.hash = "#/all-game"; });
  await page.locator(".ag-card").first().waitFor({ timeout: 45000 });
  await page.locator("#appCosmicLoader").waitFor({ state: "hidden", timeout: 45000 });
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if ((url.startsWith(origin) && !url.includes("/api/")) || /^(data|blob):/.test(url) || /^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(url)) return route.continue();
      return route.fulfill({ status: url.includes("/providers") ? 200 : 503, contentType: "application/json", body: JSON.stringify({ google: false, facebook: false, error: "QA backend unavailable" }) });
    });
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && /Content Security Policy/.test(message.text())) errors.push(message.text()); });
    await page.goto(origin + "/index.html?api=local#/platform", { waitUntil: "domcontentloaded" });
    await page.locator("[data-guest-login]").click();
    await page.locator(".app-main .php").waitFor({ timeout: 45000 });
    const reject = page.getByRole("button", { name: "Từ chối tùy chọn", exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.evaluate(() => { location.hash = "#/all-game"; });
    await page.locator(".ag-card").first().waitFor({ timeout: 45000 });
    await page.locator("#appCosmicLoader").waitFor({ state: "hidden", timeout: 45000 });
    await openSidebar();
    fs.writeFileSync(path.join(output, "geometry.json"), JSON.stringify(await geometry(), null, 2));
    await checkItems("desktop-1440");
    if (baseline) return;
    await checkKeyboard();

    for (const viewport of [{ width: 1024, height: 640 }, { width: 768, height: 800 }, { width: 375, height: 667 }, { width: 375, height: 540 }]) {
      await page.setViewportSize(viewport);
      await openSidebar();
      await checkItems("viewport-" + viewport.width + "x" + viewport.height);
    }
    await checkKeyboard();
    await openSidebar();
    await items().last().click();
    await page.waitForURL((url) => url.hash === "#/fortune");
    await page.locator("#appCosmicLoader").waitFor({ state: "hidden", timeout: 45000 });
    pass("Mobile pointer click opens Xem bói from the last menu row");
    await page.evaluate(() => { location.hash = "#/all-game"; });
    await page.locator(".ag-card").first().waitFor({ timeout: 45000 });
    await page.locator("#appCosmicLoader").waitFor({ state: "hidden", timeout: 45000 });
    await openSidebar();

    const search = page.locator("[data-sidebar-search]");
    await search.fill("Xem bói");
    assert.equal(await page.locator('#sidebar-section-entertainment > [data-nav-item-route]:not([hidden])').count(), 1);
    await items().last().click({ trial: true });
    await search.fill("");
    await toggle().focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await toggle().getAttribute("aria-expanded"), "false");
    assert.equal(await items().last().isVisible(), false);
    await page.waitForFunction(() => document.activeElement.dataset.sidebarSectionToggle === "entertainment");
    await page.keyboard.press("ArrowRight");
    assert.equal(await toggle().getAttribute("aria-expanded"), "true");
    await page.waitForTimeout(400);
    const headerVisible = await toggle().evaluate((button) => {
      const region = button.closest(".app-sidebar__primary").querySelector("[data-sidebar-scroll-region]").getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      return rect.top >= region.top - 1 && rect.bottom <= region.bottom + 1;
    });
    assert.ok(headerVisible, "Expanding a group taller than the viewport keeps its focused header visible");
    await checkItems("mobile-search-collapse-reopen");
    pass("Search, keyboard collapse/reopen and visible focused group header");

    await page.setViewportSize({ width: 1024, height: 900 });
    await openSidebar();
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await checkItems("zoom-200");
    await page.evaluate(() => { document.documentElement.style.zoom = ""; });
    const largerText = await page.addStyleTag({ content: ".app-sidebar__subitem>b{font-size:29px!important}" });
    await checkItems("text-200");
    await largerText.evaluate((style) => style.remove());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await toggle().locator("[data-smart-chevron]").click({ modifiers: ["Shift"] });
    await page.waitForTimeout(600);
    const groups = await page.locator(".app-sidebar__category.is-expanded > .app-sidebar__submenu").evaluateAll((menus) => menus.map((menu) => {
      const rect = menu.getBoundingClientRect();
      return { id: menu.id, fits: [...menu.children].filter((row) => !row.hidden).every((row) => row.getBoundingClientRect().bottom <= rect.bottom + 1) };
    }));
    assert.ok(groups.length > 1 && groups.every((group) => group.fits), JSON.stringify(groups));
    await checkItems("all-groups-expanded");
    assert.deepEqual(errors, []);
    pass("All groups expand without clipping with animations enabled; no JavaScript or CSP errors");
  } catch (error) {
    await page?.screenshot({ path: path.join(output, "failure.png"), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
