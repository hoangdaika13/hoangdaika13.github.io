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
