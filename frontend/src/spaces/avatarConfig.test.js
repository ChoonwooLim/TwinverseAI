import { describe, expect, it } from "vitest";
import {
  normalizeBoneName,
  parseAxis,
  readArmRestAngle,
  readHingeAxis,
  readLowerArmAxis,
  resolveAvatarBones,
  sanitizeNodeName,
} from "./avatarConfig";

const MIXAMO = [
  "mixamorigHips", "mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2", "mixamorigNeck", "mixamorigHead",
  "mixamorigLeftUpLeg", "mixamorigLeftLeg", "mixamorigLeftFoot", "mixamorigLeftToeBase",
  "mixamorigRightUpLeg", "mixamorigRightLeg", "mixamorigRightFoot", "mixamorigRightToeBase",
  "mixamorigLeftShoulder", "mixamorigLeftArm", "mixamorigLeftForeArm", "mixamorigLeftHand",
  "mixamorigRightShoulder", "mixamorigRightArm", "mixamorigRightForeArm", "mixamorigRightHand",
];

const UNREAL = [
  "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head",
  "thigh_l", "calf_l", "foot_l", "ball_l", "thigh_r", "calf_r", "foot_r", "ball_r",
  "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r",
];

describe("name helpers", () => {
  it("sanitises like three.js and normalises rig prefixes away", () => {
    expect(sanitizeNodeName("mixamorig:Left Arm")).toBe("mixamorigLeft_Arm");
    expect(normalizeBoneName("mixamorig:LeftUpLeg")).toBe("leftupleg");
    expect(normalizeBoneName("RightArm")).toBe("rightarm");
    expect(normalizeBoneName("thigh_l")).toBe("thighl");
  });
});

describe("resolveAvatarBones", () => {
  it("uses the names declared in avatar.json, including exporter-sanitised ones", () => {
    const config = {
      yawToFacePlusZDeg: 180,
      heightM: 1.76,
      restPose: "T",
      bones: {
        hips: "mixamorig:Hips",
        spine: ["mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2"],
        leftUpLeg: "mixamorig:LeftUpLeg",
        right: { upLeg: "mixamorig:RightUpLeg", foreArm: "mixamorig:RightForeArm" },
      },
    };
    const result = resolveAvatarBones(MIXAMO, config);
    expect(result.bones.hips).toBe("mixamorigHips");
    expect(result.bones.spine).toEqual(["mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2"]);
    expect(result.bones.leftUpLeg).toBe("mixamorigLeftUpLeg");
    expect(result.bones.rightUpLeg).toBe("mixamorigRightUpLeg");
    expect(result.bones.rightForeArm).toBe("mixamorigRightForeArm");
    expect(result.missing).toEqual([]);
    expect(result.yawDeg).toBe(180);
    expect(result.heightM).toBe(1.76);
    expect(result.restPose).toBe("T");
  });

  it("guesses Mixamo-style bones when the sidecar is empty", () => {
    const result = resolveAvatarBones(MIXAMO, {});
    expect(result.bones.leftForeArm).toBe("mixamorigLeftForeArm");
    expect(result.bones.rightToe).toBe("mixamorigRightToeBase");
    expect(result.bones.spine).toEqual(["mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2"]);
    expect(result.yawDeg).toBe(0);
    expect(result.heightM).toBeNull();
  });

  it("guesses Unreal mannequin bones", () => {
    const result = resolveAvatarBones(UNREAL);
    expect(result.bones.hips).toBe("pelvis");
    expect(result.bones.leftLeg).toBe("calf_l");
    expect(result.bones.rightArm).toBe("upperarm_r");
    expect(result.bones.leftToe).toBe("ball_l");
    expect(result.bones.spine).toEqual(["spine_01", "spine_02", "spine_03"]);
    expect(result.missing).toEqual([]);
  });

  it("falls back to guessing when a declared name does not exist and reports gaps", () => {
    const result = resolveAvatarBones(["Hips", "LeftUpLeg"], { bones: { hips: "Pelvis_Wrong" } });
    expect(result.bones.hips).toBe("Hips");
    expect(result.missing).toContain("rightUpLeg");
  });
});

describe("axes", () => {
  it("parses strings, arrays and objects", () => {
    expect(parseAxis("+X")).toEqual([1, 0, 0]);
    expect(parseAxis("-y")).toEqual([-0, -1, -0]);
    expect(parseAxis([0, 0, 2])).toEqual([0, 0, 1]);
    expect(parseAxis({ x: 0, y: 3, z: 4 })).toEqual([0, 0.6, 0.8]);
    expect(parseAxis("diagonal")).toBeNull();
  });

  it("reads hinge and arm-lowering axes the way the sidecar writes them", () => {
    // Same field layout as the real avatar.json (keys are node names).
    const boneAxes = {
      LeftLeg: { along: "+Y", hingeAxisPositiveRotation: "-X", hingeAxisLocal: [-1, 0, -0.0037] },
      LeftArm: { hingeAxisPositiveRotation: "+Z", lowerArmAxisPositiveRotation: "+X", lowerArmAxisLocal: [0.9948, 0, 0.1018] },
      mixamorigRightForeArm: { hingeAxis: [0, 0, -1] },
    };
    const knee = readHingeAxis(boneAxes, "leftLeg", "LeftLeg");
    expect(knee[0]).toBeCloseTo(-1, 4);
    expect(readHingeAxis(boneAxes, "leftArm", "LeftArm")).toEqual([0, 0, 1]);
    const lower = readLowerArmAxis(boneAxes, "leftArm", "LeftArm");
    expect(lower[0]).toBeCloseTo(0.9948, 3);
    expect(readHingeAxis(boneAxes, "rightForeArm", "mixamorigRightForeArm")).toEqual([0, 0, -1]);
    expect(readHingeAxis(boneAxes, "rightArm", "RightArm")).toBeNull();
  });

  it("reads the rest-pose arm angle", () => {
    expect(readArmRestAngle({ upperArmAngleBelowHorizontalDeg: { left: 59.3 } }, "left")).toBe(59.3);
    expect(readArmRestAngle({}, "left")).toBeNull();
  });
});

describe("the National Assembly avatar sidecar", () => {
  it("resolves every logical bone and every limb axis", async () => {
    const { default: sidecar } = await import("./national-assembly/assets/avatar.json");
    const result = resolveAvatarBones(sidecar.allJoints, sidecar);
    expect(result.missing).toEqual([]);
    expect(result.bones.spine).toEqual(["Spine", "Spine1", "Spine2"]);
    expect(result.yawDeg).toBe(0);
    expect(result.heightM).toBeCloseTo(1.861, 3);
    for (const side of ["left", "right"]) {
      for (const part of ["UpLeg", "Leg", "Foot", "Arm", "ForeArm"]) {
        const logical = `${side}${part}`;
        expect(readHingeAxis(sidecar.boneAxes, logical, result.bones[logical])).not.toBeNull();
      }
      expect(readLowerArmAxis(sidecar.boneAxes, `${side}Arm`, result.bones[`${side}Arm`])).not.toBeNull();
      expect(readArmRestAngle(sidecar, side)).toBeCloseTo(59.3, 1);
    }
  });
});
