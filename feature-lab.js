(function initHHFeatureLab(global) {
  "use strict";

  const GROUPS = Object.freeze({
    Platform: [
      "Global Search", "Command Palette++", "Dark Light Auto Mode", "Theme Color Switcher",
      "Realtime Notification", "Loading Skeleton", "Page Progress Bar", "AI Chat Assistant",
      "Voice Search", "Speech To Text", "Text To Speech", "History Manager", "Favorite Manager",
      "Export Data", "Import Data", "PWA", "Offline Mode", "Install App",
      "Keyboard Shortcut System", "Settings Center"
    ],
    "AI & Workspace": [
      "AI Prompt Library", "AI Prompt Optimizer", "Workspace Tabs", "Drag Drop Dashboard",
      "Widget Marketplace", "Plugin System", "User Preferences Center", "Auto Save",
      "Version History", "File Explorer", "Monaco Code Editor", "AI Image Prompt Generator", "OCR"
    ],
    Developer: [
      "Markdown Editor", "JSON Viewer", "API Tester", "Regex Playground", "Code Viewer",
      "Terminal Simulator", "Git Cheat Sheet", "GitHub Integration", "Console Log Viewer",
      "Error Monitor", "Dev Utilities", "Text Compare", "JSON Formatter", "UUID Generator",
      "Hash Generator", "Base64 Encoder", "Timestamp Converter"
    ],
    Productivity: [
      "Productivity Dashboard", "Notes", "Todo", "Kanban", "Pomodoro", "Stopwatch",
      "Countdown", "Calendar", "Reminder", "Calculator", "Unit Converter", "Lorem Ipsum",
      "Password Toolkit", "Clipboard Manager", "Clipboard History", "Activity Timeline",
      "Recent Files", "Pinned Tools", "Bookmark", "Floating Quick Actions", "Focus Mode"
    ],
    "System & UX": [
      "Multi-language", "Language Switcher", "Weather Widget", "Clock", "System Status",
      "Network Speed", "FPS Monitor", "Memory Usage", "Storage Usage", "Analytics Dashboard",
      "Notification Center", "Smart Search", "Context Menu", "Floating Toolbar", "QR Scanner"
    ]
  });

  const DESCRIPTIONS = Object.freeze({
    "global-search": "Tìm module, dự án, file, tin nhắn, lịch sử và lệnh trong toàn bộ HH Platform.",
    "command-palette": "Chạy route, thao tác nhanh và workflow bằng bàn phím.",
    "dark-light-auto": "Tự đổi giao diện theo hệ điều hành, lịch giờ hoặc thiết bị.",
    "theme-switcher": "Tạo, xem trước và hoàn tác bảng màu giao diện.",
    "realtime-notifications": "Quản lý quyền, mức ưu tiên và trung tâm thông báo.",
    "loading-skeleton": "Kiểm thử skeleton cho từng vùng giao diện và đo thời gian hiển thị.",
    "page-progress": "Theo dõi tiến trình route, upload, render và tác vụ API.",
    "fps-monitor": "Đo FPS, frame time, long task và độ ổn định trong 60 giây.",
    "voice-search": "Tìm kiếm bằng micro với transcript tạm thời và bước xác nhận.",
    "speech-to-text": "Ghi hoặc tải audio, nhận dạng lời nói và xuất transcript.",
    "text-to-speech": "Chọn giọng, ngôn ngữ, tốc độ và cao độ để đọc văn bản.",
    "ai-chat": "Hội thoại nhiều phiên qua AI Gateway có quota và khả năng hủy.",
    "prompt-library": "Thư viện prompt có thư mục, tag, phiên bản và xuất dữ liệu.",
    "prompt-optimizer": "Tối ưu prompt theo mục tiêu và so sánh trước/sau.",
    "image-prompt-generator": "Tạo prompt hình ảnh có phong cách, camera và negative prompt.",
    "workspace-tabs": "Mở nhiều tài liệu, ghim tab và khôi phục phiên làm việc.",
    "drag-drop-dashboard": "Kéo thả, đổi kích thước, hoàn tác và lưu bố cục dashboard.",
    "widget-marketplace": "Cài, vô hiệu hóa và quản lý quyền của widget.",
    "plugin-system": "Kiểm tra manifest, quyền và trạng thái plugin trong sandbox.",
    "auto-save": "Lưu có debounce, retry và phục hồi bản nháp sau sự cố.",
    "version-history": "So sánh, gắn nhãn, tạo nhánh và khôi phục phiên bản.",
    "file-explorer": "Quản lý file bằng IndexedDB/OPFS với tìm kiếm và xuất dữ liệu.",
    "monaco-editor": "Editor nhiều file, diff, format, diagnostics và autosave.",
    ocr: "Nhận dạng văn bản từ ảnh/PDF, sửa kết quả và xuất dữ liệu."
  });

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const slug = (value) => String(value || "").toLowerCase().replace(/\+\+/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const STORAGE_KEY = "hh.feature-lab.workspace.v2";
  const runtimeLabels = Object.freeze({ browser: "Trình duyệt", server: "Máy chủ", ai: "AI", integration: "Kết nối", legacy: "Cục bộ" });
  let activeCleanup = null;
  let runtimePromise = null;

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  };
  const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  function manifestMap() {
    const manifests = global.HHToolManifests?.TOOL_MANIFESTS || [];
    return new Map(manifests.flatMap((item) => [[item.id, item], [slug(item.name), item]]));
  }

  function buildCatalog() {
    const manifests = manifestMap();
    return Object.entries(GROUPS).flatMap(([group, names]) => names.map((name) => {
      const found = manifests.get(slug(name));
      const id = found?.id || slug(name);
      return Object.freeze({
        id,
        name,
        group,
        runtime: found?.runtime || "legacy",
        permissions: found?.permissions || [],
        capabilities: found?.capabilities || [],
        actions: found?.actions || ["run", "copy", "save", "export"],
        offline: found?.offline !== false,
        history: found?.history !== false,
        description: found?.description || DESCRIPTIONS[id] || `Workspace chuyên dụng cho ${name}.`
      });
    }));
  }

  const getTool = (value) => {
    const key = slug(value || "global-search");
    return buildCatalog().find((tool) => tool.id === key || slug(tool.name) === key) || buildCatalog()[0];
  };

  async function getRuntime() {
    if (!global.HHToolRuntime?.createRuntime) return null;
    if (!runtimePromise) runtimePromise = global.HHToolRuntime.createRuntime({ manifests: global.HHToolManifests?.TOOL_MANIFESTS || [] });
    return runtimePromise;
  }

  function capabilityMarkup(tool) {
    const chips = [runtimeLabels[tool.runtime] || tool.runtime, tool.offline ? "Offline" : "Cần mạng", tool.history ? "Có lịch sử" : "Không lưu lịch sử"];
    return chips.map((chip, index) => `<span class="feature-lab__chip ${index === 0 ? "is-runtime" : ""}">${esc(chip)}</span>`).join("");
  }

  function legacyWorkspace(tool) {
    const saved = readState()[tool.id] || {};
    return `<section class="feature-generic-workspace" data-tool-workspace="${esc(tool.id)}">
      <header class="feature-tool-head">
        <div><small>TOOL WORKSPACE</small><h3 data-lab-title>${esc(tool.name)}</h3><p>${esc(tool.description)}</p></div>
        <div class="feature-lab__chips">${capabilityMarkup(tool)}</div>
      </header>
      <label class="feature-tool-field"><span>Dữ liệu đầu vào</span><textarea data-lab-input placeholder="Nhập dữ liệu phù hợp với công cụ...">${esc(saved.input || "")}</textarea></label>
      <div class="feature-lab__actions">
        <button type="button" data-lab-run>Chạy công cụ</button>
        <button type="button" data-lab-copy>Sao chép</button>
        <button type="button" data-lab-save>Lưu phiên</button>
        <button type="button" data-lab-export>Xuất kết quả</button>
      </div>
      <section class="feature-tool-result"><header><strong>Kết quả</strong><span data-lab-state>Chưa chạy</span></header><pre data-lab-output>${esc(saved.output || "Sẵn sàng.")}</pre></section>
    </section>`;
  }

  function suiteFor(tool) {
    const candidates = [
      global.HHPlatformTools,
      global.HHPlatformToolSuite,
      global.HHAIWorkspaceTools,
      global.HHVoiceAIWorkspaceTools,
      global.HHWorkspaceTools,
      global.HHToolWorkspace,
      global.HHUtilityTools
    ].filter(Boolean);
    return candidates.find((suite) => suite.supports?.(tool.id) || suite.supports?.(tool.name) || suite.has?.(tool.id));
  }

  async function renderWorkspace(work, tool) {
    activeCleanup?.();
    activeCleanup = null;
    work.setAttribute("aria-busy", "true");
    work.innerHTML = `<section class="feature-tool-loading"><i></i><strong>Đang mở ${esc(tool.name)}...</strong></section>`;
    const runtime = await getRuntime().catch(() => null);
    const suite = suiteFor(tool);
    try {
      if (suite?.mount || suite?.mountById || suite?.render) {
        work.innerHTML = "";
        const suiteValue = suite.supports?.(tool.id) ? tool.id : tool.name;
        const mounted = suite.mount
          ? await suite.mount(work, { toolId: suiteValue, name: tool.name, manifest: tool, runtime })
          : suite.mountById
            ? await suite.mountById(work, tool.id, { manifest: tool, runtime })
            : await suite.render(work, tool.name, { manifest: tool, runtime });
        activeCleanup = typeof mounted === "function" ? mounted : mounted?.cleanup || null;
        if (!activeCleanup && suite.cleanup) activeCleanup = () => suite.cleanup();
      } else if (global.HHMediaDesign?.supports?.(tool.name)) {
        global.HHMediaDesign.render(work, tool.name);
        activeCleanup = () => global.HHMediaDesign?.cleanup?.();
      } else {
        work.innerHTML = legacyWorkspace(tool);
      }
    } catch (error) {
      work.innerHTML = `<section class="feature-tool-error" role="alert"><strong>Không thể mở ${esc(tool.name)}</strong><p>${esc(error?.message || error)}</p><button type="button" data-lab-retry>Thử lại</button></section>`;
    } finally {
      work.removeAttribute("aria-busy");
    }
  }

  function catalogMarkup(activeId) {
    const catalog = buildCatalog();
    return Object.keys(GROUPS).map((group) => {
      const items = catalog.filter((tool) => tool.group === group);
      return `<section class="feature-lab__group" data-lab-group="${esc(group)}">
        <h3><span>${esc(group)}</span><b>${items.length}</b></h3>
        <div class="feature-lab__grid">${items.map((tool) => `<button class="feature-lab__item ${tool.id === activeId ? "active" : ""}" type="button" data-lab-feature="${esc(tool.id)}" data-lab-search-value="${esc(`${tool.name} ${tool.description} ${tool.runtime}`.toLowerCase())}" aria-current="${tool.id === activeId ? "page" : "false"}">
          <b>${esc(tool.name)}</b><span>${esc(runtimeLabels[tool.runtime] || "Cục bộ")}</span>
        </button>`).join("")}</div>
      </section>`;
    }).join("");
  }

  function mount(host, options = {}) {
    if (!host) return null;
    const initialTool = getTool(options.toolId);
    activeCleanup?.();
    host.innerHTML = `<section class="feature-lab feature-lab--route" data-lab-route>
      <div class="feature-lab__panel">
        <header class="feature-lab__head">
          <div><small>HH PROFESSIONAL TOOLKIT</small><h2>${buildCatalog().length} công cụ thực tế</h2></div>
          <label class="feature-lab__search"><span aria-hidden="true">⌕</span><input type="search" data-lab-search placeholder="Tìm công cụ, chức năng hoặc runtime..." autocomplete="off"></label>
          <button type="button" data-app-route="/home">Trang chủ</button>
        </header>
        <div class="feature-lab__body">
          <nav class="feature-lab__catalog" aria-label="Danh sách công cụ">${catalogMarkup(initialTool.id)}</nav>
          <main class="feature-lab__work" data-lab-work tabindex="-1"></main>
        </div>
      </div>
    </section>`;

    const root = host.querySelector("[data-lab-route]");
    const work = root.querySelector("[data-lab-work]");
    let currentTool = initialTool;
    const select = (value, navigate = false) => {
      const next = getTool(value);
      currentTool = next;
      if (navigate && typeof options.onNavigate === "function" && next.id !== initialTool.id) {
        options.onNavigate(next.id);
        return;
      }
      root.querySelectorAll("[data-lab-feature]").forEach((button) => {
        const selected = button.dataset.labFeature === next.id;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-current", selected ? "page" : "false");
      });
      renderWorkspace(work, next);
      root.querySelector(`[data-lab-feature="${global.CSS?.escape ? CSS.escape(next.id) : next.id}"]`)?.scrollIntoView({ block: "nearest" });
    };

    root.addEventListener("click", (event) => {
      const feature = event.target.closest("[data-lab-feature]");
      if (feature) { event.preventDefault(); select(feature.dataset.labFeature, true); return; }
      if (event.target.closest("[data-lab-retry]")) { renderWorkspace(work, currentTool); return; }
      const output = work.querySelector("[data-lab-output]");
      const input = work.querySelector("[data-lab-input]");
      if (event.target.closest("[data-lab-copy]")) navigator.clipboard?.writeText(output?.textContent || "");
      if (event.target.closest("[data-lab-save]")) {
        const state = readState();
        state[currentTool.id] = { input: input?.value || "", output: output?.textContent || "", updatedAt: new Date().toISOString() };
        writeState(state);
        work.querySelector("[data-lab-state]")?.replaceChildren(document.createTextNode("Đã lưu"));
      }
      if (event.target.closest("[data-lab-export]")) {
        const blob = new Blob([output?.textContent || ""], { type: "text/plain;charset=utf-8" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${currentTool.id}.txt`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      }
    });
    root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-lab-search]")) return;
      const query = event.target.value.trim().toLowerCase();
      root.querySelectorAll("[data-lab-feature]").forEach((button) => {
        button.hidden = Boolean(query) && !button.dataset.labSearchValue.includes(query);
      });
      root.querySelectorAll("[data-lab-group]").forEach((group) => {
        group.hidden = !group.querySelector("[data-lab-feature]:not([hidden])");
      });
    });
    select(initialTool.id);
    return { root, select, cleanup: () => { activeCleanup?.(); activeCleanup = null; host.innerHTML = ""; } };
  }

  function open(value) {
    const tool = getTool(value);
    global.location.hash = `#/tools/${tool.id}`;
  }

  if (!document.querySelector(".feature-lab-open")) {
    const button = document.createElement("button");
    button.className = "feature-lab-open";
    button.type = "button";
    button.title = "Mở toàn bộ công cụ";
    button.textContent = "ALL TOOLS";
    button.addEventListener("click", () => open("global-search"));
    document.body.append(button);
  }

  global.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open("global-search");
    }
  });

  global.HHFeatureLab = Object.freeze({
    groups: GROUPS,
    catalog: buildCatalog,
    getTool,
    mount,
    open,
    close: () => { if (location.hash.startsWith("#/tools")) location.hash = "#/home"; }
  });
})(window);
