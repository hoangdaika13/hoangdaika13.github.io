export function turnTiming(speed = 1) {
  return {
    duration: Math.round(320 / speed),
    preview: Math.min(220, Math.round(95 / speed)),
    interval: Math.round(700 / speed)
  };
}

export function createSpeedControl(onChange, signal) {
  const label = document.createElement("label");
  label.className = "rb-inline";
  const select = document.createElement("select");
  select.dataset.playerSpeed = "";
  for (const [speed, text] of [[0.25, "0,25×"], [0.5, "0,5×"], [1, "1×"], [1.5, "1,5×"]]) {
    select.append(new Option(text, speed));
  }
  select.value = "1";
  select.addEventListener("change", () => onChange(Number(select.value)), { signal });
  label.append("Tốc độ ", select);
  return label;
}

export function createStepTimeline(moves, seek, signal) {
  const timeline = document.createElement("div");
  timeline.className = "rb-token-list";
  timeline.setAttribute("role", "group");
  timeline.setAttribute("aria-label", "Các nước đi");
  const buttons = ["Đầu", ...moves].map((move, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.playerStep = index;
    button.textContent = move;
    button.setAttribute("aria-label", index ? "Nước " + index + " · " + move : "Trạng thái đầu");
    button.addEventListener("click", () => seek(index), { signal });
    return button;
  });
  timeline.append(...buttons);
  timeline.hidden = !moves.length;
  timeline.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-player-step]");
    if (!button || event.altKey || event.ctrlKey || event.metaKey) return;
    const active = Number(button.dataset.playerStep);
    const target = { Home: 0, End: moves.length, ArrowLeft: active - 1, ArrowRight: active + 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const index = Math.max(0, Math.min(moves.length, target));
    seek(index);
    buttons[index].focus({ preventScroll: true });
  }, { signal });
  let previous;
  function select(index) {
    if (previous === index) return;
    if (previous != null) {
      buttons[previous].removeAttribute("aria-current");
      buttons[previous].tabIndex = -1;
    } else {
      buttons.forEach((button) => { button.tabIndex = -1; });
    }
    const button = buttons[index];
    if (button) {
      button.setAttribute("aria-current", "step");
      button.tabIndex = 0;
      const outer = timeline.getBoundingClientRect();
      const inner = button.getBoundingClientRect();
      const gap = 4;
      if (inner.right > outer.right - gap) timeline.scrollLeft += inner.right - outer.right + gap;
      else if (inner.left < outer.left + gap) timeline.scrollLeft += inner.left - outer.left - gap;
    }
    previous = index;
  }
  return { timeline, select };
}

export function createTurnGuide() {
  const guide = document.createElement("p");
  guide.className = "rb-turn-guide";
  const key = document.createElement("kbd");
  key.className = "rb-turn-guide-key";
  key.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "rb-turn-guide-text";
  guide.append(key, text);
  function show(notation, description) {
    key.hidden = !notation;
    key.textContent = notation;
    text.textContent = description;
  }
  return { guide, show };
}
