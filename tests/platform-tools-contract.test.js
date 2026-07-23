const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "platform-tools.js"), "utf8");
const css = fs.readFileSync(path.join(root, "platform-tools.css"), "utf8");

const tools = [
  "Global Search", "Command Palette++", "Dark Light Auto Mode", "Theme Color Switcher",
  "Realtime Notification", "Loading Skeleton", "Page Progress Bar", "FPS Monitor",
  "History Manager", "Favorite Manager", "Export Data", "Import Data", "PWA",
  "Offline Mode", "Install App", "Keyboard Shortcut System", "Settings Center"
];

test("Platform runtime declares a manifest and a dedicated route for every requested tool", () => {
  tools.forEach((name) => assert.match(source, new RegExp(`\\[\\"[^\\"]+\\", \\"${name.replace(/[+]/g, "\\+")}\\"`), name));
  assert.match(source, /route: `\/tools\/platform\/\$\{id\}`/);
  assert.match(source, /permissions, actions, history, offline/);
});

test("Platform tools use real browser engines and explicit capability fallbacks", () => {
  ["indexedDB.open", "requestAnimationFrame", "PerformanceObserver", "Notification.requestPermission", "serviceWorker", "caches.keys", "navigator.storage", "beforeinstallprompt", "matchMedia"].forEach((contract) => assert.ok(source.includes(contract), contract));
  assert.match(source, /Trình duyệt không hỗ trợ Notification API/);
  assert.match(source, /Install Prompt chưa sẵn sàng/);
  assert.match(source, /GPU telemetry/);
});

test("Import validates schema and export excludes common secret-bearing keys", () => {
  assert.match(source, /HH Platform Tools Export/);
  assert.match(source, /Tệp vượt quá giới hạn 5 MB/);
  assert.match(source, /\(token\|secret\|password\|credential\|session\)/);
  assert.match(source, /Chưa có tệp đã được kiểm tra/);
});

test("Feature Lab integration replaces generic textarea workspace without editing its shell", () => {
  assert.match(source, /HHFeatureLab/);
  assert.match(source, /data-lab-feature/);
  assert.match(source, /platformToolsIntegrated/);
  assert.match(source, /HHPlatformTools/);
});

test("Responsive and accessibility contracts are present", () => {
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-busy/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
});

test("User-facing source is UTF-8 and contains no common mojibake sequences", () => {
  assert.doesNotMatch(source, /Ã|Â|Ä|á»|áº|â€|â†|âœ/);
  assert.match(source, /Không thể hoàn thành thao tác/);
  assert.match(source, /Đã lưu cài đặt trên thiết bị/);
});
