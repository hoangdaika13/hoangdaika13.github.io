const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const client = read("cosmic-observatory.js");
const styles = read("cosmic-observatory.css");
const router = read("script.js");
const loader = read("performance-loader.js");
const shell = read("index.html");
const worker = read("sw.js");
const api = read(path.join("utils", "cosmic-data-gateway.js"));
const platformApi = read(path.join("api", "platform", "summary.js"));
const vercel = read("vercel.json");

test("HH Universe is a lazy first-class route with cleanup and legacy redirects", () => {
  assert.match(router, /id:\s*"cosmic-observatory"[\s\S]*?label:\s*"Vũ trụ"[\s\S]*?route:\s*"\/universe"/);
  assert.match(router, /route === "\/cosmic-observatory"[\s\S]*?route = `\/universe/);
  assert.match(router, /window\.HHUniverse\?\.mount/);
  assert.match(router, /window\.HHUniverse\?\.unmount/);
  assert.match(router, /route === "\/universe\/timeline"[\s\S]*?crumbLabels\.timeline = "Dòng thời gian Vũ trụ"/);
  assert.match(router, /app-cosmic-observatory-route/);
  assert.match(loader, /cosmic:\s*\{[\s\S]*?cosmic-observatory\.css\?v=2[\s\S]*?astronomy-engine-2\.1\.19\.min\.js\?v=1[\s\S]*?cosmic-observatory\.js\?v=2/);
  assert.match(loader, /value === "\/universe" \|\| value\.startsWith\("\/universe\/"\)[\s\S]*?value === "\/cosmic-observatory"/);
  assert.match(client, /canonicalRoute:\s*"\/universe"/);
  assert.match(client, /global\.HHUniverse = universeApi/);
  assert.match(client, /global\.HHCosmicObservatory = universeApi/);
  assert.doesNotMatch(shell, /<script[^>]+cosmic-observatory\.js/i, "Cosmic Observatory must not load on every route");
});

test("the Universe command center, 15 core spaces and source trust center are present", () => {
  for (const view of ["overview", "solar-system", "live-sky", "observatory", "missions", "dsn", "asteroids", "surfaces", "exoplanets", "earth", "space-weather", "timeline", "learning", "media", "universe-map", "data-center"]) {
    assert.match(client, new RegExp(`"${view}"`));
  }
  assert.match(client, /Tiếp tục khám phá/);
  assert.match(client, /data-universe-search/);
  assert.match(client, /type:\s*"observation"/);
  assert.match(client, /NASA Solar System Treks|trek\.nasa\.gov/);
  assert.match(client, /Deep Space Network|DSN Now/);
  assert.match(client, /learningBest/);
  for (const source of ["JPL Horizons", "JPL CNEOS Close-Approach Data", "NASA Image and Video Library", "NASA Exoplanet Archive", "NASA EONET v3", "NASA DONKI", "Astronomy Engine", "WorldWide Telescope"]) {
    assert.match(client, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const dataType of ["observed", "computed", "predicted", "interpolated", "illustrative"]) assert.match(client, new RegExp(`"${dataType}"`));
  assert.match(client, /IndexedDB|indexedDB/);
  assert.match(client, /schema:\s*"hh\.cosmic-observatory"/);
  assert.match(client, /MAX_IMPORT_BYTES/);
});

test("solar and sky views use scientific calculation APIs and deterministic fallbacks", () => {
  assert.match(client, /Astronomy\.HelioVector/);
  assert.match(client, /Astronomy\.Equator/);
  assert.match(client, /Astronomy\.Horizon/);
  assert.match(client, /getContext\("webgl2"/);
  assert.match(client, /Canvas Lite/);
  assert.match(client, /data-kind="illustrative"/);
  assert.match(client, /Không dùng quỹ đạo giả|không dựng bản đồ bầu trời bằng dữ liệu giả/i);
});

test("the client never contains a NASA API key or arbitrary upstream proxy", () => {
  assert.doesNotMatch(client, /NASA_API_KEY|api_key\s*[:=]/i);
  assert.doesNotMatch(client, /https:\/\/api\.nasa\.gov\/DONKI/i);
  assert.match(api, /ALLOWED_SOURCES/);
  assert.match(api, /HORIZONS_TARGETS/);
  assert.match(api, /process\.env\.NASA_API_KEY/);
  assert.doesNotMatch(api, /req\.query\.(?:url|endpoint)|query\.(?:url|endpoint)/i);
  assert.match(api, /MAX_RESPONSE_BYTES/);
  assert.match(api, /enforceRateLimit/);
  assert.match(platformApi, /cosmicDataGateway/);
  assert.match(vercel, /\/api\/cosmic\/:cosmicSource/);
  assert.match(vercel, /cosmicSource=:cosmicSource/);
});

test("responsive and accessibility contracts cover mobile, focus and motion", () => {
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /role="img"/);
  assert.match(client, /requestFullscreen/);
});

test("release shell and service worker ship the same HH Universe versions", () => {
  assert.match(shell, /Release v931 HH Universe/);
  assert.match(shell, /performance-loader\.js\?v=573/);
  assert.match(shell, /script\.js\?v=254/);
  assert.match(worker, /hh-identity-portal-v931/);
  assert.match(worker, /cosmic-observatory\.css\?v=2/);
  assert.match(worker, /cosmic-observatory\.js\?v=2/);
});
