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

test("Cosmic OS is part of the critical home paint instead of an idle enhancement", () => {
  const critical = loader.match(/"home-critical"\s*:\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
  const enhancements = loader.match(/"home-enhancements"\s*:\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
  assert.match(critical, /home-cosmic-os\.css\?v=\d+/);
  assert.match(critical, /home-cosmic-os\.js\?v=\d+/);
  assert.doesNotMatch(enhancements, /home-cosmic-os\.(?:css|js)/);
});

test("Cosmic OS mounts as an opaque command deck instead of a modal overlay", () => {
  const shell = sourceBetween("function shellMarkup", "function saveState");
  includesAll(shell, [
    "data-hco-command-deck",
    "data-hco-sidebar",
    "data-hco-workspace-scroll",
    "data-hco-inspector",
    "data-hco-status-bar"
  ], "command deck shell");
  assert.doesNotMatch(shell, /class=["'][^"']*hco-overlay/i, "the primary Cosmic OS surface must not be an overlay");
  assert.doesNotMatch(shell, /aria-modal=["']true["']/i, "the primary Cosmic OS surface must not claim modal semantics");
  assert.doesNotMatch(shell, /\bhidden\b[^>]*data-hco-command-deck|data-hco-command-deck[^>]*\bhidden\b/i);
  assert.match(source, /(?:append|insertAdjacentHTML|replaceChildren)[\s\S]{0,240}(?:shellMarkup|data-hco-command-deck)/i, "mount must insert the command deck directly into the active home workspace");

  assert.match(styles, /\.hco-command-deck\s*\{[^}]*height:\s*calc\(\s*100dvh\s*-/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*background:\s*(?!transparent)[^;}]+/s, "deck needs an opaque route surface");
  assert.match(styles, /grid-template-columns:[^;]*(?:240|248|256|264|272)px[^;]*(?:300|308|316|324|332|340)px/i, "desktop needs navigation, workspace and inspector columns");
});

test("command deck exposes one clear navigation model and contextual top actions", () => {
  includesAll(source, [
    "Hôm nay", "Hộp thư", "Hàng đợi", "Workspace", "Tự động", "Tiện ích", "Hệ thống", "Cấu hình",
    "data-hco-command-open", "data-hco-focus-open", "data-hco-notifications-open", "data-hco-profile-open",
    "data-hco-sidebar-collapse", "data-hco-inspector-toggle"
  ], "command deck navigation");
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
    "data-hco-mobile-destination=\"more\"", "data-hco-mobile-sidebar-sheet", "data-hco-inspector-sheet"
  ], "mobile navigation");
  assert.match(styles, /\.hco-workspace-scroll\s*\{[^}]*min-(?:height|width):\s*0[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /@media\s*\(max-width:\s*(?:700|720|760|768)px\)[\s\S]*\.hco-mobile-nav\s*\{[^}]*display:\s*(?:grid|flex)/s);
  assert.match(styles, /@media\s*\(max-width:\s*(?:700|720|760|768)px\)[\s\S]*(?:mobile-sidebar-sheet|inspector-sheet)[\s\S]{0,1200}(?:82dvh|max-height:\s*(?:80|82|85)dvh)/s);
  assert.match(styles, /\.hco-command-deck\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /@media\s*\(max-width:[^)]+\)[\s\S]*min-height:\s*(?:44|46|48)px/s, "mobile actions need a touch target of at least 44px");
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
