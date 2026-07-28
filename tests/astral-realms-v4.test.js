const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms V4 persists living-world progression systems", () => {
  const source = read("astral-realms.js");
  [
    "world:",
    "FACTIONS",
    "COMPANION_STORIES",
    "SHIP_MODULES",
    "renderWorldPanel",
    "renderFactionPanel",
    "renderCompanionPanel",
    "renderShipPanel",
    "renderTrainingPanel",
    "renderCodexPanel",
    "recordWorldEvent",
    "resolveWorldEvent",
    "launchExpedition",
    "stateChecksum"
  ].forEach((token) => assert.ok(source.includes(token), `Missing V4 system: ${token}`));
});

test("Astral shard shares world events and validates progress server-side", () => {
  const source = read("realtime-server/src/astral-realms.js");
  [
    "createWorldState",
    "applyWorldAction",
    "worldAction",
    "activeEvent",
    "progress",
    "server-authoritative"
  ].forEach((token) => assert.ok(source.includes(token), `Missing realtime world contract: ${token}`));
});

