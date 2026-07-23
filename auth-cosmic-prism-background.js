(() => {
  "use strict";

  const GLOBAL_NAME = "HHCosmicPrismBackground";
  const VERSION = "1.0.0";
  const HOST_CLASS = "hh-cosmic-prism-host";
  const DEFAULT_TARGETS = [
    "[data-hh-cosmic-prism]",
    "#authGate .auth-creative-universe",
    "#authGate .auth-product-preview",
    "#authGate .auth-feature-showcase",
    "#authGate .auth-gate-brand"
  ];

  const MODULES = Object.freeze([
    Object.freeze({
      id: "creative",
      short: "ST",
      label: "Sáng tạo",
      color: "#ff4fb8",
      route: "/create",
      description: "AI Center, kịch bản, nội dung và tự động hóa sáng tạo.",
      features: ["AI", "Kịch bản", "Workflow"]
    }),
    Object.freeze({
      id: "music",
      short: "MU",
      label: "Music AI",
      color: "#72f6a7",
      route: "/music-ai",
      description: "Sáng tác, phối khí, mix, master và xuất bản âm nhạc.",
      features: ["Composer", "Timeline", "Master"]
    }),
    Object.freeze({
      id: "design",
      short: "DS",
      label: "Design",
      color: "#ffe66d",
      route: "/graphic-design",
      description: "Ảnh, video, vector, motion, 3D và thiết kế tương tác.",
      features: ["Media", "Motion", "3D"]
    }),
    Object.freeze({
      id: "dev",
      short: "DV",
      label: "DEV",
      color: "#44e7f2",
      route: "/dev-tools",
      description: "API, code, dữ liệu, bảo mật và công cụ chẩn đoán web.",
      features: ["API", "Code", "Security"]
    }),
    Object.freeze({
      id: "learning",
      short: "HL",
      label: "Học tập",
      color: "#a989ff",
      route: "/learn",
      description: "Lộ trình cá nhân hóa, bài học, ôn tập và lớp học.",
      features: ["Lộ trình", "Ôn tập", "AI Coach"]
    }),
    Object.freeze({
      id: "game",
      short: "GM",
      label: "Game",
      color: "#ff766d",
      route: "/entertainment",
      description: "Game Center, ASTRA Universe, thành tích và multiplayer.",
      features: ["ASTRA", "Arcade", "Realtime"]
    }),
    Object.freeze({
      id: "community",
      short: "CM",
      label: "Community",
      color: "#62d5ff",
      route: "/communication",
      description: "Bảng tin, nhắn tin, nhóm và cộng tác thời gian thực.",
      features: ["Social", "Messenger", "Groups"]
    })
  ]);

  const QUALITY_LEVELS = Object.freeze({
    static: Object.freeze({ particles: 24, dpr: 1, meteors: false }),
    eco: Object.freeze({ particles: 36, dpr: 1, meteors: false }),
    balanced: Object.freeze({ particles: 62, dpr: 1.25, meteors: true }),
    cinematic: Object.freeze({ particles: 92, dpr: 1.5, meteors: true })
  });

  let activeInstance = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const resolveTarget = (target) => {
    if (target instanceof Element) return target;
    if (typeof target === "string" && target.trim()) {
      try {
        return document.querySelector(target);
      } catch {
        return null;
      }
    }
    const matches = DEFAULT_TARGETS.map((selector) => document.querySelector(selector)).filter(Boolean);
    return matches.find((match) => !match.hidden && match.getAttribute("aria-hidden") !== "true") || matches[0] || null;
  };

  const getConnection = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  const getDeviceBudget = () => {
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    if ((memory && memory <= 2) || (cores && cores <= 2)) return "eco";
    if ((memory && memory <= 4) || (cores && cores <= 4)) return "balanced";
    return "cinematic";
  };

  const makeMarkup = () => {
    const planets = MODULES.map((module, index) => {
      const startAngle = -90 + ((360 / MODULES.length) * index);
      return `
        <span class="hh-cosmic-prism__carrier" style="--cp-start:${startAngle}deg;--cp-index:${index}">
          <button
            class="hh-cosmic-prism__planet"
            type="button"
            role="tab"
            id="hhCosmicPrismTab-${module.id}"
            aria-controls="hhCosmicPrismPreview"
            aria-selected="${index === 0 ? "true" : "false"}"
            tabindex="${index === 0 ? "0" : "-1"}"
            data-cosmic-module="${module.id}"
            data-universe-id="${module.id}"
            style="--module-color:${module.color};--cp-counter:${-startAngle}deg"
          >
            <span class="hh-cosmic-prism__planet-face" aria-hidden="true"><b>${module.short}</b></span>
            <small>${module.label}</small>
          </button>
        </span>`;
    }).join("");

    return `
      <canvas class="hh-cosmic-prism__canvas" aria-hidden="true"></canvas>
      <div class="hh-cosmic-prism__nebula hh-cosmic-prism__nebula--cyan" aria-hidden="true"></div>
      <div class="hh-cosmic-prism__nebula hh-cosmic-prism__nebula--pink" aria-hidden="true"></div>
      <div class="hh-cosmic-prism__nebula hh-cosmic-prism__nebula--gold" aria-hidden="true"></div>
      <div class="hh-cosmic-prism__mouse-light" aria-hidden="true"></div>
      <div class="hh-cosmic-prism__chrome">
        <header class="hh-cosmic-prism__heading">
          <span><i></i> HH COSMIC PRISM</span>
          <small data-cosmic-quality>Đang cân chỉnh đồ họa</small>
        </header>
        <div class="hh-cosmic-prism__system" role="tablist" aria-label="Khám phá các không gian của HH Platform">
          <span class="hh-cosmic-prism__orbit hh-cosmic-prism__orbit--outer" aria-hidden="true"></span>
          <span class="hh-cosmic-prism__orbit hh-cosmic-prism__orbit--inner" aria-hidden="true"></span>
          <button class="hh-cosmic-prism__sun" type="button" aria-label="HH Platform" data-cosmic-sun>
            <span>HH</span><small>PLATFORM</small>
          </button>
          <div class="hh-cosmic-prism__planets">${planets}</div>
        </div>
        <article
          class="hh-cosmic-prism__preview"
          id="hhCosmicPrismPreview"
          role="tabpanel"
          aria-labelledby="hhCosmicPrismTab-creative"
          aria-live="polite"
        >
          <span class="hh-cosmic-prism__preview-mark" data-cosmic-short>ST</span>
          <div>
            <small data-cosmic-eyebrow>KHÔNG GIAN SÁNG TẠO</small>
            <h2 data-cosmic-title>Sáng tạo</h2>
            <p data-cosmic-description></p>
            <div class="hh-cosmic-prism__chips" data-cosmic-features></div>
          </div>
          <b class="hh-cosmic-prism__route" data-cosmic-route>/create</b>
        </article>
        <nav class="hh-cosmic-prism__mobile-dots" aria-label="Chuyển hành tinh">
          ${MODULES.map((module, index) => `<button type="button" data-cosmic-dot="${module.id}" aria-label="Xem ${module.label}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("")}
        </nav>
      </div>`;
  };

  const createInstance = (target, options = {}) => {
    const abortController = new AbortController();
    const { signal } = abortController;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const compactViewport = window.matchMedia?.("(max-width: 720px)") || null;
    const connection = getConnection();
    let requestedMode = ["auto", "static", "balanced", "cinematic"].includes(options.motion)
      ? options.motion
      : "auto";

    const root = document.createElement("section");
    root.className = "hh-cosmic-prism";
    root.dataset.running = "false";
    root.dataset.quality = "balanced";
    root.dataset.activeModule = MODULES[0].id;
    root.setAttribute("aria-label", options.label || "Vũ trụ sản phẩm HH Cosmic Prism");
    root.innerHTML = makeMarkup();

    target.classList.add(HOST_CLASS);
    if (options.prepend === false) target.append(root);
    else target.prepend(root);

    const canvas = root.querySelector(".hh-cosmic-prism__canvas");
    const context = canvas?.getContext?.("2d", { alpha: true, desynchronized: true });
    const planetButtons = [...root.querySelectorAll("[data-cosmic-module]")];
    const dotButtons = [...root.querySelectorAll("[data-cosmic-dot]")];
    const system = root.querySelector(".hh-cosmic-prism__system");
    const preview = root.querySelector(".hh-cosmic-prism__preview");
    const title = root.querySelector("[data-cosmic-title]");
    const description = root.querySelector("[data-cosmic-description]");
    const eyebrow = root.querySelector("[data-cosmic-eyebrow]");
    const shortLabel = root.querySelector("[data-cosmic-short]");
    const features = root.querySelector("[data-cosmic-features]");
    const route = root.querySelector("[data-cosmic-route]");
    const qualityLabel = root.querySelector("[data-cosmic-quality]");

    let destroyed = false;
    let intersecting = true;
    let pointerInside = false;
    let selectedIndex = 0;
    let animationFrame = 0;
    let rendering = false;
    let pointerFrame = 0;
    let resizeFrame = 0;
    let lastFrameTime = 0;
    let fpsWindowStart = 0;
    let fpsFrames = 0;
    let healthyFpsWindows = 0;
    let width = 1;
    let height = 1;
    let renderDpr = 1;
    let quality = "balanced";
    let particles = [];
    let meteor = null;
    let nextMeteorAt = performance.now() + 9000;
    let pointer = { x: 0.5, y: 0.5 };
    let targetPointer = { x: 0.5, y: 0.5 };

    const getRequestedQuality = () => {
      if (reducedMotion?.matches || requestedMode === "static") return "static";
      if (connection?.saveData) return "eco";
      if (requestedMode === "balanced") return "balanced";
      if (requestedMode === "cinematic") return getDeviceBudget() === "eco" ? "balanced" : "cinematic";
      return getDeviceBudget();
    };

    const shouldRun = () => (
      !destroyed
      && document.visibilityState === "visible"
      && intersecting
      && !reducedMotion?.matches
      && quality !== "static"
    );

    const buildParticles = () => {
      const settings = QUALITY_LEVELS[quality];
      const palette = MODULES.map((module) => module.color);
      particles = Array.from({ length: settings.particles }, (_, index) => ({
        x: Math.random(),
        y: Math.random(),
        radius: 0.55 + Math.random() * (quality === "cinematic" ? 1.45 : 1.05),
        alpha: 0.24 + Math.random() * 0.62,
        phase: Math.random() * Math.PI * 2,
        speed: 0.000004 + Math.random() * 0.000012,
        drift: (Math.random() - 0.5) * 0.000014,
        color: palette[index % palette.length]
      }));
    };

    const resizeCanvas = () => {
      if (!canvas || !context || destroyed) return;
      const bounds = root.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const settings = QUALITY_LEVELS[quality];
      const pixelBudget = quality === "cinematic" ? 1800000 : 1050000;
      const budgetScale = Math.sqrt(pixelBudget / Math.max(1, width * height));
      renderDpr = clamp(Math.min(devicePixelRatio || 1, settings.dpr, budgetScale), 0.75, settings.dpr);
      canvas.width = Math.max(1, Math.round(width * renderDpr));
      canvas.height = Math.max(1, Math.round(height * renderDpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      buildParticles();
    };

    const setQuality = (nextQuality, source = "device") => {
      if (!QUALITY_LEVELS[nextQuality]) return;
      const requested = getRequestedQuality();
      const order = ["static", "eco", "balanced", "cinematic"];
      const bounded = order[Math.min(order.indexOf(nextQuality), order.indexOf(requested))];
      if (bounded === quality && particles.length) return;
      quality = bounded;
      root.dataset.quality = quality;
      root.dataset.qualitySource = source;
      if (qualityLabel) {
        qualityLabel.textContent = {
          static: "Chế độ tĩnh",
          eco: "Tiết kiệm dữ liệu",
          balanced: "Chuyển động cân bằng",
          cinematic: "Chuyển động điện ảnh"
        }[quality];
      }
      resizeCanvas();
      reconcile();
    };

    const drawStaticSpace = () => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      particles.forEach((particle) => {
        context.globalAlpha = particle.alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    };

    const spawnMeteor = (now) => {
      if (!QUALITY_LEVELS[quality].meteors || compactViewport?.matches || now < nextMeteorAt) return;
      meteor = {
        startedAt: now,
        duration: 900 + Math.random() * 550,
        x: width * (0.15 + Math.random() * 0.58),
        y: height * (0.04 + Math.random() * 0.24),
        length: 64 + Math.random() * 72,
        color: MODULES[Math.floor(Math.random() * MODULES.length)].color
      };
      nextMeteorAt = now + 11000 + Math.random() * 14000;
    };

    const drawMeteor = (now) => {
      if (!meteor || !context) return;
      const progress = (now - meteor.startedAt) / meteor.duration;
      if (progress >= 1) {
        meteor = null;
        return;
      }
      const eased = progress * progress;
      const x = meteor.x + (width * 0.22 * eased);
      const y = meteor.y + (height * 0.18 * eased);
      const gradient = context.createLinearGradient(x, y, x - meteor.length, y - meteor.length * 0.48);
      gradient.addColorStop(0, `${meteor.color}dd`);
      gradient.addColorStop(0.28, `${meteor.color}55`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.save();
      context.globalAlpha = Math.sin(progress * Math.PI);
      context.lineWidth = 1.3;
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - meteor.length, y - meteor.length * 0.48);
      context.stroke();
      context.restore();
    };

    const sampleFps = (now) => {
      if (!fpsWindowStart) fpsWindowStart = now;
      fpsFrames += 1;
      const elapsed = now - fpsWindowStart;
      if (elapsed < 2400) return;
      const fps = Math.round((fpsFrames * 1000) / elapsed);
      root.dataset.fps = String(fps);
      fpsFrames = 0;
      fpsWindowStart = now;

      if (fps < 34 && quality === "cinematic") {
        healthyFpsWindows = 0;
        setQuality("balanced", "fps");
      } else if (fps < 28 && quality === "balanced") {
        healthyFpsWindows = 0;
        setQuality("eco", "fps");
      } else if (fps > 54 && quality !== getRequestedQuality()) {
        healthyFpsWindows += 1;
        if (healthyFpsWindows >= 3) {
          const next = quality === "eco" ? "balanced" : "cinematic";
          healthyFpsWindows = 0;
          setQuality(next, "fps");
        }
      } else {
        healthyFpsWindows = 0;
      }
    };

    const render = (now) => {
      animationFrame = 0;
      rendering = true;
      if (!shouldRun() || !context) {
        rendering = false;
        root.dataset.running = "false";
        drawStaticSpace();
        return;
      }

      root.dataset.running = "true";
      const delta = clamp(now - (lastFrameTime || now), 8, 40);
      lastFrameTime = now;
      pointer.x += (targetPointer.x - pointer.x) * Math.min(1, delta * 0.008);
      pointer.y += (targetPointer.y - pointer.y) * Math.min(1, delta * 0.008);
      context.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.x += particle.drift * delta;
        particle.y += particle.speed * delta;
        if (particle.x < -0.03) particle.x = 1.03;
        if (particle.x > 1.03) particle.x = -0.03;
        if (particle.y > 1.03) particle.y = -0.03;
        const pulse = 0.64 + (Math.sin((now * 0.0017) + particle.phase) * 0.34);
        const parallaxX = (pointer.x - 0.5) * (4 + particle.radius * 2);
        const parallaxY = (pointer.y - 0.5) * (4 + particle.radius * 2);
        context.globalAlpha = particle.alpha * pulse;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(
          (particle.x * width) + parallaxX,
          (particle.y * height) + parallaxY,
          particle.radius,
          0,
          Math.PI * 2
        );
        context.fill();
      });
      context.globalAlpha = 1;
      spawnMeteor(now);
      drawMeteor(now);
      sampleFps(now);
      rendering = false;
      if (shouldRun()) animationFrame = requestAnimationFrame(render);
    };

    const reconcile = () => {
      if (destroyed) return;
      const running = shouldRun();
      root.dataset.running = String(running);
      if (running && !animationFrame && !rendering) {
        lastFrameTime = 0;
        animationFrame = requestAnimationFrame(render);
      } else if (!running && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        drawStaticSpace();
      } else if (!running) {
        drawStaticSpace();
      }
    };

    const selectModule = (moduleOrId, source = "api", activate = false) => {
      const index = typeof moduleOrId === "number"
        ? moduleOrId
        : MODULES.findIndex((module) => module.id === moduleOrId);
      if (index < 0 || index >= MODULES.length || destroyed) return null;
      selectedIndex = index;
      const module = MODULES[index];

      root.dataset.activeModule = module.id;
      root.style.setProperty("--cp-active", module.color);
      planetButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === index;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      dotButtons.forEach((button, buttonIndex) => {
        button.setAttribute("aria-current", String(buttonIndex === index));
      });
      preview?.setAttribute("aria-labelledby", `hhCosmicPrismTab-${module.id}`);
      if (title) title.textContent = module.label;
      if (description) description.textContent = module.description;
      if (eyebrow) eyebrow.textContent = `KHÔNG GIAN ${module.label.toLocaleUpperCase("vi-VN")}`;
      if (shortLabel) shortLabel.textContent = module.short;
      if (route) route.textContent = module.route;
      if (features) {
        features.replaceChildren(...module.features.map((feature) => {
          const chip = document.createElement("span");
          chip.textContent = feature;
          return chip;
        }));
      }

      const detail = Object.freeze({ ...module, index, source });
      root.dispatchEvent(new CustomEvent("hh:cosmic-prism:select", { bubbles: true, detail }));
      window.dispatchEvent(new CustomEvent("hh:auth-universe-select", { detail }));
      if (activate) {
        root.dispatchEvent(new CustomEvent("hh:cosmic-prism:activate", { bubbles: true, detail }));
      }
      return detail;
    };

    const moveSelection = (offset) => {
      const nextIndex = (selectedIndex + offset + MODULES.length) % MODULES.length;
      selectModule(nextIndex, "keyboard");
      planetButtons[nextIndex]?.focus({ preventScroll: true });
    };

    const onPointerMove = (event) => {
      const bounds = root.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      targetPointer = {
        x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
        y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
      };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        root.style.setProperty("--cp-mouse-x", `${(targetPointer.x * 100).toFixed(2)}%`);
        root.style.setProperty("--cp-mouse-y", `${(targetPointer.y * 100).toFixed(2)}%`);
        root.style.setProperty("--cp-tilt-x", `${((targetPointer.x - 0.5) * 1.4).toFixed(2)}deg`);
        root.style.setProperty("--cp-tilt-y", `${((0.5 - targetPointer.y) * 1.2).toFixed(2)}deg`);
      });
    };

    planetButtons.forEach((button, index) => {
      button.addEventListener("pointerenter", () => {
        pointerInside = true;
        root.classList.add("is-interacting");
        selectModule(index, "hover");
      }, { signal });
      button.addEventListener("pointerleave", () => {
        pointerInside = false;
        if (!root.matches(":focus-within")) root.classList.remove("is-interacting");
      }, { signal });
      button.addEventListener("focus", () => {
        root.classList.add("is-interacting");
        selectModule(index, "focus");
      }, { signal });
      button.addEventListener("blur", () => {
        if (!pointerInside && !root.matches(":focus-within")) root.classList.remove("is-interacting");
      }, { signal });
      button.addEventListener("click", () => selectModule(index, "click", true), { signal });
    });

    dotButtons.forEach((button, index) => {
      button.addEventListener("click", () => selectModule(index, "carousel"), { signal });
    });

    system?.addEventListener("keydown", (event) => {
      if (["ArrowRight", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        moveSelection(1);
      } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        selectModule(0, "keyboard");
        planetButtons[0]?.focus({ preventScroll: true });
      } else if (event.key === "End") {
        event.preventDefault();
        selectModule(MODULES.length - 1, "keyboard");
        planetButtons.at(-1)?.focus({ preventScroll: true });
      }
    }, { signal });

    target.addEventListener("pointermove", onPointerMove, { passive: true, signal });
    target.addEventListener("pointerleave", () => {
      targetPointer = { x: 0.5, y: 0.5 };
      root.style.setProperty("--cp-mouse-x", "50%");
      root.style.setProperty("--cp-mouse-y", "50%");
      root.style.setProperty("--cp-tilt-x", "0deg");
      root.style.setProperty("--cp-tilt-y", "0deg");
    }, { signal });

    root.querySelector("[data-cosmic-sun]")?.addEventListener("click", () => {
      root.classList.remove("is-sun-pulsing");
      void root.offsetWidth;
      root.classList.add("is-sun-pulsing");
      root.dispatchEvent(new CustomEvent("hh:cosmic-prism:sun", { bubbles: true }));
    }, { signal });

    const onVisibility = () => reconcile();
    const onEnvironmentChange = () => setQuality(getRequestedQuality(), "environment");
    document.addEventListener("visibilitychange", onVisibility, { signal });
    reducedMotion?.addEventListener?.("change", onEnvironmentChange, { signal });
    compactViewport?.addEventListener?.("change", () => {
      meteor = null;
      resizeCanvas();
    }, { signal });
    connection?.addEventListener?.("change", onEnvironmentChange, { signal });

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          resizeCanvas();
        });
      })
      : null;
    resizeObserver?.observe(root);

    const intersectionObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
        intersecting = Boolean(entries[0]?.isIntersecting);
        reconcile();
      }, { threshold: 0.02 })
      : null;
    intersectionObserver?.observe(root);

    const controller = Object.freeze({
      version: VERSION,
      root,
      target,
      modules: MODULES,
      select(id) {
        return selectModule(id, "api");
      },
      setMotionMode(mode) {
        if (!["static", "balanced", "cinematic", "auto"].includes(mode)) return false;
        requestedMode = mode;
        setQuality(getRequestedQuality(), "api");
        return true;
      },
      refresh() {
        setQuality(getRequestedQuality(), "refresh");
        resizeCanvas();
        reconcile();
      },
      unmount() {
        if (destroyed) return;
        destroyed = true;
        abortController.abort();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (pointerFrame) cancelAnimationFrame(pointerFrame);
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        root.remove();
        if (!target.querySelector(".hh-cosmic-prism")) target.classList.remove(HOST_CLASS);
        if (activeInstance === controller) activeInstance = null;
      }
    });

    quality = getRequestedQuality();
    root.dataset.quality = quality;
    selectModule(options.initialModule || MODULES[0].id, "mount");
    setQuality(quality, "mount");
    resizeCanvas();
    reconcile();
    return controller;
  };

  const api = Object.freeze({
    version: VERSION,
    modules: MODULES,
    mount(options = {}) {
      const normalizedOptions = options instanceof Element || typeof options === "string"
        ? { target: options }
        : { ...options };
      const target = resolveTarget(normalizedOptions.target);
      if (!target) return null;
      activeInstance?.unmount();
      activeInstance = createInstance(target, normalizedOptions);
      return activeInstance;
    },
    unmount() {
      activeInstance?.unmount();
      activeInstance = null;
    }
  });

  window[GLOBAL_NAME]?.unmount?.();
  window[GLOBAL_NAME] = api;
})();
