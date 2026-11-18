import { describe, expect, it } from "vitest";
import { NO_FLOOR, decodeHeightfield, heightfieldError, rightAngleYaw, sampleHeightfield } from "./heightfield";
import { DEFAULT_RADIUS, findNearestFloor, floorAt, heightAt, moveWithCollisions } from "./walkPhysics";

/** Encodes a synthetic grid the way the exporter does and decodes it again. */
function makeGrid({ cols, rows, cellM = 0.5, originX = 0, originZ = 0, minY = 0, maxY = 10, position, yawDeg, cell }) {
  const bytes = new Uint8Array(cols * rows * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = cell(c, r);
      const value = h === null ? NO_FLOOR : Math.round(((h - minY) / (maxY - minY)) * 65534);
      view.setUint16((r * cols + c) * 2, value, true);
    }
  }
  const meta = { file: "test.bin", originX, originZ, cellM, cols, rows, minY, maxY, noFloor: NO_FLOOR, rowAxis: "z", colAxis: "x" };
  if (position) meta.position = position;
  if (yawDeg !== undefined) meta.yawDeg = yawDeg;
  return decodeHeightfield(bytes, meta);
}

const at = (x, z) => ({ x, y: 0, z });
const walk = (colliders, from, delta) => moveWithCollisions(at(...from), { x: delta[0], z: delta[1] }, colliders);

describe("decodeHeightfield", () => {
  it("reads little-endian uint16 rows along +Z and columns along +X", () => {
    // 6 x 3 grid, 1 m cells; only cell (column 5, row 2) is raised to 4 m, (column 1, row 0) has no floor.
    const grid = makeGrid({ cols: 6, rows: 3, cellM: 1, maxY: 8, cell: (c, r) => (c === 5 && r === 2 ? 4 : c === 1 && r === 0 ? null : 0) });
    expect(grid.data[2 * 6 + 5]).toBe(Math.round((4 / 8) * 65534));
    expect(grid.data[1]).toBe(NO_FLOOR);
    expect(sampleHeightfield(grid, 5.5, 2.5)).toBeCloseTo(4, 3);
    expect(sampleHeightfield(grid, 2.5, 5.5)).toBeUndefined(); // swapped axes would land here
    expect(sampleHeightfield(grid, 1.5, 0.5)).toBeNull();
    expect(sampleHeightfield(grid, -0.1, 0.5)).toBeUndefined();
  });

  it("rejects bad sizes, axes and yaw", () => {
    expect(() => decodeHeightfield(new Uint8Array(10), { originX: 0, originZ: 0, cellM: 1, cols: 3, rows: 3, minY: 0, maxY: 1 })).toThrow(/expected 18 bytes/);
    expect(heightfieldError({ originX: 0, originZ: 0, cellM: 1, cols: 2, rows: 2, minY: 0, maxY: 1, rowAxis: "x" })).toMatch(/rowAxis/);
    expect(heightfieldError({ originX: 0, originZ: 0, cellM: 1, cols: 2, rows: 2, minY: 0, maxY: 1, yawDeg: 45 })).toMatch(/yawDeg 45/);
    expect(rightAngleYaw(-90)).toBe(270);
    expect(rightAngleYaw(450)).toBe(90);
    expect(rightAngleYaw(10)).toBeNull();
  });
});

describe("walking on heightfields", () => {
  it("walks across a flat floor", () => {
    const grid = makeGrid({ cols: 40, rows: 40, cell: () => 0.2 });
    const colliders = { heightfields: [grid] };
    const next = walk(colliders, [2, 2], [8, 6]);
    expect(next.x).toBeCloseTo(10, 6);
    expect(next.z).toBeCloseTo(8, 6);
    expect(next.y).toBeCloseTo(0.2, 3);
  });

  it("climbs a staircase of 0.15 m steps", () => {
    // Steps every 0.5 m along +Z: 20 steps up to 3 m.
    const grid = makeGrid({ cols: 20, rows: 30, cell: (c, r) => Math.min(20, r) * 0.15 });
    const next = walk({ heightfields: [grid] }, [5, 0.3], [0, 12]);
    expect(next.z).toBeCloseTo(12.3, 6);
    expect(next.y).toBeCloseTo(3, 2);
  });

  it("is stopped by a wall and slides along it", () => {
    // No-floor wall in columns 20-21 (x 10..11).
    const grid = makeGrid({ cols: 40, rows: 40, cell: (c) => (c === 20 || c === 21 ? null : 0) });
    const colliders = { heightfields: [grid] };
    const blocked = walk(colliders, [5, 5], [10, 0]);
    expect(blocked.x).toBeLessThanOrEqual(10 - DEFAULT_RADIUS + 1e-6);
    const slid = walk(colliders, [9, 5], [4, 4]);
    expect(slid.x).toBeLessThan(10);
    expect(slid.z).toBeGreaterThan(8.9);
  });

  it("passes through a 3 m wide arch in a wall but not through the wall beside it", () => {
    // Wall along z 10..11 (rows 20-21) with an opening for x 8.5..11.5 (columns 17-22).
    const grid = makeGrid({ cols: 40, rows: 40, cell: (c, r) => ((r === 20 || r === 21) && (c < 17 || c > 22) ? null : 0) });
    const colliders = { heightfields: [grid] };
    const through = walk(colliders, [10, 4], [0, 12]);
    expect(through.z).toBeCloseTo(16, 6);
    const wall = walk(colliders, [4, 4], [0, 12]);
    expect(wall.z).toBeLessThanOrEqual(10 - DEFAULT_RADIUS + 1e-6);
  });

  it("does not let the walker step off a raised platform or up onto it", () => {
    // 1 m high platform for x >= 10.
    const grid = makeGrid({ cols: 40, rows: 20, cell: (c) => (c >= 20 ? 1 : 0) });
    const colliders = { heightfields: [grid] };
    const up = walk(colliders, [5, 5], [10, 0]);
    expect(up.x).toBeLessThan(10);
    expect(up.y).toBeCloseTo(0, 3);
    const off = walk(colliders, [15, 5], [-10, 0]);
    expect(off.x).toBeGreaterThanOrEqual(10);
    expect(off.y).toBeCloseTo(1, 3);
  });

  it("keeps the walker out of a no-floor hole", () => {
    const grid = makeGrid({ cols: 40, rows: 40, cell: (c, r) => (c >= 16 && c < 24 && r >= 16 && r < 24 ? null : 0) });
    const colliders = { heightfields: [grid] };
    const next = walk(colliders, [10, 4], [0, 12]);
    expect(Math.abs(next.x - 10)).toBeLessThan(1e-6);
    expect(next.z).toBeLessThanOrEqual(8 - DEFAULT_RADIUS + 1e-6);
    expect(floorAt(10, 10, colliders)).toBeNull();
    expect(heightAt(10, 10, colliders)).toBe(0); // cameras still get a number
  });

  it("checks the whole body circle near a wall, not just the centre", () => {
    const grid = makeGrid({ cols: 40, rows: 40, cell: (c) => (c === 20 ? null : 0) });
    const colliders = { heightfields: [grid] };
    // The centre at x = 9.8 would still be on floor (wall starts at x = 10), the body would not.
    const next = walk(colliders, [9, 5], [0.8, 0]);
    expect(next.x).toBeLessThanOrEqual(10 - DEFAULT_RADIUS + 1e-6);
  });
});

describe("placed grids next to analytic ground", () => {
  // A 10 x 10 m gate court placed at (50, 0.05, 50): open floor at 0.1 m with a wall and arch.
  const court = (yawDeg) => makeGrid({
    cols: 20, rows: 20, cellM: 0.5, originX: -5, originZ: -5, minY: 0, maxY: 5,
    position: [50, 0.05, 50], yawDeg,
    // Local wall along z 0..1 (rows 10-11) with an arch for local x -1.5..1.5 (columns 7-12).
    cell: (c, r) => ((r === 10 || r === 11) && (c < 7 || c > 12) ? null : 0.1),
  });

  it("walks from analytic ground into the grid, through its arch and out again", () => {
    const colliders = { ground: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, heightfields: [court(0)] };
    expect(floorAt(50, 30, colliders)).toBe(0); // analytic outside the footprint
    const inside = walk(colliders, [50, 40], [0, 6]);
    expect(inside.z).toBeCloseTo(46, 6);
    expect(inside.y).toBeCloseTo(0.15, 2); // grid floor plus the placement's y
    const out = walk(colliders, [inside.x, inside.z], [0, 14]);
    expect(out.z).toBeCloseTo(60, 6); // through the arch and back onto analytic ground
    expect(out.y).toBe(0);
    const wall = walk(colliders, [47, 46], [0, 6]);
    expect(wall.z).toBeLessThanOrEqual(50 - DEFAULT_RADIUS + 1e-6);
  });

  it("applies a 180 degree yaw", () => {
    const colliders = { heightfields: [court(180)] };
    // Local wall z 0..1 becomes world z 49..50 after turning about the placement origin.
    expect(floorAt(47, 49.5, colliders)).toBeNull();
    expect(floorAt(47, 50.5, colliders)).toBeCloseTo(0.15, 2);
    const through = walk(colliders, [50, 56], [0, -12]);
    expect(through.z).toBeCloseTo(44, 6);
  });

  it("finds an arch passage in a grid turned by 90 degrees", () => {
    const colliders = { heightfields: [court(90)] };
    // Local +Z maps to world +X... the wall now runs along x 50..51 with the arch at z 48.5..51.5.
    const through = walk(colliders, [44, 50], [12, 0]);
    expect(through.x).toBeCloseTo(56, 6);
    const blocked = walk(colliders, [44, 46.5], [12, 0]);
    expect(blocked.x).toBeLessThan(51);
  });

  it("lets a footprint extend the ground and stops at its far edge", () => {
    // Ground ends at z = 48; the court reaches to z = 55.
    const colliders = { ground: { minX: 0, maxX: 100, minZ: 0, maxZ: 48 }, heightfields: [court(0)] };
    const out = walk(colliders, [50, 40], [0, 30]);
    expect(out.z).toBeGreaterThan(54.5); // walked through the arch into the part past the ground
    expect(out.z).toBeLessThanOrEqual(55);
    const side = walk(colliders, [50, 53], [20, 0]);
    expect(side.x).toBeGreaterThan(54.5); // stops at the footprint edge, no jump back onto the ground
    expect(side.x).toBeLessThanOrEqual(55);
    expect(side.z).toBeCloseTo(53, 6);
  });

  it("rescues a spawn point inside a wall", () => {
    const colliders = { heightfields: [court(0)] };
    const spot = findNearestFloor(47, 50.4, colliders);
    expect(spot).not.toBeNull();
    expect(floorAt(spot.x, spot.z, colliders)).not.toBeNull();
    expect(Math.hypot(spot.x - 47, spot.z - 50.4)).toBeLessThan(2);
  });
});
