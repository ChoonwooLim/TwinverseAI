import { describe, expect, it } from "vitest";
import {
  CULLED,
  frustumPlanes,
  nextBudgetScale,
  sameMembers,
  selectVegetation,
  speciesMaxDistance,
  speciesWind,
  sphereInFrustum,
} from "./vegetationLod";

const PINE = { distances: [35, 110], lodCount: 3, triangles: [150000, 45000, 4800], maxDistance: 600 };
const SHRUB = { distances: [20], lodCount: 2, triangles: [4000, 400], maxDistance: 150 };
const at = (...xs) => xs.flatMap((x) => [x, 0, 0]);
const origin = { x: 0, y: 0, z: 0 };

/** A frustum looking down -Z from the origin (50 degree vertical field, 16:9, near 0.3, far 2500). */
function lookDownMinusZ() {
  const f = 1 / Math.tan((25 * Math.PI) / 180);
  const aspect = 16 / 9;
  const near = 0.3;
  const far = 2500;
  // WebGPU-style projection (depth 0..1), column-major, camera at the origin with identity view.
  return frustumPlanes([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far / (near - far), -1,
    0, 0, (near * far) / (near - far), 0,
  ]);
}

describe("species settings", () => {
  it("defaults the draw distance by height and cuts small plants at their last LOD", () => {
    const far = { farDistance: 600, lodScale: 1, smallPlantFactor: 1.5 };
    expect(speciesMaxDistance({ heightM: 0.4, distances: [12, 35], lodCount: 3 }, far)).toBeCloseTo(35 * 1.5, 9);
    expect(speciesMaxDistance({ heightM: 0.4, distances: [30, 90], lodCount: 3 }, far)).toBe(60);
    expect(speciesMaxDistance({ heightM: 3, distances: [30, 90], lodCount: 3 }, far)).toBe(135);
    expect(speciesMaxDistance({ heightM: 16, distances: [40, 120], lodCount: 3 }, far)).toBe(600);
    // With an impostor level (four LODs) small plants keep their height default.
    expect(speciesMaxDistance({ heightM: 3, distances: [30, 90, 140], lodCount: 4, hasImpostor: true }, far)).toBe(150);
    expect(speciesMaxDistance({ heightM: 0.4, maxDistanceM: 25, distances: [12, 35], lodCount: 3 }, far)).toBe(25);
  });

  it("reads wind per species: missing = 1, 0 = none, clamped to 0..1", () => {
    expect(speciesWind({})).toBe(1);
    expect(speciesWind({ wind: null })).toBe(1);
    expect(speciesWind({ wind: "x" })).toBe(1);
    expect(speciesWind({ wind: 0 })).toBe(0);
    expect(speciesWind({ wind: 0.4 })).toBe(0.4);
    expect(speciesWind({ wind: 3 })).toBe(1);
    expect(speciesWind({ wind: -2 })).toBe(0);
  });
});

describe("selectVegetation", () => {
  it("assigns levels by scaled distance per group, with N levels", () => {
    const FOUR = { distances: [30, 90, 150], lodCount: 4, triangles: [100000, 30000, 4000, 10], maxDistance: 600 };
    const result = selectVegetation({
      positions: at(10, 50, 200, 10, 30, 20, 100, 400),
      groups: [0, 0, 0, 1, 1, 2, 2, 2],
      groupSettings: [PINE, SHRUB, FOUR],
      camera: origin,
    });
    expect([...result.lods]).toEqual([0, 1, 2, 0, 1, 0, 2, 3]);
    expect(result.lists[2]).toEqual([[5], [], [6], [7]]);
    expect(result.counts).toEqual([3, 2, 2, 1]);
    expect(result.triangles.main).toBe(150000 + 45000 + 4800 + 4000 + 400 + 100000 + 4000 + 10);
    const input = { positions: at(20, 60), groups: [0, 0], groupSettings: [PINE], camera: origin };
    expect([...selectVegetation(input).lods]).toEqual([0, 1]);
    expect([...selectVegetation({ ...input, scale: 0.5 }).lods]).toEqual([1, 2]); // boundaries 17.5 / 55 m
  });

  it("keeps the current level inside the hysteresis band", () => {
    const base = { groups: [0], groupSettings: [PINE], camera: origin };
    expect(selectVegetation({ ...base, positions: at(36), previous: Uint8Array.of(0) }).lods[0]).toBe(0);
    expect(selectVegetation({ ...base, positions: at(39), previous: Uint8Array.of(0) }).lods[0]).toBe(1);
    expect(selectVegetation({ ...base, positions: at(33), previous: Uint8Array.of(1) }).lods[0]).toBe(1);
    expect(selectVegetation({ ...base, positions: at(31), previous: Uint8Array.of(1) }).lods[0]).toBe(0);
  });

  it("does not draw beyond the species' maximum distance, with hysteresis, and fades small plants in", () => {
    const flower = { distances: [12, 35], lodCount: 3, triangles: [3000, 1100, 380], maxDistance: 60, fadeBand: 0.15 };
    const base = { groups: [0], groupSettings: [flower], camera: origin };
    expect(selectVegetation({ ...base, positions: at(62) }).lods[0]).toBe(CULLED);
    expect(selectVegetation({ ...base, positions: at(62), previous: Uint8Array.of(2) }).lods[0]).toBe(2);
    expect(selectVegetation({ ...base, positions: at(57), previous: Uint8Array.of(CULLED) }).lods[0]).toBe(CULLED);
    const fading = selectVegetation({ ...base, positions: at(55.5) });
    expect(fading.lods[0]).toBe(2);
    expect(fading.fade[0]).toBeGreaterThan(0.2);
    expect(fading.fade[0]).toBeLessThan(0.8);
    expect(selectVegetation({ ...base, positions: at(30) }).fade[0]).toBe(1);
    expect(selectVegetation({ ...base, positions: at(62) }).culled.distance).toBe(1);
  });

  it("culls instances outside the camera frustum, but keeps them as shadow casters", () => {
    const planes = lookDownMinusZ();
    expect(sphereInFrustum(planes, 0, 0, -50, 1)).toBe(true);
    expect(sphereInFrustum(planes, 0, 0, 50, 1)).toBe(false);
    expect(sphereInFrustum(planes, 0, 0, 0.5, 1)).toBe(true); // touching the near plane
    // Trees ahead, behind and far to the side.
    const positions = [0, 0, -50, 0, 0, 50, 500, 0, -50];
    const spheres = [0, 7, -50, 8, 0, 7, 50, 8, 500, 7, -50, 8];
    const result = selectVegetation({
      positions,
      spheres,
      groups: [0, 0, 0],
      groupSettings: [PINE],
      camera: origin,
      planes,
      shadow: { distance: 120, cascades: 2 },
    });
    expect([...result.lods]).toEqual([1, CULLED, CULLED]);
    expect(result.culled.frustum).toBe(2);
    expect(result.shadowLists[0]).toEqual([0, 1]); // the tree behind still casts into view
    expect(result.triangles.shadow).toBe(2 * 4800 * 2); // LOD2 x two casters x two cascades
  });

  it("caps LOD0 across groups, keeping the nearest, and favours current LOD0 members", () => {
    const result = selectVegetation({ positions: at(5, 12, 8, 3, 15), groups: [0, 0, 1, 1, 0], groupSettings: [PINE, SHRUB], camera: origin, maxLod0: 2 });
    expect([...result.lods]).toEqual([0, 1, 1, 0, 1]);
    const input = { positions: at(10, 10.5), groups: [0, 0], groupSettings: [PINE], camera: origin, maxLod0: 1 };
    expect([...selectVegetation({ ...input, previous: Uint8Array.of(1, 0) }).lods]).toEqual([1, 0]);
    expect([...selectVegetation({ ...input, previous: Uint8Array.of(0, 1) }).lods]).toEqual([0, 1]);
  });

  it("builds a short reflection set at the cheapest level", () => {
    const result = selectVegetation({ positions: at(30, 80, 200), groups: [0, 0, 0], groupSettings: [PINE], camera: origin, reflection: { distance: 90 } });
    expect(result.reflectionLists[0]).toEqual([0, 1]);
    expect(result.triangles.reflection).toBe(2 * 4800);
  });

  it("limits casters to each species' own range and counts reflections at the level drawn", () => {
    // A four-level tree (LOD3 = 24-triangle impostor), a small plant casting within 25 m, a grate that never casts.
    const tree = { distances: [30, 90, 170], lodCount: 4, triangles: [150000, 17000, 2200, 24], shadowLod: 2, shadowDistance: 120, reflectionLod: 2 };
    const plant = { distances: [14, 40], lodCount: 3, triangles: [3000, 1100, 380], shadowLod: 2, shadowDistance: 25 };
    const grate = { distances: [20, 60], lodCount: 3, triangles: [2900, 860, 300], shadowLod: 2, shadowDistance: 0 };
    const result = selectVegetation({
      positions: at(10, 50, 200, 10, 30, 5),
      groups: [0, 0, 0, 1, 1, 2],
      groupSettings: [tree, plant, grate],
      camera: origin,
      shadow: { distance: 120, cascades: 1 },
      reflection: { distance: 90 },
    });
    expect([...result.lods].slice(0, 3)).toEqual([0, 1, 3]); // the far tree is drawn as its impostor
    expect(Array.from(result.counts, (count) => count ?? 0)).toEqual([3, 2, 0, 1]);
    expect(result.shadowLists).toEqual([[0, 1], [3], []]);
    expect(result.triangles.shadow).toBe(2 * 2200 + 380); // never the impostor, never the grate
    expect(result.triangles.reflection).toBe(2 * 2200 + 2 * 380 + 300); // trees at LOD2, not the impostor
  });
});

describe("triangle budget", () => {
  it("tightens in proportion when over, relaxes slowly when well under, within limits", () => {
    expect(nextBudgetScale(1, 20_000_000, 10_000_000)).toBeCloseTo(Math.sqrt(0.5), 9);
    expect(nextBudgetScale(1, 400_000_000, 10_000_000)).toBe(0.7); // at most 30 % per step
    expect(nextBudgetScale(0.31, 400_000_000, 10_000_000)).toBe(0.3); // floor
    expect(nextBudgetScale(0.5, 9_000_000, 10_000_000)).toBe(0.5); // inside the band: hold
    expect(nextBudgetScale(0.5, 5_000_000, 10_000_000)).toBeCloseTo(0.53, 9);
    expect(nextBudgetScale(0.99, 1_000_000, 10_000_000)).toBe(1);
    // Converges below the budget when triangles fall with the scale squared.
    let scale = 1;
    for (let i = 0; i < 30; i++) scale = nextBudgetScale(scale, 30_000_000 * scale * scale, 10_000_000);
    expect(30_000_000 * scale * scale).toBeLessThanOrEqual(10_000_000);
    expect(30_000_000 * scale * scale).toBeGreaterThan(5_000_000);
  });
});

describe("a full planting", () => {
  function planting(count) {
    let seed = 99;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const positions = new Float32Array(count * 3);
    const groups = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = -200 + random() * 400;
      positions[i * 3 + 1] = random() * 5;
      positions[i * 3 + 2] = -110 + random() * 380;
      groups[i] = i % 5;
    }
    return { positions, groups, groupSettings: [PINE, PINE, { ...PINE, distances: [30, 90] }, SHRUB, SHRUB] };
  }

  it("is fast with 10 000 instances", () => {
    const data = planting(10000);
    const started = performance.now();
    let previous = null;
    for (let frame = 0; frame < 100; frame++) {
      const camera = { x: Math.sin(frame * 0.01) * 50, y: 2, z: 100 - frame * 0.05 };
      previous = selectVegetation({ ...data, camera, previous, maxLod0: 24, shadow: { distance: 120 } }).lods;
    }
    expect((performance.now() - started) / 100).toBeLessThan(15);
  });

  it("does not churn while the camera stands still or sways in place", () => {
    const data = planting(600);
    const options = { ...data, maxLod0: 24, scale: 0.85 };
    const first = selectVegetation({ ...options, camera: { x: 0, y: 2, z: 120 } });
    const again = selectVegetation({ ...options, camera: { x: 0, y: 2, z: 120 }, previous: first.lods });
    for (let g = 0; g < data.groupSettings.length; g++) {
      for (let l = 0; l < first.lists[g].length; l++) expect(sameMembers(first.lists[g][l], again.lists[g][l])).toBe(true);
    }
    let previous = again.lods;
    for (let step = 0; step < 50; step++) {
      const sway = { x: Math.sin(step) * 0.4, y: 2, z: 120 + Math.cos(step) * 0.4 };
      const next = selectVegetation({ ...options, camera: sway, previous });
      expect([...next.lods]).toEqual([...first.lods]);
      previous = next.lods;
    }
  });
});
