/**
 * Procedural humanoid gait maths. Pure functions, no three.js.
 *
 * `gaitPose` turns a gait phase into joint angles (radians) in a character-relative convention
 * that the skeleton driver converts into bone rotations:
 *   thigh*  > 0 swings the leg forward        knee*  >= 0 flexes the knee (shin goes back)
 *   ankle*  > 0 lifts the heel (toes down)     arm*   > 0 swings the arm forward
 *   elbow*  >= 0 bends the elbow forward       hipsYaw > 0 brings the left hip forward
 *   hipsRoll > 0 drops the left hip            spineYaw / spineLean / headYaw / headRoll / headPitch
 *   hipsDrop (metres, >= 0) lowers the pelvis so the stance foot stays on the ground.
 *
 * Phase 0 is mid-swing of the left leg; the left thigh angle is `amplitude * sin(phase)`.
 */

export const TAU = Math.PI * 2;

export const WALK = {
  thigh: 0.5,
  knee: 0.95,
  kneeStance: 0.12,
  ankleLift: 0.35,
  ankleClear: 0.12,
  arm: 0.32,
  elbowBase: 0.22,
  elbowSwing: 0.28,
  hipsYaw: 0.08,
  hipsRoll: 0.05,
  lean: 0.04,
  bounce: 0.012,
  strideFactor: 1.15,
};

export const RUN = {
  thigh: 0.8,
  knee: 1.7,
  kneeStance: 0.3,
  ankleLift: 0.5,
  ankleClear: 0.25,
  arm: 0.65,
  elbowBase: 1.25,
  elbowSwing: 0.3,
  hipsYaw: 0.12,
  hipsRoll: 0.04,
  lean: 0.17,
  bounce: 0.035,
  strideFactor: 1.7,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Narrow smooth bump: 1 at `centre`, falling to 0 about `width` radians either side. */
function bump(phase, centre, width) {
  let d = (phase - centre) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  const x = Math.abs(d) / width;
  if (x >= 1) return 0;
  const s = 1 - x * x;
  return s * s;
}

/** Gait parameters blended between walking (run = 0) and running (run = 1). */
export function blendGait(run) {
  const t = clamp01(run);
  const out = {};
  for (const key of Object.keys(WALK)) out[key] = lerp(WALK[key], RUN[key], t);
  return out;
}

/**
 * Distance covered by one full gait cycle (two steps) for a leg of `legLength` metres.
 * A swing of +-amplitude moves the foot about `2 * legLength * sin(amplitude)` per step; the
 * stride factor accounts for the double-support (walk) or flight (run) phase.
 */
export function strideLength(legLength, run) {
  const gait = blendGait(run);
  return 4 * legLength * Math.sin(gait.thigh) * gait.strideFactor;
}

/** Phase advance for a horizontal `distance` travelled. */
export function advancePhase(phase, distance, legLength, run) {
  const stride = Math.max(0.2, strideLength(legLength, run));
  const next = phase + (distance / stride) * TAU;
  return ((next % TAU) + TAU) % TAU;
}

/**
 * Joint angles for a gait phase.
 * @param {number} phase   gait phase in radians
 * @param {{ moving?: number, run?: number, legLength?: number, breath?: number }} options
 *   moving: 0 = standing, 1 = full gait; run: 0 = walk, 1 = run; breath: idle breathing phase
 *   (pass null to disable breathing, e.g. for prefers-reduced-motion).
 */
export function gaitPose(phase, { moving = 1, run = 0, legLength = 0.9, breath = null } = {}) {
  const w = clamp01(moving);
  const g = blendGait(run);
  const s = Math.sin(phase);

  const thighL = g.thigh * s * w;
  const thighR = -g.thigh * s * w;

  // Knee flexes as the leg leaves the back position (early swing) and slightly after heel strike.
  const kneeFor = (p) => (g.knee * bump(p, -0.45, 1.5) + g.kneeStance * bump(p, Math.PI / 2 + 0.5, 0.8)) * w;
  const kneeL = kneeFor(phase);
  const kneeR = kneeFor(phase + Math.PI);

  // Heel lifts in late stance (leg behind, before toe-off); toes clear the ground in mid-swing.
  const ankleFor = (p) => (g.ankleLift * bump(p, -Math.PI / 2 - 0.25, 0.9) - g.ankleClear * bump(p, 0, 0.9)) * w;
  const ankleL = ankleFor(phase);
  const ankleR = ankleFor(phase + Math.PI);

  // Arms counter-swing: the left arm moves with the right leg.
  const armL = -g.arm * s * w;
  const armR = g.arm * s * w;
  const elbowL = g.elbowBase * w + g.elbowSwing * Math.max(0, armL / (g.arm || 1)) * w + 0.12 * (1 - w);
  const elbowR = g.elbowBase * w + g.elbowSwing * Math.max(0, armR / (g.arm || 1)) * w + 0.12 * (1 - w);

  const hipsYaw = g.hipsYaw * s * w;
  const hipsRoll = g.hipsRoll * Math.cos(phase) * w;

  // Lower the pelvis as the legs spread so the feet stay near the ground. Real gait flattens
  // this with knee and ankle work, so only part of the rigid-leg drop is applied.
  const stanceAngle = Math.max(Math.abs(thighL), Math.abs(thighR));
  const bounce = g.bounce * w * (run > 0.5 ? -Math.cos(2 * phase) : Math.cos(2 * phase));
  const hipsDrop = Math.max(0, 0.6 * legLength * (1 - Math.cos(stanceAngle)) - bounce);

  const breathing = breath === null || breath === undefined ? 0 : Math.sin(breath) * (1 - w);
  const spineYaw = -hipsYaw * 0.85;
  const spineLean = g.lean * w + 0.012 * breathing;

  return {
    thighL, thighR, kneeL, kneeR, ankleL, ankleR,
    armL, armR, elbowL, elbowR,
    hipsYaw, hipsRoll, hipsDrop,
    spineYaw, spineLean,
    // Keep the head level: undo what hips and spine did to it.
    headYaw: -(hipsYaw + spineYaw),
    headRoll: -hipsRoll,
    headPitch: -spineLean * 0.8,
    breathing,
  };
}
