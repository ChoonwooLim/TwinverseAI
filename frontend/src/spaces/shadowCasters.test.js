import { describe, expect, it } from "vitest";
import { boxCorners, cascadeOutlines, casterCascadeBits, clipSliceToHeights, hullsOverlap, lightBasis, lightOutline, regionCeiling } from "./shadowCasters";

describe("per-cascade shadow casters", () => {
  // Sun 45 degrees up towards +Z; two cascade regions along -Z (ground to 30 m).
  const basis = lightBasis({ x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 });
  const outlines = cascadeOutlines([
    boxCorners({ x: -50, y: 0, z: -100 }, { x: 50, y: 30, z: 0 }),
    boxCorners({ x: -150, y: 0, z: -400 }, { x: 150, y: 30, z: -100 }),
  ], basis);
  const bits = (min, max) => casterCascadeBits(outlines, lightOutline(boxCorners(min, max), basis));

  it("keeps a caster inside a region and one whose shadow reaches it from the sun side", () => {
    expect(bits({ x: -2, y: 0, z: -52 }, { x: 2, y: 10, z: -48 }) & 1).toBe(1);
    expect(bits({ x: -1, y: 0, z: 29 }, { x: 1, y: 45, z: 31 }) & 1).toBe(1); // a 45 m mast 30 m sunward
  });

  it("drops casters whose shadow cannot land in the region", () => {
    expect(bits({ x: -1, y: 0, z: 59 }, { x: 1, y: 4, z: 61 })).toBe(0); // short and sunward: shadow ends short
    expect(bits({ x: 398, y: 0, z: -52 }, { x: 402, y: 10, z: -48 })).toBe(0); // far to the side
    expect(bits({ x: -2, y: 0, z: -502 }, { x: 2, y: 10, z: -498 })).toBe(0); // beyond, away from the sun
  });

  it("assigns each caster only the cascades it affects", () => {
    expect(bits({ x: -2, y: 0, z: -52 }, { x: 2, y: 10, z: -48 })).toBe(0b01);
    expect(bits({ x: -2, y: 0, z: -252 }, { x: 2, y: 10, z: -248 })).toBe(0b10);
    expect(bits({ x: -2, y: 0, z: -102 }, { x: 2, y: 20, z: -98 })).toBe(0b11);
  });

  it("drops a wide, low wall standing beyond a low region, which a bounding sphere would keep", () => {
    // 150 m wide, 21 m tall, 65 m beyond the far edge of the near region (away from the sun).
    expect(bits({ x: -75, y: 0, z: -175 }, { x: 75, y: 21, z: -165 }) & 1).toBe(0);
  });

  it("ignores the sky and underground parts of a slice and takes the region's own ceiling", () => {
    const slice = [
      { x: -10, y: -2, z: 0 }, { x: 10, y: -2, z: 0 }, { x: 10, y: 8, z: 0 }, { x: -10, y: 8, z: 0 },
      { x: -100, y: -70, z: -150 }, { x: 100, y: -70, z: -150 }, { x: 100, y: 70, z: -150 }, { x: -100, y: 70, z: -150 },
    ];
    const clipped = clipSliceToHeights(slice, -2, 20);
    expect(clipped.every((p) => p.y >= -2 - 1e-9 && p.y <= 20 + 1e-9)).toBe(true);
    expect(lightOutline(clipped, basis).minZ).toBeGreaterThan(lightOutline(slice, basis).minZ);
    expect(clipSliceToHeights(slice, 200, 300)).toEqual([]);
    expect(cascadeOutlines([[]], basis)).toEqual([null]);
    const tops = [{ minX: -10, maxX: 10, minZ: -60, maxZ: -40, top: 21 }, { minX: -10, maxX: 10, minZ: -400, maxZ: -300, top: 71 }];
    expect(regionCeiling(clipped, tops, 20)).toBe(21);
    expect(regionCeiling(clipped, [], 20)).toBe(20);
  });

  it("tests 2D hull overlap", () => {
    const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
    expect(hullsOverlap(square, [[0.5, 0.5], [2, 0.5], [2, 2]])).toBe(true);
    expect(hullsOverlap(square, [[2, 2], [3, 2], [3, 3]])).toBe(false);
    // Diagonal neighbours whose axis-aligned boxes overlap but whose shapes do not.
    expect(hullsOverlap([[0, 0], [2, 0], [0, 2]], [[2, 2], [1.4, 2], [2, 1.4]])).toBe(false);
  });
});
