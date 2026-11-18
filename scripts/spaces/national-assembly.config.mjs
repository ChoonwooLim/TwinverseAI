// Asset pipeline settings for the National Assembly space (scripts/spaces/optimize-assets.mjs).

/** Geometry precision per kind of file (see lib/meshopt-glb.mjs). */
export const GEOMETRY_PROFILES = {
  // Buildings and stone seen from a metre away: 0.25 mm position step, 10-bit normals.
  architecture: { positionStep: 0.00025, texcoordStep: 1 / 16384, colorStep: 1 / 4096, normalBits: 10, normalTolerance: 0.006 },
  // The gate files arrive quantized by the modeller (positions and normals kept exactly as
  // delivered); only their float texture coordinates are compressed.
  gate: { positionStep: 0.00025, texcoordStep: 1 / 16384, colorStep: 1 / 4096, normalBits: 8, normalTolerance: 0.025 },
  // Foliage: 8-bit normals (leaf cards and bark are noisy), positions as fine as architecture so
  // LOD silhouettes do not move.
  vegetation: { positionStep: 0.00025, texcoordStep: 1 / 16384, colorStep: 1 / 4096, normalBits: 8, normalTolerance: 0.025 },
  // The skinned avatar: close to the camera, 10-bit normals and tangents.
  avatar: { positionStep: 0.0001, texcoordStep: 1 / 16384, colorStep: 1 / 4096, normalBits: 10, normalTolerance: 0.006 },
};

export default {
  name: "national-assembly",
  /** Runtime folder (relative to the repository root): the optimised GLBs are written here. */
  out: "frontend/src/spaces/national-assembly/assets",
  /** Read-only manifests in the runtime folder that name nodes the viewer needs. */
  manifests: { scenery: "scenery.json", vegetation: "vegetation.json" },
  /** Geometry profile per file (by name), with a fallback by prefix. */
  geometryProfile(file) {
    if (file === "avatar.glb") return "avatar";
    if (file.startsWith("scenery-gate")) return "gate";
    if (file.startsWith("vegetation")) return "vegetation";
    return "architecture";
  },
  /**
   * Hero textures (agreed set): unchanged resolution, UASTC with RDO, normal maps included. On the
   * gate the name board, the painted eaves and brackets seen from the ground (Symbol*, Fw01A,
   * 1F_Wood, Mark01A), the door leaves (Gate02A) and the stone base in and around the passages
   * (Gw*, Gate01/03/04A, W01A, Ws01A, 3D*, Gp01A, Wb01A, Gst01A); the Haetae pair at the Assembly
   * (scenery-heritage); the Assembly entrance granite and column bases (Granite_Facade,
   * Granite_Podium); the avatar. Matched by the materials that use a texture; ORM maps follow the
   * general rule (ETC1S) whatever material uses them.
   */
  hero(materialName, file) {
    if (file === "avatar.glb") return true;
    if (file.startsWith("scenery-gate-1")) return /^MI_GHM_(HangingBoard|Symbol0\dA|Fw01A|1F_Wood|Mark01A|Gate0[1-4]A|Gw0\dA|W01A|Ws01A|3D0\dA|Gp01A|Wb01A|Gst01A)$/.test(materialName);
    if (file === "scenery-heritage.glb") return /^MI_GHM_Haetae[AB]$/.test(materialName);
    if (file === "national-assembly.glb") return /^Granite_(Facade|Podium)$/.test(materialName);
    return false;
  },
  /** Non-hero textures that ETC1S visibly failed at a review station: UASTC (by texture name). */
  uastcOverrides: [],
  /** Texel-density caps (px per metre) and the distance classes they apply to (m). */
  // A texture drops a mip level while every class keeps at least `tolerance` x its cap ("about").
  density: { caps: { near: 512, far: 256, distant: 128 }, nearM: 3, distantM: 15, minShare: 0.02, tileSpan: 1.5, minSize: 128, tolerance: 0.9 },
  /** No runtime file may exceed this (the repository and the deploy image carry every file). */
  maxFileBytes: 45 * 1024 * 1024,
  /** Folder (inside the runtime folder) for the content-addressed KTX2 texture files. */
  textureDir: "textures",
  /** Node name prefixes the viewer's code looks for (materials.js SURFACE, vegetation.js, doors). */
  requiredPrefixes: ["Water_", "Flag_", "Lawn_", "Paving_", "Road_", "Bed_", "Fountain_", "Interior_", "VegLib_", "Door_"],
  /** Individual nodes that must exist in the output when they exist in the delivery. */
  requiredNames: ["Door_Fixed"],
};
