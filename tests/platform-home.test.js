const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const home = require("../platform-home.js");
const gateway = require("../hh-core-gateway.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const router = read("script.js");

function registry() {
  const start = router.indexOf("  const groups = [", router.indexOf("const davinciResolvePages"));
  const end = router.indexOf("  const sidebarSearchAliases", start);
  assert.ok(start > 0 && end > start);
  const source = router.slice(start, end);
  const dependencies = [...source.matchAll(/(?:studioItems|pages|legacyItems): (\w+)/g)].map((match) => match[1]);
  const context = Object.fromEntries(dependencies.map((name) => [name, []]));
  vm.runInNewContext(`${source}; globalThis.result = { groups, navigationSections };`, context);
  return JSON.parse(JSON.stringify(context.result));
}
const real = registry();
const catalog = (admin = false) => home.buildCatalog(real.navigationSections, real.groups, {
  admin, children: (group) => [...(group.pages || []), { title: `${group.label} sample child`, route: `${group.route}/example` }]
});

test("the canonical Platform home is distinct and remains HH CORE gated", () => {
  const records = new Map();
  const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) };
  assert.equal(home.route, "/platform");
  assert.equal(gateway.platformEntryRoute, home.route);
  assert.equal(gateway.isGalaxyRoute(home.route), false);
  assert.equal(gateway.resolveRoute(home.route, { storage }).allowed, false);
  assert.equal(gateway.enter({ source: "sidebar", storage }), false);
  assert.equal(gateway.enter({ source: "hh-core", storage }), true);
  assert.equal(gateway.resolveRoute(home.route, { storage }).route, home.route);
  assert.equal(gateway.resolveRoute("/create", { storage }).route, "/create");
  gateway.leave({ storage });
  assert.equal(gateway.resolveRoute(home.route, { storage }).route, "/home");
  assert.equal(gateway.resolveRoute("/galaxy/learning", { storage }).allowed, true);
});

test("catalog mirrors all six registry groups and all 32 functions without duplicate routes", () => {
  const groups = catalog();
  assert.equal(groups.length, 6);
  assert.deepEqual(groups.map((group) => group.items.length), [7, 5, 7, 5, 5, 3]);
  const entries = groups.flatMap((group) => group.items);
  assert.equal(entries.length, 32);
  assert.equal(new Set(entries.map((item) => item.route)).size, 32);
  assert.ok(entries.every((item) => gateway.isCoreRoute(item.route)));
  assert.ok(entries.every((item) => item.description.length > 30));
  const admin = entries.find((item) => item.id === "admin");
  assert.equal(admin.locked, true);
  assert.equal(catalog(true).flatMap((group) => group.items).find((item) => item.id === "admin").locked, false);
});

test("future registry changes update names, counts, categories and child tools automatically", () => {
  const sections = [{ id: "one", label: "Một", groupIds: ["new", "new", "bad"] }];
  const groups = [{ id: "new", label: "Công cụ mới", route: "/new" }, { id: "bad", label: "Layer One", route: "/galaxy/ai" }];
  const result = home.buildCatalog(sections, groups, { children: () => [{ title: "X", route: "/new/x" }, { title: "X", route: "/new/x" }, { title: "Bad", route: "javascript:alert(1)" }] });
  assert.equal(result[0].items.length, 1);
  assert.equal(result[0].items[0].label, "Công cụ mới");
  assert.equal(result[0].items[0].children.length, 1);
  assert.match(home.markup(result), /Khám phá 1 chức năng/);
});

test("search supports Vietnamese diacritics, multiword descriptions, aliases and child tool names", () => {
  const groups = catalog();
  assert.equal(home.filterCatalog(groups, "han tu").some((item) => item.id === "chinese"), true);
  assert.deepEqual(home.filterCatalog(groups, "Đọc truyện").map((item) => item.id), ["comic-reader"]);
  assert.equal(home.filterCatalog(groups, "sample child").length, 32);
  assert.equal(home.filterCatalog(groups, "", "learning").length, 5);
  assert.equal(home.filterCatalog(groups, "", "all", true, ["/draw"]).length, 1);
  assert.equal(home.filterCatalog(groups, "nothing matches this").length, 0);
});

test("cards escape metadata and never expose Admin links to ordinary users", () => {
  const html = home.markup(catalog(), { userName: '<img src=x onerror="bad">' });
  assert.equal((html.match(/data-php-card=/g) || []).length, 32);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x|data-php-route="\/admin/);
  assert.match(html, /Chỉ dành cho Admin/);
  assert.match(home.markup(catalog(true)), /data-php-route="\/admin"/);
  assert.doesNotMatch(html, /href="#"/);
});

test("network availability never claims provider/backend readiness", () => {
  const ai = catalog().flatMap((group) => group.items).find((item) => item.id === "chat-ai");
  const network = catalog().flatMap((group) => group.items).find((item) => item.id === "discord");
  assert.match(home.capability(ai, true).label, /xác minh/);
  assert.match(home.capability(network, false).label, /Cần kết nối mạng/);
  assert.doesNotMatch(home.capability(network, true).label, /sẵn sàng|đã kết nối/i);
  const source = read("platform-home.js");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|new WebSocket|getUserMedia|sendBeacon|localStorage\.setItem/);
});

test("project metadata reader is read-only, excludes templates and never touches Layer One", () => {
  const requested = [];
  const raw = JSON.stringify({ version: 1, projects: [
    { id: "mine", name: "Dự án thật", updatedAt: "2026-09-05", brief: { private: "not returned" } },
    { id: "template-x", name: "Bản mẫu" }, { id: "other", name: "Demo", isDemo: true }
  ] });
  const result = home.readProjectSummaries({ getItem(key) { requested.push(key); return raw; } });
  assert.deepEqual(requested, ["hh.creative-os.v1"]);
  assert.deepEqual(result.projects, [{ title: "Dự án thật", updatedAt: "2026-09-05" }]);
  assert.equal(result.status, "ready");
  assert.equal(home.readProjectSummaries({ getItem: () => null }).status, "empty");
  assert.equal(home.readProjectSummaries({ getItem: () => "{bad" }).status, "error");
  assert.equal(home.readProjectSummaries({ getItem() { throw Error("blocked"); } }).status, "error");
  assert.equal(home.readProjectSummaries({ getItem: () => '{"version":2,"projects":[]}' }).status, "error");
});

test("all seven suggested journeys use existing allowed registry destinations", () => {
  const entries = catalog().flatMap((group) => group.items);
  assert.equal(home.recipes.length, 7);
  for (const recipe of home.recipes) {
    assert.ok(recipe[3].length >= 3 && recipe[3].length <= 5);
    for (const id of recipe[3]) assert.ok(entries.some((item) => item.id === id && !item.locked), id);
  }
});

test("brand, sidebar, command search and mobile home target the new route without replacing Creative", () => {
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  assert.match(html, /href="#\/platform" data-app-route="\/platform" aria-label="Mở trang chủ HH Platform"/);
  assert.match(html, /data-app-route="\/platform"><span>⌂<\/span>Trang chủ/);
  assert.match(router, /app-sidebar__home[^\n]+data-app-route="\/platform"/);
  assert.match(router, /title: "Trang chủ HH Platform"[^\n]+route: "\/platform"/);
  assert.match(router, /if \(routePath === "\/platform"\)[\s\S]{0,250}mountPlatformHome\(\)/);
  assert.match(router, /if \(route === "\/create"\)[\s\S]{0,300}mountFeatureGroupHub\("create"\)/);
  assert.match(read("galaxy-home-ai.js"), /const CORE_ENTRY_ROUTE = "\/platform"/);
  assert.match(router, /getFavorites: readSidebarFavorites, getPins: readSidebarPins, getRecent: readSidebarRecent/);
});

test("home is lazy-loaded, cache-aligned, scoped and has lifecycle/accessibility guards", () => {
  const loader = read("performance-loader.js"), worker = read("sw.js");
  assert.match(loader, /if \(value === "\/platform"\) return \["platform-home"\]/);
  for (const asset of ["platform-home.css?v=2", "platform-home.js?v=2"]) { assert.ok(loader.includes(asset)); assert.ok(worker.includes(asset)); }
  const css = read("platform-home.css");
  for (const token of ["@container (max-width: 600px)", "prefers-reduced-motion", "forced-colors", ":focus-visible", "data-paused", "data-motion", "data-contrast"]) assert.ok(css.includes(token));
  const source = read("platform-home.js");
  assert.match(source, /removeEventListener/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /data-php-results role="status" aria-live="polite"/);
  assert.match(source, /isAdmin\?\.\(\) !== true/);
  assert.doesNotMatch(source, /hh\.galaxy\.layer-one\.v1/);
});
