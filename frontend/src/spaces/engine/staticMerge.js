// Fewer draw calls for static scenery: meshes that share a material (and attribute layout, shadow
// flags and camera-collision tag) inside the same 60 m cell are merged into one mesh. The cell
// keeps per-mesh frustum culling worthwhile (a whole building is not one always-visible block).
// Skipped: instanced, skinned and morphing meshes, multi-material meshes, anything the caller marks
// (water, flags, fountains, moving door leaves). Quantized/interleaved attributes are expanded to
// plain floats first, so baking the placement into the vertices cannot clip them.
import { Box3, BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3 } from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LAYERS } from "./layers.js";

export const STATIC_MERGE = Object.freeze({
  cellM: 60,
});

const _box = new Box3();
const _centre = new Vector3();

function inherited(object, key) {
  for (let node = object; node; node = node.parent) {
    if (node.userData && node.userData[key] !== undefined) return node.userData[key];
  }
  return undefined;
}

/** Whether a mesh may be merged at all. */
export function mergeable(mesh, skip = () => false) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) return false;
  if (Array.isArray(mesh.material) || !mesh.material) return false;
  const geometry = mesh.geometry;
  if (!geometry?.attributes?.position || Object.keys(geometry.morphAttributes ?? {}).length) return false;
  if (inherited(mesh, "cameraDynamic")) return false;
  // A mirrored placement would flip the winding once baked.
  if (mesh.matrixWorld.determinant() < 0) return false;
  return !skip(mesh);
}

function signature(geometry) {
  return Object.keys(geometry.attributes)
    .sort()
    .map((name) => `${name}:${geometry.attributes[name].itemSize}`)
    .join(",");
}

/** A float, non-interleaved, indexed copy with `matrix` applied (normals and tangents too). */
export function bakedGeometry(geometry, matrix) {
  const out = new BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const { itemSize, count } = attribute;
    const array = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < itemSize; k++) array[i * itemSize + k] = attribute.getComponent(i, k);
    }
    out.setAttribute(name, new BufferAttribute(array, itemSize));
  }
  const count = geometry.attributes.position.count;
  const index = geometry.index;
  const indices = new Uint32Array(index ? index.count : count);
  for (let i = 0; i < indices.length; i++) indices[i] = index ? index.getX(i) : i;
  out.setIndex(new BufferAttribute(indices, 1));
  out.applyMatrix4(matrix);
  return out;
}

/**
 * Merges static meshes below `root` (a generator: it yields after each merged group so a large
 * file can be merged across frames). Returns { before, after } mesh counts.
 * @param {import("three/webgpu").Object3D} root
 * @param {{ skip?: (mesh) => boolean }} [options]
 */
export function* mergeStaticMeshes(root, { skip = () => false } = {}) {
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  let before = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    before++;
    if (!mergeable(object, skip)) return;
    _box.setFromObject(object);
    _box.getCenter(_centre);
    const cell = `${Math.floor(_centre.x / STATIC_MERGE.cellM)},${Math.floor(_centre.z / STATIC_MERGE.cellM)}`;
    const key = [
      object.material.uuid,
      signature(object.geometry),
      object.castShadow,
      object.receiveShadow,
      inherited(object, "cameraBlocks") === false,
      cell,
    ].join("|");
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(object);
  });

  let merged = 0;
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const local = new Matrix4();
    const baked = meshes.map((mesh) => bakedGeometry(mesh.geometry, local.multiplyMatrices(rootInverse, mesh.matrixWorld)));
    const geometry = mergeGeometries(baked, false);
    for (const part of baked) part.dispose();
    if (!geometry) continue;
    const first = meshes[0];
    const mesh = new Mesh(geometry, first.material);
    mesh.name = `${first.material.name || first.name || "merged"} x${meshes.length}`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    if (inherited(first, "cameraBlocks") === false) mesh.userData.cameraBlocks = false;
    for (const original of meshes) {
      original.removeFromParent();
      original.geometry.dispose();
    }
    root.add(mesh);
    merged += meshes.length - 1;
    yield;
  }
  return { before, after: before - merged };
}

/** Runs mergeStaticMeshes to the end at once. */
export function mergeStaticMeshesNow(root, options) {
  const job = mergeStaticMeshes(root, options);
  let step = job.next();
  while (!step.done) step = job.next();
  return step.value;
}

/**
 * Standing meshes (shadow casters, so not flat ground) whose bounds come within `maxDistance` of
 * the water join the reflectable layer; the reflector draws only that layer (and its vegetation).
 * @param {import("three/webgpu").Box3 | null} waterBox world bounds of the water surfaces
 */
export function markReflectable(root, waterBox, maxDistance = 150) {
  if (!waterBox || waterBox.isEmpty()) return 0;
  root.updateWorldMatrix(true, true);
  let count = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.castShadow) return;
    _box.setFromObject(object);
    const dx = Math.max(waterBox.min.x - _box.max.x, 0, _box.min.x - waterBox.max.x);
    const dz = Math.max(waterBox.min.z - _box.max.z, 0, _box.min.z - waterBox.max.z);
    if (Math.hypot(dx, dz) <= maxDistance) {
      object.layers.enable(LAYERS.reflectable);
      count++;
    }
  });
  return count;
}
