// Node-level handling of placed scenery: hiding named nodes, binding door leaves to the pure door
// logic (../doors.js), and splitting a loaded file into upload and reveal steps.
import { PropertyBinding, Quaternion, Vector3 } from "three/webgpu";
import { createDoor, doorError, leafFractions } from "../doors";

const UP = new Vector3(0, 1, 0);
const _q = new Quaternion();

/** Node names as GLTFLoader stores them (spaces to underscores, reserved characters removed). */
export const sanitizeNodeName = (name) => PropertyBinding.sanitizeNodeName(String(name ?? ""));

const materialList = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** First node below `root` (or root itself) whose name equals `name` after sanitising. */
export function findNode(root, name) {
  const wanted = sanitizeNodeName(name);
  if (!wanted) return null;
  let found = null;
  root.traverse((object) => {
    if (!found && object.name === wanted) found = object;
  });
  return found;
}

/**
 * Removes every node whose name matches an entry of `names` (exact, after sanitising), with its
 * children, so it neither draws nor casts shadows.
 * @returns {{ removed: number, missing: string[] }}
 */
export function hideNodes(root, names) {
  const list = Array.isArray(names) ? names.filter((name) => typeof name === "string" && name) : [];
  if (!list.length) return { removed: 0, missing: [] };
  const wanted = new Set(list.map(sanitizeNodeName));
  const matches = [];
  root.traverse((object) => {
    if (object !== root && wanted.has(object.name)) matches.push(object);
  });
  for (const object of matches) object.removeFromParent();
  const seen = new Set(matches.map((object) => object.name));
  return { removed: matches.length, missing: list.filter((name) => !seen.has(sanitizeNodeName(name))) };
}

/**
 * Binds the doors of a placement entry to their leaf nodes. A missing leaf is skipped with a
 * warning (its door still blocks and opens); an invalid door is skipped with a warning.
 * @returns {{ doors: object[], warnings: string[] }}
 */
export function bindDoors(root, placement, file) {
  const specs = Array.isArray(placement?.doors) ? placement.doors : [];
  const doors = [];
  const warnings = [];
  for (const [index, spec] of specs.entries()) {
    const label = `${file}: door ${spec?.name ?? index + 1}`;
    const error = doorError(spec);
    if (error) {
      warnings.push(`${label} ignored: ${error}.`);
      continue;
    }
    const leaves = [];
    for (const leaf of spec.leaves ?? []) {
      const object = findNode(root, leaf?.node);
      if (!object) {
        warnings.push(`${label}: leaf node ${leaf?.node} not found; that leaf is skipped.`);
        continue;
      }
      if (object.isInstancedMesh || object.isBatchedMesh) {
        warnings.push(`${label}: leaf node ${leaf.node} is instanced and cannot swing; that leaf is skipped.`);
        continue;
      }
      object.userData.cameraDynamic = true; // the camera collision casts against its current pose
      leaves.push({ node: leaf.node, openYawDeg: Number(leaf.openYawDeg) || 0, object, base: object.quaternion.clone(), angle: null });
    }
    const door = createDoor(spec, placement, { leaves: leaves.map(({ node, openYawDeg }) => ({ node, openYawDeg })) });
    if (door.approximate) warnings.push(`${label}: the placement yaw is not a right angle, so the blocker is the box around the turned one.`);
    const binding = { door, leaves, file };
    applyDoorPose(binding, false);
    doors.push(binding);
  }
  return { doors, warnings };
}

/**
 * Turns each leaf about its local +Y to the door's current open fraction. Leaves keep
 * `matrixAutoUpdate` off: their matrices are recomputed only on frames where the angle changed,
 * so they are not touched at rest. Shadows, SSR and motion vectors read the world matrices that
 * the renderer updates each frame, so they follow the swing.
 */
export function applyDoorPose(binding, reducedMotion) {
  const fractions = leafFractions(binding.door, reducedMotion);
  binding.leaves.forEach((leaf, i) => {
    const angle = (fractions[i] ?? 0) * leaf.openYawDeg * (Math.PI / 180);
    if (leaf.angle === angle) return;
    leaf.angle = angle;
    leaf.object.quaternion.copy(leaf.base).multiply(_q.setFromAxisAngle(UP, angle));
    leaf.object.matrixAutoUpdate = false;
    leaf.object.updateMatrix();
  });
}

/** Distinct textures used by the meshes below `root`. */
export function collectTextures(root) {
  const textures = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of materialList(object)) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value && value.isTexture) textures.add(value);
      }
    }
  });
  return [...textures];
}

/**
 * Meshes below `root` in reveal batches: a new batch starts at each mesh that brings a material
 * not seen before, so each batch compiles about one new material.
 */
export function revealBatches(root) {
  const batches = [];
  const seen = new Set();
  let current = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const fresh = materialList(object).filter((material) => material && !seen.has(material));
    if (fresh.length && current.length) {
      batches.push(current);
      current = [];
    }
    for (const material of fresh) seen.add(material);
    current.push(object);
  });
  if (current.length) batches.push(current);
  return batches;
}
