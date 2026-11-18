// Texel-density right-sizing (dev-time, read-only on the documents).
//
// Rule (agreed caps): a texture needs `near` px/m where a walking visitor's eye can come within
// `nearM` of the surface, `far` px/m where it never comes nearer than that on foot (roofs, upper
// pavilion, upper walls; flying close is allowed to look softer), and `distant` px/m where it never
// comes nearer than `distantM`. Walkable floors are the space's own walking data (heightfield grids
// and analytic colliders), flood-filled from the spawn with the walker's step limit, so wall tops
// and roofs are not walkable. A texture shrinks by whole mip levels while every class that covers at
// least `minShare` of its surface still gets its cap. Hero textures, tiling textures (texture
// coordinates spanning more than `tileSpan`) and textures with no measurable use keep their size.
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const EYE_HEIGHT = 1.7;
const STEP = 0.6;

/** Reachable walking floor on a `cell` metre grid, with the distance to the nearest reachable cell. */
export async function walkGrid(frontend, colliders, { cell = 1 } = {}) {
  const { floorAt } = await import(pathToFileURL(join(frontend, "src/spaces/walkPhysics.js")).href);
  const g = colliders.ground ?? { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  const minX = g.minX - 20;
  const minZ = g.minZ - 20;
  const cols = Math.ceil((g.maxX + 20 - minX) / cell);
  const rows = Math.ceil((g.maxZ + 20 - minZ) / cell);
  const floor = new Float32Array(cols * rows).fill(NaN);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = minX + (c + 0.5) * cell;
    const z = minZ + (r + 0.5) * cell;
    if (x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ) continue;
    const f = floorAt(x, z, colliders);
    if (f !== null && Number.isFinite(f)) floor[r * cols + c] = f;
  }
  // Flood fill from the spawn over neighbours whose floors differ by at most a step.
  const spawn = colliders.spawn ?? { x: 0, z: 0 };
  const start = Math.floor((spawn.z - minZ) / cell) * cols + Math.floor((spawn.x - minX) / cell);
  const reachable = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  if (Number.isFinite(floor[start])) {
    reachable[start] = 1;
    queue[tail++] = start;
  }
  while (head < tail) {
    const i = queue[head++];
    const r = Math.floor(i / cols);
    const c = i - r * cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      const j = rr * cols + cc;
      if (reachable[j] || !Number.isFinite(floor[j]) || Math.abs(floor[j] - floor[i]) > STEP * cell) continue;
      reachable[j] = 1;
      queue[tail++] = j;
    }
  }
  // Nearest reachable cell for every cell (two-pass propagation of the nearest source).
  const source = new Int32Array(cols * rows).fill(-1);
  for (let i = 0; i < cols * rows; i++) if (reachable[i]) source[i] = i;
  const d2 = (i, s) => {
    const r = Math.floor(i / cols) - Math.floor(s / cols);
    const c = (i % cols) - (s % cols);
    return r * r + c * c;
  };
  const relax = (i, j) => {
    const s = source[j];
    if (s < 0) return;
    if (source[i] < 0 || d2(i, s) < d2(i, source[i])) source[i] = s;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) relax(i, i - 1);
      if (r > 0) relax(i, i - cols);
      if (r > 0 && c > 0) relax(i, i - cols - 1);
      if (r > 0 && c < cols - 1) relax(i, i - cols + 1);
    }
    for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c < cols - 1) relax(i, i + 1);
      if (r < rows - 1) relax(i, i + cols);
      if (r < rows - 1 && c < cols - 1) relax(i, i + cols + 1);
      if (r < rows - 1 && c > 0) relax(i, i + cols - 1);
    }
  }
  let count = 0;
  for (const v of reachable) count += v;
  return {
    reachableCells: count,
    /** Distance from the nearest walking eye position to a point (m). */
    eyeDistance(x, y, z) {
      const c = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cell)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor((z - minZ) / cell)));
      const s = source[r * cols + c];
      if (s < 0) return Infinity;
      const sx = minX + ((s % cols) + 0.5) * cell;
      const sz = minZ + (Math.floor(s / cols) + 0.5) * cell;
      return Math.hypot(x - sx, z - sz, y - (floor[s] + EYE_HEIGHT));
    },
  };
}

/**
 * Surface and texture-coordinate area per texture and distance class over one document.
 * @param {(node) => string | null} classOf optional fixed class per node (vegetation levels)
 */
export function densityUses(document, { offset = [0, 0, 0], grid, nearM, distantM, classOf = null }) {
  const uses = new Map();
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const fixed = classOf ? classOf(node) : null;
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      const pos = prim.getAttribute("POSITION");
      const indices = prim.getIndices();
      if (!material || !pos) continue;
      const slots = [
        [material.getBaseColorTexture(), material.getBaseColorTextureInfo()],
        [material.getNormalTexture(), material.getNormalTextureInfo()],
        [material.getMetallicRoughnessTexture(), material.getMetallicRoughnessTextureInfo()],
        [material.getOcclusionTexture(), material.getOcclusionTextureInfo()],
        [material.getEmissiveTexture(), material.getEmissiveTextureInfo()],
      ].filter(([texture]) => texture);
      if (!slots.length) continue;
      const count = indices ? indices.getCount() : pos.getCount();
      const a = [0, 0, 0];
      const b = [0, 0, 0];
      const c = [0, 0, 0];
      const w = (v) => [
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] + offset[0],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] + offset[1],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] + offset[2],
      ];
      for (const [texture, info] of slots) {
        const uv = prim.getAttribute(`TEXCOORD_${info?.getTexCoord() ?? 0}`);
        if (!uv) continue;
        const entry = uses.get(texture) ?? { near: [0, 0], far: [0, 0], distant: [0, 0], uvMin: [Infinity, Infinity], uvMax: [-Infinity, -Infinity] };
        const ua = [0, 0];
        const ub = [0, 0];
        const uc = [0, 0];
        for (let t = 0; t < count; t += 3) {
          const i0 = indices ? indices.getScalar(t) : t;
          const i1 = indices ? indices.getScalar(t + 1) : t + 1;
          const i2 = indices ? indices.getScalar(t + 2) : t + 2;
          const p0 = w(pos.getElement(i0, a));
          const p1 = w(pos.getElement(i1, b));
          const p2 = w(pos.getElement(i2, c));
          const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
          const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
          const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
          if (!(area > 0)) continue;
          uv.getElement(i0, ua);
          uv.getElement(i1, ub);
          uv.getElement(i2, uc);
          const uvArea = Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
          for (const p of [ua, ub, uc]) for (let k = 0; k < 2; k++) {
            entry.uvMin[k] = Math.min(entry.uvMin[k], p[k]);
            entry.uvMax[k] = Math.max(entry.uvMax[k], p[k]);
          }
          let kind = fixed;
          if (!kind) {
            const d = grid.eyeDistance((p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3);
            kind = d <= nearM ? "near" : d <= distantM ? "far" : "distant";
          }
          entry[kind][0] += area;
          entry[kind][1] += uvArea;
        }
        uses.set(texture, entry);
      }
    }
  }
  return uses;
}

/** Target size for a texture from its uses (whole mip levels, at least `minSize`). */
export function rightSize(size, entry, { caps, minShare = 0.02, tileSpan = 1.5, minSize = 128, tolerance = 0.9 }) {
  const [width, height] = size;
  if (!entry) return { scale: 1, reason: "no measured use" };
  const span = Math.max(entry.uvMax[0] - entry.uvMin[0], entry.uvMax[1] - entry.uvMin[1]);
  if (span > tileSpan) return { scale: 1, reason: `tiling (texture coordinates span ${span.toFixed(1)})` };
  const total = entry.near[0] + entry.far[0] + entry.distant[0];
  let need = 0;
  const densities = {};
  for (const kind of ["near", "far", "distant"]) {
    const [area, uvArea] = entry[kind];
    if (!(area > 0) || !(uvArea > 0) || area < total * minShare) continue;
    const density = Math.sqrt((width * height * uvArea) / area);
    densities[kind] = Math.round(density);
    need = Math.max(need, caps[kind] / density);
  }
  if (!need) return { scale: 1, reason: "no measurable use" };
  let scale = 1;
  // The caps are approximate: a level may go as long as at least `tolerance` x cap remains.
  while (need * 2 * tolerance <= 1 && Math.min(width, height) * scale > minSize) {
    scale /= 2;
    need *= 2;
  }
  return { scale, densities };
}
