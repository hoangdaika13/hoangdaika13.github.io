const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dev = require("../dev-code-git.js");

test("exposes the two Code/Git tools and versioned local state", () => {
  assert.deepEqual(dev.TOOL_IDS, ["code-playground", "git-diff-studio"]);
  assert.equal(dev.STORAGE_KEY, "hh.dev.code-git.v1");
  assert.equal(dev.VERSION, 1);
});

test("normalizes a portable multi-file web project", () => {
  const project = dev.createDefaultProject();
  assert.equal(project.files.length, 3);
  assert.ok(dev.findFile(project, "index.html"));
  assert.ok(dev.findFile(project, "styles.css"));
  assert.ok(dev.findFile(project, "app.js"));
  const serialized = dev.serializeProject(project);
  const restored = dev.importProject(serialized);
  assert.equal(restored.name, project.name);
  assert.equal(restored.files[0].content, project.files[0].content);
  assert.throws(() => dev.importProject('{"format":"other"}'), /không phải project/i);
});

test("sandbox preview is restrictive and bridges console without parent eval", () => {
  const project = dev.createDefaultProject();
  const output = dev.buildSandboxDocument(project);
  assert.match(output, /Content-Security-Policy/);
  assert.match(output, /connect-src 'none'/);
  assert.match(output, /form-action 'none'/);
  assert.match(output, /hh-code-sandbox/);
  assert.match(output, /Code Playground/);
  assert.doesNotMatch(output, /allow-same-origin/);
  const source = fs.readFileSync(path.join(__dirname, "..", "dev-code-git.js"), "utf8");
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
});

test("runtime adapters report unsupported states truthfully", () => {
  assert.deepEqual(dev.runtimeCapabilities({}), {
    monaco: false, typescript: false, webcontainers: false, filesystemAccess: false, isolated: false
  });
  const ts = dev.transpileTypeScript("const value: number = 1", {});
  assert.equal(ts.supported, false);
  assert.match(ts.diagnostics[0], /chưa được nạp/i);
  assert.equal(dev.webContainerStatus({}).ready, false);
  assert.match(dev.webContainerStatus({}).reason, /chưa được nạp/i);
  const isolatedRuntime = { WebContainer: { boot() {} }, crossOriginIsolated: true };
  assert.equal(dev.webContainerStatus(isolatedRuntime).ready, true);
});

test("TypeScript adapter transpiles only when an explicit runtime exists", () => {
  const calls = [];
  const runtime = {
    ts: {
      ScriptTarget: { ES2020: 7 }, ModuleKind: { ESNext: 99 },
      transpileModule(source, options) { calls.push({ source, options }); return { outputText: "const value = 1;", diagnostics: [] }; }
    }
  };
  const result = dev.transpileTypeScript("const value: number = 1;", runtime);
  assert.equal(result.supported, true);
  assert.equal(result.code, "const value = 1;");
  assert.equal(calls.length, 1);
});

test("virtual terminal supports only explicit local commands", () => {
  const project = dev.createDefaultProject();
  assert.match(dev.runVirtualCommand("help", project).output, /ls/);
  assert.match(dev.runVirtualCommand("ls", project).output, /index\.html/);
  assert.match(dev.runVirtualCommand("cat app.js", project).output, /querySelector/);
  assert.equal(dev.runVirtualCommand("run", project).action, "preview");
  assert.equal(dev.runVirtualCommand("clear", project).clear, true);
  const blocked = dev.runVirtualCommand("rm -rf /", project);
  assert.equal(blocked.ok, false);
  assert.match(blocked.output, /không truy cập shell máy thật/i);
});

test("text diff returns line numbers and change summary", () => {
  const result = dev.textDiff("alpha\nbeta\ngamma", "alpha\nbeta 2\ngamma\ndelta");
  assert.equal(result.added, 2);
  assert.equal(result.removed, 1);
  assert.equal(result.unchanged, 2);
  assert.ok(result.entries.some((entry) => entry.type === "add" && entry.right === 4));
});

test("JSON diff compares stable paths instead of formatted text", () => {
  const result = dev.jsonDiff('{"profile":{"name":"HH","level":1}}', '{"profile":{"name":"HH","level":2},"active":true}');
  assert.equal(result.added, 1);
  assert.equal(result.changed, 1);
  assert.ok(result.entries.some((entry) => entry.path === "$.profile.level" && entry.type === "change"));
  assert.ok(result.entries.some((entry) => entry.path === "$.active" && entry.type === "add"));
});

test("image comparison uses metadata and never decodes unknown image code", () => {
  const result = dev.imageMetadataDiff(
    { name: "hero.png", type: "image/png", size: 1000, width: 1200, height: 630 },
    { name: "hero.webp", type: "image/webp", size: 420, width: 1200, height: 630 }
  );
  assert.equal(result.changed, 3);
  assert.equal(result.pixelsBefore, 756000);
  assert.equal(result.pixelsAfter, 756000);
});

test("folder manifest diff detects add remove and metadata changes", () => {
  const result = dev.folderManifestDiff(
    [{ path: "src/app.js", size: 10 }, { path: "src/old.js", size: 4 }],
    [{ path: "src/app.js", size: 18 }, { path: "src/new.js", size: 7 }]
  );
  assert.equal(result.added, 1);
  assert.equal(result.removed, 1);
  assert.equal(result.changed, 1);
  assert.deepEqual(result.entries.map((entry) => entry.path), ["src/app.js", "src/new.js", "src/old.js"]);
});

test("Conventional Commit builder sanitizes type scope and subject", () => {
  const message = dev.buildConventionalCommit({
    type: "feat", scope: "DEV Tools", subject: "add Code Playground.", body: "Sandbox local-first", issues: "Closes #42", breaking: true, breakingDescription: "Project schema v1"
  });
  assert.match(message, /^feat\(dev-tools\)!: add Code Playground/);
  assert.match(message, /BREAKING CHANGE: Project schema v1/);
  assert.match(message, /Closes #42/);
  assert.doesNotMatch(message.split("\n")[0], /\.$/);
});

test("project generators create useful gitignore README changelog and release notes", () => {
  const ignore = dev.generateGitignore(["node", "web"], "tmp/");
  assert.match(ignore, /node_modules\//);
  assert.match(ignore, /\.vercel\//);
  assert.match(ignore, /tmp\//);
  assert.match(dev.generateReadme({ title: "HH DEV", install: "npm ci" }), /^# HH DEV/);
  assert.match(dev.generateChangelog([{ version: "1.0.0", date: "2026-07-21", items: ["Initial"] }]), /## \[1\.0\.0\]/);
  assert.match(dev.generateReleaseNotes({ title: "v1", highlights: ["Sandbox"] }), /## Điểm nổi bật/);
});

test("GitHub Actions generator limits permissions and creates verify pipeline", () => {
  const yaml = dev.generateGithubActions({ name: "HH CI", node: "22", branch: "main", install: "npm ci", test: "npm test", build: "npm run build" });
  assert.match(yaml, /permissions:\n  contents: read/);
  assert.match(yaml, /actions\/checkout@v4/);
  assert.match(yaml, /actions\/setup-node@v4/);
  assert.match(yaml, /timeout-minutes: 15/);
  assert.match(yaml, /node-version: "22"/);
});

test("three-way merge resolves unchanged sides automatically", () => {
  assert.deepEqual(dev.threeWayMerge("base", "base", "remote"), { clean: true, result: "remote", conflicts: [], strategy: "remote" });
  assert.deepEqual(dev.threeWayMerge("base", "local", "base"), { clean: true, result: "local", conflicts: [], strategy: "local" });
  assert.equal(dev.threeWayMerge("base", "same", "same").strategy, "identical");
});

test("conflict resolution is non-destructive and keeps original merge", () => {
  const merge = dev.threeWayMerge("const value = 1;", "const value = 2;", "const value = 3;");
  const snapshot = JSON.stringify(merge);
  assert.equal(merge.clean, false);
  assert.equal(merge.conflicts.length, 1);
  const resolved = dev.resolveMerge(merge, { "conflict-1": "remote" });
  assert.equal(resolved.clean, true);
  assert.equal(resolved.result, "const value = 3;");
  assert.equal(JSON.stringify(merge), snapshot);
  assert.deepEqual(resolved.original, merge);
});

test("workspace normalization preserves tool, project and safe bounded state", () => {
  const workspace = dev.normalizeWorkspace({
    activeTool: "git-diff-studio",
    project: { name: "Demo", files: [{ name: "demo.js", content: "console.log(1)" }] },
    diff: { mode: "json", before: "{}", after: '{"ok":true}' }
  });
  assert.equal(workspace.activeTool, "git-diff-studio");
  assert.equal(workspace.project.name, "Demo");
  assert.equal(workspace.diff.mode, "json");
  assert.equal(workspace.version, 1);
});

test("responsive stylesheet is scoped, keyboard friendly and reduced-motion aware", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "dev-code-git.css"), "utf8");
  assert.match(css, /\.dcg\s*\{/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /grid-template-columns/);
});

test("Diff Studio UI exposes text JSON image and folder comparison modes", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "dev-code-git.js"), "utf8");
  for (const mode of ["text", "json", "image", "folder"]) assert.match(source, new RegExp(`option value=\\"${mode}\\"`));
  assert.match(source, /imageMetadataDiff\(JSON\.parse\(before\)/);
  assert.match(source, /folderManifestDiff\(JSON\.parse\(before\)/);
});
