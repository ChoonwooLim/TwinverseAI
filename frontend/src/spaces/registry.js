import { lazy } from "react";

/**
 * Openable 3D spaces: preset `scene` key -> lazily loaded scene component.
 * Adding a space = one folder under src/spaces/<key>/ + one line here + one preset item
 * with `scene: "<key>"` in src/data/productPresets.js.
 *
 * Nothing here imports three.js; the scene chunk loads only when a viewer renders it.
 */

const CHUNK_ERROR = "SceneChunkError";

/** Wraps a dynamic import so a failed chunk download is recognisable by the viewer. */
function lazyScene(load) {
  return lazy(() =>
    load().catch((cause) => {
      const error = new Error("The 3D scene module could not be loaded.", { cause });
      error.name = CHUNK_ERROR;
      throw error;
    }),
  );
}

export const SPACE_SCENES = {
  "national-assembly": lazyScene(() => import("./national-assembly/NationalAssemblyScene")),
  "spark-streaming-lod": lazyScene(() => import("./spark-streaming-lod/SparkStreamingLodScene")),
  "spark-interactivity": lazyScene(() => import("./spark-interactivity/SparkInteractivityScene")),
};

export const SPACE_VIEWER_KINDS = {
  "national-assembly": "walkable",
  "spark-streaming-lod": "spark-lod",
  "spark-interactivity": "spark-interactivity",
};

export function hasSpaceScene(key) {
  return typeof key === "string" && Object.hasOwn(SPACE_SCENES, key);
}

export function getSpaceViewerKind(key) {
  return (typeof key === "string" && SPACE_VIEWER_KINDS[key]) || "walkable";
}

export function isSceneChunkError(error) {
  return error?.name === CHUNK_ERROR;
}
