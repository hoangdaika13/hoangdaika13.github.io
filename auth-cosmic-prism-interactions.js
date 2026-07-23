(() => {
  "use strict";

  const MOTION_KEY = "hh.auth.cosmic-prism.motion-mode";
  const THEME_KEY = "hh.auth.cosmic-prism.theme";
  const MUTE_KEY = "hh.auth.cosmic-prism.muted";
  const VALID_MOTIONS = new Set(["static", "balanced", "cinematic"]);
  const VALID_THEMES = new Set(["aurora", "cyberpunk", "solar", "ocean", "rainbow"]);
  const VALID_LOGO_STATES = new Set(["idle", "focus", "caps-lock", "loading", "success", "error"]);
  const PORTAL_MAX_DURATION = 1100;
  const DEFAULT_PORTAL_DURATION = 980;
  const PRODUCT_PALETTE = Object.freeze(["#44E7F2", "#FF4FB8", "#FFE66D", "#72F6A7", "#FF766D", "#A989FF", "#070A12"]);
  const PRODUCT_PLANETS = Object.freeze([
    { id: "creative", route: "/create", aliases: ["create"] },
    { id: "music", route: "/music-ai", aliases: ["music", "music-ai"] },
    { id: "design", route: "/graphic-design", aliases: ["design", "graphic-design", "media-design"] },
    { id: "dev", route: "/dev-tools", aliases: ["dev", "developer"] },
    { id: "learning", route: "/learn", aliases: ["learning", "learn", "english"] },
    { id: "game", route: "/entertainment", aliases: ["game", "entertainment"] },
    { id: "community", route: "/communication", aliases: ["community", "communication"] }
  ]);
  const THEME_PALETTES = Object.freeze({
    aurora: ["#44e7f2", "#ff4fb8", "#ffe66d", "#72f6a7"],
    cyberpunk: ["#44e7f2", "#ff4fb8", "#ffe66d", "#a989ff"],
    solar: ["#ffe66d", "#ff766d", "#ff4fb8", "#72f6a7"],
    ocean: ["#44e7f2", "#4895ff", "#72f6a7", "#a989ff"],
    rainbow: ["#44e7f2", "#ff4fb8", "#ffe66d", "#72f6a7"]
  });
  let activeInstance = null;

  const safeRead = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; }
    catch { return fallback; }
  };

  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, String(value)); }
    catch { /* Preferences remain available for the current page only. */ }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const createNode = (tag, className, attributes = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    });
    return node;
  };

  const mount = (options = {}) => {
    if (activeInstance) return activeInstance;
    if (typeof document === "undefined") return null;

    const gate = typeof options.root === "string"
      ? document.querySelector(options.root)
      : options.root || document.querySelector("#authGate");
    if (!gate) return null;

    const card = gate.querySelector("[data-auth-card], .auth-gate-card");
    const logoHosts = [...gate.querySelectorAll(".auth-brand-lockup .brand-mark, .auth-card-heading > span, .auth-universe-core")];
    const cleanupTasks = [];
    const createdNodes = [];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)") || null;
    let destroyed = false;
    let motionPreference = safeRead(MOTION_KEY, "balanced");
    let themePreference = safeRead(THEME_KEY, "aurora");
    let muted = safeRead(MUTE_KEY, "false") === "true";
    let hasInteracted = false;
    let capsLockActive = false;
    let focusedControl = null;
    let realtimeConnected = null;
    let forcedLogoState = "";
    let selectedPlanetId = "";
    let audioContext = null;
    let audioMaster = null;
    let pointerFrame = 0;
    let connectorFrame = 0;
    let portalTimer = 0;
    let portalRun = null;
    let lastPortalAt = 0;

    if (!VALID_MOTIONS.has(motionPreference)) motionPreference = "balanced";
    if (!VALID_THEMES.has(themePreference)) themePreference = "aurora";

    const listen = (target, type, handler, listenerOptions) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, listenerOptions);
      cleanupTasks.push(() => target.removeEventListener(type, handler, listenerOptions));
    };

    const rememberNode = (node, parent = gate) => {
      parent?.append(node);
      createdNodes.push(node);
      return node;
    };

    gate.classList.add("hh-cosmic-prism");
    gate.dataset.cpTheme = themePreference;
    gate.dataset.cpNetwork = navigator.onLine ? "online" : "offline";

    const cosmicLayer = createNode("div", "hcp-cosmic-layer", { "aria-hidden": "true" });
    const starColors = [...PRODUCT_PALETTE.slice(0, 6), "#ffffff"];
    const starCount = clamp(Number(options.starCount) || 64, 24, 96);
    for (let index = 0; index < starCount; index += 1) {
      const star = createNode("i", "hcp-star");
      const seed = (index * 47 + 13) % 101;
      star.style.setProperty("--hcp-star-x", `${(seed * 37) % 100}%`);
      star.style.setProperty("--hcp-star-y", `${(seed * 61 + index * 7) % 100}%`);
      star.style.setProperty("--hcp-star-size", `${1 + (index % 3)}px`);
      star.style.setProperty("--hcp-star-opacity", String(.35 + (index % 6) * .1));
      star.style.setProperty("--hcp-star-speed", `${2.4 + (index % 7) * .7}s`);
      star.style.setProperty("--hcp-star-color", starColors[index % starColors.length]);
      cosmicLayer.append(star);
    }
    for (let index = 0; index < 2; index += 1) {
      const meteor = createNode("span", "hcp-meteor");
      meteor.style.setProperty("--hcp-meteor-y", `${18 + index * 43}%`);
      meteor.style.setProperty("--hcp-meteor-speed", `${18 + index * 9}s`);
      meteor.style.setProperty("--hcp-meteor-delay", `${4 + index * 8}s`);
      cosmicLayer.append(meteor);
    }
    gate.prepend(cosmicLayer);
    createdNodes.push(cosmicLayer);

    const connectorLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connectorLayer.classList.add("hcp-connection-layer");
    connectorLayer.setAttribute("aria-hidden", "true");
    rememberNode(connectorLayer);

    const liveRegion = createNode("span", "hcp-live-region", {
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true"
    });
    rememberNode(liveRegion);

    const controls = createNode("details", "hcp-control-cluster", {
      "aria-label": "Tùy chỉnh Cosmic Prism"
    });
    controls.innerHTML = `
      <summary class="hcp-control-summary">
        <span><i></i>Hiệu ứng đăng nhập</span>
        <small>Chuyển động, màu sắc và âm thanh</small>
      </summary>
      <div class="hcp-control-body">
        <div class="hcp-control-row">
          <span class="hcp-control-label"><i></i>Motion Director</span>
          <div class="hcp-segmented hcp-motion-options" role="group" aria-label="Mức chuyển động">
            <button type="button" data-hcp-motion="static">Tĩnh</button>
            <button type="button" data-hcp-motion="balanced">Cân bằng</button>
            <button type="button" data-hcp-motion="cinematic">Điện ảnh</button>
          </div>
        </div>
        <div class="hcp-control-row">
          <span class="hcp-control-label"><i></i>Theme Portal</span>
          <div class="hcp-segmented hcp-theme-options" role="group" aria-label="Chọn giao diện">
            <button type="button" data-hcp-theme="aurora" style="--hcp-swatch:#72f6a7">Aurora</button>
            <button type="button" data-hcp-theme="cyberpunk" style="--hcp-swatch:#ff4fb8">Cyberpunk</button>
            <button type="button" data-hcp-theme="solar" style="--hcp-swatch:#ffe66d">Solar</button>
            <button type="button" data-hcp-theme="ocean" style="--hcp-swatch:#44e7f2">Ocean</button>
            <button type="button" data-hcp-theme="rainbow" style="--hcp-swatch:#a989ff">Rainbow</button>
          </div>
        </div>
        <div class="hcp-utility-row">
          <span class="hcp-network-state" data-hcp-network-state><i></i><span></span></span>
          <button class="hcp-mute-toggle" type="button" data-hcp-mute></button>
        </div>
      </div>
    `;
    const cardFooter = card?.querySelector(".auth-card-footer");
    if (cardFooter) {
      cardFooter.before(controls);
      createdNodes.push(controls);
    } else rememberNode(controls, card || gate);

    const portal = createNode("section", "hcp-portal-transition", {
      "aria-hidden": "true",
      "aria-label": "Đang mở HH Platform"
    });
    portal.innerHTML = `
      <div class="hcp-portal-ring" aria-hidden="true"><span class="hcp-portal-core">HH</span></div>
      <div class="hcp-portal-copy"><strong>Đã xác thực</strong><span>Đang mở không gian của bạn...</span></div>
      <button class="hcp-portal-skip" type="button" data-hcp-portal-skip>Bỏ qua chuyển cảnh</button>`;
    rememberNode(portal, document.body);

    logoHosts.forEach((host) => {
      host.classList.add("hcp-logo-host");
      host.dataset.cpLogoState = "idle";
    });

    const announce = (message) => {
      liveRegion.textContent = "";
      window.setTimeout(() => { if (!destroyed) liveRegion.textContent = message; }, 0);
    };

    const getEffectiveMotion = () => {
      if (reducedMotion?.matches) return "static";
      if (document.visibilityState !== "visible") return "static";
      return motionPreference;
    };

    const syncPause = () => {
      const paused = document.visibilityState !== "visible" || Boolean(reducedMotion?.matches);
      gate.classList.toggle("hcp-paused", paused);
      gate.dataset.cpMotion = getEffectiveMotion();
    };

    const syncControls = () => {
      controls.querySelectorAll("[data-hcp-motion]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.hcpMotion === motionPreference));
      });
      controls.querySelectorAll("[data-hcp-theme]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.hcpTheme === themePreference));
      });
      const muteButton = controls.querySelector("[data-hcp-mute]");
      if (muteButton) {
        muteButton.setAttribute("aria-pressed", String(muted));
        muteButton.setAttribute("aria-label", muted ? "Bật âm thanh Cosmic Prism" : "Tắt âm thanh Cosmic Prism");
        muteButton.textContent = muted ? "Âm thanh: Tắt" : "Âm thanh: Bật";
      }
      syncPause();
    };

    const setMotion = (value, { persist = true, announceChange = true } = {}) => {
      if (!VALID_MOTIONS.has(value)) return motionPreference;
      motionPreference = value;
      if (persist) safeWrite(MOTION_KEY, value);
      syncControls();
      if (announceChange) announce(`Motion Director: ${value}`);
      window.dispatchEvent(new CustomEvent("hh:cosmic-prism-motion-change", {
        detail: { preference: motionPreference, effective: getEffectiveMotion() }
      }));
      return motionPreference;
    };

    const setTheme = (value, { persist = true, announceChange = true } = {}) => {
      if (!VALID_THEMES.has(value)) return themePreference;
      themePreference = value;
      gate.dataset.cpTheme = value;
      const palette = THEME_PALETTES[value];
      [gate, portal].forEach((target) => {
        palette.forEach((color, index) => target.style.setProperty(`--hcp-theme-${String.fromCharCode(97 + index)}`, color));
      });
      if (persist) safeWrite(THEME_KEY, value);
      syncControls();
      if (announceChange) announce(`Theme Portal: ${value}`);
      window.dispatchEvent(new CustomEvent("hh:cosmic-prism-theme-change", { detail: { theme: value } }));
      return themePreference;
    };

    const setMuted = (value, { persist = true } = {}) => {
      muted = Boolean(value);
      if (persist) safeWrite(MUTE_KEY, muted);
      if (audioMaster && audioContext) {
        audioMaster.gain.setTargetAtTime(muted ? .0001 : .11, audioContext.currentTime, .025);
      }
      syncControls();
      announce(muted ? "Đã tắt âm thanh Cosmic Prism" : "Đã bật âm thanh Cosmic Prism");
      return muted;
    };

    const markInteraction = () => { hasInteracted = true; };

    const ensureAudio = () => {
      if (!hasInteracted || muted || document.visibilityState !== "visible") return null;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        audioMaster = audioContext.createGain();
        audioMaster.gain.value = .11;
        audioMaster.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
      return audioContext;
    };

    const playSignature = (variant = "success") => {
      const context = ensureAudio();
      if (!context || !audioMaster) return false;
      const start = context.currentTime + .012;
      const panner = context.createPanner();
      const envelope = context.createGain();
      const notes = variant === "planet" ? [392, 523.25] : [440, 659.25, 880];
      panner.panningModel = "equalpower";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 8;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(-.35, start);
        panner.positionX.linearRampToValueAtTime(.35, start + .8);
        panner.positionZ.setValueAtTime(-.75, start);
      } else panner.setPosition(-.35, 0, -.75);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(1, start + .035);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + (variant === "planet" ? .42 : 1.05));
      envelope.connect(panner);
      panner.connect(audioMaster);
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = start + index * .14;
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(.24, noteStart + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, noteStart + .46);
        oscillator.connect(gain);
        gain.connect(envelope);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + .5);
      });
      window.setTimeout(() => {
        try { envelope.disconnect(); panner.disconnect(); }
        catch { /* Nodes can already be disconnected during page teardown. */ }
      }, 1300);
      return true;
    };

    const setNetworkState = (state, message) => {
      const normalized = ["online", "offline", "degraded"].includes(state) ? state : "online";
      gate.dataset.cpNetwork = normalized;
      const label = controls.querySelector("[data-hcp-network-state] span");
      if (label) label.textContent = message || ({
        online: "Thiết bị đang trực tuyến",
        offline: "Ngoại tuyến · chức năng local vẫn dùng được",
        degraded: "Realtime chưa kết nối"
      })[normalized];
      if (normalized !== "online") announce(label?.textContent || "Kết nối thay đổi");
    };

    const deriveLogoState = () => {
      if (forcedLogoState) return forcedLogoState;
      const authState = String(card?.dataset.authState || gate.dataset.authStatus || "").toLowerCase();
      if (gate.classList.contains("auth-success") || gate.classList.contains("is-auth-success") || authState === "success") return "success";
      if (gate.querySelector(".auth-authenticating, [aria-busy='true']") || ["loading", "authenticating", "busy"].includes(authState)) return "loading";
      if (authState === "error" || gate.querySelector("[aria-invalid='true']")) return "error";
      if (capsLockActive) return "caps-lock";
      if (focusedControl && gate.contains(focusedControl)) return "focus";
      return "idle";
    };

    const setLogoState = (state) => {
      const next = VALID_LOGO_STATES.has(state) ? state : "idle";
      logoHosts.forEach((host) => { host.dataset.cpLogoState = next; });
      gate.dataset.cpLogoState = next;
      gate.classList.toggle("is-cp-authenticating", next === "loading");
      if (next === "loading") scheduleConnectorUpdate();
      return next;
    };

    const syncLogoState = () => setLogoState(deriveLogoState());

    const updateGaze = (target) => {
      if (!target || reducedMotion?.matches || getEffectiveMotion() === "static") {
        logoHosts.forEach((host) => {
          host.style.setProperty("--hcp-logo-x", "0px");
          host.style.setProperty("--hcp-logo-y", "0px");
        });
        return;
      }
      const targetRect = target.getBoundingClientRect();
      logoHosts.forEach((host) => {
        const rect = host.getBoundingClientRect();
        const dx = clamp((targetRect.left + targetRect.width / 2 - rect.left - rect.width / 2) / Math.max(innerWidth, 1), -.5, .5);
        const dy = clamp((targetRect.top + targetRect.height / 2 - rect.top - rect.height / 2) / Math.max(innerHeight, 1), -.5, .5);
        host.style.setProperty("--hcp-logo-x", `${(dx * 7).toFixed(2)}px`);
        host.style.setProperty("--hcp-logo-y", `${(dy * 5).toFixed(2)}px`);
      });
    };

    const updateConnectors = () => {
      connectorFrame = 0;
      const planets = [...gate.querySelectorAll("[data-universe-id]")];
      const core = gate.querySelector(".auth-universe-core") || logoHosts[0];
      if (!planets.length || !core || gate.dataset.cpLogoState !== "loading") {
        connectorLayer.replaceChildren();
        return;
      }
      const gateRect = gate.getBoundingClientRect();
      const coreRect = core.getBoundingClientRect();
      const width = Math.max(1, gateRect.width);
      const height = Math.max(1, gateRect.height);
      connectorLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
      connectorLayer.replaceChildren(...planets.map((planet, index) => {
        const rect = planet.getBoundingClientRect();
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(rect.left - gateRect.left + rect.width / 2));
        line.setAttribute("y1", String(rect.top - gateRect.top + rect.height / 2));
        line.setAttribute("x2", String(coreRect.left - gateRect.left + coreRect.width / 2));
        line.setAttribute("y2", String(coreRect.top - gateRect.top + coreRect.height / 2));
        line.style.setProperty("--hcp-line-color", planet.dataset.universeId === selectedPlanetId ? "#ffffff" : ["#44e7f2", "#ff4fb8", "#ffe66d", "#72f6a7", "#a989ff"][index % 5]);
        return line;
      }));
    };

    function scheduleConnectorUpdate() {
      if (connectorFrame) return;
      connectorFrame = window.requestAnimationFrame(updateConnectors);
    }

    const finishPortal = (reason = "completed") => {
      if (!portalRun) return null;
      const run = portalRun;
      portalRun = null;
      if (portalTimer) window.clearTimeout(portalTimer);
      portalTimer = 0;
      portal.classList.remove("is-active");
      portal.setAttribute("aria-hidden", "true");
      forcedLogoState = "";
      syncLogoState();
      const result = { completed: reason === "completed", skipped: reason === "skipped", reason, duration: Date.now() - run.startedAt };
      run.resolve(result);
      window.dispatchEvent(new CustomEvent("hh:cosmic-prism-transition-complete", { detail: result }));
      return result;
    };

    const playSuccessPortal = ({ message = "Đang mở không gian của bạn...", duration = DEFAULT_PORTAL_DURATION } = {}) => {
      if (portalRun) return portalRun.promise;
      if (Date.now() - lastPortalAt < 2500) {
        return Promise.resolve({ completed: true, skipped: false, reason: "deduplicated", duration: 0 });
      }
      lastPortalAt = Date.now();
      const effectiveDuration = reducedMotion?.matches || motionPreference === "static"
        ? 0
        : clamp(Number(duration) || DEFAULT_PORTAL_DURATION, 0, PORTAL_MAX_DURATION);
      const copy = portal.querySelector(".hcp-portal-copy span");
      if (copy) copy.textContent = message;
      portal.style.setProperty("--hcp-portal-duration", `${effectiveDuration || 1}ms`);
      portal.classList.add("is-active");
      portal.setAttribute("aria-hidden", "false");
      forcedLogoState = "success";
      setLogoState("success");
      playSignature("success");
      announce("Đăng nhập thành công. Đang mở HH Platform.");
      let resolveRun;
      const promise = new Promise((resolve) => { resolveRun = resolve; });
      portalRun = { promise, resolve: resolveRun, startedAt: Date.now() };
      portalTimer = window.setTimeout(() => finishPortal("completed"), effectiveDuration);
      return promise;
    };

    const handlePointerMove = (event) => {
      if (pointerFrame || getEffectiveMotion() === "static") return;
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        const rect = gate.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        const y = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
        gate.style.setProperty("--hcp-pointer-x", `${(x * 100).toFixed(1)}%`);
        gate.style.setProperty("--hcp-pointer-y", `${(y * 100).toFixed(1)}%`);
        if (card && motionPreference === "cinematic" && !coarsePointer?.matches && !reducedMotion?.matches) {
          const cardRect = card.getBoundingClientRect();
          const cardX = clamp((event.clientX - cardRect.left) / Math.max(cardRect.width, 1) - .5, -.5, .5);
          const cardY = clamp((event.clientY - cardRect.top) / Math.max(cardRect.height, 1) - .5, -.5, .5);
          gate.style.setProperty("--hcp-card-rotate-x", `${(-cardY * 2.4).toFixed(2)}deg`);
          gate.style.setProperty("--hcp-card-rotate-y", `${(cardX * 2.4).toFixed(2)}deg`);
        }
      });
    };

    const resetPointer = () => {
      gate.style.setProperty("--hcp-card-rotate-x", "0deg");
      gate.style.setProperty("--hcp-card-rotate-y", "0deg");
    };

    const handleFocusIn = (event) => {
      focusedControl = event.target;
      updateGaze(event.target);
      syncLogoState();
    };

    const handleFocusOut = (event) => {
      if (!event.relatedTarget || !gate.contains(event.relatedTarget)) {
        focusedControl = null;
        updateGaze(null);
      }
      window.setTimeout(syncLogoState, 0);
    };

    const handleCapsLock = (event) => {
      if (!event.target?.matches?.('input[type="password"]') || typeof event.getModifierState !== "function") return;
      capsLockActive = event.getModifierState("CapsLock");
      syncLogoState();
    };

    const handleUniverseSelection = (event) => {
      const detail = event.detail || {};
      const incomingId = String(detail.id || "");
      const productPlanet = PRODUCT_PLANETS.find((item) => item.id === incomingId || item.aliases.includes(incomingId));
      selectedPlanetId = productPlanet?.aliases.find((alias) => gate.querySelector(`[data-universe-id="${alias}"]`)) || incomingId;
      if (hasInteracted) playSignature("planet");
      scheduleConnectorUpdate();
    };

    const handleOnline = () => {
      setNetworkState(realtimeConnected === false ? "degraded" : "online");
      syncLogoState();
    };

    const handleOffline = () => {
      setNetworkState("offline");
      syncLogoState();
    };

    const handleVisibility = () => {
      syncPause();
      if (document.visibilityState !== "visible") resetPointer();
      else scheduleConnectorUpdate();
    };

    listen(gate, "pointerdown", markInteraction, { passive: true });
    listen(gate, "keydown", markInteraction);
    listen(gate, "pointermove", handlePointerMove, { passive: true });
    listen(gate, "pointerleave", resetPointer, { passive: true });
    listen(gate, "focusin", handleFocusIn);
    listen(gate, "focusout", handleFocusOut);
    listen(gate, "keydown", handleCapsLock);
    listen(gate, "keyup", handleCapsLock);
    listen(window, "online", handleOnline);
    listen(window, "offline", handleOffline);
    listen(window, "resize", scheduleConnectorUpdate, { passive: true });
    listen(window, "hh:realtime-ready", () => { realtimeConnected = true; handleOnline(); });
    listen(window, "hh:realtime-offline", () => {
      realtimeConnected = false;
      setNetworkState(navigator.onLine ? "degraded" : "offline");
    });
    listen(window, "hh:auth-universe-select", handleUniverseSelection);
    listen(gate, "hh:auth-success", (event) => {
      void playSuccessPortal({ message: event.detail?.message || "Đang mở không gian của bạn..." });
    });
    listen(window, "hh:auth-change", (event) => {
      if (event.detail?.user) void playSuccessPortal();
    });
    listen(document, "visibilitychange", handleVisibility);

    if (reducedMotion?.addEventListener) listen(reducedMotion, "change", handleVisibility);
    else if (reducedMotion?.addListener) {
      reducedMotion.addListener(handleVisibility);
      cleanupTasks.push(() => reducedMotion.removeListener(handleVisibility));
    }

    listen(controls, "click", (event) => {
      markInteraction();
      const motionButton = event.target.closest("[data-hcp-motion]");
      const themeButton = event.target.closest("[data-hcp-theme]");
      const muteButton = event.target.closest("[data-hcp-mute]");
      if (motionButton) setMotion(motionButton.dataset.hcpMotion);
      if (themeButton) setTheme(themeButton.dataset.hcpTheme);
      if (muteButton) {
        const nextMuted = !muted;
        setMuted(nextMuted);
        if (!nextMuted) playSignature("planet");
      }
    });
    listen(portal, "click", (event) => {
      if (event.target.closest("[data-hcp-portal-skip]")) finishPortal("skipped");
    });

    const observer = new MutationObserver((mutations) => {
      const onlyOwnMutations = mutations.every((mutation) => createdNodes.some((node) => node === mutation.target || node.contains?.(mutation.target)));
      if (onlyOwnMutations) return;
      if (!gate.isConnected) unmount();
      else {
        syncLogoState();
        scheduleConnectorUpdate();
      }
    });
    observer.observe(gate, {
      attributes: true,
      attributeFilter: ["class", "data-auth-status", "data-auth-state", "aria-hidden"],
      childList: true,
      subtree: true
    });

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(scheduleConnectorUpdate)
      : null;
    resizeObserver?.observe(gate);
    gate.querySelector(".auth-creative-universe") && resizeObserver?.observe(gate.querySelector(".auth-creative-universe"));

    const inspect = () => Object.freeze({
      mounted: !destroyed,
      logoState: gate.dataset.cpLogoState || "idle",
      network: gate.dataset.cpNetwork || "online",
      motionPreference,
      effectiveMotion: getEffectiveMotion(),
      theme: themePreference,
      muted,
      hasInteracted,
      selectedPlanetId
    });

    function unmount() {
      if (destroyed) return false;
      destroyed = true;
      observer.disconnect();
      resizeObserver?.disconnect();
      cleanupTasks.splice(0).forEach((cleanup) => cleanup());
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      if (connectorFrame) window.cancelAnimationFrame(connectorFrame);
      if (portalTimer) window.clearTimeout(portalTimer);
      pointerFrame = 0;
      connectorFrame = 0;
      portalTimer = 0;
      if (portalRun) {
        const run = portalRun;
        portalRun = null;
        run.resolve({ completed: false, skipped: true, reason: "unmounted", duration: Date.now() - run.startedAt });
      }
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => {});
      audioContext = null;
      audioMaster = null;
      createdNodes.forEach((node) => node.remove());
      logoHosts.forEach((host) => {
        host.classList.remove("hcp-logo-host");
        host.removeAttribute("data-cp-logo-state");
        host.style.removeProperty("--hcp-logo-x");
        host.style.removeProperty("--hcp-logo-y");
      });
      gate.classList.remove("hh-cosmic-prism", "hcp-paused", "is-cp-authenticating");
      ["cpTheme", "cpNetwork", "cpMotion", "cpLogoState"].forEach((key) => { delete gate.dataset[key]; });
      ["--hcp-pointer-x", "--hcp-pointer-y", "--hcp-card-rotate-x", "--hcp-card-rotate-y"].forEach((property) => gate.style.removeProperty(property));
      activeInstance = null;
      return true;
    }

    setMotion(motionPreference, { persist: false, announceChange: false });
    setTheme(themePreference, { persist: false, announceChange: false });
    syncControls();
    setNetworkState(navigator.onLine ? "online" : "offline");
    syncLogoState();
    scheduleConnectorUpdate();

    activeInstance = Object.freeze({
      available: true,
      mount,
      unmount,
      inspect,
      setMotion,
      setTheme,
      setMuted,
      playSignature,
      playSuccessPortal,
      finishPortal,
      setLogoState: (state, { duration = 0 } = {}) => {
        if (!VALID_LOGO_STATES.has(state)) return deriveLogoState();
        forcedLogoState = state;
        setLogoState(state);
        if (duration > 0) window.setTimeout(() => {
          if (forcedLogoState === state && !destroyed) {
            forcedLogoState = "";
            syncLogoState();
          }
        }, duration);
        return state;
      }
    });
    return activeInstance;
  };

  const unmount = () => activeInstance?.unmount?.() || false;

  window.HHCosmicPrismInteractions = Object.freeze({
    mount,
    unmount,
    inspect: () => activeInstance?.inspect?.() || { mounted: false },
    constants: Object.freeze({
      motions: [...VALID_MOTIONS],
      themes: [...VALID_THEMES],
      planets: PRODUCT_PLANETS.map(({ id, route }) => ({ id, route })),
      logoStates: [...VALID_LOGO_STATES],
      palette: [...PRODUCT_PALETTE],
      portalMaxDuration: PORTAL_MAX_DURATION
    })
  });
})();
