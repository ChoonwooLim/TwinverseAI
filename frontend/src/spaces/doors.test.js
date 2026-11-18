import { describe, expect, it } from "vitest";
import {
  DOOR_TIMING,
  activeDoorBoxes,
  blockerActive,
  createDoor,
  doorError,
  leafFractions,
  openFraction,
  pathNearDoor,
  placementTransform,
  updateDoor,
} from "./doors";
import { NO_FLOOR, decodeHeightfield } from "./heightfield";
import { DEFAULT_RADIUS, findNearestFloor, moveWithCollisions } from "./walkPhysics";

const SPEC = {
  name: "center",
  leaves: [{ node: "Door_C_Left", openYawDeg: -95 }, { node: "Door_C_Right", openYawDeg: 95 }],
  trigger: { x: 0, z: 3.4, radius: 9 },
  blocker: { minX: -2.5, maxX: 2.5, minZ: 3.1, maxZ: 3.7 },
};
const DT = 1 / 60;

/** Runs a door for `seconds` at 60 Hz with a fixed input. */
function run(door, seconds, input) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) updateDoor(door, DT, input);
  return door;
}

const at = (x, z) => ({ visitor: { x, z } });
const openDoor = () => run(createDoor(SPEC, {}), 2, at(0, 8));

describe("placement of trigger and blocker", () => {
  const cases = [
    [0, { x: 10, z: 23.4 }, { minX: 7.5, maxX: 12.5, minZ: 23.1, maxZ: 23.7 }],
    [90, { x: 13.4, z: 20 }, { minX: 13.1, maxX: 13.7, minZ: 17.5, maxZ: 22.5 }],
    [180, { x: 10, z: 16.6 }, { minX: 7.5, maxX: 12.5, minZ: 16.3, maxZ: 16.9 }],
    [270, { x: 6.6, z: 20 }, { minX: 6.3, maxX: 6.9, minZ: 17.5, maxZ: 22.5 }],
  ];
  for (const [yawDeg, trigger, blocker] of cases) {
    it(`moves them by position and yaw ${yawDeg}`, () => {
      const door = createDoor(SPEC, { position: [10, 0.5, 20], yawDeg });
      expect(door.trigger.x).toBeCloseTo(trigger.x, 9);
      expect(door.trigger.z).toBeCloseTo(trigger.z, 9);
      expect(door.trigger.radius).toBe(9);
      for (const key of Object.keys(blocker)) expect(door.blocker[key]).toBeCloseTo(blocker[key], 9);
      expect(door.approximate).toBe(false);
    });
  }

  it("uses the box around a turned blocker for other yaws and says so", () => {
    expect(createDoor(SPEC, { yawDeg: 30 }).approximate).toBe(true);
    expect(placementTransform({ yawDeg: -90 }).rightAngle).toBe(true);
  });

  it("rejects incomplete descriptions", () => {
    expect(doorError({ ...SPEC, trigger: { x: 0, z: 0 } })).toMatch(/radius/);
    expect(doorError({ ...SPEC, blocker: { minX: 1, maxX: 0, minZ: 0, maxZ: 1 } })).toMatch(/blocker/);
    expect(doorError({ ...SPEC, leaves: "Door_C_Left" })).toMatch(/leaves/);
    expect(doorError(SPEC)).toBeNull();
  });
});

describe("door state machine", () => {
  it("opens with an eased, staggered swing when the visitor comes within the radius", () => {
    const door = createDoor(SPEC, {});
    run(door, 1, at(0, 13)); // 9.6 m away: outside the radius
    expect(door.phase).toBe("closed");
    run(door, 0.1, at(0, 12)); // 8.6 m away
    expect(door.phase).toBe("opening");
    const [first, second] = leafFractions(door);
    expect(first).toBeLessThan(0.1 / DOOR_TIMING.openSeconds); // slow start
    expect(second).toBeLessThan(first); // the second leaf follows a little later
    run(door, DOOR_TIMING.openSeconds - 0.1, at(0, 12));
    expect(door.phase).toBe("open");
    expect(leafFractions(door)).toEqual([1, 1]);
  });

  it("stays open between the radius and 1.25 x radius, closes after 2 s farther away", () => {
    const door = openDoor();
    run(door, 10, at(0, 13.4)); // 10 m: inside the hysteresis band
    expect(door.phase).toBe("open");
    run(door, 1.9, at(0, 15.4)); // 12 m
    expect(door.phase).toBe("open");
    run(door, 0.2, at(0, 15.4));
    expect(door.phase).toBe("closing");
    run(door, DOOR_TIMING.closeSeconds, at(0, 15.4));
    expect(door.phase).toBe("closed");
    expect(openFraction(door)).toBe(0);
  });

  it("reverses mid-swing from its current angle when the visitor comes back", () => {
    const door = openDoor();
    run(door, DOOR_TIMING.closeDelaySeconds + 0.9, at(0, 15.4));
    expect(door.phase).toBe("closing");
    const before = leafFractions(door);
    expect(before[0]).toBeGreaterThan(0.2);
    expect(before[0]).toBeLessThan(0.8);
    updateDoor(door, DT, at(0, 8));
    expect(door.phase).toBe("opening");
    const after = leafFractions(door);
    after.forEach((fraction, i) => expect(Math.abs(fraction - before[i])).toBeLessThan(0.03));
    run(door, DOOR_TIMING.openSeconds, at(0, 8));
    expect(door.phase).toBe("open");
  });

  it("blocks below 0.85 open and releases above, on the way in and out", () => {
    const door = createDoor(SPEC, {});
    expect(blockerActive(door)).toBe(true);
    expect(activeDoorBoxes([door])).toEqual([door.blocker]);
    let released = null;
    for (let i = 1; i <= 120 && released === null; i++) {
      updateDoor(door, DT, at(0, 8));
      if (!blockerActive(door)) released = i * DT;
    }
    expect(openFraction(door)).toBeGreaterThanOrEqual(DOOR_TIMING.blockBelowFraction);
    expect(released).toBeGreaterThan(0.8);
    expect(released).toBeLessThan(DOOR_TIMING.openSeconds);
    run(door, 1, at(0, 8));
    expect(activeDoorBoxes([door])).toEqual([]);
    run(door, DOOR_TIMING.closeDelaySeconds + 0.1, at(0, 15.4));
    expect(door.phase).toBe("closing");
    expect(blockerActive(door)).toBe(false);
    run(door, 1, at(0, 15.4));
    expect(blockerActive(door)).toBe(true);
  });

  it("never closes while the visitor is where the leaves swing", () => {
    // A tiny trigger far from the leaves: only the sweep rule keeps the door open.
    const door = createDoor({ ...SPEC, trigger: { x: 0, z: 30, radius: 0.5 } }, {});
    run(door, 0.5, at(0, 3.4)); // standing in the doorway
    expect(door.phase).toBe("opening");
    run(door, 20, at(0, 3.4));
    expect(door.phase).toBe("open");
    run(door, 20, at(0, 6)); // just beside the swing area
    expect(door.phase).toBe("open");
    run(door, DOOR_TIMING.closeDelaySeconds + 0.1, at(0, 40));
    expect(door.phase).toBe("closing");
  });

  it("uses short linear moves with reduced motion", () => {
    const door = createDoor(SPEC, {});
    const reduced = { visitor: { x: 0, z: 8 }, reducedMotion: true };
    run(door, DOOR_TIMING.reducedOpenSeconds / 2, reduced);
    leafFractions(door, true).forEach((fraction) => expect(fraction).toBeCloseTo(0.5, 6));
    run(door, DOOR_TIMING.reducedOpenSeconds / 2, reduced);
    expect(door.phase).toBe("open");
    const away = { visitor: { x: 0, z: 15.4 }, reducedMotion: true };
    run(door, DOOR_TIMING.closeDelaySeconds + 0.05, away);
    run(door, DOOR_TIMING.reducedCloseSeconds, away);
    expect(door.phase).toBe("closed");
  });

  it("is forced open (for the tour) and stays closed with no visitor", () => {
    const door = createDoor(SPEC, {});
    run(door, 5, { visitor: null });
    expect(door.phase).toBe("closed");
    run(door, 2, { visitor: null, forceOpen: true });
    expect(door.phase).toBe("open");
    expect(pathNearDoor(door, [{ x: 50, z: 50 }, { x: 4, z: 8 }])).toBe(true);
    expect(pathNearDoor(door, [{ x: 50, z: 50 }])).toBe(false);
  });

  it("keeps working without leaves", () => {
    const door = createDoor(SPEC, {}, { leaves: [] });
    expect(blockerActive(door)).toBe(true);
    run(door, 2, at(0, 8));
    expect(blockerActive(door)).toBe(false);
  });
});

describe("walking through an opening door", () => {
  // Wall along z 3..4 as no-floor cells with a 5 m passage (x -2.5..2.5) where the door hangs.
  const cellM = 0.5;
  const cols = 40;
  const rows = 40;
  const bytes = new Uint8Array(cols * rows * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wall = (r === 16 || r === 17) && (c < 15 || c > 24);
      view.setUint16((r * cols + c) * 2, wall ? NO_FLOOR : 0, true);
    }
  }
  const grid = decodeHeightfield(bytes, { originX: -10, originZ: -5, cellM, cols, rows, minY: 0, maxY: 1, rowAxis: "z", colAxis: "x" });
  const colliders = { heightfields: [grid] };
  const spec = { ...SPEC, trigger: { x: 0, z: 3.5, radius: 9 }, blocker: { minX: -2.5, maxX: 2.5, minZ: 3, maxZ: 4 } };
  const valid = (p) => findNearestFloor(p.x, p.z, colliders, { maxDistance: 0 }) !== null;

  function runThrough(start, velocity) {
    const door = createDoor(spec, {});
    let p = { x: start[0], y: 0, z: start[1] };
    let blockedFrames = 0;
    for (let i = 0; i < 600 && p.z > -3; i++) {
      updateDoor(door, DT, { visitor: p });
      const boxes = activeDoorBoxes([door]);
      const next = moveWithCollisions(p, { x: velocity[0] * DT, z: velocity[1] * DT }, colliders, { extraBoxes: boxes });
      if (Math.abs(next.z - p.z) < 1e-6) blockedFrames++;
      if (boxes.length && next.x > -2.5 && next.x < 2.5) expect(next.z).toBeGreaterThanOrEqual(4 + DEFAULT_RADIUS - 1e-6);
      expect(valid(next)).toBe(true);
      p = next;
    }
    return { p, blockedFrames };
  }

  it("stops a runner at the leaves for a moment, then lets them through", () => {
    const { p, blockedFrames } = runThrough([0.3, 6], [0, -4.76]);
    expect(blockedFrames).toBeGreaterThan(5);
    expect(p.z).toBeLessThan(-2.9);
  });

  it("does not push a runner sliding along the leaves into the wall or a no-floor cell", () => {
    const { p } = runThrough([1.5, 6], [2.2, -4.2]);
    expect(valid(p)).toBe(true);
  });
});
