import { describe, expect, it } from "vitest";
import { DEFAULT_RADIUS, heightAt, moveWithCollisions, obstacleNormalAt } from "./walkPhysics";

// Same shape as the National Assembly contract example.
const SITE = {
  units: "m",
  ground: { minX: -200, maxX: 200, minZ: -110, maxZ: 270 },
  platforms: [{ name: "podium", minX: -65, maxX: 65, minZ: -44, maxZ: 44, y: 5 }],
  ramps: [{ name: "front-stairs", minX: -25, maxX: 25, zBottom: 62, zTop: 44, yBottom: 0, yTop: 5 }],
  boxes: [{ name: "main-body", minX: -52, maxX: 52, minZ: -31, maxZ: 31 }],
  circles: [{ name: "column-01", x: -59, z: 41, r: 1.6 }],
  spawn: { x: 0, y: 0, z: 150, faceYaw: Math.PI },
};

const at = (x, z, y = 0) => ({ x, y, z });

describe("heightAt", () => {
  it("is 0 on open ground, the platform height on the podium and interpolated on the ramp", () => {
    expect(heightAt(0, 150, SITE)).toBe(0);
    expect(heightAt(60, 0, SITE)).toBe(5);
    expect(heightAt(0, 53, SITE)).toBeCloseTo(2.5, 6);
    expect(heightAt(0, 62, SITE)).toBeCloseTo(0, 6);
    expect(heightAt(30, 53, SITE)).toBe(0); // beside the stairs
  });

  it("picks the highest applicable surface", () => {
    const stacked = {
      platforms: [
        { minX: 0, maxX: 10, minZ: 0, maxZ: 10, y: 1 },
        { minX: 5, maxX: 10, minZ: 5, maxZ: 10, y: 3 },
      ],
    };
    expect(heightAt(2, 2, stacked)).toBe(1);
    expect(heightAt(7, 7, stacked)).toBe(3);
  });

  it("supports ramps running along X", () => {
    const xRamp = { ramps: [{ minZ: -2, maxZ: 2, xBottom: 10, xTop: 0, yBottom: 0, yTop: 2 }] };
    expect(heightAt(5, 0, xRamp)).toBeCloseTo(1, 6);
    expect(heightAt(5, 3, xRamp)).toBe(0);
  });
});

describe("moveWithCollisions", () => {
  it("walks on flat ground", () => {
    const next = moveWithCollisions(at(0, 150), { x: 0, z: -5 }, SITE);
    expect(next.x).toBeCloseTo(0, 6);
    expect(next.z).toBeCloseTo(145, 6);
    expect(next.y).toBe(0);
  });

  it("climbs the front stairs onto the podium", () => {
    const half = moveWithCollisions(at(0, 70), { x: 0, z: -17 }, SITE);
    expect(half.z).toBeCloseTo(53, 6);
    expect(half.y).toBeCloseTo(2.5, 6);

    const top = moveWithCollisions(half, { x: 0, z: -13 }, SITE);
    expect(top.z).toBeCloseTo(40, 6);
    expect(top.y).toBe(5);
  });

  it("is blocked by the podium side wall", () => {
    const next = moveWithCollisions(at(70, 0), { x: -10, z: 0 }, SITE);
    expect(next.x).toBeGreaterThan(64.99);
    expect(next.y).toBe(0);
  });

  it("cannot step off the podium edge", () => {
    const east = moveWithCollisions(at(60, 0, 5), { x: 10, z: 0 }, SITE);
    expect(east.x).toBeLessThanOrEqual(65);
    expect(east.y).toBe(5);

    const back = moveWithCollisions(at(0, -40, 5), { x: 0, z: -10 }, SITE);
    expect(back.z).toBeGreaterThanOrEqual(-44);
    expect(back.y).toBe(5);
  });

  it("cannot drop off the side of the stairs", () => {
    const next = moveWithCollisions(at(24, 53), { x: 5, z: 0 }, SITE);
    expect(next.x).toBeLessThanOrEqual(25);
    expect(next.y).toBeCloseTo(2.5, 6);
  });

  it("is blocked by a box and slides along it", () => {
    const next = moveWithCollisions(at(0, 35, 5), { x: 3, z: -10 }, SITE);
    expect(next.z).toBeGreaterThanOrEqual(31 + DEFAULT_RADIUS - 1e-6);
    expect(next.z).toBeLessThan(31.6);
    expect(next.x).toBeCloseTo(3, 4);
    expect(next.y).toBe(5);
  });

  it("is blocked by a circle and slides around it", () => {
    const column = SITE.circles[0];
    // Walking straight at the column, 0.5 m off its centre line.
    const touching = moveWithCollisions(at(-58.5, 36, 5), { x: 0, z: 8 }, SITE);
    const gap = Math.hypot(touching.x - column.x, touching.z - column.z);
    expect(gap).toBeGreaterThanOrEqual(column.r + DEFAULT_RADIUS - 1e-6);
    expect(touching.x).toBeGreaterThan(-58.5); // pushed sideways instead of stopping dead

    const past = moveWithCollisions(at(-58.5, 36, 5), { x: 0, z: 12 }, SITE);
    expect(past.z).toBeGreaterThan(column.z); // made it around
    expect(past.y).toBe(5);
  });

  it("is clamped at the ground edge and slides along it", () => {
    const straight = moveWithCollisions(at(195, 0), { x: 20, z: 0 }, SITE);
    expect(straight.x).toBeCloseTo(200 - DEFAULT_RADIUS, 6);

    const diagonal = moveWithCollisions(at(195, 0), { x: 20, z: 5 }, SITE);
    expect(diagonal.x).toBeCloseTo(200 - DEFAULT_RADIUS, 6);
    expect(diagonal.z).toBeCloseTo(5, 6);
  });

  it("handles a ramp whose zTop is greater than zBottom", () => {
    const site = {
      ground: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
      ramps: [{ minX: -5, maxX: 5, zBottom: -10, zTop: 10, yBottom: 0, yTop: 4 }],
      platforms: [{ minX: -5, maxX: 5, minZ: 10, maxZ: 20, y: 4 }],
    };
    expect(heightAt(0, 0, site)).toBeCloseTo(2, 6);
    const top = moveWithCollisions(at(0, -15), { x: 0, z: 30 }, site);
    expect(top.z).toBeCloseTo(15, 6);
    expect(top.y).toBe(4);
    // Walking off the raised end's side is refused.
    const side = moveWithCollisions(top, { x: 10, z: 0 }, site);
    expect(side.x).toBeLessThanOrEqual(5);
    expect(side.y).toBe(4);
  });

  it("does not tunnel through obstacles on a very long move", () => {
    const next = moveWithCollisions(at(0, 150), { x: 0, z: -200 }, SITE);
    expect(next.z).toBeCloseTo(31 + DEFAULT_RADIUS, 1);
    expect(next.y).toBe(5);
  });

  it("lets a body that starts inside an obstacle walk out", () => {
    const next = moveWithCollisions(at(0, 30, 5), { x: 0, z: 5 }, SITE);
    expect(next.z).toBeGreaterThan(30);
  });
});

describe("obstacle index with hundreds of colliders", () => {
  // Deterministic pseudo-random layout: tree trunks, lamps, benches and hedges.
  function crowdedSite() {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const circles = [];
    for (let i = 0; i < 600; i++) {
      circles.push({ x: -190 + random() * 380, z: -100 + random() * 360, r: 0.2 + random() * 0.8 });
    }
    const boxes = [];
    for (let i = 0; i < 250; i++) {
      const x = -190 + random() * 370;
      const z = -100 + random() * 350;
      boxes.push({ minX: x, maxX: x + 1 + random() * 8, minZ: z, maxZ: z + 0.6 + random() * 2 });
    }
    return { ground: SITE.ground, circles, boxes };
  }

  it("gives exactly the same answers as a brute-force scan", () => {
    const site = crowdedSite();
    let mismatches = 0;
    for (let i = 0; i < 2000; i++) {
      const x = -200 + ((i * 37) % 400) + (i % 7) * 0.13;
      const z = -110 + ((i * 53) % 380) + (i % 5) * 0.21;
      const indexed = obstacleNormalAt(x, z, site, DEFAULT_RADIUS);
      const brute = obstacleNormalAt(x, z, site, DEFAULT_RADIUS, { useIndex: false });
      if ((indexed === null) !== (brute === null)) mismatches++;
    }
    expect(mismatches).toBe(0);

    const start = at(0, 150);
    const delta = { x: 37, z: -61 };
    expect(moveWithCollisions(start, delta, site)).toEqual(
      moveWithCollisions(start, delta, site, { useIndex: false }),
    );
  });

  it("stays fast with 850 obstacles", () => {
    const site = crowdedSite();
    moveWithCollisions(at(0, 0), { x: 1, z: 0 }, site); // build the index once
    const started = performance.now();
    let position = at(0, 150);
    for (let frame = 0; frame < 3000; frame++) {
      const angle = frame * 0.01;
      position = moveWithCollisions(position, { x: Math.cos(angle) * 0.13, z: Math.sin(angle) * 0.13 }, site);
    }
    const elapsed = performance.now() - started;
    // 3000 frames is 50 s of 60 fps walking; the indexed path needs a few milliseconds.
    expect(elapsed).toBeLessThan(1500);
  });
});
