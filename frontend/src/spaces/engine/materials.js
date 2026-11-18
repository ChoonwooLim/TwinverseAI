// Scene preparation for walkable spaces: per-surface material tweaks, animated water, waving
// flags, glass, foliage wind and instancing of repeated meshes. Built on the r187 node library.
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshPhysicalNodeMaterial,
  Vector3,
} from "three/webgpu";
import {
  cameraPosition,
  cameraViewMatrix,
  cos,
  dot,
  float,
  max,
  mx_noise_float,
  normalLocal,
  normalize,
  positionGeometry,
  positionLocal,
  positionWorld,
  pow,
  sin,
  uv,
  vec3,
  vec4,
} from "three/tsl";

/** Name prefixes the asset contract uses. */
export const SURFACE = {
  water: "Water_",
  flag: "Flag_",
  lawn: "Lawn_",
  paving: "Paving_",
  road: "Road_",
  bed: "Bed_",
  fountain: "Fountain_",
  interior: "Interior_",
};

/** Share of the sky light an enclosed interior (the lobby shell behind the glazing) still gets. */
const INTERIOR_ENVIRONMENT = 0.2;

/** SSR strength written to the MRT per surface (read via `material.userData.ssrStrength`). */
const SSR_STRENGTH = { glass: 0.5, paving: 0.15 };

/** Walks up the hierarchy and returns true when this object or an ancestor starts with `prefix`. */
export function hasPrefix(object, prefix, stopAt = null) {
  for (let node = object; node && node !== stopAt; node = node.parent) {
    if (typeof node.name === "string" && node.name.startsWith(prefix)) return true;
  }
  return false;
}

const isGlassMaterial = (material) =>
  /glass/i.test(material?.name ?? "") || (material?.transmission ?? 0) > 0;

function materialList(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function forEachTexture(material, callback) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) callback(value);
  }
}

/**
 * In r187 `envMapIntensity` only applies when the material has its own `envMap`; with just
 * `scene.environment` the scene-wide intensity wins. Surfaces that need their own reflection
 * strength therefore get the same HDR as an explicit envMap (same PMREM, same rotation).
 */
function applyEnvironment(material, environment, intensity) {
  if (!environment?.texture) return;
  material.envMap = environment.texture;
  material.envMapIntensity = intensity;
  material.envMapRotation?.set(0, environment.rotation ?? 0, 0);
}

// ── Animated water ──────────────────────────────────────────────

const WAVES = [
  // direction x, direction z, wavelength (m), amplitude (m), speed (m/s)
  [1.0, 0.2, 2.8, 0.010, 0.9],
  [-0.4, 1.0, 1.7, 0.007, 0.7],
  [0.7, -0.7, 0.9, 0.004, 0.55],
  [-0.9, -0.3, 0.55, 0.0025, 0.4],
];

/** World-space ripple normal from a sum of travelling sine waves plus a little noise. */
function rippleNormal(time) {
  const p = positionWorld.xz;
  let dx = float(0);
  let dz = float(0);
  for (const [ax, az, wavelength, amplitude, speed] of WAVES) {
    const length = Math.hypot(ax, az);
    const kx = (ax / length) * ((Math.PI * 2) / wavelength);
    const kz = (az / length) * ((Math.PI * 2) / wavelength);
    const omega = ((Math.PI * 2) / wavelength) * speed;
    const phase = p.x.mul(kx).add(p.y.mul(kz)).sub(time.mul(omega));
    const slope = cos(phase).mul(amplitude);
    dx = dx.add(slope.mul(kx));
    dz = dz.add(slope.mul(kz));
  }
  const breakup = mx_noise_float(vec3(p.mul(1.7), time.mul(0.35))).mul(0.06);
  return normalize(vec3(dx.add(breakup).negate(), float(1), dz.sub(breakup).negate()));
}

/**
 * Water for every `Water_*` mesh. With a reflector node (planar reflection of the scene) the
 * mirrored image is added through the emissive channel with a Schlick Fresnel term and the
 * environment reflection is turned down so the sky is not counted twice.
 */
export function createWaterMaterial({ time, reflectorNode = null, environment = null, reflectionMix = null }) {
  const material = new MeshPhysicalNodeMaterial({
    color: new Color(0x1f3d44),
    roughness: 0.03,
    metalness: 0,
    ior: 1.333,
  });
  material.name = reflectorNode ? "Water (planar reflection)" : "Water";
  const normalWorldWater = rippleNormal(time);
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(normalWorldWater, 0)).xyz);
  if (reflectorNode) {
    reflectorNode.uvNode = reflectorNode.uvNode.add(normalWorldWater.xz.mul(0.035));
    const viewDirection = normalize(cameraPosition.sub(positionWorld));
    const cosTheta = max(dot(viewDirection, normalWorldWater), 0);
    const fresnel = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosTheta), 5)));
    // reflectionMix (0..1) fades the reflection in and out; the engine raises the environment
    // reflection as it fades, so the water never goes dark.
    material.emissiveNode = reflectionMix ? reflectorNode.rgb.mul(fresnel).mul(reflectionMix) : reflectorNode.rgb.mul(fresnel);
    applyEnvironment(material, environment, 0.12);
  }
  material.userData.ssrStrength = 0;
  return material;
}

// ── Flags ───────────────────────────────────────────────────────

/** Flag cloth: waves travel from the pole (uv.x = 0) to the free edge, displacing along the normal. */
function applyFlagWave(material, mesh, { time, windStrength }) {
  const hasUV = Boolean(mesh.geometry?.attributes?.uv);
  let along;
  if (hasUV) {
    along = uv().x;
  } else {
    // No UVs: use the longer horizontal extent of the bounding box, pole assumed at its min side.
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    const useX = box.max.x - box.min.x >= box.max.z - box.min.z;
    const min = useX ? box.min.x : box.min.z;
    const size = Math.max(1e-3, useX ? box.max.x - box.min.x : box.max.z - box.min.z);
    along = (useX ? positionGeometry.x : positionGeometry.z).sub(min).div(size).clamp(0, 1);
  }
  mesh.geometry.computeBoundingBox();
  const span = mesh.geometry.boundingBox.getSize(new Vector3());
  const length = Math.max(0.5, Math.max(span.x, span.z));
  const wave = sin(along.mul(9).sub(time.mul(5.5)))
    .add(sin(along.mul(17).sub(time.mul(8.3))).mul(0.35));
  const amplitude = along.mul(along).mul(length * 0.09).mul(windStrength);
  material.positionNode = positionLocal.add(normalLocal.mul(wave.mul(amplitude)));
  material.side = DoubleSide;
}

// ── Foliage wind ────────────────────────────────────────────────

/**
 * Wind sway for vegetation: displacement grows with the square of the height above the plant's
 * base (positionGeometry.y, metres, before instancing) so trunks stay planted, and alpha-clipped
 * leaves get an extra flutter. Phase varies with the instance's world position.
 */
export function applyFoliageWind(material, { time, windStrength }) {
  const height = positionGeometry.y.max(0);
  const place = positionLocal.xz;
  const gust = sin(time.mul(0.9).add(place.x.mul(0.07)).add(place.y.mul(0.05)))
    .mul(0.6)
    .add(sin(time.mul(2.1).add(place.x.mul(0.21))).mul(0.25))
    .add(0.35);
  const sway = height.div(10).pow(2).min(1.5).mul(0.22).mul(gust).mul(windStrength);
  let offset = vec3(sway.mul(0.8), float(0), sway.mul(0.45));
  if ((material.alphaTest ?? 0) > 0 || material.transparent) {
    const flutter = sin(time.mul(7.3).add(positionGeometry.x.mul(3.1)).add(positionGeometry.z.mul(2.7)))
      .mul(height.min(1).mul(0.018))
      .mul(windStrength);
    offset = offset.add(vec3(flutter, flutter.mul(0.4), flutter.mul(-0.6)));
  }
  material.positionNode = positionLocal.add(offset);
}

// ── Glass ───────────────────────────────────────────────────────

/** Opaque architectural glass: dark body, sharp clear-coated reflections of the environment. */
function createGlassMaterial(source, environment) {
  const tint = source?.color ? source.color.clone() : new Color(0xbfd4dc);
  const material = new MeshPhysicalNodeMaterial({
    color: tint.multiplyScalar(0.18),
    metalness: 0,
    roughness: Math.min(source?.roughness ?? 0.05, 0.06),
    ior: 1.52,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    side: source?.side ?? 0,
  });
  material.name = `${source?.name || "Glass"} (physical)`;
  if (source?.normalMap) material.normalMap = source.normalMap;
  applyEnvironment(material, environment, 1.5);
  material.userData.ssrStrength = SSR_STRENGTH.glass;
  return material;
}

// ── Instancing ──────────────────────────────────────────────────

/**
 * Replaces groups of plain meshes that share geometry and material with one InstancedMesh.
 * @returns {number} number of meshes merged into instances
 */
export function instanceRepeatedMeshes(root, { minCount = 3, skip = () => false } = {}) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    if (Array.isArray(object.material) || skip(object)) return;
    if (object.morphTargetInfluences?.length) return;
    const key = `${object.geometry.uuid}|${object.material.uuid}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(object);
  });
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const local = new Matrix4();
  let merged = 0;
  for (const meshes of groups.values()) {
    if (meshes.length < minCount) continue;
    const first = meshes[0];
    const instanced = new InstancedMesh(first.geometry, first.material, meshes.length);
    instanced.name = `${first.name || "mesh"} x${meshes.length}`;
    instanced.castShadow = first.castShadow;
    instanced.receiveShadow = first.receiveShadow;
    if (first.userData?.cameraBlocks !== undefined) instanced.userData.cameraBlocks = first.userData.cameraBlocks;
    meshes.forEach((mesh, index) => {
      local.multiplyMatrices(rootInverse, mesh.matrixWorld);
      instanced.setMatrixAt(index, local);
      mesh.parent?.remove(mesh);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingBox();
    instanced.computeBoundingSphere();
    root.add(instanced);
    merged += meshes.length;
  }
  return merged;
}

// ── Scene preparation ───────────────────────────────────────────

/**
 * Prepares a loaded glTF scene in place.
 * @param {import("three/webgpu").Object3D} root
 * @param {{ renderer: any, time: any, windStrength: any, foliage?: boolean,
 *   environment?: { texture: any, rotation: number } }} context
 * @returns {{ water: any[], fountains: any[], flags: number, glass: number, instanced: number, disposables: any[] }}
 */
export function prepareScene(root, { renderer, time, windStrength, foliage = false, environment = null }) {
  const maxAnisotropy = Math.min(16, renderer.getMaxAnisotropy?.() ?? 1);
  const water = [];
  const fountains = [];
  const disposables = [];
  const converted = new Map();
  const glassMaterials = new Map();
  let flags = 0;
  let glass = 0;

  const toNodeMaterial = (material) => {
    let node = converted.get(material);
    if (!node) {
      node = material.isNodeMaterial ? material : renderer.library.fromMaterial(material);
      converted.set(material, node);
      if (node !== material) disposables.push(node);
    }
    return node;
  };

  root.traverse((object) => {
    if (typeof object.name === "string" && object.name.startsWith(SURFACE.fountain)) fountains.push(object);
    if (!object.isMesh) return;

    for (const material of materialList(object)) {
      if (!material) continue;
      material.userData = material.userData ?? {};
      if (material.userData.ssrStrength === undefined) material.userData.ssrStrength = 0;
      forEachTexture(material, (texture) => {
        texture.anisotropy = maxAnisotropy;
      });
    }

    // Water, flags, lawns and planting beds never stop the camera (cameraCollision.js).
    if ([SURFACE.water, SURFACE.flag, SURFACE.lawn, SURFACE.bed].some((prefix) => hasPrefix(object, prefix, root))) {
      object.userData.cameraBlocks = false;
    }

    // The dark lobby shell behind the glazing: never stops the camera and throws no shadow (it is
    // enclosed); it still receives shadows, so sun through an opening cannot light it up, and gets
    // little of the sky light it could not see.
    if (hasPrefix(object, SURFACE.interior, root)) {
      object.userData.cameraBlocks = false;
      object.castShadow = false;
      object.receiveShadow = true;
      for (const material of materialList(object)) {
        if (material && "envMapIntensity" in material) material.envMapIntensity = Math.min(material.envMapIntensity ?? 1, INTERIOR_ENVIRONMENT);
      }
      return;
    }

    if (hasPrefix(object, SURFACE.water, root)) {
      object.castShadow = false;
      object.receiveShadow = true;
      water.push(object);
      return;
    }

    const isGround = [SURFACE.lawn, SURFACE.paving, SURFACE.road, SURFACE.bed].some((prefix) => hasPrefix(object, prefix, root));
    // Ground pieces never throw a visible shadow; skipping them keeps the shadow pass cheap.
    object.castShadow = !isGround;
    object.receiveShadow = true;

    if (hasPrefix(object, SURFACE.lawn, root)) {
      for (const material of materialList(object)) {
        if (!material || material.isNodeMaterial) continue;
        if ("roughness" in material) material.roughness = Math.max(material.roughness ?? 1, 0.92);
        applyEnvironment(material, environment, 0.7);
      }
    } else if (hasPrefix(object, SURFACE.paving, root)) {
      for (const material of materialList(object)) {
        if (material) material.userData.ssrStrength = SSR_STRENGTH.paving;
      }
    }

    if (!Array.isArray(object.material) && isGlassMaterial(object.material)) {
      let replacement = glassMaterials.get(object.material);
      if (!replacement) {
        replacement = createGlassMaterial(object.material, environment);
        glassMaterials.set(object.material, replacement);
        disposables.push(replacement);
      }
      object.material = replacement;
      glass++;
      return;
    }

    if (hasPrefix(object, SURFACE.flag, root) && !Array.isArray(object.material)) {
      // Each flag gets its own node material (converted from the glTF material, which keeps its
      // textures) so its wave can use its own size.
      const source = object.material;
      const flagMaterial = source.isNodeMaterial ? source : renderer.library.fromMaterial(source);
      flagMaterial.userData = { ...(source.userData ?? {}) };
      applyFlagWave(flagMaterial, object, { time, windStrength });
      if (flagMaterial !== source) disposables.push(flagMaterial);
      object.material = flagMaterial;
      object.castShadow = true;
      flags++;
      return;
    }

    if (foliage && !isGround && !Array.isArray(object.material)) {
      const node = toNodeMaterial(object.material);
      if (!node.userData.windApplied) {
        applyFoliageWind(node, { time, windStrength });
        node.userData.windApplied = true;
      }
      object.material = node;
    }
  });

  const instanced = instanceRepeatedMeshes(root, {
    skip: (mesh) => hasPrefix(mesh, SURFACE.water, root) || hasPrefix(mesh, SURFACE.flag, root),
  });

  return { water, fountains, flags, glass, instanced, disposables };
}

/**
 * Static placed scenery (e.g. statues): shadows on, texture anisotropy as for the building, the
 * scene environment for lighting. No renaming rules, no instancing, no wind. The glTF occlusion map
 * on the second UV set is used by three.js as loaded (texture.channel).
 */
export function prepareStaticScenery(root, { renderer }) {
  const maxAnisotropy = Math.min(16, renderer.getMaxAnisotropy?.() ?? 1);
  let meshes = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    object.castShadow = true;
    object.receiveShadow = true;
    for (const material of materialList(object)) {
      if (!material) continue;
      material.userData = material.userData ?? {};
      if (material.userData.ssrStrength === undefined) material.userData.ssrStrength = 0;
      // Materials stay as authored (painted timber, roof tiles, double-sided and alpha-clipped
      // parts). Alpha-clipped cards (lattice, fringes) are thin, so they cast from both sides.
      if (material.alphaTest > 0 && material.side !== DoubleSide && material.shadowSide == null) material.shadowSide = DoubleSide;
      forEachTexture(material, (texture) => {
        texture.anisotropy = maxAnisotropy;
      });
    }
  });
  return { meshes };
}

/**
 * Wraps a scenery root in a group placed by a scenery.json entry ({ position: [x, y, z],
 * yawDeg }, any yaw); without an entry the root is returned as it is.
 */
export function placeScenery(root, placement, name) {
  if (!placement || typeof placement !== "object") return root;
  const holder = new Group();
  holder.name = `${name} (placed)`;
  const [px, py, pz] = Array.isArray(placement.position) ? placement.position : [];
  holder.position.set(Number(px) || 0, Number(py) || 0, Number(pz) || 0);
  holder.rotation.y = ((Number(placement.yawDeg) || 0) * Math.PI) / 180;
  holder.add(root);
  return holder;
}

/** Lowest point and top of a set of water meshes, used to place the planar reflector. */
export function waterLevel(meshes) {
  let top = -Infinity;
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    top = Math.max(top, box.max.y);
  }
  return Number.isFinite(top) ? top : 0;
}
