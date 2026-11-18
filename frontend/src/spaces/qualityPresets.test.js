import { describe, expect, it } from "vitest";
import {
  QUALITY_KEYS,
  QUALITY_LABELS,
  QUALITY_PRESETS,
  classifyGpu,
  lowerQuality,
  persistsQuality,
  pickInitialQuality,
  stepDownNotice,
  readStoredQuality,
  summarizeFrameTimes,
  writeStoredQuality,
} from "./qualityPresets";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, value) };
}

describe("quality presets", () => {
  it("defines every preset with a Korean label, from heaviest to lightest", () => {
    expect(QUALITY_KEYS).toEqual(["max", "high", "balanced"]);
    expect(QUALITY_KEYS.map((key) => QUALITY_LABELS[key])).toEqual(["최대", "높음", "균형"]);
    for (const key of QUALITY_KEYS) expect(QUALITY_PRESETS[key]).toBeTruthy();
    expect(QUALITY_PRESETS.max.pixelRatio).toBeGreaterThan(QUALITY_PRESETS.balanced.pixelRatio);
    expect(QUALITY_PRESETS.max.vegetation.lodScale).toBeGreaterThan(QUALITY_PRESETS.balanced.vegetation.lodScale);
    expect(QUALITY_PRESETS.balanced.vegetation.maxLod0).toBeLessThan(QUALITY_PRESETS.high.vegetation.maxLod0);
    expect(QUALITY_PRESETS.max.vegetation.maxLod0).toBeGreaterThan(QUALITY_PRESETS.high.vegetation.maxLod0);
    expect(QUALITY_PRESETS.balanced.triangleBudget).toBe(1_500_000);
    expect(QUALITY_PRESETS.high.triangleBudget).toBe(4_000_000);
    expect(QUALITY_PRESETS.max.triangleBudget).toBe(10_000_000);
    expect(QUALITY_PRESETS.max.vegetation.shadowDistance).toBe(120);
    expect(QUALITY_PRESETS.high.vegetation.shadowDistance).toBe(60);
    expect(QUALITY_PRESETS.balanced.vegetation.shadowDistance).toBe(35);
  });

  it("steps down one preset at a time", () => {
    expect(lowerQuality("max")).toBe("high");
    expect(lowerQuality("high")).toBe("balanced");
    expect(lowerQuality("balanced")).toBeNull();
  });
});

describe("storage", () => {
  it("remembers only valid keys and survives broken storage", () => {
    const storage = memoryStorage();
    expect(readStoredQuality(storage)).toBeNull();
    writeStoredQuality(storage, "max");
    expect(readStoredQuality(storage)).toBe("max");
    writeStoredQuality(storage, "ultra");
    expect(readStoredQuality(storage)).toBe("max");
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readStoredQuality(broken)).toBeNull();
    expect(() => writeStoredQuality(broken, "high")).not.toThrow();
  });
});

describe("initial choice", () => {
  it("classifies common GPU strings", () => {
    expect(classifyGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 Direct3D11)")).toBe("high");
    expect(classifyGpu("intel gen-12lp")).toBe("low");
    expect(classifyGpu("Intel(R) Arc(TM) A770")).toBe("high");
    expect(classifyGpu("Google SwiftShader")).toBe("software");
    expect(classifyGpu("apple metal-3")).toBe("mid");
  });

  it("prefers a stored choice and never picks max by itself", () => {
    expect(pickInitialQuality({ stored: "max", backend: "webgl", gpuClass: "low" })).toBe("max");
    expect(pickInitialQuality({ stored: null, backend: "webgpu", gpuClass: "high" })).toBe("high");
    expect(pickInitialQuality({ stored: null, backend: "webgpu", gpuClass: "low" })).toBe("balanced");
    expect(pickInitialQuality({ stored: null, backend: "webgl", gpuClass: "mid" })).toBe("balanced");
    expect(pickInitialQuality({ stored: null, backend: "webgpu", gpuClass: "mid", mobile: true })).toBe("balanced");
  });

});

describe("summarizeFrameTimes", () => {
  it("computes average fps, 1% low and frame time", () => {
    const times = [...Array.from({ length: 99 }, () => 10), 50];
    const stats = summarizeFrameTimes(times);
    expect(stats.frameMs).toBeCloseTo(10.4, 6);
    expect(stats.fps).toBeCloseTo(1000 / 10.4, 6);
    expect(stats.low1).toBeCloseTo(20, 6);
    expect(summarizeFrameTimes([])).toEqual({ fps: 0, low1: 0, frameMs: 0 });
  });
});

describe("automatic quality changes", () => {
  it("never remember an automatic change and always explain it", () => {
    expect(persistsQuality("user")).toBe(true);
    for (const reason of ["gpu-error", "overload", "performance", "auto"]) {
      expect(persistsQuality(reason)).toBe(false);
      expect(stepDownNotice(reason, "높음")).toMatch(/높음/);
    }
    expect(stepDownNotice("user", "최대")).toBeNull();
  });
});
