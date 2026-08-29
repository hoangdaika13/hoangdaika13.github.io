(function () {
  "use strict";

  const GALAXY_NAV = [
    { id: "home", label: "Home Galaxy", route: "/home", icon: "⌂", accent: "#8b5cf6", match: ["/home"] },
    { id: "ai", label: "AI Universe", route: "/chat-ai", icon: "AI", accent: "#22d3ee", match: ["/chat-ai"] },
    { id: "music", label: "Music Planet", route: "/music-ai", icon: "♫", accent: "#d946ef", match: ["/music-ai", "/music"] },
    { id: "video", label: "Video Planet", route: "/davinci-resolve", icon: "▶", accent: "#fb7185", match: ["/davinci-resolve", "/cinema", "/youtube"] },
    { id: "creator", label: "Creator Studio", route: "/create", icon: "✦", accent: "#c084fc", match: ["/create", "/draw", "/media-design", "/graphic-design"] },
    { id: "games", label: "Games World", route: "/play", icon: "◆", accent: "#a3e635", match: ["/play", "/game"] },
    { id: "dev", label: "Dev Planet", route: "/dev-tools", icon: "⌘", accent: "#38bdf8", match: ["/dev-tools"] },
    { id: "learning", label: "Learning Star", route: "/learn", icon: "◫", accent: "#fbbf24", match: ["/learn", "/english", "/japanese", "/chinese", "/phat-phap"] },
    { id: "community", label: "Community", route: "/communication", icon: "◎", accent: "#34d399", match: ["/communication", "/discord", "/social-media-tools"] },
    { id: "tools", label: "Tools Galaxy", route: "/tools", icon: "◇", accent: "#60a5fa", match: ["/tools"] },
    { id: "analytics", label: "Analytics", route: "/analytics", icon: "↗", accent: "#fb923c", match: ["/analytics"] },
    { id: "settings", label: "Settings", route: "/settings", icon: "⚙", accent: "#a78bfa", match: ["/settings", "/system"] }
  ];

  const PLANETS = [
    { label: "AI Universe", detail: "Chat AI · Prompt · Intelligence", route: "/chat-ai", icon: "AI", accent: "#22d3ee", x: 39, y: 24 },
    { label: "Music Planet", detail: "Studio · Mix · Publish", route: "/music-ai", icon: "♫", accent: "#60a5fa", x: 58, y: 17 },
    { label: "Video Planet", detail: "Edit · Batch · YouTube", route: "/davinci-resolve", icon: "▶", accent: "#fb7185", x: 78, y: 27 },
    { label: "Creator Studio", detail: "Idea · Script · Media", route: "/create", icon: "✦", accent: "#c084fc", x: 84, y: 48 },
    { label: "Games World", detail: "Play · EonWild · Party", route: "/play", icon: "◆", accent: "#a3e635", x: 78, y: 68 },
    { label: "Dev Planet", detail: "Code · API · Delivery", route: "/dev-tools", icon: "⌘", accent: "#38bdf8", x: 62, y: 78 },
    { label: "Learning Star", detail: "School · Languages · Library", route: "/learn", icon: "◫", accent: "#fbbf24", x: 43, y: 78 },
    { label: "Community", detail: "Messages · Rooms · Spaces", route: "/communication", icon: "◎", accent: "#34d399", x: 27, y: 65 },
    { label: "Tools Galaxy", detail: "Professional utilities", route: "/tools", icon: "◇", accent: "#a78bfa", x: 28, y: 43 }
  ];

  const PIPELINE = [
    { label: "IDEA", detail: "Ý tưởng", route: "/create", icon: "1", accent: "#fbbf24" },
    { label: "SCRIPT", detail: "Kịch bản AI", route: "/create/ai-script", icon: "2", accent: "#d946ef" },
    { label: "IMAGE", detail: "Hình ảnh", route: "/media-design", icon: "3", accent: "#60a5fa" },
    { label: "VOICE", detail: "Giọng đọc", route: "/music-ai/vocal", icon: "4", accent: "#fb7185" },
    { label: "MUSIC", detail: "Âm nhạc", route: "/music-ai", icon: "5", accent: "#c084fc" },
    { label: "VIDEO", detail: "Biên tập", route: "/davinci-resolve/davinci", icon: "6", accent: "#22d3ee" },
    { label: "THUMBNAIL", detail: "Ảnh bìa", route: "/davinci-resolve/image-text", icon: "7", accent: "#fb923c" },
    { label: "SEO", detail: "Tối ưu", route: "/davinci-resolve/youtube", icon: "8", accent: "#34d399" },
    { label: "PUBLISH", detail: "Xuất bản", route: "/davinci-resolve/youtube-batch", icon: "9", accent: "#a78bfa" }
  ];

  const safeJsonArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const currentRoute = () => (location.hash || "#/home").replace(/^#/, "").split("?")[0] || "/home";

  const routeMatches = (route, prefixes) => prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));

  const setGalaxyIdentity = () => {
    document.body.classList.add("hh-galaxy-os");
    document.documentElement.dataset.hhExperience = "galaxy-os";
    document.title = "HH Universe · Galaxy OS";
    const appBrand = document.querySelector(".app-brand strong");
    if (appBrand) appBrand.textContent = "HH UNIVERSE";
    const pageEyebrow = document.querySelector(".app-page-header__eyebrow");
    if (pageEyebrow) pageEyebrow.textContent = "HH GALAXY OS";
    const shell = document.getElementById("appShell");
    if (shell) shell.setAttribute("aria-label", "HH Universe Galaxy OS workspace");
  };

  const mountGalaxyNavigation = () => {
    const host = document.querySelector("[data-app-navigation]");
    if (!host || host.querySelector(".hh-galaxy-nav")) return;

    const nav = document.createElement("section");
    nav.className = "hh-galaxy-nav";
    nav.setAttribute("aria-label", "Không gian HH Universe");
    nav.innerHTML = `
      <div class="hh-galaxy-nav__label"><span>Không gian HH</span></div>
      ${GALAXY_NAV.map((item) => `
        <button type="button" data-app-route="${item.route}" data-hh-galaxy-nav="${item.id}" style="--nav-accent:${item.accent}">
          <span class="hh-galaxy-nav__icon" aria-hidden="true">${item.icon}</span>
          <b>${item.label}</b>
          <small>›</small>
        </button>`).join("")}`;
    host.prepend(nav);
    updateGalaxyNavigation();
  };

  const updateGalaxyNavigation = () => {
    const route = currentRoute();
    document.querySelectorAll("[data-hh-galaxy-nav]").forEach((button) => {
      const config = GALAXY_NAV.find((item) => item.id === button.dataset.hhGalaxyNav);
      const active = Boolean(config && routeMatches(route, config.match));
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  };

  const galaxyMapMarkup = () => `
    <section class="hh-galaxy-map" aria-labelledby="hhGalaxyMapTitle">
      <div class="hh-galaxy-map__topline"><span>HH GALAXY MAP</span><b><i></i> LIVE WORKSPACE</b></div>
      <div class="hh-galaxy-map__copy">
        <small>FUTURISTIC PERSONAL DIGITAL UNIVERSE</small>
        <h2 id="hhGalaxyMapTitle">Khám phá vũ trụ số của bạn</h2>
        <p>Mọi hành tinh đều mở một workspace thật đang có trong HH Platform. Không dữ liệu minh họa, không module trùng lặp.</p>
        <nav aria-label="Thao tác nhanh Galaxy">
          <button type="button" data-app-route="/chat-ai">Mở HH AI Copilot</button>
          <button type="button" data-command-open>Tìm trong Galaxy</button>
        </nav>
      </div>
      <i class="hh-galaxy-orbit hh-galaxy-orbit--1" aria-hidden="true"></i>
      <i class="hh-galaxy-orbit hh-galaxy-orbit--2" aria-hidden="true"></i>
      <i class="hh-galaxy-orbit hh-galaxy-orbit--3" aria-hidden="true"></i>
      <button class="hh-core" type="button" data-app-route="/home" aria-label="HH Core · Mở Home Galaxy">
        <span><strong>HH</strong><small>UNIVERSE CORE</small></span>
      </button>
      <div class="hh-galaxy-map__planets">
        ${PLANETS.map((planet) => `
          <button class="hh-planet" type="button" data-app-route="${planet.route}" style="--planet-x:${planet.x}%;--planet-y:${planet.y}%;--planet-accent:${planet.accent}">
            <span class="hh-planet__body"><i>${planet.icon}</i></span>
            <span class="hh-planet__copy"><strong>${planet.label}</strong><small>${planet.detail}</small></span>
          </button>`).join("")}
      </div>
      <div class="hh-galaxy-map__telemetry" aria-label="Trạng thái Galaxy">
        <div><span>MODULE REGISTRY</span><strong data-hh-module-count>Đang đồng bộ</strong></div>
        <div><span>ROUTE KHẢ DỤNG</span><strong data-hh-route-count>Đang quét</strong></div>
        <div><span>YÊU THÍCH CỦA BẠN</span><strong data-hh-favorite-count>0 mục</strong></div>
        <div><span>TRẠNG THÁI</span><strong><i></i><span data-hh-online-state>Đang kiểm tra</span></strong></div>
      </div>
    </section>`;

  const updateGalaxyTelemetry = () => {
    const moduleCount = Array.isArray(window.HH_PLATFORM_MODULES) ? window.HH_PLATFORM_MODULES.length : 0;
    const routes = new Set(
      Array.from(document.querySelectorAll("[data-app-route]"))
        .map((node) => node.getAttribute("data-app-route"))
        .filter(Boolean)
    );
    const favorites = safeJsonArray("hh-module-favorites");
    document.querySelectorAll("[data-hh-module-count]").forEach((node) => {
      node.textContent = moduleCount ? `${moduleCount} module thật` : "Đang tải registry";
    });
    document.querySelectorAll("[data-hh-route-count]").forEach((node) => {
      node.textContent = `${routes.size} lối mở hiện có`;
    });
    document.querySelectorAll("[data-hh-favorite-count]").forEach((node) => {
      node.textContent = `${favorites.length} mục`;
    });
    document.querySelectorAll("[data-hh-online-state]").forEach((node) => {
      node.textContent = navigator.onLine ? "Online" : "Offline";
    });
  };

  const mountGalaxyHome = () => {
    const home = document.querySelector(".dashboard-home");
    if (!home || home.querySelector(".hh-galaxy-map")) return;
    home.insertAdjacentHTML("afterbegin", galaxyMapMarkup());
    updateGalaxyTelemetry();
  };

  const pipelineMarkup = () => `
    <section class="hh-creator-pipeline" data-hh-creator-pipeline aria-label="Creator Pipeline">
      <header>
        <div><small>CREATOR PIPELINE</small><strong>Quy trình sáng tạo liên kết công cụ thật</strong></div>
        <span>Chọn một bước để mở workspace tương ứng</span>
      </header>
      <div class="hh-creator-pipeline__steps">
        ${PIPELINE.map((step) => `
          <button type="button" data-app-route="${step.route}" style="--step-accent:${step.accent}">
            <i>${step.icon}</i><b>${step.label}</b><small>${step.detail}</small>
          </button>`).join("")}
      </div>
    </section>`;

  const mountCreatorPipeline = () => {
    const route = currentRoute();
    if (!(route === "/create" || route.startsWith("/create/"))) return;
    const workspace = document.getElementById("appWorkspace");
    if (!workspace || workspace.querySelector("[data-hh-creator-pipeline]")) return;
    workspace.insertAdjacentHTML("afterbegin", pipelineMarkup());
  };

  const copilotMarkup = () => `
    <aside class="hh-ai-orb" data-hh-ai-orb aria-label="HH AI Copilot">
      <button class="hh-ai-orb__toggle" type="button" data-hh-ai-toggle aria-expanded="false" aria-label="Mở HH AI Copilot">HH</button>
      <section class="hh-ai-orb__panel" aria-hidden="true">
        <header><div><small>HH AI COPILOT · ONLINE</small><strong>Tôi có thể giúp gì cho bạn?</strong></div><button type="button" data-hh-ai-close aria-label="Đóng Copilot">×</button></header>
        <div class="hh-ai-orb__actions">
          <button type="button" data-app-route="/chat-ai"><i>◌</i><b>Hỏi đáp nhanh</b><small>Mở Chat AI hiện có</small></button>
          <button type="button" data-app-route="/work/projects-tasks"><i>□</i><b>Tạo project</b><small>Projects & Tasks</small></button>
          <button type="button" data-command-open><i>⌕</i><b>Tìm tool / app</b><small>Search Galaxy</small></button>
          <button type="button" data-app-route="/work/automation-lab"><i>↻</i><b>Tự động hóa</b><small>Automation Lab</small></button>
          <button type="button" data-app-route="/analytics"><i>↗</i><b>Phân tích</b><small>Dữ liệu hoạt động thật</small></button>
          <button type="button" data-app-route="/home"><i>✦</i><b>Gợi ý hôm nay</b><small>Dashboard cá nhân</small></button>
        </div>
      </section>
    </aside>`;

  const musicDockMarkup = () => `
    <section class="hh-music-dock" data-hh-music-dock aria-label="Global Music Player">
      <div class="hh-music-dock__track"><span class="hh-music-dock__art">HH</span><div><strong data-hh-music-title>Music Planet</strong><small data-hh-music-status>Âm thanh chỉ phát khi bạn chủ động</small></div></div>
      <div class="hh-music-dock__controls">
        <button type="button" data-app-route="/music-ai" aria-label="Mở Music Planet">‹</button>
        <button type="button" data-hh-music-toggle aria-label="Phát hoặc tạm dừng">▶</button>
        <button type="button" data-hh-music-next aria-label="Bài tiếp theo">›</button>
      </div>
      <div class="hh-music-dock__volume"><span>Âm lượng</span><input type="range" min="0" max="100" value="48" data-hh-music-volume aria-label="Âm lượng nhạc"><button type="button" data-app-route="/music-ai">Mở Studio</button></div>
    </section>`;

  const syncMusicDock = () => {
    const sourceStatus = document.getElementById("musicStatus");
    const sourceToggle = document.getElementById("musicToggle");
    const dockStatus = document.querySelector("[data-hh-music-status]");
    const dockToggle = document.querySelector("[data-hh-music-toggle]");
    if (dockStatus && sourceStatus?.textContent?.trim()) dockStatus.textContent = sourceStatus.textContent.trim();
    if (dockToggle && sourceToggle?.textContent?.trim()) dockToggle.textContent = sourceToggle.textContent.trim().slice(0, 2);
  };

  const mountGlobalControls = () => {
    const shell = document.getElementById("appShell");
    if (!shell) return;
    if (!document.querySelector("[data-hh-ai-orb]")) document.body.insertAdjacentHTML("beforeend", copilotMarkup());
    if (!document.querySelector("[data-hh-music-dock]")) document.body.insertAdjacentHTML("beforeend", musicDockMarkup());

    const orb = document.querySelector("[data-hh-ai-orb]");
    const panel = orb?.querySelector(".hh-ai-orb__panel");
    const toggle = orb?.querySelector("[data-hh-ai-toggle]");
    const closeCopilot = () => {
      if (!orb || !panel || !toggle) return;
      orb.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle?.addEventListener("click", () => {
      const open = !orb.classList.contains("is-open");
      orb.classList.toggle("is-open", open);
      panel?.setAttribute("aria-hidden", String(!open));
      toggle.setAttribute("aria-expanded", String(open));
    });
    orb?.querySelector("[data-hh-ai-close]")?.addEventListener("click", closeCopilot);
    orb?.querySelector(".hh-ai-orb__actions")?.addEventListener("click", (event) => {
      if (event.target.closest("button")) closeCopilot();
    });

    document.querySelector("[data-hh-music-toggle]")?.addEventListener("click", () => {
      const source = document.getElementById("musicToggle");
      if (source) source.click();
      else location.hash = "#/music-ai";
      window.setTimeout(syncMusicDock, 80);
    });
    document.querySelector("[data-hh-music-next]")?.addEventListener("click", () => {
      const source = document.getElementById("musicNext");
      if (source) source.click();
      else location.hash = "#/music-ai";
      window.setTimeout(syncMusicDock, 80);
    });
    document.querySelector("[data-hh-music-volume]")?.addEventListener("input", (event) => {
      const source = document.getElementById("musicVolume");
      if (!source) return;
      source.value = event.target.value;
      source.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const sourceStatus = document.getElementById("musicStatus");
    if (sourceStatus) new MutationObserver(syncMusicDock).observe(sourceStatus, { childList: true, subtree: true, characterData: true });
    syncMusicDock();
  };

  const mountRouteEnhancements = () => {
    setGalaxyIdentity();
    mountGalaxyNavigation();
    updateGalaxyNavigation();
    mountGalaxyHome();
    mountCreatorPipeline();
    updateGalaxyTelemetry();
  };

  const scheduleRouteEnhancements = () => {
    window.requestAnimationFrame(() => {
      mountRouteEnhancements();
      window.setTimeout(mountRouteEnhancements, 120);
      window.setTimeout(mountRouteEnhancements, 520);
    });
  };

  const init = () => {
    setGalaxyIdentity();
    mountGalaxyHome();
    mountGalaxyNavigation();
    mountGlobalControls();
    mountCreatorPipeline();
    updateGalaxyTelemetry();

    const navigationHost = document.querySelector("[data-app-navigation]");
    if (navigationHost) {
      new MutationObserver(() => {
        if (!navigationHost.querySelector(".hh-galaxy-nav")) mountGalaxyNavigation();
        updateGalaxyNavigation();
      }).observe(navigationHost, { childList: true });
    }

    const workspace = document.getElementById("appWorkspace");
    if (workspace) {
      new MutationObserver(() => {
        const route = currentRoute();
        const galaxyHomeMissing = route === "/home" && !workspace.querySelector(".hh-galaxy-map");
        const pipelineMissing = (route === "/create" || route.startsWith("/create/"))
          && !workspace.querySelector("[data-hh-creator-pipeline]");
        if (galaxyHomeMissing || pipelineMissing) scheduleRouteEnhancements();
      }).observe(workspace, { childList: true, subtree: true });
    }

    window.addEventListener("hashchange", scheduleRouteEnhancements);
    window.addEventListener("online", updateGalaxyTelemetry);
    window.addEventListener("offline", updateGalaxyTelemetry);
    window.addEventListener("hh:modules-ready", updateGalaxyTelemetry);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const orb = document.querySelector("[data-hh-ai-orb]");
        orb?.classList.remove("is-open");
        orb?.querySelector(".hh-ai-orb__panel")?.setAttribute("aria-hidden", "true");
        orb?.querySelector("[data-hh-ai-toggle]")?.setAttribute("aria-expanded", "false");
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
