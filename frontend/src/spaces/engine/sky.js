// Image-based lighting, sky, haze and the shadow-casting sun (cascaded shadow maps).
import { Color, DataTexture, DirectionalLight, EquirectangularReflectionMapping, Vector3 } from "three/webgpu";
import { exp, float, fog, positionView, positionWorld, uniform } from "three/tsl";
import { CSMShadowNode } from "three/addons/csm/CSMShadowNode.js";
import {
  analyzeEquirect,
  azimuthElevation,
  clampHighlights,
  clampSunElevation,
  rotateY,
  sunDirectionFromAngles,
  sunIntensity,
} from "../skyAnalysis";
import { hdrDecoder, hdrEncoder } from "./loaders";

/** Aerial perspective: fraction of haze = (1 - exp(-distance * DENSITY)) * exp(-height * FALLOFF). */
export const HAZE_DENSITY = 0.00015; // per metre: ~2 % at 150 m, ~6 % at 400 m
export const HAZE_HEIGHT_FALLOFF = 0.011; // per metre above y = 0
export const HAZE_MAX_AMOUNT = 0.35;
export const HAZE_MAX_LUMINANCE = 1;

/** Objects on this layer are rendered only by the sun's shadow cameras (e.g. coarse LOD shadow proxies). */
export const SHADOW_ONLY_LAYER = 1;

const DEG = Math.PI / 180;
const DEFAULT_SUN = [0.42, 0.72, 0.55];
const DEFAULT_SUN_COLOR = [1, 0.95, 0.88];

/** Copy of an equirect HDR texture with new pixel data and the same sampling settings. */
function cloneHDRWithData(source, data) {
  const { width, height } = source.image;
  const texture = new DataTexture(data, width, height, source.format, source.type);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = source.colorSpace;
  texture.flipY = source.flipY;
  texture.minFilter = source.minFilter;
  texture.magFilter = source.magFilter;
  texture.generateMipmaps = source.generateMipmaps;
  texture.name = `${source.name || "sky"} (sun removed)`;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Lighting setup from the sky HDR:
 * - the visible background is the original HDR (sun disc included),
 * - image-based lighting uses a copy with the sun clamped out, so shade only gets skylight and the
 *   shadow-casting DirectionalLight carries the sun's energy (measured from the HDR, kept within
 *   the KEY_LIGHT lit/shade band),
 * - the sun direction comes from colliders.sun, else the brightest HDR texel, else a default.
 */
export function setupSky(scene, { hdr, colliders }) {
  const skyRotation = (Number(colliders?.skyRotationDeg) || 0) * DEG;
  scene.environmentRotation.set(0, skyRotation, 0);
  scene.backgroundRotation.set(0, skyRotation, 0);
  // The HDR stays the scene background even with a separate backdrop image: reflections and SSR
  // need it, and the post pipeline swaps in the backdrop by coverage after tone mapping.
  scene.background = hdr;

  let analysis = { sunDirection: null, horizonColor: null, skyLuminance: 1, skyP99: 1, skyIrradiance: 0, sunIrradiance: 0 };
  let lighting = hdr;
  let clampedTexels = 0;
  try {
    const image = hdr.image;
    if (image?.data && image.width && image.height) {
      const decode = hdrDecoder(hdr);
      analysis = analyzeEquirect({ data: image.data, width: image.width, height: image.height, decode });
      if (analysis.sunIrradiance > 0) {
        const clamped = clampHighlights({
          data: image.data,
          width: image.width,
          height: image.height,
          threshold: analysis.clampThreshold,
          decode,
          encode: hdrEncoder(hdr),
        });
        clampedTexels = clamped.clamped;
        lighting = cloneHDRWithData(hdr, clamped.data);
      }
    }
  } catch (error) {
    console.warn("[spaces] Could not analyse the sky HDR.", error);
  }
  scene.environment = lighting;

  let sun = null;
  let sunSource = "default";
  const azimuth = Number(colliders?.sun?.azimuthDeg);
  const elevation = Number(colliders?.sun?.elevationDeg);
  if (Number.isFinite(azimuth) && Number.isFinite(elevation)) {
    sun = sunDirectionFromAngles(azimuth, elevation);
    sunSource = "colliders";
  } else if (analysis.sunDirection) {
    sun = rotateY(analysis.sunDirection, skyRotation);
    sunSource = "hdr";
  } else {
    sun = DEFAULT_SUN;
  }
  sun = clampSunElevation(sun, 15, 78);
  const key = sunIntensity({
    sunIrradiance: analysis.sunIrradiance,
    skyIrradiance: analysis.skyIrradiance,
    elevationSin: sun[1],
  });
  const tint = analysis.sunColor ?? DEFAULT_SUN_COLOR;
  // Keep some white in the tint so a strongly coloured HDR sun does not stain everything.
  const sunColor = new Color(0.7 * tint[0] + 0.3, 0.7 * tint[1] + 0.3, 0.7 * tint[2] + 0.3);

  const horizon = analysis.horizonColor ?? [0.62, 0.7, 0.8];
  const horizonLuminance = 0.2126 * horizon[0] + 0.7152 * horizon[1] + 0.0722 * horizon[2];
  // Haze takes the sky's own horizon radiance, capped so it never glows.
  const scale = horizonLuminance > HAZE_MAX_LUMINANCE ? HAZE_MAX_LUMINANCE / horizonLuminance : 1;
  const hazeColor = new Color(horizon[0] * scale, horizon[1] * scale, horizon[2] * scale);
  const angles = azimuthElevation(sun);

  return {
    sunDirection: new Vector3(...sun),
    sunSource,
    sunIntensity: key.intensity,
    sunRatio: key.ratio,
    sunMeasured: key.measured,
    sunColor,
    sunAzimuthDeg: angles.azimuthDeg,
    sunElevationDeg: angles.elevationDeg,
    lightingTexture: lighting,
    clampedTexels,
    hazeColor,
    skyLuminance: analysis.skyLuminance || 1,
    skyP99: analysis.skyP99 || 1,
    skyIrradiance: analysis.skyIrradiance,
    skyRotation,
  };
}

/**
 * Aerial perspective: exponential distance haze that thins with height and is capped so far
 * geometry keeps its contrast. Applied in every material via scene.fogNode.
 */
export function createHaze(scene, hazeColor) {
  const color = uniform(hazeColor.clone());
  const density = uniform(HAZE_DENSITY);
  const falloff = uniform(HAZE_HEIGHT_FALLOFF);
  const maxAmount = uniform(HAZE_MAX_AMOUNT);
  const distance = positionView.length();
  const heightFactor = exp(positionWorld.y.max(0).mul(falloff).negate());
  const factor = float(1).sub(exp(distance.mul(density).negate())).mul(heightFactor).min(maxAmount);
  scene.fogNode = fog(color, factor);
  return { color, density, falloff, maxAmount };
}

/** Haze fraction at a distance and height, for checks and tests. */
export function hazeAmount(distance, height = 0) {
  const amount = (1 - Math.exp(-distance * HAZE_DENSITY)) * Math.exp(-Math.max(0, height) * HAZE_HEIGHT_FALLOFF);
  return Math.min(HAZE_MAX_AMOUNT, amount);
}

/**
 * The sun: one DirectionalLight whose shadow is replaced by CSMShadowNode cascades.
 * PCFSoftShadowMap was removed in r187, so softness comes from PCF with `shadow.radius`.
 * The cascades are fitted to the camera frustum when first built; call `refit()` after the
 * camera's aspect or near/far changes (resize, fullscreen).
 */
export function createSun(scene, direction, settings, { intensity = 3, color = new Color(0xfff2e0) } = {}) {
  const light = new DirectionalLight(color, intensity);
  light.name = "Sun";
  light.castShadow = true;
  light.shadow.mapSize.set(settings.mapSize, settings.mapSize);
  light.shadow.bias = -0.00025;
  light.shadow.normalBias = settings.mapSize >= 4096 ? 0.025 : 0.04;
  light.shadow.radius = settings.radius;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 1200; // CSM sets the side bounds per cascade, not near/far
  // The cascades clone this camera, so they see the shadow-only layer too; the main camera does not.
  light.shadow.camera.layers.enable(SHADOW_ONLY_LAYER);
  light.position.copy(direction).multiplyScalar(400);
  light.target.position.set(0, 0, 0);
  scene.add(light, light.target);

  const csm = new CSMShadowNode(light, {
    cascades: settings.cascades,
    maxFar: settings.maxFar,
    mode: "practical",
    lightMargin: 160,
  });
  csm.fade = Boolean(settings.fade);
  light.shadow.shadowNode = csm;

  return {
    light,
    csm,
    settings: { ...settings },
    refit() {
      if (csm.camera) csm.updateFrustums();
    },
    dispose() {
      csm.dispose();
      light.shadow.map?.dispose?.();
      light.dispose?.();
      scene.remove(light, light.target);
    },
  };
}

export function sameShadowSettings(a, b) {
  return a && b && a.cascades === b.cascades && a.mapSize === b.mapSize && a.maxFar === b.maxFar
    && a.radius === b.radius && Boolean(a.fade) === Boolean(b.fade);
}
