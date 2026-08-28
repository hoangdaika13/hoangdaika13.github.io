(function initHHYouTubePlaybackCore(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHYouTubePlaybackCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHYouTubePlaybackCore(scope) {
  "use strict";

  const VERSION = "1.1.0";
  const YOUTUBE_ORIGINS = Object.freeze(["https://www.youtube-nocookie.com", "https://youtube-nocookie.com", "https://www.youtube.com", "https://youtube.com"]);
  const COMMANDS = new Set([
    "playVideo", "pauseVideo", "stopVideo", "cueVideoById", "loadVideoById", "seekTo",
    "setVolume", "mute", "unMute", "isMuted", "getCurrentTime", "getDuration", "getVideoLoadedFraction",
    "getVolume", "getPlaybackRate", "setPlaybackRate", "getAvailablePlaybackRates", "getPlaybackQuality"
  ]);
  const registry = new WeakMap();
  let active = null;
  let mounts = 0;
  let destroys = 0;
  let commandCount = 0;
  let listenCount = 0;
  let duplicateMounts = 0;

  function cleanVideoId(value) {
    const id = String(value || "").trim();
    return /^[A-Za-z0-9_-]{6,128}$/.test(id) ? id : "";
  }

  function isYouTubeFrame(frame) {
    if (!frame || typeof frame !== "object") return false;
    try {
      const source = String(frame.src || "");
      return YOUTUBE_ORIGINS.some((origin) => source.startsWith(`${origin}/embed/`));
    } catch {
      return false;
    }
  }

  function detach(frame) {
    const entry = registry.get(frame);
    if (!entry) return false;
    entry.frame.removeEventListener?.("load", entry.onLoad);
    entry.destroyed = true;
    registry.delete(frame);
    if (active === entry) active = null;
    destroys += 1;
    return true;
  }

  function attach(frame, videoId, options = {}) {
    const id = cleanVideoId(videoId);
    if (!isYouTubeFrame(frame) || !id) return null;
    const existing = registry.get(frame);
    if (existing && existing.videoId === id && !existing.destroyed) {
      duplicateMounts += 1;
      return existing;
    }
    if (existing) detach(frame);
    if (active && active.frame !== frame) detach(active.frame);
    const entry = {
      frame,
      videoId: id,
      ready: false,
      destroyed: false,
      loadedAt: 0,
      state: -1,
      currentTime: 0,
      duration: 0,
      loadedFraction: 0,
      commands: 0,
      onReady: typeof options.onReady === "function" ? options.onReady : null,
      onLoad: null
    };
    entry.onLoad = () => {
      if (entry.destroyed) return;
      entry.ready = true;
      entry.loadedAt = Date.now();
      entry.onReady?.(entry);
    };
    frame.addEventListener?.("load", entry.onLoad, { once: true });
    frame.dataset.hhPlaybackId = id;
    registry.set(frame, entry);
    active = entry;
    mounts += 1;
    return entry;
  }

  function command(frame, func, args = []) {
    const entry = registry.get(frame);
    if (!entry || entry.destroyed || !COMMANDS.has(func) || !frame.contentWindow) return false;
    const targetOrigin = YOUTUBE_ORIGINS.find((origin) => String(frame.src || "").startsWith(`${origin}/embed/`));
    if (!targetOrigin) return false;
    try {
      frame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: Array.isArray(args) ? args : [] }), targetOrigin);
      entry.commands += 1;
      commandCount += 1;
      return true;
    } catch {
      return false;
    }
  }

  function listen(frame, listenerId = "hh-youtube-player") {
    const entry = registry.get(frame);
    if (!entry || entry.destroyed || !frame.contentWindow) return false;
    const targetOrigin = YOUTUBE_ORIGINS.find((origin) => String(frame.src || "").startsWith(`${origin}/embed/`));
    if (!targetOrigin) return false;
    const id = String(frame.id || listenerId || "hh-youtube-player").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "hh-youtube-player";
    try {
      frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id }), targetOrigin);
      entry.listens = Number(entry.listens || 0) + 1;
      listenCount += 1;
      return true;
    } catch {
      return false;
    }
  }

  function update(frame, info = {}) {
    const entry = registry.get(frame);
    if (!entry || entry.destroyed) return null;
    if (Number.isFinite(Number(info.playerState))) entry.state = Number(info.playerState);
    if (Number.isFinite(Number(info.currentTime))) entry.currentTime = Math.max(0, Number(info.currentTime));
    if (Number.isFinite(Number(info.duration))) entry.duration = Math.max(0, Number(info.duration));
    if (Number.isFinite(Number(info.videoLoadedFraction))) entry.loadedFraction = Math.min(1, Math.max(0, Number(info.videoLoadedFraction)));
    return entry;
  }

  function get(frame) {
    return registry.get(frame) || null;
  }

  function snapshot(frame) {
    const entry = frame ? get(frame) : active;
    return Object.freeze({
      version: VERSION,
      mounted: Boolean(entry && !entry.destroyed),
      ready: Boolean(entry?.ready),
      videoId: entry?.videoId || "",
      state: entry?.state ?? -1,
      currentTime: entry?.currentTime || 0,
      duration: entry?.duration || 0,
      loadedFraction: entry?.loadedFraction || 0,
      commands: entry?.commands || 0,
      mounts,
      destroys,
      duplicateMounts,
      commandCount,
      listens: entry?.listens || 0,
      listenCount
    });
  }

  function destroy(frame) {
    if (frame) return detach(frame);
    if (active) return detach(active.frame);
    return false;
  }

  function resetForTests() {
    if (active) detach(active.frame);
    mounts = 0;
    destroys = 0;
    commandCount = 0;
    listenCount = 0;
    duplicateMounts = 0;
  }

  return Object.freeze({
    version: VERSION,
    origins: YOUTUBE_ORIGINS,
    commands: Object.freeze([...COMMANDS]),
    attach,
    listen,
    command,
    update,
    get,
    snapshot,
    destroy,
    resetForTests
  });
});
