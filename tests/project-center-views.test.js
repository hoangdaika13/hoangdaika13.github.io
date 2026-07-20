const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Project Center exposes linked work views", () => {
  const app = read("script.js");
  const styles = read("styles.css");

  for (const pane of ["list", "calendar", "timeline", "insights"]) {
    assert.match(app, new RegExp(`data-project-pane=\\"${pane}\\"`));
  }
  assert.match(app, /\[\["overview","Tổng quan"\],\["list","Danh sách"\],\["board","Kanban"\],\["calendar","Lịch"\],\["timeline","Timeline"\],\["roadmap","Roadmap"\],\["bugs","Bugs"\],\["release","Changelog"\],\["insights","Insights"\]\]/);
  for (const selector of ["data-project-task-filter", "data-project-task-status", "data-project-sort-tasks", "data-project-task-id"]) {
    assert.match(app, new RegExp(selector));
  }
  for (const className of ["project-task-table", "project-calendar-grid", "project-timeline-row", "project-linked-workspaces"]) {
    assert.match(styles, new RegExp(`\\.${className}`));
  }
});

test("Project Center views are available as command palette actions", () => {
  const app = read("script.js");
  assert.match(app, /project-view:list/);
  assert.match(app, /project-view:calendar/);
  assert.match(app, /project-view:timeline/);
  assert.match(app, /project-view:insights/);
  assert.ok(app.includes('const executePaletteOption ='));
  assert.ok(app.includes('executePaletteOption(options[current])'));
  assert.match(app, /location\.hash = "#\/work\/project-center"/);
});
