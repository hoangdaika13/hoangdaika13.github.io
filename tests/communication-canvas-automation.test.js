const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "communication-canvas-automation.js");
const cssPath = path.join(root, "communication-canvas-automation.css");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const canvasAutomation = require(sourcePath);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function deterministicStore(storage = memoryStorage()) {
  let tick = 0;
  return canvasAutomation.createStore({
    storage,
    now: () => new Date(Date.UTC(2026, 6, 21, 10, 0, tick++)).toISOString(),
    idFactory: (prefix) => `${prefix}-${++tick}`
  });
}

test("exposes a small global mount API and versioned persistence contract", () => {
  assert.equal(canvasAutomation.VERSION, 1);
  assert.equal(canvasAutomation.STORAGE_KEY, "hh.communication.canvas.v1");
  assert.deepEqual(canvasAutomation.SUPPORTED_VIEWS, ["shared-canvas", "automation", "hh-spaces"]);
  for (const method of ["createStore", "normalizeState", "parseSlashCommand", "evaluateRules", "buildLocalDraft", "buildSmartDraft", "render", "mount", "unmount"]) {
    assert.equal(typeof canvasAutomation[method], "function", method);
  }
  assert.match(source, /globalScope\.HHCommunicationCanvasAutomation = api/);
  assert.throws(() => canvasAutomation.mount(null), /root DOM hợp lệ/);
});

test("Shared Canvas persists notes, checklist, decisions, assignees and safe file metadata", () => {
  const storage = memoryStorage();
  const store = deterministicStore(storage);
  const person = store.addAssignee("Huy Hoàng", "Biên tập");
  const note = store.addCanvasItem("note", { title: "Brief", body: "Nội dung chiến dịch", assigneeId: person.id });
  const checklist = store.addCanvasItem("checklist", { title: "Duyệt ảnh" });
  const decision = store.addCanvasItem("decision", { title: "Chọn phương án A", status: "proposed" });
  const file = store.addFileMetadata({
    name: "storyboard.png",
    type: "image/png",
    size: 4096,
    lastModified: 123,
    arrayBuffer: () => { throw new Error("must not read file bytes"); },
    dataUrl: "data:image/png;base64,secret"
  });

  store.updateItem(checklist.id, { completed: true });
  store.updateItem(decision.id, { status: "accepted" });
  store.selectItem(note.id);
  const draft = store.selectedDraft("task");
  assert.equal(draft.title, "Brief");
  assert.equal(draft.target, "task");
  assert.equal(draft.source, "shared-canvas");

  const state = JSON.parse(storage.value(canvasAutomation.STORAGE_KEY));
  assert.equal(state.version, 1);
  const items = state.canvas.spaces[0].items;
  assert.equal(items.find((item) => item.id === checklist.id).completed, true);
  assert.equal(items.find((item) => item.id === decision.id).status, "accepted");
  assert.deepEqual(items.find((item) => item.id === file.id).file, {
    name: "storyboard.png", type: "image/png", size: 4096, lastModified: 123
  });
  assert.doesNotMatch(storage.value(canvasAutomation.STORAGE_KEY), /data:image|arrayBuffer|secret/);
  assert.equal(store.getPersistence().type, "localStorage");
});

test("slash commands require content and automation rules are disabled by default", () => {
  assert.deepEqual(canvasAutomation.parseSlashCommand("/task Hoàn thiện thumbnail"), {
    valid: true,
    type: "task",
    payload: "Hoàn thiện thumbnail",
    label: "Tạo công việc: Hoàn thiện thumbnail"
  });
  assert.equal(canvasAutomation.parseSlashCommand("/meeting").valid, false);
  assert.equal(canvasAutomation.parseSlashCommand("/unknown test").valid, false);

  const store = deterministicStore();
  assert.equal(store.getState().automation.rules[0].enabled, false);
  const rule = store.addRule({ name: "Từ hội thoại", trigger: "#task", action: "task", enabled: true });
  assert.equal(store.getState().automation.rules.find((item) => item.id === rule.id).enabled, false);
  store.toggleRule(rule.id, true);
  assert.equal(store.getState().automation.rules.find((item) => item.id === rule.id).enabled, true);
  const matches = canvasAutomation.evaluateRules(store.getState().automation.rules, "Bình luận #task hoàn thiện bản mix");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].type, "task");
  assert.equal(canvasAutomation.evaluateRules(store.getState().automation.rules, "Tin nhắn thường").length, 0);
  store.setPreview({ type: "task", label: "Tạo công việc", payload: "Duyệt mix" });
  store.logAutomation("Tạo công việc: Duyệt mix", "executed");
  assert.equal(store.getState().automation.logs.at(-1).status, "executed");
});

test("Context Capsule and Smart Catch-up are truthfully labeled local without a server adapter", async () => {
  const summary = canvasAutomation.buildLocalDraft("Đã thống nhất concept A. #task Hoàn thiện ảnh bìa. Hẹn review ngày mai.", "summary");
  const tasks = canvasAutomation.buildLocalDraft("#task Hoàn thiện ảnh bìa\nCần gửi trước 17 giờ", "task");
  assert.equal(summary.sourceLabel, "Tóm tắt cục bộ");
  assert.match(summary.body, /concept A/);
  assert.equal(tasks.sourceLabel, "Tóm tắt cục bộ");
  assert.match(tasks.body, /\[ \]/);

  const fallback = await canvasAutomation.buildSmartDraft("Tin nhắn cần tóm tắt.", "summary", {
    summarize: async () => { throw new Error("offline"); }
  });
  assert.equal(fallback.sourceLabel, "Tóm tắt cục bộ");

  const server = await canvasAutomation.buildSmartDraft("Tin nhắn", "wiki", {
    summarize: async () => ({ title: "Wiki máy chủ", body: "Nội dung đã xử lý", sourceLabel: "AI máy chủ HH" })
  });
  assert.equal(server.sourceLabel, "AI máy chủ HH");
  assert.equal(server.body, "Nội dung đã xử lý");
});

test("HH Spaces stores work presence, Creative Room time comments and Focus Circles", () => {
  const store = deterministicStore();
  store.setPresence("mixing");
  const playback = store.updatePlayback({ sourceUrl: "https://example.com/demo.mp4", playing: true, currentTime: 42 });
  const comment = store.addTimestampComment("Giảm nhạc ở đoạn này", 42, "Hoàng");
  const circle = store.addCircle({ name: "Nhóm Video", focus: "Xuất bản tập 1", members: ["An", "Bình", "An"] });
  const capsule = store.addCapsule(canvasAutomation.buildLocalDraft("Tóm tắt cuộc họp.", "summary"), "capsules");
  const catchUp = store.addCapsule(canvasAutomation.buildLocalDraft("Bỏ lỡ ba tin nhắn.", "summary"), "catchUps");

  assert.equal(store.getState().hhSpaces.presence, "mixing");
  assert.equal(playback.playing, true);
  assert.equal(store.getActiveRoom().sourceUrl, "https://example.com/demo.mp4");
  assert.equal(comment.timestamp, 42);
  assert.deepEqual(circle.members, ["An", "Bình"]);
  assert.equal(capsule.sourceLabel, "Tóm tắt cục bộ");
  assert.equal(catchUp.sourceLabel, "Tóm tắt cục bộ");
});

test("rendered workspaces expose real controls, escaped content and truthful labels", () => {
  const store = deterministicStore();
  store.addCanvasItem("note", { title: "<img src=x onerror=alert(1)>", body: "Safe" });
  const persistence = store.getPersistence();
  const canvasHtml = canvasAutomation.render("shared-canvas", store.getState(), persistence);
  const automationHtml = canvasAutomation.render("automation", store.getState(), persistence);
  const spacesHtml = canvasAutomation.render("hh-spaces", store.getState(), persistence);

  assert.match(canvasHtml, /Canvas dùng chung/);
  assert.match(canvasHtml, /data-hcca-convert="task"/);
  assert.match(canvasHtml, /data-hcca-file-input/);
  assert.match(canvasHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(canvasHtml, /<img src=x/);
  assert.match(automationHtml, /SAFE DEFAULT/);
  assert.match(automationHtml, /Quy tắc mới luôn ở trạng thái tắt|Mặc định tắt/);
  assert.match(automationHtml, /data-hcca-rule-test-form/);
  assert.match(spacesHtml, /Context Capsule/);
  assert.match(spacesHtml, /Creative Room/);
  assert.match(spacesHtml, /FOCUS CIRCLES/);
  assert.match(spacesHtml, /Tóm tắt cục bộ/);
  assert.match(spacesHtml, /data-hcca-presence/);
});

test("source dispatches integration CustomEvents without claiming realtime or E2EE", () => {
  for (const token of [
    "hh:communication-convert", "hh:create-", "hh:communication-command", "hh:creative-room-playback",
    "hh:communication-presence", "CustomEvent", "localOnly: true", "aiAdapter.summarize"
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /đã đồng bộ realtime|mã hóa đầu cuối|end-to-end encrypted/i);
  assert.doesNotMatch(source, /localStorage[^\n]+(?:dataUrl|arrayBuffer|base64|file\.content)/i);
});

test("CSS is scoped, keyboard visible, 375px responsive and reduced-motion safe", () => {
  assert.match(css, /\.hh-communication-ca/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /overflow: auto/);
  assert.doesNotMatch(css, /font-size:\s*\d+(?:\.\d+)?vw/);
});
