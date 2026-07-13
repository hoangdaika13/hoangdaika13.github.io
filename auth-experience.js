(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate) return;

  const panels = [...gate.querySelectorAll(".auth-spectrum i")];
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
    });
  }, { passive: true });

  gate.addEventListener("pointerleave", () => setParallax(0, 0));
  gate.addEventListener("focusin", event => {
    const field = event.target.closest(".auth-field");
    gate.dataset.authFocus = field?.querySelector("input")?.name || "";
  });
  gate.addEventListener("focusout", event => {
    if (!event.relatedTarget?.closest?.("#authGate")) delete gate.dataset.authFocus;
  });
})();
