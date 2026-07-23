(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate || gate.dataset.authZoomReady === "true") return;
  gate.dataset.authZoomReady = "true";

  const specialPanels = [
    "[data-forgot-panel]",
    "[data-email-verify-panel]",
    "[data-qr-panel]"
  ];
  let frame = 0;
  let lastViewport = "";
  let initialScrollReset = false;
  let layoutSettled = false;

  const visible = (element) => Boolean(element && !element.hidden && element.getClientRects().length);

  const getViewport = () => ({
    width: Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth || 1)),
    height: Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || 1))
  });

  const classify = ({ width, height }) => {
    if (width <= 600 || height <= 560) return "compact";
    if (width <= 1100 || height <= 820) return "condensed";
    return "wide";
  };

  const activePanel = () => {
    for (const selector of specialPanels) {
      const panel = gate.querySelector(selector);
      if (visible(panel)) return panel;
    }
    return gate.querySelector(".auth-gate-forms form:not([hidden])");
  };

  const keepFocusReachable = () => {
    const focused = document.activeElement;
    if (!focused || !gate.contains(focused)) return;
    const rect = focused.getBoundingClientRect();
    const viewport = getViewport();
    if (rect.top < 8 || rect.bottom > viewport.height - 8) {
      focused.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    }
  };

  const resetRestoredScroll = () => {
    if (initialScrollReset) return;
    gate.scrollTop = 0;
    gate.scrollLeft = 0;
    initialScrollReset = true;
  };

  const update = ({ reveal = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = getViewport();
      const signature = `${viewport.width}x${viewport.height}`;
      gate.dataset.authLayout = classify(viewport);
      gate.dataset.authViewportMode = viewport.width <= 1100 ? "single" : "split";
      gate.style.setProperty("--auth-viewport-width", `${viewport.width}px`);
      gate.style.setProperty("--auth-viewport-height", `${viewport.height}px`);

      const panel = activePanel();
      const hasSpecialPanel = specialPanels.some((selector) => visible(gate.querySelector(selector)));
      gate.dataset.authSpecialPanel = String(hasSpecialPanel);

      if (reveal && layoutSettled && panel && signature !== lastViewport) {
        panel.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
      lastViewport = signature;
      keepFocusReachable();
    });
  };

  const observer = new MutationObserver((records) => {
    const panelChanged = records.some((record) => record.type === "attributes" && record.attributeName === "hidden");
    update({ reveal: panelChanged });
  });

  observer.observe(gate, { subtree: true, attributes: true, attributeFilter: ["hidden", "aria-busy", "aria-invalid"] });
  window.addEventListener("resize", () => update({ reveal: true }), { passive: true });
  window.visualViewport?.addEventListener("resize", () => update({ reveal: true }), { passive: true });
  window.visualViewport?.addEventListener("scroll", keepFocusReachable, { passive: true });
  gate.addEventListener("focusin", keepFocusReachable);
  update();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    resetRestoredScroll();
    layoutSettled = true;
  }));
  window.addEventListener("pageshow", resetRestoredScroll, { once: true });

  window.HHAuthZoomResilience = {
    inspect() {
      const viewport = getViewport();
      return {
        ...viewport,
        layout: gate.dataset.authLayout,
        viewportMode: gate.dataset.authViewportMode,
        specialPanel: gate.dataset.authSpecialPanel === "true",
        scrollHeight: gate.scrollHeight,
        overflowX: gate.scrollWidth > gate.clientWidth + 1
      };
    },
    refresh() { update({ reveal: true }); },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      delete gate.dataset.authZoomReady;
    }
  };
})();
