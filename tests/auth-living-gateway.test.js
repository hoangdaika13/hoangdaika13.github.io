const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const modules = [
  "auth-living-background",
  "auth-creative-universe",
  "auth-logo-motion",
  "auth-form-motion",
  "auth-transition-runtime"
];

test("living gateway modules are loaded by the auth shell", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const shellAssets = `${html}\n${loader}`;
  for (const module of modules) {
    assert.match(shellAssets, new RegExp(`${module}\\.css\\?v=\\d+`), `${module}.css is not registered`);
    assert.match(shellAssets, new RegExp(`${module}\\.js\\?v=\\d+`), `${module}.js is not registered`);
  }
});

test("background animation is adaptive and pauses when it is not useful", () => {
  const css = read("auth-living-background.css");
  const client = read("auth-living-background.js");
  assert.match(css, /aurora/i);
  assert.match(css, /25s|30s|35s|40s/);
  assert.match(client, /canvas/i);
  assert.match(client, /requestAnimationFrame/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /prefers-reduced-motion:\s*reduce/);
  assert.match(client, /deviceMemory|saveData|effectiveType/);
});

test("creative universe is keyboard accessible and remembers the selected module", () => {
  const css = read("auth-creative-universe.css");
  const client = read("auth-creative-universe.js");
  for (const module of [
    "Trang chủ", "Sáng tạo", "Làm nhạc AI", "Media & Design", "Thiết kế đồ họa", "DEV",
    "Công việc", "Giao tiếp", "Giải trí", "Phân tích", "Học tập", "HH English", "Hệ thống", "Ủng hộ"
  ]) {
    assert.match(client, new RegExp(module, "i"));
  }
  assert.match(css, /orbit/i);
  assert.match(client, /hh\.auth\.selected-universe/);
  assert.match(client, /hh\.auth\.pending-route/);
  assert.match(client, /hh:auth-universe-select/);
  assert.match(client, /ArrowLeft|ArrowRight|ArrowUp|ArrowDown/);
  assert.match(client, /8000|8_000/);
});

test("logo, form and transition expose explicit visual states without browser dialogs", () => {
  const logo = read("auth-logo-motion.js");
  const form = read("auth-form-motion.js");
  const transition = read("auth-transition-runtime.js");
  const source = `${logo}\n${form}\n${transition}`;
  for (const state of ["idle", "hover", "focus", "loading", "success", "error"]) {
    assert.match(source, new RegExp(state, "i"));
  }
  assert.match(logo, /data-logo-state|logoState|logo-state/i);
  assert.match(form, /--(?:auth-form|afm)-(?:pointer|spot|tilt)/i);
  assert.match(transition, /hh\.auth\.motion-mode/);
  assert.match(transition, /static|balanced|vivid/);
  assert.match(transition, /online|offline/);
  assert.match(transition, /waitForCompletion|transition-complete/);
  assert.doesNotMatch(source, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
});

test("every motion layer respects reduced motion", () => {
  for (const module of modules) {
    const css = read(`${module}.css`);
    const client = read(`${module}.js`);
    assert.match(`${css}\n${client}`, /prefers-reduced-motion/i, `${module} ignores reduced motion`);
  }
});
