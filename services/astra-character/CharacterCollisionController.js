(function initCharacterCollisionController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class CharacterCollisionController {
    constructor(options = {}) { this.maxCorrection = A.clamp(options.maxCorrection || 0.18, 0.01, 0.5); this.actors = new Map(); }
    register(id, definition = {}) { const actorId = A.safeId(id, "actor.id"); this.actors.set(actorId, { id: actorId, position: A.vector3(definition.position), radius: A.clamp(definition.personalSpaceRadius || 0.58, 0.2, 3), combatRadius: A.clamp(definition.combatRadius || 0.42, 0.15, 3), priority: A.clamp(definition.priority ?? 0.5, 0, 1), player: definition.player === true, formationSlot: definition.formationSlot || null, correction: { x: 0, z: 0 } }); return this.actors.get(actorId); }
    unregister(id) { return this.actors.delete(id); }
    solve(options = {}) {
      const actors = [...this.actors.values()];
      actors.forEach((actor) => { actor.correction = { x: 0, z: 0 }; });
      for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < actors.length; rightIndex += 1) {
        const left = actors[leftIndex], right = actors[rightIndex];
        let dx = right.position.x - left.position.x, dz = right.position.z - left.position.z;
        let distance = Math.hypot(dx, dz);
        if (distance < 1e-4) { const seed = (left.id.length * 37 + right.id.length * 17) % 360 * Math.PI / 180; dx = Math.cos(seed); dz = Math.sin(seed); distance = 1; }
        const attacking = options.attackingId === left.id || options.attackingId === right.id;
        const required = (attacking ? left.combatRadius + right.combatRadius : left.radius + right.radius);
        if (distance >= required) continue;
        const penetration = Math.min(this.maxCorrection, required - distance);
        const leftShare = right.player ? 0.85 : A.clamp(1 - left.priority, 0.15, 0.85);
        const rightShare = left.player ? 0.85 : A.clamp(1 - right.priority, 0.15, 0.85);
        const total = leftShare + rightShare;
        left.correction.x -= dx / distance * penetration * leftShare / total;
        left.correction.z -= dz / distance * penetration * leftShare / total;
        right.correction.x += dx / distance * penetration * rightShare / total;
        right.correction.z += dz / distance * penetration * rightShare / total;
      }
      actors.forEach((actor) => { actor.correction.x = A.clamp(actor.correction.x, -this.maxCorrection, this.maxCorrection); actor.correction.z = A.clamp(actor.correction.z, -this.maxCorrection, this.maxCorrection); });
      return Object.fromEntries(actors.map((actor) => [actor.id, { ...actor.correction }]));
    }
    findValidSpawn(point, radius = 0.58) { let result = A.vector3(point); for (let ring = 0; ring < 8; ring += 1) { const blocked = [...this.actors.values()].some((actor) => Math.hypot(result.x - actor.position.x, result.z - actor.position.z) < radius + actor.radius); if (!blocked) return { valid: true, position: result }; const angle = ring * 2.39996; result = { x: point.x + Math.cos(angle) * (ring + 1) * radius, y: point.y || 0, z: point.z + Math.sin(angle) * (ring + 1) * radius }; } return { valid: false, position: A.vector3(point) }; }
    dispose() { this.actors.clear(); }
  }
  A.CharacterCollisionController = CharacterCollisionController;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterCollisionController;
})(typeof window !== "undefined" ? window : globalThis);
