const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const extractArray = (source, name, nextName) => {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];\\s*\\n\\s*const\\s+${nextName}\\b`);
  const match = source.match(pattern);
  assert.ok(match, `${name} must remain a statically inspectable array`);
  return match[1];
};

const assertLabelRoute = (source, label, route) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    source,
    new RegExp(`label:\\s*["']${escapedLabel}["'][\\s\\S]*?route:\\s*["']${escapedRoute}["']`),
    `${label} must point to the real ${route} route`
  );
};

test("index loads the complete Galaxy OS experience asset bundle", () => {
  const index = read("index.html");

  for (const asset of ["galaxy-os.css", "galaxy-experiences.css"]) {
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
    assert.match(
      index,
      new RegExp(`<link[^>]+rel=["']stylesheet["'][^>]+href=["']${asset.replace(".", "\\.")}\\?v=\\d+["'][^>]*>`),
      `${asset} must be versioned and loaded as a stylesheet`
    );
  }

  for (const asset of ["galaxy-os.js", "galaxy-experiences.js"]) {
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
    assert.match(
      index,
      new RegExp(`<script[^>]+src=["']${asset.replace(".", "\\.")}\\?v=\\d+["'][^>]*\\sdefer[^>]*><\\/script>`),
      `${asset} must be versioned and deferred`
    );
  }
});

test("Galaxy navigation exposes exactly the twelve requested real destinations", () => {
  const source = read("galaxy-os.js");
  const nav = extractArray(source, "GALAXY_NAV", "PLANETS");
  const destinations = [
    ["Home Galaxy", "/home"],
    ["AI Universe", "/chat-ai"],
    ["Music Planet", "/music-ai"],
    ["Video Planet", "/davinci-resolve"],
    ["Creator Studio", "/create"],
    ["Games World", "/play"],
    ["Dev Planet", "/dev-tools"],
    ["Learning Star", "/learn"],
    ["Community", "/communication"],
    ["Tools Galaxy", "/tools"],
    ["Analytics", "/analytics"],
    ["Settings", "/settings"]
  ];

  assert.equal((nav.match(/\{\s*id:\s*["']/g) || []).length, destinations.length);
  for (const [label, route] of destinations) assertLabelRoute(nav, label, route);
  assert.match(source, /data-hh-galaxy-nav/);
  assert.match(source, /data-app-route=/);
});

test("Experience Hub exposes the eight image-matched workspaces without duplicate fake pages", () => {
  const source = read("galaxy-experiences.js");
  const experiences = extractArray(source, "HOME_EXPERIENCES", "AI_SATELLITES");

  assert.equal((experiences.match(/\{\s*id:\s*["']/g) || []).length, 8);
  for (const label of [
    "Personal Dashboard",
    "Web Desktop",
    "AI Universe",
    "Project Hub",
    "Media Vault",
    "Automation Builder",
    "Ambient Room",
    "Community Showcase"
  ]) {
    assert.match(experiences, new RegExp(`label:\\s*["']${label}["']`));
  }

  for (const [label, route] of [
    ["AI Universe", "/chat-ai"],
    ["Project Hub", "/work/project-center"],
    ["Media Vault", "/create/media-center"],
    ["Automation Builder", "/work/automation-lab"],
    ["Community Showcase", "/communication/community"]
  ]) {
    assertLabelRoute(experiences, label, route);
  }

  assert.match(experiences, /label:\s*["']Personal Dashboard["'][\s\S]*?action:\s*["']dashboard["']/);
  assert.match(experiences, /label:\s*["']Web Desktop["'][\s\S]*?action:\s*["']desktop["']/);
  assert.match(experiences, /label:\s*["']Ambient Room["'][\s\S]*?action:\s*["']ambient["']/);
  assert.match(source, /data-hh-experience-hub/);
  assert.match(source, /data-hh-desktop/);
  assert.match(source, /data-hh-ambient-room/);
});

test("Creator Pipeline contains nine ordered steps and every destination is registered", () => {
  const galaxy = read("galaxy-os.js");
  const pipeline = extractArray(galaxy, "PIPELINE", "safeJsonArray");
  const applicationSources = `${read("script.js")}\n${read("index.html")}`;
  const steps = [
    ["IDEA", "/create"],
    ["SCRIPT", "/create/ai-script"],
    ["IMAGE", "/media-design"],
    ["VOICE", "/music-ai/vocal"],
    ["MUSIC", "/music-ai"],
    ["VIDEO", "/davinci-resolve/davinci"],
    ["THUMBNAIL", "/davinci-resolve/image-text"],
    ["SEO", "/davinci-resolve/youtube"],
    ["PUBLISH", "/davinci-resolve/youtube-batch"]
  ];

  assert.equal((pipeline.match(/\{\s*label:\s*["']/g) || []).length, steps.length);
  for (const [label, route] of steps) {
    assertLabelRoute(pipeline, label, route);
    assert.ok(
      applicationSources.includes(`"${route}"`) || applicationSources.includes(`'${route}'`),
      `${route} must be registered by the existing application`
    );
  }
  assert.match(galaxy, /data-hh-creator-pipeline/);
});

test("Galaxy experiences do not hard-code known screenshot-only metrics", () => {
  const sources = [
    "galaxy-os.js",
    "galaxy-os.css",
    "galaxy-experiences.js",
    "galaxy-experiences.css"
  ].map(read).join("\n");

  for (const fakeMetric of [/12[.,]5K\+?/i, /2[.,]4\s*TB/i, /99[.,]9\s*%/i, /\$\s*3[,.]?450/i]) {
    assert.doesNotMatch(sources, fakeMetric);
  }
  assert.match(sources, /MODULE REGISTRY|moduleCount/);
  assert.match(sources, /localStorage/);
  assert.match(sources, /navigator\.onLine/);
});

test("Galaxy CSS supports responsive layouts, focus visibility and reduced motion", () => {
  const css = `${read("galaxy-os.css")}\n${read("galaxy-experiences.css")}`;

  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*(?:430|375)px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*(?:auto|hidden|clip)/);
});

test("new Galaxy JavaScript parses and keeps the real control bridges", () => {
  const os = read("galaxy-os.js");
  const experiences = read("galaxy-experiences.js");

  assert.doesNotThrow(() => new vm.Script(os, { filename: "galaxy-os.js" }));
  assert.doesNotThrow(() => new vm.Script(experiences, { filename: "galaxy-experiences.js" }));

  for (const contract of [
    /document\.getElementById\(["']musicToggle["']\)/,
    /document\.getElementById\(["']musicNext["']\)/,
    /document\.getElementById\(["']musicVolume["']\)/,
    /data-command-open/,
    /data-app-route/
  ]) {
    assert.match(os, contract);
  }
  assert.match(experiences, /hh\.[a-z0-9.-]+/i);
  assert.match(experiences, /escapeHtml/);
});

test("deployment identity is nhhoang13all.xyz, never hoang8.com", () => {
  const cname = read("CNAME").trim();
  const index = read("index.html");
  const canonical = index.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const openGraphUrl = index.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i)?.[1];

  assert.equal(cname, "nhhoang13all.xyz");
  assert.equal(canonical, "https://nhhoang13all.xyz/");
  assert.equal(openGraphUrl, "https://nhhoang13all.xyz/");
  assert.doesNotMatch(`${cname}\n${canonical}\n${openGraphUrl}`, /hoang8\.com/i);
});
