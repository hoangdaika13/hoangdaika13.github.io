(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHHomeCosmosMotion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (scope) {
  "use strict";

  // Presentation only: each mounted home owns its own GPU resources, motion
  // clock and listeners. This module never reads storage, auth or user data.
  const instances = new WeakMap();
  const VERTEX = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    attribute vec2 aMeta;
    uniform float uTime;
    uniform float uAspect;
    uniform float uPixelRatio;
    uniform vec2 uPointer;
    uniform vec2 uCenter;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec3 p = aPosition;
      float kind = aMeta.y;
      float turn = uTime * (kind > 0.5 ? 0.065 : 0.009);
      float angle = turn * (kind > 1.5 ? -0.6 : 1.0);
      float c = cos(angle), s = sin(angle);
      p.xz = mat2(c, -s, s, c) * p.xz;
      float tilt = 0.38 + sin(uTime * 0.08) * 0.055;
      p.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.yz;
      p.xy += uPointer * (0.08 + abs(p.z) * 0.027);
      float depth = max(1.4, 6.5 - p.z);
      vec2 projected = p.xy * 2.0 / depth;
      projected.x /= uAspect;
      gl_Position = vec4(projected + uCenter, 0.0, 1.0);
      gl_PointSize = clamp(aMeta.x * uPixelRatio * 3.0 / depth, 1.0, 34.0);
      vColor = aColor;
      vAlpha = kind > 0.5 ? 0.42 : 0.5 + 0.22 * sin(uTime * 0.6 + aPosition.x * 8.0);
    }`;
  const FRAGMENT = `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float glow = pow(1.0 - d, 2.8);
      gl_FragColor = vec4(vColor, glow * vAlpha);
    }`;

  function quality(options = {}) {
    const staticMode = options.reduced || ["static", "quiet", "off"].includes(options.mode);
    const weak = options.saveData || (options.memory > 0 && options.memory <= 4) || (options.cores > 0 && options.cores <= 4);
    return Object.freeze({ static: !!staticMode, count: weak ? 500 : options.mode === "rich" ? 2600 : 1700, fps: weak ? 24 : options.mode === "rich" ? 50 : 30, dpr: weak ? 1 : 1.5 });
  }

  function makeParticles(count, variant = "galaxy") {
    const data = new Float32Array(count * 8);
    let seed = variant === "galaxy" ? 7717 : 9929;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const colors = variant === "galaxy" ? [[.35, .85, 1], [.72, .35, 1], [1, .29, .59], [1, .7, .3]] : [[.25, 1, .89], [.38, .62, 1], [.87, .38, 1], [1, .49, .7]];
    for (let i = 0; i < count; i++) {
      const disk = i % 3 !== 0, angle = random() * Math.PI * 2;
      const radius = .8 + Math.pow(random(), .7) * 4.8;
      const arm = angle + radius * .7;
      const rgb = colors[i % colors.length];
      const offset = i * 8;
      data.set(disk ? [Math.cos(arm) * radius, (random() - .5) * .22, Math.sin(arm) * radius] : [(random() - .5) * 15, (random() - .5) * 10, (random() - .5) * 7], offset);
      data.set(rgb, offset + 3);
      data[offset + 6] = disk ? 3 + random() * 12 : 2 + random() * 5;
      data[offset + 7] = disk ? (i % 5 === 0 ? 2 : 1) : 0;
    }
    return data;
  }

  function mount(home, options = {}) {
    if (!home?.ownerDocument || !options.stage) return null;
    instances.get(home)?.destroy();
    const doc = home.ownerDocument, stage = options.stage;
    const variant = options.variant === "platform" ? "platform" : "galaxy";
    const reducedQuery = scope.matchMedia?.("(prefers-reduced-motion: reduce)");
    const contrastQuery = scope.matchMedia?.("(forced-colors: active)");
    const coarse = scope.matchMedia?.("(pointer: coarse)");
    let disposed = false, userPaused = false, inView = true, lost = false;
    let frame = 0, lastTick = 0, lastDraw = 0, elapsed = 0, gl = null, program = null, buffer = null;
    let uniforms = null, config = null, pixelRatio = 1, rect = null, center = [0, 0], pointer = [0, 0], targetPointer = [0, 0];
    const cleanups = [], shaders = [];
    const effects = doc.createElement("div");
    effects.className = "hch-scene";
    effects.setAttribute("aria-hidden", "true");
    effects.innerHTML = '<div class="hch-nebula hch-nebula-a"></div><div class="hch-nebula hch-nebula-b"></div><div class="hch-nebula hch-nebula-c"></div><div class="hch-stars hch-stars-near"></div><div class="hch-stars hch-stars-far"></div><div class="hch-ribbons"><i></i><i></i><i></i></div><div class="hch-comet hch-comet-a"></div><div class="hch-comet hch-comet-b"></div>';
    const canvas = doc.createElement("canvas");
    canvas.className = "hch-canvas";
    canvas.setAttribute("aria-hidden", "true");
    effects.appendChild(canvas);
    const control = doc.createElement("button");
    control.className = "hch-motion-control";
    control.type = "button";
    control.innerHTML = '<i aria-hidden="true"></i><span>Chuyển động 3D</span><b aria-hidden="true">Ⅱ</b>';
    control.setAttribute("aria-pressed", "false");
    control.setAttribute("aria-label", "Tạm dừng chuyển động trang chủ");
    home.dataset.hhCosmosHome = variant;
    stage.appendChild(effects);
    (options.controls || stage).appendChild(control);
    const on = (target, type, callback, config) => {
      target?.addEventListener?.(type, callback, config);
      cleanups.push(() => target?.removeEventListener?.(type, callback, config));
    };
    const active = () => !disposed && !doc.hidden && inView && !userPaused && !config?.static;
    const stop = () => { if (frame) scope.cancelAnimationFrame?.(frame); frame = 0; lastTick = 0; };

    function releaseGPU() {
      if (!gl) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.splice(0).forEach((shader) => gl.deleteShader(shader));
      buffer = null; program = null; uniforms = null;
    }
    function initGPU() {
      releaseGPU();
      try {
        gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power", preserveDrawingBuffer: false });
        if (!gl) throw Error("WEBGL_UNAVAILABLE");
        program = gl.createProgram();
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
          const shader = gl.createShader(type);
          shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error("SHADER_UNAVAILABLE");
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error("PROGRAM_UNAVAILABLE");
        gl.useProgram(program);
        buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, makeParticles(config.count, variant), gl.STATIC_DRAW);
        [["aPosition", 3, 0], ["aColor", 3, 12], ["aMeta", 2, 24]].forEach(([name, size, offset]) => {
          const location = gl.getAttribLocation(program, name);
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
        });
        uniforms = Object.fromEntries(["uTime", "uAspect", "uPixelRatio", "uPointer", "uCenter"].map((name) => [name, gl.getUniformLocation(program, name)]));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        canvas.hidden = false; home.dataset.hchRenderer = "webgl";
      } catch {
        releaseGPU(); gl = null; canvas.hidden = true; home.dataset.hchRenderer = "css";
      }
    }

    function measure() {
      if (disposed) return;
      rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      pixelRatio = Math.min(scope.devicePixelRatio || 1, config.dpr, Math.sqrt(1_800_000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * pixelRatio)); canvas.height = Math.max(1, Math.round(height * pixelRatio));
      const anchor = stage.querySelector(options.center || ".php-core, .gha-core");
      const box = anchor?.getBoundingClientRect();
      const cx = box ? (box.left + box.width / 2 - rect.left) / width : .5;
      const cy = box ? (box.top + box.height / 2 - rect.top) / height : .45;
      center = [cx * 2 - 1, 1 - cy * 2];
      effects.style.setProperty("--hch-center-x", `${cx * 100}%`);
      effects.style.setProperty("--hch-center-y", `${cy * 100}%`);
      paint();
    }
    function paint() {
      if (!gl || !program || lost || !rect || disposed) return;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
      gl.uniform1f(uniforms.uTime, elapsed); gl.uniform1f(uniforms.uAspect, rect.width / Math.max(rect.height, 1));
      gl.uniform1f(uniforms.uPixelRatio, pixelRatio); gl.uniform2f(uniforms.uPointer, pointer[0], pointer[1]); gl.uniform2f(uniforms.uCenter, center[0], center[1]);
      gl.drawArrays(gl.POINTS, 0, config.count);
    }
    function tick(now) {
      frame = 0;
      if (!active() || !gl || lost) return;
      if (lastTick) elapsed += Math.min((now - lastTick) / 1000, .08);
      lastTick = now;
      if (now - lastDraw >= 1000 / config.fps) {
        lastDraw = now;
        pointer = pointer.map((value, i) => value + (targetPointer[i] - value) * .065);
        effects.style.setProperty("--hch-pan-x", `${pointer[0] * 10}px`);
        effects.style.setProperty("--hch-pan-y", `${pointer[1] * -7}px`);
        home.style.setProperty("--hch-tilt-x", `${pointer[1] * -4}deg`);
        home.style.setProperty("--hch-tilt-y", `${pointer[0] * 5}deg`);
        paint();
      }
      frame = scope.requestAnimationFrame(tick);
    }
    function sync() {
      if (disposed) return;
      const next = quality({ mode: options.mode?.() || "balanced", reduced: reducedQuery?.matches || contrastQuery?.matches, memory: scope.navigator?.deviceMemory, cores: scope.navigator?.hardwareConcurrency, saveData: scope.navigator?.connection?.saveData });
      const changed = config && config.count !== next.count;
      config = next;
      home.dataset.hchMotion = config.static ? "static" : "cinematic";
      home.dataset.hchPaused = String(doc.hidden || userPaused || config.static);
      stage.dataset.hchStagePaused = String(!active());
      control.disabled = config.static;
      control.setAttribute("aria-pressed", String(userPaused || config.static));
      control.setAttribute("aria-label", config.static ? "Chuyển động đã giảm theo tùy chọn trợ năng" : userPaused ? "Tiếp tục chuyển động trang chủ" : "Tạm dừng chuyển động trang chủ");
      control.querySelector("span").textContent = config.static ? "Không gian tĩnh" : userPaused ? "Đã tạm dừng" : "Chuyển động 3D";
      control.querySelector("b").textContent = userPaused || config.static ? "▷" : "Ⅱ";
      if (changed && gl && !lost) { initGPU(); measure(); }
      if (!active()) stop();
      else if (gl && !lost && !frame) frame = scope.requestAnimationFrame(tick);
    }

    on(control, "click", () => { userPaused = !userPaused; sync(); });
    on(stage, "pointermove", (event) => {
      if (!active() || coarse?.matches || event.pointerType === "touch") return;
      const box = stage.getBoundingClientRect();
      targetPointer = [Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1)), Math.max(-1, Math.min(1, 1 - (event.clientY - box.top) / box.height * 2))];
    }, { passive: true });
    on(stage, "pointerleave", () => { targetPointer = [0, 0]; });
    on(doc, "visibilitychange", sync); on(reducedQuery, "change", sync); on(contrastQuery, "change", sync);
    on(scope, "resize", measure, { passive: true });
    on(canvas, "webglcontextlost", (event) => { event.preventDefault(); lost = true; stop(); canvas.hidden = true; home.dataset.hchRenderer = "css"; });
    on(canvas, "webglcontextrestored", () => { if (disposed) return; lost = false; initGPU(); measure(); sync(); });
    let resizeObserver = null, visibilityObserver = null;
    if (scope.ResizeObserver) { resizeObserver = new scope.ResizeObserver(measure); resizeObserver.observe(stage); }
    if (scope.IntersectionObserver) {
      visibilityObserver = new scope.IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.target === stage) { inView = entry.isIntersecting; sync(); }
        else entry.target.dataset.hchInview = String(entry.isIntersecting);
      }), { rootMargin: "80px" });
      visibilityObserver.observe(stage);
      home.querySelectorAll(".php-card, .php-panel, .php-recipes button, .gha-home-stat, .gha-home-status").forEach((node) => visibilityObserver.observe(node));
    }
    sync(); initGPU(); measure(); sync();
    const api = Object.freeze({
      sync,
      getState: () => ({ variant, paused: !active(), renderer: gl && !lost ? "webgl" : "css", particles: config.count, framesScheduled: frame ? 1 : 0 }),
      destroy() {
        if (disposed) return;
        disposed = true; stop(); cleanups.splice(0).forEach((remove) => remove()); resizeObserver?.disconnect(); visibilityObserver?.disconnect(); releaseGPU();
        gl?.getExtension?.("WEBGL_lose_context")?.loseContext(); gl = null;
        effects.remove(); control.remove();
        delete stage.dataset.hchStagePaused;
        home.querySelectorAll("[data-hch-inview]").forEach((node) => node.removeAttribute("data-hch-inview"));
        ["hhCosmosHome", "hchMotion", "hchPaused", "hchRenderer"].forEach((name) => { delete home.dataset[name]; });
        home.style.removeProperty("--hch-tilt-x"); home.style.removeProperty("--hch-tilt-y"); instances.delete(home);
      }
    });
    instances.set(home, api);
    return api;
  }
  return Object.freeze({ version: 1, mount, quality, makeParticles });
});
