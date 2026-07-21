(() => {
  "use strict";

  const STORAGE_KEY = "hh.graphic-design.hub.v2";
  const MAX_PROJECTS = 40;
  const MAX_ASSETS = 16;
  const MAX_ASSET_BYTES = 850000;

  const VIEWS = [
    { id: "overview", label: "Tổng quan", icon: "◇", description: "Dự án, template và tài nguyên" },
    { id: "vector", label: "Vector Core", icon: "⌁", description: "Bezier, shape, mask và timeline" },
    { id: "nondestructive", label: "Non-destructive", icon: "◐", description: "Smart Object, filter và modifier stack" },
    { id: "typography", label: "Typography Pro", icon: "T", description: "Variable font, OpenType và text path" },
    { id: "effects", label: "Node Effects", icon: "⌬", description: "Node graph, mask, blend và preview" },
    { id: "quick-motion", label: "Motion Maker", icon: "✺", description: "Logo, loader và social motion" },
    { id: "animation", label: "Animation 2D", icon: "✦", description: "Timeline, keyframe và State Machine" },
    { id: "state-machine", label: "Interaction Graph", icon: "⌬", description: "State, transition và data binding" },
    { id: "3d", label: "3D Scene", icon: "◈", description: "Scene, vật thể, camera và ánh sáng" },
    { id: "mockup", label: "3D Mockup", icon: "▱", description: "Thiết bị, phối cảnh và camera orbit" },
    { id: "character", label: "Character Creator 3.0", icon: "◉", description: "Mesh, facial rig, lip-sync và motion" },
    { id: "simulation", label: "Simulation Lab", icon: "≈", description: "Particle, physics, cloth và rope" },
    { id: "prototype", label: "UI/UX Prototype", icon: "⌘", description: "Frame, flow, gesture và component" },
    { id: "motion", label: "Motion & Video", icon: "▶", description: "Text motion, timeline và export" },
    { id: "adaptive", label: "Adaptive Design", icon: "▦", description: "Một thiết kế, nhiều biến thể" },
    { id: "data", label: "Data-driven", icon: "⇆", description: "CSV, JSON, binding và batch design" },
    { id: "components", label: "Components", icon: "◫", description: "Master, instance, override và variant" },
    { id: "color", label: "Color Pipeline", icon: "◉", description: "LAB, OKLCH, LUT và soft proof" },
    { id: "projects", label: "Project Vault", icon: "▣", description: "Version, snapshot, asset và branch" },
    { id: "collaboration", label: "Live Collaboration", icon: "◎", description: "Presence, comment và phân quyền" },
    { id: "review", label: "Review & Approval", icon: "✓", description: "Comment, diff, duyệt và chia sẻ" },
    { id: "dev-ai", label: "Dev & AI", icon: "{}", description: "Handoff, token và AI có kiểm soát" },
    { id: "export", label: "Export Center", icon: "⇩", description: "Batch export, preset và preflight" },
    { id: "plugins", label: "Plugin SDK", icon: "⌘", description: "Extension sandbox, manifest và marketplace" },
    { id: "performance", label: "Performance", icon: "◴", description: "Renderer, FPS, memory và proxy asset" },
    { id: "composer", label: "Scene Composer", icon: "⬡", description: "2D, 3D, nhân vật và âm thanh" }
  ];

  const TEMPLATES = [
    { id: "social", title: "Social post", kind: "Thiết kế nhanh", size: "1080 × 1080", view: "quick-motion", icon: "▦", accent: "#ff5fc8", detail: "Bài đăng động cho Instagram, Facebook và thumbnail vuông." },
    { id: "story", title: "Story dọc", kind: "Mạng xã hội", size: "1080 × 1920", view: "quick-motion", icon: "▯", accent: "#a58dff", detail: "Story, Reel cover và nội dung mobile-first." },
    { id: "video", title: "Video 16:9", kind: "Motion", size: "1920 × 1080", view: "motion", icon: "▶", accent: "#63e8ff", detail: "Intro, title card và video giới thiệu sản phẩm." },
    { id: "lottie", title: "Logo & loader", kind: "Animation", size: "512 × 512", view: "quick-motion", icon: "✦", accent: "#c9f26f", detail: "Logo động, loader và icon với easing tùy chỉnh." },
    { id: "web", title: "Website hero", kind: "UI/UX", size: "1440 × 900", view: "prototype", icon: "⌘", accent: "#6ee7ff", detail: "Hero responsive, component và prototype flow." },
    { id: "mobile", title: "Mobile app", kind: "UI/UX", size: "390 × 844", view: "prototype", icon: "▤", accent: "#ff8acb", detail: "Luồng ứng dụng, hotspot và component state." },
    { id: "scene", title: "3D product scene", kind: "3D", size: "Web realtime", view: "3d", icon: "◈", accent: "#7ddcff", detail: "Sản phẩm 3D, vật liệu, ánh sáng và camera." },
    { id: "mockup", title: "Device mockup", kind: "3D Mockup", size: "Phone · Tablet · Laptop", view: "mockup", icon: "▱", accent: "#76f0cb", detail: "Đặt ảnh vào thiết bị, chỉnh phối cảnh và xuất PNG thật." },
    { id: "character", title: "Character loop", kind: "Nhân vật", size: "1920 × 1080", view: "character", icon: "◉", accent: "#ffc56e", detail: "Puppet, biểu cảm, trigger và lip-sync marker." },
    { id: "interactive", title: "Interactive component", kind: "Tương tác", size: "Web Component", view: "state-machine", icon: "⌬", accent: "#ff8bd7", detail: "State, transition, data binding và API component." },
    { id: "campaign", title: "Adaptive campaign", kind: "Đa nền tảng", size: "7 artboard", view: "adaptive", icon: "▦", accent: "#70f2ce", detail: "Một master design cho post, story, thumbnail và banner." },
    { id: "scene-composer", title: "Anime 3D scene", kind: "Scene Composer", size: "1920 × 1080", view: "composer", icon: "⬡", accent: "#a98cff", detail: "Nhân vật, scene 3D, thoại, UI và trigger trong một timeline." },
    { id: "presentation", title: "Presentation", kind: "Trình bày", size: "1920 × 1080", view: "prototype", icon: "▰", accent: "#9cf59f", detail: "Slide thuyết trình với hệ thống style nhất quán." },
    { id: "brand", title: "Brand motion", kind: "Thương hiệu", size: "Đa kích thước", view: "quick-motion", icon: "✺", accent: "#f59cff", detail: "Logo motion, màu thương hiệu và token chuyển động." },
    { id: "smart-edit", title: "Smart photo edit", kind: "Chỉnh sửa", size: "Không phá hủy", view: "nondestructive", icon: "◐", accent: "#ff77c8", detail: "Smart Object, adjustment layer, mask và filter có thể chỉnh lại." },
    { id: "type-system", title: "Variable type system", kind: "Typography", size: "OpenType", view: "typography", icon: "T", accent: "#ffd36a", detail: "Variable font, style dùng lại và text chạy theo đường cong." },
    { id: "node-fx", title: "Realtime node effects", kind: "Hiệu ứng", size: "Node graph", view: "effects", icon: "⌬", accent: "#73e9ff", detail: "Blur, glow, distortion, mask và blend trong graph trực quan." },
    { id: "simulation", title: "Particle simulation", kind: "Mô phỏng", size: "Canvas realtime", view: "simulation", icon: "≈", accent: "#a8f27a", detail: "Tuyết, mưa, pháo hoa, physics và constraint nhẹ." },
    { id: "data-campaign", title: "Data campaign", kind: "Tự động hóa", size: "CSV · JSON", view: "data", icon: "⇆", accent: "#8fc7ff", detail: "Sinh hàng loạt banner và thẻ từ dữ liệu có kiểm tra schema." },
    { id: "component-library", title: "Component library", kind: "Design System", size: "Variants", view: "components", icon: "◫", accent: "#c99cff", detail: "Master, instance, override và variant nhiều theme, ngôn ngữ." },
    { id: "color-grade", title: "Color grade", kind: "Màu sắc", size: "LAB · OKLCH · LUT", view: "color", icon: "◉", accent: "#ff9d70", detail: "Harmony, gamut, contrast, soft proof và LUT cho ảnh/video." },
    { id: "review-flow", title: "Approval flow", kind: "Cộng tác", size: "Review link", view: "review", icon: "✓", accent: "#7ff0c8", detail: "Comment ghim, so sánh phiên bản và trạng thái duyệt." },
    { id: "export-pack", title: "Campaign export", kind: "Xuất bản", size: "1x · 2x · 3x", view: "export", icon: "⇩", accent: "#72dbff", detail: "Batch artboard, watermark, naming rule và preflight." },
    { id: "performance-audit", title: "Performance audit", kind: "Hệ thống", size: "FPS · Memory", view: "performance", icon: "◴", accent: "#b8f26c", detail: "Theo dõi renderer, draw call, proxy asset và ngân sách hiệu năng." }
  ];

  const DEFAULT_STATE = {
    version: 2,
    projects: [
      { id: "project-motion", name: "HH Motion Identity", type: "animation", size: "512 × 512", updatedAt: Date.now() - 720000, progress: 72, favorite: true, status: "Đang chỉnh", accent: "#ff5fc8" },
      { id: "project-app", name: "HH Platform Mobile", type: "prototype", size: "390 × 844", updatedAt: Date.now() - 5400000, progress: 46, favorite: false, status: "Prototype", accent: "#63e8ff" },
      { id: "project-scene", name: "Neon Product Stage", type: "3d", size: "Web realtime", updatedAt: Date.now() - 86400000, progress: 30, favorite: false, status: "Concept", accent: "#a58dff" }
    ],
    brand: {
      name: "HH Neon System",
      primary: "#ff5fc8",
      secondary: "#63e8ff",
      accent: "#c9f26f",
      heading: "Inter",
      body: "Inter"
    },
    assets: [],
    checklist: [
      { id: "contrast", label: "Kiểm tra tương phản và khả năng đọc", done: true },
      { id: "responsive", label: "Xem trước desktop, tablet và mobile", done: false },
      { id: "optimize", label: "Tối ưu dung lượng asset", done: false },
      { id: "handoff", label: "Xuất token và thông số bàn giao", done: false }
    ],
    activity: [
      { id: "a1", label: "Tạo Creative Hub", time: Date.now() - 300000, tone: "cyan" },
      { id: "a2", label: "Lưu Brand Kit HH Neon", time: Date.now() - 3600000, tone: "pink" }
    ]
  };

  let activeRoot = null;
  let objectUrls = [];
  const engineLoads = new Map();
  const PRO_ENGINES = Object.freeze({
    nondestructive: { selector: "[data-graphic-nondestructive]", api: "HHGraphicNondestructive", source: "graphic-design-nondestructive.js?v=1" },
    typography: { selector: "[data-graphic-typography-pro]", api: "HHGraphicTypographyPro", source: "graphic-design-typography-pro.js?v=1" },
    effects: { selector: "[data-graphic-node-effects]", api: "HHGraphicNodeEffects", source: "graphic-design-node-effects.js?v=1" },
    character: { selector: "[data-graphic-character-pro]", api: "HHGraphicCharacterPro", source: "graphic-design-character-pro.js?v=1" },
    simulation: { selector: "[data-graphic-simulation]", api: "HHGraphicSimulation", source: "graphic-design-simulation.js?v=1" },
    data: { selector: "[data-graphic-data-driven]", api: "HHGraphicDataDriven", source: "graphic-design-data-driven.js?v=1" },
    components: { selector: "[data-graphic-components]", api: "HHGraphicComponents", source: "graphic-design-components.js?v=2" },
    color: { selector: "[data-graphic-color-pro]", api: "HHGraphicColorPro", source: "graphic-design-color-pro.js?v=1" },
    export: { selector: "[data-graphic-export-center]", api: "HHGraphicExportCenter", source: "graphic-design-export-center.js?v=2" },
    plugins: { selector: "[data-graphic-plugins]", api: "HHGraphicPlugins", source: "graphic-design-plugins.js?v=1" },
    review: { selector: "[data-graphic-review]", api: "HHGraphicReview", source: "graphic-design-review.js?v=2" },
    performance: { selector: "[data-graphic-performance]", api: "HHGraphicPerformance", source: "graphic-design-performance.js?v=1" }
  });

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const routeFor = (view) => view === "overview" ? "/graphic-design" : `/graphic-design/${view}`;
  const viewLabel = (view) => VIEWS.find((item) => item.id === view)?.label || "Studio";
  const timeAgo = (time) => {
    const minutes = Math.max(0, Math.floor((Date.now() - Number(time || 0)) / 60000));
    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== 2) return clone(DEFAULT_STATE);
      return {
        ...clone(DEFAULT_STATE),
        ...parsed,
        projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, MAX_PROJECTS) : clone(DEFAULT_STATE.projects),
        assets: Array.isArray(parsed.assets) ? parsed.assets.slice(0, MAX_ASSETS) : [],
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : clone(DEFAULT_STATE.checklist),
        activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 20) : clone(DEFAULT_STATE.activity),
        brand: { ...clone(DEFAULT_STATE.brand), ...(parsed.brand || {}) }
      };
    } catch {
      return clone(DEFAULT_STATE);
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function download(name, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function mountChild(root, selector, api, options = {}) {
    const target = root.querySelector(selector);
    if (!target) return;
    if (api?.mount) api.mount(target, options);
    else target.innerHTML = `<div class="gd-engine-unavailable"><strong>Engine đang chờ tải</strong><p>Làm mới trang để khởi động workspace này.</p></div>`;
  }

  function loadEngine(config) {
    if (globalThis[config.api]?.mount) return Promise.resolve(globalThis[config.api]);
    if (engineLoads.has(config.source)) return engineLoads.get(config.source);
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = config.source;
      script.async = true;
      script.dataset.gdEngineSource = config.source;
      script.addEventListener("load", () => globalThis[config.api]?.mount
        ? resolve(globalThis[config.api])
        : reject(new Error(`Module ${config.api} không cung cấp mount API.`)), { once: true });
      script.addEventListener("error", () => reject(new Error(`Không tải được ${config.source}.`)), { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      engineLoads.delete(config.source);
      throw error;
    });
    engineLoads.set(config.source, pending);
    return pending;
  }

  function mountProEngine(root, view, options = {}) {
    const config = PRO_ENGINES[view];
    const target = config ? root.querySelector(config.selector) : null;
    if (!config || !target) return;
    target.innerHTML = `<div class="gd-engine-unavailable" role="status"><strong>Đang khởi động ${escapeHTML(viewLabel(view))}</strong><p>Engine được tải theo nhu cầu để giữ HH Platform nhẹ và mượt.</p></div>`;
    loadEngine(config).then((api) => {
      if (root !== activeRoot || !target.isConnected) return;
      api.mount(target, options);
    }).catch((error) => {
      if (!target.isConnected) return;
      target.innerHTML = `<div class="gd-engine-unavailable" role="alert"><strong>Không thể mở engine</strong><p>${escapeHTML(error.message)}</p><button type="button" data-gd-retry-engine="${escapeHTML(view)}">Thử lại</button></div>`;
    });
  }

  function hero(view, state) {
    const complete = Math.round((state.checklist.filter((item) => item.done).length / Math.max(1, state.checklist.length)) * 100);
    const actions = view === "overview"
      ? `<button type="button" class="gd-primary" data-gd-action="new-project">＋ Tạo thiết kế</button>
         <button type="button" data-gd-action="import-hub">Nhập dự án</button>
         <button type="button" data-gd-action="continue-project">Tiếp tục gần nhất</button>
         <input type="file" accept="application/json,.json" data-gd-import hidden>`
      : `<button type="button" class="gd-primary" data-gd-route="overview">← Creative Hub</button>`;
    return `
      <header class="gd-hero">
        <div class="gd-hero-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="gd-hero-copy">
          <span class="gd-kicker">HH CREATIVE OS · LOCAL-FIRST WORKSPACE</span>
          <h2>${view === "overview" ? "Thiết kế đồ họa" : escapeHTML(viewLabel(view))}</h2>
          <p>${view === "overview" ? "Từ ý tưởng đến animation, 3D, prototype, motion video và nhân vật trong một quy trình thống nhất, dễ bắt đầu." : "Không gian biên tập chuyên sâu, tự lưu trên thiết bị và có thể xuất dự án để tiếp tục ở lần sau."}</p>
          <div class="gd-hero-actions">${actions}</div>
          <div class="gd-hero-meta"><span><i></i>Local autosave</span><span>${VIEWS.length - 1} workspace chuyên dụng</span><span>⌘ Ctrl K · tìm studio</span><span>${state.projects.length} dự án · ${complete}% checklist</span></div>
        </div>
        <div class="gd-hero-preview" aria-label="Bản xem trước hệ thống thiết kế">
          <div class="gd-preview-bar"><span></span><span></span><span></span><b>HH Canvas</b><em>100%</em></div>
          <div class="gd-preview-body">
            <aside><i></i><i></i><i></i><i></i><i></i></aside>
            <div class="gd-preview-canvas">
              <span class="gd-preview-tag">INTERACTIVE DESIGN</span>
              <strong>Make ideas<br>feel alive.</strong>
              <div class="gd-preview-shape gd-preview-shape--one"></div>
              <div class="gd-preview-shape gd-preview-shape--two"></div>
              <div class="gd-preview-timeline"><i></i><i></i><i></i><i></i><b></b></div>
            </div>
            <aside class="gd-preview-layers"><span>LAYERS</span><i></i><i></i><i></i></aside>
          </div>
        </div>
      </header>`;
  }

  function overviewContent(state) {
    const completed = state.checklist.filter((item) => item.done).length;
    return `
      <section class="gd-command-strip" aria-label="Thao tác nhanh">
        <button type="button" data-gd-template="social"><span>▦</span><b>Bài đăng mới</b><small>1080 × 1080</small></button>
        <button type="button" data-gd-template="video"><span>▶</span><b>Video mới</b><small>16:9 · Motion</small></button>
        <button type="button" data-gd-template="web"><span>⌘</span><b>UI mới</b><small>Responsive</small></button>
        <button type="button" data-gd-template="scene"><span>◈</span><b>Scene 3D</b><small>Web realtime</small></button>
        <button type="button" data-gd-action="export-hub"><span>⇩</span><b>Sao lưu</b><small>JSON project</small></button>
      </section>

      <section class="gd-dashboard-grid">
        <div class="gd-dashboard-main">
          <div class="gd-section-head">
            <div><span>PROJECT SPACE</span><h3>Dự án của bạn</h3><p>Mở lại, tìm kiếm hoặc tiếp tục từ nơi đang dở.</p></div>
            <label class="gd-search"><span>⌕</span><input type="search" placeholder="Tìm dự án..." data-gd-project-search></label>
          </div>
          <div class="gd-project-grid" data-gd-project-list>${renderProjects(state.projects)}</div>
        </div>

        <aside class="gd-dashboard-side">
          <section class="gd-brand-panel">
            <div class="gd-section-head"><div><span>BRAND KIT</span><h3>${escapeHTML(state.brand.name)}</h3></div><button type="button" data-gd-action="copy-tokens">Sao chép CSS</button></div>
            <label>Tên hệ thống<input type="text" maxlength="60" value="${escapeHTML(state.brand.name)}" data-gd-brand="name"></label>
            <div class="gd-color-row">
              ${["primary", "secondary", "accent"].map((key) => `<label><input type="color" value="${escapeHTML(state.brand[key])}" data-gd-brand="${key}"><span>${escapeHTML(state.brand[key])}</span></label>`).join("")}
            </div>
            <div class="gd-font-row"><label>Heading<select data-gd-brand="heading">${fontOptions(state.brand.heading)}</select></label><label>Body<select data-gd-brand="body">${fontOptions(state.brand.body)}</select></label></div>
            <div class="gd-brand-preview" style="--brand-primary:${escapeHTML(state.brand.primary)};--brand-secondary:${escapeHTML(state.brand.secondary)};--brand-accent:${escapeHTML(state.brand.accent)}"><i>HH</i><div><strong>${escapeHTML(state.brand.name)}</strong><span>Design once. Scale everywhere.</span></div></div>
          </section>

          <section class="gd-release-panel">
            <div class="gd-section-head"><div><span>READY TO SHIP</span><h3>Kiểm tra xuất bản</h3></div><b>${completed}/${state.checklist.length}</b></div>
            <div class="gd-progress"><i style="width:${Math.round((completed / Math.max(1, state.checklist.length)) * 100)}%"></i></div>
            <div class="gd-checklist">${state.checklist.map((item) => `<label><input type="checkbox" data-gd-check="${escapeHTML(item.id)}" ${item.done ? "checked" : ""}><span>${escapeHTML(item.label)}</span></label>`).join("")}</div>
          </section>
        </aside>
      </section>

      <section class="gd-template-section">
        <div class="gd-section-head">
          <div><span>SMART START</span><h3>Template theo đúng mục đích</h3><p>Chọn kích thước và mở thẳng editor phù hợp.</p></div>
          <div class="gd-filter-row" role="group" aria-label="Lọc template"><button type="button" class="is-active" data-gd-filter="all">Tất cả</button><button type="button" data-gd-filter="UI/UX">UI/UX</button><button type="button" data-gd-filter="Motion">Motion</button><button type="button" data-gd-filter="3D">3D</button></div>
        </div>
        <div class="gd-template-grid" data-gd-template-list>${renderTemplates(TEMPLATES)}</div>
      </section>

      <section class="gd-resource-grid">
        <div class="gd-asset-panel">
          <div class="gd-section-head"><div><span>ASSET LIBRARY</span><h3>Tài nguyên cục bộ</h3><p>Ảnh nhỏ được lưu trên thiết bị; file lớn chỉ đọc metadata.</p></div><button type="button" data-gd-action="choose-assets">＋ Thêm asset</button></div>
          <input type="file" accept="image/*,.svg,.json" multiple data-gd-assets hidden>
          <div class="gd-dropzone" data-gd-dropzone tabindex="0"><strong>Kéo ảnh, SVG hoặc JSON vào đây</strong><span>Tối đa ${MAX_ASSETS} asset · preview ảnh nhỏ dưới 850 KB</span></div>
          <div class="gd-asset-list" data-gd-asset-list>${renderAssets(state.assets)}</div>
        </div>

        <div class="gd-handoff-panel">
          <div class="gd-section-head"><div><span>DESIGN → DEV</span><h3>Token & bàn giao</h3><p>Một nguồn sự thật cho màu, font và quy chuẩn.</p></div><button type="button" data-gd-action="download-tokens">Xuất tokens</button></div>
          <div class="gd-token-list">
            <div><span>color.brand.primary</span><code>${escapeHTML(state.brand.primary)}</code></div>
            <div><span>color.brand.secondary</span><code>${escapeHTML(state.brand.secondary)}</code></div>
            <div><span>color.brand.accent</span><code>${escapeHTML(state.brand.accent)}</code></div>
            <div><span>font.heading</span><code>${escapeHTML(state.brand.heading)}</code></div>
            <div><span>font.body</span><code>${escapeHTML(state.brand.body)}</code></div>
          </div>
          <div class="gd-activity"><strong>Hoạt động gần đây</strong>${state.activity.slice(0, 4).map((item) => `<div><i class="is-${escapeHTML(item.tone)}"></i><span>${escapeHTML(item.label)}</span><time>${timeAgo(item.time)}</time></div>`).join("")}</div>
        </div>
      </section>

      <section class="gd-studio-map">
        <div class="gd-section-head"><div><span>PRO WORKSPACES</span><h3>Công cụ chuyên sâu</h3><p>Mỗi studio chỉ tải khi bạn mở, giúp trang tổng quan nhanh và gọn.</p></div></div>
        <div class="gd-overview-grid">${VIEWS.filter((item) => item.id !== "overview").map((item) => studioCard(item)).join("")}</div>
      </section>`;
  }

  function studioCard(item) {
    const meta = {
      vector: ["SVG · BEZIER · MOTION PATH", "Pen, shape, mask, blend, smart guide và timeline nhiều track"],
      nondestructive: ["SMART OBJECT · FILTER · MASK", "Adjustment layer, modifier stack và chỉnh sửa không phá hủy"],
      typography: ["VARIABLE FONT · OPENTYPE · TEXT PATH", "Kerning, ligature, style dùng lại và kiểm tra font"],
      effects: ["NODE GRAPH · MASK · BLEND", "Blur, glow, distortion và preset hiệu ứng realtime"],
      "quick-motion": ["JITTER · LOTTIE · SVGATOR", "Logo động, loading, social post và xuất SVG/CSS chạy thật"],
      animation: ["RIVE · LOTTIE · SVGATOR", "Data binding, easing, keyframe và state machine"],
      "state-machine": ["RIVE · DOTLOTTIE · WEB COMPONENT", "Node graph, transition, event, binding và simulator"],
      "3d": ["SPLINE · VECTARY · BLENDER", "Scene graph, vật liệu, ánh sáng, camera và interaction"],
      mockup: ["ROTATO · SPLINE · VECTARY", "Phone, tablet, laptop, phối cảnh, scene và orbit camera"],
      character: ["CHARACTER ANIMATOR · LIVE2D · SPINE", "Rig xương, IK, pose, biểu cảm, blink, viseme và timeline"],
      simulation: ["PARTICLE · PHYSICS · CONSTRAINT", "Mưa, tuyết, pháo hoa, rope, cloth và chuyển động vật lý"],
      prototype: ["FIGMA · PENPOT · FRAMER", "Frame, component, variable, hotspot và responsive preview"],
      motion: ["JITTER · CANVA · VEED", "Layer, track, preset, marker và cấu hình xuất video"],
      adaptive: ["CANVA · ADOBE EXPRESS · BRAND KIT", "Master design, smart crop, safe zone và artboard đồng bộ"],
      data: ["CSV · JSON · DATA BINDING", "Sinh banner, thẻ và thumbnail hàng loạt từ dữ liệu có schema"],
      components: ["MASTER · INSTANCE · VARIANT", "Component liên kết, override và biến thể theo theme, ngôn ngữ"],
      color: ["LAB · OKLCH · LUT · WCAG", "Color harmony, soft proof, gamut warning và pipeline màu chuyên nghiệp"],
      projects: ["INDEXEDDB · VERSION · ASSET MANAGER", "Snapshot, diff, branch, review và gói .hhdesign"],
      collaboration: ["SOCKET.IO · PRESENCE · REVIEW", "Con trỏ, comment, layer lock, quyền và phiên cộng tác"],
      review: ["COMMENT · DIFF · APPROVAL", "Bình luận ghim, so sánh phiên bản và quy trình duyệt có audit"],
      "dev-ai": ["FIGMA DEV MODE · DESIGN QA", "Inspect, token, handoff, accessibility và AI tạo bản nháp"],
      export: ["BATCH · PREFLIGHT · PRESET", "Xuất nhiều artboard, watermark, naming rule và kiểm tra trước xuất"],
      plugins: ["MANIFEST · SANDBOX · MARKETPLACE", "Cài extension, preset và asset pack trong vùng chạy an toàn"],
      performance: ["WEBGPU · FPS · PROXY", "Theo dõi renderer, bộ nhớ, draw call và ngân sách asset"],
      composer: ["HH UNIVERSAL SCENE", "Ghép vector, character, 3D, UI, audio và interaction"]
    }[item.id];
    const details = meta || ["HH CREATIVE WORKSPACE", item.description || "Công cụ thiết kế chuyên sâu"];
    return `<article class="gd-overview-card gd-overview-card--${escapeHTML(item.id)}"><span>${item.icon}</span><div><small>${details[0]}</small><h3>${escapeHTML(item.label)}</h3><p>${details[1]}.</p><ul><li>Autosave</li><li>Undo/redo</li><li>Import/export</li></ul></div><button type="button" data-gd-route="${escapeHTML(item.id)}">Mở studio <b>→</b></button></article>`;
  }

  function renderProjects(projects, query = "") {
    const normalized = query.trim().toLocaleLowerCase("vi");
    const filtered = projects.filter((project) => !normalized || `${project.name} ${project.status} ${project.type}`.toLocaleLowerCase("vi").includes(normalized));
    if (!filtered.length) return `<div class="gd-empty"><strong>Không tìm thấy dự án</strong><span>Thử từ khóa khác hoặc tạo thiết kế mới.</span></div>`;
    return filtered.map((project) => `
      <article class="gd-project-card" style="--project-accent:${escapeHTML(project.accent || "#63e8ff")}">
        <button type="button" class="gd-project-preview" data-gd-open-project="${escapeHTML(project.id)}" aria-label="Mở ${escapeHTML(project.name)}"><i></i><i></i><strong>${escapeHTML(viewLabel(project.type))}</strong><span>${escapeHTML(project.size)}</span></button>
        <div class="gd-project-copy"><div><strong>${escapeHTML(project.name)}</strong><span>${escapeHTML(project.status)} · ${timeAgo(project.updatedAt)}</span></div><button type="button" data-gd-favorite="${escapeHTML(project.id)}" aria-label="${project.favorite ? "Bỏ ghim" : "Ghim"} ${escapeHTML(project.name)}" aria-pressed="${project.favorite}">${project.favorite ? "★" : "☆"}</button></div>
        <div class="gd-project-progress"><i style="width:${Math.max(0, Math.min(100, Number(project.progress) || 0))}%"></i><span>${Math.max(0, Math.min(100, Number(project.progress) || 0))}%</span></div>
      </article>`).join("");
  }

  function renderTemplates(templates) {
    return templates.map((item) => `<button type="button" class="gd-template-card" data-gd-template="${escapeHTML(item.id)}" data-gd-kind="${escapeHTML(item.kind)}" style="--template-accent:${escapeHTML(item.accent)}"><span class="gd-template-visual"><i>${item.icon}</i><b>${escapeHTML(item.size)}</b></span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.kind)}</small><p>${escapeHTML(item.detail)}</p><em>Dùng template →</em></button>`).join("");
  }

  function renderAssets(assets) {
    if (!assets.length) return `<div class="gd-asset-empty"><span>◇</span><p>Asset mới sẽ xuất hiện ở đây.</p></div>`;
    return assets.map((asset) => `<article class="gd-asset-item">${asset.dataUrl ? `<img src="${escapeHTML(asset.dataUrl)}" alt="">` : `<span>${asset.type.includes("json") ? "{}" : "SVG"}</span>`}<div><strong>${escapeHTML(asset.name)}</strong><small>${formatBytes(asset.size)} · ${escapeHTML(asset.type || "file")}</small></div><button type="button" data-gd-remove-asset="${escapeHTML(asset.id)}" aria-label="Xóa ${escapeHTML(asset.name)}">×</button></article>`).join("");
  }

  function fontOptions(current) {
    return ["Inter", "Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"].map((font) => `<option value="${font}" ${font === current ? "selected" : ""}>${font}</option>`).join("");
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1048576).toFixed(1)} MB`;
  }

  function focusedContent(view) {
    const selectors = {
      vector: "data-graphic-vector-core",
      nondestructive: "data-graphic-nondestructive",
      typography: "data-graphic-typography-pro",
      effects: "data-graphic-node-effects",
      "quick-motion": "data-graphic-quick-motion",
      animation: "data-graphic-animation",
      "state-machine": "data-graphic-state-machine",
      "3d": "data-graphic-3d",
      mockup: "data-graphic-mockup",
      character: "data-graphic-character-pro data-graphic-character",
      simulation: "data-graphic-simulation",
      prototype: "data-graphic-prototype",
      motion: "data-graphic-motion",
      adaptive: "data-graphic-adaptive",
      data: "data-graphic-data-driven",
      components: "data-graphic-components",
      color: "data-graphic-color-pro",
      projects: "data-graphic-project-store",
      collaboration: "data-graphic-collaboration",
      review: "data-graphic-review",
      "dev-ai": "data-graphic-dev-ai",
      export: "data-graphic-export-center",
      plugins: "data-graphic-plugins",
      performance: "data-graphic-performance",
      composer: "data-graphic-composer"
    };
    return `<section class="gd-focused-workspace" data-gd-focused="${escapeHTML(view)}"><div ${selectors[view] || selectors.animation}></div></section>`;
  }

  function addActivity(state, label, tone = "cyan") {
    state.activity.unshift({ id: uid("activity"), label, time: Date.now(), tone });
    state.activity = state.activity.slice(0, 20);
  }

  function createProject(state, template) {
    const project = {
      id: uid("project"),
      name: `${template.title} ${state.projects.length + 1}`,
      type: template.view,
      size: template.size,
      updatedAt: Date.now(),
      progress: 5,
      favorite: false,
      status: "Mới tạo",
      accent: template.accent
    };
    state.projects.unshift(project);
    state.projects = state.projects.slice(0, MAX_PROJECTS);
    addActivity(state, `Tạo dự án ${project.name}`, "pink");
    saveState(state);
    return project;
  }

  function applyBrand(root, brand) {
    root.style.setProperty("--gd-pink", brand.primary);
    root.style.setProperty("--gd-cyan", brand.secondary);
    root.style.setProperty("--gd-lime", brand.accent);
  }

  function showToast(root, message) {
    let toast = root.querySelector("[data-gd-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "gd-toast";
      toast.dataset.gdToast = "";
      root.append(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function bindOverview(root, state) {
    const refreshProjectList = (query = "") => {
      const list = root.querySelector("[data-gd-project-list]");
      if (list) list.innerHTML = renderProjects(state.projects, query);
    };
    const refreshAssets = () => {
      const list = root.querySelector("[data-gd-asset-list]");
      if (list) list.innerHTML = renderAssets(state.assets);
    };
    const openProject = (project) => {
      project.updatedAt = Date.now();
      project.progress = Math.min(95, Math.max(8, Number(project.progress) || 0));
      addActivity(state, `Mở ${project.name}`);
      saveState(state);
      location.hash = `#${routeFor(project.type)}`;
    };
    const addFiles = (files) => {
      [...files].slice(0, MAX_ASSETS).forEach((file) => {
        if (state.assets.length >= MAX_ASSETS) return showToast(root, `Đã đạt giới hạn ${MAX_ASSETS} asset.`);
        const asset = { id: uid("asset"), name: file.name.slice(0, 120), size: file.size, type: file.type || "file", dataUrl: "" };
        state.assets.unshift(asset);
        const shouldPreview = file.type.startsWith("image/") && file.size <= MAX_ASSET_BYTES;
        if (!shouldPreview) {
          saveState(state);
          refreshAssets();
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          asset.dataUrl = String(reader.result || "");
          if (!saveState(state)) asset.dataUrl = "";
          refreshAssets();
        };
        reader.readAsDataURL(file);
      });
      addActivity(state, `Thêm ${files.length} asset`, "lime");
      saveState(state);
      refreshAssets();
    };

    root.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-gd-route]");
      if (routeButton) {
        location.hash = `#${routeFor(normalizeView(routeButton.dataset.gdRoute))}`;
        return;
      }
      const templateButton = event.target.closest("[data-gd-template]");
      if (templateButton) {
        const template = TEMPLATES.find((item) => item.id === templateButton.dataset.gdTemplate);
        if (template) openProject(createProject(state, template));
        return;
      }
      const projectButton = event.target.closest("[data-gd-open-project]");
      if (projectButton) {
        const project = state.projects.find((item) => item.id === projectButton.dataset.gdOpenProject);
        if (project) openProject(project);
        return;
      }
      const favorite = event.target.closest("[data-gd-favorite]");
      if (favorite) {
        const project = state.projects.find((item) => item.id === favorite.dataset.gdFavorite);
        if (project) {
          project.favorite = !project.favorite;
          state.projects.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
          saveState(state);
          refreshProjectList(root.querySelector("[data-gd-project-search]")?.value || "");
        }
        return;
      }
      const filter = event.target.closest("[data-gd-filter]");
      if (filter) {
        root.querySelectorAll("[data-gd-filter]").forEach((item) => item.classList.toggle("is-active", item === filter));
        const kind = filter.dataset.gdFilter;
        const templates = kind === "all" ? TEMPLATES : TEMPLATES.filter((item) => item.kind === kind);
        root.querySelector("[data-gd-template-list]").innerHTML = renderTemplates(templates);
        return;
      }
      const removeAsset = event.target.closest("[data-gd-remove-asset]");
      if (removeAsset) {
        state.assets = state.assets.filter((item) => item.id !== removeAsset.dataset.gdRemoveAsset);
        saveState(state);
        refreshAssets();
        return;
      }
      const action = event.target.closest("[data-gd-action]")?.dataset.gdAction;
      if (!action) return;
      if (action === "new-project") root.querySelector("[data-gd-template-list]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (action === "continue-project") state.projects[0] ? openProject(state.projects[0]) : showToast(root, "Chưa có dự án để tiếp tục.");
      else if (action === "import-hub") root.querySelector("[data-gd-import]")?.click();
      else if (action === "choose-assets") root.querySelector("[data-gd-assets]")?.click();
      else if (action === "export-hub") download("hh-graphic-design-backup.json", JSON.stringify(state, null, 2));
      else if (action === "download-tokens") download("hh-design-tokens.json", JSON.stringify({ version: 1, brand: state.brand }, null, 2));
      else if (action === "copy-tokens") {
        const css = `:root {\n  --brand-primary: ${state.brand.primary};\n  --brand-secondary: ${state.brand.secondary};\n  --brand-accent: ${state.brand.accent};\n  --font-heading: "${state.brand.heading}";\n  --font-body: "${state.brand.body}";\n}`;
        navigator.clipboard?.writeText(css).then(() => showToast(root, "Đã sao chép CSS token.")).catch(() => download("hh-brand-tokens.css", css, "text/css"));
      }
    });

    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-gd-project-search]")) refreshProjectList(event.target.value);
      if (event.target.matches("[data-gd-brand]")) {
        state.brand[event.target.dataset.gdBrand] = event.target.value;
        saveState(state);
        applyBrand(root, state.brand);
        const preview = root.querySelector(".gd-brand-preview");
        if (preview) {
          preview.style.setProperty("--brand-primary", state.brand.primary);
          preview.style.setProperty("--brand-secondary", state.brand.secondary);
          preview.style.setProperty("--brand-accent", state.brand.accent);
        }
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-gd-assets]") && event.target.files?.length) addFiles(event.target.files);
      if (event.target.matches("[data-gd-check]")) {
        const item = state.checklist.find((entry) => entry.id === event.target.dataset.gdCheck);
        if (item) {
          item.done = event.target.checked;
          saveState(state);
          showToast(root, item.done ? "Đã hoàn thành mục kiểm tra." : "Đã mở lại mục kiểm tra.");
        }
      }
      if (event.target.matches("[data-gd-import]") && event.target.files?.[0]) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const imported = JSON.parse(String(reader.result || "{}"));
            if (imported.version !== 2 || !Array.isArray(imported.projects)) throw new Error("schema");
            saveState(imported);
            showToast(root, "Đã nhập dữ liệu. Đang làm mới...");
            setTimeout(() => mount(root, { view: "overview" }), 400);
          } catch {
            showToast(root, "Tệp không đúng định dạng HH Graphic Design v2.");
          }
        };
        reader.readAsText(event.target.files[0]);
      }
    });

    const dropzone = root.querySelector("[data-gd-dropzone]");
    ["dragenter", "dragover"].forEach((name) => dropzone?.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((name) => dropzone?.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); if (name === "drop" && event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files); }));
    dropzone?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") root.querySelector("[data-gd-assets]")?.click(); });
  }

  function mount(root, options = {}) {
    if (!root) return;
    unmount();
    activeRoot = root;
    const state = loadState();
    const view = normalizeView(options.view);
    root.className = "graphic-design-studio";
    root.dataset.graphicDesignMounted = "true";
    root.dataset.gdView = view;
    applyBrand(root, state.brand);
    root.innerHTML = `
      ${hero(view, state)}
      <nav class="gd-tabs" aria-label="Các studio thiết kế">${VIEWS.map((item) => `<button type="button" class="${item.id === view ? "is-active" : ""}" data-gd-route="${item.id}" title="${escapeHTML(item.description)}"><span>${item.icon}</span><b>${item.label}</b><small>${item.description}</small></button>`).join("")}</nav>
      <main class="gd-main">${view === "overview" ? overviewContent(state) : focusedContent(view)}</main>
      <footer class="gd-footer"><span><i></i> Sẵn sàng làm việc</span><span>Thiết kế được lưu trên thiết bị này</span><span data-gd-status>${escapeHTML(viewLabel(view))} · đã sẵn sàng</span></footer>
      <div class="gd-toast" data-gd-toast hidden></div>`;

    if (view === "overview") bindOverview(root, state);
    else {
      root.addEventListener("click", (event) => {
        const routeButton = event.target.closest("[data-gd-route]");
        if (routeButton) location.hash = `#${routeFor(normalizeView(routeButton.dataset.gdRoute))}`;
        const retryButton = event.target.closest("[data-gd-retry-engine]");
        if (retryButton) mountProEngine(root, normalizeView(retryButton.dataset.gdRetryEngine), options);
      });
      if (PRO_ENGINES[view]) mountProEngine(root, view, options);
      else if (view === "vector") mountChild(root, "[data-graphic-vector-core]", globalThis.HHGraphicVectorCore, options);
      else if (view === "quick-motion") mountChild(root, "[data-graphic-quick-motion]", globalThis.HHGraphicQuickMotion, options);
      else if (view === "animation") mountChild(root, "[data-graphic-animation]", globalThis.HHGraphicAnimation);
      else if (view === "state-machine") mountChild(root, "[data-graphic-state-machine]", globalThis.HHGraphicStateMachine, options);
      else if (view === "3d") mountChild(root, "[data-graphic-3d]", globalThis.HHGraphic3D);
      else if (view === "mockup") mountChild(root, "[data-graphic-mockup]", globalThis.HHGraphicMockup);
      else if (view === "prototype") mountChild(root, "[data-graphic-prototype]", globalThis.HHGraphicPrototype);
      else if (view === "motion") mountChild(root, "[data-graphic-motion]", globalThis.HHGraphicMotion);
      else if (view === "adaptive") mountChild(root, "[data-graphic-adaptive]", globalThis.HHGraphicAdaptive, options);
      else if (view === "projects") mountChild(root, "[data-graphic-project-store]", globalThis.HHGraphicProjectStore, options);
      else if (view === "collaboration") mountChild(root, "[data-graphic-collaboration]", globalThis.HHGraphicCollaboration, options);
      else if (view === "dev-ai") mountChild(root, "[data-graphic-dev-ai]", globalThis.HHGraphicDevAI, options);
      else if (view === "composer") mountChild(root, "[data-graphic-composer]", globalThis.HHGraphicComposer, options);
    }
  }

  function unmount() {
    globalThis.HHGraphicVectorCore?.unmount?.(activeRoot?.querySelector("[data-graphic-vector-core]"));
    globalThis.HHGraphicNondestructive?.unmount?.(activeRoot?.querySelector("[data-graphic-nondestructive]"));
    globalThis.HHGraphicTypographyPro?.unmount?.(activeRoot?.querySelector("[data-graphic-typography-pro]"));
    globalThis.HHGraphicNodeEffects?.unmount?.(activeRoot?.querySelector("[data-graphic-node-effects]"));
    globalThis.HHGraphicQuickMotion?.unmount?.(activeRoot?.querySelector("[data-graphic-quick-motion]"));
    globalThis.HHGraphicAnimation?.unmount?.();
    globalThis.HHGraphicStateMachine?.unmount?.(activeRoot?.querySelector("[data-graphic-state-machine]"));
    globalThis.HHGraphic3D?.unmount?.(activeRoot?.querySelector("[data-graphic-3d]"));
    globalThis.HHGraphicMockup?.unmount?.(activeRoot?.querySelector("[data-graphic-mockup]"));
    globalThis.HHGraphicCharacterPro?.unmount?.(activeRoot?.querySelector("[data-graphic-character-pro]"));
    globalThis.HHGraphicCharacter?.unmount?.(activeRoot?.querySelector("[data-graphic-character-pro]"));
    globalThis.HHGraphicSimulation?.unmount?.(activeRoot?.querySelector("[data-graphic-simulation]"));
    globalThis.HHGraphicPrototype?.unmount?.();
    globalThis.HHGraphicMotion?.unmount?.();
    globalThis.HHGraphicAdaptive?.unmount?.(activeRoot?.querySelector("[data-graphic-adaptive]"));
    globalThis.HHGraphicDataDriven?.unmount?.(activeRoot?.querySelector("[data-graphic-data-driven]"));
    globalThis.HHGraphicComponents?.unmount?.(activeRoot?.querySelector("[data-graphic-components]"));
    globalThis.HHGraphicColorPro?.unmount?.(activeRoot?.querySelector("[data-graphic-color-pro]"));
    globalThis.HHGraphicProjectStore?.unmount?.(activeRoot?.querySelector("[data-graphic-project-store]"));
    globalThis.HHGraphicCollaboration?.unmount?.(activeRoot?.querySelector("[data-graphic-collaboration]"));
    globalThis.HHGraphicReview?.unmount?.(activeRoot?.querySelector("[data-graphic-review]"));
    globalThis.HHGraphicDevAI?.unmount?.(activeRoot?.querySelector("[data-graphic-dev-ai]"));
    globalThis.HHGraphicExportCenter?.unmount?.(activeRoot?.querySelector("[data-graphic-export-center]"));
    globalThis.HHGraphicPlugins?.unmount?.(activeRoot?.querySelector("[data-graphic-plugins]"));
    globalThis.HHGraphicPerformance?.unmount?.(activeRoot?.querySelector("[data-graphic-performance]"));
    globalThis.HHGraphicComposer?.unmount?.(activeRoot?.querySelector("[data-graphic-composer]"));
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    if (activeRoot) activeRoot.replaceChildren();
    activeRoot = null;
  }

  globalThis.HHGraphicDesign = Object.freeze({ mount, unmount, views: VIEWS.map((item) => ({ ...item })), templates: TEMPLATES.map((item) => ({ ...item })) });
})();
