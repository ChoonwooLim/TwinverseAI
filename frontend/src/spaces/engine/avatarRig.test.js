// Checks the procedural rig on the real avatar skeleton: every motion must move the joints the
// way its name says. The GLB's node hierarchy is read directly (no textures, no renderer).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Bone, BoxGeometry, Group, Mesh, Object3D, Vector3 } from "three";
import { ProceduralLocomotion } from "./avatarRig";
import { resolveAvatarBones } from "../avatarConfig";
import { strideLength } from "../gait";

const asset = (name) => fileURLToPath(new URL(`../national-assembly/assets/${name}`, import.meta.url));

function loadSkeleton() {
  const glb = readFileSync(asset("avatar.glb"));
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  const joints = new Set(gltf.skins[0].joints);
  const objects = gltf.nodes.map((node, index) => {
    const object = joints.has(index) ? new Bone() : new Object3D();
    object.name = node.name ?? "";
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  gltf.nodes.forEach((node, index) => (node.children ?? []).forEach((child) => objects[index].add(objects[child])));
  const root = new Group();
  for (const index of gltf.scenes[0].nodes) root.add(objects[index]);
  const bones = new Map();
  root.traverse((object) => object.isBone && bones.set(object.name, object));
  return { root, bones };
}

describe("procedural rig on the National Assembly avatar", () => {
  const config = JSON.parse(readFileSync(asset("avatar.json"), "utf8"));
  const { root, bones } = loadSkeleton();
  const resolved = resolveAvatarBones([...bones.keys()], config);
  const rig = new ProceduralLocomotion(root, bones, resolved, config);
  const at = (name) => {
    root.updateMatrixWorld(true);
    return bones.get(name).getWorldPosition(new Vector3());
  };
  const rest = Object.fromEntries(["LeftForeArm", "LeftHand", "LeftLeg", "RightLeg", "LeftFoot", "LeftToeBase", "Hips"].map((n) => [n, at(n)]));
  const pose = (phase, moving, run = 0) => {
    rig.phase = 0;
    rig.update(0, { distance: (phase / (Math.PI * 2)) * strideLength(rig.legLength, run), moving, run, reducedMotion: true });
  };

  it("resolves the skeleton", () => {
    expect(rig.ok).toBe(true);
    expect(rig.legLength).toBeGreaterThan(0.8);
    expect(rig.legLength).toBeLessThan(1);
  });

  it("brings the arms down from the A-pose when standing", () => {
    pose(0, 0);
    const elbow = at("LeftForeArm");
    expect(elbow.x).toBeLessThan(rest.LeftForeArm.x - 0.05);
    expect(elbow.y).toBeLessThan(rest.LeftForeArm.y);
    expect(at("LeftHand").x).toBeLessThan(rest.LeftHand.x - 0.1);
    expect(at("LeftHand").x).toBeGreaterThan(0.15); // still clear of the hip
  });

  it("swings the legs and counter-swings the arms", () => {
    pose(0, 0);
    const idleLeftHand = at("LeftHand").z;
    pose(Math.PI / 2, 1);
    expect(at("LeftLeg").z).toBeGreaterThan(rest.LeftLeg.z + 0.1);
    expect(at("RightLeg").z).toBeLessThan(rest.RightLeg.z - 0.1);
    expect(at("LeftHand").z).toBeLessThan(idleLeftHand);
    expect(at("Hips").y).toBeLessThan(rest.Hips.y);
  });

  it("folds the knee back in early swing and lifts the heel in late stance", () => {
    pose(Math.PI * 2 - 0.45, 1);
    expect(at("LeftFoot").z - at("LeftLeg").z).toBeLessThan(-0.2);
    pose(Math.PI * 1.5 - 0.25, 1);
    expect(at("LeftToeBase").y - at("LeftFoot").y).toBeLessThan(rest.LeftToeBase.y - rest.LeftFoot.y - 0.03);
  });

  it("bends the elbows forward when running", () => {
    pose(Math.PI / 2, 1, 1);
    expect(at("LeftHand").z - at("LeftForeArm").z).toBeGreaterThan(0.1);
  });
});

describe("motion-capture locomotion on the National Assembly avatar", () => {
  const config = JSON.parse(readFileSync(asset("avatar.json"), "utf8"));
  const animations = JSON.parse(readFileSync(asset("avatar-animations.json"), "utf8"));

  it("is chosen when the animation asset validates, and starts in the Idle pose", async () => {
    const { createAvatar } = await import("./avatarRig");
    const { root } = loadSkeleton();
    const restElbow = (() => {
      root.updateMatrixWorld(true);
      return root.getObjectByName("LeftForeArm").getWorldPosition(new Vector3());
    })();
    const avatar = createAvatar({ scene: root, animations: [] }, config, animations);
    expect(avatar.locomotionKind).toBe("motion-capture");
    expect(avatar.speeds.walk).toBeCloseTo(animations.clips.Walk.speedMps, 6);
    expect(avatar.speeds.run).toBeCloseTo(animations.clips.Run.speedMps, 6);
    avatar.object.updateMatrixWorld(true);
    const elbow = avatar.object.getObjectByName("LeftForeArm").getWorldPosition(new Vector3());
    // Before any update the arms are already down at the sides (no A-pose frame).
    expect(elbow.x).toBeLessThan(restElbow.x - 0.05);

    // Walking: legs swing; feet stay on the ground over a cycle.
    const stride = animations.clips.Walk.strideM;
    let maxKneeForward = -Infinity;
    for (let i = 0; i < 60; i++) {
      avatar.update(1 / 60, { distance: stride / 30, speed: avatar.speeds.walk, reducedMotion: false });
      avatar.object.updateMatrixWorld(true);
      maxKneeForward = Math.max(maxKneeForward, avatar.object.getObjectByName("LeftLeg").getWorldPosition(new Vector3()).z);
    }
    expect(maxKneeForward).toBeGreaterThan(0.1);
    avatar.dispose();
  });

  it("falls back to the procedural rig, and says so, when the asset is unusable", async () => {
    const { createAvatar } = await import("./avatarRig");
    const { root } = loadSkeleton();
    const avatar = createAvatar({ scene: root, animations: [] }, config, { format: "something-else" });
    expect(avatar.locomotionKind).toBe("procedural");
    expect(avatar.speeds).toBeNull();
    avatar.dispose();
  });
});

describe("flight pose on the National Assembly avatar", () => {
  const config = JSON.parse(readFileSync(asset("avatar.json"), "utf8"));
  const animations = JSON.parse(readFileSync(asset("avatar-animations.json"), "utf8"));

  async function flyingAvatar() {
    const { createAvatar } = await import("./avatarRig");
    const { root } = loadSkeleton();
    const avatar = createAvatar({ scene: root, animations: [] }, config, animations);
    const at = (name) => {
      avatar.object.updateMatrixWorld(true);
      return avatar.object.getObjectByName(name).getWorldPosition(new Vector3());
    };
    const run = (seconds, flight, reducedMotion = false) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) avatar.update(1 / 60, { distance: 0, speed: 0, reducedMotion, flight });
    };
    return { avatar, at, run };
  }

  it("hovers upright with relaxed, slightly bent legs", async () => {
    const { avatar, at, run } = await flyingAvatar();
    expect(avatar.canFly).toBe(true);
    run(1.5, { active: true, forward: 0 });
    expect(avatar.flightWeight).toBeGreaterThan(0.99);
    expect(Math.abs(at("Head").z - at("Hips").z)).toBeLessThan(0.25);
    expect(at("LeftFoot").z - at("LeftLeg").z).toBeLessThan(-0.02); // knee bent, foot behind it
    expect(at("LeftHand").x - at("Hips").x).toBeGreaterThan(0.25); // arm a little away from the body
    avatar.dispose();
  });

  it("pitches forward in flight with legs trailing and both arms reaching ahead", async () => {
    const { avatar, at, run } = await flyingAvatar();
    run(3, { active: true, forward: 1, moveIntent: true });
    expect(avatar.flightArmReach).toBeGreaterThan(0.99);
    const hips = at("Hips");
    const head = at("Head");
    expect(head.z - hips.z).toBeGreaterThan(0.4); // body leans far forward
    expect(at("LeftFoot").z).toBeLessThan(hips.z - 0.4); // legs trail behind
    expect(at("RightFoot").z).toBeLessThan(hips.z - 0.4);
    const left = at("LeftHand");
    const right = at("RightHand");
    // Both hands ahead of the head, on their own sides (not crossing), clear of the head.
    expect(left.z).toBeGreaterThan(head.z + 0.2);
    expect(right.z).toBeGreaterThan(head.z + 0.2);
    expect(left.x - right.x).toBeGreaterThan(0.12);
    expect(left.x - right.x).toBeLessThan(0.6);
    expect(left.distanceTo(head)).toBeGreaterThan(0.2);
    expect(right.distanceTo(head)).toBeGreaterThan(0.2);
    expect(Math.abs(left.y - right.y)).toBeLessThan(0.1); // mirrored
    avatar.dispose();
  });

  it("brings the arms forward within a quarter second of a move key, and back as fast", async () => {
    const { avatar, run } = await flyingAvatar();
    run(1.5, { active: true, forward: 0 });
    expect(avatar.flightArmReach).toBeLessThan(0.01);
    // Pressing W: the speed has hardly built up yet, the arms are already out.
    run(0.25, { active: true, forward: 0.15, moveIntent: true });
    expect(avatar.flightArmReach).toBeGreaterThan(0.9);
    run(1, { active: true, forward: 1, moveIntent: true });
    // Letting go while still at full speed: arms 90 % back within a quarter second.
    run(0.25, { active: true, forward: 1, moveIntent: false });
    expect(avatar.flightArmReach).toBeLessThan(0.1);
    avatar.dispose();
  });

  it("makes only a small arm motion for a quick tap", async () => {
    const { avatar, run } = await flyingAvatar();
    run(1, { active: true, forward: 0 });
    let peak = 0;
    for (let i = 0; i < 6; i++) {
      run(1 / 60, { active: true, forward: 0, moveIntent: true });
      peak = Math.max(peak, avatar.flightArmReach);
    }
    for (let i = 0; i < 30; i++) {
      run(1 / 60, { active: true, forward: 0, moveIntent: false });
      peak = Math.max(peak, avatar.flightArmReach);
    }
    expect(peak).toBeLessThan(0.3);
    avatar.dispose();
  });

  it("cross-fades back to the locomotion pose on landing and keeps still under reduced motion", async () => {
    const { avatar, at, run } = await flyingAvatar();
    run(1, { active: true, forward: 0 }, true);
    const first = at("Hips").y;
    run(1, { active: true, forward: 0 }, true);
    expect(at("Hips").y).toBeCloseTo(first, 6); // no bob
    run(0.5, { active: false }, true);
    expect(avatar.flightWeight).toBe(0);
    avatar.dispose();
  });
});

describe("jump poses on the National Assembly avatar", () => {
  const config = JSON.parse(readFileSync(asset("avatar.json"), "utf8"));
  const animations = JSON.parse(readFileSync(asset("avatar-animations.json"), "utf8"));

  async function jumper() {
    const { createAvatar } = await import("./avatarRig");
    const { root } = loadSkeleton();
    const avatar = createAvatar({ scene: root, animations: [] }, config, animations);
    const at = (name) => {
      avatar.object.updateMatrixWorld(true);
      return avatar.object.getObjectByName(name).getWorldPosition(new Vector3());
    };
    const step = (air, reducedMotion = false) => avatar.update(1 / 60, { distance: 0, speed: 0, reducedMotion, air });
    return { avatar, at, step };
  }

  it("crouches on take-off, tucks in the air, raises the arms in a long fall and bends on landing", async () => {
    const { avatar, at, step } = await jumper();
    step(null);
    const standingHips = at("Hips").y;
    const standingHand = at("LeftHand").y;
    step({ airborne: true, jumped: true, forward: 0 });
    step({ airborne: true, forward: 0, airTime: 0.03 });
    expect(at("Hips").y).toBeLessThan(standingHips - 0.03); // crouch
    for (let i = 0; i < 20; i++) step({ airborne: true, forward: 0, airTime: 0.1 + i / 60 });
    expect(at("LeftFoot").z - at("LeftLeg").z).toBeLessThan(-0.05); // knees tucked
    for (let i = 0; i < 60; i++) step({ airborne: true, falling: true, forward: 0, airTime: 0.7 + i / 60 });
    expect(at("LeftHand").y).toBeGreaterThan(standingHand + 0.3); // arms raised in a long fall
    step({ airborne: false, landed: true });
    step({ airborne: false });
    expect(at("Hips").y).toBeLessThan(standingHips - 0.03); // landing bend
    for (let i = 0; i < 30; i++) step({ airborne: false });
    expect(at("Hips").y).toBeCloseTo(standingHips, 2); // back to the clip
    avatar.dispose();
  });

  it("skips the crouch and the landing bend under reduced motion", async () => {
    const { avatar, at, step } = await jumper();
    step(null, true);
    const standingHips = at("Hips").y;
    step({ airborne: true, jumped: true }, true);
    expect(at("Hips").y).toBeGreaterThan(standingHips - 0.03);
    for (let i = 0; i < 30; i++) step({ airborne: true, airTime: i / 60 }, true);
    step({ airborne: false, landed: true }, true);
    step({ airborne: false }, true);
    expect(at("Hips").y).toBeGreaterThan(standingHips - 0.03);
    avatar.dispose();
  });
});

describe("hiding the National Assembly avatar", () => {
  const config = JSON.parse(readFileSync(asset("avatar.json"), "utf8"));
  const animations = JSON.parse(readFileSync(asset("avatar-animations.json"), "utf8"));

  it("knows its eye height and leaves nothing for the shadow pass while hidden", async () => {
    const { createAvatar } = await import("./avatarRig");
    const { root } = loadSkeleton();
    const avatar = createAvatar({ scene: root, animations: [] }, config, animations);
    expect(avatar.eyeHeight).toBeGreaterThan(avatar.height * 0.85);
    expect(avatar.eyeHeight).toBeLessThan(avatar.height * 0.98);
    // Mirror the renderer's culling: invisible objects and their children are never projected.
    const add = (mesh) => {
      mesh.castShadow = true;
      return mesh;
    };
    avatar.object.children[0].add(add(new Mesh(new BoxGeometry())));
    const casters = () => {
      const found = [];
      avatar.object.traverseVisible((object) => object.isMesh && object.castShadow && found.push(object));
      return found.length;
    };
    expect(casters()).toBeGreaterThan(0);
    avatar.setVisible(false);
    expect(avatar.visible).toBe(false);
    expect(casters()).toBe(0);
    avatar.setVisible(true);
    expect(casters()).toBeGreaterThan(0);
    avatar.dispose();
  });
});
