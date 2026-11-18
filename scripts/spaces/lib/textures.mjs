// Texture roles from the materials that use them, and the switch to KTX2 (KHR_texture_basisu).
import { Material } from "@gltf-transform/core";
import { KHRTextureBasisu } from "@gltf-transform/extensions";

const SRGB_SLOTS = new Set(["baseColorTexture", "emissiveTexture", "specularColorTexture", "sheenColorTexture", "diffuseTexture"]);
const NORMAL_SLOTS = new Set(["normalTexture", "clearcoatNormalTexture"]);
const CHANNELS = { occlusionTexture: [0], metallicRoughnessTexture: [1, 2], specularTexture: [3] };

function materialOf(property) {
  if (property instanceof Material) return property;
  for (const parent of property.listParents()) if (parent instanceof Material) return parent;
  return null;
}

/**
 * One job per texture with its role: colour (sRGB), mask / blend (sRGB with alpha test /
 * blending), normal, orm (linear data, with the channels that are read). Hero textures (and the
 * UASTC overrides) take the hero roles: hero, heroNormal, heroMask, heroBlend.
 * @param {{ isHero?: (materialName: string) => boolean, isOverride?: (textureName: string) => boolean }} [options]
 */
export function textureJobs(document, { isHero = () => false, isOverride = () => false } = {}) {
  const graph = document.getGraph();
  const jobs = [];
  for (const texture of document.getRoot().listTextures()) {
    const uses = [];
    for (const edge of graph.listParentEdges(texture)) {
      const parent = edge.getParent();
      if (parent.propertyType === "Root") continue;
      uses.push({ slot: edge.getName(), material: materialOf(parent) });
    }
    const name = texture.getName() || texture.getURI() || "texture";
    const hero = uses.some((u) => u.material && isHero(u.material.getName()));
    const override = !hero && isOverride(name);
    const job = { texture, name, hero, override, role: null, srgb: false, alphaCutoff: 0.5, channels: undefined, skip: null, slots: [...new Set(uses.map((u) => u.slot))] };
    jobs.push(job);
    if (texture.getMimeType() === "image/ktx2") {
      job.skip = "already KTX2";
      continue;
    }
    if (!uses.length) {
      job.skip = "unused";
      continue;
    }
    const srgb = uses.some((u) => SRGB_SLOTS.has(u.slot));
    const linear = uses.some((u) => !SRGB_SLOTS.has(u.slot));
    if (srgb && linear) {
      job.skip = `used as both colour and data (${job.slots.join(", ")})`;
      continue;
    }
    job.srgb = srgb;
    if (uses.some((u) => NORMAL_SLOTS.has(u.slot))) {
      if (uses.some((u) => !NORMAL_SLOTS.has(u.slot))) {
        job.skip = `used as both normal map and data (${job.slots.join(", ")})`;
        continue;
      }
      job.role = hero || override ? "heroNormal" : "normal";
      continue;
    }
    if (!srgb) {
      const channels = new Set();
      for (const use of uses) for (const c of CHANNELS[use.slot] ?? [0, 1, 2]) channels.add(c);
      job.role = "orm";
      job.channels = [...channels].sort();
      continue;
    }
    const base = uses.filter((u) => u.slot === "baseColorTexture" && u.material);
    const modes = new Set(base.map((u) => u.material.getAlphaMode()));
    if (modes.has("MASK")) {
      job.role = hero || override ? "heroMask" : "mask";
      job.alphaCutoff = Math.min(...base.filter((u) => u.material.getAlphaMode() === "MASK").map((u) => u.material.getAlphaCutoff()));
    } else if (modes.has("BLEND")) {
      job.role = hero || override ? "heroBlend" : "blend";
    } else {
      job.role = hero || override ? "hero" : "colour";
    }
  }
  return jobs;
}

/** Puts an encoded KTX2 image in place of the texture's image. */
export function applyKtx2(document, job, bytes) {
  const texture = job.texture;
  texture.setImage(bytes);
  texture.setMimeType("image/ktx2");
  const uri = texture.getURI();
  if (uri) texture.setURI(uri.replace(/\.[a-z0-9]+$/i, "") + ".ktx2");
}

/** Registers KHR_texture_basisu and drops image extensions no texture needs any more. */
export function finishTextureExtensions(document) {
  const textures = document.getRoot().listTextures();
  if (textures.some((t) => t.getMimeType() === "image/ktx2")) document.createExtension(KHRTextureBasisu).setRequired(true);
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === "EXT_texture_webp" && !textures.some((t) => t.getMimeType() === "image/webp")) extension.dispose();
    if (extension.extensionName === "EXT_texture_avif" && !textures.some((t) => t.getMimeType() === "image/avif")) extension.dispose();
  }
}
