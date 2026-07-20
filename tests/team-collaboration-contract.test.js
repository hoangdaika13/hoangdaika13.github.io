const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const client = fs.readFileSync(path.join(root, "team-collaboration-pro.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "team", "board.js"), "utf8");
const css = fs.readFileSync(path.join(root, "team-collaboration-pro.css"), "utf8");

test("Team API keeps legacy actions while extending real task contracts", () => {
  for (const marker of ["create-board", "join-board", "create-task", "update-task", "comment", "shareToken"]) assert.match(api, new RegExp(marker));
  for (const marker of ["add-subtask", "toggle-subtask", "remove-subtask", "set-dependencies", "estimateMinutes", "dueDate", "assigneeId"]) assert.match(api, new RegExp(marker));
  assert.match(api, /validateDependencies/);
  assert.match(api, /Dependency tạo thành vòng lặp/);
  assert.match(api, /boardId: board\._id/);
  assert.match(api, /resolveAssignee/);
  assert.match(api, /Người phụ trách không thuộc board này/);
  assert.match(api, /typeof body\.assignee === "string"/);
});

test("Team permissions separate viewer, commenter, editor and owner", () => {
  assert.match(api, /viewer.*commenter.*editor.*owner/);
  assert.match(api, /ROLE_RANK/);
  assert.match(api, /requireRole\(access, "commenter"/);
  assert.match(api, /requireRole\(access, "editor"/);
  assert.match(api, /requireRole\(access, "owner"/);
  assert.match(api, /Chỉ owner được xem audit metadata/);
  assert.match(api, /if \(includeAudit\) value\.audit/);
  assert.doesNotMatch(api, /password|passwordHash|refreshToken/);
});

test("Team API supports server-side automation, versions, restore and audit", () => {
  for (const marker of ["update-automation", "completeOnSubtasks", "reopenOnSubtask", "startOnAssignee", "task-history", "restore-task-version", "audit-log", "requestMetadata", "before", "after", "reason"]) assert.match(api, new RegExp(marker));
  assert.match(api, /\$slice: -VERSION_LIMIT/);
  assert.match(api, /x-forwarded-for/);
  assert.match(api, /user-agent/);
});

test("Team client exposes distinct Board, List, Calendar and Timeline workspaces", () => {
  for (const marker of ["data-tc-view=", "boardView", "listView", "calendarView", "timelineView", "data-tc-view-panel", "data-tc-drop-status"]) assert.match(client, new RegExp(marker));
  for (const marker of ["data-tc-add-subtask", "data-tc-dependency", "data-tc-save-comment", "data-tc-member-role", "data-tc-automation", "data-tc-restore-version"]) assert.match(client, new RegExp(marker));
  assert.match(client, /dragstart/);
  assert.match(client, /dataTransfer/);
});

test("Team client hides mutation controls from roles without permission", () => {
  assert.match(client, /can\(data\.board, "editor"\)/);
  assert.match(client, /can\(data\.board, "commenter"\)/);
  assert.match(client, /can\(data\.board, "owner"\)/);
  assert.match(client, /tc-create-locked/);
  assert.match(client, /owner \? `<button type="button" data-tc-share/);
  assert.match(client, /disabled/);
});

test("Team workspace has responsive professional layouts", () => {
  for (const marker of [".tc-kanban", ".tc-list-view", ".tc-calendar-grid", ".tc-timeline-view", ".tc-inspector", ".tc-activity", ".tc-automation"]) assert.match(css, new RegExp(marker.replace(".", "\\.")));
  assert.match(css, /@media\(max-width:1040px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /overflow-x:auto/);
});
