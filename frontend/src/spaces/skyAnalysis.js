/**
 * Sky and sun maths for walkable spaces. Pure functions, no three.js.
 *
 * Equirectangular convention (matches three.js `equirectUV` with an HDR loaded `flipY: true`):
 * data row 0 is the zenith, u = atan2(z, x) / 2π + 0.5, v = asin(y) / π + 0.5.
 */

const DEG = Math.PI / 180;

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Direction from the scene towards the sun for the `colliders.json` "sun" field.
 * Azimuth 0 points to +Z and grows clockwise seen from above (looking down -Y with +X to the
 * right, so 90 deg points to -X). Elevation is measured up from the horizon.
 * @returns {[number, number, number]}
 */
export function sunDirectionFromAngles(azimuthDeg, elevationDeg) {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return normalize([-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
}

/** Rotates a direction about +Y by `radians` (same sense as three.js `Euler(0, radians, 0)`). */
export function rotateY(v, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

/** Keeps the sun between `minDeg` and `maxDeg` above the horizon, preserving its azimuth. */
export function clampSunElevation(v, minDeg = 18, maxDeg = 75) {
  const n = normalize(v);
  const horizontal = Math.hypot(n[0], n[2]);
  const elevation = Math.atan2(n[1], horizontal);
  const clamped = Math.min(maxDeg * DEG, Math.max(minDeg * DEG, elevation));
  if (clamped === elevation) return n;
  const hx = horizontal > 1e-6 ? n[0] / horizontal : 0;
  const hz = horizontal > 1e-6 ? n[2] / horizontal : 1;
  return [hx * Math.cos(clamped), Math.sin(clamped), hz * Math.cos(clamped)];
}

/**
 * Key-light balance. Lit / shadowed brightness of a horizontal surface is 1 + ratio, where
 * ratio = sun irradiance on that surface / sky irradiance. A clear day reads as clear when the
 * sunlit side is roughly 3 to 5 times brighter than the shade.
 */
export const KEY_LIGHT = { minRatio: 2.2, maxRatio: 4, defaultRatio: 3 };

// Log2 luminance histogram (4 bins per octave from 2^-14 to 2^20) for cheap percentiles.
const HIST_MIN_EXP = -14;
const HIST_BINS_PER_OCTAVE = 4;
const HIST_BINS = (20 - HIST_MIN_EXP) * HIST_BINS_PER_OCTAVE;

function histogramBin(luminance) {
  if (!(luminance > 0)) return 0;
  const bin = Math.floor((Math.log2(luminance) - HIST_MIN_EXP) * HIST_BINS_PER_OCTAVE);
  return Math.min(HIST_BINS - 1, Math.max(0, bin));
}

function histogramPercentile(histogram, total, fraction) {
  const target = total * fraction;
  let seen = 0;
  for (let bin = 0; bin < HIST_BINS; bin++) {
    seen += histogram[bin];
    if (seen >= target) return 2 ** (HIST_MIN_EXP + (bin + 1) / HIST_BINS_PER_OCTAVE);
  }
  return 2 ** 20;
}

/**
 * Scans an equirectangular HDR and returns:
 * - `sunDirection`: unit vector to the brightest texel in the upper hemisphere, or null when it
 *   is not clearly brighter than the sky (overcast HDRIs),
 * - `clampThreshold`: luminance above which texels count as the sun (disc and hot aureole),
 * - `skyIrradiance`: irradiance on an upward surface from the sky with the sun clamped out,
 * - `sunIrradiance`: the clamped-out energy as irradiance perpendicular to the sun (what a
 *   DirectionalLight intensity means), and `sunColor` (linear RGB, max component 1),
 * - `horizonColor`: mean linear RGB within 8 degrees of the horizon (haze colour),
 * - `skyLuminance` (mean), `skyMedian` and `skyP99` of the upper hemisphere.
 *
 * Units follow the HDR: radiance x steradians, the same units three.js uses for light intensity.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number, channels?: number,
 *   decode?: (value: number) => number, minRatio?: number }} image
 */
export function analyzeEquirect({ data, width, height, channels = 4, decode = (value) => value, minRatio = 8 }) {
  let best = -1;
  let bestRow = 0;
  let bestCol = 0;
  let skySum = 0;
  let skyCount = 0;
  const horizon = [0, 0, 0];
  let horizonCount = 0;
  const horizonBand = Math.max(1, Math.round((8 / 180) * height));
  const middle = height / 2;
  const histogram = new Uint32Array(HIST_BINS);
  const luminanceAt = (i) => {
    const r = decode(data[i]);
    const g = decode(data[i + 1]);
    const b = decode(data[i + 2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (let row = 0; row < height; row++) {
    const upper = row < middle;
    const nearHorizon = Math.abs(row + 0.5 - middle) <= horizonBand;
    if (!upper && !nearHorizon) continue;
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * channels;
      const luminance = luminanceAt(i);
      if (luminance === null) continue;
      if (upper) {
        skySum += luminance;
        skyCount++;
        histogram[histogramBin(luminance)]++;
        if (luminance > best) {
          best = luminance;
          bestRow = row;
          bestCol = col;
        }
      }
      if (nearHorizon) {
        horizon[0] += decode(data[i]);
        horizon[1] += decode(data[i + 1]);
        horizon[2] += decode(data[i + 2]);
        horizonCount++;
      }
    }
  }

  const skyLuminance = skyCount > 0 ? skySum / skyCount : 0;
  const skyMedian = skyCount > 0 ? histogramPercentile(histogram, skyCount, 0.5) : 0;
  const skyP99 = skyCount > 0 ? histogramPercentile(histogram, skyCount, 0.99) : 0;
  const clampThreshold = Math.max(4 * skyP99, 16 * skyMedian, 1e-3);
  const horizonColor = horizonCount > 0
    ? [horizon[0] / horizonCount, horizon[1] / horizonCount, horizon[2] / horizonCount]
    : null;

  // Second pass over the upper hemisphere: split sky irradiance from the sun's energy.
  let skyIrradiance = 0;
  let sunIrradiance = 0;
  const sunRGB = [0, 0, 0];
  const rowSolidAngle = ((2 * Math.PI) / width) * (Math.PI / height);
  for (let row = 0; row < middle; row++) {
    const latitude = (1 - (row + 0.5) / height - 0.5) * Math.PI;
    const solidAngle = rowSolidAngle * Math.cos(latitude);
    const cosZenith = Math.max(0, Math.sin(latitude));
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * channels;
      const luminance = luminanceAt(i);
      if (luminance === null || luminance <= 0) continue;
      const kept = Math.min(luminance, clampThreshold);
      skyIrradiance += kept * cosZenith * solidAngle;
      if (luminance > clampThreshold) {
        const removedShare = 1 - clampThreshold / luminance;
        sunIrradiance += (luminance - clampThreshold) * solidAngle;
        sunRGB[0] += decode(data[i]) * removedShare * solidAngle;
        sunRGB[1] += decode(data[i + 1]) * removedShare * solidAngle;
        sunRGB[2] += decode(data[i + 2]) * removedShare * solidAngle;
      }
    }
  }
  const sunMax = Math.max(sunRGB[0], sunRGB[1], sunRGB[2]);
  const sunColor = sunMax > 0 ? [sunRGB[0] / sunMax, sunRGB[1] / sunMax, sunRGB[2] / sunMax] : null;

  let sunDirection = null;
  if (best > 0 && skyLuminance > 0 && best >= skyLuminance * minRatio) {
    const u = (bestCol + 0.5) / width;
    const v = 1 - (bestRow + 0.5) / height;
    const latitude = (v - 0.5) * Math.PI;
    const longitude = (u - 0.5) * 2 * Math.PI;
    sunDirection = normalize([
      Math.cos(longitude) * Math.cos(latitude),
      Math.sin(latitude),
      Math.sin(longitude) * Math.cos(latitude),
    ]);
  }

  return {
    sunDirection,
    horizonColor,
    skyLuminance,
    skyMedian,
    skyP99,
    clampThreshold,
    skyIrradiance,
    sunIrradiance,
    sunColor,
    peakLuminance: Math.max(best, 0),
  };
}

/**
 * Copy of the equirect data with every texel brighter than `threshold` scaled down to it (hue
 * kept). Used to take the sun out of the image-based lighting so the shadow-casting
 * DirectionalLight supplies it instead and shade stays shade.
 * @returns {{ data: any, clamped: number }}
 */
export function clampHighlights({ data, width, height, channels = 4, threshold, decode = (v) => v, encode = (v) => v }) {
  const out = data.slice();
  let clamped = 0;
  for (let p = 0, n = width * height; p < n; p++) {
    const i = p * channels;
    const r = decode(data[i]);
    const g = decode(data[i + 1]);
    const b = decode(data[i + 2]);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (!(luminance > threshold)) continue;
    const scale = threshold / luminance;
    out[i] = encode(r * scale);
    out[i + 1] = encode(g * scale);
    out[i + 2] = encode(b * scale);
    clamped++;
  }
  return { data: out, clamped };
}

/**
 * DirectionalLight intensity for the sun: the HDR's measured sun energy, kept within the
 * KEY_LIGHT ratio band against the sky so the scene neither reads overcast (clipped HDR suns)
 * nor harsh. Falls back to the default ratio when the HDR has no distinct sun.
 * @returns {{ intensity: number, ratio: number, measured: boolean }}
 */
export function sunIntensity({ sunIrradiance, skyIrradiance, elevationSin }) {
  const sky = Math.max(skyIrradiance || 0, 0.05);
  const sin = Math.max(elevationSin || 0, 0.25);
  const min = (KEY_LIGHT.minRatio * sky) / sin;
  const max = (KEY_LIGHT.maxRatio * sky) / sin;
  const measured = sunIrradiance > 0;
  const intensity = measured ? Math.min(max, Math.max(min, sunIrradiance)) : (KEY_LIGHT.defaultRatio * sky) / sin;
  return { intensity, ratio: (intensity * sin) / sky, measured };
}

/** Azimuth (0 = +Z, clockwise seen from above, 90 = -X) and elevation in degrees. */
export function azimuthElevation(v) {
  const n = normalize(v);
  const azimuth = ((Math.atan2(-n[0], n[2]) * 180) / Math.PI + 360) % 360;
  const elevation = (Math.asin(Math.min(1, Math.max(-1, n[1]))) * 180) / Math.PI;
  return { azimuthDeg: azimuth, elevationDeg: elevation };
}
