// Proves the retargeting method on synthetic skeletons that differ from each other the way Xbot
// and the avatar do: T-pose vs A-pose, identity bone axes vs "+Y along the bone" axes with random
// twists, centimetres under a 0.01 root vs metres, and opposite facing.
import { describe, expect, it } from "vitest";
import { AnimationClip, Bone, Group, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from "three";
import { applyFrame, compareDirections, createNameMap, createRetargeter, limbDirections, retargetClipFrames } from "./retarget";

const SIDE = { Left: 1, Right: -1 };

/** Joint layout: name -> [parent, world position in metres]. */
function jointLayout(aPose) {
  const joints = {
    Hips: [null, [0, 1.0, 0]],
    Spine: ["Hips", [0, 1.1, 0]],
    Spine1: ["Spine", [0, 1.2, 0]],
    Spine2: ["Spine1", [0, 1.3, 0]],
    Neck: ["Spine2", [0, 1.45, 0]],
    Head: ["Neck", [0, 1.55, 0.02]],
    HeadTop_End: ["Head", [0, 1.72, 0.02]],
  };
  const down = (59 * Math.PI) / 180;
  for (const [side, s] of Object.entries(SIDE)) {
    const shoulder = [0.05 * s, 1.4, 0];
    const armStart = [0.15 * s, 1.4, 0];
    // T-pose: arm along +-X; A-pose: 59 degrees below horizontal.
    const along = aPose ? [Math.cos(down) * s, -Math.sin(down), 0] : [s, 0, 0];
    const at = (d) => armStart.map((v, i) => v + along[i] * d);
    joints[`${side}Shoulder`] = ["Spine2", shoulder];
    joints[`${side}Arm`] = [`${side}Shoulder`, armStart];
    joints[`${side}ForeArm`] = [`${side}Arm`, at(0.28)];
    joints[`${side}Hand`] = [`${side}ForeArm`, at(0.55)];
    joints[`${side}HandMiddle1`] = [`${side}Hand`, at(0.64)];
    joints[`${side}HandIndex1`] = [`${side}Hand`, at(0.63).map((v, i) => v + (i === 2 ? 0.02 : 0))];
    joints[`${side}HandPinky1`] = [`${side}Hand`, at(0.62).map((v, i) => v + (i === 2 ? -0.02 : 0))];
    joints[`${side}UpLeg`] = ["Hips", [0.09 * s, 0.94, 0]];
    joints[`${side}Leg`] = [`${side}UpLeg`, [0.09 * s, 0.5, 0.005]];
    joints[`${side}Foot`] = [`${side}Leg`, [0.09 * s, 0.08, -0.02]];
    joints[`${side}ToeBase`] = [`${side}Foot`, [0.09 * s, 0.01, 0.1]];
  }
  return joints;
}

function primaryChild(joints, name) {
  const preferred = { Hips: "Spine", Spine2: "Neck", LeftHand: "LeftHandMiddle1", RightHand: "RightHandMiddle1" };
  if (preferred[name]) return preferred[name];
  const children = Object.keys(joints).filter((child) => joints[child][0] === name);
  return children.length === 1 ? children[0] : null;
}

/**
 * Builds a skeleton from world joint positions. `axes`: "identity" (every bone's world rotation is
 * identity, like Xbot) or "along" (+Y points at the primary child, twisted by a pseudo-random
 * angle, like the avatar). `prefix` and `unit` mimic Mixamo naming and centimetres.
 */
function buildSkeleton({ aPose, axes, prefix = "", unit = 1, facing = 0 }) {
  const joints = jointLayout(aPose);
  const root = new Group();
  const holder = new Object3D();
  holder.scale.setScalar(1 / unit);
  holder.rotation.y = facing;
  root.add(holder);
  const world = {};
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const name of Object.keys(joints)) {
    const child = primaryChild(joints, name);
    if (axes === "identity" || !child) {
      world[name] = axes === "identity" || !joints[name][0] ? new Quaternion() : world[joints[name][0]].clone();
      continue;
    }
    const direction = new Vector3(...joints[child][1]).sub(new Vector3(...joints[name][1])).normalize();
    const align = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction);
    const twist = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (random() - 0.5) * 2.5);
    world[name] = align.multiply(twist);
  }
  const bones = new Map();
  for (const [name, [parent, position]] of Object.entries(joints)) {
    const bone = new Bone();
    bone.name = prefix + name;
    const parentWorld = parent ? world[parent] : new Quaternion();
    const parentPosition = parent ? new Vector3(...joints[parent][1]) : new Vector3();
    bone.quaternion.copy(parentWorld.clone().invert().multiply(world[name]));
    bone.position.copy(new Vector3(...position).sub(parentPosition).applyQuaternion(parentWorld.clone().invert()).multiplyScalar(unit));
    (parent ? bones.get(prefix + parent) : holder).add(bone);
    bones.set(bone.name, bone);
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

/** A two-second source clip: arms down and forward, elbows and knees bent, hips drifting forward. */
function sourceClip(prefix, unit) {
  const tracks = [];
  const key = (name, rotations) => {
    const values = rotations.flatMap(([x, y, z, angle]) => new Quaternion().setFromAxisAngle(new Vector3(x, y, z).normalize(), angle).toArray());
    tracks.push(new QuaternionKeyframeTrack(`${prefix}${name}.quaternion`, [0, 1, 2], values));
  };
  key("LeftArm", [[0, 0, 1, 0], [0, 0.4, -1, 1.1], [0, 0, 1, 0]]);
  key("RightArm", [[0, 0, 1, 0], [0.3, 0, 1, 1.0], [0, 0, 1, 0]]);
  key("LeftForeArm", [[0, 1, 0, 0], [0, 1, 0, 1.2], [0, 1, 0, 0]]);
  key("LeftHand", [[1, 0, 0, 0], [1, 0.2, 0, 0.5], [1, 0, 0, 0]]);
  key("LeftUpLeg", [[1, 0, 0, 0], [1, 0, 0.1, -0.6], [1, 0, 0, 0]]);
  key("LeftLeg", [[1, 0, 0, 0], [1, 0, 0, 0.9], [1, 0, 0, 0]]);
  key("RightFoot", [[1, 0, 0, 0], [1, 0, 0, 0.4], [1, 0, 0, 0]]);
  key("Spine1", [[0, 1, 0, 0], [0.2, 1, 0, 0.3], [0, 1, 0, 0]]);
  key("Hips", [[0, 1, 0, 0], [0, 1, 0.1, 0.25], [0, 1, 0, 0]]);
  tracks.push(new VectorKeyframeTrack(`${prefix}Hips.position`, [0, 1, 2], [0, 1 * unit, 0, 0, 0.95 * unit, 0.3 * unit, 0, 1 * unit, 0.6 * unit]));
  return new AnimationClip("test", 2, tracks);
}

function runRetarget(sourceOptions) {
  const source = buildSkeleton(sourceOptions);
  const target = buildSkeleton({ aPose: true, axes: "along" });
  const nameMap = createNameMap([...target.bones.keys()], [...source.bones.keys()]);
  const retargeter = createRetargeter({ target, source, nameMap });
  const { frames, times } = retargetClipFrames({ retargeter, source, clip: sourceClip(sourceOptions.prefix ?? "", sourceOptions.unit ?? 1), fps: 10 });
  return { source, target, nameMap, retargeter, frames, times };
}

describe("rest-relative retargeting", () => {
  it("maps Mixamo-prefixed names one to one", () => {
    const map = createNameMap(["Hips", "LeftForeArm", "Extra"], ["mixamorigHips", "mixamorigLeftForeArm"]);
    expect(map.get("Hips")).toBe("mixamorigHips");
    expect(map.get("LeftForeArm")).toBe("mixamorigLeftForeArm");
    expect(map.has("Extra")).toBe(false);
  });

  it("reproduces every limb direction of a T-pose source on an A-pose target with other bone axes", () => {
    const { source, target, nameMap, frames, times } = runRetarget({ aPose: false, axes: "identity", prefix: "mixamorig", unit: 100 });
    const expected = [];
    const actual = [];
    // Pose the source at the same times through its own clip.
    const clip = sourceClip("mixamorig", 100);
    const tracks = Object.fromEntries(clip.tracks.map((track) => [track.name, track]));
    times.forEach((time, index) => {
      for (const [name, track] of Object.entries(tracks)) {
        const interpolant = track.createInterpolant();
        const value = interpolant.evaluate(time);
        const [boneName, property] = name.split(".");
        const bone = source.bones.get(boneName);
        if (property === "quaternion") bone.quaternion.fromArray(value);
        else bone.position.fromArray(value);
      }
      source.root.updateMatrixWorld(true);
      expected.push(limbDirections(source, (n) => nameMap.get(n)));
      applyFrame(target, frames[index]);
      actual.push(limbDirections(target));
    });
    const errors = compareDirections(expected, actual);
    for (const group of ["upperLeg", "lowerLeg", "foot", "spine", "neck", "upperArm", "forearm", "hand"]) {
      expect(errors[group].max).toBeLessThan(0.01);
    }
    // The bent poses really are different from rest (the test is not trivially satisfied).
    expect(actual[10].LeftArm[1]).toBeLessThan(-0.5);
  });

  it("scales the hips motion by the hip-height ratio and turns a source facing the other way", () => {
    const { frames, retargeter } = runRetarget({ aPose: false, axes: "identity", prefix: "mixamorig", unit: 100, facing: Math.PI });
    expect(Math.abs(retargeter.facingYaw)).toBeCloseTo(Math.PI, 3);
    const mid = frames[10].hipsPosition;
    // Source hips moved 0.3 m forward (its own +Z, which faces away) and 5 cm down at t = 1.
    expect(mid.y).toBeCloseTo(1.0 - 0.05 * retargeter.hipScale, 4);
    expect(Math.abs(mid.z)).toBeCloseTo(0.3 * retargeter.hipScale, 4);
    expect(retargeter.hipScale).toBeCloseTo(1, 6);
  });
});
