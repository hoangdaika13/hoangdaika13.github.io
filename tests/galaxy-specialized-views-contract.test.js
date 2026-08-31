const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const communitySource = read("galaxy-community-showcase.js");
const communityStyles = read("galaxy-community-showcase.css");
const desktopSource = read("galaxy-web-desktop.js");
const desktopStyles = read("galaxy-web-desktop.css");
const loaderSource = read("performance-loader.js");
const routerSource = read("script.js");
const serviceWorkerSource = read("sw.js");
const indexSource = read("index.html");
const shellStyles = read("galaxy-shell.css");
const community = require("../galaxy-community-showcase.js");
const desktop = require("../galaxy-web-desktop.js");
const functionBlock = (source, name, nextName) => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
};

test("specialized views own only their canonical route and lifecycle API", () => {
  assert.equal(community.canHandle("/communication/community"), true);
  assert.equal(community.canHandle("#/communication/community?post=42"), true);
  assert.equal(community.canHandle("/galaxy/community-showcase"), true);
  assert.equal(community.canHandle("/galaxy/community"), false);
  assert.equal(desktop.canHandle("/system/desktop"), true);
  assert.equal(desktop.canHandle("#/system/desktop"), true);
  assert.equal(desktop.canHandle("/galaxy/web-desktop"), true);
  assert.equal(desktop.canHandle("/system"), false);
  for (const api of [community, desktop]) {
    for (const method of ["mount", "unmount", "canHandle", "getState"]) assert.equal(typeof api[method], "function", method);
    assert.ok(Object.isFrozen(api));
  }
});

test("Community Showcase normalizes only supplied backend evidence", () => {
  const data = community.normalizePayload({
    posts: [{
      id: "real-post", title: "Dự án thật", type: "project", reactionCount: 7,
      comments: [{ id: "c1" }], author: { id: "author-1", name: "Tác giả", followerCount: 12 }
    }],
    featuredCreator: { id: "author-1", name: "Tác giả", followerCount: 12 },
    leaderboard: [{ id: "author-1", name: "Tác giả", followerCount: 12 }],
    stats: { projects: 1, creators: 1 }
  });
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].reactions, 7);
  assert.equal(data.items[0].comments, 1);
  assert.equal(data.featured.followers, 12);
  assert.equal(data.leaderboard[0].followers, 12);
  assert.deepEqual(data.stats, { projects: 1, creators: 1 });

  const empty = community.normalizePayload({});
  assert.deepEqual(empty.items, []);
  assert.deepEqual(empty.leaderboard, []);
  assert.deepEqual(empty.stats, {});

  const malformed = community.normalizePayload({
    posts: [null, undefined, "not-a-post", [], { id: "valid-post", title: "Bài hợp lệ" }],
    suggestions: [null, "not-a-person", []],
    featuredCreator: "not-a-person",
    leaderboard: [null, 42, []]
  });
  assert.deepEqual(malformed.items.map((item) => item.id), ["valid-post"]);
  assert.deepEqual(malformed.suggestions, []);
  assert.equal(malformed.featured, null);
  assert.deepEqual(malformed.leaderboard, []);
});

test("Community uses real adapter/API states and contains no fabricated showcase counters", () => {
  for (const state of ["loading", "ready", "cached", "empty", "offline", "configuration-required", "error"]) {
    assert.match(communitySource, new RegExp(state.replace("-", "\\-")), state);
  }
  assert.match(communitySource, /adapter\.loadShowcase/);
  assert.match(communitySource, /global\.HHCommunity\.api/);
  assert.match(communitySource, /\/api\/community/);
  assert.match(communitySource, /Chỉ hiển thị lượt tương tác/);
  assert.match(communitySource, /Không tạo thứ hạng hoặc điểm số minh họa/);
  assert.doesNotMatch(communitySource, /12\.5K|89\.2K|45,672|2,847|1\.2M|Premium Member|AI Architect/);
  assert.doesNotMatch(communitySource, /Math\.random/);
  assert.doesNotMatch(communitySource, /<iframe|window\.open\s*\(/i);
  assert.match(communitySource, /data-gcs-view="grid"/);
  assert.match(communitySource, /data-gcs-view="list"/);
  assert.match(communitySource, /data-gcs-search/);
  assert.match(communitySource, /data-gcs-filter/);
  assert.match(communitySource, /data-gcs-sort/);
  assert.match(communitySource, /runtime\.filter === filter\[0\]/);
  assert.match(communitySource, /runtime\.sort === "oldest"/);
  assert.match(communitySource, /data-gcs-empty-state/);
  assert.match(communitySource, /function emptyShowcaseMarkup/);
  assert.match(communitySource, /gcs-card--skeleton/);
  assert.match(communitySource, /các khung phía sau chỉ giữ bố cục/);
  assert.match(communitySource, /SHOWCASE - CỘNG ĐỒNG HH/);
  assert.match(communitySource, /Thống kê đang chờ backend/);
  assert.match(communitySource, /Chưa có số liệu/);
  assert.match(communitySource, /postIdFromRoute\(options\.route\)/);
  assert.match(communitySource, /revealRequestedPost\(runtime\)/);
  assert.match(communitySource, /openItemDetail\(runtime, item\)/);
  assert.match(communitySource, /aria-current="page"/);
  assert.match(communitySource, /aria-label="Mở /);
  assert.match(communitySource, /aria-labelledby/);
  assert.match(communitySource, /hh\.auth\.guest-user/);
  assert.match(communitySource, /requestController\?\.abort/);
  assert.match(communitySource, /requestId !== runtime\.requestId/);
  assert.match(communitySource, /data-gcs-skip/);
  assert.match(communitySource, /opener\.focus/);
});

test("Community external media and displayed text are constrained", () => {
  assert.match(communitySource, /function safeUrl\(value\)/);
  assert.match(communitySource, /\["http:", "https:", "blob:"\]/);
  assert.match(communitySource, /function escapeHtml\(value\)/);
  assert.doesNotMatch(communitySource, /src="\$\{[^}]*thumbnail/);
  assert.match(communitySource, /AbortController/);
  assert.match(communitySource, /controller\?\.abort/);
  assert.match(communitySource, /replaceChildren\(\)/);
});

test("Web Desktop is explicit opt-in with a three-launcher resource governor", () => {
  assert.equal(desktop.MAX_WINDOWS, 3);
  assert.equal(desktop.apps.length, 6);
  assert.equal(new Set(desktop.apps.map((app) => app.id)).size, desktop.apps.length);
  desktop.apps.forEach((app) => {
    assert.match(app.route, /^\/[a-z0-9/-]+$/i);
    assert.ok(app.title);
  });
  assert.match(desktopSource, /value\.enabled === true/);
  assert.match(desktopSource, /var MAX_WINDOWS = 3/);
  assert.match(desktopSource, /runtime\.windows\.length >= MAX_WINDOWS/);
  assert.match(desktopSource, /data-gwd-action="enable"/);
  assert.match(desktopSource, /data-gwd-action="disable"/);
  assert.match(desktopSource, /data-gwd-action="launcher"/);
  assert.match(desktopSource, /data-gwd-action="minimize"/);
  assert.match(desktopSource, /data-gwd-action="close"/);
  assert.match(desktopSource, /data-gwd-search/);
  assert.match(desktopSource, /Không tìm thấy ứng dụng phù hợp/);
  assert.match(desktopSource, /Launcher nhẹ/);
  assert.match(desktopSource, /Không tự phát âm thanh, video hoặc mở AudioContext/);
  assert.doesNotMatch(desktopSource, /new AudioContext|createElement\(["']iframe/);
});

test("Web Desktop reports only browser evidence and labels its measurement scope", () => {
  assert.match(desktopSource, /performance && global\.performance\.memory/);
  assert.match(desktopSource, /navigator\?\.storage\?\.estimate/);
  assert.match(desktopSource, /navigator\?\.getBattery/);
  assert.match(desktopSource, /serviceWorker/);
  assert.match(desktopSource, /Chỉ số thuộc tab\/origin này, không phải CPU hoặc RAM toàn máy/);
  assert.match(desktopSource, /Chưa có adapter Project/);
  assert.doesNotMatch(desktopSource, /CPU\s*32%|RAM\s*68%|Network\s*78%|12\.5K|99\.9%/);
  assert.doesNotMatch(desktopSource, /Math\.random/);
  assert.match(desktopSource, /Preview tĩnh · Không thực thi mã/);
  assert.match(desktopSource, /Xem trước tĩnh · Mở ứng dụng để bắt đầu/);
  assert.match(desktopSource, /gwd-editor-shell/);
  assert.match(desktopSource, /gwd-dock-brand/);
  assert.match(desktopSource, /aria-label="' \+ escapeHtml\(app\.title\)/);
});

test("Web Desktop owns timers, listeners and persistent layout cleanup", () => {
  assert.match(desktopSource, /AbortController/);
  assert.match(desktopSource, /controller\?\.abort/);
  assert.match(desktopSource, /clearInterval/);
  assert.match(desktopSource, /visibilitychange/);
  assert.match(desktopSource, /entry\.replaceChildren\(\)/);
  assert.match(desktopSource, /runtime\.positions/);
  assert.match(desktopSource, /pointercancel/);
  assert.match(desktopSource, /NOTE_KEY/);
});

test("Web Desktop evidence and visibility updates never remount the workspace", () => {
  const evidenceUpdate = functionBlock(desktopSource, "collectEvidence", "startDrag");
  const eventBinding = functionBlock(desktopSource, "bind", "tickClock");
  const localEvidencePatch = functionBlock(desktopSource, "updateSystemEvidence", "updateVisibilityState");
  const localVisibilityPatch = functionBlock(desktopSource, "updateVisibilityState", "openApp");
  const windowInteractions = functionBlock(desktopSource, "openApp", "formatBytes");
  const windowPatchHelpers = functionBlock(desktopSource, "focusLater", "announce");

  assert.doesNotMatch(evidenceUpdate, /\brender\s*\(/);
  assert.doesNotMatch(eventBinding.match(/visibilitychange[\s\S]*?\}, options\);/)[0], /\brender\s*\(/);
  assert.doesNotMatch(localEvidencePatch, /runtime\.root\.innerHTML|rootMarkup\(|\brender\s*\(/);
  assert.doesNotMatch(localVisibilityPatch, /runtime\.root\.innerHTML|rootMarkup\(|\brender\s*\(/);
  assert.match(localEvidencePatch, /\[data-gwd-window="system"\] \.gwd-window-body/);
  assert.match(localEvidencePatch, /body\.innerHTML = systemRows\(runtime\)/);
  assert.match(localEvidencePatch, /scrollTop/);
  assert.match(localVisibilityPatch, /desktop\.dataset\.gwdPaused/);
  assert.match(localVisibilityPatch, /governor\.outerHTML = statusPill\(runtime\)/);
  assert.match(evidenceUpdate, /updateSystemEvidence\(runtime\)/);
  assert.match(eventBinding, /updateVisibilityState\(runtime\)/);
  assert.doesNotMatch(windowInteractions, /\brender\s*\(/);
  assert.match(windowInteractions, /insertWindow\(runtime, id\)/);
  assert.match(windowInteractions, /removeWindow\(runtime, id\)/);
  assert.match(windowPatchHelpers, /toggleMinimize/);
  assert.doesNotMatch(windowPatchHelpers, /runtime\.root\.innerHTML|rootMarkup\(|\brender\s*\(/);
});

test("Web Desktop runtime preserves the mounted root during evidence and visibility patches", async () => {
  const originalStorage = global.localStorage;
  const originalNavigator = Object.getOwnPropertyDescriptor(global, "navigator");
  const originalDocument = global.document;
  let visibilityHandler = null;
  const systemBody = { innerHTML: "", scrollTop: 17 };
  const desktopNode = { dataset: {} };
  const governorNode = { outerHTML: "unchanged" };
  const root = {
    dataset: {}, writes: 0, markup: "", listeners: [],
    set innerHTML(value) { this.markup = value; this.writes += 1; },
    get innerHTML() { return this.markup; },
    querySelector(selector) {
      if (selector === '[data-gwd-window="system"] .gwd-window-body') return systemBody;
      if (selector === "[data-gwd-desktop]") return desktopNode;
      if (selector === ".gwd-governor") return governorNode;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, listener) { this.listeners.push([type, listener]); },
    replaceChildren() { this.markup = ""; }
  };

  try {
    global.localStorage = {
      getItem(key) {
        return key === "hh.galaxy.web-desktop.v1"
          ? JSON.stringify({ enabled: true, windows: ["system"], activeId: "system", minimized: [], positions: {} })
          : null;
      },
      setItem() {}
    };
    Object.defineProperty(global, "navigator", { configurable: true, value: {
      storage: { estimate: async () => ({ usage: 1024, quota: 2048 }) },
      getBattery: async () => ({ level: 0.75, charging: false }),
      connection: { effectiveType: "4g", downlink: 8 },
      serviceWorker: { controller: {} }
    } });
    global.document = {
      hidden: false,
      addEventListener(type, listener) { if (type === "visibilitychange") visibilityHandler = listener; }
    };

    assert.equal(desktop.mount(root, { route: "/system/desktop" }), true);
    assert.equal(root.writes, 1, "mount writes the initial workspace once");
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(root.writes, 1, "evidence collection must not replace the root");
    assert.match(systemBody.innerHTML, /Origin Storage/);
    assert.equal(systemBody.scrollTop, 17, "local evidence patch preserves window scroll");

    global.document.hidden = true;
    visibilityHandler();
    assert.equal(root.writes, 1, "visibility changes must not replace the root");
    assert.equal(desktopNode.dataset.gwdPaused, "true");
    assert.match(governorNode.outerHTML, /Tab nền · preview tạm dừng/);
  } finally {
    desktop.unmount(root);
    if (originalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalStorage;
    if (originalNavigator) Object.defineProperty(global, "navigator", originalNavigator);
    else delete global.navigator;
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});

test("specialized styles remain scoped, responsive and accessible", () => {
  assert.match(communityStyles, /\[data-gcs-root\]/);
  assert.match(desktopStyles, /\[data-gwd-root\]/);
  for (const styles of [communityStyles, desktopStyles]) {
    assert.match(styles, /:focus-visible/);
    assert.match(styles, /prefers-reduced-motion:\s*reduce/);
    assert.match(styles, /forced-colors:\s*active/);
    assert.match(styles, /@media \(max-width:/);
    assert.doesNotMatch(styles, /(?:^|\n)\s*(?:html|body|:root)\s*\{/);
    assert.doesNotMatch(styles, /(?:^|\n)\s*(?:button|input|main|article|section)\s*\{/);
  }
  assert.match(desktopStyles, /\.gwd-stage \{ display: flex; flex-direction: column;/);
  assert.match(desktopStyles, /\.gwd-window \{ position: relative; inset: auto;[^}]*flex: 0 0 auto; width: 100%; max-width: 100%; min-width: 0;/);
  assert.match(communityStyles, /\.gcs-tabs select \{ position: static; margin-left: 0; \}/);
  assert.match(communityStyles, /\.gcs-tabs \{ width: 100%; max-width: 100%;/);
  assert.match(communityStyles, /\.gcs-title > button \{ margin-right: 0; \}/);
  assert.match(communityStyles, /\.gcs-right \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); transform: none; \}/);
  assert.match(communityStyles, /\.gcs-layout \{ display: contents; \}/);
  assert.match(communityStyles, /\.gcs-skeleton-grid \{ display: none; \}/);
  assert.match(communityStyles, /\.gcs-state--overlay \{ position: relative; top: auto; left: auto; width: 100%;/);
  assert.match(communityStyles, /\.gcs-title \{ position: relative; align-items: flex-start; padding-right: 48px; \}/);
  assert.match(communityStyles, /\.gcs-title h1 \{ max-width: none;[^}]*text-wrap: balance;[^}]*white-space: normal; \}/);
  assert.match(communityStyles, /\.gcs-title > button \{ position: absolute; top: 0; right: 0;/);
  assert.match(communityStyles, /\.gcs-title h1 \{ max-width: 100%;[^}]*overflow-wrap: anywhere;[^}]*text-wrap: balance; white-space: normal; \}/);
  assert.match(communityStyles, /\.gcs-tabs \{[^}]*overscroll-behavior-inline: contain;[^}]*scrollbar-color:[^}]*scroll-snap-type: x proximity;\s*\}/);
  assert.match(communityStyles, /\.gcs-card footer > div \{[^}]*font-size: 0\.65rem; line-height: 1\.35; \}/);
  assert.match(communityStyles, /@media \(min-width: 901px\) and \(max-width: 1450px\)[\s\S]*\.gcs-metrics \{ grid-template-columns: repeat\(3,[^}]*\}[\s\S]*\.gcs-metrics :is\(small, em\)/);
  assert.match(communityStyles, /@media \(max-width: 900px\)[\s\S]*\.gcs-brand small,[\s\S]*font-size: 10px/);
  assert.match(desktopStyles, /grid-template-columns: minmax\(220px, 1fr\) minmax\(360px, 426px\) minmax\(260px, 1fr\)/);
  assert.match(desktopStyles, /\.gwd-window > header strong \{[^}]*overflow-wrap: anywhere; white-space: normal; \}/);
  assert.match(desktopStyles, /\.gwd-dock \{ gap: 5px;[^}]*overflow-x: auto;[^}]*overscroll-behavior-inline: contain;[^}]*scroll-snap-type: x proximity;\s*\}/);
  assert.match(desktopStyles, /\.gwd-system-list strong \{[^}]*font-size: 0\.66rem; \}/);
  assert.match(desktopStyles, /\.gwd-dock > button:hover,[\s\S]{0,100}transform: none;/);
  assert.match(desktopStyles, /@media \(min-width: 901px\) and \(max-width: 1450px\)[\s\S]*\[data-gwd-root\] small,[\s\S]*font-size: 10px/);
  assert.match(desktopStyles, /@media \(max-width: 900px\)[\s\S]*\[data-gwd-root\] small,[\s\S]*font-size: 10px/);
  assert.match(desktopStyles, /\.gwd-window\[data-gwd-window="ai"\] \{[^}]*width: 392px;[^}]*min-height: 435px;[^}]*max-height: 435px; \}/);
  assert.match(desktopStyles, /\.gwd-window\[data-gwd-window="system"\] \{[^}]*width: 420px; height: 275px; min-height: 275px; \}/);
  assert.match(desktopSource, /runtime\.dragCleanup\?\.\(\)/);
  assert.match(desktopSource, /lostpointercapture/);
  assert.match(desktopStyles, /calc\(100% - 420px\)/);
});

test("specialized views are route-lazy, router-owned and versioned for release", () => {
  assert.match(loaderSource, /"galaxy-community-showcase"[\s\S]*galaxy-community-showcase\.css\?v=9[\s\S]*galaxy-community-showcase\.js\?v=5/);
  assert.match(loaderSource, /"galaxy-web-desktop"[\s\S]*galaxy-web-desktop\.css\?v=10[\s\S]*galaxy-web-desktop\.js\?v=5/);
  assert.match(loaderSource, /value === "\/communication\/community"[\s\S]{0,360}return \["galaxy-community-showcase"\]/);
  assert.match(loaderSource, /value = value\.split\("\?"\)\[0\]/);
  assert.match(loaderSource, /value === "\/system\/desktop"[\s\S]{0,100}\["galaxy-web-desktop"\]/);
  assert.match(routerSource, /HHGalaxyCommunityShowcase\?\.canHandle/);
  assert.match(routerSource, /const routePath = route\.split\("\?"\)\[0\]/);
  assert.match(routerSource, /"\/galaxy\/community-showcase"/);
  assert.match(routerSource, /"\/galaxy\/web-desktop"/);
  assert.match(routerSource, /HHGalaxyWebDesktop\?\.canHandle/);
  assert.match(routerSource, /HHGalaxyCommunityShowcase\?\.unmount/);
  assert.match(routerSource, /HHGalaxyWebDesktop\?\.unmount/);
  assert.match(serviceWorkerSource, /hh-identity-portal-v\d+/);
  for (const asset of ["galaxy-community-showcase.css?v=9", "galaxy-community-showcase.js?v=5", "galaxy-web-desktop.css?v=10", "galaxy-web-desktop.js?v=5"]) {
    assert.match(serviceWorkerSource, new RegExp(asset.replaceAll(".", "\\.").replace("?", "\\?")), asset);
  }
  assert.match(indexSource, /<script src="performance-loader\.js\?v=\d+"/);
  assert.match(indexSource, /script\.js\?v=\d+/);
  assert.match(indexSource, /galaxy-shell\.css\?v=\d+/);
  assert.match(routerSource, /dataset\.galaxyImmersive === "true"/);
  assert.match(shellStyles, /body\.app-shell-enabled #appShell\[data-galaxy-shell\]\[data-galaxy-immersive="true"\] ~ \.app-mobile-nav[\s\S]{0,80}display:\s*none\s*!important/);
});
