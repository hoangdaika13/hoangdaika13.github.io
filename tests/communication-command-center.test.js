const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "communication-command-center.js"), "utf8");
const css = fs.readFileSync(path.join(root, "communication-command-center.css"), "utf8");
const mod = require("../communication-command-center.js");

function makeEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
      return true;
    },
    listenerCount(type) { return listeners.get(type)?.size || 0; }
  };
}

function runtime(saved) {
  const values = new Map(saved ? [[mod.STORAGE_KEY, JSON.stringify(saved)]] : []);
  const scope = {
    ...makeEventTarget(),
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, String(value))
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    Intl,
    Date,
    setTimeout,
    clearTimeout
  };
  const context = { window: scope, globalThis: scope, Intl, Date, Math, JSON, Object, Set, Map, Array, String, Number, Boolean, Promise, console, module: { exports: {} }, exports: {} };
  vm.runInNewContext(source, context, { filename: "communication-command-center.js" });
  return { scope, api: scope.HHCommunicationCommandCenter, values };
}

function host() {
  const target = makeEventTarget();
  return {
    ...target,
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

test("exposes a small two-view lifecycle API and versioned storage", () => {
  assert.equal(mod.VERSION, 1);
  assert.equal(mod.STORAGE_KEY, "hh.communication.command.v1");
  assert.deepEqual(mod.VIEWS, ["command-center", "unified-inbox"]);
  assert.equal(mod.supports("command-center"), true);
  assert.equal(mod.supports("unified-inbox"), true);
  assert.equal(mod.supports("community"), false);
  assert.deepEqual(Object.keys(global.HHCommunicationCommandCenter).sort(), ["mount", "supports", "unmount"]);
});

test("normalizes all supported inbox types and bounds untrusted data", () => {
  const types = ["dm", "group", "channel", "comment", "mention", "ticket"];
  const state = mod.normalizeState({
    onlineUsers: 50000,
    supportRequests: -2,
    items: types.map((type, index) => ({ id: type, type, title: "x".repeat(800), unread: index % 2 === 0, mentioned: type === "mention" })),
    ui: { filter: "unsupported", selectedIds: ["dm", "missing"], search: "q".repeat(200) }
  });
  assert.deepEqual(state.items.map((item) => item.type), types);
  assert.equal(state.items[0].title.length, 120);
  assert.equal(state.onlineUsers, 9999);
  assert.equal(state.supportRequests, 0);
  assert.equal(state.ui.filter, "all");
  assert.deepEqual(state.ui.selectedIds, ["dm"]);
  assert.equal(state.ui.search.length, 100);
});

test("first visit seeds a realistic local fallback once and labels it honestly", () => {
  const { scope, values } = runtime();
  const state = mod.loadState(scope);
  assert.equal(state.mode, "local-fallback");
  assert.ok(state.items.length >= 6);
  assert.ok(state.conversations.length >= 3);
  assert.ok(state.notices.some((notice) => /cục bộ/i.test(notice.title + notice.body)));
  assert.ok(values.has(mod.STORAGE_KEY));
  const savedAt = values.get(mod.STORAGE_KEY);
  mod.loadState(scope);
  assert.equal(values.get(mod.STORAGE_KEY), savedAt, "existing persisted data must not be reseeded");
});

test("adapter payload merges normalized items and upgrades capability state", () => {
  const base = mod.normalizeState(mod.seedState());
  const merged = mod.mergeAdapterData(base, {
    source: "socket",
    connected: true,
    onlineUsers: 12,
    supportRequests: 4,
    items: [
      { id: "dm-lan", type: "dm", sender: "Lan", preview: "Tin từ socket", unread: true },
      { id: "channel-new", type: "channel", title: "# releases", preview: "Đã phát hành", unread: true }
    ]
  });
  assert.equal(merged.mode, "adapter");
  assert.equal(merged.onlineUsers, 12);
  assert.equal(merged.supportRequests, 4);
  assert.equal(merged.items.find((item) => item.id === "dm-lan").preview, "Tin từ socket");
  assert.equal(merged.items.find((item) => item.id === "channel-new").source, "socket");
});

test("adapter capability is not inferred from an arbitrary payload", () => {
  assert.equal(mod.isConfirmedAdapterPayload({ source: "socket", items: [] }), false);
  assert.equal(mod.isConfirmedAdapterPayload({ source: "socket", connected: true }), true);
  const local = mod.mergeAdapterData(mod.normalizeState(mod.seedState()), { onlineUsers: 99, conversations: [{ id: "x", name: "X", online: true }] });
  assert.equal(local.mode, "local-fallback");
  assert.equal(local.onlineUsers, 0);
  assert.equal(local.conversations[0].online, false);
});

test("filter engine supports unread, mentions, pinned, archived, snooze and search", () => {
  const now = Date.now();
  const state = mod.normalizeState({
    items: [
      { id: "a", type: "dm", title: "Lan Anh", preview: "Duyệt ảnh", unread: true, pinned: true },
      { id: "b", type: "mention", title: "Design", preview: "@bạn", unread: true, mentioned: true },
      { id: "c", type: "ticket", title: "Support", archived: true },
      { id: "d", type: "group", title: "Đang ngủ", unread: true, snoozedUntil: new Date(now + 3_600_000).toISOString() }
    ],
    ui: { filter: "unread" }
  });
  assert.deepEqual(mod.filteredItems(state).map((item) => item.id).sort(), ["a", "b"]);
  state.ui.filter = "mentions";
  assert.deepEqual(mod.filteredItems(state).map((item) => item.id), ["b"]);
  state.ui.filter = "pinned";
  assert.deepEqual(mod.filteredItems(state).map((item) => item.id), ["a"]);
  state.ui.filter = "archived";
  assert.deepEqual(mod.filteredItems(state).map((item) => item.id), ["c"]);
  state.ui.filter = "all";
  state.ui.search = "duyệt";
  assert.deepEqual(mod.filteredItems(state).map((item) => item.id), ["a"]);
});

test("mount renders complete Command Center and Unified Inbox contracts", () => {
  const first = runtime();
  const commandHost = host();
  const command = first.api.mount(commandHost, { view: "command-center", scope: first.scope });
  for (const token of ["COMMUNICATION COMMAND CENTER", "Tin chưa đọc", "Đang online", "Cuộc gọi sắp tới", "Yêu cầu hỗ trợ", "Nhắn tin", "Tạo nhóm", "Mở phòng", "Đăng bài", "Tạo khảo sát", "Dữ liệu cục bộ trên thiết bị"]) {
    assert.ok(commandHost.innerHTML.includes(token), `missing Command Center token: ${token}`);
  }
  assert.equal(command.view, "command-center");
  first.api.unmount();

  const second = runtime();
  const inboxHost = host();
  second.api.mount(inboxHost, { view: "unified-inbox", scope: second.scope });
  for (const token of ["UNIFIED INBOX", "DM, nhóm, kênh, bình luận, mention và ticket", "Chưa đọc", "Nhắc đến", "Đã ghim", "Lưu trữ", "Trả lời nhanh", "Chuyển tiếp", "role=\"listbox\""]) {
    assert.ok(inboxHost.innerHTML.includes(token), `missing Unified Inbox token: ${token}`);
  }
  second.api.unmount();
});

test("mount requests adapter data and consumes later CustomEvent updates", () => {
  const { scope, api, values } = runtime();
  const mountedHost = host();
  let requested = 0;
  scope.addEventListener("hh:communication:request-data", (event) => {
    requested += 1;
    event.detail.respond({ source: "test-adapter", connected: true, onlineUsers: 21, items: [{ id: "live", type: "dm", title: "Realtime", preview: "Đã kết nối", unread: true }] });
  });
  api.mount(mountedHost, { view: "command-center", scope });
  assert.equal(requested, 1);
  assert.match(mountedHost.innerHTML, /Adapter đã xác nhận/);
  assert.equal(JSON.parse(values.get(mod.STORAGE_KEY)).onlineUsers, 21);

  scope.dispatchEvent(new scope.CustomEvent("hh:communication:data", { detail: { source: "socket", connected: true, onlineUsers: 22, items: [{ id: "later", type: "ticket", title: "Mới" }] } }));
  assert.equal(JSON.parse(values.get(mod.STORAGE_KEY)).onlineUsers, 22);
  assert.match(mountedHost.innerHTML, />22</);
  api.unmount();
  assert.equal(scope.listenerCount("hh:communication:data"), 0);
});

test("user content is escaped and no credentials are embedded", () => {
  const malicious = mod.normalizeState({
    mode: "adapter",
    items: [{ id: "x", type: "dm", title: '<img src=x onerror="boom">', sender: "<script>alert(1)</script>", preview: "<svg onload=boom>" }],
    conversations: [{ id: "c", name: "<iframe src=x>", preview: "bad" }],
    notices: [{ title: "<img src=x>", body: "<script>x</script>" }],
    ui: { activeId: "x" }
  });
  const { scope, api } = runtime(malicious);
  const mountedHost = host();
  api.mount(mountedHost, { view: "unified-inbox", scope });
  assert.doesNotMatch(mountedHost.innerHTML, /<img src=x|<script>|<svg onload|<iframe/);
  assert.match(mountedHost.innerHTML, /&lt;img src=x onerror=&quot;boom&quot;&gt;/);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|clientSecret\s*[:=]|password\s*[:=]/i);
  api.unmount();
});

test("source provides real inbox actions, event adapters and keyboard operation", () => {
  for (const token of [
    "hh:communication:request-data", "hh:communication:data", "hh:communication:action", "hh:communication:navigate",
    "message:reply", "message:forward", "message:snooze", "message:read-state", "bulk:",
    "ArrowDown", "ArrowUp", "Home", "End", "Ctrl + Enter", "data-hcc-select", "aria-live=\"polite\""
  ]) assert.ok(source.includes(token), `missing behavior contract: ${token}`);
  assert.match(source, /addEventListener\("hh:communication:data"|on\(scope, "hh:communication:data"/);
  assert.match(source, /removeEventListener/);
});

test("stylesheet is scoped, responsive, focus-visible and reduced-motion aware", () => {
  for (const token of [
    ".hcc {", ".hcc-inbox-layout", ".hcc-inbox-row", ".hcc-forward", ":focus-visible",
    "@media (max-width: 420px)", "@media (max-width: 760px)", "prefers-reduced-motion: reduce",
    "min-width: 0", "overflow-x: auto"
  ]) assert.ok(css.includes(token), `missing CSS contract: ${token}`);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
