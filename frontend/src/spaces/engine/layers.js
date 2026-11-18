// Render layers. Layer 0 is the default: drawn by the main camera. The others keep each pass to
// what it needs:
//   shadowOnly            shadow cameras only (never in the view)
//   vegetationView        vegetation drawn in the main view (main camera only)
//   vegetationShadow      vegetation shadow casters, enabled only on the near cascades
//   vegetationReflection  vegetation for the water reflection (reflector camera only)
//   reflectable           what the water reflector draws (it does not see layer 0): standing
//                         architecture near the water, the avatar, the fountain jets
//   cascade 0..7          one layer per shadow cascade: a static caster carries the layer of each
//                         cascade its shadow can actually land in (shadowCasters.js), the avatar
//                         carries them all; cascade cameras do not see layer 0
export const LAYERS = Object.freeze({
  shadowOnly: 1,
  vegetationView: 2,
  vegetationShadow: 3,
  vegetationReflection: 4,
  reflectable: 6,
  cascadeBase: 8,
});

export const MAX_CASCADES = 8;

/** The layer of shadow cascade `index`. */
export const cascadeLayer = (index) => LAYERS.cascadeBase + index;

/** Mask with every cascade layer set (for casters that belong in all cascades, e.g. the avatar). */
export function allCascadesMask() {
  let mask = 0;
  for (let i = 0; i < MAX_CASCADES; i++) mask |= 1 << cascadeLayer(i);
  return mask;
}

/**
 * Layer masks for the shadow cascades: each cascade sees its own cascade layer and shadowOnly;
 * vegetation casters go only into cascades that start within `vegetationDistance`.
 * @param {number[]} starts start distance of each cascade (m)
 * @returns {number[]} a mask per cascade
 */
export function cascadeLayerMasks(starts, { vegetationDistance = 0 } = {}) {
  return starts.map((start, i) => {
    let mask = (1 << LAYERS.shadowOnly) | (1 << cascadeLayer(i));
    if (vegetationDistance > 0 && start < vegetationDistance) mask |= 1 << LAYERS.vegetationShadow;
    return mask;
  });
}
