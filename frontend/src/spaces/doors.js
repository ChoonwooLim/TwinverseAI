/**
 * Automatic doors in placed scenery. Pure functions, no three.js.
 *
 * A door comes from a scenery.json placement entry; its leaves, trigger circle and blocker box
 * are in the scenery file's local frame and are moved into the world by the placement (position
 * and yaw, three.js `rotation.y` sense):
 *
 *   { "name": "center",
 *     "leaves": [ { "node": "Door_C_Left", "openYawDeg": -95 }, ... ],
 *     "trigger": { "x": 0, "z": 3.4, "radius": 9 },
 *     "blocker": { "minX": -2.5, "maxX": 2.5, "minZ": 3.1, "maxZ": 3.7 } }
 *
 * Each door is a small state machine, closed -> opening -> open -> closing, driven by the
 * visitor's horizontal distance to the trigger. `progress` runs linearly 0..1 and each leaf's
 * open fraction is an eased function of it, so a reversal mid-swing continues from the current
 * angle. While the least open leaf is below `blockBelowFraction`, the blocker is a solid box.
 */

export const DOOR_TIMING = Object.freeze({
  /** Seconds from closed to open. */
  openSeconds: 1.4,
  /** Seconds from open to closed. */
  closeSeconds: 1.8,
  /** The visitor must be farther than radius x closeDistanceFactor for this long before closing. */
  closeDelaySeconds: 2,
  closeDistanceFactor: 1.25,
  /** Each further leaf starts this much later, so the leaves do not move as one plate. */
  leafStaggerSeconds: 0.05,
  /** The blocker is solid while the least open leaf is below this fraction. */
  blockBelowFraction: 0.85,
  /** prefers-reduced-motion: short linear moves, no stagger. */
  reducedOpenSeconds: 0.5,
  reducedCloseSeconds: 0.6,
});

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const snap = (value) => (Math.abs(value) < 1e-12 ? 0 : value);

/** Slow start, slow settle; linear with reduced motion. */
function shape(t, reducedMotion) {
  return reducedMotion ? t : t * t * (3 - 2 * t);
}

/** Maps a scenery file's local (x, z) to world space for a placement { position, yawDeg }. */
export function placementTransform(placement) {
  const position = Array.isArray(placement?.position) ? placement.position : [];
  const px = Number(position[0]) || 0;
  const pz = Number(position[2]) || 0;
  const yawDeg = Number(placement?.yawDeg) || 0;
  const yaw = (yawDeg * Math.PI) / 180;
  const cos = snap(Math.cos(yaw));
  const sin = snap(Math.sin(yaw));
  const rightAngle = Math.abs(yawDeg / 90 - Math.round(yawDeg / 90)) < 1e-9;
  return {
    rightAngle,
    toWorld: (x, z) => ({ x: px + x * cos + z * sin, z: pz - x * sin + z * cos }),
  };
}

/** Why a door description cannot be used, or null when it is fine. */
export function doorError(spec) {
  if (!spec || typeof spec !== "object") return "missing description";
  const t = spec.trigger;
  if (!t || !isNumber(t.x) || !isNumber(t.z) || !(isNumber(t.radius) && t.radius > 0)) {
    return "trigger needs x, z and a positive radius";
  }
  const b = spec.blocker;
  if (!b || ![b.minX, b.maxX, b.minZ, b.maxZ].every(isNumber) || b.minX >= b.maxX || b.minZ >= b.maxZ) {
    return "blocker needs minX < maxX and minZ < maxZ";
  }
  if (spec.leaves !== undefined && !Array.isArray(spec.leaves)) return "leaves must be a list";
  return null;
}

/**
 * Builds a door in world space. `leaves` overrides the spec's list (the engine passes only the
 * leaves whose nodes it found). With a yaw that is not a right angle the blocker becomes the
 * world box around the turned one (`approximate` is then true).
 */
export function createDoor(spec, placement, { leaves } = {}) {
  const error = doorError(spec);
  if (error) throw new Error(`Door ${spec?.name ?? ""}: ${error}`);
  const transform = placementTransform(placement);
  const trigger = { ...transform.toWorld(spec.trigger.x, spec.trigger.z), radius: spec.trigger.radius };
  const b = spec.blocker;
  const corners = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ]].map(([x, z]) => transform.toWorld(x, z));
  const blocker = {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minZ: Math.min(...corners.map((c) => c.z)),
    maxZ: Math.max(...corners.map((c) => c.z)),
  };
  const leafList = (leaves ?? spec.leaves ?? [])
    .filter((leaf) => leaf && typeof leaf.node === "string" && leaf.node)
    .map((leaf) => ({ node: leaf.node, openYawDeg: Number(leaf.openYawDeg) || 0 }));
  return {
    name: typeof spec.name === "string" && spec.name ? spec.name : "door",
    trigger,
    blocker,
    // A leaf sweeps at most the blocker's longer side around its hinge.
    sweep: Math.max(b.maxX - b.minX, b.maxZ - b.minZ),
    approximate: !transform.rightAngle,
    leaves: leafList,
    phase: "closed",
    progress: 0,
    farSeconds: 0,
  };
}

/** True while the visitor's body is in the area the leaves sweep (blocker plus sweep and body radius). */
export function visitorInSweep(door, visitor, bodyRadius = 0.4) {
  if (!visitor) return false;
  const margin = bodyRadius + door.sweep;
  const b = door.blocker;
  return visitor.x >= b.minX - margin && visitor.x <= b.maxX + margin && visitor.z >= b.minZ - margin && visitor.z <= b.maxZ + margin;
}

/**
 * Advances a door by `dt` seconds.
 * @param {object} door from createDoor (mutated)
 * @param {number} dt
 * @param {{ visitor?: { x: number, z: number } | null, bodyRadius?: number, forceOpen?: boolean, reducedMotion?: boolean }} [input]
 */
export function updateDoor(door, dt, { visitor = null, bodyRadius = 0.4, forceOpen = false, reducedMotion = false } = {}) {
  const step = Math.max(0, Number(dt) || 0);
  const distance = visitor ? Math.hypot(visitor.x - door.trigger.x, visitor.z - door.trigger.z) : Infinity;
  // Never close on the visitor: inside the sweep area the door counts as wanted open.
  const inSweep = visitorInSweep(door, visitor, bodyRadius);
  const wantOpen = forceOpen || inSweep || distance <= door.trigger.radius;
  const far = !wantOpen && distance > door.trigger.radius * DOOR_TIMING.closeDistanceFactor;
  door.farSeconds = far ? door.farSeconds + step : 0;

  if (wantOpen) {
    if (door.phase === "closed" || door.phase === "closing") door.phase = "opening";
  } else if (door.farSeconds >= DOOR_TIMING.closeDelaySeconds && (door.phase === "open" || door.phase === "opening")) {
    door.phase = "closing";
  }

  if (door.phase === "opening") {
    door.progress += step / (reducedMotion ? DOOR_TIMING.reducedOpenSeconds : DOOR_TIMING.openSeconds);
    if (door.progress >= 1 - 1e-9) {
      door.progress = 1;
      door.phase = "open";
    }
  } else if (door.phase === "closing") {
    door.progress -= step / (reducedMotion ? DOOR_TIMING.reducedCloseSeconds : DOOR_TIMING.closeSeconds);
    if (door.progress <= 1e-9) {
      door.progress = 0;
      door.phase = "closed";
    }
  }
  return door;
}

/** Open fraction 0..1 of each leaf (eased, staggered). */
export function leafFractions(door, reducedMotion = false) {
  const count = door.leaves.length;
  if (!count) return [];
  const stagger = reducedMotion || count < 2
    ? 0
    : Math.min(DOOR_TIMING.leafStaggerSeconds / DOOR_TIMING.openSeconds, 0.5 / (count - 1));
  const span = 1 - (count - 1) * stagger;
  return door.leaves.map((_, i) => shape(clamp01((door.progress - i * stagger) / span), reducedMotion));
}

/** How open the door is: the least open leaf (or the eased progress without leaves). */
export function openFraction(door, reducedMotion = false) {
  const fractions = leafFractions(door, reducedMotion);
  return fractions.length ? Math.min(...fractions) : shape(clamp01(door.progress), reducedMotion);
}

/** Whether the door's blocker is a solid box right now. */
export function blockerActive(door, reducedMotion = false) {
  return openFraction(door, reducedMotion) < DOOR_TIMING.blockBelowFraction;
}

/** Blocker boxes of the doors that are not open enough to pass. */
export function activeDoorBoxes(doors, reducedMotion = false) {
  return doors.filter((door) => blockerActive(door, reducedMotion)).map((door) => door.blocker);
}

/** Whether any of `points` ({ x, z }) comes within the door's trigger radius. */
export function pathNearDoor(door, points) {
  return points.some((point) => Math.hypot(point.x - door.trigger.x, point.z - door.trigger.z) <= door.trigger.radius);
}
