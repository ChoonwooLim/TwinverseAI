#!/usr/bin/env node
// Retargets Idle / Walk / Run motion-capture clips from a Mixamo-rigged GLB (e.g. three.js
// examples/models/gltf/Xbot.glb) onto the National Assembly avatar and writes them as one asset:
//   frontend/src/spaces/national-assembly/assets/avatar-animations.json
//
// Usage (from the repository root, Node 20+; uses frontend/node_modules/three, no extra packages):
//   node scripts/avatar/build-avatar-animations.mjs --source path/to/Xbot.glb
//   options: --avatar <avatar.glb>  --out <file.json>  --clips idle=Idle,walk=Walk,run=Run
//            --clip-source Run=path/to/Soldier.glb   (take one clip from another Mixamo-rigged GLB;
//                                                     repeatable; the clip name inside it must match)
// Without --source it looks for ./anim-src/Xbot.glb in the current directory.
//
// Method (see frontend/src/spaces/animation/retarget.js): the avatar is first rotated into a
// reference pose whose bone directions match the source's rest pose; every frame then applies
// each source bone's world rotation relative to its rest onto that reference. The hips move by
// the source's offset from rest scaled by the hip-height ratio, with the per-cycle drift removed.
//
// The output is deterministic for the same inputs. The tool prints a validation report and exits
// with code 1 if any check fails.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AnimationMixer, Quaternion, Vector3 } from "../../frontend/node_modules/three/build/three.module.js";
import { buildSkeleton, parseGLB, readClips } from "../../frontend/src/spaces/animation/glbSkeleton.js";
import {
  LIMB_GROUPS,
  applyFrame,
  applyRest,
  compareDirections,
  createNameMap,
  createRetargeter,
  limbDirections,
  retargetClipFrames,
} from "../../frontend/src/spaces/animation/retarget.js";
import {
  groundSpeed,
  loopGap,
  makeQuaternionsContinuous,
  phaseOfMaximum,
  quaternionAngle,
  removeDrift,
  sagittalAngle,
  symmetryError,
} from "../../frontend/src/spaces/animation/locomotionAnalysis.js";
import { ASSET_FORMAT, ASSET_VERSION, buildAnimationClips } from "../../frontend/src/spaces/animation/animationAsset.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const DEFAULT_AVATAR = resolve(REPO, "frontend/src/spaces/national-assembly/assets/avatar.glb");
const DEFAULT_OUT = resolve(REPO, "frontend/src/spaces/national-assembly/assets/avatar-animations.json");

const THRESHOLDS = {
  directionDeg: 3, // any limb bone direction vs the source, between keyframes, after quantisation
  onFrameDeg: 0.05, // the same at the keyframes themselves (the method is exact up to rounding)
  groundM: 0.02, // the lowest foot of the cycle may float or sink at most this much
  loopDeg: 0.5, // first vs last key of a loop
  symmetryAddedDeg: 2, // retargeting may not make left/right less symmetric than the source
};
const VALIDATION_SAMPLES = 12;
const QUAT_DECIMALS = 5;
const POS_DECIMALS = 4;
const DIR_DECIMALS = 4;
const FEET = ["LeftFoot", "LeftToeBase", "RightFoot", "RightToeBase"];

function parseArgs(argv) {
  const args = { clips: "idle=Idle,walk=Walk,run=Run", clipSources: {} };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--source") args.source = argv[++i];
    else if (key === "--avatar") args.avatar = argv[++i];
    else if (key === "--out") args.out = argv[++i];
    else if (key === "--clips") args.clips = argv[++i];
    else if (key === "--clip-source") {
      const [clipName, path] = argv[++i].split("=");
      args.clipSources[clipName.trim()] = path.trim();
    }
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown argument ${key}`);
  }
  return args;
}

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const worldY = (bone) => bone.getWorldPosition(new Vector3()).y;
const worldZ = (bone) => bone.getWorldPosition(new Vector3()).z;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("node scripts/avatar/build-avatar-animations.mjs --source <Xbot.glb> [--avatar <avatar.glb>] [--out <json>] [--clips idle=Idle,walk=Walk,run=Run]");
    return 0;
  }
  const defaultSourcePath = resolve(args.source ?? "anim-src/Xbot.glb");
  const avatarPath = resolve(args.avatar ?? DEFAULT_AVATAR);
  const outPath = resolve(args.out ?? DEFAULT_OUT);
  if (!existsSync(avatarPath)) throw new Error(`Avatar GLB not found: ${avatarPath}`);

  const avatarBytes = readFileSync(avatarPath);
  const avatarGltf = parseGLB(toArrayBuffer(avatarBytes));
  const target = buildSkeleton(avatarGltf);
  const targetNames = target.joints.map((bone) => bone.name);
  const targetRest = {
    targetRestLocal: new Map(targetNames.map((name) => [name, target.bones.get(name).quaternion.clone()])),
    targetRestPosition: new Map(targetNames.map((name) => [name, target.bones.get(name).position.clone()])),
  };
  const coreBones = Object.values(LIMB_GROUPS).flat(2);

  // One retargeting session per source file.
  const sessions = new Map();
  const sessionFor = (path) => {
    const key = resolve(path);
    if (sessions.has(key)) return sessions.get(key);
    if (!existsSync(key)) throw new Error(`Source GLB not found: ${key} (pass --source / --clip-source)`);
    const bytes = readFileSync(key);
    const gltf = parseGLB(toArrayBuffer(bytes));
    const source = buildSkeleton(gltf);
    const nameMap = createNameMap(targetNames, [...source.bones.keys()]);
    applyRest(target, targetRest);
    const session = {
      file: basename(key),
      sha256: sha256(bytes),
      source,
      clips: readClips(gltf, source.nodes),
      nameMap,
      unmapped: targetNames.filter((name) => !nameMap.has(name)),
      retargeter: createRetargeter({ target, source, nameMap }),
    };
    sessions.set(key, session);
    return session;
  };
  sessionFor(defaultSourcePath);

  applyRest(target, targetRest);
  const restHeights = Object.fromEntries(FEET.map((name) => [name, worldY(target.bones.get(name))]));
  const hipsRestY = worldY(target.bones.get("Hips"));
  const legLength = worldY(target.bones.get("LeftUpLeg")) - restHeights.LeftFoot;
  const footHeights = () => {
    const h = (name) => worldY(target.bones.get(name)) - restHeights[name];
    return { left: Math.min(h("LeftFoot"), h("LeftToeBase")), right: Math.min(h("RightFoot"), h("RightToeBase")) };
  };

  const clipMap = Object.fromEntries(args.clips.split(",").map((pair) => pair.split("=").map((s) => s.trim())));
  const asset = {
    format: ASSET_FORMAT,
    version: ASSET_VERSION,
    generator: "scripts/avatar/build-avatar-animations.mjs",
    method: "rest-relative world-rotation transfer onto a direction-matched reference pose",
    source: { clips: {} },
    target: { file: basename(avatarPath), sha256: sha256(avatarBytes), hipsHeightM: round(hipsRestY, 4), legLengthM: round(legLength, 4) },
    fps: 0,
    bones: targetNames,
    clips: {},
    validation: { thresholds: THRESHOLDS, samples: {} },
  };
  const report = { clips: {} };

  for (const [sourceClipName, clipName] of Object.entries(clipMap)) {
    const session = sessionFor(args.clipSources[clipName] ?? defaultSourcePath);
    const { source, nameMap, retargeter } = session;
    const sourceName = (name) => nameMap.get(name);
    const clip = session.clips.find((c) => c.name.toLowerCase() === sourceClipName.toLowerCase());
    if (!clip) throw new Error(`${session.file} has no clip named ${sourceClipName} (has ${session.clips.map((c) => c.name).join(", ")})`);
    asset.source.clips[clipName] = { file: session.file, sha256: session.sha256, clip: clip.name };
    applyRest(target, targetRest);
    const keyCount = Math.max(...clip.tracks.map((track) => track.times.length));
    const fps = Math.round((keyCount - 1) / clip.duration);
    if (!asset.fps) asset.fps = fps;
    if (fps !== asset.fps) throw new Error(`Clip ${clip.name} runs at ${fps} fps, others at ${asset.fps}`);

    const { frames } = retargetClipFrames({ retargeter, source, clip, fps });
    const rotations = {};
    for (const name of targetNames) {
      rotations[name] = makeQuaternionsContinuous(frames.map((frame) => frame.rotations.get(name).toArray()));
    }
    const positions = frames.map((frame) => frame.hipsPosition.toArray());
    const gap = loopGap(rotations);
    // Closed loop: the last key repeats the first. Open loop: the cycle is one frame longer and the
    // first key is appended to close it.
    const drift = removeDrift(positions, gap.closed);
    if (!gap.closed) {
      for (const name of targetNames) {
        const first = rotations[name][0];
        const last = rotations[name][rotations[name].length - 1];
        const dot = first.reduce((sum, v, i) => sum + v * last[i], 0);
        rotations[name].push(dot < 0 ? first.map((v) => -v) : [...first]);
      }
      positions.push([...positions[0]]);
    }
    const keys = positions.length;
    const duration = (keys - 1) / fps;
    const cycle = keys - 1;

    const poseTarget = (index) => {
      const frame = { rotations: new Map(), hipsPosition: new Vector3(...positions[index]) };
      for (const name of targetNames) frame.rotations.set(name, new Quaternion(...rotations[name][index]));
      applyFrame(target, frame);
    };

    // Ground contact: the lowest foot point of the cycle goes on the floor.
    let lowestBefore = Infinity;
    for (let i = 0; i < keys; i++) {
      poseTarget(i);
      const h = footHeights();
      lowestBefore = Math.min(lowestBefore, h.left, h.right);
    }
    const groundShift = Math.abs(lowestBefore) > 0.005 ? -lowestBefore : 0;
    for (const p of positions) p[1] += groundShift;

    // Per-key measurements over one cycle, on the avatar and on the source.
    const sourceMixer = new AnimationMixer(source.root);
    sourceMixer.clipAction(clip).play();
    const left = { contact: [], relZ: [] };
    const right = { contact: [], relZ: [] };
    const angles = { target: { legL: [], legR: [], armL: [], armR: [] }, source: { legL: [], legR: [], armL: [], armR: [] } };
    const onFrameExpected = [];
    const onFrameActual = [];
    let lowest = Infinity;
    let highestPlanted = -Infinity;
    for (let i = 0; i < cycle; i++) {
      poseTarget(i);
      const h = footHeights();
      lowest = Math.min(lowest, h.left, h.right);
      highestPlanted = Math.max(highestPlanted, Math.min(h.left, h.right));
      const hipsZ = worldZ(target.bones.get("Hips"));
      left.contact.push(h.left);
      right.contact.push(h.right);
      left.relZ.push(worldZ(target.bones.get("LeftFoot")) - hipsZ);
      right.relZ.push(worldZ(target.bones.get("RightFoot")) - hipsZ);
      const targetDirs = limbDirections(target);
      sourceMixer.setTime(Math.min(i / fps, clip.duration));
      source.root.updateMatrixWorld(true);
      const sourceDirs = limbDirections(source, sourceName);
      onFrameExpected.push(sourceDirs);
      onFrameActual.push(targetDirs);
      for (const [store, dirs] of [[angles.target, targetDirs], [angles.source, sourceDirs]]) {
        store.legL.push(sagittalAngle(dirs.LeftUpLeg));
        store.legR.push(sagittalAngle(dirs.RightUpLeg));
        store.armL.push(sagittalAngle(dirs.LeftArm));
        store.armR.push(sagittalAngle(dirs.RightArm));
      }
    }
    const cycleTimes = Array.from({ length: cycle }, (_, i) => i / fps);
    const locomotion = clipName !== "Idle";
    const speed = locomotion ? groundSpeed({ times: cycleTimes, cycleDuration: duration, feet: [left, right] }) : { speed: 0, runs: 0 };
    const syncPhase = locomotion ? phaseOfMaximum(cycleTimes, left.relZ, duration) : 0;
    const symmetry = (store) => ({
      upperLeg: symmetryError(store.legL, store.legR, locomotion),
      upperArm: symmetryError(store.armL, store.armR, locomotion),
    });
    let loopDeg = 0;
    for (const name of targetNames) loopDeg = Math.max(loopDeg, quaternionAngle(rotations[name][0], rotations[name][keys - 1]));
    const loopHipsM = Math.hypot(...positions[0].map((v, i) => v - positions[keys - 1][i]));

    // Validation samples between keyframes: source limb directions, stored with the asset.
    const sampleTimes = Array.from({ length: VALIDATION_SAMPLES }, (_, k) => round(((k + 0.37) / VALIDATION_SAMPLES) * clip.duration, 6));
    const sampleDirections = sampleTimes.map((time) => {
      sourceMixer.setTime(time);
      source.root.updateMatrixWorld(true);
      const dirs = limbDirections(source, sourceName);
      return Object.fromEntries(Object.entries(dirs).map(([bone, d]) => [bone, d.map((v) => round(v, DIR_DECIMALS))]));
    });
    sourceMixer.stopAllAction();
    sourceMixer.uncacheRoot(source.root);
    asset.validation.samples[clipName] = { times: sampleTimes, directions: sampleDirections };

    // Serialise (tracks that never move collapse to one key).
    const clipData = {
      duration: round(duration, 6),
      frames: keys,
      speedMps: round(speed.speed, 4),
      strideM: round(speed.speed * duration, 4),
      syncPhase: round(syncPhase, 4),
      rotations: {},
      hipsPosition: positions.flat().map((v) => round(v, POS_DECIMALS)),
    };
    for (const name of targetNames) {
      const track = rotations[name];
      const constant = track.every((k) => quaternionAngle(k, track[0]) < 1e-3);
      clipData.rotations[name] = (constant ? track[0] : track.flat()).map((v) => round(v, QUAT_DECIMALS));
    }
    asset.clips[clipName] = clipData;

    report.clips[clipName] = {
      sourceClip: `${session.file}:${clip.name}`,
      hipScale: retargeter.hipScale,
      facingDeg: (retargeter.facingYaw * 180) / Math.PI,
      unmapped: session.unmapped,
      keys,
      duration,
      closedInSource: gap.closed,
      driftPerCycleM: Math.hypot(drift.driftX, drift.driftZ),
      lowestFootBeforeM: lowestBefore,
      groundShiftM: groundShift,
      lowestFootM: lowest,
      highestPlantedFootM: highestPlanted,
      loopDeg,
      loopHipsM,
      symmetry: symmetry(angles.target),
      sourceSymmetry: symmetry(angles.source),
      speedMps: speed.speed,
      contactRuns: speed.runs,
      syncPhase,
      onFrame: compareDirections(onFrameExpected, onFrameActual),
    };
  }

  // Replay exactly what ships through three.js and compare with the source between keyframes.
  applyRest(target, targetRest);
  const problems = [];
  const built = buildAnimationClips(asset, targetNames);
  if (!built.ok) problems.push(`generated asset fails the runtime validation: ${built.reason}`);
  for (const [clipName, samples] of Object.entries(built.ok ? asset.validation.samples : {})) {
    const mixer = new AnimationMixer(target.root);
    mixer.clipAction(built.clips[clipName]).play();
    const actual = samples.times.map((time) => {
      mixer.setTime(time);
      target.root.updateMatrixWorld(true);
      return limbDirections(target);
    });
    mixer.stopAllAction();
    mixer.uncacheRoot(target.root);
    report.clips[clipName].directions = compareDirections(samples.directions, actual);
  }

  // Checks.
  const finite = !/NaN|Infinity/.test(JSON.stringify(asset));
  if (!finite) problems.push("non-finite values in output");
  for (const session of sessions.values()) {
    const missingCore = session.unmapped.filter((name) => coreBones.includes(name) || name === "Hips");
    if (missingCore.length) problems.push(`${session.file}: limb bones not in the source: ${missingCore.join(", ")}`);
  }
  for (const [clipName, r] of Object.entries(report.clips)) {
    for (const [group, e] of Object.entries(r.directions ?? {})) {
      if (e.max > THRESHOLDS.directionDeg) problems.push(`${clipName} ${group}: ${e.max.toFixed(2)} deg between keys`);
    }
    for (const [group, e] of Object.entries(r.onFrame)) {
      if (e.max > THRESHOLDS.onFrameDeg) problems.push(`${clipName} ${group}: ${e.max.toFixed(3)} deg at keys`);
    }
    if (Math.abs(r.lowestFootM) > THRESHOLDS.groundM) problems.push(`${clipName}: lowest foot ${r.lowestFootM.toFixed(3)} m`);
    if (r.loopDeg > THRESHOLDS.loopDeg) problems.push(`${clipName}: loop gap ${r.loopDeg.toFixed(2)} deg`);
    for (const part of ["upperLeg", "upperArm"]) {
      if (r.symmetry[part] - r.sourceSymmetry[part] > THRESHOLDS.symmetryAddedDeg) {
        problems.push(`${clipName}: ${part} symmetry ${r.symmetry[part].toFixed(1)} deg vs source ${r.sourceSymmetry[part].toFixed(1)}`);
      }
    }
    if (clipName !== "Idle" && !(r.speedMps > 0)) problems.push(`${clipName}: no ground speed measured`);
  }
  for (const group of Object.keys(LIMB_GROUPS)) {
    if (!Object.values(report.clips).some((r) => r.directions?.[group])) problems.push(`limb group ${group} not validated`);
  }
  asset.validation.report = Object.fromEntries(Object.entries(report.clips).map(([name, r]) => [name, {
    lowestFootM: round(r.lowestFootM, 4),
    groundShiftM: round(r.groundShiftM, 4),
    loopDeg: round(r.loopDeg, 4),
    symmetryDeg: { upperLeg: round(r.symmetry.upperLeg, 2), upperArm: round(r.symmetry.upperArm, 2) },
    sourceSymmetryDeg: { upperLeg: round(r.sourceSymmetry.upperLeg, 2), upperArm: round(r.sourceSymmetry.upperArm, 2) },
    speedMps: round(r.speedMps, 4),
    directionErrorDeg: Object.fromEntries(Object.entries(r.directions ?? {}).map(([g, e]) => [g, { max: round(e.max, 3), mean: round(e.mean, 3) }])),
    onFrameErrorDeg: Object.fromEntries(Object.entries(r.onFrame).map(([g, e]) => [g, round(e.max, 4)])),
  }]));

  const json = `${JSON.stringify(asset)}\n`;
  writeFileSync(outPath, json);

  // Report.
  const row = (cells, widths) => cells.map((c, i) => String(c).padEnd(widths[i])).join(" ");
  console.log(`Avatar animations: ${relative(process.cwd(), outPath)} (${(json.length / 1024).toFixed(1)} KiB)`);
  console.log(`Avatar: ${targetNames.length} bones, hips ${hipsRestY.toFixed(3)} m, leg ${legLength.toFixed(3)} m; ${asset.fps} fps`);
  for (const session of sessions.values()) {
    console.log(`Source ${session.file} (sha256 ${session.sha256.slice(0, 12)}): ${targetNames.length - session.unmapped.length}/${targetNames.length} bones mapped, hip scale ${session.retargeter.hipScale.toFixed(4)}, facing turn ${((session.retargeter.facingYaw * 180) / Math.PI).toFixed(1)} deg${session.unmapped.length ? `; kept at rest: ${session.unmapped.join(", ")}` : ""}`);
  }
  for (const [clipName, r] of Object.entries(report.clips)) {
    console.log(`\n${clipName} <- ${r.sourceClip}: ${r.keys} keys, ${r.duration.toFixed(3)} s, source loop ${r.closedInSource ? "closed" : "open (closing key added)"}, drift removed ${r.driftPerCycleM.toFixed(3)} m/cycle`);
    console.log(`  natural speed ${r.speedMps.toFixed(3)} m/s (${r.contactRuns} contact runs), stride ${(r.speedMps * r.duration).toFixed(3)} m/cycle, sync phase ${r.syncPhase.toFixed(3)}`);
    console.log(`  lowest foot ${(r.lowestFootM * 100).toFixed(2)} cm (raw ${(r.lowestFootBeforeM * 100).toFixed(2)} cm, hips shifted ${(r.groundShiftM * 100).toFixed(2)} cm); highest planted foot ${(r.highestPlantedFootM * 100).toFixed(2)} cm`);
    console.log(`  loop first/last ${r.loopDeg.toFixed(4)} deg, hips ${(r.loopHipsM * 1000).toFixed(2)} mm`);
    console.log(`  symmetry (L vs R ${clipName === "Idle" ? "same time" : "half a cycle later"}): legs ${r.symmetry.upperLeg.toFixed(2)} deg (source ${r.sourceSymmetry.upperLeg.toFixed(2)}), arms ${r.symmetry.upperArm.toFixed(2)} deg (source ${r.sourceSymmetry.upperArm.toFixed(2)})`);
    const widths = [10, 12, 12, 12];
    console.log(`  ${row(["group", "max deg", "mean deg", "at keys max"], widths)}`);
    for (const [group, e] of Object.entries(r.directions ?? r.onFrame)) {
      console.log(`  ${row([group, e.max.toFixed(3), e.mean.toFixed(3), (r.onFrame[group]?.max ?? 0).toFixed(4)], widths)}`);
    }
  }
  console.log(`\nNo NaN/Infinity: ${finite ? "yes" : "NO"}`);
  if (problems.length) {
    console.log(`\nFAILED (${problems.length}):\n - ${problems.join("\n - ")}`);
    return 1;
  }
  console.log("\nAll checks passed.");
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
}
