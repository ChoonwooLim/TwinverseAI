/**
 * Walking rules for walkable 3D spaces. Pure functions, no three.js.
 *
 * Collider data (three.js coordinates, metres, Y up), all fields optional:
 *   ground    { minX, maxX, minZ, maxZ }            walkable rectangle; the avatar is kept inside it
 *   platforms [{ minX, maxX, minZ, maxZ, y }]       flat raised areas
 *   ramps     [{ minX, maxX, zBottom, zTop, yBottom, yTop }]   slope running along Z
 *             [{ minZ, maxZ, xBottom, xTop, yBottom, yTop }]   slope running along X
 *   boxes     [{ minX, maxX, minZ, maxZ, topY? }]   solid; with topY only below its top
 *   circles   [{ x, z, r, topY? }]                  solid; with topY only below its top
 *   heightfields [{ ...grid, data }] (or one `heightfield`)  placed floor grids, see heightfield.js
 *
 * Inside a grid's footprint the grid decides the floor height and walkability (no-floor cells are
 * blocked for the whole body circle), also where the footprint reaches past `ground`; outside
 * every grid the analytic rules apply (ground, platforms, ramps, else 0). Boxes and circles block
 * everywhere. Grids need their decoded `data`; grids without it are ignored.
 *
 * An obstacle with `topY` blocks only while the feet are below topY - TOP_TOLERANCE (callers that
 * pass `feetY`), and its top is a floor inside its footprint (floorWithTops). Without topY it
 * blocks at any height.
 *
 * Boxes and circles are indexed in a uniform grid the first time a collider object is used,
 * so a few hundred obstacles cost about as much as a handful. Treat collider objects as
 * immutable once they have been passed in (the index is cached per object).
 */

import { gridFloorAt, gridsBounds, heightfieldList } from "./heightfield.js";

export const DEFAULT_RADIUS = 0.4;
/** Feet this close below an obstacle's top already count as above it. */
export const TOP_TOLERANCE = 0.1;
export const DEFAULT_MAX_STEP = 0.6;
export const DEFAULT_MAX_SUBSTEP = 0.1;
export const GRID_CELL_SIZE = 8;

const EPSILON = 1e-6;
const MAX_SUBSTEPS = 2000;

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function rampHeightAt(ramp, x, z) {
  let along;
  let cross;
  let bottom;
  let top;
  let crossMin;
  let crossMax;
  if (isNumber(ramp.zBottom) && isNumber(ramp.zTop)) {
    along = z;
    cross = x;
    bottom = ramp.zBottom;
    top = ramp.zTop;
    crossMin = ramp.minX;
    crossMax = ramp.maxX;
  } else if (isNumber(ramp.xBottom) && isNumber(ramp.xTop)) {
    along = x;
    cross = z;
    bottom = ramp.xBottom;
    top = ramp.xTop;
    crossMin = ramp.minZ;
    crossMax = ramp.maxZ;
  } else {
    return null;
  }
  if (!(cross >= crossMin && cross <= crossMax)) return null;
  const lo = Math.min(bottom, top);
  const hi = Math.max(bottom, top);
  if (hi === lo || along < lo || along > hi) return null;
  const t = (along - bottom) / (top - bottom);
  return ramp.yBottom + t * (ramp.yTop - ramp.yBottom);
}

/**
 * Analytic floor at (x, z): a ramp gives its interpolated height, a platform its y, anything
 * else 0. Where several apply, the highest wins.
 */
export function analyticHeightAt(x, z, colliders) {
  let best = null;
  for (const platform of colliders?.platforms ?? []) {
    if (x >= platform.minX && x <= platform.maxX && z >= platform.minZ && z <= platform.maxZ) {
      if (best === null || platform.y > best) best = platform.y;
    }
  }
  for (const ramp of colliders?.ramps ?? []) {
    const y = rampHeightAt(ramp, x, z);
    if (y !== null && (best === null || y > best)) best = y;
  }
  return best ?? 0;
}

const RING = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);

function gridsOf(colliders) {
  return heightfieldList(colliders).filter((grid) => grid?.data);
}

/**
 * Floor at (x, z): the covering grid's height (null where it has no floor), else the analytic
 * height. Use this for walkability.
 * @returns {number | null}
 */
export function floorAt(x, z, colliders, maxStep = DEFAULT_MAX_STEP) {
  const grids = gridsOf(colliders);
  if (grids.length) {
    const floor = gridFloorAt(grids, x, z, maxStep);
    if (floor !== undefined) return floor;
  }
  return analyticHeightAt(x, z, colliders);
}

/**
 * Walking surface height at (x, z), always a number (for cameras and placement): the floor, or
 * where there is none (inside a wall) the nearest floor within 3 m, else the analytic height.
 */
export function heightAt(x, z, colliders) {
  const floor = floorAt(x, z, colliders);
  if (floor !== null) return floor;
  for (let r = 0.5; r <= 3; r += 0.5) {
    for (const [cx, cz] of RING) {
      const nearby = floorAt(x + cx * r, z + cz * r, colliders);
      if (nearby !== null) return nearby;
    }
  }
  return analyticHeightAt(x, z, colliders);
}

const topsCache = new WeakMap();

function topObstacles(colliders) {
  if (!colliders || typeof colliders !== "object") return [];
  let tops = topsCache.get(colliders);
  if (!tops) {
    tops = [
      ...(colliders.boxes ?? []).filter((box) => isNumber(box?.topY)).map((box) => ({ box, topY: box.topY })),
      ...(colliders.circles ?? []).filter((circle) => isNumber(circle?.topY)).map((circle) => ({ circle, topY: circle.topY })),
    ];
    topsCache.set(colliders, tops);
  }
  return tops;
}

/** Highest `topY` of the obstacles whose footprint contains (x, z), or null. */
export function topAt(x, z, colliders) {
  let top = null;
  for (const item of topObstacles(colliders)) {
    const inside = item.box
      ? x >= item.box.minX && x <= item.box.maxX && z >= item.box.minZ && z <= item.box.maxZ
      : Math.hypot(x - item.circle.x, z - item.circle.z) <= item.circle.r;
    if (inside && (top === null || item.topY > top)) top = item.topY;
  }
  return top;
}

/** Floor at (x, z) including the tops of low obstacles (null where there is no floor at all). */
export function floorWithTops(x, z, colliders) {
  const floor = floorAt(x, z, colliders);
  const top = topAt(x, z, colliders);
  if (top === null) return floor;
  return floor === null ? top : Math.max(floor, top);
}

/**
 * Checks a body circle against no-floor cells: the centre and eight points on the rim.
 * @returns {{ x: number, z: number, depth: number } | null} push-out direction when blocked
 */
function noFloorContact(x, z, colliders, radius, grids) {
  const bounds = gridsBounds(grids);
  if (!bounds || x < bounds.minX - radius || x > bounds.maxX + radius || z < bounds.minZ - radius || z > bounds.maxZ + radius) return null;
  let nx = 0;
  let nz = 0;
  let blocked = gridFloorAt(grids, x, z) === null;
  for (const [cx, cz] of RING) {
    if (gridFloorAt(grids, x + cx * radius, z + cz * radius) === null) {
      blocked = true;
      nx -= cx;
      nz -= cz;
    }
  }
  if (!blocked) return null;
  const length = Math.hypot(nx, nz);
  return length > 1e-9 ? { x: nx / length, z: nz / length, depth: 0 } : { x: 0, z: 0, depth: 0 };
}

/**
 * Contact of a body circle with anything that blocks walking: boxes, circles, `extraBoxes`
 * (door blockers) and no-floor cells. Returns a push-out direction (possibly zero) or null.
 */
export function walkBlockerContact(x, z, colliders, radius = DEFAULT_RADIUS, extraBoxes = [], feetY = undefined) {
  const obstacle = obstacleNormalAt(x, z, colliders, radius, { feetY });
  if (obstacle) return obstacle;
  for (const box of extraBoxes ?? []) {
    const normal = box ? boxNormal(box, x, z, radius) : null;
    if (normal) return normal;
  }
  const grids = gridsOf(colliders);
  return grids.length ? noFloorContact(x, z, colliders, radius, grids) : null;
}

/** Inside the walkable region: `ground` (inset by the body radius) or any grid footprint. */
export function inWalkRegion(x, z, colliders, radius = DEFAULT_RADIUS) {
  const grids = gridsOf(colliders);
  if (grids.length && gridFloorAt(grids, x, z) !== undefined) return true;
  const ground = colliders?.ground;
  if (!ground) return true;
  const inset = Math.min(radius, (ground.maxX - ground.minX) / 2, (ground.maxZ - ground.minZ) / 2);
  return x >= ground.minX + inset - EPSILON && x <= ground.maxX - inset + EPSILON
    && z >= ground.minZ + inset - EPSILON && z <= ground.maxZ - inset + EPSILON;
}

/**
 * Whether a body of `radius` can stand at (x, z): in the region, on a floor (an obstacle's top
 * counts), touching no blocker at that height.
 */
export function walkableSpot(x, z, colliders, { radius = DEFAULT_RADIUS, extraBoxes = [] } = {}) {
  if (!inWalkRegion(x, z, colliders, radius)) return false;
  const floor = floorWithTops(x, z, colliders);
  return floor !== null && walkBlockerContact(x, z, colliders, radius, extraBoxes, floor) === null;
}

/**
 * Nearest spot to (x, z), within `maxDistance`, where a body of `radius` can stand (see
 * walkableSpot); null when there is none. Used to rescue a spawn point inside a wall and to
 * pick a landing point.
 */
export function findNearestFloor(x, z, colliders, { radius = DEFAULT_RADIUS, maxDistance = 30, step = 0.25, extraBoxes = [] } = {}) {
  const fits = (px, pz) => walkableSpot(px, pz, colliders, { radius, extraBoxes });
  if (fits(x, z)) return { x, z };
  for (let d = step; d <= maxDistance; d += step) {
    const samples = Math.max(8, Math.ceil((2 * Math.PI * d) / step));
    for (let k = 0; k < samples; k++) {
      const a = (k / samples) * 2 * Math.PI;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (fits(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

// ── Obstacle index ──────────────────────────────────────────────

const indexCache = new WeakMap();

function cellKey(ix, iz) {
  return `${ix},${iz}`;
}

function addToGrid(grid, item, minX, maxX, minZ, maxZ, cellSize) {
  const x0 = Math.floor(minX / cellSize);
  const x1 = Math.floor(maxX / cellSize);
  const z0 = Math.floor(minZ / cellSize);
  const z1 = Math.floor(maxZ / cellSize);
  for (let ix = x0; ix <= x1; ix++) {
    for (let iz = z0; iz <= z1; iz++) {
      const key = cellKey(ix, iz);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(item);
    }
  }
}

/**
 * Builds (once per collider object) a uniform grid over boxes and circles. Each grid entry
 * is inflated by `reach`, so a query only has to look at the single cell under the point.
 */
function getObstacleIndex(colliders, radius) {
  let perObject = indexCache.get(colliders);
  if (!perObject) {
    perObject = new Map();
    indexCache.set(colliders, perObject);
  }
  const cached = perObject.get(radius);
  if (cached) return cached;

  const cellSize = GRID_CELL_SIZE;
  const grid = new Map();
  let bounds = null;
  const grow = (minX, maxX, minZ, maxZ) => {
    if (!bounds) bounds = { minX, maxX, minZ, maxZ };
    else {
      bounds.minX = Math.min(bounds.minX, minX);
      bounds.maxX = Math.max(bounds.maxX, maxX);
      bounds.minZ = Math.min(bounds.minZ, minZ);
      bounds.maxZ = Math.max(bounds.maxZ, maxZ);
    }
  };
  for (const box of colliders?.boxes ?? []) {
    const item = { kind: "box", box };
    const minX = box.minX - radius;
    const maxX = box.maxX + radius;
    const minZ = box.minZ - radius;
    const maxZ = box.maxZ + radius;
    addToGrid(grid, item, minX, maxX, minZ, maxZ, cellSize);
    grow(minX, maxX, minZ, maxZ);
  }
  for (const circle of colliders?.circles ?? []) {
    const item = { kind: "circle", circle };
    const reach = circle.r + radius;
    const minX = circle.x - reach;
    const maxX = circle.x + reach;
    const minZ = circle.z - reach;
    const maxZ = circle.z + reach;
    addToGrid(grid, item, minX, maxX, minZ, maxZ, cellSize);
    grow(minX, maxX, minZ, maxZ);
  }
  const index = { grid, bounds, cellSize };
  perObject.set(radius, index);
  return index;
}

function boxNormal(box, x, z, radius) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  const limit = radius - EPSILON;
  if (d2 >= limit * limit) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { x: dx / d, z: dz / d, depth: radius - d };
  }
  // Centre inside the box: push out through the nearest face.
  const left = x - box.minX;
  const right = box.maxX - x;
  const back = z - box.minZ;
  const front = box.maxZ - z;
  const nearest = Math.min(left, right, back, front);
  const depth = radius + nearest;
  if (nearest === left) return { x: -1, z: 0, depth };
  if (nearest === right) return { x: 1, z: 0, depth };
  if (nearest === back) return { x: 0, z: -1, depth };
  return { x: 0, z: 1, depth };
}

function circleNormal(circle, x, z, radius) {
  const dx = x - circle.x;
  const dz = z - circle.z;
  const reach = circle.r + radius - EPSILON;
  const d2 = dx * dx + dz * dz;
  if (d2 >= reach * reach) return null;
  const d = Math.sqrt(d2);
  const depth = circle.r + radius - d;
  return d > 1e-9 ? { x: dx / d, z: dz / d, depth } : { x: 0, z: 1, depth };
}

/** False for an obstacle with a top the feet are already above. */
function blocksFeet(item, feetY) {
  if (!isNumber(feetY)) return true;
  const top = item.kind === "box" ? item.box.topY : item.circle.topY;
  return !(isNumber(top) && feetY >= top - TOP_TOLERANCE);
}

function scanNormal(items, x, z, radius, feetY) {
  for (const item of items) {
    if (!blocksFeet(item, feetY)) continue;
    const normal = item.kind === "box"
      ? boxNormal(item.box, x, z, radius)
      : circleNormal(item.circle, x, z, radius);
    if (normal) return normal;
  }
  return null;
}

/**
 * Returns the contact with the first obstacle overlapping a body of `radius` at (x, z) as
 * { x, z, depth } (unit push-out direction and penetration depth), or null when the spot is free.
 * With `options.feetY`, obstacles whose `topY` the feet are above are skipped.
 */
export function obstacleNormalAt(x, z, colliders, radius = DEFAULT_RADIUS, options = {}) {
  const feetY = options?.feetY;
  if (options?.useIndex === false) {
    const items = [
      ...(colliders?.boxes ?? []).map((box) => ({ kind: "box", box })),
      ...(colliders?.circles ?? []).map((circle) => ({ kind: "circle", circle })),
    ];
    return scanNormal(items, x, z, radius, feetY);
  }
  const index = getObstacleIndex(colliders, radius);
  const { bounds, grid, cellSize } = index;
  if (!bounds || x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
  const bucket = grid.get(cellKey(Math.floor(x / cellSize), Math.floor(z / cellSize)));
  return bucket ? scanNormal(bucket, x, z, radius, feetY) : null;
}

function clampToGround(x, z, ground, radius) {
  if (!ground) return { x, z };
  let minX = ground.minX + radius;
  let maxX = ground.maxX - radius;
  let minZ = ground.minZ + radius;
  let maxZ = ground.maxZ - radius;
  if (minX > maxX) minX = maxX = (ground.minX + ground.maxX) / 2;
  if (minZ > maxZ) minZ = maxZ = (ground.minZ + ground.maxZ) / 2;
  return { x: clamp(x, minX, maxX), z: clamp(z, minZ, maxZ) };
}

/**
 * Where a step towards (nx, nz) lands in the walkable region (ground plus grid footprints), or
 * null when it would leave it. Steps past the ground edge are clamped back (sliding along it);
 * a step out of a footprint that reaches past the ground stops instead of jumping back.
 */
function placeInRegion(nx, nz, ctx) {
  if (ctx.grids.length && gridFloorAt(ctx.grids, nx, nz) !== undefined) return { x: nx, z: nz };
  const spot = clampToGround(nx, nz, ctx.colliders?.ground, ctx.radius);
  if (ctx.grids.length && Math.hypot(spot.x - nx, spot.z - nz) > ctx.radius + DEFAULT_MAX_SUBSTEP) return null;
  return spot;
}

function evaluate(nx, nz, fromY, ctx) {
  const spot = placeInRegion(nx, nz, ctx);
  if (!spot) return { ok: false, normal: null };
  const y = floorAt(spot.x, spot.z, ctx.colliders, ctx.maxStep);
  if (ctx.grids.length) {
    const contact = noFloorContact(spot.x, spot.z, ctx.colliders, ctx.radius, ctx.grids);
    if (contact && !ctx.escaping) return { ok: false, normal: contact.x || contact.z ? contact : null };
  }
  if (y === null) return { ok: false, normal: null };
  if (ctx.character) {
    const higher = higherFloorContact(spot.x, spot.z, y, ctx);
    if (higher) return { ok: false, normal: higher };
  } else if (fromY !== null && Math.abs(y - fromY) > ctx.maxStep) {
    return { ok: false, normal: null };
  }
  if (!ctx.ignoreObstacles) {
    const normal = obstacleNormalAt(spot.x, spot.z, ctx.colliders, ctx.radius, ctx.obstacleOptions) ?? extraBoxNormal(spot.x, spot.z, ctx);
    if (normal) return { ok: false, normal };
  }
  return { ok: true, x: spot.x, y, z: spot.z };
}

/**
 * Character rule: floors higher than `ctx.character.limitY` are walls. Checked at the centre and on
 * the body's rim; a rim contact blocks only steps that go further into the higher floor, so a
 * body standing next to a ledge can still move along or away from it.
 */
function higherFloorContact(x, z, centreFloor, ctx) {
  const limit = ctx.character.limitY;
  let nx = 0;
  let nz = 0;
  let touching = false;
  for (const [cx, cz] of RING) {
    const floor = floorAt(x + cx * ctx.radius, z + cz * ctx.radius, ctx.colliders, ctx.maxStep);
    if (floor !== null && floor > limit) {
      touching = true;
      nx -= cx;
      nz -= cz;
    }
  }
  const length = Math.hypot(nx, nz);
  const normal = length > 1e-9 ? { x: nx / length, z: nz / length, depth: 0 } : null;
  if (centreFloor > limit) return normal ?? { x: 0, z: 0, depth: 0 };
  if (!touching || !normal) return null;
  const into = (x - ctx.fromX) * normal.x + (z - ctx.fromZ) * normal.z;
  return into < -1e-12 ? normal : null;
}

function extraBoxNormal(x, z, ctx) {
  for (const box of ctx.extraBoxes) {
    const normal = boxNormal(box, x, z, ctx.radius);
    if (normal) return normal;
  }
  return null;
}

function stepOnce(x, z, y, sx, sz, ctx) {
  // A body that starts inside an obstacle (bad spawn data) may walk out of it.
  ctx.ignoreObstacles = obstacleNormalAt(x, z, ctx.colliders, ctx.radius, ctx.obstacleOptions) !== null;
  ctx.fromX = x;
  ctx.fromZ = z;

  const full = evaluate(x + sx, z + sz, y, ctx);
  if (full.ok) return full;

  // Slide along the obstacle surface: drop the part of the step that goes into it. On a curved
  // surface the tangent step can still graze the obstacle, so push it back out once.
  if (full.normal) {
    const into = sx * full.normal.x + sz * full.normal.z;
    if (into < 0) {
      let tx = x + sx - into * full.normal.x;
      let tz = z + sz - into * full.normal.z;
      if (Math.abs(tx - x) + Math.abs(tz - z) > 1e-12) {
        let slid = evaluate(tx, tz, y, ctx);
        if (!slid.ok && slid.normal && slid.normal.depth < Math.hypot(sx, sz)) {
          tx += slid.normal.x * (slid.normal.depth + 1e-4);
          tz += slid.normal.z * (slid.normal.depth + 1e-4);
          slid = evaluate(tx, tz, y, ctx);
        }
        if (slid.ok) return slid;
      }
    }
  }

  // Then each axis alone, the larger component first.
  const axes = Math.abs(sx) >= Math.abs(sz) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
  for (const [ax, az] of axes) {
    if (ax === 0 && az === 0) continue;
    const single = evaluate(x + ax, z + az, y, ctx);
    if (single.ok) return single;
  }
  return null;
}

/**
 * Moves a body glued to the floor by a horizontal `delta` and returns its new position { x, y, z }
 * (the simple walker; the avatar uses the character controller, which shares this machinery).
 *
 * - keeps a body of `options.radius` (default 0.4 m) out of boxes and circles,
 * - keeps it inside `colliders.ground` plus the footprints of any heightfield grids,
 * - inside a grid, keeps the whole body circle off no-floor cells,
 * - refuses any step whose height change exceeds `options.maxStep` (default 0.6 m) either way,
 *   so raised platforms are reached only by ramps and cannot be walked off,
 * - slides along obstacles instead of stopping dead (full move, then tangent, then each axis),
 * - treats `options.extraBoxes` (moving things such as door blockers) like boxes, except that a
 *   box the body already overlaps at the start is ignored for this move, so a closing door can
 *   never trap anyone; boxes never push, so releasing one moves nothing.
 *
 * Long moves are split into sub-steps of at most `options.maxSubstep` metres so nothing is
 * tunnelled through. `position.y` is ignored: the height always comes from the colliders.
 */
function createContext(colliders, options, x, z) {
  const radius = options.radius ?? DEFAULT_RADIUS;
  return {
    colliders,
    radius,
    maxStep: options.maxStep ?? DEFAULT_MAX_STEP,
    obstacleOptions: options.useIndex === false ? { useIndex: false } : {},
    ignoreObstacles: false,
    grids: gridsOf(colliders),
    escaping: false,
    character: null,
    fromX: x,
    fromZ: z,
    // A moving box the body already overlaps is ignored, so it can never trap anyone.
    extraBoxes: Array.isArray(options.extraBoxes)
      ? options.extraBoxes.filter((box) => box && boxNormal(box, x, z, radius) === null)
      : [],
  };
}

/**
 * One horizontal sub-step for the character controller (characterController.js): moves (x, z) by
 * (sx, sz) with sliding. Blocks: obstacles (those with `topY` only while the top is above
 * `limitY`), `extraBoxes`, no-floor cells, leaving the region, and floors higher than `limitY` (the
 * caller passes feet + step height on the ground, feet + TOP_TOLERANCE in the air). Lower floors
 * never block: the controller lets the body fall.
 * @returns {{ x: number, z: number }}
 */
export function characterSlide(x, z, sx, sz, colliders, { radius = DEFAULT_RADIUS, feetY, limitY, extraBoxes = [] } = {}) {
  const ctx = createContext(colliders, { radius, extraBoxes }, x, z);
  ctx.character = { limitY };
  // Tops at or below limitY are not walls: a walker steps onto a kerb within the step height, a
  // body in the air passes over tops just below its feet.
  ctx.obstacleOptions = { feetY: Math.max(feetY ?? -Infinity, (limitY ?? -Infinity) - TOP_TOLERANCE) };
  ctx.escaping = floorAt(x, z, colliders) === null || (ctx.grids.length > 0 && noFloorContact(x, z, colliders, radius, ctx.grids) !== null);
  const next = stepOnce(x, z, null, sx, sz, ctx);
  return next ? { x: next.x, z: next.z } : { x, z };
}

export function moveWithCollisions(position, delta, colliders, options = {}) {
  const maxSubstep = options.maxSubstep ?? DEFAULT_MAX_SUBSTEP;
  const dx = isNumber(delta?.x) ? delta.x : 0;
  const dz = isNumber(delta?.z) ? delta.z : 0;
  let x = isNumber(position?.x) ? position.x : 0;
  let z = isNumber(position?.z) ? position.z : 0;
  const ctx = createContext(colliders, options, x, z);
  // A body that starts without a floor (inside a wall) may step onto any floor to get out.
  let y = floorAt(x, z, colliders, ctx.maxStep);

  const length = Math.hypot(dx, dz);
  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(length / maxSubstep)));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    ctx.escaping = y === null || (ctx.grids.length > 0 && noFloorContact(x, z, colliders, ctx.radius, ctx.grids) !== null);
    const next = stepOnce(x, z, y, sx, sz, ctx);
    if (!next) break;
    x = next.x;
    z = next.z;
    y = next.y;
  }
  return { x, y: y ?? heightAt(x, z, colliders), z };
}
