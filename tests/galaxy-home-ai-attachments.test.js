const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-home-ai.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "galaxy-home-ai.css"), "utf8");
const api = require("../galaxy-home-ai.js");

function memoryStorage(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, String(value)); }
  };
}

function textFile(name, type, text) {
  let reads = 0;
  return {
    name,
    type,
    size: Buffer.byteLength(text, "utf8"),
    async text() { reads += 1; return text; },
    get reads() { return reads; }
  };
}

test("AI Center offers bounded text-only attachments with accessible chips and status", () => {
  const markup = api.viewMarkup("/create/ai-center", api.collectLocalData(memoryStorage(), {}));
  assert.match(markup, /data-gha-ai-attachment-input/);
  assert.match(markup, /accept="\.txt,\.md,\.json,text\/plain,text\/markdown,application\/json"/);
  assert.match(markup, /data-gha-ai-attachment-list/);
  assert.match(markup, /data-gha-ai-attachment-status[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(markup, /Nội dung tệp chỉ được đọc khi bạn bấm Gửi/);
  assert.equal(api.AI_ATTACHMENT_CONFIG.maxFiles, 3);
  assert.equal(api.AI_ATTACHMENT_CONFIG.maxFileBytes, 128 * 1024);
  assert.equal(api.AI_ATTACHMENT_CONFIG.maxTotalBytes, 256 * 1024);
});

test("attachment metadata enforces extension, MIME, per-file and aggregate limits", () => {
  assert.equal(api.validateAttachmentMetadata({ name: "ghi-chu.txt", type: "text/plain", size: 42 }).valid, true);
  assert.equal(api.validateAttachmentMetadata({ name: "README.md", type: "text/markdown", size: 42 }).valid, true);
  assert.equal(api.validateAttachmentMetadata({ name: "du-lieu.json", type: "application/json", size: 42 }).valid, true);
  assert.equal(api.validateAttachmentMetadata({ name: "anh.png", type: "image/png", size: 42 }).valid, false);
  assert.equal(api.validateAttachmentMetadata({ name: "ghi-chu.txt", type: "application/octet-stream", size: 42 }).valid, false);
  assert.equal(api.validateAttachmentMetadata({ name: "lon.md", type: "text/plain", size: 129 * 1024 }).valid, false);
  const selected = [
    { name: "a.txt", size: 100 * 1024 },
    { name: "b.txt", size: 100 * 1024 },
    { name: "c.txt", size: 50 * 1024 }
  ];
  assert.equal(api.validateAttachmentMetadata({ name: "d.txt", type: "text/plain", size: 10 }, selected).valid, false);
});

test("file contents are read only by the explicit send-time reader", async () => {
  const file = textFile("ngu-canh.md", "text/markdown", "# Ngữ cảnh\nNội dung do người dùng chọn.");
  const metadata = api.validateAttachmentMetadata(file, []);
  assert.equal(metadata.valid, true);
  assert.equal(file.reads, 0, "metadata selection must not read file contents");

  const records = await api.readSelectedAttachments([file]);
  assert.equal(file.reads, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "ngu-canh.md");
  assert.equal(records[0].text, "# Ngữ cảnh\nNội dung do người dùng chọn.");
  assert.equal("file" in records[0], false, "persistable records must never retain File/Blob objects");
  assert.doesNotMatch(source, /readAsDataURL|FileReader|arrayBuffer\s*\(/);
});

test("binary, malformed JSON and likely secrets are rejected before persistence or handoff", async () => {
  assert.equal(api.sanitizeAttachmentText("abc\u0000def", { name: "bad.txt", extension: ".txt" }).valid, false);
  assert.equal(api.sanitizeAttachmentText("{not-json", { name: "bad.json", extension: ".json" }).valid, false);
  assert.equal(api.containsPotentialSecret("api_key = abcdefghijklmnopqrstuvwxyz"), true);
  assert.equal(api.containsPotentialSecret("api_key = your_key"), false);
  await assert.rejects(
    api.readSelectedAttachments([textFile("secret.txt", "text/plain", "client_secret=abcdefghijklmnopqrstuvwxyz")]),
    /secret|xác thực/i
  );
});

test("handoff composes bounded plain-text context without binary or base64 envelopes", () => {
  const prompt = api.composeAIHandoffPrompt("Hãy tóm tắt", [
    { name: "note.md", text: "A".repeat(5000) }
  ]);
  assert.match(prompt, /^Hãy tóm tắt/);
  assert.match(prompt, /note\.md/);
  assert.ok(prompt.length <= 4000);
  assert.ok(prompt.length <= "Hãy tóm tắt".length + api.AI_ATTACHMENT_CONFIG.maxContextCharacters + 3);
  assert.doesNotMatch(prompt, /data:[^;]+;base64|attachment\/octet-stream/i);
});

test("AI handoff fails closed when session storage cannot persist the request", () => {
  const payload = { prompt: "Nội dung", at: Date.now(), source: "galaxy-home", layer: "galaxy" };
  const written = new Map();
  assert.equal(api.storeAiHandoff({ setItem(key, value) { written.set(key, value); } }, payload), true);
  assert.equal(JSON.parse(written.get("hh.galaxy.ai.handoff.v1")).prompt, "Nội dung");
  assert.equal(api.storeAiHandoff({ setItem() { throw new Error("quota"); } }, payload), false);
  assert.equal(api.storeAiHandoff(null, payload), false);
  assert.equal(api.storeAiHandoff({ setItem() {} }, { ...payload, prompt: "x".repeat(13000) }), false);
});

test("attachment persistence falls back explicitly to bounded in-memory text storage", async () => {
  const result = await api.persistAttachmentRecords([{
    id: "record-1",
    name: "note.txt",
    extension: ".txt",
    mimeType: "text/plain",
    size: 4,
    text: "text",
    createdAt: "2026-09-02T00:00:00.000Z",
    binary: Buffer.from("must-not-be-copied")
  }], {});
  assert.equal(result.mode, "memory");
  assert.equal(result.saved, 1);
  assert.match(source, /maxStoredRecords/);
  assert.match(source, /maxStoredCharacters/);
});

test("adaptive experience respects user settings, OS reduced motion and low device capability", () => {
  const lowScope = { navigator: { deviceMemory: 2, hardwareConcurrency: 2, connection: { saveData: false } }, matchMedia: () => ({ matches: false }) };
  const low = api.resolveAdaptiveExperience(memoryStorage({
    [api.LAYER_ONE_STORAGE_KEY]: { settings: { effects: "balanced", reducedMotion: "off" } }
  }), lowScope);
  assert.equal(low.deviceTier, "low");
  assert.equal(low.requestedEffects, "balanced");
  assert.equal(low.motion, "quiet");
  assert.equal(low.reduced, false);

  const explicitQuiet = api.resolveAdaptiveExperience(memoryStorage(), {
    navigator: { deviceMemory: 16, hardwareConcurrency: 16 },
    matchMedia: () => ({ matches: false })
  }, { effects: "quiet", reducedMotion: "off" });
  assert.equal(explicitQuiet.deviceTier, "high");
  assert.equal(explicitQuiet.motion, "quiet");

  const systemReduced = api.resolveAdaptiveExperience(memoryStorage(), {
    navigator: { deviceMemory: 16, hardwareConcurrency: 16 },
    matchMedia: () => ({ matches: true })
  }, { effects: "rich", reducedMotion: "system" });
  assert.equal(systemReduced.reduced, true);
  assert.equal(systemReduced.motion, "quiet");
});

test("module-specific skeletons and adaptive CSS never downgrade typography", () => {
  assert.match(api.moduleSkeletonMarkup("/home"), /gha-module-skeleton--home/);
  assert.match(api.moduleSkeletonMarkup("/home/dashboard"), /gha-module-skeleton--dashboard/);
  assert.match(api.moduleSkeletonMarkup("/create/ai-center"), /gha-module-skeleton--ai/);
  assert.match(styles, /\.gha-module-skeleton--home/);
  assert.match(styles, /\.gha-module-skeleton--dashboard/);
  assert.match(styles, /\.gha-module-skeleton--ai/);
  assert.match(styles, /gha-skeleton-shimmer/);
  assert.match(styles, /data-gha-device-tier="low"/);
  assert.match(styles, /data-gha-motion="quiet"/);
  assert.match(styles, /data-gha-reduced-motion="true"/);
  assert.doesNotMatch(styles, /data-gha-device-tier="low"[^}]*font-size\s*:/);
});
