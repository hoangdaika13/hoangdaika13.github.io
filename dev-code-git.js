(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-dev-code-git";
  const STORAGE_KEY = "hh.dev.code-git.v1";
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_PROJECT_BYTES = 8 * 1024 * 1024;
  const MAX_HISTORY = 30;
  const TOOL_IDS = Object.freeze(["code-playground", "git-diff-studio"]);
  const instances = new WeakMap();

  const STARTER_FILES = Object.freeze([
    {
      id: "index-html", name: "index.html", language: "html",
      content: '<main class="demo"><span>HH DEV</span><h1>Code Playground</h1><p>Chỉnh sửa HTML, CSS và JavaScript rồi xem kết quả tức thì.</p><button id="hello">Chạy thử</button></main>'
    },
    {
      id: "styles-css", name: "styles.css", language: "css",
      content: ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui;background:#080b14;color:#f5f7ff}.demo{width:min(560px,90vw);padding:40px;border:1px solid #3b5167;border-radius:18px;background:linear-gradient(145deg,#111827,#171125);box-shadow:0 24px 80px #0008}.demo span{color:#65e8ef;font-weight:800}.demo h1{font-size:clamp(32px,7vw,64px);margin:10px 0;background:linear-gradient(90deg,#ff69bd,#74eff4);color:transparent;background-clip:text}.demo button{border:0;border-radius:10px;padding:12px 18px;background:#65e8ef;color:#071016;font-weight:800;cursor:pointer}'
    },
    {
      id: "app-js", name: "app.js", language: "javascript",
      content: 'document.querySelector("#hello")?.addEventListener("click",()=>console.log("Xin chào từ HH sandbox"));\nconsole.info("Preview đã sẵn sàng");'
    }
  ]);

  const GITIGNORE_PRESETS = Object.freeze({
    node: ["node_modules/", ".env", ".env.*", "!.env.example", "dist/", "coverage/", "*.log", ".DS_Store"],
    web: ["dist/", "build/", ".cache/", ".vercel/", ".netlify/", "*.local", "*.log"],
    python: ["__pycache__/", "*.py[cod]", ".venv/", "venv/", ".pytest_cache/", ".coverage", "dist/"],
    java: [".gradle/", "build/", "target/", "*.class", "*.jar", ".idea/", "*.iml"],
    dotnet: ["bin/", "obj/", ".vs/", "*.user", "*.suo", "TestResults/"]
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function safeText(value, maxLength) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, maxLength || 100000);
  }

  function escapeHtml(value) {
    return safeText(value, 200000)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function bytes(value) {
    const text = String(value == null ? "" : value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text, "utf8");
  }

  function formatBytes(value) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount < 1024) return `${amount} B`;
    if (amount < 1048576) return `${(amount / 1024).toFixed(1)} KB`;
    return `${(amount / 1048576).toFixed(1)} MB`;
  }

  function normalizeFile(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const name = safeText(source.name || `file-${index + 1}.txt`, 160).replace(/[\\/:*?"<>|]/g, "-");
    const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "txt";
    const languageMap = { html: "html", htm: "html", css: "css", js: "javascript", mjs: "javascript", ts: "typescript", json: "json", md: "markdown" };
    return {
      id: safeText(source.id || uid("file"), 100),
      name,
      language: languageMap[source.language] || languageMap[extension] || safeText(source.language || "text", 40),
      content: safeText(source.content, MAX_FILE_BYTES),
      modifiedAt: safeText(source.modifiedAt || new Date().toISOString(), 50)
    };
  }

  function createDefaultProject() {
    return {
      id: uid("project"), name: "HH Web Project", version: 1,
      files: STARTER_FILES.map((file, index) => normalizeFile(file, index)),
      activeFileId: "index-html", liveReload: true, previewDelay: 350,
      terminal: [{ id: uid("line"), type: "system", text: "Terminal ảo cục bộ sẵn sàng. Gõ help để xem lệnh." }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    let files = Array.isArray(source.files) ? source.files.slice(0, 80).map(normalizeFile) : [];
    if (!files.length) files = createDefaultProject().files;
    const active = files.some((file) => file.id === source.activeFileId) ? source.activeFileId : files[0].id;
    return {
      id: safeText(source.id || uid("project"), 100), name: safeText(source.name || "HH Web Project", 160), version: 1,
      files, activeFileId: active, liveReload: source.liveReload !== false,
      previewDelay: Math.max(120, Math.min(2000, Number(source.previewDelay) || 350)),
      terminal: Array.isArray(source.terminal) ? source.terminal.slice(-100).map((line) => ({
        id: safeText(line.id || uid("line"), 100), type: ["input", "output", "error", "system"].includes(line.type) ? line.type : "output", text: safeText(line.text, 4000)
      })) : [],
      createdAt: safeText(source.createdAt || new Date().toISOString(), 50), updatedAt: safeText(source.updatedAt || new Date().toISOString(), 50)
    };
  }

  function serializeProject(projectInput) {
    const project = normalizeProject(projectInput);
    const payload = JSON.stringify({ format: FORMAT, version: VERSION, kind: "code-project", project }, null, 2);
    if (bytes(payload) > MAX_PROJECT_BYTES) throw new Error("Project vượt giới hạn 8 MB của workspace trình duyệt.");
    return payload;
  }

  function importProject(text) {
    const parsed = JSON.parse(String(text || ""));
    if (parsed.format !== FORMAT || parsed.kind !== "code-project") throw new Error("Tệp không phải project HH Code/Git hợp lệ.");
    return normalizeProject(parsed.project);
  }

  function findFile(project, matcher) {
    const source = normalizeProject(project);
    const lower = String(matcher || "").toLowerCase();
    return source.files.find((file) => file.id === matcher || file.name.toLowerCase() === lower) || null;
  }

  function safeInlineScript(source) {
    return String(source || "").replace(/<\/script/gi, "<\\/script");
  }

  function buildSandboxDocument(projectInput) {
    const project = normalizeProject(projectInput);
    const html = findFile(project, "index.html")?.content || "<main><h1>HH Preview</h1></main>";
    const css = project.files.filter((file) => file.language === "css").map((file) => `/* ${file.name} */\n${file.content}`).join("\n");
    const javascript = project.files.filter((file) => file.language === "javascript").map((file) => `// ${file.name}\n${file.content}`);
    const typescript = project.files.filter((file) => file.language === "typescript").map((file) => {
      const result = transpileTypeScript(file.content, globalScope);
      return result.supported && result.code ? `// ${file.name} (TypeScript)\n${result.code}` : `// ${file.name} was not executed: TypeScript runtime is unavailable.`;
    });
    const js = javascript.concat(typescript).join("\n");
    const bridge = `(function(){const send=(level,args)=>parent.postMessage({source:'hh-code-sandbox',level:level,args:Array.from(args).map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch(_){return String(v)}})},'*');['log','info','warn','error'].forEach(level=>{const original=console[level];console[level]=function(){send(level,arguments);return original.apply(console,arguments)}});window.addEventListener('error',e=>send('error',[e.message+' @ '+e.lineno+':'+e.colno]));window.addEventListener('unhandledrejection',e=>send('error',['Promise: '+String(e.reason)]));parent.postMessage({source:'hh-code-sandbox',level:'ready',args:['Preview ready']},'*')})();`;
    const documentHtml = /<html[\s>]/i.test(html) ? html : `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    const styleTag = `<style>${String(css).replace(/<\/style/gi, "<\\/style")}</style>`;
    const scriptTag = `<script>${safeInlineScript(bridge)}\n${safeInlineScript(js)}<\/script>`;
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob: https:; media-src data: blob: https:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';
    if (/<\/head>/i.test(documentHtml)) return documentHtml.replace(/<\/head>/i, `${csp}${styleTag}</head>`).replace(/<\/body>/i, `${scriptTag}</body>`);
    return `${csp}${styleTag}${documentHtml}${scriptTag}`;
  }

  function runtimeCapabilities(scope) {
    const target = scope || globalScope || {};
    return {
      monaco: Boolean(target.monaco && target.monaco.editor && typeof target.monaco.editor.create === "function"),
      typescript: Boolean(target.ts && typeof target.ts.transpileModule === "function"),
      webcontainers: Boolean(target.WebContainer && typeof target.WebContainer.boot === "function"),
      filesystemAccess: Boolean(target.showDirectoryPicker),
      isolated: Boolean(target.crossOriginIsolated)
    };
  }

  function transpileTypeScript(source, scope) {
    const target = scope || globalScope || {};
    if (!target.ts || typeof target.ts.transpileModule !== "function") {
      return { supported: false, code: "", diagnostics: ["TypeScript runtime chưa được nạp. Mã nguồn được giữ nguyên, không giả lập biên dịch."] };
    }
    try {
      const result = target.ts.transpileModule(String(source || ""), { compilerOptions: { target: target.ts.ScriptTarget?.ES2020, module: target.ts.ModuleKind?.ESNext }, reportDiagnostics: true });
      return { supported: true, code: result.outputText, diagnostics: (result.diagnostics || []).map((item) => safeText(item.messageText, 1000)) };
    } catch (error) {
      return { supported: true, code: "", diagnostics: [safeText(error.message, 1000)] };
    }
  }

  function webContainerStatus(scope) {
    const caps = runtimeCapabilities(scope);
    if (!caps.webcontainers) return { supported: false, ready: false, reason: "WebContainer runtime chưa được nạp." };
    if (!caps.isolated) return { supported: true, ready: false, reason: "Cần HTTPS và cross-origin isolation để khởi động WebContainer." };
    return { supported: true, ready: true, reason: "Runtime khả dụng; chỉ khởi động sau thao tác rõ ràng của người dùng." };
  }

  function runVirtualCommand(command, projectInput) {
    const project = normalizeProject(projectInput);
    const input = safeText(command, 500).trim();
    const [name, ...args] = input.split(/\s+/);
    if (!input) return { ok: true, clear: false, output: "" };
    if (name === "help") return { ok: true, clear: false, output: "help · ls · pwd · cat <file> · stats · run · clear · export" };
    if (name === "pwd") return { ok: true, clear: false, output: `/hh/${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` };
    if (name === "ls") return { ok: true, clear: false, output: project.files.map((file) => `${file.name}\t${formatBytes(bytes(file.content))}`).join("\n") };
    if (name === "cat") {
      const file = findFile(project, args.join(" "));
      return file ? { ok: true, clear: false, output: file.content } : { ok: false, clear: false, output: "Không tìm thấy tệp." };
    }
    if (name === "stats") return { ok: true, clear: false, output: `${project.files.length} tệp · ${formatBytes(project.files.reduce((sum, file) => sum + bytes(file.content), 0))} · local-only` };
    if (name === "run") return { ok: true, clear: false, action: "preview", output: "Đã yêu cầu làm mới sandbox preview." };
    if (name === "clear") return { ok: true, clear: true, output: "" };
    if (name === "export") return { ok: true, clear: false, action: "export", output: "Đã chuẩn bị project JSON để tải xuống." };
    return { ok: false, clear: false, output: `Lệnh "${name}" không được hỗ trợ. Terminal này không truy cập shell máy thật.` };
  }

  function splitLines(value) {
    return String(value == null ? "" : value).replace(/\r\n/g, "\n").split("\n");
  }

  function textDiff(before, after) {
    const left = splitLines(before); const right = splitLines(after);
    if (left.length * right.length > 500000) {
      const max = Math.max(left.length, right.length); const entries = [];
      for (let index = 0; index < max; index += 1) {
        if (left[index] === right[index]) entries.push({ type: "equal", left: index + 1, right: index + 1, value: left[index] || "" });
        else {
          if (left[index] !== undefined) entries.push({ type: "remove", left: index + 1, right: null, value: left[index] });
          if (right[index] !== undefined) entries.push({ type: "add", left: null, right: index + 1, value: right[index] });
        }
      }
      return summarizeDiff(entries, true);
    }
    const matrix = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) matrix[i][j] = left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    const entries = []; let i = 0; let j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) { entries.push({ type: "equal", left: i + 1, right: j + 1, value: left[i] }); i += 1; j += 1; }
      else if (j < right.length && (i === left.length || matrix[i][j + 1] >= matrix[i + 1][j])) { entries.push({ type: "add", left: null, right: j + 1, value: right[j] }); j += 1; }
      else { entries.push({ type: "remove", left: i + 1, right: null, value: left[i] }); i += 1; }
    }
    return summarizeDiff(entries, false);
  }

  function summarizeDiff(entries, approximate) {
    const added = entries.filter((entry) => entry.type === "add").length;
    const removed = entries.filter((entry) => entry.type === "remove").length;
    return { entries, added, removed, unchanged: entries.length - added - removed, changed: added + removed, approximate: Boolean(approximate) };
  }

  function flattenJson(value, prefix, output) {
    const result = output || {};
    const path = prefix || "$";
    if (value && typeof value === "object") {
      const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value).sort();
      if (!keys.length) result[path] = Array.isArray(value) ? [] : {};
      keys.forEach((key) => flattenJson(value[key], `${path}${Array.isArray(value) ? `[${key}]` : `.${key}`}`, result));
    } else result[path] = value;
    return result;
  }

  function jsonDiff(before, after) {
    const leftValue = typeof before === "string" ? JSON.parse(before) : before;
    const rightValue = typeof after === "string" ? JSON.parse(after) : after;
    const left = flattenJson(leftValue); const right = flattenJson(rightValue);
    const paths = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
    const entries = paths.map((path) => {
      if (!Object.prototype.hasOwnProperty.call(left, path)) return { path, type: "add", before: undefined, after: right[path] };
      if (!Object.prototype.hasOwnProperty.call(right, path)) return { path, type: "remove", before: left[path], after: undefined };
      return JSON.stringify(left[path]) === JSON.stringify(right[path]) ? { path, type: "equal", before: left[path], after: right[path] } : { path, type: "change", before: left[path], after: right[path] };
    });
    return { entries, added: entries.filter((item) => item.type === "add").length, removed: entries.filter((item) => item.type === "remove").length, changed: entries.filter((item) => item.type === "change").length };
  }

  function normalizeImageMetadata(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      name: safeText(source.name, 200), type: safeText(source.type, 100), size: Math.max(0, Number(source.size) || 0),
      width: Math.max(0, Number(source.width) || 0), height: Math.max(0, Number(source.height) || 0),
      lastModified: Math.max(0, Number(source.lastModified) || 0), digest: safeText(source.digest, 300)
    };
  }

  function imageMetadataDiff(before, after) {
    const left = normalizeImageMetadata(before); const right = normalizeImageMetadata(after);
    const entries = Object.keys(left).map((key) => ({ field: key, before: left[key], after: right[key], changed: left[key] !== right[key] }));
    return { entries, changed: entries.filter((entry) => entry.changed).length, pixelsBefore: left.width * left.height, pixelsAfter: right.width * right.height };
  }

  function normalizeManifest(input) {
    const list = Array.isArray(input) ? input : [];
    return list.slice(0, 10000).map((entry) => ({
      path: safeText(typeof entry === "string" ? entry : entry.path, 1000).replace(/\\/g, "/"),
      size: Math.max(0, Number(entry && entry.size) || 0), type: safeText(entry && entry.type, 100), digest: safeText(entry && entry.digest, 300)
    })).filter((entry) => entry.path).sort((a, b) => a.path.localeCompare(b.path));
  }

  function folderManifestDiff(before, after) {
    const left = new Map(normalizeManifest(before).map((entry) => [entry.path, entry]));
    const right = new Map(normalizeManifest(after).map((entry) => [entry.path, entry]));
    const paths = Array.from(new Set([...left.keys(), ...right.keys()])).sort();
    const entries = paths.map((path) => {
      if (!left.has(path)) return { path, type: "add", before: null, after: right.get(path) };
      if (!right.has(path)) return { path, type: "remove", before: left.get(path), after: null };
      return JSON.stringify(left.get(path)) === JSON.stringify(right.get(path)) ? { path, type: "equal", before: left.get(path), after: right.get(path) } : { path, type: "change", before: left.get(path), after: right.get(path) };
    });
    return { entries, added: entries.filter((item) => item.type === "add").length, removed: entries.filter((item) => item.type === "remove").length, changed: entries.filter((item) => item.type === "change").length };
  }

  function buildConventionalCommit(input) {
    const source = input && typeof input === "object" ? input : {};
    const allowed = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"];
    const type = allowed.includes(source.type) ? source.type : "chore";
    const scope = safeText(source.scope, 60).toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const subject = safeText(source.subject || "update project", 100).trim().replace(/[.!]+$/, "");
    const breaking = Boolean(source.breaking);
    const title = `${type}${scope ? `(${scope})` : ""}${breaking ? "!" : ""}: ${subject}`;
    const body = safeText(source.body, 4000).trim();
    const issues = safeText(source.issues, 500).trim();
    const footer = [breaking && source.breakingDescription ? `BREAKING CHANGE: ${safeText(source.breakingDescription, 1000).trim()}` : "", issues].filter(Boolean).join("\n");
    return [title, body, footer].filter(Boolean).join("\n\n");
  }

  function generateGitignore(presets, extra) {
    const names = Array.isArray(presets) ? presets : [presets || "node"];
    const lines = [];
    names.forEach((name) => { if (GITIGNORE_PRESETS[name]) lines.push(`# ${name}`, ...GITIGNORE_PRESETS[name], ""); });
    safeText(extra, 4000).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => lines.push(line));
    return Array.from(new Set(lines)).join("\n").trim() + "\n";
  }

  function generateReadme(input) {
    const source = input && typeof input === "object" ? input : {};
    const title = safeText(source.title || "HH Project", 120); const description = safeText(source.description || "Mô tả dự án.", 1000);
    const scripts = Array.isArray(source.scripts) ? source.scripts.slice(0, 30) : [];
    return `# ${title}\n\n${description}\n\n## Bắt đầu\n\n\`\`\`bash\n${safeText(source.install || "npm install", 300)}\n${safeText(source.start || "npm run dev", 300)}\n\`\`\`\n\n## Lệnh\n\n${scripts.length ? scripts.map((item) => `- \`${safeText(item.name, 80)}\`: ${safeText(item.description, 300)}`).join("\n") : "- `npm test`: chạy kiểm thử"}\n\n## Giấy phép\n\n${safeText(source.license || "MIT", 80)}\n`;
  }

  function generateChangelog(releases) {
    const list = Array.isArray(releases) ? releases.slice(0, 100) : [];
    return `# Changelog\n\n${list.map((release) => `## [${safeText(release.version || "Unreleased", 40)}] - ${safeText(release.date || new Date().toISOString().slice(0, 10), 20)}\n\n${(release.items || []).map((item) => `- ${safeText(item, 500)}`).join("\n") || "- Cập nhật dự án"}`).join("\n\n")}`;
  }

  function generateReleaseNotes(input) {
    const source = input && typeof input === "object" ? input : {};
    const sections = [
      ["Điểm nổi bật", source.highlights], ["Thay đổi", source.changes], ["Sửa lỗi", source.fixes], ["Nâng cấp", source.upgrade]
    ];
    return `# ${safeText(source.title || `Phiên bản ${source.version || "mới"}`, 160)}\n\n${safeText(source.summary || "Bản phát hành mới của dự án.", 1000)}\n\n${sections.map(([title, values]) => `## ${title}\n\n${(Array.isArray(values) ? values : []).map((item) => `- ${safeText(item, 500)}`).join("\n") || "- Không có"}`).join("\n\n")}`;
  }

  function yamlScalar(value) {
    return JSON.stringify(String(value == null ? "" : value));
  }

  function generateGithubActions(input) {
    const source = input && typeof input === "object" ? input : {};
    const node = safeText(source.node || "20", 10); const branch = safeText(source.branch || "main", 80).replace(/[^a-zA-Z0-9._/-]/g, "");
    const install = safeText(source.install || "npm ci", 200); const testCommand = safeText(source.test || "npm test", 200); const build = safeText(source.build || "npm run build", 200);
    return `name: ${yamlScalar(source.name || "HH CI")}\n\non:\n  push:\n    branches: [${branch}]\n  pull_request:\n    branches: [${branch}]\n\npermissions:\n  contents: read\n\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${yamlScalar(node)}\n          cache: npm\n      - name: Install\n        run: ${yamlScalar(install)}\n      - name: Test\n        run: ${yamlScalar(testCommand)}\n      - name: Build\n        run: ${yamlScalar(build)}\n`;
  }

  function threeWayMerge(base, local, remote) {
    const baseText = String(base == null ? "" : base); const localText = String(local == null ? "" : local); const remoteText = String(remote == null ? "" : remote);
    if (localText === remoteText) return { clean: true, result: localText, conflicts: [], strategy: "identical" };
    if (localText === baseText) return { clean: true, result: remoteText, conflicts: [], strategy: "remote" };
    if (remoteText === baseText) return { clean: true, result: localText, conflicts: [], strategy: "local" };
    const left = splitLines(localText); const right = splitLines(remoteText); const ancestor = splitLines(baseText); const max = Math.max(left.length, right.length, ancestor.length); const output = []; const conflicts = [];
    for (let index = 0; index < max; index += 1) {
      const b = ancestor[index]; const l = left[index]; const r = right[index];
      if (l === r) output.push(l ?? "");
      else if (l === b) output.push(r ?? "");
      else if (r === b) output.push(l ?? "");
      else {
        const id = `conflict-${conflicts.length + 1}`; conflicts.push({ id, line: index + 1, base: b ?? "", local: l ?? "", remote: r ?? "", choice: null });
        output.push(`<<<<<<< LOCAL\n${l ?? ""}\n=======\n${r ?? ""}\n>>>>>>> REMOTE`);
      }
    }
    return { clean: conflicts.length === 0, result: output.join("\n"), conflicts, strategy: conflicts.length ? "manual" : "combined" };
  }

  function resolveMerge(mergeInput, choices) {
    const merge = clone(mergeInput); const selections = choices && typeof choices === "object" ? choices : {};
    let result = String(merge.result || ""); const unresolved = [];
    (merge.conflicts || []).forEach((conflict) => {
      const choice = selections[conflict.id]; const marker = `<<<<<<< LOCAL\n${conflict.local}\n=======\n${conflict.remote}\n>>>>>>> REMOTE`;
      if (!["local", "remote", "base", "both"].includes(choice)) { unresolved.push(conflict); return; }
      const replacement = choice === "local" ? conflict.local : choice === "remote" ? conflict.remote : choice === "base" ? conflict.base : `${conflict.local}\n${conflict.remote}`;
      result = result.replace(marker, replacement);
    });
    return { clean: unresolved.length === 0, result, conflicts: unresolved, original: clone(mergeInput) };
  }

  function createDefaultWorkspace() {
    return {
      version: VERSION, activeTool: "code-playground", project: createDefaultProject(),
      diff: { mode: "text", before: "const version = 1;\nconsole.log(version);", after: "const version = 2;\nconsole.info(version);", result: null },
      git: { commit: { type: "feat", scope: "dev", subject: "upgrade code playground", body: "", issues: "", breaking: false }, generator: "actions", output: "" },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeWorkspace(input) {
    const source = input && typeof input === "object" ? input : {};
    const fallback = createDefaultWorkspace();
    return {
      version: VERSION, activeTool: TOOL_IDS.includes(source.activeTool) ? source.activeTool : fallback.activeTool,
      project: normalizeProject(source.project || fallback.project),
      diff: {
        mode: ["text", "json", "image", "folder", "merge"].includes(source.diff && source.diff.mode) ? source.diff.mode : "text",
        before: safeText(source.diff && source.diff.before != null ? source.diff.before : fallback.diff.before, MAX_FILE_BYTES),
        after: safeText(source.diff && source.diff.after != null ? source.diff.after : fallback.diff.after, MAX_FILE_BYTES),
        base: safeText(source.diff && source.diff.base, MAX_FILE_BYTES), result: null
      },
      git: { commit: Object.assign({}, fallback.git.commit, source.git && source.git.commit), generator: safeText(source.git && source.git.generator || "actions", 40), output: safeText(source.git && source.git.output, MAX_FILE_BYTES) },
      updatedAt: safeText(source.updatedAt || new Date().toISOString(), 50)
    };
  }

  function readStorage() {
    try { return normalizeWorkspace(JSON.parse(globalScope.localStorage?.getItem(STORAGE_KEY) || "null")); } catch (_) { return createDefaultWorkspace(); }
  }

  function writeStorage(workspace) {
    try { globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalizeWorkspace(workspace))); return true; } catch (_) { return false; }
  }

  function downloadText(content, filename, type) {
    if (!globalScope.document || !globalScope.URL || typeof Blob === "undefined") return false;
    const url = globalScope.URL.createObjectURL(new Blob([content], { type: type || "text/plain;charset=utf-8" }));
    const anchor = globalScope.document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000); return true;
  }

  function editorAdapter(container, textarea, file, onChange) {
    const caps = runtimeCapabilities(globalScope);
    if (!caps.monaco) return { kind: "textarea", getValue: () => textarea.value, setValue: (value) => { textarea.value = value; }, focus: () => textarea.focus(), destroy() {} };
    textarea.hidden = true; container.classList.add("has-monaco");
    const editorHost = globalScope.document.createElement("div"); editorHost.className = "dcg-monaco"; container.appendChild(editorHost);
    const editor = globalScope.monaco.editor.create(editorHost, { value: file.content, language: file.language, theme: "vs-dark", automaticLayout: true, minimap: { enabled: false }, fontSize: 14, tabSize: 2 });
    const disposable = editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    return { kind: "monaco", getValue: () => editor.getValue(), setValue: (value) => editor.setValue(value), focus: () => editor.focus(), destroy() { disposable.dispose(); editor.dispose(); } };
  }

  function codeMarkup(workspace) {
    const project = workspace.project; const active = findFile(project, project.activeFileId) || project.files[0]; const caps = runtimeCapabilities(globalScope); const wc = webContainerStatus(globalScope);
    return `<section class="dcg-code" aria-label="Code Playground">
      <aside class="dcg-files"><header><div><small>PROJECT</small><strong>${escapeHtml(project.name)}</strong></div><button type="button" data-dcg-action="new-file" title="Tạo tệp">+</button></header><div class="dcg-file-list">${project.files.map((file) => `<button type="button" data-dcg-file="${escapeHtml(file.id)}" class="${file.id === active.id ? "is-active" : ""}"><span>${escapeHtml(file.language.slice(0, 2).toUpperCase())}</span><b>${escapeHtml(file.name)}</b><small>${formatBytes(bytes(file.content))}</small></button>`).join("")}</div><footer><button type="button" data-dcg-action="import-project">Nhập project</button><button type="button" data-dcg-action="export-project">Xuất project</button><input type="file" accept="application/json,.json" data-dcg-project-file hidden></footer></aside>
      <main class="dcg-editor"><header><div><strong>${escapeHtml(active.name)}</strong><small>${escapeHtml(active.language)} · ${caps.monaco ? "Monaco" : "Textarea an toàn"}</small></div><label><input type="checkbox" data-dcg-live ${project.liveReload ? "checked" : ""}> Live reload</label><button type="button" data-dcg-action="run-preview">Chạy</button></header><div class="dcg-editor-host" data-dcg-editor-host><textarea data-dcg-editor spellcheck="false" aria-label="Trình soạn thảo ${escapeHtml(active.name)}">${escapeHtml(active.content)}</textarea></div><section class="dcg-terminal" aria-label="Terminal ảo"><header><strong>Terminal cục bộ</strong><span>Không truy cập shell máy</span></header><div data-dcg-terminal-output>${project.terminal.slice(-20).map((line) => `<p class="is-${line.type}">${escapeHtml(line.text)}</p>`).join("")}</div><form data-dcg-terminal-form><label><span>›</span><input data-dcg-terminal-input autocomplete="off" placeholder="help, ls, cat index.html, run..."></label></form></section></main>
      <aside class="dcg-preview"><header><strong>Sandbox Preview</strong><div><span class="${caps.typescript ? "is-ready" : ""}">TS ${caps.typescript ? "ready" : "chưa nạp"}</span><span class="${wc.ready ? "is-ready" : ""}">Node ${wc.ready ? "ready" : "không khả dụng"}</span></div></header><iframe data-dcg-preview sandbox="allow-scripts" title="Bản xem trước code trong sandbox"></iframe><section class="dcg-console"><header><strong>Console</strong><button type="button" data-dcg-action="clear-console">Xóa</button></header><div data-dcg-console-output><p class="is-system">Preview bị cô lập, chặn quyền truy cập parent và mạng.</p></div></section></aside>
    </section>`;
  }

  function diffMarkup(workspace) {
    const diff = workspace.diff;
    return `<section class="dcg-git" aria-label="Git và Diff Studio">
      <nav class="dcg-git-tabs" aria-label="Chế độ Git"><button class="is-active" data-dcg-git-tab="diff">Diff</button><button data-dcg-git-tab="commit">Commit</button><button data-dcg-git-tab="generators">Generators</button><button data-dcg-git-tab="merge">Merge</button></nav>
      <div data-dcg-git-panel="diff" class="dcg-git-panel is-active"><header><div><small>COMPARE ENGINE</small><h3>So sánh không phá hủy</h3></div><select data-dcg-diff-mode aria-label="Kiểu so sánh"><option value="text" ${diff.mode === "text" ? "selected" : ""}>Text</option><option value="json" ${diff.mode === "json" ? "selected" : ""}>JSON</option><option value="image" ${diff.mode === "image" ? "selected" : ""}>Metadata ảnh</option><option value="folder" ${diff.mode === "folder" ? "selected" : ""}>Manifest thư mục</option></select><button data-dcg-action="run-diff">So sánh</button></header><div class="dcg-diff-inputs"><label>Phiên bản trước<textarea data-dcg-diff-before spellcheck="false">${escapeHtml(diff.before)}</textarea></label><label>Phiên bản sau<textarea data-dcg-diff-after spellcheck="false">${escapeHtml(diff.after)}</textarea></label></div><div class="dcg-diff-result" data-dcg-diff-result><p>Text so theo dòng; JSON, metadata ảnh và manifest thư mục nhận dữ liệu JSON có cấu trúc.</p></div></div>
      <div data-dcg-git-panel="commit" class="dcg-git-panel"><header><div><small>CONVENTIONAL COMMITS</small><h3>Tạo commit rõ ràng</h3></div><button data-dcg-action="build-commit">Tạo message</button></header><div class="dcg-form-grid"><label>Loại<select data-dcg-commit="type">${["feat", "fix", "docs", "refactor", "perf", "test", "build", "ci", "chore"].map((type) => `<option>${type}</option>`).join("")}</select></label><label>Scope<input data-dcg-commit="scope" value="${escapeHtml(workspace.git.commit.scope)}"></label><label class="is-wide">Nội dung<input data-dcg-commit="subject" value="${escapeHtml(workspace.git.commit.subject)}"></label><label class="is-wide">Mô tả<textarea data-dcg-commit="body">${escapeHtml(workspace.git.commit.body)}</textarea></label></div><pre data-dcg-git-output>Commit message sẽ xuất hiện tại đây.</pre></div>
      <div data-dcg-git-panel="generators" class="dcg-git-panel"><header><div><small>PROJECT GENERATORS</small><h3>Tài liệu và CI</h3></div></header><div class="dcg-generator-grid"><button data-dcg-generator="gitignore"><b>.gitignore</b><span>Node + Web an toàn</span></button><button data-dcg-generator="readme"><b>README</b><span>Khởi động và scripts</span></button><button data-dcg-generator="changelog"><b>Changelog</b><span>Keep a Changelog</span></button><button data-dcg-generator="release"><b>Release Notes</b><span>Điểm nổi bật và sửa lỗi</span></button><button data-dcg-generator="actions"><b>GitHub Actions</b><span>Install, test, build</span></button></div><pre data-dcg-generator-output>Chọn một generator để tạo bản nháp.</pre><button data-dcg-action="download-generator">Tải kết quả</button></div>
      <div data-dcg-git-panel="merge" class="dcg-git-panel"><header><div><small>THREE-WAY MERGE</small><h3>Giải quyết conflict có kiểm soát</h3></div><button data-dcg-action="run-merge">Phân tích</button></header><div class="dcg-merge-inputs"><label>Base<textarea data-dcg-merge="base">const value = 1;</textarea></label><label>Local<textarea data-dcg-merge="local">const value = 2;</textarea></label><label>Remote<textarea data-dcg-merge="remote">const value = 3;</textarea></label></div><div data-dcg-merge-result class="dcg-merge-result"><p>Bản gốc không bị thay đổi. Mỗi conflict cho phép chọn Local, Remote, Base hoặc cả hai.</p></div></div>
    </section>`;
  }

  function shellMarkup(workspace) {
    return `<section class="dcg" data-dcg-root><header class="dcg-hero"><div><span>HH DEV WORKSPACE · CODE & GIT</span><h2>${workspace.activeTool === "code-playground" ? "Code Playground" : "Git & Diff Studio"}</h2><p>Workspace local-first, sandbox chặt chẽ và không thực thi lệnh trên máy thật.</p></div><nav aria-label="Chuyển công cụ"><button data-dcg-tool="code-playground" class="${workspace.activeTool === "code-playground" ? "is-active" : ""}>Code Playground</button><button data-dcg-tool="git-diff-studio" class="${workspace.activeTool === "git-diff-studio" ? "is-active" : ""}>Git & Diff Studio</button></nav></header><div data-dcg-workspace>${workspace.activeTool === "code-playground" ? codeMarkup(workspace) : diffMarkup(workspace)}</div><footer class="dcg-status"><span><i></i> Local-first</span><span data-dcg-status>Autosave sẵn sàng</span><span>${escapeHtml(STORAGE_KEY)}</span></footer><div class="dcg-toast" role="status" aria-live="polite" data-dcg-toast hidden></div></section>`;
  }

  function mount(root, options) {
    if (!root || typeof root.replaceChildren !== "function") throw new Error("Cần phần tử DOM hợp lệ để mount HHDevCodeGit.");
    unmount(root);
    const config = options && typeof options === "object" ? options : {};
    let workspace = config.workspace ? normalizeWorkspace(config.workspace) : readStorage();
    if (TOOL_IDS.includes(config.toolId)) workspace.activeTool = config.toolId;
    let editor = null; let previewTimer = null; let saveTimer = null; let mergeState = null; let generatorOutput = ""; let destroyed = false;

    function persist() {
      workspace.updatedAt = new Date().toISOString(); writeStorage(workspace);
      const node = root.querySelector("[data-dcg-status]"); if (node) node.textContent = `Đã lưu ${new Date().toLocaleTimeString("vi-VN")}`;
    }

    function toast(message, tone) {
      const node = root.querySelector("[data-dcg-toast]"); if (!node) return;
      node.textContent = message; node.dataset.tone = tone || "info"; node.hidden = false;
      clearTimeout(node._timer); node._timer = setTimeout(() => { node.hidden = true; }, 2600);
    }

    function updateActiveFile(value) {
      const file = findFile(workspace.project, workspace.project.activeFileId); if (!file) return;
      file.content = safeText(value, MAX_FILE_BYTES); file.modifiedAt = new Date().toISOString();
      clearTimeout(saveTimer); saveTimer = setTimeout(persist, 220);
      if (workspace.project.liveReload) schedulePreview();
    }

    function renderPreview() {
      const frame = root.querySelector("[data-dcg-preview]"); if (!frame) return;
      frame.srcdoc = buildSandboxDocument(workspace.project);
    }

    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, workspace.project.previewDelay); }

    function initEditor() {
      editor?.destroy(); editor = null;
      const textarea = root.querySelector("[data-dcg-editor]"); const host = root.querySelector("[data-dcg-editor-host]");
      if (!textarea || !host) return;
      const file = findFile(workspace.project, workspace.project.activeFileId) || workspace.project.files[0];
      editor = editorAdapter(host, textarea, file, updateActiveFile); renderPreview();
    }

    function render() {
      editor?.destroy(); editor = null; clearTimeout(previewTimer);
      root.innerHTML = shellMarkup(workspace);
      if (workspace.activeTool === "code-playground") initEditor();
      persist();
    }

    function appendConsole(level, message) {
      const output = root.querySelector("[data-dcg-console-output]"); if (!output) return;
      const line = globalScope.document.createElement("p"); line.className = `is-${level}`; line.textContent = safeText(message, 4000); output.appendChild(line);
      while (output.children.length > 120) output.firstElementChild.remove(); output.scrollTop = output.scrollHeight;
    }

    function onMessage(event) {
      if (!event.data || event.data.source !== "hh-code-sandbox") return;
      const frame = root.querySelector("[data-dcg-preview]"); if (!frame || event.source !== frame.contentWindow) return;
      appendConsole(event.data.level || "log", (event.data.args || []).join(" "));
    }

    function renderDiff() {
      const mode = root.querySelector("[data-dcg-diff-mode]")?.value || "text";
      const before = root.querySelector("[data-dcg-diff-before]")?.value || ""; const after = root.querySelector("[data-dcg-diff-after]")?.value || "";
      workspace.diff = { mode, before, after, base: workspace.diff.base, result: null };
      const output = root.querySelector("[data-dcg-diff-result]");
      try {
        let result;
        if (mode === "json") result = jsonDiff(before, after);
        else if (mode === "image") result = imageMetadataDiff(JSON.parse(before), JSON.parse(after));
        else if (mode === "folder") result = folderManifestDiff(JSON.parse(before), JSON.parse(after));
        else result = textDiff(before, after);
        workspace.diff.result = result;
        const structured = mode !== "text";
        const added = result.added || 0; const removed = result.removed || 0; const changed = typeof result.changed === "number" ? result.changed : 0;
        output.innerHTML = `<header><span class="is-add">+${added}</span><span class="is-remove">-${removed}</span><span>~${changed}</span></header><ol>${result.entries.slice(0, 800).map((entry) => {
          if (!structured) return `<li class="is-${entry.type}"><i>${entry.left || ""}</i><i>${entry.right || ""}</i><code>${escapeHtml(entry.value)}</code></li>`;
          const entryType = entry.type || (entry.changed ? "change" : "equal"); const key = entry.path || entry.field || "metadata";
          return `<li class="is-${entryType}"><code>${escapeHtml(key)}</code><span>${escapeHtml(JSON.stringify(entry.before))}</span><b>→</b><span>${escapeHtml(JSON.stringify(entry.after))}</span></li>`;
        }).join("")}</ol>`;
        persist(); toast("Đã tạo diff không phá hủy.", "success");
      } catch (error) { output.innerHTML = `<p class="is-error">${escapeHtml(error.message)}</p>`; }
    }

    function renderMerge() {
      const base = root.querySelector('[data-dcg-merge="base"]')?.value || ""; const local = root.querySelector('[data-dcg-merge="local"]')?.value || ""; const remote = root.querySelector('[data-dcg-merge="remote"]')?.value || "";
      mergeState = threeWayMerge(base, local, remote); const output = root.querySelector("[data-dcg-merge-result]");
      output.innerHTML = mergeState.clean ? `<p class="is-success">Merge sạch theo chiến lược ${escapeHtml(mergeState.strategy)}.</p><pre>${escapeHtml(mergeState.result)}</pre>` : `<div class="dcg-conflicts">${mergeState.conflicts.map((item) => `<article><header><strong>${escapeHtml(item.id)} · dòng ${item.line}</strong><select data-dcg-conflict="${escapeHtml(item.id)}"><option value="">Chưa chọn</option><option value="local">Dùng Local</option><option value="remote">Dùng Remote</option><option value="base">Dùng Base</option><option value="both">Giữ cả hai</option></select></header><div><pre><small>BASE</small>${escapeHtml(item.base)}</pre><pre><small>LOCAL</small>${escapeHtml(item.local)}</pre><pre><small>REMOTE</small>${escapeHtml(item.remote)}</pre></div></article>`).join("")}</div><button data-dcg-action="resolve-merge">Tạo bản merge mới</button><pre data-dcg-resolved>${escapeHtml(mergeState.result)}</pre>`;
    }

    function generate(kind) {
      if (kind === "gitignore") generatorOutput = generateGitignore(["node", "web"]);
      else if (kind === "readme") generatorOutput = generateReadme({ title: workspace.project.name, description: "Project được tạo trong HH Code Playground.", scripts: [{ name: "npm test", description: "Chạy kiểm thử" }] });
      else if (kind === "changelog") generatorOutput = generateChangelog([{ version: "Unreleased", items: ["Nâng cấp Code Playground", "Bổ sung Git & Diff Studio"] }]);
      else if (kind === "release") generatorOutput = generateReleaseNotes({ title: "HH DEV Release", summary: "Bản nháp release, cần được người dùng duyệt trước khi xuất bản.", highlights: ["Code sandbox", "Three-way merge"], fixes: ["Không chạy lệnh shell thật"] });
      else generatorOutput = generateGithubActions({ name: "HH CI", node: "20", test: "npm test", build: "npm run build" });
      workspace.git.generator = kind; workspace.git.output = generatorOutput;
      const output = root.querySelector("[data-dcg-generator-output]"); if (output) output.textContent = generatorOutput; persist();
    }

    function onClick(event) {
      const tool = event.target.closest("[data-dcg-tool]"); if (tool) { workspace.activeTool = tool.dataset.dcgTool; return render(); }
      const fileButton = event.target.closest("[data-dcg-file]"); if (fileButton) { workspace.project.activeFileId = fileButton.dataset.dcgFile; return render(); }
      const tab = event.target.closest("[data-dcg-git-tab]"); if (tab) {
        root.querySelectorAll("[data-dcg-git-tab]").forEach((node) => node.classList.toggle("is-active", node === tab));
        root.querySelectorAll("[data-dcg-git-panel]").forEach((node) => node.classList.toggle("is-active", node.dataset.dcgGitPanel === tab.dataset.dcgGitTab)); return;
      }
      const generator = event.target.closest("[data-dcg-generator]"); if (generator) return generate(generator.dataset.dcgGenerator);
      const action = event.target.closest("[data-dcg-action]")?.dataset.dcgAction; if (!action) return;
      if (action === "run-preview") return renderPreview();
      if (action === "clear-console") { const output = root.querySelector("[data-dcg-console-output]"); if (output) output.innerHTML = ""; return; }
      if (action === "export-project") return downloadText(serializeProject(workspace.project), `${workspace.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.hhcode.json`, "application/json");
      if (action === "import-project") return root.querySelector("[data-dcg-project-file]")?.click();
      if (action === "new-file") { const name = `file-${workspace.project.files.length + 1}.js`; const file = normalizeFile({ name, content: "// Tệp mới\n" }, workspace.project.files.length); workspace.project.files.push(file); workspace.project.activeFileId = file.id; return render(); }
      if (action === "run-diff") return renderDiff();
      if (action === "build-commit") {
        const values = {}; root.querySelectorAll("[data-dcg-commit]").forEach((node) => { values[node.dataset.dcgCommit] = node.value; }); generatorOutput = buildConventionalCommit(values);
        const output = root.querySelector("[data-dcg-git-output]"); if (output) output.textContent = generatorOutput; workspace.git.commit = Object.assign(workspace.git.commit, values); persist(); return;
      }
      if (action === "download-generator") return downloadText(generatorOutput || workspace.git.output || "", `${workspace.git.generator || "generated"}.txt`);
      if (action === "run-merge") return renderMerge();
      if (action === "resolve-merge" && mergeState) {
        const choices = {}; root.querySelectorAll("[data-dcg-conflict]").forEach((node) => { choices[node.dataset.dcgConflict] = node.value; });
        const resolved = resolveMerge(mergeState, choices); const output = root.querySelector("[data-dcg-resolved]"); if (output) output.textContent = resolved.result;
        toast(resolved.clean ? "Đã tạo bản merge mới. Dữ liệu gốc được giữ nguyên." : `Còn ${resolved.conflicts.length} conflict chưa chọn.`, resolved.clean ? "success" : "warning");
      }
    }

    function onInput(event) {
      if (event.target.matches("[data-dcg-live]")) { workspace.project.liveReload = event.target.checked; persist(); }
      if (event.target.matches("[data-dcg-diff-before],[data-dcg-diff-after]")) { clearTimeout(saveTimer); saveTimer = setTimeout(() => { workspace.diff.before = root.querySelector("[data-dcg-diff-before]")?.value || ""; workspace.diff.after = root.querySelector("[data-dcg-diff-after]")?.value || ""; persist(); }, 300); }
    }

    function onSubmit(event) {
      if (!event.target.matches("[data-dcg-terminal-form]")) return; event.preventDefault();
      const input = root.querySelector("[data-dcg-terminal-input]"); const command = input?.value || ""; const result = runVirtualCommand(command, workspace.project);
      if (result.clear) workspace.project.terminal = [];
      else workspace.project.terminal.push({ id: uid("line"), type: "input", text: `› ${command}` }, { id: uid("line"), type: result.ok ? "output" : "error", text: result.output });
      if (result.action === "preview") renderPreview(); if (result.action === "export") downloadText(serializeProject(workspace.project), "hh-code-project.json", "application/json");
      persist(); render();
    }

    function onChange(event) {
      if (event.target.matches("[data-dcg-project-file]") && event.target.files[0]) {
        const file = event.target.files[0]; if (file.size > MAX_PROJECT_BYTES) return toast("Project vượt giới hạn 8 MB.", "error");
        const reader = new FileReader(); reader.onload = () => { try { workspace.project = importProject(reader.result); render(); toast("Đã nhập project.", "success"); } catch (error) { toast(error.message, "error"); } }; reader.readAsText(file);
      }
    }

    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("submit", onSubmit); globalScope.addEventListener?.("message", onMessage);
    render();
    const controller = {
      getWorkspace: () => clone(workspace),
      setWorkspace(value) { workspace = normalizeWorkspace(value); render(); },
      setTool(toolId) { if (!TOOL_IDS.includes(toolId)) throw new Error("Tool Code/Git không hợp lệ."); workspace.activeTool = toolId; render(); },
      runPreview: renderPreview,
      destroy() {
        if (destroyed) return; destroyed = true; clearTimeout(previewTimer); clearTimeout(saveTimer); editor?.destroy();
        root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("submit", onSubmit); globalScope.removeEventListener?.("message", onMessage); root.replaceChildren(); instances.delete(root);
      }
    };
    instances.set(root, controller); return controller;
  }

  function unmount(root) {
    const controller = instances.get(root); if (!controller) return false; controller.destroy(); return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, TOOL_IDS, STARTER_FILES, GITIGNORE_PRESETS,
    safeText, escapeHtml, formatBytes, normalizeFile, createDefaultProject, normalizeProject, serializeProject, importProject, findFile,
    buildSandboxDocument, runtimeCapabilities, transpileTypeScript, webContainerStatus, runVirtualCommand,
    textDiff, jsonDiff, normalizeImageMetadata, imageMetadataDiff, normalizeManifest, folderManifestDiff,
    buildConventionalCommit, generateGitignore, generateReadme, generateChangelog, generateReleaseNotes, generateGithubActions,
    threeWayMerge, resolveMerge, createDefaultWorkspace, normalizeWorkspace, mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHDevCodeGit = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
