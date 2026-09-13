const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("signed-out feature universe is derived from the real Platform navigation registry", () => {
  const shell = read("script.js");
  const start = shell.indexOf("const publishFeatureUniverseRegistry");
  const end = shell.indexOf("const mountPlatformHome", start);
  const registry = shell.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(registry, /navigationSections\.map/);
  assert.match(registry, /platformHomeChildren\(group\)/);
  assert.match(registry, /!group\.adminOnly/);
  assert.match(registry, /seenRoutes\.has\(route\)/);
  assert.match(registry, /route === "\/admin" \|\| route\.startsWith\("\/admin\/"\)/);
  assert.match(registry, /Object\.freeze/);
  assert.match(registry, /window\.HHFeatureUniverseRegistry = registry/);
  assert.match(registry, /hh:feature-universe-registry/);
});

test("feature planets remain bounded while search and list expose every registry route", () => {
  const runtime = read("auth-h-galaxy.js");

  assert.match(runtime, /const PAGE_SIZE = 18/);
  assert.match(runtime, /registry\?\.entries|registry\.entries/);
  assert.match(runtime, /renderPlanets/);
  assert.match(runtime, /renderList/);
  assert.match(runtime, /searchInput\.addEventListener\("input"/);
  assert.match(runtime, /if \(query\) \{[\s\S]{0,160}?activeSectionId = "";[\s\S]{0,160}?recentOnly = false;/);
  assert.match(runtime, /sectionNav\.addEventListener\("click"/);
  assert.match(runtime, /nextButton\.addEventListener\("click"/);
  assert.match(runtime, /previousButton\.addEventListener\("click"/);
  assert.match(runtime, /hh:auth-destination/);
  assert.match(runtime, /ArrowLeft/);
  assert.match(runtime, /ArrowRight/);
  assert.match(runtime, /Home/);
  assert.match(runtime, /End/);
  assert.match(runtime, /localStorage\.getItem\(RECENT_KEY\)/);
  assert.match(runtime, /sessionStorage\.getItem\("hh\.auth\.pending-route"\)/);
  assert.doesNotMatch(runtime, /localStorage\.(?:setItem|removeItem)/);
  assert.doesNotMatch(runtime, /password|accessToken|apiKey/i);
});

test("chosen routes are validated and resumed through login or guest access", () => {
  const auth = read("auth-platform.js");
  const completeAuth = auth.slice(auth.indexOf("const completeAuth"), auth.indexOf("const loadMe"));

  assert.match(auth, /const safePendingRoute =/);
  assert.match(auth, /window\.HHFeatureUniverseRegistry\?\.entries/);
  assert.match(auth, /gate\.addEventListener\("hh:auth-destination"/);
  assert.match(auth, /sessionStorage\.setItem\("hh\.auth\.pending-route", route\)/);
  assert.match(completeAuth, /consumePendingRoute\(\)/);
  assert.match(auth, /const pendingRoute = consumePendingRoute\(\)/);
});

test("living galaxy rebuilds one renderer when the dynamic planet page changes", () => {
  const runtime = read("auth-living-galaxy-3d.js");
  const css = read("auth-living-galaxy-3d.css");

  assert.equal((runtime.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.match(runtime, /let planetButtons/);
  assert.match(runtime, /sceneRevision/);
  assert.match(runtime, /clearScene/);
  assert.match(runtime, /const rebuild = \(\) =>/);
  assert.match(runtime, /hh:feature-universe-render/);
  assert.match(runtime, /cancelAnimationFrame/);
  assert.match(runtime, /disposeScene\(sceneState\)/);
  assert.match(runtime, /restoreInteractivePlanets/);
  assert.match(runtime, /orbitField\.querySelector\("\[data-hh-galaxy-key\]"\)/);
  assert.match(runtime, /gate\.hidden/);
  assert.match(runtime, /galaxy\.dataset\.livingGalaxy = "suspended"/);
  assert.match(runtime, /removeEventListener\("hh:auth-change", onAuthChange\)/);
  assert.match(runtime, /attributeFilter:\s*\["data-auth-gateway-state", "hidden"\]/);
  assert.match(css, /\.hh-living-cosmic-optics/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(min-width:\s*761px\) and \(max-width:\s*1100px\)/);
  assert.match(css, /\.hh-h-galaxy\.is-feature-list-open\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*visible;/s);
  assert.match(css, /padding:\s*302px 16px 20px !important/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
});

test("cinematic command controls use real preferences, routes and recent data", () => {
  const runtime = read("auth-h-galaxy.js");
  const gateway = read("auth-neon-gateway.js");
  const auth = read("auth-platform.js");
  const css = read("auth-h-galaxy.css");

  assert.match(runtime, /const RECENT_KEY = "hh\.app-shell\.recent"/);
  assert.match(runtime, /data-hh-universe-quality="high"/);
  assert.match(runtime, /data-hh-universe-quality="soft"/);
  assert.match(runtime, /data-hh-universe-quality="off"/);
  assert.match(runtime, /data-hh-universe-parallax/);
  assert.match(runtime, /data-hh-universe-camera-reset/);
  assert.match(runtime, /data-hh-universe-recent/);
  assert.match(runtime, /dataset\.hhAuthDestination/);
  assert.match(runtime, /hh:auth-destination-clear/);
  assert.match(runtime, /hh:galaxy-camera-reset/);
  assert.match(gateway, /const PARALLAX_KEY = "hh\.auth\.parallax\.v1"/);
  assert.match(gateway, /const setParallax =/);
  assert.match(gateway, /hh:auth-parallax-change/);
  assert.match(gateway, /removeEventListener\("hh:auth-parallax-request"/);
  assert.match(auth, /hh:auth-destination-clear/);
  assert.match(auth, /sessionStorage\.removeItem\("hh\.auth\.pending-route"\)/);
  assert.match(css, /\.hh-feature-universe-viewbar/);
  assert.match(css, /\.hh-auth-destination/);
});

test("cinematic camera is bounded, disposable and keeps one renderer", () => {
  const runtime = read("auth-living-galaxy-3d.js");
  const css = read("auth-living-galaxy-3d.css");

  assert.equal((runtime.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.match(runtime, /className = "hh-living-camera-surface"/);
  assert.match(runtime, /const onCameraPointerDown =/);
  assert.match(runtime, /const onCameraWheel =/);
  assert.match(runtime, /const syncCameraTelemetry =/);
  assert.match(runtime, /galaxy\.dataset\.cameraYaw/);
  assert.match(runtime, /galaxy\.dataset\.cameraZoom/);
  assert.match(runtime, /targetYaw[^;]*,\s*-\.42,\s*\.42/);
  assert.match(runtime, /targetZoom[^;]*,\s*\.78,\s*1\.22/);
  assert.match(runtime, /const resetCameraView =/);
  assert.match(runtime, /unbindCameraSurface\(sceneState\?\.cameraSurface\)/);
  assert.match(runtime, /createDistantBlackHole/);
  assert.match(runtime, /moonCount/);
  assert.match(runtime, /targetOrbitRate = selected \? \.28 : 1/);
  assert.match(runtime, /renderMode: mode\(\)/);
  assert.match(runtime, /statusLabel = mode\(\) === "cinematic" \? "3D CINEMATIC" : mode\(\) === "balanced" \? "3D BALANCED" : "3D STATIC"/);
  assert.match(runtime, /const cameraSnapshot = \(\) =>/);
  assert.match(runtime, /camera: cameraSnapshot/);
  assert.match(css, /\.hh-living-camera-surface/);
  assert.match(css, /pointer-events:\s*auto/);
  assert.match(css, /touch-action:\s*none/);
});
