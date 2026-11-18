import { describe, expect, it } from "vitest";
import { CAMERA_ARM, allowedArmLength, armRays, avatarOpacity, updateArmLength } from "./cameraArm";
import { buildTriangleBVH, buildTriangleBVHNow, raycastBVH } from "./triangleBVH";

/** Builds a BVH for quads given as four corners each. */
function quads(...list) {
  const positions = [];
  const indices = [];
  for (const corners of list) {
    const base = positions.length / 3;
    for (const c of corners) positions.push(...c);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return buildTriangleBVHNow(new Float32Array(positions), new Uint32Array(indices));
}

const castAll = (bvh, rays) => rays.map(({ origin, end }) => {
  const d = { x: end.x - origin.x, y: end.y - origin.y, z: end.z - origin.z };
  const length = Math.hypot(d.x, d.y, d.z);
  const u = raycastBVH(bvh, origin.x, origin.y, origin.z, d.x, d.y, d.z, 1);
  return Number.isFinite(u) ? u * length : Infinity;
});

const target = { x: 0, y: 1.5, z: 0 };
const back = { x: 0, y: 0, z: -1 };
const right = { x: -1, y: 0, z: 0 }; // right of a camera behind the target looking along +Z
const up = { x: 0, y: 1, z: 0 };

describe("triangle BVH", () => {
  it("finds the nearest hit among many triangles, from either side, and misses cleanly", () => {
    // 200 walls across the Z axis, one per metre.
    const walls = Array.from({ length: 200 }, (_, i) => [[-1, 0, i + 1], [1, 0, i + 1], [1, 3, i + 1], [-1, 3, i + 1]]);
    const bvh = quads(...walls);
    expect(bvh.nodeCount).toBeGreaterThan(10);
    expect(raycastBVH(bvh, 0, 1, 0.5, 0, 0, 1)).toBeCloseTo(0.5, 6);
    expect(raycastBVH(bvh, 0, 1, 250, 0, 0, -1)).toBeCloseTo(50, 6); // back faces count
    expect(raycastBVH(bvh, 5, 1, 0, 0, 0, 1)).toBe(Infinity);
    expect(raycastBVH(bvh, 0, 1, 0.5, 0, 0, 1, 0.4)).toBe(Infinity); // beyond maxT
  });

  it("builds a slice at a time", () => {
    const walls = Array.from({ length: 3000 }, (_, i) => [[-1, 0, i], [1, 0, i], [1, 3, i], [-1, 3, i]]);
    const positions = [];
    const indices = [];
    for (const corners of walls) {
      const base = positions.length / 3;
      for (const c of corners) positions.push(...c);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const job = buildTriangleBVH(new Float32Array(positions), new Uint32Array(indices), { sliceTriangles: 500 });
    let yields = 0;
    let step = job.next();
    while (!step.done) {
      yields++;
      step = job.next();
    }
    expect(yields).toBeGreaterThan(10);
    expect(raycastBVH(step.value, 0, 1, 10.5, 0, 0, 1)).toBeCloseTo(0.5, 6);
  });
});

describe("spring arm", () => {
  it("keeps the wanted length when the way is clear, and stops a margin in front of a wall", () => {
    const empty = quads([[50, 0, 50], [51, 0, 50], [51, 1, 50], [50, 1, 50]]);
    expect(allowedArmLength(castAll(empty, armRays(target, back, 6, right, up)), 6)).toBe(6);
    // A wall across the arm 4 m behind the target.
    const wall = quads([[-5, -5, -4], [5, -5, -4], [5, 8, -4], [-5, 8, -4]]);
    const allowed = allowedArmLength(castAll(wall, armRays(target, back, 6, right, up)), 6);
    expect(allowed).toBeCloseTo(4 - CAMERA_ARM.margin, 6);
  });

  it("uses the side rays at grazing angles, and never goes below the minimum", () => {
    // A wall slanting across the arm: x = 0.4 + 0.1 z, crossing the centre ray 4 m behind.
    const slant = quads([[0.9, -5, 5], [-0.6, -5, -10], [-0.6, 8, -10], [0.9, 8, 5]]);
    const hits = castAll(slant, armRays(target, back, 6, right, up));
    expect(hits[0]).toBeCloseTo(4, 3); // centre ray
    const allowed = allowedArmLength(hits, 6);
    expect(allowed).toBeLessThan(4 - CAMERA_ARM.margin - 1); // a side ray met the wall much earlier
    expect(allowedArmLength([0.1], 6)).toBe(CAMERA_ARM.minDistance);
    expect(allowedArmLength([0.1], 0.2)).toBe(0.2); // a zoom closer than the minimum is kept
  });

  it("pulls in at once and eases back out without passing the wanted length", () => {
    expect(updateArmLength(6, 6, 2, 1 / 60)).toBe(2);
    let arm = 2;
    const samples = [];
    for (let i = 0; i < 60; i++) {
      arm = updateArmLength(arm, 6, Infinity, 1 / 60);
      samples.push(arm);
    }
    const at = (seconds) => samples[Math.round(seconds * 60) - 1];
    expect(at(0.1)).toBeLessThan(4.5); // eased, not snapped
    expect(at(0.4)).toBeGreaterThan(2 + 4 * 0.94);
    expect(Math.max(...samples)).toBeLessThanOrEqual(6);
    expect(samples.at(-1)).toBe(6);
    // A new obstacle mid-release pulls in again immediately.
    expect(updateArmLength(4, 6, 3, 1 / 60)).toBe(3);
    // The wanted length is an input, never changed by the collision.
    expect(updateArmLength(null, 9, 3, 1 / 60)).toBe(3);
  });

  it("fades the avatar close to the camera", () => {
    expect(avatarOpacity(2)).toBe(1);
    expect(avatarOpacity(CAMERA_ARM.fadeStart)).toBe(1);
    expect(avatarOpacity(0.675)).toBeCloseTo(0.5, 6);
    expect(avatarOpacity(CAMERA_ARM.hiddenBelow)).toBe(0);
    expect(avatarOpacity(0.1)).toBe(0);
  });
});
