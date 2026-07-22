const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const expectedRoutes = [
  "/home",
  "/create",
  "/music-ai/studio",
  "/media-design",
  "/graphic-design",
  "/dev-tools",
  "/work",
  "/communication",
  "/entertainment",
  "/analytics",
  "/learn",
  "/english",
  "/system",
  "/support"
];

test("auth solar universe contains every top-level HH destination", () => {
  const client = read("auth-creative-universe.js");
  for (const route of expectedRoutes) {
    assert.match(client, new RegExp(`route:\\s*"${route.replaceAll("/", "\\/")}"`), `missing ${route}`);
  }
  assert.equal((client.match(/\bid:\s*"[^"]+",\s*short:/g) || []).length, expectedRoutes.length);
  assert.match(client, /modules\.length/);
});

test("planets use three real orbit shells around the HH sun", () => {
  const client = read("auth-creative-universe.js");
  const css = read("auth-creative-universe.css");
  assert.match(client, /data-orbit="1"/);
  assert.match(client, /data-orbit="2"/);
  assert.match(client, /data-orbit="3"/);
  assert.match(client, /--orbit-radius:/);
  assert.match(client, /--orbit-angle:/);
  assert.match(css, /auth-universe-core/);
  assert.match(css, /auth-universe-orbit/);
  assert.match(css, /auth-universe-counter-orbit/);
  assert.match(css, /auth-universe-sun-breathe/);
});

test("solar universe selects a post-login destination without browser dialogs", () => {
  const client = read("auth-creative-universe.js");
  assert.match(client, /PENDING_ROUTE_KEY/);
  assert.match(client, /sessionStorage\.setItem\(PENDING_ROUTE_KEY/);
  assert.match(client, /route:\s*item\.route/);
  assert.match(client, /hh:auth-universe-select/);
  assert.match(client, /data-universe-open/);
  assert.doesNotMatch(client, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
});

test("solar universe replaces the duplicate product tour and has mobile and accessibility fallbacks", () => {
  const client = read("auth-creative-universe.js");
  const css = read("auth-creative-universe.css");
  assert.match(client, /auth-universe-replaced/);
  assert.match(client, /aria-hidden/);
  assert.match(css, /auth-feature-showcase\.auth-universe-replaced/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
});

test("auth field validation does not recursively dispatch invalid events", () => {
  const client = read("auth-experience.js");
  assert.match(client, /input\.validity\.valid/);
  assert.doesNotMatch(client, /const valid = input\.checkValidity\(\)/);
});
