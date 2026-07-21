(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate || gate.dataset.spatialAuroraReady === "true") return;
  gate.dataset.spatialAuroraReady = "true";

  const root = document.createElement("div");
  root.className = "auth-spatial-aurora";
  root.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  root.append(canvas);
  gate.append(root);

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const dataSaver = Boolean(navigator.connection?.saveData);
  const pointer = { x: .42, y: .42 };
  let frame = 0;
  let disposed = false;
  let paused = false;
  let renderer = "canvas";
  let cleanupRenderer = () => {};

  const phaseValue = () => {
    if (!navigator.onLine) return 3;
    const hour = new Date().getHours();
    if (hour < 11) return 0;
    if (hour < 18) return 1;
    return 2;
  };

  const phaseName = () => ["morning", "afternoon", "night", "offline"][phaseValue()];
  const motionMode = () => document.body.dataset.authMotionMode || "balanced";
  const shouldPause = () => disposed || document.hidden || reducedMotion?.matches || motionMode() === "static";

  const syncState = () => {
    paused = shouldPause();
    root.dataset.phase = phaseName();
    root.classList.toggle("is-paused", paused);
  };

  const startCanvas = () => {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return false;
    renderer = "canvas";
    root.dataset.renderer = renderer;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.max(1, Math.round(innerWidth * ratio));
      canvas.height = Math.max(1, Math.round(innerHeight * ratio));
    };

    const draw = (time = 0) => {
      if (disposed || renderer !== "canvas") return;
      syncState();
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      const palette = phaseValue() === 0
        ? ["90,235,224", "122,248,170", "255,174,204"]
        : phaseValue() === 1
          ? ["255,183,83", "255,100,170", "89,226,235"]
          : ["159,92,255", "255,65,175", "55,226,238"];
      const drift = paused ? 0 : Math.sin(time * .00016) * width * .045;
      const points = [
        [width * pointer.x + drift, height * pointer.y, .42],
        [width * .18 - drift, height * .74, .36],
        [width * .82 + drift * .4, height * .24, .34]
      ];
      points.forEach(([x, y, radius], index) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * radius);
        gradient.addColorStop(0, `rgba(${palette[index]},.25)`);
        gradient.addColorStop(1, `rgba(${palette[index]},0)`);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      });
      frame = requestAnimationFrame(draw);
    };

    resize();
    addEventListener("resize", resize, { passive: true });
    frame = requestAnimationFrame(draw);
    cleanupRenderer = () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
    };
    return true;
  };

  const startWebGPU = async () => {
    if (!navigator.gpu || dataSaver || reducedMotion?.matches || motionMode() !== "vivid") return false;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter || disposed) return false;
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context || disposed) return false;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "premultiplied" });

    const module = device.createShaderModule({ code: `
      struct Uniforms {
        resolution: vec2f,
        pointer: vec2f,
        time: f32,
        phase: f32,
        intensity: f32,
        pad: f32,
      }
      @group(0) @binding(0) var<uniform> u: Uniforms;

      @vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
        var points = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
        return vec4f(points[index], 0.0, 1.0);
      }

      fn palette(t: f32) -> vec3f {
        let morning = vec3f(.25, .92, .83);
        let afternoon = vec3f(1.0, .42, .58);
        let night = vec3f(.48, .25, 1.0);
        if (u.phase < .5) { return mix(morning, vec3f(.95, .73, .26), t); }
        if (u.phase < 1.5) { return mix(afternoon, vec3f(.22, .88, .94), t); }
        return mix(night, vec3f(1.0, .18, .62), t);
      }

      @fragment fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
        var uv = position.xy / max(u.resolution, vec2f(1.0));
        let centered = (uv - .5) * vec2f(u.resolution.x / max(u.resolution.y, 1.0), 1.0);
        let waveA = sin(centered.x * 4.8 + u.time * .18) * .12;
        let waveB = sin(centered.x * 8.2 - u.time * .11) * .055;
        let ribbon = exp(-abs(centered.y + waveA + waveB) * 5.8);
        let pointerDistance = distance(uv, u.pointer);
        let pointerGlow = exp(-pointerDistance * 5.4) * .48;
        let edge = smoothstep(.9, .1, length(centered));
        let shimmer = .5 + .5 * sin(u.time * .32 + centered.x * 3.0);
        let color = palette(shimmer) * (ribbon * .5 + pointerGlow + edge * .08) * u.intensity;
        let alpha = clamp(ribbon * .24 + pointerGlow * .16 + edge * .035, 0.0, .34);
        return vec4f(color * alpha, alpha);
      }
    ` });

    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vertexMain" },
      fragment: { module, entryPoint: "fragmentMain", targets: [{
        format,
        blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
        }
      }] },
      primitive: { topology: "triangle-list" }
    });
    const uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(innerWidth * ratio));
      canvas.height = Math.max(1, Math.round(innerHeight * ratio));
    };
    const draw = (time = 0) => {
      if (disposed || renderer !== "webgpu") return;
      syncState();
      const intensity = paused ? .18 : motionMode() === "vivid" ? 1 : .48;
      const values = new Float32Array([canvas.width, canvas.height, pointer.x, pointer.y, time * .001, phaseValue(), intensity, 0]);
      device.queue.writeBuffer(uniformBuffer, 0, values);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }] });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      frame = requestAnimationFrame(draw);
    };

    renderer = "webgpu";
    root.dataset.renderer = renderer;
    resize();
    addEventListener("resize", resize, { passive: true });
    device.lost.then(() => {
      if (!disposed && renderer === "webgpu") {
        cleanupRenderer();
        startCanvas();
      }
    });
    frame = requestAnimationFrame(draw);
    cleanupRenderer = () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      try { device.destroy(); } catch {}
    };
    return true;
  };

  const trackPointer = (event) => {
    pointer.x = Math.min(1, Math.max(0, event.clientX / Math.max(1, innerWidth)));
    pointer.y = Math.min(1, Math.max(0, event.clientY / Math.max(1, innerHeight)));
  };

  addEventListener("pointermove", trackPointer, { passive: true });
  addEventListener("online", syncState);
  addEventListener("offline", syncState);
  document.addEventListener("visibilitychange", syncState);
  window.addEventListener("hh:auth-motion-mode-change", syncState);
  window.addEventListener("hh:auth-trust-motion-change", syncState);
  reducedMotion?.addEventListener?.("change", syncState);

  const api = {
    get renderer() { return renderer; },
    get phase() { return phaseName(); },
    pause() { paused = true; root.classList.add("is-paused"); },
    resume() { syncState(); },
    destroy() {
      disposed = true;
      cleanupRenderer();
      removeEventListener("pointermove", trackPointer);
      removeEventListener("online", syncState);
      removeEventListener("offline", syncState);
      document.removeEventListener("visibilitychange", syncState);
      window.removeEventListener("hh:auth-motion-mode-change", syncState);
      window.removeEventListener("hh:auth-trust-motion-change", syncState);
      reducedMotion?.removeEventListener?.("change", syncState);
      root.remove();
    }
  };
  window.HHSpatialAurora = api;
  syncState();
  startWebGPU().catch(() => false).then((started) => {
    if (!started && !disposed) startCanvas();
  });
})();
