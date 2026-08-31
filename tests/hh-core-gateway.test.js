const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateway = require("../hh-core-gateway.js");

function memoryStorage() {
  const records = new Map();
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, String(value)); },
    removeItem(key) { records.delete(key); }
  };
}

test("HH Core Gateway exposes a frozen session-scoped boundary", () => {
  assert.equal(global.HHCoreGateway, gateway);
  assert.equal(gateway.version, 1);
  assert.equal(gateway.storageKey, "hh.core-gateway.v1");
  assert.equal(gateway.gatewayRoute, "/home");
  assert.equal(gateway.platformEntryRoute, "/create");
  assert.equal(gateway.entrySource, "hh-core");
  for (const method of ["normalizeRoute", "hasAccess", "enter", "leave", "resolveRoute"]) {
    assert.equal(typeof gateway[method], "function", method);
  }
  assert.ok(Object.isFrozen(gateway));
});

test("a direct Platform deep-link is locked until HH Core grants this tab", () => {
  const storage = memoryStorage();
  for (const route of ["#/create", "/chat-ai", "/work/projects-tasks", "/settings"]) {
    const result = gateway.resolveRoute(route, { storage });
    assert.equal(result.allowed, false, route);
    assert.equal(result.redirected, true, route);
    assert.equal(result.route, "/home", route);
    assert.equal(result.layer, "gateway", route);
  }
  assert.equal(gateway.enter({ source: "sidebar", storage }), false);
  assert.equal(gateway.hasAccess(storage), false);
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  assert.equal(gateway.hasAccess(storage), true);
  assert.deepEqual(gateway.resolveRoute("#/create", { storage }), {
    requested: "/create",
    route: "/create",
    allowed: true,
    redirected: false,
    layer: "platform"
  });
});

test("explicit leave locks browser back and forward routes again", () => {
  const storage = memoryStorage();
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  assert.equal(gateway.leave({ source: "explicit-exit", storage }), true);
  assert.equal(gateway.hasAccess(storage), false);
  assert.equal(gateway.resolveRoute("/create", { storage }).route, "/home");
  assert.equal(gateway.resolveRoute("/home", { storage }).allowed, true);
});

test("router resolves the layer boundary before asking the asset loader", () => {
  const router = read("script.js");
  const loader = read("performance-loader.js");
  const sw = read("sw.js");
  const home = read("galaxy-home-ai.js");

  const safeRender = router.slice(router.indexOf("const renderRouteSafely"), router.indexOf("const isExpectedRuntimeCancellation"));
  assert.match(safeRender, /const requestedRoute = routeFromHash\(\);[\s\S]*?const loader = window\.HHAssetLoader/);
  assert.match(router, /gateway\.resolveRoute\(route\)/);
  assert.match(router, /history\.replaceState[\s\S]*?#\$\{gateway\.gatewayRoute\}/);
  assert.match(router, /data-hh-core-exit/);
  assert.match(router, /HHCoreGateway\?\.leave\?\.\(\{ source: "logout" \}\)/);
  assert.match(router, /platformSafeRoute/);
  assert.match(router, /window\.HHCoreGateway\) window\.HHGalaxyShell\.setEnabled\(true/, "legacy shell preferences cannot remove the mandatory Gateway");
  assert.match(router, /route === gateway\.gatewayRoute && gateway\.hasAccess\(\)[\s\S]{0,360}?platformEntryRoute/, "legacy Home commands must remain inside an active Platform session");
  assert.match(router, /workspaceOwnsMobileDock[\s\S]{0,360}?dataset\.hhLayer === "gateway"/, "Gateway must own and suppress the Platform mobile dock");
  assert.match(router, /const syncCoreLayer[\s\S]{0,260}?syncMobileSidebarDock\(\)/, "layer changes must resync the mobile dock before route assets load");
  assert.match(home, /data-gha-entry="hh-core"[^>]*data-gha-route="\$\{CORE_ENTRY_ROUTE\}"/);
  assert.match(home, /enterCore\(runtime[\s\S]*?runtime\.options\.enterCore[\s\S]*?navigate\(runtime, destination\)/);
  assert.match(loader, /hh-core-gateway\.js\?v=1/);
  assert.match(loader, /value === "\/home"\) return \["galaxy-home-ai"\]/, "Gateway assets must ignore the retired shell flag");
  assert.match(loader, /const allowed = gateway\?\.resolveRoute[\s\S]{0,240}?if \(allowed\) ensureForRoute/, "locked Platform routes must not prefetch before Core access");
  assert.match(sw, /hh-core-gateway\.js\?v=1/);
});
