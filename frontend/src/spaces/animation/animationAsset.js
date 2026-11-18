// Reads the retargeted locomotion clips (avatar-animations.json) into three.js AnimationClips and
// validates them against the avatar's skeleton. Used at runtime by the engine and by the build
// tool / tests to replay exactly what ships.
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";

export const ASSET_FORMAT = "twinverse.avatar-animations";
export const ASSET_VERSION = 1;
export const REQUIRED_CLIPS = ["Idle", "Walk", "Run"];
const CORE_BONES = ["Hips", "Spine", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot", "LeftArm", "LeftForeArm", "RightArm", "RightForeArm"];
const SPEED_RANGE = { Walk: [0.6, 3], Run: [2, 9] };

const allFinite = (values) => Array.isArray(values) && values.every((v) => typeof v === "number" && Number.isFinite(v));

/**
 * @param {object} asset parsed avatar-animations.json
 * @param {Iterable<string>} boneNames bone names present on the avatar
 * @returns {{ ok: true, clips: Record<string, AnimationClip>, meta: Record<string, object> } | { ok: false, reason: string }}
 */
export function buildAnimationClips(asset, boneNames) {
  const fail = (reason) => ({ ok: false, reason });
  if (!asset || asset.format !== ASSET_FORMAT) return fail("unknown asset format");
  if (asset.version !== ASSET_VERSION) return fail(`unsupported version ${asset.version}`);
  const fps = Number(asset.fps);
  if (!(fps > 0)) return fail("invalid fps");
  const available = new Set(boneNames);
  for (const bone of CORE_BONES) if (!available.has(bone)) return fail(`avatar has no ${bone} bone`);

  const clips = {};
  const meta = {};
  for (const name of REQUIRED_CLIPS) {
    const data = asset.clips?.[name];
    if (!data) return fail(`clip ${name} missing`);
    const frames = Number(data.frames);
    const duration = Number(data.duration);
    if (!(frames >= 2) || !(duration > 0) || Math.abs((frames - 1) / fps - duration) > 1e-3) return fail(`clip ${name} has inconsistent timing`);
    const times = new Float32Array(frames);
    for (let i = 0; i < frames; i++) times[i] = i === frames - 1 ? duration : i / fps;
    const tracks = [];
    let covered = 0;
    for (const [bone, values] of Object.entries(data.rotations ?? {})) {
      if (!allFinite(values)) return fail(`clip ${name}: non-finite rotation on ${bone}`);
      if (!available.has(bone)) continue;
      if (values.length === 4) {
        tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, [0, duration], [...values, ...values]));
      } else if (values.length === frames * 4) {
        tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
      } else {
        return fail(`clip ${name}: ${bone} has ${values.length} rotation values`);
      }
      covered++;
    }
    for (const bone of CORE_BONES) {
      if (!data.rotations?.[bone]) return fail(`clip ${name}: no ${bone} track`);
    }
    if (data.hipsPosition) {
      if (!allFinite(data.hipsPosition) || data.hipsPosition.length !== frames * 3) return fail(`clip ${name}: bad hips positions`);
      tracks.push(new VectorKeyframeTrack("Hips.position", times, data.hipsPosition));
    }
    const range = SPEED_RANGE[name];
    const speed = Number(data.speedMps);
    if (range && !(speed >= range[0] && speed <= range[1])) return fail(`clip ${name}: implausible speed ${speed}`);
    clips[name] = new AnimationClip(name, duration, tracks);
    meta[name] = {
      duration,
      speedMps: range ? speed : 0,
      strideM: range ? speed * duration : 0,
      syncPhase: Number.isFinite(data.syncPhase) ? data.syncPhase : 0,
      bones: covered,
    };
  }
  return { ok: true, clips, meta };
}
