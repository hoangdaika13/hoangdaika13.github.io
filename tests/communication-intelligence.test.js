const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "communication-intelligence.js"), "utf8");
const css = fs.readFileSync(path.join(root, "communication-intelligence.css"), "utf8");

function loadApi() {
  const storage = new Map();
  const window = {
    setTimeout,
    clearTimeout,
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {}
  };
  const context = {
    window,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    navigator: {},
    Notification: {},
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    module: { exports: {} },
    console,
    Date,
    Math,
    JSON,
    Set,
    Map,
    String,
    Number,
    Array,
    Object,
    RegExp,
    Promise
  };
  vm.runInNewContext(source, context, { filename: "communication-intelligence.js" });
  return context.module.exports;
}

test("exports a small global mount API and versioned state key", () => {
  const api = loadApi();
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(api.storageKey, "hh.communication.intelligence.v1");
  assert.match(source, /window\.HHCommunicationIntelligence\s*=\s*api/);
});

test("extractive catch-up is deterministic and separates decisions from actions", () => {
  const api = loadApi();
  const input = [
    { sender: "An", createdAt: 100, message: "Nhóm thống nhất chốt giao diện mới vào thứ Sáu." },
    { sender: "Bình", createdAt: 200, message: "Hoàng cần kiểm tra bản mobile trước deadline ngày mai." },
    { sender: "An", createdAt: 300, message: "Các lỗi hiển thị đã được ghi lại trong dự án Community." }
  ];
  const first = api.summarizeExtractive(input, 3);
  const second = api.summarizeExtractive(input, 3);
  assert.deepEqual(first, second);
  assert.equal(first.sourceCount, 3);
  assert.deepEqual([...first.participants], ["An", "Bình"]);
  assert.match(first.decisions.join(" "), /thống nhất chốt/);
  assert.match(first.actions.join(" "), /cần kiểm tra/);
});

test("universal search combines text and exact context filters", () => {
  const api = loadApi();
  const now = Date.now();
  const items = [
    { id: "m1", kind: "message", title: "Bản mix cuối", excerpt: "Đã gửi file master", sender: "Hoàng", workspace: "Music", reaction: "like", createdAt: now, channelId: "mix" },
    { id: "f1", kind: "file", title: "Brand kit", excerpt: "Logo và màu", sender: "An", workspace: "Design", createdAt: now - 10 * 86_400_000 }
  ];
  const results = api.filterIndex(items, { query: "mix master", sender: "Hoàng", date: "today", type: "message", reaction: "like", workspace: "Music" });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "m1");
  assert.equal(results[0].channelId, "mix");
});

test("semantic search expands local communication concepts without claiming AI", () => {
  const api = loadApi();
  const results = api.filterIndex([
    { id: "approval", kind: "message", title: "Chốt giao diện", excerpt: "Đã xác nhận phương án mới", workspace: "Design", createdAt: Date.now() },
    { id: "other", kind: "message", title: "Ghi chú âm thanh", excerpt: "Mix bản thu", workspace: "Music", createdAt: Date.now() }
  ], { query: "duyệt thiết kế" });
  assert.deepEqual(results.map((item) => item.id), ["approval"]);
  assert.match(source, /SEMANTIC_GROUPS/);
  assert.match(source, /Không dùng AI khi chưa có adapter xác nhận/);
});

test("notification digest is local, bounded and respects mute/important rules", () => {
  const api = loadApi();
  const state = api.normalizeState({
    preferences: { digest: { enabled: true, cadence: "daily", time: "09:00" }, mutedChannels: ["general"], importantPeople: ["An"] },
    notifications: [
      { id: "a", source: "Community", title: "A", message: "one", sender: "An", channel: "general", read: false, createdAt: Date.now() },
      { id: "b", source: "Community", title: "B", message: "two", sender: "Bình", channel: "general", read: false, createdAt: Date.now() }
    ]
  });
  const digest = api.buildNotificationDigest(state, Date.now());
  assert.equal(digest.total, 1);
  assert.equal(digest.items[0].id, "a");
  assert.equal(digest.label, "DIGEST CỤC BỘ");
});

test("Catch-up adapter output needs an explicit connected acknowledgement", () => {
  const api = loadApi();
  assert.equal(api.normalizeCatchUpAdapterResult({ summary: ["x"] }), null);
  assert.equal(api.normalizeCatchUpAdapterResult({ ok: true, connected: true, summary: ["x"], provider: "hh" }).label, "TÓM TẮT TỪ MÁY CHỦ ĐÃ XÁC NHẬN");
});

test("notification filters respect mute while allowing important people", () => {
  const api = loadApi();
  const state = api.normalizeState({
    preferences: { importantPeople: ["An"], mutedChannels: ["general"] },
    notificationFilter: { status: "unread", priority: "important", source: "all" },
    notifications: [
      { id: "a", sender: "An", channel: "general", title: "A", read: false, priority: "normal" },
      { id: "b", sender: "Bình", channel: "general", title: "B", read: false, priority: "important" },
      { id: "c", sender: "An", channel: "general", title: "C", read: true, priority: "important" }
    ]
  });
  const visible = api.visibleNotifications(state, Date.now());
  assert.deepEqual(visible.map((item) => item.id), ["a"]);
});

test("similar notifications are grouped without losing member actions", () => {
  const api = loadApi();
  const createdAt = Date.now();
  const grouped = api.groupNotifications([
    { id: "a", source: "Community", type: "mention", title: "Đã nhắc đến bạn", message: "Tin một", createdAt, read: true },
    { id: "b", source: "Community", type: "mention", title: "Đã nhắc đến bạn", message: "Tin hai", createdAt: createdAt - 1000, read: false }
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].count, 2);
  assert.deepEqual([...grouped[0].ids], ["a", "b"]);
  assert.equal(grouped[0].read, false);
});

test("push permission and communication adapters are explicit user-driven contracts", () => {
  assert.match(source, /data-hci-push/);
  assert.match(source, /Notification\.requestPermission\(\)/);
  assert.match(source, /hh:communication:index-request/);
  assert.match(source, /hh:communication:jump/);
  assert.match(source, /hh:communication:notification/);
  assert.match(source, /catchUpAdapter/);
  assert.match(source, /KHÔNG PHẢI AI/);
});

test("styles provide focus, mobile and reduced-motion behavior", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns/);
});
