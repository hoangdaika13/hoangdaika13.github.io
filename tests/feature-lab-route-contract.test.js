const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Professional Toolkit uses dedicated dynamic routes and mounts the selected tool", () => {
  const shell = read("script.js");
  const lab = read("feature-lab.js");

  assert.match(shell, /route === "\/tools" \|\| route\.startsWith\("\/tools\/"\)/);
  assert.match(shell, /HHFeatureLab\?\.mount/);
  assert.match(shell, /location\.hash = `#\/tools\/\$\{nextToolId\}`/);
  assert.match(lab, /data-lab-feature/);
  assert.match(lab, /onNavigate\(next\.id\)/);
  assert.match(lab, /HHPlatformTools/);
  assert.match(lab, /HHToolWorkspace/);
  assert.match(lab, /HHUtilityTools/);
});

test("platform loader includes runtime, manifests, dedicated suites and nested tool routes", () => {
  const loader = read("performance-loader.js");
  assert.match(read("index.html"), /performance-loader\.js\?v=17/);
  for (const asset of [
    "tool-manifests.js?v=1",
    "tool-runtime.js?v=1",
    "feature-lab.js?v=6",
    "platform-tools.js?v=1",
    "tool-workspace-pro.js?v=1",
    "utility-lab-tools.js?v=9"
  ]) assert.match(loader, new RegExp(asset.replace(/[.?+]/g, "\\$&")));
  assert.match(loader, /value\.startsWith\("\/tools"\)/);
});

test("toolkit source is UTF-8 and service worker publishes the new assets", () => {
  for (const file of ["feature-lab.js", "platform-tools.js", "tool-workspace-pro.js", "utility-lab-tools.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /Ã.|Â.|â€|Ä‘|Æ°|\uFFFD/, `${file} contains mojibake`);
  }
  const worker = read("sw.js");
  assert.match(worker, /hh-identity-portal-v220/);
  assert.match(worker, /platform-tools\.css\?v=1/);
  assert.match(worker, /tool-workspace-pro\.js\?v=1/);
  assert.match(worker, /utility-lab-tools\.js\?v=9/);
});
