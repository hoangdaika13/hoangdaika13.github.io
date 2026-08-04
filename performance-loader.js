(function initHHAssetLoader(global) {
  "use strict";

  /*
   * Offline compatibility catalog. These assets remain versioned in sw.js and
   * can still be inspected by older clients, but HH Neon Gateway no longer
   * executes them together because they target the same visual surface.
   */
  const legacyAuthEffectAssets = Object.freeze([
    "auth-living-background.css?v=1", "auth-living-background.js?v=1",
    "auth-spatial-aurora.css?v=1", "auth-spatial-aurora.js?v=1",
    "auth-identity-constellation.css?v=1", "auth-identity-constellation.js?v=2",
    "auth-creative-universe.css?v=5", "auth-creative-universe.js?v=5",
    "auth-universe-memory.css?v=1", "auth-universe-memory.js?v=2",
    "auth-logo-motion.css?v=1", "auth-logo-motion.js?v=1",
    "auth-emotional-logo.css?v=1", "auth-emotional-logo.js?v=1",
    "auth-form-motion.css?v=4", "auth-form-motion.js?v=3",
    "auth-quantum-flow.css?v=1", "auth-quantum-flow.js?v=2",
    "auth-transition-runtime.css?v=2", "auth-transition-runtime.js?v=2",
    "auth-trust-director.css?v=1", "auth-trust-director.js?v=2",
    "auth-cosmic-prism-background.css?v=2", "auth-cosmic-prism-background.js?v=2",
    "auth-cosmic-prism-form.css?v=2", "auth-cosmic-prism-form.js?v=2",
    "auth-cosmic-prism-interactions.css?v=2", "auth-cosmic-prism-interactions.js?v=2"
  ]);

  const groups = Object.freeze({
    "auth-effects": {
      /*
       * Restore only the lightweight product-universe runtime. The rest of
       * the former effect bundle remains disabled so independent canvases and
       * observers cannot stack up again.
       */
      styles: [],
      scripts: ["auth-creative-universe.js?v=5"]
    },
    home: {
      /*
       * The usable dashboard shell and its first-paint styles already live in
       * index.html/app-shell.css. Richer controllers mount after first paint.
       */
      styles: [],
      scripts: []
    },
    "home-enhancements": {
      styles: [
        "dashboard-aurora.css?v=4", "home-galaxy-command.css?v=3", "home-galaxy-mission.css?v=7", "home-galaxy-operations.css?v=1", "home-galaxy-control-deck.css?v=2", "command-center-pro.css?v=4", "home-daily-command.css?v=4",
        "home-command-search.css?v=2", "home-widget-project-pulse.css?v=2", "home-health-focus.css?v=2"
      ],
      scripts: [
        "dashboard-aurora.js?v=5", "home-galaxy-command.js?v=3", "home-galaxy-mission.js?v=9", "home-galaxy-operations.js?v=4", "home-galaxy-control-deck.js?v=2", "command-center-pro.js?v=6", "home-daily-command.js?v=6",
        "home-command-search.js?v=4", "home-widget-project-pulse.js?v=2", "home-health-focus.js?v=2"
      ]
    },
    platform: {
      styles: [
        "professional-tools.css?v=3", "feature-lab.css?v=5", "extension-suite.css?v=1",
        "platform-tools.css?v=1", "tool-workspace-pro.css?v=1", "utility-lab-tools.css?v=9", "ai-center-pro.css?v=1",
        "ai-center-advanced.css?v=1", "platform-p0.css?v=1", "system-platform.css?v=1"
      ],
      scripts: [
        "extension-suite.js?v=2", "professional-tools.js?v=4", "tool-manifests.js?v=1", "tool-runtime.js?v=1",
        "feature-lab.js?v=6", "platform-tools.js?v=1", "tool-workspace-pro.js?v=1", "utility-lab-tools.js?v=9", "feature-engines.js?v=2",
        "ai-center-advanced.js?v=2", "platform-p0.js?v=1", "system-platform.js?v=3"
      ]
    },
    dev: {
      styles: [
        "professional-tools.css?v=3", "dev-pro-suite.css?v=2", "dev-delivery-workflow.css?v=2", "dev-smart-recipe.css?v=1", "dev-api-studio.css?v=1",
        "dev-data-security.css?v=1", "dev-regex-database.css?v=1", "dev-code-git.css?v=1",
        "dev-diagnostics-ai.css?v=1"
      ],
      scripts: [
        "professional-tools.js?v=4", "dev-smart-recipe.js?v=1", "dev-api-studio.js?v=1",
        "dev-data-security.js?v=1", "dev-regex-database.js?v=1", "dev-code-git.js?v=1",
        "dev-diagnostics-ai.js?v=1", "dev-delivery-workflow.js?v=2", "dev-pro-suite.js?v=3"
      ]
    },
    media: {
      styles: [
        "media-design-pro.css?v=1", "media-design-page.css?v=11", "media-cosmos.css?v=2", "media-professional-suite.css?v=1", "media-next-suite.css?v=1", "media-production-workflow.css?v=3", "universal-media-project.css?v=1",
        "media-design-advanced.css?v=3", "media-design-publish.css?v=1",
        "photo-editor-pro.css?v=4", "editor-workflow-pro.css?v=2"
      ],
      scripts: [
        "media-design-studio.js?v=1", "media-design-pro.js?v=2", "media-design-advanced.js?v=3",
        "media-design-publish.js?v=1",
        "photo-editor-pro.js?v=3", "editor-workflow-pro.js?v=2", "universal-media-project.js?v=1",
        "media-production-workflow.js?v=3", "media-cosmos.js?v=2", "media-professional-suite.js?v=3", "vendor/vercel-blob-client.min.js?v=1", "media-next-suite.js?v=2", "media-design-page.js?v=13"
      ]
    },
    davinci: {
      styles: [
        "video-editor-studio.css?v=4", "video-editor-resolve.css?v=8",
        "editor-workflow-pro.css?v=2", "davinci-resolve-hub.css?v=4", "video-editor-auto.css?v=1", "h-cosmic-web-studio.css?v=2",
        "video-batch-factory.css?v=4", "youtube-publisher.css?v=4", "youtube-creator-galaxy.css?v=13"
      ],
      scripts: [
        "media-design-studio.js?v=1", "video-editor-studio.js?v=5", "video-batch-factory.js?v=3",
        "video-editor-resolve.js?v=10", "editor-workflow-pro.js?v=2",
        "davinci-resolve-hub.js?v=5", "video-editor-auto.js?v=1", "h-cosmic-web-studio.js?v=2",
        "youtube-publisher.js?v=7", "youtube-creator-galaxy.js?v=18"
      ]
    },
    "comic-motion": {
      // Compatibility: comic-motion-studio.css?v=3 comic-motion-studio.css?v=4 comic-motion-studio.css?v=5 comic-motion-studio.js?v=6 comic-motion-studio.js?v=7 comic-motion-studio.js?v=8 comic-motion-studio.js?v=9
      styles: ["comic-motion-studio.css?v=6"],
      scripts: ["vendor/jszip.min.js?v=3.10.1", "vendor/tesseract.min.js?v=6.0.1", "comic-motion-studio.js?v=10"]
    },
    graphic: {
      styles: ["graphic-design-studio.css?v=6", "graphic-design-universal.css?v=4"],
      scripts: [
        "graphic-design-animation.js?v=1", "graphic-design-3d.js?v=2", "graphic-design-prototype.js?v=1",
        "graphic-design-motion.js?v=1", "graphic-design-quick-motion.js?v=1", "graphic-design-mockup.js?v=1",
        "graphic-design-character.js?v=1", "graphic-design-vector-core.js?v=2", "graphic-design-state-machine.js?v=2",
        "graphic-design-adaptive.js?v=2", "graphic-design-project-store.js?v=2", "graphic-design-collaboration.js?v=2",
        "graphic-design-dev-ai.js?v=2", "graphic-design-composer.js?v=2", "graphic-design-workflow.js?v=2", "graphic-design-universal.js?v=5", "graphic-design-studio.js?v=7"
      ]
    },
    creative: {
      styles: ["creative-suite.css?v=6", "creative-os.css?v=4", "creative-galaxy.css?v=3", "creative-star-map.css?v=2", "ai-center-pro.css?v=1", "ai-center-advanced.css?v=1"],
      scripts: [
        "creative-os-core.js?v=4", "creative-galaxy.js?v=4", "creative-star-map.js?v=3", "creative-os.js?v=10", "creative-suite.js?v=7", "ai-center-advanced.js?v=2"
      ]
    },
    music: {
      styles: [
        "music-production-suite.css?v=3", "music-daw-workspace.css?v=1", "music-composer-lyrics.css?v=1",
        "music-audio-labs.css?v=1", "music-mix-master.css?v=1", "music-visual-studio.css?v=1",
        "music-publishing-rights.css?v=1", "music-intelligence-engine.css?v=1", "music-generative-arrangement.css?v=1",
        "music-adaptive-library.css?v=1", "music-mix-performance.css?v=1", "music-project-governance.css?v=1",
        "music-ai-studio.css?v=6", "music-ai-apps.css?v=2", "youtube-publisher.css?v=4"
      ],
      scripts: [
        "creative-os-core.js?v=4", "youtube-publisher.js?v=7", "music-daw-workspace.js?v=1", "music-composer-lyrics.js?v=1",
        "music-audio-labs.js?v=1", "music-mix-master.js?v=1", "music-visual-studio.js?v=2",
        "music-publishing-rights.js?v=1", "music-intelligence-engine.js?v=1", "music-generative-arrangement.js?v=1",
        "music-adaptive-library.js?v=1", "music-mix-performance.js?v=1", "music-project-governance.js?v=1",
        "music-production-suite.js?v=4", "music-ai-apps.js?v=3", "music-ai-studio.js?v=9"
      ]
    },
    communication: {
      styles: [
        "communication-overview.css?v=1", "communication-suite.css?v=2", "communication-workspace-fix.css?v=1",
        "communication-command-center.css?v=1", "communication-messenger-next.css?v=2",
        "communication-channels-forum.css?v=1", "communication-live-room.css?v=1",
        "communication-canvas-automation.css?v=1", "communication-intelligence.css?v=3",
        "community-social-pro.css?v=3", "community-platform-v2.css?v=10", "community-messenger-pro.css?v=1"
      ],
      scripts: [
        "communication-overview.js?v=2", "communication-command-center.js?v=2", "communication-messenger-next.js?v=2",
        "communication-channels-forum.js?v=2", "communication-live-room.js?v=1",
        "communication-canvas-automation.js?v=1", "communication-intelligence.js?v=3", "communication-suite.js?v=2",
        "community-social-pro.js?v=4", "community-platform-v2.js?v=12", "community-calls.js?v=1"
      ]
    },
    search: {
      styles: ["search-watch-center.css?v=5"],
      scripts: ["search-watch-center.js?v=7"]
    },
    work: {
      styles: ["work-center.css?v=4", "download-center-pro.css?v=1", "team-collaboration-pro.css?v=2"],
      scripts: ["team-collaboration-pro.js?v=2", "work-center.js?v=5"]
    },
    game: {
      styles: ["game-runtime.css?v=1", "astral-realms.css?v=76", "space-explorer.css?v=4", "game-center.css?v=5", "astra-universe-expansion.css?v=4", "game-arcade.css?v=4"],
      scripts: ["game-platform-adapters.js?v=1", "game-runtime.js?v=1", "astral-realms.js?v=88", "space-explorer.js?v=4", "game-center.js?v=5", "astra-universe-expansion.js?v=4", "game-arcade.js?v=4"]
    },
    // Compatibility asset aliases for clients upgrading from Entertainment v4:
    // "game-center.css?v=4" "game-center.js?v=4"
    learning: {
      styles: [
        "learning-suite.css?v=3", "learning-home.css?v=2", "learning-paths.css?v=3", "learning-review.css?v=3",
        "learning-lesson-player.css?v=2", "learning-coach-labs.css?v=3", "learning-classroom.css?v=3"
      ],
      scripts: [
        "learning-platform-core.js?v=5", "learning-home.js?v=2", "learning-paths.js?v=3", "learning-review.js?v=3",
        "learning-lesson-player.js?v=2", "learning-coach-labs.js?v=3", "learning-classroom.js?v=4", "learning-suite.js?v=3"
      ]
    },
    english: {
      styles: ["english-learning.css?v=12", "english-galaxy.css?v=1", "english-voice-coach.css?v=4", "english-learning-galaxy.css?v=1"],
      scripts: ["english-curriculum.js?v=1", "english-career-expansion.js?v=1", "english-career-curriculum.js?v=2", "english-galaxy.js?v=1", "english-learning-galaxy.js?v=1", "english-learning.js?v=17"]
    },
    japanese: {
      styles: ["japanese-learning.css?v=7"],
      scripts: ["japanese-vocabulary-packs.js?v=1", "japanese-vocabulary-10k.js?v=1", "japanese-learning.js?v=7"]
    },
    analytics: {
      styles: ["insights-pro.css?v=3"],
      scripts: ["insights-pro.js?v=7"]
    },
    admin: {
      styles: ["community-admin.css?v=9"],
      scripts: ["community-admin.js?v=11"]
    },
    support: {
      styles: ["support-platform.css?v=10"],
      scripts: ["https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js", "support-platform.js?v=14"]
    }
  });

  const loaded = new Set();
  const pending = new Map();
  const assetPromises = new Map();
  const preloadedScripts = new Set();
  let homeEnhancementsScheduled = false;
  const STYLE_TIMEOUT_MS = 15000;
  const SCRIPT_TIMEOUT_MS = 20000;

  function normalizeRoute(route) {
    const value = String(route || global.location.hash.replace(/^#/, "") || "/home");
    return value.startsWith("/") ? value : `/${value}`;
  }

  function groupsForRoute(route) {
    const value = normalizeRoute(route);
    if (value === "/home") return [];
    if (value.startsWith("/dev-tools")) return ["dev"];
    if (value.startsWith("/davinci-resolve")) return ["davinci"];
    if (value.startsWith("/comic-motion-studio")) return ["comic-motion"];
    if (value.startsWith("/media-design")) return ["media"];
    if (value.startsWith("/graphic-design")) return ["graphic"];
    if (value.startsWith("/music-ai")) return ["music"];
    if (value.startsWith("/entertainment")) return ["game"];
    if (value.startsWith("/learn")) return ["learning"];
    if (value.startsWith("/english")) return ["english"];
    if (value.startsWith("/japanese")) return ["japanese"];
    if (value.startsWith("/support")) return ["support"];
    if (value === "/communication/google-youtube") return ["search"];
    if (value.startsWith("/communication")) return ["communication"];
    if (value.startsWith("/work")) return ["work"];
    if (value === "/admin" || value.startsWith("/admin/") || value === "/analytics/admin-panel") return ["analytics", "admin"];
    if (value.startsWith("/analytics")) return ["analytics"];
    if (value.startsWith("/create")) return ["creative", "platform"];
    if (value.startsWith("/system") || value.startsWith("/tools") || value === "/favorites" || value === "/recent") return ["platform"];
    return [];
  }

  function loadStyle(url) {
    const key = `style:${url}`;
    if (assetPromises.has(key)) return assetPromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      let settled = false;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        if (error) {
          link.remove();
          assetPromises.delete(key);
          reject(error);
        } else resolve(url);
      };
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.hhRuntimeAsset = "style";
      link.onload = () => finish();
      link.onerror = () => finish(new Error(`Không tải được giao diện ${url}.`));
      const timer = global.setTimeout(() => finish(new Error(`Giao diện ${url} tải quá thời gian cho phép.`)), STYLE_TIMEOUT_MS);
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
      let settled = false;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        if (error) {
          script.remove();
          assetPromises.delete(key);
          reject(error);
        } else resolve(url);
      };
      script.src = url;
      script.async = false;
      script.dataset.hhRuntimeAsset = "script";
      script.onload = () => {
        script.dataset.loaded = "true";
        finish();
      };
      script.onerror = () => finish(new Error(`Không tải được chức năng ${url}.`));
      const timer = global.setTimeout(() => finish(new Error(`Chức năng ${url} tải quá thời gian cho phép.`)), SCRIPT_TIMEOUT_MS);
      document.head.append(script);
    });
    assetPromises.set(key, promise);
    return promise;
  }

  function preloadScripts(urls = []) {
    urls.forEach((url) => {
      if (!url || preloadedScripts.has(url) || assetPromises.has(`script:${url}`)) return;
      preloadedScripts.add(url);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "script";
      link.href = url;
      link.fetchPriority = "low";
      link.dataset.hhRuntimeAsset = "script-preload";
      document.head.append(link);
    });
  }

  function ensureGroup(name) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (pending.has(name)) return pending.get(name);
    const group = groups[name];
    if (!group) return Promise.resolve(name);
    if (name === "home-enhancements") preloadScripts(group.scripts);
    const stylePromise = Promise.all((group.styles || []).map(loadStyle));
    const scriptPromise = (group.scripts || []).reduce(
      (chain, url) => chain
        .then(() => loadScript(url))
        .then(() => name === "home-enhancements"
          ? new Promise((resolve) => global.setTimeout(resolve, 80))
          : undefined),
      Promise.resolve()
    );
    const promise = Promise.all([stylePromise, scriptPromise]).then(() => {
      loaded.add(name);
      pending.delete(name);
      global.dispatchEvent(new CustomEvent("hh:asset-group-ready", { detail: { group: name } }));
      return name;
    }).catch((error) => {
      pending.delete(name);
      loaded.delete(name);
      global.dispatchEvent(new CustomEvent("hh:asset-group-error", { detail: { group: name, message: String(error?.message || error) } }));
      throw error;
    });
    pending.set(name, promise);
    return promise;
  }

  function scheduleHomeEnhancements() {
    if (homeEnhancementsScheduled || loaded.has("home-enhancements")) return;
    homeEnhancementsScheduled = true;
    const start = () => {
      if (document.hidden) {
        homeEnhancementsScheduled = false;
        return;
      }
      ensureGroup("home-enhancements").catch(() => {
        homeEnhancementsScheduled = false;
      });
    };
    const afterFirstPaint = () => {
      if ("requestIdleCallback" in global) global.requestIdleCallback(start, { timeout: 1600 });
      else global.setTimeout(start, 450);
    };
    global.requestAnimationFrame(() => global.requestAnimationFrame(afterFirstPaint));
  }

  function ensureForRoute(route) {
    const value = normalizeRoute(route);
    const names = groupsForRoute(value);
    document.body?.classList.add("hh-assets-loading");
    global.dispatchEvent(new CustomEvent("hh:assets-loading", { detail: { route: value, groups: names } }));
    return Promise.all(names.map(ensureGroup)).then(() => {
      document.body?.classList.remove("hh-assets-loading");
      global.dispatchEvent(new CustomEvent("hh:assets-ready", { detail: { route: value, groups: names } }));
      if (value === "/home") scheduleHomeEnhancements();
      return value;
    }).catch((error) => {
      document.body?.classList.remove("hh-assets-loading");
      throw error;
    });
  }

  function isRouteReady(route) {
    return groupsForRoute(route).every((name) => loaded.has(name));
  }

  function retryForRoute(route) {
    const value = normalizeRoute(route);
    groupsForRoute(value).forEach((name) => {
      loaded.delete(name);
      pending.delete(name);
    });
    return ensureForRoute(value);
  }

  function loadFontWhenIdle() {
    const start = () => loadStyle("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap").catch(() => {});
    if ("requestIdleCallback" in global) global.requestIdleCallback(start, { timeout: 2500 });
    else global.setTimeout(start, 900);
  }

  function loadAuthEffectsWhenNeeded() {
    let started = false;
    const start = () => {
      if (started || !document.body?.classList.contains("auth-locked")) return;
      started = true;
      ensureGroup("auth-effects").then(() => {
        global.HHCosmicPrismBackground?.mount?.();
        global.HHCosmicPrismForm?.mount?.();
        global.HHCosmicPrismInteractions?.mount?.();
      }).catch(() => {});
    };
    /*
     * Keep the authentication form responsive on slower desktop GPUs and
     * browsers with heavy extensions. The visual universe is opt-in: first
     * paint keeps the lightweight showcase, while the motion control
     * explicitly requests the richer scene. Login, Google OAuth and guest
     * mode never compete with its canvases, filters or observers.
     */
    const requestEffects = (event) => {
      if (event.target?.closest?.("[data-auth-motion-toggle]")) start();
    };
    document.addEventListener("click", requestEffects, { capture: true });
    global.addEventListener("hh:auth-change", (event) => {
      if (event.detail?.user) document.removeEventListener("click", requestEffects, { capture: true });
    }, { once: true });
  }

  function registerServiceWorkerWhenIdle() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(global.location.protocol)) return;
    const register = () => navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none"
    }).then((registration) => registration.update()).catch(() => {});
    const schedule = () => {
      if ("requestIdleCallback" in global) global.requestIdleCallback(register, { timeout: 4000 });
      else global.setTimeout(register, 1800);
    };
    if (document.readyState === "complete") schedule();
    else global.addEventListener("load", schedule, { once: true });
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
    if (!document.hidden && document.body?.classList.contains("auth-unlocked") && normalizeRoute() === "/home") {
      scheduleHomeEnhancements();
    }
  });

  global.addEventListener("hh:auth-change", (event) => {
    if (event.detail?.user && normalizeRoute() === "/home") scheduleHomeEnhancements();
  });
  global.addEventListener("hh:route-rendered", (event) => {
    if (event.detail?.route === "/home") scheduleHomeEnhancements();
  });

  global.HHAssetLoader = Object.freeze({ ensureForRoute, retryForRoute, ensureGroup, isRouteReady, groupsForRoute, loadedGroups: () => [...loaded] });
  loadFontWhenIdle();
  loadAuthEffectsWhenNeeded();
  registerServiceWorkerWhenIdle();
})(window);
