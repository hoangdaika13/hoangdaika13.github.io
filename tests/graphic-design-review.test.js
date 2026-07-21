const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

const sourcePath = path.resolve(__dirname, "..", "graphic-design-review.js");
const source = fs.readFileSync(sourcePath, "utf8");
const reviewApi = require(sourcePath);

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function createReview(store, actor = { id: "owner-1", name: "An <Owner>" }) {
  return store.createReview({
    title: "KV <script>alert(1)</script>",
    actor,
    before: {
      label: "Before",
      data: {
        canvas: { width: 1200, height: 675, background: "#ffffff" },
        layers: [{ id: "headline", text: "Old", x: 0.1, y: 0.2, width: 0.4, height: 0.1 }]
      }
    },
    after: {
      label: "After",
      data: {
        canvas: { width: 1200, height: 675, background: "#ffffff" },
        layers: [
          { id: "headline", text: "New", x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
          { id: "cta", text: "Go", x: 0.1, y: 0.7, width: 0.2, height: 0.08 }
        ]
      }
    }
  });
}

test("exposes a standalone UMD/global HHGraphicReview API", () => {
  assert.equal(reviewApi.VERSION, 1);
  assert.equal(reviewApi.STORAGE_KEY, "hh.graphic-review.v1");
  assert.equal(reviewApi.FORMAT, "hh-graphic-review-report");
  assert.deepEqual(reviewApi.STATUSES, ["draft", "review", "approved", "published"]);
  assert.equal(typeof reviewApi.createStore, "function");
  assert.equal(typeof reviewApi.mount, "function");
  assert.equal(typeof reviewApi.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicReview = api/);
});

test("stores a versioned local-first envelope without sharing mutable references", () => {
  const storage = createMemoryStorage();
  const store = reviewApi.createStore({ storage, crypto: webcrypto });
  const created = createReview(store);
  created.title = "Changed outside";
  created.snapshots.after.data.layers[0].text = "Mutated";

  const saved = store.getReview(created.id);
  assert.equal(saved.title, "KV <script>alert(1)</script>");
  assert.equal(saved.snapshots.after.data.layers[0].text, "New");
  assert.deepEqual(store.getPersistence(), { type: "localStorage", key: reviewApi.STORAGE_KEY, version: 1, error: "" });

  const envelope = JSON.parse(storage.value(reviewApi.STORAGE_KEY));
  assert.equal(envelope.version, 1);
  assert.equal(envelope.reviews.length, 1);
  assert.ok(Array.isArray(envelope.shareLinks));

  const reopened = reviewApi.createStore({ storage, crypto: webcrypto });
  assert.equal(reopened.getReview(created.id).snapshots.before.label, "Before");
});

test("normalizes pinned coordinates from direct values and pointer geometry", () => {
  assert.deepEqual(reviewApi.normalizePoint({ x: -8, y: 4 }), { x: 0, y: 1 });
  assert.deepEqual(reviewApi.normalizePoint({ x: 0.123456789, y: 0.5 }), { x: 0.123457, y: 0.5 });
  const node = { getBoundingClientRect: () => ({ left: 20, top: 10, width: 200, height: 100 }) };
  assert.deepEqual(reviewApi.positionFromEvent({ clientX: 120, clientY: 60 }, node), { x: 0.5, y: 0.5 });
  assert.deepEqual(reviewApi.positionFromEvent({ clientX: -500, clientY: 900 }, node), { x: 0, y: 1 });
});

test("produces deterministic path-level diffs for objects and arrays", () => {
  const changes = reviewApi.diffData(
    { title: "A", meta: { width: 100 }, layers: [{ id: "a", fill: "red" }] },
    { title: "B", meta: { width: 100, height: 200 }, layers: [{ id: "a", fill: "blue" }, { id: "b" }] }
  );
  assert.deepEqual(changes.map((item) => [item.path, item.type]), [
    ["$.layers[0].fill", "changed"],
    ["$.layers[1]", "added"],
    ["$.meta.height", "added"],
    ["$.title", "changed"]
  ]);
  changes[0].after = "mutated";
  assert.equal(reviewApi.diffData({ a: 1 }, { a: 2 })[0].after, 2);
});

test("supports pinned threads, replies, resolve/reopen and append-only audit sequencing", () => {
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const created = createReview(store);
  const thread = store.addThread(created.id, { x: 2, y: -1, body: "  Fix <b>headline</b>  " }, { id: "reviewer", name: "Reviewer" });
  assert.equal(thread.x, 1);
  assert.equal(thread.y, 0);
  assert.equal(thread.body, "Fix <b>headline</b>");

  const reply = store.addReply(created.id, thread.id, { body: "Đã sửa <img src=x>" }, { id: "designer", name: "Designer" });
  assert.match(reply.id, /^reply-/);
  assert.equal(store.resolveThread(created.id, thread.id, true, { id: "reviewer", name: "Reviewer" }).resolved, true);
  assert.equal(store.resolveThread(created.id, thread.id, false, { id: "reviewer", name: "Reviewer" }).resolved, false);

  const saved = store.getReview(created.id);
  assert.equal(saved.threads[0].replies.length, 1);
  assert.deepEqual(saved.activity.map((entry) => entry.sequence), [1, 2, 3, 4, 5]);
  assert.equal(saved.activity[0].previousId, null);
  assert.equal(saved.activity[4].previousId, saved.activity[3].id);
  assert.throws(() => store.addReply(created.id, "missing", { body: "x" }), { code: "THREAD_NOT_FOUND" });
  assert.throws(() => store.addThread(created.id, { x: 0.5, y: 0.5, body: "   " }), { code: "COMMENT_REQUIRED" });
});

test("enforces only valid Draft, Review, Approved and Published transitions", () => {
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const created = createReview(store);
  assert.equal(reviewApi.canTransition("draft", "review"), true);
  assert.equal(reviewApi.canTransition("draft", "approved"), false);
  assert.throws(() => store.transition(created.id, "approved"), { code: "INVALID_TRANSITION" });
  assert.equal(store.transition(created.id, "review").status, "review");
  assert.equal(store.transition(created.id, "draft").status, "draft");
  assert.equal(store.transition(created.id, "review").status, "review");
  assert.equal(store.transition(created.id, "approved").status, "approved");
  assert.equal(store.transition(created.id, "review").status, "review");
  assert.equal(store.transition(created.id, "approved").status, "approved");
  assert.equal(store.transition(created.id, "published").status, "published");
  assert.throws(() => store.transition(created.id, "draft"), { code: "INVALID_TRANSITION" });
  assert.throws(() => store.updateSnapshots(created.id, { before: {}, after: {} }), { code: "REVIEW_LOCKED" });
});

test("updates before/after snapshots and returns data diff", () => {
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const created = createReview(store);
  const result = store.updateSnapshots(created.id, {
    before: { label: "A", data: { canvas: { width: 100 }, title: "One" } },
    after: { label: "B", data: { canvas: { width: 200 }, title: "Two" } }
  }, { id: "designer", name: "Designer" });
  assert.ok(result.changes.some((item) => item.path === "$.canvas.width" && item.before === 100 && item.after === 200));
  assert.ok(store.compareSnapshots(created.id).some((item) => item.path === "$.title"));
  assert.equal(store.getReview(created.id).activity.at(-1).type, "snapshots.updated");
});

test("hashes share passwords with Web Crypto and never stores plaintext", async () => {
  const storage = createMemoryStorage();
  const store = reviewApi.createStore({ storage, crypto: webcrypto });
  const created = createReview(store);
  const plaintext = "Correct Horse Battery Staple!";
  const link = await store.createShareLink(created.id, {
    password: plaintext,
    expiresAt: "2030-01-01T00:00:00.000Z",
    baseUrl: "https://local.example/review",
    permissions: { view: true, comment: true, download: false }
  }, { id: "owner", name: "Owner" });

  assert.equal(link.passwordHash.algorithm, "PBKDF2-SHA-256");
  assert.equal(link.passwordHash.iterations, 120000);
  assert.notEqual(link.passwordHash.hash, plaintext);
  assert.equal(link.url.includes(plaintext), false);
  assert.equal(storage.value(reviewApi.STORAGE_KEY).includes(plaintext), false);
  assert.equal(await reviewApi.verifyPassword(plaintext, link.passwordHash, webcrypto), true);
  assert.equal(await reviewApi.verifyPassword("wrong", link.passwordHash, webcrypto), false);

  const access = await store.accessShareLink(link.token, { password: plaintext, permission: "comment", actor: { id: "guest", name: "Guest" } });
  assert.equal(access.permission, "comment");
  await assert.rejects(() => store.accessShareLink(link.token, { password: plaintext, permission: "download" }), { code: "PERMISSION_DENIED" });
  await assert.rejects(() => store.accessShareLink(link.token, { password: "wrong", permission: "view" }), { code: "INVALID_PASSWORD" });
});

test("enforces expiry, revocation and truthful crypto fallback for local links", async () => {
  let time = Date.parse("2026-07-20T12:00:00.000Z");
  const now = () => new Date(time);
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto, now });
  const created = createReview(store);
  const expiring = await store.createShareLink(created.id, { expiresAt: "2026-07-20T13:00:00.000Z" });
  time = Date.parse("2026-07-20T14:00:00.000Z");
  await assert.rejects(() => store.accessShareLink(expiring.token, { permission: "view" }), { code: "SHARE_EXPIRED" });

  time = Date.parse("2026-07-20T12:00:00.000Z");
  const active = await store.createShareLink(created.id, {});
  const revoked = store.revokeShareLink(active.id, { id: "owner", name: "Owner" });
  assert.ok(revoked.revokedAt);
  await assert.rejects(() => store.accessShareLink(active.token, { permission: "view" }), { code: "SHARE_REVOKED" });

  const unsupported = reviewApi.createStore({ storage: null, crypto: null, now });
  const localReview = createReview(unsupported);
  await assert.rejects(() => unsupported.createShareLink(localReview.id, { password: "secret" }), { code: "WEB_CRYPTO_UNSUPPORTED" });
  const unprotected = await unsupported.createShareLink(localReview.id, {});
  assert.equal(unprotected.passwordHash, null);
  assert.equal(unprotected.scope, "local-browser-profile");
});

test("exports escaped HTML and structured JSON review reports", () => {
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const created = createReview(store);
  store.addThread(created.id, { x: 0.4, y: 0.6, body: "<script>window.bad=true</script>" }, { id: "reviewer", name: "<b>Reviewer</b>" });
  const html = store.exportReport(created.id, "html");
  assert.match(html, /<!doctype html>/);
  assert.match(html, /&lt;script&gt;window\.bad=true&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>window\.bad=true<\/script>/);
  assert.match(html, /Diff dữ liệu/);

  const json = JSON.parse(store.exportReport(created.id, "json"));
  assert.equal(json.format, reviewApi.FORMAT);
  assert.equal(json.version, 1);
  assert.equal(json.summary.threads, 1);
  assert.ok(json.changes.length > 0);
});

test("renders a deterministic Canvas preview and reports unsupported contexts honestly", () => {
  const calls = [];
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
    setTransform(...args) { calls.push(["setTransform", ...args]); },
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(...args) { calls.push(["fillText", ...args]); }
  };
  const canvas = { width: 0, height: 0, clientWidth: 0, clientHeight: 0, style: {}, getContext: () => context };
  const snapshot = { data: { canvas: { width: 100, height: 50 }, layers: [{ name: "Layer", x: 10, y: 5, width: 40, height: 10, fill: "#ff0000" }] } };
  const preview = reviewApi.renderSnapshotPreview(canvas, snapshot, { width: 300, height: 180, pixelRatio: 1 });
  assert.equal(preview.supported, true);
  assert.equal(canvas.width, 300);
  assert.ok(calls.some((call) => call[0] === "fillText"));

  const diff = reviewApi.renderDiffPreview(canvas, { data: { value: 1 } }, { data: { value: 2 } }, { width: 300, height: 180, pixelRatio: 1 });
  assert.equal(diff.supported, true);
  assert.deepEqual(diff.changes.map((item) => item.path), ["$.value"]);
  assert.deepEqual(reviewApi.renderSnapshotPreview({ getContext: () => null }, snapshot), { supported: false, reason: "Canvas 2D không khả dụng trên thiết bị này." });
});

test("workspace contract is escaped, keyboard-operable, reduced-motion and 375px ready", () => {
  for (const token of [
    "data-hh-graphic-review", "data-hgr-canvas", "data-hgr-comment-form", "data-hgr-reply-form",
    "data-hgr-diff-canvas", "data-hgr-share-form", "data-hgr-revoke", "role=\"tablist\"",
    "aria-live=\"polite\"", "ArrowLeft", "ArrowRight", "Escape", "focus-visible",
    "@media(max-width:420px)", "prefers-reduced-motion:reduce", "local-browser-profile",
    "Web Crypto/PBKDF2 không khả dụng", "Canvas 2D không khả dụng"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https:\/\/cdn|service[_-]?role|api[_-]?secret/i);
  assert.match(source, /escapeHtml\(thread\.body\)/);
  assert.match(source, /type="password"/);
  assert.match(source, /passwordHash/);
});

test("supports frame and timeline pins plus role capabilities", () => {
  assert.equal(reviewApi.canRole("viewer", "comment"), false);
  assert.equal(reviewApi.canRole("commenter", "comment"), true);
  assert.equal(reviewApi.canRole("editor", "edit"), true);
  assert.equal(reviewApi.canRole("owner", "publish"), true);
  assert.deepEqual(reviewApi.normalizeCommentTarget({ frameId: "hero", x: 1.5, y: -1 }), { kind: "frame", frameId: "hero", x: 1, y: 0 });
  assert.deepEqual(reviewApi.normalizeCommentTarget({ kind: "timeline", sequenceId: "main", timeMs: 1250.4 }), { kind: "timeline", sequenceId: "main", timeMs: 1250 });

  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const review = createReview(store);
  const frame = store.addThread(review.id, { frameId: "hero", x: 0.2, y: 0.4, body: "Sửa frame" });
  const timeline = store.addThread(review.id, { kind: "timeline", sequenceId: "main", timeMs: 4200, body: "Sửa cut" });
  assert.equal(frame.target.kind, "frame");
  assert.equal(timeline.target.kind, "timeline");
  assert.equal(timeline.target.timeMs, 4200);
});

test("creates immutable version snapshots and compares any two versions", () => {
  const store = reviewApi.createStore({ storage: null, crypto: webcrypto });
  const review = createReview(store);
  const first = store.getReview(review.id).versions[0];
  const second = store.addVersion(review.id, { label: "V2", data: { canvas: { width: 900 }, title: "V2" } }, { id: "editor", name: "Editor" });
  const comparison = store.compareVersions(review.id, first.id, second.id);
  assert.equal(comparison.before.id, first.id);
  assert.ok(comparison.changes.some((change) => change.path === "$.title"));
  const roles = store.setParticipantRole(review.id, { id: "guest", name: "Guest <script>" }, "commenter", { id: "owner", role: "owner" });
  assert.equal(roles.find((item) => item.id === "guest").role, "commenter");
  assert.throws(() => store.compareVersions(review.id, "missing", second.id), { code: "VERSION_NOT_FOUND" });
});
