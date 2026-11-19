import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRESET_CATEGORIES, findPreset, findPresetCategory } from "./productPresets";
import { ASPECT_PATTERN, MEDIA_ACCESS, MEDIA_FILE_PATTERN } from "./presetMedia";
import { hasSpaceScene } from "../spaces/registry";

const FRONTEND_DIR = fileURLToPath(new URL("../../", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));
const SECTION_KINDS = ["steps", "list", "table"];

const detailedPresets = PRESET_CATEGORIES.flatMap((category) =>
  category.items.filter((item) => item.detail).map((item) => ({ category, item })),
);

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

  it("lists SparkJS Streaming LoD as an openable 3D space", () => {
    const item = findPresetCategory("3d-space").items.find((entry) => entry.id === "spark-streaming-lod");
    expect(item).toBeTruthy();
    expect(item.scene).toBe("spark-streaming-lod");
    expect(item.name).toBe("SparkJS 스트리밍 LOD (3DGS)");
    expect(item.tags).toEqual(["3DGS", "스트리밍 LOD", "WASD 이동"]);
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

describe("findPreset", () => {
  it("finds the CineRecast preset in the video category", () => {
    const video = findPresetCategory("video");
    expect(video.items.map((item) => item.id)).toContain("cine-recast-dragon-rider");
    const preset = findPreset("video", "cine-recast-dragon-rider");
    expect(preset?.id).toBe("cine-recast-dragon-rider");
    expect(preset?.detail).toBeTruthy();
  });

  it("returns undefined for unknown ids and categories", () => {
    expect(findPreset("video", "no-such-preset")).toBeUndefined();
    expect(findPreset("video", undefined)).toBeUndefined();
    expect(findPreset("image", "cine-recast-dragon-rider")).toBeUndefined();
    expect(findPreset("no-such-category", "cine-recast-dragon-rider")).toBeUndefined();
    expect(findPreset(undefined, undefined)).toBeUndefined();
  });
});

describe("preset items", () => {
  it("use URL-safe ids and a thumbnail that exists (under frontend/public, or an imported asset)", () => {
    for (const category of PRESET_CATEGORIES) {
      for (const item of category.items) {
        expect(item.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(item.name).toBeTruthy();
        expect(item.summary).toBeTruthy();
        if (item.thumbnail) {
          expect(item.thumbnail).toMatch(/^\/[A-Za-z0-9/._-]+$/);
          expect(item.thumbnail).not.toContain("..");
          // An imported asset resolves to /src/... under the test runner; everything else lives in /public.
          const base = item.thumbnail.startsWith("/src/") ? FRONTEND_DIR : PUBLIC_DIR;
          expect(existsSync(base + item.thumbnail.slice(1)), item.thumbnail).toBe(true);
        }
        if (item.updatedAt) expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

describe("preset detail records", () => {
  it("exist for at least the CineRecast preset", () => {
    expect(detailedPresets.map(({ item }) => item.id)).toContain("cine-recast-dragon-rider");
  });

  it.each(detailedPresets.map(({ category, item }) => [`${category.slug}/${item.id}`, item]))(
    "%s is well formed",
    (_path, item) => {
      const { detail } = item;
      expect(typeof detail.lead).toBe("string");
      expect(detail.lead.length).toBeGreaterThan(0);
      expect(item.thumbnail).toBeTruthy();

      for (const fact of detail.facts) {
        expect(typeof fact.label).toBe("string");
        expect(typeof fact.value).toBe("string");
      }

      const mediaIds = detail.media.map((m) => m.id);
      expect(new Set(mediaIds).size).toBe(mediaIds.length);
      for (const media of detail.media) {
        expect(MEDIA_ACCESS).toContain(media.access);
        expect(media.file).toMatch(MEDIA_FILE_PATTERN);
        expect(media.poster).toMatch(MEDIA_FILE_PATTERN);
        expect(media.aspect).toMatch(ASPECT_PATTERN);
        expect(media.title).toBeTruthy();
      }

      if (detail.privateNotes) {
        expect(detail.privateNotes.title).toBeTruthy();
        expect(detail.privateNotes.file).toMatch(MEDIA_FILE_PATTERN);
        expect(detail.privateNotes.access).toBe("admin");
      }

      const sectionIds = detail.sections.map((s) => s.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      for (const section of detail.sections) {
        expect(section.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(section.title).toBeTruthy();
        expect(SECTION_KINDS).toContain(section.kind);
        if (section.kind === "table") {
          expect(section.columns.length).toBeGreaterThan(0);
          expect(section.rows.length).toBeGreaterThan(0);
          for (const row of section.rows) expect(row).toHaveLength(section.columns.length);
        } else {
          expect(section.items.length).toBeGreaterThan(0);
          for (const entry of section.items) {
            expect(typeof entry.title).toBe("string");
            expect(typeof entry.body).toBe("string");
          }
        }
      }
    },
  );

  it("keep the CineRecast videos behind administrator access", () => {
    const { detail } = findPreset("video", "cine-recast-dragon-rider");
    expect(detail.media.map((m) => m.access)).toEqual(["admin", "admin"]);
    expect(detail.privateNotes.access).toBe("admin");
  });
});
