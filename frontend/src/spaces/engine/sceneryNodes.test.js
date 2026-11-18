import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Texture, Vector3 } from "three/webgpu";
import { placementTransform, updateDoor } from "../doors";
import { placeScenery } from "./materials";
import { applyDoorPose, bindDoors, collectTextures, findNode, hideNodes, revealBatches } from "./sceneryNodes";

function gateScene() {
  const root = new Group();
  const doors = new Group();
  doors.name = "SM_GHM_Gwanghwamun_Doors";
  const leafMesh = new Mesh(new BoxGeometry());
  leafMesh.name = "SM_GHM_Gwanghwamun_Doors_Mesh";
  doors.add(leafMesh);
  root.add(doors);
  for (const name of ["Door_C_Left", "Door_C_Right"]) {
    const leaf = new Group();
    leaf.name = name;
    leaf.add(new Mesh(new BoxGeometry(2.5, 6, 0.3).translate(name.endsWith("Left") ? 1.25 : -1.25, 3, 0)));
    root.add(leaf);
  }
  return root;
}

const DOOR = {
  name: "center",
  leaves: [{ node: "Door_C_Left", openYawDeg: -95 }, { node: "Door_C_Right", openYawDeg: 95 }],
  trigger: { x: 0, z: 3.4, radius: 9 },
  blocker: { minX: -2.5, maxX: 2.5, minZ: 3.1, maxZ: 3.7 },
};

describe("hiding scenery nodes", () => {
  it("removes the named node with its children and reports names it did not find", () => {
    const root = gateScene();
    const result = hideNodes(root, ["SM_GHM_Gwanghwamun_Doors", "Missing_Node"]);
    expect(result.removed).toBe(1);
    expect(result.missing).toEqual(["Missing_Node"]);
    expect(findNode(root, "SM_GHM_Gwanghwamun_Doors")).toBeNull();
    expect(findNode(root, "SM_GHM_Gwanghwamun_Doors_Mesh")).toBeNull();
    expect(findNode(root, "Door_C_Left")).not.toBeNull();
  });

  it("matches names after GLTFLoader's sanitising and ignores an empty list", () => {
    const root = new Group();
    const node = new Group();
    node.name = "Door_LeafA"; // stored by GLTFLoader for "Door Leaf.A"
    root.add(node);
    expect(hideNodes(root, ["Door Leaf.A"]).removed).toBe(1);
    expect(hideNodes(root, undefined)).toEqual({ removed: 0, missing: [] });
  });
});

describe("door leaves", () => {
  it("binds leaves, skips a missing one with a warning and swings about local +Y", () => {
    const root = gateScene();
    const placement = { position: [0, 0, 0], yawDeg: 0, doors: [{ ...DOOR, leaves: [...DOOR.leaves, { node: "Door_C_Gone", openYawDeg: 90 }] }] };
    const { doors, warnings } = bindDoors(root, placement, "scenery-gate-1.glb");
    expect(doors).toHaveLength(1);
    expect(doors[0].leaves.map((leaf) => leaf.node)).toEqual(["Door_C_Left", "Door_C_Right"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Door_C_Gone not found/);

    const binding = doors[0];
    const left = findNode(root, "Door_C_Left");
    expect(left.matrixAutoUpdate).toBe(false); // at rest nothing recomputes its matrix
    for (let i = 0; i < 120; i++) updateDoor(binding.door, 1 / 60, { visitor: { x: 0, z: 8 } });
    applyDoorPose(binding, false);
    expect(binding.door.phase).toBe("open");
    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (-95 * Math.PI) / 180);
    expect(left.quaternion.angleTo(expected)).toBeLessThan(1e-6);
    left.updateMatrixWorld(true);
    // The leaf's free end (local +X 2.5 m) swung round to the far side of the hinge line.
    const tip = new Vector3(2.5, 0, 0).applyMatrix4(left.matrixWorld);
    expect(tip.z).toBeGreaterThan(2.4);
    expect(left.isMesh).toBeFalsy();
    expect(findNode(root, "Door_C_Right").children[0].isInstancedMesh).toBeFalsy();
  });

  it("puts trigger and blocker where the placed model is, at every right-angle yaw", () => {
    for (const yawDeg of [0, 90, 180, 270]) {
      const placement = { position: [40, 0.2, -12], yawDeg };
      const root = new Group();
      const marker = new Group();
      marker.position.set(DOOR.trigger.x, 0, DOOR.trigger.z);
      root.add(marker);
      const holder = placeScenery(root, placement, "scenery-gate-1.glb");
      holder.updateMatrixWorld(true);
      const visual = new Vector3().setFromMatrixPosition(marker.matrixWorld);
      const logic = placementTransform(placement).toWorld(DOOR.trigger.x, DOOR.trigger.z);
      expect(visual.x).toBeCloseTo(logic.x, 9);
      expect(visual.z).toBeCloseTo(logic.z, 9);
    }
  });
});

describe("revealing a large file", () => {
  it("collects each texture once and starts a new reveal batch per new material", () => {
    const map = new Texture();
    const a = new MeshStandardMaterial({ map });
    const b = new MeshStandardMaterial({ map, normalMap: new Texture() });
    const root = new Group();
    for (const material of [a, a, b, a, b]) root.add(new Mesh(new BoxGeometry(), material));
    expect(collectTextures(root)).toHaveLength(2);
    expect(revealBatches(root).map((batch) => batch.length)).toEqual([2, 3]);
  });
});
