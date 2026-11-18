/**
 * Heightfield grids for walking. Pure functions, no three.js.
 *
 * A grid (exported from the scene by the modeller) is a little-endian uint16 per cell, row-major:
 * the row index runs along +Z from originZ, the column index along +X from originX, in the grid's
 * own frame. height = minY + value / 65534 * (maxY - minY); `noFloor` (65535) marks cells with no
 * walkable floor (walls, solid parts). Each cell holds the lowest floor with headroom, so arched
 * passages are walkable.
 *
 * Grids are placed in the world by `position` [x, y, z] and `yawDeg` (0, 90, 180 or 270; same sense
 * as three.js `rotation.y`). Heights are offset by the placement's y.
 */

export const NO_FLOOR = 65535;
const VALUE_RANGE = 65534;
const RIGHT_ANGLES = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Normalised yaw (0, 90, 180, 270) or null when the yaw is not a right angle. */
export function rightAngleYaw(yawDeg = 0) {
  if (!isNumber(yawDeg)) return null;
  const normalized = ((yawDeg % 360) + 360) % 360;
  for (const angle of [0, 90, 180, 270]) {
    if (Math.abs(normalized - angle) < 1e-6 || Math.abs(normalized - angle - 360) < 1e-6) return angle;
  }
  return null;
}

/** Why a grid description cannot be used, or null when it is fine. */
export function heightfieldError(meta) {
  if (!meta || typeof meta !== "object") return "missing description";
  const { cols, rows, cellM, minY, maxY } = meta;
  if (!(Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0)) return "cols and rows must be positive integers";
  if (!(isNumber(cellM) && cellM > 0)) return "cellM must be positive";
  if (!isNumber(meta.originX) || !isNumber(meta.originZ)) return "originX and originZ are required";
  if (!isNumber(minY) || !isNumber(maxY) || maxY < minY) return "minY / maxY are invalid";
  if ((meta.rowAxis ?? "z") !== "z" || (meta.colAxis ?? "x") !== "x") return "only rowAxis z and colAxis x are supported";
  if (meta.position !== undefined && !(Array.isArray(meta.position) && meta.position.length >= 3 && meta.position.slice(0, 3).every(isNumber))) {
    return "position must be [x, y, z]";
  }
  if (rightAngleYaw(meta.yawDeg ?? 0) === null) return `yawDeg ${meta.yawDeg} is not 0, 90, 180 or 270`;
  return null;
}

/**
 * Decodes a grid file into { ...meta, data: Uint16Array }.
 * @param {ArrayBuffer | Uint8Array} buffer
 */
export function decodeHeightfield(buffer, meta) {
  const error = heightfieldError(meta);
  if (error) throw new Error(`Heightfield ${meta?.file ?? ""}: ${error}`);
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const cells = meta.cols * meta.rows;
  if (bytes.byteLength !== cells * 2) {
    throw new Error(`Heightfield ${meta.file ?? ""}: expected ${cells * 2} bytes for ${meta.cols} x ${meta.rows}, got ${bytes.byteLength}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const data = new Uint16Array(cells);
  for (let i = 0; i < cells; i++) data[i] = view.getUint16(i * 2, true);
  return { ...meta, data };
}

/** The list of grids in a colliders object: `heightfields` (array) or a single `heightfield`. */
export function heightfieldList(colliders) {
  if (Array.isArray(colliders?.heightfields)) return colliders.heightfields;
  return colliders?.heightfield ? [colliders.heightfield] : [];
}

const prepared = new WeakMap();

function prepare(grid) {
  let entry = prepared.get(grid);
  if (entry) return entry;
  const yaw = rightAngleYaw(grid.yawDeg ?? 0);
  const valid = grid.data && yaw !== null && !heightfieldError(grid) && grid.data.length === grid.cols * grid.rows;
  const [cos, sin] = valid ? RIGHT_ANGLES[yaw] : [1, 0];
  const [px, py, pz] = Array.isArray(grid.position) ? grid.position : [0, 0, 0];
  const noFloor = Number.isInteger(grid.noFloor) ? grid.noFloor : NO_FLOOR;
  const scale = (grid.maxY - grid.minY) / VALUE_RANGE;
  // World-space bounds of the footprint, for quick rejection.
  let bounds = null;
  if (valid) {
    const w = grid.cols * grid.cellM;
    const d = grid.rows * grid.cellM;
    const corners = [[0, 0], [w, 0], [0, d], [w, d]].map(([lx, lz]) => {
      const x = grid.originX + lx;
      const z = grid.originZ + lz;
      return [px + x * cos + z * sin, pz - x * sin + z * cos];
    });
    bounds = {
      minX: Math.min(...corners.map((c) => c[0])),
      maxX: Math.max(...corners.map((c) => c[0])),
      minZ: Math.min(...corners.map((c) => c[1])),
      maxZ: Math.max(...corners.map((c) => c[1])),
    };
  }
  entry = { grid, valid, cos, sin, px, py, pz, noFloor, scale, bounds };
  prepared.set(grid, entry);
  return entry;
}

/** World position -> fractional (column, row) in a prepared grid. */
function toCell(entry, x, z) {
  const dx = x - entry.px;
  const dz = z - entry.pz;
  const lx = dx * entry.cos - dz * entry.sin;
  const lz = dx * entry.sin + dz * entry.cos;
  const { grid } = entry;
  return { col: (lx - grid.originX) / grid.cellM, row: (lz - grid.originZ) / grid.cellM };
}

function cellHeight(entry, col, row) {
  const { grid } = entry;
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return undefined; // outside footprint
  const value = grid.data[row * grid.cols + col];
  if (value === entry.noFloor) return null;
  return grid.minY + value * entry.scale + entry.py;
}

/**
 * Samples one grid at a world position.
 * @returns {undefined | null | number} undefined outside the footprint, null for no floor,
 *   otherwise the floor height (bilinear between neighbouring floor cells within `blendStep` of
 *   this cell's height, so 0.15 m stair steps blend but ledges stay sharp).
 */
export function sampleHeightfield(grid, x, z, blendStep = 0.6) {
  const entry = prepare(grid);
  if (!entry.valid) return undefined;
  const b = entry.bounds;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return undefined;
  const { col, row } = toCell(entry, x, z);
  const c = Math.floor(col);
  const r = Math.floor(row);
  const own = cellHeight(entry, c, r);
  if (own === undefined || own === null) return own;
  // Bilinear over cell centres.
  const fx = col - 0.5;
  const fz = row - 0.5;
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const tx = fx - c0;
  const tz = fz - r0;
  let sum = 0;
  let weight = 0;
  for (const [dc, dr, w] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) {
    if (w <= 0) continue;
    const h = cellHeight(entry, c0 + dc, r0 + dr);
    if (h === undefined || h === null || Math.abs(h - own) > blendStep) continue;
    sum += h * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : own;
}

/**
 * Floor from the grids at a world position: undefined when no grid covers it, null when the
 * covering grid has no floor there, otherwise the height. The first covering grid wins.
 */
export function gridFloorAt(grids, x, z, blendStep) {
  for (const grid of grids) {
    const floor = sampleHeightfield(grid, x, z, blendStep);
    if (floor !== undefined) return floor;
  }
  return undefined;
}

/** World bounds of all valid grids, or null. */
export function gridsBounds(grids) {
  let bounds = null;
  for (const grid of grids) {
    const entry = prepare(grid);
    if (!entry.valid) continue;
    const b = entry.bounds;
    if (!bounds) bounds = { ...b };
    else {
      bounds.minX = Math.min(bounds.minX, b.minX);
      bounds.maxX = Math.max(bounds.maxX, b.maxX);
      bounds.minZ = Math.min(bounds.minZ, b.minZ);
      bounds.maxZ = Math.max(bounds.maxZ, b.maxZ);
    }
  }
  return bounds;
}
