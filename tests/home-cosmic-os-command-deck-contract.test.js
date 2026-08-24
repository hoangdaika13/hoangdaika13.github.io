const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-cosmic-os.js");
const styles = read("home-cosmic-os.css");
const loader = read("performance-loader.js");
const api = require(path.join(root, "home-cosmic-os.js"));

function includesAll(haystack, contracts, label) {
  for (const contract of contracts) {
    assert.ok(haystack.includes(contract), `${label} missing contract: ${contract}`);
  }
}

function sourceBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source boundary: ${start}`);
  assert.ok(to > from, `missing source boundary: ${end}`);
  return source.slice(from, to);
}

function buttonMarkup(markup, dataAttribute) {
  const escaped = dataAttribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markup.match(new RegExp(`<button\\b[^>]*${escaped}(?:=[^ >]+)?[^>]*>[\\s\\S]*?<\\/button>`, "i"))?.[0] || "";
}

function assertNamedIconControl(markup, dataAttribute) {
  const button = buttonMarkup(markup, dataAttribute);
  assert.ok(button, `missing icon control: ${dataAttribute}`);
  assert.match(button, /aria-label\s*=\s*["'][^"']{2,}["']/i, `${dataAttribute} needs an accessible name`);
  assert.match(button, /(?:title|data-hco-tooltip|aria-describedby)\s*=/i, `${dataAttribute} needs a visible tooltip contract`);
}

function resultAccepted(result) {
  return result === true || result?.ok === true || result?.valid === true || result?.accepted === true;
}

function resultRejected(result) {
  return result === false || result?.ok === false || result?.valid === false || result?.accepted === false;
}

function openingTagWith(attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`<(?:aside|section|nav|div)\\b[^>]*${escaped}[^>]*>`, "i"))?.[0] || "";
}

function sensitiveKeys(value, pathParts = [], found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...pathParts, key];
    if (/(?:password|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|credential)/i.test(key)) {
      found.push(nextPath.join("."));
    }
    sensitiveKeys(child, nextPath, found);
  }
  return found;
}

test("Cosmic OS is part of the critical home paint instead of an idle enhancement", () => {
  const critical = loader.match(/"home-critical"\s*:\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
  const enhancements = loader.match(/"home-enhancements"\s*:\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
  assert.match(critical, /home-cosmic-os\.css\?v=\d+/);
  assert.match(critical, /home-cosmic-os\.js\?v=\d+/);
  assert.doesNotMatch(enhancements, /home-cosmic-os\.(?:css|js)/);
});

test("Cosmic OS mounts as an opaque command deck instead of a modal overlay", () => {
  const shell = sourceBetween("function shellMarkup", "function saveState");
  const deckTag = openingTagWith("data-hco-command-deck");
  includesAll(shell, [
    "data-hco-command-deck",
    "data-hco-sidebar",
    "data-hco-workspace-scroll",
    "data-hco-inspector",
    "data-hco-status-bar"
  ], "command deck shell");
  assert.doesNotMatch(shell, /class=["'][^"']*hco-overlay/i, "the primary Cosmic OS surface must not be an overlay");
  assert.ok(deckTag, "missing direct Cosmic OS command deck");
  assert.doesNotMatch(deckTag, /role=["']dialog["']|aria-modal=["']true["']/i, "the primary Cosmic OS surface must not claim modal semantics");
  assert.doesNotMatch(shell, /\bhidden\b[^>]*data-hco-command-deck|data-hco-command-deck[^>]*\bhidden\b/i);
  assert.match(source, /(?:append|insertAdjacentHTML|replaceChildren)[\s\S]{0,240}(?:shellMarkup|data-hco-command-deck)/i, "mount must insert the command deck directly into the active home workspace");

  assert.match(styles, /\.hco-command-deck\s*\{[^}]*height:\s*calc\(\s*100dvh\s*-/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*overflow:\s*clip/s, "the deck itself must never become a programmatic scroll owner");
  assert.match(styles, /\.app-main\.hco-command-active\s*\{[^}]*overflow:\s*clip\s*!important/s, "the outer app shell must not scroll the fixed command deck");
  assert.match(source, /appMain\.style\.setProperty\("overflow-y",\s*"clip",\s*"important"\)/, "mount must lock the outer scroll owner");
  assert.match(source, /restoreProperty\("overflow-y",\s*instance\.appMainScroll\?\.overflowY/, "unmount must restore the previous outer scroll owner");
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*background:\s*(?!transparent)[^;}]+/s, "deck needs an opaque route surface");
  assert.match(styles, /grid-template-columns:[^;]*(?:240|248|256|264|272)px[^;]*(?:300|308|316|324|332|340)px/i, "desktop needs navigation, workspace and inspector columns");
});

test("command deck exposes one clear navigation model and contextual top actions", () => {
  assert.deepEqual(api.TABS.map(([id]) => id), ["brief", "inbox", "queue", "workspace", "automation", "tools", "mission", "profiles"]);
  includesAll(source, ["data-hco-command-open", "data-hco-focus-open", "data-hco-notifications-open", "data-hco-profile-open", "data-hco-sidebar-collapse", "data-hco-inspector-toggle"], "command deck navigation");
  assert.match(source, /<nav\b[^>]*aria-label=["'][^"']+["'][^>]*data-hco-sidebar/i);
  assert.match(source, /data-hco-nav-item[^>]*(?:aria-current|aria-selected)/i);
  assert.match(source, /data-hco-workspace-scroll[^>]*(?:role=["']main["']|aria-label=["'])/i);
  assert.match(source, /data-hco-inspector[^>]*(?:aria-label|aria-labelledby)=/i);
});

test("public command deck markup never exposes owner IDs or credentials", () => {
  const shell = sourceBetween("function shellMarkup", "function saveState");
  assert.doesNotMatch(shell, /ownerScope\s*\(|\bowner(?:Id)?\b|learnerProfileId/i);
  assert.doesNotMatch(shell, /access.?token|refresh.?token|authorization|password|secret/i);
  assert.doesNotMatch(source, /data-hco-footer-status[^\n]{0,200}(?:owner|ownerScope|learnerProfileId)/i);
  assert.match(shell, /(?:Local-first|Cục bộ|Đồng bộ)[\s\S]{0,260}(?:Offline|Tác vụ nền|Dung lượng|Bảo mật)/i);
});

test("icon-only command deck controls have accessible labels and tooltips", () => {
  const shell = sourceBetween("function shellMarkup", "function saveState");
  for (const control of [
    "data-hco-command-open",
    "data-hco-refresh",
    "data-hco-sidebar-collapse",
    "data-hco-inspector-toggle"
  ]) assertNamedIconControl(shell, control);
  assert.match(source, /data-hco-tooltip-role=["']tooltip["']|role=["']tooltip["']/i);
});

test("mobile command deck has one scroll owner, five-item bottom navigation and sheets", () => {
  includesAll(source, [
    "data-hco-mobile-nav", "data-hco-mobile-destination=\"brief\"", "data-hco-mobile-destination=\"inbox\"",
    "data-hco-mobile-destination=\"workspace\"", "data-hco-mobile-destination=\"search\"",
    "data-hco-mobile-destination=\"more\"", "data-hco-mobile-sidebar-sheet", "data-hco-inspector-sheet",
    "data-hco-sheet-backdrop", "data-hco-mobile-status"
  ], "mobile navigation");
  assert.match(styles, /\.hco-workspace-scroll\s*\{[^}]*min-(?:height|width):\s*0[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /@media\s*\(max-width:\s*(?:700|720|760|768)px\)[\s\S]*\.hco-mobile-nav\s*\{[^}]*display:\s*(?:grid|flex)/s);
  assert.match(styles, /@media\s*\(max-width:\s*(?:700|720|760|768)px\)[\s\S]*(?:mobile-sidebar-sheet|inspector-sheet)[\s\S]{0,1200}(?:82dvh|max-height:\s*(?:80|82|85)dvh)/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /@media\s*\(max-width:[^)]+\)[\s\S]*min-height:\s*(?:44|46|48)px/s, "mobile actions need a touch target of at least 44px");
  assert.match(styles, /@media\s*\(max-width:\s*768px\)[\s\S]*\.hco-concierge,\.hco-capture-dialog\s*\{[^}]*top:\s*auto[^}]*transform:\s*none/s, "mobile dialogs must reset the desktop centering transform");
  assert.match(styles, /\.hgc\.hco-command-host\s*\{[^}]*min-height:\s*min\(\s*560px\s*,\s*calc\(\s*100dvh\s*-/s, "short and zoomed viewports must not be forced to 560px");
  assert.match(styles, /\.hco-mobile-nav span\s*\{[^}]*font-size:\s*max\(\s*12px[^}]*--hco-font-scale/s, "mobile labels must remain readable and follow font scale");
});

test("capability resolver never promotes an unverified integration to available", () => {
  const resolveCapability = api.resolveCapabilityState || api.capabilityState;
  assert.equal(typeof resolveCapability, "function", "export resolveCapabilityState/capabilityState for truthful UI tests");

  const unknown = resolveCapability({});
  assert.ok(["unknown", "unverified"].includes(unknown?.state), "empty capability evidence must remain unknown");
  assert.equal(unknown?.available, false);

  const unsupported = resolveCapability({ supported: false });
  assert.equal(unsupported?.state, "unsupported");
  assert.equal(unsupported?.available, false);

  const disconnected = resolveCapability({ supported: true, requiresConnection: true, connected: false });
  assert.ok(["needs-connection", "disconnected"].includes(disconnected?.state));
  assert.equal(disconnected?.available, false);

  const verifiedLocal = resolveCapability({ supported: true, local: true, verified: true });
  assert.ok(["local", "available", "ready"].includes(verifiedLocal?.state));
  assert.equal(verifiedLocal?.available, true);

  assert.match(source, /(?:Cần kết nối|needs-connection|disconnected)/i);
  assert.doesNotMatch(source, /(?:default|initial)[^\n]{0,120}(?:available|ready|connected)\s*:\s*true/i);
});

test("settings cover presentation, motion, privacy, data, offline and accessibility", () => {
  includesAll(source, [
    "data-hco-settings", "data-hco-settings-appearance", "data-hco-settings-motion",
    "data-hco-settings-language", "data-hco-settings-notifications", "data-hco-settings-privacy",
    "data-hco-settings-data", "data-hco-settings-offline", "data-hco-settings-shortcuts",
    "data-hco-settings-accessibility", "data-hco-export", "data-hco-import", "data-hco-checkpoint",
    "data-hco-delete-data"
  ], "settings and privacy");
  includesAll(source, ["static", "balanced", "cinematic", "fontScale", "contrast", "density"], "validated presentation settings");
  assert.match(source, /data-hco-delete-data[^\n]{0,400}(?:confirm|confirmation|requiresConfirmation)/i);
  assert.match(source, /Dữ liệu[^\n]{0,220}(?:đồng bộ|sync)|(?:đồng bộ|sync)[^\n]{0,220}Dữ liệu/i, "sync settings must explain which data leaves the device");
});

test("Cosmic OS import validates schema, version, size and nested secrets", () => {
  const validateImport = api.validateImportPayload || api.validateCosmicImport;
  assert.equal(typeof validateImport, "function", "export validateImportPayload/validateCosmicImport for security tests");

  const valid = validateImport({
    schema: "hh-home-cosmic-os",
    version: 1,
    data: { activeTab: "brief", settings: { motion: "balanced", density: "comfortable" } }
  });
  assert.equal(resultAccepted(valid), true, "a small supported Cosmic OS export should validate");

  assert.equal(resultRejected(validateImport({ schema: "other-product", version: 1, data: {} })), true);
  assert.equal(resultRejected(validateImport({ schema: "hh-home-cosmic-os", version: 999, data: {} })), true);
  assert.equal(resultRejected(validateImport({
    schema: "hh-home-cosmic-os",
    version: 1,
    data: { settings: { nested: { accessToken: "never-import-this" } } }
  })), true);
  assert.equal(resultRejected(validateImport({
    schema: "hh-home-cosmic-os",
    version: 1,
    data: { note: "x".repeat(2_000_000) }
  })), true, "oversized imports must be rejected before persistence");
});

test("Cosmic OS exports are recursively redacted and preserve safe settings", () => {
  const safeExport = api.safeExportPayload || api.createSafeExportPayload;
  assert.equal(typeof safeExport, "function", "export safeExportPayload/createSafeExportPayload for privacy tests");
  const output = safeExport({
    activeTab: "workspace",
    settings: { motion: "balanced", fontScale: 1.1 },
    ownerId: "owner-private-123",
    email: "private@example.com",
    nested: {
      accessToken: "secret-access-token",
      refresh_token: "secret-refresh-token",
      password: "secret-password",
      safe: "keep-this"
    }
  });
  const serialized = JSON.stringify(output);
  assert.match(serialized, /workspace/);
  assert.match(serialized, /balanced/);
  assert.match(serialized, /keep-this/);
  assert.doesNotMatch(serialized, /owner-private|private@example|secret-access|secret-refresh|secret-password/i);
  assert.doesNotMatch(serialized, /ownerId|email|accessToken|refresh_token|password/i);
});

test("focus, permission, recovery and activity centers expose honest actions", () => {
  includesAll(source, [
    "data-hco-focus-center", "data-hco-focus-start", "data-hco-focus-pause", "data-hco-focus-resume",
    "data-hco-focus-notification-shield", "data-hco-focus-stats",
    "data-hco-permission-center", "microphone", "camera", "clipboard", "notifications",
    "data-hco-permission-check", "data-hco-permission-help",
    "data-hco-recovery-center", "data-hco-recovery-checkpoint", "data-hco-recovery-preview",
    "data-hco-recovery-confirm",
    "data-hco-activity-center", "data-hco-activity-filter", "data-hco-activity-undo"
  ], "operational centers");
  assert.match(source, /navigator\.permissions|permissions\?\.query/);
  assert.doesNotMatch(source, /data-hco-permission-(?:revoke|remove)[^\n]{0,240}(?:permission\.state\s*=|state\s*=\s*["']denied)/i, "the browser controls permission revocation, not page state");
  assert.match(source, /data-hco-activity-undo[^\n]{0,500}(?:undoable|canUndo|requiresConfirmation|confirm)/i);
  assert.match(source, /data-hco-recovery-confirm[^\n]{0,400}(?:preview|candidate|checkpoint)/i);
});

test("command deck supports universal search, context actions, security and custom layout", () => {
  includesAll(source, [
    "data-hco-universal-search", "data-hco-context-actions", "data-hco-security-center",
    "data-hco-quick-capture", "data-hco-smart-priority", "data-hco-dashboard-customize",
    "data-hco-dashboard-reset"
  ], "cross-platform centers");
  assert.match(source, /(?:route|tool|project|setting|command)[\s\S]{0,500}data-hco-universal-search/i);
  assert.match(source, /priorityReason|priority-reason|data-hco-priority-reason/i);
});

test("accessibility contract covers live updates, focus lifecycle and reduced motion", () => {
  includesAll(source, ["aria-live=\"polite\"", "focus", "Escape", "visibilitychange", "document.hidden"], "accessibility lifecycle");
  assert.match(source, /(?:trapFocus|focusTrap|data-hco-focus-sentinel|Tab[\s\S]{0,300}shiftKey)/i, "drawers and sheets need a focus trap");
  assert.match(source, /(?:lastFocus|returnFocus|focusBeforeOpen)[\s\S]{0,300}\.focus\?*\.?(?:\(\))?/i, "closing a surface must restore focus");
  assert.match(source, /data-hco-inspector[^\n]{0,500}(?:aria-expanded|aria-controls)/i);
  assert.match(source, /function setModalSurface[\s\S]{0,2200}(?:setAttribute\(\"inert\"|\.inert\s*=\s*true)[\s\S]{0,800}data-hco-sheet-backdrop/i, "modal sheets must make background controls inert and expose a backdrop");
  assert.match(source, /data-hco-mobile-status[^>]*role=["']status["'][^>]*aria-live=["']polite["']/i, "mobile status updates need an active live region");
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /prefers-reduced-motion[^}]*animation(?:-duration)?:\s*(?:none|0\.0?1ms)/s);
  assert.match(styles, /@media\s*\(forced-colors:\s*active\)/, "Windows high-contrast mode needs an explicit contract");
  assert.match(styles, /\.hco-command-deck[^}]*isolation:\s*isolate/s, "the active route must isolate its paint stack");
});

test("large local-first collections use versioned IndexedDB instead of localStorage", () => {
  includesAll(source, ["indexedDB", "schemaVersion", "migration", "workspace", "activity", "queue"], "versioned persistence");
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^\n]*(?:activity|workspace|queue|history)/i);
  assert.match(source, /(?:AbortController|controller\.abort)/);
  assert.match(source, /(?:clearInterval|cancelAnimationFrame)/);
  assert.match(source, /document\.hidden/);
});

test("V2 normalization migrates legacy V1 state without changing stable navigation or storage scope", () => {
  assert.match(String(api.VERSION), /^2\.\d+\.\d+$/);
  assert.equal(api.STORAGE_PREFIX, "hh.home.cosmic-os.v1", "V2 must continue reading the V1 scoped storage key");
  const migrated = api.normalizeState({
    schema: "hh-home-cosmic-os",
    version: 1,
    activeTab: "tools",
    profile: "creative",
    compact: true,
    pipeline: { idea: "done", script: "doing", publish: "todo" },
    focus: { duration: 1, completed: 7 },
    inboxPinned: Array.from({ length: 130 }, (_, index) => `item-${index}`)
  });
  assert.equal(migrated.schema, "hh-home-cosmic-os");
  assert.equal(migrated.version, 2);
  assert.equal(migrated.activeTab, "tools");
  assert.equal(migrated.profile, "creative");
  assert.equal(migrated.compact, true);
  assert.equal(migrated.pipeline.idea, "done");
  assert.equal(migrated.pipeline.script, "doing");
  assert.ok(Number.isFinite(migrated.focus.duration) && migrated.focus.duration >= 1 && migrated.focus.duration <= 120 * 60, "legacy focus duration must be normalized into the supported range");
  assert.equal(migrated.focus.completed, 7);
  assert.equal(migrated.inboxPinned.length, 100);
  assert.equal(migrated.settings.motion, "balanced");
  assert.equal(migrated.settings.fontScale, 1);
  assert.equal(migrated.settings.contrast, "normal");
  assert.equal(migrated.settings.density, "comfortable");
  assert.equal(migrated.settings.language, "vi");
  assert.equal(migrated.settings.notifications, true);
  assert.equal(migrated.settings.offline, true);
  assert.equal(migrated.settings.reducedEffectsWhileTyping, true);
});

test("settings normalization bounds every presentation value instead of trusting imported CSS state", () => {
  const normalized = api.normalizeState({
    activeTab: "not-a-tab",
    profile: "not-a-profile",
    settings: {
      motion: "warp-speed",
      fontScale: 99,
      contrast: "invisible",
      density: "zero-height",
      language: "unknown",
      notifications: false,
      offline: false,
      reducedEffectsWhileTyping: false
    }
  });
  assert.equal(normalized.activeTab, "brief");
  assert.equal(normalized.profile, "auto");
  assert.equal(normalized.settings.motion, "balanced");
  assert.equal(normalized.settings.fontScale, 1.3);
  assert.equal(normalized.settings.contrast, "normal");
  assert.equal(normalized.settings.density, "comfortable");
  assert.equal(normalized.settings.language, "vi");
  assert.equal(normalized.settings.notifications, false);
  assert.equal(normalized.settings.offline, false);
  assert.equal(normalized.settings.reducedEffectsWhileTyping, false);
});

test("custom module order, pins and themes normalize deterministically", () => {
  const allModules = api.TABS.map(([id]) => id);
  const state = api.normalizeState({
    moduleOrder: ["tools", "brief", "tools", "unknown"],
    pinnedModules: ["workspace", "tools", "workspace", "brief", "queue", "inbox", "profiles", "mission"],
    settings: { theme: "aurora" }
  });
  assert.deepEqual(state.moduleOrder.slice(0, 2), ["tools", "brief"]);
  assert.deepEqual([...new Set(state.moduleOrder)].sort(), [...allModules].sort());
  assert.equal(state.moduleOrder.length, allModules.length);
  assert.deepEqual(state.pinnedModules, ["workspace", "tools", "brief", "queue", "inbox"]);
  assert.equal(state.settings.theme, "aurora");
  assert.equal(api.normalizeState({ settings: { theme: "untrusted-css" } }).settings.theme, "deep-space");
});

test("workspace checkpoints restore and undo only validated presentation state", () => {
  for (const name of ["createWorkspaceSnapshot", "restoreWorkspaceSnapshot", "undoWorkspaceRestore"]) {
    assert.equal(typeof api[name], "function", `export ${name} for deterministic recovery tests`);
  }
  const before = api.normalizeState({ activeTab: "brief", profile: "work", settings: { theme: "deep-space", motion: "static" }, pipeline: { idea: "todo" } });
  const desired = api.normalizeState({ activeTab: "workspace", profile: "creative", settings: { theme: "aurora", motion: "balanced" }, pipeline: { idea: "done" }, ownerId: "must-not-enter-snapshot" });
  const snapshot = api.createWorkspaceSnapshot(desired, { id: "checkpoint-safe", label: "Bản an toàn", now: Date.parse("2026-08-24T10:00:00.000Z") });
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.id, "checkpoint-safe");
  assert.equal(snapshot.data.activeTab, "workspace");
  assert.equal(snapshot.data.settings.theme, "aurora");
  assert.doesNotMatch(JSON.stringify(snapshot), /ownerId|must-not-enter/);

  const restored = api.restoreWorkspaceSnapshot(before, snapshot);
  assert.equal(restored.ok, true);
  assert.equal(restored.state.activeTab, "workspace");
  assert.equal(restored.state.profile, "creative");
  assert.equal(restored.state.pipeline.idea, "done");
  assert.ok(restored.undo, "restore must create a reversible checkpoint");

  const undone = api.undoWorkspaceRestore(restored.state, restored.undo);
  assert.equal(undone.ok, true);
  assert.equal(undone.state.activeTab, "brief");
  assert.equal(undone.state.profile, "work");
  assert.equal(undone.state.settings.motion, "static");
  assert.equal(api.restoreWorkspaceSnapshot(before, { data: null }).ok, false);
});

test("module customization helpers preserve a complete unique navigation order", () => {
  for (const name of ["reorderModules", "togglePinnedModule", "orderedModuleIds"]) {
    assert.equal(typeof api[name], "function", `export ${name} for customization tests`);
  }
  const moduleIds = api.TABS.map(([id]) => id);
  const reordered = api.reorderModules(moduleIds, "workspace", "up");
  assert.equal(reordered.indexOf("workspace"), moduleIds.indexOf("workspace") - 1);
  assert.deepEqual([...reordered].sort(), [...moduleIds].sort());
  assert.equal(new Set(reordered).size, moduleIds.length);

  let pins = [];
  for (const id of moduleIds.slice(0, 6)) pins = api.togglePinnedModule(pins, id, 5);
  assert.equal(pins.length, 5);
  assert.equal(new Set(pins).size, pins.length);
  assert.ok(pins.every((id) => moduleIds.includes(id)));
  assert.deepEqual(api.togglePinnedModule(pins, pins[0], 5), pins.slice(1));

  const ordered = api.orderedModuleIds({ moduleOrder: reordered, pinnedModules: pins });
  assert.deepEqual(ordered.slice(0, pins.length), pins);
  assert.deepEqual([...ordered].sort(), [...moduleIds].sort());
});

test("notification digest and automation dry-run are deterministic and side-effect free", () => {
  assert.equal(typeof api.buildNotificationDigest, "function");
  assert.equal(typeof api.automationDryRun, "function");
  const now = Date.parse("2026-08-24T12:00:00.000Z");
  const input = [
    { id: "a", origin: "work", read: false, priority: "high" },
    { id: "b", origin: "work", read: true },
    { id: "c", origin: "learning", read: false, snoozedUntil: new Date(now + 60_000).toISOString() },
    null
  ];
  const first = api.buildNotificationDigest(input, { now });
  const second = api.buildNotificationDigest(structuredClone(input), { now });
  assert.deepEqual(first, second);
  assert.equal(first.total, 3);
  assert.equal(first.unread, 2);
  assert.equal(first.urgent, 1);
  assert.equal(first.snoozed, 1);
  assert.equal(first.groups.reduce((sum, group) => sum + group.total, 0), first.total);

  const dryRun = api.automationDryRun({
    id: "publish-safe",
    label: "Kiểm tra quy trình",
    steps: [
      ["Mở dự án", "/work"],
      ["Gửi nội dung", "/media-design"],
      ["Đường dẫn lỗi", "javascript:alert(1)"]
    ]
  }, { now });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.executable, false);
  assert.ok(dryRun.steps.every((step) => step.executed === false));
  assert.equal(dryRun.steps[2].route, "/home");
  assert.equal(dryRun.steps[1].needsConfirmation, true);
  assert.equal(dryRun.requiresConfirmation, true);
  assert.equal(api.automationDryRun("does-not-exist", { now }).ok, false);
});

test("health and capability states require positive evidence, including non-null latency", () => {
  assert.deepEqual(api.missionStatus({}), { state: "unknown", label: "Chưa xác minh", verified: false });
  assert.equal(api.missionStatus({ ok: true }).state, "unknown");
  assert.equal(api.missionStatus({ ok: true, latency: null }).state, "unknown", "null latency is not a measurement");
  assert.equal(api.missionStatus({ ok: true, latency: "" }).state, "unknown", "empty latency is not a measurement");
  assert.equal(api.missionStatus({ ok: true, latency: 0 }).state, "online");
  assert.equal(api.missionStatus({ ok: true, responded: true }).state, "online");

  const resolve = api.resolveCapabilityState;
  for (const evidence of [
    { local: true },
    { connected: true },
    { available: true },
    { supported: true, requiresConnection: true, connected: true }
  ]) {
    const state = resolve(evidence);
    assert.equal(state.available, false, `unverified evidence must stay unavailable: ${JSON.stringify(evidence)}`);
  }
  assert.equal(resolve({ local: true, verified: true }).state, "local");
  assert.equal(resolve({ connected: true, verified: true }).state, "available");
});

test("export, import and normalized legacy snapshots cannot persist disguised credentials", () => {
  const disguised = {
    note: "Authorization: Bearer very-private-token-value",
    nested: { value: "sk-proj-example-secret-value-1234567890", safe: "keep" }
  };
  const exported = api.safeExportPayload(disguised);
  const serialized = JSON.stringify(exported);
  assert.match(serialized, /keep/);
  assert.doesNotMatch(serialized, /very-private-token|sk-proj-example-secret/i);

  const importWithSecretValue = api.validateImportPayload({
    schema: "hh-home-cosmic-os",
    version: 2,
    data: { settings: { note: "Authorization: Bearer imported-private-token" } }
  });
  assert.equal(resultRejected(importWithSecretValue), true);

  const prototypePayload = JSON.parse('{"schema":"hh-home-cosmic-os","version":2,"data":{"__proto__":{"polluted":true}}}');
  assert.equal(resultRejected(api.validateImportPayload(prototypePayload)), true, "dangerous object keys must be rejected before normalization");
  assert.equal(resultRejected(api.validateImportPayload({ schema: "hh-home-cosmic-os", version: 2, data: [] })), true);

  const legacy = api.normalizeState({
    lastSnapshot: { data: { accessToken: "legacy-token", safe: "checkpoint" } },
    captures: [{ id: "capture-1", type: "note", password: "legacy-password", text: "safe note" }]
  });
  assert.deepEqual(sensitiveKeys(legacy), [], `normalized state retained sensitive fields: ${sensitiveKeys(legacy).join(", ")}`);
  assert.doesNotMatch(JSON.stringify(legacy), /legacy-token|legacy-password/);
});

test("modal-like sheets and capture surfaces expose dialog semantics without changing the direct command deck", () => {
  const deck = openingTagWith("data-hco-command-deck");
  assert.doesNotMatch(deck, /role=["']dialog["']|aria-modal=["']true["']/i);
  for (const marker of ["data-hco-mobile-sidebar-sheet", "data-hco-inspector-sheet", "data-hco-concierge", "data-hco-capture-dialog"]) {
    const tag = openingTagWith(marker);
    assert.ok(tag, `missing surface ${marker}`);
    assert.match(tag, /role=["']dialog["']/i, `${marker} needs dialog semantics`);
    assert.match(tag, /aria-modal=["']true["']/i, `${marker} locks the background and must be modal to assistive technology`);
    assert.match(tag, /(?:aria-label|aria-labelledby)=["'][^"']+["']/i, `${marker} needs an accessible name`);
  }
  const moreButton = buttonMarkup(source, 'data-hco-mobile-destination="more"');
  assert.match(moreButton, /aria-controls=["'][^"']+["']/i);
  assert.match(moreButton, /aria-expanded=/i);
});

test("visibility and typing state pause decorative motion without pausing real work", () => {
  const lifecycle = sourceBetween("function bindEvents", "async function syncState");
  assert.match(lifecycle, /visibilitychange/);
  assert.match(lifecycle, /document\.hidden[\s\S]{0,300}(?:hcoMotionPaused|is-motion-paused|motion-paused)/i, "hidden tabs must set a dedicated motion pause state");
  assert.match(styles, /(?:data-hco-motion-paused|is-motion-paused)[^{]*\{[^}]*(?:animation-play-state:\s*paused|animation:\s*none)/s);
  assert.match(source, /reducedEffectsWhileTyping[\s\S]{0,800}(?:data-hco-typing|is-typing|typing-active)/i);
  assert.match(styles, /(?:data-hco-typing|is-typing|typing-active)[^{]*\{[^}]*(?:animation-play-state:\s*paused|animation:\s*none|opacity:)/s);
  assert.match(styles, /\.hco-root\[data-hco-motion=["']static["']\][\s\S]{0,400}animation:\s*none/s);
});

test("animation CSS stays within a bounded compositor-friendly budget", () => {
  const keyframeNames = [...styles.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
  const infiniteAnimations = [...styles.matchAll(/animation\s*:\s*([^;}]*\binfinite\b[^;}]*)(?:[;}])/g)].map((match) => match[1]);
  const blurValues = [...styles.matchAll(/(?:filter|backdrop-filter)\s*:[^;}]*blur\((\d+(?:\.\d+)?)px\)/g)].map((match) => Number(match[1]));
  assert.ok(keyframeNames.length > 0 && keyframeNames.length <= 32, `expected 1-32 scoped keyframes, found ${keyframeNames.length}`);
  assert.equal(new Set(keyframeNames).size, keyframeNames.length, "keyframe names must be unique");
  assert.ok(infiniteAnimations.length <= 24, `too many declared infinite animations for the per-module budget: ${infiniteAnimations.length}`);
  assert.ok(blurValues.every((value) => value <= 32), `filter blur budget exceeded: ${blurValues.join(", ")}px`);
  assert.doesNotMatch(styles, /transition\s*:\s*all\b/i, "transition only properties that actually animate");

  for (const block of styles.match(/@keyframes\s+[\w-]+\s*\{[^@]*?\}\s*\}/gs) || []) {
    assert.doesNotMatch(block, /(?:^|[;{])\s*(?:top|right|bottom|left|width|height|margin|padding)\s*:/m, "keyframes must not animate layout properties");
  }
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
