const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Settings Studio is lazy-loaded only for the workspace settings route", () => {
  const loader = read("performance-loader.js");
  const html = read("index.html");
  const shell = read("script.js");
  assert.match(loader, /settings:\s*\{[\s\S]*settings-studio\.css\?v=7[\s\S]*settings-studio\.js\?v=9/);
  assert.match(loader, /if \(value === "\/settings"\) return \["settings"\]/);
  assert.match(html, /performance-loader\.js\?v=467/);
  assert.match(shell, /HHSettingsStudio\?\.mount\?\.\(workspace\)/);
  assert.match(shell, /app-settings-route/);
  assert.doesNotMatch(shell, /Mở Appearance Studio<\/button><button type=button data-dashboard-shortcuts/);
});

test("Settings Studio exposes every requested functional area", () => {
  const client = read("settings-studio.js");
  const themeSystem = read("app-theme-system.js");
  const themeStyles = read("app-theme-system.css");
  for (const contract of [
    "data-hhs-preview", "data-hhs-undo", "data-hhs-redo", "data-hhs-save",
    "data-hhs-export", "data-hhs-import", "data-hhs-clear-cache",
    "data-hhs-test-notification", "data-hhs-voice-test", "data-hhs-search",
    "settings:update", "settings:test-notification", "beforeunload", "MAX_HISTORY",
    "data-hhs-security-audit", "data-hhs-security-report", "data-hhs-storage-persist",
    "Không lưu token trong localStorage", "hh-auth-token", "motion.portalSound", "Âm thanh Singularity Gate"
  ]) assert.match(client, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const section of ["appearance", "layout", "motion", "accessibility", "locale", "performance", "notifications", "security", "data"])
    assert.match(client, new RegExp(`\\["${section}"`));
  assert.match(themeSystem, /applyWorkspaceSettings/);
  assert.match(themeSystem, /hh\.settings-studio\.v1/);
  assert.match(themeStyles, /body\.hh-settings-applied/);
  assert.match(themeStyles, /app-sidebar__pinned/);
});

test("Client normalization rejects unknown values and clamps numeric settings", () => {
  const sandbox = {
    window: { dispatchEvent() {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    structuredClone,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(read("settings-studio.js"), sandbox, { filename: "settings-studio.js" });
  const api = sandbox.window.HHSettingsStudio;
  assert.ok(api);
  const value = api.normalize({
    appearance: { theme: "remote-code", accent: "javascript:alert(1)", textZoom: 999 },
    layout: { sidebarWidth: 1, pinnedRoutes: ["/home", "https://evil.invalid", "/home"] },
    notifications: { quietStart: "99:99" },
    motion: { portalSound: "yes" },
    security: { autoLockMinutes: 999, privacyShield: "yes" },
    data: { syncScope: "unknown" }
  });
  assert.equal(value.appearance.theme, "cosmic");
  assert.equal(value.appearance.accent, "#72e7ff");
  assert.equal(value.appearance.textZoom, 150);
  assert.equal(value.layout.sidebarWidth, 216);
  assert.deepEqual([...value.layout.pinnedRoutes], ["/home"]);
  assert.equal(value.notifications.quietStart, "22:00");
  assert.equal(value.motion.portalSound, false);
  assert.equal(value.security.autoLockMinutes, 0);
  assert.equal(value.security.privacyShield, false);
  assert.equal(value.data.syncScope, "device");
});

test("Server normalization uses the same strict allow-list", () => {
  const api = require("../utils/account-center-api").__test;
  const value = api.normalizeWorkspaceSettings({
    appearance: { theme: "bad", glow: "#ABCDEF", glassOpacity: -4 },
    performance: { pixelRatio: 20, maxFps: 2 },
    layout: { pinnedRoutes: Array(8).fill("/chat-ai") },
    motion: { portalSound: true },
    security: { autoLockMinutes: 30, privacyShield: true },
    data: { syncScope: "account" }
  });
  assert.equal(value.appearance.theme, "cosmic");
  assert.equal(value.appearance.glow, "#abcdef");
  assert.equal(value.appearance.glassOpacity, 35);
  assert.equal(value.performance.pixelRatio, 2);
  assert.equal(value.performance.maxFps, 24);
  assert.equal(value.motion.portalSound, true);
  assert.deepEqual(value.layout.pinnedRoutes, ["/chat-ai"]);
  assert.equal(value.security.autoLockMinutes, 30);
  assert.equal(value.security.privacyShield, true);
  assert.equal(value.data.syncScope, "account");
});

test("Service worker contains the new versioned Settings Studio assets", () => {
  const worker = read("sw.js");
  assert.match(worker, /hh-identity-portal-v822/);
  assert.match(worker, /settings-studio\.css\?v=7/);
  assert.match(worker, /settings-studio\.js\?v=9/);
  assert.match(worker, /app-theme-system\.js\?v=9/);
  assert.match(worker, /script\.js\?v=232/);
});
