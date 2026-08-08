const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-command.js");
const styles = read("home-galaxy-command.css");

test("Galaxy Command V3 is one screen with three purposeful regions", () => {
  for (const contract of ["hgc-commandbar", "hgc-today-panel", "hgc-galaxy-panel", "hgc-info-center", "hgc-one-screen"]) {
    assert.ok(source.includes(contract), `missing ${contract}`);
    assert.ok(styles.includes(contract), `missing styles for ${contract}`);
  }
  assert.doesNotMatch(source, /<section class="hgc-live"/);
  assert.doesNotMatch(source, /<section class="hgc-activity"/);
  assert.match(styles, /\.dashboard-home\.hgc-active\s*>\s*:not\(#homeGalaxyCommandRoot\)/);
  assert.match(styles, /\.app-main\.hgc-main-active[\s\S]*?overflow:\s*hidden/);
});

test("today and information panels use real local data contracts", () => {
  for (const key of [
    "hh.command-center.todos.v2",
    "hh-project-center",
    "hh.communication.intelligence.v1",
    "hh.learning.os.v1",
    "hh.app-shell.recent"
  ]) assert.ok(source.includes(key), `missing data contract ${key}`);
  for (const card of ["tasks", "calendar", "learning", "continue", "notifications"]) {
    assert.match(source, new RegExp(`data-hgc-today=\\"${card}\\"`));
  }
  for (const tab of ["overview", "work", "learning", "website", "notifications", "progress"]) {
    assert.match(source, new RegExp(`\\[\\"${tab}\\"`));
  }
  assert.match(source, /item\?\.dueAt \|\| item\?\.dueDate \|\| item\?\.deadline/);
});

test("planets select before navigation and five pins are persisted", () => {
  assert.match(source, /pinned:\s*\["home", "creative", "work", "learning", "japanese"\]/);
  assert.match(source, /\.slice\(0, 5\)/);
  assert.match(source, /function selectPlanet/);
  assert.match(source, /function stepPlanet/);
  assert.match(source, /data-hgc-planet-open/);
  assert.match(source, /data-hgc-pin-planet/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /boundRoots = new WeakSet/);
  assert.match(source, /button\[data-hgc-theme\]/);
  assert.match(source, /button\[data-hgc-motion\]/);
});

test("Basic Advanced Focus, mobile panes and quick actions are functional", () => {
  for (const mode of ["basic", "advanced", "focus"]) assert.match(source, new RegExp(`\\[\\"${mode}\\"`));
  for (const pane of ["today", "galaxy", "info"]) assert.ok(source.includes(`data-hgc-mobile-pane-option="${pane}"`));
  for (const route of ["/create/ai-center", "/davinci-resolve/youtube", "/davinci-resolve/image-text", "/music-ai", "/work", "/learn/review"]) {
    assert.ok(source.includes(route), `missing quick route ${route}`);
  }
  assert.match(styles, /@media\s*\(max-width:\s*1120px\)/);
  assert.match(styles, /data-hgc-mobile-pane="today"/);
  assert.match(styles, /data-hgc-view="focus"/);
  assert.match(styles, /height:\s*100%/);
});
