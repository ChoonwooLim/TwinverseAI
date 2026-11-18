// Bundled assets of the National Assembly space. Required files are static imports (content-hashed
// by Vite); optional ones are picked up with import.meta.glob, so the build works whether or not
// they exist. See SOURCES.md for where each file comes from.
import worldUrl from "./assets/national-assembly.glb?url";
import avatarUrl from "./assets/avatar.glb?url";
import skyUrl from "./assets/sky_2k.hdr?url";
import colliders from "./assets/colliders.json";
import avatarConfig from "./assets/avatar.json";
import { COLLISION_PROBES } from "./collisionProbes";
import { CAPTURE_STATIONS } from "./captureStations";

const optional = import.meta.glob(["./assets/sky_bg_8k.jpg", "./assets/vegetation-*.glb", "./assets/scenery-*.glb"], {
  eager: true,
  query: "?url",
  import: "default",
});
// Retargeted motion-capture clips (scripts/avatar/build-avatar-animations.mjs; without them the
// avatar falls back to the procedural rig), the vegetation manifest and scenery placements.
const optionalData = import.meta.glob(["./assets/avatar-animations.json", "./assets/vegetation.json", "./assets/scenery.json"], {
  eager: true,
  import: "default",
});
// KTX2 textures written by scripts/spaces/optimize-assets.mjs as content-addressed files; the GLBs
// reference them as textures/<name>.ktx2 and the loader maps each name to its bundled URL.
const textures = import.meta.glob("./assets/textures/*.ktx2", { eager: true, query: "?url", import: "default" });
// Heightfield grids named in colliders.json (heightfield.bin, heightfield-<name>.bin).
const heightfields = import.meta.glob(["./assets/heightfield.bin", "./assets/heightfield-*.bin"], {
  eager: true,
  query: "?url",
  import: "default",
});

/** File name -> URL for numbered optional files such as vegetation-1.glb or scenery-2.glb. */
export function numberedFiles(globResult, prefix) {
  const pattern = new RegExp(`/${prefix}-\\d+\\.glb$`);
  return Object.fromEntries(
    Object.entries(globResult)
      .filter(([path]) => pattern.test(path))
      .map(([path, url]) => [path.split("/").pop(), url])
      .sort(([a], [b]) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0) || a.localeCompare(b)),
  );
}

/** scenery-*.glb in a stable order: numbered files by number, others by name after them. */
export function sceneryFiles(globResult) {
  const entries = Object.entries(globResult)
    .filter(([path]) => /\/scenery-[^/]+\.glb$/.test(path))
    .map(([path, url]) => [path.split("/").pop(), url]);
  const number = (name) => {
    const match = /^scenery-(\d+)\.glb$/.exec(name);
    return match ? Number(match[1]) : Infinity;
  };
  entries.sort(([a], [b]) => number(a) - number(b) || a.localeCompare(b));
  return Object.fromEntries(entries);
}

export const ASSETS = Object.freeze({
  worldUrl,
  avatarUrl,
  environmentUrl: skyUrl,
  backgroundUrl: optional["./assets/sky_bg_8k.jpg"] ?? null,
  // scenery-*.glb: optional static scenery (statues, the gate complex), loaded after the building;
  // scenery.json can place files that were modelled around their own origin.
  scenery: { files: sceneryFiles(optional), placements: optionalData["./assets/scenery.json"]?.placements ?? {} },
  heightfieldUrls: Object.fromEntries(Object.entries(heightfields).map(([path, url]) => [path.split("/").pop(), url])),
  textureUrls: Object.fromEntries(Object.entries(textures).map(([path, url]) => [path.split("/").pop(), url])),
  // vegetation-1.glb ... plus vegetation.json (species, LODs, instances); all optional.
  vegetation: { files: numberedFiles(optional, "vegetation"), manifest: optionalData["./assets/vegetation.json"] ?? null },
  colliders,
  avatarConfig,
  avatarAnimations: optionalData["./assets/avatar-animations.json"] ?? null,
  // World-space segments that must hit solid scenery once it is loaded (collisionProbes.js).
  collisionProbes: COLLISION_PROBES,
  // Fixed camera stations for before/after review captures (?capture=1).
  captureStations: CAPTURE_STATIONS,
});
