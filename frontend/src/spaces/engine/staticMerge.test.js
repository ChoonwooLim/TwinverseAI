import { describe, expect, it } from "vitest";
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three/webgpu";
import { LAYERS, allCascadesMask, cascadeLayer, cascadeLayerMasks } from "./layers";
import { markReflectable, mergeStaticMeshesNow } from "./staticMerge";

describe("merging static meshes", () => {
  it("merges meshes that share a material in a cell, and leaves the rest alone", () => {
    const stone = new MeshStandardMaterial({ name: "Stone" });
    const wood = new MeshStandardMaterial({ name: "Wood" });
    const root = new Group();
    root.position.set(0, -1.5, 300); // a placed scenery file
    const a = new Mesh(new BoxGeometry(1, 1, 1), stone);
    a.position.set(5, 0.5, 0);
    const b = new Mesh(new BoxGeometry(1, 1, 1), stone);
    b.position.set(15, 0.5, 0);
    b.castShadow = a.castShadow = true;
    const c = new Mesh(new BoxGeometry(1, 1, 1), wood);
    const far = new Mesh(new BoxGeometry(1, 1, 1), stone);
    far.position.set(500, 0, 0); // another cell
    const water = new Mesh(new BoxGeometry(4, 0.1, 4), stone);
    water.name = "Water_01";
    const leaf = new Group();
    leaf.userData.cameraDynamic = true; // a door leaf
    leaf.add(new Mesh(new BoxGeometry(1, 2, 0.1), stone));
    const leafTwin = new Mesh(new BoxGeometry(1, 2, 0.1), stone);
    leaf.add(leafTwin);
    root.add(a, b, c, far, water, leaf);

    const before = new Box3().setFromObject(root);
    const result = mergeStaticMeshesNow(root, { skip: (mesh) => mesh.name.startsWith("Water_") });
    expect(result.before).toBe(7);
    expect(result.after).toBe(6); // a + b became one
    const merged = root.children.find((child) => child.name.startsWith("Stone x2"));
    expect(merged).toBeTruthy();
    expect(merged.castShadow).toBe(true);
    expect(root.children.includes(a) || root.children.includes(b)).toBe(false);
    expect(root.children.includes(water) && root.children.includes(c) && root.children.includes(far)).toBe(true);
    expect(leaf.children).toHaveLength(2); // never merged
    const after = new Box3().setFromObject(root);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-5);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-5);
  });

  it("expands quantized interleaved positions before baking, so nothing is clipped", () => {
    const material = new MeshStandardMaterial();
    const quantized = () => {
      const geometry = new BufferGeometry();
      const raw = new Int16Array([-32767, 0, 0, 0, 32767, 0, 0, 0, 0, 32767, 0, 0]);
      geometry.setAttribute("position", new InterleavedBufferAttribute(new InterleavedBuffer(raw, 4), 3, 0, true));
      geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
      return geometry;
    };
    const root = new Group();
    const one = new Mesh(quantized(), material);
    one.scale.set(10, 10, 1);
    const two = new Mesh(quantized(), material);
    two.scale.set(10, 10, 1);
    two.position.set(20, 0, 0);
    root.add(one, two);
    mergeStaticMeshesNow(root);
    const box = new Box3().setFromObject(root);
    expect(box.min.x).toBeCloseTo(-10, 3);
    expect(box.max.x).toBeCloseTo(30, 3);
    expect(box.max.y).toBeCloseTo(10, 3);
  });
});

describe("cascade layers and the reflection layer", () => {
  it("gives every cascade its own layer and vegetation only to the near ones", () => {
    const masks = cascadeLayerMasks([0, 76, 157, 270], { vegetationDistance: 120 });
    const has = (mask, layer) => Boolean(mask & (1 << layer));
    expect(masks.map((m) => has(m, LAYERS.vegetationShadow))).toEqual([true, true, false, false]);
    expect(masks.every((m) => !has(m, 0))).toBe(true); // casters come in through their cascade layers
    expect(masks.map((m, i) => has(m, cascadeLayer(i)))).toEqual([true, true, true, true]);
    expect(has(masks[0], cascadeLayer(1))).toBe(false);
    expect(masks.every((m) => !has(m, LAYERS.vegetationView) && !has(m, LAYERS.vegetationReflection))).toBe(true);
    expect(cascadeLayerMasks([0, 42], { vegetationDistance: 35 }).map((m) => has(m, LAYERS.vegetationShadow))).toEqual([true, false]);
    expect(allCascadesMask() & (1 << cascadeLayer(3))).toBeTruthy();
  });

  it("marks standing meshes near the water as reflectable", () => {
    const root = new Group();
    const near = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial());
    near.castShadow = true;
    near.position.set(0, 5, 80);
    const far = near.clone();
    far.position.set(0, 5, 900);
    const ground = new Mesh(new BoxGeometry(50, 0.1, 50), new MeshStandardMaterial());
    root.add(near, far, ground);
    const water = new Box3().setFromCenterAndSize(new Vector3(0, 0, 0), new Vector3(10, 0.2, 30));
    expect(markReflectable(root, water)).toBe(1);
    expect(near.layers.isEnabled(LAYERS.reflectable)).toBe(true);
    expect(ground.layers.isEnabled(LAYERS.reflectable)).toBe(false);
  });
});
