(function () {
  "use strict";

  const HOME_EXPERIENCES = [
    { id: "dashboard", label: "Personal Dashboard", detail: "Widget và dữ liệu cá nhân đang có", icon: "▦", action: "dashboard", accent: "#22d3ee" },
    { id: "desktop", label: "Web Desktop", detail: "Cửa sổ AI, DEV, nhạc, ghi chú và dự án", icon: "▣", action: "desktop", accent: "#8b5cf6" },
    { id: "ai", label: "AI Universe", detail: "Chat, prompt, script và AI media", icon: "AI", route: "/chat-ai", accent: "#38bdf8" },
    { id: "projects", label: "Project Hub", detail: "Dự án, task, roadmap và tiến độ", icon: "□", route: "/work/project-center", accent: "#c084fc" },
    { id: "vault", label: "Media Vault", detail: "Media cục bộ, playlist và cloud", icon: "◇", route: "/create/media-center", accent: "#d946ef" },
    { id: "automation", label: "Automation Builder", detail: "Rule builder, dry run và lịch sử", icon: "↻", route: "/work/automation-lab", accent: "#fb923c" },
    { id: "ambient", label: "Ambient Room", detail: "20 bản Web Audio và Pomodoro", icon: "♫", action: "ambient", accent: "#34d399" },
    { id: "community", label: "Community Showcase", detail: "Bài đăng và hoạt động cộng đồng thật", icon: "◎", route: "/communication/community", accent: "#fb7185" }
  ];

  const AI_SATELLITES = [
    { label: "AI Chat", detail: "HH Intelligence", icon: "◌", route: "/chat-ai" },
    { label: "AI Center", detail: "Workspace điều phối", icon: "AI", route: "/create/ai-center" },
    { label: "Prompt Studio", detail: "Multimodal prompt", icon: "⌘", route: "/create/prompt-studio" },
    { label: "Script Generator", detail: "Kịch bản AI", icon: "▤", route: "/create/ai-script" },
    { label: "Image AI", detail: "AI Task Center", icon: "▧", route: "/media-design/ai-task-center" }
  ];

  const AUTOMATION_STEPS = [
    ["1", "IDEA INPUT", "/create/idea-lab"],
    ["2", "AI SCRIPT", "/create/ai-script"],
    ["3", "IMAGE", "/media-design/ai-task-center"],
    ["4", "VOICE", "/music-ai/vocal"],
    ["5", "MUSIC", "/music-ai"],
    ["6", "VIDEO", "/davinci-resolve/davinci"],
    ["7", "THUMBNAIL", "/davinci-resolve/image-text"],
    ["8", "SEO", "/davinci-resolve/youtube"],
    ["9", "PUBLISH", "/davinci-resolve/youtube-batch"]
  ];

  const DESKTOP_APPS = [
    { id: "ai", label: "HH AI", icon: "AI", route: "/chat-ai" },
    { id: "code", label: "Dev Studio", icon: "</>", route: "/dev-tools" },
    { id: "music", label: "Music", icon: "♫", route: "/music-ai" },
    { id: "notes", label: "Notes", icon: "▤" },
    { id: "projects", label: "Projects", icon: "□", route: "/work/project-center" },
    { id: "system", label: "System", icon: "⌁", route: "/system" }
  ];

  const AMBIENT_PRESETS = [
    { index: 0, label: "Rainy Study", detail: "piano · rain", icon: "☂" },
    { index: 1, label: "Cafe Morning", detail: "warm room tone", icon: "☕" },
    { index: 4, label: "Cozy Night", detail: "fireplace · pad", icon: "✦" },
    { index: 7, label: "Forest Cabin", detail: "wind · birds", icon: "⌂" },
    { index: 18, label: "Space Station", detail: "deep ambient", icon: "◉" },
    { index: 19, label: "Happy Focus", detail: "clean bell", icon: "◎" }
  ];

  const safeRead = (key, fallback = {}) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
  };

  const safeReadText = (key, fallback = "") => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  };

  const safeWriteText = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable. */ }
  };

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

  const setText = (node, value) => {
    const next = String(value);
    if (node && node.textContent !== next) node.textContent = next;
  };

  const capturePointer = (node, pointerId) => {
    try { node?.setPointerCapture?.(pointerId); } catch { /* Pointer capture is optional. */ }
  };

  const releasePointer = (node, pointerId) => {
    try { node?.releasePointerCapture?.(pointerId); } catch { /* Pointer capture is optional. */ }
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[character]));

  const currentRoute = () => (location.hash || "#/home").replace(/^#/, "").split("?")[0] || "/home";

  const experienceHubMarkup = () => `
    <section class="hh-experience-hub" data-hh-experience-hub aria-labelledby="hhExperienceTitle">
      <header>
        <div><small>GALAXY EXPERIENCES</small><h2 id="hhExperienceTitle">Một hệ điều hành, nhiều workspace thật</h2><p>Mỗi thẻ mở lại chức năng đang có. Dữ liệu chưa tồn tại sẽ hiển thị trạng thái rỗng thay vì số liệu minh họa.</p></div>
        <button type="button" data-command-open>⌕ Search Galaxy</button>
      </header>
      <div class="hh-experience-hub__grid">
        ${HOME_EXPERIENCES.map((item) => `<button type="button" ${item.route ? `data-app-route="${item.route}"` : `data-hh-open-experience="${item.action}"`} style="--experience-accent:${item.accent}"><i>${item.icon}</i><span><b>${item.label}</b><small>${item.detail}</small></span><em>↗</em></button>`).join("")}
      </div>
    </section>`;

  const mountHomeExperiences = () => {
    if (currentRoute() !== "/home") return;
    const home = document.querySelector(".dashboard-home");
    const map = home?.querySelector(".hh-galaxy-map");
    if (!home || !map || home.querySelector("[data-hh-experience-hub]")) return;
    map.insertAdjacentHTML("afterend", experienceHubMarkup());
  };

  const aiUniverseMarkup = () => `
    <section class="hh-ai-universe" data-hh-ai-universe aria-label="AI Universe">
      <div class="hh-ai-universe__copy"><small>GALAXY EXPLORER · AI UNIVERSE</small><h2>AI UNIVERSE</h2><p>Vũ trụ trí tuệ nhân tạo – Nơi công nghệ biến ý tưởng thành hiện thực.</p><div><button type="button" data-app-route="/chat-ai">Enter Planet</button><button type="button" data-app-route="/create/ai-center">Start Tour</button></div></div>
      <aside class="hh-ai-universe__stats" aria-label="Thống kê AI Universe"><header><span>THỐNG KÊ AI UNIVERSE</span><i>⌁</i></header><div><b>▦</b><span>Ứng dụng AI</span><strong data-hh-ai-app-count>0</strong><small>Apps</small></div><div><b>□</b><span>Dự án đang chạy</span><strong data-hh-ai-project-count>0</strong><small>Projects</small></div><div><b>◎</b><span>Workspace thật</span><strong data-hh-ai-workspace-count>0</strong><small>Workspaces</small></div></aside>
      <div class="hh-ai-universe__planet" aria-hidden="true"><span>AI</span></div>
      <div class="hh-ai-universe__satellites">${AI_SATELLITES.map((item, index) => `<button type="button" data-app-route="${item.route}" style="--satellite-index:${index}"><i>${item.icon}</i><span><b>${item.label}</b><small>${item.detail}</small></span></button>`).join("")}</div>
      <footer><span><b data-hh-ai-module-count>0</b> lối mở AI có thật</span><span><i></i> Sẵn sàng trên thiết bị</span><span>Không tạo API hoặc dữ liệu giả</span></footer>
    </section>`;

  const vaultHeroMarkup = (mode) => {
    const isMedia = mode === "media";
    return `<section class="hh-vault-hero" data-hh-vault-hero="${mode}">
      <div><small>${isMedia ? "PROJECT HUB & MEDIA VAULT" : "PROJECT HUB"}</small><h2>${isMedia ? "PROJECT HUB & MEDIA VAULT" : "PROJECT HUB"}</h2><p>${isMedia ? "Kho dự án và tài nguyên sáng tạo của bạn, kết nối trực tiếp với các workspace thật." : "Điều hành dự án, task và tiến độ trong Galaxy bằng dữ liệu đã lưu."}</p></div>
      <nav>${[
        ["All Projects", "/work/project-center", "□"],
        ["Media Vault", "/create/media-center", "◇"],
        ["Prompts", "/create/prompt-studio", "⌘"],
        ["Templates", "/create/marketplace", "▧"],
        ["Favorites", "/favorites", "☆"],
        ["Cloud Sync", "/work/cloud-storage", "☁"]
      ].map(([label, route, icon]) => `<button type="button" data-app-route="${route}"><i>${icon}</i>${label}</button>`).join("")}</nav>
      <aside><span><small>PROJECTS</small><b data-hh-real-projects>0</b></span><span><small>MEDIA</small><b data-hh-real-media>0</b></span><span><small>CLOUD STORAGE</small><b data-hh-real-storage>Đang đo</b></span></aside>
    </section>`;
  };

  const automationHeroMarkup = () => `
    <section class="hh-automation-map" data-hh-automation-map aria-label="Automation Builder">
      <header><div><small>AUTOMATION BUILDER · TỰ ĐỘNG HÓA SÁNG TẠO</small><h2>Automation Builder</h2><p>Kết nối AI, nội dung và công cụ để tạo ra sản phẩm hoàn chỉnh với một workflow tự động.</p></div><button type="button" data-hh-scroll-native>⌁ Chạy thử workflow</button></header>
      <aside class="hh-automation-library" aria-label="Thư viện template"><header><strong>THƯ VIỆN TEMPLATE</strong><button type="button" data-app-route="/create/marketplace" aria-label="Mở Creative Marketplace">＋</button></header><label>⌕ <input type="search" placeholder="Tìm template..." aria-label="Tìm template automation"></label><div><button type="button" data-app-route="/create/marketplace">YouTube AI Automation</button><button type="button" data-app-route="/create/marketplace">TikTok Viral Automation</button><button type="button" data-app-route="/create/marketplace">Podcast Automation</button><button type="button" data-app-route="/create/marketplace">Blog Content Automation</button></div></aside>
      <div>${AUTOMATION_STEPS.map(([number, label, route]) => `<button type="button" data-app-route="${route}"><i>${number}</i><b>${label}</b><small>Mở workspace</small></button>`).join("")}</div>
      <aside class="hh-automation-runtime" aria-label="Trạng thái thực thi"><header><strong>TRẠNG THÁI THỰC THI</strong><i>● Online</i></header><div class="hh-automation-runtime__ring"><b>—</b><small>Chưa chạy</small></div><p>Chạy thử hoặc mở Automation Lab để xem log và lịch sử thực thi.</p><button type="button" data-hh-scroll-native>Xem chi tiết thực thi</button></aside>
    </section>`;

  const communityHeroMarkup = () => `
    <section class="hh-community-showcase" data-hh-community-showcase>
      <div><small>COMMUNITY SHOWCASE · CỘNG ĐỒNG HH</small><h2>Cộng đồng HH</h2><p>Khám phá những dự án, tác phẩm và ý tưởng sáng tạo từ cộng đồng HH. Dữ liệu và tương tác vẫn dùng Community hiện có.</p></div>
      <nav role="tablist" aria-label="Bộ lọc Community"><button type="button" role="tab" aria-selected="true" class="is-active" data-hh-community-tab="trending">Trending</button><button type="button" role="tab" aria-selected="false" data-hh-community-tab="following">Following</button><button type="button" role="tab" aria-selected="false" data-hh-community-tab="projects">Projects</button><button type="button" role="tab" aria-selected="false" data-hh-community-tab="artworks">Artworks</button><button type="button" role="tab" aria-selected="false" data-hh-community-tab="music">Music</button><button type="button" role="tab" aria-selected="false" data-hh-community-tab="prompts">Prompts</button></nav>
      <aside class="hh-community-sidebar"><section><header><strong>FEATURED CREATOR</strong></header><div class="hh-community-creator"><i>HH</i><b>HH Community</b><small>Chia sẻ · Cộng tác · Sáng tạo</small><button type="button" data-app-route="/communication">Mở Community</button></div></section><section><header><strong>LEADERBOARD</strong></header><p>Thành tích sẽ được lấy từ dữ liệu Community khi có kết nối.</p></section></aside>
      <div class="hh-community-feed-preview" data-hh-community-feed-preview><strong>Community feed</strong><span>Đang đồng bộ bài đăng thật…</span><button type="button" data-app-route="/communication/community">Mở bảng tin đầy đủ →</button></div>
    </section>`;

  const updateRealCounts = async () => {
    const countNodes = document.querySelectorAll("[data-hh-real-projects], [data-hh-real-media], [data-hh-real-storage]");
    if (!countNodes.length) return;
    const projectState = safeRead("hh-project-center", {});
    const mediaState = safeRead("hh-media-center", {});
    const projectCount = Array.isArray(projectState.projects) ? projectState.projects.length : 0;
    const mediaCount = Array.isArray(mediaState.items) ? mediaState.items.length : 0;
    document.querySelectorAll("[data-hh-real-projects]").forEach((node) => { setText(node, projectCount); });
    document.querySelectorAll("[data-hh-real-media]").forEach((node) => { setText(node, mediaCount); });
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = Number(estimate.usage || 0);
        const label = usage >= 1073741824 ? `${(usage / 1073741824).toFixed(1)} GB` : usage >= 1048576 ? `${(usage / 1048576).toFixed(1)} MB` : `${Math.round(usage / 1024)} KB`;
        document.querySelectorAll("[data-hh-real-storage]").forEach((node) => { setText(node, label); });
      } catch {
        document.querySelectorAll("[data-hh-real-storage]").forEach((node) => { setText(node, "Không khả dụng"); });
      }
    } else {
      document.querySelectorAll("[data-hh-real-storage]").forEach((node) => { setText(node, "Không hỗ trợ"); });
    }
  };

  const mountRouteExperiences = () => {
    const route = currentRoute();
    const workspace = document.getElementById("appWorkspace");
    if (!workspace) return;
    let mounted = false;
    if (route === "/chat-ai" && !workspace.querySelector("[data-hh-ai-universe]")) { workspace.insertAdjacentHTML("afterbegin", aiUniverseMarkup()); mounted = true; }
    if (route === "/work/project-center" && !workspace.querySelector('[data-hh-vault-hero="projects"]')) { workspace.insertAdjacentHTML("afterbegin", vaultHeroMarkup("projects")); mounted = true; }
    if (route === "/create/media-center" && !workspace.querySelector('[data-hh-vault-hero="media"]')) { workspace.insertAdjacentHTML("afterbegin", vaultHeroMarkup("media")); mounted = true; }
    if (route === "/work/automation-lab" && !workspace.querySelector("[data-hh-automation-map]")) { workspace.insertAdjacentHTML("afterbegin", automationHeroMarkup()); mounted = true; }
    if ((route === "/communication" || route === "/communication/community") && !workspace.querySelector("[data-hh-community-showcase]")) { workspace.insertAdjacentHTML("afterbegin", communityHeroMarkup()); mounted = true; }
    const aiRoutes = new Set(Array.from(document.querySelectorAll("[data-app-route]"), (node) => node.getAttribute("data-app-route")).filter((value) => /(?:ai|prompt|script)/i.test(value || "")));
    document.querySelectorAll("[data-hh-ai-module-count]").forEach((node) => { setText(node, aiRoutes.size); });
    document.querySelectorAll("[data-hh-ai-app-count]").forEach((node) => { setText(node, aiRoutes.size); });
    const projectState = safeRead("hh-project-center", {});
    const projectCount = Array.isArray(projectState.projects) ? projectState.projects.length : 0;
    document.querySelectorAll("[data-hh-ai-project-count]").forEach((node) => { setText(node, projectCount); });
    document.querySelectorAll("[data-hh-ai-workspace-count]").forEach((node) => { setText(node, AI_SATELLITES.length); });
    if (mounted || workspace.querySelector("[data-hh-vault-hero]")) void updateRealCounts();
  };

  const desktopWindowMarkup = (app, index) => {
    const content = {
      ai: `<div class="hh-window__hero"><i>AI</i><strong>HH AI Copilot</strong><p>Chat, phân tích, viết và lập trình trong HH Intelligence.</p><button type="button" data-app-route="/chat-ai">Mở AI Chat thật</button></div>`,
      code: `<div class="hh-window__code"><span>HH DEV WORKSPACE</span><code>const galaxy = { routes: "real", data: "truthful" };</code><code>galaxy.open("/dev-tools");</code><button type="button" data-app-route="/dev-tools">Mở Developer Galaxy</button></div>`,
      music: `<div class="hh-window__music"><span>NOW PLAYING</span><strong data-hh-desktop-music-status>Đang đồng bộ player</strong><div><button type="button" data-hh-desktop-music-toggle>▶ / Ⅱ</button><button type="button" data-hh-desktop-music-next>Tiếp ›</button></div><button type="button" data-app-route="/music-ai">Mở Music Planet</button></div>`,
      notes: `<label class="hh-window__notes"><span>Ghi chú được lưu trên thiết bị</span><textarea data-hh-desktop-note maxlength="12000" placeholder="Viết ý tưởng, việc cần làm hoặc ghi chú nhanh..."></textarea><small data-hh-note-status role="status" aria-live="polite">Đã sẵn sàng</small></label>`,
      projects: `<div class="hh-window__projects"><span>DỰ ÁN ĐÃ LƯU</span><div data-hh-desktop-projects><p>Đang đọc Project Center…</p></div><button type="button" data-app-route="/work/project-center">Mở Project Hub</button></div>`,
      system: `<div class="hh-window__system"><article><span>KẾT NỐI</span><b data-hh-system-online>—</b></article><article><span>VIEWPORT</span><b data-hh-system-viewport>—</b></article><article><span>LOCAL DATA</span><b data-hh-system-storage>—</b></article><article><span>THỜI GIAN</span><b data-hh-system-time>—</b></article><button type="button" data-app-route="/system">Mở System Center</button></div>`
    }[app.id];
    return `<section class="hh-window" id="hhWindow-${app.id}" data-hh-window="${app.id}" role="group" aria-labelledby="hhWindowTitle-${app.id}" tabindex="-1" style="--window-index:${index};--window-x:${55 + (index % 3) * 31}px;--window-y:${38 + Math.floor(index / 3) * 260}px">
      <header data-hh-window-drag><span id="hhWindowTitle-${app.id}"><i>${app.icon}</i>${app.label}</span><div><button type="button" data-hh-window-minimize aria-label="Thu nhỏ cửa sổ ${app.label}" aria-pressed="false">—</button><button type="button" data-hh-window-maximize aria-label="Phóng to cửa sổ ${app.label}" aria-pressed="false">□</button><button type="button" data-hh-window-close aria-label="Đóng cửa sổ ${app.label}">×</button></div></header><main>${content}</main><button class="hh-window__resize" type="button" data-hh-window-resize aria-label="Kéo để thay đổi kích thước cửa sổ ${app.label}" style="position:absolute;right:0;bottom:0;z-index:5;width:20px;height:20px;padding:0;border:0;background:transparent;color:#8294b6;cursor:nwse-resize;touch-action:none">↘</button>
    </section>`;
  };

  const desktopMarkup = () => `
    <section class="hh-desktop" data-hh-desktop hidden role="dialog" aria-modal="true" aria-label="HH Web Desktop" tabindex="-1">
      <div class="hh-desktop__nebula" aria-hidden="true"></div>
      <header><div><span class="hh-desktop__logo">HH</span><strong>HH WEB DESKTOP</strong></div><button type="button" data-command-open>⌕ Search Galaxy</button><div><time data-hh-desktop-clock></time><button type="button" data-hh-overlay-close="desktop">Thoát Desktop</button></div></header>
      <main class="hh-desktop__stage">${DESKTOP_APPS.map(desktopWindowMarkup).join("")}</main>
      <footer><button type="button" data-hh-desktop-launcher aria-label="Chuyển tới thanh ứng dụng">▦</button>${DESKTOP_APPS.map((app) => `<button type="button" data-hh-desktop-app="${app.id}" aria-controls="hhWindow-${app.id}" aria-pressed="true" title="${app.label}"><i>${app.icon}</i><span>${app.label}</span></button>`).join("")}<div><span data-hh-desktop-network>Online</span><time data-hh-desktop-clock></time></div></footer>
    </section>`;

  const ambientMarkup = () => `
    <section class="hh-ambient-room" data-hh-ambient-room hidden role="dialog" aria-modal="true" aria-label="Ambient Room" tabindex="-1">
      <div class="hh-ambient-room__rain" aria-hidden="true"></div>
      <header><div><span>HH</span><strong>AMBIENT ROOM</strong></div><button type="button" data-command-open>⌕ Search Galaxy</button><button type="button" data-hh-overlay-close="ambient">Thoát Ambient Room</button></header>
      <main>
        <section class="hh-ambient-room__intro"><small>AMBIENT ROOM · PHÒNG ÂM THANH TẬP TRUNG</small><h2>Rainy Study</h2><p>Tạo không gian âm thanh lý tưởng để tập trung, thư giãn và sáng tạo bằng Web Audio hiện có.</p></section>
        <section class="hh-ambient-mixer"><header><span>MIX ÂM THANH AMBIENT</span><button type="button" data-hh-ambient-reset>Đặt lại</button></header><label>Âm lượng<input type="range" min="0" max="100" data-hh-ambient-volume></label><label>Độ sáng âm sắc<input type="range" min="0" max="100" data-hh-ambient-mood></label><div><button type="button" data-hh-ambient-toggle>▶ Phát / Tạm dừng</button><strong data-hh-ambient-status>Đang đồng bộ</strong></div></section>
        <section class="hh-ambient-presets"><span>SCENE PRESETS · WEB AUDIO THẬT</span><div>${AMBIENT_PRESETS.map((item) => `<button type="button" data-hh-ambient-track="${item.index}" aria-pressed="false"><i>${item.icon}</i><b>${item.label}</b><small>${item.detail}</small></button>`).join("")}</div></section>
        <aside class="hh-pomodoro"><header><span>POMODORO TIMER</span><button type="button" data-hh-pomodoro-reset aria-label="Đặt lại Pomodoro">↻</button></header><nav class="hh-pomodoro__modes" role="tablist" aria-label="Chế độ Pomodoro"><button type="button" role="tab" data-hh-pomodoro-mode="focus" aria-selected="true">Focus</button><button type="button" role="tab" data-hh-pomodoro-mode="short" aria-selected="false">Short Break</button><button type="button" role="tab" data-hh-pomodoro-mode="long" aria-selected="false">Long Break</button></nav><strong data-hh-pomodoro-time role="timer" aria-live="polite">25:00</strong><small data-hh-pomodoro-label>Tập trung</small><button type="button" data-hh-pomodoro-toggle aria-pressed="false">BẮT ĐẦU</button><footer>Timer lưu trạng thái cục bộ trên thiết bị</footer></aside>
      </main>
      <footer><div><span>♫</span><div><strong data-hh-ambient-status>Đang đồng bộ player</strong><small>HH Web Audio Engine</small></div></div><button type="button" data-hh-ambient-toggle>▶ / Ⅱ</button><input type="range" min="0" max="100" data-hh-ambient-volume aria-label="Âm lượng ambient"><button type="button" data-app-route="/music-ai">Mở Music Planet</button></footer>
    </section>`;

  const mountOverlays = () => {
    if (!document.querySelector("[data-hh-desktop]")) document.body.insertAdjacentHTML("beforeend", desktopMarkup());
    if (!document.querySelector("[data-hh-ambient-room]")) document.body.insertAdjacentHTML("beforeend", ambientMarkup());
    restoreDesktopState();
    hydrateDesktopData();
    syncAmbientControls();
  };

  let desktopZ = 10;
  const desktopStateKey = "hh.galaxy.desktop.v1";
  const noteKey = "hh.galaxy.desktop.notes.v1";
  const overlayFocus = new WeakMap();
  const desktopLayoutCache = new WeakMap();

  const overlayByName = (name) => name === "desktop"
    ? document.querySelector("[data-hh-desktop]")
    : name === "ambient"
      ? document.querySelector("[data-hh-ambient-room]")
      : null;

  const syncWindowButtons = (node) => {
    node?.querySelector("[data-hh-window-minimize]")?.setAttribute("aria-pressed", String(node.classList.contains("is-minimized")));
    node?.querySelector("[data-hh-window-maximize]")?.setAttribute("aria-pressed", String(node.classList.contains("is-maximized")));
  };

  const syncDesktopAppState = () => {
    document.querySelectorAll("[data-hh-desktop-app]").forEach((button) => {
      const node = Array.from(document.querySelectorAll("[data-hh-window]")).find((windowNode) => windowNode.dataset.hhWindow === button.dataset.hhDesktopApp);
      button.setAttribute("aria-pressed", String(Boolean(node && !node.hidden)));
    });
  };

  const constrainWindow = (node) => {
    const stage = node?.closest(".hh-desktop__stage");
    if (!node || !stage || node.hidden) return;
    if (matchMedia("(max-width: 800px)").matches) {
      if (!desktopLayoutCache.has(node)) {
        desktopLayoutCache.set(node, Object.fromEntries(["left", "top", "right", "bottom", "width", "height"].map((property) => [property, node.style[property]])));
      }
      ["left", "top", "right", "bottom", "width", "height"].forEach((property) => node.style.removeProperty(property));
      const resizeHandle = node.querySelector("[data-hh-window-resize]");
      if (resizeHandle) resizeHandle.hidden = true;
      return;
    }
    const cached = desktopLayoutCache.get(node);
    if (cached) {
      Object.entries(cached).forEach(([property, value]) => {
        if (value) node.style[property] = value;
      });
      desktopLayoutCache.delete(node);
    }
    const resizeHandle = node.querySelector("[data-hh-window-resize]");
    if (resizeHandle) resizeHandle.hidden = false;
    if (node.classList.contains("is-maximized") || node.classList.contains("is-minimized")) return;
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;
    const width = clamp(node.offsetWidth, 280, Math.max(280, stageRect.width));
    const height = clamp(node.offsetHeight, 170, Math.max(170, stageRect.height));
    const left = clamp(node.offsetLeft, 0, Math.max(0, stageRect.width - width));
    const top = clamp(node.offsetTop, 0, Math.max(0, stageRect.height - Math.min(height, stageRect.height)));
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  };

  function restoreDesktopState() {
    const state = safeRead(desktopStateKey, { windows: {} });
    document.querySelectorAll("[data-hh-window]").forEach((node) => {
      const saved = state.windows?.[node.dataset.hhWindow];
      if (!saved) return;
      if (Number.isFinite(saved.x)) node.style.left = `${Math.max(0, saved.x)}px`;
      if (Number.isFinite(saved.y)) node.style.top = `${Math.max(0, saved.y)}px`;
      if (Number.isFinite(saved.width)) node.style.width = `${Math.max(280, saved.width)}px`;
      if (Number.isFinite(saved.height)) node.style.height = `${Math.max(170, saved.height)}px`;
      node.hidden = saved.open === false;
      node.classList.toggle("is-minimized", Boolean(saved.minimized));
      node.classList.toggle("is-maximized", Boolean(saved.maximized));
      if (Number.isFinite(saved.z)) {
        node.style.zIndex = String(saved.z);
        desktopZ = Math.max(desktopZ, saved.z);
      }
      syncWindowButtons(node);
    });
    const note = document.querySelector("[data-hh-desktop-note]");
    if (note) note.value = safeReadText(noteKey);
    syncDesktopAppState();
  }

  function saveDesktopState() {
    const windows = {};
    document.querySelectorAll("[data-hh-window]").forEach((node) => {
      const cached = desktopLayoutCache.get(node);
      const left = cached?.left || node.style.left;
      const top = cached?.top || node.style.top;
      const width = cached?.width || node.style.width;
      const height = cached?.height || node.style.height;
      windows[node.dataset.hhWindow] = {
        x: parseFloat(left) || (cached ? null : node.offsetLeft),
        y: parseFloat(top) || (cached ? null : node.offsetTop),
        width: parseFloat(width) || (cached ? null : node.offsetWidth),
        height: parseFloat(height) || (cached ? null : node.offsetHeight),
        open: !node.hidden,
        minimized: node.classList.contains("is-minimized"),
        maximized: node.classList.contains("is-maximized"),
        z: Number(node.style.zIndex) || 0
      };
    });
    safeWrite(desktopStateKey, { windows });
  }

  const focusWindow = (node) => {
    if (!node) return;
    desktopZ += 1;
    node.style.zIndex = String(desktopZ);
  };

  const setWindowMinimized = (node, minimized) => {
    if (!node) return;
    node.classList.toggle("is-minimized", minimized);
    if (minimized) node.classList.remove("is-maximized");
    syncWindowButtons(node);
  };

  const setWindowMaximized = (node, maximized) => {
    if (!node) return;
    node.classList.toggle("is-maximized", maximized);
    if (maximized) node.classList.remove("is-minimized");
    else constrainWindow(node);
    syncWindowButtons(node);
  };

  const hydrateDesktopData = () => {
    const projectState = safeRead("hh-project-center", {});
    const projects = Array.isArray(projectState.projects) ? projectState.projects.filter((project) => project && typeof project === "object").slice(0, 4) : [];
    document.querySelectorAll("[data-hh-desktop-projects]").forEach((node) => {
      node.innerHTML = projects.length ? projects.map((project) => `<article><span>${escapeHtml(project.name || project.title || "Dự án")}</span><b>${clamp(project.progress, 0, 100)}%</b></article>`).join("") : "<p>Chưa có dự án do bạn lưu trong Project Center.</p>";
    });
  };

  const updateLiveDesktop = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    let storageCount = null;
    try { storageCount = localStorage.length; } catch { /* Storage may be unavailable. */ }
    document.querySelectorAll("[data-hh-desktop-clock], [data-hh-system-time]").forEach((node) => { setText(node, time); });
    document.querySelectorAll("[data-hh-desktop-network]").forEach((node) => { setText(node, navigator.onLine ? "Online" : "Offline"); });
    document.querySelectorAll("[data-hh-system-online]").forEach((node) => { setText(node, navigator.onLine ? "Online" : "Offline"); });
    document.querySelectorAll("[data-hh-system-viewport]").forEach((node) => { setText(node, `${innerWidth}×${innerHeight}`); });
    document.querySelectorAll("[data-hh-system-storage]").forEach((node) => { setText(node, storageCount === null ? "Không khả dụng" : `${storageCount} khóa`); });
    const sourceStatus = document.getElementById("musicStatus")?.textContent?.trim() || "Đang tắt";
    document.querySelectorAll("[data-hh-desktop-music-status]").forEach((node) => { setText(node, sourceStatus); });
  };

  const openOverlay = (name) => {
    const overlay = overlayByName(name);
    if (!overlay) return;
    const other = overlayByName(name === "desktop" ? "ambient" : "desktop");
    if (other && !other.hidden) other.hidden = true;
    overlayFocus.set(overlay, document.activeElement instanceof HTMLElement ? document.activeElement : null);
    overlay.hidden = false;
    document.body.classList.add("hh-overlay-open");
    if (name === "desktop") {
      hydrateDesktopData();
      requestAnimationFrame(() => document.querySelectorAll("[data-hh-window]").forEach(constrainWindow));
    }
    if (name === "ambient") syncAmbientControls();
    requestAnimationFrame(() => overlay.focus({ preventScroll: true }));
  };

  const closeOverlay = (name) => {
    const overlay = overlayByName(name);
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (!document.querySelector("[data-hh-desktop]:not([hidden]), [data-hh-ambient-room]:not([hidden])")) document.body.classList.remove("hh-overlay-open");
    if (name === "desktop") saveDesktopState();
    const returnFocus = overlayFocus.get(overlay);
    if (returnFocus) requestAnimationFrame(() => { if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true }); });
  };

  const syncAmbientControls = () => {
    const sourceVolume = document.getElementById("musicVolume");
    const sourceMood = document.getElementById("musicMood");
    const sourceStatus = document.getElementById("musicStatus")?.textContent?.trim() || "Đang tắt";
    document.querySelectorAll("[data-hh-ambient-volume]").forEach((node) => { if (sourceVolume && node !== document.activeElement) node.value = String(clamp(sourceVolume.value, 0, 100)); });
    document.querySelectorAll("[data-hh-ambient-mood]").forEach((node) => { if (sourceMood && node !== document.activeElement) node.value = String(clamp(sourceMood.value, 0, 100)); });
    document.querySelectorAll("[data-hh-ambient-status]").forEach((node) => { setText(node, sourceStatus); });
    const activeTrack = clamp(safeReadText("hoangdaika13-track", "0"), 0, 19);
    const playing = document.getElementById("musicToggle")?.textContent?.trim() === "Tạm dừng";
    document.querySelectorAll("[data-hh-ambient-toggle]").forEach((node) => { node.setAttribute("aria-pressed", String(playing)); });
    document.querySelectorAll("[data-hh-ambient-track]").forEach((node) => {
      const active = Number(node.dataset.hhAmbientTrack) === activeTrack;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
    });
  };

  const pomodoroKey = "hh.galaxy.pomodoro.v1";
  const POMODORO_MODES = {
    focus: { seconds: 1500, label: "Tập trung" },
    short: { seconds: 300, label: "Nghỉ ngắn" },
    long: { seconds: 900, label: "Nghỉ dài" }
  };
  const normalizePomodoro = (value) => ({
    mode: Object.prototype.hasOwnProperty.call(POMODORO_MODES, value?.mode) ? value.mode : "focus",
    seconds: clamp(value?.seconds ?? POMODORO_MODES[Object.prototype.hasOwnProperty.call(POMODORO_MODES, value?.mode) ? value.mode : "focus"].seconds, 0, 86400),
    running: Boolean(value?.running && Number(value?.endAt) > 0),
    endAt: Math.max(0, Number(value?.endAt) || 0)
  });
  let pomodoro = normalizePomodoro(safeRead(pomodoroKey, { mode: "focus", seconds: 1500, running: false, endAt: 0 }));
  const pomodoroSeconds = () => pomodoro.running ? Math.max(0, Math.ceil((pomodoro.endAt - Date.now()) / 1000)) : pomodoro.seconds;
  const updatePomodoro = () => {
    let remaining = pomodoroSeconds();
    if (pomodoro.running && !remaining) {
      pomodoro = { mode: pomodoro.mode, seconds: 0, running: false, endAt: 0 };
      safeWrite(pomodoroKey, pomodoro);
    }
    remaining = pomodoroSeconds();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    document.querySelectorAll("[data-hh-pomodoro-time]").forEach((node) => { setText(node, `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`); });
    document.querySelectorAll("[data-hh-pomodoro-label]").forEach((node) => { setText(node, remaining ? POMODORO_MODES[pomodoro.mode].label : "Đã hoàn tất"); });
    document.querySelectorAll("[data-hh-pomodoro-mode]").forEach((node) => {
      const active = node.dataset.hhPomodoroMode === pomodoro.mode;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-hh-pomodoro-toggle]").forEach((node) => {
      setText(node, pomodoro.running ? "TẠM DỪNG" : remaining > 0 && remaining < POMODORO_MODES[pomodoro.mode].seconds ? "TIẾP TỤC" : "BẮT ĐẦU");
      node.setAttribute("aria-pressed", String(pomodoro.running));
    });
  };

  let mountFrame = 0;
  const scheduleMount = () => {
    if (mountFrame) return;
    mountFrame = requestAnimationFrame(() => {
      mountFrame = 0;
      mountHomeExperiences();
      mountRouteExperiences();
    });
  };

  const bindInteractions = () => {
    document.addEventListener("click", (event) => {
      const experience = event.target.closest("[data-hh-open-experience]");
      if (experience?.dataset.hhOpenExperience === "desktop") openOverlay("desktop");
      if (experience?.dataset.hhOpenExperience === "ambient") openOverlay("ambient");
      if (experience?.dataset.hhOpenExperience === "dashboard") document.getElementById("homeGalaxyCommandRoot")?.scrollIntoView({ behavior: "smooth", block: "start" });

      const close = event.target.closest("[data-hh-overlay-close]");
      if (close) closeOverlay(close.dataset.hhOverlayClose);

      const appButton = event.target.closest("[data-hh-desktop-app]");
      if (appButton) {
        const node = Array.from(document.querySelectorAll("[data-hh-window]")).find((windowNode) => windowNode.dataset.hhWindow === appButton.dataset.hhDesktopApp);
        if (node) {
          node.hidden = false;
          setWindowMinimized(node, false);
          focusWindow(node);
          constrainWindow(node);
          syncDesktopAppState();
          saveDesktopState();
          node.focus({ preventScroll: true });
        }
      }

      if (event.target.closest("[data-hh-desktop-launcher]")) document.querySelector("[data-hh-desktop-app]")?.focus({ preventScroll: true });

      const windowNode = event.target.closest("[data-hh-window]");
      if (windowNode) focusWindow(windowNode);
      if (event.target.closest("[data-hh-window-minimize]")) { setWindowMinimized(windowNode, !windowNode?.classList.contains("is-minimized")); saveDesktopState(); }
      if (event.target.closest("[data-hh-window-maximize]")) { setWindowMaximized(windowNode, !windowNode?.classList.contains("is-maximized")); saveDesktopState(); }
      if (event.target.closest("[data-hh-window-close]")) { if (windowNode) windowNode.hidden = true; syncDesktopAppState(); saveDesktopState(); }

      if (event.target.closest("[data-hh-desktop-music-toggle], [data-hh-ambient-toggle]")) { document.getElementById("musicToggle")?.click(); setTimeout(() => { syncAmbientControls(); updateLiveDesktop(); }, 100); }
      if (event.target.closest("[data-hh-desktop-music-next]")) { document.getElementById("musicNext")?.click(); setTimeout(updateLiveDesktop, 100); }

      const track = event.target.closest("[data-hh-ambient-track]");
      if (track) {
        const index = clamp(track.dataset.hhAmbientTrack, 0, 19);
        Array.from(document.querySelectorAll(".track-button[data-track]")).find((button) => Number(button.dataset.track) === index)?.click();
        setTimeout(syncAmbientControls, 100);
      }
      if (event.target.closest("[data-hh-ambient-reset]")) {
        const volume = document.getElementById("musicVolume");
        const mood = document.getElementById("musicMood");
        if (volume) { volume.value = volume.defaultValue || volume.value; volume.dispatchEvent(new Event("input", { bubbles: true })); }
        if (mood) { mood.value = mood.defaultValue || mood.value; mood.dispatchEvent(new Event("input", { bubbles: true })); }
        syncAmbientControls();
      }

      if (event.target.closest("[data-hh-pomodoro-toggle]")) {
        if (pomodoro.running) {
          pomodoro = { mode: pomodoro.mode, seconds: pomodoroSeconds(), running: false, endAt: 0 };
        } else {
          const seconds = pomodoro.seconds > 0 ? pomodoro.seconds : POMODORO_MODES[pomodoro.mode].seconds;
          pomodoro = { mode: pomodoro.mode, seconds, running: true, endAt: Date.now() + seconds * 1000 };
        }
        safeWrite(pomodoroKey, pomodoro);
        updatePomodoro();
      }
      const pomodoroMode = event.target.closest("[data-hh-pomodoro-mode]");
      if (pomodoroMode && POMODORO_MODES[pomodoroMode.dataset.hhPomodoroMode]) {
        const mode = pomodoroMode.dataset.hhPomodoroMode;
        pomodoro = { mode, seconds: POMODORO_MODES[mode].seconds, running: false, endAt: 0 };
        safeWrite(pomodoroKey, pomodoro);
        updatePomodoro();
      }
      if (event.target.closest("[data-hh-pomodoro-reset]")) { pomodoro = { mode: pomodoro.mode, seconds: POMODORO_MODES[pomodoro.mode].seconds, running: false, endAt: 0 }; safeWrite(pomodoroKey, pomodoro); updatePomodoro(); }
      const communityTab = event.target.closest("[data-hh-community-tab]");
      if (communityTab) {
        const showcase = communityTab.closest("[data-hh-community-showcase]");
        showcase?.querySelectorAll("[data-hh-community-tab]").forEach((node) => {
          const active = node === communityTab;
          node.classList.toggle("is-active", active);
          node.setAttribute("aria-selected", String(active));
        });
        const preview = showcase?.querySelector("[data-hh-community-feed-preview] span");
        if (preview) setText(preview, `${communityTab.textContent.trim()} · dữ liệu sẽ lấy từ Community hiện có`);
      }
      if (event.target.closest("[data-hh-scroll-native]")) document.querySelector("[data-hh-automation-map]")?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });

      if (event.target.closest("[data-app-route]")) {
        const desktop = document.querySelector("[data-hh-desktop]:not([hidden])");
        const ambient = document.querySelector("[data-hh-ambient-room]:not([hidden])");
        if (desktop) closeOverlay("desktop");
        if (ambient) closeOverlay("ambient");
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches("[data-hh-desktop-note]")) {
        safeWriteText(noteKey, event.target.value);
        const status = document.querySelector("[data-hh-note-status]");
        if (status) setText(status, `Đã lưu ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
      }
      const map = [["data-hh-ambient-volume", "musicVolume"], ["data-hh-ambient-mood", "musicMood"]];
      map.forEach(([attribute, id]) => {
        if (!event.target.hasAttribute(attribute)) return;
        const source = document.getElementById(id);
        if (source) { source.value = event.target.value; source.dispatchEvent(new Event("input", { bubbles: true })); }
        document.querySelectorAll(`[${attribute}]`).forEach((node) => { if (node !== event.target) node.value = event.target.value; });
      });
    });

    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const resizeHandle = event.target.closest("[data-hh-window-resize]");
      const resizeNode = resizeHandle?.closest("[data-hh-window]");
      if (resizeNode && !matchMedia("(max-width: 800px)").matches && !resizeNode.classList.contains("is-maximized")) {
        event.preventDefault();
        focusWindow(resizeNode);
        const stage = resizeNode.closest(".hh-desktop__stage");
        const stageRect = stage?.getBoundingClientRect();
        const startRect = resizeNode.getBoundingClientRect();
        if (!stageRect) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        capturePointer(resizeHandle, pointerId);
        const move = (moveEvent) => {
          if (moveEvent.pointerId !== pointerId) return;
          const maximumWidth = Math.max(280, stageRect.right - startRect.left);
          const maximumHeight = Math.max(170, stageRect.bottom - startRect.top);
          resizeNode.style.width = `${clamp(startRect.width + moveEvent.clientX - startX, 280, maximumWidth)}px`;
          resizeNode.style.height = `${clamp(startRect.height + moveEvent.clientY - startY, 170, maximumHeight)}px`;
        };
        const end = (endEvent) => {
          if (endEvent.pointerId !== pointerId) return;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          releasePointer(resizeHandle, pointerId);
          constrainWindow(resizeNode);
          saveDesktopState();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        return;
      }

      const handle = event.target.closest("[data-hh-window-drag]");
      const node = handle?.closest("[data-hh-window]");
      if (!node || event.target.closest("button") || matchMedia("(max-width: 800px)").matches || node.classList.contains("is-maximized")) return;
      event.preventDefault();
      focusWindow(node);
      const rect = node.getBoundingClientRect();
      const desktopRect = node.closest(".hh-desktop__stage")?.getBoundingClientRect();
      if (!desktopRect) return;
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const pointerId = event.pointerId;
      capturePointer(handle, pointerId);
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        node.style.left = `${clamp(moveEvent.clientX - desktopRect.left - offsetX, 0, Math.max(0, desktopRect.width - node.offsetWidth))}px`;
        node.style.top = `${clamp(moveEvent.clientY - desktopRect.top - offsetY, 0, Math.max(0, desktopRect.height - node.offsetHeight))}px`;
      };
      const up = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        releasePointer(handle, pointerId);
        constrainWindow(node);
        saveDesktopState();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });

    window.addEventListener("hashchange", scheduleMount);
    window.addEventListener("resize", () => {
      updateLiveDesktop();
      document.querySelectorAll("[data-hh-window]").forEach(constrainWindow);
    });
    window.addEventListener("online", updateLiveDesktop);
    window.addEventListener("offline", updateLiveDesktop);
    window.addEventListener("storage", (event) => {
      if (event.key === "hh-project-center") { hydrateDesktopData(); void updateRealCounts(); }
      if (event.key === noteKey) {
        const note = document.querySelector("[data-hh-desktop-note]");
        if (note && note !== document.activeElement) note.value = safeReadText(noteKey);
      }
      if (["hoangdaika13-track", "hoangdaika13-volume", "hoangdaika13-mood"].includes(event.key)) syncAmbientControls();
      if (event.key === pomodoroKey) { pomodoro = normalizePomodoro(safeRead(pomodoroKey, pomodoro)); updatePomodoro(); }
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { updatePomodoro(); updateLiveDesktop(); syncAmbientControls(); } });
    document.addEventListener("keydown", (event) => {
      const activeOverlay = document.querySelector("[data-hh-ambient-room]:not([hidden]), [data-hh-desktop]:not([hidden])");
      if (!activeOverlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay(activeOverlay.hasAttribute("data-hh-ambient-room") ? "ambient" : "desktop");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(activeOverlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true" && (node.offsetWidth || node.offsetHeight));
      if (!focusable.length) { event.preventDefault(); activeOverlay.focus({ preventScroll: true }); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === activeOverlay || !activeOverlay.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  };

  const init = () => {
    if (document.documentElement.dataset.hhGalaxyExperiencesReady === "true") return;
    document.documentElement.dataset.hhGalaxyExperiencesReady = "true";
    mountOverlays();
    mountHomeExperiences();
    mountRouteExperiences();
    bindInteractions();
    updatePomodoro();
    updateLiveDesktop();
    setInterval(updatePomodoro, 1000);
    setInterval(() => {
      if (document.querySelector("[data-hh-desktop]:not([hidden]), [data-hh-ambient-room]:not([hidden])")) {
        updateLiveDesktop();
        syncAmbientControls();
      }
    }, 15000);
    const workspace = document.getElementById("appWorkspace");
    if (workspace) new MutationObserver(scheduleMount).observe(workspace, { childList: true });
    const musicStatus = document.getElementById("musicStatus");
    if (musicStatus) new MutationObserver(() => { syncAmbientControls(); updateLiveDesktop(); }).observe(musicStatus, { childList: true, subtree: true, characterData: true });
    if ("ResizeObserver" in window) {
      let resizeSaveTimer = 0;
      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries.some(({ target }) => !target.hidden && !target.classList.contains("is-maximized") && !target.classList.contains("is-minimized"))) return;
        clearTimeout(resizeSaveTimer);
        resizeSaveTimer = setTimeout(saveDesktopState, 180);
      });
      document.querySelectorAll("[data-hh-window]").forEach((node) => resizeObserver.observe(node));
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
