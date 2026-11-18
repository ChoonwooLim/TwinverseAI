/**
 * Selection of instanced vegetation for one frame. Pure functions, no three.js.
 *
 * For every instance (a species member with a base position and a bounding sphere):
 *   - beyond its species' maximum draw distance it is not drawn (with hysteresis), and within the
 *     last `fadeBand` of that distance it is scaled in (`fade`), so small plants do not pop,
 *   - outside the camera frustum (sphere test, slightly enlarged) it is not drawn in the view,
 *   - otherwise it gets LOD 0..N-1 by distance (N = however many levels the species has; N-1
 *     distances, scaled by the preset and the triangle budget), with hysteresis, and a global
 *     LOD0 cap keeps the nearest.
 * Independently of the frustum, instances within `shadow.distance` form the shadow-caster set
 * (one cheap LOD) and those within `reflection.distance` the water-reflection set.
 * Triangle totals per pass come back with the selection, for the budget controller.
 */

export const CULLED = 255;

/**
 * Wind factor of a species from vegetation.json: `wind` clamped to 0..1, 1 when missing or not a
 * number. 0 means the species gets no wind at all.
 */
export function speciesWind(entry) {
  const value = Number(entry?.wind);
  if (entry?.wind === undefined || entry?.wind === null || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Default draw distance by plant height (m) when the manifest gives no maxDistanceM. */
export const SMALL_PLANT_DISTANCES = Object.freeze({ underOneAndHalf: 60, underFour: 150 });

/**
 * Maximum draw distance for a species: `maxDistanceM` from the manifest, else by height (under
 * 1.5 m about 60 m, under 4 m about 150 m, otherwise the preset's far distance). Small plants
 * (under 4 m) are also cut at their last LOD distance x lodScale x smallPlantFactor until an
 * impostor level exists; trees keep their last LOD out to the far distance.
 */
export function speciesMaxDistance({ maxDistanceM, heightM, distances = [], lodCount = 1, hasImpostor = false }, { farDistance = 600, lodScale = 1, smallPlantFactor = 1.5 } = {}) {
  const far = Number.isFinite(farDistance) && farDistance > 0 ? farDistance : 600;
  if (Number.isFinite(maxDistanceM) && maxDistanceM > 0) return Math.min(maxDistanceM, far);
  const height = Number.isFinite(heightM) ? heightM : 10;
  let limit = height < 1.5 ? SMALL_PLANT_DISTANCES.underOneAndHalf : height < 4 ? SMALL_PLANT_DISTANCES.underFour : far;
  if (height < 4 && !hasImpostor && lodCount > 1) {
    const last = distances[lodCount - 2];
    if (Number.isFinite(last)) limit = Math.min(limit, last * lodScale * smallPlantFactor);
  }
  return Math.min(limit, far);
}

/**
 * The six frustum planes (nx, ny, nz, d; inside where n.p + d >= 0) of a column-major
 * view-projection matrix, for clip depth in [0, 1] (WebGPU) or [-1, 1] (WebGL).
 */
export function frustumPlanes(m, { depthZeroToOne = true } = {}) {
  const row = (r) => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const [r0, r1, r2, r3] = [row(0), row(1), row(2), row(3)];
  const combos = [
    r3.map((v, i) => v + r0[i]),
    r3.map((v, i) => v - r0[i]),
    r3.map((v, i) => v + r1[i]),
    r3.map((v, i) => v - r1[i]),
    depthZeroToOne ? r2.slice() : r3.map((v, i) => v + r2[i]),
    r3.map((v, i) => v - r2[i]),
  ];
  const planes = new Float64Array(24);
  combos.forEach((p, k) => {
    const length = Math.hypot(p[0], p[1], p[2]) || 1;
    for (let i = 0; i < 4; i++) planes[k * 4 + i] = p[i] / length;
  });
  return planes;
}

/** Whether a sphere touches the frustum. */
export function sphereInFrustum(planes, x, y, z, r) {
  for (let k = 0; k < 6; k++) {
    const o = k * 4;
    if (planes[o] * x + planes[o + 1] * y + planes[o + 2] * z + planes[o + 3] < -r) return false;
  }
  return true;
}

/**
 * Triangle-budget controller: shrinks the distance scale when a frame drew more than the budget
 * (in proportion), lets it grow back slowly when well under it.
 */
export function nextBudgetScale(scale, total, budget, { min = 0.3, max = 1, relax = 1.06, headroom = 0.75 } = {}) {
  if (!(budget > 0) || !(total >= 0) || !Number.isFinite(scale)) return Math.min(max, Math.max(min, Number.isFinite(scale) ? scale : 1));
  if (total > budget) return Math.max(min, scale * Math.max(0.7, Math.sqrt(budget / total)));
  if (total < budget * headroom) return Math.min(max, scale * relax);
  return scale;
}

/**
 * @param {{
 *   positions: ArrayLike<number>,      x, y, z per instance (base)
 *   spheres?: ArrayLike<number> | null, x, y, z, radius per instance (world bounding sphere)
 *   groups: ArrayLike<number>,         species index per instance
 *   groupSettings: { distances: number[], lodCount: number, triangles?: number[], maxDistance?: number, fadeBand?: number,
 *     shadowLod?: number, shadowDistance?: number, reflectionLod?: number }[],
 *                                       shadowDistance: this species' own caster range (0 = never casts);
 *                                       without it the shared shadow distance applies
 *   camera: { x: number, y: number, z: number },
 *   planes?: ArrayLike<number> | null,  frustum planes (frustumPlanes()), null = no frustum culling
 *   frustumMargin?: number,             sphere radius factor for the frustum test
 *   scale?: number, hysteresis?: number, maxLod0?: number | null,
 *   previous?: Uint8Array | null,       last result's `lods`
 *   shadow?: { distance: number, cascades?: number } | null,
 *   reflection?: { distance: number, lod?: number } | null,
 * }} input
 */
export function selectVegetation({
  positions,
  spheres = null,
  groups,
  groupSettings,
  camera,
  planes = null,
  frustumMargin = 1.15,
  scale = 1,
  hysteresis = 0.1,
  maxLod0 = null,
  previous = null,
  shadow = null,
  reflection = null,
}) {
  const n = groups.length;
  const lods = new Uint8Array(n);
  const fade = new Float32Array(n);
  const distance = new Float32Array(n);
  const raise = 1 + hysteresis;
  const lower = 1 - hysteresis;
  const shadowDistance = shadow?.distance > 0 ? shadow.distance : 0;
  const reflectionDistance = reflection?.distance > 0 ? reflection.distance : 0;
  const lists = groupSettings.map((settings) => Array.from({ length: Math.max(1, settings?.lodCount ?? 1) }, () => []));
  const shadowLists = groupSettings.map(() => []);
  const reflectionLists = groupSettings.map(() => []);
  let culledByDistance = 0;
  let culledByFrustum = 0;

  for (let i = 0; i < n; i++) {
    const settings = groupSettings[groups[i]];
    const dx = positions[i * 3] - camera.x;
    const dy = positions[i * 3 + 1] - camera.y;
    const dz = positions[i * 3 + 2] - camera.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    distance[i] = d;
    const known = previous && i < previous.length;
    const before = known ? previous[i] : CULLED;
    const maxD = settings?.maxDistance > 0 ? settings.maxDistance : Infinity;
    const limit = !known ? maxD : before === CULLED ? maxD * lower : maxD * raise;
    if (d > limit) {
      lods[i] = CULLED;
      culledByDistance++;
      continue;
    }
    const band = Math.max(0, Math.min(0.5, settings?.fadeBand ?? 0));
    const t = band > 0 && Number.isFinite(maxD) ? (maxD - d) / (maxD * band) : 1;
    fade[i] = t >= 1 ? 1 : t <= 0 ? 0.001 : t * t * (3 - 2 * t);
    const casterRange = shadowDistance ? Math.min(shadowDistance, settings?.shadowDistance ?? shadowDistance) : 0;
    if (casterRange > 0 && d <= casterRange) shadowLists[groups[i]].push(i);
    if (reflectionDistance && d <= reflectionDistance) reflectionLists[groups[i]].push(i);

    if (planes && spheres) {
      const o = i * 4;
      if (!sphereInFrustum(planes, spheres[o], spheres[o + 1], spheres[o + 2], spheres[o + 3] * frustumMargin)) {
        lods[i] = CULLED;
        culledByFrustum++;
        continue;
      }
    }

    const count = Math.max(1, settings?.lodCount ?? 1);
    let lod = count - 1;
    for (let k = 0; k < count - 1; k++) {
      const boundary = (settings.distances[k] ?? Infinity) * scale;
      // Keep the side of the boundary the instance is already on unless it clearly crossed.
      const edge = !known || before === CULLED ? boundary : before <= k ? boundary * raise : boundary * lower;
      if (d < edge) {
        lod = k;
        break;
      }
    }
    lods[i] = lod;
  }

  if (maxLod0 !== null && maxLod0 !== undefined && Number.isFinite(maxLod0)) {
    const candidates = [];
    for (let i = 0; i < n; i++) if (lods[i] === 0) candidates.push(i);
    if (candidates.length > maxLod0) {
      const key = (i) => distance[i] * (previous && i < previous.length && previous[i] === 0 ? lower : 1);
      candidates.sort((a, b) => key(a) - key(b) || a - b);
      for (let c = Math.max(0, Math.floor(maxLod0)); c < candidates.length; c++) {
        const i = candidates[c];
        lods[i] = Math.min(1, Math.max(0, (groupSettings[groups[i]]?.lodCount ?? 1) - 1));
      }
    }
  }

  const counts = [];
  const triangles = { main: 0, shadow: 0, reflection: 0 };
  for (let i = 0; i < n; i++) {
    const lod = lods[i];
    if (lod === CULLED) continue;
    const settings = groupSettings[groups[i]];
    lists[groups[i]][lod].push(i);
    counts[lod] = (counts[lod] ?? 0) + 1;
    triangles.main += settings?.triangles?.[lod] ?? 0;
  }
  const cascades = Math.max(0, shadow?.cascades ?? 1);
  groupSettings.forEach((settings, g) => {
    const shadowLod = Math.min(Math.max(0, settings?.shadowLod ?? (settings?.lodCount ?? 1) - 1), (settings?.lodCount ?? 1) - 1);
    triangles.shadow += shadowLists[g].length * (settings?.triangles?.[shadowLod] ?? 0) * cascades;
    const reflectionLod = Math.min(settings?.reflectionLod ?? reflection?.lod ?? (settings?.lodCount ?? 1) - 1, (settings?.lodCount ?? 1) - 1);
    triangles.reflection += reflectionLists[g].length * (settings?.triangles?.[reflectionLod] ?? 0);
  });
  return {
    lods,
    fade,
    lists,
    shadowLists,
    reflectionLists,
    counts,
    culled: { distance: culledByDistance, frustum: culledByFrustum },
    triangles,
  };
}

/** True when two ascending index lists have the same members. */
export function sameMembers(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
