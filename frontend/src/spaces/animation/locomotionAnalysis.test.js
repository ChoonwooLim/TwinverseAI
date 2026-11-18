import { describe, expect, it } from "vitest";
import { groundSpeed, loopGap, makeQuaternionsContinuous, phaseOfMaximum, removeDrift, symmetryError } from "./locomotionAnalysis";

describe("loop handling", () => {
  it("tells closed loops from open ones", () => {
    const turn = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
    const closed = { Bone: [0, 0.5, 1, 0.5, 0].map(turn) };
    const open = { Bone: [0, 0.5, 1, 1.5].map(turn) };
    expect(loopGap(closed).closed).toBe(true);
    expect(loopGap(open).closed).toBe(false);
  });

  it("keeps quaternion keys on the short path", () => {
    const keys = makeQuaternionsContinuous([[0, 0, 0, 1], [0, 0, 0, -1]]);
    expect(keys[1]).toEqual([-0, -0, -0, 1]);
  });

  it("removes steady forward drift but keeps bob and sway (closed loop)", () => {
    // 11 samples of a closed 10-frame cycle moving 1.5 m forward per cycle.
    const sample = (i) => [0.02 * Math.sin((i / 10) * 2 * Math.PI), 1 + 0.03 * Math.cos((i / 10) * 4 * Math.PI), (1.5 * i) / 10];
    const positions = Array.from({ length: 11 }, (_, i) => sample(i));
    const { driftZ, driftX } = removeDrift(positions, true);
    expect(driftZ).toBeCloseTo(1.5, 6);
    expect(driftX).toBeCloseTo(0, 6);
    for (const p of positions) expect(p[2]).toBeCloseTo(0, 6);
    expect(positions[5][1]).toBeCloseTo(sample(5)[1], 9);
    expect(positions[2][0]).toBeCloseTo(sample(2)[0], 9);
  });

  it("estimates the drift of an open loop from its neighbouring steps", () => {
    const positions = Array.from({ length: 10 }, (_, i) => [0.02 * Math.sin((i / 10) * 2 * Math.PI), 1, (1.5 * i) / 10]);
    const { driftZ, driftX } = removeDrift(positions, false);
    expect(driftZ).toBeCloseTo(1.5, 6);
    expect(Math.abs(driftX)).toBeLessThan(0.003); // sway is not mistaken for drift
  });
});

describe("gait measurements", () => {
  // One second cycle, 30 samples. Each foot is planted for half the cycle and slides backwards
  // relative to the hips at 1.6 m/s while planted.
  const n = 30;
  const times = Array.from({ length: n }, (_, i) => i / n);
  function foot(offset) {
    const contact = [];
    const relZ = [];
    for (let i = 0; i < n; i++) {
      const u = ((i / n + offset) % 1 + 1) % 1;
      if (u < 0.5) {
        contact.push(0);
        relZ.push(0.4 - 1.6 * u);
      } else {
        contact.push(0.08 * Math.sin((u - 0.5) * 2 * Math.PI));
        relZ.push(-0.4 + 1.6 * (u - 0.5));
      }
    }
    return { contact, relZ };
  }

  it("measures the speed of the planted foot, across the loop seam too", () => {
    const { speed, runs } = groundSpeed({ times, cycleDuration: 1, feet: [foot(0.1), foot(0.6)] });
    expect(speed).toBeCloseTo(1.6, 3);
    expect(runs).toBe(2);
  });

  it("finds the phase where the left foot is furthest forward", () => {
    const left = foot(0.1);
    expect(phaseOfMaximum(times, left.relZ, 1)).toBeCloseTo(0.9, 6);
  });

  it("reports zero asymmetry for mirrored halves and a value for skewed ones", () => {
    const left = times.map((t) => 30 * Math.sin(2 * Math.PI * t));
    const right = times.map((t) => -30 * Math.sin(2 * Math.PI * t));
    expect(symmetryError(left, right)).toBeLessThan(1e-9);
    const skewed = right.map((v, i) => v + (i < n / 2 ? 5 : 0));
    expect(symmetryError(left, skewed)).toBeCloseTo(5, 6);
  });
});
