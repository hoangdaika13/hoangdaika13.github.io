const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("work-center.js");
const css = read("work-center.css");
const shell = read("script.js");

test("Work Galaxy exposes seven real planet routes while preserving legacy workspaces", () => {
  for (const id of ["mission-control", "projects-tasks", "roadmap-planning", "team-orbit", "knowledge-assets", "automation-lab", "portfolio-observatory"]) {
    assert.match(source, new RegExp(`id: "${id}"`));
    assert.match(shell, new RegExp(`route: "\\/work\\/${id}"`));
  }
  assert.match(shell, /legacyItems: workLegacyModuleIds/);
  assert.match(shell, /item\.legacyItems\?\.includes\(id\)/);
});

test("Universal Work Project is versioned, local-first and uses derived telemetry", () => {
  assert.match(source, /WORK_SCHEMA_VERSION = 4/);
  assert.match(source, /universalProject:/);
  assert.match(source, /function workMetrics|const workMetrics/);
  assert.match(source, /detectPlanningRisks/);
  assert.match(source, /planetTelemetry/);
  assert.doesNotMatch(source, /fake progress|mock progress/i);
});

test("Projects and Tasks provides all proposed operational views", () => {
  for (const view of ["list", "board", "calendar", "timeline", "gantt", "workload", "table", "milestones"]) {
    assert.match(source, new RegExp(`"${view}"`));
  }
  for (const token of ["data-work-task-status", "data-work-active-project", "data-work-save-view", "dependsOn", "data-work-task-query"]) {
    assert.match(source, new RegExp(token));
  }
});

test("Team, automation and portfolio controls persist real local actions", () => {
  for (const token of ["data-work-capacity-form", "data-work-meeting-form", "data-work-automation-form", "data-work-automation-dry-run", "automationRuns", "data-work-export"]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /không chạy hành động ngoài thiết bị/);
  assert.match(source, /approval:/);
});

test("The missing Device Vault mount is guarded and every route remains responsive", () => {
  assert.match(source, /if \(dropzone\) \{/);
  assert.match(source, /if \(host\.querySelector\("\[data-work-file-list\]"\)\) renderDeviceFiles/);
  assert.match(css, /@media \(max-width: 375px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.work-galaxy-nav/);
  assert.match(css, /\.work-project-star/);
  assert.match(css, /\.work-orbit-system/);
});

test("Automation evaluator is deterministic and does not execute adapters", () => {
  const previousWindow = global.window;
  global.window = {};
  delete require.cache[require.resolve(path.join(root, "work-center.js"))];
  require(path.join(root, "work-center.js"));
  const evaluate = global.window.HHWorkCenter.planning.evaluateAutomation;
  const result = evaluate({ condition: "unassigned" }, {
    tasks: [
      { id: "a", title: "A", status: "todo", assignee: "" },
      { id: "b", title: "B", status: "doing", assignee: "Hoàng" },
      { id: "c", title: "C", status: "done", assignee: "" }
    ]
  });
  assert.deepEqual(result, { matched: 1, sample: ["A"] });
  global.window = previousWindow;
});
