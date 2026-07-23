(() => {
  "use strict";

  if (window.HHCreativeOS) return;

  const VIEWS = [
    { id: "overview", group: "Điều hành", icon: "CC", title: "Creative Command Center", description: "Dự án, lịch, chi phí và tiến độ sản xuất" },
    { id: "project", group: "Điều hành", icon: "UP", title: "Universal Project", description: "Nguồn dữ liệu chung của toàn bộ quy trình" },
    { id: "brief", group: "Tiền kỳ", icon: "BR", title: "Creative Brief", description: "Mục tiêu, đối tượng và kế hoạch nội dung" },
    { id: "moodboard", group: "Tiền kỳ", icon: "MB", title: "Moodboard", description: "Concept board kéo thả đa phương tiện" },
    { id: "storyboard", group: "Tiền kỳ", icon: "SB", title: "Storyboard", description: "Cảnh, shot, thoại và animatic" },
    { id: "world-bible", group: "Tiền kỳ", icon: "WB", title: "World Bible", description: "Nhân vật, bối cảnh và tính nhất quán" },
    { id: "workflow", group: "AI & Workflow", icon: "WF", title: "Creative Workflow", description: "Pipeline node có cache và approval gate" },
    { id: "ai-director", group: "AI & Workflow", icon: "AD", title: "AI Director", description: "Đề xuất quy trình nhưng luôn chờ duyệt" },
    { id: "prompt-studio", group: "AI & Workflow", icon: "MP", title: "Multimodal Prompt", description: "Reference, camera, seed và lineage" },
    { id: "repurpose", group: "Sản xuất", icon: "RE", title: "Repurpose Engine", description: "Một nội dung thành nhiều định dạng" },
    { id: "brand", group: "Sản xuất", icon: "BI", title: "Brand Intelligence", description: "Brand voice, quy tắc và kiểm tra đầu ra" },
    { id: "audio-dubbing", group: "Sản xuất", icon: "AU", title: "Audio & Dubbing", description: "Voice, nhạc, SFX, subtitle và timeline" },
    { id: "prototype", group: "Sản xuất", icon: "PT", title: "Prototype from Prompt", description: "Flow tương tác có thể chỉnh sửa" },
    { id: "review", group: "Cộng tác", icon: "RV", title: "Creative Review", description: "Comment, diff và quy trình phê duyệt" },
    { id: "collaboration", group: "Cộng tác", icon: "RT", title: "Realtime Collaboration", description: "Presence, chat, lock và timeline diff" },
    { id: "publishing", group: "Xuất bản", icon: "PB", title: "Publishing Calendar", description: "Lịch đa nền tảng và hàng đợi" },
    { id: "analytics", group: "Xuất bản", icon: "AN", title: "Creative Analytics", description: "CTR, retention và A/B có độ tin cậy" },
    { id: "rights", group: "Xuất bản", icon: "RC", title: "Rights & Provenance", description: "Nguồn, giấy phép và manifest tài sản" },
    { id: "providers", group: "Xuất bản", icon: "PR", title: "Provider Router", description: "Quota, chi phí, độ trễ và cooldown" },
    { id: "marketplace", group: "Mở rộng", icon: "MK", title: "Creative Marketplace", description: "Template, workflow và asset pack an toàn" }
  ];

  const LEGACY_TOOLS = [
    ["AI", "AI Center", "/create/ai-center"],
    ["KS", "Kịch bản AI", "/create/ai-script"],
    ["CS", "Creator Studio", "/create/creator-studio"],
    ["MC", "Media Center", "/create/media-center"],
    ["AU", "AI Automation", "/create/ai-automation"]
  ];

  const ENGINES = Object.freeze({
    overview: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    project: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    brief: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    moodboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    storyboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    "world-bible": { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    workflow: { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "ai-director": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "prompt-studio": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
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
  let unsubscribe = null;
  let rootAbort = null;
  let mountToken = 0;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const viewMeta = (view) => VIEWS.find((item) => item.id === normalizeView(view)) || VIEWS[0];

  function loadScript(source) {
    if (loads.has(source)) return loads.get(source);
    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((node) => node.src.includes(source.split("?")[0]));
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
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
    await loadScript("creative-os-core.js?v=1");
    if (!window.HHCreativeCore?.createStore) throw new Error("Creative project store chưa sẵn sàng.");
    activeStore = window.__HH_CREATIVE_STORE__ || window.HHCreativeCore.createStore();
    window.__HH_CREATIVE_STORE__ = activeStore;
    return activeStore;
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
    const name = metrics.active?.name || "Chưa có dự án";
    activeRoot.querySelectorAll("[data-cos-active-project]").forEach((node) => { node.textContent = name; });
    activeRoot.querySelectorAll("[data-cos-progress]").forEach((node) => { node.textContent = `${metrics.progress}%`; });
    activeRoot.querySelectorAll("[data-cos-project-count]").forEach((node) => { node.textContent = String(metrics.projectCount); });
    activeRoot.querySelectorAll("[data-cos-run-count]").forEach((node) => { node.textContent = String(metrics.runs); });
    activeRoot.querySelectorAll("[data-cos-asset-count]").forEach((node) => { node.textContent = String(metrics.assets); });
    activeRoot.querySelectorAll("[data-cos-queue-count]").forEach((node) => { node.textContent = String(metrics.queued); });
  }

  function shellMarkup(view) {
    const current = viewMeta(view);
    const groups = [...new Set(VIEWS.map((item) => item.group))];
    return `<section class="creative-os" data-creative-os data-view="${escapeHTML(current.id)}">
      <header class="creative-os__hero">
        <div class="creative-os__identity"><span>HH CREATIVE OS · LOCAL-FIRST PRODUCTION</span><h2>Biến ý tưởng thành sản phẩm</h2><p>Brief, kịch bản, media, cộng tác và xuất bản dùng chung một dự án có phiên bản.</p></div>
        <div class="creative-os__project"><small>DỰ ÁN ĐANG HOẠT ĐỘNG</small><strong data-cos-active-project>Đang tải...</strong><div><span>Tiến độ</span><b data-cos-progress>0%</b></div><button type="button" data-cos-new-project>+ Dự án mới</button></div>
        <div class="creative-os__signal" aria-hidden="true"><i></i><i></i><i></i><b>IDEA</b><b>MAKE</b><b>SHIP</b></div>
      </header>
      <section class="creative-os__metrics" aria-label="Tổng quan Creative OS">
        <div><span>Dự án</span><strong data-cos-project-count>0</strong></div><div><span>Lượt chạy</span><strong data-cos-run-count>0</strong></div><div><span>Assets</span><strong data-cos-asset-count>0</strong></div><div><span>Chờ xuất bản</span><strong data-cos-queue-count>0</strong></div>
      </section>
      <nav class="creative-os__rail" aria-label="Không gian Creative OS">${groups.map((group) => `<section><small>${escapeHTML(group)}</small><div>${VIEWS.filter((item) => item.group === group).map((item) => `<button type="button" data-cos-view="${escapeHTML(item.id)}" class="${item.id === current.id ? "is-active" : ""}" ${item.id === current.id ? 'aria-current="page"' : ""}><i>${escapeHTML(item.icon)}</i><span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.description)}</small></span></button>`).join("")}</div></section>`).join("")}</nav>
      <div class="creative-os__current"><div><small>${escapeHTML(current.group)}</small><h3>${escapeHTML(current.title)}</h3><p>${escapeHTML(current.description)}</p></div><div><button type="button" data-cos-export-project>Xuất project</button><button type="button" data-cos-command>Ctrl K</button></div></div>
      <main class="creative-os__workspace" data-cos-workspace aria-live="polite"><section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(current.title)}...</strong><span>Workspace chỉ tải khi cần để giữ trang mượt.</span></section></main>
      <aside class="creative-os__legacy"><header><div><small>CÔNG CỤ HIỆN CÓ</small><strong>Tiếp tục với studio quen thuộc</strong></div><span>Dữ liệu mới được liên kết qua Universal Project</span></header><div>${LEGACY_TOOLS.map(([icon, title, route]) => `<button type="button" data-cos-route="${route}"><i>${icon}</i><span>${title}</span><b>→</b></button>`).join("")}</div></aside>
    </section>`;
  }

  function navigate(route, options) {
    if (typeof options?.onNavigate === "function") options.onNavigate(route);
    else location.hash = `#${route}`;
  }

  async function mountEngine(view, options, token) {
    const host = activeRoot?.querySelector("[data-cos-workspace]");
    const engine = ENGINES[view];
    if (!host || !engine) return;
    try {
      const store = await ensureStore();
      await Promise.all([loadStyle(engine.css), loadScript(engine.js)]);
      if (token !== mountToken || !activeRoot) return;
      const api = window[engine.api];
      if (!api?.mount) throw new Error(`${engine.api} chưa cung cấp mount().`);
      const storeState = store.getState?.() || {};
      const projectId = storeState.activeProjectId || storeState.projects?.[0]?.id || "";
      activeApi = api;
      activeEngineRoot = host;
      host.replaceChildren();
      activeEngineHandle = api.mount(host, {
        view,
        store,
        projectId: projectId,
        activeProjectId: projectId,
        apiBase: options.apiBase || "",
        socketUrl: options.socketUrl || "",
        currentUser: options.currentUser || null,
        providerAdapters: options.providerAdapters || {},
        runAI: options.runAI,
        onNavigate: (target) => navigate(target.startsWith("/") ? target : `/create/${target}`, options),
        onInstall: (pack) => {
          const state = store.getState?.();
          const projectId = state?.activeProjectId || state?.projects?.[0]?.id;
          if (!projectId) throw new Error("Hãy tạo một Universal Project trước khi cài creative pack.");
          const asset = pack?.asset || { type: "marketplace", name: pack?.name || "Creative pack", metadata: pack };
          return store.addAsset?.(projectId, asset);
        }
      });
      renderContext();
    } catch (error) {
      if (token !== mountToken || !host) return;
      host.innerHTML = `<section class="creative-os__error"><strong>Không thể mở workspace</strong><p>${escapeHTML(error.message || error)}</p><button type="button" data-cos-retry>Thử lại</button></section>`;
    }
  }

  function bind(root, view, options) {
    rootAbort?.abort();
    rootAbort = new AbortController();
    root.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-cos-view]");
      if (viewButton) { navigate(`/create/${viewButton.dataset.cosView}`, options); return; }
      const routeButton = event.target.closest("[data-cos-route]");
      if (routeButton) { navigate(routeButton.dataset.cosRoute, options); return; }
      if (event.target.closest("[data-cos-command]")) { document.dispatchEvent(new CustomEvent("hh:command-open")); document.querySelector("[data-command-open]")?.click(); return; }
      if (event.target.closest("[data-cos-new-project]")) {
        const project = activeStore?.createProject?.({ name: `Dự án sáng tạo ${new Date().toLocaleDateString("vi-VN")}` });
        if (project) navigate("/create/project", options);
        return;
      }
      if (event.target.closest("[data-cos-export-project]")) {
        const state = activeStore?.getState?.();
        const project = state?.projects?.find((item) => item.id === state.activeProjectId) || state?.projects?.[0];
        if (!project) return;
        const payload = activeStore.exportProject?.(project.id) || JSON.stringify(project, null, 2);
        const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url; link.download = `${String(project.name || "creative-project").replace(/[^a-z0-9_-]+/gi, "-")}.hhcreative.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (event.target.closest("[data-cos-retry]")) mountEngine(view, options, ++mountToken);
    }, { signal: rootAbort.signal });
  }

  function unmount() {
    mountToken += 1;
    try { activeEngineHandle?.unmount?.(); } catch {}
    try { activeApi?.unmount?.(activeEngineRoot); } catch {}
    try { unsubscribe?.(); } catch {}
    try { rootAbort?.abort(); } catch {}
    activeApi = null;
    activeEngineRoot = null;
    activeEngineHandle = null;
    unsubscribe = null;
    rootAbort = null;
    if (activeRoot) activeRoot.replaceChildren();
    activeRoot = null;
  }

  async function mount(root, options = {}) {
    if (!root) return;
    const view = normalizeView(options.view);
    if (activeRoot && activeRoot !== root) unmount();
    else {
      try { activeEngineHandle?.unmount?.(); } catch {}
      try { activeApi?.unmount?.(activeEngineRoot); } catch {}
      try { unsubscribe?.(); } catch {}
      try { rootAbort?.abort(); } catch {}
      activeApi = null;
      activeEngineRoot = null;
      activeEngineHandle = null;
      unsubscribe = null;
      rootAbort = null;
    }
    activeRoot = root;
    const token = ++mountToken;
    root.innerHTML = shellMarkup(view);
    bind(root, view, options);
    try {
      const store = await ensureStore();
      if (token !== mountToken) return;
      unsubscribe = store.subscribe?.(renderContext) || null;
      renderContext();
    } catch {}
    mountEngine(view, options, token);
  }

  window.HHCreativeOS = { mount, unmount, views: VIEWS.map((item) => ({ ...item })), normalizeView, stateMetrics, version: 1 };
})();
