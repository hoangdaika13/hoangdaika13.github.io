const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("registration accepts passwords from eight characters on client and API", () => {
  const html = read("index.html");
  const client = read("script.js");
  const api = read("api/auth/[...action].js");

  assert.match(html, /name="password"[^>]*minlength="8"[^>]*data-register-password/);
  assert.match(html, /name="confirmPassword"[^>]*minlength="8"/);
  assert.doesNotMatch(html, /minlength="15"|15 ký tự/);
  assert.match(client, /password\.length < 8/);
  assert.match(client, /value\.length >= 8/);
  assert.match(api, /value\.length >= 8/);
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
  assert.match(sidebarCss, /Unified navigation system/);
  assert.match(sidebarCss, /\.app-sidebar__group>\.app-sidebar__item,/);
});

test("enhanced authentication motion remains accessible", () => {
  const html = read("index.html");
  const css = read("auth-experience.css");
  const client = read("auth-experience.js");

  assert.match(html, /auth-motion-field/);
  assert.match(html, /auth-feature-showcase/);
  assert.match(html, /data-auth-demo="ai"/);
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
});

test("custom domain branding and Google-only OAuth stay in sync", () => {
  const html = read("index.html");
  const api = read("api/auth/[...action].js");
  const platform = read("utils/platform.js");
  const manifest = read("manifest.webmanifest");

  assert.equal(read("CNAME").trim(), "nhhoang13all.xyz");
  assert.match(html, /<title>Nhhoang \| HH Neon Platform<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/nhhoang13all\.xyz\/"/);
  assert.match(html, /data-oauth-provider="google"/);
  assert.doesNotMatch(html, /data-oauth-provider="facebook"|id="facebookLogin"/);
  assert.match(api, /https:\/\/nhhoang13all\.xyz/);
  assert.doesNotMatch(api, /FACEBOOK_APP_ID|graph\.facebook\.com|facebookVersion/);
  assert.match(platform, /https:\/\/nhhoang13all\.xyz/);
  assert.match(manifest, /Nhhoang · HH Neon Platform/);
  assert.match(manifest, /assets\/favicon\.svg\?v=3/);
});
