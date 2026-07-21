(() => {
  "use strict";

  const STORAGE_KEY = "hh.auth.selected-universe";
  const ROTATION_DELAY = 8000;
  const INTERACTION_PAUSE = 16000;
  const modules = [
    {
      id: "ai",
      short: "AI",
      label: "AI Center",
      eyebrow: "Trí tuệ sáng tạo",
      description: "Khám phá chat đa mô hình, prompt thông minh và workflow AI trong chế độ xem trước an toàn.",
      capabilities: ["Multi AI", "Prompt Lab", "Workflow"]
    },
    {
      id: "music",
      short: "MU",
      label: "Music Studio",
      eyebrow: "Âm thanh và sản xuất",
      description: "Xem trước không gian sáng tác, phối khí, mix, master và chuẩn bị nội dung xuất bản.",
      capabilities: ["Composer", "Timeline", "Master"]
    },
    {
      id: "design",
      short: "DS",
      label: "Design Studio",
      eyebrow: "Thiết kế đa phương tiện",
      description: "Khám phá photo, video, motion và bộ công cụ thiết kế dùng chung trong HH Creative Lab.",
      capabilities: ["Photo", "Video", "Motion"]
    },
    {
      id: "learning",
      short: "LE",
      label: "Learning",
      eyebrow: "Học tập cá nhân hóa",
      description: "Xem lộ trình, bài học ngắn, ôn tập thông minh và phòng luyện kỹ năng theo mục tiêu.",
      capabilities: ["Learning Path", "Smart Review", "Coach"]
    },
    {
      id: "community",
      short: "CO",
      label: "Community",
      eyebrow: "Kết nối thời gian thực",
      description: "Xem trước bảng tin, Messenger HH, nhóm sáng tạo và không gian cộng tác của cộng đồng.",
      capabilities: ["Feed", "Messenger", "Groups"]
    }
  ];

  let instance = null;

  const readSelection = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return modules.some((item) => item.id === saved) ? saved : modules[0].id;
    } catch {
      return modules[0].id;
    }
  };

  const writeSelection = (id) => {
    try { sessionStorage.setItem(STORAGE_KEY, id); }
    catch { /* Session storage can be unavailable in restricted browsing modes. */ }
  };

  const buildMarkup = () => {
    const planets = modules.map((item, index) => `
      <span class="auth-universe-carrier">
        <button
          class="auth-universe-planet"
          type="button"
          role="tab"
          id="authUniverseTab-${item.id}"
          aria-controls="authUniversePreview"
          aria-label="Xem trước ${item.label} ở chế độ khách"
          aria-selected="${index === 0 ? "true" : "false"}"
          tabindex="${index === 0 ? "0" : "-1"}"
          data-universe-id="${item.id}"
        >
          <span class="auth-universe-planet-face" aria-hidden="true">${item.short}</span>
          <small aria-hidden="true">${item.label}</small>
        </button>
      </span>`).join("");

    return `
      <header class="auth-universe-heading">
        <span>Creative Universe</span>
        <small>5 không gian · Xem trước miễn phí</small>
      </header>
      <div class="auth-universe-layout">
        <div class="auth-universe-stage" role="tablist" aria-label="Chọn không gian HH để xem trước">
          <span class="auth-universe-ring" aria-hidden="true"></span>
          <span class="auth-universe-core" aria-hidden="true">HH</span>
          ${planets}
        </div>
        <article
          class="auth-universe-preview"
          id="authUniversePreview"
          role="tabpanel"
          aria-labelledby="authUniverseTab-ai"
          data-active-universe="ai"
        >
          <small data-universe-eyebrow></small>
          <h2 data-universe-title></h2>
          <p data-universe-description></p>
          <div class="auth-universe-capabilities" data-universe-capabilities aria-label="Chức năng tiêu biểu"></div>
          <div class="auth-universe-guest-status">
            <span data-universe-status>Di chuột hoặc dùng phím mũi tên để khám phá</span>
            <b>Không rời trang đăng nhập</b>
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
    root.setAttribute("aria-label", "Vũ trụ sản phẩm HH");
    root.innerHTML = buildMarkup();
    brand.insertBefore(root, showcase);

    const buttons = [...root.querySelectorAll("[data-universe-id]")];
    const preview = root.querySelector("#authUniversePreview");
    const title = root.querySelector("[data-universe-title]");
    const eyebrow = root.querySelector("[data-universe-eyebrow]");
    const description = root.querySelector("[data-universe-description]");
    const capabilities = root.querySelector("[data-universe-capabilities]");
    const status = root.querySelector("[data-universe-status]");
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
      }
      if (eyebrow) eyebrow.textContent = item.eyebrow;
      if (title) title.textContent = item.label;
      if (description) description.textContent = item.description;
      if (capabilities) {
        capabilities.replaceChildren(...item.capabilities.map((label) => {
          const chip = document.createElement("span");
          chip.textContent = label;
          return chip;
        }));
      }
      if (status && announce) status.textContent = `Đã mở bản xem trước ${item.label}`;
      else if (status && source === "auto") status.textContent = "Đang tự động khám phá các không gian HH";

      root.classList.remove("is-guest-preview");
      if (announce && !reducedMotion?.matches) {
        void root.offsetWidth;
        root.classList.add("is-guest-preview");
      } else if (announce) root.classList.add("is-guest-preview");

      if (focus) buttons[activeIndex]?.focus({ preventScroll: true });
    }

    const selectGuestPreview = (index, inputType) => {
      setActive(index, { source: inputType, announce: true });
      const item = modules[activeIndex];
      writeSelection(item.id);
      pauseAfterInteraction();
      root.dispatchEvent(new CustomEvent("hh:auth-universe-select", {
        bubbles: true,
        detail: {
          id: item.id,
          label: item.label,
          index: activeIndex,
          mode: "guest-preview",
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
        selectGuestPreview(index, event.detail === 0 ? "keyboard" : "pointer");
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
      select: (id) => {
        const index = modules.findIndex((item) => item.id === id);
        if (index >= 0) selectGuestPreview(index, "api");
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
