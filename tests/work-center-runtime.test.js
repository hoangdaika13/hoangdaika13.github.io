const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const previousWindow = global.window;
global.window = {};
require(path.resolve(__dirname, "..", "work-center.js"));
const planning = global.window.HHWorkCenter.planning;
global.window = previousWindow;

test("initiative and cycle planning normalize as a versioned local-first document", () => {
  const state = planning.normalizePlanning({
    initiatives: [{ id: "i1", name: "Launch" }],
    projects: [{ id: "p1", name: "Website", initiativeId: "i1", capacity: 8 }],
    cycles: [{ id: "c1", name: "Cycle 1", status: "planned" }],
    tasks: [{ id: "t1", title: "Build", projectId: "p1", estimate: 5, status: "todo" }]
  });
  assert.equal(state.initiatives[0].id, "i1");
  assert.equal(state.projects[0].initiativeId, "i1");
  const assigned = planning.assignOpenTasksToCycle(state, "c1");
  assert.equal(assigned.tasks[0].cycleId, "c1");
  assert.deepEqual(planning.cycleCapacity(assigned, "c1"), { committed: 5, available: 8, percent: 63, taskCount: 1 });
});

test("cycle rollover moves only unfinished work and records provenance", () => {
  const result = planning.rolloverCycle({
    projects: [{ id: "p1", name: "Website", capacity: 8 }],
    cycles: [
      { id: "c1", name: "Cycle 1", start: "2026-07-01", end: "2026-07-14", status: "active" },
      { id: "c2", name: "Cycle 2", start: "2026-07-15", end: "2026-07-28", status: "planned" }
    ],
    tasks: [
      { id: "open", title: "Open", projectId: "p1", cycleId: "c1", status: "todo", estimate: 2 },
      { id: "done", title: "Done", projectId: "p1", cycleId: "c1", status: "done", estimate: 1 }
    ]
  }, "c1", new Date("2026-07-14T12:00:00.000Z"));
  assert.equal(result.moved, 1);
  assert.equal(result.nextCycleId, "c2");
  assert.equal(result.state.tasks.find((item) => item.id === "open").cycleId, "c2");
  assert.equal(result.state.tasks.find((item) => item.id === "done").cycleId, "c1");
  assert.equal(result.state.cycles.find((item) => item.id === "c1").status, "done");
  assert.equal(result.state.cycleRolloverLog[0].moved, 1);
});

test("meeting notes become actions only from explicit local markers", () => {
  assert.deepEqual(planning.extractMeetingActions({ notes: "Ghi chú chung\nTODO: Chốt owner\n- [ ] Kiểm tra mobile\nACTION: Gửi release note" }), ["Chốt owner", "Kiểm tra mobile", "Gửi release note"]);
});
