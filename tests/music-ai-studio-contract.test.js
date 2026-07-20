const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Music AI is a standalone top-level route with seven production stages", () => {
  const shell = read("script.js");
  assert.match(shell, /id: "music-ai"/);
  assert.match(shell, /label: "Làm nhạc AI"/);
  for (const route of ["project", "prompt-studio", "loop-builder", "audio-qa", "chapters", "youtube-pack", "publish-checklist"]) {
    assert.match(shell, new RegExp(`/music-ai/${route}`));
  }
  assert.match(shell, /HHMusicAIStudio\.mount/);
  assert.match(shell, /app-music-ai-route/);
  assert.match(shell, /landingRoute: "\/music-ai\/project"/);
  assert.match(shell, /const musicAIPageItems =/);
});

test("Music AI uses one navigation source and opens tools directly", () => {
  const studio = read("music-ai-studio.js");
  const apps = read("music-ai-apps.js");
  const shell = read("script.js");
  const styles = read("app-shell.css");
  assert.doesNotMatch(studio, /class="mai-tabs"/);
  assert.doesNotMatch(apps, /class="ma-app-dock"/);
  assert.match(shell, /app-sidebar__subitem--music/);
  assert.match(shell, /data-music-section/);
  assert.match(shell, /hh\.music-ai\.sidebar-nav-version/);
  assert.match(shell, /routeButton\.matches\("\.app-sidebar__subitem--music"\)/);
  assert.match(shell, /sidebarGroupState\[targetGroup\.id\] = !musicSidebarToolLink/);
  assert.match(shell, /tabindex=-1/);
  assert.match(styles, /app-sidebar__page-section\.is-open/);
  assert.match(styles, /pointer-events:none/);
  assert.match(shell, /updatePageHeader\(musicPage\.title, musicPage\.description/);
  assert.match(studio, /is-standalone-app/);
});

test("Music AI workflow performs real local production tasks", () => {
  const source = read("music-ai-studio.js");
  assert.match(source, /hh\.music-ai-studio\.v1/);
  assert.match(source, /function promptPack/);
  assert.match(source, /function ffmpegCommand/);
  assert.match(source, /-stream_loop -1/);
  assert.match(source, /decodeAudioData/);
  assert.match(source, /peakDb/);
  assert.match(source, /clippingPercent/);
  assert.match(source, /function chapterOutput/);
  assert.match(source, /function youtubePack/);
  assert.match(source, /data-download-bat/);
  assert.match(source, /data-download-youtube/);
});

test("Smart Loop analyzes clip seams and generates adaptive FFmpeg workflows", () => {
  const source = read("music-ai-studio.js");
  assert.match(source, /function analyzeVideoLoop/);
  assert.match(source, /function frameDifference/);
  assert.match(source, /function resolvedSmartLoopMode/);
  assert.match(source, /seamScore >= 86/);
  assert.match(source, /Smart Crossfade/);
  assert.match(source, /Ping-pong mềm/);
  assert.match(source, /xfade=transition=fade/);
  assert.match(source, /minterpolate=fps=/);
  assert.match(source, /reverse,setpts=PTS-STARTPTS/);
  assert.match(source, /data-smart-loop-field="targetDuration"/);
  assert.match(source, /seamless-loop\.mp4/);
  assert.match(source, /function smartLoopBat/);
  assert.match(source, /if errorlevel 1 goto :error/);
});

test("One-click producer connects real server media jobs without exposing keys", () => {
  const client = read("music-ai-studio.js");
  const server = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /ONE-CLICK AI PRODUCER/);
  assert.match(client, /runAutomaticPipeline/);
  assert.match(client, /indexedDB\.open/);
  assert.match(client, /music-image/);
  assert.match(client, /music-track/);
  assert.match(client, /music-video-start/);
  assert.match(client, /music-video-status/);
  assert.match(client, /stage\?\.status === "running"/);
  assert.match(client, /status: "error"/);
  assert.match(server, /gemini-3\.1-flash-image/);
  assert.match(server, /veo-3\.1-fast-generate-preview/);
  assert.match(server, /https:\/\/api\.elevenlabs\.io\/v1\/music/);
  assert.match(server, /force_instrumental: meta\.instrumental !== false/);
  assert.match(server, /isAdminUser/);
  assert.match(server, /Readable\.fromWeb/);
  assert.doesNotMatch(client, /process\.env|AIza[0-9A-Za-z_-]{24,}/);
});

test("Paid media providers report configuration without returning credentials", () => {
  const server = read("api/modules/[moduleId]/actions.js");
  assert.match(server, /function musicProviderStatus/);
  assert.match(server, /ownerOnly: true/);
  assert.match(server, /canRunMedia: isAdminUser\(user\)/);
  assert.match(server, /configured: Boolean/);
  assert.doesNotMatch(server, /providers:[\s\S]{0,1400}(?:apiKey|secret|token):/i);
});

test("Music AI ships YouTube-safe defaults and no fake LUFS claim", () => {
  const source = read("music-ai-studio.js");
  assert.match(source, /-c:v libx264/);
  assert.match(source, /-c:a aac -b:a 384k -ar 48000/);
  assert.match(source, /-movflags \+faststart/);
  assert.match(source, /16:9/);
  assert.match(source, /không thay thế phép đo loudness LUFS/);
});

test("Music AI assets are loaded by the page and offline worker", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["music-ai-studio.css?v=5", "music-ai-apps.css?v=2", "music-ai-apps.js?v=2", "music-ai-studio.js?v=6", "youtube-publisher.css?v=2", "youtube-publisher.js?v=2", "script.js?v=110", "app-shell.css?v=50"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(worker, pattern);
  }
});

test("Music AI does not consume another Vercel serverless function", () => {
  const apiDir = path.join(root, "api");
  const functions = fs.readdirSync(apiDir).filter((name) => /\.(js|ts)$/.test(name));
  assert.ok(functions.length <= 12, `Expected at most 12 API functions, received ${functions.length}`);
});
