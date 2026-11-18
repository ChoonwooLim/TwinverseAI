/**
 * Third-person camera placement. Pure functions, no three.js.
 *
 * The visitor's orbit (pitch, yaw and zoom around the orbit target) lives on its own object, which
 * only OrbitControls and the avatar-follow translation move. The drawn camera is derived from it
 * every frame: `placeCamera` reads the orbit offset (orbit position minus target), shortens it with
 * the spring arm and lifts the result above the floor, and never writes anything back. No sequence
 * of collisions or floor lifts can therefore change the orbit, and OrbitControls (which also
 * updates from its pointer handlers, between frames) never reads an adjusted position.
 *
 * The floor rule only counts floors the camera could plausibly stand over: `reachableFloor` walks
 * from the avatar towards the camera and stops at the first rise taller than `maxRise` (a wall top,
 * the gate platform, a roof, a plinth), which stays an obstacle for the arm. Stairs, ramps and
 * terrace edges are followed, also where long stairs end well above the avatar's own floor.
 */

import { allowedArmLength, armRays, updateArmLength } from "./cameraArm.js";

export const CAMERA_FLOOR = Object.freeze({
  /** The drawn camera stays this far above the floor under it (m). */
  clearance: 0.6,
  /** Spacing of the walk from the avatar to the camera (m; the heightfield cell size). */
  step: 0.25,
  /** Longest walk; beyond step x maxSamples the spacing grows. */
  maxSamples: 160,
  /** A floor rising more than this between two samples is an obstacle, not a floor (m). */
  maxRise: 1,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Floor under (toX, toZ) as reached from the avatar at (fromX, fromZ), whose floor is `fromFloor`:
 * the last floor of a straight walk towards it that never rises more than `maxRise` between two
 * samples and never crosses a spot without floor. Drops are followed.
 * @param {(x: number, z: number) => number | null} floorAt null where there is no floor
 */
export function reachableFloor(fromX, fromZ, fromFloor, toX, toZ, floorAt, {
  step = CAMERA_FLOOR.step,
  maxSamples = CAMERA_FLOOR.maxSamples,
  maxRise = CAMERA_FLOOR.maxRise,
} = {}) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const count = Math.min(maxSamples, Math.ceil(Math.hypot(dx, dz) / step));
  let floor = fromFloor;
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const next = floorAt(fromX + dx * t, fromZ + dz * t);
    if (next === null || !Number.isFinite(next) || next - floor > maxRise) break;
    floor = next;
  }
  return floor;
}

/** Right and up unit vectors of a camera looking along -direction (the arm's cast circle). */
export function armBasis(direction) {
  // forward = -direction; right = forward x (0, 1, 0); up = right x forward.
  let rx = direction.z;
  let rz = -direction.x;
  let length = Math.hypot(rx, rz);
  if (length < 1e-4) {
    rx = 1;
    rz = 0;
    length = 1;
  }
  rx /= length;
  rz /= length;
  const fx = -direction.x;
  const fy = -direction.y;
  const fz = -direction.z;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const ul = Math.hypot(ux, uy, uz) || 1;
  return { right: { x: rx, y: 0, z: rz }, up: { x: ux / ul, y: uy / ul, z: uz / ul } };
}

/**
 * Where the camera is drawn this frame. `offset` (orbit position minus target) is only read.
 * @param {{ x: number, y: number, z: number }} target
 * @param {{ x: number, y: number, z: number }} offset
 * @param {object} [options]
 * @param {{ previous: number | null, dt: number, cast?: ((rays: object[]) => number[]) | null } | null} [options.arm]
 *   spring arm state; null for no arm. Without `cast` nothing blocks (the arm only eases out).
 * @param {((x: number, z: number) => number) | null} [options.floorUnder] floor under a drawn position
 * @returns {{ x: number, y: number, z: number, wanted: number, armLength: number | null, lifted: boolean }}
 */
export function placeCamera(target, offset, { arm = null, floorUnder = null, clearance = CAMERA_FLOOR.clearance } = {}) {
  const wanted = Math.hypot(offset.x, offset.y, offset.z);
  let scale = 1;
  let armLength = null;
  if (arm && wanted > 1e-6) {
    const direction = { x: offset.x / wanted, y: offset.y / wanted, z: offset.z / wanted };
    let allowed = wanted;
    if (arm.cast) {
      const { right, up } = armBasis(direction);
      const hits = arm.cast(armRays(target, direction, wanted, right, up));
      if (hits) allowed = allowedArmLength(hits, wanted);
    }
    armLength = updateArmLength(arm.previous, wanted, allowed, arm.dt);
    scale = armLength / wanted;
  }
  const x = target.x + offset.x * scale;
  let y = target.y + offset.y * scale;
  const z = target.z + offset.z * scale;
  let lifted = false;
  if (floorUnder) {
    const floor = floorUnder(x, z) + clearance;
    if (y < floor) {
      y = floor;
      lifted = true;
    }
  }
  return { x, y, z, wanted, armLength, lifted };
}

/**
 * Orbit offset of the spawn view: `spawn.viewBackM` behind the look-at point (against the facing
 * `yaw`) and `spawn.viewRiseM` above it (defaults 9 and 3), with the distance and the angle from
 * straight up clamped to the orbit limits, so the first drag continues from exactly this view.
 */
export function spawnViewOffset(spawn, yaw, { minDistance, maxDistance, minPolarAngle, maxPolarAngle }) {
  const back = Number.isFinite(spawn?.viewBackM) ? Math.max(0, spawn.viewBackM) : 9;
  const rise = Number.isFinite(spawn?.viewRiseM) ? spawn.viewRiseM : 3;
  const distance = clamp(Math.hypot(back, rise), minDistance, maxDistance);
  const polar = clamp(Math.atan2(back, rise), minPolarAngle, maxPolarAngle);
  const horizontal = distance * Math.sin(polar);
  return { x: -Math.sin(yaw) * horizontal, y: distance * Math.cos(polar), z: -Math.cos(yaw) * horizontal };
}
