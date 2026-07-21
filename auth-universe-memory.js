(() => {
  "use strict";

  const STORAGE_KEY = "hh.auth.universe-memory.v1";
  const SHELL_RECENT_KEY = "hh.app-shell.recent";
  const PENDING_ROUTE_KEY = "hh.auth.pending-route";
  const MAX_ITEMS = 5;
  const PLANETS = Object.freeze({
    ai: { route: "/create/ai-center", title: "AI Center", mark: "AI" },
    script: { route: "/create/ai-script", title: "Kịch bản AI", mark: "KS" },
    media: { route: "/media-design", title: "Media & Design", mark: "MD" },
    dev: { route: "/dev-tools", title: "DEV Toolkit", mark: "DV" },
    community: { route: "/communication/community", title: "Cộng đồng HH", mark: "CM" }
  });
  const WORKSPACE_NAMES = Object.freeze({
    home: "Command Center",
    create: "Sáng tạo",
    "music-ai": "Làm nhạc AI",
    "media-design": "Media & Design",
    "graphic-design": "Thiết kế đồ họa",
    "dev-tools": "DEV",
    work: "Công việc",
    communication: "Giao tiếp",
    entertainment: "Giải trí",
    analytics: "Phân tích",
    learn: "Học tập",
    english: "HH English",
    system: "Hệ thống",
    support: "Ủng hộ nhà phát triển"
  });

  const boot = () => {
    const gate = document.querySelector("#authGate");
    if (!gate) {
      window.HHUniverseMemory = Object.freeze({ available: false });
      return;
    }
    if (gate.dataset.authUniverseMemoryReady === "true") return;

    const universe = gate.querySelector(".auth-feature-switcher");
    const showcase = universe?.closest(".auth-feature-showcase");
    const card = gate.querySelector("[data-auth-card], .auth-gate-card");
    if (!universe || !card) {
      window.HHUniverseMemory = Object.freeze({ available: false });
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listeners = [];
    const timers = new Set();
    let selectedId = "";
    let selectedRoute = "";
    let morphTimer = 0;
    let navigating = false;
    let destroyed = false;

    const on = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    const delay = (milliseconds) => new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, milliseconds);
      timers.add(timer);
    });

    const readJSON = (key, fallback) => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        return value ?? fallback;
      } catch {
        return fallback;
      }
    };

    const normalizeRoute = (value) => {
      let route = String(value || "").trim().replace(/^#/, "");
      if (!route || route === "top" || route === "account") return "/home";
      if (!route.startsWith("/")) route = `/${route}`;
      if (route.length > 280 || /[\u0000-\u001f<>"'`]/.test(route)) return "";
      return route;
    };

    const hashForRoute = (route) => `#${normalizeRoute(route) || "/home"}`;
    const workspaceForRoute = (route) => WORKSPACE_NAMES[normalizeRoute(route).split("/").filter(Boolean)[0]] || "HH Platform";
    const titleFromSlug = (slug) => String(slug || "Trang chủ")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toLocaleUpperCase("vi") + part.slice(1))
      .join(" ");

    const titleForRoute = (route) => {
      const normalized = normalizeRoute(route);
      const planet = Object.values(PLANETS).find((item) => item.route === normalized);
      if (planet) return planet.title;

      const routeControl = [...document.querySelectorAll("[data-app-route]")]
        .find((node) => normalizeRoute(node.dataset.appRoute) === normalized);
      const controlTitle = routeControl?.querySelector("strong, b, span")?.textContent?.trim() || routeControl?.textContent?.trim();
      if (controlTitle) return controlTitle.replace(/\s+/g, " ").slice(0, 80);

      const currentRoute = normalizeRoute(location.hash);
      const currentHeading = currentRoute === normalized ? document.querySelector("#appPageHeader h1, .app-page-header h1")?.textContent?.trim() : "";
      if (currentHeading) return currentHeading.slice(0, 80);

      const moduleId = normalized.split("/").filter(Boolean).at(-1);
      const module = Array.isArray(window.HH_PLATFORM_MODULES)
        ? window.HH_PLATFORM_MODULES.find((item) => item.id === moduleId)
        : null;
      return String(module?.title || titleFromSlug(moduleId)).slice(0, 80);
    };

    const sanitizeEntry = (entry) => {
      const route = normalizeRoute(entry?.route);
      if (!route) return null;
      const visitedAt = Number.isFinite(Number(entry?.visitedAt)) ? Number(entry.visitedAt) : Date.now();
      return {
        route,
        title: String(entry?.title || titleForRoute(route)).slice(0, 80),
        workspace: String(entry?.workspace || workspaceForRoute(route)).slice(0, 60),
        visitedAt
      };
    };

    const readMemory = () => {
      const raw = readJSON(STORAGE_KEY, []);
      if (!Array.isArray(raw)) return [];
      const seen = new Set();
      return raw.map(sanitizeEntry).filter((entry) => {
        if (!entry || seen.has(entry.route)) return false;
        seen.add(entry.route);
        return true;
      }).sort((a, b) => b.visitedAt - a.visitedAt).slice(0, MAX_ITEMS);
    };

    const writeMemory = (items) => {
      const next = items.map(sanitizeEntry).filter(Boolean).slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    };

    const routeFromRecentModule = (moduleId) => {
      const id = String(moduleId || "").trim();
      if (!id) return "";
      const routeControl = [...document.querySelectorAll("[data-app-route]")].find((node) => {
        const route = normalizeRoute(node.dataset.appRoute);
        return route && route.split("/").filter(Boolean).at(-1) === id;
      });
      if (routeControl) return normalizeRoute(routeControl.dataset.appRoute);
      if (id === "ai-center" || id === "ai-script" || id === "creator-studio" || id === "media-center" || id === "ai-automation") return `/create/${id}`;
      if (id === "community" || id === "notification-center" || id === "user-dashboard") return `/communication/${id}`;
      if (id === "project-center" || id === "download-center" || id === "knowledge-center" || id === "team-collaboration") return `/work/${id}`;
      return "";
    };

    const importExistingHistory = () => {
      const memory = readMemory();
      const seen = new Set(memory.map((entry) => entry.route));
      const recentIds = readJSON(SHELL_RECENT_KEY, []);
      if (Array.isArray(recentIds)) {
        recentIds.forEach((id, index) => {
          const route = routeFromRecentModule(id);
          if (!route || seen.has(route) || memory.length >= MAX_ITEMS) return;
          seen.add(route);
          memory.push(sanitizeEntry({ route, visitedAt: Date.now() - (index + 1) * 1000 }));
        });
      }

      const lastProfile = readJSON("hh.auth.last-profile", {});
      const profileRoute = normalizeRoute(lastProfile?.lastProjectRoute || "");
      if (profileRoute && profileRoute !== "/home" && !seen.has(profileRoute) && memory.length < MAX_ITEMS) {
        memory.push(sanitizeEntry({ route: profileRoute, workspace: lastProfile.lastWorkspace }));
      }
      return writeMemory(memory.filter(Boolean));
    };

    const remember = (route, metadata = {}) => {
      const normalized = normalizeRoute(route);
      if (!normalized || normalized === "/home" && metadata.skipHome) return readMemory();
      const entry = sanitizeEntry({
        route: normalized,
        title: metadata.title || titleForRoute(normalized),
        workspace: metadata.workspace || workspaceForRoute(normalized),
        visitedAt: metadata.visitedAt || Date.now()
      });
      const next = writeMemory([entry, ...readMemory().filter((item) => item.route !== normalized)]);
      render(next);
      return next;
    };

    const relativeTime = (timestamp) => {
      const delta = Math.max(0, Date.now() - Number(timestamp || Date.now()));
      if (delta < 60000) return "vừa xong";
      if (delta < 3600000) return `${Math.floor(delta / 60000)} phút trước`;
      if (delta < 86400000) return `${Math.floor(delta / 3600000)} giờ trước`;
      return `${Math.floor(delta / 86400000)} ngày trước`;
    };

    const markForRoute = (route) => {
      const id = planetIdForRoute(route);
      return PLANETS[id]?.mark || workspaceForRoute(route).slice(0, 2).toLocaleUpperCase("vi");
    };

    const ribbon = document.createElement("section");
    ribbon.className = "auth-memory-ribbon";
    ribbon.dataset.authMemoryRibbon = "";
    ribbon.setAttribute("aria-label", "Tiếp tục công việc gần đây");
    ribbon.innerHTML = `
      <header class="auth-memory-ribbon__head">
        <span>Memory Ribbon</span>
        <button class="auth-memory-ribbon__clear" type="button" data-auth-memory-clear>Xóa lịch sử</button>
      </header>
      <div data-auth-memory-content></div>
    `;

    const content = ribbon.querySelector("[data-auth-memory-content]");
    const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[character]));

    const render = (providedItems) => {
      if (!content) return [];
      const items = Array.isArray(providedItems) ? providedItems.slice(0, MAX_ITEMS) : readMemory();
      if (!items.length) {
        content.innerHTML = '<p class="auth-memory-ribbon__empty">Các workspace bạn thực sự mở sẽ xuất hiện tại đây để tiếp tục trên lần đăng nhập sau.</p>';
        ribbon.classList.add("is-empty");
        return items;
      }

      ribbon.classList.remove("is-empty");
      const current = items[0];
      const pending = normalizeRoute(selectedRoute || sessionStorage.getItem(PENDING_ROUTE_KEY));
      content.innerHTML = `
        <div class="auth-memory-ribbon__current">
          <span class="auth-memory-ribbon__mark" aria-hidden="true">${escapeHTML(markForRoute(current.route))}</span>
          <span class="auth-memory-ribbon__copy"><strong>${escapeHTML(current.title)}</strong><small>${escapeHTML(current.workspace)} · ${escapeHTML(relativeTime(current.visitedAt))}</small></span>
          <button class="auth-memory-ribbon__continue" type="button" data-auth-memory-continue="${escapeHTML(current.route)}">Tiếp tục →</button>
        </div>
        <nav class="auth-memory-ribbon__list" aria-label="Lịch sử workspace">
          ${items.map((item) => `<button class="auth-memory-ribbon__item" type="button" data-auth-memory-route="${escapeHTML(item.route)}" aria-current="${String(item.route === pending)}" title="${escapeHTML(item.workspace)} · ${escapeHTML(item.title)}"><b aria-hidden="true">${escapeHTML(markForRoute(item.route))}</b><span>${escapeHTML(item.title)}</span></button>`).join("")}
        </nav>
      `;
      return items;
    };

    const planetIdForRoute = (route) => {
      const normalized = normalizeRoute(route);
      if (normalized === "/create/ai-script") return "script";
      if (normalized.startsWith("/create")) return "ai";
      if (normalized.startsWith("/media-design") || normalized.startsWith("/graphic-design")) return "media";
      if (normalized.startsWith("/dev-tools")) return "dev";
      if (normalized.startsWith("/communication")) return "community";
      return "";
    };

    const resetMorph = () => {
      if (morphTimer) {
        clearTimeout(morphTimer);
        timers.delete(morphTimer);
        morphTimer = 0;
      }
      universe.classList.remove("is-universe-morphing");
      universe.querySelectorAll(".is-selected-planet").forEach((planet) => planet.classList.remove("is-selected-planet"));
    };

    const morphPlanet = (id, hold = false) => {
      const planet = universe.querySelector(`[data-auth-demo="${id}"]`);
      if (!planet) return null;
      resetMorph();
      universe.classList.add("is-universe-morphing");
      planet.classList.add("is-selected-planet");
      if (!hold && !reducedMotion.matches) {
        morphTimer = window.setTimeout(resetMorph, 620);
        timers.add(morphTimer);
      } else if (!hold) {
        resetMorph();
      }
      return planet;
    };

    const select = (id, options = {}) => {
      const config = PLANETS[id];
      const route = normalizeRoute(options.route || config?.route);
      if (!config || !route) return false;
      selectedId = id;
      selectedRoute = route;
      sessionStorage.setItem(PENDING_ROUTE_KEY, hashForRoute(route));
      universe.querySelectorAll("[data-auth-demo]").forEach((button) => {
        button.classList.toggle("is-pending-route", button.dataset.authDemo === id);
      });
      morphPlanet(id);
      render();
      return true;
    };

    const navigateWithTransition = async (route, id = planetIdForRoute(route)) => {
      const normalized = normalizeRoute(route);
      if (!normalized || navigating) return false;
      navigating = true;
      const destination = document.querySelector("#appShell");
      const selectedPlanet = id ? morphPlanet(id, true) : null;
      const applyRoute = () => {
        destination?.classList.add("auth-universe-transition-target");
        if (location.hash !== hashForRoute(normalized)) location.hash = hashForRoute(normalized);
      };
      const cleanup = () => {
        resetMorph();
        destination?.classList.remove("auth-universe-transition-target");
        document.documentElement.classList.remove("auth-universe-transitioning");
        document.body.classList.remove("auth-universe-fallback-out");
        selectedPlanet?.style.removeProperty("view-transition-name");
        navigating = false;
      };

      document.documentElement.classList.add("auth-universe-transitioning");
      try {
        if (typeof document.startViewTransition === "function" && !reducedMotion.matches && document.visibilityState === "visible") {
          if (selectedPlanet) selectedPlanet.style.setProperty("view-transition-name", "hh-auth-universe-planet");
          const transition = document.startViewTransition(applyRoute);
          await transition.finished;
        } else if (!reducedMotion.matches) {
          document.body.classList.add("auth-universe-fallback-out");
          await delay(190);
          applyRoute();
          await delay(230);
        } else {
          applyRoute();
        }
      } catch {
        applyRoute();
      } finally {
        cleanup();
      }
      return true;
    };

    const selectRoute = (route, source = "memory") => {
      const normalized = normalizeRoute(route);
      if (!normalized) return false;
      const id = planetIdForRoute(normalized);
      selectedId = id;
      selectedRoute = normalized;
      sessionStorage.setItem(PENDING_ROUTE_KEY, hashForRoute(normalized));
      if (id) select(id, { route: normalized, source });
      else render();

      if (document.body.classList.contains("auth-unlocked")) navigateWithTransition(normalized, id);
      else gate.querySelector("#gateLoginForm input[name='email']")?.focus({ preventScroll: true });
      return true;
    };

    const clearHistory = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SHELL_RECENT_KEY);
      } catch {}
      selectedRoute = "";
      selectedId = "";
      sessionStorage.removeItem(PENDING_ROUTE_KEY);
      universe.querySelectorAll(".is-pending-route").forEach((button) => button.classList.remove("is-pending-route"));
      render([]);
      return true;
    };

    universe.classList.add("auth-universe");
    showcase?.classList.add("auth-universe-showcase");
    universe.querySelectorAll("[data-auth-demo]").forEach((button) => {
      button.classList.add("auth-universe-planet");
      const config = PLANETS[button.dataset.authDemo];
      if (config) button.dataset.authUniverseRoute = config.route;
    });
    card.querySelector("[data-returning-user]")?.insertAdjacentElement("afterend", ribbon);
    if (!ribbon.isConnected) card.querySelector(".auth-mode-tabs")?.insertAdjacentElement("beforebegin", ribbon);

    on(universe, "click", (event) => {
      const planet = event.target.closest("[data-auth-demo]");
      if (!planet || !universe.contains(planet)) return;
      const id = planet.dataset.authDemo;
      const config = PLANETS[id];
      if (!config) return;
      window.dispatchEvent(new CustomEvent("hh:auth-universe-select", {
        detail: { id, route: config.route, title: config.title, source: "planet" }
      }));
    });

    on(window, "hh:auth-universe-select", (event) => {
      const detail = event.detail || {};
      if (detail.id && PLANETS[detail.id]) select(detail.id, { route: detail.route, source: detail.source });
      else if (detail.route) selectRoute(detail.route, detail.source || "event");
    });

    on(ribbon, "click", (event) => {
      const clearButton = event.target.closest("[data-auth-memory-clear]");
      if (clearButton) {
        clearHistory();
        return;
      }
      const routeButton = event.target.closest("[data-auth-memory-route], [data-auth-memory-continue]");
      if (!routeButton) return;
      selectRoute(routeButton.dataset.authMemoryRoute || routeButton.dataset.authMemoryContinue, "memory");
    });

    on(window, "hashchange", () => {
      const route = normalizeRoute(location.hash);
      if (!route || !document.body.classList.contains("auth-unlocked")) return;
      remember(route);
    });

    on(window, "hh:auth-change", (event) => {
      if (!event.detail?.user) return;
      const pending = normalizeRoute(selectedRoute || sessionStorage.getItem(PENDING_ROUTE_KEY));
      if (pending) navigateWithTransition(pending, selectedId || planetIdForRoute(pending));
    });

    on(window, "storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === SHELL_RECENT_KEY) render(importExistingHistory());
    });

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      listeners.splice(0).forEach((remove) => remove());
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      resetMorph();
      ribbon.remove();
      universe.classList.remove("auth-universe");
      showcase?.classList.remove("auth-universe-showcase");
      universe.querySelectorAll("[data-auth-demo]").forEach((button) => {
        button.classList.remove("auth-universe-planet", "is-pending-route", "is-selected-planet");
        delete button.dataset.authUniverseRoute;
      });
      gate.classList.remove("auth-universe-memory-ready");
      delete gate.dataset.authUniverseMemoryReady;
    };

    on(window, "pagehide", (event) => {
      if (!event.persisted) destroy();
    });

    gate.classList.add("auth-universe-memory-ready");
    gate.dataset.authUniverseMemoryReady = "true";
    const initialMemory = importExistingHistory();
    if (document.body.classList.contains("auth-unlocked")) remember(location.hash, { skipHome: false });
    else render(initialMemory);

    window.HHUniverseMemory = Object.freeze({
      available: true,
      maxItems: MAX_ITEMS,
      getHistory: () => readMemory().map((entry) => ({ ...entry })),
      remember,
      select: (id, route) => select(id, { route, source: "api" }),
      continueRoute: (route) => selectRoute(route || readMemory()[0]?.route, "api"),
      clear: clearHistory,
      refresh: () => render(importExistingHistory()),
      destroy
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
