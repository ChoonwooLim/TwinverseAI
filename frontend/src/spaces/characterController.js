/**
 * Character controller for the walking avatar: gravity, jumping, falling off edges and landing.
 * Pure functions, no three.js.
 *
 * State: { x, y, z, vy, grounded, coyote, airTime, jumpLatched } with (x, y, z) at the feet.
 * Horizontal movement is the engine's (velocity x dt); this module applies the height rules:
 *   - grounded: floors up to `maxStep` above the feet can be walked onto; floors up to
 *     `snapDown` below are followed (stairs); anything lower and the body falls,
 *   - in the air: the body may move over floors at or below its feet (+ TOP_TOLERANCE) and lands
 *     on them coming down; higher floors are walls (with sliding) until the feet are above them,
 *   - obstacles with `topY` can be stood on; a grounded walker steps onto tops up to `maxStep`
 *     above its feet, higher ones block until the feet are above them (minus TOP_TOLERANCE);
 *     obstacles without it, door blockers and no-floor cells block at any height.
 * Vertical motion is integrated exactly for constant gravity, so the jump apex does not depend
 * on the frame rate.
 */
import {
  DEFAULT_RADIUS,
  TOP_TOLERANCE,
  characterSlide,
  findNearestFloor,
  floorWithTops,
  inWalkRegion,
} from "./walkPhysics.js";

export const CHARACTER = Object.freeze({
  /** Gravity (m/s^2) and terminal fall speed (m/s). */
  gravity: 22,
  terminalSpeed: 40,
  /** Jump apex above the take-off floor (m). */
  jumpApex: 1.4,
  /** Grounded: highest step walked onto, deepest drop followed without falling (m). */
  maxStep: 0.6,
  snapDown: 0.4,
  /** Coming down within this of the floor counts as landed (m). */
  landSnap: 0.05,
  /** A jump pressed this long after walking off an edge still works (s). */
  coyoteSeconds: 0.1,
  /** Horizontal acceleration in the air relative to the ground (used by the engine). */
  airControl: 0.6,
  /** Sub-step limits: horizontal metres, vertical metres. */
  maxSubstep: 0.1,
  maxFallStep: 0.25,
});

/** Launch speed for the jump apex: v = sqrt(2 g h). */
export const JUMP_SPEED = Math.sqrt(2 * CHARACTER.gravity * CHARACTER.jumpApex);

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const MAX_STEPS = 600;

/** A grounded character at (x, z), standing on the floor there. */
export function createCharacterState(position = {}, colliders = null) {
  const x = isNumber(position.x) ? position.x : 0;
  const z = isNumber(position.z) ? position.z : 0;
  const floor = colliders ? floorWithTops(x, z, colliders) : null;
  const y = floor ?? (isNumber(position.y) ? position.y : 0);
  return { x, y, z, vy: 0, grounded: true, coyote: 0, airTime: 0, jumpLatched: false };
}

/** An airborne character (e.g. after flight) at its current height. */
export function airborneState(position, vy = 0) {
  return { ...createCharacterState(position), y: position.y, vy, grounded: false };
}

/** Moves to the nearest walkable spot when the body ended up somewhere with no floor at all. */
function rescueSpot(x, z, colliders, radius, extraBoxes) {
  let sx = x;
  let sz = z;
  const ground = colliders?.ground;
  if (ground && !inWalkRegion(x, z, colliders, radius)) {
    sx = Math.min(ground.maxX - radius, Math.max(ground.minX + radius, x));
    sz = Math.min(ground.maxZ - radius, Math.max(ground.minZ + radius, z));
  }
  return findNearestFloor(sx, sz, colliders, { radius, extraBoxes }) ?? { x: sx, z: sz };
}

/**
 * Advances the character by `dt` seconds.
 * @param {object} state
 * @param {{ dx?: number, dz?: number, jump?: boolean }} input horizontal displacement wanted this
 *   frame and whether the jump key is held (one jump per press or landing)
 * @param {number} dt
 * @param {object} colliders
 * @param {{ radius?: number, extraBoxes?: object[] }} [options]
 * @returns {{ state: object, jumped: boolean, landed: boolean, fallSeconds: number, impactSpeed: number }}
 */
export function stepCharacter(state, input, dt, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [] } = {}) {
  const s = { ...state };
  const result = { state: s, jumped: false, landed: false, fallSeconds: 0, impactSpeed: 0 };
  if (!(dt > 0)) return result;
  const C = CHARACTER;
  const g = C.gravity;

  if (!input?.jump) s.jumpLatched = false;
  if (input?.jump && !s.jumpLatched && (s.grounded || s.coyote > 0)) {
    s.vy = JUMP_SPEED;
    s.grounded = false;
    s.coyote = 0;
    s.airTime = 0;
    s.jumpLatched = true;
    result.jumped = true;
  }

  const dx = isNumber(input?.dx) ? input.dx : 0;
  const dz = isNumber(input?.dz) ? input.dz : 0;
  const fallReach = Math.abs(s.vy) * dt + 0.5 * g * dt * dt;
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(Math.hypot(dx, dz) / C.maxSubstep), Math.ceil(fallReach / C.maxFallStep)));
  const h = dt / steps;

  for (let i = 0; i < steps; i++) {
    const limitY = s.grounded ? s.y + C.maxStep : s.y + TOP_TOLERANCE;
    const moved = characterSlide(s.x, s.z, dx / steps, dz / steps, colliders, { radius, feetY: s.y, limitY, extraBoxes });
    s.x = moved.x;
    s.z = moved.z;
    let floor = floorWithTops(s.x, s.z, colliders);

    if (s.grounded) {
      if (floor !== null && floor >= s.y - C.snapDown) {
        s.y = floor;
        continue;
      }
      // Walked off an edge: fall, with a short grace period for a late jump.
      s.grounded = false;
      s.vy = 0;
      s.coyote = C.coyoteSeconds;
      s.airTime = 0;
    }

    s.airTime += h;
    s.coyote = Math.max(0, s.coyote - h);
    // Exact constant-gravity step, capped at the terminal speed.
    const vTerminal = -C.terminalSpeed;
    if (s.vy - g * h >= vTerminal) {
      s.y += s.vy * h - 0.5 * g * h * h;
      s.vy -= g * h;
    } else {
      const toTerminal = Math.max(0, (s.vy - vTerminal) / g);
      s.y += s.vy * toTerminal - 0.5 * g * toTerminal * toTerminal + vTerminal * (h - toTerminal);
      s.vy = vTerminal;
    }

    if (floor === null) {
      // No floor at all under the body (bad data or a teleport): move to the nearest walkable spot.
      const spot = rescueSpot(s.x, s.z, colliders, radius, extraBoxes);
      s.x = spot.x;
      s.z = spot.z;
      floor = floorWithTops(s.x, s.z, colliders);
      if (floor === null) continue;
    }
    if (s.vy <= 0 && s.y <= floor + C.landSnap) {
      result.landed = true;
      result.fallSeconds = s.airTime;
      result.impactSpeed = -s.vy;
      s.y = floor;
      s.vy = 0;
      s.grounded = true;
      s.coyote = 0;
      s.airTime = 0;
      s.jumpLatched = false; // one jump per landing, even while the key stays held
      if (!inWalkRegion(s.x, s.z, colliders, radius)) {
        const spot = rescueSpot(s.x, s.z, colliders, radius, extraBoxes);
        s.x = spot.x;
        s.z = spot.z;
        s.y = floorWithTops(s.x, s.z, colliders) ?? s.y;
      }
    } else if (s.y < floor) {
      // Rising past a ledge lip the body is already over.
      s.y = floor;
    }
  }
  return result;
}
