const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("the retired Hikari assistant is absent from the client, cache and API", () => {
  const sources = [
    read("performance-loader.js"),
    read("system-platform.js"),
    read("sw.js"),
    read("vercel.json"),
    read("api/modules/[moduleId]/actions.js")
  ].join("\n");

  assert.doesNotMatch(sources, /home-virtual-assistant|virtualAssistant|hikari-assistant|HHVirtualAssistant|data-system-hikari|assistantTts|X-Hikari/i);

  for (const file of [
    "home-virtual-assistant.js",
    "home-virtual-assistant.css",
    "services/virtualAssistantCore.js",
    "services/virtualAssistantActions.js",
    "services/virtualAssistantCommands.js",
    "services/virtualAssistantVoice.js",
    "services/virtualAssistantCharacter.js",
    "assets/hikari-h/hikari-h-original-v1-alpha.webp"
  ]) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must stay removed`);
});

test("Home renders from the critical shell without a blocking asset group", () => {
  const loader = read("performance-loader.js");
  const router = read("script.js");

  assert.match(loader, /if \(value === "\/home"\) return \[\]/);
  assert.match(loader, /function groupsForRoute\(route\) \{\s*return featureGroupsForRoute\(route\);\s*\}/);
  assert.match(router, /if \(normalized === "\/home"\) \{\s*hideCosmicRouteLoaderImmediately\(\);\s*return;/);
  assert.match(router, /setTimeout\(\(\) => \{\s*hideCosmicRouteLoaderImmediately\(\);[\s\S]*?\}, 8000\)/);
});
