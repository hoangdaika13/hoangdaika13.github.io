const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("application shell contains a recoverable route error boundary", () => {
  const client = read("script.js");
  const css = read("app-shell.css");

  assert.match(client, /const renderRouteSafely =/);
  assert.match(client, /isExpectedRuntimeCancellation/);
  assert.match(client, /rememberRuntimeIssue/);
  assert.match(client, /hh\.runtime\.issues\.v1/);
  assert.match(client, /data-shell-retry-route/);
  assert.match(client, /HHRuntimeDiagnostics/);
  assert.match(client, /unhandledrejection/);
  assert.match(css, /\.app-runtime-error/);
});
