"use strict";

// Install a pinned, verified, same-origin runtime; not a browser CDN dependency.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const VERSION = "0.55.1";
const URL = `https://registry.npmjs.org/monaco-editor/-/monaco-editor-${VERSION}.tgz`;
const INTEGRITY = "jz4x+TJNFHwHtwuV9vA9rMujcZRb0CEilTEwG2rRSpe/A7Jdkuj8xPKttCgOh+v/lkHy7HsZ64oj+q3xoAFl9A==";
const destination = path.resolve(__dirname, `../vendor/monaco-${VERSION}`);
const select = name => name === "LICENSE" || name === "ThirdPartyNotices.txt" ||
  /^min\/vs\/(editor\/editor\.main\.(js|css)|loader\.js|nls\.messages-loader\.js|nls\.messages\.js\.js|_commonjsHelpers-|editor\.api-|workers-|monaco\.contribution-|lspLanguageFeatures-|jsonMode-|tsMode-|htmlMode-|cssMode-|javascript-|typescript-|markdown-|html-|css-|basic-languages\/monaco\.contribution\.js|language\/(json|typescript|html|css)\/monaco\.contribution\.js|assets\/(editor|json|ts|html|css)\.worker-)/.test(name);

async function main() {
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`Runtime download: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash("sha512").update(archive).digest("base64") !== INTEGRITY) throw new Error("Archive integrity mismatch.");
  const tar = zlib.gunzipSync(archive), manifest = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const entry = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/s, "");
    if (!entry) break;
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/s, ""), 8) || 0;
    const name = entry.replace(/^package\//, "");
    if (select(name)) {
      const target = path.resolve(destination, name);
      if (!target.startsWith(destination + path.sep)) throw new Error("Unsafe archive path.");
      const bytes = tar.subarray(offset + 512, offset + 512 + size);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
      manifest.push({ path: name, bytes: size, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ version: VERSION, source: URL, integrity: `sha512-${INTEGRITY}`, files: manifest }, null, 2) + "\n");
  console.log(`Installed ${manifest.length} files, ${(manifest.reduce((n, row) => n + row.bytes, 0) / 1048576).toFixed(2)} MiB. Runtime is lazy-loaded only by Code Editor.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
