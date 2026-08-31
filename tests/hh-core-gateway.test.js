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
  for (const method of ["normalizeRoute", "isGalaxyRoute", "isCoreRoute", "hasAccess", "enter", "leave", "resolveRoute"]) {
    assert.equal(typeof gateway[method], "function", method);
  }
  assert.ok(Object.isFrozen(gateway));
  assert.ok(Object.isFrozen(gateway.galaxyManifest));
  assert.ok(Object.isFrozen(gateway.coreManifest));
  assert.equal(gateway.coreManifest, gateway.coreRoutePrefixes);
});

test("the Galaxy manifest is an exact, access-free layer-one allowlist", () => {
  const storage = memoryStorage();
  const expected = [
    "/home",
    "/galaxy/ai",
    "/galaxy/music",
    "/galaxy/video",
    "/galaxy/creator",
    "/galaxy/games",
    "/galaxy/dev",
    "/galaxy/learning",
    "/galaxy/community",
    "/galaxy/tools",
    "/galaxy/analytics",
    "/galaxy/settings"
  ];
  assert.deepEqual(gateway.galaxyManifest, expected);

  for (const route of expected) {
    const result = gateway.resolveRoute(route, { storage });
    assert.deepEqual(result, {
      requested: route,
      route,
      allowed: true,
      redirected: false,
      layer: "galaxy"
    });
    assert.ok(Object.isFrozen(result), route);
  }

  assert.deepEqual(gateway.resolveRoute("https://hoang8.com/app#/galaxy/creator?tab=idea", { storage }), {
    requested: "/galaxy/creator",
    route: "/galaxy/creator",
    allowed: true,
    redirected: false,
    layer: "galaxy"
  });
  assert.equal(gateway.isGalaxyRoute("#/galaxy/ai/"), true);
  assert.equal(gateway.isGalaxyRoute("/galaxy"), false);
  assert.equal(gateway.isGalaxyRoute("/galaxy/ai/session"), false);
});

test("direct Core deep-links stay locked until HH Core grants this tab", () => {
  const storage = memoryStorage();
  const coreRoutes = ["#/create", "/home/dashboard", "/chat-ai", "/work/projects-tasks", "/settings", "/settings/account/profile"];
  for (const route of coreRoutes) {
    const result = gateway.resolveRoute(route, { storage });
    assert.equal(result.allowed, false, route);
    assert.equal(result.redirected, true, route);
    assert.equal(result.route, "/home", route);
    assert.equal(result.layer, "platform", route);
  }

  assert.equal(gateway.enter({ source: "sidebar", storage }), false);
  assert.equal(gateway.enter({ source: "galaxy-ai", storage }), false);
  assert.equal(gateway.hasAccess(storage), false);
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  assert.equal(gateway.hasAccess(storage), true);
  for (const route of coreRoutes) {
    const requested = gateway.normalizeRoute(route);
    assert.deepEqual(gateway.resolveRoute(route, { storage }), {
      requested,
      route: requested,
      allowed: true,
      redirected: false,
      layer: "platform"
    });
  }
});

test("unknown routes never inherit Core access", () => {
  const storage = memoryStorage();
  for (const route of ["/unknown", "/galaxy/ai/session", "/create-typo", "/settings-old"]) {
    assert.deepEqual(gateway.resolveRoute(route, { storage }), {
      requested: route,
      route: "/home",
      allowed: false,
      redirected: true,
      layer: "unknown"
    });
  }
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  for (const route of ["/unknown", "/galaxy/ai/session", "/create-typo", "/settings-old"]) {
    const result = gateway.resolveRoute(route, { storage });
    assert.equal(result.allowed, false, route);
    assert.equal(result.layer, "unknown", route);
    assert.equal(result.route, "/home", route);
  }
});

test("the Galaxy and Core manifests are disjoint", () => {
  assert.equal(new Set(gateway.galaxyManifest).size, gateway.galaxyManifest.length);
  assert.equal(new Set(gateway.coreManifest).size, gateway.coreManifest.length);
  for (const route of gateway.galaxyManifest) {
    assert.equal(gateway.isGalaxyRoute(route), true, route);
    assert.equal(gateway.isCoreRoute(route), false, route);
    for (const prefix of gateway.coreRoutePrefixes) {
      assert.equal(route === prefix || route.startsWith(`${prefix}/`), false, `${route} overlaps ${prefix}`);
    }
  }
  for (const prefix of gateway.coreRoutePrefixes) {
    assert.equal(gateway.isCoreRoute(prefix), true, prefix);
    assert.equal(gateway.isCoreRoute(`${prefix}/child`), true, `${prefix}/child`);
    assert.equal(gateway.isGalaxyRoute(prefix), false, prefix);
  }
});

test("explicit leave locks browser back and forward Core routes again", () => {
  const storage = memoryStorage();
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  assert.equal(gateway.leave({ source: "explicit-exit", storage }), true);
  assert.equal(gateway.hasAccess(storage), false);
  assert.deepEqual(gateway.resolveRoute("/create", { storage }), {
    requested: "/create",
    route: "/home",
    allowed: false,
    redirected: true,
    layer: "platform"
  });
  assert.equal(gateway.resolveRoute("/home", { storage }).allowed, true);
  assert.equal(gateway.resolveRoute("/galaxy/settings", { storage }).allowed, true);
});

test("router resolves the layer boundary before asking the asset loader", () => {
  const router = read("script.js");
  const loader = read("performance-loader.js");
  const home = read("galaxy-home-ai.js");

  const safeRender = router.slice(router.indexOf("const renderRouteSafely"), router.indexOf("const isExpectedRuntimeCancellation"));
  assert.match(safeRender, /const requestedRoute = routeFromHash\(\);[\s\S]*?const loader = window\.HHAssetLoader/);
  assert.match(router, /gateway\.resolveRoute\(route\)/);
  assert.match(router, /history\.replaceState[\s\S]*?#\$\{gateway\.gatewayRoute\}/);
  assert.match(router, /data-hh-core-exit/);
  assert.match(router, /HHCoreGateway\?\.leave\?\.\(\{ source: "logout" \}\)/);
  assert.match(home, /data-gha-entry="hh-core"[^>]*data-gha-route="\$\{CORE_ENTRY_ROUTE\}"/);
  assert.match(home, /enterCore\(runtime[\s\S]*?runtime\.options\.enterCore[\s\S]*?navigate\(runtime, destination\)/);
  assert.match(loader, /const allowed = gateway\?\.resolveRoute[\s\S]{0,240}?if \(allowed\) ensureForRoute/, "locked Platform routes must not prefetch before Core access");
});
