(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  const galaxy = gate?.querySelector("[data-hh-galaxy]");
  if (!gate || !galaxy) return;

  const THREE_URL = "./vendor/three.module.min.js";
  const planetButtons = [...galaxy.querySelectorAll("[data-hh-galaxy-key]")];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 760px)");
  const finePointer = matchMedia("(pointer: fine)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const modestDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || connection?.saveData;
  let mounted = false;
  let destroyed = false;
  let frame = 0;
  let sceneState = null;
  let resizeObserver = null;
  let authStateObserver = null;
  let lastAuthVisualState = "";
  let pointer = { x: 0, y: 0 };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
    catch { return fallback; }
  };

  const routeUsage = () => {
    const recent = read("hh.app-shell.recent", []);
    const text = JSON.stringify(Array.isArray(recent) ? recent : []).toLowerCase();
    const patterns = {
      home: ["home"], system: ["system", "settings"], creative: ["create", "ai"], music: ["music"],
      media: ["media", "video", "photo"], graphic: ["graphic"], dev: ["dev", "api", "git"], work: ["work", "project"],
      communication: ["communication", "messenger", "community"], entertainment: ["game", "entertainment", "astra"],
      analytics: ["analytics", "insight"], learning: ["learn", "lesson"], english: ["english"], japanese: ["japanese"], support: ["support", "donat"]
    };
    return Object.fromEntries(Object.entries(patterns).map(([key, words]) => [key, words.reduce((sum, word) => sum + (text.split(word).length - 1), 0)]));
  };

  const realSignals = () => {
    const communication = read("hh.communication.intelligence.v1", {});
    const learning = read("hh.learning.os.v1", {});
    const projects = read("hh-project-center", {});
    const jobs = read("hh.background.jobs.v1", []);
    const unread = Array.isArray(communication.notifications) ? communication.notifications.filter((item) => item && !item.read).length : 0;
    const reviews = Array.isArray(learning.reviews) ? learning.reviews.filter((item) => item && !item.completed).length : 0;
    const tasks = Array.isArray(projects.tasks) ? projects.tasks.filter((item) => item && !item.completed && item.status !== "done" && item.column !== "done").length : 0;
    const running = Array.isArray(jobs) ? jobs.filter((item) => item && ["queued", "running", "failed"].includes(item.state)).length : 0;
    return { communication: unread, learning: reviews, english: reviews, japanese: reviews, work: tasks, system: running };
  };

  const mode = () => {
    if (reduceMotion.matches || gate.dataset.motionLevel === "off") return "static";
    if (gate.dataset.motionLevel === "soft" || modestDevice) return "balanced";
    return "cinematic";
  };

  const makeRadialTexture = (THREE, stops, size = 256) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(size * .5, size * .5, 0, size * .5, size * .5, size * .5);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makePlanetTexture = (THREE, index, primary, secondary) => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, primary);
    gradient.addColorStop(.55, secondary);
    gradient.addColorStop(1, "#020611");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    let seed = (index + 3) * 7919;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 78; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 3 + random() * 25;
      context.globalAlpha = .06 + random() * .18;
      context.fillStyle = random() > .5 ? "#fff" : "#00101d";
      context.beginPath();
      context.ellipse(x, y, radius * (1.2 + random()), radius * .46, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = .16;
    context.strokeStyle = "#fff";
    context.lineWidth = 2;
    for (let y = 20; y < size; y += 34 + index % 7) {
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(size * .28, y - 12, size * .64, y + 16, size, y - 4);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };

  const makeHTexture = (THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, 512, 512);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 330px Arial";
    context.shadowColor = "#ffffff";
    context.shadowBlur = 34;
    context.fillStyle = "#fffef4";
    context.fillText("H", 256, 272);
    return new THREE.CanvasTexture(canvas);
  };

  const createStars = (THREE, scene, count, radius, size, opacity) => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const spread = radius * (.38 + ((index * 47) % 100) / 100 * .7);
      positions[index * 3] = Math.cos(angle) * spread;
      positions[index * 3 + 1] = (((index * 73) % 100) / 100 - .5) * radius * 1.15;
      positions[index * 3 + 2] = Math.sin(angle) * spread - radius * .35;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xd9f7ff, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    return stars;
  };

  const orbitPosition = (THREE, orbit, angle, target) => {
    target.set(Math.cos(angle) * orbit.radius, Math.sin(angle) * orbit.radius * orbit.eccentricity, 0);
    target.applyEuler(orbit.tilt);
    return target;
  };

  const createOrbitMaterial = (THREE, color, opacity) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPulse: { value: 0 }
    },
    vertexShader: `
      varying float vFront;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vFront = smoothstep(-790.0, -520.0, mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPulse;
      varying float vFront;
      void main() {
        float depthAlpha = mix(0.16, 1.0, vFront);
        gl_FragColor = vec4(uColor, uOpacity * depthAlpha * (1.0 + uPulse));
      }
    `
  });

  const makeMeteorTailTexture = (THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(.52, "rgba(255,255,255,.08)");
    gradient.addColorStop(.86, "rgba(255,255,255,.58)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const METEOR_COLORS = Object.freeze(["#62e8ff", "#b36dff", "#ff65c8", "#ffd86b"]);

  const spawnDomMeteor = ({ layer = "mid", color, targetButton = null } = {}) => {
    const state = sceneState;
    if (!state?.meteorLayer || mode() === "static" || document.hidden) return;
    const limits = mode() === "cinematic" ? 3 : 2;
    if (state.meteorLayer.childElementCount >= limits) return;
    const rect = state.meteorLayer.getBoundingClientRect();
    const meteor = document.createElement("i");
    meteor.className = `hh-living-meteor is-${layer}`;
    const reverse = state.meteorSerial % 5 === 0;
    let endX;
    let endY;
    let startX;
    let startY;
    if (targetButton) {
      const targetRect = targetButton.getBoundingClientRect();
      endX = targetRect.left - rect.left + targetRect.width * .5;
      endY = targetRect.top - rect.top + targetRect.height * .5;
      startX = endX + (reverse ? 210 : -210);
      startY = endY - 125;
    } else {
      startX = reverse ? rect.width + 150 : -170;
      startY = 90 + (state.meteorSerial * 83 % Math.max(160, rect.height - 190));
      endX = reverse ? -190 : rect.width + 170;
      endY = startY + 130 + (state.meteorSerial % 3) * 34;
    }
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    meteor.style.setProperty("--meteor-color", color);
    meteor.style.setProperty("--meteor-start-x", `${startX}px`);
    meteor.style.setProperty("--meteor-start-y", `${startY}px`);
    meteor.style.setProperty("--meteor-end-x", `${endX}px`);
    meteor.style.setProperty("--meteor-end-y", `${endY}px`);
    meteor.style.setProperty("--meteor-angle", `${angle}deg`);
    meteor.style.setProperty("--meteor-duration", targetButton ? ".68s" : (layer === "far" ? "3.4s" : layer === "near" ? "1.6s" : "2.35s"));
    state.meteorLayer.append(meteor);
    meteor.addEventListener("animationend", () => meteor.remove(), { once: true });
  };

  const spawnMeteor = ({ layer = "mid", color = "", target = null, targetButton = null, notification = false } = {}) => {
    const state = sceneState;
    if (!state || mode() === "static" || document.hidden) return false;
    const max = mode() === "cinematic" ? 3 : 2;
    if (state.meteors.length >= max && !target) return false;
    const THREE = state.THREE;
    const layerConfig = {
      far: { z: -330, size: 3.2, length: 72, speed: 72, opacity: .28 },
      mid: { z: -110, size: 5.2, length: 112, speed: 132, opacity: .52 },
      near: { z: 95, size: 7.4, length: 168, speed: 205, opacity: .78 }
    }[layer] || { z: -110, size: 5.2, length: 112, speed: 132, opacity: .52 };
    const tint = color || METEOR_COLORS[state.meteorSerial % METEOR_COLORS.length];
    state.meteorSerial += 1;
    const group = new THREE.Group();
    const targetPoint = target?.clone?.() || null;
    let start;
    let direction;
    let life;
    if (targetPoint) {
      const side = state.meteorSerial % 2 ? -1 : 1;
      start = targetPoint.clone().add(new THREE.Vector3(side * 160, 92 + state.meteorSerial % 3 * 18, 70));
      direction = targetPoint.clone().sub(start).normalize();
      life = Math.max(.55, start.distanceTo(targetPoint) / 310);
    } else {
      const reverse = state.meteorSerial % 5 === 0;
      start = new THREE.Vector3(reverse ? 390 : -390, 205 - (state.meteorSerial * 67 % 360), layerConfig.z);
      const vertical = -.25 - (state.meteorSerial * 17 % 42) / 100;
      direction = new THREE.Vector3(reverse ? -1 : 1, vertical, 0).normalize();
      life = 5.6;
    }
    group.position.copy(start);
    const angle = Math.atan2(direction.y, direction.x);
    const tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: state.meteorTailTexture, color: tint, transparent: true, opacity: layerConfig.opacity, rotation: angle, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    tail.scale.set(layerConfig.length, Math.max(2.2, layerConfig.size * .75), 1);
    tail.position.set(-direction.x * layerConfig.length * .5, -direction.y * layerConfig.length * .5, 0);
    /* DOM gradient renders the luminous trail consistently across WebGL drivers. */
    tail.visible = false;
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: state.meteorGlowTexture, color: tint, transparent: true, opacity: Math.min(1, layerConfig.opacity + .25), blending: THREE.AdditiveBlending, depthWrite: false }));
    head.scale.set(layerConfig.size * 3.5, layerConfig.size * 3.5, 1);
    group.add(head);
    state.scene.add(group);
    state.meteors.push({ group, tail, head, direction, speed: targetPoint ? 310 : layerConfig.speed, age: 0, life, target: targetPoint, notification, baseOpacity: layerConfig.opacity });
    galaxy.dataset.meteorCount = String(state.meteors.length);
    spawnDomMeteor({ layer, color: tint, targetButton });
    return true;
  };

  const updateMeteors = (state, delta, elapsed, currentMode) => {
    if (currentMode === "static") return;
    for (let index = state.meteors.length - 1; index >= 0; index -= 1) {
      const meteor = state.meteors[index];
      meteor.age += delta;
      meteor.group.position.addScaledVector(meteor.direction, meteor.speed * delta);
      const fadeIn = Math.min(1, meteor.age * 5);
      const fadeOut = Math.min(1, (meteor.life - meteor.age) * 2.4);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
      meteor.tail.material.opacity = meteor.baseOpacity * alpha;
      meteor.head.material.opacity = Math.min(1, (meteor.baseOpacity + .28) * alpha);
      if (meteor.age >= meteor.life || (meteor.target && meteor.group.position.distanceTo(meteor.target) < 10)) {
        state.scene.remove(meteor.group);
        meteor.tail.material.dispose();
        meteor.head.material.dispose();
        state.meteors.splice(index, 1);
        galaxy.dataset.meteorCount = String(state.meteors.length);
      }
    }
    while (state.showerQueue.length && state.showerQueue[0] <= elapsed) {
      state.showerQueue.shift();
      spawnMeteor({ layer: currentMode === "cinematic" ? ["far", "mid", "near"][state.meteorSerial % 3] : "far" });
    }
    if (elapsed >= state.nextMeteorAt) {
      const layer = currentMode === "cinematic" ? ["far", "mid", "near"][state.meteorSerial % 3] : (state.meteorSerial % 2 ? "far" : "mid");
      spawnMeteor({ layer });
      state.nextMeteorAt = elapsed + (currentMode === "cinematic" ? 4.8 + Math.random() * 4.6 : 8.5 + Math.random() * 6.5);
    }
    if (elapsed >= state.nextShowerAt) {
      const count = currentMode === "cinematic" ? 3 : 2;
      state.showerQueue = Array.from({ length: count }, (_, index) => elapsed + index * .34);
      state.nextShowerAt = elapsed + 28 + Math.random() * 18;
    }
  };

  async function build() {
    if (destroyed || mobile.matches || mounted || !planetButtons.length) return false;
    mounted = true;
    galaxy.dataset.livingGalaxy = "loading";
    try {
      const THREE = await import(THREE_URL);
      if (destroyed || mobile.matches) return false;
      const canvas = document.createElement("canvas");
      canvas.className = "hh-living-galaxy-canvas";
      canvas.setAttribute("aria-hidden", "true");
      const depth = document.createElement("div");
      depth.className = "hh-living-galaxy-depth";
      depth.setAttribute("aria-hidden", "true");
      const status = document.createElement("span");
      status.className = "hh-living-galaxy-status";
      status.innerHTML = `<i></i><span>${mode() === "cinematic" ? "3D CINEMATIC" : "3D BALANCED"} · DỮ LIỆU THẬT</span>`;
      const core = document.createElement("span");
      core.className = "hh-living-galaxy-core";
      core.textContent = "H";
      core.setAttribute("aria-hidden", "true");
      const meteorLayer = document.createElement("div");
      meteorLayer.className = "hh-living-meteor-layer";
      meteorLayer.setAttribute("aria-hidden", "true");
      galaxy.prepend(depth, canvas, meteorLayer, core, status);

      const hitLayer = document.createElement("div");
      hitLayer.className = "hh-living-galaxy-hitlayer";
      planetButtons.forEach((button) => hitLayer.append(button));
      galaxy.append(hitLayer);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: mode() === "cinematic", powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x02040d, .0028);
      const camera = new THREE.PerspectiveCamera(46, 1, .1, 1500);
      camera.position.set(0, 20, 665);
      scene.add(new THREE.AmbientLight(0x6584bc, 1.05));
      scene.add(new THREE.HemisphereLight(0xbceeff, 0x170822, 1.55));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(-180, 220, 340);
      scene.add(keyLight);
      const sunLight = new THREE.PointLight(0xffd2aa, 2600, 900, 1.2);
      sunLight.position.set(0, 0, 35);
      scene.add(sunLight);

      const root = new THREE.Group();
      root.rotation.x = -.12;
      scene.add(root);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(51, mode() === "cinematic" ? 64 : 36, mode() === "cinematic" ? 48 : 24), new THREE.MeshBasicMaterial({ color: 0xff7b2f }));
      root.add(sun);
      const sunShell = new THREE.Mesh(new THREE.SphereGeometry(54, 48, 28), new THREE.MeshBasicMaterial({ color: 0xffb04c, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
      sunShell.renderOrder = 4;
      root.add(sunShell);
      const sunCore = new THREE.Mesh(new THREE.SphereGeometry(42, 40, 24), new THREE.MeshBasicMaterial({ color: 0xffd36e }));
      sunCore.position.z = 4;
      root.add(sunCore);
      const glowTexture = makeRadialTexture(THREE, [[0,"rgba(255,255,245,1)"],[.12,"rgba(255,190,92,.95)"],[.35,"rgba(255,62,109,.38)"],[.7,"rgba(104,57,255,.12)"],[1,"rgba(0,0,0,0)"]]);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(250, 250, 1);
      glow.position.z = -8;
      root.add(glow);
      const hMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeHTexture(THREE), transparent: true, depthTest: false, depthWrite: false }));
      hMark.scale.set(84, 84, 1);
      hMark.position.set(0, 0, 59);
      hMark.renderOrder = 100;
      root.add(hMark);
      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(71 + index * 12, .38 + index * .12, 8, 128), new THREE.MeshBasicMaterial({ color: [0xffb66b,0xff62c7,0x62e8ff][index], transparent: true, opacity: .34 - index * .06, blending: THREE.AdditiveBlending }));
        ring.rotation.set(1.17 + index * .1, .15, index * .72);
        root.add(ring);
      }

      const starFar = createStars(THREE, scene, mode() === "cinematic" ? 1300 : 620, 760, 1.25, .64);
      const starNear = createStars(THREE, scene, mode() === "cinematic" ? 380 : 140, 520, 2.1, .45);
      const nebulaTexture = makeRadialTexture(THREE, [[0,"rgba(91,53,255,.5)"],[.28,"rgba(24,135,255,.25)"],[.56,"rgba(236,39,187,.12)"],[1,"rgba(0,0,0,0)"]], 512);
      const nebula = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexture, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending }));
      nebula.scale.set(840, 520, 1);
      nebula.position.set(-70, -10, -260);
      scene.add(nebula);

      const usage = routeUsage();
      const signals = realSignals();
      const accents = planetButtons.map((button) => getComputedStyle(button).getPropertyValue("--planet-a").trim() || "#65efff");
      const secondary = planetButtons.map((button) => getComputedStyle(button).getPropertyValue("--planet-b").trim() || "#1641c8");
      const planetGlowTexture = makeRadialTexture(THREE, [[0,"rgba(255,255,255,.92)"],[.12,"rgba(255,255,255,.62)"],[.38,"rgba(255,255,255,.2)"],[1,"rgba(0,0,0,0)"]], 128);
      const meteorGlowTexture = makeRadialTexture(THREE, [[0,"rgba(255,255,255,1)"],[.18,"rgba(255,255,255,.9)"],[.46,"rgba(255,255,255,.24)"],[1,"rgba(0,0,0,0)"]], 96);
      const meteorTailTexture = makeMeteorTailTexture(THREE);
      const planets = planetButtons.map((button, index) => {
        const key = button.dataset.hhGalaxyKey;
        const popularity = Math.min(1, Math.log2(2 + (usage[key] || 0)) / 4);
        const radius = 78 + index * 10.8;
        const size = 7.2 + popularity * 4.2 + (index % 4) * .45;
        const group = new THREE.Group();
        const surfaceTexture = makePlanetTexture(THREE, index, accents[index], secondary[index]);
        const material = new THREE.MeshStandardMaterial({ map: surfaceTexture, color: 0xffffff, emissive: new THREE.Color(accents[index]), emissiveIntensity: .92, roughness: .64, metalness: .03, transparent: true, opacity: .98 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, mode() === "cinematic" ? 32 : 20, mode() === "cinematic" ? 24 : 14), material);
        group.add(mesh);
        const luminousSurface = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ map: surfaceTexture, color: accents[index], transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false }));
        luminousSurface.scale.setScalar(1.012);
        luminousSurface.renderOrder = 3;
        group.add(luminousSurface);
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(size * 1.1, 20, 14), new THREE.MeshBasicMaterial({ color: accents[index], transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
        group.add(atmosphere);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetGlowTexture, color: accents[index], transparent: true, opacity: .52, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(size * 5.4, size * 5.4, 1);
        halo.position.z = -size * .55;
        group.add(halo);
        if ((signals[key] || 0) > 0) {
          const signalRing = new THREE.Mesh(new THREE.TorusGeometry(size * 1.55, .48, 7, 52), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending }));
          signalRing.rotation.x = 1.24;
          signalRing.userData.signal = true;
          group.add(signalRing);
          button.dataset.hhSignalCount = String(signals[key]);
        }
        root.add(group);
        const tilt = new THREE.Euler(
          -.16 + (index % 5) * .075,
          -.1 + (index % 4) * .055,
          -.28 + index * .041,
          "XYZ"
        );
        const eccentricity = .42 + (index % 4) * .035;
        const orbitPoints = [];
        for (let step = 0; step < 128; step += 1) {
          const angle = step / 128 * Math.PI * 2;
          const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * eccentricity, 0);
          point.applyEuler(tilt);
          orbitPoints.push(point);
        }
        const baseOrbitOpacity = .048 + (index % 3) * .012;
        const orbitMaterial = createOrbitMaterial(THREE, accents[index], baseOrbitOpacity);
        const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPoints), orbitMaterial);
        root.add(orbit);
        const energy = Array.from({ length: 2 }, (_, energyIndex) => {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetGlowTexture, color: accents[index], transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false }));
          sprite.scale.set(7, 7, 1);
          sprite.visible = false;
          root.add(sprite);
          return { index: energyIndex, sprite, angle: index * .73 + energyIndex * Math.PI, speed: .12 + index % 3 * .018, position: new THREE.Vector3() };
        });
        return { button, key, accent: accents[index], group, mesh, material, luminousSurface, atmosphere, halo, orbit, orbitMaterial, baseOrbitOpacity, radius, eccentricity, tilt, size, orbitAngle: index * 2.399963 + (index % 3) * .31, speed: .035 / Math.sqrt(radius / 82), popularity, energy, position: new THREE.Vector3(), scaleVector: new THREE.Vector3(1, 1, 1) };
      });

      sceneState = {
        THREE, canvas, renderer, scene, camera, root, sun, glow, hMark, starFar, starNear, nebula, planets, status, meteorLayer,
        meteorGlowTexture, meteorTailTexture, meteors: [], meteorSerial: 0, nextMeteorAt: 2.8, nextShowerAt: 24 + Math.random() * 10, showerQueue: [],
        speedFactor: 1, speedTarget: 1, selectionHoldUntil: 0, pointerInGalaxy: false, warpBoostUntil: 0, errorPulseUntil: 0,
        projectionVector: new THREE.Vector3(), last: performance.now(), elapsed: 0, frameBudget: 0
      };
      galaxy.classList.add("is-webgl-ready");
      galaxy.dataset.livingGalaxy = mode();
      galaxy.dataset.meteorCount = "0";

      const resize = () => {
        if (!sceneState || !canvas.isConnected) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = mode() === "cinematic" ? Math.min(devicePixelRatio || 1, 1.7) : Math.min(devicePixelRatio || 1, 1.15);
        renderer.setPixelRatio(dpr);
        renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        camera.aspect = Math.max(.4, rect.width / Math.max(1, rect.height));
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      resize();
      render(performance.now());
      return true;
    } catch (error) {
      mounted = false;
      galaxy.dataset.livingGalaxy = "css-fallback";
      console.warn("HH Living Galaxy chuyển sang chế độ CSS an toàn.", error);
      return false;
    }
  }

  function render(now) {
    if (!sceneState || destroyed) return;
    const state = sceneState;
    const currentMode = mode();
    const delta = Math.min(.05, Math.max(0, (now - state.last) / 1000));
    state.last = now;
    if (!document.hidden && currentMode !== "static") state.elapsed += delta;
    const elapsed = state.elapsed;
    const selectedKey = galaxy.dataset.activeCategory || "home";
    const nowTime = performance.now();
    const warpBoost = nowTime < state.warpBoostUntil ? 6.4 : 1;
    const errorPulse = nowTime < state.errorPulseUntil ? Math.sin(nowTime * .035) * .018 : 0;
    if (nowTime >= state.selectionHoldUntil && state.speedTarget === 0) state.speedTarget = state.pointerInGalaxy ? .08 : 1;
    state.speedFactor += (state.speedTarget - state.speedFactor) * Math.min(1, delta * 4.5);
    galaxy.dataset.orbitSpeed = state.speedFactor.toFixed(2);
    const targetX = finePointer.matches ? pointer.x * 22 : 0;
    const targetY = finePointer.matches ? pointer.y * 14 : 0;
    state.camera.position.x += (targetX - state.camera.position.x) * Math.min(1, delta * 2.8);
    state.camera.position.y += (20 - targetY - state.camera.position.y) * Math.min(1, delta * 2.8);
    state.camera.lookAt(pointer.x * 5, pointer.y * -4, 0);
    state.root.rotation.z = Math.sin(elapsed * .08) * .016 + errorPulse;
    state.sun.rotation.y += delta * .11;
    state.glow.material.rotation = elapsed * .018;
    state.glow.scale.setScalar(250 + Math.sin(elapsed * 1.3) * 8);
    state.starFar.rotation.y = elapsed * .003;
    state.starNear.rotation.y = -elapsed * .008;
    state.nebula.position.x = -70 + pointer.x * 24;
    state.nebula.position.y = -10 - pointer.y * 17;
    const canvasRect = state.canvas.getBoundingClientRect();
    const vector = state.projectionVector;
    const detailLimit = currentMode === "cinematic" ? 8 : 5;
    galaxy.dataset.orbitDetailCount = String(detailLimit);
    state.planets.forEach((planet, index) => {
      if (currentMode !== "static") planet.orbitAngle += delta * planet.speed * state.speedFactor * warpBoost;
      const angle = planet.orbitAngle;
      orbitPosition(state.THREE, planet, angle, planet.position);
      planet.group.position.copy(planet.position);
      const depth = Math.max(-1, Math.min(1, planet.position.z / Math.max(1, planet.radius * .35)));
      planet.mesh.rotation.y += delta * (.08 + index % 5 * .015);
      planet.group.children.forEach((child) => {
        if (!child.userData.signal) return;
        child.rotation.z += delta * .72;
        const signalPulse = 1 + Math.sin(elapsed * 3.2 + index) * .08;
        child.scale.setScalar(signalPulse);
        child.material.opacity = .58 + Math.sin(elapsed * 3.2 + index) * .2;
      });
      const selected = selectedKey === planet.key;
      const scale = selected ? 1.34 : 1;
      planet.scaleVector.setScalar(scale);
      planet.group.scale.lerp(planet.scaleVector, Math.min(1, delta * 8));
      planet.material.emissive.set(selected ? "#ffffff" : planet.accent);
      planet.material.emissiveIntensity = selected ? 1.55 : .92;
      planet.material.opacity = selected ? 1 : .64 + (depth + 1) * .15;
      planet.luminousSurface.material.opacity = selected ? .58 : .28 + (depth + 1) * .08;
      planet.atmosphere.material.opacity = selected ? .42 : .16 + (depth + 1) * .045;
      planet.halo.material.opacity = selected ? .82 : .38 + (depth + 1) * .09;
      const detailed = index < detailLimit || selected;
      const orbitTarget = selected ? .46 : (detailed ? planet.baseOrbitOpacity * 1.8 : planet.baseOrbitOpacity * .65);
      planet.orbitMaterial.uniforms.uOpacity.value += (orbitTarget - planet.orbitMaterial.uniforms.uOpacity.value) * Math.min(1, delta * 7);
      planet.orbitMaterial.uniforms.uPulse.value = selected ? .28 + Math.sin(elapsed * 3.4) * .16 : (nowTime < state.errorPulseUntil ? .12 : 0);
      planet.energy.forEach((particle) => {
        const energyActive = selected ? particle.index === 0 : (index < detailLimit && (currentMode === "cinematic" || particle.index === 0));
        particle.sprite.visible = energyActive;
        if (!energyActive) return;
        if (currentMode !== "static") particle.angle += delta * particle.speed * state.speedFactor * warpBoost;
        orbitPosition(state.THREE, planet, particle.angle, particle.position);
        particle.sprite.position.copy(particle.position);
        particle.sprite.material.opacity = selected ? 1 : .56 + Math.sin(elapsed * 2.2 + particle.angle) * .18;
      });
      planet.group.getWorldPosition(vector);
      vector.project(state.camera);
      const x = (vector.x * .5 + .5) * canvasRect.width;
      const y = (-vector.y * .5 + .5) * canvasRect.height;
      const depthScale = Math.max(.72, Math.min(1.22, 1 + depth * .16));
      planet.button.style.setProperty("--planet-screen-x", `${x}px`);
      planet.button.style.setProperty("--planet-screen-y", `${y}px`);
      planet.button.style.setProperty("--planet-screen-scale", depthScale.toFixed(3));
      planet.button.style.setProperty("--planet-depth-opacity", String(Math.max(.5, Math.min(1, .73 + depth * .2))));
      planet.button.style.zIndex = String(20 + Math.round(depth * 8));
    });
    updateMeteors(state, delta, elapsed, currentMode);
    state.renderer.render(state.scene, state.camera);
    if (!document.hidden && currentMode !== "static") frame = requestAnimationFrame(render);
    else frame = 0;
  }

  const resume = () => {
    if (!sceneState || frame || destroyed || document.hidden) return;
    sceneState.last = performance.now();
    frame = requestAnimationFrame(render);
  };

  const onPointerMove = (event) => {
    if (!finePointer.matches || mode() === "static") return;
    const width = Math.max(1, innerWidth * .585);
    if (sceneState) {
      sceneState.pointerInGalaxy = event.clientX <= width;
      if (performance.now() >= sceneState.selectionHoldUntil) sceneState.speedTarget = sceneState.pointerInGalaxy ? .08 : 1;
    }
    pointer = { x: Math.max(-1, Math.min(1, event.clientX / width * 2 - 1)), y: Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1)) };
    galaxy.style.setProperty("--galaxy-parallax-x", `${pointer.x * 22}px`);
    galaxy.style.setProperty("--galaxy-parallax-y", `${pointer.y * 16}px`);
    galaxy.style.setProperty("--galaxy-far-x", `${pointer.x * -6}px`);
    galaxy.style.setProperty("--galaxy-far-y", `${pointer.y * -5}px`);
    galaxy.style.setProperty("--galaxy-near-x", `${pointer.x * 11}px`);
    galaxy.style.setProperty("--galaxy-near-y", `${pointer.y * 8}px`);
  };

  const meteorToPlanet = (key, { notification = false } = {}) => {
    const planet = sceneState?.planets?.find((item) => item.key === key);
    if (!planet) return false;
    return spawnMeteor({ layer: notification ? "near" : "mid", color: planet.accent, target: planet.position, targetButton: planet.button, notification });
  };

  const onGalaxyHover = (event) => {
    if (!event.target.closest?.("[data-hh-galaxy-key]")) return;
    if (sceneState) {
      sceneState.pointerInGalaxy = true;
      sceneState.speedFactor = .03;
      sceneState.speedTarget = .03;
    }
  };

  const onGalaxyLeave = (event) => {
    if (event.relatedTarget?.closest?.("[data-hh-galaxy-key]")) return;
    if (sceneState && performance.now() < sceneState.selectionHoldUntil) return;
    if (sceneState) sceneState.speedTarget = sceneState.pointerInGalaxy ? .08 : 1;
  };

  const onGalaxySelection = (event) => {
    if (!event.detail?.pinned || !event.detail?.key) return;
    if (sceneState) {
      sceneState.speedFactor = 0;
      sceneState.speedTarget = 0;
      sceneState.selectionHoldUntil = performance.now() + 950;
    }
    meteorToPlanet(event.detail.key);
  };

  const showWarp = () => {
    if (mode() === "static" || reduceMotion.matches) return;
    let warp = document.querySelector(".hh-living-warp");
    if (!warp) {
      warp = document.createElement("div");
      warp.className = "hh-living-warp";
      warp.setAttribute("aria-hidden", "true");
      document.body.append(warp);
    }
    warp.classList.remove("is-active");
    requestAnimationFrame(() => warp.classList.add("is-active"));
    setTimeout(() => warp.classList.remove("is-active"), 480);
  };

  const destroy = () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    authStateObserver?.disconnect();
    gate.removeEventListener("pointermove", onPointerMove);
    galaxy.removeEventListener("pointerover", onGalaxyHover);
    galaxy.removeEventListener("pointerout", onGalaxyLeave);
    galaxy.removeEventListener("hh:galaxy-category-change", onGalaxySelection);
    removeEventListener("storage", onStorageNotification);
    removeEventListener("hh:galaxy-notification", onGalaxyNotification);
    sceneState?.renderer?.dispose?.();
    sceneState = null;
  };

  const onStorageNotification = (event) => {
    if (event.key !== "hh.communication.intelligence.v1") return;
    meteorToPlanet("communication", { notification: true });
  };

  const onGalaxyNotification = (event) => {
    const key = event.detail?.key || "communication";
    meteorToPlanet(key, { notification: true });
  };

  gate.addEventListener("pointermove", onPointerMove, { passive: true });
  galaxy.addEventListener("pointerover", onGalaxyHover, { passive: true });
  galaxy.addEventListener("pointerout", onGalaxyLeave, { passive: true });
  galaxy.addEventListener("hh:galaxy-category-change", onGalaxySelection);
  gate.addEventListener("hh:auth-motion-change", (event) => {
    if (sceneState?.status) sceneState.status.querySelector("span").textContent = `${event.detail?.level === "high" ? "3D CINEMATIC" : event.detail?.level === "soft" ? "3D BALANCED" : "3D STATIC"} · DỮ LIỆU THẬT`;
    galaxy.dataset.livingGalaxy = mode();
    resume();
  });
  addEventListener("storage", onStorageNotification);
  addEventListener("hh:galaxy-notification", onGalaxyNotification);
  addEventListener("hh:auth-change", (event) => {
    if (!event.detail?.user) return;
    if (sceneState) {
      sceneState.warpBoostUntil = performance.now() + 520;
      sceneState.speedTarget = 1;
      resume();
    }
    showWarp();
  });
  authStateObserver = new MutationObserver(() => {
    const nextState = gate.dataset.authGatewayState || "";
    if (nextState === lastAuthVisualState) return;
    lastAuthVisualState = nextState;
    if (nextState === "error" && sceneState) {
      sceneState.errorPulseUntil = performance.now() + 720;
      resume();
    }
  });
  authStateObserver.observe(gate, { attributes: true, attributeFilter: ["data-auth-gateway-state"] });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else resume();
  });
  addEventListener("pagehide", destroy, { once: true });

  window.HHLivingGalaxy3D = Object.freeze({ version: 2, mount: build, mode, warp: showWarp, notify: (key) => meteorToPlanet(key || "communication", { notification: true }), destroy });
  if (!mobile.matches) build();
  else galaxy.dataset.livingGalaxy = "mobile-carousel";
})();
