"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const asPattern = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test("Communication Suite maps every product workspace to a real engine", () => {
  const source = read("communication-suite.js");
  const context = { window: {}, location: { hash: "" }, CustomEvent: class {}, console };
  context.window.window = context.window;
  vm.runInNewContext(source, context);
  const suite = context.window.HHCommunicationSuite;
  assert.ok(suite);
  for (const view of ["command-center", "unified-inbox", "messenger", "channels", "forum", "live-room", "calls", "shared-canvas", "automation", "hh-spaces", "notifications", "universal-search", "smart-catch-up", "onboarding", "moderation"]) {
    assert.equal(suite.supports(view), true, view);
    assert.ok(suite.views[view].engine, view);
  }
  assert.equal(suite.supports("not-real"), false);
});

test("shell navigation and route renderer expose the complete suite", () => {
  const shell = read("script.js");
  for (const route of ["unified-inbox", "messenger", "channels", "forum", "live-room", "shared-canvas", "notifications", "universal-search", "onboarding", "moderation", "automation", "hh-spaces", "smart-catch-up"]) {
    assert.match(shell, new RegExp(`/communication/${route}`));
  }
  assert.match(shell, /HHCommunicationSuite\?\.supports/);
  assert.match(shell, /HHCommunicationSuite\.mount/);
  assert.match(shell, /route\.startsWith\("\/communication\/"\)/);
});

test("all communication assets are versioned in HTML and service worker", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  const assets = [
    "communication-suite", "communication-command-center", "communication-messenger-next",
    "communication-channels-forum", "communication-live-room", "communication-canvas-automation",
    "communication-intelligence"
  ];
  for (const asset of assets) {
    for (const extension of ["css", "js"]) {
      const file = `${asset}.${extension}?v=1`;
      assert.match(html, asPattern(file), file);
      assert.match(worker, asPattern(file), file);
    }
  }
});

test("backend protocol advertises truthful capabilities and bounded events", () => {
  const backend = read("realtime-server/src/communication-v2.js");
  for (const event of ["comm:presence:update", "comm:channel:join", "comm:typing", "comm:message:send", "comm:message:ack", "comm:room:sync", "comm:canvas:op", "comm:moderation:report", "comm:moderation:audit"]) {
    assert.match(backend, new RegExp(event.replace(/:/g, "\\:")), event);
  }
  assert.match(backend, /endToEndEncryption:\s*false/);
  assert.match(backend, /objectStorage: options\.hasObjectStorage \? "configured" : "unavailable"/);
  assert.match(backend, /createRateLimiter/);
});
