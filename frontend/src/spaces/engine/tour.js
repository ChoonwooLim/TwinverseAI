// Cinematic tour: an eased camera flight around the building, derived from its bounds.
import { CatmullRomCurve3, Vector3 } from "three/webgpu";

export const TOUR_SECONDS = 40;
const STILL_SHOTS = 5;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * @param {{ min: number[], max: number[] }} bounds building bounds (metres)
 * @param {{ lift?: number }} [options] raises every camera position (not the targets), used when
 *   the path would pass through scenery
 */
export function createTour(bounds, { lift = 0 } = {}) {
  const min = new Vector3(...(bounds?.min ?? [-65, 0, -44]));
  const max = new Vector3(...(bounds?.max ?? [65, 70, 62]));
  const centre = min.clone().add(max).multiplyScalar(0.5);
  const size = max.clone().sub(min);
  const reach = Math.max(size.x, size.z) * 0.5;
  const height = Math.max(10, size.y);
  const front = max.z;
  const base = min.y;
  const raise = Math.max(0, Number(lift) || 0);

  // Camera positions: high front approach, around the right side, behind, the left side,
  // then a low close view of the front looking up at the building. Heights are above its base.
  const at = (angleDeg, distance, y) => {
    const a = (angleDeg * Math.PI) / 180;
    return new Vector3(centre.x + Math.sin(a) * distance, base + y + raise, centre.z + Math.cos(a) * distance);
  };
  const above = (x, y, z) => new Vector3(x, base + y, z);
  const positions = [
    above(centre.x, height * 0.95 + raise, front + reach * 2.6),
    at(35, reach * 2.2, height * 0.65),
    at(95, reach * 1.9, height * 0.8),
    at(180, reach * 2.1, height * 1.15),
    at(265, reach * 1.9, height * 0.7),
    at(330, reach * 1.7, height * 0.35),
    above(centre.x + reach * 0.25, 2.2 + raise, front + reach * 0.55),
  ];
  const targets = [0.45, 0.4, 0.35, 0.45, 0.35, 0.4, 0.75].map((share) => above(centre.x, height * share, centre.z));
  const positionCurve = new CatmullRomCurve3(positions, false, "centripetal");
  const targetCurve = new CatmullRomCurve3(targets, false, "centripetal");

  return {
    duration: TOUR_SECONDS,
    lift: raise,
    /**
     * Writes the camera pose at `elapsed` seconds into `position` and `target`. With `still`
     * (reduced motion) the tour is a sequence of fixed shots that cut every few seconds.
     * @returns {boolean} true once the tour has finished
     */
    sample(elapsed, still, position, target) {
      const t = Math.min(1, Math.max(0, elapsed / TOUR_SECONDS));
      if (still) {
        const shot = Math.min(STILL_SHOTS - 1, Math.floor(t * STILL_SHOTS));
        const u = shot / (STILL_SHOTS - 1);
        positionCurve.getPointAt(u, position);
        targetCurve.getPointAt(u, target);
      } else {
        const eased = easeInOut(t);
        positionCurve.getPointAt(eased, position);
        targetCurve.getPointAt(eased, target);
      }
      return t >= 1;
    },
  };
}
