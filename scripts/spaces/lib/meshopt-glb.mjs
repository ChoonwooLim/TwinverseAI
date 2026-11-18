// EXT_meshopt_compression for an uncompressed GLB, with the filter and precision chosen per accessor.
//
// gltf-transform's own meshopt writer either quantizes positions into node transforms (which moves
// geometry out of metres; the viewer's wind and flag shaders and the vegetation instancing read
// geometry in metres) or keeps them lossless. This encoder keeps every attribute in its own space:
//
//   POSITION, TEXCOORD_n, COLOR_n (float)  EXPONENTIAL filter, mode "Separate": each value keeps its
//       own exponent, so equal coordinates stay equal (no cracks between meshes) and the precision
//       is relative; the mantissa bits are chosen per accessor so the step never exceeds the
//       profile's tolerance (e.g. 0.25 mm for positions). Decodes to float32, no node changes.
//   NORMAL, TANGENT                        OCTAHEDRAL filter (8 or 10-16 bits), normalized ints
//                                          (KHR_mesh_quantization).
//   integer data (already quantized), skins, animations, morph targets   lossless.
//   indices                                TRIANGLES codec (uint16 where the vertices allow).
//
// Every compressed view is decoded again with meshoptimizer's decoder and compared with its input:
// lossless views must match bit for bit, filtered ones within their tolerance.
import { COMPONENT_BYTES, TYPE_SIZE, parseGlb, writeGlb } from "./glb.mjs";

const CTOR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORMALIZE = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const align4 = (n) => (n + 3) & ~3;

/** Elements of an accessor as a tightly packed typed array (handles byteOffset and byteStride). */
function readAccessor(json, bin, accessor) {
  const Ctor = CTOR[accessor.componentType];
  const size = TYPE_SIZE[accessor.type];
  const view = json.bufferViews[accessor.bufferView];
  const elementBytes = size * COMPONENT_BYTES[accessor.componentType];
  const stride = view.byteStride ?? elementBytes;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = new Ctor(accessor.count * size);
  if (stride === elementBytes && (bin.byteOffset + base) % Ctor.BYTES_PER_ELEMENT === 0) {
    out.set(new Ctor(bin.buffer, bin.byteOffset + base, accessor.count * size));
    return out;
  }
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < accessor.count; i++) bytes.set(bin.subarray(base + i * stride, base + i * stride + elementBytes), i * elementBytes);
  return out;
}

/** Copies elements into a buffer whose stride is a multiple of 4 (meshopt attribute streams). */
function padElements(array, count, size) {
  const elementBytes = size * array.BYTES_PER_ELEMENT;
  const stride = align4(elementBytes);
  if (stride === elementBytes) return { bytes: new Uint8Array(array.buffer, array.byteOffset, count * stride), stride };
  const out = new Uint8Array(count * stride);
  const src = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (let i = 0; i < count; i++) out.set(src.subarray(i * elementBytes, (i + 1) * elementBytes), i * stride);
  return { bytes: out, stride };
}

function toFloat(array, componentType, normalized) {
  if (array instanceof Float32Array) return array;
  const out = new Float32Array(array.length);
  const scale = normalized ? NORMALIZE[componentType] : 1;
  for (let i = 0; i < array.length; i++) out[i] = normalized ? Math.max(array[i] / scale, -1) : array[i];
  return out;
}

/** Mantissa bits so that values up to |max| keep a step of at most `step` (EXPONENTIAL filter). */
export function expBits(maxAbs, step) {
  if (!(maxAbs > 0)) return 8;
  const top = 2 ** Math.ceil(Math.log2(maxAbs));
  return Math.min(24, Math.max(8, Math.ceil(Math.log2(top / step)) + 1));
}

/** How each accessor is used by the document (attributes, indices, targets, other). */
function accessorUsage(json) {
  const usage = new Map();
  const mark = (index, entry) => {
    if (index === undefined) return;
    const list = usage.get(index) ?? [];
    list.push(entry);
    usage.set(index, list);
  };
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      for (const [semantic, index] of Object.entries(primitive.attributes ?? {})) mark(index, { kind: "attribute", semantic });
      mark(primitive.indices, { kind: "indices", mode: primitive.mode ?? 4, vertexCount: json.accessors[primitive.attributes.POSITION]?.count ?? 0 });
      for (const target of primitive.targets ?? []) for (const [semantic, index] of Object.entries(target)) mark(index, { kind: "target", semantic });
    }
  }
  return usage;
}

/**
 * Plans the encoding of one accessor.
 * @returns {{ mode: string, filter: string, bits?: number, componentType: number, normalized: boolean, bytes: Uint8Array, stride: number, tolerance: number, source: Float32Array | null }}
 */
function planAccessor(json, bin, index, uses, profile) {
  const accessor = json.accessors[index];
  const size = TYPE_SIZE[accessor.type];
  const array = readAccessor(json, bin, accessor);
  const kinds = new Set(uses.map((u) => u.kind));
  if (kinds.has("indices")) {
    const triangles = uses.every((u) => u.kind === "indices" && u.mode === 4) && accessor.count % 3 === 0;
    let max = 0;
    for (const v of array) if (v > max) max = v;
    const narrow = max < 65536;
    const out = narrow ? Uint16Array.from(array) : Uint32Array.from(array);
    return { mode: triangles ? "TRIANGLES" : "INDICES", filter: "NONE", componentType: narrow ? 5123 : 5125, normalized: false, bytes: new Uint8Array(out.buffer), stride: out.BYTES_PER_ELEMENT, tolerance: 0, indexStride: out.BYTES_PER_ELEMENT };
  }
  const semantic = uses.find((u) => u.kind === "attribute")?.semantic ?? null;
  const onlyAttribute = uses.every((u) => u.kind === "attribute");
  const isFloat = accessor.componentType === 5126;
  if (onlyAttribute && semantic && isFloat) {
    let maxAbs = 0;
    for (const v of array) maxAbs = Math.max(maxAbs, Math.abs(v));
    const step = semantic === "POSITION" ? profile.positionStep : semantic.startsWith("TEXCOORD_") ? profile.texcoordStep : semantic.startsWith("COLOR_") ? profile.colorStep : null;
    if (step) {
      const bits = expBits(maxAbs, step);
      const stride = size * 4;
      return { mode: "ATTRIBUTES", filter: "EXPONENTIAL", bits, componentType: 5126, normalized: false, bytes: profile.encoder.encodeFilterExp(array, accessor.count, stride, bits, "Separate"), stride, tolerance: step, source: array };
    }
  }
  if (onlyAttribute && (semantic === "NORMAL" || semantic === "TANGENT") && (isFloat || accessor.normalized)) {
    const bits = profile.normalBits;
    const stride = bits > 8 ? 8 : 4;
    const floats = toFloat(array, accessor.componentType, accessor.normalized);
    let four = floats;
    if (size === 3) {
      four = new Float32Array(accessor.count * 4);
      for (let i = 0; i < accessor.count; i++) four.set(floats.subarray(i * 3, i * 3 + 3), i * 4);
    }
    // Unit length in, so the filter's own normalisation does not hide a bad input.
    return { mode: "ATTRIBUTES", filter: "OCTAHEDRAL", bits, componentType: bits > 8 ? 5122 : 5120, normalized: true, bytes: profile.encoder.encodeFilterOct(four, accessor.count, stride, bits), stride, tolerance: profile.normalTolerance, source: floats, size };
  }
  const padded = padElements(array, accessor.count, size);
  return { mode: "ATTRIBUTES", filter: "NONE", componentType: accessor.componentType, normalized: Boolean(accessor.normalized), bytes: padded.bytes, stride: padded.stride, tolerance: 0 };
}

/** Largest error between the decoded view and the encoder's input. */
function measure(plan, decoded, accessor) {
  if (plan.mode === "TRIANGLES") {
    // The triangle codec may rotate a triangle's vertices (winding is kept): compare per triangle.
    const Ctor = plan.indexStride === 2 ? Uint16Array : Uint32Array;
    const a = new Ctor(plan.bytes.buffer, plan.bytes.byteOffset, accessor.count);
    const b = new Ctor(decoded.buffer, decoded.byteOffset, accessor.count);
    for (let t = 0; t < accessor.count; t += 3) {
      const same = (r) => b[t] === a[t + r] && b[t + 1] === a[t + ((r + 1) % 3)] && b[t + 2] === a[t + ((r + 2) % 3)];
      if (!same(0) && !same(1) && !same(2)) return Infinity;
    }
    return 0;
  }
  if (plan.filter === "NONE") {
    for (let i = 0; i < plan.bytes.byteLength; i++) if (decoded[i] !== plan.bytes[i]) return Infinity;
    return 0;
  }
  const size = TYPE_SIZE[accessor.type];
  let max = 0;
  if (plan.filter === "EXPONENTIAL") {
    const out = new Float32Array(decoded.buffer, decoded.byteOffset, accessor.count * size);
    for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i] - plan.source[i]));
    return max;
  }
  // OCTAHEDRAL: compare directions (xyz) in normalized units; the tangent's w sign must survive.
  const Ctor = plan.componentType === 5122 ? Int16Array : Int8Array;
  const scale = plan.componentType === 5122 ? 32767 : 127;
  const per = plan.stride / Ctor.BYTES_PER_ELEMENT;
  const out = new Ctor(decoded.buffer, decoded.byteOffset, accessor.count * per);
  for (let i = 0; i < accessor.count; i++) {
    const sx = plan.source[i * size];
    const sy = plan.source[i * size + 1];
    const sz = plan.source[i * size + 2];
    const length = Math.hypot(sx, sy, sz);
    if (length < 1e-6) continue; // a degenerate normal has no direction to keep
    const dx = out[i * per] / scale - sx / length;
    const dy = out[i * per + 1] / scale - sy / length;
    const dz = out[i * per + 2] / scale - sz / length;
    max = Math.max(max, Math.hypot(dx, dy, dz));
    if (size === 4 && Math.sign(out[i * per + 3]) !== Math.sign(plan.source[i * 4 + 3] || 1)) return Infinity;
  }
  return max;
}

/**
 * Compresses every accessor of an uncompressed GLB with EXT_meshopt_compression.
 * @param {Uint8Array} glb
 * @param {{ encoder: object, decoder: object, positionStep: number, texcoordStep: number, colorStep: number, normalBits: number, normalTolerance: number }} profile
 * @param {{ externalImage?: (bytes: Uint8Array, mimeType: string) => string }} [options] when given,
 *   every embedded image is moved out of the GLB: the callback stores the bytes and returns the
 *   relative URI the image then points to.
 * @returns {{ glb: Uint8Array, accessors: object[] }}
 */
export function compressGlb(glb, profile, { externalImage = null } = {}) {
  const { json, bin } = parseGlb(glb);
  const externalViews = new Set();
  if (externalImage) {
    for (const image of json.images ?? []) {
      if (image.bufferView === undefined) continue;
      externalViews.add(image.bufferView);
      const view = json.bufferViews[image.bufferView];
      image.uri = externalImage(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), image.mimeType);
      delete image.bufferView;
    }
  }
  const usage = accessorUsage(json);
  const accessorViews = new Set((json.accessors ?? []).map((a) => a.bufferView).filter((v) => v !== undefined));
  const imageViews = new Set((json.images ?? []).map((i) => i.bufferView).filter((v) => v !== undefined));

  const stored = []; // chunks of the new BIN
  let storedLength = 0;
  const store = (bytes) => {
    const offset = storedLength;
    stored.push({ offset, bytes });
    storedLength = align4(storedLength + bytes.byteLength);
    return offset;
  };
  const newViews = [];
  const viewRemap = new Map();
  // Views that are not accessor data (images, other blobs) are carried over unchanged, in order.
  (json.bufferViews ?? []).forEach((view, index) => {
    if (externalViews.has(index) || (accessorViews.has(index) && !imageViews.has(index))) return;
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const copy = { ...view, buffer: 0, byteOffset: store(data) };
    delete copy.extensions;
    viewRemap.set(index, newViews.length);
    newViews.push(copy);
  });

  let fallbackLength = 0;
  const report = [];
  let quantized = false;
  (json.accessors ?? []).forEach((accessor, index) => {
    if (accessor.bufferView === undefined || accessor.sparse) return;
    const uses = usage.get(index) ?? [{ kind: "other" }];
    const plan = planAccessor(json, bin, index, uses, profile);
    const compressed = profile.encoder.encodeGltfBuffer(plan.bytes, accessor.count, plan.stride, plan.mode);
    const decoded = new Uint8Array(accessor.count * plan.stride);
    profile.decoder.decodeGltfBuffer(decoded, accessor.count, plan.stride, compressed, plan.mode, plan.filter === "NONE" ? undefined : plan.filter);
    const error = measure(plan, decoded, accessor);
    if (!(error <= plan.tolerance * 1.0001)) {
      throw new Error(`accessor ${index} (${uses.map((u) => u.semantic ?? u.kind).join("/")}): decoded error ${error} exceeds ${plan.tolerance}`);
    }
    const isIndex = plan.mode !== "ATTRIBUTES";
    const view = {
      buffer: 1,
      byteOffset: fallbackLength,
      byteLength: accessor.count * plan.stride,
      extensions: {
        EXT_meshopt_compression: {
          buffer: 0,
          byteOffset: store(compressed),
          byteLength: compressed.byteLength,
          byteStride: plan.stride,
          mode: plan.mode,
          count: accessor.count,
          ...(plan.filter === "NONE" ? {} : { filter: plan.filter }),
        },
      },
    };
    if (!isIndex) view.byteStride = plan.stride;
    if (uses.some((u) => u.kind === "attribute" || u.kind === "target")) view.target = 34962;
    if (isIndex) view.target = 34963;
    fallbackLength = align4(fallbackLength + view.byteLength);
    accessor.bufferView = newViews.length;
    accessor.byteOffset = 0;
    accessor.componentType = plan.componentType;
    if (plan.normalized) accessor.normalized = true;
    else delete accessor.normalized;
    if (plan.normalized && accessor.componentType !== 5126) quantized = true;
    if (plan.filter !== "NONE" || isIndex) {
      // Bounds must describe the decoded data.
      if (accessor.min || accessor.max || uses.some((u) => u.semantic === "POSITION")) {
        const values = plan.filter === "EXPONENTIAL"
          ? new Float32Array(decoded.buffer, 0, accessor.count * TYPE_SIZE[accessor.type])
          : isIndex
            ? new (plan.componentType === 5123 ? Uint16Array : Uint32Array)(decoded.buffer, 0, accessor.count)
            : null;
        if (values) {
          const size = TYPE_SIZE[accessor.type];
          const min = new Array(size).fill(Infinity);
          const max = new Array(size).fill(-Infinity);
          for (let i = 0; i < accessor.count; i++) for (let k = 0; k < size; k++) {
            const v = values[i * size + k];
            if (v < min[k]) min[k] = v;
            if (v > max[k]) max[k] = v;
          }
          accessor.min = min;
          accessor.max = max;
        } else {
          delete accessor.min;
          delete accessor.max;
        }
      }
    }
    newViews.push(view);
    report.push({
      accessor: index,
      use: uses.map((u) => u.semantic ?? u.kind).join("/"),
      filter: plan.filter,
      bits: plan.bits ?? null,
      decoded: accessor.count * plan.stride,
      compressed: compressed.byteLength,
      maxError: error,
      tolerance: plan.tolerance,
    });
  });

  for (const image of json.images ?? []) if (image.bufferView !== undefined) image.bufferView = viewRemap.get(image.bufferView);
  json.bufferViews = newViews;
  const binBytes = new Uint8Array(storedLength);
  for (const chunk of stored) binBytes.set(chunk.bytes, chunk.offset);
  json.buffers = [
    { byteLength: storedLength },
    { byteLength: fallbackLength, extensions: { EXT_meshopt_compression: { fallback: true } } },
  ];
  const used = new Set(json.extensionsUsed ?? []);
  const required = new Set(json.extensionsRequired ?? []);
  used.add("EXT_meshopt_compression");
  required.add("EXT_meshopt_compression");
  if (quantized || used.has("KHR_mesh_quantization")) {
    used.add("KHR_mesh_quantization");
    required.add("KHR_mesh_quantization");
  }
  json.extensionsUsed = [...used].sort();
  json.extensionsRequired = [...required].sort();
  return { glb: writeGlb(json, binBytes), accessors: report };
}
