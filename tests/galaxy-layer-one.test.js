const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("galaxy-layer-one.js");
const styles = read("galaxy-layer-one.css");
const layerOne = require("../galaxy-layer-one.js");

function memoryStorage(seed) {
  const records = new Map(Object.entries(seed || {}));
  return {
    getItem(key) { return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { records.set(key, String(value)); },
    removeItem(key) { records.delete(key); },
    dump() { return Object.fromEntries(records); }
  };
}

test("layer-one shell exposes a frozen lifecycle and local-first API", () => {
  assert.equal(global.HHGalaxyLayerOne, layerOne);
  assert.equal(layerOne.version, 1);
  assert.equal(layerOne.storageKey, "hh.galaxy.layer-one.v1");
  assert.equal(layerOne.eventPrefix, "hh:galaxy:layer-one");
  for (const method of [
    "normalizeRoute", "canHandle", "searchRoutes", "collectLocalState",
    "inspectLocalState", "writeLocalState", "createLocalItem", "copyTemplate",
    "deleteLocalItem", "serializeBackup", "importBackup", "summarizeAnalytics",
    "resolveAdaptiveTiers", "viewMarkup", "mount", "unmount", "syncRoute", "getState"
  ]) {
    assert.equal(typeof layerOne[method], "function", "missing " + method);
  }
  assert.ok(Object.isFrozen(layerOne));
  assert.ok(Object.isFrozen(layerOne.routes));
  assert.ok(Object.isFrozen(layerOne.routeManifest));
  assert.deepEqual(layerOne.getState(), {
    mounted: false,
    route: null,
    storageStatus: "idle",
    reason: "not-mounted",
    layer: "galaxy"
  });
});

test("manifest contains exactly the twelve isolated first-layer destinations", () => {
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
  assert.deepEqual([...layerOne.routes], expected);
  assert.equal(layerOne.routeManifest.length, 12);
  layerOne.routeManifest.forEach((entry) => {
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.keywords));
    assert.ok(entry.id);
    assert.ok(entry.label);
    assert.ok(entry.title);
    assert.ok(entry.description);
    assert.ok(entry.route === "/home" || entry.route.startsWith("/galaxy/"));
    assert.equal(layerOne.canHandle(entry.route), true, entry.route);
  });
  for (const outsideRoute of [
    "/create", "/chat-ai", "/music", "/settings", "/analytics",
    "/work/projects-tasks", "/communication", "/system", "/galaxy"
  ]) {
    assert.equal(layerOne.canHandle(outsideRoute), false, outsideRoute);
  }
  assert.equal(layerOne.normalizeRoute("https://example.test/#/galaxy/music?tab=library"), "/galaxy/music");
  assert.equal(layerOne.normalizeRoute("#/home/"), "/home");
});

test("search indexes only first-layer manifest entries", () => {
  assert.deepEqual(layerOne.searchRoutes("nhạc").map((entry) => entry.route), ["/galaxy/music"]);
  assert.equal(layerOne.searchRoutes("creator")[0].route, "/galaxy/creator");
  assert.equal(layerOne.searchRoutes("JSON")[0].route, "/galaxy/dev");
  assert.equal(layerOne.searchRoutes("HH CORE").length, 0);
  assert.equal(layerOne.searchRoutes("chat ai").every((entry) => layerOne.routes.includes(entry.route)), true);
  assert.equal(layerOne.searchRoutes("").length, 0);
});

test("shell markup owns the first-layer chrome and does not duplicate the Core entry", () => {
  const markup = layerOne.viewMarkup("/galaxy/ai", layerOne.collectLocalState(memoryStorage()), {
    online: false,
    userName: "<Người dùng>",
    storageStatus: "ready"
  });
  assert.match(markup, /^<div class="hh-galaxy-app"/);
  assert.match(markup, /data-hh-layer="galaxy"/);
  assert.match(markup, /class="hgl1-sidebar"/);
  assert.match(markup, /class="hgl1-topbar"/);
  assert.match(markup, /class="hgl1-mobile-nav"/);
  assert.match(markup, /Tìm kiếm chức năng lớp 1/);
  assert.match(markup, /Ngoại tuyến/);
  assert.match(markup, /&lt;Người dùng&gt;/);
  assert.equal((markup.match(/<nav class="hgl1-nav"[^>]*>/g) || []).length, 1);
  const sidebarNav = markup.match(/<nav class="hgl1-nav"[^>]*>([\s\S]+?)<\/nav>/)[1];
  assert.equal((sidebarNav.match(/data-hgl1-route=/g) || []).length, 12);
  assert.equal((markup.match(/data-hgl1-route="\/(?:home|galaxy\/[^"]+)"/g) || []).length, 18);
  assert.doesNotMatch(markup, /HH CORE|data-gha-entry="hh-core"|\/create\b|HHCoreGateway/i);
});

test("home delegates to the existing map host and Creator owns one dedicated bridge slot", () => {
  const home = layerOne.viewMarkup("/home", {});
  assert.equal((home.match(/data-hh-galaxy-home-host/g) || []).length, 1);
  assert.match(home, /data-route="\/home"/);
  assert.doesNotMatch(home, /HH CORE|HHCoreGateway|data-gha-entry/i);

  const creator = layerOne.viewMarkup("/galaxy/creator", {});
  assert.equal((creator.match(/data-hh-galaxy-creator-host/g) || []).length, 1);
  assert.match(creator, /data-route="\/galaxy\/creator"/);
  assert.match(creator, /module này sở hữu pipeline, dự án, lịch và thống kê/i);
  assert.doesNotMatch(creator, /IDEA[\s\S]*SCRIPT[\s\S]*IMAGE|data-hgl1-create-form/);
  assert.match(source, /options\.mountHome\(homeHost, context\)/);
  assert.match(source, /options\.mountCreator\(creatorHost, context\)/);
  assert.match(source, /EVENT_PREFIX \+ ":" \+ name/);
});

test("every sample is immutable, labeled and excluded from user state", () => {
  assert.equal(layerOne.templates.length, 9);
  layerOne.templates.forEach((template) => {
    assert.ok(Object.isFrozen(template));
    assert.equal(template.isDemo, true);
    assert.equal(template.source, "local-template");
    assert.equal(template.templateVersion, "1.0.0");
    assert.equal(template.editable, false);
    assert.ok(layerOne.routes.includes(template.route));
  });
  const markup = layerOne.viewMarkup("/galaxy/music", {});
  assert.match(markup, /data-is-demo="true"/);
  assert.match(markup, /data-source="local-template"/);
  assert.match(markup, /data-template-version="1\.0\.0"/);
  assert.match(markup, /data-editable="false"/);
  assert.match(markup, />Bản mẫu</);
  assert.match(markup, /Tạo bản sao/);

  const storage = memoryStorage();
  const copied = layerOne.copyTemplate("/galaxy/music", storage);
  assert.ok(copied);
  assert.equal(copied.isDemo, false);
  assert.equal(copied.source, "user-copy");
  assert.equal(copied.editable, true);
  assert.equal(copied.meta.copiedFrom, "template-piano-rain");
  const state = layerOne.collectLocalState(storage);
  assert.equal(state.items.length, 1);
  assert.equal(state.items.some((item) => item.isDemo), false);
});

test("local CRUD is route-scoped, escaped in markup and never accepts platform routes", () => {
  const storage = memoryStorage();
  const item = layerOne.createLocalItem("/galaxy/dev", "<img src=x onerror=alert(1)>", storage, {
    description: "<script>bad()</script>",
    meta: { fileName: "<bad>.js", fileSize: 42 }
  });
  assert.ok(item);
  assert.equal(item.route, "/galaxy/dev");
  assert.equal(layerOne.createLocalItem("/create", "forbidden", storage), null);
  assert.equal(layerOne.createLocalItem("/settings", "forbidden", storage), null);

  const markup = layerOne.viewMarkup("/galaxy/dev", layerOne.collectLocalState(storage));
  assert.doesNotMatch(markup, /<img src=x|<script>bad/);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(markup, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);

  assert.equal(layerOne.deleteLocalItem(item.id, storage), true);
  assert.equal(layerOne.deleteLocalItem(item.id, storage), false);
  assert.equal(layerOne.collectLocalState(storage).items.length, 0);
});

test("analytics is opt-in and reports only real local records", () => {
  const storage = memoryStorage();
  layerOne.createLocalItem("/galaxy/video", "Video của tôi", storage);
  let state = layerOne.collectLocalState(storage);
  let summary = layerOne.summarizeAnalytics(state);
  assert.equal(summary.consent, false);
  assert.equal(summary.localItems, 1);
  assert.equal(summary.trackedEvents, 0);
  assert.equal(summary.visitedModules, 0);

  state.settings.analyticsConsent = true;
  state.events = [
    { id: "e1", type: "route-view", route: "/galaxy/video", at: "2026-08-31T00:00:00.000Z" },
    { id: "e2", type: "data-export", route: "/galaxy/analytics", at: "2026-08-31T00:01:00.000Z" },
    { id: "e3", type: "route-view", route: "/create", at: "2026-08-31T00:02:00.000Z" }
  ];
  assert.equal(layerOne.writeLocalState(state, storage), true);
  summary = layerOne.summarizeAnalytics(layerOne.collectLocalState(storage));
  assert.equal(summary.consent, true);
  assert.equal(summary.localItems, 1);
  assert.equal(summary.trackedEvents, 3);
  assert.equal(summary.exports, 1);
  assert.equal(summary.visitedModules, 1);
  assert.equal(summary.latestEvents[0].route, "");
});

test("backup round-trip is versioned, sanitized and bounded to layer-one state", () => {
  const sourceStorage = memoryStorage();
  const state = layerOne.collectLocalState(sourceStorage);
  state.settings.analyticsConsent = true;
  assert.equal(layerOne.writeLocalState(state, sourceStorage), true);
  assert.ok(layerOne.createLocalItem("/galaxy/learning", "Ghi chú thật", sourceStorage));
  const backup = layerOne.serializeBackup(sourceStorage);
  const parsed = JSON.parse(backup);
  assert.equal(parsed.schema, "hh-galaxy-layer-one-backup");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.data.items.length, 1);
  assert.equal(Object.hasOwn(parsed, "templates"), false);

  const targetStorage = memoryStorage();
  const imported = layerOne.importBackup(backup, targetStorage);
  assert.equal(imported.ok, true);
  assert.equal(imported.imported, 1);
  assert.equal(layerOne.collectLocalState(targetStorage).items[0].title, "Ghi chú thật");
  assert.deepEqual(layerOne.importBackup("{}", targetStorage), {
    ok: false,
    error: "BACKUP_SCHEMA_INVALID",
    imported: 0
  });
  assert.deepEqual(layerOne.importBackup("{bad", targetStorage), {
    ok: false,
    error: "BACKUP_JSON_INVALID",
    imported: 0
  });
});

test("all module dashboards expose honest capability and empty states", () => {
  for (const route of [
    "/galaxy/ai", "/galaxy/music", "/galaxy/video", "/galaxy/games",
    "/galaxy/dev", "/galaxy/learning", "/galaxy/community"
  ]) {
    const markup = layerOne.viewMarkup(route, {});
    assert.match(markup, /data-capability="available"/);
    assert.match(markup, /data-state="empty"/);
    assert.match(markup, /Dữ liệu riêng của lớp 1/);
    assert.doesNotMatch(markup, /1\.2M|73%|99\.9%|doanh thu|người online/i);
  }
  const ai = layerOne.viewMarkup("/galaxy/ai", {});
  assert.match(ai, /Chưa cấu hình nhà cung cấp AI/);
  assert.match(ai, /Cần backend proxy/);
  const community = layerOne.viewMarkup("/galaxy/community", {});
  assert.match(community, /realtime chưa cấu hình/i);
});

test("CSS is isolated, responsive and accessibility-aware", () => {
  assert.match(styles, /\.hh-galaxy-app\s*\{/);
  assert.match(styles, /--hgl1-sidebar-w:\s*264px/);
  assert.match(styles, /grid-template-columns:\s*var\(--hgl1-sidebar-w\)/);
  assert.match(styles, /\.hh-galaxy-app \.hgl1-sidebar/);
  assert.match(styles, /@media \(max-width:\s*1279px\)/);
  assert.match(styles, /@media \(max-width:\s*767px\)/);
  assert.match(styles, /data-drawer-open="true"/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /@media \(forced-colors:\s*active\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /\.hgl1-skip-link/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.doesNotMatch(styles, /(^|\n)\s*(body|html|:root|\*)\s*[{,]/);
});

test("adaptive motion tiers are derived from runtime device and connection signals", () => {
  const low = layerOne.resolveAdaptiveTiers({
    navigator: { deviceMemory: 4, hardwareConcurrency: 4, connection: { effectiveType: "4g", saveData: false } },
    matchMedia: () => ({ matches: false })
  });
  assert.deepEqual(low, { deviceTier: "low", performanceTier: "low" });
  assert.ok(Object.isFrozen(low));

  const high = layerOne.resolveAdaptiveTiers({
    navigator: { deviceMemory: 16, hardwareConcurrency: 12, connection: { effectiveType: "4g", saveData: false } },
    matchMedia: () => ({ matches: false })
  });
  assert.deepEqual(high, { deviceTier: "high", performanceTier: "high" });

  const constrained = layerOne.resolveAdaptiveTiers({
    navigator: { deviceMemory: 16, hardwareConcurrency: 12, connection: { effectiveType: "4g", saveData: true } },
    matchMedia: () => ({ matches: false })
  });
  assert.deepEqual(constrained, { deviceTier: "high", performanceTier: "low" });
  assert.deepEqual(layerOne.resolveAdaptiveTiers({}), { deviceTier: "mid", performanceTier: "mid" });

  assert.match(source, /adaptiveTiers:\s*resolveAdaptiveTiers\(globalScope\)/);
  assert.match(source, /app\.dataset\.deviceTier\s*=\s*adaptive\.deviceTier/);
  assert.match(source, /app\.dataset\.performanceTier\s*=\s*adaptive\.performanceTier/);
  assert.match(source, /navigator\s*&&\s*globalScope\.navigator\.connection[\s\S]{0,160}"change"[\s\S]{0,240}resolveAdaptiveTiers\(globalScope\)/);
});

test("persistent sidebar adds bounded cosmic motion without moving its layout", () => {
  for (const animation of [
    "hgl1-sidebar-star-drift",
    "hgl1-sidebar-edge-scan",
    "hgl1-sidebar-product-twinkle",
    "hgl1-sidebar-brand-star",
    "hgl1-sidebar-brand-orbit",
    "hgl1-sidebar-active-shimmer",
    "hgl1-sidebar-active-twinkle",
    "hgl1-sidebar-icon-signal",
    "hgl1-sidebar-planet-halo",
    "hgl1-sidebar-arrow-signal"
  ]) {
    assert.match(styles, new RegExp("@keyframes\\s+" + animation + "\\s*\\{"), "missing " + animation);
  }

  assert.match(styles, /\.hh-galaxy-app \.hgl1-nav\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?scrollbar-gutter:\s*stable;/);
  assert.match(styles, /\.hh-galaxy-app \.hgl1-nav__link\[aria-current="page"\]::before\s*\{[^}]*animation:\s*hgl1-sidebar-active-shimmer/s);
  assert.match(styles, /\.hh-galaxy-app \.hgl1-nav__link\[aria-current="page"\] \.hgl1-nav__icon \.hgl1-icon\s*\{[^}]*animation:\s*hgl1-sidebar-icon-signal/s);
  assert.match(styles, /\.hh-galaxy-app\[data-effects="quiet"\][\s\S]*?hgl1-sidebar-active-shimmer|\.hh-galaxy-app\[data-effects="quiet"\][\s\S]*?\.hgl1-nav__link::before/);
  assert.match(styles, /data-device-tier="low"/);
  assert.match(styles, /data-gha-device-tier="low"/);
  assert.match(styles, /@media \(update:\s*slow\), \(prefers-reduced-data:\s*reduce\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hgl1-sidebar::before[\s\S]*?animation:\s*none !important;/);
  assert.match(styles, /\.hgl1-nav__link::before\s*\{[\s\S]*?will-change:\s*auto;/);
  assert.match(styles, /\.hgl1-nav__link\[aria-current="page"\]::before\s*\{[^}]*will-change:\s*transform,\s*opacity;/s);

  const motionBlocks = [...styles.matchAll(/@keyframes\s+(hgl1-sidebar-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(motionBlocks.length >= 10, "sidebar motion suite must remain complete");
  for (const [, name, declarations] of motionBlocks) {
    assert.doesNotMatch(
      declarations,
      /(?:^|[;{]\s*)(?:width|height|inset|top|right|bottom|left|margin|padding)\s*:/m,
      name + " must not animate layout geometry"
    );
  }
  assert.doesNotMatch(styles, /\.hh-galaxy-app \.hgl1-nav__link\s*\{[^}]*\banimation\s*:/s, "inactive rows must not animate");

  const hiddenDrawerMotion = styles.slice(
    styles.indexOf('.hh-galaxy-app .hgl1-sidebar[aria-hidden="true"]::before'),
    styles.indexOf("\n  }", styles.indexOf('.hh-galaxy-app .hgl1-sidebar[aria-hidden="true"]::before')) + 4
  );
  assert.match(hiddenDrawerMotion, /animation-play-state:\s*paused !important/);
  assert.match(hiddenDrawerMotion, /will-change:\s*auto/);
  assert.doesNotMatch(hiddenDrawerMotion, /hgl1-mobile-nav/, "the visible mobile dock must retain its active-route motion");
});

test("mobile drawer route activation moves focus out of the inert navigation", () => {
  assert.match(source, /function focusPendingRouteMain\(\)[\s\S]{0,260}querySelector\("#hgl1-main"\)[\s\S]{0,220}main\.focus/);
  assert.match(source, /sourceInsideDrawer[\s\S]{0,360}runtime\.pendingRouteFocus\s*=\s*true/);
  assert.match(source, /navigate\(routeLink\.dataset\.hgl1Route,\s*\{\s*sourceElement:\s*routeLink\s*\}\)/);
  assert.match(source, /navigate\(searchRoute\.dataset\.hgl1SearchRoute,\s*\{\s*sourceElement:\s*searchRoute\s*\}\)/);
  assert.match(source, /setDrawer\(false, false\)[\s\S]{0,520}focusPendingRouteMain\(\)/);
});

test("forced-colors keeps the active Layer One route visually distinct", () => {
  const forcedStart = styles.indexOf("@media (forced-colors: active)");
  const forcedEnd = styles.indexOf("@media print", forcedStart);
  const forced = styles.slice(forcedStart, forcedEnd);
  const genericControlRule = forced.indexOf(".hgl1-switch span");
  const activeRule = forced.lastIndexOf('.hgl1-nav__link[aria-current="page"]');
  assert.ok(genericControlRule >= 0 && activeRule > genericControlRule, "active route override must follow the generic forced-colors control rule");
  assert.match(forced.slice(activeRule), /color:\s*HighlightText;[\s\S]{0,100}background:\s*Highlight;[\s\S]{0,100}border-color:\s*Highlight;/);
});

test("source contains no Core gateway call-site, remote frame or fake metric claims", () => {
  assert.doesNotMatch(source, /HHCoreGateway|\.enter\s*\(|data-gha-entry|href="https?:|window\.open|<iframe/i);
  assert.doesNotMatch(source, /1\.2M|73%|99\.9%|12\.5K|doanh thu|online users/i);
  assert.match(source, /const STORAGE_KEY = "hh\.galaxy\.layer-one\.v1"/);
  assert.match(source, /const EVENT_PREFIX = "hh:galaxy:layer-one"/);
  assert.match(source, /source:\s*"local-template"/);
  assert.match(source, /analyticsConsent:\s*false/);
});
