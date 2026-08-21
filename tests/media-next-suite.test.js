const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const suite = require(path.join(root, "media-next-suite.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Media Next exposes six bounded workspaces with versioned local state", () => {
  assert.equal(suite.SCHEMA, "hh.media.next.v1");
  assert.deepEqual(suite.WORKSPACES.map((item) => item.id), [
    "media-cloud", "review-studio", "motion-compositor",
    "universal-canvas", "ai-task-center", "dev-handoff"
  ]);
  const memory = new Map();
  const store = suite.createStateStore({
    getItem: (key) => memory.get(key),
    setItem: (key, value) => memory.set(key, value)
  });
  const state = store.save({ lastWorkspace: "review-studio", cloud: { assets: [{ id: "private", blobUrl: "https://secret.invalid" }] } });
  assert.equal(state.lastWorkspace, "review-studio");
  const persisted = JSON.parse(memory.get(suite.STATE_KEY));
  assert.deepEqual(persisted.cloud.assets, []);
  assert.doesNotMatch(memory.get(suite.STATE_KEY), /secret\.invalid/);
});

test("Universal Canvas, Motion graph, AI drafts and Dev snippets do real deterministic work", () => {
  let state = suite.normalizeState({});
  const initialFrames = state.canvas.frames.length;
  state = suite.createCanvasFrame(state, "vertical");
  assert.equal(state.canvas.frames.length, initialFrames + 1);
  assert.deepEqual([state.canvas.frames.at(-1).width, state.canvas.frames.at(-1).height], [270, 480]);

  const initialNodes = state.motion.nodes.length;
  state = suite.addMotionNode(state, "particle");
  assert.equal(state.motion.nodes.length, initialNodes + 1);
  assert.equal(state.motion.nodes.at(-1).name, "Particle Emitter");

  const task = suite.createAiTaskDraft({ prompt: "<nebula>", variations: 99, locks: ["palette"], licenseAccepted: true });
  assert.equal(task.variations, 6);
  assert.equal(task.status, "draft");
  assert.equal(task.cost, null);

  const snippet = suite.buildDevSnippet({ name: "Hero Card", x: 4, y: 8, width: 320, height: 180, token: "color.brand.primary" }, { name: "Desktop" }, "css");
  assert.match(snippet, /\.HeroCard/);
  assert.match(snippet, /var\(--color-brand-primary\)/);
});

test("large-file checksum implementation is incremental and SHA-256 compatible", () => {
  const hasher = suite.createStreamingSha256();
  hasher.update(new TextEncoder().encode("a"));
  hasher.update(new TextEncoder().encode("bc"));
  assert.equal(hasher.digest(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  const empty = suite.createStreamingSha256();
  assert.equal(empty.digest(), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("Next suite is routed, cached, responsive and keeps real adapters capability-gated", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const page = read("media-design-page.js");
  const shell = read("script.js");
  const css = read("media-next-suite.css");
  const source = read("media-next-suite.js");

  assert.match(loader, /media-professional-suite\.js\?v=3[\s\S]*vercel-blob-client\.min\.js\?v=1[\s\S]*media-next-suite\.js\?v=2[\s\S]*media-design-page\.js\?v=14/);
  for (const asset of ["media-next-suite.css?v=1", "vendor/vercel-blob-client.min.js?v=1", "media-next-suite.js?v=2"]) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const id of suite.WORKSPACES.map((item) => item.id)) {
    assert.match(page, new RegExp(id));
    assert.match(shell, new RegExp(id));
  }
  assert.match(page, /HHMediaNextSuite\?\.mount/);
  assert.match(source, /needs-worker|needs-adapter/);
  assert.match(source, /Private Blob|signed URL|multipart/i);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
