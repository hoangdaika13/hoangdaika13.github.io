const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "communication-messenger-next.js"), "utf8");
const css = fs.readFileSync(path.join(root, "communication-messenger-next.css"), "utf8");

function loadModule() {
  const values = new Map();
  const sandbox = {
    console,
    URL,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {},
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    location: { href: "https://hh.local/" },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "communication-messenger-next.js" });
  return { api: sandbox.HHCommunicationMessengerNext, values };
}

test("exposes the small messenger mount contract", () => {
  const { api } = loadModule();
  assert.equal(api.supports("messenger"), true);
  assert.equal(api.supports("conversation"), true);
  assert.equal(api.supports("forum"), false);
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(api.STORAGE_KEY, "hh.communication.messenger.v1");
});

test("local store creates rooms, pages messages and persists versioned data", () => {
  const { api, values } = loadModule();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = api.createStore(storage);
  const group = store.createRoom({ name: "Nhóm kiểm thử", members: [{ id: "u2", name: "Linh" }] });
  assert.equal(group.kind, "group");
  assert.equal(group.members.length, 2);
  for (let index = 0; index < 30; index += 1) store.addMessage(group.id, { text: `Tin ${index}` });
  const page = store.page(group.id, "", 10);
  assert.equal(page.items.length, 10);
  assert.equal(page.hasMore, true);
  assert.equal(JSON.parse(values.get(api.STORAGE_KEY)).version, 1);
});

test("message delivery and translation stay truthful until an adapter acknowledges them", () => {
  const { api } = loadModule();
  const store = api.createStore({ getItem: () => null, setItem() {} });
  const created = store.addMessage(store.snapshot().activeRoomId, { text: "Xin chào" });
  assert.equal(created.status, "local");
  assert.equal(api.normalizeTranslationResult({ text: "Hello" }), null);
  assert.equal(api.normalizeTranslationResult({ ok: true, connected: false, text: "Hello" }), null);
  const translated = api.normalizeTranslationResult({ ok: true, connected: true, translatedText: "Hello", provider: "HH", targetLanguage: "en" });
  assert.equal(translated.translatedText, "Hello");
  assert.equal(translated.provider, "HH");
  assert.equal(translated.targetLanguage, "en");
  assert.match(source, /data-hmn-action="translate"/);
  assert.match(source, /translateAdapter/);
});

test("message actions cover reply metadata, edit window, reaction, pin and recall", () => {
  const { api } = loadModule();
  const store = api.createStore({ getItem: () => null, setItem() {} });
  const room = store.snapshot().activeRoomId;
  const created = store.addMessage(room, { text: "Bản gốc", replyTo: { id: "x", name: "Linh", text: "Câu trước" }, ephemeralSeconds: 60 });
  assert.equal(created.replyTo.name, "Linh");
  assert.ok(created.expiresAt);
  assert.equal(store.editMessage(room, created.id, "Bản sửa").text, "Bản sửa");
  assert.equal(store.mutateMessage(room, created.id, "reaction", "love").reactions.love, 1);
  assert.equal(store.mutateMessage(room, created.id, "pin").pinned, true);
  assert.equal(store.mutateMessage(room, created.id, "recall").recalled, true);
});

test("group roles, preferences and safety actions remain local-first", () => {
  const { api } = loadModule();
  const store = api.createStore({ getItem: () => null, setItem() {} });
  const group = store.createRoom({ name: "Creative", members: [{ id: "u2", name: "Linh" }] });
  assert.equal(store.setMember(group.id, { id: "u2", role: "admin" }).members.find((member) => member.id === "u2").role, "admin");
  assert.equal(store.updateRoom(group.id, { muted: true, archived: true }).muted, true);
  store.report(group.id, "Nội dung không phù hợp");
  assert.equal(store.snapshot().reports[0].scope, "conversation-metadata-only");
  assert.equal(store.leaveRoom(group.id), true);
});

test("workspace includes truthful browser capabilities and complete messenger controls", () => {
  for (const marker of [
    "HHCommunity", "HHRealtimeSocket", "HHCalls", "MediaRecorder", "getUserMedia", "geolocation",
    "message:room:create", "message:room:update", "message:room:member", "message:room:role", "message:room:leave",
    "message:create", "message:edit", "message:delete:self", "message:delete:all", "message:react", "message:pin", "message:forward",
    "data-hmn-create-group", "data-hmn-message-search", "data-hmn-member-role", "data-hmn-ephemeral", "data-hmn-poll-form", "data-hmn-event-form"
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /Không mã hóa đầu cuối/);
  assert.match(source, /HTTPS\/TLS/);
  assert.doesNotMatch(source, /mã hóa đầu cuối đã (?:được|sẵn sàng)|E2EE.*(?:ready|active)/i);
});

test("CSS delivers a three-pane accessible responsive workspace", () => {
  for (const marker of [".hmn-workspace", ".hmn-rooms", ".hmn-conversation", ".hmn-details", ".hmn-dialog", ":focus-visible"]) assert.match(css, new RegExp(marker.replace(".", "\\.")));
  assert.match(css, /grid-template-columns:280px minmax\(420px,1fr\) 300px/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^;]*vw/);
});
