import {
  HOME,
  SYSTEMS,
  getSystem,
  getBody,
  basis,
  newMap,
  projection,
  galaxyFrame,
  entries,
  visit,
  overview,
  orbit,
  pan,
  zoomAt,
  setSpread,
  advance,
  settle
} from "./auth-spiral-map.mjs?v=2";
import { planetCards } from "./auth-spiral-facts.mjs?v=1";

const gate = document.querySelector("#authGate.hh-spiral-gate");
if (gate) install(gate);

function install(gate) {
  const find = (selector) => gate.querySelector(selector);
  const space = (key) => find("[data-space-" + key + "]");
  const backdrop = find(".spiral-backdrop");
  const view = find(".spiral-view"),
    stage = find(".spiral-sky");
  const paths = find(".orrery-paths"),
    targets = find(".orrery-targets");
  const controls = find("#space-controls"),
    motion = find("[data-spiral-motion]");
  const hint = find("#spiral-drag-hint"),
    dialog = find(".spiral-explorer"),
    facts = find(".spiral-facts");
  const title = find("#spiral-title"),
    reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const motionKey = "hh.auth.motion.v1";
  const headings = {
    login: "Chào bạn trở lại.",
    register: "Tạo tài khoản.",
    recovery: "Khôi phục mật khẩu.",
    qr: "Đăng nhập bằng điện thoại.",
    "verify-email": "Xác minh email."
  };
  const systemList = space("system"),
    bodyList = space("planet"),
    scope = space("scope"),
    spread = space("spread");
  const state = newMap(),
    nodes = new Map(),
    labelSizes = new Map(),
    suns = new Map(),
    strokes = new Map(),
    moons = new Map(),
    pointers = new Map();
  const baseAxes = basis(HOME.yaw, HOME.tilt);
  const surface = { width: 1, height: 1, map: { visible: false } };
  let canvas = backdrop.querySelector("canvas"),
    sky,
    frame = 0,
    previous = 0,
    busy = false;
  let inView = false,
    onPage = true,
    interacted = false,
    unavailable = false,
    panning = false;
  let paused = reduce.matches || savedMotion() === "off",
    hits = [],
    currentFocus = null;
  let width = 1,
    height = 1,
    pendingHit = null;
  if (matchMedia("(pointer: coarse)").matches) hint.textContent = "Vuốt để xoay · Chụm hai ngón để thu phóng";
  function savedMotion() {
    try {
      return localStorage.getItem(motionKey);
    } catch {
      return null;
    }
  }
  function gateVisible() {
    return (
      onPage &&
      !gate.hidden &&
      !gate.inert &&
      (document.body.classList.contains("auth-locked") || document.body.classList.contains("auth-panel-open"))
    );
  }
  function canDraw() {
    return gateVisible() && inView && !document.hidden && !dialog.open;
  }
  function moving() {
    return (
      sky &&
      !paused &&
      surface.map.visible &&
      !pointers.size &&
      !facts.open &&
      !targets.contains(document.activeElement) &&
      !state.pointed
    );
  }
  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }
  function requestDraw() {
    if (!frame && canDraw()) frame = requestAnimationFrame(draw);
  }
  function createTarget(item, type) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hit = item.id;
    button.dataset[type] = "";
    if (item.ring) button.dataset.ring = "";
    button.style.setProperty("--body-color", item.color || item.tint);
    button.setAttribute("aria-label", item.name);
    if (type === "body") button.setAttribute("aria-haspopup", "dialog");
    const disc = document.createElement("i");
    disc.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = item.name;
    button.append(disc, label);
    button.hidden = true;
    targets.append(button);
    nodes.set(item.id, button);
  }
  for (const sys of SYSTEMS) {
    const sun = document.createElement("i");
    sun.className = "orrery-sun";
    sun.setAttribute("aria-hidden", "true");
    sun.style.setProperty("--star-color", sys.tint);
    sun.hidden = true;
    targets.prepend(sun);
    suns.set(sys.id, sun);
    createTarget(sys, "system");
    systemList.add(new Option(sys.name, sys.id));
    const group = document.createElement("optgroup");
    group.label = sys.name;
    for (const body of sys.bodies) {
      createTarget(body, "body");
      group.append(new Option(body.name, body.id));
      const path = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      path.setAttribute("r", "1");
      path.style.display = "none";
      paths.append(path);
      strokes.set(body.id, path);
      if (body.moon) {
        const dot = document.createElement("i");
        dot.className = "orrery-moon";
        dot.setAttribute("aria-hidden", "true");
        dot.hidden = true;
        targets.append(dot);
        moons.set(body.id, dot);
      }
    }
    bodyList.append(group);
  }

  function keepTarget(id, pt, shown, alpha = 1, radius = 5) {
    const b = nodes.get(id);
    const inside = pt.x >= 8 && pt.y >= 8 && pt.x <= width - 8 && pt.y <= height - 8;
    const hidden = !shown || !inside;
    if (b.hidden !== hidden) b.hidden = hidden;
    if (hidden) return;
    b.style.transform = "translate(" + (pt.x - 22).toFixed(2) + "px," + (pt.y - 22).toFixed(2) + "px)";
    b.style.opacity = alpha.toFixed(2);
    b.style.setProperty("--disc", (radius * 2).toFixed(1) + "px");
    b.classList.toggle("is-active", id === state.pointed || id === state.selected || id === currentFocus);
    hits.push({ id, x: pt.x, y: pt.y });
  }
  function placeLabel(planet, planets, occupied) {
    const button = nodes.get(planet.body.id);
    if (button.hidden) return;
    let size = labelSizes.get(button);
    if (!size) {
      const label = button.lastElementChild;
      size = { width: label.offsetWidth, height: label.offsetHeight };
      labelSizes.set(button, size);
    }
    const { x, y } = planet.pt;
    const gap = Math.max(12, planet.radius + 3);
    const left = Math.max(2, Math.min(x - size.width / 2, width - size.width - 2));
    const right = left + size.width;
    const rows = [y - gap - size.height, y + gap];
    const slot = rows.findIndex((top) => {
      const bottom = top + size.height;
      if (top < 1 || bottom > height - 1) return false;
      const overlapsLabel = occupied.some(
        (box) => left < box.right + 2 && right > box.left - 2 && top < box.bottom + 2 && bottom > box.top - 2
      );
      const coversBody = planets.some(
        (other) =>
          other !== planet &&
          other.pt.x >= left - 3 &&
          other.pt.x <= right + 3 &&
          other.pt.y >= top - 3 &&
          other.pt.y <= bottom + 3
      );
      return !overlapsLabel && !coversBody;
    });
    button.style.setProperty("--label-x", (left + size.width / 2 - x).toFixed(1) + "px");
    button.style.setProperty("--label-gap", gap.toFixed(1) + "px");
    button.classList.toggle("label-below", slot === 1);
    button.classList.toggle("crowded", slot < 0);
    if (slot >= 0) occupied.push({ left, right, top: rows[slot], bottom: rows[slot] + size.height });
  }
  function poster(fr, skyFrame) {
    const a = fr.axes,
      b = baseAxes,
      determinant = b[1] * b[3] - b[0] * b[4],
      z = skyFrame.zoom;
    const matrix = [
      ((-a[0] * b[4] + a[1] * b[3]) * z) / determinant,
      ((a[3] * b[4] - a[4] * b[3]) * z) / determinant,
      ((-a[0] * b[1] + a[1] * b[0]) * z) / determinant,
      ((a[3] * b[1] - a[4] * b[0]) * z) / determinant,
      0,
      0
    ];
    backdrop.style.setProperty("--sky-roll", -skyFrame.roll + "rad");
    backdrop.style.setProperty("--poster-width", (11.85 * skyFrame.scale) / skyFrame.zoom + "px");
    backdrop.style.setProperty("--sky-x", skyFrame.x + "px");
    backdrop.style.setProperty("--sky-y", skyFrame.y + "px");
    backdrop.style.setProperty("--map-poster", "matrix(" + matrix.map((v) => v.toFixed(4)).join(",") + ")");
    backdrop.style.setProperty("--map-mist", skyFrame.light.toFixed(2));
  }
  let stillOverview;
  function paint() {
    // Signing in normally leaves the camera at rest. Only the GPU star clock
    // changes there, so the accessible layer can keep its last projection.
    const c = state.camera;
    const framing = galaxyFrame(c, surface.width, surface.height, surface.map.visible);
    const key =
      !state.system && !state.travel && c.detail === 0 && c.zoom <= 1.8
        ? [
            width,
            height,
            surface.width,
            surface.height,
            c.yaw,
            c.tilt,
            c.zoom,
            c.panX,
            c.panY,
            state.globalSpread,
            state.pointed,
            currentFocus
          ].join("/")
        : null;
    if (key && stillOverview?.key === key && stillOverview.sky === sky) {
      if (sky) sky.render(state, stillOverview.fr, stillOverview.groups, surface, framing);
      return;
    }
    const fr = projection(state, width, height),
      groups = entries(state, fr);
    stillOverview = key ? { key, fr, groups, sky } : null;
    hits = [];
    if (sky) sky.render(state, fr, groups, surface, framing);
    else poster(fr, framing);
    for (const { system, anchor, opacity, planets } of groups) {
      keepTarget(system.id, anchor, !state.system || state.camera.detail < 0.48, 1);
      const sun = suns.get(system.id);
      sun.hidden = opacity < 0.03;
      if (!sun.hidden) {
        const size = Math.max(6, Math.min(10, 0.12 * fr.scale)) * 2;
        sun.style.width = sun.style.height = size.toFixed(1) + "px";
        sun.style.transform = "translate(" + (anchor.x - size / 2) + "px," + (anchor.y - size / 2) + "px)";
        sun.style.opacity = opacity.toFixed(2);
      }
      const labels = [];
      for (const p of planets) {
        const id = p.body.id,
          path = strokes.get(id),
          dot = moons.get(id);
        keepTarget(id, p.pt, opacity > 0.3, opacity, p.radius);
        placeLabel(p, planets, labels);
        path.style.display = opacity > 0.02 ? "" : "none";
        if (opacity > 0.02) {
          const a = fr.axes,
            k = p.r * fr.scale,
            c = Math.cos(p.inclination),
            s = Math.sin(p.inclination);
          path.setAttribute(
            "transform",
            "matrix(" +
              [a[0] * k, -a[3] * k, (a[1] * c + a[2] * s) * k, -(a[4] * c + a[5] * s) * k, anchor.x, anchor.y]
                .map((v) => v.toFixed(3))
                .join(" ") +
              ")"
          );
          const active = id === state.pointed || id === state.selected || id === currentFocus;
          path.classList.toggle("is-active", active);
          path.style.opacity = (opacity * (active ? 0.94 : 0.38)).toFixed(2);
        }
        if (dot) {
          dot.hidden = opacity < 0.35;
          if (!dot.hidden)
            dot.style.transform =
              "translate(" + (p.moonScreen.x - 2).toFixed(2) + "px," + (p.moonScreen.y - 2).toFixed(2) + "px)";
        }
      }
    }
  }
  function draw(now) {
    frame = 0;
    if (!canDraw()) return;
    const dt = previous ? Math.min(0.1, (now - previous) / 1000) : 0;
    previous = now;
    advance(state, dt, moving());
    paint();
    if (moving() || state.travel) requestDraw();
    else previous = 0;
  }
  function release(lose = true) {
    stillOverview = null;
    stopFrame();
    if (sky) {
      if (lose) {
        const next = canvas.cloneNode(false);
        canvas.replaceWith(next);
        canvas = next;
      }
      sky.dispose(lose);
      sky = null;
    }
    view.dataset.renderer = "poster";
  }
  function updateMotion() {
    const action = paused ? "Bật chuyển động" : "Tạm dừng chuyển động";
    motion.hidden = false;
    motion.disabled = unavailable;
    motion.setAttribute("aria-label", unavailable ? "Đang dùng bản đồ tĩnh" : action);
    motion.title = motion.getAttribute("aria-label");
    motion.firstElementChild.textContent = paused || unavailable ? "▷" : "Ⅱ";
    motion.lastElementChild.textContent = unavailable ? "Bản đồ tĩnh" : paused ? "Bật chuyển động" : "Tạm dừng";
  }
  async function sync() {
    if (!gateVisible()) {
      if (facts.open) cards.close();
      if (dialog.open) dialog.close();
      pointers.clear();
      release();
      return;
    }
    if (!canDraw()) {
      stopFrame();
      return;
    }
    requestDraw();
    if (sky || busy || unavailable || (paused && !interacted)) return;
    busy = true;
    try {
      const { createSky } = await import("./auth-spiral-space.mjs?v=2");
      if (!canDraw() || (paused && !interacted)) return;
      sky = createSky(canvas);
      sky.resize(surface.width, surface.height);
      view.dataset.renderer = "three";
    } catch {
      unavailable = true;
      release(false);
      updateMotion();
    } finally {
      busy = false;
      requestDraw();
    }
  }
  function interact() {
    interacted = true;
    sync();
  }
  function updateControls() {
    systemList.value = state.system || "";
    scope.options[1].disabled = !state.system;
    if (!state.system) scope.value = "all";
    spread.value = scope.value === "local" ? state.localSpread[state.system] : state.globalSpread;
    const value = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(spread.value)) + "×";
    space("value").textContent = value;
    spread.setAttribute("aria-valuetext", value);
    space("fit").disabled = !state.system;
  }
  function locateMap() {
    const bounds = backdrop.getBoundingClientRect(),
      rect = view.getBoundingClientRect();
    const kx = surface.width / (bounds.width || 1),
      ky = surface.height / (bounds.height || 1);
    // Three's viewport uses bottom-left CSS pixels. Ratios also cover page zoom.
    surface.map = {
      left: (rect.left - bounds.left) * kx,
      bottom: (bounds.bottom - rect.bottom) * ky,
      width: rect.width * kx,
      height: rect.height * ky,
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom &&
        rect.right > bounds.left &&
        rect.left < bounds.right
    };
  }
  function dimensions() {
    if (width !== view.clientWidth) labelSizes.clear();
    width = Math.max(1, view.clientWidth);
    height = Math.max(1, view.clientHeight);
    const w = Math.max(1, backdrop.clientWidth),
      h = Math.max(1, backdrop.clientHeight);
    if (w !== surface.width || h !== surface.height) {
      surface.width = w;
      surface.height = h;
      if (sky) sky.resize(w, h);
    }
    locateMap();
  }
  function expanded(value) {
    controls.hidden = !value;
    space("login").hidden = !value;
    stage.toggleAttribute("data-expanded", value);
    space("open").setAttribute("aria-expanded", String(value));
    space("open").lastElementChild.textContent = value ? "Thu gọn bản đồ" : "Khám phá hệ sao";
    dimensions();
    if (value) cards.warm();
  }
  function focusSystem(id) {
    expanded(true);
    visit(state, id, width, height, paused || unavailable);
    currentFocus = null;
    updateControls();
    interact();
    requestDraw();
  }
  function showOverview(reset = false) {
    overview(state, width, height, paused || unavailable, reset);
    currentFocus = null;
    updateControls();
    requestDraw();
  }
  const cards = planetCards(facts, (id) => {
    if (!gateVisible()) return;
    settle(state);
    paint();
    const target = nodes.get(id);
    if (target.hidden && state.system) {
      visit(state, state.system, width, height, true);
      state.selected = id;
      paint();
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    previous = 0;
    sync();
  });
  function choose(id) {
    const sys = getSystem(id);
    if (sys) {
      focusSystem(id);
      return;
    }
    const body = getBody(id);
    if (!body) return;
    const owner = SYSTEMS.find((item) => item.bodies.includes(body));
    if (state.system !== owner.id || nodes.get(id).hidden) focusSystem(owner.id);
    state.selected = id;
    cards.open(body, owner);
    requestDraw();
  }
  space("open").addEventListener("click", () => {
    if (controls.hidden) focusSystem("sol");
    else {
      expanded(false);
      showOverview();
    }
  });
  space("login").addEventListener("click", () => {
    expanded(false);
    showOverview();
    if (gate.dataset.authView !== "login") find('[data-auth-tab="login"]').click();
    const form = find("#gateLoginForm");
    const email = form.elements.namedItem("email");
    const password = form.elements.namedItem("password");
    const submit = form.querySelector('[type="submit"]');
    const field = [email, password].find((input) => !input.disabled && !input.validity.valid);
    const target = field || (submit.disabled ? find('[data-auth-tab="login"]') : submit);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  });
  systemList.addEventListener("change", () => (systemList.value ? focusSystem(systemList.value) : showOverview()));
  bodyList.addEventListener("change", () => {
    const id = bodyList.value;
    bodyList.value = "";
    choose(id);
  });
  scope.addEventListener("change", updateControls);
  spread.addEventListener("input", () => {
    setSpread(state, scope.value, Number(spread.value));
    updateControls();
    requestDraw();
  });
  space("fit").addEventListener("click", () => focusSystem(state.system));
  space("overview").addEventListener("click", () => showOverview());
  space("reset").addEventListener("click", () => showOverview(true));
  space("pan").addEventListener("click", () => {
    panning = !panning;
    space("pan").setAttribute("aria-pressed", String(panning));
  });
  for (const button of gate.querySelectorAll("[data-space-zoom]"))
    button.addEventListener("click", () => {
      zoomAt(state, button.dataset.spaceZoom === "in" ? 1.3 : 1 / 1.3, width / 2, height / 2, width, height);
      interact();
    });
  motion.addEventListener("click", () => {
    paused = !paused;
    try {
      localStorage.setItem(motionKey, paused ? "off" : "high");
    } catch {
      /* Storage is optional. */
    }
    previous = 0;
    updateMotion();
    interact();
  });
  reduce.addEventListener("change", () => {
    paused = reduce.matches || savedMotion() === "off";
    if (reduce.matches) settle(state);
    previous = 0;
    updateMotion();
    sync();
  });

  function localPoint(event) {
    const rect = view.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * width) / rect.width,
      y: ((event.clientY - rect.top) * height) / rect.height
    };
  }
  function nearest(pt) {
    let id = null,
      distance = 23;
    for (const hit of hits) {
      const d = Math.hypot(hit.x - pt.x, hit.y - pt.y);
      if (d < distance) {
        id = hit.id;
        distance = d;
      }
    }
    return id;
  }
  function pair() {
    const [a, b] = pointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function startDrag(event) {
    const outsideMap = event.currentTarget === backdrop;
    if (outsideMap && (event.pointerType !== "mouse" || !surface.map.visible)) return;
    if (outsideMap) event.preventDefault();
    if (![0, 1, 2].includes(event.button) || pointers.size >= 2) return;
    pendingHit = null;
    const p = localPoint(event);
    pointers.set(event.pointerId, {
      ...p,
      startX: p.x,
      startY: p.y,
      moved: false,
      hit: outsideMap ? null : nearest(p),
      pan: panning || event.shiftKey || event.button !== 0
    });
    if (pointers.size > 1) for (const finger of pointers.values()) finger.moved = true;
    view.setPointerCapture(event.pointerId);
    state.pointed = null;
    currentFocus = null;
    interact();
  }
  view.addEventListener("pointerdown", startDrag);
  backdrop.addEventListener("pointerdown", startDrag);
  view.addEventListener("pointermove", (event) => {
    const p = localPoint(event),
      finger = pointers.get(event.pointerId);
    if (!finger) {
      if (event.pointerType !== "touch") {
        const id = nearest(p);
        if (id !== state.pointed) {
          state.pointed = id;
          previous = 0;
          requestDraw();
        }
      }
      return;
    }
    const before = pointers.size === 2 ? pair() : null;
    const dx = p.x - finger.x,
      dy = p.y - finger.y;
    Object.assign(finger, p);
    if (before) {
      const after = pair();
      pan(state, after.x - before.x, after.y - before.y, projection(state, width, height));
      if (before.d > 4 && after.d > 4) zoomAt(state, after.d / before.d, after.x, after.y, width, height);
    } else {
      const started = !finger.moved && Math.hypot(p.x - finger.startX, p.y - finger.startY) > 5;
      if (started) finger.moved = true;
      if (!finger.moved) return;
      const x = started ? p.x - finger.startX : dx,
        y = started ? p.y - finger.startY : dy;
      if (finger.pan || event.shiftKey) pan(state, x, y, projection(state, width, height));
      else orbit(state, x, y);
    }
    requestDraw();
  });
  function end(event) {
    const finger = pointers.get(event.pointerId);
    if (!finger) return;
    pointers.delete(event.pointerId);
    if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);
    const p = localPoint(event),
      id = nearest(p);
    if (
      event.type === "pointerup" &&
      !finger.pan &&
      !finger.moved &&
      Math.hypot(p.x - finger.startX, p.y - finger.startY) <= 5 &&
      id &&
      id === finger.hit
    )
      pendingHit = id;
    previous = 0;
    requestDraw();
  }
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) view.addEventListener(name, end);
  view.addEventListener("contextmenu", (e) => e.preventDefault());
  view.addEventListener("pointerleave", () => {
    state.pointed = null;
    previous = 0;
    requestDraw();
  });
  // Open on the final click so a touchscreen's compatibility mouse events
  // cannot move focus behind a newly opened dialog.
  view.addEventListener("click", (event) => {
    const keyboard = event.detail === 0;
    const id = keyboard ? event.target.closest("[data-hit]")?.dataset.hit : pendingHit;
    pendingHit = null;
    if (id) {
      choose(id);
      if (keyboard && getSystem(id)) view.focus({ preventScroll: true });
    }
  });
  targets.addEventListener("focusin", (event) => {
    currentFocus = event.target.closest("[data-hit]")?.dataset.hit;
    requestDraw();
  });
  targets.addEventListener("focusout", () => {
    currentFocus = null;
    previous = 0;
    requestDraw();
  });
  view.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const p = localPoint(event),
        unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      zoomAt(
        state,
        Math.exp(-Math.max(-230, Math.min(230, event.deltaY * unit)) * 0.0026),
        p.x,
        p.y,
        width,
        height
      );
      interact();
    },
    { passive: false }
  );
  view.addEventListener("keydown", (event) => {
    const keys = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    if (keys[event.key]) {
      event.preventDefault();
      if (event.shiftKey || panning) pan(state, ...keys[event.key], projection(state, width, height));
      else orbit(state, ...keys[event.key]);
    } else if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      zoomAt(state, event.key === "-" ? 0.8 : 1.25, width / 2, height / 2, width, height);
    } else if (event.key === "Home") {
      event.preventDefault();
      showOverview(true);
    } else return;
    interact();
  });
  backdrop.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      unavailable = true;
      release(false);
      updateMotion();
      requestDraw();
    },
    true
  );
  backdrop.addEventListener(
    "webglcontextrestored",
    () => {
      unavailable = false;
      updateMotion();
      sync();
    },
    true
  );
  const explore = gate.querySelector("[data-spiral-explore]");
  const frameHost = dialog.querySelector(".spiral-explorer-content");
  explore.addEventListener("click", () => {
    if (dialog.open) return;
    dialog.showModal();
    stopFrame();
    const atlas = document.createElement("iframe");
    atlas.title = "Bản đồ các lĩnh vực HH";
    // The trusted, inert template owns its assets and all of its event listeners.
    atlas.srcdoc =
      '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="home-neon auth-locked">' +
      document.getElementById("spiral-atlas-template").innerHTML +
      "</body></html>";
    frameHost.replaceChildren(atlas);
  });
  dialog.querySelector("[data-spiral-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    frameHost.replaceChildren();
    sync();
  });

  function updateView() {
    const name = gate.dataset.authView || "login";
    title.textContent = headings[name] || headings.login;
    gate.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.tabIndex = tab.dataset.authTab === name ? 0 : -1;
    });
  }
  gate.querySelector(".auth-mode-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...gate.querySelectorAll("[data-auth-tab]")];
    const next =
      event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs.find((tab) => tab !== event.target);
    if (next) {
      event.preventDefault();
      next.click();
      next.focus();
    }
  });
  new MutationObserver(updateView).observe(gate, { attributes: true, attributeFilter: ["data-auth-view"] });
  new MutationObserver(sync).observe(gate, { attributes: true, attributeFilter: ["hidden", "inert"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  function resizeSky() {
    if (!backdrop.clientWidth || !backdrop.clientHeight) return;
    const oldWidth = width,
      oldHeight = height;
    dimensions();
    if (state.system && surface.map.visible && (oldWidth !== width || oldHeight !== height)) {
      const selected = state.selected;
      visit(state, state.system, width, height, true);
      state.selected = selected;
    }
    requestDraw();
  }
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(resizeSky);
    for (const node of [backdrop, view, find(".spiral-layout"), find(".spiral-card")]) observer.observe(node);
  } else window.addEventListener("resize", resizeSky);
  gate.addEventListener(
    "scroll",
    () => {
      locateMap();
      requestDraw();
    },
    { passive: true }
  );
  if (window.IntersectionObserver)
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(backdrop);
  else inView = true;
  document.fonts?.addEventListener("loadingdone", () => {
    labelSizes.clear();
    requestDraw();
  });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    onPage = false;
    sync();
  });
  window.addEventListener("pageshow", () => {
    onPage = true;
    sync();
  });
  dimensions();
  updateView();
  updateControls();
  updateMotion();
  sync();
}
