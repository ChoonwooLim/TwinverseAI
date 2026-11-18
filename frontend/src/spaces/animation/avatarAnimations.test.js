// Checks the shipped avatar-animations.json on the real avatar skeleton: the clips replayed through
// three.js AnimationMixer must point every limb bone where the source motion capture points it,
// keep the feet on the ground, loop seamlessly and carry plausible natural speeds.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Vector3 } from "three";
import { buildSkeleton, parseGLB } from "./glbSkeleton";
import { compareDirections, limbDirections } from "./retarget";
import { buildAnimationClips } from "./animationAsset";

const asset = (name) => fileURLToPath(new URL(`../national-assembly/assets/${name}`, import.meta.url));
const animations = JSON.parse(readFileSync(asset("avatar-animations.json"), "utf8"));
const bytes = readFileSync(asset("avatar.glb"));
const avatar = buildSkeleton(parseGLB(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
const boneNames = avatar.joints.map((bone) => bone.name);
const restY = Object.fromEntries(["LeftFoot", "LeftToeBase", "RightFoot", "RightToeBase"].map((n) => [n, avatar.bones.get(n).getWorldPosition(new Vector3()).y]));
const THRESHOLD_DEG = 3;

describe("avatar-animations.json", () => {
  const built = buildAnimationClips(animations, boneNames);

  it("passes the runtime validation and covers every avatar bone in every clip", () => {
    expect(built.ok).toBe(true);
    for (const name of ["Idle", "Walk", "Run"]) {
      expect(Object.keys(animations.clips[name].rotations).sort()).toEqual([...boneNames].sort());
      expect(built.meta[name].bones).toBe(boneNames.length);
    }
    expect(JSON.stringify(animations)).not.toMatch(/NaN|Infinity/);
  });

  it("carries natural ground speeds for walking and running", () => {
    expect(built.meta.Walk.speedMps).toBeGreaterThan(1.2);
    expect(built.meta.Walk.speedMps).toBeLessThan(2);
    expect(built.meta.Run.speedMps).toBeGreaterThan(3);
    expect(built.meta.Run.speedMps).toBeLessThan(6.5);
    expect(built.meta.Idle.speedMps).toBe(0);
    for (const name of ["Walk", "Run"]) {
      expect(built.meta[name].syncPhase).toBeGreaterThanOrEqual(0);
      expect(built.meta[name].syncPhase).toBeLessThan(1);
    }
  });

  for (const name of ["Idle", "Walk", "Run"]) {
    it(`${name}: limb directions match the source within ${THRESHOLD_DEG} degrees`, () => {
      const samples = animations.validation.samples[name];
      const mixer = new AnimationMixer(avatar.root);
      mixer.clipAction(built.clips[name]).play();
      const actual = samples.times.map((time) => {
        mixer.setTime(time);
        avatar.root.updateMatrixWorld(true);
        return limbDirections(avatar);
      });
      mixer.stopAllAction();
      mixer.uncacheRoot(avatar.root);
      const errors = compareDirections(samples.directions, actual);
      for (const group of ["upperLeg", "lowerLeg", "foot", "spine", "neck", "upperArm", "forearm", "hand"]) {
        expect(errors[group], group).toBeTruthy();
        expect(errors[group].max, group).toBeLessThan(THRESHOLD_DEG);
      }
    });

    it(`${name}: feet reach the ground without sinking, and the loop is seamless`, () => {
      const clip = built.clips[name];
      const mixer = new AnimationMixer(avatar.root);
      mixer.clipAction(clip).play();
      let lowest = Infinity;
      const steps = 48;
      for (let i = 0; i < steps; i++) {
        mixer.setTime((i / steps) * clip.duration);
        avatar.root.updateMatrixWorld(true);
        for (const side of ["Left", "Right"]) {
          const ankle = avatar.bones.get(`${side}Foot`).getWorldPosition(new Vector3()).y - restY[`${side}Foot`];
          const toe = avatar.bones.get(`${side}ToeBase`).getWorldPosition(new Vector3()).y - restY[`${side}ToeBase`];
          lowest = Math.min(lowest, ankle, toe);
        }
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(avatar.root);
      expect(Math.abs(lowest)).toBeLessThan(0.02);

      const data = animations.clips[name];
      for (const values of Object.values(data.rotations)) {
        if (values.length === 4) continue;
        const first = values.slice(0, 4);
        const last = values.slice(-4);
        const norm = Math.hypot(...first) * Math.hypot(...last);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(first.reduce((s, v, i) => s + v * last[i], 0)) / norm));
        expect(angle * (180 / Math.PI)).toBeLessThan(0.5);
      }
      const positions = data.hipsPosition;
      for (let i = 0; i < 3; i++) expect(positions[i]).toBeCloseTo(positions[positions.length - 3 + i], 3);
    });
  }
});
