const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Hikari assets and lazy Home wiring are versioned", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /home-virtual-assistant\.css\?v=4/);
  assert.match(loader, /services\/virtualAssistantCore\.js\?v=1/);
  assert.match(loader, /home-virtual-assistant\.js\?v=19/);
  assert.match(worker, /assets\/hikari-h\/hikari-h-original-v1-alpha\.webp/);
  assert.ok(fs.statSync(path.join(root, "assets/hikari-h/hikari-h-original-v1-alpha.webp")).size > 100_000);
});

test("assistant exposes lifecycle, fifteen animation states and licensed fallback adapter", () => {
  const client = read("home-virtual-assistant.js");
  const character = read("services/virtualAssistantCharacter.js");
  for (const marker of ["mount", "unmount", "speak", "listen", "setState", "executeCommand", "open", "close", "minimize"]) assert.match(client, new RegExp(`\\b${marker}\\b`));
  for (const state of ["loading", "appear", "idle", "idle-look-around", "greeting", "listening", "thinking", "speaking", "explaining", "pointing", "celebrating", "warning", "sleeping", "minimized", "goodbye"]) assert.match(character, new RegExp(`"${state}"`));
  assert.match(character, /class CharacterAdapter/);
  assert.match(character, /model-3d/);
  assert.match(character, /original-2d-fallback/);
  assert.match(character, /requestAnimationFrame/);
  assert.match(character, /document\.hidden/);
  assert.match(character, /removeEventListener\("visibilitychange"/);
});

test("voice requires explicit user interaction and microphone is never opened on mount", () => {
  const client = read("home-virtual-assistant.js");
  const voice = read("services/virtualAssistantVoice.js");
  const mountBody = client.slice(client.indexOf("async function mount"), client.indexOf("function unmount"));
  assert.match(client, /Bật giọng nói cho Hikari/);
  assert.match(client, /action === "enable-voice"/);
  assert.doesNotMatch(mountBody, /getUserMedia/);
  assert.doesNotMatch(mountBody, /\.speak\(/);
  assert.match(voice, /navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\)/);
  assert.match(voice, /getTracks\?\.\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(voice, /speechSynthesis/);
  assert.match(voice, /simulatedLip/);
});

test("commands use a fixed route whitelist with ten or more real local intents", () => {
  const commands = read("services/virtualAssistantCommands.js");
  const client = read("home-virtual-assistant.js");
  assert.match(commands, /const ALLOWED = new Set\(Object\.values\(ROUTES\)\)/);
  assert.match(client, /commands\(\)\.safeRoute\(route\)/);
  assert.doesNotMatch(client, /eval\(/);
  assert.ok((commands.match(/return (?:routeResult|controlResult|\{ matched: true)/g) || []).length >= 10);
  for (const route of ["/home", "/japanese", "/english", "/davinci-resolve/youtube-batch", "/davinci-resolve/image-text", "/work", "/learn/review", "/analytics"]) assert.match(commands, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("assistant storage is owner and learner-profile scoped", () => {
  const core = read("services/virtualAssistantCore.js");
  assert.match(core, /BASE_KEY = "hh\.virtual-assistant\.v1"/);
  assert.match(core, /`\$\{BASE_KEY\}:\$\{ownerId\(\)\}:\$\{profileId\(\)\}`/);
  assert.match(core, /learnerProfileId/);
  assert.match(core, /history: Array\.isArray/);
});

test("assistant APIs authenticate owners, rate limit and keep provider keys server-side", () => {
  const chat = read("api/assistant/chat.js");
  const tts = read("api/assistant/tts.js");
  for (const source of [chat, tts]) {
    assert.match(source, /requireAuth\(req, res, db\)/);
    assert.match(source, /enforceRateLimit/);
    assert.match(source, /process\.env/);
  }
  assert.match(chat, /parseGeminiKeys\(process\.env\)/);
  assert.match(chat, /runOpenAIResponse/);
  assert.match(tts, /api\.openai\.com\/v1\/audio\/speech/);
  assert.doesNotMatch(`${chat}\n${tts}`, /AIza[0-9A-Za-z_-]{20,}/);
});

test("assistant remains mobile safe, scroll safe and motion accessible", () => {
  const styles = read("home-virtual-assistant.css");
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /width:calc\(100vw - 20px\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(styles, /body\s*\{[^}]*overflow\s*:\s*hidden/);
  assert.doesNotMatch(styles, /html\s*\{[^}]*overflow\s*:\s*hidden/);
});
