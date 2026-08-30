(() => {
  "use strict";

  if (window.HHGalaxyLogo?.available) {
    window.HHGalaxyLogo.refresh?.();
    return;
  }

  const MARKER = "[data-hh-galaxy-logo]";
  const VARIANTS = new Set(["default", "compact", "card", "hero"]);
  const PULSES = new Set(["route", "success", "error", "attention"]);
  const records = new WeakMap();
  const mountedHosts = new Set();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
  const scriptBase = document.currentScript?.src || document.baseURI;
  const coreAsset = new URL("assets/brand/hh-galaxy-star-static.svg?v=2", scriptBase).href;
  let refreshFrame = 0;

  const isElement = (value) => value instanceof Element;

  const createElement = (tag, className) => {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  };

  const createLogo = (options = {}) => {
    const logo = createElement("span", "hh-galaxy-logo");
    const variant = VARIANTS.has(options.variant) ? options.variant : "default";
    logo.dataset.galaxyLogoMounted = "true";
    logo.dataset.galaxyLogoVariant = variant;

    if (options.decorative === false) {
      logo.setAttribute("role", "img");
      logo.setAttribute("aria-label", options.label || "HH Galaxy Star");
    } else {
      logo.setAttribute("aria-hidden", "true");
    }

    if (typeof options.size === "string" && /^\d+(?:\.\d+)?(?:px|rem|em|vw|vh)$/.test(options.size.trim())) {
      logo.style.setProperty("--hh-galaxy-logo-size", options.size.trim());
    }

    const aura = createElement("span", "hh-galaxy-logo__aura");
    const nebula = createElement("span", "hh-galaxy-logo__nebula");
    const disc = createElement("span", "hh-galaxy-logo__disc");
    const image = createElement("img", "hh-galaxy-logo__core");
    const scan = createElement("span", "hh-galaxy-logo__scan");
    const primaryOrbit = createElement("span", "hh-galaxy-logo__orbit");
    const counterOrbit = createElement("span", "hh-galaxy-logo__orbit hh-galaxy-logo__orbit--counter");
    const sparks = createElement("span", "hh-galaxy-logo__sparks");

    image.src = coreAsset;
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    for (let index = 0; index < 6; index += 1) sparks.append(document.createElement("i"));

    disc.append(image, scan);
    logo.append(aura, nebula, disc, primaryOrbit, counterOrbit, sparks);
    return logo;
  };

  const optionsForHost = (host, options = {}) => ({
    variant: options.variant || host.dataset.galaxyLogoVariant || "default",
    size: options.size || host.dataset.galaxyLogoSize || "",
    decorative: options.decorative ?? host.dataset.galaxyLogoDecorative !== "false",
    label: options.label || host.dataset.galaxyLogoLabel || "HH Galaxy Star"
  });

  const syncPausedState = () => {
    const paused = document.hidden || Boolean(reducedMotion?.matches);
    mountedHosts.forEach((host) => {
      const record = records.get(host);
      if (!record || !host.isConnected) {
        mountedHosts.delete(host);
        return;
      }
      record.logo.dataset.galaxyLogoPaused = String(paused);
    });
  };

  const collectHosts = (target) => {
    if (!target) return [];
    if (typeof target === "string") return [...document.querySelectorAll(target)];
    if (isElement(target)) return [target];
    if (target instanceof Document || target instanceof DocumentFragment) {
      return [...target.querySelectorAll(MARKER)];
    }
    if (typeof target[Symbol.iterator] === "function") return [...target].filter(isElement);
    return [];
  };

  const mount = (target, options = {}) => {
    const hosts = collectHosts(target || document).filter((host) => isElement(host));
    const mounted = [];

    hosts.forEach((host) => {
      let record = records.get(host);
      if (record?.logo?.isConnected) {
        mounted.push(record.logo);
        return;
      }

      const existing = [...host.children].find((child) => child.matches?.(".hh-galaxy-logo[data-galaxy-logo-mounted]"));
      const logo = existing || createLogo(optionsForHost(host, options));
      host.classList.add("hh-galaxy-logo-host");
      if (!existing) host.append(logo);

      record = { logo, pulseTimer: 0 };
      records.set(host, record);
      mountedHosts.add(host);
      mounted.push(logo);
    });

    syncPausedState();
    return mounted;
  };

  const refresh = (scope = document) => {
    mountedHosts.forEach((host) => {
      if (!host.isConnected) mountedHosts.delete(host);
    });

    const hosts = [];
    if (isElement(scope) && scope.matches(MARKER)) hosts.push(scope);
    if (scope?.querySelectorAll) hosts.push(...scope.querySelectorAll(MARKER));
    return mount([...new Set(hosts)]);
  };

  const resolveLogos = (target) => {
    if (!target) {
      return [...mountedHosts].map((host) => records.get(host)?.logo).filter(Boolean);
    }
    return collectHosts(target).map((element) => {
      if (element.matches(".hh-galaxy-logo")) return element;
      return records.get(element)?.logo || element.querySelector?.(".hh-galaxy-logo[data-galaxy-logo-mounted]");
    }).filter(Boolean);
  };

  const pulse = (target, requestedVariant = "route") => {
    const variant = PULSES.has(requestedVariant) ? requestedVariant : "route";
    const logos = resolveLogos(target);

    logos.forEach((logo) => {
      const host = logo.closest(".hh-galaxy-logo-host");
      const record = host ? records.get(host) : null;
      if (record?.pulseTimer) window.clearTimeout(record.pulseTimer);
      logo.removeAttribute("data-galaxy-logo-pulse");
      void logo.offsetWidth;
      logo.dataset.galaxyLogoPulse = variant;
      const timer = window.setTimeout(() => logo.removeAttribute("data-galaxy-logo-pulse"), 760);
      if (record) record.pulseTimer = timer;
    });

    return logos.length;
  };

  const scheduleRefresh = (scope) => {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      refresh(scope?.isConnected ? scope : document);
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        scheduleRefresh(mutation.target);
        return;
      }
      for (const node of mutation.addedNodes) {
        if (isElement(node) && (node.matches(MARKER) || node.querySelector(MARKER))) {
          scheduleRefresh(node);
          return;
        }
      }
    }
  });

  document.addEventListener("visibilitychange", syncPausedState, { passive: true });
  reducedMotion?.addEventListener?.("change", syncPausedState);

  const start = () => {
    refresh(document);
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-hh-galaxy-logo"]
      });
    }

    const authGate = document.querySelector("#authGate");
    authGate?.addEventListener("hh:auth-success", () => {
      pulse(authGate.querySelectorAll(MARKER), "success");
    });
    authGate?.addEventListener("hh:auth-error", () => {
      pulse(authGate.querySelectorAll(MARKER), "error");
    });
    window.addEventListener("hh:route-transition-start", () => {
      pulse(document.querySelectorAll(`${MARKER}[data-galaxy-logo-pulse-on~="route"]`), "route");
    });
  };

  window.HHGalaxyLogo = Object.freeze({
    available: true,
    mount,
    refresh,
    pulse
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
