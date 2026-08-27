(function bootstrapGalaxyFavicon(global, doc) {
  "use strict";

  if (!global || !doc?.head) return;

  const ICON_SELECTOR = 'link[rel~="icon"]';
  const FRAME_INTERVAL_MS = 167; // ~6 FPS: visible motion without needless tab work.
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const staticIcon = svgUri(0, false);
  const frames = Array.from({ length: 8 }, (_, index) => svgUri(index, true));
  let icon = null;
  let timer = 0;
  let frame = 0;
  let initialized = false;
  let motionQuery = null;

  function svgUri(index, animated) {
    const angle = (index % 8) * 45;
    const sparkX = 32 + Math.cos((angle * Math.PI) / 180) * 21;
    const sparkY = 32 + Math.sin((angle * Math.PI) / 180) * 21;
    const glow = animated ? 0.72 + (index % 4) * 0.07 : 0.82;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g"><stop stop-color="#fff"/><stop offset=".28" stop-color="#fff4c7"/><stop offset=".68" stop-color="#ffd76a"/><stop offset="1" stop-color="#ff9f54"/></radialGradient><linearGradient id="r"><stop stop-color="#55e6ff"/><stop offset=".48" stop-color="#9c72ff"/><stop offset=".78" stop-color="#ff58c8"/><stop offset="1" stop-color="#ffd76a"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="#090817"/><circle cx="32" cy="32" r="25" fill="none" stroke="url(#r)" stroke-width="2"/><ellipse cx="32" cy="32" rx="27" ry="11" fill="none" stroke="#ff58c8" stroke-width="1.8" opacity=".78" transform="rotate(${angle} 32 32)"/><circle cx="32" cy="32" r="17" fill="#9c72ff" opacity="${(glow * .24).toFixed(2)}"/><polygon points="32,9 35.5,25 46,18 39,28.5 55,32 39,35.5 46,46 35.5,39 32,55 28.5,39 18,46 25,35.5 9,32 25,28.5 18,18 28.5,25" fill="url(#g)" stroke="#fff8dc" stroke-width="1"/><circle cx="32" cy="32" r="4.5" fill="#fff"/><circle cx="${sparkX.toFixed(2)}" cy="${sparkY.toFixed(2)}" r="2.6" fill="#63f2b3" stroke="#fff" stroke-width=".7"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function ensureSingleIcon() {
    const links = Array.from(doc.querySelectorAll(ICON_SELECTOR));
    icon = icon?.isConnected ? icon : links[0] || doc.createElement("link");
    for (const link of links) if (link !== icon) link.remove();
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.dataset.hhGalaxyFavicon = "true";
    if (!icon.isConnected) doc.head.appendChild(icon);
    return icon;
  }

  function useStaticIcon() {
    ensureSingleIcon().href = staticIcon;
    frame = 0;
  }

  function stop() {
    if (!timer) return;
    global.clearInterval(timer);
    timer = 0;
  }

  function canAnimate() {
    return !doc.hidden && !motionQuery?.matches;
  }

  function start() {
    stop();
    if (!canAnimate()) {
      useStaticIcon();
      return;
    }
    ensureSingleIcon().href = frames[frame % frames.length];
    timer = global.setInterval(() => {
      if (!canAnimate()) {
        stop();
        useStaticIcon();
        return;
      }
      frame = (frame + 1) % frames.length;
      ensureSingleIcon().href = frames[frame];
    }, FRAME_INTERVAL_MS);
  }

  function syncMotion() {
    if (canAnimate()) start();
    else {
      stop();
      useStaticIcon();
    }
  }

  function init() {
    if (initialized) {
      ensureSingleIcon();
      syncMotion();
      return api;
    }
    initialized = true;
    motionQuery = global.matchMedia?.(REDUCED_MOTION_QUERY) || null;
    ensureSingleIcon();
    doc.addEventListener("visibilitychange", syncMotion);
    motionQuery?.addEventListener?.("change", syncMotion);
    syncMotion();
    return api;
  }

  function destroy() {
    if (!initialized) return;
    stop();
    doc.removeEventListener("visibilitychange", syncMotion);
    motionQuery?.removeEventListener?.("change", syncMotion);
    useStaticIcon();
    motionQuery = null;
    initialized = false;
  }

  const api = Object.freeze({ init, destroy, staticIcon, frameRate: 1000 / FRAME_INTERVAL_MS });
  global.HHGalaxyFavicon = api;
  init();
})(globalThis, typeof document === "undefined" ? null : document);
