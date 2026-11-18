/**
 * Rendering quality presets for walkable spaces. Pure data and helpers, no three.js.
 *
 * | Feature                  | 균형 (balanced)        | 높음 (high)                 | 최대 (max)                               |
 * |--------------------------|------------------------|-----------------------------|------------------------------------------|
 * | Pixel ratio cap          | 1.0, <= 2.1 MP         | 1.5, <= 3.7 MP              | 2.0, <= 8.3 MP (4K)                      |
 * | Anti-aliasing            | FXAA (after output)    | TRAA                        | TRAA                                     |
 * | Ambient occlusion / GI   | none                   | GTAO, half res, temporal    | SSGI (GI + AO), 2 slices x 8 steps       |
 * | Screen-space reflections | none                   | none                        | SSR on glass and paving (half res)       |
 * | Water reflection         | environment only       | planar, 0.35 res, <= 180 m  | planar, 0.5 res, <= 250 m (in view only) |
 * | Sun shadows (CSM, PCF)   | 2 cascades 2048, 160 m | 3 cascades 2048, 320 m      | 4 cascades 4096, 600 m, cascade fade     |
 * | Bloom / lens flare       | off / off              | on / off                    | on / on                                  |
 * | Haze (aerial perspective)| on                     | on                          | on                                       |
 * | Vignette / film grain    | on / off               | on / off                    | on / on (grain off with reduced motion)  |
 * | Fountain particles / jet | 500                    | 1 400                       | 3 500                                    |
 * | Vegetation budget        | 1.5 M                  | 4 M                         | 10 M (all vegetation passes)             |
 * | Vegetation LOD scale     | 0.6                    | 0.8                         | 1.0 (the budget shrinks it when over)    |
 * | Max LOD0 plants (all sp.)| 3                      | 6                           | 10                                       |
 * | Tree draw distance       | 260 m                  | 400 m                       | 600 m                                    |
 * | Small plants             | 60 m / 150 m by height, cut at last LOD x 1.0 / 1.2 / 1.4, scale fade-in      |
 * | Vegetation shadows       | within 35 m, LOD2      | within 60 m, LOD2           | within 120 m, LOD2 (near cascades only)  |
 * | Vegetation in reflection | none                   | within 60 m, cheapest LOD   | within 90 m, cheapest LOD                |
 * | Static shadow casters    | each cascade draws only the casters whose shadow can land in its region      |
 *
 * Shared by all presets: HDRI image-based lighting (PMREM), AgX tone mapping with exposure,
 * texture anisotropy 16, wind on foliage and flags, animated water ripples.
 */

export const QUALITY_KEYS = ["max", "high", "balanced"];

export const QUALITY_LABELS = { max: "최대", high: "높음", balanced: "균형" };

export const QUALITY_PRESETS = {
  balanced: {
    pixelRatio: 1,
    maxPixels: 2_100_000,
    antialias: "fxaa",
    ambient: "none",
    ssr: false,
    water: { reflection: "env", resolutionScale: 0 },
    shadows: { cascades: 2, mapSize: 2048, maxFar: 160, radius: 1.5, fade: false },
    bloom: false,
    lensflare: false,
    vignette: 0.22,
    grain: 0,
    fountainParticles: 500,
    triangleBudget: 1_500_000,
    vegetation: { lodScale: 0.6, maxLod0: 3, farDistance: 260, smallPlantFactor: 1, shadowDistance: 35, reflectionDistance: 0 },
  },
  high: {
    pixelRatio: 1.5,
    maxPixels: 3_700_000,
    antialias: "traa",
    ambient: "gtao",
    ssr: false,
    water: { reflection: "planar", resolutionScale: 0.35, reflectionDistance: 180 },
    shadows: { cascades: 3, mapSize: 2048, maxFar: 320, radius: 2, fade: false },
    bloom: true,
    lensflare: false,
    vignette: 0.24,
    grain: 0,
    fountainParticles: 1400,
    triangleBudget: 4_000_000,
    vegetation: { lodScale: 0.8, maxLod0: 6, farDistance: 400, smallPlantFactor: 1.2, shadowDistance: 60, reflectionDistance: 60 },
  },
  max: {
    pixelRatio: 2,
    maxPixels: 8_300_000,
    antialias: "traa",
    ambient: "ssgi",
    ssr: true,
    water: { reflection: "planar", resolutionScale: 0.5, reflectionDistance: 250 },
    shadows: { cascades: 4, mapSize: 4096, maxFar: 600, radius: 2.5, fade: true },
    bloom: true,
    lensflare: true,
    vignette: 0.24,
    grain: 0.05,
    fountainParticles: 3500,
    triangleBudget: 10_000_000,
    vegetation: { lodScale: 1, maxLod0: 10, farDistance: 600, smallPlantFactor: 1.4, shadowDistance: 120, reflectionDistance: 90 },
  },
};

export const QUALITY_STORAGE_KEY = "twinverse.space.quality";

/** Only the visitor's own choice is remembered; automatic changes last for the session. */
export function persistsQuality(reason) {
  return reason === "user";
}

/** The notice shown for an automatic step-down (always shown), or null for the visitor's own choice. */
export function stepDownNotice(reason, label) {
  if (reason === "user") return null;
  if (reason === "gpu-error") return `그래픽 오류가 발생해 이번 방문 동안 품질을 '${label}'(으)로 낮췄습니다. 설정에서 다시 바꿀 수 있습니다.`;
  if (reason === "overload") return `화면이 너무 느려 이번 방문 동안 품질을 '${label}'(으)로 낮췄습니다. 설정에서 다시 바꿀 수 있습니다.`;
  return `화면이 버벅여 이번 방문 동안 품질을 '${label}'(으)로 낮췄습니다. 설정에서 다시 바꿀 수 있습니다.`;
}

export function isQualityKey(value) {
  return typeof value === "string" && Object.hasOwn(QUALITY_PRESETS, value);
}

/** The next lower preset, or null when already at the lowest. */
export function lowerQuality(key) {
  const index = QUALITY_KEYS.indexOf(key);
  if (index < 0 || index === QUALITY_KEYS.length - 1) return null;
  return QUALITY_KEYS[index + 1];
}

export function readStoredQuality(storage) {
  try {
    const value = storage?.getItem(QUALITY_STORAGE_KEY);
    return isQualityKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredQuality(storage, key) {
  try {
    if (isQualityKey(key)) storage?.setItem(QUALITY_STORAGE_KEY, key);
  } catch {
    // Private mode or blocked storage: the choice simply is not remembered.
  }
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;
const LOW_POWER_GPU = /mali|adreno|powervr|videocore|intel(?!.*\barc\b)|\buhd\b|\biris\b|apple gpu/i;
const DISCRETE_GPU = /nvidia|geforce|quadro|\brtx\b|\bgtx\b|radeon (rx|pro)|\barc\b/i;

/**
 * Rough GPU class from adapter / renderer strings: "software", "low", "mid" or "high".
 * @param {string} description vendor, architecture and renderer strings joined together
 */
export function classifyGpu(description) {
  const text = String(description || "");
  if (SOFTWARE_GPU.test(text)) return "software";
  if (DISCRETE_GPU.test(text)) return "high";
  if (LOW_POWER_GPU.test(text)) return "low";
  return "mid";
}

/**
 * Initial preset: a remembered choice wins; otherwise pick from the active backend and the GPU
 * class. "max" is never chosen automatically.
 * @param {{ stored?: string | null, backend: "webgpu" | "webgl", gpuClass: string, mobile?: boolean }} input
 */
export function pickInitialQuality({ stored, backend, gpuClass, mobile = false }) {
  if (isQualityKey(stored)) return stored;
  if (gpuClass === "software" || mobile) return "balanced";
  if (backend !== "webgpu") return gpuClass === "high" ? "high" : "balanced";
  return gpuClass === "low" ? "balanced" : "high";
}

/**
 * Frame statistics over a window of frame times: average fps, "1% low" fps (the fps of the
 * slowest 1% of frames) and the average frame time.
 */
export function summarizeFrameTimes(frameTimesMs) {
  if (!frameTimesMs.length) return { fps: 0, low1: 0, frameMs: 0 };
  const total = frameTimesMs.reduce((sum, value) => sum + value, 0);
  const average = total / frameTimesMs.length;
  const sorted = [...frameTimesMs].sort((a, b) => b - a);
  const worstCount = Math.max(1, Math.round(sorted.length * 0.01));
  const worst = sorted.slice(0, worstCount).reduce((sum, value) => sum + value, 0) / worstCount;
  return { fps: 1000 / average, low1: 1000 / worst, frameMs: average };
}
