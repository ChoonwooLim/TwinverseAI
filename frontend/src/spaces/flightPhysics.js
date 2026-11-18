/**
 * Flight for the avatar. Pure functions, no three.js.
 *
 * State: { mode: "walk" | "takeoff" | "fly" | "landing", x, y, z, vx, vy, vz, ... } where (x, y, z)
 * is the avatar's feet. Rules while flying:
 *   - never below the floor: feet stay `minClearance` above heightAt() (the nearest valid floor
 *     where there is none), and on top of walking blockers when within `blockerHeight` of them,
 *   - ceiling at `ceilingY`, horizontal limit = `ground` grown by `horizontalMargin`,
 *   - walking blockers (boxes, circles, no-floor cells, door blockers) apply only while the feet are
 *     within `blockerHeight` of the floor, with sliding as in walkPhysics,
 *   - `colliders.volumes` ([{ minX, maxX, minY, maxY, minZ, maxZ }], world space) are solid for a
 *     vertical capsule of `bodyRadius` and `bodyHeight`, resolved along the axis of least
 *     penetration in sub-steps of at most `maxSubstep`, so nothing is tunnelled through.
 * Speeds approach their targets exponentially, so there are no instant stops in the air.
 */
import {
  DEFAULT_RADIUS,
  findNearestFloor,
  floorAt,
  floorWithTops,
  heightAt,
  inWalkRegion,
  topAt,
  walkBlockerContact,
  walkableSpot,
} from "./walkPhysics.js";

export const FLIGHT = Object.freeze({
  /** Horizontal speeds (m/s). */
  cruiseSpeed: 14,
  fastSpeed: 36,
  /** Vertical speeds (m/s). */
  verticalSpeed: 8,
  verticalFastSpeed: 16,
  /** Rates (1/s) at which velocity approaches its target: speeding up, gliding to a stop, vertical. */
  acceleration: 2.2,
  deceleration: 1.6,
  verticalAcceleration: 3.5,
  /** Take-off: rise this far over this time, then hover. */
  takeoffHeight: 1.5,
  takeoffSeconds: 0.5,
  /** Landing: descend at up to landingSpeed, slowing to touchdownSpeed near the floor (rate per metre). */
  landingSpeed: 10,
  touchdownSpeed: 1.2,
  landingEase: 2.5,
  landingGlideSpeed: 8,
  landingSearchM: 30,
  landingTimeoutSeconds: 12,
  /** Limits. */
  minClearance: 0.3,
  ceilingY: 300,
  horizontalMargin: 150,
  /** Walking blockers count while the feet are within this height of the floor. */
  blockerHeight: 2.5,
  /** Body capsule against volumes. */
  bodyRadius: 0.5,
  bodyHeight: 1.8,
  maxSubstep: 0.2,
  /** The avatar's ground shadow is kept in shadow range up to this altitude. */
  shadowAltitude: 80,
});

const MAX_SUBSTEPS = 4000;
const EPSILON = 1e-6;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const smooth = (t) => t * t * (3 - 2 * t);

/** A walking avatar at `position` (feet). */
export function createFlightState(position = {}) {
  const x = isNumber(position.x) ? position.x : 0;
  const y = isNumber(position.y) ? position.y : 0;
  const z = isNumber(position.z) ? position.z : 0;
  return { mode: "walk", x, y, z, vx: 0, vy: 0, vz: 0, t: 0, baseY: y, target: null, landingSeconds: 0 };
}

export const isFlying = (state) => Boolean(state) && state.mode !== "walk";

/** Floor for flight: heightAt() (nearest valid floor where there is none) or a low obstacle's top. */
function flightFloor(x, z, colliders) {
  const floor = heightAt(x, z, colliders);
  const top = topAt(x, z, colliders);
  return top === null ? floor : Math.max(floor, top);
}

/** Feet height above the floor below (the nearest valid floor where there is none). */
export function altitudeAboveFloor(state, colliders) {
  return state.y - flightFloor(state.x, state.z, colliders);
}

/**
 * Take off from walking: rise `takeoffHeight` over `takeoffSeconds`, then hover. With
 * `airborne` (mid-jump) flight starts at the current height and vertical speed instead.
 */
export function startFlight(state, colliders, { airborne = false } = {}) {
  if (state.mode !== "walk") return state;
  if (airborne) return { ...state, mode: "fly", t: 0, target: null };
  const floor = flightFloor(state.x, state.z, colliders);
  return { ...state, mode: "takeoff", t: 0, baseY: Math.max(state.y, floor), vy: 0, target: null };
}

/**
 * Where to land from above (x, z): the spot itself when a walker could stand there, otherwise the
 * nearest walkable spot (from the ground's edge when outside it), with the reason.
 */
export function landingTarget(x, z, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [] } = {}) {
  if (walkableSpot(x, z, colliders, { radius, extraBoxes })) return { x, z, reason: null };
  const inside = inWalkRegion(x, z, colliders, radius);
  const reason = !inside ? "outside the walkable area" : floorAt(x, z, colliders) === null ? "no floor" : "blocked";
  let sx = x;
  let sz = z;
  const ground = colliders?.ground;
  if (ground && !inside) {
    sx = clamp(x, ground.minX + radius, ground.maxX - radius);
    sz = clamp(z, ground.minZ + radius, ground.maxZ - radius);
  }
  const spot = findNearestFloor(sx, sz, colliders, { radius, extraBoxes, maxDistance: FLIGHT.landingSearchM });
  return spot ? { x: spot.x, z: spot.z, reason } : { x, z, reason: `${reason}, and no walkable floor nearby` };
}

/**
 * Starts landing. Returns the new state and, when the spot below cannot be walked on, a
 * `rescue` { from, to, reason } describing where it lands instead.
 */
export function startLanding(state, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [] } = {}) {
  if (state.mode === "walk") return { state, rescue: null };
  const target = landingTarget(state.x, state.z, colliders, { radius, extraBoxes });
  const rescue = target.reason
    ? { from: { x: state.x, z: state.z }, to: { x: target.x, z: target.z }, reason: target.reason }
    : null;
  return { state: { ...state, mode: "landing", target: { x: target.x, z: target.z }, landingSeconds: 0 }, rescue };
}

/** Back in the air from landing (the visitor pressed the flight key again). */
export function resumeFlight(state) {
  return state.mode === "landing" ? { ...state, mode: "fly", target: null } : state;
}

function validVolumes(volumes) {
  if (!Array.isArray(volumes)) return [];
  return volumes.filter((v) => v && [v.minX, v.maxX, v.minY, v.maxY, v.minZ, v.maxZ].every(isNumber)
    && v.minX < v.maxX && v.minY < v.maxY && v.minZ < v.maxZ);
}

/** Pushes the body capsule (feet at y) out of every volume along its axis of least penetration. */
export function resolveVolumes(x, y, z, volumes) {
  const r = FLIGHT.bodyRadius;
  const list = validVolumes(volumes);
  let px = x;
  let py = y;
  let pz = z;
  for (let iteration = 0; iteration < 4; iteration++) {
    let pushed = false;
    for (const v of list) {
      const bottom = py + r;
      const top = py + FLIGHT.bodyHeight - r;
      const minX = v.minX - r;
      const maxX = v.maxX + r;
      const minZ = v.minZ - r;
      const maxZ = v.maxZ + r;
      if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ || top <= v.minY - r || bottom >= v.maxY + r) continue;
      const options = [
        [px - minX, "x", -1],
        [maxX - px, "x", 1],
        [pz - minZ, "z", -1],
        [maxZ - pz, "z", 1],
        [top - (v.minY - r), "y", -1],
        [v.maxY + r - bottom, "y", 1],
      ];
      let best = options[0];
      for (const option of options) if (option[0] < best[0]) best = option;
      const amount = (best[0] + EPSILON) * best[2];
      if (best[1] === "x") px += amount;
      else if (best[1] === "z") pz += amount;
      else py += amount;
      pushed = true;
    }
    if (!pushed) break;
  }
  return { x: px, y: py, z: pz };
}

function horizontalLimits(colliders) {
  const ground = colliders?.ground;
  if (!ground) return null;
  const m = FLIGHT.horizontalMargin;
  return { minX: ground.minX - m, maxX: ground.maxX + m, minZ: ground.minZ - m, maxZ: ground.maxZ + m };
}

/**
 * Moves the feet by (dx, dy, dz) with every flight rule applied.
 * @returns {{ x: number, y: number, z: number, clamp: null | "floor" | "blocker" | "ceiling" }}
 */
export function moveFlying(position, dx, dy, dz, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [], clearance = FLIGHT.minClearance } = {}) {
  const length = Math.hypot(dx, dy, dz);
  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(length / FLIGHT.maxSubstep)));
  const sx = dx / steps;
  const sy = dy / steps;
  const sz = dz / steps;
  const limits = horizontalLimits(colliders);
  const volumes = colliders?.volumes;
  let { x, y, z } = position;
  let clampKind = null;
  const lowAt = (px, pz) => y - heightAt(px, pz, colliders) < FLIGHT.blockerHeight;
  // Obstacles with a top stop blocking once the feet are above it.
  const contactAt = (px, pz) => walkBlockerContact(px, pz, colliders, radius, extraBoxes, y);
  const blocked = (px, pz) => lowAt(px, pz) && contactAt(px, pz) !== null;

  for (let i = 0; i < steps; i++) {
    // Horizontal, with walking blockers near the floor (a body already touching one may leave).
    let nx = x + sx;
    let nz = z + sz;
    if (limits) {
      nx = clamp(nx, limits.minX, limits.maxX);
      nz = clamp(nz, limits.minZ, limits.maxZ);
    }
    if ((nx !== x || nz !== z) && !blocked(x, z) && lowAt(nx, nz)) {
      const contact = contactAt(nx, nz);
      if (contact) {
        const mx = nx - x;
        const mz = nz - z;
        const into = mx * contact.x + mz * contact.z;
        let placed = false;
        if ((contact.x || contact.z) && into < 0) {
          const tx = nx - into * contact.x;
          const tz = nz - into * contact.z;
          if (!blocked(tx, tz)) {
            nx = tx;
            nz = tz;
            placed = true;
          }
        }
        if (!placed) {
          if (mx && !blocked(x + mx, z)) nz = z;
          else if (mz && !blocked(x, z + mz)) nx = x;
          else {
            nx = x;
            nz = z;
          }
        }
      }
    }
    x = nx;
    z = nz;
    y += sy;

    // Solid volumes.
    if (volumes) ({ x, y, z } = resolveVolumes(x, y, z, volumes));

    // Floor (or the top of a blocker the feet are over) and ceiling.
    clampKind = null;
    const floor = flightFloor(x, z, colliders);
    const overBlocker = y - floor < FLIGHT.blockerHeight && contactAt(x, z) !== null;
    const minY = floor + (overBlocker ? FLIGHT.blockerHeight : clearance);
    if (y <= minY + EPSILON) {
      y = minY;
      clampKind = overBlocker ? "blocker" : "floor";
    }
    if (y >= FLIGHT.ceilingY) {
      y = FLIGHT.ceilingY;
      clampKind = "ceiling";
    }
  }
  return { x, y, z, clamp: clampKind };
}

/** The part of the intended speed that was actually achieved (same sign, never larger). */
function keptSpeed(actual, intended) {
  return intended >= 0 ? clamp(actual, 0, intended) : clamp(actual, intended, 0);
}

function landed(state, colliders) {
  const floor = floorWithTops(state.x, state.z, colliders);
  return { ...state, mode: "walk", y: floor ?? heightAt(state.x, state.z, colliders), vx: 0, vy: 0, vz: 0, target: null, t: 0, landingSeconds: 0 };
}

/**
 * Advances flight by `dt` seconds.
 * @param {object} state
 * @param {{ moveX?: number, moveZ?: number, vertical?: number, fast?: boolean }} input world-space
 *   wish direction (length up to 1), vertical -1 (down) .. 1 (up), fast while Shift is held
 * @param {number} dt
 * @param {object} colliders
 * @param {{ radius?: number, extraBoxes?: object[] }} [options] walking radius and door blockers
 * @returns {{ state: object, landed: boolean, rescue: null | { from, to, reason }, forced: boolean }}
 */
export function stepFlight(state, input, dt, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [] } = {}) {
  let s = { ...state };
  const result = { state: s, landed: false, rescue: null, forced: false };
  if (s.mode === "walk" || !(dt > 0)) return result;
  const fast = Boolean(input?.fast);
  let wishX = isNumber(input?.moveX) ? input.moveX : 0;
  let wishZ = isNumber(input?.moveZ) ? input.moveZ : 0;
  const wishLength = Math.hypot(wishX, wishZ);
  if (wishLength > 1) {
    wishX /= wishLength;
    wishZ /= wishLength;
  }
  const vertical = clamp(isNumber(input?.vertical) ? input.vertical : 0, -1, 1);

  if (s.mode === "takeoff" || s.mode === "fly") {
    const speed = fast ? FLIGHT.fastSpeed : FLIGHT.cruiseSpeed;
    const rate = wishLength > EPSILON ? FLIGHT.acceleration : FLIGHT.deceleration;
    s.vx = approach(s.vx, wishX * speed, rate, dt);
    s.vz = approach(s.vz, wishZ * speed, rate, dt);
  }
  if (s.mode === "takeoff") {
    s.t += dt;
    const u = clamp(s.t / FLIGHT.takeoffSeconds, 0, 1);
    s.vy = (s.baseY + FLIGHT.takeoffHeight * smooth(u) - s.y) / dt;
    if (u >= 1) s.mode = "fly";
  } else if (s.mode === "fly") {
    const speed = fast ? FLIGHT.verticalFastSpeed : FLIGHT.verticalSpeed;
    s.vy = approach(s.vy, vertical * speed, FLIGHT.verticalAcceleration, dt);
  } else if (s.mode === "landing") {
    s.landingSeconds += dt;
    const dx = s.target.x - s.x;
    const dz = s.target.z - s.z;
    const distance = Math.hypot(dx, dz);
    const glide = Math.min(FLIGHT.landingGlideSpeed, distance * 2);
    s.vx = approach(s.vx, distance > EPSILON ? (dx / distance) * glide : 0, 4, dt);
    s.vz = approach(s.vz, distance > EPSILON ? (dz / distance) * glide : 0, 4, dt);
    const altitude = altitudeAboveFloor(s, colliders);
    const down = Math.min(FLIGHT.landingSpeed, Math.max(FLIGHT.touchdownSpeed, altitude * FLIGHT.landingEase));
    s.vy = approach(s.vy, -down, 6, dt);
  }

  const before = { x: s.x, y: s.y, z: s.z };
  const moved = moveFlying(before, s.vx * dt, s.vy * dt, s.vz * dt, colliders, {
    radius,
    extraBoxes,
    clearance: s.mode === "fly" ? FLIGHT.minClearance : 0,
  });
  s.x = moved.x;
  s.y = moved.y;
  s.z = moved.z;
  // Velocity follows what actually happened, so pushing into a wall or the floor builds up nothing;
  // a push out of the floor or a volume never adds speed.
  s.vx = keptSpeed((moved.x - before.x) / dt, s.vx);
  s.vz = keptSpeed((moved.z - before.z) / dt, s.vz);
  if (s.mode !== "takeoff") s.vy = keptSpeed((moved.y - before.y) / dt, s.vy);

  if (s.mode === "fly" && vertical < 0 && moved.clamp) {
    // Descending onto the floor lands; onto something that cannot be walked on, lands nearby.
    if (moved.clamp === "floor" && walkableSpot(s.x, s.z, colliders, { radius, extraBoxes })) {
      result.state = landed(s, colliders);
      result.landed = true;
      return result;
    }
    if (moved.clamp !== "ceiling") {
      const next = startLanding(s, colliders, { radius, extraBoxes });
      s = next.state;
      result.rescue = next.rescue;
    }
  }
  if (s.mode === "landing") {
    const distance = Math.hypot(s.target.x - s.x, s.target.z - s.z);
    const floor = floorWithTops(s.x, s.z, colliders);
    if (distance < 0.3 && floor !== null && s.y <= floor + 0.02 && walkableSpot(s.x, s.z, colliders, { radius, extraBoxes })) {
      result.state = landed(s, colliders);
      result.landed = true;
      return result;
    }
    if (s.landingSeconds > FLIGHT.landingTimeoutSeconds) {
      // The way down is blocked (e.g. by a roof): set the avatar down on the target.
      result.state = landed({ ...s, x: s.target.x, z: s.target.z }, colliders);
      result.landed = true;
      result.forced = true;
      return result;
    }
  }
  result.state = s;
  return result;
}

/**
 * Shadow range that keeps the avatar's ground shadow in the cascades while it flies: the slant
 * distance from the avatar to its shadow plus a margin, for altitudes up to `shadowAltitude`.
 */
export function flightShadowFar(baseMaxFar, altitude, sunElevationDeg) {
  const h = clamp(isNumber(altitude) ? altitude : 0, 0, FLIGHT.shadowAltitude);
  if (h < 5) return baseMaxFar;
  const elevation = (clamp(isNumber(sunElevationDeg) ? sunElevationDeg : 45, 10, 89) * Math.PI) / 180;
  const needed = Math.hypot(h / Math.tan(elevation), h) + 60;
  return Math.round(Math.min(baseMaxFar * 2.5, Math.max(baseMaxFar, needed)));
}
