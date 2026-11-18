// Instanced, level-of-detail vegetation from vegetation-N.glb files and vegetation.json.
//
// Library nodes (`VegLib_<Species>_LOD<n>`, any number of levels, one mesh tree each at the
// origin) are taken out of the scene and rendered only through InstancedMeshes, in three sets:
//   view        one per species x LOD x part, layer vegetationView (main camera only); each frame's
//               selection writes only the instances inside the camera frustum and within the
//               species' draw distance, at their LOD (vegetationLod.js),
//   shadow      one per species x part at a cheap LOD (never an impostor), layer vegetationShadow:
//               instances within the species' castsShadowWithinM, capped by the preset's shadow
//               distance; the engine enables that layer only on the near shadow cascades,
//   reflection  one per species x part at the cheapest LOD, layer vegetationReflection: instances
//               within the preset's reflection distance, for the water reflector only.
// Small plants fade in by scale near their draw distance. A triangle budget shrinks the LOD and
// tree distances when a frame drew more than the preset allows. Leaf parts get a per-instance tint.
// Every other node in the files (Hedge_*, Bed_*, Shrubbery_* ...) is drawn as placed.
import { Box3, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3, WebGPUCoordinateSystem } from "three/webgpu";
import { applyFoliageWind, prepareScene } from "./materials";
import { LAYERS } from "./layers";
import { float } from "three/tsl";
import { CULLED, frustumPlanes, nextBudgetScale, sameMembers, selectVegetation, speciesMaxDistance, speciesWind } from "../vegetationLod";

export const LIBRARY_PREFIX = "VegLib_";
const UPDATE_EVERY_FRAMES = 3;
const STILL_M = 0.25;
const TURN_COS = Math.cos((1.5 * Math.PI) / 180);
const HYSTERESIS = 0.1;
const FADE_BAND = 0.15;
const TREE_HEIGHT_M = 4;
const MIN_TREE_DISTANCE_M = 120;
/** Shadow casters use LOD2 (or the last real level): a believable silhouette, never an impostor. */
const SHADOW_LOD = 2;
const TINT_LOW = [0.82, 0.87, 0.78];
const TINT_HIGH = [1.08, 1.06, 0.96];
const LEAF_NAME = /leaf|leaves|foliage|needle|frond|canopy/i;

const _matrix = new Matrix4();
const _quaternion = new Quaternion();
const _position = new Vector3();
const _scale = new Vector3();
const _up = new Vector3(0, 1, 0);
const _color = new Color();
const _direction = new Vector3();
const _viewProjection = new Matrix4();

function triangleCount(geometry) {
  return Math.round((geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0) / 3);
}

function isLeafMaterial(material) {
  return (material?.alphaTest ?? 0) > 0 || material?.transparent === true || LEAF_NAME.test(material?.name ?? "");
}

function validInstance(entry) {
  return Array.isArray(entry) && entry.length >= 3 && entry.slice(0, 6).every((v) => v === undefined || Number.isFinite(v));
}

export class VegetationSystem {
  /**
   * @param {{ renderer: any, time: any, windStrength: any, environment?: any, settings: object, triangleBudget?: number }} options
   *   settings: { lodScale, maxLod0, farDistance, smallPlantFactor, shadowDistance, shadowLod, reflectionDistance }
   */
  constructor({ renderer, time, windStrength, environment = null, settings, triangleBudget = 0 }) {
    this.renderer = renderer;
    this.time = time;
    this.windStrength = windStrength;
    this.environment = environment;
    this.settings = { ...settings };
    this.triangleBudget = triangleBudget;
    this.budgetScale = 1;
    this.shadowCascades = 1;
    this.priming = false;
    this.reflectionActive = false;
    this.group = new Group();
    this.group.name = "Vegetation";
    this.species = [];
    this.positions = new Float32Array(0);
    this.spheres = new Float32Array(0);
    this.groups = new Uint16Array(0);
    this.matrices = new Float32Array(0);
    this.tints = new Float32Array(0);
    this.previous = null;
    this.selection = null;
    this.frame = 0;
    this.lastCamera = null;
    this.lastDirection = new Vector3(0, 0, -1);
    this.dirty = true;
    this.materials = new Map();
    this.instancedMeshes = [];
  }

  /**
   * Node material for a library part. `wind` (0..1, per species) scales the foliage sway; 0 means
   * no wind node at all (rigid hedges, boulders, lamps, benches: cheaper shaders, still shadows).
   * Materials are shared per (source, wind), so species with different wind never share one.
   */
  nodeMaterial(source, wind = 1) {
    const key = `${source.uuid}|${wind}`;
    let material = this.materials.get(key);
    if (!material) {
      material = this.renderer.library.fromMaterial(source) ?? source;
      if (material === source && source.isNodeMaterial && wind > 0) material = source.clone();
      material.userData = { ...(source.userData ?? {}), ssrStrength: 0 };
      if (wind > 0) {
        const strength = wind < 1 ? this.windStrength.mul(float(wind)) : this.windStrength;
        applyFoliageWind(material, { time: this.time, windStrength: strength });
      }
      this.materials.set(key, material);
    }
    return material;
  }

  /**
   * Adds one vegetation file: builds the instanced species whose `file` matches and prepares the
   * placed (non-library) nodes. Returns what the engine needs for water and fountains.
   */
  addFile(fileName, gltf, manifest) {
    const root = gltf.scene;
    const library = new Map();
    root.traverse((object) => {
      if (typeof object.name === "string" && object.name.startsWith(LIBRARY_PREFIX) && !library.has(object.name)) {
        // Only the top-most library node counts; its own children are parts of it.
        let parent = object.parent;
        while (parent && !(typeof parent.name === "string" && parent.name.startsWith(LIBRARY_PREFIX))) parent = parent.parent;
        if (!parent) library.set(object.name, object);
      }
    });
    root.updateMatrixWorld(true);

    const added = [];
    const warnings = [];
    const speciesEntries = Object.entries(manifest?.species ?? {}).filter(([, entry]) => entry?.file === fileName);
    for (const [name, entry] of speciesEntries) {
      const lodNodes = (Array.isArray(entry.lods) ? entry.lods : []).map((lodName) => library.get(lodName)).filter(Boolean);
      if (!lodNodes.length) {
        warnings.push(`${name}: none of its LOD nodes are in ${fileName}`);
        continue;
      }
      const instances = (manifest.instances?.[name] ?? []).filter(validInstance);
      if (!instances.length) continue;
      added.push(this.addSpecies(name, entry, lodNodes, instances));
    }
    // Library nodes are never drawn where they were authored.
    for (const node of library.values()) node.removeFromParent();

    const prepared = prepareScene(root, {
      renderer: this.renderer,
      time: this.time,
      windStrength: this.windStrength,
      foliage: true,
      environment: this.environment,
    });
    this.group.add(root);
    this.dirty = true;
    return { prepared, species: added.map((s) => s.name), warnings };
  }

  addSpecies(name, entry, lodNodes, instances) {
    const index = this.species.length;
    const capacity = instances.length;
    const wind = speciesWind(entry);
    const distances = (Array.isArray(entry.lodDistancesM) ? entry.lodDistancesM : []).map(Number).filter((v) => v > 0);
    while (distances.length < lodNodes.length - 1) distances.push((distances[distances.length - 1] ?? 30) * 3);
    distances.length = Math.max(0, lodNodes.length - 1);
    const lods = lodNodes.map((node, lod) => {
      node.updateWorldMatrix(true, true);
      const nodeInverse = new Matrix4().copy(node.matrixWorld).invert();
      const parts = [];
      node.traverse((object) => {
        if (!object.isMesh) return;
        const partMatrix = new Matrix4().multiplyMatrices(nodeInverse, object.matrixWorld);
        const material = Array.isArray(object.material) ? object.material.map((m) => this.nodeMaterial(m, wind)) : this.nodeMaterial(object.material, wind);
        const leaf = Array.isArray(object.material) ? object.material.some(isLeafMaterial) : isLeafMaterial(object.material);
        const display = this.createInstancedMesh(object.geometry, material, capacity, `${name} LOD${lod}`, leaf, LAYERS.vegetationView);
        parts.push({ display, leaf, partMatrix, identity: partMatrix.equals(new Matrix4()), geometry: object.geometry, material });
      });
      return { parts, triangles: parts.reduce((sum, part) => sum + triangleCount(part.geometry), 0) };
    });
    // Bounding sphere of the most detailed level, relative to the library node's origin.
    const box = new Box3();
    lodNodes[0].updateWorldMatrix(true, true);
    const originInverse = new Matrix4().copy(lodNodes[0].matrixWorld).invert();
    lodNodes[0].traverse((object) => {
      if (!object.isMesh) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(object.geometry.boundingBox.clone().applyMatrix4(new Matrix4().multiplyMatrices(originInverse, object.matrixWorld)));
    });
    const sphere = box.isEmpty() ? new Sphere(new Vector3(0, 5, 0), 6) : box.getBoundingSphere(new Sphere());
    const height = Number(entry.heightM) > 0 ? Number(entry.heightM) : Math.max(0.1, box.max.y - box.min.y);
    const lodCount = lods.length;
    const species = {
      name,
      index,
      lods,
      lodCount,
      distances,
      height,
      tree: height >= TREE_HEIGHT_M,
      // A fourth level is the crossed-card impostor: never used for shadows.
      hasImpostor: lodCount >= 4,
      maxDistanceM: Number(entry.maxDistanceM) > 0 ? Number(entry.maxDistanceM) : null,
      // Caster range of its own (0 = never casts); without it the preset's shadow distance applies.
      castsShadowWithinM: Number.isFinite(Number(entry.castsShadowWithinM)) && entry.castsShadowWithinM !== null && Number(entry.castsShadowWithinM) >= 0
        ? Number(entry.castsShadowWithinM)
        : null,
      wind,
      capacity,
      first: this.groups.length,
      shadowParts: [],
      reflectionParts: [],
      lists: null,
      shadowList: null,
      reflectionList: null,
    };
    this.species.push(species);
    const tallest = instances.reduce((top, entryValues) => Math.max(top, height * (entryValues[4] > 0 ? entryValues[4] : 1)), 0);
    this.maxHeight = Math.max(this.maxHeight ?? 0, tallest);

    // Append the instances to the shared arrays.
    const n0 = this.groups.length;
    const n = n0 + capacity;
    const grow = (array, width, Type) => {
      const next = new Type(n * width);
      next.set(array);
      return next;
    };
    this.positions = grow(this.positions, 3, Float32Array);
    this.spheres = grow(this.spheres, 4, Float32Array);
    this.groups = grow(this.groups, 1, Uint16Array);
    this.matrices = grow(this.matrices, 16, Float32Array);
    this.tints = grow(this.tints, 3, Float32Array);
    const centre = new Vector3();
    instances.forEach((entryValues, k) => {
      const i = n0 + k;
      const [x, y, z, yaw = 0, scale = 1, tint = 0.5] = entryValues;
      const s = scale > 0 ? scale : 1;
      this.positions.set([x, y, z], i * 3);
      this.groups[i] = index;
      _position.set(x, y, z);
      _quaternion.setFromAxisAngle(_up, yaw);
      _scale.setScalar(s);
      _matrix.compose(_position, _quaternion, _scale).toArray(this.matrices, i * 16);
      centre.copy(sphere.center).applyMatrix4(_matrix);
      this.spheres.set([centre.x, centre.y, centre.z, sphere.radius * s], i * 4);
      const t = Math.min(1, Math.max(0, tint));
      for (let c = 0; c < 3; c++) this.tints[i * 3 + c] = TINT_LOW[c] + (TINT_HIGH[c] - TINT_LOW[c]) * t;
    });
    this.createSetMeshes(species);
    this.dirty = true;
    return species;
  }

  createInstancedMesh(geometry, material, capacity, name, leaf, layer) {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.visible = false;
    mesh.layers.set(layer);
    mesh.castShadow = layer === LAYERS.vegetationShadow;
    mesh.receiveShadow = layer === LAYERS.vegetationView;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    if (leaf && layer !== LAYERS.vegetationShadow) {
      mesh.setColorAt(0, _color.setRGB(1, 1, 1));
      mesh.instanceColor.setUsage(DynamicDrawUsage);
    }
    this.group.add(mesh);
    this.instancedMeshes.push(mesh);
    return mesh;
  }

  /**
   * Creates the shadow-caster and reflection meshes of a species once, at full capacity, for
   * every preset: a preset change or the budget only changes which instances they hold, so
   * nothing is re-created (and no shader compiled) while the space is in use.
   */
  createSetMeshes(species) {
    const make = (lod, layer, label) =>
      species.lods[lod].parts.map((part) => ({
        mesh: this.createInstancedMesh(part.geometry, part.material, species.capacity, `${species.name} ${label} LOD${lod}`, part.leaf, layer),
        part,
      }));
    species.shadowLod = Math.min(SHADOW_LOD, species.lodCount - 1);
    species.shadowParts = make(species.shadowLod, LAYERS.vegetationShadow, "shadow");
    species.reflectionLod = Math.min(species.lodCount - 1, 2);
    species.reflectionParts = make(species.reflectionLod, LAYERS.vegetationReflection, "reflection");
    species.shadowList = null;
    species.reflectionList = null;
  }

  /** Forgets the level hysteresis and the budget history (review captures start from scratch). */
  resetSelection() {
    this.previous = null;
    this.budgetScale = 1;
    this.dirty = true;
  }

  setSettings(settings, triangleBudget = this.triangleBudget) {
    this.settings = { ...settings };
    this.triangleBudget = triangleBudget;
    this.budgetScale = 1;
    this.dirty = true;
  }

  /**
   * Shows one instance of every vegetation mesh at `point` (unculled) so a frame drawn now, or a
   * pass precompile, builds every pipeline and uploads every LOD geometry before the space is
   * used. endPrime() hands control back to the selection.
   */
  beginPrime(point) {
    this.priming = true;
    _matrix.makeTranslation(point.x, point.y, point.z);
    for (const mesh of this.instancedMeshes) {
      mesh.frustumCulled = false;
      mesh.visible = true;
      mesh.count = 1;
      _matrix.toArray(mesh.instanceMatrix.array, 0);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  endPrime() {
    for (const mesh of this.instancedMeshes) mesh.frustumCulled = true;
    for (const species of this.species) {
      species.lists = null;
      species.shadowList = null;
      species.reflectionList = null;
    }
    this.priming = false;
    this.dirty = true;
  }

  /** Whether the water reflector runs this frame: its vegetation set is filled (and counted) only then. */
  setReflectionActive(active) {
    if (this.reflectionActive === Boolean(active)) return;
    this.reflectionActive = Boolean(active);
    this.dirty = true;
  }

  /** How many shadow cascades draw the vegetation casters (for the estimate). */
  setShadowCascades(count) {
    this.shadowCascades = Math.max(0, count);
  }

  writeBucket(mesh, part, list, fade) {
    const array = mesh.instanceMatrix.array;
    for (let j = 0; j < list.length; j++) {
      const i = list[j];
      const f = fade ? fade[i] : 1;
      if (part.identity && f >= 1) {
        array.set(this.matrices.subarray(i * 16, i * 16 + 16), j * 16);
      } else {
        _matrix.fromArray(this.matrices, i * 16);
        if (f < 1) _matrix.scale(_scale.setScalar(f));
        if (!part.identity) _matrix.multiply(part.partMatrix);
        _matrix.toArray(array, j * 16);
      }
      if (mesh.instanceColor) mesh.instanceColor.array.set(this.tints.subarray(i * 3, i * 3 + 3), j * 3);
    }
    mesh.count = list.length;
    mesh.visible = list.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (list.length) mesh.computeBoundingSphere();
  }

  /**
   * Per-species settings for the selection at the current preset and budget; `shadowDistance` is
   * the shared caster range this frame (each species is capped further by castsShadowWithinM).
   */
  groupSettings(shadowDistance = 0) {
    const s = this.settings;
    const scale = (s.lodScale ?? 1) * this.budgetScale;
    return this.species.map((species) => {
      let maxDistance = speciesMaxDistance(
        { maxDistanceM: species.maxDistanceM, heightM: species.height, distances: species.distances, lodCount: species.lodCount, hasImpostor: species.hasImpostor },
        { farDistance: s.farDistance ?? 600, lodScale: s.lodScale ?? 1, smallPlantFactor: s.smallPlantFactor ?? 1.5 },
      );
      // Over budget, trees are also drawn less far (never below MIN_TREE_DISTANCE_M).
      if (species.tree) maxDistance = Math.max(Math.min(maxDistance, MIN_TREE_DISTANCE_M), maxDistance * this.budgetScale);
      return {
        distances: species.distances,
        lodCount: species.lodCount,
        triangles: species.lods.map((lod) => lod.triangles),
        maxDistance,
        fadeBand: species.tree ? 0 : FADE_BAND,
        shadowLod: species.shadowLod,
        shadowDistance: species.castsShadowWithinM === null ? shadowDistance : Math.min(species.castsShadowWithinM, shadowDistance),
        reflectionLod: species.reflectionLod,
        scale,
      };
    });
  }

  /** Re-selects when the camera moved or turned (or every few frames while it does). */
  update(camera) {
    this.frame++;
    if (!this.species.length || this.priming) return;
    const position = camera.getWorldPosition(_position);
    camera.getWorldDirection(_direction);
    const moved = this.lastCamera ? position.distanceTo(this.lastCamera) : Infinity;
    const turned = _direction.dot(this.lastDirection) < TURN_COS;
    if (!this.dirty && moved < STILL_M && !turned && this.frame % (UPDATE_EVERY_FRAMES * 10) !== 0) return;
    if (!this.dirty && this.frame % UPDATE_EVERY_FRAMES !== 0 && !turned) return;

    // The budget is the vegetation's own (all its passes); static scenery never pushes on it.
    const spent = this.selection ? this.selection.triangles.main + this.selection.triangles.shadow + this.selection.triangles.reflection : 0;
    this.budgetScale = nextBudgetScale(this.budgetScale, spent, this.triangleBudget);
    camera.updateMatrixWorld();
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const planes = frustumPlanes(_viewProjection.elements, { depthZeroToOne: camera.coordinateSystem === WebGPUCoordinateSystem });
    // Over budget the shadow and reflection sets shrink too (not below 25 m / 20 m).
    const shadowDistance = (this.settings.shadowDistance ?? 0) > 0
      ? Math.max(Math.min(25, this.settings.shadowDistance), this.settings.shadowDistance * this.budgetScale)
      : 0;
    const groupSettings = this.groupSettings(shadowDistance);
    const result = selectVegetation({
      positions: this.positions,
      spheres: this.spheres,
      groups: this.groups,
      groupSettings,
      camera: position,
      planes,
      scale: groupSettings[0]?.scale ?? 1,
      hysteresis: HYSTERESIS,
      maxLod0: this.settings.maxLod0 ?? null,
      previous: this.previous,
      shadow: shadowDistance > 0 ? { distance: shadowDistance, cascades: this.shadowCascades } : null,
      reflection: this.reflectionActive && (this.settings.reflectionDistance ?? 0) > 0
        ? { distance: Math.max(Math.min(20, this.settings.reflectionDistance), this.settings.reflectionDistance * this.budgetScale) }
        : null,
    });

    for (const species of this.species) {
      const lists = result.lists[species.index];
      // Buckets with instances fading in are rewritten every time (their scale changes).
      const fading = (list) => !species.tree && list.some((i) => result.fade[i] < 1);
      species.lods.forEach((lod, level) => {
        const list = lists[level];
        if (!this.dirty && !fading(list) && sameMembers(list, species.lists?.[level])) return;
        for (const part of lod.parts) this.writeBucket(part.display, part, list, result.fade);
      });
      species.lists = lists;
      const shadowList = result.shadowLists[species.index];
      if (species.shadowParts.length && (this.dirty || fading(shadowList) || !sameMembers(shadowList, species.shadowList))) {
        for (const { mesh, part } of species.shadowParts) this.writeBucket(mesh, part, shadowList, result.fade);
        species.shadowList = shadowList;
      }
      const reflectionList = result.reflectionLists[species.index];
      if (species.reflectionParts.length && (this.dirty || !sameMembers(reflectionList, species.reflectionList))) {
        for (const { mesh, part } of species.reflectionParts) this.writeBucket(mesh, part, reflectionList, result.fade);
        species.reflectionList = reflectionList;
      }
    }
    this.previous = result.lods;
    this.selection = result;
    this.lastCamera = (this.lastCamera ?? new Vector3()).copy(position);
    this.lastDirection.copy(_direction);
    this.dirty = false;
  }

  /** Counts for the performance panel: instances per LOD, culled, triangles per pass, budget. */
  stats() {
    const result = this.selection;
    const maxLevels = Math.max(1, ...this.species.map((s) => s.lodCount));
    const drawn = Array.from({ length: maxLevels }, (_, k) => result?.counts?.[k] ?? 0);
    const meshes = this.instancedMeshes.filter((mesh) => mesh.visible && mesh.count > 0);
    return {
      species: this.species.length,
      instances: this.groups.length,
      budget: this.triangleBudget,
      drawn,
      culled: result?.culled ?? { distance: 0, frustum: 0 },
      triangles: result?.triangles?.main ?? 0,
      shadowTriangles: result?.triangles?.shadow ?? 0,
      reflectionTriangles: result?.triangles?.reflection ?? 0,
      shadowCasters: result ? result.shadowLists.reduce((sum, list) => sum + list.length, 0) : 0,
      budgetScale: this.budgetScale,
      drawCalls: {
        view: meshes.filter((m) => m.layers.mask === 1 << LAYERS.vegetationView).length,
        shadow: meshes.filter((m) => m.layers.mask === 1 << LAYERS.vegetationShadow).length,
        reflection: meshes.filter((m) => m.layers.mask === 1 << LAYERS.vegetationReflection).length,
      },
    };
  }

  dispose() {
    for (const mesh of this.instancedMeshes) mesh.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.group.removeFromParent();
  }
}

export { CULLED };
