"use strict";
// Reproducible vendor copy of the official, pinned Apache-2.0 browser SDK.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.dirname(path.dirname(require.resolve("livekit-client")));
const manifest = require(path.join(source, "package.json"));
if (manifest.version !== "2.22.3") throw Error("Expected livekit-client 2.22.3");
fs.copyFileSync(path.join(source, "dist/livekit-client.umd.js"), path.join(root, "vendor/livekit-client-2.22.3.umd.js"));
fs.copyFileSync(path.join(source, "LICENSE"), path.join(root, "vendor/livekit-client-LICENSE.txt"));
console.log("Synced official LiveKit client " + manifest.version + " and license");
