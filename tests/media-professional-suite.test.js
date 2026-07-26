const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const suite = require(path.join(root, "media-professional-suite.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("professional suite exposes seven real workspaces with versioned local state", () => {
  assert.equal(suite.SCHEMA, "hh.media.professional.v1");
  assert.equal(suite.WORKSPACES.length, 7);
  assert.deepEqual(suite.WORKSPACES.map((item) => item.planet), ["universal", "photo", "video", "documents", "brand", "assets", "export"]);
  const data = new Map();
  const store = suite.createStateStore({ getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) });
  const state = store.save({ project: { name: "<Launch>" }, lastWorkspace: "video-workspace" });
  assert.equal(state.project.name, "<Launch>");
  assert.equal(store.load().lastWorkspace, "video-workspace");
  assert.equal(suite.escapeHtml(state.project.name), "&lt;Launch&gt;");
});

test("branch, checkpoint, review and immutable audit operations preserve project history", () => {
  let state = suite.normalizeState({});
  state = suite.createBranch(state, "alternate-cut");
  assert.equal(state.project.branches.at(-1).name, "alternate-cut");
  assert.equal(state.project.activeBranchId, state.project.branches.at(-1).id);
  state = suite.createCheckpoint(state, "Client review");
  assert.equal(state.project.checkpoints.length, 1);
  assert.equal(state.project.recoveries.length, 1);
  assert.equal(state.project.branches.at(-1).head, state.project.checkpoints[0].id);
  state = suite.addReviewComment(state, "<Fix frame>", { timecode: "00:01:12" });
  assert.equal(state.review.comments[0].anchor.timecode, "00:01:12");
  state = suite.resolveReviewComment(state, state.review.comments[0].id);
  assert.equal(state.review.comments[0].status, "resolved");
  assert.ok(state.review.audit.length >= 5);
});

test("verified ingest builds provenance and detects checksum duplicates", () => {
  let state = suite.normalizeState({});
  let result = suite.addAssetRecord(state, { name: "source.png", type: "image/png", size: 120, checksum: "abc", license: "owned" });
  state = result.state;
  assert.equal(result.record.status, "ready");
  result = suite.addAssetRecord(state, { name: "copy.png", type: "image/png", size: 120, checksum: "abc", license: "owned" });
  assert.equal(result.record.status, "duplicate");
  assert.equal(result.state.project.graph.nodes.length, 3);
  assert.equal(result.state.project.graph.edges.length, 2);
});

test("rights gate and preflight use real state and never claim a render happened", () => {
  let state = suite.normalizeState({});
  state.rights.splits[0].percent = 90;
  let health = suite.calculateHealth(state);
  assert.equal(health.status, "blocked");
  assert.ok(health.blockers.some((item) => item.code === "rights-split"));
  assert.equal(suite.runPreflight(state).status, "blocked");
  state.rights.splits[0].percent = 100;
  const preflight = suite.runPreflight(state);
  assert.equal(preflight.status, "ready-needs-adapter");
  state = suite.createAdaptiveJobs(state);
  assert.equal(state.export.jobs.length, 5);
  assert.ok(state.export.jobs.every((job) => job.status === "planned" && job.cost === 0));
  assert.equal(new Set(state.export.jobs.map((job) => job.idempotencyKey)).size, 5);
});

test("suite is loaded before the page, cached offline and responsive", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const page = read("media-design-page.js");
  const css = read("media-professional-suite.css");
  assert.match(loader, /media-professional-suite\.css\?v=1/);
  assert.match(loader, /media-professional-suite\.js\?v=1[\s\S]*media-design-page\.js\?v=11/);
  assert.match(worker, /media-professional-suite\.css\?v=1/);
  assert.match(worker, /media-professional-suite\.js\?v=1/);
  assert.match(page, /HHMediaProfessionalSuite\?\.mount/);
  assert.match(page, /media-core/);
  assert.match(page, /export-workspace/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
