/**
 * Frame-time guard: decides when the quality preset should step down. Pure, no three.js.
 *
 * - A stall is not a rate: frames over `stallMs`, or over `stallFactor` x the running median,
 *   are left out of the samples (shader compilation, uploads, a preset change).
 * - Nothing is judged until loading has finished and, after every preset change, until a quiet
 *   run of at least `quietFrames` consecutive non-stall frames spanning `quietMs`.
 * - A verdict needs sustained evidence: at least `judgedFrames` judged frames spanning
 *   `judgedMs`, with the median over the limit (`slowMs` for a preset chosen automatically,
 *   `overloadMs` for any preset). After a step-down the guard starts over, so two step-downs
 *   always need that evidence at the level in between.
 * - Sustained stalls (every one of the last `sustainedStalls` frames a stall, spanning
 *   `sustainedMs`) count as an overload, but only after the quiet run: loading and compiling
 *   stalls never count.
 * - `enabled: false` (the visitor turned automatic quality off) never steps down.
 */

export const FRAME_GUARD = Object.freeze({
  stallMs: 400,
  stallFactor: 5,
  quietFrames: 30,
  quietMs: 2000,
  judgedFrames: 30,
  judgedMs: 3000,
  slowMs: 24,
  overloadMs: 100,
  windowFrames: 240,
  sustainedStalls: 12,
  sustainedMs: 8000,
});

export function createFrameGuard({ enabled = true } = {}) {
  return { enabled, samples: [], recentStalls: [], quietFrames: 0, quietMs: 0, quiet: false, loaded: false };
}

/** Starts over (after a preset change): a new quiet run and new evidence are needed. */
export function resetFrameGuard(guard) {
  guard.samples = [];
  guard.recentStalls = [];
  guard.quietFrames = 0;
  guard.quietMs = 0;
  guard.quiet = false;
  return guard;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Whether a frame time is a stall given the samples so far. */
export function isStall(ms, samples) {
  if (ms > FRAME_GUARD.stallMs) return true;
  if (samples.length >= 10 && ms > FRAME_GUARD.stallFactor * median(samples)) return true;
  return false;
}

/**
 * Feeds one frame time. Returns false, "slow" (an automatically chosen preset is slow) or
 * "overload" (any preset is unusably slow).
 * @param {object} guard from createFrameGuard (mutated)
 * @param {number} ms
 * @param {{ loaded: boolean, userChosen: boolean, canStepDown: boolean }} context
 */
export function feedFrameGuard(guard, ms, { loaded, userChosen, canStepDown }) {
  if (!guard.enabled || !canStepDown || !(ms > 0)) return false;
  if (!loaded) return false;
  const G = FRAME_GUARD;

  if (isStall(ms, guard.samples)) {
    if (!guard.quiet) {
      // Before the quiet run no rule counts anything, the sustained-stall rule included.
      guard.quietFrames = 0;
      guard.quietMs = 0;
      return false;
    }
    guard.recentStalls.push(ms);
    if (guard.recentStalls.length > G.sustainedStalls) guard.recentStalls.shift();
    const span = guard.recentStalls.reduce((sum, value) => sum + value, 0);
    if (guard.recentStalls.length >= G.sustainedStalls && span >= G.sustainedMs) return "overload";
    return false;
  }
  guard.recentStalls = [];

  if (!guard.quiet) {
    guard.quietFrames++;
    guard.quietMs += ms;
    if (guard.quietFrames >= G.quietFrames && guard.quietMs >= G.quietMs) guard.quiet = true;
    return false;
  }

  guard.samples.push(ms);
  if (guard.samples.length > G.windowFrames) guard.samples.shift();
  const span = guard.samples.reduce((sum, value) => sum + value, 0);
  if (guard.samples.length < G.judgedFrames || span < G.judgedMs) return false;
  const m = median(guard.samples);
  if (m > G.overloadMs) return "overload";
  if (!userChosen && m > G.slowMs) return "slow";
  return false;
}

export const AUTO_QUALITY_STORAGE_KEY = "twinverse.space.autoQuality";

/** The "lower quality automatically when slow" choice; on unless turned off in this browser. */
export function readStoredAutoQuality(storage) {
  try {
    return storage?.getItem(AUTO_QUALITY_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeStoredAutoQuality(storage, enabled) {
  try {
    storage?.setItem(AUTO_QUALITY_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the choice simply is not remembered.
  }
}
