import * as THREE from "./vendor/three.module.min.js";
import { surfaceMaterial, cloudMaterial, ringMaterial } from "./galaxy-celestial-materials.mjs?v=4";
import { HOME } from "./auth-spiral-map.mjs?v=2";

function starField(small) {
  let seed = 14832;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(0.00001, random()))) * Math.cos(2 * Math.PI * random());
  const positions = [],
    colors = [],
    sizes = [],
    strengths = [],
    layers = [];
  const count = small ? 12500 : 32000;
  const palette = [
    [1, 0.82, 0.63],
    [1, 0.59, 0.37],
    [0.87, 0.43, 0.55],
    [0.65, 0.38, 0.96],
    [0.51, 0.42, 0.98]
  ];
  function point(x, y, z, size, color, strength, layer = 0) {
    positions.push(x, y, z);
    colors.push(...color);
    sizes.push(size);
    strengths.push(strength);
    layers.push(layer);
  }
  function arm(i, mist) {
    const r = 0.13 + Math.pow(random(), 0.82) * 5.12,
      t = r / 5.25;
    const theta =
      random() < (mist ? 0.19 : 0.13)
        ? random() * Math.PI * 2
        : ((i % 3) * 2 * Math.PI) / 3 + 0.87 * r + normal() * (0.13 + 0.1 * t);
    const spread = (0.085 + 0.16 * t) * (mist ? 1.3 : 1);
    const x = r * Math.cos(theta) + normal() * spread,
      y = r * Math.sin(theta) + normal() * spread,
      z = normal() * (0.07 + 0.15 * (1 - t));
    const band = Math.min(3.999, Math.max(0, 4.6 * t + normal() * 0.21)),
      lo = Math.floor(band),
      f = band - lo;
    const color = palette[lo].map((v, k) => v + (palette[lo + 1][k] - v) * f);
    if (!mist && random() < 0.12) color.forEach((v, k) => (color[k] = v + (0.96 - v) * 0.57));
    const lane = 0.7 + 0.3 * Math.sin(r * 6.3 + (i % 3) * 1.8 + z);
    point(
      x,
      y,
      z,
      mist ? 40 + random() * 90 : 1.5 + Math.pow(random(), 2.9) * 4.5,
      color,
      (mist ? 0.03 + random() * 0.033 : 0.29 + random() * 0.63) * Math.min(1, (1 - t) * 5 + 0.08) * lane
    );
  }
  for (let i = 0; i < count; i++) arm(i, false);
  for (let i = 0; i < count / 16; i++) arm(i, true);
  for (let i = 0; i < count / 5; i++) {
    const r = Math.pow(random(), 1.8) * 1.65,
      a = random() * Math.PI * 2;
    point(
      r * Math.cos(a),
      r * Math.sin(a),
      normal() * (0.06 + 0.12 * (1 - r / 1.65)),
      2.1 + random() * 3.8,
      [1, 0.72 + random() * 0.15, 0.53 + random() * 0.16],
      0.32 + random() * 0.5
    );
  }
  for (const [layer, n] of [
    [-1, small ? 510 : 1680],
    [1, small ? 80 : 245]
  ]) {
    for (let i = 0; i < n; i++)
      point(
        (random() - 0.5) * 2.65,
        (random() - 0.5) * 2.65,
        -1,
        layer < 0 ? 1.8 + random() * 2.1 : 2.8 + random() * 4.2,
        [0.78, 0.78 + random() * 0.13, 0.98],
        layer < 0 ? 0.36 + random() * 0.42 : 0.44 + random() * 0.45,
        layer
      );
  }
  point(0, 0, 0, 220, [1, 0.54, 0.33], 0.17);
  point(0, 0, 0, 85, [1, 0.64, 0.38], 0.51);
  point(0, 0, 0.01, 30, [1, 0.83, 0.63], 0.88);
  const geometry = new THREE.BufferGeometry();
  for (const [name, array, size] of [
    ["position", positions, 3],
    ["starColor", colors, 3],
    ["size", sizes, 1],
    ["strength", strengths, 1],
    ["layer", layers, 1]
  ])
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, size));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelScale: { value: 1 },
      clock: { value: 0 },
      discLight: { value: 1 },
      parallax: { value: new THREE.Vector2() }
    },
    transparent: true,
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    vertexShader: `attribute vec3 starColor; attribute float size,strength,layer;
uniform float pixelScale,clock,discLight; uniform vec2 parallax;
varying vec3 tint; varying float power;
void main(){
  tint=starColor; power=strength;
  if(abs(layer)>.5){
    float drift=layer<0.?.018:.23;
    gl_Position=vec4(position.xy+parallax*drift,.94,1.);
    gl_PointSize=max(1.,size*pixelScale); return;
  }
  float r=length(position.xy);
  float angle=clock*(.019+.022/(1.+r*.68));
  float c=cos(angle),s=sin(angle);
  vec4 mv=modelViewMatrix*vec4(mat2(c,s,-s,c)*position.xy,position.z,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=max(1.,size*pixelScale*clamp(40./-mv.z,.78,1.32));
  power*=discLight;
}`,
    fragmentShader: `varying vec3 tint; varying float power;
void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>=1.)discard;
float a=(exp(-6.5*r)-.00150)*power;gl_FragColor=vec4(tint*a,a);}`
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -10;
  return points;
}

export function createSky(canvas) {
  const small =
    matchMedia("(max-width: 850px)").matches ||
    navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !small,
    powerPreference: "low-power"
  });
  renderer.setClearColor(0x000000, 0);
  // One GPU context, with a full-screen sky and a second, clipped pass for
  // the planets. The latter shares its CSS-pixel viewport with the DOM map.
  renderer.autoClear = false;
  const galaxy = new THREE.Scene();
  const roll = new THREE.Matrix4();
  const stars = starField(small);
  stars.matrixAutoUpdate = false;
  galaxy.add(stars);
  const world = new THREE.Scene();
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  world.add(root);
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 100);
  camera.position.z = 40;
  const sphere = new THREE.SphereGeometry(1, small ? 28 : 38, small ? 18 : 24);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xc0bbc4 });
  const systems = new Map();
  function ensureSystem(system) {
    if (systems.has(system.id)) return systems.get(system.id);
    const light = new THREE.Vector3(),
      sun = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: system.tint }));
    root.add(sun);
    const planets = system.bodies.map((body, index) => {
      const mesh = new THREE.Mesh(sphere, surfaceMaterial(body, 2.27 + index * 4.73, light));
      root.add(mesh);
      if (body.id === "earth") {
        const clouds = new THREE.Mesh(sphere, cloudMaterial(11.3, light));
        clouds.scale.setScalar(1.025);
        mesh.add(clouds);
      }
      let ring = null;
      if (body.ring) {
        ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 2.26, 72), ringMaterial("#e4cba2", 1.32, 2.26, light));
        ring.rotation.set(0.88, -0.16, -0.3);
        mesh.add(ring);
      }
      const moon = body.moon ? new THREE.Mesh(sphere, moonMaterial) : null;
      if (moon) root.add(moon);
      return { mesh, moon, ring };
    });
    const group = { sun, light, planets };
    systems.set(system.id, group);
    return group;
  }
  function resize(width, height) {
    const budget = small ? 1250000 : 3200000;
    const ratio = Math.min(devicePixelRatio || 1, small ? 1.5 : 2, Math.sqrt(budget / (width * height)));
    renderer.setDrawingBufferSize(width, height, ratio);
  }
  function project(left, right, top, bottom) {
    Object.assign(camera, { left, right, top, bottom });
    camera.updateProjectionMatrix();
  }
  function render(state, fr, list, surface, sky) {
    const a = fr.axes,
      c = state.camera;
    const { width, height, map } = surface;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear();
    // The galaxy has its own wide framing even at minimum exploration zoom.
    project(-sky.x / sky.scale, (width - sky.x) / sky.scale, sky.y / sky.scale, (sky.y - height) / sky.scale);
    stars.matrix.set(a[0], a[1], a[2], 0, a[3], a[4], a[5], 0, a[6], a[7], a[8], 0, 0, 0, 0, 1);
    stars.matrix.premultiply(roll.makeRotationZ(sky.roll));
    stars.matrixWorldNeedsUpdate = true;
    const uniforms = stars.material.uniforms;
    uniforms.clock.value = state.elapsed;
    uniforms.discLight.value = sky.light;
    uniforms.pixelScale.value =
      renderer.getPixelRatio() * Math.max(0.86, Math.min(1.65, Math.sqrt((width * height) / 740000)));
    uniforms.parallax.value.set(
      Math.sin(c.yaw - HOME.yaw) + Math.tanh(fr.offsetX * 0.22),
      Math.sin(c.tilt - HOME.tilt) + Math.tanh(fr.offsetY * 0.22)
    );
    renderer.render(galaxy, camera);

    if (!map.visible || !list.some((entry) => entry.opacity > 0.015)) return;
    renderer.setViewport(map.left, map.bottom, map.width, map.height);
    renderer.setScissor(map.left, map.bottom, map.width, map.height);
    renderer.setScissorTest(true);
    const halfWidth = fr.width / (2 * fr.scale),
      halfHeight = fr.height / (2 * fr.scale);
    project(-halfWidth, halfWidth, halfHeight, -halfHeight);
    root.matrix.set(a[0], a[1], a[2], fr.offsetX, a[3], a[4], a[5], fr.offsetY, a[6], a[7], a[8], 0, 0, 0, 0, 1);
    root.matrixWorldNeedsUpdate = true;
    root.updateMatrixWorld(true);
    for (const entry of list) {
      // System beacons are DOM targets in the overview; detailed materials compile on approach.
      if (!systems.has(entry.system.id) && entry.opacity < 0.015) continue;
      const g = ensureSystem(entry.system),
        visible = entry.opacity > 0.015;
      if (!visible && !g.sun.visible) continue;
      g.sun.visible = visible;
      g.sun.position.fromArray(entry.pos);
      g.sun.scale.setScalar(Math.max(0.055, Math.min(0.12, 10 / fr.scale)));
      g.light.copy(g.sun.position).applyMatrix4(root.matrixWorld);
      entry.planets.forEach((p, i) => {
        const { mesh, moon, ring } = g.planets[i];
        mesh.visible = visible;
        if (moon) moon.visible = visible;
        if (!visible) return;
        mesh.position.fromArray(p.p);
        mesh.scale.setScalar(p.radius / fr.scale);
        mesh.rotation.y = state.elapsed * 0.048 + i * 0.77;
        mesh.material.uniforms.selected.value =
          state.pointed === p.body.id || state.selected === p.body.id ? 1 : 0;
        mesh.material.uniforms.time.value = state.elapsed;
        if (p.body.ring) mesh.rotation.y = 0.22;
        if (ring) {
          ring.material.uniforms.center.value.copy(mesh.position).applyMatrix4(root.matrixWorld);
          ring.material.uniforms.radius.value = mesh.scale.x;
        }
        if (moon) {
          moon.position.fromArray(p.moon);
          moon.scale.setScalar(Math.max(1.6 / fr.scale, mesh.scale.x * 0.24));
        }
      });
    }
    renderer.render(world, camera);
  }
  function dispose(loseContext) {
    const geometries = new Set([sphere, stars.geometry]),
      materials = new Set([moonMaterial, stars.material]);
    world.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) materials.add(node.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    systems.clear();
    renderer.dispose();
    if (loseContext) renderer.forceContextLoss();
  }
  return { resize, render, dispose };
}
