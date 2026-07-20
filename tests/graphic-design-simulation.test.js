const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-simulation.js"), "utf8");
const simulation = require("../graphic-design-simulation.js");

test("Simulation Lab exposes the UMD/global mount contract", () => {
  assert.equal(simulation.VERSION, 1);
  assert.equal(simulation.FORMAT, "hh-graphic-simulation");
  assert.equal(simulation.STORAGE_KEY, "hh.graphic-simulation.project.v1");
  assert.equal(typeof simulation.mount, "function");
  assert.equal(typeof simulation.unmount, "function");
  assert.match(source, /global\.HHGraphicSimulation = factory\(global\)/);
  assert.match(source, /\[data-graphic-simulation\]/);
  const browserLike = { globalThis: null };
  browserLike.globalThis = browserLike;
  vm.runInNewContext(source, browserLike);
  assert.equal(typeof browserLike.HHGraphicSimulation.createSimulation, "function");
});

test("all requested emitter presets have bounded production settings", () => {
  assert.deepEqual(Object.keys(simulation.PRESETS), ["fireworks", "snow", "rain", "light"]);
  Object.values(simulation.PRESETS).forEach((preset) => {
    assert.ok(preset.burst > 0);
    assert.ok(preset.life > 0);
    assert.match(preset.color, /^#[0-9a-f]{6}$/i);
  });
  const project = simulation.createDefaultProject();
  assert.equal(project.emitters[0].preset, "fireworks");
  assert.ok(project.settings.particleCap <= simulation.PERFORMANCE.MAX_PARTICLES);
});

test("seeded fixed-step physics is deterministic and resettable", () => {
  const project = simulation.createDefaultProject();
  project.settings.seed = 424242;
  project.settings.particleCap = 180;
  const first = simulation.createSimulation(project);
  const second = simulation.createSimulation(project);
  for (let index = 0; index < 120; index += 1) {
    first.stepOnce();
    second.stepOnce();
  }
  assert.deepEqual(first.getState(), second.getState());
  assert.ok(first.getState().particles.length <= 180);

  const beforeReset = first.getState();
  first.reset();
  for (let index = 0; index < 120; index += 1) first.stepOnce();
  assert.deepEqual(first.getState(), beforeReset);

  const changed = simulation.createDefaultProject();
  changed.settings.seed = 7;
  const third = simulation.createSimulation(changed);
  third.stepOnce();
  first.reset();
  first.stepOnce();
  assert.notDeepEqual(first.getState().particles[0], third.getState().particles[0]);
});

test("pause, tick, manual step and reset have explicit runtime semantics", () => {
  const engine = simulation.createSimulation(simulation.createDefaultProject());
  assert.equal(engine.isPaused(), true);
  const initialTime = engine.getState().elapsed;
  engine.tick(1 / 30);
  assert.equal(engine.getState().elapsed, initialTime);
  assert.equal(engine.play(), true);
  engine.tick(1 / 30);
  assert.ok(engine.getState().elapsed > initialTime);
  engine.pause();
  const pausedTime = engine.getState().elapsed;
  engine.tick(1 / 30);
  assert.equal(engine.getState().elapsed, pausedTime);
  engine.stepOnce();
  assert.ok(engine.getState().elapsed > pausedTime);
  engine.reset();
  assert.equal(engine.getState().elapsed, 0);
  assert.equal(engine.isPaused(), true);
});

test("gravity, bounds bounce and collision response do real work", () => {
  const project = simulation.createDefaultProject();
  project.emitters = [];
  project.constraints = [];
  project.settings.gravity = 600;
  project.settings.bounce = 1;
  const engine = simulation.createSimulation(project);
  engine.addParticle({ id: "fall", x: 100, y: 100, vx: 0, vy: 0, radius: 4, life: 5 });
  engine.stepOnce();
  assert.ok(engine.getState().particles[0].vy > 0);

  const particles = [
    { x: 50, y: 50, vx: 20, vy: 0, radius: 8, collides: true },
    { x: 61, y: 50, vx: -20, vy: 0, radius: 8, collides: true }
  ];
  const result = simulation.resolveParticleCollisions(particles, 1, 20);
  assert.equal(result.resolved, 1);
  assert.ok(particles[0].vx < 0);
  assert.ok(particles[1].vx > 0);

  const floorProject = simulation.createDefaultProject();
  floorProject.emitters = [];
  floorProject.constraints = [];
  floorProject.settings.gravity = 0;
  floorProject.settings.bounce = 0.75;
  const floorEngine = simulation.createSimulation(floorProject);
  floorEngine.addParticle({ x: 100, y: floorProject.settings.height - 2, vy: 90, radius: 4, life: 5 });
  floorEngine.stepOnce();
  assert.ok(floorEngine.getState().particles[0].vy < 0);
});

test("rope, hair and cloth constraints remain lightweight and spring-linked", () => {
  for (const type of simulation.CONSTRAINT_TYPES) {
    const body = simulation.createConstraintBody(simulation.defaultConstraint(type, 960));
    assert.equal(body.type, type);
    assert.ok(body.points.length >= 2);
    assert.ok(body.points.length <= simulation.PERFORMANCE.MAX_CONSTRAINT_POINTS);
    assert.ok(body.links.length >= body.points.length - 1 || type === "hair");
    assert.ok(body.points.some((point) => point.pinned));
    const firstLink = body.links[0];
    const movingPoint = body.points[firstLink.b];
    movingPoint.x += 40;
    const distanceBefore = Math.hypot(
      body.points[firstLink.b].x - body.points[firstLink.a].x,
      body.points[firstLink.b].y - body.points[firstLink.a].y
    );
    simulation.solveDistanceLinks(body, 1);
    const distanceAfter = Math.hypot(
      body.points[firstLink.b].x - body.points[firstLink.a].x,
      body.points[firstLink.b].y - body.points[firstLink.a].y
    );
    assert.ok(distanceAfter < distanceBefore);
  }

  const crowded = simulation.createDefaultProject();
  crowded.constraints = Array.from({ length: simulation.PERFORMANCE.MAX_CONSTRAINTS }, (_, index) => ({
    ...simulation.defaultConstraint("cloth", crowded.settings.width),
    id: `cloth-${index}`,
    columns: 12,
    rows: 10
  }));
  const engine = simulation.createSimulation(crowded);
  const totalPoints = engine.getState().constraints.reduce((sum, body) => sum + body.points.length, 0);
  assert.ok(totalPoints <= simulation.PERFORMANCE.MAX_CONSTRAINT_POINTS);
});

test("normalization caps work, sanitizes user text and exports an explicit project", () => {
  const raw = {
    meta: { name: '<img src=x onerror="alert(1)">Demo <script>bad()</script>' },
    settings: { particleCap: 999999, bounce: 9, seed: "stable seed", background: "javascript:red" },
    emitters: Array.from({ length: 20 }, (_, index) => ({
      id: `bad id ${index}`,
      name: `<b>Emitter ${index}</b>`,
      preset: index % 2 ? "rain" : "unknown",
      rate: 9999
    })),
    constraints: Array.from({ length: 12 }, () => ({ type: "cloth", columns: 99, rows: 99 }))
  };
  const project = simulation.normalizeProject(raw);
  assert.doesNotMatch(project.meta.name, /[<>]/);
  assert.equal(project.settings.particleCap, simulation.PERFORMANCE.MAX_PARTICLES);
  assert.equal(project.settings.bounce, 1);
  assert.equal(project.settings.background, "#07131b");
  assert.equal(project.emitters.length, simulation.PERFORMANCE.MAX_EMITTERS);
  assert.equal(project.constraints.length, simulation.PERFORMANCE.MAX_CONSTRAINTS);
  assert.ok(project.emitters.every((emitter) => emitter.rate <= 300));
  const exported = JSON.parse(simulation.exportProject(project));
  assert.equal(exported.format, simulation.FORMAT);
  assert.equal(exported.version, simulation.VERSION);
  assert.deepEqual(simulation.importProject(exported), exported.project);
});

test("workspace is local-first, accessible, responsive and truthful about support", () => {
  for (const marker of [
    "localStorage", "data-sim-canvas", "getContext(\"2d\")", "aria-live=\"polite\"",
    "role=\"toolbar\"", "tabindex=\"0\"", ":focus-visible", "event.key === \" \"",
    "pointerdown", "prefers-reduced-motion: reduce", "max-width:375px", "Canvas2D is not supported",
    "data-sim-action=\"play\"", "data-sim-action=\"step\"", "data-sim-action=\"reset\"",
    "MAX_COLLISION_CHECKS", "MAX_CONSTRAINT_POINTS"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
  const capabilities = simulation.detectCapabilities({ navigator: {} });
  assert.equal(capabilities.canvas2d, false);
  assert.equal(capabilities.animationFrame, false);
  assert.equal(capabilities.localStorage, false);
});
