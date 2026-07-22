(() => {
  "use strict";

  const STORAGE_KEY = "hh.auth.selected-universe";
  const PENDING_ROUTE_KEY = "hh.auth.pending-route";
  const ROTATION_DELAY = 8000;
  const INTERACTION_PAUSE = 16000;
  const modules = Object.freeze([
    {
      id: "home", short: "HH", label: "Trang chủ", eyebrow: "Trung tâm điều khiển", route: "/home",
      color: "#62e9f2", orbit: 1, angle: 0,
      description: "Đi vào Command Center với lịch, công việc, ghi chú, trạng thái hệ thống và các lối tắt cá nhân.",
      capabilities: ["Command Center", "Widgets", "Today"]
    },
    {
      id: "create", short: "AI", label: "Sáng tạo", eyebrow: "AI và sản xuất nội dung", route: "/create",
      color: "#ff5dc8", orbit: 1, angle: 120,
      description: "Không gian AI Center, Kịch bản AI, Creator Studio, Media Center và tự động hóa sáng tạo.",
      capabilities: ["AI Center", "Creator", "Automation"]
    },
    {
      id: "music-ai", short: "MU", label: "Làm nhạc AI", eyebrow: "Âm thanh và xuất bản", route: "/music-ai/studio",
      color: "#72eadb", orbit: 1, angle: 240,
      description: "Sáng tác, viết lời, phối khí, mix, master, làm video và chuẩn bị nội dung xuất bản YouTube.",
      capabilities: ["Composer", "Timeline", "Master"]
    },
    {
      id: "media-design", short: "MD", label: "Media & Design", eyebrow: "Biên tập đa phương tiện", route: "/media-design",
      color: "#c87cff", orbit: 2, angle: 18,
      description: "Photo Editor, Video Editor và bộ công cụ xử lý ảnh, tài liệu, màu sắc cùng typography.",
      capabilities: ["Photo", "Video", "Toolkit"]
    },
    {
      id: "graphic-design", short: "GD", label: "Thiết kế đồ họa", eyebrow: "Motion, 3D và nhân vật", route: "/graphic-design",
      color: "#ff65cf", orbit: 2, angle: 90,
      description: "Thiết kế vector, hoạt ảnh, nhân vật, scene 3D, prototype và State Machine trong một studio.",
      capabilities: ["Motion", "3D", "Character"]
    },
    {
      id: "dev", short: "DV", label: "DEV", eyebrow: "Bộ công cụ lập trình", route: "/dev-tools",
      color: "#61e7ff", orbit: 2, angle: 162,
      description: "Xử lý dữ liệu, API, bảo mật, regex, database, code playground, Git và chẩn đoán web.",
      capabilities: ["API Studio", "Data Lab", "Diagnostics"]
    },
    {
      id: "work", short: "CV", label: "Công việc", eyebrow: "Dự án và cộng tác", route: "/work",
      color: "#baf46b", orbit: 2, angle: 234,
      description: "Quản lý project, cloud, download, wiki, store, team collaboration và workflow công việc.",
      capabilities: ["Projects", "Team", "Workflow"]
    },
    {
      id: "communication", short: "GT", label: "Giao tiếp", eyebrow: "Kết nối thời gian thực", route: "/communication",
      color: "#5ee8d7", orbit: 2, angle: 306,
      description: "Community, Messenger HH, thông báo, hỗ trợ, phản hồi và hồ sơ người dùng trong một nơi.",
      capabilities: ["Community", "Messenger", "Inbox"]
    },
    {
      id: "entertainment", short: "GX", label: "Giải trí", eyebrow: "Trải nghiệm và trò chơi", route: "/entertainment",
      color: "#ff8a5b", orbit: 3, angle: 0,
      description: "Khám phá các trải nghiệm tương tác, trò chơi vũ trụ và nội dung giải trí của HH Platform.",
      capabilities: ["Universe", "Games", "Realtime"]
    },
    {
      id: "insights", short: "PT", label: "Phân tích", eyebrow: "Dữ liệu và vận hành", route: "/analytics",
      color: "#ffbd69", orbit: 3, angle: 60,
      description: "Theo dõi analytics, tìm kiếm thông minh, quản trị, API, bảo mật và tình trạng nền tảng.",
      capabilities: ["Analytics", "Search", "Admin"]
    },
    {
      id: "learn", short: "HL", label: "Học tập", eyebrow: "Lộ trình cá nhân hóa", route: "/learn",
      color: "#9a86ff", orbit: 3, angle: 120,
      description: "Khóa học, bài luyện, Smart Review, kiểm tra, lớp học và AI Learning Coach theo mục tiêu.",
      capabilities: ["Learning Path", "Review", "Classroom"]
    },
    {
      id: "english", short: "EN", label: "HH English", eyebrow: "Tiếng Anh A0 đến C2", route: "/english",
      color: "#60e9f2", orbit: 3, angle: 180,
      description: "Học tiếng Anh theo trình độ, nghề nghiệp và kỹ năng với từ vựng, nghe nói và khảo sát tiến bộ.",
      capabilities: ["A0-C2", "Speaking", "Vocabulary"]
    },
    {
      id: "system", short: "SY", label: "Hệ thống", eyebrow: "Cài đặt và quyền riêng tư", route: "/system",
      color: "#68dda8", orbit: 3, angle: 240,
      description: "Quản lý cài đặt, giao diện, phiên đăng nhập, dữ liệu, quyền riêng tư và tính năng nền tảng.",
      capabilities: ["Settings", "Security", "Privacy"]
    },
    {
      id: "support", short: "UH", label: "Ủng hộ", eyebrow: "Đồng hành cùng HH", route: "/support",
      color: "#ff6fae", orbit: 3, angle: 300,
      description: "Ủng hộ nhà phát triển, theo dõi mục tiêu và cùng duy trì những công cụ miễn phí của HH.",
      capabilities: ["Donate", "Goals", "Supporters"]
    }
  ]);

  const orbitSettings = Object.freeze({
    1: { radius: 72, duration: 38 },
    2: { radius: 124, duration: 54 },
    3: { radius: 176, duration: 72 }
  });
  let instance = null;

  const readSelection = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return modules.some((item) => item.id === saved) ? saved : modules[0].id;
    } catch {
      return modules[0].id;
    }
  };

  const writeSelection = (item) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, item.id);
      sessionStorage.setItem(PENDING_ROUTE_KEY, `#${item.route}`);
    } catch {
      // Session storage can be unavailable in restricted browsing modes.
    }
  };

  const buildStars = () => Array.from({ length: 28 }, (_, index) => {
    const x = (index * 37 + 11) % 97;
    const y = (index * 53 + 7) % 93;
    const size = 1 + (index % 3);
    const delay = -((index * 0.37) % 4).toFixed(2);
    return `<i style="--star-x:${x}%;--star-y:${y}%;--star-size:${size}px;--star-delay:${delay}s"></i>`;
  }).join("");

  const buildMarkup = () => {
    const planets = modules.map((item, index) => {
      const orbit = orbitSettings[item.orbit];
      return `
        <span
          class="auth-universe-carrier"
          data-orbit="${item.orbit}"
          style="--orbit-radius:${orbit.radius}px;--orbit-angle:${item.angle}deg;--counter-angle:${-item.angle}deg;--orbit-duration:${orbit.duration}s"
        >
          <button
            class="auth-solar-planet"
            type="button"
            role="tab"
            id="authUniverseTab-${item.id}"
            aria-controls="authUniversePreview"
            aria-label="Chọn ${item.label} làm không gian mở sau đăng nhập"
            aria-selected="${index === 0 ? "true" : "false"}"
            tabindex="${index === 0 ? "0" : "-1"}"
            data-universe-id="${item.id}"
            data-universe-route="${item.route}"
            style="--planet-color:${item.color}"
          >
            <span class="auth-universe-planet-face" aria-hidden="true">${item.short}</span>
            <small aria-hidden="true">${item.label}</small>
          </button>
        </span>`;
    }).join("");

    return `
      <header class="auth-universe-heading">
        <span>HH Solar Universe</span>
        <small>${modules.length} hành tinh · Chọn nơi bắt đầu</small>
      </header>
      <div class="auth-universe-layout">
        <div class="auth-universe-stage" role="tablist" aria-label="Chọn không gian lớn trong HH Platform">
          <span class="auth-universe-starfield" aria-hidden="true">${buildStars()}</span>
          <span class="auth-universe-nebula" aria-hidden="true"></span>
          <span class="auth-universe-orbit-ring" data-orbit="1" aria-hidden="true"></span>
          <span class="auth-universe-orbit-ring" data-orbit="2" aria-hidden="true"></span>
          <span class="auth-universe-orbit-ring" data-orbit="3" aria-hidden="true"></span>
          <span class="auth-universe-core" aria-hidden="true"><b>HH</b><small>PLATFORM</small></span>
          ${planets}
        </div>
        <article
          class="auth-universe-preview"
          id="authUniversePreview"
          role="tabpanel"
          aria-labelledby="authUniverseTab-home"
          data-active-universe="home"
        >
          <small data-universe-eyebrow></small>
          <h2 data-universe-title></h2>
          <p data-universe-description></p>
          <div class="auth-universe-capabilities" data-universe-capabilities aria-label="Chức năng tiêu biểu"></div>
          <button class="auth-universe-select" type="button" data-universe-open>
            <span>Chọn không gian này</span><b aria-hidden="true">→</b>
          </button>
          <div class="auth-universe-guest-status">
            <span data-universe-status aria-live="polite">Hành tinh đã chọn sẽ mở ngay sau khi đăng nhập</span>
            <b data-universe-route-label></b>
          </div>
        </article>
      </div>`;
  };

  const createUniverse = () => {
    if (instance) return instance;

    const gate = document.querySelector("#authGate");
    const brand = gate?.querySelector(".auth-gate-brand");
    const showcase = brand?.querySelector(".auth-feature-showcase");
    if (!gate || !brand || !showcase) return null;

    const existing = brand.querySelector(".auth-creative-universe");
    if (existing) return window.HHAuthCreativeUniverse || null;

    const root = document.createElement("section");
    root.className = "auth-creative-universe";
    root.setAttribute("aria-label", "Hệ Mặt Trời sản phẩm HH");
    root.innerHTML = buildMarkup();
    brand.insertBefore(root, showcase);
    showcase.classList.add("auth-universe-replaced");
    showcase.setAttribute("aria-hidden", "true");

    const buttons = [...root.querySelectorAll("[data-universe-id]")];
    const preview = root.querySelector("#authUniversePreview");
    const title = root.querySelector("[data-universe-title]");
    const eyebrow = root.querySelector("[data-universe-eyebrow]");
    const description = root.querySelector("[data-universe-description]");
    const capabilities = root.querySelector("[data-universe-capabilities]");
    const status = root.querySelector("[data-universe-status]");
    const routeLabel = root.querySelector("[data-universe-route-label]");
    const openButton = root.querySelector("[data-universe-open]");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const pauseReasons = new Set();
    const cleanupTasks = [];
    let activeIndex = Math.max(0, modules.findIndex((item) => item.id === readSelection()));
    let rotationTimer = 0;
    let interactionTimer = 0;
    let destroyed = false;

    const listen = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      cleanupTasks.push(() => target.removeEventListener(type, handler, options));
    };

    const clearRotation = () => {
      if (!rotationTimer) return;
      window.clearTimeout(rotationTimer);
      rotationTimer = 0;
    };

    const isPaused = () => pauseReasons.size > 0 || document.visibilityState !== "visible" || Boolean(reducedMotion?.matches);

    const scheduleRotation = () => {
      clearRotation();
      root.classList.toggle("is-paused", isPaused());
      if (destroyed || isPaused()) return;
      rotationTimer = window.setTimeout(() => {
        setActive((activeIndex + 1) % modules.length, { source: "auto" });
        scheduleRotation();
      }, ROTATION_DELAY);
    };

    const setPause = (reason, paused) => {
      if (paused) pauseReasons.add(reason);
      else pauseReasons.delete(reason);
      scheduleRotation();
    };

    const pauseAfterInteraction = () => {
      setPause("interaction", true);
      if (interactionTimer) window.clearTimeout(interactionTimer);
      interactionTimer = window.setTimeout(() => {
        interactionTimer = 0;
        setPause("interaction", false);
      }, INTERACTION_PAUSE);
    };

    function setActive(index, { source = "preview", focus = false, announce = false } = {}) {
      if (destroyed || !buttons.length) return;
      activeIndex = (index + modules.length) % modules.length;
      const item = modules[activeIndex];

      buttons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === activeIndex;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });

      if (preview) {
        preview.dataset.activeUniverse = item.id;
        preview.setAttribute("aria-labelledby", `authUniverseTab-${item.id}`);
        preview.style.setProperty("--preview-color", item.color);
      }
      if (eyebrow) eyebrow.textContent = item.eyebrow;
      if (title) title.textContent = item.label;
      if (description) description.textContent = item.description;
      if (routeLabel) routeLabel.textContent = item.route;
      if (capabilities) {
        capabilities.replaceChildren(...item.capabilities.map((label) => {
          const chip = document.createElement("span");
          chip.textContent = label;
          return chip;
        }));
      }
      if (status && announce) status.textContent = `Đã chọn ${item.label} · Sẵn sàng mở sau đăng nhập`;
      else if (status && source === "auto") status.textContent = "Đang khám phá tự động toàn bộ vũ trụ HH";

      root.classList.remove("is-guest-preview");
      if (announce && !reducedMotion?.matches) {
        void root.offsetWidth;
        root.classList.add("is-guest-preview");
      } else if (announce) root.classList.add("is-guest-preview");

      if (focus) buttons[activeIndex]?.focus({ preventScroll: true });
    }

    const selectUniverse = (index, inputType) => {
      setActive(index, { source: inputType, announce: true });
      const item = modules[activeIndex];
      writeSelection(item);
      pauseAfterInteraction();
      window.dispatchEvent(new CustomEvent("hh:auth-universe-select", {
        detail: {
          id: item.id,
          label: item.label,
          title: item.label,
          route: item.route,
          index: activeIndex,
          mode: "login-destination",
          source: inputType,
          inputType
        }
      }));
    };

    buttons.forEach((button, index) => {
      listen(button, "pointerenter", () => setActive(index, { source: "hover" }));
      listen(button, "focus", () => setActive(index, { source: "focus" }));
      listen(button, "click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectUniverse(index, event.detail === 0 ? "keyboard" : "pointer");
      });
      listen(button, "keydown", (event) => {
        const navigationKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (!navigationKeys.includes(event.key)) return;
        event.preventDefault();
        pauseAfterInteraction();
        let nextIndex = index;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + buttons.length) % buttons.length;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % buttons.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = buttons.length - 1;
        setActive(nextIndex, { source: "keyboard", focus: true });
      });
    });

    listen(openButton, "click", () => selectUniverse(activeIndex, "preview-button"));
    listen(root, "pointerenter", () => setPause("hover", true));
    listen(root, "pointerleave", () => setPause("hover", false));
    listen(root, "pointerdown", pauseAfterInteraction, { passive: true });
    listen(root, "focusin", () => setPause("focus", true));
    listen(root, "focusout", (event) => {
      if (!event.relatedTarget || !root.contains(event.relatedTarget)) setPause("focus", false);
    });

    const handleVisibility = () => setPause("hidden", document.visibilityState !== "visible");
    const handleMotionPreference = () => setPause("reduced-motion", Boolean(reducedMotion?.matches));
    listen(document, "visibilitychange", handleVisibility);
    if (reducedMotion?.addEventListener) listen(reducedMotion, "change", handleMotionPreference);
    else if (reducedMotion?.addListener) {
      reducedMotion.addListener(handleMotionPreference);
      cleanupTasks.push(() => reducedMotion.removeListener(handleMotionPreference));
    }

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      clearRotation();
      if (interactionTimer) window.clearTimeout(interactionTimer);
      interactionTimer = 0;
      cleanupTasks.splice(0).forEach((cleanup) => cleanup());
      observer?.disconnect();
      showcase.classList.remove("auth-universe-replaced");
      showcase.removeAttribute("aria-hidden");
      root.remove();
      instance = null;
    };

    const observer = new MutationObserver(() => {
      if (!gate.isConnected || !root.isConnected) destroy();
      else setPause("auth-inactive", !document.body.classList.contains("auth-locked"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true });

    listen(window, "pagehide", (event) => {
      if (!event.persisted) destroy();
    });

    setActive(activeIndex, { source: "restore" });
    handleVisibility();
    handleMotionPreference();
    setPause("auth-inactive", !document.body.classList.contains("auth-locked"));

    instance = Object.freeze({
      available: true,
      root,
      modules: modules.map(({ id, label, route }) => ({ id, label, route })),
      select: (id) => {
        const index = modules.findIndex((item) => item.id === id);
        if (index >= 0) selectUniverse(index, "api");
      },
      selected: () => modules[activeIndex].id,
      destroy
    });
    window.HHAuthCreativeUniverse = instance;
    return instance;
  };

  const boot = () => {
    if (!document.querySelector("#authGate")) {
      window.HHAuthCreativeUniverse = Object.freeze({ available: false });
      return;
    }
    createUniverse();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
