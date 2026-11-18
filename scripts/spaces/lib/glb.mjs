// GLB container helpers and file statistics (no dependencies).
//
// Statistics count what a file really carries: bytes stored in the GLB's BIN chunk. Views that live
// in a data-less EXT_meshopt_compression fallback buffer only describe the decoded size and are not
// counted as stored bytes (counting them double-counts meshopt files).

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
export const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

/** Splits a GLB into its JSON and BIN chunk. */
export function parseGlb(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("not a GLB file");
  let offset = 12;
  let json = null;
  let bin = new Uint8Array(0);
  while (offset < data.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === CHUNK_BIN) bin = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error("GLB without a JSON chunk");
  return { json, bin };
}

const align4 = (n) => (n + 3) & ~3;

/** Builds a GLB from a glTF JSON object and its BIN chunk (padded to 4 bytes). */
export function writeGlb(json, bin) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.byteLength);
  const binLength = align4(bin.byteLength);
  const total = 12 + 8 + jsonLength + (binLength ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength);
  if (binLength) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, CHUNK_BIN, true);
    out.set(bin, 28 + jsonLength);
  }
  return out;
}

/** Width and height of a PNG, JPEG, WebP or KTX2 image, or [0, 0]. */
export function imageSize(data, mimeType) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  try {
    if (mimeType === "image/png") return [view.getUint32(16), view.getUint32(20)];
    if (mimeType === "image/webp") {
      const tag = String.fromCharCode(...data.subarray(12, 16));
      if (tag === "VP8X") return [1 + (view.getUint32(24, true) & 0xffffff), 1 + (view.getUint32(27, true) & 0xffffff)];
      if (tag === "VP8 ") return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
      if (tag === "VP8L") {
        const b = view.getUint32(21, true);
        return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
      }
    }
    if (mimeType === "image/jpeg") {
      let o = 2;
      while (o < data.byteLength) {
        const marker = data[o + 1];
        const length = view.getUint16(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [view.getUint16(o + 7), view.getUint16(o + 5)];
        o += 2 + length;
      }
    }
    if (mimeType === "image/ktx2") return [view.getUint32(20, true), view.getUint32(24, true)];
  } catch {
    // fall through
  }
  return [0, 0];
}

/** Bytes of a bufferView's data inside the BIN chunk. */
export function viewBytes(json, bin, index) {
  const view = json.bufferViews[index];
  return bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

const isFallbackBuffer = (buffer) => Boolean(buffer?.extensions?.EXT_meshopt_compression?.fallback);

/**
 * GPU memory of one image as the viewer uploads it. Plain images become RGBA8 with a full mip chain
 * (4/3); KTX2 images transcode to a block format whose size `ktx2Bytes` reports.
 */
export function imageGpuBytes(width, height, mimeType, ktx2Bytes = null) {
  if (mimeType === "image/ktx2" && ktx2Bytes !== null) return ktx2Bytes;
  return Math.round(width * height * 4 * (4 / 3));
}

/**
 * File statistics: sizes, stored geometry vs image bytes, image list, triangles, names. Images
 * stored outside the GLB (uri) are read through `resolveImage(uri)` when given.
 */
export function glbStats(bytes, { ktx2GpuBytes = null, resolveImage = null } = {}) {
  const { json, bin } = parseGlb(bytes);
  const imageViews = new Set((json.images ?? []).map((image) => image.bufferView).filter((v) => v !== undefined));
  const images = (json.images ?? []).map((image, index) => {
    const data = image.bufferView !== undefined
      ? viewBytes(json, bin, image.bufferView)
      : (image.uri && resolveImage?.(image.uri)) || new Uint8Array(0);
    const [width, height] = imageSize(data, image.mimeType);
    const gpu = imageGpuBytes(width, height, image.mimeType, ktx2GpuBytes ? ktx2GpuBytes(data) : null);
    return { index, name: image.name ?? "", uri: image.uri ?? null, mimeType: image.mimeType, bytes: data.byteLength, width, height, gpu };
  });
  let geometry = 0;
  (json.bufferViews ?? []).forEach((view, index) => {
    if (imageViews.has(index)) return;
    // A meshopt view stores its compressed bytes where the extension points; the view itself lives
    // in the data-less fallback buffer.
    const meshopt = view.extensions?.EXT_meshopt_compression;
    if (meshopt) geometry += meshopt.byteLength;
    else if (!isFallbackBuffer(json.buffers?.[view.buffer])) geometry += view.byteLength;
  });
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ((primitive.mode ?? 4) !== 4) continue;
      const accessor = primitive.indices !== undefined ? json.accessors[primitive.indices] : json.accessors[primitive.attributes.POSITION];
      triangles += accessor.count / 3;
    }
  }
  return {
    fileBytes: bytes.byteLength,
    imageBytes: images.reduce((sum, image) => sum + image.bytes, 0),
    geometryBytes: geometry,
    gpuTextureBytes: images.reduce((sum, image) => sum + image.gpu, 0),
    triangles: Math.round(triangles),
    images,
    extensionsUsed: json.extensionsUsed ?? [],
  };
}

/** Node, mesh and material names of a glTF JSON (with multiplicity). */
export function glbNames(json) {
  return {
    nodes: (json.nodes ?? []).map((node) => node.name ?? ""),
    meshes: (json.meshes ?? []).map((mesh) => mesh.name ?? ""),
    materials: (json.materials ?? []).map((material) => material.name ?? ""),
  };
}
