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

test("Production Universe is loaded before Media page, cached and motion-safe", () => {
  const loader = read("performance-loader.js"), worker = read("sw.js"), page = read("media-design-page.js"), css = read("media-production-universe.css"), source = read("media-production-universe.js");
  for (const asset of ["media-production-universe.css?v=3", "media-production-universe.js?v=2", "vendor/pdf-lib.min.js?v=1.17.1", "vendor/pdf.min.mjs?v=4.10.38", "vendor/pdf.worker.min.mjs?v=4.10.38"]) {
    assert.match(`${loader}\n${worker}`, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(loader, /media-production-universe\.js\?v=2[\s\S]*media-design-page\.js\?v=21/);
  assert.match(page, /HHMediaProductionUniverse\?\.mount/);
  assert.match(source, /canvas\.captureStream/);
  assert.match(source, /PDFDocument\.load/);
  assert.match(source, /MediaCapabilities|mediaCapabilities/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(source, /data-workspace/);
  assert.match(css, /\.mpu-video-layout/);
  assert.match(css, /@media\(max-width:700px\)/);
});
