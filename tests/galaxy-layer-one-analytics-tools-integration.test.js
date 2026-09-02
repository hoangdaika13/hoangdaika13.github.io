const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-layer-one.js"), "utf8");
const css = fs.readFileSync(path.join(root, "galaxy-layer-one-worlds.css"), "utf8");
const layerOne = require("../galaxy-layer-one.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function functionSection(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = nextName ? source.indexOf(`function ${nextName}(`, start + 1) : source.indexOf("\n  function ", start + 12);
  assert.notEqual(end, -1, `missing boundary after ${name}`);
  return source.slice(start, end);
}

test("Tools Galaxy exposes every local engine operation with bounded result regions", () => {
  const markup = layerOne.viewMarkup("/galaxy/tools", {});
  for (const action of ["preview-markdown", "csv-to-json", "json-to-csv", "sha256-text", "generate-qr"]) {
    assert.match(markup, new RegExp(`data-hgl1-action=["']${action}["']`), `missing ${action}`);
  }
  for (const result of ["markdown", "csv", "json-csv", "sha", "qr"]) {
    assert.match(markup, new RegExp(`data-hgl1-${result}-output`), `missing ${result} result`);
  }
  assert.match(source, /HHGalaxyLayerOneTools/);
  assert.match(source, /engine\.markdownToSafeHtml\s*\(/);
  assert.match(source, /engine\.csvToObjects\s*\(/);
  assert.match(source, /engine\.objectsToCsv\s*\(/);
  assert.match(source, /engine\.sha256Hex\s*\(/);
  assert.match(source, /engine\.createQrSvg\s*\(/);
  assert.match(css, /\.hh-galaxy-app\s+\.hgl1-tool__output--markdown/);
  assert.match(css, /\.hh-galaxy-app\s+\.hgl1-tool__output--qr\s+svg/);
});

test("Analytics UI renders only measured Web Vitals and honest empty states", () => {
  const state = { settings: { analyticsConsent: true }, items: [], events: [] };
  const empty = layerOne.viewMarkup("/galaxy/analytics", state, { performanceMetrics: null });
  assert.equal((empty.match(/>Chưa đo</g) || []).length, 4);
  assert.doesNotMatch(empty, /data-hgl1-web-vital=["'](?:lcp|fcp|inp|cls)["'][^>]*data-state=["']measured["']/);

  const measured = layerOne.viewMarkup("/galaxy/analytics", state, {
    performanceMetrics: {
      running: true,
      metrics: {
        lcp: { value: 812.4, unit: "ms", entries: [] },
        fcp: { value: 321.2, unit: "ms", entries: [] },
        inp: { value: 48.8, unit: "ms", entries: [] },
        cls: { value: 0.0142, unit: "score", entries: [] }
      }
    }
  });
  for (const metric of ["lcp", "fcp", "inp", "cls"]) {
    assert.match(measured, new RegExp(`data-hgl1-web-vital=["']${metric}["'][^>]*data-state=["']measured["']`));
  }
  assert.match(measured, /812 ms/);
  assert.match(measured, /0,0142/);
  assert.match(measured, /Event delay thô/);
  assert.match(measured, /Layout shift thô/);
  assert.match(measured, /không phải INP chuẩn/);
  assert.match(measured, /không phải CLS chuẩn/);
  assert.doesNotMatch(measured, />INP</);
  assert.doesNotMatch(measured, />CLS</);
});

test("Analytics collector lifecycle follows persisted consent and unmount cleanup", () => {
  const sync = functionSection("syncAnalyticsCollectorConsent", "render");
  assert.match(sync, /consent\s*!==\s*true[\s\S]*releaseAnalyticsCollector/);
  assert.match(sync, /createCollector\s*\(\s*\{\s*consent:\s*true/);
  assert.match(sync, /analyticsCollector\.start\s*\(/);
  assert.match(functionSection("saveSettingsDraft", "clearAnalyticsEvents"), /syncAnalyticsCollectorConsent\s*\(\s*state\.settings\.analyticsConsent/);
  assert.match(functionSection("unmount", "mount"), /releaseAnalyticsCollector\s*\(\s*active\s*,\s*true\s*\)/);
  assert.match(functionSection("clearAnalyticsEvents", "formatBytes"), /confirm\([\s\S]*PerformanceObserver/);
});

test("Analytics export combines local events and measured Web Vitals", () => {
  const section = functionSection("exportAnalytics", "updateContentStorageStatus");
  assert.match(section, /snapshotAnalyticsCollector\s*\(/);
  assert.match(section, /recordType/);
  assert.match(section, /performance-entry/);
  assert.match(section, /raw-performance-observer-approximation/);
  assert.match(section, /webVitals:\s*webVitals/);
  assert.match(section, /events:\s*events/);
});

test("file import commits metadata only after durable content and rolls back orphaned bytes", () => {
  const section = functionSection("importSelectedFile", "importBackupFile");
  assert.doesNotMatch(section, /createLocalItem\s*\(/, "file import must not write metadata before content persistence");
  assert.match(section, /prepareLocalItem\s*\(/);
  assert.match(section, /persistImportedContent\s*\(\s*item\s*,\s*file\s*,\s*active\s*\)/);
  assert.match(section, /if\s*\(\s*!persisted\.stored\s*\)\s*throw/);
  const persistAt = section.indexOf("persistImportedContent(item, file, active)");
  const guardAt = section.indexOf("!persisted.stored");
  const commitAt = section.indexOf("commitPreparedLocalItem(item, active.storage)");
  const countAt = section.indexOf("imported += 1");
  assert.ok(persistAt >= 0 && guardAt > persistAt && commitAt > guardAt && countAt > commitAt, "success counters and metadata must follow persisted content");
  assert.match(section, /if\s*\(\s*!committed\s*\)[\s\S]{0,220}rollbackImportedContent\s*\(\s*active\s*,\s*item\s*\)/);
  assert.match(functionSection("rollbackImportedContent", "validateImportFile"), /engine\.delete\s*\(\s*item\.route\s*,\s*item\.id\s*\)/);
});

test("Dev preview, Games and playlist capabilities are backed by stable real runtimes", () => {
  const renderSection = functionSection("render", "showToast");
  assert.match(renderSection, /runtime\.devPreviewFrame[\s\S]{0,140}\[data-hgl1-dev-preview-host\]/);
  assert.match(renderSection, /renderPreservingIsland\s*\(markup,\s*islandSelector\)/);

  const games = layerOne.viewMarkup("/galaxy/games", {});
  const dev = layerOne.viewMarkup("/galaxy/dev", {});
  assert.match(games, /Game Canvas/);
  assert.match(games, /data-capability=["']available["']/);
  assert.match(dev, /Preview sandbox/);
  assert.match(dev, /iframe sandbox không script và không mạng/);
  const capability = functionSection("openCapability", "updateCommunityPublishControl");
  assert.match(capability, /route\s*===\s*["']\/galaxy\/games["']\s*&&\s*index\s*===\s*1[\s\S]{0,260}toggleGame\s*\(/);
  assert.match(capability, /route\s*===\s*["']\/galaxy\/dev["']\s*&&\s*index\s*===\s*2[\s\S]{0,260}previewDevCode\s*\(/);

  const playlist = functionSection("updateMediaPlaylist", "openLocalMedia");
  assert.match(playlist, /data-hgl1-action=\\["']play-media-playlist/);
  assert.match(playlist, /runtime\.mediaSession\.playlistItemId\s*===\s*item\.id/);
  const playback = functionSection("playMediaPlaylist", "openYouTubeVideo");
  assert.match(playback, /item\.file/);
  assert.match(playback, /openLocalMedia\s*\(\s*item\.file/);
  assert.match(playback, /element\.play\s*\(/);
  assert.match(functionSection("cleanupMediaSession", "installMediaElement"), /revokeObjectURL|lease\.release/);
  assert.match(css, /hgl1-media-console ol li button/);
});

test("visibility pauses and resumes the same game session without media remount or autoplay", () => {
  const visibility = functionSection("handleVisibilityChange", "aiStatus");
  assert.match(visibility, /pauseGameSession\(["']visibility["']\)/);
  assert.match(visibility, /resumeGameSession\(["']visibility["']\)/);
  assert.doesNotMatch(visibility, /stopGame\s*\(/);
  assert.doesNotMatch(visibility, /\.play\s*\(/);

  const pause = functionSection("pauseGameSession", "resumeGameSession");
  const resume = functionSection("resumeGameSession", "stopGame");
  assert.match(pause, /session\.paused\s*=\s*true/);
  assert.match(pause, /cancelAnimationFrame/);
  assert.doesNotMatch(pause, /gameSession\s*=\s*null/);
  assert.match(resume, /session\.last\s*=\s*0/);
  assert.match(resume, /requestAnimationFrame\(session\.frame\)/);
  assert.match(functionSection("render", "showToast"), /renderPreservingIsland\s*\(markup,\s*islandSelector\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.hgl1-page-head\.hgl1-world-hero::before[\s\S]*?display:\s*none/);
});

test("functional metadata survives the strict local-state sanitizer with schema bounds", () => {
  const storage = memoryStorage();
  const game = layerOne.createLocalItem("/galaxy/games", "Game save", storage, {
    kind: "game-save",
    meta: {
      gameState: { score: 17, x: 321, y: 222, target: { x: 456, y: 333 }, executable: "drop" },
      controls: { up: "i", down: "k", left: "j", right: "l", deadZone: 0.2 },
      unknown: { shouldNotPersist: true }
    }
  });
  const timestamp = layerOne.createLocalItem("/galaxy/video", "Timestamp", storage, {
    kind: "video-timestamp-note",
    meta: { atMs: 12345, mediaName: "wildlife.mp4" }
  });
  const trim = layerOne.createLocalItem("/galaxy/music", "Trim", storage, {
    kind: "audio-trim-range",
    meta: { startMs: 1000, endMs: 3000, durationMs: 9000, sourceName: "chant.wav" }
  });
  const media = layerOne.createLocalItem("/galaxy/video", "Local source", storage, {
    kind: "video-source",
    meta: { fileName: "wildlife.mp4", fileType: "video/mp4", fileSize: 2048, mediaKind: "video" }
  });
  const community = layerOne.createLocalItem("/galaxy/community", "Published", storage, {
    kind: "community-published",
    meta: { privacy: "group", remoteAck: true, remoteMessageId: "server-message-42" }
  });

  assert.deepEqual(game.meta.gameState, { score: 17, x: 321, y: 222, target: { x: 456, y: 333 } });
  assert.deepEqual(game.meta.controls, { up: "i", down: "k", left: "j", right: "l", deadZone: 0.2 });
  assert.equal(Object.hasOwn(game.meta, "unknown"), false);
  assert.equal(timestamp.meta.atMs, 12345);
  assert.equal(timestamp.meta.mediaName, "wildlife.mp4");
  assert.deepEqual(
    { startMs: trim.meta.startMs, endMs: trim.meta.endMs, durationMs: trim.meta.durationMs, sourceName: trim.meta.sourceName },
    { startMs: 1000, endMs: 3000, durationMs: 9000, sourceName: "chant.wav" }
  );
  assert.equal(media.meta.mediaKind, "video");
  assert.equal(community.meta.remoteAck, true);
  assert.equal(community.meta.remoteMessageId, "server-message-42");

  const restored = layerOne.collectLocalState(storage).items;
  for (const original of [game, timestamp, trim, media, community]) {
    const copy = restored.find((item) => item.id === original.id);
    assert.ok(copy, `${original.kind} was dropped during roundtrip`);
    assert.deepEqual(copy.meta, original.meta, `${original.kind} metadata changed during roundtrip`);
  }
});

test("malformed metadata is clamped and cannot smuggle generic nested data", () => {
  const storage = memoryStorage();
  const game = layerOne.createLocalItem("/galaxy/games", "Clamped save", storage, {
    kind: "game-save",
    meta: {
      gameState: { score: Number.MAX_VALUE, x: -100, y: Infinity, target: { x: -1, y: Number.MAX_VALUE } },
      controls: { up: "not-a-key", down: "s", left: "a", right: "d", deadZone: 99 },
      payload: { script: "alert(1)" }
    }
  });
  assert.equal(game.meta.gameState.score, 1000000000);
  assert.equal(game.meta.gameState.x, 18);
  assert.equal(game.meta.gameState.y, 270);
  assert.equal(game.meta.gameState.target.x, 50);
  assert.equal(game.meta.gameState.target.y, 490);
  assert.equal(game.meta.controls.up, "not-a-key");
  assert.equal(game.meta.controls.deadZone, 0.5);
  assert.equal(Object.hasOwn(game.meta, "payload"), false);

  const trim = layerOne.createLocalItem("/galaxy/music", "Clamped trim", storage, {
    kind: "audio-trim-range",
    meta: { startMs: 8000, endMs: -20, durationMs: 4000, sourceName: "a".repeat(300) }
  });
  assert.equal(trim.meta.startMs, 4000);
  assert.equal(trim.meta.endMs, 4000);
  assert.equal(trim.meta.sourceName.length, 180);
});
