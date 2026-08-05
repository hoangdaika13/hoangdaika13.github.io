const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "config.js"), "utf8");
const productionApi = "https://hoangdaika13-github-io.vercel.app";

function loadConfig({ hostname, origin, port = "", protocol = "https:", search = "", apiBase = "" }) {
  const context = {
    URLSearchParams,
    location: { hostname, origin, port, protocol, search },
    window: apiBase ? { HH_API_BASE: apiBase } : {}
  };
  vm.runInNewContext(source, context);
  return context.window;
}

test("custom domain keeps REST requests same-origin", () => {
  const config = loadConfig({ hostname: "www.nhhoang13all.xyz", origin: "https://www.nhhoang13all.xyz" });
  assert.equal(config.HH_API_BASE, "https://www.nhhoang13all.xyz");
  assert.equal(config.HH_REALTIME_URL, config.HH_API_BASE);
});

test("GitHub Pages and plain local static servers use the public Vercel API", () => {
  const github = loadConfig({ hostname: "hoangdaika13.github.io", origin: "https://hoangdaika13.github.io" });
  const local = loadConfig({ hostname: "127.0.0.1", origin: "http://127.0.0.1:8765", port: "8765", protocol: "http:" });
  assert.equal(github.HH_API_BASE, productionApi);
  assert.equal(local.HH_API_BASE, productionApi);
});

test("vercel dev and embedding shells can explicitly override the API origin", () => {
  const local = loadConfig({ hostname: "localhost", origin: "http://localhost:3000", port: "3000", protocol: "http:", search: "?api=local" });
  const embedded = loadConfig({ hostname: "localhost", origin: "http://localhost:8765", port: "8765", protocol: "http:", apiBase: "https://api.example.test/" });
  assert.equal(local.HH_API_BASE, "http://localhost:3000");
  assert.equal(embedded.HH_API_BASE, "https://api.example.test");
});

test("API Center uses the REST origin with cookies and no-store semantics", () => {
  const client = fs.readFileSync(path.join(root, "script.js"), "utf8");
  assert.match(client, /const API_URL = String\(window\.HH_API_BASE \|\| REALTIME_URL \|\| location\.origin\)/);
  assert.match(client, /credentials:\"include\",cache:\"no-store\"/);
  assert.match(client, /fetch\(`\$\{API_URL\}\$\{path\}`/);
  assert.doesNotMatch(client, /fetch\(`\$\{REALTIME_URL\}\$\{path\}`,options\)/);
});
