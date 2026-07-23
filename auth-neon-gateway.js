(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  const card = gate?.querySelector("[data-auth-card]");
  const motionButton = gate?.querySelector("[data-auth-motion-toggle]");
  if (!gate || !card) return;

  const MOTION_KEY = "hh.auth.motion.v1";
  const motionLevels = ["high", "soft", "off"];
  const motionLabels = {
    high: "Hiệu ứng: Cao",
    soft: "Hiệu ứng: Êm",
    off: "Hiệu ứng: Tắt"
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(pointer: fine) and (min-width: 921px)");
  const modestDevice = Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4;
  let pointerFrame = 0;
  let lastPointer = null;
  let stateLock = "";
  let fpsFrame = 0;
  let fpsStartedAt = performance.now();
  let fpsSamples = 0;

  const safeRead = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Motion preference is optional; authentication never depends on it.
    }
  };

  const normalizeDecorativeLayers = () => {
    [...gate.children].forEach((child) => {
      if (child === card || child.classList.contains("auth-gate-brand") || child === motionButton) return;
      if (child.getAttribute("aria-hidden") === "true" || child.classList.contains("auth-emotional-live")) {
        child.dataset.hhGatewayDecor = "";
      }
    });
  };

  const setMotionLevel = (requested, persist = false) => {
    const level = reducedMotion.matches ? "off" : (motionLevels.includes(requested) ? requested : "high");
    gate.dataset.motionLevel = level;
    if (motionButton) {
      motionButton.querySelector("span").textContent = motionLabels[level];
      motionButton.setAttribute("aria-pressed", String(level !== "high"));
      motionButton.title = level === "high"
        ? "Giảm chuyển động và hiệu ứng nền"
        : level === "soft"
          ? "Tắt toàn bộ chuyển động trang trí"
          : "Bật lại hiệu ứng đầy đủ";
    }
    if (persist && !reducedMotion.matches) safeWrite(MOTION_KEY, level);
    gate.dispatchEvent(new CustomEvent("hh:auth-motion-change", { detail: { level } }));
  };

  const nextMotionLevel = () => {
    const current = gate.dataset.motionLevel || "high";
    setMotionLevel(motionLevels[(motionLevels.indexOf(current) + 1) % motionLevels.length], true);
  };

  const setState = (state, lock = false) => {
    if (stateLock && state !== stateLock && state !== "error") return;
    if (card.dataset.authState !== state) card.dataset.authState = state;
    if (lock) stateLock = state;
    if (gate.dataset.authGatewayState !== state) gate.dataset.authGatewayState = state;
  };

  const deriveState = () => {
    const status = gate.querySelector("#authGateStatus");
    const statusText = status?.textContent?.trim() || "";
    if (
      gate.classList.contains("auth-success")
      || card.classList.contains("auth-success")
      || status?.classList.contains("is-success")
      || /đăng nhập thành công|xác thực thành công|chào mừng/i.test(statusText)
    ) {
      setState("success", true);
      /*
       * The application shell hides the gate as soon as authentication is
       * accepted. Expanding a full-viewport blurred layer in that same frame
       * used to stall Chromium on desktop GPUs. Keep the state signal, but let
       * the shell perform the lightweight cross-fade.
       */
      gate.classList.remove("is-gateway-opening");
      return;
    }
    if (status?.classList.contains("is-error") || card.classList.contains("auth-error")) {
      stateLock = "";
      setState("error");
      return;
    }
    if (
      card.classList.contains("auth-authenticating")
      || gate.classList.contains("auth-authenticating")
      || card.getAttribute("aria-busy") === "true"
    ) {
      setState("validating");
      return;
    }
    if (card.contains(document.activeElement) && document.activeElement?.matches("input, textarea")) {
      setState("typing");
      return;
    }
    stateLock = "";
    setState("idle");
  };

  const paintPointer = () => {
    pointerFrame = 0;
    if (!lastPointer || reducedMotion.matches || !finePointer.matches || gate.dataset.motionLevel === "off") return;
    const xRatio = lastPointer.clientX / innerWidth;
    const yRatio = lastPointer.clientY / innerHeight;
    const x = (xRatio - .5) * 2;
    const y = (yRatio - .5) * 2;
    gate.style.setProperty("--gateway-pointer-x", `${lastPointer.clientX}px`);
    gate.style.setProperty("--gateway-pointer-y", `${lastPointer.clientY}px`);
    gate.style.setProperty("--gateway-parallax-x", `${(x * 18).toFixed(2)}px`);
    gate.style.setProperty("--gateway-parallax-y", `${(y * 14).toFixed(2)}px`);
    card.style.setProperty("--gateway-card-x", `${(-y * 1.6).toFixed(2)}deg`);
    card.style.setProperty("--gateway-card-y", `${(x * 2.1).toFixed(2)}deg`);

    const cardRect = card.getBoundingClientRect();
    card.style.setProperty("--gateway-card-spot-x", `${Math.max(0, Math.min(100, ((lastPointer.clientX - cardRect.left) / cardRect.width) * 100)).toFixed(1)}%`);
    card.style.setProperty("--gateway-card-spot-y", `${Math.max(0, Math.min(100, ((lastPointer.clientY - cardRect.top) / cardRect.height) * 100)).toFixed(1)}%`);

    const logo = gate.querySelector(".auth-brand-lockup .brand-mark");
    logo?.style.setProperty("--gateway-logo-x", `${(-y * 3).toFixed(2)}deg`);
    logo?.style.setProperty("--gateway-logo-y", `${(x * 4).toFixed(2)}deg`);
  };

  const queuePointer = (event) => {
    lastPointer = event;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
  };

  const resetPointer = () => {
    lastPointer = null;
    gate.style.setProperty("--gateway-parallax-x", "0px");
    gate.style.setProperty("--gateway-parallax-y", "0px");
    card.style.setProperty("--gateway-card-x", "0deg");
    card.style.setProperty("--gateway-card-y", "0deg");
    gate.querySelector(".auth-brand-lockup .brand-mark")?.style.setProperty("--gateway-logo-x", "0deg");
    gate.querySelector(".auth-brand-lockup .brand-mark")?.style.setProperty("--gateway-logo-y", "0deg");
  };

  const monitorFps = (timestamp) => {
    fpsSamples += 1;
    const elapsed = timestamp - fpsStartedAt;
    if (elapsed >= 3200) {
      const fps = Math.round((fpsSamples * 1000) / elapsed);
      gate.dataset.gatewayFps = String(fps);
      if (
        fps < 45
        && gate.dataset.motionLevel === "high"
        && !safeRead(MOTION_KEY)
        && !reducedMotion.matches
      ) {
        setMotionLevel("soft");
        gate.dataset.motionAdaptive = "true";
      }
      fpsStartedAt = timestamp;
      fpsSamples = 0;
      if (fps >= 45 || gate.dataset.motionLevel !== "high") return;
    }
    fpsFrame = requestAnimationFrame(monitorFps);
  };

  gate.classList.add("hh-neon-gateway");
  normalizeDecorativeLayers();
  setMotionLevel(safeRead(MOTION_KEY) || (modestDevice ? "soft" : "high"));
  if (modestDevice && !safeRead(MOTION_KEY)) gate.dataset.motionAdaptive = "device";
  setState(card.dataset.authState || "idle");

  motionButton?.addEventListener("click", nextMotionLevel);
  gate.addEventListener("pointermove", queuePointer, { passive: true });
  gate.addEventListener("pointerleave", resetPointer, { passive: true });

  gate.addEventListener("focusin", (event) => {
    if (event.target.matches("input, textarea")) setState("typing");
  });

  gate.addEventListener("focusout", () => {
    requestAnimationFrame(deriveState);
  });

  gate.addEventListener("submit", () => {
    stateLock = "";
    setState("validating");
  }, true);

  gate.addEventListener("click", (event) => {
    if (event.target.closest("[data-oauth-provider], [data-passkey-login], [data-recovery-action], [data-email-verify-action]")) {
      stateLock = "";
      setState("validating");
    }
  });

  gate.addEventListener("hh:auth-demo-change", (event) => {
    if (innerWidth > 760 || reducedMotion.matches) return;
    const active = gate.querySelector(`[data-auth-demo="${CSS.escape(event.detail.id)}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });

  reducedMotion.addEventListener?.("change", () => setMotionLevel(safeRead(MOTION_KEY) || "high"));
  finePointer.addEventListener?.("change", resetPointer);
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("hh-page-hidden", document.hidden);
    if (document.hidden) {
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(fpsFrame);
      pointerFrame = 0;
      fpsFrame = 0;
      return;
    }
    if (!fpsFrame && !reducedMotion.matches && gate.dataset.motionLevel === "high") {
      fpsStartedAt = performance.now();
      fpsSamples = 0;
      fpsFrame = requestAnimationFrame(monitorFps);
    }
  });

  const stateObserver = new MutationObserver(deriveState);
  stateObserver.observe(card, {
    attributes: true,
    attributeFilter: ["class", "aria-busy", "data-auth-state"]
  });
  stateObserver.observe(gate, {
    attributes: true,
    attributeFilter: ["class"]
  });
  const statusNode = gate.querySelector("#authGateStatus");
  if (statusNode) {
    stateObserver.observe(statusNode, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  const layerObserver = new MutationObserver(normalizeDecorativeLayers);
  layerObserver.observe(gate, { childList: true });

  if (!reducedMotion.matches && gate.dataset.motionLevel === "high") {
    fpsFrame = requestAnimationFrame(monitorFps);
  }

  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(pointerFrame);
    cancelAnimationFrame(fpsFrame);
    stateObserver.disconnect();
    layerObserver.disconnect();
  }, { once: true });

  window.HHNeonGateway = Object.freeze({
    version: "3.0.0",
    setMotionLevel,
    state: () => card.dataset.authState,
    motion: () => gate.dataset.motionLevel
  });
})();
