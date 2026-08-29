(function galaxyShellBootstrap(global) {
  "use strict";

  if (!global || global.HHGalaxyShell) return;

  const FLAG_KEY = "hh.galaxy-shell.v1";
  const FLAG_VERSION = 1;
  const DEFAULT_ENABLED = true;
  const EFFECT_OWNER = "shell";
  const VALID_LAYOUTS = new Set(["atlas", "standard", "dashboard", "three-column", "workbench", "media-dock", "desktop"]);

  const deepFreeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  /*
   * This manifest describes route ownership and layout needs only. Capability
   * names never imply that a provider is online; each feature remains the
   * authority for its own loading/permission/configuration state.
   */
  const routeManifest = deepFreeze([
    { id: "home-galaxy", planet: "home", title: "Home Galaxy", route: "/home", aliases: ["/"], assetGroup: "home", layout: "atlas", capabilities: ["navigation", "search"], adminOnly: false },
    { id: "personal-dashboard", planet: "home", title: "Dashboard cá nhân", route: "/home/dashboard", aliases: ["/settings/user-dashboard"], assetGroup: "galaxy-home-ai", layout: "dashboard", capabilities: ["widgets", "local-preferences"], adminOnly: false },
    { id: "favorites", planet: "home", title: "Yêu thích", route: "/favorites", aliases: [], assetGroup: "core", layout: "standard", capabilities: ["local-preferences"], adminOnly: false },
    { id: "recent", planet: "home", title: "Gần đây", route: "/recent", aliases: [], assetGroup: "core", layout: "standard", capabilities: ["local-history"], adminOnly: false },
    { id: "work-center", planet: "home", title: "Work Center", route: "/work", aliases: ["/galaxy/tools"], assetGroup: "work", layout: "standard", capabilities: ["projects", "tasks"], adminOnly: false },
    { id: "project-hub", planet: "home", title: "Project Hub", route: "/work/projects-tasks", aliases: ["/work/project-hub", "/galaxy/project-hub"], assetGroup: "galaxy-domain-views", layout: "three-column", capabilities: ["projects", "tasks", "local-storage"], adminOnly: false },
    { id: "automation-builder", planet: "home", title: "Automation Builder", route: "/work/automation-lab", aliases: [], assetGroup: "work", layout: "workbench", capabilities: ["workflow", "dry-run", "execution-log"], adminOnly: false },

    { id: "creator-studio", planet: "ai", title: "Creator Studio", route: "/create/workflow", aliases: ["/create", "/galaxy/creator"], assetGroup: "galaxy-domain-views", layout: "workbench", capabilities: ["creative-tools", "projects"], adminOnly: false },
    { id: "ai-universe", planet: "ai", title: "AI Universe", route: "/create/ai-center", aliases: ["/galaxy/ai"], assetGroup: "ai", layout: "atlas", capabilities: ["ai-providers", "prompting"], adminOnly: false },
    { id: "ai-copilot", planet: "ai", title: "HH AI Copilot", route: "/chat-ai", aliases: [], assetGroup: "chat-ai", layout: "three-column", capabilities: ["chat", "streaming", "history"], adminOnly: false },
    { id: "draw-studio", planet: "ai", title: "Draw Studio", route: "/draw", aliases: [], assetGroup: "draw", layout: "workbench", capabilities: ["canvas", "export"], adminOnly: false },
    { id: "media-design", planet: "ai", title: "Media & Design", route: "/media-design", aliases: [], assetGroup: "media", layout: "workbench", capabilities: ["media", "design", "projects"], adminOnly: false },
    { id: "graphic-design", planet: "ai", title: "Thiết kế đồ họa", route: "/graphic-design", aliases: [], assetGroup: "graphic-design", layout: "workbench", capabilities: ["canvas", "vector", "export"], adminOnly: false },

    { id: "music-planet", planet: "music", title: "Music Planet", route: "/music", aliases: ["/galaxy/music"], assetGroup: "music-library", layout: "media-dock", capabilities: ["audio", "library", "playlists"], adminOnly: false },
    { id: "ambient-room", planet: "music", title: "Ambient Room", route: "/music/ambient", aliases: ["/galaxy/ambient-room"], assetGroup: "galaxy-domain-views", layout: "media-dock", capabilities: ["audio", "focus-timer"], adminOnly: false },
    { id: "music-ai", planet: "music", title: "Làm nhạc AI", route: "/music-ai", aliases: [], assetGroup: "music-ai", layout: "workbench", capabilities: ["audio", "composition", "projects"], adminOnly: false },
    { id: "video-planet", planet: "video", title: "Video Planet", route: "/davinci-resolve", aliases: ["/galaxy/video"], assetGroup: "davinci-resolve", layout: "workbench", capabilities: ["video", "timeline", "export"], adminOnly: false },
    { id: "youtube", planet: "video", title: "YouTube", route: "/youtube", aliases: [], assetGroup: "search", layout: "media-dock", capabilities: ["youtube-player", "search"], adminOnly: false },
    { id: "cinema", planet: "video", title: "Phim", route: "/cinema", aliases: [], assetGroup: "cinema", layout: "media-dock", capabilities: ["video", "library"], adminOnly: false },

    { id: "games-world", planet: "games", title: "Games World", route: "/play", aliases: ["/galaxy/games"], assetGroup: "play", layout: "standard", capabilities: ["games", "local-save"], adminOnly: false },
    { id: "eonwild", planet: "games", title: "HH EonWild", route: "/game", aliases: [], assetGroup: "eonwild", layout: "atlas", capabilities: ["webgl", "simulation", "local-save"], adminOnly: false },
    { id: "comic-reader", planet: "games", title: "Đọc truyện", route: "/comic-reader", aliases: [], assetGroup: "comic-reader", layout: "three-column", capabilities: ["reader", "library"], adminOnly: false },

    { id: "dev-planet", planet: "dev", title: "Dev Planet", route: "/dev-tools", aliases: ["/galaxy/dev"], assetGroup: "dev-tools", layout: "workbench", capabilities: ["code", "api", "diagnostics"], adminOnly: false },
    { id: "learning-star", planet: "learning", title: "Learning Star", route: "/learn", aliases: ["/galaxy/learning"], assetGroup: "learning", layout: "standard", capabilities: ["curriculum", "progress"], adminOnly: false },
    { id: "hh-english", planet: "learning", title: "HH English", route: "/english", aliases: [], assetGroup: "english", layout: "three-column", capabilities: ["curriculum", "srs", "progress"], adminOnly: false },
    { id: "hh-japanese", planet: "learning", title: "HH Japanese", route: "/japanese", aliases: [], assetGroup: "japanese", layout: "three-column", capabilities: ["curriculum", "srs", "progress"], adminOnly: false },
    { id: "hh-chinese", planet: "learning", title: "HH Chinese", route: "/chinese", aliases: [], assetGroup: "chinese", layout: "three-column", capabilities: ["curriculum", "srs", "progress"], adminOnly: false },
    { id: "buddhist-learning", planet: "learning", title: "Phật Pháp", route: "/phat-phap", aliases: [], assetGroup: "phat-phap", layout: "three-column", capabilities: ["library", "audio", "progress"], adminOnly: false },

    { id: "community", planet: "community", title: "Community", route: "/communication", aliases: ["/galaxy/community"], assetGroup: "communication", layout: "three-column", capabilities: ["realtime", "messaging", "community"], adminOnly: false },
    { id: "tools-galaxy", planet: "tools", title: "Tools Galaxy", route: "/system", aliases: [], assetGroup: "system", layout: "standard", capabilities: ["utilities", "settings"], adminOnly: false },
    { id: "web-desktop", planet: "tools", title: "HH Web Desktop", route: "/system/desktop", aliases: [], assetGroup: "galaxy-domain-views", layout: "desktop", capabilities: ["window-launcher", "local-preferences"], adminOnly: false },
    { id: "universe", planet: "tools", title: "Vũ trụ", route: "/universe", aliases: ["/cosmic-observatory"], assetGroup: "cosmic", layout: "atlas", capabilities: ["astronomy", "webgl", "data-sources"], adminOnly: false },
    { id: "analytics", planet: "tools", title: "Analytics", route: "/analytics", aliases: ["/galaxy/analytics"], assetGroup: "analytics", layout: "dashboard", capabilities: ["analytics"], adminOnly: false },
    { id: "settings", planet: "tools", title: "Cài đặt", route: "/settings", aliases: ["/galaxy/settings"], assetGroup: "settings", layout: "standard", capabilities: ["preferences", "privacy"], adminOnly: false },
    { id: "admin", planet: "tools", title: "Admin Panel", route: "/admin", aliases: [], assetGroup: "admin", layout: "dashboard", capabilities: ["administration"], adminOnly: true }
  ]);

  const state = {
    mounted: false,
    enabled: false,
    route: "/home",
    manifestId: "home-galaxy",
    planet: "home",
    layout: "atlas",
    viewport: "wide",
    effects: "paused",
    mediaActive: false,
    reason: "not-mounted"
  };

  let root = null;
  let effectOwner = null;
  let createdEffectOwner = false;
  let attributeSnapshots = [];
  let cleanups = [];
  let reducedMotionQuery = null;
  const reportedMediaSources = new Set();

  const safeStorage = () => {
    try { return global.localStorage || null; }
    catch (_) { return null; }
  };

  const readFlag = () => {
    const storage = safeStorage();
    if (!storage) return DEFAULT_ENABLED;
    try {
      const raw = storage.getItem(FLAG_KEY);
      if (raw === null) return DEFAULT_ENABLED;
      if (raw === "1" || raw === "true" || raw === "enabled") return true;
      if (raw === "0" || raw === "false" || raw === "disabled") return false;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== FLAG_VERSION || typeof parsed?.enabled !== "boolean") return false;
      return parsed.enabled;
    } catch (_) {
      return false;
    }
  };

  const writeFlag = (enabled) => {
    const storage = safeStorage();
    if (!storage) return false;
    try {
      storage.setItem(FLAG_KEY, JSON.stringify({ version: FLAG_VERSION, enabled: Boolean(enabled) }));
      return true;
    } catch (_) {
      return false;
    }
  };

  const normalizeRoute = (input) => {
    let value = String(input || "").trim();
    if (!value && global.location) value = global.location.hash || global.location.pathname || "/home";
    if (value.startsWith("#")) value = value.slice(1);
    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        value = parsed.hash ? parsed.hash.slice(1) : parsed.pathname;
      } catch (_) {
        value = "/home";
      }
    }
    value = value.split("?")[0].split("#")[0];
    value = `/${value}`.replace(/\/{2,}/g, "/");
    if (value.length > 1) value = value.replace(/\/+$/, "");
    return value || "/home";
  };

  const routeMatches = (candidate, route) => route === candidate || route.startsWith(`${candidate}/`);

  // Immersive workspaces own their entire viewport and render a contextual
  // Galaxy rail.  Keep the legacy application chrome for ordinary routes and
  // for HH Core, but expose one explicit attribute so canonical deep-links
  // (not only /galaxy/* aliases) cannot accidentally stack two sidebars.
  const isImmersiveRoute = (input) => {
    const route = normalizeRoute(input);
    return route.startsWith("/galaxy/")
      || route.startsWith("/chat-ai")
      || [
        "/create/workflow",
        "/work/automation-lab",
        "/work/projects-tasks",
        "/communication/community",
        "/music/ambient",
        "/system/desktop"
      ].some((canonical) => route === canonical || route.startsWith(`${canonical}/`));
  };

  const findRoute = (input) => {
    const route = normalizeRoute(input);
    const exact = routeManifest.find((item) => item.route === route || item.aliases.includes(route));
    if (exact) return exact;
    return routeManifest
      .filter((item) => routeMatches(item.route, route) || item.aliases.some((alias) => routeMatches(alias, route)))
      .sort((a, b) => b.route.length - a.route.length)[0] || routeManifest[0];
  };

  const resolveRoot = (candidate) => {
    const doc = global.document;
    if (!doc) return null;
    if (candidate && candidate.nodeType === 1) return candidate;
    if (typeof candidate === "string") return doc.querySelector(candidate);
    return doc.getElementById("appShell") || doc.querySelector(".app-shell");
  };

  const rememberAttribute = (element, name) => {
    if (!element || attributeSnapshots.some((entry) => entry.element === element && entry.name === name)) return;
    attributeSnapshots.push({
      element,
      name,
      existed: element.hasAttribute(name),
      value: element.getAttribute(name)
    });
  };

  const setOwnedAttribute = (element, name, value) => {
    if (!element) return;
    rememberAttribute(element, name);
    element.setAttribute(name, String(value));
  };

  const restoreAttributes = () => {
    [...attributeSnapshots].reverse().forEach(({ element, name, existed, value }) => {
      if (!element) return;
      if (existed) element.setAttribute(name, value ?? "");
      else element.removeAttribute(name);
    });
    attributeSnapshots = [];
  };

  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const emit = (name, detail) => {
    if (!global.dispatchEvent || typeof global.CustomEvent !== "function") return;
    global.dispatchEvent(new global.CustomEvent(name, { detail }));
  };

  const viewportName = () => {
    const width = Number(global.innerWidth || root?.clientWidth || 1440);
    if (width < 768) return "compact";
    if (width < 1180) return "rail";
    if (width < 1440) return "medium";
    return "wide";
  };

  const syncViewport = () => {
    if (!root) return;
    state.viewport = viewportName();
    setOwnedAttribute(root, "data-galaxy-viewport", state.viewport);
  };

  const hasPlayingMedia = () => {
    if (!root?.querySelectorAll) return false;
    return [...root.querySelectorAll("audio, video")].some((media) => media && media.paused === false && media.ended !== true);
  };

  const syncEffects = () => {
    if (!root) return;
    const reduced = Boolean(reducedMotionQuery?.matches);
    const hidden = Boolean(global.document?.hidden);
    state.effects = reduced || hidden || state.mediaActive ? "paused" : "active";
    setOwnedAttribute(root, "data-galaxy-effects", state.effects);
    setOwnedAttribute(root, "data-galaxy-media-active", String(state.mediaActive));
  };

  const syncMedia = (event) => {
    if (event?.type === "hh:media-playback" && typeof event.detail?.active === "boolean") {
      const source = String(event.detail.source || event.detail.playerId || "external");
      if (event.detail.active) reportedMediaSources.add(source);
      else reportedMediaSources.delete(source);
    }
    state.mediaActive = hasPlayingMedia() || reportedMediaSources.size > 0;
    syncEffects();
  };

  const ensureEffectOwner = () => {
    if (!root || !global.document) return null;
    effectOwner = [...root.children].find((child) => child.getAttribute?.("data-galaxy-effect-owner") === EFFECT_OWNER) || null;
    if (!effectOwner) {
      effectOwner = global.document.createElement("div");
      effectOwner.setAttribute("data-galaxy-effect-owner", EFFECT_OWNER);
      effectOwner.setAttribute("aria-hidden", "true");
      effectOwner.setAttribute("role", "presentation");
      root.append(effectOwner);
      createdEffectOwner = true;
    }
    return effectOwner;
  };

  const enhanceRegions = () => {
    if (!root) return;
    setOwnedAttribute(root.querySelector(".app-header"), "data-galaxy-chrome", "topbar");
    setOwnedAttribute(root.querySelector(".app-sidebar"), "data-galaxy-chrome", "navigation");
    setOwnedAttribute(root.querySelector(".app-main"), "data-galaxy-chrome", "outlet");
    setOwnedAttribute(root.querySelector(".app-workspace"), "data-galaxy-outlet", "route");
  };

  const publicState = () => Object.freeze({
    version: FLAG_VERSION,
    flagKey: FLAG_KEY,
    mounted: state.mounted,
    enabled: state.enabled,
    route: state.route,
    manifestId: state.manifestId,
    planet: state.planet,
    layout: state.layout,
    viewport: state.viewport,
    effects: state.effects,
    mediaActive: state.mediaActive,
    reason: state.reason
  });

  function syncRoute(input) {
    const route = normalizeRoute(input);
    const match = findRoute(route);
    state.route = route;
    state.manifestId = match.id;
    state.planet = match.planet;
    state.layout = VALID_LAYOUTS.has(match.layout) ? match.layout : "standard";
    if (root) {
      setOwnedAttribute(root, "data-galaxy-route", route);
      setOwnedAttribute(root, "data-galaxy-immersive", String(isImmersiveRoute(route)));
      setOwnedAttribute(root, "data-galaxy-planet", state.planet);
      setOwnedAttribute(root, "data-galaxy-layout", state.layout);
    }
    if (state.mounted) emit("hh:galaxy-shell-route", { route, manifestId: match.id, planet: match.planet, layout: state.layout });
    return match;
  }

  function unmount() {
    cleanups.splice(0).reverse().forEach((cleanup) => {
      try { cleanup(); } catch (_) { /* A detached browser target is harmless. */ }
    });
    if (createdEffectOwner && effectOwner?.parentNode) effectOwner.parentNode.removeChild(effectOwner);
    createdEffectOwner = false;
    effectOwner = null;
    restoreAttributes();
    const wasMounted = state.mounted;
    state.mounted = false;
    state.effects = "paused";
    state.mediaActive = false;
    reportedMediaSources.clear();
    state.reason = "unmounted";
    root = null;
    reducedMotionQuery = null;
    if (wasMounted) emit("hh:galaxy-shell-unmounted", { version: FLAG_VERSION });
    return true;
  }

  function mount(rootOrOptions, maybeOptions) {
    const firstIsElement = rootOrOptions && rootOrOptions.nodeType === 1;
    const firstIsSelector = typeof rootOrOptions === "string";
    const options = firstIsElement || firstIsSelector ? (maybeOptions || {}) : (rootOrOptions || {});
    const target = resolveRoot(firstIsElement || firstIsSelector ? rootOrOptions : options.root);
    const enabled = typeof options.enabled === "boolean" ? options.enabled : readFlag();

    state.enabled = enabled;
    if (!enabled) {
      if (state.mounted) unmount();
      state.enabled = false;
      state.reason = "feature-disabled";
      return false;
    }
    if (!target) {
      state.reason = "shell-not-found";
      return false;
    }
    if (state.mounted && root === target) {
      syncRoute(options.route);
      return true;
    }
    if (state.mounted) unmount();

    root = target;
    state.enabled = true;
    state.mounted = true;
    state.reason = "ready";
    setOwnedAttribute(root, "data-galaxy-shell", `v${FLAG_VERSION}`);
    setOwnedAttribute(root, "data-galaxy-effect-policy", "single-owner");
    enhanceRegions();
    ensureEffectOwner();
    syncViewport();
    syncRoute(options.route);

    reducedMotionQuery = global.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const onRoute = () => syncRoute();
    const onRouteRendered = (event) => syncRoute(event?.detail?.route);
    const onResize = () => syncViewport();
    const onVisibility = () => syncEffects();
    const onMotion = () => syncEffects();
    const onMedia = (event) => syncMedia(event);

    listen(global, "hashchange", onRoute);
    listen(global, "hh:route-rendered", onRouteRendered);
    listen(global, "resize", onResize, { passive: true });
    listen(global.document, "visibilitychange", onVisibility);
    listen(root, "play", onMedia, true);
    listen(root, "pause", onMedia, true);
    listen(root, "ended", onMedia, true);
    listen(global, "hh:media-playback", onMedia);
    if (reducedMotionQuery?.addEventListener) listen(reducedMotionQuery, "change", onMotion);
    else if (reducedMotionQuery?.addListener) {
      reducedMotionQuery.addListener(onMotion);
      cleanups.push(() => reducedMotionQuery?.removeListener?.(onMotion));
    }
    syncMedia();
    emit("hh:galaxy-shell-mounted", { version: FLAG_VERSION, route: state.route, manifestId: state.manifestId });
    return true;
  }

  function setEnabled(enabled, options) {
    const value = Boolean(enabled);
    const persisted = writeFlag(value);
    state.enabled = value;
    if (!value) unmount();
    else if (options?.mount !== false) mount({ ...(options || {}), enabled: true });
    emit("hh:galaxy-shell-enabled-change", {
      enabled: value,
      persisted,
      version: FLAG_VERSION,
      route: state.route
    });
    return persisted;
  }

  const api = Object.freeze({
    version: FLAG_VERSION,
    flagKey: FLAG_KEY,
    defaultEnabled: DEFAULT_ENABLED,
    routeManifest,
    mount,
    unmount,
    syncRoute,
    getState: publicState,
    isEnabled: readFlag,
    setEnabled
  });

  global.HHGalaxyShell = api;
})(typeof window !== "undefined" ? window : globalThis);
