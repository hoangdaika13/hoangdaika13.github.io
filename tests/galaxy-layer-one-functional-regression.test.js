const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("galaxy-layer-one.js");
const worldCss = read("galaxy-layer-one-worlds.css");
const homeSource = read("galaxy-home-ai.js");
const layerOne = require("../galaxy-layer-one.js");
const galaxyHome = require("../galaxy-home-ai.js");

const HANDOFF_KEY = "hh.galaxy.ai.handoff.v1";
const LAYER_TWO_ROUTES = Object.freeze([
  "/create",
  "/chat-ai",
  "/music",
  "/settings",
  "/analytics",
  "/work",
  "/system",
  "/communication",
  "/play",
  "/dev-tools",
  "/japanese",
  "/english",
  "/chinese",
  "/phat-phap"
]);

function memoryStorage(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value)
  ]));
  let writes = 0;
  let removals = 0;
  return {
    getItem(key) { return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { writes += 1; records.set(key, String(value)); },
    removeItem(key) { removals += 1; records.delete(key); },
    clear() { records.clear(); },
    key(index) { return [...records.keys()][index] || null; },
    get length() { return records.size; },
    snapshot() { return Object.fromEntries(records); },
    stats() { return { writes, removals }; }
  };
}

function inputTags(markup, type) {
  return [...String(markup).matchAll(new RegExp(`<input\\b(?=[^>]*\\btype=["']${type}["'])[^>]*>`, "gi"))]
    .map((match) => match[0]);
}

function functionSection(text, startName, nextName) {
  const escapedStart = startName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startMatch = new RegExp(`function\\s+${escapedStart}\\s*\\(`).exec(text);
  const start = startMatch ? startMatch.index : -1;
  assert.notEqual(start, -1, `missing function ${startName}`);
  let end;
  if (nextName) {
    const escapedNext = nextName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextPattern = new RegExp(`function\\s+${escapedNext}\\s*\\(`, "g");
    nextPattern.lastIndex = start + startMatch[0].length;
    const nextMatch = nextPattern.exec(text);
    end = nextMatch ? nextMatch.index : -1;
  } else {
    const remainder = text.slice(start + startMatch[0].length);
    const next = remainder.match(/\n\s{2}function\s+[A-Za-z_$][\w$]*\s*\(/);
    end = next ? start + startMatch[0].length + next.index : text.length;
  }
  assert.notEqual(end, -1, `missing boundary function ${nextName}`);
  return text.slice(start, end);
}

function resolveHandoffConsumer() {
  return layerOne.consumeAIHandoff || layerOne.consumeAiHandoff || layerOne.consumeHandoff;
}

function resolveBackupPreviewer() {
  return layerOne.previewBackup || layerOne.inspectBackup;
}

function analyticsForRange(state, range, now) {
  return layerOne.summarizeAnalytics.length >= 3
    ? layerOne.summarizeAnalytics(state, range, Date.parse(now))
    : layerOne.summarizeAnalytics(state, { range, now });
}

test("HH CORE remains the only Layer One control authorized to enter Layer Two", () => {
  const home = galaxyHome.viewMarkup("/home", galaxyHome.collectLocalData(memoryStorage(), {}));
  assert.equal((home.match(/data-gha-entry=["']hh-core["']/g) || []).length, 1);
  assert.match(home, /<button\b[^>]*data-gha-entry=["']hh-core["'][^>]*data-gha-route=["']\/platform["']/i);

  const clickSection = functionSection(homeSource, "handleClick", "handleSubmit");
  assert.match(clickSection, /dataset\.ghaEntry\s*===\s*["']hh-core["']\)\s*enterCore\(/);
  assert.doesNotMatch(clickSection, /else\s+enterCore\(/, "non-Core controls must never fall through into Core");

  for (const route of LAYER_TWO_ROUTES) {
    assert.equal(layerOne.canHandle(route), false, `${route} must stay outside Layer One routing`);
  }

  for (const route of ["/japanese", "/english", "/chinese", "/phat-phap"]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const learning = layerOne.viewMarkup("/galaxy/learning", {});
    assert.doesNotMatch(learning, new RegExp(`(?:href|data-hgl1-route)=["']#?${escaped}["']`, "i"));
  }

  assert.match(source, /open-platform-via-core[\s\S]{0,900}navigate\(["']\/home["']\)/);
  assert.doesNotMatch(source, /\bHHCoreGateway\s*\.\s*(?:enter|open|navigate)\s*\(/);
});

test("Home AI handoff is TTL-validated, consumed exactly once and removed on rejection", () => {
  const consume = resolveHandoffConsumer();
  assert.equal(typeof consume, "function", "Layer One must export a testable one-shot handoff consumer");

  const now = Date.parse("2026-09-01T12:00:00.000Z");
  const storage = memoryStorage({
    [HANDOFF_KEY]: {
      prompt: "<img src=x onerror=alert(1)> & câu hỏi",
      at: now - 30_000,
      source: "galaxy-home",
      layer: "galaxy"
    }
  });
  const first = consume(storage, now);
  assert.ok(first, "a fresh handoff should be accepted");
  assert.equal(first.prompt, "<img src=x onerror=alert(1)> & câu hỏi");
  assert.equal(storage.getItem(HANDOFF_KEY), null, "accepted handoff must be removed immediately");
  assert.equal(consume(storage, now), null, "the same handoff cannot be replayed");

  const staleStorage = memoryStorage({
    [HANDOFF_KEY]: { prompt: "stale", at: now - 24 * 60 * 60 * 1000, source: "galaxy-home", layer: "galaxy" }
  });
  assert.equal(consume(staleStorage, now), null, "stale handoff must fail closed");
  assert.equal(staleStorage.getItem(HANDOFF_KEY), null, "stale handoff must also be cleared");

  const foreignStorage = memoryStorage({
    [HANDOFF_KEY]: { prompt: "foreign", at: now, source: "unknown", layer: "platform" }
  });
  assert.equal(consume(foreignStorage, now), null, "foreign source/layer must be rejected");
  assert.equal(foreignStorage.getItem(HANDOFF_KEY), null);
});

test("AI handoff content reaches an editable control without becoming executable markup", () => {
  const ai = layerOne.viewMarkup("/galaxy/ai", {}, {
    aiHandoff: { prompt: "<svg onload=alert(1)> & hello", source: "galaxy-home" }
  });
  assert.match(ai, /data-hgl1-ai-(?:prompt|composer|draft|handoff)/i, "AI workspace needs a stable handoff target");
  assert.doesNotMatch(ai, /<svg onload=alert\(1\)>/i);

  const safeAssignment = /(?:\.value|\.textContent)\s*=\s*[^;\n]*(?:handoff|payload|draft)[^;\n]*/i;
  const escapedMarkup = /escapeHtml\([^)]*(?:handoff|payload|draft)[^)]*\.prompt/i;
  assert.ok(safeAssignment.test(source) || escapedMarkup.test(source), "handoff prompt must use value/textContent or HTML escaping");
  assert.doesNotMatch(source, /innerHTML\s*=\s*[^;]*(?:handoff|payload|draft)[^;]*\.prompt/i);
});

test("Settings expose an explicit preview draft workflow: Save, Cancel and Defaults", () => {
  const state = layerOne.collectLocalState(memoryStorage());
  const markup = layerOne.viewMarkup("/galaxy/settings", state);

  assert.match(markup, /<form\b[^>]*data-hgl1-settings-form/i);
  for (const key of ["theme", "effects", "contrast", "reducedMotion"]) {
    assert.match(markup, new RegExp(`data-hgl1-setting=["']${key}["']`, "i"));
  }
  for (const action of ["save-settings", "cancel-settings", "restore-settings-defaults"]) {
    assert.match(markup, new RegExp(`data-hgl1-action=["']${action}["']`, "i"), `missing ${action}`);
  }
  assert.match(markup, /data-hgl1-settings-status/i);
  assert.match(markup, /role=["']status["']|aria-live=["']polite["']/i);

  const changeSection = functionSection(source, "handleChange", "closeSearches");
  assert.match(changeSection, /settingsDraft/);
  assert.ok(
    /applyPreferences\s*\(/.test(changeSection) || /updateSettingsDraftUi\s*\(/.test(changeSection),
    "draft changes should be previewed in the live shell"
  );
  const draftIndex = changeSection.indexOf("settingsDraft");
  const firstWriteAfterDraft = changeSection.indexOf("writeLocalState", draftIndex);
  if (firstWriteAfterDraft >= 0) {
    assert.match(
      changeSection.slice(draftIndex, firstWriteAfterDraft),
      /return\s*;/,
      "the Settings draft branch must exit before any persistent Analytics branch"
    );
  }

  const clickSection = functionSection(source, "handleClick", "handleSubmit");
  assert.match(clickSection, /save-settings[\s\S]{0,300}saveSettingsDraft\s*\(/);
  const saveSection = functionSection(source, "saveSettingsDraft");
  assert.match(saveSection, /writeLocalState\s*\(/);
  assert.match(clickSection, /cancel-settings[\s\S]{0,900}(?:setSettingsControls|settingsDraft|applyPreferences|renderSettings)/);
  assert.match(clickSection, /restore-settings-defaults[\s\S]{0,900}defaultSettings\s*\(/);
});

test("backup selection only builds a bounded preview; import requires an explicit confirmation", () => {
  const previewBackup = resolveBackupPreviewer();
  assert.equal(typeof previewBackup, "function", "backup validation must be exposed independently from mutation");
  const existingStorage = memoryStorage({
    [layerOne.storageKey]: {
      version: 1,
      settings: { theme: "midnight", analyticsConsent: false },
      items: [],
      events: []
    }
  });
  const before = existingStorage.snapshot();
  const candidate = JSON.stringify({
    schema: "hh-galaxy-layer-one-backup",
    version: 1,
    exportedAt: "2026-09-01T00:00:00.000Z",
    data: {
      version: 1,
      settings: { theme: "cosmic", effects: "balanced", contrast: "standard", reducedMotion: "system", analyticsConsent: false },
      items: [{ id: "preview-item", route: "/galaxy/ai", title: "Preview only", kind: "prompt" }],
      events: []
    }
  });
  const preview = previewBackup(candidate, existingStorage);
  assert.equal(preview.ok, true);
  assert.equal(preview.imported, 1);
  assert.deepEqual(existingStorage.snapshot(), before, "preview must never write to localStorage");

  const markup = layerOne.viewMarkup("/galaxy/settings", layerOne.collectLocalState(existingStorage), {
    pendingBackup: { candidate: preview.candidate, summary: preview.summary }
  });
  const combined = `${markup}\n${source}`;
  assert.match(combined, /data-hgl1-backup-preview/i);
  assert.match(combined, /data-hgl1-backup-backdrop/i, "the modal needs a real pointer-blocking backdrop");
  assert.match(combined, /role=["'](?:alertdialog|dialog)["']/i);
  assert.match(combined, /name=["']hgl1-backup-mode["'][^>]*value=["'](?:merge|replace)["']|value=["'](?:merge|replace)["'][^>]*name=["']hgl1-backup-mode["']/i);
  assert.match(combined, /data-hgl1-action=["']confirm-backup-import["']/i);
  assert.match(combined, /data-hgl1-action=["']cancel-backup-import["']/i);
  assert.match(combined, /aria-describedby=["']hgl1-backup-preview-description["']/i);

  const fileSection = functionSection(source, "importBackupFile", "checkMicrophone");
  assert.match(fileSection, /(?:previewBackup|inspectBackup)\s*\(/);
  assert.doesNotMatch(fileSection, /\bimportBackup\s*\(/, "file selection must not overwrite state");

  const clickSection = functionSection(source, "handleClick", "handleSubmit");
  assert.match(clickSection, /confirm-backup-import[\s\S]{0,1800}\bconfirmPendingBackup\s*\(/);
  assert.match(functionSection(source, "confirmPendingBackup", "inspectDevCode"), /\bapplyBackup\s*\(/);

  const keydownSection = functionSection(source, "handleKeydown", "syncRoute");
  assert.match(keydownSection, /backupDialog[\s\S]{0,500}event\.key\s*===\s*["']Escape["'][\s\S]{0,240}closePendingBackup\s*\(/, "Escape must close the backup preview without importing");
  assert.match(keydownSection, /backupDialog[\s\S]{0,1000}event\.key\s*===\s*["']Tab["'][\s\S]{0,1000}(?:first|last)\.focus\s*\(/, "Tab must remain inside the modal preview");
  assert.match(functionSection(source, "closePendingBackup", "checkMicrophone"), /trigger-backup-import[\s\S]{0,260}\.focus\s*\(/, "closing the preview must restore a stable import control");
  assert.match(worldCss, /\.hgl1-backup-backdrop\s*\{[\s\S]{0,320}position\s*:\s*fixed[\s\S]{0,320}inset\s*:\s*0/, "the backdrop must cover the viewport, not only paint a shadow");
});

test("backup data cannot grant Analytics consent or create import telemetry while consent is off", () => {
  const importedEvent = { id: "from-backup", type: "route-view", route: "/galaxy/ai", at: "2026-09-01T08:00:00.000Z" };
  const consentGrantingBackup = JSON.stringify({
    schema: "hh-galaxy-layer-one-backup",
    version: 1,
    exportedAt: "2026-09-01T09:00:00.000Z",
    data: {
      version: 1,
      settings: { analyticsConsent: true },
      items: [{ id: "backup-item", route: "/galaxy/ai", title: "Imported", kind: "prompt" }],
      events: [importedEvent]
    }
  });
  const disabled = memoryStorage({
    [layerOne.storageKey]: { version: 1, settings: { analyticsConsent: false }, items: [], events: [] }
  });
  const disabledResult = layerOne.importBackup(consentGrantingBackup, disabled);
  assert.equal(disabledResult.ok, true);
  const disabledState = layerOne.collectLocalState(disabled);
  assert.equal(disabledState.settings.analyticsConsent, false, "a backup is data, not permission to enable Analytics");
  assert.deepEqual(disabledState.events, [], "replace import must not restore or append telemetry while consent is off");
  assert.equal(disabled.stats().writes, 1, "consent-off import should write data once and skip the data-import event write");

  const consentRevokingBackup = JSON.stringify({
    schema: "hh-galaxy-layer-one-backup",
    version: 1,
    exportedAt: "2026-09-01T09:00:00.000Z",
    data: { version: 1, settings: { analyticsConsent: false }, items: [], events: [] }
  });
  const enabled = memoryStorage({
    [layerOne.storageKey]: { version: 1, settings: { analyticsConsent: true }, items: [], events: [] }
  });
  const enabledResult = layerOne.importBackup(consentRevokingBackup, enabled);
  assert.equal(enabledResult.ok, true);
  const enabledState = layerOne.collectLocalState(enabled);
  assert.equal(enabledState.settings.analyticsConsent, true, "backup import must also not revoke the device's explicit consent choice");
  assert.deepEqual(enabledState.events.map((event) => event.type), ["data-import"], "an import event is allowed only under existing consent");

  const localOnly = memoryStorage({
    [layerOne.storageKey]: { version: 1, settings: { analyticsConsent: false }, items: [], events: [] }
  });
  assert.ok(layerOne.createLocalItem("/galaxy/dev", "Safe snippet", localOnly, { description: "console.log('local only')" }));
  assert.deepEqual(layerOne.collectLocalState(localOnly).events, [], "ordinary local actions must not log Analytics without consent");
  assert.equal(localOnly.stats().writes, 1, "the item write must not be followed by a hidden event write");

  const applySection = functionSection(source, "applyBackup", "importBackup");
  assert.match(applySection, /next\.settings\.analyticsConsent\s*=\s*current\.settings\.analyticsConsent\s*===\s*true/);
  assert.match(applySection, /current\.settings\.analyticsConsent\s*!==\s*true[\s\S]{0,180}next\.events\s*=/);
  assert.match(applySection, /importedCount[\s\S]{0,1000}imported\s*:\s*importedCount/, "merge results must report newly imported items, not the total library size");
  const mergeSection = functionSection(source, "mergeBackupState", "applyBackup");
  assert.match(mergeSection, /if\s*\(\s*!byId\.has\(item\.id\)\s*\)\s*byId\.set/, "existing local items must win id collisions");
  assert.match(mergeSection, /items\s*:\s*Array\.from\(byId\.values\(\)\)\.slice\(0,\s*MAX_ITEMS\)/, "capacity pressure must preserve current items before backup additions");
});

test("available capability cards lead to the function named by their card", () => {
  const section = functionSection(source, "openCapability", "handleClick");
  assert.match(section, /route\s*===\s*["']\/galaxy\/video["']\s*&&\s*index\s*===\s*1[\s\S]{0,160}\[data-hgl1-create-form\] input/, "Thumbnail & caption must open the local project workflow");
  assert.match(section, /route\s*===\s*["']\/galaxy\/games["']\s*&&\s*index\s*===\s*0[\s\S]{0,160}\[data-hgl1-create-form\] input/, "Save cục bộ must open the local save workflow");
  assert.doesNotMatch(section, /\/galaxy\/video["']\s*&&\s*index\s*===\s*1[\s\S]{0,160}youtube/i);
  assert.doesNotMatch(section, /\/galaxy\/games["']\s*&&\s*index\s*===\s*0[\s\S]{0,160}toggle-game/i);

  const games = layerOne.viewMarkup("/galaxy/games", {});
  assert.match(games, /aria-label=["']Orbit Collector:[^"']*thu thập các điểm sáng["']/i);
  assert.doesNotMatch(games, /thiên thạch/i, "accessible text must not promise obstacles that the runtime does not implement");
});

test("Dev Planet rejects likely credentials before local persistence", () => {
  assert.equal(typeof layerOne.containsLikelySecret, "function");
  const secrets = [
    "-----BEGIN PRIVATE KEY-----\nnot-for-storage",
    "AKIA" + "A".repeat(16),
    "AIza" + "a".repeat(32),
    "ghp_" + "a".repeat(24),
    "sk-proj-" + "a".repeat(24),
    "Authorization: Bearer " + "a".repeat(32),
    "client_secret = \"supersecretvalue\"",
    "API_KEY=unquoted_secret_value_123"
  ];
  for (const value of secrets) assert.equal(layerOne.containsLikelySecret(value), true, `expected secret signature to fail closed: ${value.slice(0, 24)}`);
  for (const value of ["", "process.env.API_KEY", "const token = process.env.TOKEN;", "const apiKey = process.env.API_KEY;", "const client_secret = import.meta.env.CLIENT_SECRET;", "api_key variable without a value", "const password = prompt();"]) {
    assert.equal(layerOne.containsLikelySecret(value), false, `safe reference should remain editable: ${value}`);
  }

  const submitSection = functionSection(source, "handleSubmit");
  const secretGuard = submitSection.indexOf("containsLikelySecret(title");
  const persistence = submitSection.indexOf('createLocalItem("/galaxy/dev"');
  assert.ok(secretGuard >= 0 && persistence > secretGuard, "secret detection must run before createLocalItem/localStorage persistence");
  assert.match(submitSection.slice(secretGuard, persistence), /showToast[\s\S]{0,260}return\s*;/, "detected credentials must terminate the Dev submit branch");
});

test("Analytics time range filters the real event set and is represented in the UI", () => {
  const state = {
    version: 1,
    settings: { analyticsConsent: true },
    items: [],
    events: [
      { id: "old", type: "route-view", route: "/galaxy/ai", at: "2026-07-01T12:00:00.000Z" },
      { id: "week", type: "route-view", route: "/galaxy/video", at: "2026-08-30T12:00:00.000Z" },
      { id: "today", type: "data-export", route: "/galaxy/analytics", at: "2026-09-01T11:00:00.000Z" }
    ]
  };
  const now = "2026-09-01T12:00:00.000Z";
  const week = analyticsForRange(state, "7d", now);
  assert.equal(week.range, "7d");
  assert.equal(week.trackedEvents, 2);
  assert.equal(week.visitedModules, 1);
  assert.equal(week.exports, 1);
  assert.deepEqual(week.latestEvents.map((event) => event.id), ["today", "week"]);

  const all = analyticsForRange(state, "all", now);
  assert.equal(all.trackedEvents, 3);
  assert.equal(all.visitedModules, 2);

  const markup = layerOne.viewMarkup("/galaxy/analytics", state, { analyticsRange: "7d", now });
  assert.match(markup, /data-hgl1-analytics-range/i);
  for (const range of ["7d", "30d", "all"]) {
    assert.match(markup, new RegExp(`value=["']${range}["']`, "i"));
  }
  assert.match(markup, /value=["']7d["'][^>]*selected|selected[^>]*value=["']7d["']/i);

  const exportSection = functionSection(source, "exportAnalytics", "importSelectedFile");
  assert.match(exportSection, /runtime\.analyticsRange/);
  assert.match(exportSection, /analyticsRangeStart\s*\(\s*range/);
  assert.match(exportSection, /events\s*=\s*state\.events\.filter/);
  assert.doesNotMatch(exportSection, /events\s*:\s*state\.events/, "exports must honor the selected Analytics range");
});

test("mobile drawer declares a modal contract, traps Tab and restores its opener", () => {
  const markup = layerOne.viewMarkup("/galaxy/ai", {});
  const drawerTag = markup.match(/<aside\b(?=[^>]*data-hgl1-drawer)[^>]*>/i)?.[0] || "";
  assert.ok(drawerTag, "the responsive sidebar needs a drawer marker");
  assert.ok(
    /role=["']dialog["']/i.test(drawerTag) || /setAttribute\(["']role["'],\s*["']dialog["']\)/i.test(source),
    "the open drawer must expose dialog semantics"
  );
  assert.ok(
    /aria-modal=["']true["']/i.test(drawerTag) || /setAttribute\(["']aria-modal["'],\s*["']true["']\)/i.test(source),
    "the open drawer must announce modal behavior"
  );
  assert.match(markup, /data-hgl1-action=["']open-drawer["'][^>]*aria-controls=/i);

  assert.match(source, /drawerReturnFocus|drawerOpener|previouslyFocused/i);
  assert.match(source, /(?:querySelectorAll?|querySelector)\(["'][^"']*(?:button|a\[href\]|input|select|textarea)/i);
  assert.match(source, /event\.key\s*===\s*["']Tab["'][\s\S]{0,1200}(?:shiftKey|preventDefault)/i);
  assert.match(source, /event\.key\s*===\s*["']Escape["'][\s\S]{0,500}setDrawer\(false/);
  assert.match(source, /setDrawer[\s\S]{0,1800}(?:drawerReturnFocus|drawerOpener|previouslyFocused)[\s\S]{0,300}\.focus\s*\(/i);
});

test("programmatically triggered file inputs stay out of the tab order and retain an accessible name", () => {
  const markup = [
    "/galaxy/ai",
    "/galaxy/music",
    "/galaxy/video",
    "/galaxy/dev",
    "/galaxy/learning",
    "/galaxy/settings"
  ].map((route) => layerOne.viewMarkup(route, {})).join("\n");
  const tags = inputTags(markup, "file");
  assert.ok(tags.length >= 4, "expected the module and backup file pickers");
  for (const tag of tags) {
    assert.match(tag, /tabindex=["']-1["']/i, `file input must not be keyboard-reachable: ${tag}`);
    assert.match(tag, /aria-(?:label|labelledby)=["'][^"']+["']/i, `file input needs an accessible name: ${tag}`);
  }
});

test("connectivity changes update status in place instead of remounting the active route", () => {
  assert.doesNotMatch(source, /listen\(globalScope,\s*["']online["'],\s*render\s*\)/);
  assert.doesNotMatch(source, /listen\(globalScope,\s*["']offline["'],\s*render\s*\)/);
  assert.match(source, /listen\(globalScope,\s*["']online["'],\s*(?:update|handle|sync)(?:Network|Connectivity)/);
  assert.match(source, /listen\(globalScope,\s*["']offline["'],\s*(?:update|handle|sync)(?:Network|Connectivity)/);

  const networkMatch = source.match(/function\s+((?:update|handle|sync)(?:Network|Connectivity)\w*)\s*\(/);
  assert.ok(networkMatch, "missing in-place network status updater");
  const networkSection = functionSection(source, networkMatch[1]);
  assert.doesNotMatch(networkSection, /\brender\s*\(/, "network status updates must preserve transient form/player state");
  assert.match(networkSection, /(?:textContent|dataset|setAttribute)/);
});

test("active media and game islands stay connected across same-route renders", (context) => {
  const hasMediaRuntime = /data-hgl1-(?:audio|video)-(?:player|file|source)|data-hgl1-(?:stable-)?media-host/i.test(source);
  if (!hasMediaRuntime) {
    context.skip("Layer One media runtime is not implemented yet; metadata-only workspaces have no object URL lifecycle.");
    return;
  }

  const music = layerOne.viewMarkup("/galaxy/music", {});
  const video = layerOne.viewMarkup("/galaxy/video", {});
  assert.equal((music.match(/data-hgl1-(?:audio|media)-(?:player-)?host|data-hgl1-stable-media-host/g) || []).length, 1);
  assert.equal((video.match(/data-hgl1-(?:video|media)-(?:player-)?host|data-hgl1-stable-media-host/g) || []).length, 1);

  assert.match(source, /URL\.createObjectURL\s*\(/);
  assert.match(source, /URL\.revokeObjectURL\s*\(/);
  assert.match(source, /runtime\.mediaSession/);
  assert.match(source, /session\.url/);
  const importSection = functionSection(source, "importSelectedFile", "importBackupFile");
  assert.match(importSection, /openLocalMedia\s*\(/, "selecting supported media must install the session player");
  const preserveSection = functionSection(source, "renderPreservingIsland", "render");
  assert.match(preserveSection, /currentIsland[\s\S]{0,120}\.isConnected/, "the preserved island must still be connected before reconciliation");
  assert.match(preserveSection, /child\s*!==\s*currentBranch[\s\S]{0,100}child\.remove\s*\(\)/, "reconciliation may remove only siblings outside the live island branch");
  assert.doesNotMatch(preserveSection, /currentIsland\s*\.\s*(?:remove|replaceWith)\s*\(|removeChild\s*\(\s*currentIsland\s*\)/, "the live island must never be detached or replaced");
  const attributeSyncSection = functionSection(source, "syncElementAttributes", "renderPreservingIsland");
  assert.match(attributeSyncSection, /getAttribute\s*\(\s*attribute\.name\s*\)\s*!==\s*attribute\.value[\s\S]{0,120}setAttribute\s*\(/, "unchanged canvas width/height attributes must not be rewritten because that clears its drawing buffer");

  const renderSection = functionSection(source, "render");
  assert.match(renderSection, /runtime\.mediaSession[\s\S]{0,180}\[data-hgl1-stable-media-host\]/, "media sessions must select their persistent host");
  assert.match(renderSection, /runtime\.gameSession[\s\S]{0,180}\[data-hgl1-game-canvas\]/, "running games must select their live canvas");
  assert.match(renderSection, /renderPreservingIsland\s*\(\s*markup\s*,\s*islandSelector\s*\)/);
  assert.match(renderSection, /if\s*\(\s*!preserved\s*\)\s*\{[\s\S]{0,160}runtime\.host\.innerHTML\s*=\s*markup/, "full replacement is allowed only when no live island was preserved");
  assert.doesNotMatch(renderSection, /(?:removeChild|appendChild)\s*\(\s*(?:stableMedia|currentIsland|session\.element)\s*\)/, "render must not detach and reattach a player or game island");

  const routeRuntimeSection = functionSection(source, "mountRouteRuntime", "updateSettingsDraftUi");
  assert.match(routeRuntimeSection, /runtime\.route\s*===\s*["']\/galaxy\/games["']\s*&&\s*!runtime\.gameSession[\s\S]{0,120}drawGameIdle\s*\(/, "an active game must not be reset to its idle frame");
  const syncSection = functionSection(source, "syncRoute");
  assert.match(syncSection, /changed[\s\S]{0,900}(?:cleanupMedia|releaseMedia)/i, "leaving the media route must stop and release its session");
  assert.match(syncSection, /changed[\s\S]{0,900}stopGame\s*\(/, "leaving Games must stop its frame loop");
  const unmountSection = source.slice(source.indexOf("function unmount()"), source.indexOf("function mount(hostOrOptions"));
  assert.match(unmountSection, /revokeObjectURL|cleanupMedia|releaseMedia/i);
  assert.match(unmountSection, /stopGame\s*\(/);
  const stopGameSection = functionSection(source, "stopGame", "toggleGame");
  assert.match(stopGameSection, /cancelAnimationFrame\s*\(/);
  assert.match(stopGameSection, /removeEventListener\s*\(\s*["']keydown["']/);
  assert.match(stopGameSection, /removeEventListener\s*\(\s*["']keyup["']/);
  assert.match(stopGameSection, /removeEventListener\s*\(\s*["']blur["']\s*,\s*session\.blur\s*\)/);
  const gameSection = functionSection(source, "toggleGame", "setCommunityRealtimeState");
  assert.match(gameSection, /addEventListener\s*\(\s*["']blur["']\s*,\s*session\.blur\s*\)/, "canvas blur must clear held movement keys");
  assert.match(gameSection, /Math\.hypot\(dx,\s*dy\)[\s\S]{0,180}dx\s*\/=\s*inputMagnitude[\s\S]{0,100}dy\s*\/=\s*inputMagnitude/, "combined keyboard/gamepad input must be normalized");
  assert.doesNotMatch(source, /(?:timeupdate|progress|volumechange)[\s\S]{0,300}\brender\s*\(/i);
});

test("Layer One route changes preserve the connected shell and replace only the main outlet", () => {
  const collectorSection = functionSection(source, "collectPersistentChrome", "syncPersistentChrome");
  for (const selector of [
    ".hgl1-cosmos",
    ".hgl1-sidebar",
    ".hgl1-sidebar .hgl1-nav",
    ".hgl1-main",
    ".hgl1-mobile-nav"
  ]) {
    assert.ok(collectorSection.includes(JSON.stringify(selector)), `persistent chrome must require ${selector}`);
  }
  assert.match(collectorSection, /currentRouteLinks[\s\S]{0,260}nextRouteLinks/);
  assert.match(collectorSection, /data-hgl1-route[\s\S]{0,360}data-hgl1-route/, "route links must be paired before any in-place update");

  const syncChromeSection = functionSection(source, "syncPersistentChrome", "renderPreservingIsland");
  assert.match(syncChromeSection, /currentRouteLinks\.forEach[\s\S]{0,180}syncElementAttributes/, "desktop and mobile links must update aria-current without replacing their nav nodes");
  assert.match(syncChromeSection, /\.hgl1-breadcrumb strong/, "the persistent topbar must receive the current route label");
  assert.match(syncChromeSection, /\.hgl1-topbar__status/, "the persistent topbar must receive current connectivity state");

  const preserveSection = functionSection(source, "renderPreservingChrome", "analyticsEngine");
  assert.match(preserveSection, /collectPersistentChrome\s*\(\s*currentRoot\s*,\s*nextRoot\s*\)/);
  assert.match(preserveSection, /syncPersistentChrome\s*\(\s*chrome\s*\)/);
  assert.match(preserveSection, /currentMain\.parentNode\.replaceChild\s*\(\s*chrome\.nextMain\s*,\s*chrome\.currentMain\s*\)/, "only the route outlet may be replaced");
  assert.doesNotMatch(preserveSection, /runtime\.host\.innerHTML|currentRoot\.innerHTML|currentSidebar\.innerHTML|currentNav\.innerHTML|currentMobileNav\.innerHTML/, "persistent shell nodes must never be rebuilt with innerHTML");

  const islandSection = functionSection(source, "renderPreservingIsland", "renderPreservingChrome");
  assert.match(islandSection, /chain\s*\(\s*currentMain\s*,\s*currentIsland\s*\)/, "media/game reconciliation must begin inside main, not at the app root");
  assert.match(islandSection, /syncPersistentChrome\s*\(\s*chrome\s*\)/, "same-route island renders must preserve the shell too");

  const renderSection = functionSection(source, "render", "showToast");
  const readFlag = renderSection.indexOf("runtime.preserveChromeNextRender === true");
  const consumeFlag = renderSection.indexOf("runtime.preserveChromeNextRender = false");
  const preserveCall = renderSection.indexOf("renderPreservingChrome(markup)");
  assert.ok(readFlag >= 0 && consumeFlag > readFlag && preserveCall > consumeFlag, "the route-change preservation flag must be consumed before reconciliation");
  assert.equal((renderSection.match(/runtime\.preserveChromeNextRender\s*=\s*false/g) || []).length, 1, "each render must consume the preservation request exactly once");

  const syncRouteSection = functionSection(source, "syncRoute", "unmount");
  assert.match(syncRouteSection, /if\s*\(\s*!changed\s*\)\s*return\s+match/, "duplicate hash/router notifications must not trigger another render");
  assert.match(syncRouteSection, /preserveChromeNextRender\s*=\s*Boolean\s*\([\s\S]{0,100}runtime\.app/, "route changes must request one persistent-shell render");
  assert.equal((syncRouteSection.match(/\brender\s*\(\s*\)/g) || []).length, 1, "a changed route must render exactly once");

  const navigateSection = functionSection(source, "navigate", "searchResultsMarkup");
  assert.match(navigateSection, /const active = runtime[\s\S]{0,420}runtime === active\s*&&\s*runtime\.route !== match\.route[\s\S]{0,80}syncRoute/, "an embedded router that already synchronized the route must not cause a second render");
});

test("AI provider probing is single-flight, cached and stale-result safe", () => {
  const probeSection = functionSection(source, "probeAiProvider", "submitAiPrompt");
  assert.match(probeSection, /!force\s*&&\s*active\.aiProbe\s*&&\s*active\.aiProbe\.promise[\s\S]{0,100}return\s+active\.aiProbe\.promise/, "ordinary renders must reuse an in-flight provider probe");
  assert.match(probeSection, /!force\s*&&\s*active\.aiProviderStatus[\s\S]{0,260}return\s+active\.aiProviderStatus\.state\s*===\s*["']ready["']/, "a settled provider result must be restored without another request");
  assert.match(probeSection, /force\s*&&\s*active\.aiProbe[\s\S]{0,180}\.abort\s*\(/, "an explicit manual retry must supersede the old probe");
  assert.match(probeSection, /runtime\s*!==\s*active\s*\|\|\s*active\.route\s*!==\s*["']\/galaxy\/ai["']\s*\|\|\s*active\.aiProbe\s*!==\s*probe/, "a response from an old route/runtime must not patch current UI");
  assert.match(probeSection, /if\s*\(\s*active\.aiProbe\s*===\s*probe\s*\)\s*active\.aiProbe\s*=\s*null/, "only the owning request may clear the single-flight slot");

  const routeRuntimeSection = functionSection(source, "mountRouteRuntime", "updateSettingsDraftUi");
  assert.match(routeRuntimeSection, /runtime\.aiProviderStatus[\s\S]{0,180}aiStatus[\s\S]{0,180}else\s+probeAiProvider\s*\(\s*\)/, "same-route render must restore cached status instead of probing again");
  const clickSection = functionSection(source, "handleClick", "handleSubmit");
  assert.match(clickSection, /probe-ai-provider[\s\S]{0,100}probeAiProvider\s*\(\s*true\s*\)/, "only the explicit provider button should force a retry");

  const cleanupSection = functionSection(source, "cleanupRouteRuntime", "mountRouteDelegate");
  assert.match(cleanupSection, /runtime\.aiProbe\s*=\s*null/);
  assert.match(cleanupSection, /probe[\s\S]{0,180}controller[\s\S]{0,180}\.abort\s*\(/, "route cleanup must abort a pending provider request");
});

test("Community realtime keeps one socket per route lifetime and closes it on exit", () => {
  assert.equal(typeof layerOne.resolveCommunitySocketTarget, "function");
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "https://hoang8.com" }
  });
  try {
    const relative = layerOne.resolveCommunitySocketTarget("/socket.io", []);
    assert.equal(relative.href, "https://hoang8.com/socket.io");
    assert.equal(relative.sameOrigin, true);
    assert.equal(layerOne.resolveCommunitySocketTarget("https://hoang8.com.evil.example/socket.io", []), null);
    assert.equal(layerOne.resolveCommunitySocketTarget("https://hoang8.com@evil.example/socket.io", []), null);
    assert.equal(layerOne.resolveCommunitySocketTarget("wss://hoang8.com/socket.io", []), null);
    const allowed = layerOne.resolveCommunitySocketTarget("https://realtime.example.test/socket.io", ["https://realtime.example.test/config-path"]);
    assert.equal(allowed.origin, "https://realtime.example.test");
    assert.equal(allowed.sameOrigin, false);
  } finally {
    if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
    else delete globalThis.location;
  }

  const communitySection = functionSection(source, "mountCommunityRealtime", "mountRouteRuntime");
  const existingGuard = communitySection.indexOf("if (active.communitySocket) return;");
  const socketCreation = communitySection.indexOf("globalScope.io(");
  assert.ok(existingGuard >= 0 && socketCreation > existingGuard, "same-route render must return before creating another Socket.IO client");
  assert.match(communitySection, /resolveCommunitySocketTarget\s*\(\s*socketUrl\s*,\s*runtime\.options\.communitySocketAllowedOrigins\s*\)/);
  assert.match(communitySection, /globalScope\.io\s*\(\s*socketTarget\.href\s*,[\s\S]{0,300}withCredentials\s*:\s*socketTarget\.sameOrigin/, "cross-origin allowlisted sockets must never receive browser credentials");
  assert.match(communitySection, /active\.communitySocket\s*=\s*socket/, "the route must own its connected socket");
  assert.doesNotMatch(communitySection, /registerDelegateCleanup/, "socket lifetime must not be tied to delegates that remount during render");

  const cleanupSection = functionSection(source, "cleanupRouteRuntime", "mountRouteDelegate");
  assert.match(cleanupSection, /runtime\.communitySocket\s*=\s*null/);
  assert.match(cleanupSection, /removeAllListeners\s*\(/, "Socket.IO handlers must be released before shutdown");
  assert.match(cleanupSection, /(?:\.close|\.disconnect)\s*\(/, "the realtime transport must close on route exit");

  const syncSection = functionSection(source, "syncRoute");
  assert.match(syncSection, /if\s*\(\s*changed\s*\)\s*\{[\s\S]{0,280}cleanupRouteRuntime\s*\(/, "route runtime cleanup must happen only when the route changes");
  const unmountSection = source.slice(source.indexOf("function unmount()"), source.indexOf("function mount(hostOrOptions"));
  assert.match(unmountSection, /cleanupRouteRuntime\s*\(/, "unmount must close the active route runtime");
});
