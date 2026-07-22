const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "home-command-search.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "home-command-search.css"), "utf8");
const search = require(path.join(root, "home-command-search.js"));

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

test("standalone enhancement preserves the existing palette and shell routing contracts", () => {
  assert.match(source, /getElementById\("commandPalette"\)/);
  assert.match(source, /#commandPaletteInput/);
  assert.match(source, /#commandPaletteResults/);
  assert.match(source, /dataset\.commandSearchVersion\s*=\s*String\(VERSION\)/);
  assert.match(source, /scope\.location\.hash\s*=\s*next/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*[^;]*id=["']commandPalette/);
  assert.doesNotMatch(source, /\b(?:prompt|alert|confirm)\s*\(/);
});

test("index covers routes and truthful local sources without sensitive storage discovery", () => {
  const storage = memoryStorage({
    "hh-project-center": JSON.stringify({ projects: [{ id: "p1", name: "Ra mắt HH", description: "Release dashboard", updatedAt: "2026-07-21T10:00:00Z" }], tasks: [{ id: "t1", title: "Kiểm tra mobile", priority: "Cao" }] }),
    "hh.dashboard.sticky-notes.v1": JSON.stringify([{ id: "n1", text: "Ý tưởng video mùa hè" }]),
    "hh.communication.command.v1": JSON.stringify({ conversations: [{ id: "c1", name: "HH Creative", preview: "Duyệt thumbnail" }] }),
    "hh.communication.messenger.v1": JSON.stringify({ rooms: [{ id: "r1", name: "Nhóm Thiết kế", members: [{ id: "m1", name: "Linh Design", role: "admin" }] }] }),
    "private-api-token": JSON.stringify({ token: "must-not-be-indexed" })
  });
  const index = search.buildIndex({ storage, scope: {}, document: null });
  assert.ok(index.some((item) => item.title === "Ra mắt HH" && item.route === "/work/project-center"));
  assert.ok(index.some((item) => item.title.includes("Ý tưởng video")));
  assert.ok(index.some((item) => item.title === "HH Creative"));
  assert.ok(index.some((item) => item.title === "Linh Design" && item.category === "Thành viên"));
  assert.ok(index.some((item) => item.route === "/media-design/video-editor"));
  assert.equal(index.some((item) => item.searchText.includes("must-not-be-indexed")), false);
});

test("aliases, category, source and date filters produce ranked results", () => {
  const index = [
    search.makeSearchItem({ id: "photo", title: "Photo Editor", route: "/media-design/photo-editor", category: "Media", source: "navigation", date: "2026-07-22T02:00:00Z" }),
    search.makeSearchItem({ id: "project", title: "Website Release", route: "/work/project-center", category: "Dự án", source: "project", date: "2026-06-01T02:00:00Z" })
  ];
  const state = { history: [], usage: { photo: 3 }, queries: [] };
  assert.equal(search.searchIndex(index, "ps", {}, state)[0].id, "photo");
  assert.deepEqual(search.searchIndex(index, "", { category: "Dự án" }, state).map((item) => item.id), ["project"]);
  assert.deepEqual(search.searchIndex(index, "", { source: "navigation" }, state).map((item) => item.id), ["photo"]);
  assert.deepEqual(search.searchIndex(index, "", { date: "today" }, state, new Date("2026-07-22T12:00:00Z").getTime()).map((item) => item.id), ["photo"]);
});

test("history and most-used state persists locally and never stores result payloads", () => {
  const storage = memoryStorage();
  const state = search.defaultState(storage);
  const item = search.makeSearchItem({ id: "route:/home", title: "Trang chủ", route: "/home", category: "Điều hướng", source: "navigation" });
  search.rememberExecution(storage, state, item, "home");
  search.rememberExecution(storage, state, item, "home");
  const restored = search.defaultState(storage);
  assert.equal(restored.history[0].id, item.id);
  assert.equal(restored.usage[item.id], 2);
  assert.equal(restored.queries[0], "home");
  assert.equal(JSON.stringify(storage.snapshot()).includes("searchText"), false);
});

test("fallback create actions use compatible Command Center records", () => {
  const storage = memoryStorage();
  const todo = search.createFallbackTodo(storage, "Viết release note");
  const note = search.createFallbackNote(storage, "Nhớ kiểm tra tablet");
  const todos = JSON.parse(storage.getItem(search.TODO_KEY));
  const notes = JSON.parse(storage.getItem(search.NOTE_KEY));
  assert.equal(todos[0].id, todo.id);
  assert.equal(todos[0].completed, false);
  assert.equal(todos[0].priority, "medium");
  assert.equal(notes[0].id, note.id);
  assert.equal(notes[0].tags, "command-palette");
  assert.ok(notes[0].color.startsWith("#"));
});

test("keyboard, contextual action panel and existing open triggers are wired", () => {
  for (const contract of ["ArrowDown", "ArrowUp", "Enter", "Escape", "data-hh-search-id", "hcs-action-panel", "hh:command-search-execute", "hh:command-create-"]) {
    assert.ok(source.includes(contract), `missing ${contract}`);
  }
  assert.match(source, /documentRef\.addEventListener\("keydown", keyHandler, true\)/);
  assert.match(source, /MutationObserver/);
  assert.doesNotMatch(source, /querySelectorAll\("\[data-command-open\]"\).*addEventListener/);
});

test("responsive UI avoids clipping and honors reduced motion", () => {
  assert.match(styles, /max-height:\s*min\(760px, calc\(100dvh - 32px\)\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) 270px/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.hcs-action-panel\s*\{[^}]*display:\s*none/s);
});
