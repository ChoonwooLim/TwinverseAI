// Camera collision geometry: which meshes block the camera, their triangles in a BVH each (built a
// slice at a time between frames, largest first), and the arm casts. Hand-written instead of
// three-mesh-bvh: only ray casts are needed, positions are read through BufferAttribute.getX/Y/Z
// (so meshopt-quantized, normalized and interleaved attributes all work), the render geometry is
// never touched (no index reordering), and the time-sliced build needs no worker bundling.
import { Box3, Matrix4, Vector3 } from "three/webgpu";
import { buildTriangleBVH, raycastBVH } from "../triangleBVH.js";

export const CAMERA_COLLISION = {
  /** Time per frame spent building collision structures (ms). */
  buildBudgetMs: 4,
  /** Meshes thinner than this in two dimensions (lamp posts, bench slats) do not block (m). */
  thinLimit: 0.3,
  /** Work units between checks of the frame budget (vertices or triangles). */
  sliceSize: 6000,
};

const _v = new Vector3();
const _m = new Matrix4();
const _box = new Box3();
const _o = new Vector3();
const _e = new Vector3();

/** userData value set on this object or the nearest ancestor that sets it. */
function inherited(object, key) {
  for (let node = object; node; node = node.parent) {
    if (node.userData && node.userData[key] !== undefined) return node.userData[key];
  }
  return undefined;
}

const materialList = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** World-space bounds of a mesh (all instances for an InstancedMesh). */
function worldBounds(mesh, out) {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  out.makeEmpty();
  if (mesh.isInstancedMesh) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, _m);
      _m.premultiply(mesh.matrixWorld);
      out.union(_box.copy(geometry.boundingBox).applyMatrix4(_m));
    }
  } else {
    out.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  }
  return out;
}

/**
 * "static", "dynamic" (moves, e.g. door leaves; cast in its own frame) or null for a mesh that
 * must not block the camera: not a plain mesh (skinned, points, lines, sprites), tagged
 * `userData.cameraBlocks = false` (water, flags, lawns, beds), alpha-blended or invisible
 * material, or thinner than `thinLimit` in two dimensions.
 */
export function cameraBlockerKind(mesh) {
  if (!mesh?.isMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) return null;
  if (!mesh.geometry?.attributes?.position) return null;
  if (inherited(mesh, "cameraBlocks") === false) return null;
  for (const material of materialList(mesh)) {
    if (!material || material.transparent || material.visible === false) return null;
  }
  const size = worldBounds(mesh, new Box3()).getSize(_v);
  const thin = [size.x, size.y, size.z].filter((value) => value < CAMERA_COLLISION.thinLimit).length;
  if (thin >= 2) return null;
  return inherited(mesh, "cameraDynamic") ? "dynamic" : "static";
}

function triangleCount(mesh) {
  const geometry = mesh.geometry;
  const per = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  return Math.floor(per) * (mesh.isInstancedMesh ? mesh.count : 1);
}

/** Copies a mesh's triangles (world space for static meshes, local for dynamic ones). */
function* extractTriangles(entry) {
  const { mesh, kind } = entry;
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const vertexCount = position.count;
  const index = geometry.index;
  const perIndices = index ? index.count : vertexCount;
  const instances = mesh.isInstancedMesh ? mesh.count : 1;
  const positions = new Float32Array(vertexCount * 3 * instances);
  const indices = new Uint32Array(Math.floor(perIndices / 3) * 3 * instances);
  let work = 0;
  for (let instance = 0; instance < instances; instance++) {
    if (kind === "static") {
      if (mesh.isInstancedMesh) {
        mesh.getMatrixAt(instance, _m);
        _m.premultiply(mesh.matrixWorld);
      } else {
        _m.copy(mesh.matrixWorld);
      }
    } else {
      _m.identity();
    }
    const vertexBase = instance * vertexCount;
    for (let i = 0; i < vertexCount; i++) {
      // getX/Y/Z handle interleaved buffers and normalized (quantized) integers.
      _v.fromBufferAttribute(position, i).applyMatrix4(_m);
      const o = (vertexBase + i) * 3;
      positions[o] = _v.x;
      positions[o + 1] = _v.y;
      positions[o + 2] = _v.z;
      if (++work >= CAMERA_COLLISION.sliceSize) {
        work = 0;
        yield;
      }
    }
    const indexBase = instance * Math.floor(perIndices / 3) * 3;
    for (let i = 0; i < Math.floor(perIndices / 3) * 3; i++) {
      indices[indexBase + i] = vertexBase + (index ? index.getX(i) : i);
      if (++work >= CAMERA_COLLISION.sliceSize * 3) {
        work = 0;
        yield;
      }
    }
  }
  return { positions, indices };
}

/** Whether the segment origin + u * delta, u in [0, maxU], touches the box. */
function segmentTouchesBox(box, o, d, maxU) {
  let t0 = 0;
  let t1 = maxU;
  for (const axis of ["x", "y", "z"]) {
    if (d[axis] === 0) {
      if (o[axis] < box.min[axis] || o[axis] > box.max[axis]) return false;
      continue;
    }
    const a = (box.min[axis] - o[axis]) / d[axis];
    const b = (box.max[axis] - o[axis]) / d[axis];
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return false;
  }
  return true;
}

export class CameraCollider {
  constructor() {
    this.entries = [];
    this.queue = [];
    this.job = null;
    this.buildMs = 0;
    this.bytes = 0;
    this.triangles = 0;
    this.castMs = 0;
  }

  /** Registers every blocking mesh below `root` (call after it is placed in the scene). */
  addRoot(root) {
    // Parents too: a scenery file's placement group may not have been updated by a render yet.
    root.updateWorldMatrix(true, true);
    const added = [];
    root.traverse((object) => {
      const kind = cameraBlockerKind(object);
      if (!kind) return;
      const entry = {
        mesh: object,
        kind,
        triangles: triangleCount(object),
        box: kind === "static" ? worldBounds(object, new Box3()) : null,
        bvh: null,
        inverse: new Matrix4(),
      };
      this.entries.push(entry);
      added.push(entry);
    });
    this.queue.push(...added);
    this.queue.sort((a, b) => b.triangles - a.triangles);
    return added.length;
  }

  get readyCount() {
    return this.entries.filter((entry) => entry.bvh).length;
  }

  get building() {
    return Boolean(this.job) || this.queue.length > 0;
  }

  /** Builds for at most `budgetMs` (one slice may run a little over). */
  build(budgetMs = CAMERA_COLLISION.buildBudgetMs) {
    const start = performance.now();
    while (performance.now() - start < budgetMs) {
      if (!this.job) {
        const entry = this.queue.shift();
        if (!entry) return;
        this.job = { entry, steps: this.buildEntry(entry) };
      }
      const t0 = performance.now();
      const step = this.job.steps.next();
      this.buildMs += performance.now() - t0;
      if (step.done) {
        const { entry } = this.job;
        entry.bvh = step.value;
        if (entry.bvh) {
          this.bytes += entry.bvh.bytes;
          this.triangles += entry.bvh.triangles;
        }
        this.job = null;
      }
    }
  }

  *buildEntry(entry) {
    const { positions, indices } = yield* extractTriangles(entry);
    return yield* buildTriangleBVH(positions, indices, { sliceTriangles: CAMERA_COLLISION.sliceSize });
  }

  /** Call once per frame before casting: dynamic meshes are cast in their current frame. */
  beginFrame() {
    for (const entry of this.entries) {
      if (entry.kind === "dynamic" && entry.bvh) entry.inverse.copy(entry.mesh.matrixWorld).invert();
    }
  }

  /** Distance from `origin` to the nearest blocking surface on the segment to `end`, or Infinity. */
  castSegment(origin, end) {
    const length = origin.distanceTo(end);
    if (!(length > 0)) return Infinity;
    let best = 1;
    const d = _e.subVectors(end, origin);
    for (const entry of this.entries) {
      if (!entry.bvh || !entry.mesh.visible) continue;
      let u;
      if (entry.kind === "static") {
        if (!segmentTouchesBox(entry.box, origin, d, best)) continue;
        u = raycastBVH(entry.bvh, origin.x, origin.y, origin.z, d.x, d.y, d.z, best);
      } else {
        // Affine maps keep the segment parameter, so the hit fraction carries over unchanged.
        const lo = _o.copy(origin).applyMatrix4(entry.inverse);
        const le = _v.copy(end).applyMatrix4(entry.inverse);
        u = raycastBVH(entry.bvh, lo.x, lo.y, lo.z, le.x - lo.x, le.y - lo.y, le.z - lo.z, best);
      }
      if (u < best) best = u;
    }
    return best < 1 ? best * length : Infinity;
  }

  /** Casts the arm rays ([{ origin, end }] as plain objects); returns the hit distances. */
  castRays(rays) {
    const t0 = performance.now();
    this.beginFrame();
    const origin = new Vector3();
    const end = new Vector3();
    const hits = rays.map((ray) => this.castSegment(origin.copy(ray.origin), end.copy(ray.end)));
    this.castMs = performance.now() - t0;
    return hits;
  }
}
