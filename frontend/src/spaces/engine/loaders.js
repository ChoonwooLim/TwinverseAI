// Asset loading with byte-level progress. Only bundled, same-origin files are loaded.
import {
  DataUtils,
  EquirectangularReflectionMapping,
  FileLoader,
  HalfFloatType,
  LinearFilter,
  LoadingManager,
  SRGBColorSpace,
  Texture,
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
// three.js's own Basis Universal transcoder, imported as URLs so the build serves both files as
// content-hashed assets (KTX2Loader's built-in `new URL(..., import.meta.url)` does not survive
// dependency pre-bundling in development).
import transcoderScriptUrl from "three/addons/libs/basis/basis_transcoder.js?url";
import transcoderWasmUrl from "three/addons/libs/basis/basis_transcoder.wasm?url";
// The meshopt decoder ships inside the three package (WebAssembly embedded in the module), so
// EXT_meshopt_compression files decode without fetching anything. It decodes on the main thread:
// meshopt decoding runs at memory speed, so even a million triangles take a few tens of ms.
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * Tracks the transfer of several files and reports one combined figure.
 * `percent` is byte-based once every tracked file has reported a Content-Length,
 * otherwise it falls back to the share of finished files.
 */
export function createTransferTracker(onChange) {
  const files = new Map();

  const summary = () => {
    let loaded = 0;
    let total = 0;
    let known = files.size > 0;
    let done = 0;
    for (const file of files.values()) {
      loaded += file.loaded;
      total += file.total;
      if (!file.total) known = false;
      if (file.done) done++;
    }
    const share = files.size ? done / files.size : 0;
    const percent = known && total > 0 ? Math.min(loaded / total, done === files.size ? 1 : 0.99) : share;
    return { loaded, total: known ? total : 0, percent: Math.round(percent * 100), done, count: files.size };
  };

  return {
    track(url) {
      const file = { loaded: 0, total: 0, done: false };
      files.set(url, file);
      onChange(summary());
      return {
        progress(event) {
          if (event && Number.isFinite(event.loaded)) file.loaded = event.loaded;
          if (event && event.lengthComputable && event.total > 0) file.total = event.total;
          onChange(summary());
        },
        finish() {
          file.done = true;
          if (file.total) file.loaded = file.total;
          onChange(summary());
        },
      };
    },
    summary,
  };
}

/** Transcoder workers: half the cores, between 2 and 4 (each holds a copy of the transcoder). */
export function transcoderWorkerCount(cores = globalThis.navigator?.hardwareConcurrency) {
  const count = Number.isFinite(cores) && cores > 0 ? Math.floor(cores / 2) : 2;
  return Math.max(2, Math.min(4, count));
}

const fileName = (url) => url.split(/[?#]/)[0].split("/").pop();

/**
 * URL rewriting for KTX2 loads: three's transcoder files, and texture files the GLBs reference by
 * name (textures/<name>.ktx2) mapped to their bundled, content-hashed URLs.
 */
export function textureUrlModifier(textureUrls = {}) {
  return (url) => {
    if (url.endsWith("basis_transcoder.js")) return transcoderScriptUrl;
    if (url.endsWith("basis_transcoder.wasm")) return transcoderWasmUrl;
    return textureUrls[fileName(url)] ?? url;
  };
}

/**
 * Loads each texture file once for all callers: a texture several GLBs reference (the same
 * content-addressed file) is fetched, transcoded and uploaded once and shared.
 */
export function shareLoads(loader) {
  const pending = new Map();
  const load = loader.load.bind(loader);
  loader.load = (url, onLoad, onProgress, onError) => {
    const key = fileName(url);
    let promise = pending.get(key);
    if (!promise) {
      promise = new Promise((resolve, reject) => load(url, resolve, onProgress, reject));
      pending.set(key, promise);
      promise.catch(() => pending.delete(key));
    }
    promise.then(onLoad, onError);
  };
  return loader;
}

/**
 * KTX2 (KHR_texture_basisu) texture loader for one renderer: the Basis transcoder runs in a small
 * worker pool and writes the block format the GPU takes (BC7 on desktop, ASTC 4x4 or ETC2
 * elsewhere), with the mip chain stored in the file. Call after `await renderer.init()` (WebGPU or
 * the WebGL 2 fallback; detectSupport reads the renderer's compressed-texture features).
 * `textureUrls` maps texture file names to their bundled URLs (assets.textureUrls).
 */
export function createKTX2Loader(renderer, textureUrls = {}) {
  const manager = new LoadingManager();
  manager.setURLModifier(textureUrlModifier(textureUrls));
  const loader = new KTX2Loader(manager).setTranscoderPath("basis/").setWorkerLimit(transcoderWorkerCount()).detectSupport(renderer);
  return shareLoads(loader);
}

/**
 * glTF loader for every file the engine loads. The meshopt decoder is registered (scenery uses
 * EXT_meshopt_compression with KHR_mesh_quantization) and, when given, the KTX2 loader for
 * KHR_texture_basisu textures; GLTFLoader itself handles quantized attributes,
 * KHR_texture_transform and EXT_texture_webp. No Draco decoder, so nothing is ever fetched from a CDN.
 */
export function createGLTFLoader(ktx2Loader = null) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (ktx2Loader) loader.setKTX2Loader(ktx2Loader);
  return loader;
}

export async function loadGLTF(url, tracker, ktx2Loader = null) {
  const handle = tracker?.track(url);
  const gltf = await createGLTFLoader(ktx2Loader).loadAsync(url, (event) => handle?.progress(event));
  handle?.finish();
  return gltf;
}

let halfFloatTable = null;

function decodeHalf(value) {
  if (!halfFloatTable) {
    halfFloatTable = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) halfFloatTable[i] = DataUtils.fromHalfFloat(i);
  }
  return halfFloatTable[value];
}

/** Loads a small binary file (e.g. a heightfield grid) as an ArrayBuffer. */
export async function loadBinary(url, tracker) {
  const handle = tracker?.track(url);
  try {
    return await new FileLoader().setResponseType("arraybuffer").loadAsync(url, (event) => handle?.progress(event));
  } finally {
    // A failed grid is dropped (walking falls back to the analytic colliders), so it must not
    // hold the progress bar below 100 %.
    handle?.finish();
  }
}

/** Returns the decoder that turns the HDR texture's raw data values into floats. */
export function hdrDecoder(texture) {
  return texture.image?.data instanceof Uint16Array ? decodeHalf : (value) => value;
}

/** Returns the encoder that turns floats back into the HDR texture's raw data values. */
export function hdrEncoder(texture) {
  return texture.image?.data instanceof Uint16Array ? (value) => DataUtils.toHalfFloat(value) : (value) => value;
}

export async function loadHDR(url, tracker) {
  const handle = tracker?.track(url);
  const loader = new HDRLoader().setDataType(HalfFloatType);
  const texture = await loader.loadAsync(url, (event) => handle?.progress(event));
  texture.mapping = EquirectangularReflectionMapping;
  handle?.finish();
  return texture;
}

/**
 * Loads a tonemapped equirectangular JPEG as an sRGB texture, optionally downscaled so its
 * width does not exceed `maxWidth`. The bitmap is flipped at decode time so row 0 is the nadir,
 * matching `equirectUV` with `flipY = false`.
 */
export async function loadBackgroundImage(url, tracker, maxWidth) {
  const handle = tracker?.track(url);
  const loader = new FileLoader().setResponseType("blob");
  const blob = await loader.loadAsync(url, (event) => handle?.progress(event));
  const probe = await createImageBitmap(blob);
  const scale = maxWidth && probe.width > maxWidth ? maxWidth / probe.width : 1;
  const width = Math.round(probe.width * scale);
  const height = Math.round(probe.height * scale);
  probe.close?.();
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "flipY",
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  });
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  handle?.finish();
  return texture;
}
