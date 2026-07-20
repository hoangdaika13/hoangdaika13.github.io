const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "creative-preproduction.js"), "utf8");
const css = fs.readFileSync(path.join(root, "creative-preproduction.css"), "utf8");
const preproduction = require(path.join(root, "creative-preproduction.js"));

test("Pre-production exposes the requested standalone API and versioned storage contract", () => {
  assert.equal(preproduction.VERSION, 1);
  assert.equal(preproduction.FORMAT, "hh-creative-preproduction");
  assert.equal(preproduction.STORAGE_KEY, "hh.creative-preproduction.v1");
  assert.deepEqual(preproduction.VIEWS, ["brief", "moodboard", "storyboard", "world-bible"]);
  assert.equal(typeof preproduction.mount, "function");
  assert.equal(typeof preproduction.unmount, "function");
  assert.equal(typeof preproduction.generateBrief, "function");
  assert.match(source, /globalScope\.HHCreativePreproduction = api/);
});

test("Brief generator is deterministic, useful and derived from normalized inputs", () => {
  const input = {
    product: "Khóa học dựng video cho người mới",
    audience: "Sinh viên muốn làm nội dung YouTube",
    goal: "tăng đăng ký học thử",
    platform: "YouTube",
    brandName: "HH Academy",
    brandColors: ["#62d7e7", "invalid"],
    brandFonts: ["Inter", "Inter", "Be Vietnam Pro"]
  };
  const first = preproduction.generateBrief(input);
  const second = preproduction.generateBrief(input);
  assert.deepEqual(first, second);
  assert.match(first.persona, /Sinh viên muốn làm nội dung YouTube/);
  assert.match(first.message, /HH Academy/);
  assert.match(first.message, /Khóa học dựng video/);
  assert.equal(first.contentPlan.length, 7);
  assert.match(first.format, /Video/);
  assert.deepEqual(first.brandColors, ["#62D7E7"]);
  assert.deepEqual(first.brandFonts, ["Inter", "Be Vietnam Pro"]);
});

test("Brief normalization bounds untrusted values and strips control characters", () => {
  const normalized = preproduction.normalizeBrief({
    product: `\u0001${"x".repeat(400)}`,
    platform: "Website",
    brandValues: Array.from({ length: 50 }, (_, index) => `value-${index}`),
    contentPlan: Array.from({ length: 30 }, (_, index) => `step-${index}`)
  });
  assert.equal(normalized.product.length, 240);
  assert.doesNotMatch(normalized.product, /\u0001/);
  assert.equal(normalized.brandValues.length, 12);
  assert.equal(normalized.contentPlan.length, 14);
  assert.equal(preproduction.escapeHtml('<img onerror="x">'), "&lt;img onerror=&quot;x&quot;&gt;");
});

test("Moodboard stores local file metadata only and never persists object URLs", () => {
  const item = preproduction.normalizeMoodItem({
    id: "local-photo",
    type: "image",
    title: "Ảnh tham chiếu",
    content: "blob:https://example.test/private",
    file: {
      name: "reference.png",
      type: "image/png",
      size: 2048,
      lastModified: 123,
      path: "C:/private/reference.png",
      objectUrl: "blob:https://example.test/private"
    }
  }, 0);
  assert.deepEqual(item.file, { name: "reference.png", type: "image/png", size: 2048, lastModified: 123 });
  assert.equal(Object.hasOwn(item.file, "path"), false);
  assert.equal(Object.hasOwn(item.file, "objectUrl"), false);
  assert.equal(JSON.stringify(item.file).includes("blob:"), false);
  assert.equal(item.content, "");
});

test("Moodboard normalization repairs groups and ordering helpers are immutable", () => {
  const board = preproduction.normalizeMoodboard({
    groups: [{ id: "ideas", name: "Ý tưởng", color: "#f05caf" }],
    items: [
      { id: "one", type: "note", title: "Một", groupId: "missing" },
      { id: "two", type: "color", title: "Hai", content: "#112233", groupId: "ideas" },
      { id: "three", type: "font", title: "Ba", groupId: "ideas" }
    ]
  });
  assert.equal(board.groups[0].id, "inbox");
  assert.equal(board.items[0].groupId, "inbox");
  const reordered = preproduction.reorderById(board.items, "three", "one", "before");
  assert.deepEqual(reordered.map((item) => item.id), ["three", "one", "two"]);
  assert.deepEqual(board.items.map((item) => item.id), ["one", "two", "three"]);
  const moved = preproduction.moveByDelta(board.items, "one", 99);
  assert.deepEqual(moved.map((item) => item.id), ["two", "three", "one"]);
});

test("Storyboard calculates timeline frames and preserves deterministic drag ordering", () => {
  const story = preproduction.normalizeStoryboard({
    title: "Launch",
    aspectRatio: "9:16",
    frameRate: 30,
    scenes: [
      { id: "hook", title: "Hook", duration: 2.5, camera: "Push in" },
      { id: "proof", title: "Bằng chứng", duration: 4 },
      { id: "cta", title: "CTA", duration: 1.5 }
    ]
  });
  assert.equal(preproduction.totalDuration(story), 8);
  assert.deepEqual(preproduction.buildAnimaticFrames(story).map(({ id, start, end }) => ({ id, start, end })), [
    { id: "hook", start: 0, end: 2.5 },
    { id: "proof", start: 2.5, end: 6.5 },
    { id: "cta", start: 6.5, end: 8 }
  ]);
  const ordered = preproduction.reorderById(story.scenes, "cta", "hook", "before");
  assert.deepEqual(ordered.map((scene) => scene.id), ["cta", "hook", "proof"]);
});

test("Storyboard normalization clamps duration, fps, scene count and invalid aspect ratios", () => {
  const story = preproduction.normalizeStoryboard({
    frameRate: 999,
    aspectRatio: "21:9",
    scenes: Array.from({ length: 150 }, (_, index) => ({ id: `s-${index}`, duration: index === 0 ? -10 : 9999 }))
  });
  assert.equal(story.frameRate, 60);
  assert.equal(story.aspectRatio, "16:9");
  assert.equal(story.scenes.length, preproduction.LIMITS.scenes);
  assert.equal(story.scenes[0].duration, 0.5);
  assert.equal(story.scenes[1].duration, 600);
});

test("World Bible consistency audit finds duplicates, missing identity data and dangling relations", () => {
  const bible = preproduction.normalizeWorldBible({ entries: [
    { id: "hero-a", type: "character", name: "Linh", summary: "Phi công", palette: ["#112233"], voice: "nhẹ", relations: ["Trạm Sao"] },
    { id: "hero-b", type: "character", name: "Linh", summary: "Bản khác", palette: [] },
    { id: "station", type: "location", name: "Trạm Mặt Trăng", summary: "", palette: [] }
  ] });
  const audit = preproduction.auditConsistency(bible);
  assert.equal(audit.passed, false);
  assert.ok(audit.score < 100);
  assert.ok(audit.issues.some((issue) => /bị trùng/.test(issue.message)));
  assert.ok(audit.issues.some((issue) => /Trạm Sao/.test(issue.message)));
  assert.ok(audit.issues.some((issue) => /chưa có bảng màu/.test(issue.message)));
});

test("World Bible search supports Vietnamese text, type filters and multiple terms", () => {
  const bible = { entries: [
    { id: "hero", type: "character", name: "Linh", summary: "Phi công dũng cảm", traits: ["bình tĩnh"], palette: ["#123456"] },
    { id: "base", type: "location", name: "Trạm Sao", summary: "Căn cứ ngoài không gian", palette: ["#654321"] }
  ] };
  assert.deepEqual(preproduction.searchBible(bible, "phi công", "character").map((item) => item.id), ["hero"]);
  assert.deepEqual(preproduction.searchBible(bible, "trạm ngoài", "all").map((item) => item.id), ["base"]);
  assert.equal(preproduction.searchBible(bible, "phi", "location").length, 0);
});

test("Project normalization and store extraction keep all four pre-production domains", () => {
  const project = preproduction.normalizeProject({
    id: "Campaign 2026",
    name: "Chiến dịch mùa hè",
    brief: { product: "Sản phẩm A" },
    moodboard: { items: [{ id: "n1", type: "note", content: "Mood" }] },
    storyboard: { scenes: [{ id: "s1", title: "Mở đầu", duration: 3 }] },
    worldBible: { entries: [{ id: "c1", type: "character", name: "An" }] }
  });
  assert.equal(project.id, "campaign-2026");
  assert.equal(project.brief.product, "Sản phẩm A");
  assert.equal(project.moodboard.items.length, 1);
  assert.equal(project.storyboard.scenes.length, 1);
  assert.equal(project.worldBible.entries.length, 1);
  assert.equal(preproduction.projectFromStoreState({ currentProject: project }).id, "campaign-2026");
  assert.equal(preproduction.projectFromStoreState({ activeProjectId: project.id, projects: [project] }).id, "campaign-2026");
});

test("Local fallback and external Creative OS store adapter perform real persistence", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
  const localAdapter = preproduction.createStoreAdapter(null, storage);
  const localProject = preproduction.createDefaultProject();
  localProject.name = "Saved locally";
  const localResult = localAdapter.updateProject(localProject);
  assert.equal(localResult.ok, true);
  assert.deepEqual([...values.keys()], [preproduction.STORAGE_KEY]);
  assert.equal(localAdapter.getProject().name, "Saved locally");

  let externalProject = preproduction.createDefaultProject();
  let subscribed = false;
  const externalStore = {
    getState: () => ({ currentProject: externalProject }),
    updateProject(next) { externalProject = next; },
    subscribe(listener) { subscribed = typeof listener === "function"; return () => { subscribed = false; }; }
  };
  const externalAdapter = preproduction.createStoreAdapter(externalStore, storage);
  const next = { ...externalProject, name: "Shared project" };
  assert.equal(externalAdapter.updateProject(next).external, true);
  assert.equal(externalAdapter.getProject().name, "Shared project");
  const unsubscribe = externalAdapter.subscribe(() => {});
  assert.equal(subscribed, true);
  unsubscribe();
  assert.equal(subscribed, false);
});

test("UI contract includes real controls, callbacks, object URL cleanup and accessible behavior", () => {
  for (const token of [
    "data-hhcp-brief-form", "data-hhcp-board", "data-hhcp-files", "draggable=\"true\"",
    "data-hhcp-group-form", "data-hhcp-vote", "data-hhcp-comment", "data-hhcp-comment-dialog", "data-hhcp-scene-field",
    "data-hhcp-animatic", "getContext(\"2d\")", "data-hhcp-bible-form", "data-hhcp-audit",
    "config.onNavigate(destination", "adapter.subscribe", "store.getState", "store.updateProject",
    "URL.createObjectURL", "URL.revokeObjectURL", "ctrlKey", "ArrowUp", "aria-live=\"polite\""
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /onNavigate\("video-editor"|navigate\("video-editor"/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /globalScope\.prompt|window\.prompt/);
  assert.doesNotMatch(source, /api[_-]?key|secret|password\s*[:=]/i);
  assert.equal(preproduction.mount(null), null);
});

test("CSS contract supports studio layouts, 375px screens, focus and reduced motion", () => {
  for (const token of [
    ".hhcp__brief-layout", ".hhcp__mood-layout", ".hhcp__board", ".hhcp__story-layout",
    ".hhcp__bible-layout", "@media (max-width: 560px)", "grid-template-columns: 1fr",
    ":focus-visible", "prefers-reduced-motion: reduce", "overflow-x: auto", "min-width: 0"
  ]) assert.ok(css.includes(token), `missing ${token}`);
  assert.doesNotMatch(css, /font-size:\s*\d+(?:\.\d+)?vw/);
});
