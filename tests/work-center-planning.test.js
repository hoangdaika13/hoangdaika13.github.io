const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "work-center.js"), "utf8");
const css = fs.readFileSync(path.join(root, "work-center.css"), "utf8");

test("Work planning keeps a versioned local-first document and explicit adapter state", () => {
  assert.match(source, /hh-work-center-v2/);
  assert.match(source, /schemaVersion: WORK_SCHEMA_VERSION/);
  assert.match(source, /Local-first/);
  assert.match(source, /HH_WORK_ADAPTER/);
});

test("Work planning covers project, cycle, capacity, dependency, timeline, meetings and risks", () => {
  for (const token of ["data-planning-project-form", "data-planning-cycle-form", "data-planning-capacity", "dependsOn", "planningTimeline", "data-planning-meeting-form", "detectPlanningRisks"]) assert.match(source, new RegExp(token));
  for (const token of ["work-capacity-list", "work-dependency-list", "work-timeline", "work-risk-list"]) assert.match(css, new RegExp(`\\.${token}`));
});

test("Form responses can become real local tasks and controls remain responsive", () => {
  assert.match(source, /data-form-response-task/);
  assert.match(source, /createTaskFromResponse/);
  assert.match(source, /source: \{ type: "form-response"/);
  assert.match(css, /max-width: 560px/);
  assert.match(css, /prefers-reduced-motion/);
});
