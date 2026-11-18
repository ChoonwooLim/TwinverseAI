// Minimal glTF 2.0 binary (GLB) reader for skeletons and animation clips. Reads node transforms,
// skins and animation accessors only (no meshes, no textures), so it runs in plain Node for the
// build-time retargeting tool and in unit tests. Relative imports carry explicit extensions so
// Node can resolve this module without a bundler.
import {
  AnimationClip,
  Bone,
  Group,
  Object3D,
  PropertyBinding,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from "three";

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** @param {ArrayBuffer | Uint8Array} input */
export function parseGLB(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("Not a GLB file");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB files are supported");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === CHUNK_BIN) bin = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

/** Reads a FLOAT accessor into a tightly packed Float32Array. */
export function readAccessor(gltf, index) {
  const { json, bin } = gltf;
  const accessor = json.accessors[index];
  if (accessor.componentType !== 5126) throw new Error(`Accessor ${index}: only FLOAT is supported`);
  const components = COMPONENTS[accessor.type];
  const out = new Float32Array(accessor.count * components);
  if (accessor.bufferView === undefined) return out;
  const bufferView = json.bufferViews[accessor.bufferView];
  const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? components * 4;
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < components; c++) {
      out[i * components + c] = view.getFloat32(base + i * stride + c * 4, true);
    }
  }
  return out;
}

/**
 * Builds the node hierarchy of the default scene. Skin joints become Bones; names are sanitised
 * the way three.js GLTFLoader does, so animation track names match.
 * @returns {{ root: Group, nodes: Object3D[], bones: Map<string, Bone>, joints: Bone[] }}
 */
export function buildSkeleton(gltf) {
  const { json } = gltf;
  const jointSet = new Set((json.skins ?? []).flatMap((skin) => skin.joints));
  const nodes = json.nodes.map((node, index) => {
    const object = jointSet.has(index) ? new Bone() : new Object3D();
    object.name = PropertyBinding.sanitizeNodeName(node.name ?? `node_${index}`);
    if (node.matrix) {
      object.matrix.fromArray(node.matrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
    } else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    return object;
  });
  json.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) nodes[index].add(nodes[child]);
  });
  const root = new Group();
  const sceneIndex = json.scene ?? 0;
  for (const index of json.scenes?.[sceneIndex]?.nodes ?? []) root.add(nodes[index]);
  root.updateMatrixWorld(true);
  const bones = new Map();
  for (const object of nodes) if (object.isBone) bones.set(object.name, object);
  const joints = (json.skins?.[0]?.joints ?? []).map((index) => nodes[index]);
  return { root, nodes, bones, joints };
}

/**
 * Reads the animation clips (LINEAR / STEP samplers; CUBICSPLINE keeps only the values).
 * @returns {AnimationClip[]}
 */
export function readClips(gltf, nodes) {
  const { json } = gltf;
  return (json.animations ?? []).map((animation, index) => {
    const tracks = [];
    for (const channel of animation.channels) {
      const node = nodes[channel.target.node];
      if (!node) continue;
      const sampler = animation.samplers[channel.sampler];
      const times = readAccessor(gltf, sampler.input);
      let values = readAccessor(gltf, sampler.output);
      const width = channel.target.path === "rotation" ? 4 : 3;
      if (sampler.interpolation === "CUBICSPLINE") {
        const keep = new Float32Array(times.length * width);
        for (let k = 0; k < times.length; k++) keep.set(values.subarray((k * 3 + 1) * width, (k * 3 + 2) * width), k * width);
        values = keep;
      }
      const name = node.name;
      if (channel.target.path === "rotation") tracks.push(new QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
      else if (channel.target.path === "translation") tracks.push(new VectorKeyframeTrack(`${name}.position`, times, values));
      else if (channel.target.path === "scale") tracks.push(new VectorKeyframeTrack(`${name}.scale`, times, values));
    }
    return new AnimationClip(animation.name ?? `animation_${index}`, -1, tracks);
  });
}
