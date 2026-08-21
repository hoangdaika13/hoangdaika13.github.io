(() => {
  "use strict";

  const VERSION = 3;
  const STORAGE_KEY = "hh.dev.galaxy.v3";
  const ENGINE_SOURCES = [
    { name: "HHDevSmartRecipe", tools: ["smart-input", "developer-recipe"] },
    { name: "HHDevApiStudio", tools: ["api-studio", "mock-api"] },
    { name: "HHDevDataSecurity", tools: ["json-data-lab", "security-encoding"] },
    { name: "HHDevRegexDatabase", tools: ["regex-studio", "database-playground"] },
    { name: "HHDevCodeGit", tools: ["code-playground", "git-diff-studio"] },
    { name: "HHDevDeliveryWorkflow", tools: ["delivery-workflow"] },
    { name: "HHDevDiagnosticsAI", tools: ["web-diagnostics", "ai-developer"] }
  ];

  const WORKSPACES = [
    { id: "smart-input", icon: "SI", planet: "space-dock", title: "Smart Input", description: "Nhận diện dữ liệu và chuyển thẳng tới đúng công cụ.", caps: ["Auto detect", "Clipboard", "File drop"] },
    { id: "developer-recipe", icon: "DR", planet: "space-dock", title: "Developer Recipe", description: "Ghép phép biến đổi thành pipeline có breakpoint.", caps: ["Pipeline", "Auto run", "Share"] },
    { id: "code-playground", icon: "CP", planet: "code-nebula", title: "Code Playground", description: "Editor đa tệp, preview sandbox, console và live reload.", caps: ["HTML/CSS/JS", "Sandbox", "Project"] },
    { id: "api-studio", icon: "AP", planet: "api-pulsar", title: "API Studio Pro", description: "REST, GraphQL, WebSocket và SSE trong một workspace.", caps: ["Collections", "Auth", "Assertions"] },
    { id: "mock-api", icon: "MK", planet: "api-pulsar", title: "Mock Server & Testing", description: "Mô phỏng OpenAPI, lỗi, độ trễ và chạy bộ kiểm thử.", caps: ["OpenAPI", "Runner", "Snippets"] },
    { id: "json-data-lab", icon: "JS", planet: "data-core", title: "JSON & Data Lab", description: "Tree, bảng, diff, query, schema và chuyển đổi dữ liệu.", caps: ["Tree", "Schema", "Convert"] },
    { id: "database-playground", icon: "DB", planet: "data-core", title: "Database Playground", description: "SQL, schema, dữ liệu CSV/JSON và Mongo query builder.", caps: ["SQL", "Schema", "Import"] },
    { id: "git-diff-studio", icon: "GD", planet: "git-orbit", title: "Git & Diff Studio", description: "Diff, merge, commit, changelog và workflow CI/CD.", caps: ["3-way merge", "Generator", "YAML"] },
    { id: "delivery-workflow", icon: "DW", planet: "delivery-launchpad", title: "Delivery Workflow", description: "Issue tới branch, sandbox, scan, preview và rollback có approval gate.", caps: ["OAuth server", "Human gate", "Rollback"] },
    { id: "security-encoding", icon: "SE", planet: "security-shield", title: "Security & Encoding", description: "JWT, hash, Web Crypto, CSP và quét secret cục bộ.", caps: ["Web Crypto", "Scanner", "Local"] },
    { id: "regex-studio", icon: "RX", planet: "security-shield", title: "Regex Studio", description: "Highlight, capture, replace, test case và giải thích tiếng Việt.", caps: ["Realtime", "Tests", "Explain"] },
    { id: "web-diagnostics", icon: "WD", planet: "observability-radar", title: "Web Diagnostics", description: "Hiệu suất, header, CORS, CSP, bundle và error timeline.", caps: ["Vitals", "Network", "Audit"] },
    { id: "ai-developer", icon: "AI", planet: "observability-radar", title: "HH Copilot Star", description: "Giải thích, tạo test, review diff và chỉ áp dụng sau khi duyệt.", caps: ["Preview first", "Redaction", "Server AI"] }
  ];

  const PLANETS = [
    {
      id: "space-dock", icon: "SD", title: "Project Space Dock", short: "Dự án & môi trường",
      color: "#66eff7", accent: "#2c9cff", identity: "starport",
      description: "Universal Dev Project giữ repository, branch, environment, runtime và phiên làm việc trong một ngữ cảnh.",
      tools: ["smart-input", "developer-recipe"], satellites: ["notes", "cron"],
      features: [
        ["Universal Dev Project", "local"], ["Environment profile", "local"],
        ["Session history", "local"], ["Remote container", "adapter"]
      ]
    },
    {
      id: "code-nebula", icon: "CN", title: "Code Nebula", short: "Code & sandbox",
      color: "#a477ff", accent: "#ff66d4", identity: "code-cloud",
      description: "Không gian code đa tệp với preview cách ly, console, test và bản đồ phụ thuộc.",
      tools: ["code-playground"], satellites: ["markdown", "text", "color", "image"],
      features: [
        ["Multi-file editor", "local"], ["Live preview sandbox", "local"],
        ["Test console", "local"], ["Dependency graph", "local"]
      ]
    },
    {
      id: "api-pulsar", icon: "AP", title: "API Pulsar", short: "API & realtime",
      color: "#ff6fcf", accent: "#65ebff", identity: "pulsar",
      description: "Thiết kế, gọi, mô phỏng và kiểm thử REST, GraphQL, WebSocket, SSE từ một bộ sưu tập dùng chung.",
      tools: ["api-studio", "mock-api"], satellites: ["api", "url", "network"],
      features: [
        ["Collections & environments", "local"], ["OpenAPI mock", "local"],
        ["Assertions & runner", "local"], ["Scheduled monitor", "adapter"]
      ]
    },
    {
      id: "data-core", icon: "DC", title: "Data Core", short: "Dữ liệu & database",
      color: "#5ca9ff", accent: "#62f3d2", identity: "data-reactor",
      description: "Khám phá dữ liệu, schema, query plan và migration bằng chế độ chỉ đọc an toàn mặc định.",
      tools: ["json-data-lab", "database-playground"], satellites: ["json", "sql", "base64", "timestamp", "qr-barcode"],
      features: [
        ["JSON tree & schema", "local"], ["SQL/Mongo builder", "local"],
        ["Migration preview", "local"], ["Managed backup", "adapter"]
      ]
    },
    {
      id: "git-orbit", icon: "GO", title: "Git Orbit", short: "Git & collaboration",
      color: "#ff9b61", accent: "#b77cff", identity: "branch-orbit",
      description: "Branch, commit và thay đổi trở thành quỹ đạo có thể so sánh, review và hợp nhất an toàn.",
      tools: ["git-diff-studio"], satellites: ["compare", "markdown"],
      features: [
        ["Commit constellation", "local"], ["3-way merge", "local"],
        ["Changelog generator", "local"], ["Repository write", "adapter"]
      ]
    },
    {
      id: "delivery-launchpad", icon: "DL", title: "Delivery Launchpad", short: "CI/CD & release",
      color: "#ffd865", accent: "#ff8b47", identity: "launchpad",
      description: "Kiểm tra, approval, preview, promote và rollback theo một release gate có lịch sử rõ ràng.",
      tools: ["delivery-workflow"], satellites: ["cron", "system"],
      features: [
        ["Quality gates", "local"], ["Human approval", "local"],
        ["Preview & rollback", "adapter"], ["Feature flags", "adapter"]
      ]
    },
    {
      id: "security-shield", icon: "SS", title: "Security Shield", short: "Security & quality",
      color: "#ff5f86", accent: "#ff3bd5", identity: "shield",
      description: "Quét secret, crypto, CSP, dependency và policy trước khi code rời khỏi thiết bị.",
      tools: ["security-encoding", "regex-studio"], satellites: ["uuid", "password", "hash", "encryption"],
      features: [
        ["Secret scanner", "local"], ["JWT & Web Crypto", "local"],
        ["CSP policy builder", "local"], ["Advisory database", "adapter"]
      ]
    },
    {
      id: "observability-radar", icon: "OR", title: "Observability Radar", short: "Logs, traces & AI",
      color: "#79f59e", accent: "#50d9ff", identity: "radar",
      description: "Điều tra lỗi từ Web Vitals tới provider, đồng thời dùng Copilot để giải thích và đề xuất bản vá có kiểm soát.",
      tools: ["web-diagnostics", "ai-developer"], satellites: ["system", "network", "calculator"],
      features: [
        ["Web diagnostics", "local"], ["Release markers", "local"],
        ["Runtime logs & traces", "adapter"], ["AI diff review", "adapter"]
      ]
    }
  ];

  const THEMES = [
    ["quantum", "Quantum IDE"],
    ["cyber", "Cyber Forge"],
    ["aurora", "Aurora Code"],
    ["nebula", "Nebula Purple"],
    ["solar", "Solar Terminal"],
    ["blackhole", "Black Hole Debug"]
  ];
  const EFFECTS = [["static", "Tĩnh"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"]];
  const ENVIRONMENTS = [["development", "Development"], ["preview", "Preview"], ["production", "Production"]];
  const TOOL_BY_ID = new Map(WORKSPACES.map((tool) => [tool.id, tool]));
  const PLANET_BY_ID = new Map(PLANETS.map((planet) => [planet.id, planet]));

  let activeEngine = null;
  let activeHost = null;
  let activeAbort = null;
  let runtimeHealth = null;
  let runtimeDelivery = null;
  let healthPending = false;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const safeText = (value, max = 120) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  const nowIso = () => new Date().toISOString();
  const engines = () => ENGINE_SOURCES.map((source) => ({ ...source, api: window[source.name] })).filter((entry) => entry.api);
  const findEngine = (toolId) => engines().find((entry) => entry.api?.supports?.(toolId) || entry.tools.includes(toolId))?.api;
  const findTool = (id) => TOOL_BY_ID.get(id);
  const findPlanetForTool = (id) => PLANET_BY_ID.get(findTool(id)?.planet);

  function defaultEffects() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return "static";
    if (Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4) return "static";
    return "balanced";
  }

  function defaultState() {
    return {
      version: VERSION,
      project: {
        id: "hh-platform",
        name: "HH Platform",
        repository: "hoangdaika13/hoangdaika13.github.io",
        branch: "main",
        environment: "production",
        framework: "Vanilla JS · Vercel",
        updatedAt: nowIso()
      },
      preferences: { theme: "quantum", effects: defaultEffects(), density: "comfortable" },
      tasks: [],
      recentTools: [],
      activity: []
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    const raw = input && typeof input === "object" ? input : {};
    const project = raw.project && typeof raw.project === "object" ? raw.project : {};
    const preferences = raw.preferences && typeof raw.preferences === "object" ? raw.preferences : {};
    return {
      version: VERSION,
      project: {
        id: safeText(project.id || base.project.id, 60).replace(/[^a-z0-9_-]/gi, "-").toLowerCase() || base.project.id,
        name: safeText(project.name || base.project.name, 80) || base.project.name,
        repository: safeText(project.repository || base.project.repository, 160),
        branch: safeText(project.branch || base.project.branch, 100) || "main",
        environment: ENVIRONMENTS.some(([id]) => id === project.environment) ? project.environment : base.project.environment,
        framework: safeText(project.framework || base.project.framework, 100),
        updatedAt: safeText(project.updatedAt || base.project.updatedAt, 40)
      },
      preferences: {
        theme: THEMES.some(([id]) => id === preferences.theme) ? preferences.theme : base.preferences.theme,
        effects: EFFECTS.some(([id]) => id === preferences.effects) ? preferences.effects : base.preferences.effects,
        density: ["compact", "comfortable", "wide"].includes(preferences.density) ? preferences.density : base.preferences.density
      },
      tasks: (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 30).map((task, index) => ({
        id: safeText(task?.id || `task-${index}`, 64),
        text: safeText(task?.text, 180),
        done: task?.done === true,
        createdAt: safeText(task?.createdAt || nowIso(), 40)
      })).filter((task) => task.text),
      recentTools: (Array.isArray(raw.recentTools) ? raw.recentTools : []).filter((id) => TOOL_BY_ID.has(id)).slice(0, 8),
      activity: (Array.isArray(raw.activity) ? raw.activity : []).slice(0, 20).map((entry) => ({
        label: safeText(entry?.label, 160),
        at: safeText(entry?.at || nowIso(), 40)
      })).filter((entry) => entry.label)
    };
  }

  function readState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch { return defaultState(); }
  }

  function writeState(next, eventLabel = "") {
    const state = normalizeState(next);
    if (eventLabel) state.activity = [{ label: safeText(eventLabel, 160), at: nowIso() }, ...state.activity].slice(0, 20);
    state.project.updatedAt = nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    window.dispatchEvent(new CustomEvent("hh:dev-project-change", {
      detail: {
        projectId: state.project.id,
        environment: state.project.environment,
        branch: state.project.branch,
        updatedAt: state.project.updatedAt
      }
    }));
    return state;
  }

  function rememberTool(toolId) {
    if (!TOOL_BY_ID.has(toolId)) return readState();
    const state = readState();
    state.recentTools = [toolId, ...state.recentTools.filter((id) => id !== toolId)].slice(0, 8);
    return writeState(state, `Đã mở ${findTool(toolId).title}`);
  }

  function cleanup() {
    activeAbort?.abort();
    activeAbort = null;
    if (activeEngine?.cleanup) activeEngine.cleanup(activeHost);
    else activeEngine?.unmount?.(activeHost);
    activeEngine = null;
    activeHost = null;
  }

  function browserCapabilities() {
    return [
      ["Web Crypto", Boolean(window.crypto?.subtle)],
      ["WebSocket", "WebSocket" in window],
      ["Worker", "Worker" in window],
      ["IndexedDB", "indexedDB" in window]
    ];
  }

  function deliverySnapshot() {
    if (runtimeDelivery) return runtimeDelivery;
    try {
      const value = JSON.parse(localStorage.getItem("hh.dev.delivery-workflow.v1") || "null");
      return value && typeof value === "object" ? value : null;
    } catch { return null; }
  }

  function connectorRows() {
    const health = runtimeHealth?.health || {};
    const delivery = deliverySnapshot();
    return [
      { id: "browser", label: "Browser Runtime", connected: true, detail: "Local First" },
      { id: "github", label: "GitHub", connected: delivery?.provider?.connected === true, detail: delivery?.provider?.connected ? "OAuth phiên hiện tại" : "Chưa có phiên OAuth" },
      { id: "database", label: "MongoDB", connected: health.database?.connected === true, detail: health.database?.connected ? "Backend đã xác nhận" : "Chưa kết nối" },
      { id: "realtime", label: "Realtime", connected: health.realtime?.connected === true, detail: health.realtime?.connected ? "Socket.IO online" : "Chưa sẵn sàng" },
      { id: "storage", label: "Object Storage", connected: health.storage?.objectStorage === true, detail: health.storage?.objectStorage ? health.storage?.provider || "Đã kết nối" : "Metadata only" },
      { id: "payos", label: "PayOS", connected: health.payments?.payos === true, detail: health.payments?.payos ? "Server adapter" : "Chưa kết nối" },
      { id: "ai", label: "AI Provider", connected: health.ai?.gemini === true, detail: health.ai?.gemini ? "Server AI sẵn sàng" : "Chưa kết nối" },
      { id: "oauth", label: "Google OAuth", connected: health.auth?.googleOAuth === true, detail: health.auth?.googleOAuth ? "Đã cấu hình" : "Chưa cấu hình" }
    ];
  }

  function readinessForPlanet(planet) {
    const readyTools = planet.tools.filter((id) => Boolean(findEngine(id))).length;
    if (readyTools === planet.tools.length) return { level: "ready", label: "Workspace sẵn sàng", value: 100 };
    if (readyTools > 0) return { level: "watch", label: `${readyTools}/${planet.tools.length} workspace`, value: Math.round(readyTools / planet.tools.length * 100) };
    return { level: "offline", label: "Engine chưa tải", value: 0 };
  }

  function rootDeckMarkup(state, compact = false) {
    const connected = connectorRows().filter((item) => item.connected).length;
    return `<header class="dev-root-deck${compact ? " is-compact" : ""}">
      <button class="dev-root-brand" type="button" data-dev-route="/dev-tools" aria-label="Về Developer Galaxy">
        <i>HH</i><span><b>Developer Galaxy</b><small>Universal Dev Project v${VERSION}</small></span>
      </button>
      <div class="dev-root-context">
        <span><small>Dự án</small><strong>${escapeHtml(state.project.name)}</strong></span>
        <span><small>Branch</small><strong>${escapeHtml(state.project.branch)}</strong></span>
        <label><small>Môi trường</small><select data-dev-environment aria-label="Môi trường dự án">${ENVIRONMENTS.map(([value, label]) => `<option value="${value}"${state.project.environment === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      </div>
      <div class="dev-root-controls">
        <span class="dev-root-live"><i></i>${connected}/${connectorRows().length} kết nối</span>
        <label><span class="sr-only">Theme DEV</span><select data-dev-theme aria-label="Theme DEV">${THEMES.map(([value, label]) => `<option value="${value}"${state.preferences.theme === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <label><span class="sr-only">Mức hiệu ứng</span><select data-dev-effects aria-label="Mức hiệu ứng">${EFFECTS.map(([value, label]) => `<option value="${value}"${state.preferences.effects === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <button type="button" data-dev-command aria-keyshortcuts="Control+K">⌘K · Công cụ</button>
        <button type="button" data-dev-edit-project>Chỉnh dự án</button>
      </div>
    </header>`;
  }

  function capabilityMarkup() {
    return browserCapabilities().map(([label, ready]) => `<span class="${ready ? "is-ready" : "is-limited"}"><i></i>${escapeHtml(label)}<b>${ready ? "READY" : "LIMITED"}</b></span>`).join("");
  }

  function planetOrbitMarkup() {
    return `<div class="dev-galaxy-orbit" aria-label="Bản đồ 8 hành tinh DEV">
      <div class="dev-core-star"><i></i><strong>HH</strong><span>DEV CORE</span></div>
      ${PLANETS.map((planet, index) => {
        const readiness = readinessForPlanet(planet);
        return `<button type="button" class="dev-orbit-planet p${index + 1} is-${readiness.level}" style="--planet:${planet.color};--accent:${planet.accent};--orbit-index:${index}" data-dev-route="/dev-tools/${planet.id}" aria-label="${escapeHtml(planet.title)}: ${escapeHtml(readiness.label)}"><i>${planet.icon}</i><span>${escapeHtml(planet.short)}</span></button>`;
      }).join("")}
      <i class="dev-orbit-line line-a"></i><i class="dev-orbit-line line-b"></i><i class="dev-orbit-line line-c"></i><i class="dev-orbit-line line-d"></i>
    </div>`;
  }

  function actionQueue(state) {
    const actions = [];
    const pendingTasks = state.tasks.filter((task) => !task.done);
    pendingTasks.slice(0, 3).forEach((task) => actions.push({ tone: "task", label: task.text, detail: "Việc trong Universal Dev Project", route: "" }));
    const disconnected = connectorRows().filter((item) => !item.connected);
    disconnected.slice(0, Math.max(0, 4 - actions.length)).forEach((item) => actions.push({
      tone: "connect", label: `Kết nối ${item.label}`, detail: item.detail, route: item.id === "github" ? "/dev-tools/delivery-workflow" : item.id === "database" ? "/dev-tools/data-core" : "/dev-tools/observability-radar"
    }));
    if (!actions.length) actions.push({ tone: "ready", label: "Không có cảnh báo cần xử lý", detail: "Các kết nối đã kiểm tra đều sẵn sàng.", route: "" });
    return actions.slice(0, 5);
  }

  function workflowStages() {
    const delivery = deliverySnapshot() || {};
    const checks = delivery.checks || {};
    const recent = readState().recentTools;
    const stages = [
      ["Project", true, "Universal context"],
      ["Code", recent.includes("code-playground") || Boolean(delivery.change?.status), recent.includes("code-playground") ? "Đã mở workspace" : "Chưa có phiên"],
      ["Test", Object.values(checks).some((item) => item?.status === "passed"), Object.values(checks).filter((item) => item?.status === "passed").length ? `${Object.values(checks).filter((item) => item?.status === "passed").length} gate đạt` : "Chưa có kết quả"],
      ["Security", checks.secrets?.status === "passed", checks.secrets?.status === "passed" ? "Secret scan đạt" : "Chưa xác nhận"],
      ["Preview", delivery.delivery?.preview?.status === "succeeded", delivery.delivery?.preview?.status === "succeeded" ? "Preview sẵn sàng" : "Chưa triển khai"],
      ["Release", delivery.delivery?.mergeStatus === "merged", delivery.delivery?.mergeStatus === "merged" ? "Đã merge" : "Cần approval"]
    ];
    return stages;
  }

  function projectDialogMarkup(state) {
    return `<div class="dev-project-dialog" data-dev-project-dialog hidden>
      <div class="dev-project-dialog-backdrop" data-dev-close-project></div>
      <form class="dev-project-dialog-card" data-dev-project-form aria-labelledby="dev-project-dialog-title">
        <header><div><small>UNIVERSAL DEV PROJECT</small><h3 id="dev-project-dialog-title">Cấu hình ngữ cảnh phát triển</h3></div><button type="button" data-dev-close-project aria-label="Đóng">×</button></header>
        <label>Tên dự án<input name="name" maxlength="80" value="${escapeHtml(state.project.name)}" required></label>
        <label>Repository<input name="repository" maxlength="160" value="${escapeHtml(state.project.repository)}" placeholder="owner/repository"></label>
        <div class="dev-project-form-row"><label>Branch<input name="branch" maxlength="100" value="${escapeHtml(state.project.branch)}" required></label><label>Framework<input name="framework" maxlength="100" value="${escapeHtml(state.project.framework)}"></label></div>
        <p>Secret, token và private key không được lưu trong Universal Dev Project.</p>
        <footer><button type="button" data-dev-close-project>Hủy</button><button class="is-primary" type="submit">Lưu dự án</button></footer>
      </form>
    </div>`;
  }

  function commandResultsMarkup(query = "") {
    const needle = safeText(query, 80).toLocaleLowerCase("vi");
    const tools = WORKSPACES.filter((tool) => `${tool.title} ${tool.description} ${tool.caps.join(" ")}`.toLocaleLowerCase("vi").includes(needle));
    const planets = PLANETS.filter((planet) => `${planet.title} ${planet.short} ${planet.description}`.toLocaleLowerCase("vi").includes(needle));
    const actions = [
      { id: "health", label: "Kiểm tra hệ thống", detail: "Đọc health server; không giả lập adapter", action: "refresh-health" },
      { id: "copy-context", label: "Sao chép project context", detail: "Chỉ copy metadata an toàn, không có secret", action: "copy-context" },
      { id: "export-config", label: "Xuất cấu hình DEV", detail: "JSON local-first đã loại bỏ dữ liệu nhạy cảm", action: "export-config" }
    ].filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase("vi").includes(needle));
    const rows = [
      ...actions.map((item) => `<button type="button" class="dev-command-row is-action" data-dev-command-action="${item.action}"><i>⌘</i><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span><b>↵</b></button>`),
      ...planets.map((planet) => `<button type="button" class="dev-command-row is-planet" data-dev-command-route="/dev-tools/${planet.id}"><i style="--planet:${planet.color}">${planet.icon}</i><span><strong>${escapeHtml(planet.title)}</strong><small>${escapeHtml(planet.short)} · ${planet.tools.length} workspace</small></span><b>→</b></button>`),
      ...tools.map((tool) => `<button type="button" class="dev-command-row" data-dev-command-route="/dev-tools/${tool.id}"><i style="--planet:${findPlanetForTool(tool.id)?.color || "#66eff7"}">${tool.icon}</i><span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.description)}</small></span><b>→</b></button>`)
    ];
    return rows.length ? rows.join("") : `<div class="dev-command-empty"><strong>Không tìm thấy workspace</strong><span>Thử tên hành tinh, công cụ hoặc capability khác.</span></div>`;
  }

  function commandPaletteMarkup() {
    return `<dialog class="dev-command-palette" data-dev-command-dialog aria-labelledby="dev-command-title">
      <form method="dialog" class="dev-command-card" data-dev-command-form>
        <header><div><small>HH DEVELOPER GALAXY</small><h3 id="dev-command-title">Mở workspace hoặc hành động</h3></div><button type="submit" aria-label="Đóng">×</button></header>
        <label class="dev-command-search"><span>⌕</span><input type="search" data-dev-command-input placeholder="Tìm tool, hành tinh, API, Git, Security…" autocomplete="off" autofocus><kbd>ESC</kbd></label>
        <div class="dev-command-results" data-dev-command-results>${commandResultsMarkup()}</div>
        <footer><span><kbd>↑↓</kbd> chọn</span><span><kbd>Enter</kbd> mở</span><span><kbd>Ctrl K</kbd> mở nhanh</span></footer>
      </form>
    </dialog>`;
  }

  function overviewMarkup() {
    const state = readState();
    const connectors = connectorRows();
    const connectedCount = connectors.filter((item) => item.connected).length;
    const completedTasks = state.tasks.filter((task) => task.done).length;
    const lastTool = findTool(state.recentTools[0]);
    const stages = workflowStages();
    return `<section class="dev-galaxy dev-theme-${state.preferences.theme}" data-dev-galaxy data-effects="${state.preferences.effects}" data-density="${state.preferences.density}">
      ${rootDeckMarkup(state)}
      <header class="dev-galaxy-hero">
        <div class="dev-hero-copy">
          <span class="dev-galaxy-kicker">HH DEVELOPER GALAXY · 8 PLANETS · 13 WORKSPACES · 34 TOOLS</span>
          <h2>Xây dựng, kiểm thử và vận hành trong một vũ trụ.</h2>
          <p>Một Universal Dev Project kết nối code, API, dữ liệu, Git, delivery, bảo mật và quan sát. Mọi thay đổi nguy hiểm đều đi qua Preview, kiểm tra và phê duyệt.</p>
          <div class="dev-hero-actions">
            <button class="is-primary" type="button" data-dev-route="${lastTool ? `/dev-tools/${lastTool.id}` : "/dev-tools/space-dock"}">${lastTool ? `Tiếp tục ${escapeHtml(lastTool.title)}` : "Khởi tạo dự án"}</button>
            <button type="button" data-dev-route="/dev-tools/api-pulsar">Mở API Pulsar</button>
            <button type="button" data-dev-refresh-health>${healthPending ? "Đang kiểm tra…" : "Kiểm tra hệ thống"}</button>
          </div>
          <div class="dev-browser-capabilities" aria-label="Khả năng trình duyệt">${capabilityMarkup()}</div>
        </div>
        ${planetOrbitMarkup()}
        <div class="dev-space-dust" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </header>

      <section class="dev-command-grid">
        <article class="dev-mission-control">
          <header><div><small>GALAXY MISSION CONTROL</small><h3>Tình trạng dự án</h3></div><span class="dev-live-badge"><i></i>${runtimeHealth ? "Dữ liệu máy chủ" : "Đang dùng dữ liệu cục bộ"}</span></header>
          <div class="dev-mission-stats">
            <span><b>${connectedCount}/${connectors.length}</b><small>Kết nối sẵn sàng</small></span>
            <span><b>${state.tasks.length ? `${completedTasks}/${state.tasks.length}` : "0"}</b><small>Công việc hoàn thành</small></span>
            <span><b>${state.recentTools.length}</b><small>Workspace gần đây</small></span>
            <span><b>${stages.filter((stage) => stage[1]).length}/${stages.length}</b><small>Release stages có dữ liệu</small></span>
          </div>
          <div class="dev-connector-grid">
            ${connectors.map((item) => `<span class="${item.connected ? "is-online" : "is-offline"}"><i></i><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail)}</small></span>`).join("")}
          </div>
        </article>

        <article class="dev-action-queue">
          <header><div><small>ACTION QUEUE</small><h3>Việc nên xử lý tiếp</h3></div><b>${actionQueue(state).length}</b></header>
          <div>${actionQueue(state).map((item) => `<button type="button" class="is-${item.tone}"${item.route ? ` data-dev-route="${item.route}"` : ""}><i></i><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span><b>${item.route ? "→" : "✓"}</b></button>`).join("")}</div>
        </article>
      </section>

      <section class="dev-planet-section">
        <header class="dev-section-heading"><div><small>8 HÀNH TINH CHUYÊN SÂU</small><h3>Chọn không gian làm việc</h3></div><p>Công cụ cũ được giữ như vệ tinh; Ctrl + K vẫn tìm được toàn bộ chức năng.</p></header>
        <div class="dev-planet-grid">
          ${PLANETS.map((planet, index) => {
            const readiness = readinessForPlanet(planet);
            return `<article class="dev-planet-card is-${readiness.level}" style="--planet:${planet.color};--accent:${planet.accent};--delay:${index * 45}ms">
              <button type="button" class="dev-planet-main" data-dev-route="/dev-tools/${planet.id}">
                <span class="dev-planet-icon"><i>${planet.icon}</i><em style="--progress:${readiness.value}%"></em></span>
                <span class="dev-planet-copy"><small>PLANET 0${index + 1}</small><strong>${escapeHtml(planet.title)}</strong><em>${escapeHtml(planet.description)}</em></span>
                <b>↗</b>
              </button>
              <footer><span><i></i>${escapeHtml(readiness.label)}</span><span>${planet.tools.length} workspace · ${planet.satellites.length} vệ tinh</span></footer>
            </article>`;
          }).join("")}
        </div>
      </section>

      <section class="dev-release-flow">
        <header class="dev-section-heading"><div><small>SAFE DELIVERY PATH</small><h3>Từ ý tưởng tới production</h3></div><button type="button" data-dev-route="/dev-tools/delivery-launchpad">Mở Launchpad</button></header>
        <div class="dev-flow-track">
          ${stages.map(([label, complete, detail], index) => `<div class="${complete ? "is-complete" : ""}"><i>${complete ? "✓" : index + 1}</i><span><strong>${label}</strong><small>${escapeHtml(detail)}</small></span></div>`).join("")}
        </div>
      </section>

      <section class="dev-project-work">
        <article class="dev-task-console">
          <header><div><small>PROJECT TASKS</small><h3>Việc đang làm</h3></div><span>${completedTasks}/${state.tasks.length || 0}</span></header>
          <form data-dev-task-form><input name="task" maxlength="180" placeholder="Thêm việc cho dự án…" aria-label="Việc mới"><button type="submit">Thêm</button></form>
          <div class="dev-task-list">${state.tasks.length ? state.tasks.map((task) => `<label class="${task.done ? "is-done" : ""}"><input type="checkbox" data-dev-task-toggle="${escapeHtml(task.id)}"${task.done ? " checked" : ""}><span>${escapeHtml(task.text)}</span><button type="button" data-dev-task-delete="${escapeHtml(task.id)}" aria-label="Xóa việc">×</button></label>`).join("") : `<p>Chưa có công việc. Danh sách này chỉ lưu trên thiết bị của bạn.</p>`}</div>
        </article>
        <article class="dev-recent-console">
          <header><div><small>RECENT SIGNALS</small><h3>Phiên làm việc gần đây</h3></div><button type="button" data-dev-clear-activity>Xóa</button></header>
          <div>${state.activity.length ? state.activity.slice(0, 7).map((entry) => `<span><i></i><b>${escapeHtml(entry.label)}</b><time>${escapeHtml(new Date(entry.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }))}</time></span>`).join("") : `<p>Hoạt động cục bộ sẽ xuất hiện tại đây sau khi bạn mở workspace hoặc cập nhật dự án.</p>`}</div>
        </article>
      </section>

      <footer class="dev-galaxy-privacy">
        <i>◇</i><div><strong>Privacy Boundary đang hoạt động</strong><span>Secret không được đưa vào URL hoặc file export mặc định. Dashboard chỉ hiển thị trạng thái kết nối, không đọc hoặc lưu token.</span></div>
        <button type="button" data-dev-route="/dev-tools/security-shield">Kiểm tra bảo mật</button>
      </footer>
      ${projectDialogMarkup(state)}
      ${commandPaletteMarkup()}
      <div class="dev-toast" data-dev-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function featureModeLabel(mode) {
    if (mode === "local") return "Sẵn sàng cục bộ";
    return "Qua adapter bảo mật";
  }

  function planetMarkup(planet) {
    const state = readState();
    const readiness = readinessForPlanet(planet);
    const tools = planet.tools.map(findTool).filter(Boolean);
    return `<section class="dev-galaxy dev-planet-view dev-theme-${state.preferences.theme}" data-dev-galaxy data-effects="${state.preferences.effects}" data-density="${state.preferences.density}" style="--planet:${planet.color};--accent:${planet.accent}">
      ${rootDeckMarkup(state, true)}
      <nav class="dev-planet-rail" aria-label="8 hành tinh DEV">${PLANETS.map((item) => `<button type="button" class="${item.id === planet.id ? "is-active" : ""}" style="--planet:${item.color}" data-dev-route="/dev-tools/${item.id}"><i>${item.icon}</i><span>${escapeHtml(item.short)}</span></button>`).join("")}</nav>
      <header class="dev-planet-hero">
        <div class="dev-planet-reactor" aria-hidden="true"><i></i><i></i><i></i><strong>${planet.icon}</strong></div>
        <div><span>DEVELOPER GALAXY · ${escapeHtml(planet.short)}</span><h2>${escapeHtml(planet.title)}</h2><p>${escapeHtml(planet.description)}</p><div><button class="is-primary" type="button" data-dev-route="/dev-tools/${tools[0]?.id || "overview"}">Mở ${escapeHtml(tools[0]?.title || "workspace")}</button><button type="button" data-dev-route="/dev-tools">Về Mission Control</button></div></div>
        <aside><small>TRẠNG THÁI</small><strong>${readiness.value}%</strong><span><i></i>${escapeHtml(readiness.label)}</span></aside>
      </header>
      <main class="dev-planet-layout">
        <section class="dev-planet-capabilities">
          <header><div><small>CAPABILITY MATRIX</small><h3>Năng lực của hành tinh</h3></div><span>Không giả lập trạng thái adapter</span></header>
          <div>${planet.features.map(([label, mode]) => `<article class="is-${mode}"><i>${mode === "local" ? "✓" : "↗"}</i><span><strong>${escapeHtml(label)}</strong><small>${featureModeLabel(mode)}</small></span></article>`).join("")}</div>
        </section>
        <aside class="dev-planet-tools">
          <header><small>CORE WORKSPACES</small><h3>Công cụ chính</h3></header>
          ${tools.map((tool) => `<button type="button" data-dev-route="/dev-tools/${tool.id}"><i>${tool.icon}</i><span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.description)}</small><em>${tool.caps.map(escapeHtml).join(" · ")}</em></span><b>→</b></button>`).join("")}
        </aside>
      </main>
      <section class="dev-satellite-dock">
        <header><div><small>UTILITY SATELLITES</small><h3>Tiện ích liên quan</h3></div><span>${planet.satellites.length} vệ tinh</span></header>
        <div>${planet.satellites.map((id) => `<button type="button" data-dev-route="/dev-tools/${id}"><i>${id.slice(0, 2).toUpperCase()}</i><span>${escapeHtml(id.replace(/-/g, " "))}</span></button>`).join("")}</div>
      </section>
      <section class="dev-planet-safety">
        <i>◎</i><div><strong>Safe by design</strong><span>Hành động mạng chỉ chạy sau thao tác rõ ràng. Thay đổi code, deployment và dữ liệu cần Preview hoặc approval khi engine hỗ trợ.</span></div>
      </section>
      ${projectDialogMarkup(state)}
      ${commandPaletteMarkup()}
      <div class="dev-toast" data-dev-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function toolShellMarkup(tool) {
    const state = readState();
    const planet = findPlanetForTool(tool.id);
    return `<section class="dev-galaxy dev-tool-shell dev-theme-${state.preferences.theme}" data-dev-galaxy data-effects="${state.preferences.effects}" data-density="${state.preferences.density}" style="--planet:${planet?.color || "#66eff7"};--accent:${planet?.accent || "#a477ff"}">
      ${rootDeckMarkup(state, true)}
      <nav class="dev-tool-breadcrumb" aria-label="Điều hướng workspace"><button type="button" data-dev-route="/dev-tools/${planet?.id || ""}">← ${escapeHtml(planet?.title || "Developer Galaxy")}</button><i>/</i><strong>${escapeHtml(tool.title)}</strong><span>${tool.caps.map(escapeHtml).join(" · ")}</span></nav>
      <div class="dev-tool-stage" data-dev-engine-host></div>
      ${projectDialogMarkup(state)}
      ${commandPaletteMarkup()}
      <div class="dev-toast" data-dev-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function showToast(host, message) {
    const toast = host.querySelector("[data-dev-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function applyPreferences(host, state = readState()) {
    const root = host.querySelector("[data-dev-galaxy]");
    if (!root) return;
    root.className = root.className.replace(/\bdev-theme-\S+/g, "").trim();
    root.classList.add(`dev-theme-${state.preferences.theme}`);
    root.dataset.effects = state.preferences.effects;
    root.dataset.density = state.preferences.density;
  }

  async function refreshHealth(host, rerender = true) {
    if (healthPending) return;
    healthPending = true;
    host.querySelector("[data-dev-refresh-health]")?.setAttribute("disabled", "");
    try {
      const response = await fetch("/api/platform/summary?view=health", {
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-HH-Requested-With": "dev-galaxy" }
      });
      if (!response.ok) throw new Error("health-unavailable");
      const data = await response.json();
      runtimeHealth = data?.ok === true && data?.health ? data : null;
    } catch {
      runtimeHealth = null;
    } finally {
      healthPending = false;
      if (rerender && activeHost === host) {
        host.innerHTML = overviewMarkup();
        showToast(host, runtimeHealth ? "Đã cập nhật trạng thái từ máy chủ." : "Không thể xác nhận máy chủ; đang hiển thị dữ liệu cục bộ.");
      }
    }
  }

  function openProjectDialog(host, open) {
    const dialog = host.querySelector("[data-dev-project-dialog]");
    if (!dialog) return;
    dialog.hidden = !open;
    if (open) dialog.querySelector("input[name=name]")?.focus();
  }

  function openCommandPalette(host, open) {
    const dialog = host.querySelector("[data-dev-command-dialog]");
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
      else dialog.removeAttribute("hidden");
      const input = dialog.querySelector("[data-dev-command-input]");
      if (input) { input.value = ""; dialog.querySelector("[data-dev-command-results]").innerHTML = commandResultsMarkup(); setTimeout(() => input.focus(), 0); }
    } else if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.setAttribute("hidden", "");
  }

  function exportDevConfig() {
    const state = readState();
    const payload = { format: "hh-dev-project", version: VERSION, exportedAt: nowIso(), project: state.project, preferences: state.preferences, tasks: state.tasks, recentTools: state.recentTools, activity: state.activity };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${state.project.id || "hh-dev-project"}-config.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copyDevContext(host) {
    const state = readState();
    const context = JSON.stringify({ project: state.project, environment: state.project.environment, capabilities: browserCapabilities(), connected: connectorRows().filter((item) => item.connected).map((item) => item.id) }, null, 2);
    const copied = window.navigator?.clipboard?.writeText?.(context);
    if (copied?.then) copied.then(() => showToast(host, "Đã sao chép project context an toàn.")).catch(() => showToast(host, "Không thể truy cập clipboard; hãy dùng Xuất cấu hình DEV."));
    else showToast(host, "Clipboard không khả dụng trong trình duyệt này.");
  }

  function bindShell(host) {
    activeAbort?.abort();
    activeAbort = new AbortController();
    const { signal } = activeAbort;

    host.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-dev-route]");
      if (routeButton) {
        const route = routeButton.dataset.devRoute;
        if (route) location.hash = `#${route}`;
        return;
      }
      if (event.target.closest("[data-dev-edit-project]")) {
        openProjectDialog(host, true);
        return;
      }
      if (event.target.closest("[data-dev-close-project]")) {
        openProjectDialog(host, false);
        return;
      }
      if (event.target.closest("[data-dev-refresh-health]")) {
        refreshHealth(host);
        return;
      }
      const commandButton = event.target.closest("[data-dev-command]");
      if (commandButton) { openCommandPalette(host, true); return; }
      const commandRoute = event.target.closest("[data-dev-command-route]");
      if (commandRoute) { openCommandPalette(host, false); location.hash = `#${commandRoute.dataset.devCommandRoute}`; return; }
      const commandAction = event.target.closest("[data-dev-command-action]");
      if (commandAction) {
        openCommandPalette(host, false);
        if (commandAction.dataset.devCommandAction === "refresh-health") refreshHealth(host);
        if (commandAction.dataset.devCommandAction === "copy-context") copyDevContext(host);
        if (commandAction.dataset.devCommandAction === "export-config") { exportDevConfig(); showToast(host, "Đã xuất cấu hình DEV, không gồm secret."); }
        return;
      }
      const removeTask = event.target.closest("[data-dev-task-delete]");
      if (removeTask) {
        const state = readState();
        state.tasks = state.tasks.filter((task) => task.id !== removeTask.dataset.devTaskDelete);
        writeState(state, "Đã xóa một công việc");
        host.innerHTML = overviewMarkup();
        return;
      }
      if (event.target.closest("[data-dev-clear-activity]")) {
        const state = readState();
        state.activity = [];
        writeState(state);
        host.innerHTML = overviewMarkup();
      }
    }, { signal });

    host.addEventListener("change", (event) => {
      if (event.target.matches("[data-dev-theme]")) {
        const state = readState();
        state.preferences.theme = event.target.value;
        writeState(state, `Đổi theme thành ${THEMES.find(([id]) => id === event.target.value)?.[1] || event.target.value}`);
        applyPreferences(host, state);
        showToast(host, "Đã lưu theme DEV.");
      } else if (event.target.matches("[data-dev-effects]")) {
        const state = readState();
        state.preferences.effects = event.target.value;
        writeState(state, `Đổi hiệu ứng thành ${EFFECTS.find(([id]) => id === event.target.value)?.[1] || event.target.value}`);
        applyPreferences(host, state);
        showToast(host, "Đã lưu mức hiệu ứng.");
      } else if (event.target.matches("[data-dev-environment]")) {
        const state = readState();
        state.project.environment = event.target.value;
        writeState(state, `Chuyển môi trường sang ${event.target.value}`);
        host.querySelectorAll("[data-dev-environment]").forEach((select) => { select.value = event.target.value; });
        showToast(host, `Đã chuyển sang ${event.target.value}.`);
      } else if (event.target.matches("[data-dev-task-toggle]")) {
        const state = readState();
        const task = state.tasks.find((item) => item.id === event.target.dataset.devTaskToggle);
        if (task) task.done = event.target.checked;
        writeState(state, task?.done ? "Đã hoàn thành một công việc" : "Đã mở lại một công việc");
        host.innerHTML = overviewMarkup();
      }
    }, { signal });

    host.addEventListener("input", (event) => {
      if (!event.target.matches("[data-dev-command-input]")) return;
      const results = host.querySelector("[data-dev-command-results]");
      if (results) results.innerHTML = commandResultsMarkup(event.target.value);
    }, { signal });

    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openCommandPalette(host, true); }
      if (event.key === "Escape") openCommandPalette(host, false);
    }, { signal });
    document.addEventListener("visibilitychange", () => { host.querySelectorAll("[data-dev-galaxy]").forEach((node) => node.classList.toggle("is-tab-hidden", document.visibilityState === "hidden")); }, { signal });

    host.addEventListener("submit", (event) => {
      if (event.target.matches("[data-dev-project-form]")) {
        event.preventDefault();
        const data = new FormData(event.target);
        const state = readState();
        state.project.name = safeText(data.get("name"), 80) || state.project.name;
        state.project.repository = safeText(data.get("repository"), 160);
        state.project.branch = safeText(data.get("branch"), 100) || "main";
        state.project.framework = safeText(data.get("framework"), 100);
        writeState(state, "Đã cập nhật Universal Dev Project");
        const isOverview = Boolean(host.querySelector(".dev-galaxy-hero"));
        const planetRoot = host.querySelector(".dev-planet-view");
        if (isOverview) host.innerHTML = overviewMarkup();
        else if (planetRoot) {
          const planet = PLANET_BY_ID.get(location.hash.split("/")[2]);
          if (planet) host.innerHTML = planetMarkup(planet);
        } else {
          host.querySelectorAll(".dev-root-context strong").forEach((node, index) => { node.textContent = index === 0 ? state.project.name : state.project.branch; });
          openProjectDialog(host, false);
        }
        showToast(host, "Universal Dev Project đã được lưu.");
        return;
      }
      if (event.target.matches("[data-dev-task-form]")) {
        event.preventDefault();
        const input = event.target.elements.task;
        const text = safeText(input?.value, 180);
        if (!text) return;
        const state = readState();
        state.tasks.unshift({ id: `task-${Date.now().toString(36)}`, text, done: false, createdAt: nowIso() });
        writeState(state, `Đã thêm việc: ${text}`);
        host.innerHTML = overviewMarkup();
      }
    }, { signal });

    window.addEventListener("hh:dev-delivery-change", (event) => {
      runtimeDelivery = event.detail || null;
      if (host.querySelector(".dev-galaxy-hero")) host.innerHTML = overviewMarkup();
    }, { signal });
  }

  function mount(host, { toolId = "overview" } = {}) {
    if (!host) return false;
    cleanup();
    activeHost = host;

    if (!toolId || toolId === "overview") {
      host.innerHTML = overviewMarkup();
      bindShell(host);
      refreshHealth(host);
      return true;
    }

    const planet = PLANET_BY_ID.get(toolId);
    if (planet) {
      host.innerHTML = planetMarkup(planet);
      bindShell(host);
      return true;
    }

    const tool = findTool(toolId);
    const engine = findEngine(toolId);
    if (!tool || !engine) {
      host.innerHTML = `<section class="dev-pro-unavailable"><strong>Workspace chưa khởi động</strong><p>Engine ${escapeHtml(tool?.title || toolId)} chưa được tải. Hãy làm mới trang.</p><button type="button" data-app-route="/dev-tools">Về Developer Galaxy</button></section>`;
      return false;
    }

    rememberTool(toolId);
    host.innerHTML = toolShellMarkup(tool);
    bindShell(host);
    const engineHost = host.querySelector("[data-dev-engine-host]");
    activeEngine = engine;
    activeHost = engineHost;
    engine.mount(engineHost, { toolId });
    return true;
  }

  const supports = (toolId) => Boolean(PLANET_BY_ID.has(toolId) || (TOOL_BY_ID.has(toolId) && findEngine(toolId)));

  window.HHDevProSuite = {
    VERSION,
    STORAGE_KEY,
    mount,
    cleanup,
    supports,
    tools: () => WORKSPACES.map((tool) => ({ ...tool })),
    planets: () => PLANETS.map((planet) => ({ ...planet, tools: [...planet.tools], satellites: [...planet.satellites] })),
    project: () => readState().project
  };
  window.dispatchEvent(new CustomEvent("hh:dev-pro-suite-ready"));
})();
