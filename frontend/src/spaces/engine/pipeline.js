// TSL post-processing graph per quality preset (r187 RenderPipeline + addons/tsl/display nodes).
//
// HDR scene pass (+ MRT) -> SSGI or GTAO -> SSR -> bloom (+ lens flare) -> TRAA
//   -> AgX tone mapping -> optional tonemapped backdrop -> depth of field -> vignette / grain
//   -> sRGB output -> optional FXAA.
//
// Backdrop: when a separate tonemapped sky image is supplied, the scene still renders the HDR sky
// (so reflections and SSR see it), and the pass's alpha is replaced by geometry coverage taken
// from the depth of the same jittered frame. TRAA resolves that coverage together with the colour,
// so the backdrop can be blended in after tone mapping with anti-aliased silhouettes.
import {
  AgXToneMapping,
  Matrix3,
  Matrix4,
  NoToneMapping,
  RenderPipeline,
  SRGBColorSpace,
  UnsignedByteType,
} from "three/webgpu";
import {
  diffuseColor,
  equirectUV,
  float,
  getViewPosition,
  isBackgroundDepth,
  length,
  materialReference,
  mix,
  mrt,
  normalView,
  output,
  packNormalToRGB,
  pass,
  renderOutput,
  roughness,
  sample,
  screenUV,
  smoothstep,
  texture,
  toneMapping,
  toneMappingExposure,
  uniform,
  unpackRGBToNormal,
  vec2,
  vec4,
  velocity,
} from "three/tsl";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { ssgi } from "three/addons/tsl/display/SSGINode.js";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { lensflare } from "three/addons/tsl/display/LensflareNode.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { film } from "three/addons/tsl/display/FilmNode.js";

/**
 * Uniforms that live across pipeline rebuilds (updated every frame by the engine).
 */
export function createPipelineUniforms() {
  return {
    backdropProjectionInverse: uniform(new Matrix4()),
    backdropCameraWorld: uniform(new Matrix4()),
    backdropRotation: uniform(new Matrix3()),
    focusDistance: uniform(20),
    focalLength: uniform(6),
    bokehScale: uniform(3),
    vignette: uniform(0.24),
    grain: uniform(0),
    bloomStrength: uniform(0.12),
    bloomThreshold: uniform(3),
  };
}

/**
 * Builds the output graph for a preset.
 * @param {{ renderer: any, scene: any, camera: any, preset: any, uniforms: any,
 *   backdrop: any, photoMode: boolean, reducedMotion: boolean }} options
 * @returns {{ pipeline: RenderPipeline, features: string[], dispose(): void }}
 */
export function buildPipeline({ renderer, scene, camera, preset, uniforms, backdrop, photoMode, reducedMotion }) {
  const effects = [];
  const track = (node) => {
    effects.push(node);
    return node;
  };
  const features = [];

  const useTRAA = preset.antialias === "traa";
  let traaNode = null;
  const useSSGI = preset.ambient === "ssgi";
  const useGTAO = preset.ambient === "gtao";
  const useSSR = Boolean(preset.ssr);
  const needsNormal = useSSGI || useGTAO || useSSR;
  const needsDiffuse = useSSGI || useSSR;

  const scenePass = track(pass(scene, camera));
  const outputs = { output };
  if (needsNormal) {
    // Normal in rgb; the SSR strength of the surface rides along in alpha.
    outputs.normal = useSSR
      ? vec4(packNormalToRGB(normalView), materialReference("userData.ssrStrength", "float"))
      : vec4(packNormalToRGB(normalView), float(0));
  }
  if (needsDiffuse) outputs.diffuse = vec4(diffuseColor.rgb, roughness);
  if (useTRAA) outputs.velocity = velocity;
  if (Object.keys(outputs).length > 1) scenePass.setMRT(mrt(outputs));
  // Bandwidth: 8-bit is plenty for packed normals, albedo and roughness.
  if (outputs.normal) scenePass.getTexture("normal").type = UnsignedByteType;
  if (outputs.diffuse) scenePass.getTexture("diffuse").type = UnsignedByteType;

  const sceneColor = scenePass.getTextureNode("output");
  const sceneDepth = scenePass.getTextureNode("depth");
  const normalTexture = outputs.normal ? scenePass.getTextureNode("normal") : null;
  const diffuseTexture = outputs.diffuse ? scenePass.getTextureNode("diffuse") : null;
  const sceneNormal = normalTexture ? sample((uv) => unpackRGBToNormal(normalTexture.sample(uv).rgb)) : null;

  let hdr = sceneColor;

  if (useSSGI) {
    const giPass = track(ssgi(sceneColor, sceneDepth, sceneNormal, camera));
    giPass.sliceCount.value = 2;
    giPass.stepCount.value = 8;
    giPass.radius.value = 10;
    giPass.useTemporalFiltering = useTRAA;
    const occlusion = giPass.getAONode().r;
    const indirect = giPass.getGINode().rgb;
    hdr = vec4(sceneColor.rgb.mul(occlusion).add(diffuseTexture.rgb.mul(indirect)), sceneColor.a);
    features.push("SSGI");
  } else if (useGTAO) {
    const aoPass = track(ao(sceneDepth, sceneNormal, camera));
    aoPass.resolutionScale = 0.5;
    aoPass.samples.value = 12;
    aoPass.radius.value = 0.8;
    aoPass.useTemporalFiltering = useTRAA;
    const occlusion = aoPass.getTextureNode().r;
    hdr = vec4(sceneColor.rgb.mul(mix(float(1), occlusion, 0.85)), sceneColor.a);
    features.push("GTAO");
  }

  if (useSSR) {
    const reflections = track(ssr(sceneColor, sceneDepth, sceneNormal, {
      metalnessNode: normalTexture.a,
      roughnessNode: diffuseTexture.a,
      camera,
    }));
    reflections.resolutionScale = 0.5;
    reflections.quality.value = 0.5;
    reflections.maxDistance.value = 45;
    reflections.thickness.value = 0.4;
    // Composited additively: the strength mask, distance fade and grazing Fresnel are applied
    // inside SSRNode (non-stochastic mode) and the mask is 0 everywhere except glass and paving.
    hdr = vec4(hdr.rgb.add(reflections.rgb), hdr.a);
    features.push("SSR");
  }

  if (preset.bloom) {
    const glow = track(bloom(hdr, uniforms.bloomStrength, 0.35, uniforms.bloomThreshold));
    let added = glow.rgb;
    if (preset.lensflare) {
      const flare = track(lensflare(glow, { threshold: float(0.35), ghostAttenuationFactor: float(28), ghostSpacing: float(0.22) }));
      const softened = track(gaussianBlur(flare, null, 6));
      added = added.add(softened.rgb.mul(0.6));
      features.push("렌즈 플레어");
    }
    hdr = vec4(hdr.rgb.add(added), hdr.a);
    features.push("블룸");
  }

  if (backdrop) {
    const coverage = isBackgroundDepth(sceneDepth.r).select(float(0), float(1));
    hdr = vec4(hdr.rgb, coverage);
  }

  if (useTRAA) {
    hdr = track(traa(hdr, sceneDepth, scenePass.getTextureNode("velocity"), camera));
    traaNode = hdr;
    features.push("TRAA");
  }

  // AgX tone mapping, exposure from renderer.toneMappingExposure.
  const mapped = toneMapping(AgXToneMapping, toneMappingExposure, vec4(hdr.rgb, float(1))).rgb;
  let ldr = vec4(mapped, float(1));

  if (backdrop) {
    const viewDirection = getViewPosition(screenUV, float(1), uniforms.backdropProjectionInverse);
    const worldDirection = uniforms.backdropCameraWorld.mul(vec4(viewDirection, 0)).xyz.normalize();
    const skyDirection = uniforms.backdropRotation.mul(worldDirection);
    const sky = texture(backdrop, equirectUV(skyDirection)).level(0).rgb;
    ldr = vec4(mix(sky, mapped, hdr.a.clamp(0, 1)), float(1));
    features.push("8K 배경");
  }

  if (photoMode) {
    ldr = track(dof(ldr, scenePass.getViewZNode(), uniforms.focusDistance, uniforms.focalLength, uniforms.bokehScale));
    features.push("피사계 심도");
  }

  const centred = screenUV.sub(0.5).mul(vec2(1, 0.82));
  const vignette = mix(float(1), float(1).sub(smoothstep(0.22, 0.85, length(centred))), uniforms.vignette);
  ldr = vec4(ldr.rgb.mul(vignette), ldr.a);
  if (preset.grain > 0 && !reducedMotion) ldr = film(ldr, uniforms.grain);

  let final = renderOutput(ldr, NoToneMapping, SRGBColorSpace);
  if (preset.antialias === "fxaa") {
    final = track(fxaa(final));
    features.push("FXAA");
  }

  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = final;

  return {
    pipeline,
    scenePass,
    // The temporal AA node (or null), so review captures can restart its history.
    traa: traaNode,
    features,
    dispose() {
      pipeline.dispose();
      for (const node of effects) node.dispose?.();
    },
  };
}
