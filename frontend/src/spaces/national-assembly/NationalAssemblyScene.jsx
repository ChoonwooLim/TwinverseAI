/**
 * Walkable 3D scene of the National Assembly Building (Yeouido). Mount it anywhere inside a
 * <Suspense> (it is lazy-loaded through src/spaces/registry.js); it fills its parent by default.
 *
 * Props (all optional):
 *   className, style   size and placement of the scene container (defaults to 100% x 100%)
 *   interactive        true: walking, orbit camera, tour and photo mode; false: a passive slow
 *                      orbit around the building with all input disabled (background use)
 *   keysRef            ref whose `.current` is a Set of held KeyboardEvent.code values; the host
 *                      decides when keys count (SpaceViewport only fills it while focused)
 *   zoomEnabled        wheel / pinch zoom on or off (default true)
 *   quality            "max" | "high" | "balanced"; null lets the engine pick (and remember none)
 *   exposure           tone-mapping exposure (default 1)
 *   photoMode          null, or { focus: "building" | "avatar" } for depth of field and free orbit
 *   showStats          emit onStats about twice a second
 *   avatarHidden       hide the avatar model and use the first-person view (default false)
 *   autoQuality        lower the preset automatically when frames are steadily slow (default true)
 *   apiRef             receives { reset(), startTour(), stopTour(), toggleFlight(), capture() -> Promise<Blob>,
 *                      captureStations(), captureStation(station, options) -> Promise<Blob>, leaveCapture() }
 *   onProgress({ percent, loaded, total }), onReady({ backend, quality, ... }),
 *   onQualityChange(key, reason), onStats(stats), onTourChange(active), onNotice(text),
 *   onScenery({ state, file, index, count, percent }), onVegetation({ state, file, index, count, percent }),
 *   onFlightChange(flying), onQualityApplying(active), onError(kind, error), onDeviceLost(info)
 *
 * Assets: see ./assets.js (required files as static imports, optional ones through
 * import.meta.glob) and SOURCES.md.
 */
import { ASSETS } from "./assets";
import WalkableSpace from "../engine/WalkableSpace";

export default function NationalAssemblyScene(props) {
  return <WalkableSpace assets={ASSETS} {...props} />;
}
