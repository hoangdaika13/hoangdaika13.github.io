(function (global) {
  "use strict";

  let threePromise = null;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
  const smooth = (current, target, speed, delta) => current + (target - current) * (1 - Math.exp(-speed * delta));

  async function loadThree() {
    threePromise ||= import("../vendor/three.module.min.js");
    return threePromise;
  }

  async function mount(host, options = {}) {
    if (!host || !global.WebGLRenderingContext) throw new Error("WebGL khÃ´ng kháº£ dá»¥ng.");
    const THREE = await loadThree();
    const canvas = document.createElement("canvas");
    canvas.className = "hva-3d-canvas";
    canvas.setAttribute("aria-label", "NhÃ¢n váº­t Hikari H 3D nguyÃªn báº£n");
    host.prepend(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: options.quality !== "static", powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
    camera.position.set(0, 1.72, 5.25);
    camera.lookAt(0, 1.56, 0);

    const world = new THREE.Group();
    const avatar = new THREE.Group();
    world.add(avatar); scene.add(world);
    avatar.position.y = -.62;

    const skin = new THREE.MeshPhysicalMaterial({ color: 0xf3c8b8, roughness: .58, metalness: 0, clearcoat: .12 });
    const skinShade = new THREE.MeshPhysicalMaterial({ color: 0xd99b91, roughness: .62 });
    const suit = new THREE.MeshPhysicalMaterial({ color: 0x17233d, roughness: .3, metalness: .36, clearcoat: .55 });
    const suitDark = new THREE.MeshPhysicalMaterial({ color: 0x070d18, roughness: .34, metalness: .45 });
    const white = new THREE.MeshPhysicalMaterial({ color: 0xe9f2f5, roughness: .35, metalness: .18 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x34cbe9, emissive: 0x1288aa, emissiveIntensity: 2.1, roughness: .28 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff355f, emissive: 0xb40c32, emissiveIntensity: 1.7, roughness: .3 });
    const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x101729, roughness: .3, metalness: .12, clearcoat: .45 });
    const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .18, clearcoat: .8 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x5eeaff, emissive: 0x1b8ea8, emissiveIntensity: 1.35 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7c243b, roughness: .7 });

    const mesh = (geometry, material, parent, position, scale, rotation) => {
      const item = new THREE.Mesh(geometry, material);
      item.position.set(...(position || [0, 0, 0]));
      item.scale.set(...(scale || [1, 1, 1]));
      item.rotation.set(...(rotation || [0, 0, 0]));
      item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
    };
    const group = (parent, position) => { const item = new THREE.Group(); item.position.set(...position); parent.add(item); return item; };
    const sphere = new THREE.SphereGeometry(1, options.quality === "cinematic" ? 40 : 26, options.quality === "cinematic" ? 28 : 20);
    const capsule = (radius, length) => new THREE.CapsuleGeometry(radius, length, 8, 18);

    const hips = group(avatar, [0, 1.15, 0]);
    mesh(sphere, suitDark, hips, [0, 0, 0], [.29, .2, .2]);
    const spine = group(hips, [0, .18, 0]);
    mesh(new THREE.CylinderGeometry(.25, .19, .48, 28), suit, spine, [0, .29, 0], [1, 1, .72]);
    mesh(new THREE.TorusGeometry(.175, .012, 8, 38), cyan, spine, [0, .29, .19], [1, .72, 1], [0, 0, 0]);
    const chest = group(spine, [0, .52, 0]);
    mesh(new THREE.CylinderGeometry(.34, .235, .38, 28), white, chest, [0, .02, 0], [1, 1, .68]);
    mesh(sphere, white, chest, [0, -.08, .02], [.235, .15, .18]);
    mesh(new THREE.CircleGeometry(.08, 30), cyan, chest, [0, .03, .237], [1, 1, 1]);
    mesh(new THREE.BoxGeometry(.44, .045, .045), red, chest, [0, .15, .18], [1, 1, 1]);
    const neck = group(chest, [0, .27, 0]);
    mesh(capsule(.073, .14), skin, neck, [0, .02, 0]);
    const head = group(neck, [0, .22, 0]);
    mesh(sphere, skin, head, [0, .025, 0], [.245, .3, .245]);
    mesh(sphere, skin, head, [0, -.17, .015], [.2, .15, .205]);
    mesh(sphere, skinShade, head, [0, -.03, .232], [.045, .07, .055]);
    [-1, 1].forEach((side) => mesh(sphere, skin, head, [side * .246, 0, 0], [.045, .072, .035]));

    const eyes = [];
    [-1, 1].forEach((side) => {
      const eyePivot = group(head, [side * .09, .055, .225]);
      mesh(sphere, eyeWhite, eyePivot, [0, 0, 0], [.063, .034, .026]);
      const pupil = mesh(sphere, iris, eyePivot, [0, 0, .025], [.025, .025, .013]);
      const lid = mesh(sphere, skin, eyePivot, [0, .028, .016], [.068, .033, .026]);
      lid.scale.y = .02; eyes.push({ pivot: eyePivot, lid, pupil });
      mesh(new THREE.CapsuleGeometry(.009, .07, 4, 9), hairMat, head, [side * .09, .13, .225], [1, 1, .55], [0, 0, Math.PI / 2 + side * .08]);
    });
    const jaw = group(head, [0, -.15, .215]);
    const mouth = mesh(new THREE.CapsuleGeometry(.012, .065, 4, 12), mouthMat, jaw, [0, 0, 0], [1, .08, .4], [0, 0, Math.PI / 2]);

    mesh(sphere, hairMat, head, [0, .14, -.02], [.265, .27, .26]);
    const hairChains = [];
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 7 - .5) * 2.15;
      const root = group(head, [Math.sin(angle) * .205, .18 - Math.abs(angle) * .045, -.04 + Math.cos(angle) * .09]);
      const strand = mesh(capsule(.038, .47 + (i % 3) * .08), hairMat, root, [0, -.27, 0], [.62, 1, .55], [0, 0, angle * .18]);
      hairChains.push({ root, strand, phase: i * .73 });
    }
    const fringe = group(head, [0, .24, .18]);
    [-.14, -.07, 0, .07, .14].forEach((x, index) => mesh(capsule(.025, .2 + (index % 2) * .07), hairMat, fringe, [x, -.1, 0], [.8, 1, .55], [0, 0, x * -1.3]));

    const arms = {};
    [-1, 1].forEach((side) => {
      const upper = group(chest, [side * .32, .11, 0]);
      mesh(capsule(.075, .42), suit, upper, [side * .02, -.26, 0], [1, 1, .88], [0, 0, side * -.04]);
      const lower = group(upper, [side * .035, -.5, 0]);
      mesh(capsule(.058, .38), white, lower, [0, -.23, 0], [1, 1, .84]);
      const hand = group(lower, [0, -.47, 0]);
      mesh(sphere, skin, hand, [0, 0, 0], [.078, .12, .052]);
      for (let finger = 0; finger < 4; finger += 1) mesh(capsule(.009, .075), skin, hand, [side * (.038 - finger * .023), -.09, .016], [1, 1, .8]);
      arms[side < 0 ? "left" : "right"] = { upper, lower, hand };
    });

    const legs = {};
    [-1, 1].forEach((side) => {
      const upper = group(hips, [side * .14, -.12, 0]);
      mesh(capsule(.095, .54), suit, upper, [0, -.34, 0], [1, 1, .86]);
      const lower = group(upper, [0, -.68, 0]);
      mesh(capsule(.075, .51), suitDark, lower, [0, -.32, 0], [1, 1, .84]);
      const foot = group(lower, [0, -.63, .03]);
      mesh(capsule(.075, .22), white, foot, [0, -.02, .085], [1, 1.1, 1], [Math.PI / 2, 0, 0]);
      legs[side < 0 ? "left" : "right"] = { upper, lower, foot };
    });

    const key = new THREE.DirectionalLight(0xf5fcff, 4.1); key.position.set(2.5, 4.2, 4); key.castShadow = options.quality === "cinematic"; scene.add(key);
    const fill = new THREE.DirectionalLight(0x5bdfff, 2); fill.position.set(-3, 2, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff4776, 2.8); rim.position.set(2, 2, -3); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xbdefff, 0x140819, 1.7));
    const floor = mesh(new THREE.CircleGeometry(1.2, 56), new THREE.MeshBasicMaterial({ color: 0x03070d, transparent: true, opacity: .44 }), scene, [0, -.87, .1], [1, .32, 1], [-Math.PI / 2, 0, 0]);
    floor.receiveShadow = true;

    const animation = { state: "idle", targetState: "idle", stateTime: 0, blend: 1, viseme: 0, targetViseme: 0, lookX: 0, lookY: 0, targetLookX: 0, targetLookY: 0, blink: 0, nextBlink: 2.2 + Math.random() * 3, time: 0 };
    let quality = options.quality || "balanced";
    let disposed = false;

    function resize() {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(host.querySelector(".hva-stage")?.clientHeight || rect.height));
      const dpr = quality === "cinematic" ? Math.min(2, devicePixelRatio || 1) : quality === "balanced" ? Math.min(1.4, devicePixelRatio || 1) : 1;
      renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();

    function setState(next) {
      animation.targetState = String(next || "idle"); animation.stateTime = 0; animation.blend = 0;
    }
    function lookAt(x, y) { animation.targetLookX = clamp(x, -1, 1); animation.targetLookY = clamp(y, -1, 1); }
    function setViseme(name, value) { if (name === "aa") animation.targetViseme = clamp(value); }
    function setQuality(next) { quality = next || "balanced"; key.castShadow = quality === "cinematic"; resize(); }

    function update(delta = 1 / 60, updateOptions = {}) {
      if (disposed || (quality === "static" && updateOptions.force !== true)) return;
      const dt = Math.min(.05, Math.max(.001, delta));
      animation.time += dt; animation.stateTime += dt; animation.blend = smooth(animation.blend, 1, 7, dt);
      animation.lookX = smooth(animation.lookX, animation.targetLookX, 5, dt);
      animation.lookY = smooth(animation.lookY, animation.targetLookY, 5, dt);
      animation.viseme = smooth(animation.viseme, animation.targetViseme, 13, dt);
      if (animation.viseme > .03) animation.targetViseme *= Math.exp(-4 * dt);
      if (animation.state !== animation.targetState && animation.blend > .84) animation.state = animation.targetState;

      const t = animation.time;
      const breath = Math.sin(t * 1.45);
      const shift = Math.sin(t * .58);
      hips.position.y = 1.15 + breath * .009;
      hips.position.x = shift * .018;
      hips.rotation.z = shift * .013;
      spine.rotation.x = breath * .012;
      chest.rotation.y = shift * .025;
      head.rotation.y = animation.lookX * .22 + Math.sin(t * .31) * .025;
      head.rotation.x = animation.lookY * -.12 + Math.sin(t * .47) * .012;
      eyes.forEach(({ pivot }) => { pivot.rotation.y = animation.lookX * .16; pivot.rotation.x = animation.lookY * -.09; });

      animation.nextBlink -= dt;
      if (animation.nextBlink <= 0) { animation.blink = 1; animation.nextBlink = 2.4 + Math.random() * 4.2; }
      animation.blink = Math.max(0, animation.blink - dt * 8);
      const blinkScale = animation.blink > .45 ? .94 : .025;
      eyes.forEach(({ lid }) => { lid.scale.y = smooth(lid.scale.y, blinkScale, 24, dt); });
      jaw.rotation.x = animation.viseme * .15;
      mouth.scale.y = .08 + animation.viseme * 4.4;

      const speaking = animation.targetState === "speaking";
      const listening = animation.targetState === "listening";
      const thinking = animation.targetState === "thinking";
      const pointing = animation.targetState === "pointing";
      const greeting = animation.targetState === "greeting" || animation.targetState === "appear";
      const warning = animation.targetState === "warning";
      const sleeping = animation.targetState === "sleeping";
      const gesture = Math.sin(t * (speaking ? 3.1 : 1.2));
      arms.left.upper.rotation.z = smooth(arms.left.upper.rotation.z, speaking ? .28 + gesture * .12 : greeting ? .22 : -.04, 6, dt);
      arms.left.upper.rotation.x = smooth(arms.left.upper.rotation.x, speaking ? -.12 : listening ? -.22 : 0, 6, dt);
      arms.left.lower.rotation.x = smooth(arms.left.lower.rotation.x, speaking ? -.3 + gesture * .08 : listening ? -.55 : 0, 7, dt);
      arms.right.upper.rotation.z = smooth(arms.right.upper.rotation.z, pointing ? -1.05 : greeting ? -.72 : speaking ? -.22 + gesture * .1 : .04, 6, dt);
      arms.right.upper.rotation.x = smooth(arms.right.upper.rotation.x, pointing ? -.2 : 0, 6, dt);
      arms.right.lower.rotation.x = smooth(arms.right.lower.rotation.x, pointing ? -.34 : greeting ? -.45 : speaking ? -.25 - gesture * .1 : 0, 7, dt);
      head.rotation.z = smooth(head.rotation.z, thinking ? -.08 : warning ? Math.sin(t * 13) * .025 : 0, 7, dt);
      eyes.forEach(({ lid }) => { if (sleeping) lid.scale.y = .95; });
      hairChains.forEach(({ root, phase }, index) => {
        root.rotation.z = Math.sin(t * 1.15 + phase) * (.018 + index * .0015) - hips.rotation.z * .45;
        root.rotation.x = Math.sin(t * .82 + phase) * .016;
      });
      legs.left.upper.rotation.z = shift * .01; legs.right.upper.rotation.z = -shift * .01;
      avatar.rotation.y = smooth(avatar.rotation.y, pointing ? -.08 : animation.lookX * .025, 4, dt);
      avatar.scale.y = 1 + breath * .0025;
      cyan.emissiveIntensity = speaking || listening ? 2.8 + Math.sin(t * 5) * .4 : 2.05;
      red.emissiveIntensity = warning ? 3 + Math.sin(t * 9) : 1.7;
      renderer.render(scene, camera);
    }

    function dispose() {
      if (disposed) return; disposed = true; resizeObserver.disconnect();
      scene.traverse((item) => {
        item.geometry?.dispose?.();
        if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose?.());
        else item.material?.dispose?.();
      });
      renderer.renderLists?.dispose?.(); renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove();
    }

    renderer.render(scene, camera);
    return Object.freeze({ setState, lookAt, setViseme, update, setQuality, dispose });
  }

  global.HHCharacter3DRenderer = Object.freeze({ mount });
})(window);

