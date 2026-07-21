const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "communication-channels-forum.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "communication-channels-forum.css"), "utf8");

function loadModule() {
  const context = {
    window: {},
    URL,
    console,
    setTimeout,
    clearTimeout,
    structuredClone
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: "communication-channels-forum.js" });
  return context.window.HHCommunicationChannelsForum;
}

test("exposes a small mount API for all four communication views", () => {
  const module = loadModule();
  assert.equal(typeof module.mount, "function");
  assert.equal(typeof module.unmount, "function");
  for (const view of ["channels", "forum", "onboarding", "moderation", "/communication/forum"]) {
    assert.equal(module.supports(view), true, view);
  }
  assert.equal(module.supports("unknown-workspace"), false);
});

test("uses versioned local-first state with public, private and shared channels", () => {
  const module = loadModule();
  const state = module._test.defaultState();
  assert.equal(module._test.STORAGE_KEY, "hh.communication.channels.v1");
  assert.equal(state.version, 1);
  assert.deepEqual([...new Set(state.channels.map((channel) => channel.type))].sort(), ["private", "public", "shared"]);
  assert.ok(state.posts.some((post) => post.replies.length > 0), "seed includes a threaded discussion");
  assert.ok(state.posts.some((post) => post.kind === "guide" && post.solved), "seed includes a solved guide");
});

test("permission matrix prevents role escalation for members and guests", () => {
  const { _test } = loadModule();
  assert.equal(_test.hasPermission("owner", "manage-role"), true);
  assert.equal(_test.hasPermission("admin", "manage-channel"), true);
  assert.equal(_test.hasPermission("moderator", "moderate"), true);
  assert.equal(_test.hasPermission("member", "post"), true);
  assert.equal(_test.hasPermission("member", "manage-role"), false);
  assert.equal(_test.hasPermission("guest", "post"), false);
  assert.equal(_test.hasPermission("guest", "reply"), true);
});

test("link-risk detector blocks active content and warns about suspicious links", () => {
  const { assessLinkRisk } = loadModule()._test;
  assert.deepEqual(assessLinkRisk("Chào cộng đồng").level, "none");
  assert.deepEqual(assessLinkRisk("Xem https://hh.example/docs").level, "low");
  assert.deepEqual(assessLinkRisk("Xem http://127.0.0.1/login").level, "medium");
  assert.equal(assessLinkRisk("javascript:alert(1)").blocked, true);
  assert.equal(assessLinkRisk("data:text/html,payload").blocked, true);
});

test("forum filtering combines status, tag and Vietnamese search", () => {
  const module = loadModule();
  const state = module._test.defaultState();
  assert.equal(module._test.filteredForumPosts(state, { status: "all" }).length, 2);
  assert.equal(module._test.filteredForumPosts(state, { status: "solved" }).length, 1);
  assert.equal(module._test.filteredForumPosts(state, { status: "open" }).length, 1);
  assert.equal(module._test.filteredForumPosts(state, { status: "guide" })[0].kind, "guide");
  assert.equal(module._test.filteredForumPosts(state, { tag: "Góp ý", query: "phòng" }).length, 1);
  assert.equal(module._test.filteredForumPosts(state, { query: "không tồn tại" }).length, 0);
});

test("audit helper only appends immutable records", () => {
  const module = loadModule();
  const state = module._test.defaultState();
  const first = module._test.appendAudit(state, { actorId: "owner", action: "channel.create", targetType: "channel", targetId: "ch-1", before: null, after: { name: "mới" } });
  const second = module._test.appendAudit(state, { actorId: "owner", action: "member.role", targetType: "member", targetId: "m-1", before: "member", after: "moderator" });
  assert.equal(state.audit.length, 2);
  assert.equal(state.audit[0].id, first.id);
  assert.equal(state.audit[1].id, second.id);
  assert.equal(Object.isFrozen(first), true);
  assert.notEqual(first.id, second.id);
});

test("source includes backend event adapters and local safety controls", () => {
  assert.match(source, /adapter\?\.emit/);
  assert.match(source, /hh:communication:channels:event/);
  assert.match(source, /hh:communication:channels:sync/);
  assert.match(source, /slowModeSeconds/);
  assert.match(source, /moderationQueue/);
  assert.match(source, /rateLog/);
  assert.doesNotMatch(source, /API[_-]?KEY\s*=/i);
});

test("styles cover focus, 375px layouts and reduced motion", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.hcf-workspace\s*\{[^}]*grid-template-columns/s);
});
