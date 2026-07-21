const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-publishing-rights.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-publishing-rights.css"), "utf8");

function createRuntime(saved = null) {
  const values = new Map(saved ? [["hh.music.publishing-rights.v1", JSON.stringify(saved)]] : []);
  const localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  const window = {};
  const context = {
    window,
    localStorage,
    Intl,
    Date,
    Math,
    JSON,
    Blob,
    URL,
    AbortController,
    structuredClone,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => callback(),
    document: { createElement: () => ({ click() {} }) }
  };
  vm.runInNewContext(source, context, { filename: "music-publishing-rights.js" });
  return { api: window.HHMusicPublishingRights, values };
}

function hostStub() {
  return {
    innerHTML: "",
    addEventListener() {},
    querySelector() { return null; }
  };
}

test("module exposes the requested two-view lifecycle API", () => {
  const { api } = createRuntime();
  assert.deepEqual(Object.keys(api).sort(), ["mount", "supports", "unmount"]);
  assert.equal(api.supports("publish"), true);
  assert.equal(api.supports("rights"), true);
  assert.equal(api.supports("youtube-password"), false);
});

test("publish workspace renders queue, validation, scheduling and truthful OAuth handoff", () => {
  const { api } = createRuntime();
  const host = hostStub();
  api.mount(host, { view: "publish" });
  for (const token of [
    "data-mpr-publish-field=\"title\"", "data-mpr-publish-field=\"playlist\"",
    "data-mpr-file=\"thumbnail\"", "data-mpr-file=\"caption\"", "data-mpr-publish-field=\"scheduleAt\"",
    "Hàng đợi xuất bản", "Exponential backoff", "Mở YouTube Publisher", "Google OAuth",
    "Không nhập, không nhận và không lưu mật khẩu Google"
  ]) assert.ok(host.innerHTML.includes(token), `publish markup missing ${token}`);
  assert.match(host.innerHTML, /role="tablist"/);
  assert.match(host.innerHTML, /role="status" aria-live="polite"/);
  assert.doesNotMatch(host.innerHTML, /type="password"/i);
  api.unmount();
});

test("publisher integration delegates to existing HHYouTubePublisher only after launch", () => {
  assert.match(source, /window\.HHYouTubePublisher\?\.mount/);
  assert.match(source, /window\.HHYouTubePublisher\.mount\(publisherHost/);
  assert.match(source, /window\.HHYouTubePublisher\?\.unmount/);
  assert.match(source, /publisherOpen/);
  assert.match(source, /resumable upload/i);
  assert.match(source, /Publisher sẽ xác nhận upload thật/);
});

test("rights workspace includes complete asset ledger and non-fake provenance states", () => {
  const { api } = createRuntime();
  const host = hostStub();
  api.mount(host, { view: "rights" });
  for (const field of ["source", "creator", "license", "proof", "provider", "prompt", "consent", "territory", "expiry", "synthIdStatus", "c2paStatus"]) {
    assert.ok(host.innerHTML.includes(`data-mpr-rights-field="${field}"`), `rights field missing ${field}`);
  }
  for (const token of [
    "PROVENANCE LEDGER", "Provider lineage", "Kiểm tra trước xuất bản", "Nội dung giả mạo",
    "Provider khai báo", "Ghi nhận từ công cụ ngoài", "HH không tự xác minh SynthID hoặc C2PA"
  ]) assert.ok(host.innerHTML.includes(token), `rights markup missing ${token}`);
  api.unmount();
});

test("stored and imported data is versioned, bounded and contains no credential fields", () => {
  assert.match(source, /hh\.music\.publishing-rights\.v1/);
  assert.match(source, /hh-music-rights-manifest/);
  assert.match(source, /slice\(0, 500\)/);
  assert.match(source, /JSON\.parse\(await file\.text\(\)\)/);
  assert.match(source, /downloadJson\("hh-music-rights-manifest\.json"/);
  assert.doesNotMatch(source, /clientSecret\s*:/);
  assert.doesNotMatch(source, /refreshToken\s*:/);
  assert.doesNotMatch(source, /password\s*:/i);
  assert.doesNotMatch(source, /privateMessage\s*:/i);
});

test("rights preflight blocks incomplete, expired and unacknowledged releases", () => {
  for (const token of [
    "Có ít nhất một tài sản trong sổ quyền", "thiếu ${label}", "giấy phép còn hiệu lực",
    "Đã xác nhận quyền sở hữu hoặc quyền sử dụng", "Đã kiểm tra nội dung bị cấm và giả mạo",
    "blockingIssues", "completenessScore"
  ]) assert.ok(source.includes(token), `preflight logic missing ${token}`);
  assert.match(source, /assetScore\(asset\)/);
  assert.match(source, /rightsRequirements\(asset\)/);
  assert.match(source, /rightsPreflight\(\)/);
});

test("destructive actions require the custom confirmation dialog", () => {
  assert.match(source, /role="alertdialog" aria-modal="true"/);
  assert.match(source, /confirm-reset-publish/);
  assert.match(source, /confirm-reset-rights/);
  assert.match(source, /confirm-remove-queue/);
  assert.match(source, /confirm-remove-asset/);
  assert.match(source, /execute-confirm/);
});

test("responsive and accessibility contract covers 375px and reduced motion", () => {
  for (const token of [
    "@media (max-width: 420px)", "@media (max-width: 680px)", "@media (prefers-reduced-motion: reduce)",
    ":focus-visible", "min-width: 0", ".mpr-table-wrap", ".mpr-dialog", ".mpr-tabs"
  ]) assert.ok(css.includes(token), `CSS missing ${token}`);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /aria-selected/);
  assert.match(source, /aria-labelledby/);
});

test("user content is escaped before rendering", () => {
  const { api } = createRuntime({
    publishDraft: { title: "<img src=x onerror=boom>" },
    queue: [{ title: "<script>alert(1)</script>", metadata: { title: "bad", videoName: "clip.mp4" } }],
    assets: [{ name: "<svg onload=boom>", source: "x", creator: "HH", license: "owned", proof: "receipt" }]
  });
  const publishHost = hostStub();
  api.mount(publishHost, { view: "publish" });
  assert.doesNotMatch(publishHost.innerHTML, /<script>|<img src=x/);
  assert.match(publishHost.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  const rightsHost = hostStub();
  api.mount(rightsHost, { view: "rights" });
  assert.doesNotMatch(rightsHost.innerHTML, /<svg onload/);
  assert.match(rightsHost.innerHTML, /&lt;svg onload=boom&gt;/);
  api.unmount();
});
