import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Points,
  Sprite,
  Vector3,
} from "three/webgpu";
import { CameraCollider, cameraBlockerKind } from "./cameraCollision";

const solid = () => new MeshStandardMaterial();
const finish = (collider) => {
  while (collider.building) collider.build(1000);
};

describe("what blocks the camera", () => {
  it("registers solid architecture only", () => {
    const root = new Group();
    const wall = new Mesh(new BoxGeometry(10, 5, 0.5), solid());
    wall.name = "Wall";
    const water = new Mesh(new BoxGeometry(10, 0.1, 10), solid());
    water.userData.cameraBlocks = false; // tagged by prepareScene (Water_, Flag_, Lawn_, Bed_)
    const lawnGroup = new Group();
    lawnGroup.userData.cameraBlocks = false;
    lawnGroup.add(new Mesh(new BoxGeometry(5, 0.1, 5), solid()));
    const glassy = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial({ transparent: true, opacity: 0.5 }));
    const lampPost = new Mesh(new BoxGeometry(0.15, 4, 0.15), solid());
    const sprite = new Sprite();
    const points = new Points(new BoxGeometry(1, 1, 1));
    root.add(wall, water, lawnGroup, glassy, lampPost, sprite, points);

    expect(cameraBlockerKind(wall)).toBe("static");
    for (const object of [water, lawnGroup.children[0], glassy, lampPost, sprite, points]) {
      expect(cameraBlockerKind(object)).toBeNull();
    }
    const collider = new CameraCollider();
    expect(collider.addRoot(root)).toBe(1);
    expect(collider.entries[0].mesh).toBe(wall);
  });

  it("casts against placed, instanced, quantized-interleaved and moving meshes", () => {
    const root = new Group();
    // Wall 1: a plain box placed 5 m ahead.
    const wall = new Mesh(new BoxGeometry(4, 4, 0.2), solid());
    wall.position.set(0, 2, 5);
    // Wall 2: an InstancedMesh with one instance 8 m to the side.
    const instanced = new InstancedMesh(new BoxGeometry(4, 4, 0.2), solid(), 1);
    instanced.setMatrixAt(0, new Matrix4().makeTranslation(20, 2, 5));
    // Wall 3: quantized positions in an interleaved int16 buffer with a node scale (like gltfpack).
    const quantized = new BufferGeometry();
    const raw = new Int16Array([-32767, 0, 0, 0, 32767, 0, 0, 0, 32767, 32767, 0, 0, -32767, 32767, 0, 0]);
    quantized.setAttribute("position", new InterleavedBufferAttribute(new InterleavedBuffer(raw, 4), 3, 0, true));
    quantized.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    const plate = new Mesh(quantized, solid());
    plate.scale.set(2, 4, 1);
    plate.position.set(-20, 0, 5);
    // A door leaf that swings.
    const leaf = new Group();
    leaf.userData.cameraDynamic = true;
    leaf.position.set(40, 0, 0);
    leaf.add(new Mesh(new BoxGeometry(2, 3, 0.2).translate(1, 1.5, 0), solid()));
    root.add(wall, instanced, plate, leaf);

    const collider = new CameraCollider();
    expect(collider.addRoot(root)).toBe(4);
    expect(collider.entries.find((e) => e.kind === "dynamic").mesh.parent).toBe(leaf);
    finish(collider);
    expect(collider.readyCount).toBe(4);

    const cast = (x, z0, z1) => collider.castRays([{ origin: new Vector3(x, 1.5, z0), end: new Vector3(x, 1.5, z1) }])[0];
    expect(cast(0, 0, 10)).toBeCloseTo(4.9, 4);
    expect(cast(20, 0, 10)).toBeCloseTo(4.9, 4);
    expect(cast(-20, 0, 10)).toBeCloseTo(5, 3);
    expect(cast(41, -5, 5)).toBeCloseTo(4.9, 4); // the closed leaf
    leaf.rotation.y = -Math.PI / 2; // swung open
    leaf.updateMatrixWorld(true);
    expect(cast(41, -5, 5)).toBe(Infinity);
    expect(collider.triangles).toBeGreaterThan(30);
  });

  it("registers placed and quantized scenery in world space even before any render updated the placement", () => {
    const holder = new Group();
    holder.position.set(0, -1.5, 300);
    holder.rotation.y = Math.PI / 2;
    const file = new Group(); // a loaded glTF scene
    holder.add(file);
    const block = new Mesh(new BoxGeometry(4, 4, 4), solid());
    block.position.set(5, 2, 0);
    // A quantized plate as gltfpack writes it: normalized int16 with the dequantization in the node.
    const quantized = new BufferGeometry();
    const raw = new Int16Array([-32767, 0, 0, 0, 32767, 0, 0, 0, 32767, 32767, 0, 0, -32767, 32767, 0, 0]);
    quantized.setAttribute("position", new InterleavedBufferAttribute(new InterleavedBuffer(raw, 4), 3, 0, true));
    quantized.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    const plate = new Mesh(quantized, solid());
    plate.scale.set(3, 3, 1);
    plate.position.set(-5, 0, 0);
    file.add(block, plate);
    // holder.matrixWorld is still identity here: nothing has rendered.
    const collider = new CameraCollider();
    collider.addRoot(file);
    finish(collider);
    const cast = (from, to) => collider.castRays([{ origin: new Vector3(...from), end: new Vector3(...to) }])[0];
    // The block's world centre: holder (0, -1.5, 300) turned 90 degrees, so local +X is world -Z.
    expect(Number.isFinite(cast([-10, 0.5, 295], [10, 0.5, 295]))).toBe(true);
    // Through its local-space location nothing is there.
    expect(cast([-10, 2, 0], [10, 2, 0])).toBe(Infinity);
    // The plate (a quad in its local XY plane): turned, it stands in the world plane x = 0,
    // spanning z 302..308 and y -1.5..1.5.
    expect(Number.isFinite(cast([-5, 0, 305], [5, 0, 305]))).toBe(true);
    expect(cast([-5, 1, -10], [-5, 1, 10])).toBe(Infinity);
  });
});
