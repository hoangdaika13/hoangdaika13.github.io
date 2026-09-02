const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layerOneSource = read("galaxy-layer-one.js");
const worldStylesPath = path.join(root, "galaxy-layer-one-worlds.css");
const worldStyles = fs.existsSync(worldStylesPath) ? fs.readFileSync(worldStylesPath, "utf8") : "";
const indexSource = read("index.html");
const loaderSource = read("performance-loader.js");
const serviceWorkerSource = read("sw.js");
const portalAssetManifest = JSON.parse(read("assets/galaxy/function-portals/asset-manifest.v1.json"));
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

const FINAL_PORTAL_ASSETS = Object.freeze([
  ["ai", "/galaxy/ai", "assets/galaxy/function-portals/ai-universe-v1.png"],
  ["music", "/galaxy/music", "assets/galaxy/function-portals/music-planet-v1.png"],
  ["video", "/galaxy/video", "assets/galaxy/function-portals/video-planet-v1.png"],
  ["creator", "/galaxy/creator", "assets/galaxy/function-portals/creator-studio-v1.png"],
  ["games", "/galaxy/games", "assets/galaxy/function-portals/games-world-v1.png"],
  ["dev", "/galaxy/dev", "assets/galaxy/function-portals/dev-planet-v2.png"],
  ["learning", "/galaxy/learning", "assets/galaxy/function-portals/learning-star-v1.png"],
  ["community", "/galaxy/community", "assets/galaxy/function-portals/community-v1.png"],
  ["tools", "/galaxy/tools", "assets/galaxy/function-portals/tools-galaxy-v1.png"],
  ["analytics", "/galaxy/analytics", "assets/galaxy/function-portals/analytics-v1.png"],
  ["settings", "/galaxy/settings", "assets/galaxy/function-portals/settings-v2.png"]
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

test("the eleven function worlds render one verified local hero image each", () => {
  assert.equal(portalAssetManifest.schema, "hh-galaxy-function-portals");
  assert.equal(portalAssetManifest.version, 1);
  assert.deepEqual(Object.keys(portalAssetManifest.assets), FINAL_PORTAL_ASSETS.map(([id]) => id));

  for (const [id, route, expectedPath] of FINAL_PORTAL_ASSETS) {
    const asset = portalAssetManifest.assets[id];
    assert.equal(asset.path, expectedPath, `${id} manifest selection drifted`);
    assert.equal(asset.mimeType, "image/png");
    assert.equal(asset.width, 1672);
    assert.equal(asset.height, 941);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);

    const absolutePath = path.join(root, ...expectedPath.split("/"));
    assert.equal(fs.existsSync(absolutePath), true, `${expectedPath} is missing`);
    const bytes = fs.readFileSync(absolutePath);
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${id} is not a PNG`);
    assert.equal(bytes.readUInt32BE(16), asset.width, `${id} width drifted`);
    assert.equal(bytes.readUInt32BE(20), asset.height, `${id} height drifted`);
    assert.equal(bytes.length, asset.bytes, `${id} byte size drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${id} checksum drifted`);

    const markup = layerOne.viewMarkup(route, {});
    assert.equal(classCount(markup, "hgl1-world-hero__media"), 1, `${id} must render one picture`);
    assert.equal(classCount(markup, `hgl1-world-hero__media--${id}`), 1, `${id} picture modifier is missing`);
    assert.equal(classCount(markup, "hgl1-world-hero__image"), 1, `${id} must render one image`);
    const picture = markup.match(/<picture\b[^>]*class="[^"]*\bhgl1-world-hero__media\b[^"]*"[^>]*>/i)?.[0] || "";
    const image = markup.match(/<img\b[^>]*class="hgl1-world-hero__image"[^>]*>/i)?.[0] || "";
    assert.match(picture, /aria-hidden="true"/i, `${id} decorative art must stay silent`);
    assert.ok(image.includes(`src="${expectedPath}"`), `${id} markup uses the wrong asset`);
    assert.match(image, /\bwidth="1672"/i);
    assert.match(image, /\bheight="941"/i);
    assert.match(image, /\balt=""/i);
    assert.match(image, /\bloading="eager"/i);
    assert.match(image, /\bdecoding="async"/i);
    assert.match(image, /\bfetchpriority="high"/i);
    assert.doesNotMatch(image, /https?:\/\//i);
  }

  const home = layerOne.viewMarkup("/home", {});
  assert.doesNotMatch(home, /assets\/galaxy\/function-portals\//i, "Home must not preload portal art");
  assert.equal(classCount(home, "hgl1-world-hero__image"), 0);
  assert.equal(fs.existsSync(path.join(root, "assets", "galaxy", "function-portals", "dev-planet-v1.png")), true);
  assert.equal(fs.existsSync(path.join(root, "assets", "galaxy", "function-portals", "settings-v1.png")), true);
});

test("portal art is release-versioned and remains runtime-cached instead of install-preloaded", () => {
  const loaderVersion = indexSource.match(/<script\b[^>]*src="performance-loader\.js\?v=(\d+)"/i)?.[1];
  const layerVersion = loaderSource.match(/"galaxy-layer-one\.js\?v=(\d+)"/)?.[1];
  const worldsVersion = loaderSource.match(/"galaxy-layer-one-worlds\.css\?v=(\d+)"/)?.[1];
  assert.ok(loaderVersion, "index must load a versioned performance loader");
  assert.ok(layerVersion, "the Layer One group must load a versioned shell");
  assert.ok(worldsVersion, "the Layer One group must load a versioned world stylesheet");
  assert.doesNotMatch(indexSource, /<link\b[^>]*rel="preload"[^>]*function-portals/i);
  assert.match(serviceWorkerSource, /const CACHE = "hh-identity-portal-v\d+"/);
  assert.match(serviceWorkerSource, new RegExp("\\.\\/performance-loader\\.js\\?v=" + loaderVersion));
  assert.match(serviceWorkerSource, new RegExp("\\.\\/galaxy-layer-one-worlds\\.css\\?v=" + worldsVersion));
  assert.match(serviceWorkerSource, new RegExp("\\.\\/galaxy-layer-one\\.js\\?v=" + layerVersion));

  const runtimeBlock = serviceWorkerSource.match(/const RUNTIME_ASSETS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const coreBlock = serviceWorkerSource.match(/const CORE = \[([\s\S]*?)\n\];/)?.[1] || "";
  assert.ok(runtimeBlock, "service worker runtime catalog is missing");
  assert.ok(coreBlock, "service worker install core is missing");
  for (const [, , assetPath] of FINAL_PORTAL_ASSETS) {
    assert.ok(runtimeBlock.includes(`./${assetPath}`), `${assetPath} is missing from runtime cache catalog`);
  }
  assert.doesNotMatch(coreBlock, /function-portals/i, "portal PNGs must not enter the install-time core");
  assert.match(serviceWorkerSource, /const INSTALL_ASSETS = \[\.\.\.new Set\(\[\.\.\.CORE, \.\.\.EONWILD_OFFLINE_ASSETS\]\)\]/);
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

test("world markup and CSS contain no unapproved remote embeds, Core gateway calls or fabricated KPI claims", () => {
  const markup = DESTINATIONS.map(([, route]) => layerOne.viewMarkup(route, {})).join("\n");
  const shippedWorldCode = `${layerOneSource}\n${worldStyles}`;
  const remoteUrlLiterals = [...layerOneSource.matchAll(/https?:\/\/[^\s"'\\<>]+/gi)].map((match) => match[0]);
  const parserSource = layerOneSource.match(/function parseYouTubeId\(value\)\s*\{[\s\S]*?\n  \}/)?.[0] || "";
  const playerSource = layerOneSource.match(/function openYouTubeVideo\(value\)\s*\{[\s\S]*?\n  \}/)?.[0] || "";

  assert.doesNotMatch(markup, /<iframe\b|<(?:img|script|link)\b[^>]*(?:src|href)\s*=\s*["']https?:/i);
  assert.doesNotMatch(layerOneSource, /<iframe\b/i, "an iframe must never ship inside initial markup");
  assert.deepEqual(remoteUrlLiterals, [
    "https://www.youtube.com/watch?v=…",
    "https://www.youtube-nocookie.com/embed/"
  ], "only the inert YouTube input example and fixed privacy-enhanced embed origin are allowed");
  assert.equal((layerOneSource.match(/createElement\("iframe"\)/g) || []).length, 1);

  assert.notEqual(parserSource, "", "parseYouTubeId must remain an explicit allowlist parser");
  assert.match(parserSource, /host\s*===\s*"youtu\.be"/);
  assert.match(parserSource, /\["youtube\.com",\s*"m\.youtube\.com",\s*"music\.youtube\.com"\]\.includes\(host\)/);
  assert.ok(parserSource.includes('return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";'), "YouTube IDs must remain exactly 11 safe characters");

  assert.notEqual(playerSource, "", "the dynamic player installer must remain inspectable");
  assert.match(playerSource, /const id\s*=\s*parseYouTubeId\(value\)/);
  assert.match(playerSource, /frame\.src\s*=\s*"https:\/\/www\.youtube-nocookie\.com\/embed\/"\s*\+\s*id\s*\+\s*"\?autoplay=0&playsinline=1&rel=0"/);
  assert.doesNotMatch(playerSource, /frame\.src\s*=\s*[^;]*(?:value|raw|parsed)/, "raw user input must never be interpolated into iframe.src");
  assert.match(playerSource, /referrerPolicy\s*=\s*"strict-origin-when-cross-origin"/i);
  assert.doesNotMatch(worldStyles, /url\(\s*["']?https?:/i);
  assert.doesNotMatch(layerOneSource, /\bHHCoreGateway\b|data-gha-entry\b/);
  assert.doesNotMatch(shippedWorldCode, /\b(?:1\.2M|12\.5K|45\.6K|3,?450|73%|93%|99\.9%)\b/i);
  assert.doesNotMatch(markup, /(?:doanh thu|người đăng ký|lượt xem giả|người online)\s*[:：]?\s*[+\d$]/i);
});
