const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Hikari assets and lazy Home wiring are versioned", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /home-virtual-assistant\.css\?v=6/);
  assert.match(loader, /services\/virtualAssistantCore\.js\?v=2/);
  assert.match(loader, /services\/virtualAssistant3DRenderer\.js\?v=2/);
  assert.match(loader, /home-virtual-assistant\.js\?v=21/);
  assert.match(worker, /assets\/hikari-h\/hikari-h-original-v1-alpha\.webp/);
  assert.ok(fs.statSync(path.join(root, "assets/hikari-h/hikari-h-original-v1-alpha.webp")).size > 100_000);
});

test("assistant exposes lifecycle, fifteen animation states and licensed fallback adapter", () => {
  const client = read("home-virtual-assistant.js");
  const character = read("services/virtualAssistantCharacter.js");
  for (const marker of ["mount", "unmount", "speak", "listen", "setState", "executeCommand", "open", "close", "minimize"]) assert.match(client, new RegExp(`\\b${marker}\\b`));
  for (const state of ["loading", "appear", "idle", "idle-look-around", "greeting", "listening", "thinking", "speaking", "explaining", "pointing", "celebrating", "warning", "sleeping", "minimized", "goodbye"]) assert.match(character, new RegExp(`"${state}"`));
  assert.match(character, /class CharacterAdapter/);
  assert.match(character, /procedural-3d/);
  assert.match(character, /original-2d-fallback/);
  assert.match(character, /requestAnimationFrame/);
  assert.match(character, /document\.hidden/);
  assert.match(character, /removeEventListener\("visibilitychange"/);
});

test("Hikari uses a real disposable Three.js renderer with human motion layers", () => {
  const renderer = read("services/virtualAssistant3DRenderer.js");
  for (const marker of ["WebGLRenderer", "ACESFilmicToneMapping", "hips", "spine", "chest", "head", "jaw", "hairChains", "setState", "lookAt", "setViseme", "setQuality", "dispose"]) assert.match(renderer, new RegExp(marker));
  assert.match(renderer, /renderer\.forceContextLoss/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(renderer, /document\.createElement\("canvas"\)/);
  assert.doesNotMatch(renderer, /https?:\/\//);
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
  assert.match(voice, /hikari-gentle/);
  assert.match(voice, /gender: "female"/);
  assert.match(voice, /vi-VN-Neural2-A/);
  assert.match(voice, /female-estimated/);
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
  const api = read("api/modules/[moduleId]/actions.js");
  const routes = read("vercel.json");
  assert.match(api, /"hikari-assistant"/);
  assert.match(api, /runOpenAIResponse/);
  assert.match(api, /parseGeminiKeys\(process\.env\)/);
  assert.match(routes, /"source": "\/api\/assistant\/chat"/);
  assert.match(routes, /"destination": "\/api\/modules\/hikari-assistant\/actions"/);
  assert.doesNotMatch(api, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(api, /GOOGLE_CLOUD_TTS_API_KEY/);
  assert.match(api, /vi-VN-Neural2-A/);
  assert.match(api, /HIKARI_SELFHOST_TTS_URL/);
  assert.match(api, /allowedGoogleVoices/);
  assert.doesNotMatch(read("services/virtualAssistantVoice.js"), /GOOGLE_CLOUD_TTS_API_KEY\s*=/);
});

test("voice UI truthfully explains providers and keeps Vietnamese female as default", () => {
  const client = read("home-virtual-assistant.js");
  const core = read("services/virtualAssistantCore.js");
  assert.match(core, /voicePreset: "hikari-gentle"/);
  assert.match(core, /googleVoice: "vi-VN-Neural2-A"/);
  assert.match(client, /Mặc định nữ Việt/);
  assert.match(client, /có hạn mức miễn phí, cần billing/);
  assert.match(client, /giới tính ước tính theo tên/);
  assert.match(client, /không clone giọng nếu chưa có đồng ý rõ ràng/);
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
