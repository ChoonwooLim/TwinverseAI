/**
 * Hidden-avatar (first-person) view helpers. Pure functions, no three.js.
 *
 * With the avatar hidden the camera orbits the eye point at a tiny radius, which is a free look
 * from the eyes; zooming out turns it into an orbit around the invisible body, zooming all the way
 * in returns to eye level. Movement is relative to where the camera looks horizontally.
 */

export const FIRST_PERSON = Object.freeze({
  /** Camera glide in to the eyes and back out (s); a cut under reduced motion. */
  transitionSeconds: 0.4,
  /** The avatar disappears this far into the glide (so the camera is never seen inside the head). */
  hideAt: 0.8,
  /** Look limits above and below the horizon (degrees). */
  lookUpDeg: 85,
  lookDownDeg: 80,
  /** Eye height: the head bone plus this (m), or this share of the avatar's height. */
  eyeAboveHeadBone: 0.09,
  eyeShareOfHeight: 0.92,
  /** Orbit radius at eye level, and the distance below which the view counts as first person (m). */
  minDistance: 0.02,
  orbitThreshold: 0.6,
  /** Scrolling out of first person glides to this orbit distance; scrolling in below snapIn returns to the eyes (m). */
  orbitDistance: 3.5,
  snapInDistance: 1.2,
  /** Near plane in first person (m); the normal camera keeps its own. */
  near: 0.15,
});

export const AVATAR_HIDDEN_STORAGE_KEY = "twinverse.space.avatarHidden";

export function readStoredAvatarHidden(storage) {
  try {
    return storage?.getItem(AVATAR_HIDDEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredAvatarHidden(storage, hidden) {
  try {
    storage?.setItem(AVATAR_HIDDEN_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the choice simply is not remembered.
  }
}

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Eye height above the feet: from the head bone when it is plausible (between half and all of
 * the height), otherwise `eyeShareOfHeight` x height.
 */
export function eyeHeight({ headY, heightM }) {
  const height = isNumber(heightM) && heightM > 0 ? heightM : 1.75;
  if (isNumber(headY) && headY > height * 0.5 && headY < height) {
    return Math.min(height * 0.97, headY + FIRST_PERSON.eyeAboveHeadBone);
  }
  return height * FIRST_PERSON.eyeShareOfHeight;
}

/**
 * OrbitControls polar limits for the free look. The polar angle is measured from straight up to
 * the camera's offset from its target, so looking up 85 degrees is a polar angle of 175 degrees.
 */
export function firstPersonPolarLimits() {
  return {
    min: ((90 - FIRST_PERSON.lookDownDeg) * Math.PI) / 180,
    max: ((90 + FIRST_PERSON.lookUpDeg) * Math.PI) / 180,
  };
}

/**
 * World-space move direction from the camera's horizontal look direction (forwardX, forwardZ)
 * and the keys (forward / right in -1..1). Right of a view along +X is +Z (Y up).
 * @returns {{ x: number, z: number, moving: boolean }}
 */
export function viewRelativeMove(forwardX, forwardZ, { forward = 0, right = 0 } = {}) {
  const length = Math.hypot(forwardX, forwardZ) || 1;
  const fx = forwardX / length;
  const fz = forwardZ / length;
  const wx = fx * forward - fz * right;
  const wz = fz * forward + fx * right;
  const wl = Math.hypot(wx, wz);
  return wl > 1e-6 ? { x: wx / wl, z: wz / wl, moving: true } : { x: 0, z: 0, moving: false };
}

/** The avatar's yaw (rotation.y) for a horizontal look direction. */
export function viewYaw(forwardX, forwardZ) {
  return Math.atan2(forwardX, forwardZ);
}

/** Progress 0..1 of the view transition at `elapsed` seconds (eased; a cut under reduced motion). */
export function transitionAmount(elapsed, duration = FIRST_PERSON.transitionSeconds, reducedMotion = false) {
  if (reducedMotion || !(duration > 0)) return 1;
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return t * t * (3 - 2 * t);
}
