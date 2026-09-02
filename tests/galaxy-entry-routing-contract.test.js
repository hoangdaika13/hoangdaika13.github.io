const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = require("../galaxy-home-ai.js");
const gateway = require("../hh-core-gateway.js");
const layerOne = require("../galaxy-layer-one.js");
const layerOneData = require("../galaxy-layer-one-data.js");
require("../galaxy-domain-views.js");
const domainViews = global.HHGalaxyDomainViews;
const legacyPlanetHubs = require("../galaxy-planet-hubs.js");
const loader = read("performance-loader.js");
const router = read("script.js");
const shell = read("galaxy-shell.js");
const shellStyles = read("galaxy-shell.css");

const layerOneRoutes = Object.freeze([
  "/home", "/galaxy/ai", "/galaxy/music", "/galaxy/video", "/galaxy/creator",
  "/galaxy/games", "/galaxy/dev", "/galaxy/learning", "/galaxy/community",
  "/galaxy/tools", "/galaxy/analytics", "/galaxy/settings"
]);

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

  const entryRuntime = [
    router,
    read("galaxy-home-ai.js"),
    read("galaxy-layer-one.js"),
    read("galaxy-creator-studio.js"),
    read("galaxy-layer-one-data.js")
  ].join("\n");
  assert.equal(
    (entryRuntime.match(/(?:HHCoreGateway\?\.enter\?\.\(|gateway\.enter\(\{ source: gateway\.entrySource \}\))/g) || []).length,
    1,
    "only the verified Home HH Core transaction may call the gateway entry"
  );
  assert.match(router, /enterCore:\s*\(request\s*=\s*\{\}\)\s*=>\s*grantCoreAccessFromGateway\(request\)/);
  assert.match(router, /const grantCoreAccessFromGateway =[\s\S]*?gateway\.enter\(\{ source: gateway\.entrySource \}\)[\s\S]*?gateway\.hasAccess\(\) === true/);
  assert.doesNotMatch(read("galaxy-layer-one.js"), /HHCoreGateway|\.enter\s*\(/);
});

test("legacy Gateway anchors authorize the same verified HH Core transaction as Home", () => {
  const helperStart = router.indexOf("const grantCoreAccessFromGateway =");
  const helperEnd = router.indexOf("const routeFromHash =", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = router.slice(helperStart, helperEnd);
  assert.match(helper, /currentRouteValue\s*=\s*gateway\.normalizeRoute/);
  assert.match(helper, /currentRouteValue === "\/top"\s*\|\|\s*currentRouteValue === "\/account"/);
  assert.match(helper, /\?\s*gateway\.gatewayRoute\s*:\s*currentRouteValue/);
  assert.match(helper, /currentRoute !== gateway\.gatewayRoute/);
  assert.match(router, /const rawRoute = hash === "top" \|\| hash === "account" \? "\/home"/);
});

test("Galaxy Layer One owns the exact twelve access-free destinations", () => {
  assert.deepEqual([...layerOne.routes], layerOneRoutes);
  assert.deepEqual([...gateway.galaxyManifest], layerOneRoutes);
  layerOneRoutes.forEach((route) => {
    assert.equal(layerOne.canHandle(route), true, route);
    assert.equal(gateway.resolveRoute(route, { storage: memoryStorage() }).layer, "galaxy", route);
  });
  assert.equal(layerOne.canHandle("/home/dashboard"), false);
  assert.equal(layerOne.canHandle("/music-ai"), false);
  assert.equal(layerOne.canHandle("/create"), false);
  assert.equal(typeof layerOne.mount, "function");
  assert.equal(typeof layerOne.unmount, "function");
  assert.equal(typeof layerOne.syncRoute, "function");
  assert.equal(typeof layerOne.getState, "function");
});

test("retired Galaxy adapters retain compatibility metadata without claiming Layer One routes", () => {
  assert.ok(domainViews, "HHGalaxyDomainViews must remain available for canonical Core views");
  for (const route of layerOneRoutes) {
    assert.equal(domainViews.canHandle(route), false, `Domain Views still claims ${route}`);
    assert.equal(legacyPlanetHubs.canHandle(route), false, `Planet Hubs still claims ${route}`);
  }

  const domainAliases = Object.values(domainViews.routes).flatMap((entry) => entry.aliases);
  for (const alias of [
    "/create", "/galaxy/creator-pipeline", "/galaxy/creator",
    "/galaxy/automation-builder", "/galaxy/project-hub",
    "/galaxy/community-showcase", "/galaxy/community", "/music",
    "/galaxy/ambient-room", "/galaxy/music", "/galaxy/web-desktop"
  ]) {
    assert.ok(domainAliases.includes(alias), `missing compatibility alias ${alias}`);
  }
  assert.deepEqual([...legacyPlanetHubs.routes], layerOneRoutes.slice(1));
  assert.deepEqual(Object.keys(legacyPlanetHubs.ROUTES), layerOneRoutes.slice(1));

  const legacyGroup = loader.slice(
    loader.indexOf('"galaxy-planet-hubs": {'),
    loader.indexOf("platform: {")
  );
  assert.match(legacyGroup, /galaxy-planet-hubs\.css\?v=\d+/);
  assert.match(legacyGroup, /galaxy-planet-hubs\.js\?v=\d+/);

  const featureRouting = loader.slice(
    loader.indexOf("function featureGroupsForRoute"),
    loader.indexOf("function groupsForRoute")
  );
  for (const legacyRoute of [
    "/galaxy/creator-pipeline", "/galaxy/automation-builder", "/galaxy/project-hub",
    "/galaxy/community-showcase", "/galaxy/ambient-room", "/galaxy/web-desktop"
  ]) {
    assert.ok(featureRouting.includes(legacyRoute), `missing loader compatibility mapping ${legacyRoute}`);
  }
});

test("retired Galaxy adapters cannot mount a Layer One destination", () => {
  const inertRoot = () => ({
    dataset: {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {} },
    replaceChildren() {},
    innerHTML: ""
  });

  for (const route of layerOneRoutes) {
    const domainRoot = inertRoot();
    let domainResult = false;
    try { domainResult = domainViews.mount(domainRoot, { route }); } catch { domainResult = false; }
    assert.equal(Boolean(domainResult), false, `Domain Views mounted ${route}`);
    assert.equal(domainRoot.dataset.gdvMounted, undefined, `Domain Views marked ${route} mounted`);

    const hubRoot = inertRoot();
    assert.equal(legacyPlanetHubs.mount(hubRoot, { route }), false, `Planet Hubs mounted ${route}`);
    assert.equal(hubRoot.dataset.ghphMounted, undefined, `Planet Hubs marked ${route} mounted`);
  }
});

test("each first-layer dashboard exposes honest local capability state", () => {
  for (const route of layerOne.routes.filter((route) => route !== "/home")) {
    const markup = layerOne.viewMarkup(route, layerOne.collectLocalState(memoryStorage()));
    assert.match(markup, new RegExp(`data-route="${route.replaceAll("/", "\\/")}"`));
    assert.doesNotMatch(markup, /href="https?:|window\.open|<iframe/i);
    assert.doesNotMatch(markup, /1\.2M|78\.4 GB|99\.9%|Online users|doanh thu/i);
    assert.doesNotMatch(markup, /data-gha-entry="hh-core"|HHCoreGateway|\/create\b/i);
  }
  const ai = layerOne.viewMarkup("/galaxy/ai", {});
  assert.match(ai, /Chưa cấu hình nhà cung cấp AI/);
  assert.match(ai, /Cần backend proxy/);
  const creator = layerOne.viewMarkup("/galaxy/creator", {});
  assert.equal((creator.match(/data-hh-galaxy-creator-host/g) || []).length, 1);
});

test("Galaxy routes load and mount only the Layer One adapter", () => {
  assert.match(loader, /"galaxy-layer-one"\s*:\s*\{/);
  assert.match(loader, /galaxy-layer-one\.css\?v=\d+/);
  assert.match(loader, /galaxy-layer-one\.js\?v=\d+/);
  const featureRouting = loader.slice(
    loader.indexOf("function featureGroupsForRoute"),
    loader.indexOf("function groupsForRoute")
  );
  assert.match(featureRouting, /"\/galaxy\/ai"[\s\S]{0,520}return \["galaxy-layer-one"\]/);
  assert.doesNotMatch(featureRouting, /galaxy-planet-hubs/);
  assert.match(router, /window\.HHCoreGateway\?\.isGalaxyRoute\?\.\(routePath\)\s*===\s*true/);
  assert.match(router, /window\.HHGalaxyLayerOne\?\.mount\?\.\(layerHost/);
  assert.ok((router.match(/HHGalaxyLayerOne\?\.unmount\?\.\(\)/g) || []).length >= 2);

  const layerBranch = router.slice(
    router.indexOf("} else if (isGalaxyLayerOneRoute)"),
    router.indexOf("} else if (isGalaxyDomainRoute)")
  );
  assert.match(layerBranch, /HHGalaxyLayerOne/);
  assert.doesNotMatch(layerBranch, /HHGalaxyPlanetHubs|planetHub/);
});

test("same-route ready refresh preserves live media and Galaxy workspaces before teardown", () => {
  const helperStart = router.indexOf("const routePathOnly =");
  const renderStart = router.indexOf("const renderRoute =", helperStart);
  const renderEnd = router.indexOf("const runtimeIssueKey", renderStart);
  assert.ok(helperStart >= 0 && renderStart > helperStart && renderEnd > renderStart, "same-route preservation helper must wrap the router lifecycle");

  const helper = router.slice(helperStart, renderStart);
  assert.match(helper, /routePath\s*!==\s*routePathOnly\(renderedRoute\)/);
  assert.match(helper, /routePath\s*!==\s*routePathOnly\(activeRoute\)/);
  assert.match(helper, /host\?\.isConnected/);
  assert.match(helper, /data-hh-galaxy-layer-one-host/);
  assert.match(helper, /HHGalaxyLayerOne\?\.getState\?\.\(\)/);
  assert.match(helper, /data-galaxy-home-ai-host/);
  assert.match(helper, /HHGalaxyHomeAI\?\.getState\?\.\(\)/);
  assert.match(helper, /data-youtube-hub-host/);
  assert.match(helper, /HHYouTubeHub\?\.isMounted\?\.\(youtubeHost\)/);
  assert.match(helper, /data-yh-player-frame/);
  assert.match(helper, /data-google-hub/);
  assert.match(helper, /ycg-shell\[data-ycg-active\]/);
  assert.match(helper, /iframe\[src\], video, audio, canvas/);

  const renderSection = router.slice(renderStart, renderEnd);
  const preserveGuard = renderSection.indexOf("if (hasLiveSameRouteWorkspace(route)) return;");
  const layerTeardown = renderSection.indexOf("window.HHGalaxyLayerOne?.unmount?.();");
  const homeTeardown = renderSection.indexOf("window.HHGalaxyHomeAI?.unmount?.();");
  assert.ok(preserveGuard >= 0, "renderRoute must short-circuit an already live same-route workspace");
  assert.ok(layerTeardown > preserveGuard, "Layer One teardown must remain available after the route-identity guard");
  assert.ok(homeTeardown > preserveGuard, "Galaxy Home teardown must remain available after the route-identity guard");
  assert.match(renderSection, /if \(route !== "\/youtube"\) window\.HHYouTubeHub\?\.unmount\?\.\(\);/);

  const readyListeners = router.slice(router.indexOf('window.addEventListener("hh:modules-ready"'));
  assert.match(readyListeners, /hh:modules-ready[\s\S]{0,160}renderRouteSafely\(\)/);
  assert.match(readyListeners, /hh:youtube-creator-ready", renderRouteSafely/);
});

test("Layer One route changes synchronize the connected host before outer teardown", () => {
  const helperStart = router.indexOf("const syncLiveGalaxyLayerOneRoute =");
  const renderStart = router.indexOf("const renderRoute =", helperStart);
  const renderEnd = router.indexOf("const runtimeIssueKey", renderStart);
  assert.ok(helperStart >= 0 && renderStart > helperStart && renderEnd > renderStart);

  const helper = router.slice(helperStart, renderStart);
  assert.match(helper, /connectedWorkspaceHost\("\[data-hh-galaxy-layer-one-host\]"\)/);
  assert.match(helper, /HHGalaxyLayerOne/);
  assert.match(helper, /state\?\.mounted !== true/);
  assert.match(helper, /layerOne\.syncRoute\?\.\(routePath\)/);
  assert.match(helper, /finalizeRouteRender\(routePath\)/);
  assert.doesNotMatch(helper, /workspace\.innerHTML|\.unmount\?\.\(/);

  const renderSection = router.slice(renderStart, renderEnd);
  const fastPath = renderSection.indexOf("if (syncLiveGalaxyLayerOneRoute(route)) return;");
  const teardown = renderSection.indexOf("window.HHGalaxyLayerOne?.unmount?.();");
  const replaceHost = renderSection.indexOf("workspace.innerHTML = '<div data-hh-galaxy-layer-one-host></div>';");
  assert.ok(fastPath >= 0, "Layer One fast path must be present");
  assert.ok(teardown > fastPath, "fast path must run before Layer One unmount");
  assert.ok(replaceHost > fastPath, "fast path must run before replacing the host node");
});

test("connected Layer One module changes stay visible without a full-screen route loader", () => {
  const helperStart = router.indexOf("const canKeepGalaxyLayerOneVisible =");
  const renderStart = router.indexOf("const renderRouteWithTransition =");
  const renderEnd = router.indexOf("const searchItems =", renderStart);
  assert.ok(helperStart >= 0 && renderStart > helperStart && renderEnd > renderStart);

  const helper = router.slice(helperStart, router.indexOf("const renderRoute =", helperStart));
  assert.match(helper, /routePath\.startsWith\("\/galaxy\/"\)/);
  assert.match(helper, /previousPath\.startsWith\("\/galaxy\/"\)/);
  assert.match(helper, /connectedWorkspaceHost\("\[data-hh-galaxy-layer-one-host\]"\)/);
  assert.match(helper, /state\?\.mounted !== true/);
  assert.match(helper, /liveRoute !== previousPath && liveRoute !== routePath/);
  assert.match(helper, /isRouteReady\(routePath\) === true/);

  const transition = router.slice(renderStart, renderEnd);
  const inlineStart = transition.indexOf("if (canKeepGalaxyLayerOneVisible(nextRoute))");
  const fullLoaderStart = transition.indexOf("beginRouteFeedback(nextRoute)");
  assert.ok(inlineStart >= 0 && fullLoaderStart > inlineStart, "persistent Layer One path must run before the full-screen loader");
  const inlineSection = transition.slice(inlineStart, fullLoaderStart);
  assert.match(inlineSection, /renderRouteSafely\(\)/);
  assert.match(inlineSection, /routeProgress\?\.setAttribute\("aria-hidden", "false"\)/);
  assert.doesNotMatch(inlineSection, /showCosmicRouteLoader|beginRouteFeedback|startViewTransition/);
});

test("layer-one search never exposes a Core destination", () => {
  for (const query of ["HH CORE", "/create", "chat ai", "music", "settings", "analytics"]) {
    const results = layerOne.searchRoutes(query, 12);
    results.forEach((entry) => {
      assert.equal(gateway.isGalaxyRoute(entry.route), true, `${query}: ${entry.route}`);
      assert.equal(gateway.isCoreRoute(entry.route), false, `${query}: ${entry.route}`);
    });
  }
  assert.equal(layerOne.searchRoutes("HH CORE").length, 0);
  assert.equal(layerOne.searchRoutes("/create").length, 0);
  assert.match(read("galaxy-layer-one.js"), /const results = routeManifest\.map/);
});

test("demo projects and schedules never contribute to real Analytics", () => {
  const sampleOnlyStats = layerOneData.buildStats({
    projects: layerOneData.SAMPLE_PROJECTS,
    schedule: layerOneData.SAMPLE_SCHEDULE
  }, new Date("2026-08-01T08:00:00.000Z"));
  assert.deepEqual(sampleOnlyStats, {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    draftProjects: 0,
    dueToday: 0,
    completedSteps: 0
  });

  const store = layerOneData.createStore({
    storage: layerOneData.memoryStorage(),
    persistInitial: false,
    now: () => new Date("2026-08-31T08:00:00.000Z")
  });
  assert.ok(store.getSnapshot().projects.every((project) => project.isDemo));
  assert.equal(store.getStats().totalProjects, 0);
  const copy = store.cloneProject(layerOneData.SAMPLE_PROJECTS[0].id);
  assert.equal(copy.isDemo, false);
  assert.equal(store.getStats().totalProjects, 1);
});

test("canonical Core reference views use one immersive shell", () => {
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
