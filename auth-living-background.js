(() => {
  "use strict";

  const GLOBAL_NAME = "HHAuthLivingBackground";
  const existing = window[GLOBAL_NAME];
  if (existing?.destroy) existing.destroy();

  const whenReady = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  };

  whenReady(() => {
    const gate = document.querySelector("#authGate");
    if (!gate) {
      window[GLOBAL_NAME] = Object.freeze({ available: false, destroy() {} });
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const smallViewport = window.matchMedia("(max-width: 760px)");
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const lowMemory = Boolean(deviceMemory && deviceMemory <= 4);
    const abortController = new AbortController();
    const { signal } = abortController;

    const root = document.createElement("div");
    root.className = "auth-living-background";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = [
      '<div class="auth-living-aurora"></div>',
      '<div class="auth-living-grid"></div>',
      '<canvas class="auth-living-particles"></canvas>',
      '<div class="auth-living-noise"></div>',
      '<div class="auth-living-meteors"></div>'
    ].join("");
    gate.prepend(root);

    const canvas = root.querySelector(".auth-living-particles");
    const meteorLayer = root.querySelector(".auth-living-meteors");
    const context = canvas?.getContext?.("2d", { alpha: true, desynchronized: true });
    const colorsByPeriod = {
      morning: ["#ff7eb3", "#5ce8ee", "#ffd66b", "#91a8ff"],
      afternoon: ["#ff6f91", "#62d7e7", "#ffcf67", "#8b7cf6"],
      night: ["#ff4fb8", "#4ee7ed", "#9c6cff", "#68e5a7"]
    };

    let destroyed = false;
    let active = false;
    let lowPower = false;
    let animationFrame = 0;
    let pointerFrame = 0;
    let resizeFrame = 0;
    let meteorTimer = 0;
    let paletteTimer = 0;
    let lastFrameTime = 0;
    let cycleStartedAt = 0;
    let width = 0;
    let height = 0;
    let renderScale = 1;
    let pointerX = innerWidth * 0.5;
    let pointerY = innerHeight * 0.42;
    let queuedPointer = null;
    let particles = [];
    let logoLinks = [];
    let palette = colorsByPeriod.night;

    const isGateVisible = () => {
      if (!document.body.classList.contains("auth-locked")) return false;
      if (gate.hidden || gate.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(gate);
      return style.display !== "none" && style.visibility !== "hidden" && gate.getClientRects().length > 0;
    };

    const shouldRun = () => (
      !destroyed
      && document.visibilityState === "visible"
      && !reducedMotion.matches
      && isGateVisible()
    );

    const getPeriod = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "morning";
      if (hour >= 12 && hour < 18) return "afternoon";
      return "night";
    };

    const syncPalette = () => {
      const period = getPeriod();
      gate.dataset.authLivingPeriod = period;
      palette = colorsByPeriod[period];
      particles.forEach((particle, index) => {
        particle.color = palette[index % palette.length];
      });
    };

    const isLowPowerDevice = () => lowMemory || smallViewport.matches || coarsePointer.matches;

    const addStroke = (targets, links, x1, y1, x2, y2, count, strokeId) => {
      const start = targets.length;
      for (let index = 0; index < count; index += 1) {
        const progress = count === 1 ? 0 : index / (count - 1);
        targets.push({
          x: x1 + ((x2 - x1) * progress),
          y: y1 + ((y2 - y1) * progress),
          strokeId
        });
        if (index) links.push([start + index - 1, start + index]);
      }
    };

    const createLogoTargets = (count) => {
      const targets = [];
      const links = [];
      const centerX = width * (width > 980 ? 0.5 : 0.5);
      const centerY = height * (width > 760 ? 0.23 : 0.13);
      const letterHeight = Math.min(height * 0.18, width * 0.15, 150);
      const letterWidth = letterHeight * 0.54;
      const gap = letterWidth * 0.38;
      const pointsPerStroke = Math.max(5, Math.floor(count / 6));

      [-1, 1].forEach((side, letterIndex) => {
        const letterCenter = centerX + side * ((letterWidth + gap) * 0.5);
        const left = letterCenter - letterWidth * 0.5;
        const right = letterCenter + letterWidth * 0.5;
        const top = centerY - letterHeight * 0.5;
        const bottom = centerY + letterHeight * 0.5;
        const middle = centerY;
        addStroke(targets, links, left, top, left, bottom, pointsPerStroke, letterIndex * 3);
        addStroke(targets, links, right, top, right, bottom, pointsPerStroke, letterIndex * 3 + 1);
        addStroke(targets, links, left, middle, right, middle, pointsPerStroke, letterIndex * 3 + 2);
      });

      return { targets: targets.slice(0, count), links };
    };

    const makeParticle = (target, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      originX: Math.random() * width,
      originY: Math.random() * height,
      targetX: target?.x ?? Math.random() * width,
      targetY: target?.y ?? Math.random() * height,
      vx: (Math.random() - 0.5) * 0.09,
      vy: (Math.random() - 0.5) * 0.07,
      radius: lowPower ? 0.8 + Math.random() * 0.7 : 0.8 + Math.random() * 1.15,
      phase: Math.random() * Math.PI * 2,
      color: palette[index % palette.length]
    });

    const rebuildParticles = () => {
      const particleCount = lowPower ? 34 : 66;
      const { targets, links } = createLogoTargets(particleCount);
      logoLinks = links.filter(([from, to]) => from < particleCount && to < particleCount);
      particles = Array.from({ length: particleCount }, (_, index) => makeParticle(targets[index], index));
      cycleStartedAt = performance.now();
    };

    const resizeCanvas = () => {
      if (!canvas || !context) return;
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      lowPower = isLowPowerDevice();
      root.classList.toggle("is-low-power", lowPower);

      const maxPixels = lowPower ? 1050000 : 2200000;
      const desiredScale = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.35);
      const pixelBudgetScale = Math.sqrt(maxPixels / Math.max(1, width * height));
      renderScale = Math.max(0.72, Math.min(desiredScale, pixelBudgetScale));
      canvas.width = Math.max(1, Math.round(width * renderScale));
      canvas.height = Math.max(1, Math.round(height * renderScale));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      rebuildParticles();
    };

    const getFormation = (now) => {
      const elapsed = ((now - cycleStartedAt) % 19000 + 19000) % 19000;
      if (elapsed < 4200) return 0;
      if (elapsed < 7000) return (elapsed - 4200) / 2800;
      if (elapsed < 10400) return 1;
      if (elapsed < 13400) return 1 - ((elapsed - 10400) / 3000);
      return 0;
    };

    const drawLogoLinks = (formation) => {
      if (!context || formation < 0.18) return;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.lineWidth = 0.65;
      logoLinks.forEach(([from, to], index) => {
        const first = particles[from];
        const second = particles[to];
        if (!first || !second) return;
        context.strokeStyle = `${palette[index % palette.length]}${Math.round(formation * 70).toString(16).padStart(2, "0")}`;
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();
      });
      context.restore();
    };

    const render = (now) => {
      animationFrame = 0;
      if (!shouldRun() || !context) {
        reconcile();
        return;
      }

      const delta = Math.min(34, Math.max(8, now - (lastFrameTime || now)));
      lastFrameTime = now;
      const formation = getFormation(now);
      context.clearRect(0, 0, width, height);

      particles.forEach((particle, index) => {
        const driftX = Math.sin((now * 0.00024) + particle.phase) * (9 + index % 5);
        const driftY = Math.cos((now * 0.00019) + particle.phase) * (7 + index % 4);
        particle.originX += particle.vx * delta;
        particle.originY += particle.vy * delta;
        if (particle.originX < -30) particle.originX = width + 30;
        if (particle.originX > width + 30) particle.originX = -30;
        if (particle.originY < -30) particle.originY = height + 30;
        if (particle.originY > height + 30) particle.originY = -30;

        const freeX = particle.originX + driftX;
        const freeY = particle.originY + driftY;
        const easedFormation = formation * formation * (3 - (2 * formation));
        particle.x = freeX + ((particle.targetX - freeX) * easedFormation);
        particle.y = freeY + ((particle.targetY - freeY) * easedFormation);

        const pulse = 0.72 + Math.sin((now * 0.002) + particle.phase) * 0.24;
        context.beginPath();
        context.fillStyle = particle.color;
        context.globalAlpha = Math.max(0.2, pulse * (0.5 + formation * 0.45));
        context.shadowBlur = lowPower ? 3 : 7;
        context.shadowColor = particle.color;
        context.arc(particle.x, particle.y, particle.radius + formation * 0.45, 0, Math.PI * 2);
        context.fill();
      });

      context.globalAlpha = 1;
      context.shadowBlur = 0;
      drawLogoLinks(formation);
      animationFrame = requestAnimationFrame(render);
    };

    const removeMeteors = () => {
      meteorLayer?.replaceChildren();
    };

    const clearMeteorSchedule = () => {
      if (meteorTimer) window.clearTimeout(meteorTimer);
      meteorTimer = 0;
      removeMeteors();
    };

    const scheduleMeteor = () => {
      clearMeteorSchedule();
      if (!shouldRun()) return;
      const delay = lowPower ? 19000 + Math.random() * 12000 : 11000 + Math.random() * 13000;
      meteorTimer = window.setTimeout(() => {
        meteorTimer = 0;
        if (!shouldRun() || !meteorLayer) return reconcile();
        const meteor = document.createElement("i");
        meteor.className = "auth-living-meteor";
        meteor.style.setProperty("--meteor-top", `${8 + Math.random() * 45}%`);
        meteor.style.setProperty("--meteor-left", `${56 + Math.random() * 35}%`);
        meteor.style.setProperty("--meteor-duration", `${1500 + Math.round(Math.random() * 700)}ms`);
        meteorLayer.append(meteor);
        meteor.addEventListener("animationend", () => meteor.remove(), { once: true });
        scheduleMeteor();
      }, delay);
    };

    const stop = () => {
      active = false;
      root.classList.remove("is-running");
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameTime = 0;
      clearMeteorSchedule();
      if (context) context.clearRect(0, 0, width, height);
    };

    const start = () => {
      if (!shouldRun()) return stop();
      root.hidden = false;
      root.classList.add("is-running");
      if (!active) {
        active = true;
        cycleStartedAt = performance.now();
      }
      if (!animationFrame && context) animationFrame = requestAnimationFrame(render);
      if (!meteorTimer) scheduleMeteor();
    };

    const reconcile = () => {
      const visible = isGateVisible();
      root.hidden = !visible;
      if (shouldRun()) start();
      else stop();
    };

    const paintPointer = () => {
      pointerFrame = 0;
      if (!queuedPointer || !active || reducedMotion.matches || coarsePointer.matches) return;
      pointerX += (queuedPointer.clientX - pointerX) * 0.72;
      pointerY += (queuedPointer.clientY - pointerY) * 0.72;
      gate.style.setProperty("--auth-live-pointer-x", `${Math.round(pointerX)}px`);
      gate.style.setProperty("--auth-live-pointer-y", `${Math.round(pointerY)}px`);
      queuedPointer = null;
    };

    const onPointerMove = (event) => {
      if (!active || reducedMotion.matches || coarsePointer.matches) return;
      queuedPointer = event;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    };

    const onResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeCanvas();
        reconcile();
      });
    };

    const onMotionPreferenceChange = () => {
      resizeCanvas();
      reconcile();
    };

    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    mutationObserver.observe(gate, { attributes: true, attributeFilter: ["class", "hidden", "style", "aria-hidden"] });

    gate.addEventListener("pointermove", onPointerMove, { passive: true, signal });
    window.addEventListener("resize", onResize, { passive: true, signal });
    document.addEventListener("visibilitychange", reconcile, { signal });
    reducedMotion.addEventListener?.("change", onMotionPreferenceChange, { signal });
    coarsePointer.addEventListener?.("change", onMotionPreferenceChange, { signal });
    smallViewport.addEventListener?.("change", onMotionPreferenceChange, { signal });

    syncPalette();
    paletteTimer = window.setTimeout(function refreshPeriod() {
      if (destroyed) return;
      syncPalette();
      paletteTimer = window.setTimeout(refreshPeriod, 60000);
    }, 60000);
    resizeCanvas();
    reconcile();

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      stop();
      abortController.abort();
      mutationObserver.disconnect();
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      if (paletteTimer) window.clearTimeout(paletteTimer);
      pointerFrame = 0;
      resizeFrame = 0;
      paletteTimer = 0;
      delete gate.dataset.authLivingPeriod;
      gate.style.removeProperty("--auth-live-pointer-x");
      gate.style.removeProperty("--auth-live-pointer-y");
      root.remove();
    };

    window[GLOBAL_NAME] = Object.freeze({
      available: true,
      start,
      stop,
      refresh: () => {
        syncPalette();
        onResize();
      },
      destroy
    });
  });
})();
