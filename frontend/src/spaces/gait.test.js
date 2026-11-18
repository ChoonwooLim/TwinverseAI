import { describe, expect, it } from "vitest";
import { TAU, advancePhase, gaitPose, strideLength } from "./gait";

describe("gaitPose", () => {
  it("is a neutral stance when not moving", () => {
    const pose = gaitPose(1.3, { moving: 0 });
    for (const key of ["thighL", "thighR", "kneeL", "kneeR", "ankleL", "ankleR", "armL", "armR", "hipsYaw", "hipsRoll", "hipsDrop"]) {
      expect(Math.abs(pose[key])).toBeLessThan(1e-9);
    }
    // Relaxed elbows even while standing.
    expect(pose.elbowL).toBeGreaterThan(0);
  });

  it("swings the legs in opposite phase and the arms against the legs", () => {
    for (let phase = 0; phase < TAU; phase += 0.37) {
      const pose = gaitPose(phase, { moving: 1 });
      expect(pose.thighL).toBeCloseTo(-pose.thighR, 9);
      expect(Math.sign(pose.armL) * Math.sign(pose.thighL)).toBeLessThanOrEqual(0);
      expect(pose.armL).toBeCloseTo(-pose.armR, 9);
    }
  });

  it("never hyper-extends knees or elbows", () => {
    for (let phase = 0; phase < TAU; phase += 0.05) {
      for (const run of [0, 0.5, 1]) {
        const pose = gaitPose(phase, { moving: 1, run });
        expect(pose.kneeL).toBeGreaterThanOrEqual(0);
        expect(pose.kneeR).toBeGreaterThanOrEqual(0);
        expect(pose.elbowL).toBeGreaterThanOrEqual(0);
        expect(pose.elbowR).toBeGreaterThanOrEqual(0);
        expect(pose.hipsDrop).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("flexes the knee most in early swing and keeps it straight at heel strike", () => {
    const earlySwing = gaitPose(-0.45, { moving: 1 });
    const heelStrike = gaitPose(Math.PI / 2, { moving: 1 });
    expect(earlySwing.kneeL).toBeGreaterThan(0.8);
    expect(heelStrike.kneeL).toBeLessThan(0.15);
  });

  it("lifts the heel in late stance", () => {
    const lateStance = gaitPose(-Math.PI / 2 - 0.25, { moving: 1 });
    expect(lateStance.ankleL).toBeGreaterThan(0.3);
  });

  it("runs with bigger swings, a deeper knee bend and more lean than it walks", () => {
    const walk = gaitPose(Math.PI / 2, { moving: 1, run: 0 });
    const run = gaitPose(Math.PI / 2, { moving: 1, run: 1 });
    expect(run.thighL).toBeGreaterThan(walk.thighL);
    expect(run.spineLean).toBeGreaterThan(walk.spineLean);
    expect(gaitPose(-0.45, { moving: 1, run: 1 }).kneeL).toBeGreaterThan(gaitPose(-0.45, { moving: 1, run: 0 }).kneeL);
  });

  it("keeps the head level against hips and spine", () => {
    const pose = gaitPose(0.8, { moving: 1 });
    expect(pose.headYaw + pose.hipsYaw + pose.spineYaw).toBeCloseTo(0, 9);
    expect(pose.headRoll + pose.hipsRoll).toBeCloseTo(0, 9);
  });

  it("breathes only when idle and only when a breath phase is given", () => {
    expect(gaitPose(0, { moving: 0, breath: Math.PI / 2 }).breathing).toBeCloseTo(1, 9);
    expect(gaitPose(0, { moving: 0, breath: null }).breathing).toBe(0);
    expect(gaitPose(0, { moving: 1, breath: Math.PI / 2 }).breathing).toBe(0);
  });
});

describe("stride and phase", () => {
  it("has a longer stride (and so a cadence that grows slower than speed) when running", () => {
    const walk = strideLength(0.9, 0);
    const run = strideLength(0.9, 1);
    expect(walk).toBeGreaterThan(1.2);
    expect(walk).toBeLessThan(2.5);
    expect(run).toBeGreaterThan(walk * 1.8);
  });

  it("advances one full cycle per stride and wraps", () => {
    const stride = strideLength(0.9, 0);
    expect(advancePhase(0, stride, 0.9, 0)).toBeCloseTo(0, 9);
    expect(advancePhase(0, stride / 4, 0.9, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(advancePhase(TAU - 0.1, 0, 0.9, 0)).toBeCloseTo(TAU - 0.1, 9);
  });
});
