// Skinned humanoid avatar: loads the character, applies the sidecar's yaw correction on a wrapper,
// and drives locomotion either from clips in the GLB (Idle / Walk / Run, via AnimationMixer) or
// from a procedural rig that composes joint rotations on top of each bone's rest pose. A
// procedural flight pose (hover and forward flight) is layered on top of either while flying.
import { AnimationMixer, Box3, Group, LoopRepeat, Matrix3, Matrix4, Quaternion, Vector3 } from "three/webgpu";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  REQUIRED_BONES,
  readArmRestAngle,
  readHingeAxis,
  readLowerArmAxis,
  resolveAvatarBones,
} from "../avatarConfig";
import { advancePhase, gaitPose } from "../gait";
import { eyeHeight } from "../firstPerson";
import { buildAnimationClips } from "../animation/animationAsset";
import { devInfo } from "./devLog";

/**
 * Every motion sign in one place. 1 means "the sidecar's axis (or the geometric fallback) already
 * produces the named motion for a positive angle"; set an entry to -1 to flip that motion.
 *   hipFlex    thigh swings forward          (UpLeg hinge)
 *   kneeFlex   shin folds back                (Leg hinge)
 *   toeDown    heel lifts / toes point down   (Foot hinge)
 *   armLower   upper arm comes down to the side out of the A/T rest pose (Arm lower axis)
 *   armSwing   arm swings forward             (Arm hinge)
 *   elbowFlex  forearm bends to the front     (ForeArm hinge)
 *   hipsYaw / hipsRoll / spineLean / spineYaw / head*  whole-body motions about character axes
 */
export const RIG_SIGNS = {
  hipFlex: 1,
  kneeFlex: 1,
  toeDown: 1,
  armLower: 1,
  armSwing: 1,
  elbowFlex: 1,
  hipsYaw: 1,
  hipsRoll: 1,
  spineYaw: 1,
  spineLean: 1,
  headYaw: 1,
  headRoll: 1,
  headPitch: 1,
  bodyPitch: 1,
  bodyBank: 1,
};

/**
 * Flight pose (degrees, seconds, metres). Each angle drives one of the motions named in RIG_SIGNS
 * about the bone axes from avatar.json (or the rest-pose geometry), so no sign is hard-coded here.
 * Hover and forward flight are blended by horizontal speed; the whole pose is cross-faded over
 * the motion-capture (or procedural) locomotion on take-off and landing.
 */
export const FLIGHT_POSE = {
  /** Take-off / landing cross-fade (about 95 % of the change in this time). */
  blendSeconds: 0.4,
  reducedBlendSeconds: 0.12,
  /**
   * Arms lead, the body follows. The arm reach is driven by intent (a horizontal move key held
   * while flying): out in about armExtendSeconds, back in about armRetractSeconds (95 %, ease-out,
   * no overshoot). A key must be held armIntentDelay before the arms commit, so a quick tap only
   * makes a small partial motion. armSpeedShare of the achieved speed keeps a hard stop connected.
   */
  armExtendSeconds: 0.18,
  armRetractSeconds: 0.22,
  armIntentDelay: 0.09,
  armSpeedShare: 0.05,
  /** Body pitch, leg trail and head counter-pitch follow the achieved speed with this time. */
  bodyPitchSeconds: 0.35,

  // Hover: upright with a slight forward lean, legs relaxed, arms a little away from the body.
  hoverLean: 8,
  hoverHipFlex: 12,
  hoverHipFlexOffset: 6, // left and right legs differ a little
  hoverKnee: 24,
  hoverKneeOffset: 8,
  hoverToe: 28,
  hoverArmOut: 16, // further out from the body than the relaxed standing arm
  hoverArmSwing: 6,
  hoverElbow: 18,
  bobMetres: 0.05,
  bobSeconds: 3.4,

  // Forward flight: body pitched forward round the hips' sideways axis, legs straight and
  // together trailing behind, both arms reaching ahead along the flight line (close to parallel,
  // about shoulder-width apart, elbows nearly straight), head counter-pitched to look ahead
  // between them.
  flightPitch: 65,
  flightKnee: 3,
  flightToe: 45,
  reachSwing: 155, // both arms, mirrored by each arm's own axes
  reachArmIn: 10, // beyond hanging straight down, so the hands come slightly together
  reachElbow: 5,
  headCounterPitch: -48,

  // Turns and climbs.
  bankMax: 12,
  bankPerTurnRate: 9, // degrees of bank per rad/s of turning
  climbTilt: 10,
};

/**
 * Jump and fall poses (degrees, seconds, metres), layered like the flight pose. There is no jump
 * clip: take-off is a quick crouch-to-extend, the air pose is compact (knees tucked, arms a little
 * out and forward, leaning with horizontal speed), a long fall loosens with the arms raised, and
 * landing is a short knee bend that hands back to the locomotion clips.
 */
export const JUMP_POSE = {
  crouchSeconds: 0.1,
  crouchRiseSeconds: 0.03,
  crouchKnee: 35,
  crouchHip: 28,
  crouchLean: 10,
  crouchDrop: 0.1,
  airBlendSeconds: 0.12,
  airKnee: 32,
  airHip: 24,
  airToe: 18,
  airArmOut: 18,
  airArmSwing: 22,
  airElbow: 28,
  airLeanMax: 12, // at running speed
  fallAfterSeconds: 0.6,
  fallBlendSeconds: 0.3,
  fallArmOut: 85, // out from the relaxed arm: roughly level with the shoulders
  fallArmSwing: 25,
  fallElbow: 22,
  fallKnee: 16,
  fallHip: 8,
  landSeconds: 0.2,
  landKnee: 30,
  landHip: 22,
  landLean: 8,
  landDrop: 0.12,
};

/** Relaxed arms hang this many degrees out from vertical. */
export const RELAXED_ARM_OUTWARD_DEG = 7;

const DEG = Math.PI / 180;
const UP = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _q2 = new Quaternion();
const _v = new Vector3();

function safeAxis(a, b, fallback) {
  const axis = new Vector3().crossVectors(a, b);
  if (axis.lengthSq() < 1e-8) return fallback.clone().normalize();
  return axis.normalize();
}

/**
 * One driven bone. Rotations come in two kinds, composed on top of the rest quaternion every frame
 * (nothing accumulates between frames):
 *   rotate(axis, angle)       about a model-space axis (whole-body motions),
 *   rotateLocal(axis, angle)  about a bone-local axis, in call order, like Object3D.rotateOnAxis.
 * local = parent^-1 * modelRotations * parent * rest * localRotations
 */
class Joint {
  constructor(bone, modelInverse) {
    this.bone = bone;
    this.restQuaternion = bone.quaternion.clone();
    this.restPosition = bone.position.clone();
    const parentWorld = new Matrix4();
    if (bone.parent) parentWorld.multiplyMatrices(modelInverse, bone.parent.matrixWorld);
    this.parentQuaternion = new Quaternion();
    parentWorld.decompose(new Vector3(), this.parentQuaternion, new Vector3());
    this.parentInverse = this.parentQuaternion.clone().invert();
    // Model-space offsets -> parent-local offsets (includes any armature scale).
    this.parentLinearInverse = new Matrix3().setFromMatrix4(parentWorld).invert();
    const world = new Matrix4().multiplyMatrices(modelInverse, bone.matrixWorld);
    this.restWorldQuaternion = new Quaternion();
    this.worldPosition = new Vector3();
    world.decompose(this.worldPosition, this.restWorldQuaternion, new Vector3());
    this.modelRotation = new Quaternion();
    this.localRotation = new Quaternion();
  }

  /** Converts a model-space direction into this bone's rest local frame. */
  toLocal(direction) {
    return direction.clone().applyQuaternion(this.restWorldQuaternion.clone().invert()).normalize();
  }

  begin() {
    this.modelRotation.identity();
    this.localRotation.identity();
  }

  rotate(axis, angle) {
    if (!angle) return;
    _q.setFromAxisAngle(axis, angle);
    this.modelRotation.premultiply(_q);
  }

  rotateLocal(axis, angle) {
    if (!angle) return;
    _q.setFromAxisAngle(axis, angle);
    this.localRotation.multiply(_q);
  }

  commit() {
    _q2.copy(this.parentInverse)
      .multiply(this.modelRotation)
      .multiply(this.parentQuaternion)
      .multiply(this.restQuaternion)
      .multiply(this.localRotation);
    this.bone.quaternion.copy(_q2);
  }

  /** Cross-fades the bone from its current (locomotion) rotation towards this joint's pose. */
  blend(weight) {
    _q2.copy(this.parentInverse)
      .multiply(this.modelRotation)
      .multiply(this.parentQuaternion)
      .multiply(this.restQuaternion)
      .multiply(this.localRotation);
    this.bone.quaternion.slerp(_q2, weight);
  }

  /** Cross-fades the bone's position towards its rest position plus a model-space offset. */
  blendOffset(vector, weight) {
    _v.copy(vector).applyMatrix3(this.parentLinearInverse).add(this.restPosition);
    this.bone.position.lerp(_v, weight);
  }

  /** Moves the bone by a model-space offset from its rest position. */
  offset(vector) {
    _v.copy(vector).applyMatrix3(this.parentLinearInverse);
    this.bone.position.copy(this.restPosition).add(_v);
  }

  reset() {
    this.bone.quaternion.copy(this.restQuaternion);
    this.bone.position.copy(this.restPosition);
  }
}

/** Procedural locomotion on the skeleton (used when the GLB carries no Idle/Walk/Run clips). */
export class ProceduralLocomotion {
  constructor(model, bones, resolved, config) {
    this.kind = "procedural";
    model.updateMatrixWorld(true);
    const modelInverse = new Matrix4().copy(model.matrixWorld).invert();
    const yaw = resolved.yawDeg * DEG;
    // Character axes in model space (the wrapper rotates the model by `yaw` to face +Z).
    const forward = new Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const left = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const down = UP.clone().negate();
    const back = forward.clone().negate();
    this.yawAxis = safeAxis(left, forward, down); // positive: left side forward
    this.rollAxis = safeAxis(left, down, back); // positive: left side down
    this.leanAxis = safeAxis(UP, forward, left); // positive: lean forward

    // One Joint per bone, even if the sidecar maps two logical names to the same node.
    const cache = new Map();
    const joint = (name) => {
      const bone = name ? bones.get(name) : null;
      if (!bone) return null;
      if (!cache.has(bone)) cache.set(bone, new Joint(bone, modelInverse));
      return cache.get(bone);
    };
    const b = resolved.bones;
    this.hips = joint(b.hips);
    this.spine = b.spine.map((name) => joint(name)).filter(Boolean);
    this.neck = joint(b.neck);
    this.head = joint(b.head);

    const boneAxes = config?.boneAxes;
    // Local axis for a motion: the sidecar's measured axis when present, otherwise the axis
    // derived from the rest-pose joint positions.
    const localAxis = (jointRef, logical, reader, geometricModelAxis) =>
      new Vector3(...(reader(boneAxes, logical, jointRef.bone.name) ?? jointRef.toLocal(geometricModelAxis).toArray()));

    this.legs = [];
    for (const side of ["left", "right"]) {
      const leg = {
        side,
        upLeg: joint(b[`${side}UpLeg`]),
        leg: joint(b[`${side}Leg`]),
        foot: joint(b[`${side}Foot`]),
        toe: joint(b[`${side}Toe`]),
      };
      if (!leg.upLeg || !leg.leg) continue;
      const thighDir = new Vector3().subVectors(leg.leg.worldPosition, leg.upLeg.worldPosition).normalize();
      const shinDir = leg.foot ? new Vector3().subVectors(leg.foot.worldPosition, leg.leg.worldPosition).normalize() : thighDir.clone();
      const footDir = leg.foot && leg.toe ? new Vector3().subVectors(leg.toe.worldPosition, leg.foot.worldPosition).normalize() : forward.clone();
      leg.hipAxis = localAxis(leg.upLeg, `${side}UpLeg`, readHingeAxis, safeAxis(thighDir, forward, left.clone().negate()));
      leg.kneeAxis = localAxis(leg.leg, `${side}Leg`, readHingeAxis, safeAxis(shinDir, back, left));
      leg.toeAxis = leg.foot ? localAxis(leg.foot, `${side}Foot`, readHingeAxis, safeAxis(footDir, down, left)) : null;
      leg.length = leg.upLeg.worldPosition.y - (leg.foot ? leg.foot.worldPosition.y : 0);
      this.legs.push(leg);
    }
    const lengths = this.legs.map((l) => l.length).filter((v) => v > 0.2);
    this.legLength = lengths.length ? lengths.reduce((s, v) => s + v, 0) / lengths.length : 0.85;

    this.arms = [];
    for (const side of ["left", "right"]) {
      const arm = {
        side,
        shoulder: joint(b[`${side}Shoulder`]),
        arm: joint(b[`${side}Arm`]),
        foreArm: joint(b[`${side}ForeArm`]),
        hand: joint(b[`${side}Hand`]),
      };
      if (!arm.arm || !arm.foreArm) continue;
      const armDir = new Vector3().subVectors(arm.foreArm.worldPosition, arm.arm.worldPosition).normalize();
      const foreDir = arm.hand ? new Vector3().subVectors(arm.hand.worldPosition, arm.foreArm.worldPosition).normalize() : armDir.clone();
      arm.lowerAxis = localAxis(arm.arm, `${side}Arm`, readLowerArmAxis, safeAxis(armDir, down, forward));
      arm.swingAxis = localAxis(arm.arm, `${side}Arm`, readHingeAxis, safeAxis(armDir, forward, left.clone().negate()));
      arm.elbowAxis = localAxis(arm.foreArm, `${side}ForeArm`, readHingeAxis, safeAxis(foreDir, forward, UP));
      // Rest angle below horizontal: from the sidecar, else measured from the joints.
      const measured = Math.asin(Math.min(1, Math.max(-1, -armDir.y))) / DEG;
      const rest = readArmRestAngle(config, side) ?? measured;
      arm.lowerAngle = Math.max(0, 90 - rest - RELAXED_ARM_OUTWARD_DEG) * DEG;
      this.arms.push(arm);
    }

    this.joints = [...cache.values()];
    this.phase = 0;
    this.breath = 0;
    this.dropVector = new Vector3();
    this.ok = REQUIRED_BONES.every((name) => Boolean(resolved.bones[name]));
  }

  update(dt, { distance, moving, run, reducedMotion }) {
    const S = RIG_SIGNS;
    this.phase = advancePhase(this.phase, distance, this.legLength, run);
    if (!reducedMotion) this.breath = (this.breath + dt * 1.7) % (Math.PI * 2);
    const pose = gaitPose(this.phase, {
      moving,
      run,
      legLength: this.legLength,
      breath: reducedMotion ? null : this.breath,
    });
    for (const j of this.joints) j.begin();

    if (this.hips) {
      this.hips.rotate(this.yawAxis, S.hipsYaw * pose.hipsYaw);
      this.hips.rotate(this.rollAxis, S.hipsRoll * pose.hipsRoll);
    }
    const spineCount = Math.max(1, this.spine.length);
    for (const s of this.spine) {
      s.rotate(this.yawAxis, (S.spineYaw * pose.spineYaw) / spineCount);
      s.rotate(this.leanAxis, (S.spineLean * pose.spineLean) / spineCount);
    }
    const headJoint = this.head ?? this.neck;
    if (headJoint) {
      headJoint.rotate(this.yawAxis, S.headYaw * pose.headYaw);
      headJoint.rotate(this.rollAxis, S.headRoll * pose.headRoll);
      headJoint.rotate(this.leanAxis, S.headPitch * pose.headPitch);
    }

    for (const leg of this.legs) {
      const left = leg.side === "left";
      leg.upLeg.rotateLocal(leg.hipAxis, S.hipFlex * (left ? pose.thighL : pose.thighR));
      leg.leg.rotateLocal(leg.kneeAxis, S.kneeFlex * (left ? pose.kneeL : pose.kneeR));
      if (leg.foot && leg.toeAxis) leg.foot.rotateLocal(leg.toeAxis, S.toeDown * (left ? pose.ankleL : pose.ankleR));
    }

    for (const arm of this.arms) {
      const left = arm.side === "left";
      // Lowering out of the rest pose is always applied: a standing visitor never sees an A/T-pose.
      arm.arm.rotateLocal(arm.lowerAxis, S.armLower * arm.lowerAngle);
      arm.arm.rotateLocal(arm.swingAxis, S.armSwing * (left ? pose.armL : pose.armR));
      arm.foreArm.rotateLocal(arm.elbowAxis, S.elbowFlex * (left ? pose.elbowL : pose.elbowR));
      if (arm.shoulder) arm.shoulder.rotate(this.leanAxis, 0.03 * pose.breathing);
    }

    for (const j of this.joints) j.commit();
    if (this.hips) {
      this.dropVector.copy(UP).multiplyScalar(-pose.hipsDrop);
      this.hips.offset(this.dropVector);
    }
  }

  dispose() {
    for (const j of this.joints) j.reset();
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The flight pose as a layer over the locomotion pose. Uses its own joint set, captured from the
 * rest pose before any locomotion runs, and cross-fades every driven bone towards the flight pose
 * by the layer's weight (nothing is touched while the weight is zero).
 */
export class FlightLayer {
  constructor(rig) {
    this.rig = rig;
    this.ok = rig.ok;
    this.weight = 0;
    this.forward = 0;
    this.armReach = 0;
    this.intentSeconds = 0;
    this.bank = 0;
    this.climb = 0;
    this.bobPhase = 0;
    this.bobVector = new Vector3();
  }

  /**
   * @param {number} dt
   * @param {{ active?: boolean, forward?: number, moveIntent?: boolean, turnRate?: number, climb?: number, snap?: boolean } | null} flight
   * @param {boolean} reducedMotion
   */
  update(dt, flight, reducedMotion) {
    const P = FLIGHT_POSE;
    const S = RIG_SIGNS;
    const active = Boolean(flight?.active);
    const fade = (seconds) => (flight?.snap ? 1 : dt > 0 ? 1 - Math.exp((-3 * dt) / seconds) : 0);
    this.weight += ((active ? 1 : 0) - this.weight) * fade(reducedMotion ? P.reducedBlendSeconds : P.blendSeconds);
    if (!active && this.weight < 0.002) {
      this.weight = 0;
      this.forward = 0;
      this.armReach = 0;
      this.intentSeconds = 0;
      this.bank = 0;
      this.climb = 0;
      return;
    }
    const forwardTarget = Math.min(1, Math.max(0, Number(flight?.forward) || 0));
    this.forward += (forwardTarget - this.forward) * fade(reducedMotion ? P.reducedBlendSeconds : P.bodyPitchSeconds);
    // Arms from intent (after the tap filter), plus a little of the achieved speed.
    this.intentSeconds = flight?.moveIntent ? this.intentSeconds + dt : 0;
    const armTarget = Math.max(this.intentSeconds >= P.armIntentDelay ? 1 : 0, forwardTarget * P.armSpeedShare);
    const armSeconds = armTarget > this.armReach ? P.armExtendSeconds : P.armRetractSeconds;
    this.armReach += (armTarget - this.armReach) * fade(armSeconds);
    const bankTarget = reducedMotion ? 0 : Math.max(-P.bankMax, Math.min(P.bankMax, (Number(flight?.turnRate) || 0) * P.bankPerTurnRate));
    this.bank += (bankTarget - this.bank) * fade(P.blendSeconds);
    const climbTarget = Math.max(-1, Math.min(1, Number(flight?.climb) || 0));
    this.climb += (climbTarget - this.climb) * fade(P.blendSeconds);
    if (!reducedMotion) this.bobPhase = (this.bobPhase + (dt * Math.PI * 2) / P.bobSeconds) % (Math.PI * 2);

    const rig = this.rig;
    const f = this.forward * this.forward * (3 - 2 * this.forward);
    const a = this.armReach;
    for (const j of rig.joints) j.begin();

    if (rig.hips) {
      const pitch = lerp(P.hoverLean, P.flightPitch, f) - P.climbTilt * this.climb;
      rig.hips.rotate(rig.leanAxis, S.bodyPitch * pitch * DEG);
      rig.hips.rotate(rig.rollAxis, S.bodyBank * this.bank * DEG);
    }
    const headJoint = rig.head ?? rig.neck;
    if (headJoint) headJoint.rotate(rig.leanAxis, S.headPitch * lerp(0, P.headCounterPitch, f) * DEG);
    if (rig.neck && rig.head) rig.neck.rotate(rig.leanAxis, S.headPitch * lerp(0, P.headCounterPitch * 0.4, f) * DEG);

    for (const leg of rig.legs) {
      const sign = leg.side === "left" ? 1 : -1;
      const hip = lerp(P.hoverHipFlex + sign * P.hoverHipFlexOffset * 0.5, 0, f);
      const knee = lerp(P.hoverKnee + sign * P.hoverKneeOffset * 0.5, P.flightKnee, f);
      leg.upLeg.rotateLocal(leg.hipAxis, S.hipFlex * hip * DEG);
      leg.leg.rotateLocal(leg.kneeAxis, S.kneeFlex * knee * DEG);
      if (leg.foot && leg.toeAxis) leg.foot.rotateLocal(leg.toeAxis, S.toeDown * lerp(P.hoverToe, P.flightToe, f) * DEG);
    }

    for (const arm of rig.arms) {
      const hoverLower = Math.max(0, arm.lowerAngle - P.hoverArmOut * DEG);
      const lower = lerp(hoverLower, arm.lowerAngle + P.reachArmIn * DEG, a);
      const swing = lerp(P.hoverArmSwing, P.reachSwing, a);
      const elbow = lerp(P.hoverElbow, P.reachElbow, a);
      arm.arm.rotateLocal(arm.lowerAxis, S.armLower * lower);
      arm.arm.rotateLocal(arm.swingAxis, S.armSwing * swing * DEG);
      arm.foreArm.rotateLocal(arm.elbowAxis, S.elbowFlex * elbow * DEG);
    }

    for (const j of rig.joints) j.blend(this.weight);
    if (rig.hips) {
      const bob = reducedMotion ? 0 : Math.sin(this.bobPhase) * P.bobMetres * (1 - f);
      this.bobVector.copy(UP).multiplyScalar(bob);
      rig.hips.blendOffset(this.bobVector, this.weight);
    }
  }
}

/**
 * Jump, fall and landing poses as a layer over the locomotion pose (same joint set as the flight
 * layer). The locomotion clips keep running underneath, so handing back to Walk/Run does not pop.
 */
export class JumpLayer {
  constructor(rig) {
    this.rig = rig;
    this.air = 0;
    this.fall = 0;
    this.crouchTime = null;
    this.landTime = null;
    this.drop = new Vector3();
  }

  /**
   * @param {number} dt
   * @param {{ airborne?: boolean, forward?: number, jumped?: boolean, landed?: boolean, airTime?: number, falling?: boolean } | null} air
   * @param {boolean} reducedMotion
   */
  update(dt, air, reducedMotion) {
    const P = JUMP_POSE;
    const S = RIG_SIGNS;
    if (air?.jumped && !reducedMotion) this.crouchTime = 0;
    if (air?.landed && !reducedMotion) this.landTime = 0;
    const airborne = Boolean(air?.airborne);
    const fade = (seconds) => (dt > 0 ? 1 - Math.exp((-3 * dt) / seconds) : 0);
    this.air += ((airborne ? 1 : 0) - this.air) * fade(airborne ? P.airBlendSeconds : P.landSeconds);
    const longFall = airborne && air?.falling && (air?.airTime ?? 0) > P.fallAfterSeconds;
    this.fall += ((longFall ? 1 : 0) - this.fall) * fade(P.fallBlendSeconds);

    let crouch = 0;
    let crouchWeight = 0;
    if (this.crouchTime !== null) {
      crouch = Math.max(0, 1 - this.crouchTime / P.crouchSeconds);
      crouchWeight = Math.min(1, this.crouchTime / P.crouchRiseSeconds + 0.35) * crouch;
      this.crouchTime += dt;
      if (this.crouchTime > P.crouchSeconds) this.crouchTime = null;
    }
    let land = 0;
    if (this.landTime !== null) {
      land = Math.max(0, 1 - this.landTime / P.landSeconds);
      this.landTime += dt;
      if (this.landTime > P.landSeconds) this.landTime = null;
    }
    const weight = Math.max(this.air, crouchWeight, land);
    if (weight < 0.002) {
      this.air = 0;
      this.fall = 0;
      return;
    }
    const mix = this.air / weight;
    const fall = this.fall;
    const forward = Math.min(1, Math.max(0, Number(air?.forward) || 0));
    const rig = this.rig;
    for (const j of rig.joints) j.begin();

    const lean = mix * lerp(P.airLeanMax * forward, 0, fall) + crouch * P.crouchLean + land * P.landLean;
    if (rig.hips) rig.hips.rotate(rig.leanAxis, S.bodyPitch * lean * DEG);
    for (const leg of rig.legs) {
      const knee = mix * lerp(P.airKnee, P.fallKnee, fall) + crouch * P.crouchKnee + land * P.landKnee;
      const hip = mix * lerp(P.airHip, P.fallHip, fall) + crouch * P.crouchHip + land * P.landHip;
      leg.upLeg.rotateLocal(leg.hipAxis, S.hipFlex * hip * DEG);
      leg.leg.rotateLocal(leg.kneeAxis, S.kneeFlex * knee * DEG);
      if (leg.foot && leg.toeAxis) leg.foot.rotateLocal(leg.toeAxis, S.toeDown * mix * P.airToe * (1 - fall) * DEG);
    }
    for (const arm of rig.arms) {
      const out = mix * lerp(P.airArmOut, P.fallArmOut, fall);
      // May go past the rest pose (negative), so the arms can rise in a long fall.
      arm.arm.rotateLocal(arm.lowerAxis, S.armLower * (arm.lowerAngle - out * DEG));
      arm.arm.rotateLocal(arm.swingAxis, S.armSwing * mix * lerp(P.airArmSwing, P.fallArmSwing, fall) * DEG);
      arm.foreArm.rotateLocal(arm.elbowAxis, S.elbowFlex * mix * lerp(P.airElbow, P.fallElbow, fall) * DEG);
    }

    for (const j of rig.joints) j.blend(weight);
    if (rig.hips) {
      this.drop.copy(UP).multiplyScalar(-(crouch * P.crouchDrop + land * P.landDrop) / Math.max(weight, 1e-3));
      rig.hips.blendOffset(this.drop, weight);
    }
  }
}

/** Cross-fade time constant: weights reach about 95 % of a change in 0.25 s. */
export const CROSSFADE_SECONDS = 0.25;

/**
 * Motion-capture locomotion: Idle, Walk and Run clips on an AnimationMixer.
 * - Idle <-> moving and walk <-> run blend smoothly (about CROSSFADE_SECONDS).
 * - Walk and Run share one gait phase that advances with the ground distance actually covered,
 *   divided by the blended stride, so feet do not slide and switching between them keeps step.
 *   Each clip's `syncPhase` (left foot furthest forward) aligns the two cycles.
 * - Idle runs on its own clock; it is frozen on its first frame under prefers-reduced-motion.
 */
class MocapLocomotion {
  constructor(model, clips, meta, kind) {
    this.kind = kind;
    this.mixer = new AnimationMixer(model);
    this.meta = meta;
    this.actions = {};
    for (const name of ["Idle", "Walk", "Run"]) {
      const action = this.mixer.clipAction(clips[name]);
      action.setLoop(LoopRepeat, Infinity);
      action.enabled = true;
      action.setEffectiveWeight(name === "Idle" ? 1 : 0);
      // Walk and Run are positioned by the shared gait phase, not by the mixer clock.
      if (name !== "Idle") action.setEffectiveTimeScale(0);
      action.play();
      this.actions[name] = action;
    }
    this.speeds = { walk: meta.Walk.speedMps, run: meta.Run.speedMps };
    this.phase = 0;
    this.moving = 0;
    this.running = 0;
    this.legLength = 0.9;
    this.ok = true;
    this.mixer.update(0); // the Idle pose is in place before the first rendered frame
  }

  update(dt, { distance = 0, speed = 0, reducedMotion = false }) {
    const { Idle, Walk, Run } = this.actions;
    const { walk, run } = this.speeds;
    const k = dt > 0 ? 1 - Math.exp((-3 * dt) / CROSSFADE_SECONDS) : 0;
    const movingTarget = Math.min(1, Math.max(0, speed / (0.35 * walk)));
    const runningTarget = run > walk ? Math.min(1, Math.max(0, (speed - walk) / (run - walk))) : 0;
    this.moving += (movingTarget - this.moving) * k;
    this.running += (runningTarget - this.running) * k;

    const stride = this.meta.Walk.strideM + (this.meta.Run.strideM - this.meta.Walk.strideM) * this.running;
    if (stride > 0 && distance > 0) this.phase = (this.phase + distance / stride) % 1;
    Walk.time = ((this.phase + this.meta.Walk.syncPhase) % 1) * this.meta.Walk.duration;
    Run.time = ((this.phase + this.meta.Run.syncPhase) % 1) * this.meta.Run.duration;

    Idle.setEffectiveWeight(1 - this.moving);
    Walk.setEffectiveWeight(this.moving * (1 - this.running));
    Run.setEffectiveWeight(this.moving * this.running);
    Idle.setEffectiveTimeScale(reducedMotion ? 0 : 1);
    this.mixer.update(dt);
  }

  /** Idle at its first frame, gait at its start (review captures show the same pose every time). */
  restPose() {
    this.phase = 0;
    this.moving = 0;
    this.running = 0;
    this.mixer.setTime(0);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}

function findClip(animations, pattern) {
  return animations.find((clip) => pattern.test(clip.name)) ?? null;
}

/**
 * Locomotion source, in order of preference (each choice is logged):
 *   1. the retargeted motion-capture asset (avatar-animations.json) when it passes validation,
 *   2. Idle / Walk / Run clips inside the avatar GLB,
 *   3. the procedural rig driven by avatar.json.
 * @param {{ scene: any, animations?: any[] }} gltf
 * @param {object} config the parsed avatar.json (may be empty)
 * @param {object | null} animationAsset the parsed avatar-animations.json, if bundled
 */
export function createAvatar(gltf, config = {}, animationAsset = null) {
  const model = cloneSkinned(gltf.scene);
  const bones = new Map();
  const fadeMaterials = new Set();
  let fade = 1;
  model.traverse((object) => {
    if (object.isBone) bones.set(object.name, object);
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      // Skinned bounds follow the bind pose, so culling could drop the avatar near screen edges.
      if (object.isSkinnedMesh) object.frustumCulled = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        material.userData = material.userData ?? {};
        if (material.userData.ssrStrength === undefined) material.userData.ssrStrength = 0;
        // Dithered fade when the camera comes close (opacity 1 never discards anything); set up
        // front so fading never recompiles a shader. TRAA smooths the dither.
        material.alphaHash = true;
        fadeMaterials.add(material);
      }
    }
  });

  const resolved = resolveAvatarBones([...bones.keys()], config);

  const correction = new Group();
  correction.name = "Avatar yaw correction";
  correction.rotation.y = resolved.yawDeg * DEG;
  correction.add(model);
  const wrapper = new Group();
  wrapper.name = "Avatar";
  wrapper.add(correction);

  // Measure the skinned rest pose; stand the soles on y = 0 when the export is slightly off.
  wrapper.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 0.004 && Math.abs(box.min.y) < 0.5) {
    model.position.y -= box.min.y;
    wrapper.updateMatrixWorld(true);
  }
  const measured = Number.isFinite(box.max.y - box.min.y) ? box.max.y - box.min.y : 1.75;
  const height = resolved.heightM ?? Math.min(2.4, Math.max(1.2, measured));
  // Eye height for the hidden-avatar view, from the head bone in the rest pose.
  const headBone = resolved.bones.head ? bones.get(resolved.bones.head) : null;
  const eye = eyeHeight({ headY: headBone ? headBone.getWorldPosition(new Vector3()).y : undefined, heightM: height });

  // The flight layer captures the rest pose, so it is built before any locomotion poses the bones.
  const flightRig = new ProceduralLocomotion(model, bones, resolved, config);
  const flight = flightRig.ok ? new FlightLayer(flightRig) : null;
  const jump = flightRig.ok ? new JumpLayer(flightRig) : null;

  let locomotion = null;
  if (animationAsset) {
    const built = buildAnimationClips(animationAsset, bones.keys());
    if (built.ok) {
      locomotion = new MocapLocomotion(model, built.clips, built.meta, "motion-capture");
      devInfo(`[spaces] Avatar locomotion: motion-capture clips (walk ${built.meta.Walk.speedMps.toFixed(2)} m/s, run ${built.meta.Run.speedMps.toFixed(2)} m/s).`);
    } else {
      console.warn(`[spaces] Avatar animation asset rejected (${built.reason}); falling back.`);
    }
  } else {
    console.warn("[spaces] No avatar animation asset bundled; falling back.");
  }
  if (!locomotion) {
    const animations = gltf.animations ?? [];
    const clips = { Idle: findClip(animations, /idle/i), Walk: findClip(animations, /walk/i), Run: findClip(animations, /run|jog/i) };
    if (clips.Idle && clips.Walk && clips.Run) {
      const meta = Object.fromEntries(Object.entries(clips).map(([name, clip]) => {
        const speed = name === "Walk" ? 1.5 : name === "Run" ? 4.5 : 0;
        return [name, { duration: clip.duration, speedMps: speed, strideM: speed * clip.duration, syncPhase: 0 }];
      }));
      locomotion = new MocapLocomotion(model, clips, meta, "glb-clips");
      devInfo("[spaces] Avatar locomotion: clips found in the avatar GLB (assumed speeds).");
    }
  }
  if (!locomotion) {
    const procedural = new ProceduralLocomotion(model, bones, resolved, config);
    if (procedural.ok) {
      locomotion = procedural;
      devInfo("[spaces] Avatar locomotion: procedural rig (fallback).");
    } else {
      console.warn(`[spaces] Avatar skeleton is missing ${resolved.missing.join(", ")}; it will stand still.`);
    }
  }

  return {
    object: wrapper,
    height,
    legLength: locomotion?.legLength ?? 0.9,
    locomotionKind: locomotion?.kind ?? "none",
    /** Natural walk / run speeds of the clips (m/s), or null for the procedural rig. */
    speeds: locomotion?.speeds ?? null,
    missingBones: resolved.missing,
    /** True when the skeleton has the bones the flight pose needs. */
    canFly: Boolean(flight),
    /** Eye height above the feet (m). */
    eyeHeight: eye,
    /**
     * Shows or hides the model. Hidden objects (and their children) are skipped by every render
     * pass, the shadow pass included; the body keeps walking, it is just not drawn.
     */
    setVisible(visible) {
      wrapper.visible = Boolean(visible);
    },
    get visible() {
      return wrapper.visible;
    },
    /** Dithered opacity 0..1 (camera too close); separate from setVisible. */
    setFade(opacity) {
      const value = Math.min(1, Math.max(0, Number(opacity) || 0));
      if (value === fade) return;
      fade = value;
      for (const material of fadeMaterials) material.opacity = value;
    },
    get fade() {
      return fade;
    },
    get flightWeight() {
      return flight?.weight ?? 0;
    },
    /** How far the arms reach forward in flight (0 relaxed .. 1 fully ahead). */
    get flightArmReach() {
      return flight?.weight ? flight.armReach : 0;
    },
    /** Same pose every time (review captures). */
    restPose() {
      if (locomotion?.restPose) locomotion.restPose();
      else if (locomotion) locomotion.phase = 0;
    },
    update(dt, state) {
      locomotion?.update(dt, state);
      flight?.update(dt, state?.flight ?? null, Boolean(state?.reducedMotion));
      jump?.update(dt, state?.air ?? null, Boolean(state?.reducedMotion));
    },
    dispose() {
      locomotion?.dispose();
      wrapper.removeFromParent();
    },
  };
}
