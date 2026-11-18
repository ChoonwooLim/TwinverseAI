/**
 * Which shadow cascades a caster can actually affect. Pure functions, no three.js.
 *
 * A point receives shadow from the casters on the ray from it towards the sun. Looking along the
 * light (light space: z towards the sun, x/y across it), a cascade's region - its slice of the
 * view frustum, cut to the heights where geometry can receive shadow - covers a convex outline
 * in x/y, and a caster's box covers another. The caster can shadow the region only if the two
 * outlines overlap and the caster is not entirely below (farther from the sun than) the region.
 * CSM fits each cascade's shadow camera to a square around the slice's diagonal, far larger than
 * that outline, so without this test far cascades redraw nearly every caster in the scene.
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Light-space axes for a unit direction towards the sun (z), with x horizontal. */
export function lightBasis(towardSun) {
  const z = [towardSun.x, towardSun.y, towardSun.z];
  const zl = Math.hypot(...z) || 1;
  for (let i = 0; i < 3; i++) z[i] /= zl;
  // x = up x z (horizontal unless the sun is at the zenith).
  let x = [z[2], 0, -z[0]];
  let xl = Math.hypot(...x);
  if (xl < 1e-6) {
    x = [1, 0, 0];
    xl = 1;
  }
  x = x.map((v) => v / xl);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { x, y, z };
}

/**
 * The part of a frustum slice (8 corners: near quad then far quad, in the same corner order)
 * between heights yMin and yMax, as a point set: shadows are only received by geometry, which
 * sits between the lowest ground and the highest roof, so the sky and underground parts of the
 * slice must not widen its outline.
 */
export function clipSliceToHeights(corners, yMin, yMax) {
  const edges = [];
  for (let i = 0; i < 4; i++) {
    edges.push([corners[i], corners[(i + 1) % 4]]);
    edges.push([corners[4 + i], corners[4 + ((i + 1) % 4)]]);
    edges.push([corners[i], corners[4 + i]]);
  }
  const points = corners.filter((p) => p.y >= yMin && p.y <= yMax);
  for (const [a, b] of edges) {
    for (const h of [yMin, yMax]) {
      if ((a.y - h) * (b.y - h) < 0) {
        const t = (h - a.y) / (b.y - a.y);
        points.push({ x: a.x + (b.x - a.x) * t, y: h, z: a.z + (b.z - a.z) * t });
      }
    }
  }
  return points;
}

/**
 * Highest receiver top in a region: the tallest of `tops` ({ minX, maxX, minZ, maxZ, top }, the
 * world boxes of the static meshes) overlapping the region's x/z bounds, and at least `floor`
 * (the tallest plant). A region with only low geometry gets a low ceiling, so tall casters
 * standing beyond it are not drawn into it.
 */
export function regionCeiling(points, tops, floor = 0) {
  if (!points.length) return floor;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  let ceiling = floor;
  for (const box of tops) {
    if (box.maxX < minX || box.minX > maxX || box.maxZ < minZ || box.minZ > maxZ) continue;
    if (box.top > ceiling) ceiling = box.top;
  }
  return ceiling;
}

/** Convex hull (counter-clockwise) of 2D points, monotone chain. */
function hull2d(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length <= 2) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Light-space outline (hull in x/y) and z range of a point set. */
export function lightOutline(points, basis) {
  let minZ = Infinity;
  let maxZ = -Infinity;
  const flat = points.map((p) => {
    const v = [p.x, p.y, p.z];
    const z = dot(v, basis.z);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    return [dot(v, basis.x), dot(v, basis.y)];
  });
  return { hull: hull2d(flat), minZ, maxZ };
}

/** Whether two convex 2D hulls overlap (separating axis test), with a margin. */
export function hullsOverlap(a, b, margin = 0) {
  for (const poly of [a, b]) {
    const n = poly.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const ax = q[1] - p[1];
      const ay = p[0] - q[0];
      const length = Math.hypot(ax, ay);
      if (length < 1e-9) continue;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) {
        const d = (v[0] * ax + v[1] * ay) / length;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      for (const v of b) {
        const d = (v[0] * ax + v[1] * ay) / length;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      if (maxA + margin < minB || maxB + margin < minA) return false;
    }
  }
  return true;
}

/** Light-space outline of each cascade region (null when it covers no receivers). */
export function cascadeOutlines(regions, basis) {
  return regions.map((points) => (points.length >= 3 ? lightOutline(points, basis) : null));
}

/** The eight corners of a world box, for lightOutline. */
export function boxCorners(min, max) {
  const corners = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push({ x, y, z });
  return corners;
}

/** Bit i set when a caster (lightOutline of its box corners) can shadow cascade i's region. */
export function casterCascadeBits(outlines, caster, margin = 1) {
  let bits = 0;
  for (let i = 0; i < outlines.length; i++) {
    const region = outlines[i];
    if (!region) continue;
    if (caster.maxZ + margin < region.minZ) continue; // entirely below the region
    if (!hullsOverlap(caster.hull, region.hull, margin)) continue;
    bits |= 1 << i;
  }
  return bits;
}
