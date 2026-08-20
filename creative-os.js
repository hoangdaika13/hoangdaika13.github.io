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
  const GROUP_ACCENTS = Object.freeze({
    "Điều hành": ["#65e8f4", "#6f8cff"],
    "AI & Kịch bản": ["#9a78ff", "#ff65c7"],
    "Tiền kỳ": ["#ff76b8", "#ffbd69"],
    "Sản xuất nội dung": ["#5be7c4", "#5f9dff"],
    "AI & Workflow": ["#7d76ff", "#65e8f4"],
    "Sản xuất chuyên sâu": ["#ff8b68", "#ffd969"],
    "Cộng tác": ["#55dfaf", "#67b8ff"],
    "Xuất bản": ["#ff69be", "#8c76ff"],
    "Mở rộng": ["#ffe06b", "#ff7e78"]
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
  let noticeTimer = 0;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const viewMeta = (view) => VIEWS.find((item) => item.id === normalizeView(view)) || VIEWS[0];

  function capabilityAudit() {
    return VIEWS.map((view) => {
      const engine = ENGINES[view.id];
      const loaded = Boolean(engine && window[engine.api]?.mount);
      const declared = Boolean(engine?.api && (engine.js || engine.api === "HHCreativeLegacyTools"));
      return { id: view.id, title: view.title, group: view.group, api: engine?.api || "", loaded, declared, state: loaded ? "ready" : declared ? "lazy" : "missing" };
    });
  }

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
    const state = activeStore.getState();
    const metrics = stateMetrics(state);
    const audit = capabilityAudit();
    const values = {
      "[data-cos-active-project]": metrics.active?.name || "Chưa có dự án",
      "[data-cos-progress]": `${metrics.progress}%`,
      "[data-cos-project-count]": String(metrics.projectCount),
      "[data-cos-run-count]": String(metrics.runs),
      "[data-cos-asset-count]": String(metrics.assets),
      "[data-cos-queue-count]": String(metrics.queued),
      "[data-cos-engine-count]": `${audit.filter((item) => item.declared).length}/${VIEWS.length}`,
      "[data-cos-sync-time]": state.updatedAt ? `Đã lưu ${new Date(state.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đã lưu local"
    };
    Object.entries(values).forEach(([selector, value]) => activeRoot.querySelectorAll(selector).forEach((node) => { node.textContent = value; }));
    const readiness = activeRoot.querySelector("[data-cos-readiness-list]");
    if (readiness) readiness.innerHTML = audit.map((item) => `<article data-state="${item.state}"><i>${escapeHTML(item.id === activeView ? "●" : item.loaded ? "✓" : "◇")}</i><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.api.replace(/^HHCreative/, ""))}</small></span><b>${item.id === activeView ? "Đang mở" : item.loaded ? "Sẵn sàng" : item.declared ? "Lazy" : "Thiếu"}</b></article>`).join("");
  }

  function showNotice(message, tone = "info") {
    const toast = activeRoot?.querySelector("[data-cos-toast]");
    if (!toast) return;
    window.clearTimeout(noticeTimer);
    toast.dataset.tone = tone;
    toast.textContent = String(message || "");
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    noticeTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 220);
    }, 3200);
  }

  function currentProject() {
    const state = activeStore?.getState?.();
    return state?.projects?.find((item) => item.id === state.activeProjectId) || state?.projects?.[0] || null;
  }

  function shellMarkup(view) {
    const current = viewMeta(view);
    return `<section class="creative-os" data-creative-os data-view="${escapeHTML(current.id)}">
      <div class="creative-os__cosmos" aria-hidden="true"><i></i><i></i><i></i><span></span><span></span><b></b></div>
      <header class="creative-os__topbar">
        <div class="creative-os__brand"><i><b>HH</b><span></span></i><span><small>CREATIVE LIVING UNIVERSE</small><strong data-cos-active-project>Đang tải dự án...</strong><em data-cos-sync-time>Đã lưu local</em></span></div>
        <div class="creative-os__summary" aria-label="Dữ liệu dự án thật">
          <span><small>Tiến độ</small><b data-cos-progress>0%</b></span>
          <span><small>Dự án</small><b data-cos-project-count>0</b></span>
          <span><small>Assets</small><b data-cos-asset-count>0</b></span>
          <span><small>Lượt chạy</small><b data-cos-run-count>0</b></span>
          <span><small>Chờ xuất bản</small><b data-cos-queue-count>0</b></span>
        </div>
        <div class="creative-os__top-actions"><button type="button" data-cos-readiness><i data-cos-engine-count>25/25</i> Engine</button><button type="button" data-cos-import-project>Nhập</button><button type="button" data-cos-snapshot>Snapshot</button><button type="button" data-cos-new-project>+ Dự án</button><button type="button" data-cos-command title="Tìm lệnh toàn hệ thống">Ctrl K</button><input type="file" hidden accept="application/json,.json,.hhcreative.json" data-cos-import-input></div>
        <aside class="creative-os__readiness" data-cos-readiness-panel hidden><header><div><small>ENGINE CONTRACT</small><strong>25 workspace đã nối chức năng thật</strong></div><button type="button" data-cos-close-readiness aria-label="Đóng">×</button></header><p>Engine chỉ được tải khi mở để giữ giao diện mượt. “Lazy” nghĩa là đã khai báo và sẵn sàng tải, không phải chức năng giả.</p><div data-cos-readiness-list></div></aside>
      </header>
      <div class="creative-os__body">
        <section class="creative-os__stage">
          <header class="creative-os__stage-head"><div><small data-cos-group-label>${escapeHTML(current.group)}</small><h2 data-cos-title>${escapeHTML(current.title)}</h2><p data-cos-description>${escapeHTML(current.description)}</p></div><div><span data-cos-engine-status><i></i>Engine có dữ liệu thật</span><button type="button" data-cos-export-project>Xuất project</button></div></header>
          <main class="creative-os__workspace" data-cos-workspace aria-live="polite"><section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(current.title)}...</strong><span>Chỉ tải engine đang sử dụng để giữ giao diện mượt.</span></section></main>
        </section>
      </div>
      <div class="creative-os__toast" data-cos-toast hidden role="status" aria-live="polite"></div>
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
      syncActiveView(view);
      notifyWorkspace(view);
    } catch (error) {
      if (token !== mountToken || !host) return;
      host.innerHTML = `<section class="creative-os__error"><strong>Không thể mở workspace</strong><p>${escapeHTML(error.message || error)}</p><button type="button" data-cos-retry>Thử lại</button></section>`;
      notifyWorkspace(view, "hh:creative-workspace-error", { message: error.message || String(error) });
    }
  }

  function syncActiveView(view) {
    const current = viewMeta(view);
    if (!activeRoot) return;
    const shell = activeRoot.querySelector("[data-creative-os]") || activeRoot;
    const colors = GROUP_ACCENTS[current.group] || GROUP_ACCENTS["Điều hành"];
    shell.dataset.view = current.id;
    shell.style?.setProperty?.("--cos-view", colors[0]);
    shell.style?.setProperty?.("--cos-view-2", colors[1]);
    const text = {
      "[data-cos-group-label]": current.group,
      "[data-cos-title]": current.title,
      "[data-cos-description]": current.description
    };
    Object.entries(text).forEach(([selector, value]) => { const node = activeRoot.querySelector(selector); if (node) node.textContent = value; });
    const status = activeRoot.querySelector("[data-cos-engine-status]");
    if (status) status.innerHTML = `<i></i>${window[ENGINES[current.id]?.api]?.mount ? "Engine đang hoạt động" : "Engine sẵn sàng tải"}`;
    renderContext();
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
    const project = currentProject();
    if (!project) { showNotice("Hãy tạo dự án trước khi xuất.", "warning"); return; }
    const payload = activeStore.exportProject?.(project.id) || JSON.stringify(project, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(project.name || "creative-project").replace(/[^a-z0-9_-]+/gi, "-")}.hhcreative.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Đã xuất project kèm toàn bộ dữ liệu và phiên bản.", "success");
  }

  async function importProject(file, options) {
    if (!file) return;
    if (file.size > 1_500_000) throw new Error("Tệp dự án vượt quá 1,5 MB.");
    const text = await file.text();
    const project = activeStore?.importProject?.(text);
    if (!project) throw new Error("Không thể nhập dự án này.");
    renderContext();
    await activateView("project", options, true);
    showNotice(`Đã nhập “${project.name || "Dự án sáng tạo"}”.`, "success");
  }

  function snapshotProject() {
    const project = currentProject();
    if (!project) { showNotice("Hãy tạo dự án trước khi chụp phiên bản.", "warning"); return; }
    const version = activeStore?.snapshotProject?.(
      project.id,
      `Snapshot ${new Date().toLocaleString("vi-VN")}`,
      `Tạo từ workspace ${viewMeta(activeView).title}`
    );
    if (!version) throw new Error("Không thể tạo snapshot.");
    showNotice("Đã lưu snapshot để có thể khôi phục sau này.", "success");
  }

  function bind(root, options) {
    rootAbort?.abort();
    rootAbort = new AbortController();
    const signal = rootAbort.signal;
    root.addEventListener("click", (event) => {
      const shell = root.querySelector("[data-creative-os]");
      const readiness = root.querySelector("[data-cos-readiness-panel]");
      if (event.target.closest("[data-cos-command]")) { document.dispatchEvent(new CustomEvent("hh:command-open")); document.querySelector("[data-command-open]")?.click(); return; }
      if (event.target.closest("[data-cos-readiness]")) {
        if (readiness) readiness.hidden = !readiness.hidden;
        return;
      }
      if (event.target.closest("[data-cos-close-readiness]")) { if (readiness) readiness.hidden = true; return; }
      if (event.target.closest("[data-cos-import-project]")) { root.querySelector("[data-cos-import-input]")?.click(); return; }
      if (event.target.closest("[data-cos-snapshot]")) {
        try { snapshotProject(); } catch (error) { showNotice(error.message || error, "error"); }
        return;
      }
      if (event.target.closest("[data-cos-new-project]")) {
        try {
          const project = activeStore?.createProject?.({ name: `Dự án sáng tạo ${new Date().toLocaleDateString("vi-VN")}` });
          if (project) { showNotice("Đã tạo Universal Project mới.", "success"); activateView("project", options, true); }
        } catch (error) { showNotice(error.message || error, "error"); }
        return;
      }
      if (event.target.closest("[data-cos-export-project]")) { exportProject(); return; }
      if (event.target.closest("[data-cos-retry]")) activateView(activeView, options, false);
      if (readiness && !readiness.hidden && !event.target.closest("[data-cos-readiness-panel]")) readiness.hidden = true;
      if (shell) shell.classList.remove("is-nav-open");
    }, { signal });
    root.querySelector("[data-cos-import-input]")?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      try { await importProject(input.files?.[0], options); }
      catch (error) { showNotice(error.message || error, "error"); }
      finally { input.value = ""; }
    }, { signal });
  }

  function unmount() {
    mountToken += 1;
    teardownEngine();
    try { unsubscribe?.(); } catch {}
    try { rootAbort?.abort(); } catch {}
    window.clearTimeout(noticeTimer);
    pageMain?.classList.remove("app-main--creative-fixed");
    pageWorkspace?.classList.remove("app-workspace--creative-fixed");
    unsubscribe = null;
    rootAbort = null;
    pageMain = null;
    pageWorkspace = null;
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
    pageMain?.classList.add("app-main--creative-fixed");
    pageWorkspace?.classList.add("app-workspace--creative-fixed");
    root.innerHTML = shellMarkup(view);
    bind(root, options);
    const store = await ensureStore();
    if (!activeRoot || root !== activeRoot) return;
    unsubscribe = store.subscribe?.((_state, action) => {
      renderContext();
      const sync = activeRoot?.querySelector("[data-cos-sync-time]");
      if (sync) {
        sync.dataset.action = action?.type || "update";
        sync.classList.remove("is-saved");
        void sync.offsetWidth;
        sync.classList.add("is-saved");
      }
    }) || null;
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
    capabilityAudit,
    version: 4
  };
})();
