(function installSpiralGate() {
  "use strict";

  const gate = document.querySelector("#authGate.hh-spiral-gate");
  if (!gate) return;
  const view = gate.querySelector(".spiral-view");
  let canvas = view.querySelector("canvas");
  const motion = gate.querySelector("[data-spiral-motion]");
  const hint = gate.querySelector("#spiral-drag-hint");
  const dialog = gate.querySelector(".spiral-explorer");
  const title = gate.querySelector("#spiral-title");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const dragHint = matchMedia("(pointer: coarse)").matches ? "Vuốt ngang để xoay" : hint.textContent;
  hint.textContent = dragHint;
  const motionKey = "hh.auth.motion.v1";
  const headings = {
    login: "Chào bạn trở lại.", register: "Tạo tài khoản.", recovery: "Khôi phục mật khẩu.",
    qr: "Đăng nhập bằng điện thoại.", "verify-email": "Xác minh email."
  };

  function savedMotion() {
    try { return localStorage.getItem(motionKey); } catch { return null; }
  }

  let paused = reduce.matches || savedMotion() === "off";
  let tilt = .90, angle = -.43;
  let sky = null, frame = 0, previousTime = 0, busy = false;
  let inView = false, onPage = true, interacted = false, unavailable = false;
  let drag = null;

  // Three spiral density waves share a thin disc and a thicker central bulge.
  // The buffers never change; rotation and camera angle are independent of the form.
  function createSky(THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    const world = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 60);
    camera.position.z = 20;
    const tiltGroup = new THREE.Group();
    const disc = new THREE.Group();
    world.add(tiltGroup);
    tiltGroup.add(disc);
    tiltGroup.rotation.z = .19;

    let seed = 14832;
    const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(.00001, random()))) * Math.cos(2 * Math.PI * random());
    const positions = [], colors = [], sizes = [], strengths = [];
    const small = matchMedia("(max-width: 850px)").matches || navigator.connection?.saveData;
    const stars = small ? 9200 : 19500;
    const palette = [[1, .81, .61], [1, .58, .36], [.86, .43, .52], [.59, .36, .87], [.45, .39, .93]];
    function addPoint(x, y, z, size, color, strength) {
      positions.push(x, y, z);
      colors.push(...color);
      sizes.push(size);
      strengths.push(strength);
    }
    function arm(i, mist) {
      const r = .13 + Math.pow(random(), .82) * 5.12;
      const t = r / 5.25;
      const halo = random() < (mist ? .19 : .13);
      const theta = halo ? random() * Math.PI * 2 : i % 3 * 2 * Math.PI / 3 + .87 * r + normal() * (.13 + .10 * t);
      const spread = (.085 + .16 * t) * (mist ? 1.3 : 1);
      const x = r * Math.cos(theta) + normal() * spread;
      const y = r * Math.sin(theta) + normal() * spread;
      const z = normal() * (.07 + .15 * (1 - t));
      const band = Math.min(3.999, Math.max(0, 4.6 * t + normal() * .21));
      const lower = Math.floor(band), fraction = band - lower;
      const tint = palette[lower].map((v, k) => v + (palette[lower + 1][k] - v) * fraction);
      if (!mist && random() < .12) tint.forEach((v, k) => { tint[k] = v + (.96 - v) * .57; });
      addPoint(x, y, z, mist ? 26 + random() * 62 : 1.5 + Math.pow(random(), 2.9) * 4.5,
        tint, (mist ? .024 + random() * .033 : .29 + random() * .63) * Math.min(1, (1 - t) * 5 + .08));
    }
    for (let i = 0; i < stars; i++) arm(i, false);
    for (let i = 0; i < Math.floor(stars / 17); i++) arm(i, true);
    for (let i = 0; i < Math.floor(stars / 5); i++) {
      const r = Math.pow(random(), 1.8) * 1.65, a = random() * Math.PI * 2;
      addPoint(r * Math.cos(a), r * Math.sin(a), normal() * (.065 + .18 * (1 - r / 1.65)),
        2.1 + random() * 3.8, [1, .72 + random() * .15, .53 + random() * .16], .32 + random() * .50);
    }
    // Sparse foreground and background stars give the tilt visible depth.
    for (let i = 0; i < Math.floor(stars / 23); i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 6.3;
      addPoint(r * Math.cos(a), r * Math.sin(a), normal() * .74, 1.7 + random() * 4.4, [.74, .72, .99], .18 + random() * .49);
    }
    addPoint(0, 0, 0, 85, [1, .64, .38], .51);
    addPoint(0, 0, .01, 30, [1, .83, .63], .88);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("starColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("strength", new THREE.Float32BufferAttribute(strengths, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { pixelScale: { value: 1 } },
      transparent: true, premultipliedAlpha: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
      vertexShader: `
        attribute vec3 starColor;
        attribute float size, strength;
        uniform float pixelScale;
        varying vec3 tint;
        varying float power;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1., size * pixelScale * clamp(20. / -mv.z, .78, 1.32));
          tint = starColor;
          power = strength;
        }`,
      fragmentShader: `
        varying vec3 tint;
        varying float power;
        void main() {
          vec2 p = gl_PointCoord * 2. - 1.;
          float r = dot(p,p);
          if(r >= 1.) discard;
          float a = (exp(-6.5 * r) - .00150) * power;
          gl_FragColor = vec4(tint * a, a);
        }`
    });
    disc.add(new THREE.Points(geometry, material));
    function resize() {
      const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
      const extent = Math.max(11.85, (w / h) * 7.25);
      camera.left = -extent / 2; camera.right = extent / 2;
      camera.top = extent * h / (2 * w); camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
      material.uniforms.pixelScale.value = ratio * Math.max(.51, w / (extent * 51)) * (small ? 1.16 : 1);
    }
    function render() {
      tiltGroup.rotation.x = tilt;
      disc.rotation.z = angle;
      renderer.render(world, camera);
    }
    function dispose(loseContext) {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (loseContext) renderer.forceContextLoss();
    }
    return { resize, render, dispose };
  }

  function gateVisible() {
    return onPage && !gate.hidden && !gate.inert &&
      (document.body.classList.contains("auth-locked") || document.body.classList.contains("auth-panel-open"));
  }
  function canDraw() {
    return gateVisible() && inView && !document.hidden && !dialog.open;
  }
  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0; previousTime = 0;
  }
  function draw(time) {
    frame = 0;
    if (!sky || !canDraw()) return;
    if (!paused && !drag && previousTime) angle += Math.min((time - previousTime) / 1000, .08) * .047;
    previousTime = time;
    sky.render();
    if (view.dataset.renderer !== "three") view.dataset.renderer = "three";
    if (!paused && !drag) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame && sky && canDraw()) frame = requestAnimationFrame(draw);
  }
  function releaseRenderer(loseContext = true) {
    stopFrame();
    if (sky) {
      if (loseContext) {
        const replacement = canvas.cloneNode(false);
        canvas.replaceWith(replacement);
        canvas = replacement;
      }
      sky.dispose(loseContext);
      sky = null;
    }
    if (unavailable) view.dataset.renderer = "poster";
    else delete view.dataset.renderer;
  }
  function updateMotionControl() {
    const label = paused ? "Bật chuyển động" : "Tạm dừng chuyển động";
    motion.hidden = unavailable;
    motion.setAttribute("aria-label", label);
    motion.title = label;
    motion.firstElementChild.textContent = paused ? "▶" : "Ⅱ";
  }
  function posterOnly() {
    unavailable = true;
    releaseRenderer(false);
    view.dataset.renderer = "poster";
    view.removeAttribute("tabindex");
    view.setAttribute("aria-label", "Thiên hà xoắn ốc ba nhánh");
    hint.textContent = "Ảnh tĩnh của thiên hà";
    updateMotionControl();
  }
  async function sync() {
    if (!gateVisible()) {
      if (dialog.open) dialog.close();
      releaseRenderer();
      return;
    }
    if (!canDraw()) { stopFrame(); return; }
    if (unavailable) return;
    if (sky) { requestDraw(); return; }
    if (busy || (paused && !interacted)) return;
    busy = true;
    try {
      const THREE = await import("./vendor/three.module.min.js");
      if (!canDraw() || (paused && !interacted)) return;
      sky = createSky(THREE);
      sky.resize();
      requestDraw();
    } catch { posterOnly(); }
    finally { busy = false; }
  }
  function rotate(dx, dy) {
    angle += dx * .009;
    tilt = Math.max(.18, Math.min(1.40, tilt + dy * .007));
    interacted = true;
    sync();
  }
  view.addEventListener("pointerdown", event => {
    if (unavailable || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    view.setPointerCapture(event.pointerId);
    previousTime = 0;
  });
  view.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    rotate(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX; drag.y = event.clientY;
  });
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null; previousTime = 0; requestDraw();
  }
  view.addEventListener("pointerup", endDrag);
  view.addEventListener("pointercancel", endDrag);
  view.addEventListener("lostpointercapture", endDrag);
  view.addEventListener("keydown", event => {
    const keys = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    if (!keys[event.key] || unavailable) return;
    event.preventDefault(); rotate(...keys[event.key]);
  });
  motion.addEventListener("click", () => {
    paused = !paused;
    try { localStorage.setItem(motionKey, paused ? "off" : "high"); } catch { /* Optional preference. */ }
    previousTime = 0; updateMotionControl(); sync();
  });
  reduce.addEventListener("change", () => {
    paused = reduce.matches || savedMotion() === "off";
    previousTime = 0; updateMotionControl(); sync();
  });
  view.addEventListener("webglcontextlost", event => { event.preventDefault(); posterOnly(); }, true);
  view.addEventListener("webglcontextrestored", () => {
    unavailable = false; view.tabIndex = 0;
    view.setAttribute("aria-label", "Xoay góc nhìn thiên hà");
    hint.textContent = dragHint;
    updateMotionControl(); sync();
  }, true);

  const explore = gate.querySelector("[data-spiral-explore]");
  const frameHost = dialog.querySelector(".spiral-explorer-content");
  explore.addEventListener("click", () => {
    if (dialog.open) return;
    dialog.showModal();
    stopFrame();
    const atlas = document.createElement("iframe");
    atlas.title = "Bản đồ các lĩnh vực HH";
    // The trusted, inert template owns its assets and all of its event listeners.
    atlas.srcdoc = '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="home-neon auth-locked">' + document.getElementById("spiral-atlas-template").innerHTML + '</body></html>';
    frameHost.replaceChildren(atlas);
  });
  dialog.querySelector("[data-spiral-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { frameHost.replaceChildren(); sync(); });

  function updateView() {
    const name = gate.dataset.authView || "login";
    title.textContent = headings[name] || headings.login;
    gate.querySelectorAll("[data-auth-tab]").forEach(tab => { tab.tabIndex = tab.dataset.authTab === name ? 0 : -1; });
  }
  gate.querySelector(".auth-mode-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...gate.querySelectorAll("[data-auth-tab]")];
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs.find(tab => tab !== event.target);
    if (next) { event.preventDefault(); next.click(); next.focus(); }
  });
  new MutationObserver(updateView).observe(gate, { attributes: true, attributeFilter: ["data-auth-view"] });
  new MutationObserver(sync).observe(gate, { attributes: true, attributeFilter: ["hidden", "inert"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  function resizeSky() {
    if (sky && view.clientWidth && view.clientHeight) {
      sky.resize();
      requestDraw();
    }
  }
  if (window.ResizeObserver) new ResizeObserver(resizeSky).observe(view);
  else window.addEventListener("resize", resizeSky);
  if (window.IntersectionObserver) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(view);
  } else inView = true;
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { onPage = false; sync(); });
  window.addEventListener("pageshow", () => { onPage = true; sync(); });
  updateView();
  updateMotionControl();
  sync();
})();
