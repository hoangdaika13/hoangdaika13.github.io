const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const chat = require(path.join(root, "chat-ai-hub.js"));

test("HH Intelligence exposes processing modes and owner-isolated local state", () => {
  assert.equal(chat.VERSION, "3.1.0");
  assert.deepEqual(chat.PROCESSING_MODES.map((item) => item.id), ["auto", "fast", "deep", "economy"]);
  assert.deepEqual(chat.MODELS.map((item) => item.id), ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"]);
  assert.deepEqual(chat.MODES.map((item) => item.id), ["chat", "research", "code", "write", "study", "vision"]);
  assert.deepEqual(chat.MODES.map((item) => item.action), ["chat", "research", "code", "write", "study", "vision"]);
  assert.notEqual(chat.storageKey("owner-a"), chat.storageKey("owner-b"));
  const state = chat.normalizeState({ model: "untrusted-model", sessions: [], thinkingLevel: "invalid" });
  assert.equal(state.processingMode, "auto");
  assert.equal(state.thinkingLevel, "medium");
  assert.equal(state.autoFallback, true);
  assert.equal(state.contextBudget, 24000);
  assert.equal(state.webSearch, false);
  assert.equal(state.sessions.length, 1);
  assert.equal(typeof chat.mount, "function");
  assert.equal(typeof chat.unmount, "function");
});

test("each Chat AI mode has an isolated request contract", () => {
  const expected = {
    chat: ["chat", false, false],
    research: ["research", true, false],
    code: ["code", false, false],
    write: ["write", false, false],
    study: ["study", false, false],
    vision: ["vision", false, true]
  };
  for (const [mode, contract] of Object.entries(expected)) {
    const result = chat.modeRequestContract(mode);
    assert.deepEqual([result.actionType, result.useGoogleSearch, result.requiresAttachment], contract);
  }
  assert.equal(chat.modeRequestContract("chat", { manualWebSearch: true }).useGoogleSearch, true);
  assert.equal(chat.modeRequestContract("unknown").actionType, "chat");
  const migrated = chat.normalizeState({ mode: "chat", webSearch: true, sessions: [] });
  assert.equal(migrated.webSearch, false, "legacy research selection must not leave search stuck on");
  const explicit = chat.normalizeState({ mode: "chat", webSearch: true, webSearchExplicit: true, sessions: [] });
  assert.equal(explicit.webSearch, true, "an explicit user search preference must be preserved");
});

test("Chat AI compacts long context without inventing a summary", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `Tin ${index} ${"x".repeat(900)}` }));
  const context = chat.compactHistory(messages, 8000);
  assert.ok(context.history.length <= 17);
  assert.ok(context.chars <= 8200);
  assert.ok(context.omitted > 0);
  assert.match(context.history[0].text, /chỉ là trích đoạn, không phải dữ kiện mới/);
  assert.ok(context.estimatedTokens > 0);
});

test("Chat AI interface provides real conversation, attachment, privacy and export controls", () => {
  const source = read("chat-ai-hub.js");
  for (const contract of [
    "data-chat-ai-form", "data-chat-ai-files", "data-chat-ai-stop", "data-chat-ai-mic",
    "data-chat-ai-private", "data-chat-ai-branch", "data-chat-ai-regenerate", "data-chat-ai-export",
    "data-chat-ai-search-toggle", "data-chat-ai-thinking", "data-chat-ai-download-artifact",
    "data-chat-ai-export-format", "data-chat-ai-mobile-panel", "data-chat-ai-mobile-close", "data-chat-ai-processing", "data-chat-ai-refine", "data-chat-ai-message-pin", "data-chat-ai-edit-message", "data-chat-ai-remove-queue", "data-chat-ai-memory-toggle"
  ]) assert.match(source, new RegExp(contract));
  assert.match(source, /\/api\/modules\/chat-ai\/actions/);
  assert.match(source, /provider:\s*"gemini"/);
  assert.match(source, /allowProviderFallback:\s*runtime\.state\.autoFallback/);
  assert.match(source, /requireProvider:\s*false/);
  assert.match(source, /allowModelFallback:\s*runtime\.state\.autoFallback/);
  assert.match(source, /HH_API_BASE/);
  assert.match(source, /localContinuityResponse/);
  assert.match(source, /HH Basic Assist/);
  assert.match(source, /data-chat-ai-context-budget/);
  assert.match(source, /data-chat-ai-fallback-toggle/);
  assert.match(source, /routeProcessing/);
  assert.match(source, /actionType:\s*modeContract\.actionType/);
  assert.match(source, /mode:\s*mode\.id/);
  assert.match(source, /mode:\s*next\.mode/);
  assert.match(source, /requiresAttachment/);
  assert.match(source, /HH INTELLIGENCE/);
  assert.match(source, /In \/ PDF/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /runtime\.incognito/);
  assert.doesNotMatch(source, /GEMINI_API_KEY|GOOGLE_AI_API_KEY/);
});

test("HH Basic Assist fallback is useful and explicitly labeled", () => {
  const output = chat.localContinuityResponse("Fix lỗi API JavaScript", { mode: "code" });
  assert.match(output, /HH Basic Assist đang hỗ trợ/);
  assert.match(output, /không phải kết quả từ dịch vụ AI đám mây/);
  assert.match(output, /thông báo lỗi nguyên văn/);
  assert.match(output, /Tạo bản khác/);
});

test("legacy local fallback messages migrate without rewriting user content", () => {
  const legacy = "## HH Continuity đang tiếp quản\nGemini và các provider cloud hiện chưa phản hồi ổn định. Đây không phải phản hồi của Gemini. Bấm **Tạo lại bằng cloud** khi provider phục hồi.";
  const state = chat.normalizeState({
    sessions: [{ id: "legacy", messages: [
      { id: "assistant", role: "assistant", provider: "local-client", continuity: true, text: legacy },
      { id: "user", role: "user", text: legacy }
    ] }]
  });
  const [assistant, user] = state.sessions[0].messages;
  assert.match(assistant.text, /HH Basic Assist đang hỗ trợ/);
  assert.match(assistant.text, /Dịch vụ AI đám mây hiện chưa phản hồi ổn định/);
  assert.match(assistant.text, /không phải kết quả từ dịch vụ AI đám mây/);
  assert.match(assistant.text, /Tạo bản khác/);
  assert.match(assistant.text, /HH Intelligence khôi phục/);
  assert.doesNotMatch(assistant.text, /HH Continuity|Tạo lại bằng cloud|provider phục hồi|phản hồi của Gemini/);
  assert.equal(user.text, legacy);
});

test("Gemini backend supports Chat AI, current models, thinking levels and server-side secrets", () => {
  const backend = read("api/modules/[moduleId]/actions.js");
  assert.match(backend, /creativeModules = new Set\(\[[^\]]*"chat-ai"/);
  assert.match(backend, /"gemini-3\.6-flash"/);
  assert.match(backend, /"gemini-3\.5-flash-lite"/);
  assert.match(backend, /thinkingConfig:\s*\{ thinkingLevel \}/);
  assert.match(backend, /thinking_level:\s*thinkingLevel/);
  assert.match(backend, /!\["gemini-3\.6-flash", "gemini-3\.5-flash-lite"\]\.includes\(model\)/);
  assert.match(backend, /const supported = new Set\(\[[^\]]*"application\/pdf"/);
  assert.match(backend, /x-goog-api-key/);
  assert.match(backend, /modelCandidates/);
  assert.match(backend, /retry-after/);
  assert.match(backend, /localContinuity:\s*moduleId === "chat-ai"/);
  assert.match(backend, /local-continuity/);
  assert.match(backend, /retryDelay|retryAfterMs/);
  assert.match(backend, /CHAT_AI_ACTIONS = new Set\(\["chat", "research", "code", "write", "study", "vision"\]\)/);
  assert.match(backend, /moduleId === "chat-ai" && !CHAT_AI_ACTIONS\.has\(actionType\)/);
  assert.match(backend, /Không tự đổi sang chế độ khác/);
  assert.match(backend, /Không biến lời chào, tâm sự hoặc yêu cầu đơn giản thành báo cáo nghiên cứu/);
  assert.match(backend, /HH Basic Assist · \$\{profile\.label\}/);
  assert.doesNotMatch(backend, /## HH Continuity đang tiếp quản/);
  assert.doesNotMatch(read("index.html"), /GEMINI_API_KEY|GOOGLE_AI_API_KEY/);
});

test("Chat AI is a first-class lazy route, searchable and cached offline", () => {
  const client = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  assert.match(client, /id: "chat-ai"[\s\S]*?route: "\/chat-ai"/);
  assert.match(client, /window\.HHChatAI\?\.mount/);
  assert.match(client, /title: "Chat AI"[\s\S]*?smart router/);
  assert.match(loader, /"chat-ai":\s*\{[\s\S]*?chat-ai-hub\.css\?v=9[\s\S]*?chat-ai-hub\.js\?v=9/);
  assert.match(html, /performance-loader\.js\?v=368/);
  assert.match(worker, /performance-loader\.js\?v=368/);
  assert.match(loader, /value\.startsWith\("\/chat-ai"\)/);
  assert.match(worker, /chat-ai-hub\.css\?v=9/);
  assert.match(worker, /chat-ai-hub\.js\?v=9/);
  assert.match(html, /data-hh-galaxy-key="chatAI"/);
  assert.match(html, /23 LĨNH VỰC/);
  assert.match(galaxy, /chatAI:\s*\{[\s\S]*?route: "#\/chat-ai"/);
});

test("Chat AI layout is responsive, accessible and motion-safe", () => {
  const css = read("chat-ai-hub.css");
  assert.match(css, /body\.app-chat-ai-route/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow:auto/);
  assert.match(css, /\.chat-ai-hub\.is-sessions-open \.chat-ai-sidebar/);
  assert.match(css, /\.chat-ai-hub\.is-inspector-open \.chat-ai-inspector/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.chat-ai-hub \.chat-ai-sidebar>footer\{/);
  assert.match(css, /\.chat-ai-hub \.chat-ai-message footer\{/);
  assert.match(css, /position:static!important/);
  assert.match(css, /background:transparent!important/);
  assert.match(css, /\.chat-ai-composer__mode/);
  assert.match(css, /\.chat-ai-message__mode/);
});
