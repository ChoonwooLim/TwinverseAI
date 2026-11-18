/**
 * Camera spring arm. Pure functions, no three.js.
 *
 * The orbit camera's position is a request: the arm runs from the target (the avatar's upper
 * body) towards it, and a thick cast (a centre ray plus four parallel rays on a circle of
 * `castRadius`) finds the nearest blocking surface. The camera stands `margin` in front of it,
 * never closer than `minDistance`. Pull-in is immediate (no clipping while turning); release
 * eases back out over about `releaseSeconds`. The wanted (zoom) distance is never overwritten.
 * Close to the avatar its model fades out, fully hidden below `hiddenBelow`.
 */

export const CAMERA_ARM = Object.freeze({
  margin: 0.3,
  minDistance: 0.25,
  castRadius: 0.28,
  releaseSeconds: 0.4,
  fadeStart: 0.9,
  hiddenBelow: 0.45,
});

/**
 * The five cast rays: each starts at target + offset and ends at target + direction x
 * (wanted + margin) + offset, the offsets being 0 and four points on a circle of `castRadius`
 * in the camera's right/up plane. `direction`, `right` and `up` are unit vectors { x, y, z }.
 * @returns {{ origin: {x,y,z}, end: {x,y,z} }[]}
 */
export function armRays(target, direction, wanted, right, up, { castRadius = CAMERA_ARM.castRadius, margin = CAMERA_ARM.margin } = {}) {
  const s = castRadius / Math.SQRT2;
  const offsets = [[0, 0], [s, s], [-s, s], [s, -s], [-s, -s]];
  const reach = wanted + margin;
  return offsets.map(([r, u]) => {
    const ox = target.x + right.x * r + up.x * u;
    const oy = target.y + right.y * r + up.y * u;
    const oz = target.z + right.z * r + up.z * u;
    return {
      origin: { x: ox, y: oy, z: oz },
      end: { x: ox + direction.x * reach, y: oy + direction.y * reach, z: oz + direction.z * reach },
    };
  });
}

/**
 * Arm length allowed by the cast: the nearest hit (distance along the arm; the rays are parallel)
 * minus the margin, but never below `minDistance` and never beyond `wanted`.
 * @param {number[]} hits distances along each ray, Infinity for no hit
 */
export function allowedArmLength(hits, wanted, { margin = CAMERA_ARM.margin, minDistance = CAMERA_ARM.minDistance } = {}) {
  let allowed = wanted;
  for (const hit of hits) {
    if (Number.isFinite(hit)) allowed = Math.min(allowed, hit - margin);
  }
  return Math.min(wanted, Math.max(Math.min(minDistance, wanted), allowed));
}

/**
 * Next arm length: in at once when the allowed length is shorter, otherwise eased back out
 * towards min(wanted, allowed) (about 95 % of the way in `releaseSeconds`).
 */
export function updateArmLength(current, wanted, allowed, dt, { releaseSeconds = CAMERA_ARM.releaseSeconds } = {}) {
  const limit = Math.min(wanted, allowed);
  if (current === null || current === undefined || !Number.isFinite(current) || current >= limit) return limit;
  const k = dt > 0 ? 1 - Math.exp((-3 * dt) / releaseSeconds) : 0;
  const next = current + (limit - current) * k;
  return limit - next < 0.005 ? limit : next;
}

/** Avatar opacity for a camera this far from it: 1 beyond fadeStart, 0 below hiddenBelow. */
export function avatarOpacity(distance, { fadeStart = CAMERA_ARM.fadeStart, hiddenBelow = CAMERA_ARM.hiddenBelow } = {}) {
  if (!(distance < fadeStart)) return 1;
  if (distance <= hiddenBelow) return 0;
  const t = (distance - hiddenBelow) / (fadeStart - hiddenBelow);
  return t * t * (3 - 2 * t);
}
