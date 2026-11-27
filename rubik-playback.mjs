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

export function createAutoPlayback(moveCount, { position, range, speed, advance, rewind, onPlaying }) {
  let timeout;

  function stop() {
    clearTimeout(timeout);
    timeout = undefined;
    onPlaying(false);
  }

  function scheduleRewind(at) {
    rewind(at);
    timeout = setTimeout(tick, turnTiming(speed()).interval / 2);
  }

  function tick() {
    const segment = range();
    const index = position();
    // A timeline index counts completed moves. The selected first move has yet to run.
    if (segment && (index < segment.first - 1 || index >= segment.last)) {
      scheduleRewind(segment.first - 1);
    } else if (index >= moveCount) {
      stop();
    } else {
      advance();
      timeout = setTimeout(tick, turnTiming(speed()).interval);
    }
  }

  function toggle() {
    if (timeout != null) {
      stop();
      return;
    }
    if (!moveCount) return;
    if (!range() && position() >= moveCount) rewind(0);
    onPlaying(true);
    tick();
  }

  function setLoopStart(index) {
    if (timeout == null) {
      rewind(index);
      return;
    }
    clearTimeout(timeout);
    scheduleRewind(index);
  }

  return { toggle, stop, setLoopStart };
}

export function createLoopControl(moves, setLoopStart, signal) {
  if (!moves.length) return null;
  const panel = document.createElement("details");
  panel.className = "rb-loop";
  const summary = document.createElement("summary");
  summary.textContent = "Lặp đoạn";
  const options = document.createElement("div");
  options.className = "rb-controls rb-loop-options";

  function selectMove(text, marker, initial) {
    const label = document.createElement("label");
    label.className = "rb-inline";
    const select = document.createElement("select");
    select.setAttribute(marker, "");
    moves.forEach((move, index) => select.append(new Option((index + 1) + " · " + move, index + 1)));
    select.value = String(initial);
    label.append(text, select);
    options.append(label);
    return select;
  }

  const first = selectMove("Từ nước ", "data-rb-loop-start", 1);
  const last = selectMove("Đến nước ", "data-rb-loop-end", moves.length);
  const label = document.createElement("label");
  label.className = "rb-inline";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.dataset.rbLoopToggle = "";
  label.append(toggle, "Bật lặp đoạn");
  options.append(label);
  panel.append(summary, options);

  function updateSummary() {
    summary.textContent = toggle.checked ? "Lặp đoạn · " + first.value + "–" + last.value : "Lặp đoạn";
  }

  function rangeChanged(event) {
    if (Number(first.value) > Number(last.value)) {
      const other = event.currentTarget === first ? last : first;
      other.value = event.currentTarget.value;
    }
    updateSummary();
    if (toggle.checked) setLoopStart(Number(first.value) - 1);
  }
  first.addEventListener("change", rangeChanged, { signal });
  last.addEventListener("change", rangeChanged, { signal });
  toggle.addEventListener("change", () => {
    panel.toggleAttribute("data-rb-loop-active", toggle.checked);
    updateSummary();
    if (toggle.checked) setLoopStart(Number(first.value) - 1);
  }, { signal });

  return {
    panel,
    get range() {
      return toggle.checked ? { first: Number(first.value), last: Number(last.value) } : null;
    }
  };
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
