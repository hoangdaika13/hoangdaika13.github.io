(() => {
  "use strict";

  if (window.HHCreativeOS) return;

  const VIEWS = Object.freeze([
    { id: "overview", group: "Điều hành", icon: "CC", title: "Creative Command Center", description: "Dự án, deadline, chi phí, lịch và tiến độ" },
    { id: "project", group: "Điều hành", icon: "UP", title: "Universal Project", description: "Brief, prompt, script, media và phiên bản dùng chung" },
    { id: "ai-center", group: "AI & Kịch bản", icon: "AI", title: "AI Center", description: "Chat, prompt, phân tích và workflow AI" },
    { id: "ai-script", group: "AI & Kịch bản", icon: "KS", title: "Kịch bản AI", description: "Viết, phân tích, dịch, batch và quản lý series" },
    { id: "brief", group: "Tiền kỳ", icon: "BR", title: "Creative Brief", description: "Mục tiêu, đối tượng và kế hoạch nội dung" },
    { id: "moodboard", group: "Tiền kỳ", icon: "MB", title: "Moodboard", description: "Concept board kéo thả đa phương tiện" },
    { id: "storyboard", group: "Tiền kỳ", icon: "SB", title: "Storyboard", description: "Cảnh, shot, thoại và animatic" },
    { id: "world-bible", group: "Tiền kỳ", icon: "WB", title: "World Bible", description: "Nhân vật, địa điểm và tính nhất quán" },
    { id: "creator-studio", group: "Sản xuất nội dung", icon: "CS", title: "Creator Studio", description: "Gói nội dung đa nền tảng và nghiên cứu xu hướng" },
    { id: "media-center", group: "Sản xuất nội dung", icon: "MC", title: "Media Center", description: "Thư viện, Google và YouTube discovery" },
    { id: "workflow", group: "AI & Workflow", icon: "WF", title: "Creative Workflow", description: "Pipeline node, cache và approval gate" },
    { id: "ai-director", group: "AI & Workflow", icon: "AD", title: "AI Director", description: "Đề xuất quy trình có bước duyệt" },
    { id: "prompt-studio", group: "AI & Workflow", icon: "MP", title: "Multimodal Prompt", description: "Reference, camera, seed và lineage" },
    { id: "ai-automation", group: "AI & Workflow", icon: "AU", title: "AI Automation", description: "Pipeline sản xuất, preset và lịch sử chạy" },
    { id: "repurpose", group: "Sản xuất chuyên sâu", icon: "RE", title: "Repurpose Engine", description: "Một nội dung thành nhiều định dạng" },
    { id: "brand", group: "Sản xuất chuyên sâu", icon: "BI", title: "Brand Intelligence", description: "Brand voice, quy tắc và kiểm tra" },
    { id: "audio-dubbing", group: "Sản xuất chuyên sâu", icon: "DB", title: "Audio & Dubbing", description: "Voice, nhạc, SFX và subtitle" },
    { id: "prototype", group: "Sản xuất chuyên sâu", icon: "PT", title: "Prototype from Prompt", description: "Flow tương tác chỉnh sửa được" },
    { id: "review", group: "Cộng tác", icon: "RV", title: "Creative Review", description: "Comment, diff và phê duyệt" },
    { id: "collaboration", group: "Cộng tác", icon: "RT", title: "Realtime Collaboration", description: "Presence, chat, lock và timeline diff" },
    { id: "publishing", group: "Xuất bản", icon: "PB", title: "Publishing Calendar", description: "Lịch đa nền tảng và hàng đợi" },
    { id: "analytics", group: "Xuất bản", icon: "AN", title: "Creative Analytics", description: "CTR, retention và A/B test" },
    { id: "rights", group: "Xuất bản", icon: "RC", title: "Rights & Provenance", description: "Nguồn, giấy phép và manifest" },
    { id: "providers", group: "Xuất bản", icon: "PR", title: "Provider Router", description: "Quota, chi phí, độ trễ và cooldown" },
    { id: "marketplace", group: "Mở rộng", icon: "MK", title: "Creative Marketplace", description: "Template, workflow và asset pack" }
  ]);

  const ENGINES = Object.freeze({
    overview: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    project: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    "ai-center": { api: "HHCreativeLegacyTools" },
    "ai-script": { api: "HHCreativeLegacyTools" },
    brief: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    moodboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    storyboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    "world-bible": { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    "creator-studio": { api: "HHCreativeLegacyTools" },
    "media-center": { api: "HHCreativeLegacyTools" },
    workflow: { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "ai-director": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "prompt-studio": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "ai-automation": { api: "HHCreativeLegacyTools" },
    repurpose: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    brand: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    "audio-dubbing": { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    prototype: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    review: { api: "HHCreativeCollaborationOS", js: "creative-collaboration-os.js?v=1", css: "creative-collaboration-os.css?v=1" },
    collaboration: { api: "HHCreativeCollaborationOS", js: "creative-collaboration-os.js?v=1", css: "creative-collaboration-os.css?v=1" },
    publishing: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    analytics: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    rights: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    providers: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    marketplace: { api: "HHCreativeMarketplace", js: "creative-marketplace.js?v=1", css: "creative-marketplace.css?v=1" }
  });

  const loads = new Map();
  let activeRoot = null;
  let activeApi = null;
  let activeEngineRoot = null;
  let activeEngineHandle = null;
  let activeStore = null;
  let activeView = "overview";
  let activeOptions = {};
  let unsubscribe = null;
  let rootAbort = null;
  let mountToken = 0;
  let pageMain = null;
  let pageWorkspace = null;
  let sidebarWasCollapsed = null;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const viewMeta = (view) => VIEWS.find((item) => item.id === normalizeView(view)) || VIEWS[0];
  const groupNames = () => [...new Set(VIEWS.map((item) => item.group))];
  const searchable = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function loadScript(source) {
    if (loads.has(source)) return loads.get(source);
    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((node) => node.src.includes(source.split("?")[0]));
      if (existing) {
        if (existing.dataset.loaded === "true" || existing.dataset.hhRuntimeAsset === "script" || ["complete", "loaded"].includes(existing.readyState)) resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
      document.head.append(script);
    }).catch((error) => { loads.delete(source); throw error; });
    loads.set(source, promise);
    return promise;
  }

  function loadStyle(source) {
    const key = `css:${source}`;
    if (loads.has(key)) return loads.get(key);
    const promise = new Promise((resolve, reject) => {
      if ([...document.styleSheets].some((sheet) => sheet.href?.includes(source.split("?")[0]))) { resolve(); return; }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = source;
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
      document.head.append(link);
    }).catch((error) => { loads.delete(key); throw error; });
    loads.set(key, promise);
    return promise;
  }

  async function ensureStore() {
    if (activeStore) return activeStore;
    await loadScript("creative-os-core.js?v=4");
    if (!window.HHCreativeCore?.createStore) throw new Error("Creative project store chưa sẵn sàng.");
    activeStore = window.__HH_CREATIVE_STORE__ || window.HHCreativeCore.createStore();
    window.__HH_CREATIVE_STORE__ = activeStore;
    return activeStore;
  }

  function routeView(routeOrView) {
    const value = String(routeOrView || "overview").replace(/^#/, "");
    if (!value.includes("/")) return normalizeView(value);
    const parts = value.split("/").filter(Boolean);
    return normalizeView(parts[0] === "create" ? (parts[1] || "overview") : value);
  }

  function isPrepared(routeOrView) {
    const engine = ENGINES[routeView(routeOrView)];
    return Boolean(engine && window[engine.api]?.mount);
  }

  async function prepareRoute(routeOrView) {
    const view = routeView(routeOrView);
    const engine = ENGINES[view];
    if (!engine) throw new Error("Không tìm thấy workspace sáng tạo.");
    if (engine.api === "HHCreativeLegacyTools" && !window.HHCreativeLegacyTools?.mount) {
      window.dispatchEvent?.(new CustomEvent("hh:workspace-open"));
    }
    const work = [ensureStore()];
    if (engine.css) work.push(loadStyle(engine.css));
    if (!window[engine.api]?.mount && engine.js) work.push(loadScript(engine.js));
    await Promise.all(work);
    if (!window[engine.api]?.mount) throw new Error(`${engine.api} chưa sẵn sàng.`);
    return { view, ready: true };
  }

  function stateMetrics(state) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const active = projects.find((item) => item.id === state?.activeProjectId) || projects[0];
    const runs = Array.isArray(state?.runs) ? state.runs : [];
    const assets = projects.reduce((total, project) => total + (Array.isArray(project.assets) ? project.assets.length : 0), 0);
    const queued = projects.reduce((total, project) => total + (Array.isArray(project.publishing) ? project.publishing.filter((item) => ["draft", "scheduled", "queued"].includes(item.status)).length : 0), 0);
    const progress = Number(active?.analytics?.progress) || 0;
    return { projectCount: projects.length, active, runs: runs.length, assets, queued, progress: Math.max(0, Math.min(100, progress)) };
  }

  function renderContext() {
    if (!activeRoot || !activeStore) return;
    const metrics = stateMetrics(activeStore.getState());
    const values = {
      "[data-cos-active-project]": metrics.active?.name || "Chưa có dự án",
      "[data-cos-progress]": `${metrics.progress}%`,
      "[data-cos-project-count]": String(metrics.projectCount),
      "[data-cos-run-count]": String(metrics.runs),
      "[data-cos-asset-count]": String(metrics.assets),
      "[data-cos-queue-count]": String(metrics.queued)
    };
    Object.entries(values).forEach(([selector, value]) => activeRoot.querySelectorAll(selector).forEach((node) => { node.textContent = value; }));
  }

  function toolButton(item, current) {
    const active = item.id === current.id;
    return `<button type="button" class="creative-os__tool ${active ? "is-active" : ""}" data-cos-view="${escapeHTML(item.id)}" data-cos-search-text="${escapeHTML(`${item.title} ${item.description}`)}" ${active ? 'aria-current="page"' : ""}><i>${escapeHTML(item.icon)}</i><span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.description)}</small></span><em>›</em></button>`;
  }

  function shellMarkup(view) {
    const current = viewMeta(view);
    return `<section class="creative-os" data-creative-os data-view="${escapeHTML(current.id)}">
      <header class="creative-os__topbar">
        <button class="creative-os__nav-toggle" type="button" data-cos-nav-toggle aria-label="Mở danh sách 25 công cụ" aria-expanded="false"><span></span><span></span><span></span></button>
        <div class="creative-os__brand"><i>HH</i><span><small>CREATIVE WORKSPACE</small><strong data-cos-active-project>Đang tải dự án...</strong></span></div>
        <div class="creative-os__summary" aria-label="Dữ liệu dự án thật">
          <span><small>Tiến độ</small><b data-cos-progress>0%</b></span>
          <span><small>Dự án</small><b data-cos-project-count>0</b></span>
          <span><small>Assets</small><b data-cos-asset-count>0</b></span>
          <span><small>Chờ xuất bản</small><b data-cos-queue-count>0</b></span>
        </div>
        <div class="creative-os__top-actions"><button type="button" data-cos-new-project>+ Dự án</button><button type="button" data-cos-command title="Tìm lệnh toàn hệ thống">Ctrl K</button></div>
      </header>
      <div class="creative-os__body">
        <aside class="creative-os__navigator" data-cos-navigator aria-label="25 chức năng sáng tạo">
          <div class="creative-os__navigator-head"><div><strong>Chức năng</strong><span data-cos-tool-count>25/25</span></div><label><span>⌕</span><input type="search" data-cos-search placeholder="Tìm trong 25 công cụ..." autocomplete="off"></label></div>
          <nav class="creative-os__groups">${groupNames().map((group, index) => {
            const items = VIEWS.filter((item) => item.group === group);
            const open = group === current.group;
            return `<section class="creative-os__group ${open ? "is-open" : ""}" data-cos-group-section="${escapeHTML(group)}">
              <button class="creative-os__group-button" type="button" data-cos-group="${escapeHTML(group)}" aria-expanded="${open}"><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHTML(group)}</b><small>${items.length}</small><i>⌄</i></button>
              <div class="creative-os__group-tools" data-cos-group-tools ${open ? "" : "hidden"}>${items.map((item) => toolButton(item, current)).join("")}</div>
            </section>`;
          }).join("")}</nav>
          <footer><span><i></i>25 công cụ đã kết nối</span><button type="button" data-cos-export-project>Xuất project</button></footer>
        </aside>
        <section class="creative-os__stage">
          <header class="creative-os__stage-head"><div><small data-cos-group-label>${escapeHTML(current.group)}</small><h2 data-cos-title>${escapeHTML(current.title)}</h2><p data-cos-description>${escapeHTML(current.description)}</p></div><div><span><i></i>Đang làm việc</span><button type="button" data-cos-export-project>Xuất project</button></div></header>
          <main class="creative-os__workspace" data-cos-workspace aria-live="polite"><section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(current.title)}...</strong><span>Chỉ tải engine đang sử dụng để giữ giao diện mượt.</span></section></main>
        </section>
      </div>
    </section>`;
  }

  function teardownEngine() {
    try { activeEngineHandle?.unmount?.(); } catch {}
    try { activeApi?.unmount?.(activeEngineRoot); } catch {}
    activeApi = null;
    activeEngineRoot = null;
    activeEngineHandle = null;
  }

  function notifyWorkspace(view, eventName = "hh:creative-workspace-ready", extra = {}) {
    if (typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent(eventName, { detail: { view, route: view === "overview" ? "/create" : `/create/${view}`, ...extra } }));
  }

  async function mountEngine(view, options, token) {
    const host = activeRoot?.querySelector("[data-cos-workspace]");
    const engine = ENGINES[view];
    if (!host || !engine) return;
    host.innerHTML = `<section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(viewMeta(view).title)}...</strong><span>Đang chuẩn bị đúng công cụ bạn chọn.</span></section>`;
    try {
      const [store] = await Promise.all([ensureStore(), prepareRoute(view)]);
      if (token !== mountToken || !activeRoot) return;
      const api = window[engine.api];
      if (!api?.mount) throw new Error(`${engine.api} chưa cung cấp mount().`);
      const storeState = store.getState?.() || {};
      const projectId = storeState.activeProjectId || storeState.projects?.[0]?.id || "";
      teardownEngine();
      host.replaceChildren();
      activeApi = api;
      activeEngineRoot = host;
      const handle = await Promise.resolve(api.mount(host, {
        view,
        store,
        projectId: projectId,
        activeProjectId: projectId,
        apiBase: options.apiBase || "",
        socketUrl: options.socketUrl || "",
        currentUser: options.currentUser || null,
        providerAdapters: options.providerAdapters || {},
        runAI: options.runAI,
        onNavigate: (target) => {
          const targetView = routeView(target);
          if (String(target).includes("/create") && VIEWS.some((item) => item.id === targetView)) activateView(targetView, options, true);
          else if (typeof options.onNavigate === "function") options.onNavigate(target.startsWith("/") ? target : `/create/${target}`);
        },
        onInstall: (pack) => {
          const state = store.getState?.();
          const selectedProjectId = state?.activeProjectId || state?.projects?.[0]?.id;
          if (!selectedProjectId) throw new Error("Hãy tạo một Universal Project trước khi cài creative pack.");
          const asset = pack?.asset || { type: "marketplace", name: pack?.name || "Creative pack", metadata: pack };
          return store.addAsset?.(selectedProjectId, asset);
        }
      }));
      if (token !== mountToken || !activeRoot) { try { handle?.unmount?.(); } catch {} return; }
      activeEngineHandle = handle || null;
      renderContext();
      notifyWorkspace(view);
    } catch (error) {
      if (token !== mountToken || !host) return;
      host.innerHTML = `<section class="creative-os__error"><strong>Không thể mở workspace</strong><p>${escapeHTML(error.message || error)}</p><button type="button" data-cos-retry>Thử lại</button></section>`;
      notifyWorkspace(view, "hh:creative-workspace-error", { message: error.message || String(error) });
    }
  }

  function setOpenGroup(group) {
    activeRoot?.querySelectorAll("[data-cos-group-section]").forEach((section) => {
      const open = section.dataset.cosGroupSection === group;
      section.classList.toggle("is-open", open);
      const button = section.querySelector("[data-cos-group]");
      const tools = section.querySelector("[data-cos-group-tools]");
      button?.setAttribute("aria-expanded", String(open));
      if (tools) tools.hidden = !open;
    });
  }

  function syncActiveView(view) {
    const current = viewMeta(view);
    if (!activeRoot) return;
    const shell = activeRoot.querySelector("[data-creative-os]") || activeRoot;
    shell.dataset.view = current.id;
    activeRoot.querySelectorAll("[data-cos-view]").forEach((button) => {
      const active = button.dataset.cosView === current.id;
      button.classList.toggle("is-active", active);
      button.toggleAttribute("aria-current", active);
    });
    const text = {
      "[data-cos-group-label]": current.group,
      "[data-cos-title]": current.title,
      "[data-cos-description]": current.description
    };
    Object.entries(text).forEach(([selector, value]) => { const node = activeRoot.querySelector(selector); if (node) node.textContent = value; });
    setOpenGroup(current.group);
    shell.classList?.remove?.("is-nav-open");
    activeRoot.querySelector("[data-cos-nav-toggle]")?.setAttribute("aria-expanded", "false");
  }

  function applySearch(query) {
    if (!activeRoot) return;
    const needle = searchable(query);
    let visible = 0;
    activeRoot.querySelectorAll("[data-cos-group-section]").forEach((section) => {
      let groupMatches = 0;
      section.querySelectorAll("[data-cos-view]").forEach((button) => {
        const match = !needle || searchable(button.dataset.cosSearchText).includes(needle);
        button.hidden = !match;
        if (match) groupMatches += 1;
      });
      visible += groupMatches;
      section.hidden = groupMatches === 0;
      if (needle && groupMatches) {
        section.classList.add("is-open");
        section.querySelector("[data-cos-group]")?.setAttribute("aria-expanded", "true");
        const tools = section.querySelector("[data-cos-group-tools]");
        if (tools) tools.hidden = false;
      }
    });
    const count = activeRoot.querySelector("[data-cos-tool-count]");
    if (count) count.textContent = `${visible}/${VIEWS.length}`;
    if (!needle) setOpenGroup(viewMeta(activeView).group);
  }

  function activateView(nextView, options = activeOptions, userInitiated = false) {
    const view = normalizeView(nextView);
    activeView = view;
    syncActiveView(view);
    if (userInitiated) options.onViewChange?.(view);
    const token = ++mountToken;
    return mountEngine(view, options, token);
  }

  function exportProject() {
    const state = activeStore?.getState?.();
    const project = state?.projects?.find((item) => item.id === state.activeProjectId) || state?.projects?.[0];
    if (!project) return;
    const payload = activeStore.exportProject?.(project.id) || JSON.stringify(project, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(project.name || "creative-project").replace(/[^a-z0-9_-]+/gi, "-")}.hhcreative.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bind(root, options) {
    rootAbort?.abort();
    rootAbort = new AbortController();
    const signal = rootAbort.signal;
    root.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-cos-view]");
      if (viewButton) { activateView(viewButton.dataset.cosView, options, true); return; }
      const groupButton = event.target.closest("[data-cos-group]");
      if (groupButton) {
        const expanded = groupButton.getAttribute("aria-expanded") === "true";
        setOpenGroup(expanded ? "" : groupButton.dataset.cosGroup);
        return;
      }
      if (event.target.closest("[data-cos-nav-toggle]")) {
        const shell = root.querySelector("[data-creative-os]") || root;
        const open = shell.classList.toggle("is-nav-open");
        root.querySelector("[data-cos-nav-toggle]")?.setAttribute("aria-expanded", String(open));
        return;
      }
      if (event.target.closest("[data-cos-command]")) { document.dispatchEvent(new CustomEvent("hh:command-open")); document.querySelector("[data-command-open]")?.click(); return; }
      if (event.target.closest("[data-cos-new-project]")) {
        const project = activeStore?.createProject?.({ name: `Dự án sáng tạo ${new Date().toLocaleDateString("vi-VN")}` });
        if (project) activateView("project", options, true);
        return;
      }
      if (event.target.closest("[data-cos-export-project]")) { exportProject(); return; }
      if (event.target.closest("[data-cos-retry]")) activateView(activeView, options, false);
    }, { signal });
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-cos-search]")) applySearch(event.target.value);
    }, { signal });
    root.addEventListener("keydown", (event) => {
      const shell = root.querySelector("[data-creative-os]") || root;
      if (event.key === "Escape" && shell.classList.contains("is-nav-open")) {
        shell.classList.remove("is-nav-open");
        root.querySelector("[data-cos-nav-toggle]")?.setAttribute("aria-expanded", "false");
      }
    }, { signal });
  }

  function unmount() {
    mountToken += 1;
    teardownEngine();
    try { unsubscribe?.(); } catch {}
    try { rootAbort?.abort(); } catch {}
    pageMain?.classList.remove("app-main--creative-fixed");
    pageWorkspace?.classList.remove("app-workspace--creative-fixed");
    if (sidebarWasCollapsed === false) document.body?.classList?.remove?.("app-sidebar-collapsed");
    document.querySelectorAll?.("[data-shell-toggle]")?.forEach((button) => button.setAttribute("aria-expanded", String(!document.body?.classList?.contains?.("app-sidebar-collapsed"))));
    unsubscribe = null;
    rootAbort = null;
    pageMain = null;
    pageWorkspace = null;
    sidebarWasCollapsed = null;
    if (activeRoot) activeRoot.replaceChildren();
    activeRoot = null;
  }

  async function mount(root, options = {}) {
    if (!root) return;
    const view = normalizeView(options.view);
    if (activeRoot && activeRoot !== root) unmount();
    else {
      teardownEngine();
      try { unsubscribe?.(); } catch {}
      try { rootAbort?.abort(); } catch {}
      unsubscribe = null;
      rootAbort = null;
    }
    activeRoot = root;
    activeView = view;
    activeOptions = options;
    pageMain = root.closest?.(".app-main") || null;
    pageWorkspace = root.parentElement || null;
    if (sidebarWasCollapsed === null) sidebarWasCollapsed = Boolean(document.body?.classList?.contains?.("app-sidebar-collapsed"));
    document.body?.classList?.add?.("app-sidebar-collapsed");
    document.querySelectorAll?.("[data-shell-toggle]")?.forEach((button) => button.setAttribute("aria-expanded", "false"));
    pageMain?.classList.add("app-main--creative-fixed");
    pageWorkspace?.classList.add("app-workspace--creative-fixed");
    root.innerHTML = shellMarkup(view);
    bind(root, options);
    const store = await ensureStore();
    if (!activeRoot || root !== activeRoot) return;
    unsubscribe = store.subscribe?.(renderContext) || null;
    renderContext();
    await activateView(view, options, false);
  }

  window.HHCreativeOS = {
    mount,
    unmount,
    prepareRoute,
    isPrepared,
    views: VIEWS.map((item) => ({ ...item })),
    normalizeView,
    stateMetrics,
    version: 3
  };
})();
