(() => {
  "use strict";

  const GLOBAL_NAME = "HHIdentityConstellation";
  const STORAGE_KEY = "hh.auth.identity-seed";
  const VALID_PHASES = new Set(["auto", "morning", "afternoon", "night", "offline"]);
  const previous = window[GLOBAL_NAME];
  if (previous && typeof previous.destroy === "function") previous.destroy();

  const ready = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + ((to - from) * amount);
  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

  const hashText = (value, seed = 2166136261) => {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const normalizeEmail = (value) => String(value || "")
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFKC")
    .slice(0, 320);

  const createSeed = () => {
    const values = new Uint32Array(2);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(values);
    else {
      values[0] = Math.floor(Math.random() * 0xffffffff);
      values[1] = Date.now() >>> 0;
    }
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  };

  const getIdentitySeed = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^[a-z0-9-]{6,80}$/i.test(saved)) return saved;
      const generated = createSeed();
      localStorage.setItem(STORAGE_KEY, generated);
      return generated;
    } catch {
      return createSeed();
    }
  };

  const seededRandom = (seedValue) => {
    let state = hashText(seedValue) || 0x9e3779b9;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  const hsl = (hue, saturation, lightness, alpha = 1) =>
    `hsla(${Math.round((hue + 360) % 360)} ${saturation}% ${lightness}% / ${alpha})`;

  const isHexColor = (value) => /^#[\da-f]{6}$/i.test(String(value || ""));

  ready(() => {
    const gate = document.getElementById("authGate");
    if (!gate) return;

    const root = document.createElement("div");
    root.className = "hh-identity-constellation";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<canvas class="hh-identity-constellation__canvas"></canvas>';
    gate.prepend(root);

    const canvas = root.querySelector("canvas");
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) {
      root.remove();
      return;
    }

    const mediaReduced = matchMedia("(prefers-reduced-motion: reduce)");
    const mediaCoarse = matchMedia("(pointer: coarse)");
    const identitySeed = getIdentitySeed();
    const weakDevice = (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 4)
      || (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 4)
      || mediaCoarse.matches;
    const listeners = [];
    const particles = [];
    const targetLinks = [];
    const pointer = { x: .28, y: .48, targetX: .28, targetY: .48 };
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame = 0;
    let lastTime = 0;
    let formedAt = performance.now();
    let identityHash = hashText(identitySeed);
    let requestedPhase = "auto";
    let activePhase = "night";
    let profileColor = "";
    let palette = [];
    let manuallyPaused = false;
    let destroyed = false;
    let resizeObserver = null;
    let bodyObserver = null;
    let emailTimer = 0;

    const addListener = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    const autoPhase = () => {
      if (!navigator.onLine) return "offline";
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "morning";
      if (hour >= 12 && hour < 18) return "afternoon";
      return "night";
    };

    const resolvePhase = () => requestedPhase === "auto" ? autoPhase() : requestedPhase;

    const buildPalette = () => {
      const phase = activePhase;
      const phaseHue = phase === "morning" ? 168 : phase === "afternoon" ? 28 : phase === "offline" ? 205 : 276;
      const identityHue = identityHash % 360;
      const mixedHue = (identityHue * .62) + (phaseHue * .38);
      const saturation = phase === "offline" ? 18 : 84;
      const lightness = phase === "offline" ? 70 : 67;
      const custom = isHexColor(profileColor) ? profileColor : hsl(mixedHue, saturation, lightness);
      palette = [
        custom,
        hsl(mixedHue + 72, phase === "offline" ? 15 : 88, lightness + 3),
        hsl(mixedHue + 184, phase === "offline" ? 12 : 82, lightness + 1),
        hsl(mixedHue + 302, phase === "offline" ? 10 : 78, lightness + 7)
      ];
      gate.style.setProperty("--hh-identity-primary", palette[0]);
      gate.style.setProperty("--hh-identity-secondary", palette[1]);
      gate.style.setProperty("--hh-identity-accent", palette[2]);
      gate.style.setProperty("--hh-identity-soft", hsl(mixedHue, saturation, lightness, .16));
    };

    const applyPhase = () => {
      activePhase = resolvePhase();
      root.dataset.phase = activePhase;
      buildPalette();
    };

    const linePoints = (fromX, fromY, toX, toY, count, group) => {
      const points = [];
      for (let index = 0; index < count; index += 1) {
        const progress = count === 1 ? 0 : index / (count - 1);
        points.push({
          x: lerp(fromX, toX, progress),
          y: lerp(fromY, toY, progress),
          group
        });
      }
      return points;
    };

    const createLogoTargets = () => {
      const target = [];
      const groups = [
        linePoints(-1, -1, -1, 1, 15, 0),
        linePoints(0, -1, 0, 1, 15, 1),
        linePoints(-1, 0, 0, 0, 10, 2),
        linePoints(.42, -1, .42, 1, 15, 3),
        linePoints(1.42, -1, 1.42, 1, 15, 4),
        linePoints(.42, 0, 1.42, 0, 10, 5)
      ];
      groups.forEach((points) => {
        const start = target.length;
        target.push(...points);
        for (let index = 0; index < points.length - 1; index += 1) {
          targetLinks.push([start + index, start + index + 1]);
        }
      });
      return target;
    };

    const logoTargets = createLogoTargets();

    const resetParticles = () => {
      const random = seededRandom(`${identitySeed}:${identityHash}`);
      const lowMotion = weakDevice || mediaReduced.matches;
      const ambientCount = lowMotion ? 18 : 48;
      particles.length = 0;

      logoTargets.forEach((target, index) => {
        particles.push({
          target,
          x: random() * width,
          y: random() * height,
          driftX: (random() - .5) * .018,
          driftY: (random() - .5) * .014,
          phase: random() * Math.PI * 2,
          radius: 1 + random() * 1.45,
          colorIndex: (index + Math.floor(random() * palette.length)) % palette.length,
          logo: true
        });
      });

      for (let index = 0; index < ambientCount; index += 1) {
        particles.push({
          target: null,
          x: random() * width,
          y: random() * height,
          driftX: (random() - .5) * .028,
          driftY: (random() - .5) * .022,
          phase: random() * Math.PI * 2,
          radius: .5 + random() * 1.15,
          colorIndex: Math.floor(random() * palette.length),
          logo: false
        });
      }
      formedAt = performance.now();
    };

    const getLogoGeometry = () => {
      const card = gate.querySelector("[data-auth-card]");
      const cardRect = card?.getBoundingClientRect();
      const compact = width <= 900 || height <= 680 || (cardRect && cardRect.left < width * .54);
      const centerX = compact ? width * .5 : clamp((cardRect?.left || width * .62) * .48, width * .16, width * .34);
      const centerY = compact ? clamp(height * .17, 72, 150) : height * .47;
      const size = compact
        ? clamp(Math.min(width, height) * .075, 30, 54)
        : clamp(Math.min(width, height) * .13, 62, 118);
      root.style.setProperty("--hh-identity-center-x", `${(centerX / width) * 100}%`);
      root.style.setProperty("--hh-identity-center-y", `${(centerY / height) * 100}%`);
      return { centerX, centerY, size, compact };
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width || innerWidth));
      height = Math.max(1, Math.round(rect.height || innerHeight));
      pixelRatio = Math.min(devicePixelRatio || 1, weakDevice ? 1.25 : 2);
      const nextWidth = Math.max(1, Math.round(width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(height * pixelRatio));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
      draw(performance.now(), true);
    };

    const drawLink = (first, second, alpha) => {
      context.beginPath();
      context.moveTo(first.renderX, first.renderY);
      context.lineTo(second.renderX, second.renderY);
      context.strokeStyle = hsl((identityHash % 360) + 55, activePhase === "offline" ? 18 : 80, 70, alpha);
      context.stroke();
    };

    const draw = (time, staticFrame = false) => {
      if (destroyed) return;
      const delta = Math.min(34, Math.max(0, time - (lastTime || time)));
      lastTime = time;
      const geometry = getLogoGeometry();
      const formation = mediaReduced.matches || weakDevice
        ? 1
        : easeOutCubic(clamp((time - formedAt) / 1450, 0, 1));
      const pointerX = (pointer.x - .5) * (geometry.compact ? 4 : 10);
      const pointerY = (pointer.y - .5) * (geometry.compact ? 3 : 7);
      pointer.x = lerp(pointer.x, pointer.targetX, staticFrame ? 1 : .065);
      pointer.y = lerp(pointer.y, pointer.targetY, staticFrame ? 1 : .065);

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";
      context.lineWidth = geometry.compact ? .45 : .7;

      particles.forEach((particle, index) => {
        const pulse = staticFrame ? 0 : Math.sin((time * .0014) + particle.phase);
        if (particle.logo) {
          const targetX = geometry.centerX + ((particle.target.x - .21) * geometry.size) + pointerX;
          const targetY = geometry.centerY + (particle.target.y * geometry.size) + pointerY;
          particle.x = lerp(particle.x, targetX, staticFrame ? 1 : clamp(.025 * delta, .08, .28) * formation);
          particle.y = lerp(particle.y, targetY, staticFrame ? 1 : clamp(.025 * delta, .08, .28) * formation);
        } else if (!staticFrame) {
          particle.x += particle.driftX * delta;
          particle.y += particle.driftY * delta;
          if (particle.x < -12) particle.x = width + 12;
          if (particle.x > width + 12) particle.x = -12;
          if (particle.y < -12) particle.y = height + 12;
          if (particle.y > height + 12) particle.y = -12;
        }
        particle.renderX = particle.x + (particle.logo ? pulse * .55 : 0);
        particle.renderY = particle.y + (particle.logo ? Math.cos(particle.phase + time * .0011) * .48 : 0);

        const color = palette[particle.colorIndex % palette.length];
        const opacity = particle.logo ? (.54 + formation * .4) : (activePhase === "offline" ? .18 : .28);
        context.beginPath();
        context.fillStyle = color;
        context.globalAlpha = opacity;
        context.shadowColor = color;
        context.shadowBlur = particle.logo && !weakDevice ? 8 : 2;
        context.arc(particle.renderX, particle.renderY, particle.radius + (particle.logo ? formation * .32 : 0), 0, Math.PI * 2);
        context.fill();
        if (index < logoTargets.length) context.globalAlpha = 1;
      });

      if (!geometry.compact || width > 520) {
        targetLinks.forEach(([from, to]) => {
          const first = particles[from];
          const second = particles[to];
          if (first && second) drawLink(first, second, .12 * formation);
        });
      }
      context.restore();
    };

    const canAnimate = () => !destroyed
      && !manuallyPaused
      && !document.hidden
      && !mediaReduced.matches
      && !weakDevice
      && document.body.dataset.authMotionMode !== "static"
      && document.body.classList.contains("auth-locked")
      && !root.hidden;

    const loop = (time) => {
      frame = 0;
      draw(time);
      if (canAnimate()) frame = requestAnimationFrame(loop);
      else reconcile();
    };

    const reconcile = () => {
      if (destroyed) return;
      const gateVisible = document.body.classList.contains("auth-locked") && !gate.hidden;
      root.hidden = !gateVisible;
      root.classList.toggle("is-low-power", weakDevice);
      root.classList.toggle("is-reduced-motion", mediaReduced.matches);
      root.classList.toggle("is-paused", !canAnimate());
      if (!gateVisible || !canAnimate()) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        draw(performance.now(), true);
        return;
      }
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const setIdentity = (identity) => {
      const data = typeof identity === "string" ? { email: identity } : (identity || {});
      const normalized = normalizeEmail(data.email);
      profileColor = isHexColor(data.creativeColor || data.color) ? String(data.creativeColor || data.color) : "";
      // The normalized address is hashed in memory only; neither it nor the hash is persisted.
      identityHash = normalized ? hashText(normalized, hashText(identitySeed)) : hashText(identitySeed);
      buildPalette();
      resetParticles();
      reconcile();
      return { phase: activePhase, palette: [...palette] };
    };

    const setPhase = (phase = "auto") => {
      const next = String(phase).toLowerCase();
      if (!VALID_PHASES.has(next)) throw new TypeError(`Unsupported identity phase: ${phase}`);
      requestedPhase = next;
      applyPhase();
      reconcile();
      return activePhase;
    };

    const pause = () => {
      manuallyPaused = true;
      reconcile();
    };

    const resume = () => {
      manuallyPaused = false;
      lastTime = performance.now();
      reconcile();
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      if (emailTimer) clearTimeout(emailTimer);
      resizeObserver?.disconnect();
      bodyObserver?.disconnect();
      listeners.splice(0).forEach((remove) => remove());
      root.remove();
      if (window[GLOBAL_NAME] === api) delete window[GLOBAL_NAME];
    };

    const handlePointer = (event) => {
      pointer.targetX = clamp(event.clientX / Math.max(1, width), 0, 1);
      pointer.targetY = clamp(event.clientY / Math.max(1, height), 0, 1);
      root.style.setProperty("--hh-identity-pointer-x", `${pointer.targetX * 100}%`);
      root.style.setProperty("--hh-identity-pointer-y", `${pointer.targetY * 100}%`);
    };

    const handleIdentityInput = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement)) return;
      if (!field.matches('input[type="email"], input[name="email"]')) return;
      clearTimeout(emailTimer);
      emailTimer = window.setTimeout(() => setIdentity({ email: field.value }), 180);
    };

    const handleProfileColor = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement) || field.type !== "color") return;
      setIdentity({
        email: gate.querySelector('input[type="email"]:not([hidden])')?.value || "",
        creativeColor: field.value
      });
    };

    const api = Object.freeze({ setIdentity, setPhase, pause, resume, destroy });
    window[GLOBAL_NAME] = api;

    addListener(document, "pointermove", handlePointer, { passive: true });
    addListener(gate, "input", handleIdentityInput);
    addListener(gate, "change", handleProfileColor);
    addListener(document, "visibilitychange", reconcile);
    addListener(window, "online", () => { applyPhase(); reconcile(); });
    addListener(window, "offline", () => { applyPhase(); reconcile(); });
    addListener(window, "resize", resize, { passive: true });
    addListener(window, "hh:auth-change", (event) => {
      if (event.detail?.user) setIdentity(event.detail.user);
    });
    addListener(gate, "hh:auth-success", (event) => {
      if (event.detail?.user) setIdentity(event.detail.user);
      formedAt = performance.now() + 180;
    });

    const handleMotionChange = () => reconcile();
    if (typeof mediaReduced.addEventListener === "function") {
      mediaReduced.addEventListener("change", handleMotionChange);
      listeners.push(() => mediaReduced.removeEventListener("change", handleMotionChange));
    } else if (typeof mediaReduced.addListener === "function") {
      mediaReduced.addListener(handleMotionChange);
      listeners.push(() => mediaReduced.removeListener(handleMotionChange));
    }

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(root);
    }
    bodyObserver = new MutationObserver(reconcile);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "data-auth-motion-mode"] });

    applyPhase();
    resetParticles();
    resize();
    reconcile();
  });
})();
