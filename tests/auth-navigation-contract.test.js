const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("registration enforces the twelve-character password policy on client and API", () => {
  const html = read("index.html");
  const client = read("auth-platform.js");
  const api = read("api/auth/[...action].js");
  const policy = read("utils/password-policy.js");

  assert.match(html, /name="password"[^>]*minlength="12"[^>]*data-register-password/);
  assert.match(html, /name="confirmPassword"[^>]*minlength="12"/);
  assert.doesNotMatch(html, /minlength="15"|15 ký tự/);
  assert.match(client, /Array\.from\(password\)\.length < 12/);
  assert.match(client, /Array\.from\(value\)\.length >= 12/);
  assert.match(api, /checkPassword\(password\)/);
  assert.match(policy, /MIN_PASSWORD_CHARACTERS = 12/);
  assert.match(policy, /MAX_PASSWORD_BYTES = 72/);
  assert.doesNotMatch(api, /value\.length >= 15|15 ký tự/);
});

test("sidebar uses one shared visual system for every primary group", () => {
  const client = read("script.js");
  const creativeClient = read("creative-suite.js");
  const creativeCss = read("creative-suite.css");
  const sidebarCss = read("sidebar-navigation-pro.css");

  assert.match(client, /app-sidebar__count/);
  assert.match(client, /app-sidebar__chevron/);
  assert.doesNotMatch(creativeClient, /classList\.add\("is-creative-group"\)/);
  assert.doesNotMatch(creativeCss, /\.is-creative-group/);
  assert.match(sidebarCss, /HH Platform category navigation/);
  assert.match(sidebarCss, /\.app-sidebar__section-toggle/);
  assert.match(sidebarCss, /\.app-sidebar__tool-row/);
  assert.match(sidebarCss, /\.app-sidebar__subitem/);
  assert.match(sidebarCss, /--nav-accent/);
  assert.match(sidebarCss, /hh-sidebar-group-live/);
  assert.match(creativeClient, /"ai-script":[\s\S]*color: "#ff62c8"/);
  assert.match(creativeCss, /Kịch bản AI shares the same visual language/);
  assert.match(creativeCss, /\.creative-ai-script-stage \.neon-tabs \.mini-tab\.active/);
});

test("authentication uses calm motion with pausable automatic previews", () => {
  const html = read("index.html");
  const css = read("auth-experience.css");
  const galaxyCss = read("auth-h-galaxy.css");
  const comfort = read("motion-comfort.css");
  const client = read("auth-experience.js");
  const galaxyClient = read("auth-h-galaxy.js");

  assert.match(html, /auth-motion-field/);
  assert.match(html, /data-hh-galaxy/);
  assert.match(html, /data-hh-galaxy-key="creative"/);
  assert.match(html, /hh-galaxy-inspector/);
  assert.match(html, /auth-tool-stream/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /auth-card-arrive/);
  assert.match(css, /auth-preview-float-heavy/);
  assert.match(css, /auth-tool-marquee/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(client, /--auth-tilt-x/);
  assert.match(client, /const demos =/);
  assert.match(client, /renderDemo/);
  assert.match(client, /4200/);
  assert.match(client, /const rotationDelay = 4200/);
  assert.match(client, /rotationPaused/);
  assert.match(client, /pointer: fine/);
  assert.match(client, /requestAnimationFrame/);
  assert.match(galaxyClient, /pointerover/);
  assert.match(galaxyClient, /keydown/);
  assert.match(galaxyClient, /selectPlanet/);
  assert.match(galaxyCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(galaxyCss, /is-selected-orbit/);
  assert.match(comfort, /Authentication remains rich/);
  assert.match(comfort, /auth-product-preview/);
  assert.match(comfort, /auth-tool-stream > div/);
});

test("custom domain branding and Google-only OAuth stay in sync", () => {
  const html = read("index.html");
  const api = read("api/auth/[...action].js");
  const platform = read("utils/platform.js");
  const manifest = read("manifest.webmanifest");

  assert.equal(fs.existsSync(path.join(root, "CNAME")), true);
  assert.equal(read("CNAME").trim(), "hoang8.com");
  assert.match(html, /<title>Nhhoang \| HH Neon Platform<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/hoang8\.com\/"/);
  assert.match(html, /data-oauth-provider="google"/);
  assert.doesNotMatch(html, /data-oauth-provider="facebook"|id="facebookLogin"/);
  assert.match(api, /https:\/\/hoang8\.com/);
  assert.doesNotMatch(api, /FACEBOOK_APP_ID|graph\.facebook\.com|facebookVersion/);
  assert.match(platform, /https:\/\/hoang8\.com/);
  assert.match(manifest, /Nhhoang · HH Neon Platform/);
  assert.match(manifest, /assets\/hh-neon-logo-v2\.png\?v=2/);
});

test("Vercel Hobby deployment stays within the twelve-function limit", () => {
  const apiRoot = path.join(root, "api");
  const countFunctions = (directory) => fs.readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    const target = path.join(directory, entry.name);
    return count + (entry.isDirectory() ? countFunctions(target) : Number(entry.isFile() && entry.name.endsWith(".js")));
  }, 0);
  const vercel = read("vercel.json");
  const donations = read("api/donations.js");

  assert.ok(countFunctions(apiRoot) <= 12);
  assert.match(vercel, /\/api\/notifications\/subscribe/);
  assert.match(vercel, /notification-subscribe/);
  assert.match(donations, /notificationSubscriptionHandler/);
});
