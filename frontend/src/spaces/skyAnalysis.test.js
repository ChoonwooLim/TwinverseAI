import { describe, expect, it } from "vitest";
import {
  KEY_LIGHT,
  analyzeEquirect,
  azimuthElevation,
  clampHighlights,
  clampSunElevation,
  rotateY,
  sunDirectionFromAngles,
  sunIntensity,
} from "./skyAnalysis";

function expectVector(actual, expected, digits = 5) {
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
  expect(actual[2]).toBeCloseTo(expected[2], digits);
}

function skyImage(width, height, fill, bright) {
  const data = new Float32Array(width * height * 4).fill(fill);
  if (bright) {
    const i = (bright.row * width + bright.col) * 4;
    data[i] = data[i + 1] = data[i + 2] = bright.value;
  }
  return { data, width, height };
}

describe("sunDirectionFromAngles", () => {
  it("points to +Z at azimuth 0 and to -X at azimuth 90 (clockwise seen from above)", () => {
    expectVector(sunDirectionFromAngles(0, 0), [0, 0, 1]);
    expectVector(sunDirectionFromAngles(90, 0), [-1, 0, 0]);
    expectVector(sunDirectionFromAngles(0, 90), [0, 1, 0]);
  });
});

describe("rotateY", () => {
  it("matches a three.js Euler(0, angle, 0) rotation", () => {
    expectVector(rotateY([0, 0, 1], Math.PI / 2), [1, 0, 0]);
    expectVector(rotateY([1, 0, 0], Math.PI / 2), [0, 0, -1]);
  });
});

describe("clampSunElevation", () => {
  it("raises a low sun and keeps its azimuth", () => {
    const low = clampSunElevation([1, 0.05, 0], 20, 70);
    expect(Math.asin(low[1]) * (180 / Math.PI)).toBeCloseTo(20, 4);
    expect(low[2]).toBeCloseTo(0, 6);
    expect(low[0]).toBeGreaterThan(0);
  });

  it("leaves an in-range sun alone", () => {
    const sun = sunDirectionFromAngles(30, 45);
    expectVector(clampSunElevation(sun, 20, 70), sun);
  });
});

describe("analyzeEquirect", () => {
  it("finds the brightest texel as the sun direction", () => {
    // 16 x 8 image: row 2 is 22.5 deg above the horizon at its centre, column 12 is u = 0.78125.
    const image = skyImage(16, 8, 1, { row: 2, col: 12, value: 500 });
    const { sunDirection, skyLuminance, horizonColor } = analyzeEquirect(image);
    const latitude = (1 - 2.5 / 8 - 0.5) * Math.PI;
    const longitude = (12.5 / 16 - 0.5) * 2 * Math.PI;
    expectVector(sunDirection, [
      Math.cos(longitude) * Math.cos(latitude),
      Math.sin(latitude),
      Math.sin(longitude) * Math.cos(latitude),
    ]);
    expect(sunDirection[1]).toBeGreaterThan(0);
    expect(skyLuminance).toBeGreaterThan(1);
    expect(horizonColor).toEqual([1, 1, 1]);
  });

  it("reports no sun for an evenly lit sky", () => {
    expect(analyzeEquirect(skyImage(16, 8, 2)).sunDirection).toBeNull();
  });

  it("decodes packed values through the decode callback", () => {
    const image = skyImage(16, 8, 10, { row: 1, col: 3, value: 9000 });
    const result = analyzeEquirect({ ...image, decode: (value) => value / 10 });
    expect(result.skyLuminance).toBeGreaterThan(0.9);
    expect(result.sunDirection).not.toBeNull();
  });
});

describe("sun energy and key light", () => {
  it("separates the sun's energy from the sky and clamps it out of the lighting image", () => {
    const image = skyImage(64, 32, 1, { row: 6, col: 20, value: 100000 });
    const result = analyzeEquirect(image);
    expect(result.skyMedian).toBeGreaterThan(0.5);
    expect(result.skyMedian).toBeLessThan(2);
    expect(result.clampThreshold).toBeLessThan(100);
    // A uniform sky of radiance 1 gives irradiance pi on an upward surface.
    expect(result.skyIrradiance).toBeGreaterThan(Math.PI * 0.95);
    expect(result.skyIrradiance).toBeLessThan(Math.PI * 1.1);
    expect(result.sunIrradiance).toBeGreaterThan(10);
    expect(result.sunColor).toEqual([1, 1, 1]);

    const { data, clamped } = clampHighlights({ ...image, threshold: result.clampThreshold });
    expect(clamped).toBe(1);
    const i = (6 * 64 + 20) * 4;
    expect(data[i]).toBeCloseTo(result.clampThreshold, 4);
    expect(image.data[i]).toBe(100000); // the original is untouched
  });

  it("keeps the sun within the lit/shade ratio band", () => {
    const strong = sunIntensity({ sunIrradiance: 1000, skyIrradiance: 1, elevationSin: 0.5 });
    expect(strong.ratio).toBeCloseTo(KEY_LIGHT.maxRatio, 6);
    const clipped = sunIntensity({ sunIrradiance: 0.1, skyIrradiance: 1, elevationSin: 0.5 });
    expect(clipped.ratio).toBeCloseTo(KEY_LIGHT.minRatio, 6);
    const physical = sunIntensity({ sunIrradiance: 6.16, skyIrradiance: 1.27, elevationSin: Math.sin((43 * Math.PI) / 180) });
    expect(physical.intensity).toBeCloseTo(6.16, 6); // measured value already inside the band
    const none = sunIntensity({ sunIrradiance: 0, skyIrradiance: 1, elevationSin: 1 });
    expect(none.ratio).toBeCloseTo(KEY_LIGHT.defaultRatio, 6);
    expect(none.measured).toBe(false);
  });

  it("reports azimuth and elevation in the colliders.json convention", () => {
    const { azimuthDeg, elevationDeg } = azimuthElevation(sunDirectionFromAngles(90, 30));
    expect(azimuthDeg).toBeCloseTo(90, 6);
    expect(elevationDeg).toBeCloseTo(30, 6);
  });
});
