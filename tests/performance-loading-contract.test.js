const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("the first paint only loads the shell and identity portal", () => {
  const html = read("index.html");
  const executableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const styles = [...executableHtml.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)];
  const scripts = [...executableHtml.matchAll(/<script\b[^>]*src=["'][^"']+["'][^>]*>/gi)];

  assert.ok(styles.length <= 20, `initial stylesheet budget exceeded: ${styles.length}`);
  assert.ok(scripts.length <= 15, `initial script budget exceeded: ${scripts.length}`);
  assert.match(executableHtml, /performance-loader\.js\?v=\d+/);
  assert.doesNotMatch(executableHtml, /<script[^>]+(?:space-explorer|video-editor-resolve|english-learning|music-ai-studio)\.js/i);
});

test("heavy workspaces load by route and retain deterministic dependencies", () => {
  const loader = read("performance-loader.js");
  for (const group of ["home", "platform", "dev", "media", "graphic", "creative", "music", "communication", "work", "game", "learning", "english", "analytics", "support"]) {
    assert.match(loader, new RegExp(`${JSON.stringify(group)}|\\b${group}:`), `${group} is not registered`);
  }
  assert.match(loader, /ensureForRoute/);
  assert.match(loader, /script\.async\s*=\s*false/);
  assert.match(loader, /requestIdleCallback/);
  assert.match(loader, /data-search-watch-open/);
});

test("service worker precaches a small shell and uses stale while revalidate", () => {
  const worker = read("sw.js");
  const core = worker.match(/const CORE = \[([\s\S]*?)\n\];/);
  assert.ok(core, "CORE cache list is missing");
  const entries = [...core[1].matchAll(/"\.\//g)];
  assert.ok(entries.length <= 16, `service worker core budget exceeded: ${entries.length}`);
  assert.match(worker, /caches\.match\(request\)/);
  assert.match(worker, /event\.waitUntil\(refresh/);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("the identity logo stays within the first-paint image budget", () => {
  const logo = fs.statSync(path.join(root, "assets", "hh-neon-logo-v2.png"));
  assert.ok(logo.size <= 200_000, `identity logo budget exceeded: ${logo.size} bytes`);
});
