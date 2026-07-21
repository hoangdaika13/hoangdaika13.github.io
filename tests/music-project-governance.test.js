const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-project-governance.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-project-governance.css"), "utf8");
const STORAGE_KEY = "hh.music.project-governance.v1";

function createHost() {
  const listeners = {};
  return {
    innerHTML: "",
    listeners,
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector() { return null; },
    dispatchClick(action, dataset = {}) {
      const button = { dataset: { action, ...dataset } };
      listeners.click?.({ target: { closest: () => button } });
    }
  };
}

function createRuntime(saved = null, projectContext = null) {
  const values = new Map(saved ? [[STORAGE_KEY, JSON.stringify(saved)]] : []);
  const localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  const window = {
    localStorage,
    AbortController,
    Blob,
    URL,
    document: { createElement: () => ({ click() {} }) },
    setTimeout,
    clearTimeout,
    FormData,
    HHMusicProjectContext: projectContext || undefined
  };
  const context = { window, Intl, Date, Math, JSON, Object, Set, Promise, console };
  vm.runInNewContext(source, context, { filename: "music-project-governance.js" });
  return { api: window.HHMusicProjectGovernance, values, window };
}

test("exposes only the requested two-view lifecycle contract", () => {
  const { api } = createRuntime();
  assert.deepEqual(Object.keys(api).sort(), ["mount", "supports", "unmount"]);
  assert.equal(api.supports("project-branches"), true);
  assert.equal(api.supports("release-manager"), true);
  assert.equal(api.supports("publish"), false);
  assert.equal(api.supports(""), false);
});

test("project workspace provides branches, snapshots, review, roles, locks and normalized compare metadata", () => {
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "project-branches" });
  for (const token of [
    "Radio Mix", "Acoustic", "TikTok", "Snapshot không phá hủy", "So sánh phiên bản",
    "TIMECODE REVIEW", "Bình luận theo thời điểm", "Thành viên", "Khóa track", "Nhật ký thay đổi",
    "Integrated LUFS", "Gain nghe thử", "Peak dự kiến", "metadata loudness-normalized"
  ]) assert.ok(host.innerHTML.includes(token), `missing project contract: ${token}`);
  assert.match(host.innerHTML, /role="tablist"/);
  assert.match(host.innerHTML, /data-mode="local-only"/);
  assert.match(host.innerHTML, /Chưa có realtime adapter/);
  api.unmount();
  assert.equal(host.innerHTML, "");
});

test("snapshots attach sanitized HHMusicProjectContext data without restoring automatically", async () => {
  const calls = { chord: [], dna: [] };
  const projectContext = {
    getSnapshot() {
      return {
        chordTrack: [{ beat: 0, chord: "Cm" }, { beat: 4, chord: "Ab" }],
        songDNA: { motif: "C-Eb-G", palette: ["felt piano", "warm bass"] },
        accessToken: "must-not-persist",
        nested: { privateKey: "must-not-persist-either" }
      };
    },
    updateChordTrack(value) { calls.chord.push(value); },
    updateSongDNA(value) { calls.dna.push(value); }
  };
  const { api, values } = createRuntime(null, projectContext);
  const host = createHost();
  api.mount(host, { view: "project-branches" });

  host.dispatchClick("create-snapshot");
  assert.equal(calls.chord.length, 0, "creating a snapshot must never restore chord data");
  assert.equal(calls.dna.length, 0, "creating a snapshot must never restore song DNA");

  const saved = JSON.parse(values.get(STORAGE_KEY));
  const branch = saved.branches.find((item) => item.id === saved.selectedBranchId);
  const snapshot = branch.snapshots[0];
  assert.equal(snapshot.projectContext.source, "HHMusicProjectContext");
  assert.deepEqual(snapshot.projectContext.data.chordTrack[0], { beat: 0, chord: "Cm" });
  assert.equal(snapshot.projectContext.data.accessToken, undefined);
  assert.equal(snapshot.projectContext.data.nested.privateKey, undefined);

  host.dispatchClick("request-restore", { id: snapshot.id });
  assert.match(host.innerHTML, /role="alertdialog" aria-modal="true"/);
  assert.match(host.innerHTML, /Xác nhận phục hồi/);
  assert.equal(calls.chord.length, 0, "opening confirmation must not mutate Project Context");
  assert.equal(calls.dna.length, 0, "opening confirmation must not mutate Project Context");

  host.dispatchClick("confirm-restore");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.chord.length, 1);
  assert.equal(calls.dna.length, 1);
  assert.deepEqual(calls.chord[0][1], { beat: 4, chord: "Ab" });
  assert.equal(calls.dna[0].motif, "C-Eb-G");
  api.unmount();
});

test("restore is strictly limited to updateChordTrack and updateSongDNA", () => {
  assert.match(source, /context\.updateChordTrack\(clone\(data\.chordTrack\)\)/);
  assert.match(source, /context\.updateSongDNA\(clone\(data\.songDNA\)\)/);
  assert.match(source, /data-action="request-restore"/);
  assert.match(source, /data-action="confirm-restore"/);
  assert.match(source, /pendingRestoreId/);
  assert.doesNotMatch(source, /HHMusicProjectContext\.(?:setState|restore|importProject|replaceProject)/);
});

test("release workspace contains complete rights ledger, split validation and publish gate", () => {
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "release-manager" });
  for (const token of [
    "Thông tin bản phát hành", "ISRC", "Tác giả & split", "Tài sản & nguồn gốc",
    "Provider / model", "Prompt / mô tả tạo", "Consent", "Bằng chứng",
    "Cổng phát hành", "Xác nhận bắt buộc", "PROVENANCE", "Xuất JSON", "Nhập JSON"
  ]) assert.ok(host.innerHTML.includes(token), `missing release contract: ${token}`);
  assert.match(host.innerHTML, /data-action="open-publish-gate" disabled/);
  assert.match(host.innerHTML, /Tổng split bằng 100%/);
  assert.match(host.innerHTML, /ISRC gồm 12 ký tự hợp lệ/);
  assert.match(host.innerHTML, /không tự phân phối nhạc/i);
  api.unmount();
});

test("release preflight validates rights, AI lineage, voice consent and ownership totals", () => {
  for (const contract of [
    /\^\[A-Z\]\{2\}\[A-Z0-9\]\{3\}\\d\{7\}\$/,
    /Math\.abs\(splitTotal - 100\) < 0\.01/,
    /asset\.name && asset\.source && asset\.license && asset\.owner/,
    /asset\.provider && asset\.prompt/,
    /asset\.type === "voice"/,
    /acknowledgements\.rights/,
    /acknowledgements\.consent/,
    /acknowledgements\.metadata/,
    /acknowledgements\.restricted/
  ]) assert.match(source, contract);
  assert.match(source, /hh-music-provenance-manifest/);
  assert.match(source, /MANIFEST_VERSION = 1/);
  assert.match(source, /normalizeRelease\(parsed\.release \|\| \{\}\)/);
});

test("storage is versioned, bounded and realtime capability is represented truthfully", () => {
  assert.match(source, /hh\.music\.project-governance\.v1/);
  assert.match(source, /version: STATE_VERSION/);
  assert.match(source, /slice\(0, 400\)/);
  assert.match(source, /slice\(0, 500\)/);
  assert.match(source, /mode: "local-only"/);
  assert.match(source, /adapter\.connected === true/);
  assert.match(source, /typeof adapter\.publish !== "function"/);
  assert.match(source, /typeof adapter\.subscribe !== "function"/);
  assert.doesNotMatch(source, /password\s*:/i);
  assert.doesNotMatch(source, /clientSecret\s*:/i);
  assert.doesNotMatch(source, /refreshToken\s*:/i);
});

test("saved user content is escaped before entering markup", () => {
  const saved = {
    version: 1,
    selectedBranchId: "unsafe",
    branches: [{
      id: "unsafe",
      name: "<img src=x onerror=boom>",
      purpose: "<script>alert(1)</script>",
      comments: [{ body: "<svg onload=boom>", author: "<b>bad</b>" }],
      members: [{ name: "<iframe src=x>", role: "view" }]
    }],
    release: { title: "<img src=x>", artist: "<script>x</script>" }
  };
  const { api } = createRuntime(saved);
  const host = createHost();
  api.mount(host, { view: "project-branches" });
  assert.doesNotMatch(host.innerHTML, /<img src=x|<script>|<svg onload|<iframe/);
  assert.match(host.innerHTML, /&lt;img src=x onerror=boom&gt;/);
  assert.match(host.innerHTML, /&lt;svg onload=boom&gt;/);
  api.unmount();
});

test("responsive and accessibility styles cover keyboard focus, mobile and reduced motion", () => {
  for (const token of [
    ":focus-visible", "@media (max-width: 420px)", "@media (max-width: 720px)",
    "@media (prefers-reduced-motion: reduce)", "min-width: 0", "overflow-x: auto",
    ".mpg-dialog", ".mpg-tabs", ".mpg-table-wrap"
  ]) assert.ok(css.includes(token), `missing style contract: ${token}`);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /aria-selected/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-labelledby="mpg-restore-title"/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
