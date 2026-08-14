(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  const galaxy = gate?.querySelector("[data-hh-galaxy]");
  if (!gate || !galaxy) return;

  const THREE_URL = "./vendor/three.module.min.js";
  const ORBIT_TAU = Math.PI * 2;
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
      home: ["home"], character: ["character-3d", "avatar"], social: ["social-media-tools", "social"], system: ["system", "settings"], creative: ["create", "ai"], music: ["music-ai"], tools: ["davinci-resolve", "youtube", "facebook", "tiktok"],
      comicMotion: ["comic-motion"], comicReader: ["comic-reader"], media: ["media-design", "video", "photo"], graphic: ["graphic"], dev: ["dev", "api", "git"], work: ["work", "project"],
      communication: ["communication", "messenger", "community"], entertainment: ["game", "entertainment", "astra"],
      cinema: ["cinema", "film"], musicLibrary: ["/music", "open-music"], copyright: ["copyright", "rights"], analytics: ["analytics", "insight"], learning: ["learn", "lesson"], english: ["english"], japanese: ["japanese"], support: ["support", "donat"]
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

  const canvasTexture = (THREE, canvas, srgb = false) => {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = mode() === "cinematic" ? 4 : 2;
    return texture;
  };

  const makePlanetSurface = (THREE, index, model, primary, secondary) => {
    const size = mode() === "cinematic" ? 384 : 256;
    const makeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      return canvas;
    };
    const colorCanvas = makeCanvas();
    const bumpCanvas = makeCanvas();
    const roughnessCanvas = makeCanvas();
    const cloudCanvas = makeCanvas();
    const emissiveCanvas = makeCanvas();
    const color = colorCanvas.getContext("2d");
    const bump = bumpCanvas.getContext("2d");
    const roughness = roughnessCanvas.getContext("2d");
    const clouds = cloudCanvas.getContext("2d");
    const emissive = emissiveCanvas.getContext("2d");
    let seed = (index + 11) * 104729 + model.length * 7919;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    const ellipse = (context, x, y, rx, ry, fill, alpha = 1, rotation = 0) => {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = fill;
      context.beginPath();
      context.ellipse(x, y, rx, ry, rotation, 0, ORBIT_TAU);
      context.fill();
      context.restore();
    };
    const noisyEllipses = (context, count, fillLight, fillDark, alpha = .28) => {
      for (let i = 0; i < count; i += 1) {
        ellipse(context, random() * size, random() * size, 3 + random() * size * .08, 2 + random() * size * .035, random() > .48 ? fillLight : fillDark, alpha * (.35 + random() * .65), random() * Math.PI);
      }
    };
    const base = color.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, primary);
    base.addColorStop(.5, secondary);
    base.addColorStop(1, "#01040b");
    color.fillStyle = base;
    color.fillRect(0, 0, size, size);
    bump.fillStyle = "#777";
    bump.fillRect(0, 0, size, size);
    roughness.fillStyle = "#c8c8c8";
    roughness.fillRect(0, 0, size, size);
    emissive.fillStyle = "#000";
    emissive.fillRect(0, 0, size, size);

    if (model === "gas" || model === "storm") {
      for (let y = 0; y < size; y += 9 + index % 4) {
        const band = color.createLinearGradient(0, y, size, y + 7);
        band.addColorStop(0, y % 3 ? primary : secondary);
        band.addColorStop(.38, y % 2 ? "rgba(255,255,255,.5)" : secondary);
        band.addColorStop(.72, primary);
        band.addColorStop(1, "rgba(0,0,0,.58)");
        color.save();
        color.globalAlpha = .32 + random() * .34;
        color.fillStyle = band;
        color.fillRect(0, y, size, 7 + random() * 10);
        color.restore();
        bump.fillStyle = `rgb(${90 + y % 80},${90 + y % 80},${90 + y % 80})`;
        bump.fillRect(0, y, size, 5 + random() * 8);
      }
      const storms = model === "storm" ? 4 : 1;
      for (let i = 0; i < storms; i += 1) {
        const x = size * (.24 + random() * .58);
        const y = size * (.25 + random() * .55);
        const radius = size * (.035 + random() * .055);
        ellipse(color, x, y, radius * 2.4, radius, "#f7d7bd", .68, -.15);
        ellipse(color, x, y, radius * 1.35, radius * .5, secondary, .72, -.15);
        ellipse(bump, x, y, radius * 2.4, radius, "#e6e6e6", .8, -.15);
      }
    } else if (["ocean", "forest", "terrestrial"].includes(model)) {
      color.fillStyle = model === "forest" ? "#073d49" : model === "ocean" ? "#083e7c" : "#253f56";
      color.globalAlpha = .7;
      color.fillRect(0, 0, size, size);
      color.globalAlpha = 1;
      const land = model === "forest" ? "#3f8953" : model === "ocean" ? "#7c9360" : "#9a754b";
      for (let continent = 0; continent < 18; continent += 1) {
        const x = random() * size;
        const y = size * (.14 + random() * .72);
        const radius = size * (.025 + random() * .065);
        for (let lobe = 0; lobe < 4; lobe += 1) {
          ellipse(color, x + (random() - .5) * radius * 2.6, y + (random() - .5) * radius * 1.6, radius * (.7 + random()), radius * (.45 + random() * .55), land, .7 + random() * .22, random() * Math.PI);
          ellipse(bump, x + (random() - .5) * radius * 2.4, y + (random() - .5) * radius * 1.4, radius, radius * .62, "#d0d0d0", .7, random() * Math.PI);
        }
      }
      color.fillStyle = "rgba(230,245,255,.78)";
      color.fillRect(0, 0, size, size * .045);
      color.fillRect(0, size * .955, size, size * .045);
      for (let i = 0; i < 42; i += 1) {
        ellipse(clouds, random() * size, size * (.08 + random() * .84), size * (.018 + random() * .055), size * (.007 + random() * .018), "#fff", .12 + random() * .34, random() * .4 - .2);
      }
    } else if (model === "ice") {
      const ice = color.createLinearGradient(0, 0, 0, size);
      ice.addColorStop(0, "#f2fbff");
      ice.addColorStop(.48, primary);
      ice.addColorStop(1, "#153b71");
      color.fillStyle = ice;
      color.globalAlpha = .86;
      color.fillRect(0, 0, size, size);
      color.globalAlpha = 1;
      for (let i = 0; i < 44; i += 1) {
        const x = random() * size;
        let y = random() * size;
        color.strokeStyle = random() > .5 ? "rgba(255,255,255,.58)" : "rgba(7,42,93,.55)";
        bump.strokeStyle = random() > .5 ? "#e7e7e7" : "#393939";
        color.lineWidth = bump.lineWidth = 1 + random() * 2.2;
        color.beginPath(); bump.beginPath(); color.moveTo(x, y); bump.moveTo(x, y);
        for (let step = 0; step < 4; step += 1) {
          y += 5 + random() * 18;
          const nextX = x + (random() - .5) * 35;
          color.lineTo(nextX, y); bump.lineTo(nextX, y);
        }
        color.stroke(); bump.stroke();
      }
    } else if (model === "lava" || model === "volcanic") {
      color.fillStyle = model === "lava" ? "#16080b" : "#171a20";
      color.globalAlpha = .9;
      color.fillRect(0, 0, size, size);
      color.globalAlpha = 1;
      noisyEllipses(color, 110, "#5a3031", "#050608", .45);
      for (let i = 0; i < (model === "lava" ? 54 : 27); i += 1) {
        let x = random() * size;
        let y = random() * size;
        color.strokeStyle = i % 3 ? "#ff6a18" : "#ffd45a";
        emissive.strokeStyle = i % 3 ? "#ff6a18" : "#fff0a0";
        bump.strokeStyle = "#242424";
        color.lineWidth = emissive.lineWidth = 1 + random() * 2.8;
        bump.lineWidth = color.lineWidth + 1;
        color.beginPath(); emissive.beginPath(); bump.beginPath();
        color.moveTo(x, y); emissive.moveTo(x, y); bump.moveTo(x, y);
        for (let step = 0; step < 5; step += 1) {
          x += (random() - .5) * 25;
          y += 4 + random() * 17;
          color.lineTo(x, y); emissive.lineTo(x, y); bump.lineTo(x, y);
        }
        color.stroke(); emissive.stroke(); bump.stroke();
      }
    } else if (model === "desert") {
      color.fillStyle = "#9d6632";
      color.globalAlpha = .74;
      color.fillRect(0, 0, size, size);
      color.globalAlpha = 1;
      for (let y = 12; y < size; y += 18) {
        color.strokeStyle = y % 4 ? "rgba(255,219,143,.42)" : "rgba(72,31,15,.42)";
        bump.strokeStyle = y % 4 ? "#bdbdbd" : "#676767";
        color.lineWidth = bump.lineWidth = 2 + random() * 3;
        color.beginPath(); bump.beginPath(); color.moveTo(0, y); bump.moveTo(0, y);
        color.bezierCurveTo(size * .28, y - 12, size * .65, y + 14, size, y - 3);
        bump.bezierCurveTo(size * .28, y - 12, size * .65, y + 14, size, y - 3);
        color.stroke(); bump.stroke();
      }
      for (let i = 0; i < 26; i += 1) {
        const radius = 3 + random() * 13;
        ellipse(color, random() * size, random() * size, radius, radius * .55, "#3c2015", .3, random() * Math.PI);
      }
    } else if (model === "metal") {
      color.fillStyle = "#243044";
      color.globalAlpha = .82;
      color.fillRect(0, 0, size, size);
      color.globalAlpha = 1;
      for (let x = 0; x < size; x += size / 8) {
        for (let y = 0; y < size; y += size / 8) {
          color.strokeStyle = "rgba(205,238,255,.32)";
          color.strokeRect(x + 2, y + 2, size / 8 - 4, size / 8 - 4);
          bump.strokeStyle = "#dedede";
          bump.strokeRect(x + 2, y + 2, size / 8 - 4, size / 8 - 4);
          if (random() > .62) ellipse(color, x + size / 16, y + size / 16, 2.2, 2.2, primary, .85);
        }
      }
    } else if (model === "crystal") {
      color.fillStyle = "#101028";
      color.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 6 + random() * 24;
        color.fillStyle = random() > .5 ? primary : secondary;
        color.globalAlpha = .18 + random() * .45;
        color.beginPath();
        color.moveTo(x, y - radius);
        color.lineTo(x + radius * .72, y);
        color.lineTo(x, y + radius);
        color.lineTo(x - radius * .72, y);
        color.closePath(); color.fill();
        bump.fillStyle = random() > .5 ? "#efefef" : "#4b4b4b";
        bump.globalAlpha = .7; bump.fill();
      }
      color.globalAlpha = 1; bump.globalAlpha = 1;
    } else {
      noisyEllipses(color, 120, "#d5d7d2", "#071019", .32);
      noisyEllipses(bump, 120, "#dedede", "#424242", .42);
    }

    if (!["gas", "storm", "metal", "crystal"].includes(model)) noisyEllipses(color, 52, "#fff", "#000", .1);
    noisyEllipses(roughness, 72, "#eee", "#777", .32);
    const hasClouds = ["ocean", "forest", "terrestrial"].includes(model);
    const hasEmission = ["lava", "volcanic"].includes(model);
    return {
      map: canvasTexture(THREE, colorCanvas, true),
      bumpMap: canvasTexture(THREE, bumpCanvas),
      roughnessMap: canvasTexture(THREE, roughnessCanvas),
      cloudMap: hasClouds ? canvasTexture(THREE, cloudCanvas, true) : null,
      emissiveMap: hasEmission ? canvasTexture(THREE, emissiveCanvas, true) : null,
      roughness: model === "metal" ? .28 : model === "crystal" ? .34 : model === "ice" ? .46 : .72,
      metalness: model === "metal" ? .78 : model === "crystal" ? .22 : .015,
      bumpScale: model === "gas" || model === "storm" ? .12 : model === "metal" ? .34 : .62
    };
  };

  const makeRingTexture = (THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    context.translate(256, 256);
    for (let radius = 128; radius < 252; radius += 3) {
      const alpha = .05 + ((radius * 17) % 31) / 100;
      context.strokeStyle = `rgba(235,226,205,${alpha})`;
      context.lineWidth = radius % 11 === 0 ? 2.2 : 1;
      context.beginPath(); context.arc(0, 0, radius, 0, ORBIT_TAU); context.stroke();
    }
    return canvasTexture(THREE, canvas, true);
  };

  const makeMoonTexture = (THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 160, 160);
    gradient.addColorStop(0, "#d8dde1"); gradient.addColorStop(1, "#4f5660");
    context.fillStyle = gradient; context.fillRect(0, 0, 160, 160);
    let seed = 8273;
    for (let i = 0; i < 48; i += 1) {
      seed = seed * 16807 % 2147483647;
      const x = seed % 160;
      seed = seed * 16807 % 2147483647;
      const y = seed % 160;
      const radius = 2 + seed % 12;
      context.fillStyle = "rgba(28,34,41,.28)";
      context.beginPath(); context.ellipse(x, y, radius, radius * .62, 0, 0, ORBIT_TAU); context.fill();
    }
    return canvasTexture(THREE, canvas, true);
  };

  const makeSunTexture = (THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    const base = context.createLinearGradient(0, 0, 512, 512);
    base.addColorStop(0, "#ffd864"); base.addColorStop(.46, "#ff8b21"); base.addColorStop(1, "#b51f12");
    context.fillStyle = base; context.fillRect(0, 0, 512, 512);
    let seed = 15485863;
    for (let i = 0; i < 960; i += 1) {
      seed = seed * 48271 % 2147483647;
      const x = seed % 512;
      seed = seed * 48271 % 2147483647;
      const y = seed % 512;
      const radius = 1 + seed % 6;
      context.fillStyle = i % 8 ? "rgba(255,239,138,.15)" : "rgba(112,20,8,.2)";
      context.beginPath(); context.ellipse(x, y, radius * 1.28, radius * .72, (seed % 100) / 100 * Math.PI, 0, ORBIT_TAU); context.fill();
    }
    for (let i = 0; i < 24; i += 1) {
      seed = seed * 48271 % 2147483647;
      const x = seed % 512;
      seed = seed * 48271 % 2147483647;
      const y = 36 + seed % 440;
      const radius = 3 + seed % 10;
      context.fillStyle = "rgba(83,12,10,.42)";
      context.beginPath(); context.ellipse(x, y, radius * 1.8, radius * .68, -.18, 0, ORBIT_TAU); context.fill();
      context.strokeStyle = "rgba(255,209,79,.22)";
      context.lineWidth = 2;
      context.beginPath(); context.ellipse(x, y, radius * 2.5, radius * 1.15, -.18, 0, ORBIT_TAU); context.stroke();
    }
    return canvasTexture(THREE, canvas, true);
  };

  const createAtmosphereMaterial = (THREE, color) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: .22 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vViewDirection)), 2.35);
        gl_FragColor = vec4(uColor, fresnel * uIntensity);
      }
    `
  });

  const createSunSurfaceMaterial = (THREE) => new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: makeSunTexture(THREE) },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        vec2 plasmaUv = vUv;
        plasmaUv.x = fract(plasmaUv.x + uTime * 0.008 + sin(vUv.y * 42.0 + uTime * 0.7) * 0.009);
        plasmaUv.y = fract(plasmaUv.y + sin(vUv.x * 31.0 - uTime * 0.55) * 0.006);
        vec3 surface = texture2D(uMap, plasmaUv).rgb;
        float cells = sin((vUv.x + vUv.y) * 92.0 + uTime * 1.4) * sin(vUv.y * 117.0 - uTime) * 0.075;
        float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
        float limb = 0.34 + pow(facing, 0.38) * 0.86;
        float hotCore = pow(facing, 2.4) * 0.44;
        float flare = pow(1.0 - facing, 3.2) * 0.34;
        vec3 color = surface * (limb + cells) + vec3(1.0, 0.62, 0.14) * hotCore + vec3(1.0, 0.22, 0.015) * flare;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const createSolarCorona = (THREE, root) => {
    const count = mode() === "cinematic" ? 420 : 180;
    const positions = new Float32Array(count * 3);
    let seed = 67867967;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * ORBIT_TAU;
      const radius = 58 + random() * 14;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius;
      positions[index * 3 + 2] = (random() - .5) * 13;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffb14a, size: mode() === "cinematic" ? 1.7 : 1.25, transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending });
    const corona = new THREE.Points(geometry, material);
    root.add(corona);
    return corona;
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

  const createAsteroidBelt = (THREE, root, radius, count, color, seedOffset = 0) => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    let seed = 32452843 + seedOffset * 49999;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * ORBIT_TAU;
      const spread = radius + (random() - .5) * 21;
      positions[index * 3] = Math.cos(angle) * spread;
      positions[index * 3 + 1] = Math.sin(angle) * spread * .46;
      positions[index * 3 + 2] = (random() - .5) * 17;
      sizes[index] = .55 + random() * 1.65;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({ color, size: 1.45, transparent: true, opacity: .48, depthWrite: false, sizeAttenuation: true });
    const belt = new THREE.Points(geometry, material);
    belt.rotation.set(.08, -.05, .19 + seedOffset * .07);
    root.add(belt);
    return belt;
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
      const meteorLayer = document.createElement("div");
      meteorLayer.className = "hh-living-meteor-layer";
      meteorLayer.setAttribute("aria-hidden", "true");
      galaxy.prepend(depth, canvas, meteorLayer, status);

      const hitLayer = document.createElement("div");
      hitLayer.className = "hh-living-galaxy-hitlayer";
      planetButtons.forEach((button) => hitLayer.append(button));
      galaxy.append(hitLayer);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: mode() === "cinematic", powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x02040d, .00072);
      const camera = new THREE.PerspectiveCamera(46, 1, .1, 1500);
      camera.position.set(0, 20, 665);
      scene.add(new THREE.AmbientLight(0x385377, .46));
      scene.add(new THREE.HemisphereLight(0xbceeff, 0x170822, .86));
      const keyLight = new THREE.DirectionalLight(0xfff4e8, 3.15);
      keyLight.position.set(-180, 220, 340);
      scene.add(keyLight);
      const sunLight = new THREE.PointLight(0xffc68b, 2350, 920, 1.25);
      sunLight.position.set(0, 0, 35);
      scene.add(sunLight);

      const root = new THREE.Group();
      root.rotation.x = -.12;
      scene.add(root);
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(51, mode() === "cinematic" ? 64 : 36, mode() === "cinematic" ? 48 : 24),
        createSunSurfaceMaterial(THREE)
      );
      root.add(sun);
      const sunShell = new THREE.Mesh(new THREE.SphereGeometry(56, 48, 28), createAtmosphereMaterial(THREE, "#ff9e46"));
      sunShell.material.uniforms.uIntensity.value = .96;
      sunShell.renderOrder = 4;
      root.add(sunShell);
      const solarCorona = createSolarCorona(THREE, root);
      const solarFlares = new THREE.Group();
      for (let index = 0; index < (mode() === "cinematic" ? 5 : 3); index += 1) {
        const flare = new THREE.Mesh(
          new THREE.TorusGeometry(55 + index * 1.7, .88 + index * .13, 7, 72, Math.PI * (.34 + index * .09)),
          new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffd478 : 0xff6236, transparent: true, opacity: .56 - index * .045, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        flare.rotation.set(.34 + index * .56, .22 + index * .41, index * 1.21);
        solarFlares.add(flare);
      }
      root.add(solarFlares);
      const glowTexture = makeRadialTexture(THREE, [[0,"rgba(255,250,205,.95)"],[.13,"rgba(255,183,69,.82)"],[.36,"rgba(255,78,45,.31)"],[.68,"rgba(220,50,126,.1)"],[1,"rgba(0,0,0,0)"]]);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(224, 224, 1);
      glow.position.z = -8;
      root.add(glow);
      for (let index = 0; index < 2; index += 1) {
        const magneticRing = new THREE.Mesh(new THREE.TorusGeometry(70 + index * 13, .26 + index * .09, 7, 128), new THREE.MeshBasicMaterial({ color: [0xffb66b,0xff6ba8][index], transparent: true, opacity: .18 - index * .035, blending: THREE.AdditiveBlending }));
        magneticRing.rotation.set(1.13 + index * .16, .15, index * .86);
        root.add(magneticRing);
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
      const ringTexture = makeRingTexture(THREE);
      const moonTexture = makeMoonTexture(THREE);
      const asteroidBelts = [
        createAsteroidBelt(THREE, root, 188, mode() === "cinematic" ? 560 : 240, 0xb5c8d8, 1),
        createAsteroidBelt(THREE, root, 337, mode() === "cinematic" ? 720 : 300, 0x806f78, 2)
      ];
      const ringWorlds = new Set(["social", "creative", "music", "graphic", "cinema", "analytics"]);
      const planets = planetButtons.map((button, index) => {
        const key = button.dataset.hhGalaxyKey;
        const model = button.dataset.hhModel || "terrestrial";
        const weight = Math.max(.8, Math.min(1.8, Number(button.dataset.hhWeight) || 1));
        const popularity = Math.min(1, Math.log2(2 + (usage[key] || 0)) / 4);
        const radius = 79 + index * 10.55;
        const size = 8.2 + (weight - .8) * 10.5 + popularity * 3;
        const hitSize = Math.max(48, Math.min(76, 36 + weight * 20));
        button.style.setProperty("--planet-hit-size", `${hitSize.toFixed(1)}px`);
        button.style.setProperty("--planet-hit-half", `${(hitSize / 2).toFixed(2)}px`);
        const group = new THREE.Group();
        const surface = makePlanetSurface(THREE, index, model, accents[index], secondary[index]);
        const baseEmissiveColor = ["lava", "volcanic"].includes(model) ? accents[index] : "#050910";
        const baseEmissiveIntensity = ["lava", "volcanic"].includes(model) ? .76 : .11;
        const material = new THREE.MeshStandardMaterial({
          map: surface.map,
          bumpMap: surface.bumpMap,
          bumpScale: surface.bumpScale,
          roughnessMap: surface.roughnessMap,
          roughness: surface.roughness,
          metalness: surface.metalness,
          emissive: new THREE.Color(baseEmissiveColor),
          emissiveMap: surface.emissiveMap,
          emissiveIntensity: baseEmissiveIntensity
        });
        const sphereGeometry = new THREE.SphereGeometry(size, mode() === "cinematic" ? 40 : 24, mode() === "cinematic" ? 28 : 16);
        const mesh = new THREE.Mesh(sphereGeometry, material);
        mesh.rotation.z = (index % 7 - 3) * .055;
        group.add(mesh);
        const clouds = surface.cloudMap ? new THREE.Mesh(
          sphereGeometry,
          new THREE.MeshStandardMaterial({ map: surface.cloudMap, transparent: true, opacity: .62, alphaTest: .025, depthWrite: false, roughness: 1, metalness: 0 })
        ) : null;
        if (clouds) {
          clouds.scale.setScalar(1.018);
          clouds.rotation.z = -.06 + index % 4 * .03;
          group.add(clouds);
        }
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(size * 1.095, 28, 20), createAtmosphereMaterial(THREE, accents[index]));
        group.add(atmosphere);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetGlowTexture, color: accents[index], transparent: true, opacity: .52, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(size * 4.45, size * 4.45, 1);
        halo.position.z = -size * .55;
        group.add(halo);
        let planetaryRing = null;
        if (ringWorlds.has(key)) {
          planetaryRing = new THREE.Mesh(
            new THREE.RingGeometry(size * 1.28, size * 2.05, mode() === "cinematic" ? 112 : 64, 4),
            new THREE.MeshBasicMaterial({ map: ringTexture, color: accents[index], transparent: true, opacity: .48, side: THREE.DoubleSide, depthWrite: false, alphaTest: .018 })
          );
          planetaryRing.rotation.set(1.08 + index % 3 * .11, .14 + index % 2 * .09, index * .13);
          group.add(planetaryRing);
        }
        const moonPivots = [];
        if (mode() === "cinematic" && (weight >= 1.4 || index % 8 === 0)) {
          const moonPivot = new THREE.Group();
          moonPivot.rotation.set(.38 + index % 3 * .16, .1, index * .62);
          const moon = new THREE.Mesh(
            new THREE.SphereGeometry(size * (.17 + index % 2 * .04), 18, 12),
            new THREE.MeshStandardMaterial({ map: moonTexture, bumpMap: moonTexture, bumpScale: .18, color: 0xdde1e3, roughness: .93 })
          );
          moon.position.x = size * (2.15 + index % 3 * .24);
          moonPivot.add(moon);
          group.add(moonPivot);
          moonPivots.push(moonPivot);
        }
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
        return { button, key, model, weight, accent: accents[index], group, mesh, clouds, moonPivots, planetaryRing, material, baseEmissiveColor, baseEmissiveIntensity, atmosphere, halo, orbit, orbitMaterial, baseOrbitOpacity, radius, eccentricity, tilt, size, orbitAngle: index * 2.399963 + (index % 3) * .31, speed: .035 / Math.sqrt(radius / 82), popularity, energy, position: new THREE.Vector3(), scaleVector: new THREE.Vector3(1, 1, 1) };
      });

      sceneState = {
        THREE, canvas, renderer, scene, camera, root, sun, sunShell, solarCorona, solarFlares, glow, starFar, starNear, nebula, asteroidBelts, planets, status, meteorLayer,
        meteorGlowTexture, meteorTailTexture, meteors: [], meteorSerial: 0, nextMeteorAt: 2.8, nextShowerAt: 24 + Math.random() * 10, showerQueue: [],
        warpBoostUntil: 0, errorPulseUntil: 0,
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
        camera.position.z = camera.aspect < .86 ? 785 : camera.aspect < 1.18 ? 725 : 665;
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
    galaxy.dataset.orbitSpeed = currentMode === "static" ? "0.00" : "1.00";
    const targetX = finePointer.matches ? pointer.x * 22 : 0;
    const targetY = finePointer.matches ? pointer.y * 14 : 0;
    state.camera.position.x += (targetX - state.camera.position.x) * Math.min(1, delta * 2.8);
    state.camera.position.y += (20 - targetY - state.camera.position.y) * Math.min(1, delta * 2.8);
    state.camera.lookAt(pointer.x * 5, pointer.y * -4, 0);
    state.root.rotation.z = Math.sin(elapsed * .08) * .016 + errorPulse;
    state.sun.rotation.y += delta * .11;
    state.sun.material.uniforms.uTime.value = elapsed;
    state.sunShell.scale.setScalar(1 + Math.sin(elapsed * 1.7) * .016);
    state.solarCorona.rotation.z = elapsed * .035;
    state.solarCorona.material.opacity = .5 + Math.sin(elapsed * 1.85) * .12;
    state.solarFlares.rotation.y = elapsed * .022;
    state.solarFlares.rotation.z = -elapsed * .013;
    state.glow.material.rotation = elapsed * .018;
    state.glow.scale.setScalar(224 + Math.sin(elapsed * 1.3) * 7);
    state.starFar.rotation.y = elapsed * .003;
    state.starNear.rotation.y = -elapsed * .008;
    state.asteroidBelts.forEach((belt, index) => { belt.rotation.z += delta * (index ? -.006 : .009); });
    state.nebula.position.x = -70 + pointer.x * 24;
    state.nebula.position.y = -10 - pointer.y * 17;
    const canvasRect = state.canvas.getBoundingClientRect();
    const vector = state.projectionVector;
    const detailLimit = currentMode === "cinematic" ? 11 : 6;
    galaxy.dataset.orbitDetailCount = String(detailLimit);
    state.planets.forEach((planet, index) => {
      if (currentMode !== "static") planet.orbitAngle = (planet.orbitAngle + delta * planet.speed * warpBoost) % ORBIT_TAU;
      const angle = planet.orbitAngle;
      orbitPosition(state.THREE, planet, angle, planet.position);
      planet.group.position.copy(planet.position);
      const depth = Math.max(-1, Math.min(1, planet.position.z / Math.max(1, planet.radius * .35)));
      planet.mesh.rotation.y += delta * (.08 + index % 5 * .015);
      if (planet.clouds) planet.clouds.rotation.y += delta * (.105 + index % 3 * .012);
      planet.moonPivots.forEach((pivot, moonIndex) => { pivot.rotation.y += delta * (.32 + moonIndex * .08); });
      if (planet.planetaryRing) planet.planetaryRing.rotation.z += delta * .012;
      planet.group.children.forEach((child) => {
        if (!child.userData.signal) return;
        child.rotation.z += delta * .72;
        const signalPulse = 1 + Math.sin(elapsed * 3.2 + index) * .08;
        child.scale.setScalar(signalPulse);
        child.material.opacity = .58 + Math.sin(elapsed * 3.2 + index) * .2;
      });
      const selected = selectedKey === planet.key;
      const scale = selected ? 1.27 : 1;
      planet.scaleVector.setScalar(scale);
      planet.group.scale.lerp(planet.scaleVector, Math.min(1, delta * 8));
      planet.material.emissive.set(selected ? planet.accent : planet.baseEmissiveColor);
      planet.material.emissiveIntensity = selected ? Math.max(.38, planet.baseEmissiveIntensity + .2) : planet.baseEmissiveIntensity;
      planet.atmosphere.material.uniforms.uIntensity.value = selected ? .62 : .2 + (depth + 1) * .045;
      planet.halo.material.opacity = selected ? .66 : .18 + (depth + 1) * .07;
      if (planet.clouds) planet.clouds.material.opacity = selected ? .78 : .48 + (depth + 1) * .06;
      if (planet.planetaryRing) planet.planetaryRing.material.opacity = selected ? .72 : .38 + (depth + 1) * .035;
      const detailed = index < detailLimit || selected;
      const orbitTarget = selected ? .46 : (detailed ? planet.baseOrbitOpacity * 1.8 : planet.baseOrbitOpacity * .65);
      planet.orbitMaterial.uniforms.uOpacity.value += (orbitTarget - planet.orbitMaterial.uniforms.uOpacity.value) * Math.min(1, delta * 7);
      planet.orbitMaterial.uniforms.uPulse.value = selected ? .28 + Math.sin(elapsed * 3.4) * .16 : (nowTime < state.errorPulseUntil ? .12 : 0);
      planet.energy.forEach((particle) => {
        const energyActive = selected ? particle.index === 0 : (index < detailLimit && (currentMode === "cinematic" || particle.index === 0));
        particle.sprite.visible = energyActive;
        if (!energyActive) return;
        if (currentMode !== "static") particle.angle = (particle.angle + delta * particle.speed * warpBoost) % ORBIT_TAU;
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
      planet.button.style.setProperty("--planet-depth-opacity", String(Math.max(.62, Math.min(1, .8 + depth * .16))));
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

  const onGalaxySelection = (event) => {
    if (!event.detail?.pinned || !event.detail?.key) return;
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

  window.HHLivingGalaxy3D = Object.freeze({ version: 3, mount: build, mode, warp: showWarp, notify: (key) => meteorToPlanet(key || "communication", { notification: true }), destroy });
  if (!mobile.matches) build();
  else galaxy.dataset.livingGalaxy = "mobile-carousel";
})();
