// Rest-relative animation retargeting between humanoid skeletons that share joint names but
// differ in rest pose (T vs A), bone-local axis conventions and proportions.
//
// Method
//  1. Matched reference pose: walk the target skeleton from the root, and rotate each bone by
//     the smallest rotation that points it (bone -> primary child joint) in the same world
//     direction as the corresponding source bone in the source's rest pose. Bones with several
//     children also match a secondary direction (hips: leg to leg, chest: shoulder to shoulder,
//     hands: index to pinky, head: eye to eye), which fixes their twist.
//  2. Per frame: the source bone's world rotation relative to its rest, D = S(t) * S(rest)^-1,
//     is applied to the target's reference: T(t) = D * T(ref); locals follow from the parents.
//     Bone directions then match the source exactly, while each bone keeps its own twist
//     convention, so skinning is not wrung by axis differences.
//  3. The hips translation is the source's offset from its rest, scaled by the hip-height ratio.
//
// Relative imports carry explicit extensions so the build tool can run this in plain Node.
import { AnimationMixer, Quaternion, Vector3 } from "three";
import { normalizeBoneName } from "../avatarConfig.js";

/** Limb bones checked by the validation, as [bone, child joint] pairs per group. */
export const LIMB_GROUPS = {
  upperLeg: [["LeftUpLeg", "LeftLeg"], ["RightUpLeg", "RightLeg"]],
  lowerLeg: [["LeftLeg", "LeftFoot"], ["RightLeg", "RightFoot"]],
  foot: [["LeftFoot", "LeftToeBase"], ["RightFoot", "RightToeBase"]],
  spine: [["Spine", "Spine1"], ["Spine1", "Spine2"], ["Spine2", "Neck"]],
  neck: [["Neck", "Head"]],
  upperArm: [["LeftArm", "LeftForeArm"], ["RightArm", "RightForeArm"]],
  forearm: [["LeftForeArm", "LeftHand"], ["RightForeArm", "RightHand"]],
  hand: [["LeftHand", "LeftHandMiddle1"], ["RightHand", "RightHandMiddle1"]],
};

const PRIMARY_CHILD = {
  Hips: "Spine",
  Spine2: "Neck",
  Head: "HeadTop_End",
  LeftHand: "LeftHandMiddle1",
  RightHand: "RightHandMiddle1",
  LeftFoot: "LeftToeBase",
  RightFoot: "RightToeBase",
};

const SECONDARY = {
  Hips: ["LeftUpLeg", "RightUpLeg"],
  Spine2: ["LeftShoulder", "RightShoulder"],
  LeftHand: ["LeftHandIndex1", "LeftHandPinky1"],
  RightHand: ["RightHandIndex1", "RightHandPinky1"],
  Head: ["LeftEye", "RightEye"],
};

const _a = new Vector3();
const _b = new Vector3();
const _q = new Quaternion();

/**
 * Maps target bone names to source bones: exact name, then "mixamorig" + name, then the
 * normalised name (case, separators and rig prefixes ignored).
 */
export function createNameMap(targetNames, sourceNames) {
  const exact = new Set(sourceNames);
  const normalized = new Map(sourceNames.map((name) => [normalizeBoneName(name), name]));
  const map = new Map();
  for (const name of targetNames) {
    const match = exact.has(name)
      ? name
      : exact.has(`mixamorig${name}`)
        ? `mixamorig${name}`
        : normalized.get(normalizeBoneName(name)) ?? null;
    if (match) map.set(name, match);
  }
  return map;
}

/** Bones of a skeleton in parent-before-child order. */
export function hierarchyOrder(bones) {
  const ordered = [];
  const visit = (bone) => {
    ordered.push(bone);
    for (const child of bone.children) if (child.isBone) visit(child);
  };
  for (const bone of bones.values()) if (!bone.parent?.isBone) visit(bone);
  return ordered;
}

function worldQuaternion(object, target = new Quaternion()) {
  object.updateWorldMatrix(true, false);
  return object.getWorldQuaternion(target);
}

function worldPosition(object, target = new Vector3()) {
  object.updateWorldMatrix(true, false);
  return object.getWorldPosition(target);
}

/** Heading (radians about +Y, 0 = facing +Z) from the hips' left-to-right leg axis at rest. */
function facingAngle(skeleton, nameFor) {
  const left = skeleton.bones.get(nameFor("LeftUpLeg"));
  const right = skeleton.bones.get(nameFor("RightUpLeg"));
  if (!left || !right) return 0;
  const lateral = worldPosition(left).sub(worldPosition(right)); // towards the character's left
  const forward = new Vector3(0, 1, 0).cross(lateral).negate(); // left x up = forward
  return Math.atan2(forward.x, forward.z);
}

function primaryChildName(bone) {
  if (PRIMARY_CHILD[bone.name]) return PRIMARY_CHILD[bone.name];
  const children = bone.children.filter((child) => child.isBone);
  return children.length === 1 ? children[0].name : null;
}

function signedAngleAbout(axis, from, to) {
  const f = from.clone().addScaledVector(axis, -from.dot(axis));
  const t = to.clone().addScaledVector(axis, -to.dot(axis));
  if (f.lengthSq() < 1e-12 || t.lengthSq() < 1e-12) return 0;
  f.normalize();
  t.normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, f.dot(t))));
  return _a.crossVectors(f, t).dot(axis) < 0 ? -angle : angle;
}

/**
 * Prepares a retargeting session. Both skeletons must be in their rest pose when called.
 * @param {{ target: { root: any, bones: Map<string, any> }, source: { root: any, bones: Map<string, any> },
 *   nameMap: Map<string, string>, hipsName?: string }} options
 */
export function createRetargeter({ target, source, nameMap, hipsName = "Hips" }) {
  target.root.updateMatrixWorld(true);
  source.root.updateMatrixWorld(true);
  // Face the source the same way as the target (e.g. a rig facing -Z onto one facing +Z), so a
  // forward step stays a forward step.
  const facingYaw = facingAngle(target, (name) => name) - facingAngle(source, (name) => nameMap.get(name));
  if (Math.abs(facingYaw) > 1e-4) {
    source.root.rotateY(facingYaw);
    source.root.updateMatrixWorld(true);
  }
  const order = hierarchyOrder(target.bones);
  const sourceRest = new Map();
  const sourceRestPosition = new Map();
  for (const [name, bone] of source.bones) {
    sourceRest.set(name, worldQuaternion(bone));
    sourceRestPosition.set(name, worldPosition(bone));
  }
  const targetRestLocal = new Map(order.map((bone) => [bone.name, bone.quaternion.clone()]));
  const targetRestPosition = new Map(order.map((bone) => [bone.name, bone.position.clone()]));
  const rootWorld = (bone) => worldQuaternion(bone.parent ?? bone);

  // 1. Matched reference pose.
  const reference = new Map();
  for (const bone of order) {
    const parentWorld = bone.parent?.isBone ? reference.get(bone.parent.name) : rootWorld(bone);
    const world = parentWorld.clone().multiply(targetRestLocal.get(bone.name));
    const sourceName = nameMap.get(bone.name);
    const childName = primaryChildName(bone);
    const targetChild = childName ? target.bones.get(childName) : null;
    const sourceChild = childName && nameMap.get(childName) ? source.bones.get(nameMap.get(childName)) : null;
    if (sourceName && targetChild && sourceChild) {
      const targetDirection = targetChild.position.clone().applyQuaternion(world).normalize();
      const sourceDirection = sourceRestPosition.get(sourceChild.name).clone().sub(sourceRestPosition.get(sourceName)).normalize();
      if (targetDirection.lengthSq() > 0 && sourceDirection.lengthSq() > 0) {
        world.premultiply(_q.setFromUnitVectors(targetDirection, sourceDirection));
        const pair = SECONDARY[bone.name];
        const ta = pair && target.bones.get(pair[0]);
        const tb = pair && target.bones.get(pair[1]);
        const sa = pair && nameMap.get(pair[0]) && source.bones.get(nameMap.get(pair[0]));
        const sb = pair && nameMap.get(pair[1]) && source.bones.get(nameMap.get(pair[1]));
        if (ta && tb && sa && sb && ta.parent === bone && tb.parent === bone) {
          const targetSecondary = ta.position.clone().sub(tb.position).applyQuaternion(world);
          const sourceSecondary = sourceRestPosition.get(sa.name).clone().sub(sourceRestPosition.get(sb.name));
          const angle = signedAngleAbout(sourceDirection, targetSecondary, sourceSecondary);
          world.premultiply(_q.setFromAxisAngle(sourceDirection, angle));
        }
      }
    }
    reference.set(bone.name, world);
  }

  const hipsBone = target.bones.get(hipsName);
  const sourceHipsName = nameMap.get(hipsName);
  const sourceHipsRest = sourceHipsName ? sourceRestPosition.get(sourceHipsName) : null;
  const targetHipsRestWorld = hipsBone ? worldPosition(hipsBone) : null;
  const hipScale = sourceHipsRest && targetHipsRestWorld && sourceHipsRest.y > 1e-6 ? targetHipsRestWorld.y / sourceHipsRest.y : 1;

  /**
   * Retargets the source's current pose (pose the source first, e.g. with an AnimationMixer).
   * @returns {{ rotations: Map<string, Quaternion>, hipsPosition: Vector3 | null }}
   */
  function retargetCurrentPose() {
    source.root.updateMatrixWorld(true);
    const worlds = new Map();
    const rotations = new Map();
    for (const bone of order) {
      const parentWorld = bone.parent?.isBone ? worlds.get(bone.parent.name) : rootWorld(bone);
      const sourceName = nameMap.get(bone.name);
      let world;
      if (sourceName) {
        const delta = worldQuaternion(source.bones.get(sourceName)).multiply(_q.copy(sourceRest.get(sourceName)).invert());
        world = delta.multiply(reference.get(bone.name));
      } else {
        world = parentWorld.clone().multiply(targetRestLocal.get(bone.name));
      }
      worlds.set(bone.name, world);
      rotations.set(bone.name, parentWorld.clone().invert().multiply(world).normalize());
    }
    let hipsPosition = null;
    if (hipsBone && sourceHipsName) {
      const offset = worldPosition(source.bones.get(sourceHipsName)).sub(sourceHipsRest).multiplyScalar(hipScale);
      // Convert the world offset into the frame of the hips' parent (rotation and uniform scale).
      const parent = hipsBone.parent ?? hipsBone;
      const parentInverse = _q.copy(rootWorld(hipsBone)).invert();
      const parentScale = parent.getWorldScale(new Vector3()).x || 1;
      hipsPosition = targetRestPosition.get(hipsName).clone().add(offset.applyQuaternion(parentInverse).divideScalar(parentScale));
    }
    return { rotations, hipsPosition };
  }

  return { order, reference, hipScale, facingYaw, retargetCurrentPose, targetRestLocal, targetRestPosition };
}

/**
 * Samples a source clip at a fixed rate and retargets every frame.
 * @returns {{ fps: number, times: number[], frames: { rotations: Map<string, Quaternion>, hipsPosition: Vector3 | null }[] }}
 */
export function retargetClipFrames({ retargeter, source, clip, fps }) {
  const mixer = new AnimationMixer(source.root);
  const action = mixer.clipAction(clip);
  action.play();
  const frameCount = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = [];
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    const time = Math.min(clip.duration, i / fps);
    mixer.setTime(time);
    times.push(time);
    frames.push(retargeter.retargetCurrentPose());
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(source.root);
  return { fps, times, frames };
}

/** Applies one retargeted frame to the target skeleton. */
export function applyFrame(target, frame, hipsName = "Hips") {
  for (const [name, rotation] of frame.rotations) target.bones.get(name)?.quaternion.copy(rotation);
  if (frame.hipsPosition) target.bones.get(hipsName)?.position.copy(frame.hipsPosition);
  target.root.updateMatrixWorld(true);
}

/** Restores the target skeleton's rest pose. */
export function applyRest(target, retargeter) {
  for (const [name, rotation] of retargeter.targetRestLocal) target.bones.get(name).quaternion.copy(rotation);
  for (const [name, position] of retargeter.targetRestPosition) target.bones.get(name).position.copy(position);
  target.root.updateMatrixWorld(true);
}

/** World direction bone -> child joint, for every LIMB_GROUPS pair present on the skeleton. */
export function limbDirections(skeleton, nameFor = (name) => name) {
  const directions = {};
  for (const pairs of Object.values(LIMB_GROUPS)) {
    for (const [from, to] of pairs) {
      const a = skeleton.bones.get(nameFor(from));
      const b = skeleton.bones.get(nameFor(to));
      if (!a || !b) continue;
      directions[from] = worldPosition(b, _b).clone().sub(worldPosition(a, _a)).normalize().toArray();
    }
  }
  return directions;
}

/** Angle in degrees between two unit vectors given as arrays. */
export function angleBetween(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

/** Max and mean angular error per limb group between two sets of direction samples. */
export function compareDirections(expectedFrames, actualFrames) {
  const result = {};
  for (const [group, pairs] of Object.entries(LIMB_GROUPS)) {
    let max = 0;
    let sum = 0;
    let count = 0;
    for (let f = 0; f < expectedFrames.length; f++) {
      for (const [bone] of pairs) {
        const expected = expectedFrames[f][bone];
        const actual = actualFrames[f][bone];
        if (!expected || !actual) continue;
        const error = angleBetween(expected, actual);
        max = Math.max(max, error);
        sum += error;
        count++;
      }
    }
    if (count) result[group] = { max, mean: sum / count, samples: count };
  }
  return result;
}
