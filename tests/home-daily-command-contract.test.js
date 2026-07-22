const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "home-daily-command.js"), "utf8");
const css = fs.readFileSync(path.join(root, "home-daily-command.css"), "utf8");
const api = require(path.join(root, "home-daily-command.js"));

function storageFixture(values) {
  const data = new Map(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test("daily enhancement mounts only on the home shell and preserves the existing hero", () => {
  assert.match(source, /\[data-shell-view=["']home["']\]/);
  assert.match(source, /\.dashboard-hero-pro/);
  assert.match(source, /hero\.append\(buildDailyZone\(\)\)/);
  assert.doesNotMatch(source, /hero\.innerHTML\s*=/);
  assert.match(source, /data-hdc-daily/);
  assert.match(source, /data-hdc-continue/);
});

test("daily brief exposes the required truthful local signals", () => {
  for (const contract of [
    "hh-auth-user",
    "hh.command-center.todos.v2",
    "hh.command-center.pomodoro.v1",
    "hh.dashboard.weather.v1",
    "TÓM TẮT TỰ ĐỘNG · TRÊN THIẾT BỊ",
    "Cho phép tóm tắt cục bộ",
    "Tiếp tục công việc gần nhất"
  ]) assert.ok(source.includes(contract), `Thiếu contract: ${contract}`);
  assert.doesNotMatch(source, /\bfetch\s*\(/, "Morning Brief phải local-first, không gọi backend giả.");
  assert.match(source, /aiConsent/);
});

test("recent work uses real local module stores, routes and caps output at four", () => {
  const now = Date.now();
  const storage = storageFixture({
    "hh-project-center": { updatedAt: new Date(now - 5000).toISOString(), activeProject: "p1", projects: [{ id: "p1", name: "HH Platform", progress: 72 }] },
    "hh.music-ai-studio.v1": { updatedAt: new Date(now - 4000).toISOString(), project: { name: "Album demo" } },
    "hh.photo.pro.v2": { updatedAt: new Date(now - 3000).toISOString(), name: "Ảnh bìa", layers: [{}, {}] },
    "hh.learning.os.v1": { updatedAt: new Date(now - 2000).toISOString(), activeLessonId: "technology-b1-01", profile: { level: "B1" } },
    "hh.communication.intelligence.v1": { updatedAt: new Date(now - 1000).toISOString(), notifications: [{ id: "n1", read: false }] }
  });

  const items = api.collectRecentWork(storage);
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => item.category), ["communication", "learning", "design", "music"]);
  assert.equal(items[0].route, "/communication/messenger");
  assert.ok(items.every((item) => /^\/[a-z0-9/_-]+$/i.test(item.route)));
});

test("automated summary reports only stored data and sanitizes untrusted text", () => {
  const now = Date.now();
  const storage = storageFixture({
    "hh.command-center.todos.v2": [{ title: "<img src=x onerror=alert(1)> Hoàn thiện hero", completed: false, priority: "high" }],
    "hh-project-center": { projects: [{ name: "Trễ", due: new Date(now - 86400000).toISOString(), progress: 50 }] },
    "hh.communication.intelligence.v1": { notifications: [{ read: false }] },
    "hh.learning.os.v1": { reviews: [{ dueAt: new Date(now - 1000).toISOString() }] }
  });
  const summary = api.automatedSummary(storage, now);
  assert.match(summary, /1 công việc chưa hoàn thành/);
  assert.match(summary, /1 dự án đã qua deadline/);
  assert.match(summary, /1 thông báo chưa đọc/);
  assert.equal(api.cleanText("A\u0000  B", 20), "A B");
  assert.ok(summary.length < 400);
});

test("time context and day progress are deterministic", () => {
  assert.equal(api.periodFor(new Date(2026, 6, 22, 8, 0)).id, "morning");
  assert.equal(api.periodFor(new Date(2026, 6, 22, 14, 0)).id, "afternoon");
  assert.equal(api.periodFor(new Date(2026, 6, 22, 20, 0)).id, "evening");
  assert.equal(api.dayProgress(new Date(2026, 6, 22, 12, 0, 0)), 50);
});

test("styles are scoped, responsive and respect reduced motion", () => {
  assert.match(css, /\.hdc-home-enhanced/);
  assert.match(css, /data-hdc-period=["']morning["']/);
  assert.match(css, /\.hdc-recent-grid/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /focus-visible/);
});
