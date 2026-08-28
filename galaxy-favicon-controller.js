(function bootstrapGalaxyFavicon(global, doc) {
  "use strict";

  if (!global || !doc?.head) return;

  const ENGINE_VERSION = 2;
  const RELEASE_VERSION = "2";
  const ICON_ID = "hhDynamicFavicon";
  const ICON_SELECTOR = 'link[rel~="icon"]';
  const STATIC_ICON = `assets/brand/hh-galaxy-star-static.svg?v=${RELEASE_VERSION}`;
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const STORAGE_KEY = "hh.favicon.motionMode";
  const FRAME_COUNT = 16;
  const LOOP_DURATION_MS = 2000;
  const SUCCESS_DURATION_MS = 900;
  const MODE_INTERVALS = Object.freeze({
    static: 0,
    "power-saver": 250,
    balanced: 125,
    cinematic: 100
  });
  const VALID_STATES = new Set(["normal", "loading", "success", "notification", "error"]);

  const previous = global.HHGalaxyFavicon;
  if (previous?.engineVersion === ENGINE_VERSION) {
    previous.init();
    return;
  }
  previous?.destroy?.();

  let icon = null;
  let frameSets = null;
  let timer = 0;
  let initialized = false;
  let ready = doc.readyState !== "loading";
  let running = false;
  let fallbackLocked = false;
  let mode = readStoredMode();
  let state = "normal";
  let successUntil = 0;
  let motionQuery = null;
  let connection = null;
  let phaseStartedAt = 0;
  let elapsedBeforePause = 0;
  let lastFrame = -1;
  let lastHref = "";
  let dynamicUpdates = 0;
  let iconErrors = 0;

  function now() {
    return global.performance?.now?.() ?? Date.now();
  }

  function readStoredMode() {
    try {
      const saved = global.localStorage?.getItem?.(STORAGE_KEY);
      return Object.hasOwn(MODE_INTERVALS, saved) ? saved : "balanced";
    } catch {
      return "balanced";
    }
  }

  function persistMode(nextMode) {
    try {
      global.localStorage?.setItem?.(STORAGE_KEY, nextMode);
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  function svgUri(index, status) {
    const phase = index / FRAME_COUNT;
    const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    const orbitAngle = -16 + wave * 32;
    const sparkAngle = phase * Math.PI * 2 - Math.PI / 2;
    const sparkX = 32 + Math.cos(sparkAngle) * 23;
    const sparkY = 32 + Math.sin(sparkAngle) * 9;
    const haloRadius = 17.2 + wave * 0.9;
    const haloOpacity = 0.2 + wave * 0.1;
    const starScale = 1 + wave * 0.045;
    const starTransform = `translate(${(32 - 32 * starScale).toFixed(3)} ${(32 - 32 * starScale).toFixed(3)}) scale(${starScale.toFixed(3)})`;
    const isLoading = status === "loading";
    const isSuccess = status === "success";
    const badge = status === "notification"
      ? '<circle cx="49" cy="15" r="4.2" fill="#ff58c8" stroke="#fff" stroke-width="1.2"/>'
      : status === "error"
        ? '<circle cx="49" cy="15" r="4.2" fill="#ff9f54" stroke="#fff4c7" stroke-width="1.2"/>'
        : "";
    const successRing = isSuccess
      ? `<circle cx="32" cy="32" r="25" fill="none" stroke="#ffd76a" stroke-width="2.4" opacity="${(0.42 + wave * 0.38).toFixed(2)}"/>`
      : "";
    const ringOpacity = isLoading ? 0.96 : 0.78;
    const centerOpacity = isSuccess ? 1 : 0.93 + wave * 0.07;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="b" cx="42%" cy="34%" r="76%"><stop stop-color="#20225d"/><stop offset=".5" stop-color="#11132f"/><stop offset="1" stop-color="#080a18"/></radialGradient><radialGradient id="s" cx="42%" cy="34%" r="68%"><stop stop-color="#fff"/><stop offset=".28" stop-color="#fff4c7"/><stop offset=".7" stop-color="#ffd76a"/><stop offset="1" stop-color="#ff9f54"/></radialGradient><linearGradient id="r" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#55e6ff"/><stop offset=".42" stop-color="#9c72ff"/><stop offset=".72" stop-color="#ff58c8"/><stop offset="1" stop-color="#ffd76a"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#b)"/><circle cx="32" cy="32" r="${haloRadius.toFixed(2)}" fill="#9c72ff" opacity="${haloOpacity.toFixed(2)}"/><ellipse cx="32" cy="32" rx="25" ry="10" fill="none" stroke="url(#r)" stroke-width="2" opacity="${ringOpacity}" transform="rotate(${orbitAngle.toFixed(2)} 32 32)"/><circle cx="${sparkX.toFixed(2)}" cy="${sparkY.toFixed(2)}" r="2.2" fill="${isLoading ? "#55e6ff" : "#ff58c8"}" stroke="#fff" stroke-width=".75"/>${successRing}<g transform="${starTransform}"><polygon points="32,9 35.5,25 46,18 39,28.5 55,32 39,35.5 46,46 35.5,39 32,55 28.5,39 18,46 25,35.5 9,32 25,28.5 18,18 28.5,25" fill="url(#s)" stroke="#fff8dc" stroke-width="1" stroke-linejoin="round"/><circle cx="32" cy="32" r="5" fill="#fff" opacity="${centerOpacity.toFixed(2)}"/></g>${badge}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function buildFrames() {
    if (frameSets) return frameSets;
    frameSets = Object.freeze(Object.fromEntries(
      [...VALID_STATES].map((status) => [
        status,
        Object.freeze(Array.from({ length: FRAME_COUNT }, (_, index) => svgUri(index, status)))
      ])
    ));
    return frameSets;
  }

  function ensureSingleIcon() {
    const links = Array.from(doc.querySelectorAll(ICON_SELECTOR));
    icon = icon?.isConnected
      ? icon
      : doc.getElementById?.(ICON_ID) || links[0] || doc.createElement("link");
    for (const link of links) if (link !== icon) link.remove();
    icon.id = ICON_ID;
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.sizes = "any";
    icon.dataset.hhGalaxyFavicon = "true";
    if (!icon.isConnected) doc.head.appendChild(icon);
    return icon;
  }

  function setHref(href, isDynamic = false) {
    if (!href || href === lastHref) return false;
    ensureSingleIcon().href = href;
    lastHref = href;
    if (isDynamic) dynamicUpdates += 1;
    return true;
  }

  function useStaticIcon() {
    setHref(STATIC_ICON);
    lastFrame = -1;
  }

  function clearTimer() {
    if (!timer) return;
    global.clearTimeout(timer);
    timer = 0;
  }

  function saveDataEnabled() {
    return Boolean(connection?.saveData);
  }

  function canAnimate() {
    return ready
      && !doc.hidden
      && !motionQuery?.matches
      && !saveDataEnabled()
      && mode !== "static"
      && !fallbackLocked;
  }

  function frameIndexAt(timestamp) {
    const elapsed = (elapsedBeforePause + Math.max(0, timestamp - phaseStartedAt)) % LOOP_DURATION_MS;
    return Math.min(FRAME_COUNT - 1, Math.floor((elapsed / LOOP_DURATION_MS) * FRAME_COUNT));
  }

  function renderAt(timestamp) {
    if (state === "success" && timestamp >= successUntil) {
      state = "normal";
      successUntil = 0;
      lastFrame = -1;
    }
    const nextFrame = frameIndexAt(timestamp);
    if (nextFrame === lastFrame) return;
    const href = buildFrames()[state][nextFrame];
    if (setHref(href, true)) lastFrame = nextFrame;
  }

  function scheduleNext() {
    clearTimer();
    if (!canAnimate()) return;
    const delay = MODE_INTERVALS[mode];
    timer = global.setTimeout(tick, delay);
  }

  function tick() {
    timer = 0;
    if (!canAnimate()) {
      pause(true);
      return;
    }
    renderAt(now());
    scheduleNext();
  }

  function start() {
    clearTimer();
    if (!canAnimate()) {
      useStaticIcon();
      return;
    }
    buildFrames();
    if (!running) {
      phaseStartedAt = now();
      running = true;
    }
    renderAt(now());
    scheduleNext();
  }

  function pause(showStatic = true) {
    clearTimer();
    if (running) {
      elapsedBeforePause = (elapsedBeforePause + Math.max(0, now() - phaseStartedAt)) % LOOP_DURATION_MS;
      running = false;
    }
    if (showStatic) useStaticIcon();
  }

  function syncMotion() {
    if (canAnimate()) start();
    else pause(true);
  }

  function onReady() {
    ready = true;
    syncMotion();
  }

  function onIconError() {
    iconErrors += 1;
    if (iconErrors < 2) return;
    fallbackLocked = true;
    pause(true);
  }

  function attachIconErrorListener() {
    const current = ensureSingleIcon();
    current.removeEventListener?.("error", onIconError);
    current.addEventListener?.("error", onIconError);
  }

  function init() {
    if (initialized) {
      ensureSingleIcon();
      syncMotion();
      return api;
    }
    initialized = true;
    motionQuery = global.matchMedia?.(REDUCED_MOTION_QUERY) || null;
    connection = global.navigator?.connection || null;
    ensureSingleIcon();
    attachIconErrorListener();
    doc.addEventListener("visibilitychange", syncMotion);
    motionQuery?.addEventListener?.("change", syncMotion);
    connection?.addEventListener?.("change", syncMotion);
    if (!ready) {
      doc.addEventListener("DOMContentLoaded", onReady, { once: true });
      useStaticIcon();
    } else {
      syncMotion();
    }
    return api;
  }

  function setMode(nextMode, options = {}) {
    if (!Object.hasOwn(MODE_INTERVALS, nextMode)) return false;
    mode = nextMode;
    if (options.persist !== false) persistMode(nextMode);
    syncMotion();
    return true;
  }

  function setState(nextState) {
    if (!VALID_STATES.has(nextState)) return false;
    state = nextState;
    successUntil = nextState === "success" ? now() + SUCCESS_DURATION_MS : 0;
    lastFrame = -1;
    if (canAnimate()) renderAt(now());
    else useStaticIcon();
    return true;
  }

  function reportFailure() {
    iconErrors = Math.max(iconErrors, 2);
    fallbackLocked = true;
    pause(true);
  }

  function snapshot() {
    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      initialized,
      ready,
      running,
      timerActive: Boolean(timer),
      mode,
      state,
      frameCount: FRAME_COUNT,
      loopDurationMs: LOOP_DURATION_MS,
      dynamicUpdates,
      iconErrors,
      fallbackLocked,
      hidden: Boolean(doc.hidden),
      reducedMotion: Boolean(motionQuery?.matches),
      saveData: saveDataEnabled()
    });
  }

  function destroy() {
    if (!initialized) return;
    pause(true);
    doc.removeEventListener("visibilitychange", syncMotion);
    doc.removeEventListener("DOMContentLoaded", onReady);
    motionQuery?.removeEventListener?.("change", syncMotion);
    connection?.removeEventListener?.("change", syncMotion);
    icon?.removeEventListener?.("error", onIconError);
    motionQuery = null;
    connection = null;
    initialized = false;
    ready = doc.readyState !== "loading";
    running = false;
  }

  const api = Object.freeze({
    engineVersion: ENGINE_VERSION,
    staticIcon: STATIC_ICON,
    modes: Object.freeze(Object.keys(MODE_INTERVALS)),
    states: Object.freeze([...VALID_STATES]),
    init,
    destroy,
    setMode,
    setState,
    reportFailure,
    snapshot
  });

  global.HHGalaxyFavicon = api;
  init();
})(globalThis, typeof document === "undefined" ? null : document);
