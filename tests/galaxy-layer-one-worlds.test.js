const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layerOneSource = read("galaxy-layer-one.js");
const worldStylesPath = path.join(root, "galaxy-layer-one-worlds.css");
const worldStyles = fs.existsSync(worldStylesPath) ? fs.readFileSync(worldStylesPath, "utf8") : "";
const layerOne = require("../galaxy-layer-one.js");

const DESTINATIONS = Object.freeze([
  ["home", "/home"],
  ["ai", "/galaxy/ai"],
  ["music", "/galaxy/music"],
  ["video", "/galaxy/video"],
  ["creator", "/galaxy/creator"],
  ["games", "/galaxy/games"],
  ["dev", "/galaxy/dev"],
  ["learning", "/galaxy/learning"],
  ["community", "/galaxy/community"],
  ["tools", "/galaxy/tools"],
  ["analytics", "/galaxy/analytics"],
  ["settings", "/galaxy/settings"]
]);

const MODULE_DESTINATIONS = DESTINATIONS.filter(([id]) =>
  ["ai", "music", "video", "games", "dev", "learning", "community"].includes(id)
);

const VISUAL_UTILITY_DESTINATIONS = DESTINATIONS.filter(([id]) =>
  ["tools", "analytics", "settings"].includes(id)
);

function classCount(markup, token) {
  let count = 0;
  for (const match of markup.matchAll(/\bclass="([^"]*)"/g)) {
    if (match[1].split(/\s+/).includes(token)) count += 1;
  }
  return count;
}

function textContent(fragment) {
  return String(fragment || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function heroCopy(markup, id) {
  const match = markup.match(new RegExp(
    `<h1\\s+id="hgl1-world-title-${id}">([\\s\\S]*?)<\\/h1>\\s*<p>([\\s\\S]*?)<\\/p>`
  ));
  assert.ok(match, `missing semantic hero copy for ${id}`);
  return textContent(match[1] + " " + match[2]);
}

function portalCopy(markup) {
  const match = markup.match(/<section\b[^>]*class="[^"]*\bhgl1-portal-grid\b[^"]*"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(match, "missing portal grid section");
  return textContent(match[1]);
}

function assertVisualHero(markup, id) {
  assert.equal(classCount(markup, "hgl1-world-hero"), 1, `${id} should own one visual hero`);
  assert.equal(classCount(markup, `hgl1-world-hero--${id}`), 1, `${id} hero tone is missing`);
  assert.equal(classCount(markup, "hgl1-world-hero__body"), 1, `${id} hero body is missing`);
  assert.equal(classCount(markup, "hgl1-world-hero__visual"), 1, `${id} hero visual is missing`);
  assert.equal(classCount(markup, `hgl1-world-orb--${id}`), 1, `${id} orb is missing`);
  assert.equal(classCount(markup, `hgl1-world-constellation--${id}`), 1, `${id} constellation is missing`);
}

test("the twelve layer-one destinations remain exact, unique and disjoint from Core", () => {
  const expectedRoutes = DESTINATIONS.map(([, route]) => route);
  assert.deepEqual([...layerOne.routes], expectedRoutes);
  assert.deepEqual(layerOne.routeManifest.map((entry) => [entry.id, entry.route]), DESTINATIONS);
  assert.equal(new Set(layerOne.routes).size, DESTINATIONS.length);

  const coreRoutes = [
    "/create", "/chat-ai", "/music", "/settings", "/analytics",
    "/work", "/system", "/communication", "/play", "/dev-tools"
  ];
  for (const [, route] of DESTINATIONS) {
    assert.equal(layerOne.normalizeRoute(`#${route}?from=contract`), route);
    assert.equal(layerOne.canHandle(route), true, route);
    assert.equal(coreRoutes.includes(route), false, `${route} collides with Core`);
  }
  for (const route of coreRoutes) {
    assert.equal(layerOne.canHandle(route), false, `${route} must remain outside layer one`);
  }
});

test("desktop navigation gives every destination its own code-native mini planet", () => {
  const markup = layerOne.viewMarkup("/home", {});
  for (const [id, route] of DESTINATIONS) {
    assert.match(markup, new RegExp(`data-hgl1-route="${route.replaceAll("/", "\\/")}"`));
    assert.ok(classCount(markup, "hgl1-nav__planet") >= DESTINATIONS.length);
    assert.ok(classCount(markup, `hgl1-nav__planet--${id}`) >= 1, `missing nav planet for ${id}`);
  }
  assert.doesNotMatch(markup, /<img\b|<canvas\b/i, "mini planets should be code-native UI");
});

test("the seven working worlds expose distinct hero, portal and rail compositions", () => {
  const heroCopies = new Set();
  const portalCopies = new Set();

  for (const [id, route] of MODULE_DESTINATIONS) {
    const markup = layerOne.viewMarkup(route, {});
    assertVisualHero(markup, id);
    assert.equal(classCount(markup, "hgl1-world-layout"), 1, `${id} layout is missing`);
    assert.equal(classCount(markup, "hgl1-world-main"), 1, `${id} main column is missing`);
    assert.equal(classCount(markup, "hgl1-world-rail"), 1, `${id} rail is missing`);
    assert.equal(classCount(markup, `hgl1-world-rail--${id}`), 1, `${id} rail tone is missing`);
    assert.equal(classCount(markup, "hgl1-portal-grid"), 1, `${id} portal grid is missing`);
    assert.ok(classCount(markup, "hgl1-portal-card") >= 3, `${id} needs meaningful portals`);
    assert.equal((markup.match(/<main\b/gi) || []).length, 1, `${id} must not nest a second main landmark`);

    heroCopies.add(heroCopy(markup, id));
    portalCopies.add(portalCopy(markup));
  }

  assert.equal(heroCopies.size, MODULE_DESTINATIONS.length, "world hero copy must not be cloned");
  assert.equal(portalCopies.size, MODULE_DESTINATIONS.length, "world portals must describe their own capability set");
});

test("home and Creator preserve one delegate host without nesting main landmarks", () => {
  const home = layerOne.viewMarkup("/home", {});
  const creator = layerOne.viewMarkup("/galaxy/creator", {});

  assert.equal((home.match(/data-hh-galaxy-home-host\b/g) || []).length, 1);
  assert.equal((home.match(/data-hh-galaxy-creator-host\b/g) || []).length, 0);
  assert.equal((creator.match(/data-hh-galaxy-creator-host\b/g) || []).length, 1);
  assert.equal((creator.match(/data-hh-galaxy-home-host\b/g) || []).length, 0);
  assert.equal((home.match(/<main\b/gi) || []).length, 1, "home delegate must not add main");
  assert.equal((creator.match(/<main\b/gi) || []).length, 1, "Creator delegate must not add main");
  assert.match(home, /<div\b[^>]*data-hh-galaxy-home-host\b/);
  assert.match(creator, /<div\b[^>]*data-hh-galaxy-creator-host\b/);
});

test("Tools, Analytics and Settings each receive a distinct visual hero", () => {
  const copies = new Set();
  for (const [id, route] of VISUAL_UTILITY_DESTINATIONS) {
    const markup = layerOne.viewMarkup(route, {});
    assertVisualHero(markup, id);
    assert.equal((markup.match(/<main\b/gi) || []).length, 1);
    copies.add(heroCopy(markup, id));
  }
  assert.equal(copies.size, VISUAL_UTILITY_DESTINATIONS.length);
});

test("world stylesheet is shell-scoped and declares all twelve route tones", () => {
  assert.equal(fs.existsSync(worldStylesPath), true, "galaxy-layer-one-worlds.css must ship with the world markup");
  assert.match(worldStyles, /\.hh-galaxy-app\s+\.hgl1-world-hero/);
  assert.match(worldStyles, /\.hh-galaxy-app\s+\.hgl1-nav__planet/);
  assert.doesNotMatch(worldStyles, /(^|[},])\s*\.hgl1-[\w_-]+/m, "hgl1 rules must remain under .hh-galaxy-app");
  assert.doesNotMatch(worldStyles, /(^|[},])\s*(?:html|body|:root|\*)\s*(?:[,{])/m);

  for (const [id] of DESTINATIONS) {
    assert.match(
      worldStyles,
      new RegExp(`\\.hh-galaxy-app[^{,]*\\.hgl1-(?:world-hero|nav__planet)--${id}\\b`),
      `missing scoped visual tone for ${id}`
    );
  }
});

test("world visuals cover narrow 390px and 320px layouts plus keyboard and motion preferences", () => {
  const maxWidthBreakpoints = [...worldStyles.matchAll(/@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)/gi)]
    .map((match) => Number(match[1]));
  assert.ok(maxWidthBreakpoints.some((value) => value <= 390), "missing phone breakpoint for 390px");
  assert.ok(maxWidthBreakpoints.some((value) => value <= 340), "missing compact breakpoint suitable for 320px");
  assert.match(worldStyles, /:focus-visible/);
  assert.match(worldStyles, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i);
  assert.match(worldStyles, /minmax\(0\s*,\s*1fr\)|min-width\s*:\s*0/i);
  assert.match(worldStyles, /overflow(?:-x)?\s*:\s*(?:auto|clip|hidden)/i);
  assert.match(worldStyles, /container\s*:\s*hgl1-creator-world\s*\/\s*inline-size/i);
  assert.match(worldStyles, /\.hgl1-delegated-host--creator\.gcs-host\s*\{[^}]*container\s*:/i);
  assert.match(worldStyles, /@container\s+hgl1-creator-world\s*\(\s*max-width\s*:\s*1000px\s*\)/i);
  assert.match(worldStyles, /@container[^}]*\{[\s\S]*?\.gcs-topbar\s*\{[\s\S]*?grid-template-columns\s*:\s*minmax\(0\s*,\s*1fr\)\s+auto/i);
});

test("world markup and CSS contain no remote embeds, Core gateway calls or fabricated KPI claims", () => {
  const markup = DESTINATIONS.map(([, route]) => layerOne.viewMarkup(route, {})).join("\n");
  const shippedWorldCode = `${layerOneSource}\n${worldStyles}`;

  assert.doesNotMatch(markup, /<iframe\b|<(?:img|script|link)\b[^>]*(?:src|href)\s*=\s*["']https?:/i);
  assert.doesNotMatch(layerOneSource, /<iframe\b|https?:\/\//i);
  assert.doesNotMatch(worldStyles, /url\(\s*["']?https?:/i);
  assert.doesNotMatch(layerOneSource, /\bHHCoreGateway\b|data-gha-entry\b/);
  assert.doesNotMatch(shippedWorldCode, /\b(?:1\.2M|12\.5K|45\.6K|3,?450|73%|93%|99\.9%)\b/i);
  assert.doesNotMatch(markup, /(?:doanh thu|người đăng ký|lượt xem giả|người online)\s*[:：]?\s*[+\d$]/i);
});
