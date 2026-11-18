import { describe, expect, it } from "vitest";
import { CHARACTER, JUMP_SPEED, createCharacterState, stepCharacter } from "./characterController";
import { decodeHeightfield } from "./heightfield";

const RUN = 4.76;
const WALK = 1.57;
const GROUND = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

/**
 * Runs the controller for `seconds`. `input(state, t)` returns { vx, vz, jump } (m/s and a held key).
 * Returns the final state and every step's result.
 */
function simulate(state, seconds, input, colliders, dt = 1 / 60) {
  let s = state;
  const frames = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const { vx = 0, vz = 0, jump = false } = input(s, t) ?? {};
    const result = stepCharacter(s, { dx: vx * dt, dz: vz * dt, jump }, dt, colliders);
    s = result.state;
    frames.push({ ...result, t: t + dt });
  }
  return { state: s, frames };
}

const standing = (x, z, colliders) => createCharacterState({ x, z }, colliders);
const ledge = (y) => ({ ground: GROUND, platforms: [{ minX: 10, maxX: 20, minZ: -50, maxZ: 50, y }] });

describe("jumping", () => {
  it("reaches about 1.4 m and comes down after 2 v / g", () => {
    const colliders = { ground: GROUND };
    const { frames } = simulate(standing(0, 0, colliders), 1.2, (s, t) => ({ jump: t < 0.05 }), colliders);
    const apex = Math.max(...frames.map((f) => f.state.y));
    expect(apex).toBeCloseTo(CHARACTER.jumpApex, 2);
    const landing = frames.find((f) => f.landed);
    expect(landing.t).toBeCloseTo((2 * JUMP_SPEED) / CHARACTER.gravity, 1);
    expect(landing.state.y).toBe(0);
  });

  it("has the same apex at 30 and 144 frames per second", () => {
    const colliders = { ground: GROUND };
    const apexAt = (fps) => Math.max(...simulate(standing(0, 0, colliders), 1, (s, t) => ({ jump: t < 0.01 }), colliders, 1 / fps).frames.map((f) => f.state.y));
    expect(Math.abs(apexAt(30) - apexAt(144))).toBeLessThan(0.01);
  });

  it("cannot double-jump, and a held key jumps once per landing", () => {
    const colliders = { ground: GROUND };
    // Release and press again in mid-air: nothing happens.
    const mid = simulate(standing(0, 0, colliders), 0.6, (s, t) => ({ jump: t < 0.05 || (t > 0.3 && t < 0.35) }), colliders);
    expect(mid.frames.filter((f) => f.jumped)).toHaveLength(1);
    // Held for 1 s: the second jump starts only after the first landing.
    const held = simulate(standing(0, 0, colliders), 1, () => ({ jump: true }), colliders);
    const jumps = held.frames.filter((f) => f.jumped);
    const firstLanding = held.frames.find((f) => f.landed);
    expect(jumps).toHaveLength(2);
    expect(jumps[1].t).toBeGreaterThanOrEqual(firstLanding.t);
  });
});

describe("steps, ledges and edges", () => {
  it("walks up steps of at most 0.6 m", () => {
    const low = simulate(standing(8, 0, ledge(0.5)), 2, () => ({ vx: WALK }), ledge(0.5)).state;
    expect(low.x).toBeGreaterThan(10.5);
    expect(low.y).toBe(0.5);
    const high = simulate(standing(8, 0, ledge(0.7)), 2, () => ({ vx: WALK }), ledge(0.7)).state;
    expect(high.x).toBeLessThanOrEqual(10 - 0.4 + 1e-6);
    expect(high.y).toBe(0);
    expect(high.grounded).toBe(true);
  });

  it("walks off a 1.5 m ledge, falls and lands", () => {
    const colliders = ledge(1.5);
    const { state, frames } = simulate(standing(11, 0, colliders), 2, () => ({ vx: -WALK }), colliders);
    expect(frames.some((f) => !f.state.grounded)).toBe(true);
    const landing = frames.find((f) => f.landed);
    expect(landing.fallSeconds).toBeCloseTo(Math.sqrt((2 * 1.5) / CHARACTER.gravity), 1);
    expect(state.grounded).toBe(true);
    expect(state.y).toBe(0);
    expect(state.x).toBeLessThan(10);
  });

  it("jumps onto a 1.2 m ledge but not onto a 1.6 m one", () => {
    const climb = (height) => simulate(standing(9.1, 0, ledge(height)), 1.5, (s, t) => ({ vx: RUN, jump: t < 0.05 }), ledge(height)).state;
    const onto = climb(1.2);
    expect(onto.grounded).toBe(true);
    expect(onto.y).toBe(1.2);
    expect(onto.x).toBeGreaterThan(10.5);
    const tooHigh = climb(1.6);
    expect(tooHigh.y).toBe(0);
    expect(tooHigh.x).toBeLessThanOrEqual(10 - 0.4 + 1e-6);
  });

  it("slides along a ledge that is too high while in the air", () => {
    const colliders = ledge(1.6);
    const { state, frames } = simulate(standing(9.4, 0, colliders), 0.7, (s, t) => ({ vx: RUN, vz: RUN, jump: t < 0.05 }), colliders);
    expect(frames.every((f) => f.state.x <= 10 - 0.4 + 1e-6)).toBe(true);
    expect(state.z).toBeGreaterThan(2);
  });

  it("allows a jump just after walking off an edge (coyote time), not later", () => {
    const colliders = ledge(1.5);
    const leaveAndJump = (delay) => {
      let leftAt = null;
      return simulate(standing(10.7, 0, colliders), 1, (s, t) => {
        if (leftAt === null && !s.grounded) leftAt = t;
        return { vx: -RUN, jump: leftAt !== null && t >= leftAt + delay };
      }, colliders).frames;
    };
    // Only jumps before touching the ground below count (a held key jumps again after landing).
    const airJump = (frames) => {
      const landing = frames.findIndex((f) => f.landed);
      return frames.slice(0, landing < 0 ? frames.length : landing).some((f) => f.jumped);
    };
    expect(airJump(leaveAndJump(0.05))).toBe(true);
    expect(airJump(leaveAndJump(0.2))).toBe(false);
  });
});

describe("obstacles with a top", () => {
  const hedge = { minX: 10, maxX: 12, minZ: -5, maxZ: 5, topY: 0.9 };
  const coping = { minX: -12, maxX: -10, minZ: -5, maxZ: 5, topY: 0.3 };
  const colliders = { ground: GROUND, boxes: [hedge, coping], circles: [{ x: 0, z: 20, r: 0.5 }] };

  it("is walked onto like a stair when the top is within the step height, and walked off", () => {
    const onto = simulate(standing(-8, 0, colliders), 4, () => ({ vx: -WALK }), colliders);
    expect(onto.frames.every((f) => f.state.grounded)).toBe(true);
    const onTop = onto.frames.find((f) => f.state.x < -10.5 && f.state.x > -11.5);
    expect(onTop.state.y).toBe(0.3);
    expect(onto.state.x).toBeLessThan(-12.4); // and down the other side
    expect(onto.state.y).toBe(0);
  });

  it("blocks a walker below a higher top, can be jumped onto, stood on and walked off", () => {
    const walked = simulate(standing(8, 0, colliders), 2, () => ({ vx: WALK }), colliders).state;
    expect(walked.x).toBeLessThanOrEqual(10 - 0.4 + 1e-6);

    const jumped = simulate(standing(9.3, 0, colliders), 0.9, (s, t) => ({ vx: s.grounded && s.y > 0.5 ? 0 : RUN, jump: t < 0.05 }), colliders).state;
    expect(jumped.grounded).toBe(true);
    expect(jumped.y).toBe(0.9);
    expect(jumped.x).toBeGreaterThanOrEqual(10);
    expect(jumped.x).toBeLessThanOrEqual(12);

    const off = simulate(jumped, 2, () => ({ vx: WALK }), colliders).state;
    expect(off.x).toBeGreaterThan(12.4);
    expect(off.y).toBe(0);
    expect(off.grounded).toBe(true);
  });

  it("keeps blocking at any height without a top", () => {
    const { frames } = simulate(standing(0, 18.6, colliders), 0.8, (s, t) => ({ vz: RUN, jump: t < 0.05 }), colliders);
    expect(frames.every((f) => f.state.z <= 20 - 0.9 + 1e-6)).toBe(true);
  });
});

describe("landing and robustness", () => {
  it("lands on a heightfield staircase and walks it without falling between steps", () => {
    // 0.15 m steps every 0.5 m along +Z.
    const cols = 20;
    const rows = 40;
    const bytes = new Uint8Array(cols * rows * 2);
    const view = new DataView(bytes.buffer);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) view.setUint16((r * cols + c) * 2, Math.round(((Math.min(r, 30) * 0.15) / 10) * 65534), true);
    const grid = decodeHeightfield(bytes, { originX: 0, originZ: 0, cellM: 0.5, cols, rows, minY: 0, maxY: 10, rowAxis: "z", colAxis: "x" });
    const colliders = { heightfields: [grid] };
    const start = { ...createCharacterState({ x: 5, z: 5 }), y: 4, grounded: false };
    const fall = simulate(start, 1, () => ({}), colliders);
    expect(fall.state.grounded).toBe(true);
    const down = simulate(fall.state, 3, () => ({ vz: -WALK }), colliders);
    expect(down.frames.every((f) => f.state.grounded)).toBe(true);
    expect(down.state.z).toBeLessThan(1);
    const up = simulate(down.state, 3, () => ({ vz: WALK }), colliders);
    expect(up.frames.every((f) => f.state.grounded)).toBe(true);
    expect(up.state.y).toBeGreaterThan(down.state.y + 0.5);
  });

  it("does not tunnel through a thin wall in the air at run speed", () => {
    const wall = { minX: 10, maxX: 10.02, minZ: -50, maxZ: 50 };
    const colliders = { ground: GROUND, boxes: [wall] };
    const { frames } = simulate(standing(8.5, 0, colliders), 1, (s, t) => ({ vx: RUN * 2, jump: t < 0.05 }), colliders, 1 / 20);
    expect(frames.every((f) => f.state.x < 10)).toBe(true);
  });

  it("puts a body that comes down with no floor at all on the nearest walkable spot", () => {
    const colliders = { ground: GROUND };
    const outside = { ...createCharacterState({ x: 0, z: 0 }), x: 70, y: 3, grounded: false };
    const { state } = simulate(outside, 1, () => ({}), colliders);
    expect(state.grounded).toBe(true);
    expect(state.x).toBeLessThanOrEqual(50);
  });
});
