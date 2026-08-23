const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const universe = require(path.join(root, "media-production-universe.js"));
const professional = require(path.join(root, "media-professional-suite.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Production Universe publishes dedicated contracts for five real workspaces", () => {
  assert.deepEqual(universe.WORKSPACE_IDS, ["video-workspace", "document-workspace", "brand-workspace", "asset-workspace", "export-workspace"]);
  for (const id of universe.WORKSPACE_IDS) assert.equal(universe.WORKSPACE_BY_ID[id], true);
  const state = universe.ensureProductionState({}, professional);
  assert.ok(Array.isArray(state.video.timeline));
  assert.ok(Array.isArray(state.documents.jobs));
  assert.ok(state.brand.kits.length > 0);
  assert.ok(Array.isArray(state.assets.collections));
  assert.ok(Array.isArray(state.export.jobs));
});

test("Video timeline export carries stable asset identity, cuts, captions and keyframes", () => {
  const timeline = universe.buildOtioTimeline({
    timeline: [{ id: "clip-1", assetId: "asset-42", name: "Intro", in: 1, out: 4.5, duration: 10, checksum: "abc" }],
    captions: [{ start: 1, end: 2, text: "Xin chào" }],
    keyframes: [{ time: 2, transform: { scale: 110 } }]
  }, "Launch Film");
  assert.equal(timeline.OTIO_SCHEMA, "Timeline.1");
  const clip = timeline.tracks.children[0].children[0];
  assert.equal(clip.media_references.DEFAULT_MEDIA.target_url, "hhasset://asset-42");
  assert.equal(clip.source_range.duration.value, 105);
  assert.match(universe.buildWebVtt(timeline.metadata.captions), /00:00:01\.000 --> 00:00:02\.000/);
});

test("Brand Universe exports interoperable DTCG JSON, CSS and honest lint", () => {
  const kit = { name: "HH", tokens: [
    { id: "a", name: "color.surface.canvas", value: "#071225", type: "color" },
    { id: "b", name: "color.text.primary", value: "#ffffff", type: "color" },
    { id: "c", name: "radius.card", value: "20px", type: "dimension" }
  ] };
  const dtcg = universe.buildDtcgTokens(kit);
  assert.equal(dtcg.color.surface.canvas.$value, "#071225");
  assert.equal(dtcg.radius.card.$type, "dimension");
  assert.match(universe.buildCssTokens(kit), /--color-surface-canvas: #071225/);
  assert.equal(universe.lintBrandKit(kit).status, "pass");
  assert.equal(universe.flattenDtcgTokens(dtcg).length, 3);
});

test("Delivery preflight blocks broken rights and reports real asset verification", () => {
  const state = universe.ensureProductionState({}, professional);
  state.rights.splits = [{ owner: "A", percent: 70 }];
  state.review.comments = [{ status: "open" }];
  const result = universe.preflightDelivery(state, [{ id: "asset", name: "image.png", availability: "ready", checksum: "sha", license: "Owned" }]);
  assert.equal(result.status, "blocked");
  assert.ok(result.blockers >= 1);
  assert.ok(result.warnings >= 1);
});

test("production state bounds hostile persisted data and brand exports cannot inject CSS or prototypes", () => {
  const state = universe.ensureProductionState({
    brand: { activeKitId: "unsafe", activeMode: "Missing", kits: [{ id: "unsafe", name: "Unsafe", modes: ["Default"], tokens: [
      { id: "x", name: "__proto__.polluted", value: "red; } body { display:none", type: "color" },
      { id: "y", name: "color.brand.primary", value: "#55e6ff", type: "color" }
    ] }] },
    export: { selectedProfile: "unknown", jobs: [{ status: "pretend-complete", progress: 999 }] },
    documents: { watermark: "x".repeat(500), watermarkOpacity: 999 }
  }, professional);
  assert.equal(state.documents.watermark.length, 80);
  assert.equal(state.documents.watermarkOpacity, 70);
  assert.equal(state.export.selectedProfile, "youtube");
  assert.equal(state.export.jobs[0].status, "planned");
  const css = universe.buildCssTokens(state.brand.kits[0]);
  assert.doesNotMatch(css, /body\s*\{/i);
  const dtcg = universe.buildDtcgTokens(state.brand.kits[0]);
  assert.equal({}.polluted, undefined);
  assert.equal(dtgcPath(dtgcSafe(dtcg), ["token-__proto__", "polluted", "$value"]), "#000000");
});

function dtgcSafe(value) { return JSON.parse(JSON.stringify(value)); }
function dtgcPath(value, pathParts) { return pathParts.reduce((cursor, key) => cursor?.[key], value); }

test("Delivery Center deduplicates identical jobs and emits a redacted release manifest", () => {
  const asset = { id: "asset-1", name: "source.png", type: "image/png", size: 120, checksum: "sha256", license: "Owned", availability: "ready", blob: Buffer.from("secret"), signedUrl: "https://private.invalid/token" };
  const first = universe.createDeliveryJob(universe.ensureProductionState({}, professional), universe.DELIVERY_PROFILES[0], [asset], () => "stable-key", "2026-08-23T00:00:00.000Z");
  const second = universe.createDeliveryJob(first.state, universe.DELIVERY_PROFILES[0], [asset], () => "stable-key", "2026-08-23T00:00:01.000Z");
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.state.export.jobs.length, 1);
  const manifest = universe.buildReleaseManifest(second.state, [asset], universe.DELIVERY_PROFILES[0]);
  assert.equal(manifest.schema, "hh.release.manifest.v2");
  assert.equal(manifest.assets[0].checksum, "sha256");
  assert.equal("blob" in manifest.assets[0], false);
  assert.equal("signedUrl" in manifest.assets[0], false);
});

test("workspace actions use accessible in-app dialogs and preserve focused scroll surfaces", () => {
  const source = read("media-production-universe.js"), css = read("media-production-universe.css"), page = read("media-design-page.js");
  assert.doesNotMatch(source, /\b(?:prompt|confirm|alert)\s*\(/);
  assert.match(source, /data-mpu-dialog-form/);
  assert.match(source, /VIEW_SCROLL_SELECTORS/);
  assert.match(css, /\.mpu-dialog-backdrop/);
  assert.match(page, /rememberToolScroll/);
  assert.match(page, /restoreToolScroll/);
});

test("Production Universe is loaded before Media page, cached and motion-safe", () => {
  const loader = read("performance-loader.js"), worker = read("sw.js"), page = read("media-design-page.js"), css = read("media-production-universe.css"), source = read("media-production-universe.js");
  for (const asset of ["media-production-universe.css?v=4", "media-production-universe.js?v=3", "vendor/pdf-lib.min.js?v=1.17.1", "vendor/pdf.min.mjs?v=4.10.38", "vendor/pdf.worker.min.mjs?v=4.10.38"]) {
    assert.match(`${loader}\n${worker}`, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(loader, /media-production-universe\.js\?v=3[\s\S]*media-design-page\.js\?v=22/);
  assert.match(page, /HHMediaProductionUniverse\?\.mount/);
  assert.match(source, /canvas\.captureStream/);
  assert.match(source, /PDFDocument\.load/);
  assert.match(source, /MediaCapabilities|mediaCapabilities/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(source, /data-workspace/);
  assert.match(css, /\.mpu-video-layout/);
  assert.match(css, /@media\(max-width:700px\)/);
});
