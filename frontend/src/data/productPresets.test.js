import { describe, expect, it } from "vitest";
import { PRESET_CATEGORIES, findPresetCategory } from "./productPresets";
import { hasSpaceScene } from "../spaces/registry";

describe("PRESET_CATEGORIES", () => {
  it("lists the categories in menu order", () => {
    expect(PRESET_CATEGORIES.map((c) => c.slug)).toEqual([
      "video",
      "image",
      "character",
      "3d-space",
      "audio",
      "website",
    ]);
  });

  it("uses URL-safe, unique slugs and complete category fields", () => {
    const slugs = new Set();
    for (const category of PRESET_CATEGORIES) {
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(slugs.has(category.slug)).toBe(false);
      slugs.add(category.slug);
      expect(category.label).toBeTruthy();
      expect(category.desc).toBeTruthy();
      expect(category.holds.length).toBeGreaterThan(0);
      expect(Array.isArray(category.items)).toBe(true);
    }
  });

  it("keeps preset ids unique within each category", () => {
    for (const category of PRESET_CATEGORIES) {
      const ids = category.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("points every scene preset at a registered 3D space, only in the 3d-space category", () => {
    for (const category of PRESET_CATEGORIES) {
      for (const item of category.items) {
        if (item.scene === undefined) continue;
        expect(category.slug).toBe("3d-space");
        expect(hasSpaceScene(item.scene)).toBe(true);
      }
    }
  });

  it("lists the National Assembly as an openable 3D space", () => {
    const item = findPresetCategory("3d-space").items.find((entry) => entry.id === "national-assembly");
    expect(item).toBeTruthy();
    expect(item.scene).toBe("national-assembly");
    expect(item.name).toBe("여의도 국회의사당");
    expect(item.tags).toEqual(["건축", "야외", "WASD 이동"]);
  });
});

describe("findPresetCategory", () => {
  it("resolves every slug, including 3d-space", () => {
    expect(findPresetCategory("3d-space")?.label).toBe("3D 공간 프리셋");
    for (const category of PRESET_CATEGORIES) {
      expect(findPresetCategory(category.slug)).toBe(category);
    }
  });

  it("returns undefined for unknown or missing slugs", () => {
    expect(findPresetCategory("products-x")).toBeUndefined();
    expect(findPresetCategory(undefined)).toBeUndefined();
  });
});
