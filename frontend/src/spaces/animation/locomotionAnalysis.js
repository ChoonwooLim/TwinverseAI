// Measurements and clean-up for retargeted locomotion clips: loop closure, in-place hips,
// ground contact, natural ground speed, gait phase and left/right symmetry. Pure maths on
// per-frame data; no three.js import. Positions are metres, +Y up, +Z forward.

const DEG = 180 / Math.PI;

/** Angle (degrees) between two unit quaternions given as [x, y, z, w]. */
export function quaternionAngle(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot)) * DEG;
}

/** Flips quaternion signs so consecutive keys take the short path. Mutates and returns `keys`. */
export function makeQuaternionsContinuous(keys) {
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) keys[i] = b.map((v) => -v);
  }
  return keys;
}

/**
 * How far the last frame is from the first, against a typical frame step (both: the largest
 * joint rotation in degrees). A clip whose last frame repeats the first is "closed"; otherwise
 * the cycle is one frame longer than the samples.
 * @param {Record<string, number[][]>} rotations bone -> per-frame [x, y, z, w]
 */
export function loopGap(rotations) {
  const bones = Object.keys(rotations);
  const frames = rotations[bones[0]]?.length ?? 0;
  let gap = 0;
  let stepSum = 0;
  for (let f = 1; f < frames; f++) {
    let step = 0;
    for (const bone of bones) step = Math.max(step, quaternionAngle(rotations[bone][f - 1], rotations[bone][f]));
    stepSum += step;
  }
  for (const bone of bones) gap = Math.max(gap, quaternionAngle(rotations[bone][0], rotations[bone][frames - 1]));
  const step = frames > 1 ? stepSum / (frames - 1) : 0;
  return { gapDeg: gap, stepDeg: step, closed: gap <= Math.max(0.05, step * 0.25) };
}

/**
 * Removes the steady horizontal drift of the hips over one cycle (in-place playback) and keeps
 * the vertical bob and the lateral sway. For a closed loop the last sample ends the cycle; for an
 * open loop the cycle ends one frame after the last sample, estimated from the neighbouring steps.
 * Mutates and returns `positions` ([x, y, z] per frame) together with the drift per cycle.
 */
export function removeDrift(positions, closed) {
  const n = positions.length;
  const intervals = closed ? n - 1 : n;
  const end = (axis) => {
    const last = positions[n - 1][axis];
    if (closed || n < 3) return last;
    const step = (positions[n - 1][axis] - positions[n - 2][axis] + positions[1][axis] - positions[0][axis]) / 2;
    return last + step;
  };
  const driftX = end(0) - positions[0][0];
  const driftZ = end(2) - positions[0][2];
  for (let i = 0; i < n; i++) {
    const t = i / intervals;
    positions[i][0] -= driftX * t;
    positions[i][2] -= driftZ * t;
  }
  return { positions, driftX, driftZ };
}

/**
 * Ground contact per frame: how far the lower of a foot's ankle and toe joints is above where it
 * is when standing at rest (0 = touching, negative = sinking).
 * @param {{ ankle: number, toe: number }[]} heights joint heights above their rest heights
 */
export function contactHeights(heights) {
  return heights.map(({ ankle, toe }) => Math.min(ankle, toe));
}

function linearSlope(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : null;
}

/**
 * Natural ground speed of a locomotion cycle: while a foot is planted it slides backwards
 * relative to the hips at the walking speed. Contact = within `tolerance` metres of that foot's
 * lowest point. Uses a linear fit of (foot z - hips z) over each contact run, without its first and
 * last frame. Input covers one
 * cycle without a repeated last frame; runs crossing the loop seam are kept whole.
 * @param {{ times: number[], cycleDuration: number, feet: { contact: number[], relZ: number[] }[], tolerance?: number }} input
 * @returns {{ speed: number, runs: number }}
 */
export function groundSpeed({ times, cycleDuration, feet, tolerance = 0.015 }) {
  let weighted = 0;
  let weight = 0;
  let runs = 0;
  const n = times.length;
  for (const foot of feet) {
    const lowest = Math.min(...foot.contact);
    const planted = foot.contact.map((h) => h <= lowest + tolerance);
    const start = planted.findIndex((p) => !p);
    if (start < 0) continue; // never lifts: no stride to measure
    let runT = [];
    let runZ = [];
    const flush = () => {
      // The first and last planted frames are transitions (heel strike, toe-off); leave them out.
      if (runT.length >= 5) {
        runT = runT.slice(1, -1);
        runZ = runZ.slice(1, -1);
      }
      if (runT.length >= 3) {
        const slope = linearSlope(runT, runZ);
        if (slope !== null && slope < 0) {
          const duration = runT[runT.length - 1] - runT[0];
          weighted += -slope * duration;
          weight += duration;
          runs++;
        }
      }
      runT = [];
      runZ = [];
    };
    for (let j = 1; j <= n; j++) {
      const k = start + j;
      const i = k % n;
      if (planted[i]) {
        runT.push(times[i] + Math.floor(k / n) * cycleDuration);
        runZ.push(foot.relZ[i]);
      } else {
        flush();
      }
    }
    flush();
  }
  return { speed: weight > 0 ? weighted / weight : 0, runs };
}

/** Normalised time (0..1) at which a series reaches its maximum (e.g. left foot furthest forward). */
export function phaseOfMaximum(times, values, cycleDuration) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return cycleDuration > 0 ? (times[best] / cycleDuration) % 1 : 0;
}

/** Linear interpolation into a periodic per-frame series at normalised phase u. */
function samplePeriodic(series, u) {
  const n = series.length;
  const x = (((u % 1) + 1) % 1) * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const t = x - Math.floor(x);
  return series[i] * (1 - t) + series[j] * t;
}

/**
 * Left/right symmetry: the largest difference (degrees) between the left limb's angle and the
 * right limb's angle half a cycle later. `left` and `right` are per-frame angles over exactly
 * one cycle (no repeated last frame).
 */
export function symmetryError(left, right, halfCycle = true) {
  let max = 0;
  const n = left.length;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const other = samplePeriodic(right, halfCycle ? u + 0.5 : u);
    max = Math.max(max, Math.abs(left[i] - other));
  }
  return max;
}

/** Forward swing angle (degrees) of a limb direction in the sagittal plane (+Z forward, -Y down). */
export function sagittalAngle(direction) {
  return Math.atan2(direction[2], -direction[1]) * DEG;
}
