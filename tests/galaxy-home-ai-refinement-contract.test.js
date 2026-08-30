const test = require("node:test");
const assert = require("node:assert/strict");

const api = require("../galaxy-home-ai.js");

function memoryStorage(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, String(value)); }
  };
}

test("Personal Dashboard composes the approved widget surface from local evidence", () => {
  const data = api.collectLocalData(memoryStorage({
    "hh-auth-user": { name: "Nguyễn Hoàng" },
    "hh.creative-os.v1": { projects: [{ id: "p1", name: "Galaxy thật", progress: 36 }] },
    "hh.command-center.todos.v2": [{ id: "t1", title: "Kiểm thử Dashboard", completed: true }],
    "hh.dashboard.sticky-notes.v1": [{ id: "n1", text: "Ghi chú cục bộ" }],
    "hh-module-favorites": ["chat-ai"],
    "hh.command-center.activity.v1": [{ action: "Đã mở Project Hub", at: 1720000000000 }]
  }), {});
  const markup = api.viewMarkup("/home/dashboard", data);

  assert.equal((markup.match(/<article class="gha-widget\b/g) || []).length, 8);
  assert.equal((markup.match(/class="gha-dashboard-metric"/g) || []).length, 4);
  assert.match(markup, /Galaxy thật/);
  assert.match(markup, /Ghi chú cục bộ/);
  assert.match(markup, /data-gha-focus-metric/);
  assert.match(markup, /data-gha-storage-value/);
  assert.doesNotMatch(markup, /12\.540|12h 45m|CPU Usage|RAM Usage/);
});

test("HH AI Copilot exposes real internal routes and honest capability labels", () => {
  const data = api.collectLocalData(memoryStorage(), {});
  const markup = api.viewMarkup("/create/ai-center", data);

  assert.match(markup, /HH AI COPILOT/);
  assert.equal((markup.match(/class="gha-copilot-modules"/g) || []).length, 1);
  assert.equal((markup.match(/data-gha-ai-form/g) || []).length, 1);
  assert.equal((markup.match(/\bgha-copilot-actions\b/g) || []).length, 1);
  assert.equal((markup.match(/\bgha-copilot-orbit-stage\b/g) || []).length, 1);
  assert.match(markup, /data-gha-route="\/chat-ai"/);
  assert.match(markup, /data-gha-route="\/work\/automation-lab"/);
  assert.match(markup, /data-gha-route="\/analytics"/);
  assert.match(markup, /Cần cấu hình/);
  assert.match(markup, /Chưa xác minh/);
  assert.doesNotMatch(markup, /Online|Đã kết nối|12\.5K|Premium/);
});
