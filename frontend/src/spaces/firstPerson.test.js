import { describe, expect, it } from "vitest";
import {
  AVATAR_HIDDEN_STORAGE_KEY,
  FIRST_PERSON,
  eyeHeight,
  firstPersonPolarLimits,
  readStoredAvatarHidden,
  transitionAmount,
  viewRelativeMove,
  viewYaw,
  writeStoredAvatarHidden,
} from "./firstPerson";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

describe("hidden-avatar preference", () => {
  it("is remembered and read back, and survives blocked storage", () => {
    const storage = memoryStorage();
    expect(readStoredAvatarHidden(storage)).toBe(false);
    writeStoredAvatarHidden(storage, true);
    expect(storage.getItem(AVATAR_HIDDEN_STORAGE_KEY)).toBe("1");
    expect(readStoredAvatarHidden(storage)).toBe(true);
    writeStoredAvatarHidden(storage, false);
    expect(readStoredAvatarHidden(storage)).toBe(false);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readStoredAvatarHidden(blocked)).toBe(false);
    expect(() => writeStoredAvatarHidden(blocked, true)).not.toThrow();
    expect(readStoredAvatarHidden(null)).toBe(false);
  });
});

describe("eye height", () => {
  it("comes from the head bone when plausible, else from the height", () => {
    expect(eyeHeight({ headY: 1.55, heightM: 1.75 })).toBeCloseTo(1.55 + FIRST_PERSON.eyeAboveHeadBone, 9);
    expect(eyeHeight({ headY: 0.3, heightM: 1.75 })).toBeCloseTo(1.75 * 0.92, 9);
    expect(eyeHeight({ headY: undefined, heightM: 1.8 })).toBeCloseTo(1.8 * 0.92, 9);
    expect(eyeHeight({ headY: 1.74, heightM: 1.75 })).toBeLessThanOrEqual(1.75 * 0.97);
  });
});

describe("look limits", () => {
  it("allow about 85 degrees up and 80 degrees down", () => {
    const { min, max } = firstPersonPolarLimits();
    expect((min * 180) / Math.PI).toBeCloseTo(10, 9);
    expect((max * 180) / Math.PI).toBeCloseTo(175, 9);
  });
});

describe("movement in first person", () => {
  it("follows the camera's horizontal look direction", () => {
    expect(viewRelativeMove(1, 0, { forward: 1 })).toEqual({ x: 1, z: 0, moving: true });
    const right = viewRelativeMove(1, 0, { right: 1 });
    expect(right.x).toBeCloseTo(0, 9);
    expect(right.z).toBeCloseTo(1, 9);
    const back = viewRelativeMove(0, 3, { forward: -1 });
    expect(back.z).toBeCloseTo(-1, 9);
    const diagonal = viewRelativeMove(0, 1, { forward: 1, right: 1 });
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 9);
    expect(viewRelativeMove(1, 0, {})).toEqual({ x: 0, z: 0, moving: false });
    // The body turns with the view: yaw for a look along +X.
    expect(viewYaw(1, 0)).toBeCloseTo(Math.PI / 2, 9);
  });

  it("glides over about 0.4 s, or cuts under reduced motion", () => {
    expect(transitionAmount(0)).toBe(0);
    expect(transitionAmount(0.2)).toBeCloseTo(0.5, 9);
    expect(transitionAmount(0.4)).toBe(1);
    expect(transitionAmount(0, 0.4, true)).toBe(1);
  });
});
