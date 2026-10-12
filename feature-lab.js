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
    "global-search": "Tìm các workspace và liên kết điều hướng đã công bố; không đọc nội dung riêng của tool khác.",
    "command-palette": "Chạy route, thao tác nhanh và workflow bằng bàn phím.",
    "dark-light-auto": "Tự đổi giao diện theo hệ điều hành, lịch giờ hoặc thiết bị.",
    "theme-switcher": "Tạo, xem trước và hoàn tác bảng màu giao diện.",
    "realtime-notifications": "Tạo và quản lý thông báo trên thiết bị; Web Push cần dịch vụ được cấu hình riêng.",
    "loading-skeleton": "Kiểm thử skeleton cho từng vùng giao diện và đo thời gian hiển thị.",
    "page-progress": "Theo dõi sự kiện tiến trình được công bố; không suy đoán tiến độ tác vụ.",
    "fps-monitor": "Đo FPS, frame time, long task và độ ổn định trong 60 giây.",
    "voice-search": "Tìm kiếm bằng micro với transcript tạm thời và bước xác nhận.",
    "speech-to-text": "Chép lời trực tiếp khi trình duyệt hỗ trợ; tệp audio cần adapter máy chủ thực tế.",
    "text-to-speech": "Chọn giọng, ngôn ngữ, tốc độ và cao độ để đọc văn bản.",
    "ai-chat": "Hội thoại nhiều phiên qua AI Gateway có quota và khả năng hủy.",
    "prompt-library": "Thư viện prompt có thư mục, tag, phiên bản và xuất dữ liệu.",
    "prompt-optimizer": "Tối ưu prompt theo mục tiêu và so sánh trước/sau.",
    "image-prompt-generator": "Tạo prompt hình ảnh có phong cách, camera và negative prompt.",
    "workspace-tabs": "Mở nhiều tài liệu, ghim tab và khôi phục phiên làm việc.",
    "drag-drop-dashboard": "Kéo thả, đổi kích thước, hoàn tác và lưu bố cục dashboard.",
    "widget-marketplace": "Bộ widget cục bộ được duyệt: cài, mở, vô hiệu hóa và gỡ trên thiết bị này.",
    "plugin-system": "Kiểm tra manifest và chạy plugin cục bộ trong danh sách được duyệt; không thực thi mã tải lên.",
    "auto-save": "Lưu có debounce, retry và phục hồi bản nháp sau sự cố.",
    "version-history": "So sánh, gắn nhãn, tạo nhánh và khôi phục phiên bản.",
    "file-explorer": "Quản lý file bằng IndexedDB/OPFS với tìm kiếm và xuất dữ liệu.",
    "monaco-editor": "Editor văn bản và mã nguồn; Monaco nâng cao chỉ khả dụng khi runtime đã tải.",
    ocr: "Crop ảnh và nhận dạng chữ cục bộ bằng Tesseract Việt/Anh; sửa và xuất TXT, không tải ảnh lên máy chủ."
  });

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const slug = (value) => String(value || "").toLowerCase().replace(/\+\+/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const STORAGE_KEY = "hh.all-tools.catalog.v1";
  const runtimeLabels = Object.freeze({ browser: "Trình duyệt", server: "Máy chủ", ai: "AI", integration: "Kết nối", legacy: "Cục bộ" });
  let activeMount = null;
  const runtimes = new Map();
  const suiteOwners = new WeakMap();
  const GROUP_META = Object.freeze({
    Platform: { label: "Nền tảng", accent: "#67e8f9", icon: "⌘" },
    "AI & Workspace": { label: "AI & Không gian làm việc", accent: "#c4a3ff", icon: "✦" },
    Developer: { label: "Lập trình & Dữ liệu", accent: "#ffbb75", icon: "{}" },
    Productivity: { label: "Năng suất cá nhân", accent: "#6ee7b7", icon: "✓" },
    "System & UX": { label: "Hệ thống & Trải nghiệm", accent: "#ff8ece", icon: "◫" }
  });

  const readState = () => {
    try { return global.HHAllToolState?.readJSON(STORAGE_KEY, {}) || {}; }
    catch { return {}; }
  };
  const writeState = (state, owner) => global.HHAllToolState.writeJSON(STORAGE_KEY, state, owner);

  function manifestMap() {
    const manifests = [...(global.HHToolManifests?.TOOL_MANIFESTS || []),
      ...(global.HHPlatformTools?.manifests?.() || []),
      ...(global.HHToolWorkspace?.manifests || []),
      ...(global.HHUtilityTools?.manifests?.() || [])];
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
        runtime: found?.runtime === "hybrid" ? "browser" : found?.runtime || "browser",
        permissions: found?.permissions || [],
        capabilities: found?.capabilities || [],
        actions: found?.actions || ["run", "copy", "save", "export"],
        offline: found?.offline !== false,
        history: found?.history !== false,
        description: DESCRIPTIONS[id] || found?.description || `Workspace riêng cho ${name}; dữ liệu chỉ lưu trong bộ All Tool trên thiết bị này.`,
        accent: GROUP_META[group].accent,
        icon: GROUP_META[group].icon
      });
    }));
  }

  const getTool = (value) => {
    const key = slug(String(value || "global-search").replace(/^\/?tools\//, "").split("/").pop());
    const manifest = manifestMap().get(key);
    return buildCatalog().find((tool) => tool.id === key || slug(tool.name) === key || tool.id === manifest?.id || slug(tool.name) === slug(manifest?.name)) || null;
  };

  async function getRuntime() {
    if (!global.HHToolRuntime?.createRuntime) return null;
    const owner = global.HHAllToolState?.accountScope() || "guest";
    if (!runtimes.has(owner)) runtimes.set(owner, global.HHToolRuntime.createRuntime({ manifests: global.HHToolManifests?.TOOL_MANIFESTS || [], storageScope: owner }));
    return runtimes.get(owner);
  }

  function capabilityMarkup(tool) {
    const chips = [runtimeLabels[tool.runtime] || tool.runtime, tool.offline ? "Offline" : "Cần mạng", tool.history ? "Có lịch sử" : "Không lưu lịch sử"];
    return chips.map((chip, index) => `<span class="feature-lab__chip ${index === 0 ? "is-runtime" : ""}">${esc(chip)}</span>`).join("");
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

  async function renderWorkspace(work, tool, lifecycle) {
    const revision = ++lifecycle.revision;
    lifecycle.cleanup?.();
    lifecycle.cleanup = null;
    work.setAttribute("aria-busy", "true");
    work.innerHTML = `<section class="feature-tool-loading"><i></i><strong>Đang mở ${esc(tool.name)}...</strong></section>`;
    const runtime = await getRuntime().catch(() => null);
    if (lifecycle.disposed || revision !== lifecycle.revision) return;
    const suite = suiteFor(tool);
    try {
      if (suite?.mount || suite?.mountById || suite?.render) {
        work.innerHTML = "";
        const ownership = { work, revision };
        suiteOwners.set(suite, ownership);
        const suiteValue = suite.supports?.(tool.id) ? tool.id : tool.name;
        const mounted = suite.mount
          ? await suite.mount(work, { toolId: suiteValue, name: tool.name, manifest: tool, runtime })
          : suite.mountById
            ? await suite.mountById(work, tool.id, { manifest: tool, runtime })
            : await suite.render(work, tool.name, { manifest: tool, runtime });
        const ownedCleanup = typeof mounted === "function" ? mounted : mounted?.cleanup ? () => mounted.cleanup() : null;
        const cleanup = () => {
          if (ownedCleanup) ownedCleanup();
          else if (suiteOwners.get(suite) === ownership) suite.cleanup?.();
          if (suiteOwners.get(suite) === ownership) suiteOwners.delete(suite);
        };
        if (mounted?.ready) { try { await mounted.ready; } catch (error) { cleanup?.(); throw error; } }
        if (lifecycle.disposed || revision !== lifecycle.revision) { cleanup?.(); return; }
        if (!work.firstElementChild) throw new Error("Engine chưa trả về workspace; không có kết quả giả.");
        lifecycle.cleanup = cleanup;
      } else {
        throw new Error("Engine của công cụ chưa tải. Thử lại hoặc chọn công cụ khác.");
      }
    } catch (error) {
      if (lifecycle.disposed || revision !== lifecycle.revision) return;
      work.innerHTML = `<section class="feature-tool-error" role="alert"><strong>Không thể mở ${esc(tool.name)}</strong><p>${esc(error?.message || error)}</p><button type="button" data-lab-retry>Thử lại</button></section>`;
    } finally {
      if (!lifecycle.disposed && revision === lifecycle.revision) work.removeAttribute("aria-busy");
    }
  }

  function catalogMarkup(activeId) {
    const catalog = buildCatalog();
    return Object.keys(GROUPS).map((group) => {
      const items = catalog.filter((tool) => tool.group === group);
      return `<section class="feature-lab__group" data-lab-group="${esc(group)}">
        <h3 style="--lab-accent:${GROUP_META[group].accent}"><span>${esc(GROUP_META[group].label)}</span><b>${items.length}</b></h3>
        <div class="feature-lab__grid">${items.map((tool) => `<button class="feature-lab__item ${tool.id === activeId ? "active" : ""}" type="button" data-lab-feature="${esc(tool.id)}" data-lab-search-value="${esc(`${tool.name} ${tool.description} ${tool.runtime}`.toLowerCase())}" aria-current="${tool.id === activeId ? "page" : "false"}">
          <i aria-hidden="true">${esc(tool.icon)}</i><b>${esc(tool.name)}</b><span>${esc(runtimeLabels[tool.runtime] || "Cục bộ")}</span>
        </button>`).join("")}</div>
      </section>`;
    }).join("");
  }

  function showAccountChange(host) {
    host.innerHTML = '<section class="feature-tool-error" role="alert"><strong>Tài khoản đã thay đổi ở tab khác</strong><p>All Tool đã dừng tác vụ để tránh trộn dữ liệu. Tải lại trang để xác minh phiên trước khi tiếp tục.</p><button type="button" data-lab-reload>Tải lại và xác minh phiên</button></section>';
    host.querySelector("[data-lab-reload]").addEventListener("click", () => global.location.reload(), { once: true });
  }
  function mount(host, options = {}) {
    if (!host) return null;
    activeMount?.cleanup();
    if (global.HHAllToolState?.isAccountChanging()) { showAccountChange(host); return null; }
    const initialTool = getTool(options.toolId) || getTool("global-search");
    const owner = global.HHAllToolState?.accountScope() || "guest";
    const lifecycle = { revision: 0, disposed: false, cleanup: null, queue: Promise.resolve() };
    const saved = readState();
    const catalog = buildCatalog();
    const validIds = new Set(catalog.map(tool => tool.id));
    const cleanIds = values => Array.isArray(values) ? [...new Set(values.filter(id => validIds.has(id)))].slice(0, 86) : [];
    const preferences = { favorites: cleanIds(saved.favorites), pinned: cleanIds(saved.pinned), recent: cleanIds(saved.recent).slice(0, 12) };
    host.innerHTML = `<section class="feature-lab feature-lab--route" data-lab-route>
      <div class="feature-lab__panel">
        <header class="feature-lab__head">
          <div><small>ALL TOOL · COSMIC TOOLKIT</small><h2>${catalog.length} công cụ · workspace riêng</h2></div>
          <label class="feature-lab__search"><span aria-hidden="true">⌕</span><input type="search" data-lab-search aria-label="Tìm công cụ" placeholder="Tìm công cụ hoặc tác vụ…" autocomplete="off"></label>
          <button type="button" data-lab-toggle aria-controls="all-tool-catalog" aria-expanded="true">Danh mục</button>
          <button type="button" data-app-route="/platform">Trang chủ</button>
        </header>
        <div class="feature-lab__body">
          <nav class="feature-lab__catalog" id="all-tool-catalog" aria-label="Danh sách công cụ">
            <div class="feature-lab__filters"><label>Nhóm<select data-lab-group-filter><option value="all">Toàn bộ nhóm</option>${Object.entries(GROUP_META).map(([id, meta]) => `<option value="${esc(id)}">${esc(meta.label)}</option>`).join("")}</select></label><label>Bộ sưu tập<select data-lab-collection><option value="all">Tất cả</option><option value="favorites">Yêu thích</option><option value="pinned">Đã ghim</option><option value="recent">Gần đây</option></select></label></div>
            <p class="feature-lab__count" data-lab-count role="status"></p>
            <div data-lab-quick class="feature-lab__quick"></div>
            ${catalogMarkup(initialTool.id)}
            <p class="feature-lab__empty" data-lab-empty hidden>Không có công cụ phù hợp. Hãy đổi bộ lọc hoặc từ khóa.</p>
          </nav>
          <section class="feature-lab__studio"><div class="feature-lab__context"><div><span data-lab-context></span><p data-lab-description></p></div><div><button type="button" data-lab-favorite aria-pressed="false">☆ Yêu thích</button><button type="button" data-lab-pin aria-pressed="false">◇ Ghim</button></div></div><p class="feature-lab__notice" data-lab-notice role="status">Dữ liệu All Tool riêng trên thiết bị này; không tự đọc dữ liệu của workspace khác.</p><div class="feature-lab__work" data-lab-work tabindex="-1" aria-label="Workspace công cụ"></div></section>
        </div>
      </div>
    </section>`;

    const root = host.querySelector("[data-lab-route]");
    const work = root.querySelector("[data-lab-work]");
    let currentTool = initialTool;
    let appearanceTimer = 0;
    const colorMedia = global.matchMedia?.("(prefers-color-scheme: dark)");
    function refreshAppearance() {
      if (lifecycle.disposed || owner !== (global.HHAllToolState?.accountScope() || "guest")) return;
      const config = global.HHAllToolState?.readJSON("hh.all-tools.appearance.v1", null, owner);
      if (!config || typeof config !== "object" || Array.isArray(config)) return;
      let mode = config.mode;
      if (mode === "system") mode = colorMedia?.matches ? "dark" : "light";
      if (mode === "schedule") {
        const minutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
        const light = minutes(config.lightStart) ?? 360, dark = minutes(config.darkStart) ?? 1080;
        const now = new Date(), clock = now.getHours() * 60 + now.getMinutes();
        mode = (light < dark ? clock >= light && clock < dark : clock >= light || clock < dark) ? "light" : "dark";
      }
      if (!["dark", "light"].includes(mode)) mode = "dark";
      root.dataset.colorMode = mode;
      root.dataset.contrast = config.contrast === "high" ? "high" : "normal";
      root.style.colorScheme = mode;
      root.style.setProperty("--lab-accent", /^#[\da-f]{6}$/i.test(config.accent || "") ? config.accent : currentTool.accent);
      for (const studio of work.querySelectorAll(".pt-workspace,.ut-workspace,.hh-tool")) {
        studio.dataset.colorMode = mode; studio.dataset.contrast = root.dataset.contrast;
        if (/^#[\da-f]{6}$/i.test(config.accent || "")) {
          for (const key of ["--pt-cyan", "--ut-cyan", "--tw-accent"]) studio.style.setProperty(key, config.accent);
        } else for (const key of ["--pt-cyan", "--ut-cyan", "--tw-accent"]) studio.style.removeProperty(key);
        if (/^#[\da-f]{6}$/i.test(config.highlight || "")) for (const key of ["--pt-pink", "--ut-pink", "--tw-pink"]) studio.style.setProperty(key, config.highlight);
        else for (const key of ["--pt-pink", "--ut-pink", "--tw-pink"]) studio.style.removeProperty(key);
        const scale = Number(config.fontScale);
        studio.style.fontSize = Number.isFinite(scale) && scale >= 85 && scale <= 125 ? `${scale / 100}rem` : "";
      }
    }
    function syncAppearanceTimer() {
      clearInterval(appearanceTimer); appearanceTimer = 0;
      refreshAppearance();
      const config = global.HHAllToolState?.readJSON("hh.all-tools.appearance.v1", null, owner);
      if (!document.hidden && config?.mode === "schedule" && !lifecycle.disposed) appearanceTimer = setInterval(refreshAppearance, 30000);
    }
    const persist = () => {
      try { writeState(preferences, owner); }
      catch (error) { root.querySelector("[data-lab-notice]").textContent = `Chưa lưu được tùy chọn: ${error.message}`; }
    };
    const filter = () => {
      const query = root.querySelector("[data-lab-search]").value.trim().toLocaleLowerCase("vi");
      const group = root.querySelector("[data-lab-group-filter]").value;
      const collection = root.querySelector("[data-lab-collection]").value;
      let count = 0;
      root.querySelectorAll("[data-lab-feature]").forEach(button => {
        const tool = catalog.find(item => item.id === button.dataset.labFeature);
        button.hidden = !tool || (query && !button.dataset.labSearchValue.includes(query)) || (group !== "all" && tool.group !== group) || (collection !== "all" && !preferences[collection]?.includes(tool.id));
        if (!button.hidden) count++;
      });
      root.querySelectorAll("[data-lab-group]").forEach(groupNode => { groupNode.hidden = !groupNode.querySelector("[data-lab-feature]:not([hidden])"); });
      root.querySelector("[data-lab-count]").textContent = `${count} / ${catalog.length} công cụ`;
      root.querySelector("[data-lab-empty]").hidden = count !== 0;
      root.querySelector("[data-lab-quick]").innerHTML = preferences.pinned.slice(0, 6).map(id => `<button type="button" data-lab-open="${esc(id)}">◇ ${esc(catalog.find(item => item.id === id).name)}</button>`).join("");
      root.querySelector("[data-lab-favorite]").setAttribute("aria-pressed", String(preferences.favorites.includes(currentTool.id)));
      root.querySelector("[data-lab-pin]").setAttribute("aria-pressed", String(preferences.pinned.includes(currentTool.id)));
    };
    const toggleCatalog = expanded => {
      root.dataset.catalogCollapsed = String(!expanded);
      root.querySelector("[data-lab-toggle]").setAttribute("aria-expanded", String(expanded));
    };
    const render = () => {
      const tool = currentTool;
      lifecycle.revision++;
      lifecycle.queue = lifecycle.queue.catch(() => {}).then(() => {
        if (!lifecycle.disposed && currentTool.id === tool.id) return renderWorkspace(work, tool, lifecycle).then(refreshAppearance);
      });
      return lifecycle.queue;
    };
    const select = (value, navigate = false) => {
      const next = getTool(value);
      if (!next) { root.querySelector("[data-lab-notice]").textContent = "Đường dẫn tool không hợp lệ; hãy chọn từ danh mục."; return; }
      if (navigate && typeof options.onNavigate === "function" && next.id !== currentTool.id) {
        options.onNavigate(next.id);
        return;
      }
      currentTool = next;
      root.dataset.activeTool = next.id;
      root.style.setProperty("--lab-accent", next.accent);
      root.querySelector("[data-lab-context]").textContent = `${GROUP_META[next.group].label} / ${next.name}`;
      root.querySelector("[data-lab-description]").textContent = next.description.startsWith("Workspace riêng cho") ? "" : next.description;
      preferences.recent = [next.id, ...preferences.recent.filter(id => id !== next.id)].slice(0, 12);
      persist(); filter();
      root.querySelectorAll("[data-lab-feature]").forEach((button) => {
        const selected = button.dataset.labFeature === next.id;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-current", selected ? "page" : "false");
      });
      render();
      if (global.matchMedia?.("(max-width: 760px)").matches) toggleCatalog(false);
    };

    const onClick = (event) => {
      const feature = event.target.closest("[data-lab-feature]");
      if (feature) { event.preventDefault(); select(feature.dataset.labFeature, true); return; }
      const quick = event.target.closest("[data-lab-open]");
      if (quick) { select(quick.dataset.labOpen, true); return; }
      if (event.target.closest("[data-lab-retry]")) { render(); return; }
      if (event.target.closest("[data-lab-toggle]")) { toggleCatalog(root.dataset.catalogCollapsed === "true"); return; }
      for (const [selector, collection] of [["[data-lab-favorite]", "favorites"], ["[data-lab-pin]", "pinned"]]) {
        if (!event.target.closest(selector)) continue;
        const ids = preferences[collection];
        preferences[collection] = ids.includes(currentTool.id) ? ids.filter(id => id !== currentTool.id) : [...ids, currentTool.id];
        persist(); filter();
      }
    };
    const onInput = (event) => {
      if (!event.target.matches("[data-lab-search]")) return;
      toggleCatalog(true); filter();
    };
    const onChange = event => { if (event.target.matches("[data-lab-group-filter],[data-lab-collection]")) filter(); };
    const onKey = event => {
      if (!event.target.matches("[data-lab-feature]")) return;
      const buttons = [...root.querySelectorAll("[data-lab-feature]:not([hidden])")];
      const index = buttons.indexOf(event.target);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : ["ArrowDown", "ArrowRight"].includes(event.key) ? (index + 1) % buttons.length : ["ArrowUp", "ArrowLeft"].includes(event.key) ? (index - 1 + buttons.length) % buttons.length : -1;
      if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
    };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("keydown", onKey);
    global.addEventListener("hh:alltools-appearance-change", syncAppearanceTimer);
    document.addEventListener("visibilitychange", syncAppearanceTimer);
    colorMedia?.addEventListener?.("change", refreshAppearance);
    syncAppearanceTimer();
    select(initialTool.id);
    if (options.toolId && !getTool(options.toolId)) root.querySelector("[data-lab-notice]").textContent = "Tool trong đường dẫn không tồn tại. Danh mục vẫn có thể sử dụng.";
    const observer = typeof MutationObserver === "function" ? new MutationObserver(() => { if (!host.isConnected) instance.cleanup(); }) : null;
    const onAuth = () => { instance.cleanup(); if (host.isConnected) mount(host, { ...options, toolId: currentTool.id }); };
    const onExternalAccount = () => {
      instance.cleanup();
      if (!host.isConnected) return;
      showAccountChange(host);
    };
    const instance = { root, select, ready: () => lifecycle.queue, cleanup: () => {
      if (lifecycle.disposed) return;
      lifecycle.disposed = true; lifecycle.revision++; lifecycle.cleanup?.(); lifecycle.cleanup = null;
      clearInterval(appearanceTimer); global.removeEventListener("hh:alltools-appearance-change", syncAppearanceTimer); document.removeEventListener("visibilitychange", syncAppearanceTimer); colorMedia?.removeEventListener?.("change", refreshAppearance);
      observer?.disconnect(); global.removeEventListener("hh:auth-change", onAuth);
      global.removeEventListener("hh:alltools-account-change", onExternalAccount);
      root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKey);
      root.remove(); if (activeMount === instance) activeMount = null;
    } };
    observer?.observe(document.body, { childList: true, subtree: true });
    global.addEventListener("hh:auth-change", onAuth);
    global.addEventListener("hh:alltools-account-change", onExternalAccount);
    activeMount = instance;
    return instance;
  }

  function open(value) {
    const tool = getTool(value) || getTool("global-search");
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
    select: (value, navigate = true) => activeMount?.select(value, navigate),
    ready: () => activeMount?.ready() || Promise.resolve(),
    activeHost: () => activeMount?.root || null,
    open,
    cleanup: () => activeMount?.cleanup(),
    close: () => { activeMount?.cleanup(); if (location.hash.startsWith("#/tools")) location.hash = "#/platform"; }
  });
})(window);
