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

test("All Tools data and appearance stay independent from auth and other workspaces", () => {
  assert.match(source, /HHAllToolState\?\.accountScope/);
  assert.match(source, /indexedDB\.open\(`\$\{DB_NAME\}:\$\{encodeURIComponent\(owner\)\}`/);
  assert.match(source, /hh\.all-tools\.appearance\.v1/);
  assert.match(source, /hh:alltools-appearance-change/);
  assert.doesNotMatch(source, /document\.documentElement\.(?:dataset|style)/);
  assert.doesNotMatch(source, /hh:offline-retry/);
  assert.match(source, /transaction\.oncomplete/);
  assert.match(source, /Chỉ áp dụng bên trong All Tools/);
});

test("workspace cleanup and truthful utility states are explicit", () => {
  assert.match(source, /state\.longTaskObserver\?\.disconnect/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /pointer|data-pt-favorite-down/);
  assert.match(source, /không có API\/tệp nào được tải/);
  assert.match(source, /Không có nguồn realtime máy chủ/);
  assert.match(css, /container-type:inline-size/);
  assert.match(css, /@container\(max-width:700px\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
});
