(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(global);
  else global.HHGraphicSimulation = factory(global);
}(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {}), function (runtime) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-simulation";
  const STORAGE_KEY = "hh.graphic-simulation.project.v1";
  const PERFORMANCE = Object.freeze({
    MAX_PARTICLES: 1200,
    MAX_EMITTERS: 8,
    MAX_CONSTRAINTS: 4,
    MAX_CONSTRAINT_POINTS: 192,
    MAX_COLLISION_CHECKS: 6000,
    FIXED_STEP: 1 / 60,
    MAX_FRAME_DELTA: 0.1,
    MAX_STEPS_PER_TICK: 6
  });
  const PRESETS = Object.freeze({
    fireworks: Object.freeze({
      id: "fireworks", label: "Fireworks", color: "#ff5fa2", rate: 0,
      burst: 52, interval: 1.45, spread: 1, life: 2.4, radius: 3.2
    }),
    snow: Object.freeze({
      id: "snow", label: "Snow", color: "#f4f7ff", rate: 42,
      burst: 24, interval: 0, spread: 1, life: 8, radius: 2.8
    }),
    rain: Object.freeze({
      id: "rain", label: "Rain", color: "#5bc7ff", rate: 105,
      burst: 38, interval: 0, spread: 1, life: 2.2, radius: 1.5
    }),
    light: Object.freeze({
      id: "light", label: "Light", color: "#ffd166", rate: 28,
      burst: 22, interval: 0, spread: 90, life: 2.8, radius: 4.5
    })
  });
  const CONSTRAINT_TYPES = Object.freeze(["rope", "hair", "cloth"]);
  const PALETTES = Object.freeze({
    fireworks: Object.freeze(["#ff5fa2", "#ffd166", "#7be0ad", "#65c7ff", "#f8f7ff"]),
    snow: Object.freeze(["#ffffff", "#dfeaff", "#bcd5ff"]),
    rain: Object.freeze(["#5bc7ff", "#70d6ff", "#3a86ff"]),
    light: Object.freeze(["#ffd166", "#fff1a8", "#ff9f1c", "#f8f7ff"])
  });
  const mounted = typeof WeakMap === "function" ? new WeakMap() : new Map();

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, numberOr(value, min)));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, fallback, maxLength) {
    const text = String(value == null ? fallback : value)
      .replace(/<[^>]*>/g, "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return (text || fallback).slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
    }[character]));
  }

  function safeId(value, fallback) {
    const id = String(value == null ? "" : value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return id || fallback;
  }

  function safeColor(value, fallback) {
    const color = String(value || "");
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function hashSeed(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
    const text = String(value == null ? "1337" : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed);
    const random = function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (next) => { state = hashSeed(next); };
    return random;
  }

  function defaultEmitter(presetId, width, height, id) {
    const preset = PRESETS[presetId] || PRESETS.fireworks;
    return {
      id: id || "emitter-main",
      name: preset.label,
      preset: preset.id,
      enabled: true,
      x: width * 0.5,
      y: preset.id === "fireworks" ? height * 0.7 : height * 0.45,
      rate: preset.rate,
      burst: preset.burst,
      interval: preset.interval,
      spread: preset.spread,
      color: preset.color
    };
  }

  function defaultConstraint(type, width) {
    const safeType = CONSTRAINT_TYPES.includes(type) ? type : "rope";
    return {
      id: `constraint-${safeType}`,
      name: safeType === "rope" ? "Rope" : safeType === "hair" ? "Hair strands" : "Cloth patch",
      type: safeType,
      enabled: true,
      origin: { x: width * 0.5, y: 76 },
      pointCount: safeType === "rope" ? 18 : 9,
      strands: safeType === "hair" ? 5 : 1,
      columns: safeType === "cloth" ? 9 : 2,
      rows: safeType === "cloth" ? 6 : 2,
      segmentLength: safeType === "cloth" ? 18 : 16,
      spacing: safeType === "hair" ? 10 : 18,
      stiffness: safeType === "cloth" ? 0.78 : 0.9,
      damping: 0.985,
      color: safeType === "cloth" ? "#7be0ad" : safeType === "hair" ? "#ff9fbe" : "#ffd166"
    };
  }

  function createDefaultProject() {
    const width = 960;
    const height = 540;
    const now = new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      meta: { name: "Simulation Lab", createdAt: now, updatedAt: now },
      settings: {
        width,
        height,
        seed: 1337,
        gravity: 360,
        bounce: 0.68,
        drag: 0.992,
        spring: 0.9,
        collisions: true,
        particleCap: 720,
        background: "#07131b"
      },
      emitters: [defaultEmitter("fireworks", width, height, "emitter-main")],
      constraints: [defaultConstraint("rope", width)]
    };
  }

  function normalizeEmitter(value, settings, index) {
    const source = value && typeof value === "object" ? value : {};
    const preset = PRESETS[source.preset] || PRESETS.fireworks;
    const fallback = defaultEmitter(preset.id, settings.width, settings.height, `emitter-${index + 1}`);
    return {
      id: safeId(source.id, fallback.id),
      name: cleanText(source.name, preset.label, 72),
      preset: preset.id,
      enabled: source.enabled !== false,
      x: clamp(numberOr(source.x, fallback.x), 0, settings.width),
      y: clamp(numberOr(source.y, fallback.y), 0, settings.height),
      rate: clamp(numberOr(source.rate, preset.rate), 0, 300),
      burst: Math.round(clamp(numberOr(source.burst, preset.burst), 1, 160)),
      interval: clamp(numberOr(source.interval, preset.interval), 0, 20),
      spread: clamp(numberOr(source.spread, preset.spread), 0.1, 400),
      color: safeColor(source.color, preset.color)
    };
  }

  function normalizeConstraint(value, settings, index) {
    const source = value && typeof value === "object" ? value : {};
    const type = CONSTRAINT_TYPES.includes(source.type) ? source.type : "rope";
    const fallback = defaultConstraint(type, settings.width);
    const origin = source.origin && typeof source.origin === "object" ? source.origin : {};
    return {
      id: safeId(source.id, `constraint-${index + 1}`),
      name: cleanText(source.name, fallback.name, 72),
      type,
      enabled: source.enabled !== false,
      origin: {
        x: clamp(numberOr(origin.x, fallback.origin.x), 0, settings.width),
        y: clamp(numberOr(origin.y, fallback.origin.y), 0, settings.height)
      },
      pointCount: Math.round(clamp(numberOr(source.pointCount, fallback.pointCount), 2, 32)),
      strands: Math.round(clamp(numberOr(source.strands, fallback.strands), 1, 8)),
      columns: Math.round(clamp(numberOr(source.columns, fallback.columns), 2, 12)),
      rows: Math.round(clamp(numberOr(source.rows, fallback.rows), 2, 10)),
      segmentLength: clamp(numberOr(source.segmentLength, fallback.segmentLength), 4, 40),
      spacing: clamp(numberOr(source.spacing, fallback.spacing), 4, 40),
      stiffness: clamp(numberOr(source.stiffness, fallback.stiffness), 0.05, 1),
      damping: clamp(numberOr(source.damping, fallback.damping), 0.8, 1),
      color: safeColor(source.color, fallback.color)
    };
  }

  function normalizeProject(input) {
    const envelope = input && typeof input === "object" ? input : {};
    const source = envelope.format === FORMAT && envelope.project && typeof envelope.project === "object"
      ? envelope.project
      : envelope;
    const fallback = createDefaultProject();
    const rawSettings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const settings = {
      width: Math.round(clamp(numberOr(rawSettings.width, fallback.settings.width), 320, 1920)),
      height: Math.round(clamp(numberOr(rawSettings.height, fallback.settings.height), 240, 1080)),
      seed: hashSeed(rawSettings.seed == null ? fallback.settings.seed : rawSettings.seed),
      gravity: clamp(numberOr(rawSettings.gravity, fallback.settings.gravity), -2000, 2000),
      bounce: clamp(numberOr(rawSettings.bounce, fallback.settings.bounce), 0, 1),
      drag: clamp(numberOr(rawSettings.drag, fallback.settings.drag), 0.8, 1),
      spring: clamp(numberOr(rawSettings.spring, fallback.settings.spring), 0.05, 1),
      collisions: rawSettings.collisions !== false,
      particleCap: Math.round(clamp(numberOr(rawSettings.particleCap, fallback.settings.particleCap), 16, PERFORMANCE.MAX_PARTICLES)),
      background: safeColor(rawSettings.background, fallback.settings.background)
    };
    const rawEmitters = Array.isArray(source.emitters) ? source.emitters : fallback.emitters;
    const rawConstraints = Array.isArray(source.constraints) ? source.constraints : fallback.constraints;
    const usedEmitterIds = new Set();
    const emitters = rawEmitters.slice(0, PERFORMANCE.MAX_EMITTERS).map((item, index) => {
      const emitter = normalizeEmitter(item, settings, index);
      if (usedEmitterIds.has(emitter.id)) emitter.id = `emitter-${index + 1}`;
      usedEmitterIds.add(emitter.id);
      return emitter;
    });
    const constraints = rawConstraints.slice(0, PERFORMANCE.MAX_CONSTRAINTS)
      .map((item, index) => normalizeConstraint(item, settings, index));
    const rawMeta = source.meta && typeof source.meta === "object" ? source.meta : {};
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: cleanText(rawMeta.name, fallback.meta.name, 96),
        createdAt: typeof rawMeta.createdAt === "string" ? rawMeta.createdAt.slice(0, 40) : fallback.meta.createdAt,
        updatedAt: typeof rawMeta.updatedAt === "string" ? rawMeta.updatedAt.slice(0, 40) : fallback.meta.updatedAt
      },
      settings,
      emitters,
      constraints
    };
  }

  function makePoint(x, y, pinned, radius) {
    return {
      x, y, previousX: x, previousY: y,
      pinned: Boolean(pinned), pinX: x, pinY: y,
      radius: numberOr(radius, 2.5)
    };
  }

  function makeLink(a, b, length, stiffness) {
    return { a, b, length, stiffness };
  }

  function createConstraintBody(input, pointLimit, worldSettings) {
    const bounds = worldSettings && typeof worldSettings === "object"
      ? { width: numberOr(worldSettings.width, 960), height: numberOr(worldSettings.height, 540) }
      : { width: 960, height: 540 };
    const descriptor = normalizeConstraint(input, bounds, 0);
    const limit = Math.max(0, Math.min(PERFORMANCE.MAX_CONSTRAINT_POINTS, Math.floor(numberOr(pointLimit, PERFORMANCE.MAX_CONSTRAINT_POINTS))));
    const points = [];
    const links = [];
    const minimumPoints = descriptor.type === "cloth" ? 4 : descriptor.type === "hair" ? 3 : 2;
    if (limit < minimumPoints) {
      return { id: descriptor.id, name: descriptor.name, type: descriptor.type, color: descriptor.color, damping: descriptor.damping, points, links };
    }
    const addLine = (originX, originY, count, horizontal, pinFirst) => {
      const start = points.length;
      for (let index = 0; index < count && points.length < limit; index += 1) {
        const x = originX + (horizontal ? index * descriptor.segmentLength : 0);
        const y = originY + (horizontal ? 0 : index * descriptor.segmentLength);
        points.push(makePoint(x, y, pinFirst && index === 0, descriptor.type === "cloth" ? 2 : 2.8));
        if (index > 0) links.push(makeLink(start + index - 1, start + index, descriptor.segmentLength, descriptor.stiffness));
      }
    };

    if (descriptor.type === "rope") {
      addLine(descriptor.origin.x, descriptor.origin.y, Math.min(descriptor.pointCount, limit), false, true);
    } else if (descriptor.type === "hair") {
      const pointsPerStrand = Math.max(3, Math.min(descriptor.pointCount, Math.floor(limit / descriptor.strands)));
      const strands = Math.max(1, Math.min(descriptor.strands, Math.floor(limit / pointsPerStrand)));
      const offset = ((strands - 1) * descriptor.spacing) / 2;
      for (let strand = 0; strand < strands; strand += 1) {
        addLine(descriptor.origin.x - offset + strand * descriptor.spacing, descriptor.origin.y, pointsPerStrand, false, true);
      }
    } else {
      let columns = Math.min(descriptor.columns, Math.max(2, Math.floor(Math.sqrt(limit * 1.5))));
      let rows = Math.min(descriptor.rows, Math.floor(limit / columns));
      if (rows < 2) { columns = Math.max(2, Math.floor(limit / 2)); rows = 2; }
      const startX = descriptor.origin.x - ((columns - 1) * descriptor.segmentLength) / 2;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const pinned = row === 0 && (column === 0 || column === columns - 1 || column % 3 === 0);
          points.push(makePoint(
            startX + column * descriptor.segmentLength,
            descriptor.origin.y + row * descriptor.segmentLength,
            pinned,
            2
          ));
          const pointIndex = row * columns + column;
          if (column > 0) links.push(makeLink(pointIndex - 1, pointIndex, descriptor.segmentLength, descriptor.stiffness));
          if (row > 0) links.push(makeLink(pointIndex - columns, pointIndex, descriptor.segmentLength, descriptor.stiffness));
        }
      }
    }
    return { id: descriptor.id, name: descriptor.name, type: descriptor.type, color: descriptor.color, damping: descriptor.damping, points, links };
  }

  function buildConstraintBodies(project) {
    const bodies = [];
    let remaining = PERFORMANCE.MAX_CONSTRAINT_POINTS;
    project.constraints.filter((item) => item.enabled).forEach((descriptor) => {
      if (remaining < 2) return;
      const body = createConstraintBody(descriptor, remaining, project.settings);
      if (body.points.length >= 2) {
        bodies.push(body);
        remaining -= body.points.length;
      }
    });
    return bodies;
  }

  function solveDistanceLinks(body, spring) {
    const globalSpring = clamp(numberOr(spring, 1), 0.05, 1);
    body.links.forEach((link) => {
      const first = body.points[link.a];
      const second = body.points[link.b];
      if (!first || !second) return;
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const correction = ((distance - link.length) / distance) * clamp(link.stiffness * globalSpring, 0.01, 1);
      if (!first.pinned && !second.pinned) {
        first.x += dx * correction * 0.5;
        first.y += dy * correction * 0.5;
        second.x -= dx * correction * 0.5;
        second.y -= dy * correction * 0.5;
      } else if (!first.pinned) {
        first.x += dx * correction;
        first.y += dy * correction;
      } else if (!second.pinned) {
        second.x -= dx * correction;
        second.y -= dy * correction;
      }
    });
    body.points.forEach((point) => {
      if (point.pinned) { point.x = point.pinX; point.y = point.pinY; }
    });
    return body;
  }

  function stepConstraintBody(body, settings, delta) {
    const dt = clamp(numberOr(delta, PERFORMANCE.FIXED_STEP), 0.001, PERFORMANCE.MAX_FRAME_DELTA);
    const width = numberOr(settings.width, 960);
    const height = numberOr(settings.height, 540);
    const gravity = numberOr(settings.gravity, 360);
    const bounce = clamp(numberOr(settings.bounce, 0.68), 0, 1);
    body.points.forEach((point) => {
      if (point.pinned) { point.x = point.pinX; point.y = point.pinY; return; }
      const velocityX = (point.x - point.previousX) * body.damping;
      const velocityY = (point.y - point.previousY) * body.damping;
      point.previousX = point.x;
      point.previousY = point.y;
      point.x += velocityX;
      point.y += velocityY + gravity * dt * dt;
      if (point.x < point.radius) {
        point.x = point.radius;
        point.previousX = point.x + velocityX * bounce;
      } else if (point.x > width - point.radius) {
        point.x = width - point.radius;
        point.previousX = point.x + velocityX * bounce;
      }
      if (point.y > height - point.radius) {
        point.y = height - point.radius;
        point.previousY = point.y + velocityY * bounce;
      }
    });
    for (let iteration = 0; iteration < 3; iteration += 1) solveDistanceLinks(body, settings.spring);
    return body;
  }

  function resolveParticleCollisions(particles, bounce, maxChecks) {
    const restitution = clamp(numberOr(bounce, 0.68), 0, 1);
    const checkCap = Math.max(0, Math.floor(numberOr(maxChecks, PERFORMANCE.MAX_COLLISION_CHECKS)));
    const grid = new Map();
    const cellSize = 18;
    let checks = 0;
    let resolved = 0;
    particles.forEach((particle, index) => {
      if (particle.collides === false) return;
      const cellX = Math.floor(particle.x / cellSize);
      const cellY = Math.floor(particle.y / cellSize);
      if (checks < checkCap) {
        for (let offsetY = -1; offsetY <= 1 && checks < checkCap; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1 && checks < checkCap; offsetX += 1) {
            const candidates = grid.get(`${cellX + offsetX}:${cellY + offsetY}`) || [];
            for (let candidateIndex = 0; candidateIndex < candidates.length && checks < checkCap; candidateIndex += 1) {
              const other = particles[candidates[candidateIndex]];
              checks += 1;
              const dx = particle.x - other.x;
              const dy = particle.y - other.y;
              const minimumDistance = particle.radius + other.radius;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared >= minimumDistance * minimumDistance) continue;
              const distance = Math.sqrt(distanceSquared);
              const normalX = distance > 0.0001 ? dx / distance : (index % 2 ? 1 : -1);
              const normalY = distance > 0.0001 ? dy / distance : 0;
              const overlap = minimumDistance - (distance || 0);
              particle.x += normalX * overlap * 0.5;
              particle.y += normalY * overlap * 0.5;
              other.x -= normalX * overlap * 0.5;
              other.y -= normalY * overlap * 0.5;
              const relativeVelocity = (particle.vx - other.vx) * normalX + (particle.vy - other.vy) * normalY;
              if (relativeVelocity < 0) {
                const impulse = -(1 + restitution) * relativeVelocity * 0.5;
                particle.vx += normalX * impulse;
                particle.vy += normalY * impulse;
                other.vx -= normalX * impulse;
                other.vy -= normalY * impulse;
              }
              resolved += 1;
            }
          }
        }
      }
      const key = `${cellX}:${cellY}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
    return { checks, resolved };
  }

  function createSimulation(projectInput) {
    let project = normalizeProject(projectInput);
    let random;
    let particles;
    let constraints;
    let emitterRuntime;
    let elapsed;
    let accumulator;
    let particleSequence;
    let paused = true;
    let lastCollisionStats = { checks: 0, resolved: 0 };

    function initialize() {
      random = createSeededRandom(project.settings.seed);
      particles = [];
      constraints = buildConstraintBodies(project);
      emitterRuntime = project.emitters.map((emitter) => ({ id: emitter.id, carry: 0, burstClock: 0, started: false }));
      elapsed = 0;
      accumulator = 0;
      particleSequence = 0;
      lastCollisionStats = { checks: 0, resolved: 0 };
    }

    function makeParticle(emitter, presetId) {
      const preset = PRESETS[presetId] || PRESETS.fireworks;
      const palette = PALETTES[preset.id];
      const color = emitter.color === preset.color
        ? palette[Math.floor(random() * palette.length)]
        : emitter.color;
      const particle = {
        id: `particle-${++particleSequence}`,
        preset: preset.id,
        x: emitter.x,
        y: emitter.y,
        vx: 0,
        vy: 0,
        radius: preset.radius,
        life: preset.life,
        maxLife: preset.life,
        gravityScale: 1,
        drag: project.settings.drag,
        color,
        collides: true,
        boundary: "bounce"
      };
      if (preset.id === "fireworks") {
        const angle = random() * Math.PI * 2;
        const speed = 95 + random() * 205;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed - 35;
        particle.radius = 1.8 + random() * 2.4;
        particle.life = particle.maxLife = 1.4 + random() * 1.4;
      } else if (preset.id === "snow") {
        particle.x = random() * project.settings.width;
        particle.y = -6 - random() * 20;
        particle.vx = -14 + random() * 28;
        particle.vy = 22 + random() * 34;
        particle.radius = 1.5 + random() * 3;
        particle.life = particle.maxLife = 7 + random() * 4;
        particle.gravityScale = 0.025;
        particle.drag = 0.999;
        particle.collides = false;
        particle.boundary = "kill";
      } else if (preset.id === "rain") {
        particle.x = random() * project.settings.width;
        particle.y = -12 - random() * 35;
        particle.vx = -45 + random() * 14;
        particle.vy = 420 + random() * 180;
        particle.radius = 1 + random();
        particle.life = particle.maxLife = 1.5 + random() * 1.1;
        particle.gravityScale = 0.22;
        particle.drag = 0.9995;
        particle.collides = false;
        particle.boundary = "kill";
      } else {
        const angle = random() * Math.PI * 2;
        const distance = random() * emitter.spread;
        particle.x += Math.cos(angle) * distance;
        particle.y += Math.sin(angle) * distance;
        particle.vx = -25 + random() * 50;
        particle.vy = -45 - random() * 55;
        particle.radius = 2.5 + random() * 4.5;
        particle.life = particle.maxLife = 1.6 + random() * 2;
        particle.gravityScale = -0.025;
        particle.drag = 0.985;
      }
      return particle;
    }

    function addParticle(value) {
      if (particles.length >= project.settings.particleCap) return false;
      const source = value && typeof value === "object" ? value : {};
      const preset = PRESETS[source.preset] ? source.preset : "light";
      const particle = {
        id: safeId(source.id, `particle-${++particleSequence}`),
        preset,
        x: clamp(numberOr(source.x, project.settings.width * 0.5), -100, project.settings.width + 100),
        y: clamp(numberOr(source.y, project.settings.height * 0.5), -100, project.settings.height + 100),
        vx: clamp(numberOr(source.vx, 0), -3000, 3000),
        vy: clamp(numberOr(source.vy, 0), -3000, 3000),
        radius: clamp(numberOr(source.radius, 3), 0.5, 12),
        life: clamp(numberOr(source.life, 3), 0.01, 60),
        maxLife: clamp(numberOr(source.maxLife, source.life || 3), 0.01, 60),
        gravityScale: clamp(numberOr(source.gravityScale, 1), -4, 4),
        drag: clamp(numberOr(source.drag, project.settings.drag), 0.8, 1),
        color: safeColor(source.color, PRESETS[preset].color),
        collides: source.collides !== false,
        boundary: source.boundary === "kill" ? "kill" : "bounce"
      };
      particles.push(particle);
      return clone(particle);
    }

    function emit(emitterInput, count, x, y) {
      let emitter = project.emitters.find((item) => item.id === emitterInput || item.preset === emitterInput);
      if (!emitter && PRESETS[emitterInput]) emitter = defaultEmitter(emitterInput, project.settings.width, project.settings.height, "manual");
      if (!emitter) emitter = project.emitters[0];
      if (!emitter) return 0;
      const localEmitter = Object.assign({}, emitter, {
        x: Number.isFinite(Number(x)) ? clamp(Number(x), 0, project.settings.width) : emitter.x,
        y: Number.isFinite(Number(y)) ? clamp(Number(y), 0, project.settings.height) : emitter.y
      });
      const amount = Math.min(
        Math.max(0, Math.floor(numberOr(count, localEmitter.burst))),
        project.settings.particleCap - particles.length
      );
      for (let index = 0; index < amount; index += 1) particles.push(makeParticle(localEmitter, localEmitter.preset));
      return amount;
    }

    function spawn(delta) {
      project.emitters.forEach((emitter, index) => {
        if (!emitter.enabled || particles.length >= project.settings.particleCap) return;
        const state = emitterRuntime[index];
        if (emitter.preset === "fireworks") {
          if (!state.started) {
            emit(emitter.id, emitter.burst);
            state.started = true;
          }
          state.burstClock += delta;
          const interval = Math.max(0.2, emitter.interval || PRESETS.fireworks.interval);
          while (state.burstClock >= interval && particles.length < project.settings.particleCap) {
            state.burstClock -= interval;
            emit(emitter.id, emitter.burst);
          }
        } else {
          state.carry += emitter.rate * delta;
          const amount = Math.floor(state.carry);
          if (amount > 0) {
            state.carry -= amount;
            emit(emitter.id, amount);
          }
        }
      });
    }

    function integrateParticle(particle, delta) {
      particle.vy += project.settings.gravity * particle.gravityScale * delta;
      const drag = Math.pow(particle.drag, delta * 60);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta;
      const radius = particle.radius;
      const width = project.settings.width;
      const height = project.settings.height;
      if (particle.boundary === "kill") {
        if (particle.y > height + 30 || particle.x < -80 || particle.x > width + 80) particle.life = 0;
        return;
      }
      if (particle.x < radius) {
        particle.x = radius;
        particle.vx = Math.abs(particle.vx) * project.settings.bounce;
      } else if (particle.x > width - radius) {
        particle.x = width - radius;
        particle.vx = -Math.abs(particle.vx) * project.settings.bounce;
      }
      if (particle.y < radius) {
        particle.y = radius;
        particle.vy = Math.abs(particle.vy) * project.settings.bounce;
      } else if (particle.y > height - radius) {
        particle.y = height - radius;
        particle.vy = -Math.abs(particle.vy) * project.settings.bounce;
        if (Math.abs(particle.vy) < 7) particle.vy = 0;
      }
    }

    function stepOnce() {
      const delta = PERFORMANCE.FIXED_STEP;
      spawn(delta);
      particles.forEach((particle) => integrateParticle(particle, delta));
      particles = particles.filter((particle) => particle.life > 0);
      lastCollisionStats = project.settings.collisions
        ? resolveParticleCollisions(particles, project.settings.bounce, PERFORMANCE.MAX_COLLISION_CHECKS)
        : { checks: 0, resolved: 0 };
      constraints.forEach((body) => stepConstraintBody(body, project.settings, delta));
      elapsed += delta;
      return getState();
    }

    function advance(delta) {
      accumulator += clamp(numberOr(delta, PERFORMANCE.FIXED_STEP), 0, PERFORMANCE.MAX_FRAME_DELTA);
      let steps = 0;
      while (accumulator + 1e-12 >= PERFORMANCE.FIXED_STEP && steps < PERFORMANCE.MAX_STEPS_PER_TICK) {
        stepOnce();
        accumulator -= PERFORMANCE.FIXED_STEP;
        steps += 1;
      }
      if (steps === PERFORMANCE.MAX_STEPS_PER_TICK && accumulator >= PERFORMANCE.FIXED_STEP) accumulator = 0;
      return getState();
    }

    function getState() {
      return {
        elapsed,
        paused,
        randomState: random.getState(),
        particleCap: project.settings.particleCap,
        particles: particles.map((item) => Object.assign({}, item)),
        constraints: constraints.map((body) => ({
          id: body.id,
          name: body.name,
          type: body.type,
          color: body.color,
          links: body.links.map((item) => Object.assign({}, item)),
          points: body.points.map((item) => Object.assign({}, item))
        })),
        collision: Object.assign({}, lastCollisionStats)
      };
    }

    function setProject(next) {
      project = normalizeProject(next);
      initialize();
      return clone(project);
    }

    function reset() {
      const wasPaused = paused;
      initialize();
      paused = wasPaused;
      return getState();
    }

    initialize();
    return {
      getProject: () => clone(project),
      setProject,
      getState,
      addParticle,
      emit,
      step: (delta) => delta == null ? stepOnce() : advance(delta),
      stepOnce,
      tick: (delta) => paused ? getState() : advance(delta),
      play: () => { paused = false; return true; },
      pause: () => { paused = true; return true; },
      toggle: () => { paused = !paused; return paused; },
      isPaused: () => paused,
      reset
    };
  }

  function exportProject(projectInput) {
    const project = normalizeProject(projectInput);
    return JSON.stringify({ format: FORMAT, version: VERSION, project }, null, 2);
  }

  function importProject(value) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") throw new TypeError("Project JSON must contain an object.");
    if (parsed.format && parsed.format !== FORMAT) throw new TypeError("Unsupported simulation project format.");
    if (parsed.version != null && Number(parsed.version) > VERSION) throw new TypeError("This simulation project version is newer than this module.");
    return normalizeProject(parsed);
  }

  function storageFrom(target, provided) {
    if (provided && typeof provided.getItem === "function" && typeof provided.setItem === "function") return provided;
    try {
      const storage = target && target.localStorage;
      return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" ? storage : null;
    } catch (_) {
      return null;
    }
  }

  function detectCapabilities(target) {
    const host = target || {};
    const doc = host.document;
    let canvas2d = false;
    try {
      const canvas = doc && typeof doc.createElement === "function" ? doc.createElement("canvas") : null;
      canvas2d = Boolean(canvas && typeof canvas.getContext === "function" && canvas.getContext("2d"));
    } catch (_) {
      canvas2d = false;
    }
    return {
      canvas2d,
      animationFrame: typeof host.requestAnimationFrame === "function",
      localStorage: Boolean(storageFrom(host)),
      download: typeof host.Blob === "function" && Boolean(host.URL && typeof host.URL.createObjectURL === "function"),
      reducedMotion: Boolean(host.matchMedia && host.matchMedia("(prefers-reduced-motion: reduce)").matches)
    };
  }

  function styles() {
    return `
      .hhsim{--sim-bg:#07131b;--sim-panel:#101b22;--sim-line:#29404b;--sim-text:#edf5f7;--sim-muted:#99abb2;--sim-cyan:#65d7ff;--sim-pink:#ff5fa2;--sim-gold:#ffd166;box-sizing:border-box;min-width:0;color:var(--sim-text);background:#0a151b;font:13px/1.45 Inter,system-ui,sans-serif;overflow:hidden}
      .hhsim *{box-sizing:border-box}.hhsim button,.hhsim input,.hhsim select{font:inherit}.hhsim button,.hhsim select,.hhsim input{min-width:0;color:var(--sim-text);border:1px solid var(--sim-line);background:#0c181f;border-radius:6px}.hhsim button{min-height:34px;padding:6px 10px;cursor:pointer}.hhsim button:hover{border-color:var(--sim-cyan)}.hhsim button:disabled{cursor:not-allowed;opacity:.45}.hhsim :focus-visible{outline:3px solid var(--sim-gold);outline-offset:2px}.hhsim input,.hhsim select{width:100%;min-height:34px;padding:5px 7px}.hhsim input[type=checkbox]{width:18px;min-height:18px;accent-color:var(--sim-cyan)}
      .hhsim-header{display:flex;align-items:center;gap:12px;min-width:0;padding:10px 12px;border-bottom:1px solid var(--sim-line);background:#0d1a21}.hhsim-brand{display:flex;align-items:center;gap:9px;min-width:180px}.hhsim-mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--sim-pink);border-radius:6px;color:var(--sim-pink);font-weight:800}.hhsim-brand strong,.hhsim-brand small{display:block}.hhsim-brand small{color:var(--sim-muted)}.hhsim-name{max-width:260px}.hhsim-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-left:auto;flex-wrap:wrap}.hhsim-status{max-width:320px;color:var(--sim-muted);font-size:12px}.hhsim-primary{border-color:#3188a8!important;background:#123747!important}.hhsim-export{border-color:#8d4770!important}
      .hhsim-workspace{display:grid;grid-template-columns:minmax(190px,230px) minmax(0,1fr) minmax(190px,220px);min-height:560px}.hhsim-sidebar,.hhsim-inspector{min-width:0;padding:12px;background:var(--sim-panel);overflow:auto}.hhsim-sidebar{border-right:1px solid var(--sim-line)}.hhsim-inspector{border-left:1px solid var(--sim-line)}.hhsim fieldset{min-width:0;margin:0 0 16px;padding:0;border:0}.hhsim legend{width:100%;margin:0 0 8px;color:var(--sim-muted);font-size:11px;font-weight:700;text-transform:uppercase}.hhsim-preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hhsim-preset{display:grid;grid-template-columns:10px 1fr;align-items:center;gap:7px;text-align:left}.hhsim-preset i{width:9px;height:9px;border-radius:50%;background:var(--preset-color)}.hhsim-preset[aria-pressed=true]{border-color:var(--preset-color);background:#18262e}.hhsim-field{display:grid;gap:4px;margin-bottom:8px;color:var(--sim-muted);font-size:12px}.hhsim-check{display:flex;align-items:center;gap:7px;margin:10px 0;color:var(--sim-muted)}.hhsim-cap-note{color:var(--sim-muted);font-size:11px}
      .hhsim-main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;background:#061017}.hhsim-toolbar{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--sim-line);flex-wrap:wrap}.hhsim-toolbar-spacer{flex:1}.hhsim-badge{padding:4px 7px;border:1px solid var(--sim-line);border-radius:5px;color:var(--sim-muted);font-size:11px}.hhsim-stage{display:grid;place-items:center;min-width:0;padding:12px;overflow:hidden}.hhsim-canvas-wrap{position:relative;width:min(100%,1100px);min-width:0}.hhsim canvas{display:block;width:100%;height:auto;max-height:70vh;border:1px solid var(--sim-line);background:var(--sim-bg);touch-action:none}.hhsim-unsupported{position:absolute;inset:0;display:grid;place-items:center;margin:0;padding:20px;background:#111b21;color:#ffc4d8;text-align:center}.hhsim-unsupported[hidden]{display:none}.hhsim-metrics{display:flex;gap:14px;padding:7px 10px;border-top:1px solid var(--sim-line);color:var(--sim-muted);font-size:11px;flex-wrap:wrap}.hhsim-metrics output{color:var(--sim-text)}
      @media (max-width:900px){.hhsim-workspace{grid-template-columns:190px minmax(0,1fr)}.hhsim-inspector{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;border-left:0;border-top:1px solid var(--sim-line)}.hhsim-inspector .hhsim-field{margin:0}.hhsim-inspector .hhsim-check{margin:22px 0 0}}
      @media (max-width:620px){.hhsim-header{align-items:flex-start;flex-wrap:wrap}.hhsim-name{order:3;max-width:none;flex-basis:100%}.hhsim-header-actions{margin-left:0}.hhsim-status{order:4;max-width:none;flex-basis:100%}.hhsim-workspace{display:flex;flex-direction:column;min-height:0}.hhsim-sidebar{border-right:0;border-bottom:1px solid var(--sim-line)}.hhsim-inspector{display:grid;grid-template-columns:1fr 1fr}.hhsim-stage{padding:6px}.hhsim canvas{max-height:none}.hhsim-preset-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.hhsim-preset{display:flex;justify-content:center;padding:6px 3px}.hhsim-preset i{display:none}.hhsim-toolbar-spacer{display:none}}
      @media (max-width:375px){.hhsim{font-size:12px}.hhsim-header{padding:8px}.hhsim-brand{min-width:0}.hhsim-header-actions{width:100%;justify-content:stretch}.hhsim-header-actions button{flex:1}.hhsim-preset-grid{grid-template-columns:1fr 1fr}.hhsim-inspector{grid-template-columns:1fr}.hhsim-toolbar button{flex:1}.hhsim-metrics{gap:8px}}
      @media (prefers-reduced-motion:reduce){.hhsim *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
  }

  function ensureStyles(doc) {
    if (doc.querySelector("style[data-hh-graphic-simulation-style]")) return;
    const style = doc.createElement("style");
    style.setAttribute("data-hh-graphic-simulation-style", "true");
    style.textContent = styles();
    doc.head.appendChild(style);
  }

  function mount(target, options) {
    const settings = options && typeof options === "object" ? options : {};
    const root = typeof target === "string" && runtime.document ? runtime.document.querySelector(target) : target;
    if (!root || typeof root !== "object" || !root.ownerDocument) return null;
    if (mounted.has(root)) return mounted.get(root);
    const doc = root.ownerDocument;
    const hostWindow = doc.defaultView || runtime;
    ensureStyles(doc);
    const storage = storageFrom(hostWindow, settings.storage);
    let project;
    if (settings.project) project = normalizeProject(settings.project);
    else {
      try { project = storage ? importProject(storage.getItem(STORAGE_KEY) || createDefaultProject()) : createDefaultProject(); }
      catch (_) { project = createDefaultProject(); }
    }
    let simulator = createSimulation(project);
    let saveTimer = 0;
    let frameHandle = 0;
    let lastFrame = 0;
    let destroyed = false;
    let context = null;
    const capabilities = detectCapabilities(hostWindow);
    const presetButtons = Object.values(PRESETS).map((preset) => `
      <button type="button" class="hhsim-preset" data-sim-preset="${preset.id}" aria-pressed="${project.emitters[0]?.preset === preset.id}" style="--preset-color:${preset.color}">
        <i aria-hidden="true"></i><span>${escapeHtml(preset.label)}</span>
      </button>`).join("");
    root.innerHTML = `
      <section class="hhsim" aria-label="HH Simulation Lab">
        <header class="hhsim-header">
          <div class="hhsim-brand"><span class="hhsim-mark" aria-hidden="true">SIM</span><span><strong>Simulation Lab</strong><small>Deterministic Canvas2D</small></span></div>
          <input class="hhsim-name" data-sim-name aria-label="Project name" maxlength="96" value="${escapeHtml(project.meta.name)}">
          <div class="hhsim-header-actions"><button type="button" class="hhsim-export" data-sim-action="export">Export JSON</button></div>
          <span class="hhsim-status" data-sim-status role="status" aria-live="polite">Ready</span>
        </header>
        <div class="hhsim-workspace">
          <aside class="hhsim-sidebar" aria-label="Emitter and constraint controls">
            <fieldset><legend>Emitter presets</legend><div class="hhsim-preset-grid">${presetButtons}</div></fieldset>
            <fieldset>
              <legend>Emitter</legend>
              <label class="hhsim-field">Rate / second<input type="number" min="0" max="300" step="1" data-sim-emitter="rate" value="${project.emitters[0]?.rate || 0}"></label>
              <label class="hhsim-field">Burst count<input type="number" min="1" max="160" step="1" data-sim-emitter="burst" value="${project.emitters[0]?.burst || 1}"></label>
            </fieldset>
            <fieldset>
              <legend>Lightweight constraints</legend>
              <label class="hhsim-field">Body<select data-sim-constraint><option value="none" ${project.constraints.length ? "" : "selected"}>None</option><option value="rope" ${project.constraints[0]?.type === "rope" ? "selected" : ""}>Rope</option><option value="hair" ${project.constraints[0]?.type === "hair" ? "selected" : ""}>Hair</option><option value="cloth" ${project.constraints[0]?.type === "cloth" ? "selected" : ""}>Cloth</option></select></label>
              <div class="hhsim-cap-note">Solver cap: ${PERFORMANCE.MAX_CONSTRAINT_POINTS} points</div>
            </fieldset>
          </aside>
          <main class="hhsim-main">
            <div class="hhsim-toolbar" role="toolbar" aria-label="Simulation playback">
              <button type="button" class="hhsim-primary" data-sim-action="play" aria-pressed="false">Run</button>
              <button type="button" data-sim-action="step">Step</button>
              <button type="button" data-sim-action="reset">Reset</button>
              <button type="button" data-sim-action="burst">Burst</button>
              <span class="hhsim-toolbar-spacer"></span>
              <span class="hhsim-badge" data-sim-capability>${capabilities.canvas2d ? "Canvas2D" : "Canvas2D unavailable"}</span>
              <span class="hhsim-badge">Seeded</span>
            </div>
            <div class="hhsim-stage">
              <div class="hhsim-canvas-wrap">
                <canvas data-sim-canvas width="${project.settings.width}" height="${project.settings.height}" tabindex="0" role="img" aria-label="Particle and constraint simulation preview"></canvas>
                <p class="hhsim-unsupported" data-sim-unsupported role="alert" hidden>Canvas2D is not supported on this device. Project editing and JSON export remain available.</p>
              </div>
            </div>
            <div class="hhsim-metrics" aria-label="Simulation metrics"><span>Particles <output data-sim-particles>0</output> / <output data-sim-cap>${project.settings.particleCap}</output></span><span>Constraint points <output data-sim-points>0</output></span><span>Collision checks <output data-sim-collisions>0</output></span><span>Time <output data-sim-time>0.00s</output></span></div>
          </main>
          <aside class="hhsim-inspector" aria-label="Physics settings">
            <label class="hhsim-field">Seed<input type="number" step="1" data-sim-setting="seed" value="${project.settings.seed}"></label>
            <label class="hhsim-field">Gravity<input type="number" min="-2000" max="2000" step="10" data-sim-setting="gravity" value="${project.settings.gravity}"></label>
            <label class="hhsim-field">Bounce<input type="number" min="0" max="1" step="0.05" data-sim-setting="bounce" value="${project.settings.bounce}"></label>
            <label class="hhsim-field">Spring<input type="number" min="0.05" max="1" step="0.05" data-sim-setting="spring" value="${project.settings.spring}"></label>
            <label class="hhsim-field">Particle cap<input type="number" min="16" max="${PERFORMANCE.MAX_PARTICLES}" step="16" data-sim-setting="particleCap" value="${project.settings.particleCap}"></label>
            <label class="hhsim-check"><input type="checkbox" data-sim-setting="collisions" ${project.settings.collisions ? "checked" : ""}> Particle collision</label>
          </aside>
        </div>
      </section>`;

    const canvas = root.querySelector("[data-sim-canvas]");
    try { context = canvas && canvas.getContext ? canvas.getContext("2d") : null; } catch (_) { context = null; }
    capabilities.canvas2d = Boolean(context);
    const unsupported = root.querySelector("[data-sim-unsupported]");
    unsupported.hidden = capabilities.canvas2d;
    root.querySelector("[data-sim-capability]").textContent = capabilities.canvas2d
      ? (capabilities.animationFrame ? "Canvas2D" : "Canvas2D manual step")
      : "Canvas2D unavailable";
    root.querySelectorAll("[data-sim-action=play],[data-sim-action=step],[data-sim-action=reset],[data-sim-action=burst]")
      .forEach((button) => { button.disabled = !capabilities.canvas2d; });

    function status(message) {
      const node = root.querySelector("[data-sim-status]");
      if (node) node.textContent = message;
    }

    function persist() {
      clearTimeout(saveTimer);
      saveTimer = hostWindow.setTimeout(() => {
        project.meta.updatedAt = new Date().toISOString();
        try {
          if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(project));
          else status("Autosave unavailable; export remains available.");
        } catch (_) {
          status("Local storage is unavailable or full; export the project to keep it.");
        }
      }, 180);
    }

    function updateControls() {
      const emitter = project.emitters[0];
      root.querySelectorAll("[data-sim-preset]").forEach((button) => {
        button.setAttribute("aria-pressed", String(Boolean(emitter && button.dataset.simPreset === emitter.preset)));
      });
      const rate = root.querySelector("[data-sim-emitter=rate]");
      const burst = root.querySelector("[data-sim-emitter=burst]");
      if (rate) rate.value = emitter ? emitter.rate : 0;
      if (burst) burst.value = emitter ? emitter.burst : 1;
      root.querySelector("[data-sim-cap]").textContent = project.settings.particleCap;
    }

    function draw() {
      if (!context || destroyed) return;
      const state = simulator.getState();
      const width = project.settings.width;
      const height = project.settings.height;
      const pixelRatio = Math.min(2, Math.max(1, numberOr(hostWindow.devicePixelRatio, 1)));
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
      }
      canvas.style.aspectRatio = `${width} / ${height}`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.globalAlpha = 1;
      context.fillStyle = project.settings.background;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(111, 151, 166, .12)";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= width; x += 48) { context.moveTo(x, 0); context.lineTo(x, height); }
      for (let y = 0; y <= height; y += 48) { context.moveTo(0, y); context.lineTo(width, y); }
      context.stroke();

      state.constraints.forEach((body) => {
        context.strokeStyle = body.color;
        context.fillStyle = body.color;
        context.globalAlpha = 0.82;
        context.lineWidth = body.type === "cloth" ? 1 : 2;
        context.beginPath();
        body.links.forEach((link) => {
          const first = body.points[link.a];
          const second = body.points[link.b];
          if (!first || !second) return;
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
        });
        context.stroke();
        body.points.forEach((point) => {
          context.beginPath();
          context.arc(point.x, point.y, point.pinned ? 3.5 : 2, 0, Math.PI * 2);
          context.fill();
        });
      });

      state.particles.forEach((particle) => {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        context.globalAlpha = alpha;
        context.strokeStyle = particle.color;
        context.fillStyle = particle.color;
        if (particle.preset === "rain") {
          context.lineWidth = Math.max(1, particle.radius);
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x - particle.vx * 0.025, particle.y - particle.vy * 0.025);
          context.stroke();
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          context.fill();
        }
      });
      const emitter = project.emitters[0];
      if (emitter) {
        context.globalAlpha = 0.75;
        context.strokeStyle = emitter.color;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(emitter.x, emitter.y, 10, 0, Math.PI * 2);
        context.moveTo(emitter.x - 15, emitter.y); context.lineTo(emitter.x + 15, emitter.y);
        context.moveTo(emitter.x, emitter.y - 15); context.lineTo(emitter.x, emitter.y + 15);
        context.stroke();
      }
      context.globalAlpha = 1;
      root.querySelector("[data-sim-particles]").textContent = state.particles.length;
      root.querySelector("[data-sim-points]").textContent = state.constraints.reduce((sum, body) => sum + body.points.length, 0);
      root.querySelector("[data-sim-collisions]").textContent = state.collision.checks;
      root.querySelector("[data-sim-time]").textContent = `${state.elapsed.toFixed(2)}s`;
      const playButton = root.querySelector("[data-sim-action=play]");
      playButton.textContent = simulator.isPaused() ? "Run" : "Pause";
      playButton.setAttribute("aria-pressed", String(!simulator.isPaused()));
    }

    function frame(timestamp) {
      if (destroyed || simulator.isPaused()) return;
      if (!lastFrame) lastFrame = timestamp;
      simulator.tick((timestamp - lastFrame) / 1000);
      lastFrame = timestamp;
      draw();
      frameHandle = hostWindow.requestAnimationFrame(frame);
    }

    function play() {
      if (!context) { status("Canvas2D is unsupported; playback cannot start."); return false; }
      if (!capabilities.animationFrame) { status("Animation frames are unsupported; use Step for manual simulation."); return false; }
      if (!simulator.isPaused()) return true;
      simulator.play();
      lastFrame = 0;
      frameHandle = hostWindow.requestAnimationFrame(frame);
      draw();
      status("Simulation running.");
      return true;
    }

    function pause() {
      simulator.pause();
      if (frameHandle && typeof hostWindow.cancelAnimationFrame === "function") hostWindow.cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      draw();
      status("Simulation paused.");
      return true;
    }

    function applyProject(next, message) {
      const wasRunning = !simulator.isPaused();
      if (wasRunning) pause();
      project = normalizeProject(next);
      simulator.setProject(project);
      updateControls();
      draw();
      persist();
      status(message || "Project updated.");
      if (wasRunning) play();
      return clone(project);
    }

    function choosePreset(presetId) {
      if (!PRESETS[presetId]) return;
      const current = project.emitters[0] || defaultEmitter(presetId, project.settings.width, project.settings.height, "emitter-main");
      const next = defaultEmitter(presetId, project.settings.width, project.settings.height, current.id);
      next.x = current.x;
      next.y = current.y;
      project.emitters = [next].concat(project.emitters.slice(1));
      applyProject(project, `${PRESETS[presetId].label} preset loaded.`);
    }

    function triggerBurst(x, y) {
      const emitter = project.emitters[0];
      if (!emitter) return;
      simulator.emit(emitter.id, emitter.burst, x, y);
      draw();
      status(`${emitter.name} burst emitted.`);
    }

    function download() {
      const content = exportProject(project);
      if (!capabilities.download) { status("File download is unsupported; project JSON remains available through the API."); return content; }
      const blob = new hostWindow.Blob([content], { type: "application/json" });
      const url = hostWindow.URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = `${safeId(project.meta.name, "simulation-project")}.hhsim.json`;
      link.click();
      hostWindow.setTimeout(() => hostWindow.URL.revokeObjectURL(url), 0);
      status("Project JSON exported.");
      return content;
    }

    function onClick(event) {
      const button = event.target.closest && event.target.closest("[data-sim-action],[data-sim-preset]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.simPreset) { choosePreset(button.dataset.simPreset); return; }
      const action = button.dataset.simAction;
      if (action === "play") { if (simulator.isPaused()) play(); else pause(); }
      else if (action === "step") { pause(); simulator.stepOnce(); draw(); status("Advanced one fixed step."); }
      else if (action === "reset") { simulator.reset(); draw(); status("Simulation reset to its seeded initial state."); }
      else if (action === "burst") triggerBurst();
      else if (action === "export") download();
    }

    function onChange(event) {
      const targetNode = event.target;
      if (targetNode.matches("[data-sim-name]")) {
        project.meta.name = cleanText(targetNode.value, "Simulation Lab", 96);
        targetNode.value = project.meta.name;
        persist();
        status("Project name saved locally.");
        return;
      }
      if (targetNode.matches("[data-sim-emitter]")) {
        const emitter = project.emitters[0];
        if (!emitter) return;
        const field = targetNode.dataset.simEmitter;
        emitter[field] = field === "burst"
          ? Math.round(clamp(targetNode.value, 1, 160))
          : clamp(targetNode.value, 0, 300);
        applyProject(project, "Emitter updated.");
        return;
      }
      if (targetNode.matches("[data-sim-constraint]")) {
        project.constraints = targetNode.value === "none" ? [] : [defaultConstraint(targetNode.value, project.settings.width)];
        applyProject(project, targetNode.value === "none" ? "Constraint disabled." : `${targetNode.value} constraint loaded.`);
        return;
      }
      if (targetNode.matches("[data-sim-setting]")) {
        const field = targetNode.dataset.simSetting;
        if (field === "collisions") project.settings.collisions = targetNode.checked;
        else if (field === "seed") project.settings.seed = hashSeed(targetNode.value);
        else if (field === "particleCap") project.settings.particleCap = Math.round(clamp(targetNode.value, 16, PERFORMANCE.MAX_PARTICLES));
        else if (field === "gravity") project.settings.gravity = clamp(targetNode.value, -2000, 2000);
        else if (field === "bounce") project.settings.bounce = clamp(targetNode.value, 0, 1);
        else if (field === "spring") project.settings.spring = clamp(targetNode.value, 0.05, 1);
        applyProject(project, "Physics settings updated.");
      }
    }

    function canvasPosition(event) {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width) * project.settings.width, 0, project.settings.width),
        y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height) * project.settings.height, 0, project.settings.height)
      };
    }

    function onPointerDown(event) {
      if (!context || !project.emitters[0]) return;
      const position = canvasPosition(event);
      project.emitters[0].x = position.x;
      project.emitters[0].y = position.y;
      applyProject(project, "Emitter moved.");
      triggerBurst(position.x, position.y);
      canvas.focus();
    }

    function onKeyDown(event) {
      const targetNode = event.target;
      const editing = targetNode && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(targetNode.tagName);
      if (targetNode === canvas) {
        const emitter = project.emitters[0];
        if (!emitter) return;
        const movement = event.shiftKey ? 20 : 5;
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "ArrowLeft") emitter.x = clamp(emitter.x - movement, 0, project.settings.width);
          if (event.key === "ArrowRight") emitter.x = clamp(emitter.x + movement, 0, project.settings.width);
          if (event.key === "ArrowUp") emitter.y = clamp(emitter.y - movement, 0, project.settings.height);
          if (event.key === "ArrowDown") emitter.y = clamp(emitter.y + movement, 0, project.settings.height);
          applyProject(project, "Emitter moved.");
          return;
        }
        if (event.key === "Enter") { event.preventDefault(); triggerBurst(); return; }
      }
      if (editing) return;
      if (event.key === " ") {
        event.preventDefault();
        if (simulator.isPaused()) play(); else pause();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        simulator.reset(); draw(); status("Simulation reset to its seeded initial state.");
      } else if (event.key === "ArrowRight" && simulator.isPaused()) {
        event.preventDefault();
        simulator.stepOnce(); draw(); status("Advanced one fixed step.");
      }
    }

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    draw();
    if (!capabilities.canvas2d) status("Canvas2D is unsupported; project export remains available.");
    else if (!storage) status("Autosave unavailable; export remains available.");
    else if (capabilities.reducedMotion) status("Reduced motion is active; preview starts paused.");
    else if (settings.autoplay !== false) play();

    const controller = {
      getProject: () => clone(project),
      setProject: (next) => applyProject(next, "Project loaded."),
      getState: () => simulator.getState(),
      getCapabilities: () => Object.assign({}, capabilities),
      play,
      pause,
      step: () => { pause(); const state = simulator.stepOnce(); draw(); return state; },
      reset: () => { const state = simulator.reset(); draw(); return state; },
      emit: (preset, count, x, y) => { const emitted = simulator.emit(preset, count, x, y); draw(); return emitted; },
      exportProject: () => exportProject(project),
      downloadProject: download,
      destroy: () => {
        if (destroyed) return false;
        destroyed = true;
        simulator.pause();
        clearTimeout(saveTimer);
        if (frameHandle && typeof hostWindow.cancelAnimationFrame === "function") hostWindow.cancelAnimationFrame(frameHandle);
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("keydown", onKeyDown);
        canvas.removeEventListener("pointerdown", onPointerDown);
        root.innerHTML = "";
        mounted.delete(root);
        return true;
      }
    };
    mounted.set(root, controller);
    return controller;
  }

  function unmount(target) {
    const root = typeof target === "string" && runtime.document ? runtime.document.querySelector(target) : target;
    const controller = root && mounted.get(root);
    return controller ? controller.destroy() : false;
  }

  function mountAll(scope) {
    const doc = scope && typeof scope.querySelectorAll === "function" ? scope : runtime.document;
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    return Array.from(doc.querySelectorAll("[data-graphic-simulation]"), (root) => mount(root)).filter(Boolean);
  }

  const api = {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    PERFORMANCE,
    PRESETS: Object.fromEntries(Object.entries(PRESETS).map(([key, value]) => [key, Object.assign({}, value)])),
    CONSTRAINT_TYPES: CONSTRAINT_TYPES.slice(),
    createSeededRandom,
    createDefaultProject,
    normalizeProject,
    defaultEmitter,
    defaultConstraint,
    createConstraintBody,
    solveDistanceLinks,
    stepConstraintBody,
    resolveParticleCollisions,
    createSimulation,
    exportProject,
    importProject,
    detectCapabilities,
    mount,
    unmount,
    mountAll
  };

  if (runtime && runtime.document) {
    mountAll();
    if (typeof runtime.MutationObserver === "function") {
      new runtime.MutationObserver(() => mountAll()).observe(runtime.document.documentElement, { childList: true, subtree: true });
    }
  }
  return api;
}));
