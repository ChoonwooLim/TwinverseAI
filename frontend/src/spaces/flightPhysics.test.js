import { describe, expect, it } from "vitest";
import {
  FLIGHT,
  createFlightState,
  flightShadowFar,
  landingTarget,
  moveFlying,
  startFlight,
  startLanding,
  stepFlight,
} from "./flightPhysics";
import { NO_FLOOR, decodeHeightfield } from "./heightfield";
import { DEFAULT_RADIUS, walkableSpot } from "./walkPhysics";

const DT = 1 / 60;
const GROUND = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };

/** Runs flight for `seconds` with a fixed input; returns the final step result and samples. */
function fly(state, seconds, input, colliders, options, dt = DT) {
  let result = { state, landed: false, rescue: null };
  const samples = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    result = stepFlight(result.state, input, dt, colliders, options);
    samples.push(result.state);
    if (result.landed) break;
  }
  return { ...result, samples };
}

/** A hovering avatar at (x, y, z). */
const hovering = (x, y, z) => ({ ...createFlightState({ x, y, z }), mode: "fly" });

describe("take-off and speeds", () => {
  it("lifts about 1.5 m in half a second, smoothly, then hovers", () => {
    const colliders = { ground: GROUND };
    const start = startFlight(createFlightState({ x: 50, y: 0, z: 50 }), colliders);
    expect(start.mode).toBe("takeoff");
    const first = stepFlight(start, {}, DT, colliders).state;
    expect(first.y).toBeLessThan(0.02);
    const { state } = fly(first, FLIGHT.takeoffSeconds, {}, colliders);
    expect(state.mode).toBe("fly");
    expect(state.y).toBeCloseTo(FLIGHT.takeoffHeight, 2);
    const later = fly(state, 2, {}, colliders).state;
    expect(later.y).toBeCloseTo(FLIGHT.takeoffHeight, 2);
  });

  it("speeds up and glides to a stop instead of jumping between speeds", () => {
    const colliders = { ground: GROUND };
    const one = stepFlight(hovering(10, 20, 10), { moveZ: 1 }, DT, colliders).state;
    expect(one.vz).toBeGreaterThan(0);
    expect(one.vz).toBeLessThan(1);
    const cruise = fly(one, 3, { moveZ: 1 }, colliders).state;
    expect(cruise.vz).toBeGreaterThan(FLIGHT.cruiseSpeed * 0.99);
    expect(cruise.vz).toBeLessThanOrEqual(FLIGHT.cruiseSpeed + 1e-6);
    const boost = fly(cruise, 3, { moveZ: 1, fast: true }, colliders).state;
    expect(boost.vz).toBeGreaterThan(FLIGHT.fastSpeed * 0.98);
    const coasting = fly(boost, 0.1, {}, colliders).state;
    expect(coasting.vz).toBeGreaterThan(boost.vz * 0.8);
    const stopped = fly(coasting, 4, {}, colliders).state;
    expect(Math.abs(stopped.vz)).toBeLessThan(boost.vz * 0.03);

    const rising = fly(hovering(50, 20, 50), 3, { vertical: 1 }, colliders).state;
    expect(rising.vy).toBeGreaterThan(FLIGHT.verticalSpeed * 0.99);
    const fastRise = fly(hovering(50, 20, 50), 3, { vertical: 1, fast: true }, colliders).state;
    expect(fastRise.vy).toBeGreaterThan(FLIGHT.verticalFastSpeed * 0.99);
  });
});

describe("landing", () => {
  const bench = { minX: 40, maxX: 44, minZ: 40, maxZ: 44 };

  it("glides down at up to 10 m/s onto walkable ground and stands there", () => {
    const colliders = { ground: GROUND };
    const { state, rescue } = startLanding(hovering(50, 60, 50), colliders);
    expect(rescue).toBeNull();
    const result = fly(state, 30, {}, colliders);
    expect(result.landed).toBe(true);
    expect(result.state.mode).toBe("walk");
    expect(result.state.y).toBe(0);
    expect(result.state.x).toBeCloseTo(50, 6);
    const fastest = Math.max(...result.samples.map((s) => -s.vy));
    expect(fastest).toBeLessThanOrEqual(FLIGHT.landingSpeed + 1e-6);
    expect(fastest).toBeGreaterThan(FLIGHT.landingSpeed * 0.9);
  });

  it("lands next to a blocker, outside a no-floor hole and inside the ground, saying why", () => {
    const colliders = { ground: GROUND, boxes: [bench] };
    const onBench = startLanding(hovering(42, 30, 42), colliders);
    expect(onBench.rescue.reason).toBe("blocked");
    const result = fly(onBench.state, 30, {}, colliders);
    expect(result.landed).toBe(true);
    expect(walkableSpot(result.state.x, result.state.z, colliders)).toBe(true);
    expect(Math.hypot(result.state.x - 42, result.state.z - 42)).toBeLessThan(4);

    const outside = landingTarget(-60, 50, colliders);
    expect(outside.reason).toBe("outside the walkable area");
    expect(outside.x).toBeCloseTo(DEFAULT_RADIUS, 6);
    expect(outside.z).toBeCloseTo(50, 6);

    const bytes = new Uint8Array(20 * 20 * 2);
    const view = new DataView(bytes.buffer);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) view.setUint16((r * 20 + c) * 2, c >= 8 && c < 12 && r >= 8 && r < 12 ? NO_FLOOR : 0, true);
    const grid = decodeHeightfield(bytes, { originX: 0, originZ: 0, cellM: 1, cols: 20, rows: 20, minY: 0, maxY: 1, rowAxis: "z", colAxis: "x" });
    const hole = landingTarget(10, 10, { heightfields: [grid] });
    expect(hole.reason).toBe("no floor");
    expect(walkableSpot(hole.x, hole.z, { heightfields: [grid] })).toBe(true);
  });

  it("lands when descending onto the floor, and lands beside a blocker descended onto", () => {
    const colliders = { ground: GROUND, boxes: [bench] };
    const down = fly(hovering(20, 3, 20), 10, { vertical: -1 }, colliders);
    expect(down.landed).toBe(true);
    expect(down.state.y).toBe(0);

    let result = { state: hovering(42, 6, 42) };
    let rescue = null;
    for (let i = 0; i < 1200 && !result.landed; i++) {
      result = stepFlight(result.state, { vertical: -1 }, DT, colliders);
      rescue = rescue ?? result.rescue;
    }
    expect(rescue?.reason).toBe("blocked");
    expect(result.landed).toBe(true);
    expect(walkableSpot(result.state.x, result.state.z, colliders)).toBe(true);
  });
});

describe("limits", () => {
  it("keeps the feet above a heightfield and above analytic platforms", () => {
    // Grid: floor 0 with a 5 m high block for x >= 10.
    const bytes = new Uint8Array(40 * 20 * 2);
    const view = new DataView(bytes.buffer);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 40; c++) view.setUint16((r * 40 + c) * 2, c >= 20 ? Math.round((5 / 10) * 65534) : 0, true);
    const grid = decodeHeightfield(bytes, { originX: 0, originZ: 0, cellM: 0.5, cols: 40, rows: 20, minY: 0, maxY: 10, rowAxis: "z", colAxis: "x" });
    const overGrid = fly(hovering(5, 4, 5), 2, { moveX: 1 }, { heightfields: [grid] }).state;
    expect(overGrid.x).toBeGreaterThan(12);
    expect(overGrid.y).toBeCloseTo(5 + FLIGHT.minClearance, 3);

    const platforms = { ground: GROUND, platforms: [{ minX: 30, maxX: 60, minZ: 0, maxZ: 100, y: 4 }] };
    const overPlatform = fly(hovering(20, 1, 50), 3, { moveX: 1 }, platforms).state;
    expect(overPlatform.x).toBeGreaterThan(35);
    expect(overPlatform.y).toBeGreaterThanOrEqual(4 + FLIGHT.minClearance - 1e-9);
    const low = fly(hovering(50, 10, 50), 5, { vertical: -0.2 }, { ...platforms, boxes: [] }, undefined);
    expect(Math.min(...low.samples.map((s) => s.y))).toBeGreaterThanOrEqual(4 - 1e-9);
  });

  it("stops at the ceiling and at the ground plus 150 m", () => {
    const colliders = { ground: GROUND };
    const up = fly(hovering(50, 280, 50), 10, { vertical: 1, fast: true }, colliders).state;
    expect(up.y).toBe(FLIGHT.ceilingY);
    const far = fly(hovering(50, 50, 50), 20, { moveX: 1, fast: true }, colliders).state;
    expect(far.x).toBeCloseTo(GROUND.maxX + FLIGHT.horizontalMargin, 6);
    const back = fly(hovering(50, 50, 50), 20, { moveZ: -1, fast: true }, colliders).state;
    expect(back.z).toBeCloseTo(GROUND.minZ - FLIGHT.horizontalMargin, 6);
  });
});

describe("blockers and volumes", () => {
  const hedge = { minX: 10, maxX: 12, minZ: -50, maxZ: 50 };

  it("lets the walking blockers apply only near the floor", () => {
    const colliders = { boxes: [hedge] };
    const low = fly(hovering(0, 1, 0), 3, { moveX: 1 }, colliders).state;
    expect(low.x).toBeLessThanOrEqual(10 - DEFAULT_RADIUS + 1e-6);
    const high = fly(hovering(0, 3, 0), 3, { moveX: 1 }, colliders).state;
    expect(high.x).toBeGreaterThan(20);
    // A door blocker (passed like the walker's extra boxes) behaves the same.
    const door = fly(hovering(0, 1, 0), 3, { moveX: 1 }, {}, { extraBoxes: [hedge] }).state;
    expect(door.x).toBeLessThanOrEqual(10 - DEFAULT_RADIUS + 1e-6);
    // Coming down over it, the feet rest on its 2.5 m "top" (and then land beside it).
    const over = fly(hovering(11, 6, 0), 10, { vertical: -0.5 }, colliders);
    const above = over.samples.filter((s) => s.x > 10 && s.x < 12);
    expect(above.length).toBeGreaterThan(10);
    expect(Math.min(...above.map((s) => s.y))).toBeGreaterThanOrEqual(FLIGHT.blockerHeight - 1e-9);
    expect(over.landed).toBe(true);
    expect(over.state.x < 10 - DEFAULT_RADIUS + 1e-6 || over.state.x > 12 + DEFAULT_RADIUS - 1e-6).toBe(true);
  });

  it("keeps the body out of volumes, slides along their faces and does not tunnel at 36 m/s", () => {
    const block = { name: "main-body", minX: 20, maxX: 40, minY: 0, maxY: 30, minZ: -10, maxZ: 10 };
    const colliders = { volumes: [block] };
    const head = fly(hovering(0, 5, 0), 3, { moveX: 1, fast: true }, colliders, undefined, 1 / 20);
    expect(head.state.x).toBeLessThanOrEqual(20 - FLIGHT.bodyRadius + 1e-6);
    expect(head.samples.every((s) => s.x <= 20 - FLIGHT.bodyRadius + 1e-6)).toBe(true);

    const slide = fly(hovering(10, 5, 0), 6, { moveX: 1, moveZ: 0.3 }, colliders).state;
    expect(slide.z).toBeGreaterThan(10.4); // slid along the face and round the corner
    expect(slide.x).toBeGreaterThan(20);

    const thin = { minX: 20, maxX: 20.05, minY: 0, maxY: 50, minZ: -50, maxZ: 50 };
    const fast = fly(hovering(0, 5, 0), 2, { moveX: 1, fast: true }, { volumes: [thin] }, undefined, 1 / 20);
    expect(fast.samples.every((s) => s.x < 20)).toBe(true);

    const roof = { minX: -50, maxX: 50, minY: 10, maxY: 11, minZ: -50, maxZ: 50 };
    const ceiling = fly(hovering(0, 5, 0), 3, { vertical: 1, fast: true }, { volumes: [roof] }).state;
    expect(ceiling.y).toBeLessThanOrEqual(10 - FLIGHT.bodyHeight + 1e-6);

    const free = fly(hovering(0, 5, 0), 3, { moveX: 1 }, {}).state;
    expect(free.x).toBeGreaterThan(30);
  });

  it("moves in sub-steps no longer than maxSubstep", () => {
    const wall = { minX: 5, maxX: 5.01, minY: -10, maxY: 10, minZ: -10, maxZ: 10 };
    const moved = moveFlying({ x: 0, y: 1, z: 0 }, 50, 0, 0, { volumes: [wall] });
    expect(moved.x).toBeLessThan(5);
  });
});

describe("shadow range while flying", () => {
  it("grows with altitude up to the limit and never shrinks below the preset", () => {
    expect(flightShadowFar(160, 2, 45)).toBe(160);
    expect(flightShadowFar(160, 80, 45)).toBe(Math.round(Math.hypot(80, 80) + 60));
    expect(flightShadowFar(160, 300, 45)).toBe(flightShadowFar(160, 80, 45));
    expect(flightShadowFar(600, 80, 45)).toBe(600);
    expect(flightShadowFar(160, 80, 10)).toBe(400);
  });
});
