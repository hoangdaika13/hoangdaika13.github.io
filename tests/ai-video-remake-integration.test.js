const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("AI Video Remake Studio is reachable from Tool navigation and command search", () => {
  const shell = read("script.js");

  assert.match(shell, /id:\s*"ai-video-remake"[\s\S]*?route:\s*"\/davinci-resolve\/ai-video-remake"/);
  assert.match(shell, /title:\s*"AI Video Remake Studio"/);
  assert.match(shell, /Sản xuất video AI[\s\S]*?\/davinci-resolve\/ai-video-remake/);
  assert.match(shell, /video remix thay nhân vật character replacement motion transfer/);
});

test("the dedicated route lazy-loads only its focused workspace assets", () => {
  const loader = read("performance-loader.js");
  const dedicatedRoute = loader.indexOf('if (value === "/davinci-resolve/ai-video-remake")');
  const genericRoute = loader.indexOf('if (value.startsWith("/davinci-resolve"))');

  assert.match(loader, /"ai-video-remake":\s*\{\s*styles:\s*\["ai-video-remake-studio\.css\?v=3"\],\s*scripts:\s*\["ai-video-remake-studio\.js\?v=2"\]/);
  assert.ok(dedicatedRoute >= 0, "the dedicated route must be declared");
  assert.ok(dedicatedRoute < genericRoute, "the dedicated route must be matched before the generic Tool route");
  assert.match(loader, /return \["davinci", "ai-video-remake"\]/);
});

test("the application shell owns the AI Video Remake mount lifecycle", () => {
  const shell = read("script.js");

  assert.match(shell, /resolveView === "ai-video-remake" && window\.HHAIVideoRemakeStudio\?\.mount/);
  assert.match(shell, /window\.HHAIVideoRemakeStudio\.mount\(resolveHost/);
  assert.match(shell, /window\.HHAIVideoRemakeStudio\?\.unmount\?\.\(\)/);
  assert.match(shell, /app-ai-video-remake-route/);
  assert.match(shell, /currentUser:\s*readCurrentAuthUser\(\)/);
});

test("the service worker caches the route assets and shell versions stay aligned", () => {
  const html = read("index.html");
  const worker = read("sw.js");

  assert.match(worker, /\.\/ai-video-remake-studio\.css\?v=3/);
  assert.match(worker, /\.\/ai-video-remake-studio\.js\?v=2/);
  assert.match(worker, /hh-identity-portal-v526/);
  assert.match(html, /performance-loader\.js\?v=258/);
  assert.match(worker, /\.\/performance-loader\.js\?v=258/);
  assert.match(html, /script\.js\?v=175/);
  assert.match(worker, /\.\/script\.js\?v=175/);
});

test("the public AI Video URL reuses the Store gateway to stay inside Vercel Hobby limits", () => {
  const vercel = read("vercel.json");
  const gateway = read("api/store/[resource].js");

  assert.match(vercel, /"source":\s*"\/api\/ai-video-remake"[\s\S]*?"destination":\s*"\/api\/store\/ai-video-remake"/);
  assert.match(gateway, /require\("\.\.\/\.\.\/services\/ai-video-remake"\)/);
  assert.match(gateway, /resource === "ai-video-remake"[\s\S]*?aiVideoRemake\(req, res\)/);
});
