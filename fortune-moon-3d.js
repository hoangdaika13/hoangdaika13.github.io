(function fortuneMoon3DModule(globalScope) {
  "use strict";

  const instances = new WeakMap();
  let threePromise = null;
  const moduleUrl = () => new URL("vendor/three.module.min.js", globalScope.document?.baseURI || globalScope.location?.href || "").href;
  const loadThree = () => threePromise || (threePromise = import(moduleUrl()));
  const prefersReducedMotion = () => Boolean(globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  async function mount(canvas) {
    if (!canvas || instances.has(canvas)) return instances.get(canvas);
    const shell = canvas.closest(".fortune-moon-3d-shell");
    if (!shell) return null;
    const state = { disposed: false, paused: prefersReducedMotion(), visible: true, dragging: false, pointerX: 0, pointerY: 0, rotationX: 0.08, rotationY: 0, frame: 0 };
    instances.set(canvas, state);
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-description", "Kéo chuột hoặc dùng phím mũi tên để xoay mô hình Mặt Trăng.");

    try {
      const THREE = await loadThree();
      if (state.disposed || !canvas.isConnected) return null;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(globalScope.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 3.35);
      const loader = new THREE.TextureLoader();
      const [colorMap, heightMap] = await Promise.all([
        loader.loadAsync("assets/fortune/moon/nasa-lro/lroc-color-2k.jpg"),
        loader.loadAsync("assets/fortune/moon/nasa-lro/lroc-height-1k.jpg")
      ]);
      if (state.disposed || !canvas.isConnected) { colorMap.dispose(); heightMap.dispose(); renderer.dispose(); return null; }
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const geometry = new THREE.SphereGeometry(1, 96, 64);
      const material = new THREE.MeshStandardMaterial({ map: colorMap, displacementMap: heightMap, displacementScale: 0.026, bumpMap: heightMap, bumpScale: 0.034, roughness: 1, metalness: 0 });
      const moon = new THREE.Mesh(geometry, material);
      moon.rotation.z = -0.026;
      scene.add(moon);

      const ambient = new THREE.AmbientLight(0x8ba3d6, 0.035);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xfff6df, 3.2);
      const phase = Number(canvas.dataset.phaseAngle || 180) * Math.PI / 180;
      const waxing = canvas.dataset.waxing !== "false";
      key.position.set((waxing ? 1 : -1) * Math.sin(phase) * 4.5, 0.35, -Math.cos(phase) * 4.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x668dff, 0.18);
      rim.position.set(-2.5, 1.8, -2.2);
      scene.add(rim);

      const starGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(210 * 3);
      for (let index = 0; index < positions.length; index += 3) {
        const radius = 5 + (index % 17) * 0.11; const angle = index * 1.618;
        positions[index] = Math.cos(angle) * radius; positions[index + 1] = Math.sin(angle * 1.37) * radius; positions[index + 2] = -2 - (index % 13) * 0.4;
      }
      starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const starMaterial = new THREE.PointsMaterial({ color: 0xbdd7ff, size: 0.015, transparent: true, opacity: 0.58, depthWrite: false });
      scene.add(new THREE.Points(starGeometry, starMaterial));

      const resize = () => {
        if (state.disposed) return;
        const width = Math.max(240, shell.clientWidth || 420); const height = Math.max(280, Math.min(540, shell.clientHeight || width));
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(shell); resize();

      const pointerDown = (event) => { state.dragging = true; state.pointerX = event.clientX; state.pointerY = event.clientY; canvas.setPointerCapture?.(event.pointerId); };
      const pointerMove = (event) => { if (!state.dragging) return; state.rotationY += (event.clientX - state.pointerX) * 0.008; state.rotationX = Math.max(-0.72, Math.min(0.72, state.rotationX + (event.clientY - state.pointerY) * 0.006)); state.pointerX = event.clientX; state.pointerY = event.clientY; };
      const pointerUp = (event) => { state.dragging = false; canvas.releasePointerCapture?.(event.pointerId); };
      const keyDown = (event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault(); if (event.key === "ArrowLeft") state.rotationY -= 0.12; if (event.key === "ArrowRight") state.rotationY += 0.12; if (event.key === "ArrowUp") state.rotationX -= 0.08; if (event.key === "ArrowDown") state.rotationX += 0.08;
      };
      canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("pointercancel", pointerUp); canvas.addEventListener("keydown", keyDown);

      const toggle = shell.querySelector("[data-fortune-moon-3d-toggle]");
      const reset = shell.querySelector("[data-fortune-moon-3d-reset]");
      toggle?.addEventListener("click", () => { state.paused = !state.paused; toggle.textContent = state.paused ? "▶ Tiếp tục" : "⏸ Tạm dừng"; });
      reset?.addEventListener("click", () => { state.rotationX = 0.08; state.rotationY = 0; moon.scale.setScalar(1); });
      const intersectionObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => { state.visible = Boolean(entries[0]?.isIntersecting); }, { threshold: 0.01 }) : null;
      intersectionObserver?.observe(canvas);

      const dispose = () => {
        if (state.disposed) return; state.disposed = true; cancelAnimationFrame(state.frame); resizeObserver?.disconnect(); intersectionObserver?.disconnect();
        canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerUp); canvas.removeEventListener("keydown", keyDown);
        geometry.dispose(); material.dispose(); colorMap.dispose(); heightMap.dispose(); starGeometry.dispose(); starMaterial.dispose(); renderer.dispose();
      };
      state.dispose = dispose;
      const animate = () => {
        if (state.disposed) return;
        if (!canvas.isConnected) { dispose(); return; }
        if (!state.paused && state.visible && !globalScope.document?.hidden && !state.dragging) state.rotationY += 0.00075;
        moon.rotation.x += (state.rotationX - moon.rotation.x) * 0.1; moon.rotation.y += (state.rotationY - moon.rotation.y) * 0.1;
        if (state.visible && !globalScope.document?.hidden) renderer.render(scene, camera);
        state.frame = requestAnimationFrame(animate);
      };
      shell.classList.add("is-webgl-ready"); animate(); return state;
    } catch (error) {
      shell.classList.add("is-webgl-fallback");
      canvas.setAttribute("aria-label", `Mô hình WebGL chưa dùng được: ${String(error?.message || error).slice(0, 120)}`);
      return state;
    }
  }

  function mountAll(root = globalScope.document) {
    root?.querySelectorAll?.("[data-fortune-moon-3d]").forEach((canvas) => { mount(canvas); });
  }

  globalScope.HHFortuneMoon3D = Object.freeze({ mountAll });
})(typeof window !== "undefined" ? window : globalThis);
