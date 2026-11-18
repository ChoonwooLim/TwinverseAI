import { describe, expect, it } from "vitest";
import { PRESET_CATEGORIES, findPresetCategory } from "./productPresets";

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
    }
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
