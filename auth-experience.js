(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate) return;

  const panels = [...gate.querySelectorAll(".auth-spectrum i")];
  const card = gate.querySelector(".auth-gate-card");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  const setParallax = (x, y) => {
    panels.forEach((panel, index) => {
      const depth = (index + 1) * 0.9;
      panel.style.setProperty("--auth-px", `${(x * depth).toFixed(1)}px`);
      panel.style.setProperty("--auth-py", `${(y * depth).toFixed(1)}px`);
    });
  };

  gate.addEventListener("pointermove", event => {
    if (reducedMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const x = (event.clientX / innerWidth - 0.5) * 7;
      const y = (event.clientY / innerHeight - 0.5) * 7;
      setParallax(x, y);
      gate.style.setProperty("--auth-cursor-x", `${event.clientX}px`);
      gate.style.setProperty("--auth-cursor-y", `${event.clientY}px`);
      if (card && innerWidth > 920) {
        card.style.setProperty("--auth-tilt-x", `${(x * 0.34).toFixed(2)}deg`);
        card.style.setProperty("--auth-tilt-y", `${(-y * 0.28).toFixed(2)}deg`);
      }
    });
  }, { passive: true });

  gate.addEventListener("pointerleave", () => {
    setParallax(0, 0);
    card?.style.setProperty("--auth-tilt-x", "0deg");
    card?.style.setProperty("--auth-tilt-y", "0deg");
  });
  gate.addEventListener("focusin", event => {
    const field = event.target.closest(".auth-field");
    gate.dataset.authFocus = field?.querySelector("input")?.name || "";
  });
  gate.addEventListener("focusout", event => {
    if (!event.relatedTarget?.closest?.("#authGate")) delete gate.dataset.authFocus;
  });
})();
