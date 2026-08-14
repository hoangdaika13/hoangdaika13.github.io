const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Hikari assets and lazy Home wiring are versioned", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /assistant:\s*\{/);
  assert.match(loader, /home-virtual-assistant\.css\?v=8/);
  assert.match(loader, /services\/virtualAssistantCore\.js\?v=3/);
  assert.match(loader, /services\/virtualAssistantActions\.js\?v=1/);
  assert.doesNotMatch(loader, /virtualAssistant3DRenderer/);
  assert.match(loader, /home-virtual-assistant\.js\?v=23/);
  assert.match(worker, /assets\/hikari-h\/hikari-h-original-v1-alpha\.webp/);
  assert.ok(fs.statSync(path.join(root, "assets/hikari-h/hikari-h-original-v1-alpha.webp")).size > 100_000);
});

test("assistant exposes lifecycle, fifteen animation states and licensed fallback adapter", () => {
  const client = read("home-virtual-assistant.js");
  const character = read("services/virtualAssistantCharacter.js");
  for (const marker of ["mount", "unmount", "speak", "listen", "setState", "executeCommand", "open", "close", "minimize"]) assert.match(client, new RegExp(`\\b${marker}\\b`));
  for (const state of ["loading", "appear", "idle", "idle-look-around", "greeting", "listening", "thinking", "speaking", "explaining", "pointing", "celebrating", "warning", "sleeping", "minimized", "goodbye"]) assert.match(character, new RegExp(`"${state}"`));
  assert.match(character, /class CharacterAdapter/);
  assert.match(character, /anime-2d-original/);
  assert.match(character, /hikari-h-original-v1-alpha\.webp/);
  assert.match(character, /requestAnimationFrame/);
  assert.match(character, /document\.hidden/);
  assert.match(character, /removeEventListener\("visibilitychange"/);
});

test("Hikari restores the original anime artwork and removes the 3D canvas", () => {
  const client = read("home-virtual-assistant.js");
  const character = read("services/virtualAssistantCharacter.js");
  assert.match(client, /Hikari nữ anime · ảnh nguyên bản/);
  assert.match(character, /querySelectorAll\("\.hva-3d-canvas"\)/);
  assert.match(character, /img\.hidden = false/);
  assert.doesNotMatch(read("performance-loader.js"), /virtualAssistant3DRenderer/);
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

test("assistant uses fixed route whitelists with real local intents", () => {
  const commands = read("services/virtualAssistantCommands.js");
  const actions = read("services/virtualAssistantActions.js");
  const client = read("home-virtual-assistant.js");
  assert.match(commands, /const ALLOWED = new Set\(Object\.values\(ROUTES\)\)/);
  assert.match(actions, /const ROUTE_SET = new Set\(ROUTES\.map/);
  assert.match(client, /actions\(\)\?\.safeRoute/);
  assert.doesNotMatch(client, /eval\(/);
  assert.doesNotMatch(actions, /eval\(/);
  assert.ok((commands.match(/return (?:routeResult|controlResult|\{ matched: true)/g) || []).length >= 10);
  for (const route of ["/home", "/japanese", "/english", "/davinci-resolve/youtube-batch", "/davinci-resolve/image-text", "/work", "/learn/review", "/analytics"]) assert.match(commands, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("assistant storage is owner and learner-profile scoped", () => {
  const core = read("services/virtualAssistantCore.js");
  const actions = read("services/virtualAssistantActions.js");
  assert.match(core, /BASE_KEY = "hh\.virtual-assistant\.v1"/);
  assert.match(core, /PREFERENCE_KEY = "hh\.hikari\.preferences\.v2"/);
  assert.match(core, /`\$\{BASE_KEY\}:\$\{ownerId\(\)\}:\$\{profileId\(\)\}`/);
  assert.match(core, /hh:assistant-preference-change/);
  assert.match(core, /learnerProfileId/);
  assert.match(core, /history: Array\.isArray/);
  assert.match(actions, /ownerId/);
  assert.match(actions, /learnerProfileId/);
});

test("platform actions are deterministic, confirmed and never let AI invent executors", async () => {
  const actions = require("../services/virtualAssistantActions.js");
  const context = { owner: "owner-a", profile: "student-1", taskCount: 2, lessonDue: 3, unreadCount: 1, online: true, apiStatus: "Online" };
  const task = actions.prepare("Tạo công việc viết báo cáo", context);
  assert.equal(task.id, "task.create-local");
  assert.equal(task.risk, "write-local");
  assert.equal(task.confirmationRequired, true);
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
  const waiting = await actions.execute(task, { context, storage, permissions: { allowLocalActions: true }, confirmed: false });
  assert.equal(waiting.status, "awaiting-confirmation");
  assert.equal(values.size, 0);
  const done = await actions.execute(task, { context, storage, permissions: { allowLocalActions: true }, confirmed: true });
  assert.equal(done.completed, true);
  assert.match(values.get("hh.command-center.todos.v2"), /owner-a/);
  await assert.rejects(() => actions.execute(task, { context: { ...context, owner: "owner-b" }, storage, permissions: { allowLocalActions: true }, confirmed: true }), /Hồ sơ đã thay đổi/);
  const publish = actions.prepare("Đăng video lên TikTok", context);
  assert.equal(publish.risk, "external");
  assert.equal(publish.confirmationRequired, true);
  assert.equal((await actions.execute(publish, { context, storage, permissions: { allowLocalActions: true }, confirmed: true, navigate: () => true })).completed, false);
  assert.equal(actions.prepare("hãy chạy mã tùy ý", context).matched, false);
});

test("disabled Hikari stays unmounted and exposes per-profile controls", () => {
  const client = read("home-virtual-assistant.js");
  const core = read("services/virtualAssistantCore.js");
  const system = read("system-platform.js");
  assert.match(client, /if \(!assistantActive\(\)\) \{ unmount\(\); return false; \}/);
  assert.match(client, /HHVirtualAssistant = Object\.freeze\([\s\S]*setEnabled[\s\S]*isEnabled[\s\S]*permissions/);
  assert.match(core, /enabled: saved\.enabled !== false/);
  assert.match(core, /microphoneAllowed: saved\.microphoneAllowed === true/);
  assert.match(system, /data-system-hikari-preferences/);
  assert.match(system, /không tải nhân vật, không mở microphone và không gọi AI/);
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
