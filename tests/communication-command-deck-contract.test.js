"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("communication-suite.js");
const styles = read("communication-suite.css");
const workspaceStyles = read("communication-workspace-fix.css");
const communicationSource = fs.readdirSync(root)
  .filter((file) => /^communication-[a-z0-9-]+\.js$/i.test(file))
  .map((file) => read(file))
  .join("\n");

const EXPECTED_VIEWS = Object.freeze([
  "command-center", "unified-inbox", "messenger", "channels", "forum",
  "live-room", "calls", "shared-canvas", "automation", "hh-spaces",
  "notifications", "universal-search", "smart-catch-up", "onboarding", "moderation"
]);

function loadSuite() {
  const window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    HHRealtimeSocket: null
  };
  const context = {
    window,
    location: { hash: "" },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: (callback) => callback(),
    cancelAnimationFrame() {},
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    console,
    Date,
    Math,
    JSON,
    Object,
    Set,
    Map,
    Array,
    String,
    Number,
    Boolean
  };
  window.window = window;
  window.document = context.document;
  vm.runInNewContext(source, context, { filename: "communication-suite.js" });
  return window.HHCommunicationSuite;
}

function acceptedState(result) {
  return String(result?.state || result?.status || result || "").toLowerCase();
}

function includesAll(haystack, values, label) {
  for (const value of values) assert.ok(haystack.includes(value), `${label} missing contract: ${value}`);
}

test("Communication Cockpit groups every one of the fifteen views exactly once", () => {
  const suite = loadSuite();
  assert.deepEqual(Object.keys(suite.views).sort(), [...EXPECTED_VIEWS].sort());
  const groups = suite.viewGroups || suite.groups;
  assert.ok(Array.isArray(groups), "suite must export viewGroups/groups for the grouped sidebar");
  assert.ok(groups.length >= 4 && groups.length <= 6, "fifteen views should be split into a small number of understandable groups");
  for (const group of groups) {
    assert.equal(typeof group.id, "string");
    assert.ok(String(group.label || "").trim().length >= 2);
    assert.ok(Array.isArray(group.views) && group.views.length > 0);
  }
  const groupedViews = groups.flatMap((group) => group.views);
  assert.deepEqual([...new Set(groupedViews)].sort(), [...EXPECTED_VIEWS].sort());
  assert.equal(groupedViews.length, EXPECTED_VIEWS.length, "a view must not appear in two sidebar groups");
  includesAll(source, ["data-comms-cockpit", "data-comms-sidebar", "data-comms-sidebar-group", "data-comms-view"], "grouped cockpit sidebar");
});

test("desktop Cockpit is a direct 100dvh workspace with one scroll owner", () => {
  includesAll(source, [
    "data-comms-cockpit", "data-comms-sidebar", "data-comms-engine-host",
    "data-comms-scroll-owner=\"workspace\"", "data-comms-inspector"
  ], "desktop cockpit");
  assert.match(styles + workspaceStyles, /\.communication-suite\s*\{[^}]*height:\s*calc\(\s*100dvh\s*-/s);
  assert.match(styles, /\.communication-suite\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.comms-cockpit-body\s*\{[^}]*grid-template-columns:[^;}]+[^}]*min-height:\s*0/s);
  assert.match(styles, /\.comms-engine-host\s*\{[^}]*min-(?:height|width):\s*0[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s);
  assert.doesNotMatch(styles, /\.comms-suite-head\s+nav\s*\{[^}]*overflow-x:\s*auto/s, "fifteen views belong in the grouped sidebar, not a horizontal tab strip");
  assert.match(workspaceStyles, /body\.app-communication-route[^}]*overflow:\s*hidden/s);
});

test("Cockpit typography is readable instead of using micro-labels", () => {
  assert.match(styles, /\.communication-suite\s*\{[^}]*(?:font-size:\s*(?:16px|1rem)|--comms-font-body:\s*16px)/s);
  assert.match(styles, /\.comms-sidebar[^}]*font-size:\s*(?:14|15|16)px/s);
  assert.match(styles, /\.comms-engine-host[^}]*font-size:\s*(?:16|17|18)px/s);
  assert.doesNotMatch(styles, /font-size:\s*(?:[0-9]|1[01])px\b/, "Communication shell text must never shrink below 12px");
  assert.doesNotMatch(styles, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(styles, /letter-spacing:\s*-/);
});

test("capability resolver distinguishes local, adapter, realtime and verified provider evidence", () => {
  const suite = loadSuite();
  const resolve = suite.resolveCapability || suite.capabilityState;
  assert.equal(typeof resolve, "function", "suite must export resolveCapability/capabilityState");

  const unavailable = resolve({});
  assert.ok(["unavailable", "unknown", "unverified"].includes(acceptedState(unavailable)));
  assert.equal(unavailable?.available, false);

  const local = resolve({ local: true });
  assert.equal(acceptedState(local), "local");
  assert.equal(local?.available, true);

  const adapter = resolve({ adapter: { connected: true, confirmed: true } });
  assert.equal(acceptedState(adapter), "adapter");
  assert.equal(adapter?.available, true);

  const realtime = resolve({ realtime: { connected: true, confirmed: true } });
  assert.equal(acceptedState(realtime), "realtime");
  assert.equal(realtime?.available, true);

  const unverifiedProvider = resolve({ provider: { configured: true, verified: false } });
  assert.ok(["needs-verification", "unverified", "unavailable"].includes(acceptedState(unverifiedProvider)));
  assert.equal(unverifiedProvider?.available, false);

  const provider = resolve({ provider: { configured: true, verified: true, connected: true } });
  assert.equal(acceptedState(provider), "provider");
  assert.equal(provider?.available, true);
  includesAll(source, ["data-comms-capability", "data-capability-source"], "capability labels");
});

test("engine presence alone is not advertised as a connected capability", () => {
  assert.doesNotMatch(source, /if\s*\(engine\?\.(?:supports|mount)[^)]*\)\s*return\s*["']Sẵn sàng["']/i);
  assert.doesNotMatch(source, /(?:adapter|realtime|provider)[^\n]{0,100}(?:connected|verified)\s*:\s*true[^\n]{0,100}(?:default|initial|fallback)/i);
  assert.match(source, /Realtime chưa được xác nhận|realtime[^\n]{0,100}(?:unknown|unverified|chưa xác nhận)/i);
  assert.match(communicationSource, /Không mã hóa đầu cuối|Chưa bật E2EE|endToEndEncryption:\s*false/i);
  assert.doesNotMatch(communicationSource, /(?:E2EE|mã hóa đầu cuối)[^\n.]{0,100}(?:đã bật|hoạt động|active|ready|verified)/i);
  assert.doesNotMatch(communicationSource, /(?:onlineUsers|onlineCount)\s*:\s*(?:[1-9]\d*|Math\.)/i, "local seeds must not invent online people");
});

test("retry remounts only the failed engine and never reloads the page", () => {
  assert.match(source, /data-comms-retry/);
  assert.doesNotMatch(source, /(?:window\.)?location\.reload\s*\(/, "retry must preserve route, focus and local drafts");
  assert.match(source, /function\s+(?:retryCurrentView|remountEngine|mountEngine)\b/);
  assert.match(source, /data-comms-retry[\s\S]{0,800}(?:retryCurrentView|remountEngine|mountEngine)\s*\(/);
  assert.match(source, /(?:mountedEngine|currentHost)[\s\S]{0,400}(?:unmount|destroy)[\s\S]{0,400}(?:mountEngine|\.mount)/i);
});

test("mobile uses five destinations and accessible bottom sheets", () => {
  const suite = loadSuite();
  const mobileViews = suite.mobileViews || suite.MOBILE_VIEWS;
  assert.deepEqual([...(mobileViews || [])], ["command-center", "unified-inbox", "messenger", "live-room", "more"]);
  includesAll(source, [
    "data-comms-mobile-nav", "data-comms-mobile-destination=\"command-center\"",
    "data-comms-mobile-destination=\"unified-inbox\"", "data-comms-mobile-destination=\"messenger\"",
    "data-comms-mobile-destination=\"live-room\"", "data-comms-mobile-destination=\"more\"",
    "data-comms-mobile-sheet", "data-comms-sheet-close"
  ], "mobile cockpit");
  assert.match(source, /data-comms-mobile-sheet[^>]*(?:role=["']dialog["']|aria-modal=["']true["'])/i);
  assert.match(source, /data-comms-mobile-destination[^>]*(?:aria-label|aria-current)/i);
  assert.match(styles, /@media\s*\(max-width:\s*(?:720|760|768)px\)[\s\S]*\.comms-mobile-nav\s*\{[^}]*display:\s*(?:grid|flex)/s);
  assert.match(styles, /\.comms-mobile-sheet\s*\{[^}]*(?:height|max-height):\s*(?:80|82|85)dvh/s);
  assert.match(styles, /\.comms-mobile-nav[^}]*min-height:\s*(?:44|46|48|50|52|54|56)px/s);
  assert.match(source + styles, /comms-sheet-open/);
});

test("visibility changes pause decorative work and reduced motion remains complete", () => {
  includesAll(source, ["visibilitychange", "document.hidden", "data-comms-motion-paused"], "visibility lifecycle");
  assert.match(source, /(?:pauseMotion|pauseAnimations|setMotionPaused|cancelAnimationFrame)/);
  assert.match(source, /(?:resumeMotion|resumeAnimations|setMotionPaused|requestAnimationFrame)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /prefers-reduced-motion[^}]*animation(?:-duration)?:\s*(?:none|0\.0?1ms)/s);
  assert.match(styles, /\[data-comms-motion-paused=["']true["']\][^{]*\*?\s*\{[^}]*(?:animation-play-state:\s*paused|animation:\s*none)/s);
});

test("Cockpit navigation, status and sheets have complete accessibility semantics", () => {
  includesAll(source, ["aria-live=\"polite\"", "Escape", "data-comms-return-focus"], "accessibility lifecycle");
  assert.match(source, /<nav\b[^>]*data-comms-sidebar[^>]*aria-label=["'][^"']+["']/i);
  assert.match(source, /data-comms-view[^>]*aria-current=/i);
  assert.match(source, /data-comms-engine-host[^>]*(?:role=["']main["']|aria-label=["'])/i);
  assert.match(source, /data-comms-mobile-sheet[^\n]{0,500}(?:aria-labelledby|aria-label)/i);
  assert.match(source, /(?:trapFocus|focusTrap|event\.key\s*===\s*["']Tab["'])/);
  assert.match(source, /(?:returnFocus|focusBeforeOpen|data-comms-return-focus)[\s\S]{0,500}\.focus/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(forced-colors:\s*active\)/);
});

test("mount lifecycle cleans listeners and preserves the current view across remounts", () => {
  assert.match(source, /suiteListeners/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /(?:AbortController|suiteListeners\s*=\s*\[\])/);
  assert.match(source, /currentView|mountedView|activeView/);
  assert.match(source, /(?:focusSnapshot|scrollSnapshot|scrollTop|preventScroll)/);
  assert.doesNotMatch(source, /host\.innerHTML\s*=\s*["']{0,1}["']{0,1}\s*;[\s\S]{0,120}location\.reload/i);
});
