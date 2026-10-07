"use strict";
// Local fixture QA only. Supply Playwright from the development runtime; no production account/API.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.HH_PLAYWRIGHT_PATH || "playwright");
const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer(async (req, res) => {
  try {
    const filename = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    res.setHeader("Content-Type", mime[path.extname(filename)] || "application/octet-stream");
    res.end(await fs.readFile(filename));
  } catch { res.writeHead(404); res.end(); }
});
async function run() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.HH_BROWSER_EXECUTABLE ? { executablePath: process.env.HH_BROWSER_EXECUTABLE } : {}) });
  const captures = await fs.mkdtemp(path.join(os.tmpdir(), "hh-admin-profile-qa-"));
  const results = [];
  try {
    for (const width of [1440, 768, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", err => errors.push(err.message));
      page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/tests/fixtures/admin-recent-accounts.html`);
      const open = async () => { await page.locator("[data-ar-open]").click(); await page.locator("[data-ar-profile-pane]").waitFor(); };
      const tab = async name => { await page.getByRole("tab", { name, exact: true }).click(); await page.waitForFunction(() => !!document.querySelector("[data-ar-profile-pane]") && !document.querySelector("[data-ar-profile-pane][aria-busy]")); };
      await open();
      assert.equal(await page.getByRole("tab").count(), 9);
      for (const name of ["Đăng nhập & bảo mật", "Phiên & thiết bị", "Workspace", "Quyền & vai trò", "Hỗ trợ", "Audit Admin", "Ghi chú & xem xét", "Quyền riêng tư", "Tổng quan"]) await tab(name);
      const downloaded = page.waitForEvent("download");
      await page.locator("[data-ar-profile-export]").click();
      const download = await downloaded;
      assert.equal(download.suggestedFilename(), "hh-account-profile.json");
      const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
      assert.equal(exported.qaOnly, true);
      await tab("Phiên & thiết bị");
      await page.locator("[data-ar-revoke]").click();
      await page.locator('[name="reason"]').fill("QA thu hồi phiên");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator('[data-ar-session="revoked"]').waitFor();
      await tab("Đăng nhập & bảo mật");
      await page.locator("[data-ar-event-result]").selectOption("failed");
      assert.equal(await page.locator("[data-ar-event]:visible").count(), 1);
      await page.locator("[data-ar-event-from]").fill("2099-01-01");
      assert.equal(await page.locator("[data-ar-event]:visible").count(), 0);
      await page.locator("[data-ar-event-from]").fill("");
      assert.equal(await page.locator("[data-ar-event]:visible").count(), 1);
      await page.getByRole("tab", { name: "Đăng nhập & bảo mật", exact: true }).press("End");
      await page.waitForFunction(() => document.querySelector('[data-ar-tab="privacy"]')?.getAttribute("aria-selected") === "true");
      await tab("Ghi chú & xem xét");
      await page.getByRole("button", { name: "Thêm ghi chú", exact: true }).click();
      await page.locator('[name="text"]').fill('QA <img src=x onerror="window.qaXss=true"> ghi chú');
      await page.locator('[name="reason"]').fill("QA tạo ghi chú");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator("[data-ar-edit-note]").waitFor();
      assert.equal(await page.locator(".ar-entry img").count(), 0);
      await page.locator("[data-ar-edit-note]").click();
      await page.locator('[name="text"]').fill("QA đã chỉnh sửa");
      await page.locator('[name="reason"]').fill("QA sửa ghi chú");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator("[data-ar-review]").waitFor();
      assert.ok((await page.locator("[data-ar-profile-pane]").innerText()).includes("QA đã chỉnh sửa"));
      await page.locator("[data-ar-review]").click();
      await page.locator('[name="review"]').check();
      await page.locator('[name="priority"]').selectOption("high");
      await page.locator('[name="reason"]').fill("QA cần xem xét");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator(".ar-review-card").waitFor();
      assert.ok((await page.locator(".ar-review-card").innerText()).includes("high"));
      await page.locator("[data-ar-delete-note]").click();
      await page.locator('[name="reason"]').fill("QA xóa ghi chú thử");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator("[data-ar-review]").waitFor();
      assert.equal(await page.locator("[data-ar-edit-note]").count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog").count(), 0);
      assert.equal(await page.locator("[data-ar-open]").evaluate(el => el === document.activeElement), true);
      await page.getByRole("button", { name: "Chữ 200%", exact: true }).click();
      await open(); await tab("Quyền riêng tư");
      const layout = await page.evaluate(() => {
        const d = document.querySelector("dialog"), main = d.querySelector("form>main");
        return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, dialogWidth: d.getBoundingClientRect().width, panelWidth: main.clientWidth, panelScrollWidth: main.scrollWidth, font: getComputedStyle(document.documentElement).fontSize };
      });
      assert.equal(layout.font, "32px");
      assert.ok(layout.pageWidth <= width, JSON.stringify(layout));
      assert.ok(layout.dialogWidth <= width, JSON.stringify(layout));
      assert.ok(layout.panelScrollWidth <= layout.panelWidth + 1, JSON.stringify(layout));
      await page.screenshot({ path: path.join(captures, `profile-${width}-200pct.png`) });
      await page.emulateMedia({ forcedColors: "active" });
      assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true);
      assert.ok(await page.getByRole("tab", { name: "Quyền riêng tư", exact: true }).isVisible());
      await page.emulateMedia({ forcedColors: "none" });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Lỗi API", exact: true }).click();
      await page.getByRole("heading", { name: "Không tải được dữ liệu quản trị" }).waitFor();
      await page.getByRole("button", { name: "Bình thường", exact: true }).click();
      await page.locator("[data-ar-open]").waitFor();
      await page.locator("[data-ar-open]").click(); await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      assert.equal(await page.locator("dialog").count(), 0);
      await context.close();
      assert.deepEqual(errors, []);
      results.push({ width, tabs: 9, notes: "create/edit/delete", review: true, profileExport: true, revokeFixtureSession: true, keyboard: true, forcedColors: true, xss: "escaped", zoom: "200%", overflow: false, errors: 0 });
    }
    console.log(JSON.stringify({ results, captures }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
