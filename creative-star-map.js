(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHCreativeStarMap = api;
  if (global?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createCreativeStarMap(global) {
  "use strict";

  const VERSION = "1.0.0";
  const PREF_KEY = "hh.creative.star-map.v1";
  const HOME_PREF_KEY = "hh.home.galaxy.preferences.v2";
  const CORE_KEY = "hh.creative-os.v1";

  const GROUPS = Object.freeze([
    { id: "command", label: "Điều hành", icon: "CC", color: "#5eefff", tools: ["overview", "project"] },
    { id: "idea", label: "Ý tưởng AI", icon: "AI", color: "#ff59d5", tools: ["ai-center", "ai-script"] },
    { id: "preproduction", label: "Tiền kỳ", icon: "SB", color: "#a887ff", tools: ["brief", "moodboard", "storyboard", "world-bible"] },
    { id: "production", label: "Sản xuất", icon: "PX", color: "#6af0ae", tools: ["creator-studio", "media-center", "repurpose", "brand", "audio-dubbing", "prototype"] },
    { id: "workflow", label: "Workflow", icon: "WF", color: "#ffbd59", tools: ["workflow", "ai-director", "prompt-studio", "ai-automation"] },
    { id: "publish", label: "Xuất bản", icon: "PB", color: "#7fa7ff", tools: ["review", "collaboration", "publishing", "analytics", "rights", "providers", "marketplace"] }
  ]);

  const THEMES = Object.freeze([
    ["neon", "#59efff", "#ff55ce"], ["purple", "#aa7dff", "#ff68d7"],
    ["solar", "#ffba55", "#ff547d"], ["deep", "#4a78ff", "#7de7ff"],
    ["aurora", "#58f3ff", "#69ffb7"], ["magenta", "#ff4ecf", "#a971ff"],
    ["emerald", "#58f5a8", "#bcff65"], ["quantum", "#54a4ff", "#58f4ff"],
    ["golden", "#ffd75e", "#ff874a"], ["crimson", "#ff654d", "#ff4c9f"],
    ["ice", "#d8fbff", "#78b7ff"], ["blackhole", "#8c78ff", "#303c75"],
    ["time", "#5eefff", "#ffb653"]
  ]);

  const clean = (value, limit = 220) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const read = (key, fallback) => {
    try { return JSON.parse(global.localStorage?.getItem?.(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { global.localStorage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };

  function normalizePrefs(value = {}) {
    return {
      mode: ["map", "focus", "compact"].includes(value.mode) ? value.mode : "map",
      activeCluster: GROUPS.some((group) => group.id === value.activeCluster) ? value.activeCluster : "command"
    };
  }

  function homeProfile(value = read(HOME_PREF_KEY, {})) {
    const theme = THEMES.find((item) => item[0] === value.theme) || THEMES[0];
    const reduced = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    return {
      theme: theme[0],
      primary: theme[1],
      secondary: theme[2],
      motion: reduced ? "off" : clean(value.motion || "balanced", 20),
      stars: clamp(value.stars, 0, 100, 64),
      nebula: clamp(value.nebula, 0, 100, 68),
      glow: clamp(value.glow, 0, 100, 70),
      effectComet: value.effectComet !== false,
      effectNova: value.effectNova !== false,
      effectWormhole: value.effectWormhole !== false,
      reduced
    };
  }

  function creativeState() {
    try {
      return global.__HH_CREATIVE_STORE__?.getState?.()
        || global.HHCreativeCore?.normalizeState?.(read(CORE_KEY, {}))
        || read(CORE_KEY, {});
    } catch { return {}; }
  }

  function creativeSnapshot() {
    const state = creativeState();
    try { return global.HHCreativeGalaxy?.snapshot?.(state, {}) || fallbackSnapshot(state); }
    catch { return fallbackSnapshot(state); }
  }

  function fallbackSnapshot(state = {}) {
    const projects = asArray(state.projects);
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const runs = asArray(state.runs).filter((run) => !project || run.projectId === project.id);
    return {
      project,
      projects,
      progress: Number(project?.analytics?.progress) || 0,
      runs,
      pendingRuns: runs.filter((run) => ["queued", "running"].includes(run.status)),
      failedRuns: runs.filter((run) => run.status === "failed"),
      assets: asArray(project?.assets),
      unread: asArray(project?.review?.comments).filter((comment) => comment.read !== true && comment.resolved !== true),
      pendingPublishing: asArray(project?.publishing).filter((item) => ["draft", "scheduled", "queued", "publishing"].includes(item.status)),
      rightsCount: asArray(project?.rights?.warnings).length
    };
  }

  function groupForTool(id) {
    return GROUPS.find((group) => group.tools.includes(id)) || GROUPS[0];
  }

  function signalForTool(id, data) {
    if (!data.project) return { label: "Chưa có hoạt động", level: "empty", detail: "Hãy tạo Universal Project để kích hoạt tín hiệu." };
    if (["overview", "project"].includes(id)) return { label: `${data.progress || 0}% dự án`, level: "active", detail: `${data.projects?.length || 0} dự án · ${asArray(data.project.versions).length} phiên bản` };
    if (["ai-center", "ai-script", "workflow", "ai-director", "prompt-studio", "ai-automation"].includes(id)) {
      if (data.failedRuns?.length) return { label: `${data.failedRuns.length} lỗi`, level: "error", detail: "Có AI job cần kiểm tra hoặc chạy lại." };
      if (data.pendingRuns?.length) return { label: `${data.pendingRuns.length} đang chạy`, level: "processing", detail: "Backend đang xử lý tác vụ của dự án." };
      return { label: data.runs?.length ? `${data.runs.length} lượt chạy` : "Chưa có AI job", level: data.runs?.length ? "active" : "empty", detail: "Không tạo trạng thái AI giả." };
    }
    if (["moodboard", "creator-studio", "media-center", "repurpose", "brand", "audio-dubbing", "prototype"].includes(id)) {
      return { label: data.assets?.length ? `${data.assets.length} asset` : "Chưa có asset", level: data.assets?.length ? "ready" : "empty", detail: data.assets?.[0]?.name || "Media Center chưa ghi nhận asset." };
    }
    if (id === "storyboard") return { label: `${asArray(data.project.storyboard).length} shot`, level: asArray(data.project.storyboard).length ? "active" : "empty", detail: "Storyboard dùng chung dữ liệu dự án." };
    if (id === "world-bible") return { label: `${asArray(data.project.world?.characters).length} nhân vật`, level: asArray(data.project.world?.characters).length ? "active" : "empty", detail: "Nhân vật và bối cảnh của Universal Project." };
    if (id === "brief") return { label: data.project.brief?.goal || data.project.brief?.description ? "Đã có brief" : "Chưa có brief", level: data.project.brief?.goal || data.project.brief?.description ? "ready" : "empty", detail: data.project.brief?.goal || "Chưa đặt mục tiêu dự án." };
    if (["review", "collaboration"].includes(id)) return { label: data.unread?.length ? `${data.unread.length} chưa đọc` : data.project.review?.status || "draft", level: data.unread?.length ? "processing" : "active", detail: "Comment và approval lấy từ Creative Review." };
    if (id === "publishing") return { label: data.pendingPublishing?.length ? `${data.pendingPublishing.length} đang chờ` : "Chưa có lịch", level: data.pendingPublishing?.length ? "processing" : "empty", detail: "Chỉ hiện lịch đã lưu hoặc provider xác nhận." };
    if (id === "rights") return { label: data.rightsCount ? `${data.rightsCount} cảnh báo` : "Chưa có cảnh báo", level: data.rightsCount ? "error" : "ready", detail: "Kiểm tra nguồn và giấy phép asset." };
    if (id === "providers") return { label: data.providers?.length ? `${data.providers.length} provider` : "Chưa cấu hình", level: data.providers?.length ? "active" : "empty", detail: "Quota và độ trễ chỉ hiện khi backend cung cấp." };
    if (id === "analytics") return { label: data.project.analytics?.impressions ? `${Number(data.project.analytics.impressions).toLocaleString("vi-VN")} lượt` : "Chưa có dữ liệu", level: data.project.analytics?.impressions ? "active" : "empty", detail: "Analytics không dùng số liệu mẫu." };
    return { label: "Chưa có hoạt động", level: "empty", detail: "Workspace chưa ghi nhận dữ liệu mới." };
  }

  function profileStyle(profile) {
    return `--csm-a:${profile.primary};--csm-b:${profile.secondary};--csm-stars:${profile.stars / 100};--csm-nebula:${profile.nebula / 100};--csm-glow:${profile.glow / 100}`;
  }

  function markup(options = {}) {
    const items = asArray(options.items);
    const route = clean(options.route || "/create", 220);
    const routeId = route.split("/").filter(Boolean)[1] || "overview";
    const stored = normalizePrefs(read(PREF_KEY, {}));
    const activeCluster = groupForTool(routeId)?.id || stored.activeCluster;
    const prefs = { ...stored, activeCluster };
    const profile = homeProfile();
    const data = creativeSnapshot();
    return `<div class="app-sidebar__studio creative-star-map" data-studio-kind="create" data-creative-star-map data-csm-mode="${prefs.mode}" data-csm-motion="${profile.motion}" data-csm-theme="${profile.theme}" data-csm-comet="${profile.effectComet}" data-csm-nova="${profile.effectNova}" data-csm-wormhole="${profile.effectWormhole}" style="${profileStyle(profile)}">
      <header class="csm-sun-header">
        <button class="csm-sun" type="button" data-app-route="/create" aria-label="Mở Creative Galaxy"><i>H</i><span><small>CREATIVE SUN</small><b>${data.project ? esc(data.project.name) : "Chưa có dự án"}</b></span><em></em></button>
        <nav aria-label="Chế độ Creative Star Map">${[["map", "Star Map"], ["focus", "Focus"], ["compact", "Compact"]].map(([id, label]) => `<button type="button" data-csm-set-mode="${id}" aria-pressed="${prefs.mode === id}" title="${label}">${id === "map" ? "◎" : id === "focus" ? "◉" : "≡"}<span>${label}</span></button>`).join("")}</nav>
      </header>
      <label class="csm-search"><span>⌕</span><input type="search" data-media-sidebar-search placeholder="Tìm hành tinh..." autocomplete="off"></label>
      <div class="csm-space" data-media-sidebar-list>
        <i class="csm-nebula" aria-hidden="true"></i><i class="csm-stars" aria-hidden="true"></i>
        ${GROUPS.map((group, groupIndex) => {
          const groupItems = items.filter((item) => group.tools.includes(item.id));
          const open = group.id === prefs.activeCluster;
          const alerts = groupItems.filter((item) => ["error", "processing"].includes(signalForTool(item.id, data).level)).length;
          return `<section class="csm-cluster ${open ? "is-open" : ""}" data-media-sidebar-group data-csm-cluster-section="${group.id}" style="--cluster:${group.color};--cluster-index:${groupIndex}">
            <button class="csm-cluster-core" type="button" data-csm-cluster="${group.id}" aria-expanded="${open}">
              <i><span>${group.icon}</span><b></b></i><strong>${esc(group.label)}</strong><small>${groupItems.length}</small>${alerts ? `<mark>${alerts}</mark>` : ""}
            </button>
            <div class="csm-planets" aria-hidden="${!open}">${groupItems.map((item, index) => {
              const signal = signalForTool(item.id, data);
              const itemRoute = `/create/${item.id}`;
              return `<button class="csm-planet is-${signal.level} ${route === itemRoute || (route === "/create" && item.id === "overview") ? "is-active" : ""}" type="button" data-app-route="${itemRoute}" data-csm-wormhole-route="${itemRoute}" data-media-sidebar-item="${esc(`${item.title} ${item.description || ""}`.toLowerCase())}" data-studio-tool="${item.id}" style="--planet-index:${index};--cluster:${group.color}" title="${esc(`${item.title} · ${signal.label}`)}">
                <i aria-hidden="true"><span>${esc(item.icon)}</span><b></b></i><span><strong>${esc(item.title)}</strong><small>${esc(signal.label)}</small></span>
                <em><b>${esc(item.title)}</b><small>${esc(item.description || "")}</small><span class="is-${signal.level}">${esc(signal.label)}</span><p>${esc(signal.detail)}</p></em>
              </button>`;
            }).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      <footer><span><i></i>Dữ liệu Universal Project</span><button type="button" data-app-route="/create/project">Mở dự án →</button></footer>
    </div>`;
  }

  function applyProfile(root, profile = homeProfile()) {
    if (!root) return;
    root.dataset.csmTheme = profile.theme;
    root.dataset.csmMotion = profile.motion;
    root.dataset.csmComet = String(profile.effectComet);
    root.dataset.csmNova = String(profile.effectNova);
    root.dataset.csmWormhole = String(profile.effectWormhole);
    root.style.cssText = profileStyle(profile);
    const group = root.closest('[data-nav-group="create"]');
    group?.style?.setProperty("--csm-a", profile.primary);
    group?.style?.setProperty("--csm-b", profile.secondary);
  }

  function setMode(root, mode) {
    const prefs = normalizePrefs({ ...read(PREF_KEY, {}), mode });
    write(PREF_KEY, prefs);
    root.dataset.csmMode = prefs.mode;
    root.querySelectorAll("[data-csm-set-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.csmSetMode === prefs.mode)));
  }

  function setCluster(root, id) {
    const prefs = normalizePrefs({ ...read(PREF_KEY, {}), activeCluster: id });
    write(PREF_KEY, prefs);
    root.querySelectorAll("[data-csm-cluster-section]").forEach((section) => {
      const open = section.dataset.csmClusterSection === prefs.activeCluster;
      section.classList.toggle("is-open", open);
      section.querySelector("[data-csm-cluster]")?.setAttribute("aria-expanded", String(open));
      const planets = section.querySelector(".csm-planets");
      if (planets) planets.setAttribute("aria-hidden", String(!open));
    });
  }

  function autoMount() {
    if (!global.document || global.__HH_CREATIVE_STAR_MAP_BOUND__) return false;
    global.__HH_CREATIVE_STAR_MAP_BOUND__ = true;
    global.document.addEventListener("click", (event) => {
      const mode = event.target.closest("[data-csm-set-mode]");
      if (mode) {
        event.preventDefault();
        event.stopPropagation();
        const root = mode.closest("[data-creative-star-map]");
        if (root) setMode(root, mode.dataset.csmSetMode);
        return;
      }
      const cluster = event.target.closest("[data-csm-cluster]");
      if (cluster) {
        event.preventDefault();
        event.stopPropagation();
        const root = cluster.closest("[data-creative-star-map]");
        if (root) setCluster(root, cluster.dataset.csmCluster);
        return;
      }
      const route = event.target.closest("[data-csm-wormhole-route]");
      if (route && route.closest("[data-creative-star-map]") && global.HHCreativeGalaxy?.openWormhole) {
        event.preventDefault();
        event.stopImmediatePropagation();
        global.HHCreativeGalaxy.openWormhole(route.dataset.csmWormholeRoute, () => {
          global.location.hash = `#${route.dataset.csmWormholeRoute}`;
        });
      }
    }, true);
    global.addEventListener?.("hh:home-galaxy-preferences-applied", (event) => {
      const profile = homeProfile(event.detail?.preferences || {});
      global.document.querySelectorAll("[data-creative-star-map]").forEach((root) => applyProfile(root, profile));
    });
    global.addEventListener?.("hh:creative-project-change", () => {
      global.document.querySelectorAll("[data-creative-star-map]").forEach((root) => applyProfile(root));
    });
    const applyAll = () => global.document.querySelectorAll("[data-creative-star-map]").forEach((root) => applyProfile(root));
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", applyAll, { once: true });
    else setTimeout(applyAll, 0);
    if (typeof global.MutationObserver === "function") {
      let frame = 0;
      new global.MutationObserver(() => {
        global.cancelAnimationFrame?.(frame);
        frame = global.requestAnimationFrame?.(applyAll);
      }).observe(global.document.documentElement, { childList: true, subtree: true });
    }
    return true;
  }

  return Object.freeze({
    VERSION, PREF_KEY, HOME_PREF_KEY, GROUPS, THEMES,
    normalizePrefs, homeProfile, groupForTool, signalForTool, markup, applyProfile, autoMount
  });
});
