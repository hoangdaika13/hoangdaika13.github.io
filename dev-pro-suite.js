(() => {
  "use strict";

  const ENGINE_SOURCES = [
    { name: "HHDevSmartRecipe", tools: ["smart-input", "developer-recipe"] },
    { name: "HHDevApiStudio", tools: ["api-studio", "mock-api"] },
    { name: "HHDevDataSecurity", tools: ["json-data-lab", "security-encoding"] },
    { name: "HHDevRegexDatabase", tools: ["regex-studio", "database-playground"] },
    { name: "HHDevCodeGit", tools: ["code-playground", "git-diff-studio"] },
    { name: "HHDevDiagnosticsAI", tools: ["web-diagnostics", "ai-developer"] }
  ];
  const TOOLS = [
    { id: "smart-input", icon: "SI", group: "Khởi động", title: "Smart Input", description: "Nhận diện dữ liệu và chuyển thẳng tới đúng công cụ.", caps: ["Auto detect", "Clipboard", "File drop"] },
    { id: "developer-recipe", icon: "DR", group: "Khởi động", title: "Developer Recipe", description: "Ghép nhiều phép biến đổi thành pipeline có breakpoint.", caps: ["Pipeline", "Auto run", "Share"] },
    { id: "api-studio", icon: "AP", group: "API & Realtime", title: "API Studio Pro", description: "REST, GraphQL, WebSocket và SSE trong một workspace.", caps: ["Collections", "Auth", "Assertions"] },
    { id: "mock-api", icon: "MK", group: "API & Realtime", title: "Mock Server & Testing", description: "Mô phỏng OpenAPI, lỗi, độ trễ và chạy bộ kiểm thử.", caps: ["OpenAPI", "Runner", "Snippets"] },
    { id: "json-data-lab", icon: "JS", group: "Dữ liệu & Bảo mật", title: "JSON & Data Lab", description: "Tree, bảng, diff, query, schema và chuyển đổi dữ liệu.", caps: ["Tree", "Schema", "Convert"] },
    { id: "security-encoding", icon: "SE", group: "Dữ liệu & Bảo mật", title: "Security & Encoding", description: "JWT, hash, AES/RSA, PEM, CSP và quét secret cục bộ.", caps: ["Web Crypto", "Scanner", "Local"] },
    { id: "regex-studio", icon: "RX", group: "Phân tích", title: "Regex Studio", description: "Highlight, capture, replace, test case và giải thích tiếng Việt.", caps: ["Realtime", "Tests", "Explain"] },
    { id: "database-playground", icon: "DB", group: "Phân tích", title: "Database Playground", description: "SQL, schema, dữ liệu CSV/JSON và Mongo query builder.", caps: ["SQL", "Schema", "Import"] },
    { id: "code-playground", icon: "CP", group: "Code & Git", title: "Code Playground", description: "Multi-file editor, preview sandbox, console và live reload.", caps: ["HTML/CSS/JS", "Sandbox", "Project"] },
    { id: "git-diff-studio", icon: "GD", group: "Code & Git", title: "Git & Diff Studio", description: "Diff, merge, commit, changelog và workflow CI/CD.", caps: ["3-way merge", "Generator", "YAML"] },
    { id: "web-diagnostics", icon: "WD", group: "Quan sát & AI", title: "Web Diagnostics", description: "Hiệu suất, header, CORS, CSP, bundle và error timeline.", caps: ["Vitals", "Network", "Audit"] },
    { id: "ai-developer", icon: "AI", group: "Quan sát & AI", title: "AI Developer Assistant", description: "Giải thích, tạo test, review diff và chỉ áp dụng sau khi duyệt.", caps: ["Preview first", "Redaction", "Server AI"] }
  ];
  const GROUP_COLORS = {
    "Khởi động": "#62e7f0",
    "API & Realtime": "#8d85ff",
    "Dữ liệu & Bảo mật": "#ff68c8",
    "Phân tích": "#ffd166",
    "Code & Git": "#70e5aa",
    "Quan sát & AI": "#ff8a67"
  };
  let activeEngine = null;
  let activeHost = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const findTool = (id) => TOOLS.find((tool) => tool.id === id);
  const engines = () => ENGINE_SOURCES.map((source) => ({ ...source, api: window[source.name] })).filter((entry) => entry.api);
  const findEngine = (toolId) => engines().find((entry) => entry.api?.supports?.(toolId) || entry.tools.includes(toolId))?.api;
  const supports = (toolId) => Boolean(findTool(toolId) && findEngine(toolId));
  const cleanup = () => {
    if (activeEngine?.cleanup) activeEngine.cleanup(activeHost);
    else activeEngine?.unmount?.(activeHost);
    activeEngine = null;
    activeHost = null;
  };

  function capabilityMarkup() {
    const capabilities = [
      ["Web Crypto", Boolean(window.crypto?.subtle)],
      ["WebSocket", "WebSocket" in window],
      ["Worker", "Worker" in window],
      ["IndexedDB", "indexedDB" in window]
    ];
    return capabilities.map(([label, ready]) => `<span class="${ready ? "is-ready" : "is-limited"}"><i></i>${label}<b>${ready ? "READY" : "LIMITED"}</b></span>`).join("");
  }

  function overviewMarkup() {
    const groups = [...new Set(TOOLS.map((tool) => tool.group))];
    return `<section class="dev-pro-home" data-dev-pro-home>
      <header class="dev-pro-hero">
        <div><span class="dev-pro-kicker">HH DEVELOPER OS · 12 WORKSPACES</span><h2>Phân tích, thử nghiệm và xây dựng trong một nơi.</h2><p>Dữ liệu đi qua một luồng thống nhất: nhận diện, biến đổi, kiểm thử, quan sát và chỉ áp dụng thay đổi sau khi bạn duyệt.</p><div class="dev-pro-hero-actions"><button type="button" data-dev-pro-open="smart-input">Dán dữ liệu thông minh</button><button type="button" data-dev-pro-open="api-studio">Mở API Studio</button></div></div>
        <div class="dev-pro-orbit" aria-hidden="true"><i></i><i></i><i></i><strong>DEV</strong><span>LOCAL FIRST</span></div>
      </header>
      <div class="dev-pro-capabilities" aria-label="Khả năng trình duyệt">${capabilityMarkup()}</div>
      <nav class="dev-pro-jump" aria-label="Nhóm workspace">${groups.map((group) => `<button type="button" data-dev-pro-jump="${escapeHtml(group)}"><i style="--group:${GROUP_COLORS[group]}"></i>${escapeHtml(group)}<b>${TOOLS.filter((tool) => tool.group === group).length}</b></button>`).join("")}</nav>
      <div class="dev-pro-groups">${groups.map((group) => `<section data-dev-pro-group="${escapeHtml(group)}" style="--group:${GROUP_COLORS[group]}"><header><div><span>${escapeHtml(group)}</span><h3>${group === "Khởi động" ? "Bắt đầu từ bất kỳ dữ liệu nào" : escapeHtml(group)}</h3></div><b>${String(TOOLS.filter((tool) => tool.group === group).length).padStart(2, "0")}</b></header><div>${TOOLS.filter((tool) => tool.group === group).map((tool) => `<button type="button" data-dev-pro-open="${tool.id}"><i>${tool.icon}</i><span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.description)}</small><em>${tool.caps.map(escapeHtml).join(" · ")}</em></span><b aria-hidden="true">↗</b></button>`).join("")}</div></section>`).join("")}</div>
      <footer class="dev-pro-privacy"><strong>Dữ liệu nhạy cảm ở lại trên thiết bị</strong><span>Công cụ mạng chỉ gửi request tới địa chỉ bạn chọn. Secret không được đưa vào URL hoặc file export mặc định.</span></footer>
    </section>`;
  }

  function bindOverview(host) {
    host.addEventListener("click", (event) => {
      const open = event.target.closest("[data-dev-pro-open]");
      if (open) location.hash = `#/dev-tools/${open.dataset.devProOpen}`;
      const jump = event.target.closest("[data-dev-pro-jump]");
      if (jump) host.querySelector(`[data-dev-pro-group="${CSS.escape(jump.dataset.devProJump)}"]`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  }

  function mount(host, { toolId = "overview" } = {}) {
    if (!host) return false;
    cleanup();
    if (!toolId || toolId === "overview") {
      host.innerHTML = overviewMarkup();
      bindOverview(host);
      return true;
    }
    const engine = findEngine(toolId);
    if (!engine) {
      host.innerHTML = `<section class="dev-pro-unavailable"><strong>Workspace chưa khởi động</strong><p>Engine ${escapeHtml(findTool(toolId)?.title || toolId)} chưa được tải. Hãy làm mới trang.</p><button type="button" data-app-route="/dev-tools">Về DEV Command Center</button></section>`;
      return false;
    }
    activeEngine = engine;
    activeHost = host;
    engine.mount(host, { toolId });
    return true;
  }

  window.HHDevProSuite = { mount, cleanup, supports, tools: () => TOOLS.map((tool) => ({ ...tool })) };
  dispatchEvent(new CustomEvent("hh:dev-pro-suite-ready"));
})();
