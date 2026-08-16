const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const chat = require(path.join(root, "chat-ai-hub.js"));

test("Chat AI exposes current Gemini modes and owner-isolated local state", () => {
  assert.equal(chat.VERSION, "1.0.1");
  assert.deepEqual(chat.MODELS.map((item) => item.id), ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"]);
  assert.deepEqual(chat.MODES.map((item) => item.id), ["chat", "research", "code", "write", "study", "vision"]);
  assert.notEqual(chat.storageKey("owner-a"), chat.storageKey("owner-b"));
  const state = chat.normalizeState({ model: "untrusted-model", sessions: [], thinkingLevel: "invalid" });
  assert.equal(state.model, "gemini-3.6-flash");
  assert.equal(state.thinkingLevel, "medium");
  assert.equal(state.sessions.length, 1);
  assert.equal(typeof chat.mount, "function");
  assert.equal(typeof chat.unmount, "function");
});

test("Chat AI interface provides real conversation, attachment, privacy and export controls", () => {
  const source = read("chat-ai-hub.js");
  for (const contract of [
    "data-chat-ai-form", "data-chat-ai-files", "data-chat-ai-stop", "data-chat-ai-mic",
    "data-chat-ai-private", "data-chat-ai-branch", "data-chat-ai-regenerate", "data-chat-ai-export",
    "data-chat-ai-search-toggle", "data-chat-ai-thinking", "data-chat-ai-download-artifact",
    "data-chat-ai-export-format"
  ]) assert.match(source, new RegExp(contract));
  assert.match(source, /\/api\/modules\/chat-ai\/actions/);
  assert.match(source, /provider:\s*"gemini"/);
  assert.match(source, /allowProviderFallback:\s*false/);
  assert.match(source, /requireProvider:\s*true/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /runtime\.incognito/);
  assert.doesNotMatch(source, /GEMINI_API_KEY|GOOGLE_AI_API_KEY/);
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
  assert.match(client, /title: "Chat AI"[\s\S]*?gemini 3\.6 flash/);
  assert.match(loader, /"chat-ai":\s*\{[\s\S]*?chat-ai-hub\.css\?v=2[\s\S]*?chat-ai-hub\.js\?v=2/);
  assert.match(loader, /value\.startsWith\("\/chat-ai"\)/);
  assert.match(worker, /chat-ai-hub\.css\?v=2/);
  assert.match(worker, /chat-ai-hub\.js\?v=2/);
  assert.match(html, /data-hh-galaxy-key="chatAI"/);
  assert.match(html, /25 LĨNH VỰC/);
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
});
