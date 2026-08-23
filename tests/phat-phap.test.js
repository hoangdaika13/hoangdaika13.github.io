const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Phật Pháp is a first-class routed workspace", () => {
  const router = read("script.js");
  const loader = read("performance-loader.js");
  const index = read("index.html");
  const sw = read("sw.js");

  assert.match(router, /id:\s*"phat-phap"/);
  assert.match(router, /route:\s*"\/phat-phap"/);
  assert.match(router, /window\.HHPhatPhap\?\.mount/);
  assert.match(router, /app-dharma-route/);
  assert.match(loader, /dharma:\s*\{/);
  assert.match(loader, /phat-phap\.css\?v=7/);
  assert.match(loader, /phat-phap\.js\?v=3/);
  assert.match(index, /performance-loader\.js\?v=474/);
  assert.match(index, /script\.js\?v=232/);
  assert.match(sw, /hh-identity-portal-v822/);
  assert.match(sw, /phat-phap\.css\?v=7/);
  assert.match(sw, /phat-phap\.js\?v=3/);
  assert.match(sw, /assets\/phat-phap\/duc-phat-hao-quang-v1\.webp/);
});

test("workspace uses a solemn Dharma palette and a single content scroller", () => {
  const css = read("phat-phap.css");
  assert.match(css, /--dharma-gold:\s*#d4a017/);
  assert.match(css, /--dharma-vermilion:\s*#983b22/);
  assert.match(css, /--dharma-ivory:\s*#fffaf0/);
  assert.match(css, /#appMain\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.dharma-workspace\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /dharmaIncense/);
  assert.match(css, /dharmaLamp/);
  assert.match(css, /dharmaLotus/);
  assert.match(css, /dharmaSacredHalo/);
  assert.match(css, /dharmaAuraBreath/);
  assert.match(css, /body\.app-dharma-route \.app-mobile-nav \{ display: none !important; \}/);
  assert.match(css, /body\.app-dharma-route\.app-sidebar-collapsed \.app-sidebar/);
  assert.doesNotMatch(css, /nebula|starfield|galaxy|planet|wormhole/i);
});

test("learning and practice features are real local-first capabilities", () => {
  const source = read("phat-phap.js");
  for (const contract of [
    "Lộ trình người mới", "Giáo lý", "Kinh điển", "Thiền & niệm Phật", "Chùa online",
    "Pháp thoại", "Thỉnh kinh", "Hỏi đáp có nguồn", "Nhật ký tu học"
  ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /hh\.phat-phap\.study\.v1/);
  assert.match(source, /hh\.phat-phap\.journal\.v1/);
  assert.match(source, /AES-GCM/);
  assert.match(source, /PBKDF2/);
  assert.match(source, /JOURNAL_ITERATIONS\s*=\s*180000/);
  assert.match(source, /speechSynthesis/);
  assert.match(source, /AudioContext/);
  assert.match(source, /data-dharma-aura/);
  assert.match(source, /assets\/phat-phap\/duc-phat-hao-quang-v1\.webp/);
  assert.match(source, /SuttaCentral/);
  assert.match(source, /Giáo hội Phật giáo Việt Nam/);
  assert.match(source, /Phật Sự Online/);
  assert.match(source, /không quy đổi thành công đức/i);
  assert.match(source, /không phải bản dịch kinh/i);
});

test("Dharma route gets a non-cosmic gold transition treatment", () => {
  const router = read("script.js");
  const css = read("app-shell.css");
  assert.match(router, /"phat-phap":\s*"dharma"/);
  assert.match(router, /kind === "dharma" \? "PHẬT PHÁP · TRUNG TÂM TU HỌC"/);
  assert.match(css, /data-transition-kind="dharma"/);
  assert.match(css, /appDharmaLoaderWheel/);
  assert.match(css, /appDharmaLoaderPetal/);
  assert.match(css, /app-cosmic-loader__space[^}]*display:none!important/s);
});

test("original Buddha hero artwork is optimized and aura modes stay local-first", () => {
  const asset = path.join(root, "assets", "phat-phap", "duc-phat-hao-quang-v1.webp");
  const source = read("phat-phap.js");
  assert.equal(fs.existsSync(asset), true);
  assert.ok(fs.statSync(asset).size < 400_000, "hero artwork should remain fast enough for route loading");
  for (const mode of ["gentle", "radiant", "ceremonial"]) assert.match(source, new RegExp(`id: "${mode}"`));
  assert.match(source, /visual:\s*\{ aura: "radiant" \}/);
  assert.match(source, /state\.visual = \{ \.\.\.state\.visual, aura: next\.id \}/);
});
