(function initHHAssetLoader(global) {
  "use strict";

  const groups = Object.freeze({
    "auth-effects": {
      scripts: [
        "auth-living-background.js?v=1", "auth-identity-constellation.js?v=2", "auth-creative-universe.js?v=4",
        "auth-universe-memory.js?v=2", "auth-logo-motion.js?v=1", "auth-emotional-logo.js?v=1",
        "auth-form-motion.js?v=3", "auth-transition-runtime.js?v=2", "auth-quantum-flow.js?v=2",
        "auth-trust-director.js?v=2", "auth-spatial-aurora.js?v=1"
      ]
    },
    home: {
      styles: [
        "dashboard-aurora.css?v=3", "command-center-pro.css?v=4", "home-daily-command.css?v=2",
        "home-command-search.css?v=2", "home-widget-project-pulse.css?v=2", "home-health-focus.css?v=2"
      ],
      scripts: [
        "dashboard-aurora.js?v=3", "command-center-pro.js?v=5", "home-daily-command.js?v=2",
        "home-command-search.js?v=2", "home-widget-project-pulse.js?v=2", "home-health-focus.js?v=2"
      ]
    },
    platform: {
      styles: [
        "professional-tools.css?v=3", "feature-lab.css?v=3", "extension-suite.css?v=1",
        "ai-center-pro.css?v=1", "ai-center-advanced.css?v=1", "platform-p0.css?v=1"
      ],
      scripts: [
        "extension-suite.js?v=2", "professional-tools.js?v=4", "feature-lab.js?v=4",
        "feature-engines.js?v=2", "ai-center-advanced.js?v=1", "platform-p0.js?v=1"
      ]
    },
    dev: {
      styles: [
        "professional-tools.css?v=3", "dev-pro-suite.css?v=1", "dev-smart-recipe.css?v=1", "dev-api-studio.css?v=1",
        "dev-data-security.css?v=1", "dev-regex-database.css?v=1", "dev-code-git.css?v=1",
        "dev-diagnostics-ai.css?v=1"
      ],
      scripts: [
        "professional-tools.js?v=4", "dev-smart-recipe.js?v=1", "dev-api-studio.js?v=1",
        "dev-data-security.js?v=1", "dev-regex-database.js?v=1", "dev-code-git.js?v=1",
        "dev-diagnostics-ai.js?v=1", "dev-pro-suite.js?v=1"
      ]
    },
    media: {
      styles: [
        "media-design-pro.css?v=1", "media-design-page.css?v=8", "universal-media-project.css?v=1",
        "media-design-advanced.css?v=3", "media-design-publish.css?v=1", "video-editor-studio.css?v=2",
        "video-editor-resolve.css?v=6", "photo-editor-pro.css?v=4", "editor-workflow-pro.css?v=1"
      ],
      scripts: [
        "media-design-studio.js?v=1", "media-design-pro.js?v=2", "media-design-advanced.js?v=3",
        "media-design-publish.js?v=1", "video-editor-studio.js?v=2", "video-editor-resolve.js?v=7",
        "photo-editor-pro.js?v=3", "editor-workflow-pro.js?v=1", "universal-media-project.js?v=1",
        "media-design-page.js?v=8"
      ]
    },
    graphic: {
      styles: ["graphic-design-studio.css?v=5"],
      scripts: [
        "graphic-design-animation.js?v=1", "graphic-design-3d.js?v=2", "graphic-design-prototype.js?v=1",
        "graphic-design-motion.js?v=1", "graphic-design-quick-motion.js?v=1", "graphic-design-mockup.js?v=1",
        "graphic-design-character.js?v=1", "graphic-design-vector-core.js?v=2", "graphic-design-state-machine.js?v=2",
        "graphic-design-adaptive.js?v=2", "graphic-design-project-store.js?v=2", "graphic-design-collaboration.js?v=2",
        "graphic-design-dev-ai.js?v=2", "graphic-design-composer.js?v=2", "graphic-design-studio.js?v=5"
      ]
    },
    creative: {
      styles: ["creative-suite.css?v=5", "creative-os.css?v=1", "ai-center-pro.css?v=1", "ai-center-advanced.css?v=1"],
      scripts: [
        "creative-os.js?v=1", "creative-suite.js?v=5", "ai-center-advanced.js?v=1"
      ]
    },
    music: {
      styles: [
        "music-production-suite.css?v=1", "music-daw-workspace.css?v=1", "music-composer-lyrics.css?v=1",
        "music-audio-labs.css?v=1", "music-mix-master.css?v=1", "music-visual-studio.css?v=1",
        "music-publishing-rights.css?v=1", "music-intelligence-engine.css?v=1", "music-generative-arrangement.css?v=1",
        "music-adaptive-library.css?v=1", "music-mix-performance.css?v=1", "music-project-governance.css?v=1",
        "music-ai-studio.css?v=5", "music-ai-apps.css?v=2", "youtube-publisher.css?v=2"
      ],
      scripts: [
        "youtube-publisher.js?v=2", "music-daw-workspace.js?v=1", "music-composer-lyrics.js?v=1",
        "music-audio-labs.js?v=1", "music-mix-master.js?v=1", "music-visual-studio.js?v=1",
        "music-publishing-rights.js?v=1", "music-intelligence-engine.js?v=1", "music-generative-arrangement.js?v=1",
        "music-adaptive-library.js?v=1", "music-mix-performance.js?v=1", "music-project-governance.js?v=1",
        "music-production-suite.js?v=1", "music-ai-apps.js?v=2", "music-ai-studio.js?v=6"
      ]
    },
    communication: {
      styles: [
        "communication-overview.css?v=1", "communication-suite.css?v=1", "communication-workspace-fix.css?v=1",
        "communication-command-center.css?v=1", "communication-messenger-next.css?v=1",
        "communication-channels-forum.css?v=1", "communication-live-room.css?v=1",
        "communication-canvas-automation.css?v=1", "communication-intelligence.css?v=1",
        "community-social-pro.css?v=3", "community-platform-v2.css?v=10", "community-messenger-pro.css?v=1"
      ],
      scripts: [
        "communication-overview.js?v=2", "communication-command-center.js?v=1", "communication-messenger-next.js?v=1",
        "communication-channels-forum.js?v=1", "communication-live-room.js?v=1",
        "communication-canvas-automation.js?v=1", "communication-intelligence.js?v=1", "communication-suite.js?v=1",
        "community-social-pro.js?v=4", "community-platform-v2.js?v=12", "community-calls.js?v=1"
      ]
    },
    search: {
      styles: ["search-watch-center.css?v=5"],
      scripts: ["search-watch-center.js?v=7"]
    },
    work: {
      styles: ["work-center.css?v=1", "download-center-pro.css?v=1", "team-collaboration-pro.css?v=2"],
      scripts: ["team-collaboration-pro.js?v=2", "work-center.js?v=1"]
    },
    game: {
      styles: ["space-explorer.css?v=3", "game-center.css?v=2", "astra-universe-expansion.css?v=3", "game-arcade.css?v=2"],
      scripts: ["space-explorer.js?v=3", "game-center.js?v=2", "astra-universe-expansion.js?v=3", "game-arcade.js?v=2"]
    },
    learning: {
      styles: [
        "learning-suite.css?v=2", "learning-home.css?v=2", "learning-paths.css?v=2", "learning-review.css?v=2",
        "learning-lesson-player.css?v=2", "learning-coach-labs.css?v=2", "learning-classroom.css?v=2"
      ],
      scripts: [
        "learning-platform-core.js?v=2", "learning-home.js?v=2", "learning-paths.js?v=2", "learning-review.js?v=2",
        "learning-lesson-player.js?v=2", "learning-coach-labs.js?v=2", "learning-classroom.js?v=2", "learning-suite.js?v=2"
      ]
    },
    english: {
      styles: ["english-learning.css?v=11", "english-voice-coach.css?v=1"],
      scripts: ["english-curriculum.js?v=1", "english-career-expansion.js?v=1", "english-career-curriculum.js?v=2", "english-learning.js?v=13"]
    },
    analytics: {
      styles: ["insights-pro.css?v=1", "community-admin.css?v=5"],
      scripts: ["insights-pro.js?v=4", "community-admin.js?v=7"]
    },
    support: {
      styles: ["support-platform.css?v=8"],
      scripts: ["https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js", "support-platform.js?v=11"]
    }
  });

  const loaded = new Set();
  const pending = new Map();
  const assetPromises = new Map();

  function normalizeRoute(route) {
    const value = String(route || global.location.hash.replace(/^#/, "") || "/home");
    return value.startsWith("/") ? value : `/${value}`;
  }

  function groupsForRoute(route) {
    const value = normalizeRoute(route);
    if (value === "/home") return ["home"];
    if (value.startsWith("/dev-tools")) return ["dev"];
    if (value.startsWith("/media-design")) return ["media"];
    if (value.startsWith("/graphic-design")) return ["graphic"];
    if (value.startsWith("/music-ai")) return ["music"];
    if (value.startsWith("/entertainment")) return ["game"];
    if (value.startsWith("/learn")) return ["learning"];
    if (value.startsWith("/english")) return ["english"];
    if (value.startsWith("/support")) return ["support"];
    if (value.startsWith("/communication")) return ["communication", "search", "platform"];
    if (value.startsWith("/work")) return ["work", "platform"];
    if (value.startsWith("/analytics")) return ["analytics", "platform"];
    if (value.startsWith("/create")) return ["creative", "platform"];
    if (value.startsWith("/system") || value === "/tools" || value === "/favorites" || value === "/recent") return ["platform"];
    return [];
  }

  function loadStyle(url) {
    const key = `style:${url}`;
    if (assetPromises.has(key)) return assetPromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.hhRuntimeAsset = "style";
      link.onload = () => resolve(url);
      link.onerror = () => reject(new Error(`Khong tai duoc giao dien ${url}`));
      document.head.append(link);
    });
    assetPromises.set(key, promise);
    return promise;
  }

  function loadScript(url) {
    const key = `script:${url}`;
    if (assetPromises.has(key)) return assetPromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.hhRuntimeAsset = "script";
      script.onload = () => resolve(url);
      script.onerror = () => reject(new Error(`Khong tai duoc chuc nang ${url}`));
      document.head.append(script);
    });
    assetPromises.set(key, promise);
    return promise;
  }

  function ensureGroup(name) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (pending.has(name)) return pending.get(name);
    const group = groups[name];
    if (!group) return Promise.resolve(name);
    const promise = Promise.all([
      Promise.all((group.styles || []).map(loadStyle)),
      Promise.all((group.scripts || []).map(loadScript))
    ]).then(() => {
      loaded.add(name);
      pending.delete(name);
      global.dispatchEvent(new CustomEvent("hh:asset-group-ready", { detail: { group: name } }));
      return name;
    }).catch((error) => {
      pending.delete(name);
      throw error;
    });
    pending.set(name, promise);
    return promise;
  }

  function ensureForRoute(route) {
    const value = normalizeRoute(route);
    const names = groupsForRoute(value);
    document.body?.classList.add("hh-assets-loading");
    global.dispatchEvent(new CustomEvent("hh:assets-loading", { detail: { route: value, groups: names } }));
    return Promise.all(names.map(ensureGroup)).then(() => {
      document.body?.classList.remove("hh-assets-loading");
      global.dispatchEvent(new CustomEvent("hh:assets-ready", { detail: { route: value, groups: names } }));
      return value;
    }).catch((error) => {
      document.body?.classList.remove("hh-assets-loading");
      throw error;
    });
  }

  function isRouteReady(route) {
    return groupsForRoute(route).every((name) => loaded.has(name));
  }

  function loadFontWhenIdle() {
    const start = () => loadStyle("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap").catch(() => {});
    if ("requestIdleCallback" in global) global.requestIdleCallback(start, { timeout: 2500 });
    else global.setTimeout(start, 900);
  }

  function loadAuthEffectsWhenIdle() {
    const start = () => ensureGroup("auth-effects").catch(() => {});
    if ("requestIdleCallback" in global) global.requestIdleCallback(start, { timeout: 1200 });
    else global.setTimeout(start, 350);
  }

  document.addEventListener("pointerdown", (event) => {
    const route = event.target.closest?.("[data-app-route]")?.dataset.appRoute;
    if (route) ensureForRoute(route).catch(() => {});
  }, { capture: true, passive: true });

  document.addEventListener("click", (event) => {
    const launcher = event.target.closest?.("[data-search-watch-open]");
    if (!launcher || global.HHSearchWatch?.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureGroup("search").then(() => global.HHSearchWatch?.open?.(launcher.dataset.searchWatchOpen || "google"));
  }, true);

  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("hh-page-hidden", document.hidden);
  });

  global.HHAssetLoader = Object.freeze({ ensureForRoute, ensureGroup, isRouteReady, groupsForRoute, loadedGroups: () => [...loaded] });
  loadFontWhenIdle();
  loadAuthEffectsWhenIdle();
})(window);
