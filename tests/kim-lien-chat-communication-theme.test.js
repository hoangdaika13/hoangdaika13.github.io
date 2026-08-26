"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const chat = read("chat-ai-hub.css");
const comms = read("communication-workspace-fix.css");

test("Chat AI owns an opaque Kim Lien surface and removes its galaxy layer", () => {
  assert.match(chat, /\/\* Kim Lien Dien/);
  assert.match(chat, /\.chat-ai-cosmos\s*\{\s*display:\s*none\s*!important/);
  assert.match(chat, /--cai-kl-bg:\s*#1a0708/);
  assert.match(chat, /linear-gradient\(145deg, #1a0708, #260b0d/);
  assert.match(chat, /chat-ai-message__body/);
  assert.match(chat, /chat-ai-code/);
  assert.match(chat, /chat-ai-composer/);
});

test("Chat history, stream and inspector keep independent scroll ownership", () => {
  assert.match(chat, /\.chat-ai-session-list[\s\S]*?overflow-y:\s*auto/);
  assert.match(chat, /\.chat-ai-stream[\s\S]*?scroll-padding-block/);
  assert.match(chat, /\.chat-ai-inspector__body[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(chat, /\.chat-ai-composer\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/);
  assert.match(chat, /height:\s*min\(82dvh/);
  assert.match(chat, /is-sessions-open,.is-inspector-open\) \.chat-ai-layout \{ z-index: 60/);
  assert.match(chat, /\.chat-ai-mobile-backdrop\s*\{[\s\S]*?position:\s*fixed[\s\S]*?background:\s*rgba\(18, 4, 5, \.9\)/);
  assert.match(chat, /\.chat-ai-mode-tabs\s*\{\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});

test("Communication cartridges share Kim Lien tokens and bounded message scroll", () => {
  for (const selector of [".hcc", ".hmn-shell", ".hcf-app", ".communication-live-room", ".hh-communication-ca", ".hci-shell"]) {
    assert.ok(comms.includes(selector), `missing Communication theme: ${selector}`);
  }
  assert.match(comms, /--comms-bg:\s*#1a0708/);
  assert.match(comms, /\.comms-engine-host[\s\S]*?overflow-y:\s*auto/);
  assert.match(comms, /\.hmn-message-list[\s\S]*?overflow-y:\s*auto/);
  assert.match(comms, /\.hmn-composer[\s\S]*?position:\s*sticky/);
  assert.match(comms, /\.hmn-conversation\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?max-width:\s*100%/);
  assert.match(comms, /height:\s*min\(82dvh/);
  assert.match(comms, /\.comms-mobile-sheet::before\s*\{[\s\S]*?position:\s*absolute[\s\S]*?transform:\s*translateX\(-50%\)/);
  assert.match(comms, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("critical boot and route loading are opaque Kim Lien before lazy CSS", () => {
  const html = read("index.html");
  assert.match(html, /Kim Liên first paint/);
  assert.match(html, /#hhBootSurface \.hh-boot-mark\{[^}]*#e2b347/);
  assert.match(html, /#appCosmicLoader:not\(\[hidden\]\)\{background:[^}]*#351514/);
  assert.match(html, /app-cosmic-loader__card\{[^}]*rgba\(58,20,17,\.995\)/);
  assert.match(html, /app-cosmic-loader__progress>i\{background:linear-gradient\(90deg,#7b2b21/);
});
