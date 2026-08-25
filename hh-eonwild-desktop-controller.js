(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildDesktopController = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildDesktopController() {
  "use strict";

  /*
   * Renderer-neutral desktop gameplay math for HH EonWild.
   *
   * This module intentionally owns no browser events, renderer objects or
   * persistence. Integrations feed it normalized input and apply its outputs.
   */
  const VERSION = "1.1.0";
  const FORMAT = "hh-eonwild-desktop-controller-v1";
  const TAU = Math.PI * 2;
  const EPSILON = 1e-10;

  const LIMITS = Object.freeze({
    MIN_SENSITIVITY: 0.0001,
    MAX_SENSITIVITY: 0.02,
    MAX_POINTER_DELTA: 4096,
    MIN_CAMERA_DISTANCE: 0.1,
    MAX_CAMERA_DISTANCE: 50,
    MAX_FRAME_SECONDS: 0.25,
    MIN_FIXED_STEP_SECONDS: 1 / 300,
    MAX_FIXED_STEP_SECONDS: 1 / 15,
    MAX_SUB_STEPS: 64,
    MAX_TARGET_CANDIDATES: 256,
    MAX_TARGET_DISTANCE: 10000
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  }

  function wrapAngle(angle) {
    const normalized = ((finite(angle, 0) + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return normalized === -Math.PI ? Math.PI : normalized;
  }

  function shortestAngleDelta(from, to) {
    return wrapAngle(finite(to, 0) - finite(from, 0));
  }

  function rotateTowards(from, to, maximumDelta) {
    const delta = shortestAngleDelta(from, to);
    const step = clamp(Math.abs(finite(maximumDelta, 0)), 0, Math.PI);
    if (Math.abs(delta) <= step) return wrapAngle(to);
    return wrapAngle(finite(from, 0) + Math.sign(delta) * step);
  }

  const CAMERA_PROFILES = deepFreeze({
    ground: cameraProfile("ground", 5.5, 1.3, 10, 1.5, 65, -1.15, 0.65, 0.0024, 0.35, 6.5, 12, 16, 2.8),
    heavy: cameraProfile("heavy", 8.5, 2.5, 15, 2.8, 69, -1.05, 0.55, 0.0022, 0.65, 7, 7, 11, 1.75),
    small: cameraProfile("small", 3.2, 0.7, 7, 0.65, 62, -1.25, 0.75, 0.0027, 0.22, 5.5, 8.5, 13, 3.8),
    bird: cameraProfile("bird", 7, 1.5, 14, 1.4, 76, -1.35, 1.05, 0.0025, 0.42, 13, 12, 9, 2.7),
    aquatic: cameraProfile("aquatic", 6.5, 1.2, 13, 1.1, 72, -1.25, 1.05, 0.0023, 0.5, 9, 8, 7, 2.2),
    climbing: cameraProfile("climbing", 4.4, 0.9, 9, 1, 68, -1.35, 0.95, 0.0025, 0.3, 5.5, 10, 14, 3.2),
    burrow: cameraProfile("burrow", 2.6, 0.5, 5.5, 0.5, 60, -0.9, 0.5, 0.0021, 0.18, 3.5, 7, 12, 3.5)
  });

  const CAMERA_PROFILE_IDS = Object.freeze(Object.keys(CAMERA_PROFILES));

  function cameraProfile(id, distance, minDistance, maxDistance, height, fov, minPitch, maxPitch, sensitivity, collisionPadding, maxSpeed, acceleration, deceleration, turnRate) {
    return {
      id,
      distance,
      minDistance,
      maxDistance,
      height,
      fov,
      minPitch,
      maxPitch,
      sensitivityX: sensitivity,
      sensitivityY: sensitivity,
      invertY: false,
      zoomSpeed: 0.0045,
      collisionPadding,
      maxSpeed,
      sprintMultiplier: id === "heavy" ? 1.35 : 1.55,
      acceleration,
      deceleration,
      turnRate
    };
  }

  function getCameraProfile(profile = "ground") {
    if (typeof profile === "string") return CAMERA_PROFILES[profile] || CAMERA_PROFILES.ground;
    if (!profile || typeof profile !== "object") return CAMERA_PROFILES.ground;
    const base = CAMERA_PROFILES[profile.id] || CAMERA_PROFILES.ground;
    const valueOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const minDistance = clamp(valueOr(profile.minDistance, base.minDistance), LIMITS.MIN_CAMERA_DISTANCE, LIMITS.MAX_CAMERA_DISTANCE);
    const maxDistance = clamp(valueOr(profile.maxDistance, base.maxDistance), minDistance, LIMITS.MAX_CAMERA_DISTANCE);
    const minPitch = clamp(valueOr(profile.minPitch, base.minPitch), -Math.PI / 2 + 0.01, Math.PI / 2 - 0.02);
    const maxPitch = clamp(valueOr(profile.maxPitch, base.maxPitch), minPitch + 0.01, Math.PI / 2 - 0.01);
    return Object.freeze({
      ...base,
      minDistance,
      maxDistance,
      distance: clamp(valueOr(profile.distance, base.distance), minDistance, maxDistance),
      height: clamp(valueOr(profile.height, base.height), -10, 30),
      fov: clamp(valueOr(profile.fov, base.fov), 35, 120),
      minPitch,
      maxPitch,
      sensitivityX: clamp(valueOr(profile.sensitivityX, base.sensitivityX), LIMITS.MIN_SENSITIVITY, LIMITS.MAX_SENSITIVITY),
      sensitivityY: clamp(valueOr(profile.sensitivityY, base.sensitivityY), LIMITS.MIN_SENSITIVITY, LIMITS.MAX_SENSITIVITY),
      invertY: typeof profile.invertY === "boolean" ? profile.invertY : base.invertY,
      zoomSpeed: clamp(valueOr(profile.zoomSpeed, base.zoomSpeed), 0.0001, 0.1),
      collisionPadding: clamp(valueOr(profile.collisionPadding, base.collisionPadding), 0, 5),
      maxSpeed: clamp(valueOr(profile.maxSpeed, base.maxSpeed), 0, 100),
      sprintMultiplier: clamp(valueOr(profile.sprintMultiplier, base.sprintMultiplier), 1, 4),
      acceleration: clamp(valueOr(profile.acceleration, base.acceleration), 0.01, 200),
      deceleration: clamp(valueOr(profile.deceleration, base.deceleration), 0.01, 300),
      turnRate: clamp(valueOr(profile.turnRate, base.turnRate), 0.01, Math.PI * 8)
    });
  }

  function applyMouseLook(orientation = {}, pointerDelta = {}, options = {}) {
    const profile = getCameraProfile(options.profile || orientation.profile || "ground");
    const minPitch = clamp(options.minPitch, -Math.PI / 2 + 0.01, profile.maxPitch);
    const maxPitch = clamp(options.maxPitch, minPitch, Math.PI / 2 - 0.01);
    const sensitivityX = clamp(options.sensitivityX, LIMITS.MIN_SENSITIVITY, LIMITS.MAX_SENSITIVITY);
    const sensitivityY = clamp(options.sensitivityY, LIMITS.MIN_SENSITIVITY, LIMITS.MAX_SENSITIVITY);
    const resolvedSensitivityX = Number.isFinite(Number(options.sensitivityX)) ? sensitivityX : profile.sensitivityX;
    const resolvedSensitivityY = Number.isFinite(Number(options.sensitivityY)) ? sensitivityY : profile.sensitivityY;
    const invertY = typeof options.invertY === "boolean" ? options.invertY : profile.invertY;
    const movementX = clamp(pointerDelta.movementX, -LIMITS.MAX_POINTER_DELTA, LIMITS.MAX_POINTER_DELTA);
    const movementY = clamp(pointerDelta.movementY, -LIMITS.MAX_POINTER_DELTA, LIMITS.MAX_POINTER_DELTA);
    return Object.freeze({
      yaw: wrapAngle(finite(orientation.yaw, 0) + movementX * resolvedSensitivityX),
      pitch: clamp(
        finite(orientation.pitch, 0) + movementY * resolvedSensitivityY * (invertY ? 1 : -1),
        Number.isFinite(Number(options.minPitch)) ? minPitch : profile.minPitch,
        Number.isFinite(Number(options.maxPitch)) ? maxPitch : profile.maxPitch
      )
    });
  }

  function normalizePlanarInput(x, y) {
    const safeX = clamp(x, -1, 1);
    const safeY = clamp(y, -1, 1);
    const length = Math.hypot(safeX, safeY);
    if (length <= EPSILON) return Object.freeze({ x: 0, y: 0, magnitude: 0 });
    const scale = length > 1 ? 1 / length : 1;
    return Object.freeze({ x: safeX * scale, y: safeY * scale, magnitude: Math.min(1, length) });
  }

  function cameraRelativeMovement(input = {}, cameraYaw = 0) {
    const planar = normalizePlanarInput(input.x ?? input.moveX, input.y ?? input.moveY);
    const yaw = finite(cameraYaw, 0);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const x = planar.x * cos + planar.y * sin;
    const z = planar.y * cos - planar.x * sin;
    return Object.freeze({ x, z, magnitude: planar.magnitude });
  }

  function updateZoom(distance, wheelDelta, options = {}) {
    const profile = getCameraProfile(options.profile || "ground");
    const minimum = clamp(options.minDistance, LIMITS.MIN_CAMERA_DISTANCE, profile.maxDistance);
    const maximum = clamp(options.maxDistance, minimum, LIMITS.MAX_CAMERA_DISTANCE);
    const minDistance = Number.isFinite(Number(options.minDistance)) ? minimum : profile.minDistance;
    const maxDistance = Number.isFinite(Number(options.maxDistance)) ? maximum : profile.maxDistance;
    const speed = Number.isFinite(Number(options.zoomSpeed)) ? clamp(options.zoomSpeed, 0.0001, 0.1) : profile.zoomSpeed;
    return clamp(finite(distance, profile.distance) + clamp(wheelDelta, -10000, 10000) * speed, minDistance, maxDistance);
  }

  function resolveCameraCollisionDistance(desiredDistance, hitDistance, options = {}) {
    const profile = getCameraProfile(options.profile || "ground");
    const minimum = Number.isFinite(Number(options.minDistance))
      ? clamp(options.minDistance, LIMITS.MIN_CAMERA_DISTANCE, LIMITS.MAX_CAMERA_DISTANCE)
      : profile.minDistance;
    const maximum = Number.isFinite(Number(options.maxDistance))
      ? clamp(options.maxDistance, minimum, LIMITS.MAX_CAMERA_DISTANCE)
      : profile.maxDistance;
    const desired = clamp(desiredDistance, minimum, maximum);
    if (hitDistance == null || !Number.isFinite(Number(hitDistance)) || Number(hitDistance) < 0) return desired;
    const padding = Number.isFinite(Number(options.padding))
      ? clamp(options.padding, 0, 5)
      : profile.collisionPadding;
    return clamp(Number(hitDistance) - padding, minimum, desired);
  }

  function createControllerState(initial = {}) {
    return Object.freeze({
      x: finite(initial.x, 0),
      z: finite(initial.z, 0),
      velocityX: finite(initial.velocityX, 0),
      velocityZ: finite(initial.velocityZ, 0),
      heading: wrapAngle(initial.heading),
      elapsed: Math.max(0, finite(initial.elapsed, 0))
    });
  }

  function moveVectorTowards(currentX, currentZ, targetX, targetZ, maximumDelta) {
    const deltaX = finite(targetX, 0) - finite(currentX, 0);
    const deltaZ = finite(targetZ, 0) - finite(currentZ, 0);
    const distance = Math.hypot(deltaX, deltaZ);
    const step = Math.max(0, finite(maximumDelta, 0));
    if (distance <= step || distance <= EPSILON) return Object.freeze({ x: finite(targetX, 0), z: finite(targetZ, 0) });
    const scale = step / distance;
    return Object.freeze({ x: finite(currentX, 0) + deltaX * scale, z: finite(currentZ, 0) + deltaZ * scale });
  }

  function resolveLocomotionConfig(options = {}) {
    const profile = getCameraProfile(options.profile || "ground");
    return Object.freeze({
      maxSpeed: Number.isFinite(Number(options.maxSpeed)) ? clamp(options.maxSpeed, 0, 100) : profile.maxSpeed,
      sprintMultiplier: Number.isFinite(Number(options.sprintMultiplier)) ? clamp(options.sprintMultiplier, 1, 4) : profile.sprintMultiplier,
      acceleration: Number.isFinite(Number(options.acceleration)) ? clamp(options.acceleration, 0.01, 200) : profile.acceleration,
      deceleration: Number.isFinite(Number(options.deceleration)) ? clamp(options.deceleration, 0.01, 300) : profile.deceleration,
      turnRate: Number.isFinite(Number(options.turnRate)) ? clamp(options.turnRate, 0.01, Math.PI * 8) : profile.turnRate
    });
  }

  function stepControllerState(state, input = {}, fixedDeltaSeconds = 1 / 60, options = {}) {
    const current = createControllerState(state);
    const delta = clamp(fixedDeltaSeconds, LIMITS.MIN_FIXED_STEP_SECONDS, LIMITS.MAX_FIXED_STEP_SECONDS);
    const config = resolveLocomotionConfig(options);
    const movement = cameraRelativeMovement(input, input.cameraYaw);
    const speedScale = input.sprint === true ? config.sprintMultiplier : 1;
    const desiredVelocityX = movement.x * config.maxSpeed * speedScale;
    const desiredVelocityZ = movement.z * config.maxSpeed * speedScale;
    const rate = movement.magnitude > EPSILON ? config.acceleration : config.deceleration;
    const velocity = moveVectorTowards(
      current.velocityX,
      current.velocityZ,
      desiredVelocityX,
      desiredVelocityZ,
      rate * delta
    );
    const speed = Math.hypot(velocity.x, velocity.z);
    const heading = speed > EPSILON
      ? rotateTowards(current.heading, Math.atan2(velocity.x, velocity.z), config.turnRate * delta)
      : current.heading;
    return Object.freeze({
      x: current.x + velocity.x * delta,
      z: current.z + velocity.z * delta,
      velocityX: Math.abs(velocity.x) <= EPSILON ? 0 : velocity.x,
      velocityZ: Math.abs(velocity.z) <= EPSILON ? 0 : velocity.z,
      heading,
      elapsed: current.elapsed + delta
    });
  }

  function interpolateControllerState(previous, current, alpha) {
    const from = createControllerState(previous);
    const to = createControllerState(current);
    const amount = clamp(alpha, 0, 1);
    return Object.freeze({
      x: from.x + (to.x - from.x) * amount,
      z: from.z + (to.z - from.z) * amount,
      velocityX: from.velocityX + (to.velocityX - from.velocityX) * amount,
      velocityZ: from.velocityZ + (to.velocityZ - from.velocityZ) * amount,
      heading: wrapAngle(from.heading + shortestAngleDelta(from.heading, to.heading) * amount),
      elapsed: from.elapsed + (to.elapsed - from.elapsed) * amount
    });
  }

  class FixedTimestepController {
    constructor(options = {}) {
      this.stepSeconds = clamp(options.stepSeconds, LIMITS.MIN_FIXED_STEP_SECONDS, LIMITS.MAX_FIXED_STEP_SECONDS);
      if (!Number.isFinite(Number(options.stepSeconds))) this.stepSeconds = 1 / 120;
      this.maxFrameSeconds = Number.isFinite(Number(options.maxFrameSeconds))
        ? clamp(options.maxFrameSeconds, this.stepSeconds, LIMITS.MAX_FRAME_SECONDS)
        : LIMITS.MAX_FRAME_SECONDS;
      this.maxSubSteps = Number.isFinite(Number(options.maxSubSteps))
        ? Math.trunc(clamp(options.maxSubSteps, 1, LIMITS.MAX_SUB_STEPS))
        : LIMITS.MAX_SUB_STEPS;
      this.options = resolveLocomotionConfig(options);
      this.profile = typeof options.profile === "string" ? options.profile : "ground";
      this.state = createControllerState(options.initialState);
      this.previousState = this.state;
      this.accumulator = 0;
      this.droppedSeconds = 0;
    }

    advance(frameDeltaSeconds, input = {}, resolveStep = null) {
      const frameDelta = clamp(frameDeltaSeconds, 0, this.maxFrameSeconds);
      this.accumulator += frameDelta;
      const availableSteps = Math.floor((this.accumulator + EPSILON) / this.stepSeconds);
      const steps = Math.min(availableSteps, this.maxSubSteps);
      for (let index = 0; index < steps; index += 1) {
        const stepInput = typeof input === "function"
          ? (input(this.state.elapsed + this.stepSeconds, this.state) || {})
          : input;
        this.previousState = this.state;
        const proposedState = stepControllerState(this.state, stepInput, this.stepSeconds, { ...this.options, profile: this.profile });
        if (typeof resolveStep === "function") {
          let resolvedState = null;
          try { resolvedState = resolveStep(proposedState, this.state, stepInput, this.stepSeconds, index); }
          catch { /* A route-owned collision hook must fail open without breaking the fixed-step clock. */ }
          this.state = resolvedState && typeof resolvedState === "object" ? createControllerState({ ...proposedState, ...resolvedState }) : proposedState;
        } else this.state = proposedState;
      }
      this.accumulator = Math.max(0, this.accumulator - steps * this.stepSeconds);
      if (availableSteps > this.maxSubSteps) {
        const dropped = Math.max(0, this.accumulator - (this.stepSeconds - EPSILON));
        this.droppedSeconds += dropped;
        this.accumulator -= dropped;
      }
      const alpha = clamp(this.accumulator / this.stepSeconds, 0, 1);
      return Object.freeze({
        state: this.state,
        previousState: this.previousState,
        renderState: interpolateControllerState(this.previousState, this.state, alpha),
        alpha,
        steps,
        droppedSeconds: this.droppedSeconds
      });
    }

    reset(initialState = {}) {
      this.state = createControllerState(initialState);
      this.previousState = this.state;
      this.accumulator = 0;
      this.droppedSeconds = 0;
      return this.state;
    }
  }

  const TARGET_TYPES = Object.freeze(["animal", "food", "water", "trail", "nest", "interactive"]);

  function selectTarget(candidates, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const origin = vector3(options.origin, { x: 0, y: 0, z: 0 });
    const forward = normalizedVector3(options.forward, yawForward(options.cameraYaw));
    const maximumDistance = clamp(options.maxDistance, 0.1, LIMITS.MAX_TARGET_DISTANCE);
    const maxDistance = Number.isFinite(Number(options.maxDistance)) ? maximumDistance : 25;
    const maximumAngle = Number.isFinite(Number(options.maxAngle)) ? clamp(options.maxAngle, 0, Math.PI) : 0.18;
    const allowed = new Set(Array.isArray(options.allowedTypes) && options.allowedTypes.length
      ? options.allowedTypes.map((value) => String(value).toLowerCase()).filter((value) => TARGET_TYPES.includes(value))
      : ["animal"]);
    const lineOfSight = typeof options.hasLineOfSight === "function" ? options.hasLineOfSight : null;
    let best = null;

    for (let index = 0; index < Math.min(candidates.length, LIMITS.MAX_TARGET_CANDIDATES); index += 1) {
      const candidate = candidates[index];
      if (!candidate || typeof candidate !== "object" || candidate.targetable === false || candidate.active === false) continue;
      const type = String(candidate.type || "animal").toLowerCase();
      if (!allowed.has(type) || candidate.lineOfSight === false || candidate.occluded === true) continue;
      const position = candidate.position ? vector3(candidate.position, null) : null;
      const offset = position ? { x: position.x - origin.x, y: position.y - origin.y, z: position.z - origin.z } : null;
      const computedDistance = offset ? Math.hypot(offset.x, offset.y, offset.z) : NaN;
      const distance = Number.isFinite(Number(candidate.distance)) ? Math.max(0, Number(candidate.distance)) : computedDistance;
      if (!Number.isFinite(distance) || distance > maxDistance || distance <= EPSILON) continue;
      let angle = Number.isFinite(Number(candidate.angle)) ? Math.abs(Number(candidate.angle)) : NaN;
      if (!Number.isFinite(angle) && offset) {
        const dot = (offset.x * forward.x + offset.y * forward.y + offset.z * forward.z) / distance;
        angle = Math.acos(clamp(dot, -1, 1));
      }
      if (!Number.isFinite(angle) || angle > maximumAngle) continue;
      if (Number.isFinite(Number(candidate.occluderDistance)) && Number(candidate.occluderDistance) + EPSILON < distance) continue;
      if (lineOfSight && lineOfSight(candidate, Object.freeze({ origin, forward, distance, angle })) !== true) continue;
      const priority = clamp(candidate.priority, -10, 10);
      const score = (maximumAngle > EPSILON ? angle / maximumAngle : angle) * 0.7 + (distance / maxDistance) * 0.3 - priority * 0.01;
      if (!best || score < best.score || (score === best.score && distance < best.distance)) {
        best = Object.freeze({
          id: String(candidate.id ?? index).slice(0, 128),
          type,
          distance,
          angle,
          score,
          sourceIndex: index
        });
      }
    }
    return best;
  }

  function vector3(value, fallback) {
    if (!value || typeof value !== "object") return fallback;
    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? Object.freeze({ x, y, z }) : fallback;
  }

  function yawForward(yaw) {
    const angle = finite(yaw, 0);
    return Object.freeze({ x: Math.sin(angle), y: 0, z: Math.cos(angle) });
  }

  function normalizedVector3(value, fallback) {
    const source = vector3(value, fallback) || { x: 0, y: 0, z: 1 };
    const length = Math.hypot(source.x, source.y, source.z);
    if (length <= EPSILON) return Object.freeze({ x: 0, y: 0, z: 1 });
    return Object.freeze({ x: source.x / length, y: source.y / length, z: source.z / length });
  }

  const GAMEPLAY_STATES = Object.freeze({
    BOOT: "BOOT",
    READY: "READY",
    PLAYING: "PLAYING",
    PAUSED: "PAUSED",
    MAP: "MAP",
    CODEX: "CODEX",
    PHOTO_MODE: "PHOTO_MODE",
    GAME_OVER: "GAME_OVER",
    EXITING: "EXITING"
  });

  const INPUT_CONTEXTS = Object.freeze({
    NONE: "NONE",
    GAMEPLAY: "GAMEPLAY",
    PAUSE: "PAUSE",
    MAP: "MAP",
    CODEX: "CODEX",
    PHOTO: "PHOTO",
    TEXT_INPUT: "TEXT_INPUT"
  });

  const GAMEPLAY_EVENTS = Object.freeze({
    BOOT_COMPLETE: "BOOT_COMPLETE",
    START: "START",
    PAUSE: "PAUSE",
    RESUME: "RESUME",
    OPEN_MAP: "OPEN_MAP",
    CLOSE_MAP: "CLOSE_MAP",
    OPEN_CODEX: "OPEN_CODEX",
    CLOSE_CODEX: "CLOSE_CODEX",
    ENTER_PHOTO: "ENTER_PHOTO",
    EXIT_PHOTO: "EXIT_PHOTO",
    GAME_OVER: "GAME_OVER",
    EXIT: "EXIT",
    RESET: "RESET"
  });

  function contextForGameplayState(status) {
    const mapping = {
      PLAYING: INPUT_CONTEXTS.GAMEPLAY,
      PAUSED: INPUT_CONTEXTS.PAUSE,
      MAP: INPUT_CONTEXTS.MAP,
      CODEX: INPUT_CONTEXTS.CODEX,
      PHOTO_MODE: INPUT_CONTEXTS.PHOTO
    };
    return mapping[status] || INPUT_CONTEXTS.NONE;
  }

  function createGameplayState(initialStatus = GAMEPLAY_STATES.BOOT) {
    const status = Object.values(GAMEPLAY_STATES).includes(initialStatus) ? initialStatus : GAMEPLAY_STATES.BOOT;
    return Object.freeze({ status, context: contextForGameplayState(status), returnTo: null, revision: 0 });
  }

  function reduceGameplayState(machine, event) {
    const current = machine && typeof machine === "object" ? machine : createGameplayState(machine);
    const type = typeof event === "string" ? event : event?.type;
    let status = current.status;
    let returnTo = current.returnTo || null;

    if (type === GAMEPLAY_EVENTS.EXIT && status !== GAMEPLAY_STATES.EXITING) {
      status = GAMEPLAY_STATES.EXITING;
      returnTo = null;
    } else if (type === GAMEPLAY_EVENTS.RESET && (status === GAMEPLAY_STATES.EXITING || status === GAMEPLAY_STATES.GAME_OVER)) {
      status = GAMEPLAY_STATES.BOOT;
      returnTo = null;
    } else if (status === GAMEPLAY_STATES.BOOT && type === GAMEPLAY_EVENTS.BOOT_COMPLETE) {
      status = GAMEPLAY_STATES.READY;
    } else if (status === GAMEPLAY_STATES.READY && type === GAMEPLAY_EVENTS.START) {
      status = GAMEPLAY_STATES.PLAYING;
    } else if (status === GAMEPLAY_STATES.PLAYING && type === GAMEPLAY_EVENTS.PAUSE) {
      status = GAMEPLAY_STATES.PAUSED;
    } else if (status === GAMEPLAY_STATES.PAUSED && type === GAMEPLAY_EVENTS.RESUME) {
      status = GAMEPLAY_STATES.PLAYING;
    } else if ((status === GAMEPLAY_STATES.PLAYING || status === GAMEPLAY_STATES.PAUSED) && type === GAMEPLAY_EVENTS.OPEN_MAP) {
      returnTo = status;
      status = GAMEPLAY_STATES.MAP;
    } else if (status === GAMEPLAY_STATES.MAP && type === GAMEPLAY_EVENTS.CLOSE_MAP) {
      status = returnTo === GAMEPLAY_STATES.PLAYING ? GAMEPLAY_STATES.PLAYING : GAMEPLAY_STATES.PAUSED;
      returnTo = null;
    } else if ((status === GAMEPLAY_STATES.PLAYING || status === GAMEPLAY_STATES.PAUSED) && type === GAMEPLAY_EVENTS.OPEN_CODEX) {
      returnTo = status;
      status = GAMEPLAY_STATES.CODEX;
    } else if (status === GAMEPLAY_STATES.CODEX && type === GAMEPLAY_EVENTS.CLOSE_CODEX) {
      status = returnTo === GAMEPLAY_STATES.PLAYING ? GAMEPLAY_STATES.PLAYING : GAMEPLAY_STATES.PAUSED;
      returnTo = null;
    } else if ((status === GAMEPLAY_STATES.PLAYING || status === GAMEPLAY_STATES.PAUSED) && type === GAMEPLAY_EVENTS.ENTER_PHOTO) {
      returnTo = status;
      status = GAMEPLAY_STATES.PHOTO_MODE;
    } else if (status === GAMEPLAY_STATES.PHOTO_MODE && type === GAMEPLAY_EVENTS.EXIT_PHOTO) {
      status = returnTo === GAMEPLAY_STATES.PLAYING ? GAMEPLAY_STATES.PLAYING : GAMEPLAY_STATES.PAUSED;
      returnTo = null;
    } else if (type === GAMEPLAY_EVENTS.GAME_OVER && status !== GAMEPLAY_STATES.BOOT && status !== GAMEPLAY_STATES.READY) {
      status = GAMEPLAY_STATES.GAME_OVER;
      returnTo = null;
    } else {
      return current;
    }

    return Object.freeze({
      status,
      context: contextForGameplayState(status),
      returnTo,
      revision: Math.max(0, Math.trunc(finite(current.revision, 0))) + 1
    });
  }

  const POINTER_LOCK_STATES = Object.freeze({
    UNLOCKED: "UNLOCKED",
    REQUESTING: "REQUESTING",
    LOCKED: "LOCKED",
    RELEASING: "RELEASING",
    ERROR: "ERROR"
  });

  const POINTER_LOCK_EVENTS = Object.freeze({
    REQUEST: "REQUEST",
    LOCKED: "LOCKED",
    UNLOCKED: "UNLOCKED",
    RELEASE: "RELEASE",
    ERROR: "ERROR",
    RESET: "RESET"
  });

  function createPointerLockState() {
    return Object.freeze({
      status: POINTER_LOCK_STATES.UNLOCKED,
      desired: false,
      shouldPause: false,
      reason: null,
      error: null,
      revision: 0
    });
  }

  function reducePointerLock(state, event) {
    const current = state && typeof state === "object" ? state : createPointerLockState();
    const type = typeof event === "string" ? event : event?.type;
    let next = null;
    if (type === POINTER_LOCK_EVENTS.RESET) return createPointerLockState();
    if (type === POINTER_LOCK_EVENTS.REQUEST && current.status !== POINTER_LOCK_STATES.LOCKED) {
      next = { status: POINTER_LOCK_STATES.REQUESTING, desired: true, shouldPause: false, reason: null, error: null };
    } else if (type === POINTER_LOCK_EVENTS.LOCKED) {
      next = { status: POINTER_LOCK_STATES.LOCKED, desired: true, shouldPause: false, reason: null, error: null };
    } else if (type === POINTER_LOCK_EVENTS.RELEASE) {
      next = { status: POINTER_LOCK_STATES.RELEASING, desired: false, shouldPause: false, reason: null, error: null };
    } else if (type === POINTER_LOCK_EVENTS.UNLOCKED) {
      const unexpected = current.desired === true && current.status !== POINTER_LOCK_STATES.RELEASING;
      next = {
        status: POINTER_LOCK_STATES.UNLOCKED,
        desired: false,
        shouldPause: unexpected,
        reason: unexpected ? "LOCK_LOST" : null,
        error: null
      };
    } else if (type === POINTER_LOCK_EVENTS.ERROR) {
      next = {
        status: POINTER_LOCK_STATES.ERROR,
        desired: false,
        shouldPause: current.desired === true,
        reason: "LOCK_ERROR",
        error: String(event?.error || event?.code || "POINTER_LOCK_ERROR").slice(0, 96)
      };
    } else {
      return current;
    }
    return Object.freeze({ ...next, revision: Math.max(0, Math.trunc(finite(current.revision, 0))) + 1 });
  }

  return Object.freeze({
    VERSION,
    FORMAT,
    LIMITS,
    CAMERA_PROFILE_IDS,
    CAMERA_PROFILES,
    TARGET_TYPES,
    GAMEPLAY_STATES,
    INPUT_CONTEXTS,
    GAMEPLAY_EVENTS,
    POINTER_LOCK_STATES,
    POINTER_LOCK_EVENTS,
    clamp,
    wrapAngle,
    shortestAngleDelta,
    rotateTowards,
    getCameraProfile,
    applyMouseLook,
    normalizePlanarInput,
    cameraRelativeMovement,
    updateZoom,
    resolveCameraCollisionDistance,
    createControllerState,
    moveVectorTowards,
    resolveLocomotionConfig,
    stepControllerState,
    interpolateControllerState,
    FixedTimestepController,
    selectTarget,
    contextForGameplayState,
    createGameplayState,
    reduceGameplayState,
    createPointerLockState,
    reducePointerLock
  });
});
