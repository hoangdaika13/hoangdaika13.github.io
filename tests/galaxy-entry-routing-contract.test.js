const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = require("../galaxy-home-ai.js");
const hubs = require("../galaxy-planet-hubs.js");
const loader = read("performance-loader.js");
const router = read("script.js");
const shell = read("galaxy-shell.js");
const shellStyles = read("galaxy-shell.css");

function memoryStorage() {
  return { getItem() { return null; }, setItem() {}, removeItem() {} };
}

test("HH Core is the only HH Platform entry rendered on the Galaxy Gateway", () => {
  const markup = home.viewMarkup("/home", home.collectLocalData(memoryStorage(), {}));
  assert.equal((markup.match(/data-gha-entry="hh-core"/g) || []).length, 1);
  assert.match(markup, /class="gha-core"[^>]*data-gha-entry="hh-core"[^>]*data-gha-route="\/create"/);
  assert.equal(home.CORE_ENTRY_ROUTE, "/create");
  assert.equal(home.PLANETS.length, 9);
  home.PLANETS.forEach((planet) => {
    assert.match(planet.route, /^\/galaxy\/[a-z-]+$/);
    assert.notEqual(planet.route, "/home/dashboard");
  });
});

test("planet hubs own the eleven isolated Galaxy destinations", () => {
  const expected = [
    "/galaxy/ai", "/galaxy/music", "/galaxy/video", "/galaxy/creator",
    "/galaxy/games", "/galaxy/dev", "/galaxy/learning", "/galaxy/community",
    "/galaxy/tools", "/galaxy/analytics", "/galaxy/settings"
  ];
  assert.deepEqual([...hubs.routes], expected);
  expected.forEach((route) => assert.equal(hubs.canHandle(route), true, route));
  assert.equal(hubs.canHandle("/home/dashboard"), false);
  assert.equal(hubs.canHandle("/music-ai"), false);
  assert.equal(typeof hubs.mount, "function");
  assert.equal(typeof hubs.unmount, "function");
  assert.equal(typeof hubs.getState, "function");
});

test("each hub exposes real internal targets and honest provider state", () => {
  for (const route of hubs.routes) {
    const markup = hubs.markup(route, {});
    assert.match(markup, new RegExp(`data-ghph-route="${route.replaceAll("/", "\\/")}"`));
    assert.match(markup, /data-ghph-open-route="\/[a-z0-9/-]+"/i);
    assert.doesNotMatch(markup, /href="https?:|window\.open|<iframe/i);
    assert.doesNotMatch(markup, /1\.2M|78\.4 GB|99\.9%|Online users|doanh thu/i);
  }
  const ai = hubs.markup("/galaxy/ai", {});
  assert.match(ai, /Cần cấu hình nếu dùng API/);
  assert.match(ai, /HH CORE<\/span><b>Local-first<\/b>/);
});

test("lazy loader and router mount and release the planet hub adapter", () => {
  assert.match(loader, /"galaxy-planet-hubs"\s*:\s*\{/);
  assert.match(loader, /galaxy-planet-hubs\.css\?v=1/);
  assert.match(loader, /galaxy-planet-hubs\.js\?v=1/);
  assert.match(loader, /"\/galaxy\/ai"[\s\S]{0,520}return \["galaxy-planet-hubs"\]/);
  assert.match(router, /HHGalaxyPlanetHubs\?\.canHandle\?\.\(route\)/);
  assert.match(router, /planetHub\.mount\?\.\(/);
  assert.ok((router.match(/HHGalaxyPlanetHubs\?\.unmount\?\.\(\)/g) || []).length >= 2);
});

test("canonical reference views and aliases use one immersive shell", () => {
  assert.match(shell, /function|const isImmersiveRoute/);
  for (const route of [
    "/home/dashboard", "/create/ai-center",
    "/create/workflow", "/work/automation-lab", "/work/projects-tasks",
    "/communication/community", "/music/ambient", "/system/desktop"
  ]) {
    assert.match(shell, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(shell, /data-galaxy-immersive/);
  assert.match(shellStyles, /data-galaxy-immersive="true"/);
  assert.match(shellStyles, /data-galaxy-immersive="true"[^\{]+>[\s\S]*?\.app-sidebar/);
});
