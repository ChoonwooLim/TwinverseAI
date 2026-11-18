import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import designsData from "./designs.json";
import { CAPABILITIES } from "./platformContent";
import {
  DESIGN_CATEGORIES,
  DESK_LINKS,
  SERVICE_CAPABILITIES,
  designCategoryFromSlug,
  toCategorySlug,
} from "./sectionNav";

describe("DESIGN_CATEGORIES", () => {
  it("matches the category titles and order of designs.json", () => {
    expect(DESIGN_CATEGORIES.map((c) => c.title)).toEqual(designsData.categories.map((c) => c.title));
  });

  it("uses unique, URL-safe slugs derived from the titles", () => {
    const slugs = DESIGN_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const category of DESIGN_CATEGORIES) {
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(category.slug).toBe(toCategorySlug(category.title));
      expect(encodeURIComponent(category.slug)).toBe(category.slug);
    }
  });
});

describe("toCategorySlug", () => {
  it("lowercases and collapses non-alphanumerics into single hyphens", () => {
    expect(toCategorySlug("AI & Machine Learning")).toBe("ai-machine-learning");
    expect(toCategorySlug("Developer Tools & Platforms")).toBe("developer-tools-platforms");
    expect(toCategorySlug("  Fintech / Crypto!  ")).toBe("fintech-crypto");
  });
});

describe("designCategoryFromSlug", () => {
  it("resolves every slug back to its category", () => {
    for (const category of DESIGN_CATEGORIES) {
      expect(designCategoryFromSlug(category.slug)).toBe(category);
    }
    expect(designCategoryFromSlug("ai-machine-learning")?.title).toBe("AI & Machine Learning");
  });

  it("returns undefined for unknown or missing slugs", () => {
    expect(designCategoryFromSlug("AI & Machine Learning")).toBeUndefined();
    expect(designCategoryFromSlug("unknown")).toBeUndefined();
    expect(designCategoryFromSlug("")).toBeUndefined();
    expect(designCategoryFromSlug(null)).toBeUndefined();
    expect(designCategoryFromSlug(undefined)).toBeUndefined();
  });
});

describe("SERVICE_CAPABILITIES", () => {
  it("matches the ids, names and order of CAPABILITIES", () => {
    expect(SERVICE_CAPABILITIES).toEqual(CAPABILITIES.map(({ id, name }) => ({ id, name })));
  });

  it("does not reuse the section anchors of the 서비스 page", () => {
    const sectionIds = ["capabilities", "use-cases", "faq", "next"];
    for (const { id } of SERVICE_CAPABILITIES) {
      expect(sectionIds).not.toContain(id);
    }
  });
});

describe("DESK_LINKS", () => {
  it("lists the four TwinverseDesk pages in menu order", () => {
    expect(DESK_LINKS.map((link) => link.path)).toEqual([
      "/twinversedesk/analysis",
      "/twinversedesk/plan",
      "/twinversedesk/launch",
      "/twinversedesk/run",
    ]);
    for (const link of DESK_LINKS) expect(link.label).toBeTruthy();
  });

  it("mirrors DESK_ITEMS in TopBar.jsx", () => {
    // TopBar does not export DESK_ITEMS, so read the entries from its source.
    const source = readFileSync(new URL("../components/layout/TopBar.jsx", import.meta.url), "utf8");
    const block = source.match(/const DESK_ITEMS = \[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const items = [...block[1].matchAll(/label:\s*"([^"]*)",\s*path:\s*"([^"]*)"/g)].map(([, label, path]) => ({ label, path }));
    expect(DESK_LINKS).toEqual(items);
  });
});
