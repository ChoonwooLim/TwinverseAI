import { describe, expect, it } from "vitest";
import {
  AUTO_QUALITY_STORAGE_KEY,
  FRAME_GUARD,
  createFrameGuard,
  feedFrameGuard,
  isStall,
  readStoredAutoQuality,
  resetFrameGuard,
  writeStoredAutoQuality,
} from "./frameGuard";

/** Feeds frames and returns the index of the first verdict (or -1) and the verdict. */
function feed(guard, frames, context) {
  for (let i = 0; i < frames.length; i++) {
    const verdict = feedFrameGuard(guard, frames[i], { loaded: true, userChosen: true, canStepDown: true, ...context });
    if (verdict) return { at: i, verdict };
  }
  return { at: -1, verdict: false };
}

const repeat = (ms, count) => Array.from({ length: count }, () => ms);

describe("frame guard", () => {
  it("keeps 최대 after the measured preset-change stalls followed by steady 33 ms frames", () => {
    const guard = createFrameGuard();
    expect(feed(guard, [4050, 2817, ...repeat(33, 281)]).verdict).toBe(false);
    // The other measured case: one 2 483 ms frame in an otherwise steady run.
    expect(feed(guard, [2483, ...repeat(33, 200)]).verdict).toBe(false);
  });

  it("does not judge while loading or with the guard turned off", () => {
    expect(feed(createFrameGuard(), repeat(150, 400), { loaded: false }).verdict).toBe(false);
    expect(feed(createFrameGuard({ enabled: false }), repeat(150, 400)).verdict).toBe(false);
    expect(feed(createFrameGuard(), repeat(150, 400), { canStepDown: false }).verdict).toBe(false);
  });

  it("needs a quiet run and then 30 judged frames over 3 s before stepping down a chosen preset", () => {
    const guard = createFrameGuard();
    const result = feed(guard, repeat(150, 400));
    expect(result.verdict).toBe("overload");
    // 30 quiet frames (4.5 s) and then 30 judged frames (4.5 s): the 60th frame decides.
    expect(result.at).toBe(59);
    // A chosen preset at 30 ms is slow but usable: it stays.
    expect(feed(createFrameGuard(), repeat(30, 600)).verdict).toBe(false);
  });

  it("steps an automatically chosen preset down when it is steadily slow", () => {
    const result = feed(createFrameGuard(), repeat(30, 600), { userChosen: false });
    expect(result.verdict).toBe("slow");
    // Quiet needs 2 s (67 frames at 30 ms), judging needs 3 s (100 frames).
    expect(result.at).toBe(66 + 100);
  });

  it("never steps down twice without fresh evidence at the level in between", () => {
    const guard = createFrameGuard();
    expect(feed(guard, repeat(150, 100)).verdict).toBe("overload");
    resetFrameGuard(guard); // the engine resets after applying the lower preset
    const next = feed(guard, repeat(150, 100));
    expect(next.at).toBe(59); // a full quiet run and a full judged window again
  });

  it("leaves stalls out: over 400 ms, or over 5 x the running median", () => {
    expect(isStall(401, [])).toBe(true);
    expect(isStall(150, repeat(20, 30))).toBe(true);
    expect(isStall(90, repeat(20, 30))).toBe(false);
    // Stalls during the quiet run restart it.
    const guard = createFrameGuard();
    feed(guard, [...repeat(150, 20), 2483, ...repeat(150, 20)]);
    expect(guard.quiet).toBe(false);
  });

  it("treats sustained stalls as an overload only after the quiet run", () => {
    expect(feed(createFrameGuard(), repeat(700, 40)).verdict).toBe(false); // never quiet: never judged
    const result = feed(createFrameGuard(), [...repeat(20, 120), ...repeat(700, 20)]);
    expect(result.verdict).toBe("overload");
    expect(result.at).toBe(120 + FRAME_GUARD.sustainedStalls - 1);
  });

  it("replays the measured load with a stored 최대: nothing counts until loading and compiling are done", () => {
    const guard = createFrameGuard();
    // Loading and shader preparation: long frames while not loaded.
    const loading = [10934, 1383, 784, 1717, 4384, 1867, 850, 1000, ...repeat(16, 300)];
    for (const ms of loading) expect(feedFrameGuard(guard, ms, { loaded: false, userChosen: true, canStepDown: true })).toBe(false);
    // Ready: a couple of first-frame stalls, then steady 17 ms frames for a minute.
    expect(feed(guard, [1350, 783, ...repeat(17, 3500)]).verdict).toBe(false);
  });

  it("remembers the automatic-quality checkbox, on by default", () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    expect(readStoredAutoQuality(storage)).toBe(true);
    writeStoredAutoQuality(storage, false);
    expect(values.get(AUTO_QUALITY_STORAGE_KEY)).toBe("0");
    expect(readStoredAutoQuality(storage)).toBe(false);
    writeStoredAutoQuality(storage, true);
    expect(readStoredAutoQuality(storage)).toBe(true);
    expect(readStoredAutoQuality({ getItem: () => { throw new Error("blocked"); } })).toBe(true);
  });
});
