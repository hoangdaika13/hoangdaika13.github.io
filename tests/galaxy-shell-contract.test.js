const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const client = read("galaxy-shell.js");
const tokens = read("galaxy-design-system.css");
const shellStyles = read("galaxy-shell.css");
const guide = read(path.join("docs", "HH_GALAXY_DESIGN_SYSTEM.md"));
const loader = read("performance-loader.js");
const router = read("script.js");
const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
const layerOne = require("../galaxy-layer-one.js");

const loadApi = () => {
  const window = {};
  vm.runInNewContext(client, { window, globalThis: window, URL }, { filename: "galaxy-shell.js" });
  return window.HHGalaxyShell;
};

test("Galaxy Shell exposes a frozen, versioned lifecycle API", () => {
  const api = loadApi();
  assert.ok(api);
  assert.equal(api.version, 1);
  assert.equal(api.flagKey, "hh.galaxy-shell.v1");
  for (const method of ["mount", "unmount", "syncRoute", "getState", "isEnabled", "setEnabled"]) {
    assert.equal(typeof api[method], "function", `missing ${method}`);
  }
  assert.ok(Object.isFrozen(api));
  assert.ok(Object.isFrozen(api.routeManifest));
  assert.equal(api.syncRoute("#/work/automation-lab/runs").id, "automation-builder");
  assert.equal(api.syncRoute("/music-ai/mix").id, "music-ai");
  assert.equal(api.syncRoute("/cosmic-observatory/solar-system").id, "universe");
  assert.equal(api.syncRoute("/home/dashboard").id, "personal-dashboard");
  assert.equal(api.syncRoute("/create/ai-center").id, "ai-universe");
  assert.equal(api.syncRoute("/create/workflow").id, "creator-studio");
  assert.equal(api.syncRoute("/communication/community").id, "community-showcase");
  assert.equal(api.syncRoute("/system/desktop").id, "web-desktop");
  assert.equal(api.syncRoute("/system").id, "tools-galaxy");
});

test("route manifest has stable semantic fields and no provider readiness claims", () => {
  const { routeManifest } = loadApi();
  assert.ok(routeManifest.length >= 25, "major HH Platform routes must have an owner");
  const ids = new Set();
  const routes = new Set();
  const validLayouts = new Set(["atlas", "standard", "dashboard", "three-column", "workbench", "media-dock", "desktop"]);

  routeManifest.forEach((entry) => {
    for (const key of ["id", "planet", "title", "route", "aliases", "assetGroup", "layout", "capabilities", "adminOnly"]) {
      assert.ok(Object.hasOwn(entry, key), `${entry.id || "route"} misses ${key}`);
    }
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.adminOnly, "boolean");
    assert.ok(entry.route.startsWith("/"));
    assert.ok(Array.isArray(entry.aliases));
    assert.ok(Array.isArray(entry.capabilities));
    assert.ok(validLayouts.has(entry.layout));
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
    assert.ok(!routes.has(entry.route), `duplicate route ${entry.route}`);
    ids.add(entry.id);
    routes.add(entry.route);
  });

  for (const id of ["home-galaxy", "personal-dashboard", "project-hub", "automation-builder", "ai-universe", "ai-copilot", "music-planet", "video-planet", "games-world", "dev-planet", "learning-star", "community", "tools-galaxy"]) {
    assert.ok(ids.has(id), `missing Galaxy destination ${id}`);
  }
  assert.doesNotMatch(client, /12\.5K|99\.9% uptime|đã kết nối|online users/i);
});

test("Platform shell does not claim Layer One routes or legacy aliases", () => {
  const api = loadApi();
  const claimedAliases = new Set(api.routeManifest.flatMap((entry) => entry.aliases));
  for (const legacyRoute of ["/create", "/work/project-hub", "/settings/user-dashboard"]) {
    assert.equal(claimedAliases.has(legacyRoute), false, `${legacyRoute} must remain owned by its legacy workspace`);
  }
  assert.equal(api.syncRoute("/create").id, "creative-center");
  assert.equal(api.syncRoute("/work/project-hub").id, "work-center");
  assert.equal(api.syncRoute("/settings/user-dashboard").id, "settings");

  for (const galaxyRoute of layerOne.routes.filter((route) => route !== "/home")) {
    const claimed = api.routeManifest.some((entry) => entry.route === galaxyRoute || entry.aliases.includes(galaxyRoute));
    assert.equal(claimed, false, `${galaxyRoute} belongs only to HHGalaxyLayerOne`);
    assert.equal(api.syncRoute(galaxyRoute).id, "home-galaxy");
  }
});

test("enhancer preserves feature DOM and restores every owned attribute", () => {
  assert.match(client, /data-galaxy-shell/);
  assert.match(client, /data-galaxy-chrome/);
  assert.match(client, /data-galaxy-outlet/);
  assert.match(client, /rememberAttribute/);
  assert.match(client, /restoreAttributes/);
  assert.match(client, /createdEffectOwner/);
  assert.match(client, /removeEventListener/);
  assert.doesNotMatch(client, /\.innerHTML\s*=|replaceChildren\(|outerHTML\s*=/, "foundation must not replace routed feature DOM");
});

test("feature flag, route sync and the single effect owner are explicit", () => {
  assert.match(client, /const FLAG_KEY = "hh\.galaxy-shell\.v1"/);
  assert.match(client, /data-galaxy-effect-policy/);
  assert.match(client, /data-galaxy-effect-owner/);
  assert.match(client, /hashchange/);
  assert.match(client, /listen\(global, "hh:route-rendered"/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /hh:media-playback/);
  assert.match(shellStyles, /> \[data-galaxy-effect-owner="shell"\]/);
  assert.match(shellStyles, /data-galaxy-media-active="true"/);
  assert.doesNotMatch(client, /requestAnimationFrame|WebGL|canvas\.getContext/, "the persistent chrome must not create a competing render loop");
});

test("runtime rollback cleans adapters and immediately rerenders the current route", () => {
  assert.match(client, /emit\("hh:galaxy-shell-enabled-change"/);
  assert.match(router, /addEventListener\("hh:galaxy-shell-enabled-change"/);
  assert.match(router, /cleanupGalaxyEngineTakeover\(\);[\s\S]{0,240}HHGalaxyHomeAI\?\.unmount[\s\S]{0,240}HHGalaxyDomainViews\?\.unmount[\s\S]{0,240}renderRouteSafely\(\)/);
  assert.match(router, /galaxyEngineCleanup\s*=\s*\(\)\s*=>\s*window\.HHWorkCenter\?\.unmount/);
  assert.match(router, /galaxyEngineCleanup\s*=\s*\(\)\s*=>\s*window\.HHCommunicationSuite\?\.unmount/);
});

test("Galaxy Shell joins the existing brand loader without increasing first-paint requests", () => {
  assert.match(loader, /brand:[\s\S]*?hh-core-gateway\.js\?v=2[\s\S]*?galaxy-shell\.js\?v=7/);
  assert.match(router, /HHAssetLoader\?\.ensureGroup\?\.\("brand"\)/);
  assert.match(router, /brandReady\.then\(initAppShell, initAppShell\)/);
  assert.doesNotMatch(html, /<script\b[^>]*src=["'][^"']*(?:hh-core-gateway|galaxy-shell)\.js/);
});

test("Platform layer restores the shared header and sidebar on every inner route", () => {
  assert.match(shellStyles, /\[data-galaxy-shell\]\[data-hh-layer="platform"\] > \.app-header/);
  assert.match(shellStyles, /\[data-galaxy-shell\]\[data-hh-layer="platform"\] > \.app-shell__body/);
  assert.match(shellStyles, /grid-template-columns:\s*var\(--sidebar-width/);
  assert.match(shellStyles, /display:\s*grid\s*!important/);
  assert.match(shellStyles, /data-hh-layer="platform"[^\{]+\.app-sidebar-backdrop\s*\{[\s\S]{0,320}?display:\s*none\s*!important/, "desktop backdrop must not create an implicit grid row");
  assert.match(shellStyles, /@media \(max-width:\s*767px\)[\s\S]+data-hh-layer="platform"[^\{]+\.app-sidebar-backdrop\s*\{[\s\S]{0,420}?position:\s*fixed[\s\S]{0,220}?display:\s*block\s*!important/, "mobile backdrop must stay outside the grid as a fixed drawer layer");
});

test("semantic tokens reproduce the approved HH Galaxy foundation", () => {
  for (const value of ["#020611", "#030816", "#071120", "#0a1629", "#101f3a", "#f6f7ff", "#b4bfd4", "#7887a3", "#8b5cf6", "#a855f7", "#38bdf8", "#3b82f6", "#ec4899", "#34d399", "#f59e0b", "#fb7185"]) {
    assert.match(tokens.toLowerCase(), new RegExp(value), `missing token ${value}`);
  }
  assert.match(tokens, /"Be Vietnam Pro"/);
  assert.match(tokens, /--galaxy-control-min:\s*44px/);
  assert.match(tokens, /:focus-visible/);
  assert.match(tokens, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(tokens, /@media \(forced-colors: active\)/);
});

test("all seven layout profiles and responsive breakpoints are defined", () => {
  for (const layout of ["atlas", "standard", "dashboard", "three-column", "workbench", "media-dock", "desktop"]) {
    assert.match(shellStyles, new RegExp(`data-galaxy-layout="${layout}"`));
  }
  for (const variable of ["--header-h", "--sidebar-w", "--rail-w", "--library-w", "--inspector-w", "--dock-h", "--layout-gap"]) {
    assert.match(shellStyles, new RegExp(variable));
  }
  for (const breakpoint of ["1439px", "1179px", "767px"]) assert.match(shellStyles, new RegExp(breakpoint));
  assert.match(shellStyles, /env\(safe-area-inset-bottom\)/);
  assert.match(shellStyles, /overflow-x:\s*clip/);
});

test("design-system guide documents rollout, capability truth and rollback", () => {
  assert.match(guide, /hh\.galaxy-shell\.v1/);
  assert.match(guide, /Không.*dữ liệu giả/i);
  assert.match(guide, /rollback|quay lại/i);
  assert.match(guide, /mount\(\)|unmount\(\)|syncRoute\(\)|getState\(\)/);
  assert.match(guide, /loading[\s\S]*ready[\s\S]*empty[\s\S]*offline/);
});
