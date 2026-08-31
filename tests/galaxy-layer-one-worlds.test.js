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

const LEARNING_PLATFORM_DESTINATIONS = Object.freeze([
  ["japanese", "/japanese", /Nhật|Japanese/i],
  ["english", "/english", /Anh|English/i],
  ["chinese", "/chinese", /Trung|Chinese/i],
  ["dharma", "/phat-phap", /Phật|Buddh/i]
]);

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

function unscopedHgl1RulePreludes(css) {
  return [...String(css || "").matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].replace(/\/\*[\s\S]*?\*\//g, " ").trim())
    .filter((prelude) => prelude.includes(".hgl1-") && !prelude.startsWith("@"))
    .filter((prelude) => !prelude.includes(".hh-galaxy-app"));
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
    if (id === "learning") {
      assert.equal(classCount(markup, "hgl1-learning-destinations"), 1);
      assert.equal(classCount(markup, "hgl1-learning-destination"), 4);
    } else {
      assert.equal(classCount(markup, "hgl1-portal-grid"), 1, `${id} portal grid is missing`);
      assert.ok(classCount(markup, "hgl1-portal-card") >= 3, `${id} needs meaningful portals`);
    }
    assert.equal((markup.match(/<main\b/gi) || []).length, 1, `${id} must not nest a second main landmark`);

    heroCopies.add(heroCopy(markup, id));
    portalCopies.add(id === "learning" ? textContent(markup.match(/<section\b[^>]*\bhgl1-learning-destinations\b[^>]*>([\s\S]*?)<\/section>/)[1]) : portalCopy(markup));
  }

  assert.equal(heroCopies.size, MODULE_DESTINATIONS.length, "world hero copy must not be cloned");
  assert.equal(portalCopies.size, MODULE_DESTINATIONS.length, "world portals must describe their own capability set");
});

test("Learning Star presents one semantic five-stage journey", () => {
  const markup = layerOne.viewMarkup("/galaxy/learning", {});

  assert.equal(classCount(markup, "hgl1-learning-shell"), 1);
  assert.equal(classCount(markup, "hgl1-learning-journey"), 1);
  assert.equal(classCount(markup, "hgl1-learning-journey__track"), 1);
  assert.equal(classCount(markup, "hgl1-learning-stage"), 5);
  assert.match(markup, /<section\b[^>]*class="[^"]*\bhgl1-learning-journey\b[^"]*"[^>]*aria-labelledby="[^"]+"/i);
  assert.equal(new Set([...markup.matchAll(/data-stage="([^"]+)"/g)].map((match) => match[1])).size, 5);
  assert.doesNotMatch(markup, /<main\b[\s\S]*<main\b/i);
});

test("Learning Star describes four real platform destinations but fails closed through Home", () => {
  const markup = layerOne.viewMarkup("/galaxy/learning", {});
  assert.equal(classCount(markup, "hgl1-learning-destinations"), 1);
  assert.equal(classCount(markup, "hgl1-learning-destination"), LEARNING_PLATFORM_DESTINATIONS.length);

  for (const [id, route, label] of LEARNING_PLATFORM_DESTINATIONS) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cardMatch = markup.match(new RegExp(
      `<article\\b[^>]*class="[^"]*\\bhgl1-learning-destination(?:--${id})?\\b[^"]*"[^>]*data-platform-route="${escapedRoute}"[^>]*>([\\s\\S]*?)<\\/article>`
    ));
    assert.ok(cardMatch, `missing declared platform destination ${route}`);
    assert.match(textContent(cardMatch[1]), label, `missing useful label for ${route}`);
    assert.match(cardMatch[1], /<button\b[^>]*data-hgl1-action="open-platform-via-core"/i);
    assert.match(cardMatch[1], /HH CORE/i);
    assert.doesNotMatch(cardMatch[1], new RegExp(`(?:href|data-hgl1-route)="?#?${escapedRoute}`));
    assert.equal(layerOne.canHandle(route), false, `${route} must remain outside Layer One`);
  }

  assert.match(layerOneSource, /open-platform-via-core[\s\S]{0,900}(?:#?\/home|navigate[^\n]*home)/i);
  assert.doesNotMatch(layerOneSource, /\bHHCoreGateway\b|data-gha-entry\b/);
});

test("Learning library, plan, progress and quick note stay local-first", () => {
  const state = {
    items: [
      { id: "learning-note-1", route: "/galaxy/learning", title: "Ghi chú <riêng>", kind: "learning-note", meta: { learningCategory: "note" } },
      { id: "learning-plan-1", route: "/galaxy/learning", title: "Kế hoạch tuần này", kind: "learning-plan", meta: { learningCategory: "plan", dueDate: "2026-09-04", completed: true } },
      { id: "learning-import-1", route: "/galaxy/learning", title: "Tài liệu đã nhập", kind: "learning-resource", meta: { learningCategory: "resource", fileName: "lesson.md" } }
    ]
  };
  const markup = layerOne.viewMarkup("/galaxy/learning", state);

  for (const className of [
    "hgl1-learning-layout", "hgl1-learning-main", "hgl1-learning-rail",
    "hgl1-learning-today", "hgl1-learning-library", "hgl1-learning-library__filters",
    "hgl1-learning-library__grid", "hgl1-learning-progress", "hgl1-learning-schedule",
    "hgl1-learning-quick-note"
  ]) {
    assert.ok(classCount(markup, className) >= 1, `missing ${className}`);
  }

  assert.match(markup, /<input\b[^>]*type="search"[^>]*data-hgl1-learning-search/i);
  for (const filter of ["all", "notes", "plans", "imports", "templates"]) {
    assert.match(markup, new RegExp(`data-hgl1-action="filter-learning"[^>]*data-learning-filter="${filter}"`));
  }
  assert.ok(classCount(markup, "hgl1-learning-resource") >= 3);
  assert.match(markup, /data-learning-category="(?:note|notes)"/);
  assert.match(markup, /data-learning-category="(?:plan|plans)"/);
  assert.match(markup, /data-learning-category="(?:resource|imports)"/);
  assert.match(markup, /<form\b[^>]*data-hgl1-learning-note-form/i);
  assert.match(markup, /<form\b[^>]*data-hgl1-learning-plan-form/i);
  assert.match(markup, /<textarea\b[^>]*name="(?:title|note)"|<textarea\b[^>]*data-hgl1-learning/i);
  assert.match(markup, /<section\b[^>]*class="[^"]*\bhgl1-learning-progress\b[^"]*"[^>]*>[\s\S]*?<dl>[\s\S]*?<dt>[\s\S]*?<dd>/i);
  assert.match(markup, /data-hgl1-action="toggle-learning"[^>]*data-item-id="learning-plan-1"/i);
  assert.match(markup, /Ghi chú &lt;riêng&gt;/);
  assert.doesNotMatch(markup, /fetch\s*\(|XMLHttpRequest|<iframe\b|https?:\/\//i);
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
  assert.deepEqual(unscopedHgl1RulePreludes(worldStyles), [], "hgl1 rules must remain under .hh-galaxy-app");
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

test("Learning Star styles are scoped, keyboard-visible, semantic and phone responsive", () => {
  const required = [
    "learning-shell", "learning-journey", "learning-journey__track", "learning-stage",
    "learning-destinations", "learning-destination", "learning-layout", "learning-main",
    "learning-rail", "learning-today", "learning-library", "learning-progress",
    "learning-schedule", "learning-quick-note"
  ];
  for (const token of required) {
    assert.match(worldStyles, new RegExp(`\\.hh-galaxy-app[^{,]*\\.hgl1-${token}\\b`), `missing scoped .hgl1-${token}`);
  }

  assert.match(worldStyles, /\.hh-galaxy-app\[data-route="\/galaxy\/learning"\][\s\S]{0,500}:focus-visible/i);
  assert.match(worldStyles, /@media\s*\(\s*max-width\s*:\s*(?:767|430|390|340)px\s*\)[\s\S]*?\.hgl1-learning-(?:layout|destinations|library)/i);
  assert.match(worldStyles, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*?\.hgl1-learning/i);
  assert.match(worldStyles, /learning-portals-atlas-v1\.png/i);
  assert.equal(fs.existsSync(path.join(root, "assets", "galaxy", "learning-portals-atlas-v1.png")), true);
  assert.match(worldStyles, /\.hgl1-learning-resource\[hidden\][\s\S]{0,180}display\s*:\s*none\s*!important/i);
  assert.deepEqual(unscopedHgl1RulePreludes(worldStyles).filter((prelude) => prelude.includes(".hgl1-learning")), []);
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
