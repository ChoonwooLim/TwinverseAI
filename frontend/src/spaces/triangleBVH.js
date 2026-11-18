/**
 * Bounding volume hierarchy over triangles, for ray casts (camera collision). Pure, no three.js.
 *
 * Input: `positions` (Float32Array, xyz per vertex, in whatever space the caller wants to cast in)
 * and `indices` (Uint32Array, three per triangle). Nothing is reordered in place: the BVH keeps
 * its own triangle order. Built by a generator that yields every `sliceTriangles` units of work,
 * so a large mesh can be built a slice at a time between frames.
 *
 * Nodes: `bounds` holds minX, minY, minZ, maxX, maxY, maxZ per node; `meta` holds two numbers per
 * node: a leaf stores [first, count] into `order` (count > 0); an inner node stores [left, 0],
 * with the right child at left + 1. Node 0 is the root. Splits are at the median centroid along
 * the longest axis.
 */

export const LEAF_SIZE = 8;

/**
 * @param {Float32Array} positions
 * @param {Uint32Array} indices
 * @param {{ leafSize?: number, sliceTriangles?: number }} [options]
 * @returns {Generator<undefined, null | { positions, indices, order: Uint32Array, bounds: Float32Array, meta: Uint32Array, nodeCount: number, triangles: number, bytes: number }>}
 */
export function* buildTriangleBVH(positions, indices, { leafSize = LEAF_SIZE, sliceTriangles = 20000 } = {}) {
  const count = Math.floor(indices.length / 3);
  if (!count) return null;
  const order = new Uint32Array(count);
  const centroids = new Float32Array(count * 3);
  let work = 0;
  for (let t = 0; t < count; t++) {
    order[t] = t;
    const a = indices[3 * t] * 3;
    const b = indices[3 * t + 1] * 3;
    const c = indices[3 * t + 2] * 3;
    centroids[3 * t] = (positions[a] + positions[b] + positions[c]) / 3;
    centroids[3 * t + 1] = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    centroids[3 * t + 2] = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    if (++work >= sliceTriangles) {
      work = 0;
      yield;
    }
  }

  // Median splits leave at least leafSize / 2 triangles per leaf, so there are at most
  // 2 * count / (leafSize / 2) nodes.
  const maxNodes = Math.ceil((4 * count) / Math.max(2, leafSize)) + 2;
  const bounds = new Float32Array(maxNodes * 6);
  const meta = new Uint32Array(maxNodes * 2);
  let nodeCount = 1;
  const stack = [0, 0, count];

  while (stack.length) {
    const end = stack.pop();
    const start = stack.pop();
    const node = stack.pop();
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let cMinX = Infinity, cMinY = Infinity, cMinZ = Infinity, cMaxX = -Infinity, cMaxY = -Infinity, cMaxZ = -Infinity;
    for (let i = start; i < end; i++) {
      const t = order[i];
      for (let k = 0; k < 3; k++) {
        const v = indices[3 * t + k] * 3;
        const x = positions[v];
        const y = positions[v + 1];
        const z = positions[v + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      const cx = centroids[3 * t];
      const cy = centroids[3 * t + 1];
      const cz = centroids[3 * t + 2];
      if (cx < cMinX) cMinX = cx;
      if (cx > cMaxX) cMaxX = cx;
      if (cy < cMinY) cMinY = cy;
      if (cy > cMaxY) cMaxY = cy;
      if (cz < cMinZ) cMinZ = cz;
      if (cz > cMaxZ) cMaxZ = cz;
      // Large nodes (the first levels of a big mesh) yield part-way through.
      if (++work >= sliceTriangles) {
        work = 0;
        yield;
      }
    }
    const o = node * 6;
    bounds[o] = minX;
    bounds[o + 1] = minY;
    bounds[o + 2] = minZ;
    bounds[o + 3] = maxX;
    bounds[o + 4] = maxY;
    bounds[o + 5] = maxZ;
    const n = end - start;
    const ex = cMaxX - cMinX;
    const ey = cMaxY - cMinY;
    const ez = cMaxZ - cMinZ;
    const extent = Math.max(ex, ey, ez);
    if (n <= leafSize || extent <= 0 || nodeCount + 2 > maxNodes) {
      meta[2 * node] = start;
      meta[2 * node + 1] = n;
    } else {
      const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
      const mid = (start + end) >> 1;
      selectNth(order, start, end, mid, centroids, axis);
      const left = nodeCount;
      nodeCount += 2;
      meta[2 * node] = left;
      meta[2 * node + 1] = 0;
      stack.push(left + 1, mid, end, left, start, mid);
    }
    if (work >= sliceTriangles) {
      work = 0;
      yield;
    }
  }

  const finalBounds = bounds.slice(0, nodeCount * 6);
  const finalMeta = meta.slice(0, nodeCount * 2);
  return {
    positions,
    indices,
    order,
    bounds: finalBounds,
    meta: finalMeta,
    nodeCount,
    triangles: count,
    bytes: positions.byteLength + indices.byteLength + order.byteLength + finalBounds.byteLength + finalMeta.byteLength,
  };
}

/** Builds in one go (tests, small meshes). */
export function buildTriangleBVHNow(positions, indices, options) {
  const job = buildTriangleBVH(positions, indices, options);
  let step = job.next();
  while (!step.done) step = job.next();
  return step.value;
}

/** Partially sorts order[lo, hi) so order[k] holds the k-th smallest centroid along `axis`. */
function selectNth(order, lo, hiExclusive, k, centroids, axis) {
  let left = lo;
  let right = hiExclusive - 1;
  const key = (i) => centroids[3 * order[i] + axis];
  while (right > left) {
    const middle = (left + right) >> 1;
    const a = key(left);
    const b = key(middle);
    const c = key(right);
    const pivot = a < b ? (b < c ? b : a < c ? c : a) : a < c ? a : b < c ? c : b;
    let i = left;
    let j = right;
    while (i <= j) {
      while (key(i) < pivot) i++;
      while (key(j) > pivot) j--;
      if (i <= j) {
        const swap = order[i];
        order[i] = order[j];
        order[j] = swap;
        i++;
        j--;
      }
    }
    if (k <= j) right = j;
    else if (k >= i) left = i;
    else return;
  }
}

const STACK = new Int32Array(128);

/**
 * Nearest hit of the ray origin + t * direction for t in (0, maxT], from either side of a
 * triangle; Infinity when there is none. `direction` need not be normalised: t is in its units.
 */
export function raycastBVH(bvh, ox, oy, oz, dx, dy, dz, maxT = Infinity) {
  if (!bvh) return Infinity;
  const { bounds, meta, order, indices, positions } = bvh;
  const ix = dx !== 0 ? 1 / dx : 0;
  const iy = dy !== 0 ? 1 / dy : 0;
  const iz = dz !== 0 ? 1 / dz : 0;
  let best = maxT;
  let sp = 0;
  STACK[sp++] = 0;
  while (sp > 0) {
    const node = STACK[--sp];
    const o = node * 6;
    // Slab test against [0, best]; an axis the ray does not move along only checks the origin.
    let t0 = 0;
    let t1 = best;
    if (dx === 0) {
      if (ox < bounds[o] || ox > bounds[o + 3]) continue;
    } else {
      const a = (bounds[o] - ox) * ix;
      const b = (bounds[o + 3] - ox) * ix;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    if (dy === 0) {
      if (oy < bounds[o + 1] || oy > bounds[o + 4]) continue;
    } else {
      const a = (bounds[o + 1] - oy) * iy;
      const b = (bounds[o + 4] - oy) * iy;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    if (dz === 0) {
      if (oz < bounds[o + 2] || oz > bounds[o + 5]) continue;
    } else {
      const a = (bounds[o + 2] - oz) * iz;
      const b = (bounds[o + 5] - oz) * iz;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }

    const count = meta[2 * node + 1];
    if (count > 0) {
      const first = meta[2 * node];
      for (let i = first; i < first + count; i++) {
        const t = order[i];
        const t3 = 3 * t;
        const hit = rayTriangle(positions, indices[t3] * 3, indices[t3 + 1] * 3, indices[t3 + 2] * 3, ox, oy, oz, dx, dy, dz);
        if (hit < best) best = hit;
      }
    } else if (sp + 2 <= STACK.length) {
      const left = meta[2 * node];
      STACK[sp++] = left + 1;
      STACK[sp++] = left;
    }
  }
  return best < maxT ? best : Infinity;
}

/** Möller-Trumbore, both faces; Infinity for a miss. */
function rayTriangle(p, a, b, c, ox, oy, oz, dx, dy, dz) {
  const e1x = p[b] - p[a];
  const e1y = p[b + 1] - p[a + 1];
  const e1z = p[b + 2] - p[a + 2];
  const e2x = p[c] - p[a];
  const e2y = p[c + 1] - p[a + 1];
  const e2z = p[c + 2] - p[a + 2];
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const tx = ox - p[a];
  const ty = oy - p[a + 1];
  const tz = oz - p[a + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-7 ? t : Infinity;
}
