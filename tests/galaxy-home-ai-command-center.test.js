const test = require("node:test");
const assert = require("node:assert/strict");

const api = require("../galaxy-home-ai.js");

function memoryStorage(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, String(value)); }
  };
}

function layerOneState(overrides = {}) {
  return {
    version: 1,
    settings: { analyticsConsent: false },
    items: [],
    events: [],
    ...overrides
  };
}

test("Home Command Center reads canonical Layer 1 documents and plans without counting samples", () => {
  const storage = memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: layerOneState({
      settings: { analyticsConsent: true },
      items: [
        { id: "demo", route: "/galaxy/ai", title: "Bản mẫu không được tính", kind: "prompt", source: "local-template", isDemo: true, updatedAt: "2026-09-01T01:00:00.000Z" },
        { id: "plan", route: "/galaxy/learning", title: "Ôn flashcard", kind: "learning-plan", source: "user", createdAt: "2026-09-01T02:00:00.000Z", updatedAt: "2026-09-01T02:00:00.000Z", meta: { learningCategory: "plan", dueDate: "2026-09-02", completed: false } },
        { id: "video", route: "/galaxy/video", title: "Video thiên hà", kind: "video-project", source: "user", createdAt: "2026-09-01T03:00:00.000Z", updatedAt: "2026-09-01T04:00:00.000Z" },
        { id: "code", route: "/galaxy/dev", title: "Snippet dữ liệu", kind: "code-project", source: "user", createdAt: "2026-09-01T01:30:00.000Z", updatedAt: "2026-09-01T01:30:00.000Z" }
      ],
      events: [{ id: "event-1", type: "item-create", route: "/galaxy/video", at: "2026-09-01T04:01:00.000Z" }]
    })
  });

  const data = api.collectGalaxyLocalData(storage, { navigator: { onLine: true } });
  assert.equal(api.LAYER_ONE_STORAGE_KEY, "hh.galaxy.layer-one.v1");
  assert.equal(data.source, "layer-one-local");
  assert.equal(data.layerOne.status, "ready");
  assert.equal(data.recentDocuments.length, 3);
  assert.deepEqual(data.recentDocuments.map((item) => item.id), ["video", "plan", "code"]);
  assert.equal(data.tasks.length, 1);
  assert.equal(data.tasks[0].title, "Ôn flashcard");
  assert.equal(data.tasks[0].deadline, "2026-09-02");
  assert.equal(data.projects.length, 2);
  assert.equal(data.activity.length, 1);
  assert.equal(data.capability.layerOneStorage, "ready");
  assert.equal(data.capability.aiProvider, "configuration-required");
  assert.equal(data.evidence.recentDocuments, true);

  const markup = api.viewMarkup("/home", data);
  assert.match(markup, /Command Center/);
  assert.match(markup, /Ôn flashcard/);
  assert.match(markup, /Video thiên hà/);
  assert.match(markup, /Tài liệu<\/small><strong>3<\/strong>/);
  assert.match(markup, /Kế hoạch<\/small><strong>1\/1<\/strong>/);
  assert.match(markup, /AI backend[\s\S]*?Chưa cấu hình/);
  assert.doesNotMatch(markup, /Bản mẫu không được tính/);
  assert.equal((markup.match(/data-gha-entry="hh-core"/g) || []).length, 1);
  assert.equal((markup.match(/data-gha-route="\/create"/g) || []).length, 1);
});

test("an initialized but empty Layer 1 snapshot renders honest zero values", () => {
  const data = api.collectGalaxyLocalData(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: layerOneState()
  }), {});
  assert.equal(data.layerOne.status, "ready");
  assert.deepEqual(data.recentDocuments, []);
  assert.deepEqual(data.tasks, []);
  assert.equal(data.evidence.recentDocuments, true);
  const markup = api.viewMarkup("/home", data);
  assert.match(markup, /Tài liệu<\/small><strong>0<\/strong>/);
  assert.match(markup, /Kế hoạch<\/small><strong>0\/0<\/strong>/);
  assert.match(markup, /Chưa có kế hoạch hoặc tài liệu người dùng/);
  assert.doesNotMatch(markup, /99\.9%|12\.5K|Premium|78\.4 GB/);
});

test("invalid Layer 1 JSON is reported as an error and never replaced by legacy fake counts", () => {
  const data = api.collectGalaxyLocalData(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: "{invalid-json",
    "hh.galaxy.tasks.v1": [{ id: "legacy", title: "Không được dùng khi snapshot lỗi", completed: false }]
  }), {});
  assert.equal(data.source, "layer-one-error");
  assert.equal(data.layerOne.status, "error");
  assert.equal(data.capability.layerOneStorage, "error");
  assert.deepEqual(data.tasks, []);
  assert.deepEqual(data.recentDocuments, []);
  const markup = api.viewMarkup("/home", data);
  assert.match(markup, /Lỗi dữ liệu/);
  assert.match(markup, /Snapshot Layer 1 không đọc được/);
  assert.doesNotMatch(markup, /Không được dùng khi snapshot lỗi/);
});

test("Layer 1 events remain hidden unless local Analytics consent is true", () => {
  const event = { id: "event-1", type: "route-view", route: "/galaxy/tools", at: "2026-09-01T05:00:00.000Z" };
  const withoutConsent = api.collectGalaxyLocalData(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: layerOneState({ events: [event] })
  }), {});
  const withConsent = api.collectGalaxyLocalData(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: layerOneState({ settings: { analyticsConsent: true }, events: [event] })
  }), {});
  assert.deepEqual(withoutConsent.activity, []);
  assert.equal(withoutConsent.evidence.activity, false);
  assert.equal(withConsent.activity.length, 1);
  assert.equal(withConsent.evidence.activity, true);
  assert.equal(withConsent.activity[0].title, "Tools Galaxy");
});

test("document titles from Layer 1 are escaped before reaching Home markup", () => {
  const data = api.collectGalaxyLocalData(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: layerOneState({
      items: [{ id: "unsafe", route: "/galaxy/dev", title: "<img src=x onerror=alert(1)>", kind: "code-project", updatedAt: "2026-09-01T05:00:00.000Z" }]
    })
  }), {});
  const markup = api.viewMarkup("/home", data);
  assert.doesNotMatch(markup, /<img src=x/);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
