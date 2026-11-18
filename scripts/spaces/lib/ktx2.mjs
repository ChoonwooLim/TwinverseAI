// KTX2 / Basis Universal encoding with measured quality (Node, dev-time only).
//
// Policy (agreed): hero textures (config.hero) keep their resolution and are UASTC with the
// strongest rate-distortion optimisation that still meets the hero thresholds; every other texture
// is ETC1S (colour, ORM, and normals under a mean angular error rule), UASTC only for the textures
// named in config.uastcOverrides (where ETC1S visibly failed at a review station).
// Each texture is tried with a chain of candidate encodings, cheapest first; every candidate is
// decoded again (the encoder module's own KTX2 transcoder, level 0 to RGBA) and measured against
// the source pixels, and the first one that meets its role's thresholds is kept (an ETC1S-only
// chain keeps its last step when none passes; the measurement is reported):
//   colour, emissive   PSNR (RGB) and the 99th-percentile absolute error, sRGB transfer
//   ORM                PSNR per used channel (occlusion R, roughness G, metalness B), linear
//   normal             angular error of the decoded normals: mean and 99th percentile
//   alpha-tested       colour PSNR where the texel is kept, plus the share of texels whose
//                      alpha test flips at the material's cutoff (fringes)
// All encodings carry a full mip chain.
import sharp from "sharp";

const BASIS_URL = new URL("../node_modules/ktx2-encoder/dist/basis/basis_encoder.js", import.meta.url);
const OPTIONS_URL = new URL("../node_modules/ktx2-encoder/dist/applyInputOptions.js", import.meta.url);
// Basis Universal 2.5 (ktx2-encoder 0.6) refuses inputs over 12 Mpix to protect its 32-bit WASM
// heap; 4096 x 4096 maps go through the previous encoder generation (ktx2-encoder 0.5.4, pinned
// as ktx2-encoder-legacy), which takes them in about 1.5 GB. Both write standard KTX2 that
// three.js's transcoder reads (checked by check-assets.mjs).
const LEGACY_BASIS_URL = new URL("../node_modules/ktx2-encoder-legacy/dist/basis/basis_encoder.js", import.meta.url);
const LEGACY_OPTIONS_URL = new URL("../node_modules/ktx2-encoder-legacy/dist/applyInputOptions.js", import.meta.url);
export const MAX_V25_TEXELS = 12 * 1024 * 1024;
/**
 * Mip filter (Basis resampler index 10 = Kaiser, the encoder default). Measured on a gate colour
 * map: its mips carry 30-37 % more high-frequency energy than a GPU-style 2x2 box chain (Lanczos4
 * 45-54 %, box 1 %), so the encoder's mips are not the softer ones. Mips are filtered in linear
 * light for colour maps and renormalised for normal maps.
 */
export const MIP_FILTER = 10;

const modules = new Map();
function basisModule(legacy = false) {
  if (!modules.has(legacy)) {
    modules.set(legacy, Promise.all([import((legacy ? LEGACY_BASIS_URL : BASIS_URL).href), import((legacy ? LEGACY_OPTIONS_URL : OPTIONS_URL).href)])
      .then(async ([{ default: BASIS }, { applyInputOptions }]) => {
        const module = await BASIS({ print() {}, printErr() {} });
        module.initializeBasis();
        return { module, applyInputOptions };
      }));
  }
  return modules.get(legacy);
}

/**
 * Role thresholds. Hero roles decide between UASTC strengths; the ETC1S roles only choose between
 * ETC1S steps (the measurement is reported either way). Normal maps are judged by their mean
 * angular error only: the 99th percentile measured texels on UV seams, not visible error.
 */
export const THRESHOLDS = {
  hero: { psnr: 40, p99: 12 },
  heroNormal: { meanDeg: 1.5 },
  heroMask: { psnr: 36, p99: 16, flips: 0.003 },
  heroBlend: { psnr: 40, p99: 12, alphaPsnr: 40 },
  colour: { psnr: 36, p99: 20 },
  orm: { psnr: 36, p99: 20 },
  normal: { meanDeg: 2.5 },
  mask: { psnr: 34, p99: 20, flips: 0.003 },
  blend: { psnr: 36, p99: 20, alphaPsnr: 36 },
};
const METRIC = { hero: "colour", heroNormal: "normal", heroMask: "mask", heroBlend: "blend", colour: "colour", orm: "orm", normal: "normal", mask: "mask", blend: "blend" };

/** Candidate encodings per role, cheapest first. */
// ETC1S quality levels above 192 gave byte-identical files in trials, so 255 is the top step.
// UASTC steps go from the strongest rate-distortion optimisation (smallest file) to none.
const UASTC_STEPS = ["uastc-rdo4", "uastc-rdo2", "uastc-rdo1", "uastc"];
export const CHAINS = {
  hero: UASTC_STEPS,
  heroNormal: UASTC_STEPS,
  heroMask: UASTC_STEPS,
  heroBlend: UASTC_STEPS,
  colour: ["etc1s-128", "etc1s-255"],
  orm: ["etc1s-128", "etc1s-255"],
  normal: ["etc1s-normal"],
  mask: ["etc1s-255"],
  blend: ["etc1s-255"],
};

const CANDIDATES = {
  "etc1s-128": { isUASTC: false, qualityLevel: 128, compressionLevel: 2 },
  "etc1s-192": { isUASTC: false, qualityLevel: 192, compressionLevel: 2 },
  "etc1s-255": { isUASTC: false, qualityLevel: 255, compressionLevel: 2 },
  "etc1s-normal": { isUASTC: false, qualityLevel: 255, compressionLevel: 2, isNormalMap: true },
  "uastc-rdo4": { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 4 },
  "uastc-rdo3": { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 3 },
  "uastc-rdo2": { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 2 },
  "uastc-rdo1": { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1 },
  uastc: { isUASTC: true, needSupercompression: true },
};

/** Decodes any image file to RGBA8 (top row first). */
export async function decodeImage(bytes) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

/**
 * Block-compressed GPU formats need base dimensions that are multiples of 4 (WebGL refuses the
 * upload, WebGPU fails validation). Such images (e.g. 2049 x 1366, 2 x 2) are resampled to the
 * nearest multiple of 4 (at least 4); texture coordinates are relative, so nothing moves.
 */
export async function alignToBlocks(image) {
  const fit = (v) => Math.max(4, Math.round(v / 4) * 4);
  const width = fit(image.width);
  const height = fit(image.height);
  if (width === image.width && height === image.height) return image;
  const raw = { width: image.width, height: image.height, channels: 4 };
  const { data, info } = await sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), { raw })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height, resizedFrom: [image.width, image.height] };
}

/** Downsamples RGBA8 pixels (Lanczos 3) to a target size (texel-density right-sizing). */
export async function resizeImage(image, [width, height]) {
  if (width === image.width && height === image.height) return image;
  const raw = { width: image.width, height: image.height, channels: 4 };
  const { data, info } = await sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), { raw })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

/**
 * Encodes RGBA8 pixels to KTX2 with one named candidate and a full mip chain (MIP_FILTER, in
 * linear light for colour, renormalised for normal maps). Images over 12 Mpix use the previous
 * encoder generation (see LEGACY_BASIS_URL).
 */
export async function encodeKtx2(image, candidate, { srgb, normal = false }) {
  const { module, applyInputOptions } = await basisModule(image.width * image.height > MAX_V25_TEXELS);
  const encoder = new module.BasisEncoder();
  const previousLog = console.log;
  console.log = () => {}; // the WASM encoder prints progress
  try {
    applyInputOptions({ ...CANDIDATES[candidate], generateMipmap: true, isKTX2File: true, isPerceptual: srgb && !normal, isSetKTX2SRGBTransferFunc: srgb }, encoder);
    encoder.setMipFilter(MIP_FILTER);
    encoder.setMipSRGB(Boolean(srgb));
    encoder.setMipRenormalize(Boolean(normal));
    encoder.setTexType(0);
    if (encoder.setSliceSourceImage(0, new Uint8Array(image.data), image.width, image.height, 0) === false) throw new Error("source image rejected");
    let capacity = Math.ceil(image.width * image.height * 4 * (4 / 3)) + 65536;
    for (let attempt = 0; attempt < 2; attempt++, capacity *= 2) {
      const out = new Uint8Array(capacity);
      const length = encoder.encode(out);
      if (length > 0) return out.slice(0, length);
    }
    throw new Error(`encode failed (${image.width} x ${image.height}, ${candidate})`);
  } finally {
    console.log = previousLog;
    encoder.delete();
  }
}

/** Level 0 of a KTX2 file as RGBA8, with the file's facts. */
export async function decodeKtx2(bytes) {
  const { module } = await basisModule();
  const file = new module.KTX2File(bytes);
  try {
    if (!file.isValid() || !file.startTranscoding()) throw new Error("invalid KTX2");
    const format = module.transcoder_texture_format.cTFRGBA32.value;
    const size = file.getImageTranscodedSizeInBytes(0, 0, 0, format);
    const data = new Uint8Array(size);
    if (!file.transcodeImage(data, 0, 0, 0, format, 0, -1, -1)) throw new Error("KTX2 transcode failed");
    return { data, width: file.getWidth(), height: file.getHeight(), levels: file.getLevels(), uastc: file.isUASTC(), srgb: file.isSRGB() };
  } finally {
    file.close();
    file.delete();
  }
}

const psnrOf = (sumSquares, count) => (sumSquares === 0 ? 99 : 10 * Math.log10((255 * 255 * count) / sumSquares));

function percentile(histogram, total, share) {
  let seen = 0;
  for (let v = 0; v < histogram.length; v++) {
    seen += histogram[v];
    if (seen >= total * share) return v;
  }
  return histogram.length - 1;
}

/**
 * Quality of `decoded` against `source` for a role.
 * @returns {object} metrics, including `pass` against THRESHOLDS[role]
 */
export function measureQuality(role, source, decoded, { alphaCutoff = 0.5, channels = [0, 1, 2] } = {}) {
  const a = source.data;
  const b = decoded.data;
  const n = source.width * source.height;
  const t = THRESHOLDS[role];
  const metric = METRIC[role];
  if (metric === "normal") {
    const bins = new Uint32Array(1801); // 0.1 degree bins up to 180
    let sum = 0;
    // As three.js reads a normal map: all three channels, mapped to -1..1 (then normalised).
    const unpack = (d, i, out) => {
      out[0] = d[i] / 127.5 - 1;
      out[1] = d[i + 1] / 127.5 - 1;
      out[2] = d[i + 2] / 127.5 - 1;
    };
    const p = [0, 0, 0];
    const q = [0, 0, 0];
    let valid = 0;
    for (let i = 0; i < n; i++) {
      unpack(a, i * 4, p);
      unpack(b, i * 4, q);
      // Texels that hold no direction (padding, empty atlas space) are not normals.
      if (Math.hypot(p[0], p[1], p[2]) < 0.5) continue;
      valid++;
      const lp = Math.hypot(p[0], p[1], p[2]) || 1;
      const lq = Math.hypot(q[0], q[1], q[2]) || 1;
      const cos = Math.max(-1, Math.min(1, (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (lp * lq)));
      const deg = (Math.acos(cos) * 180) / Math.PI;
      sum += deg;
      bins[Math.min(1800, Math.round(deg * 10))]++;
    }
    const meanDeg = valid ? sum / valid : 0;
    const p99Deg = valid ? percentile(bins, valid, 0.99) / 10 : 0;
    return { meanDeg: round(meanDeg, 3), p99Deg, pass: meanDeg <= t.meanDeg };
  }
  const histogram = new Uint32Array(256);
  let squares = 0;
  let counted = 0;
  let alphaSquares = 0;
  let flips = 0;
  const cutoff = alphaCutoff * 255;
  const perChannel = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const keepA = a[o + 3] >= cutoff;
    if (metric === "mask") {
      if (keepA !== b[o + 3] >= cutoff) flips++;
      if (!keepA) continue;
    }
    for (const c of channels) {
      const d = a[o + c] - b[o + c];
      squares += d * d;
      perChannel[c] += d * d;
      histogram[Math.abs(d)]++;
    }
    counted++;
    if (metric === "blend") {
      const d = a[o + 3] - b[o + 3];
      alphaSquares += d * d;
    }
  }
  const samples = counted * channels.length;
  const psnr = psnrOf(squares, samples);
  const p99 = percentile(histogram, samples, 0.99);
  const metrics = { psnr: round(psnr, 2), p99 };
  if (metric === "orm") metrics.channelPsnr = channels.map((c) => round(psnrOf(perChannel[c], counted), 2));
  if (metric === "mask") metrics.flips = round(flips / n, 5);
  if (metric === "blend") metrics.alphaPsnr = round(psnrOf(alphaSquares, counted), 2);
  const worst = metric === "orm" ? Math.min(...metrics.channelPsnr) : psnr;
  metrics.pass = worst >= t.psnr && p99 <= t.p99 && (metric !== "mask" || metrics.flips <= t.flips) && (metric !== "blend" || metrics.alphaPsnr >= t.alphaPsnr);
  return metrics;
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** GPU bytes of a KTX2 file once transcoded to a 16-byte-per-4x4-block format (BC7 / ASTC 4x4). */
export function ktx2GpuBytes(bytes, { skipLevels = 0 } = {}) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(20, true);
  const height = view.getUint32(24, true);
  const levels = Math.max(1, view.getUint32(40, true));
  let total = 0;
  for (let level = skipLevels; level < levels; level++) {
    const w = Math.max(1, width >> level);
    const h = Math.max(1, height >> level);
    total += Math.ceil(w / 4) * Math.ceil(h / 4) * 16;
  }
  return total;
}

/**
 * Encodes one image with its role's chain and returns the first candidate that passes (or the
 * last one tried when none does, flagged), with every trial's size and metrics. With `trials`
 * ({ get(candidate), set(candidate, bytes) }), encodings already made are reused, so changing a
 * chain or a threshold only measures again.
 */
export async function encodeForRole(sourceBytes, { role, srgb, alphaCutoff = 0.5, channels, resize = null }, trialCache = null) {
  const decoded = await decodeImage(sourceBytes);
  const sourceSize = [decoded.width, decoded.height];
  const image = await alignToBlocks(resize ? await resizeImage(decoded, resize) : decoded);
  const normal = METRIC[role] === "normal";
  const trials = [];
  for (const candidate of CHAINS[role]) {
    const t0 = Date.now();
    let bytes = trialCache?.get(candidate) ?? null;
    if (!bytes) {
      bytes = await encodeKtx2(image, candidate, { srgb, normal });
      trialCache?.set(candidate, bytes);
    }
    const decoded = await decodeKtx2(bytes);
    const metrics = measureQuality(role, image, decoded, { alphaCutoff, channels });
    trials.push({ candidate, bytes: bytes.byteLength, metrics, seconds: (Date.now() - t0) / 1000, data: bytes });
    if (metrics.pass) break;
  }
  const chosen = trials.find((trial) => trial.metrics.pass) ?? trials[trials.length - 1];
  return {
    bytes: chosen.data,
    candidate: chosen.candidate,
    passed: chosen.metrics.pass,
    width: image.width,
    height: image.height,
    sourceSize,
    resizedFrom: image.resizedFrom ?? null,
    trials: trials.map(({ data: _data, ...rest }) => rest),
  };
}
