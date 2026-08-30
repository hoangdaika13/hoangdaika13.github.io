const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = require("../galaxy-home-ai.js");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "galaxy-home-ai.css"), "utf8");

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
  const actions = markup.match(/<div class="gha-ai-destinations gha-copilot-actions"[\s\S]*?<\/div>/)?.[0] || "";
  assert.equal((actions.match(/<button\b/g) || []).length, 6);
  for (const destination of api.AI_DESTINATIONS) {
    assert.match(markup, new RegExp(`data-gha-route="${destination.route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(markup, /data-gha-route="\/chat-ai"/);
  assert.match(markup, /data-gha-route="\/work\/automation-lab"/);
  assert.match(markup, /data-gha-route="\/analytics"/);
  assert.match(markup, /Cần cấu hình/);
  assert.match(markup, /Chưa xác minh/);
  assert.doesNotMatch(markup, /Online|Đã kết nối|12\.5K|Premium/);
});

test("immersive Dashboard and Copilot own their reference chrome without fake metrics", () => {
  const local = api.collectLocalData(memoryStorage(), {});
  const dashboard = api.viewMarkup("/home/dashboard", local);
  const copilot = api.viewMarkup("/create/ai-center", local);

  assert.match(dashboard, /class="gha-topbar__account"/);
  assert.match(dashboard, /aria-label="Mở lịch và công việc"/);
  assert.match(dashboard, /class="gha-sidebar"/);
  assert.match(dashboard, /data-gha-route="\/galaxy\/tools"[^>]*>[\s\S]*?<span>Tools Galaxy<\/span>/);
  assert.match(dashboard, /data-gha-task-metric/);
  assert.equal((copilot.match(/\+ Cuộc trò chuyện mới/g) || []).length, 1);
  assert.match(copilot, /aria-label="Mở hoạt động gần đây"/);
  assert.match(copilot, /data-state="configuration-required"/);
  assert.doesNotMatch(`${dashboard}${copilot}`, /78\.4\s*GB|12\.540|12h\s*45m|Online|Premium/);

  assert.match(styles, /data-galaxy-immersive="true"\][\s\S]*?data-gha-home-ai-host[\s\S]*?\.gha-app:not\(\.gha-chat\)/);
  assert.match(styles, /grid-template:\s*68px\s+minmax\(0,\s*1fr\)\s*\/\s*184px/);
  assert.match(styles, /\.gha-app\.gha-ai\s*\{\s*grid-template-columns:\s*224px/);
  assert.match(styles, /grid-template-rows:\s*252px\s+294px/);
  assert.match(styles, /grid-auto-rows:\s*294px;\s*gap:\s*17px/);
  assert.match(styles, /\.gha-dashboard \.gha-topbar > \.gha-search\s*\{[\s\S]*?left:\s*50%;[\s\S]*?width:\s*min\(570px/);
  assert.match(styles, /url\("assets\/galaxy\/hh-galaxy-map-bg-v1\.png\?v=1"\)/);
  assert.match(styles, /\.gha-copilot__rail\s*\{[\s\S]*?grid-template-rows:\s*494px\s+232px/);
  assert.match(styles, /gha-copilot-orbit-forward\s+18s\s+linear\s+infinite/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /\.gha-ai \.gha-topbar > nav > button:not\(\.gha-topbar__primary\)/);
});

test("Dashboard rejects unsafe account avatar URLs from local or supplied state", () => {
  const local = api.collectLocalData(memoryStorage({
    "hh-auth-user": { name: "Tài khoản kiểm thử", avatar: "javascript:alert(1)" }
  }), {});
  const localMarkup = api.viewMarkup("/home/dashboard", local);
  const suppliedMarkup = api.viewMarkup("/home/dashboard", api.mergeData(local, {
    account: { name: "Tài khoản API", avatar: "data:text/html,<svg onload=alert(1)>" }
  }));

  assert.doesNotMatch(localMarkup, /javascript:/i);
  assert.doesNotMatch(suppliedMarkup, /data:text\/html/i);
  assert.match(localMarkup, /class="gha-avatar">KT</);
  assert.match(suppliedMarkup, /class="gha-avatar">KA</);
});

test("Chat engine mounting is single-flight and ignores stale failures after unmount", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "..", "galaxy-home-ai.js"), "utf8");
  assert.match(source, /if \(runtime\.chatMountPromise\) return runtime\.chatMountPromise/);
  assert.match(source, /runtime\.chatMountPromise = promise/);
  assert.match(source, /if \(runtime !== activeRuntime \|\| runtime\.controller\.signal\.aborted\) return;/);
});
