(function hhCoreGatewayBootstrap(root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHCoreGateway = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHHCoreGateway(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.core-gateway.v1";
  const GATEWAY_ROUTE = "/home";
  const PLATFORM_ENTRY_ROUTE = "/create";
  const ENTRY_SOURCE = "hh-core";
  // sessionStorage can be unavailable in privacy-restricted embeds and some
  // browser restore states. Keep a page-lifetime fallback bound to the exact
  // storage object that failed so an explicit HH CORE click can still open
  // Layer Two without turning the grant into a persistent/global bypass.
  let volatileRecord = null;
  let volatileStorage = null;
  const GALAXY_MANIFEST = Object.freeze([
    "/home",
    "/galaxy/ai",
    "/galaxy/music",
    "/galaxy/video",
    "/galaxy/creator",
    "/galaxy/games",
    "/galaxy/dev",
    "/galaxy/learning",
    "/galaxy/community",
    "/galaxy/tools",
    "/galaxy/analytics",
    "/galaxy/settings"
  ]);
  const CORE_ROUTE_PREFIXES = Object.freeze([
    "/home/dashboard",
    "/create",
    "/social-media-tools",
    "/draw",
    "/remote",
    "/chat-ai",
    "/google",
    "/youtube",
    "/discord",
    "/music-ai",
    "/davinci-resolve",
    "/comic-motion-studio",
    "/comic-reader",
    "/media-design",
    "/graphic-design",
    "/dev-tools",
    "/work",
    "/communication",
    "/cinema",
    "/music",
    "/universe",
    "/cosmic-observatory",
    "/play",
    "/game",
    "/entertainment",
    "/character-3d",
    "/copyright",
    "/analytics",
    "/admin",
    "/learn",
    "/english",
    "/japanese",
    "/chinese",
    "/phat-phap",
    "/fortune",
    "/system",
    "/support",
    "/tools",
    "/favorites",
    "/recent",
    "/settings",
    "/profile"
  ]);

  function normalizeRoute(input) {
    let value = String(input || GATEWAY_ROUTE).trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        value = parsed.hash ? parsed.hash.slice(1) : parsed.pathname;
      } catch {
        value = GATEWAY_ROUTE;
      }
    }
    if (value.startsWith("#")) value = value.slice(1);
    value = value.split("?")[0].split("#")[0] || GATEWAY_ROUTE;
    value = value.startsWith("/") ? value : `/${value}`;
    value = value.replace(/\/{2,}/g, "/");
    return value.length > 1 ? value.replace(/\/+$/, "") : value;
  }

  function storage(candidate) {
    if (candidate) return candidate;
    try { return globalScope.sessionStorage || null; }
    catch { return null; }
  }

  function isGalaxyRoute(input) {
    return GALAXY_MANIFEST.includes(normalizeRoute(input));
  }

  function isCoreRoute(input) {
    const requested = normalizeRoute(input);
    return CORE_ROUTE_PREFIXES.some((prefix) => requested === prefix || requested.startsWith(`${prefix}/`));
  }

  function readRecord(candidate) {
    const target = storage(candidate);
    if (target) {
      try {
        const value = JSON.parse(target.getItem(STORAGE_KEY) || "null");
        if (value?.version === VERSION && value?.access === true && value?.source === ENTRY_SOURCE) {
          return Object.freeze({
            version: VERSION,
            access: true,
            source: ENTRY_SOURCE,
            enteredAt: Number(value.enteredAt) || 0
          });
        }
      } catch {
        // Fall through to the page-lifetime grant created by enter().
      }
    }
    return volatileRecord && volatileStorage === target ? volatileRecord : null;
  }

  function hasAccess(candidate) {
    return Boolean(readRecord(candidate));
  }

  function emit(access, source) {
    if (!globalScope.dispatchEvent || typeof globalScope.CustomEvent !== "function") return;
    globalScope.dispatchEvent(new globalScope.CustomEvent("hh:core-gateway-change", {
      detail: Object.freeze({
        access: Boolean(access),
        layer: access ? "platform" : "galaxy",
        source: String(source || "unknown")
      })
    }));
  }

  function enter(options = {}) {
    const source = String(options.source || "");
    if (source !== ENTRY_SOURCE) return false;
    const target = storage(options.storage);
    const record = Object.freeze({
      version: VERSION,
      access: true,
      source: ENTRY_SOURCE,
      enteredAt: Date.now()
    });
    let persisted = false;
    if (target) {
      try {
        target.setItem(STORAGE_KEY, JSON.stringify(record));
        const stored = JSON.parse(target.getItem(STORAGE_KEY) || "null");
        persisted = stored?.version === VERSION && stored?.access === true && stored?.source === ENTRY_SOURCE;
      } catch {
        persisted = false;
      }
    }
    volatileRecord = persisted ? null : record;
    volatileStorage = persisted ? null : target;
    emit(true, source);
    return true;
  }

  function leave(options = {}) {
    const target = storage(options.storage);
    let cleared = false;
    if (target) {
      try {
        target.removeItem(STORAGE_KEY);
        cleared = true;
      } catch {
        cleared = false;
      }
    }
    if (volatileRecord && volatileStorage === target) {
      volatileRecord = null;
      volatileStorage = null;
      cleared = true;
    }
    emit(false, options.source || "leave");
    return cleared;
  }

  function resolveRoute(input, options = {}) {
    const requested = normalizeRoute(input);
    const galaxy = isGalaxyRoute(requested);
    const core = !galaxy && isCoreRoute(requested);
    const access = core && hasAccess(options.storage);
    const allowed = galaxy || access;
    return Object.freeze({
      requested,
      route: allowed ? requested : GATEWAY_ROUTE,
      allowed,
      redirected: !allowed,
      layer: galaxy ? "galaxy" : core ? "platform" : "unknown"
    });
  }

  return Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    gatewayRoute: GATEWAY_ROUTE,
    platformEntryRoute: PLATFORM_ENTRY_ROUTE,
    entrySource: ENTRY_SOURCE,
    galaxyManifest: GALAXY_MANIFEST,
    coreManifest: CORE_ROUTE_PREFIXES,
    coreRoutePrefixes: CORE_ROUTE_PREFIXES,
    normalizeRoute,
    isGalaxyRoute,
    isCoreRoute,
    hasAccess,
    enter,
    leave,
    resolveRoute
  });
});
