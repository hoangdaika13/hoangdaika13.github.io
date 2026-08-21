"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../social-media-tools-core.js");
global.HHSocialMediaCore = core;
const workspaces = require("../social-media-tools-workspaces.js");

test("all 85 tools have an explicit workspace definition", () => {
  assert.deepEqual(workspaces.validateCatalog(core.TOOL_CATALOG), { missing:[], extra:[] });
  assert.equal(Object.keys(workspaces.definitions).length, 85);
});

test("tools from different families render different workspace structures", () => {
  const project = core.defaultProject({});
  const tool = (id) => core.TOOL_CATALOG.find((item) => item.id === id);
  const alt = workspaces.render(tool("alt-text-checker"), project);
  const post = workspaces.render(tool("instagram-post"), project);
  const chat = workspaces.render(tool("whatsapp-mockup"), project);
  const calendar = workspaces.render(tool("calendar"), project);
  const analytics = workspaces.render(tool("analytics"), project);
  assert.equal(alt.kind, "accessibility"); assert.match(alt.html, /smw-accessibility/); assert.equal(alt.upload, false); assert.equal(alt.exportImage, false);
  assert.equal(post.kind, "social-post"); assert.match(post.html, /smw-social-frame/); assert.equal(post.upload, true); assert.equal(post.exportImage, true);
  assert.match(chat.html, /smw-phone/); assert.match(calendar.html, /smw-week/); assert.match(analytics.html, /smw-analytics/);
  assert.equal(new Set([alt.html,post.html,chat.html,calendar.html,analytics.html]).size, 5);
});

test("only asset-oriented workspaces request upload or image export", () => {
  const get = (id) => workspaces.definitions[id];
  assert.equal(get("case-converter").upload, false); assert.equal(get("case-converter").exportImage, false);
  assert.equal(get("instagram-filter").upload, true); assert.equal(get("instagram-filter").exportImage, true);
  assert.equal(get("color-palette").upload, true); assert.equal(get("color-palette").exportImage, false);
  assert.equal(get("approval").upload, false); assert.equal(get("analytics").exportImage, false);
});

test("platform workspaces expose platform-specific identity and interactive controls", () => {
  const project = core.defaultProject({});
  const pick = (id) => workspaces.render(core.TOOL_CATALOG.find((item) => item.id === id), project).html;
  assert.match(pick("instagram-post"), /carousel/);
  assert.match(pick("instagram-post"), /data-smt2-interaction="preview-action"/);
  assert.match(pick("tiktok-kit"), /safe-zone|SAFE-ZONE/i);
  assert.match(pick("reddit-formatter"), /markdown|MARKDOWN/i);
  assert.match(pick("case-converter"), /data-smt2-interaction="case-mode"/);
  assert.match(pick("emoji-picker"), /data-smt2-interaction="emoji-insert"/);
  assert.match(pick("calendar"), /data-smt2-interaction="calendar-event"/);
});

test("communication workspaces expose distinct modes and controls", () => {
  const project = core.defaultProject({});
  const pick = (id) => workspaces.render(core.TOOL_CATALOG.find((item) => item.id === id), project).html;
  const strategy = pick("content-strategy-brief");
  const copy = pick("hook-library");
  const safety = pick("brand-safety-audit");
  const measurement = pick("kpi-planner");
  assert.match(strategy, /smw-communication is-strategy/);
  assert.match(copy, /smw-communication is-copy/);
  assert.match(safety, /smw-communication is-safety/);
  assert.match(measurement, /smw-communication is-measurement/);
  assert.notEqual(strategy, copy);
  assert.match(pick("analytics"), /data-smt2-interaction="analytics-filter"/);
  assert.match(pick("community-inbox"), /data-smt2-interaction="inbox-filter"/);
  assert.match(pick("hashtag-workspace"), /data-smt2-interaction="hashtag-group"/);
  assert.match(pick("unicode-font-styler"), /data-smt2-interaction="font-style"/);
});

test("workspace buttons are all wired to an explicit action", () => {
  const project = core.defaultProject({});
  for (const tool of core.TOOL_CATALOG) {
    const html = workspaces.render(tool, project).html;
    for (const match of html.matchAll(/<button\b([^>]*)>/g)) {
      assert.match(match[1], /data-smt2-/, `${tool.id} has a decorative button: ${match[0]}`);
    }
  }
});
